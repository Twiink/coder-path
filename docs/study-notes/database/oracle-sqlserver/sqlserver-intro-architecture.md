# SQL Server 入门与架构

## SQL Server 简介

### 发展历程

```text
1989  Microsoft SQL Server 1.0（与 Sybase 合作）
1993  SQL Server 4.2（最后一个与 Sybase 合作的版本）
1995  SQL Server 6.0（Microsoft 独立开发）
1998  SQL Server 7.0（重大重构）
2000  SQL Server 2000
2005  SQL Server 2005（引入 CLR 集成）
2008  SQL Server 2008
2012  SQL Server 2012（引入 AlwaysOn）
2014  SQL Server 2014（内存优化表）
2016  SQL Server 2016（引入 JSON 支持）
2017  SQL Server 2017（支持 Linux）
2019  SQL Server 2019（智能查询处理）
2022  SQL Server 2022（Azure 集成）
```

### 核心特性

| 特性 | 说明 |
|------|------|
| **Always On 可用性组** | 高可用和灾难恢复解决方案 |
| **内存优化表** | 内存中 OLTP（Hekaton） |
| **列存储索引** | 列式存储，适合数据仓库 |
| **JSON 支持** | 原生 JSON 存储和查询 |
| **Graph 数据库** | 图数据处理 |
| **机器学习服务** | 集成 R 和 Python |
| **Stretch Database** | 将冷数据迁移到 Azure |
| **透明数据加密（TDE）** | 数据库级加密 |
| **动态数据掩码** | 敏感数据保护 |
| **行级安全性** | 细粒度访问控制 |

### 适用场景

```text
✅ 适合：
  · 企业级应用（尤其是 Windows 环境）
  · 使用 .NET、Azure 等 Microsoft 技术栈
  · BI 和数据仓库（SSAS、SSRS、SSIS）
  · 中等规模企业应用
  · 需要与 Microsoft 生态集成的场景

❌ 不适合：
  · 超大规模 OLTP（相比 Oracle RAC）
  · 非 Windows 环境（虽然 2017+ 支持 Linux）
  · 预算非常有限的项目
```

### SQL Server vs 其他数据库

| 特性 | SQL Server | MySQL | PostgreSQL | Oracle |
|------|-----------|-------|------------|--------|
| **许可成本** | 中高 | 开源免费 | 开源免费 | 高 |
| **平台支持** | Windows、Linux | 跨平台 | 跨平台 | 跨平台 |
| **高可用** | Always On | 主从复制 | 流复制 | RAC、Data Guard |
| **过程化语言** | T-SQL | 存储过程 | PL/pgSQL | PL/SQL |
| **云服务** | Azure SQL | 各云厂商 | 各云厂商 | Oracle Cloud |
| **学习曲线** | 中等 | 平缓 | 中等 | 陡峭 |
| **技术支持** | 官方支持 | 社区 | 社区 | 官方支持 |

## SQL Server 架构

### 实例与数据库

```text
SQL Server 架构：
┌─────────────────────────────────────┐
│           SQL Server 实例            │
│  ┌───────────────────────────────┐  │
│  │  数据库引擎（Database Engine） │  │
│  │  ├─ 关系引擎（查询处理）       │  │
│  │  └─ 存储引擎（数据管理）       │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  系统数据库                    │  │
│  │  ├─ master（系统配置）         │  │
│  │  ├─ model（模板数据库）        │  │
│  │  ├─ msdb（作业、备份历史）     │  │
│  │  └─ tempdb（临时数据）         │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  用户数据库                    │  │
│  │  ├─ 数据库 A                  │  │
│  │  ├─ 数据库 B                  │  │
│  │  └─ ...                       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 内存架构

```text
SQL Server 内存结构：
┌─────────────────────────────────────┐
│           SQL Server 内存            │
├─────────────────────────────────────┤
│  Buffer Pool（缓冲池）              │
│  ├─ Data Cache（数据缓存）          │  缓存数据页
│  └─ Plan Cache（计划缓存）          │  缓存执行计划
├─────────────────────────────────────┤
│  CLR Memory（CLR 内存）             │  .NET 代码使用
├─────────────────────────────────────┤
│  Thread Memory（线程内存）          │  线程栈
├─────────────────────────────────────┤
│  Connection Memory（连接内存）      │  连接上下文
└─────────────────────────────────────┘
```

### 存储架构

```text
SQL Server 存储结构：
┌─────────────────────────────────────┐
│           数据库文件                 │
├─────────────────────────────────────┤
│  数据文件（.mdf / .ndf）            │
│  ├─ 主数据文件（.mdf）              │  每个数据库一个
│  └─ 次要数据文件（.ndf）            │  可选，多个
├─────────────────────────────────────┤
│  日志文件（.ldf）                   │  事务日志
│  └─ 每个数据库至少一个              │
├─────────────────────────────────────┤
│  文件组（Filegroups）               │  逻辑分组
│  ├─ PRIMARY（主文件组）             │
│  └─ 用户定义文件组                  │
└─────────────────────────────────────┘

数据页结构：
┌─────────────────────────────────────┐
│  数据页（8KB）                      │
│  ├─ 页头（96 字节）                 │  页类型、对象 ID 等
│  ├─ 数据行                          │  实际数据
│  ├─ 行偏移数组                      │  行的位置
│  └─ 空闲空间                        │
└─────────────────────────────────────┘

区（Extent）：
├─ 混合区（Mixed Extent）：8 个页来自不同对象
└─ 统一区（Uniform Extent）：8 个页来自同一对象
```

### 事务日志架构

```text
事务日志结构：
┌─────────────────────────────────────┐
│           事务日志                   │
├─────────────────────────────────────┤
│  VLF（Virtual Log Files）           │  虚拟日志文件
│  ├─ VLF 1                           │
│  ├─ VLF 2                           │
│  ├─ VLF 3                           │
│  └─ ...                             │
├─────────────────────────────────────┤
│  日志记录                           │
│  ├─ BEGIN_XACT                      │  事务开始
│  ├─ INSERT / UPDATE / DELETE        │  数据修改
│  ├─ COMMIT_XACT                     │  事务提交
│  └─ CHECKPOINT                      │  检查点
└─────────────────────────────────────┘

恢复模式：
├─ 简单恢复模式（Simple）：自动截断日志
├─ 完整恢复模式（Full）：保留所有日志
└─ 大容量日志恢复模式（Bulk-logged）：最小化日志
```

## SQL Server 安装与配置

### 系统要求

```text
硬件要求（最低）：
  · CPU：x64 处理器，1.4 GHz 或更快
  · 内存：1 GB（推荐 4 GB+）
  · 磁盘：6 GB（推荐 100 GB+）

软件要求：
  · Windows：Windows Server 2016+ 或 Windows 10+
  · Linux：RHEL 7.3+、Ubuntu 16.04+、SUSE 12+
```

### Windows 安装步骤

```powershell
# 1. 下载安装包
# 从 Microsoft 官网下载 SQL Server 2022

# 2. 运行安装程序
Setup.exe /ACTION=Install /FEATURES=SQLEngine /INSTANCENAME=MSSQLSERVER

# 3. 使用 PowerShell 安装
Install-Module -Name SqlServer
Install-SqlInstance -InstanceName MSSQLSERVER -Features SQLEngine
```

### Linux 安装步骤（Ubuntu）

```bash
# 1. 导入 Microsoft GPG 密钥
curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -

# 2. 添加 SQL Server 仓库
sudo add-apt-repository "$(curl https://packages.microsoft.com/config/ubuntu/20.04/mssql-server-2022.list)"

# 3. 安装 SQL Server
sudo apt-get update
sudo apt-get install -y mssql-server

# 4. 运行配置脚本
sudo /opt/mssql/bin/mssql-conf setup

# 5. 安装 SQL Server 工具
sudo apt-get install -y mssql-tools unixodbc-dev

# 6. 添加路径
echo 'export PATH="$PATH:/opt/mssql-tools/bin"' >> ~/.bashrc
source ~/.bashrc

# 7. 验证安装
sqlcmd -S localhost -U SA -P 'YourPassword123'
```

### Docker 安装

```bash
# 拉取 SQL Server 镜像
docker pull mcr.microsoft.com/mssql/server:2022-latest

# 启动 SQL Server 容器
docker run -d \
  --name sqlserver \
  -e 'ACCEPT_EULA=Y' \
  -e 'MSSQL_SA_PASSWORD=YourPassword123' \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2022-latest

# 连接到 SQL Server
docker exec -it sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U SA -P 'YourPassword123'
```

## SQL Server 数据类型

### 常用数据类型

| 类型 | 说明 | 示例 |
|------|------|------|
| **INT / BIGINT** | 整数类型 | INT (4字节), BIGINT (8字节) |
| **DECIMAL(p,s)** | 精确数值 | DECIMAL(10,2) |
| **MONEY** | 货币类型 | MONEY (8字节) |
| **VARCHAR(n) / NVARCHAR(n)** | 可变长字符串 | VARCHAR(100), NVARCHAR(100) |
| **CHAR(n) / NCHAR(n)** | 固定长度字符串 | CHAR(10), NCHAR(10) |
| **DATETIME / DATETIME2** | 日期时间 | DATETIME2(7) |
| **DATE / TIME** | 单独日期/时间 | DATE, TIME |
| **UNIQUEIDENTIFIER** | GUID | NEWID() |
| **XML** | XML 数据 | XML |
| **JSON** | JSON 数据（2016+） | NVARCHAR(MAX) |

### 字符串类型对比

```sql
-- VARCHAR vs NVARCHAR
-- VARCHAR：非 Unicode，1 字节/字符
-- NVARCHAR：Unicode，2 字节/字符

CREATE TABLE string_demo (
    id INT PRIMARY KEY,
    name VARCHAR(50),        -- 非 Unicode
    name_unicode NVARCHAR(50) -- Unicode
);

INSERT INTO string_demo VALUES (1, 'John', N'John');
INSERT INTO string_demo VALUES (2, '张三', N'张三'); -- VARCHAR 可能丢失中文
```

### 日期时间类型对比

```sql
-- DATETIME vs DATETIME2
-- DATETIME：精度 3.33ms，范围 1753-9999
-- DATETIME2：精度 100ns，范围 0001-9999

CREATE TABLE datetime_demo (
    id INT PRIMARY KEY,
    dt1 DATETIME,      -- 精度：2026-09-06 10:30:00.123
    dt2 DATETIME2(7)   -- 精度：2026-09-06 10:30:00.1234567
);

INSERT INTO datetime_demo VALUES 
(1, GETDATE(), SYSDATETIME());
```

## SQL Server 用户与权限

### 登录名与用户

```sql
-- 创建登录名（服务器级别）
CREATE LOGIN app_user WITH PASSWORD = 'Password123';

-- 创建数据库用户（数据库级别）
USE AdventureWorks;
CREATE USER app_user FOR LOGIN app_user;

-- 授予权限
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO app_user;

-- 授予架构权限
GRANT SELECT ON SCHEMA::dbo TO app_user;

-- 添加角色成员
ALTER ROLE db_datareader ADD MEMBER app_user;
ALTER ROLE db_datawriter ADD MEMBER app_user;
```

### 固定数据库角色

| 角色 | 权限 |
|------|------|
| **db_owner** | 数据库所有者，所有权限 |
| **db_securityadmin** | 管理角色和权限 |
| **db_accessadmin** | 管理数据库访问 |
| **db_backupoperator** | 备份数据库 |
| **db_datareader** | 读取所有用户表 |
| **db_datawriter** | 写入所有用户表 |
| **db_ddladmin** | 执行 DDL 命令 |
| **db_denydatareader** | 禁止读取 |
| **db_denydatawriter** | 禁止写入 |

### 服务器角色

```sql
-- 查看服务器角色
SELECT name FROM sys.server_principals WHERE type = 'R';

-- 添加服务器角色成员
ALTER SERVER ROLE sysadmin ADD MEMBER admin_user;

-- 常用服务器角色
-- sysadmin：系统管理员
-- securityadmin：安全管理员
-- serveradmin：服务器管理员
-- dbcreator：数据库创建者
```

## SQL Server 常用工具

### SQL Server Management Studio (SSMS)

SSMS 是 SQL Server 官方图形化管理工具：
- 数据库对象浏览
- T-SQL 编辑和执行
- 性能监控
- 备份恢复
- 安全管理

下载：https://docs.microsoft.com/sql/ssms/download-sql-server-management-studio-ssms

### Azure Data Studio

轻量级跨平台数据库工具：
- 支持 Windows、macOS、Linux
- 集成终端
- 扩展支持
- Git 集成

下载：https://docs.microsoft.com/sql/azure-data-studio/download

### sqlcmd 命令行工具

```bash
# 连接到 SQL Server
sqlcmd -S localhost -U SA -P 'Password123'

# 执行查询
sqlcmd -S localhost -U SA -P 'Password123' -Q "SELECT @@VERSION"

# 执行脚本文件
sqlcmd -S localhost -U SA -P 'Password123' -i script.sql

# 输出到文件
sqlcmd -S localhost -U SA -P 'Password123' -Q "SELECT * FROM employees" -o output.txt
```

### SQL Server Profiler

SQL 跟踪和分析工具：
- 捕获 SQL 语句
- 性能分析
- 故障诊断

注意：SQL Server 2019+ 推荐使用 Extended Events 替代 Profiler。

## SQL Server 与 MySQL 语法对比

| 功能 | SQL Server | MySQL |
|------|-----------|-------|
| 字符串连接 | `+` 或 `CONCAT()` | `CONCAT()` |
| 空值替换 | `ISNULL(col, value)` | `IFNULL(col, value)` |
| 条件判断 | `CASE WHEN` 或 `IIF()` | `CASE WHEN` 或 `IF()` |
| 当前日期 | `GETDATE()` 或 `SYSDATETIME()` | `NOW()` |
| 日期格式化 | `FORMAT(date, 'yyyy-MM-dd')` | `DATE_FORMAT(date, '%Y-%m-%d')` |
| 字符串转日期 | `CONVERT(DATETIME, str)` 或 `CAST(str AS DATETIME)` | `STR_TO_DATE(str, '%Y-%m-%d')` |
| 分页 | `OFFSET...FETCH` 或 `TOP` | `LIMIT` |
| 自增列 | `IDENTITY(1,1)` | `AUTO_INCREMENT` |
| 外连接 | `LEFT OUTER JOIN` | `LEFT JOIN` |
| 虚拟表 | 无（直接 SELECT） | `DUAL` |
| 注释 | `--` 或 `/* */` | `--` 或 `/* */` 或 `#` |

```sql
-- SQL Server 分页（2012+）
SELECT * FROM employees
ORDER BY employee_id
OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY;

-- SQL Server 分页（旧版本）
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (ORDER BY employee_id) AS rn
    FROM employees
) AS t
WHERE rn > 10 AND rn <= 20;

-- MySQL 分页
SELECT * FROM employees ORDER BY employee_id LIMIT 10, 10;
```

---

## 本章小结

- SQL Server 是 Microsoft 企业级数据库，与 Windows 生态深度集成
- 核心架构：数据库引擎（关系引擎 + 存储引擎）
- 系统数据库：master、model、msdb、tempdb
- 内存结构：Buffer Pool（数据缓存 + 计划缓存）
- 存储结构：数据文件（.mdf/.ndf）+ 日志文件（.ldf）
- 数据类型：INT、DECIMAL、VARCHAR/NVARCHAR、DATETIME2、UNIQUEIDENTIFIER
- 用户权限：登录名（服务器级）+ 用户（数据库级）
- 常用工具：SSMS、Azure Data Studio、sqlcmd
