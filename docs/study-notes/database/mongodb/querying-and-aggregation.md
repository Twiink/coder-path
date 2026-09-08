---
title: "MongoDB查询与聚合"
aliases:
  - "MongoDB查询"
  - "MongoDB聚合"
  - "MongoDB Aggregation"
tags:
  - "后端"
  - "数据库"
  - "mongodb"
  - "笔记"
category: "后端"
folder: "MongoDB"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MongoDB/MongoDB数据模型与CRUD]]"
  - "[[后端/数据库/MongoDB/MongoDB索引与性能优化]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 03 MongoDB 查询与聚合

MongoDB 提供强大的聚合框架（Aggregation Framework），可以完成类似 SQL 的 GROUP BY、JOIN 等操作。本章介绍高级查询技巧和聚合管道。

## 3.1 高级查询

### 3.1.1 嵌套文档查询

```javascript
// 文档结构
{
  "_id": 1,
  "name": "张三",
  "address": {
    "city": "北京",
    "street": "朝阳区",
    "coordinates": [116.4, 39.9]
  }
}

// 查询嵌套字段（使用点表示法）
db.users.find({ "address.city": "北京" })

// 查询嵌套对象
db.users.find({ address: { city: "北京", street: "朝阳区" } })  // 精确匹配

// $elemMatch（数组中至少一个元素满足所有条件）
db.users.find({
  hobbies: {
    $elemMatch: {
      name: "reading",
      level: { $gte: 5 }
    }
  }
})
```

### 3.1.2 数组查询

```javascript
// 文档结构
{ "_id": 1, "tags": ["mongodb", "database", "nosql"] }

// 包含特定元素
db.posts.find({ tags: "mongodb" })

// 包含多个元素（$all）
db.posts.find({ tags: { $all: ["mongodb", "database"] } })

// 数组长度
db.posts.find({ tags: { $size: 3 } })

// 数组中任意元素满足条件
db.posts.find({ tags: { $in: ["mongodb", "mysql"] } })

// 数组元素范围查询
db.scores.find({ results: { $elemMatch: { $gte: 80, $lt: 90 } } })
```

### 3.1.3 地理空间查询

```javascript
// 创建 2dsphere 索引
db.places.createIndex({ location: "2dsphere" })

// 插入地理位置
db.places.insertOne({
  name: "天安门",
  location: {
    type: "Point",
    coordinates: [116.3912757, 39.906217]  // [经度, 纬度]
  }
})

// 附近查询（5km 内）
db.places.find({
  location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [116.4, 39.9]
      },
      $maxDistance: 5000  // 米
    }
  }
})

// 区域内查询
db.places.find({
  location: {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [[[116.3, 39.8], [116.5, 39.8], [116.5, 40.0], [116.3, 40.0], [116.3, 39.8]]]
      }
    }
  }
})
```

### 3.1.4 文本搜索

```javascript
// 创建文本索引
db.articles.createIndex({ title: "text", content: "text" })

// 文本搜索
db.articles.find({ $text: { $search: "mongodb database" } })

// 精确短语搜索
db.articles.find({ $text: { $search: "\"mongodb tutorial\"" } })

// 排除词
db.articles.find({ $text: { $search: "mongodb -mysql" } })

// 按相关性排序
db.articles.find(
  { $text: { $search: "mongodb" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })
```

## 3.2 聚合框架（Aggregation Framework）

### 3.2.1 聚合管道概念

```javascript
// 聚合管道语法
db.collection.aggregate([
  { stage1 },
  { stage2 },
  ...
])

// 常用阶段（Stage）
$match      // 过滤文档（类似 WHERE）
$group      // 分组聚合（类似 GROUP BY）
$sort       // 排序
$limit      // 限制数量
$skip       // 跳过
$project    // 投影（选择/重命名字段）
$unwind     // 展开数组
$lookup     // 左连接（类似 LEFT JOIN）
$out        // 输出到集合
$addFields  // 添加新字段
$count      // 计数
$facet      // 多路聚合
$bucket     // 分桶
```

### 3.2.2 $match（过滤）

```javascript
// 类似 SQL WHERE
db.orders.aggregate([
  { $match: { status: "completed", amount: { $gt: 100 } } }
])

// 最佳实践：$match 放在管道开头（可以使用索引）
```

### 3.2.3 $group（分组聚合）

```javascript
// 按字段分组
db.orders.aggregate([
  {
    $group: {
      _id: "$status",  // 分组字段
      count: { $sum: 1 },  // 计数
      totalAmount: { $sum: "$amount" },  // 求和
      avgAmount: { $avg: "$amount" },  // 平均值
      maxAmount: { $max: "$amount" },  // 最大值
      minAmount: { $min: "$amount" }   // 最小值
    }
  }
])

// 按日期分组
db.orders.aggregate([
  {
    $group: {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      },
      count: { $sum: 1 },
      totalAmount: { $sum: "$amount" }
    }
  }
])

// 多字段分组
db.orders.aggregate([
  {
    $group: {
      _id: { status: "$status", city: "$city" },
      count: { $sum: 1 }
    }
  }
])
```

**聚合操作符**：

| 操作符 | 说明 |
|--------|------|
| `$sum` | 求和 |
| `$avg` | 平均值 |
| `$min` | 最小值 |
| `$max` | 最大值 |
| `$first` | 第一个值 |
| `$last` | 最后一个值 |
| `$push` | 推入数组 |
| `$addToSet` | 推入数组（去重） |
| `$count` | 计数 |

### 3.2.4 $project（投影）

```javascript
// 选择字段
db.users.aggregate([
  {
    $project: {
      name: 1,
      age: 1,
      _id: 0  // 排除 _id
    }
  }
])

// 计算新字段
db.orders.aggregate([
  {
    $project: {
      orderId: "$_id",
      total: { $multiply: ["$price", "$quantity"] },
      year: { $year: "$createdAt" }
    }
  }
])

// 条件投影
db.users.aggregate([
  {
    $project: {
      name: 1,
      ageGroup: {
        $cond: {
          if: { $gte: ["$age", 18] },
          then: "adult",
          else: "minor"
        }
      }
    }
  }
])
```

### 3.2.5 $unwind（展开数组）

```javascript
// 文档结构
{ "_id": 1, "name": "张三", "hobbies": ["reading", "coding", "travel"] }

// 展开数组
db.users.aggregate([
  { $unwind: "$hobbies" }
])

// 结果：
// { "_id": 1, "name": "张三", "hobbies": "reading" }
// { "_id": 1, "name": "张三", "hobbies": "coding" }
// { "_id": 1, "name": "张三", "hobbies": "travel" }

// 包含数组索引
db.users.aggregate([
  {
    $unwind: {
      path: "$hobbies",
      includeArrayIndex: "index"
    }
  }
])

// 保留空数组
db.users.aggregate([
  {
    $unwind: {
      path: "$hobbies",
      preserveNullAndEmptyArrays: true
    }
  }
])
```

### 3.2.6 $lookup（关联查询）

```javascript
// 类似 SQL LEFT JOIN
db.orders.aggregate([
  {
    $lookup: {
      from: "users",           // 关联的集合
      localField: "userId",    // 当前集合的字段
      foreignField: "_id",     // 关联集合的字段
      as: "userInfo"           // 输出字段名
    }
  }
])

// 带条件的 lookup（MongoDB 3.6+）
db.orders.aggregate([
  {
    $lookup: {
      from: "products",
      let: { orderId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$orderId", "$$orderId"] } } }
      ],
      as: "orderItems"
    }
  }
])
```

### 3.2.7 $sort、$limit、$skip

```javascript
// 排序 + 分页
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $sort: { createdAt: -1 } },
  { $skip: 20 },
  { $limit: 10 }
])

// 获取 Top N
db.orders.aggregate([
  { $group: { _id: "$userId", totalAmount: { $sum: "$amount" } } },
  { $sort: { totalAmount: -1 } },
  { $limit: 10 }
])
```

### 3.2.8 $addFields（添加字段）

```javascript
// 添加计算字段
db.orders.aggregate([
  {
    $addFields: {
      total: { $multiply: ["$price", "$quantity"] },
      isExpensive: { $gt: ["$amount", 100] }
    }
  }
])

// 条件字段
db.users.aggregate([
  {
    $addFields: {
      ageCategory: {
        $switch: {
          branches: [
            { case: { $lt: ["$age", 18] }, then: "minor" },
            { case: { $lt: ["$age", 60] }, then: "adult" }
          ],
          default: "senior"
        }
      }
    }
  }
])
```

## 3.3 聚合管道示例

### 3.3.1 电商销售分析

```javascript
// 按月统计销售额和订单数
db.orders.aggregate([
  { $match: { status: "completed" } },
  {
    $group: {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      },
      orderCount: { $sum: 1 },
      totalRevenue: { $sum: "$amount" },
      avgOrderValue: { $avg: "$amount" }
    }
  },
  { $sort: { "_id.year": -1, "_id.month": -1 } }
])
```

### 3.3.2 用户行为分析

```javascript
// 统计每个用户的订单总金额和订单数
db.orders.aggregate([
  {
    $group: {
      _id: "$userId",
      orderCount: { $sum: 1 },
      totalSpent: { $sum: "$amount" },
      firstOrder: { $min: "$createdAt" },
      lastOrder: { $max: "$createdAt" }
    }
  },
  {
    $lookup: {
      from: "users",
      localField: "_id",
      foreignField: "_id",
      as: "userInfo"
    }
  },
  { $unwind: "$userInfo" },
  {
    $project: {
      userId: "$_id",
      userName: "$userInfo.name",
      orderCount: 1,
      totalSpent: 1,
      avgOrderValue: { $divide: ["$totalSpent", "$orderCount"] }
    }
  },
  { $sort: { totalSpent: -1 } },
  { $limit: 100 }
])
```

### 3.3.3 商品销量排行

```javascript
// 统计每个商品的销量
db.orderItems.aggregate([
  {
    $group: {
      _id: "$productId",
      totalSold: { $sum: "$quantity" },
      orderCount: { $sum: 1 }
    }
  },
  {
    $lookup: {
      from: "products",
      localField: "_id",
      foreignField: "_id",
      as: "product"
    }
  },
  { $unwind: "$product" },
  {
    $project: {
      productId: "$_id",
      productName: "$product.name",
      category: "$product.category",
      totalSold: 1,
      orderCount: 1
    }
  },
  { $sort: { totalSold: -1 } },
  { $limit: 50 }
])
```

## 3.4 聚合表达式

### 3.4.1 算术表达式

```javascript
$add        // 加法
$subtract   // 减法
$multiply   // 乘法
$divide     // 除法
$mod        // 取模
$abs        // 绝对值
$ceil       // 向上取整
$floor      // 向下取整
$round      // 四舍五入

// 示例
{ $add: ["$price", "$tax"] }
{ $multiply: ["$price", "$quantity"] }
{ $divide: ["$total", "$count"] }
```

### 3.4.2 日期表达式

```javascript
$year       // 年
$month      // 月
$dayOfMonth // 日
$hour       // 时
$minute     // 分
$second     // 秒
$dayOfWeek  // 星期几（1-7）
$dateToString // 格式化日期

// 示例
{ $year: "$createdAt" }
{ $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
```

### 3.4.3 字符串表达式

```javascript
$concat       // 拼接
$substr       // 子串
$toLower      // 转小写
$toUpper      // 转大写
$trim         // 去空格
$split        // 分割
$strLenCP     // 字符串长度

// 示例
{ $concat: ["$firstName", " ", "$lastName"] }
{ $toLower: "$email" }
```

### 3.4.4 条件表达式

```javascript
$cond     // 三元运算符
$switch   // 多分支
$ifNull   // 空值处理

// 示例
{
  $cond: {
    if: { $gte: ["$age", 18] },
    then: "adult",
    else: "minor"
  }
}

{
  $switch: {
    branches: [
      { case: { $eq: ["$status", "active"] }, then: 1 },
      { case: { $eq: ["$status", "inactive"] }, then: 0 }
    ],
    default: -1
  }
}

{ $ifNull: ["$nickname", "$username"] }
```

## 3.5 视图（Views）

```javascript
// 创建视图（保存聚合管道）
db.createView("monthlySales", "orders", [
  { $match: { status: "completed" } },
  {
    $group: {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      },
      totalRevenue: { $sum: "$amount" },
      orderCount: { $sum: 1 }
    }
  }
])

// 查询视图
db.monthlySales.find()
```

## 3.6 性能优化

### 3.6.1 聚合性能建议

1. **尽早过滤**：`$match` 放在管道开头
2. **使用索引**：`$match` 和 `$sort` 可以利用索引
3. **减少文档大小**：使用 `$project` 尽早排除不需要的字段
4. **避免大数组**：`$unwind` 大数组会导致内存问题
5. **使用 `$limit`**：限制结果数量

### 3.6.2 explain 分析

```javascript
// 查看聚合执行计划
db.orders.explain("executionStats").aggregate([
  { $match: { status: "completed" } },
  { $group: { _id: "$userId", total: { $sum: "$amount" } } }
])
```

---

## 本章小结

- 聚合框架是 MongoDB 的核心功能，类似 SQL 的 GROUP BY
- 常用阶段：`$match`、`$group`、`$project`、`$sort`、`$lookup`、`$unwind`
- `$lookup` 实现类似 LEFT JOIN 的关联查询
- 聚合表达式支持算术、日期、字符串、条件操作
- 性能优化：尽早过滤、利用索引、减少文档大小
- 视图可以保存常用的聚合管道
