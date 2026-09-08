# RocketMQ 学习路线

RocketMQ 是阿里巴巴开源的分布式消息中间件，诞生于双十一的淬炼，专为高并发、低延迟、高可靠而生。它吸收了 Kafka 的高吞吐思想，又融入了 RabbitMQ 的丰富特性，还加入了分布式事务、顺序消息、延时消息等企业级功能。这条路线会带你从基础架构到高级特性，从使用到原理深入。

## 基础篇：架构与核心概念

> 📖 笔记：[RocketMQ](/study-notes/middleware/rocketmq/rocketmq)

### RocketMQ 的架构组件
- NameServer：轻量级注册中心，管理 Broker 路由信息
- Broker：消息存储和转发核心，分为 Master 和 Slave
- Producer：生产者，发送消息到 Broker
- Consumer：消费者，从 Broker 拉取或推送消息
- Topic：消息主题，逻辑上的消息分类
- Message Queue：消息队列，Topic 的物理分区
- Producer Group：生产者组，用于事务消息回查
- Consumer Group：消费者组，实现负载均衡和故障转移

### RocketMQ vs Kafka
- 架构对比：RocketMQ 有独立的 NameServer，Kafka 依赖 ZooKeeper/KRaft
- 消息模型：RocketMQ 支持更多消息类型（事务、延时、顺序）
- 消费模式：RocketMQ 支持推和拉，Kafka 只支持拉
- 存储结构：RocketMQ 的 CommitLog 统一存储，Kafka 按 Topic 分文件
- 适用场景：RocketMQ 更适合复杂业务场景，Kafka 更适合大数据流处理

### NameServer 的角色
- 路由注册：Broker 启动时向所有 NameServer 注册
- 路由发现：Producer/Consumer 从 NameServer 获取路由信息
- 心跳机制：Broker 定期发送心跳（30 秒）
- 路由剔除：120 秒未收到心跳，剔除 Broker
- 无状态设计：各 NameServer 节点独立，无需同步
- 最终一致性：路由信息最终一致，允许短暂不一致

### Broker 的存储结构
- CommitLog：所有消息顺序写入的统一日志文件（1GB 一个文件）
- ConsumeQueue：消息消费队列的逻辑视图（索引文件）
- IndexFile：消息索引文件，支持按 Key 和时间查询
- 顺序写入：CommitLog 采用追加写，性能极高
- 随机读取：ConsumeQueue 通过偏移量快速定位消息

### 消息的生命周期
- 生产：Producer 选择 MessageQueue，发送到 Broker
- 存储：写入 CommitLog，异步构建 ConsumeQueue
- 消费：Consumer 从 ConsumeQueue 读索引，再从 CommitLog 读消息
- 清理：过期消息（默认 72 小时）被定时清理

## 消息类型篇：丰富的消息语义

### 普通消息
- 同步发送：等待 Broker 返回结果（最可靠）
- 异步发送：通过回调处理结果（高吞吐）
- 单向发送：只发不管结果（最快，可能丢失）
- 使用场景：根据可靠性需求选择发送方式

### 顺序消息
- 全局顺序：整个 Topic 只有一个队列（吞吐低）
- 分区顺序：相同 Key 的消息路由到同一队列
- 实现原理：同一队列消息严格 FIFO，同一队列只能被一个消费者线程消费
- 顺序保证：生产顺序、存储顺序、消费顺序三重保证
- 重试影响：顺序消息失败后会阻塞队列（直到成功或跳过）
- 使用场景：订单状态变更、数据库 binlog 同步

### 延时消息
- 延时级别：18 个固定延时级别（1s 到 2h）
- 实现原理：消息先发送到延时队列，到期后投递到目标队列
- 定时任务：ScheduleMessageService 扫描延时队列
- 不支持任意延时：只能选择预设的延时级别
- 使用场景：订单超时取消、定时提醒、限流缓冲

### 事务消息
- 半消息（Half Message）：未确认的事务消息，对消费者不可见
- 事务状态：Commit（提交）、Rollback（回滚）、Unknown（未知）
- 事务流程：发送半消息 → 执行本地事务 → 提交/回滚
- 事务回查：本地事务状态未知时，Broker 主动回查 Producer
- 回查机制：最多回查 15 次，超时后丢弃消息
- 使用场景：分布式事务最终一致性（订单 + 积分，支付 + 发货）

### 批量消息
- 批量发送：一次发送多条消息（减少网络往返）
- 限制：同一批消息必须是同一 Topic、不能是延时消息、总大小 < 4MB
- 性能提升：减少网络 IO，提高吞吐
- 原子性：批量消息要么全部成功，要么全部失败

### 过滤消息
- Tag 过滤：消息标签，Broker 端简单过滤
- SQL92 过滤：SQL 表达式过滤（需开启 enablePropertyFilter）
- 类过滤：自定义 FilterServer（已不推荐）
- 过滤位置：Tag 在 Broker 过滤，SQL 和类在 Consumer 过滤
- 使用场景：同一 Topic 不同业务类型的消息分类

## 生产者篇：发送的艺术

### 消息发送流程
- 路由查询：从 NameServer 获取 Topic 的路由信息
- 队列选择：根据策略选择 MessageQueue
- Broker 定位：根据 MessageQueue 找到对应的 Broker
- 消息发送：序列化消息，通过 Netty 发送
- 结果处理：同步等待、异步回调或单向发送

### 队列选择策略
- 轮询策略：默认策略，依次选择队列
- 最小延迟策略：选择响应最快的 Broker
- 随机策略：随机选择队列
- 故障规避：发送失败后避开故障 Broker
- 自定义策略：实现 MessageQueueSelector 接口

### 消息重试
- 同步重试：发送失败时自动重试（默认 2 次）
- 超时控制：sendMsgTimeout（默认 3 秒）
- 重试策略：换一个 Broker 重试（避免故障 Broker）
- 重复问题：重试可能导致消息重复（需要消费者幂等）

### 消息 Key 与 Tag
- Key：消息索引键，用于消息追踪和查询
- Tag：消息标签，用于消息过滤
- 设计建议：Key 设置为业务唯一标识（订单号、用户 ID）
- 多 Tag：一条消息只能有一个 Tag，但可通过 || 分隔多个

### 生产者最佳实践
- 合理设置超时：根据网络和业务情况调整
- 避免大消息：单条消息建议 < 4MB
- 批量发送：适合日志、监控等高吞吐场景
- 异常处理：区分可重试异常和不可重试异常
- 连接管理：Producer 是线程安全的，可复用

## 消费者篇：消费的策略

### 消费模式
- 集群模式（Clustering）：同一消费者组内的消费者分摊消息
- 广播模式（Broadcasting）：每个消费者都收到全部消息
- 使用场景：集群模式用于负载均衡，广播模式用于缓存更新

### Push vs Pull
- Push（推）：DefaultMQPushConsumer，Broker 主动推送（实际是长轮询）
- Pull（拉）：DefaultLitePullConsumer，消费者主动拉取
- 推荐：Push 模式更简单易用，适合大多数场景
- Pull 优势：更灵活控制消费速度和批量大小

### 消息消费流程
- Rebalance：分配 MessageQueue 到消费者
- 消息拉取：从 Broker 拉取消息（Pull）
- 消费线程池：并发消费消息
- 消费进度：消费完成后提交 Offset
- 重试与死信：消费失败后的重试机制

### 负载均衡（Rebalance）
- 触发时机：消费者加入/离开、Topic 队列数变化
- 分配策略：平均分配、环形分配、一致性哈希、按机房分配
- Rebalance 问题：重复消费、消费暂停
- 优化：减少不必要的 Rebalance

### 消息消费模式
- 并发消费（Concurrently）：多线程并发消费，无顺序保证
- 顺序消费（Orderly）：单线程消费同一队列，保证顺序
- 线程池大小：consumeThreadMin、consumeThreadMax
- 消费批量：consumeMessageBatchMaxSize

### 消息重试与死信
- 重试次数：默认最多重试 16 次
- 重试间隔：递增延迟（10s、30s、1m、2m...最长 2h）
- 死信队列：重试次数耗尽后进入死信 Topic（%DLQ%ConsumerGroup）
- 死信处理：人工介入或监控告警
- 跳过重试：返回 CONSUME_SUCCESS 表示消费成功

### 消费进度管理
- 本地模式：广播模式下，进度存储在本地文件
- 远程模式：集群模式下，进度存储在 Broker
- 进度提交：定期提交（默认 5 秒）
- 重置进度：指定时间戳或 Offset 重新消费

### 消费者最佳实践
- 幂等性：消费逻辑要支持重复消费
- 消费耗时：避免长时间阻塞消费线程
- 批量消费：提高吞吐，注意内存控制
- 异常处理：返回正确的消费状态
- 监控 Lag：关注消费延迟

## 高可用篇：主从与 Dledger

### 主从复制
- Master-Slave 架构：一主多从
- 同步复制：消息同步到 Slave 后才返回成功（可靠）
- 异步复制：消息写入 Master 后立即返回（快速）
- 复制延迟：Slave 与 Master 的数据差距
- 读写分离：Consumer 可从 Slave 读取消息

### 主从切换
- 手动切换：修改配置文件，重启服务
- 自动切换：需要额外组件（如 Dledger）
- 传统主从问题：Master 宕机后无法自动切换

### Dledger 模式
- 基于 Raft 协议：实现自动主从切换
- 集群配置：至少 3 个节点（推荐奇数）
- Leader 选举：自动选举 Leader 处理读写
- 强一致性：消息复制到多数节点才返回成功
- 性能影响：同步复制影响延迟

### 故障转移
- Producer 故障转移：自动避开故障 Broker
- Consumer 故障转移：Rebalance 重新分配队列
- Broker 故障恢复：从 Slave 提升为 Master（Dledger）

## 性能优化篇

### 生产者优化
- 批量发送：减少网络往返
- 异步发送：提高吞吐，但要处理回调
- 压缩：开启消息压缩（通常不推荐，CPU 换网络）
- 增大发送队列：defaultAsyncSenderExecutor
- 复用 Producer：避免频繁创建

### 消费者优化
- 增大消费线程池：consumeThreadMax
- 批量消费：consumeMessageBatchMaxSize
- 减少 Rebalance：合理设置超时参数
- 异步处理：消费线程快速返回，异步处理业务
- 顺序消息优化：避免消费失败导致阻塞

### Broker 优化
- 操作系统：文件系统（ext4/XFS）、页缓存
- JVM 调优：堆内存、GC 策略（G1GC）
- 磁盘：SSD 提升性能，磁盘阵列增加吞吐
- 刷盘策略：异步刷盘（快）vs 同步刷盘（可靠）
- PageCache：利用操作系统页缓存加速读写
- mmap：内存映射文件，零拷贝技术

### 存储优化
- CommitLog 大小：默认 1GB，可调整
- ConsumeQueue 大小：默认 30 万条记录
- 消息保留：fileReservedTime（默认 72 小时）
- 磁盘清理：定时删除过期文件
- 预分配文件：AllocateMappedFileService

## 运维篇：监控与管理

### RocketMQ Console
- Web 管理界面：监控和管理 RocketMQ
- 功能：集群状态、Topic 管理、消息查询、消费者监控
- 安装：独立部署的 Spring Boot 应用

### 监控指标
- Broker 指标：TPS、消息堆积量、磁盘使用率
- Topic 指标：生产速率、消费速率、消息延迟
- 消费者组指标：消费 Lag、消费 TPS、Rebalance 次数
- 系统指标：CPU、内存、磁盘 IO、网络流量

### 消息追踪
- 消息轨迹：消息从生产到消费的完整链路
- TraceId：消息唯一标识（通过 Key 实现）
- 查询方式：Console 查询、API 查询
- 存储：消息轨迹存储在专门的 Trace Topic

### 问题排查
- 消息丢失：检查刷盘策略、同步复制配置、消费 ACK
- 消息重复：检查生产者重试、消费者 Rebalance、网络抖动
- 消息堆积：检查消费者状态、消费耗时、消费线程数
- 消费延迟：检查 Lag、消费 TPS、Broker 负载
- 顺序错乱：检查是否多线程消费、是否有 Rebalance

### 容量规划
- Topic 数量：建议每个 Broker < 1000 个 Topic
- 队列数量：每个 Topic 建议 4-8 个队列
- 消息大小：单条消息 < 4MB
- 磁盘容量：根据保留时间和消息量计算
- Broker 数量：根据吞吐量和可靠性需求

### 升级与迁移
- 版本升级：关注兼容性，建议先升级 Broker 再升级客户端
- 数据迁移：老集群到新集群的消息同步
- 灰度发布：逐步切换流量到新集群
- 回滚方案：保留老集群作为备份

## 高级特性篇

### 消息轨迹
- 开启方式：客户端配置 enableMsgTrace=true
- 轨迹内容：发送时间、Broker 地址、消费时间、消费结果
- 存储位置：专门的 Trace Topic（RMQ_SYS_TRACE_TOPIC）
- 查询方式：通过 Console 或 API 查询

### 消息过滤
- Broker 端过滤：Tag 过滤，减少网络传输
- Consumer 端过滤：SQL92 表达式，更灵活
- 表达式示例：`(TAGS is not null and TAGS in ('TagA', 'TagB')) and (a is not null and a between 0 and 3)`
- 性能影响：SQL 过滤增加 Consumer 端 CPU 消耗

### 请求-响应模式（RR）
- 同步 RPC：request-reply 模式
- 实现方式：correlationId 关联请求和响应
- 使用场景：需要同步返回结果的场景
- 局限性：不如直接 HTTP/gRPC 调用高效

### 消息查询
- 按 Key 查询：通过 IndexFile 快速定位
- 按 MessageId 查询：精确查找单条消息
- 按时间查询：范围查询某个时间段的消息
- 查询限制：只能查询未过期的消息

## 应用场景篇

### 削峰填谷
- 场景：电商秒杀、12306 抢票
- 方案：请求写入 MQ，异步处理
- 优势：保护后端服务，提升用户体验

### 异步解耦
- 场景：订单服务与库存、积分、物流解耦
- 方案：订单创建后发送 MQ，各服务异步处理
- 优势：降低耦合，提高可扩展性

### 分布式事务
- 场景：订单支付 + 积分增加
- 方案：事务消息 + 本地事务表
- 优势：保证最终一致性

### 顺序消息
- 场景：数据库 binlog 同步、订单状态流转
- 方案：按业务 Key 路由到同一队列
- 优势：保证消息顺序

### 定时任务
- 场景：订单超时取消、会员到期提醒
- 方案：延时消息
- 局限性：只支持固定延时级别

## 下一步学习

掌握 RocketMQ 后，你可以：
- **对比其他 MQ**：深入对比 Kafka、Pulsar，理解不同场景的技术选型
- **学习分布式事务**：Seata、TCC、Saga 等分布式事务方案
- **研究 Raft 协议**：理解 Dledger 的强一致性实现
- **源码阅读**：深入 RocketMQ 源码，理解底层实现
- **实践 DDD**：事件驱动架构与领域驱动设计
- **云原生消息**：Pulsar、NATS 等新一代消息系统

RocketMQ 是阿里巴巴电商场景淬炼出的消息中间件，它的设计处处体现了工程师对业务场景的深刻理解。从简单的异步解耦到复杂的分布式事务，RocketMQ 都能优雅应对。Happy messaging！
