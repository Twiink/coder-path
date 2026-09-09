---
title: "Elasticsearch聚合分析"
aliases:
  - "ES聚合"
  - "Elasticsearch Aggregations"
tags:
  - "后端"
  - "搜索引擎"
  - "elasticsearch"
  - "聚合"
  - "数据分析"
  - "笔记"
category: "后端"
folder: "Elasticsearch"
parent: "[[目录]]"
related:
  - "[[后端/数据库/Elasticsearch/Elasticsearch查询DSL]]"
  - "[[后端/数据库/Elasticsearch/Elasticsearch映射与数据建模]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 03 Elasticsearch 聚合分析（Aggregations）

ES 的聚合框架（Aggregation Framework）提供了强大的实时数据分析能力，可对海量数据进行分组、统计、指标计算，类似于 SQL 的 `GROUP BY` + 各种聚合函数，但更强大、更灵活。

## 3.1 聚合的基本结构

```json
GET /products/_search
{
  "size": 0,                          // 不返回文档，只返回聚合结果
  "query": {
    "range": { "price": { "gte": 1000 } }   // 先过滤
  },
  "aggs": {
    "brands": {                        // 聚合名称（自定义）
      "terms": {                       // 聚合类型
        "field": "brand",
        "size": 10
      }
    }
  }
}
```

聚合的三要素：
- **aggs**（或 aggregations）：聚合定义块
- **聚合名称**：自定义，用于响应中标识
- **聚合类型**：`terms`、`avg`、`sum` 等

## 3.2 三大聚合类型

| 类型 | 说明 | 例子 |
| --- | --- | --- |
| **Metric 聚合** | 计算数值指标 | `avg`、`sum`、`min`、`max`、`stats`、`cardinality` |
| **Bucket 聚合** | 把文档分组到"桶"中 | `terms`、`range`、`date_histogram`、`filters` |
| **Pipeline 聚合** | 对其他聚合的结果再聚合 | `derivative`、`moving_avg`、`bucket_sort` |

## 3.3 Metric 聚合（指标聚合）

### 3.3.1 单值指标

```json
// avg（平均）
{ "aggs": { "avg_price": { "avg": { "field": "price" } } } }

// sum（求和）
{ "aggs": { "total_sales": { "sum": { "field": "sales" } } } }

// min / max
{ "aggs": { "min_price": { "min": { "field": "price" } } } }
{ "aggs": { "max_price": { "max": { "field": "price" } } } }

// value_count（计数，含重复）
{ "aggs": { "count": { "value_count": { "field": "price" } } } }
```

### 3.3.2 stats 与 extended_stats

```json
// stats：一次返回 count、min、max、avg、sum
{ "aggs": { "price_stats": { "stats": { "field": "price" } } } }

// extended_stats：额外返回平方和、方差、标准差
{ "aggs": { "price_ext": { "extended_stats": { "field": "price" } } } }
```

响应：
```json
{
  "price_stats": {
    "count": 100,
    "min": 999,
    "max": 19999,
    "avg": 8500.5,
    "sum": 850050
  }
}
```

### 3.3.3 cardinality（去重计数）

基于 HyperLogLog++ 算法，近似但高效：

```json
{
  "aggs": {
    "unique_brands": {
      "cardinality": {
        "field": "brand",
        "precision_threshold": 100   // 精度阈值（越大越准，越费内存）
      }
    }
  }
}
```

> `precision_threshold`：100-40000，默认 3000。对大规模数据误差 <5%。

### 3.3.4 percentiles（百分位数）

```json
{
  "aggs": {
    "price_percentiles": {
      "percentiles": {
        "field": "price",
        "percents": [25, 50, 75, 90, 95, 99]
      }
    }
  }
}
```

响应：
```json
{
  "price_percentiles": {
    "values": {
      "25.0": 3999,
      "50.0": 6999,
      "75.0": 12999,
      "90.0": 18999,
      "95.0": 22999,
      "99.0": 35999
    }
  }
}
```

### 3.3.5 top_hits（分组内 Top N）

```json
{
  "size": 0,
  "aggs": {
    "by_brand": {
      "terms": { "field": "brand", "size": 5 },
      "aggs": {
        "top_products": {
          "top_hits": {
            "sort": [{ "price": { "order": "desc" } }],
            "_source": ["name", "price"],
            "size": 3                    // 每组取 Top 3
          }
        }
      }
    }
  }
}
// 每个品牌最贵的 3 件产品
```

## 3.4 Bucket 聚合（桶聚合）

### 3.4.1 terms 聚合（按字段分组）

最常用的聚合，类似 SQL 的 `GROUP BY`：

```json
{
  "aggs": {
    "by_brand": {
      "terms": {
        "field": "brand",
        "size": 10,                  // 返回前 10 个桶
        "order": { "_count": "desc" },   // 按文档数降序
        "min_doc_count": 1           // 至少 1 个文档才显示
      }
    }
  }
}
```

响应：
```json
{
  "by_brand": {
    "buckets": [
      { "key": "Apple", "doc_count": 50 },
      { "key": "Google", "doc_count": 30 },
      { "key": "Xiaomi", "doc_count": 25 }
    ]
  }
}
```

**排序方式**：
- `_count`：按文档数
- `_key`：按 key 值
- 自定义指标：(&#123; "avg_price": "desc" &#125;)

### 3.4.2 range 聚合（按数值区间分组）

```json
{
  "aggs": {
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "key": "cheap", "to": 5000 },
          { "key": "mid", "from": 5000, "to": 15000 },
          { "key": "expensive", "from": 15000 }
        ]
      }
    }
  }
}
```

### 3.4.3 date_range 聚合（按日期范围分组）

```json
{
  "aggs": {
    "date_ranges": {
      "date_range": {
        "field": "created_at",
        "format": "yyyy-MM-dd",
        "ranges": [
          { "key": "last_month", "from": "now-1M/M", "to": "now/M" },
          { "key": "this_month", "from": "now/M" }
        ]
      }
    }
  }
}
```

### 3.4.4 histogram 聚合（按固定间隔分桶）

```json
{
  "aggs": {
    "price_histogram": {
      "histogram": {
        "field": "price",
        "interval": 1000,               // 每 1000 一个桶
        "min_doc_count": 1,
        "extended_bounds": {
          "min": 0,
          "max": 30000                  // 强制显示空桶
        }
      }
    }
  }
}
```

### 3.4.5 date_histogram 聚合（按时间间隔分桶）⭐

日志分析、时序数据最常用的聚合：

```json
{
  "aggs": {
    "sales_over_time": {
      "date_histogram": {
        "field": "created_at",
        "calendar_interval": "month",   // 或 year, quarter, week, day, hour, minute
        "format": "yyyy-MM",
        "min_doc_count": 0,
        "extended_bounds": {
          "min": "2026-01",
          "max": "2026-12"
        }
      }
    }
  }
}
```

**calendar_interval vs fixed_interval**：

| 类型 | 含义 | 例子 |
| --- | --- | --- |
| `calendar_interval` | 按日历单位 | `month`（不同月份天数不同） |
| `fixed_interval` | 固定时间间隔 | `30d`、`6h`、`15m` |

```json
// fixed_interval 示例
{
  "date_histogram": {
    "field": "timestamp",
    "fixed_interval": "6h",        // 每 6 小时
    "time_zone": "+08:00"
  }
}
```

### 3.4.6 filters 聚合（多条件分组）

```json
{
  "aggs": {
    "status_groups": {
      "filters": {
        "filters": {
          "in_stock": { "term": { "stock_status": "in_stock" } },
          "out_of_stock": { "term": { "stock_status": "out_of_stock" } },
          "pre_order": { "term": { "stock_status": "pre_order" } }
        }
      }
    }
  }
}
```

### 3.4.7 nested 聚合（嵌套对象聚合）

```json
{
  "aggs": {
    "comments": {
      "nested": {
        "path": "comments"
      },
      "aggs": {
        "avg_rating": {
          "avg": { "field": "comments.rating" }
        }
      }
    }
  }
}
```

## 3.5 嵌套聚合（多层聚合）

聚合可以嵌套，实现"先分组再统计"：

```json
{
  "size": 0,
  "aggs": {
    "by_brand": {
      "terms": { "field": "brand", "size": 10 },
      "aggs": {
        "avg_price": {
          "avg": { "field": "price" }
        },
        "by_category": {
          "terms": { "field": "category", "size": 5 },
          "aggs": {
            "total_sales": {
              "sum": { "field": "sales" }
            }
          }
        }
      }
    }
  }
}
```

等价 SQL：
```sql
SELECT brand, category, AVG(price), SUM(sales)
FROM products
GROUP BY brand, category
```

## 3.6 Pipeline 聚合（对聚合结果再聚合）

### 3.6.1 Sibling 聚合（兄弟聚合）

```json
{
  "aggs": {
    "by_brand": {
      "terms": { "field": "brand" },
      "aggs": {
        "avg_price": { "avg": { "field": "price" } }
      }
    },
    "avg_of_avgs": {
      "avg_bucket": {
        "buckets_path": "by_brand>avg_price"
      }
    }
  }
}
```

常用 Sibling 聚合：
- `avg_bucket`：桶平均值
- `sum_bucket`：桶总和
- `min_bucket` / `max_bucket`
- `stats_bucket`

### 3.6.2 Parent 聚合（父子聚合）

```json
{
  "aggs": {
    "sales_over_time": {
      "date_histogram": {
        "field": "created_at",
        "calendar_interval": "month"
      },
      "aggs": {
        "total_sales": { "sum": { "field": "sales" } },
        "cumulative_sales": {
          "cumulative_sum": {
            "buckets_path": "total_sales"
          }
        },
        "sales_derivative": {
          "derivative": {
            "buckets_path": "total_sales"
          }
        },
        "moving_avg": {
          "moving_avg": {
            "buckets_path": "total_sales",
            "window": 3
          }
        }
      }
    }
  }
}
```

### 3.6.3 bucket_sort（对桶排序与分页）

```json
{
  "aggs": {
    "by_brand": {
      "terms": { "field": "brand", "size": 100 },
      "aggs": {
        "total_sales": { "sum": { "field": "sales" } },
        "sales_sort": {
          "bucket_sort": {
            "sort": [{ "total_sales": { "order": "desc" } }],
            "size": 10,
            "from": 0
          }
        }
      }
    }
  }
}
```

### 3.6.4 bucket_selector（过滤桶）

```json
{
  "aggs": {
    "by_brand": {
      "terms": { "field": "brand", "size": 100 },
      "aggs": {
        "total_sales": { "sum": { "field": "sales" } },
        "filter_by_sales": {
          "bucket_selector": {
            "buckets_path": { "total": "total_sales" },
            "script": "params.total > 100000"
          }
        }
      }
    }
  }
}
// 只保留总销售额 > 100000 的品牌
```

## 3.7 聚合的性能优化

### 3.7.1 全局序数（Global Ordinals）

对于 `keyword` 字段，ES 会建立全局序数表（Global Ordinals），加速 terms 聚合：

```json
{
  "mappings": {
    "properties": {
      "brand": {
        "type": "keyword",
        "eager_global_ordinals": true   // 预加载，refresh 时构建
      }
    }
  }
}
```

### 3.7.2 聚合缓存

Filter Context 的查询会被缓存，提升聚合性能：

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "active" } },   // 缓存
        { "range": { "created_at": { "gte": "now-30d" } } }
      ]
    }
  },
  "aggs": { ... }
}
```

### 3.7.3 减少分片扫描

```json
{
  "query": {
    "terms": { "_id": ["1", "2", "3"] }   // 只查指定文档
  },
  "aggs": { ... },
  "preference": "_shards:0,1"             // 只查指定分片
}
```

### 3.7.4 聚合性能优化清单

1. **聚合字段用 `keyword` 而非 `text`**
2. **启用 `eager_global_ordinals`** 对高频聚合字段
3. **用 `filter` 代替 `must`**（利用缓存）
4. **`cardinality` 调整 `precision_threshold`**
5. **避免深度嵌套聚合**（>3 层性能急剧下降）
6. **`terms` 聚合设置合理的 `size`**
7. **对大索引用 `filter` 缩小范围**
8. **聚合请求加 `"size": 0`**（不返回文档）

## 3.8 复合查询示例

### 3.8.1 电商数据分析

```json
// 过去 30 天各品牌销售排行
{
  "size": 0,
  "query": {
    "range": {
      "created_at": { "gte": "now-30d" }
    }
  },
  "aggs": {
    "by_brand": {
      "terms": {
        "field": "brand",
        "size": 20,
        "order": { "total_sales": "desc" }
      },
      "aggs": {
        "total_sales": { "sum": { "field": "sales" } },
        "avg_price": { "avg": { "field": "price" } },
        "unique_customers": {
          "cardinality": { "field": "customer_id" }
        }
      }
    },
    "daily_sales": {
      "date_histogram": {
        "field": "created_at",
        "calendar_interval": "day",
        "format": "yyyy-MM-dd"
      },
      "aggs": {
        "daily_total": { "sum": { "field": "sales" } }
      }
    }
  }
}
```

### 3.8.2 日志分析

```json
// 过去 24 小时每小时的错误分布
{
  "size": 0,
  "query": {
    "bool": {
      "must": [
        { "term": { "level": "ERROR" } },
        { "range": { "@timestamp": { "gte": "now-24h" } } }
      ]
    }
  },
  "aggs": {
    "hourly_errors": {
      "date_histogram": {
        "field": "@timestamp",
        "fixed_interval": "1h"
      },
      "aggs": {
        "by_service": {
          "terms": { "field": "service", "size": 10 }
        },
        "by_exception": {
          "terms": { "field": "exception_type", "size": 5 }
        }
      }
    }
  }
}
```

### 3.8.3 Facet 搜索（电商过滤面板）

```json
// 搜索结果 + 侧边栏过滤选项
{
  "query": {
    "bool": {
      "must": [{ "match": { "name": "laptop" } }],
      "filter": [
        { "term": { "brand": "Apple" } },
        { "range": { "price": { "lte": 20000 } } }
      ]
    }
  },
  "aggs": {
    "brands": {
      "terms": { "field": "brand", "size": 20 }
    },
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "key": "0-5000", "to": 5000 },
          { "key": "5000-10000", "from": 5000, "to": 10000 },
          { "key": "10000-20000", "from": 10000, "to": 20000 },
          { "key": "20000+", "from": 20000 }
        ]
      }
    },
    "categories": {
      "terms": { "field": "category", "size": 20 }
    }
  }
}
```

---

## 本章小结

- ES 聚合分三大类：**Metric**（指标）、**Bucket**（分桶）、**Pipeline**（管道）
- Metric 聚合：`avg`/`sum`/`min`/`max`/`stats`/`cardinality`/`percentiles`/`top_hits`
- Bucket 聚合：`terms`（分组）、`range`（区间）、`histogram`/`date_histogram`（时序）、`filters`（多条件）
- 嵌套聚合实现"先分组再统计"，类似 SQL 的多列 GROUP BY
- Pipeline 聚合对聚合结果再做计算（累计、导数、移动平均、排序、过滤）
- 性能优化：聚合字段用 `keyword`、启用 `eager_global_ordinals`、用 `filter`、控制 `size`
- 聚合请求加 `"size": 0` 避免返回文档
- 复合示例：电商销售分析、日志错误分析、Facet 搜索
