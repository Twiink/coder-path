---
title: "日志与备份恢复"
aliases:
  - "MySQL日志"
  - "redo log"
  - "binlog"
  - "MySQL备份"
tags:
  - "后端"
  - "数据库"
  - "mysql"
  - "日志"
  - "备份"
  - "笔记"
category: "后端"
folder: "MySQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MySQL/事务与锁机制]]"
  - "[[后端/数据库/MySQL/慢查询与性能优化]]"
  - "[[后端/数据库/MySQL/分库分表与高可用]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 07 日志与备份恢复

MySQL 有六大日志,其中 redo log、undo log、binlog 是理解事务与复制的钥匙。本章覆盖:六大日志的作用与配置、两阶段提交、WAL 机制、备份方案(mysqldump / xtrabackup)、基于 binlog 的时间点恢复、误删数据抢救。

## 7.1 六大日志总览

| 日志 | 所属层 | 作用 | 默认开启 |
| --- | --- | --- | --- |
| **redo log** 重做日志 | InnoDB 引擎层 | 保证**持久性 D**:崩溃后恢复未落盘的数据 | ✅ |
| **undo log** 回滚日志 | InnoDB 引擎层 | 保证**原子性 A**:事务回滚;支撑 **MVCC** 版本链 | ✅ |
| **binlog** 归档日志/二进制日志 | **Server 层**(所有引擎共用) | **主从复制**、**时间点恢复**、数据审计 | 8.0 默认开,5.7 默认关 |
| **relay log** 中继日志 | Server 层 | 从库存放从主库拉取的 binlog,再重放 | 从库自动 |
| **slow query log** 慢查询日志 | Server 层 | 记录执行超时的 SQL,性能优化入口 | ❌ 需手动开 |
| **general log** 通用查询日志 | Server 层 | 记录**所有**收到的 SQL | ❌ 开销大,仅调试 |
| **error log** 错误日志 | Server 层 | 启动/关闭/运行中的错误与警告 | ✅ |

```text
一条 UPDATE 语句涉及的日志流转:

  客户端 UPDATE t SET a=1 WHERE id=2
        ↓
  ① 执行器找到 id=2 这行(在缓冲池就直接用,否则读磁盘)
  ② 写 undo log(记录旧值 a=0,用于回滚和 MVCC)
  ③ 修改内存中的数据页(此时脏页还没落盘)
  ④ 写 redo log(prepare 状态)→ redo log buffer
  ⑤ 写 binlog → binlog cache
  ⑥ 提交事务: redo log 改为 commit 状态
        ↓
  ⑦ 后台线程在合适时机把脏页刷到磁盘(checkpoint)
```

## 7.2 redo log:崩溃恢复的关键

### 为什么需要 redo log

InnoDB 以页(默认 16KB)为单位管理数据。如果每次事务提交都把修改的页刷到磁盘,会有两个致命问题:

1. **IO 太重**:改一行(几十字节)却要刷整个 16KB 页
2. **随机 IO**:一个事务可能改多个页,分散在磁盘各处

**解决方案:WAL(Write-Ahead Logging,预写日志)**

```text
核心思想:先写日志,再写数据
  事务提交时:只把【改动记录】顺序追加写入 redo log(顺序 IO,极快)
             数据页留在内存(缓冲池)当"脏页"
  之后:      后台线程在系统空闲时,把脏页批量刷到磁盘(随机 IO,但不阻塞提交)

  顺序写磁盘 >> 随机写磁盘(机械盘差 100 倍以上,SSD 也差数倍)
```

> **WAL 的本质是"用顺序写换随机写"**,这是所有数据库(InnoDB、PostgreSQL、Redis AOF)高性能的通用套路。

### redo log 的结构

```text
redo log 是一组【固定大小、循环写】的文件:

  ib_logfile0 ──┐
  ib_logfile1 ──┘  组成一个环形缓冲区

  write pos ────→ 当前写入位置,顺时针推进
  checkpoint ───→ 当前可擦除位置(脏页已刷盘的部分),顺时针推进

  write pos 到 checkpoint 之间:空闲可写区域
  checkpoint 到 write pos 之间:尚未刷盘、不能覆盖的日志

  当 write pos 追上 checkpoint:redo log 满了,
  必须【停下来】推进 checkpoint(强制刷脏页),期间 MySQL 不能更新!
  → 这就是 redo log 太小会导致"偶发性卡顿"的原因
```

> **8.0.30 之后**,redo log 文件改到 `#ib_redo` 目录,支持在线动态调整大小(`ALTER INSTANCE ... `),不再是固定的 `ib_logfile0/1`。

### redo log 与刷盘策略

```ini
# my.cnf
innodb_log_file_size = 1G              # 单个文件大小,太小会频繁触发 checkpoint 卡顿
innodb_log_files_in_group = 2          # 文件个数
innodb_log_buffer_size = 64M           # redo log 缓冲区,大事务可调大
innodb_flush_log_at_trx_commit = 1     # 【核心】刷盘策略
```

**`innodb_flush_log_at_trx_commit`(与数据安全直接相关):**

| 值 | 提交时行为 | MySQL 进程崩溃 | 机器掉电 | 性能 |
| --- | --- | --- | --- | --- |
| **1**(默认) | 每次提交都 **fsync** 到磁盘 | 不丢 | 不丢 | 最慢(每次提交一次磁盘 IO) |
| **2** | 提交时写到 **OS Page Cache**,每秒 fsync | **不丢**(日志在 OS 里) | **丢最多 1 秒** | 中 |
| **0** | 每秒才写 + fsync(提交时什么都不做) | **丢最多 1 秒** | 丢最多 1 秒 | 最快 |

```text
写入路径的三级缓冲:
  redo log buffer(MySQL 进程内)→ OS Page Cache(操作系统)→ 磁盘

  = 0:提交时停在 redo log buffer,后台每秒推到 OS 并 fsync
  = 1:提交时一路 fsync 到磁盘
  = 2:提交时到 OS Page Cache,后台每秒 fsync
```

> **配置建议:**
> - 金融、订单、支付:**必须 = 1**(双 1 配置的一半)
> - 日志、埋点、监控数据:可 = 2 换取数倍写入性能
> - **组提交(Group Commit)** 优化:InnoDB 会把同一时刻多个事务的 redo log 合并成一次 fsync,所以 = 1 在高并发下没有想象中慢

## 7.3 undo log:回滚与 MVCC

```sql
-- undo log 记录的是【反向操作】
INSERT INTO t VALUES (1, 'a');    -- undo 记录:DELETE FROM t WHERE id = 1
DELETE FROM t WHERE id = 2;       -- undo 记录:INSERT INTO t VALUES (2, ...)
UPDATE t SET a = 'b' WHERE id=3;  -- undo 记录:UPDATE t SET a = '旧值' WHERE id = 3
```

**两大作用:**

1. **事务回滚**:执行 undo 里的反向操作,把数据恢复到事务开始前
2. **MVCC 版本链**:通过 `DB_ROLL_PTR` 指针串起历史版本,让快照读能读到一致性视图(详见 [[后端/数据库/MySQL/事务与锁机制]])

```ini
# undo 表空间配置
innodb_undo_tablespaces = 2          # 独立 undo 表空间文件个数(8.0 默认 2)
innodb_max_undo_log_size = 1G        # 单个 undo 文件最大大小,超过后可被截断回收
innodb_undo_log_truncate = ON        # 允许截断回收 undo 空间
innodb_purge_threads = 4             # purge 线程数,回收不再需要的 undo 版本
```

> **长事务导致 undo 暴涨:** 只要有活跃的老事务,它 Read View 之后的所有 undo 版本都不能被 purge,undo 表空间会持续增长到几十上百 GB,且回收很慢。**监控并杀掉长事务是 DBA 的日常。**

## 7.4 binlog:复制与恢复的基石

### binlog 与 redo log 的区别(必考)

| 维度 | redo log | binlog |
| --- | --- | --- |
| 所属层 | **InnoDB 引擎层**特有 | **Server 层**,所有引擎都有 |
| 类型 | **物理日志**:"某页某偏移量做了什么修改" | **逻辑日志**:"这条 SQL 的逻辑"或"某行改成了什么" |
| 写入方式 | **循环写**,固定空间,会被覆盖 | **追加写**,写满一个文件切下一个,不覆盖 |
| 用途 | **崩溃恢复**(crash-safe) | **主从复制、时间点恢复、审计** |
| 能否用于恢复数据 | ❌ 不能(循环覆盖,历史丢失) | ✅ 能(完整保留所有变更) |

> **为什么有了 redo log 还需要 binlog?**
> 历史原因:binlog 是 MySQL Server 层早就有的,redo log 是 InnoDB 作为插件引入时才有的。
> 功能差异:redo log 循环写、只够崩溃恢复,**无法归档**(不能恢复到任意历史时刻);binlog 追加写、完整保留,**能做主从复制和时间点恢复**。二者能力互补,都不能替代对方。

### binlog 的三种格式

```ini
binlog_format = ROW        # 推荐
```

| 格式 | 记录内容 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **STATEMENT** | 原始 SQL 语句 | 日志量小,节省 IO | **可能主从不一致**:`NOW()`、`UUID()`、`RAND()`、`LIMIT` 不加 ORDER BY 在主从执行结果不同 |
| **ROW**(推荐) | 每一行数据的实际变更(改前改后的值) | **绝对一致**,可用于闪回、精确恢复 | 日志量大(批量 UPDATE 10 万行会记 10 万条) |
| **MIXED** | 自动选择:一般用 STATEMENT,遇到不安全语句用 ROW | 折中 | 仍有边界情况不一致 |

```sql
-- 查看当前格式与相关配置
SHOW VARIABLES LIKE 'binlog_format';
SHOW VARIABLES LIKE 'log_bin';
SHOW VARIABLES LIKE 'binlog_row_image';   -- FULL(默认,记全部列)/ MINIMAL(只记变更列)

-- 查看 binlog 文件列表
SHOW BINARY LOGS;         -- 或 SHOW MASTER LOGS
SHOW MASTER STATUS;       -- 当前正在写的文件与位置(8.0.22+ 用 SHOW BINARY LOG STATUS)

-- 查看 binlog 内容
SHOW BINLOG EVENTS IN 'mysql-bin.000001' LIMIT 10;
```

### 两阶段提交(2PC):redo log 与 binlog 的一致性

**问题:** 一个事务要同时写 redo log 和 binlog,如果写到一半崩溃,可能出现:

- 只写了 redo log 没写 binlog → 主库恢复了这行数据,但从库(靠 binlog)没有 → **主从不一致**
- 只写了 binlog 没写 redo log → 主库没这行数据,从库有 → **主从不一致**

**解决方案:两阶段提交**

```text
① redo log 写入,状态标记为 prepare
② binlog 写入并落盘
③ redo log 状态改为 commit

崩溃恢复时的决策规则:
  · redo log 处于 prepare 且【有对应 binlog】→ 提交(因为 binlog 可能已传给从库)
  · redo log 处于 prepare 且【无对应 binlog】→ 回滚
  · redo log 已是 commit → 提交
```

```sql
-- 相关参数
innodb_flush_log_at_trx_commit = 1   -- redo log 每次提交刷盘
sync_binlog = 1                      -- binlog 每次提交刷盘
-- 【双 1 配置】= 最安全,任何崩溃都不丢数据、主从一致,是金融业务标配
```

| `sync_binlog` | 行为 | 掉电丢失 |
| --- | --- | --- |
| **1** | 每次提交 fsync | 不丢(推荐) |
| 0 | 交给 OS 决定 | 可能丢多个事务 |
| N | 每 N 次提交 fsync 一次 | 最多丢 N 个事务 |

> **性能与安全的权衡:**
> - **双 1(推荐)**:`innodb_flush_log_at_trx_commit=1` + `sync_binlog=1` → 最安全,任何情况不丢
> - **双 0/双 2**:性能高,但掉电丢数据
> - 高写入场景可用 `sync_binlog = 100~1000` 折中(掉电最多丢这么多个事务的 binlog)

## 7.5 慢查询日志与错误日志

### 慢查询日志

```ini
# my.cnf(静态配置)
slow_query_log = ON
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1                              # 超过 1 秒记录
log_queries_not_using_indexes = OFF              # 记录未用索引的 SQL(易刷屏)
log_slow_admin_statements = ON                   # 记录慢的 DDL 与管理语句
min_examined_row_limit = 1000                    # 至少扫描 1000 行才记录(过滤小表)
```

```sql
-- 动态开启(不重启)
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 0.5;
SET GLOBAL log_queries_not_using_indexes = ON;
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';

-- 查看
SHOW VARIABLES LIKE 'slow_query%';
SHOW VARIABLES LIKE 'long_query_time';
```

**慢查询日志格式:**

```text
# Time: 2026-09-06T15:30:00.123456Z
# User@Host: app[app] @ 10.0.0.5 [10.0.0.5]  Id: 12345
# Query_time: 3.456789  Lock_time: 0.000123 Rows_sent: 10  Rows_examined: 1523400
SET timestamp=1788000600;
SELECT * FROM article WHERE DATE(created_at) = '2026-09-06' ORDER BY view_count DESC;
```

| 字段 | 含义 | 优化线索 |
| --- | --- | --- |
| `Query_time` | 执行总耗时(秒) | 主要指标 |
| `Lock_time` | 等待锁的时间 | 大说明有锁冲突 |
| `Rows_sent` | 返回给客户端的行数 | — |
| `Rows_examined` | **扫描的行数** | **与 Rows_sent 比值大 = 索引差** |

> **黄金指标:`Rows_examined / Rows_sent`。** 返回 10 行却扫描 152 万行,说明索引严重缺失或失效。

**分析工具:**

```bash
# 1. mysqldumpslow(MySQL 自带)
mysqldumpslow -s t -t 10 /var/log/mysql/slow.log      # 按总时间排序,取前 10
mysqldumpslow -s c -t 10 /var/log/mysql/slow.log      # 按出现次数排序
mysqldumpslow -s r -t 10 /var/log/mysql/slow.log      # 按平均时间
# -s 排序字段:c 次数 / t 总时间 / at 平均时间 / al 平均锁时间 / r 平均返回行数

# 2. pt-query-digest(Percona Toolkit,功能最强,推荐)
pt-query-digest /var/log/mysql/slow.log > report.txt
pt-query-digest --since '2026-09-01' --until '2026-09-06' slow.log
pt-query-digest --filter '$event->{Query_time} > 5' slow.log
# 输出:总体统计 + 每类 SQL 的响应时间占比、扫描行数、示例、建议

# 安装 Percona Toolkit
# CentOS: yum install percona-toolkit
# Ubuntu: apt install percona-toolkit
```

### 错误日志

```ini
log_error = /var/log/mysql/error.log
log_error_verbosity = 2        # 1 只记错误 / 2 错误+警告 / 3 全部(含 info)
```

```sql
SHOW VARIABLES LIKE 'log_error';
-- 8.0 可直接查错误日志表
SELECT * FROM performance_schema.error_log ORDER BY LOGGED DESC LIMIT 20;
```

> **general log(通用日志)生产禁用:** 它记录**每一条** SQL,QPS 上万时磁盘 IO 直接打满。只在排查"应用到底发了什么 SQL"时临时开:
> ```sql
> SET GLOBAL general_log = ON;
> SET GLOBAL log_output = 'TABLE';      -- 记到 mysql.general_log 表,方便查询
> SELECT * FROM mysql.general_log ORDER BY event_time DESC LIMIT 50;
> SET GLOBAL general_log = OFF;         -- 用完立刻关!
> ```

## 7.6 备份方案

### 备份类型对比

| 维度 | 逻辑备份(mysqldump) | 物理备份(xtrabackup) |
| --- | --- | --- |
| 备份内容 | SQL 语句(CREATE/INSERT) | 数据文件本身(.ibd、.frm) |
| 速度 | 慢(要执行查询 + 生成 SQL) | **快**(直接拷文件) |
| 恢复速度 | 慢(要重放所有 SQL) | **快**(拷回 + 应用日志) |
| 备份时锁 | `--single-transaction` 可不锁(InnoDB) | 热备,几乎不锁 |
| 跨版本/跨平台 | ✅ 好(SQL 通用) | ❌ 差(文件格式绑定版本) |
| 备份大小 | 小(可压缩) | 大(等于数据量) |
| 适用规模 | < 几十 GB | **> 几十 GB / TB 级** |
| 增量备份 | ❌ 不支持 | ✅ 支持 |

### mysqldump(中小库首选)

```bash
# ---- 基础用法 ----
# 备份单个库
mysqldump -uroot -p --databases mydb > mydb.sql

# 备份多个库
mysqldump -uroot -p --databases db1 db2 > dbs.sql

# 备份所有库
mysqldump -uroot -p --all-databases > all.sql

# 备份单表
mysqldump -uroot -p mydb user order > tables.sql

# 只备份表结构(不含数据)
mysqldump -uroot -p --no-data mydb > schema.sql

# 只备份数据(不含建表语句)
mysqldump -uroot -p --no-create-info mydb user > data.sql

# ---- 生产推荐参数组合 ----
mysqldump -uroot -p \
  --single-transaction \          # 【关键】InnoDB 一致性备份,不锁表(开一个 RR 事务拿快照)
  --master-data=2 \               # 在注释里记录 binlog 位置,用于搭建从库/时间点恢复
  --routines \                    # 备份存储过程与函数
  --triggers \                    # 备份触发器(默认已含)
  --events \                      # 备份事件调度器
  --flush-logs \                  # 备份前切换 binlog(便于增量)
  --set-gtid-purged=AUTO \        # GTID 场景
  --default-character-set=utf8mb4 \
  --databases mydb | gzip > mydb_$(date +%F).sql.gz

# ---- 常用参数说明 ----
--opt                    # 默认开启,等于 --add-drop-table --add-locks --create-options
                         #        --disable-keys --extended-insert --lock-tables --quick
--single-transaction     # InnoDB 专用,一致性快照备份,不阻塞写
--lock-tables            # 锁表备份(MyISAM 必须用,会阻塞写)
--lock-all-tables        # 全局读锁(FTWRL),备份所有库时用
--extended-insert        # 多行合并成一条 INSERT(默认开,恢复快)
--skip-extended-insert   # 每行一条 INSERT(文件大但便于定位与部分恢复)
--quick                  # 大表逐行读取,不缓存到内存(默认开)
--max_allowed_packet=1G  # 单条 SQL 的最大包,大字段时要调
--where="created_at>'2026-01-01'"   # 按条件备份
--compress               # 客户端与服务器间压缩传输
```

> **`--single-transaction` 的原理与限制:**
> 原理:备份开始时执行 `START TRANSACTION WITH CONSISTENT SNAPSHOT`,利用 RR 的 MVCC 拿到一致性快照,整个过程不加锁。
> **限制:** ① 只对 InnoDB 有效(MyISAM 仍需 `--lock-tables`);② 备份期间**不能执行 DDL**(ALTER TABLE 会导致快照失效、数据不一致);③ 不能与 `--lock-tables` 同时用。

```bash
# ---- 恢复 ----
# 方式一:重定向
mysql -uroot -p mydb < mydb.sql
gunzip < mydb_2026-09-06.sql.gz | mysql -uroot -p mydb

# 方式二:登录后 source(可看进度)
mysql -uroot -p
CREATE DATABASE IF NOT EXISTS mydb DEFAULT CHARSET utf8mb4;
USE mydb;
SOURCE /backup/mydb.sql;

# 方式三:大文件恢复的加速技巧
mysql -uroot -p mydb < big.sql &
# 恢复前临时调整:
SET GLOBAL innodb_flush_log_at_trx_commit = 0;   # 恢复完改回 1
SET GLOBAL sync_binlog = 0;                       # 恢复完改回 1
SET GLOBAL innodb_doublewrite = 0;                # 恢复完改回 ON
SET sql_log_bin = 0;                              # 不写 binlog(避免从库重复恢复)
```

### xtrabackup(大库物理热备)

Percona XtraBackup 是 InnoDB 的物理热备工具,**备份期间不锁库**,支持增量备份。

```bash
# 安装
yum install percona-xtrabackup-80        # CentOS(MySQL 8.0 对应 80 版)
apt install percona-xtrabackup-80        # Ubuntu

# ---- 全量备份 ----
xtrabackup --backup --target-dir=/backup/full \
  --user=root --password=pwd --parallel=4

# ---- 增量备份(基于上次备份的 LSN,只备份 LSN 更大的页)----
xtrabackup --backup --target-dir=/backup/inc1 \
  --incremental-basedir=/backup/full --user=root --password=pwd

xtrabackup --backup --target-dir=/backup/inc2 \
  --incremental-basedir=/backup/inc1 --user=root --password=pwd

# ---- 准备(prepare):应用 redo log,让备份达到一致状态 ----
xtrabackup --prepare --apply-log-only --target-dir=/backup/full
xtrabackup --prepare --apply-log-only --target-dir=/backup/full \
           --incremental-dir=/backup/inc1
xtrabackup --prepare --target-dir=/backup/full \
           --incremental-dir=/backup/inc2      # 最后一次不加 --apply-log-only

# ---- 恢复(copy-back:目标目录必须为空)----
systemctl stop mysql
rm -rf /var/lib/mysql/*
xtrabackup --copy-back --target-dir=/backup/full
chown -R mysql:mysql /var/lib/mysql
systemctl start mysql

# ---- 流式备份 + 压缩(不占中间磁盘)----
xtrabackup --backup --stream=xbstream --compress --parallel=4 \
  --user=root --password=pwd > /backup/full.xbstream
xbstream -x < full.xbstream -C /backup/restore/
```

### 备份策略设计

```bash
# 经典方案:每周全量 + 每日增量 + binlog 实时
# crontab -e

# 每周日 2:00 全量备份
0 2 * * 0 /opt/scripts/backup_full.sh >> /var/log/backup.log 2>&1

# 每天 2:00 增量备份(周一到周六)
0 2 * * 1-6 /opt/scripts/backup_inc.sh >> /var/log/backup.log 2>&1

# 每 5 分钟归档 binlog(保证 RPO 接近 0)
*/5 * * * * mysqlbinlog --read-from-remote-server --raw --stop-never \
  -h127.0.0.1 -urepl -ppwd mysql-bin.000001 -D /backup/binlog/
```

```bash
#!/bin/bash
# /opt/scripts/backup_full.sh
set -euo pipefail

BACKUP_DIR=/backup/mysql
DATE=$(date +%F_%H%M)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

mysqldump -uroot -p"$MYSQL_PWD" \
  --single-transaction --master-data=2 \
  --routines --triggers --events \
  --all-databases | gzip > "$BACKUP_DIR/full_$DATE.sql.gz"

# 校验备份完整性(gzip -t 检查压缩包;grep 检查结尾标记)
gzip -t "$BACKUP_DIR/full_$DATE.sql.gz"
zcat "$BACKUP_DIR/full_$DATE.sql.gz" | tail -1 | grep -q 'Dump completed' \
  || { echo "备份校验失败!"; exit 1; }

# 清理过期备份
find "$BACKUP_DIR" -name 'full_*.sql.gz' -mtime +$RETENTION_DAYS -delete

echo "[$(date)] 全量备份完成: full_$DATE.sql.gz ($(du -h "$BACKUP_DIR/full_$DATE.sql.gz" | cut -f1))"
```

**备份的 RPO / RTO 概念:**

| 指标 | 含义 | 优化手段 |
| --- | --- | --- |
| **RPO**(Recovery Point Objective) | 可容忍丢失多少数据 | binlog 实时归档 → RPO 接近 0 |
| **RTO**(Recovery Time Objective) | 恢复需要多长时间 | 物理备份 + 从库快速提升 |

> **备份的三条铁律:**
> 1. **备份必须校验**,不校验的备份等于没备份(定期恢复到测试实例验证)
> 2. **备份必须异地**,同机房磁盘/机架故障会连备份一起丢(对象存储 / 跨地域)
> 3. **备份必须能恢复**,定期演练恢复流程,记录耗时(RTO)

## 7.7 基于 binlog 的时间点恢复(PITR)

**场景:** 今天 14:00 有人误删了数据,需要恢复到 13:59 的状态。

```text
恢复思路:
  ① 找最近一次全量备份(假设是今天 02:00)
  ② 恢复全量备份到临时实例
  ③ 重放 02:00 → 13:59 的 binlog(跳过误操作那条)
  ④ 把恢复好的数据导回生产库
```

```bash
# 步骤 1:恢复全量备份到临时实例
mysql -uroot -p -P3307 -h127.0.0.1 < full_2026-09-06_0200.sql

# 步骤 2:找到全量备份对应的 binlog 位置
# --master-data=2 会在 dump 文件里写一行注释:
grep 'CHANGE MASTER' full_2026-09-06_0200.sql
# -- CHANGE MASTER TO MASTER_LOG_FILE='mysql-bin.000042', MASTER_LOG_POS=12345;

# 步骤 3:查看 binlog 内容,定位误操作的精确位置
mysqlbinlog --no-defaults \
  --start-position=12345 \
  --database=mydb \
  /var/lib/mysql/mysql-bin.000042 | less

# 或用时间范围查看
mysqlbinlog --start-datetime='2026-09-06 02:00:00' \
            --stop-datetime='2026-09-06 14:05:00' \
            /var/lib/mysql/mysql-bin.000042 | grep -B5 -A5 'DELETE FROM user'

# 步骤 4:重放 binlog,【跳过】误操作
# 方式 A:按位置分两段重放(误操作在 pos 56789~57000)
mysqlbinlog --start-position=12345 --stop-position=56789 \
  /var/lib/mysql/mysql-bin.000042 | mysql -uroot -p -P3307
mysqlbinlog --start-position=57000 \
  /var/lib/mysql/mysql-bin.000042 | mysql -uroot -p -P3307
# 若跨多个 binlog 文件,依次列出:mysqlbinlog bin.000042 bin.000043 ...

# 方式 B:按时间
mysqlbinlog --start-datetime='2026-09-06 02:00:00' \
            --stop-datetime='2026-09-06 13:59:00' \
            /var/lib/mysql/mysql-bin.000042 | mysql -uroot -p -P3307

# 步骤 5:把恢复的表导回生产库
mysqldump -uroot -p -P3307 -h127.0.0.1 mydb user > user_fixed.sql
mysql -uroot -p mydb < user_fixed.sql
```

**mysqlbinlog 常用参数:**

| 参数 | 作用 |
| --- | --- |
| `--start-position` / `--stop-position` | 按 binlog 位置范围 |
| `--start-datetime` / `--stop-datetime` | 按时间范围 |
| `--database=mydb` | 只输出指定库的操作 |
| `--base64-output=DECODE-ROWS -v` | **把 ROW 格式解码成可读的伪 SQL**(排查必备) |
| `--read-from-remote-server` | 从远程服务器拉取 binlog |
| `--raw --stop-never` | 持续拉取(做实时备份) |
| `-s` / `--short-form` | 只输出 SQL,不含元信息 |

```bash
# ROW 格式 binlog 的可读化解析(排查误操作最常用)
mysqlbinlog --base64-output=DECODE-ROWS -v \
  --start-datetime='2026-09-06 13:50:00' \
  --stop-datetime='2026-09-06 14:05:00' \
  /var/lib/mysql/mysql-bin.000042 | less

# 输出类似:
# ### UPDATE `mydb`.`user`
# ### WHERE
# ###   @1=1001          /* id */
# ###   @2='alice'       /* username */
# ### SET
# ###   @1=1001
# ###   @2='alice_hacked'
```

### 闪回(Flashback):ROW 格式 binlog 的杀手级用法

**原理:** ROW 格式 binlog 记录了每行修改前后的完整值,把它们**反过来**(UPDATE 的 SET 与 WHERE 互换、DELETE 变 INSERT、INSERT 变 DELETE)就能生成逆向 SQL。

```bash
# 工具一:binlog2sql(美团开源,Python)
pip install binlog2sql

# 解析出误操作的 SQL
python binlog2sql.py -h127.0.0.1 -P3306 -uroot -p'pwd' \
  -d mydb -t user \
  --start-file='mysql-bin.000042' \
  --start-datetime='2026-09-06 13:55:00' \
  --stop-datetime='2026-09-06 14:00:00'

# 直接生成【回滚 SQL】(--flashback)
python binlog2sql.py --flashback -h127.0.0.1 -P3306 -uroot -p'pwd' \
  -d mydb -t user \
  --start-file='mysql-bin.000042' \
  --start-datetime='2026-09-06 13:55:00' \
  --stop-datetime='2026-09-06 14:00:00' > rollback.sql

mysql -uroot -p mydb < rollback.sql       # 执行回滚,数据恢复!

# 工具二:MyFlash(阿里开源)
./myflash --database=mydb --sql-type=DELETE \
  --start-position=56789 --stop-position=57000 \
  /var/lib/mysql/mysql-bin.000042
mysqlbinlog binlog_output_Base.flashback | mysql -uroot -p
```

> **闪回的前提:**
> 1. `binlog_format = ROW` 且 `binlog_row_image = FULL`(必须记录完整行)
> 2. binlog 文件还在(没被 `expire_logs_days` 清理)
> 3. 表结构在误操作后没有变更
>
> **闪回不能处理 DDL 误操作**(`DROP TABLE` 是 DDL,binlog 里只有一条语句,没有行数据可逆),只能靠全量备份。

## 7.8 误操作抢救手册

| 误操作 | 能否闪回 | 恢复方案 |
| --- | --- | --- |
| `DELETE FROM t WHERE ...` | ✅ 可以 | binlog2sql --flashback 生成 INSERT |
| `UPDATE t SET ... WHERE ...` | ✅ 可以 | binlog2sql --flashback 生成反向 UPDATE |
| `TRUNCATE TABLE t` | ❌ DDL | 全量备份 + binlog 重放到 TRUNCATE 之前 |
| `DROP TABLE t` | ❌ DDL | 同上 |
| `DROP DATABASE` | ❌ DDL | 全量备份 + binlog,或从库提升 |
| 无备份 + 无 binlog | — | **基本无解**,尝试磁盘恢复工具(成功率极低) |

```sql
-- 抢救前的第一动作:立即停止写入,防止 binlog 被覆盖、防止脏数据扩散
SET GLOBAL read_only = ON;               -- 普通用户只读(super 权限仍可写)
SET GLOBAL super_read_only = ON;         -- 8.0:连 super 也只读
-- 恢复完成后
SET GLOBAL super_read_only = OFF;
SET GLOBAL read_only = OFF;
```

```bash
# 检查 binlog 是否还在
mysql -uroot -p -e "SHOW BINARY LOGS;"
ls -lh /var/lib/mysql/mysql-bin.*

# 检查 binlog 保留策略
mysql -uroot -p -e "SHOW VARIABLES LIKE 'binlog_expire_logs_seconds';"
mysql -uroot -p -e "SHOW VARIABLES LIKE 'expire_logs_days';"
```

> **预防远胜于抢救:**
> 1. 生产必须开 binlog + ROW 格式 + FULL row image,保留期 ≥ 7 天
> 2. 应用账号**不给 DROP / TRUNCATE 权限**
> 3. 客户端开启安全更新模式 `sql_safe_updates = 1`
> 4. 重要操作走审批流程 + 双人复核,先在从库/测试库演练
> 5. 定期备份 + **定期验证恢复**(没演练过的备份不算备份)

## 7.9 常见问题与最佳实践

1. **redo log 保证持久性(崩溃恢复),binlog 保证可归档与复制**,两者不能互相替代
2. **redo log 循环写、binlog 追加写**;redo 是物理日志、binlog 是逻辑日志
3. **双 1 配置**(`innodb_flush_log_at_trx_commit=1` + `sync_binlog=1`)是数据安全底线
4. **binlog_format 用 ROW**:主从一致、支持闪回;STATEMENT 有 `NOW()`/`UUID()`/`LIMIT` 不一致风险
5. **`innodb_log_file_size` 别太小**,否则 checkpoint 追不上会造成周期性写入卡顿
6. **慢日志必开**,`long_query_time` 生产设 0.5~1 秒;重点看 `Rows_examined / Rows_sent` 比值
7. **general log 生产禁用**,只在排查时临时开且用完立刻关
8. **InnoDB 备份用 `mysqldump --single-transaction`**(不锁表),大库用 xtrabackup 物理热备
9. **备份三铁律**:必须校验、必须异地、必须演练恢复
10. **误删数据先 `read_only=ON`**,再用 binlog2sql / MyFlash 闪回;DDL 误操作只能靠全量备份
11. **长事务会让 undo log 无法 purge**,监控 `INNODB_TRX` 并杀掉超时事务
12. **应用账号不给 DROP/TRUNCATE 权限**,开启 `sql_safe_updates`

---

## 本章小结

- 六大日志:**redo**(持久性/崩溃恢复)、**undo**(原子性/MVCC)、**binlog**(复制/时间点恢复)、relay、slow query、error
- **WAL 预写日志**:先顺序写日志再异步刷脏页,用顺序 IO 换随机 IO,是高性能的通用套路
- redo log **循环写 + 物理日志 + InnoDB 层**;binlog **追加写 + 逻辑日志 + Server 层**
- **两阶段提交**保证 redo 与 binlog 一致:redo prepare → binlog → redo commit
- **双 1 配置**最安全;`innodb_flush_log_at_trx_commit` 的 0/1/2 决定崩溃时丢不丢数据
- binlog 三格式:**ROW(推荐)** / STATEMENT(可能主从不一致)/ MIXED
- 慢查询日志的黄金指标是 `Rows_examined / Rows_sent`;分析用 `pt-query-digest`
- 逻辑备份 mysqldump(小库、跨版本)vs 物理备份 xtrabackup(大库、增量、恢复快)
- **PITR 时间点恢复** = 全量备份 + 重放 binlog 到误操作之前
- **闪回**(binlog2sql / MyFlash)利用 ROW binlog 生成逆向 SQL,能救 DML 误操作,救不了 DDL
- 预防优先:ROW binlog 保留 7 天、应用账号无 DROP 权限、备份定期演练恢复
