---
title: "SQLite SQL语法与操作"
aliases:
  - "SQLite SQL"
  - "SQLite操作"
tags:
  - "后端"
  - "数据库"
  - "sqlite"
  - "sql"
  - "笔记"
category: "后端"
folder: "SQLite"
parent: "[[目录]]"
related:
  - "[[后端/数据库/SQLite/SQLite入门与核心特性]]"
  - "[[后端/数据库/SQLite/SQLite性能优化]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 02 SQLite SQL 语法与操作

SQLite 支持大部分标准 SQL，同时提供一些特有的语法和功能。本章介绍表操作、CRUD、约束、索引等核心 SQL 操作。

## 2.1 数据类型

### 2.1.1 存储类型

SQLite 使用 5 种存储类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| `NULL` | 空值 | `NULL` |
| `INTEGER` | 有符号整数（1-8 字节） | `42`, `-100` |
| `REAL` | 8 字节浮点数 | `3.14`, `2.5e10` |
| `TEXT` | 文本（UTF-8/UTF-16） | `'hello'` |
| `BLOB` | 二进制数据 | `X'53514C697465'` |

### 2.1.2 类型亲和

```sql
CREATE TABLE example (
    id INTEGER PRIMARY KEY,      -- INTEGER 亲和
    name TEXT NOT NULL,           -- TEXT 亲和
    price REAL,                   -- REAL 亲和
    data BLOB,                    -- 无亲和
    count NUMERIC                 -- NUMERIC 亲和
);

-- SQLite 会尝试转换，但不强制
INSERT INTO example VALUES (1, 123, '3.14', 'text', '2023-01-01');
-- id: 1 (INTEGER)
-- name: '123' (转为 TEXT)
-- price: 3.14 (转为 REAL)
-- data: 'text' (保持 TEXT，因为无亲和)
-- count: '2023-01-01' (保持 TEXT，NUMERIC 亲和但无法转换)
```

## 2.2 表操作

### 2.2.1 创建表

```sql
-- 基本建表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    age INTEGER CHECK (age >= 0 AND age <= 150),
    created_at TEXT DEFAULT (datetime('now')),
    is_active INTEGER DEFAULT 1
);

-- IF NOT EXISTS
CREATE TABLE IF NOT EXISTS users (...);

-- 临时表（连接关闭后删除）
CREATE TEMP TABLE temp_data (
    id INTEGER PRIMARY KEY,
    value TEXT
);

-- 从查询结果创建表
CREATE TABLE active_users AS
SELECT * FROM users WHERE is_active = 1;

-- WITHOUT ROWID 表（3.8.2+）
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT
) WITHOUT ROWID;
```

### 2.2.2 STRICT 表（3.37+）

```sql
-- STRICT 表强制类型检查（更接近传统数据库）
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    created_at TEXT
) STRICT;

-- STRICT 表不允许隐式类型转换
INSERT INTO products VALUES (1, 'Phone', '99.99', '10', datetime('now'));
-- 错误：price 必须是 REAL，不能是 TEXT

INSERT INTO products VALUES (1, 'Phone', 99.99, 10, datetime('now'));
-- 正确
```

### 2.2.3 修改表

```sql
-- 重命名表
ALTER TABLE users RENAME TO customers;

-- 重命名列（3.25+）
ALTER TABLE users RENAME COLUMN username TO name;

-- 添加列
ALTER TABLE users ADD COLUMN phone TEXT;

-- 添加带默认值的列
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';

-- SQLite 的限制：
-- ❌ 不能删除列（3.35+ 可以）
-- ❌ 不能修改列类型
-- ❌ 不能添加约束（除了 CHECK）
-- 解决方案：创建新表，迁移数据

-- 删除列（3.35+）
ALTER TABLE users DROP COLUMN phone;
```

### 2.2.4 删除表

```sql
-- 删除表
DROP TABLE users;

-- 如果存在则删除
DROP TABLE IF EXISTS users;
```

## 2.3 约束

### 2.3.1 约束类型

```sql
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- NOT NULL 约束
    user_id INTEGER NOT NULL,
    
    -- UNIQUE 约束
    order_no TEXT UNIQUE NOT NULL,
    
    -- CHECK 约束
    status TEXT CHECK (status IN ('pending', 'paid', 'shipped', 'done')),
    amount REAL CHECK (amount > 0),
    
    -- DEFAULT 约束
    created_at TEXT DEFAULT (datetime('now')),
    
    -- FOREIGN KEY 约束
    FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
```

### 2.3.2 外键约束

```sql
-- 外键默认禁用，必须显式启用
PRAGMA foreign_keys = ON;

-- 查看外键状态
PRAGMA foreign_keys;

-- 外键操作
-- ON DELETE CASCADE    级联删除
-- ON DELETE SET NULL   设为 NULL
-- ON DELETE SET DEFAULT 设为默认值
-- ON DELETE RESTRICT   阻止删除（默认）
-- ON DELETE NO ACTION  类似 RESTRICT

-- 查看表的外键信息
PRAGMA foreign_key_list(orders);

-- 检查外键完整性
PRAGMA foreign_key_check;
```

## 2.4 插入数据

### 2.4.1 INSERT

```sql
-- 插入单行
INSERT INTO users (username, email, age)
VALUES ('alice', 'alice@example.com', 28);

-- 插入多行
INSERT INTO users (username, email, age) VALUES
    ('bob', 'bob@example.com', 25),
    ('charlie', 'charlie@example.com', 32);

-- 插入并返回（RETURNING，3.35+）
INSERT INTO users (username, email, age)
VALUES ('david', 'david@example.com', 30)
RETURNING id, username, created_at;

-- 从查询插入
INSERT INTO user_backup (username, email)
SELECT username, email FROM users WHERE age > 30;

-- INSERT OR REPLACE（冲突时替换）
INSERT OR REPLACE INTO users (id, username, email)
VALUES (1, 'alice_new', 'alice_new@example.com');

-- INSERT OR IGNORE（冲突时忽略）
INSERT OR IGNORE INTO users (username, email)
VALUES ('alice', 'alice@example.com');
```

### 2.4.2 UPSERT（3.24+）

```sql
-- ON CONFLICT 子句（类似 MySQL 的 ON DUPLICATE KEY UPDATE）
INSERT INTO users (username, email, age)
VALUES ('alice', 'alice@example.com', 29)
ON CONFLICT(username) DO UPDATE SET
    email = excluded.email,
    age = excluded.age;

-- ON CONFLICT DO NOTHING
INSERT INTO users (username, email, age)
VALUES ('bob', 'bob@example.com', 25)
ON CONFLICT(username) DO NOTHING;

-- 多列冲突
INSERT INTO orders (user_id, order_no, amount)
VALUES (1, 'ORD001', 100.00)
ON CONFLICT(user_id, order_no) DO UPDATE SET
    amount = excluded.amount;
```

## 2.5 查询数据

### 2.5.1 SELECT

```sql
-- 基本查询
SELECT * FROM users;
SELECT username, email FROM users;

-- 别名
SELECT username AS name, email AS contact FROM users;

-- 表达式
SELECT username, age, age + 1 AS next_age FROM users;

-- DISTINCT
SELECT DISTINCT city FROM users;

-- WHERE 条件
SELECT * FROM users WHERE age > 25 AND city = 'Beijing';

-- LIKE 模糊查询
SELECT * FROM users WHERE username LIKE 'a%';
SELECT * FROM users WHERE email LIKE '%@gmail.com';

-- GLOB 模式（Unix 风格）
SELECT * FROM users WHERE username GLOB 'a*';

-- IN 查询
SELECT * FROM users WHERE age IN (25, 30, 35);

-- BETWEEN
SELECT * FROM users WHERE age BETWEEN 20 AND 30;

-- IS NULL / IS NOT NULL
SELECT * FROM users WHERE email IS NULL;

-- CASE 表达式
SELECT username,
    CASE
        WHEN age < 18 THEN 'minor'
        WHEN age < 60 THEN 'adult'
        ELSE 'senior'
    END AS age_group
FROM users;
```

### 2.5.2 排序与限制

```sql
-- ORDER BY
SELECT * FROM users ORDER BY age DESC;
SELECT * FROM users ORDER BY city ASC, age DESC;

-- LIMIT 和 OFFSET
SELECT * FROM users LIMIT 10;
SELECT * FROM users LIMIT 10 OFFSET 20;

-- 组合使用
SELECT * FROM users
WHERE age > 20
ORDER BY age DESC
LIMIT 10 OFFSET 0;
```

### 2.5.3 聚合函数

```sql
-- COUNT
SELECT COUNT(*) FROM users;
SELECT COUNT(DISTINCT city) FROM users;

-- SUM, AVG, MIN, MAX
SELECT SUM(amount) FROM orders;
SELECT AVG(age) FROM users;
SELECT MIN(age), MAX(age) FROM users;

-- GROUP BY
SELECT city, COUNT(*) as count, AVG(age) as avg_age
FROM users
GROUP BY city
HAVING count > 5
ORDER BY count DESC;

-- GROUP_CONCAT
SELECT city, GROUP_CONCAT(username, ', ') as users
FROM users
GROUP BY city;
```

### 2.5.4 子查询

```sql
-- WHERE 子查询
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders WHERE amount > 100);

-- FROM 子查询
SELECT u.*, o.total_orders
FROM users u
JOIN (
    SELECT user_id, COUNT(*) as total_orders
    FROM orders
    GROUP BY user_id
) o ON u.id = o.user_id;

-- EXISTS
SELECT * FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);

-- 标量子查询
SELECT username,
    (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count
FROM users;
```

### 2.5.5 JOIN

```sql
-- INNER JOIN
SELECT u.username, o.order_no, o.amount
FROM users u
INNER JOIN orders o ON u.id = o.user_id;

-- LEFT JOIN
SELECT u.username, o.order_no
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;

-- 多表 JOIN
SELECT u.username, o.order_no, p.name as product_name
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id;

-- 自 JOIN
SELECT e.name as employee, m.name as manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;

-- CROSS JOIN
SELECT u.username, p.name
FROM users u
CROSS JOIN products p;
```

## 2.6 更新与删除

### 2.6.1 UPDATE

```sql
-- 基本更新
UPDATE users SET age = 30 WHERE username = 'alice';

-- 更新多列
UPDATE users SET
    email = 'new@example.com',
    age = age + 1
WHERE id = 1;

-- 使用表达式
UPDATE products SET price = price * 1.1;  -- 涨价 10%

-- UPDATE FROM（3.33+）
UPDATE orders
SET status = 'inactive'
FROM users
WHERE orders.user_id = users.id
  AND users.last_login < datetime('now', '-1 year');

-- UPDATE RETURNING（3.35+）
UPDATE users SET age = age + 1
WHERE city = 'Beijing'
RETURNING id, username, age;
```

### 2.6.2 DELETE

```sql
-- 基本删除
DELETE FROM users WHERE id = 1;

-- 删除所有（保留表结构）
DELETE FROM users;

-- DELETE RETURNING（3.35+）
DELETE FROM users
WHERE last_login < datetime('now', '-1 year')
RETURNING id, username, email;

-- 使用子查询删除
DELETE FROM orders
WHERE user_id IN (
    SELECT id FROM users WHERE is_active = 0
);
```

## 2.7 事务

### 2.7.1 事务语法

```sql
-- 开始事务
BEGIN;
-- 或
BEGIN TRANSACTION;
BEGIN IMMEDIATE;  -- 立即获取 RESERVED 锁
BEGIN EXCLUSIVE;  -- 立即获取 EXCLUSIVE 锁

-- 执行操作
INSERT INTO users (username, email) VALUES ('test', 'test@example.com');
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;

-- 提交
COMMIT;
-- 或
END;
END TRANSACTION;

-- 回滚
ROLLBACK;
```

### 2.7.2 SAVEPOINT

```sql
-- 创建保存点
SAVEPOINT sp1;

-- 回滚到保存点
ROLLBACK TO sp1;

-- 释放保存点
RELEASE sp1;

-- 示例
BEGIN;
INSERT INTO users VALUES (1, 'alice');
SAVEPOINT sp1;
INSERT INTO users VALUES (2, 'bob');
-- 如果出错，只回滚到 sp1
ROLLBACK TO sp1;
-- 继续
INSERT INTO users VALUES (3, 'charlie');
COMMIT;
-- 结果：只有 alice 和 charlie
```

### 2.7.3 事务最佳实践

```python
import sqlite3

conn = sqlite3.connect('mydb.sqlite')

# 方式 1：手动事务
conn.execute("BEGIN")
try:
    conn.execute("INSERT INTO users VALUES (?, ?)", (1, 'alice'))
    conn.execute("INSERT INTO users VALUES (?, ?)", (2, 'bob'))
    conn.execute("COMMIT")
except:
    conn.execute("ROLLBACK")
    raise

# 方式 2：上下文管理器（推荐）
with conn:
    conn.execute("INSERT INTO users VALUES (?, ?)", (1, 'alice'))
    conn.execute("INSERT INTO users VALUES (?, ?)", (2, 'bob'))
    # 自动提交，异常时自动回滚

# 方式 3：隔离级别
conn = sqlite3.connect('mydb.sqlite', isolation_level='DEFERRED')
# DEFERRED（默认）：延迟获取锁
# IMMEDIATE：立即获取 RESERVED 锁
# EXCLUSIVE：立即获取 EXCLUSIVE 锁
# None：自动提交模式
```

## 2.8 索引

### 2.8.1 创建索引

```sql
-- 单列索引
CREATE INDEX idx_users_email ON users(email);

-- 复合索引
CREATE INDEX idx_users_city_age ON users(city, age);

-- 唯一索引
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 表达式索引（3.9+）
CREATE INDEX idx_users_lower_email ON users(LOWER(email));

-- 部分索引（3.9+）
CREATE INDEX idx_active_users ON users(email) WHERE is_active = 1;
```

### 2.8.2 删除索引

```sql
DROP INDEX idx_users_email;
DROP INDEX IF EXISTS idx_users_email;
```

### 2.8.3 查看索引

```sql
-- 查看所有索引
SELECT name, sql FROM sqlite_master WHERE type = 'index';

-- 查看表的索引
PRAGMA index_list(users);

-- 查看索引详情
PRAGMA index_info(idx_users_email);
```

## 2.9 视图

### 2.9.1 创建视图

```sql
-- 创建视图
CREATE VIEW active_users AS
SELECT id, username, email
FROM users
WHERE is_active = 1;

-- 使用视图
SELECT * FROM active_users WHERE age > 25;

-- 删除视图
DROP VIEW active_users;

-- IF EXISTS
DROP VIEW IF EXISTS active_users;
```

## 2.10 触发器

### 2.10.1 创建触发器

```sql
-- BEFORE INSERT 触发器
CREATE TRIGGER validate_age
BEFORE INSERT ON users
BEGIN
    SELECT CASE
        WHEN NEW.age < 0 OR NEW.age > 150 THEN
            RAISE(ABORT, 'Invalid age')
    END;
END;

-- AFTER INSERT 触发器
CREATE TRIGGER log_user_insert
AFTER INSERT ON users
BEGIN
    INSERT INTO audit_log (action, user_id, timestamp)
    VALUES ('INSERT', NEW.id, datetime('now'));
END;

-- UPDATE 触发器
CREATE TRIGGER update_timestamp
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- DELETE 触发器
CREATE TRIGGER log_user_delete
AFTER DELETE ON users
BEGIN
    INSERT INTO audit_log (action, user_id, timestamp)
    VALUES ('DELETE', OLD.id, datetime('now'));
END;
```

### 2.10.2 管理触发器

```sql
-- 查看所有触发器
SELECT name, sql FROM sqlite_master WHERE type = 'trigger';

-- 删除触发器
DROP TRIGGER validate_age;
DROP TRIGGER IF EXISTS validate_age;
```

## 2.11 常用函数

### 2.11.1 日期时间函数

```sql
-- 当前时间
SELECT datetime('now');              -- 2026-09-06 10:30:00
SELECT date('now');                  -- 2026-09-06
SELECT time('now');                  -- 10:30:00
SELECT strftime('%Y-%m-%d %H:%M:%S', 'now');

-- 日期计算
SELECT date('now', '+1 day');        -- 明天
SELECT date('now', '-1 month');      -- 上个月
SELECT datetime('now', '+2 hours', '+30 minutes');

-- 日期格式化
SELECT strftime('%Y年%m月%d日', 'now');
SELECT strftime('%s', 'now');        -- Unix 时间戳

-- 从 Unix 时间戳转换
SELECT datetime(1694000000, 'unixepoch');
SELECT datetime(1694000000, 'unixepoch', 'localtime');

-- 日期差
SELECT julianday('2026-12-31') - julianday('2026-01-01');  -- 天数
```

### 2.11.2 字符串函数

```sql
-- 长度
SELECT length('hello');  -- 5

-- 大小写
SELECT upper('hello');   -- HELLO
SELECT lower('HELLO');   -- hello

-- 子串
SELECT substr('hello world', 7);     -- world
SELECT substr('hello world', 1, 5);  -- hello

-- 替换
SELECT replace('hello world', 'world', 'sqlite');  -- hello sqlite

-- 拼接
SELECT 'hello' || ' ' || 'world';    -- hello world

-- 修剪
SELECT trim('  hello  ');            -- hello
SELECT ltrim('  hello');             -- hello
SELECT rtrim('hello  ');             -- hello

-- 类型转换
SELECT typeof(123);                  -- integer
SELECT typeof('hello');              -- text
SELECT CAST('123' AS INTEGER);       -- 123
SELECT CAST(123 AS TEXT);            -- '123'
```

### 2.11.3 数学函数

```sql
-- 绝对值
SELECT abs(-5);  -- 5

-- 随机数
SELECT random();  -- 随机整数
SELECT abs(random() % 100);  -- 0-99 随机数

-- 舍入
SELECT round(3.14159, 2);  -- 3.14

-- 最大/最小
SELECT max(1, 2, 3);  -- 3
SELECT min(1, 2, 3);  -- 1
```

### 2.11.4 JSON 函数（3.9+）

```sql
-- 创建 JSON
SELECT json('{"name": "alice", "age": 28}');
SELECT json_array(1, 2, 3);
SELECT json_object('name', 'alice', 'age', 28);

-- 提取
SELECT json_extract('{"name": "alice"}', '$.name');  -- alice
SELECT json_extract('{"items": [1,2,3]}', '$.items[0]');  -- 1

-- 插入/更新
SELECT json_insert('{"name": "alice"}', '$.age', 28);
SELECT json_replace('{"name": "alice"}', '$.name', 'bob');
SELECT json_set('{"name": "alice"}', '$.age', 28);

-- 删除
SELECT json_remove('{"name": "alice", "age": 28}', '$.age');

-- 类型检查
SELECT json_type('{"name": "alice"}', '$.name');  -- text
SELECT json_valid('{"name": "alice"}');  -- 1

-- JSON 列查询
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    profile TEXT  -- JSON 格式
);

INSERT INTO users VALUES (1, '{"name": "alice", "age": 28, "city": "Beijing"}');

SELECT * FROM users WHERE json_extract(profile, '$.city') = 'Beijing';
```

## 2.12 全文搜索（FTS5）

### 2.12.1 FTS5 虚拟表

```sql
-- 创建 FTS5 虚拟表
CREATE VIRTUAL TABLE articles USING fts5(title, content);

-- 插入数据
INSERT INTO articles VALUES
    ('SQLite Tutorial', 'Learn SQLite database basics'),
    ('Python Guide', 'Python programming language tutorial'),
    ('Database Comparison', 'Compare MySQL, PostgreSQL, and SQLite');

-- 全文搜索
SELECT * FROM articles WHERE articles MATCH 'sqlite';
SELECT * FROM articles WHERE articles MATCH 'database tutorial';
SELECT * FROM articles WHERE articles MATCH 'sqlite OR python';
SELECT * FROM articles WHERE articles MATCH 'database AND sqlite';

-- 短语搜索
SELECT * FROM articles WHERE articles MATCH '"sqlite database"';

-- 前缀搜索
SELECT * FROM articles WHERE articles MATCH 'data*';

-- NEAR 操作符
SELECT * FROM articles WHERE articles MATCH 'sqlite NEAR/5 tutorial';

-- 排序（按相关性）
SELECT *, rank FROM articles
WHERE articles MATCH 'database'
ORDER BY rank;

-- 高亮显示
SELECT highlight(articles, 1, '<b>', '</b>') as content
FROM articles WHERE articles MATCH 'sqlite';
```

---

## 本章小结

- SQLite 使用动态类型和类型亲和
- STRICT 表（3.37+）提供强制类型检查
- UPSERT（3.24+）支持 ON CONFLICT 子句
- RETURNING 子句（3.35+）可在 INSERT/UPDATE/DELETE 后返回数据
- 外键默认禁用，必须 `PRAGMA foreign_keys = ON`
- 事务必须显式 BEGIN/COMMIT，或使用上下文管理器
- FTS5 提供全文搜索功能
- JSON 函数（3.9+）支持 JSON 数据操作
