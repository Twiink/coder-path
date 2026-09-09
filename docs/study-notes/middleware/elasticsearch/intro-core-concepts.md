---
title: "Elasticsearch入门与核心概念"
aliases:
  - "ES入门"
  - "Elasticsearch基础"
tags:
  - "后端"
  - "搜索引擎"
  - "elasticsearch"
  - "笔记"
category: "后端"
folder: "Elasticsearch"
parent: "[[目录]]"
related:
  - "[[后端/数据库/Elasticsearch/Elasticsearch查询DSL]]"
  - "[[后端/数据库/Elasticsearch/Elasticsearch聚合分析]]"
  - "[[后端/数据库/Elasticsearch/Elasticsearch集群与运维]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 01 Elasticsearch 入门与核心概念

Elasticsearch（简称 ES）是基于 Apache Lucene 构建的分布式搜索与分析引擎，能对海量数据进行近实时的存储、搜索和分析。它是 ELK Stack（Elasticsearch + Logstash + Kibana）的核心组件。

## 1.1 简介与定位

| 维度 | 说明 |
| --- | --- |
| 类型 | 分布式 NoSQL 文档数据库 + 搜索引擎 |
| 底层 | Apache Lucene（Java 编写） |
| 协议 | RESTful API（HTTP + JSON） |
| 语言 | Java（核心），客户端支持几乎所有语言 |
| 许可 | Elastic License 2.0 + SSPL（8.x），7.x 前 Apache 2.0 |
| 当前版本 | 8.x（本笔记基于 7.17 / 8.x） |

**适用场景：** 全文搜索、日志分析（ELK）、应用搜索、指标分析、安全分析、地理空间搜索。

**不适用：** 作为主数据库使用（不支持事务、更新成本高、关联查询弱）。

### ES vs 关系型数据库的术语对照

| Elasticsearch | 关系型数据库 | 说明 |
| --- | --- | --- |
| Index | Database / 表 | 索引 |
| Type | 表（6.x 后已废弃） | — |
| Document | Row | JSON 文档 |
| Field | Column | 字段 |
| Mapping | Schema | 字段类型定义 |
| Query DSL | SQL | 查询语言 |
| Shard | — | 数据分片 |

## 1.2 核心概念

### 1.2.1 倒排索引（Inverted Index）

ES 的灵魂。正排索引是 `文档 → 词`，倒排索引是 `词 → 文档列表`。

```text
原始文档：
  doc1: "Elasticsearch is a search engine"
  doc2: "Elasticsearch is distributed"
  doc3: "A search engine processes queries"

倒排索引：
  elasticsearch → [doc1, doc2]
  is            → [doc1, doc2]
  a             → [doc1, doc3]
  search        → [doc1, doc3]
  engine        → [doc1, doc3]
  distributed   → [doc2]
  processes     → [doc3]
  queries       → [doc3]
```

倒排索引由两部分组成：
- **Term Dictionary（词典）**：所有去重后的 term（有序字典）
- **Posting List（倒排表）**：每个 term 对应的文档 ID 列表 + 词频 + 位置

> 这就是 ES 全文搜索快到毫秒级的根本原因 —— 查询 `search AND engine` 等价于两个 posting list 的交集运算。

### 1.2.2 Document（文档）

ES 中的基本数据单元，是 JSON 格式：

```json
{
  "_index": "products",
  "_id": "1",
  "_source": {
    "name": "MacBook Pro 16",
    "brand": "Apple",
    "price": 19999.00,
    "tags": ["laptop", "apple", "pro"],
    "created_at": "2026-09-06T10:00:00"
  }
}
```

- `_index`：所属索引名
- `_id`：文档唯一 ID（可自动生成或指定）
- `_source`：原始 JSON 数据

### 1.2.3 Index（索引）

索引是一类文档的集合，相当于关系型数据库中的"表"。

```text
索引命名规范：
  · 全小写
  · 不能包含 \, /, *, ?, ", <, >, |, 空格, ,, #
  · 不能以 -, _, + 开头
  · 不能是 . 或 ..
  · 长度不能超过 255 字节

推荐：products、order-2026、logs-app-2026.09.06（按时间滚动）
```

### 1.2.4 Shard（分片）与 Replica（副本）

```text
一个 Index 由多个 Shard 组成（水平切分）：

  Index: products (3 Primary Shards + 1 Replica)
  
  Node-1                Node-2                Node-3
  ┌──────────┐         ┌──────────┐         ┌──────────┐
  │ P0       │         │ P1       │         │ P2       │
  │ R2       │         │ R0       │         │ R1       │
  └──────────┘         └──────────┘         └──────────┘
  
  P = Primary（主分片，接受写入）
  R = Replica（副本，提供冗余 + 分担读压力）

规则：
  · 主分片数一旦创建【不可更改】（需要 reindex）
  · 副本数可随时调整
  · 主分片和其副本不会分配到同一节点
  · 写请求 → 主分片 → 同步到所有副本
  · 读请求 → 主分片或副本（负载均衡）
```

**分片数量建议**：
- 单个分片大小 10-50GB（推荐 30GB）
- 节点上每 GB 堆内存对应 20 个分片以内
- 1TB 数据 / 30GB 每分片 ≈ 33 个主分片

### 1.2.5 Cluster（集群）与 Node（节点）

| 节点角色 | 作用 | 配置 |
| --- | --- | --- |
| **Master Node** | 管理集群元数据（创建/删除索引、分配分片） | `node.roles: [master]` |
| **Data Node** | 存储数据，执行增删改查 | `node.roles: [data]` |
| **Coordinating Node** | 接收请求、分发、合并结果（所有节点默认都是） | — |
| **Ingest Node** | 数据预处理（Pipeline） | `node.roles: [ingest]` |

**专用 Master 节点（Dedicated Master）**：生产环境建议 3 个专用 Master 节点，只负责集群管理，不存数据。

### 1.2.6 Near Real-Time（近实时）

ES 是"近实时"搜索引擎：
1. 写入文档后先进入 **in-memory buffer** + **translog**
2. 默认每 **1 秒 refresh** 一次，把 buffer 写入新的 **segment**（此时可搜索）
3. 每 30 分钟或 translog 过大时 **flush**，把 segment 持久化到磁盘并清空 translog

```text
写入 → In-Memory Buffer + Translog
        ↓ (1 秒 refresh)
      Segment（可搜索，但未 fsync）
        ↓ (30 分钟 flush / translog 512MB)
      磁盘上的 Segment + 清空 Translog
        ↓ (后台定期 merge)
      合并小 Segment → 大 Segment（删除标记删除的文档）
```

> **重要**：写入后 1 秒内查询可能查不到（refresh 延迟）。强一致需求可用 `?refresh=true` 强制 refresh（影响性能）。

## 1.3 安装与启动

### 1.3.1 单节点开发环境（Docker，推荐）

```bash
# 单节点快速启动（开发用）
docker run -d --name es-single \
  -p 9200:9200 -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# 验证
curl -X GET "localhost:9200"
# 返回 ES 集群信息（名称、版本、tagline: "You Know, for Search"）
```

### 1.3.2 Docker Compose 三节点集群

```yaml
# docker-compose.yml
version: '3.8'

services:
  es01:
    image: docker.elastic.co/elasticsearch:8.11.0
    container_name: es01
    environment:
      - node.name=es01
      - cluster.name=es-cluster
      - discovery.seed_hosts=es02,es03
      - cluster.initial_master_nodes=es01,es02,es03
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es01_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    networks: [elastic]

  es02:
    image: docker.elastic.co/elasticsearch:8.11.0
    container_name: es02
    environment:
      - node.name=es02
      - cluster.name=es-cluster
      - discovery.seed_hosts=es01,es03
      - cluster.initial_master_nodes=es01,es02,es03
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es02_data:/usr/share/elasticsearch/data
    networks: [elastic]

  es03:
    image: docker.elastic.co/elasticsearch:8.11.0
    container_name: es03
    environment:
      - node.name=es03
      - cluster.name=es-cluster
      - discovery.seed_hosts=es01,es02
      - cluster.initial_master_nodes=es01,es02,es03
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es03_data:/usr/share/elasticsearch/data
    networks: [elastic]

volumes:
  es01_data:
  es02_data:
  es03_data:

networks:
  elastic:
    driver: bridge
```

### 1.3.3 Linux 裸机安装

```bash
# 系统要求（重要！）
# 1. 调大虚拟内存映射
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 2. 关闭 swap（重要，避免性能抖动）
sudo swapoff -a

# 3. 调整文件描述符
ulimit -n 65536

# 安装（CentOS/RHEL）
wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.11.0-x86_64.rpm
sudo rpm --install elasticsearch-8.11.0-x86_64.rpm

# 启动
sudo systemctl daemon-reload
sudo systemctl enable --now elasticsearch.service

# 查看状态
curl -k -u elastic:<初始密码> https://localhost:9200
```

### 1.3.4 常用配置（elasticsearch.yml）

```yaml
# /etc/elasticsearch/elasticsearch.yml

cluster.name: my-es-cluster
node.name: node-1
node.roles: [master, data]

# 网络
network.host: 0.0.0.0
http.port: 9200
transport.port: 9300

# 集群发现
discovery.seed_hosts: ["192.168.1.10", "192.168.1.11", "192.168.1.12"]
cluster.initial_master_nodes: ["node-1", "node-2", "node-3"]

# 数据目录
path.data: /var/lib/elasticsearch
path.logs: /var/log/elasticsearch

# 内存锁定（防止 swap，生产必须开启）
bootstrap.memory_lock: true

# 安全（生产环境开启）
xpack.security.enabled: true
xpack.security.enrollment.enabled: true
xpack.security.http.ssl:
  enabled: true
  keystore.path: certs/http.p12
xpack.security.transport.ssl:
  enabled: true
  verification_mode: certificate
  keystore.path: certs/transport.p12
  truststore.path: certs/transport.p12
```

## 1.4 基本 CRUD（RESTful API）

### 1.4.1 索引管理

```bash
# 创建索引
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "1s"
  },
  "mappings": {
    "properties": {
      "name": { "type": "text", "analyzer": "ik_max_word" },
      "brand": { "type": "keyword" },
      "price": { "type": "float" },
      "tags": { "type": "keyword" },
      "created_at": { "type": "date" }
    }
  }
}

# 查看索引
GET /products
GET /_cat/indices?v                        # 列表视图
GET /_cat/indices/products?v&s=index       # 排序

# 删除索引
DELETE /products

# 关闭索引（不可读写，但保留数据）
POST /products/_close
POST /products/_open
```

### 1.4.2 文档 CRUD

```bash
# 创建文档（指定 ID）
PUT /products/_doc/1
{
  "name": "MacBook Pro 16",
  "brand": "Apple",
  "price": 19999.00,
  "tags": ["laptop", "apple", "pro"],
  "created_at": "2026-09-06"
}

# 创建文档（自动生成 ID）
POST /products/_doc
{ "name": "iPhone 15", "brand": "Apple", "price": 7999 }

# 查询文档
GET /products/_doc/1

# 更新文档（全量替换，PUT 不带 _source 包装）
PUT /products/_doc/1
{ "name": "MacBook Pro 16 M3", "brand": "Apple", "price": 21999 }

# 局部更新（推荐，只修改指定字段）
POST /products/_update/1
{
  "doc": { "price": 18999 }
}

# 脚本更新
POST /products/_update/1
{
  "script": {
    "source": "ctx._source.price += params.delta",
    "params": { "delta": -1000 }
  }
}

# 删除文档
DELETE /products/_doc/1

# 批量操作（_bulk API，性能关键！）
POST /_bulk
{ "index": { "_index": "products", "_id": "2" } }
{ "name": "iPhone 15 Pro", "brand": "Apple", "price": 9999 }
{ "index": { "_index": "products", "_id": "3" } }
{ "name": "Pixel 8", "brand": "Google", "price": 4999 }
{ "update": { "_index": "products", "_id": "2" } }
{ "doc": { "price": 8999 } }
{ "delete": { "_index": "products", "_id": "3" } }
```

### 1.4.3 _bulk API 最佳实践

```text
_bulk 是 ES 写入性能的钥匙：
  · 单次 bulk 建议 5-15MB
  · 每次 bulk 文档数 500-1000 条
  · 太大反而降低性能（网络延迟、内存压力）
  · 多线程并发发送 bulk（生产者-消费者模式）

错误处理：
  · bulk 是"部分成功"的（每条操作独立）
  · 检查响应中的 errors 字段
  · 失败的文档要重试
```

## 1.5 Mapping（字段类型映射）

### 1.5.1 常用字段类型

| 类型 | 用途 | 是否分词 |
| --- | --- | --- |
| `text` | 全文文本，会分词，用于全文搜索 | ✅ |
| `keyword` | 精确值，不分词，用于过滤、排序、聚合 | ❌ |
| `long`, `integer`, `short`, `byte` | 整数 | — |
| `double`, `float`, `half_float` | 浮点数 | — |
| `boolean` | 布尔 | — |
| `date` / `date_nanos` | 日期 | — |
| `object` | 嵌套 JSON 对象 | — |
| `nested` | 嵌套对象数组（保留对象边界） | — |
| `geo_point` | 经纬度 | — |
| `geo_shape` | 复杂地理形状 | — |
| `ip` | IPv4/IPv6 | — |
| `binary` | Base64 编码的二进制 | — |

### 1.5.2 text vs keyword（最容易混淆）

```json
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "ik_max_word",         // 写入时用细粒度分词
        "search_analyzer": "ik_smart"      // 搜索时用智能分词
      },
      "status": { "type": "keyword" },     // 精确值，不分词
      "email": {
        "type": "text",
        "fields": {                        // 同字段多类型
          "keyword": { "type": "keyword", "ignore_above": 256 }
        }
      }
    }
  }
}
```

- `text`：用于"搜索"场景（`match` 查询），ES 会分词
- `keyword`：用于"过滤/排序/聚合"场景（`term`、`terms`、`aggs`），ES 不分词
- 一个字段可以同时定义两种类型（`fields`），搜索用 text 版本，聚合用 keyword 版本

### 1.5.3 Dynamic Mapping（自动推断）

| JSON 值 | 默认推断类型 |
| --- | --- |
| `null` | 跳过 |
| `true` / `false` | `boolean` |
| `123` | `long` |
| `123.45` | `float` |
| `"2026-09-06"` | `date` |
| `"hello"` | `text` + `keyword` 子字段 |
| (&#123; "a": 1 &#125;) | `object` |
| `[1, 2, 3]` | 根据元素类型 |

> **生产环境建议 `dynamic: strict`**，拒绝未定义字段写入，避免 Mapping 爆炸（Mapping Explosion）。

```json
{
  "mappings": {
    "dynamic": "strict",
    "properties": { ... }
  }
}
```

- `true`（默认）：自动添加新字段
- `false`：忽略新字段（不索引、不存储）
- `strict`：拒绝新字段，报错

## 1.6 Analyzer（分词器）

### 1.6.1 组成

```text
Analyzer = Character Filter → Tokenizer → Token Filter

① Character Filter（字符过滤器）：处理原始字符
   · html_strip：去掉 HTML 标签
   · mapping：字符映射

② Tokenizer（分词器，核心）：把字符串切成 token
   · standard：默认，按空格/标点切
   · whitespace：仅按空格切
   · ik_max_word / ik_smart：中文分词（需 ik 插件）

③ Token Filter（词元过滤器）：对 token 做后处理
   · lowercase：转小写
   · stop：去掉停用词（the, a, is 等）
   · synonym：同义词替换
   · stemmer：词干提取（running → run）
```

### 1.6.2 内置 Analyzer

```bash
# 测试分词
POST /_analyze
{
  "analyzer": "standard",
  "text": "Elasticsearch is a Search Engine"
}
# 输出：["elasticsearch", "is", "a", "search", "engine"]

POST /_analyze
{
  "analyzer": "ik_max_word",
  "text": "Elasticsearch是一个分布式搜索引擎"
}
# 输出：["elasticsearch", "是", "一个", "分布", "分布式", "搜索", "引擎", ...]

POST /_analyze
{
  "analyzer": "ik_smart",
  "text": "Elasticsearch是一个分布式搜索引擎"
}
# 输出：["elasticsearch", "是", "一个", "分布式", "搜索引擎"]（更智能、更少）
```

### 1.6.3 中文分词 IK

```bash
# 安装 IK 插件（版本必须与 ES 一致）
./bin/elasticsearch-plugin install https://get.infini.cloud/elasticsearch/analysis-ik/8.11.0

# 重启 ES
# 自定义词典：config/analysis-ik/IKAnalyzer.cfg.xml
```

```xml
<!-- IKAnalyzer.cfg.xml -->
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
  <entry key="ext_dict">custom/mydict.dic</entry>
  <entry key="ext_stopwords">custom/ext_stopword.dic</entry>
</properties>
```

### 1.6.4 自定义 Analyzer

```json
PUT /my_index
{
  "settings": {
    "analysis": {
      "analyzer": {
        "my_chinese_analyzer": {
          "type": "custom",
          "tokenizer": "ik_max_word",
          "filter": ["lowercase", "my_synonym", "my_stop"]
        }
      },
      "filter": {
        "my_synonym": {
          "type": "synonym",
          "synonyms": ["手机, 手提电话, 智能手机", "笔记本, laptop"]
        },
        "my_stop": {
          "type": "stop",
          "stopwords": ["的", "了", "在", "是"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "content": {
        "type": "text",
        "analyzer": "my_chinese_analyzer"
      }
    }
  }
}
```

## 1.7 集群健康与状态

```bash
# 集群健康（最重要的一条命令）
GET /_cluster/health
# 返回：
# {
#   "cluster_name": "es-cluster",
#   "status": "green",        // green/yellow/red
#   "number_of_nodes": 3,
#   "active_primary_shards": 15,
#   "active_shards": 30,
#   "unassigned_shards": 0
# }

# 健康状态含义
# green  : 所有主分片和副本分片都正常
# yellow : 所有主分片正常，部分副本分片未分配（单节点集群常态）
# red    : 部分主分片未分配（有数据不可用！）

# 查看未分配的分片原因
GET /_cluster/allocation/explain
{
  "index": "products",
  "shard": 0,
  "primary": false
}

# 节点状态
GET /_cat/nodes?v
GET /_cat/shards?v
GET /_cat/indices?v&health=red    # 只看红状态的索引
```

## 1.8 常见问题与最佳实践

1. **不要在生产环境用单节点**，至少 3 节点集群 + 1 副本
2. **设置 `bootstrap.memory_lock: true`**，防止 JVM 堆被换出
3. **关闭 swap**：`swapoff -a`，否则性能会断崖式下跌
4. **调整 `vm.max_map_count=262144`**，否则启动失败
5. **分片数量谨慎设计**：主分片数创建后不可更改
6. **单个分片 10-50GB**：太大恢复慢，太小 overhead 高
7. **生产开启 xpack.security**：默认账号 `elastic`，一定要改密码
8. **Mapping 设置 `dynamic: strict`**：避免 Mapping Explosion
9. **写入用 `_bulk` API**：单条写入性能差几个数量级
10. **写入后强一致用 `?refresh=true`**：但严重影响性能，仅测试用

---

## 本章小结

- Elasticsearch 是基于 Lucene 的分布式搜索与分析引擎，数据以 JSON 文档形式存储在索引中
- **倒排索引**是 ES 全文搜索快到毫秒级的核心原理
- 索引由多个**分片**组成，每个分片有副本，提供高可用和读扩展
- ES 是**近实时**搜索，写入后 1 秒 refresh 后才可搜索
- 节点角色：Master（管理）、Data（存储）、Coordinating（路由）、Ingest（预处理）
- **text 用于搜索、keyword 用于过滤/聚合**，是 Mapping 设计最重要的区分
- 中文搜索必须装 **IK 分词插件**，`ik_max_word` 用于写入、`ik_smart` 用于搜索
- 写入用 **`_bulk` API**，单次 5-15MB 是最佳
- 集群健康看 `/_cluster/health`，green 是目标状态
