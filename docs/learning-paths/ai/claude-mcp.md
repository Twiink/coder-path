# MCP(模型上下文协议)学习路线

MCP(Model Context Protocol,模型上下文协议)是 Anthropic 于 2024 年底发起的**开放协议**,让 AI 应用能统一、安全地连接外部工具与数据源——官方比喻是"**AI 的 USB-C 接口**":一次实现,处处可用。2025 年 OpenAI、Google 等相继宣布支持,它已成为"AI 工具生态"的事实标准:Claude Desktop/Claude Code、各类 IDE 与 Agent 框架都在用 MCP 接工具。**它与 Function Calling 的关系(先想清楚)**:函数调用是"模型 API 内部定义工具"的机制(见 [Claude API](/learning-paths/ai/claude-api));MCP 是"**工具生态的通用接口标准**"——一个数据库 MCP Server 写一次,Claude Code、Cursor、你的 Agent 都能用。本页教你把能力"包成 MCP Server"并用好现成生态。

这条线按 **概念与架构 → 三种原语 → 快速上手 → Server 设计 → 安全 → 实战场景 → 调试与部署 → 生态与治理** 推进。

## 第一站:架构与核心概念

**三要素(先记牢)**:①**Host(宿主)**:运行 AI 的应用(Claude Desktop/Claude Code/IDE/你的 Agent 程序)——它持有模型与用户会话;②**Client(客户端)**:宿主内部的 MCP 客户端组件,负责与 Server 建立连接、协商能力、转发调用;③**Server(服务器)**:**工具提供方**——暴露特定能力(文件系统/数据库/GitHub/内部 API),一个 Server 就是"一组能力的打包"。**连接方式**:Server 通过配置注册给 Client(本地:`mcpServers` 配置启动命令(stdio);远程:HTTPS URL);通信协议 **JSON-RPC 2.0**,传输层本地用 stdio(子进程管道——最简单最常见),远程用 **Streamable HTTP**(2025-03 规范修订,替代老 HTTP+SSE;远程要 OAuth 鉴权)。**握手与能力协商**:连接后双方交换 capabilities(server 声明支持哪些原语/特性)——客户端据此渲染与调用。**心智**:MCP 不改变"模型怎么调用工具"(内部仍是各家函数调用),它统一的是**工具的定义、发现、鉴权与传输**——你的 Agent 代码不再写死"调用 GitHub API",而是说"调用名叫 github-search 的工具",由 MCP 客户端路由到对应 Server。

## 第二站:三种原语——Tools / Resources / Prompts

MCP Server 暴露三类能力,**选对类型是设计的一半**:①**Tools(工具:可执行动作)**:模型主动调用(带参数、有副作用)——查天气、写文件、发邮件、跑 SQL;定义 = 名称 + 描述 + JSON Schema 参数 + 处理函数(**与函数调用的工具定义同构**);②**Resources(资源:只读数据)**:按 **URI** 暴露的内容(文件、数据库记录、文档片段、配置)——模型/用户按需读取;区别于"塞进上下文",Resources 是"**可被请求的数据源**"(类似"文件系统挂载",支持列表与订阅更新);③**Prompts(提示模板:可复用工作流)**:预置的提示词模板(代码审查、周报总结、Bug 分析)——用户/模型一键套用,把团队最佳实践固化。**设计提示**:动作与写操作 → Tools;只读内容与知识 → Resources;**"读数据库表结构"适合 Resources(模型先看 schema 再决定查什么)**,而"执行查询"是 Tool。

## 第三站:快速上手——第一个 Server

**官方 SDK 双语言**(TypeScript `@modelcontextprotocol/sdk` 与 Python `mcp`),写一个 Server 只需:①定义工具(装饰器或注册函数:名字 + 描述 + schema + async 处理函数);②起服务(stdio 传输,几行搞定);③**接入宿主测一把**:Claude Desktop 的配置文件加 server 条目,或 **Claude Code 里 `claude mcp add`**——重启后问模型"用计算器算 3.14×2",看它调用你的工具。**站在巨人肩上**:先跑通官方参考实现(servers 仓库:filesystem/git/github/数据库/浏览器等)与第三方生态(Smithery/官方目录等"包管理器")——**很多能力不用自己写,配置即用**;再照着 SDK 示例写自己的。**注意**:新装 Server 后要重启/重连客户端才会重新发现工具。

## 第四站:Server 设计——好工具的三个标准

**①描述与 Schema 决定调用率**(模型靠 description 路由,写清"何时用/何时别用/参数含义");**②单一职责**(一个 server 一组内聚工具:别把"文件读写+发邮件+查天气"塞一个 server——按域拆分便于授权与复用);**③错误要"模型可读"**(抛结构化错误信息("文件不存在:xxx"或 JSON {error, code}),别丢堆栈——模型会基于错误信息换策略);**④超时与限流**:工具内部调外部 API 要有超时;server 对高频调用做限流(防止模型循环调爆);**⑤日志审计**:每次工具调用(参数/结果摘要/耗时)落日志——MCP 是"高杠杆入口",审计不可省;**⑥Resources 提供"元数据先行"**(如数据库 server 先给表结构 resource,再让模型写查询工具的参数)。

## 第五站:安全——MCP 是双向信任面

**清醒认知:把 MCP Server 交给 AI,等于把"那部分能力"交给一个会被 prompt 注入的代理**——安全设计是 Server 开发者的第一责任:**Server 侧**:①输入校验(schema 之外再校验路径/参数——**文件类工具必须路径沙箱**(限定目录,防 ../ 穿越);②**只读优先**:能只读就只读(数据库 server 用只读账号 + LIMIT 强制 + 查询超时——防 AI 生成的全表扫描拖垮库);③写/删/执行类工具:命名与描述上显著标记(如 "dangerous-write-file"),宿主可配"高风险工具需用户确认"的 UI;④速率限制与配额;⑤**远程 server 鉴权**(OAuth/API Key,经 HTTPS——2025 规范强制方向);⑥依赖与供应链安全:**只装可信来源的 Server**(一个恶意 filesystem server 能读走你全部文件——**MCP Server 拥有宿主的权限,信任它 = 信任它的作者**);**宿主侧**:给不同 server 最小权限、审计工具调用、对高风险工具加确认闸。系统方法论见 [Agent](/learning-paths/ai/agent-development) 与 [Web 安全](/learning-paths/security/web-security)。

## 第六站:实战场景(生态地图)

**高频 Server 类型与选型**:①**开发环境**:文件系统、Git、终端执行、代码搜索——**Claude Code/Cursor 类编码 Agent 的日常**(终端类工具=高危险面,务必沙箱+确认);②**知识库/文档**:Notion/Confluence/本地文档——让 AI 基于公司知识回答(可配 [RAG](/learning-paths/ai/rag-systems) 思路);③**数据库**:Postgres/MySQL 只读 server——自然语言查数;"给运营一个会查库的 AI 助手"是内部工具的最快落地;④**浏览器自动化**:Playwright MCP——让 AI 操作网页(测试/填表/抓取——注意被诱导访问恶意页面的注入风险);⑤**内部系统**:把公司 API(工单/CRM/发布系统)包成 server——"一处封装,Claude Code/桌面/自研 Agent 全通"是 MCP 的核心卖点;**⑥自研 Agent 集成**:多数 Agent 框架(SDK 与 LangChain 等)提供 MCP 客户端适配器——你的 Agent 代码可通过 MCP 动态获得工具(见 [Agent 基础](/learning-paths/ai/agent-basics) 工具章与 [LangChain](/learning-paths/ai/langchain))。

## 第七站:调试、测试与发布

**调试**:官方 **MCP Inspector**(图形化调试器:连 server 看 requests/responses、模拟客户端调工具——写 server 的标配);日志(server 侧 stdout/stderr 与专用日志通道);**测试**:工具处理函数当普通函数单测 + 用 Inspector/测试客户端做集成(真跑一次工具流);**发布与部署三形态**:本地个人(stdio 配置,零运维)、团队内网(远程 HTTP 部署 + 鉴权 + HTTPS——**生产 server 要容器化**(见 [Docker](/learning-paths/devops/docker))、健康检查与监控(调用量/错误率/审计日志));注册到生态目录(官方/第三方)让别人可发现。**版本兼容**:server 声明协议版本与 capabilities;客户端对未知能力优雅降级——升级 SDK 前读 changelog(协议仍在演进,2025 年密集修订)。

## 第八站:定位、风险与下一步

**为什么它赢**:工具生态"去碎片化"(以前每个 AI 应用各自实现 GitHub/DB/浏览器集成;MCP 一次实现处处复用)、**模型无关/应用无关**(Anthropic 发起,OpenAI/Google 跟进,行业事实标准)、**安全成为一等公民**(权限/鉴权/审计进协议设计)。**风险与治理(组织落地要正视)**:供应链攻击(恶意 server)、过度授权(server 拿宿主全权限)、审计缺失、prompt 注入经工具结果回流——治理清单:server 白名单与来源审查、最小权限配置、调用审计、高风险操作确认、定期复查授权。**下一步分支**:写工具 → [Agent 基础](/learning-paths/ai/agent-basics)(把 MCP 工具装进自己的 Agent);做产品 → [Claude API](/learning-paths/ai/claude-api)(宿主能力);框架集成 → [LangChain](/learning-paths/ai/langchain) 的 MCP 适配;安全加固 → [Web 安全](/learning-paths/security/web-security) 与 [Agent 开发](/learning-paths/ai/agent-development) 安全章。

## 通关标准

能独立做到:用官方 SDK 写一个暴露 2-3 个工具 + 1 个 Resource 的 MCP Server 并接入 Claude Code/Desktop 实测;说清 Tools/Resources/Prompts 的区别与选型;给"文件访问/数据库查询"类 Server 写出完整安全方案(路径沙箱/只读/限流/审计);会用 MCP Inspector 调试一次工具调用失败;评估过一个第三方 Server 的信任风险再决定装不装——MCP 主线通关。

MCP 的意义不在协议本身,而在它把"AI 的工具生态"从各自为政推向统一标准——就像 USB 统一了外设接口:未来你写的每个内部工具,都值得多包一层 MCP,让组织里所有 AI 应用都能用。**记住它的安全不等式:MCP Server 的权限 = 宿主 AI 的权限**——能力越大,越要沙箱、审计与最小授权。协议还在快速演进,但"工具标准化 + 安全边界"这两个方向不会变。下一步:让 [Agent](/learning-paths/ai/agent-basics) 通过 MCP 长出手脚,或深挖 [Claude API](/learning-paths/ai/claude-api) 的工具循环。
