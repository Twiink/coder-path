# RocketMQ 学习路线

RocketMQ 是阿里巴巴开源、经**双十一淬炼**的分布式消息中间件:它吸收 Kafka 的高吞吐设计,又内建 RabbitMQ 级别的业务能力,还加上**事务消息、顺序消息、延时消息**这些企业级语义——是国内 Java 技术栈(尤其电商/金融类业务)最常选的消息中间件。定位一句话:**Kafka 管大数据流,业务消息里的"重型武器"是 RocketMQ**。实践:`docker run -d --name rmqnamesrv apache/rocketmq` 起 NameServer + Broker(官方文档有单机教程)或用云厂商托管版。

这条线按 **架构与存储 → 消息类型(顺序/延时/事务)→ 生产者 → 消费者与死信 → 高可用(Dledger)→ 原理与性能 → 运维与监控 → 场景与选型** 推进。

## 第一站:架构与核心概念

**组件四件套**:①**NameServer(轻量注册中心)**:Broker 启动向所有 NameServer 注册;**Broker 每 30 秒心跳,120 秒无心跳被剔除**;Producer/Consumer 启动时从 NameServer 拉 Topic 路由并**本地缓存**(30 秒刷新);NameServer **节点间无状态、不同步**(不像 ZK/etcd 做强一致选主)——**路由信息最终一致即可,这是 RocketMQ"去中心化协调"的设计取舍**;②**Broker(存储与转发核心)**:Master/Slave 分主从;③Producer/Consumer;④**Topic(逻辑分类)与 MessageQueue(物理队列,类似 Kafka 分区)**:一个 Topic 多个队列(默认读写队列 4-8),队列是并行与顺序的最小单元;Producer Group(事务回查用)/Consumer Group(负载均衡单元)。
**存储三件套(与 Kafka 的关键差异)**:①**CommitLog:所有 Topic 的消息共用一个顺序追加的日志文件**(1GB 滚动)——**写模型极致简单(单文件顺序写)**;②**ConsumeQueue:每个 MessageQueue 一个逻辑索引文件**(记录消息在 CommitLog 的偏移/大小/tag hash——消费者先读它"定位");③**IndexFile:按 Key 与时间的索引**(Console 按消息 Key 秒查)。
**读写链路**:写消息 → 顺序写 CommitLog → **异步**构建 ConsumeQueue;消费 → 读 ConsumeQueue 拿偏移 → 从 CommitLog 取消息体;**消息保留**:默认 72 小时(fileReservedTime)定时清理(凌晨 4 点删除过期文件)。**RocketMQ vs Kafka vs RabbitMQ 定位**(选型常考):RocketMQ=Java 业务生态 + 事务/顺序/延时内建 + 推拉都支持;Kafka=日志流与吞吐之王;RabbitMQ=功能全的轻量业务 MQ——吞吐量级 RocketMQ/Kafka(十万~百万级)≫ RabbitMQ。

## 第二站:消息类型——RocketMQ 的招牌

**普通消息三种发送**(可靠性递减/性能递增):**同步发送(等 broker 返回结果——最可靠,核心业务用)**、异步发送(回调处理结果——吞吐场景)、单向发送(发完即走,可能丢——日志/监控类);生产选型:重要业务同步,量大业务异步。

**顺序消息(业务强顺序的标准答案)**:全局顺序(整个 Topic 单队列——吞吐牺牲)与**分区顺序(常用):按业务 key 用 MessageQueueSelector 把"同一订单/同一用户"的消息选进同一队列**——同一队列内严格 FIFO;消费端配 `MessageListenerOrderly`(**同一队列单线程消费**——顺序的"消费端保证");**代价**:某条消息处理失败会**阻塞该队列**(挂起重试,直到成功或超时跳过)——顺序消费吞吐低;**场景**:订单状态流转、binlog 同步、支付回调;**注意**:Rebalance 期间顺序消费会有短暂的重复与停顿(幂等仍要)。

**延时消息(内建,免插件)**:支持 **18 个固定延时级别(1s/5s/10s/30s/1m/2m/3m…10m/20m/30m/1h/2h)**——**只能选预设级别**(要任意精度用定时任务或 RocketMQ 5.x 的定时消息);原理:消息先投递到内部延时 Topic(SCHEDULE_TOPIC_XXXX)按级别分队列,定时线程到期后转投目标 Topic;**场景**:订单 30 分钟未支付取消、定时通知——**对比 RabbitMQ(插件做任意延迟)与 Kafka(无内建)**,这是 RocketMQ 业务向的加分项。

**事务消息(分布式事务最终一致性的标杆实现)**:**流程**:①发送"半消息(half message)"(broker 存储但**对消费者不可见**)→ ②执行本地事务(订单落库)→ ③返回 commit/rollback:commit 后消息才对消费者可见,rollback 则删除;**状态未知(超时/宕机)时 Broker 主动"回查" Producer**(checkLocalTransaction:查本地事务表判断成败)——**最多回查 15 次**;这套"本地事务 + 半消息 + 回查"解决了"先发消息后本地失败"与"先本地后发消息失败"的原子性难题;**经典场景**:下单发积分/支付成功通知物流——**最终一致,下游仍要幂等**;对比 Seata 的 AT/TCC(见 [微服务](/learning-paths/microservices/microservices-patterns)),事务消息是"消息侧"的解法。

**其他**:批量消息(同 Topic、非延时、总大小 ≤4MB——减少网络往返);**Tag 过滤**(消息标签:订阅时按 tag 收——`consumer.subscribe("TopicA", "TagA || TagB")`,**broker 端过滤省流量**;规范:tag 表达业务事件类型,别当消息内容);SQL92 属性过滤(按自定义属性表达式过滤——consumer 端计算,灵活但费 CPU;Tag 是 SQL 过滤的特例优化);Key(每条消息的业务唯一键(订单号)——**消息查询/轨迹追踪的抓手,必设**)。

## 第三站:生产者实践

**发送流程**:Producer 启动从 NameServer 拉 Topic 路由(缓存,30s 刷新;找不到报"topic 不存在"先检查自动创建开关)→ 按策略选 MessageQueue(默认**轮询**均衡;需要顺序用 MessageQueueSelector;可配故障延迟规避(发送失败自动避开该 broker))→ Netty 发 Broker → 按发送方式处理结果。**参数**:sendMsgTimeout(默认 3s)、**发送重试(默认 2 次,自动换 broker——重试 = 可能重复投递,消费端幂等兜底)**、压缩(>4KB 默认压缩,CPU 换带宽);**最佳实践**:Producer 线程安全可复用(别每消息 new)、区分可重试异常与不可重试(消息过大/格式错别重试)、消息体 <4MB(再大走对象存储传引用)、key 用业务唯一 ID。

## 第四站:消费者

**两种模式**:集群模式(默认:**同一消费组内分摊队列**(一个队列同一时刻组内一个消费者)——点对点负载均衡)与广播模式(组内每个消费者收全量——缓存更新/本地配置)。**Push vs Pull**:DefaultMQPushConsumer(名"推"实为**长轮询**:向 broker 拉,有消息立即返回、无消息挂起等待(默认挂 15s)——**体验像推、实现是拉**,多数场景用它,最简单);DefaultLitePullConsumer(手动拉取:完全控制拉取频率与批量——特殊控速场景)。
**两种消费监听(重要)**:`MessageListenerConcurrently`(**并发消费**:线程池(默认 20)多线程处理,返回 CONSUME_SUCCESS 或 RECONSUME_LATER(失败稍后重试)——吞吐优先、**无顺序**);`MessageListenerOrderly`(**顺序消费**:同一队列提交给同一消费线程串行处理,失败会**阻塞重试**——配顺序消息用)。
**消费进度**:集群模式存 Broker(远程,默认 5 秒上报),广播模式存本地文件;**重置消费位点**(Console 或 API 按时间戳回溯——**"重放最近 2 小时消息"排障神器**,对应 Kafka 的 seek);Rebalance(消费者增减/队列变化时重新分配——触发重复消费与短停,参数调优减少不必要再平衡)。
**重试与死信(业务消息的保命机制)**:消费失败(RECONSUME_LATER)自动重试,**默认 16 次,间隔按 10s/30s/1m/2m…2h 阶梯递增**;16 次耗尽消息进入**死信队列 `%DLQ%消费组名`**(独立 Topic)——**监控死信队列 + 人工/脚本介入处理**(转人工修复/重发);**幂等设计是消费者第一原则**(RocketMQ 与所有 MQ 一样不保证不重:发送重试/rebalance/消费超时都可能重投——消费前按业务键去重)。
**Lag 监控**(消费积压):Console 看消费组 lag/TPS——积压了先查消费者健康(挂了?处理慢?)再考虑扩容(加消费者(≤队列数)或加队列(注意 topic 队列扩容)或读 slave)。

## 第五站:高可用——主从与 Dledger

**传统主从**:Master 写、Slave 备份;**同步复制**(消息写 master 并同步到 slave 成功才返回——可靠、慢)vs **异步复制**(写 master 即返回——快,主挂可能丢少量未同步消息);消费可配从 slave 读(**主从读写分离**,缓解主压力);**主从切换是手动的**(运维改配置)——老架构的痛点。**Dledger 模式(4.5+,生产推荐)**:基于 **Raft** 的自动选主——**≥3 个节点(奇数)组成 Raft 组,消息写入多数节点才算成功(强一致),leader 宕机自动选举**(不再手动切换);与传统主从的取舍:自动故障转移 vs 同步复制延迟;5.x 起存储与高可用持续演进(Controller 模式)。**故障转移全景**:Producer(自动避开故障 broker 重试)、Consumer(Rebalance 把队列分给活着的消费者)、Broker 层(Dledger 自动选主)。

## 第六站:原理与性能——存储引擎的功夫

**高性能三板斧(面试常问,与 Kafka 同源思想)**:①**顺序写**:所有消息追加写同一个 CommitLog(**对比 Kafka 按分区写多个文件——RocketMQ 的写放大更小**),磁盘顺序写接近内存速度;②**页缓存 + mmap**:CommitLog 用内存映射(mapped file)读写走操作系统页缓存——读写都在 OS 层完成,Java 堆不存消息;③**零拷贝**:消费端 sendfile 减少拷贝次数。
**刷盘策略(可靠性与性能的旋钮)**:异步刷盘(默认:写页缓存即返回——快,OS 崩溃丢秒级数据)vs 同步刷盘(强制落盘才返回——稳,吞吐下降;金融场景用);**ConsumeQueue 异步构建**(写路径不阻塞);预分配文件(AllocateMappedFileService 提前建好文件,消抖动);**Broker 调优**:堆(4-8G,消息不占堆)、G1GC、文件系统 XFS、SSD;**性能建议**:批量/异步发送、消费线程池调大、批量消费(consumeMessageBatchMaxSize)、避免大消息与超长消费阻塞、堆积时优先扩容消费能力。

## 第七站:运维与监控

**RocketMQ Console(官方 Web 控制台,部署为 Spring Boot 应用)**:集群/主题/消费组管理、**消息查询(按 Topic+Key/MessageId/时间——查一条消息从生产到消费的轨迹,排障第一工具)**、消费进度与 lag 可视化、发送测试消息。**监控指标**:Broker(TPS/堆积总量/磁盘)、Topic(生产/消费速率)、消费组(lag、消费 TPS、rebalance 次数)、系统(CPU/内存/IO);接 Prometheus(rocketmq-exporter)+ Grafana。
**消息轨迹(Trace)**:客户端开启 enableMsgTrace=true——生产/存储/消费各环节时间与结果写入轨迹 Topic,**Console 里看一条消息的完整旅程**(谁发的、何时到、谁消费了、成功没)——分布式排障体验的标杆功能。**容量规划与规范**:单 Broker Topic 别过千、单 Topic 队列 4-8 个(先想清并发与顺序)、消息 <4MB、保留时间与磁盘预算(写速率 × 保留时长)、集群 ≥2 主 2 从或 3 节点 Dledger;升级先 broker 后客户端。

## 第八站:场景与选型

**五大场景**:①**削峰填谷**(秒杀/抢票:请求先写 MQ 异步消化——配"防重幂等 + 库存扣减在消费端"闭环);②**异步解耦**(订单创建发事件:库存/积分/物流各自订阅——新下游不改上游);③**分布式事务**(事务消息:下单 + 发券/积分,本地事务与消息原子);④**顺序消费**(订单状态机/binlog);⑤**延时任务**(超时关单:延时消息 18 级内建,比自建轮询优雅)。**选型总结(面试答题框架)**:Java 团队 + 业务消息(要事务/顺序/延时、要高吞吐又要管理台)——**RocketMQ**;纯大数据/日志流(百万级、回放、生态 Connect/Flink)——Kafka;轻量业务(路由灵活/死信管理/团队不大)——RabbitMQ;**RocketMQ 5.x 方向**:gRPC 协议、云原生(多语言 SDK 更友好)、Controller 模式——新项目看 5.x。

## 通关标准

能独立做到:讲清 NameServer 路由发现与存储三件套(CommitLog/ConsumeQueue/IndexFile)及"为什么比 Kafka 写放大更小";把顺序消息(selector+Orderly)、延时消息(18 级)、事务消息(半消息+回查)完整实现一遍并解释各自坑;配出"消费重试 16 次 + 死信队列"的失败闭环并说明幂等设计;理解同步/异步复制与 Dledger(Raft)的取舍;会用 Console 按 key 查消息轨迹并定位"消息到底丢没丢/谁没消费";能对比 RocketMQ/Kafka/RabbitMQ 给出选型理由——RocketMQ 主线通关。

RocketMQ 的设计处处是"业务工程师的务实":单文件顺序写保证吞吐,事务消息解决真实分布式难题,轨迹查询让排障有据可查——它是把 Kafka 的速度与 RabbitMQ 的贴心结合得最好的那个。学它的最佳方式是与 Kafka 对照(存储/消费模型)再与 RabbitMQ 对照(功能语义),三张图拼齐,消息中间件的选型与排障就都难不倒你了。下一步:服务协调的另一个方向 [ZooKeeper](/learning-paths/middleware/zookeeper),或事务消息的兄弟方案 [Seata](/learning-paths/microservices/spring-cloud)。
