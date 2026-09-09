---
title: "Redis数据类型与命令"
aliases:
  - "Redis数据类型"
  - "Redis命令"
  - "Redis五大数据类型"
tags:
  - "后端"
  - "数据库"
  - "redis"
  - "命令"
  - "笔记"
category: "后端"
folder: "Redis"
parent: "[[目录]]"
related:
  - "[[后端/数据库/Redis/Redis入门与安装配置]]"
  - "[[后端/数据库/Redis/Redis应用场景与实战]]"
  - "[[后端/数据库/Redis/Redis线程模型与高性能原理]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 02 数据类型与命令

Redis 的核心魅力在于**丰富的数据结构**。本章覆盖:5 种基础类型(String / Hash / List / Set / ZSet)的命令与场景、底层编码的自动转换、通用命令、4 种特殊类型(Bitmap / HyperLogLog / GEO / Stream)速览、Lua 脚本与 Pipeline。

## 2.1 数据模型:Redis 不是单纯的 K-V

```text
常见误解:Redis 就是 key → value 字符串
实际模型:Redis 是 Key-Value,但 value 不是字符串,而是【对象】(robj)

       ┌────────────────────────────────────────────────────┐
       │            redisObject                              │
       ├────────────────────────────────────────────────────┤
       │ type: 5 种基础类型 + 3 种特殊类型                    │
       │ encoding: 底层实际用的数据结构(见下)                 │
       │ refcount: 引用计数                                   │
       │ lru: 最近访问时间 / 频率                             │
       │ *ptr: 指向底层数据结构的指针                         │
       └────────────────────────────────────────────────────┘
                    ↓ ptr 指向
      ┌─────────────────────────────────────────────┐
      │ 底层数据结构(根据元素数量/大小自动选择)      │
      │  · SDS(简单动态字符串)                       │
      │  · Hash 表(拉链法)                           │
      │  · 压缩列表 listpack(3.2 前是 ziplist)       │
      │  · 整数集合 intset                           │
      │  · 跳表 skiplist                              │
      │  · 双向链表 quicklist(listpack + 链表)        │
      └─────────────────────────────────────────────┘
```

**为什么要区分"类型"与"编码"?** 同一个"Hash 类型"对外只有一套 HSET/HGET 命令,内部根据元素数量与大小**自动切换编码**,小数据量用紧凑编码省内存,大数据量用哈希表换取 O(1) 性能。用户无感,这是 Redis 优雅的工程实现。

| 类型(外部) | 底层编码候选(内部) | 切换时机 |
| --- | --- | --- |
| **String** | int / embstr / raw(SDS) | 整数 → int;≤44 字节短串 → embstr;否则 → raw |
| **List** | quicklist(listpack + 链表) | 7.0+ 统一用 quicklist,早期小 list 是 ziplist |
| **Hash** | listpack / hashtable | 元素少 + 值短 → listpack;否则 → hashtable |
| **Set** | intset / listpack / hashtable | 全整数且少 → intset;少且值短 → listpack;否则 → hashtable |
| **ZSet** | listpack / skiplist + hashtable | 元素少且值短 → listpack;否则 → skiplist |
| **Stream** | listpack + radix tree | 固定实现 |

```bash
# 查看一个 key 的实际编码
OBJECT ENCODING mykey
# 返回值:embstr / raw / int / hashtable / listpack / skiplist / intset / quicklist ...
```

> **性能影响:** 小数据量用紧凑编码(listpack/intset)时,内存节省 3~10 倍,但部分命令时间复杂度退化(如 HGET 在 listpack 上是 O(N) 而非 O(1))。Redis 权衡"小数据用空间换少量 CPU、大数据用 CPU 换空间",对业务基本无感。**只有当你刻意让 key 长期停留在"小数据编码"以省内存时,才需要关注阈值**(可调整)。

```ini
# redis.conf:调整编码切换阈值(一般不改)
hash-max-listpack-entries 128       # Hash 用 listpack 的最大条目数
hash-max-listpack-value 64          # Hash 单个值最大字节数
zset-max-listpack-entries 128       # ZSet 用 listpack 的最大条目数
zset-max-listpack-value 64
list-max-listpack-size -2           # List 每个 listpack 节点的大小(-2 表示 8KB)
set-max-intset-entries 512          # Set 用 intset 的最大元素数
set-max-listpack-entries 128        # Set 用 listpack 的最大元素数
```

## 2.2 String(字符串)

**String 是 Redis 最基本也是用途最广的类型**。value 不一定是字符串,可以是数字、JSON、序列化对象、甚至二进制图片,最大 **512MB**(但生产不要存这么大的 value)。

### 底层编码:SDS(Simple Dynamic String)

```text
SDS 的结构(以 "hello" 为例):
  ┌────────────────────┬──────────┬────────────┬───────────┐
  │ struct sdshdr {    │ buf      │ 长度 len=5 │ 剩余 free │
  │   len              │ h e l l o│   used=5   │   free=0  │
  │   free             │          │            │           │
  │   buf[]            │          │            │           │
  │ }                  │          │            │           │
  └────────────────────┴──────────┴────────────┴───────────┘

SDS 优于 C 字符串:
  ① 自带 len → 取长度 O(1)(strlen 是 O(N))
  ② 二进制安全,可存 \0 与图片
  ③ 预分配空间,追加操作避免频繁 realloc
```

### 命令速查

| 命令 | 作用 | 示例 | 复杂度 |
| --- | --- | --- | --- |
| `SET k v` | 设置/覆盖 | `SET user:1 "alice"` | O(1) |
| `SET k v EX 60` | 设置 + 60 秒过期 | `SET session:xx val EX 1800` | O(1) |
| `SET k v PX 60000` | 设置 + 毫秒过期 | — | O(1) |
| `SET k v NX` | **key 不存在才设置**(分布式锁必备) | `SET lock val NX EX 30` | O(1) |
| `SET k v XX` | **key 存在才设置** | — | O(1) |
| `SET k v GET` | 设置并返回旧值(6.2+) | `SET k v GET` | O(1) |
| `GET k` | 取值 | `GET user:1` | O(1) |
| `MSET k1 v1 k2 v2 ...` | **批量设置**(原子) | `MSET a 1 b 2 c 3` | O(N) |
| `MGET k1 k2 ...` | **批量获取**(一条网络往返) | `MGET user:1 user:2` | O(N) |
| `GETSET k v` | 设新值返旧值(已废弃,改用 `SET GET`) | — | O(1) |
| `GETDEL k` | 取值并删除(6.2+,原子) | `GETDEL onetime_token` | O(1) |
| `GETEX k EX 60` | 取值并设置过期时间(6.2+) | — | O(1) |
| `INCR k` | 值 +1(key 不存在则从 0 开始) | `INCR view:article:1` | O(1) |
| `DECR k` | 值 -1 | — | O(1) |
| `INCRBY k n` | 值 +n(整数) | `INCRBY stock:1 10` | O(1) |
| `DECRBY k n` | 值 -n | — | O(1) |
| `INCRBYFLOAT k f` | 值 +f(浮点) | `INCRBYFLOAT score 0.5` | O(1) |
| `APPEND k v` | 追加字符串 | `APPEND log "new line"` | O(\|v\|) |
| `STRLEN k` | 取字符串字节长度(注意中文) | `STRLEN "中文"` → 6 | O(1) |
| `SETRANGE k off v` | 覆盖指定偏移 | `SETRANGE k 3 "xyz"` | O(\|v\|) |
| `GETRANGE k start end` | 取子串(按字节) | `GETRANGE k 0 4` | O(N) |
| `SETNX k v` | NX 版 SET(已废弃,用 `SET NX`) | — | O(1) |
| `SETEX k s v` / `PSETEX` | 设值+秒/毫秒过期 | `SETEX k 60 v` | O(1) |

```bash
# String 的原子计数(高并发点赞、阅读数)
INCR article:1001:view_count         # 1
INCR article:1001:view_count         # 2
GET article:1001:view_count          # "2"

# 库存扣减(关键:INCRBY 负数 + 检查)
SET product:1:stock 100
DECRBY product:1:stock 1             # 99,原子操作,天然防超卖
DECRBY product:1:stock 5

# 分布式锁(最简形态)
SET lock:order:1001 "request_id" NX EX 30
# NX:不存在才设,EX 30:30 秒过期兜底
```

**String 的常见场景:**

| 场景 | 用法 | 备注 |
| --- | --- | --- |
| 缓存(对象序列化) | (SET user:1 '&#123;"id":1,...&#125;' EX 600) | JSON / Protobuf 序列化 |
| 计数器(阅读数/点赞) | `INCR article:1:view_count` | 高并发场景,原子性由单线程保证 |
| 分布式锁 | `SET lock val NX EX 30` | 详见 [[后端/数据库/Redis/Redis应用场景与实战]] |
| Session | `SET session:token userdata EX 1800` | 多节点共享 Session |
| 限流 | `INCR key + EXPIRE + Lua` | 固定窗口/滑动窗口限流 |
| 分布式 ID | `INCR id:seq` | 简单场景够用,但 Redis 宕机会断号 |
| 排行榜 | 用 ZSet,不用 String | — |
| 消息队列 | 用 List / Stream,不用 String | — |

> **缓存对象的序列化选型:**
> - **JSON**:可读、跨语言,缺点是字段名重复占空间、反序列化开销
> - **MessagePack / Protobuf**:二进制,紧凑快速,但不可读
> - **Java Serializable / Pickle**:跨语言差、不安全(反序列化漏洞),**禁用**
>
> 互联网 Java 服务常用 **JSON**;Python 服务可用 `orjson`/`msgpack`;高频场景用 Protobuf。

## 2.3 Hash(哈希)

**Hash 是 field-value 对的集合,适合存储对象**。比 String 存 JSON 的优势:可以**只读写某个字段**,不用整体覆盖。

### 底层编码:listpack 或 hashtable

```text
小数据量:field 少、value 短 → listpack(紧凑数组,省内存但查找 O(N))
大数据量:                    → hashtable(O(1))
阈值:hash-max-listpack-entries = 128, hash-max-listpack-value = 64
```

### 命令速查

| 命令 | 作用 | 复杂度 |
| --- | --- | --- |
| `HSET k f v` | 设置单个字段(7.0 起支持多字段,等价旧 HMSET) | O(1) |
| `HSET k f1 v1 f2 v2` | 设置多个字段 | O(N) |
| `HGET k f` | 取单个字段 | O(1) |
| `HMSET k f1 v1 f2 v2` | 旧版多字段设置(6.2+ 已废弃,用 `HSET` 多字段) | O(N) |
| `HMGET k f1 f2` | **批量取多个字段** | O(N) |
| `HGETALL k` | 取**所有字段与值**(⚠️ 大 hash 会阻塞) | O(N) |
| `HKEYS k` | 取所有字段名 | O(N) |
| `HVALS k` | 取所有字段值 | O(N) |
| `HDEL k f1 f2 ...` | 删除字段 | O(N) |
| `HEXISTS k f` | 判断字段是否存在 | O(1) |
| `HLEN k` | 字段数 | O(1) |
| `HINCRBY k f n` | 字段值 +n(原子) | O(1) |
| `HINCRBYFLOAT k f f` | 字段值 +f(浮点) | O(1) |
| `HSETNX k f v` | 字段不存在才设置 | O(1) |
| `HSTRLEN k f` | 字段值的字节长度 | O(1) |
| `HRANDFIELD k [n [WITHVALS]]` | 随机取字段(6.2+) | O(N) |
| `HSCAN k cursor` | 渐进式遍历(大 hash 必备) | O(1) 每次 |

```bash
# 存用户对象
HSET user:1001 name "Alice" age 25 email "a@x.com"
HGET user:1001 name                 # "Alice"
HMGET user:1001 name age email      # 批量取,少发网络包

# 只改一个字段(比 String 存 JSON 高效得多)
HSET user:1001 age 26
# 如果用 String 存 JSON,改 age 要先 GET 整个 JSON、解析、改字段、再 SET 整个 JSON

# 字段原子自增(点赞、计数)
HINCRBY article:1001 stats like_count 1
HGET article:1001 stats like_count

# 大 hash 遍历(不要 HGETALL,用 HSCAN)
HSCAN user:1001 0 MATCH email* COUNT 100
```

**Hash vs String(JSON)的抉择:**

| 维度 | String 存 JSON | Hash |
| --- | --- | --- |
| 整体读写 | ✅ 一次往返 | ⚠️ 多字段要多次 HMGET |
| **单字段修改** | ❌ 要整体重写 | ✅ `HSET key field value` |
| 内存占用 | 中等(JSON 文本) | **小**(二进制,listpack 紧凑) |
| 跨语言可读 | ✅ JSON 通用 | ⚠️ 字段顺序、编码依赖客户端 |
| 设置过期 | ✅ 直接 EX | ✅ 整个 Hash 过期(无法字段级过期) |
| 适合 | 完整读写的配置、缓存对象 | **频繁更新单字段的用户画像、统计** |

> **经验法则:**
> - **读多写少、字段固定** → String + JSON
> - **频繁改某几个字段** → Hash
> - **字段数巨大**(> 1000)→ Hash,但要警惕大 Key 问题
> - **需要字段级过期** → 每个字段做成单独的 String key(牺牲原子性换粒度)

## 2.4 List(列表)

**List 是双向链表(7.0+ 实现为 quicklist = listpack + 链表)**,支持两端插入与弹出,典型用途:消息队列、时间线、最近 N 条。

### 命令速查

| 命令 | 作用 | 复杂度 |
| --- | --- | --- |
| `LPUSH k v1 v2 ...` | **左侧**插入(多个值时按参数顺序从右到左插入,结果与参数顺序相同) | O(N) |
| `RPUSH k v1 v2 ...` | **右侧**插入 | O(N) |
| `LPOP k [count]` | 左侧弹出 1 个(或 N 个,6.2+) | O(1) / O(N) |
| `RPOP k [count]` | 右侧弹出 | O(1) / O(N) |
| `LRANGE k start stop` | 取范围,**stop = -1 表示到末尾** | O(S+N) |
| `LLEN k` | 长度 | O(1) |
| `LINDEX k i` | 按下标取值(负数表示倒数) | O(N) |
| `LSET k i v` | 按下标设值 | O(N) |
| `LINSERT k BEFORE\|AFTER pivot v` | 在某元素前/后插入 | O(N) |
| `LREM k count v` | 删除指定元素(count 控制方向与数量) | O(N) |
| `LTRIM k start stop` | 只保留指定范围,**常用做"定长队列"** | O(N) |
| `LPOS k v [RANK n] [COUNT n] [MAXLEN n]` | 查找元素位置(7.0+) | O(N) |
| `BLPOP k [k2...] timeout` | **阻塞**左弹出(实现消息队列) | O(1) |
| `BRPOP k timeout` | 阻塞右弹出 | O(1) |
| `BLMOVE src dst LEFT\|RIGHT LEFT\|RIGHT timeout` | 阻塞式原子转移(6.2+) | O(1) |
| `LMOVE src dst LEFT\|RIGHT LEFT\|RIGHT` | 非阻塞原子转移(6.2+) | O(1) |

```bash
# 时间线(最近的 N 条,如微博 Feed)
LPUSH feed:user:1001 "post_id_1"
LPUSH feed:user:1001 "post_id_2"
LRANGE feed:user:1001 0 9             # 最近 10 条
LTRIM feed:user:1001 0 99             # 只保留最近 100 条,老的丢弃

# 栈:LPUSH + LPOP(后进先出)
LPUSH stack:1 "a" "b" "c"
LPOP stack:1                          # "c"

# 队列:LPUSH + RPOP(先进先出)
LPUSH queue:1 "task_a" "task_b"
RPOP queue:1                          # "task_a"

# 阻塞队列(消息队列经典模式)
# 消费者(多个消费者可并行):
BLPOP queue:1 queue:2 0                # 0 = 永远阻塞,直到有数据
# 生产者:LPUSH queue:1 "task"

# 安全队列(处理失败要重试):LMOVE + 备份 list
LMOVE tasks:pending tasks:processing LEFT RIGHT
# ... 处理 ...
LREM tasks:processing 1 "task_id"      # 成功后从 processing 删除
# 超时未处理的任务定时任务从 processing 移回 pending
```

**List 做消息队列的局限(详见 2.8 Stream):**

| 局限 | 说明 |
| --- | --- |
| 没有消息确认(ACK)机制 | 消费失败要靠应用层自己处理 |
| 没有消费者组 | 多消费者重复消费要自己实现 |
| 历史消息按偏移访问,无 ID | 难做"从某处开始重放" |
| 不支持多主题 | 每个队列独立 |

> 简单任务队列用 List + BLPOP 够用;需要**消费确认、多消费者组、历史回溯、多 topic** 时升级到 **Stream**(2.8)或 Kafka/RabbitMQ。

## 2.5 Set(集合)

**Set 是无序、不重复的元素集合**,数学集合运算(交/并/差)强大,常用于标签、共同关注、去重。

### 底层编码

```text
全整数 + 元素少 → intset(排序数组,查找 O(log N))
其他情况 → hashtable(O(1))
阈值:set-max-intset-entries = 512
```

### 命令速查

| 命令 | 作用 | 复杂度 |
| --- | --- | --- |
| `SADD k m1 m2 ...` | 添加成员(已存在忽略) | O(N) |
| `SREM k m1 m2 ...` | 删除成员 | O(N) |
| `SISMEMBER k m` | 是否包含 | O(1) |
| `SMISMEMBER k m1 m2` | 批量判断(6.2+) | O(N) |
| `SMEMBERS k` | 取全部成员(⚠️ 大 set 阻塞) | O(N) |
| `SCARD k` | 成员数 | O(1) |
| `SRANDMEMBER k [count]` | 随机取(负 count 允许重复) | O(1) / O(N) |
| `SPOP k [count]` | 随机弹出并删除(抽奖!) | O(1) / O(N) |
| `SMOVE src dst m` | 移动成员 | O(1) |
| `SDIFF k1 k2 ...` | **差集**(k1 - 其他) | O(N) |
| `SINTER k1 k2 ...` | **交集** | O(N×M) |
| `SUNION k1 k2 ...` | **并集** | O(N) |
| `SDIFFSTORE dst k1 k2` | 差集存入 dst | O(N) |
| `SINTERSTORE dst k1 k2` | 交集存入 dst | O(N×M) |
| `SUNIONSTORE dst k1 k2` | 并集存入 dst | O(N) |
| `SINTERCARD numkeys k1 k2 [LIMIT n]` | 交集大小(7.0+,不返回元素) | O(N) |
| `SSCAN k cursor` | 渐进式遍历 | O(1) 每次 |

```bash
# 用户标签系统
SADD user:1001:tags "tech" "music" "travel"
SADD user:1002:tags "music" "food" "travel"

# 共同兴趣(交集)
SINTER user:1001:tags user:1002:tags
# → {"music", "travel"}

# 所有兴趣(并集)
SUNION user:1001:tags user:1002:tags

# 我独有的(差集)
SDIFF user:1001:tags user:1002:tags
# → {"tech"}

# 抽奖:从 set 中随机抽 3 个获奖者(SPOP 取出即删除,不会重复中奖)
SADD lottery:2026 "user_1" "user_2" "user_3" ... "user_1000"
SPOP lottery:2026 3                   # 一次抽 3 个

# 共同关注(微博"我关注他也关注"的人)
SINTER my:following his:following

# 去重:判断 IP/设备是否已访问过某页面
SISMEMBER page:1001:visited_ips "1.2.3.4"
# 不存在 → SADD page:1001:visited_ips "1.2.3.4",计数 +1

# "可能认识的人":A 的好友 ∩ B 的好友 - 我已认识的
SINTER friend:A friend:B
SDIFF 上面结果 friend:me
```

> **Set 的性能陷阱:** `SMEMBERS`、`SINTER`、`SUNION` 在大集合上是 O(N),**大集合不要用**,改用 `SSCAN` 流式遍历。
> **SINTER 多集合时**:结果集 = 最小集合 ∩ 其他,所以传参顺序不重要,但把小集合放前面理论上稍快。
> **抽奖场景用 SPOP 而非 SRANDMEMBER + SREM 两步**:SPOP 是原子的,后者有并发重复中奖风险。

## 2.6 ZSet(Sorted Set,有序集合)

**ZSet 是带分数(score)的集合,按分数升序排列,分数可重复**。它本质是 **skiplist(跳表)+ hashtable 双结构**:skiplist 用于范围查询与排序,hashtable 用于按成员查分数。

```text
ZSet 的实现:
  ┌─ hashtable ── member → score  (O(1) 查分数)
  │
  └─ skiplist  ── score → member  (O(log N) 范围查询/排名)

  为什么用 skiplist 而不是平衡树(RBT/AVL)?
  ① 实现简单(RBT 旋转、再平衡代码量大)
  ② 范围查询简单(找到起点后沿指针扫即可)
  ③ 并发友好(无全局旋转)
```

### 命令速查

| 命令 | 作用 | 复杂度 |
| --- | --- | --- |
| `ZADD k score member [NX\|XX\|GT\|LT\|CH]` | 添加/更新 | O(log N) |
| `ZADD k GT score m` | 分数**更大才更新**(6.2+) | — |
| `ZADD k LT score m` | 分数**更小才更新** | — |
| `ZADD k CH score m` | 返回**变更数**(含更新)而非新增数 | — |
| `ZREM k m1 m2 ...` | 删除成员 | O(log N) |
| `ZSCORE k m` | 取分数 | O(1) |
| `ZMSCORE k m1 m2` | 批量取分数(6.2+) | O(N) |
| `ZRANK k m` | 取**升序排名**(从 0 起) | O(log N) |
| `ZREVRANK k m` | **降序排名** | O(log N) |
| `ZCARD k` | 元素数 | O(1) |
| `ZCOUNT k min max` | 分数区间内元素数 | O(log N) |
| `ZLEXCOUNT k min max` | 字典序区间内元素数(同分时) | O(log N) |
| `ZINCRBY k inc m` | 分数 +inc | O(log N) |
| `ZRANGE k start stop [BYSCORE\|BYLEX] [REV] [LIMIT off cnt] [WITHSCORES]` | **统一范围命令**(6.2+) | O(log N + M) |
| `ZRANGEBYSCORE k min max [LIMIT off cnt]` | 按分数取范围(旧,推荐改用 `ZRANGE BYSCORE`) | O(log N + M) |
| `ZREVRANGEBYSCORE k max min` | 降序分数范围(旧) | O(log N + M) |
| `ZPOPMIN k [count]` | 弹出分数最小的 | O(log N) |
| `ZPOPMAX k [count]` | 弹出分数最大的 | O(log N) |
| `BZPOPMIN k timeout` | 阻塞式 ZPOPMIN | O(log N) |
| `BZPOPMAX k timeout` | 阻塞式 ZPOPMAX | O(log N) |
| `ZRANDMEMBER k [count [WITHSCORES]]` | 随机取(7.0+) | O(N) |
| `ZUNIONSTORE dst num k1 k2 [WEIGHTS w1 w2] [AGG SUM\|MIN\|MAX]` | 并集入 dst | O(N log N) |
| `ZINTERSTORE dst num k1 k2 [WEIGHTS ...] [AGG ...]` | 交集入 dst | O(N×M) |
| `ZDIFFSTORE dst num k1 k2` | 差集入 dst(6.2+) | O(N×M) |
| `ZINTERCARD num k1 k2 [LIMIT n]` | 交集大小(7.0+) | O(N) |
| `ZSCAN k cursor` | 渐进式遍历 | O(1) 每次 |

```bash
# 游戏排行榜(最经典用法)
ZADD leaderboard 1000 "alice"
ZADD leaderboard 1500 "bob"
ZADD leaderboard 1200 "charlie"
ZINCRBY leaderboard 300 "alice"          # alice 加 300 分 → 1300

# Top 10(降序)
ZREVRANGE leaderboard 0 9 WITHSCORES
# 6.2+ 统一写法:
ZRANGE leaderboard 0 9 REV WITHSCORES

# 我的排名(降序,加 1 变成人类可读)
ZREVRANK leaderboard "alice"             # 返回 1 → 实际第 2 名

# 分数区间查询(80~100 分的所有用户)
ZRANGEBYSCORE leaderboard 80 100 WITHSCORES
# 6.2+ 写法:
ZRANGE leaderboard 80 100 BYSCORE WITHSCORES

# 延迟队列(分数 = 触发时间戳,定时任务轮询 ZRANGEBYSCORE 取出已到期的)
ZADD delay_queue 1693056000 "task_1"
ZADD delay_queue 1693056060 "task_2"
# 消费者:
ZRANGEBYSCORE delay_queue 0 <now_timestamp> LIMIT 0 100
ZREM delay_queue 已处理的 task
```

**`ZADD` 的修饰符(6.2+)—— 细节决定成败:**

```bash
# GT:只在 score 大于当前 score 时更新(用于"只允许涨分")
ZADD rank GT 95 "alice"
# 若 alice 已是 100,这次不生效

# LT:只在 score 小于当前时更新(用于"只允许降分")
ZADD rank LT 50 "bob"

# CH:返回值是"变更数"(新增 + 更新),默认只返回新增数
ZADD rank CH 100 "alice" 200 "bob"       # 返回实际改动个数

# NX:member 不存在才加(类似 SET NX)
ZADD rank NX 100 "alice"
# XX:member 存在才更新
ZADD rank XX 200 "alice"
```

> **排行榜的性能:** `ZADD`/`ZREM`/`ZRANK` 都是 O(log N),1000 万成员的排行榜加一个成员也就 20 多次比较,性能极好。
> **但 `ZRANGE 0 9999999` 这种大区间查询会慢**(要遍历整个 skiplist),生产要加 `LIMIT` 分页,或限制榜单只保留 Top N。

## 2.7 通用命令

所有 key 共用的命令,不分类型。

| 命令 | 作用 | 复杂度 |
| --- | --- | --- |
| `DEL k1 k2 ...` | 删除 key(同步,大 key 阻塞) | O(N) |
| **`UNLINK k1 k2 ...`** | **异步删除**(后台线程回收,推荐) | O(1) |
| `EXISTS k1 k2 ...` | 存在几个(可多个,返回存在数) | O(N) |
| `TYPE k` | 类型(string/list/set/zset/hash/stream) | O(1) |
| `EXPIRE k seconds` | 设 TTL(秒) | O(1) |
| `PEXPIRE k ms` | 设 TTL(毫秒) | O(1) |
| `EXPIREAT k unix_ts` | 设 TTL 为 Unix 时间戳 | O(1) |
| `PEXPIREAT k unix_ms` | 毫秒时间戳 | O(1) |
| `EXPIRETIME k` | 取过期时间戳(7.0+) | O(1) |
| `TTL k` | 取剩余 TTL(秒),-1 永不过期,-2 已过期 | O(1) |
| `PTTL k` | 毫秒 | O(1) |
| `PERSIST k` | 取消过期 | O(1) |
| `RENAME old new` | 改名(⚠️ 大 key 重命名会阻塞) | O(1) |
| `RENAMENX old new` | 目标不存在才改 | O(1) |
| **`DUMP k`** | 序列化 key(用于迁移/备份) | O(1) |
| **`RESTORE k ttl serialized`** | 反序列化恢复 key | O(1) |
| **`COPY src dst [REPLACE]`** | 复制 key(6.2+) | O(1) |
| `OBJECT ENCODING k` | 底层编码 | O(1) |
| `OBJECT REFCOUNT k` | 引用计数 | O(1) |
| `OBJECT IDLETIME k` | 上次访问距今秒数 | O(1) |
| `OBJECT FREQ k` | LFU 频率(需 LFU 策略) | O(1) |
| `OBJECT HELP k` | 帮助 | — |
| `RANDOMKEY` | 随机取一个 key | O(1) |
| `SCAN cursor [MATCH pattern] [COUNT n] [TYPE type]` | 渐进式遍历 | O(1) 每次 |
| `SORT k [BY pattern] [LIMIT off cnt] [GET pattern] [ASC\|DESC] [ALPHA] [STORE dst]` | 排序 | O(N log N) |
| `WAIT numreplicas timeout` | 同步复制等待(阻塞直到指定从库确认) | O(1) |

### TTL 与过期机制

```bash
# 设 TTL
EXPIRE session:abc 1800                    # 1800 秒后过期
EXPIREAT session:abc 1704067200            # 某个具体时刻过期
PERSIST session:abc                        # 取消过期

# 看 TTL
TTL session:abc                            # 1799
TTL never_key                              # -1(永不过期)
TTL expired_key                            # -2(已过期或不存在)
```

**Redis 如何删除过期 key?三种机制组合:**

```text
① 惰性删除(访问时):
   客户端访问某个 key 时,先检查是否过期,过期则直接删除并返回 nil
   优点:不浪费 CPU
   缺点:过期 key 不被访问就一直占内存,可能内存泄漏

② 定期删除(定时任务):
   每 100ms 检查一批"设置了 TTL 的 key",删除已过期的
   如果过期比例 > 25%,继续检查下一批(避免一次性删太多卡住)
   优点:折中 CPU 与内存
   缺点:有延迟,过期了不会立刻删

③ 淘汰删除(内存满时):
   内存达到 maxmemory,按策略淘汰 key(见 1.7 节)

三者配合:惰性 + 定期保证日常回收,淘汰兜底极端情况
```

> **TTL 的几个坑:**
> 1. **`RENAME`/`SET` 不带 EX 会覆盖原 key 的 TTL**(新 key 永不过期)!
>    ```bash
>    SET k v EX 60
>    SET k v_new                        # TTL 被清空!
>    # 要保留 TTL 用:SET k v_new KEEPTTL  (6.0+)
>    ```
> 2. **`PERSIST` 取消过期**:从"会过期"变成"永不过期"
> 3. **复制时 TTL 用绝对时间(`PEXPIREAT`)传播**,避免主从时钟差异导致 TTL 不一致
> 4. **`EXPIRE` 命令本身是原子的**,但"读 TTL + 改值 + 续期"不是,要用 Lua 或 `EXPIRETIME` 配合

### SCAN 系列:大 key 安全的遍历

```bash
# SCAN:遍历顶层 key
SCAN 0 MATCH user:* COUNT 100 TYPE string
# 返回:[cursor, [key_list]];cursor=0 表示结束

# HSCAN:遍历 Hash 字段
HSCAN user:1001 0 MATCH email* COUNT 50

# SSCAN:遍历 Set 成员
SSCAN tags:hot 0 COUNT 100

# ZSCAN:遍历 ZSet 成员(返回 member + score 交替)
ZSCAN leaderboard 0 COUNT 100
```

```python
# Python 客户端封装 SCAN 迭代
def scan_all(r, pattern="*"):
    cursor = 0
    while True:
        cursor, keys = r.scan(cursor=cursor, match=pattern, count=1000)
        for k in keys:
            yield k
        if cursor == 0:
            break
```

> **SCAN 的保证与不保证:**
> - ✅ 遍历开始前已存在、且一直没被删除的 key,遍历完**一定**会被返回
> - ⚠️ 遍历过程中新增的 key **可能**返回,也可能不返回
> - ⚠️ 遍历过程中被删除的 key **可能**仍返回一次(客户端要去重)
> - ⚠️ 同一次 SCAN 中可能返回**重复元素**(客户端必须去重)
> - ✅ 不阻塞服务器,生产安全

## 2.8 特殊类型:Bitmap、HyperLogLog、GEO、Stream

### Bitmap(位图)

**本质是 String,按位操作,适合布尔/稀疏状态**。最大 512MB = 2^32 位。

```bash
# 用户签到:第 N 天的签到存在第 N 位
SETBIT user:1001:sign:202609 1 1       # 第 1 天签到
SETBIT user:1001:sign:202609 2 1       # 第 2 天
SETBIT user:1001:sign:202609 3 1       # 第 3 天

GETBIT user:1001:sign:202609 2         # 1,签到了
BITCOUNT user:1001:sign:202609         # 3,签了 3 天

# 在线用户统计(用户 ID 当偏移位)
SETBIT online:20260906 1001 1
SETBIT online:20260906 2005 1
BITCOUNT online:20260906               # 在线人数

# 活跃分析:DAU/MAU、留存、交集
# 9 月 1 日与 9 月 2 日都活跃的用户(交集)
BITOP AND both_days active:20260901 active:20260902
BITCOUNT both_days
# 9 月 1 日或 9 月 2 日活跃的用户(并集)
BITOP OR either_day active:20260901 active:20260902

# 找第一个为 1 的位(找最早签到的用户)
BITPOS online:20260906 1

# 取某字节的位
BITFIELD user:1001:sign:202609 GET u8 0    # 取前 8 位
```

**Bitmap 的空间效率:**

```text
统计 1 亿用户的在线状态:
  普通 Hash:1 亿个 key,每个 key 几十字节 → GB 级
  Bitmap:1 亿位 = 12.5 MB → 百倍压缩!

适用:稀疏但连续 ID 的布尔状态(签到、在线、已读、活跃日)
不适用:稀疏且 ID 跨度大(1 号和 10 亿号都活跃,中间全 0 也占 125MB)
```

### HyperLogLog(基数统计)

**近似统计唯一值个数,误差 ~0.81%,内存固定 12KB**。统计 10 亿个 UV 只用 12KB,比 Set 省几个数量级。

```bash
# 添加元素
PFADD uv:20260906 "user_1" "user_2" "user_1000000"

# 估算基数
PFCOUNT uv:20260906                     # 返回估算的唯一值数量

# 多 HyperLogLog 合并(统计一周的独立访客)
PFMERGE uv:week uv:20260901 uv:20260902 ... uv:20260907
PFCOUNT uv:week

# 典型场景:UV 统计、搜索词去重数、API 调用方统计
PFADD search_terms:202609 "python" "redis" "kafka" "python"
PFCOUNT search_terms:202609            # 3(近似,实际 3)
```

> **何时用 HyperLogLog 而非 Set?**
> - 需要精确唯一值 → Set + SCARD
> - 只需要数量 + 数据量巨大 → HyperLogLog + PFCOUNT
> - 误差可接受(0.81%)、节省几个数量级的内存
>
> **HyperLogLog 不能列出元素**,只能统计数量;需要"看看是谁"的场景用 Set 或 BloomFilter。

### GEO(地理位置)

**存储经纬度,支持距离计算与范围查询**。底层用 **geohash** 编码存入 ZSet。

```bash
# 添加
GEOADD shops 116.40 39.90 "店A" 116.41 39.91 "店B" 116.38 39.92 "店C"
GEOADD shops 116.40 39.90 "店A" 116.41 39.91 "店B" CH   # 6.2+,CH 返回变更数

# 两点距离(单位:m/km/mi/ft)
GEODIST shops "店A" "店B" km            # "1.414"

# 某点半径内的店铺(附近的人)
GEORADIUS shops 116.40 39.91 5 km WITHDIST WITHCOORD ASC COUNT 10
# 6.2+ 新命令 GEOSEARCH 推荐替代 GEORADIUS:
GEOSEARCH shops FROMLONLAT 116.40 39.91 BYRADIUS 5 km WITHDIST COUNT 10 ASC

# 按成员位置查附近
GEOSEARCH shops FROMMEMBER "店A" BYRADIUS 3 km ASC

# 矩形范围
GEOSEARCH shops FROMLONLAT 116.40 39.91 BYBOX 10 10 km

# 取成员的经纬度
GEOPOS shops "店A"                      # [[116.4, 39.9]]

# 取 geohash(用于缓存/索引)
GEOHASH shops "店A"
```

> **GEO 的限制:** ① 不支持极地(经纬度 ±85° 之外);② 距离计算用球面近似,跨极地或长距离误差增大;③ 数据量大时 GEORADIUS 会慢,用 GEOSEARCH 加 `COUNT` 限制。
> **复杂 LBS 场景**(多边形、路径规划、地理围栏)用 **PostgreSQL + PostGIS**。

### Stream(专业消息队列,5.0+)

**Stream 是 Redis 5.0 引入的专业消息队列数据结构**,解决了 List 做队列的痛点:消息有 ID、支持消费者组、支持 ACK、支持历史回溯。对标 Kafka,但轻量得多。

```bash
# 发送消息(返回消息 ID:时间戳-序号)
XADD mystream * name "Alice" age 25
# "1693056000123-0"

XADD mystream * name "Bob" age 30
XADD mystream MAXLEN ~ 1000000 ...   # 自动裁剪,保留最近 100 万条

# 读取消息
XRANGE mystream - + COUNT 10          # 从最早开始,取 10 条
XRANGE mystream 1693056000000-0 +     # 从某 ID 开始
XREVRANGE mystream + - COUNT 10       # 逆序
XLEN mystream                          # 总消息数
XREAD COUNT 10 STREAMS mystream 0     # 多 stream 同时读
XREAD BLOCK 0 STREAMS mystream $      # 阻塞读新消息($ 表示从最新开始)

# 消费者组(类似 Kafka 的 consumer group)
XGROUP CREATE mystream mygroup 0 MKSTREAM    # 创建组,从最早开始
XGROUP CREATE mystream mygroup $             # 从最新开始(只消费新消息)

# 组内消费(PEL = Pending Entries List,待确认消息)
XREADGROUP GROUP mygroup consumer_1 COUNT 10 STREAMS mystream >
# > 表示只读"还没分配给任何消费者"的新消息
# 返回的消息进入 consumer_1 的 PEL,等待 ACK

# ACK 确认(处理完成)
XACK mystream mygroup 1693056000123-0

# 查看 PEL 里长时间未 ACK 的消息
XPENDING mystream mygroup

# 把超时未 ACK 的消息转移给其他消费者(处理失败兜底)
XCLAIM mystream mygroup consumer_2 30000 1693056000123-0
# 30000ms 未 ACK 的消息重新分配给 consumer_2

# 查看消费者组信息
XINFO GROUPS mystream
XINFO CONSUMERS mystream mygroup
XINFO STREAM mystream

# 删除消息
XDEL mystream 1693056000123-0
XTRIM mystream MAXLEN 1000             # 裁剪保留最近 1000 条
```

**Stream vs List vs Kafka:**

| 维度 | List | Stream | Kafka |
| --- | --- | --- | --- |
| 消息 ID | 无(只能按位置) | ✅ 全局唯一,时间戳有序 | ✅ offset |
| 消费者组 | ❌ | ✅ | ✅ |
| ACK 机制 | ❌ | ✅ | ✅ |
| 历史回溯 | 按位置(易错) | 按 ID | 按 offset/时间 |
| 持久化 | Redis 持久化 | Redis 持久化 | 磁盘 + 副本 |
| 容量 | GB 级 | GB 级 | TB 级 |
| 适用 | 简单任务队列 | **中小规模消息队列** | 大数据/日志场景 |

> **Stream 的典型应用:** 轻量消息队列、任务调度、事件溯源、CQRS 的 event store、跨服务通信(小规模)。**超过 Redis 单机容量**或需要多副本强持久化时,升级到 Kafka / RocketMQ / Pulsar。

## 2.9 Pipeline 与 Lua 脚本

### Pipeline(流水线):减少网络往返

```text
普通模式(每条命令一次往返):
  Client → SET a 1 → Server → OK
  Client → SET b 2 → Server → OK
  Client → GET a   → Server → "1"
  Client → GET b   → Server → "2"
  4 次 RTT × 1ms = 4ms

Pipeline(打包发送):
  Client → [SET a 1; SET b 2; GET a; GET b] → Server → [OK; OK; "1"; "2"]
  1 次 RTT + 处理 = 1.1ms

1000 条命令的 RTT 优化:从 1000ms → 1ms,提升 1000 倍
```

```bash
# redis-cli 内使用 Pipeline
redis-cli --pipe < commands.txt

# Python
pipe = r.pipeline()                     # 默认事务模式
pipe = r.pipeline(transaction=False)    # 关闭事务,纯管道
pipe.set('a', 1)
pipe.set('b', 2)
pipe.get('a')
pipe.get('b')
results = pipe.execute()                # 一次性执行,返回 [True, True, '1', '2']
```

> **Pipeline 的限制:**
> - **命令之间不共享上下文**:后一条无法根据前一条的返回值决策
> - **打包太大**会把 Redis 内存吃光、或一次处理太久阻塞其他请求;建议 500~1000 条一批
> - **不是原子操作**:某条失败其他仍会执行(要原子性用 Lua)

### Lua 脚本:服务端原子执行

```text
Lua 脚本在 Redis 服务器上【单线程原子执行】,期间不会被其他命令插入
  → 解决"多条命令之间依赖"的并发问题
  → 例如:判断存在 → 取值 → 修改 → 写回,这四步在 Lua 里是原子的
```

```bash
# 基础用法:EVAL script numkeys key1 key2 ... arg1 arg2 ...
EVAL "return redis.call('GET', KEYS[1])" 1 mykey

# 限流(固定窗口):key 不存在则 SET EX,存在则 INCR
EVAL "
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
if current >= limit then
    return 0  -- 被限流
end
local new_val = redis.call('INCR', key)
if new_val == 1 then
    redis.call('EXPIRE', key, window)
end
return 1  -- 通过
" 1 ratelimit:user:1001 100 60

# 分布式锁的释放(安全删除,只删自己加的锁)
EVAL "
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
else
    return 0
end
" 1 lock:order:1 request_id_abc
```

```python
# Python 端使用
lua_script = """
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
    return 0
end
redis.call('INCR', KEYS[1])
if tonumber(redis.call('TTL', KEYS[1])) == -1 then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return 1
"""
rate_limit = r.register_script(lua_script)
result = rate_limit(keys=['ratelimit:user:1001'], args=[100, 60])
```

**EVALSHA:复用脚本减少传输**

```bash
# 加载脚本,返回 SHA1
SCRIPT LOAD "return redis.call('GET', KEYS[1])"
# "c3a4..."

# 用 SHA 调用(脚本已缓存,只传 40 字节 hash)
EVALSHA "c3a4..." 1 mykey

# 检查脚本是否存在
SCRIPT EXISTS "c3a4..."

# 清空脚本缓存(慎用)
SCRIPT FLUSH
```

> **Lua 的纪律:**
> 1. **脚本要短小**(毫秒级),长时间执行会阻塞所有客户端
> 2. **避免死循环**与 O(N²) 算法
> 3. **KEYS 必须显式传入**,不能硬编码字符串(否则 Cluster 下无法路由)
> 4. **`redis.call` vs `redis.pcall`**:前者失败抛异常中止脚本,后者捕获错误继续
> 5. **不要依赖全局变量**,脚本每次执行是独立沙箱
> 6. 复杂业务用 **7.0+ 的 Function**(可持久化、可调用,比 EVAL 更现代)

```bash
# Redis 7.0+:Function(替代 EVAL 的现代方案)
FUNCTION LOAD "#!lua name=mylib
redis.register_function('myget', function(keys, args)
    return redis.call('GET', keys[1])
end)"
FCALL myget 1 mykey

FUNCTION LIST
FUNCTION DELETE mylib
FUNCTION FLUSH
FUNCTION DUMP / FUNCTION RESTORE     # 跨节点迁移
```

## 2.10 事务(MULTI/EXEC)

```bash
MULTI                            # 开启事务,进入"命令入队"模式
SET a 1
INCR b
EXEC                             # 一次性顺序执行队列中所有命令
# 返回 [OK, 1]

DISCARD                          # 放弃事务

# 乐观锁:WATCH + MULTI
WATCH balance:user:1             # 监听某 key,被其他客户端修改则 EXEC 失败
GET balance:user:1
# 应用层计算新值
MULTI
SET balance:user:1 500
EXEC                             # 若 WATCH 的 key 被改过,EXEC 返回 nil(失败)
```

**Redis 事务的特点(与 SQL 事务对比):**

| 维度 | MySQL 事务 | Redis MULTI/EXEC |
| --- | --- | --- |
| 原子性 | 支持回滚 | ❌ **不支持回滚**!命令执行出错,其他命令仍继续执行 |
| 隔离性 | 多隔离级别 | 仅"串行化"(单线程保证) |
| 一致性 | ACID | 仅"全部执行或全部不执行"(入队阶段的错误会全部拒绝) |
| 持久性 | redo log 保证 | 取决于 AOF 配置(always/everysec) |

> **Redis 事务用得不多**,原因:① 不能回滚,出错了其他命令照样执行;② 单命令本身就是原子的,多数场景不需要事务。
> **真正需要"多步原子操作"时,用 Lua 脚本** —— 它才是 Redis 原子性的标准答案。
> **WATCH 是乐观锁**:适合"读-改-写"并发竞争少的场景;高冲突时重试风暴,不如 Lua 脚本直接原子执行。

## 2.11 发布订阅(Pub/Sub)

```bash
# 订阅者
SUBSCRIBE channel:news              # 订阅单频道
PSUBSCRIBE channel:*                # 按模式订阅

# 发布者
PUBLISH channel:news "Breaking news!"
# 返回接收者数量

# 取消订阅
UNSUBSCRIBE channel:news
PUNSUBSCRIBE channel:*
```

**Pub/Sub 的限制(决定了它不是消息队列):**

| 限制 | 说明 |
| --- | --- |
| **消息不持久化** | 没有订阅者在线时发布的消息**直接丢失** |
| **没有历史消息** | 订阅后只能收之后的消息 |
| **没有 ACK** | 客户端收到就完了,失败无法重试 |
| **所有订阅者收到同一份**(广播) | 不能"竞争消费" |
| **没有消费者组** | — |

> **Pub/Sub 适用:** 实时通知、聊天室、WebSocket 广播、缓存失效通知。
> **不适用:** 任务队列、消息持久化场景(用 Stream 或 Kafka)。
> **7.0 新增 Sharded Pub/Sub**:消息只在指定分片广播,适合 Cluster 模式。

## 2.12 常见问题与最佳实践

1. **`HGETALL`/`SMEMBERS`/`LRANGE 0 -1`/`KEYS` 在大 key 上都是慢命令**,用 `HSCAN`/`SSCAN`/`SCAN` 代替
2. **`INCR`/`DECR` 是原子的**,天然用于计数器、库存扣减,无需外部锁
3. **`SET key val NX EX` 是分布式锁的最小形态**,但要注意安全释放(见 [[后端/数据库/Redis/Redis应用场景与实战]])
4. **String vs Hash 存对象**:整读整写用 String+JSON;频繁改字段用 Hash
5. **List vs Stream 做队列**:简单任务用 List;需要 ACK、消费者组、回溯用 Stream
6. **Set 的交并差**:标签系统、共同关注、去重统计的杀手级能力
7. **ZSet 排行榜**:`ZADD`/`ZRANK`/`ZREVRANGE` 是核心,分数更新 O(log N),1000 万成员也很快
8. **Bitmap 适合连续 ID 的布尔状态**(签到、活跃日),1 亿用户签到只要 12MB
9. **HyperLogLog 估 UV**:10 亿 UV 只用 12KB,误差 0.81%,比 Set 省几个数量级
10. **GEO 用于 LBS**,复杂地理计算用 PostgreSQL + PostGIS
11. **Pipeline 减少网络 RTT**:批量操作必用,但注意打包大小
12. **Lua 脚本是多命令原子性的标准答案**,比 MULTI/EXEC 好用且能回滚逻辑
13. **Pub/Sub 不持久化、不 ACK**,仅适合实时广播;持久化用 Stream
14. **大 key 的 `DEL` 会阻塞**,用 `UNLINK`(异步)或 `lazyfree-lazy-user-del yes`

---

## 本章小结

- Redis 的 value 不是简单字符串,而是 **redisObject**(type + encoding + refcount + lru + ptr),底层根据元素数量自动选择最优编码
- **String**:万金油,缓存/计数/锁/Session/限流;`SET NX EX` 是分布式锁最小形态;`INCR` 原子计数
- **Hash**:对象存储首选,字段级读写高效;底层 listpack 或 hashtable
- **List**:时间线、消息队列;`LPUSH + BRPOP` 阻塞消费模式;复杂队列需求用 Stream
- **Set**:标签、共同关注、去重;`SINTER`/`SUNION`/`SDIFF` 集合运算强大;抽奖用 `SPOP`
- **ZSet**:排行榜核心;底层 skiplist + hashtable;`ZADD GT/LT/CH` 修饰符灵活
- 通用命令:`UNLINK` 优于 `DEL`(异步)、`EXPIRE`/`TTL` 管过期、`SCAN` 替代 `KEYS`
- 过期三机制:**惰性删除 + 定期删除 + 内存满淘汰**,三者配合
- 特殊类型:**Bitmap**(连续 ID 布尔,12MB 存 1 亿用户签到)、**HyperLogLog**(近似 UV,12KB)、**GEO**(LBS,geohash)、**Stream**(专业消息队列,有消费者组与 ACK)
- **Pipeline** 优化 RTT,1000 条命令 1 次往返;**Lua 脚本**是多命令原子性的标准答案(优于 MULTI/EXEC)
- **Pub/Sub** 是广播通知,不持久化不 ACK,不是消息队列
