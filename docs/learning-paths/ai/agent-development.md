# AI Agent 开发学习路线

大语言模型时代，AI Agent 是最热门的方向之一。从简单的聊天机器人到能自主完成任务的智能体，Agent 开发正在改变软件的形态。这条路线带你从零开始构建实用的 AI Agent。

## 什么是 AI Agent

> 📖 篇笔记：[Agent 核心循环](/study-notes/ai/01-agent-core-loop) · [推理与思考](/study-notes/ai/02-reasoning-and-thinking) · [记忆与知识](/study-notes/ai/04-memory-and-knowledge)

AI Agent 是能够感知环境、做出决策、执行行动的智能系统。不同于传统的"调用一次 API 返回一个结果"，Agent 可以：
- 分解复杂任务
- 使用工具（搜索、计算器、数据库等）
- 记忆上下文
- 自主规划和执行
- 从反馈中学习

想象一个能帮你订机票、查天气、发邮件的助手，不是按照写死的流程，而是理解你的意图后自己决定怎么做，这就是 Agent。

## 基础知识：先会调用 LLM

### OpenAI API

安装：Python 用 `pip install openai`，Node 用 `npm install openai`——选一门语言深入即可，不必两头都学。

基础对话：调用 chat.completions，传 messages 列表（system 设定角色、user 提问），从返回结果中取回答文本。

流式响应：开启 stream 后逐段接收增量输出，实现"打字机"效果；JS/TS 写法与 Python 同构，示例二选一即可。

### Prompt Engineering：让 AI 听懂你的话

**Few-shot Learning**
少样本（Few-shot）：提问前先给几个「问题 → 理想回答」的示例，模型会照葫芦画瓢，输出格式明显更稳。

**Chain of Thought（思维链）**
思维链（Chain of Thought）：让模型"先逐步推理、再给结论"，复杂任务（数学、多步逻辑）准确率显著提升。

**Structured Output（结构化输出）**
结构化输出：要求模型只返回 JSON，并用 response_format / json mode 约束，拿到结果后用 Pydantic 校验再进业务。

## Function Calling：让 AI 使用工具

这是 Agent 的核心能力。AI 不再只会说话，还能调用函数完成实际任务。

Function Calling 三步走：① 用 JSON Schema 描述工具（名称、参数、用途）；② 模型返回"调用意图"而非直接回答；③ 执行真实函数，把结果回传给模型继续推理。把 ②③ 循环起来，就是最简 Agent 的 Reason → Act → Observe 闭环。

## 主流 Agent 框架

### LangChain：最流行的 Agent 框架

安装 langchain 与 langchain-openai 等配套包；版本组合以 LangChain 官方文档为准（迭代较快）。

理解四大抽象：模型封装（ChatOpenAI）、提示模板、工具（tools）、执行器（AgentExecutor）；把工具挂给 Agent 后一句 run 即可自主调用。完整路线见 [LangChain 学习路线](/learning-paths/ai/langchain)。

**LangChain 的记忆系统**
记忆：ConversationBufferMemory 直接存全部历史最简单但费 token；进阶用窗口记忆、总结记忆或向量检索记忆。见 [LangChain 学习路线](/learning-paths/ai/langchain)。

**RAG（检索增强生成）**
RAG 链路：加载文档 → 切分 → 向量化 → 存入向量库 → 检索 top-k 拼进 Prompt。概念见 [RAG 系统](/learning-paths/ai/rag-systems)，框架用法见 [LangChain 学习路线](/learning-paths/ai/langchain)。

### LlamaIndex：专注于数据索引

安装 llama-index 后，加载文档、建索引、提问都只要一两行核心 API，主打"开箱即用"。详见 [LlamaIndex 学习路线](/learning-paths/ai/llamaindex)。

LlamaIndex 的定位是「数据接入 + 索引 + 查询」：支持 PDF/网页/数据库等几十种数据源，适合做个人知识库。详见 [LlamaIndex 学习路线](/learning-paths/ai/llamaindex)。

### AutoGPT 模式：自主 Agent

AutoGPT 模式：目标拆解 → 循环执行 → 自我反思改进，适合研究性探索；直接用于生产要警惕成本与失控风险。详见 [自主 Agent 学习路线](/learning-paths/ai/autonomous-agents)。

### CrewAI：多 Agent 协作

安装 crewai（要求较新的 Python 版本），示例代码变化快，以官方文档为准。

CrewAI 模式：定义多个各司其职的 Agent（如研究员、写手、审校）→ 分配 Task → 组成 Crew 顺序执行，模拟真实团队协作。

## Vector Database：Agent 的记忆

向量库选型：Chroma 轻量适合本地原型，Milvus / pgvector / Qdrant 适合生产。对比见 [向量数据库学习路线](/learning-paths/ai/vector-databases)。

掌握四步操作：建 collection → 写入带 embedding 的文档 → 相似度检索 → 取回 top-k 结果。

## Agent 评估与优化

### 评估指标

评估：离线准备一批用例算准确率/召回率，在线靠用户反馈与人工抽检；也可以让更强的模型当裁判（LLM-as-judge）批量打分。

### Prompt 优化

Prompt 优化：对同一任务做 A/B 测试，记录每个版本的输出与失败样本，基于数据迭代而不是凭感觉改词。

## 部署与监控

### FastAPI 部署

部署：把 Agent 封装成 FastAPI 接口（如 POST /chat），耗时任务用流式响应或任务队列，避免请求同步阻塞。

### 监控与日志

监控：输出结构化日志（请求内容、token 用量、延迟、错误）；进阶用 LangSmith 等工具可视化追踪 Agent 的每一步。

## 安全与成本控制

### 防止 Prompt Injection

安全：对用户输入做长度与内容过滤，给工具的权限最小化，涉及支付、删除等敏感操作必须二次确认。

### 成本控制

成本控制：按「模型单价 × token 数」给每次请求记账，设置每日预算上限；用缓存、批量与更小的模型降本。

## 学习资源

**官方文档**
- [OpenAI Cookbook](https://github.com/openai/openai-cookbook)
- [LangChain 文档](https://python.langchain.com/)
- [LlamaIndex 文档](https://docs.llamaindex.ai/)

**开源项目**
- [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT)
- [BabyAGI](https://github.com/yoheinakajima/babyagi)
- [MetaGPT](https://github.com/geekan/MetaGPT)

**论文**
- ReAct: Synergizing Reasoning and Acting in Language Models
- Reflexion: Language Agents with Verbal Reinforcement Learning
- Tree of Thoughts

## 下一步学习

- **多模态 Agent** - 处理图像、音频、视频
- **具身 Agent** - 控制机器人
- **游戏 Agent** - 自动玩游戏
- **代码 Agent** - 自动编程
- **Agent 编排** - 复杂任务分解与协作

---

AI Agent 是一个快速发展的领域，新框架、新方法层出不穷。核心能力是理解 LLM、设计 Prompt、构建工具链。从简单的聊天机器人开始，逐步增加记忆、工具、规划能力，最终做出能自主完成复杂任务的智能体。未来已来，开始构建你的 Agent 吧！
