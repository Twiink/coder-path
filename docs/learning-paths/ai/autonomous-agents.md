# 自主 Agent (AutoGPT/AutoGen)

给 AI 一个目标，让它自己搞定。自主 Agent 是从"问答助手"到"自主同事"的跨越。虽然还不完美，但已经能处理不少复杂任务了。

## 基础篇

> 📖 篇笔记：[自主、反思与多智能体协作](/study-notes/ai/03-autonomy-reflection-multi-agent) · [AutoGen 框架](/study-notes/ai/autogen-framework)

理解自主 Agent 的核心机制：

- **什么是自主 Agent**：目标驱动、自主规划、持续执行、自我反思
- **Think-Plan-Act-Observe-Reflect 循环**：Agent 的基本运作流程
- **与普通 Agent 的区别**：从单次调用到持续工作
- **AutoGPT 的核心思想**：任务分解、循环执行、动态调整
- **记忆系统**：短期记忆、长期记忆、情景记忆
- **终止条件设计**：什么时候算完成，避免无限循环

## 进阶篇

AutoGen 的多 Agent 协作：

- **多 Agent 架构**：程序员、审查员、测试员的分工协作
- **UserProxy Agent**：代表人类的特殊 Agent
- **GroupChat 模式**：多个 Agent 在一起讨论
- **Sequential Workflow**：按顺序传递任务
- **Nested Chat**：Agent 可以启动子 Agent
- **工具调用集成**：搜索、代码执行、文件操作
- **Human-in-the-loop**：关键决策保留人工确认

## 实战篇

动手构建真实的自主系统：

- **简化版 AutoGPT**：实现基础的自主规划和执行
- **代码生成 + 审查 + 测试**：多 Agent 完整流程
- **研究助手**：搜索、总结、写报告
- **Planning Agent**：先制定详细计划再执行
- **Reflective Agent**：从经验中学习改进
- **错误处理与重试**：Agent 失败了怎么办
- **成本控制**：监控 API 调用，设置预算上限

## 常见问题与解决

自主 Agent 的坑和填坑方法：

- **无限对话问题**：设置轮数上限和终止条件
- **偏离目标**：定期提醒目标，强化约束
- **成本失控**：监控每次调用，预算告警
- **调试困难**：详细日志、步骤可视化
- **安全控制**：沙箱执行、权限限制、审计日志

## 下一步学习

自主 Agent 还在快速发展：

- **AI Agent 基础** → 打好基础，理解工具调用和规划
- **LangChain 框架** → Agent 和 Chain 的实现
- **RAG 系统** → 给 Agent 接入知识库
- **Prompt Engineering** → 优化 Agent 的推理能力
