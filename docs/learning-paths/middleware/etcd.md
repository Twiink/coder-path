# etcd 学习路线

etcd 是云原生世界那位把集群状态贴在保险柜里的协调员：Kubernetes 的对象、控制器的观察点、服务注册、配置和选主，都可能依赖它。它用 Go 实现，以 Raft 复制少量关键键值，用 MVCC revision、Watch、Lease 和事务把“谁改了什么、何时改的、谁还活着”说清楚；它可靠，却不喜欢大文件、无休止的历史版本和没有超时的客户端。

**推荐顺序** ---- 定位与键值模型 → 存储与 MVCC → Raft 与一致性 → KV/Watch/Lease/Txn → 协调模式 → 集群部署 → 备份维护与容量 → 安全、客户端与生态

**这条线怎么用** ---- 先用单节点熟悉 v3 API，再用 3 节点观察选举、故障、Watch、租约和快照恢复。不要只把 etcd 当成“带目录的 KV”：它的 revision、quorum、WAL、压缩和 defrag 才是生产行为的底色。

## 第一站：定位与键值数据模型

第一站先把 etcd 从 Kubernetes 的影子里请出来。它本身是一个强一致的分布式键值存储，不负责替应用设计对象模型；它愿意保管关键的小纸条，但不愿意当你的文件服务器。

**etcd 的定位** ---- 理解 etcd 适合配置、服务发现、锁、选主和控制面状态，核心价值是可靠的一致读写；大日志、图片、业务明细和高吞吐分析应交给更合适的系统

**扁平键空间** ---- etcd 的 key 是字节串，不是真正的目录树；应用通常用 `/app/config/db` 这样的前缀形成命名空间，再通过 range 或 prefix 查询组织数据

**Value 与大小边界** ---- value 是不透明字节，编码格式由应用决定；请求和单值大小受服务端参数约束，生产应让 value 小而稳定，避免把整份大型文档塞进一致性日志

**Revision 逻辑时钟** ---- store revision 是集群范围的单调逻辑时钟，提交一个事务会推进 revision；它把不同 key 的变化放到一条可比较的时间线上，是 Watch、历史读取和缓存同步的基础

**CreateRevision、ModRevision 与 Version** ---- CreateRevision 表示键首次创建的 revision，ModRevision 表示最近修改它的 revision，Version 表示该键被修改的次数；比较这些字段即可构造常见的条件更新

**MVCC 多版本** ---- etcd 保留 key 的历史版本，客户端可以按 revision 读取某个时间点的视图；历史不是免费磁盘，压缩策略决定旧版本何时不再可读

**Range 与前缀** ---- range 查询可以按精确 key、字典序范围或前缀读取；服务发现和配置订阅常以 prefix 为边界，但前缀过宽会放大响应、Watch 事件和客户端缓存压力

**Lease 关联** ---- key 可以附着在 lease 上，lease 过期时关联 key 一并删除；租约是生命周期机制，不是给普通业务数据附加一个模糊的“自动过期”按钮

**响应头与集群身份** ---- API 响应包含 revision、raft term、集群 ID、成员信息等元数据；排障时把这些头与客户端日志关联起来，能分辨读到的视图和请求是否来自预期集群

## 第二站：存储引擎、WAL 与 MVCC 落盘

第二站要下到保险柜底层。etcd 表面是 key/value，里面却有 Raft 日志、WAL、快照、MVCC 索引和后端数据库在轮流记账；磁盘延迟一高，整个集群会像会计突然改用算盘一样慢。

**Raft WAL** ---- 客户端修改先成为 Raft 日志条目，WAL 用于持久化和崩溃恢复；日志目录的顺序写、fsync 延迟和磁盘可靠性直接影响提交延迟与选举稳定性

**后端数据库** ---- etcd v3 默认使用嵌入式 bbolt 后端保存 MVCC 数据与索引；它适合小而关键的状态，页、桶、事务提交和文件增长会共同影响维护与备份

**提交与应用** ---- Leader 先复制日志，达到 quorum 后提交，再由各成员把已提交操作应用到状态机和后端；“日志已写入”“事务已提交”“客户端已收到响应”是不同阶段，故障排查不能混为一谈

**快照与日志截断** ---- 快照保存某个状态点，Raft 日志达到条件后可以截断；落后成员若无法从保留日志追赶，可能需要通过 snapshot 安装恢复

**MVCC 索引与历史** ---- 当前 key 的索引和历史版本共同支撑按 revision 读取与 Watch；写入频繁但长期不 compact 会让后端文件和索引持续增长

**Compaction** ---- compact 删除指定 revision 之前不再需要的历史版本，减少 MVCC 历史；它不会自动把文件系统空间全部还回来，也不能替代快照

**Defragmentation** ---- defrag 重写成员的后端文件，回收内部碎片并把空间还给文件系统；它会产生磁盘 I/O，通常应逐成员、错峰、在健康状态下操作

**WAL 与后端备份边界** ---- 官方 snapshot 是可迁移、可恢复的备份路径；不要把运行中的 WAL 或 bbolt 数据文件当成随手复制即可恢复的普通文件

**磁盘延迟的连锁反应** ---- fsync 变慢会拉长提交，Follower 落后会增加复制压力，心跳和选举可能超时，最终表现为 leader 变化、客户端超时和控制面抖动；排障先看磁盘与网络，再动时间参数

## 第三站：Raft、Quorum 与一致性

第三站旁听 Raft 会议。Leader 负责提案，Follower 负责跟随，Candidate 负责竞选；大家都知道“多数人同意”才算决定，少数派即使声音很大，也不能单独改集群历史。

**Leader、Follower 与 Candidate** ---- Follower 接收日志和投票请求，Candidate 在选举时拉票，Leader 发送心跳并复制日志；一个 term 内最多产生一个合法 Leader

**Term 与投票** ---- term 表示任期，每个成员在一个 term 中最多投一票；候选人的日志必须不比投票者旧，避免一个缺少已提交历史的节点赢得领导权

**RequestVote 与 AppendEntries** ---- RequestVote 用于选举，AppendEntries 同时承担心跳和日志复制；日志条目包含 term 与 index，前置条目不匹配时会回退并重新同步

**随机选举超时** ---- Follower 在一段时间没收到心跳就成为 Candidate，随机化超时减少平票；网络延迟、CPU 停顿和磁盘 fsync 都可能让合理的超时看起来“不够长”

**Quorum 与容错** ---- 2f+1 个投票成员最多容忍 f 个成员故障，3 节点容忍 1 个，5 节点容忍 2 个；跨可用区部署要保证多数派仍有低延迟网络和独立故障域

**日志匹配与提交** ---- Leader 通过 prevLogIndex、prevLogTerm 检查前缀一致，再复制新日志；多数派确认后条目提交，已提交历史必须出现在后续合法 Leader 上

**线性一致读** ---- 默认强读需要确认 Leader 仍拥有领导权并读取最新已提交状态；线性一致读提供“像只有一个副本”的时序感，但会付出协调与网络成本

**Serializable 读** ---- 可序列化读允许从本地成员更快返回，可能落后于最新提交；只适合明确接受陈旧读的场景，锁、选主和关键控制状态不能随意降级

**Learner 成员** ---- learner 可以复制数据但不参与投票，适合新成员先追平再提升为 voter；扩缩容要观察 learner lag、网络与磁盘，不要把未追平节点直接推上表决席

**成员变更** ---- member add、promote、remove 会改变 quorum 计算；一次只做一个关键变更，确认新配置已提交并可恢复，避免同时失去多数派

**脑裂与少数派** ---- 少数派无法提交新写入，宁可暂时不可用也不让两个分区各自形成真实历史；业务需要通过重试、缓存或降级处理这一段不可写窗口

## 第四站：KV、Watch、Lease 与事务

第四站是 etcd 的四把钥匙。Put 负责贴纸条，Watch 负责敲门，Lease 负责判断人还在不在，Txn 则负责说“只有条件满足才准改”；四者组合起来，才是协调能力的完整句子。

**Put、Range 与 Delete** ---- 掌握按 key 写入、精确读取、前缀读取、按 revision 读取和删除；删除也会产生事件与 revision，服务发现不能只处理 PUT 而忘记 DELETE

**Watch 流** ---- Watch 的输入和输出都是流，客户端可以创建、取消多个 watcher，服务端按事件发送 PUT/DELETE；一个 RPC 复用多个范围时要管理 watcher ID、取消和错误

**从 revision 开始 Watch** ---- 客户端可从指定 revision 订阅历史事件，断线后根据已处理的 revision 续接；如果起始 revision 已被 compact，服务端会提示历史不可用，客户端必须重新做全量同步

**Watch 的消费纪律** ---- Watch 是增量通知，不应当作永远不会断的消息队列；事件处理要幂等、按 revision 推进、处理断流和压缩错误，并保留从全量快照重建本地缓存的路径

**Progress Notify 与空闲连接** ---- 长时间没有变化时，进度通知可帮助客户端确认 watcher 仍在推进；网络、代理和负载均衡的空闲超时也要纳入 keepalive 设计

**Lease Grant 与 KeepAlive** ---- Grant 创建 TTL，KeepAlive 续租，key 绑定 lease 后随租约到期删除；续租线程要有超时、重连与告警，不能把“客户端进程还活着”误当作“租约一定还在”

**Lease 的粒度** ---- 一个 lease 可以挂多个 key，适合把同一服务实例的多个标记绑定到一次生命周期；不同业务对象要不要共享 lease，应根据失效原子性与续租压力决定

**Txn 的 If/Then/Else** ---- compare 条件成立执行 success，不成立执行 failure；比较 key 的 value、create_revision、mod_revision 或 version，即可构造原子条件写

**Compare-And-Swap** ---- 读取版本后带条件更新，版本不符就失败，这比“先读再无条件写”安全；冲突是正常并发信号，应返回给业务或按明确策略重试

**事务批量原子性** ---- 一个事务可以包含多个比较和操作，作为一次原子变更提交；事务过大、嵌套过深或每次写都带大量响应会增加 Leader、WAL 和 Watch 压力

**Txn 与 STM** ---- clientv3/concurrency 等库可在 Txn 之上封装软件事务内存、锁和选举；使用封装时仍要理解 lease、fencing、重试和会话失效，否则只是把复杂度藏到另一层

## 第五站：配置、发现、锁与 Kubernetes

第五站把四把钥匙用在真实房间。配置中心需要可回滚，服务发现需要活体标记，锁需要自动释放，Kubernetes 需要声明式状态；共同点是“状态很小，但错一次很贵”。

**配置中心** ---- 用前缀划分环境、应用和租户，应用启动先全量读取，再从某个 revision 建立 Watch 缓存；变更要有 schema 校验、灰度、审计、回滚和敏感字段保护

**服务注册发现** ---- 服务实例用 lease 绑定地址或元数据并持续 KeepAlive，客户端通过前缀读取并 Watch 删除事件；过期只说明租约失效，不等于业务连接已经优雅下线，调用端仍需超时和熔断

**分布式锁** ---- 通过 lease + Txn CAS 创建锁记录，持有者崩溃后 lease 释放；临界区执行前要考虑 fencing token 或 revision，防止旧持有者网络隔离后继续写资源

**Leader 选举** ---- 多个候选者竞争同一前缀下的有序记录，胜者负责单例任务，其余 Watch；重新接管前要确认旧 Leader 已失效或使用可验证的任期/栅栏，不能只依赖“我很久没收到心跳”

**Kubernetes 的关系** ---- kube-apiserver 是 Kubernetes 访问 etcd 的主要入口，Pod、Service、ConfigMap、Secret 等对象状态由控制面管理；业务不应绕过 API Server 随意修改 Kubernetes 的内部键

**控制器调谐循环** ---- Controller Watch 资源变化，比较期望状态与当前状态，再执行调谐；Watch、revision、幂等 reconcile 和最终一致的控制循环共同组成 Kubernetes 的运行方式

**Secret 与敏感信息** ---- etcd 中的 Secret 仍需考虑 TLS、权限、备份与磁盘保护；Kubernetes 的 Secret 加密配置、密钥轮换和访问审计属于控制面安全设计，不是“值放进 etcd 就自动加密”

**本地缓存与失效重建** ---- 配置和服务列表可在客户端维护快照，用 Watch 做增量；Watch 中断、compact、客户端重启和集群切换时必须能重新 Range 全量构建

**与 Redis 锁的边界** ---- etcd 通过 Raft、Txn、lease 和线性一致语义提供较强协调基础，Redis 更偏高吞吐数据结构与缓存；锁的选择要比较失效、fencing、可用性和延迟，不要只比较一行 API

## 第六站：集群部署、网络与安全边界

第六站开始搭集群。etcd 不怕你有三台机器，却很怕三台机器共用一个故障域、证书互不认识、端口全暴露；高可用不是把进程复制三份，而是把身份、网络和 quorum 一起安排好。

**投票节点数量** ---- 生产常用 3 或 5 个 voter，按故障域分布；节点越多，读写复制与选举通信成本越高，先根据容错目标和负载做选择

**客户端与对等端口** ---- 2379 通常承接客户端 API，2380 通常承接成员间 peer 通信；端口不是安全策略，防火墙、网络策略和监听地址要限制来源与暴露面

**静态与动态引导** ---- 静态 initial-cluster 适合首次创建，动态 member add 适合向已有集群加入成员；initial cluster state、cluster token、成员名称与 peer URL 不一致会造成难排查的启动问题

**节点身份与 peer URL** ---- 每个成员要有稳定名称、唯一 peer 地址和可解析的 advertised 地址；机器更换不能只复制旧配置，要确认 member ID、数据目录和证书 SAN 的关系

**Learner 加入流程** ---- 先加入 learner、观察同步进度、确认追平后再 promote；扩容期间要计算额外网络、磁盘和快照压力，避免新成员拖慢原有 quorum

**Peer TLS 与 Client TLS** ---- peer TLS 保护成员间复制与身份，client TLS 保护 API 访问；证书要覆盖 advertised 地址，启用校验与轮换，不能只做加密不验证对端身份

**认证与 RBAC** ---- 创建用户、角色并按 key 范围授权，启用认证后用最小权限访问；root 账号用于管理而不是应用，服务发现、配置读取和写入权限应分开

**网络与代理边界** ---- gRPC 长连接、HTTP/JSON gateway、反向代理和负载均衡可能引入空闲超时、HTTP/2、证书和重试问题；客户端应直连稳定 endpoint 集合或使用经过验证的代理

**时间与系统资源** ---- 时钟同步、CPU 调度、文件描述符、内存、磁盘吞吐和网络 MTU 都会影响心跳与复制；etcd 的时间参数不是系统资源不足时的万能创可贴

## 第七站：备份、维护、故障与容量

第七站是值班手册。etcd 的事故经常从“后端稍微胖了一点”发展成“集群只读”，再从“只读”发展成“Kubernetes 控制器集体失眠”；备份、压缩、指标和演练要在平静时准备。

**Snapshot Save** ---- 使用 etcdctl 或 API 保存快照，保存的时间点与集群状态要记录；快照应送到受保护、异地或对象存储，并验证校验和、权限和可读取性

**Snapshot Restore** ---- restore 会生成一个恢复用的新集群拓扑，快照之后的写入不会出现在恢复结果中；恢复前明确 RPO/RTO、客户端 endpoint、成员配置和停机切换步骤

**恢复演练** ---- 不能只确认命令返回成功，要启动恢复集群、检查 revision、权限、关键前缀、应用连接和 Watch 重建；演练后清理临时集群与凭证，避免误连生产

**自动压缩** ---- 按时间或 revision 配置自动 compact，保留业务需要的历史窗口；配置太激进会让断线客户端无法续 Watch，配置太保守则会让后端持续膨胀

**Defrag 计划** ---- compact 删除逻辑历史，defrag 回收文件空间，二者解决不同问题；defrag 会逐成员产生压力，先观察 leader 与 quorum，再按成员错峰执行

**NOSPACE 告警** ---- 后端达到 quota-backend-bytes 后可能触发 NOSPACE alarm，集群进入保护性只读状态；处置通常包括确认写入源、执行安全 compact、按计划 defrag、解除告警并验证写入，不能只删除几个当前 key

**关键监控指标** ---- 观察是否有 Leader、Leader 变更次数、raft commit/apply 延迟、WAL fsync 延迟、后端大小、数据库碎片、请求失败、Watch 数、成员健康和磁盘空间；指标要能关联到节点、租户和时间窗口

**客户端延迟与拒绝** ---- 记录 RPC 延迟、超时、deadline exceeded、compacted、采样失败和重试次数；客户端重试若没有退避、抖动和幂等边界，会把已经拥塞的集群推得更拥塞

**容量预算** ---- 估算 key/value 大小、每秒事务数、revision 增长、历史保留、Watch 扇出、快照大小、磁盘余量与恢复时间；etcd 的容量上限不仅是磁盘字节，也包括内存、网络和控制面响应时间

**写入放大** ---- 一次业务变更可能产生 Raft 日志、WAL fsync、后端页写、MVCC 历史、Watch 事件和快照成本；批量事务可以减少固定开销，但过大的事务会增加单次阻塞和恢复压力

**故障排查顺序** ---- 先看 endpoint health/status 和 leader，再看网络、fsync、成员落后、后端大小、告警与客户端错误；不要看到 leader 变化就先把 election timeout 调大

**常见故障演练** ---- 演练单成员掉线、Leader 切换、磁盘延迟、网络分区、证书过期、Watch 从 compacted revision 恢复、NOSPACE 只读和 snapshot restore；每次记录发现、保护、恢复和数据边界

## 第八站：客户端、生态与选型

最后一站学习如何把钥匙交给应用。etcd 的 API 很简洁，客户端却不能“连上就算完”：每个请求都要有 deadline，Watch 要能重建，租约要有续租监控，endpoint 变化要有策略。

**Go clientv3** ---- 了解 clientv3 的 KV、Watcher、Lease、Maintenance、Cluster、Auth 与 concurrency 能力；每个调用使用 context deadline，关闭客户端并正确消费流与错误

**Java jetcd 与其他客户端** ---- jetcd 等客户端应核对 v3 API、gRPC、TLS、重试和 Watch 语义；不要把不同语言客户端的默认超时、连接池和取消行为想当然地当成一致

**Endpoint 选择** ---- 客户端配置多个 endpoint，能处理 Leader 变化、成员暂时不可用和 DNS/负载均衡故障；连接重试需要指数退避与抖动，不能形成客户端惊群

**Watch 客户端状态机** ---- 维护已处理 revision、watch ID、恢复中的标志和本地快照；遇到 compacted、canceled、网络错误或响应通道关闭时，按全量同步加新 revision 重新建立

**事务与锁库** ---- 优先使用经过验证的 concurrency 封装，再为业务补 fencing、幂等和超时；释放锁不是临界区成功的证明，客户端崩溃、网络隔离和旧持有者都要纳入设计

**HTTP/JSON 网关** ---- gRPC gateway 方便 curl、脚本和调试，但长 Watch、二进制 value、代理超时和认证头要额外验证；生产控制面不应因为“浏览器能访问”就开放给公网

**Kubernetes 运维生态** ---- 了解 kube-apiserver、etcdctl、定时快照、对象存储、监控系统和控制面高可用的关系；Kubernetes 场景下优先遵循发行版与官方运维流程，不直接修改内部 key

**与 ZooKeeper、Consul 比较** ---- etcd 以 Raft、MVCC、revision、lease 和可续接 Watch 为核心，ZooKeeper 以 ZAB、znode、session 和传统协调配方见长，Consul 更强调服务发现、健康检查和多数据中心；选型要看数据模型、生态和运维边界

**何时不选 etcd** ---- 不需要强一致协调时，简单配置可用更轻的方案；需要海量时序、全文搜索、业务事务或大对象时，应选择专门系统；把 etcd 当万能数据库，会把它最珍贵的可靠性消耗在不擅长的工作上

## 通关标准

能独立解释 key、prefix、revision、CreateRevision、ModRevision、Version、lease 与 MVCC 的关系；画出 Raft 选举、日志复制、quorum 提交、WAL、快照与状态机应用的路径；用 etcdctl 或客户端完成前缀读写、从指定 revision Watch、租约续租和 Txn CAS；设计一个可自动释放且带 fencing 思路的锁或选主流程；能部署 3 节点集群，配置 peer/client TLS 与 RBAC；完成 snapshot save/restore、compact、defrag 和 NOSPACE 处置演练；从 leader 变化、fsync 延迟、成员落后、Watch 断流和后端膨胀中定位证据；按 RPO/RTO、revision 增长、Watch 扇出、磁盘和恢复窗口做容量预算。达到这些标准，才算真正读懂 etcd，而不是只会把 key 塞进去。

## 下一站去哪

如果你的目标是理解云原生控制面，下一站去看 [Kubernetes](/learning-paths/devops/kubernetes)；如果想比较另一套经典协调原语，回到 [ZooKeeper 学习路线](/learning-paths/middleware/zookeeper)；如果要把一致性能力放进服务治理，再看 [微服务架构](/learning-paths/architecture/microservices/patterns) 与可观测性方向。

## 结语

etcd 的迷人之处在于它把分布式一致性落到了可以操作的细节：Raft 决定谁能提交，MVCC revision 记录变化，Watch 传播变化，Lease 描述生命，Txn 保护条件。学会这些之后，你会更清楚为什么 Kubernetes 依赖它，也会更敏锐地发现什么时候应该给它减负、做备份、留余量，而不是继续往这个小保险柜里塞更多东西。
