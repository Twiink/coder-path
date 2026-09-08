# RAG 系统构建

RAG (Retrieval-Augmented Generation) 让 LLM 能访问你的知识库。先检索相关文档，再基于事实生成答案，从此告别 AI 胡编乱造。

## 基础篇

从最简单的 RAG 开始：

- **RAG 解决什么问题**：知识过时、会幻觉、无法定制
- **基本流程**：检索 → 组装上下文 → 生成答案
- **关键词检索 vs 语义检索**：为什么需要 Embedding
- **文档切片策略**：chunk_size、chunk_overlap 怎么设置
- **向量数据库选择**：Chroma、FAISS、Pinecone 各适合什么场景
- **最简 RAG 实现**：100 行代码搞定基础版本

## 进阶篇

让检索更准、答案更好：

- **Embedding 模型选择**：OpenAI、开源模型的对比
- **混合检索**：语义检索 + 关键词匹配
- **Reranking 二次排序**：CrossEncoder 提升精度
- **Query Transformation**：把一个问题变成多个角度
- **上下文压缩**：只保留相关部分，节省 token
- **Metadata 过滤**：精确定位特定范围的文档
- **引用追踪**：答案可验证，标注来源

## 实战篇

构建生产级 RAG 系统：

- **文档处理流程**：加载 → 切分 → 向量化 → 存储
- **多种文档格式支持**：PDF、Markdown、Word、网页
- **增量更新机制**：添加、删除、更新文档
- **查询优化流程**：转换 → 检索 → 重排 → 压缩 → 生成
- **RAG 评估体系**：检索准确率、答案质量、延迟、成本
- **性能优化**：批量操作、缓存、索引优化
- **监控与调试**：慢查询追踪、token 统计、错误追踪

## 高级技巧

更复杂的 RAG 场景：

- **多索引路由**：根据问题类型选择不同知识库
- **对话式 RAG**：保持上下文的多轮问答
- **Hybrid Search**：向量 + 全文 + 结构化查询
- **Self-Query**：让 LLM 生成查询条件
- **Parent Document Retriever**：检索小块，返回大块
- **时间感知 RAG**：优先返回最新信息

## 下一步学习

RAG 是基础，还有更多组合：

- **LlamaIndex 框架** → 专门为 RAG 优化的工具
- **向量数据库** → 深入理解不同数据库的特点
- **LangChain 框架** → RetrievalQA、ConversationalRetrievalChain
- **AI Agent 基础** → 让 Agent 能查询 RAG 系统
