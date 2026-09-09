# Elasticsearch 学习路线

Elasticsearch 是**分布式搜索与分析引擎的王者**:全文搜索、日志分析(ELK)、监控告警、推荐与向量检索(RAG),无处不在。它建立在 Lucene(Java 全文检索库)之上,却把分布式、易用性、可扩展性做到开箱即用——写一条 JSON 查询就能搜出"带分词、按相关度排序"的结果。**什么时候需要它**:①全文搜索(商品/内容,MySQL LIKE 做不到分词与相关度);②日志与可观测(海量写入 + 聚合分析);③复杂过滤 + 聚合报表;④向量/AI 检索。实践:8.x 单机 Docker 起一个即可(`docker run -d -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.x`),配 Kibana 的 Dev Tools 练查询。

这条线按 **核心概念与倒排索引 → 分布式架构与读写 → 分词与 Mapping → 查询 DSL 与评分 → 聚合 → 场景(搜索/日志/向量)→ 集群运维与优化 → 选型对比** 推进。

## 第一站:核心概念与倒排索引

**概念映射(与关系库对照学最快)**:Index(索引,7.x 后一个索引≈一张表,不再有 Type)/Document(文档≈行,JSON)/Field(字段≈列)/**Mapping(映射≈表结构 schema:定义字段类型与分析方式)**/Shard(分片:索引的物理切片——**并行与分布的单位**)/Replica(副本:分片的备份,高可用+读吞吐)。
**倒排索引(ES 的灵魂,面试必讲)**:传统数据库"文档→词条"正排;搜索引擎反过来——**词条 → 文档列表**:查询"苹果"直接查词条字典,不必扫全表。**三级结构**:Term Dictionary(词条字典,有序,磁盘)、Posting List(倒排表:含该词的文档 ID 列表)、**Term Index(FST 有限状态转换器:前缀树的极致压缩——常驻内存**,查找路径:内存 FST → 磁盘字典二分 → 倒排表);Posting List 压缩:FOR(增量编码分块)/Roaring Bitmap(稀疏位图)、跳表加速多词合并——**这就是"亿级文档毫秒级搜索"的底层**。
**写段机制(为什么 ES 是"近实时")**:写入先进内存 Buffer + **Translog(事务日志,防丢,类似 redo log)**;**refresh(默认 1 秒):Buffer 生成内存中的 Segment——新数据 1 秒后可搜**(近实时的来源);**flush:Segment 落盘、清 translog**;**Segment 不可变**——更新=新写+旧标记删除,后台 **merge 合并小段并物理删除**——理解 Segment 就理解"删除不立即释放空间、force_merge 什么时候用"。

## 第二站:分布式架构与读写流程

**集群三件套**:Cluster(集群)/Node(节点:一台 ES 实例)/Shard+Replica;**节点角色**(7/8 默认全能,大集群按需分离):master(集群管理:元数据与分片分配——**脑裂防御:7.x 后 quorum 自动**)、data(存数据跑查询)、ingest(数据预处理管道)、coordinating(协调转发,所有节点都承担)。
**分片真相**:索引创建时定**主分片数(不可改!**要改走 split/shrink 或重建)**——数据按 `hash(routing) % 主分片数` 路由(默认 routing=_id;**自定义 routing(如 user_id)让同一用户文档同片**——按用户检索快);副本数随时可调(1-2 个)。
**读写流程**:写:协调节点 → 路由到主分片 → 写主(写 translog+buffer)→ 同步副本 → 返回(默认等主成功即可,`wait_for_active_shards` 可加严);读:协调节点**轮询主/副本**(负载均衡)→ 合并返回;**搜索两阶段**:Query Phase(各分片算分取 Top N)→ Fetch Phase(取完整文档拼结果)。
**集群健康三色(运维第一眼)**:Green(主副本全齐)/**Yellow(主分片在,副本缺失——单节点集群常态,别慌**)/Red(有主分片丢失=数据不可用——先 `_cat/shards` 看谁红)。**容量真相**:索引的数据量 = 主分片数 × 单分片容量——**分片数是水平扩展的天花板,建索引前想清楚**(但分片也别贪多:每分片有开销)。

## 第三站:分词与 Mapping——选错类型是头号事故

**分词(Analysis)**:Analyzer = 字符过滤器(去 HTML)+ **Tokenizer 分词器(按词切分)** + Token Filter(小写/停用词/同义词/词干);内置(standard/keyword/whitespace……);**中文用 IK 分词器插件**(ik_smart 粗粒度/ik_max_word 细粒度,词典可扩展)或 HanLP——**中文搜索不上分词器 = 搜不到**。
**字段类型选型(最重要的一课)**:`keyword`(**不分词:精确匹配/过滤/排序/聚合——状态、分类、ID、枚举用**)vs `text`(**分词:全文搜索——标题/正文用**);**经典事故:把用户名字段建成 text,term 查询永远"查不到精确值"**(它被分词了!)——解法:multi-fields ("name": &#123;"type": "text", "fields": &#123;"keyword": &#123;"type": "keyword"&#125;&#125;&#125;)(搜索用 name,过滤聚合用 name.keyword);数值/date/boolean/ip/geo_point;**嵌套**:object(默认扁平化,**数组对象会失去独立性**——查"红色 M 码"会误中"红色 L + 蓝色 M")用 **nested 类型**(独立文档存储与查询);`doc_values`(列式存储,keyword/数值默认开——**排序/聚合的地基,别关**);`index: false`(只存不索引的字段,省空间);`ignore_above`(超长截断);**动态映射**(自动推断:字符串→text+keyword——**生产必关或显式 mapping**:类型一旦写入不可改,要改 = 重建索引 + reindex(日常操作,配索引别名切换零停机)。

## 第四站:查询 DSL 与评分

**查询两大族**:全文查询(match(标准,分词)/match_phrase(短语,词序固定)/multi_match(多字段,权重 field^2)/query_string(支持 AND/OR 语法,**别让用户直接传**——用 simple_query_string))与精确查询(term/terms(多值)/range(gt/gte/lt/lte——日期与数值范围)/exists(判空)/prefix/**wildcard(通配,**慎用:开头通配扫全表**)/fuzzy(拼写容错)**)。
**bool 组合查询(日常 80%)**:`must`(必须匹配,**参与评分**)/`filter`(必须匹配,**不参与评分——可缓存,性能关键:范围/状态过滤全放这里**)/`should`(或,影响分)/`must_not`(排除)。**评分 BM25(5.x+ 默认,面试点)**:词频(TF,饱和而非线性)+ 逆文档频率(IDF,罕见词权重大)+ 字段长度归一(短字段命中更值钱)——**对比旧 TF-IDF:BM25 对"重复词刷分"有上限,更稳健**;想按业务调序用 function_score(销量/时间加权)或 boost。
**常见坑清单**:term 查 text 字段(用 keyword 子字段)、match 查 keyword(不匹配)、深度分页(from 上万会拖垮——**scroll(快照遍历)/search_after(游标翻页,推荐)**)、*abc 开头通配、把不需要评分的查询放 must。

## 第五站:聚合——ES 的分析能力

聚合与查询同请求(查询先圈数据,聚合再算):**桶聚合(分组)**:terms(≈GROUP BY——**注意 size 默认只回 Top10 桶**,统计全量要 size 拉大或用 composite)、**date_histogram(按时间分桶:时序趋势分析的核心,calendar_interval/fixed_interval)**、range/直方图;**指标聚合**:avg/sum/min/max/**stats(一把返回五件套)/percentiles(P50/P90/P99——**延迟与耗时监控**)/cardinality(≈COUNT DISTINCT,基于 HyperLogLog,亿级去重很快)/top_hits(每桶取 Top N 文档——"每个分类下最热商品")**;**管道聚合**(对桶结果再算:累加/移动平均——高级)。
**聚合性能铁律**:聚合/排序字段必须是 **keyword 或数值**(text 要聚合得开 fielddata,**吃内存的坑**);依赖 doc_values(列式,默认开);限制桶数防内存爆炸;**场景**:销售额报表、PV/UV 趋势、TopN、P99 异常检测——**"搜"与"算"一个引擎搞定,是 ES 相对数据库的差异竞争力**。

## 第六站:实战场景与生态

**①全文搜索(电商/内容)**:match + multi_match + bool filter(类目/价格区间)+ function_score(销量/上架时间加权)、**高亮 highlight**、纠错 suggest、**补全 completion suggester(边输边搜)**——**这套能力是 MySQL LIKE 永远给不了的**。
**②日志分析(ELK/EFK 三件套)**:Filebeat(轻量采集)→ Logstash(过滤转换,可省,直接 ingest pipeline)→ ES(存储+检索)→ Kibana(可视化/Discover 排查)——**按日索引 + ILM 滚动**是标准姿势。**③向量与 AI 检索(新增长点)**:`dense_vector` 字段 + **kNN 检索(8.0 原生)**——语义搜索/RAG 的知识库底座(embedding 进 ES、向量召回 + BM25 文本召回可混排),见 [RAG 路线](/learning-paths/ai/rag-systems)。
**④地理位置**:geo_distance/geo_bounding_box(附近门店)、geo 聚合。**⑤可观测**:Metricbeat + ES(指标),APM(商业)。

## 第七站:集群运维与性能优化

**部署与内存(第一课)**:**JVM 堆别超过 30GB**(压缩指针上限;大堆 GC 反而慢)——**剩下的内存全给 OS 页缓存(Lucene 用,不用白不用)**,所以"机器 64G 堆给 30G"是常见误区;磁盘:SSD + **冷热分离(热节点 SSD、冷节点 HDD/可压缩)**;**分片规划**:单分片 20-50GB 为宜、单节点总分片数 ≈ 堆 GB × 20 以内、副本 1 个起步;**写入优化**(日志场景标配):**Bulk API 批量**(每批几千条)、`refresh_interval` 调到 30s(写入吞吐翻倍)、必要时副本先设 0 写完再开、关闭不需要的索引功能;**查询优化**:filter 优先(缓存)、search_after 替代深分页、_source 只取需要的字段、routing 命中单分片;**索引生命周期 ILM**:hot(热写)→ warm(只读、shrink 缩分片)→ cold(force_merge 合并段/压缩)→ delete——配 rollover 按大小/时间滚动索引;**备份:Snapshot 是唯一手段**(仓库:本地/S3/OSS,增量快照——**别靠复制数据目录**);**监控**:集群健康、`_cat/indices`、**慢查询日志(搜索/索引分层)、JVM(GC 长暂停)、线程池 rejected(写入过载信号)、磁盘水位(85% 黄/90% 红/95% 索引自动只读!)**——磁盘打满是 ES 集群最常见的"自杀"事故,配额与 ILM 提前设;**安全(8.0 起默认)**:内置认证(TLS+用户名密码,elastic 初始密码),学习版够用;生产别裸奔公网。
**故障排查**:集群 Red → `_cat/shards` 找未分配主分片与原因(磁盘/节点丢失)、段损坏;OOM → 查 fielddata/聚合桶数/大聚合,靠**断路器**预防。

## 第八站:选型与替代

**什么时候上 ES**:真全文搜索(分词+相关度)、日志与可观测、实时聚合分析、向量检索——**普通业务查询/事务数据留给数据库,别把 ES 当主存储**(它不强一致、更新代价高,常与 DB 双写/订阅同步配合:DB 是权威源,ES 提供搜索);**替代方案坐标系**:轻量搜索(文档/站内)用 Meilisearch/Typesense(开箱即用,中文友好度看版本)或 Solr(老牌,同 Lucene);**OpenSearch**(ES 7.10 的开源分支,AWS 主导,API 大体兼容——避开许可问题时选);海量日志只要聚合分析 → **ClickHouse(存储成本与查询性能更强,但没有全文相关度与 Kibana 式生态)**;**"搜索选 ES,日志量巨大选 ClickHouse"是常见架构结论**;向量检索也可用 Milvus/pgvector(见 [PostgreSQL](/learning-paths/database/postgresql))——场景匹配再选型。

## 通关标准

能独立做到:给同事讲清倒排索引三级结构与 refresh/flush/merge 的近实时机制;设计商品/文章的 mapping(text/keyword/多字段/嵌套,含中文 IK)并解释为什么 keyword 才能聚合;写 bool(filter 范围+must 全文)+ 分页 + 高亮的完整查询,并会用 search_after 处理深分页;用 date_histogram + terms + percentiles 出一份趋势与 TopN 报表;能看集群健康与慢日志定位"查询慢/写入慢"的方向;搭过 ELK 或至少用 Bulk 灌数 + Kibana 查过日志——Elasticsearch 主线通关。

ES 的价值一句话:**把"搜索与分析的复杂度"封装成 JSON API**——倒排索引、分布式分片、近实时段合并、BM25 评分,每个底层都够写一本书,但你要做的只是发一条查询。它也是"数据架构师"的必修课:数据库管事务、ES 管搜索、ClickHouse 管分析、Kafka 管流动——学会在正确的层放正确的引擎,比会写某一条查询重要得多。下一步:日志采集与可视化补上 [ELK 生态](/learning-paths/devops/monitoring),或把 ES 用作 [RAG](/learning-paths/ai/rag-systems) 的向量底座。
