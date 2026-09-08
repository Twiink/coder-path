---
title: "Oracle入门与架构"
aliases:
  - "Oracle Database"
  - "Oracle数据库"
tags:
  - "后端"
  - "数据库"
  - "oracle"
  - "企业级数据库"
  - "笔记"
category: "后端"
folder: "Oracle与SQLServer"
parent: "[[目录]]"
related:
  - "[[后端/数据库/Oracle与SQLServer/Oracle SQL与PLSQL编程]]"
  - "[[后端/数据库/Oracle与SQLServer/Oracle性能优化与管理]]"
  - "[[后端/数据库/MySQL/MySQL入门与安装配置]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 01 Oracle 入门与架构

Oracle Database 是甲骨文公司开发的企业级关系数据库管理系统，是全球最流行的商业数据库之一，广泛应用于金融、电信、政府、制造等关键业务系统。

## 1.1 Oracle 简介

### 1.1.1 发展历程

```text
1977  Larry Ellison 等人创立 SDL（后改名 Oracle）
1979  Oracle V2（第一个商业 SQL 关系数据库）
1983  Oracle V3（第一个便携式数据库）
1992  Oracle7（引入 PL/SQL、触发器）
1997  Oracle8（对象关系数据库）
1999  Oracle8i（互联网计算）
2001  Oracle9i（RAC 集群）
2003  Oracle10g（网格计算）
2007  Oracle11g（自动管理、压缩）
2013  Oracle12c（多租户架构）
2018  Oracle18c（自治数据库）
2019  Oracle19c（长期支持版本）
2021  Oracle21c（JSON 增强、机器学习）
2023  Oracle23c（最新长期支持版本）
```

### 1.1.2 核心特性

| 特性 | 说明 |
|------|------|
| **多租户架构** | 一个容器数据库（CDB）包含多个可插拔数据库（PDB） |
| **RAC（Real Application Clusters）** | 多实例共享存储，实现高可用和负载均衡 |
| **Data Guard** | 主备复制，支持物理备库和逻辑备库 |
| **分区表** | 范围分区、列表分区、哈希分区、组合分区 |
| **物化视图** | 预计算并存储查询结果，提升查询性能 |
| **并行查询** | 多进程并行执行大查询，充分利用多核 CPU |
| **高级压缩** | 表压缩、索引压缩、LOB 压缩，节省存储 |
| **Flashback Technology** | 闪回技术，可快速恢复误操作数据 |
| **ASM（Automatic Storage Management）** | 自动存储管理，简化磁盘管理 |
| **ADG（Active Data Guard）** | 备库可读，分担查询压力 |

### 1.1.3 适用场景

```text
✅ 适合：
  · 大型企业级关键业务系统
  · 金融交易系统（银行、证券、保险）
  · 电信计费系统
  · 政府核心业务系统
  · 需要高级特性和技术支持的场景
  · 数据仓库和 OLAP

❌ 不适合：
  · 互联网创业公司（成本高）
  · 小型 Web 应用（过重）
  · 预算有限的项目
  · 需要快速迭代的场景
```

### 1.1.4 Oracle vs 其他数据库

| 特性 | Oracle | MySQL | PostgreSQL | SQL Server |
|------|--------|-------|------------|-----------|
| **许可成本** | 高（按 CPU 核心） | 开源免费 | 开源免费 | 中高 |
| **平台支持** | Linux、Windows、Unix | 跨平台 | 跨平台 | Windows、Linux |
| **高可用** | RAC、Data Guard | 主从复制 | 流复制 | Always On |
| **多租户** | CDB/PDB | 无 | 无 | 无 |
| **过程化语言** | PL/SQL | 存储过程 | PL/pgSQL | T-SQL |
| **云服务** | Oracle Cloud | 各云厂商 | 各云厂商 | Azure |
| **学习曲线** | 陡峭 | 平缓 | 中等 | 中等 |
| **技术支持** | 官方支持 | 社区 | 社区 | 官方支持 |

## 1.2 Oracle 架构

### 1.2.1 实例与数据库

```text
Oracle 数据库 = 物理文件（数据文件、控制文件、重做日志等）
Oracle 实例 = 内存结构（SGA）+ 后台进程

一个数据库可以被多个实例挂载（RAC）
一个实例同一时刻只能挂载一个数据库（非 RAC）
```

### 1.2.2 内存结构（SGA + PGA）

**SGA（System Global Area，系统全局区）**：

```text
┌─────────────────────────────────────┐
│           SGA（共享内存）            │
├─────────────────────────────────────┤
│  Database Buffer Cache              │  数据缓冲区（缓存数据块）
│  - 默认池（DEFAULT）                │
│  - 保持池（KEEP）                   │
│  - 回收池（RECYCLE）                │
├─────────────────────────────────────┤
│  Shared Pool                        │  共享池
│  - Library Cache（SQL 解析树）      │
│  - Data Dictionary Cache（字典缓存）│
├─────────────────────────────────────┤
│  Redo Log Buffer                    │  重做日志缓冲区
├─────────────────────────────────────┤
│  Large Pool                         │  大池（RMAN、共享服务器）
├─────────────────────────────────────┤
│  Java Pool                          │  Java 池（Java 存储过程）
├─────────────────────────────────────┤
│  Streams Pool                       │  Streams 池（复制）
└─────────────────────────────────────┘
```

**PGA（Program Global Area，程序全局区）**：

```text
每个服务器进程私有内存：
  · Sort Area（排序区）
  · Hash Area（哈希区）
  · Session Information（会话信息）
```

### 1.2.3 后台进程

**必需进程**：

| 进程 | 作用 |
|------|------|
| **PMON**（Process Monitor） | 监控用户进程，清理失败进程，释放锁 |
| **SMON**（System Monitor） | 实例恢复，清理临时段，合并空闲空间 |
| **DBWn**（Database Writer） | 将脏数据块从 Buffer Cache 写入数据文件 |
| **LGWR**（Log Writer） | 将 Redo Log Buffer 写入重做日志文件 |
| **CKPT**（Checkpoint） | 触发 DBWn，更新控制文件和数据文件头 |
| **ARCn**（Archiver） | 归档重做日志（归档模式） |

**可选进程**：

| 进程 | 作用 |
|------|------|
| **RECO**（Recoverer） | 分布式事务恢复 |
| **LCKn**（Lock） | RAC 实例间锁管理 |
| **LMD**（Lock Manager Daemon） | RAC 锁管理守护进程 |
| **LMS**（Lock Manager Server） | RAC 全局缓存服务 |

### 1.2.4 物理存储结构

```text
┌─────────────────────────────────────┐
│           数据库文件                 │
├─────────────────────────────────────┤
│  数据文件（Data Files）             │  存储表、索引等数据
│  - SYSTEM 表空间                    │  数据字典
│  - SYSAUX 表空间                    │  辅助数据
│  - UNDO 表空间                      │  回滚数据
│  - TEMP 表空间                      │  临时数据
│  - USERS 表空间                     │  用户数据
├─────────────────────────────────────┤
│  控制文件（Control Files）          │  记录数据库结构
│  - 数据文件位置                     │
│  - 重做日志位置                     │
│  - 检查点信息                       │
├─────────────────────────────────────┤
│  重做日志文件（Redo Log Files）     │  记录所有变更
│  - 在线重做日志                     │
│  - 归档重做日志（归档模式）         │
├─────────────────────────────────────┤
│  参数文件（Parameter File）         │  实例配置
│  - SPFILE（二进制）                 │
│  - PFILE（文本）                    │
├─────────────────────────────────────┤
│  密码文件（Password File）          │  SYS 用户密码
├─────────────────────────────────────┤
│  归档日志（Archive Logs）           │  归档的重做日志
└─────────────────────────────────────┘
```

### 1.2.5 逻辑存储结构

```text
┌─────────────────────────────────────┐
│           逻辑结构                   │
├─────────────────────────────────────┤
│  表空间（Tablespace）               │  逻辑存储单位
│  └── 数据文件（Data File）          │  物理存储单位
│      └── 段（Segment）              │  对象存储单位
│          └── 区（Extent）           │  连续数据块
│              └── 数据块（Block）    │  最小 I/O 单位（默认 8KB）
└─────────────────────────────────────┘
```

**段（Segment）类型**：

| 段类型 | 说明 |
|--------|------|
| **数据段** | 存储表数据 |
| **索引段** | 存储索引数据 |
| **回滚段** | 存储回滚数据（UNDO） |
| **临时段** | 存储临时数据（排序、哈希） |
| **LOB 段** | 存储大对象（CLOB、BLOB） |

### 1.2.6 多租户架构（12c+）

```text
容器数据库（CDB）
  ├── 根容器（CDB$ROOT）
  │   └── 公共用户、公共对象
  ├── 种子容器（PDB$SEED）
  │   └── 创建 PDB 的模板
  └── 可插拔数据库（PDB）
      ├── PDB1（应用 A）
      ├── PDB2（应用 B）
      └── PDB3（应用 C）
```

**优势**：
- 资源共享（内存、后台进程）
- 简化管理（统一管理多个数据库）
- 快速部署（克隆 PDB）
- 隔离性（每个 PDB 独立）

## 1.3 Oracle 安装与配置

### 1.3.1 系统要求

```text
硬件要求（最低）：
  · CPU：2 核
  · 内存：4GB（推荐 8GB+）
  · 磁盘：20GB（推荐 100GB+）

软件要求：
  · Linux：Oracle Linux 7+、RHEL 7+、CentOS 7+
  · Windows：Windows Server 2016+
```

### 1.3.2 Linux 安装步骤

```bash
# 1. 安装依赖包
sudo yum install -y oracle-database-preinstall-19c

# 2. 创建用户和组
sudo groupadd -g 54321 oinstall
sudo groupadd -g 54322 dba
sudo groupadd -g 54323 oper
sudo useradd -u 54321 -g oinstall -G dba,oper oracle

# 3. 创建目录
sudo mkdir -p /u01/app/oracle
sudo chown -R oracle:oinstall /u01/app/oracle

# 4. 配置环境变量（oracle 用户）
cat >> ~/.bash_profile << 'EOF'
export ORACLE_BASE=/u01/app/oracle
export ORACLE_HOME=$ORACLE_BASE/product/19.0.0/dbhome_1
export ORACLE_SID=orcl
export PATH=$ORACLE_HOME/bin:$PATH
EOF

# 5. 下载安装包（从 Oracle 官网下载）
# LINUX.X64_193000_db_home.zip

# 6. 解压并安装
unzip LINUX.X64_193000_db_home.zip -d $ORACLE_HOME
cd $ORACLE_HOME
./runInstaller

# 7. 执行 root 脚本（安装程序提示）
sudo /u01/app/oraInventory/orainstRoot.sh
sudo /u01/app/oracle/product/19.0.0/dbhome_1/root.sh
```

### 1.3.3 Docker 安装（开发环境）

```bash
# 使用官方镜像（需要 Oracle 账号下载）
docker run -d --name oracle19c \
  -p 1521:1521 \
  -p 5500:5500 \
  -e ORACLE_PWD=YourPassword123 \
  -v oracle_data:/opt/oracle/oradata \
  container-registry.oracle.com/database/enterprise:19.3.0.0

# 或使用社区镜像（更快）
docker run -d --name oracle19c \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=YourPassword123 \
  gvenzl/oracle-xe:21-slim
```

### 1.3.4 连接 Oracle

```bash
# 使用 SQL*Plus
sqlplus sys/YourPassword123@localhost:1521/ORCLPDB as sysdba

# 使用 SQL Developer（图形化工具）
# 下载：https://www.oracle.com/database/sqldeveloper/
```

## 1.4 Oracle 数据类型

### 1.4.1 常用数据类型

| 类型 | 说明 | 示例 |
|------|------|------|
| **NUMBER(p,s)** | 数值类型，p 为精度（1-38），s 为小数位 | NUMBER(10,2) |
| **VARCHAR2(n)** | 可变长字符串，最大 4000 字节 | VARCHAR2(100) |
| **CHAR(n)** | 固定长度字符串，最大 2000 字节 | CHAR(10) |
| **DATE** | 日期时间（精确到秒，公元前 4712 年到公元 9999 年） | DATE |
| **TIMESTAMP** | 时间戳（精确到纳秒） | TIMESTAMP(6) |
| **TIMESTAMP WITH TIME ZONE** | 带时区的时间戳 | TIMESTAMP(6) WITH TIME ZONE |
| **CLOB** | 字符大对象，最大 4GB | CLOB |
| **BLOB** | 二进制大对象，最大 4GB | BLOB |
| **RAW(n)** | 二进制数据，最大 2000 字节 | RAW(16) |
| **LONG** | 可变长字符串，最大 2GB（已废弃，用 CLOB） | LONG |

### 1.4.2 NUMBER 类型详解

```sql
-- NUMBER(p,s)
-- p：精度（总位数），1-38
-- s：小数位，-84 到 127

CREATE TABLE number_demo (
    id NUMBER(10),              -- 整数，最大 10 位
    price NUMBER(10,2),         -- 小数，总 10 位，小数 2 位
    rate NUMBER(5,-2),          -- 精度为 5，小数位为 -2（四舍五入到百位）
    value NUMBER                -- 不指定精度，最大精度 38
);

INSERT INTO number_demo VALUES (1234567890, 12345678.90, 12345, 12345678901234567890123456789012345678);

-- rate 列：12345 → 12300（四舍五入到百位）
```

### 1.4.3 DATE 与 TIMESTAMP

```sql
-- DATE：精确到秒
SELECT TO_DATE('2026-09-06 10:30:00', 'YYYY-MM-DD HH24:MI:SS') FROM DUAL;

-- TIMESTAMP：精确到纳秒
SELECT TO_TIMESTAMP('2026-09-06 10:30:00.123456789', 'YYYY-MM-DD HH24:MI:SS.FF9') FROM DUAL;

-- 日期运算
SELECT SYSDATE + 1 FROM DUAL;              -- 明天
SELECT SYSDATE - 1 FROM DUAL;              -- 昨天
SELECT ADD_MONTHS(SYSDATE, 1) FROM DUAL;   -- 下个月
SELECT MONTHS_BETWEEN(SYSDATE, hire_date) FROM employees;  -- 月数差

-- 日期格式化
SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') FROM DUAL;
SELECT TO_CHAR(SYSDATE, 'YYYY"年"MM"月"DD"日"') FROM DUAL;
```

### 1.4.4 LOB 类型

```sql
-- CLOB：字符大对象
CREATE TABLE documents (
    id NUMBER PRIMARY KEY,
    title VARCHAR2(200),
    content CLOB
);

-- BLOB：二进制大对象
CREATE TABLE images (
    id NUMBER PRIMARY KEY,
    name VARCHAR2(100),
    image BLOB
);

-- 插入 CLOB
INSERT INTO documents VALUES (1, 'Document 1', 'This is a long text...');

-- 插入 BLOB（使用 UTL_RAW）
INSERT INTO images VALUES (1, 'image.png', UTL_RAW.CAST_TO_RAW('binary data'));
```

## 1.5 Oracle 用户与权限

### 1.5.1 创建用户

```sql
-- 创建用户
CREATE USER app_user IDENTIFIED BY password123
    DEFAULT TABLESPACE users
    TEMPORARY TABLESPACE temp
    QUOTA 100M ON users;

-- 修改密码
ALTER USER app_user IDENTIFIED BY newpassword;

-- 锁定/解锁用户
ALTER USER app_user ACCOUNT LOCK;
ALTER USER app_user ACCOUNT UNLOCK;

-- 删除用户
DROP USER app_user;                -- 用户无对象时
DROP USER app_user CASCADE;        -- 删除用户及其所有对象
```

### 1.5.2 权限管理

```sql
-- 授予系统权限
GRANT CREATE SESSION TO app_user;           -- 连接数据库
GRANT CREATE TABLE TO app_user;             -- 创建表
GRANT CREATE VIEW TO app_user;              -- 创建视图
GRANT CREATE PROCEDURE TO app_user;         -- 创建存储过程
GRANT UNLIMITED TABLESPACE TO app_user;     -- 无限制表空间

-- 授予对象权限
GRANT SELECT ON employees TO app_user;      -- 查询表
GRANT INSERT, UPDATE, DELETE ON employees TO app_user;  -- 增删改
GRANT EXECUTE ON my_procedure TO app_user;  -- 执行存储过程

-- 撤销权限
REVOKE CREATE TABLE FROM app_user;
REVOKE SELECT ON employees FROM app_user;
```

### 1.5.3 角色管理

```sql
-- 创建角色
CREATE ROLE app_role;

-- 授予权限给角色
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW TO app_role;
GRANT SELECT ON employees TO app_role;

-- 授予角色给用户
GRANT app_role TO app_user;

-- 撤销角色
REVOKE app_role FROM app_user;

-- 删除角色
DROP ROLE app_role;

-- 预定义角色
-- CONNECT：基本连接权限
-- RESOURCE：创建表、序列、触发器等
-- DBA：所有系统权限
GRANT CONNECT, RESOURCE TO app_user;
```

### 1.5.4 常用角色

| 角色 | 权限 |
|------|------|
| **CONNECT** | CREATE SESSION |
| **RESOURCE** | CREATE TABLE, CREATE SEQUENCE, CREATE TRIGGER, CREATE PROCEDURE 等 |
| **DBA** | 所有系统权限（管理员） |
| **SELECT_CATALOG_ROLE** | 查询数据字典 |
| **EXECUTE_CATALOG_ROLE** | 执行系统包 |

## 1.6 Oracle 常用工具

### 1.6.1 SQL*Plus

```bash
# 连接
sqlplus username/password@host:port/service_name

# 常用命令
SET PAGESIZE 100           -- 设置每页行数
SET LINESIZE 200           -- 设置每行宽度
SET TIMING ON              -- 显示执行时间
SET AUTOTRACE ON           -- 显示执行计划
COLUMN column_name FORMAT A30  -- 格式化列
DESCRIBE table_name        -- 查看表结构
SHOW USER                  -- 显示当前用户
SHOW ALL                   -- 显示所有设置
SPOOL output.txt           -- 输出到文件
SPOOL OFF                  -- 关闭输出
```

### 1.6.2 SQL Developer

Oracle 官方图形化工具，功能包括：
- SQL 编辑和执行
- 数据库对象浏览
- 数据建模
- 性能监控
- 数据导入导出

下载：https://www.oracle.com/database/sqldeveloper/

### 1.6.3 Oracle Enterprise Manager（OEM）

Web 管理界面，功能包括：
- 数据库监控
- 性能调优
- 备份恢复
- 用户管理
- 集群管理

访问：https://host:5500/em

## 1.7 Oracle 与 MySQL 语法对比

| 功能 | Oracle | MySQL |
|------|--------|-------|
| 字符串连接 | `\|\|` 或 `CONCAT()` | `CONCAT()` |
| 空值替换 | `NVL(col, value)` | `IFNULL(col, value)` |
| 条件判断 | `DECODE(col, v1, r1, v2, r2, default)` | `CASE WHEN` 或 `IF()` |
| 当前日期 | `SYSDATE` | `NOW()` |
| 日期格式化 | `TO_CHAR(date, 'YYYY-MM-DD')` | `DATE_FORMAT(date, '%Y-%m-%d')` |
| 字符串转日期 | `TO_DATE(str, 'YYYY-MM-DD')` | `STR_TO_DATE(str, '%Y-%m-%d')` |
| 分页 | `ROWNUM` 或 `FETCH FIRST` | `LIMIT` |
| 自增列 | `SEQUENCE` + `TRIGGER` | `AUTO_INCREMENT` |
| 外连接 | `(+)` 或 `LEFT OUTER JOIN` | `LEFT JOIN` |
| 虚拟表 | `DUAL` | 无（直接 SELECT） |
| 注释 | `--` 或 `/* */` | `--` 或 `/* */` 或 `#` |

```sql
-- Oracle 分页（12c+）
SELECT * FROM employees
ORDER BY employee_id
OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY;

-- Oracle 分页（11g 及之前）
SELECT * FROM (
    SELECT t.*, ROWNUM rn FROM employees t ORDER BY employee_id
) WHERE rn > 10 AND rn <= 20;

-- MySQL 分页
SELECT * FROM employees ORDER BY employee_id LIMIT 10, 10;
```

---

## 本章小结

- Oracle 是企业级商业数据库，功能强大但成本高
- 核心架构：实例（SGA + 后台进程）+ 数据库（物理文件）
- SGA 包含数据缓冲区、共享池、重做日志缓冲区等
- 多租户架构（12c+）：一个 CDB 包含多个 PDB
- 数据类型：NUMBER、VARCHAR2、DATE、TIMESTAMP、CLOB、BLOB
- 用户权限管理：用户、角色、系统权限、对象权限
- 常用工具：SQL*Plus、SQL Developer、OEM
