---
title: "LangChain快速入门"
tags:
  - "Agent"
  - "LangChain"
  - "框架"
category: "Agent开发"
folder: "框架实战"

created: 2026-09-07
updated: 2026-09-07
---

# LangChain 快速入门

> LangChain 是目前最流行的 LLM 应用开发框架,提供从简单Prompt到复杂Agent的全套组件。本文从零开始,30分钟上手 LangChain。

---

## 一、为什么选择 LangChain?

### 1.1 核心优势

| 优势 | 说明 | 对比原生开发 |
|-----|------|------------|
| **组件化** | 可复用的模块(Models/Chains/Agents) | 避免重复造轮子 |
| **抽象层** | 统一接口支持多个LLM提供商 | 轻松切换OpenAI/Claude/开源模型 |
| **生态丰富** | 100+ 集成(向量库/工具/API) | 节省80%集成时间 |
| **最佳实践** | 内置prompt模板/记忆管理 | 开箱即用的高质量方案 |
| **调试工具** | LangSmith可视化trace | 快速定位问题 |

### 1.2 架构全景

```
┌─────────────────────────────────────────────────────┐
│                   LangChain 架构                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │  Models  │  │ Prompts  │  │  Output  │         │
│  │          │  │          │  │  Parsers │         │
│  │ LLMs     │  │ Templates│  │          │         │
│  │ ChatModels│  │ Examples │  │ JSON/XML │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│        ↓              ↓              ↓              │
│  ┌──────────────────────────────────────┐          │
│  │            Chains                    │          │
│  │  LLMChain / SequentialChain / ...   │          │
│  └──────────────────────────────────────┘          │
│        ↓                                            │
│  ┌──────────────────────────────────────┐          │
│  │            Agents                    │          │
│  │  ReAct / Plan-Execute / OpenAI Func │          │
│  └──────────────────────────────────────┘          │
│        ↓                                            │
│  ┌──────────────────────────────────────┐          │
│  │      Tools & Memory                  │          │
│  │  Search / Calculator / VectorStore   │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```
---

## 二、环境搭建

### 2.1 安装

```bash
# 核心库
pip install langchain

# LLM 提供商
pip install langchain-openai  # OpenAI
pip install langchain-anthropic  # Claude
pip install langchain-community  # 社区集成

# 可选: 向量数据库
pip install chromadb  # 轻量级向量库
pip install faiss-cpu  # Facebook向量检索

# 可选: 工具
pip install duckduckgo-search  # 网络搜索
pip install wikipedia  # 维基百科

# 版本检查
python -c "import langchain; print(langchain.__version__)"
```

### 2.2 API Key 配置

```python
import os

# 方式1: 环境变量(推荐)
os.environ["OPENAI_API_KEY"] = "sk-..."
os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."

# 方式2: .env 文件
# 创建 .env 文件:
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

from dotenv import load_dotenv
load_dotenv()

# 方式3: 直接传参(不推荐,容易泄露)
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(api_key="sk-...")
```

---

## 三、核心概念速览

### 3.1 六大核心组件

```python
# 1. Models: LLM封装
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="gpt-4", temperature=0.7)

# 2. Prompts: 提示词模板
from langchain.prompts import PromptTemplate
prompt = PromptTemplate.from_template("翻译: {text}")

# 3. Chains: 组件链接
from langchain.chains import LLMChain
chain = LLMChain(llm=llm, prompt=prompt)

# 4. Agents: 自主决策
from langchain.agents import create_react_agent
agent = create_react_agent(llm, tools, prompt)

# 5. Memory: 记忆管理
from langchain.memory import ConversationBufferMemory
memory = ConversationBufferMemory()

# 6. Tools: 工具集成
from langchain.tools import WikipediaQueryRun
tool = WikipediaQueryRun()
```
---

## 四、Hello World 示例

### 4.1 最简单的调用

```python
from langchain_openai import ChatOpenAI

# 创建模型
llm = ChatOpenAI(
    model="gpt-3.5-turbo",
    temperature=0.7
)

# 直接调用
response = llm.invoke("什么是LangChain?")
print(response.content)

# 输出:
# LangChain是一个开源框架,用于构建基于大语言模型的应用程序...
```

### 4.2 使用消息列表(推荐)

```python
from langchain_core.messages import HumanMessage, SystemMessage

messages = [
    SystemMessage(content="你是一个专业的Python教练"),
    HumanMessage(content="如何学习Python?")
]

response = llm.invoke(messages)
print(response.content)
```

### 4.3 流式输出

```python
# 流式返回,实时显示生成过程
for chunk in llm.stream("写一首关于编程的诗"):
    print(chunk.content, end="", flush=True)

# 输出:
# 代码如诗句,
# 逻辑似乐章,
# ...
```

---

## 五、Prompt 模板

### 5.1 基础模板

```python
from langchain.prompts import PromptTemplate

# 创建模板
template = """
你是{role}。

任务: {task}

要求:
- 简洁明了
- 给出示例

回答:
"""

prompt = PromptTemplate(
    input_variables=["role", "task"],
    template=template
)

# 使用模板
formatted = prompt.format(
    role="Python专家",
    task="解释装饰器"
)

print(formatted)
```

### 5.2 ChatPrompt (对话模板)

```python
from langchain.prompts import ChatPromptTemplate

# 定义多轮对话模板
chat_prompt = ChatPromptTemplate.from_messages([
    ("system", "你是{role},回答风格为{style}"),
    ("human", "{user_input}"),
])

# 格式化
messages = chat_prompt.format_messages(
    role="技术作家",
    style="简洁实用",
    user_input="什么是闭包?"
)

response = llm.invoke(messages)
print(response.content)
```

### 5.3 Few-shot 模板

```python
from langchain.prompts import FewShotPromptTemplate

# 定义示例
examples = [
    {
        "question": "Python中如何创建列表?",
        "answer": "使用方括号: my_list = [1, 2, 3]"
    },
    {
        "question": "如何遍历列表?",
        "answer": "使用for循环: for item in my_list: print(item)"
    }
]

# 示例模板
example_prompt = PromptTemplate(
    input_variables=["question", "answer"],
    template="Q: {question}\nA: {answer}"
)

# Few-shot 模板
few_shot_prompt = FewShotPromptTemplate(
    examples=examples,
    example_prompt=example_prompt,
    prefix="以下是Python编程问答示例:",
    suffix="Q: {input}\nA:",
    input_variables=["input"]
)

# 使用
formatted = few_shot_prompt.format(input="如何排序列表?")
print(formatted)

# 输出:
# 以下是Python编程问答示例:
# Q: Python中如何创建列表?
# A: 使用方括号: my_list = [1, 2, 3]
# Q: 如何遍历列表?
# A: 使用for循环: for item in my_list: print(item)
# Q: 如何排序列表?
# A:

response = llm.invoke(formatted)
```
---

## 六、Chains (链)

### 6.1 LLMChain (基础链)

```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

# 1. 创建组件
llm = ChatOpenAI(model="gpt-3.5-turbo")
prompt = PromptTemplate.from_template("给{product}写一句广告语")

# 2. 组装链
chain = LLMChain(llm=llm, prompt=prompt)

# 3. 执行
result = chain.run(product="AI助手")
print(result)

# 输出: "让AI助手成为您的智能伙伴,工作效率倍增!"
```

### 6.2 SequentialChain (顺序链)

```python
from langchain.chains import SequentialChain

# 链1: 生成代码
code_prompt = PromptTemplate.from_template(
    "用Python实现: {task}"
)
code_chain = LLMChain(
    llm=llm,
    prompt=code_prompt,
    output_key="code"
)

# 链2: 解释代码
explain_prompt = PromptTemplate.from_template(
    "解释以下代码:\n{code}"
)
explain_chain = LLMChain(
    llm=llm,
    prompt=explain_prompt,
    output_key="explanation"
)

# 组合链
overall_chain = SequentialChain(
    chains=[code_chain, explain_chain],
    input_variables=["task"],
    output_variables=["code", "explanation"]
)

# 执行
result = overall_chain({"task": "快速排序"})
print("代码:")
print(result["code"])
print("\n解释:")
print(result["explanation"])
```

### 6.3 LCEL (表达式语言) - 新推荐方式

```python
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

# 【新语法】更简洁的链式调用
chain = (
    {"task": RunnablePassthrough()}  # 传递输入
    | prompt  # 应用模板
    | llm  # 调用LLM
    | StrOutputParser()  # 解析输出
)

# 执行
result = chain.invoke("实现二分查找")
print(result)

# 【优势】
# 1. 更pythonic的语法
# 2. 更好的类型提示
# 3. 自动并行执行
# 4. 流式输出支持更好
```

---

## 七、输出解析

### 7.1 结构化输出

```python
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List

# 定义输出结构
class Person(BaseModel):
    name: str = Field(description="人名")
    age: int = Field(description="年龄")
    skills: List[str] = Field(description="技能列表")

# 创建解析器
parser = PydanticOutputParser(pydantic_object=Person)

# 将格式说明加入prompt
prompt = PromptTemplate(
    template="提取以下文本的信息:\n{text}\n\n{format_instructions}",
    input_variables=["text"],
    partial_variables={"format_instructions": parser.get_format_instructions()}
)

# 执行
chain = prompt | llm | parser

text = "张三今年28岁,会Python、Java和前端开发"
person = chain.invoke({"text": text})

print(type(person))  # <class 'Person'>
print(person.name)  # 张三
print(person.skills)  # ['Python', 'Java', '前端开发']
```

### 7.2 JSON 输出

```python
from langchain.output_parsers import JsonOutputParser

parser = JsonOutputParser()

prompt = PromptTemplate(
    template="提取信息并返回JSON:\n{text}\n\n{format_instructions}",
    input_variables=["text"],
    partial_variables={"format_instructions": parser.get_format_instructions()}
)

chain = prompt | llm | parser
result = chain.invoke({"text": "北京今天晴,温度25度"})

print(result)
# {'city': '北京', 'weather': '晴', 'temperature': 25}
```
---

## 八、Memory (记忆)

### 8.1 ConversationBufferMemory

```python
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain

# 创建记忆
memory = ConversationBufferMemory()

# 创建对话链
conversation = ConversationChain(
    llm=llm,
    memory=memory,
    verbose=True  # 显示完整提示词
)

# 多轮对话
print(conversation.predict(input="我叫张三"))
# 输出: 你好,张三!很高兴认识你。

print(conversation.predict(input="我叫什么名字?"))
# 输出: 你叫张三。

# 查看记忆内容
print(memory.load_memory_variables({}))
# {
#   'history': 'Human: 我叫张三\nAI: 你好,张三!...\n...'
# }
```

### 8.2 ConversationSummaryMemory (摘要记忆)

```python
from langchain.memory import ConversationSummaryMemory

# 自动摘要历史对话,节省token
summary_memory = ConversationSummaryMemory(llm=llm)

conversation = ConversationChain(
    llm=llm,
    memory=summary_memory
)

# 多轮对话后,会自动压缩历史
for i in range(10):
    conversation.predict(input=f"第{i}轮对话")

# 查看摘要
print(summary_memory.load_memory_variables({}))
# {'history': '用户和AI进行了10轮对话,主要讨论了...'}
```

### 8.3 ConversationBufferWindowMemory (滑动窗口)

```python
from langchain.memory import ConversationBufferWindowMemory

# 只保留最近k轮对话
window_memory = ConversationBufferWindowMemory(k=3)

conversation = ConversationChain(
    llm=llm,
    memory=window_memory
)

# 只记住最近3轮
```

---

## 九、完整示例:翻译助手

```python
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

# 1. 定义输出结构
class Translation(BaseModel):
    original: str = Field(description="原文")
    translated: str = Field(description="译文")
    language: str = Field(description="目标语言")
    notes: str = Field(description="翻译说明")

# 2. 创建解析器
parser = PydanticOutputParser(pydantic_object=Translation)

# 3. 创建提示词模板
prompt = ChatPromptTemplate.from_messages([
    ("system", """你是专业翻译,将文本翻译成{target_lang}。
    
要求:
- 准确传达原意
- 符合目标语言习惯
- 保持原文风格
    
{format_instructions}"""),
    ("human", "{text}")
])

# 4. 创建LLM
llm = ChatOpenAI(model="gpt-4", temperature=0.3)

# 5. 组装链
chain = (
    {
        "text": lambda x: x["text"],
        "target_lang": lambda x: x["target_lang"],
        "format_instructions": lambda x: parser.get_format_instructions()
    }
    | prompt
    | llm
    | parser
)

# 6. 使用
result = chain.invoke({
    "text": "The quick brown fox jumps over the lazy dog.",
    "target_lang": "中文"
})

print(f"原文: {result.original}")
print(f"译文: {result.translated}")
print(f"语言: {result.language}")
print(f"说明: {result.notes}")

# 输出:
# 原文: The quick brown fox jumps over the lazy dog.
# 译文: 敏捷的棕色狐狸跳过懒狗。
# 语言: 中文
# 说明: 这是一个经典的英文全字母句,译文保持了原文的简洁风格。
```
---

## 十、实战技巧

### 10.1 错误处理

```python
from langchain.schema import OutputParserException

try:
    result = chain.invoke({"text": "..."})
except OutputParserException as e:
    print(f"解析失败: {e}")
    # 使用默认值或重试
    result = chain.invoke({"text": "..."})
```

### 10.2 成本监控

```python
from langchain.callbacks import get_openai_callback

with get_openai_callback() as cb:
    result = chain.invoke({"text": "..."})
    
    print(f"Tokens使用: {cb.total_tokens}")
    print(f"成本: ${cb.total_cost:.4f}")
    print(f"请求次数: {cb.successful_requests}")

# 输出:
# Tokens使用: 523
# 成本: $0.0105
# 请求次数: 1
```

### 10.3 调试模式

```python
import langchain
langchain.debug = True  # 全局调试模式

# 或者在链中启用
chain = ConversationChain(
    llm=llm,
    verbose=True  # 显示完整提示词和中间结果
)
```

### 10.4 缓存

```python
from langchain.cache import InMemoryCache
import langchain

# 启用缓存
langchain.llm_cache = InMemoryCache()

# 第一次调用
result1 = llm.invoke("什么是Python?")  # 调用API

# 第二次相同输入,从缓存返回
result2 = llm.invoke("什么是Python?")  # 不调用API,瞬间返回

# 【效果】节省成本和时间
```

---

## 十一、多模型支持

### 11.1 切换模型

```python
# OpenAI
from langchain_openai import ChatOpenAI
llm_openai = ChatOpenAI(model="gpt-4")

# Claude
from langchain_anthropic import ChatAnthropic
llm_claude = ChatAnthropic(model="claude-3-opus-20240229")

# 开源模型(本地Ollama)
from langchain_community.llms import Ollama
llm_local = Ollama(model="llama2")

# 同一个chain可以切换模型
chain = prompt | llm_openai | parser  # 使用GPT-4
# chain = prompt | llm_claude | parser  # 切换到Claude
```

### 11.2 模型回退(Fallback)

```python
from langchain.llms import OpenAI
from langchain.chat_models import ChatAnthropic

# 主模型失败时自动切换备用模型
llm = ChatOpenAI(model="gpt-4").with_fallbacks([
    ChatAnthropic(model="claude-3-sonnet-20240229"),
    Ollama(model="llama2")
])

# 自动处理: GPT-4失败 → Claude → Llama2
```
---

## 十二、LCEL 深入

### 12.1 Runnable 是整个框架的统一接口

LCEL 之所以能用 `|` 串起来,是因为所有组件都实现了 `Runnable` 协议。理解这个接口,就理解了 LangChain 的全部组合能力。

```python
# Runnable 的核心方法(每个组件都有)
chain.invoke(input)        # 单次同步调用
chain.ainvoke(input)       # 单次异步调用
chain.batch([i1, i2])      # 批量,内部并发
chain.abatch([i1, i2])     # 异步批量
chain.stream(input)        # 流式,逐块产出
chain.astream(input)       # 异步流式
chain.astream_events(input, version="v2")  # 流式事件(含中间步骤)
```

**关键理解**: `prompt | llm | parser` 的结果本身也是一个 Runnable。所以链可以任意嵌套,子链可以当组件复用。

```python
# 子链作为组件
translate_chain = translate_prompt | llm | StrOutputParser()
summarize_chain = summarize_prompt | llm | StrOutputParser()

# 组合成更大的链: 先翻译再总结
pipeline = translate_chain | (lambda text: {"text": text}) | summarize_chain

result = pipeline.invoke({"text": "长英文文章..."})
```

### 12.2 RunnableParallel - 并行分支

```python
from langchain_core.runnables import RunnableParallel

# 【场景】同一份输入,同时做多件事
analysis = RunnableParallel(
    sentiment=sentiment_prompt | llm | StrOutputParser(),
    keywords=keyword_prompt | llm | StrOutputParser(),
    summary=summary_prompt | llm | StrOutputParser(),
)

result = analysis.invoke({"text": "用户评论内容..."})
# {'sentiment': '正面', 'keywords': '质量,性价比', 'summary': '...'}

# 【重点】三个LLM调用是真并发的,总耗时 ≈ 最慢的那个
# 串行写法要 3x 时间

# {'sentiment': '正面', 'keywords': '质量,性价比', 'summary': '...'}

# 【重点】三个LLM调用是真并发的,总耗时 ≈ 最慢的那个
# 串行写法要 3x 时间
```

**更复杂的例子 - 部分输入不同**:

```python
from langchain_core.runnables import RunnablePassthrough

# 场景: 对英文文本做分析,同时对中文翻译也做分析
analysis = RunnableParallel(
    original_sentiment=(
        RunnablePassthrough.assign(input=lambda x: x["text"])
        | sentiment_chain
    ),
    translated_sentiment=(
        {"text": RunnablePassthrough()}
        | translate_chain
        | (lambda t: {"text": t})
        | sentiment_chain
    )
)
```

### 12.3 RunnableLambda - 在链中插入自定义函数

```python
from langchain_core.runnables import RunnableLambda

def clean_text(text):
    """清洗文本:去除多余空格、HTML标签等"""
    import re
    text = re.sub(r'<[^>]+>', '', text)  # 去HTML
    text = re.sub(r'\s+', ' ', text)     # 多空格变单空格
    return text.strip()

def extract_json_only(llm_output):
    """从LLM输出中提取JSON部分(LLM可能返回额外说明)"""
    import json, re
    match = re.search(r'\{.*\}', llm_output, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {}

# 链中嵌入函数
chain = (
    RunnableLambda(clean_text)     # 预处理
    | prompt 
    | llm 
    | RunnableLambda(extract_json_only)  # 后处理
)

result = chain.invoke("<p>  这是  带HTML的   文本  </p>")
```

**Lambda 简写**:

```python
# lambda 自动包装为 RunnableLambda
chain = (
    (lambda x: x.upper())  # 自动变成 RunnableLambda
    | prompt 
    | llm
)
```

### 12.4 RunnableBranch - 条件分支

```python
from langchain_core.runnables import RunnableBranch

# 【场景】根据输入路由到不同链
router = RunnableBranch(
    (lambda x: x["language"] == "en", english_chain),
    (lambda x: x["language"] == "zh", chinese_chain),
    (lambda x: x["language"] == "ja", japanese_chain),
    default_chain  # 默认分支
)

result = router.invoke({"language": "zh", "text": "你好"})
# 走 chinese_chain

# 实战例子:智能客服路由
customer_service_router = RunnableBranch(
    # 技术问题 → 技术助手
    (lambda x: any(kw in x["question"] for kw in ["bug", "错误", "崩溃"]), 
     tech_support_chain),
    
    # 账户问题 → 账户助手
    (lambda x: any(kw in x["question"] for kw in ["付款", "退款", "账号"]), 
     billing_chain),
    
    # 其他 → 通用助手
    general_chain
)
```

### 12.5 配置和绑定

**绑定固定参数**:

```python
# 场景: 同一个LLM,不同温度用于不同任务
llm = ChatOpenAI(model="gpt-4")

creative_llm = llm.bind(temperature=0.9)   # 创意写作
factual_llm = llm.bind(temperature=0.0)    # 事实问答

# 两条链用不同配置的LLM
story_chain = story_prompt | creative_llm | parser
qa_chain = qa_prompt | factual_llm | parser
```

**运行时配置**:

```python
# 运行时覆盖配置
chain = prompt | llm | parser

# 默认调用
result1 = chain.invoke({"text": "..."})

# 临时改模型
result2 = chain.with_config(
    configurable={"llm": "gpt-3.5-turbo"}
).invoke({"text": "..."})

# 临时改其他参数
result3 = chain.with_config(
    max_concurrency=10,  # 并发数
    recursion_limit=50   # 递归深度
).invoke({"text": "..."})
```

### 12.6 重试和容错

```python
from langchain_core.runnables import RunnableRetry

# 自动重试(API偶尔503)
reliable_chain = chain.with_retry(
    stop_after_attempt=3,
    wait_exponential_jitter=True  # 指数退避+抖动
)

# Fallback: 主模型失败 → 备用模型
chain_with_fallback = (
    prompt 
    | ChatOpenAI(model="gpt-4").with_fallbacks([
        ChatOpenAI(model="gpt-3.5-turbo"),
        ChatAnthropic(model="claude-3-haiku")
    ])
    | parser
)

# 超时控制
from langchain_core.runnables import RunnableTimeout

safe_chain = chain.with_timeout(seconds=30)
```

---

## 十三、Agents 与 Tools

LangChain 的 Agent 可以自主选择工具、规划步骤。理解 Agent 之前,先理解 Tool。

### 13.1 定义工具

**方法1: 装饰器方式(最简单)**

```python
from langchain_core.tools import tool

@tool
def search_wikipedia(query: str) -> str:
    """搜索维基百科获取信息。
    
    Args:
        query: 搜索关键词
    
    Returns:
        搜索结果摘要
    """
    import wikipedia
    try:
        return wikipedia.summary(query, sentences=3)
    except:
        return "未找到相关信息"

@tool
def calculate(expression: str) -> str:
    """计算数学表达式。
    
    Args:
        expression: 数学表达式,如 "2+2" 或 "sqrt(16)"
    """
    import math
    try:
        # 安全的eval(只允许math函数)
        result = eval(expression, {"__builtins__": {}}, math.__dict__)
        return str(result)
    except:
        return "计算错误"

# docstring 非常重要! LLM通过它理解工具用途
```

**方法2: StructuredTool(更灵活)**

```python
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

class SearchInput(BaseModel):
    query: str = Field(description="搜索关键词")
    max_results: int = Field(default=3, description="最多返回几条结果")

def search_impl(query: str, max_results: int) -> str:
    # 实际搜索逻辑
    return f"搜索 '{query}' 的前 {max_results} 条结果..."

search_tool = StructuredTool.from_function(
    func=search_impl,
    name="search",
    description="搜索互联网获取最新信息",
    args_schema=SearchInput
)
```

**方法3: 继承 BaseTool(完全控制)**

```python
from langchain.tools import BaseTool
from typing import Optional

class WeatherTool(BaseTool):
    name = "get_weather"
    description = "获取指定城市的天气信息"
    
    def _run(self, city: str) -> str:
        # 同步实现
        import requests
        api_key = "..."
        response = requests.get(f"https://api.weather.com/{city}?key={api_key}")
        return response.json()["weather"]
    
    async def _arun(self, city: str) -> str:
        # 异步实现
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(f"https://.../{city}") as resp:
                data = await resp.json()
                return data["weather"]

weather = WeatherTool()
```

### 13.2 预置工具库

LangChain 内置了大量工具:

```python
# 搜索类
from langchain_community.tools import DuckDuckGoSearchRun, GoogleSerperRun
from langchain_community.utilities import SerpAPIWrapper

search = DuckDuckGoSearchRun()  # 免费搜索
serper = GoogleSerperRun(api_wrapper=SerpAPIWrapper())  # 需API key

# 数学计算
from langchain.tools import WolframAlphaQueryRun
wolfram = WolframAlphaQueryRun(api_wrapper=...)

# Python REPL(让Agent执行Python代码)
from langchain_experimental.tools import PythonREPLTool
python = PythonREPLTool()

# 文件操作
from langchain.tools.file_management import ReadFileTool, WriteFileTool
read_file = ReadFileTool()
write_file = WriteFileTool()

# Shell命令
from langchain.tools import ShellTool
shell = ShellTool()  # ⚠️ 生产环境需沙箱

# 向量检索(RAG)
from langchain.tools.retriever import create_retriever_tool
retriever_tool = create_retriever_tool(
    retriever=vector_store.as_retriever(),
    name="knowledge_base",
    description="搜索公司内部知识库"
)
```

### 13.3 构建 Agent

**OpenAI Functions Agent(推荐)**

```python
from langchain.agents import create_openai_functions_agent, AgentExecutor
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder

# 定义工具
tools = [search_wikipedia, calculate, weather]

# Agent提示词(必须包含{agent_scratchpad})
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是AI助手,可以使用工具来回答问题。"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# 创建Agent
llm = ChatOpenAI(model="gpt-4", temperature=0)
agent = create_openai_functions_agent(llm, tools, prompt)

# Executor负责调用循环: 思考 → 行动 → 观察 → ...
agent_executor = AgentExecutor(
    agent=agent, 
    tools=tools, 
    verbose=True,
    max_iterations=10,  # 最多10轮防死循环
    handle_parsing_errors=True
)

# 执行
result = agent_executor.invoke({"input": "北京今天多少度?比昨天冷吗?"})
print(result["output"])

# 输出过程(verbose=True):
# > 进入 Agent 执行...
# Thought: 需要查询北京今天的天气
# Action: get_weather
# Action Input: {"city": "北京"}
# Observation: 北京今天15°C,晴
# Thought: 还需要昨天的温度才能对比
# Action: search
# Action Input: {"query": "北京昨天温度"}
# Observation: 昨天18°C
# Thought: 我知道答案了
# Final Answer: 北京今天15°C,比昨天(18°C)冷3度。
```

**ReAct Agent(更透明的推理)**

```python
from langchain.agents import create_react_agent

# ReAct提示词(显式的Thought/Action/Observation格式)
react_prompt = """Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought:{agent_scratchpad}"""

from langchain.prompts import PromptTemplate
prompt = PromptTemplate.from_template(react_prompt)

agent = create_react_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
```

**Structured Chat Agent(支持多输入工具)**

```python
from langchain.agents import create_structured_chat_agent

# 适合工具需要复杂输入的场景
# 例如: send_email(to, subject, body)
agent = create_structured_chat_agent(llm, tools, prompt)
```

### 13.4 Agent 内存

Agent 也能有对话历史:

```python
from langchain.memory import ConversationBufferMemory

memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True
)

agent_executor = AgentExecutor(
    agent=agent, 
    tools=tools, 
    memory=memory,
    verbose=True
)

# 第一轮
agent_executor.invoke({"input": "我叫张三"})
# 第二轮(记得第一轮)
result = agent_executor.invoke({"input": "我叫什么名字?"})
# 输出: 你叫张三
```

### 13.5 自定义 Agent 逻辑

```python
from langchain.agents import BaseSingleActionAgent
from typing import List, Tuple, Any

class MyCustomAgent(BaseSingleActionAgent):
    """完全自定义Agent推理逻辑"""
    
    tools: List[Tool]
    llm: BaseLanguageModel
    
    @property
    def input_keys(self):
        return ["input"]
    
    def plan(
        self, 
        intermediate_steps: List[Tuple[AgentAction, str]],
        **kwargs
    ) -> AgentAction | AgentFinish:
        """决定下一步做什么"""
        
        # 自定义规划逻辑
        # 例如: 总是先搜索再计算
        if not intermediate_steps:
            # 第一步: 搜索
            return AgentAction(
                tool="search",
                tool_input="关键词",
                log="首先搜索背景信息"
            )
        elif len(intermediate_steps) == 1:
            # 第二步: 计算
            return AgentAction(
                tool="calculate",
                tool_input="...",
                log="基于搜索结果计算"
            )
        else:
            # 结束
            return AgentFinish(
                return_values={"output": "完成"},
                log="工作完成"
            )

custom_agent = MyCustomAgent(tools=tools, llm=llm)
executor = AgentExecutor(agent=custom_agent, tools=tools)
```

---

## 十四、Document Loaders 与 Retrievers

RAG(检索增强生成)是 Agent 必备能力。LangChain 的 Document Loaders + Retrievers 是标准方案。

### 14.1 Document Loaders - 加载各种数据源

```python
# PDF
from langchain_community.document_loaders import PyPDFLoader
loader = PyPDFLoader("paper.pdf")
pages = loader.load()  # 每页一个Document对象

# Word
from langchain_community.document_loaders import Docx2txtLoader
loader = Docx2txtLoader("report.docx")
docs = loader.load()

# Markdown
from langchain_community.document_loaders import UnstructuredMarkdownLoader
loader = UnstructuredMarkdownLoader("README.md")
docs = loader.load()

# 网页
from langchain_community.document_loaders import WebBaseLoader
loader = WebBaseLoader("https://example.com")
docs = loader.load()

# 目录递归加载
from langchain_community.document_loaders import DirectoryLoader
loader = DirectoryLoader(
    "./docs",
    glob="**/*.md",  # 只加载markdown
    show_progress=True
)
docs = loader.load()

# CSV
from langchain_community.document_loaders import CSVLoader
loader = CSVLoader("data.csv")
docs = loader.load()

# Notion导出
from langchain_community.document_loaders import NotionDirectoryLoader
loader = NotionDirectoryLoader("notion_export/")
docs = loader.load()
```

**Document 对象结构**:

```python
from langchain.schema import Document

doc = Document(
    page_content="文档的实际文本内容...",
    metadata={
        "source": "paper.pdf",
        "page": 3,
        "author": "张三",
        "created": "2024-01-01"
    }
)

# 访问
print(doc.page_content)
print(doc.metadata["source"])
```

### 14.2 Text Splitters - 切分长文档

LLM 有上下文限制,长文档需要切块:

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

# 递归切分(推荐,智能保留结构)
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,        # 每块最多1000字符
    chunk_overlap=200,      # 块之间重叠200字符(保证上下文连贯)
    length_function=len,
    separators=["\n\n", "\n", " ", ""]  # 优先按段落分,然后句子,然后单词
)

docs = loader.load()
chunks = splitter.split_documents(docs)

print(f"原文档: {len(docs)} 个")
print(f"切分后: {len(chunks)} 块")
print(f"第一块: {chunks[0].page_content[:100]}...")
```

**其他 Splitter**:

```python
# 按字符数固定切分(简单粗暴)
from langchain.text_splitter import CharacterTextSplitter
splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)

# 按Token切分(更精确,考虑tokenizer)
from langchain.text_splitter import TokenTextSplitter
splitter = TokenTextSplitter(chunk_size=500, chunk_overlap=50)

# 按Markdown结构切分
from langchain.text_splitter import MarkdownTextSplitter
splitter = MarkdownTextSplitter(chunk_size=1000)

# 按代码语法切分
from langchain.text_splitter import Language, RecursiveCharacterTextSplitter
splitter = RecursiveCharacterTextSplitter.from_language(
    language=Language.PYTHON,
    chunk_size=500
)
```

### 14.3 向量存储与检索

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

# 1. 创建embedding模型
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# 2. 加载+切分文档
docs = loader.load()
chunks = splitter.split_documents(docs)

# 3. 创建向量库
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db"  # 持久化
)

# 4. 检索
query = "什么是transformer?"
results = vectorstore.similarity_search(query, k=3)  # top-3最相关

for doc in results:
    print(f"来源: {doc.metadata['source']}")
    print(f"内容: {doc.page_content[:200]}...")
    print("---")
```

### 14.4 Retriever 接口

Retriever 是检索的统一接口:

```python
# 从向量库创建retriever
retriever = vectorstore.as_retriever(
    search_type="similarity",  # 或 "mmr"(最大边际相关性)
    search_kwargs={"k": 3}
)

# 使用
docs = retriever.get_relevant_documents("transformer原理")

# MMR检索(多样性)
retriever_mmr = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 5,
        "fetch_k": 20,  # 先取20个候选
        "lambda_mult": 0.5  # 0=纯多样性, 1=纯相似度
    }
)
```

**相似度阈值过滤**:

```python
retriever = vectorstore.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={
        "score_threshold": 0.7,  # 只返回相似度>0.7的
        "k": 5
    }
)
```

### 14.5 RAG Chain

```python
from langchain.chains import RetrievalQA

# 方式1: RetrievalQA(简单)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    return_source_documents=True,  # 返回参考文档
    chain_type="stuff"  # 所有文档塞进prompt
)

result = qa_chain({"query": "transformer的注意力机制是什么?"})
print(result["result"])
print(f"参考文档: {len(result['source_documents'])} 篇")

# 方式2: LCEL(灵活)
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

def format_docs(docs):
    return "\n\n".join([d.page_content for d in docs])

rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

answer = rag_chain.invoke("什么是self-attention?")
```

**不同的 chain_type**:

```python
# stuff: 全部文档塞进一个prompt(默认,最简单)
qa = RetrievalQA.from_chain_type(llm, retriever=retriever, chain_type="stuff")

# map_reduce: 每个文档单独总结,再合并(适合长文档)
qa = RetrievalQA.from_chain_type(llm, retriever=retriever, chain_type="map_reduce")

# refine: 逐个文档迭代精炼答案
qa = RetrievalQA.from_chain_type(llm, retriever=retriever, chain_type="refine")

# map_rerank: 每个文档打分,取最高分
qa = RetrievalQA.from_chain_type(llm, retriever=retriever, chain_type="map_rerank")
```

---

## 十五、Callbacks 与可观测性

生产环境必须能追踪每次调用:token消耗、延迟、中间步骤。LangChain 的 Callbacks 提供完整可观测性。

### 15.1 内置 Callbacks

```python
from langchain.callbacks import StdOutCallbackHandler

# 打印所有事件
handler = StdOutCallbackHandler()

chain = prompt | llm | parser

result = chain.invoke(
    {"text": "你好"},
    config={"callbacks": [handler]}
)

# 输出:
# > Entering chain...
# > Prompt: ...
# > LLM start: model=gpt-3.5-turbo
# > LLM end: tokens=50, cost=$0.0001
# > Chain end
```

**Token计数 Callback**:

```python
from langchain.callbacks import get_openai_callback

with get_openai_callback() as cb:
    result = chain.invoke({"text": "..."})
    
    print(f"Prompt tokens: {cb.prompt_tokens}")
    print(f"Completion tokens: {cb.completion_tokens}")
    print(f"Total cost: ${cb.total_cost:.6f}")
```

### 15.2 自定义 Callback

```python
from langchain.callbacks.base import BaseCallbackHandler
from typing import Any, Dict

class MyCallbackHandler(BaseCallbackHandler):
    """自定义回调:记录到数据库"""
    
    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs):
        print(f"[LLM Start] Prompt: {prompts[0][:50]}...")
    
    def on_llm_end(self, response: LLMResult, **kwargs):
        token_usage = response.llm_output.get("token_usage", {})
        print(f"[LLM End] Tokens: {token_usage}")
    
    def on_llm_error(self, error: Exception, **kwargs):
        print(f"[LLM Error] {error}")
    
    def on_chain_start(self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs):
        print(f"[Chain Start] Inputs: {inputs}")
    
    def on_chain_end(self, outputs: Dict[str, Any], **kwargs):
        print(f"[Chain End] Outputs: {outputs}")
    
    def on_agent_action(self, action: AgentAction, **kwargs):
        print(f"[Agent] Tool={action.tool}, Input={action.tool_input}")
    
    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs):
        print(f"[Tool Start] {serialized['name']}({input_str})")
    
    def on_tool_end(self, output: str, **kwargs):
        print(f"[Tool End] {output[:100]}...")

# 使用
handler = MyCallbackHandler()
result = agent_executor.invoke({"input": "..."}, config={"callbacks": [handler]})
```

### 15.3 LangSmith 集成(推荐生产方案)

LangSmith 是 LangChain 官方的可观测平台,提供 UI 追踪每个调用的完整 trace。

```python
import os

# 1. 配置环境变量
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"
os.environ["LANGCHAIN_API_KEY"] = "your-api-key"
os.environ["LANGCHAIN_PROJECT"] = "my-project"  # 项目名

# 2. 正常使用LangChain(自动记录)
result = chain.invoke({"text": "..."})

# 3. 去 https://smith.langchain.com 查看trace
```

**LangSmith 功能**:
- 每次调用的完整trace(prompt、LLM输出、中间步骤)
- Token消耗和成本统计
- 延迟分析
- 错误告警
- A/B测试不同Prompt
- 导出数据集用于fine-tuning

---

## 十六、流式输出

用户体验关键:逐字显示,不要等5秒后一次性输出。

### 16.1 基础流式

```python
chain = prompt | llm | StrOutputParser()

# 同步流式
for chunk in chain.stream({"text": "写一首诗"}):
    print(chunk, end="", flush=True)

# 输出:
# 春(延迟0.1s)江(延迟0.1s)潮(延迟0.1s)水(...一个字一个字显示)
```

### 16.2 异步流式

```python
import asyncio

async def stream_output():
    async for chunk in chain.astream({"text": "写代码"}):
        print(chunk, end="", flush=True)
        await asyncio.sleep(0.01)  # 模拟处理

asyncio.run(stream_output())
```

### 16.3 流式事件(中间步骤也流式)

```python
# astream_events: 所有事件都流式返回(含检索、工具调用)
async for event in chain.astream_events({"text": "..."}, version="v2"):
    kind = event["event"]
    
    if kind == "on_llm_stream":
        # LLM输出流
        print(event["data"]["chunk"], end="")
    
    elif kind == "on_retriever_start":
        print("\n[检索中...]")
    
    elif kind == "on_retriever_end":
        docs = event["data"]["output"]
        print(f"\n[检索到{len(docs)}篇文档]")
    
    elif kind == "on_tool_start":
        print(f"\n[调用工具: {event['name']}]")
```

### 16.4 FastAPI 集成(Web流式)

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.post("/chat/stream")
async def chat_stream(question: str):
    """SSE流式端点"""
    
    async def generate():
        async for chunk in chain.astream({"text": question}):
            # Server-Sent Events格式
            yield f"data: {chunk}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

# 客户端(JavaScript)
const eventSource = new EventSource('/chat/stream?question=...');
eventSource.onmessage = (event) => {
    document.getElementById('output').innerHTML += event.data;
};
```

---

## 十七、生产部署

### 17.1 LangServe - 一键部署为 API

```python
# server.py
from fastapi import FastAPI
from langserve import add_routes
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

app = FastAPI(title="My LangChain API")

# 定义chain
chain = ChatPromptTemplate.from_template("翻译:{text}") | ChatOpenAI()

# 自动生成REST API
add_routes(
    app,
    chain,
    path="/translate",  # POST /translate/invoke, /translate/stream, ...
)

# 运行: uvicorn server:app
```

**客户端调用**:

```python
from langserve import RemoteRunnable

# 远程chain当本地用
remote_chain = RemoteRunnable("http://localhost:8000/translate")

result = remote_chain.invoke({"text": "Hello"})
print(result)

# 流式
for chunk in remote_chain.stream({"text": "Hello"}):
    print(chunk, end="")
```

### 17.2 并发控制

```python
# 限制并发数(防止打爆API限额)
chain_with_limit = chain.with_config(max_concurrency=5)

# 批量时最多5个并发
results = chain_with_limit.batch([
    {"text": f"文本{i}"} for i in range(100)
])
```

### 17.3 缓存策略

```python
# Redis缓存
from langchain.cache import RedisCache
import langchain
import redis

langchain.llm_cache = RedisCache(redis_=redis.Redis())

# 第一次调用 → 打API
result1 = llm.invoke("什么是Python?")

# 相同输入 → 从Redis返回(瞬间)
result2 = llm.invoke("什么是Python?")
```

### 17.4 错误监控

```python
from langchain.callbacks import BaseCallbackHandler
import sentry_sdk

class SentryCallback(BaseCallbackHandler):
    """错误上报到Sentry"""
    
    def on_llm_error(self, error: Exception, **kwargs):
        sentry_sdk.capture_exception(error)
    
    def on_chain_error(self, error: Exception, **kwargs):
        sentry_sdk.capture_exception(error)

# 全局配置
chain = chain.with_config(callbacks=[SentryCallback()])
```

---

<!-- CHUNK_2 -->

## 十二、常见问题

**Q1: LangChain vs 直接调用API?**

| 场景 | 推荐方案 |
|-----|---------|
| 简单单次调用 | 直接API |
| 需要Prompt管理/复用 | LangChain |
| 多步骤工作流 | LangChain |
| Agent应用 | LangChain |
| 需要快速切换模型 | LangChain |

**Q2: 如何选择Memory类型?**

```python
# 简单对话,历史短 → ConversationBufferMemory
# 长对话,需节省token → ConversationSummaryMemory
# 只需最近几轮 → ConversationBufferWindowMemory
# RAG场景 → VectorStoreMemory (下篇详解)
```

**Q3: LCEL vs 传统Chain?**

LCEL(新语法)优势:
- 更简洁pythonic
- 自动并行
- 更好的流式支持
- 更容易调试

建议新项目使用LCEL。

**Q4: 如何处理超时?**

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4",
    request_timeout=30  # 30秒超时
)
```

---

## 附录:速查表

### 常用代码片段

```python
# 1. 快速创建链
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

llm = ChatOpenAI(model="gpt-3.5-turbo")
prompt = ChatPromptTemplate.from_template("翻译:{text}")
chain = prompt | llm
result = chain.invoke({"text": "Hello"})

# 2. 流式输出
for chunk in chain.stream({"text": "Hello"}):
    print(chunk.content, end="")

# 3. 批量处理
results = chain.batch([
    {"text": "Hello"},
    {"text": "World"}
])

# 4. 异步调用
import asyncio
result = await chain.ainvoke({"text": "Hello"})

# 5. 并行执行
from langchain.schema.runnable import RunnableParallel

parallel = RunnableParallel(
    translation=translation_chain,
    summary=summary_chain
)
results = parallel.invoke({"text": "..."})
# {'translation': '...', 'summary': '...'}
```

### 性能优化

```python
# 1. 启用缓存
import langchain
from langchain.cache import SQLiteCache
langchain.llm_cache = SQLiteCache(database_path=".langchain.db")

# 2. 批量调用
results = llm.batch([msg1, msg2, msg3])  # 比3次单独调用快

# 3. 异步并发
import asyncio
results = await asyncio.gather(
    chain.ainvoke(input1),
    chain.ainvoke(input2)
)

# 4. 使用便宜模型做简单任务
cheap_llm = ChatOpenAI(model="gpt-3.5-turbo")
expensive_llm = ChatOpenAI(model="gpt-4")
```

---
