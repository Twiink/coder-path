# Jest 学习路线

Jest 是 Facebook 开发的 JavaScript 测试框架，以"零配置"和"开箱即用"著称。它内置断言库、Mock 功能、覆盖率报告，支持快照测试和并行执行，是 React 和 Node.js 项目的首选测试工具。测试不是负担，而是让你写代码更有底气的保险。

## 基础篇：入门与配置

### 安装与初始化
- 安装方式：npm、yarn、pnpm
- 快速初始化：jest --init
- package.json 配置：scripts 中添加 test 命令
- 基本配置文件：jest.config.js、jest.config.json
- 项目集成：与 TypeScript、Babel、Webpack 整合

### 第一个测试
- 测试文件命名：*.test.js、*.spec.js、__tests__ 目录
- 基本结构：test()、it()、describe()
- 运行测试：npm test、jest、jest --watch
- 测试输出：通过、失败、跳过
- 测试覆盖率：--coverage 参数

### 配置项详解
- testMatch：测试文件匹配规则
- testEnvironment：node、jsdom（浏览器环境模拟）
- roots：测试根目录
- moduleNameMapper：模块路径映射
- transform：代码转换器（如 babel-jest）
- setupFiles：测试前运行的脚本
- collectCoverageFrom：覆盖率收集范围

## 基础篇：断言与匹配器

### 基础匹配器
- toBe：严格相等（===）
- toEqual：深度相等（对象、数组）
- toBeTruthy、toBeFalsy：真假值判断
- toBeNull、toBeUndefined、toBeDefined
- toBeNaN：判断 NaN
- not：取反断言

### 数值匹配器
- toBeGreaterThan、toBeLessThan：大于、小于
- toBeGreaterThanOrEqual、toBeLessThanOrEqual：大于等于、小于等于
- toBeCloseTo：浮点数比较（避免精度问题）

### 字符串匹配器
- toMatch：正则表达式匹配
- toContain：包含子串
- toHaveLength：长度判断
- stringMatching：字符串匹配器
- stringContaining：包含字符串

### 数组与对象匹配器
- toContain：数组包含元素
- toContainEqual：数组包含对象
- toHaveProperty：对象包含属性
- toMatchObject：对象部分匹配
- arrayContaining：数组部分匹配
- objectContaining：对象部分匹配

### 异常匹配器
- toThrow：抛出异常
- toThrowError：抛出特定错误
- toThrowErrorMatchingSnapshot：错误快照匹配

## 进阶篇：Mock 与模拟

### Mock 函数基础
- jest.fn()：创建 Mock 函数
- mockReturnValue：设置返回值
- mockReturnValueOnce：单次返回值
- mockResolvedValue：Promise 成功值
- mockRejectedValue：Promise 失败值
- mockImplementation：自定义实现
- mockImplementationOnce：单次实现

### Mock 函数断言
- toHaveBeenCalled：是否被调用
- toHaveBeenCalledTimes：调用次数
- toHaveBeenCalledWith：调用参数
- toHaveBeenLastCalledWith：最后一次调用参数
- toHaveBeenNthCalledWith：第 N 次调用参数
- mock.calls：所有调用记录
- mock.results：所有返回值记录

### 模块 Mock
- jest.mock()：自动 Mock 整个模块
- 手动 Mock：__mocks__ 目录
- mockReturnValue：模拟模块导出
- require.requireActual：获取真实模块
- 部分 Mock：只 Mock 部分导出

### 定时器 Mock
- jest.useFakeTimers：启用假定时器
- jest.useRealTimers：恢复真实定时器
- jest.advanceTimersByTime：快进时间
- jest.runAllTimers：运行所有定时器
- jest.runOnlyPendingTimers：只运行待处理定时器
- jest.clearAllTimers：清除所有定时器

### 其他 Mock
- jest.spyOn：监听对象方法
- mockClear：清除调用记录
- mockReset：清除并重置 Mock
- mockRestore：恢复原始实现
- jest.clearAllMocks：清除所有 Mock

## 进阶篇：异步测试

### 回调测试
- done 回调：测试完成标志
- 错误处理：done.fail()
- 超时设置：jest.setTimeout()

### Promise 测试
- 返回 Promise：测试自动等待
- resolves 匹配器：expect().resolves.toBe()
- rejects 匹配器：expect().rejects.toThrow()
- then/catch 链式调用

### async/await 测试
- async 测试函数：更清晰的异步代码
- await expect()：等待断言
- try/catch：错误处理
- 并发测试：Promise.all

## 进阶篇：快照测试

### 快照基础
- toMatchSnapshot：生成快照
- 快照文件：__snapshots__ 目录
- 更新快照：jest -u、--updateSnapshot
- 查看差异：彩色输出
- 快照最佳实践：小而专注

### 行内快照
- toMatchInlineSnapshot：快照内联在测试中
- 自动更新：Prettier 格式化
- 适用场景：小型快照

### 自定义快照序列化器
- 自定义对象序列化
- 忽略动态属性：日期、ID
- expect.addSnapshotSerializer：注册序列化器

## 实战篇：测试技巧

### 测试生命周期
- beforeAll：所有测试前运行一次
- afterAll：所有测试后运行一次
- beforeEach：每个测试前运行
- afterEach：每个测试后运行
- 作用域：全局、describe 块内

### 测试组织
- describe：测试套件分组
- 嵌套 describe：层级结构
- test.only：只运行指定测试
- test.skip：跳过测试
- test.todo：标记待完成测试
- test.each：参数化测试（表格驱动）

### 覆盖率报告
- 覆盖率指标：行覆盖、分支覆盖、函数覆盖、语句覆盖
- 报告格式：text、html、lcov、json
- 阈值设置：coverageThreshold
- 忽略文件：collectCoverageFrom 排除规则
- 查看报告：coverage/lcov-report/index.html

### 监视模式
- jest --watch：监听文件变化
- 交互式命令：a（全部）、f（失败）、p（文件名）、t（测试名）
- 性能优化：只运行相关测试
- 持续反馈：开发时实时测试

## 实战篇：特定场景测试

### DOM 测试
- jsdom 环境：模拟浏览器
- document、window 对象：全局可用
- DOM 操作测试：createElement、querySelector
- 事件测试：dispatchEvent、addEventListener
- Testing Library：@testing-library/dom、@testing-library/react

### React 测试
- 渲染组件：render()
- 查询元素：getByText、getByRole、queryBy、findBy
- 用户交互：fireEvent、userEvent
- 状态更新：waitFor、act()
- 快照测试：组件输出快照

### Node.js 测试
- 文件系统：fs 模拟
- 环境变量：process.env Mock
- 网络请求：axios、fetch Mock
- 数据库：Mock 数据库连接
- CLI 工具：命令行参数测试

### API 测试
- HTTP 请求 Mock：axios-mock-adapter、msw
- 响应模拟：成功、失败、超时
- 状态码验证
- 响应数据断言
- 错误处理测试

## 实战篇：高级特性

### 并行与隔离
- 并行执行：maxWorkers 配置
- 测试隔离：每个测试独立环境
- 沙箱机制：require.cache 清除
- 性能优化：合理划分测试文件

### 全局设置
- setupFilesAfterEnv：测试框架初始化后运行
- globalSetup：所有测试前运行一次（如启动数据库）
- globalTeardown：所有测试后清理
- 自定义匹配器：expect.extend()

### ESM 支持
- 实验性 ESM：--experimental-vm-modules
- package.json type: "module"
- 配置调整：transform、extensionsToTreatAsEsm
- 兼容性问题

### TypeScript 集成
- ts-jest：TypeScript 转换器
- 类型检查：isolatedModules
- 配置：jest.config.ts
- 类型安全的 Mock：jest.mocked()

## 实战篇：性能与调试

### 性能优化
- 测试文件大小：拆分大文件
- Mock 策略：减少不必要的 Mock
- 并行配置：maxWorkers 调优
- 缓存：transformIgnorePatterns
- 忽略不必要的文件：testPathIgnorePatterns

### 调试技巧
- node --inspect-brk：启动调试器
- VSCode 集成：launch.json 配置
- Chrome DevTools：调试测试
- console.log：简单输出调试
- 单测试运行：test.only

### CI/CD 集成
- GitHub Actions：运行测试、上传覆盖率
- 并行构建：矩阵策略
- 失败重试：jest-circus
- 报告输出：junit、json 格式
- 覆盖率徽章：Codecov、Coveralls

## 下一步学习

掌握 Jest 后，可以探索更多测试领域：

- **Testing Library** - 更好的 DOM 和 React 测试工具
- **Cypress** - E2E 测试框架
- **Playwright** - 现代浏览器自动化
- **Vitest** - Vite 原生的测试框架（Jest 兼容）
- **Storybook** - 组件隔离开发与测试
- **MSW** - Mock Service Worker，API Mock 神器

Jest 让测试变得简单，但写好测试需要思考。不要为了覆盖率而测试，要为了信心而测试。测试金字塔告诉我们：单元测试最多、集成测试次之、E2E 测试最少。记住，测试不是为了找 Bug，而是为了防止 Bug。有了 Jest，你会睡得更香。
