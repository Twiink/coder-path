# Redis 深入学习路线

Redis 不仅仅是个缓存，它是内存数据库、消息队列、分布式锁、排行榜引擎、地理位置服务...几乎是万能的瑞士军刀。从单机到主从、哨兵、集群，从简单的 String 到复杂的 Stream，Redis 的每个特性都值得深挖。这条路线会带你从数据结构源码到分布式架构，从性能调优到生产实践。

## 数据结构深入篇

### String 的底层实现
- SDS（Simple Dynamic String）：不是 C 字符串，是动态字符串
- 结构：len（长度）+ free（剩余空间）+ buf（字节数组）
- 二进制安全：可存储任意二进制数据，不以 \0 结尾
- 预分配策略：< 1MB 翻倍，> 1MB 每次增加 1MB
- 惰性释放：缩短字符串时不立即回收内存
- 三种编码：int（整数）、embstr（<= 44 字节）、raw（> 44 字节）

### List 的底层实现
- 3.2 之前：ziplist（压缩列表）+ linkedlist（双向链表）
- 3.2 之后：quicklist（快速列表）= ziplist + linkedlist 的混合
- ziplist：连续内存块，节省内存，但插入删除慢
- quicklist：ziplist 的双向链表，平衡内存和性能
- list-max-ziplist-size：控制每个节点的大小（负数表示字节，正数表示个数）
- list-compress-depth：首尾不压缩的节点数（中间节点 LZF 压缩）

### Hash 的底层实现
- ziplist：元素少时使用（hash-max-ziplist-entries < 512）
- hashtable：元素多时升级为哈希表
- 渐进式 rehash：扩容时分批迁移，避免阻塞
- rehash 触发：负载因子 > 1（无 BGSAVE）或 > 5（有 BGSAVE）
- 缩容触发：负载因子 < 0.1
- 负载因子 = used / size

### Set 的底层实现
- intset：所有元素都是整数且数量 < 512
- hashtable：其他情况
- intset 升级：添加更大范围的整数时升级（int16 → int32 → int64）
- hashtable：value 为 NULL，只用 key

### ZSet 的底层实现
- ziplist：元素少时（zset-max-ziplist-entries < 128）
- skiplist + hashtable：元素多时
- skiplist（跳表）：有序链表 + 多层索引，平均 O(logN) 查询
- 跳表层数：随机生成（1/4 概率增加一层，最多 32 层）
- hashtable：score 快速查找，O(1) 复杂度
- 对比红黑树：实现简单、范围查询友好、并发友好

### Stream 的底层实现（5.0 新增）
- Radix Tree（基数树）：存储消息 ID 和内容
- listpack：紧凑的列表编码（替代 ziplist）
- Consumer Group：消费者组元数据
- PEL（Pending Entries List）：待确认消息列表
- 消息 ID：时间戳-序号（毫秒级时间戳 + 同一毫秒内的序号）

### Bitmap、HyperLogLog、GeoHash
- Bitmap：String 的位操作，统计活跃用户、签到
- HyperLogLog：基数统计，0.81% 误差，占用 12KB
- GeoHash：地理位置编码，经纬度编码为字符串
- Geo 实现：基于 ZSet，score 是 GeoHash 值

## 持久化深入篇

### RDB（Redis Database）
- 工作原理：fork 子进程，创建内存快照写入磁盘
- 触发方式：SAVE（阻塞）、BGSAVE（后台）、自动触发（save 配置）
- COW（Copy On Write）：父进程修改内存时复制页面
- 优势：恢复快、文件紧凑、对性能影响小
- 劣势：可能丢失最后一次快照后的数据、fork 时可能阻塞
- 压缩：LZF 算法压缩字符串
- 文件格式：REDIS + 版本 + 数据库 + 键值对 + EOF + 校验和

### AOF（Append Only File）
- 工作原理：记录每个写命令，追加到文件末尾
- 刷盘策略：always（每次）、everysec（每秒）、no（OS 决定）
- AOF 重写：合并命令，缩小文件体积
- 重写触发：auto-aof-rewrite-percentage、auto-aof-rewrite-min-size
- 重写过程：fork 子进程，读取数据库重新生成 AOF，同时记录增量命令
- AOF 缓冲区：重写期间的新命令先写缓冲区，重写完成后追加
- 混合持久化（4.0+）：RDB + AOF 增量，快速恢复 + 低数据丢失

### RDB vs AOF
- 数据安全：AOF 更安全（最多丢 1 秒），RDB 可能丢更多
- 恢复速度：RDB 快，AOF 慢（需要重放命令）
- 文件大小：RDB 小，AOF 大（未重写时）
- 性能影响：RDB 对性能影响小，AOF always 模式影响大
- 推荐：混合持久化，兼顾恢复速度和数据安全

### 持久化最佳实践
- 主从架构：主节点关闭持久化，从节点开启 RDB
- 混合模式：开启 aof-use-rdb-preamble
- AOF 策略：everysec 是最佳平衡点
- 监控 fork：关注 fork 耗时，影响响应延迟
- 磁盘选择：SSD 提升持久化性能

## 主从复制篇

### 主从复制原理
- 全量同步：从节点首次连接，主节点 BGSAVE 生成 RDB，发送给从节点
- 增量同步：全量同步后，主节点持续发送写命令到从节点
- 复制缓冲区（repl_backlog）：环形缓冲区，存储增量命令
- 断线重连：根据 offset 判断是全量还是增量同步
- 心跳机制：从节点定期发送 REPLCONF ACK，报告复制进度

### 复制流程
- PSYNC：从节点发送 PSYNC runid offset
- 主节点判断：runid 匹配且 offset 在缓冲区内则增量，否则全量
- 全量同步：BGSAVE → 发送 RDB → 发送缓冲区命令
- 增量同步：从缓冲区 offset 开始发送命令
- 命令传播：主节点执行写命令后发送给所有从节点

### 主从架构优势
- 读写分离：主节点写，从节点读，提升吞吐
- 数据备份：从节点是主节点的冷备
- 故障恢复：主节点宕机后可手动切换从节点
- 扩展性：增加从节点提升读性能

### 主从复制问题
- 复制延迟：网络延迟、主节点写入过快
- 数据不一致：异步复制导致从节点数据滞后
- 全量同步开销：fork + RDB 生成 + 网络传输
- 级联复制：从节点的从节点，减轻主节点压力

### 复制配置
- replicaof（slaveof）：配置主节点地址
- repl-backlog-size：复制缓冲区大小（默认 1MB）
- repl-timeout：复制超时时间
- min-replicas-to-write：最少从节点数，不足则拒绝写入
- min-replicas-max-lag：从节点最大延迟

## 哨兵篇（Sentinel）

### 哨兵的作用
- 监控：检测主从节点是否正常运行
- 通知：故障时通知管理员或应用程序
- 自动故障转移：主节点宕机时自动选举新主节点
- 配置提供：客户端连接哨兵获取主节点地址

### 哨兵工作原理
- 心跳检测：哨兵定期 PING 主从节点（1 秒一次）
- 主观下线（SDOWN）：单个哨兵认为节点下线
- 客观下线（ODOWN）：多数哨兵认为主节点下线（quorum）
- 故障转移：选举 Leader 哨兵执行故障转移
- 选举新主：从从节点中选择一个提升为主节点

### 故障转移流程
- 确认主节点下线：超过 quorum 个哨兵判断主观下线
- 选举 Leader 哨兵：Raft 协议选举（过半数投票）
- 选择新主节点：优先级、复制偏移量、runid 排序
- 提升新主：向从节点发送 SLAVEOF NO ONE
- 切换从节点：其他从节点 SLAVEOF 新主
- 更新配置：通知客户端和其他哨兵

### 新主选择规则
- replica-priority：优先级高的优先（0 表示不参与选举）
- 复制偏移量：数据最新的优先
- runid：字典序最小的优先

### 哨兵集群
- 奇数个哨兵：3/5/7 个（推荐 3 个）
- 过半数原则：Leader 选举需要过半数投票
- 网络分区：避免脑裂（通过 quorum 和过半数投票）
- 部署建议：哨兵分布在不同机器甚至不同机房

### 哨兵配置
- sentinel monitor：监控主节点（mymaster 主机 端口 quorum）
- sentinel down-after-milliseconds：主观下线时间（默认 30 秒）
- sentinel parallel-syncs：故障转移时同时同步的从节点数
- sentinel failover-timeout：故障转移超时时间

## 集群篇（Cluster）

### Cluster 的架构
- 去中心化：无中心节点，P2P 架构
- 数据分片：16384 个槽位（slot），分配给各节点
- 多主多从：多个主节点分担写入，每个主节点有从节点备份
- 客户端路由：客户端直接访问对应节点（MOVED 重定向）
- Gossip 协议：节点间交换信息，维护集群状态

### 数据分片
- 槽位计算：CRC16(key) % 16384
- 槽位分配：平均分配给各主节点（如 3 个节点每个 5461 个槽）
- Hash Tag：{user:1}:info 只对 {} 内的部分计算 Hash
- 多键操作：多个 key 必须在同一槽位（通过 Hash Tag 实现）
- 槽位迁移：在线扩缩容时迁移槽位

### 集群通信
- Gossip 协议：节点间定期交换信息
- PING/PONG：心跳消息，携带节点状态
- MEET：新节点加入集群
- FAIL：节点宣告某节点失败
- 集群总线：单独的端口（客户端端口 + 10000）

### 故障检测与转移
- 主观下线：单个节点认为另一节点下线
- 客观下线：超过半数主节点认为某节点下线
- 故障转移：从节点自动提升为主节点
- 从节点选举：Raft 协议选举（类似哨兵）
- 手动故障转移：CLUSTER FAILOVER 命令

### 集群扩缩容
- 添加节点：CLUSTER MEET，加入集群
- 迁移槽位：CLUSTER SETSLOT、MIGRATE 命令
- 迁移过程：逐个迁移槽位内的 key
- 删除节点：先迁移槽位，再移除节点
- 在线扩缩：不影响服务可用性

### 集群的局限性
- 不支持多库：只有 db0
- 批量操作受限：mget/mset 需要 key 在同一槽位
- 事务受限：涉及多个槽位的事务无法执行
- 复制结构：只支持一层主从，不支持级联复制

### 集群 vs 哨兵
- 哨兵：单主多从，读写分离，故障自动转移
- 集群：多主多从，数据分片，水平扩展
- 选择：数据量小用哨兵，数据量大用集群

## 分布式锁篇

### 单机锁（SETNX）
- 实现：SETNX key value + EXPIRE key seconds
- 原子性：SET key value NX EX seconds（2.6.12+）
- 问题：锁持有者宕机，锁永不释放
- 解决：设置过期时间

### 防止误删锁
- 问题：A 加锁 → 超时释放 → B 加锁 → A 删除了 B 的锁
- 方案：value 设为唯一标识（UUID），删除时判断
- Lua 脚本保证原子性：GET + 判断 + DEL

### Redlock 算法
- 场景：多个独立的 Redis 实例（主从架构会有问题）
- 步骤：向多数实例获取锁、检查获取时间、使用锁、释放所有锁
- 时间限制：获取锁的总时间 < 锁的过期时间
- 争议：Martin Kleppmann 质疑其正确性
- 实践：高可靠场景用 ZooKeeper/etcd，普通场景单实例锁足够

### 锁的自动续期
- 问题：业务执行时间超过锁过期时间
- Watchdog 机制：后台线程定期检查并延长锁
- Redisson 实现：自动续期，默认 30 秒过期，每 10 秒续期

### 可重入锁
- 问题：同一线程多次获取锁
- 实现：Hash 记录线程 ID 和重入次数
- 释放：重入次数 - 1，为 0 时删除锁

### 分布式锁的问题
- 性能：网络往返开销
- 时钟问题：服务器时间不同步
- GC 暂停：长时间 GC 导致锁超时
- 网络分区：脑裂问题（Redlock 部分解决）

## 性能优化篇

### 内存优化
- 数据结构选择：小对象用 ziplist/intset
- Key 设计：短 key 名、避免大 key
- 过期策略：合理设置 TTL，避免内存堆积
- 淘汰策略：maxmemory-policy（LRU、LFU、TTL、Random）
- 内存碎片：定期重启或 MEMORY PURGE（4.0+）

### 网络优化
- Pipeline：批量发送命令，减少 RTT
- 事务：MULTI/EXEC 打包命令
- Lua 脚本：原子性执行多个命令
- 连接池：复用连接，避免频繁建立连接
- 客户端缓存：6.0+ 支持客户端缓存

### 命令优化
- 避免慢查询：KEYS、SMEMBERS、HGETALL（大集合）
- 使用 SCAN：替代 KEYS，分批扫描
- 批量操作：MGET/MSET 替代多次 GET/SET
- 避免大 key：单个 key 的 value 过大影响性能
- HyperLogLog：大量唯一值统计

### 持久化优化
- 关闭 AOF：纯缓存场景
- RDB 策略：降低 save 频率
- AOF 重写：控制触发阈值，避免频繁重写
- no-appendfsync-on-rewrite：重写时不 fsync
- 独立磁盘：持久化文件放独立磁盘

### CPU 优化
- 单线程模型：避免阻塞命令
- 慢查询日志：slowlog-log-slower-than
- 禁用危险命令：rename-command KEYS ""
- Lazy Free：4.0+ 异步删除大 key

### 集群优化
- 槽位分配：均匀分配，避免数据倾斜
- 客户端路由缓存：减少 MOVED 重定向
- 批量操作：使用 Hash Tag 将相关 key 分配到同一槽位
- 监控网络：Gossip 协议的网络开销

## 高级特性篇

### Lua 脚本
- EVAL：执行 Lua 脚本
- EVALSHA：执行已加载脚本（SHA1）
- 原子性：脚本执行期间阻塞其他命令
- 使用场景：复杂逻辑、原子操作、减少网络往返
- 注意：避免长时间脚本，会阻塞服务器

### 发布订阅
- PUBLISH/SUBSCRIBE：消息发布订阅
- 模式订阅：PSUBSCRIBE pattern
- 问题：消息不持久化，订阅者离线丢消息
- 使用场景：实时消息通知、缓存失效通知
- 替代方案：Stream（5.0+）更可靠

### Stream（5.0+）
- 消息队列：持久化、消费者组、ACK 机制
- XADD：添加消息
- XREAD：读取消息
- XGROUP：创建消费者组
- XACK：确认消息
- 对比 Kafka：轻量级、单机部署、功能简化版

### 事务
- MULTI/EXEC：事务块
- WATCH：乐观锁，监控 key 变化
- 特点：打包执行、不支持回滚
- 局限性：命令错误不回滚，逻辑错误无法处理

### 模块（Module）
- 4.0+ 支持：动态加载扩展功能
- 常用模块：RedisJSON、RedisSearch、RedisGraph、RedisTimeSeries、RedisBloom
- 自定义模块：C 语言编写

### 客户端缓存（6.0+）
- Client-side caching：服务端推送失效通知
- Tracking：客户端注册感兴趣的 key
- 使用场景：频繁读取的数据
- 对比本地缓存：减少网络往返，自动失效

### 多线程 IO（6.0+）
- 网络 IO 多线程：读写网络数据
- 命令执行仍单线程：保证原子性
- 性能提升：高并发场景明显
- 配置：io-threads、io-threads-do-reads

## 运维监控篇

### 监控指标
- 内存：used_memory、内存碎片率、淘汰 key 数量
- 性能：QPS、命令耗时、慢查询
- 持久化：RDB/AOF 耗时、fork 耗时
- 连接：连接数、拒绝连接数
- 复制：复制延迟、复制缓冲区大小
- 集群：节点状态、槽位分布、故障转移次数

### INFO 命令
- Server：版本、运行时间、配置
- Clients：连接数
- Memory：内存使用情况
- Persistence：RDB/AOF 状态
- Stats：命令统计、网络流量
- Replication：主从复制状态
- CPU：CPU 使用情况
- Cluster：集群状态

### 慢查询日志
- slowlog-log-slower-than：慢查询阈值（微秒）
- slowlog-max-len：慢查询日志长度
- SLOWLOG GET：查看慢查询
- 优化方向：避免慢命令、优化业务逻辑

### 备份与恢复
- RDB 备份：复制 dump.rdb 文件
- AOF 备份：复制 appendonly.aof 文件
- 恢复：将文件放入数据目录，重启 Redis
- 增量备份：主从复制实现实时备份
- 云备份：定期上传备份到对象存储

### 安全加固
- 密码认证：requirepass 配置
- 重命名命令：rename-command 禁用危险命令
- 绑定 IP：bind 限制访问来源
- 保护模式：protected-mode yes
- TLS 加密：6.0+ 支持（需编译时启用）

## 下一步学习

掌握 Redis 深入知识后，你可以：
- **源码阅读**：深入 Redis 源码（C 语言，约 5 万行）
- **对比其他内存数据库**：Memcached、KeyDB、Dragonfly
- **学习分布式缓存**：一致性哈希、缓存穿透/击穿/雪崩
- **研究存储引擎**：LSM-Tree、B+ Tree 等
- **实践缓存架构**：多级缓存、缓存预热、降级策略
- **扩展场景应用**：实时排行榜、地理位置服务、布隆过滤器

Redis 是"快"的代名词，也是分布式系统的基石。从简单的缓存到复杂的分布式场景，Redis 的每个细节都值得玩味。Happy caching！
