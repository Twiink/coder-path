---
title: "SQLite性能优化"
aliases:
  - "SQLite性能"
  - "SQLite优化"
tags:
  - "后端"
  - "数据库"
  - "sqlite"
  - "性能优化"
  - "笔记"
category: "后端"
folder: "SQLite"
parent: "[[目录]]"
related:
  - "[[后端/数据库/SQLite/SQLite高级特性]]"
  - "[[后端/数据库/SQLite/SQLite实战指南]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 04 SQLite 性能优化

SQLite 在正确的配置下可以达到非常优秀的性能。本章介绍关键的优化策略，包括 WAL 模式、事务批量操作、索引优化、PRAGMA 配置等。

## 4.1 WAL 模式详解

### 4.1.1 为什么要用 WAL

```text
默认 journal_mode=DELETE 的问题：
  · 写入时需要创建 rollback journal 文件
  · 写入期间会锁住整个数据库（EXCLUSIVE lock）
  · 读写互斥：写入时不能读，读时不能写

WAL (Write-Ahead Logging) 的优势：
  · 读写并发：读不阻塞写，写不阻塞读
  · 顺序写入：WAL 文件顺序追加，减少磁盘寻道
  · 更好的写入性能：减少 fsync 次数
  · 适合多读少写的场景
```

### 4.1.2 启用 WAL

```sql
-- 启用 WAL 模式
PRAGMA journal_mode = WAL;

-- 验证
PRAGMA journal_mode;  -- 应返回 'wal'

-- 注意：WAL 模式是持久的，设置一次即可
-- 但需要在每个新连接中确认
```

```python
import sqlite3

conn = sqlite3.connect('mydb.sqlite')
conn.execute('PRAGMA journal_mode=WAL')

# 验证
result = conn.execute('PRAGMA journal_mode').fetchone()
print(result)  # ('wal',)
```

### 4.1.3 WAL 检查点

```sql
-- 自动检查点（默认每 1000 页）
PRAGMA wal_autocheckpoint = 1000;

-- 手动检查点
PRAGMA wal_checkpoint;              -- PASSIVE（默认）
PRAGMA wal_checkpoint(TRUNCATE);    -- 截断 WAL 文件
```

### 4.1.4 WAL 模式下的并发

```python
import sqlite3
import threading

# WAL 模式下，读写可以并发
def writer():
    conn = sqlite3.connect('mydb.sqlite')
    conn.execute('PRAGMA journal_mode=WAL')
    for i in range(1000):
        conn.execute('INSERT INTO logs (message) VALUES (?)', (f'msg {i}',))
    conn.commit()

def reader():
    conn = sqlite3.connect('mydb.sqlite')
    conn.execute('PRAGMA journal_mode=WAL')
    while True:
        count = conn.execute('SELECT COUNT(*) FROM logs').fetchone()[0]
        print(f'Current count: {count}')
        if count >= 1000:
            break

# 读写可以同时进行
t1 = threading.Thread(target=writer)
t2 = threading.Thread(target=reader)
t1.start()
t2.start()
t1.join()
t2.join()
```

## 4.2 事务优化

### 4.2.1 批量操作必须用事务

```python
import sqlite3
import time

conn = sqlite3.connect('test.sqlite')
conn.execute('CREATE TABLE IF NOT EXISTS data (id INTEGER, value TEXT)')

# ❌ 不用事务：每行自动提交（极慢）
start = time.time()
for i in range(10000):
    conn.execute('INSERT INTO data VALUES (?, ?)', (i, f'value_{i}'))
print(f'Without transaction: {time.time() - start:.2f}s')  # ~10s

# ✅ 用事务：批量提交（快 100 倍以上）
start = time.time()
conn.execute('BEGIN')
for i in range(10000):
    conn.execute('INSERT INTO data VALUES (?, ?)', (i, f'value_{i}'))
conn.execute('COMMIT')
print(f'With transaction: {time.time() - start:.2f}s')  # ~0.05s

# ✅ 最佳：executemany + 事务
start = time.time()
data = [(i, f'value_{i}') for i in range(10000)]
conn.executemany('INSERT INTO data VALUES (?, ?)', data)
conn.commit()
print(f'With executemany: {time.time() - start:.2f}s')  # ~0.03s
```

### 4.2.2 事务粒度

```python
# ❌ 太小：每行一个事务
for row in data:
    with conn:
        conn.execute('INSERT INTO ...', row)

# ✅ 适中：批量一个事务
batch_size = 1000
for i in range(0, len(data), batch_size):
    batch = data[i:i+batch_size]
    with conn:
        conn.executemany('INSERT INTO ...', batch)

# ❌ 太大：所有数据一个事务（内存压力大）
with conn:
    conn.executemany('INSERT INTO ...', huge_data)  # 100 万行
```

## 4.3 PRAGMA 优化配置

### 4.3.1 关键 PRAGMA 设置

```python
import sqlite3

conn = sqlite3.connect('mydb.sqlite')

# === 必须设置 ===
conn.execute('PRAGMA journal_mode = WAL')          # 并发读写
conn.execute('PRAGMA synchronous = NORMAL')        # WAL 下用 NORMAL 即可
conn.execute('PRAGMA foreign_keys = ON')           # 外键约束

# === 性能优化 ===
conn.execute('PRAGMA cache_size = -20000')         # 20MB 缓存（负数=KB）
conn.execute('PRAGMA temp_store = MEMORY')         # 临时数据存内存
conn.execute('PRAGMA mmap_size = 268435456')       # 256MB 内存映射

# === 并发优化 ===
conn.execute('PRAGMA busy_timeout = 5000')         # 忙等 5 秒
conn.execute('PRAGMA wal_autocheckpoint = 1000')   # 自动检查点
```

### 4.3.2 synchronous 模式详解

| 模式 | 安全性 | 性能 | 适用场景 |
|------|--------|------|---------|
| `OFF` (0) | 最低 | 最快 | 临时数据、可丢失 |
| `NORMAL` (1) | 中等 | 快 | WAL 模式推荐 |
| `FULL` (2) | 高 | 慢 | 默认值，DELETE 模式推荐 |
| `EXTRA` (3) | 最高 | 最慢 | 极端安全要求 |

```sql
-- WAL 模式下，NORMAL 足够安全
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- DELETE 模式下，建议 FULL
PRAGMA journal_mode = DELETE;
PRAGMA synchronous = FULL;
```

### 4.3.3 缓存大小

```sql
-- 默认缓存大小（通常 2000 页 ≈ 8MB）
PRAGMA cache_size;

-- 设置缓存大小（正数=页数，负数=KB）
PRAGMA cache_size = 10000;    -- 10000 页
PRAGMA cache_size = -20000;   -- 20000 KB ≈ 20MB

-- 建议值
-- 小型应用：10-20MB
-- 中型应用：50-100MB
-- 大型应用：200-500MB（不超过可用内存的 25%）
```

### 4.3.4 内存映射 I/O

```sql
-- 启用内存映射（将数据库文件映射到内存）
PRAGMA mmap_size = 268435456;  -- 256MB

-- 优势：
-- · 减少系统调用开销
-- · 利用 OS 的页面缓存
-- · 读取性能提升 2-3 倍

-- 注意：
-- · 只影响读取，不影响写入
-- · 设置值应小于等于文件大小
-- · 0 表示禁用（默认）
```

## 4.4 索引优化

### 4.4.1 索引策略

```sql
-- 为频繁查询的列创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_city_age ON users(city, age);

-- 部分索引（只索引活跃用户）
CREATE INDEX idx_active_users ON users(email) WHERE is_active = 1;

-- 表达式索引
CREATE INDEX idx_users_lower_email ON users(LOWER(email));

-- 覆盖索引（避免回表）
CREATE INDEX idx_users_covering ON users(email, name, age);
-- SELECT name, age FROM users WHERE email = ? 可以直接从索引获取
```

### 4.4.2 索引维护

```sql
-- 定期分析（更新统计信息）
ANALYZE;

-- 重建索引
REINDEX;

-- 清理碎片
VACUUM;

-- 查看索引使用情况
SELECT * FROM sqlite_stat1;
SELECT * FROM sqlite_stat4;  -- 需要编译时启用
```

### 4.4.3 查询优化

```sql
-- 使用 EXPLAIN QUERY PLAN 检查查询
EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'test@example.com';
-- 期望输出：SEARCH TABLE users USING INDEX idx_users_email

-- 避免全表扫描
-- ❌ SELECT * FROM users WHERE LOWER(email) = 'test@example.com';
-- ✅ SELECT * FROM users WHERE email = 'test@example.com';

-- 使用覆盖索引
-- ✅ SELECT email, name FROM users WHERE email LIKE '%@gmail.com';
-- 如果 idx_users_covering 包含 email 和 name，不需要回表
```

## 4.5 并发优化

### 4.5.1 忙等超时

```python
# 设置忙等超时（毫秒）
conn = sqlite3.connect('mydb.sqlite', timeout=5.0)

# 或使用 PRAGMA
conn.execute('PRAGMA busy_timeout = 5000')
```

### 4.5.2 自定义忙等处理

```python
import sqlite3
import time

def busy_handler(retries):
    """自定义忙等处理"""
    if retries < 3:
        time.sleep(0.1 * (retries + 1))  # 递增等待
        return True  # 重试
    return False  # 放弃

conn = sqlite3.connect('mydb.sqlite')
conn.set_busy_handler(busy_handler)
```

### 4.5.3 写队列模式

```python
import sqlite3
import threading
import queue

class SQLiteWriter:
    """单写者模式：所有写操作通过队列串行化"""
    
    def __init__(self, db_path):
        self.conn = sqlite3.connect(db_path)
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.queue = queue.Queue()
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()
    
    def _worker(self):
        while True:
            sql, params, future = self.queue.get()
            try:
                cursor = self.conn.execute(sql, params)
                self.conn.commit()
                future['result'] = cursor.lastrowid
            except Exception as e:
                future['error'] = e
    
    def execute(self, sql, params=()):
        future = {}
        self.queue.put((sql, params, future))
        # 等待结果（简单实现，生产环境用 concurrent.futures）
        while 'result' not in future and 'error' not in future:
            time.sleep(0.001)
        if 'error' in future:
            raise future['error']
        return future['result']

# 使用
writer = SQLiteWriter('mydb.sqlite')
user_id = writer.execute(
    'INSERT INTO users (name, email) VALUES (?, ?)',
    ('Alice', 'alice@example.com')
)
```

## 4.6 数据导入优化

### 6.6.1 批量导入

```python
import sqlite3
import csv

conn = sqlite3.connect('mydb.sqlite')
conn.execute('PRAGMA journal_mode=WAL')
conn.execute('PRAGMA synchronous=OFF')  # 导入时关闭同步
conn.execute('PRAGMA cache_size=-100000')  # 100MB 缓存

# 创建表
conn.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT,
        price REAL
    )
''')

# 批量导入
with open('products.csv', 'r') as f:
    reader = csv.reader(f)
    next(reader)  # 跳过表头
    
    # 使用事务 + executemany
    batch = []
    for i, row in enumerate(reader):
        batch.append(row)
        if len(batch) >= 10000:
            conn.executemany(
                'INSERT INTO products (name, price) VALUES (?, ?)',
                batch
            )
            batch = []
    
    # 剩余数据
    if batch:
        conn.executemany(
            'INSERT INTO products (name, price) VALUES (?, ?)',
            batch
        )

conn.commit()

# 导入后恢复设置
conn.execute('PRAGMA synchronous=NORMAL')

# 创建索引
conn.execute('CREATE INDEX idx_products_name ON products(name)')

# 分析
conn.execute('ANALYZE')

conn.close()
```

## 4.7 VACUUM 与碎片整理

### 4.7.1 何时需要 VACUUM

```text
需要 VACUUM 的情况：
  · 大量删除数据后
  · 表结构修改后（如删除列）
  · 数据库文件明显大于实际数据
  · 定期维护（如每周一次）

VACUUM 的作用：
  · 回收未使用的空间
  · 重建数据库文件
  · 优化页面布局
  · 减少文件大小
```

### 4.7.2 执行 VACUUM

```sql
-- VACUUM 整个数据库
VACUUM;

-- VACUUM 到指定文件（备份 + 压缩）
VACUUM INTO 'backup.sqlite';
```

```python
# Python 中执行
conn.execute('VACUUM')

# 或备份到文件
conn.execute("VACUUM INTO 'backup.sqlite'")
```

### 4.7.3 自动 VACUUM

```sql
-- 启用自动 VACUUM（每次 COMMIT 后自动清理）
PRAGMA auto_vacuum = INCREMENTAL;

-- 或完全自动 VACUUM（重建数据库）
PRAGMA auto_vacuum = FULL;

-- 增量 VACUUM（推荐）
PRAGMA incremental_vacuum;
```

## 4.8 性能基准测试

### 4.8.1 简单基准测试

```python
import sqlite3
import time

def benchmark():
    conn = sqlite3.connect(':memory:')
    
    # 创建表
    conn.execute('''
        CREATE TABLE test (
            id INTEGER PRIMARY KEY,
            value TEXT,
            number REAL
        )
    ''')
    
    # 测试 1：批量插入
    start = time.time()
    data = [(i, f'value_{i}', i * 1.5) for i in range(100000)]
    conn.executemany('INSERT INTO test VALUES (?, ?, ?)', data)
    conn.commit()
    insert_time = time.time() - start
    
    # 测试 2：索引查询
    conn.execute('CREATE INDEX idx_value ON test(value)')
    start = time.time()
    for i in range(1000):
        conn.execute('SELECT * FROM test WHERE value = ?', (f'value_{i}',))
    index_time = time.time() - start
    
    # 测试 3：全表扫描
    start = time.time()
    conn.execute('SELECT * FROM test WHERE number > 50000').fetchall()
    scan_time = time.time() - start
    
    # 测试 4：聚合查询
    start = time.time()
    conn.execute('SELECT AVG(number), MAX(number), MIN(number) FROM test').fetchone()
    agg_time = time.time() - start
    
    print(f'Insert 100K rows: {insert_time:.3f}s')
    print(f'1000 index queries: {index_time:.3f}s')
    print(f'Full table scan: {scan_time:.3f}s')
    print(f'Aggregation: {agg_time:.3f}s')
    
    conn.close()

benchmark()
```

### 4.8.2 性能对比

```text
典型性能数据（SQLite 3.39，SSD）：

操作                     耗时
─────────────────────────────────
单行插入（事务内）      0.001ms
批量插入 10万行         0.3s
索引查询                0.01ms
全表扫描 10万行         10-50ms
JOIN 两表（索引）       0.1ms
聚合查询 10万行         5-20ms
```

## 4.9 性能优化清单

### 4.9.1 必做优化

| 优化项 | 设置 | 预期提升 |
|--------|------|---------|
| WAL 模式 | `journal_mode=WAL` | 并发读写 |
| 同步模式 | `synchronous=NORMAL` | 写入 2-3x |
| 缓存大小 | `cache_size=-20000` | 读取 1.5x |
| 事务批量 | `BEGIN...COMMIT` | 写入 100x+ |
| 预编译语句 | `prepare()` | 查询 1.2x |

### 4.9.2 可选优化

| 优化项 | 设置 | 适用场景 |
|--------|------|---------|
| 内存映射 | `mmap_size=256MB` | 读多写少 |
| 临时存储 | `temp_store=MEMORY` | 复杂查询 |
| 忙等超时 | `busy_timeout=5000` | 并发场景 |
| 自动检查点 | `wal_autocheckpoint=1000` | WAL 模式 |

### 4.9.3 完整配置模板

```python
import sqlite3

def get_optimized_connection(db_path=':memory:'):
    """获取优化配置的 SQLite 连接"""
    conn = sqlite3.connect(db_path)
    
    # 核心配置
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('PRAGMA synchronous = NORMAL')
    conn.execute('PRAGMA foreign_keys = ON')
    
    # 性能配置
    conn.execute('PRAGMA cache_size = -20000')      # 20MB
    conn.execute('PRAGMA temp_store = MEMORY')
    conn.execute('PRAGMA mmap_size = 268435456')    # 256MB
    
    # 并发配置
    conn.execute('PRAGMA busy_timeout = 5000')
    conn.execute('PRAGMA wal_autocheckpoint = 1000')
    
    # 行工厂（方便访问）
    conn.row_factory = sqlite3.Row
    
    return conn

# 使用
conn = get_optimized_connection('mydb.sqlite')
```

---

## 本章小结

- WAL 模式是性能优化的第一步，启用读写并发
- 批量操作必须使用事务，性能提升 100 倍以上
- `synchronous=NORMAL` 在 WAL 模式下足够安全
- 合理的缓存大小（20-100MB）提升读取性能
- 内存映射 I/O 可提升读取 2-3 倍
- 定期 VACUUM 回收空间
- 使用预编译语句和 executemany 提升性能
- 单写者模式避免写入冲突
