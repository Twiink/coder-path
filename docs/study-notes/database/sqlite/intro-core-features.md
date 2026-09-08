---
title: "SQLite入门与核心特性"
aliases:
  - "SQLite入门"
  - "SQLite基础"
tags:
  - "后端"
  - "数据库"
  - "sqlite"
  - "嵌入式数据库"
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

# 01 SQLite 入门与核心特性

SQLite 是世界上部署最广泛的数据库引擎，嵌入在数十亿设备中（手机、浏览器、操作系统、应用）。它轻量、零配置、无需服务器，是本地存储、移动应用、桌面应用和小型项目的完美选择。

## 1.1 SQLite 简介

### 1.1.1 发展历程

```text
2000  D. Richard Hipp 开发 SQLite（最初用于海军项目）
2001  SQLite 1.0 发布
2004  SQLite 3.0（重大重构，引入类型亲和）
2015  SQLite 3.9.0（引入 JSON 扩展）
2018  SQLite 3.24.0（引入 UPSERT）
2020  SQLite 3.33.0（UPDATE FROM 语法）
2023  SQLite 3.43.0（引入 STRICT 表）
2024  SQLite 3.45.0（性能优化）
```

### 1.1.2 核心特性

| 特性 | 说明 |
|------|------|
| **零配置** | 无需安装、配置、管理服务器 |
| **无服务器** | 直接嵌入应用程序 |
| **单文件存储** | 整个数据库就是一个文件 |
| **跨平台** | 数据库文件可在不同 OS 间无缝迁移 |
| **自给自足** | 极少外部依赖 |
| **事务支持** | 完整 ACID 支持 |
| **小体积** | 核心引擎 < 600KB |
| **公共领域** | 无版权限制，可任意使用 |
| **广泛应用** | 部署在数十亿设备上 |

### 1.1.3 适用场景

```text
✅ 适合：
  · 移动应用（iOS、Android 内置）
  · 桌面应用（浏览器、邮件客户端）
  · 嵌入式设备（IoT、电视、汽车）
  · 本地开发/测试数据库
  · 小型网站（日访问 < 10 万）
  · 数据分析和临时数据处理
  · 教育和原型开发
  · 文件格式（如 .sqlite 配置文件）

❌ 不适合：
  · 高并发写入场景
  · 多用户同时写入
  · 超大数据量（TB 级）
  · 需要细粒度权限控制
  · 分布式系统
  · 客户端/服务器架构
```

### 1.1.4 SQLite vs 其他数据库

| 特性 | SQLite | MySQL | PostgreSQL | MongoDB |
|------|--------|-------|------------|---------|
| **部署方式** | 嵌入式 | C/S | C/S | C/S |
| **配置** | 零配置 | 需要配置 | 需要配置 | 需要配置 |
| **并发写入** | 单写 | 多写 | 多写 | 多写 |
| **并发读取** | 多读 | 多读 | 多读 | 多读 |
| **事务** | 完整 ACID | 完整 ACID | 完整 ACID | 4.0+ |
| **数据量上限** | 281TB | 无限制 | 无限制 | 无限制 |
| **权限控制** | 无 | 完整 | 完整 | 完整 |
| **学习曲线** | 低 | 中 | 高 | 中 |
| **适用场景** | 本地/嵌入式 | Web 应用 | 复杂查询 | 文档存储 |

## 1.2 安装与使用

### 1.2.1 各平台安装

**macOS**（系统自带）：
```bash
# 检查版本
sqlite3 --version

# 如需更新
brew install sqlite
```

**Linux（Ubuntu/Debian）**：
```bash
sudo apt update
sudo apt install sqlite3 libsqlite3-dev

# 验证
sqlite3 --version
```

**Linux（CentOS/RHEL）**：
```bash
sudo yum install sqlite sqlite-devel
```

**Windows**：
```text
1. 下载预编译二进制：https://www.sqlite.org/download.html
2. 下载 sqlite-tools-win32-*.zip
3. 解压，将 sqlite3.exe 加入 PATH
4. 命令行验证：sqlite3 --version
```

**Python**（内置）：
```python
import sqlite3
print(sqlite3.sqlite_version)
```

**Node.js**：
```bash
npm install sqlite3
# 或使用 better-sqlite3（同步 API，性能更好）
npm install better-sqlite3
```

### 1.2.2 命令行工具 sqlite3

```bash
# 创建/打开数据库
sqlite3 mydb.sqlite

# 常用点命令（以 . 开头）
.tables              # 列出所有表
.schema              # 显示表结构
.schema users        # 显示特定表结构
.headers on          # 显示列名
.mode column         # 列模式显示
.mode csv            # CSV 模式
.mode json           # JSON 模式
.width 20 30         # 设置列宽
.output result.txt   # 输出到文件
.output stdout       # 恢复输出到屏幕
.read script.sql     # 执行 SQL 脚本
.import data.csv users  # 导入 CSV
.dump                # 导出整个数据库 SQL
.backup backup.sqlite # 备份数据库
.quit                # 退出

# 示例
sqlite3 mydb.sqlite
sqlite> .headers on
sqlite> .mode column
sqlite> SELECT * FROM users;
```

## 1.3 核心架构

### 1.3.1 数据库文件结构

```text
SQLite 数据库文件结构：

┌─────────────────────────────┐
│  Database Header (100 bytes)│  ← 文件头信息
├─────────────────────────────┤
│  Page 1 (Master Table)      │  ← sqlite_master 表
├─────────────────────────────┤
│  Page 2                     │  ← 数据/索引页
├─────────────────────────────┤
│  Page 3                     │
├─────────────────────────────┤
│  ...                        │
├─────────────────────────────┤
│  Page N                     │
└─────────────────────────────┘

页面大小：512 - 65536 字节（默认 4096）
最大数据库：281 TB（理论值）
```

### 1.3.2 SQLite 类型系统

SQLite 使用**动态类型**和**类型亲和**（Type Affinity）：

**存储类型（Storage Classes）**：

| 类型 | 说明 |
|------|------|
| `NULL` | 空值 |
| `INTEGER` | 有符号整数（1-8 字节） |
| `REAL` | 8 字节 IEEE 浮点数 |
| `TEXT` | 文本字符串 |
| `BLOB` | 二进制数据 |

**类型亲和（Type Affinity）**：

```sql
-- 声明类型 → 亲和类型
INTEGER, INT, TINYINT, BIGINT    → INTEGER 亲和
TEXT, VARCHAR, CLOB              → TEXT 亲和
REAL, DOUBLE, FLOAT              → REAL 亲和
BLOB                             → BLOB 亲和（无亲和）
NUMERIC, DECIMAL, BOOLEAN        → NUMERIC 亲和

-- 示例
CREATE TABLE t (
    a INTEGER,  -- INTEGER 亲和，优先存为整数
    b TEXT,     -- TEXT 亲和，优先存为文本
    c REAL,     -- REAL 亲和，优先存为浮点
    d BLOB,     -- 无亲和，存什么都行
    e           -- 无声明，NUMERIC 亲和
);

-- SQLite 会尽量转换，但不会强制
INSERT INTO t VALUES ('123', 456, '7.89', 'hello', '2023-01-01');
-- a: '123' 转为 INTEGER 123
-- b: 456 转为 TEXT '456'
-- c: '7.89' 转为 REAL 7.89
-- d: 'hello' 保持 BLOB
-- e: '2023-01-01' 保持 TEXT
```

### 1.3.3 事务与锁机制

```text
SQLite 的锁机制（文件级别）：

UNLOCKED    → 无锁
SHARED      → 读锁（多个读锁可共存）
RESERVED    → 预留写锁（只有一个）
PENDING     → 等待写锁（阻止新读锁）
EXCLUSIVE   → 写锁（唯一，阻止所有其他锁）

读-读并发：✅ 多个读事务可同时存在
读-写并发：✅ 读写可并发（写不阻塞读）
写-写并发：❌ 只有一个写事务（串行）

并发写入限制：
  · SQLite 3.7+ 引入 WAL 模式，改善并发
  · WAL 模式下：读写完全并发，写写仍然串行
```

## 1.4 数据库操作

### 1.4.1 创建与打开数据库

```bash
# 命令行创建（如果不存在则创建）
sqlite3 mydb.sqlite

# Python 创建
import sqlite3
conn = sqlite3.connect('mydb.sqlite')
# 内存数据库
conn = sqlite3.connect(':memory:')
```

### 1.4.2 数据库文件管理

```bash
# 备份数据库
sqlite3 mydb.sqlite ".backup backup.sqlite"

# 恢复数据库
sqlite3 mydb.sqlite ".restore backup.sqlite"

# 导出 SQL
sqlite3 mydb.sqlite ".dump" > dump.sql

# 导入 SQL
sqlite3 newdb.sqlite < dump.sql

# 导出为 CSV
sqlite3 -header -csv mydb.sqlite "SELECT * FROM users;" > users.csv

# 从 CSV 导入
sqlite3 mydb.sqlite
sqlite> .mode csv
sqlite> .import users.csv users

# 检查数据库完整性
sqlite3 mydb.sqlite "PRAGMA integrity_check;"

# 压缩/清理数据库
sqlite3 mydb.sqlite "VACUUM;"
```

## 1.5 PRAGMA 命令

PRAGMA 是 SQLite 特有的命令，用于查询和修改数据库配置。

### 1.5.1 常用 PRAGMA

```sql
-- 查看/设置页面大小
PRAGMA page_size;
PRAGMA page_size = 8192;  -- 仅对新建数据库有效

-- 查看/设置缓存大小
PRAGMA cache_size;
PRAGMA cache_size = 10000;  -- 10000 页（约 40MB）

-- 查看/设置同步模式
PRAGMA synchronous;
-- 0 = OFF（最快，不安全）
-- 1 = NORMAL（平衡）
-- 2 = FULL（最安全，默认）
-- 3 = EXTRA（极安全）

-- 查看/设置日志模式
PRAGMA journal_mode;
-- delete = 删除日志（默认）
-- truncate = 截断日志
-- persist = 保留日志文件
-- memory = 内存日志
-- wal = Write-Ahead Logging（推荐）
-- off = 无日志（危险）

-- 启用 WAL 模式（推荐）
PRAGMA journal_mode = WAL;

-- 查看外键是否启用
PRAGMA foreign_keys;
PRAGMA foreign_keys = ON;  -- 启用外键约束（默认关闭！）

-- 查看表信息
PRAGMA table_info(users);
PRAGMA index_list(users);
PRAGMA foreign_key_list(orders);

-- 查看数据库信息
PRAGMA database_list;
PRAGMA schema_version;
PRAGMA user_version;  -- 用户自定义版本号

-- 性能调优
PRAGMA temp_store = MEMORY;  -- 临时表存内存
PRAGMA mmap_size = 268435456;  -- 内存映射 256MB
```

### 1.5.2 WAL 模式详解

```sql
-- 启用 WAL
PRAGMA journal_mode = WAL;

-- WAL 优势
-- ✅ 读写完全并发
-- ✅ 写性能提升（顺序写）
-- ✅ 读不阻塞写

-- WAL 文件
-- mydb.sqlite       主数据库文件
-- mydb.sqlite-wal   WAL 文件（写前日志）
-- mydb.sqlite-shm   共享内存文件

-- 检查点（将 WAL 内容合并到主文件）
PRAGMA wal_checkpoint;           -- PASSIVE（默认）
PRAGMA wal_checkpoint(TRUNCATE); -- TRUNCATE（截断 WAL）
PRAGMA wal_checkpoint(RESTART);  -- RESTART
PRAGMA wal_checkpoint(FULL);     -- FULL

-- 自动检查点阈值
PRAGMA wal_autocheckpoint = 1000;  -- 每 1000 页自动检查点
```

## 1.6 各语言使用示例

### 1.6.1 Python

```python
import sqlite3

# 连接数据库
conn = sqlite3.connect('mydb.sqlite')
conn.row_factory = sqlite3.Row  # 返回字典风格

# 创建表
conn.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        age INTEGER
    )
''')

# 插入数据
cursor = conn.execute(
    "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
    ('张三', 'zhang@example.com', 28)
)
user_id = cursor.lastrowid
conn.commit()

# 批量插入
users = [
    ('李四', 'li@example.com', 25),
    ('王五', 'wang@example.com', 30)
]
conn.executemany(
    "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
    users
)
conn.commit()

# 查询
cursor = conn.execute("SELECT * FROM users WHERE age > ?", (20,))
for row in cursor:
    print(dict(row))

# 使用上下文管理器（自动提交/回滚）
with conn:
    conn.execute("UPDATE users SET age = age + 1 WHERE name = ?", ('张三',))

conn.close()
```

### 1.6.2 Node.js（better-sqlite3）

```javascript
const Database = require('better-sqlite3');

// 打开数据库
const db = new Database('mydb.sqlite');

// 启用 WAL 模式
db.pragma('journal_mode = WAL');

// 创建表
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        age INTEGER
    )
`);

// 准备语句（性能更好）
const insert = db.prepare('INSERT INTO users (name, email, age) VALUES (?, ?, ?)');
const info = insert.run('张三', 'zhang@example.com', 28);
console.log('插入 ID:', info.lastInsertRowid);

// 批量插入（事务）
const insertMany = db.transaction((users) => {
    for (const user of users) {
        insert.run(user.name, user.email, user.age);
    }
});

insertMany([
    { name: '李四', email: 'li@example.com', age: 25 },
    { name: '王五', email: 'wang@example.com', age: 30 }
]);

// 查询
const select = db.prepare('SELECT * FROM users WHERE age > ?');
const users = select.all(20);
console.log(users);

// 关闭
db.close();
```

## 1.7 常见问题与最佳实践

### 1.7.1 启用外键约束

```sql
-- 外键约束默认关闭！必须显式启用
PRAGMA foreign_keys = ON;

-- 每个连接都需要设置（可在连接时设置）
-- Python
conn = sqlite3.connect('mydb.sqlite')
conn.execute("PRAGMA foreign_keys = ON")
```

### 1.7.2 并发写入优化

```sql
-- 启用 WAL 模式
PRAGMA journal_mode = WAL;

-- 增大忙等时间
PRAGMA busy_timeout = 5000;  -- 5 秒

-- Python 中设置
conn = sqlite3.connect('mydb.sqlite', timeout=5.0)
```

### 1.7.3 性能优化清单

```sql
-- 必做配置
PRAGMA journal_mode = WAL;           -- 改善并发
PRAGMA synchronous = NORMAL;         -- 平衡安全与性能
PRAGMA cache_size = -20000;          -- 20MB 缓存（负数表示 KB）
PRAGMA temp_store = MEMORY;          -- 临时数据存内存
PRAGMA foreign_keys = ON;            -- 启用外键

-- 批量操作使用事务
BEGIN;
INSERT INTO ...;
INSERT INTO ...;
COMMIT;

-- 使用预编译语句
-- 避免 SQL 注入，提升性能
```

### 1.7.4 最佳实践

1. **启用 WAL 模式**：提升并发性能
2. **使用事务**：批量操作快 100 倍以上
3. **启用外键**：`PRAGMA foreign_keys = ON`
4. **预编译语句**：防注入，提升性能
5. **设置 busy_timeout**：避免立即失败
6. **定期 VACUUM**：回收空间，优化性能
7. **定期备份**：使用 `.backup` 命令
8. **限制写入并发**：单写者模式或队列
9. **设置合理的 cache_size**：根据内存调整
10. **使用内存数据库**：临时数据、测试场景

---

## 本章小结

- SQLite 是嵌入式、零配置的数据库引擎
- 整个数据库就是一个文件，跨平台可移植
- 适合本地存储、移动应用、小型项目
- 使用动态类型和类型亲和
- WAL 模式显著改善并发性能
- 外键约束默认关闭，必须显式启用
- 批量操作必须使用事务
- 单文件最大 281TB，但实践中小于 1GB 更合适
