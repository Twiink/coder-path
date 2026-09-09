# LlamaIndex 框架学习路线

LlamaIndex 专注做一件事:**让 LLM 高效地访问与理解你的数据**——如果说 LangChain 是瑞士军刀,LlamaIndex 就是给"数据接入 + 索引 + 查询(RAG)"做的手术刀:加载几十种数据源、智能切分、向量索引、检索与合成,几行代码跑通"文档问答"。它适合:**个人/企业知识库问答、长文档理解、数据代理(问数据库/API)**;与 LangChain 是互补关系(可互操作:LlamaIndex 的查询引擎能当 LangChain 的工具)。底层机制(RAG 的检索-生成)先看 [RAG 系统](/learning-paths/ai/rag-systems) 页,本页讲框架怎么用。

这条线按 **核心抽象(Document/Node/Index)→ 五步上手 → 查询引擎与响应模式 → 数据连接器与向量库 → 高级检索与评估 → 生产工程** 推进。

## 第一站:核心抽象——从文档到索引

**四个概念先分清**:①**Document(原始文档)**:一份文件(文本 + 元数据:来源/日期/作者——元数据贯穿始终,是过滤与溯源的基础);②**Node(节点)**:文档**切分后的索引单元**(文本块 + 继承/补充的元数据 + 节点间关系)——**LlamaIndex 的切分管理(NodeParser)是它的强项**:支持按句法切、按语义切、**自动维护"父节点-子节点"关系**(父块大保上下文、子块小保精度,配自动合并检索用);③**Index(索引)**:组织 Node 的结构——**VectorStoreIndex(默认主力:embedding 进向量库做语义检索)**、SummaryIndex(不检索,按序全读——小文档/总结场景)、TreeIndex/KeywordIndex(早期方案,了解即可);④**Query Engine(查询引擎)**:把"索引 + 检索 + 合成"封装成 `query()` 接口——对业务就是"问数据"。
**Settings 全局配置**(替代老 ServiceContext):一次设好 LLM/embedding 模型/chunk 大小,全局生效——**注意:换 embedding 模型必须重建索引**(向量空间变了,旧索引失效)。

## 第二站:五步上手——最小 RAG 全流程

核心 API 极简(建议亲手跑一遍):①**加载**:`SimpleDirectoryReader("./data").load_data()`(自动按扩展名找解析器,PDF/Markdown/Word/网页都行);②**切分**:默认 NodeParser 自动做(可调 chunk_size/overlap);③**建索引**:`VectorStoreIndex.from_documents(docs)`(自动调 embedding 并入库);④**持久化**:`index.storage_context.persist()`(存磁盘——下次 `load_index_from_storage` 直接加载,不用重新 embedding 省大钱);⑤**查询**:`query_engine = index.as_query_engine()` → `query_engine.query("总结这份合同的风险条款")`——**完成**。
**增量更新**:`index.insert(doc)`/`delete_ref(doc_id)`(文档增删改的日常维护;大变动建议重建)。就这五步,你已经有一个生产可用的个人知识库问答雏形——后面的章节都是往这条链上做精。

## 第三站:查询引擎与响应模式

**query() 的行为由三个旋钮控制**:①**检索参数**:`similarity_top_k`(取几块——太小漏、太大杂,3-5 起步)、相似度阈值(过滤低相关块);②**元数据过滤(生产精确化的关键)**:查询时按元数据条件限定范围——"只查 2024 年的合同/只看技术类文档/按部门隔离"(`MetadataFilters`),多租户数据隔离也靠它;③**Response Mode(合成策略,按文档规模选)**:`compact`(压缩塞进上下文,默认)、**`refine`(逐块精炼:大文档/超长内容——每块读后让模型修订答案,慢但全)**、`tree_summarize`(块分组合并摘要——海量内容求概览);**Chat Engine(对话式问答)**:`index.as_chat_engine()`——内置多轮记忆与检索,"追问上下文"场景开箱即用(底层即 [Agent 基础](/learning-paths/ai/agent-basics) 的上下文管理模式);**进阶引擎**:Sub Question(复杂问题自动拆子问题分别检索再综合)、Router(多个索引按意图路由——"问代码看这个库、问文档看那个库")。

## 第四站:数据连接器与向量库

**加载器生态(LlamaHub)**:几十种官方与社区加载器——Notion/Google Drive/Slack/Confluence/数据库/网页爬虫/API……**"喂什么数据"常常比"怎么检索"更决定产品价值**;统一输出 Document,下游一致。**向量存储抽象**:默认本地(简单持久化,原型够用);**生产数据量大上外部向量库**(Chroma/Pinecone/Qdrant/Weaviate/**pgvector/Milvus**——选型见 [向量数据库](/learning-paths/ai/vector-databases))——`VectorStoreIndex.from_vector_store(...)`:写入与查询走统一接口;**多模态与图谱(进阶)**:知识图谱索引(实体关系问答)、图像文档(OCR/多模态模型提取)。
**与 LangChain 互通**:LlamaIndex 的 QueryEngine 可包成 LangChain 工具(让 Agent 会"查公司知识库")、检索器也可供 LCEL 使用——**组合拳常见:Li 管数据、LC/LangGraph 管编排**(见 [LangChain](/learning-paths/ai/langchain))。

## 第五站:高级检索与评估(RAG 从能用变好用)

**检索质量升级(与方法论页呼应)**:①**Node 后处理器**:相似度阈值过滤、**rerank(重排:先用便宜检索取 top-20,再用交叉编码器重排取 top-5——生产 RAG 性价比最高的一步)**;②**句子窗口检索(小块检索、大块生成)**:索引存小块(检索准),回答时自动带上小块所在的大窗口(上下文全)——LlamaIndex 的 `SentenceWindowNodeParser` 即此意;③**自动合并检索(父-子节点)**:命中多个子块时合并其父块——减少碎片化回答;④HyDE(先让模型生成假设答案再检索——查询与文档措辞不一致时有效);⑤查询转换(改写/扩写用户问题)。
**评估(内置 RAG 评估器,两个核心指标)**:①**Faithfulness(忠实度:回答是否忠于检索内容,有没有编造——防幻觉的第一指标)**;②**Relevancy(相关性:检索到的内容对回答是否真有用)**——工作流:从你的文档**自动生成一批问答对**(模型出题)→ 跑评估 → 看两项得分,**改切分/检索/重排后重跑对比**(与 [RAG](/learning-paths/ai/rag-systems) 评估章同方法论);**可观测**:回调与 token 统计、查询耗时——生产接 Langfuse/LangSmith 追踪。

## 第六站:生产工程与学习路径

**生产清单**:embedding 批量与缓存(入库成本)、索引持久化与定时增量(文档更新走 insert/delete)、**元数据隔离(多租户)**、向量库选型(数据量/托管)、查询超时与并发、追踪与评估上线、监控 token 成本;**版本与生态**:LlamaIndex 迭代快(版本间 API 有调整,以官方文档为准);**LlamaCloud(商业托管)**:托管解析(复杂 PDF/表格)、托管索引与查询 API——不想自己运维的团队选项;**学习路径**:五步 Demo → 调 chunk/检索参数 → 上元数据过滤与 Chat Engine → 接外部向量库 → 加 rerank 与评估 → 做多数据源产品;**典型产品配方**:个人知识库(本地文档+Chat Engine)、企业文档问答(多源加载器+元数据隔离+评估)、"数据代理"(把 SQL/Notion 查询引擎包成 Agent 工具)。

## 通关标准

能独立做到:五步跑通一个"多格式文档问答"(加载/索引/持久化/查询),并解释 Document/Node/Index/QueryEngine 各自职责;会调 similarity_top_k、元数据过滤与 refine/compact 模式并说出选型依据;把索引接上生产向量库并完成增量更新;给系统加上 rerank 并用内置评估器跑出 Faithfulness/Relevancy 两项得分,且能说出改了什么让分变高;把查询引擎包成 Agent 工具接入自己的智能体——LlamaIndex 主线通关。

LlamaIndex 教会你的核心是:**RAG 不是"切了存进去就能问",而是一条可调优的数据管道**——切分策略、元数据、检索后处理、合成模式、评估指标,每一环都有讲究(详见 [RAG 系统](/learning-paths/ai/rag-systems) 方法论)。它把这条管道的默认值给得很好(几行可用),把定制点也留得很全(处处可换)——**先用它的默认值跑通业务,再按评估分数逐环优化**,这是框架的正确用法。下一步:深入 [RAG](/learning-paths/ai/rag-systems) 原理、[向量数据库](/learning-paths/ai/vector-databases) 选型,或与 [LangChain](/learning-paths/ai/langchain) 组合编排。
