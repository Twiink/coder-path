# 自主、反思与多智能体协作范式详解（AutoGPT / Self-Refine / Supervisor 等）

> **共同点**：都是"**让 Agent 更强**"的扩展范式 —— 自主执行（AutoGPT 式循环、模型调度）、自我提升（反思批判、工具验证）、多智能体协作（分派、接力、辩论）。
> **包含**：自主行动（Toolformer、AutoGPT、HuggingGPT）、反思批判（Self-Refine、CRITIC、Multi-Agent Debate）、协作编排（Orchestrator-Worker、Pipeline）。

## 本文档包含（8 种范式）

| 范式 | 一句话 | 增强维度 |
|---|---|---|
| Toolformer | 训练模型学会自己调工具 | 工具内化 |
| AutoGPT / BabyAGI | 自主无限任务循环 | 自主执行 |
| HuggingGPT | LLM 当大脑，分派给专家模型 | 模型调度 |
| Self-Refine | 生成-自我批判-修正循环 | 自我提升 |
| CRITIC | 用外部工具验证再修正 | 客观验证 |
| Multi-Agent Debate | 多 Agent 观点对抗后汇总 | 观点对抗 |
| Orchestrator-Worker | 主管拆任务分派给工人 | 动态分派 |
| Pipeline | 前一个 Agent 的输出是后一个的输入 | 固定接力 |

## 快速选型

- 需要工具能力内化（小模型/离线）→ Toolformer
- 探索性实验 → AutoGPT（生产慎用）
- 多模态/专业模型任务 → HuggingGPT
- 风格/结构类问题（写作润色）→ Self-Refine
- 事实/计算/代码类问题 → CRITIC（先验证再打磨，可叠加）
- 有争议的判断、需要多角度 → Multi-Agent Debate
- 任务类型多样、需路由 → Orchestrator-Worker
- 流程固定、阶段清晰 → Pipeline

## Toolformer 范式详解

> **Toolformer** —— 让模型**自己学会**在合适的位置调用工具：把"工具使用"训练进模型参数，而不是靠提示词。

### 1. 一句话总结

不是"提示词要求模型调工具"，而是**用自监督训练**让模型内化"何时调用什么工具"的能力 —— 训练后的模型会在文本中自动插入 API 调用标记，如 `[Calculator(12*13) → 156]`。

### 2. 核心思想

- **论文**：《Toolformer: Language Models Can Teach Themselves to Use Tools》(Schick et al., 2023, Meta AI)
- **核心问题**：提示词式工具调用（ReAct）在每次推理时都要靠提示词约束，模型"不懂"工具，只是"被要求"用工具；且每轮都重复解释工具。
- **解决方案**：让模型自己"找"适合插工具的位置：
  1. **采样候选位置**：在训练语料的每个位置尝试插入工具调用
  2. **执行并评估**：调用工具得到结果，看"带工具结果的续写"是否比"不带工具结果的续写"更接近原文（loss 是否下降）
  3. **保留有效样本**：loss 下降的样本保留，作为训练数据微调模型
- **支持的工具**：计算器、问答系统、搜索引擎、翻译系统、日历等

### 3. 工作原理

```text
训练阶段:
  语料: "欧洲面积约 1000 万平方公里…"
                    │ 在候选位置插入
                    ▼
  "[Calculator(1000*10000)]" → 执行 → 结果 10000000
                    │ 评估：插入结果后，模型续写的 loss 是否降低？
                    ▼
  保留有效样本 → 微调模型（让它学会"该位置应该调用工具"）

推理阶段:
  模型自动输出: "欧洲面积约 [Calculator(1000*10000) → 10000000] 平方公里"
```

### 4. 完整示例（推理阶段：LangChain 中模拟 Toolformer 式调用）

```python
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

llm = ChatOpenAI(model="gpt-4o", temperature=0)

@tool
def calculator(expression: str) -> str:
    """安全计算器：接受数学表达式"""
    # 生产环境用 eval 白名单或专用库
    return str(eval(expression, {"__builtins__": {}}, {}))

TOOL_MARKERS = {"calculator": calculator}

def run_toolformer_style(text: str) -> str:
    """解析模型输出中的 [工具名(参数)] 标记并执行（Toolformer 推理协议）"""
    import re
    result = text

    def replace(match):
        tool_name, args = match.group(1), match.group(2)
        if tool_name in TOOL_MARKERS:
            try:
                output = TOOL_MARKERS[tool_name].invoke({"expression": args})
                return f"[{tool_name}({args}) → {output}]"
            except Exception as e:
                return f"[{tool_name}({args}) → ERROR: {e}]"
        return match.group(0)

    return re.sub(r"\[(\w+)\((.*?)\)\]", replace, result)

# 提示词：模拟"模型已内化工具"（真实 Toolformer 无需此提示词）
prompt = f"""你是已学会使用工具的语言模型。当需要精确计算时，
用 [calculator(表达式)] 形式调用，如 [calculator(12*13)]。
问题: 欧洲面积约 1000 万平方公里，换算成平方米是多少？"""

output = llm.invoke(prompt).content
print("模型输出:", output)
print("执行结果:", run_toolformer_style(output))
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 模型内化工具能力，推理时无需重复提示 | **需要训练**，成本高（不是提示词工程） |
| 训练后推理更自然、更少"为了调而调" | 工具集合固定，新增工具要重新训练 |
| 论文实验：低资源语言模型 + 工具，性能大幅提升 | 工具选择错误时无法自我纠正（无循环反馈） |
| 调用结果留在文本中，可解释 | 自监督样本筛选复杂，工程质量要求高 |

### 6. 适用场景

- **垂直领域模型定制**：为特定工具（计算、查询）微调专属模型
- **小模型增强**：让 7B/13B 等小模型具备工具能力（提示词法在小模型上不稳）
- **嵌入式场景**：离线部署、无法每次带大段工具描述的场合

### 7. 与 Tool Calling 的对比

| 维度 | Toolformer | Tool Calling |
|---|---|---|
| 机制 | 训练进参数 | 推理时按 schema 生成 |
| 训练成本 | 高（需微调） | 无（用现成 API） |
| 灵活性 | 低（工具固定） | 高（随时换工具） |
| 稳定性 | 依赖训练质量 | 依赖模型能力 |
| 适用 | 定制模型/小模型 | 生产 Agent 默认选择 |

### 8. 生产建议

1. **不要为了 Toolformer 放弃 Tool Calling**：只有需要"工具能力内化"（小模型、离线、低延迟）时才考虑。
2. 如果确实要训练：工具调用样本用论文的 loss-based 过滤方法，质量优先。
3. 推理端记得实现标记解析器（`[Tool(args) → result]`），并做安全限制（工具白名单）。
4. 可关注后续演进：**Gorilla**（工具 API 调用微调）与 **ToolLLM**（工具学习数据集），生态更完整。
---


---

---

## AutoGPT / BabyAGI 范式详解

> **自主循环 Agent** —— 设定一个目标，Agent 自行拆解任务、执行、检查、再拆解，无限循环直到目标完成。2023 年"全民 Agent"浪潮的代表。

### 1. 一句话总结

给 Agent 一个**目标**（如"帮我做一个网站"），它自主：拆解任务 → 维护任务队列 → 逐个执行（可调工具）→ 检查结果 → 产生新任务 → 循环，直到认为目标完成。人只负责"下命令"。

### 2. 核心思想

- **AutoGPT**（2023.3）：给定目标，自主规划执行循环，可调用浏览器、代码执行、文件系统等工具
- **BabyAGI**（2023.3）：更简洁——用 LLM 维护**任务队列**（task queue），循环执行，聚焦"任务管理"本身
- **核心循环**（两者一致）：

```text
目标（Goal）
   │
   ▼
┌──────────────────────┐
│ 任务创建（拆解目标）    │──▶ 任务队列
└──────────────────────┘      │
                              ▼
┌──────────────────────┐
│ 任务执行（调工具/LLM）  │
└──────────────────────┘
          │ 结果
          ▼
┌──────────────────────┐
│ 结果检查（是否达标？）  │── 不达标 → 重新拆解/重试
└──────────────────────┘
          │ 达标
          ▼
   目标完成？──否──▶ 产生新任务（回到队列）
          │ 是
          ▼
       结束
```

### 3. 完整示例（BabyAGI 式任务循环，LangGraph 实现）

```python
from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

class AGIState(TypedDict):
    goal: str
    task_queue: List[str]   # 待执行任务
    results: List[str]
    max_tasks: int
    task_count: int

def create_tasks(state: AGIState) -> AGIState:
    """任务创建：根据目标+已完成结果，拆解出下一步任务"""
    context = "\n".join(state["results"]) if state["results"] else "（刚开始）"
    tasks_text = llm.invoke(f"""目标: {state['goal']}
已完成工作: {context}
请输出接下来需要执行的 2 个任务（JSON 数组，每个一句话）。""").content
    state["task_queue"] = extract_json_list(tasks_text) + state["task_queue"]
    return state

def execute_task(state: AGIState) -> AGIState:
    """任务执行：取队首任务执行（可在此调用工具）"""
    task = state["task_queue"].pop(0)
    state["task_count"] += 1
    output = llm.invoke(f"执行任务: {task}\n目标: {state['goal']}").content
    state["results"].append(f"任务「{task}」完成: {output[:200]}")
    return state

def should_continue(state: AGIState) -> bool:
    """检查：任务数上限或队列空则结束"""
    if state["task_count"] >= state["max_tasks"] or not state["task_queue"]:
        return False
    return True

def finish(state: AGIState) -> AGIState:
    context = "\n".join(state["results"])
    state["final"] = llm.invoke(f"根据所有已完成任务，总结目标完成情况：{state['goal']}\n{context}").content
    return state

builder = StateGraph(AGIState)
builder.add_node("create", create_tasks)
builder.add_node("execute", execute_task)
builder.add_node("finish", finish)
builder.add_edge(START, "create")
builder.add_edge("create", "execute")
builder.add_conditional_edges(
    "execute",
    should_continue,
    {True: "create", False: "finish"},   # 循环：执行完 → 再拆解 → 再执行
)
builder.add_edge("finish", END)
graph = builder.compile()

result = graph.invoke({
    "goal": "调研并总结 2024 年大模型行业 Top 5 事件",
    "task_queue": [],
    "results": [],
    "max_tasks": 5,        # 硬性上限，防止无限循环
    "task_count": 0,
})
print(result["final"])
```

### 4. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 全自动，无需逐步干预 | **容易失控**：偏离目标、无限循环、乱调工具 |
| 展示"Agent 自主性"的极致形态 | token 成本不可控（可能烧掉大量额度） |
| 任务队列机制简单清晰 | 缺乏长期记忆，容易重复做同一件事 |
| 适合探索性实验 | 生产可靠性差，输出质量波动大 |

### 5. 适用场景

- **研究与探索**：让 Agent 自主调研一个主题并产出报告
- **原型演示**：快速展示 Agent 能力
- **数据收集**：自动抓取、整理多源信息
- **生产慎用**：作为"创意生成器"而非"可靠执行者"

### 6. 与规范 Agent 的对比

| 维度 | AutoGPT 式 | 生产 Agent（Tool Calling / Plan-Execute） |
|---|---|---|
| 控制 | 弱（自主循环） | 强（步骤明确、有限迭代） |
| 成本 | 不可控 | 可控（上限明确） |
| 可靠性 | 低 | 高 |
| 适合 | 实验/探索 | 生产 |

> 现在的 AutoGPT 平台已经演进为更可控的 Agent 构建平台（支持权限控制、验证步骤），不再是原始的"野马"式循环。

### 7. 生产建议（如果一定要用）

1. **必须设硬上限**：最大任务数（如上例 `max_tasks`）、最大 token、最大时长。
2. **关键步骤加人审**：执行重要操作（付款、发邮件、删除）前暂停请求确认（human-in-the-loop）。
3. 加**去重机制**：记录已完成任务，防止循环重复。
4. 用 LangGraph 的**中断（interrupt）**功能实现人工审批节点。
5. 任务拆解提示词要包含"已完成工作"，避免 Agent 忘记自己做过什么。

---

---


---

## HuggingGPT 范式详解

> **LLM 当大脑，专家模型当手脚** —— 通用 LLM 负责规划与调度，把具体任务分派给 Hugging Face 上的专用模型执行，再汇总结果。

### 1. 一句话总结

让 LLM 只做"大脑"（任务规划 + 模型选择 + 结果汇总），把图像识别、语音合成、翻译等**专业任务**分派给 Hugging Face 上最合适的专用模型 —— 用"通用模型 + 专家模型"的组合覆盖 LLM 不擅长的多模态任务。

### 2. 核心思想

- **论文**：《HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in Hugging Face》(Shen et al., 2023, Microsoft)
- **四阶段工作流（Task Planning → Model Selection → Task Execution → Response Generation）**：
  1. **任务规划**：LLM 把用户请求拆成任务列表，标注任务类型与依赖关系
  2. **模型选择**：LLM 从 HF 模型库（按任务类型筛选）选择最合适的模型，可给出候选列表让用户确认
  3. **任务执行**：调用选中的专家模型执行（图像、音频、文本、视频各司其职）
  4. **响应生成**：LLM 汇总所有结果，生成最终回答

### 3. 工作原理

```text
用户: "根据这张图片写一首诗，并朗读出来"

1. 任务规划:  [图像理解]  [诗歌创作(依赖1)]  [语音合成(依赖2)]
2. 模型选择:  图像理解→BLIP；诗歌→ChatGPT；语音合成→TTS 模型
3. 任务执行:  BLIP 描述图片 → ChatGPT 写诗 → TTS 朗读
4. 响应生成:  汇总"描述+诗歌+音频"给用户
```

### 4. 完整示例（LangChain 模拟四阶段）

```python
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

# ── 专家模型注册表（模拟 HF Model Hub）──────────────────
MODEL_REGISTRY = {
    "图像理解": {"BLIP", "LLaVA"},
    "语音合成": {"TTS-1", "XTTS"},
    "翻译": {"NLLB-200"},
    "文本生成": {"GPT-4o", "Claude"},
}

# ── 专家模型执行器（模拟调用 HF Inference API）───────────
@tool
def run_expert(model: str, input_text: str) -> str:
    """调用专家模型执行任务"""
    outputs = {
        "BLIP": "一只金毛犬在草地上追逐飞盘",
        "LLaVA": "金毛犬，阳光明媚的公园",
        "TTS-1": "[音频: 诗歌朗诵音频流]",
        "NLLB-200": "翻译结果: …",
    }
    return outputs.get(model, f"{model} 执行完成")

def hugginggpt(user_request: str):
    # ── 1. 任务规划 ──────────────────────────────────────
    plan = llm.invoke(f"""把请求拆成任务清单，JSON 数组输出（含 type 和依赖）：
请求: {user_request}""").content
    tasks = extract_json_list(plan)
    print("任务规划:", tasks)

    # ── 2. 模型选择 ──────────────────────────────────────
    task_results = {}
    for task in tasks:
        candidates = MODEL_REGISTRY.get(task["type"], ["GPT-4o"])
        chosen = llm.invoke(
            f"从候选模型 {candidates} 中为任务「{task['name']}」选择最合适的，只输出模型名"
        ).content.strip()
        print(f"模型选择: {task['name']} → {chosen}")

        # ── 3. 任务执行（处理依赖：先执行依赖任务）────────
        deps = task.get("deps", [])
        dep_context = "；".join(task_results[d] for d in deps if d in task_results)
        task_results[task["name"]] = run_expert.invoke({
            "model": chosen,
            "input_text": f"{task['name']} ({dep_context})",
        })

    # ── 4. 响应生成 ──────────────────────────────────────
    context = "\n".join(f"{k}: {v}" for k, v in task_results.items())
    return llm.invoke(f"根据以下各任务结果回答用户：{user_request}\n{context}").content

print(hugginggpt("根据这张图片写一首诗，并朗读出来"))
```

> 生产实现中"模型选择"环节用 HF Inference API / Transformers pipeline 代替模拟字典。

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 发挥"通用 LLM + 专用模型"的组合优势 | 多模型协调复杂，链路长 |
| 覆盖 LLM 不擅长的多模态任务 | 模型选择错误会导致任务失败 |
| 任务规划显式、可审计 | 每阶段多次调用，成本与延迟高 |
| 模型可替换（换更好的专家模型即可升级） | 依赖 HF 生态，离线部署难 |

### 6. 适用场景

- **多模态任务**：图片理解 + 文本生成 + 语音输出组合
- **专业领域任务**：OCR、语音识别、翻译等需要专用模型的场景
- **模型编排平台**：作为"模型路由"的思想基础

### 7. 思想演进（现代版本）

HuggingGPT 的思想已融入现代 Agent 框架：

| 现代实现 | 对应思想 |
|---|---|
| **Router / Model Router** | 按任务路由到不同模型 |
| **LangGraph 条件路由** | 任务类型 → 不同执行分支 |
| **HF Inference Providers** | LangChain 的 HuggingFace 工具 |
| **MCP（Model Context Protocol）** | 统一工具/模型接入协议 |

### 8. 与 Multi-Agent 的对比

| 维度 | HuggingGPT | Multi-Agent（Supervisor） |
|---|---|---|
| 分工方式 | 按"任务类型"选专家模型 | 按"角色职责"分工 |
| 执行单元 | 专用模型（可能是非 LLM） | LLM Agent（带工具） |
| 协调者 | LLM（规划+选择） | 主管 Agent |
| 适合 | 多模态/专业模型任务 | 复杂业务流程 |

### 9. 生产建议

1. **模型注册表要带元数据**：模型能力描述、输入输出格式、延迟成本，供 LLM 选择。
2. 任务依赖关系要显式建模（DAG），先执行无依赖任务，可并行。
3. 专家模型输出要**标准化包装**（统一 schema），方便 LLM 汇总。
4. 模型选择结果**缓存**（同一任务类型固定模型），减少决策调用。

---


---

## Self-Refine 范式详解

> **Self-Refine** —— 生成 → 自我批判 → 修正，循环迭代直到质量达标。模型同时扮演"作者"和"评审"。

### 1. 一句话总结

让模型先产出初稿，然后**自己当评审**挑毛病，根据反馈**修正**，如此循环——不需要外部工具、不需要额外训练，单靠"自我迭代"提升输出质量。

### 2. 核心思想

- **论文**：《Self-Refine: Iterative Refinement with Self-Feedback》(Madaan et al., 2023, NeurIPS)
- **核心机制**：同一个 LLM 承担三个角色：
  1. **Generator（生成者）**：产出初始输出
  2. **Critic（批评者）**：找出输出的问题（"太啰嗦""逻辑不连贯""代码有 bug"）
  3. **Refiner（修正者）**：根据反馈重写
- **关键前提**：模型能"看出"自己的问题并改正——论文验证了在写作、代码、翻译等 7 个任务上平均提升约 20%。

### 3. 工作原理

```text
初稿
 │
 ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ Generate │──▶│  Critic  │──▶│  Refine  │
│  （生成） │   │（自我批判）│   │ （修正）  │
└──────────┘   └──────────┘   └──────────┘
                    ▲              │
                    │              ▼
                    └── 不满意？── 新版本（循环）
                                    │
                              满意 → 输出
```

反馈示例（写作任务）：

```text
初稿: "这本书很好看，作者写得不错。"
Critic 反馈: "评价太空泛：没有具体说明哪里好、举例子。建议增加书中具体情节作为论据。"
Refine 后: "这本书的悬念设计很出色，例如第三章的反转让主角身份彻底颠覆，同时作者对人物心理的描写细腻，让读者代入感强。"
```

### 4. 完整示例

#### 4.1 LangChain（生成-批判-修正循环）

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

generate_prompt = PromptTemplate.from_template(
    "写一段关于「人工智能的伦理挑战」的 100 字短文：\n{instruction}"
)
critic_prompt = PromptTemplate.from_template(
    """请以资深编辑身份审查以下文章，指出 2-3 个具体问题（引用原文），
并给出修改建议。只输出批评意见：
文章: {text}"""
)
refine_prompt = PromptTemplate.from_template(
    """根据以下编辑意见重写文章，保留优点、修正缺点：
原文章: {text}
编辑意见: {feedback}
重写（100 字左右）:""")

def self_refine(instruction: str, max_rounds: int = 3) -> str:
    text = llm.invoke(generate_prompt.format(instruction=instruction)).content
    for i in range(max_rounds):
        feedback = llm.invoke(critic_prompt.format(text=text)).content
        # 简单停止条件：批评意见太短（表示没意见）就停止
        if len(feedback) < 20:
            print(f"第 {i+1} 轮：评审通过")
            break
        print(f"第 {i+1} 轮反馈: {feedback[:60]}…")
        text = llm.invoke(refine_prompt.format(text=text, feedback=feedback)).content
    return text

final = self_refine("重点谈隐私与算法偏见")
print("最终版本:\n", final)
```

#### 4.2 LangGraph（正式图结构，便于观察与审计）

```python
from typing import TypedDict, Literal
from langgraph.graph import StateGraph, START, END

class RefineState(TypedDict):
    instruction: str
    text: str
    feedback: str
    rounds: int

def generate(state: RefineState) -> RefineState:
    state["text"] = llm.invoke(generate_prompt.format(instruction=state["instruction"])).content
    state["rounds"] = 0
    return state

def critique(state: RefineState) -> RefineState:
    state["feedback"] = llm.invoke(critic_prompt.format(text=state["text"])).content
    return state

def refine(state: RefineState) -> RefineState:
    state["text"] = llm.invoke(
        refine_prompt.format(text=state["text"], feedback=state["feedback"])
    ).content
    state["rounds"] += 1
    return state

def route(state: RefineState) -> Literal["refine", "end"]:
    # 反馈过短 = 评审通过；或达到最大轮数
    if len(state["feedback"]) < 20 or state["rounds"] >= 3:
        return "end"
    return "refine"

builder = StateGraph(RefineState)
builder.add_node("generate", generate)
builder.add_node("critique", critique)
builder.add_node("refine", refine)
builder.add_edge(START, "generate")
builder.add_edge("generate", "critique")
builder.add_conditional_edges("critique", route, {"refine": "refine", "end": END})
builder.add_edge("refine", "critique")   # 修正后再评审
graph = builder.compile()

result = graph.invoke({
    "instruction": "写一段产品介绍：一款帮助用户管理订阅的 App",
    "text": "",
    "feedback": "",
    "rounds": 0,
})
print(result["text"])
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 无需外部工具、无需训练数据 | 可能"越改越差"（模型批判/修改都不可靠） |
| 单模型即可，部署简单 | 每轮 2~3 次 LLM 调用，成本与延迟上升 |
| 显著提升写作、代码、翻译质量 | 没有外部标准时，迭代可能原地打转 |
| 反馈与修改过程可审计 | 对"事实性错误"帮助有限（模型看不出自己的幻觉） |

### 6. 适用场景

- **写作润色**：文章、邮件、营销文案
- **代码优化**：重构、加注释、修风格问题
- **翻译打磨**：初译后自我校对
- **回答优化**：让答案更完整、更有条理

### 7. 与相关范式对比

| 范式 | 反馈来源 | 记忆 | 终止条件 |
|---|---|---|---|
| **Self-Refine** | 自我批判 | 无（单轮内循环） | 批判变弱 / 轮数上限 |
| **Reflexion** | 任务失败后的总结 | 有（跨轮记忆） | 任务成功 / 重试上限 |
| **CRITIC** | **外部工具验证** | 无 | 验证通过 |
| **Multi-Agent Debate** | 其他 Agent 的论点 | 对话历史 | 辩论轮数上限 |

### 8. 生产建议

1. **反馈要有"引用 + 具体建议"**：提示词里明确要求批评者引用原文，避免空话。
2. **设轮数上限（2~3 轮）**：超过后收益递减，还可能越改越差。
3. 用**外部标准**补充（代码跑测试、文章过字数检查），能验证就不要纯靠自我批判。
4. 保持初稿，对比"初稿 vs 最终稿"，若质量评分不升反降就回退初稿。
5. 温度：生成用 0.7（多样性），批判用 0（稳定），修正用 0.5（折中）。
---


---

---

## CRITIC 范式详解

> **CRITIC: Tool-Interactive Critiquing** —— 生成答案后用**外部工具验证**，发现错误再修正。自我批判的"客观版"。

### 1. 一句话总结

模型生成答案后，不靠"自我感觉"评判，而是**调用外部工具客观验证**（执行代码、查计算器、查资料、跑测试），验证失败就修正再验证，直到通过。

### 2. 核心思想

- **论文**：《CRITIC: Large Language Models Can Self-Correct with Tool-Interactive Critiquing》(Gou et al., 2023, ICLR)
- **核心问题**：Self-Refine 的自我批判对**事实性/计算性错误**无能为力——模型无法"看出"自己的幻觉。但**工具可以**：执行代码报错了就是错，计算结果不一致就是错。
- **验证工具库（CRITIC 论文中分了四类）**：
  1. **代码执行器**：验证代码正确性
  2. **计算器**：验证数学计算
  3. **搜索引擎**：验证事实陈述
  4. **其他 API**：验证专业领域结论（如医学知识库）

### 3. 工作原理

```text
┌──────────┐   ┌──────────┐   ┌──────────┐
│ Generate │──▶│  Verify  │──▶│ Correct  │
│  （生成） │   │（工具验证）│   │（按报错修正）│
└──────────┘   └──────────┘   └────┬─────┘
     ▲                             │
     └────────── 验证未通过 ────────┘
                 │ 验证通过
                 ▼
               输出结果
```

示例（数学题）：

```text
生成: 小明 3 小时行 360 公里，速度是 130 km/h   ← 算错了
验证: 计算器: 360 ÷ 3 = 120 ≠ 130  ❌
修正: 速度 = 360 ÷ 3 = 120 km/h
验证: 计算器: 360 ÷ 3 = 120 ✅
输出: 120 km/h
```

### 4. 完整示例（LangGraph：代码生成 + 执行验证）

```python
from typing import TypedDict, Literal
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
import subprocess, textwrap

llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

@tool
def run_python(code: str) -> str:
    """执行 Python 代码并返回 stdout/stderr"""
    result = subprocess.run(
        ["python3", "-c", code],
        capture_output=True, text=True, timeout=10,
    )
    return f"stdout: {result.stdout}\nstderr: {result.stderr}"

class CriticState(TypedDict):
    task: str
    code: str
    verification: str
    attempts: int

def generate(state: CriticState) -> CriticState:
    state["code"] = llm.invoke(
        f"写 Python 代码完成任务，只输出代码：{state['task']}"
    ).content
    return state

def verify(state: CriticState) -> CriticState:
    """用工具客观验证"""
    state["verification"] = run_python.invoke({"code": state["code"]})
    return state

def correct(state: CriticState) -> CriticState:
    """根据工具报错修正代码"""
    state["code"] = llm.invoke(f"""修复以下代码，解决报错：
任务: {state['task']}
代码: {state['code']}
执行结果: {state['verification']}
只输出修复后的完整代码。""").content
    state["attempts"] += 1
    return state

def route(state: CriticState) -> Literal["correct", "end"]:
    if "Error" in state["verification"] and state["attempts"] < 3:
        return "correct"
    return "end"

builder = StateGraph(CriticState)
builder.add_node("generate", generate)
builder.add_node("verify", verify)
builder.add_node("correct", correct)
builder.add_edge(START, "generate")
builder.add_edge("generate", "verify")
builder.add_conditional_edges("verify", route, {"correct": "correct", "end": END})
builder.add_edge("correct", "verify")   # 修正后再验证
graph = builder.compile()

result = graph.invoke({
    "task": "写一个函数，输入列表返回其中偶数的和。",
    "code": "",
    "verification": "",
    "attempts": 0,
})
print(result["code"])
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 验证客观可靠，能抓住自我批判抓不住的事实/计算错误 | 依赖工具可用性（不是所有问题都能验证） |
| 修正有明确依据（报错信息），收敛快 | 验证环节设计与接入成本高 |
| 论文实验：多个数据集上显著超过 Self-Refine | 工具本身可能出错（测试用例不完整） |
| 与 Reflexion 组合效果更好（跨任务积累经验） | 验证环节增加延迟 |

### 6. 适用场景

- **代码生成**：跑测试/执行验证（最经典）
- **数学计算**：计算器/符号引擎验证
- **事实核查**：搜索引擎验证陈述
- **数据管道**：输出 schema 校验、类型检查

### 7. 与 Self-Refine 的对比

| 维度 | Self-Refine | CRITIC |
|---|---|---|
| 反馈来源 | 模型自我批判 | **外部工具验证** |
| 能抓的错误 | 风格、结构、逻辑类 | **事实、计算、执行类** |
| 可靠性 | 依赖模型能力 | 依赖工具正确性 |
| 成本 | 2~3 次 LLM 调用 | LLM + 工具调用 |
| 最佳组合 | 两者互补：先 CRITIC 验证，再 Self-Refine 打磨 |

### 8. 生产建议

1. **验证器要"客观可判"**：测试用例、断言、schema 校验，避免"让 LLM 判断 LLM 输出"。
2. 代码执行必须**沙箱化**（限制资源、超时、禁止危险操作）。
3. 修正阶段把"代码 + 报错 + 任务"一起给模型，报错信息是修正的关键燃料。
4. 最多重试 2~3 次，连续失败直接报错给用户，别死磕。
5. 与 **Reflexion** 结合：把"验证失败的教训"存入记忆，跨任务复用。

---

---


---

## Multi-Agent Debate 多智能体辩论范式详解

> **Multi-Agent Debate** —— 多个 Agent 持有不同观点互相辩论，最终投票或汇总。用"观点对抗"抵消单一模型的盲区。

### 1. 一句话总结

让多个 Agent（可以是同模型多实例，也可以是不同模型）对同一问题给出答案并**互相辩论**：看到对方的论点后修正或捍卫自己的观点，几轮之后投票或汇总出最终答案。

### 2. 核心思想

- **论文**：《Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate》(Liang et al., 2023, ICML) 等系列工作
- **为什么有效**：
  - 单一模型有固定盲区（同样的训练偏差）；多个实例的盲区不完全重叠
  - 辩论迫使模型**审视对立观点**，暴露自己论证的漏洞
  - "看到别人怎么想"激活模型更多知识（类似头脑风暴）
- **两个关键设计**：
  - **多样性**：不同模型 / 不同 prompt / 不同角色设定，观点差异越大辩论越有价值
  - **汇总机制**：投票（取多数）或评审 Agent（综合最优论点）

### 3. 工作原理

```text
              ┌─────────┐
              │ 问题    │
              └────┬────┘
      ┌────────────┼────────────┐
      ▼            ▼            ▼
 ┌────────┐  ┌────────┐  ┌────────┐
 │ Agent1 │  │ Agent2 │  │ Agent3 │
 └───┬────┘  └───┬────┘  └───┬────┘
     │  轮1: 各给答案+论证    │
     └───────────┼───────────┘
                 ▼
    轮2: 互相看到对方论证，反驳/修正
                 ▼
    轮3: …（可多轮）
                 ▼
       ┌─────────────────┐
       │ 投票 / 评审汇总  │
       └────────┬────────┘
                ▼
           最终答案
```

辩论示例（"应该让 AI 拥有自主决策权吗？"）：

```text
Agent1（正方）: 自主决策效率高，如自动驾驶能减少人为失误。
Agent2（反方）: 责任归属不清——出了事故谁负责？且黑箱决策不可审计。
Agent1（回应）: 可设置审计日志与安全边界，自主权限定在低风险场景。
Agent3（中立）: 折中：分级授权——低风险自主，高风险人类批准。
最终汇总: 分级授权的共识方案。
```

### 4. 完整示例（LangGraph 实现 3-Agent 辩论）

```python
from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI

# 用不同系统提示词制造观点差异（也可用不同模型）
agents = [
    ("经济学家", "你从经济效率角度思考问题，观点犀利。"),
    ("伦理学家", "你从伦理与公平角度思考问题，注重社会责任。"),
    ("务实工程师", "你从工程可实现性角度思考问题，反对空谈。"),
]

class DebateState(TypedDict):
    question: str
    statements: List[str]    # 各 Agent 当前陈述
    round: int
    final: str

MAX_ROUNDS = 2

def initial_statements(state: DebateState) -> DebateState:
    """轮1：各自独立给观点"""
    state["statements"] = []
    for _, system_prompt in agents:
        msg = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"请陈述你对以下问题的观点及理由：{state['question']}"),
        ])
        state["statements"].append(msg.content)
    state["round"] = 1
    return state

def debate_round(state: DebateState) -> DebateState:
    """轮2+：看到他人观点后回应/修正"""
    new_statements = []
    for i, (_, system_prompt) in enumerate(agents):
        others = [s for j, s in enumerate(state["statements"]) if j != i]
        msg = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"""问题：{state['question']}
你的上一轮观点：{state['statements'][i]}
其他人的观点：
1. {others[0]}
2. {others[1]}
请指出你不同意的地方，并给出修正后的最终观点。"""),
        ])
        new_statements.append(msg.content)
    state["statements"] = new_statements
    state["round"] += 1
    return state

def summarize(state: DebateState) -> DebateState:
    """评审汇总：综合所有观点输出共识"""
    context = "\n\n".join(f"观点{i+1}: {s}" for i, s in enumerate(state["statements"]))
    state["final"] = llm.invoke([
        SystemMessage(content="你是辩论主持人。综合各方观点，输出共识结论，指出分歧点。"),
        HumanMessage(content=f"问题：{state['question']}\n{context}"),
    ]).content
    return state

def route(state: DebateState):
    return "debate" if state["round"] < MAX_ROUNDS else "summarize"

# 构图
builder = StateGraph(DebateState)
builder.add_node("initial", initial_statements)
builder.add_node("debate", debate_round)
builder.add_node("summarize", summarize)
builder.add_edge(START, "initial")
builder.add_edge("initial", "debate")
builder.add_conditional_edges("debate", route, {"debate": "debate", "summarize": "summarize"})
builder.add_edge("summarize", END)
graph = builder.compile()

result = graph.invoke({
    "question": "应该让 AI 拥有自主决策权吗？",
    "statements": [],
    "round": 0,
})
print(result["final"])
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 抵消单一模型盲区，观点更全面 | 成本 ×Agent 数 ×轮数（非常烧 token） |
| 能暴露论证漏洞，答案更严谨 | 延迟高（多轮串行） |
| 可混合不同模型（如 Claude + GPT 互辩） | 可能辩论不出结论（陷入僵局） |
| 适合有争议性、开放性话题 | 强模型带偏弱模型（权威效应） |

### 6. 适用场景

- **有争议的判断**：政策、伦理、产品方案取舍
- **事实核查**：多个模型对同一事实交叉验证
- **创意头脑风暴**：多角色视角出方案
- **高风险决策辅助**：需要多角度论证

### 7. 变体

| 变体 | 说明 |
|---|---|
| **同模型多实例** | 同一模型不同温度/角色，成本低 |
| **异模型辩论** | 不同厂商模型互辩，盲区互补最强（如 Claude vs GPT） |
| **裁判制** | 增加一个中立的评审 Agent 主持 |
| **渐进式** | 先各自独立研究，再辩论（带工具） |

### 8. 生产建议

1. **辩论轮数 2~3 轮**：1 轮是各自表态没交锋；超过 3 轮边际收益低。
2. **角色 prompt 要反差大**：观点差异小则辩论失去意义。
3. 汇总阶段必须有**评审 Agent**，纯投票在开放问题上效果差。
4. 成本控制：先用异模型各 1 次（无辩论）对比，分歧大时再启动辩论。
5. 与 Multi-Agent 框架（LangGraph/CrewAI）天然契合，注意用 checkpointer 保存辩论过程。

---


---

## Orchestrator-Worker（主从式）多智能体范式详解

> **主管拆任务，工人执行** —— 一个主管 Agent 负责拆解任务、分派给多个专业 Worker Agent、汇总结果。多智能体协作最常用的架构。

### 1. 一句话总结

一个 **Orchestrator（主管/协调者）** 接收任务 → 拆解并分派给多个 **Worker（工人）** Agent（每个擅长一个领域）→ 汇总各 Worker 的结果 → 返回给用户。类似"项目经理 + 团队成员"。

### 2. 核心思想

- **为什么需要**：单个 Agent 做所有事 = 上下文爆炸、工具混乱、职责不清。分工后每个 Worker 只持有自己的工具与上下文，专业且高效。
- **角色设计**：
  - **Orchestrator（Supervisor）**：LLM 路由决策——判断"这个子任务该交给谁"，不亲自干活
  - **Worker**：各司其职——如"搜索 Agent""代码 Agent""写作 Agent"，各自只绑定相关工具
- **两种变体**：
  - **固定流程**：主管按固定顺序分派（工作流式）
  - **动态路由**：主管根据任务内容动态决定下一个交给谁（LLM 路由）

### 3. 工作原理

```text
                    ┌──────────────┐
                    │  用户请求     │
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │ Orchestrator │  （LLM 路由：拆任务+选人）
                    └──────┬───────┘
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ Worker  │  │ Worker  │  │ Worker  │
        │ 搜索    │  │ 代码    │  │ 写作    │
        └────┬────┘  └────┬────┘  └────┬────┘
              └────────────┼────────────┘
                           ▼
                    ┌──────────────┐
                    │ 汇总回复用户  │
                    └──────────────┘
```

示例（"帮我调研 RAG 的最佳实践并写一份报告"）：

```text
Orchestrator: 拆成 3 个子任务
  → Worker-搜索: 检索 RAG 相关论文与工程实践（调搜索工具）
  → Worker-代码: 写一个 RAG 最小示例代码（调代码工具）
  → Worker-写作: 把前两者结果写成结构化报告
Orchestrator: 汇总 → 输出完整报告
```

### 4. 完整示例（LangGraph Supervisor 模式）

```python
from typing import Literal
from langgraph.graph import StateGraph, MessagesState, START, END
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# ── 定义 Worker 工具 ────────────────────────────────────
@tool
def web_search(query: str) -> str:
    """网络搜索"""
    return f"【{query}】结果: RAG 最佳实践包括混合检索、rerank…"

@tool
def write_code(task: str) -> str:
    """生成 Python 代码"""
    return f"```python\n# {task} 的示例代码\n```"

# ── 定义两个 Worker Agent ───────────────────────────────
search_agent = create_react_agent(llm, tools=[web_search])
code_agent = create_react_agent(llm, tools=[write_code])

# ── Supervisor：决定把消息交给谁 ─────────────────────────
def make_supervisor(llm, members: list[str]):
    """返回一个 supervisor 节点函数"""
    options = members + ["FINISH"]
    system_prompt = f"""你是主管。根据任务内容把消息分派给合适成员，或输出 FINISH 结束。
成员: {members}
每次只输出一个名字或 FINISH。"""

    def supervisor_node(state: MessagesState):
        # 让模型选下一个执行者（简化：tool calling 方式路由）
        response = llm.bind_tools([{
            "type": "function",
            "function": {
                "name": "route",
                "description": "选择下一个执行成员",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "next": {"type": "string", "enum": options}
                    },
                    "required": ["next"],
                },
            },
        }]).invoke([SystemMessage(content=system_prompt)] + state["messages"])
        return {"next": response.tool_calls[0]["args"]["next"]}

    return supervisor_node

# ── 构图：supervisor ↔ workers 循环 ──────────────────────
from typing import TypedDict

class State(MessagesState):
    next: str

def route_next(state: State) -> Literal["search_agent", "code_agent", END]:
    return state["next"] if state["next"] in ("search_agent", "code_agent") else END

builder = StateGraph(State)
builder.add_node("supervisor", make_supervisor(llm, ["search_agent", "code_agent"]))
builder.add_node("search_agent", search_agent)
builder.add_node("code_agent", code_agent)
builder.add_edge(START, "supervisor")
builder.add_conditional_edges(
    "supervisor",
    route_next,
    {"search_agent": "search_agent", "code_agent": "code_agent", END: END},
)
builder.add_edge("search_agent", "supervisor")   # 干完活回到主管
builder.add_edge("code_agent", "supervisor")
graph = builder.compile()
```

> 提示：LangChain 官方提供了 `langgraph-supervisor` 包（`create_supervisor`），一行创建上述结构，生产可直接用。

#### 用 langgraph-supervisor 包的简写

```python
from langgraph_supervisor import create_supervisor

supervisor = create_supervisor(
    [search_agent, code_agent],
    model=llm,
    prompt="你是主管，按需分派任务给搜索或代码 Agent。",
)
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 职责清晰，每个 Worker 上下文干净 | 主管成为瓶颈（所有消息都要过它） |
| 易于扩展（加一个 Worker = 加一个节点） | 主管路由错误会带偏整个任务 |
| Worker 可独立测试、独立替换 | 消息在主管与工人间多次传递，token 开销大 |
| 适合任务边界清晰的业务 | 简单任务用多 Agent 反而更慢更贵 |

### 6. 适用场景

- **多领域协作**：研究 + 写作 + 代码 + 设计
- **业务系统**：客服分流（订单、售后、技术问题各一个 Worker）
- **工具隔离**：不同工具需要不同权限/环境的场景

### 7. 与其他协作模式对比

| 模式 | 协作方式 | 适合 |
|---|---|---|
| **Orchestrator-Worker** | 主管动态分派 | 任务类型多样、需路由 |
| **Pipeline（流水线）** | 固定顺序传递 | 流程固定、阶段清晰 |
| **Debate（辩论）** | 观点对抗 | 判断类、争议类 |
| **Hierarchical（层级）** | 多级主管嵌套 | 超大复杂任务 |

### 8. 生产建议

1. **Worker 数量 2~5 个**为宜，太多主管决策负担重。
2. 主管路由用**结构化输出**（tool calling）而非自由文本，稳定可靠。
3. 给每个 Worker 明确的**系统提示词与工具白名单**，防止越权。
4. 主管上下文会膨胀：考虑"只传摘要"而不是全量历史。
5. 设置最大轮数（防主管-工人无限循环）。
---


---

---

## Pipeline（流水线式）多智能体范式详解

> **接力赛** —— 多个 Agent 按固定顺序协作，前一个的输出是后一个的输入，像工厂流水线一样完成复杂任务。

### 1. 一句话总结

把任务拆成**固定阶段**，每个阶段由一个专业 Agent 负责，Agent 之间按顺序传递结果 —— 结构最简单、行为最可预测的多智能体协作模式。

### 2. 核心思想

- **与 Supervisor 的区别**：没有"主管"做动态路由；**流程在设计时就固定**（A → B → C），每个 Agent 只关心自己的输入输出。
- **数据流**：`输入 → Agent1 → Agent2 → Agent3 → 输出`，每步可以：
  - 修改/丰富数据（如：初稿 → 润色）
  - 验证数据（如：生成代码 → 测试 → 修复）
  - 转换格式（如：文本 → 结构化 JSON → 报告）
- **经典示例**：代码生成流水线 `生成 → 评审 → 修复 → 测试`

### 3. 工作原理

```text
用户需求
   │
   ▼
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Agent1   │──▶│ Agent2   │──▶│ Agent3   │──▶│ Agent4   │
│ 产品设计  │   │ 架构设计  │   │ 编码实现  │   │ 质量测试  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
   （每个 Agent 的输出完整传给下一个）
```

流水线示例（MetaGPT 式软件开发）：

```text
需求文档 → 产品经理 Agent（PRD）→ 架构师 Agent（技术设计）
        → 工程师 Agent（代码）→ 测试 Agent（用例+报告）
```

### 4. 完整示例（LangGraph 实现四阶段流水线）

```python
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

llm = ChatOpenAI(model="gpt-4o", temperature=0.5)

class PipelineState(TypedDict):
    requirement: str     # 原始需求
    design: str          # 阶段1输出
    code: str            # 阶段2输出
    review: str          # 阶段3输出
    final: str           # 阶段4输出

# ── 阶段 1：产品设计 Agent ───────────────────────────────
def design_agent(state: PipelineState) -> PipelineState:
    state["design"] = llm.invoke([
        HumanMessage(content=f"""你是产品经理。根据需求输出功能清单与验收标准：
需求: {state['requirement']}""")
    ]).content
    return state

# ── 阶段 2：编码 Agent（消费阶段1输出）───────────────────
def coding_agent(state: PipelineState) -> PipelineState:
    state["code"] = llm.invoke([
        HumanMessage(content=f"""你是工程师。根据设计实现代码：
设计: {state['design']}
输出完整 Python 代码。""")
    ]).content
    return state

# ── 阶段 3：评审 Agent（检查阶段2输出）───────────────────
def review_agent(state: PipelineState) -> PipelineState:
    state["review"] = llm.invoke([
        HumanMessage(content=f"""你是资深评审。审查代码并指出问题与修改建议：
代码: {state['code']}
设计: {state['design']}""")
    ]).content
    return state

# ── 阶段 4：修复 Agent（根据评审修正）────────────────────
def fix_agent(state: PipelineState) -> PipelineState:
    state["final"] = llm.invoke([
        HumanMessage(content=f"""根据评审意见修复代码：
代码: {state['code']}
评审意见: {state['review']}
输出修复后的完整代码。""")
    ]).content
    return state

# ── 构图：完全线性的边 ───────────────────────────────────
builder = StateGraph(PipelineState)
builder.add_node("design", design_agent)
builder.add_node("coding", coding_agent)
builder.add_node("review", review_agent)
builder.add_node("fix", fix_agent)
builder.add_edge(START, "design")
builder.add_edge("design", "coding")
builder.add_edge("coding", "review")
builder.add_edge("review", "fix")
builder.add_edge("fix", END)
pipeline = builder.compile()

result = pipeline.invoke({
    "requirement": "写一个命令行计算器，支持加减乘除",
})
print("最终代码:\n", result["final"])
```

#### LangChain 简化写法（Runnable 链）

```python
from langchain_core.runnables import RunnableLambda

stage1 = RunnableLambda(lambda r: design_prompt.format(requirement=r["requirement"]) | llm)
# 或者更简单：直接 chain 串起来
# chain = prompt1 | llm | str_parser | prompt2 | llm | str_parser | ...
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 结构最简单，行为可预测 | 串行执行，速度慢 |
| 每阶段职责单一，容易测试 | 前面出错会向后传导（错误放大） |
| 没有路由决策，节省 token | 无法跳过/重排阶段（不灵活） |
| 天然支持"质量门禁"（阶段间检查） | 每阶段都要重新理解全部上下文 |

### 6. 适用场景

- **内容生产**：选题 → 大纲 → 初稿 → 润色 → 校对
- **软件开发**：设计 → 编码 → 评审 → 修复 → 测试
- **数据处理**：提取 → 清洗 → 转换 → 装载（ETL 的 Agent 版）
- **质检流程**：生成 → 验证 → 修正 → 再验证

### 7. 变体：带反馈回路的流水线

流水线可以加**反馈边**（阶段 N 不合格时回到阶段 N-1）：

```python
# 在 review 后加条件边：不合格回到 coding（形成小循环）
builder.add_conditional_edges(
    "review",
    lambda s: "coding" if "严重问题" in s["review"] else "fix",
    {"coding": "coding", "fix": "fix"},
)
```

这就是 Pipeline 与 Reflexion/CRITIC 的组合形态。

### 8. 与其他协作模式对比

| 模式 | 流程 | 动态性 | 适合 |
|---|---|---|---|
| **Pipeline** | 固定顺序 | 无 | 流程清晰稳定的任务 |
| **Orchestrator-Worker** | 动态分派 | 高 | 任务类型多样的场景 |
| **Debate** | 多向对抗 | 中 | 判断与争议类 |
| **层级式** | 多级嵌套 | 中 | 超大规模任务 |

### 9. 生产建议

1. **阶段间定义清晰的数据契约**（字段、格式），每个 Agent 的输出都按 schema 校验。
2. 每个阶段**独立可测试**：输入样例 → 断言输出。
3. 关键阶段之间加**质量门禁**（规则检查或验证工具），不达标不进下一阶段。
4. 阶段太多（>5）时考虑拆成子流水线或改用 Supervisor。
5. 用 checkpointer 保存每阶段结果，失败时从失败阶段续跑。
