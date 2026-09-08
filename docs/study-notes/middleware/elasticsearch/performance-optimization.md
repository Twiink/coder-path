---
title: "Elasticsearch性能优化"
aliases:
  - "ES性能优化"
  - "Elasticsearch调优"
tags:
  - "后端"
  - "搜索引擎"
  - "elasticsearch"
  - "性能优化"
  - "笔记"
category: "后端"
folder: "Elasticsearch"
parent: "[[目录]]"
related:
  - "[[后端/数据库/Elasticsearch/Elasticsearch分布式架构与集群管理]]"
  - "[[后端/数据库/Elasticsearch/Elasticsearch索引设计和Mapping]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 06 Elasticsearch 性能优化

性能优化是 ES 运维的核心课题，涉及写入、查询、集群配置等多个层面。本章覆盖从索引设计到运行时调优的完整优化策略。

## 6.1 写入性能优化

### 6.1.1 批量写入（Bulk API）

```python
from elasticsearch import Elasticsearch, helpers

es = Elasticsearch(['localhost:9200'])

# 准备批量数据
def generate_actions():
    for i in range(100000):
        yield {
            "_index": "logs",
            "_id": i,
            "_source": {
                "message": f"Log message {i}",
                "timestamp": "2026-09-06T10:00:00"
            }
        }

# 批量写入（推荐 500-1000 条/批）
success, errors = helpers.bulk(
    es,
    generate_actions(),
    chunk_size=1000,
    max_retries=3,
    request_timeout=60
)

print(f"成功: {success}, 失败: {len(errors)}")
```

**Bulk 优化参数**：

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| chunk_size | 500-1000 | 每批文档数 |
| max_chunk_bytes | 10-15MB | 每批大小 |
| request_timeout | 60s | 单次请求超时 |
| max_retries | 3 | 重试次数 |

### 6.1.2 批量写入时的临时优化

```bash
# 大量导入时临时调整（导入完恢复）
PUT /my-index/_settings
{
  "refresh_interval": "-1",          # 禁用自动刷新
  "number_of_replicas": 0,           # 暂不建副本
  "translog.durability": "async",    # 异步 translog
  "translog.sync_interval": "30s"
}

# 导入完成后恢复
PUT /my-index/_settings
{
  "refresh_interval": "1s",
  "number_of_replicas": 1,
  "translog.durability": "request"
}

# 强制合并（减少 segment 数量）
POST /my-index/_forcemerge?max_num_segments=5
```

### 6.1.3 Translog 配置

```yaml
# 实时写入（默认，每次请求都 fsync）
index.translog.durability: request
index.translog.sync_interval: 5s

# 异步写入（性能优先，可能丢失几秒数据）
index.translog.durability: async
index.translog.sync_interval: 30s
index.translog.flush_threshold_size: 1gb
```

**权衡**：
- `request`：数据安全，写入延迟高
- `async`：写入快，宕机可能丢失最近几秒数据

### 6.1.4 多线程并发写入

```python
from concurrent.futures import ThreadPoolExecutor
import threading

def bulk_insert(batch_id, documents):
    """单个线程的批量写入"""
    es = Elasticsearch(['localhost:9200'])
    helpers.bulk(es, documents, chunk_size=500)
    return batch_id

# 多线程并发写入
with ThreadPoolExecutor(max_workers=8) as executor:
    futures = []
    for i in range(10):
        batch = generate_batch(i)  # 每批 10000 条
        futures.append(executor.submit(bulk_insert, i, batch))
    
    for future in futures:
        future.result()  # 等待完成
```

## 6.2 查询性能优化

### 6.2.1 Filter Context vs Query Context

```json
// ❌ 慢：所有条件都计算相关性分数
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "elasticsearch" } },
        { "term": { "status": "published" } },
        { "range": { "date": { "gte": "2026-01-01" } } }
      ]
    }
  }
}

// ✅ 快：精确条件用 filter（有缓存，不计算分数）
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "elasticsearch" } }
      ],
      "filter": [
        { "term": { "status": "published" } },
        { "range": { "date": { "gte": "2026-01-01" } } }
      ]
    }
  }
}
```

### 6.2.2 避免深度分页

```json
// ❌ 慢：from + size 深度分页
{
  "from": 10000,
  "size": 10,
  "query": { "match_all": {} }
}

// ✅ 快：search_after 游标分页
{
  "size": 100,
  "query": { "match_all": {} },
  "sort": [
    { "timestamp": "desc" },
    { "_id": "asc" }
  ],
  "search_after": [1630929600000, "doc_12345"]  // 上一页最后一条的值
}

// ✅ 导出大量数据：scroll API
POST /my-index/_search?scroll=1m
{
  "size": 1000,
  "query": { "match_all": {} }
}

// 继续滚动
POST /_search/scroll
{
  "scroll": "1m",
  "scroll_id": "DnF1ZX..."
}
```

### 6.2.3 只返回需要的字段

```json
// ❌ 返回所有字段
{
  "query": { "match": { "title": "elasticsearch" } }
}

// ✅ 只返回指定字段
{
  "_source": ["title", "author", "date"],
  "query": { "match": { "title": "elasticsearch" } }
}

// ✅ 排除大字段
{
  "_source": {
    "excludes": ["content", "raw_data"]
  },
  "query": { "match": { "title": "elasticsearch" } }
}
```

### 6.2.4 路由优化

```json
// 指定路由，只查询特定分片
GET /my-index/_search?routing=user_123
{
  "query": { "term": { "user_id": "user_123" } }
}

// 多路由值
GET /my-index/_search?routing=user_123,user_456,user_789
{
  "query": { "terms": { "user_id": ["user_123", "user_456", "user_789"] } }
}
```

**适用场景**：按用户 ID 分片，查询单用户数据时直接定位到分片。

### 6.2.5 预计算与缓存

```json
// 使用 filter 缓存
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "published" } }  // 自动缓存
      ]
    }
  }
}

// 手动清除缓存
POST /my-index/_cache/clear?filter=true

// 查看缓存统计
GET /_nodes/stats/indices/query_cache
```

### 6.2.6 聚合性能优化

```json
// ❌ 慢：对 text 字段聚合
{
  "aggs": {
    "by_title": {
      "terms": { "field": "title" }  // text 字段需要全局序数，慢
    }
  }
}

// ✅ 快：对 keyword 字段聚合
{
  "aggs": {
    "by_status": {
      "terms": { 
        "field": "status",  // keyword 字段
        "size": 10
      }
    }
  }
}

// ✅ 使用 sampling 减少计算量
{
  "aggs": {
    "sample": {
      "sampler": { "shard_size": 1000 },
      "aggs": {
        "keywords": {
          "significant_text": { "field": "content" }
        }
      }
    }
  }
}
```

## 6.3 索引设计优化

### 6.3.1 Mapping 优化

```json
// 禁用不需要的功能
{
  "mappings": {
    "_source": { "enabled": true },      // 保留 _source（除非极端场景）
    "properties": {
      "timestamp": { 
        "type": "date",
        "doc_values": true              // 聚合/排序需要
      },
      "message": { 
        "type": "text",
        "index": true,                  // 需要搜索
        "norms": false                  // 不需要评分，禁用 norms
      },
      "status": { 
        "type": "keyword",
        "doc_values": true              // 需要聚合
      },
      "raw_log": { 
        "type": "text",
        "index": false,                 // 不需要搜索
        "doc_values": false             // 不需要聚合
      }
    }
  }
}
```

### 6.3.2 分片数量规划

```text
分片数量计算公式：
  分片数 = 预估数据量 / 单分片大小（推荐 30-50GB）

示例：
  数据量 100GB → 3 个主分片（100 / 35 ≈ 3）
  数据量 1TB → 25-30 个主分片
  数据量 10TB → 250-300 个主分片

注意事项：
  · 分片数创建后不可更改（需 reindex）
  · 分片过多：增加协调节点负担、集群状态膨胀
  · 分片过少：无法并行、单分片过大恢复慢
```

### 6.3.3 索引生命周期管理（ILM）

```json
PUT /_ilm/policy/logs-policy
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_size": "50gb",
            "max_age": "1d"
          },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 },
          "set_priority": { "priority": 50 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "freeze": {}
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

## 6.4 JVM 与系统调优

### 6.4.1 JVM 堆内存配置

```bash
# jvm.options
-Xms16g          # 初始堆内存
-Xmx16g          # 最大堆内存（与 Xms 相同）

# 关键原则
# 1. Xms = Xmx（避免运行时调整）
# 2. 不超过物理内存的 50%（留给 Lucene 文件系统缓存）
# 3. 不超过 32GB（超过会失去指针压缩优化）
# 4. 留出足够内存给 OS 和文件系统缓存
```

### 6.4.2 GC 调优

```bash
# ES 7.x+ 默认使用 G1GC（推荐）
-XX:+UseG1GC
-XX:G1ReservePercent=25
-XX:InitiatingHeapOccupancyPercent=30

# 监控 GC
GET /_nodes/stats/jvm

# 查看 GC 日志
tail -f /var/log/elasticsearch/gc.log
```

**GC 问题排查**：
- Young GC 频繁：正常，通常 < 100ms
- Old GC 频繁：堆内存不足，考虑增加 Xmx
- GC 暂停 > 1s：严重问题，检查内存泄漏

### 6.4.3 操作系统调优

```bash
# /etc/security/limits.conf
elasticsearch soft nofile 65536    # 文件描述符
elasticsearch hard nofile 65536
elasticsearch soft memlock unlimited  # 内存锁定
elasticsearch hard memlock unlimited

# /etc/sysctl.conf
vm.max_map_count=262144            # 虚拟内存映射
vm.swappiness=1                    # 最小化 swap
net.core.somaxconn=65535           # TCP 连接队列

# 禁用 swap
swapoff -a

# 应用配置
sysctl -p
```

### 6.4.4 文件系统缓存

```bash
# 监控文件系统缓存
GET /_nodes/stats/indices/store

# 关键指标
# indices.store.size_in_bytes：索引总大小
# 实际可用缓存 = 物理内存 - JVM 堆 - OS 预留

# 优化建议
# 1. 预留 50% 内存给文件系统缓存
# 2. 使用 SSD 提升 IO 性能
# 3. 避免与其他应用共享服务器
```

## 6.5 查询分析工具

### 6.5.1 Profile API

```json
GET /my-index/_search
{
  "profile": true,
  "query": {
    "match": { "title": "elasticsearch" }
  }
}

// 响应包含详细的查询执行计划
// - query：查询类型
// - time_in_nanos：耗时
// - breakdown：各阶段耗时分解
// - collector：结果收集器
```

### 6.5.2 慢查询日志

```yaml
# elasticsearch.yml
index.search.slowlog.threshold.query.warn: 10s
index.search.slowlog.threshold.query.info: 5s
index.search.slowlog.threshold.query.debug: 2s
index.search.slowlog.threshold.query.trace: 500ms

index.search.slowlog.threshold.fetch.warn: 1s
index.search.slowlog.threshold.fetch.info: 800ms

index.indexing.slowlog.threshold.index.warn: 10s
index.indexing.slowlog.threshold.index.info: 5s
```

```bash
# 查看慢查询日志
tail -f /var/log/elasticsearch/*_index_search_slowlog.log
```

### 6.5.3 Task Management API

```bash
# 查看长时间运行的任务
GET /_tasks?detailed=true&actions=*/search

# 取消任务
POST /_tasks/task_id:12345/_cancel

# 按节点过滤
GET /_tasks?nodes=node1,node2
```

## 6.6 性能监控与告警

### 6.6.1 关键性能指标

```bash
# 集群健康
GET /_cluster/health

# 节点统计
GET /_nodes/stats

# 索引统计
GET /_stats

# 线程池状态
GET /_cat/thread_pool?v&h=node_name,name,active,queue,rejected
```

**关键指标**：

| 指标 | 健康阈值 | 告警阈值 |
|------|---------|---------|
| 搜索延迟 | < 50ms | > 200ms |
| 索引延迟 | < 100ms | > 500ms |
| CPU 使用率 | < 70% | > 85% |
| 堆内存使用率 | < 75% | > 85% |
| 磁盘使用率 | < 80% | > 85% |
| 线程池队列 | < 100 | > 500 |
| 线程池拒绝 | 0 | > 0 |

### 6.6.2 性能基准测试

```bash
# 使用 esrally 进行基准测试
pip install esrally

# 运行官方基准
esrally --track=geonames --challenge=append-no-conflicts

# 自定义测试
esrally --track-path=/path/to/track --target-hosts=localhost:9200
```

## 6.7 常见性能问题排查

### 6.7.1 查询慢排查清单

```text
1. 检查查询类型
   □ 是否使用了 filter context？
   □ 是否有深度分页？
   □ 是否返回了不必要的字段？

2. 检查索引设计
   □ 分片数量是否合理？
   □ 是否对 text 字段聚合？
   □ 是否有不必要的全局序数？

3. 检查集群状态
   □ CPU/内存/磁盘是否正常？
   □ 线程池是否有拒绝？
   □ GC 是否频繁？

4. 使用工具分析
   □ Profile API 查看查询计划
   □ 慢查询日志定位问题
   □ Task API 查看长时间任务
```

### 6.7.2 写入慢排查清单

```text
1. 检查写入方式
   □ 是否使用 Bulk API？
   □ 批量大小是否合理（500-1000）？
   □ 是否多线程并发写入？

2. 检查索引配置
   □ refresh_interval 是否太短？
   □ 副本数是否过多？
   □ translog 配置是否合理？

3. 检查集群状态
   □ 磁盘是否接近水位线？
   □ 线程池 bulk 队列是否堆积？
   □ 是否有频繁的 GC？

4. 临时优化
   □ 大批量导入时禁用 refresh
   □ 临时减少副本数
   □ 使用异步 translog
```

### 6.7.3 集群状态异常排查

```bash
# Red 状态
GET /_cluster/allocation/explain

# 常见原因
# 1. 节点宕机 → 重启节点
# 2. 磁盘满 → 清理空间或扩容
# 3. 分片损坏 → 尝试 reroute

POST /_cluster/reroute?retry_failed=true

# Yellow 状态
GET /_cat/shards?v&h=index,shard,prirep,state,unassigned.reason&s=state

# 常见原因
# 1. 单节点无法分配副本（正常）
# 2. 节点数 < 副本数 + 1
# 3. 磁盘水位线触发
```

## 6.8 性能优化最佳实践总结

### 6.8.1 写入优化

| 优化项 | 措施 | 效果 |
|--------|------|------|
| 批量写入 | 使用 Bulk API，500-1000 条/批 | 提升 10-50 倍 |
| 并发写入 | 多线程/多进程并发 | 提升 5-10 倍 |
| 禁用 refresh | 大批量导入时设 -1 | 提升 2-5 倍 |
| 减少副本 | 导入时设 replicas=0 | 提升 2 倍 |
| 异步 translog | 非关键数据用 async | 提升 30-50% |

### 6.8.2 查询优化

| 优化项 | 措施 | 效果 |
|--------|------|------|
| Filter context | 精确条件用 filter | 提升 50-90% |
| 避免深度分页 | 使用 search_after | 避免超时 |
| 字段过滤 | 只返回需要的字段 | 减少 50-80% 传输 |
| 路由优化 | 指定 routing 参数 | 减少分片扫描 |
| 聚合优化 | 对 keyword 聚合 | 提升 10-100 倍 |

### 6.8.3 集群优化

| 优化项 | 措施 | 效果 |
|--------|------|------|
| 专用 Master | 分离 Master 节点 | 提升稳定性 |
| 合理分片 | 每分片 30-50GB | 平衡性能与恢复 |
| JVM 配置 | Xms=Xmx，不超过 50% 内存 | 避免 GC 问题 |
| 禁用 swap | swapoff + memlock | 避免性能抖动 |
| SSD 存储 | 使用 NVMe SSD | IO 提升 10-100 倍 |

---

## 本章小结

- 写入优化：Bulk API（500-1000 条/批）、多线程并发、临时禁用 refresh
- 查询优化：Filter context、search_after、字段过滤、路由优化
- 索引设计：合理分片数（30-50GB/分片）、ILM 生命周期管理
- JVM 配置：Xms=Xmx、不超过 50% 内存、不超过 32GB
- 系统调优：禁用 swap、调整文件描述符、vm.max_map_count
- 监控工具：Profile API、慢查询日志、Task Management API
- 性能指标：搜索延迟 < 50ms、索引延迟 < 100ms、CPU < 70%
