# MongoDB 学习路线

MongoDB，文档数据库的代表作。抛开传统关系数据库的表和行，MongoDB 用灵活的 JSON 文档存储数据。它天生适合快速迭代的应用，schema 可以随需而变，不用纠结表结构设计。

## 为什么学 MongoDB

- 文档模型直观，和应用对象模型天然匹配
- Schema 灵活，适合快速迭代和需求变化
- 水平扩展能力强，天生支持分片
- 查询功能强大，支持复杂聚合操作
- 被广泛应用于内容管理、实时分析、物联网等场景

## 学习路线图

### 第一阶段：基础入门

**安装与连接**
- macOS/Linux/Windows 安装 MongoDB
- mongosh 命令行工具
- 基础命令：show dbs、use、show collections
- MongoDB Compass GUI 工具

**文档操作**
- insertOne / insertMany 插入文档
- find / findOne 查询文档
- updateOne / updateMany 更新文档
- deleteOne / deleteMany 删除文档
- replaceOne 替换整个文档

**查询基础**
- 相等查询：`{ field: value }`
- 比较操作符：$gt、$lt、$gte、$lte、$ne
- 逻辑操作符：$and、$or、$not、$nor
- 数组查询：$in、$nin、$all、$size
- 正则表达式查询

### 第二阶段：进阶查询

**复杂查询**
- 嵌套文档查询（点表示法）
- 数组元素查询（$elemMatch）
- $exists 检查字段存在
- $type 类型判断
- projection 字段投影

**更新操作符**
- $set、$unset 设置/删除字段
- $inc、$mul 数值运算
- $push、$pull 数组操作
- $addToSet 集合添加
- $rename 重命名字段

**聚合管道**
- $match 过滤文档
- $group 分组聚合
- $project 字段投影
- $sort、$limit、$skip
- $lookup 关联查询（类似 JOIN）
- $unwind 展开数组

### 第三阶段：高级特性

**索引优化**
- 单字段索引
- 复合索引
- 多键索引（数组字段）
- 文本索引（全文搜索）
- 地理空间索引（2dsphere）
- explain() 分析查询性能

**数据建模**
- 嵌入式文档 vs 引用
- 一对一关系
- 一对多关系
- 多对多关系
- 反范式化设计
- 文档大小限制（16MB）

**事务支持**
- 单文档原子性
- 多文档事务（ACID）
- 事务隔离级别
- startSession 与 commitTransaction
- 事务的性能影响

### 第四阶段：分片与复制

**副本集**
- 主从复制原理
- 配置副本集
- 自动故障转移
- 读写分离策略
- oplog 与同步延迟

**分片集群**
- 分片键选择
- 哈希分片 vs 范围分片
- 配置服务器（Config Server）
- mongos 路由器
- 数据均衡与迁移

**性能优化**
- 慢查询分析
- 索引优化策略
- 文档结构优化
- 连接池配置
- WiredTiger 存储引擎

### 第五阶段：运维实战

**备份恢复**
- mongodump / mongorestore
- 文件系统快照
- 副本集备份策略
- 时间点恢复
- 备份自动化

**监控告警**
- mongostat 实时统计
- mongotop 集合活动
- 慢查询日志
- 副本集状态监控
- 磁盘使用监控

**安全加固**
- 启用身份验证
- 角色权限管理
- 网络访问控制
- 加密传输（TLS/SSL）
- 数据加密存储

## 下一步学习

学完 MongoDB 后，可以继续探索：
- **Elasticsearch**：全文搜索与日志分析
- **Redis**：高性能缓存方案
- **时序数据库**：InfluxDB、TimescaleDB
- **图数据库**：Neo4j

## 实用工具

- **mongosh**：官方命令行工具
- **MongoDB Compass**：官方 GUI 工具
- **Studio 3T**：功能强大的商业工具
- **Robo 3T**：轻量级客户端
- **MongoDB Atlas**：官方云服务

MongoDB 的灵活性和强大的查询能力让它成为现代应用的理想选择。从基础的 CRUD 到复杂的聚合管道，从单机到分片集群，MongoDB 都能游刃有余。别被 NoSQL 吓到，它其实比你想象的简单。先从文档模型开始，慢慢理解它和关系数据库的区别。多实践，多思考，MongoDB 会成为你的得力助手。
