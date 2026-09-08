# React 学习路线

Facebook 出品的前端库（不是框架，虽然大家都这么叫），专注于构建用户界面。JSX、虚拟 DOM、单向数据流，这些概念都是 React 带火的。生态繁荣，工作机会多，学了不亏。

## 基础篇：核心概念

> 📖 篇笔记：[React 综合](/study-notes/react/react) · [React 基础知识](/study-notes/react/appendix-01-react-basics) · [React 扩展阅读](/study-notes/react/appendix-02-react-extra)

### JSX 语法
- JSX 是什么：JavaScript 的语法扩展
- 嵌入表达式：{ } 插值
- JSX 属性：className、htmlFor、style 对象
- 子元素：嵌套、数组、条件渲染
- Fragment：`<> </>` 或 `<React.Fragment>`
- JSX 本质：React.createElement 的语法糖

### 组件基础
- 函数组件：现代 React 的主流
- 类组件：legacy 写法（了解即可）
- 组件命名：大写开头
- Props：组件参数、只读、解构
- 组件组合：children prop
- 条件渲染：if、三元、&&
- 列表渲染：map、key 的重要性
- 📖 笔记：[React 与 Vue 生命周期对比](/study-notes/react/react-vue-lifecycle)

### State 状态管理
- useState Hook：声明状态、更新状态
- 状态不可变性：不直接修改 state
- 多个状态变量：独立管理
- 对象状态：展开运算符更新
- 数组状态：filter、map、concat 代替 push、splice
- 状态提升：共享状态移至父组件

### 事件处理
- 事件命名：驼峰式（onClick、onChange）
- 事件处理函数：传递函数引用
- 事件对象：合成事件 SyntheticEvent
- 阻止默认行为：preventDefault
- 事件参数传递：箭头函数、bind
- 表单处理：受控组件、非受控组件

## 进阶篇：Hooks 深入

### 常用 Hooks
- useState：状态管理
- useEffect：副作用、生命周期模拟
- useContext：跨组件传递数据
- useRef：访问 DOM、保存可变值
- useMemo：计算缓存、性能优化
- useCallback：函数缓存、避免重新创建
- useReducer：复杂状态逻辑
- useLayoutEffect：同步副作用
- useImperativeHandle：暴露实例方法给父组件
- useDebugValue：自定义 Hook 调试
- 📖 笔记：[React Hook 简介](/study-notes/react/01-hooks-intro)
- 📖 笔记：[useState 基础用法](/study-notes/react/02-use-state-basics)
- 📖 笔记：[useState 高级用法](/study-notes/react/03-use-state-advanced)
- 📖 笔记：[useReducer 基础用法](/study-notes/react/08-use-reducer-basics)
- 📖 笔记：[useReducer 高级用法](/study-notes/react/09-use-reducer-advanced)
- 📖 笔记：[useCallback 基础用法](/study-notes/react/10-use-callback-basics)
- 📖 笔记：[useMemo 基础用法](/study-notes/react/11-use-memo-basics)
- 📖 笔记：[useRef 基础用法](/study-notes/react/12-use-ref-basics)
- 📖 笔记：[useImperativeHandle 基础用法](/study-notes/react/13-use-imperative-handle-basics)
- 📖 笔记：[useLayoutEffect 基础用法](/study-notes/react/14-use-layout-effect-basics)
- 📖 笔记：[useDebugValue 基础用法](/study-notes/react/15-use-debug-value-basics)
- 📖 笔记：[React Hook 总结](/study-notes/react/17-hooks-summary)
- 📖 笔记：[React 使用 ECharts 的 Hooks 示例](/study-notes/react/18-echarts-hooks-example)

### Hooks 实现原理
- Fiber 节点与 Hook 链表
- Hook 存储位置：memoizedState
- 首次渲染 vs 更新渲染
- useState 的状态更新队列
- useEffect 的副作用链表
- 依赖比较：Object.is 浅比较
- Hook 调用顺序的重要性
- 闭包陷阱与解决方案

### useEffect 详解
- 副作用的概念：数据获取、订阅、手动 DOM 操作
- 依赖数组：[]、[dep]、省略的区别
- 清理函数：return 函数、取消订阅、清除定时器
- 执行时机：渲染后异步执行
- 无限循环陷阱：依赖数组不当
- 多个 useEffect：关注点分离
- 📖 笔记：[useEffect 基础用法](/study-notes/react/04-use-effect-basics)
- 📖 笔记：[useEffect 高级用法](/study-notes/react/05-use-effect-advanced)

### 自定义 Hooks
- 命名规范：use 开头
- 逻辑复用：提取公共逻辑
- 状态共享：每次调用独立
- 常见自定义 Hook：useLocalStorage、useFetch、useDebounce、useWindowSize
- Hooks 组合：复用其他 Hooks
- 📖 笔记：[自定义 Hook](/study-notes/react/16-custom-hooks)

### Hooks 规则
- 只在顶层调用：不在循环、条件、嵌套函数中
- 只在 React 函数中调用：函数组件、自定义 Hook
- ESLint 插件：eslint-plugin-react-hooks

## 进阶篇：状态管理

### Context API
- createContext：创建上下文
- Provider：提供值
- useContext：消费值
- 避免不必要的重渲染：拆分 Context、useMemo
- Context 的局限：跨层级传递，非全局状态管理
- 📖 笔记：[useContext 基础用法](/study-notes/react/06-use-context-basics)
- 📖 笔记：[useContext 高级用法](/study-notes/react/07-use-context-advanced)

### Context 深入原理
- Context 值变化触发重渲染
- Provider 的 value 引用比较
- Context 嵌套与优先级
- 多个 Context 的性能影响
- Context 与组件树的订阅关系

### 状态管理库
- Redux：单一数据源、action、reducer、store
- Redux Toolkit：简化 Redux、createSlice、configureStore
- Zustand：轻量级、简洁 API
- Jotai：原子化状态管理
- Recoil：Facebook 出品、原子化
- MobX：响应式、装饰器
- Valtio：代理模式

### 选择状态管理方案
- 本地状态：useState、useReducer
- 跨组件状态：Context、状态提升
- 全局状态：Redux、Zustand
- 服务端状态：React Query、SWR

## 进阶篇：性能优化

### 渲染优化
- React.memo：组件缓存、避免重复渲染
- useMemo：计算结果缓存
- useCallback：函数缓存
- key 的正确使用：稳定唯一标识
- 虚拟化：react-window、react-virtualized
- 懒加载：React.lazy、Suspense

### React 渲染机制深入
- 协调（Reconciliation）算法
- Diff 算法：单节点、多节点
- 双缓冲 Fiber 树：current 与 workInProgress
- 渲染阶段（Render Phase）：可中断
- 提交阶段（Commit Phase）：不可中断
- 批量更新（Batching）：自动批处理
- 并发特性：useTransition、useDeferredValue
- Suspense 与流式 SSR

### 代码分割
- 动态 import()：按需加载
- React.lazy：懒加载组件
- Suspense：加载状态
- 路由级代码分割：react-router + lazy

### 性能分析
- React DevTools Profiler：组件渲染时间
- Chrome Performance：浏览器性能分析
- why-did-you-render：找出不必要的渲染
- 避免内联对象和函数：稳定引用

## 核心篇：Fiber 架构

### Fiber 基础
- Fiber 是什么：虚拟 DOM 的重新实现
- Fiber 节点结构：type、key、props、stateNode
- Fiber 树的双缓冲机制
- 工作单元（Unit of Work）概念
- 链表结构：child、sibling、return

### Fiber 调度器
- 优先级系统：Lane 模型
- 时间切片（Time Slicing）
- 可中断渲染：requestIdleCallback 思想
- Scheduler 调度器：任务队列管理
- 饥饿问题与过期时间
- 高优先级任务插队机制

### Fiber 工作流程
- beginWork：递阶段处理
- completeWork：归阶段处理
- commitWork：提交 DOM 变更
- 副作用链表（Effect List）
- Hooks 在 Fiber 中的存储
- 状态更新的完整流程

## 核心篇：React 18 新特性

### 并发渲染
- Concurrent Mode 概念
- 自动批处理：ReactDOM.createRoot
- startTransition：标记非紧急更新
- useTransition：过渡状态
- useDeferredValue：延迟更新值
- 并发渲染的中断与恢复
- 📖 笔记：[useTransition 基础用法](/study-notes/react/19-use-transition-basics)

### Suspense 增强
- Suspense 边界：加载状态管理
- React.lazy：代码分割
- Suspense 与数据获取
- 流式 SSR：服务端 Suspense
- Selective Hydration：选择性水合

### 其他新特性
- useId：生成唯一 ID
- useSyncExternalStore：外部状态同步
- useInsertionEffect：CSS-in-JS 优化
- Error Boundaries 改进
- Strict Mode 的双重调用

## 进阶篇：路由与导航

### React Router
- BrowserRouter：HTML5 History API
- Routes、Route：路由配置
- Link、NavLink：导航链接
- useNavigate：编程式导航
- useParams：获取路由参数
- useLocation：获取当前位置
- useSearchParams：查询参数
- 嵌套路由：Outlet
- 路由守卫：Loader、Action
- 懒加载路由：lazy + Suspense

## 进阶篇：数据获取

### 传统方式
- useEffect + fetch：手动管理
- async/await：异步处理
- 加载状态：loading、error、data
- 取消请求：AbortController

### React Query
- useQuery：数据查询、自动缓存、重新验证
- useMutation：数据变更
- 缓存策略：staleTime、cacheTime
- 自动重试、轮询、分页
- 📖 笔记：[React Query vs API Cancel](/study-notes/react/react-query-api-cancellation)

### SWR
- useSWR：stale-while-revalidate 策略
- 自动重新验证：聚焦、重连、轮询
- 乐观更新
- 分页、无限加载

## 实战篇：表单处理

### 受控组件
- input、textarea、select：value + onChange
- 表单状态管理：多个输入、对象状态
- 表单验证：实时验证、提交验证

### 表单库
- React Hook Form：性能优、非受控
- Formik：受控、功能全
- 验证库集成：Yup、Zod

## 核心篇：React 错误处理

### Error Boundaries
- componentDidCatch：捕获错误
- static getDerivedStateFromError
- 错误边界的限制：事件、异步、SSR
- 错误边界的粒度设计
- 错误上报与监控
- React 18 中的改进

### Portals 与特殊场景
- ReactDOM.createPortal：渲染到其他 DOM
- Modal、Tooltip 等场景
- Portal 中的事件冒泡
- Portal 与 Context
- 多个 Portal 的管理

## 实战篇：样式方案

### CSS 方案
- CSS Modules：局部作用域
- CSS-in-JS：styled-components、Emotion
- Utility-First：Tailwind CSS
- 原子化 CSS：UnoCSS
- 传统 CSS：配合 BEM 命名

### UI 组件库
- Ant Design：企业级
- Material-UI（MUI）：Material Design
- Chakra UI：可访问性优先
- shadcn/ui：组件源码复制
- Radix UI：无样式、可访问

## 实战篇：TypeScript 集成

### 组件类型
- 函数组件：React.FC 或普通函数
- Props 接口：interface Props
- 泛型组件：`<T>` 类型参数
- children 类型：React.ReactNode

### Hooks 类型
- `useState<T>`：泛型状态
- `useRef<T>`：泛型引用
- 事件类型：React.MouseEvent、React.ChangeEvent
- 自定义 Hook 类型：明确返回值

## 实战篇：测试

### 测试工具
- Jest：测试框架
- React Testing Library：组件测试
- Vitest：Vite 原生支持

### 测试策略
- 单元测试：纯函数、Hooks
- 组件测试：渲染、交互、断言
- 集成测试：多个组件协作
- E2E 测试：Playwright、Cypress

## 源码篇：React 源码分析

### 源码结构
- packages 目录结构
- react 包：核心 API
- react-dom 包：渲染器
- react-reconciler 包：协调器
- scheduler 包：调度器
- shared 包：公共工具

### 关键模块解析
- ReactElement 创建流程
- JSX 转换原理
- createElement 实现
- Fiber 节点的创建与更新
- Hooks 链表的实现细节
- 优先级调度算法
- 事件系统：合成事件机制
- Diff 算法源码解读

## 下一步学习

掌握 React 后，可以继续探索：

- **Next.js** - 全栈 React 开发、SSR、SSG
- **React Native** - 移动端开发
- **Remix** - 另一个 React 全栈框架
- **React Server Components** - React 的未来
- **状态机** - XState

React 生态庞大，但核心概念不多。掌握 Hooks、组件通信、状态管理，就能应对大部分场景。记住：React 只是 View 层，其他部分（路由、状态管理、数据获取）需要自己选择。灵活是优点，也是学习成本的来源。
