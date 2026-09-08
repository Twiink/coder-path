---
title: "PostgreSQL入门与安装配置"
aliases:
  - "PostgreSQL入门"
  - "PostgreSQL安装"
  - "Postgres"
tags:
  - "后端"
  - "数据库"
  - "postgresql"
  - "笔记"
category: "后端"
folder: "PostgreSQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/PostgreSQL/PostgreSQL数据类型与表设计]]"
  - "[[后端/数据库/PostgreSQL/PostgreSQL高级特性]]"
  - "[[后端/数据库/MySQL/MySQL入门与安装配置]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 01 PostgreSQL 入门与安装配置

PostgreSQL（简称 Postgres）是 1996 年由加州大学伯克利分校开发的**开源对象关系型数据库**。它以**标准兼容性、扩展性、稳定性**著称，被誉为"最先进的开源关系型数据库"。

## 1.1 PostgreSQL 简介

### 1.1.1 发展历程

```text
1986  Ingres 项目（伯克利）
1987  POSTGRES 项目启动（Michael Stonebraker 领导）
1995  Postgres95（加入 SQL 支持）
1996  更名为 PostgreSQL（版本号从 6.0 开始）
2005  PostgreSQL 8.0（首次原生支持 Windows）
2010  PostgreSQL 9.0（流复制、窗口函数）
2017  PostgreSQL 10（逻辑复制、声明式分区）
2019  PostgreSQL 12（性能大幅提升）
2022  PostgreSQL 15（MERGE 语句、行级安全增强）
2024  PostgreSQL 17（增量备份、JSON 增强）
```

### 1.1.2 核心特性

| 特性 | 说明 |
|------|------|
| **ACID 事务** | 完整支持原子性、一致性、隔离性、持久性 |
| **MVCC** | 多版本并发控制，读写不冲突 |
| **丰富的数据类型** | JSON/JSONB、数组、范围类型、几何类型、网络类型等 |
| **高级索引** | B-tree、Hash、GiST、SP-GiST、GIN、BRIN |
| **可扩展性** | 自定义类型、函数、操作符、聚合、索引方法 |
| **标准兼容** | 高度遵循 SQL 标准（SQL:2016） |
| **复制与高可用** | 流复制、逻辑复制、热备 |
| **全文搜索** | 内置全文搜索引擎 |
| **地理信息** | PostGIS 扩展（GIS 领域标准） |
| **多语言函数** | PL/pgSQL、PL/Python、PL/Perl、PL/Java 等 |

### 1.1.3 适用场景

```text
✅ 适合：
  · 复杂查询与数据分析（OLAP）
  · 需要强一致性的金融系统
  · 地理信息系统（PostGIS）
  · JSON 文档存储（替代 MongoDB 的部分场景）
  · 全文搜索（中小规模）
  · 需要高级数据类型（数组、范围、网络地址）
  · 需要复杂约束与触发器

❌ 不适合：
  · 超高并发简单读写（Redis/MySQL 更合适）
  · 大规模分布式场景（CockroachDB/TiDB 更合适）
  · 纯文档存储（MongoDB 更灵活）
```

### 1.1.4 PostgreSQL vs MySQL

| 维度 | PostgreSQL | MySQL |
|------|-----------|-------|
| **定位** | 对象关系型，功能丰富 | 关系型，简单易用 |
| **SQL 标准** | 高度遵循 | 部分遵循 |
| **事务** | 完整 ACID，MVCC | InnoDB 支持 ACID |
| **数据类型** | 丰富（JSONB、数组、范围等） | 基础类型 |
| **索引** | 6 种索引类型 | 主要 B-tree |
| **JSON** | JSONB（二进制，可索引） | JSON（文本，有限索引） |
| **并发** | MVCC，读写不冲突 | InnoDB MVCC，但有 gap lock |
| **扩展** | 强（自定义类型/函数/索引） | 弱 |
| **学习曲线** | 陡峭 | 平缓 |
| **生态** | 企业级、科研、GIS | Web 应用、互联网 |
| **性能** | 复杂查询优，简单查询略慢 | 简单查询快 |

## 1.2 安装 PostgreSQL

### 1.2.1 macOS

```bash
# 方式一：Homebrew（推荐）
brew install postgresql@15

# 启动服务
brew services start postgresql@15

# 验证
psql --version
createdb testdb
psql testdb -c "SELECT version();"

# 方式二：Postgres.app（图形化）
# 下载 https://postgresapp.com/
```

### 1.2.2 Linux（Ubuntu/Debian）

```bash
# 添加官方仓库
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# 安装
sudo apt update
sudo apt install postgresql-15

# 启动
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 验证
sudo -u postgres psql -c "SELECT version();"
```

### 1.2.3 Linux（CentOS/RHEL）

```bash
# 安装仓库
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# 安装
sudo dnf install -y postgresql15-server

# 初始化数据库
sudo /usr/pgsql-15/bin/postgresql-15-setup initdb

# 启动
sudo systemctl start postgresql-15
sudo systemctl enable postgresql-15

# 验证
sudo -u postgres psql -c "SELECT version();"
```

### 1.2.4 Docker

```bash
# 启动容器
docker run --name postgres15 \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=mydb \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  -d postgres:15

# 连接
docker exec -it postgres15 psql -U postgres -d mydb
```

### 1.2.5 Windows

```text
1. 下载安装包：https://www.postgresql.org/download/windows/
2. 运行安装程序（EDB Installer）
3. 设置超级用户密码
4. 选择端口（默认 5432）
5. 选择区域（Chinese, China）
6. 完成安装

可选安装 pgAdmin（图形化管理工具）
```

## 1.3 基本操作

### 1.3.1 psql 命令行工具

```bash
# 连接数据库
psql -U postgres -d mydb -h localhost -p 5432

# 常用参数
-U username    # 用户名
-d database    # 数据库名
-h host        # 主机地址
-p port        # 端口
-W             # 强制提示密码

# psql 内部命令（以 \ 开头）
\l             # 列出所有数据库
\c dbname      # 切换数据库
\dt            # 列出当前数据库的所有表
\d table_name  # 查看表结构
\di            # 列出所有索引
\ds            # 列出所有序列
\dv            # 列出所有视图
\df            # 列出所有函数
\du            # 列出所有用户
\dn            # 列出所有 schema
\q             # 退出
\?             # 帮助
\h SQL_COMMAND # SQL 命令帮助（如 \h SELECT）

# 输出控制
\timing on     # 显示命令执行时间
\x on          # 扩展显示模式（垂直显示）
\pset pager off # 关闭分页
```

### 1.3.2 数据库管理

```sql
-- 创建数据库
CREATE DATABASE mydb
  WITH OWNER = postgres
  ENCODING = 'UTF8'
  LC_COLLATE = 'zh_CN.UTF-8'
  LC_CTYPE = 'zh_CN.UTF-8'
  TEMPLATE = template0;

-- 查看数据库列表
\l
-- 或
SELECT datname FROM pg_database WHERE datistemplate = false;

-- 切换数据库
\c mydb

-- 删除数据库（不能删除当前连接的数据库）
DROP DATABASE mydb;

-- 修改数据库
ALTER DATABASE mydb RENAME TO newdb;
ALTER DATABASE newdb OWNER TO newowner;
```

### 1.3.3 Schema（模式）

PostgreSQL 使用 Schema 组织数据库对象（类似文件夹）。

```sql
-- 创建 schema
CREATE schema myschema;

-- 查看 schema 列表
\dn
-- 或
SELECT schema_name FROM information_schema.schemata;

-- 在 schema 中创建表
CREATE TABLE myschema.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100)
);

-- 设置搜索路径（默认 public）
SET search_path TO myschema, public;

-- 查看当前搜索路径
SHOW search_path;

-- 删除 schema（CASCADE 删除所有对象）
DROP schema myschema CASCADE;
```

**默认 Schema**：
- `public`：默认 schema，所有用户可访问
- `pg_catalog`：系统表
- `information_schema`：SQL 标准信息视图

### 1.3.4 用户与权限

```sql
-- 创建用户（角色）
CREATE USER myuser WITH PASSWORD 'mypassword';
-- 或
CREATE ROLE myuser WITH LOGIN PASSWORD 'mypassword';

-- 查看用户列表
\du

-- 授予权限
-- 连接数据库
GRANT CONNECT ON DATABASE mydb TO myuser;

-- 使用 schema
GRANT USAGE ON schema public TO myuser;

-- 查询表
GRANT SELECT ON ALL TABLES IN schema public TO myuser;

-- 插入/更新/删除
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN schema public TO myuser;

-- 所有权限
GRANT ALL PRIVILEGES ON ALL TABLES IN schema public TO myuser;

-- 设置默认权限（未来创建的表）
ALTER DEFAULT PRIVILEGES IN schema public
  GRANT SELECT ON TABLES TO myuser;

-- 撤销权限
REVOKE ALL PRIVILEGES ON ALL TABLES IN schema public FROM myuser;

-- 删除用户
DROP USER myuser;
```

### 1.3.5 表的基本操作

```sql
-- 创建表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    age INTEGER CHECK (age >= 0 AND age <= 150),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 查看表结构
\d users

-- 添加列
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- 删除列
ALTER TABLE users DROP COLUMN phone;

-- 修改列类型
ALTER TABLE users ALTER COLUMN age TYPE SMALLINT;

-- 重命名列
ALTER TABLE users RENAME COLUMN username TO user_name;

-- 添加约束
ALTER TABLE users ADD CONSTRAINT chk_email CHECK (email LIKE '%@%');

-- 删除约束
ALTER TABLE users DROP CONSTRAINT chk_email;

-- 重命名表
ALTER TABLE users RENAME TO accounts;

-- 删除表
DROP TABLE users;
DROP TABLE users CASCADE;  -- 同时删除依赖对象
```

## 1.4 配置文件

### 1.4.1 配置文件位置

```bash
# 查找配置文件位置
psql -c "SHOW config_file;"
# 通常在 /etc/postgresql/15/main/postgresql.conf

# 其他配置文件
# pg_hba.conf    # 客户端认证配置
# pg_ident.conf  # 用户名映射
```

### 1.4.2 postgresql.conf 核心参数

```ini
# 连接设置
listen_addresses = '*'          # 监听地址（* 表示所有）
port = 5432                     # 端口
max_connections = 100           # 最大连接数

# 内存设置
shared_buffers = 128MB          # 共享缓冲区（建议 25% 内存）
effective_cache_size = 4GB      # 有效缓存大小（建议 75% 内存）
work_mem = 4MB                  # 每个排序/哈希操作的内存
maintenance_work_mem = 64MB     # 维护操作内存（VACUUM、CREATE INDEX）

# WAL（预写日志）
wal_level = replica             # WAL 级别（minimal/replica/logical）
max_wal_size = 1GB              # WAL 最大大小
min_wal_size = 80MB             # WAL 最小大小
checkpoint_completion_target = 0.9  # 检查点完成目标

# 查询规划
random_page_cost = 1.1          # 随机读成本（SSD 设为 1.1，HDD 设为 4.0）
effective_io_concurrency = 200  # IO 并发数（SSD 设为 200）

# 日志
logging_collector = on          # 启用日志收集
log_directory = 'log'           # 日志目录
log_filename = 'postgresql-%Y-%m-%d.log'
log_statement = 'ddl'           # 记录 DDL 语句（none/ddl/mod/all）
log_min_duration_statement = 1000  # 记录超过 1 秒的查询

# 自动清理
autovacuum = on                 # 启用自动清理
autovacuum_max_workers = 3      # 最大清理工作进程数
```

### 1.4.3 pg_hba.conf（客户端认证）

```text
# 格式：TYPE  DATABASE  USER  ADDRESS  METHOD

# 本地连接（Unix 域套接字）
local   all   all   peer

# IPv4 本地连接
host    all   all   127.0.0.1/32   scram-sha-256

# IPv6 本地连接
host    all   all   ::1/128        scram-sha-256

# 允许特定网段
host    mydb  myuser  192.168.1.0/24  scram-sha-256

# 拒绝所有其他连接
host    all   all   0.0.0.0/0   reject

# 认证方法
# trust        # 无条件允许（危险！）
# reject       # 拒绝
# scram-sha-256  # SCRAM-SHA-256 密码认证（推荐）
# md5          # MD5 密码认证（旧）
# peer         # 操作系统用户匹配
# ident        # 操作系统用户匹配（TCP/IP）
# cert         # SSL 证书认证
```

```bash
# 修改后重新加载配置
sudo systemctl reload postgresql
# 或
psql -c "SELECT pg_reload_conf();"
```

### 1.4.4 查看与修改配置

```sql
-- 查看配置
SHOW shared_buffers;
SHOW max_connections;

-- 查看所有配置
SELECT name, setting, unit, context
FROM pg_settings
ORDER BY name;

-- 修改配置（需要重启）
ALTER SYSTEM SET shared_buffers = '256MB';
-- 修改后需要重启 PostgreSQL

-- 修改配置（立即生效）
SET work_mem = '16MB';  -- 仅当前会话
ALTER DATABASE mydb SET work_mem = '16MB';  -- 指定数据库
ALTER ROLE myuser SET work_mem = '16MB';  -- 指定用户
```

## 1.5 备份与恢复

### 1.5.1 pg_dump（逻辑备份）

```bash
# 备份单个数据库
pg_dump -U postgres mydb > mydb_backup.sql

# 备份为自定义格式（推荐，支持并行恢复）
pg_dump -U postgres -Fc mydb > mydb_backup.dump

# 备份为目录格式（支持并行）
pg_dump -U postgres -Fd -j 4 mydb -f mydb_backup_dir/

# 只备份数据（不含结构）
pg_dump -U postgres --data-only mydb > mydb_data.sql

# 只备份结构（不含数据）
pg_dump -U postgres --schema-only mydb > mydb_schema.sql

# 备份特定表
pg_dump -U postgres -t users -t orders mydb > tables_backup.sql

# 压缩备份
pg_dump -U postgres -Fc -Z 9 mydb > mydb_backup.dump.gz
```

### 1.5.2 pg_dumpall（全库备份）

```bash
# 备份所有数据库
pg_dumpall -U postgres > all_databases.sql

# 只备份全局对象（用户、角色、表空间）
pg_dumpall -U postgres --globals-only > globals.sql
```

### 1.5.3 恢复数据

```bash
# 恢复 SQL 格式
psql -U postgres mydb < mydb_backup.sql

# 恢复自定义格式
pg_restore -U postgres -d mydb mydb_backup.dump

# 恢复目录格式（并行）
pg_restore -U postgres -d mydb -j 4 mydb_backup_dir/

# 恢复时创建数据库
pg_restore -U postgres -C -d postgres mydb_backup.dump

# 恢复特定表
pg_restore -U postgres -d mydb -t users mydb_backup.dump
```

### 1.5.4 备份策略

```bash
#!/bin/bash
# daily_backup.sh

BACKUP_DIR="/backup/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份所有数据库
pg_dumpall -U postgres | gzip > $BACKUP_DIR/all_dbs_$DATE.sql.gz

# 备份单个数据库（自定义格式）
pg_dump -U postgres -Fc mydb > $BACKUP_DIR/mydb_$DATE.dump

# 删除旧备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

```bash
# 添加到 crontab
# 每天凌晨 2 点执行备份
0 2 * * * /path/to/daily_backup.sh >> /var/log/pg_backup.log 2>&1
```

## 1.6 监控与性能

### 1.6.1 查看数据库状态

```sql
-- 查看数据库大小
SELECT pg_size_pretty(pg_database_size('mydb'));

-- 查看所有数据库大小
SELECT datname, pg_size_pretty(pg_database_size(datname))
FROM pg_database
ORDER BY pg_database_size(datname) DESC;

-- 查看表大小
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- 查看索引大小
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- 查看连接数
SELECT count(*) FROM pg_stat_activity;

-- 查看当前查询
SELECT pid, usename, state, query, query_start
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY query_start DESC;

-- 终止长时间运行的查询
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
  AND query_start < NOW() - INTERVAL '5 minutes';
```

### 1.6.2 性能监控视图

```sql
-- 表统计信息
SELECT
    schemaname,
    relname,
    seq_scan,        -- 顺序扫描次数
    seq_tup_read,    -- 顺序扫描读取的行数
    idx_scan,        -- 索引扫描次数
    idx_tup_fetch,   -- 索引扫描获取的行数
    n_tup_ins,       -- 插入行数
    n_tup_upd,       -- 更新行数
    n_tup_del        -- 删除行数
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;

-- 索引使用情况
SELECT
    schemaname,
    relname,
    indexrelname,
    idx_scan,        -- 索引扫描次数
    idx_tup_read,    -- 索引扫描读取的行数
    idx_tup_fetch    -- 索引扫描获取的行数
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 慢查询（需要开启 pg_stat_statements 扩展）
CREATE EXTENSION pg_stat_statements;

SELECT
    query,
    calls,
    total_time / 1000 AS total_seconds,
    mean_time / 1000 AS avg_seconds,
    rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

## 1.7 常见问题与最佳实践

### 1.7.1 连接数过多

```sql
-- 查看当前连接数
SELECT count(*) FROM pg_stat_activity;

-- 查看最大连接数
SHOW max_connections;

-- 解决方案 1：增加连接数（需要重启）
ALTER SYSTEM SET max_connections = 200;

-- 解决方案 2：使用连接池（PgBouncer）
# 安装 PgBouncer
sudo apt install pgbouncer

# 配置 /etc/pgbouncer/pgbouncer.ini
[databases]
mydb = host=localhost dbname=mydb

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

### 1.7.2 表膨胀（Bloat）

```sql
-- 查看表膨胀
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    n_dead_tup,  -- 死元组数
    n_live_tup   -- 活元组数
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;

-- 手动 VACUUM
VACUUM users;              -- 普通清理
VACUUM FULL users;         -- 完全重建表（会锁表）
VACUUM ANALYZE users;      -- 清理 + 更新统计信息

-- 配置自动清理
ALTER TABLE users SET (autovacuum_enabled = true);
ALTER TABLE users SET (autovacuum_vacuum_threshold = 50);
ALTER TABLE users SET (autovacuum_analyze_threshold = 50);
```

### 1.7.3 最佳实践清单

1. **使用连接池**：避免频繁创建/销毁连接
2. **合理设置 work_mem**：避免排序溢出到磁盘
3. **定期 VACUUM ANALYZE**：保持统计信息准确
4. **使用 prepared statements**：减少查询解析开销
5. **批量插入**：使用 COPY 或批量 INSERT
6. **避免 SELECT ***：只查询需要的列
7. **使用 EXPLAIN ANALYZE**：分析查询计划
8. **监控慢查询**：开启 log_min_duration_statement
9. **定期备份**：测试恢复流程
10. **使用合适的索引**：避免全表扫描

---

## 本章小结

- PostgreSQL 是功能最丰富的开源关系型数据库，适合复杂查询、数据分析、GIS 场景
- 与 MySQL 相比，PostgreSQL 在 SQL 标准兼容、数据类型、扩展性方面更优
- 安装方式：Homebrew（macOS）、apt/yum（Linux）、Docker、Windows 安装包
- 核心工具：psql（命令行）、pgAdmin（图形化）
- 配置文件：postgresql.conf（性能参数）、pg_hba.conf（认证配置）
- 备份工具：pg_dump（单库）、pg_dumpall（全库）、pg_restore（恢复）
- 监控要点：连接数、表膨胀、慢查询、索引使用情况
