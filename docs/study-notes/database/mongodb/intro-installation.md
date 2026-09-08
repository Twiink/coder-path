---
title: "MongoDB入门与安装配置"
aliases:
  - "MongoDB入门"
  - "MongoDB安装"
tags:
  - "后端"
  - "数据库"
  - "mongodb"
  - "nosql"
  - "笔记"
category: "后端"
folder: "MongoDB"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MongoDB/MongoDB数据模型与CRUD]]"
  - "[[后端/数据库/MongoDB/MongoDB查询与聚合]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 01 MongoDB 入门与安装配置

MongoDB 是最流行的 NoSQL 文档数据库，以灵活的 JSON-like 文档模型、强大的查询能力和水平扩展性著称。本章介绍 MongoDB 的核心概念、安装配置和基本操作。

## 1.1 MongoDB 简介

### 1.1.1 发展历程

```text
2007  10gen 公司开始开发（后改名 MongoDB Inc.）
2009  MongoDB 1.0 发布（开源，AGPL 许可）
2013  MongoDB 2.4（引入聚合框架）
2015  MongoDB 3.0（WiredTiger 存储引擎）
2017  MongoDB 3.4（多文档事务支持开始）
2018  MongoDB 4.0（多文档 ACID 事务）
2019  MongoDB 4.2（分布式事务）
2020  MongoDB 4.4（复合哈希分片键）
2021  MongoDB 5.0（时间序列集合）
2023  MongoDB 7.0（Queryable Encryption）
2024  改为 SSPL 许可（Server Side Public License）
```

### 1.1.2 核心特性

| 特性 | 说明 |
|------|------|
| **文档模型** | BSON（Binary JSON）格式，灵活的 Schema |
| **动态查询** | 丰富的查询语言，支持嵌套文档和数组 |
| **聚合框架** | 强大的数据处理管道 |
| **索引** | 支持多种索引类型（B-tree、全文、地理空间等） |
| **复制** | 副本集（Replica Set）提供高可用 |
| **分片** | 自动水平扩展（Sharding） |
| **事务** | 4.0+ 支持多文档 ACID 事务 |
| **Change Streams** | 实时监听数据变化 |
| **GridFS** | 存储大文件 |

### 1.1.3 适用场景

```text
✅ 适合：
  · 内容管理系统（CMS）
  · 用户配置、个人资料
  · 实时分析、日志数据
  · 移动应用后端
  · IoT 设备数据
  · 产品目录（电商）
  · 快速迭代的初创项目

❌ 不适合：
  · 强一致性要求的金融系统（虽然有事务，但不如关系型成熟）
  · 复杂的多表 JOIN 查询
  · 需要复杂事务的业务
  · 数据关系非常紧密的系统
```

### 1.1.4 MongoDB vs 关系型数据库

| 特性 | MongoDB | MySQL/PostgreSQL |
|------|---------|------------------|
| **数据模型** | 文档（BSON） | 表（行和列） |
| **Schema** | 动态、灵活 | 固定、严格 |
| **查询语言** | MongoDB Query Language | SQL |
| **事务** | 4.0+ 多文档事务 | 成熟的 ACID 事务 |
| **JOIN** | $lookup（有限） | 强大的 JOIN |
| **扩展性** | 原生分片 | 需要额外方案 |
| **学习曲线** | 中等 | 陡峭（SQL） |
| **性能** | 简单查询快 | 复杂查询优 |

## 1.2 核心概念

### 1.2.1 数据模型

```text
关系型数据库          MongoDB
─────────────         ─────────
Database       →      Database
Table          →      Collection
Row            →      Document
Column         →      Field
JOIN           →      $lookup / 嵌入文档
Primary Key    →      _id（自动）
Foreign Key    →      引用或嵌入
```

**文档示例**：

```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "name": "张三",
  "age": 28,
  "email": "zhangsan@example.com",
  "address": {
    "city": "北京",
    "street": "朝阳区"
  },
  "hobbies": ["reading", "coding", "travel"],
  "orders": [
    { "orderId": 1001, "amount": 99.99 },
    { "orderId": 1002, "amount": 199.99 }
  ],
  "createdAt": ISODate("2026-09-06T10:00:00Z")
}
```

### 1.2.2 BSON 数据类型

| 类型 | 说明 | 示例 |
|------|------|------|
| **String** | UTF-8 字符串 | `"hello"` |
| **Integer** | 32 位或 64 位整数 | `42` |
| **Double** | 64 位浮点数 | `3.14` |
| **Boolean** | 布尔值 | `true`, `false` |
| **Date** | 64 位时间戳 | `ISODate("2026-09-06T10:00:00Z")` |
| **ObjectId** | 12 字节唯一标识 | `ObjectId("507f1f77bcf86cd799439011")` |
| **Array** | 数组 | `[1, 2, 3]` |
| **Object** | 嵌套文档 | `{ "city": "北京" }` |
| **Null** | 空值 | `null` |
| **Binary** | 二进制数据 | `BinData(0, "...")` |
| **Decimal128** | 128 位十进制 | `NumberDecimal("9.99")` |

**ObjectId 结构**：

```text
507f1f77bcf86cd799439011
├─┬──┘├─┬──┘├─┬──┘├──┬──┘
  │     │     │      └─ 3 字节计数器（自增）
  │     │     └─ 2 字节进程 ID
  │     └─ 5 字节随机值（机器标识）
  └─ 4 字节时间戳（Unix 秒）

特性：
  · 全局唯一（无需中央协调）
  · 大致按时间排序
  · 12 字节，存储高效
```

## 1.3 安装 MongoDB

### 1.3.1 macOS

```bash
# 方式一：Homebrew
brew tap mongodb/brew
brew install mongodb-community

# 启动服务
brew services start mongodb-community

# 验证
mongosh

# 方式二：Docker
docker run -d --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:7.0
```

### 1.3.2 Linux（Ubuntu/Debian）

```bash
# 导入公钥
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

# 添加仓库
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# 安装
sudo apt update
sudo apt install -y mongodb-org

# 启动
sudo systemctl start mongod
sudo systemctl enable mongod

# 验证
mongosh
```

### 1.3.3 Linux（CentOS/RHEL）

```bash
# 创建仓库文件
cat > /etc/yum.repos.d/mongodb-org-7.0.repo <<EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

# 安装
sudo yum install -y mongodb-org

# 启动
sudo systemctl start mongod
sudo systemctl enable mongod

# 验证
mongosh
```

### 1.3.4 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
    restart: unless-stopped

volumes:
  mongodb_data:
```

```bash
docker-compose up -d
```

## 1.4 基本操作

### 1.4.1 mongosh 命令行

```bash
# 连接 MongoDB
mongosh
mongosh "mongodb://localhost:27017"
mongosh "mongodb://user:password@localhost:27017/mydb?authSource=admin"

# 常用命令
show dbs                    # 列出所有数据库
use mydb                    # 切换数据库
show collections            # 列出当前数据库的所有集合
db                          # 显示当前数据库名

# 数据库操作
db.stats()                  # 数据库统计信息
db.dropDatabase()           # 删除当前数据库

# 集合操作
db.createCollection("users")  # 创建集合
db.users.drop()               # 删除集合
```

### 1.4.2 数据库操作

```javascript
// 创建数据库（隐式：插入数据时自动创建）
use mydb
db.users.insertOne({ name: "张三" })

// 删除数据库
use mydb
db.dropDatabase()

// 查看所有数据库
show dbs
```

### 1.4.3 集合操作

```javascript
// 创建集合（显式）
db.createCollection("users", {
  capped: true,           // 固定大小集合
  size: 10485760,         // 10MB
  max: 1000               // 最多 1000 个文档
})

// 创建普通集合
db.createCollection("products")

// 删除集合
db.products.drop()

// 重命名集合
db.products.renameCollection("items")
```

## 1.5 配置文件

### 1.5.1 mongod.conf

```yaml
# /etc/mongod.conf

# 系统日志
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# 数据存储
storage:
  dbPath: /var/lib/mongo
  journal:
    enabled: true
  wiredTiger:
    engineConfig:
      cacheSizeGB: 2  # WiredTiger 缓存大小（建议 50% 内存 - 1GB）

# 网络
net:
  port: 27017
  bindIp: 127.0.0.1,::1  # 监听地址（生产环境改为内网 IP）
  maxIncomingConnections: 65536

# 安全（生产环境必须启用）
security:
  authorization: enabled
  keyFile: /etc/mongodb/keyfile  # 副本集内部认证

# 副本集
replication:
  replSetName: "rs0"

# 分片（仅分片集群）
sharding:
  clusterRole: configsvr  # 或 shardsvr
```

### 1.5.2 用户与权限

```javascript
// 创建管理员用户
use admin
db.createUser({
  user: "admin",
  pwd: "password123",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
})

// 创建应用用户
use mydb
db.createUser({
  user: "app_user",
  pwd: "app_password",
  roles: [
    { role: "readWrite", db: "mydb" }
  ]
})

// 查看用户
use admin
db.getUsers()

// 修改密码
db.changeUserPassword("app_user", "new_password")

// 删除用户
db.dropUser("app_user")
```

**内置角色**：

| 角色 | 权限 |
|------|------|
| `read` | 只读 |
| `readWrite` | 读写 |
| `dbAdmin` | 数据库管理 |
| `userAdmin` | 用户管理 |
| `clusterAdmin` | 集群管理 |
| `root` | 超级管理员 |

### 1.5.3 启用认证

```bash
# 1. 创建管理员用户（临时关闭认证）
# mongod.conf: security.authorization: disabled
mongosh
use admin
db.createUser({
  user: "admin",
  pwd: "password123",
  roles: [{ role: "root", db: "admin" }]
})

# 2. 生成密钥文件（副本集）
openssl rand -base64 756 > /etc/mongodb/keyfile
chmod 400 /etc/mongodb/keyfile
chown mongodb:mongodb /etc/mongodb/keyfile

# 3. 启用认证
# mongod.conf
security:
  authorization: enabled
  keyFile: /etc/mongodb/keyfile

# 4. 重启 MongoDB
sudo systemctl restart mongod

# 5. 使用管理员登录
mongosh -u admin -p password123 --authenticationDatabase admin
```

## 1.6 监控与性能

### 1.6.1 基本监控命令

```javascript
// 服务器状态
db.serverStatus()

// 当前操作
db.currentOp()

// 集合统计
db.users.stats()

// 索引使用情况
db.users.aggregate([
  { $indexStats: {} }
])

// 慢查询日志（Profiling）
db.setProfilingLevel(1, { slowms: 100 })  // 记录超过 100ms 的查询
db.getProfilingStatus()
db.profile.find().sort({ ts: -1 }).limit(10)
```

### 1.6.2 MongoDB Compass（GUI 工具）

```text
官方图形化工具，功能包括：
  · 可视化查询构建
  · 聚合管道编辑器
  · 性能分析
  · Schema 分析
  · 数据导入/导出

下载地址：https://www.mongodb.com/products/compass
```

### 1.6.3 关键指标

| 指标 | 说明 | 健康值 |
|------|------|--------|
| **连接数** | `connections.current` | < `connections.available` × 80% |
| **内存使用** | `mem.resident` | < 物理内存 |
| **页面错误** | `extra_info.page_faults` | 越低越好 |
| **操作计数** | `opcounters.*` | 根据业务 |
| **复制延迟** | `repl.lag` | < 1 秒 |
| **WiredTiger 缓存** | `wiredTiger.cache.bytes` | < `cacheSizeGB` |

## 1.7 备份与恢复

### 1.7.1 mongodump / mongorestore

```bash
# 备份整个数据库
mongodump --uri="mongodb://localhost:27017/mydb" --out=/backup/mongodb

# 备份特定集合
mongodump --uri="mongodb://localhost:27017/mydb" --collection=users --out=/backup/mongodb

# 压缩备份
mongodump --uri="mongodb://localhost:27017/mydb" --gzip --out=/backup/mongodb

# 恢复
mongorestore --uri="mongodb://localhost:27017/mydb" /backup/mongodb/mydb

# 恢复特定集合
mongorestore --uri="mongodb://localhost:27017/mydb" --collection=users /backup/mongodb/mydb/users.bson
```

### 1.7.2 备份脚本

```bash
#!/bin/bash
# backup_mongodb.sh

BACKUP_DIR="/backup/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份
mongodump --uri="mongodb://user:password@localhost:27017/mydb?authSource=admin" \
  --gzip \
  --out=$BACKUP_DIR/backup_$DATE

# 删除旧备份
find $BACKUP_DIR -maxdepth 1 -type d -name "backup_*" -mtime +$RETENTION_DAYS -exec rm -rf {} \;

echo "Backup completed: backup_$DATE"
```

## 1.8 常见问题与最佳实践

### 1.8.1 连接池配置

```javascript
// Node.js 示例
const { MongoClient } = require('mongodb');

const client = new MongoClient('mongodb://localhost:27017', {
  maxPoolSize: 100,        // 最大连接数
  minPoolSize: 10,         // 最小连接数
  maxIdleTimeMS: 60000,    // 空闲超时（毫秒）
  connectTimeoutMS: 10000, // 连接超时
  socketTimeoutMS: 45000   // 套接字超时
});
```

### 1.8.2 最佳实践清单

1. **始终启用认证**：生产环境必须设置用户名密码
2. **使用副本集**：至少 3 个节点，保证高可用
3. **合理设计文档结构**：避免过度嵌套（最多 100 层）
4. **限制文档大小**：单个文档不超过 16MB
5. **使用索引**：为频繁查询的字段创建索引
6. **监控连接数**：避免连接泄漏
7. **定期备份**：测试恢复流程
8. **使用 WiredTiger**：默认存储引擎，性能好
9. **启用 Journaling**：保证数据持久性
10. **限制 bindIp**：不要暴露到公网

---

## 本章小结

- MongoDB 是文档数据库，使用 BSON 格式存储数据
- 核心概念：Database → Collection → Document
- ObjectId 是 12 字节的唯一标识，包含时间戳
- 安装方式：包管理器、Docker、官方安装包
- 生产环境必须启用认证、使用副本集
- 监控关键指标：连接数、内存、页面错误
- 定期备份并测试恢复
