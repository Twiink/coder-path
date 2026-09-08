# ZooKeeper 学习路线

ZooKeeper 是分布式协调服务的"老大哥"，从 Hadoop 生态到 Kafka、Dubbo，它是分布式系统的"神经中枢"。虽然被 etcd、Consul 等新秀挑战，但其 ZAB 协议、成熟稳定的架构仍是分布式协调的经典。这条路线会带你从 ZAB 协议到数据模型，从节点类型到典型应用。

## 基础篇：架构与核心概念

> 📖 笔记：[ZooKeeper 与分布式协调](/study-notes/middleware/zookeeper/zookeeper-coordination)

### ZooKeeper 的定位
- 不是数据库：存储少量元数据（< 1MB/节点）
- 不是消息队列：不适合高吞吐消息传递
- 是协调服务：配置管理、命名服务、分布式锁、集群管理、Leader 选举
- 类文件系统：树形目录结构（ZNode）
- 强一致性：CP 模型（一致性优于可用性）

### ZooKeeper 的架构
- 集群模式：Leader + Follower + Observer（奇数节点，3/5/7）
- Leader：处理写请求、发起投票、协调 Follower
- Follower：处理读请求、参与投票、参与写请求的提交
- Observer：只读节点，不参与投票（扩展读性能）
- 客户端：连接任意节点，读本地、写转发 Leader

### ZAB 协议（ZooKeeper Atomic Broadcast）
- 原子广播协议：保证分布式数据一致性
- 两种模式：恢复模式（选举 Leader）、广播模式（同步数据）
- 与 Paxos 的关系：类似但不同，更简单易实现
- 与 Raft 的对比：ZAB 更早，Raft 更易理解

### 数据模型：ZNode
- 树形结构：类似文件系统（/app/config）
- 节点类型：持久（Persistent）、临时（Ephemeral）、顺序（Sequential）
- 节点数据：每个节点存储少量数据（默认 < 1MB）
- 节点属性：版本号（version）、ACL、时间戳、数据长度
- 路径：绝对路径，不支持相对路径

### ZNode 类型详解
- 持久节点（PERSISTENT）：显式删除才消失
- 临时节点（EPHEMERAL）：会话结束自动删除（不能有子节点）
- 持久顺序节点（PERSISTENT_SEQUENTIAL）：自动追加序号
- 临时顺序节点（EPHEMERAL_SEQUENTIAL）：临时 + 顺序
- 容器节点（CONTAINER，3.5+）：子节点全删除后自动删除
- TTL 节点（TTL，3.5+）：超时自动删除

### 版本与 CAS
- dataVersion：数据版本号
- cversion：子节点版本号
- aclVersion：ACL 版本号
- 乐观锁：setData(path, data, version) 实现 CAS
- 版本冲突：-1 表示无条件更新

## ZAB 协议深入篇

### Leader 选举（Fast Leader Election）
- 触发时机：集群启动、Leader 宕机
- 投票信息：(myid, zxid)（节点 ID、事务 ID）
- 选举规则：zxid 大的优先，相同则 myid 大的优先
- 过半原则：超过半数投票即选举成功
- epoch：选举轮次，防止脑裂

### ZXID（ZooKeeper Transaction ID）
- 64 位事务 ID：高 32 位是 epoch，低 32 位是递增计数
- epoch：Leader 任期，每次选举 +1
- counter：每次事务 +1
- 保证全局有序：单调递增
- 用途：数据版本、选举依据

### 恢复模式（Recovery）
- 场景：集群启动或 Leader 失效
- 步骤：选举 Leader → 同步数据 → 进入广播模式
- 数据同步：Follower 从 Leader 同步最新数据
- 两个保证：已提交的不丢、未提交的不执行

### 广播模式（Broadcast）
- 两阶段提交（简化版 2PC）：Propose + Commit
- 写请求流程：Client → Leader → Propose → Follower ACK → Leader Commit → Follower Commit
- 过半即提交：超过半数 Follower ACK 即可提交
- 顺序保证：FIFO 队列保证顺序
- 异步通知：Leader 异步通知 Follower Commit

### 会话（Session）
- 会话建立：客户端连接任意节点
- 会话超时：sessionTimeout（客户端指定，服务端限制）
- 心跳机制：tickTime 心跳检测
- 会话迁移：节点故障后自动重连其他节点
- 会话状态：CONNECTING、CONNECTED、CLOSED

### 数据同步策略
- DIFF：增量同步（Leader 和 Follower 差异小）
- TRUNC：截断后同步（Follower 数据超前）
- SNAP：快照同步（差异太大，全量同步）
- 同步完成：Follower 进入 SYNC 状态

## 核心功能篇

### Watcher 机制
- 一次性触发：触发一次后自动移除（需要重新注册）
- 事件类型：NodeCreated、NodeDeleted、NodeDataChanged、NodeChildrenChanged
- 通知顺序：先到达服务端的先通知
- 不保证实时：网络延迟可能导致通知延迟
- 轻量级：只通知事件发生，不传递数据（需要再次 getData）

### ACL（Access Control List）
- 权限控制：CREATE、READ、WRITE、DELETE、ADMIN
- 认证方式：world（任何人）、auth（已认证）、digest（用户名密码）、ip（IP 地址）
- 继承关系：子节点不继承父节点 ACL
- 示例：create /secure data digest:username:password crwda

### 分布式锁
- 排他锁（Exclusive Lock）：创建临时节点，存在则等待，节点删除释放
- 共享锁（Shared Lock）：读锁可并发，写锁排他
- 顺序锁：创建临时顺序节点，序号最小的获得锁
- 羊群效应：大量客户端同时监听同一节点（用顺序节点解决）
- 公平性：顺序节点保证 FIFO

### 配置中心
- 场景：分布式系统统一配置管理
- 方案：配置存储在 ZNode，客户端监听变化
- 动态更新：Watch 机制实现配置热更新
- 版本管理：通过 version 实现 CAS 更新

### 命名服务
- 场景：服务注册发现
- 方案：服务节点创建临时节点，客户端监听子节点变化
- 自动下线：服务宕机，临时节点自动删除
- 负载均衡：客户端获取所有服务节点，本地负载均衡

### 集群管理
- 场景：监控集群节点状态
- 方案：节点创建临时节点，监听子节点变化
- 节点上下线：Watch 通知
- Leader 选举：最小顺序节点成为 Leader

### 队列
- FIFO 队列：顺序节点实现
- 优先级队列：节点名称包含优先级
- 局限性：不适合高吞吐队列（性能不如专业 MQ）

## 集群管理篇

### 集群部署
- 节点数量：奇数（3/5/7），推荐 3 或 5
- 配置文件：zoo.cfg（tickTime、dataDir、clientPort、server.x）
- myid 文件：dataDir/myid，唯一标识节点
- 端口：2181（客户端）、2888（Follower 连 Leader）、3888（选举）

### 节点配置
- tickTime：心跳时间单位（默认 2000ms）
- initLimit：Follower 连接 Leader 超时（10 * tickTime）
- syncLimit：Follower 同步 Leader 超时（5 * tickTime）
- dataDir：数据目录
- dataLogDir：事务日志目录（建议独立磁盘）
- clientPort：客户端连接端口

### Observer 节点
- 作用：扩展读性能，不参与投票
- 配置：server.x:host:port:port:observer
- 适用场景：跨机房部署、大量读请求
- 局限性：数据同步有延迟

### 集群扩缩容
- 扩容：添加节点、重启集群（动态配置需 3.5+）
- 缩容：移除节点、更新配置、重启
- 动态配置（3.5+）：reconfig 命令在线修改配置
- 数据迁移：ZooKeeper 无需手动迁移（自动同步）

### 四字命令（Four Letter Words）
- stat：服务器状态
- ruok：是否正常（返回 imok）
- conf：配置信息
- cons：连接信息
- mntr：监控信息（配合监控系统）
- srvr：服务器信息
- wchs/wchc/wchp：Watcher 信息

### 集群监控
- JMX：Java 管理扩展，暴露监控指标
- Prometheus + Grafana：监控告警
- 监控指标：请求 QPS、延迟、连接数、Leader 选举次数、数据大小
- 日志：zookeeper.out 查看错误日志

## 性能优化篇

### 客户端优化
- 连接池：复用连接（Curator 框架内置）
- 批量操作：multi 命令（类似事务，原子性）
- 本地缓存：缓存热点数据，减少查询
- Watch 优化：避免过多 Watch，及时移除
- 会话超时：合理设置 sessionTimeout

### 服务端优化
- 独立磁盘：dataLogDir 放 SSD
- 内存：增大堆内存（默认 1GB）
- Snapshot：定期快照，减少事务日志
- 事务日志清理：autopurge.snapRetainCount、autopurge.purgeInterval
- 限流：maxClientCnxns 限制单 IP 连接数

### 网络优化
- 本地优先：客户端连接最近的节点
- 跨机房：使用 Observer 节点
- 网络分区：避免脑裂（奇数节点 + 过半原则）

### 数据优化
- 节点数量：单个父节点子节点数 < 10000
- 节点大小：单个节点数据 < 1MB（建议 < 1KB）
- 路径长度：避免过深的路径
- 临时节点：大量临时节点影响性能
- 定期清理：删除无用节点

### 避免的反模式
- 存储大量数据：ZooKeeper 不是数据库
- 高频写入：写入性能有限（< 1000 TPS）
- 作为消息队列：不适合高吞吐场景
- 过多 Watch：影响性能
- 单一热点节点：大量客户端同时访问

## 客户端框架篇

### 原生 API
- 连接：new ZooKeeper(connectString, sessionTimeout, watcher)
- 创建：create(path, data, acl, createMode)
- 读取：getData(path, watch, stat)
- 更新：setData(path, data, version)
- 删除：delete(path, version)
- 子节点：getChildren(path, watch)
- 问题：连接管理复杂、Watch 需要重复注册、异常处理繁琐

### Curator 框架
- Apache 顶级项目：ZooKeeper 的高级客户端
- 连接管理：自动重连、会话管理
- Recipes：分布式锁、Leader 选举、分布式队列、缓存
- Fluent API：链式调用，更易用
- 推荐：生产环境优先使用 Curator

### Curator Recipes
- InterProcessMutex：可重入分布式锁
- InterProcessReadWriteLock：读写锁
- LeaderSelector：Leader 选举（可释放）
- LeaderLatch：Leader 选举（持有到断开）
- DistributedQueue：分布式队列
- PathChildrenCache：节点缓存（自动更新）
- NodeCache：单节点缓存
- TreeCache：树缓存（递归监听）

### 其他框架
- ZkClient：简化 API，自动重连
- Spring Cloud ZooKeeper：Spring Cloud 集成
- Dubbo：服务注册发现
- Kafka：依赖 ZooKeeper（2.8 开始可去 ZooKeeper）

## 典型应用篇

### Hadoop 生态
- HDFS HA：NameNode 主备切换
- YARN：ResourceManager HA
- HBase：Master 选举、RegionServer 管理

### Kafka（2.8 之前）
- Broker 注册：临时节点存储 Broker 信息
- Topic 注册：Topic 和分区信息
- Controller 选举：Controller 管理集群
- Offset 存储：早期版本存储消费位移（后移至 Kafka）

### Dubbo
- 服务注册：Provider 创建临时节点
- 服务发现：Consumer 监听 Provider 节点
- 配置中心：统一配置管理
- 路由规则：动态路由配置

### 分布式锁
- 独占锁：单一资源互斥访问
- 读写锁：读共享、写互斥
- 分段锁：按 Key 分段，降低冲突
- 红包、秒杀：防止超卖

### 配置中心
- Apollo：携程开源配置中心（支持 ZooKeeper）
- Nacos：阿里开源配置中心
- Spring Cloud Config：Spring 生态配置中心

## 故障排查篇

### 常见问题
- 连接超时：网络问题、防火墙、节点宕机
- 会话过期：网络抖动、GC 停顿、sessionTimeout 过短
- 数据不一致：脑裂、网络分区
- Leader 频繁切换：网络不稳定、磁盘慢
- 内存溢出：节点数过多、数据过大

### 日志分析
- zookeeper.out：主日志文件
- 错误日志：Exception、Error 关键字
- 选举日志：LOOKING、FOLLOWING、LEADING
- 事务日志：dataLogDir/version-2/log.*
- 快照：dataDir/version-2/snapshot.*

### 监控告警
- 集群状态：Leader 存在、节点数量
- 性能指标：QPS、延迟（P99）
- 连接数：客户端连接数
- 数据大小：节点数、数据总量
- GC：Full GC 次数和时长
- 磁盘：事务日志和快照大小

### 数据恢复
- 数据丢失：从快照恢复
- 数据损坏：清空 dataDir 重新加入集群
- 误删节点：从备份恢复（无自动备份，需自己备份）

## ZooKeeper vs etcd

### 对比维度
- 协议：ZooKeeper 用 ZAB，etcd 用 Raft（Raft 更易理解）
- 语言：ZooKeeper 是 Java，etcd 是 Go（更轻量）
- API：ZooKeeper 是自定义协议，etcd 是 gRPC + HTTP
- Watch：ZooKeeper 一次性，etcd 持久化（更方便）
- 事务：etcd 更强大（支持 STM）
- 性能：etcd 写入性能更高

### 选择建议
- 已有 ZooKeeper：继续用（成熟稳定）
- 新项目：优先考虑 etcd（现代化、Kubernetes 生态）
- Hadoop 生态：ZooKeeper 是标配
- 云原生：etcd 是标配（K8s）

## 下一步学习

掌握 ZooKeeper 后，你可以：
- **学习 etcd**：Raft 协议、云原生生态
- **研究 Consul**：服务网格、多数据中心
- **深入 Raft/Paxos**：分布式一致性协议
- **学习 Chubby**：Google 的分布式锁服务（ZooKeeper 的灵感来源）
- **探索 Nacos**：阿里云原生配置中心 + 注册中心
- **实践 CAP 理论**：一致性、可用性、分区容错的权衡

ZooKeeper 是分布式协调的经典，虽然已有新秀挑战，但其成熟度和生态仍是宝贵财富。理解 ZooKeeper，就理解了分布式系统协调的精髓。Happy coordinating！
