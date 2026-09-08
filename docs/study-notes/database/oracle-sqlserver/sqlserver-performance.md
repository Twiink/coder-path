# SQL Server 性能优化

## 1. 索引优化

### 1.1 索引类型

```sql
-- 聚集索引（Clustered Index）
-- 每个表只能有一个，决定数据的物理存储顺序
CREATE CLUSTERED INDEX IX_Employees_EmployeeID 
ON Employees(EmployeeID);

-- 非聚集索引（Nonclustered Index）
-- 可以有多个，独立于数据存储
CREATE NONCLUSTERED INDEX IX_Employees_Name 
ON Employees(LastName, FirstName);

-- 包含列索引（Covering Index）
-- 包含非键列，避免键查找
CREATE NONCLUSTERED INDEX IX_Employees_Department
ON Employees(DepartmentID)
INCLUDE (FirstName, LastName, Salary);

-- 筛选索引（Filtered Index）
-- 只索引满足条件的行
CREATE NONCLUSTERED INDEX IX_Employees_Active
ON Employees(Status)
WHERE Status = 'Active';

-- 唯一索引
CREATE UNIQUE INDEX IX_Employees_Email
ON Employees(Email);
```

### 1.2 索引维护

```sql
-- 查看索引碎片
SELECT 
    OBJECT_NAME(object_id) AS TableName,
    index_id,
    avg_fragmentation_in_percent
FROM sys.dm_db_index_physical_stats
    (DB_ID(), NULL, NULL, NULL, 'LIMITED')
WHERE avg_fragmentation_in_percent > 10
ORDER BY avg_fragmentation_in_percent DESC;

-- 重建索引（碎片 > 30%）
ALTER INDEX IX_Employees_Name ON Employees REBUILD;

-- 重组索引（碎片 10%-30%）
ALTER INDEX IX_Employees_Name ON Employees REORGANIZE;

-- 更新统计信息
UPDATE STATISTICS Employees;

-- 更新所有统计信息
EXEC sp_updatestats;
```

### 1.3 缺失索引分析

```sql
-- 查看缺失索引建议
SELECT 
    mid.statement AS TableName,
    mid.equality_columns,
    mid.inequality_columns,
    mid.included_columns,
    migs.avg_total_user_cost * migs.avg_user_impact * 
        (migs.user_seeks + migs.user_scans) AS ImprovementMeasure
FROM sys.dm_db_missing_index_details mid
INNER JOIN sys.dm_db_missing_index_groups mig 
    ON mid.index_handle = mig.index_handle
INNER JOIN sys.dm_db_missing_index_group_stats migs 
    ON mig.index_group_handle = migs.group_handle
ORDER BY ImprovementMeasure DESC;
```

## 2. 查询优化

### 2.1 执行计划分析

```sql
-- 显示执行计划
SET SHOWPLAN_ALL ON;
GO
SELECT * FROM Employees WHERE DepartmentID = 1;
GO
SET SHOWPLAN_ALL OFF;
GO

-- 显示实际执行计划（包含运行时统计）
SET STATISTICS IO ON;
SET STATISTICS TIME ON;
GO
SELECT * FROM Employees WHERE DepartmentID = 1;
GO
SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
GO

-- 使用 SSMS 图形化执行计划
-- 快捷键：Ctrl+M（实际执行计划）、Ctrl+L（估计执行计划）
```

### 2.2 查询优化技巧

```sql
-- 避免 SELECT *
-- ❌ 不好
SELECT * FROM Employees;

-- ✅ 好
SELECT EmployeeID, FirstName, LastName FROM Employees;

-- 使用 EXISTS 替代 IN（当子查询结果集大时）
-- ❌ 不好
SELECT * FROM Employees
WHERE DepartmentID IN (
    SELECT DepartmentID FROM Departments WHERE Location = 'Beijing'
);

-- ✅ 好
SELECT e.* FROM Employees e
WHERE EXISTS (
    SELECT 1 FROM Departments d 
    WHERE d.DepartmentID = e.DepartmentID 
    AND d.Location = 'Beijing'
);

-- 避免在 WHERE 子句中对列使用函数
-- ❌ 不好（索引失效）
SELECT * FROM Employees 
WHERE YEAR(HireDate) = 2023;

-- ✅ 好（索引有效）
SELECT * FROM Employees 
WHERE HireDate >= '2023-01-01' AND HireDate < '2024-01-01';

-- 使用 UNION ALL 替代 UNION（如果不需要去重）
-- ❌ 不好（会排序去重）
SELECT FirstName FROM Employees
UNION
SELECT FirstName FROM Customers;

-- ✅ 好（不去重，性能更好）
SELECT FirstName FROM Employees
UNION ALL
SELECT FirstName FROM Customers;

-- 避免前导通配符
-- ❌ 不好（索引失效）
SELECT * FROM Employees 
WHERE LastName LIKE '%smith';

-- ✅ 好（索引有效）
SELECT * FROM Employees 
WHERE LastName LIKE 'smith%';
```

### 2.3 参数嗅探问题

```sql
-- 问题：SQL Server 缓存的执行计划可能不适合所有参数值

-- 解决方案 1：使用 OPTION (RECOMPILE)
CREATE PROCEDURE GetEmployeesByDepartment
    @DepartmentID INT
AS
BEGIN
    SELECT * FROM Employees
    WHERE DepartmentID = @DepartmentID
    OPTION (RECOMPILE);
END;

-- 解决方案 2：使用局部变量
CREATE PROCEDURE GetEmployeesByDepartment
    @DepartmentID INT
AS
BEGIN
    DECLARE @LocalDepartmentID INT = @DepartmentID;
    SELECT * FROM Employees
    WHERE DepartmentID = @LocalDepartmentID;
END;

-- 解决方案 3：使用 OPTIMIZE FOR
CREATE PROCEDURE GetEmployeesByDepartment
    @DepartmentID INT
AS
BEGIN
    SELECT * FROM Employees
    WHERE DepartmentID = @DepartmentID
    OPTION (OPTIMIZE FOR (@DepartmentID = 1));
END;
```

## 3. 内存优化

### 3.1 内存配置

```sql
-- 查看当前内存配置
SELECT 
    name, 
    value, 
    value_in_use, 
    minimum, 
    maximum
FROM sys.configurations
WHERE name IN ('max server memory (MB)', 'min server memory (MB)');

-- 配置最大服务器内存（建议预留 2-4GB 给操作系统）
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'max server memory (MB)', 32768;  -- 32GB
RECONFIGURE;

-- 配置最小服务器内存
EXEC sp_configure 'min server memory (MB)', 8192;  -- 8GB
RECONFIGURE;
```

### 3.2 内存监控

```sql
-- 查看内存使用情况
SELECT 
    type,
    SUM(pages_kb) / 1024 AS pages_mb
FROM sys.dm_os_memory_clerks
GROUP BY type
ORDER BY pages_mb DESC;

-- 查看缓冲池使用情况
SELECT 
    OBJECT_NAME(object_id) AS TableName,
    COUNT(*) AS PageCount,
    COUNT(*) * 8 / 1024 AS SizeMB
FROM sys.dm_os_buffer_descriptors
WHERE database_id = DB_ID()
GROUP BY object_id
ORDER BY PageCount DESC;

-- 查看页面生命周期
SELECT 
    page_life_expectancy AS PLE
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Page life expectancy';
-- PLE > 300 秒通常被认为是健康的
```

## 4. 临时表和表变量

### 4.1 临时表

```sql
-- 局部临时表（#开头，仅当前会话可见）
CREATE TABLE #TempEmployees (
    EmployeeID INT,
    FirstName VARCHAR(50),
    LastName VARCHAR(50)
);

INSERT INTO #TempEmployees
SELECT EmployeeID, FirstName, LastName
FROM Employees
WHERE DepartmentID = 1;

-- 可以在临时表上创建索引
CREATE INDEX IX_TempEmployees_Name 
ON #TempEmployees(LastName);

-- 会话结束时自动删除，也可以手动删除
DROP TABLE #TempEmployees;

-- 全局临时表（##开头，所有会话可见）
CREATE TABLE ##GlobalTemp (
    ID INT,
    Value VARCHAR(100)
);
```

### 4.2 表变量

```sql
-- 表变量（@开头，仅当前批处理可见）
DECLARE @TempTable TABLE (
    EmployeeID INT,
    FirstName VARCHAR(50)
);

INSERT INTO @TempTable
SELECT EmployeeID, FirstName
FROM Employees
WHERE DepartmentID = 1;

-- 表变量不能创建索引（除了主键和唯一约束）
-- 表变量在内存中，数据量大时性能较差
-- 适用于小数据集（通常 < 1000 行）
```

### 4.3 选择建议

```sql
-- 小数据集（< 1000 行）：使用表变量
DECLARE @SmallData TABLE (ID INT, Value VARCHAR(50));

-- 大数据集（> 1000 行）：使用临时表
CREATE TABLE #LargeData (
    ID INT PRIMARY KEY,
    Value VARCHAR(50)
);
CREATE INDEX IX_LargeData_Value ON #LargeData(Value);
```

## 5. 分区表

### 5.1 创建分区函数

```sql
-- 按日期范围分区
CREATE PARTITION FUNCTION pf_DateRange (DATETIME)
AS RANGE RIGHT FOR VALUES (
    '2023-01-01',
    '2024-01-01',
    '2025-01-01'
);
```

### 5.2 创建分区方案

```sql
-- 创建文件组
ALTER DATABASE AdventureWorks ADD FILEGROUP FG2023;
ALTER DATABASE AdventureWorks ADD FILEGROUP FG2024;
ALTER DATABASE AdventureWorks ADD FILEGROUP FG2025;

-- 添加文件到文件组
ALTER DATABASE AdventureWorks 
ADD FILE (
    NAME = 'Sales2023',
    FILENAME = 'C:\Data\Sales2023.ndf',
    SIZE = 100MB
) TO FILEGROUP FG2023;

-- 创建分区方案
CREATE PARTITION SCHEME ps_DateRange
AS PARTITION pf_DateRange
TO (FG2023, FG2024, FG2025, [PRIMARY]);
```

### 5.3 创建分区表

```sql
CREATE TABLE Sales (
    SaleID INT IDENTITY(1,1),
    SaleDate DATETIME,
    Amount DECIMAL(10,2),
    CustomerID INT
)
ON ps_DateRange(SaleDate);

-- 创建分区索引
CREATE CLUSTERED INDEX IX_Sales_SaleDate
ON Sales(SaleDate)
ON ps_DateRange(SaleDate);
```

### 5.4 查询分区信息

```sql
-- 查看分区信息
SELECT 
    p.partition_number,
    p.rows,
    au.total_pages,
    au.used_pages,
    au.data_pages
FROM sys.partitions p
INNER JOIN sys.allocation_units au 
    ON p.hobt_id = au.container_id
WHERE p.object_id = OBJECT_ID('Sales');

-- 查看特定分区的数据
SELECT * FROM Sales
WHERE $PARTITION.pf_DateRange(SaleDate) = 2;
```

## 6. 查询存储

### 6.1 启用查询存储

```sql
-- 启用查询存储（SQL Server 2016+）
ALTER DATABASE AdventureWorks
SET QUERY_STORE = ON (
    OPERATION_MODE = READ_WRITE,
    MAX_STORAGE_SIZE_MB = 1024,
    CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30),
    INTERVAL_LENGTH_MINUTES = 60
);
```

### 6.2 查询存储视图

```sql
-- 查看资源消耗最高的查询
SELECT TOP 10
    qt.query_sql_text,
    rs.avg_cpu_time,
    rs.avg_duration,
    rs.avg_logical_io_reads,
    rs.count_executions
FROM sys.query_store_query_text qt
INNER JOIN sys.query_store_query q ON qt.query_text_id = q.query_text_id
INNER JOIN sys.query_store_plan p ON q.query_id = p.query_id
INNER JOIN sys.query_store_runtime_stats rs ON p.plan_id = rs.plan_id
ORDER BY rs.avg_cpu_time DESC;

-- 查看回归查询（性能下降的查询）
SELECT 
    qt.query_sql_text,
    rs1.avg_duration AS old_avg_duration,
    rs2.avg_duration AS new_avg_duration
FROM sys.query_store_query_text qt
INNER JOIN sys.query_store_query q ON qt.query_text_id = q.query_text_id
INNER JOIN sys.query_store_plan p1 ON q.query_id = p1.query_id
INNER JOIN sys.query_store_plan p2 ON q.query_id = p2.query_id
INNER JOIN sys.query_store_runtime_stats rs1 ON p1.plan_id = rs1.plan_id
INNER JOIN sys.query_store_runtime_stats rs2 ON p2.plan_id = rs2.plan_id
WHERE rs2.avg_duration > rs1.avg_duration * 1.5;
```

### 6.3 强制使用特定执行计划

```sql
-- 查找查询 ID
SELECT query_id, query_sql_text
FROM sys.query_store_query_text qt
INNER JOIN sys.query_store_query q ON qt.query_text_id = q.query_text_id
WHERE query_sql_text LIKE '%SELECT * FROM Employees%';

-- 强制使用特定计划
EXEC sp_query_store_force_plan 
    @query_id = 123, 
    @plan_id = 456;

-- 取消强制
EXEC sp_query_store_unforce_plan 
    @query_id = 123, 
    @plan_id = 456;
```

## 7. 性能监控工具

### 7.1 动态管理视图（DMV）

```sql
-- 查看等待统计
SELECT 
    wait_type,
    waiting_tasks_count,
    wait_time_ms,
    signal_wait_time_ms
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN (
    'CLR_SEMAPHORE', 'LAZYWRITER_SLEEP', 'RESOURCE_QUEUE',
    'SQLTRACE_BUFFER_FLUSH', 'SLEEP_TASK', 'SLEEP_SYSTEMTASK',
    'WAITFOR', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION',
    'CHECKPOINT_QUEUE', 'REQUEST_FOR_DEADLOCK_SEARCH',
    'XE_TIMER_EVENT', 'XE_DISPATCH_WAIT', 'BROKER_TO_FLUSH',
    'BROKER_TASK_STOP', 'CLR_MANUAL_EVENT',
    'DISPATCHER_QUEUE_SEMAPHORE', 'FT_IFTS_SCHEDULER_IDLE_WAIT',
    'LOGMGR_QUEUE_FLUSH', 'SLEEP_BPOOL_FLUSH'
)
ORDER BY wait_time_ms DESC;

-- 查看当前执行的查询
SELECT 
    r.session_id,
    r.status,
    r.command,
    r.cpu_time,
    r.total_elapsed_time,
    t.text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id > 50;

-- 查看索引使用情况
SELECT 
    OBJECT_NAME(object_id) AS TableName,
    index_id,
    user_seeks,
    user_scans,
    user_lookups,
    user_updates
FROM sys.dm_db_index_usage_stats
WHERE database_id = DB_ID()
ORDER BY user_seeks + user_scans + user_lookups DESC;
```

### 7.2 Extended Events

```sql
-- 创建 Extended Events 会话
CREATE EVENT SESSION [SlowQueries] ON SERVER
ADD EVENT sqlserver.sql_statement_completed(
    ACTION(sqlserver.sql_text, sqlserver.username)
    WHERE duration > 1000000  -- 1 秒
)
ADD TARGET package0.event_file(
    SET filename=N'C:\ExtendedEvents\SlowQueries.xel'
);

-- 启动会话
ALTER EVENT SESSION [SlowQueries] ON SERVER STATE = START;

-- 停止会话
ALTER EVENT SESSION [SlowQueries] ON SERVER STATE = STOP;

-- 查看事件数据
SELECT 
    event_data.value('(event/@name)[1]', 'varchar(50)') AS event_name,
    event_data.value('(event/data[@name="duration"]/value)[1]', 'bigint') AS duration,
    event_data.value('(event/action[@name="sql_text"]/value)[1]', 'varchar(max)') AS sql_text
FROM sys.fn_xe_file_target_read_file(
    'C:\ExtendedEvents\SlowQueries*.xel', 
    NULL, NULL, NULL
);
```

## 8. 性能优化最佳实践

### 8.1 数据库设计

1. **规范化**：遵循第三范式，减少数据冗余
2. **适当反规范化**：对于频繁查询的场景，可以考虑冗余字段
3. **选择合适的数据类型**：使用最小的数据类型满足需求
4. **使用约束**：主键、外键、唯一约束、检查约束

### 8.2 索引策略

1. **为频繁查询的列创建索引**
2. **避免过多索引**：每个索引都会降低写入性能
3. **定期维护索引**：重建或重组碎片索引
4. **使用包含列**：避免键查找
5. **使用筛选索引**：只索引需要的行

### 8.3 查询优化

1. **避免 SELECT ***：只查询需要的列
2. **使用 EXISTS 替代 IN**：当子查询结果集大时
3. **避免在 WHERE 子句中使用函数**：会导致索引失效
4. **使用 UNION ALL 替代 UNION**：如果不需要去重
5. **避免前导通配符**：LIKE '%value' 会导致全表扫描

### 8.4 事务优化

1. **保持事务简短**：减少锁持有时间
2. **避免在事务中进行用户交互**
3. **使用合适的隔离级别**：READ COMMITTED 通常足够
4. **避免死锁**：按相同顺序访问资源

### 8.5 监控和维护

1. **定期更新统计信息**
2. **监控索引碎片**
3. **使用查询存储跟踪性能回归**
4. **设置性能基线和告警**
5. **定期进行性能审查**

---

## 本章小结

- 索引优化是性能优化的关键，需要定期维护
- 查询优化需要分析执行计划，避免常见的性能陷阱
- 内存配置需要根据服务器硬件合理设置
- 临时表和表变量各有适用场景
- 分区表适合大数据量的表
- 查询存储可以跟踪和诊断性能问题
- 使用 DMV 和 Extended Events 监控性能
- 性能优化是一个持续的过程，需要定期审查和调整
