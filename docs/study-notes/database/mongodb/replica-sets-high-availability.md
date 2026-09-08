---
title: "MongoDB副本集与高可用"
aliases:
  - "MongoDB副本集"
  - "MongoDB高可用"
  - "MongoDB Replica Set"
tags:
  - "后端"
  - "数据库"
  - "mongodb"
  - "高可用"
  - "笔记"
category: "后端"
folder: "MongoDB"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MongoDB/MongoDB索引与性能优化]]"
  - "[[后端/数据库/MongoDB/MongoDB分片与扩展]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 05 MongoDB 副本集与高可用

MongoDB 副本集（Replica Set）是实现高可用和数据冗余的核心机制。本章介绍副本集的原理、部署、故障转移和生产环境最佳实践。

## 5.1 副本集概念

### 5.1.1 架构

```text
副本集架构（至少 3 个节点）：

┌─────────────────────────────────────────┐
│           Replica Set "rs0"             │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  │ Primary  │  │Secondary │  │Secondary │
│  │  主节点   │◄─┤  从节点   │  │  从节点   │
│  │          │  │          │  │          │
│  │ 写操作    │  │ 读操作    │  │ 读操作    │
│  │ 数据同步  │  │ 数据复制  │  │ 数据复制  │
│  └──────────┘  └──────────┘  └──────────┘
│       ▲              │              │
│       │              │              │
│       └──────────────┴──────────────┘
│              oplog 复制
└─────────────────────────────────────────┘
```

### 5.1.2 节点类型

| 节点类型 | 角色 | 特点 |
|---------|------|------|
| **Primary** | 主节点 | 接受写操作，唯一可写节点 |
| **Secondary** | 从节点 | 复制主节点数据，可提供读操作 |
| **Arbiter** | 仲裁节点 | 只参与投票，不存储数据（节省资源） |
| **Hidden** | 隐藏节点 | 不可见，用于备份或报告 |
| **Delayed** | 延迟节点 | 延迟复制，用于灾难恢复 |

### 5.1.3 选举机制

```text
选举规则：
  · 需要大多数节点（majority）投票
  · 3 节点：至少 2 票
  · 5 节点：至少 3 票
  · 优先级高的节点更容易当选
  · 数据最新的节点优先

故障转移流程：
  1. Primary 宕机
  2. Secondary 检测到 Primary 不可达
  3. 发起选举（需要大多数节点同意）
  4. 选举新的 Primary
  5. 客户端自动切换到新 Primary
```

## 5.2 部署副本集

### 5.2.1 准备环境

```bash
# 创建 3 个数据目录
mkdir -p /data/rs0-0 /data/rs0-1 /data/rs0-2

# 生成密钥文件（用于内部认证）
openssl rand -base64 756 > /data/keyfile
chmod 400 /data/keyfile
```

### 5.2.2 启动节点

```bash
# 启动节点 0（端口 27017）
mongod --replSet rs0 \
  --port 27017 \
  --dbpath /data/rs0-0 \
  --keyFile /data/keyfile \
  --bind_ip localhost,192.168.1.10

# 启动节点 1（端口 27018）
mongod --replSet rs0 \
  --port 27018 \
  --dbpath /data/rs0-1 \
  --keyFile /data/keyfile \
  --bind_ip localhost,192.168.1.11

# 启动节点 2（端口 27019）
mongod --replSet rs0 \
  --port 27019 \
  --dbpath /data/rs0-2 \
  --keyFile /data/keyfile \
  --bind_ip localhost,192.168.1.12
```

### 5.2.3 初始化副本集

```javascript
// 连接到节点 0
mongosh --port 27017

// 初始化副本集
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "192.168.1.10:27017", priority: 2 },
    { _id: 1, host: "192.168.1.11:27018", priority: 1 },
    { _id: 2, host: "192.168.1.12:27019", priority: 1 }
  ]
})

// 查看状态
rs.status()

// 查看配置
rs.conf()
```

### 5.2.4 Docker Compose 部署

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongo0:
    image: mongo:7.0
    container_name: mongo0
    ports:
      - "27017:27017"
    volumes:
      - mongo0_data:/data/db
      - ./keyfile:/data/keyfile
    command: mongod --replSet rs0 --keyFile /data/keyfile --bind_ip_all

  mongo1:
    image: mongo:7.0
    container_name: mongo1
    ports:
      - "27018:27017"
    volumes:
      - mongo1_data:/data/db
      - ./keyfile:/data/keyfile
    command: mongod --replSet rs0 --keyFile /data/keyfile --bind_ip_all

  mongo2:
    image: mongo:7.0
    container_name: mongo2
    ports:
      - "27019:27017"
    volumes:
      - mongo2_data:/data/db
      - ./keyfile:/data/keyfile
    command: mongod --replSet rs0 --keyFile /data/keyfile --bind_ip_all

volumes:
  mongo0_data:
  mongo1_data:
  mongo2_data:
```

## 5.3 副本集管理

### 5.3.1 添加节点

```javascript
// 添加从节点
rs.add("192.168.1.13:27017")

// 添加仲裁节点
rs.addArb("192.168.1.14:27017")

// 添加隐藏节点
rs.add({
  host: "192.168.1.15:27017",
  priority: 0,
  hidden: true
})
```

### 5.3.2 移除节点

```javascript
// 移除节点
rs.remove("192.168.1.13:27017")
```

### 5.3.3 切换主节点

```javascript
// 手动切换主节点（step down）
rs.stepDown(60)  // 60 秒内不参与选举

// 强制切换
rs.stepDown(60, { force: true })
```

### 5.3.4 维护模式

```javascript
// 进入维护模式（临时降级为 Secondary）
rs.stepDown(600)  // 10 分钟
```

## 5.4 读写策略

### 5.4.1 写关注（Write Concern）

```javascript
// 写关注级别
db.users.insertOne(
  { name: "张三" },
  { writeConcern: { w: "majority", j: true, wtimeout: 5000 } }
)

// w: 1          - 主节点确认（默认）
// w: "majority" - 大多数节点确认
// w: 0          - 不等待确认
// j: true       - 写入 journal
// wtimeout      - 超时时间（毫秒）
```

### 5.4.2 读偏好（Read Preference）

```javascript
// 设置读偏好
db.getMongo().setReadPref("secondaryPreferred")

// 或在查询时指定
db.users.find().readPref("secondary")

// 读偏好类型
// primary            - 只读主节点（默认）
// primaryPreferred   - 优先主节点，不可用时读从节点
// secondary          - 只读从节点
// secondaryPreferred - 优先从节点，不可用时读主节点
// nearest            - 读最近的节点
```

**读偏好选择建议**：

| 场景 | 推荐读偏好 | 原因 |
|------|-----------|------|
| 强一致性要求 | primary | 保证读最新数据 |
| 读多写少 | secondaryPreferred | 分担主节点压力 |
| 报表查询 | secondary | 不影响主节点性能 |
| 低延迟要求 | nearest | 读最近的节点 |

## 5.5 Oplog（操作日志）

### 5.5.1 Oplog 原理

```text
Oplog（Operation Log）：
  · 主节点记录所有写操作
  · 从节点通过复制 oplog 保持同步
  · 固定大小的 capped collection
  · 默认大小：磁盘空间的 5%

Oplog 窗口：
  · 从最早记录到最新记录的时间范围
  · 从节点必须在这个窗口内完成同步
  · 如果从节点落后太多，需要重新全量同步
```

### 5.5.2 查看 Oplog

```javascript
// 查看 oplog 状态
rs.printReplicationInfo()

// 输出示例：
// configured oplog size: 990.00 MB
// log length start to end: 172800 secs (48 hours)
// oplog first event time: Wed Sep 04 2026 10:00:00 GMT+0800
// oplog last event time: Fri Sep 06 2026 10:00:00 GMT+0800
// now: Fri Sep 06 2026 10:00:00 GMT+0800

// 查看从节点同步延迟
rs.printSecondaryReplicationInfo()
```

### 5.5.3 调整 Oplog 大小

```javascript
// 查看当前 oplog 大小
db.oplog.rs.stats().maxSize

// 调整 oplog 大小（需要重启）
// mongod.conf
replication:
  oplogSizeMB: 10240  // 10GB
```

## 5.6 故障转移与恢复

### 5.6.1 自动故障转移

```text
故障转移流程：
  1. Primary 宕机或网络分区
  2. Secondary 在 10 秒内检测到
  3. 发起选举（需要大多数节点同意）
  4. 选举新的 Primary（通常 10-30 秒）
  5. 客户端自动重连到新 Primary

客户端配置：
  mongodb://host1:27017,host2:27018,host3:27019/?replicaSet=rs0
  · 客户端会自动发现拓扑变化
  · 自动切换到新 Primary
```

### 5.6.2 手动故障转移

```javascript
// 强制选举
rs.stepDown()

// 指定某个节点成为 Primary
// 1. 设置优先级
cfg = rs.conf()
cfg.members[1].priority = 10
rs.reconfig(cfg)

// 2. 当前 Primary step down
rs.stepDown()
```

### 5.6.3 数据恢复

```javascript
// 从节点数据落后太多，需要重新同步
// 1. 停止从节点
// 2. 删除数据目录
// 3. 重新启动（会自动全量同步）

// 或使用 initialSync
rs.syncFrom("primary_host:27017")
```

## 5.7 监控与告警

### 5.7.1 关键指标

```javascript
// 副本集状态
rs.status()

// 关键字段
// "set" - 副本集名称
// "myState" - 当前节点状态（1=Primary, 2=Secondary）
// "members" - 所有成员状态
// "members[i].stateStr" - 状态描述
// "members[i].health" - 健康状态（1=健康）
// "members[i].optimeDate" - 最后操作时间
// "members[i].optimeLag" - 与主节点的延迟（秒）
```

### 5.7.2 监控脚本

```bash
#!/bin/bash
# check_replication.sh

# 检查副本集状态
mongosh --eval "
const status = rs.status();
const primary = status.members.find(m => m.stateStr === 'PRIMARY');
const secondaries = status.members.filter(m => m.stateStr === 'SECONDARY');

print('Primary: ' + primary.name);
print('Secondaries: ' + secondaries.length);

secondaries.forEach(s => {
  const lag = (new Date() - s.optimeDate) / 1000;
  print('  ' + s.name + ' lag: ' + lag + ' seconds');
  if (lag > 60) {
    print('WARNING: Replication lag > 60 seconds!');
    exit(1);
  }
});
"

if [ $? -eq 1 ]; then
  echo "Replication lag detected!"
  # 发送告警
fi
```

## 5.8 生产环境最佳实践

### 5.8.1 节点配置

```text
推荐配置（3 节点）：
  · 1 Primary + 2 Secondary
  · 或 1 Primary + 1 Secondary + 1 Arbiter

节点分布：
  · 跨可用区部署（不同机架/数据中心）
  · 避免所有节点在同一网络段
  · 至少 3 个投票节点

硬件要求：
  · Primary：高性能（CPU、内存、SSD）
  · Secondary：中等性能（可稍低）
  · Arbiter：最低配置（只参与投票）
```

### 5.8.2 连接字符串

```javascript
// 生产环境连接字符串
mongodb://user:password@host1:27017,host2:27018,host3:27019/mydb?
  replicaSet=rs0&
  authSource=admin&
  readPreference=secondaryPreferred&
  w=majority&
  wtimeoutMS=5000&
  retryWrites=true&
  retryReads=true
```

### 5.8.3 安全配置

```yaml
# mongod.conf

security:
  authorization: enabled
  keyFile: /data/keyfile

net:
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/ssl/mongodb.pem
    CAFile: /etc/ssl/ca.pem
```

### 5.8.4 备份策略

```bash
# 从从节点备份（避免影响主节点）
mongodump --host secondary_host:27017 \
  --username backup_user \
  --password password \
  --authenticationDatabase admin \
  --oplog \
  --out /backup/mongodb

# 使用隐藏节点备份
# 隐藏节点不影响选举，专门用于备份
```

---

## 本章小结

- 副本集是 MongoDB 高可用的核心机制
- 至少 3 个节点：1 Primary + 2 Secondary
- 自动故障转移，通常在 10-30 秒内完成
- 写关注控制数据一致性级别
- 读偏好分散读压力到从节点
- Oplog 是数据同步的基础，需要足够大的窗口
- 生产环境跨可用区部署，使用 TLS 加密
- 从从节点备份，避免影响主节点性能
