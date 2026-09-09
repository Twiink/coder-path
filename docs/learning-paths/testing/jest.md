# Jest 学习路线

Jest 是 JavaScript 测试框架的事实标准:零配置、开箱即用(内置断言、Mock、覆盖率、快照、并行执行),是 React 与 Node.js 项目的主流选择(新 Vite 项目常选同 API 的 [Vitest](/learning-paths/frontend/vite),概念通用)。**先立测试观(比工具重要)**:测试不是负担,是让你敢重构、敢上线的保险;**测试金字塔:单元测试(多、快) > 集成测试(中) > E2E(少、慢)**——把大部分信心押在快的单元测试上;"**为了信心而测试,不是为了覆盖率而测试**"。

这条线按 **配置与第一个测试 → 匹配器 → 生命周期与组织 → 异步测试 → Mock → 快照 → DOM/React 测试 → 覆盖率与 CI → 测试设计** 推进。

## 第一站:安装、配置与第一个测试

**上手**:`npm i -D jest` + package.json 的 `"test": "jest"`;测试文件约定:`xxx.test.js`/`xxx.spec.js` 或 `__tests__/` 目录(默认自动发现)。**第一个测试的结构(背下来)**:

`test('描述行为', () => &#123; 准备 → 执行 → 断言 &#125;)`——it 是 test 别名,**describe('分组', ...) 组织相关用例**;运行:`npm test`、`jest --watch`(监听模式:开发时实时跑——**a 全跑/f 只跑失败/p 按文件名/t 按测试名过滤**)。
**配置要点(jest.config.js)**:`testEnvironment: 'node'`(默认)/`'jsdom'`(测 DOM/组件要浏览器环境);`testMatch`(文件匹配);`moduleNameMapper`(路径别名 @/);`setupFilesAfterEnv`(每个测试文件跑前加载扩展:testing-library/jest-dom);`transform`(TS 用 ts-jest 或 babel;新项目也可 jest.config.ts 写配置);**TS 项目**:ts-jest(慢但带类型)或 babel-jest + 单独类型检查;**提醒**:Vite 项目用 Vitest 配置更顺(见 [Vite](/learning-paths/frontend/vite)),Jest 心智完全复用。

## 第二站:匹配器——断言的词汇表

**基础三兄弟(最高频)**:`toBe`(严格相等 ===——**原始值用它**)、`toEqual`(递归深比较——**对象/数组用它,别用 toBe**)、`toBeTruthy/toBeFalsy`(真假值);`toBeNull/toBeUndefined`。**数值**:`toBeGreaterThan/toBeLessThan`、**`toBeCloseTo`(浮点比较:0.1+0.2 的精度问题——**比浮点别用 toBe**)**。
**字符串**:`toMatch(/正则/)`。**数组与对象**:`toContain`(数组含元素)、**`toMatchObject`(对象部分匹配:只断言关心的字段——接口返回断言神器,不怕多余字段)**、`toHaveProperty`。**异常**:**`expect(() => fn()).toThrow('错误信息')`——要点:必须传函数,不能 `expect(fn())`(那会在断言前就执行抛错)**;`not` 取反(`expect(x).not.toBeNull()`)。
**心法:断言"行为"而不是"实现细节"**——测返回值/抛错/调用参数,别测"调用了第几个内部函数"(重构会碎)。

## 第三站:生命周期与测试组织

**钩子四件**:`beforeAll/afterAll`(套件级一次:连数据库/起服务)、`beforeEach/afterEach`(每个测试前/后:**重建状态、清 mock、清缓存——测试独立性的关键:一个测试的残留不能影响下一个**);钩子在 describe 内只作用于该分组(嵌套 describe 支持层级)。**组织技巧**:`test.only`(只跑这一个——调试)、`test.skip`(暂缓)、`test.todo`(占位提醒);**`test.each([...])('当输入 %s', ...)`(参数化/表格驱动:同一行为多组数据——**比复制粘贴测试优雅,边界用例一表打尽**)。

## 第四站:异步测试

**三种写法(按时代)**:done 回调(老:手动调用 done()/done.fail()——忘调用会超时)、返回 Promise(Jest 自动等它 resolve——**reject 会算失败**)、**async/await(现代首选,最清晰)**。**异步断言利器**:`await expect(promise).resolves.toBe(...)` / `.rejects.toThrow(...)`——**比 try/catch 包裹干净得多**;测并发 `Promise.all`。
**假定时器(测时间逻辑的关键)**:`jest.useFakeTimers()` → `jest.advanceTimersByTime(5000)`(快进 5 秒)/`runAllTimers`(跑完所有)→ **测 setTimeout/防抖/轮询/超时重试不用真等**;**记得 afterEach 里 `useRealTimers()` 还原**,否则影响其他测试;**注意**:假定时器下 Promise 微任务要 `await Promise.resolve()` 冲刷。
**超时**:慢操作 `jest.setTimeout(10000)` 调大(默认 5s)。

## 第五站:Mock——单元测试的替身术

**单元测试只测"自己的代码"**:网络请求、数据库、第三方库、时间——全是替身。**jest.fn()(函数替身)**:`mockReturnValue(固定返回)/mockReturnValueOnce(单次)/mockResolvedValue(异步成功)/mockRejectedValue(异步失败)/mockImplementation(自定义实现)`——**用法:把 mock 函数传给被测函数,断言"它被怎么调用了"**。
**调用断言(单元测试最核心的断言)**:`expect(mockFn).toHaveBeenCalled()`/`toHaveBeenCalledTimes(n)`/`toHaveBeenCalledWith(参数)`/`toHaveBeenLastCalledWith`——**"依赖被正确调用(参数对、次数对)"比"返回了什么"更能锁定行为**;原始记录:`mock.calls`/`mock.results`。
**jest.spyOn(监听真实对象方法)**:不换实现只记录调用(或配 mockImplementation)——测"方法有没有被调";**清理三兄弟(必懂,防跨测试污染)**:mockClear(清调用记录)/mockReset(记录+实现一起清)/mockRestore(还原被 spyOn 的原始实现)——**beforeEach 统一清 mock**。
**模块 Mock(第三方依赖的标准姿势)**:`jest.mock('axios')` 整个模块自动替换成 mock(再配 mockResolvedValue 返回假响应);部分 mock:`requireActual` 拿真实模块再覆盖个别导出;**__mocks__ 目录**(手动 mock,复用);**进阶推荐 MSW(Mock Service Worker)**:在网络层拦截(不 mock 模块)——集成测试更接近真实(见 [React](/learning-paths/frontend/react) 测试章)。

## 第六站:快照测试——变更提醒器

**用途**:对"序列化输出"(组件渲染结构/配置文件/错误信息)首次生成快照文件(`__snapshots__/`),之后每次运行比对——**防"悄悄变了"**;更新:`jest -u`。**正确用法**:快照小而专注(整个页面快照又大又脆——**只对关键结构快照**);**坑**:动态内容(时间戳/ID/随机数)让快照每次必挂——配自定义序列化器忽略或改断言;**心智:快照是"变更提醒",更新前看 diff 确认是有意的**——无脑 -u 等于没测。**现代偏好:组件测试多用行为断言(RTL),快照只作补充**。

## 第七站:DOM、React 与 Node 测试

**DOM/React 测试(RTL 是主角,Jest 只是 runner)**:`testEnvironment: 'jsdom'` + **@testing-library/react**(渲染 `render(<App/>)`、查询 `getByRole/getByText`(用户视角查询——顺带逼你写对无障碍)、`fireEvent`(老)/**user-event**(模拟真实用户交互:点击/输入——推荐)、`waitFor`(异步断言)、`act` 警告(更新要包在 act 里——RTL 大多自动))——完整策略见 [React](/learning-paths/frontend/react) 与 [Vue](/learning-paths/frontend/vue) 测试章;**测试要点:测用户看到的行为(渲染出什么/点击后变成什么),不测内部状态**。**Node 场景**:fs 操作(mock 文件系统或用临时目录)、process.env(测试里改,afterEach 还原)、CLI(参数化调用入口函数)、数据库(mock 仓库层,见各后端框架页)。

## 第八站:覆盖率与 CI

**覆盖率四指标**:语句(statements)/分支(branches:if/else 都跑到)/函数/行——`jest --coverage` 出报告(HTML 在 coverage/ 可浏览器看);**阈值(coverageThreshold)**:全局或按目录设(如 80%)——CI 里不达标构建失败,**防止覆盖率回退**;collectCoverageFrom 指定统计范围(排除配置/类型文件)。**CI 集成(见 [GitHub Actions](/learning-paths/devops/github-actions))**:push 即 `npm test -- --coverage`(CI 里用 `--ci` 模式:不交互)+ 上传覆盖率(Codecov 徽章);失败重试 jest-circus(runner,默认);**调试测试**:VS Code 断点配置(launch.json 的 jest 调试模板)或 `node --inspect-brk`;单测调试用 test.only 缩小范围。

## 第九站:测试设计——写"值钱"的测试

**好测试三标准(写完自查)**:①**测行为不测实现**(重构后测试不该碎——碎了说明测了内部细节);②**快且独立**(不真发网络/不等真时间;失败能立刻定位是哪个用例);③**失败信息可读**(test('描述') 写清"当...应该..."——失败时一眼知道哪坏了)。**测试策略**:纯函数/工具/复杂逻辑(日期计算、状态机、解析器)优先全覆盖——**收益最高的测试对象**;服务层测"依赖调用正确+边界处理";组件层测关键交互;E2E 留给关键路径(见 [Cypress](/learning-paths/testing/cypress));**TDD(红-绿-重构)**:对复杂算法与易错逻辑收益明显(先写失败测试定义行为,再实现);**别为覆盖率凑测试**(测了一堆"没断言的执行"等于没测)。**框架选型提醒**:新项目(Vite 生态)可直上 Vitest(API 与 Jest 兼容、更快);Jest 存量项目与 React 生态依旧主流——**概念百分百通用,迁移成本低**。

## 通关标准

能独立做到:为纯函数写"参数化 + 边界"的完整测试;为依赖网络/数据库的模块用 jest.mock 写"断言依赖被正确调用"的测试;用假定时器测防抖/超时逻辑;用 RTL 给组件写"渲染+交互+异步"三件套测试;看懂覆盖率报告并能在 CI 里卡阈值;说出三条"好测试"标准并能自检——Jest 主线通关。

Jest 教会你的不只是断言语法,而是**"可测试性"的工程观**:代码好不好测,是设计好不好的信号——依赖注入、纯函数、无副作用,这些被测试逼出来的习惯,本身就让代码更健康。**测试是给未来的自己写的说明书**:三个月后的你改代码,靠测试确认没弄坏什么——这份安全感,比任何"覆盖率 100%"的虚荣都值钱。下一步:浏览器端 E2E 用 [Cypress](/learning-paths/testing/cypress) 或 [Playwright],组件测试回 [React](/learning-paths/frontend/react) 深化。
