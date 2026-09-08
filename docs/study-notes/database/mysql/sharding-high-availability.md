---
title: "分库分表与高可用"
aliases:
  - "MySQL主从复制"
  - "MySQL读写分离"
  - "分库分表"
tags:
  - "后端"
  - "数据库"
  - "mysql"
  - "架构"
  - "高可用"
  - "笔记"
category: "后端"
folder: "MySQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MySQL/日志与备份恢复]]"
  - "[[后端/数据库/MySQL/慢查询与性能优化]]"
  - "[[后端/数据库/Redis/Redis集群]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 09 分库分表与高可用

单机 MySQL 的能力有上限:读扛不住要读写分离,写扛不住或数据存不下要分库分表,不能宕机要高可用。本章覆盖:主从复制原理与搭建、读写分离、分库分表策略与中间件、分布式 ID、跨分片查询难题、高可用方案(MHA/MGR/Orchestrator)。

## 9.1 主从复制

### 复制原理

```text
       主库 Master                            从库 Slave
   ┌──────────────────┐              ┌──────────────────────────┐
   │ ① 事务提交         │              │                          │
   │    写 binlog       │              │                          │
   │    ↓               │              │                          │
   │ binlog dump 线程 ──┼──② 推送────→ │ IO 线程                   │
   │                    │   binlog     │    ↓ 写入                 │
   │                    │              │ relay log(中继日志)       │
   │                    │              │    ↓                      │
   │                    │              │ ③ SQL 线程(重放)          │
   │                    │              │    ↓                      │
   │                    │              │ 数据落盘,与主库一致         │
   └──────────────────┘              └──────────────────────────┘

三个线程:
  主库:binlog dump thread(每个从库一个,推送 binlog)
  从库:IO thread(接收 binlog 写入 relay log)
       SQL thread / worker threads(读 relay log 并重放)
```

**复制的三种模式:**

| 模式 | 行为 | 数据安全 | 性能 |
| --- | --- | --- | --- |
| **异步复制**(默认) | 主库提交后**不等**从库,立即返回客户端 | 主库宕机可能丢未同步的数据 | 最好 |
| **半同步复制** | 主库提交后**等至少一个从库**写入 relay log 并 ACK 才返回 | 基本不丢(至少一份在从库) | 中(多一次网络往返) |
| **全同步复制** | 等所有从库都重放完成 | 不丢 | 最差(MySQL 原生不支持,MGR 接近) |

```sql
-- 开启半同步复制(需装插件)
-- 主库
INSTALL PLUGIN rpl_semi_sync_master SONAME 'semisync_master.so';
SET GLOBAL rpl_semi_sync_master_enabled = 1;
SET GLOBAL rpl_semi_sync_master_timeout = 1000;   -- 等 1 秒,超时退化为异步
-- 从库
INSTALL PLUGIN rpl_semi_sync_slave SONAME 'semisync_slave.so';
SET GLOBAL rpl_semi_sync_slave_enabled = 1;
```

### 搭建主从复制

```ini
# ---- 主库 my.cnf ----
[mysqld]
server-id = 1                      # 【必须】每个节点唯一
log_bin = /var/lib/mysql/mysql-bin # 【必须】开启 binlog
binlog_format = ROW                # 推荐 ROW
binlog_do_db = mydb                # 可选:只复制指定库
# binlog_ignore_db = mysql         # 可选:忽略指定库
gtid_mode = ON                     # 推荐开启 GTID(见下)
enforce_gtid_consistency = ON
sync_binlog = 1
innodb_flush_log_at_trx_commit = 1
```

```ini
# ---- 从库 my.cnf ----
[mysqld]
server-id = 2                      # 【必须】与主库不同
relay_log = /var/lib/mysql/relay-bin
log_bin = /var/lib/mysql/mysql-bin # 从库也开 binlog(级联复制/故障转移需要)
log_slave_updates = ON             # 把重放的变更也写入自己的 binlog
gtid_mode = ON
enforce_gtid_consistency = ON
read_only = ON                     # 从库只读(super 仍可写,建议 super_read_only)
super_read_only = ON
```

```sql
-- 步骤 1:主库创建复制账号
CREATE USER 'repl'@'192.168.1.%' IDENTIFIED WITH mysql_native_password BY 'Repl@Pass123';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'192.168.1.%';
FLUSH PRIVILEGES;

-- 步骤 2:主库备份数据并记录 binlog 位置
-- (用 mysqldump --master-data=2 会自动在文件里写位置)
SHOW MASTER STATUS;
-- +------------------+----------+
-- | File             | Position |
-- | mysql-bin.000003 |     1234 |
```

```bash
# 步骤 3:把主库数据导入从库
mysqldump -uroot -p --all-databases --single-transaction \
  --master-data=2 --routines --triggers --events > master_backup.sql
mysql -uroot -p < master_backup.sql      # 在从库执行
```

```sql
-- 步骤 4:从库配置指向主库
-- 传统方式(基于 binlog 文件 + 位置)
CHANGE MASTER TO
    MASTER_HOST = '192.168.1.100',
    MASTER_USER = 'repl',
    MASTER_PASSWORD = 'Repl@Pass123',
    MASTER_LOG_FILE = 'mysql-bin.000003',
    MASTER_LOG_POS = 1234;

-- GTID 方式(推荐,不用管文件名和位置)
CHANGE MASTER TO
    MASTER_HOST = '192.168.1.100',
    MASTER_USER = 'repl',
    MASTER_PASSWORD = 'Repl@Pass123',
    MASTER_AUTO_POSITION = 1;

-- 8.0.23+ 新语法
CHANGE REPLICATION SOURCE TO
    SOURCE_HOST = '192.168.1.100',
    SOURCE_USER = 'repl',
    SOURCE_PASSWORD = 'Repl@Pass123',
    SOURCE_AUTO_POSITION = 1;

-- 步骤 5:启动复制
START SLAVE;                    -- 8.0.22+ 用 START REPLICA;
-- IO_THREAD 与 SQL_THREAD 分别启动:START SLAVE IO_THREAD;

-- 步骤 6:检查状态
SHOW SLAVE STATUS\G             -- 8.0.22+ 用 SHOW REPLICA STATUS\G
```

**`SHOW SLAVE STATUS` 的关键字段:**

| 字段 | 健康值 | 含义 |
| --- | --- | --- |
| `Slave_IO_Running` | **Yes** | IO 线程运行中(接收 binlog) |
| `Slave_SQL_Running` | **Yes** | SQL 线程运行中(重放) |
| `Seconds_Behind_Master` | **0 或很小** | 复制延迟(秒) |
| `Last_IO_Error` | 空 | IO 线程错误 |
| `Last_SQL_Error` | 空 | SQL 线程错误 |
| `Retrieved_Gtid_Set` / `Executed_Gtid_Set` | 逐渐追平 | GTID 进度 |

> **两个 Running 必须都是 Yes**,任何一个 No 都要看对应的 Error 排查。

### GTID 复制(强烈推荐)

**GTID(Global Transaction Identifier,全局事务标识符):** 每个事务有全局唯一 ID,格式 `server_uuid:transaction_id`,如 `3E11FA47-...:23`。

```sql
-- 查看 GTID 配置与执行情况
SHOW VARIABLES LIKE 'gtid_mode';           -- ON
SELECT @@GLOBAL.gtid_executed;             -- 已执行的 GTID 集合
SELECT @@GLOBAL.gtid_purged;               -- 已从 binlog 清除的 GTID

-- GTID 的最大好处:故障转移时不用手动找 binlog 文件和位置
-- 新从库只需:CHANGE MASTER TO ... MASTER_AUTO_POSITION = 1;
-- MySQL 自动计算缺失的事务并同步
```

| 传统复制 | GTID 复制 |
| --- | --- |
| 靠 binlog 文件名 + 位置定位 | 靠全局事务 ID |
| 主从切换要手动查位置,易错 | **自动定位**,切换简单可靠 |
| 位置在级联复制中难维护 | GTID 全局一致 |

> **GTID 的限制:** 不支持 `CREATE TABLE ... SELECT`(8.0.13 前)、不支持临时表在事务内创建、`sql_slave_skip_counter` 改用 `SET GTID_NEXT` 跳过。生产新项目一律开 GTID。

### 复制延迟问题(主从延迟)

**现象:** 写完主库立即读从库,读不到刚写的数据。

```text
主从延迟的原因:
  ① 从库单线程重放(5.6 前)→ 主库并发写,从库串行重放,追不上
  ② 从库机器配置差 / 承担大量读
  ③ 大事务:主库执行 10 分钟的大 UPDATE,从库也要重放 10 分钟
  ④ 网络延迟
  ⑤ 从库上的 DDL(加索引)阻塞重放
```

**解决方案:**

```ini
# ① 开启并行复制(核心手段)
# MySQL 5.7:基于组提交,同一组提交的事务可并行重放
slave_parallel_type = LOGICAL_CLOCK
slave_parallel_workers = 8              # 重放线程数

# MySQL 8.0.22+:基于 WRITESET,冲突检测更精细,并行度更高
binlog_transaction_dependency_tracking = WRITESET
transaction_write_set_extraction = XXHASH64
replica_parallel_type = LOGICAL_CLOCK
replica_parallel_workers = 8
```

```sql
-- ② 避免大事务:大批量写拆成小批
-- ❌ UPDATE huge_table SET x=1;         (锁全表 + 从库重放数分钟)
-- ✅ 分批 UPDATE ... LIMIT 5000 循环

-- ③ 从库配置别太差,别挂太多读流量

-- ④ 业务层容忍延迟:对一致性要求高的读走主库
-- "写后立即读"的场景强制读主库(见读写分离)
```

```sql
-- 监控延迟
SHOW SLAVE STATUS\G    -- 看 Seconds_Behind_Master
-- 更精确:用 pt-heartbeat 工具(写入时间戳,从库算差值)
```

> **`Seconds_Behind_Master` 的局限:** 它只反映"SQL 线程正在处理的事件时间戳"与从库当前时间的差,网络中断时会显示 0 或 NULL,不完全可靠。生产用 `pt-heartbeat` 或监控 GTID 差集。

## 9.2 读写分离

```text
        应用
         │
    ┌────┴─────┐
    │ 读写分离  │  ← 中间件 or 应用层路由
    │  代理层   │
    └────┬─────┘
   写 ↓      ↓ 读
  ┌──────┐  ┌──────┐ ┌──────┐
  │ 主库  │→ │ 从库1 │ │ 从库2 │
  └──────┘  └──────┘ └──────┘
      复制同步 ↗  ↗
```

### 两种实现方式

| 方式 | 说明 | 代表 | 优点 | 缺点 |
| --- | --- | --- | --- | --- |
| **应用层路由** | 代码里判断读/写,选不同数据源 | Django 多数据库、Spring `AbstractRoutingDataSource`、ShardingSphere-JDBC | 无额外组件、灵活 | 侵入代码、每个应用都要实现 |
| **中间件代理** | 独立代理层,应用连代理当普通 MySQL | MyCat、ProxySQL、MaxScale、ShardingSphere-Proxy | 对应用透明、集中管理 | 多一层网络与运维、代理本身要高可用 |

```python
# Django 读写分离示例(应用层路由)
# settings.py
DATABASES = {
    'default': {  # 主库,写
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'mydb', 'HOST': 'master.db', ...
    },
    'slave': {  # 从库,读
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'mydb', 'HOST': 'slave.db', ...
    },
}
DATABASE_ROUTERS = ['myapp.db_router.PrimaryReplicaRouter']

# db_router.py
import random
class PrimaryReplicaRouter:
    def db_for_read(self, model, **hints):
        # 读走从库(可随机选多个从库做负载均衡)
        return 'slave' if random.random() > 0.1 else 'default'  # 10% 读主库兜底
    def db_for_write(self, model, **hints):
        return 'default'    # 写永远走主库
    def allow_relation(self, obj1, obj2, **hints):
        return True         # 同一个库的副本,允许关联
```

### 读写分离的核心难题:主从延迟导致读到旧数据

```text
用户下单 → 写主库 → 立即跳转订单详情 → 读从库 → 从库还没同步 → "订单不存在"!
```

**解决方案:**

| 方案 | 做法 | 适用 |
| --- | --- | --- |
| **强制读主库** | 写后立即读的关键场景,直接查主库 | 下单后查详情、改密码后登录 |
| **半同步复制** | 主库等从库 ACK,降低延迟 | 能容忍一点性能损耗 |
| **缓存标记** | 写操作后在 Redis 标记 `user:123:writing`,TTL 1 秒,期间读主库 | 精细控制 |
| **会话一致性** | 同一用户的读固定路由到主库一段时间 | 用户级一致性 |
| **等待 GTID** | `WAIT_FOR_EXECUTED_GTID_SET`,等从库追上指定事务再读 | 强一致要求 |

```sql
-- WAIT_FOR_EXECUTED_GTID_SET:阻塞等待从库执行到指定 GTID
SELECT WAIT_FOR_EXECUTED_GTID_SET('3E11FA47-...:1-23', 5);   -- 最多等 5 秒
-- 返回 0 = 已追上,1 = 超时

-- MySQL 5.7+ 的 WAIT_FOR_SQL_THREAD_TO_CATCH_UP(自定义)
```

> **读写分离的前提是能容忍最终一致。** 大多数互联网业务(商品列表、Feed 流)可以容忍毫秒级延迟;涉及钱、权限、状态机的强一致读写必须走主库。**先想清楚一致性要求,再决定读写分离的边界。**

## 9.3 分库分表

### 什么时候需要分库分表

```text
优先考虑(成本低):
  ① 优化 SQL 与索引(8.3/8.4)
  ② 加缓存(挡读)
  ③ 读写分离(扩读)
  ④ 冷热分离 / 归档(减小热表)
  ⑤ 垂直拆分(按业务拆库)

实在扛不住才水平分库分表(成本高):
  · 单表数据量 > 2000 万行 或 单表 > 20GB(B+ 树变 4 层,IO 增加)
  · 单库写入 QPS 超过单机上限(连接数、IO、CPU 打满)
  · 单机磁盘容量不够
```

> **分库分表是"最后的手段",能不分就不分。** 它带来的复杂度(跨库 JOIN、分布式事务、全局唯一 ID、扩容迁移、分页排序)远超想象。阿里手册也强调单表超 500 万行"才考虑"分库分表,且优先考虑归档、读写分离等轻量方案。

### 垂直拆分 vs 水平拆分

```text
垂直拆分(按业务/字段拆):
  拆分前:一个库一张大宽表
  垂直分库:user 库、order 库、product 库(按业务模块)
  垂直分表:user 主表(高频字段)+ user_ext 副表(低频/大字段)

水平拆分(按行拆,结构相同):
  拆分前:order 表 1 亿行
  水平分表:order_0, order_1, ... order_31(32 张结构相同的表)
  水平分库:db_0.order_*, db_1.order_*(分散到多个库,突破单机上限)
```

| | 垂直拆分 | 水平拆分 |
| --- | --- | --- |
| 拆分依据 | 业务模块 / 字段冷热 | 数据行(按规则散列) |
| 解决 | 业务耦合、单表过宽 | 单表数据量过大、单机容量 |
| 复杂度 | 低 | **高**(路由、跨库查询、分布式事务) |
| 是否改表结构 | 是 | 否(各分片结构一致) |

### 水平拆分的分片策略(Sharding Key)

| 策略 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **范围分片** Range | 按 id/时间范围:id 1~1000 → 表0,1001~2000 → 表1 | 扩容简单(加新范围)、范围查询友好 | **易热点**(最新数据都写最后一个分片) |
| **哈希取模** Hash | `hash(user_id) % N` | 数据均匀、无热点 | **扩容要迁移大量数据**(N 变了全乱) |
| **一致性哈希** | 哈希环 + 虚拟节点 | 扩容只迁移相邻节点数据 | 实现复杂,可能不均匀 |
| **查表路由** | 用映射表记录 key→分片 | 灵活,可动态调整 | 多一次查表,映射表是瓶颈 |
| **按业务字段** | 按 city、tenant_id 分 | 天然隔离(多租户) | 分布可能不均 |

```sql
-- 哈希取模示例:按 user_id 分 32 张表
-- 路由规则:table_index = user_id % 32
-- 查询用户 10086 的订单:10086 % 32 = 22 → 查 order_22

-- 分片键的选择原则:
-- ① 高频查询条件必须包含分片键(否则要查所有分片)
-- ② 数据分布均匀(避免热点)
-- ③ 尽量不变(变了要迁移数据)
```

> **分片键(Sharding Key)选择是分库分表最关键的决策:**
> - **订单表**:业务上既按 `user_id` 查(我的订单),又按 `order_id` 查(订单详情)。选 user_id 做分片键 → 按 order_id 查要广播所有分片。
> - **解决方案**:① 用 `order_id` 内嵌 `user_id` 信息(基因法);② 建立 order_id → user_id 的映射表;③ 异构索引(冗余一份按 order_id 分片的表)。

### 分库分表中间件

| 中间件 | 类型 | 语言 | 特点 |
| --- | --- | --- | --- |
| **ShardingSphere-JDBC** | 客户端(增强版 JDBC) | Java | 无独立部署、性能好、生态最活跃;仅 Java |
| **ShardingSphere-Proxy** | 独立代理 | Java | 对应用透明、跨语言;多一层网络 |
| **MyCat** | 独立代理 | Java | 老牌,社区活跃下降 |
| **Vitess** | 独立代理 | Go | YouTube 出品,云原生,K8s 友好 |
| **TDDL** | 客户端 | Java | 阿里内部,不开源 |
| **ProxySQL** | 独立代理 | C++ | 轻量,读写分离强,分片能力弱 |

```yaml
# ShardingSphere-JDBC 配置示例(分表)
rules:
- !SHARDING
  tables:
    t_order:
      actualDataNodes: ds_${0..1}.t_order_${0..15}   # 2 库 × 16 表 = 32 分片
      databaseStrategy:
        standard:
          shardingColumn: user_id
          shardingAlgorithmName: db_mod              # 库路由:user_id % 2
      tableStrategy:
        standard:
          shardingColumn: order_id
          shardingAlgorithmName: table_mod           # 表路由:order_id % 16
      keyGenerateStrategy:
        column: order_id
        keyGeneratorName: snowflake                  # 分布式 ID
  shardingAlgorithms:
    db_mod:
      type: MOD
      props: {sharding-count: 2}
    table_mod:
      type: MOD
      props: {sharding-count: 16}
```

### 分库分表带来的难题(必须提前想清楚)

| 难题 | 说明 | 解决方案 |
| --- | --- | --- |
| **跨分片 JOIN** | 不同库的表无法直接 JOIN | 字段冗余、全局表(每个分片存一份字典表)、应用层组装、绑定表(相同分片键的表放一起) |
| **跨分片分页排序** | `ORDER BY x LIMIT 100,10` 要在每个分片取 110 条再归并 | 归并排序(内存压力大)、禁止深分页、二次查询法 |
| **分布式事务** | 跨库写无法用本地事务 | 柔性事务:Seata、TCC、本地消息表、最终一致(见下) |
| **全局唯一 ID** | 自增主键在分片间会重复 | 雪花算法、号段模式、UUID、Redis INCR(见 9.4) |
| **跨分片聚合** | `COUNT`/`SUM`/`GROUP BY` 要合并各分片结果 | 中间件自动归并、或预计算汇总表 |
| **扩容数据迁移** | 哈希取模扩容要重新分布数据 | 双写迁移、一致性哈希、翻倍扩容法 |
| **非分片键查询** | 不带分片键的查询要广播所有分片 | 建异构索引表、搜索引擎(ES)、映射表 |

```text
跨分片分页的归并问题(内存杀手):
  需求:全局第 100000 页,每页 10 条(LIMIT 999990, 10)
  32 个分片,每个都要返回前 1000000 条 → 中间件要在内存归并 3200 万条!
  
解决:
  · 业务禁止深分页(只允许顺序翻页,游标分页)
  · 用 ES 做全局排序分页,MySQL 只存明细
  · 二次查询:先各分片取 min 值定位范围,再精确查
```

### 平滑扩容:翻倍扩容法

```text
问题:哈希取模 % 16 扩容到 % 32,几乎所有数据的分片都变了 → 全量迁移

翻倍扩容法(减少迁移量):
  ① 从 16 个分片扩容到 32 个(翻倍),新分片是旧分片的"分裂"
  ② order_0 的数据按新规则拆到 order_0 和 order_16
     (原来 hash%16==0 的,现在 hash%32 只可能是 0 或 16)
  ③ 每个旧分片只需迁移一半数据到对应新分片,不用全局重分布
  
更优:一开始就规划足够多的【逻辑分片】(如 1024 个),
     物理上用少量库表承载(如 16 库 × 64 表),
     扩容时只迁移逻辑分片到新的物理库,不改变路由规则
```

### 分布式事务方案

| 方案 | 一致性 | 性能 | 复杂度 | 适用 |
| --- | --- | --- | --- | --- |
| **XA / 2PC** | 强一致 | 差(同步阻塞) | 中 | 传统金融,并发低 |
| **TCC**(Try-Confirm-Cancel) | 最终一致 | 好 | **高**(要写三个接口) | 资金类,要求高 |
| **本地消息表** | 最终一致 | 好 | 中 | 大多数互联网场景 |
| **事务消息**(RocketMQ) | 最终一致 | 好 | 中 | 有 MQ 基础设施 |
| **SAGA** | 最终一致 | 好 | 中 | 长流程业务 |
| **Seata AT** | 最终一致 | 中 | 低(自动补偿) | Java 生态,快速接入 |

```text
本地消息表方案(最实用的最终一致):
  ① 业务操作与"消息记录"在【同一个本地事务】里写入
     BEGIN;
       UPDATE account SET balance = balance - 100 WHERE id = 1;
       INSERT INTO msg (target, payload, status) VALUES ('order_svc', '...', 'PENDING');
     COMMIT;                       ← 要么都成功要么都失败
  ② 后台任务轮询 msg 表,把 PENDING 消息投递到 MQ / 调用下游
  ③ 下游处理成功后回调,标记 msg 为 DONE
  ④ 下游要幂等(同一消息可能重投)
```

> **分布式事务的铁律:能用最终一致就不用强一致。** 强一致(2PC/XA)同步阻塞,性能差且协调者单点。互联网业务绝大多数用"本地事务 + 消息 + 幂等 + 对账"实现最终一致,配合定时对账任务兜底修复不一致。

## 9.4 分布式全局唯一 ID

分库分表后,自增主键会冲突(每个库都从 1 开始),需要全局唯一 ID 方案。

| 方案 | 原理 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **UUID** | 128 位随机 | 本地生成,无依赖 | **无序 → 页分裂、索引膨胀**;36 字符占空间 |
| **数据库自增(号段)** | 单独一个库发号,每次取一段(如 1000 个)缓存本地 | 趋势递增、简单 | 号段库是单点(可双 buffer 缓解) |
| **Redis INCR** | Redis 原子自增 | 性能高、有序 | 依赖 Redis 持久化与可用性 |
| **雪花算法 Snowflake** | 时间戳 + 机器 ID + 序列号 | **趋势递增、本地生成、高性能** | 依赖时钟,**时钟回拨会重复** |
| **美团 Leaf / 百度 UidGenerator** | 号段 + 雪花的生产级实现 | 成熟可靠 | 需要部署 |

### 雪花算法(Snowflake)结构

```text
64 位 long:
  0 | 41 位时间戳(毫秒) | 10 位机器 ID | 12 位序列号
  ↑   ↑                    ↑              ↑
 符号 可用 69 年           1024 台机器    每毫秒每机 4096 个
 位                        (5 位数据中心 + 5 位工作机器)

特点:
  · 整体【趋势递增】(时间戳在高位)→ 适合做 InnoDB 主键,不会页分裂
  · 本地生成,不依赖网络,性能极高(单机每毫秒 4096 个)
  · 不暴露业务量(不像自增 ID 能被猜测总数)
```

```python
# 雪花算法的 Python 简化实现
import time

class Snowflake:
    def __init__(self, worker_id: int, datacenter_id: int):
        self.worker_id = worker_id & 0x1F          # 5 位
        self.datacenter_id = datacenter_id & 0x1F  # 5 位
        self.sequence = 0
        self.last_ts = -1
        self.epoch = 1704067200000                 # 自定义起始时间(2024-01-01)

    def _now(self):
        return int(time.time() * 1000)

    def next_id(self) -> int:
        ts = self._now()
        if ts < self.last_ts:                      # 时钟回拨!
            raise RuntimeError(f"时钟回拨 {self.last_ts - ts} ms,拒绝生成 ID")
        if ts == self.last_ts:
            self.sequence = (self.sequence + 1) & 0xFFF   # 12 位,4096
            if self.sequence == 0:                 # 当前毫秒序列用完,等下一毫秒
                while ts <= self.last_ts:
                    ts = self._now()
        else:
            self.sequence = 0
        self.last_ts = ts
        return ((ts - self.epoch) << 22) | (self.datacenter_id << 17) \
               | (self.worker_id << 12) | self.sequence
```

> **雪花算法的时钟回拨问题:** 如果服务器时间被 NTP 往回调,可能生成重复 ID。解决:① 检测到回拨时抛异常/等待;② 用扩展位记录回拨次数;③ 部署时钟同步监控。
> **ID 趋势递增对 InnoDB 至关重要**:随机 ID(UUID)会导致 B+ 树到处插入、页分裂、索引碎片;趋势递增 ID 总是追加在最右侧,写入性能高数倍。这是"不要用 UUID 做主键"的根本原因。

## 9.5 高可用方案(HA)

**目标:** 主库宕机时,自动或快速切换到从库,减少不可用时间。

```text
高可用演进:
  ① 手动切换:主库挂了,DBA 手动提升从库(慢,RTO 分钟级)
  ② 半自动:MHA/Orchestrator 检测故障 + 自动提升从库(RTO 秒~分钟级)
  ③ 自动多主:MGR(Group Replication)/ InnoDB Cluster(自动选主,RTO 秒级)
```

| 方案 | 说明 | 特点 |
| --- | --- | --- |
| **MHA**(Master High Availability) | 经典方案,监控主库,故障时提升最新从库 | Perl 编写,已停止维护,但生产仍广泛使用 |
| **Orchestrator** | GitHub 出品,可视化拓扑管理 + 自动故障转移 | Go 编写,支持 GTID,Web UI |
| **MGR**(MySQL Group Replication) | 官方多主/单主复制,基于 Paxos 协议 | 自动选主、强一致、官方支持(5.7.17+) |
| **InnoDB Cluster** | MGR + MySQL Shell + Router 的完整方案 | 官方一体化 HA 方案 |
| **MySQL Router** | 官方代理,配合 InnoDB Cluster 自动路由 | 感知集群拓扑 |
| **Keepalived + VIP** | 主库挂时 VIP 漂移到从库 | 简单,但需要自己处理数据一致性 |

### MGR(MySQL Group Replication)

```text
MGR 基于 Paxos 变种(XCom)实现多节点一致性:
  · 单主模式:一个节点可写(Primary),其余只读,主挂了自动选新主
  · 多主模式:所有节点都可写,靠冲突检测保证一致(实际较少用,冲突多)
  
事务提交时需要【多数派(majority)】确认:
  3 节点集群,至少 2 个确认才提交 → 容忍 1 个节点故障
  5 节点集群,至少 3 个确认 → 容忍 2 个故障
```

```sql
-- MGR 关键配置(my.cnf,每个节点)
[mysqld]
server-id = 1
gtid_mode = ON
enforce_gtid_consistency = ON
binlog_format = ROW
log_slave_updates = ON
master_info_repository = TABLE
relay_log_info_repository = TABLE
transaction_write_set_extraction = XXHASH64

plugin_load_add = 'group_replication.so'
group_replication_group_name = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
group_replication_local_address = "192.168.1.101:33061"
group_replication_group_seeds = "192.168.1.101:33061,192.168.1.102:33061,192.168.1.103:33061"
group_replication_single_primary_mode = ON       -- 单主模式

-- 启动集群(第一个节点引导)
SET GLOBAL group_replication_bootstrap_group = ON;
START GROUP_REPLICATION;
SET GLOBAL group_replication_bootstrap_group = OFF;

-- 其他节点直接加入
START GROUP_REPLICATION;

-- 查看集群状态
SELECT * FROM performance_schema.replication_group_members;
SELECT * FROM performance_schema.replication_group_member_stats;
```

> **MGR 的网络分区(脑裂)防护:** 多数派机制天然防止脑裂 —— 少数派节点无法达成多数确认,会自动变为不可写。这是它比"Keepalived + VIP"更安全的地方(VIP 方案脑裂时两个主库都接受写,数据冲突)。

### 高可用的数据一致性风险

```text
异步复制 + 自动故障转移的经典风险:
  主库 M 收到事务 T,返回客户端"成功",但还没同步到从库 S
  M 突然宕机
  HA 系统把 S 提升为新主库
  → 事务 T 永久丢失!客户端以为成功了,实际没了

缓解:
  · 半同步复制(至少一个从库 ACK 才算成功)
  · MGR 多数派确认
  · 双 1 配置(至少主库本地不丢)
  · 业务幂等 + 对账修复
```

## 9.6 常见问题与最佳实践

1. **能不分库分表就不分**:先优化 SQL/索引、加缓存、读写分离、归档、垂直拆分,实在扛不住再水平拆分
2. **分片键选择决定成败**:必须是高频查询条件、分布均匀、尽量不变;订单表按 user_id 还是 order_id 要慎重(基因法/映射表/异构索引)
3. **主从复制两个 Running 必须 Yes**,监控 `Seconds_Behind_Master` 与 GTID 差集
4. **开 GTID + 并行复制(WRITESET)**:GTID 让故障转移自动定位,并行复制降低延迟
5. **读写分离要处理主从延迟**:强一致读走主库,或用半同步/等待 GTID
6. **半同步复制**比异步更安全(至少一份在从库),代价是延迟略增
7. **分布式全局 ID 用雪花算法**(趋势递增,对 InnoDB 友好),不用 UUID(页分裂)
8. **分布式事务优先最终一致**:本地消息表 / 事务消息 / Seata,配幂等 + 对账,慎用 XA
9. **跨分片查询是最大痛点**:JOIN、分页、聚合都难,提前设计冗余与汇总表
10. **高可用选 MGR / Orchestrator**(基于 GTID + 多数派),比 Keepalived+VIP 更能防脑裂
11. **扩容用翻倍法或逻辑分片预规划**(一次规划 1024 逻辑分片),避免全量迁移
12. **主从延迟严重时**,检查大事务、从库配置、并行复制参数

---

## 本章小结

- **主从复制**三线程:主库 binlog dump → 从库 IO 线程写 relay log → SQL 线程重放;模式分异步(默认)/半同步/全同步
- **GTID** 全局事务 ID 让故障转移自动定位,新项目必开;**并行复制(WRITESET)** 降低主从延迟
- **读写分离**扩读能力,核心难题是主从延迟读到旧数据 → 强一致读走主库
- **分库分表是最后手段**:垂直拆(按业务/字段)成本低,水平拆(按行)复杂度高
- 水平分片策略:范围(易热点)/ 哈希取模(扩容难)/ 一致性哈希 / 逻辑分片预规划
- **分片键选择**是最关键决策,要兼顾高频查询、均匀分布、稳定性
- 分库分表七大难题:跨片 JOIN、跨片分页排序、分布式事务、全局 ID、跨片聚合、扩容迁移、非分片键查询
- **分布式 ID 首选雪花算法**(趋势递增 + 本地生成),注意时钟回拨;UUID 因无序导致页分裂不可取
- **分布式事务用最终一致**(本地消息表/TCC/Seata)+ 幂等 + 对账,慎用强一致的 XA/2PC
- **高可用**:MHA(经典)/ Orchestrator(可视化)/ MGR(官方 Paxos 多数派,防脑裂);异步复制 + 自动切换有丢数据风险,用半同步或 MGR 缓解
