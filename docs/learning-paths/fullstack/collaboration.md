# 前后端协作学习路线

前后端分离之后,**接口就是双方的"合同"**:URL 怎么定、响应长什么样、错误怎么表达、鉴权怎么流转、类型怎么对齐——**约定不清,联调就是灾难现场**。本页把"合同条款"讲清楚,让前后端各司其职、少吵架。适用所有技术栈组合(React/Vue + Node/Python/Java/Go 都同此理),语言无关。

## 第一站:API 设计规范——RESTful 的共识

**资源与方法一一对应(全栈团队的通用语言)**:GET 资源集合、GET 资源详情(id 在路径里)、POST 创建、PUT 全量更新、PATCH 局部更新、DELETE 删除——**URL 只谈"资源",不谈动作**(`POST /orders` 而不是 `/createOrder`);复数名词 + 版本前缀(`/api/v1/orders`)是默认约定;嵌套资源按需(`/api/users/&#123;id&#125;/orders` 或查询参数,别过度嵌套)。**命名**:URL 用 kebab/lowercase,JSON 字段用 camelCase(前端)或 snake_case(后端)——**建议后端输出 camelCase 或统一转换层,别让前端到处改名**。字段语义要稳定:删除用 204 或 200+deleted 标志、更新返回更新后的对象(免前端再查一次)。

## 第二站:统一响应格式——双方的"合同模板"

**先定三个结构,全项目一致(前后端各写一次封装,之后永远不变)**:①**成功**:(&#123; success: true, data: ... &#125;)(data 里放业务数据;列表/详情/操作结果都走 data);②**失败**:(&#123; success: false, error: &#123; code: 'VALIDATION_ERROR', message: '人话描述', details: &#123;...&#125; &#125; &#125;)——**code 是给程序判断的机器码(稳定),message 是给用户看的人话(可改)**;③**分页**:`data: [...]` + `pagination: &#123; page, pageSize, total, totalPages &#125;`——**分页结构必须在第一天定死**,后期加字段会破坏前端所有列表页。**为什么统一**:前端请求层只写一次"解包/报错"逻辑,业务代码不用每个接口各写一套 try/catch 与字段判断——**契约的收益在封装层体现**。

## 第三站:错误处理——后端收敛,前端封装

**后端**:所有异常收敛到**全局错误处理器**(框架都有:@RestControllerAdvice/@ControllerAdvice、Nest 的异常过滤器、Express 错误中间件——见 [Spring Boot](/learning-paths/backend/spring-boot)/[NestJS](/learning-paths/backend/nestjs) 各页):业务异常映射成约定的 code/message(400 参数错/401 未登录/403 无权限/404 不存在/409 冲突/422 校验失败——**状态码语义见 [HTTP](/learning-paths/cs-basics/computer-networks)**);未知异常记日志后统一 500,**绝不把堆栈/数据库错误原样返回前端**(安全与体验,见 [Web 安全](/learning-paths/security/web-security) 错误处理章)。
**前端**:请求层统一封装(Axios/Fetch 拦截器):**非 2xx 自动读 error.message 弹提示,401 统一跳登录,业务代码里不再散落 try/catch**(见 [React](/learning-paths/frontend/react)/[Vue](/learning-paths/frontend/vue) 的请求封装实践)——**"后端一个全局异常器 + 前端一个拦截器",错误处理全项目一次写完**。

## 第四站:鉴权流转——登录态的双方协议

**JWT 的完整流转(双方都要懂,见 [认证](/learning-paths/security/auth))**:登录接口返回 accessToken(与 refreshToken)→ 前端存(内存/HttpOnly Cookie 权衡)→ **请求拦截器统一加 `Authorization: Bearer &lt;token&gt;`** → 后端过滤器/守卫验签并注入当前用户 → **响应拦截器遇 401:尝试 refresh 换新 token 重放请求,失败则跳登录**——**"401 自动续期"是前后端最容易各写各的环节,必须提前约定**(谁负责刷新、并发请求时怎么排队刷新、刷新失败跳哪)。**权限的前端是体验、后端是安全**:前端按角色隐藏按钮(体验),**后端每个接口做鉴权与数据权限校验(安全底线——见 [Web 安全](/learning-paths/security/web-security) 越权章)**。

## 第五站:接口文档与契约先行——消灭"联调吵架"

**三种契约形态(按工程化程度递进)**:①**文档工具**:Swagger/OpenAPI(自动从后端代码生成——Spring 的 springdoc、FastAPI 自动、Nest 的 @nestjs/swagger——见各框架页)——**后端写完接口,前端在 Swagger UI 里直接试调**,这是最低成本的契约;②**类型共享(TS 栈)**:把前后端共享的类型(User/Order/DTO)放进 shared 目录或独立包,**单一来源 import**——后端改字段,前端编译期报错(JS 全栈的杀手锏,见 [JavaScript 全栈](/learning-paths/fullstack/javascript));③**代码生成/monorepo**:OpenAPI 生成前端 client 代码或 monorepo 共享源码——**接口变更 = 类型变更 = 编译期暴露**,联调时间趋近于零。
**务实建议**:小团队先上 Swagger + 口头约定;类型敏感的 TS 全栈上类型共享;**契约先行的核心是"改接口要通知 + 有版本可查"**(API 版本化 `/v1/` `/v2/`,破坏性变更升版本不硬改)。

## 第六站:联调环境与调试——让"调不通"变少

**开发环境打通三件套**:①**前端代理**(Vite/Webpack devServer proxy 或 Next 的 rewrites:前端请求 `/api` 转发到后端本地端口——**免 CORS 配置,前端代码里写相对路径,与生产一致**,见 [Vite](/learning-paths/frontend/vite) 代理章);②**Mock 兜底**(后端还没好时:前端用 MSW/mock 数据按契约先行开发——**别等后端**;契约定了就能并行);③**跨域配置**(真要跨域:后端 CORS 白名单配开发地址,别 `*` 带凭证,见 [Nginx](/learning-paths/middleware/nginx) CORS 章)。
**调试共识**:前端报错先看 Network 面板(请求发出没?状态码?响应体?)——**"接口调不通"九成是三层:URL/参数没对齐(看请求体)、鉴权头没带(看请求头)、响应结构不符预期(看响应体)**;后端报错先看日志(带 traceId——**日志与请求对应,见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 可观测章**)。

## 第七站:跨团队协作的工程机制

**①接口变更流程**:改契约 = 改文档/类型 + 通知对方(群/PR 描述)——**"悄悄改接口"是协作第一大忌**;②**联调前置**:后端按契约先出 Swagger/mock,前端并行开发,约定联调日集中过——**别等全部完成才碰头**;③**环境分层**:dev(各自本地)/test(集成联调环境,双方代码都部署上去)/staging(预发布)——**"在我本地是好的"不是好的,test 环境绿了才算数**(见 [部署](/learning-paths/fullstack/deployment));④**E2E 兜底**:关键流程用 E2E 测试锁住契约(前端测试 mock 与真实接口各一套——见 [测试](/learning-paths/fullstack/testing));⑤**前端对后端的合理要求**:稳定的分页/错误结构、时间字段格式统一(ISO 8601 + 时区)、大字段分页/懒加载——**契约里把"边界"也写清楚**(单页条数、超时时间、幂等键)。

## 通关标准

能独立做到:说出 RESTful 资源设计规范与状态码语义;画出统一响应/错误/分页三个结构并说明各自解决什么问题;讲清 JWT 在前后端的完整流转(存哪/谁加头/401 怎么续期);给自己的项目配上 Swagger 或类型共享并让"改接口"能通知到对方;遇到"接口调不通"能按 URL/鉴权/响应三层快速定位——前后端协作主线通关。

前后端协作的本质是"**把隐性约定变成显性契约**":URL、响应、错误、鉴权、类型——每一项在开工第一天定清楚,后面每一天都在省时间。**契约先行的最高境界,是让"接口变了"在编译期或文档里自动暴露,而不是在联调现场互相质问**。它是全栈工程师的"软硬结合部"技能:硬(协议/工具)与软(沟通/流程)各占一半——**把本页的模板抄进团队文档,你的联调体验会脱胎换骨**。下一步:全链路性能见 [性能优化](/learning-paths/fullstack/performance),接口质量靠 [测试](/learning-paths/fullstack/testing) 锁住。
