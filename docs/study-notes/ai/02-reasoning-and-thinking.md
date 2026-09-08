# 推理与思考范式详解（CoT / ToT / RAP 等）

> **共同点**：都是"**一步一步想**"的思考范式 —— 不依赖工具（或把工具当辅助），专注于推理本身：从单链思维、多链投票、显式拆解，到把推理当搜索。
> **包含**：CoT 家族（CoT、CoT-SC、Self-Ask）、规划式提示（Plan-and-Solve）、搜索式推理（ToT、GoT、RAP）。

## 本文档包含（7 种范式）

| 范式 | 一句话 | 推理结构 |
|---|---|---|
| CoT 思维链 | 一步一步想再回答 | 单链 |
| CoT-SC 自洽性 | 多想几次投票取众数 | 多链 + 投票 |
| Self-Ask | 自己拆子问题自问自答 | 显式子问题树 |
| Plan-and-Solve | 提示词里先规划再解题 | 计划 + 执行 |
| ToT 思维树 | 多分支探索 + 评估 + 回溯 | 树（LLM 打分） |
| GoT 思维图 | 分支可合并的图式推理 | 图（DAG） |
| RAP | 蒙特卡洛树搜索式推理 | 树（MCTS + 世界模型） |

## 快速选型

- 基础需求 → CoT（零样本一行提示词）
- 高准确率要求、成本可接受 → CoT-SC
- 复合事实问题（多跳问答）→ Self-Ask
- 数学/逻辑题、多条件约束 → Plan-and-Solve
- 需要多分支探索与回溯 → ToT
- 需要"多个子结论组合"→ GoT
- 需要前瞻模拟、决策规划 → RAP

> 搜索式推理（ToT/GoT/RAP）成本很高，简单问题不要用。

## CoT（Chain-of-Thought）思维链范式详解

> **Chain-of-Thought** —— 让模型"一步一步想"再回答，是 ReAct 中"思考"部分的独立演化，也是所有推理类提示词的基石。

### 1. 一句话总结

在提示词中引导模型输出**中间推理步骤**（思维链），而不是直接给答案 —— 显著提升数学、逻辑、常识推理能力。

### 2. 核心思想

- **论文**：《Chain-of-Thought Prompting Elicits Reasoning in Large Language Models》(Wei et al., 2022, NeurIPS)
- **关键发现**：让模型"先把推理过程写出来"比直接回答准确率高得多——因为生成中间步骤时模型会逐步调用自身的知识，减少"跳步"导致的错误。
- **两种用法**：
  - **Few-shot CoT**：示例中给出"问题 → 逐步推理 → 答案"的完整示例
  - **Zero-shot CoT**：只加一句"Let's think step by step"（Kojima et al., 2022）

### 3. 工作原理

```text
普通提示:   问题 ──────────────────────▶ 直接答案（容易跳步出错）
CoT 提示:   问题 ─▶ 逐步推理（中间步骤） ─▶ 答案（可验证、更准）

示例:
Q: 小明有 5 个苹果，吃了 2 个，又买了 3 个，现在有几个？
A: 小明先有 5 个苹果。
   吃了 2 个后剩 5 - 2 = 3 个。
   又买了 3 个后有 3 + 3 = 6 个。
   所以答案是 6 个。✅
```

### 4. 完整示例（LangChain 实现）

#### 4.1 Zero-shot CoT（一行提示词）

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o", temperature=0)

zero_shot_cot = PromptTemplate.from_template(
    "问题：{question}\n让我们一步一步思考："
) | llm | StrOutputParser()

print(zero_shot_cot.invoke({
    "question": "一列火车 3 小时行驶 360 公里，照此速度 5 小时行驶多少公里？"
}))
```

#### 4.2 Few-shot CoT（示例引导）

```python
few_shot_cot = PromptTemplate.from_template("""请模仿示例的推理方式回答问题。

示例 1:
Q: 商店里有 15 个苹果，卖出 7 个，又进货 10 个，还剩几个？
A: 原有 15 个，卖出 7 个后剩 15 - 7 = 8 个。
   进货 10 个后有 8 + 10 = 18 个。
   所以答案是 18 个。

示例 2:
Q: 一个数的 3 倍加上 5 等于 20，这个数是多少？
A: 设这个数为 x，则 3x + 5 = 20。
   两边减 5 得 3x = 15。
   两边除以 3 得 x = 5。
   所以答案是 5。

现在回答:
Q: {question}
A:""") | llm | StrOutputParser()

print(few_shot_cot.invoke({"question": "一本书 240 页，小明每天读 30 页，几天能读完？"}))
```

#### 4.3 结构化提取推理过程（便于审计）

```python
from langchain_core.output_parsers import JsonOutputParser

structured_prompt = PromptTemplate.from_template("""问题：{question}
请一步步推理，并以 JSON 格式输出：
{{"steps": ["推理步骤1", "推理步骤2", ...], "answer": "最终答案"}}
""") | llm | JsonOutputParser()

result = structured_prompt.invoke({"question": "25 的 20% 加上 10 是多少？"})
print(result)  # {'steps': [...], 'answer': '15'}
```

### 5. 变体

| 变体 | 说明 |
|---|---|
| **Zero-shot CoT** | 加"Let's think step by step"，零示例可用 |
| **Few-shot CoT** | 带推理示例，更稳但需要设计示例 |
| **CoT-SC（自洽性）** | 采样多次投票（见 09 文档） |
| **Auto-CoT** | 自动生成示例的 CoT |
| **Plan-and-Solve** | 先计划后执行，CoT 的规划升级版（见 06 文档） |

### 6. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 显著提升推理准确率（论文：PaLM 540B 在 GSM8K 从 18% → 57%） | 无法获取外部信息，知识过期问题仍在 |
| 无需训练、无需改模型 | 推理路径可能"自信地错"（幻觉步骤） |
| 推理过程可见，便于调试与信任 | 输出更长，token 成本增加 |
| 与任何框架兼容（本质是提示词） | 小模型效果有限（能力阈值） |

### 7. 适用场景

- **数学/逻辑推理**：应用题、智力题、代码题
- **多条件决策**：需要显式权衡多个因素
- **可解释性要求高的问答**：用户想看"为什么是这个答案"
- 作为 Agent 内部"思考"环节的提示词基础（ReAct 的 Thought 就是 CoT 的应用）

### 8. 与 ReAct / Plan-and-Solve 的关系

```
CoT        = 只思考（推理链路）
Plan-and-Solve = CoT + 先规划
ReAct      = CoT + 工具调用循环
Reflexion  = CoT + 工具 + 失败反思记忆
```

### 9. 生产建议

1. **先试 zero-shot CoT**（成本最低），效果不够再上 few-shot 示例。
2. 示例要"同域"：数学题配数学示例，代码题配代码示例。
3. 结构化输出（JSON）便于提取答案和步骤，避免解析自由文本。
4. 与温度配合：推理任务 `temperature=0` 更稳；需要多样性时再调高配合 CoT-SC。
---


---

---

## CoT-SC（Self-Consistency）自洽性范式详解

> **Self-Consistency** —— 同一个问题跑多次思维链，投票取最一致的答案。用"多次思考"换"更高准确率"。

### 1. 一句话总结

对同一个问题**独立采样多条思维链**（多次推理），统计所有答案的**频次**，取出现最多的那个作为最终答案 —— 相当于"思维链的民主投票"。

### 2. 核心思想

- **论文**：《Self-Consistency Improves Chain of Thought Reasoning in Language Models》(Wang et al., 2022, ICLR)
- **关键发现**：同一个问题，模型每次推理的路径不同（有的对有的错），但**正确答案往往比错误答案更"一致"**——不同路径常汇聚到同一个正确结果。所以投票能"淘出"正确性。
- **与贪婪解码的区别**：贪婪解码只走一条路径（最优路径可能是错的）；Self-Consistency 探索多条路径再汇聚。

### 3. 工作原理

```text
                 ┌─ 路径1: 5-2=3, 3+3=6 → 答案: 6
                 ├─ 路径2: 5+3=8, 8-2=6 → 答案: 6
问题 ─采样 N 次─▶ ├─ 路径3: 5-2=3, 3+3=6 → 答案: 6
   （temperature>0）├─ 路径4: 2+3=5, 5+5=10 → 答案: 10（错）
                 └─ 路径5: 3+3=6 → 答案: 6

投票: 6 出现 4 次 → 最终答案: 6 ✅
```

关键点：采样时 `temperature` 要调高（如 0.7），路径才有多样性；投票逻辑按答案字符串/规范化后的内容聚合。

### 4. 完整示例（LangChain 实现）

#### 4.1 手动实现（最直观）

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from collections import Counter

llm = ChatOpenAI(model="gpt-4o", temperature=0.7)   # 注意：温度调高

prompt = PromptTemplate.from_template("""问题：{question}
一步一步推理，最后以「答案：X」结尾。""")

def self_consistency(question: str, n: int = 5) -> str:
    answers = []
    for _ in range(n):
        output = llm.invoke(prompt.format(question=question)).content
        # 提取「答案：」后面的部分
        answer = output.split("答案：")[-1].strip()
        answers.append(answer)
        print(f"路径: {answer}")

    # 投票：取出现次数最多的答案
    most_common = Counter(answers).most_common(1)[0][0]
    print(f"→ 最终答案（投票）: {most_common}")
    return most_common

self_consistency("小明有 5 个苹果，给了小红 2 个，又买了 3 个，现在有几个？", n=5)
```

#### 4.2 结构化实现（按答案字段投票）

```python
from langchain_core.output_parsers import JsonOutputParser

json_prompt = PromptTemplate.from_template("""问题：{question}
推理后以 JSON 输出: {{"steps": "推理过程", "answer": "答案"}}""")

def self_consistency_json(question: str, n: int = 5) -> str:
    counter = Counter()
    chain = json_prompt | llm | JsonOutputParser()
    for _ in range(n):
        result = chain.invoke({"question": question})
        counter[result["answer"]] += 1
    return counter.most_common(1)[0][0]

print(self_consistency_json("一个数的 3 倍加上 5 等于 20，这个数是多少？"))
```

#### 4.3 LangGraph 并行采样（更快）

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
from typing import TypedDict, List
from collections import Counter

class SCState(TypedDict):
    question: str
    n: int
    answers: List[str]

def sample_one(question: str, i: int) -> str:
    """单条采样路径（可独立并行执行）"""
    out = llm.invoke(prompt.format(question=question)).content
    return out.split("答案：")[-1].strip()

def fan_out(state: SCState):
    """并行发起 n 次采样（Send 创建并行分支）"""
    return [Send("sampler", {"question": state["question"], "i": i})
            for i in range(state["n"])]

def vote(state: SCState) -> SCState:
    state["answers"] = sorted(state["answers"])
    state["final"] = Counter(state["answers"]).most_common(1)[0][0]
    return state

# 简化构图（sampler 为并行节点，collect 聚合）
# …（完整实现见 LangGraph 并行文档）
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 准确率显著提升（论文：GSM8K 上比单次 CoT +17.9%） | token 成本 ×N（采样次数） |
| 不需要训练、不需要额外数据 | 延迟增加（需等所有路径完成） |
| 与 few-shot/zero-shot CoT 都兼容 | 对"答案本身就不确定"的任务无意义 |
| 实现简单（循环 + 计数器） | 温度太低时路径无多样性，投票失效 |

### 6. 适用场景

- **高价值推理任务**：数学题、代码题、逻辑判断（错不起的场景）
- **评测基准冲刺**：需要刷高准确率时
- **答案确定性高的任务**：有唯一正确答案的任务收益最大

### 7. 参数调优建议

| 参数 | 建议 |
|---|---|
| 采样次数 N | 5~10 次收益最大，超过 10 次边际递减 |
| temperature | 0.5~0.8（太低路径雷同，太高路径太散） |
| 投票粒度 | 数值题先归一化（"6"与"6 个"视为同一答案） |
| 并行 | 用 LangGraph Send / asyncio 并行采样降延迟 |

### 8. 与相关范式的关系

| 范式 | 关系 |
|---|---|
| CoT | SC 是 CoT 的多次采样 + 投票升级版 |
| ToT | SC 只"并行采样"，不做分支评估与回溯；ToT 是结构化搜索 |
| Reflexion | SC 投票选最好；Reflexion 用记忆逐轮改进 |
| Self-Ask | SC 聚焦"答案聚合"；Self-Ask 聚焦"问题分解" |

### 9. 生产建议

1. **成本敏感时用 3~5 次采样**，收益与成本平衡最好。
2. 投票前做**答案规范化**（去单位、去空格、统一格式），否则"6"和"6个"会分票。
3. 与 **Plan-and-Solve** 提示词组合：先规划再采样，效果叠加。
4. 在 Agent 中慎用：工具调用场景每次采样会重复调工具，成本爆炸；主要用于纯推理环节。

---

---


---

## Self-Ask 范式详解

> **Self-Ask** —— 模型自己拆解子问题、自问自答（可穿插检索），再汇总答案。显式的多跳推理。

### 1. 一句话总结

让模型把复杂问题**显式拆成若干子问题**，逐个自问自答（需要时可以检索外部信息），最后汇总所有子答案得到最终答案 —— 特别适合"多跳问答"（multi-hop QA）。

### 2. 核心思想

- **论文**：《Measuring and Narrowing the Compositionality Gap in Language Models》(Press et al., 2022)
- **背景问题**：模型对"需要组合多个事实"的问题（如"谁出演了《老友记》中扮演 Rachel 的演员主演的电影？"）经常答错，因为中间事实缺失。
- **解决方案**：提示词要求模型输出 `Follow up question`（子问题）和 `Intermediate answer`（中间答案），显式走完每一步推理；子问题可触发检索工具，把"外部知识"补进推理链。

### 3. 工作原理

```text
问题: 扮演 Rachel 的演员主演了哪部 2023 年的电影？

Follow up: 谁在《老友记》中扮演 Rachel？
Intermediate answer: Jennifer Aniston
Follow up: Jennifer Aniston 主演了哪些 2023 年的电影？
Intermediate answer: 《换屋假期》(Murder Mystery 2)
Final answer: Jennifer Aniston 主演了《换屋假期》。
```

### 4. 完整示例

#### 4.1 LangChain（SelfAskWithSearchChain，经典实现）

```python
from langchain.agents import initialize_agent, AgentType
from langchain.agents.agent_toolkits.self_ask_with_search import SelfAskWithSearchChain
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 需要一个搜索工具（这里用占位实现，生产接真实搜索 API）
def fake_search(query: str) -> str:
    facts = {
        "扮演 rachel 的演员": "Jennifer Aniston",
        "jennifer aniston 2023 电影": "《换屋假期》",
    }
    return facts.get(query.lower(), f"未找到: {query}")

search_tool = Tool(name="Intermediate Answer", func=fake_search)

# 官方内置的 Self-Ask 链（自动生成 Follow up question 并检索）
self_ask_chain = SelfAskWithSearchChain(
    llm=llm,
    search_chain=search_tool,  # 实际项目中传 Tool 实例
    verbose=True,
)

print(self_ask_chain.run("扮演 Rachel 的演员主演了哪部 2023 年的电影？"))
```

#### 4.2 手写 Self-Ask 提示词（更可控）

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

llm = ChatOpenAI(model="gpt-4o", temperature=0)

SELF_ASK_PROMPT = PromptTemplate.from_template("""你是问答助手。遇到复杂问题时：
1. 如果需要先知道某个中间事实，输出：Follow up: <子问题>
2. 回答完子问题后输出：Intermediate answer: <答案>
3. 如果不需要更多信息，输出：Final answer: <最终答案>

问题: {question}""")

def self_ask(question: str, max_hops: int = 3):
    """模拟多轮：模型提出子问题 → 检索 → 继续，直到给出最终答案"""
    for _ in range(max_hops):
        output = llm.invoke(SELF_ASK_PROMPT.format(question=question)).content
        print(output)
        if output.strip().startswith("Final answer"):
            return output
        # 解析 Follow up 问题并"检索"
        if "Follow up:" in output:
            sub_q = output.split("Follow up:")[-1].strip()
            answer = fake_search(sub_q)   # 检索外部知识
            question += f"\nIntermediate answer: {answer}"
    return "达到最大轮数"

self_ask("扮演 Rachel 的演员主演了哪部 2023 年的电影？")
```

#### 4.3 LangGraph（子问题显式节点化，可并行）

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, List

class SelfAskState(TypedDict):
    question: str
    sub_questions: List[str]
    sub_answers: dict
    final: str

def decompose(state: SelfAskState) -> SelfAskState:
    """拆子问题"""
    text = llm.invoke(f"把问题拆成需要依次回答的子问题列表，JSON数组输出。问题：{state['question']}").content
    state["sub_questions"] = extract_json_list(text)
    return state

def answer_sub(state: SelfAskState) -> SelfAskState:
    """逐个回答子问题（可检索）"""
    for q in state["sub_questions"]:
        state["sub_answers"][q] = fake_search(q)  # 检索或直接回答
    return state

def compose(state: SelfAskState) -> SelfAskState:
    """汇总"""
    context = "\n".join(f"{k}: {v}" for k, v in state["sub_answers"].items())
    state["final"] = llm.invoke(
        f"基于以下中间答案回答原问题：{state['question']}\n{context}"
    ).content
    return state
# 构图：decompose → answer_sub → compose（略）
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 显式分解，推理过程可审计 | 子问题拆得不好，整体跟着错 |
| 每个子问题可独立检索，补足知识 | 提示词格式约束不稳定（模型可能不按格式输出） |
| 比隐式 CoT 更可控（可插入工具） | 子问题串行时延迟增加 |
| 适合复合事实问题 | 需要设计"何时停止拆解"的机制 |

### 6. 适用场景

- **多跳问答**：需要组合多个事实的问题（人物-作品-事件链）
- **知识图谱式查询**：先查实体 A，再查与 A 相关的事实
- **教育/推理演示**：想展示"拆解过程"的产品

### 7. 与相关范式对比

| 范式 | 分解方式 | 检索 | 答案聚合 |
|---|---|---|---|
| CoT | 隐式步骤 | 无 | 最后一步 |
| Self-Ask | **显式子问题** | 可 | 汇总中间答案 |
| ReAct | 隐式 Thought | 有（工具） | 循环终止 |
| CoT-SC | 多条隐式链 | 无 | 投票 |

### 8. 生产建议

1. **严格约束输出格式**：`Follow up:` / `Intermediate answer:` / `Final answer:` 前缀，便于正则解析。
2. 子问题检索失败时，让模型"换个问法重试"，而不是直接放弃。
3. 限制最大跳数（3~5），防止无限拆解。
4. 现在多数场景可以直接用 Tool Calling agent 实现同等效果，Self-Ask 的价值在于**显式子问题结构**，适合需要展示推理过程的产品。

---


---

## Plan-and-Solve 范式详解

> **先制定计划，再逐步解题** —— 一种提示词技巧：要求模型"先规划，再执行"，比普通思维链（CoT）更可靠。

### 1. 一句话总结

在提示词中明确要求模型：**先抽取问题变量、制定分步计划，再按计划逐步求解** —— 解决 CoT"边算边想"导致的错误累积问题。

### 2. 核心思想

- **论文**：《Plan-and-Solve Prompting: Improving Zero-Shot Chain-of-Thought Reasoning by Large Language Models》(Wang et al., 2023, ACL)
- **背景问题**：零样本 CoT 只加一句"Let's think step by step"，模型容易：遗漏条件、重复计算、步骤跳跃。
- **解决方案**：把提示词改成三个阶段：
  1. **提取变量**：列出问题中的所有已知信息
  2. **制定计划**：先写出完整的解题步骤（不计算）
  3. **逐步执行**：按计划一步一步算，最后给出答案

### 3. 工作原理

```text
普通 CoT:   问题 → 直接一步步算 → 答案（边想边算，可能跑偏）
Plan-and-Solve: 问题 → 提取变量 → 制定计划 → 按计划执行 → 答案
```

提示词模板（核心区别就在这里）：

```text
让我们先理解问题并制定计划，然后按计划逐步解决。
首先，列出题目给出的所有条件。
其次，制定一个完整的解题计划。
最后，严格按照计划逐步计算，得出答案。
```

### 4. 完整示例（数学题）

#### 4.1 提示词对比

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

llm = ChatOpenAI(model="gpt-4o", temperature=0)

question = """小明有 5 个苹果，给了小红 2 个，又买了 3 个，然后吃掉了 1 个。
现在小明有几个苹果？"""

# ❌ 普通零样本 CoT
cot_prompt = PromptTemplate.from_template(
    "问题：{q}\n让我们一步一步思考："
)
print(llm.invoke(cot_prompt.format(q=question)).content)

# ✅ Plan-and-Solve
ps_prompt = PromptTemplate.from_template("""问题：{q}

请按以下格式回答：
1. 已知条件：列出所有数字和关系
2. 解题计划：写出步骤（不要计算）
3. 逐步执行：按计划逐步计算
4. 最终答案""")
print(llm.invoke(ps_prompt.format(q=question)).content)
```

期望输出：

```text
1. 已知条件：初始 5 个；给小红 -2；买 +3；吃掉 -1
2. 解题计划：初始数量 - 给出数量 + 买入数量 - 吃掉数量
3. 逐步执行：5 - 2 = 3；3 + 3 = 6；6 - 1 = 5
4. 最终答案：5 个苹果
```

#### 4.2 封装成 LangChain Chain（结构化输出）

```python
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

ps_chain = ps_prompt | llm | StrOutputParser()

# 批量推理
questions = [
    "一个长方形的长是 12 厘米，宽是长的三分之二，求面积。",
    "甲乙两地相距 240 公里，两车相向而行，速度分别为 60 和 80 km/h，多久相遇？",
]
for q in questions:
    print(ps_chain.invoke({"q": q}))
```

### 5. 变体：PS+（Plan-and-Solve + 细节指令）

论文还提出了 PS+ 变体：追加"仔细思考问题含义、提取相关变量、注意计算细节"等指令，进一步提升：

```text
让我们先理解问题并制定计划，然后按计划逐步解决。
仔细思考问题的含义，提取所有相关的变量及其对应数值，
制定一个完整、清晰的解题计划（不要开始计算），
然后严格按照计划逐步计算，注意每一步的细节，最后给出答案。
```

### 6. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 比零样本 CoT 准确率显著提升（论文：GSM8K +17.6%） | 仍是单轮生成，无法获取外部信息 |
| 零样本即可用，无需示例（few-shot） | 计划步骤多时 token 增加 |
| 提示词通用，任何推理任务直接套用 | 对复杂开放式问题帮助有限 |
| 与任何 LLM 框架兼容（就是一段 prompt） | 模型不遵守格式时输出不稳定 |

### 7. 适用场景

- **数学应用题**、**逻辑推理题**
- **多条件约束问题**（如排班、分配）
- **代码题解题思路**（先写伪代码计划再实现）
- 作为 ReAct / Agent 中"思考"环节的提示词基础

### 8. 与 CoT / ReAct 的关系

| 维度 | CoT | Plan-and-Solve | ReAct |
|---|---|---|---|
| 规划 | 无（直接算） | 先计划后执行 | 边想边做 |
| 工具 | 无 | 无 | 有 |
| 提示词改动 | 加"一步步想" | 加"先计划再执行" | 加 Thought/Action 格式 |
| 适用 | 简单推理 | 复杂多步推理 | 需要外部信息的任务 |

> 实践中 Plan-and-Solve 的提示词结构可以直接用作 ReAct agent 的 Thought 引导。

### 9. 生产建议

1. 零样本首选 PS+ 提示词模板，几乎零成本提升。
2. 结构化输出：要求"计划"和"执行"分开输出（如用 JSON），便于解析和审计。
3. 与 **Self-Consistency**（多次采样投票）叠加，效果更好。
4. 在 Agent 里用它约束"思考"部分：`Thought: 先制定计划…`，减少工具乱调用。
---


---

## ToT（Tree of Thoughts）思维树范式详解

> **Tree of Thoughts** —— 把推理当成搜索树：多分支探索、评估、回溯，找到最优推理路径。

### 1. 一句话总结

不再只走一条推理链，而是让模型在每个决策点**生成多个候选思路**，评估每个思路的好坏，选择最有希望的继续深入，走不通就**回溯**换分支 —— 像下棋一样"想几步、挑最优"。

### 2. 核心思想

- **论文**：《Tree of Thoughts: Deliberate Problem Solving with Large Language Models》(Yao et al., 2023, NeurIPS)
- **与 CoT 的区别**：CoT 是一条直线（一条路走到黑）；ToT 是一棵树（每个节点分支 + 评估 + 回溯）。
- **四个要素**：
  1. **Thought Generator**：生成候选思路（采样生成或提议生成）
  2. **State Evaluator**：评估每个候选的价值（模型打分或投票）
  3. **Search Algorithm**：决定探索策略（BFS 广度优先 / DFS 深度优先）
  4. **Backtracking**：分支无望时回到上一层换分支

### 3. 工作原理

```text
                      ┌─ 思路A1 (0.8) ──▶ 深入……
        ┌─ 思路A ─────┤
        │             └─ 思路A2 (0.4) ✗ 放弃
问题 ────┼─ 思路B ─────┐
        │             ├─ 思路B1 (0.7) ──▶ 深入……
        │             └─ 思路B2 (0.9) ──▶ 深入…… ─▶ 找到答案 ✅
        └─ 思路C (0.3) ✗ 直接放弃

（括号内为评估分数，每层保留 Top-K 继续）
```

以"24 点游戏"为例：从 4 张牌出发，每一步尝试一种运算组合（分支），用模型评估该组合"离目标还有多远"，优先探索评估高的分支，必要时回溯。

### 4. 完整示例（LangGraph 实现 BFS 搜索）

```python
import json
from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

class ToTState(TypedDict):
    problem: str
    current_path: List[str]   # 当前推理链
    best_path: List[str]
    depth: int
    done: bool
    answer: str

MAX_DEPTH = 3
BRANCHES = 3
TOP_K = 2

def generate_candidates(state: ToTState) -> ToTState:
    """每个节点生成 BRANCHES 个候选思路"""
    prompt = f"""问题: {state['problem']}
当前推理进度: {' → '.join(state['current_path']) if state['current_path'] else '尚未开始'}
请生成 {BRANCHES} 个不同的下一步思路，JSON 数组输出（每个元素是一个字符串）。"""
    text = llm.invoke([HumanMessage(content=prompt)]).content
    candidates = extract_json_list(text)
    state["candidates"] = candidates
    return state

def evaluate(state: ToTState) -> ToTState:
    """评估每个候选并保留 Top-K"""
    scores = {}
    for c in state["candidates"]:
        score = llm.invoke([HumanMessage(content=f"""思路「{c}」对于解决问题「{state['problem']}」有多大帮助？
只输出一个 0-1 之间的分数，如 0.85""")]).content
        scores[c] = float(score.strip()[:4])
    state["candidates"] = sorted(scores, key=scores.get, reverse=True)[:TOP_K]
    return state

def advance(state: ToTState) -> ToTState:
    """选最高分分支深入（DFS 简化版：这里演示单分支深入）"""
    best = state["candidates"][0]
    state["current_path"].append(best)
    state["depth"] += 1
    return state

def should_stop(state: ToTState) -> bool:
    # 简化：达到深度或候选都被放弃时停止
    return state["depth"] >= MAX_DEPTH

# 构图（BFS/DFS 完整实现较复杂，这里给出核心节点结构）
builder = StateGraph(ToTState)
builder.add_node("generate", generate_candidates)
builder.add_node("evaluate", evaluate)
builder.add_node("advance", advance)
builder.add_edge(START, "generate")
builder.add_edge("generate", "evaluate")
builder.add_edge("evaluate", "advance")
builder.add_edge("advance", "generate")   # 循环：深入下一层
graph = builder.compile()
```

> 完整 BFS/DFS 需要在节点间维护多个待探索路径（用列表做队列/栈），上述示例演示了"生成 → 评估 → 深入"的核心循环。

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 探索多条路径，不易一条路走死 | 计算成本极高（分支 × 深度 × 每步 LLM 调用） |
| 有评估与回溯，答案质量更高 | 评估环节本身不可靠（模型打分有偏差） |
| 适合开放式、创造性问题 | 实现复杂度高 |
| 论文实验：24 点游戏成功率 4% → 74% | 问题简单时不值得（杀鸡用牛刀） |

### 6. 适用场景

- **谜题/游戏**：24 点、数独、迷宫、填字
- **创意写作**：多方案构思后选优
- **数学证明**：多路径尝试
- **规划类**：需要前瞻多步的决策

### 7. 搜索策略选择

| 策略 | 特点 | 适合 |
|---|---|---|
| **BFS** | 逐层扩展，保留 Top-K | 深度浅、分支多的问题 |
| **DFS + 回溯** | 一条路深入，不行就回退 | 路径长、有明确终点的 |
| **Beam Search** | 每层保留 K 条最好路径 | 折中方案，最常用 |

### 8. 与相关范式对比

| 范式 | 结构 | 评估 | 回溯 |
|---|---|---|---|
| CoT | 单链 | 无 | 无 |
| CoT-SC | 多条独立链 | 投票（只看终点） | 无 |
| ToT | 树 | 每步评估 | 有 |
| GoT | 图（分支可合并） | 每步评估 | 有 |
| RAP | 树 + MCTS | 世界模型预测 | 有 |

### 9. 生产建议

1. **控制成本**：深度 ≤ 3、分支 ≤ 3、Top-K ≤ 2，成本可接受。
2. 评估用**相对打分**（"这条比那条好吗"）比绝对打分稳定。
3. 与 LangGraph 的并行能力结合：同一层的分支用 Send 并行评估。
4. 现实产品中 ToT 更适合"慢但准"的场景（研究助手、解谜工具），不适合实时对话。
---


---

---

## GoT（Graph of Thoughts）思维图范式详解

> **Graph of Thoughts** —— ToT 的升级版：推理结构从"树"变成"图"，允许**分支合并、跨路径组合**，表达力更强。

### 1. 一句话总结

ToT 的分支只能"发散"，不能"汇聚"；GoT 允许**多个推理路径合并成新思路**（类似多个子结论合成一个结论），推理结构从树变为图（DAG）。

### 2. 核心思想

- **论文**：《Graph of Thoughts: Solving Elaborate Problems with Large Language Models》(Besta et al., 2023)
- **核心操作**（类比图算法）：
  - **Gather（汇聚）**：把多条路径的结论合并成一个新思路（树做不到）
  - **Generate（生成）**：从一个思路生成新分支
  - **Score（打分）**：评估思路价值
  - **Best（择优）**：选全局最优路径
- **优势场景**：任务可以拆成多个独立子问题、最后需要组合的场景，GoT 比 ToT 少走很多弯路。

### 3. 工作原理

```text
ToT（树）:                       GoT（图）:
     A                              A
    / \                            / \
   B   C                          B   C
   |   |                          |   |
   D   E                          └─┬─┘
        \                            │  ← 合并（Gather）
         F                           G ← 组合后的新思路
                                    / \
                                   H   I
```

示例（文章大纲生成）：

```text
思路1: 开头方案A      思路2: 开头方案B
        │                    │
思路3: 正文结构X     思路4: 正文结构Y
        └────────┬───────────┘
             合并: 开头方案A + 正文结构Y（跨路径组合）
                    │
              最终大纲（比任一路径都完整）
```

### 4. 完整示例（LangGraph 实现"汇聚"操作）

```python
from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

class GoTState(TypedDict):
    problem: str
    branches: List[str]      # 并行探索的分支
    merged: str              # 汇聚后的思路
    final: str

def generate_branches(state: GoTState) -> GoTState:
    """并行生成 3 个独立思路（实际用 Send 并行）"""
    prompt = f"问题: {state['problem']}\n生成 3 个不同的解题思路，JSON 数组输出。"
    state["branches"] = extract_json_list(
        llm.invoke([HumanMessage(content=prompt)]).content
    )
    return state

def evaluate_branches(state: GoTState) -> GoTState:
    """分别评估每个思路（并行）"""
    scored = []
    for b in state["branches"]:
        score = llm.invoke([HumanMessage(
            content=f"思路「{b}」质量如何？只输出 0-1 分数")]).content
        scored.append((b, float(score.strip()[:4])))
    state["branches"] = [b for b, _ in sorted(scored, key=lambda x: -x[1])]
    return state

def gather(state: GoTState) -> GoTState:
    """Gather：合并 Top-2 思路（树结构做不到的操作）"""
    top2 = state["branches"][:2]
    state["merged"] = llm.invoke([HumanMessage(content=f"""问题: {state['problem']}
两个候选思路:
1. {top2[0]}
2. {top2[1]}
请取两者之长，合并成一个更完整的思路。""")]).content
    return state

def finalize(state: GoTState) -> GoTState:
    state["final"] = llm.invoke([HumanMessage(
        content=f"基于合并思路完成问题: {state['problem']}\n思路: {state['merged']}"
    )]).content
    return state

# 构图：generate → evaluate → gather（合并）→ finalize
builder = StateGraph(GoTState)
builder.add_node("generate", generate_branches)
builder.add_node("evaluate", evaluate_branches)
builder.add_node("gather", gather)
builder.add_node("finalize", finalize)
builder.add_edge(START, "generate")
builder.add_edge("generate", "evaluate")
builder.add_edge("evaluate", "gather")
builder.add_edge("gather", "finalize")
builder.add_edge("finalize", END)
graph = builder.compile()

result = graph.invoke({
    "problem": "为一篇「AI Agent 发展史」的文章设计大纲",
})
print("合并后的思路:", result["merged"])
```

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 可合并多条路径，比 ToT 表达力强 | 实现复杂度最高 |
| 子问题可并行探索 + 组合，效率更高 | 合并时机/合并哪些路径需要额外设计 |
| 适合"分解-组合"型任务 | 成本依然很高（多次 LLM 调用） |
| 论文实验：排序任务比 ToT 少用 62% 的算力 | 社区生态不如 CoT/ReAct 成熟 |

### 6. 适用场景

- **内容创作**：多个大纲/方案合并择优
- **代码设计**：多个子模块方案组合成完整设计
- **科学研究助手**：多假设并行验证后综合
- **排序/规划类**：论文中用排序任务验证了巨大收益

### 7. 与 ToT 的关键区别

| 维度 | ToT | GoT |
|---|---|---|
| 结构 | 树 | 图（DAG） |
| 分支合并 | 不支持 | **支持（Gather）** |
| 信息流 | 单向发散 | 发散 + 汇聚 |
| 复杂度 | 中 | 高 |
| 适合 | 单一最优解探索 | 多子问题组合 |

### 8. 生产建议

1. **只在任务确实需要"组合多个独立结论"时用 GoT**，否则 ToT 或 CoT 更划算。
2. 合并操作（Gather）是核心，提示词要明确"取两者之长"，避免合并结果退化。
3. 分支评估和合并可全部并行（LangGraph Send API），把延迟压下来。
4. 目前没有主流框架原生支持 GoT，按需用 LangGraph 自建。

---

---


---

## RAP（Reasoning as Planning）范式详解

> **Reasoning as Planning with World Model** —— 用蒙特卡洛树搜索（MCTS）做推理：把"思考"当游戏树来搜索最优路径。

### 1. 一句话总结

把推理问题建模成**决策过程**：LLM 扮演"世界模型"预测每一步的结果，再用 **MCTS（蒙特卡洛树搜索）** 在推理树上搜索——前瞻、模拟、回溯，找到最可靠的推理路径。

### 2. 核心思想

- **论文**：《Reasoning with Language Model is Planning with World Model》(Hao et al., 2023, EMNLP)
- **两个角色**：
  - **World Model（世界模型）**：LLM 本身——给定状态，预测下一步动作的可能结果
  - **MCTS Planner（规划器）**：在"状态-动作"树上做搜索：
    1. **选择（Select）**：用 UCT 公式选最有价值的分支
    2. **扩展（Expand）**：生成该状态下的候选动作（下一步推理）
    3. **模拟（Simulate）**：从新节点快速推演到终点
    4. **回溯（Backprop）**：把结果分数回传更新祖先节点
- **与 ToT 的区别**：ToT 靠 LLM 直接打分评估节点；RAP 用 **MCTS + 世界模型模拟**，评估更接近"实际推演结果"。

### 3. 工作原理

```text
                    S0（初始状态）
                   /    |    \
        动作a1    动作a2  动作a3      ← 扩展：生成候选推理步骤
          /        |       \
        S1        S2       S3
        / \       / \
     a1  a2    a1  a2       ← 选择：按 UCT 值挑分支
    ... ...  ...  ...
    （模拟到终点，回传分数，更新 UCT 值）
    重复 N 次后，取访问次数最多的路径作为答案
```

MCTS 四个步骤示意：

```text
选择(Select) → 扩展(Expand) → 模拟(Simulate) → 回溯(Backprop)
  按UCT选分支     生成新动作      推演到终点      更新节点分数
```

### 4. 完整示例（简化 MCTS + LLM 世界模型）

```python
import math, random
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

class Node:
    def __init__(self, state: str, parent=None):
        self.state = state
        self.parent = parent
        self.children = []
        self.visits = 0
        self.value = 0.0

    def uct(self, c=1.4):
        """UCT 公式：利用 + 探索"""
        if self.visits == 0:
            return float("inf")
        exploitation = self.value / self.visits
        exploration = c * math.sqrt(math.log(self.parent.visits + 1) / self.visits)
        return exploitation + exploration

def generate_actions(state: str, problem: str) -> list:
    """扩展：LLM 世界模型生成下一步候选动作"""
    text = llm.invoke(f"""问题: {problem}
当前状态: {state}
生成 3 个不同的下一步推理动作，JSON 数组输出。""").content
    return extract_json_list(text)

def simulate(state: str, problem: str) -> float:
    """模拟：从当前状态推演，返回 0-1 的置信分数"""
    score = llm.invoke(f"""问题: {problem}
推理链: {state}
这条推理链最终得到正确答案的可能性多大？只输出 0-1 分数""").content
    return float(score.strip()[:4])

def mcts_search(problem: str, iterations: int = 10, budget: int = 3):
    root = Node("初始")
    for _ in range(iterations):
        # 1. 选择
        node = root
        while node.children:
            node = max(node.children, key=lambda n: n.uct())
        # 2. 扩展
        if node.visits > 0 and len(node.children) < budget:
            actions = generate_actions(node.state, problem)
            for a in actions:
                node.children.append(Node(f"{node.state} → {a}", parent=node))
            node = random.choice(node.children)
        # 3. 模拟
        score = simulate(node.state, problem)
        # 4. 回溯
        while node:
            node.visits += 1
            node.value += score
            node = node.parent
    # 取访问最多的路径
    best = max(root.children, key=lambda n: n.visits)
    return best.state

print(mcts_search("鸡兔同笼：头 35 个，脚 94 只，各几只？", iterations=10))
```

> 生产级 RAP 建议参考官方实现（`llm-reasoners` 库），它支持任务专用策略、状态抽象和更完整的 MCTS 库。

### 5. 优点与缺点

| 优点 | 缺点 |
|---|---|
| 评估基于"模拟推演"，比 ToT 的直接打分更可靠 | 实现最复杂，需要 MCTS 工程基础 |
| 适合需要前瞻规划的决策问题（游戏、路径规划） | 计算成本极高（多次模拟 × 每次 LLM 调用） |
| 有理论支撑（强化学习/搜索算法迁移） | 世界模型的预测误差会传播 |
| 论文实验：24 点、Blocksworld、Mini Crosswords 上超越 ToT | 推理问题简单时不划算 |

### 6. 适用场景

- **游戏决策**：24 点、国际象棋变体、文字冒险游戏
- **规划任务**：Blocksworld 积木世界、任务调度
- **需要前瞻多步的推理**：决策链长的场景

### 7. 与其他推理范式的对比

| 维度 | CoT | ToT | RAP |
|---|---|---|---|
| 搜索结构 | 单链 | 树（LLM 打分） | **树（MCTS + 世界模型）** |
| 评估方式 | 无 | LLM 直接打分 | **模拟推演打分** |
| 前瞻性 | 无 | 有限 | **强（模拟到终点）** |
| 实现难度 | 低 | 中 | 高 |

### 8. 生产建议

1. **迭代次数与预算要设上限**：10~50 次迭代、每节点 3 个分支是常见配置。
2. 世界模型提示词要包含"目标 + 当前状态 + 约束"，否则生成的动作会跑题。
3. 结果路径要保留完整推理链（每步状态），便于审计。
4. 现实产品中 RAP 多用于**离线优化**（如策略生成后缓存），而非在线实时回答。
