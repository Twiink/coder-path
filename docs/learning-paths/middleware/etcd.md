# etcd 学习路线

etcd 是云原生时代的分布式协调服务——**Kubernetes 的"大脑"**:K8s 把全部集群状态(Pod/Service/ConfigMap……)都存在 etcd 里,K8s 挂不挂,很大程度看 etcd。它由 CoreOS 用 **Go** 编写,基于 **Raft** 协议,提供强一致的分布式键值存储与 Watch/Lease/事务原语,API 是 gRPC/HTTP(好调试),被云原生生态视为标配。对比老大哥 ZooKeeper(见 [ZooKeeper 路线](/learning-paths/middleware/zookeeper)):**新项目的协调服务,默认可以选 etcd**。实践:`docker run -d --name etcd -p 2379:2379 quay.io/coreos/etcd` + `etcdctl` 即可开练。

这条线按 **定位与数据模型 → Raft 协议 → 核心 API(Put/Watch/Lease/Txn)→ 应用模式 → 集群与运维 → 客户端与生态** 推进。

## 第一站:定位与数据模型

**etcd 是什么**:强一致(线性一致)的分布式 **KV 存储**——存"少量但必须一致"的数据:配置、服务注册、分布式锁、选主;也是 Kubernetes 的元数据底座。**etcd vs ZooKeeper(面试对比)**:协议(Raft vs ZAB——Raft 更易懂)、语言(Go 轻量 vs Java)、API(gRPC/HTTP+JSON vs 自定义二进制——**curl 就能调**)、**Watch(持久化、支持历史回放 vs 一次性要重注册)**、事务(etcd 的 Txn/STM 更强)、生态(K8s/云原生 vs Hadoop/Kafka 老生态)。
**数据模型**:扁平 KV(值是不透明二进制),习惯用 **前缀路径当"目录"**(`/app/config/db`——前缀即命名空间);每个键有:**ModRevision(最后修改版本)/CreateRevision(创建版本)/Version(修改次数)**,全局有单调递增的 **Revision(每次写 +1)**——这是 etcd 的时间轴:**MVCC 多版本**(历史版本保留,可"回到某 revision"读——时间旅行)、**Compact(压缩)**:定期清历史版本防膨胀(自动 --auto-compaction-mode=periodic/revision)。

## 第二站:Raft 协议——可理解的共识算法

Raft 是"为可理解性而设计"的共识协议(对比 Paxos),**etcd 是它的最佳生产实现**,值得吃透:**三个角色**:Leader(处理写与日志复制)/Follower(被动复制、响应投票)/Candidate(选举中);**两个核心 RPC**:RequestVote(拉票)与 AppendEntries(心跳 + 日志复制二合一)。
**选举**:Follower 在 **election-timeout(默认 1000ms)内没收到心跳 → 变 Candidate 发起选举(term+1)**;投票规则:每个 term 一票、先到先得、**候选人的日志不能比自己旧**;**随机超时**(150-300ms)避免同时竞选(Split Vote 平票 → 新 term 再来);**过半票 = Leader**——容错公式 **2f+1 容忍 f 故障**(3 节点容 1,5 节点容 2)。
**日志复制**:Leader 把客户端写请求作为日志条目(term+index+命令)通过 AppendEntries 发给所有 Follower,**多数节点落盘(实际是 fsync 成功)即提交**,然后应用到状态机并回复客户端;**一致性检查**:AppendEntries 带 prevLogIndex/prevLogTerm,不一致就从匹配点重传——**日志匹配特性保证已提交日志绝不丢失**。
**安全性五条**(理解级别):单 Leader(每 term 最多一个)、Leader 只追加、日志匹配、**Leader 完整性(已提交的日志必在新 Leader 上——选票规则保证)**、状态机安全。**快照(Snapshot)**:日志无限增长 → 定期打快照截断(snapshot-count 默认 10 万条);慢节点追赶用 InstallSnapshot。
**成员变更**:先加 **Learner(只同步不投票)**,同步完成再提升——在线扩缩容的安全姿势(member add/remove)。**性能敏感点**:每次提交要 **fsync(磁盘)**——**etcd 对磁盘延迟极其敏感,必须 SSD**,慢磁盘 = 频繁选举 = 集群抖动(这是 etcd 排障第一条)。

## 第三站:核心 API——四个原语

**①KV 操作**:`etcdctl put /app/config/db mysql` / `get --prefix /app`(前缀范围查,服务发现的标配)/`del`;单请求限 1.5MB(默认),value 建议 <1KB。**②Watch(观察,etc 与 ZK 的最大体验差)**:一次注册**持续生效**(不用重注册);`watch --prefix /services/` 监听前缀;**可从指定 Revision 开始监听——客户端断线重连后从上次位置续听,事件不丢**(ZK 做不到的回放能力);事件带 PUT/DELETE、新旧值;**"Watch + 本地缓存"是 etcd 应用的标准架构**(客户端本地维护一份缓存,watch 增量更新——配置与注册列表的"订阅模式")。
**③Lease(租约,etc 的"心跳"原语)**:`lease grant 10`(10 秒 TTL)→ put key 时关联 lease → `lease keep-alive` 周期性续租——**lease 到期,关联的所有 key 自动删除**:服务注册的"活体标记"(服务活着就续租,宕机断租 key 消失——对应 ZK 临时节点,但粒度更灵活:一个 lease 管多个 key、续租与键分离)。
**④Txn(事务,CAS 的原子实现)**:`txn` 三段式——**If(比较:key 的 value/mod_revision/create_revision/version)** → **Then(成立执行)** → **Else(不成立执行)**——比较与执行**原子完成**:**Compare-And-Swap 分布式锁、条件更新(版本不对就不写)的官方姿势**;一次 Txn 可塞多个操作(批量原子);基于它封装了 **STM(软件事务内存,高级)**。
**读一致性**:默认**线性一致读**(Leader 确认自己仍是 Leader(ReadIndex/Lease Read)才回——读到的一定是最新已提交);可降级 Serializable(更快,可能旧)——**要强一致就别开降级**。

## 第四站:经典应用模式

**配置中心**:配置写 /app/config/* → 应用 **watch 前缀 + 本地缓存**(热更新,重启不丢);历史版本可查可回滚(Revision);不同环境/灰度用不同前缀。**服务发现**:服务启动 `put /services/order/192.168.1.1:8080 ""` 关联 lease 并后台续租;客户端 get --prefix + watch——**宕机 = 断租 = key 自动删 = 订阅者实时感知**(配合负载均衡器做动态后端)。
**分布式锁与选主(官方 concurrency 包一把梭)**:`clientv3/concurrency` 提供 **Mutex(互斥锁:lease + txn CAS——拿锁写 key,释放删 key;lease 自动续期,进程崩了锁自动过期,不会死锁)**、RWMutex、**Election(选主:多个候选抢同一 key,赢者当选,watch 失效自动接管)**——**"定时任务只跑一份 / 主备切换 / 单例服务"的标准解法**,语义与 ZooKeeper 锁同级(会话语义)而比 Redis 锁严谨(见 [Redis](/learning-paths/database/redis) 锁的对比)。
**Kubernetes(最大应用)**:**所有资源对象(Pod/Service/ConfigMap/Secret…)的状态都存在 etcd**;API Server 是唯一读写入口;**Controller 靠 watch 驱动"调谐循环"**(声明式编排 = 期望状态 vs 当前状态不断 watch 对齐)——etcd 的 watch 是 K8s 控制器的引擎;**etcd 高可用 = K8s 高可用**(etcd 挂了集群只能读不能写)。
**容量真相**:大 K8s 集群 etcd 数据可达 GB 级——所以 K8s 运维必须会 etcd 备份/压缩/恢复。

## 第五站:集群部署与运维

**部署**:奇数节点(3 或 5;K8s 控制面 stacked 或 external 模式);端口 **2379(客户端)/2380(peer 集群通信)**;两种加入方式:静态(--initial-cluster 一次配好)与**动态(member add → 以 existing 状态启动)**;**生产必配 TLS**(peer 间与客户端证书)与 **RBAC 认证**(root 用户、role 按 key 前缀授权 read/write——K8s 的 etcd 就是这么锁的)。
**数据保护三件套**:**备份**:`etcdctl snapshot save`(全量快照;增量不支持——**定期快照是唯一防线**,K8s 用 etcd-operator/定期 cron + S3);**恢复**:`snapshot restore`(注意:**恢复是破坏性操作,快照后的写入全丢;restore 出的集群是新 member id——**恢复演练是必修课**);**压缩与整理**:历史版本膨胀 → `compact` 压缩 + **`defrag`(碎片整理,空间真正还给文件系统)**——**db 超 quota(默认 2GB)后集群只读**:compact + defrag 的紧急处置流程要背。
**监控(关键指标)**:`/metrics` + Prometheus:**etcd_server_has_leader(集群健康第一指标)、etcd_server_leader_changes_seen_total(频繁 = 网络/磁盘问题)、etcd_disk_wal_fsync_duration_seconds(磁盘慢的直接证据——etcd 的命门)、db_total_size**;Grafana 官方面板 ID 3070。
**etcdctl 命令清单**:put/get/del(带 --prefix/--rev 历史读)/watch/lease grant & keep-alive/member list & add & remove/endpoint health & status/snapshot save & restore/compact/defrag/user & role(认证)。
**排障三板斧**:Leader 频繁切换(查 fsync 延迟与网络——先换 SSD 再调 election-timeout)、DB 超限(compact+defrag,查谁在写大量短生命周期 key)、watch 风暴(客户端 watch 过多/范围过宽——前缀合并)。

## 第六站:客户端与生态

**Go 客户端(clientv3)**:`clientv3.New(endpoints)` → `kv.Put/Get`(带 ctx 超时——**Go 并发下 context 必带**)、`watcher.Watch`(chan 消费事件)、`lease.Grant`、**`kv.Txn(ctx).If(...).Then(...).Else(...).Commit()`**(锁与条件更新的实现)、concurrency 包(Mutex/Election);Java:jetcd;其他语言均有官方/社区客户端;**HTTP/JSON 网关**(gRPC-gateway):`/v3/kv/put` 等 REST 端点——脚本与调试友好。
**生态**:confd(模板渲染 + watch 热更新配置文件——老牌配置工具)、Kubernetes(核心依赖)、CoreDNS(后端可选)、服务网格早期版本、**对比 Consul**(同代协调服务:更偏服务发现/健康检查/多数据中心,非 Raft 存储?Consul 用 Raft 但形态不同——**选型:要 KV+锁+选主 → etcd;要 DNS 式服务发现+健康检查多 DC → Consul**;国内 Java 微服务注册配置 → Nacos(见 [Spring Cloud](/learning-paths/microservices/spring-cloud)))。
**延伸阅读**:Raft 论文《In Search of an Understandable Consensus Algorithm》(必读,动画图 raft.github.io 辅助)、TiKV(Raft + RocksDB 的分布式事务 KV——etcd 思想的工程延伸)。

## 通关标准

能独立做到:用 etcdctl 完成前缀读写、watch 监听、lease 创建/续租并解释三者如何组合出"服务注册发现";用 Txn 写一个 CAS 分布式锁并说清它比 Redis SETNX 锁强在哪(会话语义/无过期猜谜);给同事讲清 Raft 选举(term/随机超时/过半)与日志提交流程,说出"为什么必须 SSD";配好快照备份并能演练一次 snapshot restore(知道会丢什么);能看 /metrics 与日志判断集群健康并处置"db 超限只读"——etcd 主线通关。

etcd 让"分布式一致性"第一次变得可理解:Raft 协议直白、API 简洁(gRPC + curl 能调)、Watch 持久好用——它是云原生世界的承重墙,也是你读懂 Kubernetes 的一把钥匙(理解了 etcd 的 watch + revision,K8s 控制器的调谐循环就不再神秘)。学完它再回头看 ZooKeeper 的 ZAB,你会站在"协议家族"的高度理解两者;而这一整套"强一致协调"的心智,将伴随你进入微服务、分布式锁与云原生的每个角落。下一步:把 etcd 放进 [微服务架构](/learning-paths/microservices/microservices-patterns) 与 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 的大图里,或直接去学 [Kubernetes](/learning-paths/devops/kubernetes)。
