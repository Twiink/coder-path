# Redis 学习路线

Redis 是**内存数据库的王者**:它不只是缓存,更是"**数据结构服务器**"——String、List、Hash、Set、Sorted Set 五大结构 + 发布订阅、Stream、Lua、分布式锁能力,让高性能应用离不开它。单线程模型(命令执行)+ IO 多路复用,轻松 10 万+ QPS;支持持久化、主从、哨兵、集群。它是后端面试的必考高地,也是你写过的每个高并发系统的"性能心脏"。实践:`docker run -d --name redis -p 6379:6379 redis` + `redis-cli` 即可开练。

这条线按 **五大数据结构 → 过期与淘汰 → 发布订阅与 Stream → 事务与 Lua → 持久化 → 主从/哨兵/集群 → 缓存设计(穿透/击穿/雪崩)→ 分布式锁 → 限流与队列场景 → 性能与运维** 推进。

## 第一站:String——最基础的万能结构

**命令**:SET/GET、MSET/MGET(批量,省往返)、**INCR/DECR/INCRBY(原子自增——并发安全的计数器,Redis 的招牌操作)**、**SETEX**(设置值+过期时间一步)、**SETNX**(不存在才设置——分布式锁的地基,见后)、SET 的 NX/EX 选项组合、GETSET(取旧设新)、APPEND/STRLEN;TTL 查看剩余过期。**应用场景**(String 一肩挑):**缓存**(序列化后的 JSON/对象——注意大对象与缓存问题见后)、**计数器**(访问量/点赞/库存/验证码发送频率:INCR + EXPIRE)、**分布式会话**(登录态存 Redis 替代服务端 session,多实例共享)、**验证码/限流计数**(SETEX 60 秒自然过期)。**key 命名规范**:`业务:模块:ID`(如 `user:profile:1001`——可读、可批量、避免冲突);**生产禁用 KEYS \*** 遍历(阻塞!用 SCAN 游标)。

## 第二站:List——队列与时间线

**命令**:LPUSH/RPUSH(两头插入)、LPOP/RPOP(弹出)、**LRANGE(start, stop)(范围读——分页取列表)**、LLEN、LINDEX(按下标取)、LTRIM(截断保留区间)、**BLPOP/BRPOP(阻塞弹出:列表为空就等,超时返回 nil——消费者模式的原始形态)**。**场景**:**最新列表/时间线**(LPUSH 新内容 + LTRIM 0 99 只留 100 条——微博/新闻流的老姿势,免数据库 order by)、**简单消息队列**(生产者 LPUSH + 消费者 BRPOP——阻塞等待,比轮询省资源;**局限:无确认机制,消费者崩溃消息丢失;无重复消费管理——要可靠的用 Stream 或专业 MQ**)。**提醒**:List 按插入序存,别当数组随机改。

## 第三站:Hash——对象的正确姿势

**命令**:HSET/HGET(单字段)、HMSET/HMGET(多字段;4.0 起 HSET 已支持多字段)、HGETALL(全取——**大 hash 慎用,用 HSCAN**)、HINCRBY(字段级原子自增)、HDEL、HLEN、HEXISTS。**场景**:**对象/实体缓存**(用户信息、商品详情:一个 key 一个对象、字段即属性——**比 String 整存整取强在"只更新/只读某几个字段"**:改头像只 HGETALL 换 HSET 一个字段,流量与序列化开销大减)、**购物车**(用户 id 为 key、商品 id 为 field、数量为 value——天然结构)、计数器分组(文章各维度的赞/踩/阅读用字段)。**选型**:整个对象总是整读整写 → String 够;会局部读改 → Hash;字段固定且小 → 都行,Hash 更省。

## 第四站:Set——去重与集合运算

**命令**:SADD/SREM、SISMEMBER(判成员,高效)、SMEMBERS(全取,大集合用 SSCAN)、SCARD(计数)、SPOP/SRANDMEMBER(随机弹/随机取——抽奖)、**SINTER(交集)/SUNION(并集)/SDIFF(差集)** 与 SINTERSTORE(结果存新 key)。**场景**:**标签系统**(文章打标签:tag 集合)、**去重**(UV 统计:SADD 用户 id + SCARD 得数量;活动参与去重)、**共同关注/好友推荐**(两个用户的关注集合 SINTER——"你们共同关注了 X")、**抽奖**(SPOP 公平弹出)、点赞集合(判断是否点过:SISMEMBER)。**Set 的幂等性**(重复 SADD 自动忽略)让"防重复提交/去重"场景一行搞定。

## 第五站:Sorted Set——带权重的排行榜之王

**命令**:ZADD(成员+分数)、ZRANGE/ZREVRANGE(按分数序/逆序取,带 WITHSCORES;ZRANGE 还能按排名区间取)、**ZRANGEBYSCORE**(按分数范围取——延时队列的核心)、ZREM、**ZINCRBY(原子加分——排行榜的实时更新)**、**ZRANK/ZREVRANK(查排名)**、ZSCORE(查分)、ZCARD、ZCOUNT(分数区间计数)、ZPOPMIN/ZPOPMAX(弹最小/最大)。**底层**:跳表(skiplist)+ 哈希表——**为什么用跳表不用红黑树:实现简单且天然支持范围遍历**,面试可以聊。**场景**:**排行榜**(实时热榜/积分榜:ZINCRBY 加分、ZREVRANGE 0 9 取 Top10、ZREVRANK 查"我第几"——**排行榜类需求 Redis 是标准答案**)、**延时队列**(score = 执行时间戳,ZADD 任务;轮询 ZRANGEBYSCORE 0 now 取到期任务——见延时队列节)、**滑动窗口限流**(成员=时间戳、score=时间戳,ZCOUNT 统计窗口内次数)、在线状态(时间戳分数,过期即下线)、**最新/最热列表**(分数=时间)。

## 第六站:过期策略与内存淘汰

**过期命令**:EXPIRE(秒)/PEXPIRE(毫秒)/TTL(查剩余,-1 永不过期 -2 已删除)/PERSIST(取消过期)。**过期键怎么删**(Redis 的两种删除,理解即可):**惰性删除**(访问时才检查过期——省 CPU 但过期键可能残留占内存)+ **定期删除**(每 100ms 抽查一批)——**没有定时器线程逐个删**(省资源,但"过期键还在内存"是正常现象,别慌)。**内存上限与淘汰(maxmemory + maxmemory-policy 8 种策略)**:noeviction(默认?实际默认 noeviction:写报错——**适合业务数据,丢不起**)、**allkeys-lru**(全体最近最少使用——缓存场景首选)、allkeys-lfu(访问频率最低——热点更稳)、allkeys-random、volatile-lru/volatile-lfu/volatile-random(只在**设了过期时间**的键里淘汰——**"缓存与持久数据混存"时用 volatile 系**)、volatile-ttl(快过期的先淘汰)。**选型口诀**:纯缓存库 → allkeys-lru/lfu;有不能丢的数据 → noeviction 或分开实例。

## 第七站:发布订阅与 Stream

**Pub/Sub**:PUBLISH/SUBSCRIBE(频道)/PSUBSCRIBE(模式匹配 `news.*`);**特性与坑**:即发即弃——**订阅者不在线消息直接丢**(无持久化、无确认);场景:轻量实时通知、聊天室、分布式节点间广播(如缓存失效广播)。**Stream(5.0+,Redis 自家的消息队列)**:XADD(追加消息,返回 ID)/XREAD(读,支持 BLOCK 阻塞——替代 pub/sub 的可靠版)/**XGROUP(消费者组):XREADGROUP 组内消费 + XACK 确认——消息处理失败留在 PENDING 可重试**(可靠消费的闭环)、XLEN/XDEL、消费组内消息不会被重复消费;**对比**:pub/sub(广播、丢了就丢)vs Stream(持久化+消费组,可做业务队列)vs 专业 MQ(RabbitMQ/Kafka:路由/死信/堆积能力强百倍——**真上生产队列见 [RabbitMQ](/learning-paths/middleware/rabbitmq) 与 [Kafka](/learning-paths/middleware/kafka)**,Redis 的定位是轻量/简单/同栈)。

## 第八站:事务与 Lua——原子性的两把钥匙

**事务**:MULTI(开始)→ 命令入队 → EXEC(一起执行)/DISCARD(取消);**特性(与关系库事务根本不同)**:Redis 事务是"**命令按序执行、中间不被打断**",但**不支持回滚**(某条命令语法错,前面的照常执行——别拿它当 ACID);**WATCH(乐观锁)**:EXEC 前 WATCH key,期间 key 被改则事务不执行(返回 nil)——**秒杀库存的经典姿势:WATCH stock → 读 → 算 → MULTI 扣减 → EXEC,冲突重试**。**Pipeline**(非事务):批量发命令减少往返(性能工具,不是原子保证)。**Lua 脚本(EVAL,原子性的终极武器)**:`EVAL "脚本" numkeys key... arg...`——**整个脚本原子执行**(执行期间其他命令插不进来)——**复杂逻辑(检查+扣减+记录 一套)用 Lua 一次搞定**:分布式锁释放(比对 value 再 DEL)、限流窗口、库存扣减、防重复提交——**能 Lua 就不拼事务**;脚本会缓存(EVALSHA 用 SHA 调,省带宽);注意脚本别写耗时逻辑(阻塞整个 Redis)。

## 第九站:持久化——重启后数据还在吗

**RDB 快照**:按规则(save 配置/手动 BGSAVE)fork 子进程用**写时复制(COW)** 把内存落盘 dump.rdb——**恢复极快、文件紧凑;缺点是可能丢最后一次快照后的数据**(崩溃窗口);SAVE(同步,阻塞)生产禁用。**AOF(追加日志)**:每条写命令追加到 .aof——**fsync 策略三档**:always(每写必刷,最安全最慢)/**everysec(每秒刷,默认——丢最多 1 秒数据)**/no(交给 OS);**AOF 重写**(BGREWRITEAOF 压缩日志——文件无限增长的解法,自动触发可配)。**对比**:RDB(快/省空间/丢多)vs AOF(慢一点/安全/文件大);**4.0+ 混合持久化(默认)**:AOF 文件以 RDB 开头 + 增量命令——**重启加载快且丢得少,生产标配**。**选型**:纯缓存(可关持久化,重启从库/数据库重建)、业务数据(AOF everysec + RDB 兜底);持久化与主从(从库可只读不开持久化?从库持久化兜底更稳)。

## 第十站:高可用——主从、哨兵与集群

**主从复制(REPLICAOF host port)**:主写从读;**全量同步**(首次/断连久:主生成 RDB 传从)与**增量同步**(断连短:积压缓冲区内补发);复制是**异步**的(主从延迟的根源——读写分离注意"刚写入读不到":强制走主/短暂容忍);**哨兵 Sentinel(高可用的大脑)**:监控主从,主挂自动**故障转移**(从库提升+客户端感知新主);部署要点:哨兵至少 3 个(奇数,自己也要高可用)、quorum(判定主观下线数)、客户端经哨兵发现主(`sentinel get-master-addr-by-name` 或客户端库封装——Java/Go 客户端都有哨兵模式);**Redis Cluster(数据分片)**:16384 个**哈希槽**(CRC16(key) % 16384)分布在多个主节点,每主带从;客户端直连任一节点,key 不在本节点返回 **MOVED 重定向**(集群客户端自动跟随);节点间 gossip 通信、从节点自动故障提升;**多 key 限制**:跨槽的 multi-key 命令不可用——用 **hash tag `{}`**(`user:{1001}:orders` 强制同槽)让相关 key 同节点;在线扩容(reshard 迁移槽)。**选型**:单机(开发/小流量)→ 主从+哨兵(生产标准,数据量一台够)→ Cluster(数据/写放大);**别一上来就 Cluster**(运维复杂度陡增)。

## 第十一站:缓存设计——穿透、击穿、雪崩(面试三件套)

**缓存穿透**:查一个**不存在的数据**(缓存没有、数据库也没有)→ 每次都打库(攻击者可利用)。解法:**参数校验**(非法 id 直接拒)、**缓存空值**(不存在的也缓存几分钟,设较短 TTL)、**布隆过滤器**(不存在直接短路——数据量大时)。**缓存击穿**:**某个热点 key 过期瞬间**,大量请求同时打到数据库。解法:**互斥锁**(缓存失效后只有一个线程重建:setnx 抢锁,其余等待——注意别死锁/雪崩)、**逻辑过期**(value 里带过期时间,后台异步刷新——热点永不过期+主动更新)。**缓存雪崩**:大量 key **同一时间过期**(或 Redis 整体宕机)→ 数据库被打崩。解法:**过期时间加随机值**(基础操作!)、多级缓存(本地缓存 Caffeine 兜底)、Redis 高可用(哨兵/集群)、服务端限流降级。**更新策略(Cache Aside 是主流)**:读:先缓存,miss 读库回填;写:**先更新数据库,再删除缓存**(删除而非更新——**懒加载,下次读再回填**,避免"先更新缓存后写库失败"的不一致;**延迟双删**(先删缓存→更库→延迟再删)处理并发读写的极端不一致;强一致请用订阅数据库 binlog/Canal 或消息队列异步删缓存——**缓存与库的最终一致是常态,别追求不可能的事务一致**)。**缓存预热**:上线前把热点数据提前灌入(脚本/定时任务),避免冷启动打库。

## 第十二站:分布式锁——SETNX 的正确姿势

**需求**:多实例/多线程互斥(定时任务只跑一份、秒杀扣减、防并发重复处理)。**演进(面试必考的三段式)**:①`SETNX lock value` + 用完 DEL——**问题:进程崩了锁不释放 → 死锁**;②加过期时间 `SETNX` + EXPIRE 两步——**非原子,中间崩仍死锁**;③**正确姿势:`SET lock uuid NX EX 10`(一条原子命令:不存在才设 + 10 秒自动过期)**——释放时**用 Lua 比对 value 再 DEL**(`if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) end`)——**防误删别人的锁**(自己超时后别人拿到锁,自己却去删)。**进阶**:锁过期但业务没跑完(自动续期"看门狗")——用 **Redisson**(Java:RLock 封装了加锁/看门狗续期/可重入,`lock.lock()`/`unlock()` 即可,别自己造轮子);Go 用 redsync;Python redis-py 的锁类;**Redlock(多节点算法)**:向 N 个独立节点都加锁成功才算——争议很大(复杂且并非绝对安全),**多数场景单 Redis(主从+哨兵)的锁够用**;备选:**ZooKeeper 临时顺序节点锁(强一致但重)**——见 [ZooKeeper 路线](/learning-paths/middleware/zookeeper);**提醒**:分布式锁解决的是"互斥",不是"幂等"——接口幂等(唯一请求号)另说。

## 第十三站:限流与延时队列场景

**限流算法**(理解四兄弟):固定窗口(计数器 INCR+EXPIRE——实现最简单,窗口边界突刺)、**滑动窗口**(ZSet 时间戳计数——精确,Redis 常见实现)、令牌桶(允许突发,匀速补充——网关常用,配 Redis 或本地)、漏桶(强制匀速);**生产实现**:自写用 Lua(原子)、Java 直接用 Redisson 的 RateLimiter、网关层(Spring Cloud Gateway/Nginx)限流更靠前——**限流放最外层,别都挤在业务代码**。**延时队列(订单超时关闭/定时通知)**:Redis 姿势——ZADD score=执行时间戳 → 轮询 `ZRANGEBYSCORE key 0 now` 取到期任务 → 处理 → ZREM;**可靠性**:处理崩了任务丢(可先取后删加确认,或用 Redisson 延迟队列);**选型**:简单/量小用 Redis 延时队列;要可靠/持久/死信换 RabbitMQ(延迟插件)/Kafka(见 [消息中间件](/learning-paths/middleware/rabbitmq))。

## 第十四站:性能与运维

单线程为什么快(面试高频,要答全):

内存操作本身快(ns 级,比磁盘快 10 万倍),数据结构简单高效(哈希表/跳表/压缩列表优化到极致);

IO 多路复用(epoll/kqueue):单线程用 epoll 监听几万个连接,哪个就绪处理哪个,不阻塞、不用线程切换——见 [计算机网络学习路线](/learning-paths/cs-basics/computer-networks) 的 IO 模型章节;

无锁无上下文切换:单线程命令串行执行,无需加锁保护共享数据,无线程调度开销;

简单协议:RESP 协议(Redis Serialization Protocol)极简(文本行,易解析);

为什么有了多线程还说单线程:6.0 引入多线程只负责网络 IO 读写与协议解析(充分利用多核加速网络瓶颈),命令执行仍是单线程(保证原子性、无需加锁)——所以"单线程命令执行模型"没变,只是 IO 部分多线程了。默认 4 个 IO 线程,可配 io-threads 4-8(配太多反而慢,上下文切换)。

数据结构底层实现(面试加分项,理解为什么快):

String:SDS(Simple Dynamic String,动态字符串)——C 字符串改良版:带长度字段(O(1) 获取长度,C 的 strlen 要遍历)、预分配空间(减少扩容)、二进制安全(可存任意数据含\0);编码:int(整数)、embstr(短字符串 ≤44 字节,一次内存分配)、raw(长字符串,两次分配);

List:3.2 前是 ziplist(压缩列表,连续内存,省空间但插入 O(n))或 linkedlist(双向链表);3.2+ 统一用 quicklist(快表 = 双向链表的每个节点是一个 ziplist,兼顾空间与性能);

Hash:ziplist(元素少时,键值对紧凑存)或 hashtable(标准哈希表,渐进式 rehash:扩容时分多次搬迁,不阻塞);阈值:`hash-max-ziplist-entries 512`、`hash-max-ziplist-value 64`;

Set:intset(整数集合,有序数组,元素全是整数且少时用)或 hashtable(值全是 NULL);

ZSet:ziplist(元素少)或 skiplist + hashtable 组合(跳表做范围查询 + 哈希表做 O(1) 查分数)——为什么不用红黑树:跳表实现简单(几十行代码)、范围查询天然友好(沿指针走就是有序)、删除不需要 rebalance、支持并发(层级独立);

性能放大三板斧:

Pipeline(管道):一批命令打包一次发送,一次接收响应——省 RTT(往返时延),吞吐提升数倍到几十倍;注意:Pipeline 不是原子的(中间可能插入其他客户端命令),不能替代事务;Pipeline 命令数不要太多(几百条合理,几万条内存爆、网络超时),单次返回数据别太大;

连接池:客户端复用连接,避免频繁建连(TCP 三次握手、AUTH 认证开销);主流客户端:Jedis(Java,老牌,同步阻塞,需配连接池 JedisPool)、Lettuce(Java,异步非阻塞,Spring Boot 2+ 默认)、Redisson(Java,高级封装:分布式锁/延迟队列/布隆过滤器/分布式集合)、go-redis(Go,连接池自带)、redis-py(Python,redis-py 内置连接池 ConnectionPool)、ioredis/node-redis(Node.js)——配置要点:maxTotal(最大连接数)、maxIdle(最大空闲)、minIdle(最小空闲保持)、超时(连接超时 connectTimeout、读写超时 soTimeout);

合理数据结构与 key 设计:小对象压缩编码(ziplist/listpack/intset 阈值调优)、key 别太长(key 本身占内存且哈希计算慢)、value 别太大(大 key,见下)、合理 TTL(别让冷数据永驻)。

大 key 问题(生产高频故障):

什么是大 key:String 超 10KB、List/Set/Hash/ZSet 元素超 5000 或总大小超 10MB——业务常见:把整个列表/大 JSON 存一个 key;

危害:网络传输慢(阻塞其他命令)、序列化/反序列化慢、删除慢(DEL 大 key 是 O(n) 阻塞操作,百万元素的 List DEL 能卡几秒)、内存占用高、主从同步慢、持久化慢;

排查:redis-cli --bigkeys(扫描采样,找各类型最大的)、--memkeys(扫内存占用,4.0+)、MEMORY USAGE key(查单 key 内存,4.0+)、RdbTools(解析 RDB 找大 key);

解法:拆分(大 Hash 拆成多个小 Hash,如 user:1001:info / user:1001:profile)、压缩(GZIP 后存 String)、异步删除(4.0+ UNLINK 异步删,6.2+ DEL 自动转异步 lazyfree-lazy-user-del=yes)、定期清理(HSCAN/SSCAN 遍历分批删);

热 key 问题:

什么是热 key:访问频率极高的 key(如秒杀商品库存、热搜榜、大 V 用户信息)——单 key QPS 几万到几十万,单线程瓶颈、网卡打满;

排查:redis-cli --hotkeys(4.0+,基于 LFU 统计)、monitor + 分析(MONITOR 命令实时看所有命令,性能影响大勿生产长开)、代理层统计(Codis/Twemproxy)、客户端埋点;

解法:多级缓存(本地缓存 Caffeine/Guava Cache 扛第一波,几十 ms 过期)、主从读写分离(从库分摊读)、热 key 拆分(key 加随机后缀 hot_key_01~hot_key_10,写时都写,读时随机选——分散到多个 key 分摊压力);

运维命令与排查:

INFO:分段查看(INFO memory/stats/replication/cpu/clients)——关键指标:used_memory_human(内存占用)、used_memory_rss(RSS 物理内存,大于 used_memory 说明碎片)、mem_fragmentation_ratio(碎片率,> 1.5 考虑重启或 MEMORY PURGE)、connected_clients(当前连接数,达 maxclients 拒绝新连接)、instantaneous_ops_per_sec(实时 QPS)、keyspace_hits / keyspace_misses(命中率 = hits/(hits+misses),低于 80% 检查缓存策略);

SLOWLOG GET 10:慢查询日志(slowlog-log-slower-than 10000 微秒,10ms 以上记)——大 key 操作、KEYS *、SMEMBERS 大集合、未优化的 Lua 是常客;

CLIENT LIST:当前连接列表(addr/fd/age/idle/flags/db/sub/psub/multi/qbuf/obl/oll)——排查连接泄漏(idle 超大)、阻塞客户端;

MEMORY DOCTOR:内存诊断建议(4.0+);

MEMORY STATS:内存统计详情;

MEMORY PURGE:手动触发内存整理(碎片回收);

内存碎片:频繁修改(尤其变长的 append/setrange)、大量删除后,allocator(jemalloc/tcmalloc)分配的物理内存未归还系统——碎片率高(> 1.5)影响性能;解法:activedefrag yes(4.0+,后台自动整理,低峰期跑)、重启(瞬间回收,需主从切换)、升级到 7.0+(碎片整理优化更好);

卡顿排查(线上 Redis 突然慢):

fork 耗时(BGSAVE/BGREWRITE 时 fork 子进程,内存大时 fork 几秒阻塞)——查 INFO stats 的 latest_fork_usec,优化:缩小内存、关闭 THP(Transparent Huge Pages,大页会让 fork 慢)、避免高峰 fork;

AOF 重写阻塞(重写完成时主进程要等待并合并增量,短暂阻塞)——no-appendfsync-on-rewrite yes 可缓解(重写期间不 fsync,风险是丢数据);

内存交换(swap):物理内存不足,Redis 被 swap 到磁盘,性能雪崩——查 INFO memory 的 used_memory_rss 与 used_memory 差异,cat /proc/<pid>/smaps | grep Swap 看交换量,解法:加内存、缩小 maxmemory、关闭 swap(swappiness=0);

网络问题:带宽打满(大 key/热 key)、网络抖动、连接数打满;

慢命令:KEYS *、SMEMBERS 百万元素、SORT 无 LIMIT、Lua 脚本长时间运行;

对比 Memcached(纯 KV 缓存,多线程):Redis 的数据结构、持久化、主从、Lua 让它全面胜出,Memcached 只在"极简超大内存纯缓存"场景(不需要持久化、不需要数据结构、超大 value)有一席之地——现代架构学 Redis 就够。

## 通关标准

能独立做到:给五种结构说出至少一个典型场景并写出命令;讲清过期删除策略与 8 种淘汰策略的选型;能对比 RDB/AOF/混合持久化并给出生产选型;画得出主从+哨兵与 Cluster 的架构与区别(槽/hash tag/重定向);**缓存三兄弟(穿透/击穿/雪崩)能各给两种解法**;能写出正确版分布式锁(SET NX EX + Lua 释放)并解释为什么;会用 Lua/Pipeline 做原子批量与性能优化;看过 INFO 能判断命中率与内存健康度——Redis 主线通关。

Redis 表面简单(命令好记),内里全是并发与架构的智慧:单线程的事件循环、写时复制的快照、跳表的范围查询、槽位路由——每层都是教科书。它也是你从"写 CRUD"走向"设计高并发"的第一块跳板:缓存三兄弟、分布式锁、限流,这些面试必考背后,是真实系统每天都在发生的风暴。下一步:消息中间件 [RabbitMQ](/learning-paths/middleware/rabbitmq) 与 [Kafka](/learning-paths/middleware/kafka),或数据库深入 [MySQL](/learning-paths/database/mysql)。
