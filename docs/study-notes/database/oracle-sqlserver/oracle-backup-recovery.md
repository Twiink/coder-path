# Oracle 备份与恢复

## 备份恢复概述

Oracle 提供多种备份恢复方案，从简单的逻辑备份到企业级的物理备份和容灾方案。

## RMAN（Recovery Manager）

RMAN 是 Oracle 推荐的备份恢复工具，支持物理备份和增量备份。

### RMAN 架构

```text
RMAN 组件：
├── RMAN 客户端（命令行工具）
├── 目标数据库（要备份的数据库）
├── 恢复目录（可选，存储备份元数据）
└── 备份介质（磁盘或磁带）
```

### RMAN 基本配置

```sql
-- 连接到 RMAN
rman target /

-- 查看 RMAN 配置
SHOW ALL;

-- 配置备份位置
CONFIGURE CONTROLFILE AUTOBACKUP ON;
CONFIGURE CONTROLFILE AUTOBACKUP FORMAT FOR DEVICE TYPE DISK 
    TO '/backup/rman/%F';

-- 配置备份保留策略
CONFIGURE RETENTION POLICY TO REDUNDANCY 2;  -- 保留 2 份完整备份
-- 或
CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 7 DAYS;  -- 保留 7 天

-- 配置并行度
CONFIGURE DEVICE TYPE DISK PARALLELISM 4;

-- 配置压缩
CONFIGURE COMPRESSION ALGORITHM 'MEDIUM';
CONFIGURE DEVICE TYPE DISK BACKUP TYPE TO COMPRESSED BACKUPSET;

-- 配置自动备份控制文件
CONFIGURE CONTROLFILE AUTOBACKUP ON;
```

### 全库备份

```sql
-- 全库备份（包含归档日志）
BACKUP DATABASE PLUS ARCHIVELOG;

-- 全库备份（指定格式）
BACKUP DATABASE 
    FORMAT '/backup/rman/full_%U_%T.bkp'
    TAG 'FULL_BACKUP';

-- 全库备份（压缩）
BACKUP AS COMPRESSED BACKUPSET DATABASE 
    FORMAT '/backup/rman/full_%U_%T.bkp';

-- 全库备份（包含控制文件和 SPFILE）
BACKUP DATABASE 
    INCLUDE CURRENT CONTROLFILE
    FORMAT '/backup/rman/full_%U_%T.bkp';
```

### 增量备份

```sql
-- Level 0 增量备份（基准备份）
BACKUP INCREMENTAL LEVEL 0 DATABASE 
    FORMAT '/backup/rman/inc0_%U_%T.bkp'
    TAG 'INC_LEVEL_0';

-- Level 1 累积增量备份（备份自 Level 0 以来的所有变化）
BACKUP INCREMENTAL LEVEL 1 CUMULATIVE DATABASE 
    FORMAT '/backup/rman/inc1c_%U_%T.bkp'
    TAG 'INC_LEVEL_1_CUMULATIVE';

-- Level 1 差异增量备份（备份自上次 Level 1 以来的变化）
BACKUP INCREMENTAL LEVEL 1 DATABASE 
    FORMAT '/backup/rman/inc1d_%U_%T.bkp'
    TAG 'INC_LEVEL_1_DIFFERENTIAL';
```

### 归档日志备份

```sql
-- 备份所有归档日志
BACKUP ARCHIVELOG ALL;

-- 备份指定范围的归档日志
BACKUP ARCHIVELOG FROM TIME 'SYSDATE-7';

-- 备份并删除已备份的归档日志
BACKUP ARCHIVELOG ALL DELETE INPUT;

-- 备份归档日志（指定序列号范围）
BACKUP ARCHIVELOG FROM SEQUENCE 100 UNTIL SEQUENCE 200;
```

### 表空间和数据文件备份

```sql
-- 备份表空间
BACKUP TABLESPACE users, system;

-- 备份数据文件
BACKUP DATAFILE 1, 2, 3;

-- 备份数据文件（按名称）
BACKUP DATAFILE '/u01/app/oracle/oradata/ORCL/users01.dbf';
```

### 控制文件和参数文件备份

```sql
-- 备份控制文件
BACKUP CURRENT CONTROLFILE 
    FORMAT '/backup/rman/control_%U_%T.ctl';

-- 备份 SPFILE
BACKUP SPFILE 
    FORMAT '/backup/rman/spfile_%U_%T.ora';

-- 备份控制文件为文本格式
ALTER DATABASE BACKUP CONTROLFILE TO TRACE 
    AS '/backup/rman/control_trace.sql';
```

### 备份集和备份片段管理

```sql
-- 列出所有备份
LIST BACKUP;

-- 列出备份摘要
LIST BACKUP SUMMARY;

-- 列出指定备份
LIST BACKUP TAG 'FULL_BACKUP';

-- 列出归档日志备份
LIST BACKUP OF ARCHIVELOG ALL;

-- 列出控制文件备份
LIST BACKUP OF CONTROLFILE;

-- 列出过期备份
LIST EXPIRED BACKUP;

-- 列出废弃备份（根据保留策略）
REPORT OBSOLETE;

-- 删除过期备份
DELETE EXPIRED BACKUP;

-- 删除废弃备份
DELETE OBSOLETE;

-- 删除指定备份
DELETE BACKUP TAG 'FULL_BACKUP';

-- 交叉检查（验证备份是否存在）
CROSSCHECK BACKUP;
CROSSCHECK ARCHIVELOG ALL;
```

## 恢复操作

### 完全恢复

```sql
-- 恢复整个数据库
RESTORE DATABASE;
RECOVER DATABASE;
ALTER DATABASE OPEN;

-- 恢复表空间
RESTORE TABLESPACE users;
RECOVER TABLESPACE users;
ALTER TABLESPACE users ONLINE;

-- 恢复数据文件
RESTORE DATAFILE 4;
RECOVER DATAFILE 4;
ALTER DATABASE DATAFILE 4 ONLINE;
```

### 不完全恢复

```sql
-- 恢复到指定时间点
RESTORE DATABASE UNTIL TIME "TO_DATE('2026-01-15 10:00:00', 'YYYY-MM-DD HH24:MI:SS')";
RECOVER DATABASE UNTIL TIME "TO_DATE('2026-01-15 10:00:00', 'YYYY-MM-DD HH24:MI:SS')";
ALTER DATABASE OPEN RESETLOGS;

-- 恢复到指定 SCN
RESTORE DATABASE UNTIL SCN 1234567;
RECOVER DATABASE UNTIL SCN 1234567;
ALTER DATABASE OPEN RESETLOGS;

-- 恢复到指定日志序列号
RESTORE DATABASE UNTIL SEQUENCE 100;
RECOVER DATABASE UNTIL SEQUENCE 100;
ALTER DATABASE OPEN RESETLOGS;
```

### 块介质恢复

```sql
-- 恢复损坏的数据块
BLOCKRECOVER DATAFILE 4 BLOCK 20;

-- 从备份恢复损坏的块
BLOCKRECOVER DATAFILE 4 BLOCK 20 FROM BACKUPSET;

-- 使用 V$DATABASE_BLOCK_CORRUPTION 视图
SELECT file#, block#, blocks, corruption_type
FROM v$database_block_corruption;

BLOCKRECOVER CORRUPTION LIST;
```

### 表空间时间点恢复（TSPITR）

```sql
-- 恢复表空间到指定时间点
RECOVER TABLESPACE users 
    UNTIL TIME "TO_DATE('2026-01-15 10:00:00', 'YYYY-MM-DD HH24:MI:SS')";

-- 使用辅助实例进行 TSPITR
RECOVER TABLESPACE users 
    UNTIL TIME "TO_DATE('2026-01-15 10:00:00', 'YYYY-MM-DD HH24:MI:SS')"
    AUXILIARY DESTINATION '/u01/app/oracle/aux';
```

## 闪回技术

### 闪回查询

```sql
-- 查询过去某个时间点的数据
SELECT * FROM employees 
AS OF TIMESTAMP TO_TIMESTAMP('2026-01-15 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE employee_id = 100;

-- 查询过去某个 SCN 的数据
SELECT * FROM employees 
AS OF SCN 1234567
WHERE employee_id = 100;

-- 查看数据的变化历史
SELECT versions_starttime, versions_endtime, 
       versions_operation, employee_id, salary
FROM employees
VERSIONS BETWEEN TIMESTAMP MINVALUE AND MAXVALUE
WHERE employee_id = 100;
```

### 闪回表

```sql
-- 启用行移动（闪回表的前提）
ALTER TABLE employees ENABLE ROW MOVEMENT;

-- 闪回表到过去某个时间点
FLASHBACK TABLE employees 
TO TIMESTAMP TO_TIMESTAMP('2026-01-15 10:00:00', 'YYYY-MM-DD HH24:MI:SS');

-- 闪回表到过去某个 SCN
FLASHBACK TABLE employees TO SCN 1234567;

-- 闪回多个表
FLASHBACK TABLE employees, departments 
TO TIMESTAMP TO_TIMESTAMP('2026-01-15 10:00:00', 'YYYY-MM-DD HH24:MI:SS');
```

### 闪回删除

```sql
-- 查看回收站
SELECT object_name, original_name, type, droptime
FROM user_recyclebin;

-- 恢复被删除的表
FLASHBACK TABLE employees TO BEFORE DROP;

-- 恢复并重命名
FLASHBACK TABLE employees TO BEFORE DROP RENAME TO employees_restored;

-- 清空回收站
PURGE RECYCLEBIN;

-- 清空指定表
PURGE TABLE employees;

-- 清空整个回收站（DBA）
PURGE DBA_RECYCLEBIN;
```

### 闪回数据库

```sql
-- 启用闪回数据库
ALTER DATABASE FLASHBACK ON;

-- 设置闪回保留时间
ALTER SYSTEM SET DB_FLASHBACK_RETENTION_TARGET = 1440;  -- 24 小时

-- 闪回数据库到指定时间点
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
FLASHBACK DATABASE TO TIMESTAMP TO_TIMESTAMP('2026-01-15 10:00:00', 'YYYY-MM-DD HH24:MI:SS');
ALTER DATABASE OPEN RESETLOGS;

-- 闪回数据库到指定 SCN
FLASHBACK DATABASE TO SCN 1234567;

-- 查看闪回日志
SELECT * FROM v$flashback_database_log;
```

## 数据泵（Data Pump）

数据泵是 Oracle 10g 引入的高速数据导出导入工具，替代了传统的 exp/imp。

### 导出数据

```sql
-- 创建目录对象
CREATE OR REPLACE DIRECTORY dp_dir AS '/backup/datapump';
GRANT READ, WRITE ON DIRECTORY dp_dir TO hr;

-- 导出整个数据库
expdp system/password DIRECTORY=dp_dir DUMPFILE=full_db.dmp FULL=Y

-- 导出 schema
expdp hr/password DIRECTORY=dp_dir DUMPFILE=hr_schema.dmp SCHEMAS=hr

-- 导出表
expdp hr/password DIRECTORY=dp_dir DUMPFILE=emp_dept.dmp TABLES=employees,departments

-- 导出表（带查询条件）
expdp hr/password DIRECTORY=dp_dir DUMPFILE=emp_filtered.dmp 
    TABLES=employees QUERY="WHERE department_id=10"

-- 并行导出
expdp hr/password DIRECTORY=dp_dir DUMPFILE=hr_%U.dmp SCHEMAS=hr PARALLEL=4

-- 压缩导出
expdp hr/password DIRECTORY=dp_dir DUMPFILE=hr_compressed.dmp 
    SCHEMAS=hr COMPRESSION=ALL

-- 加密导出
expdp hr/password DIRECTORY=dp_dir DUMPFILE=hr_encrypted.dmp 
    SCHEMAS=hr ENCRYPTION=ALL ENCRYPTION_PASSWORD=mypassword
```

### 导入数据

```sql
-- 导入整个数据库
impdp system/password DIRECTORY=dp_dir DUMPFILE=full_db.dmp FULL=Y

-- 导入 schema
impdp hr/password DIRECTORY=dp_dir DUMPFILE=hr_schema.dmp SCHEMAS=hr

-- 导入表
impdp hr/password DIRECTORY=dp_dir DUMPFILE=emp_dept.dmp TABLES=employees,departments

-- 重映射 schema
impdp system/password DIRECTORY=dp_dir DUMPFILE=hr_schema.dmp 
    REMAP_SCHEMA=hr:hr_new

-- 重映射表空间
impdp hr/password DIRECTORY=dp_dir DUMPFILE=hr_schema.dmp 
    REMAP_TABLESPACE=users:users_new

-- 并行导入
impdp hr/password DIRECTORY=dp_dir DUMPFILE=hr_%U.dmp SCHEMAS=hr PARALLEL=4

-- 只导入元数据
impdp hr/password DIRECTORY=dp_dir DUMPFILE=hr_schema.dmp 
    SCHEMAS=hr CONTENT=METADATA_ONLY

-- 只导入数据
impdp hr/password DIRECTORY=dp_dir DUMPFILE=hr_schema.dmp 
    SCHEMAS=hr CONTENT=DATA_ONLY
```

### 监控数据泵作业

```sql
-- 查看数据泵作业状态
SELECT owner_name, job_name, operation, job_mode, state
FROM dba_datapump_jobs;

-- 附加到运行中的作业
expdp ATTACH=SYS_EXPORT_SCHEMA_01

-- 在附加会话中执行命令
STATUS
PARALLEL=8
CONTINUE_CLIENT
```

## 传统导出导入（exp/imp）

虽然已被数据泵取代，但在某些旧系统中仍在使用。

### 导出

```bash
# 导出整个数据库
exp system/password FILE=full_db.dmp FULL=Y

# 导出 schema
exp hr/password FILE=hr_schema.dmp OWNER=hr

# 导出表
exp hr/password FILE=emp_dept.dmp TABLES=(employees,departments)

# 导出表（带查询条件）
exp hr/password FILE=emp_filtered.dmp TABLES=employees QUERY="WHERE department_id=10"
```

### 导入

```bash
# 导入整个数据库
imp system/password FILE=full_db.dmp FULL=Y

# 导入 schema
imp hr/password FILE=hr_schema.dmp FROMUSER=hr TOUSER=hr

# 导入表
imp hr/password FILE=emp_dept.dmp TABLES=(employees,departments)

# 导入时忽略错误
imp hr/password FILE=hr_schema.dmp FROMUSER=hr TOUSER=hr IGNORE=Y
```

## 备份恢复最佳实践

### 备份策略

1. **全库备份**：每周一次
2. **增量备份**：每天一次
3. **归档日志备份**：每小时一次或更频繁
4. **控制文件备份**：每次结构变更后
5. **异地备份**：至少保留一份异地备份

### 备份验证

```sql
-- 验证备份完整性
RESTORE DATABASE VALIDATE;

-- 验证备份可恢复性
RESTORE DATABASE TEST;

-- 定期进行恢复演练
-- 建议每季度进行一次完整的恢复测试
```

### 监控和告警

```sql
-- 查看备份作业状态
SELECT session_key, input_type, status, 
       TO_CHAR(start_time, 'YYYY-MM-DD HH24:MI:SS') AS start_time,
       TO_CHAR(end_time, 'YYYY-MM-DD HH24:MI:SS') AS end_time,
       elapsed_seconds
FROM v$rman_backup_job_details
ORDER BY session_key DESC;

-- 查看备份文件大小
SELECT backup_type, 
       ROUND(SUM(bytes)/1024/1024/1024, 2) AS size_gb,
       COUNT(*) AS file_count
FROM v$backup_piece_details
GROUP BY backup_type;
```

## 灾难恢复方案

### 多站点备份

```sql
-- 配置多个备份位置
CONFIGURE CHANNEL DEVICE TYPE DISK FORMAT '/backup1/rman/%U', '/backup2/rman/%U';

-- 使用 RMAN 复制数据库到远程
DUPLICATE TARGET DATABASE TO standby_db
    FROM ACTIVE DATABASE
    DORECOVER
    NOFILENAMECHECK;
```

### 云备份

```sql
-- 配置 Oracle Cloud Infrastructure (OCI) 备份
CONFIGURE CHANNEL DEVICE TYPE SBT 
    PARMS 'SBT_LIBRARY=/u01/app/oracle/lib/libosbws.so,
           SBT_PARMS=(OSB_WS_PFILE=/u01/app/oracle/config/osbws_pfile.ora)';

-- 备份到云
BACKUP DATABASE TAG 'CLOUD_BACKUP' CHANNEL DEVICE TYPE SBT;
```

## 性能优化

### 备份性能

```sql
-- 增加并行度
CONFIGURE DEVICE TYPE DISK PARALLELISM 8;

-- 使用压缩
CONFIGURE COMPRESSION ALGORITHM 'MEDIUM';

-- 调整缓冲区大小
CONFIGURE CHANNEL DEVICE TYPE DISK 
    MAXOPENFILES 16
    MAXPIECESIZE 2G;
```

### 恢复性能

```sql
-- 并行恢复
RECOVER DATABASE PARALLEL 4;

-- 使用 NOREDO 跳过归档应用（如果只需要恢复到备份时间点）
RESTORE DATABASE NOREDO;
```
