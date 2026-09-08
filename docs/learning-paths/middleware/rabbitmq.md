# RabbitMQ 学习路线

RabbitMQ 是消息队列界的"瑞士军刀"，以 AMQP 协议为基础，凭借灵活的路由、可靠的消息传递和丰富的特性赢得了无数企业的青睐。它不像 Kafka 那样追求极致吞吐，而是在功能丰富性、易用性和可靠性之间取得了完美平衡。这条路线会带你从基本概念到高级特性，从单机部署到集群架构。

## 基础篇：核心概念与 AMQP 协议

> 📖 篇笔记：[RabbitMQ 概述](/study-notes/middleware/rabbitmq/overview) · [RabbitMQ 核心与 Java 整合](/study-notes/middleware/rabbitmq/java-integration) · [Go 操作 RabbitMQ](/study-notes/middleware/rabbitmq/rabbitmq-with-go) · [RabbitMQ 封装实践](/study-notes/middleware/rabbitmq/wrapper-practice)

### RabbitMQ 的角色与组件
- Producer：生产者，发送消息到交换机
- Exchange：交换机，接收消息并路由到队列
- Queue：队列，存储消息等待消费
- Consumer：消费者，从队列接收消息
- Binding：绑定，连接交换机和队列的路由规则
- Virtual Host（vhost）：虚拟主机，隔离不同应用的资源
- Connection：TCP 连接，客户端与 RabbitMQ 之间的网络连接
- Channel：信道，复用 Connection 的轻量级连接

### AMQP 协议基础
- AMQP 0-9-1 协议：RabbitMQ 实现的核心协议
- 消息模型：生产者 → 交换机 → 队列 → 消费者
- 协议帧：Method Frame、Content Header、Body Frame
- 连接与通道：一个连接多个通道，减少 TCP 开销
- 心跳机制：检测连接存活性

### 消息的组成
- Headers：消息头，包含路由键、优先级、时间戳等
- Properties：消息属性，content_type、delivery_mode、priority
- Payload：消息体，实际业务数据
- Routing Key：路由键，决定消息路由到哪个队列
- 消息持久化：durable 标记决定消息是否写入磁盘

## 交换机篇：路由的艺术

### Direct Exchange（直连交换机）
- 工作原理：完全匹配 Routing Key
- 使用场景：简单的点对点路由、日志分级处理
- 默认交换机：空字符串名称，自动绑定所有队列
- 性能特点：最快的路由方式

### Topic Exchange（主题交换机）
- 工作原理：通配符匹配 Routing Key
- 通配符规则：`*` 匹配一个单词，`#` 匹配零个或多个单词
- 使用场景：日志系统（info.log、error.#）、事件分发
- 路由灵活性：支持复杂的消息订阅模式

### Fanout Exchange（扇出交换机）
- 工作原理：忽略 Routing Key，广播到所有绑定的队列
- 使用场景：消息广播、实时通知、缓存更新
- 性能特点：最快的交换机类型（无需路由计算）

### Headers Exchange（头交换机）
- 工作原理：根据消息头属性匹配（而非 Routing Key）
- 匹配模式：all（全部匹配）、any（任一匹配）
- 使用场景：复杂的多属性路由
- 性能特点：最慢的交换机（很少使用）

### 自定义交换机
- Consistent Hash Exchange：一致性哈希路由
- Delayed Message Exchange：延迟消息插件
- Random Exchange：随机路由
- 自定义插件：实现自己的路由逻辑

## 队列篇：消息的容器

### 队列属性
- Durable：持久化，队列定义存入磁盘
- Exclusive：排他，仅声明连接可见，连接断开自动删除
- Auto-delete：自动删除，最后一个消费者断开后删除
- Arguments：额外参数，如消息 TTL、队列长度限制
- Name：队列名称，可由服务器自动生成

### 队列类型（从 3.8 开始）
- Classic Queue：经典队列，传统实现
- Quorum Queue：仲裁队列，基于 Raft 算法的高可用队列
- Stream Queue：流式队列，类似 Kafka 的消息日志
- 类型对比：可靠性、性能、持久化的权衡

### 队列参数与限制
- x-max-length：队列最大长度，超出后丢弃旧消息
- x-max-length-bytes：队列最大字节数
- x-message-ttl：消息 TTL，超时未消费自动删除
- x-expires：队列 TTL，空闲时间后自动删除
- x-overflow：溢出行为（drop-head、reject-publish、reject-publish-dlx）
- x-single-active-consumer：单活动消费者模式

### 死信队列（Dead Letter Exchange）
- 触发条件：消息被拒绝、消息 TTL 过期、队列长度超限
- DLX 配置：x-dead-letter-exchange、x-dead-letter-routing-key
- 使用场景：失败消息重试、消息审计、延迟队列实现
- 死信链：避免循环死信

### 优先级队列
- priority 参数：消息优先级（0-255，越大越优先）
- x-max-priority：队列最大优先级级别
- 性能影响：优先级队列比普通队列慢
- 使用场景：VIP 用户请求、紧急任务处理

## 消息确认篇：可靠性保证

### 生产者确认（Publisher Confirms）
- Confirm 模式：发送后等待 Broker 确认
- 单条确认：同步等待每条消息确认（最慢）
- 批量确认：批量等待多条消息确认
- 异步确认：通过回调处理确认（最快）
- Nack 处理：消息被拒绝的场景

### 消费者确认（Consumer Acknowledgements）
- Auto Ack：自动确认，消息发出即确认（可能丢消息）
- Manual Ack：手动确认，处理完成后确认
- Basic.Ack：单条确认，multiple=true 可批量确认
- Basic.Nack：拒绝消息，requeue=true 重新入队
- Basic.Reject：拒绝单条消息（Nack 的老版本）

### 事务机制
- tx.select、tx.commit、tx.rollback
- 性能影响：事务会严重降低性能（比 Confirm 慢 10 倍以上）
- 使用场景：需要原子性的多条消息发送
- 推荐替代方案：Publisher Confirms + 消费者手动确认

### 持久化
- Exchange 持久化：durable=true
- Queue 持久化：durable=true
- Message 持久化：delivery_mode=2（persistent）
- 三者配合：只有全部持久化才能保证消息不丢
- 性能代价：磁盘 IO 成本

### 消息丢失的场景
- 生产者未确认：网络故障、Broker 宕机
- Broker 未持久化：内存消息在宕机时丢失
- 消费者自动确认：处理前确认，处理失败消息丢失
- 网络分区：消息在网络分区期间的不确定性

## 高级特性篇

### 消息 TTL（Time To Live）
- 队列级别 TTL：x-message-ttl 参数
- 消息级别 TTL：expiration 属性
- 两者同时设置：取较小值
- TTL + DLX：实现延迟队列

### 延迟队列
- 插件方式：rabbitmq_delayed_message_exchange
- DLX 方式：TTL 队列 + 死信交换机
- 场景：订单超时取消、定时任务、延迟通知
- 精度：秒级延迟

### 消息路由追踪
- Firehose：追踪所有消息流动（性能影响大）
- rabbitmq_tracing 插件：Web UI 查看消息流
- 使用场景：调试、审计、问题排查

### Lazy Queue（惰性队列）
- 消息存储：尽快写入磁盘，内存只保留索引
- 使用场景：海量消息堆积、消费速度慢于生产
- 性能特点：降低内存压力，增加磁盘 IO
- 配置：x-queue-mode=lazy

### 消费者预取（Prefetch）
- basic.qos：设置预取数量
- Prefetch Count：消费者一次拉取的消息数
- 公平分发：prefetch=1 实现按能力分配
- 吞吐优化：增大 prefetch 提升性能
- 内存风险：过大 prefetch 导致消费者内存压力

### 消息拒绝与重试
- Nack + requeue：消息重新入队
- 重试次数控制：死信头中的 x-death 统计
- 重试策略：指数退避、最大重试次数
- 避免无限重试：设置最大重试后进入死信队列

## 集群篇：高可用架构

### 集群基础
- 集群组成：多个 RabbitMQ 节点互联
- 元数据共享：交换机、队列定义在所有节点复制
- 消息存储：默认只存储在声明节点（非镜像队列）
- Erlang Cookie：节点间认证的共享密钥
- 节点类型：磁盘节点（disk）、内存节点（ram）

### 镜像队列（Classic Queue HA）
- 镜像策略：all、exactly、nodes
- 主从复制：master-slave 模式
- 消息同步：同步到所有镜像节点
- 故障转移：master 宕机后选举新 master
- 性能代价：同步复制降低性能

### 仲裁队列（Quorum Queue）
- 基于 Raft 算法：强一致性保证
- Leader 选举：自动故障转移
- 消息复制：至少复制到多数节点
- 使用场景：高可靠性要求的消息
- 对比镜像队列：更可靠但功能受限（不支持优先级、TTL 等）

### 网络分区（Network Partition）
- 脑裂问题：集群分裂成多个独立集群
- 分区模式：pause-minority、pause-if-all-down、autoheal、ignore
- 检测机制：节点间心跳超时
- 恢复策略：选择合适的分区处理模式
- CAP 权衡：RabbitMQ 偏向 CP（一致性和分区容错）

### 联邦（Federation）
- 跨集群消息传递：Exchange Federation、Queue Federation
- 使用场景：跨数据中心、跨网络边界
- 上游下游：单向消息流动
- 与集群的区别：松耦合、异步复制

### Shovel 插件
- 消息搬运：从一个 Broker 搬到另一个
- 使用场景：数据迁移、跨版本复制、灾备
- 静态 Shovel：配置文件定义
- 动态 Shovel：运行时创建

## 运维篇：监控与管理

### Management UI
- Web 界面：HTTP API + 前端页面
- 功能：监控、管理、操作（15672 端口）
- 指标：连接数、通道数、队列深度、消息速率
- 操作：创建删除资源、发送接收消息测试

### 监控指标
- 队列指标：消息数、消费者数、消息速率
- 节点指标：内存、磁盘、文件描述符、Socket
- 连接指标：连接数、通道数、流量
- 告警：内存水位、磁盘空间、队列堆积
- 集成：Prometheus + Grafana

### 内存管理
- 内存告警：vm_memory_high_watermark（默认 0.4）
- 阻塞行为：达到水位后阻塞生产者连接
- 内存占用：消息、队列、连接、内部结构
- 分页：将消息换出到磁盘（page out）
- 内存泄漏：关注长连接和堆积队列

### 磁盘管理
- 磁盘告警：disk_free_limit
- 阻塞行为：磁盘不足时阻塞生产者
- 日志文件：定期轮转和清理
- 持久化消息：msg_store 目录
- IOPS：持久化消息的性能瓶颈

### 连接与通道管理
- 连接池：复用连接，降低开销
- 通道泄漏：未关闭的通道占用资源
- 心跳超时：heartbeat 参数调优
- 流控（Flow Control）：消费速度慢时的反压机制
- 最大连接数：ulimit 限制

### 升级与维护
- 滚动升级：逐个节点升级，保持集群可用
- 版本兼容性：Feature Flags 机制（从 3.8 开始）
- 数据备份：定义导出（definitions）、消息备份
- 配置管理：rabbitmq.conf、advanced.config
- 日志：日志级别、日志轮转

## 性能优化篇

### 生产者优化
- 批量发送：减少网络往返
- 异步 Confirm：提高吞吐
- 连接复用：使用连接池
- 持久化权衡：非关键消息可不持久化
- 消息大小：避免过大消息（建议 < 128KB）

### 消费者优化
- 增大 Prefetch：提高吞吐
- 多消费者：增加并发处理能力
- 手动确认：批量确认降低网络开销
- 消息反序列化：选择高效的序列化格式
- 连接复用：多个消费者共享连接

### 队列优化
- 惰性队列：大量消息堆积时减少内存压力
- 队列分片：将一个大队列拆分为多个小队列
- 避免长队列：及时处理消息，避免堆积
- 限流：限制生产速率，匹配消费能力

### 集群优化
- 队列分布：将队列分散在不同节点
- 镜像策略：根据可靠性需求选择镜像数量
- 网络带宽：集群间网络是性能瓶颈
- 负载均衡：客户端使用多节点连接

## 应用场景篇

### 异步任务处理
- 场景：邮件发送、图片处理、报表生成
- 模式：工作队列模式，多消费者并发处理
- 优势：削峰填谷、提高响应速度

### 应用解耦
- 场景：订单服务与库存、积分、物流服务解耦
- 模式：发布订阅模式，Fanout Exchange
- 优势：降低系统耦合度，易于扩展

### 消息通知
- 场景：站内信、推送通知、邮件提醒
- 模式：Topic Exchange，按用户类型路由
- 优势：灵活的消息订阅

### 日志收集
- 场景：应用日志、审计日志、监控数据
- 模式：Topic Exchange，按日志级别路由
- 优势：实时收集、分级处理

### RPC（远程过程调用）
- 场景：同步调用远程服务
- 模式：请求-响应队列，correlation_id 关联
- 局限性：不如直接 HTTP/gRPC 高效

## 下一步学习

掌握 RabbitMQ 后，你可以：
- **对比其他 MQ**：Kafka、RocketMQ、Pulsar，理解不同 MQ 的优势和场景
- **学习 AMQP 1.0**：了解新版协议的改进（虽然 RabbitMQ 主要用 0-9-1）
- **深入 Erlang**：理解 RabbitMQ 底层实现语言
- **探索消息模式**：Enterprise Integration Patterns
- **事件驱动架构**：Event Sourcing、Saga 模式
- **分布式事务**：基于消息的最终一致性方案

RabbitMQ 的强大在于其灵活性和可靠性，它不是最快的 MQ，但可能是最全能的。从简单的任务队列到复杂的企业集成，RabbitMQ 都能优雅胜任。Happy messaging！
