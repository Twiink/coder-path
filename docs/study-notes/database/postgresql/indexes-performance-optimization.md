---
title: "PostgreSQL索引与性能优化"
aliases:
  - "PostgreSQL索引"
  - "PostgreSQL性能优化"
  - "PostgreSQL EXPLAIN"
tags:
  - "后端"
  - "数据库"
  - "postgresql"
  - "索引"
  - "性能优化"
  - "笔记"
category: "后端"
folder: "PostgreSQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/PostgreSQL/PostgreSQL SQL基础与查询]]"
  - "[[后端/数据库/PostgreSQL/PostgreSQL事务与并发控制]]"
  - "[[后端/数据库/MySQL/索引与执行计划]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 04 PostgreSQL 索引与性能优化

PostgreSQL 提供了 6 种索引类型（B-tree、Hash、GiST、SP-GiST、GIN、BRIN），远超大多数数据库。本章深入讲解各种索引的原理、适用场景，以及查询优化技巧。

## 4.1 索引类型总览

| 索引类型 | 适用场景 | 支持操作符 |
|---------|---------|-----------|
| **B-tree** | 等值、范围查询（默认） | <, <=, =, >=, >, BETWEEN, IN, IS NULL |
| **Hash** | 仅等值查询 | = |
| **GiST** | 几何、范围、全文搜索 | <@, @>, &&, <<, >> 等 |
| **SP-GiST** | 非平衡树结构（IP 地址、电话号码） | <@, @>, ~= 等 |
| **GIN** | 数组、JSONB、全文搜索 | @>, ?, ?&, ?\|, @@ 等 |
| **BRIN** | 自然排序的大表（时间序列） | <, <=, =, >=, > |

## 4.2 B-tree 索引

### 4.2.1 基本用法

```sql
-- 创建 B-tree 索引（默认）
CREATE INDEX idx_users_email ON users(email);

-- 复合索引
CREATE INDEX idx_users_city_age ON users(city, age);

-- 唯一索引
CREATE UNIQUE INDEX uk_users_email ON users(email);

-- 部分索引（只索引满足条件的行）
CREATE INDEX idx_active_users ON users(email) WHERE is_active = true;

-- 表达式索引
CREATE INDEX idx_users_lower_email ON users(LOWER(email));

-- 降序索引
CREATE INDEX idx_users_created_desc ON users(created_at DESC);
```

### 4.2.2 B-tree 适用场景

```sql
-- 等值查询
SELECT * FROM users WHERE email = 'test@example.com';

-- 范围查询
SELECT * FROM users WHERE age BETWEEN 18 AND 30;

-- 排序（利用索引有序性）
SELECT * FROM users ORDER BY created_at DESC LIMIT 10;

-- 复合索引的最左前缀原则
CREATE INDEX idx_orders_user_date ON orders(user_id, order_date);

-- 可以使用索引的查询
SELECT * FROM orders WHERE user_id = 1;  -- 使用索引
SELECT * FROM orders WHERE user_id = 1 AND order_date > '2026-01-01';  -- 使用索引

-- 不能使用索引的查询
SELECT * FROM orders WHERE order_date > '2026-01-01';  -- 不使用索引（跳过 user_id）
```

### 4.2.3 复合索引顺序

```sql
-- 选择性高的列放前面
CREATE INDEX idx_orders_status_user ON orders(status, user_id);
-- status 选择性低（只有几个值），user_id 选择性高

-- 更好的顺序
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
-- user_id 选择性高，放前面

-- 经验法则
-- 1. 等值查询的列放前面
-- 2. 选择性高的列放前面
-- 3. 范围查询的列放后面
```

## 4.3 Hash 索引

```sql
-- 创建 Hash 索引
CREATE INDEX idx_users_email_hash ON users USING HASH (email);

-- 仅支持等值查询
SELECT * FROM users WHERE email = 'test@example.com';  -- 使用索引
SELECT * FROM users WHERE email > 'a@example.com';     -- 不使用索引

-- 适用场景
-- 1. 仅做等值查询
-- 2. 列值分布均匀
-- 3. 不需要范围查询或排序
```

**Hash vs B-tree**：

| 特性 | Hash | B-tree |
|------|------|--------|
| 等值查询 | 略快 | 快 |
| 范围查询 | 不支持 | 支持 |
| 排序 | 不支持 | 支持 |
| 空间占用 | 较小 | 较大 |
| WAL 支持 | PostgreSQL 10+ | 完整支持 |

> **建议**：除非确定只需要等值查询，否则优先使用 B-tree。

## 4.4 GIN 索引（倒排索引）

### 4.4.1 数组索引

```sql
-- 创建 GIN 索引
CREATE INDEX idx_users_tags ON users USING GIN (tags);

-- 支持的查询
SELECT * FROM users WHERE tags @> ARRAY['python'];  -- 包含 'python'
SELECT * FROM users WHERE tags && ARRAY['python', 'java'];  -- 包含任一
SELECT * FROM users WHERE tags @> ARRAY['python', 'docker'];  -- 包含全部

-- 不支持的查询（需要全表扫描）
SELECT * FROM users WHERE 'python' = ANY(tags);  -- 不使用 GIN 索引
```

### 4.4.2 JSONB 索引

```sql
-- 创建 GIN 索引
CREATE INDEX idx_products_attributes ON products USING GIN (attributes);

-- 支持的查询
SELECT * FROM products WHERE attributes @> '{"color": "red"}';
SELECT * FROM products WHERE attributes ? 'brand';
SELECT * FROM products WHERE attributes ?| ARRAY['color', 'size'];
SELECT * FROM products WHERE attributes ?& ARRAY['color', 'brand'];

-- jsonb_path_ops（更紧凑，只支持 @>）
CREATE INDEX idx_products_attributes_path ON products
USING GIN (attributes jsonb_path_ops);

-- 只能使用 @> 操作符
SELECT * FROM products WHERE attributes @> '{"color": "red"}';  -- 使用索引
SELECT * FROM products WHERE attributes ? 'color';  -- 不使用此索引
```

**GIN 索引选项对比**：

| 选项 | 支持操作符 | 索引大小 | 适用场景 |
|------|-----------|---------|---------|
| 默认 | @>, ?, ?\|, ?& | 较大 | 需要多种查询 |
| jsonb_path_ops | 仅 @> | 较小（约 1/3） | 只需要包含查询 |

### 4.4.3 全文搜索索引

```sql
-- 创建全文搜索索引
CREATE INDEX idx_articles_content ON articles USING GIN (to_tsvector('english', content));

-- 查询
SELECT * FROM articles
WHERE to_tsvector('english', content) @@ to_tsquery('english', 'database & performance');

-- 更好的方式：生成列 + 索引
ALTER TABLE articles ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_articles_content_tsv ON articles USING GIN (content_tsv);

-- 查询更简洁
SELECT * FROM articles WHERE content_tsv @@ to_tsquery('database & performance');
```

## 4.5 GiST 索引

### 4.5.1 几何数据索引

```sql
-- 创建 GiST 索引
CREATE INDEX idx_locations_point ON locations USING GIST (point);

-- 范围查询
SELECT * FROM locations
WHERE point <@ BOX '((10,10), (20,20))';  -- 点在矩形内

-- 最近邻查询（KNN）
SELECT * FROM locations
ORDER BY point <-> POINT '(15, 15)'  -- 按距离排序
LIMIT 10;

-- 范围类型索引
CREATE INDEX idx_reservations_during ON reservations USING GIST (during);

SELECT * FROM reservations
WHERE during && '[2026-09-06, 2026-09-07)'::daterange;
```

### 4.5.2 PostGIS 空间索引

```sql
-- 需要 PostGIS 扩展
CREATE EXTENSION postgis;

-- 创建空间索引
CREATE INDEX idx_shops_location ON shops USING GIST (location);

-- 范围查询
SELECT * FROM shops
WHERE ST_DWithin(location, ST_MakePoint(116.4, 39.9)::geography, 1000);
-- 查找 1km 内的商店

-- 最近邻
SELECT * FROM shops
ORDER BY location <-> ST_MakePoint(116.4, 39.9)::geography
LIMIT 10;
```

## 4.6 BRIN 索引（块范围索引）

### 4.6.1 原理

BRIN（Block Range Index）存储每个数据块的**最小值和最大值**，索引极小（KB 级别），适合自然排序的大表。

```text
数据块 1: [2026-01-01, 2026-01-10]
数据块 2: [2026-01-11, 2026-01-20]
数据块 3: [2026-01-21, 2026-01-31]

查询 WHERE date > '2026-01-15':
  - 块 1: max='2026-01-10' < '2026-01-15'，跳过
  - 块 2: min='2026-01-11' <= '2026-01-15' <= max='2026-01-20'，扫描
  - 块 3: min='2026-01-21' > '2026-01-15'，扫描
```

### 4.6.2 使用场景

```sql
-- 创建 BRIN 索引
CREATE INDEX idx_logs_created_brin ON logs USING BRIN (created_at);

-- 适用场景
-- 1. 表很大（百万行以上）
-- 2. 数据自然排序（如时间戳、自增 ID）
-- 3. 查询范围较窄

-- 时间序列数据
SELECT * FROM logs
WHERE created_at BETWEEN '2026-09-01' AND '2026-09-07';

-- 对比 B-tree
CREATE INDEX idx_logs_created_btree ON logs (created_at);

-- B-tree 索引大小：~100MB
-- BRIN 索引大小：~100KB（小 1000 倍！）
```

### 4.6.3 BRIN vs B-tree

| 特性 | BRIN | B-tree |
|------|------|--------|
| 索引大小 | 极小（KB） | 较大（MB） |
| 查询性能 | 略慢 | 快 |
| 维护成本 | 极低 | 较高 |
| 适用数据 | 自然排序 | 任意 |
| 更新性能 | 需要 REINDEX | 自动维护 |

```sql
-- BRIN 索引维护
-- 数据乱序插入后，需要重建索引
REINDEX INDEX idx_logs_created_brin;

-- 或更新统计
SELECT brin_summarize_new_values('idx_logs_created_brin'::regclass);
```

## 4.7 SP-GiST 索引

```sql
-- 适用于非平衡树结构的数据
-- 如：IP 地址、电话号码、几何点（quad-tree）

-- IP 地址范围查询
CREATE INDEX idx_access_log_ip ON access_log USING SPGIST (ip);

SELECT * FROM access_log
WHERE ip << '192.168.1.0/24'::inet;

-- 电话号码前缀查询
CREATE INDEX idx_contacts_phone ON contacts USING SPGIST (phone);

SELECT * FROM contacts
WHERE phone ^@ '138';  -- 以 138 开头
```

## 4.8 索引策略

### 4.8.1 部分索引（Partial Index）

```sql
-- 只索引活跃用户
CREATE INDEX idx_active_users_email ON users(email)
WHERE is_active = true;

-- 只索引未删除的订单
CREATE INDEX idx_pending_orders ON orders(user_id, created_at)
WHERE status = 'pending';

-- 只索引特定条件的数据
CREATE INDEX idx_high_value_orders ON orders(user_id)
WHERE total > 10000;

-- 查询时使用
SELECT * FROM users WHERE is_active = true AND email = 'test@example.com';
-- 使用部分索引，索引更小更快
```

### 4.8.2 表达式索引

```sql
-- 不区分大小写的查询
CREATE INDEX idx_users_lower_email ON users(LOWER(email));

SELECT * FROM users WHERE LOWER(email) = 'test@example.com';

-- 日期部分索引
CREATE INDEX idx_orders_year_month ON orders(EXTRACT(YEAR FROM order_date), EXTRACT(MONTH FROM order_date));

SELECT * FROM orders
WHERE EXTRACT(YEAR FROM order_date) = 2026
  AND EXTRACT(MONTH FROM order_date) = 9;

-- JSONB 字段索引
CREATE INDEX idx_users_city ON users((attributes->>'city'));

SELECT * FROM users WHERE attributes->>'city' = '北京';
```

### 4.8.3 覆盖索引（Index Only Scan）

```sql
-- 创建包含额外列的索引（PostgreSQL 11+）
CREATE INDEX idx_users_email_name ON users(email) INCLUDE (name, age);

-- 查询只需要索引中的列
SELECT email, name, age FROM users WHERE email = 'test@example.com';
-- 使用 Index Only Scan，不需要回表

-- 对比普通索引
CREATE INDEX idx_users_email ON users(email);

SELECT email, name, age FROM users WHERE email = 'test@example.com';
-- 使用 Index Scan，需要回表获取 name 和 age
```

### 4.8.4 并发创建索引

```sql
-- 普通创建索引（会锁表）
CREATE INDEX idx_users_email ON users(email);

-- 并发创建索引（不锁表，但更慢）
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- 并发删除索引
DROP INDEX CONCURRENTLY idx_users_email;
```

**CONCURRENTLY 的限制**：
- 不能在事务中使用
- 创建时间更长（需要两次扫描）
- 如果失败，会留下无效索引，需要手动删除

## 4.9 查询优化

### 4.9.1 EXPLAIN 分析

```sql
-- 基本用法
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';

-- 详细分析（执行查询并显示实际统计）
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- 更多选项
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM users WHERE email = 'test@example.com';

-- JSON 格式（便于程序解析）
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM users WHERE email = 'test@example.com';
```

**EXPLAIN 输出解读**：

```text
Seq Scan on users  (cost=0.00..1.01 rows=1 width=100)
  Filter: (email = 'test@example.com'::text)

-- cost=0.00..1.01  启动成本..总成本（相对值）
-- rows=1           预估返回行数
-- width=100        预估每行字节数

Index Scan using idx_users_email on users  (cost=0.14..8.16 rows=1 width=100)
  Index Cond: (email = 'test@example.com'::text)

-- Index Scan       使用索引扫描
-- Index Cond       索引条件
```

### 4.9.2 常见扫描类型

| 扫描类型 | 说明 | 性能 |
|---------|------|------|
| **Seq Scan** | 顺序扫描（全表扫描） | 慢（大表） |
| **Index Scan** | 索引扫描 + 回表 | 中等 |
| **Index Only Scan** | 仅索引扫描（覆盖索引） | 快 |
| **Bitmap Index Scan** | 位图索引扫描 | 中等（多条件） |
| **TID Scan** | 按 TID 扫描 | 快（特定行） |

```sql
-- Seq Scan（无索引或全表更优）
EXPLAIN SELECT * FROM users;

-- Index Scan（使用索引，需要回表）
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';

-- Index Only Scan（覆盖索引，不需要回表）
EXPLAIN SELECT email FROM users WHERE email = 'test@example.com';

-- Bitmap Index Scan（多个索引组合）
EXPLAIN SELECT * FROM users WHERE city = '北京' AND age > 30;
```

### 4.9.3 JOIN 策略

```sql
-- Nested Loop（嵌套循环）
-- 适用：小表驱动大表，有索引
EXPLAIN SELECT * FROM users u JOIN orders o ON u.id = o.user_id WHERE u.id = 1;

-- Hash Join（哈希连接）
-- 适用：大表连接，无索引
EXPLAIN SELECT * FROM users u JOIN orders o ON u.id = o.user_id;

-- Merge Join（归并连接）
-- 适用：两表都已排序
EXPLAIN SELECT * FROM users u JOIN orders o ON u.id = o.user_id
ORDER BY u.id;
```

**优化 JOIN**：

```sql
-- 1. 确保 JOIN 列有索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 2. 使用合适的 JOIN 顺序
-- PostgreSQL 优化器会自动选择，但可以手动控制
SET join_collapse_limit = 1;  -- 禁用 JOIN 重排序

-- 3. 使用 LATERAL 优化子查询
SELECT u.name, latest_order.*
FROM users u
LEFT JOIN LATERAL (
    SELECT * FROM orders o
    WHERE o.user_id = u.id
    ORDER BY order_date DESC
    LIMIT 1
) latest_order ON true;
```

### 4.9.4 常见性能问题

**问题 1：隐式类型转换**

```sql
-- 错误：字符串列用数字查询
SELECT * FROM users WHERE id = '123';  -- id 是 INTEGER
-- 会触发类型转换，可能不使用索引

-- 正确：类型匹配
SELECT * FROM users WHERE id = 123;
```

**问题 2：函数导致索引失效**

```sql
-- 错误：在索引列上使用函数
SELECT * FROM users WHERE YEAR(created_at) = 2026;
-- 不使用索引

-- 正确：改写为范围查询
SELECT * FROM users
WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01';

-- 或使用表达式索引
CREATE INDEX idx_users_year ON users(EXTRACT(YEAR FROM created_at));
```

**问题 3：LIKE 前置通配符**

```sql
-- 不使用索引
SELECT * FROM users WHERE name LIKE '%张';

-- 使用索引（后置通配符）
SELECT * FROM users WHERE name LIKE '张%';

-- 全文搜索替代方案
CREATE INDEX idx_users_name_gin ON users USING GIN (to_tsvector('simple', name));
SELECT * FROM users WHERE to_tsvector('simple', name) @@ to_tsquery('张');
```

**问题 4：NOT IN 子查询**

```sql
-- 慢：NOT IN 子查询
SELECT * FROM users
WHERE id NOT IN (SELECT user_id FROM orders);

-- 快：NOT EXISTS
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- 快：LEFT JOIN
SELECT u.*
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.id IS NULL;
```

## 4.10 统计信息与查询规划

### 4.10.1 ANALYZE 更新统计

```sql
-- 更新表的统计信息
ANALYZE users;

-- 更新特定列的统计信息
ANALYZE users(email, age);

-- 自动分析（默认开启）
SHOW autovacuum;  -- 应该是 on

-- 查看最后分析时间
SELECT relname, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY last_analyze DESC NULLS LAST;
```

### 4.10.2 调整统计目标

```sql
-- 增加统计精度（默认 100）
ALTER TABLE users ALTER COLUMN email SET STATISTICS 1000;

-- 对高选择性列增加统计
ALTER TABLE orders ALTER COLUMN user_id SET STATISTICS 500;

-- 重新分析
ANALYZE users;
ANALYZE orders;
```

### 4.10.3 查询规划器配置

```sql
-- 查看当前配置
SHOW random_page_cost;  -- 默认 4.0（HDD）
SHOW effective_cache_size;  -- 默认 4GB

-- SSD 优化
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_cache_size = '12GB';  -- 物理内存的 75%

-- 禁用特定扫描类型（调试用）
SET enable_seqscan = off;  -- 强制使用索引
SET enable_hashjoin = off;  -- 禁用 Hash Join

-- 重新加载配置
SELECT pg_reload_conf();
```

## 4.11 索引维护

### 4.11.1 查看索引使用情况

```sql
-- 索引使用统计
SELECT
    schemaname,
    tablename,
    indexrelname AS index_name,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 未使用的索引
SELECT
    schemaname,
    tablename,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- 索引大小
SELECT
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

### 4.11.2 索引膨胀

```sql
-- 检查索引膨胀（需要 pgstattuple 扩展）
CREATE EXTENSION pgstattuple;

SELECT
    indexrelname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    (pgstatindex(indexrelname::text)).*
FROM pg_stat_user_indexes
WHERE schemaname = 'public';

-- 重建膨胀的索引
REINDEX INDEX idx_users_email;

-- 并发重建（不锁表）
REINDEX INDEX CONCURRENTLY idx_users_email;
```

### 4.11.3 删除冗余索引

```sql
-- 查找重复索引
SELECT
    pg_index.indrelid::regclass AS table_name,
    array_agg(pg_index.indexrelid::regclass::text) AS duplicate_indexes
FROM pg_index
GROUP BY pg_index.indrelid, pg_index.indkey
HAVING COUNT(*) > 1;

-- 查找被覆盖的索引
-- 如果 idx_a 是 (a, b)，idx_b 是 (a)，则 idx_b 是冗余的
-- 需要手动检查
```

## 4.12 性能优化清单

### 4.12.1 查询优化

- ✅ 使用 EXPLAIN ANALYZE 分析慢查询
- ✅ 确保 WHERE、JOIN、ORDER BY 列有索引
- ✅ 避免 SELECT *，只查询需要的列
- ✅ 使用部分索引减少索引大小
- ✅ 使用覆盖索引避免回表
- ✅ 避免在索引列上使用函数
- ✅ 使用 EXISTS 替代 NOT IN
- ✅ 批量操作使用 COPY 或批量 INSERT

### 4.12.2 索引优化

- ✅ 定期 ANALYZE 更新统计信息
- ✅ 删除未使用的索引
- ✅ 重建膨胀的索引
- ✅ 使用 CONCURRENTLY 避免锁表
- ✅ 对 JSONB 使用 GIN 索引
- ✅ 对时间序列使用 BRIN 索引
- ✅ 使用 INCLUDE 创建覆盖索引

### 4.12.3 配置优化

```ini
# postgresql.conf 关键参数

# 内存
shared_buffers = 4GB              # 物理内存的 25%
effective_cache_size = 12GB       # 物理内存的 75%
work_mem = 16MB                   # 排序/哈希操作内存
maintenance_work_mem = 512MB      # VACUUM/CREATE INDEX 内存

# 查询规划
random_page_cost = 1.1            # SSD 设为 1.1，HDD 设为 4.0
effective_io_concurrency = 200    # SSD 设为 200

# WAL
wal_buffers = 64MB
checkpoint_completion_target = 0.9

# 连接
max_connections = 200
```

---

## 本章小结

- PostgreSQL 提供 6 种索引类型：B-tree、Hash、GiST、SP-GiST、GIN、BRIN
- **B-tree** 是默认索引，适用于大多数场景
- **GIN** 索引用于数组、JSONB、全文搜索
- **BRIN** 索引极小，适合自然排序的大表
- 部分索引和表达式索引可以进一步优化特定查询
- 使用 EXPLAIN ANALYZE 分析查询计划
- 定期 ANALYZE 更新统计信息
- 监控未使用的索引并及时删除
- SSD 环境调整 random_page_cost = 1.1
