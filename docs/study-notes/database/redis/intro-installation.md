---
title: "Redis入门与安装配置"
aliases:
  - "Redis入门"
  - "Redis安装"
tags:
  - "后端"
  - "数据库"
  - "redis"
  - "缓存"
  - "笔记"
category: "后端"
folder: "Redis"
parent: "[[目录]]"
related:
  - "[[后端/数据库/Redis/Redis数据类型与命令]]"
  - "[[后端/数据库/Redis/Redis持久化]]"
  - "[[后端/数据库/Redis/Redis线程模型与高性能原理]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 01 Redis 入门与安装配置

Redis(REmote DIctionary Server)是 2009 年由 Salvatore Sanfilippo(antirez)用 C 语言开发的**开源内存键值数据库**。它把数据放在内存中,读写速度极快(单机 10 万+ QPS),同时提供持久化与高可用能力,是后端架构中缓存与轻量数据 store 的事实标准。

**官方资源:** 官网 https://redis.io ;文档 https://redis.io/docs ;GitHub https://github.com/redis/redis ;中文社区 http://redis.cn

本章覆盖:Redis 定位与特性、为什么快、安装与启动、redis-cli、redis.conf 配置详解、客户端连接(各语言)、Key 设计规范。

## 1.1 Redis 是什么

| 维度 | 说明 |
| --- | --- |
| 类型 | 内存键值(Key-Value)数据库,数据结构服务器 |
| 存储 | 数据主要在**内存**,可选持久化到磁盘(RDB/AOF) |
| 数据模型 | key → value,value 支持 String/Hash/List/Set/ZSet 等多种数据结构 |
| 语言 | C(核心),约 15 万行,代码精简 |
| 协议 | 自定义 RESP(REdis Serialization Protocol),简单高效 |
| 线程模型 | **单线程处理命令**(6.0 起网络 IO 多线程,命令执行仍单线程) |
| 许可 | 7.4 前 BSD;7.4 起改为 RSALv2/SSPLv1 双许可(引发 Valkey 分叉) |

**Redis 与传统数据库的定位差异:**

| | Redis | MySQL |
| --- | --- | --- |
| 存储介质 | 内存(快、贵、容量有限) | 磁盘(慢、便宜、容量大) |
| 数据模型 | Key-Value + 数据结构 | 关系模型(表/行/列) |
| 查询能力 | 按 key 操作,无复杂 SQL | 完整 SQL,JOIN、聚合、子查询 |
| 事务 | 弱事务(不支持回滚) | 完整 ACID |
| 一致性 | 最终一致 | 强一致 |
| 典型角色 | **缓存、计数器、会话、排行榜、锁、队列** | **主数据存储** |

> **Redis 不是 MySQL 的替代品,而是补充。** 经典架构是"MySQL 存全量数据 + Redis 挡热点读",两者配合。

### Redis 能做什么(六大经典角色)

| 角色 | 用到的能力 | 详见 |
| --- | --- | --- |
| **缓存** | 高速读、TTL 过期 | [[后端/数据库/Redis/Redis缓存设计]] |
| **分布式锁** | `SET NX EX`、Redlock | [[后端/数据库/Redis/Redis应用场景与实战]] |
| **计数器** | `INCR` 原子自增 | [[后端/数据库/Redis/Redis应用场景与实战]] |
| **排行榜** | ZSet 有序集合 | [[后端/数据库/Redis/Redis应用场景与实战]] |
| **消息队列** | List / Stream / Pub-Sub | [[后端/数据库/Redis/Redis应用场景与实战]] |
| **会话存储 Session** | Hash + TTL,多节点共享 | [[后端/数据库/Redis/Redis应用场景与实战]] |

## 1.2 为什么 Redis 这么快(高频考点)

```text
① 纯内存操作
   数据在内存,读写不涉及磁盘寻道
   内存访问 ~100ns,磁盘随机 IO ~10ms,差 10 万倍

② 单线程模型(命令执行)
   · 没有多线程竞争与锁开销
   · 没有上下文切换(context switch)的 CPU 消耗
   · 单线程 = 命令天然串行执行 = 每个命令都是原子的

③ IO 多路复用(epoll)
   一个线程用 epoll 同时监听成千上万个连接,
   哪个连接有数据就处理哪个,不为每个连接开线程
   (Reactor 模式:多路复用 + 事件驱动)

④ 高效的数据结构
   每种类型底层都有针对性优化的编码:
   · SDS(动态字符串)、跳表(skiplist)、压缩列表(listpack)、
     哈希表(dict)、整数集合(intset)
   · 小数据量用紧凑编码省内存,大数据量自动升级为高性能编码

⑤ 自定义 RESP 协议
   简单的文本协议,解析快,不需要复杂的 SQL 解析与优化
```

> **重要辨析:Redis 6.0 的多线程。**
> 6.0 引入多线程,但**只用于网络 IO(读写 socket、协议解析)**,命令的执行**仍然是单线程**。
> 原因:命令执行多线程会引入锁竞争,破坏"单命令原子性"这一核心优势,得不偿失。网络 IO 是瓶颈所在(高并发时 socket 读写占用大量 CPU),所以只把这部分多线程化。
> 开启:`io-threads 4` + `io-threads-do-reads yes`。

### 单线程带来的两个推论

1. **每个命令都是原子的**:不会被打断,所以 `INCR`、`SETNX`、`LPUSH` 等天然线程安全,可直接用于并发计数、加锁
2. **禁止慢命令**:一个慢命令会阻塞后面所有命令(单线程串行)!`KEYS *`、`FLUSHALL`、大 key 的 `DEL`、`HGETALL` 百万字段的 hash 都是灾难

```bash
# 生产禁用/重命名危险命令(redis.conf)
rename-command KEYS ""              # 禁用 KEYS(改用 SCAN)
rename-command FLUSHALL ""          # 禁用清空所有库
rename-command FLUSHDB ""
rename-command CONFIG "CONFIG_b9f2" # 重命名,增加误操作门槛
```

## 1.3 版本选择

| 版本 | 关键特性 |
| --- | --- |
| 2.6 | Lua 脚本 |
| 2.8 | Sentinel 稳定、`SCAN` 系列命令 |
| 3.0 | **Redis Cluster**(官方集群) |
| 3.2 | GEO 地理、`HSET` 多字段 |
| 4.0 | **模块化**、`PSYNC2`、LFU 淘汰、异步删除 `UNLINK` |
| 5.0 | **Stream**(专业消息队列数据结构) |
| 6.0 | **多线程 IO**、**ACL 权限控制**、RESP3 协议、客户端缓存 |
| 6.2 | `COPY`、`GETDEL`、`SMISMEMBER`、更多命令 |
| 7.0 | **Function**、ACL v2、多 part AOF、sharded pubsub、listpack 全面替代 ziplist |
| 7.2 / 7.4 | 性能优化;7.4 改许可证(RSALv2/SSPLv1) |
| 8.0 | 集成 Redis Stack 能力(时序、JSON、搜索、概率数据结构) |

> **7.4 的许可证变更与 Valkey:** 2024 年 Redis 7.4 从 BSD 改为 RSALv2 + SSPLv1 双许可(限制云厂商提供托管服务)。Linux Foundation 随即基于 7.2 分叉出开源的 **Valkey**(BSD 许可),AWS、Google、Oracle 等支持。功能上目前高度兼容,学习 Redis 命令与原理对两者通用。生产选型时注意许可合规。

**学习/生产建议:** 本笔记基于 **Redis 7.x**。生产选 7.0+ 的稳定小版本,或云托管(AWS ElastiCache、阿里云 Redis);在意纯开源许可可选 Valkey。

## 1.4 安装

### macOS

```bash
brew install redis                   # 安装
brew services start redis            # 后台启动(开机自启)
brew services stop redis
redis-server --version               # 验证
```

### Linux(Ubuntu/Debian)

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
redis-server --version
```

### Linux(源码编译,可指定版本)

```bash
# 安装依赖
sudo apt install -y build-essential tcl pkg-config libssl-dev

# 下载编译
wget https://download.redis.io/releases/redis-7.2.5.tar.gz
tar -xzf redis-7.2.5.tar.gz
cd redis-7.2.5
make -j4                             # 编译
make test                            # 跑测试(可选,耗时长)
sudo make install PREFIX=/usr/local/redis   # 安装到指定目录

# 安装后的可执行文件
# redis-server  服务端
# redis-cli     命令行客户端
# redis-benchmark  性能压测
# redis-check-rdb / redis-check-aof  持久化文件检查修复
# redis-sentinel   哨兵(等价于 redis-server --sentinel)
```

### Docker(开发最快)

```bash
# 单节点
docker run -d --name redis7 -p 6379:6379 \
  -v redis_data:/data \
  redis:7.2 \
  redis-server --requirepass "yourpassword" --appendonly yes

docker exec -it redis7 redis-cli -a yourpassword
```

```yaml
# docker-compose.yml(带配置文件与持久化)
services:
  redis:
    image: redis:7.2
    container_name: redis7
    ports: ["6379:6379"]
    volumes:
      - ./redis.conf:/usr/local/etc/redis/redis.conf
      - redis_data:/data
    command: redis-server /usr/local/etc/redis/redis.conf
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
volumes:
  redis_data:
```

### 验证安装

```bash
redis-cli ping           # 返回 PONG 即正常
redis-cli -a yourpassword ping
redis-cli INFO server | grep redis_version
```

## 1.5 启动与运行

```bash
# 最简启动(前台,默认 6379,无密码,仅开发)
redis-server

# 指定配置文件启动(生产必须)
redis-server /etc/redis/redis.conf

# 指定端口
redis-server --port 6380

# 命令行覆盖配置项(优先级高于配置文件)
redis-server --port 6380 --requirepass "pwd" --daemonize yes

# 后台运行
redis-server --daemonize yes

# 优雅关闭
redis-cli -a yourpassword shutdown nosave   # 不保存直接关
redis-cli -a yourpassword shutdown save     # 保存 RDB 后关

# 进程与端口检查
ps -ef | grep redis-server
lsof -i :6379
```

> **`daemonize yes` 的注意:** 生产环境如果用 systemd 管理,应设 `daemonize no`,让 systemd 直接管理前台进程(否则 systemd 会认为服务启动失败)。Docker 中也必须前台运行。

## 1.6 redis-cli 客户端

```bash
# 连接
redis-cli                            # 本地默认 6379
redis-cli -h 192.168.1.100 -p 6379   # 远程
redis-cli -a yourpassword            # 带密码(会有 warning,建议用下面的方式)
redis-cli --user alice --pass pwd    # 6.0 ACL 指定用户
REDISCLI_AUTH=pwd redis-cli          # 密码走环境变量,避免泄露到 history

# 执行单条命令
redis-cli -a pwd SET name redis
redis-cli -a pwd GET name

# 执行多条(管道)
echo -e "SET a 1\nGET a" | redis-cli

# 导入 SQL 风格的数据文件
redis-cli -a pwd < commands.txt

# 反复执行(压测/监控)
redis-cli -r 100 -i 1 INFO | grep used_memory   # 重复 100 次,间隔 1 秒
redis-cli -r 5 ping                              # ping 5 次

# 查看延迟
redis-cli --latency -h host -p port              # 持续测试延迟
redis-cli --latency-history -i 5                 # 每 5 秒输出一次

# 监控实时命令(生产慎用,会显著降低性能)
redis-cli MONITOR
```

### redis-cli 内的常用命令

```bash
PING                    # 返回 PONG,测连通
ECHO "msg"              # 回显,调试用
SELECT 0                # 切换数据库(0~15,默认 0)
DBSIZE                  # 当前库的 key 数量
INFO [section]          # 服务器信息(memory/cpu/clients/stats/replication/persistence/keyspace...)
CONFIG GET maxmemory    # 查配置
CONFIG SET maxmemory 2gb# 改配置(立即生效,重启丢失)
CONFIG REWRITE          # 把内存中的配置写回 redis.conf
CLIENT LIST             # 所有客户端连接
CLIENT KILL ID 123      # 断开指定客户端
TIME                    # 服务器时间(秒 + 微秒)
LASTSAVE                # 上次成功保存 RDB 的 Unix 时间
FLUSHDB [ASYNC]         # 清空当前库(危险!)
FLUSHALL [ASYNC]        # 清空所有库(危险!)
SHUTDOWN [NOSAVE|SAVE]  # 关闭服务
SLOWLOG GET 10          # 慢查询日志
MEMORY DOCTOR           # 内存诊断建议
MEMORY USAGE key        # 某个 key 占用的字节数
```

> **`FLUSHDB`/`FLUSHALL` 加 `ASYNC` 参数**可以异步删除(后台线程回收内存),避免删除大量 key 时阻塞主线程。7.0 起 `flushall-async-by-default yes` 可设为默认异步。

## 1.7 redis.conf 配置详解

```conf
########## 网络 ##########
bind 127.0.0.1 -::1          # 监听的 IP;生产内网填内网 IP;0.0.0.0 监听所有(危险)
port 6379                     # 端口,0 表示禁用 TCP(只用 unix socket)
tcp-backlog 511               # TCP 连接队列长度,高并发可调大(需同时调内核 somaxconn)
timeout 0                     # 客户端空闲多少秒后断开,0 = 不断开
tcp-keepalive 300             # 每 300 秒探测客户端存活,检测死连接
protected-mode yes            # 保护模式:没配 bind 和密码时,只允许本地连接(安全兜底)

########## 通用 ##########
daemonize no                  # 是否后台运行(systemd/docker 下用 no)
supervised systemd            # 与进程管理器交互(auto/systemd/upstart/no)
pidfile /var/run/redis.pid
loglevel notice               # 日志级别:debug/verbose/notice/warning
logfile /var/log/redis/redis.log
databases 16                  # 数据库数量(0~15);Cluster 模式下只能用 db0

########## 安全 ##########
requirepass yourStrongPassword      # 连接密码(所有命令前需 AUTH)
# 6.0+ ACL 更细粒度:
# user alice on >password ~cache:* +get +set   # 只能对 cache:* 执行 get/set
# 用户配置建议放独立的 aclfile:
aclfile /etc/redis/users.acl

########## 内存 ##########
maxmemory 2gb                 # 最大内存上限;0 = 不限制(危险,会 OOM)
maxmemory-policy allkeys-lru  # 内存满时的淘汰策略(见下)
maxmemory-samples 5           # LRU/LFU 采样精度,越大越准但越耗 CPU
# 7.0 内存碎片整理
activedefrag yes              # 自动碎片整理
active-defrag-ignore-bytes 100mb
active-defrag-threshold-lower 10   # 碎片率达 10% 开始整理

########## 持久化(详见 [[后端/数据库/Redis/Redis持久化]])##########
# RDB 快照
save 3600 1                   # 3600 秒内至少 1 个 key 变化则快照
save 300 100                  # 300 秒内至少 100 个
save 60 10000                 # 60 秒内至少 10000 个
save ""                       # 禁用 RDB
dbfilename dump.rdb
dir /var/lib/redis            # 数据目录(RDB/AOF 都存这里)
rdbcompression yes            # RDB 压缩
rdbchecksum yes               # RDB 校验和

# AOF
appendonly yes                # 开启 AOF
appendfilename "appendonly.aof"
appendfsync everysec          # always/everysec/no,推荐 everysec
no-appendfsync-on-rewrite no  # 重写时是否暂停 fsync
auto-aof-rewrite-percentage 100   # AOF 比上次重写后增大 100% 触发重写
auto-aof-rewrite-min-size 64mb    # AOF 至少 64MB 才触发重写

########## 复制(详见 [[后端/数据库/Redis/Redis集群与高可用]])##########
replicaof <masterip> <masterport>   # 设为某主库的从库
masterauth yourpassword              # 主库密码(主库设了 requirepass 时)
replica-serve-stale-data yes         # 与主库断开时,是否继续用旧数据响应读
replica-read-only yes                # 从库只读(推荐)
repl-diskless-sync no                # 无盘复制(网络慢、磁盘快时有用)

########## 客户端 ##########
maxclients 10000              # 最大客户端连接数,超过拒绝新连接

########## 慢查询 ##########
slowlog-log-slower-than 10000 # 慢查询阈值(微秒),10000 = 10ms
slowlog-max-len 128           # 慢查询日志保留条数

########## 高级:惰性删除(异步,避免大 key 阻塞)##########
lazyfree-lazy-eviction yes    # 淘汰时异步删除
lazyfree-lazy-expire yes      # 过期时异步删除
lazyfree-lazy-server-del yes  # 隐式删除(rename 等)异步
lazyfree-lazy-user-del yes    # DEL 命令等同于 UNLINK(异步)

########## IO 线程(6.0+,高并发时开启)##########
io-threads 4                  # 网络 IO 线程数,建议 CPU 核数的一半以内
io-threads-do-reads yes       # 读也用 IO 线程
```

### maxmemory-policy 内存淘汰策略(高频考点)

当内存达到 `maxmemory` 时,新写入触发淘汰。8 种策略:

| 策略 | 淘汰范围 | 算法 | 说明 |
| --- | --- | --- | --- |
| `noeviction` | — | 不淘汰 | **默认**,内存满时写入直接报错(读仍可用) |
| `allkeys-lru` | **所有 key** | 最近最少使用 | **最常用**,纯缓存场景推荐 |
| `volatile-lru` | 设了 TTL 的 key | LRU | 只淘汰有过期时间的 |
| `allkeys-lfu` | 所有 key | 最不经常使用 | 4.0+,按访问频率淘汰,更适合有明显热点 |
| `volatile-lfu` | 设了 TTL 的 key | LFU | — |
| `allkeys-random` | 所有 key | 随机 | 无明显热点时 |
| `volatile-random` | 设了 TTL 的 key | 随机 | — |
| `volatile-ttl` | 设了 TTL 的 key | 剩余时间最短优先 | 让快过期的先走 |

> **选型:**
> - **纯缓存**(数据在 MySQL 有备份,丢了能回源):`allkeys-lru` 或 `allkeys-lfu`
> - **缓存 + 持久数据混用**:给缓存 key 都设 TTL,用 `volatile-lru`,避免误淘汰持久数据
> - **数据不能丢**:`noeviction`,但要监控内存,快满时扩容或报警
>
> **LRU(Least Recently Used)** 淘汰"最久没被访问的";**LFU(Least Frequently Used)** 淘汰"访问次数最少的"。Redis 的 LRU 是**近似 LRU**(随机采样 `maxmemory-samples` 个 key,淘汰其中最久未用的),不是精确 LRU(省内存)。LFU 用计数器 + 衰减,能防止"偶尔被访问一次的冷数据"逃过 LRU 淘汰。

## 1.8 各语言客户端连接

### Python(redis-py,官方推荐)

```bash
pip install redis
```

```python
import redis

# 单节点连接
r = redis.Redis(
    host='localhost', port=6379, db=0,
    password='yourpassword',
    decode_responses=True,        # 自动把 bytes 解码成 str(否则拿到 b'value')
    socket_timeout=5,             # 读写超时
    socket_connect_timeout=5,     # 连接超时
    retry_on_timeout=True,        # 超时重试
    health_check_interval=30,     # 连接健康检查
)

# 连接池(生产必用,避免每次新建连接)
pool = redis.ConnectionPool(
    host='localhost', port=6379, password='pwd',
    max_connections=50,           # 最大连接数
    decode_responses=True,
)
r = redis.Redis(connection_pool=pool)

# 基本操作
r.set('name', 'redis')
print(r.get('name'))              # 'redis'
r.setex('temp', 60, 'value')      # 带 60 秒过期
r.incr('counter')
print(r.ping())                   # True
```

```python
# 异步客户端(redis-py 4.2+ 内置 asyncio 支持,FastAPI 常用)
import redis.asyncio as aioredis

r = aioredis.from_url(
    "redis://:password@localhost:6379/0",
    decode_responses=True,
    max_connections=50,
)
value = await r.get("key")
await r.aclose()      # 关闭(旧版用 close)
```

### Java(Jedis / Lettuce / Redisson)

| 客户端 | 特点 |
| --- | --- |
| **Jedis** | 老牌,API 直观,但实例非线程安全,需配连接池 |
| **Lettuce** | 基于 Netty,**线程安全、支持异步/响应式**,Spring Boot 2.x 默认 |
| **Redisson** | 功能最全,分布式对象/锁/集合的高级封装,分布式锁首选 |

```java
// Jedis + 连接池
JedisPoolConfig config = new JedisPoolConfig();
config.setMaxTotal(50);
config.setMaxIdle(10);
config.setMinIdle(5);
config.setTestOnBorrow(true);
JedisPool pool = new JedisPool(config, "localhost", 6379, 5000, "password");

try (Jedis jedis = pool.getResource()) {      // try-with-resources 自动归还连接
    jedis.set("name", "redis");
    System.out.println(jedis.get("name"));
}
```

```java
// Lettuce(线程安全,单例即可)
RedisClient client = RedisClient.create("redis://password@localhost:6379/0");
StatefulRedisConnection<String, String> connection = client.connect();
RedisCommands<String, String> sync = connection.sync();
sync.set("name", "redis");
String value = sync.get("name");
// 异步:RedisAsyncCommands async = connection.async(); async.get("key").thenAccept(...)
```

### Go(go-redis)

```bash
go get github.com/redis/go-redis/v9
```

```go
import (
    "context"
    "github.com/redis/go-redis/v9"
)

rdb := redis.NewClient(&redis.Options{
    Addr:         "localhost:6379",
    Password:     "yourpassword",
    DB:           0,
    PoolSize:     50,               // 连接池大小
    MinIdleConns: 10,
    DialTimeout:  5 * time.Second,
    ReadTimeout:  3 * time.Second,
})

ctx := context.Background()
rdb.Set(ctx, "name", "redis", 0)                 // 0 = 不过期
val, err := rdb.Get(ctx, "name").Result()
// Cluster: redis.NewClusterClient(&redis.ClusterOptions{...})
```

### Node.js(ioredis)

```bash
npm install ioredis
```

```javascript
import Redis from 'ioredis';

const redis = new Redis({
    host: 'localhost', port: 6379, password: 'pwd',
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000),   // 重连退避
});

await redis.set('name', 'redis');
const val = await redis.get('name');
```

### 连接的最佳实践(通用)

1. **必须用连接池**:建立 TCP 连接 + AUTH 有开销,复用连接是基本要求
2. **设置超时**:`socket_timeout` / `DialTimeout`,避免 Redis 卡住拖垮应用线程
3. **连接池大小**:≈ 应用并发数;总和要小于 Redis 的 `maxclients`
4. **`decode_responses=True`(Python)**:否则所有值都是 bytes,处理麻烦
5. **集群模式用对应客户端**:`RedisCluster` / `Lettuce Cluster` / `NewClusterClient`
6. **不要每次操作新建连接**(反模式):`redis.Redis()` 应作为单例/依赖注入

## 1.9 Key 设计规范

```text
推荐格式:业务:对象:标识[:字段]
  user:1001:profile
  order:20260906:count
  cache:product:10086
  lock:order:1001
  session:abc123token
```

| 规范 | 说明 |
| --- | --- |
| **用冒号分层** | `:` 是社区约定的分隔符,便于用 `SCAN user:*` 前缀匹配、可视化工具按目录树展示 |
| **见名知意** | `u:1:n` 太短看不懂;`user:1:name` 清晰 |
| **不要太长** | key 也占内存,百万级 key 时超长 key 浪费显著;`user_session_token_for_xxx` 太长 |
| **不要太短** | `u1n` 可读性差,排查困难 |
| **统一大小写与风格** | 全小写 + 下划线/冒号,团队一致 |
| **不含特殊字符** | 空格、换行、`{}`(Cluster 里 `{}` 是 hash tag,有特殊含义) |
| **控制 key 总数** | 避免无限增长(如无 TTL 的日志类 key),防内存打满 |

```bash
# ❌ 危险:KEYS 是 O(N) 全库扫描,单线程下会阻塞所有请求!
KEYS user:*

# ✅ 用 SCAN 渐进式遍历(游标,不阻塞)
SCAN 0 MATCH user:* COUNT 100
# 返回:游标 + 一批 key;用返回的游标继续,直到游标为 0
1) "17"                 # 下一个游标,0 表示遍历结束
2) 1) "user:1001"
   2) "user:1002"

# SCAN 的特性:
# · 不会阻塞服务器(每次只遍历少量)
# · 可能返回重复元素(客户端要去重)
# · 保证:遍历开始前就存在、且一直存在的 key 一定会被返回
# · COUNT 是"每次遍历多少个槽"的提示,不是返回数量
```

> **`KEYS *` 是生产事故头号杀手。** 百万 key 的库执行 `KEYS *` 会阻塞数秒甚至数十秒,期间所有请求排队,极易引发雪崩。**必须用 `SCAN` 代替**,或在 redis.conf 里直接 `rename-command KEYS ""` 禁用。
> 类似地,`HGETALL`(大 hash)、`SMEMBERS`(大 set)、`LRANGE 0 -1`(大 list)对大 key 也是慢命令,要用 `HSCAN`/`SSCAN`/`LRANGE 分段` 代替。

### 大 Key 与热 Key(生产隐患)

| 问题 | 定义 | 危害 | 解决 |
| --- | --- | --- | --- |
| **大 Key** | String > 10KB,或 Hash/List/Set/ZSet 元素 > 5000 个 | 单次操作慢、阻塞主线程、内存不均、网络打满、删除卡顿 | 拆分(大 hash 按字段分桶)、异步删除 `UNLINK` |
| **热 Key** | 某个 key 访问量极高(如秒杀商品) | 单分片 CPU 打满、集群负载不均 | 本地缓存、key 打散加随机后缀、读写分离 |

```bash
# 找大 key
redis-cli --bigkeys                        # 采样扫描各类最大的 key
redis-cli --memkeys                        # 7.0,按内存占用
MEMORY USAGE user:1001                     # 单个 key 的字节数
redis-cli --scan --pattern 'user:*' | head # 配合脚本统计

# 找热 key(需 Redis 4.0+ 且开启 LFU)
redis-cli --hotkeys

# 删除大 key:用 UNLINK 异步删,不阻塞主线程
UNLINK bigkey                              # 而不是 DEL bigkey
# 或分批删:大 hash 用 HSCAN + HDEL 循环
```

## 1.10 常见问题与最佳实践

1. **生产必须设 `requirepass`**(或 ACL),`protected-mode yes`,`bind` 不暴露公网
2. **必须设 `maxmemory` + 合理淘汰策略**,否则内存打满会被 OS 的 OOM Killer 杀掉或触发 swap(性能雪崩)
3. **禁用危险命令**:`KEYS`、`FLUSHALL`、`FLUSHDB`、`CONFIG` 重命名或禁用
4. **用 `SCAN` 系列代替全量遍历**,禁止 `KEYS *`
5. **应用侧必须用连接池 + 设超时**,单例复用连接
6. **Key 用冒号分层、见名知意**,统一命名规范
7. **警惕大 Key 与热 Key**:定期 `--bigkeys`/`--hotkeys` 巡检,大 key 拆分、异步删除
8. **纯缓存场景**用 `allkeys-lru/lfu`;**混合场景**给缓存设 TTL 用 `volatile-lru`
9. **关闭 swap** 或设 `vm.swappiness=0`,Redis 数据被换到磁盘性能断崖式下降
10. **`daemonize` 配合 systemd/docker 时设 no**,让进程管理器接管
11. **不要在 Redis 存不能丢的唯一数据源**(弱持久化),它定位为缓存/加速层
12. **升级注意 7.4 许可证变更**,介意开源许可选 Valkey

---

## 本章小结

- Redis 是内存键值数据库,定位是 MySQL 的**补充**(缓存/计数器/锁/排行榜/队列/会话),不是替代
- 快的五个原因:**纯内存 + 单线程(无锁无切换)+ IO 多路复用(epoll)+ 高效数据结构 + 简洁 RESP 协议**
- **6.0 的多线程只用于网络 IO,命令执行仍单线程** —— 保住单命令原子性
- 单线程两推论:① 每个命令天然原子;② **禁止慢命令**(`KEYS *`/大 key 操作会阻塞全局)
- 安装:brew / apt / 源码 make / docker;生产用配置文件启动
- `redis.conf` 核心:`bind`/`requirepass`(安全)、`maxmemory`/`maxmemory-policy`(内存)、`appendonly`/`save`(持久化)
- 淘汰策略:纯缓存用 `allkeys-lru/lfu`,混合用 `volatile-lru`,不能丢用 `noeviction`
- 客户端:Python redis-py、Java Lettuce/Redisson、Go go-redis、Node ioredis;**必须连接池 + 超时**
- **Key 设计**:冒号分层、见名知意、用 SCAN 不用 KEYS
- 生产隐患:**大 Key**(阻塞、内存不均)、**热 Key**(单分片打满),要巡检与拆分
- 7.4 许可证改为 RSALv2/SSPL,开源分叉 Valkey 可选
