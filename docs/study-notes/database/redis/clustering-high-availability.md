# 05 Redis 集群与高可用

单机 Redis 存在两个致命问题：**单点故障**（宕机即服务中断）和**容量瓶颈**（内存受限于单机）。本章介绍 Redis 的三种高可用方案：**主从复制**、**哨兵模式（Sentinel）**、**集群模式（Cluster）**，以及生产环境的最佳实践。

## 5.1 主从复制（Replication）

### 5.1.1 原理

主从复制是 Redis 高可用的基础：**一个主节点（Master）+ 多个从节点（Replica）**，主节点负责写，从节点负责读，数据自动同步。

```text
主从复制架构：
  
  Master (写) ──┬──→ Replica-1 (读)
                ├──→ Replica-2 (读)
                └──→ Replica-3 (读)

数据流向：
  ① 客户端写 Master
  ② Master 将写命令同步到所有 Replica
  ③ 客户端可从 Replica 读（读分离）
```

### 5.1.2 同步机制

**全量同步（Full Resynchronization）**：
- **触发场景**：从节点首次连接主节点、从节点断线时间过长
- **流程**：
  1. 主节点执行 `BGSAVE` 生成 RDB 快照
  2. 主节点将 RDB 文件发送给从节点
  3. 从节点加载 RDB 到内存
  4. 主节点将缓冲区中的增量命令发送给从节点
  5. 从节点执行增量命令，完成同步

**增量同步（Partial Resynchronization）**：
- **触发场景**：从节点短暂断线后重连（默认 1 分钟内）
- **流程**：
  1. 从节点发送 `PSYNC &lt;runid&gt; &lt;offset&gt;` 给主节点
  2. 主节点检查 runid 和 offset 是否匹配
  3. 如果匹配，从 repl_backlog 缓冲区发送缺失的命令
  4. 从节点执行缺失命令，完成同步

```text
repl_backlog 缓冲区：
  · 环形缓冲区，默认 1MB
  · 记录主节点最近传播的写命令
  · 用于断线重连时的增量同步
  · 配置：repl-backlog-size 1mb
```

### 5.1.3 配置主从

**方式一：配置文件**

```ini
# replica.conf（从节点配置）
port 6380
replicaof 127.0.0.1 6379    # 指向主节点
masterauth yourpassword      # 主节点密码（如果主节点设置了 requirepass）
```

**方式二：命令行**

```bash
# 动态配置从节点
redis-cli -p 6380
> REPLICAOF 127.0.0.1 6379
OK

# 查看复制状态
> INFO replication
# master_repl_offset:12345
# slave0:ip=127.0.0.1,port=6380,state=online,offset=12345,lag=0

# 取消主从关系
> REPLICAOF NO ONE
OK
```

### 5.1.4 主从复制的优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 读写分离，提升读性能 | ❌ **主节点单点故障** |
| ✅ 数据冗余，提高可用性 | ❌ 全量同步时主节点 fork 卡顿 |
| ✅ 配置简单，易于维护 | ❌ 不支持自动故障转移 |
| ✅ 从节点可横向扩展 | ❌ 写能力受限于单主节点 |

**适用场景**：
- 读多写少，需要读写分离
- 可以容忍手动故障转移
- 数据量不大（< 32GB）

## 5.2 哨兵模式（Sentinel）

### 5.2.1 原理

哨兵模式在主从复制基础上增加**自动故障转移**能力：当主节点宕机时，哨兵自动将某个从节点提升为新主节点。

```text
哨兵架构：
  
  Sentinel-1 ─┐
  Sentinel-2 ─┼──→ 监控 Master 和 Replica
  Sentinel-3 ─┘
  
  Master (写) ──┬──→ Replica-1 (读)
                ├──→ Replica-2 (读)
                └──→ Replica-3 (读)

故障转移流程：
  ① Sentinel 集群检测到 Master 下线（主观下线 → 客观下线）
  ② Sentinel 投票选举新 Master（优先选择 Replica）
  ③ Sentinel 通知所有 Replica 切换主节点
  ④ Sentinel 通知客户端新 Master 地址
  ⑤ 旧 Master 恢复后自动变为 Replica
```

### 5.2.2 哨兵的核心职责

| 职责 | 说明 |
|------|------|
| **监控** | 定期 PING 主从节点，检测是否存活 |
| **通知** | 主从节点故障时，通知管理员或其他系统 |
| **故障转移** | 主节点不可用时，自动选举新主节点 |
| **配置中心** | 客户端连接哨兵获取当前主节点地址 |

### 5.2.3 配置哨兵

```ini
# sentinel.conf（哨兵配置）
port 26379
daemonize yes

# 监控主节点（格式：sentinel monitor <master-name> <ip> <port> <quorum>）
sentinel monitor mymaster 127.0.0.1 6379 2
# quorum=2 表示至少 2 个哨兵同意才能判定客观下线

# 主节点密码
sentinel auth-pass mymaster yourpassword

# 主观下线超时（30 秒无响应视为主观下线）
sentinel down-after-milliseconds mymaster 30000

# 故障转移超时（整个故障转移过程的最大时间）
sentinel failover-timeout mymaster 180000

# 并行同步数（故障转移后，同时从新主节点同步数据的从节点数）
sentinel parallel-syncs mymaster 1
```

**启动哨兵**：

```bash
redis-sentinel /path/to/sentinel.conf
# 或
redis-server /path/to/sentinel.conf --sentinel
```

### 5.2.4 哨兵的选举算法

**主观下线（Subjectively Down, SDOWN）**：
- 单个哨兵在 `down-after-milliseconds` 内无法连接主节点
- 仅该哨兵认为主节点下线

**客观下线（Objectively Down, ODOWN）**：
- 多个哨兵（≥ quorum）都报告主节点 SDOWN
- Sentinel 集群达成共识，确认主节点下线

**Leader 选举**：
- 使用 **Raft 算法**选举一个 Sentinel 作为 Leader
- Leader 负责执行故障转移

**新 Master 选择优先级**：
1. 从节点优先级（`replica-priority`，越小越优先）
2. 复制偏移量（offset 越大，数据越新）
3. Run ID（字典序越小越优先）

### 5.2.5 客户端连接哨兵

```python
# Python redis-py
from redis.sentinel import Sentinel

sentinel = Sentinel([
    ('sentinel1', 26379),
    ('sentinel2', 26379),
    ('sentinel3', 26379)
], socket_timeout=0.1)

# 获取主节点连接（自动感知故障转移）
master = sentinel.master_for('mymaster', socket_timeout=0.1)
master.set('foo', 'bar')

# 获取从节点连接（读分离）
slave = sentinel.slave_for('mymaster', socket_timeout=0.1)
print(slave.get('foo'))
```

```java
// Java Jedis
Set<String> sentinels = new HashSet<>();
sentinels.add("sentinel1:26379");
sentinels.add("sentinel2:26379");
sentinels.add("sentinel3:26379");

JedisSentinelPool pool = new JedisSentinelPool(
    "mymaster", sentinels, poolConfig, password
);

try (Jedis jedis = pool.getResource()) {
    jedis.set("foo", "bar");
}
```

### 5.2.6 哨兵的优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 自动故障转移，高可用 | ❌ **写能力受限于单主节点** |
| ✅ 客户端无感知（透明切换） | ❌ 数据量受限于单机内存 |
| ✅ 支持读写分离 | ❌ 故障转移期间短暂不可用（秒级） |
| ✅ 配置相对简单 | ❌ 脑裂问题（网络分区时可能双主） |

**脑裂问题**：
```text
场景：网络分区导致 Sentinel 与 Master 失联

  分区前：
    Master (M1) ←── Sentinel 集群
  
  分区后：
    Master (M1)    Sentinel 集群 ──→ 选举新 Master (M2)
  
  结果：两个 Master 同时接受写请求，数据不一致

解决方案：
  · 配置 min-replicas-to-write（最少从节点数）
  · 配置 min-replicas-max-lag（从节点最大延迟）
  · 当从节点不足时，主节点拒绝写请求
```

**适用场景**：
- 需要自动故障转移
- 数据量中等（< 64GB）
- 可以容忍秒级不可用

## 5.3 Redis Cluster（集群模式）

### 5.3.1 原理

Redis Cluster 是官方的分布式方案，通过**数据分片（Sharding）** 将数据分散到多个主节点，每个主节点可以有多个从节点。

```text
Redis Cluster 架构（3 主 3 从）：
  
  Master-1 (slots 0-5460)    ──→ Replica-1
  Master-2 (slots 5461-10922) ──→ Replica-2
  Master-3 (slots 10923-16383) ──→ Replica-3

核心概念：
  · 16384 个哈希槽（Hash Slot）
  · 每个 key 通过 CRC16(key) % 16384 映射到槽
  · 每个主节点负责一部分槽
  · 客户端可连接任意节点，节点自动重定向到正确节点
```

### 5.3.2 数据路由机制

**客户端写流程**：

```text
① 客户端发送 SET mykey value 到任意节点（如 Node-A）
② Node-A 计算 CRC16("mykey") % 16384 = 12345
③ Node-A 发现槽 12345 不在自己这里，返回 MOVED 12345 192.168.1.3:6379
④ 客户端重定向到 192.168.1.3:6379（Node-C）
⑤ Node-C 执行 SET 命令
```

**MOVED vs ASK**：

| 重定向类型 | 触发场景 | 客户端行为 |
|-----------|---------|-----------|
| **MOVED** | 槽已永久迁移到其他节点 | 更新本地路由表，后续直接请求新节点 |
| **ASK** | 槽正在迁移中（MIGRATE 过程中） | 先发 `ASKING` 命令，再发实际命令 |

### 5.3.3 集群搭建

**方式一：redis-cli 自动创建（推荐）**

```bash
# 准备 6 个节点（3 主 3 从）
redis-server --port 7000 --cluster-enabled yes --cluster-config-file nodes-7000.conf
redis-server --port 7001 --cluster-enabled yes --cluster-config-file nodes-7001.conf
redis-server --port 7002 --cluster-enabled yes --cluster-config-file nodes-7002.conf
redis-server --port 7003 --cluster-enabled yes --cluster-config-file nodes-7003.conf
redis-server --port 7004 --cluster-enabled yes --cluster-config-file nodes-7004.conf
redis-server --port 7005 --cluster-enabled yes --cluster-config-file nodes-7005.conf

# 创建集群（--cluster-replicas 1 表示每个主节点 1 个从节点）
redis-cli --cluster create \
  127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1

# 查看集群状态
redis-cli -p 7000 CLUSTER INFO
redis-cli -p 7000 CLUSTER NODES
```

**方式二：手动配置**

```ini
# redis.conf（每个节点）
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 15000
cluster-require-full-coverage yes  # 槽未全覆盖时是否拒绝服务
```

```bash
# 手动添加节点到集群
redis-cli -p 7000 CLUSTER MEET 127.0.0.1 7001
redis-cli -p 7000 CLUSTER MEET 127.0.0.1 7002

# 分配槽
redis-cli -p 7000 CLUSTER ADDSLOTS {0..5460}
redis-cli -p 7001 CLUSTER ADDSLOTS {5461..10922}
redis-cli -p 7002 CLUSTER ADDSLOTS {10923..16383}

# 添加从节点
redis-cli -p 7003 CLUSTER REPLICATE <master-node-id>
```

### 5.3.4 集群的故障转移

**自动故障转移流程**：

```text
① 主节点宕机
② 其他主节点检测到该节点 PFAIL（Possible Fail）
③ 超过半数主节点标记为 FAIL（客观下线）
④ 该主节点的从节点发起选举
⑤ 超过半数主节点投票同意
⑥ 从节点提升为新主节点，接管原主节点的槽
⑦ 集群广播新配置
```

**手动故障转移**：

```bash
# 手动触发从节点提升为主节点
redis-cli -p 7003 CLUSTER FAILOVER

# 强制故障转移（即使原主节点在线）
redis-cli -p 7003 CLUSTER FAILOVER FORCE
```

### 5.3.5 集群的扩缩容

**添加新主节点**：

```bash
# 1. 启动新节点
redis-server --port 7006 --cluster-enabled yes

# 2. 加入集群
redis-cli --cluster add-node 127.0.0.1:7006 127.0.0.1:7000

# 3. 重新分片（从现有节点迁移槽到新节点）
redis-cli --cluster reshard 127.0.0.1:7000 \
  --cluster-from <node-id> \
  --cluster-to <new-node-id> \
  --cluster-slots 4096
```

**删除节点**：

```bash
# 1. 迁移槽到其他节点
redis-cli --cluster reshard 127.0.0.1:7006 \
  --cluster-from <node-id> \
  --cluster-to <other-node-id> \
  --cluster-slots 4096

# 2. 删除节点
redis-cli --cluster del-node 127.0.0.1:7006 <node-id>
```

### 5.3.6 集群的限制

| 限制 | 说明 | 解决方案 |
|------|------|---------|
| **不支持跨槽的多 key 操作** | `MGET key1 key2` 如果 key1 和 key2 不在同一槽会报错 | 使用 `&#123;hashtag&#125;` 强制同槽 |
| **不支持 SELECT 命令** | 只能用 db0 | — |
| **事务支持有限** | `MULTI/EXEC` 只能操作同一槽的 key | 使用 Lua 脚本 |
| **Pub/Sub 广播到所有节点** | 性能开销大 | 使用 `SSUBSCRIBE`（7.0+） |

**Hash Tag（强制同槽）**：

```bash
# 使用 {tag} 让多个 key 映射到同一槽
SET {user:1000}.name "Alice"
SET {user:1000}.age 25
SET {user:1000}.email "alice@example.com"
# 这三个 key 的 CRC16("{user:1000}") 相同，会落在同一槽

# 现在可以跨 key 操作
MGET {user:1000}.name {user:1000}.age
```

### 5.3.7 客户端连接集群

```python
# Python redis-py
from redis.cluster import RedisCluster

startup_nodes = [
    {"host": "127.0.0.1", "port": "7000"},
    {"host": "127.0.0.1", "port": "7001"},
]

rc = RedisCluster(
    startup_nodes=startup_nodes,
    decode_responses=True,
    skip_full_coverage_check=True,
)

rc.set("foo", "bar")
print(rc.get("foo"))
```

```java
// Java Jedis
Set<HostAndPort> nodes = new HashSet<>();
nodes.add(new HostAndPort("127.0.0.1", 7000));
nodes.add(new HostAndPort("127.0.0.1", 7001));

JedisCluster jc = new JedisCluster(nodes, timeout, timeout, maxAttempts, password, poolConfig);
jc.set("foo", "bar");
```

### 5.3.8 集群的优缺点

| 优点 | 缺点 |
|------|------|
| ✅ **水平扩展**，突破单机容量限制 | ❌ 配置复杂，运维成本高 |
| ✅ 自动分片，对应用透明 | ❌ 不支持跨槽的多 key 操作 |
| ✅ 自动故障转移，高可用 | ❌ 数据迁移时性能抖动 |
| ✅ 支持在线扩缩容 | ❌ 内存开销大（每个节点存全量槽信息） |

**适用场景**：
- 数据量大（> 64GB），单机无法承载
- 需要高并发写
- 可以接受一定运维复杂度

## 5.4 三种方案对比

| 维度 | 主从复制 | 哨兵模式 | 集群模式 |
|------|---------|---------|---------|
| **架构** | 1 主 N 从 | 1 主 N 从 + 哨兵集群 | N 主 M 从 |
| **故障转移** | ❌ 手动 | ✅ 自动 | ✅ 自动 |
| **写扩展** | ❌ 单主节点 | ❌ 单主节点 | ✅ 多主节点 |
| **读扩展** | ✅ 从节点读 | ✅ 从节点读 | ✅ 从节点读 |
| **容量上限** | 单机内存 | 单机内存 | 集群总内存 |
| **复杂度** | 低 | 中 | 高 |
| **客户端支持** | 所有客户端 | 需支持 Sentinel | 需支持 Cluster |
| **适用场景** | 读多写少，小数据 | 需要自动故障转移 | 大数据，高并发写 |

## 5.5 生产环境最佳实践

### 5.5.1 架构选择

```text
决策树：
  
  数据量 < 32GB，读多写少？
    → 主从复制 + 读写分离
  
  需要自动故障转移？
    → 哨兵模式
  
  数据量 > 64GB，或写并发高？
    → Redis Cluster
```

### 5.5.2 集群配置建议

```ini
# redis.conf（集群节点）
# 内存
maxmemory 8gb
maxmemory-policy allkeys-lru

# 持久化（集群模式建议关闭 RDB，只开 AOF）
save ""
appendonly yes
appendfsync everysec

# 集群
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 15000
cluster-require-full-coverage no  # 部分节点故障时仍提供服务

# 网络
tcp-backlog 511
timeout 0
tcp-keepalive 300

# 安全
requirepass yourpassword
masterauth yourpassword

# 性能优化
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
replica-lazy-flush yes
```

### 5.5.3 监控指标

```bash
# 集群状态
redis-cli -p 7000 CLUSTER INFO
# cluster_state:ok
# cluster_slots_assigned:16384
# cluster_slots_ok:16384
# cluster_slots_pfail:0
# cluster_slots_fail:0

# 节点信息
redis-cli -p 7000 CLUSTER NODES

# 关键监控项
redis-cli INFO replication
redis-cli INFO memory
redis-cli INFO stats
```

**告警阈值**：

| 指标 | 阈值 | 说明 |
|------|------|------|
| `cluster_state` | != ok | 集群异常 |
| `cluster_slots_fail` | > 0 | 有槽不可用 |
| `connected_slaves` | < 预期值 | 从节点掉线 |
| `used_memory` | > 80% maxmemory | 内存不足 |
| `master_link_status` | down | 主从断连 |

### 5.5.4 常见问题排查

**Q1：集群状态 not ok**

```bash
# 检查哪些槽未覆盖
redis-cli --cluster check 127.0.0.1:7000

# 修复未覆盖的槽
redis-cli --cluster fix 127.0.0.1:7000
```

**Q2：客户端频繁 MOVED 重定向**

```bash
# 原因：客户端路由表过期
# 解决：更新客户端库，或重启客户端刷新路由表
```

**Q3：集群扩容后数据不均**

```bash
# 重新平衡槽分布
redis-cli --cluster rebalance 127.0.0.1:7000
```

## 5.6 高可用架构演进

```text
阶段 1：单机 Redis
  · 开发/测试环境
  · 无高可用需求

阶段 2：主从复制 + 读写分离
  · 读多写少场景
  · 可以容忍手动故障转移

阶段 3：哨兵模式
  · 需要自动故障转移
  · 数据量中等（< 64GB）

阶段 4：Redis Cluster
  · 大数据量（> 64GB）
  · 高并发写
  · 需要水平扩展

阶段 5：Codis / Twemproxy（代理层分片）
  · 客户端不支持 Cluster 协议
  · 需要透明分片
  · 已逐渐被 Redis Cluster 取代
```

**总结**：
- **小数据 + 读多写少**：主从复制
- **需要自动故障转移**：哨兵模式
- **大数据 + 高并发**：Redis Cluster
- **生产环境推荐**：至少哨兵模式，大数据量用 Cluster
