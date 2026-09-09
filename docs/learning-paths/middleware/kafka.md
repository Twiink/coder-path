# Kafka 学习路线

Kafka 不只是消息队列,更是**分布式流处理平台**:高吞吐(百万级消息/秒)、持久化、可回放、天然分布式容错——它是数据管道与大数据生态的基石(日志收集、埋点、削峰解耦、流计算、事件溯源都靠它),也是后端与大数据面试的"杀手锏"。它诞生于 LinkedIn,现在由 Apache 基金会维护。**与 RabbitMQ 的本质区别**:RabbitMQ 是"功能全的业务消息中间件"(消息消费即消失);Kafka 是"日志型数据管道"(**消息按时间保留、可反复重读**——这个差异决定选型)。实践:Docker 起 `bitnami/kafka`(KRaft 单节点)即可练。

这条线按 **核心概念 → 存储原理(为什么快)→ 副本与可靠性 → 生产者 → 消费者 → 事务与精确一次 → 集群与运维 → 生态(Connect/Streams/Schema)→ 场景与选型** 推进。

## 第一站:核心概念与架构

**角色全景**:Producer(发消息)/Consumer(拉消息)/**Broker(存储与服务的服务器节点,集群由多个 broker 组成)**/Topic(主题:消息的逻辑分类)/**Partition(分区:Topic 的物理分片,并行与扩展的单元)**/Replica(副本:分区的冗余)/Consumer Group(消费者组)/Offset(位移:分区内消息的位置)。**Topic 与 Partition 的真相**:①分区是**并行单元**——一个 Topic 分 N 个区,N 个消费者就能并行消费,吞吐随之扩展;②**分区内严格有序,跨分区不保证顺序**——要全局顺序只能单分区(牺牲并行);③同 key 的消息进同一分区(按 key hash)→ **同 key 保序**(同用户的事件流);④**一个分区同一时刻只能被同一消费组内的一个消费者消费**(再多消费者也白搭——消费者数超过分区数必有空闲);⑤消息保留策略(retention):按时间(默认 7 天)或大小清理——**消费完不删除,过期才删**(所以能回放)。**元数据管理演进**:老架构依赖 **ZooKeeper**(存 broker/主题元数据、选 Controller);**KRaft(2.8+ 引入,3.3+ 生产可用)**:Kafka 自管理元数据(内部 Raft 协议),去 ZK——**新集群直接用 KRaft,部署运维简单一大截**;理解 Controller(集群大脑:分区 leader 选举与元数据变更,Controller Epoch 防脑裂)。

## 第二站:存储原理——Kafka 为什么快(面试必考三连)

①**顺序写磁盘**:消息**追加**到分区日志文件(Log Segment),磁盘顺序写接近内存速度——对比随机写,这是"Kafka 用磁盘却比用内存的 MQ 快"的答案;②**页缓存(Page Cache)**:读写都走操作系统页缓存(消息先写页缓存,刷盘策略可控)——**Kafka 不用 JVM 堆存消息**(堆只放必要对象),重启后热数据仍在 OS 缓存,冷启动不吃亏;③**零拷贝(sendfile)**:消费时数据从页缓存直接经网卡发送,**不经过用户态拷贝**(传统要内核→用户→内核四次拷贝,零拷贝两次)——大数据量消费的吞吐关键。**配套细节**:日志按 segment 分段滚动(log.segment.bytes,默认 1GB),每段配**稀疏索引**(定位消息二分查)、时间索引;消息不可变、offset 顺序递增;分区日志的"追加 + 索引 + 清理"是纯顺序 IO 设计。**所以**:Kafka 的快不是魔法,是"顺序 IO + 页缓存 + 零拷贝 + 批量"四项工程设计的叠加。

## 第三站:副本机制与可靠性

**副本模型**:每个分区多副本(production 建议 replication.factor=3):**Leader 副本**(处理该分区所有读写)与 **Follower 副本**(只从 leader 拉数据同步,不对外服务——读写都在 leader,这点与 Redis/MySQL 主从的"从库可读"不同);**ISR(In-Sync Replicas,与 leader 保持同步的副本集合)**:follower 落后超过 replica.lag.time.max.ms(默认 30 秒)被踢出 ISR;**HW(High Watermark)与 LEO(Log End Offset)**:LEO 是各副本日志末端,HW 是 ISR 都确认过的"已提交"位置——**消费者只能读到 HW 之前**(HW 之后的数据副本还没齐,leader 挂了可能丢);**Leader Epoch**(版本号机制):解决"旧 leader 复活后带着过期数据截断新 leader 日志"的经典数据不一致问题。**acks 与数据安全(面试必背)**:producer 的 acks=0(发完不管,可能丢)/**acks=1(leader 写入即确认——默认;leader 挂了未同步数据丢)**/**acks=all(-1:等 ISR 全部确认才返回——最安全但慢)**;**acks=all 必须配 min.insync.replicas=2 才有意义**(ISR 少于 2 直接拒绝写入,宁可不写也不写丢);**unclean.leader.election.enable(默认 false)**:leader 挂了且 ISR 全挂时,是否允许"不同步的副本"顶上——允许=可用性优先(可能丢已确认数据),禁止=一致性优先(分区不可用等 ISR 恢复)——**生产建议 false**;丢消息排查三件套:acks、min.insync.replicas、unclean 选举。

## 第四站:生产者(Producer)

**发送流程**:序列化(key/value)→ 分区器 → 攒批 → 压缩 → 发 broker → 回调。**分区策略**:指定分区 / 指定 key(同 key 同分区保序)/ 无 key(默认**粘性分区 Sticky**:一批写满再换区——吞吐优先,新版随机意义不大)/ 自定义分区器。**批量与压缩(吞吐的旋钮)**:batch.size(批次字节)与 **linger.ms(攒多久再发)**——**要吞吐调大,要延迟调小**(默认 linger 0,有货就发;Kafka 靠批量攒出吞吐);压缩:gzip/snappy/lz4/zstd——**推荐 lz4(均衡)或 zstd(极致压缩比,费 CPU)**,压缩在发送端做、broker 存压缩态、消费端解——网络与磁盘省一大截。**可靠性**:retries 重试(网络抖动/leader 选举中的可重试错误自动重发;**消息可能重复送达**——下游消费要幂等);**幂等生产者 enable.idempotence=true(生产必开)**:PID + 序列号去重,**单分区内严格不重不乱**——开启后乱序风险(重试导致)也消失;max.in.flight.requests(未确认的在途请求,幂等下可 >1);delivery.timeout.ms 总超时。**回调**:异步发送(不阻塞主线程),回调里处理失败(记日志/进死信——**别静默丢**)。**顺序保证组合**:单分区 + 同 key + 幂等 + 串行发送。

## 第五站:消费者(Consumer)

**拉模型(Pull)**:消费者主动拉取(对比 push——**消费速度自己控制,不会把消费者压垮**,这是 Kafka 的设计选择);**消费者组(Consumer Group)**:组内分区分配(点对点:一条消息组内只一个消费者处理)、跨组独立(广播:两个组都收全量)——**一个组 = 一个"逻辑消费者"**;**Rebalance(再平衡,面试重点)**:消费者加入/离开/订阅变化时,分区在组内重新分配——**代价:全体停顿(STW)+ 可能重复消费**(rebalance 前已拉未提交的消息重发);触发:心跳超时(session.timeout.ms)、**处理超时(max.poll.interval.ms:拉了一批处理太久没 poll 被判定死亡)**、主动 leave;**分配策略**:Range(老,按主题范围,易不均)/RoundRobin(轮询)/Sticky(尽量保留原分配)/**CooperativeSticky(2.4+ 默认:增量式再平衡,只迁移受影响分区,不全体停顿)**;**协调者 Coordinator**(某 broker 管理组状态/选举 leader)。**位移管理(Offset)**:位移存在内部主题 `__consumer_offsets`;提交方式:**自动提交(默认 enable.auto.commit=true,5 秒一次)——窗口期崩溃 = 重复消费**;手动提交:commitSync(同步,阻塞重试)/commitAsync(异步快,配回调)/提交特定位移(精确控制);**消费语义三档(面试必背)**:**at-most-once(最多一次:先提交后处理,崩了丢)**/**at-least-once(至少一次:先处理后提交——默认且主流,可能重复,消费端幂等兜底)**/**exactly-once(精确一次:见下一站)**;新消费者组起始位:auto.offset.reset(earliest 从头/latest 只收新的);**Lag(消费积压,最重要的运维指标)**:`kafka-consumer-groups --describe` 看各分区 lag——**lag 持续增长 = 消费能力不足**(扩消费者(≤分区数)/优化处理/加分区)。

## 第六站:事务与精确一次(EOS)

**幂等 vs 事务**:幂等只保证单分区不重;事务(transactional.id + initTransactions/beginTransaction/sendOffsetsToTransaction/commitTransaction)**保证跨分区原子**——要么全写要么全不写(内部两阶段 + 事务日志 __transaction_state);**端到端精确一次**:经典"消费-处理-写回"链路里,把**位移提交也放进同一事务**(read_committed 消费者)——“从 Kafka 读到处理完写 Kafka”不重不丢;**局限(重要)**:事务**只覆盖 Kafka 内部**——"从 Kafka 读、写 MySQL"的精确一次做不到(数据库不在事务里),要靠:MySQL 侧幂等键 / Outbox 模式(先写库内事件表再发 Kafka)/ 下游幂等消费;**代价**:事务吞吐下降明显——**非强一致场景别开**;流处理(Kafka Streams/Flink)用它实现状态一致。

## 第七站:集群与运维

**部署要点**:broker ≥3(副本才有意义)、KRaft 控制器或 ZK 奇数节点、机架感知 rack.id(副本跨机架容错)、JVM 堆(6-8G 够,消息走页缓存)、磁盘 XFS/多盘、**分区数规划**(先想清楚:目标吞吐/单消费者能力/未来扩展——分区数决定并行上限,但**只能增不能减**,且过多增加文件句柄与 rebalance 成本;经验:按"峰值吞吐 ÷ 单分区吞吐"估,留余量);**日常工具**:kafka-topics(--create/--alter/--describe)、kafka-console-producer/consumer(调试)、kafka-consumer-groups(--describe --lag)、kafka-reassign-partitions(分区迁移/重平衡)、kafka-configs。**监控三件套**:Consumer Lag(积压告警之王)、UnderReplicatedPartitions(副本不同步,= 数据风险)、ISR 收缩次数;broker 层:请求速率/CPU/磁盘 IO;**故障排查**:消息丢失(acks/ISR/min.insync/unclean 四查)、消息重复(幂等 + 消费幂等设计——**绝大多数"重复"要在消费端解决**)、频繁 Rebalance(看 session/max.poll 参数与处理耗时——**处理慢是主因,优化消费者而不是调大超时掩盖**)、Leader 不均衡(分区重平衡工具)、消息积压(消费能力扩容——分区满了要重设主题,设计时留余量)。**容灾**:MirrorMaker 2(跨集群/跨机房镜像复制,active-active/passive)、备份(Kafka 日志本身多副本,误删场景用镜像集群)。

## 第八站:生态——Kafka 不止是 MQ

**Kafka Connect(数据集成框架)**:Source Connector(数据库/日志 → Kafka)与 Sink Connector(Kafka → ES/HDFS/S3/数据库)——**JDBC/Elasticsearch/Debezium(CDC 变更捕获)等连接器即插即用**,数据管道不用写代码;Distributed 模式(集群内跑 worker,自动分配任务)。**Kafka Streams(轻量流处理库)**:不搭集群,应用内嵌库——**KStream(事件流)/KTable(变更表,按 key 最新值)**、map/filter/groupBy/**聚合与窗口(hopping/tumbling 窗口)**、流表 join、状态存储(RocksDB 本地 + changelog topic)——**实时统计/告警/ETL 的应用内方案**;**重活上 Flink(独立集群,更强状态与精确一次)——见大数据方向**。**Schema Registry(模式管理)**:Avro/Protobuf/JSON Schema——**消息带 schema、演进校验(向后兼容默认)、版本管理**,强类型消息与跨团队契约的规范姿势(配 Confluent 生态)。ksqlDB(SQL 化流处理)了解即可。**CDC 模式**:Debezium 监听数据库 binlog → Kafka → 下游(缓存同步/数仓入湖/搜索索引)——现代数据架构的经典一环。

## 第九站:场景与选型

**典型场景**:①**日志与埋点管道**(客户端 → Kafka → 日志系统/数仓——Kafka 的诞生场景);②**削峰填谷**(秒杀/突发流量:请求进 Kafka 异步消化——**注意 Kafka 是"拉",适合削峰不适合"即时通知"**);③**微服务异步解耦**(订单→支付→库存事件流);④**事件驱动架构**(Event Sourcing/CQRS:事件全量留存可回放——**Kafka 的保留+回放能力是事件溯源的天然底座**);⑤**流计算入口**(Flink/Spark Streaming 的实时数据源)。**Kafka vs RabbitMQ(选型表)**:吞吐(Kafka 百万级 vs RabbitMQ 万级)、消息模型(Kafka 分区日志可回放 vs RabbitMQ 队列消费即删)、功能(RabbitMQ 路由/死信/延迟队列更丰富;Kafka 更"原始"但生态全)、延迟(Kafka 批量设计延迟稍高,高吞吐场景无所谓;超低延迟小消息 RabbitMQ 更灵)、场景:Kafka 选"大数据量/日志/事件流/回放",RabbitMQ 选"业务消息/复杂路由/任务队列"。**反模式**:分区数拍脑袋乱设、把 Kafka 当简单任务队列(杀鸡用牛刀且无死信/延迟)、消息过大(>1MB 会拖垮,大对象走对象存储只传引用)、无限重试、忽略 lag 监控——**Kafka 的故障大半是"设计时埋的"**。

## 通关标准

能独立做到:给同事讲清"Kafka 为什么快"(顺序写+页缓存+零拷贝+批量)与"消息可能丢在哪三层"(生产者 acks/副本同步/消费者提交);能解释 ISR/HW/LEO 与 Leader Epoch;写生产者(幂等+acks=all+min.insync=2)与消费者(手动提交+幂等处理+监控 lag)并说清 at-least-once 与 exactly-once 的区别与代价;看得懂 rebalance 日志并能定位处理慢/参数问题;搭过 3 节点 KRaft 集群并完成一次主题扩容迁移——Kafka 主线通关。

Kafka 的学习曲线不在 API(简单),在**架构心智**:分区与顺序、副本与一致性、提交与语义——每层都是分布式系统的经典命题,而 Kafka 把它们做成了工程范式。它也是通往大数据世界的桥:学会 Kafka,你就能看懂日志管道、流计算、事件驱动与数据湖架构的半壁江山。下一步:业务消息中间件 [RabbitMQ](/learning-paths/middleware/rabbitmq)(对比学习选型),或进入 [微服务](/learning-paths/microservices/microservices-patterns) 的事件驱动章节。
