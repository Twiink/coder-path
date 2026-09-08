---
title: "索引与执行计划"
aliases:
  - "MySQL索引"
  - "MySQL EXPLAIN"
  - "B+树"
tags:
  - "后端"
  - "数据库"
  - "mysql"
  - "索引"
  - "性能优化"
  - "笔记"
category: "后端"
folder: "MySQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MySQL/SQL基础]]"
  - "[[后端/数据库/MySQL/事务与锁机制]]"
  - "[[后端/数据库/MySQL/慢查询与性能优化]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 05 索引与执行计划

索引是 MySQL 性能优化的核心,也是面试必考区。本章覆盖:B+ 树原理、聚簇与二级索引、索引分类、最左前缀、索引失效场景、覆盖索引与索引下推、EXPLAIN 逐字段解读、索引设计方法论。

## 5.1 为什么用 B+ 树

数据库索引要解决的核心问题:**在磁盘上,用最少的 IO 次数找到数据**。

| 数据结构 | 查找复杂度 | 作为磁盘索引的问题 |
| --- | --- | --- |
| 数组/有序数组 | 二分 O(log n) | 插入删除要移动大量元素 |
| 链表 | O(n) | 无法二分 |
| 哈希表 | O(1) | **不支持范围查询与排序**,只适合等值 |
| 二叉搜索树 | O(log n) | 可能退化成链表;树太高 IO 太多 |
| 红黑树/AVL | O(log n) | 二叉树高度 = log₂N,**2000 万数据高约 25 层 → 最多 25 次磁盘 IO** |
| **B 树** | O(log n) | 多叉,树矮;但**非叶子节点也存数据**,单节点能放的索引项少 |
| **B+ 树** | O(log n) | 多叉 + **非叶子只存索引不存数据** + **叶子用双向链表相连** |

### B+ 树的结构

```text
                    [ 10 | 30 ]                    ← 非叶子:只存键与指针
                   /     |     \
     [3|6|9]     [12|18|25]     [35|50|70]          ← 非叶子
      / | | \      / | | \        / | | | \
   ┌────┬────┬────┬────┬────┬────┬────┬────┐
   │数据│数据│数据│数据│数据│数据│数据│数据│        ← 叶子节点:存完整行数据
   └──↔──┴──↔──┴──↔──┴──↔──┴──↔──┴──↔──┴──↔──┘      ← 叶子之间双向链表相连
```

**B+ 树相对 B 树的三个优势:**

1. **非叶子节点不存数据,只存键 + 指针** → 单个节点(16KB 页)能容纳更多索引项 → 树更矮更胖
2. **所有数据都在叶子层** → 任何查询的 IO 次数都相同(等于树高),性能稳定
3. **叶子节点用双向链表连接** → 范围查询(`BETWEEN`、`>`、`ORDER BY`)只需找到起点,然后**顺着链表扫**,不用回到根节点

**为什么树高约 3 层就够:**

```text
假设:页大小 16KB,主键 BIGINT(8B),指针 6B → 每个非叶子节点约存 16KB / 14B ≈ 1170 个键
一层非叶子:1170 个子节点
两层非叶子:1170 × 1170 ≈ 137 万
叶子层:假设每行 1KB → 每页存 16 行
三层总共:1170 × 1170 × 16 ≈ 2190 万行
```

> **结论:2000 万行数据的 B+ 树高度只有 3 层,任何查询最多 3 次磁盘 IO**(而根节点和二层通常常驻缓冲池,实际常常只有 1 次甚至 0 次物理 IO)。这就是 MySQL 快的根本原因,也是"单表建议不超过 2000 万行"这一说法的来源 —— 超过后树变 4 层,IO 增加。

## 5.2 聚簇索引与二级索引

InnoDB 的表本身就是**按主键组织的一棵 B+ 树**,这就是"索引组织表(Index Organized Table)"。

### 聚簇索引(Clustered Index)

- **叶子节点存的是完整行数据**
- 一张表**只能有一个**聚簇索引(数据只能有一种物理排列方式)
- InnoDB 的选择顺序:① 显式主键 → ② 第一个所有列都 NOT NULL 的唯一索引 → ③ 自动生成的隐藏 6 字节 `ROW_ID`

```text
主键索引(聚簇索引)
        [ 10 | 50 ]
        /    |    \
   [1|5]  [20|30]  [60|80]
    ↓      ↓        ↓
  叶子节点存:整行数据 (id, name, age, email, ...)
```

### 二级索引(Secondary Index / 辅助索引)

- **叶子节点存的是"索引列的值 + 主键值"**,不是完整行
- 一张表可以有多个

```text
name 上的二级索引
        [ Bob | Tom ]
        /     |     \
     ...    ...    ...
    ↓
  叶子节点存:(name, id)      ← 只有索引列 + 主键!

查询 WHERE name = 'Tom' 的过程:
  1. 在 name 索引树上找到 'Tom' → 得到 id = 50
  2. 拿 id = 50 回到聚簇索引树再查一次 → 得到完整行
  这第 2 步就叫【回表】
```

### 回表与覆盖索引(核心概念)

```sql
-- 表 user(id PK, name, age, email),有索引 idx_name(name)

-- ❌ 需要回表:idx_name 里没有 age
SELECT id, name, age FROM user WHERE name = 'Tom';
-- 过程:idx_name 找到 id → 回聚簇索引取 age

-- ✅ 覆盖索引:查询的列全在索引里,不需要回表
SELECT id, name FROM user WHERE name = 'Tom';
-- idx_name 的叶子节点就是 (name, id),直接返回!EXPLAIN 的 Extra 显示 "Using index"

-- ✅ 建联合索引让常见查询被覆盖
ALTER TABLE user ADD INDEX idx_name_age (name, age);
SELECT id, name, age FROM user WHERE name = 'Tom';   -- Using index,零回表
```

> **这就是"禁止 SELECT *"的技术原因:** `SELECT *` 必然包含索引里没有的列,强制回表,IO 翻倍。而指定列有机会命中覆盖索引。

## 5.3 索引的分类

| 维度 | 类型 | 说明 |
| --- | --- | --- |
| 按物理存储 | **聚簇索引** | 叶子存整行,InnoDB 主键 |
| | **二级索引** | 叶子存主键值,需回表 |
| 按字段特性 | **主键索引** PRIMARY KEY | 唯一 + 非空,一表一个 |
| | **唯一索引** UNIQUE | 值唯一,允许 NULL(可多个 NULL) |
| | **普通索引** INDEX / KEY | 最基本,无约束 |
| | **联合索引** | 多列组成,遵循最左前缀 |
| | **全文索引** FULLTEXT | 分词检索(5.6+ InnoDB 支持) |
| | **空间索引** SPATIAL | 地理数据,需 GEOMETRY 且 NOT NULL |
| | **前缀索引** | 长字符串取前 n 个字符建索引 |
| 按功能(8.0) | **隐藏索引** INVISIBLE | 优化器不使用,用于安全评估删索引的影响 |
| | **降序索引** | 8.0 才真正支持,之前是解析但按升序存 |
| | **函数索引/表达式索引** | `INDEX ((UPPER(name)))`,8.0.13+ |
| | **多值索引** | JSON 数组,8.0.17+ |
| 引擎内部 | **自适应哈希索引 AHI** | InnoDB 自动为热点索引页建哈希,加速等值查询,不可手动创建 |

### 索引的创建与删除

```sql
-- 方式一:建表时
CREATE TABLE user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50),
    email VARCHAR(100),
    phone VARCHAR(20),
    age TINYINT,
    city VARCHAR(50),
    bio TEXT,
    UNIQUE KEY uk_username (username),
    KEY idx_email (email),
    KEY idx_city_age (city, age),                  -- 联合索引
    KEY idx_phone_prefix (phone(8)),               -- 前缀索引
    FULLTEXT KEY ft_bio (bio)                       -- 全文索引
) ENGINE=InnoDB;

-- 方式二:CREATE INDEX(不能建主键)
CREATE INDEX idx_age ON user(age);
CREATE UNIQUE INDEX uk_email ON user(email);
CREATE INDEX idx_city_age ON user(city, age DESC);          -- 8.0 降序索引
CREATE INDEX idx_upper_name ON user((UPPER(username)));     -- 8.0.13+ 函数索引
CREATE FULLTEXT INDEX ft_bio ON user(bio) WITH PARSER ngram; -- 中文分词

-- 方式三:ALTER TABLE
ALTER TABLE user ADD INDEX idx_age (age);
ALTER TABLE user ADD PRIMARY KEY (id);
ALTER TABLE user ADD UNIQUE (email);

-- 在线加索引(不锁表)
ALTER TABLE user ADD INDEX idx_age (age), ALGORITHM=INPLACE, LOCK=NONE;

-- 删除
DROP INDEX idx_age ON user;
ALTER TABLE user DROP INDEX idx_age;
ALTER TABLE user DROP PRIMARY KEY;                 -- 慎!InnoDB 会重建表

-- 隐藏索引:先"软删除"观察影响,确认无问题再真删(8.0)
ALTER TABLE user ALTER INDEX idx_age INVISIBLE;    -- 优化器不再使用
ALTER TABLE user ALTER INDEX idx_age VISIBLE;      -- 恢复
ALTER TABLE user DROP INDEX idx_age;               -- 确认无影响后删除
```

### 前缀索引

```sql
-- 长字符串(如 URL、email)全列建索引很占空间,可只索引前 n 个字符
ALTER TABLE article ADD INDEX idx_url (url(20));

-- TEXT/BLOB 只能用前缀索引
ALTER TABLE article ADD INDEX idx_content (content(50));

-- 如何选择 n?看区分度:前 n 字符的不同值占比越接近 1 越好
SELECT
    COUNT(DISTINCT LEFT(email, 6))  / COUNT(*) AS sel_6,
    COUNT(DISTINCT LEFT(email, 8))  / COUNT(*) AS sel_8,
    COUNT(DISTINCT LEFT(email, 12)) / COUNT(*) AS sel_12,
    COUNT(DISTINCT email)           / COUNT(*) AS sel_full
FROM user;
-- 选一个 sel 接近 sel_full 的最小 n
```

| 前缀索引优点 | 前缀索引缺点 |
| --- | --- |
| 索引体积小,IO 少 | **无法用于覆盖索引**(必然回表取完整值验证) |
| 长字段也能建索引 | **无法用于 ORDER BY / GROUP BY**(值不完整,无法排序) |
| 区分度足够时效率高 | n 选小了会导致大量回表过滤 |

## 5.4 联合索引与最左前缀原则(最重要)

联合索引 `idx_a_b_c (a, b, c)` 的排序规则:**先按 a 排序;a 相同再按 b 排序;b 也相同再按 c 排序**。

```text
(a, b, c) 联合索引的叶子节点顺序:
(1,1,1) (1,1,5) (1,2,3) (1,3,1) (2,1,1) (2,1,9) (3,1,1) ...
 └── a 全局有序 ──┘
       └─ a 相同时 b 有序 ─┘
             └ b,c 都相同时 c 有序 ┘
 所以:b 单独看是无序的,c 单独看也是无序的
```

### 能用到索引的情况

```sql
-- 索引:idx_a_b_c (a, b, c)

WHERE a = 1                          -- ✅ 用 a
WHERE a = 1 AND b = 2                -- ✅ 用 a,b
WHERE a = 1 AND b = 2 AND c = 3      -- ✅ 用 a,b,c(全用上)
WHERE a = 1 AND c = 3                -- ⚠️ 只用 a,c 在 a=1 范围内过滤(8.0 有索引跳跃扫描可改善)
WHERE a > 1 AND b = 2                -- ⚠️ a 用范围,b 用不上(范围后失效)
WHERE a = 1 AND b > 2 AND c = 3      -- ⚠️ a 等值 + b 范围,c 用不上
WHERE b = 2                          -- ❌ 跳过 a,用不上
WHERE c = 3                          -- ❌ 用不上
WHERE b = 2 AND c = 3                -- ❌ 用不上
```

> **注意 WHERE 里的书写顺序无关**,优化器会自动调整:`WHERE b = 2 AND a = 1` 与 `WHERE a = 1 AND b = 2` 效果一样。**关键是条件里有没有最左列 a**,不是条件写的先后。

### 范围查询后的列失效

```sql
-- 索引 idx_create_status (created_at, status)
WHERE created_at > '2026-01-01' AND status = 1
-- created_at 用范围扫描,status 只能在这批数据上过滤(无法用于索引定位)

-- 索引 idx_status_create (status, created_at)  ← 更好!
WHERE status = 1 AND created_at > '2026-01-01'
-- status 等值定位 + created_at 范围扫描,两列都用上

-- 原则:等值条件的列放左边,范围条件的列放右边
```

### 索引下推(ICP,Index Condition Pushdown,5.6+)

```sql
-- 索引 idx_name_age (name, age)
SELECT * FROM user WHERE name LIKE '张%' AND age = 20;

-- 没有 ICP(5.5 及以前):
--   1. 用索引找出所有 name LIKE '张%' 的主键
--   2. 全部回表取整行
--   3. 在服务器层用 age = 20 过滤       ← 大量无效回表

-- 有 ICP(5.6+):
--   1. 用索引找出 name LIKE '张%' 的记录
--   2. 在【索引层】就用 age = 20 过滤(因为 age 就在索引里!)
--   3. 只对通过的记录回表               ← 回表次数大幅减少
-- EXPLAIN 的 Extra 显示 "Using index condition"
```

## 5.5 索引失效的场景(必背)

```sql
-- 假设 user(id PK, name VARCHAR, age INT, phone VARCHAR, created_at DATETIME)
-- 索引:idx_name(name)、idx_age(age)、idx_created(created_at)

-- ① 违反最左前缀
SELECT * FROM t WHERE b = 1;                    -- 联合索引 (a,b) 缺 a

-- ② 对索引列做函数或运算
SELECT * FROM user WHERE UPPER(name) = 'TOM';   -- ❌
SELECT * FROM user WHERE age + 1 = 20;          -- ❌
SELECT * FROM user WHERE DATE(created_at) = '2026-09-06';  -- ❌
SELECT * FROM user WHERE name = 'TOM';          -- ✅(8.0 可建函数索引 UPPER(name))

-- ③ 隐式类型转换(VARCHAR 列用数字比较)
SELECT * FROM user WHERE phone = 13800138000;   -- ❌ 等价于 CAST(phone AS DOUBLE)
SELECT * FROM user WHERE phone = '13800138000'; -- ✅

-- ④ 隐式字符集/排序规则转换(两表 JOIN 时列字符集不同)
SELECT * FROM a JOIN b ON a.name = b.name;      -- ❌ 若 a 是 utf8mb4、b 是 utf8

-- ⑤ 前置模糊匹配
SELECT * FROM user WHERE name LIKE '%tom';      -- ❌
SELECT * FROM user WHERE name LIKE '%tom%';     -- ❌
SELECT * FROM user WHERE name LIKE 'tom%';      -- ✅ 可用索引
-- 需要全文搜索时用 FULLTEXT 索引或 Elasticsearch

-- ⑥ OR 两侧有一侧没索引
SELECT * FROM user WHERE name = 'a' OR age = 1; -- ⚠️ 若 age 无索引 → 全表扫描
-- 两侧都有索引时可能用 index_merge(Extra: Using union(idx_name,idx_age))

-- ⑦ NOT IN / != / <> / NOT LIKE(多数情况)
SELECT * FROM user WHERE age != 20;             -- ⚠️ 通常全表扫(除非 != 的值占比极小)
SELECT * FROM user WHERE id NOT IN (1,2,3);     -- ⚠️

-- ⑧ IS NULL / IS NOT NULL(取决于数据分布)
SELECT * FROM user WHERE name IS NOT NULL;      -- ⚠️ 若非 NULL 占绝大多数,优化器放弃索引

-- ⑨ 优化器认为全表扫更快(数据量小 or 命中比例高)
SELECT * FROM user WHERE age > 0;               -- 命中 99% 的行,走索引反而慢(要大量回表)

-- ⑩ ORDER BY 与索引方向不一致(8.0 前无降序索引)
-- 索引 idx_a_b(a,b),SELECT ... ORDER BY a ASC, b DESC   -- ❌ 无法用索引排序 → filesort
```

### 强制与忽略索引(调试用)

```sql
-- 强制使用某索引(优化器判断失误时)
SELECT * FROM user FORCE INDEX (idx_name) WHERE name = 'tom';

-- 建议使用
SELECT * FROM user USE INDEX (idx_name) WHERE name LIKE 'tom%';

-- 忽略某索引
SELECT * FROM user IGNORE INDEX (idx_age) WHERE age > 20;

-- 8.0 优化器提示(更现代)
SELECT /*+ INDEX(user idx_name) */ * FROM user WHERE name = 'tom';
SELECT /*+ NO_INDEX(user idx_age) */ * FROM user WHERE age > 20;
```

> **FORCE INDEX 是双刃剑:** 数据分布变化后强制的索引可能变成最差选择,且让代码与库结构强耦合。先分析为什么优化器选错(通常是统计信息过期 → `ANALYZE TABLE user;`),实在不行再用。

## 5.6 EXPLAIN 执行计划详解

```sql
EXPLAIN SELECT * FROM user WHERE age > 20;
EXPLAIN FORMAT=JSON SELECT ...;        -- 更详细,含成本估算
EXPLAIN ANALYZE SELECT ...;            -- 8.0.18+:真实执行 + 各步实际耗时与行数
EXPLAIN FORMAT=TREE SELECT ...;        -- 8.0:树形展示,能看到 Hash Join / 索引选择细节
```

### 12 个字段总览

```text
+----+-------------+-------+------------+------+---------------+------+---------+------+--------+----------+-------------+
| id | select_type | table | partitions | type | possible_keys | key  | key_len | ref  | rows   | filtered | Extra       |
+----+-------------+-------+------------+------+---------------+------+---------+------+--------+----------+-------------+
```

### id:执行顺序

| 规则 | 说明 |
| --- | --- |
| id 相同 | 从上到下顺序执行 |
| id 不同 | **id 越大越先执行**(它是子查询的层级,深的先执行) |
| id 为 NULL | `<unionM,N>` 表示由 id 为 M、N 的查询 union 产生的结果集 |

### select_type:查询类型

| 值 | 含义 |
| --- | --- |
| `SIMPLE` | 简单查询,不含子查询或 UNION |
| `PRIMARY` | 复杂查询的**最外层** |
| `SUBQUERY` | SELECT 列表或 WHERE 中的子查询(非关联) |
| `DEPENDENT SUBQUERY` | **关联子查询**,依赖外层结果,每行都可能执行一次(性能杀手) |
| `DERIVED` | FROM 子句中的子查询(派生表),会被物化 |
| `MATERIALIZED` | 物化的子查询(优化后,通常比 DEPENDENT SUBQUERY 好) |
| `UNION` | UNION 中第二个及之后的查询 |
| `UNION RESULT` | UNION 的结果集(需要临时表去重) |

### type:访问类型(性能核心指标)

**从好到差排列:**

| type | 含义 | 说明 |
| --- | --- | --- |
| `system` | 表只有一行 | 系统表的特例,几乎见不到 |
| **`const`** | 通过主键或唯一索引等值查询,**最多一行** | 极快,值可作为常量参与后续优化 |
| **`eq_ref`** | JOIN 时被驱动表用主键/唯一索引匹配,每次只一行 | JOIN 的最优情况 |
| **`ref`** | 非唯一索引等值查询,返回多行 | 常见且良好 |
| `ref_or_null` | ref + 额外查 NULL 值 | — |
| `fulltext` | 使用全文索引 | — |
| `index_merge` | 使用了索引合并优化 | 两个索引结果取交集/并集,说明该建联合索引 |
| `unique_subquery` / `index_subquery` | IN 子查询用了唯一/普通索引 | — |
| **`range`** | 索引范围扫描 | `BETWEEN`、`>`、`<`、`IN`、`LIKE 'x%'` |
| **`index`** | **全索引扫描**,遍历整棵索引树 | 比 all 好(索引树小),但仍是扫描全部 |
| **`ALL`** | **全表扫描** | 最差,必须优化 |

> **优化目标:** 至少达到 `range` 级别,核心查询力争 `ref` 或 `const`。**看到 `ALL` 且 rows 很大就必须加索引或改写 SQL。**

### possible_keys / key / key_len

```sql
possible_keys: idx_name, idx_age    -- 可能用到的索引
key: idx_age                        -- 实际选用的索引(NULL = 没用索引)
key_len: 5                          -- 实际使用的索引字节长度
```

**key_len 的计算(判断联合索引用了几列的关键):**

| 类型 | key_len |
| --- | --- |
| `TINYINT` | 1 |
| `SMALLINT` | 2 |
| `INT` | 4 |
| `BIGINT` | 8 |
| `CHAR(n)` utf8mb4 | 4n |
| `VARCHAR(n)` utf8mb4 | 4n + 2(长度前缀) |
| `DATE` | 3 |
| `DATETIME` | 5(8.0)/ 8(5.6 前) |
| `TIMESTAMP` | 4 |
| **列允许 NULL** | **+1**(NULL 标记位) |

```sql
-- 索引 idx_city_age (city VARCHAR(50) NOT NULL, age INT NULL),utf8mb4
-- city 的 key_len = 50 × 4 + 2 = 202
-- age  的 key_len = 4 + 1(可空) = 5

EXPLAIN SELECT * FROM user WHERE city = '北京';
-- key_len: 202   → 只用了 city 一列

EXPLAIN SELECT * FROM user WHERE city = '北京' AND age = 20;
-- key_len: 207   → 两列都用上了(202 + 5)

EXPLAIN SELECT * FROM user WHERE age = 20;
-- key: NULL      → 违反最左前缀,没用索引
```

> **key_len 是判断"联合索引到底用了几列"的最可靠依据**,比 Extra 更精确。

### ref

```text
ref: const              -- 索引与常量比较(WHERE city = '北京')
ref: mydb.user.id       -- 索引与另一表的列比较(JOIN ON)
ref: func               -- 与函数结果比较
```

### rows 与 filtered

| 字段 | 含义 |
| --- | --- |
| `rows` | **预估**需要扫描的行数(不是实际返回行数),基于统计信息,可能不准 |
| `filtered` | 预估经过 WHERE 过滤后**剩余行数的百分比** |

```text
rows: 10000, filtered: 10.00
→ 扫描 1 万行,预计过滤后剩 1000 行(10%)
→ rows × filtered = 最终参与下一步的行数
```

> `filtered` 很低说明扫描了大量无用行,索引选择性差;`rows` 很大 + `filtered` 很低 = 必须优化。
> 统计信息可能过期,用 `ANALYZE TABLE 表名;` 重新采样。

### Extra:额外信息(优化线索都在这里)

| Extra | 含义 | 好坏 |
| --- | --- | --- |
| **`Using index`** | **覆盖索引**,不需要回表 | 🟢 最好 |
| **`Using where`** | 在服务器层用 WHERE 过滤(存储引擎返回的数据还要再筛) | 🟡 中性,常与回表同时出现 |
| **`Using index condition`** | **索引下推 ICP**,在索引层先过滤再回表 | 🟢 好 |
| `Using MRR` | Multi-Range Read,把随机回表变顺序 IO | 🟢 好 |
| **`Using temporary`** | 需要**临时表**(常见于 GROUP BY、DISTINCT、UNION) | 🔴 差,要优化 |
| **`Using filesort`** | 需要**额外排序**(不是从索引直接取有序数据) | 🔴 差,要优化 |
| `Using join buffer (Block Nested Loop)` | JOIN 无索引,用了连接缓冲 | 🔴 很差,给被驱动表加索引 |
| `Using join buffer (hash join)` | 8.0 的 Hash Join | 🟡 比 BNL 好很多,但仍建议加索引 |
| `Distinct` | 找到第一个匹配后就停止 | 🟢 |
| `Not exists` | 用 NOT EXISTS 优化 | 🟢 |
| `Select tables optimized away` | 直接从索引取聚合结果(如 `MIN(id)`),不访问表 | 🟢 极好 |
| `Impossible WHERE` | WHERE 恒为假,不执行 | — |
| `No tables used` | 没有 FROM 表 | — |
| `Range checked for each record` | 没有好索引,每行都重新判断 | 🔴 很差 |

**消除 `Using filesort` 的方法:**

```sql
-- 索引 idx_age(age)
SELECT * FROM user WHERE age > 20 ORDER BY name;
-- Extra: Using filesort  ← age 索引里的 name 是无序的

-- 建联合索引 idx_age_name(age, name)
SELECT * FROM user WHERE age > 20 ORDER BY name;
-- ⚠️ 仍可能 filesort:age 是范围,name 在每个 age 值内才有序

-- 建联合索引 idx_age_name(age, name),等值 + 排序
SELECT * FROM user WHERE age = 20 ORDER BY name;
-- ✅ Extra: Using index condition(无 filesort)

-- 规律:WHERE 的等值列 + ORDER BY 的列 组成联合索引,顺序为「等值列在前,排序列在后」
```

**消除 `Using temporary` 的方法:**

```sql
-- GROUP BY 的列建索引,让分组直接利用索引有序性
ALTER TABLE `order` ADD INDEX idx_user (user_id);
SELECT user_id, COUNT(*) FROM `order` GROUP BY user_id;
-- 有索引:Extra 无 Using temporary;无索引:Using temporary; Using filesort

-- GROUP BY 与 ORDER BY 用同一组索引列
SELECT user_id, COUNT(*) FROM `order` GROUP BY user_id ORDER BY user_id;   -- 可复用索引
SELECT user_id, COUNT(*) FROM `order` GROUP BY user_id ORDER BY amount;    -- 需要 filesort
```

### EXPLAIN ANALYZE(8.0.18+,最有用的调优工具)

```sql
EXPLAIN ANALYZE
SELECT u.username, COUNT(o.id)
FROM user u LEFT JOIN `order` o ON o.user_id = u.id
WHERE u.status = 1
GROUP BY u.username;
```

```text
-> Group aggregate: count(o.id)  (cost=125.6 rows=10) (actual time=0.5..2.3 rows=8 loops=1)
    -> Nested loop left join  (cost=120.1 rows=10) (actual time=0.3..2.0 rows=10 loops=1)
        -> Filter: (u.status = 1)  (cost=1.1 rows=5) (actual time=0.1..0.4 rows=5 loops=1)
            -> Table scan on u  (cost=1.1 rows=5) (actual time=0.1..0.3 rows=5 loops=1)
        -> Index lookup on o using idx_user (user_id=u.id)  (cost=2.2 rows=2)
                                                    (actual time=0.2..0.3 rows=1 loops=5)
```

它给出 **cost(预估)与 actual time / rows(实测)**,能直接看出:哪一步实际行数远超预估(统计信息过期)、哪一步耗时最多。这是普通 `EXPLAIN` 做不到的。

## 5.7 索引设计方法论

### 该在哪些列上建索引

✅ **应该建:**

1. **WHERE 条件中高频出现的列**
2. **ORDER BY / GROUP BY / DISTINCT 的列**
3. **JOIN 的关联列**(被驱动表必须有索引!)
4. **选择性高的列**(不同值多)。选择性 = `COUNT(DISTINCT col) / COUNT(*)`,越接近 1 越好
5. **外键列**(即使不用数据库外键约束,关联查询也要索引)

❌ **不该建:**

1. **表数据量很小**(几百行,全表扫更快)
2. **选择性极低的列**(性别、是否启用 —— 只有 2~3 个值,命中一半数据)
3. **频繁更新的列**(每次 UPDATE 都要维护索引,写放大)
4. **很少用于查询条件的列**
5. **TEXT/BLOB 大字段的全列**(只能前缀索引)

```sql
-- 计算列的选择性
SELECT
    COUNT(DISTINCT city)   / COUNT(*) AS city_sel,     -- 0.001 低,不适合单独建索引
    COUNT(DISTINCT email)  / COUNT(*) AS email_sel,    -- 0.98 高,适合
    COUNT(DISTINCT gender) / COUNT(*) AS gender_sel    -- 0.000002 极低
FROM user;

-- 低选择性列怎么办?放进联合索引做辅助过滤
-- 索引 idx_status_created (status, created_at) 比单建 idx_status 有用得多
```

### 联合索引的列顺序(核心决策)

按优先级从高到低:

1. **等值查询的列放在范围查询的列左边**
   ```sql
   -- WHERE status = 1 AND created_at > '2026-01-01'
   -- ✅ idx_status_created (status, created_at)
   -- ❌ idx_created_status (created_at, status)  ← status 用不上
   ```

2. **选择性高的列放左边**(能更快缩小范围)
   ```sql
   -- WHERE city = '北京' AND age = 20,city 选择性 0.001,age 选择性 0.05
   -- ✅ idx_age_city (age, age 选择性更高)
   ```

3. **最常用、最关键的查询条件的列放左边**(让一个索引服务多个查询)
   ```sql
   -- 查询模式:① WHERE a  ② WHERE a AND b  ③ WHERE a AND b AND c
   -- ✅ idx_a_b_c 一个索引满足三种(最左前缀)
   -- 不需要再建 idx_a、idx_a_b(冗余!)
   ```

4. **ORDER BY / GROUP BY 的列考虑放进来**,避免 filesort

5. **尽量让索引能覆盖高频查询**(把 SELECT 的列也纳入),避免回表

6. **字段长度小的列放左边**(索引页能装更多项,树更矮)

### 索引数量的纪律

| 问题 | 后果 |
| --- | --- |
| 索引太多 | **写性能下降**(每次 INSERT/UPDATE/DELETE 都要维护所有索引);占用磁盘;优化器选择变慢 |
| 冗余索引 | `idx_a(a)` 与 `idx_a_b(a,b)` 并存,前者完全被后者覆盖,应删除 |
| 重复索引 | 同样的列建了两个不同名字的索引 |
| 从不使用的索引 | 白白拖累写入 |

```sql
-- 找出冗余/重复索引(8.0 sys 库)
SELECT * FROM sys.schema_redundant_indexes WHERE table_schema = 'mydb';
SELECT * FROM sys.schema_unused_indexes    WHERE object_schema = 'mydb';

-- 手动检查所有索引
SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols,
       NON_UNIQUE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'mydb'
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME;
```

> **经验值:** 单表索引数量控制在 **5 个以内**,联合索引列数控制在 **5 个以内**。
> **索引不是越多越好** —— 这是最常见的认知误区。

### 索引的三大误区(纠正)

| 误区 | 事实 |
| --- | --- |
| "索引越多查询越快" | 索引加速读、拖慢写;冗余索引纯属负担 |
| "`IN` 列表查询用不到索引" | **可以用**,`IN` 会被优化为多个等值(range 类型);只有子查询结果特别大时才可能放弃 |
| "WHERE 条件的书写顺序必须和索引列顺序一致" | **不需要**,优化器会自动重排条件 |
| "有了索引就一定会走" | 优化器基于成本决策,命中率过高时全表扫更划算 |
| "`LIKE` 一定不走索引" | `'x%'` 前缀匹配可以走,`'%x'` 才不行 |

## 5.8 索引与排序、分页的配合

```sql
-- 场景:列表页 WHERE + ORDER BY + LIMIT

-- 索引 idx_status_created (status, created_at)

-- ✅ 完美:等值 + 索引序排序 + 分页
SELECT id, title FROM article
WHERE status = 1
ORDER BY created_at DESC
LIMIT 20;
-- Extra: Backward index scan(8.0,反向扫索引,无 filesort)

-- ✅ 覆盖索引,连回表都省了
SELECT id, created_at FROM article
WHERE status = 1 ORDER BY created_at DESC LIMIT 20;
-- Extra: Using index; Backward index scan

-- ❌ filesort:排序列不在索引里
SELECT id, title FROM article WHERE status = 1 ORDER BY view_count DESC LIMIT 20;
-- 解决:建 idx_status_view (status, view_count)

-- ❌ 深分页
SELECT * FROM article WHERE status = 1 ORDER BY created_at DESC LIMIT 1000000, 20;
-- ✅ 游标分页(推荐,前端传上一页最后一条的 created_at 与 id)
SELECT * FROM article
WHERE status = 1
  AND (created_at, id) < ('2026-09-01 10:00:00', 12345)   -- 行构造器比较
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- ✅ 延迟关联
SELECT a.* FROM article a
JOIN (SELECT id FROM article WHERE status = 1
      ORDER BY created_at DESC LIMIT 1000000, 20) b ON a.id = b.id;
```

> **ORDER BY 多个方向无法用索引(8.0 前):** `ORDER BY a ASC, b DESC` 会 filesort。8.0 支持降序索引 `INDEX idx_a_b (a ASC, b DESC)` 可解决。
> **多列排序必须与索引列顺序、方向完全一致**才能利用索引有序性。

## 5.9 索引维护

```sql
-- 更新统计信息(优化器选错索引时先做这个)
ANALYZE TABLE user;
-- 或
ANALYZE LOCAL TABLE user;              -- 不写 binlog,不影响从库

-- 整理碎片、重建索引(会锁表,大表用 pt-osc)
OPTIMIZE TABLE user;                   -- InnoDB 下等价于 ALTER TABLE ... FORCE,重建表
ALTER TABLE user ENGINE = InnoDB;      -- 同样效果:重建表,回收碎片

-- 检查表是否有错误
CHECK TABLE user;
REPAIR TABLE user;                     -- 只对 MyISAM 有效,InnoDB 无效

-- 查看索引使用情况(哪些索引从没被用过)
SELECT * FROM sys.schema_unused_indexes;

-- 查看索引大小
SELECT TABLE_NAME, INDEX_NAME,
       ROUND(STAT_VALUE * @@innodb_page_size / 1024 / 1024, 2) AS size_mb
FROM mysql.innodb_index_stats
WHERE database_name = 'mydb' AND stat_name = 'size'
ORDER BY size_mb DESC;

-- 查看表的索引与数据总大小
SELECT TABLE_NAME,
       ROUND(DATA_LENGTH/1024/1024, 2)  AS data_mb,
       ROUND(INDEX_LENGTH/1024/1024, 2) AS index_mb,
       ROUND((DATA_LENGTH + INDEX_LENGTH)/1024/1024, 2) AS total_mb,
       TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'mydb'
ORDER BY total_mb DESC;
```

> **大批量 DELETE 后空间不会自动释放**(只是标记可复用),文件仍占那么大。需要 `OPTIMIZE TABLE` 重建才会真正归还磁盘,但会锁表,生产用 gh-ost。
> **批量导入前先删索引,导完再建**,比边插边维护索引快数倍:
> ```sql
> ALTER TABLE big_table DROP INDEX idx_a, DROP INDEX idx_b;
> LOAD DATA INFILE ... ;
> ALTER TABLE big_table ADD INDEX idx_a(a), ADD INDEX idx_b(b);
> ```

## 5.10 常见问题与最佳实践

1. **主键必须自增**:自增主键让新数据总是追加在 B+ 树最右侧,**顺序写、页分裂少**;UUID 随机值导致到处插入、页分裂严重、索引膨胀
2. **主键要短**:二级索引叶子节点都存主键值,主键越大所有二级索引都跟着变大。用 `BIGINT` 而不是 `VARCHAR(36)` 的 UUID
3. **不要过度索引**:单表 ≤ 5 个索引;定期用 `sys.schema_unused_indexes` 清理
4. **联合索引优先于多个单列索引**:一个 `(a,b,c)` 能覆盖 `a`、`a,b`、`a,b,c` 三种查询
5. **等值列在左,范围列在右**;选择性高的列在左
6. **`SELECT` 只取需要的列**,争取覆盖索引(`Using index`)
7. **索引列不做函数/运算**,不对 VARCHAR 列用数字比较
8. **ORDER BY / GROUP BY 的列尽量进索引**,消除 `Using filesort` / `Using temporary`
9. **JOIN 的被驱动表关联列必须有索引**,否则 Block Nested Loop,性能灾难
10. **优化器选错索引时先 `ANALYZE TABLE`**,再考虑 `FORCE INDEX`
11. **深分页用游标分页或延迟关联**,不要 `LIMIT 1000000, 20`
12. **前缀模糊搜索(`LIKE '%x'`)索引救不了**,用全文索引或 Elasticsearch

---

## 本章小结

- InnoDB 用 **B+ 树**:非叶子只存键、叶子存数据且双向链表相连 → 树矮(2000 万行仅 3 层)、范围查询顺链表扫
- **聚簇索引**叶子存整行(一表一个,即主键);**二级索引**叶子存主键值,查非索引列要**回表**
- **覆盖索引** = 查询列全在索引里,免回表,`Extra: Using index`;这是禁用 `SELECT *` 的技术理由
- **最左前缀**:联合索引 `(a,b,c)` 按 a→b→c 依次排序,缺最左列则失效;**范围查询之后的列用不上索引**
- 索引失效十大场景:违反最左前缀、列上做函数/运算、隐式类型转换、字符集不一致、前置模糊、OR 一侧无索引、`!=`/`NOT IN`、NULL 判断、命中率过高、排序方向不匹配
- `key_len` 精确判断联合索引用了几列;`type` 从 `const` → `ref` → `range` → `index` → `ALL` 递减
- `Extra` 里 `Using index` 最好,`Using filesort` / `Using temporary` / `Using join buffer` 都要优化
- `EXPLAIN ANALYZE`(8.0.18+)给出实际耗时与行数,是最强调优工具
- 设计原则:主键自增且短、联合索引等值在左范围在右、单表 ≤ 5 索引、定期清理未使用索引
- 维护:`ANALYZE TABLE` 更新统计信息;`OPTIMIZE TABLE` 回收碎片(锁表,大表用 gh-ost)
