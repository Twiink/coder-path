---
title: "AutoGen框架"
tags:
  - "Agent"
  - "多智能体"
  - "AutoGen"
category: "Agent开发"
folder: "多智能体系统"

created: 2026-09-07
updated: 2026-09-07
---

# AutoGen 框架

> AutoGen 是微软开源的多智能体对话框架,支持人机协作、多Agent自主对话。本文从入门到实战,掌握AutoGen核心用法。

---

## 一、AutoGen 核心概念

### 1.1 什么是 AutoGen?

**AutoGen = Conversable Agents + Flexible Conversations**

- **Conversable Agent**: 可对话的智能体(LLM/人类/工具)
- **Conversation Pattern**: 灵活的对话模式(两方/多方/群聊)

### 1.2 核心优势

| 特性 | 说明 | 应用场景 |
|-----|------|---------|
| **对话式交互** | Agent通过多轮对话协作 | 复杂任务分解 |
| **人机协作** | 人类可随时介入 | 需要人类审批的流程 |
| **代码执行** | 内置安全的代码沙箱 | 数据分析、自动化脚本 |
| **灵活模式** | 支持两方/群聊/层级 | 各种协作场景 |
---

## 二、快速开始

### 2.1 安装

```bash
pip install pyautogen
```

### 2.2 第一个对话: 用户 ↔ 助手

```python
import autogen

# 配置LLM
config_list = [
    {
        "model": "gpt-4",
        "api_key": "sk-..."
    }
]

# 创建助手Agent
assistant = autogen.AssistantAgent(
    name="assistant",
    llm_config={"config_list": config_list}
)

# 创建用户代理(人类)
user_proxy = autogen.UserProxyAgent(
    name="user_proxy",
    human_input_mode="NEVER",  # 自动回复,不需要人类输入
    code_execution_config={
        "work_dir": "coding",
        "use_docker": False  # 本地执行代码
    }
)

# 发起对话
user_proxy.initiate_chat(
    assistant,
    message="写一个Python函数计算斐波那契数列"
)

# 输出:
# user_proxy (to assistant):
# 写一个Python函数计算斐波那契数列
# 
# assistant (to user_proxy):
# def fibonacci(n):
#     if n <= 1:
#         return n
#     return fibonacci(n-1) + fibonacci(n-2)
# 
# user_proxy (to assistant):
# 代码已执行,结果...
```

---

## 三、Agent 类型

### 3.1 AssistantAgent (助手)

```python
# 纯LLM驱动的助手
assistant = autogen.AssistantAgent(
    name="coding_assistant",
    system_message="你是Python专家,擅长写优雅的代码",
    llm_config={
        "config_list": config_list,
        "temperature": 0.7
    }
)
```

### 3.2 UserProxyAgent (用户代理)

```python
# 代表人类的Agent,可以执行代码
user_proxy = autogen.UserProxyAgent(
    name="user",
    human_input_mode="TERMINATE",  # 在终止前询问人类
    max_consecutive_auto_reply=10,  # 最多自动回复10次
    is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
    code_execution_config={
        "work_dir": "workspace",
        "use_docker": False
    }
)

# human_input_mode 选项:
# - "ALWAYS": 每次都需要人类输入
# - "TERMINATE": 只在终止时询问
# - "NEVER": 完全自动
```

### 3.3 自定义 Agent

```python
class ReviewerAgent(autogen.AssistantAgent):
    """代码审查Agent"""
    
    def __init__(self, name, **kwargs):
        system_message = """
你是严格的代码审查员。审查代码并提出改进建议:
1. 检查代码质量
2. 指出潜在bug
3. 建议优化方案

如果代码完美,回复"APPROVED"。
"""
        super().__init__(
            name=name,
            system_message=system_message,
            **kwargs
        )

reviewer = ReviewerAgent(
    name="code_reviewer",
    llm_config={"config_list": config_list}
)
```
---

## 四、对话模式

### 4.1 两方对话 (Two-Agent)

```python
# 场景: 编码 + 审查
coder = autogen.AssistantAgent(
    name="coder",
    system_message="你负责编写代码"
)

reviewer = autogen.AssistantAgent(
    name="reviewer",
    system_message="你负责审查代码,提出改进建议"
)

# 发起对话
coder.initiate_chat(
    reviewer,
    message="实现一个LRU缓存",
    max_turns=5  # 最多5轮对话
)
```

### 4.2 群聊 (GroupChat)

```python
# 场景: 产品经理 + 工程师 + 测试
product_manager = autogen.AssistantAgent(
    name="PM",
    system_message="你是产品经理,定义需求和验收标准"
)

engineer = autogen.AssistantAgent(
    name="Engineer",
    system_message="你是工程师,实现功能"
)

tester = autogen.AssistantAgent(
    name="Tester",
    system_message="你是测试,编写测试用例"
)

user_proxy = autogen.UserProxyAgent(
    name="User",
    code_execution_config={"work_dir": "workspace"}
)

# 创建群聊
groupchat = autogen.GroupChat(
    agents=[product_manager, engineer, tester, user_proxy],
    messages=[],
    max_round=12,  # 最多12轮对话
    speaker_selection_method="auto"  # 自动选择下一个发言人
)

# 群聊管理器
manager = autogen.GroupChatManager(
    groupchat=groupchat,
    llm_config={"config_list": config_list}
)

# 发起群聊
user_proxy.initiate_chat(
    manager,
    message="开发一个用户登录功能"
)

# 对话流程:
# User → PM: 开发用户登录功能
# PM → Engineer: 需求是...验收标准是...
# Engineer → Tester: 我实现了...请测试
# Tester → Engineer: 测试用例...,发现bug...
# Engineer → User: 修复完成,请验收
```

### 4.3 顺序对话 (Sequential)

```python
# 固定顺序: A → B → C → A
def custom_speaker_selection(last_speaker, groupchat):
    """自定义发言顺序"""
    agents = groupchat.agents
    if last_speaker == agents[0]:
        return agents[1]
    elif last_speaker == agents[1]:
        return agents[2]
    else:
        return agents[0]

groupchat = autogen.GroupChat(
    agents=[pm, engineer, tester],
    messages=[],
    speaker_selection_method=custom_speaker_selection
)
```

---

## 五、代码执行

### 5.1 自动执行Python代码

```python
user_proxy = autogen.UserProxyAgent(
    name="executor",
    code_execution_config={
        "work_dir": "coding",
        "use_docker": False,
        "timeout": 60,  # 执行超时(秒)
        "last_n_messages": 3  # 只执行最近3条消息中的代码
    }
)

assistant = autogen.AssistantAgent(
    name="coder",
    llm_config={"config_list": config_list}
)

# 对话
user_proxy.initiate_chat(
    assistant,
    message="""
分析以下数据并画图:
data = [1, 3, 2, 5, 4, 7, 6]
"""
)

# Assistant会生成代码:
# ```python
# import matplotlib.pyplot as plt
# data = [1, 3, 2, 5, 4, 7, 6]
# plt.plot(data)
# plt.savefig('plot.png')
# ```
#
# UserProxy自动执行代码并返回结果
```

### 5.2 安全执行(Docker)

```python
# 【推荐】生产环境用Docker隔离
user_proxy = autogen.UserProxyAgent(
    name="executor",
    code_execution_config={
        "work_dir": "coding",
        "use_docker": True,  # 启用Docker
        "docker_image": "python:3.10-slim"
    }
)

# 需要先安装Docker并启动服务
```
---

## 六、函数调用(Tool Use)

### 6.1 注册自定义函数

```python
import requests

def search_web(query: str) -> str:
    """搜索互联网
    
    Args:
        query: 搜索关键词
    
    Returns:
        搜索结果摘要
    """
    # 实际调用搜索API
    response = requests.get(f"https://api.search.com?q={query}")
    return response.text[:500]

def get_weather(city: str) -> str:
    """查询天气
    
    Args:
        city: 城市名
    
    Returns:
        天气信息
    """
    # 实际调用天气API
    return f"{city}今天晴,25度"

# 注册函数
autogen.register_function(
    search_web,
    caller=assistant,  # 谁可以调用
    executor=user_proxy,  # 谁来执行
    description="搜索互联网获取信息"
)

autogen.register_function(
    get_weather,
    caller=assistant,
    executor=user_proxy,
    description="查询城市天气"
)

# 使用
user_proxy.initiate_chat(
    assistant,
    message="北京今天天气怎么样?适合穿什么?"
)

# 流程:
# 1. Assistant决定调用get_weather("北京")
# 2. UserProxy执行函数
# 3. Assistant基于结果回答
```

### 6.2 批量注册函数

```python
from typing import Annotated

# 使用Annotated标注参数
def calculate(
    operation: Annotated[str, "操作: add/subtract/multiply/divide"],
    a: Annotated[float, "第一个数"],
    b: Annotated[float, "第二个数"]
) -> float:
    """计算器"""
    ops = {
        "add": lambda x, y: x + y,
        "subtract": lambda x, y: x - y,
        "multiply": lambda x, y: x * y,
        "divide": lambda x, y: x / y
    }
    return ops[operation](a, b)

# 批量注册
tools = [search_web, get_weather, calculate]
for tool in tools:
    autogen.register_function(
        tool,
        caller=assistant,
        executor=user_proxy
    )
```

---

## 七、人机协作

### 7.1 人类审批流程

```python
# 创建需要人类审批的Agent
human_approver = autogen.UserProxyAgent(
    name="human",
    human_input_mode="ALWAYS",  # 每次都需要人类输入
    code_execution_config=False  # 不执行代码
)

planner = autogen.AssistantAgent(
    name="planner",
    system_message="制定计划"
)

executor = autogen.AssistantAgent(
    name="executor",
    system_message="执行任务"
)

# 工作流: Planner → Human(审批) → Executor
groupchat = autogen.GroupChat(
    agents=[planner, human_approver, executor],
    messages=[],
    max_round=10
)

manager = autogen.GroupChatManager(groupchat=groupchat)

# 对话
human_approver.initiate_chat(
    manager,
    message="制定一个数据迁移计划"
)

# 流程:
# 1. Planner提出计划
# 2. Human审批(输入"approved"或修改意见)
# 3. Executor执行
```

### 7.2 人类提供反馈

```python
user_proxy = autogen.UserProxyAgent(
    name="user",
    human_input_mode="TERMINATE",
    is_termination_msg=lambda x: "TERMINATE" in x.get("content", "")
)

# 对话中人类可以:
# - 提供额外信息
# - 修正Agent的错误
# - 决定是否继续
```
---

## 八、实战案例

### 8.1 数据分析工作流

```python
import autogen

config_list = [{"model": "gpt-4", "api_key": "sk-..."}]

# 1. 数据分析师
analyst = autogen.AssistantAgent(
    name="DataAnalyst",
    system_message="""
你是数据分析师。分析数据并生成Python代码:
1. 加载数据
2. 清洗数据
3. 统计分析
4. 可视化
使用pandas和matplotlib。
"""
)

# 2. 代码执行器
executor = autogen.UserProxyAgent(
    name="CodeExecutor",
    human_input_mode="NEVER",
    code_execution_config={
        "work_dir": "analysis",
        "use_docker": False
    }
)

# 3. 报告撰写者
writer = autogen.AssistantAgent(
    name="ReportWriter",
    system_message="""
你是报告撰写者。基于分析结果写一份清晰的报告,包含:
1. 数据概览
2. 关键发现
3. 可视化图表说明
4. 建议
"""
)

# 创建群聊
groupchat = autogen.GroupChat(
    agents=[analyst, executor, writer],
    messages=[],
    max_round=15
)

manager = autogen.GroupChatManager(
    groupchat=groupchat,
    llm_config={"config_list": config_list}
)

# 执行任务
executor.initiate_chat(
    manager,
    message="""
分析sales_data.csv文件:
1. 计算每月销售额
2. 找出销售最好的产品
3. 画趋势图
4. 生成分析报告
"""
)
```

### 8.2 软件开发团队模拟

```python
# 产品经理
pm = autogen.AssistantAgent(
    name="ProductManager",
    system_message="定义需求、验收标准,确保符合产品目标"
)

# 架构师
architect = autogen.AssistantAgent(
    name="Architect",
    system_message="设计系统架构,制定技术方案"
)

# 开发工程师
developer = autogen.AssistantAgent(
    name="Developer",
    system_message="实现功能,编写高质量代码"
)

# 测试工程师
tester = autogen.AssistantAgent(
    name="Tester",
    system_message="编写测试用例,发现bug"
)

# 代码执行器
executor = autogen.UserProxyAgent(
    name="Executor",
    code_execution_config={"work_dir": "project"}
)

# 创建开发群聊
dev_groupchat = autogen.GroupChat(
    agents=[pm, architect, developer, tester, executor],
    messages=[],
    max_round=30,
    speaker_selection_method="round_robin"  # 轮流发言
)

manager = autogen.GroupChatManager(
    groupchat=dev_groupchat,
    llm_config={"config_list": config_list}
)

# 启动开发
executor.initiate_chat(
    manager,
    message="开发一个RESTful API,实现用户注册、登录、信息管理"
)

# 对话流程:
# PM: 需求是...
# Architect: 技术方案...使用FastAPI + JWT...
# Developer: 实现代码...
# Tester: 测试用例...发现问题...
# Developer: 修复bug...
# PM: 验收通过
```

---

## 九、高级特性

### 9.1 嵌套对话(Nested Chat)

```python
# 内部团队讨论,外部只看到最终结果

# 内部团队
internal_dev = autogen.AssistantAgent(name="dev_internal")
internal_review = autogen.AssistantAgent(name="review_internal")

# 外部接口Agent
team_representative = autogen.AssistantAgent(
    name="team_rep",
    system_message="你代表开发团队对外沟通"
)

def internal_discussion(message):
    """内部讨论"""
    chat = autogen.GroupChat(
        agents=[internal_dev, internal_review],
        messages=[],
        max_round=5
    )
    manager = autogen.GroupChatManager(chat)
    internal_dev.initiate_chat(manager, message=message)
    
    # 返回讨论结果
    return chat.messages[-1]["content"]

# 注册内部讨论为函数
autogen.register_function(
    internal_discussion,
    caller=team_representative,
    executor=user_proxy
)

# 外部只看到team_representative,不知道内部有多个Agent
```

### 9.2 状态管理

```python
class StatefulAgent(autogen.AssistantAgent):
    """带状态的Agent"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.state = {
            "tasks_completed": 0,
            "current_task": None,
            "history": []
        }
    
    def update_state(self, key, value):
        self.state[key] = value
        self.state["history"].append({
            "action": f"update_{key}",
            "value": value
        })
    
    def get_state(self):
        return self.state

agent = StatefulAgent(
    name="stateful",
    llm_config={"config_list": config_list}
)
```

### 9.3 成本控制

```python
# 限制单次对话成本
user_proxy = autogen.UserProxyAgent(
    name="user",
    max_consecutive_auto_reply=10,  # 最多10轮
    llm_config={
        "config_list": config_list,
        "max_tokens": 500  # 限制每次生成token数
    }
)

# 监控成本
with autogen.CostMonitor() as monitor:
    user_proxy.initiate_chat(assistant, message="...")
    
print(f"总成本: ${monitor.total_cost:.4f}")
print(f"总tokens: {monitor.total_tokens}")
```
---

## 十、最佳实践

### 10.1 明确的System Message

```python
# ❌ 模糊
system_message = "你是助手"

# ✅ 明确
system_message = """
你是Python代码审查员,职责:
1. 检查代码质量(命名、注释、结构)
2. 发现潜在bug
3. 提出优化建议

输出格式:
- 问题: [具体问题]
- 位置: [行号或函数名]
- 建议: [如何改进]

如果代码完美,回复"LGTM"。
"""
```

### 10.2 设置终止条件

```python
def is_task_done(msg):
    """判断任务是否完成"""
    content = msg.get("content", "").lower()
    return any(keyword in content for keyword in [
        "task completed",
        "finished",
        "done",
        "lgtm"
    ])

user_proxy = autogen.UserProxyAgent(
    name="user",
    is_termination_msg=is_task_done,
    max_consecutive_auto_reply=20  # 防止无限循环
)
```

### 10.3 错误处理

```python
try:
    user_proxy.initiate_chat(
        assistant,
        message="...",
        max_turns=10
    )
except autogen.CodeExecutionError as e:
    print(f"代码执行失败: {e}")
except autogen.ConversationTerminated:
    print("对话正常结束")
except Exception as e:
    print(f"未知错误: {e}")
```

---

## 十一、与其他框架对比

| 特性 | AutoGen | LangChain | CrewAI |
|-----|---------|-----------|--------|
| **对话式** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **人机协作** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **代码执行** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| **易用性** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **灵活性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

**选择建议:**
- **AutoGen**: 需要多Agent对话、人机协作、代码执行
- **LangChain**: 构建RAG、简单Agent、工具调用
- **CrewAI**: 固定角色的工作流、简单场景
---

## 十二、高级模式详解

### 12.1 嵌套对话 (Nested Chats)

```python
# 场景: 主Agent遇到复杂子任务时,启动子对话
class ManagerAgent(autogen.AssistantAgent):
    """管理者Agent,可以启动子任务"""
    
    def __init__(self, name, **kwargs):
        super().__init__(name, **kwargs)
        
        # 子任务的Agent团队
        self.research_team = self._create_research_team()
        self.dev_team = self._create_dev_team()
    
    def _create_research_team(self):
        """研究团队"""
        researcher = autogen.AssistantAgent(
            name="researcher",
            system_message="你是研究员,负责调研技术方案",
            llm_config=self.llm_config
        )
        
        analyst = autogen.AssistantAgent(
            name="analyst",
            system_message="你是分析师,负责对比方案优劣",
            llm_config=self.llm_config
        )
        
        return autogen.GroupChat(
            agents=[researcher, analyst],
            messages=[],
            max_round=5
        )
    
    def handle_task(self, task):
        """处理任务,必要时启动子对话"""
        if "研究" in task:
            # 启动研究团队的嵌套对话
            research_chat = autogen.GroupChatManager(
                groupchat=self.research_team,
                llm_config=self.llm_config
            )
            
            result = research_chat.initiate_chat(
                self,
                message=f"子任务: {task}"
            )
            
            return result.summary
        else:
            # 自己处理
            return self.generate_reply(task)

# 使用
manager = ManagerAgent(name="manager", llm_config=config)
user_proxy.initiate_chat(
    manager,
    message="开发一个新功能前,先研究现有的类似方案"
)

# 输出:
# manager启动research_team子对话 →
# researcher和analyst讨论 →
# 返回研究报告给manager →
# manager基于报告继续主对话
```

### 12.2 动态Agent生成

```python
class AdaptiveSystem:
    """根据任务动态创建Agent"""
    
    def __init__(self, llm_config):
        self.llm_config = llm_config
        self.agent_pool = {}
    
    def create_specialist(self, domain, task_description):
        """动态创建专家Agent"""
        
        # 如果已有该领域专家,复用
        if domain in self.agent_pool:
            return self.agent_pool[domain]
        
        # 根据领域定制系统消息
        domain_prompts = {
            "python": "你是Python专家,精通语法和最佳实践",
            "database": "你是数据库专家,精通SQL优化和架构设计",
            "frontend": "你是前端专家,精通React和现代前端工程",
            "devops": "你是DevOps专家,精通CI/CD和云基础设施"
        }
        
        specialist = autogen.AssistantAgent(
            name=f"{domain}_specialist",
            system_message=domain_prompts.get(domain, f"你是{domain}领域专家"),
            llm_config=self.llm_config
        )
        
        self.agent_pool[domain] = specialist
        return specialist
    
    def solve(self, problem):
        """分析问题,召集相关专家"""
        
        # 1. 分析问题需要哪些领域
        analyzer = autogen.AssistantAgent(
            name="analyzer",
            system_message="分析问题涉及的技术领域,返回领域列表",
            llm_config=self.llm_config
        )
        
        domains = analyzer.generate_reply(
            f"问题: {problem}\n需要哪些领域专家?(只返回领域名,逗号分隔)"
        )
        
        domain_list = [d.strip() for d in domains.split(",")]
        
        # 2. 动态创建相关专家
        specialists = [self.create_specialist(d, problem) for d in domain_list]
        
        # 3. 组建群聊
        group_chat = autogen.GroupChat(
            agents=specialists + [user_proxy],
            messages=[],
            max_round=10
        )
        
        manager = autogen.GroupChatManager(
            groupchat=group_chat,
            llm_config=self.llm_config
        )
        
        # 4. 开始讨论
        result = user_proxy.initiate_chat(
            manager,
            message=problem
        )
        
        return result.summary

# 使用
system = AdaptiveSystem(llm_config=config)

# 问题1: 自动召集Python + Database专家
system.solve("优化Django ORM查询性能")

# 问题2: 自动召集Frontend + DevOps专家  
system.solve("部署React应用到Kubernetes")
```

### 12.3 状态机模式

```python
from enum import Enum

class WorkflowState(Enum):
    """工作流状态"""
    PLANNING = "planning"
    DEVELOPMENT = "development"
    REVIEW = "review"
    TESTING = "testing"
    DEPLOYMENT = "deployment"
    DONE = "done"

class StatefulWorkflow:
    """带状态的工作流"""
    
    def __init__(self, llm_config):
        self.state = WorkflowState.PLANNING
        self.llm_config = llm_config
        
        # 每个状态对应的Agent
        self.agents = {
            WorkflowState.PLANNING: autogen.AssistantAgent(
                name="planner",
                system_message="制定开发计划",
                llm_config=llm_config
            ),
            WorkflowState.DEVELOPMENT: autogen.AssistantAgent(
                name="developer",
                system_message="编写代码",
                llm_config=llm_config
            ),
            WorkflowState.REVIEW: autogen.AssistantAgent(
                name="reviewer",
                system_message="代码审查,找出问题",
                llm_config=llm_config
            ),
            WorkflowState.TESTING: autogen.AssistantAgent(
                name="tester",
                system_message="编写和执行测试",
                llm_config=llm_config
            )
        }
        
        # 状态转移规则
        self.transitions = {
            WorkflowState.PLANNING: WorkflowState.DEVELOPMENT,
            WorkflowState.DEVELOPMENT: WorkflowState.REVIEW,
            WorkflowState.REVIEW: WorkflowState.TESTING,  # 或返回DEVELOPMENT
            WorkflowState.TESTING: WorkflowState.DEPLOYMENT,  # 或返回DEVELOPMENT
            WorkflowState.DEPLOYMENT: WorkflowState.DONE
        }
    
    def execute(self, task):
        """执行工作流"""
        results = {}
        
        while self.state != WorkflowState.DONE:
            print(f"\n=== 当前状态: {self.state.value} ===")
            
            agent = self.agents.get(self.state)
            
            if agent:
                # 执行当前阶段
                result = agent.generate_reply(
                    f"任务: {task}\n前序结果: {results}\n请完成{self.state.value}阶段"
                )
                
                results[self.state.value] = result
                
                # 特殊处理: Review或Testing失败则回退
                if self.state == WorkflowState.REVIEW and "问题" in result:
                    print("代码审查发现问题,返回开发阶段")
                    self.state = WorkflowState.DEVELOPMENT
                    continue
                
                if self.state == WorkflowState.TESTING and "失败" in result:
                    print("测试失败,返回开发阶段")
                    self.state = WorkflowState.DEVELOPMENT
                    continue
            
            # 正常状态转移
            self.state = self.transitions.get(self.state, WorkflowState.DONE)
        
        return results

# 使用
workflow = StatefulWorkflow(llm_config=config)
results = workflow.execute("开发用户登录功能")

# 输出:
# === 当前状态: planning ===
# planner: 制定计划...
# === 当前状态: development ===
# developer: 编写代码...
# === 当前状态: review ===
# reviewer: 发现安全问题! (返回development)
# === 当前状态: development ===
# developer: 修复安全问题...
# ...
```

---

## 十三、性能优化

### 13.1 缓存优化

```python
from functools import lru_cache
import hashlib

class CachedAgent(autogen.AssistantAgent):
    """带缓存的Agent"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._response_cache = {}
    
    def generate_reply(self, messages, sender=None, **kwargs):
        """缓存LLM响应"""
        
        # 计算消息hash
        message_key = hashlib.md5(
            str(messages).encode()
        ).hexdigest()
        
        # 检查缓存
        if message_key in self._response_cache:
            print(f"[缓存命中] {self.name}")
            return self._response_cache[message_key]
        
        # 调用LLM
        response = super().generate_reply(messages, sender, **kwargs)
        
        # 存入缓存
        self._response_cache[message_key] = response
        
        return response

# 使用
cached_assistant = CachedAgent(
    name="assistant",
    llm_config=config
)

# 重复问题走缓存,节省成本
```

### 13.2 并行对话

```python
import asyncio
from typing import List

async def parallel_chats(tasks: List[str], llm_config):
    """并行执行多个独立对话"""
    
    async def single_chat(task, idx):
        assistant = autogen.AssistantAgent(
            name=f"assistant_{idx}",
            llm_config=llm_config
        )
        
        user_proxy = autogen.UserProxyAgent(
            name=f"user_{idx}",
            human_input_mode="NEVER"
        )
        
        result = await user_proxy.a_initiate_chat(
            assistant,
            message=task
        )
        
        return result.summary
    
    # 并发执行所有对话
    results = await asyncio.gather(*[
        single_chat(task, i) for i, task in enumerate(tasks)
    ])
    
    return results

# 使用
tasks = [
    "翻译: Hello World",
    "计算: 123 * 456",
    "总结: 长文本..."
]

results = asyncio.run(parallel_chats(tasks, config))

# 3个任务并行,总耗时 ≈ 单个任务的时间
```

### 13.3 上下文窗口管理

```python
class ContextAwareAgent(autogen.AssistantAgent):
    """智能管理上下文的Agent"""
    
    def __init__(self, *args, max_context_tokens=8000, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_context = max_context_tokens
        self.message_history = []
    
    def generate_reply(self, messages, sender=None, **kwargs):
        """自动裁剪过长的上下文"""
        
        # 估算token数
        total_tokens = sum(len(m.get("content", "").split()) * 1.3 
                          for m in messages)
        
        if total_tokens > self.max_context:
            # 策略1: 保留最新的消息
            truncated = messages[-10:]  # 只保留最近10条
            
            # 策略2: 总结旧消息
            if len(messages) > 20:
                old_messages = messages[:-10]
                summary = self._summarize_messages(old_messages)
                
                truncated = [
                    {"role": "system", "content": f"之前的对话摘要: {summary}"}
                ] + messages[-10:]
            
            messages = truncated
        
        return super().generate_reply(messages, sender, **kwargs)
    
    def _summarize_messages(self, messages):
        """总结旧消息"""
        combined = "\n".join([m.get("content", "") for m in messages])
        
        summary_agent = autogen.AssistantAgent(
            name="summarizer",
            llm_config=self.llm_config
        )
        
        return summary_agent.generate_reply(
            f"总结以下对话(不超过200字):\n{combined}"
        )
```

---

## 十四、生产部署

### 14.1 容错处理

```python
class ResilientAgent(autogen.AssistantAgent):
    """带重试和降级的Agent"""
    
    def __init__(self, *args, max_retries=3, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_retries = max_retries
    
    def generate_reply(self, messages, sender=None, **kwargs):
        """带指数退避的重试"""
        import time
        
        for attempt in range(self.max_retries):
            try:
                return super().generate_reply(messages, sender, **kwargs)
            
            except Exception as e:
                if attempt == self.max_retries - 1:
                    # 最后一次失败,降级处理
                    return self._fallback_response(e)
                
                # 指数退避
                wait_time = 2 ** attempt
                print(f"[重试] {self.name} 失败,{wait_time}秒后重试...")
                time.sleep(wait_time)
        
        return self._fallback_response(Exception("超过最大重试次数"))
    
    def _fallback_response(self, error):
        """降级响应"""
        return f"抱歉,我遇到了技术问题({error}),请稍后重试或联系管理员。"
```

### 14.2 监控和日志

```python
import logging
import json
from datetime import datetime

class MonitoredAgent(autogen.AssistantAgent):
    """带监控的Agent"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # 配置日志
        self.logger = logging.getLogger(f"agent.{self.name}")
        handler = logging.FileHandler(f"logs/{self.name}.jsonl")
        handler.setFormatter(logging.Formatter('%(message)s'))
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
        
        # 统计指标
        self.stats = {
            "total_messages": 0,
            "total_tokens": 0,
            "total_cost": 0.0,
            "errors": 0
        }
    
    def generate_reply(self, messages, sender=None, **kwargs):
        """记录每次交互"""
        import time
        
        start_time = time.time()
        
        try:
            response = super().generate_reply(messages, sender, **kwargs)
            
            # 估算成本
            tokens = len(response.split()) * 1.3
            cost = tokens * 0.00002  # GPT-4估算
            
            # 更新统计
            self.stats["total_messages"] += 1
            self.stats["total_tokens"] += tokens
            self.stats["total_cost"] += cost
            
            # 记录日志
            self.logger.info(json.dumps({
                "timestamp": datetime.now().isoformat(),
                "sender": sender.name if sender else None,
                "response_length": len(response),
                "tokens": tokens,
                "cost": cost,
                "latency_ms": (time.time() - start_time) * 1000,
                "status": "success"
            }, ensure_ascii=False))
            
            return response
        
        except Exception as e:
            self.stats["errors"] += 1
            
            self.logger.error(json.dumps({
                "timestamp": datetime.now().isoformat(),
                "error": str(e),
                "status": "error"
            }))
            
            raise
    
    def get_stats(self):
        """获取统计信息"""
        return self.stats
```

### 14.3 多租户隔离

```python
class MultiTenantSystem:
    """多租户AutoGen系统"""
    
    def __init__(self):
        self.tenant_agents = {}  # {tenant_id: agents}
        self.tenant_limits = {}  # {tenant_id: limits}
    
    def create_tenant(self, tenant_id, config):
        """创建租户的Agent实例"""
        
        # 配置租户限制
        self.tenant_limits[tenant_id] = {
            "max_messages_per_day": config.get("max_messages", 1000),
            "max_concurrent_chats": config.get("max_concurrent", 5),
            "current_usage": 0
        }
        
        # 创建租户的Agent
        assistant = autogen.AssistantAgent(
            name=f"{tenant_id}_assistant",
            llm_config=config["llm_config"]
        )
        
        self.tenant_agents[tenant_id] = {
            "assistant": assistant,
            "active_chats": []
        }
    
    def chat(self, tenant_id, message):
        """租户发起对话"""
        
        # 检查限制
        limits = self.tenant_limits.get(tenant_id)
        if limits["current_usage"] >= limits["max_messages_per_day"]:
            return "已达每日消息限额"
        
        if len(self.tenant_agents[tenant_id]["active_chats"]) >= limits["max_concurrent_chats"]:
            return "并发对话数已满,请稍后重试"
        
        # 执行对话
        assistant = self.tenant_agents[tenant_id]["assistant"]
        
        # ... 对话逻辑
        
        # 更新使用量
        limits["current_usage"] += 1
        
        return result
```

---
