# MySQL 学习路线

MySQL，世界上最流行的开源关系数据库。从小博客到大公司，它无处不在。学会 MySQL，你就掌握了数据持久化的核心武器。

## 为什么学 MySQL

- 市场占有率第一，招聘需求最大
- 免费开源，社区活跃，资源丰富
- 性能优秀，适合各种规模的应用
- 生态完善，工具链成熟

## 学习路线图

### 第一阶段：基础入门

**安装与连接**
- 在 macOS/Linux/Windows 上安装 MySQL
- 使用 mysql 命令行客户端连接数据库
- 基础命令：SHOW DATABASES、USE、SHOW TABLES

**数据库与表操作**
- CREATE DATABASE 创建数据库
- 字符集选择（utf8mb4）
- CREATE TABLE 定义表结构
- 数据类型选择（INT、VARCHAR、TEXT、TIMESTAMP 等）
- 主键、外键、索引的概念

**基础 CRUD**
- INSERT：单行插入、批量插入
- SELECT：简单查询、WHERE 条件、ORDER BY 排序
- UPDATE：更新数据
- DELETE：删除数据
- LIMIT 和 OFFSET 实现分页

### 第二阶段：进阶查询

**复杂查询技巧**
- JOIN 多表连接（INNER、LEFT、RIGHT）
- 子查询与嵌套查询
- GROUP BY 分组统计
- HAVING 过滤分组结果
- DISTINCT 去重
- UNION 联合查询

**聚合函数与统计**
- COUNT、SUM、AVG、MAX、MIN
- 窗口函数（ROW_NUMBER、RANK）
- 日期时间函数
- 字符串处理函数

**索引设计**
- 单列索引 vs 复合索引
- 唯一索引与普通索引
- 全文索引（FULLTEXT）
- 最左前缀原则
- EXPLAIN 分析查询计划

**索引原理深入**
- B+ 树结构：叶子节点存储数据
- 聚簇索引：主键索引、数据存储
- 二级索引：辅助索引、回表查询
- 覆盖索引：避免回表
- 索引下推（Index Condition Pushdown）
- MRR（Multi-Range Read）优化
- 索引的维护成本：页分裂、页合并
- 索引失效场景：函数、隐式转换、左模糊

### 第三阶段：高级特性

**事务处理**
- ACID 特性理解
- BEGIN、COMMIT、ROLLBACK
- 四种隔离级别
- 死锁检测与处理
- 事务日志（redo log、undo log）

**InnoDB 存储引擎**
- InnoDB vs MyISAM 区别
- 表空间结构：系统表空间、独立表空间
- 页（Page）结构：16KB 数据页
- B+ 树索引结构
- 聚簇索引与二级索引
- 自适应哈希索引
- Change Buffer 变更缓冲
- 双写缓冲（Doublewrite Buffer）

**锁机制深入**
- 锁的粒度：表锁、行锁、页锁
- 共享锁（S）与排他锁（X）
- 意向锁（IS、IX）
- 记录锁（Record Lock）
- 间隙锁（Gap Lock）
- Next-Key Lock：防止幻读
- 插入意向锁（Insert Intention Lock）
- 死锁的产生与检测

**MVCC 多版本并发控制**
- 版本链：undo log 链表
- Read View 一致性视图
- 隐藏列：DB_TRX_ID、DB_ROLL_PTR
- 快照读 vs 当前读
- READ COMMITTED 与 REPEATABLE READ 的实现
- MVCC 如何解决幻读
- Purge 线程清理旧版本

**视图与存储过程**
- CREATE VIEW 创建视图
- 存储过程编写
- 函数与触发器
- 游标使用

**用户权限管理**
- CREATE USER 创建用户
- GRANT 授权
- REVOKE 撤销权限
- 权限最小化原则

### 第四阶段：性能优化

**查询优化**
- 慢查询日志分析
- EXPLAIN 详解（type、key、rows、Extra）
- 索引失效场景
- 避免全表扫描
- 查询重写技巧

**查询优化深入**
- 查询执行流程：连接器、分析器、优化器、执行器
- 查询缓存（MySQL 8.0 已移除）
- 优化器的选择：基于成本的优化
- 连接算法：Nested Loop Join、Block Nested Loop
- 子查询优化：转换为 JOIN
- LIMIT 大偏移量优化：延迟关联
- 分页优化：游标、上次最大值
- COUNT(*) 优化：覆盖索引
- IN vs EXISTS 选择策略

**配置优化**
- innodb_buffer_pool_size 调优
- query_cache 配置
- 连接数管理
- 表分区策略

**架构优化**
- 读写分离
- 主从复制配置
- 分库分表策略
- 数据归档方案

**主从复制深入**
- 复制原理：binlog、relay log
- 异步复制、半同步复制、全同步复制
- 复制格式：Statement、Row、Mixed
- GTID 复制：全局事务标识
- 主从延迟的原因与优化
- 并行复制：多线程复制
- 双主复制与循环复制
- 复制过滤：binlog-do-db、replicate-ignore-table

**分库分表**
- 垂直拆分：按业务模块
- 水平拆分：按数据量
- 分片策略：Hash、Range、一致性哈希
- 分布式主键生成：雪花算法、UUID
- 跨分片查询：路由、聚合
- 分布式事务：两阶段提交、Seata
- 中间件：ShardingSphere、MyCat
- 数据迁移与扩容

### 第五阶段：运维实战

**备份恢复**
- mysqldump 逻辑备份
- 物理备份（Percona XtraBackup）
- 增量备份策略
- 灾难恢复演练

**监控告警**
- 慢查询监控
- 连接数监控
- 主从延迟监控
- 磁盘空间告警

**高可用方案**
- 主从复制
- 半同步复制
- MySQL Group Replication
- MHA（Master High Availability）

## 下一步学习

学完 MySQL 后，可以继续探索：
- **PostgreSQL**：学院派数据库，功能更强大
- **Redis**：缓存与高性能方案
- **MongoDB**：文档数据库，灵活的数据模型
- **数据库设计模式**：深入理解范式与反范式

## 实用工具

- **MySQL Workbench**：官方 GUI 工具
- **DBeaver**：跨平台数据库客户端
- **mycli**：命令行工具，支持自动补全
- **Percona Toolkit**：性能分析工具套件
- **pt-query-digest**：慢查询日志分析神器

从一个简单的 `SELECT * FROM users` 到主从复制、分库分表，MySQL 的学习之路既漫长又有趣。先把基础打牢，再逐步深入性能优化和高可用架构。记住：索引是性能的关键，事务是数据一致性的保障。多实践，多思考，MySQL 会成为你最得力的数据管家。
