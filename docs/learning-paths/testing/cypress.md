# Cypress 学习路线

Cypress 是为现代 Web 应用设计的端到端测试框架，以"开发者友好"著称。它直接运行在浏览器中，无需 Selenium，测试执行快、调试体验好、API 简洁。内置等待机制、时间旅行调试、自动截图录像，让前端测试变得优雅。如果你厌倦了 Selenium 的不稳定，Cypress 会是你的新宠。

## 基础篇：入门与配置

### Cypress 特点
- 浏览器内运行：直接访问 DOM、Window、Network
- 自动等待：无需手动写等待逻辑
- 时间旅行：快照每个命令的执行状态
- 实时重载：代码变化自动重跑
- 视频录制：失败自动录像
- 截图功能：命令级别截图
- 调试友好：Chrome DevTools 集成

### 安装与初始化
- npm install cypress --save-dev
- 初始化：npx cypress open
- 项目结构：cypress/ 目录（e2e、fixtures、support）
- 配置文件：cypress.config.js
- TypeScript 支持：开箱即用

### 第一个测试
- 测试文件：cypress/e2e/*.cy.js
- describe 和 it：测试组织
- cy.visit()：访问页面
- cy.get()：查找元素
- 断言：should()
- 运行测试：GUI 模式、Headless 模式

### 配置详解
- baseUrl：基础 URL，简化测试代码
- viewportWidth/Height：视口大小
- defaultCommandTimeout：命令超时时间
- requestTimeout：请求超时
- video：视频录制开关
- screenshotOnRunFailure：失败截图
- env：环境变量

## 基础篇：选择器与查询

### 基础选择器
- cy.get()：CSS 选择器
- cy.contains()：文本内容匹配
- ID：#username
- Class：.btn-primary
- 属性：[data-test="login-btn"]
- 组合：button.submit

### 推荐实践
- data-* 属性：data-testid、data-cy
- 避免 class/id：样式变化影响测试
- 避免标签名：重构影响测试
- 语义化属性：更稳定、可读性强

### 遍历查询
- .find()：后代查询
- .children()：子元素
- .parent()：父元素
- .siblings()：兄弟元素
- .prev()、.next()：相邻元素
- .first()、.last()：首尾元素
- .eq()：索引访问

### 过滤查询
- .filter()：过滤匹配
- .not()：排除元素
- .within()：范围限定

## 基础篇：命令与交互

### 操作命令
- .click()：点击元素
- .dblclick()：双击
- .rightclick()：右键
- .type()：输入文本
- .clear()：清空输入
- .check()、.uncheck()：复选框
- .select()：下拉框

### 断言命令
- .should()：断言
- 链式断言：多个条件
- 常用断言：exist、visible、contain、have.class
- BDD 风格：be.visible、have.text
- 隐式断言：自动重试直到成功或超时

### 别名与引用
- .as()：给元素或请求起别名
- cy.get('@alias')：通过别名引用
- this.alias：在回调中访问（需要 function）
- 适用场景：复用查询结果

### 条件与循环
- .then()：访问元素
- .each()：遍历元素
- .its()：获取属性
- .invoke()：调用方法
- Cypress 不支持 if：用 .then() 处理条件逻辑

## 进阶篇：网络请求

### 拦截请求
- cy.intercept()：拦截 HTTP 请求
- 匹配规则：URL、Method、Headers
- 修改请求：req.body、req.headers
- 修改响应：res.body、res.statusCode
- 延迟响应：req.reply({ delay: 1000 })

### Mock 数据
- fixture：cy.fixture('users.json')
- 返回 Mock 数据：req.reply(fixture)
- 动态 Mock：根据请求参数返回不同数据
- 适用场景：隔离后端、测试边界情况

### 等待请求
- cy.wait('@alias')：等待请求完成
- 验证请求：断言 URL、Body
- 验证响应：断言状态码、数据
- 超时设置：requestTimeout

### 真实请求
- cy.request()：发起 HTTP 请求
- 用途：API 测试、前置数据准备
- 不受浏览器限制：跨域、Cookie
- 响应断言：status、body、headers

## 进阶篇：高级特性

### Cookie 管理
- cy.getCookie()：获取单个 Cookie
- cy.getCookies()：获取所有 Cookie
- cy.setCookie()：设置 Cookie
- cy.clearCookie()、cy.clearCookies()：清除
- 保留 Cookie：Cypress.Cookies.preserveOnce()

### Local/Session Storage
- cy.window()：访问 window 对象
- .then(win => win.localStorage)
- 读写操作：getItem、setItem
- 清空：clear()

### 自定义命令
- Cypress.Commands.add()：添加自定义命令
- 命令参数：传递参数
- 链式命令：支持 .should()
- 覆盖命令：Cypress.Commands.overwrite()
- 定义位置：cypress/support/commands.js

### Viewport 控制
- cy.viewport()：设置视口大小
- 预设：iphone-6、ipad-2、macbook-15
- 自定义：宽度、高度
- 响应式测试：不同设备尺寸

### 时间旅行
- 命令快照：每个命令的 DOM 状态
- 悬停查看：时间线上的命令
- 调试利器：回到过去状态
- 命令日志：点击跳转到执行时刻

## 进阶篇：Hooks 与组织

### 测试钩子
- before()：所有测试前运行一次
- after()：所有测试后运行一次
- beforeEach()：每个测试前运行
- afterEach()：每个测试后运行
- 作用域：describe 块内或全局

### 测试组织
- describe()：测试套件
- context()：describe 的别名，更语义化
- it()：单个测试
- 嵌套 describe：层级结构
- .only()：只运行指定测试
- .skip()：跳过测试

### 夹具数据
- cy.fixture()：加载测试数据
- JSON、CSV、图片：多格式支持
- 在 before 中加载：共享数据
- 别名引用：避免重复加载

### 插件系统
- cypress.config.js：on() 事件
- 任务：cy.task() 执行 Node.js 代码
- 用途：数据库操作、文件系统、第三方 API
- 安全沙箱：隔离浏览器和 Node

## 实战篇：登录与认证

### 登录策略
- UI 登录：每个测试都登录（慢）
- API 登录：cy.request() 获取 Token（快）
- Session 复用：beforeEach 中恢复 Session
- cy.session()：Cypress 12+ 的会话管理

### Token 管理
- 存储 Token：localStorage、Cookie
- 请求头注入：cy.intercept() 添加 Authorization
- 环境变量：cypress.env.json 存储凭证
- 安全性：不提交敏感信息到 Git

### 多用户测试
- 不同角色：管理员、普通用户
- 切换用户：退出再登录或清空 Session
- 并行测试：隔离会话

## 实战篇：框架集成

### React 集成
- @cypress/react：组件测试
- 挂载组件：cy.mount()
- Props 传递：测试不同状态
- 事件触发：用户交互
- 隔离测试：无需启动整个应用

### Vue 集成
- @cypress/vue：组件测试
- 挂载语法：类似 React
- Vuex：状态管理测试
- Router：路由测试

### Angular 集成
- @cypress/angular：组件测试
- 服务注入：Mock 依赖
- 指令测试：自定义指令

### Next.js/Nuxt.js
- 全栈测试：前后端一体
- API Routes：cy.request() 测试
- SSR：服务端渲染测试

## 实战篇：CI/CD 集成

### GitHub Actions
- Cypress GitHub Action：官方 Action
- 并行执行：矩阵策略
- 缓存：node_modules、Cypress 二进制
- 录像上传：Artifacts
- Cypress Dashboard：测试报告托管

### Docker 集成
- Cypress Docker 镜像：cypress/included
- 无头模式：适合 CI
- 视频录制：自动保存
- 体积优化：选择合适的镜像

### 报告生成
- Mochawesome：美观的 HTML 报告
- cypress-mochawesome-reporter：集成插件
- JUnit：CI 集成
- Allure：企业级报告

### 并行执行
- Cypress Dashboard：官方并行方案（付费）
- cypress-parallel：开源并行插件
- 分组策略：按文件、标签
- 负载均衡：智能分配测试

## 实战篇：调试技巧

### 调试命令
- cy.debug()：暂停执行，打开 DevTools
- cy.pause()：暂停测试，手动继续
- .debug()：链式调试
- debugger：JavaScript 断点

### 日志输出
- cy.log()：测试日志
- console.log：浏览器控制台
- 命令日志：自动记录所有命令
- 网络日志：查看请求响应

### 截图录像
- cy.screenshot()：手动截图
- 失败自动截图：screenshotOnRunFailure
- 视频录制：video 配置
- 保存位置：cypress/screenshots、cypress/videos

### Chrome DevTools
- 实时检查：元素、网络、控制台
- 断点调试：Source 面板
- 性能分析：Performance 面板
- 移动端模拟：Device Toolbar

## 实战篇：最佳实践

### 选择器策略
- data-* 优先：稳定性高
- 避免脆弱选择器：动态 class、nth-child
- 页面对象模式：封装选择器
- 别名复用：减少重复查询

### 等待策略
- 自动等待：Cypress 自动重试
- 显式等待：cy.wait('@request')
- 超时配置：针对慢接口调整
- 避免固定等待：cy.wait(5000) 是反模式

### 测试隔离
- 独立性：每个测试独立运行
- 数据清理：beforeEach 重置状态
- 避免依赖：不依赖测试顺序
- 幂等性：多次运行结果一致

### 性能优化
- 减少 UI 登录：用 cy.session()
- 并行执行：多机器分担
- 选择性运行：只跑相关测试
- 禁用视频：本地开发关闭录像

### 错误处理
- 失败重试：cypress-plugin-retries
- 异常捕获：cy.on('uncaught:exception')
- 日志记录：便于排查问题
- 截图调试：失败时留证据

## 实战篇：组件测试

### 组件测试 vs E2E
- 组件测试：隔离单个组件
- E2E 测试：完整用户流程
- 速度对比：组件测试更快
- 覆盖范围：E2E 更全面

### 挂载与配置
- cy.mount()：挂载组件
- Props：传递输入数据
- Slots：插槽内容
- Providers：上下文提供者

### 交互测试
- 用户事件：点击、输入
- 状态变化：断言更新
- 事件触发：验证回调
- 边界情况：异常输入

### Mock 依赖
- API：cy.intercept()
- Store：Mock Vuex/Redux
- Router：Mock 路由
- 环境隔离：无副作用

## 下一步学习

掌握 Cypress 后，可以探索更多前端测试领域：

- **Playwright** - 微软出品，支持更多浏览器
- **Testing Library** - 更贴近用户行为的测试
- **Storybook** - 组件开发与测试
- **Vitest** - Vite 原生单元测试框架
- **WebdriverIO** - 另一个强大的自动化框架
- **Puppeteer** - Chrome 官方自动化库

Cypress 是前端测试的游戏规则改变者。它不是 Selenium 的竞品，而是新一代的测试工具。自动等待让你告别 flaky tests，时间旅行让调试变得直观，API 简洁让代码优雅。当然，Cypress 也有限制：只支持 Chrome 系浏览器、不能跨域、不能操作多标签页，但对于绝大多数现代 Web 应用，这些都不是问题。记住，好的测试不是为了覆盖率，而是为了信心。有了 Cypress，你会爱上写测试。
