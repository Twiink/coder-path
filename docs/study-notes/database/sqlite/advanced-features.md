---
title: "SQLite高级特性"
aliases:
  - "SQLite高级"
  - "SQLite进阶"
tags:
  - "后端"
  - "数据库"
  - "sqlite"
  - "高级特性"
  - "笔记"
category: "后端"
folder: "SQLite"
parent: "[[目录]]"
related:
  - "[[后端/数据库/SQLite/SQLite SQL语法与操作]]"
  - "[[后端/数据库/SQLite/SQLite性能优化]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 03 SQLite 高级特性

本章介绍 SQLite 的高级功能，包括窗口函数、CTE、虚拟表、扩展加载等。

## 3.1 窗口函数（3.25+）

### 3.1.1 基本语法

```sql
-- 窗口函数基本语法
function_name() OVER (
    [PARTITION BY column]
    [ORDER BY column]
    [frame_clause]
)

-- 示例数据
CREATE TABLE sales (
    id INTEGER PRIMARY KEY,
    region TEXT,
    amount REAL,
    sale_date DATE
);
```

### 3.1.2 排名函数

```sql
-- ROW_NUMBER(): 连续行号
SELECT
    region,
    amount,
    ROW_NUMBER() OVER (ORDER BY amount DESC) as rank
FROM sales;

-- RANK(): 允许并列，跳号
SELECT
    region,
    amount,
    RANK() OVER (ORDER BY amount DESC) as rank
FROM sales;

-- DENSE_RANK(): 允许并列，不跳号
SELECT
    region,
    amount,
    DENSE_RANK() OVER (ORDER BY amount DESC) as rank
FROM sales;

-- NTILE(): 分桶
SELECT
    region,
    amount,
    NTILE(4) OVER (ORDER BY amount DESC) as quartile
FROM sales;
```

### 3.1.3 聚合窗口函数

```sql
-- 累计求和
SELECT
    region,
    amount,
    SUM(amount) OVER (ORDER BY sale_date) as running_total
FROM sales;

-- 分区内聚合
SELECT
    region,
    amount,
    SUM(amount) OVER (PARTITION BY region) as region_total,
    AVG(amount) OVER (PARTITION BY region) as region_avg,
    amount * 100.0 / SUM(amount) OVER (PARTITION BY region) as percentage
FROM sales;

-- 移动平均
SELECT
    sale_date,
    amount,
    AVG(amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as moving_avg_3days
FROM sales;
```

### 3.1.4 偏移函数

```sql
-- LAG(): 前一行
SELECT
    sale_date,
    amount,
    LAG(amount, 1) OVER (ORDER BY sale_date) as prev_amount,
    amount - LAG(amount, 1) OVER (ORDER BY sale_date) as change
FROM sales;

-- LEAD(): 后一行
SELECT
    sale_date,
    amount,
    LEAD(amount, 1) OVER (ORDER BY sale_date) as next_amount
FROM sales;

-- FIRST_VALUE() / LAST_VALUE()
SELECT
    region,
    amount,
    FIRST_VALUE(amount) OVER (PARTITION BY region ORDER BY amount DESC) as max_amount,
    LAST_VALUE(amount) OVER (
        PARTITION BY region
        ORDER BY amount
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as min_amount
FROM sales;
```

## 3.2 公用表表达式（CTE）

### 3.2.1 基本 CTE

```sql
-- 简单 CTE
WITH active_users AS (
    SELECT id, username, email
    FROM users
    WHERE is_active = 1
)
SELECT * FROM active_users WHERE email LIKE '%@gmail.com';

-- 多个 CTE
WITH
    user_orders AS (
        SELECT user_id, COUNT(*) as order_count
        FROM orders
        GROUP BY user_id
    ),
    high_value_users AS (
        SELECT user_id FROM user_orders WHERE order_count > 10
    )
SELECT u.username, uo.order_count
FROM users u
JOIN user_orders uo ON u.id = uo.user_id
WHERE u.id IN (SELECT user_id FROM high_value_users);
```

### 3.2.2 递归 CTE

```sql
-- 生成数字序列
WITH RECURSIVE numbers(n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM numbers WHERE n < 10
)
SELECT * FROM numbers;

-- 生成日期序列
WITH RECURSIVE dates(d) AS (
    SELECT date('2026-01-01')
    UNION ALL
    SELECT date(d, '+1 day') FROM dates WHERE d < date('2026-01-31')
)
SELECT * FROM dates;

-- 树形结构查询
CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    name TEXT,
    manager_id INTEGER
);

-- 查找某员工的所有下属
WITH RECURSIVE subordinates(id, name, level) AS (
    SELECT id, name, 0
    FROM employees
    WHERE id = 1  -- 起始员工
    UNION ALL
    SELECT e.id, e.name, s.level + 1
    FROM employees e
    JOIN subordinates s ON e.manager_id = s.id
)
SELECT * FROM subordinates;

-- 查找某员工的所有上级
WITH RECURSIVE managers(id, name, level) AS (
    SELECT id, name, 0
    FROM employees
    WHERE id = 5  -- 起始员工
    UNION ALL
    SELECT e.id, e.name, m.level + 1
    FROM employees e
    JOIN managers m ON e.id = m.manager_id
)
SELECT * FROM managers;

-- 斐波那契数列
WITH RECURSIVE fib(a, b) AS (
    SELECT 0, 1
    UNION ALL
    SELECT b, a + b FROM fib WHERE a < 1000
)
SELECT a FROM fib;
```

## 3.3 虚拟表

### 3.3.1 FTS5 全文搜索

```sql
-- 创建 FTS5 表（详见上一章）
CREATE VIRTUAL TABLE documents USING fts5(title, body, tokenize='porter unicode61');

-- 插入数据
INSERT INTO documents VALUES
    ('Introduction to SQLite', 'SQLite is a lightweight database...'),
    ('Advanced SQL Techniques', 'Window functions, CTEs, and more...');

-- 搜索
SELECT * FROM documents WHERE documents MATCH 'sqlite AND database';

-- 使用 tokenizer
CREATE VIRTUAL TABLE articles USING fts5(
    title,
    content,
    tokenize='porter unicode61 remove_diacritics 1'
);
```

### 3.3.2 R*Tree 空间索引

```sql
-- 创建 R*Tree 虚拟表（二维空间索引）
CREATE VIRTUAL TABLE locations USING rtree(
    id,              -- 整数主键
    min_x, max_x,    -- X 轴边界
    min_y, max_y     -- Y 轴边界
);

-- 插入矩形区域
INSERT INTO locations VALUES
    (1, 0, 10, 0, 10),   -- 矩形 1
    (2, 5, 15, 5, 15),   -- 矩形 2
    (3, 20, 30, 20, 30); -- 矩形 3

-- 查询包含点的矩形
SELECT * FROM locations
WHERE min_x <= 5 AND max_x >= 5
  AND min_y <= 5 AND max_y >= 5;

-- 查询相交的矩形
SELECT * FROM locations
WHERE max_x >= 0 AND min_x <= 10
  AND max_y >= 0 AND min_y <= 10;
```

### 3.3.3 自定义虚拟表

```sql
-- 使用 sqlite3_create_module() API 创建自定义虚拟表
-- 需要 C/C++ 编程

-- 示例：CSV 虚拟表（需要编译 csv 扩展）
CREATE VIRTUAL TABLE csv_data USING csv(filename='data.csv');
SELECT * FROM csv_data;
```

## 3.4 扩展加载

### 3.4.1 加载扩展

```sql
-- 启用扩展加载（默认禁用）
-- 需要在编译时启用 SQLITE_ENABLE_LOAD_EXTENSION

-- 加载扩展
SELECT load_extension('./json1.so');

-- 常用扩展
-- json1: JSON 函数（3.9+ 已内置）
-- fts5: 全文搜索（需单独编译）
-- rtree: 空间索引
-- icu: Unicode 支持
-- math: 数学函数
```

### 3.4.2 编译扩展

```bash
# 编译 JSON1 扩展
gcc -shared -fPIC -I sqlite-src \
    sqlite-src/ext/misc/json1.c \
    -o json1.so

# 编译 FTS5
gcc -shared -fPIC -I sqlite-src \
    -DSQLITE_CORE \
    sqlite-src/ext/fts5/fts5.c \
    -o fts5.so
```

## 3.5 内存数据库

### 3.5.1 创建内存数据库

```python
import sqlite3

# 纯内存数据库
conn = sqlite3.connect(':memory:')

# 创建表和操作
conn.execute('''
    CREATE TABLE temp_data (
        id INTEGER PRIMARY KEY,
        value TEXT
    )
''')

# 使用完毕后自动销毁
conn.close()
```

### 3.5.2 共享内存数据库

```python
# 多个连接共享同一个内存数据库
conn1 = sqlite3.connect('file::memory:?cache=shared', uri=True)
conn2 = sqlite3.connect('file::memory:?cache=shared', uri=True)

# conn1 创建的数据，conn2 可以访问
conn1.execute('CREATE TABLE test (id INTEGER)')
conn1.execute('INSERT INTO test VALUES (1)')
conn1.commit()

result = conn2.execute('SELECT * FROM test').fetchall()
print(result)  # [(1,)]
```

### 3.5.3 文件数据库备份到内存

```python
import sqlite3

# 从文件数据库加载到内存
disk_conn = sqlite3.connect('mydb.sqlite')
mem_conn = sqlite3.connect(':memory:')

# 备份到内存
disk_conn.backup(mem_conn)

# 在内存中快速操作
mem_conn.execute('SELECT * FROM users')

# 备份回文件
mem_conn.backup(disk_conn)
```

## 3.6 备份 API

### 3.6.1 使用 backup() 方法

```python
import sqlite3

# 源数据库
source = sqlite3.connect('source.sqlite')

# 目标数据库
target = sqlite3.connect('backup.sqlite')

# 备份
source.backup(target)

# 带进度的备份
def progress(status, remaining, total):
    print(f'Copied {total-remaining} of {total} pages')

source.backup(target, pages=10, progress=progress)

source.close()
target.close()
```

### 3.6.2 在线备份

```python
# 在线备份（不锁定源数据库）
import sqlite3
import time

source = sqlite3.connect('live.sqlite')
backup = sqlite3.connect('backup.sqlite')

# 分步备份
b = backup.backup(source)
while True:
    b.step(10)  # 每次备份 10 页
    if b.remaining == 0:
        break
    time.sleep(0.1)  # 允许其他操作

b.finish()
```

## 3.7 用户定义函数

### 3.7.1 创建标量函数

```python
import sqlite3
import hashlib

conn = sqlite3.connect(':memory:')

# 创建自定义函数
def md5(text):
    return hashlib.md5(text.encode()).hexdigest()

conn.create_function('md5', 1, md5)

# 使用自定义函数
result = conn.execute("SELECT md5('hello')").fetchone()
print(result)  # ('5d41402abc4b2a76b9719d911017c592',)

# 创建聚合函数
class SumSquare:
    def __init__(self):
        self.total = 0
    
    def step(self, value):
        if value is not None:
            self.total += value ** 2
    
    def finalize(self):
        return self.total

conn.create_aggregate('sum_square', 1, SumSquare)

conn.execute('CREATE TABLE numbers (n INTEGER)')
conn.executemany('INSERT INTO numbers VALUES (?)', [(1,), (2,), (3,)])

result = conn.execute('SELECT sum_square(n) FROM numbers').fetchone()
print(result)  # (14,)  # 1^2 + 2^2 + 3^2 = 14
```

### 3.7.2 创建排序规则

```python
import sqlite3

conn = sqlite3.connect(':memory:')

# 自定义排序规则（忽略大小写）
def collate_ignore_case(s1, s2):
    s1, s2 = s1.lower(), s2.lower()
    if s1 < s2:
        return -1
    elif s1 > s2:
        return 1
    else:
        return 0

conn.create_collation('NOCASE_CUSTOM', collate_ignore_case)

conn.execute('CREATE TABLE words (word TEXT)')
conn.executemany('INSERT INTO words VALUES (?)', [
    ('Apple',), ('banana',), ('Cherry',), ('date',)
])

# 使用自定义排序
result = conn.execute(
    'SELECT * FROM words ORDER BY word COLLATE NOCASE_CUSTOM'
).fetchall()
print(result)  # [('Apple',), ('banana',), ('Cherry',), ('date',)]
```

## 3.8 事务模式

### 3.8.1 自动提交模式

```python
import sqlite3

# 自动提交模式（isolation_level=None）
conn = sqlite3.connect('mydb.sqlite', isolation_level=None)

# 每条语句自动提交
conn.execute('INSERT INTO users VALUES (1, "alice")')
# 立即提交

# 显式事务
conn.execute('BEGIN')
conn.execute('INSERT INTO users VALUES (2, "bob")')
conn.execute('INSERT INTO users VALUES (3, "charlie")')
conn.execute('COMMIT')
```

### 3.8.2 WAL 检查点

```python
import sqlite3

conn = sqlite3.connect('mydb.sqlite')
conn.execute('PRAGMA journal_mode=WAL')

# 手动检查点
# PASSIVE: 不阻塞读写
conn.execute('PRAGMA wal_checkpoint(PASSIVE)')

# FULL: 阻塞新写入，等待现有读写完成
conn.execute('PRAGMA wal_checkpoint(FULL)')

# RESTART: 类似 FULL，但会重启 WAL 文件
conn.execute('PRAGMA wal_checkpoint(RESTART)')

# TRUNCATE: 类似 RESTART，但会截断 WAL 文件
conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')
```

## 3.9 数据库加密

### 3.9.1 SQLCipher

```bash
# 安装 SQLCipher（SQLite 加密扩展）
# macOS
brew install sqlcipher

# Ubuntu
sudo apt install sqlcipher

# 使用 SQLCipher
sqlcipher mydb.sqlite
```

```sql
-- 设置加密密钥
PRAGMA key = 'my-secret-key';

-- 或者使用十六进制密钥
PRAGMA hexkey = '746869732069732061206B6579';

-- 修改密钥
PRAGMA rekey = 'new-secret-key';

-- 加密现有数据库
ATTACH DATABASE 'encrypted.db' AS encrypted KEY 'secret';
SELECT sqlcipher_export('encrypted');
DETACH DATABASE encrypted;
```

```python
# Python 使用 pysqlcipher3
from pysqlcipher3 import dbapi2 as sqlite

conn = sqlite.connect('mydb.sqlite')
conn.execute("PRAGMA key='my-secret-key'")

# 正常使用
conn.execute('SELECT * FROM users')
```

## 3.10 调试与诊断

### 3.10.1 EXPLAIN 查询计划

```sql
-- 查看查询计划
EXPLAIN QUERY PLAN SELECT * FROM users WHERE age > 25;

-- 输出示例：
-- SCAN TABLE users

-- 使用索引的查询
EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'test@example.com';

-- 输出示例：
-- SEARCH TABLE users USING INDEX idx_users_email (email=?)

-- 详细执行计划
EXPLAIN SELECT * FROM users WHERE age > 25;
```

### 3.10.2 性能分析

```sql
-- 启用性能统计
PRAGMA vdbe_debug = ON;

-- 查看编译后的 SQL
EXPLAIN SELECT * FROM users WHERE age > 25;

-- 查看统计信息
PRAGMA table_info(users);
PRAGMA index_list(users);
PRAGMA index_info(idx_users_email);

-- 分析数据库
ANALYZE;

-- 查看统计信息
SELECT * FROM sqlite_stat1;
SELECT * FROM sqlite_stat4;
```

### 3.10.3 完整性检查

```sql
-- 快速检查
PRAGMA quick_check;

-- 完整检查
PRAGMA integrity_check;

-- 检查特定表
PRAGMA integrity_check(10);  -- 最多报告 10 个错误

-- 外键检查
PRAGMA foreign_key_check;
```

---

## 本章小结

- 窗口函数（3.25+）提供强大的分析查询能力
- 递归 CTE 可处理树形结构和生成序列
- FTS5 和 R*Tree 是强大的虚拟表扩展
- 内存数据库适合临时数据和高速缓存
- backup() API 提供在线备份功能
- 可创建用户定义函数和排序规则
- WAL 检查点控制日志文件大小
- SQLCipher 提供数据库加密
- EXPLAIN 和 ANALYZE 帮助优化查询
