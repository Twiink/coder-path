---
title: "MongoDB分片与扩展"
aliases:
  - "MongoDB分片"
  - "MongoDB Sharding"
tags:
  - "后端"
  - "数据库"
  - "mongodb"
  - "分片"
  - "扩展"
  - "笔记"
category: "后端"
folder: "MongoDB"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MongoDB/MongoDB副本集与高可用]]"
  - "[[后端/数据库/MongoDB/MongoDB实战与最佳实践]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 06 MongoDB 分片与扩展

当单个副本集无法满足存储和性能需求时，MongoDB 提供分片（Sharding）机制实现水平扩展。本章介绍分片架构、部署配置、分片键选择和常见问题。

## 6.1 分片架构

### 6.1.1 三大组件

```text
MongoDB 分片集群架构：

┌─────────────────────────────────────────────────┐
│                   客户端                         │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│              mongos（路由层）                    │
│    · 接收客户端请求                              │
│    · 路由到正确的分片                            │
│    · 合并结果返回                                │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Shard 0  │  │ Shard 1  │  │ Shard 2  │
│ 分片副本集│  │ 分片副本集│  │ 分片副本集│
│          │  │          │  │          │
│ 数据子集  │  │ 数据子集  │  │ 数据子集  │
└──────────┘  └──────────┘  └──────────┘
        │            │            │
        └────────────┴────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│         Config Server（配置服务器）              │
│    · 存储集群元数据                              │
│    · 分片配置、chunk 分布                        │
│    · 必须是副本集（至少 3 节点）                  │
└─────────────────────────────────────────────────┘
```

### 6.1.2 组件说明

| 组件 | 作用 | 部署要求 |
|------|------|---------|
| **mongos** | 路由层，分发请求 | 无状态，可水平扩展 |
| **Shard** | 存储数据子集 | 必须是副本集 |
| **Config Server** | 存储元数据 | 必须是副本集（3 节点） |

## 6.2 分片键（Shard Key）

### 6.2.1 分片策略

**范围分片（Range-based）**：

```javascript
// 按范围分片
sh.shardCollection("mydb.orders", { "createdAt": 1 })

// 数据分布
// Shard 0: createdAt < "2026-01-01"
// Shard 1: "2026-01-01" <= createdAt < "2026-07-01"
// Shard 2: createdAt >= "2026-07-01"
```

**哈希分片（Hashed）**：

```javascript
// 创建哈希索引
db.orders.createIndex({ "_id": "hashed" })

// 按哈希分片
sh.shardCollection("mydb.orders", { "_id": "hashed" })

// 数据均匀分布到各分片
```

**分片策略对比**：

| 特性 | 范围分片 | 哈希分片 |
|------|---------|---------|
| 数据分布 | 可能不均匀 | 均匀分布 |
| 范围查询 | 高效（只访问相关分片） | 低效（需要访问所有分片） |
| 点查询 | 高效 | 高效 |
| 写入热点 | 可能出现 | 均匀分散 |
| 适用场景 | 时间序列、有序数据 | 随机访问、ID 查询 |

### 6.2.2 分片键选择原则

```text
好的分片键特征：
  ✅ 高基数（Cardinality）：值分布均匀
  ✅ 查询频繁：大部分查询包含分片键
  ✅ 写入分散：避免热点
  ✅ 不可变：值不会频繁变化

坏的分片键特征：
  ❌ 低基数：如 status（只有几个值）
  ❌ 单调递增：如时间戳（导致写入热点）
  ❌ 很少在查询中使用
  ❌ 频繁更新
```

### 6.2.3 复合分片键

```javascript
// 复合分片键（范围 + 哈希）
sh.shardCollection("mydb.events", {
  "userId": 1,
  "eventId": "hashed"
})

// 优势：
// · 同一用户的数据在同一分片（减少跨分片查询）
// · 不同用户均匀分布（避免热点）
```

## 6.3 部署分片集群

### 6.3.1 配置服务器（Config Server）

```bash
# 启动 3 个配置服务器节点
mongod --configsvr --replSet configReplSet \
  --port 27019 \
  --dbpath /data/config0 \
  --bind_ip localhost,192.168.1.10

mongod --configsvr --replSet configReplSet \
  --port 27020 \
  --dbpath /data/config1 \
  --bind_ip localhost,192.168.1.11

mongod --configsvr --replSet configReplSet \
  --port 27021 \
  --dbpath /data/config2 \
  --bind_ip localhost,192.168.1.12

# 初始化配置服务器副本集
mongosh --port 27019
rs.initiate({
  _id: "configReplSet",
  configsvr: true,
  members: [
    { _id: 0, host: "192.168.1.10:27019" },
    { _id: 1, host: "192.168.1.11:27020" },
    { _id: 2, host: "192.168.1.12:27021" }
  ]
})
```

### 6.3.2 分片服务器（Shard）

```bash
# 每个分片是一个副本集（至少 3 个节点）
# Shard 0
mongod --shardsvr --replSet shard0 \
  --port 27018 \
  --dbpath /data/shard0-0 \
  --bind_ip localhost,192.168.1.20

# 类似地启动 shard0-1, shard0-2
# 以及 shard1, shard2...

# 初始化每个分片的副本集
mongosh --port 27018
rs.initiate({
  _id: "shard0",
  members: [
    { _id: 0, host: "192.168.1.20:27018" },
    { _id: 1, host: "192.168.1.21:27018" },
    { _id: 2, host: "192.168.1.22:27018" }
  ]
})
```

### 6.3.3 路由服务器（mongos）

```bash
# 启动 mongos
mongos --configdb configReplSet/192.168.1.10:27019,192.168.1.11:27020,192.168.1.12:27021 \
  --port 27017 \
  --bind_ip localhost,192.168.1.30

# 多个 mongos 实例（负载均衡）
mongos --configdb configReplSet/... --port 27017 --bind_ip localhost,192.168.1.31
mongos --configdb configReplSet/... --port 27017 --bind_ip localhost,192.168.1.32
```

### 6.3.4 添加分片

```javascript
// 连接到 mongos
mongosh --port 27017

// 添加分片
sh.addShard("shard0/192.168.1.20:27018,192.168.1.21:27018,192.168.1.22:27018")
sh.addShard("shard1/192.168.1.30:27018,192.168.1.31:27018,192.168.1.32:27018")
sh.addShard("shard2/192.168.1.40:27018,192.168.1.41:27018,192.168.1.42:27018")

// 查看分片状态
sh.status()

// 启用数据库分片
sh.enableSharding("mydb")

// 对集合分片
sh.shardCollection("mydb.orders", { "_id": "hashed" })
```

## 6.4 数据迁移与平衡

### 6.4.1 Chunk（数据块）

```text
Chunk：
  · 分片数据的基本单位
  · 默认大小：64MB（可调整 1MB-1024MB）
  · 每个 chunk 包含连续的 shard key 范围

Chunk 分裂：
  · 当 chunk 超过最大大小时自动分裂
  · 分裂只更新元数据，不移动数据

Chunk 迁移：
  · balancer 自动平衡各分片的 chunk 数量
  · 迁移是后台进行的，对客户端透明
```

### 6.4.2 手动平衡

```javascript
// 查看平衡器状态
sh.getBalancerState()
sh.isBalancerRunning()

// 启用/禁用平衡器
sh.setBalancerState(true)
sh.setBalancerState(false)

// 手动移动 chunk
sh.moveChunk("mydb.orders", { "_id": 1000 }, "shard1")

// 设置迁移时间窗口（避免业务高峰期迁移）
db.adminCommand({
  setBalancerWindow: {
    start: "02:00",  // 凌晨 2 点
    stop: "06:00"    // 早上 6 点
  }
})
```

## 6.5 分片集群操作

### 6.5.1 查询路由

```javascript
// 包含分片键的查询（定向查询）
db.orders.find({ _id: 123 })
// mongos 直接路由到包含该 _id 的分片

// 不包含分片键的查询（广播查询）
db.orders.find({ status: "completed" })
// mongos 向所有分片发送查询，合并结果

// 范围查询
db.orders.find({ _id: { $gte: 100, $lt: 200 } })
// mongos 只查询包含该范围的分片
```

### 6.5.2 跨分片操作

```javascript
// 跨分片聚合
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: { _id: "$userId", total: { $sum: "$amount" } } }
])
// mongos 在各分片上执行聚合，然后合并结果

// 跨分片更新（必须包含分片键）
db.orders.updateMany(
  { _id: { $in: [1, 2, 3] } },
  { $set: { status: "shipped" } }
)
```

## 6.6 监控与维护

### 6.6.1 集群状态

```javascript
// 查看分片状态
sh.status()

// 输出示例：
// --- Sharding Status ---
//   sharding version: { ... }
//   shards:
//     { "_id": "shard0", "host": "shard0/..." }
//     { "_id": "shard1", "host": "shard1/..." }
//   databases:
//     { "_id": "mydb", "partitioned": true }
//       mydb.orders
//         shard key: { "_id": "hashed" }
//         chunks:
//           shard0  4
//           shard1  4
```

### 6.6.2 性能监控

```javascript
// 查看分片统计
db.stats()

// 查看 chunk 分布
db.getSiblingDB("config").chunks.aggregate([
  { $match: { ns: "mydb.orders" } },
  { $group: { _id: "$shard", count: { $sum: 1 } } }
])

// 查看迁移历史
db.getSiblingDB("config").changelog.find().sort({ time: -1 }).limit(10)
```

## 6.7 常见问题

### 6.7.1 分片键选择错误

```text
问题：选择了低基数的分片键（如 status）
结果：数据分布不均，某些分片负载过高

解决：
  1. 重新选择分片键（高基数）
  2. 使用复合分片键
  3. 无法更改分片键，需要重新分片
```

### 6.7.2 热点分片

```text
问题：单调递增的分片键（如时间戳）导致写入集中在最新分片
结果：某个分片成为瓶颈

解决：
  1. 使用哈希分片
  2. 使用复合分片键
  3. 添加更多分片
```

### 6.7.3 跨分片查询性能差

```text
问题：查询不包含分片键，需要广播到所有分片
结果：查询慢，资源消耗大

解决：
  1. 优化查询，包含分片键
  2. 创建二级索引
  3. 考虑重新设计分片键
```

## 6.8 最佳实践

### 6.8.1 部署建议

```text
生产环境配置：
  · Config Server：3 节点副本集（独立硬件）
  · 每个 Shard：至少 3 节点副本集
  · mongos：至少 2 个（负载均衡）
  · 分片数量：根据数据量和性能需求决定

硬件要求：
  · Config Server：中等性能，SSD
  · Shard：高性能，大内存，SSD
  · mongos：中等性能，CPU 密集
```

### 6.8.2 运维建议

```text
监控指标：
  · chunk 分布均衡性
  · 迁移频率和持续时间
  · 各分片的负载和资源使用
  · mongos 的连接数和响应时间

维护任务：
  · 定期检查平衡器状态
  · 监控 chunk 分布
  · 避免在业务高峰期进行迁移
  · 定期备份配置服务器
```

---

## 本章小结

- 分片集群由 mongos、Shard、Config Server 三部分组成
- 分片键选择是关键：高基数、查询频繁、写入分散
- 范围分片适合范围查询，哈希分片适合均匀分布
- 数据以 chunk 为单位分布和迁移
- 包含分片键的查询是定向查询，性能更好
- 监控 chunk 分布和平衡器状态
- 生产环境至少 3 个 config server，每个 shard 是副本集
