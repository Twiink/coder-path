---
title: "SQL Server T-SQL编程"
aliases:
  - "SQL Server T-SQL"
  - "Transact-SQL"
tags:
  - "后端"
  - "数据库"
  - "sqlserver"
  - "tsql"
  - "笔记"
category: "后端"
folder: "Oracle与SQLServer"
parent: "[[后端/数据库/Oracle与SQLServer/SQL Server入门与架构]]"
created: 2026-09-06
updated: 2026-09-06
---

# SQL Server T-SQL 编程

T-SQL（Transact-SQL）是 SQL Server 的过程化 SQL 扩展，支持变量、控制流、异常处理等编程特性。

## 1. T-SQL 基础

### 1.1 变量声明与使用

```sql
-- 局部变量（以 @ 开头）
DECLARE @name VARCHAR(50);
DECLARE @age INT = 25;
DECLARE @salary DECIMAL(10,2);

-- 赋值
SET @name = '张三';
SET @salary = 5000.50;

-- 使用 SELECT 赋值
SELECT @age = age, @name = name 
FROM employees 
WHERE employee_id = 1;

-- 打印变量
PRINT @name;
PRINT '年龄：' + CAST(@age AS VARCHAR);

-- 表变量
DECLARE @temp_table TABLE (
    id INT,
    name VARCHAR(50)
);

INSERT INTO @temp_table VALUES (1, '张三'), (2, '李四');
SELECT * FROM @temp_table;
```

### 1.2 全局变量（系统函数）

```sql
-- 常用系统函数
SELECT @@VERSION;              -- SQL Server 版本
SELECT @@SERVERNAME;           -- 服务器名称
SELECT @@SPID;                 -- 当前会话 ID
SELECT @@ROWCOUNT;             -- 上一条语句影响的行数
SELECT @@ERROR;                -- 上一条语句的错误号
SELECT @@IDENTITY;             -- 最后插入的标识值
SELECT SCOPE_IDENTITY();       -- 当前作用域最后插入的标识值（推荐）
SELECT IDENT_CURRENT('table'); -- 指定表最后插入的标识值
```

### 1.3 BEGIN...END 块

```sql
BEGIN
    DECLARE @count INT;
    SELECT @count = COUNT(*) FROM employees;
    PRINT '员工总数：' + CAST(@count AS VARCHAR);
END
```

## 2. 控制流语句

### 2.1 IF...ELSE

```sql
DECLARE @age INT = 25;

IF @age >= 18
BEGIN
    PRINT '成年人';
END
ELSE
BEGIN
    PRINT '未成年人';
END;

-- 多条件判断
DECLARE @score INT = 85;

IF @score >= 90
    PRINT '优秀';
ELSE IF @score >= 80
    PRINT '良好';
ELSE IF @score >= 60
    PRINT '及格';
ELSE
    PRINT '不及格';
```

### 2.2 CASE 表达式

```sql
-- 简单 CASE
SELECT 
    employee_id,
    first_name,
    CASE department_id
        WHEN 1 THEN 'IT'
        WHEN 2 THEN '销售'
        WHEN 3 THEN '人事'
        ELSE '其他'
    END AS department_name
FROM employees;

-- 搜索 CASE
SELECT 
    employee_id,
    first_name,
    salary,
    CASE 
        WHEN salary >= 10000 THEN '高薪'
        WHEN salary >= 5000 THEN '中等'
        ELSE '低薪'
    END AS salary_level
FROM employees;

-- 在 UPDATE 中使用 CASE
UPDATE employees
SET salary = CASE 
    WHEN department_id = 1 THEN salary * 1.1
    WHEN department_id = 2 THEN salary * 1.05
    ELSE salary * 1.02
END;
```

### 2.3 WHILE 循环

```sql
-- 基本循环
DECLARE @i INT = 1;

WHILE @i <= 10
BEGIN
    PRINT '第 ' + CAST(@i AS VARCHAR) + ' 次循环';
    SET @i = @i + 1;
END;

-- BREAK 和 CONTINUE
DECLARE @i INT = 1;

WHILE @i <= 10
BEGIN
    IF @i = 5
        BREAK;  -- 跳出循环
    
    IF @i % 2 = 0
    BEGIN
        SET @i = @i + 1;
        CONTINUE;  -- 跳过本次循环
    END
    
    PRINT @i;
    SET @i = @i + 1;
END;

-- 嵌套循环
DECLARE @i INT = 1;
DECLARE @j INT;

WHILE @i <= 3
BEGIN
    SET @j = 1;
    WHILE @j <= 3
    BEGIN
        PRINT CAST(@i AS VARCHAR) + ' x ' + CAST(@j AS VARCHAR) + ' = ' + CAST(@i * @j AS VARCHAR);
        SET @j = @j + 1;
    END;
    SET @i = @i + 1;
END;
```

### 2.4 TRY...CATCH 异常处理

```sql
BEGIN TRY
    DECLARE @result INT;
    SET @result = 10 / 0;  -- 除零错误
    PRINT '执行成功';
END TRY
BEGIN CATCH
    PRINT '错误号：' + CAST(ERROR_NUMBER() AS VARCHAR);
    PRINT '错误消息：' + ERROR_MESSAGE();
    PRINT '错误行号：' + CAST(ERROR_LINE() AS VARCHAR);
    PRINT '错误严重性：' + CAST(ERROR_SEVERITY() AS VARCHAR);
    PRINT '错误状态：' + CAST(ERROR_STATE() AS VARCHAR);
    PRINT '错误过程：' + ISNULL(ERROR_PROCEDURE(), 'N/A');
END CATCH;

-- 在事务中使用 TRY...CATCH
BEGIN TRY
    BEGIN TRANSACTION;
    
    UPDATE accounts SET balance = balance - 100 WHERE account_id = 1;
    UPDATE accounts SET balance = balance + 100 WHERE account_id = 2;
    
    COMMIT TRANSACTION;
    PRINT '转账成功';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    
    PRINT '转账失败：' + ERROR_MESSAGE();
END CATCH;

-- 重新抛出异常（SQL Server 2012+）
BEGIN TRY
    RAISERROR('自定义错误', 16, 1);
END TRY
BEGIN CATCH
    PRINT '捕获异常';
    THROW;  -- 重新抛出
END CATCH;
```

### 2.5 WAITFOR 延迟

```sql
-- 等待指定时间
WAITFOR DELAY '00:00:05';  -- 等待 5 秒
PRINT '5 秒后执行';

-- 等待到指定时间
WAITFOR TIME '14:30:00';  -- 等待到 14:30
PRINT '到达指定时间';
```

## 3. 存储过程

### 3.1 创建存储过程

```sql
-- 基本存储过程
CREATE PROCEDURE GetEmployeeById
    @employee_id INT
AS
BEGIN
    SET NOCOUNT ON;  -- 不返回受影响的行数
    
    SELECT employee_id, first_name, last_name, salary
    FROM employees
    WHERE employee_id = @employee_id;
END;
GO

-- 执行存储过程
EXEC GetEmployeeById @employee_id = 1;
EXEC GetEmployeeById 1;  -- 简写
```

### 3.2 带输出参数的存储过程

```sql
CREATE PROCEDURE GetEmployeeCount
    @department_id INT,
    @count INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT @count = COUNT(*)
    FROM employees
    WHERE department_id = @department_id;
END;
GO

-- 调用带输出参数的存储过程
DECLARE @emp_count INT;
EXEC GetEmployeeCount @department_id = 1, @count = @emp_count OUTPUT;
PRINT '员工数量：' + CAST(@emp_count AS VARCHAR);
```

### 3.3 带返回值的存储过程

```sql
CREATE PROCEDURE ValidateEmployee
    @employee_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (SELECT 1 FROM employees WHERE employee_id = @employee_id)
        RETURN 1;  -- 存在
    ELSE
        RETURN 0;  -- 不存在
END;
GO

-- 调用并获取返回值
DECLARE @result INT;
EXEC @result = ValidateEmployee @employee_id = 1;
PRINT '结果：' + CAST(@result AS VARCHAR);
```

### 3.4 带事务的存储过程

```sql
CREATE PROCEDURE TransferMoney
    @from_account INT,
    @to_account INT,
    @amount DECIMAL(10,2)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;  -- 遇到错误自动回滚
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- 检查余额
        DECLARE @balance DECIMAL(10,2);
        SELECT @balance = balance FROM accounts WHERE account_id = @from_account;
        
        IF @balance < @amount
        BEGIN
            RAISERROR('余额不足', 16, 1);
            RETURN;
        END
        
        -- 执行转账
        UPDATE accounts SET balance = balance - @amount WHERE account_id = @from_account;
        UPDATE accounts SET balance = balance + @amount WHERE account_id = @to_account;
        
        COMMIT TRANSACTION;
        PRINT '转账成功';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        PRINT '转账失败：' + ERROR_MESSAGE();
        THROW;
    END CATCH
END;
GO
```

### 3.5 动态 SQL

```sql
CREATE PROCEDURE DynamicQuery
    @table_name VARCHAR(50),
    @column_name VARCHAR(50),
    @value VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @sql NVARCHAR(MAX);
    SET @sql = N'SELECT * FROM ' + QUOTENAME(@table_name) + 
               N' WHERE ' + QUOTENAME(@column_name) + N' = @value';
    
    -- 使用 sp_executesql 执行动态 SQL（推荐，防 SQL 注入）
    EXEC sp_executesql @sql, N'@value VARCHAR(100)', @value = @value;
    
    -- 不推荐：直接拼接（有 SQL 注入风险）
    -- EXEC(@sql);
END;
GO
```

### 3.6 临时存储过程

```sql
-- 局部临时存储过程（# 开头，仅当前会话可见）
CREATE PROCEDURE #TempProc
AS
BEGIN
    PRINT '临时存储过程';
END;
GO

EXEC #TempProc;

-- 全局临时存储过程（## 开头，所有会话可见）
CREATE PROCEDURE ##GlobalTempProc
AS
BEGIN
    PRINT '全局临时存储过程';
END;
GO
```

## 4. 用户定义函数（UDF）

### 4.1 标量函数

```sql
-- 返回单个值
CREATE FUNCTION CalculateTax
(
    @amount DECIMAL(10,2),
    @tax_rate DECIMAL(5,2)
)
RETURNS DECIMAL(10,2)
AS
BEGIN
    DECLARE @tax DECIMAL(10,2);
    SET @tax = @amount * @tax_rate / 100;
    RETURN @tax;
END;
GO

-- 调用标量函数
SELECT 
    employee_id,
    first_name,
    salary,
    dbo.CalculateTax(salary, 10) AS tax
FROM employees;
```

### 4.2 内联表值函数

```sql
-- 返回表，性能较好
CREATE FUNCTION GetEmployeesByDepartment
(
    @department_id INT
)
RETURNS TABLE
AS
RETURN
(
    SELECT employee_id, first_name, last_name, salary
    FROM employees
    WHERE department_id = @department_id
);
GO

-- 调用内联表值函数
SELECT * FROM dbo.GetEmployeesByDepartment(1);

-- 可以与其他表 JOIN
SELECT e.*, d.department_name
FROM dbo.GetEmployeesByDepartment(1) e
JOIN departments d ON e.department_id = d.department_id;
```

### 4.3 多语句表值函数

```sql
-- 返回表，可以包含多条语句
CREATE FUNCTION GetEmployeeStats
(
    @department_id INT
)
RETURNS @result TABLE
(
    department_id INT,
    employee_count INT,
    avg_salary DECIMAL(10,2),
    max_salary DECIMAL(10,2)
)
AS
BEGIN
    INSERT INTO @result
    SELECT 
        department_id,
        COUNT(*),
        AVG(salary),
        MAX(salary)
    FROM employees
    WHERE department_id = @department_id
    GROUP BY department_id;
    
    RETURN;
END;
GO

-- 调用多语句表值函数
SELECT * FROM dbo.GetEmployeeStats(1);
```

## 5. 触发器

### 5.1 DML 触发器（AFTER）

```sql
-- AFTER INSERT 触发器
CREATE TRIGGER trg_Employee_Insert
ON employees
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 记录日志
    INSERT INTO employee_audit (
        employee_id, 
        action, 
        action_date, 
        changed_by
    )
    SELECT 
        employee_id,
        'INSERT',
        GETDATE(),
        SYSTEM_USER
    FROM inserted;
    
    PRINT '插入了 ' + CAST(@@ROWCOUNT AS VARCHAR) + ' 条记录';
END;
GO

-- AFTER UPDATE 触发器
CREATE TRIGGER trg_Employee_Update
ON employees
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 记录变更
    INSERT INTO employee_audit (
        employee_id,
        action,
        action_date,
        old_salary,
        new_salary,
        changed_by
    )
    SELECT 
        i.employee_id,
        'UPDATE',
        GETDATE(),
        d.salary,
        i.salary,
        SYSTEM_USER
    FROM inserted i
    JOIN deleted d ON i.employee_id = d.employee_id
    WHERE i.salary <> d.salary;  -- 只记录工资变更
END;
GO

-- AFTER DELETE 触发器
CREATE TRIGGER trg_Employee_Delete
ON employees
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 备份删除的记录
    INSERT INTO employees_backup
    SELECT *, GETDATE() AS deleted_date
    FROM deleted;
END;
GO
```

### 5.2 INSTEAD OF 触发器

```sql
-- 在视图上创建 INSTEAD OF 触发器
CREATE VIEW vw_EmployeeDepartment
AS
SELECT 
    e.employee_id,
    e.first_name,
    e.last_name,
    d.department_name
FROM employees e
JOIN departments d ON e.department_id = d.department_id;
GO

-- 在视图上创建 INSTEAD OF INSERT 触发器
CREATE TRIGGER trg_vw_EmployeeDepartment_Insert
ON vw_EmployeeDepartment
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @department_id INT;
    
    -- 查找或创建部门
    SELECT @department_id = department_id 
    FROM departments 
    WHERE department_name = (SELECT department_name FROM inserted);
    
    IF @department_id IS NULL
    BEGIN
        INSERT INTO departments (department_name)
        SELECT department_name FROM inserted;
        
        SET @department_id = SCOPE_IDENTITY();
    END
    
    -- 插入员工
    INSERT INTO employees (first_name, last_name, department_id)
    SELECT first_name, last_name, @department_id
    FROM inserted;
END;
GO

-- 通过视图插入数据
INSERT INTO vw_EmployeeDepartment (first_name, last_name, department_name)
VALUES ('张三', '张', 'IT部门');
```

### 5.3 DDL 触发器

```sql
-- 防止删除表
CREATE TRIGGER trg_PreventDropTable
ON DATABASE
FOR DROP_TABLE
AS
BEGIN
    PRINT '不允许删除表！';
    ROLLBACK;
END;
GO

-- 记录 DDL 操作
CREATE TRIGGER trg_LogDDL
ON DATABASE
FOR CREATE_TABLE, ALTER_TABLE, DROP_TABLE
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO ddl_log (
        event_type,
        object_name,
        event_date,
        login_name,
        tsql_command
    )
    SELECT 
        EVENTDATA().value('(/EVENT_INSTANCE/EventType)[1]', 'VARCHAR(50)'),
        EVENTDATA().value('(/EVENT_INSTANCE/ObjectName)[1]', 'VARCHAR(100)'),
        GETDATE(),
        SYSTEM_USER,
        EVENTDATA().value('(/EVENT_INSTANCE/TSQLCommand)[1]', 'NVARCHAR(MAX)');
END;
GO
```

### 5.4 登录触发器

```sql
-- 限制登录时间
CREATE TRIGGER trg_RestrictLoginTime
ON ALL SERVER
FOR LOGON
AS
BEGIN
    DECLARE @hour INT = DATEPART(HOUR, GETDATE());
    
    -- 只允许工作时间登录（9:00-18:00）
    IF @hour < 9 OR @hour >= 18
    BEGIN
        IF ORIGINAL_LOGIN() = 'app_user'
            ROLLBACK;
    END
END;
GO
```

## 6. 游标

### 6.1 基本游标

```sql
DECLARE @employee_id INT;
DECLARE @first_name VARCHAR(50);
DECLARE @salary DECIMAL(10,2);

-- 声明游标
DECLARE employee_cursor CURSOR FOR
SELECT employee_id, first_name, salary
FROM employees
WHERE department_id = 1;

-- 打开游标
OPEN employee_cursor;

-- 获取第一行
FETCH NEXT FROM employee_cursor 
INTO @employee_id, @first_name, @salary;

-- 循环处理
WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT '员工：' + @first_name + '，工资：' + CAST(@salary AS VARCHAR);
    
    -- 获取下一行
    FETCH NEXT FROM employee_cursor 
    INTO @employee_id, @first_name, @salary;
END

-- 关闭并释放游标
CLOSE employee_cursor;
DEALLOCATE employee_cursor;
```

### 6.2 游标类型

```sql
-- 静态游标（STATIC）：结果集的快照
DECLARE static_cursor CURSOR STATIC FOR
SELECT * FROM employees;

-- 动态游标（DYNAMIC）：实时反映数据变化
DECLARE dynamic_cursor CURSOR DYNAMIC FOR
SELECT * FROM employees;

-- 键集游标（KEYSET）：基于键值的游标
DECLARE keyset_cursor CURSOR KEYSET FOR
SELECT * FROM employees;

-- 只进游标（FAST_FORWARD）：只向前，性能最好
DECLARE fast_cursor CURSOR FAST_FORWARD FOR
SELECT * FROM employees;
```

### 6.3 游标性能优化

```sql
-- 使用 WHILE 循环替代游标（推荐）
DECLARE @id INT;
DECLARE @name VARCHAR(50);

-- 使用表变量
DECLARE @temp TABLE (id INT IDENTITY, employee_id INT, first_name VARCHAR(50));

INSERT INTO @temp (employee_id, first_name)
SELECT employee_id, first_name FROM employees;

DECLARE @count INT = (SELECT COUNT(*) FROM @temp);
DECLARE @i INT = 1;

WHILE @i <= @count
BEGIN
    SELECT @id = employee_id, @name = first_name
    FROM @temp
    WHERE id = @i;
    
    PRINT CAST(@id AS VARCHAR) + ': ' + @name;
    
    SET @i = @i + 1;
END;
```

## 7. 错误处理最佳实践

### 7.1 使用 THROW（SQL Server 2012+）

```sql
-- 抛出自定义错误
THROW 50001, '自定义错误消息', 1;

-- 在 CATCH 块中重新抛出
BEGIN TRY
    SELECT 1/0;
END TRY
BEGIN CATCH
    -- 记录日志
    INSERT INTO error_log (error_number, error_message)
    VALUES (ERROR_NUMBER(), ERROR_MESSAGE());
    
    -- 重新抛出
    THROW;
END CATCH;
```

### 7.2 使用 RAISERROR

```sql
-- 抛出错误（SQL Server 2012 之前的版本）
RAISERROR('错误消息', 16, 1);

-- 使用格式化消息
RAISERROR('员工 %d 不存在', 16, 1, @employee_id);

-- 使用系统错误消息
RAISERROR(50001, 16, 1);  -- 需要先在 sys.messages 中定义
```

---

## 本章小结

- T-SQL 是 SQL Server 的过程化扩展，支持变量、控制流、异常处理
- 变量：局部变量（@）、全局变量（@@）
- 控制流：IF...ELSE、CASE、WHILE、TRY...CATCH
- 存储过程：封装业务逻辑，支持输入/输出参数
- 函数：标量函数、表值函数（内联/多语句）
- 触发器：DML 触发器、DDL 触发器、登录触发器
- 游标：逐行处理结果集（尽量避免使用）
- 错误处理：TRY...CATCH、THROW、RAISERROR
