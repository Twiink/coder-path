---
title: "PostgreSQL高级特性"
aliases:
  - "PostgreSQL高级功能"
  - "PostgreSQL扩展"
tags:
  - "后端"
  - "数据库"
  - "postgresql"
  - "高级特性"
  - "笔记"
category: "后端"
folder: "PostgreSQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/PostgreSQL/PostgreSQL事务与并发控制]]"
  - "[[后端/数据库/PostgreSQL/PostgreSQL实战与最佳实践]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 06 PostgreSQL 高级特性

本章介绍 PostgreSQL 的高级特性，包括分区表、全文搜索、视图、触发器、存储过程、扩展等。

## 6.1 分区表（Partitioning）

### 6.1.1 为什么需要分区

```text
大表的问题：
  - 查询慢（需要扫描大量数据）
  - 维护困难（VACUUM、REINDEX 耗时长）
  - 备份恢复慢

分区的优势：
  - 查询优化：分区裁剪（Partition Pruning）只扫描相关分区
  - 维护便捷：可以单独 VACUUM、REINDEX 某个分区
  - 快速删除：DROP 分区比 DELETE 快得多
  - 并行处理：不同分区可以放在不同表空间
```

### 6.1.2 声明式分区（PostgreSQL 10+）

```sql
-- 创建分区主表
CREATE TABLE orders (
    order_id BIGSERIAL,
    user_id INTEGER NOT NULL,
    order_date DATE NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20)
) PARTITION BY RANGE (order_date);

-- 创建分区（按月分区）
CREATE TABLE orders_2026_01 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE orders_2026_02 PARTITION OF orders
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE orders_2026_03 PARTITION OF orders
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- 创建默认分区（存储不符合任何分区的数据）
CREATE TABLE orders_default PARTITION OF orders DEFAULT;

-- 插入数据（自动路由到正确的分区）
INSERT INTO orders (user_id, order_date, total, status)
VALUES (1, '2026-02-15', 99.99, 'completed');
-- 自动插入到 orders_2026_02

-- 查询（自动分区裁剪）
EXPLAIN SELECT * FROM orders
WHERE order_date >= '2026-02-01' AND order_date < '2026-03-01';
-- 只扫描 orders_2026_02
```

### 6.1.3 分区类型

**范围分区（Range）**：

```sql
-- 按日期范围
CREATE TABLE logs (
    id BIGSERIAL,
    log_date DATE NOT NULL,
    message TEXT
) PARTITION BY RANGE (log_date);

-- 按数值范围
CREATE TABLE sales (
    id BIGSERIAL,
    amount NUMERIC(10, 2) NOT NULL,
    sale_date DATE
) PARTITION BY RANGE (amount);

CREATE TABLE sales_small PARTITION OF sales
    FOR VALUES FROM (0) TO (1000);
CREATE TABLE sales_medium PARTITION OF sales
    FOR VALUES FROM (1000) TO (10000);
CREATE TABLE sales_large PARTITION OF sales
    FOR VALUES FROM (10000) TO (MAXVALUE);
```

**列表分区（List）**：

```sql
-- 按类别分区
CREATE TABLE products (
    id BIGSERIAL,
    name TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    price NUMERIC(10, 2)
) PARTITION BY LIST (category);

CREATE TABLE products_electronics PARTITION OF products
    FOR VALUES IN ('electronics', 'gadgets');

CREATE TABLE products_clothing PARTITION OF products
    FOR VALUES IN ('clothing', 'accessories');

CREATE TABLE products_books PARTITION OF products
    FOR VALUES IN ('books', 'magazines');
```

**哈希分区（Hash）**：

```sql
-- 按哈希值均匀分布
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY,
    user_id INTEGER NOT NULL,
    data JSONB,
    created_at TIMESTAMP
) PARTITION BY HASH (session_id);

-- 创建 4 个分区
CREATE TABLE sessions_p0 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE sessions_p1 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE sessions_p2 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE sessions_p3 PARTITION OF sessions
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

### 6.1.4 分区管理

```sql
-- 添加新分区
CREATE TABLE orders_2026_04 PARTITION OF orders
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- 分离分区（变成独立表）
ALTER TABLE orders DETACH PARTITION orders_2026_01;
-- orders_2026_01 现在是独立表，可以归档或删除

-- 删除分区（快速删除大量数据）
DROP TABLE orders_2026_01;  -- 比 DELETE 快得多

-- 附加已有表作为分区
CREATE TABLE orders_2026_05 (LIKE orders INCLUDING ALL);
-- 插入数据...
ALTER TABLE orders ATTACH PARTITION orders_2026_05
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- 查看分区信息
SELECT
    parent.relname AS parent_table,
    child.relname AS partition,
    pg_get_expr(child.relpartbound, child.oid) AS partition_bound
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'orders';
```

### 6.1.5 分区最佳实践

```sql
-- 1. 在分区键上创建索引
CREATE INDEX idx_orders_date ON orders(order_date);
-- 自动在每个分区上创建索引

-- 2. 为每个分区创建特定索引
CREATE INDEX idx_orders_2026_02_user ON orders_2026_02(user_id);

-- 3. 使用分区裁剪
SET enable_partition_pruning = on;  -- 默认开启

-- 4. 自动创建分区（使用 pg_partman 扩展）
CREATE EXTENSION pg_partman;

SELECT partman.create_parent(
    p_parent_table => 'public.orders',
    p_control => 'order_date',
    p_type => 'native',
    p_interval => '1 month',
    p_premake => 3  -- 提前创建 3 个分区
);

-- 自动维护分区
SELECT partman.run_maintenance();
```

## 6.2 全文搜索（Full Text Search）

### 6.2.1 基本概念

```sql
-- tsvector：文档的标准化表示
SELECT to_tsvector('english', 'The quick brown fox jumps over the lazy dog');
-- 'brown':3 'dog':9 'fox':4 'jump':5 'lazi':8 'quick':2

-- tsquery：搜索查询
SELECT to_tsquery('english', 'quick & brown');
-- 'quick' & 'brown'

-- 匹配操作
SELECT to_tsvector('english', 'The quick brown fox')
    @@ to_tsquery('english', 'quick & brown');
-- true
```

### 6.2.2 基本全文搜索

```sql
-- 简单搜索
SELECT title, content
FROM articles
WHERE to_tsvector('english', content) @@ to_tsquery('english', 'database');

-- 多词搜索（AND）
SELECT title
FROM articles
WHERE to_tsvector('english', content) @@ to_tsquery('english', 'postgresql & performance');

-- 多词搜索（OR）
SELECT title
FROM articles
WHERE to_tsvector('english', content) @@ to_tsquery('english', 'mysql | postgresql');

-- 短语搜索
SELECT title
FROM articles
WHERE to_tsvector('english', content) @@ phraseto_tsquery('english', 'full text search');

-- 网页搜索语法
SELECT title
FROM articles
WHERE to_tsvector('english', content) @@ websearch_to_tsquery('english', 'postgresql performance -mysql');
-- 搜索 postgresql 和 performance，排除 mysql
```

### 6.2.3 搜索结果排序

```sql
-- 使用 ts_rank 排序
SELECT title, ts_rank(to_tsvector('english', content), query) AS rank
FROM articles, to_tsquery('english', 'database') AS query
WHERE to_tsvector('english', content) @@ query
ORDER BY rank DESC
LIMIT 10;

-- 使用 ts_rank_cd（考虑词距离）
SELECT title, ts_rank_cd(to_tsvector('english', content), query) AS rank
FROM articles, to_tsquery('english', 'full & text & search') AS query
WHERE to_tsvector('english', content) @@ query
ORDER BY rank DESC;

-- 权重搜索（标题权重更高）
SELECT title,
    ts_rank(
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', content), 'B'),
        query
    ) AS rank
FROM articles, to_tsquery('english', 'database') AS query
WHERE (to_tsvector('english', title) || to_tsvector('english', content)) @@ query
ORDER BY rank DESC;
```

### 6.2.4 全文搜索索引

```sql
-- 创建 GIN 索引
CREATE INDEX idx_articles_content ON articles
USING GIN (to_tsvector('english', content));

-- 更好的方式：存储 tsvector 列
ALTER TABLE articles ADD COLUMN content_tsv tsvector;

UPDATE articles SET content_tsv = to_tsvector('english', content);

CREATE INDEX idx_articles_content_tsv ON articles USING GIN (content_tsv);

-- 使用触发器自动更新
CREATE OR REPLACE FUNCTION articles_content_tsv_trigger() RETURNS trigger AS $$
BEGIN
    NEW.content_tsv := to_tsvector('english', NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON articles FOR EACH ROW EXECUTE FUNCTION articles_content_tsv_trigger();
```

### 6.2.5 中文全文搜索

```sql
-- 使用 zhparser 扩展
CREATE EXTENSION zhparser;
CREATE TEXT SEARCH CONFIGURATION chinese (PARSER = zhparser);
ALTER TEXT SEARCH CONFIGURATION chinese ADD MAPPING FOR n,v,a,i,e,l WITH simple;

-- 中文搜索
SELECT to_tsvector('chinese', 'PostgreSQL是一个强大的数据库系统');
-- 'PostgreSQL':1 '强大':3 '数据库':5 '系统':6

SELECT to_tsvector('chinese', 'PostgreSQL是一个强大的数据库系统')
    @@ to_tsquery('chinese', '数据库 & 系统');
-- true
```

## 6.3 视图（Views）

### 6.3.1 普通视图

```sql
-- 创建视图
CREATE VIEW active_users AS
SELECT id, name, email, created_at
FROM users
WHERE is_active = true;

-- 使用视图
SELECT * FROM active_users WHERE created_at > '2026-01-01';

-- 创建带检查选项的视图（防止通过视图插入不符合条件的数据）
CREATE VIEW active_users_strict AS
SELECT id, name, email, is_active
FROM users
WHERE is_active = true
WITH CHECK OPTION;

-- 这会失败
INSERT INTO active_users_strict (name, email, is_active)
VALUES ('Test', 'test@example.com', false);
-- ERROR: new row violates check option for view "active_users_strict"
```

### 6.3.2 物化视图（Materialized Views）

```sql
-- 创建物化视图（存储查询结果）
CREATE MATERIALIZED VIEW user_stats AS
SELECT
    city,
    COUNT(*) AS user_count,
    AVG(age) AS avg_age
FROM users
GROUP BY city;

-- 查询物化视图（快速）
SELECT * FROM user_stats WHERE city = '北京';

-- 刷新物化视图
REFRESH MATERIALIZED VIEW user_stats;

-- 并发刷新（不锁表，需要唯一索引）
CREATE UNIQUE INDEX idx_user_stats_city ON user_stats(city);
REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats;

-- 删除物化视图
DROP MATERIALIZED VIEW user_stats;
```

**物化视图 vs 普通视图**：

| 特性 | 普通视图 | 物化视图 |
|------|---------|---------|
| 存储 | 不存储（每次查询执行） | 存储结果 |
| 查询速度 | 慢（每次执行查询） | 快（直接读取） |
| 数据新鲜度 | 实时 | 需要手动刷新 |
| 占用空间 | 无 | 占用磁盘空间 |
| 适用场景 | 简单封装、权限控制 | 复杂查询、报表 |

### 6.3.3 可更新视图

```sql
-- 创建可更新视图
CREATE VIEW user_basic_info AS
SELECT id, name, email, phone
FROM users;

-- 通过视图更新（直接更新基表）
UPDATE user_basic_info SET phone = '13800138000' WHERE id = 1;

-- 使用 INSTEAD OF 触发器实现复杂视图的更新
CREATE VIEW user_order_summary AS
SELECT u.id, u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name;

-- 创建 INSTEAD OF 触发器
CREATE OR REPLACE FUNCTION user_order_summary_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET name = NEW.name WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_order_summary_update_trigger
INSTEAD OF UPDATE ON user_order_summary
FOR EACH ROW EXECUTE FUNCTION user_order_summary_update();
```

## 6.4 触发器（Triggers）

### 6.4.1 基本触发器

```sql
-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_modified_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_users_modified_time
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_modified_time();

-- 测试
UPDATE users SET name = 'Alice' WHERE id = 1;
-- updated_at 自动更新
```

### 6.4.2 触发器时机

```sql
-- BEFORE 触发器（在操作前执行）
CREATE TRIGGER validate_user_age
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION validate_age();

-- AFTER 触发器（在操作后执行）
CREATE TRIGGER log_user_changes
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION log_changes();

-- INSTEAD OF 触发器（替代操作，用于视图）
CREATE TRIGGER instead_of_insert
INSTEAD OF INSERT ON user_view
FOR EACH ROW
EXECUTE FUNCTION handle_view_insert();
```

### 6.4.3 审计日志触发器

```sql
-- 创建审计日志表
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建通用审计触发器函数
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, old_data, user_id)
        VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(OLD), current_setting('app.current_user_id')::INTEGER);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, old_data, new_data, user_id)
        VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(OLD), to_jsonb(NEW), current_setting('app.current_user_id')::INTEGER);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, new_data, user_id)
        VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(NEW), current_setting('app.current_user_id')::INTEGER);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 为表创建审计触发器
CREATE TRIGGER audit_users
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

## 6.5 存储过程与函数

### 6.5.1 函数（Function）

```sql
-- 创建简单函数
CREATE OR REPLACE FUNCTION calculate_discount(price NUMERIC, discount_rate NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    RETURN price * (1 - discount_rate);
END;
$$ LANGUAGE plpgsql;

-- 调用函数
SELECT calculate_discount(100, 0.2);  -- 返回 80

-- 返回表
CREATE OR REPLACE FUNCTION get_active_users_by_city(city_name TEXT)
RETURNS TABLE(id INTEGER, name TEXT, email TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.name, u.email
    FROM users u
    WHERE u.city = city_name AND u.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 调用
SELECT * FROM get_active_users_by_city('北京');
```

### 6.5.2 存储过程（Procedure，PostgreSQL 11+）

```sql
-- 创建存储过程
CREATE OR REPLACE PROCEDURE transfer_money(
    from_account INTEGER,
    to_account INTEGER,
    amount NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- 扣款
    UPDATE accounts SET balance = balance - amount
    WHERE account_id = from_account AND balance >= amount;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient balance or account not found';
    END IF;

    -- 入账
    UPDATE accounts SET balance = balance + amount
    WHERE account_id = to_account;

    -- 记录日志
    INSERT INTO transfer_log (from_account, to_account, amount, transfer_time)
    VALUES (from_account, to_account, amount, NOW());

    COMMIT;
END;
$$;

-- 调用存储过程
CALL transfer_money(1, 2, 100.00);
```

**函数 vs 存储过程**：

| 特性 | 函数 | 存储过程 |
|------|------|---------|
| 返回值 | 必须返回一个值 | 无返回值 |
| 调用方式 | SELECT function() | CALL procedure() |
| 事务控制 | 不能控制事务 | 可以 COMMIT/ROLLBACK |
| 使用场景 | 计算、转换、查询 | 复杂业务逻辑、事务操作 |

### 6.5.3 PL/pgSQL 编程

```sql
-- 变量声明
CREATE OR REPLACE FUNCTION process_order(order_id INTEGER)
RETURNS VOID AS $$
DECLARE
    order_total NUMERIC;
    user_id INTEGER;
    discount NUMERIC := 0.1;
BEGIN
    -- 查询订单
    SELECT o.total, o.user_id INTO order_total, user_id
    FROM orders o WHERE o.id = order_id;

    -- 条件判断
    IF order_total > 1000 THEN
        discount := 0.2;
    ELSIF order_total > 500 THEN
        discount := 0.15;
    END IF;

    -- 循环
    FOR i IN 1..5 LOOP
        RAISE NOTICE 'Processing step %', i;
    END LOOP;

    -- 异常处理
    BEGIN
        UPDATE users SET total_spent = total_spent + order_total
        WHERE id = user_id;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to update user %: %', user_id, SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;
```

## 6.6 扩展（Extensions）

### 6.6.1 常用扩展

```sql
-- 查看已安装的扩展
SELECT * FROM pg_extension;

-- 查看可用扩展
SELECT * FROM pg_available_extensions;

-- 安装扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- UUID 生成
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- 加密函数
CREATE EXTENSION IF NOT EXISTS "hstore";     -- 键值对存储
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- 三元组（模糊匹配）
CREATE EXTENSION IF NOT EXISTS "postgis";    -- 地理空间数据
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";  -- 查询统计

-- 删除扩展
DROP EXTENSION "uuid-ossp";
```

### 6.6.2 pgcrypto（加密）

```sql
CREATE EXTENSION pgcrypto;

-- 生成随机字节
SELECT gen_random_bytes(16);

-- 生成 UUID
SELECT gen_random_uuid();

-- 哈希密码
SELECT crypt('password123', gen_salt('bf'));
-- $2a$06$...（bcrypt 哈希）

-- 验证密码
SELECT (crypt('password123', stored_hash) = stored_hash) AS is_valid;

-- 加密数据
SELECT pgp_sym_encrypt('secret data', 'encryption_key');

-- 解密数据
SELECT pgp_sym_decrypt(encrypted_data, 'encryption_key');
```

### 6.6.3 pg_trgm（模糊匹配）

```sql
CREATE EXTENSION pg_trgm;

-- 计算相似度
SELECT similarity('PostgreSQL', 'Postgres');  -- 0.8

-- 模糊搜索
SELECT name FROM users
WHERE name % 'Jonh';  -- 相似度 > 0.3（默认阈值）

-- 设置阈值
SET pg_trgm.similarity_threshold = 0.5;

-- 创建索引加速模糊搜索
CREATE INDEX idx_users_name_trgm ON users USING GIN (name gin_trgm_ops);

-- 快速模糊搜索
SELECT name FROM users WHERE name ILIKE '%jonh%';  -- 使用索引
```

### 6.6.4 PostGIS（地理空间）

```sql
CREATE EXTENSION postgis;

-- 创建空间表
CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    name TEXT,
    location GEOGRAPHY(POINT, 4326)  -- WGS 84 坐标系
);

-- 插入点数据
INSERT INTO shops (name, location) VALUES
('Shop A', ST_MakePoint(116.397128, 39.916527)::geography),  -- 北京
('Shop B', ST_MakePoint(121.473701, 31.230416)::geography);  -- 上海

-- 查找附近的商店（1km 内）
SELECT name, ST_Distance(location, ST_MakePoint(116.4, 39.9)::geography) AS distance
FROM shops
WHERE ST_DWithin(location, ST_MakePoint(116.4, 39.9)::geography, 1000)
ORDER BY distance;

-- 创建空间索引
CREATE INDEX idx_shops_location ON shops USING GIST (location);
```

## 6.7 通知与监听（LISTEN/NOTIFY）

```sql
-- 会话 A：监听通道
LISTEN order_updates;

-- 会话 B：发送通知
NOTIFY order_updates, 'Order 123 completed';

-- 会话 A 收到通知
-- Asynchronous notification "order_updates" with payload "Order 123 completed"

-- 在触发器中发送通知
CREATE OR REPLACE FUNCTION notify_order_update()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('order_updates', json_build_object(
        'operation', TG_OP,
        'order_id', NEW.id,
        'status', NEW.status
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_update_trigger
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION notify_order_update();
```

**应用场景**：
- 实时通知（订单状态变化、新消息）
- 缓存失效
- 微服务间通信

## 6.8 外部数据包装器（FDW）

```sql
-- 安装 postgres_fdw
CREATE EXTENSION postgres_fdw;

-- 创建外部服务器
CREATE SERVER remote_db
FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (host 'remote.host.com', port '5432', dbname 'remote_db');

-- 创建用户映射
CREATE USER MAPPING FOR local_user
SERVER remote_db
OPTIONS (user 'remote_user', password 'password');

-- 创建外部表
CREATE FOREIGN TABLE remote_users (
    id INTEGER,
    name TEXT,
    email TEXT
)
SERVER remote_db
OPTIONS (table_name 'users');

-- 查询外部表（像本地表一样）
SELECT * FROM remote_users WHERE city = '北京';

-- 其他 FDW：mysql_fdw、redis_fdw、file_fdw 等
```

---

## 本章小结

- 分区表可以显著提升大表的查询和维护性能
- 全文搜索支持复杂的文本搜索，GIN 索引加速查询
- 物化视图存储查询结果，适合复杂报表
- 触发器可以自动执行审计、验证等逻辑
- PL/pgSQL 支持完整的编程能力
- 扩展系统提供丰富的功能（加密、地理空间、模糊匹配等）
- LISTEN/NOTIFY 实现实时通知
- FDW 可以查询外部数据源
