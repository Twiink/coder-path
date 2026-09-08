# Oracle 高可用架构

## 高可用概述

Oracle 提供多种高可用解决方案，从单机高可用到多活集群，满足不同业务场景的 RPO（恢复点目标）和 RTO（恢复时间目标）要求。

## Oracle RAC（Real Application Clusters）

### RAC 架构

RAC 是 Oracle 的集群数据库解决方案，多个实例共享同一个数据库存储，提供高可用和负载均衡。

```text
RAC 架构：
┌─────────────────────────────────────────┐
│           共享存储（ASM/集群文件系统）      │
│  ┌──────────────────────────────────┐   │
│  │  数据文件、控制文件、重做日志       │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
    │ 实例 1  │   │ 实例 2  │   │ 实例 3  │
    │ (节点1) │   │ (节点2) │   │ (节点3) │
    └─────────┘   └─────────┘   └─────────┘
```

### RAC 优势

- **高可用**：节点故障时自动切换到其他节点
- **负载均衡**：多个实例同时处理请求
- **可扩展性**：通过增加节点提升处理能力
- **滚动升级**：可以逐个节点升级，减少停机时间

### RAC 关键组件

#### 1. 集群件（Grid Infrastructure）

```bash
# 查看集群状态
crsctl stat res -t

# 查看集群节点
olsnodes -n

# 查看 VIP 状态
oifcfg getif

# 查看 ASM 磁盘组
asmcmd lsdg
```

#### 2. 共享存储（ASM）

```sql
-- 创建 ASM 磁盘组
CREATE DISKGROUP data NORMAL REDUNDANCY
    DISK '/dev/oracleasm/disks/DISK1',
         '/dev/oracleasm/disks/DISK2',
         '/dev/oracleasm/disks/DISK3'
    ATTRIBUTE 'compatible.asm' = '19.0',
              'compatible.rdbms' = '19.0';

-- 查看磁盘组信息
SELECT name, state, type, total_mb, free_mb
FROM v$asm_diskgroup;

-- 查看磁盘信息
SELECT name, path, total_mb, free_mb
FROM v$asm_disk;

-- 创建表空间（使用 ASM）
CREATE TABLESPACE users
    DATAFILE '+DATA/ORCL/datafile/users01.dbf' SIZE 1G
    AUTOEXTEND ON NEXT 100M MAXSIZE 10G;
```

#### 3. 服务（Services）

```sql
-- 创建服务
srvctl add service -db ORCL -service OLTP_SERVICE \
    -preferred orcl1,orcl2 -available orcl3

-- 启动服务
srvctl start service -db ORCL -service OLTP_SERVICE

-- 查看服务状态
srvctl status service -db ORCL

-- 配置服务的负载均衡和故障转移
EXEC DBMS_SERVICE.MODIFY_SERVICE(
    service_name => 'OLTP_SERVICE',
    failover_method => DBMS_SERVICE.FAILOVER_METHOD_BASIC,
    failover_type => DBMS_SERVICE.FAILOVER_TYPE_SELECT,
    failover_retries => 180,
    failover_delay => 1
);
```

### RAC 连接配置

#### 客户端连接字符串

```text
# TNS 配置（tnsnames.ora）
ORCL_RAC =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = rac-scan)(PORT = 1521))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = OLTP_SERVICE)
    )
  )

# 使用 SCAN（Single Client Access Name）
# SCAN 提供单一访问点，自动负载均衡
```

#### JDBC 连接

```java
// JDBC 连接字符串
String url = "jdbc:oracle:thin:@(DESCRIPTION=" +
    "(ADDRESS=(PROTOCOL=TCP)(HOST=rac-scan)(PORT=1521))" +
    "(CONNECT_DATA=(SERVICE_NAME=OLTP_SERVICE)))";

// 或使用 UCP（Universal Connection Pool）
PoolDataSource pds = PoolDataSourceFactory.getPoolDataSource();
pds.setConnectionFactoryClassName("oracle.jdbc.pool.OracleDataSource");
pds.setURL("jdbc:oracle:thin:@//rac-scan:1521/OLTP_SERVICE");
pds.setConnectionPoolName("RAC_POOL");
pds.setMinPoolSize(10);
pds.setMaxPoolSize(50);
```

### RAC 管理和监控

```sql
-- 查看集群数据库信息
SELECT inst_id, instance_name, host_name, status
FROM gv$instance;

-- 查看全局会话
SELECT inst_id, COUNT(*) AS session_count
FROM gv$session
GROUP BY inst_id;

-- 查看全局等待事件
SELECT inst_id, event, COUNT(*) AS wait_count
FROM gv$session
WHERE wait_class != 'Idle'
GROUP BY inst_id, event
ORDER BY inst_id, wait_count DESC;

-- 查看全局锁
SELECT inst_id, type, id1, id2, lmode, request
FROM gv$lock
WHERE type IN ('TM', 'TX');
```

### RAC 故障转移

```sql
-- 配置 TAF（Transparent Application Failover）
ALTER SYSTEM SET service_name = 'OLTP_SERVICE'
    FAILOVER_METHOD = BASIC
    FAILOVER_TYPE = SELECT
    FAILOVER_RETRIES = 180
    FAILOVER_DELAY = 1;

-- 查看 TAF 配置
SELECT service_name, failover_method, failover_type,
       failover_retries, failover_delay
FROM dba_services;
```

### RAC 最佳实践

1. **使用 SCAN**：提供单一访问点，简化客户端配置
2. **配置服务**：按应用类型分配不同的服务
3. **使用 ASM**：简化存储管理，提供自动条带化
4. **监控 Cache Fusion**：关注全局缓存相关的等待事件
5. **优化 SQL**：减少跨实例的数据访问
6. **定期测试故障转移**：确保高可用性

## Oracle Data Guard

### Data Guard 架构

Data Guard 提供数据保护和灾难恢复，通过维护一个或多个备库来保护主库数据。

```text
Data Guard 架构：
┌─────────────┐          ┌─────────────┐
│  主库        │  Redo    │  物理备库    │
│  (Primary)  │ ───────> │  (Physical  │
│             │  传输     │   Standby)  │
└─────────────┘          └─────────────┘
                                │
                                │ 可选
                                ↓
                         ┌─────────────┐
                         │  逻辑备库    │
                         │  (Logical   │
                         │   Standby)  │
                         └─────────────┘
```

### Data Guard 保护模式

| 模式 | 说明 | 性能 | 数据保护 |
|------|------|------|----------|
| **最大性能** | 异步传输 | 最高 | 可能丢失少量数据 |
| **最大可用** | 同步传输，失败时降级为异步 | 中等 | 高 |
| **最大保护** | 同步传输，必须确认 | 最低 | 最高，不丢数据 |

### 配置物理备库

#### 1. 主库配置

```sql
-- 启用强制日志
ALTER DATABASE FORCE LOGGING;

-- 创建备用重做日志
ALTER DATABASE ADD STANDBY LOGFILE 
    GROUP 4 SIZE 50M,
    GROUP 5 SIZE 50M,
    GROUP 6 SIZE 50M,
    GROUP 7 SIZE 50M;

-- 配置归档
ALTER SYSTEM SET log_archive_dest_1 = 
    'LOCATION=/u01/app/oracle/arch VALID_FOR=(ALL_LOGFILES,ALL_ROLES) DB_UNIQUE_NAME=primary';

ALTER SYSTEM SET log_archive_dest_2 = 
    'SERVICE=standby ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=standby';

ALTER SYSTEM SET log_archive_config = 
    'DG_CONFIG=(primary,standby)';

ALTER SYSTEM SET fal_server = 'standby';
ALTER SYSTEM SET fal_client = 'primary';
ALTER SYSTEM SET standby_file_management = 'AUTO';
```

#### 2. 备库配置

```sql
-- 配置归档
ALTER SYSTEM SET log_archive_dest_1 = 
    'LOCATION=/u01/app/oracle/arch VALID_FOR=(ALL_LOGFILES,ALL_ROLES) DB_UNIQUE_NAME=standby';

ALTER SYSTEM SET log_archive_dest_2 = 
    'SERVICE=primary ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=primary';

ALTER SYSTEM SET log_archive_config = 
    'DG_CONFIG=(primary,standby)';

ALTER SYSTEM SET fal_server = 'primary';
ALTER SYSTEM SET fal_client = 'standby';
ALTER SYSTEM SET standby_file_management = 'AUTO';
```

#### 3. 创建备库

```sql
-- 使用 RMAN 从活动数据库创建备库
rman target sys/password@primary auxiliary sys/password@standby

RMAN> DUPLICATE TARGET DATABASE FOR STANDBY
      FROM ACTIVE DATABASE
      DORECOVER
      NOFILENAMECHECK;

-- 启动备库的 Redo Apply
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE 
    USING CURRENT LOGFILE DISCONNECT FROM SESSION;
```

### Data Guard Broker

```sql
-- 启用 Data Guard Broker
ALTER SYSTEM SET dg_broker_start = TRUE;

-- 连接到 DGMGRL
dgmgrl sys/password@primary

-- 创建配置
DGMGRL> CREATE CONFIGURATION 'DG_CONFIG' AS
        PRIMARY DATABASE IS primary
        CONNECT IDENTIFIER IS primary;

-- 添加备库
DGMGRL> ADD DATABASE standby AS
        CONNECT IDENTIFIER IS standby
        MAINTAINED AS PHYSICAL;

-- 启用配置
DGMGRL> ENABLE CONFIGURATION;

-- 查看配置状态
DGMGRL> SHOW CONFIGURATION;

-- 查看备库状态
DGMGRL> SHOW DATABASE VERBOSE standby;
```

### 角色转换

#### Switchover（计划内切换）

```sql
-- 使用 Data Guard Broker
DGMGRL> SWITCHOVER TO standby;

-- 手动 Switchover
-- 主库：
ALTER DATABASE COMMIT TO SWITCHOVER TO STANDBY;
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;

-- 备库：
ALTER DATABASE COMMIT TO SWITCHOVER TO PRIMARY;
SHUTDOWN IMMEDIATE;
STARTUP;

-- 原主库（现在是备库）：
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;
```

#### Failover（故障切换）

```sql
-- 使用 Data Guard Broker
DGMGRL> FAILOVER TO standby;

-- 手动 Failover
-- 备库：
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE FINISH;
ALTER DATABASE COMMIT TO SWITCHOVER TO PRIMARY;
SHUTDOWN IMMEDIATE;
STARTUP;
```

### Active Data Guard

Active Data Guard 允许备库在应用日志的同时提供只读查询服务。

```sql
-- 启用 Active Data Guard
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;
ALTER DATABASE OPEN READ ONLY;
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE 
    USING CURRENT LOGFILE DISCONNECT FROM SESSION;

-- 配置只读服务
srvctl add service -db standby -service REPORT_SERVICE \
    -role PHYSICAL_STANDBY

-- 查看备库状态
SELECT database_role, open_mode, protection_mode
FROM v$database;
```

### 监控 Data Guard

```sql
-- 查看归档日志应用情况
SELECT sequence#, first_time, next_time, applied
FROM v$archived_log
WHERE dest_id = 1
ORDER BY sequence# DESC
FETCH FIRST 10 ROWS ONLY;

-- 查看 Redo 传输延迟
SELECT name, value, datum_time
FROM v$dataguard_stats
WHERE name IN ('transport lag', 'apply lag');

-- 查看 Redo 传输状态
SELECT dest_id, status, error, gap_status
FROM v$archive_dest_status
WHERE dest_id = 2;
```

## Oracle GoldenGate

### GoldenGate 架构

GoldenGate 提供实时数据复制和集成，支持异构数据库和双向复制。

```text
GoldenGate 架构：
┌─────────────┐          ┌─────────────┐
│  源数据库    │          │  目标数据库  │
│             │          │             │
│  Extract    │  Trail   │  Replicat   │
│  (捕获)     │ ───────> │  (应用)     │
└─────────────┘  文件    └─────────────┘
```

### GoldenGate 配置

#### 1. 源端配置

```sql
-- 启用补充日志
ALTER DATABASE ADD SUPPLEMENTAL LOG DATA;
ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (PRIMARY KEY) COLUMNS;

-- 为特定表启用补充日志
ADD TRANDATA hr.employees
ADD TRANDATA hr.departments
```

```bash
-- 配置 Extract 进程
GGSCI> ADD EXTRACT ext1, TRANLOG, BEGIN NOW
GGSCI> ADD EXTTRAIL ./dirdat/et, EXTRACT ext1

-- 编辑 Extract 参数
GGSCI> EDIT PARAMS ext1

EXTRACT ext1
USERID ggate, PASSWORD password
EXTTRAIL ./dirdat/et
TABLE hr.employees;
TABLE hr.departments;

-- 配置 Data Pump
GGSCI> ADD EXTRACT pump1, EXTTRAILSOURCE ./dirdat/et
GGSCI> ADD RMTTRAIL ./dirdat/rt, EXTRACT pump1

-- 编辑 Data Pump 参数
GGSCI> EDIT PARAMS pump1

EXTRACT pump1
RMTHOST target_host, MGRPORT 7809
RMTTRAIL ./dirdat/rt
PASSTHRU
TABLE hr.*;
```

#### 2. 目标端配置

```bash
-- 配置 Replicat 进程
GGSCI> ADD REPLICAT rep1, EXTTRAIL ./dirdat/rt

-- 编辑 Replicat 参数
GGSCI> EDIT PARAMS rep1

REPLICAT rep1
USERID ggate, PASSWORD password
MAP hr.employees, TARGET hr.employees;
MAP hr.departments, TARGET hr.departments;

-- 启动进程
GGSCI> START EXTRACT ext1
GGSCI> START EXTRACT pump1
GGSCI> START REPLICAT rep1
```

### GoldenGate 监控

```bash
-- 查看进程状态
GGSCI> INFO ALL

-- 查看 Extract 状态
GGSCI> INFO EXTRACT ext1

-- 查看 Replicat 状态
GGSCI> INFO REPLICAT rep1

-- 查看延迟
GGSCI> LAG EXTRACT ext1
GGSCI> LAG REPLICAT rep1

-- 查看统计信息
GGSCI> STATS EXTRACT ext1
GGSCI> STATS REPLICAT rep1
```

## Oracle Sharding

### Sharding 架构

Oracle Sharding 提供水平扩展能力，将数据分布到多个独立的数据库（Shard）上。

```text
Sharding 架构：
┌─────────────────────────────────────────┐
│           Shard Director (GDS)          │
│         全局服务目录和路由               │
└─────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
    │ Shard 1 │   │ Shard 2 │   │ Shard 3 │
    │ (分片1) │   │ (分片2) │   │ (分片3) │
    └─────────┘   └─────────┘   └─────────┘
```

### Sharding 配置

```sql
-- 创建分片目录数据库
CREATE DATABASE shard_catalog;

-- 配置分片目录
EXEC DBMS_GSM_ADMIN.CREATE_SHARDCATALOG(
    catalog => 'shard_catalog',
    chunks => 12
);

-- 添加 Shard
EXEC DBMS_GSM_ADMIN.ADD_SHARD(
    shard_name => 'shard1',
    connect_string => 'host1:1521/shard1'
);

EXEC DBMS_GSM_ADMIN.ADD_SHARD(
    shard_name => 'shard2',
    connect_string => 'host2:1521/shard2'
);

-- 创建分片表
CREATE SHARDED TABLE customers (
    customer_id NUMBER,
    customer_name VARCHAR2(100),
    region VARCHAR2(50)
)
PARTITIONSET BY LIST (region)
PARTITION BY CONSISTENT HASH (customer_id)
PARTITIONS AUTO
(
    PARTITIONSET p_americas VALUES ('AMERICAS'),
    PARTITIONSET p_emea VALUES ('EMEA'),
    PARTITIONSET p_apac VALUES ('APAC')
);

-- 创建分片区表（每个 Shard 都有完整副本）
CREATE DUPLICATED TABLE countries (
    country_id NUMBER PRIMARY KEY,
    country_name VARCHAR2(100)
);
```

### Sharding 查询

```sql
-- 查询自动路由到正确的 Shard
SELECT * FROM customers WHERE customer_id = 12345;

-- 跨 Shard 查询（需要协调）
SELECT region, COUNT(*) AS customer_count
FROM customers
GROUP BY region;

-- 多 Shard 查询
SELECT c.customer_name, co.country_name
FROM customers c
JOIN countries co ON c.country_id = co.country_id
WHERE c.customer_id = 12345;
```

## 高可用最佳实践

### 选择合适的高可用方案

| 场景 | 推荐方案 | RPO | RTO |
|------|----------|-----|-----|
| 单机高可用 | RAC | 0 | 秒级 |
| 异地容灾 | Data Guard | 秒级 | 分钟级 |
| 读写分离 | Active Data Guard | 秒级 | 分钟级 |
| 数据集成 | GoldenGate | 秒级 | 分钟级 |
| 水平扩展 | Sharding | 0 | 秒级 |

### 高可用设计原则

1. **消除单点故障**：所有关键组件都要有冗余
2. **自动化故障检测**：使用健康检查和监控
3. **快速故障恢复**：自动化故障转移流程
4. **定期测试**：定期演练故障场景
5. **文档化**：详细记录高可用架构和操作流程
