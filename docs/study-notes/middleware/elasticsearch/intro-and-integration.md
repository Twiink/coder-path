---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - Elasticsearch
  - 搜索引擎
  - SpringData
---

# Elasticsearch入门与整合

> **核心定位**：Elasticsearch（ES）是分布式全文搜索引擎，用于日志分析、商品搜索、指标监控等场景。

## 1. Elasticsearch 核心概念

```
┌─────────────────────────────────────────────┐
│ ES 核心概念 vs 关系数据库                     │
├─────────────────────────────────────────────┤
│ Index（索引）     ≈ Database（数据库）        │
│ Mapping（映射）   ≈ Schema（表结构）          │
│ Document（文档）  ≈ Row（行）                 │
│ Field（字段）     ≈ Column（列）              │
│ Shard（分片）     ≈ Partition（分区）        │
│ Replica（副本）   ≈ Slave（从库）             │
└─────────────────────────────────────────────┘
```

### 1.1 倒排索引

```
正排索引（传统数据库）：
  文档ID → 文档内容
  1 → "Java编程思想"
  2 → "Java并发实战"
  3 → "Python入门"

倒排索引（ES）：
  词项 → 文档ID列表
  "Java"   → [1, 2]
  "编程"   → [1]
  "并发"   → [2]
  "实战"   → [2]
  "Python" → [3]
  "入门"   → [3]

搜索 "Java并发"：
  1. 分词 → ["Java", "并发"]
  2. 查倒排索引 → "Java"→[1,2], "并发"→[2]
  3. 交集 → [2]
  4. 返回文档 2
```

### 1.2 分词器

```
┌─────────────────────────────────────────────┐
│ ES 分词器（Analyzer）                        │
├─────────────────────────────────────────────┤
│ standard（默认）：                           │
│   - 按 Unicode 分词                          │
│   - 中文逐字分词（效果差）                    │
│   "Java编程" → ["Java", "编", "程"]          │
│                                              │
│ ik_smart（中文推荐）：                        │
│   - 智能中文分词                             │
│   "Java编程思想" → ["Java", "编程", "思想"]   │
│                                              │
│ ik_max_word（最细粒度）：                     │
│   "Java编程思想" → ["Java", "编程", "思想",  │
│                    "编", "程", "思", "想"]    │
│                                              │
│ ★ 建议：索引用 ik_max_word，搜索用 ik_smart  │
└─────────────────────────────────────────────┘
```

## 2. Spring Boot 整合 ES

### 2.1 依赖与配置

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-elasticsearch</artifactId>
</dependency>
```

```yaml
spring:
  elasticsearch:
    uris: http://localhost:9200
    username: elastic
    password: your_password
    connection-timeout: 5s
    socket-timeout: 30s
```

### 2.2 实体与 Mapping

```java
@Document(indexName = "product", createIndex = true)
@Setting(shards = 3, replicas = 1)
public class Product {
    
    @Id
    @Field(type = FieldType.Long)
    private Long id;
    
    @Field(type = FieldType.Text, analyzer = "ik_max_word", searchAnalyzer = "ik_smart")
    private String name;
    
    @Field(type = FieldType.Keyword)
    private String brand;
    
    @Field(type = FieldType.Double)
    private BigDecimal price;
    
    @Field(type = FieldType.Integer)
    private Integer stock;
    
    @Field(type = FieldType.Keyword)
    private String category;
    
    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String description;
    
    @Field(type = FieldType.Date, format = DateFormat.date_hour_minute_second)
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;
    
    @Field(type = FieldType.Boolean)
    private Boolean onSale;
    
    @Field(type = FieldType.Nested)
    private List<ProductAttr> attributes;
    
    // getter/setter...
}

@Data
public class ProductAttr {
    @Field(type = FieldType.Keyword)
    private String name;
    
    @Field(type = FieldType.Keyword)
    private String value;
}
```

### 2.3 Repository 接口

```java
public interface ProductRepository extends ElasticsearchRepository<Product, Long> {
    
    // 方法名查询
    List<Product> findByName(String name);
    List<Product> findByBrandAndCategory(String brand, String category);
    Page<Product> findByPriceBetween(BigDecimal min, BigDecimal max, Pageable pageable);
    List<Product> findByOnSaleTrueOrderByPriceAsc(Boolean onSale);
    
    // @Query 自定义查询
    @Query("{\"bool\": {\"must\": [{\"match\": {\"name\": \"?0\"}}]}}")
    Page<Product> searchByName(String keyword, Pageable pageable);
}
```

## 3. DSL 查询实战

```java
@Service
public class ProductSearchService {
    
    @Autowired
    private ElasticsearchOperations esOperations;
    
    @Autowired
    private ProductRepository productRepository;
    
    /**
     * ★ 复杂搜索：关键词 + 分类 + 价格范围 + 排序 + 分页
     */
    public SearchHits<Product> search(ProductSearchQuery query) {
        NativeQueryBuilder builder = NativeQuery.builder();
        
        // 1. bool 查询
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
        
        // 关键词搜索（在 name 和 description 中搜索）
        if (StringUtils.hasText(query.getKeyword())) {
            boolQuery.must(QueryBuilders.multiMatchQuery(query.getKeyword())
                .field("name", 3.0f)        // name 权重更高
                .field("description", 1.0f)
                .type(MultiMatchQueryBuilder.Type.BEST_FIELDS));
        }
        
        // 精确匹配
        if (query.getBrand() != null) {
            boolQuery.filter(QueryBuilders.termQuery("brand", query.getBrand()));
        }
        if (query.getCategory() != null) {
            boolQuery.filter(QueryBuilders.termQuery("category", query.getCategory()));
        }
        
        // 价格范围
        if (query.getMinPrice() != null || query.getMaxPrice() != null) {
            RangeQueryBuilder rangeQuery = QueryBuilders.rangeQuery("price");
            if (query.getMinPrice() != null) rangeQuery.gte(query.getMinPrice().doubleValue());
            if (query.getMaxPrice() != null) rangeQuery.lte(query.getMaxPrice().doubleValue());
            boolQuery.filter(rangeQuery);
        }
        
        // 上架状态
        boolQuery.filter(QueryBuilders.termQuery("onSale", true));
        
        builder.withQuery(boolQuery);
        
        // 2. 排序
        if ("priceAsc".equals(query.getSort())) {
            builder.withSort(Sort.by(Sort.Direction.ASC, "price"));
        } else if ("priceDesc".equals(query.getSort())) {
            builder.withSort(Sort.by(Sort.Direction.DESC, "price"));
        } else {
            // 默认按相关度排序
            builder.withSort(Sort.by(ScoreSortBuilder.NAME));
        }
        
        // 3. 分页
        builder.withPageable(PageRequest.of(query.getPage() - 1, query.getSize()));
        
        // 4. 高亮
        if (StringUtils.hasText(query.getKeyword())) {
            builder.withHighlightQuery(new HighlightQuery(
                Highlight.builder()
                    .field("name")
                    .field("description")
                    .preTags("<em style='color:red'>")
                    .postTags("</em>")
                    .fragmentSize(100)
                    .numberOfFragments(1)
                    .build(),
                Product.class));
        }
        
        // 5. 聚合（分类统计）
        builder.withAggregation("category_agg",
            Aggregation.of(a -> a.terms(t -> t.field("category").size(10))));
        builder.withAggregation("brand_agg",
            Aggregation.of(a -> a.terms(t -> t.field("brand").size(20))));
        builder.withAggregation("price_stats",
            Aggregation.of(a -> a.stats(s -> s.field("price"))));
        
        return esOperations.search(builder.build(), Product.class);
    }
    
    /**
     * 自动补全（搜索建议）
     */
    public List<String> suggest(String prefix) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.matchQuery("name", prefix))
            .withSuggester(Suggester.of(s -> s
                .suggest("name_suggest", sg -> sg
                    .prefix(prefix)
                    .completion(c -> c
                        .field("name_suggest")
                        .size(10)
                        .skipDuplicates(true)))))
            .build();
        
        SearchHits<Product> hits = esOperations.search(query, Product.class);
        return hits.getSuggest().getSuggestion("name_suggest")
            .getEntries().stream()
            .flatMap(e -> e.getOptions().stream())
            .map(o -> o.getText())
            .collect(Collectors.toList());
    }
}
```

## 4. 与 MySQL 数据同步

```
┌─────────────────────────────────────────────┐
│ ES 与 MySQL 同步方案                          │
├─────────────────────────────────────────────┤
│ 1. 同步双写（最简单）                         │
│    - 写 MySQL 后同步写 ES                    │
│    - 缺点：耦合、性能影响                     │
│                                              │
│ 2. ★ 异步同步（MQ）                          │
│    - 写 MySQL 后发 MQ 消息                    │
│    - 消费者异步写 ES                          │
│    - 优点：解耦、高性能                       │
│                                              │
│ 3. ★ Binlog 订阅（推荐）                     │
│    - Canal 监听 MySQL binlog                  │
│    - 自动同步到 ES                            │
│    - 优点：零侵入                             │
│                                              │
│ 4. 定时全量同步                              │
│    - 定时任务全量拉取 MySQL 写 ES            │
│    - 适合数据量小的场景                       │
└─────────────────────────────────────────────┘
```

```java
// 异步同步方案
@Service
public class ProductSyncService {
    
    @Autowired
    private ProductMapper productMapper;
    
    @Autowired
    private ProductRepository productRepository;
    
    @Autowired
    private RocketMQTemplate rocketMQTemplate;
    
    /**
     * 商品更新后异步同步到 ES
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onProductUpdated(ProductUpdatedEvent event) {
        Product product = productMapper.selectById(event.getProductId());
        productRepository.save(product);
    }
    
    /**
     * 批量同步（初始化或重建索引）
     */
    public void bulkSync() {
        int page = 1;
        int size = 1000;
        while (true) {
            List<Product> products = productMapper.selectPage(page, size);
            if (products.isEmpty()) break;
            
            List<IndexQuery> queries = products.stream()
                .map(p -> new IndexQueryBuilder()
                    .withId(String.valueOf(p.getId()))
                    .withObject(p)
                    .build())
                .collect(Collectors.toList());
            
            productRepository.saveAll(products);
            // 或批量索引
            esOperations.bulkIndex(queries, Product.class);
            
            if (products.size() < size) break;
            page++;
        }
    }
}
```

## 5. 常见问题

```
┌─────────────────────────────────────────────┐
│ ES 常见问题                                   │
├─────────────────────────────────────────────┤
│ 1. 深分页问题                                │
│    - from + size 超过 10000 会报错           │
│    - ★ 使用 search_after 或 scroll API      │
│                                              │
│ 2. 字段类型选择                              │
│    - Keyword：精确匹配、聚合、排序           │
│    - Text：全文搜索、分词                    │
│    - ★ 不要用 Text 做精确匹配                │
│                                              │
│ 3. 映射不可变                                │
│    - 字段类型一旦创建不可修改                │
│    - 修改需要 reindex（重建索引）            │
│                                              │
│ 4. 中文分词                                  │
│    - ★ 安装 IK 分词器插件                    │
│    - 索引用 ik_max_word，搜索用 ik_smart     │
│                                              │
│ 5. 内存设置                                  │
│    - JVM 堆内存 = 物理内存的 50%             │
│    - 不要超过 32GB（指针压缩失效）           │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/数据库/MySQL/索引与执行计划]]：MySQL 索引原理
- [[后端/SpringBoot/整合数据访问层]]：Spring Boot 数据访问
- [[后端/消息队列/RocketMQ]]：MQ 异步同步方案
