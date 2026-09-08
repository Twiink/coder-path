---
title: "MongoDB数据模型与CRUD"
aliases:
  - "MongoDB CRUD"
  - "MongoDB数据模型"
tags:
  - "后端"
  - "数据库"
  - "mongodb"
  - "笔记"
category: "后端"
folder: "MongoDB"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MongoDB/MongoDB入门与安装配置]]"
  - "[[后端/数据库/MongoDB/MongoDB查询与聚合]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 02 MongoDB 数据模型与 CRUD

MongoDB 的文档模型和 CRUD 操作是其核心。本章介绍文档设计模式、CRUD 操作、写关注（Write Concern）和数据验证。

## 2.1 文档设计模式

### 2.1.1 嵌入 vs 引用

**嵌入文档（Embedding）**：

```javascript
// 用户及其地址嵌入在一起
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "name": "张三",
  "address": {
    "city": "北京",
    "street": "朝阳区",
    "zipcode": "100000"
  }
}
```

**引用（Referencing）**：

```javascript
// 用户文档
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "name": "张三",
  "addressId": ObjectId("507f1f77bcf86cd799439012")
}

// 地址文档（单独集合）
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "city": "北京",
  "street": "朝阳区"
}
```

### 2.1.2 设计原则

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 1:1 关系 | 嵌入 | 读取高效，一次查询 |
| 1:少（如用户 + 几个地址） | 嵌入 | 文档不会太大 |
| 1:多（如用户 + 大量订单） | 引用 | 避免文档过大 |
| 多:多 | 引用 | 避免数据冗余 |
| 频繁一起读取 | 嵌入 | 减少查询次数 |
| 独立更新频繁 | 引用 | 避免并发更新冲突 |
| 数据需要复用 | 引用 | 避免数据冗余和不一致 |

### 2.1.3 常见设计模式

**树形结构**：

```javascript
// 方式 1：父引用
{ "_id": 1, "name": "root", "parent": null }
{ "_id": 2, "name": "child1", "parent": 1 }
{ "_id": 3, "name": "child2", "parent": 1 }

// 方式 2：祖先数组（适合查询子树）
{ "_id": 1, "name": "root", "ancestors": [] }
{ "_id": 2, "name": "child1", "ancestors": [1] }
{ "_id": 3, "name": "grandchild", "ancestors": [1, 2] }

// 查询所有子孙
db.categories.find({ ancestors: 1 })

// 方式 3：物化路径（适合面包屑）
{ "_id": 1, "name": "Books", "path": "" }
{ "_id": 2, "name": "Programming", "path": ",Books," }
{ "_id": 3, "name": "MongoDB", "path": ",Books,Programming," }

// 查询某分类下的所有子孙
db.categories.find({ path: /^,Books,/ })
```

**时间序列数据**（MongoDB 5.0+）：

```javascript
// 创建时间序列集合
db.createCollection("weather", {
  timeseries: {
    timeField: "timestamp",
    metaField: "location",
    granularity: "hours"
  }
})

// 插入数据
db.weather.insertMany([
  { timestamp: ISODate("2026-09-06T10:00:00Z"), location: "北京", temp: 25 },
  { timestamp: ISODate("2026-09-06T11:00:00Z"), location: "北京", temp: 26 }
])
```

## 2.2 创建文档（Create）

### 2.2.1 insertOne

```javascript
db.users.insertOne({
  name: "张三",
  age: 28,
  email: "zhangsan@example.com",
  createdAt: new Date()
})
// 返回：{ acknowledged: true, insertedId: ObjectId("...") }
```

### 2.2.2 insertMany

```javascript
db.users.insertMany([
  { name: "李四", age: 25, email: "lisi@example.com" },
  { name: "王五", age: 30, email: "wangwu@example.com" }
])
// 返回：{ acknowledged: true, insertedIds: { '0': ObjectId("..."), '1': ObjectId("...") } }

// ordered: false（无序插入，遇到错误继续）
db.users.insertMany([...], { ordered: false })
```

### 2.2.3 _id 字段

```javascript
// 自动生成 ObjectId
db.users.insertOne({ name: "张三" })

// 自定义 _id（必须唯一）
db.users.insertOne({ _id: "user_001", name: "张三" })
db.users.insertOne({ _id: 123, name: "李四" })

// 注意：_id 不可修改，不可重复
```

## 2.3 查询文档（Read）

### 2.3.1 find 基本查询

```javascript
// 查询所有文档
db.users.find()

// 条件查询
db.users.find({ age: 28 })
db.users.find({ age: { $gt: 25 } })  // 大于 25
db.users.find({ name: "张三", age: 28 })  // AND

// 投影（只返回特定字段）
db.users.find({}, { name: 1, age: 1, _id: 0 })

// 格式化输出
db.users.find().pretty()
```

### 2.3.2 查询操作符

**比较操作符**：

```javascript
db.users.find({ age: { $eq: 28 } })   // 等于
db.users.find({ age: { $ne: 28 } })   // 不等于
db.users.find({ age: { $gt: 25 } })   // 大于
db.users.find({ age: { $gte: 25 } })  // 大于等于
db.users.find({ age: { $lt: 30 } })   // 小于
db.users.find({ age: { $lte: 30 } })  // 小于等于
db.users.find({ age: { $in: [25, 28, 30] } })   // 在列表中
db.users.find({ age: { $nin: [25, 30] } })      // 不在列表中
```

**逻辑操作符**：

```javascript
// AND（默认）
db.users.find({ age: { $gt: 25 }, city: "北京" })

// OR
db.users.find({ $or: [{ age: { $lt: 20 } }, { age: { $gt: 60 } }] })

// AND + OR 组合
db.users.find({
  status: "active",
  $or: [{ age: { $lt: 18 } }, { vip: true }]
})

// NOR
db.users.find({ $nor: [{ age: { $lt: 18 } }, { status: "inactive" }] })

// NOT
db.users.find({ age: { $not: { $gt: 30 } } })
```

**元素操作符**：

```javascript
db.users.find({ email: { $exists: true } })    // 字段存在
db.users.find({ email: { $exists: false } })   // 字段不存在
db.users.find({ age: { $type: "int" } })       // 字段类型
```

**数组操作符**：

```javascript
db.users.find({ hobbies: "reading" })                    // 包含元素
db.users.find({ hobbies: { $all: ["reading", "coding"] } })  // 包含所有
db.users.find({ hobbies: { $size: 3 } })                 // 数组长度
db.users.find({ hobbies: { $elemMatch: { $eq: "reading" } } })
```

**正则表达式**：

```javascript
db.users.find({ name: /^张/ })           // 以"张"开头
db.users.find({ email: /@gmail\.com$/i }) // 不区分大小写
db.users.find({ name: { $regex: "张", $options: "i" } })
```

### 2.3.3 findOne

```javascript
// 返回单个文档
db.users.findOne({ name: "张三" })

// 带投影
db.users.findOne({ name: "张三" }, { name: 1, age: 1 })
```

### 2.3.4 排序、跳过、限制

```javascript
// 排序（1 升序，-1 降序）
db.users.find().sort({ age: -1 })

// 多字段排序
db.users.find().sort({ age: -1, name: 1 })

// 限制返回数量
db.users.find().limit(10)

// 跳过（分页）
db.users.find().skip(20).limit(10)  // 第 3 页，每页 10 条

// 组合使用
db.users.find({ status: "active" })
  .sort({ createdAt: -1 })
  .skip(0)
  .limit(20)
```

### 2.3.5 计数与去重

```javascript
// 计数
db.users.countDocuments({ status: "active" })
db.users.estimatedDocumentCount()  // 快速估算（不扫描）

// 去重
db.users.distinct("city")
db.users.distinct("age", { status: "active" })  // 带条件
```

## 2.4 更新文档（Update）

### 2.4.1 updateOne

```javascript
db.users.updateOne(
  { name: "张三" },
  { $set: { age: 29, city: "上海" } }
)
// 返回：{ acknowledged: true, matchedCount: 1, modifiedCount: 1 }
```

### 2.4.2 updateMany

```javascript
db.users.updateMany(
  { status: "inactive" },
  { $set: { archived: true } }
)
```

### 2.4.3 更新操作符

**字段更新**：

```javascript
$set          // 设置字段值
$unset        // 删除字段
$inc          // 增加数值
$mul          // 乘以数值
$min          // 更新为较小值
$max          // 更新为较大值
$rename       // 重命名字段
$currentDate  // 设置为当前日期

// 示例
db.users.updateOne({ _id: 1 }, { $set: { age: 30 } })
db.users.updateOne({ _id: 1 }, { $unset: { tempField: "" } })
db.users.updateOne({ _id: 1 }, { $inc: { loginCount: 1 } })
db.users.updateOne({ _id: 1 }, { $mul: { price: 1.1 } })  // 涨价 10%
db.users.updateOne({ _id: 1 }, { $min: { score: 60 } })   // 保证不低于 60
db.users.updateOne({ _id: 1 }, { $max: { score: 100 } })  // 保证不超过 100
db.users.updateOne({ _id: 1 }, { $rename: { "oldName": "newName" } })
db.users.updateOne({ _id: 1 }, { $currentDate: { lastLogin: true } })
```

**数组更新**：

```javascript
$push         // 添加元素到数组末尾
$each         // 配合 $push 添加多个元素
$slice        // 限制数组长度
$sort         // 数组内元素排序
$addToSet     // 添加元素（如果不存在）
$pop          // 删除数组第一个或最后一个元素
$pull         // 删除匹配的元素
$pullAll      // 删除多个匹配的元素

// 示例
db.users.updateOne({ _id: 1 }, { $push: { hobbies: "swimming" } })
db.users.updateOne({ _id: 1 }, { 
  $push: { 
    scores: { 
      $each: [90, 85, 95],
      $sort: -1,
      $slice: 5  // 只保留前 5 个最高分
    } 
  } 
})
db.users.updateOne({ _id: 1 }, { $addToSet: { tags: "mongodb" } })
db.users.updateOne({ _id: 1 }, { $pop: { scores: 1 } })  // 1 末尾，-1 开头
db.users.updateOne({ _id: 1 }, { $pull: { hobbies: "reading" } })
db.users.updateOne({ _id: 1 }, { $pullAll: { hobbies: ["reading", "coding"] } })
```

**嵌套字段更新**：

```javascript
db.users.updateOne(
  { _id: 1 },
  { $set: { "address.city": "上海" } }
)

// 更新数组中的嵌套字段
db.users.updateOne(
  { _id: 1, "orders.orderId": 1001 },
  { $set: { "orders.$.status": "completed" } }
)
```

### 2.4.4 replaceOne

```javascript
// 替换整个文档（保留 _id）
db.users.replaceOne(
  { name: "张三" },
  { name: "张三", age: 30, email: "new@example.com" }
)
```

### 2.4.5 upsert（更新或插入）

```javascript
db.users.updateOne(
  { email: "new@example.com" },
  { $set: { name: "新用户", age: 25 } },
  { upsert: true }  // 如果不存在则插入
)
```

## 2.5 删除文档（Delete）

### 2.5.1 deleteOne

```javascript
db.users.deleteOne({ name: "张三" })
// 返回：{ acknowledged: true, deletedCount: 1 }
```

### 2.5.2 deleteMany

```javascript
db.users.deleteMany({ status: "inactive" })
```

### 2.5.3 清空集合

```javascript
db.users.deleteMany({})  // 删除所有文档，保留集合
db.users.drop()           // 删除整个集合
```

## 2.6 写关注（Write Concern）

```javascript
// 写关注级别
{
  w: 1,           // 等待主节点确认（默认）
  w: "majority",  // 等待大多数节点确认
  w: 0,           // 不等待确认（最快，可能丢数据）
  j: true,        // 等待写入 journal
  wtimeout: 5000  // 超时时间（毫秒）
}

// 示例
db.users.insertOne(
  { name: "张三" },
  { writeConcern: { w: "majority", j: true, wtimeout: 5000 } }
)
```

**写关注级别对比**：

| 级别 | 安全性 | 性能 | 适用场景 |
|------|--------|------|---------|
| `w: 0` | 低 | 最快 | 日志、临时数据 |
| `w: 1` | 中 | 快 | 一般业务（默认） |
| `w: "majority"` | 高 | 慢 | 关键业务 |
| `j: true` | 高 | 慢 | 需要持久化保证 |

## 2.7 Schema 验证

### 2.7.1 创建带验证的集合

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "age"],
      properties: {
        name: {
          bsonType: "string",
          description: "必须是字符串"
        },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150
        },
        status: {
          enum: ["active", "inactive", "pending"],
          description: "必须是枚举值之一"
        }
      }
    }
  },
  validationLevel: "strict",      // strict（所有操作）或 moderate（仅插入）
  validationAction: "error"       // error（拒绝）或 warn（警告但允许）
})
```

### 2.7.2 修改验证规则

```javascript
db.runCommand({
  collMod: "users",
  validator: {
    $jsonSchema: { /* 新的验证规则 */ }
  }
})
```

## 2.8 批量操作（Bulk Write）

```javascript
db.users.bulkWrite([
  { insertOne: { document: { name: "用户1", age: 25 } } },
  { updateOne: { 
      filter: { name: "张三" },
      update: { $set: { age: 30 } }
  }},
  { updateMany: {
      filter: { status: "inactive" },
      update: { $set: { archived: true } }
  }},
  { deleteOne: { filter: { name: "李四" } } },
  { deleteMany: { filter: { age: { $lt: 18 } } } },
  { replaceOne: {
      filter: { name: "王五" },
      replacement: { name: "王五", age: 35, email: "wangwu@new.com" }
  }}
], { ordered: false })  // 无序执行，更快
```

**批量操作的优势**：
- 减少网络往返
- 原子性（ordered: true 时）
- 性能提升（可达 10-100 倍）

## 2.9 事务（MongoDB 4.0+）

```javascript
// 启动会话
const session = db.getMongo().startSession()
session.startTransaction({
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
})

try {
  const users = session.getDatabase("mydb").users
  const orders = session.getDatabase("mydb").orders
  
  // 事务中的操作
  users.updateOne(
    { _id: 1 },
    { $inc: { balance: -100 } },
    { session }
  )
  
  orders.insertOne(
    { userId: 1, amount: 100, status: "pending" },
    { session }
  )
  
  // 提交事务
  session.commitTransaction()
} catch (error) {
  // 回滚事务
  session.abortTransaction()
  throw error
} finally {
  session.endSession()
}
```

**事务的限制**：
- 必须使用副本集或分片集群（4.2+）
- 事务中的集合必须存在
- 默认 60 秒超时
- 性能开销较大，避免长事务

## 2.10 Change Streams（数据变更流）

```javascript
// 监听集合变更
const changeStream = db.users.watch([
  { $match: { operationType: { $in: ["insert", "update"] } } }
])

changeStream.on("change", (change) => {
  console.log("操作类型:", change.operationType)
  console.log("文档 ID:", change.documentKey._id)
  console.log("变更内容:", change.updateDescription)
})

// 关闭监听
changeStream.close()
```

**应用场景**：
- 实时通知
- 数据同步
- 审计日志
- 缓存失效

---

## 本章小结

- 文档设计遵循"嵌入优先"原则，根据访问模式决定
- CRUD 操作：insertOne/Many、find、updateOne/Many、deleteOne/Many
- 丰富的查询操作符：比较、逻辑、数组、正则
- 更新操作符：$set、$inc、$push、$pull 等
- 写关注控制数据一致性级别
- Schema 验证保证数据质量
- 批量操作提升性能
- 事务支持多文档 ACID（4.0+）
- Change Streams 实时监听数据变更
