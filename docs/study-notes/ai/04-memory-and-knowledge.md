# 记忆与知识范式详解（RAG / Memory Systems / MemGPT）

> **共同点**：都是"**让 Agent 记住**" —— 用外部存储弥补 LLM 上下文有限、知识过期的短板，是 Agent 的"知识底座"与"长期记性"。
> **包含**：RAG（知识检索）、Memory Systems（分层记忆）、MemGPT（操作系统式记忆管理）。

## 本文档包含（3 种范式）

| 范式 | 一句话 | 记忆形态 |
|---|---|---|
| RAG | 先检索知识再回答 | 知识库（向量检索） |
| Memory Systems | 短期 + 长期分层记忆 | 分层（对话/事实/偏好） |
| MemGPT | 把记忆当内存分页管理 | 上下文 ↔ 外部存储自动换入换出 |

## 快速选型

- 知识密集问答（私有文档）→ RAG
- 跨会话个性化、多轮任务 → Memory Systems
- 超长对话、需突破上下文窗口 → MemGPT

> 三者可叠加使用：RAG 提供知识，Memory 提供个性化，MemGPT 管理长上下文。

## RAG（Retrieval-Augmented Generation）检索增强生成范式详解

> **先检索，再回答** —— 回答前先从知识库检索相关资料，把外部知识拼进上下文，让 LLM 基于"证据"生成答案。对抗幻觉、知识过期的标配方案。

### 1. 一句话总结

不把问题直接丢给 LLM，而是先从**外部知识库**（文档、数据库、网页）中检索相关内容，连同问题一起交给 LLM 生成答案 —— 知识可更新、答案可溯源、幻觉大幅减少。

### 2. 核心思想

- **论文**：《Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks》(Lewis et al., 2020, Facebook AI)
- **为什么需要**：LLM 知识止于训练截止日期，且会"自信地编造"；RAG 让模型"开卷考试"而非"闭卷默写"。
- **核心三件套**：
  1. **文档加载与切分**（Loader + Splitter）
  2. **向量化与存储**（Embedding + Vector Store）
  3. **检索与生成**（Retriever + LLM）

### 3. 工作原理（经典 RAG 流程）

```text
                 ┌──────────────┐
                 │  知识文档库    │
                 └──────┬───────┘
                        │ 切分 + 向量化
                        ▼
                 ┌──────────────┐
                 │  向量数据库    │
                 └──────┬───────┘
                        │
用户问题 ──▶ 向量化 ──▶ 相似度检索（Top-K）
                        │
                        ▼
              ┌─────────────────────┐
              │ Prompt = 问题 + 检索片段 │
              └──────────┬──────────┘
                         ▼
                    LLM 生成回答（带引用）
```

### 4. 完整示例（LangChain：完整 RAG 链路）

#### 4.1 建库 + 检索 + 生成（最简可运行版）

```bash
# 依赖：pip install langchain langchain-openai langchain-community chromadb
```

```python
from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# ── 1. 加载与切分 ────────────────────────────────────────
loader = TextLoader("docs/公司产品手册.txt", encoding="utf-8")
documents = loader.load()

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,        # 每块字符数
    chunk_overlap=50,      # 块间重叠，避免切断语义
)
chunks = splitter.split_documents(documents)
print(f"切分成 {len(chunks)} 块")

# ── 2. 向量化并入库 ──────────────────────────────────────
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = Chroma.from_documents(chunks, embeddings, persist_directory="./chroma_db")

# ── 3. 检索器 ────────────────────────────────────────────
retriever = vectorstore.as_retriever(
    search_type="similarity",   # 也可用 mmr（多样性）
    search_kwargs={"k": 4},     # 返回 Top-4
)

# ── 4. 生成（RAG 提示词：强制基于资料回答）────────────────
prompt = ChatPromptTemplate.from_messages([
    ("system", """你是客服助手。只基于以下资料回答，资料中没有的信息要明说"资料中未提及"。
资料：
{context}"""),
    ("human", "问题：{question}"),
])

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain = (
    {"context": retriever | format_docs, "question": lambda x: x["question"]}
    | prompt
    | ChatOpenAI(model="gpt-4o", temperature=0)
    | StrOutputParser()
)

answer = rag_chain.invoke({"question": "产品的退款政策是什么？"})
print(answer)
```

#### 4.2 进阶：带引用溯源

```python
from langchain_core.output_parsers import JsonOutputParser

rag_chain_verbose = (
    {"context": retriever | format_docs, "question": lambda x: x["question"]}
    | ChatPromptTemplate.from_messages([
        ("system", "基于资料回答，并列出引用来源。JSON 输出：{{'answer': ..., 'sources': [文档名]}}。资料：{context}"),
        ("human", "{question}"),
    ])
    | ChatOpenAI(model="gpt-4o", temperature=0)
    | JsonOutputParser()
)
```

#### 4.3 LangGraph：可观测的 RAG 流程（加检索质量门禁）

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class RAGState(TypedDict):
    question: str
    context: str
    answer: str

def retrieve(state: RAGState) -> RAGState:
    docs = retriever.invoke(state["question"])
    state["context"] = format_docs(docs)
    return state

def check_relevance(state: RAGState) -> RAGState:
    """质量门禁：检索结果与问题相关才继续（防止幻觉）"""
    verdict = llm.invoke(
        f"检索内容与问题「{state['question']}」相关吗？只回答 yes/no：\n{state['context'][:500]}"
    ).content
    state["relevant"] = verdict.strip().lower().startswith("yes")
    return state

def generate(state: RAGState) -> RAGState:
    if not state.get("relevant"):
        state["answer"] = "抱歉，知识库中没有相关内容。"
    else:
        state["answer"] = rag_chain.invoke({"question": state["question"]})
    return state

# 构图：retrieve → check → generate
```

### 5. RAG 优化清单（生产必看）

| 环节 | 常见问题 | 优化手段 |
|---|---|---|
| **切分** | 切断语义、块过大 | 按结构切分（Markdown/HTML 头），overlap 10~20% |
| **嵌入** | 相似度不准 | 换更强 embedding 模型；加 rerank 重排 |
| **检索** | Top-K 不相关 | 混合检索（BM25 + 向量）、hybrid search、query 改写 |
| **提示词** | 模型无视资料 | 强调"只能基于资料"；资料与问题同域 |
| **引用** | 无法溯源 | 返回来源文档 + 页码；忠实引用检查 |

### 6. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 知识可实时更新（改库即可） | 检索质量决定上限（垃圾进垃圾出） |
| 大幅减少幻觉 | 需要额外基础设施（向量库等） |
| 答案可溯源（引用来源） | 检索不到相关内容时照样答错 |
| 支持私有知识接入 | 上下文变长，token 成本上升 |

### 7. RAG 的进化形态

| 形态 | 说明 |
|---|---|
| **Naive RAG** | 检索 → 拼接 → 生成（本文示例） |
| **Advanced RAG** | 加 query 改写、rerank、混合检索 |
| **Modular RAG** | RAG 与 Agent 结合：先拆问题再分路检索、自我反思检索结果 |
| **GraphRAG** | 用知识图谱检索实体关系，擅长全局性问题 |
| **Agentic RAG** | 检索作为 Agent 工具，需要时再查（见下） |

#### Agentic RAG（LangGraph 示例：需要时再检索）

```python
from langgraph.prebuilt import create_react_agent

@tool
def search_knowledge_base(query: str) -> str:
    """从公司知识库检索资料"""
    docs = retriever.invoke(query)
    return format_docs(docs)

# 检索变成 Agent 的工具，模型自行决定何时检索、检索几次
agent = create_react_agent(
    llm, tools=[search_knowledge_base],
    prompt="你是客服助手。回答前先检索知识库，资料不足时继续检索。",
)
```

### 8. 适用场景

- **企业知识库问答**：产品手册、制度文档、客服
- **私有数据问答**：内部数据不允许进模型训练的场景
- **事实密集型问答**：法律、医疗、金融（需要可溯源）
- **代码库问答**：GitHub 仓库、API 文档问答

### 9. 生产建议

1. **切分粒度**：500~1000 字符 + 结构切分，测试后定参。
2. 一定加 **rerank**（如 Cohere Rerank、bge-reranker），Top-K 精度提升显著。
3. 答案加**引用**，用户可验证，信任度大增。
4. 检索结果截断控制上下文；检索为空时要让模型诚实说"不知道"。
5. 评测：建测试集（问题-预期来源），量化检索命中率与回答准确率。
---


---

---

## Memory Systems 记忆系统范式详解

> **短期 + 长期分层记忆** —— Agent 的"记性"：对话内短期记忆、跨会话长期记忆、任务工作记忆，让 Agent 越用越懂你。

### 1. 一句话总结

模拟人类记忆分层：**短期记忆**（当前对话上下文，直接放 prompt）、**长期记忆**（跨会话的事实、偏好、历史，存向量库/数据库按需检索）、**工作记忆**（任务中间状态），让 Agent 在长时间、多轮、跨会话场景中保持连贯。

### 2. 核心思想

- **为什么需要**：LLM 上下文窗口有限（即使 200K 也装不下长期积累）；每次对话都是"失忆"的；多轮任务中途崩溃无法恢复。
- **四层记忆模型**（业界共识）：

| 层 | 内容 | 存储 | 访问方式 |
|---|---|---|---|
| 短期记忆 | 当前对话消息 | 上下文窗口 | 全量放 prompt |
| 工作记忆 | 任务中间状态、变量 | 内存/checkpoint | 任务期间读写 |
| 情景记忆 | 历史对话摘要、事件 | 数据库/向量库 | 按需检索 |
| 语义记忆 | 用户偏好、事实、知识 | 向量库/图谱 | 始终加载或按需 |

### 3. 工作原理

```text
用户消息
   │
   ▼
┌─────────────────────────────┐
│ 记忆管理器（Memory Manager） │
│  1. 加载：短期(全量) + 长期(检索) │
│  2. 组装上下文 → LLM           │
│  3. 写入：重要信息提取入库       │
└─────────────────────────────┘
```

关键设计问题：
- **写什么**：哪些信息值得长期保存？（用户偏好 > 闲聊细节）
- **何时写**：每次回答后提取？定期摘要？
- **怎么检索**：按相似度？按时间？按实体？
- **怎么更新**：新旧信息冲突怎么办？（覆盖/合并/保留时间戳）

### 4. 完整示例（LangGraph 分层记忆）

#### 4.1 短期记忆：checkpointer（官方标准做法）

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

checkpointer = MemorySaver()   # 生产用 PostgresSaver/SqliteSaver 持久化

agent = create_react_agent(llm, tools, checkpointer=checkpointer)

# 同一 thread_id = 同一对话（短期记忆自动生效）
agent.invoke(
    {"messages": [("user", "我叫小明，喜欢科幻小说")]},
    config={"configurable": {"thread_id": "user-42"}},
)
agent.invoke(
    {"messages": [("user", "我叫什么？喜欢什么？")]},
    config={"configurable": {"thread_id": "user-42"}},   # 记得！
)
```

#### 4.2 长期记忆：语义记忆（跨会话）

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.tools import tool

# 长期记忆存储：向量库（也可用 langmem 库做自动提取）
long_term_store = Chroma(
    embedding_function=OpenAIEmbeddings(model="text-embedding-3-small"),
    persist_directory="./memory_db",
)

@tool
def remember(fact: str) -> str:
    """记住关于用户的重要事实（写入长期记忆）"""
    long_term_store.add_texts([fact], metadatas=[{"user": "user-42"}])
    return "已记住"

@tool
def recall(query: str) -> str:
    """回忆与用户相关的历史信息（检索长期记忆）"""
    docs = long_term_store.similarity_search(
        query, k=5, filter={"user": "user-42"}
    )
    return "\n".join(d.page_content for d in docs) or "（暂无相关记忆）"

# 带记忆的 Agent：模型会主动"记住"和"回忆"
agent = create_react_agent(
    llm, tools=[remember, recall],
    prompt="""你是私人助手。用户提到重要个人信息时调用 remember 保存；
回答需要历史信息时先调用 recall 回忆。""",
)
```

#### 4.3 完整分层图（LangGraph）

```python
from langgraph.graph import StateGraph, MessagesState, START, END

class MemoryState(MessagesState):
    long_term_context: str

def load_memory(state: MemoryState) -> MemoryState:
    """每次请求前：检索长期记忆并入上下文"""
    if state.get("messages"):
        last_q = state["messages"][-1].content
        state["long_term_context"] = recall.invoke({"query": last_q})
    return state

def extract_memory(state: MemoryState) -> MemoryState:
    """每次回答后：提取值得记住的信息"""
    # 用 LLM 判断并调用 remember 保存
    return state

def respond(state: MemoryState) -> MemoryState:
    prompt = f"""长期记忆（供参考）:
{state.get('long_term_context', '无')}

请回答。"""
    # 组装完整上下文调用 LLM …
    return state

# 构图：load_memory → respond → extract_memory（循环）
```

> 提示：LangChain 官方推出了 **langmem** 库，封装了语义记忆的自动提取与检索，可直接使用。

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 跨会话连贯，体验像"真人" | 记忆管理逻辑复杂（写入/更新/过期） |
| 任务可中断恢复（checkpoint） | 检索噪音会污染回答 |
| 个性化：越用越懂用户 | 隐私问题（敏感信息存储需谨慎） |
| 长期上下文不撑爆窗口 | 记忆写入有成本（每次回答后多一次 LLM 调用） |

### 6. 适用场景

- **私人助手**：记住用户偏好、家庭信息、日程
- **客服系统**：跨会话保留用户历史问题与处理记录
- **长期项目助手**：跨天继续同一项目任务
- **角色扮演/陪伴**：记住剧情与人物关系

### 7. 记忆的三种实现路径

| 方案 | 原理 | 适合 |
|---|---|---|
| **Prompt 注入** | 把记忆直接塞进 prompt | 简单、量小 |
| **摘要压缩** | 定期把历史摘要成要点 | 长对话（成本低） |
| **向量检索** | 存向量库按需检索 | 大量记忆、跨会话（推荐） |
| **知识图谱** | 实体-关系存储 | 强关联、需推理关系 |

### 8. 生产建议

1. **优先级排序**：先做短期（checkpointer，成本最低收益最大），再上长期。
2. 写入控制：设定"值得记忆"的标准（如用户显式偏好、关键事实），避免垃圾入库。
3. 记忆要带**元数据**（时间戳、来源、置信度），冲突时按时间/来源裁决。
4. 定期**清理与去重**：过期记忆、重复记忆影响检索质量。
5. 隐私合规：明确告知用户哪些被记忆、提供"忘记我"能力。

---

---


---

## MemGPT / Letta 范式详解

> **把 LLM 当操作系统** —— 用"内存分页"思想管理上下文：不重要的记忆"写盘"（外部存储），需要时"换入"上下文窗口。突破上下文限制的持久 Agent。

### 1. 一句话总结

像操作系统管理内存一样管理 LLM 的上下文：**上下文窗口 = 内存（RAM）**，**外部存储 = 硬盘**。记忆放不下就"换出"到外部存储，需要时再"换入"——让 Agent 拥有无限记忆、持久生存。

### 2. 核心思想

- **论文**：《MemGPT: Towards LLMs as Operating Systems》(Packer et al., 2023, UC Berkeley)
- **核心类比**：

| 操作系统 | MemGPT |
|---|---|
| RAM（内存） | LLM 上下文窗口 |
| 磁盘（硬盘） | 外部存储（向量库/数据库） |
| 分页（换入换出） | 记忆的写入与检索 |
| 进程调度 | Agent 的事件循环 |
| 系统调用 | 工具调用（memory operations） |

- **关键机制**：
  - **Self-editing memory**：模型自己决定何时把对话历史"写盘"（main context → external context）
  - **事件驱动**：用户消息、工具结果、内部事件触发记忆管理
  - **持久化**：Agent 状态存数据库，进程重启不丢记忆

### 3. 工作原理

```text
主上下文（窗口内，如 8K token）:
  ┌─────────────────────────┐
  │ 系统指令                  │  ← 永远在
  │ 工作记忆（当前任务状态）    │  ← 会话期间
  │ 对话历史（近期，滑动窗口）  │  ← 满了就压缩/换出
  │ 工具调用记录              │
  └─────────────────────────┘
         │ 满了（接近窗口上限）
         ▼
  记忆管理（模型自主决策）:
    - 把早期对话"总结压缩"（core memory in-context）
    - 把详情"写盘"到外部存储（archival storage）
         │
         ▼
  需要历史细节时 → 检索"换入"上下文（recall storage）
```

### 4. 完整示例

#### 4.1 用 LangGraph 模拟 MemGPT 分层（核心机制）

```python
from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

llm = ChatOpenAI(model="gpt-4o", temperature=0.3)
checkpointer = MemorySaver()   # 对话历史持久化（对应"进程不丢"）

# 外部存储（对应"硬盘"）：归档记忆 + 可检索回忆
archive = Chroma(embedding_function=OpenAIEmbeddings(), persist_directory="./memgpt_db")

class MemGPTState(TypedDict):
    messages: List          # 主上下文（窗口内的对话）
    working_memory: str     # 工作记忆（当前任务要点）
    token_estimate: int

def maybe_compact(state: MemGPTState) -> MemGPTState:
    """记忆管理：上下文接近上限时，压缩旧消息并归档"""
    # 简化：消息数超过阈值就触发
    if len(state["messages"]) > 10:
        old = state["messages"][:-6]   # 保留最近 6 条
        # 1. 总结压缩 → 更新工作记忆
        summary = llm.invoke(
            f"总结以下对话要点（供长期记忆）：{old}"
        ).content
        archive.add_texts([summary])
        # 2. 换出：主上下文只留最近消息
        state["messages"] = state["messages"][-6:]
        state["working_memory"] = summary
        print(f"[MemGPT] 已归档 {len(old)} 条旧消息")
    return state

def recall(state: MemGPTState) -> MemGPTState:
    """需要历史时：从外部存储检索换入"""
    if state.get("need_recall"):
        docs = archive.similarity_search(state["need_recall"], k=3)
        recalled = "\n".join(d.page_content for d in docs)
        state["working_memory"] += f"\n[回忆] {recalled}"
    return state

def respond(state: MemGPTState) -> MemGPTState:
    response = llm.invoke([
        SystemMessage(content=f"工作记忆（长期要点）:\n{state['working_memory']}"),
        *state["messages"],
    ])
    state["messages"].append(response)
    return state

# 构图：respond → maybe_compact（循环，checkpointer 保证持久化）
builder = StateGraph(MemGPTState)
builder.add_node("respond", respond)
builder.add_node("compact", maybe_compact)
builder.add_edge(START, "respond")
builder.add_edge("respond", "compact")
builder.add_edge("compact", END)
graph = builder.compile(checkpointer=checkpointer)
```

#### 4.2 直接用 Letta（MemGPT 官方产品）

```bash
# pip install letta
```

```python
from letta import create_client

client = create_client()
agent = client.create_agent(
    name="assistant",
    memory_blocks=[          # 核心记忆（常驻上下文）
        {"label": "persona", "value": "你是贴心助手"},
        {"label": "human", "value": "用户叫小明，喜欢科幻"},
    ],
)

# 多轮对话，记忆自动分层管理
client.send_message(agent_id=agent.id, message="记得我上次说的项目吗？")
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 突破上下文窗口，支持无限对话 | 实现复杂度高（记忆管理逻辑） |
| 模型自主决定记忆换入换出（省 token） | 换出后细节可能丢失（摘要损失） |
| 进程重启不丢记忆（持久化） | 记忆检索错误会导致"记错" |
| 支持"自我编辑记忆"（主动修正记忆） | 生态相对小众（Letta 起步晚） |

### 6. 适用场景

- **长期陪伴型助手**：数周、数月持续对话
- **超长文档对话**：整本书、整个代码库
- **跨会话任务 Agent**：项目持续数周、状态要保留
- **虚拟角色/游戏 NPC**：长期记住玩家关系

### 7. 与普通 Memory 系统的对比

| 维度 | Memory Systems（24 篇） | MemGPT |
|---|---|---|
| 记忆管理决策者 | 开发者设计规则 | **模型自主决策**（self-editing） |
| 上下文压缩 | 手动/定时 | 事件驱动、窗口满自动 |
| 持久化 | 可选 | 内置（checkpointer） |
| 理念 | 分层记忆实践 | 操作系统级抽象 |

> 两者可以融合：MemGPT 是"记忆系统的自动化管理方案"。

### 8. 生产建议

1. **先评估需求**：对话真的需要超过上下文窗口才上 MemGPT，否则普通 checkpointer 足够。
2. 摘要压缩质量是生命线：归档前让 LLM"只保留关键事实与可行动项"。
3. 检索换入时控制数量（Top-3），避免换入内容挤占窗口。
4. 给用户"记忆查看/清除"能力，符合隐私预期。
5. 关注 Letta 生态演进：https://github.com/letta-ai/letta
