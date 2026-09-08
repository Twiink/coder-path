---
title: "Elasticsearch索引设计与Mapping"
aliases:
  - "ES索引设计"
  - "Elasticsearch Mapping"
tags:
  - "后端"
  - "搜索引擎"
  - "elasticsearch"
  - "索引设计"
  - "笔记"
category: "后端"
folder: "Elasticsearch"
parent: "[[目录]]"
related:
  - "[[后端/数据库/Elasticsearch/Elasticsearch入门与核心概念]]"
  - "[[后端/数据库/Elasticsearch/Elasticsearch查询DSL]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 04 Elasticsearch 索引设计与 Mapping

Mapping 是 ES 中文档的结构定义，决定了字段如何被索引、存储和搜索。良好的索引设计直接决定搜索质量、写入性能和存储效率。

## 4.1 Mapping 详解

### 4.1.1 查看 Mapping

```bash
GET /products/_mapping
```

响应示例：
```json
{
  "products": {
    "mappings": {
      "properties": {
        "name": {
          "type": "text",
          "analyzer": "ik_max_word",
          "search_analyzer": "ik_smart"
        },
        "brand": {
          "type": "keyword"
        },
        "price": {
          "type": "float"
        }
      }
    }
  }
}
```

### 4.1.2 显式定义 Mapping

```bash
PUT /products
{
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "product_id": { "type": "keyword" },
      "name": {
        "type": "text",
        "analyzer": "ik_max_word",
        "search_analyzer": "ik_smart"
      },
      "brand": { "type": "keyword" },
      "price": { "type": "scaled_float", "scaling_factor": 100 },
      "category": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "description": { "type": "text", "analyzer": "ik_smart" },
      "status": { "type": "keyword" },
      "stock": { "type": "integer" },
      "created_at": { "type": "date", "format": "yyyy-MM-dd HH:mm:ss||epoch_millis" },
      "updated_at": { "type": "date" },
      "location": { "type": "geo_point" },
      "attributes": {
        "type": "object",
        "properties": {
          "color": { "type": "keyword" },
          "weight": { "type": "float" }
        }
      },
      "comments": {
        "type": "nested",
        "properties": {
          "user_id": { "type": "keyword" },
          "rating": { "type": "byte" },
          "content": { "type": "text", "analyzer": "ik_smart" },
          "created_at": { "type": "date" }
        }
      }
    }
  }
}
```

## 4.2 字段类型深度解析

### 4.2.1 数值类型对比

| 类型 | 字节 | 范围 | 适用场景 |
| --- | --- | --- | --- |
| `byte` | 1 | -128~127 | 评分、年龄 |
| `short` | 2 | -32768~32767 | 小计数 |
| `integer` | 4 | -21 亿~21 亿 | 普通整数 |
| `long` | 8 | -922 亿亿~922 亿亿 | 时间戳、大整数 |
| `float` | 4 | 单精度 | 近似计算 |
| `double` | 8 | 双精度 | 近似计算 |
| `half_float` | 2 | 半精度 | 空间敏感场景 |
| `scaled_float` | 8 | 缩放整数 | **金额、价格** |
| `unsigned_long` | 8 | 无符号 64 位 | 正整数 |

```json
// scaled_float 示例（推荐用于金额）
{
  "price": {
    "type": "scaled_float",
    "scaling_factor": 100     // 199.99 → 内部存 19999
  }
}
```

> **金额一定要用 `scaled_float` 而非 `float`/`double`**，避免浮点精度问题。

### 4.2.2 date 与 date_nanos

```json
// 标准 date（毫秒精度）
{
  "created_at": {
    "type": "date",
    "format": "yyyy-MM-dd HH:mm:ss||yyyy-MM-dd||epoch_millis"
  }
}

// 纳秒精度（7.x+）
{
  "event_time": {
    "type": "date_nanos",
    "format": "strict_date_optional_time_nanos"
  }
}
```

**常用 format**：
- `yyyy-MM-dd`
- `yyyy-MM-dd HH:mm:ss`
- `epoch_millis`（Unix 毫秒时间戳）
- `epoch_second`（Unix 秒时间戳）
- `strict_date_optional_time`（ISO 8601）
- 多个用 `||` 分隔表示接受多种格式

### 4.2.3 object vs nested

```json
// object：对象数组会被"扁平化"
PUT /test/_doc/1
{
  "users": [
    { "first": "John", "last": "Smith" },
    { "first": "Alice", "last": "White" }
  ]
}
// 内部存储为：
// users.first: [John, Alice]
// users.last: [Smith, White]
// 查询 first=John AND last=White 会匹配！这是错的

// nested：保留对象边界
PUT /test_nested
{
  "mappings": {
    "properties": {
      "users": {
        "type": "nested",
        "properties": {
          "first": { "type": "keyword" },
          "last": { "type": "keyword" }
        }
      }
    }
  }
}
// 每个对象独立存储，查询 first=John AND last=White 不会匹配（除非同一对象）
```

| 特性 | object | nested |
| --- | --- | --- |
| 存储 | 扁平化 | 独立隐藏文档 |
| 对象边界 | ❌ 丢失 | ✅ 保留 |
| 查询复杂度 | 简单 | 需要 nested query |
| 性能 | 高 | 较低（每个元素一个隐藏文档） |
| 适用场景 | 单对象、简单结构 | 对象数组且需要精确查询 |

### 4.2.4 keyword 子字段（Multi-field）

让同一字段既支持全文搜索又支持聚合：

```json
{
  "email": {
    "type": "text",
    "fields": {
      "keyword": {
        "type": "keyword",
        "ignore_above": 256
      }
    }
  }
}
```

- 搜索用 `email`（text）
- 聚合/过滤用 `email.keyword`（keyword）

`ignore_above`：超过此长度的字符串不建立 keyword 索引，避免内存爆炸。

## 4.3 字段参数详解

### 4.3.1 index 与 doc_values

```json
{
  "field_name": {
    "type": "keyword",
    "index": true,          // 是否建立倒排索引（默认 true）
    "doc_values": true      // 是否建立列存（聚合/排序用，默认 true）
  }
}
```

| 用途 | index | doc_values |
| --- | --- | --- |
| 全文搜索 | ✅ true | ❌ false |
| 聚合/排序 | ❌ false | ✅ true |
| 既搜索又聚合 | ✅ true | ✅ true |
| 仅存储不查询 | ❌ false | ❌ false |

```json
// 仅存储（如原始日志，只 _source 输出）
{
  "raw_log": {
    "type": "text",
    "index": false,
    "doc_values": false
  }
}
```

### 4.3.2 store vs _source

```json
{
  "title": {
    "type": "text",
    "store": true       // 单独存储该字段（不依赖 _source）
  }
}
```

- 默认 `_source` 存储完整原始 JSON
- `store: true` 单独存储字段，可在 `_source: false` 时直接取该字段
- 多数情况不需要 `store: true`

### 4.3.3 enabled 与 dynamic

```json
{
  "metadata": {
    "type": "object",
    "enabled": false      // 整个对象不索引，只 _source 存储
  }
}
```

- `enabled: false`：对象完全不索引，只能从 `_source` 读
- `dynamic: false`：对象内的新字段不索引，但对象本身可索引

### 4.3.4 copy_to（字段合并）

```json
{
  "first_name": { "type": "text", "copy_to": "full_name" },
  "last_name": { "type": "text", "copy_to": "full_name" },
  "full_name": { "type": "text" }      // 合并字段
}
```

- 查询 `full_name` 可以同时搜索 first_name + last_name
- 用于实现"全字段搜索"

### 4.3.5 null_value

```json
{
  "status": {
    "type": "keyword",
    "null_value": "UNKNOWN"     // null 值替换为 UNKNOWN 索引
  }
}
```

- ES 默认不索引 null
- `null_value` 可以让 null 也能被 `term` 查询命中

## 4.4 Mapping 演进与变更

### 4.4.1 Mapping 不可变

**重要**：已存在的字段类型不能更改！例如 `text` 不能改为 `keyword`。

### 4.4.2 新增字段（允许）

```bash
PUT /products/_mapping
{
  "properties": {
    "discount": { "type": "float" }
  }
}
```

### 4.4.3 修改字段类型（必须 Reindex）

```bash
// 1. 创建新索引（目标 Mapping）
PUT /products_v2
{
  "mappings": {
    "properties": {
      "price": { "type": "scaled_float", "scaling_factor": 100 }
    }
  }
}

// 2. Reindex 数据
POST /_reindex
{
  "source": { "index": "products" },
  "dest": { "index": "products_v2" }
}

// 3. 切换别名
POST /_aliases
{
  "actions": [
    { "remove": { "index": "products", "alias": "products_alias" } },
    { "add": { "index": "products_v2", "alias": "products_alias" } }
  ]
}

// 4. 删除旧索引
DELETE /products
```

## 4.5 索引模板（Index Templates）

### 4.5.1 Composable Templates（推荐，7.8+）

```bash
PUT /_index_template/logs_template
{
  "index_patterns": ["logs-*"],
  "priority": 100,
  "template": {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 1,
      "refresh_interval": "5s"
    },
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "level": { "type": "keyword" },
        "message": { "type": "text" }
      }
    },
    "aliases": {
      "logs": {}
    }
  },
  "composed_of": ["logs_base", "logs_metrics"]   // 可组合组件
}
```

### 4.5.2 Component Templates（可复用组件）

```bash
PUT /_component_template/logs_base
{
  "template": {
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "host": { "type": "keyword" }
      }
    }
  }
}

PUT /_component_template/logs_metrics
{
  "template": {
    "mappings": {
      "properties": {
        "cpu_usage": { "type": "float" },
        "memory_mb": { "type": "long" }
      }
    }
  }
}
```

## 4.6 索引生命周期管理（ILM）

### 4.6.1 定义策略

```bash
PUT /_ilm/policy/logs_policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_size": "50gb",
            "max_age": "7d"
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
          "freeze": {},
          "set_priority": { "priority": 0 }
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

### 4.6.2 关联到索引

```bash
PUT /logs-2026.09
{
  "settings": {
    "index.lifecycle.name": "logs_policy",
    "index.lifecycle.rollover_alias": "logs-write"
  }
}
```

## 4.7 索引别名（Alias）

```bash
// 创建别名
POST /_aliases
{
  "actions": [
    { "add": { "index": "products-2026", "alias": "products" } }
  ]
}

// 切换别名（零停机更新）
POST /_aliases
{
  "actions": [
    { "remove": { "index": "products-v1", "alias": "products" } },
    { "add": { "index": "products-v2", "alias": "products" } }
  ]
}

// 带过滤的别名（视图）
POST /_aliases
{
  "actions": [
    {
      "add": {
        "index": "logs-*",
        "alias": "recent_logs",
        "filter": {
          "range": { "@timestamp": { "gte": "now-7d" } }
        }
      }
    }
  ]
}
```

## 4.8 索引设计最佳实践

### 4.8.1 命名规范

```text
索引名：{业务}-{类型}-{时间}
  例：order-detail-2026.09、log-app-2026.09.06

别名：业务名（不带时间）
  例：order-detail、log-app
```

### 4.8.2 分片数设计

```text
单分片 10-50GB（推荐 30GB）
计算公式：
  分片数 = 预估数据量 / 30GB

例：
  100GB 数据 → 4 个主分片
  1TB 数据 → 33 个主分片

副本：
  开发环境：0 副本
  生产环境：1 副本（标准）
  高可用：2 副本
```

### 4.8.3 Mapping 设计清单

- ✅ **`dynamic: strict`**：拒绝未定义字段
- ✅ **数值类型精确选择**：金额用 `scaled_float`，计数用 `integer`
- ✅ **text + keyword 双类型**：搜索用 text，聚合用 keyword
- ✅ **中文用 IK 分词**：写入 `ik_max_word`，搜索 `ik_smart`
- ✅ **对象数组用 `nested`**：保留对象边界
- ✅ **不用的字段 `index: false`**：减少索引体积
- ✅ **日期指定 `format`**：避免格式歧义
- ✅ **`ignore_above: 256`**：keyword 字段限制长度
- ✅ **`null_value`**：让 null 可被查询

### 4.8.4 性能优化 Mapping

```json
{
  "mappings": {
    "dynamic": "strict",
    "properties": {
      // 仅存储不查询
      "raw_content": { "type": "text", "index": false },

      // 仅聚合用
      "user_id": { "type": "keyword", "doc_values": true },

      // 禁用 _source（极端场景）
      // "_source": { "enabled": false }

      // 禁用 norms（不需要评分的 text）
      "title": { "type": "text", "norms": false }
    }
  }
}
```

---

## 本章小结

- Mapping 定义字段类型、分词器、存储方式，**字段类型创建后不可更改**
- **金额用 `scaled_float`**，避免浮点精度问题
- **`text` + `keyword` 多字段**：搜索用 text，聚合用 keyword
- **object 会扁平化，nested 保留对象边界**（对象数组必须用 nested）
- **`index`/`doc_values` 按需开关**：减少不必要的索引开销
- **索引模板（Composable Template）**：自动化创建符合规范的索引
- **ILM 策略**：自动 rollover → warm → cold → delete
- **索引别名**：零停机切换索引
- **分片数 = 预估数据量 / 30GB**，单分片 10-50GB
