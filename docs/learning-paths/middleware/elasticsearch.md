# Elasticsearch 学习路线

Elasticsearch 是分布式搜索和分析引擎的王者，从全文搜索到日志分析，从推荐系统到监控告警，它无处不在。基于 Lucene，却比 Lucene 更易用、更强大、更可扩展。这条路线会带你从倒排索引的原理到分布式架构的精髓，从简单查询到复杂聚合，从单节点到大规模集群。

## 基础篇：核心概念与架构

> 📖 篇笔记：[Elasticsearch 入门与整合](/study-notes/middleware/elasticsearch/intro-and-integration)

### Elasticsearch 的核心概念
- Index（索引）：类似数据库的"数据库"（但不完全等同）
- Type（类型）：7.x 废弃，8.x 彻底移除
- Document（文档）：一条数据记录，JSON 格式
- Field（字段）：文档的属性
- Mapping（映射）：定义文档结构和字段类型（类似 schema）
- Shard（分片）：索引的水平切分，提高并行度
- Replica（副本）：分片的备份，提高可用性和查询吞吐
- 📖 笔记：[入门与核心概念](/study-notes/middleware/elasticsearch/intro-core-concepts)

### 倒排索引（Inverted Index）
- 正向索引：文档 → 词条（传统数据库）
- 倒排索引：词条 → 文档列表（搜索引擎核心）
- Term Dictionary：词条字典，所有词条的有序集合
- Posting List：倒排列表，包含词条的文档 ID 列表
- Term Index：词条索引前缀树（FST），加速词条查找
- 压缩技术：Frame Of Reference、RBM（Roaring Bitmap）

### 分布式架构
- 集群（Cluster）：多个节点组成的集群
- 节点（Node）：集群中的单个 ES 实例
- 节点角色：Master、Data、Ingest、Coordinating、ML
- 主分片（Primary Shard）：数据的主副本
- 副本分片（Replica Shard）：主分片的备份
- 分片分配：自动分配到各节点，保证负载均衡

### 文档的路由
- 路由计算：shard = hash(routing) % number_of_primary_shards
- 默认路由：routing = _id
- 自定义路由：routing 参数指定（相同路由的文档在同一分片）
- 分片数固定：创建索引后主分片数不可变（7.0+ 可通过 split/shrink API 调整）

### 读写流程
- 写入流程：协调节点 → 路由到主分片 → 写入主分片 → 同步到副本分片 → 返回结果
- 读取流程：协调节点 → 轮询查询主分片或副本 → 合并结果 → 返回
- 搜索流程：Query Phase（查询阶段）+ Fetch Phase（获取阶段）

## 倒排索引深入篇

### 分词（Analysis）
- Analyzer：分析器 = Tokenizer + Token Filter
- Tokenizer：分词器，将文本切分为词条（Standard、Whitespace、Keyword）
- Token Filter：词条过滤器，处理词条（lowercase、stop、synonym）
- Character Filter：字符过滤器，预处理文本（html_strip、mapping）
- 内置分析器：Standard、Simple、Whitespace、Stop、Keyword、Pattern
- 中文分词：IK（ik_smart、ik_max_word）、HanLP、Jieba

### 词条处理
- 大小写转换：lowercase filter
- 停用词：stop filter 去除 the、is、a 等
- 同义词：synonym filter 扩展查询
- 词干提取：stemmer filter（running → run）
- 词形还原：lemmatizer（better → good）
- N-gram：生成子串，支持部分匹配

### Term Dictionary 与 Term Index
- FST（Finite State Transducer）：前缀树的压缩版，节省内存
- 内存占用：Term Index 全部在内存，Term Dictionary 在磁盘
- 查找过程：Term Index（内存）→ Term Dictionary（磁盘）→ Posting List（磁盘）
- 前缀查询优化：FST 天然支持前缀匹配

### Posting List 压缩
- Frame Of Reference：增量编码 + 分块压缩
- Roaring Bitmap：稀疏位图压缩
- Skip List：跳表加速合并多个 Posting List
- 压缩比：平均 10:1 以上

### Segment 机制
- Segment：不可变的倒排索引文件
- 写入过程：文档 → 内存 Buffer → Segment → 刷盘
- Refresh：Buffer → Segment（内存 Segment，默认 1 秒）
- Flush：Segment → 磁盘（Translog 清空）
- Merge：合并小 Segment 为大 Segment
- 删除与更新：标记删除，Merge 时物理删除

### Translog（事务日志）
- 作用：保证数据不丢失（类似 MySQL 的 redo log）
- 写入流程：文档 → 内存 Buffer + Translog
- 持久化：每次写入默认 fsync（可配置为异步）
- 恢复：节点重启时从 Translog 恢复未 flush 的数据
- 清空：Flush 后 Translog 清空

## Mapping 与数据类型篇

### 核心数据类型
- Text：全文搜索，会分词
- Keyword：精确匹配，不分词（用于过滤、排序、聚合）
- Numeric：long、integer、short、byte、double、float、half_float、scaled_float
- Date：日期类型，支持多种格式
- Boolean：true/false
- Binary：Base64 编码的二进制数据

### 复杂数据类型
- Object：嵌套对象（扁平化存储，无法独立查询）
- Nested：嵌套文档（独立存储，支持独立查询）
- Array：数组（所有类型都隐式支持数组）
- Join：父子关系（parent/child）

### 特殊数据类型
- Geo Point：地理位置点（经纬度）
- Geo Shape：地理形状（多边形、圆形等）
- IP：IP 地址，支持 CIDR 查询
- Range：范围类型（integer_range、date_range）
- Completion：自动补全
- Token Count：词条计数

### Mapping 参数
- index：是否索引（默认 true）
- store：是否单独存储（默认 false，从 _source 获取）
- analyzer：索引时使用的分析器
- search_analyzer：搜索时使用的分析器
- fields：多字段（同一字段多种索引方式）
- ignore_above：Keyword 字段的长度限制
- null_value：NULL 值替换

### Dynamic Mapping
- 动态映射：自动推断字段类型
- 类型推断：字符串 → text + keyword、数字 → long、日期 → date
- dynamic 参数：true（自动添加）、false（忽略）、strict（报错）
- 日期检测：date_detection（默认开启）
- 数字检测：numeric_detection（默认关闭）

### Mapping 最佳实践
- 显式定义：生产环境避免依赖动态映射
- 合理分词：搜索字段用 text，过滤字段用 keyword
- 多字段：text + keyword 双字段满足不同需求
- 禁用不需要的功能：不搜索的字段 index=false
- 避免字段爆炸：字段数量不要过多（建议 < 1000）
- 📖 笔记：[索引设计与 Mapping](/study-notes/middleware/elasticsearch/index-design-mapping)

## 查询 DSL 篇

> 📖 篇笔记：[查询 DSL 详解](/study-notes/middleware/elasticsearch/query-dsl)

### Full Text Queries（全文查询）
- match：标准全文查询，会分词
- match_phrase：短语查询，词条顺序必须一致
- match_phrase_prefix：短语前缀查询（自动补全）
- multi_match：多字段查询
- query_string：支持查询语法（AND、OR、NOT）
- simple_query_string：简化版 query_string

### Term Level Queries（精确查询）
- term：精确匹配，不分词
- terms：多个精确值匹配
- range：范围查询（gt、gte、lt、lte）
- exists：字段存在性查询
- prefix：前缀查询
- wildcard：通配符查询（? 单字符，* 多字符）
- regexp：正则表达式查询
- fuzzy：模糊查询（容忍拼写错误，Levenshtein 距离）

### Compound Queries（复合查询）
- bool：布尔查询（must、should、must_not、filter）
- boosting：降低相关度
- constant_score：固定分数查询
- dis_max：最佳匹配查询
- function_score：自定义评分

### Bool 查询详解
- must：必须匹配，参与评分
- filter：必须匹配，不参与评分（可缓存）
- should：可以匹配，影响评分
- must_not：必须不匹配，不参与评分
- minimum_should_match：should 最少匹配数量

### 评分机制
- TF-IDF：词频-逆文档频率（ES 5.x 之前）
- BM25：ES 5.x+ 默认算法，改进的 TF-IDF
- TF：词条频率，出现越多分数越高（有上限）
- IDF：逆文档频率，越罕见的词权重越高
- Field Length Norm：字段越短，权重越高
- Boosting：手动调整字段权重（field^2）

### 查询优化
- filter 优先：不需要评分时用 filter（可缓存）
- 减少查询范围：尽早过滤数据
- 避免通配符开头：*abc 无法使用索引
- 避免深度分页：使用 search_after 替代 from/size
- 使用 _source 过滤：只返回需要的字段

## 聚合篇（Aggregation）

> 📖 篇笔记：[聚合分析](/study-notes/middleware/elasticsearch/aggregations)

### Bucket Aggregation（桶聚合）
- terms：按字段值分组（类似 SQL 的 GROUP BY）
- range：范围分桶
- date_range：日期范围分桶
- histogram：直方图分桶（数值）
- date_histogram：时间直方图（时间序列分析）
- filters：自定义多个过滤器分桶
- nested：嵌套文档聚合
- children：子文档聚合

### Metric Aggregation（指标聚合）
- avg、sum、min、max：基础统计
- stats：一次性返回 count、avg、sum、min、max
- extended_stats：扩展统计（方差、标准差）
- percentiles：百分位数（P50、P90、P99）
- cardinality：基数统计（去重计数，HyperLogLog 算法）
- value_count：计数
- top_hits：每个桶的 Top N 文档

### Pipeline Aggregation（管道聚合）
- bucket_sort：对桶排序
- cumulative_sum：累计求和
- derivative：导数（变化率）
- moving_avg：移动平均
- serial_diff：差分

### 聚合性能优化
- fielddata：text 字段聚合需要开启（内存消耗大）
- doc_values：keyword、numeric 字段默认开启（列式存储）
- eager_global_ordinals：加速 terms 聚合
- breadth_first vs depth_first：聚合策略选择
- 限制桶数量：size 参数，避免内存溢出

### 聚合的应用场景
- 数据统计：销售额、用户数、PV/UV
- 趋势分析：时间序列数据（date_histogram）
- 排行榜：terms + sum/avg
- 异常检测：percentiles、extended_stats
- 数据透视：多层嵌套聚合

## 集群管理篇

> 📖 篇笔记：[分布式架构与集群管理](/study-notes/middleware/elasticsearch/distributed-architecture-cluster)

### 节点角色
- Master Eligible：候选主节点，参与主节点选举
- Master：主节点，管理集群状态（唯一）
- Data：数据节点，存储数据和执行查询
- Ingest：预处理节点，执行 Ingest Pipeline
- Coordinating：协调节点，转发请求（所有节点都是）
- ML：机器学习节点（商业版）
- Remote Cluster Client：跨集群搜索

### 集群状态
- Green：所有主分片和副本分片都正常
- Yellow：所有主分片正常，部分副本分片不可用
- Red：部分主分片不可用，数据丢失
- 监控：通过 _cluster/health API 检查

### 分片分配
- 分配策略：SameShardAllocationDecider（同一分片的主副本分开）
- 磁盘水位：disk.watermark.low（85%）、high（90%）、flood_stage（95%）
- 分片过滤：allocation.include/exclude/require
- 延迟分配：delayed_timeout 延迟副本分配（等待节点恢复）
- 手动分配：reroute API

### 索引生命周期管理（ILM）
- Hot 阶段：频繁写入和查询
- Warm 阶段：只读，偶尔查询
- Cold 阶段：很少查询，可压缩
- Delete 阶段：删除索引
- Rollover：索引滚动（按大小或时间）
- Shrink：减少分片数
- Force Merge：合并 Segment

### 集群扩缩容
- 扩容：添加节点，自动 Rebalance
- 缩容：排空节点数据，再下线
- 分片迁移：自动或手动调整分片分布
- 集群负载均衡：通过分片分配策略实现

### 备份与恢复
- Snapshot：快照备份（增量备份）
- Repository：快照仓库（本地、NFS、S3、HDFS）
- Restore：从快照恢复
- 备份策略：定期全量 + 增量备份
- 跨集群复制：CCR（商业版）

## 性能优化篇

> 📖 篇笔记：[Elasticsearch 性能优化](/study-notes/middleware/elasticsearch/performance-optimization)

### 索引性能优化
- Bulk API：批量索引（建议 1000-5000 条/批）
- refresh_interval：增大刷新间隔（默认 1s，写入密集时设为 30s）
- 副本数量：写入时设为 0，写入完成后恢复
- 禁用 _all 字段：7.x 已废弃
- 调整 Buffer：indices.memory.index_buffer_size
- 使用 SSD：机械硬盘是瓶颈

### 查询性能优化
- filter 优先：filter 结果可缓存
- 分页优化：search_after 替代深度分页
- routing：指定路由减少查询分片数
- preference：查询偏好，读取缓存
- 禁用评分：constant_score 或 filter context
- 减少返回字段：_source 过滤

### 聚合性能优化
- 使用 keyword：text 聚合需要 fielddata（内存杀手）
- doc_values：列式存储，默认开启
- 限制桶数量：size 参数
- 预聚合：在索引时计算部分结果
- Rollup：数据降采样（商业版）

### 内存优化
- 堆内存：不超过 32GB（压缩指针失效）
- 堆外内存：Lucene 使用操作系统页缓存
- Fielddata：限制 indices.fielddata.cache.size
- 断路器：防止 OOM（circuit_breaker）
- 查询缓存：node query cache、shard request cache

### 磁盘优化
- 分片大小：单个分片 20-50GB 为佳
- Segment 合并：force_merge 减少 Segment 数量
- 压缩：index.codec=best_compression
- 冷热分离：热数据 SSD，冷数据 HDD
- 存储：RAID 0 提高吞吐

### 集群优化
- 分片数量：单节点分片数 < 20 * 堆内存（GB）
- 副本数量：根据可用性需求设置（1-2 个副本）
- 主节点专用：大集群主节点不存储数据
- 协调节点：大查询使用专用协调节点
- 网络：千兆网卡是瓶颈

## 实战场景篇

### 全文搜索
- 场景：电商商品搜索、内容搜索
- 方案：match + multi_match + function_score
- 拼写纠错：fuzzy query、suggest API
- 高亮：highlight
- 自动补全：completion suggester

### 日志分析
- ELK Stack：Elasticsearch + Logstash + Kibana
- Beats：轻量级数据采集（Filebeat、Metricbeat）
- 索引策略：按日期 Rollover
- 查询：Kibana Discover、Dashboard
- 告警：Watcher（商业版）、ElastAlert

### 实时分析
- 场景：用户行为分析、监控告警
- 方案：date_histogram + 多层聚合
- 时序数据：时间戳 + Rollup
- 实时仪表盘：Kibana Canvas

### 推荐系统
- 场景：相似商品、相关文章
- 方案：More Like This Query
- 向量检索：Dense Vector + kNN（7.3+）
- 混合检索：文本 + 向量

### 地理位置搜索
- 场景：附近的人、周边商家
- 方案：geo_distance、geo_bounding_box
- 地理聚合：geo_distance aggregation
- 地理形状：geo_shape（多边形区域）

## 运维监控篇

### 监控指标
- 集群健康：状态、节点数、分片数
- 索引性能：索引速率、查询 QPS、延迟
- 资源使用：CPU、内存、磁盘、网络
- JVM：堆内存使用率、GC 次数、GC 耗时
- 线程池：拒绝数量（rejected）

### 常见问题排查
- 集群 Red：检查分片状态、恢复日志
- 查询慢：慢查询日志、Profile API
- 写入慢：检查 refresh_interval、merge 操作
- OOM：检查堆内存、fielddata、断路器
- 磁盘满：检查索引大小、数据保留策略

### 安全加固
- X-Pack Security：身份认证、访问控制（商业版）
- TLS/SSL：加密传输
- 审计日志：记录访问日志
- IP 过滤：network.host 限制访问
- 禁用动态脚本：避免代码注入

### 容量规划
- 数据量：预估文档数量、单文档大小
- 增长率：数据增长速度
- 查询负载：QPS、聚合复杂度
- 硬件：CPU、内存、磁盘的权衡
- 测试：真实数据压测

## 下一步学习

掌握 Elasticsearch 后，你可以：
- **深入 Lucene**：理解底层搜索引擎原理
- **学习 ELK Stack**：Logstash、Kibana、Beats 完整生态
- **对比其他搜索引擎**：Solr、Sphinx、Meilisearch
- **向量检索**：Faiss、Milvus，深度学习时代的搜索
- **实时数仓**：ClickHouse、Druid，OLAP 引擎
- **搜索算法**：BM25、向量召回、Learning to Rank

Elasticsearch 是搜索和分析的瑞士军刀，从简单的全文检索到复杂的实时分析，它都能优雅胜任。掌握 ES，你就掌握了数据的"搜商"。Happy searching！
