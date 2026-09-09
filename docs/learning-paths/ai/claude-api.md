# Claude API 使用学习路线

Claude 是 Anthropic 的大模型系列,以**安全对齐、长文本理解、代码与写作能力强**著称:200K(部分模型 1M)上下文窗口让它能一次读完整本书/整个中型代码库;工具使用与 Prompt Caching 等工程能力成熟,是 2024 年后与 OpenAI GPT 并列的主流 API 选择(Claude Code 等终端 Agent 更是把它的代码能力推到聚光灯下)。本页覆盖:**模型选型、Messages API、长上下文与缓存、工具使用、视觉、成本与工程化**——通用 Agent/Prompt 方法论见 [Agent 基础](/learning-paths/ai/agent-basics) 与 [Prompt Engineering](/learning-paths/ai/prompt-engineering),这里聚焦"Claude 这家 API 怎么用到位"。

这条线按 **模型选型 → Messages API 基础 → 长上下文与多轮 → Prompt Caching → 工具使用 → 视觉与结构化输出 → 工程化(错误/成本/安全)→ 场景实践** 推进。

## 第一站:模型选型——按任务与成本配模型

**Claude 家族三层(以官方最新命名为准,理解"角色"即可)**:Haiku(最快最便宜——**分类/抽取/摘要/路由/翻译等简单任务**)、Sonnet(速度与智能的平衡——**日常默认主力:大多数对话、代码、文档任务**)、Opus(最强推理——**复杂数学/长链推理/高难度代码/方案评审**,贵且慢)。**选型心法**:先默认 Sonnet 跑通,复杂度不够再升 Opus、追求成本再降 Haiku——**给每个任务配对的模型,是 API 成本控制的第一杠杆**;同系列还分**输入输出长度档位**(如 32K 输出版,长文档生成用);新模型迭代快,**上线前用你的 golden 任务集实测对比再锁版本**(模型版本要钉住,别让上游升级悄悄改变行为)。

## 第二站:Messages API 基础

**核心请求形态**(Python/TS SDK 都同构):(messages.create(model=..., max_tokens=..., system=..., messages=[对象(role属性)]))——要点:**`system` 是独立顶层参数**(Claude 的 system prompt 设计:角色/规则/输出格式放这里,和对话消息分离,便于做 Prompt Caching);**`max_tokens` 必填**(不设会报错——同时它也是成本与"跑题长度"的硬闸);消息角色只有 user/assistant(多轮 = 交替追加);**流式输出**:`stream=True` 走 SSE,增量 `content_block_delta`——打字机体验、长输出尽早可见、可中途止损(用户打断就断开,省 token)。
**SDK 与接入**:官方 anthropic SDK(python/typescript)+ 社区适配(Vercel AI SDK、LangChain `ChatAnthropic`——见 [LangChain](/learning-paths/ai/langchain));**调用入口形态**:自建后端代理(密钥不下发前端——**API Key 只进服务端是铁律**,前端走你自己的接口)。

## 第三站:长上下文与多轮——用好 200K

**长上下文是 Claude 的招牌**:一次塞整份合同/整本手册/整个仓库的多个文件做全局分析——**"塞得下就整读"省去 RAG 的切分丢失**(对比 [RAG](/learning-paths/ai/rag-systems):文档 ≤ 窗口且要全局理解 → 整读;超长/海量/要频繁更新 → RAG;**混合:长文整读 + 知识库检索**是常见组合)。**多轮对话管理**:API 无状态——**上下文历史由你维护**(数组追加;超窗策略:滑动窗口/摘要压缩,方法见 [Agent 基础](/learning-paths/ai/agent-basics) 上下文节);**长输入的成本现实**:输入 token 全量计费——所以"每次把 100K 历史全重发"会很贵,**稳定的大段内容(文档/工具说明/系统提示)配 Prompt Caching(下一站),高频变化的小段(用户消息)放缓存之后**。**Token 估算**:SDK 的 count_tokens 或在线估算——写进成本核算脚本。

## 第四站:Prompt Caching——长上下文应用必开

**机制**:对请求中**稳定的前缀**(system prompt、长文档、工具定义、few-shot 示例)打缓存标记((cache_control: &#123;"type": "ephemeral"&#125;) 或 SDK 参数);命中缓存后该部分输入**成本降至约 1/10、延迟下降**——**"重复的长 prompt 只付一次全价"**。**用法**:把"每次相同"的内容放最前并标缓存(缓存按前缀匹配:相同的开头越长约省);**典型收益场景**:①长 system prompt + 工具描述的 Agent(每轮都重发——缓存后成本骤降);②文档问答(长文档标缓存,用户问题变但不重算文档);③多轮对话(把历史的一部分设为缓存前缀)。**注意**:缓存有 TTL(几分钟内有效——连续请求才命中;跨小时不活跃会过期);不同模型缓存定价不同;写码前看官方最新缓存文档——**这是 Claude API 成本优化的第一性价比动作**。

## 第五站:工具使用(Tool Use)——Agent 的引擎

**Claude 的原生工具调用**(与 OpenAI function calling 同构):请求带 `tools: [&#123;name, description, input_schema(JSON Schema)&#125;]`;模型需要时返回 **`tool_use` content block**(工具名+参数 JSON)——**不执行,只是意图**;你的代码执行后把结果作为 `tool_result` 回传,模型继续推理——循环直到不再要工具(完整模式见 [Agent 基础](/learning-paths/ai/agent-basics))。
**工程要点**:工具描述写清"何时用";参数 schema 严格;**强制结构化输出的可靠姿势:定义"输出工具"让模型把结果写进 JSON 参数**(比裸 JSON 模式更稳——Claude 文档推荐的 JSON 输出法);工具结果超长先摘要;**Agent 场景的 Claude 优势**:长上下文(带大文档做工具决策)、代码工具链(读文件/写文件/终端——Claude Code 就是这么干的,见 [Claude MCP](/learning-paths/ai/claude-mcp) 的工具生态)。
**安全**:工具权限最小化 + 敏感操作确认(Claude 安全训练会拒绝明显有害指令,但你的应用层护栏不能省——见 [Agent](/learning-paths/ai/agent-development) 安全章)。

## 第六站:视觉与多模态

Claude 支持**图像输入**(content block 传 image:base64 或 URL):**截图分析/UI 评审**(上传界面图要改进建议)、**文档与图表理解**(扫描件/流程图转结构化)、**截图转代码**(设计稿→前端骨架——前端效率流)、图像中的文字提取(OCR 场景顺带)。要点:图要清晰(分辨率影响识别)、配文字说明任务;输出仍以文本为主;价格按图像 token 计(大图贵——**先压缩/裁剪再传**);视频/音频输入支持随版本扩展,以官方为准。**多模态的最佳实践**:给模型"先看再想再答"的指令(观察→分析→结论),视觉任务也吃 CoT(见 [Prompt](/learning-paths/ai/prompt-engineering))。

## 第七站:工程化——错误、成本、安全

**错误处理矩阵**:429(限流:退避重试+并发控制)、529(Anthropic 过载:重试)、400(参数错:查 max_tokens/schema)、5xx(服务端:重试);超时(长输出流式要设读超时)——**统一封装:重试(指数退避+抖动)+ 熔断(连续失败降级)**;**并发**:SDK 异步并发 + 客户端限流(配额管理);**批量 API**(非实时任务):异步批处理约 5 折——**日志分析/批量翻译/离线评估这类任务先考虑批处理**。
**成本控制清单**:模型路由(按任务分 Haiku/Sonnet/Opus)、Prompt Caching(长前缀)、批处理(离线)、max_tokens 收紧、上下文裁剪、逐请求记账+预算告警(见 [Agent 开发](/learning-paths/ai/agent-development) 成本节)。
**安全与治理**:API 密钥服务端保管;Claude 有拒绝有害请求的安全训练——应用要设计好"拒绝/边界"的呈现(别让用户觉得被莫名其妙拒绝,给理由与替代);**提示注入防御**(外部内容当数据——见 Prompt 页);**数据合规**:了解 API 的数据政策(默认不用于训练;企业/零保留选项)——涉及敏感业务先查官方条款。
**评估**:换模型/改 prompt 跑你的 golden 集(LLM-as-judge 或人工),**别盲信榜单——在自己任务上实测**(Claude 与 GPT 各有擅长:代码/长文/写作场景常是 Claude 强项,但以实测为准)。

## 第八站:场景实践与生态

**高频场景配方**:①**长文档问答**:整文档 + 缓存 + "先定位再回答,引用原文出处"(防幻觉);②**代码审查**:仓库文件拼接 + 审查清单 prompt(见 [Prompt](/learning-paths/ai/prompt-engineering) 模板库)+ 工具(拉取 diff/跑测试);③**UI 分析/转代码**:截图 + Vision(见上);④**多轮助手**:系统提示 + 缓存 + 会话历史管理;⑤**终端编程 Agent**:体验 Claude Code(官方 CLI——工具调用+文件操作的完整范例,也是学习"代码 Agent 产品"的最佳样本)。**生态地图**:官方 Claude Code/API 文档与 Cookbook、Anthropic 的 prompt 工程最佳实践文档(业内公认高质量)、LangChain/LlamaIndex 集成(见各页)、**MCP(模型上下文协议:Claude 连接外部工具/数据的标准接口——必学,见 [Claude MCP](/learning-paths/ai/claude-mcp))**。

## 通关标准

能独立做到:用官方 SDK 完成基础对话+流式+多轮,并说出 system/max_tokens 的坑;给一个长文档应用配好 Prompt Caching 并量化省了多少钱;实现一次完整的工具使用循环(定义工具→模型调用→执行回填→再推理)并用"输出工具"拿到稳定 JSON;写清 429/529 的重试与熔断策略;按任务给 Haiku/Sonnet/Opus 做了路由并跑过自己的 golden 评估——Claude API 主线通关。

Claude API 的"会用"不难(一个 create 调用),"用好"在四个杠杆:**模型路由、Prompt Caching、工具循环、长上下文设计**——它们决定同样的功能你花 1 倍还是 10 倍成本、得到 60 分还是 95 分的效果。API 是易耗品而能力是复利:把本页的工程习惯(缓存、评估、护栏)沉淀成你自己的封装层,换任何模型都能平移。下一步:给 Claude 接工具生态 [MCP](/learning-paths/ai/claude-mcp),或组合进 [Agent](/learning-paths/ai/agent-basics)/[RAG](/learning-paths/ai/rag-systems) 系统。
