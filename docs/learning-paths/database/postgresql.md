# PostgreSQL 学习路线

PostgreSQL，世界上最先进的开源关系数据库。如果说 MySQL 是数据库界的亲民代表，那 PostgreSQL 就是技术流的完美体现。它功能强大、标准兼容、扩展性极强，被称为"学院派"数据库。

## 为什么学 PostgreSQL

- 功能最完整的开源数据库，SQL 标准兼容性最好
- 支持复杂查询、窗口函数、CTE、JSONB、全文搜索等高级特性
- 扩展生态丰富，PostGIS、TimescaleDB、Citus 等
- 可靠性高，ACID 严格遵守，并发控制优秀
- 大公司的选择：Apple、Netflix、Instagram、Reddit

## 学习路线图

### 第一阶段：基础入门

**安装与配置**
- macOS/Linux/Windows 安装 PostgreSQL
- psql 命令行工具使用
- 基础命令：\l、\c、\dt、\d
- postgresql.conf 配置文件

**数据库与表操作**
- CREATE DATABASE 和字符编码
- CREATE TABLE 与数据类型
- SERIAL 与 GENERATED ALWAYS AS IDENTITY
- 约束：主键、外键、唯一、检查
- 默认值与自动更新时间戳

**基础 CRUD**
- INSERT 插入数据
- SELECT 查询与过滤
- UPDATE 更新数据
- DELETE 删除数据
- RETURNING 子句（PostgreSQL 特色）

### 第二阶段：进阶查询

**高级 SQL 特性**
- CTE（WITH 子句）与递归查询
- 窗口函数（ROW_NUMBER、RANK、LAG、LEAD）
- LATERAL JOIN（横向连接）
- GROUPING SETS、ROLLUP、CUBE
- FILTER 子句

**JSON 支持**
- JSON vs JSONB 区别
- JSONB 索引（GIN）
- JSON 操作符（->、->>、#>）
- jsonb_set、jsonb_insert 修改
- JSON 聚合函数

**全文搜索**
- tsvector 与 tsquery
- to_tsvector 与 to_tsquery
- GIN 索引加速搜索
- 中文分词（zhparser）
- 搜索结果排序（ts_rank）

### 第三阶段：高级特性

**索引类型**
- B-tree（默认）
- Hash 索引
- GIN（全文搜索、JSONB）
- GiST（地理空间、范围类型）
- BRIN（大表、顺序数据）
- 部分索引与表达式索引

**索引实现原理**
- B-tree 索引：平衡树、页分裂
- GIN 索引：倒排索引、Posting Tree
- GiST 索引：通用搜索树、扩展框架
- BRIN 索引：块范围索引、汇总数据
- 索引的 HOT 更新：Heap-Only Tuple
- 索引膨胀与 REINDEX
- 索引的可见性与部分索引优化

**视图与物化视图**
- CREATE VIEW 创建视图
- 可更新视图
- MATERIALIZED VIEW 物化视图
- REFRESH MATERIALIZED VIEW
- 物化视图的增量刷新

**函数与存储过程**
- CREATE FUNCTION（PL/pgSQL）
- RETURNS TABLE 返回表
- CREATE PROCEDURE（事务控制）
- 触发器（BEFORE、AFTER、INSTEAD OF）
- 事件触发器

### 第四阶段：性能优化

**查询优化**
- EXPLAIN 与 EXPLAIN ANALYZE
- 索引扫描 vs 顺序扫描
- Join 策略（Nested Loop、Hash Join、Merge Join）
- 统计信息（ANALYZE）
- 查询规划器参数调整

**MVCC 并发控制**
- 多版本并发控制原理
- 元组版本：xmin、xmax
- 事务快照：TransactionId、Snapshot
- 可见性判断规则
- 死元组（Dead Tuple）清理
- VACUUM 机制：标准 VACUUM、VACUUM FULL
- Autovacuum 自动清理
- HOT 更新：Heap-Only Tuple

**WAL 日志系统**
- WAL（Write-Ahead Logging）原理
- WAL 段文件：16MB 分段
- WAL 写入流程：缓冲区、刷盘
- Checkpoint 检查点：数据持久化
- WAL 归档：连续归档与备份
- PITR 恢复：指定时间点恢复
- WAL 级别：minimal、replica、logical
- WAL 的性能影响与调优

**查询优化器深入**
- 基于成本的优化（CBO）
- 统计信息收集：pg_statistic
- 选择性（Selectivity）估算
- 连接顺序优化：动态规划、遗传算法
- 物化视图与查询重写
- 并行查询：Parallel Seq Scan、Parallel Hash Join
- JIT 编译：LLVM 加速表达式计算

**配置调优**
- shared_buffers（内存）
- work_mem（排序内存）
- maintenance_work_mem（维护操作）
- effective_cache_size
- max_connections 与连接池

**分区表**
- 声明式分区（PARTITION BY）
- 范围分区（RANGE）
- 列表分区（LIST）
- 哈希分区（HASH）
- 分区剪枝优化

**分区表深入**
- 分区表的继承实现（旧方法）
- 声明式分区的优势
- 分区键选择策略
- 分区修剪（Partition Pruning）
- 分区智能连接（Partition-wise Join）
- 分区智能聚合（Partition-wise Aggregate）
- 默认分区与分区约束排除
- 分区表的索引管理

### 第五阶段：高可用与扩展

**复制与高可用**
- 流复制（Streaming Replication）
- 逻辑复制（Logical Replication）
- 同步复制 vs 异步复制
- 自动故障转移（Patroni、repmgr）
- 读写分离方案

**流复制深入**
- 物理复制：WAL 日志传输
- 复制槽（Replication Slot）：防止 WAL 删除
- 同步复制的同步级别：remote_apply、on、remote_write
- 级联复制：Standby 级联
- 延迟备库：recovery_min_apply_delay
- 复制监控：pg_stat_replication
- 流复制的性能优化

**逻辑复制深入**
- 发布订阅模型（Publication & Subscription）
- 行级复制：选择性复制
- 逻辑解码（Logical Decoding）
- 复制冲突处理
- 双向复制与多主复制
- 逻辑复制的应用场景：跨版本迁移、异构数据同步

**并发控制深入**
- 锁的层次：表锁、行锁、页锁、Advisory Lock
- 锁模式：AccessShareLock、RowExclusiveLock、ExclusiveLock
- 死锁检测：死锁超时、锁等待图
- 序列化隔离级别实现：SSI（Serializable Snapshot Isolation）
- 两阶段锁协议
- 锁监控：pg_locks 视图

**备份与恢复**
- pg_dump 逻辑备份
- pg_basebackup 物理备份
- PITR（Point-in-Time Recovery）
- WAL 归档与恢复
- 备份策略设计

**扩展生态**
- PostGIS（地理空间数据）
- TimescaleDB（时序数据）
- Citus（分布式扩展）
- pg_partman（分区管理）
- pgvector（向量搜索）

**扩展开发**
- 扩展框架：CREATE EXTENSION
- C 语言扩展开发
- 自定义函数：CREATE FUNCTION
- 自定义类型：CREATE TYPE
- 自定义操作符：CREATE OPERATOR
- 自定义聚合函数：CREATE AGGREGATE
- 钩子函数（Hook）：扩展核心功能
- 扩展的打包与发布：PGXN

## 下一步学习

学完 PostgreSQL 后，可以继续探索：
- **PostGIS**：地理信息系统开发
- **TimescaleDB**：时序数据库应用
- **数据库内核**：深入理解 MVCC 和 WAL
- **分布式数据库**：Citus、Greenplum

## 实用工具

- **psql**：官方命令行工具
- **pgAdmin**：官方 GUI 工具
- **DBeaver**：跨平台客户端
- **pgcli**：智能补全的命令行工具
- **pg_stat_statements**：查询性能统计

PostgreSQL 是数据库领域的瑞士军刀，功能强大、扩展性强、可靠性高。从基础的 CRUD 到高级的窗口函数、全文搜索、空间数据，它都能游刃有余。先从 MySQL 的习惯中转变过来，慢慢体会 PostgreSQL 的强大之处。多实践，多探索，PostgreSQL 会成为你最信赖的数据库。
