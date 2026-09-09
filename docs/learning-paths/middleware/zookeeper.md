# ZooKeeper 学习路线

ZooKeeper 是分布式协调服务的"老大哥":Hadoop 生态(HDFS HA/YARN/HBase)、Kafka(2.8 前)、Dubbo 都靠它做协调——它是分布式系统的"神经中枢"。它**不是数据库**(节点数据很小)、**不是消息队列**(写吞吐只有千级),而是提供**强一致(CP)协调原语**的服务:配置管理、命名/注册发现、分布式锁、Leader 选举、集群管理。虽然 etcd(云原生/Raft)与 Consul 在挑战它,但其 **ZAB 协议与成熟的工程实现仍是分布式协调的经典教材**——理解 ZooKeeper,你就理解了分布式协调的精髓。实践:`docker run -d --name zk -p 2181:2181 zookeeper` + `docker exec -it zk zkCli.sh`。

这条线按 **数据模型 → 架构与 ZAB 协议 → Watcher 与经典应用 → 分布式锁 → 集群与运维 → 客户端(Curator)→ 生态与选型** 推进。

## 第一站:定位与数据模型

**ZooKeeper 的心智模型**:一棵**类文件系统的树**(ZNode 节点),提供"分布式环境下大家一致同意的树 + 变更通知"。**节点类型(选型是基础功)**:①持久节点(PERSISTENT:显式删除才消失——配置/元数据);②**临时节点(EPHEMERAL):会话结束自动删除、不能有子节点——"活着的标记",服务注册的基石**(会话断开节点消失,天然感知宕机);③顺序节点(SEQUENTIAL:路径自动追加单调序号——公平锁/队列的基础);④容器节点与 TTL 节点(3.5+,自动清理,进阶);**组合**:持久顺序、**临时顺序(分布式锁的标准组合)**。
**节点数据与版本**:单节点数据默认上限 1MB(**建议 <1KB——它不是数据库**);每个节点有 dataVersion/cversion/aclVersion 三个版本号——**setData(path, data, version) 带版本号 = CAS 乐观锁**(版本不匹配报 BadVersion,并发更新的安全阀;version=-1 无条件写);**ACL**:五权限(CREATE/READ/WRITE/DELETE/ADMIN),scheme(world 全放/auth 已认证/digest 用户密码/ip);子节点不继承父 ACL。
**适用边界(面试常问"它是什么")**:存少量必须一致的元数据、做协调不做存储;写 TPS 千级、别存大对象、别当 MQ。

## 第二站:架构与 ZAB 协议——一致性的心脏

**角色**:Leader(唯一,处理所有**写请求**并广播)、Follower(处理读 + 参与投票)、Observer(只读、不投票——**跨机房/读扩展用**);客户端连任意节点:**读任意节点(可能读到稍旧数据——一致性是"写线性一致、读可能 stale",要读最新可用 sync 命令)**;**写全部转发 Leader**。
**ZAB(ZooKeeper Atomic Broadcast)两种模式**:①**崩溃恢复模式(选举)**:集群启动或 Leader 挂——**Fast Leader Election**:节点投票 `(epoch, zxid, myid)`,规则:**zxid 大的优先(数据最新的赢),zxid 相同 myid 大的赢**,**过半(多数派)即胜出**——为什么集群要奇数节点(3 节点容 1 故障、5 节点容 2);**epoch(任期)**:每次选举 +1,防"旧 Leader 复活"造成脑裂;②**原子广播模式(正常服务)**:写请求流程:Client → Leader 分配 **ZXID(64 位:高 32 位 epoch + 低 32 位事务计数——全局单调有序,既是事务号也是"数据新旧"的裁判)**→ Leader propose → Follower 写事务日志并 ACK → **过半 ACK 即 commit**(简化 2PC,不等全部——性能与一致性的平衡)→ Follower 应用;**顺序保证**:队列 + 编号,**先到先执行、全局 FIFO**。
**崩溃恢复的承诺**:已提交的事务不丢(leader 选举以 zxid 为准)、未提交的不执行;新 Leader 与 Follower 同步三种方式:**DIFF(增量)/TRUNC(截断多余)/SNAP(全量快照)**。**会话(Session)**:客户端与服务器的连接契约,tickTime 心跳维持;**会话超时 = 临时节点消失 = 分布式锁自动释放**(ZooKeeper 锁"不靠过期时间、靠会话"的可靠性根源);网络抖动/GC 停顿导致会话过期是经典故障(见运维)。

## 第三站:Watcher 与四个经典应用

**Watcher(观察者)机制**:客户端可对节点注册 watch,节点变化(创建/删除/数据变化/子节点变化)时收到一次通知——**特性必记**:①**一次性**:触发后自动失效,**要持续监听必须重新注册**(客户端库如 Curator 帮你循环);②**只通知"发生了",不带数据**(收到通知要再 getData 拉取);③不保证实时(网络);④**watch 与"读"绑定**(getData/getChildren 时传 watch)。
**经典应用(把上面的原语拼成解决方案)**:①**配置中心**:配置存 ZNode + 客户端 watch——**配置修改推送热更新**(版本号 CAS 防并发覆盖);②**服务注册发现/集群管理**:Provider 注册临时节点、Consumer `getChildren` + watch 子节点变化——**宕机 = 会话断 = 临时节点删 = 订阅者收到通知摘除**(Dubbo 老架构就是这么干的);③**Leader 选举**:多个候选建临时顺序节点,**序号最小者当选**、其余 watch 前一个节点(替代方案:LeaderLatch/LeaderSelector 封装);④**分布式锁**(下一站详述)。

## 第四站:分布式锁——ZooKeeper 的招牌

**ZooKeeper 锁与 Redis 锁的本质差异**(面试高对比题):Redis 锁靠"过期时间"防死锁(业务超时要续期,有误删风险);**ZooKeeper 锁靠"会话"——客户端崩了会话断,临时节点自动删,锁自动释放,无需过期猜谜**。**实现演进**:①简单排他锁:尝试创建临时节点,成功=拿锁,失败=watch 等待删除——**问题:所有等待者都 watch 同一节点 = 羊群效应(惊群),且不公平**;②**公平锁(标准实现)**:所有请求创建**临时顺序节点**,**序号最小的持有锁**,其他人只 watch **前一个节点**(序号 i-1 删除 → 自己检查是否最小)——**FIFO 公平、无羊群**;③读写锁(读读共享、写互斥)。
**Curator 的 Recipes 直接用**:`InterProcessMutex`(可重入分布式锁:acquire/release,内部就是顺序节点 + watch 前驱)、InterProcessReadWriteLock、LeaderLatch/LeaderSelector(选举)。**适用对比**:ZK 锁(强一致、会话语义、性能一般——**低频但绝不能错的互斥**(任务调度/迁移));Redis 锁(高性能、靠超时——高频低冲突);**etcd 锁**(云原生,类似 ZK 语义)。
**选型**与细节见 [Redis 路线](/learning-paths/database/redis) 的分布式锁章节。

## 第五站:集群部署与运维

**部署**:zoo.cfg——`tickTime`(基础时间单位,默认 2000ms)/`initLimit`(Follower 启动连 Leader 时限 = 10×tick)/`syncLimit`(同步超时)/`dataDir`(快照)/`dataLogDir`(**事务日志目录——务必独立磁盘/SSD**,写性能命脉)/`clientPort=2181`/`server.1=host:2888:3888`(2888 主从同步、3888 选举);每节点 `dataDir/myid` 写唯一编号;**奇数节点**(过半机制,3 节点是生产最小)。
**Observer**:`server.x:host:2181:3181:observer`——不投票的只读节点(跨机房就近读)。**四字命令(裸机排障利器)**:`echo mntr | nc localhost 2181`(监控指标:zk_server_state/节点数/连接数)、stat/ruok(imok)/wchs(watch 数)/srvr;**监控**:Prometheus zk exporter/JMX:QPS、延迟、连接数、**选举次数(频繁选举 = 网络/磁盘/GC 有问题)**、Full GC;**清理**:快照与事务日志的 autopurge.snapRetainCount/purgeInterval(不配会磁盘写满)。
**容量红线**:单父节点子节点 <1 万、单节点数据 <1KB、**写 QPS <1 千**(它是协调服务不是存储)、watch 别海量。**经典故障**:客户端会话频繁过期(网络抖动/客户端 GC 停顿——超时设太短)、Leader 频繁切换(慢磁盘/网络)、节点假死(Full GC 长暂停)、脑裂(过半原则:少数派分区自动停止服务——**ZK 宁可不可用也要一致(CP)**);备份:快照 + 事务日志定期拷走(默认无自动备份)。

## 第六站:客户端与 Curator

**原生 API**(ZooKeeper 类:create/getData/setData/delete/getChildren + watcher)——**痛点**:连接管理要自己搞(断线重连/会话重建)、watch 一次性要自己重注册、异常处理繁琐——**生产别裸用原生 API**。**Curator(Apache 顶级项目,生产标准)**:连接重试策略(RetryPolicy:ExponentialBackoffRetry)、`CuratorFramework`(fluent 链式:start/close)、**Recipes(开箱即用的分布式原语)**:InterProcessMutex(可重入锁)/InterProcessReadWriteLock(读写锁)/LeaderSelector(选举,可让位)/LeaderLatch(选举,持有到关闭)/PathChildrenCache(子节点缓存:监听变化自动更新本地缓存——**服务发现订阅的标准件**)/NodeCache/TreeCache/分布式计数器与队列;事务支持(多节点原子操作)。
ZkClient(老一代简化封装,会读即可);Spring Cloud ZooKeeper(注册/配置的 Spring 集成,了解)。

## 第七站:生态、对比与选型

**它是谁的地基**:Kafka 2.8 前(Controller 选举、broker/topic 元数据、旧 offset——**已被 KRaft 取代,见 [Kafka 路线](/learning-paths/middleware/kafka)**);Dubbo 老版本注册中心(现主流换 Nacos);Hadoop HDFS/YARN HA(ActiveNameNode 选举);HBase(Master 选举/RegionServer 在线表);Pulsar 元数据。
**ZooKeeper vs etcd(新老对话,面试常比)**:协议(ZAB vs **Raft**——Raft 更易读易懂)、语言/重量(Java vs Go 轻量)、API(自定义二进制协议 vs **gRPC + HTTP/JSON——好调试**)、**Watch(一次性 vs 持久化(不用重注册,体验好)**、事务(etcd 支持 STM 更强)、写性能(etcd 更高)、生态(etcd = **Kubernetes 的元数据底座**,云原生标配)。
**选型建议**:新项目/云原生/K8s 场景 → **etcd**;已有 ZK 的老生态(Hadoop/Kafka 老版本)与 Java 体系 → ZK 继续用(成熟稳定,Curator 一把梭);微服务注册配置(国内 Java)→ **Nacos**(注册+配置一体,见 [Spring Cloud](/learning-paths/microservices/spring-cloud));服务网格数据平面外的控制面 → Consul。
**学习顺序**:先把 ZK 的"树 + 临时节点 + watch + 过半"四个概念吃透,再去看 etcd/Raft——协调服务的通用心智就齐了。

## 通关标准

能独立做到:给同事讲清四类节点与临时节点为什么是服务注册/分布式锁的基石;画出 ZAB 选举(zxid/myid/过半)与广播(propose/ACK/commit)流程并解释"已提交不丢";用 Curator 的 InterProcessMutex 与 LeaderSelector 各写一个真实场景(定时任务防重/主从选举);说出 watch 一次性语义与羊群效应的规避;解释 ZK 与 Redis 锁、ZK 与 etcd 的差异与选型;能看 mntr 与日志判断集群健康——ZooKeeper 主线通关。

ZooKeeper 的价值不在"新",而在"经典":树形数据、临时节点、watch、过半选举——这些原语二十年不变地支撑着分布式系统的骨架;读懂它,ZAB 与 Raft 的家族谱系、etcd 与 Nacos 的设计取舍就都顺理成章了。它是你理解"分布式一致性到底在解决什么"的最好入门:先学会 ZooKeeper 的克制(只存一点数据、只做协调),你才懂得分布式系统里"少即是多"。下一步:同门更现代的 [etcd](/learning-paths/middleware/etcd),或把协调能力用进 [微服务架构](/learning-paths/microservices/microservices-patterns)。
