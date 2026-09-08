---
title: "MongoDB索引与性能优化"
aliases:
  - "MongoDB索引"
  - "MongoDB性能优化"
tags:
  - "后端"
  - "数据库"
  - "mongodb"
  - "索引"
  - "性能优化"
  - "笔记"
category: "后端"
folder: "MongoDB"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MongoDB/MongoDB查询与聚合]]"
  - "[[后端/数据库/MongoDB/MongoDB副本集与高可用]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 04 MongoDB 索引与性能优化

MongoDB 的索引机制与关系型数据库类似，但提供了更多索引类型以适应文档模型。本章介绍各种索引类型、创建策略和性能优化技巧。

## 4.1 索引类型

### 4.1.1 单字段索引

```javascript
// 创建单字段索引（1 升序，-1 降序）
db.users.createIndex({ email: 1 })
db.users.createIndex({ createdAt: -1 })

// 查看索引
db.users.getIndexes()

// 删除索引
db.users.dropIndex("email_1")
```

### 4.1.2 复合索引

```javascript
// 创建复合索引
db.orders.createIndex({ userId: 1, createdAt: -1 })

// 复合索引遵循 ESR 原则
// E - Equality（等值查询字段）
// S - Sort（排序字段）
// R - Range（范围查询字段）

// 示例：查询 userId = 123 且按 createdAt 排序
db.orders.createIndex({ userId: 1, createdAt: -1 })
db.orders.find({ userId: 123 }).sort({ createdAt: -1 })
```

### 4.1.3 多键索引（Multikey Index）

```javascript
// 对数组字段创建索引
db.posts.createIndex({ tags: 1 })

// 文档结构
{ "_id": 1, "tags": ["mongodb", "database", "nosql"] }

// 查询（自动使用多键索引）
db.posts.find({ tags: "mongodb" })

// 注意：不能对多个数组字段创建复合索引
// 错误：db.posts.createIndex({ tags: 1, comments: 1 })
```

### 4.1.4 文本索引

```javascript
// 创建文本索引
db.articles.createIndex({
  title: "text",
  content: "text"
}, {
  weights: {  // 权重
    title: 10,
    content: 1
  },
  default_language: "chinese",  // 默认语言
  name: "article_text_index"
})

// 文本搜索
db.articles.find({ $text: { $search: "mongodb tutorial" } })
```

### 4.1.5 地理空间索引

```javascript
// 2dsphere 索引（球面几何）
db.places.createIndex({ location: "2dsphere" })

// 文档结构（GeoJSON 格式）
{
  "name": "天安门",
  "location": {
    "type": "Point",
    "coordinates": [116.3912757, 39.906217]  // [经度, 纬度]
  }
}

// 2d 索引（平面几何，用于旧数据）
db.places.createIndex({ location: "2d" })
```

### 4.1.6 通配符索引（Wildcard Index，MongoDB 4.2+）

```javascript
// 对所有字段创建索引
db.products.createIndex({ "$**": 1 })

// 对特定路径创建索引
db.products.createIndex({ "attributes.$**": 1 })

// 适用场景：字段不固定或经常变化
```

### 4.1.7 TTL 索引（过期索引）

```javascript
// 创建 TTL 索引（自动删除过期文档）
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }  // 1 小时后过期
)

// 文档结构
{
  "_id": ObjectId("..."),
  "userId": 123,
  "token": "abc123",
  "createdAt": ISODate("2026-09-06T10:00:00Z")  // 1 小时后自动删除
}

// 注意：TTL 索引只能用于日期类型字段
```

### 4.1.8 唯一索引

```javascript
// 创建唯一索引
db.users.createIndex({ email: 1 }, { unique: true })

// 复合唯一索引
db.orders.createIndex(
  { userId: 1, orderId: 1 },
  { unique: true }
)

// 部分唯一索引（MongoDB 3.2+）
db.users.createIndex(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true } }
  }
)
```

## 4.2 索引管理

### 4.2.1 后台创建索引

```javascript
// 后台创建（不阻塞其他操作）
db.users.createIndex({ email: 1 }, { background: true })

// 注意：后台创建速度较慢，但对生产环境影响小
```

### 4.2.2 查看索引使用情况

```javascript
// 查看集合的所有索引
db.users.getIndexes()

// 查看索引统计信息
db.users.aggregate([
  { $indexStats: {} }
])

// 输出示例：
// {
//   "name": "email_1",
//   "accesses": { "ops": 1234, "since": ISODate("...") },
//   "host": "localhost:27017"
// }
```

### 4.2.3 索引大小

```javascript
// 查看索引大小
db.users.stats().indexSizes

// 输出示例：
// {
//   "_id_": 16384,
//   "email_1": 32768,
//   "createdAt_-1": 24576
// }

// 总索引大小
db.users.totalIndexSize()
```

## 4.3 查询优化

### 4.3.1 explain 分析

```javascript
// 查看查询执行计划
db.users.explain("executionStats").find({ email: "test@example.com" })

// 执行模式
// "queryPlanner" - 只显示查询计划（默认）
// "executionStats" - 显示执行统计
// "allPlansExecution" - 显示所有计划的执行统计

// 关键字段
// "winningPlan.stage" - 使用的阶段（IXSCAN 表示使用索引）
// "executionStats.totalDocsExamined" - 扫描的文档数
// "executionStats.totalKeysExamined" - 扫描的索引键数
// "executionStats.nReturned" - 返回的文档数
// "executionStats.executionTimeMillis" - 执行时间（毫秒）
```

### 4.3.2 查询优化技巧

**1. 使用投影减少数据传输**

```javascript
// ❌ 返回所有字段
db.users.find({ status: "active" })

// ✅ 只返回需要的字段
db.users.find({ status: "active" }, { name: 1, email: 1, _id: 0 })
```

**2. 避免大结果集**

```javascript
// ❌ 可能返回大量文档
db.logs.find({ level: "error" })

// ✅ 使用 limit 限制
db.logs.find({ level: "error" }).limit(100)
```

**3. 使用覆盖索引**

```javascript
// 创建覆盖索引（包含查询和投影的所有字段）
db.users.createIndex({ status: 1, name: 1 })

// 查询（只扫描索引，不访问文档）
db.users.find({ status: "active" }, { name: 1, _id: 0 })
```

**4. 避免 $where 查询**

```javascript
// ❌ $where 很慢（无法使用索引）
db.users.find({ $where: "this.age > 18 && this.age < 30" })

// ✅ 使用普通查询
db.users.find({ age: { $gt: 18, $lt: 30 } })
```

**5. 优化排序**

```javascript
// 创建排序索引
db.orders.createIndex({ userId: 1, createdAt: -1 })

// 查询（使用索引排序，避免内存排序）
db.orders.find({ userId: 123 }).sort({ createdAt: -1 })

// 注意：内存排序限制 32MB，超过会报错
```

## 4.4 性能监控

### 4.4.1 慢查询日志（Profiling）

```javascript
// 设置 profiling 级别
// 0 - 关闭
// 1 - 记录慢查询（默认阈值 100ms）
// 2 - 记录所有查询

db.setProfilingLevel(1, { slowms: 100 })

// 查看 profiling 状态
db.getProfilingStatus()

// 查看慢查询日志
db.profile.find().sort({ ts: -1 }).limit(10)

// 查看特定集合的慢查询
db.profile.find({ ns: "mydb.users" }).sort({ ts: -1 })
```

### 4.4.2 实时监控

```javascript
// 查看当前操作
db.currentOp()

// 查看长时间运行的操作
db.currentOp({
  $or: [
    { secs_running: { $gt: 3 } },
    { "lockStats.timeAcquiringMicros": { $gt: 1000000 } }
  ]
})

// 终止操作
db.killOp(opid)
```

### 4.4.3 服务器状态

```javascript
// 服务器状态
db.serverStatus()

// 关键指标
// "connections.current" - 当前连接数
// "connections.available" - 可用连接数
// "opcounters.query" - 查询操作数
// "opcounters.insert" - 插入操作数
// "opcounters.update" - 更新操作数
// "opcounters.delete" - 删除操作数
// "mem.resident" - 常驻内存（MB）
// "mem.virtual" - 虚拟内存（MB）
// "extra_info.page_faults" - 页面错误数
```

## 4.5 性能优化清单

### 4.5.1 索引优化

- ✅ 为频繁查询的字段创建索引
- ✅ 使用复合索引遵循 ESR 原则
- ✅ 定期删除未使用的索引
- ✅ 使用 explain 分析查询计划
- ✅ 监控索引大小，避免内存不足

### 4.5.2 查询优化

- ✅ 使用投影只返回需要的字段
- ✅ 使用 limit 限制结果数量
- ✅ 避免大数组的 $unwind
- ✅ 避免 $where 查询
- ✅ 使用覆盖索引减少文档访问

### 4.5.3 聚合优化

- ✅ $match 放在管道开头
- ✅ 尽早使用 $project 减少文档大小
- ✅ 使用 $limit 限制结果
- ✅ 避免大数组的 $unwind

### 4.5.4 配置优化

```yaml
# mongod.conf

# WiredTiger 缓存（建议物理内存的 50% - 1GB）
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4

# 连接数限制
net:
  maxIncomingConnections: 10000

# 操作日志大小（建议 10GB+）
oplogSizeMB: 10240
```

---

## 本章小结

- MongoDB 支持多种索引类型：单字段、复合、多键、文本、地理空间、TTL、唯一索引
- 复合索引遵循 ESR 原则（等值、排序、范围）
- 使用 explain 分析查询执行计划
- 性能优化：使用投影、覆盖索引、避免 $where、优化排序
- 监控慢查询和服务器状态
- 定期清理未使用的索引
