# 全栈测试学习路线

测试不是"写完了再说",而是**给重构兜底的安全网**——全栈工程师的测试观:**前端管交互、后端管接口、E2E 管关键流程,三层各司其职**(测试金字塔:单元多、集成中、E2E 少——见 [Jest](/learning-paths/testing/jest) 的测试观)。本页是"全栈测试"的分层地图;各层工具细节见 [React](/learning-paths/frontend/react) 的测试章、[Jest](/learning-paths/testing/jest)、[Pytest](/learning-paths/testing/pytest)、[JUnit](/learning-paths/testing/junit)、[Cypress](/learning-paths/testing/cypress) 等页。

## 第一层:前端测试——单元 + 组件

**测什么**:①**纯逻辑**(工具函数/状态管理/日期计算)——收益最高的单测对象,见 [Jest](/learning-paths/testing/jest)/[Vitest](/learning-paths/frontend/vite);②**组件行为**:渲染出什么、点击/输入后变成什么——用 **Testing Library**(React:render/screen;Vue:Vue Test Utils):查询走用户视角(getByRole/getByText)、交互用 user-event、异步断言 waitFor——**测"用户看到的行为",不测内部实现**(见 [React](/learning-paths/frontend/react) 测试章);③**组件边界**:mock 子组件与请求(依赖隔离);④快照慎用(变更提醒而非验收)。**工具选型**:Vite 项目用 Vitest(同 Jest API 更快),React 配 RTL,组件交互复杂可上 Cypress 组件测试(见 [Cypress](/learning-paths/testing/cypress) 组件章)。

## 第二层:后端测试——单元 + 接口

**测什么**:①**服务/业务逻辑**(单元:mock 数据层依赖,断言"依赖被正确调用+边界处理"——见 [Jest](/learning-paths/testing/jest)/[Pytest](/learning-paths/testing/pytest)/[JUnit](/learning-paths/testing/junit) 的 Mock 章);②**接口测试(后端测试的主力)**:直接请求应用(Supertest 打 Express、pytest 的 test client、MockMvc 打 Spring)——**先拿 JWT token 再带 Authorization 头调接口,断言状态码与响应体关键字段**:200 与数据结构、401/403 鉴权、400/422 参数校验、404 边界——**接口测试 = 把"前后端契约"锁进代码**(见 [协作](/learning-paths/fullstack/collaboration));③**数据库集成**:真实依赖用 Testcontainers(容器起 MySQL/Redis——见 [JUnit](/learning-paths/testing/junit) 章)或框架的测试库(事务回滚,见 [Django](/learning-paths/backend/django) 测试章)。**测试数据**:工厂模式(factory_boy/工厂函数)造数据,别手写一堆 setUps。

## 第三层:E2E 测试——关键流程的最终防线

**测什么**:真实用户的关键路径——"注册→登录→下单→支付成功"或"打开页面→填表提交→断言跳转与结果展示"——**数量少而精(10-20 条),覆盖"跨前后端的完整流程"**(单元与接口都测不到的地方:前端调后端、路由跳转、真实交互)。**工具**:Cypress(调试体验好,见 [Cypress](/learning-paths/testing/cypress))或 Playwright(多浏览器);**E2E 的稳定性纪律**:选择器用 data-cy、自动等待别 sleep、测试独立幂等、失败截图录像(见 [Cypress](/learning-paths/testing/cypress) 稳定性章)。**E2E 的定位清醒**:慢且脆——**只保关键路径,别拿它当全覆盖工具**;日常回归靠单元+接口(快),发布前跑 E2E(稳)。

## 全栈测试的工程机制

**①CI 里自动跑(测试不跑 = 没有测试)**:push/PR 触发全量测试,失败不能合并——见 [GitHub Actions](/learning-paths/devops/github-actions) 与 [GitLab CI](/learning-paths/devops/gitlab-ci);**②覆盖率当护栏不当 KPI**:核心模块(支付/权限/状态机)重点覆盖,CI 卡最低阈值防回退,但别追 100%(见各框架覆盖率章:JaCoCo/istanbul/coverage.py);**③测试环境分层**:单元(本地秒级)/接口(CI)/E2E(独立环境)——**测试要快才能常跑**;④**测试替身哲学**:mock 边界(网络/数据库/时间)要明确——单元测试全替身(快),集成测试用真依赖(真),**别用 mock 把集成测试变成假测试**(Testcontainers 的价值);⑤**改代码的流程**:先看测试红不红(改行为先改测试)——**"重构不怕,测试兜底"是全栈开发的底气**。

## 通关标准

能独立做到:给前端组件写"渲染+交互+异步"测试、给后端接口写"鉴权+校验+业务"测试、给关键流程写 E2E——三层都有代表作;说清测试金字塔每层的位置与数量配比;把测试接进 CI(失败即拦合并)并配好覆盖率护栏;遇到"测试全绿但线上出 bug"能反思是哪层没覆盖到——全栈测试主线通关。

全栈测试的终极心法:**"为信心而测,不为覆盖率而测"**——三层测试的意义不是数字,而是让你敢在周五下午重构核心代码、敢一键上线。**测试是写给未来自己的说明书**:三个月后的你改代码,靠它确认没弄坏什么。别追求一次写全——先给最容易出错的逻辑补单测、给关键接口补接口测试、给主流程补一条 E2E,测试的复利会随着项目长大越来越明显。下一步:把测试接进 [CI/CD](/learning-paths/devops/github-actions),上线流程看 [部署](/learning-paths/fullstack/deployment)。
