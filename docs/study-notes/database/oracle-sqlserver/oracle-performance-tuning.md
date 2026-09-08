# Oracle 性能优化与管理

## 性能优化概述

Oracle 性能优化是一个系统工程，需要从多个维度进行分析和调优。

## 等待事件分析

### 什么是等待事件

等待事件是 Oracle 实例在等待某种资源或条件时记录的事件，是性能诊断的核心指标。

### 常见等待事件

```sql
-- 查看当前等待事件
SELECT event, COUNT(*) AS session_count, 
       SUM(time_waited) AS total_wait_time
FROM v$session_event
WHERE wait_class != 'Idle'
GROUP BY event
ORDER BY total_wait_time DESC;

-- 查看当前会话的等待事件
SELECT sid, event, state, seconds_in_wait, wait_time
FROM v$session
WHERE wait_class != 'Idle'
ORDER BY seconds_in_wait DESC;
```

### 等待事件分类

| 等待类 | 说明 | 示例 |
|--------|------|------|
| User I/O | 用户 I/O 等待 | db file sequential read |
| System I/O | 系统 I/O 等待 | log file sync |
| Concurrency | 并发等待 | latch free |
| Application | 应用等待 | enqueue |
| Commit | 提交等待 | log file sync |
| Network | 网络等待 | SQL*Net message from client |

### 常见等待事件及优化

#### db file sequential read
- **含义**：单块读等待（索引查找）
- **优化**：
  - 优化 SQL，减少不必要的索引访问
  - 增加 buffer cache
  - 使用更快的存储

```sql
-- 查找导致大量 sequential read 的 SQL
SELECT sql_id, sql_text, disk_reads, buffer_gets
FROM v$sql
WHERE disk_reads > 1000
ORDER BY disk_reads DESC;
```

#### db file scattered read
- **含义**：多块读等待（全表扫描）
- **优化**：
  - 创建合适的索引避免全表扫描
  - 增加 buffer cache
  - 分区大表

#### log file sync
- **含义**：日志文件同步等待
- **优化**：
  - 使用更快的 redo log 磁盘
  - 增加 redo log 组数
  - 减少提交频率（批量提交）

```sql
-- 查看 redo log 配置
SELECT group#, members, bytes/1024/1024 AS size_mb, status
FROM v$log;
```

## SQL 性能优化

### 执行计划分析

```sql
-- 查看 SQL 执行计划
EXPLAIN PLAN FOR
SELECT * FROM employees WHERE department_id = 10;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- 查看实际执行计划（包含统计信息）
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR);
```

### 执行计划关键指标

| 指标 | 说明 | 优化目标 |
|------|------|----------|
| Cost | 优化器估算的成本 | 越低越好 |
| Rows | 预估返回行数 | 越准确越好 |
| Bytes | 预估数据量 | 越小越好 |
| %Max | 占总成本的百分比 | 重点关注高占比操作 |

### 常见访问路径

```sql
-- TABLE ACCESS FULL（全表扫描）
-- 适用：小表、返回大部分数据
-- 优化：创建索引、分区

-- TABLE ACCESS BY INDEX ROWID（索引访问）
-- 适用：返回少量数据
-- 优化：确保索引选择性高

-- INDEX RANGE SCAN（索引范围扫描）
-- 适用：范围查询
-- 优化：确保索引列在 WHERE 条件中

-- INDEX UNIQUE SCAN（索引唯一扫描）
-- 适用：唯一索引等值查询
-- 最优的访问方式
```

### SQL 优化技巧

#### 1. 避免全表扫描

```sql
-- 不好的写法
SELECT * FROM employees WHERE department_id = 10;

-- 优化：创建索引
CREATE INDEX idx_emp_dept ON employees(department_id);

-- 只查询需要的列
SELECT employee_id, first_name, salary 
FROM employees 
WHERE department_id = 10;
```

#### 2. 使用绑定变量

```sql
-- 不好的写法（硬解析）
EXECUTE IMMEDIATE 'SELECT * FROM employees WHERE employee_id = ' || emp_id;

-- 优化：使用绑定变量（软解析）
EXECUTE IMMEDIATE 'SELECT * FROM employees WHERE employee_id = :1' 
USING emp_id;
```

#### 3. 避免函数导致索引失效

```sql
-- 不好的写法（索引失效）
SELECT * FROM employees WHERE UPPER(last_name) = 'SMITH';

-- 优化：创建函数索引
CREATE INDEX idx_emp_upper_name ON employees(UPPER(last_name));
```

#### 4. 使用提示（Hints）

```sql
-- 强制使用索引
SELECT /*+ INDEX(employees idx_emp_dept) */ *
FROM employees
WHERE department_id = 10;

-- 强制全表扫描
SELECT /*+ FULL(employees) */ *
FROM employees
WHERE department_id = 10;

-- 并行查询
SELECT /*+ PARALLEL(employees, 4) */ *
FROM employees;
```

## 内存优化

### SGA 优化

#### Buffer Cache

```sql
-- 查看 buffer cache 命中率
SELECT 
    ROUND((1 - (phy.value / (cur.value + con.value))) * 100, 2) AS hit_ratio
FROM v$sysstat cur, v$sysstat con, v$sysstat phy
WHERE cur.name = 'db block gets'
  AND con.name = 'consistent gets'
  AND phy.name = 'physical reads';

-- 目标：> 95%
-- 优化：增加 db_cache_size

-- 查看 buffer cache 建议
SELECT size_for_estimate, 
       estd_physical_read_factor,
       estd_physical_reads
FROM v$db_cache_advice
WHERE name = 'DEFAULT';
```

#### Shared Pool

```sql
-- 查看 library cache 命中率
SELECT 
    ROUND((1 - SUM(reloads)/SUM(pins)) * 100, 2) AS hit_ratio
FROM v$librarycache;

-- 目标：> 99%
-- 优化：增加 shared_pool_size

-- 查看硬解析比例
SELECT 
    ROUND(SUM(CASE WHEN executions = 1 THEN 1 ELSE 0 END) / 
          COUNT(*) * 100, 2) AS hard_parse_ratio
FROM v$sql;

-- 目标：< 20%
```

### PGA 优化

```sql
-- 查看 PGA 使用情况
SELECT 
    name, 
    value/1024/1024 AS size_mb
FROM v$pgastat
WHERE name IN (
    'aggregate PGA target parameter',
    'aggregate PGA auto target',
    'total PGA allocated',
    'total PGA used for auto workareas'
);

-- 查看 PGA 建议
SELECT 
    pga_target_for_estimate/1024/1024 AS target_mb,
    estd_pga_cache_hit_percentage AS hit_ratio
FROM v$pga_target_advice
ORDER BY pga_target_for_estimate;
```

## 存储优化

### 表空间管理

```sql
-- 查看表空间使用情况
SELECT 
    tablespace_name,
    ROUND(used_space * 8192 / 1024 / 1024, 2) AS used_mb,
    ROUND(tablespace_size * 8192 / 1024 / 1024, 2) AS total_mb,
    ROUND(used_percent, 2) AS used_percent
FROM dba_tablespace_usage_metrics
ORDER BY used_percent DESC;

-- 查看数据文件
SELECT 
    file_name,
    bytes/1024/1024 AS size_mb,
    autoextensible,
    maxbytes/1024/1024 AS max_size_mb
FROM dba_data_files
ORDER BY tablespace_name;
```

### 表优化

#### 表分区

```sql
-- 范围分区
CREATE TABLE sales (
    sale_id NUMBER,
    sale_date DATE,
    amount NUMBER
)
PARTITION BY RANGE (sale_date) (
    PARTITION p2024 VALUES LESS THAN (TO_DATE('2025-01-01', 'YYYY-MM-DD')),
    PARTITION p2025 VALUES LESS THAN (TO_DATE('2026-01-01', 'YYYY-MM-DD')),
    PARTITION p2026 VALUES LESS THAN (TO_DATE('2027-01-01', 'YYYY-MM-DD')),
    PARTITION pmax VALUES LESS THAN (MAXVALUE)
);

-- 列表分区
CREATE TABLE employees_partitioned (
    employee_id NUMBER,
    department_id NUMBER,
    salary NUMBER
)
PARTITION BY LIST (department_id) (
    PARTITION p_admin VALUES (10),
    PARTITION p_sales VALUES (20, 30),
    PARTITION p_it VALUES (60),
    PARTITION p_other VALUES (DEFAULT)
);

-- 哈希分区
CREATE TABLE transactions (
    transaction_id NUMBER,
    account_id NUMBER,
    amount NUMBER
)
PARTITION BY HASH (transaction_id)
PARTITIONS 8;
```

#### 表压缩

```sql
-- 基本压缩（适合 OLAP）
CREATE TABLE sales_history (
    sale_id NUMBER,
    sale_date DATE,
    amount NUMBER
) COMPRESS;

-- 高级压缩（适合 OLTP，11g+）
CREATE TABLE orders (
    order_id NUMBER,
    order_date DATE,
    customer_id NUMBER
) COMPRESS FOR OLTP;

-- 压缩现有表
ALTER TABLE employees MOVE COMPRESS;
```

### 索引优化

```sql
-- 查看索引使用情况
SELECT 
    index_name,
    table_name,
    blevel,
    leaf_blocks,
    distinct_keys,
    clustering_factor
FROM dba_indexes
WHERE table_name = 'EMPLOYEES';

-- 查看未使用的索引
SELECT 
    index_name,
    table_name,
    used
FROM v$object_usage
WHERE used = 'NO';

-- 重建索引（减少碎片）
ALTER INDEX idx_emp_dept REBUILD;

-- 在线重建（不锁表）
ALTER INDEX idx_emp_dept REBUILD ONLINE;

-- 收集索引统计信息
EXEC DBMS_STATS.GATHER_INDEX_STATS('HR', 'IDX_EMP_DEPT');
```

## 统计信息管理

### 收集统计信息

```sql
-- 收集表统计信息
EXEC DBMS_STATS.GATHER_TABLE_STATS(
    ownname => 'HR',
    tabname => 'EMPLOYEES',
    estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
    method_opt => 'FOR ALL COLUMNS SIZE AUTO',
    cascade => TRUE
);

-- 收集 schema 统计信息
EXEC DBMS_STATS.GATHER_SCHEMA_STATS(
    ownname => 'HR',
    estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
    method_opt => 'FOR ALL COLUMNS SIZE AUTO',
    cascade => TRUE
);

-- 收集数据库统计信息
EXEC DBMS_STATS.GATHER_DATABASE_STATS(
    estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
    method_opt => 'FOR ALL COLUMNS SIZE AUTO',
    cascade => TRUE
);
```

### 查看统计信息

```sql
-- 查看表统计信息
SELECT 
    table_name,
    num_rows,
    blocks,
    avg_row_len,
    last_analyzed
FROM dba_tables
WHERE owner = 'HR' AND table_name = 'EMPLOYEES';

-- 查看列统计信息
SELECT 
    column_name,
    num_distinct,
    low_value,
    high_value,
    density,
    num_nulls
FROM dba_tab_columns
WHERE owner = 'HR' AND table_name = 'EMPLOYEES';

-- 查看直方图
SELECT 
    column_name,
    endpoint_number,
    endpoint_value
FROM dba_tab_histograms
WHERE owner = 'HR' 
  AND table_name = 'EMPLOYEES'
  AND column_name = 'SALARY';
```

### 锁定统计信息

```sql
-- 锁定表统计信息（防止自动收集）
EXEC DBMS_STATS.LOCK_TABLE_STATS('HR', 'EMPLOYEES');

-- 解锁表统计信息
EXEC DBMS_STATS.UNLOCK_TABLE_STATS('HR', 'EMPLOYEES');
```

## 自动管理功能

### Automatic Database Diagnostic Monitor (ADDM)

```sql
-- 查看 ADDM 报告
SELECT task_name, execution_start, execution_end
FROM dba_advisor_tasks
WHERE advisor_name = 'ADDM'
ORDER BY execution_start DESC;

-- 查看 ADDM 建议
SELECT 
    finding_name,
    message,
    more_info
FROM dba_advisor_findings
WHERE task_name = 'ADDM_TASK_123';
```

### Automatic Workload Repository (AWR)

```sql
-- 生成 AWR 报告
-- 使用 SQL*Plus
@?/rdbms/admin/awrrpt.sql

-- 查看 AWR 快照
SELECT 
    snap_id,
    begin_interval_time,
    end_interval_time
FROM dba_hist_snapshot
ORDER BY snap_id DESC
FETCH FIRST 10 ROWS ONLY;

-- 手动创建快照
EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT;

-- 修改快照保留策略
EXEC DBMS_WORKLOAD_REPOSITORY.MODIFY_SNAPSHOT_SETTINGS(
    retention => 30 * 24 * 60,  -- 保留 30 天（分钟）
    interval => 60              -- 每 60 分钟快照一次
);
```

### Automatic SQL Tuning

```sql
-- 运行 SQL Tuning Advisor
DECLARE
    l_task_name VARCHAR2(100);
BEGIN
    l_task_name := DBMS_SQLTUNE.CREATE_TUNING_TASK(
        sql_id => 'abc123def456',
        scope => DBMS_SQLTUNE.SCOPE_COMPREHENSIVE,
        time_limit => 60
    );
    
    DBMS_SQLTUNE.EXECUTE_TUNING_TASK(l_task_name);
    
    DBMS_OUTPUT.PUT_LINE('Task Name: ' || l_task_name);
END;
/

-- 查看调优建议
SELECT DBMS_SQLTUNE.REPORT_TUNING_TASK('task_name') FROM dual;
```

## 会话管理

### 查看活跃会话

```sql
-- 查看当前活跃会话
SELECT 
    sid,
    serial#,
    username,
    program,
    machine,
    status,
    sql_id,
    event
FROM v$session
WHERE status = 'ACTIVE'
  AND username IS NOT NULL
ORDER BY sql_id;

-- 查看长时间运行的 SQL
SELECT 
    s.sid,
    s.serial#,
    s.username,
    s.sql_id,
    q.sql_text,
    s.last_call_et AS seconds_running
FROM v$session s
JOIN v$sql q ON s.sql_id = q.sql_id
WHERE s.status = 'ACTIVE'
  AND s.last_call_et > 300  -- 运行超过 5 分钟
ORDER BY s.last_call_et DESC;
```

### 终止会话

```sql
-- 终止会话
ALTER SYSTEM KILL SESSION 'sid,serial#' IMMEDIATE;

-- 终止会话（等待当前操作完成）
ALTER SYSTEM KILL SESSION 'sid,serial#';

-- 批量终止会话
BEGIN
    FOR rec IN (
        SELECT sid, serial#
        FROM v$session
        WHERE username = 'APP_USER'
          AND program LIKE '%sqlplus%'
    ) LOOP
        EXECUTE IMMEDIATE 'ALTER SYSTEM KILL SESSION ''' || 
                         rec.sid || ',' || rec.serial# || ''' IMMEDIATE';
    END LOOP;
END;
/
```

### 资源管理

```sql
-- 创建资源计划
BEGIN
    DBMS_RESOURCE_MANAGER.CREATE_PLAN(
        plan => 'DAYTIME_PLAN',
        comment => 'Daytime resource plan'
    );
    
    DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(
        plan => 'DAYTIME_PLAN',
        group_or_subplan => 'ONLINE_GROUP',
        mgmt_p1 => 70,  -- 70% CPU
        parallel_degree_limit_p1 => 4
    );
    
    DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(
        plan => 'DAYTIME_PLAN',
        group_or_subplan => 'BATCH_GROUP',
        mgmt_p1 => 30,  -- 30% CPU
        parallel_degree_limit_p1 => 8
    );
END;
/

-- 激活资源计划
ALTER SYSTEM SET resource_manager_plan = 'DAYTIME_PLAN';
```

## 性能监控脚本

### 日常监控脚本

```sql
-- 1. 系统概览
SELECT 
    (SELECT COUNT(*) FROM v$session WHERE status = 'ACTIVE') AS active_sessions,
    (SELECT COUNT(*) FROM v$session WHERE status = 'INACTIVE') AS inactive_sessions,
    (SELECT value FROM v$sysmetric WHERE metric_name = 'Database CPU Time Ratio') AS cpu_ratio,
    (SELECT value FROM v$sysmetric WHERE metric_name = 'Buffer Cache Hit Ratio') AS buffer_hit_ratio;

-- 2. Top SQL by CPU
SELECT 
    sql_id,
    sql_text,
    cpu_time/1000000 AS cpu_seconds,
    executions,
    cpu_time/NULLIF(executions,0)/1000000 AS cpu_per_exec
FROM v$sql
ORDER BY cpu_time DESC
FETCH FIRST 10 ROWS ONLY;

-- 3. Top SQL by I/O
SELECT 
    sql_id,
    sql_text,
    disk_reads,
    buffer_gets,
    executions,
    disk_reads/NULLIF(executions,0) AS reads_per_exec
FROM v$sql
ORDER BY disk_reads DESC
FETCH FIRST 10 ROWS ONLY;

-- 4. 表空间使用率
SELECT 
    tablespace_name,
    ROUND(used_percent, 2) AS used_percent,
    ROUND(used_space * 8192 / 1024 / 1024, 2) AS used_mb
FROM dba_tablespace_usage_metrics
WHERE used_percent > 80
ORDER BY used_percent DESC;
```

### 性能基线

```sql
-- 创建性能基线
EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_BASELINE(
    start_snap_id => 1000,
    end_snap_id => 1100,
    baseline_name => 'NORMAL_WORKLOAD'
);

-- 查看基线
SELECT 
    baseline_name,
    start_snap_id,
    end_snap_id,
    baseline_type
FROM dba_hist_baseline;
```

## 性能优化最佳实践

1. **建立性能基线**：记录正常负载下的性能指标
2. **定期收集统计信息**：确保优化器有准确的统计信息
3. **监控等待事件**：关注 Top 5 等待事件
4. **优化 Top SQL**：重点关注消耗资源最多的 SQL
5. **使用绑定变量**：减少硬解析
6. **合理设计索引**：避免过多或过少的索引
7. **分区大表**：提高查询性能和管理效率
8. **定期维护**：重建索引、收集统计信息、清理历史数据
9. **使用 AWR 和 ADDM**：自动化性能诊断
10. **容量规划**：预测未来增长，提前扩容
