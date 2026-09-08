# Redis 学习路线

Redis，内存数据库的王者。它不仅是缓存，更是数据结构服务器。从简单的字符串到复杂的有序集合，从发布订阅到分布式锁，Redis 是高性能应用的必备武器。

## 为什么学 Redis

- 极致性能：内存操作，单线程无锁，轻松达到 10 万 QPS
- 丰富的数据结构：String、List、Hash、Set、Sorted Set 等
- 持久化支持：RDB 快照 + AOF 日志
- 高可用：主从复制、哨兵、集群
- 应用广泛：缓存、会话、排行榜、消息队列、分布式锁

## 学习路线图

### 第一阶段：基础数据结构

> 📖 阶段笔记：[Redis 入门与安装配置](/study-notes/database/redis/intro-installation) · [数据类型与命令](/study-notes/database/redis/data-types-commands)

**String（字符串）**
- SET / GET 基础操作
- INCR / DECR 计数器
- SETEX 设置过期时间
- MGET / MSET 批量操作
- 应用场景：缓存、计数、限流

**List（列表）**
- LPUSH / RPUSH 左右插入
- LPOP / RPOP 左右弹出
- LRANGE 范围查询
- BLPOP / BRPOP 阻塞弹出
- 应用场景：消息队列、最新列表

**Hash（哈希）**
- HSET / HGET 单字段操作
- HMSET / HMGET 多字段操作
- HINCRBY 字段递增
- HGETALL 获取所有字段
- 应用场景：对象存储、用户信息

**Set（集合）**
- SADD / SREM 添加/删除成员
- SISMEMBER 成员检查
- SINTER / SUNION / SDIFF 集合运算
- SRANDMEMBER 随机成员
- 应用场景：标签、去重、共同关注

**Sorted Set（有序集合）**
- ZADD 添加成员和分数
- ZRANGE / ZREVRANGE 范围查询
- ZRANK / ZREVRANK 排名查询
- ZINCRBY 分数递增
- 应用场景：排行榜、延时队列

### 第二阶段：高级特性

**过期与淘汰**
- EXPIRE / TTL 设置和查看过期时间
- PERSIST 移除过期时间
- 内存淘汰策略（LRU、LFU、TTL）
- maxmemory 配置
- 过期键的删除策略

**发布订阅**
- PUBLISH / SUBSCRIBE 发布订阅
- PSUBSCRIBE 模式订阅
- 消息丢失问题
- vs Stream 消息队列
- 应用场景：实时通知、聊天系统

**事务**
- MULTI / EXEC 事务执行
- WATCH 乐观锁
- DISCARD 取消事务
- 事务的局限性（不支持回滚）
- Lua 脚本替代方案

**Lua 脚本**
- EVAL / EVALSHA 执行脚本
- 原子性保证
- 脚本缓存
- 调试 Lua 脚本
- 应用场景：复杂业务逻辑、分布式锁

### 第三阶段：持久化与高可用

**持久化机制**
- RDB 快照（fork + 写时复制）
- AOF 日志（append-only file）
- RDB vs AOF 对比
- 混合持久化（RDB + AOF）
- 持久化配置调优
- 📖 笔记：[Redis 持久化](/study-notes/database/redis/persistence)

**主从复制**
- REPLICAOF 配置主从
- 全量同步 vs 增量同步
- 主从延迟处理
- 读写分离
- 主从切换

**哨兵模式**
- Sentinel 配置
- 主节点故障检测
- 自动故障转移
- Sentinel 集群
- 通知与客户端重连

**集群模式**
- Redis Cluster 架构
- 数据分片（16384 个槽）
- 节点通信（Gossip 协议）
- 故障检测与转移
- 集群扩容与缩容

### 第四阶段：实战应用

**缓存设计**
- 缓存穿透（布隆过滤器）
- 缓存击穿（互斥锁）
- 缓存雪崩（过期时间随机化）
- 缓存预热
- 缓存更新策略
- 📖 笔记：[缓存设计与常见问题](/study-notes/database/redis/cache-design-common-pitfalls)

**分布式锁**
- SETNX 实现简单锁
- SET NX EX 原子操作
- Redlock 算法
- 锁超时问题
- Redisson 客户端
- 📖 笔记：[分布式锁与事务](/study-notes/database/redis/distributed-locks-transactions)

**限流方案**
- 计数器限流
- 滑动窗口限流
- 令牌桶算法
- 漏桶算法
- 应用场景：API 限流

**延时队列**
- Sorted Set 实现
- ZRANGEBYSCORE 获取到期任务
- 可靠性保证
- vs 消息队列
- 应用场景：定时任务、订单超时

### 第五阶段：性能优化

**性能调优**
- 慢查询日志（SLOWLOG）
- 大 key 检测与拆分
- 热 key 问题与本地缓存
- Pipeline 批量操作
- 连接池配置

**内存优化**
- 内存碎片整理
- 对象共享池
- 压缩列表（ziplist）
- 整数集合（intset）
- 内存淘汰策略选择

**监控运维**
- INFO 命令详解
- redis-cli --bigkeys
- redis-cli --hotkeys
- 主从延迟监控
- 内存使用监控

## 下一步学习

学完 Redis 后，可以继续探索：
- **Memcached**：纯缓存方案对比
- **消息队列**：RabbitMQ、Kafka
- **分布式系统**：CAP 理论、一致性算法
- **性能优化**：缓存架构设计

## 实用工具

- **redis-cli**：官方命令行客户端
- **RedisInsight**：官方 GUI 工具
- **Another Redis Desktop Manager**：开源桌面客户端
- **redis-benchmark**：性能测试工具
- **redis-rdb-tools**：RDB 文件分析

Redis 是高性能应用的基石。从简单的缓存到复杂的分布式系统，从数据结构到消息队列，Redis 都能胜任。别被它的简单外表欺骗，单线程模型背后藏着精妙的设计。先把五大数据结构玩透，再深入持久化和集群。多实践，多思考，Redis 会成为你性能优化的核心武器。
