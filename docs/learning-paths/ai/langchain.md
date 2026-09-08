# LangChain 框架

想快速搭建 LLM 应用？LangChain 把常见模式都封装好了。从 Prompt 模板到 Agent 工具，从文档处理到记忆管理，拿来就能用。

## 基础篇

先把这些积木认识一遍：

- **LLM 和 ChatModel**：统一的模型调用接口，换模型不用改代码
- **Prompt Templates**：告别字符串拼接地狱
- **Few-Shot Templates**：自动管理示例
- **Output Parsers**：把 LLM 输出转成结构化数据
- **基础 Chain**：把多个步骤串起来
- **Memory 类型**：Buffer、Window、Summary、Vector 记忆

## 进阶篇

组合起来，才是真正的力量：

- **Sequential Chain**：多步骤流水线，输入输出自动传递
- **Router Chain**：根据输入选择不同的处理路径
- **Agents 与工具**：让 LLM 自己决定用什么工具
- **自定义工具**：接入你自己的 API 和函数
- **Document Loaders**：加载 PDF、Markdown、网页等各种格式
- **Text Splitters**：智能切分长文档
- **Vector Stores**：Chroma、FAISS、Pinecone 集成
- **Retrieval QA**：构建文档问答系统

## 实战篇

动手做几个真实项目：

- **文档问答机器人**：上传文档，AI 基于内容回答问题
- **代码助手**：搜索文档、生成代码、执行测试
- **客服系统**：多轮对话、工具调用、转人工
- **数据分析 Agent**：查询数据库、生成图表、写报告
- **Callbacks 监控**：追踪 token 使用、记录耗时、调试 Chain
- **缓存优化**：减少重复调用，节省成本
- **异步执行**：并发处理多个任务

## 下一步学习

LangChain 是工具箱，配合其他技术更强：

- **RAG 系统构建** → 深入文档检索和生成策略
- **LlamaIndex 框架** → 另一个文档处理的强力工具
- **向量数据库** → 理解 Chroma、FAISS、Pinecone 的区别
- **自主 Agent** → AutoGPT/AutoGen 的多 Agent 协作

## Prompt Templates：告别字符串拼接

手动拼接 prompt 容易出错，而且维护起来头疼。PromptTemplate 解决这个问题：

用法：PromptTemplate 用 {变量} 占位，from_template 创建、format 填充；对话场景用 ChatPromptTemplate 按 system / human / ai 角色组织消息。

模板支持条件、循环等复杂逻辑，还能复用。比自己拼字符串优雅一百倍。

## Few-Shot Templates：自动处理示例

Few-shot learning 很强大，但手动组织示例很烦。FewShotPromptTemplate 帮你搞定：

FewShotPromptTemplate 接收 example_prompt（单条示例模板）+ examples（示例列表），自动把示例拼进最终 Prompt。

示例多了怎么办？用 ExampleSelector 动态选择最相关的：

示例一多就要"动态挑选"：SemanticSimilarityExampleSelector 按语义相似度只挑最相关的几条示例，效果更好也更省 token。

这就是 AI 的"举一反三"能力，而且是自动的。

## Chains：把步骤串起来

Chain 是 LangChain 的核心概念。把多个操作串成流水线：

入门用 LLMChain 把 prompt + model 串起来；SimpleSequentialChain 让前一步的输出自动成为下一步的输入。

更复杂的场景用 SequentialChain，可以处理多个输入输出：

多输入多输出用 SequentialChain：显式声明各步骤的 input_variables / output_variables，步骤间自动传递。

Chain 就像流水线，每个环节自动流转。你只需要定义好每一步做什么。

## Agents：给 AI 工具，让它自己决定

Agent 是 LangChain 最强大的功能。它会自己决定用什么工具、什么时候用：

先会用内置工具（load_tools 加载 llm-math、serpapi 等）配合 initialize_agent 组装；跑起来后观察 Agent 自主决定"用什么工具、什么时候用"。

Agent 会自己分析："要先用 WordLength 工具，然后用 llm-math"。不需要你告诉它怎么做。

自定义更复杂的工具：

自定义工具：继承 BaseTool 或直接用 @tool 装饰器，注意 name 要唯一、description 要写清用途——模型靠 description 决定何时调用它。

这就像给 AI 发了一把钥匙，让它自己去开合适的门。

## Memory：让 AI 记住对话

对话系统需要记忆。LangChain 提供了多种记忆类型：

按场景选记忆：ConversationBufferMemory 全量保存最简单；BufferWindowMemory 只留最近 N 轮；SummaryMemory 用 LLM 压缩总结。

还能用 VectorStore 做语义记忆：

超长对话用向量记忆：VectorStoreRetrieverMemory 把历史向量化，只检索与当前问题最相关的片段喂给模型。

不同的记忆策略适合不同场景。短对话用 Buffer，长对话用 Summary，需要精确回忆用 VectorStore。

## Document Loaders：加载各种格式的文档

处理文档是 AI 应用的常见需求。LangChain 支持各种格式：

加载器家族：TextLoader / PDFLoader / MarkdownLoader / WebBaseLoader 等，输出统一的 Document（page_content + metadata），为下游处理铺路。

加载后还需要切分，不然一次塞给 LLM 会超 token：

切分器：RecursiveCharacterTextSplitter 按段落/句子递归切分最推荐；想精确控制长度可用按 token 切分的方案，一般 500-1000 token 为宜。

切分策略很重要。太大超 token，太小丢失上下文。一般 500-1000 token 比较合适。

## Vector Stores：向量存储与语义搜索

传统搜索靠关键词，语义搜索靠"理解"。Vector Store 是关键：

VectorStore 统一接口：本地用 Chroma / FAISS，云端用 Pinecone；写入 add_texts、召回 similarity_search。

结合文档切分，构建完整的文档问答系统：

文档问答 = 切分 → 向量化 → RetrievalQA（把检索器接进问答链）；可用 MMR 检索避免结果重复——这就是 RAG 的骨架。

这就是 RAG (Retrieval-Augmented Generation) 的基础。让 AI 基于你的文档回答问题。

## 输出解析：结构化 LLM 输出

LLM 输出的是文本，但我们通常需要结构化数据：

输出解析器：PydanticOutputParser 按 Schema 把文本解析成对象、CommaSeparatedListOutputParser 拆列表；解析失败可让模型自动重试。

有了输出解析器，LLM 的输出就能直接用在代码里，不需要手动解析字符串了。

## Callbacks：监控和调试

Callbacks 让你能监控 Chain 和 Agent 的执行过程：

回调机制：StdOutCallbackHandler 打调试日志；自定义 handler 记录 token 用量、耗时与错误，接到监控平台。

Callbacks 对调试和性能监控非常有用。可以记录耗时、token 使用量、错误等。

## 最佳实践

实践要点：先小步验证每个组件再组装；能 Chain 就不急着上 Agent；控制 token 预算；用 Callbacks 观察执行过程；升级大版本前先读 changelog。

## 总结

LangChain 的核心概念：

1. **Models**：各种 LLM 的统一接口
2. **Prompts**：模板化的提示词管理
3. **Chains**：把多个步骤串起来
4. **Agents**：让 AI 自主决策和使用工具
5. **Memory**：管理对话历史
6. **Indexes**：文档加载、切分、向量化

记住：LangChain 不是银弹，但确实能帮你省很多时间。关键是理解每个组件的作用，然后像搭积木一样组合它们。

别一上来就想用最复杂的 Agent，先从简单的 Chain 开始，逐步优化。就像写代码，先让它跑起来，再让它跑得好。
