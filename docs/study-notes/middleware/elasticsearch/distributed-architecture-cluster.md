---
title: "Elasticsearch分布式架构与集群管理"
aliases:
  - "ES分布式架构"
  - "Elasticsearch集群管理"
tags:
  - "后端"
  - "搜索引擎"
  - "elasticsearch"
  - "分布式"
  - "集群管理"
  - "笔记"
category: "后端"
folder: "Elasticsearch"
parent: "[[目录]]"
related:
  - "[[后端/数据库/Elasticsearch/Elasticsearch入门与核心概念]]"
  - "[[后端/数据库/Elasticsearch/Elasticsearch性能优化]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 05 Elasticsearch 分布式架构与集群管理

Elasticsearch 天生就是分布式系统，理解其分布式架构对于构建高可用、高性能的搜索集群至关重要。

## 5.1 集群架构组件

### 5.1.1 节点角色

ES 集群中的节点可以承担不同角色：

| 角色 | 配置 | 职责 | 推荐配置 |
|------|------|------|---------|
| **Master Node** | `node.roles: [master]` | 集群状态管理、索引创建删除、分片分配 | 3 个专用 Master（生产环境） |
| **Data Node** | `node.roles: [data]` | 存储数据、执行 CRUD、搜索、聚合 | 大内存、高存储 |
| **Coordinating Node** | 所有节点默认都是 | 路由请求、汇总结果 | 每个节点都是 |
| **Ingest Node** | `node.roles: [ingest]` | 数据预处理（Pipeline） | 可选，独立部署 |

**生产环境推荐架构**：
```
┌─────────────────┐
│  Dedicated      │
│  Master Nodes   │  × 3（轻量级，2C4G 即可）
│  (master only)  │
└─────────────────┘

┌─────────────────┐
│  Data Nodes     │  × N（根据数据量，16C64G+）
│  (data only)    │
└─────────────────┘

┌─────────────────┐
│  Coordinating   │  × 2+（负载均衡器后，8C16G）
│  Nodes          │
│  (no roles)     │
└─────────────────┘
```

### 5.1.2 节点配置文件

```yaml
# elasticsearch.yml

# 集群名称（所有节点必须一致）
cluster.name: prod-es-cluster

# 节点名称（唯一）
node.name: es-data-01

# 节点角色
node.roles: [data]

# 网络配置
network.host: 0.0.0.0
http.port: 9200
transport.port: 9300

# 集群发现
discovery.seed_hosts:
  - 192.168.1.10:9300
  - 192.168.1.11:9300
  - 192.168.1.12:9300

# 初始 Master 节点（首次启动）
cluster.initial_master_nodes:
  - es-master-01
  - es-master-02
  - es-master-03

# 数据与日志路径
path.data: /data/elasticsearch
path.logs: /var/log/elasticsearch

# 内存锁定（防止 swap）
bootstrap.memory_lock: true

# 跨集群复制（CCR）
# cluster.remote.connect: true
```

## 5.2 集群健康状态

### 5.2.1 三种状态

```bash
GET /_cluster/health
```

| 状态 | 颜色 | 含义 | 影响 |
|------|------|------|------|
| **Green** | 🟢 | 所有主分片和副本分片均正常 | 完全健康 |
| **Yellow** | 🟡 | 所有主分片正常，部分副本分片未分配 | 可用但无冗余 |
| **Red** | 🔴 | 部分主分片未分配 | **数据不可用** |

### 5.2.2 常见健康问题排查

**Yellow 状态排查**：
```bash
# 查看未分配的分片
GET /_cat/shards?v&h=index,shard,prirep,state,node&s=state

# 查看原因
GET /_cluster/allocation/explain
{
  "index": "my-index",
  "shard": 0,
  "primary": false
}

# 常见原因
# 1. 单节点集群无法分配副本（正常）
# 2. 节点数 < 副本数 + 1
# 3. 节点磁盘空间不足
```

**Red 状态排查**：
```bash
# 查看未分配的主分片
GET /_cat/shards?v&h=index,shard,prirep,state,unassigned.reason&s=state:desc

# 常见原因
# 1. 节点宕机（NODE_LEFT）
# 2. 分片损坏（CORRUPT_INDEX）
# 3. 分配失败（ALLOCATION_FAILED）

# 强制重新分配
POST /_cluster/reroute?retry_failed=true
```

## 5.3 分片分配策略

### 5.3.1 分片分配过滤

```bash
# 按节点属性过滤
PUT /my-index/_settings
{
  "index.routing.allocation.include.rack": "rack1,rack2",
  "index.routing.allocation.exclude.rack": "rack3",
  "index.routing.allocation.require.zone": "zone-a"
}

# 按节点名称过滤
PUT /my-index/_settings
{
  "index.routing.allocation.include._name": "es-data-01,es-data-02"
}
```

### 5.3.2 磁盘水位线

```yaml
# elasticsearch.yml
cluster.routing.allocation.disk.threshold_enabled: true
cluster.routing.allocation.disk.watermark.low: 85%      # 停止分配新分片
cluster.routing.allocation.disk.watermark.high: 90%     # 开始迁移分片
cluster.routing.allocation.disk.watermark.flood_stage: 95%  # 索引变为只读
```

**磁盘满导致索引只读的恢复**：
```bash
# 1. 清理磁盘空间

# 2. 解除只读限制
PUT /my-index/_settings
{
  "index.blocks.read_only_allow_delete": null
}

# 或批量解除
PUT /_all/_settings
{
  "index.blocks.read_only_allow_delete": null
}
```

### 5.3.3 分片再平衡

```yaml
# 控制分片再平衡策略
cluster.routing.allocation.balance.shard: 0.45       # 分片数量权重
cluster.routing.allocation.balance.index: 0.55       # 索引分布权重
cluster.routing.allocation.balance.threshold: 1.0    # 平衡阈值
```

## 5.4 集群扩展与缩容

### 5.4.1 添加节点

```bash
# 1. 安装 ES，配置 cluster.name 和 discovery.seed_hosts
# 2. 启动新节点
systemctl start elasticsearch

# 3. 验证节点加入
GET /_cat/nodes?v

# 4. ES 会自动再平衡分片（可能需要几分钟）
GET /_cat/health?v
```

### 5.4.2 安全下线节点

```bash
# 1. 排除节点（将分片迁移走）
PUT /_cluster/settings
{
  "transient": {
    "cluster.routing.allocation.exclude._name": "es-data-03"
  }
}

# 2. 等待分片迁移完成
GET /_cat/shards?v&h=index,shard,prirep,state,node&s=node

# 3. 确认节点上无分片后，停止节点
systemctl stop elasticsearch

# 4. 恢复设置（可选）
PUT /_cluster/settings
{
  "transient": {
    "cluster.routing.allocation.exclude._name": null
  }
}
```

## 5.5 跨集群搜索（CCS）

### 5.5.1 配置远程集群

```bash
# 在本地集群配置远程集群
PUT /_cluster/settings
{
  "persistent": {
    "cluster": {
      "remote": {
        "cluster_a": {
          "seeds": [
            "192.168.2.10:9300",
            "192.168.2.11:9300"
          ]
        }
      }
    }
  }
}
```

### 5.5.2 跨集群查询

```bash
# 搜索本地和远程集群
GET /my-index,cluster_a:my-index/_search
{
  "query": {
    "match": { "message": "error" }
  }
}
```

## 5.6 快照与恢复

### 5.6.1 配置快照仓库

```bash
# 注册文件系统仓库
PUT /_snapshot/my_backup
{
  "type": "fs",
  "settings": {
    "location": "/backup/elasticsearch",
    "compress": true,
    "max_snapshot_bytes_per_sec": "40mb",
    "max_restore_bytes_per_sec": "40mb"
  }
}

# 注册 S3 仓库
PUT /_snapshot/s3_backup
{
  "type": "s3",
  "settings": {
    "bucket": "my-es-backup",
    "region": "ap-northeast-1",
    "access_key": "xxx",
    "secret_key": "xxx"
  }
}
```

### 5.6.2 创建快照

```bash
# 全量快照
PUT /_snapshot/my_backup/snapshot_1?wait_for_completion=true

# 指定索引快照
PUT /_snapshot/my_backup/snapshot_2
{
  "indices": "index1,index2",
  "ignore_unavailable": true,
  "include_global_state": false
}

# 查看所有快照
GET /_snapshot/my_backup/_all

# 查看快照状态
GET /_snapshot/my_backup/snapshot_1
```

### 5.6.3 恢复快照

```bash
# 关闭目标索引（如果存在）
POST /my-index/_close

# 恢复快照
POST /_snapshot/my_backup/snapshot_1/_restore
{
  "indices": "index1,index2",
  "ignore_unavailable": true,
  "include_global_state": false,
  "rename_pattern": "(.+)",
  "rename_replacement": "restored_$1"
}

# 查看恢复进度
GET /_cat/recovery?v
```

### 5.6.4 自动化快照（SLM）

```bash
# 创建快照生命周期策略
PUT /_slm/policy/nightly-backup
{
  "schedule": "0 30 1 * * ?",           # 每天凌晨 1:30
  "name": "<nightly-snap-{now/d}>",
  "repository": "my_backup",
  "config": {
    "indices": ["*"],
    "ignore_unavailable": true,
    "include_global_state": true
  },
  "retention": {
    "expire_after": "30d",
    "min_count": 5,
    "max_count": 50
  }
}

# 手动执行
POST /_slm/policy/nightly-backup/_execute
```

## 5.7 集群监控与告警

### 5.7.1 关键监控指标

```bash
# 集群健康
GET /_cluster/health

# 节点统计
GET /_nodes/stats

# 索引统计
GET /_stats

# 待处理任务
GET /_cluster/pending_tasks

# 热点线程（排查性能问题）
GET /_nodes/hot_threads
```

**关键指标**：

| 指标 | 健康阈值 | 告警阈值 |
|------|---------|---------|
| 集群状态 | green | yellow/red |
| 未分配分片 | 0 | > 0 |
| 搜索延迟 | < 50ms | > 200ms |
| 索引延迟 | < 100ms | > 500ms |
| CPU 使用率 | < 70% | > 85% |
| 堆内存使用率 | < 75% | > 85% |
| 磁盘使用率 | < 80% | > 85% |
| GC 暂停时间 | < 100ms | > 500ms |

### 5.7.2 常见性能问题

**搜索延迟高**：
```bash
# 1. 检查慢查询
GET /_nodes/stats/indices/search

# 2. 检查查询缓存命中率
GET /_nodes/stats/indices/query_cache

# 3. 检查请求缓存
GET /_nodes/stats/indices/request_cache

# 4. 查看热点线程
GET /_nodes/hot_threads
```

**索引延迟高**：
```bash
# 1. 检查刷新间隔
GET /my-index/_settings?filter_path=**.refresh_interval

# 2. 检查 translog 配置
GET /my-index/_settings?filter_path=**.translog

# 3. 检查合并操作
GET /_cat/segments?v

# 4. 查看索引线程池
GET /_cat/thread_pool/bulk?v&h=node_name,active,queue,rejected
```

## 5.8 安全配置

### 5.8.1 启用安全功能

```yaml
# elasticsearch.yml
xpack.security.enabled: true
xpack.security.enrollment.enabled: true

# 传输层 TLS（节点间通信）
xpack.security.transport.ssl:
  enabled: true
  verification_mode: certificate
  keystore.path: certs/elastic-certificates.p12
  truststore.path: certs/elastic-certificates.p12

# HTTP 层 TLS（客户端通信）
xpack.security.http.ssl:
  enabled: true
  keystore.path: certs/http.p12
```

### 5.8.2 生成证书

```bash
# 生成 CA
bin/elasticsearch-certutil ca

# 生成节点证书
bin/elasticsearch-certutil cert --ca elastic-stack-ca.p12

# 设置密码
bin/elasticsearch-setup-passwords auto
```

### 5.8.3 用户与角色

```bash
# 创建角色
POST /_security/role/data_admin
{
  "cluster": ["monitor"],
  "indices": [
    {
      "names": ["data-*"],
      "privileges": ["read", "write", "create_index", "delete_index"]
    }
  ]
}

# 创建用户
POST /_security/user/john
{
  "password": "password123",
  "roles": ["data_admin"],
  "full_name": "John Doe",
  "email": "john@example.com"
}
```

## 5.9 生产环境最佳实践

### 5.9.1 硬件配置建议

| 节点类型 | CPU | 内存 | 存储 | 网络 |
|---------|-----|------|------|------|
| Master | 4 核 | 8GB | 100GB SSD | 1Gbps |
| Data（热） | 16 核 | 64GB | 2TB NVMe | 10Gbps |
| Data（温） | 8 核 | 32GB | 10TB HDD | 1Gbps |
| Coordinating | 8 核 | 16GB | 100GB SSD | 10Gbps |

### 5.9.2 JVM 配置

```bash
# jvm.options
-Xms31g    # 最小堆内存（不超过物理内存 50%，且 < 32GB）
-Xmx31g    # 最大堆内存（与 Xms 相同）

# GC 配置（ES 7.x+ 默认 G1GC）
-XX:+UseG1GC
-XX:G1ReservePercent=25
-XX:InitiatingHeapOccupancyPercent=30
```

**关键原则**：
- 堆内存不超过物理内存的 50%（留给 Lucene 文件系统缓存）
- 堆内存不超过 32GB（超过会失去指针压缩优化）
- Xms 和 Xmx 设置为相同值（避免运行时调整）

### 5.9.3 系统调优

```bash
# /etc/security/limits.conf
elasticsearch soft nofile 65536
elasticsearch hard nofile 65536
elasticsearch soft nproc 4096
elasticsearch hard nproc 4096

# /etc/sysctl.conf
vm.max_map_count=262144
vm.swappiness=1

# 禁用 swap
swapoff -a
```

### 5.9.4 集群规模规划

| 数据量 | 节点数 | 分片策略 | 副本数 |
|--------|--------|---------|--------|
| < 100GB | 1-3 | 1 主分片 | 0-1 |
| 100GB-1TB | 3-5 | 3-5 主分片 | 1 |
| 1TB-10TB | 5-10 | 每 30GB 一个分片 | 1 |
| 10TB-100TB | 10-50 | 每 30GB 一个分片 | 1-2 |
| > 100TB | 50+ | 冷热架构 | 1-2 |

---

## 本章小结

- ES 集群由多种角色节点组成：Master、Data、Coordinating、Ingest
- 集群健康状态：Green（完全健康）、Yellow（副本缺失）、Red（主分片缺失）
- 分片分配策略控制数据分布：节点过滤、磁盘水位、再平衡
- 快照与恢复是备份的核心：支持文件系统、S3、HDFS 等
- 监控关键指标：搜索延迟、索引延迟、CPU、内存、磁盘
- 安全配置包括 TLS、用户认证、角色权限
- 生产环境最佳实践：专用 Master、合理堆内存、禁用 swap
