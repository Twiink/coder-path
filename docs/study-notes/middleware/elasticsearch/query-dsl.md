---
title: "Elasticsearch查询DSL与搜索"
aliases:
  - "ES查询DSL"
  - "Elasticsearch搜索"
tags:
  - "后端"
  - "搜索引擎"
  - "elasticsearch"
  - "查询"
  - "笔记"
category: "后端"
folder: "Elasticsearch"
parent: "[[目录]]"
related:
  - "[[后端/数据库/Elasticsearch/Elasticsearch入门与核心概念]]"
  - "[[后端/数据库/Elasticsearch/Elasticsearch聚合分析]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 02 Elasticsearch 查询 DSL 与搜索

Elasticsearch 使用 JSON 格式的 Query DSL（Domain Specific Language）进行查询，功能强大且灵活。本章覆盖全文搜索、精确查询、复合查询、过滤、排序、分页等核心搜索能力。

## 2.1 Query DSL 基础结构

### 2.1.1 基本查询结构

```json
GET /products/_search
{
  "query": {
    "match": {
      "name": "MacBook"
    }
  }
}
```

所有查询都遵循这个结构：
- `query`：查询条件
- `from` / `size`：分页
- `sort`：排序
- `_source`：返回字段控制
- `highlight`：高亮
- `aggs`：聚合

### 2.1.2 查询上下文 vs 过滤上下文

| 上下文 | 用途 | 是否计算相关性分数 | 是否缓存 |
| --- | --- | --- | --- |
| **Query Context** | "这个文档有多匹配？" | ✅ 计算 `_score` | ❌ 不缓存 |
| **Filter Context** | "这个文档是否匹配？" | ❌ 不计算分数 | ✅ 缓存 |

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "name": "MacBook" } }      // Query Context
      ],
      "filter": [
        { "term": { "brand": "Apple" } },        // Filter Context
        { "range": { "price": { "lte": 20000 } } }
      ]
    }
  }
}
```

> **最佳实践**：精确匹配的条件（状态、分类、时间范围）放 `filter`，全文搜索放 `must`/`should`。

## 2.2 全文搜索查询

### 2.2.1 match 查询

对字段进行分词后搜索，最常用的查询。

```json
// 搜索 name 字段包含 "MacBook Pro" 的文档
{
  "query": {
    "match": {
      "name": {
        "query": "MacBook Pro",
        "operator": "or"          // 默认，任一词匹配即可
      }
    }
  }
}

// 要求所有词都匹配（AND）
{
  "query": {
    "match": {
      "name": {
        "query": "MacBook Pro",
        "operator": "and"
      }
    }
  }
}

// 最少匹配词数
{
  "query": {
    "match": {
      "name": {
        "query": "Apple MacBook Pro 16寸",
        "minimum_should_match": "75%"   // 至少匹配 75% 的词
      }
    }
  }
}
```

### 2.2.2 match_phrase 短语查询

要求词按顺序紧邻出现。

```json
{
  "query": {
    "match_phrase": {
      "name": {
        "query": "MacBook Pro",
        "slop": 1                  // 允许词之间有 1 个其他词
      }
    }
  }
}
// 匹配："MacBook Air Pro"、"MacBook 新款 Pro"
// 不匹配："Pro MacBook"（顺序不对）
```

### 2.2.3 multi_match 多字段搜索

```json
{
  "query": {
    "multi_match": {
      "query": "Apple",
      "fields": ["name", "description", "tags"],
      "type": "best_fields",       // 默认，取最高分
      "tie_breaker": 0.3           // 其他字段的分数乘以 0.3 加入总分
    }
  }
}
```

**multi_match 类型**：

| 类型 | 说明 |
| --- | --- |
| `best_fields` | 取单个字段最高分（默认） |
| `most_fields` | 所有字段分数相加 |
| `cross_fields` | 把多个字段当成一个大字段（适合姓名拆分场景） |
| `phrase` | 每个字段做 match_phrase |
| `phrase_prefix` | 每个字段做 match_phrase_prefix |

### 2.2.4 match_phrase_prefix 前缀短语

```json
{
  "query": {
    "match_phrase_prefix": {
      "name": {
        "query": "MacBook P",
        "max_expansions": 50        // 最多扩展到 50 个词
      }
    }
  }
}
// 用于"搜索建议"场景，匹配 "MacBook Pro"、"MacBook Pro Max"
```

## 2.3 精确值查询

### 2.3.1 term 精确匹配

用于 `keyword`、`numeric`、`date`、`boolean` 等不分词的字段。

```json
{
  "query": {
    "term": {
      "brand": "Apple"             // 完全相等
    }
  }
}

{
  "query": {
    "term": {
      "price": 19999
    }
  }
}
```

> **注意**：`term` 不会对查询词分词。如果对 `text` 字段用 `term`，必须用分词后的词。

### 2.3.2 terms 多值匹配（IN）

```json
{
  "query": {
    "terms": {
      "brand": ["Apple", "Google", "Microsoft"]
    }
  }
}
// 等价 SQL：WHERE brand IN ('Apple', 'Google', 'Microsoft')
```

### 2.3.3 range 范围查询

```json
{
  "query": {
    "range": {
      "price": {
        "gte": 5000,               // >=
        "lte": 20000,              // <=
        "format": "strict_date_optional_time"
      }
    }
  }
}

// 日期范围
{
  "query": {
    "range": {
      "created_at": {
        "gte": "2026-01-01",
        "lt": "2026-10-01",
        "format": "yyyy-MM-dd"
      }
    }
  }
}

// 相对日期（现在往前推）
{
  "query": {
    "range": {
      "created_at": {
        "gte": "now-7d/d",         // 7 天前的 0 点
        "lt": "now/d"              // 今天的 0 点
      }
    }
  }
}
```

**range 操作符**：
- `gt`：大于
- `gte`：大于等于
- `lt`：小于
- `lte`：小于等于

### 2.3.4 exists 字段存在查询

```json
{
  "query": {
    "exists": {
      "field": "description"
    }
  }
}
```

### 2.3.5 ids 文档 ID 查询

```json
{
  "query": {
    "ids": {
      "values": ["1", "2", "3"]
    }
  }
}
```

### 2.3.6 wildcard 通配符查询

```json
{
  "query": {
    "wildcard": {
      "name.keyword": {
        "value": "Mac*",           // * 匹配任意字符
        "case_insensitive": true
      }
    }
  }
}

// ? 匹配单个字符
{
  "query": {
    "wildcard": {
      "name.keyword": "Mac?ook*"
    }
  }
}
```

> **性能警告**：避免以 `*` 开头的通配符（如 `*Book`），会导致全索引扫描。

### 2.3.7 regexp 正则查询

```json
{
  "query": {
    "regexp": {
      "name.keyword": "Mac.*Pro.*"
    }
  }
}
```

> **性能警告**：正则查询非常慢，生产慎用。

### 2.3.8 prefix 前缀查询

```json
{
  "query": {
    "prefix": {
      "name.keyword": {
        "value": "Mac"
      }
    }
  }
}
```

## 2.4 复合查询（bool query）

`bool` 查询是组合多个子查询的核心，支持 `must`、`should`、`must_not`、`filter`。

### 2.4.1 基本结构

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "name": "MacBook" } }       // 必须匹配，参与评分
      ],
      "should": [
        { "term": { "brand": "Apple" } },         // 可选，匹配会提高分数
        { "term": { "tags": "pro" } }
      ],
      "must_not": [
        { "term": { "status": "discontinued" } }  // 必须不匹配
      ],
      "filter": [
        { "range": { "price": { "lte": 20000 } } } // 必须匹配，不参与评分，有缓存
      ],
      "minimum_should_match": 1                    // should 至少匹配 1 个
    }
  }
}
```

### 2.4.2 嵌套 bool 查询

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "name": "laptop" } }
      ],
      "should": [
        {
          "bool": {
            "must": [
              { "term": { "brand": "Apple" } },
              { "range": { "price": { "gte": 15000 } } }
            ]
          }
        },
        {
          "bool": {
            "must": [
              { "term": { "brand": "Dell" } },
              { "range": { "price": { "lte": 10000 } } }
            ]
          }
        }
      ],
      "minimum_should_match": 1
    }
  }
}
// 等价：(name 含 laptop) AND ((Apple 且贵) OR (Dell 且便宜))
```

## 2.5 嵌套与对象查询

### 2.5.1 object 字段查询

普通对象字段会被"扁平化"：

```json
// 文档
{
  "user": {
    "first": "John",
    "last": "Smith"
  }
}

// 查询
{
  "query": {
    "bool": {
      "must": [
        { "match": { "user.first": "John" } },
        { "match": { "user.last": "Smith" } }
      ]
    }
  }
}
```

### 2.5.2 nested 字段查询

`nested` 类型保留对象数组中每个对象的边界。

```json
// Mapping
{
  "mappings": {
    "properties": {
      "comments": {
        "type": "nested",
        "properties": {
          "author": { "type": "keyword" },
          "text": { "type": "text" }
        }
      }
    }
  }
}

// 查询：找 author="alice" 且 text 包含 "good" 的评论
{
  "query": {
    "nested": {
      "path": "comments",
      "query": {
        "bool": {
          "must": [
            { "term": { "comments.author": "alice" } },
            { "match": { "comments.text": "good" } }
          ]
        }
      },
      "inner_hits": {}                 // 返回匹配的嵌套文档
    }
  }
}
```

> **关键**：普通 `object` 数组会丢失对象边界，`nested` 保留边界但查询需要 `nested` 包装。

## 2.6 地理空间查询

### 2.6.1 geo_point 字段

```json
// Mapping
{
  "mappings": {
    "properties": {
      "location": { "type": "geo_point" }
    }
  }
}

// 写入
PUT /shops/_doc/1
{
  "name": "Apple Store 三里屯",
  "location": { "lat": 39.933, "lon": 116.454 }
}
// 或 "location": "39.933,116.454"
// 或 "location": [116.454, 39.933]    # 注意：geojson 是 [lon, lat]
```

### 2.6.2 geo_distance 距离查询

```json
{
  "query": {
    "geo_distance": {
      "distance": "5km",
      "location": {
        "lat": 39.933,
        "lon": 116.454
      }
    }
  }
}
```

### 2.6.3 geo_bounding_box 矩形范围

```json
{
  "query": {
    "geo_bounding_box": {
      "location": {
        "top_left": { "lat": 40.0, "lon": 116.0 },
        "bottom_right": { "lat": 39.0, "lon": 117.0 }
      }
    }
  }
}
```

### 2.6.4 geo_polygon 多边形范围

```json
{
  "query": {
    "geo_polygon": {
      "location": {
        "points": [
          { "lat": 40.0, "lon": 116.0 },
          { "lat": 39.0, "lon": 117.0 },
          { "lat": 39.5, "lon": 116.5 }
        ]
      }
    }
  }
}
```

### 2.6.5 按距离排序

```json
{
  "query": { "match_all": {} },
  "sort": [
    {
      "_geo_distance": {
        "location": { "lat": 39.933, "lon": 116.454 },
        "order": "asc",
        "unit": "km",
        "distance_type": "arc"
      }
    }
  ]
}
```

## 2.7 搜索参数与结果控制

### 2.7.1 分页（from + size）

```json
{
  "from": 0,            // 起始位置
  "size": 20,           // 每页大小
  "query": { ... }
}
```

> **深度分页限制**：`from + size` 不能超过 `max_result_window`（默认 10000）。深度分页用 `search_after` 或 `scroll`。

### 2.7.2 search_after 游标分页

适合大数据量深度分页：

```json
// 第一页
{
  "size": 100,
  "sort": [
    { "created_at": "desc" },
    { "_id": "asc" }               // 必须有唯一排序字段
  ]
}

// 后续页（使用上一页最后一条的 sort 值）
{
  "size": 100,
  "search_after": [1693980000000, "doc_id_123"],
  "sort": [
    { "created_at": "desc" },
    { "_id": "asc" }
  ]
}
```

### 2.7.3 scroll 滚动查询（大批量导出）

```json
// 创建 scroll 上下文
POST /products/_search?scroll=1m
{
  "size": 1000,
  "query": { "match_all": {} }
}
// 返回 _scroll_id

// 继续滚动
POST /_search/scroll
{
  "scroll": "1m",
  "scroll_id": "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAAAAD4..."
}

// 关闭 scroll
DELETE /_search/scroll
{
  "scroll_id": "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAAAAD4..."
}
```

> **注意**：scroll 不适合实时搜索，只适合批量导出。7.10+ 推荐用 `search_after` + PIT（Point in Time）。

### 2.7.4 排序

```json
{
  "sort": [
    { "price": { "order": "asc" } },
    { "created_at": { "order": "desc" } },
    { "_score": { "order": "desc" } }      // 按相关性分数
  ]
}

// 按字段值缺失时的处理
{
  "sort": [
    {
      "price": {
        "order": "asc",
        "missing": "_last"          // 缺失值排最后
      }
    }
  ]
}

// 按脚本排序
{
  "sort": [
    {
      "_script": {
        "type": "number",
        "script": {
          "source": "doc['price'].value * doc['discount'].value"
        },
        "order": "asc"
      }
    }
  ]
}
```

### 2.7.5 _source 过滤

```json
// 只返回指定字段
{
  "_source": ["name", "price", "brand"],
  "query": { "match_all": {} }
}

// 排除字段
{
  "_source": {
    "excludes": ["description"]
  }
}

// 通配符
{
  "_source": ["user.*", "product.name"]
}
```

### 2.7.6 高亮

```json
{
  "query": {
    "match": { "name": "MacBook Pro" }
  },
  "highlight": {
    "pre_tags": ["<em>"],
    "post_tags": ["</em>"],
    "fields": {
      "name": {},
      "description": {
        "fragment_size": 150,         // 片段长度
        "number_of_fragments": 3      // 最多 3 个片段
      }
    }
  }
}

// 响应中会有 highlight 字段
{
  "hits": {
    "hits": [{
      "_source": { "name": "MacBook Pro 16" },
      "highlight": {
        "name": ["<em>MacBook Pro</em> 16"]
      }
    }]
  }
}
```

### 2.7.7 explain 评分解释

```json
{
  "explain": true,
  "query": {
    "match": { "name": "MacBook Pro" }
  }
}
// 返回每个文档的详细评分过程
```

## 2.8 搜索模板

### 2.8.1 定义模板

```json
POST /_scripts/product_search
{
  "script": {
    "lang": "mustache",
    "source": {
      "query": {
        "bool": {
          "must": [
            { "match": { "name": "{{query_string}}" } }
          ],
          "filter": [
            {{#brand}}
            { "term": { "brand": "{{brand}}" } },
            {{/brand}}
            { "range": { "price": { "lte": {{max_price}} } } }
          ]
        }
      }
    }
  }
}
```

### 2.8.2 使用模板

```json
POST /products/_search/template
{
  "id": "product_search",
  "params": {
    "query_string": "MacBook",
    "brand": "Apple",
    "max_price": 20000
  }
}
```

## 2.9 Suggesters（搜索建议）

### 2.9.1 term suggester（拼写纠错）

```json
{
  "suggest": {
    "text": "MacBok Pro",
    "term_suggester": {
      "term": {
        "field": "name"
      }
    }
  }
}
```

### 2.9.2 phrase suggester（短语建议）

```json
{
  "suggest": {
    "text": "MacBok Pro",
    "phrase_suggester": {
      "phrase": {
        "field": "name.trigram",
        "gram_size": 3,
        "direct_generator": [{
          "field": "name.trigram",
          "suggest_mode": "always"
        }]
      }
    }
  }
}
```

### 2.9.3 completion suggester（自动补全）

需要 `completion` 类型字段：

```json
// Mapping
{
  "properties": {
    "suggest": {
      "type": "completion"
    }
  }
}

// 写入
PUT /products/_doc/1
{
  "name": "MacBook Pro",
  "suggest": {
    "input": ["MacBook", "MacBook Pro", "Apple Laptop"],
    "weight": 10
  }
}

// 查询
POST /products/_search
{
  "suggest": {
    "product_suggest": {
      "prefix": "Mac",
      "completion": {
        "field": "suggest",
        "fuzzy": { "fuzziness": 2 }
      }
    }
  }
}
```

## 2.10 常见查询问题与最佳实践

1. **精确匹配用 `term` + `keyword`**，不要用 `term` + `text`
2. **过滤条件放 `filter`**：有缓存，性能更好
3. **避免深度分页**：用 `search_after` 代替 `from + size`
4. **批量写入用 `_bulk`**：单条写入慢几个数量级
5. **避免 `wildcard` 和 `regexp`**：尤其是前缀通配符
6. **中文搜索用 IK 分词器**：`ik_max_word` 写入、`ik_smart` 搜索
7. **nested 对象用 `nested` 查询**：普通对象查询会丢失边界
8. **分页默认 size 不要太大**：10-100 为宜，超过会慢
9. **高亮只对需要展示的字段开启**：减少开销
10. **生产环境用搜索模板**：避免客户端拼 JSON

---

## 本章小结

- Query DSL 是 ES 的 JSON 查询语言，结构为 (&#123; "query": &#123; ... &#125; &#125;)
- **Query Context** 计算相关性分数，**Filter Context** 不计算但有缓存
- `match` 是全文搜索的核心，`term` 是精确匹配的核心
- `bool` 查询可组合 `must`/`should`/`must_not`/`filter`
- `nested` 查询用于嵌套对象数组，保留对象边界
- 地理查询：`geo_distance`、`geo_bounding_box`、`geo_polygon`
- 分页：`from + size`（<10000）、`search_after`（深度分页）、`scroll`（批量导出）
- 高亮、排序、`_source` 过滤是搜索体验的关键
- Suggesters 用于拼写纠错和自动补全
