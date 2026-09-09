# LangChain 框架学习路线

LangChain 是 LLM 应用开发最流行的组装框架:把"模型调用、提示模板、文档处理、检索、记忆、Agent 循环"都抽象成**积木**,用声明式方式串成应用——**换模型不改业务代码、加工具不用重写循环**,配套 LangSmith(追踪与评估)与 LangGraph(状态化编排)形成完整生态。**清醒的定位**:它不是银弹——抽象层厚、版本迭代快(0.1→0.3 的 API 迁移、包拆分),**"学原理比背 API 重要"**:先理解每个组件解决什么问题(见 [Agent](/learning-paths/ai/agent-basics) 与 [RAG](/learning-paths/ai/rag-systems) 的底层机制),再回来用框架会事半功倍。本页以 **LangChain 0.2/0.3 时代的现代写法(LCEL + LangGraph)** 为准。

这条线按 **核心抽象(Model/Prompt/输出)→ LCEL 与链式组合 → 记忆与状态 → Agent 与工具(LangGraph)→ RAG 组件 → 可观测与工程 → 最佳实践与选型** 推进。

## 第一站:三大基础抽象

**①Models(统一模型接口)**:ChatOpenAI/ChatAnthropic 等把各家 API 包成同一接口(`invoke/stream/batch`),模型可插拔;参数(模型名/temperature/max_tokens);**换模型只改一行**——但注意各家能力差异(工具/长上下文),抽象不能抹平特性。**②Prompt Templates(模板化,告别字符串拼接)**:`ChatPromptTemplate` 按 system/human/ai 组织消息,`{变量}` 占位、`format` 填充;**MessagePlaceholder(现代写法的关键)**:在模板里留"历史消息/工具结果/动态内容"的插槽(`MessagesPlaceholder("chat_history")`、`MessagesPlaceholder("agent_scratchpad")`)——**Agent 循环与多轮对话都靠它**,比老式"字符串拼历史"干净得多;Few-shot 示例也可模板化,示例多时用**语义相似度动态挑选最相关的几条**(省 token 且效果更好)。**③Output Parsers(结构化输出)**:LLM 输出是文本,业务要 JSON/对象——**现代姿势:`model.with_structured_output(PydanticClass)`**(模型直接按 schema 输出 + 解析校验,解析失败自动重试);老式 PydanticOutputParser 了解即可——**铁律:模型输出进业务前必须程序校验**(框架校验失败会抛错,别吞)。

## 第二站:LCEL——声明式链式组合

**LCEL(LangChain Expression Language)是 0.2+ 的组合语法**:用 `|` 把组件串成管道:`prompt | model | output_parser`——每个环节都是 **Runnable(统一协议:invoke(单次)/stream(流式)/batch(批量)/ainvoke(异步))**;组合子:`RunnablePassthrough`(透传/加字段)、`RunnableParallel`(并行分支:一个输入同时跑多条链再合并——"检索与生成并行"场景)、`RunnableBranch`/`RunnableLambda`(条件与自定义函数——普通 Python 函数经 RunnableLambda 就能进链)、`with_fallbacks`(模型失败自动换备用——容错);老 LLMChain/SequentialChain 类已让位于 LCEL(概念相通:流水线、输入输出自动传递)。**心智**:LCEL 链 = 纯函数管道,**容易测试与插桩**(每一步可单独 invoke 验证)——比"一个巨型 prompt"工程化得多(呼应 [Prompt](/learning-paths/ai/prompt-engineering) 的 Chaining 章)。**复杂状态流交给 LangGraph**(见第四站):有分支循环/需要共享状态/中断恢复的流程,别用 LCEL 硬凹。

## 第三站:记忆与状态

**对话记忆的正确打开方式(版本差异大,学模式)**:现代推荐——**RunnableWithMessageHistory**(链自动把每轮消息存进外部存储(Redis/数据库),按 session_id 取历史注入 MessagePlaceholder)——**存哪/取多少由你控制**,比老 Memory 类(ConversationBufferMemory 等,0.3 后边缘化)清晰;记忆策略本身不变(见 [Agent 基础](/learning-paths/ai/agent-basics)):短对话全量、长对话窗口/摘要、超长用向量检索式记忆(只召回相关片段)。**LangGraph 的状态持久化(进阶但重要)**:graph 配 **checkpointer**(内存/Redis/SQLite)——节点状态可保存,**会话中断后恢复、多轮间共享状态**("让 Agent 记住做到哪一步"的标准解)。

## 第四站:Agent 与工具——现代姿势是 LangGraph

**Agent 在 LangChain 的演进**(面试/选型常问):老 AgentExecutor(黑盒循环)→ **LangGraph 的显式 Agent 图(create_react_agent 等,推荐)**:节点(模型决策/工具执行)+ 边 + 共享状态——**循环可见、可打断、可恢复**。**工具定义**:`@tool` 装饰器把函数变工具(**函数 docstring 自动成为工具描述——模型靠它决定何时调用,写清楚!**;参数自动生成 JSON Schema;可配返回类型);内置工具集(搜索(Tavily)/计算/维基)与社区工具;**MCP 集成**(langchain-mcp-adapters:把现成 MCP Server 变成工具——见 [MCP](/learning-paths/ai/claude-mcp))。**LangGraph 核心概念(值得专门学)**:StateGraph(定义状态结构与节点)、节点(普通函数:读状态/返回更新)、**边与条件边**(决定流程走向——工具调用循环就是"模型节点→有 tool_calls 则去工具节点→回模型节点")、**interrupt(人在环:节点暂停等人确认/输入——生产 Agent 的关键能力,见 [Agent 开发](/learning-paths/ai/agent-development))**、checkpointer(状态持久化)、子图(模块复用)。**学习顺序**:先裸写工具循环(理解,见 [Agent 基础](/learning-paths/ai/agent-basics))→ 用 create_react_agent 跑通 → 手写 StateGraph 控制复杂流程。

## 第五站:RAG 组件链——加载到生成的流水线

LangChain 的 RAG 组件是全的,按顺序认识:**①Document Loaders**:几十种格式(PDF/网页/Office/数据库/Notion……)统一输出 Document(page_content + metadata——**metadata(来源/页码)是引用溯源的基础**);**②Text Splitters**:把长文档切成检索友好的块——**首选 RecursiveCharacterTextSplitter(按段落句子递归切,chunk_size 500-1000 token 起步)**;切太大超 token、太小丢上下文,**切分质量直接决定检索质量**(进阶:按结构切(标题)/语义切分,见 [RAG](/learning-paths/ai/rag-systems));**③Embeddings 接口**(模型无关:OpenAI/Anthropic 兼容/本地 Ollama——统一 embed 调用);**④VectorStores 接口**:本地 Chroma/FAISS、生产 pgvector/Milvus/Qdrant(见 [向量数据库](/learning-paths/ai/vector-databases))——写入(add)与召回(similarity_search)是统一 API;⑤**Retrievers(检索器,决定 RAG 上限)**:基础向量检索 → **MMR(最大边际相关:去重保多样)** → 多查询检索(拆多个子查询)、**Contextual/压缩检索**(只留相关片段)、重排(Reranker 二段检索——**生产 RAG 的标配**);⑥**组装 RAG 链(LCEL)**:`{question} → 检索 → 拼上下文 → model → 回答`——"检索器 | 格式化 | prompt | model";**RunnableWithMessageHistory + RAG** 就是多轮文档问答。完整方法论(评估/进阶)见 [RAG 系统](/learning-paths/ai/rag-systems) 页。

## 第六站:可观测与工程化

**Callbacks(逐事件钩子)**:链/模型/token/耗时/错误全可监听——写自定义 handler 接监控或打日志;**LangSmith(官方平台,生产推荐)**:自动记录每次运行的完整轨迹(输入/输出/中间步骤/token/延迟),**可视化调试 + 数据集评估(golden 回归)——"Agent/RAG 没有追踪与评估 = 盲人摸象"**(与 [Agent 开发](/learning-paths/ai/agent-development) 评估章呼应);开源替代 Langfuse。**工程要点**:LLM 缓存(相同请求命中——省钱)、astream 流式(打字机)、async(异步并发批量)、**版本管理**:0.2/0.3 的 API 与包拆分(langchain-core/community、langgraph 独立)——**锁版本、升级读官方迁移指南**;组件小步验证(每块单独 invoke 再组装——别一次拼完再 debug)。

## 第七站:最佳实践、批评与选型

**最佳实践清单**:先裸写小例跑通再上框架(理解在框架前);能确定性流程就别上 Agent(见 [Agent 开发](/learning-paths/ai/agent-development) 的编排原则);每步可单独测试(LCEL 天然支持);追踪与预算从第一天就接;模型/检索质量用数据集评估而不是"感觉"。**批评与替代(面试/选型要会说)**:LangChain 的问题——抽象层厚(出问题要扒三层)、**API 变动快(教程半年过期)**、包体积与依赖重;**替代坐标系**:极简小项目 → 官方 SDK 手写(几百行搞定,见 [Claude API](/learning-paths/ai/claude-api));复杂状态化 Agent → **LangGraph(或自写状态机)**;数据/RAG 向 → **LlamaIndex**(见下页);需要长文档多格式问答 → LlamaIndex 或直接 LangChain RAG 链;前端/全栈 → Vercel AI SDK。**什么时候选 LangChain**:组件生态要得多(几十种 loader/vectorstore 适配)、团队要统一抽象、要 LangSmith 一条龙——**"复杂度不够别引框架,引了就要跟上游版本"**。

## 通关标准

能独立做到:用 ChatPromptTemplate + MessagesPlaceholder + with_structured_output 组一条带历史的多轮链并跑通;用 LCEL 组装"检索→生成"RAG 链(切分/向量化/检索/回答),能解释每段组件的作用;用 @tool 定义工具并画出 LangGraph 的"模型↔工具"循环图(含条件边与中断点);接上 LangSmith/Langfuse 看到一次运行的完整 trace;评估过"自己写 vs LangChain vs LangGraph"的选型并给出理由——LangChain 主线通关。

LangChain 的价值是"把 LLM 应用的重复劳动抽象成积木";它的教训是"抽象有成本"。**用它,但别被它绑架**:理解它每一块积木背后的原理(LCEL 不过是函数管道、Agent 不过是循环、RAG 不过是检索加生成),你就能在"框架翻车"时自己补位,也能在"框架太重"时抽身裸写。它和 LangGraph/LlamaIndex 的边界会继续演化,但"组件化 + 可观测 + 可评估"的工程方向不会变。下一步:数据侧的 [LlamaIndex](/learning-paths/ai/llamaindex),或系统化 [RAG](/learning-paths/ai/rag-systems)。
