# LlamaIndex 框架

LlamaIndex 专注做一件事：让 LLM 高效地访问和理解你的数据。如果说 LangChain 是瑞士军刀，LlamaIndex 就是专业手术刀，专门为文档检索和查询优化。

## 基础篇

从最基本的文档处理开始：

- **Document 和 Node**：原始文档 vs 索引单元
- **Index 类型对比**：VectorStore、Summary、Tree、Keyword 各有什么用
- **基础查询**：三行代码让文档能被 AI 理解
- **ServiceContext**：配置 LLM、Embedding、Chunk 参数
- **持久化**：保存索引，下次直接加载
- **增量更新**：添加、删除、更新文档

## 进阶篇

让检索更精准、更高效：

- **Query Engine 配置**：控制检索数量、相似度阈值
- **Response Modes**：compact、refine、tree_summarize 的选择
- **Chat Engine**：构建对话式文档问答
- **Metadata 过滤**：在特定范围内精确搜索
- **自定义 Embedding**：用开源模型替代 OpenAI
- **Sub Question Engine**：把复杂问题拆成多个子问题
- **Router Engine**：多个索引智能路由

## 实战篇

真实场景下的应用：

- **生产级文档问答系统**：完整的加载、索引、查询流程
- **集成外部向量数据库**：Chroma、Pinecone、Weaviate
- **评估与调优**：Faithfulness、Relevancy 指标
- **性能优化**：批量操作、索引策略、缓存
- **多数据源整合**：Notion、Google Docs、Slack、数据库
- **监控与调试**：统计查询时间、token 使用、慢查询追踪

## 下一步学习

文档处理只是起点，还有更多可能：

- **RAG 系统构建** → 检索策略、Reranking、上下文压缩
- **向量数据库** → 理解不同向量库的特点和选择
- **LangChain 框架** → 两者可以结合使用
- **Prompt Engineering** → 优化查询和生成的提示词
