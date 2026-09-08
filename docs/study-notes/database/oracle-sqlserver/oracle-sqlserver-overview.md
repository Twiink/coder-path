# Oracle 与 SQL Server 概述

## 1. Oracle Database

### 1.1 简介

Oracle Database 是甲骨文公司开发的企业级关系数据库管理系统，是全球最流行的商业数据库之一，广泛应用于金融、电信、政府等关键业务系统。

### 1.2 核心特性

#### 1.2.1 架构特点
- **多进程架构**：使用多个后台进程（PMON、SMON、DBWn、LGWR 等）
- **SGA（System Global Area）**：共享内存区域，包含数据缓冲区、共享池、重做日志缓冲区
- **PGA（Program Global Area）**：每个会话的私有内存
- **表空间（Tablespace）**：逻辑存储单位，由数据文件组成

#### 1.2.2 高可用性
- **RAC（Real Application Clusters）**：多实例共享存储，实现高可用和负载均衡
- **Data Guard**：主备复制，支持物理备库和逻辑备库
- **Flashback Technology**：闪回技术，可快速恢复误操作数据

#### 1.2.3 高级功能
- **分区表**：范围分区、列表分区、哈希分区、组合分区
- **物化视图**：预计算并存储查询结果
- **并行查询**：多进程并行执行大查询
- **高级压缩**：表压缩、索引压缩、LOB 压缩

### 1.3 数据类型

| 类型 | 说明 | 示例 |
|------|------|------|
| NUMBER(p,s) | 数值类型，p 为精度，s 为小数位 | NUMBER(10,2) |
| VARCHAR2(n) | 可变长字符串，最大 4000 字节 | VARCHAR2(100) |
| CHAR(n) | 固定长度字符串 | CHAR(10) |
| DATE | 日期时间（精确到秒） | DATE |
| TIMESTAMP | 时间戳（精确到纳秒） | TIMESTAMP(6) |
| CLOB | 字符大对象，最大 4GB | CLOB |
| BLOB | 二进制大对象，最大 4GB | BLOB |

### 1.4 SQL 特点

#### 1.4.1 PL/SQL
Oracle 的过程化 SQL 语言，支持：
- 存储过程、函数、触发器
- 包（Package）：将相关过程组织在一起
- 异常处理
- 游标操作

```sql
-- 存储过程示例
CREATE OR REPLACE PROCEDURE update_salary(
    p_emp_id IN NUMBER,
    p_amount IN NUMBER
) AS
BEGIN
    UPDATE employees
    SET salary = salary + p_amount
    WHERE employee_id = p_emp_id;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/
```

#### 1.4.2 常用函数
- `NVL(col, value)`：空值替换
- `DECODE(col, v1, r1, v2, r2, default)`：条件判断
- `ROWNUM`：行号伪列
- `SYSDATE`：当前日期时间
- `TO_DATE()`、`TO_CHAR()`：日期转换

### 1.5 性能优化

#### 1.5.1 执行计划
```sql
-- 查看执行计划
EXPLAIN PLAN FOR
SELECT * FROM employees WHERE department_id = 10;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

#### 1.5.2 索引类型
- **B-tree 索引**：默认索引类型
- **位图索引**：适合低基数列
- **函数索引**：基于表达式创建
- **反向键索引**：适合序列值

#### 1.5.3 优化器
- **CBO（Cost-Based Optimizer）**：基于成本的优化器
- **统计信息**：定期收集表和索引统计信息
```sql
EXEC DBMS_STATS.GATHER_TABLE_STATS('HR', 'EMPLOYEES');
```

### 1.6 适用场景
- 大型企业级应用
- 金融交易系统
- 数据仓库
- 需要高级特性和技术支持的场景

---

## 2. SQL Server

### 2.1 简介

SQL Server 是微软开发的关系数据库管理系统，与 Windows 生态深度集成，广泛用于企业内部应用、Web 应用和 BI 系统。

### 2.2 核心特性

#### 2.2.1 架构特点
- **数据库引擎**：核心服务，负责数据存储和查询处理
- **SQL Server Agent**：作业调度和自动化
- **SQL Server Management Studio（SSMS）**：图形化管理工具
- **实例**：一台服务器可运行多个 SQL Server 实例

#### 2.2.2 高可用性
- **Always On 可用性组**：多副本同步/异步复制
- **数据库镜像**：主备复制（已逐步被 Always On 替代）
- **日志传送**：异步复制事务日志
- **故障转移群集**：基于 Windows 故障转移群集

#### 2.2.3 高级功能
- **CLR 集成**：可使用 .NET 语言编写存储过程
- **Service Broker**：异步消息处理
- **全文搜索**：内置全文搜索引擎
- **PolyBase**：查询外部数据源（Hadoop、Azure Blob 等）

### 2.3 数据类型

| 类型 | 说明 | 示例 |
|------|------|------|
| INT / BIGINT | 整数类型 | INT, BIGINT |
| DECIMAL(p,s) | 精确数值 | DECIMAL(10,2) |
| VARCHAR(n) / NVARCHAR(n) | 可变长字符串（NVARCHAR 支持 Unicode） | VARCHAR(100), NVARCHAR(100) |
| CHAR(n) / NCHAR(n) | 固定长度字符串 | CHAR(10), NCHAR(10) |
| DATETIME / DATETIME2 | 日期时间 | DATETIME2(7) |
| DATE / TIME | 单独日期/时间 | DATE, TIME |
| UNIQUEIDENTIFIER | GUID | UNIQUEIDENTIFIER |
| XML | XML 数据 | XML |

### 2.4 SQL 特点

#### 2.4.1 T-SQL
SQL Server 的 Transact-SQL 扩展：
- 存储过程、函数、触发器
- 批处理（GO 分隔）
- 变量声明（@变量名）
- TRY...CATCH 异常处理

```sql
-- 存储过程示例
CREATE PROCEDURE UpdateSalary
    @EmployeeID INT,
    @Amount DECIMAL(10,2)
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        UPDATE Employees
        SET Salary = Salary + @Amount
        WHERE EmployeeID = @EmployeeID;
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
```

#### 2.4.2 常用函数
- `ISNULL(col, value)`：空值替换
- `COALESCE(col1, col2, ...)`：返回第一个非空值
- `GETDATE()`：当前日期时间
- `CONVERT()`、`CAST()`：类型转换
- `ROW_NUMBER()`、`RANK()`：窗口函数

### 2.5 性能优化

#### 2.5.1 执行计划
```sql
-- 查看执行计划
SET SHOWPLAN_ALL ON;
GO
SELECT * FROM Employees WHERE DepartmentID = 10;
GO
SET SHOWPLAN_ALL OFF;
```

#### 2.5.2 索引类型
- **聚集索引**：数据按索引顺序存储，每表只能有一个
- **非聚集索引**：索引与数据分离，可创建多个
- **列存储索引**：适合数据仓库，列式存储
- **全文索引**：用于全文搜索

#### 2.5.3 统计信息
```sql
-- 更新统计信息
UPDATE STATISTICS Employees;

-- 查看所有统计信息
SELECT * FROM sys.stats WHERE object_id = OBJECT_ID('Employees');
```

### 2.6 BI 与数据分析

#### 2.6.1 SQL Server Analysis Services（SSAS）
- 多维数据集（Cube）
- 数据挖掘
- 表格模型

#### 2.6.2 SQL Server Reporting Services（SSRS）
- 报表设计和发布
- 订阅和计划

#### 2.6.3 SQL Server Integration Services（SSIS）
- ETL 工具
- 数据迁移和转换

### 2.7 适用场景
- 企业级应用（尤其是 Windows 环境）
- Web 应用（ASP.NET）
- BI 和数据仓库
- 需要与 Microsoft 生态集成的场景

---

## 3. Oracle vs SQL Server 对比

| 特性 | Oracle | SQL Server |
|------|--------|-----------|
| **许可成本** | 高（按 CPU 核心计费） | 中高（按核心或 CAL） |
| **平台支持** | Linux、Windows、Unix | Windows、Linux（2017+） |
| **管理工具** | SQL Developer、OEM | SSMS、Azure Data Studio |
| **过程化语言** | PL/SQL | T-SQL |
| **高可用方案** | RAC、Data Guard | Always On、故障转移群集 |
| **云服务** | Oracle Cloud | Azure SQL Database |
| **学习曲线** | 陡峭 | 中等 |
| **生态集成** | Java、多平台 | .NET、Microsoft 生态 |

---

## 4. 选择建议

### 选择 Oracle 的场景
- 大型企业级关键业务系统
- 需要 RAC 多活集群
- 已有 Oracle 技术栈和运维团队
- 需要高级特性和官方技术支持
- 预算充足

### 选择 SQL Server 的场景
- Windows 环境为主的企业
- 使用 .NET、Azure 等 Microsoft 技术栈
- 需要 BI 全套解决方案（SSAS、SSRS、SSIS）
- 中等规模企业应用
- 希望降低许可成本（相比 Oracle）

### 考虑开源替代方案
- **PostgreSQL**：功能丰富，接近商业数据库
- **MySQL/MariaDB**：Web 应用首选
- 预算有限或有开源要求

---

## 5. 学习资源

### Oracle
- 官方文档：https://docs.oracle.com/en/database/oracle/
- Oracle Live SQL：https://livesql.oracle.com/
- Oracle Base：https://oracle-base.com/

### SQL Server
- 官方文档：https://docs.microsoft.com/sql/
- SQL Server 教程：https://www.sqlservertutorial.net/
- SQLSkills：https://www.sqlskills.com/

---

## 总结

Oracle 和 SQL Server 都是成熟的企业级商业数据库，各有优势：
- **Oracle**：功能最强大，适合大型关键业务，但成本高、学习曲线陡
- **SQL Server**：与 Microsoft 生态集成好，BI 能力强，成本相对较低

在选择时应考虑：预算、技术栈、团队技能、业务需求和长期维护成本。对于大多数互联网应用，开源数据库（MySQL、PostgreSQL）是更好的选择。
