# etcd 学习路线

etcd 是云原生时代的分布式协调服务，Kubernetes 的"大脑"，CoreOS 团队的杰作。它基于 Raft 协议，提供强一致性、高可用性，API 简洁优雅，是新一代分布式系统的基石。这条路线会带你从 Raft 协议到数据模型，从 Watch 机制到 Lease 租约，从单机部署到生产集群。

## 基础篇：架构与核心概念

> 📖 笔记：[Etcd](/study-notes/middleware/etcd/etcd)

### etcd 的定位
- 分布式 KV 存储：强一致性键值数据库
- 配置中心：统一配置管理，动态更新
- 服务发现：服务注册与健康检查
- 分布式锁：基于 Lease 和 Transaction 实现
- Leader 选举：基于 Lease 实现
- Kubernetes 后端存储：存储所有集群状态

### etcd vs ZooKeeper
- 协议：etcd 用 Raft，ZooKeeper 用 ZAB（Raft 更易理解和证明）
- 语言：etcd 是 Go，ZooKeeper 是 Java（etcd 更轻量）
- API：etcd 用 gRPC/HTTP，ZooKeeper 用自定义协议
- Watch：etcd 持久化，ZooKeeper 一次性（需重复注册）
- 事务：etcd 更强大（支持 CAS、STM）
- 生态：etcd 是云原生标配，ZooKeeper 是大数据生态标配

### etcd 的架构
- 集群模式：奇数节点（3/5/7），推荐 3 或 5
- Leader：处理所有写请求、心跳、日志复制
- Follower：转发写请求到 Leader、参与投票、处理读请求
- Candidate：选举中的候选节点
- 客户端：gRPC 连接任意节点

### Raft 协议基础
- 三种角色：Leader、Follower、Candidate
- 两个 RPC：RequestVote（投票）、AppendEntries（心跳 + 日志复制）
- 三个阶段：Leader Election、Log Replication、Safety
- 强一致性：线性一致性（Linearizability）
- 容错能力：2f+1 个节点容忍 f 个节点故障

### 数据模型
- 树形结构：键是路径（/app/config）
- 版本化：每次修改 Revision 递增（全局唯一单调递增）
- MVCC（多版本并发控制）：保留历史版本
- Key-Value：键值对（Value 是二进制数据）
- Revision：全局版本号，每次修改 +1
- ModRevision：键的修改版本
- CreateRevision：键的创建版本
- Version：键的修改次数

## Raft 协议深入篇

### Leader 选举
- 触发时机：集群启动、Leader 心跳超时、Follower 心跳超时
- Term（任期）：选举轮次，单调递增
- 选举流程：Follower 超时 → Candidate → 发起投票 → 获得多数票 → 成为 Leader
- 投票规则：每个 Term 只能投一票、先到先得、日志至少和自己一样新
- 随机超时：避免同时发起选举（150-300ms）
- Split Vote：平票则重新选举（新 Term）

### 日志复制
- AppendEntries RPC：Leader 向 Follower 复制日志
- 日志项：Term + Index + Command
- 提交（Commit）：多数节点复制成功
- 应用（Apply）：提交后应用到状态机
- 日志匹配：如果两个日志条目有相同的 Index 和 Term，则它们之前的日志完全相同
- 一致性检查：AppendEntries 携带 prevLogIndex 和 prevLogTerm

### 安全性保证
- Election Safety：每个 Term 最多一个 Leader
- Leader Append-Only：Leader 只能追加日志，不能删除或覆盖
- Log Matching：日志匹配特性
- Leader Completeness：已提交的日志一定在未来的 Leader 上
- State Machine Safety：已应用到状态机的命令不会改变

### 日志压缩（Snapshot）
- 问题：日志无限增长，占用空间和恢复时间
- 解决：快照 + 日志截断
- 快照内容：状态机当前状态 + 元数据（lastIncludedIndex、lastIncludedTerm）
- 何时快照：日志达到一定大小（--snapshot-count）
- 快照传输：InstallSnapshot RPC（慢节点恢复）

### 成员变更
- 单步变更：每次只添加或移除一个节点（Raft 原始论文）
- 联合一致性（Joint Consensus）：两阶段提交（etcd 实现）
- 自动化：etcd member add/remove 命令
- Learner 节点：只接收日志，不参与投票（3.4+）

## 核心功能篇

### Key-Value API
- Put：写入或更新键值
- Get：读取键值
- Delete：删除键值
- Range：范围查询（按前缀、按范围）
- Transaction（Txn）：事务，CAS 操作
- Compact：压缩历史版本

### Watch 机制
- 持久化 Watch：一次注册，持续监听
- 历史事件：从指定 Revision 开始监听（不丢事件）
- 事件类型：PUT、DELETE
- 事件内容：Key、Value、PrevValue、Revision
- 范围 Watch：监听前缀或范围
- 客户端缓存：配合 Watch 实现本地缓存

### Lease（租约）
- TTL：生存时间，到期自动删除关联的 Key
- KeepAlive：续租，保持 Lease 存活
- 应用场景：服务注册（心跳）、分布式锁（超时释放）、临时数据
- Lease ID：唯一标识租约
- 关联 Key：Put 时指定 Lease ID
- 自动续租：客户端自动 KeepAlive

### Transaction（事务）
- Compare（比较）：条件判断（Version、ModRevision、Value）
- Success：条件成立执行的操作
- Failure：条件不成立执行的操作
- 原子性：Compare + Success/Failure 原子执行
- CAS：Compare-And-Swap 实现乐观锁
- 多操作：一个 Txn 可以包含多个 Put/Get/Delete

### MVCC（多版本并发控制）
- 历史版本：保留所有历史版本
- Revision：全局版本号，单调递增
- 快照隔离：读取某个 Revision 的快照
- 时间旅行：查询历史版本
- Compact：压缩历史版本，释放空间
- 自动压缩：--auto-compaction-mode（periodic/revision）

### 线性一致性读
- 强一致性：读取到最新提交的数据
- 实现方式：ReadIndex、Lease Read
- ReadIndex：Leader 确认自己仍是 Leader（多数节点心跳）
- Lease Read：Leader 基于心跳租约判断（更快，但有时钟漂移风险）
- 串行化读：所有读请求走 Raft（最慢，强一致）

### 一致性保证
- Linearizability：线性一致性（默认）
- Serializability：串行化（可配置）
- 读写分离：Follower 可处理读（可能读到旧数据）
- Stale Read：明确读取旧数据（低延迟）

## 应用场景篇

### 配置中心
- 场景：统一配置管理、动态更新
- 方案：配置存储在 etcd，应用 Watch 监听变化
- 热更新：配置变更自动推送到应用
- 版本管理：通过 Revision 实现配置回滚
- 灰度发布：不同服务读取不同配置前缀

### 服务发现
- 服务注册：服务启动时写入 Key（关联 Lease）
- 健康检查：定期 KeepAlive，失败则 Key 自动删除
- 服务发现：客户端 Get + Watch 服务列表
- 负载均衡：客户端本地负载均衡
- 故障转移：服务宕机，Key 自动删除，客户端感知

### 分布式锁
- 实现方式：Lease + Transaction
- 加锁：Create Key with Lease（CAS 检查 Key 不存在）
- 解锁：Delete Key（CAS 检查 Lease 匹配）
- 超时释放：Lease 到期自动释放
- 避免死锁：Lease 超时机制
- 公平锁：通过前缀 + Revision 实现 FIFO

### Leader 选举
- 场景：主备切换、单例服务
- 方案：多个节点竞争创建同一 Key（关联 Lease）
- 成功者：创建成功的成为 Leader
- 失败者：Watch Key，等待 Leader 释放
- Leader 保活：定期 KeepAlive
- Leader 切换：Lease 到期，新节点竞争

### Kubernetes
- API Server 后端存储：所有集群状态存储在 etcd
- 资源对象：Pod、Service、ConfigMap 等
- Watch 机制：Controller 监听资源变化
- 高可用：etcd 集群保证 Kubernetes 集群可用性
- 数据量：大集群可达 GB 级别

## 集群管理篇

### 集群部署
- 节点数量：奇数（3/5/7），推荐 3 节点（中小集群）或 5 节点（大集群）
- 配置方式：静态配置（配置文件）、动态配置（etcd member add）
- 端口：2379（客户端）、2380（集群内通信）
- 初始化：--initial-cluster、--initial-cluster-state（new/existing）
- TLS：--cert-file、--key-file、--trusted-ca-file

### 节点角色
- Leader：唯一的写入节点，处理所有写请求
- Follower：参与投票、复制日志、处理读请求
- Learner（3.4+）：只接收日志，不参与投票（用于新节点同步数据）

### 集群配置
- heartbeat-interval：心跳间隔（默认 100ms）
- election-timeout：选举超时（默认 1000ms）
- snapshot-count：日志条数达到该值触发快照（默认 100000）
- quota-backend-bytes：数据库大小配额（默认 2GB）
- max-request-bytes：单个请求最大字节数（默认 1.5MB）

### 集群扩缩容
- 添加节点：etcd member add → 启动新节点（--initial-cluster-state=existing）
- 移除节点：etcd member remove
- Learner 模式：先添加为 Learner，同步完成后提升为 Follower
- 替换节点：remove 旧节点 → add 新节点
- 注意：扩缩容期间集群仍然可用（Raft 保证）

### 数据备份
- 快照备份：etcdctl snapshot save
- 增量备份：不支持（只能全量快照）
- 备份频率：定期备份（如每天）
- 备份存储：本地、NFS、S3
- 恢复：etcdctl snapshot restore（重建集群）

### 数据恢复
- 场景：数据损坏、误删除、灾难恢复
- 恢复步骤：停止所有节点 → 从快照恢复 → 启动集群
- 恢复后：Revision 不变，但 memberID 改变
- 注意：恢复是破坏性操作，会丢失快照后的数据

## 性能优化篇

### 客户端优化
- 连接池：复用连接
- 批量操作：减少网络往返（Txn 批量写入）
- 本地缓存：Watch + 本地缓存，减少读取
- 读写分离：读请求连接 Follower
- 超时设置：合理设置 context timeout

### 服务端优化
- SSD：使用 SSD 提升 IO 性能
- 独立磁盘：WAL 和数据目录分开（--wal-dir）
- 内存：增大堆内存（Go GC 压力）
- 快照频率：调整 --snapshot-count（默认 10 万）
- 压缩策略：定期 Compact（清理历史版本）
- 碎片整理：定期 Defrag（压缩存储空间）

### 网络优化
- 低延迟网络：etcd 对延迟敏感（<10ms）
- 带宽：足够的带宽（快照传输、日志复制）
- 就近部署：减少跨机房延迟
- 心跳调优：高延迟网络增大 election-timeout

### 存储优化
- 限制数据大小：单个 Value < 1MB（建议 < 1KB）
- Key 数量：避免过多 Key（单集群 < 100 万）
- 定期压缩：--auto-compaction-mode=periodic
- 碎片整理：定期 etcdctl defrag
- Quota：设置 quota-backend-bytes 防止数据库过大

### Watch 优化
- 减少 Watch：避免过多 Watch
- 范围 Watch：使用前缀 Watch 替代多个单 Key Watch
- 断开重连：客户端自动重连
- Buffer 大小：调整 Watch 缓冲区

## 监控运维篇

### 监控指标
- 集群健康：成员状态、Leader 存在
- 性能指标：QPS、延迟（P99）、吞吐量
- 存储：数据库大小、WAL 大小、快照大小
- Raft：Leader 变更次数、心跳失败次数、日志复制延迟
- 系统：CPU、内存、磁盘 IO、网络

### Prometheus 集成
- Metrics 端点：/metrics（默认 2379 端口）
- 关键指标：etcd_server_has_leader、etcd_server_proposals_failed_total、etcd_disk_wal_fsync_duration_seconds
- Grafana：官方 Dashboard（3070）
- 告警：Leader 切换、高延迟、磁盘满

### 日志分析
- 日志级别：debug、info、warn、error
- 日志格式：JSON 或纯文本
- 关键日志：elected leader、lost leader、failed to heartbeat
- 日志收集：集中式日志系统（ELK、Loki）

### 常见问题排查
- 集群脑裂：网络分区导致（检查网络、节点数）
- Leader 频繁切换：网络延迟、磁盘慢、高负载
- 数据库大小超限：quota-backend-bytes 限制（需 Compact + Defrag）
- 高延迟：磁盘慢、网络差、负载高
- 连接失败：TLS 配置、防火墙、认证

### 安全加固
- TLS：客户端 TLS、集群内 TLS
- 认证：用户名密码、证书
- 授权：RBAC（Role-Based Access Control）
- 角色：root、自定义角色
- 权限：Read、Write、ReadWrite
- 审计：操作日志审计

## 客户端使用篇

### etcdctl 命令行
- put：写入键值
- get：读取键值
- del：删除键值
- watch：监听键变化
- lease grant：创建租约
- lease revoke：撤销租约
- lease keep-alive：续租
- member list：集群成员
- endpoint health：健康检查
- snapshot save：备份
- defrag：碎片整理

### Go 客户端（clientv3）
- 连接：clientv3.New()
- Put：kv.Put(ctx, key, value)
- Get：kv.Get(ctx, key)
- Watch：watcher.Watch(ctx, key)
- Lease：lease.Grant(ctx, ttl)
- Transaction：kv.Txn(ctx).If(...).Then(...).Else(...).Commit()
- 最佳实践：使用 context 超时、错误处理、连接池

### 其他语言客户端
- Java：jetcd
- Python：etcd3、python-etcd
- Node.js：node-etcd
- Rust：etcd-client

### gRPC Gateway
- HTTP/JSON API：通过 gRPC Gateway 暴露 RESTful API
- 端点：/v3/kv/put、/v3/kv/range、/v3/watch
- 适用场景：非 gRPC 客户端
- 性能：比原生 gRPC 稍慢

## 生态与实践篇

### Kubernetes 集成
- kubeadm：默认部署 etcd（stacked 模式）
- 外部 etcd：高可用集群（external 模式，推荐）
- 备份：定期备份 etcd 数据
- 恢复：灾难恢复流程
- 监控：etcd 是 K8s 集群的关键组件

### 服务网格
- Istio：早期版本使用 etcd（后改为其他存储）
- Consul：类似 etcd 的服务发现（不基于 Raft）
- CoreDNS：使用 etcd 作为后端存储

### 配置中心
- confd：基于 etcd 的配置管理工具
- Apollo：支持 etcd 作为配置后端
- Spring Cloud Config：可集成 etcd

### 分布式锁库
- etcd/clientv3/concurrency：官方分布式锁库
- 互斥锁：Mutex
- 读写锁：RWMutex
- 选举：Election

## 下一步学习

掌握 etcd 后，你可以：
- **深入 Raft 协议**：阅读论文《In Search of an Understandable Consensus Algorithm》
- **对比 Consul**：另一个服务发现和配置中心
- **学习 ZooKeeper**：理解 ZAB 协议和经典分布式协调
- **研究 Paxos**：更早的一致性协议（Raft 的前身）
- **探索 TiKV**：分布式事务 KV 存储（基于 Raft + RocksDB）
- **实践云原生**：深入 Kubernetes、Service Mesh

etcd 是云原生时代的协调服务，它的简洁优雅让分布式一致性不再神秘。从配置中心到服务发现，从分布式锁到 Leader 选举，etcd 都能优雅胜任。掌握 etcd，你就掌握了云原生的"神经中枢"。Happy coordinating！
