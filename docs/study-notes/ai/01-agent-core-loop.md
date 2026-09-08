# Agent 核心循环范式详解（ReAct / Tool Calling / Plan-and-Execute 等）

> **共同点**：都是"**思考 + 行动**"的任务执行循环 —— 模型通过循环调用工具完成任务。这是 Agent 开发最核心的一类范式。
> **包含**：ReAct（及其变体 Act-only、Reflexion、ReWOO）、Tool Calling（ReAct 的生产级实现）、Plan-and-Execute 与 LLM Compiler（先规划再执行）。

## 本文档包含（7 种范式）

| 范式 | 一句话 | 核心机制 |
|---|---|---|
| ReAct | 想一步、做一步、看结果、再想 | Thought/Action/Observation 循环 |
| Act-only | 只做不想，纯工具循环 | 规则驱动工具链 |
| Reflexion | 失败后反思写入记忆，重跑改进 | 循环 + 反思记忆 |
| ReWOO | 先想完所有步骤，再统一执行 | 规划与观察解耦 |
| Tool Calling | 结构化工具调用（生产主流） | 模型输出函数名 + JSON 参数 |
| Plan-and-Execute | 先出完整计划，再逐步执行，可重规划 | Planner + Executor + Re-planner |
| LLM Compiler | 计划当"代码"编译执行，支持分支并行 | 任务图（DAG）调度 |

## 快速选型

- **生产默认** → Tool Calling（ReAct 的结构化实现，最稳定）
- 需要理解 Agent 原理 → 先读 ReAct
- 步骤可预规划、追求省 token → ReWOO
- 失败可重试、追求高成功率 → Reflexion
- 复杂多步任务、需要动态纠错 → Plan-and-Execute
- 多工具并行、有分支逻辑 → LLM Compiler
- 固定流程、追求极低成本 → Act-only

## ReAct 范式详解

### 1. 一句话总结

让大模型在**思考（Thought）**与**行动（Action）**之间循环交替：用推理决定下一步做什么，用工具返回的观察结果（Observation）修正后续推理，直到能给出最终答案。

### 2. 核心思想

- **论文**：《ReAct: Synergizing Reasoning and Acting in Language Models》(Yao et al., 2023, ICLR)
- **背景问题**：纯推理（CoT）无法获取外部信息、容易幻觉；纯行动（Act-only）没有方向、容易跑偏。ReAct 把两者结合，互相增强。
- **三个关键角色**：
  - `Thought`：模型用自然语言输出当前推理（我有什么信息？下一步该做什么？）
  - `Action`：调用一个工具（搜索、查库、跑代码……），工具名 + 参数
  - `Observation`：工具返回的结果，作为下一轮 `Thought` 的输入

### 3. 工作原理（循环流程）

```text
                ┌─────────────────────────────────────┐
                │                                     │
                ▼                                     │
        ┌──────────────┐      ┌──────────────┐        │
        │   Thought    │─────▶│    Action    │        │
        │  （推理）     │      │  （调用工具） │        │
        └──────────────┘      └──────┬───────┘        │
                ▲                    │                │
                │                    ▼                │
        ┌──────────────┐      ┌──────────────┐        │
        │   Answer     │◀─────│ Observation  │────────┘
        │  （最终回答） │      │  （观察结果） │
        └──────────────┘      └──────────────┘
```

循环终止条件：
1. 模型认为信息足够，输出 `Final Answer`
2. 达到最大轮数（`max_iterations`，防死循环）
3. 触发停止词（如 `Observation:`）

### 4. 完整示例（天气问答）

```text
Question: 北京今天适合穿短袖吗？
Thought: 我需要知道北京今天的天气和温度。
Action: get_weather("北京")
Observation: 北京，晴，最高 22°C
Thought: 最高 22°C，比较凉爽，不适合穿短袖。
Action: search("北京 22度 穿衣建议")
Observation: 22°C 建议穿长袖衬衫或薄外套。
Thought: 综合来看不建议穿短袖。
Final Answer: 不适合。今天北京晴，最高 22°C，建议穿长袖或薄外套。
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 推理引导行动，方向感强 | 每轮都要重新读上下文，token 消耗大 |
| 观察结果可即时纠错 | 自由文本输出 Action 解析不稳定（已逐步被 function calling 取代） |
| 每步可见，可解释、易调试 | 容易陷入循环或跑题，需要硬性轮数上限 |
| 无需训练，纯提示词 + 工具即可 | 工具多时选错工具的概率上升 |

### 6. 适用场景

- 多步信息获取型问答（如"帮我调研 XX 并写报告"）
- 工具链不固定的开放任务
- 需要可解释、可审计流程的场景

### 7. LangChain 实现

LangChain 提供两种方式：

#### 7.1 方式一：`create_react_agent`（推荐，基于 prompt 模板的经典 ReAct）

```python
from langchain.agents import create_react_agent, AgentExecutor
from langchain_core.prompts import PromptTemplate
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

# ── 1. 定义工具 ──────────────────────────────────────────
@tool
def get_weather(city: str) -> str:
    """获取指定城市的实时天气。参数：城市名（中文）。"""
    # 这里换成真实天气 API
    return f"{city}：晴，最高 22°C"

@tool
def web_search(query: str) -> str:
    """网络搜索，返回前几条结果摘要。"""
    return f"关于'{query}'的搜索结果：穿衣指数 3 级，建议长袖。"

# ── 2. 定义 LLM ─────────────────────────────────────────
llm = ChatOpenAI(model="gpt-4o", temperature=0)

# ── 3. 定义 ReAct 提示词模板（框架的标准模板） ────────────
prompt = PromptTemplate.from_template(
    """Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action, must be a valid JSON object
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought: {agent_scratchpad}"""
)

# ── 4. 组装 Agent 并执行 ─────────────────────────────────
tools = [get_weather, web_search]
agent = create_react_agent(llm=llm, tools=tools, prompt=prompt)
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    max_iterations=5,        # 防止死循环
    handle_parsing_errors=True,  # Action 输出解析失败时自动修正
    verbose=True,            # 打印 Thought/Action/Observation 过程
)

result = executor.invoke({"input": "北京今天适合穿短袖吗？"})
print(result["output"])
```

#### 7.2 方式二：`AgentExecutor` 旧式 `initialize_agent`（早期写法，了解即可）

```python
from langchain.agents import initialize_agent, AgentType

executor = initialize_agent(
    tools=tools,
    llm=llm,
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,  # 零样本 ReAct
    max_iterations=5,
    verbose=True,
)
```

> 注意：`initialize_agent` 在新版 langchain 已标记弃用，新项目建议用 `create_react_agent`。

### 8. LangGraph 实现

LangGraph 是 LangChain 官方推荐的 agent 编排框架，ReAct 循环被封装为 `create_react_agent`，也可手写循环图：

#### 8.1 开箱即用（prebuilt）

```python
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver

llm = ChatOpenAI(model="gpt-4o")
tools = [get_weather, web_search]

agent = create_react_agent(
    llm=llm,
    tools=tools,
    checkpointer=MemorySaver(),   # 支持多轮对话记忆（按 thread_id 隔离）
)

# 单轮执行
result = agent.invoke(
    {"messages": [{"role": "user", "content": "北京今天适合穿短袖吗？"}]},
    config={"configurable": {"thread_id": "conversation-1"}},
)
print(result["messages"][-1].content)
```

#### 8.2 手写 ReAct 图（理解底层机制）

```python
from typing import Literal
from langgraph.graph import StateGraph, MessagesState, START, END
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.prebuilt import ToolNode, tools_condition

class AgentState(MessagesState):
    pass  # 直接复用 messages 状态

def call_model(state: AgentState):
    """Thought：模型决定是调工具还是回答"""
    messages = [SystemMessage(
        "You are a helpful assistant. 需要信息时调用工具，信息足够后直接回答。"
    )] + state["messages"]
    response = llm.bind_tools(tools).invoke(messages)
    return {"messages": [response]}

# 构建图：模型节点 ↔ 工具节点 循环
builder = StateGraph(AgentState)
builder.add_node("agent", call_model)
builder.add_node("tools", ToolNode(tools))
builder.add_edge(START, "agent")
builder.add_conditional_edges(
    "agent",
    tools_condition,          # 模型要调工具 → "tools"，否则 → END
    {"tools": "tools", END: END},
)
builder.add_edge("tools", "agent")   # 工具结果回到模型，形成循环
graph = builder.compile()

# 执行
result = graph.invoke({
    "messages": [HumanMessage(content="北京今天适合穿短袖吗？")]
})
for msg in result["messages"]:
    print(f"{msg.type}: {msg.content}")
```

### 9. 与其他范式的关系

| 对比对象 | 区别 |
|---|---|
| **CoT** | CoT 只思考不行动；ReAct = CoT + 工具调用 |
| **Act-only** | Act-only 只行动不思考；ReAct 多了 Thought 引导 |
| **Plan-and-Execute** | 先整体规划再执行；ReAct 边走边看、动态调整 |
| **ReWOO** | 先想完所有 Action 再统一执行；ReAct 边想边做 |
| **Reflexion** | ReAct + 失败后反思记忆，跨任务改进 |
| **Tool Calling** | 结构化 Action（函数名+JSON），是 ReAct 的生产级改良 |

### 10. 生产建议

1. **默认用 Tool Calling 而非自由文本 ReAct**：解析更稳定、支持多工具并行。
2. 必须设置 `max_iterations`（一般 5~10），防止 token 烧穿。
3. `handle_parsing_errors=True`：模型输出非法 Action 时让 LLM 自行修正。
4. 工具描述（docstring）要写清楚"何时用、参数含义"，模型选工具全靠它。
5. 加 checkpointer 支持多轮对话，避免每次从零开始。

---

## Act-only 范式详解

### 1. 一句话总结

不输出 Thought，直接根据输入调用工具，靠工具结果决定下一步动作，直到任务完成。ReAct 家族中最省 token 的极端形态。

### 2. 核心思想

- ReAct 的循环是 `Thought → Action → Observation`，Act-only 把 `Thought` 去掉，变成：
  `Action → Observation → Action → Observation → …`
- 决策依据不再是"模型推理"，而是**固定的规则或程序逻辑**：比如"观察结果里含有关键词 X 就执行工具 Y"。
- 本质上是**状态机 / 工作流**，而非模型自主推理。

### 3. 工作原理

```text
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Action  │──▶│Observation│──▶│ Action  │──▶ ……
│（调工具）│   │（看结果） │   │（调工具） │
└─────────┘   └─────────┘   └─────────┘
      ▲                           │
      └────── 条件满足则终止 ──────┘
```

两种常见实现：
1. **规则驱动**：代码里写死 if/else 判断，模型不参与中间决策
2. **模型弱参与**：模型只输出"下一个工具名 + 参数"，不做任何解释性推理

### 4. 完整示例（网页抓取流水线）

```python
from langchain_core.tools import tool

@tool
def fetch_page(url: str) -> str:
    """抓取网页 HTML 内容"""
    return f"<html>...{url} 的原始内容...</html>"

@tool
def extract_titles(html: str) -> str:
    """从 HTML 中提取所有标题"""
    return "标题1: 苹果发布新款手机\n标题2: 发布会时间确定"

@tool
def save_markdown(content: str) -> str:
    """把内容保存为 markdown 文件"""
    return "已保存到 output.md"

# ── 规则驱动的 Act-only 流程 ─────────────────────────────
def crawl_and_extract(url: str):
    html = fetch_page.invoke({"url": url})            # Action 1
    if "<html>" not in html:                          # 规则判断
        return "页面抓取失败"
    titles = extract_titles.invoke({"html": html})    # Action 2
    result = save_markdown.invoke({"content": titles})  # Action 3
    return result

print(crawl_and_extract("https://example.com/news"))
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| token 消耗极低，速度最快 | 没有推理引导，容易执行无关操作 |
| 行为完全可预测、可测试 | 灵活性差，流程变化需要改代码 |
| 成本可控（无模型调用也能跑） | 无法处理意外情况（观察结果异常时不知变通） |
| 便于审计（每一步都是确定的） | 工具链一旦出错没有自愈能力 |

### 6. 适用场景

- **固定流程**：爬虫流水线、ETL 数据管道、定时任务
- **高并发低延迟**：每步都要毫秒级响应的场景
- **合规审计**：不允许模型自由发挥、必须严格按流程执行的场景（如金融交易）
- 作为更大 Agent 的**叶子节点**：复杂任务的最后几步往往是固定动作

### 7. LangChain / LangGraph 实现

#### 7.1 LangChain：纯工具链调用（无 Agent）

```python
from langchain_core.tools import tool
from langchain_core.runnables import RunnableLambda

@tool
def step1(x: str) -> str:
    """第一步：清洗数据"""
    return x.strip().upper()

@tool
def step2(x: str) -> str:
    """第二步：格式化"""
    return f"[{x}]"

@tool
def step3(x: str) -> str:
    """第三步：落库"""
    return f"已写入数据库: {x}"

# 用 Runnable 把工具串成固定管道
pipeline = (
    step1
    | RunnableLambda(lambda r: r["output"] if isinstance(r, dict) else r)
    | step2
    | step3
)
result = pipeline.invoke("  hello world ")
print(result)  # 已写入数据库: [HELLO WORLD]
```

#### 7.2 LangGraph：状态机式固定流程

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Literal

class State(TypedDict):
    url: str
    html: str
    titles: str

def fetch(state: State) -> State:
    state["html"] = fetch_page.invoke({"url": state["url"]})
    return state

def extract(state: State) -> State:
    state["titles"] = extract_titles.invoke({"html": state["html"]})
    return state

def check(state: State) -> Literal["extract", "fail"]:
    """规则判断：没有 html 就走失败分支"""
    return "extract" if "<html>" in state["html"] else "fail"

def fail(state: State) -> State:
    state["titles"] = "抓取失败"
    return state

g = StateGraph(State)
g.add_node("fetch", fetch)
g.add_node("extract", extract)
g.add_node("fail", fail)
g.add_edge(START, "fetch")
g.add_conditional_edges("fetch", check, {"extract": "extract", "fail": "fail"})
g.add_edge("extract", END)
g.add_edge("fail", END)
graph = g.compile()

print(graph.invoke({"url": "https://example.com/news"}))
```

### 8. 与 ReAct 的对比

| 维度 | ReAct | Act-only |
|---|---|---|
| Thought | 每轮都有 | 没有 |
| 决策者 | 模型 | 规则 / 代码 |
| token 成本 | 高 | 极低 |
| 灵活性 | 高 | 低 |
| 可预测性 | 低 | 高 |
| 适用任务 | 开放、不确定 | 固定、确定 |

### 9. 生产建议

1. **不要用 LLM 实现 Act-only**：既然不需要推理，直接用代码写流程更便宜可靠。
2. 在 LangGraph 里用**条件边**（conditional edges）实现规则分支，比提示词约束可靠得多。
3. 混合使用：外层 ReAct 做决策，叶子节点用固定工具链 —— 这是最常见的生产架构。
4. 每个工具加超时与重试，纯流程没有模型兜底，容错要靠代码。


---

## Reflexion 范式详解

### 1. 一句话总结

用 ReAct 执行任务；任务失败时，让模型用自然语言总结"哪里错了、下次怎么做"，把反思写入记忆；带着记忆重新执行，逐轮提升成功率 —— 相当于模型的"错题本"。

### 2. 核心思想

- **论文**：《Reflexion: Language Agents with Verbal Reinforcement Learning》(Shinn et al., 2023, NeurIPS)
- **核心洞察**：模型不需要重新训练也能"学习"—— 把失败经验以**语言形式**存下来（verbal reinforcement learning），下次执行时读入上下文。
- **四个组件**：
  1. **Actor**：执行任务的 ReAct agent
  2. **Evaluator**：评估任务结果好坏（规则、测试用例或另一个 LLM）
  3. **Self-Reflection**：失败时生成反思文本（失败原因 + 改进策略）
  4. **Memory**：存储反思，供下次尝试使用

### 3. 工作原理（循环流程）

```text
开始新任务
   │
   ▼
┌────────────────────┐
│  Actor（ReAct 执行） │◀─────────────┐
└────────┬───────────┘               │
         ▼                           │
┌────────────────────┐    失败并产生反思后，
│  Evaluator 评估     │    反思写入 Memory，
└────────┬───────────┘    下一次尝试时读入
         ▼
    通过？──否──▶ Self-Reflection（生成反思）
     │
    是
     ▼
  输出结果
```

反思文本示例（代码生成任务）：

```text
上一次尝试失败的反思：
1. 我错误地假设了输入参数总是非空，但测试用例传入了 None。
2. 下次应先检查 None 再访问属性，并补充边界测试。
```

### 4. 完整示例（LangGraph 实现：代码修复 agent）

```python
from typing import TypedDict, Literal
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

llm = ChatOpenAI(model="gpt-4o", temperature=0)

@tool
def run_tests(code: str) -> str:
    """在沙箱中执行代码并运行测试，返回通过/失败及报错信息"""
    # 实际项目中接入 pytest / 沙箱执行
    if "def add" in code and "return a + b" in code:
        return "✅ 全部测试通过"
    return "❌ 测试失败: AttributeError: 'NoneType' object has no attribute 'x'"

class ReflexionState(TypedDict):
    task: str            # 任务描述
    code: str            # 当前代码
    reflection: str      # 反思文本（跨轮记忆）
    attempts: int        # 尝试次数

def generate(state: ReflexionState) -> ReflexionState:
    """Actor：生成/修改代码（带反思上下文）"""
    messages = [SystemMessage(
        f"你是资深工程师。之前尝试的反思：\n{state.get('reflection', '无')}\n\n"
        f"请完成任务：{state['task']}\n只输出代码。"
    )]
    state["code"] = llm.invoke(messages).content
    return state

def evaluate(state: ReflexionState) -> ReflexionState:
    """Evaluator：运行测试"""
    state["test_result"] = run_tests.invoke({"code": state["code"]})
    return state

def reflect(state: ReflexionState) -> ReflexionState:
    """Self-Reflection：根据测试失败生成反思，写入记忆"""
    messages = [SystemMessage(
        "分析以下测试失败原因，输出简洁的改进建议（供下次重试使用）："
    ), HumanMessage(f"代码:\n{state['code']}\n\n测试结果:\n{state['test_result']}")]
    state["reflection"] = llm.invoke(messages).content
    return state

def should_retry(state: ReflexionState) -> Literal["pass", "retry"]:
    if "通过" in state.get("test_result", ""):
        return "pass"
    if state["attempts"] >= 3:   # 最多重试 3 次
        return "pass"
    return "retry"

# 构图
builder = StateGraph(ReflexionState)
builder.add_node("generate", generate)
builder.add_node("evaluate", evaluate)
builder.add_node("reflect", reflect)
builder.add_edge(START, "generate")
builder.add_edge("generate", "evaluate")
builder.add_conditional_edges(
    "evaluate",
    should_retry,
    {"pass": END, "retry": "reflect"},
)
builder.add_edge("reflect", "generate")   # 反思后带着记忆重新生成
graph = builder.compile()

# 执行
result = graph.invoke({
    "task": "写一个 add 函数，输入 a, b，返回 a + b",
    "code": "",
    "reflection": "",
    "attempts": 0,
})
print("最终代码:", result["code"])
print("反思记录:", result["reflection"])
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 不重新训练即可提升成功率（语言即梯度） | 多次重跑，token 成本成倍增加 |
| 反思可读、可审计、可复用 | 反思质量依赖模型自我批判能力 |
| 适合可反复试错的场景（代码、数学、问答） | 单次任务响应时间变长 |
| 与 RAG、function calling 正交，可叠加 | 对"一次机会"的任务（如下单）不适用 |

### 6. 适用场景

- **代码生成 / 修复**：跑测试 → 看报错 → 反思 → 重写（最经典用法）
- **数学推理**：答案错误时反思解题步骤
- **问答系统**：检索不到答案时反思检索策略
- **Agent 任务优化**：工具调用失败后反思"为什么选错工具"

### 7. 框架实现

#### 7.1 LangGraph 官方示例

LangGraph 仓库内置了 Reflexion 示例（`examples/reflexion/`），结构与本篇第 4 节一致：
`generate → evaluate → (fail) → reflect → generate …`，并支持：

```python
# 用 checkpointer 保存反思到持久化存储，跨会话复用
from langgraph.checkpoint.memory import MemorySaver
graph = builder.compile(checkpointer=MemorySaver())
```

#### 7.2 用 LangChain 简化版（循环在代码里）

```python
from langchain.agents import create_react_agent, AgentExecutor

agent = create_react_agent(llm, [run_tests], prompt)
executor = AgentExecutor(agent=agent, tools=[run_tests], max_iterations=5)

reflection = ""
for attempt in range(3):
    result = executor.invoke({"input": f"任务: {task}\n之前的反思: {reflection}"})
    if "通过" in result["output"]:
        print("成功:", result["output"])
        break
    # 让模型反思失败
    reflection = llm.invoke(f"根据失败{result['output']}，给出改进建议").content
```

### 8. 与相似范式的对比

| 范式 | 批判时机 | 记忆 | 改进方式 |
|---|---|---|---|
| **Reflexion** | 整个任务失败后 | 跨轮持久记忆 | 带反思重跑整个任务 |
| **Self-Refine** | 每轮生成后立即批判 | 无 | 单轮内迭代修正 |
| **CRITIC** | 生成后用外部工具验证 | 无 | 按验证结果修正 |
| **ReAct** | 无（边做边看） | 无 | 靠 Observation 即时调整 |

### 9. 生产建议

1. **Evaluator 尽量用规则/测试，不要用 LLM 评判**：客观、便宜、不漂移。
2. 反思要**具体**："第 3 行访问了 None 属性"比"代码有 bug"有用 10 倍——可在提示词里要求模型引用具体行号和报错。
3. 限制重试次数（2~4 次），防止 token 失控。
4. 反思存入数据库（SQLite/向量库），跨用户、跨会话复用"团队错题本"。

---

## ReWOO 范式详解

### 1. 一句话总结

ReAct 是"边想边做"；ReWOO 改成"**先想完，再一起做**"：模型第一轮只输出完整工具调用计划（不依赖任何工具结果），然后所有工具并行/顺序执行，最后把全部结果一次性交给模型总结 —— 省 token、可并行。

### 2. 核心思想

- **论文**：《ReWOO: Decoupling Reasoning from Observations for Efficient Augmented Language Models》(Xu et al., 2023)
- **痛点**：ReAct 每轮都要把整个历史上下文重新发送给模型（token 随轮数线性增长）；且工具调用串行，慢。
- **解决方案**：把推理（Planner）与执行（Solver）分离：
  - **Planner**：生成包含工具调用的计划，用 `#E1、#E2` 等占位符引用后续观察结果
  - **Worker**：执行计划中的所有工具（可并行）
  - **Solver**：接收"计划 + 全部观察结果"后生成最终答案

### 3. 工作原理

```text
┌───────────┐    计划(带占位符)     ┌───────────┐
│  Planner  │─────────────────────▶│  Worker   │
│  (推理规划) │                      │ (执行工具) │
└───────────┘                      └─────┬─────┘
     ▲                                   │ 观察结果
     │           计划 + 全部观察          ▼
     └──────────────────────┐    ┌───────────┐
                            │    │  Solver   │
                            └────│ (汇总回答) │
                                 └───────────┘
```

Planner 输出示例：

```text
Plan: 用户想知道"苹果公司 2024 年营收是否增长"
#E1 = search("苹果公司 2024 年营收")
#E2 = search("苹果公司 2023 年营收")
#E3 = compare(#E1, #E2)   ← 若工具支持，也可带计算
最终根据 #E1 和 #E2 对比得出结论。
```

Worker 执行完 `#E1`、`#E2` 后，Solver 收到的输入是：

```text
Plan:
#E1 = search("苹果公司 2024 年营收")
#E2 = search("苹果公司 2023 年营收")
#E1: 2024 年营收 3910 亿美元
#E2: 2023 年营收 3833 亿美元
→ 请基于以上信息回答：2024 年营收同比增长约 2%，实现了增长。
```

### 4. 完整示例（LangGraph 官方 ReWOO 模式）

```python
from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
import re

llm = ChatOpenAI(model="gpt-4o", temperature=0)

@tool
def web_search(query: str) -> str:
    """网络搜索，返回结果摘要"""
    return f"【{query}】的搜索结果: 苹果2024年营收3910亿美元"

class ReWOOState(TypedDict):
    task: str
    plan: str                  # Planner 输出的计划
    steps: List[str]           # 解析出的工具调用步骤，如 ["#E1 = search(...)"]
    observations: dict         # {占位符: 观察结果}

PLANNER_PROMPT = """你是规划者。为任务制定工具调用计划，使用 #E1、#E2… 占位符引用结果。
只输出计划，格式：
Plan:
#E1 = tool_name(参数)
...
任务: {task}"""

def planner(state: ReWOOState) -> ReWOOState:
    state["plan"] = llm.invoke(PLANNER_PROMPT.format(task=state["task"])).content
    # 用正则解析出所有工具调用步骤
    state["steps"] = re.findall(r"#E\d+ = \w+\(.*?\)", state["plan"])
    return state

def worker(state: ReWOOState) -> ReWOOState:
    """执行计划中的全部工具调用（真实项目可并行化，如 ThreadPoolExecutor）"""
    observations = {}
    for step in state["steps"]:
        match = re.match(r"(#E\d+) = (\w+)\((.*?)\)", step)
        placeholder, tool_name, arg = match.groups()
        # 根据工具名分发执行
        observations[placeholder] = web_search.invoke({"query": arg})
    state["observations"] = observations
    return state

def solver(state: ReWOOState) -> ReWOOState:
    context = state["plan"] + "\n"
    for k, v in state["observations"].items():
        context += f"{k}: {v}\n"
    answer = llm.invoke(
        f"基于以下计划与观察结果回答任务。\n{context}\n任务: {state['task']}"
    ).content
    return {"answer": answer}   # 通过 state 传出（示例简化）

# 构图：planner → worker → solver（无循环！）
builder = StateGraph(ReWOOState)
builder.add_node("planner", planner)
builder.add_node("worker", worker)
builder.add_node("solver", solver)
builder.add_edge(START, "planner")
builder.add_edge("planner", "worker")
builder.add_edge("worker", "solver")
builder.add_edge("solver", END)
graph = builder.compile()

result = graph.invoke({
    "task": "苹果公司 2024 年营收相比 2023 年是否增长？",
    "steps": [],
    "observations": {},
})
print(result["answer"])
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 省 token：观察结果只在最后一轮进上下文 | 计划一旦生成无法根据观察结果中途调整 |
| 工具可并行执行，延迟大幅下降 | 对模型规划能力要求高，规划错则全错 |
| 无循环，天然不会死循环 | 无法处理"需要根据上一步结果决定下一步"的动态任务 |
| 结构清晰，每个环节可独立测试 | 占位符解析需要正则/代码，多一层复杂度 |

### 6. 适用场景

- **调研类任务**：步骤可预先列全（搜索 A、搜索 B、对比）
- **多工具并行**：同时查天气、查航班、查酒店再综合
- **成本敏感**：token 预算紧张但工具调用多的场景
- **延迟敏感**：工具本身慢（如网页抓取），并行能显著加速

### 7. 与 ReAct / Plan-and-Execute 的对比

| 维度 | ReAct | ReWOO | Plan-and-Execute |
|---|---|---|---|
| 规划时机 | 边做边想 | 一次性规划完 | 先规划，执行中可重规划 |
| 观察反馈 | 每步都有 | 没有（规划后统一执行） | 有（可 Re-plan） |
| 并行 | 否 | 是 | 是 |
| token 效率 | 低 | 高 | 中 |
| 动态纠错 | 强 | 无 | 中 |

### 8. 生产建议

1. **工具无依赖关系时才用 ReWOO**；若后一步依赖前一步结果，用 ReAct 或 Plan-and-Execute。
2. 并行执行用 `ThreadPoolExecutor` 或 `asyncio.gather`，收益最大。
3. 计划解析用正则时，提示词里严格规定格式（每行一个 `#E\d+ = 工具(参数)`）。
4. 混合架构：ReWOO 做主体 + 某一步内部用 ReAct 处理动态子任务。


---

## Plan-and-Execute 范式详解

### 1. 一句话总结

模型先为整个任务制定**完整计划**（Plan），然后逐条执行计划中的步骤（每步可调用工具），执行过程中可以**重新规划**（Re-plan）修正方向。

### 2. 核心思想

- **来源**：由 ReAct 演化而来，LangChain 在其文档中提出了 `Plan-and-Execute` agent 设计，并总结出与 ReAct 的权衡。
- **核心组件**：
  1. **Planner（规划器）**：接收任务 → 输出结构化步骤列表
  2. **Executor（执行器）**：每次只执行"下一步"，可以是普通 LLM + 工具（即一个 ReAct/Tool-Calling agent）
  3. **Re-planner（重规划器）**：每步执行后判断：继续按计划？还是需要修改计划？

### 3. 工作原理

```text
        ┌──────────────────────────────┐
        │  Planner：输出完整步骤列表     │
        │  1. 搜索"深度学习发展史"      │
        │  2. 提取 3 个关键里程碑      │
        │  3. 生成 500 字总结          │
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │  Executor：执行下一步         │
        │  （内部可以是 ReAct agent）   │
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │  Re-planner：检查结果         │
        │  ├─ 计划正确 → 执行下一步     │
        │  └─ 计划有问题 → 重新规划     │
        └──────────────┬───────────────┘
                       ▼
              所有步骤完成 → 输出最终答案
```

### 4. 完整示例

#### 4.1 LangChain（官方 `PlanAndExecute`，来自 langchain-experimental）

```python
from langchain_experimental.plan_and_execute import (
    PlanAndExecute,
    load_agent_executor,
    load_chat_planner,
)
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def web_search(query: str) -> str:
    """网络搜索，返回结果摘要"""
    return f"【{query}】的搜索结果: 深度学习里程碑包括 AlexNet(2012)、Transformer(2017)…"

tools = [web_search]
llm = ChatOpenAI(model="gpt-4o", temperature=0)

planner = load_chat_planner(llm)              # 规划器（基于 ChatPromptTemplate）
executor = load_agent_executor(llm, tools)    # 执行器（内部是 ReAct agent）

agent = PlanAndExecute(
    planner=planner,
    executor=executor,
    verbose=True,
    max_iterations=6,          # 防止死循环（重规划次数上限）
)

result = agent.invoke({
    "input": "写一篇关于深度学习发展史的 500 字总结，包含 3 个关键里程碑"
})
print(result["output"])
```

> 注：`langchain-experimental` 的 PlanAndExecute 已不再积极维护，生产建议用 LangGraph 手写（见 4.2），逻辑完全可控。

#### 4.2 LangGraph（手写 Planner → Executor → Re-planner 循环）

```python
from typing import TypedDict, Literal, List
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

llm = ChatOpenAI(model="gpt-4o", temperature=0)

@tool
def web_search(query: str) -> str:
    """网络搜索，返回结果摘要"""
    return f"【{query}】的搜索结果摘要……"

tools = [web_search]

class PlanState(TypedDict):
    task: str
    steps: List[str]        # 计划步骤列表
    current_step: int
    results: List[str]
    messages: list          # 执行器消息

PLANNER_PROMPT = """为任务制定不超过 5 步的执行计划，每步一行，用数字编号。
要求：步骤具体、可执行、每步能独立完成。
任务: {task}"""

def planner(state: PlanState) -> PlanState:
    plan_text = llm.invoke(PLANNER_PROMPT.format(task=state["task"])).content
    steps = [line.strip() for line in plan_text.splitlines() if line.strip()[:1].isdigit()]
    state["steps"] = steps
    state["current_step"] = 0
    state["results"] = []
    return state

def executor_node(state: PlanState) -> PlanState:
    """执行当前步骤：用带工具的 agent 执行一步"""
    step = state["steps"][state["current_step"]]
    # 这里用一个内嵌的 ReAct agent（简化写法）
    from langgraph.prebuilt import create_react_agent
    react = create_react_agent(llm, tools)
    out = react.invoke({"messages": [HumanMessage(content=f"执行这一步: {step}")]})
    state["results"].append(out["messages"][-1].content)
    state["current_step"] += 1
    return state

def replanner(state: PlanState) -> PlanState:
    """每步之后检查：继续执行 / 重新规划 / 完成"""
    # 简化：直接判断是否还有未执行步骤（真实场景可让 LLM 判断是否要改计划）
    return state

def route(state: PlanState) -> Literal["executor", "finish", "planner"]:
    if state["current_step"] < len(state["steps"]):
        return "executor"
    return "finish"

def finish(state: PlanState) -> PlanState:
    """汇总所有步骤结果生成最终答案"""
    context = "\n".join(f"步骤{i+1}: {r}" for i, r in enumerate(state["results"]))
    state["answer"] = llm.invoke(
        f"根据以下各步骤结果，完成最终任务：{state['task']}\n{context}"
    ).content
    return state

# 构图：planner → (executor → replanner → 条件路由) → finish
builder = StateGraph(PlanState)
builder.add_node("planner", planner)
builder.add_node("executor", executor_node)
builder.add_node("finish", finish)
builder.add_edge(START, "planner")
builder.add_edge("planner", "executor")
builder.add_conditional_edges(
    "executor",
    route,
    {"executor": "executor", "finish": "finish"},   # 循环执行直到步骤耗尽
)
builder.add_edge("finish", END)
graph = builder.compile()

result = graph.invoke({
    "task": "写一篇关于深度学习发展史的 500 字总结，包含 3 个关键里程碑",
    "steps": [],
    "current_step": 0,
    "results": [],
})
print(result["answer"])
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 有全局视野，步骤清晰，不易迷失 | 计划错误时中途纠正成本高 |
| 比 ReAct 省 token（不每步重新思考全局） | 对模型规划能力要求高 |
| 每步独立，天然支持并行与进度展示 | 步骤粒度不好把握（太粗执行不了，太细 token 多） |
| 用户体验好（可以看到"进行到第几步"） | 需要额外设计 Re-plan 逻辑 |

### 6. 适用场景

- **研究报告**：调研 → 分析 → 写作，步骤可预知
- **数据处理流水线**：抓取 → 清洗 → 分析 → 出图
- **内容生产**：选题 → 大纲 → 初稿 → 润色
- **面向用户的长时间任务**：需要展示进度条、步骤状态

### 7. 与 ReAct / ReWOO 的对比

| 维度 | ReAct | ReWOO | Plan-and-Execute |
|---|---|---|---|
| 规划 | 无（边走边想） | 一次性规划 | 先规划 + 可重规划 |
| 观察反馈 | 每步 | 无 | 每步有，且能触发重规划 |
| 动态纠错 | 强 | 无 | 中（靠 Re-planner） |
| token 效率 | 低 | 高 | 中 |
| 并行 | 否 | 是 | 步骤独立时可并行 |

### 8. 生产建议

1. **Planner 提示词要限定步骤数量上限**（如 3~5 步），步骤太多会失控。
2. Executor 内部建议用 Tool Calling agent 而不是自由文本 ReAct，更稳定。
3. Re-planner 是灵魂：每步执行后让 LLM 回答"当前结果与计划预期是否一致？要不要改计划？"——动态修正 ReWOO 的弱点。
4. 用 LangGraph 的 `checkpointer` 保存计划状态，长任务中断后可恢复。
5. 步骤之间无依赖时并行执行，用 `send()` API 或并行分支。

---

## LLM Compiler 范式详解

> **把计划当程序"编译"执行** —— 模型输出带控制流（并行、条件、循环）的任务图，像编译器一样高效调度执行。

### 1. 一句话总结

让模型把任务写成"伪代码"（含并行调用、条件分支、依赖关系），然后由执行引擎像编译器一样调度工具调用 —— 比线性计划（ReWOO/Plan-and-Execute）更高效，支持并行与条件逻辑。

### 2. 核心思想

- **论文**：《An LLM Compiler for Parallel Function Calling》(Kim et al., 2023, Google)
- **痛点**：ReWOO 的计划是**线性列表**，无法表达"这两个工具可以并行""如果 A 失败就执行 B"。
- **解决方案**：模型输出一个**任务图（task DAG）**，每个节点是一次函数调用，边表示依赖关系；执行引擎解析图后**并行执行无依赖的节点**，条件分支按结果动态选择。
- **两个组件**：
  1. **LLM Planner**：输出任务图（JSON 格式：任务 id、工具、参数、依赖、条件）
  2. **Task Executor**：编译并执行任务图（拓扑排序、并行调度、条件分发）

### 3. 工作原理

```text
模型输出的任务图（JSON）:

[{"id": 0, "tool": "search", "args": {"q": "北京天气"}},
 {"id": 1, "tool": "search", "args": {"q": "北京航班"}},
 {"id": 2, "tool": "search", "args": {"q": "北京酒店"}},
 {"id": 3, "tool": "compare", "args": {"deps": [0, 1, 2]},
  "condition": "若天气为雨则建议室内活动"}]

执行器调度:
  步骤1: 并行执行 任务0、1、2   （无依赖）
  步骤2: 用 0,1,2 的结果执行 任务3
  步骤3: 汇总最终答案
```

### 4. 完整示例（LangGraph 实现任务图执行器）

```python
import json
from typing import TypedDict, List, Dict
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

llm = ChatOpenAI(model="gpt-4o", temperature=0)

@tool
def search(query: str) -> str:
    """搜索"""
    return f"{query} 的结果: 晴，25°C；有航班；有酒店"

@tool
def compare(a: str, b: str, c: str) -> str:
    """综合比较三个结果"""
    return f"综合建议: {a} 天气良好，推荐出行"

TOOLS = {"search": search, "compare": compare}

class CompilerState(TypedDict):
    task: str
    plan: List[Dict]        # 任务图
    results: Dict[int, str] # {任务id: 结果}
    finished: set

PLANNER_PROMPT = """你是任务规划器。把任务拆成函数调用图，输出 JSON 数组。
每个任务: {{"id": 数字, "tool": 工具名, "args": 参数, "deps": [依赖的任务id]}}
要求：无依赖的任务尽量拆开（可并行）；需要条件判断时在 args 中说明。
可用工具: search, compare
任务: {task}"""

def planner(state: CompilerState) -> CompilerState:
    text = llm.invoke(PLANNER_PROMPT.format(task=state["task"])).content
    # 提取 JSON 数组（生产环境用 JSON parser + 修正）
    start, end = text.find("["), text.rfind("]")
    state["plan"] = json.loads(text[start:end+1])
    state["results"], state["finished"] = {}, set()
    return state

def execute_pending(state: CompilerState) -> CompilerState:
    """执行所有依赖已满足的任务（可并行；此处用循环模拟）"""
    while len(state["finished"]) < len(state["plan"]):
        progress = False
        for task in state["plan"]:
            tid = task["id"]
            if tid in state["finished"]:
                continue
            deps = task.get("deps", [])
            if all(d in state["finished"] for d in deps):
                # 用前序结果替换 deps 占位
                args = dict(task["args"])
                for d in deps:
                    args[f"dep_{d}"] = state["results"][d]
                state["results"][tid] = TOOLS[task["tool"]].invoke(args)
                state["finished"].add(tid)
                progress = True
        if not progress:  # 循环依赖保护
            break
    return state

def finalize(state: CompilerState) -> CompilerState:
    context = "\n".join(state["results"].values())
    state["answer"] = llm.invoke(
        f"根据以下工具结果回答任务：{state['task']}\n{context}"
    ).content
    return state

builder = StateGraph(CompilerState)
builder.add_node("planner", planner)
builder.add_node("execute", execute_pending)
builder.add_node("finalize", finalize)
builder.add_edge(START, "planner")
builder.add_edge("planner", "execute")
builder.add_edge("execute", "finalize")
builder.add_edge("finalize", END)
graph = builder.compile()

result = graph.invoke({
    "task": "查一下北京明天的天气、航班和酒店，并给出出行建议"
})
print(result["answer"])
```

> 提示：LangGraph 中"真正的并行"可以用 `Send` API 为每个就绪任务创建并行分支；上述循环模拟是为了让逻辑更直观。

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 无依赖任务自动并行，延迟显著降低 | 模型生成任务图的 JSON 可能不合法（需要解析容错） |
| 支持条件分支、循环等控制流 | 循环依赖/死锁需要执行器防护 |
| 调用次数与延迟可预测（类似编译期优化） | 相比简单 ReAct 实现复杂 |
| 论文实验：调用次数减少约 20%，延迟减少约 43% | 不适合高度动态、依赖链深的开放任务 |

### 6. 适用场景

- **多工具并行查询**：同时查多个 API 再综合（机票比价、信息聚合）
- **有分支逻辑的流程**："若检索到 X 则…，否则…"
- **成本与延迟双敏感的生产服务**：需要最大并行度的场景

### 7. 与 ReWOO / Plan-and-Execute 的对比

| 维度 | ReWOO | Plan-and-Execute | LLM Compiler |
|---|---|---|---|
| 计划结构 | 线性列表 | 线性列表 | **图（DAG）** |
| 并行 | 可并行但靠外部实现 | 可并行 | **原生表达并行** |
| 条件分支 | 无 | 靠 Re-planner | **原生表达条件** |
| 执行器 | 简单执行 | 逐步执行 + 重规划 | **类编译器调度** |
| 复杂度 | 低 | 中 | 高 |

### 8. 生产建议

1. **执行器要做好 JSON 解析容错**：解析失败时让 LLM 重试或退化为顺序执行。
2. 加**拓扑排序 + 环检测**，防止模型生成循环依赖导致死循环。
3. 并行调度用线程池/异步，注意工具线程安全。
4. 论文式架构适合**工具调用模式相对固定**的产品；开放探索型任务建议 ReAct。


---



## Function Calling / Tool Calling 范式详解

### 1. 一句话总结

模型不再输出自由文本的 Action，而是输出**结构化的工具调用**（工具名 + JSON 参数），框架执行工具后把结果作为**新消息**返回给模型，循环直到模型给出最终回答 —— 本质是 ReAct 的生产级结构化改良版。**当前生产环境最主流的 Agent 范式**。

### 2. 核心思想

- **背景**：OpenAI 2023 年 6 月引入 `functions` 参数（现为 `tools`），Anthropic、Google 跟进。现在所有主流模型原生支持。
- **与自由文本 ReAct 的区别**：

```text
ReAct（自由文本）:   模型输出 "Action: get_weather\nAction Input: {"city": "北京"}"
                     → 需要正则解析，容易格式错乱

Tool Calling（结构化）: 模型输出 {"name": "get_weather", "arguments": {"city": "北京"}}
                     → 原生 JSON，无需解析，稳定可靠
```

- **关键机制**：工具以 JSON Schema 形式声明（名称、描述、参数结构），模型在训练中学会了"何时调用哪个工具、参数怎么填"。

### 3. 工作原理

```text
用户消息 ──▶ LLM（绑定 tools）
              │
              ├─ 模型返回 tool_call ──▶ 框架执行工具 ──▶ 结果作为 tool 消息
              │                              │
              └──────── 回到 LLM（继续推理） ◀─┘
                    │
              模型直接回答（无 tool_call）──▶ 最终答案
```

多工具并行示例（模型可一次请求多个工具）：

```text
模型返回: [
  {"name": "get_weather", "arguments": {"city": "北京"}},
  {"name": "get_weather", "arguments": {"city": "上海"}}
]
→ 两个工具并行执行，结果一起返回给模型
```

### 4. 完整示例

#### 4.1 LangChain（`bind_tools` + `create_tool_calling_agent`）

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

@tool
def get_weather(city: str, unit: str = "celsius") -> str:
    """获取指定城市的天气。
    Args:
        city: 城市名（中文）
        unit: 温度单位 celsius 或 fahrenheit
    """
    return f"{city}: 晴, 25°C"

@tool
def get_flight_price(route: str, date: str) -> str:
    """查询航线机票价格。
    Args:
        route: 航线，如"北京-上海"
        date: 日期，如"2025-01-01"
    """
    return f"{route} {date}: ¥680"

llm = ChatOpenAI(model="gpt-4o", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是出行助手，使用工具回答用户问题。"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

tools = [get_weather, get_flight_price]
agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

result = executor.invoke({
    "input": "北京明天天气如何？顺便查一下北京到上海明天的机票价格"
})
print(result["output"])
```

#### 4.2 LangGraph（prebuilt 与手写两种）

```python
# 方式一：开箱即用
from langgraph.prebuilt import create_react_agent
agent = create_react_agent(llm, tools)   # 内部就是 tool calling 循环
agent.invoke({"messages": [("user", "北京天气？")]})

# 方式二：手写（理解机制）
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode, tools_condition

def call_model(state: MessagesState):
    response = llm.bind_tools(tools).invoke(state["messages"])
    return {"messages": [response]}

builder = StateGraph(MessagesState)
builder.add_node("agent", call_model)
builder.add_node("tools", ToolNode(tools))
builder.add_edge(START, "agent")
builder.add_conditional_edges(
    "agent",
    tools_condition,   # 有 tool_call → tools，否则 → END
    {"tools": "tools", END: END},
)
builder.add_edge("tools", "agent")
graph = builder.compile()
```

#### 4.3 原生 API 调用（OpenAI，理解协议本质）

```python
from openai import OpenAI

client = OpenAI()

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "获取指定城市的天气",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名"}
            },
            "required": ["city"],
        },
    },
}]

messages = [{"role": "user", "content": "北京天气？"}]
response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    tools=tools,
)

# 如果模型想调用工具：
if response.choices[0].message.tool_calls:
    for call in response.choices[0].message.tool_calls:
        name, args = call.function.name, eval(call.function.arguments)
        result = get_weather(**args)
        messages.append(response.choices[0].message)   # 模型消息
        messages.append({
            "role": "tool",
            "tool_call_id": call.id,                    # 关联调用
            "content": result,
        })
    # 再次调用模型，它会把工具结果纳入推理
```

### 5. 工具 Schema 设计要点

| 要点 | 说明 |
|---|---|
| **描述要具体** | "获取天气"不如"获取指定城市当前天气与温度，用于出行建议" |
| **参数必有类型与说明** | 模型靠参数说明填值，写清楚格式如"YYYY-MM-DD" |
| **参数越少越好** | 每多一个参数就多一分填错概率；可合并成对象 |
| **错误信息要可消化** | 工具抛异常时返回"人类可读"的错误，模型能据此自我修正 |

### 6. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 结构化输出，稳定可靠，无需文本解析 | 依赖模型对工具调用的训练水平 |
| 支持并行工具调用（多 tool_call） | 工具描述/参数设计不当会选错工具 |
| 主流模型原生支持，生态成熟 | 模型可能"幻觉"出工具（调不存在的参数） |
| 结果以消息形式进上下文，可追溯 | 需要处理工具异常与重试逻辑 |

### 7. 适用场景

- **几乎一切生产 Agent**：信息查询、操作执行、代码运行
- **RAG 混合**：检索工具 + 普通对话
- **多系统集成**：查库、调 API、发邮件、下单

### 8. 与 ReAct 的关系

```
ReAct = 思想原型（Thought/Action/Observation 自由文本）
Tool Calling = ReAct 的结构化实现（Action → 结构化 tool_call）
             LangChain/LangGraph 中的 create_react_agent 内部
             实际用的就是 tool calling 机制
```

### 9. 生产建议

1. **默认范式**：新项目一律用 Tool Calling，不要手写 ReAct 文本解析。
2. 工具结果**截断长度**（如 2000 字符），防止超长结果撑爆上下文。
3. 设置 `max_iterations`（5~10），工具循环也可能会死循环。
4. 工具执行**超时 + 异常捕获**，返回友好错误让模型自行处理。
5. 多轮对话用 **checkpointer**（LangGraph）保存历史，工具结果不用重复加载。
