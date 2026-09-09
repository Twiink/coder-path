# RabbitMQ 学习路线

RabbitMQ 是消息队列界的"瑞士军刀",也是业务消息中间件的代表:基于 **AMQP 0-9-1 协议**(Erlang 实现),以**灵活路由、可靠投递、功能丰富**(死信/延迟/优先级/管理 UI)著称。它不像 Kafka 那样追求极致吞吐,而是在功能、易用与可靠之间取得平衡——**业务消息、异步解耦、复杂路由选它;海量日志与流处理选 Kafka**(对比见文末与 [Kafka 路线](/learning-paths/middleware/kafka))。实践:`docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management`,浏览器开 `localhost:15672`(guest/guest)。

这条线按 **模型与组件 → 交换机 → 队列 → 可靠性三件套 → 死信/延迟/高级特性 → 集群高可用 → 运维 → 场景模式与选型 → 客户端实践** 推进。

## 第一站:核心模型与 AMQP

**RabbitMQ 最重要的心智:消息不直接进队列——先发给"交换机(Exchange)",由交换机按绑定规则路由到队列**。完整链路:Producer → Exchange → Binding(绑定:交换机与队列的"路由规则")→ Queue → Consumer。**组件清单**:Producer/Consumer、Exchange(路由中枢,四类型见下)、Queue(消息存储,等消费者)、Binding、**vhost(虚拟主机:资源隔离租户——一个 RabbitMQ 实例给多个应用/环境分 vhost,权限也按 vhost 配)**、**Connection(客户端与服务器的 TCP 长连接)与 Channel(信道:连接内的轻量复用通道——一个连接开多个 channel 并发收发,别每操作建连接)**;AMQP 是"方法帧"协议(连接/信道/交换/队列/消费各有方法集),理解"连接-信道-方法"分层即可,客户端库会封装。
**消息的组成**:路由键(routing key,交换机路由依据)、**属性 Properties**(content_type(序列化格式)/delivery_mode(2=持久化)/priority/message_id/timestamp/**correlation_id+Rely_to(RPC 用)**)、消息体(业务数据,字节数组——客户端自己定序列化:JSON 主流)。
**心跳**:连接级 keepalive,防半开连接。

## 第二站:交换机四兄弟——路由的艺术

①**Direct Exchange(直连)**:路由键**完全匹配**才投递——点对点、按日志级别(error 进 error 队列);**默认交换机(空名 "")**:每个队列自动以"队列名"为路由键绑定它——**最简单的"直接发队列"就是走默认交换机**(新手以为发的是队列,其实是默认交换机在路由);②**Topic Exchange(主题,最常用)**:路由键**通配符匹配**——`*` 匹配一个单词(点分隔)、`#` 匹配零到多个:`order.created` 配 `order.*` 或 `order.#`——**按业务类型/级别订阅的灵活模式**(订单事件、多级分类);③**Fanout(扇出)**:忽略路由键**广播**给所有绑定队列——缓存更新通知、站内信群发、解耦广播;④**Headers(头)**:按消息头属性匹配(x-match: all/any)——最慢最少用。**选型口诀**:点对点→direct,广播→fanout,带层级订阅→topic;**生产实践常是"业务交换机+死信交换机"两套**(见死信节)。自定义交换机类型(一致性哈希/延迟插件)按需。

## 第三站:队列与队列类型

**队列属性**:durable(队列定义持久化——重启不丢定义,但消息持久化另说,见可靠性)、exclusive(声明连接独占,断开即删——临时队列 RPC 用)、auto-delete(最后一个消费者断开即删)、arguments(x-message-ttl 消息存活/x-max-length 最大长度/溢出行为 x-overflow(drop-head/reject-publish)/x-expires 空闲删除)。
**三种队列类型(3.8+,选型重点)**:①**Classic 经典队列**(传统,功能最全(优先级等),单机存储;老镜像队列方案已废弃);②**Quorum 仲裁队列(官方推荐的可靠默认)**:基于 **Raft** 的复制队列——消息写入多数节点才算成功、主(leader)故障自动选新、防脑裂、**不丢消息的强一致**(代价:不支持优先级/部分 TTL 类功能,吞吐略低)——**新项目求稳用 quorum**;③**Stream 队列(3.9+,类 Kafka)**:追加式日志,消息不消费即删而是保留可回放、消费组——想"RabbitMQ 里有个 Kafka"时用它(了解即可,重度流场景直接 Kafka)。
**死信队列(DLX,可靠性的枢纽)**:**x-dead-letter-exchange**(消息的"遗嘱"):三种情况消息进死信——**消费者拒绝且 requeue=false / 消息 TTL 过期 / 队列长度溢出**;死信队列专门接"处理失败/过期的消息"——重试、审计、延迟队列全靠它(见第五站);**优先级队列**(x-max-priority:VIP/紧急任务,有性能开销,少用)。

## 第四站:可靠性三件套——消息不丢的三个环节

**①生产者确认(Publisher Confirms,确认消息进 broker)**:channel 开 confirm 模式,broker 落盘(持久化时)后回 ack,失败回 nack——客户端异步处理确认(批量/顺序确认回调),**发送可靠性的标准姿势**;对比**事务(tx.select/commit)**:慢 10 倍以上,官方明确"用 confirms 别用事务"。
**②持久化三层(消息重启不丢)**:交换机 durable + 队列 durable + **消息 delivery_mode=2(持久)——三层全配才真持久**;注意:即使全配,宕机瞬间"已收未刷盘"的窗口仍可能丢(极端场景加 quorum 队列)。**③消费者确认(处理成功才确认)**:消费回执三兄弟——`basicAck`(确认成功,可 multiple 批量)/`basicNack`(拒绝,requeue=true 重新入队 / **requeue=false 进死信**)/`basicReject`(Nack 的单条版);**autoAck=true(自动确认)的危险:broker 一发就算成功,消费者处理一半崩了 = 消息丢失**——可靠消费必须**手动 ack:处理完业务再 ack**。
**丢消息三大场景自查**(面试/排查用):生产端没等确认、broker 端没持久化、消费端自动确认——对应三件套补齐。**重复投递的现实**:网络抖动/ack 丢失会让同一条消息投两次——**消费者必须幂等**(业务键去重:处理前查重/唯一约束),"MQ 不重不丢"在分布式里是神话,靠消费端幂等兜底。

## 第五站:高级特性——死信、延迟、Lazy、Prefetch

**消息 TTL**:队列级 x-message-ttl 或消息级 expiration 属性,超时未消费的消息变死信。**延迟队列(订单超时取消/定时通知的经典需求)**:两种实现——①**TTL + DLX**:消息发往"不消费的缓冲队列"设 TTL,过期后进死信队列被真正消费(**精度粗、有队列堆积限制**);②**rabbitmq_delayed_message_exchange 插件**(生产推荐:交换机支持延迟投递,`x-delay` 头设毫秒——秒级精度,一条代码搞定)。
**Lazy Queue(惰性队列,3.12 起默认行为)**:消息**尽可能直接落盘**,内存只留索引——**海量堆积不撑爆内存**(消费跟不上生产时的保命配置;代价是磁盘 IO 与吞吐)。**Prefetch(预取,消费调优的核心旋钮)**:`basic.qos(prefetchCount)` 控制消费者**一次最多未确认几条**——**prefetch=1:公平分发(处理快的多消费,轮询不再均分;任务型队列标配)**;调大 prefetch 提升吞吐(**但消息都堆在消费者内存**,网络/处理慢的消费者慎大)。
**消费失败重试的正确姿势**:Nack+requeue=true 会**无限循环重投**(毒消息卡死队列)——**生产标准**:nack(requeue=false)进死信 → 死信消费者按死信头 x-death 的 count 计数,超最大次数转人工队列/丢弃/告警——**"队列 + 死信 + 计数"是 RabbitMQ 的重试闭环**。

## 第六站:集群与高可用

**集群基础**:多节点互联(Erlang cookie 认证);**元数据(交换机/队列定义)全节点共享**,但**消息只存在声明它的节点**——所以"集群 ≠ 高可用",节点挂了它上面的队列就不可用(除非镜像/仲裁);节点类型 disk(默认,存元数据)/ram(内存,性能节点,少用)。**高可用两个时代**:镜像队列(3.13 前:主从复制、自动提升——**已废弃,别再用**);**Quorum Queue(现代答案,见第三站:内建复制与选主)**——**可靠性需求直接声明 quorum,不用额外策略**。**网络分区(脑裂)**:集群被网络切断成两半各自为政——partition handling 策略:**pause_minority(少数派节点自动暂停,保证一致——生产推荐)**/autoheal/ignore;检测靠节点心跳;**分区恢复后的队列归属要检查**。**跨集群**:Federation(交换机/队列联邦:松耦合、按需拉取——跨机房/跨云);Shovel(单向"搬运工":迁移/灾备)。**接入层**:客户端连多个节点或前置 LB(配心跳),避免单点。

## 第七站:运维与监控

**Management UI(15672,RabbitMQ 的巨大优势)**:队列深度/生产消费速率/连接信道可视化、**页面上直接"发消息/取消息"调试**、管理交换机队列绑定——排障体验远超 Kafka。**关键告警水位(达到即阻塞生产者 = 内置反压)**:内存 vm_memory_high_watermark(默认 0.4:内存用到 40% 阻塞生产者——**堆积队列是元凶,查谁在堆**)、磁盘 disk_free_limit(磁盘不足阻塞生产)、文件描述符(连接数上限,ulimit);**监控集成**:Prometheus rabbitmq_exporter/内置端点 + Grafana(队列堆积、消费 lag、连接数)。
**常用运维**:rabbitmqctl(list_queues/status/关闭应用)、definitions 导入导出(json:交换机/队列/绑定/用户全量——**环境迁移的快捷方式**)、配置 rabbitmq.conf、日志轮转、滚动升级(特性标志 feature flags 向前兼容)。
**安全**:默认 guest 仅限 localhost——**生产必建独立用户 + vhost 权限最小化 + 管理端口不裸奔 + 可选 TLS**。

## 第八站:场景模式与 MQ 选型

**五大经典模式**:①**工作队列(异步任务)**:邮件/图片处理/报表——多消费者抢队列,手动 ack + prefetch=1 公平消费;②**发布订阅(解耦)**:fanout——订单服务发事件,库存/积分/通知各自建队列订阅,**加新下游不改上游**;③**路由订阅**:topic——按事件类型/日志级别精确订阅;④**RPC 模式**(请求进队列,reply_to + correlation_id 回结果——**了解即可:同步调用现代直接用 HTTP/gRPC**,MQ 的 RPC 反模式);⑤**延迟任务**:延迟交换机/死信 TTL——订单 30 分钟未支付自动取消(轮询数据库的替代)。
**最终一致性落地**:本地消息表 / 事务消息 → MQ 异步通知 → 下游幂等消费——分布式事务的常见务实解,见 [微服务](/learning-paths/microservices/microservices-patterns)。**选型(面试必答)**:业务消息(复杂路由/死信重试/延迟/管理需求/消息量万级)→ **RabbitMQ**;海量日志/埋点/流处理(百万级、回放、削峰)→ **Kafka**;RocketMQ(阿里开源:Java 生态、**事务消息与延迟消息内建**、金融级——国内 Java 团队常用,见 [RocketMQ 路线](/learning-paths/middleware/rocketmq));Pulsar(云原生多租户新贵,了解);**顺序消息**:RabbitMQ 多消费者天然无序(单消费者才保序),强顺序场景想清楚或用单队列单消费者。

## 第九站:客户端实践(以 Java 为例,其他语言同理)

**Java 生产姿势(Spring Boot)**:依赖 spring-boot-starter-amqp;连接工厂(CachingConnectionFactory,配 publisher-confirm-type: correlated 与 publisher-returns: true——**确认与不可路由回退全开**);**RabbitTemplate**(发送:convertAndSend(交换机,路由键,对象)——Jackson 自动序列化);**@RabbitListener(queues = "xxx")** 消费(容器自动 ack——**处理抛异常默认重回队列,会死循环**:配 RetryInterceptor(有限重试,耗尽后进死信)与死信队列声明——**"监听器 + 重试 + 死信"是 Spring 消费可靠性三件套**);声明:配置类里 @Bean Queue/Exchange/Binding(或注解式);**消息结构**:JSON + contentType、带 messageId/业务幂等键;Go(amqp091-go 手写连接/信道/确认,封装较重——直接上 go-rabbitmq 类封装或 MQTT?生产有成熟库)、Python(pika,注意连接线程模型)。
**排查清单**:队列堆积(消费者处理慢/挂了/prefetch 太小/死循环 nack)、消息丢失(三层持久化+手动 ack 查)、消息重复(消费幂等)、连接被断(心跳/网络)、内存告警(清堆积)。

## 通关标准

能独立做到:说清"生产者→交换机→绑定→队列→消费者"全链路与四类交换机选型;把"消息不丢"的三件套(confirm/持久化三层/手动 ack)配置到生产标准并解释每层防什么;搭出"业务队列+死信队列+重试计数"的失败处理闭环与延迟队列;理解 quorum 队列为什么替代镜像、网络分区 pause_minority 为什么;在 Spring Boot 里用 @RabbitListener 完成带重试与死信的可靠消费——RabbitMQ 主线通关。

RabbitMQ 的强大在于"把可靠性做成了配置项":确认、持久化、死信、延迟、quorum——每个旋钮都在回答"消息到底丢不丢、重不重"。它不是最快的 MQ,但可能是最全能与最好用的——管理界面一开,消息流动一目了然,这让它在业务系统里二十年不过时。学完它再对比 [Kafka](/learning-paths/middleware/kafka) 的"日志哲学",你就掌握了消息中间件的完整坐标系:一个管业务可靠,一个管数据吞吐。
