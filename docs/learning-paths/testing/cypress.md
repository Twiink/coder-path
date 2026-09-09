# Cypress 学习路线

Cypress 是为现代 Web 应用设计的**端到端(E2E)测试框架**,以"开发者友好"掀起前端测试体验革命:**它直接在浏览器里运行**(不像 Selenium 走外部驱动)、**命令自动等待**(告别 sleep 与 flaky)、**时间旅行调试**(每个命令的 DOM 快照可回放)、失败自动截图录像——写 E2E 第一次有了"写单元测试"的爽感。**适用与边界**:现代 Web 应用(React/Vue/Next 等)的 E2E 与组件测试;跨域 iframe、多标签页场景受限(单页面上下文);多浏览器(Chrome 系最稳,Firefox/WebKit 支持以官方版本为准)。**与 Playwright 同代竞争**(详见 [Selenium](/learning-paths/testing/selenium) 页的选型对照):Playwright 多浏览器与并行更强、支持多语言;Cypress 调试体验与前端生态更顺——**JS 栈团队两者皆可,本页讲 Cypress**。

这条线按 **核心特性与配置 → 选择器与断言 → 交互与网络拦截 → 登录与会话 → 组织与自定义命令 → CI 与调试 → 限制与选型** 推进。

## 第一站:核心特性与安装配置

**三个"游戏规则改变者"特性(先理解,后面全靠它们)**:①**自动等待与重试**:Cypress 的每个命令+断言都会**自动重试直到成功或超时**——"点按钮→断言弹窗出现"不用写任何等待代码(对比 Selenium 的显式等待,这是 flaky 大幅减少的根源);②**时间旅行**:命令日志里每个命令都有**当时的 DOM 快照**——悬停即回放,失败时能看到"哪一步开始不对";③**浏览器内运行 + 实时重载**:改测试自动重跑、DevTools 直接可用。
**安装**:`npm i -D cypress` → `npx cypress open`(交互模式:首次生成脚手架 + 可视跑测——**开发期用它**)/`npx cypress run`(无头模式——CI 用);目录:`cypress/e2e/`(测试)/`fixtures/`(mock 数据)/`support/`(自定义命令与全局配置);配置 cypress.config.js:**baseUrl**(测试里 `cy.visit('/login')` 不用写全 URL)、viewport(默认桌面尺寸——**响应式测试用 cy.viewport 切**)、defaultCommandTimeout(重试超时,默认 4s——慢接口可调)、视频与失败截图开关、env(环境变量);TypeScript 开箱即用。

## 第二站:选择器、查询与断言

**选择器**:`cy.get('[data-cy=submit]')`(CSS)/`cy.contains('提交')`(按文本——**断言文案时最直观**);**官方推荐:用 `data-cy`/`data-testid` 语义属性**——样式 class 与结构变化不影响测试(与 [Selenium](/learning-paths/testing/selenium) 章同理念,前端团队要在组件里埋好测试钩子);遍历链:.find(后代)/.parent/.closest(向上找容器)/.within(&#123; 范围限定 &#125;)/.siblings;`.eq(0)`(索引,少用)。
**断言(BDD 风格,核心心智)**:`.should('be.visible')`(可见)/`have.text`/`have.class`/`contain`/`have.length`——**断言会自动重试**:元素还没出现?等它;文本还没变?等它——**"期望最终状态"而非"立即状态",这就是不用写等待的原因**;链式 `.should('be.visible').and('contain', '成功')`;**断言元素不存在**:`should('not.exist')`(自动等到消失——比 sleep 优雅)。
**别名 .as()**:`cy.get('@loginBtn')` 或 `cy.intercept(...).as('getUsers')` 复用——测试里给关键元素/请求起名,可读性也更好。

## 第三站:交互、状态与网络拦截

**交互命令**(与 Selenium 相似但自带可点击等待):click/dblclick/rightclick/type(真实键盘输入,支持特殊键 &#123;enter&#125;)/clear/check(checkbox)/select(下拉);**交互后马上断言**——"点击→输入→断言结果"就是用户故事。**网络拦截(cy.intercept,E2E 的后端隔离利器)**:(cy.intercept('GET', '/api/users', &#123; fixture: 'users.json' &#125;))——**拦截请求并返回假数据**:测试不依赖后端在线、**边界情况随便造**(空列表/500 错误/慢响应(`req.reply` 延迟)——测 loading 与错误 UI);`cy.intercept(...).as('getUsers')` + `cy.wait('@getUsers')`(等请求发出并断言——**"点了按钮真的发了这个请求"的验证**);**cy.request(直接发 HTTP:两用**——API 测试(断言状态码/响应)与 **前置准备(直接调接口建数据/拿 token,绕过 UI——测试提速关键)**;fixture 加载测试数据(JSON 放 cypress/fixtures)。

## 第四站:登录与会话——E2E 提速的命门

**经典问题**:每个测试都走 UI 登录 = 又慢又脆(几十个测试每个多花 5 秒+登录页偶发失败)。**正解:cy.session()(Cypress 的会话缓存)**:在 `beforeEach` 里 `cy.session('user', () => &#123; UI 或 API 登录 &#125;)`——**首次真实登录,后续测试直接恢复会话,秒级进入业务页**(不同角色建不同 session:admin/user);**API 登录姿势**:`cy.request('POST', '/api/login', &#123;...&#125;)` 拿 token → localStorage/Cookie 注入;**凭证管理**:放 `cypress.env.json`(已在 .gitignore——**别把测试密码提交进仓库**);多用户/多角色测试按角色建 session 隔离。

## 第五站:组织、自定义命令与组件测试

**自定义命令(Cypress 的复用方式,对应 Selenium 的 Page Object 理念)**:`Cypress.Commands.add('login', (role) => &#123;...&#125;)` 写在 `support/commands.js`——**高频操作(登录/创建订单/填表单)封装成命令,测试体只写业务流**(团队约定:命令 = 动作,断言留在测试);hooks:beforeEach(重置状态:清 localStorage/拦截请求/建 session)/afterEach;**测试隔离**:每个测试独立数据、不依赖执行顺序、幂等可重复跑。**组件测试(可选但值得知道)**:Cypress 也能测单个组件(cy.mount)——**"组件交互的 E2E 式验证"(真实浏览器里点组件),与单元测试(RTL)互补**:单元测逻辑、组件测交互、E2E 测流程——三层金字塔的 Cypress 全家桶。

## 第六站:CI 与调试

**CI 集成(见 [GitHub Actions](/learning-paths/devops/github-actions))**:官方 `cypress-io/github-action`——自动装 Cypress、起应用(或等已部署环境)、跑 `cypress run`、**上传录像与截图产物**(失败证据给开发看——E2E 报告的灵魂);配置:baseUrl 指向测试环境、headless 模式、并行(按文件分片,Dashboard 或 cypress-parallel);录像开关(video: 本地关/CI 开,省时间省存储)。**调试体验(Cypress 的王牌)**:失败时**时间旅行**:点命令日志回放每一步 DOM——**"哪一步开始不对"一目了然**(对比 Selenium 只有截图);cy.pause()(手动步进)/cy.debug();DevTools 直连(Network 看请求/Console 看报错);**选择器自动生成**(Selector Playground:点页面元素生成 data-cy 建议);cy.log 标记测试节点。

## 第七站:稳定性最佳实践与选型

**稳定性清单(把 flaky 扼杀在习惯里)**:①选择器一律 data-cy(别 class/文本依赖样式);②**别用固定等待 `cy.wait(500)`**(反模式——Cypress 的自动重试就是为消灭它而生;等"元素/请求状态"而不是等时间);③拦截请求用别名 + wait(别裸等);④测试独立幂等(每测试自建数据/清状态);⑤慢接口调 defaultCommandTimeout 而不是加 sleep;⑥第三方错误选择性忽略(`cy.on('uncaught:exception')`——**别全局吞,会藏真 bug**);⑦**测试 = 用户故事,别测实现细节**(别断言"调用了某个函数",断言"界面变成什么样")。
**限制与选型**:Cypress 的边界(同源策略:跨域 iframe 内容难测、多标签页流程不支持、WebKit 支持实验性)——遇到这些场景看 **Playwright**(多浏览器/多标签/多语言更强);**纯前端 JS 栈、重调试体验 → Cypress;跨浏览器矩阵/多语言团队 → Playwright;跨语言老系统 → Selenium**;**金字塔提醒:E2E 贵而脆——关键路径(登录/下单/核心流程)10-20 条就够,大量逻辑交给单元与组件测试(见 [Jest](/learning-paths/testing/jest) 章)**。

## 通关标准

能独立做到:写出"访问→登录(cy.session)→操作→断言"的完整 E2E(全程无 sleep);用 data-cy 规划选择器并解释为什么不用 class;用 cy.intercept 造出"空数据/错误/慢响应"三种边界并断言对应 UI;把"API 登录+建数据"封装成自定义命令并让测试提速;在 CI 里跑通并拿到失败录像与截图;对一次 flaky 失败能定位是"选择器/等待/数据耦合"哪类问题——Cypress 主线通关。

Cypress 改变的不只是工具,是**写 E2E 的心态**:自动等待消灭了 flaky 的头号来源,时间旅行让调试从"猜"变"看",测试第一次可以像写产品代码一样愉悦。它教你的核心是"**测试要模拟用户,而不是模拟实现**"——用户看到什么、点什么、期望什么,测试就写什么;剩下的稳定性(等待、隔离、选择器),框架帮你扛了大半。**好测试的标准始终不变:给重构信心、给上线底气**。下一步:若需多浏览器矩阵可评估 Playwright(见 [Selenium](/learning-paths/testing/selenium) 的选型对照),或回 [Jest](/learning-paths/testing/jest) 补单元层。
