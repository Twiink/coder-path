---
title: "MySQL入门与安装配置"
aliases:
  - "MySQL入门"
  - "MySQL安装"
tags:
  - "后端"
  - "数据库"
  - "mysql"
  - "笔记"
category: "后端"
folder: "MySQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MySQL/数据类型与表设计]]"
  - "[[后端/数据库/MySQL/SQL基础]]"
  - "[[后端/数据库/Redis/Redis入门与安装配置]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 01 MySQL 入门与安装配置

MySQL 是 1995 年由瑞典 MySQL AB 公司发布的关系型数据库,现属 Oracle 公司。它以开源、轻量、生态成熟成为全球使用最广的关系型数据库,也是国内后端岗位的默认数据库。

**官方资源:** 官网 https://www.mysql.com ;文档 https://dev.mysql.com/doc/ ;中文文档 https://dev.mysql.com/doc/refman/8.0/en/

本章覆盖:MySQL 定位与架构、版本选择、安装与启动、客户端连接、配置文件、用户与权限管理。

## 1.1 MySQL 是什么

MySQL 是一个**关系型数据库管理系统(RDBMS)**:数据按行和列组织成表,表与表之间通过外键关联,用 SQL 语言操作。

**核心特点:**

| 特点 | 说明 |
| --- | --- |
| 开源免费 | Community 版遵循 GPL,可商用;另有收费的 Enterprise/Cloud 版 |
| 存储引擎可插拔 | InnoDB(默认)、MyISAM、Memory 等,不同引擎不同特性 |
| 跨平台 | Windows / Linux / macOS 均可运行 |
| 生态成熟 | 各语言驱动齐全,周边工具(备份、监控、分库分表)丰富 |
| 性能可观 | InnoDB 单机可达数万 QPS,配合索引与调优支撑大多数业务 |

**适用场景:** 电商订单、用户系统、内容管理、后台管理等**需要强一致性与事务保证**的 OLTP(在线事务处理)业务。

**不适用场景:** 超大文本搜索(用 Elasticsearch)、海量日志分析(用 ClickHouse)、灵活文档结构(用 MongoDB)、高频缓存(用 Redis)。

### 与其他数据库的定位对比

| | MySQL | PostgreSQL | SQLite | MongoDB |
| --- | --- | --- | --- | --- |
| 类型 | 关系型 | 关系型 | 嵌入式关系型 | 文档型 |
| 部署 | C/S 独立服务 | C/S 独立服务 | 单文件库,无服务 | C/S 独立服务 |
| 事务 | 完整 ACID(InnoDB) | 完整 ACID | 完整 ACID | 4.0+ 支持多文档事务 |
| 强项 | 简单读写性能、生态 | 复杂查询、扩展性、JSON | 零配置、本地存储 | Schema 灵活、水平扩展 |
| 典型场景 | 互联网业务主库 | 数据分析、地理信息 | 移动端、桌面端、测试 | 内容管理、用户画像 |

**选型建议:** 互联网业务主库优先 MySQL(团队熟悉度高、资料多);需要复杂查询、窗口函数、GIS、JSONB 深度支持时选 PostgreSQL;本地开发/测试/单机小应用用 SQLite;数据结构不固定、需要水平扩展时用 MongoDB。

## 1.2 MySQL 架构

MySQL 采用**分层架构**,这是理解其行为的基础:

```text
客户端(JDBC/PyMySQL/mysql-cli)
        ↓ TCP 3306
┌───────────────────────────────────┐
│ 连接层:连接管理、认证授权、线程池     │
├───────────────────────────────────┤
│ 服务层(SQL Layer)                  │
│  · 解析器 Parser:SQL → 解析树      │
│  · 预处理器:检查表/列是否存在        │
│  · 优化器 Optimizer:生成执行计划    │
│  · 执行器 Executor:调用存储引擎接口  │
├───────────────────────────────────┤
│ 存储引擎层(Storage Engine)          │
│  · InnoDB(默认)/ MyISAM / Memory   │
│  · 负责数据的存储与提取              │
└───────────────────────────────────┘
        ↓
   数据文件(.ibd / .MYD)、日志文件
```

**一条 SQL 的完整执行流程:**

1. 客户端发送 `SELECT * FROM user WHERE id = 1`
2. **连接器**校验用户名密码与权限(权限在连接时一次性读取,之后改权限需重连)
3. **解析器**做词法分析(拆出关键字、表名、列名)与语法分析(检查是否合法)
4. **优化器**决定用哪个索引、多表 join 顺序,生成执行计划
5. **执行器**先检查表权限,再按执行计划循环调用存储引擎接口取数据
6. 存储引擎返回结果,执行器汇总后回传客户端

> **MySQL 8.0 移除了查询缓存(Query Cache)。** 原因是缓存粒度太粗:任何一次表更新都会清空该表所有缓存,写多读少场景下反而降低性能。5.7 及以前版本可通过 `query_cache_type` 控制,8.0 起该参数已不存在。

### 存储引擎对比

| 特性 | InnoDB(默认) | MyISAM | Memory |
| --- | --- | --- | --- |
| 事务支持 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |
| 行级锁 | ✅ 支持 | ❌ 仅表锁 | ❌ 仅表锁 |
| 外键 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |
| 崩溃恢复 | ✅ redo log 保证 | ❌ 易损坏 | ❌ 重启丢数据 |
| MVCC | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |
| 存储方式 | 聚簇索引(数据与主键索引在一起) | 非聚簇(索引与数据分离) | 内存哈希表 |
| COUNT(*) | 需扫描(带 where 时) | 直接读存储的总数 | 直接读 |
| 全文索引 | 5.6+ 支持 | 支持 | ❌ |
| 适用场景 | 绝大多数业务表 | 只读报表、归档 | 临时表、会话缓存 |

```sql
-- 查看当前默认引擎
SHOW ENGINES;
SHOW VARIABLES LIKE 'default_storage_engine';

-- 建表时指定引擎
CREATE TABLE logs (id INT) ENGINE=MyISAM;

-- 修改已有表的引擎(会重建表,大表慎用)
ALTER TABLE logs ENGINE=InnoDB;
```

> **生产环境一律用 InnoDB。** MyISAM 无事务、崩溃易损坏,只在纯读的历史归档表中偶有使用;Memory 重启即丢数据,只适合临时中间结果。

## 1.3 版本选择

| 版本 | 状态 | 说明 |
| --- | --- | --- |
| 5.6 | 已 EOL(2021-02) | 老项目常见,不建议新项目使用 |
| 5.7 | 已 EOL(2023-10) | 存量项目主力,InnoDB 成熟,仍有大量生产实例 |
| **8.0** | 当前主流 LTS | 窗口函数、CTE、JSON 增强、原子 DDL、隐藏索引 |
| 8.4 LTS | 长期支持版 | 8.0 的稳定化分支,官方推荐生产使用 |
| 9.x | 创新版 | 快速迭代的新特性版,不建议生产 |

**5.7 → 8.0 的主要差异(升级时必知):**

| 项 | 5.7 | 8.0 |
| --- | --- | --- |
| 查询缓存 | 支持(默认关) | **彻底移除** |
| CTE / 窗口函数 | 不支持 | 支持 |
| 默认字符集 | latin1 | **utf8mb4** |
| 默认排序规则 | utf8mb4_general_ci | utf8mb4_0900_ai_ci |
| 默认认证插件 | mysql_native_password | **caching_sha2_password** |
| DDL 原子性 | 非原子 | **原子 DDL**(崩溃不留半截表) |
| GROUP BY 隐式排序 | 是 | **否**(需显式 ORDER BY) |
| 用户与权限表 | mysql.user 可 UPDATE | 必须用 DDL 语句操作 |
| 保留字 | — | 新增 `rank`、`groups`、`system` 等 |

> **8.0 的认证插件坑:** 老客户端/驱动(如旧版 PyMySQL、mysqlclient、Navicat)不支持 `caching_sha2_password`,连接报 `Authentication plugin 'caching_sha2_password' cannot be loaded`。解决:建用户时指定旧插件,或升级驱动。

```sql
-- 8.0 中创建兼容老驱动的用户
CREATE USER 'app'@'%' IDENTIFIED WITH mysql_native_password BY 'password';
```

## 1.4 安装

### macOS(Homebrew)

```bash
brew install mysql                    # 安装最新版
brew services start mysql             # 后台启动(开机自启)
brew services stop mysql              # 停止
mysql_secure_installation             # 安全初始化(设 root 密码、删匿名用户)
```

### Linux(Ubuntu / Debian)

```bash
sudo apt update
sudo apt install mysql-server         # Ubuntu 20.04+ 默认装 8.0
sudo systemctl start mysql
sudo systemctl enable mysql           # 开机自启
sudo systemctl status mysql
sudo mysql_secure_installation
```

### Linux(CentOS / RHEL)

```bash
# 官方源安装(系统自带的是 MariaDB,需注意区分)
sudo yum install -y https://dev.mysql.com/get/mysql80-community-release-el7-9.noarch.rpm
sudo yum install -y mysql-community-server
sudo systemctl start mysqld
# 8.0 首次启动会生成临时 root 密码
sudo grep 'temporary password' /var/log/mysqld.log
```

### Docker(开发环境最快)

```bash
docker run -d --name mysql8 \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -e MYSQL_DATABASE=mydb \
  -v mysql_data:/var/lib/mysql \
  mysql:8.0 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_0900_ai_ci

docker exec -it mysql8 mysql -uroot -p123456     # 进入客户端
```

### Windows

下载 MySQL Installer(https://dev.mysql.com/downloads/installer/),选 Server + Workbench 组件。安装时用 `net start mysql` / `net stop mysql` 管理服务。

### 验证安装

```bash
mysql --version                       # mysql  Ver 8.0.36 for Linux on x86_64
mysql -uroot -p                       # 输入密码进入
```

```sql
SELECT VERSION();                     -- 8.0.36
SHOW DATABASES;
```

## 1.5 客户端连接

### 命令行

```bash
# 基本格式:mysql -h主机 -P端口 -u用户 -p密码 数据库名
mysql -uroot -p123456                            # -p 后紧跟密码(无空格)
mysql -h 127.0.0.1 -P 3306 -u root -p            # -p 后不写则交互输入(更安全)
mysql -uroot -p123456 mydb                       # 直接连接指定库
mysql -uroot -p123456 --default-character-set=utf8mb4

# 执行单条 SQL 后退出
mysql -uroot -p123456 -e "SHOW DATABASES;"

# 从文件导入 SQL
mysql -uroot -p123456 mydb < dump.sql
mysql -uroot -p123456 --execute="source /path/dump.sql"
```

> **`-h localhost` 与 `-h 127.0.0.1` 的区别:** 前者在 Linux 下走 **Unix Socket**(`/tmp/mysql.sock`),后者走 **TCP/IP**。Socket 更快且不占 TCP 连接数;排查网络问题时要用 127.0.0.1 强制走 TCP。

### mysql 客户端内的元命令

| 命令 | 作用 |
| --- | --- |
| `status` / `\s` | 查看服务器状态、版本、字符集、连接方式 |
| `help` / `\h` | 帮助;`\h grant` 查某条语句的帮助 |
| `use 库名` / `\u` | 切换数据库 |
| `show databases;` | 列出所有库 |
| `show tables;` | 列出当前库所有表 |
| `desc 表名;` | 查看表结构 |
| `show create table 表名\G` | 查看建表语句 |
| `exit` / `quit` / `\q` | 退出 |
| `tee /path/log.txt` | 开始记录会话输出到文件 |
| `notee` | 停止记录 |
| `pager less` | 分页显示结果(长输出必备) |
| `nopager` | 取消分页 |

> **`\G` 的作用:** 把结果按列纵向显示,列很多时可读性远好于默认表格。`SELECT * FROM user LIMIT 1\G`(注意 `\G` 前不加分号)。

### 图形化工具

| 工具 | 平台 | 特点 |
| --- | --- | --- |
| **DataGrip** | 全平台 | JetBrains 出品,SQL 智能补全最强,收费 |
| DBeaver | 全平台 | 免费开源,支持几乎所有数据库 |
| MySQL Workbench | 全平台 | 官方工具,免费,带 ER 图与性能面板 |
| Navicat | Win/Mac | 老牌商业工具,数据同步/备份方便 |
| TablePlus | Win/Mac | 轻量快速,界面现代 |

DataGrip 连接远程库、配 SSH 隧道与 SSL 的详细步骤见 [[后端/数据库/DataGraip连接远程数据库]]。

## 1.6 目录结构与文件

```text
/var/lib/mysql/                    # 数据目录(datadir)
├── mysql/                         # 系统库(用户、权限、时区)
├── performance_schema/            # 性能监控库
├── information_schema/            # 元数据虚拟库(不占磁盘)
├── sys/                           # 基于 performance_schema 的视图库
├── mydb/                          # 用户自建库,一个库一个目录
│   ├── user.ibd                   # InnoDB 表:每表一个 ibd 文件(独立表空间)
│   └── order.ibd
├── ibdata1                        # 系统表空间(undo、变更缓冲等)
├── ib_logfile0 / ib_logfile1      # redo log 文件(8.0.30+ 改为 #ib_redo 目录)
├── undo_001 / undo_002            # undo log 独立表空间
├── auto.cnf                       # server_uuid
├── mysqld-auto.cnf                # SET PERSIST 持久化的配置
└── binlog.000001                  # 二进制日志(归档/复制用)
```

**四个系统库(必知):**

| 库 | 内容 | 常用查询 |
| --- | --- | --- |
| `information_schema` | 表结构、列、索引、字符集等**元数据** | `SELECT * FROM information_schema.TABLES WHERE TABLE_SCHEMA='mydb'` |
| `performance_schema` | 运行时性能指标、锁等待、SQL 统计 | `SELECT * FROM performance_schema.events_statements_summary_by_digest` |
| `mysql` | 用户与权限、时区、插件、慢日志配置 | `SELECT user, host FROM mysql.user` |
| `sys` | performance_schema 的**易读视图**,排查问题首选 | `SELECT * FROM sys.innodb_lock_waits` |

```sql
-- 排查最常用的几条 sys / information_schema 查询

-- 1. 库中各表大小排行
SELECT TABLE_NAME,
       ROUND(DATA_LENGTH/1024/1024, 2) AS data_mb,
       ROUND(INDEX_LENGTH/1024/1024, 2) AS index_mb,
       TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'mydb'
ORDER BY DATA_LENGTH DESC;

-- 2. 当前正在执行的连接与 SQL
SELECT id, user, host, db, command, time, state, info
FROM information_schema.PROCESSLIST
WHERE command != 'Sleep'
ORDER BY time DESC;

-- 3. 未被使用的索引(可考虑删除)
SELECT * FROM sys.schema_unused_indexes WHERE object_schema = 'mydb';

-- 4. 最耗时的 SQL 摘要
SELECT DIGEST_TEXT, COUNT_STAR,
       ROUND(SUM_TIMER_WAIT/1000000000000, 2) AS total_sec
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC LIMIT 10;
```

## 1.7 配置文件

MySQL 读取配置文件的顺序(Linux):**/etc/my.cnf → /etc/mysql/my.cnf → ~/.my.cnf**,后读取的覆盖先读取的。Windows 下是 `my.ini`(位于数据目录或安装目录)。

```ini
[mysqld]
# ---- 基础 ----
port = 3306
basedir = /usr/local/mysql
datadir = /var/lib/mysql
socket = /tmp/mysql.sock
pid-file = /var/run/mysqld/mysqld.pid

# ---- 字符集(8.0 默认已是 utf8mb4,显式写更保险)----
character-set-server = utf8mb4
collation-server = utf8mb4_0900_ai_ci

# ---- 连接 ----
max_connections = 500              # 最大连接数,默认 151,按内存与业务调整
max_connect_errors = 100           # 同一主机连接失败多少次后拉黑
wait_timeout = 28800               # 非交互连接空闲多少秒后断开(默认 8 小时)
interactive_timeout = 28800        # 交互连接空闲超时
connect_timeout = 10               # 建立连接的超时

# ---- InnoDB(性能核心)----
innodb_buffer_pool_size = 4G       # 缓冲池,建议物理内存的 50%~70%(专用数据库机)
innodb_buffer_pool_instances = 4   # 缓冲池分区数,减少并发争用(池 ≥ 1G 时生效)
innodb_log_file_size = 1G          # 单个 redo log 大小,太小会频繁触发刷盘
innodb_log_files_in_group = 2      # redo log 文件个数
innodb_flush_log_at_trx_commit = 1 # 事务日志刷盘策略(见下)
innodb_flush_method = O_DIRECT     # 绕过 OS 缓存,避免双重缓冲
innodb_io_capacity = 2000          # SSD 建议 2000+,机械盘 200
innodb_file_per_table = ON         # 每表独立表空间(默认开,便于回收空间)

# ---- 日志 ----
log_error = /var/log/mysql/error.log
slow_query_log = ON                          # 慢查询日志
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1                          # 超过 1 秒记录
log_queries_not_using_indexes = OFF          # 记录未走索引的 SQL(易刷屏,慎开)
log_bin = /var/log/mysql/mysql-bin           # 开启 binlog(主从复制与时间点恢复必需)
binlog_format = ROW                          # 行模式(推荐,数据一致)
binlog_expire_logs_seconds = 604800          # binlog 保留 7 天

# ---- 安全 ----
# bind-address = 127.0.0.1         # 只允许本机连;生产内网可填内网 IP
default_authentication_plugin = caching_sha2_password

[client]
default-character-set = utf8mb4
socket = /tmp/mysql.sock

[mysql]
default-character-set = utf8mb4
prompt = "\\u@\\h [\\d]> "          # 提示符显示 用户@主机 [库名]
```

### 配置的三种修改方式

```sql
-- 1. 查看当前值(SHOW VARIABLES 看全局,SELECT @@ 看具体作用域)
SHOW GLOBAL VARIABLES LIKE 'max_connections';
SHOW SESSION VARIABLES LIKE 'sql_mode';
SELECT @@global.max_connections, @@session.sql_mode;

-- 2. 临时修改(重启失效)
SET GLOBAL max_connections = 1000;          -- 全局:对**新连接**生效
SET SESSION sql_mode = 'STRICT_TRANS_TABLES';  -- 会话:仅当前连接

-- 3. 持久化修改(8.0+,写入 mysqld-auto.cnf,重启仍生效)
SET PERSIST max_connections = 1000;
SET PERSIST_ONLY innodb_buffer_pool_size = 4G;   -- 只写文件,不改运行时(需重启)
RESET PERSIST max_connections;                   -- 移除持久化项
```

| 作用域关键字 | 生效范围 | 重启后 |
| --- | --- | --- |
| `GLOBAL` | 新建立的连接 | 丢失 |
| `SESSION` | 当前连接 | 丢失 |
| `PERSIST` | 新连接 + 写入配置文件 | **保留** |
| `PERSIST_ONLY` | 只写配置文件 | 保留(需手动重启生效) |

### innodb_flush_log_at_trx_commit(数据安全与性能的开关)

| 值 | 行为 | 崩溃丢失 | 性能 |
| --- | --- | --- | --- |
| **1**(默认) | 每次事务提交都 fsync 到磁盘 | 不丢 | 最慢 |
| 2 | 提交时写到 OS Page Cache,每秒 fsync | MySQL 挂不丢,**机器掉电丢 1 秒** | 中 |
| 0 | 每秒才写并 fsync | 丢 1 秒 | 最快 |

> 金融、订单类业务必须 `= 1`;日志、埋点等可容忍少量丢失的场景可设 `2` 换性能。它常与 `sync_binlog` 一起讨论,两者都为 1 才是"双 1 配置"(最安全)。

## 1.8 用户与权限管理(DCL)

### 创建用户

```sql
-- 语法:CREATE USER '用户名'@'主机' IDENTIFIED BY '密码';
-- 主机可用:localhost / 具体 IP / '192.168.1.%'(网段) / '%'(任意)

CREATE USER 'app'@'%' IDENTIFIED BY 'Strong@Pass123';
CREATE USER 'dba'@'192.168.1.%' IDENTIFIED BY 'Dba@Pass123';
CREATE USER 'readonly'@'localhost' IDENTIFIED BY 'Read@123';

-- 8.0 兼容老驱动
CREATE USER 'legacy'@'%' IDENTIFIED WITH mysql_native_password BY 'pwd';

-- 带资源限制
CREATE USER 'bi'@'%' IDENTIFIED BY 'pwd'
  WITH MAX_QUERIES_PER_HOUR 1000
       MAX_USER_CONNECTIONS 5;

-- 查看已装的认证插件
SHOW PLUGINS;
```

> **`'app'@'%'` 与 `'app'@'localhost'` 是两个完全不同的账号。** MySQL 用 `用户 + 主机` 联合确定身份,给 `%` 授权不包含 `localhost`(反之亦然)。

### 授权

```sql
-- 语法:GRANT 权限 ON 库.表 TO '用户'@'主机';

-- 库.表的粒度写法:
-- *.*           所有库所有表(全局)
-- mydb.*        mydb 库下所有表
-- mydb.user     mydb 库的 user 表
-- mydb.user(id) 具体到列

-- 只读账号:只给查询权限(最常用)
GRANT SELECT ON mydb.* TO 'readonly'@'%';

-- 应用账号:增删改查 + 事务,不给 DDL 与权限管理
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON mydb.* TO 'app'@'%';

-- 库管理员:含建表改表
GRANT ALL PRIVILEGES ON mydb.* TO 'dba'@'192.168.1.%';

-- 列级权限
GRANT SELECT(user_id, user_name) ON mydb.user TO 'report'@'%';

-- 全局超级权限(8.0 建议改用细粒度动态权限)
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;

-- 刷新权限(8.0 中 GRANT 会自动生效,老版本或直改 mysql.user 后需要)
FLUSH PRIVILEGES;

-- 查看所有可授予的权限
SHOW PRIVILEGES\G
```

**常用权限清单:**

| 权限 | 允许的操作 |
| --- | --- |
| `ALL PRIVILEGES` | 除 GRANT OPTION 外的全部权限 |
| `SELECT` / `INSERT` / `UPDATE` / `DELETE` | 基本 DML |
| `CREATE` / `DROP` / `ALTER` | DDL:建删改库表索引 |
| `INDEX` | 创建删除索引 |
| `CREATE VIEW` / `SHOW VIEW` | 视图相关 |
| `CREATE ROUTINE` / `ALTER ROUTINE` / `EXECUTE` | 存储过程与函数 |
| `TRIGGER` | 触发器 |
| `REFERENCES` | 创建外键 |
| `LOCK TABLES` | 显式锁表(备份时需要) |
| `PROCESS` | 查看所有线程的 SQL(`SHOW PROCESSLIST`) |
| `RELOAD` | 执行 `FLUSH` 操作 |
| `REPLICATION SLAVE` / `REPLICATION CLIENT` | 主从复制相关 |
| `SUPER` | 超级权限(8.0 已拆分为多个动态权限) |
| `GRANT OPTION` | 把自己的权限授予他人 |

### 查看与回收权限

```sql
-- 查看权限
SHOW GRANTS FOR 'app'@'%';
SHOW GRANTS FOR CURRENT_USER();

-- 回收权限(与 GRANT 对称,注意是 FROM 不是 TO)
REVOKE INSERT, UPDATE ON mydb.* FROM 'app'@'%';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'dba'@'192.168.1.%';

-- 删除用户
DROP USER 'readonly'@'%';
DROP USER IF EXISTS 'temp'@'localhost';

-- 改密码
ALTER USER 'app'@'%' IDENTIFIED BY 'NewStrong@Pass';
ALTER USER USER() IDENTIFIED BY 'pwd';         -- 改自己当前账号的密码

-- 密码过期策略(8.0)
ALTER USER 'app'@'%' PASSWORD EXPIRE INTERVAL 90 DAY;
```

> **8.0 的重要变更:** 不能再用 `UPDATE mysql.user SET authentication_string=...` 改密码,也不能用 `GRANT` 隐式创建用户(必须先 `CREATE USER`)。这是从 5.7 升级时最常踩的坑之一。

### 忘记 root 密码的恢复

```bash
# 1. 停止服务
sudo systemctl stop mysql

# 2. 跳过权限表启动
sudo mysqld_safe --skip-grant-tables --skip-networking &

# 3. 无密码登录并重置
mysql -uroot
```

```sql
FLUSH PRIVILEGES;                              -- 跳过模式下必须先刷新才能用 ALTER USER
ALTER USER 'root'@'localhost' IDENTIFIED BY 'NewPass@123';
FLUSH PRIVILEGES;
```

```bash
# 4. 重启正常服务
sudo pkill mysqld
sudo systemctl start mysql
```

## 1.9 常用运维命令速查

```bash
# 服务管理(Linux systemd)
sudo systemctl start|stop|restart|status mysql

# macOS Homebrew
brew services start|stop|restart mysql

# 查看进程与端口
ps -ef | grep mysqld
netstat -tlnp | grep 3306          # Linux
lsof -i :3306                      # macOS

# 查看版本与配置
mysql --version
mysqld --verbose --help | grep -A1 'Default options'    # 配置文件搜索路径
mysqld --print-defaults                                  # 当前生效的默认值

# 备份与恢复
mysqldump -uroot -p --all-databases > all.sql            # 全库备份
mysqldump -uroot -p --single-transaction --routines --triggers mydb > mydb.sql
mysql -uroot -p mydb < mydb.sql                          # 恢复

# 性能压测
mysqlslap -uroot -p --concurrency=50 --iterations=5 \
  --create-schema=test --query="SELECT * FROM user" --auto-generate-sql
sysbench oltp_read_write --mysql-host=127.0.0.1 --mysql-user=root \
  --mysql-password=pwd --tables=4 --table-size=100000 run
```

## 1.10 常见问题与最佳实践

**连接类问题排查:**

| 报错 | 原因 | 解决 |
| --- | --- | --- |
| `ERROR 2002 Can't connect through socket` | 服务未启动或 socket 路径不对 | `systemctl start mysql`;检查 `socket` 配置 |
| `ERROR 1045 Access denied` | 用户/密码/主机不匹配 | 核对 `'user'@'host'`,用 `SELECT user,host FROM mysql.user` 确认 |
| `ERROR 2003 Can't connect to server` | bind-address 限制、防火墙、端口未开 | 检查 `bind-address`、`iptables`/安全组 |
| `Too many connections` | 连接数打满 | 临时 `SET GLOBAL max_connections=1000`,根治连接泄漏与连接池 |
| `Lost connection during query` | 包过大或网络中断 | 调大 `max_allowed_packet`;检查 `wait_timeout` |
| `Public Key Retrieval is not allowed` | 8.0 caching_sha2 认证 | JDBC 加 `allowPublicKeyRetrieval=true&useSSL=false` |

**配置最佳实践:**

1. **生产必须建专用低权限账号**,严禁应用直接用 root 连接
2. **`bind-address` 不要写 0.0.0.0 暴露公网**,配合防火墙/安全组只放行内网
3. **字符集统一 utf8mb4**(不是 utf8!MySQL 的 `utf8` 只有 3 字节,存不了 emoji)
4. **`innodb_buffer_pool_size` 是第一大调优参数**,专用机给物理内存的 50%~70%
5. **开启 binlog + `ROW` 格式**,这是主从复制和数据误删恢复的前提
6. **开启慢查询日志**,`long_query_time` 生产建议 0.5~1 秒
7. **`sql_mode` 开启严格模式** `STRICT_TRANS_TABLES`,避免非法数据被静默截断
8. **`wait_timeout` 调小**(如 600),避免大量空闲连接占资源;应用侧用连接池 + `pool_pre_ping`

---

## 本章小结

- MySQL 是开源关系型数据库,分层架构:连接层 → 服务层(解析/优化/执行)→ 存储引擎层
- **InnoDB 是唯一的生产选择**:支持事务、行锁、外键、MVCC 与崩溃恢复
- 8.0 是当前主流:移除查询缓存、新增 CTE/窗口函数、默认 utf8mb4 与 caching_sha2_password、原子 DDL
- 四个系统库:`information_schema`(元数据)、`performance_schema`(指标)、`mysql`(权限)、`sys`(易读视图,排查首选)
- 配置修改分 GLOBAL(新连接生效)/SESSION(当前连接)/PERSIST(重启保留)三种作用域
- 权限管理三件套:`CREATE USER` → `GRANT` → `REVOKE`;身份由 `用户 + 主机` 联合确定
- 生产红线:专用低权限账号、不暴露公网、utf8mb4、开 binlog 与慢日志、调大缓冲池
