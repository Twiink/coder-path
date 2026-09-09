# React 学习路线

React 是 Facebook(现 Meta)出品的界面库——注意是"库"不是"框架",虽然大家都这么叫它。它只负责一件事:把数据变成界面,并让界面跟着数据自动更新。JSX、虚拟 DOM、单向数据流、Hooks、并发渲染,这些如今前端圈的口头禅,大半都是它带火的。生态庞大、岗位众多、学了不亏——但它的学习曲线不在"写出来",而在"想明白":为什么 setState 是异步的、为什么 key 不能乱给、为什么 Hooks 不能写在条件里。

这条线按 **JSX 与组件 → State 与事件 → Hooks 全家桶 → 状态管理 → 数据获取 → 路由与表单 → 样式与动画 → 渲染原理与性能 → 健壮性与老代码 → 测试与类型 → 源码与生态** 推进,知识点尽量一次铺全:常用的要顺手,不常用的要见过——它们散落在老代码、面试题和源码里等你。

## 第一站:JSX 与组件——React 的基本粒子

先破除迷信:**JSX 不是模板语言,是 JavaScript 的语法糖**——它会被编译成 `React.createElement` 调用(新编译器是 react-compiler 之前的 babel 插件 `@babel/preset-react`;React 19 开始推荐直接用 react 包的新 JSX 转换)。所以 JSX 里能写任何 JS 表达式,用 `{}` 插值;支持的条件渲染有 `if`/三元/`&&`——注意 `&&` 左边是 0 或 NaN 时会真的渲染出 0(常见 bug,要转成 Boolean 或比较式);列表渲染用 `map` 且**每个子项必须有稳定的 key**,key 是 React 的"身份指纹",在兄弟间唯一即可、不需要全局唯一;用数组下标当 key 在列表增删/排序时会张冠李戴(输入框内容串行),这是新手第一大坑。

JSX 细节清单:属性名走驼峰(`className` 而非 class、`htmlFor` 而非 for、`tabIndex`、`strokeWidth`),`style` 要传对象(驼峰键 + 数字自动加 px,带单位的属性除外),`<></>` Fragment 用来包兄弟节点(**简写不能带 key**,要 key 得写全 `<Fragment key>`),布尔属性写法(`disabled={true}` 可直接 `disabled`)、props 展开 `{...props}` 批量传参、注释写法 `{/* */}`、`null`/`undefined`/`false` 不渲染任何东西(条件渲染的原理)。图片要用 `import` 或放在 public 目录再引路径,别直接写相对路径。

**组件**是 React 的世界观:函数组件是现代主流(纯函数:同 props 必同输出,不修改外部状态——React 靠这个假设做性能优化,StrictMode 下还会故意双调用函数帮你发现不纯);类组件是历史遗产(老项目仍在,见第九站)。规则:组件名大写开头(小写被当成原生标签)、一个组件只做一件事、**组合优于继承**——`children` prop 和"插槽"模式(传 prop 一个 ReactNode)实现布局复用。React 运行时全家:react 包(核心 API)、react-dom 包(`createRoot(...).render()` 挂载;`hydrateRoot` 是 SSR 水合入口;React Native 用的是 react-native 渲染器——"一次学习,处处编写"靠的就是 renderer 可替换架构)。

## 第二站:State 与事件——让界面活过来

**useState** 是组件的"记忆":`const [count, setCount] = useState(0)`。四条铁律:

1. **不可直接修改 state**,必须走 setter——对象/数组更新要创建新引用(展开运算符、`filter`/`map`/`concat`,别 push/splice);
2. **更新是异步且批处理的**:同一事件里的多次 setState 会合并(React 18 全自动批处理,包括 setTimeout/Promise 里);想立刻基于最新值更新就用**函数式更新** `setCount(prev => prev + 1)`(连续加三次的正确写法);
3. **状态初始化可以传函数** `useState(() => expensive())`,惰性计算只跑一次;
4. **状态提升**:兄弟组件共享的数据提到共同父组件,props 下发值与更新函数;反过来也有"状态下放",把大 state 拆到真正用它的子组件减少重渲染。

**事件系统**:事件名驼峰(`onClick`),绑定的是函数引用(`onClick={handle}` 不是 `onClick={handle()}`);事件对象是 **SyntheticEvent 合成事件**(React 17 起事件挂载到 root 容器而非 document,19 移除事件池化,`e.persist()` 是古董 API);传参用箭头函数或 bind;`onMouseEnter`/`onMouseLeave` 特殊(不冒泡但 React 模拟了进出子元素的行为);`onChange` 语义与 DOM 不同(每次输入都触发,input 的 onChange 是 React 重写的,对应原生 input 事件)。**受控组件**(value 绑 state + onChange 更新,React 是唯一数据源)与**非受控组件**(`defaultValue` + ref 读 DOM,偶尔用于性能/第三方集成)要分清:受控是默认姿势;`select` 的受控写法是 value 不是 selected;checkbox 用 `checked`。

## 第三站:Hooks 全家桶——函数组件的瑞士军刀

Hooks 是 React 16.8 的范式革命,逐个认识并记一句话场景:

- **useState**:本地状态,见上。
- **useEffect**:副作用出口(数据获取、订阅、手动 DOM)。依赖数组是灵魂:`[]` 挂载后一次、`[dep]` 依赖变化才跑、省略每次渲染都跑;返回清理函数善后(取消订阅/定时器);执行时机在浏览器绘制之后(`useLayoutEffect` 在绘制前同步跑,测量 DOM 用它);依赖写不对 = 无限循环;闭包陷阱:依赖数组没列全时 effect 里读到旧值。
- **useRef**:两个用途——拿 DOM(配 ref 属性)与存"可变但不触发渲染"的值(定时器 id、上一次的值、避免闭包陷阱的逃生通道)。`ref` 对象在组件整个生命周期稳定不变;React 19 起函数组件可以直接把 ref 当 prop 传,`forwardRef` 退居二线。
- **useContext**:消费 Context(见第四站),读 Context 的组件在 value 变化时必重渲染。
- **useReducer**:复杂状态逻辑(多 action、相互关联的更新),`dispatch` 触发,reducer 必须纯(不要在里面发请求/改参数)。
- **useMemo / useCallback**:缓存计算 / 缓存函数引用,配 `React.memo` 用;它们是优化不是免费午餐——先有性能问题再用,依赖数组写错反而引入 bug。
- **useLayoutEffect**:同步副作用,测量布局/避免闪烁,SSR 下会告警,普通场景别碰。
- **useImperativeHandle**:把子组件内部方法暴露给父 ref(自定义组件的"命令式把手",配 forwardRef 或 React 19 的 ref prop)。
- **useDebugValue**:DevTools 里给自定义 Hook 显示标签,可传格式化函数。
- **useTransition**:标记低优先级更新(大列表过滤、Tab 切换),配 `isPending` 显示过渡态;React 19 里 Actions 场景它还能接管 pending 状态。
- **useDeferredValue**:延迟"昂贵值"本身(不是延迟更新),与防抖的区别:没有固定等待时间,空闲就立刻出结果。
- **useId**:生成稳定唯一 ID(表单 label 关联、无障碍),SSR 下保证客户端一致,别自己拼随机数。
- **useSyncExternalStore**:给外部 store 建订阅(写状态库的人用;getSnapshot 返回不可变快照,否则无限循环)。
- **useInsertionEffect**:CSS-in-JS 注入样式专用,在布局副作用之前同步执行。
- React 19 新成员:**useActionState**(表单 action 的状态机:pending/error/data)、**useOptimistic**(乐观更新,请求失败自动回滚)、**useFormStatus**(表单里读父表单状态)、**use()**(在组件里直接读 Promise/Context,可配合 Suspense 做声明式数据获取)——新项目可以尝鲜,生态稳定后再全面铺开。

**自定义 Hook**:函数名 `use` 开头、内部可调其他 Hooks,把"有状态逻辑"抽出来复用(useLocalStorage/useFetch/useDebounce/useWindowSize/useClickOutside 是样板);注意每次调用状态独立;参数变化要配合 useEffect 同步(自定义 Hook 最常见的 bug 是"参数变了内部不更新")。**Hooks 规则**比任何 API 都重要:只在顶层调用(不写进循环/条件/嵌套函数)、只在 React 函数里调用——React 靠**调用顺序**给 Hook 配 state 记忆,顺序一变全乱;配 `eslint-plugin-react-hooks` 让机器盯。

## 第四站:组件通信与状态管理——数据该住哪

先问:数据是本地吗?是就 useState。兄弟要共享?状态提升。跨多层?**Context**:`createContext(defaultValue)` + `<Provider value>` + `useContext`。Context 细节:value 每次渲染都是新引用,消费组件全量重渲染——优化三板斧(拆细粒度 Context、value 用 useMemo、把变化与不变分开);Provider 可以嵌套(内层覆盖外层,主题/语言包就是这么叠的);Context 只解决"跨层传递",不是全局状态管理,别把请求结果全塞进去。

**全局状态库**选型地图:Redux + Redux Toolkit(正统大军:单一 store、`createSlice`(reducers 里可直接"写"因为内置 Immer)、`configureStore`、`useSelector` 配浅比较防重渲染;**RTK Query** 顺手把服务端缓存也管了)、Zustand(极简:`create` 一个 store、组件外用 `store.getState()`、中间件 persist 持久化、v5 的用法)、Jotai/Recoil(原子化:状态拆原子、派生原子)、MobX(响应式可变状态,样板最少,类 + observable)。**服务端状态不属于全局 store**:它有自己的生命周期(缓存/失效/重试),归数据请求库管(下一站)。选型心法:项目小用 Zustand,团队大/规范严用 Redux Toolkit,偏好响应式用 MobX——**别为了用而用,useState + Context 能解决就别上库**。

## 第五站:数据获取——别让请求裸奔

朴素模式:useEffect + fetch + loading/error/data 三件套,卸载时 AbortController 取消——**竞态问题**是这模式的暗礁(快速切换时旧请求后到覆盖新数据,要自己用"请求序号"或取消解决),写一次就懂为什么需要库。

**TanStack Query(React Query)**:`useQuery({ queryKey, queryFn })` 声明数据依赖——缓存按 queryKey 管理、窗口聚焦自动刷新(`refetchOnWindowFocus`)、`staleTime`(数据多久算旧)与 `gcTime`(缓存保留)、`useMutation` 管写 + `invalidateQueries` 失效重取、`useInfiniteQuery` 无限滚动/分页、乐观更新(先改 UI,失败回滚)、错误重试(默认三次)。**SWR**(Next.js 同门):`useSWR`,stale-while-revalidate(先给缓存再后台验证),`mutate` 手动更新,`useSWRInfinite` 分页。选型:数据密集应用 React Query;SSR 项目 SWR。SSR 数据获取还有 RSC(Server Components)新范式——服务端直接取数下发,客户端零请求代码,Next.js 的 App Router 是主战场。

## 第六站:路由与表单

**React Router**(v6/v7):声明式 `Routes`/`Route` 之外,新主流是**数据路由** `createBrowserRouter` + `RouterProvider`(loader 在渲染前取数、action 处理提交、`useLoaderData` 读数据——页面骨架即数据依赖);`Link`/`NavLink`(高亮用 className 函数)、`useNavigate`、`useParams`/`useSearchParams`(读改查询串,setSearchParams 做筛选页)、`useLocation`;嵌套路由 + `Outlet`(布局路由:父路由只出布局,子路由填内容)、`index` 路由(默认子页)、路径通配 `*`(404 页);代码分割:`lazy` + `Suspense` 或 route.lazy;守卫:没有"路由守卫"概念,用布局组件 + loader 重定向(或包装组件)实现登录鉴权;`useBlocker` 拦截离开(表单未保存提示)。其他路由库:Solid 系/Next.js 文件路由,了解即可。

**表单**:最朴素的受控表单在字段多时又臭又长,现代组合是 **React Hook Form + Zod**:RHF 非受控 + ref(大量字段不卡),`register` 注册字段、`useFieldArray` 动态增删字段、`watch` 响应式监听;Zod 做 schema(`z.object`),类型用 `z.infer` 自动推导(一套定义,校验 + TS 类型双收),RHF 的 `resolver` 接 zod;表单错误显示、提交态(isSubmitting)都是标配。老牌 Formik + Yup 还在存量项目,新项目用 RHF。

## 第七站:样式、动画与 UI

**样式方案全景**:CSS Modules(`.module.css` 局部作用域,零依赖最稳)、Tailwind CSS(原子类,现代新项目主流,配 `@apply` 抽公共样式)、CSS-in-JS(styled-components/Emotion:动态 props 方便但运行时开销;vanilla-extract/linaria 是编译时 CSS-in-JS,零运行时,库作者爱用)、UnoCSS(按需原子化);CSS 变量做主题(dark mode 一键切)。**UI 组件库**:Ant Design(企业后台首选,组件全家桶)、MUI(Material 风格)、Chakra UI(可访问性友好)、Headless UI/Radix UI(无样式 + 完整可访问逻辑,自己套皮)、shadcn/ui(源码复制进项目,想改哪改哪,当下人气王)、Fluent/Semi 等按团队审美。选型原则:业务后台用大而全,品牌官网用无头自绘,组件风格跟设计稿走。

**动画**:React 本身不提供动画 API,生态三选:framer-motion(声明式,`motion.div` + AnimatePresence 进出场,当下最流行)、react-spring(物理弹簧动画,数值驱动)、GSAP(能力天花板,复杂时间线);CSS transition/animation 够用就不上库;列表动画、路由过渡、数字滚动是三个常见场景。**无障碍**:组件要过键盘(焦点可见/可 Tab 遍历)、读屏(aria-label/role)、焦点管理(弹窗打开聚焦、关闭归还)——用 Radix/shadcn 这类库能免费拿到大半,自己写弹窗务必补课。

## 第八站:渲染原理、并发与性能——从"会写"到"写得快"

React 性能心智模型一句话:**setState 之后发生了什么**——进入**渲染阶段**(执行组件函数、生成新虚拟 DOM、与上次**协调/Diff**,此阶段可中断),再进**提交阶段**(差异写入真实 DOM,不可中断)。React 18 的 **Fiber 双缓冲**(current/workInProgress 两棵树)让"可中断渲染"成为可能——这就是并发特性(useTransition/useDeferredValue)的底层,也是 React 19 并发 Actions 的地基。**Diff 算法**要点:同层比较、key 定位移动、类型不同直接重建——所以 key 稳定、组件类型稳定(别在条件里换组件类型,会整个卸载重建丢 state)是两条铁律。

优化武器库按性价比排序:①key 给对;②`React.memo`(props 浅比较,配 useCallback/useMemo 保持引用稳定,否则白搭);③避免内联对象/函数/箭头(每次渲染新引用 = memo 失效);④懒加载(React.lazy + Suspense、动态 import、路由级);⑤虚拟化(react-window,长列表只渲染可视区);⑥**并发特性**(useTransition 降级非紧急更新,输入框不卡);⑦**Profiler 组件**与 React DevTools Profiler 火焰图测量——**先测再改,别凭感觉优化**;⑧Suspense 边界与流式 SSR(服务端分批下发);⑨Server Components(把组件跑在服务端,客户端包体积骤减——Next.js App Router 实践)。别过度优化:大部分"卡"来自巨型列表与重复渲染,先修这两个;`<StrictMode>` 开发期双调用是帮你发现副作用,不是 bug。

## 第九站:类组件、错误边界与老代码

老项目维护必备的"考古学":类组件生命周期(挂载:constructor → getDerivedStateFromProps → render → componentDidMount;更新:getDerivedStateFromProps → shouldComponentUpdate(性能:手动控制是否渲染,React.memo 的函数式对应)→ render → getSnapshotBeforeUpdate → componentDidUpdate;卸载:componentWillUnmount);`this.setState` 合并更新;refs 三种拿法(字符串 ref 废弃、回调 ref、createRef);HOC(高阶组件:包装组件加 props,`withRouter` 那类;现在被自定义 Hook 取代)、render props(children 为函数的模式)——看到别慌,知道"旧写法,新代码别用"。**错误边界(Error Boundaries)**:类组件专属 `static getDerivedStateFromError` + `componentDidCatch` 捕获子树渲染错误降级 UI——捕获不了事件处理器与异步代码的错;粒度按"独立功能区域"设计,配错误上报服务(独立于 React 的监控体系,如 Sentry)。**Portals**:`createPortal(children, dom)` 渲染到组件树外的 DOM(Modal/Tooltip 标配,逃过 overflow 裁剪);Portal 里事件按 React 树冒泡、Context 照常穿透。**SSR/hydration**:服务端渲染 HTML + 客户端"复活",`hydrateRoot`;hydrate 不匹配(客户端首渲与服务端 HTML 不一致)会警告并全量重渲染——时间/随机数别在渲染期生成(useId 就是为它而生的)。

## 第十站:测试与类型

**测试栈**:Vitest(或 Jest)+ **React Testing Library**(RTL)+ user-event + MSW(mock 接口)。RTL 哲学:像用户一样测试——查询优先 `getByRole`/`getByLabelText`(语义查询,顺带逼你写对无障碍),少用 `getByTestId`;断言渲染结果与行为(`fireEvent` 是老 API,新代码用 user-event 模拟真实交互);异步用 `findBy*` + `waitFor`;组件外操作(请求/定时器)会触发 act 警告——学会"把交互包进 act"是 RTL 的第一课。策略:纯函数与自定义 Hook 单测、组件交互测试、关键流程 E2E(Playwright/Cypress);快照测试易碎,慎用。**TypeScript 集成**:Props 用 interface + `PropsWithChildren`;事件类型 `React.ChangeEvent<HTMLInputElement>`、`MouseEvent`;`useRef<HTMLInputElement>(null)` 泛型带 null;`ComponentProps<'button'>` 继承原生属性;多态组件(as prop)用泛型;`z.infer` 让 API 类型与校验同源。React 19 + TS:ref 作为 prop 的类型 `Ref<T>`。

## 第十一站:源码与生态地图

React 源码仓库布局:react(核心 API)、react-dom(渲染器)、react-reconciler(协调器,灵魂)、scheduler(调度器,时间切片)、react-server(Server Components 运行时,新)。阅读路径:ReactElement 创建 → JSX 转换 → Fiber 创建与更新 → Hooks 链表(memoizedState 上的秘密)→ Lane 优先级调度(过期/饥饿/插队)→ 合成事件 → Diff。想快速建立全景可以先看"React 工作原理"类图解文章,再对着源码验证;手写迷你 React(createElement + render + useState)是公认最有效的入门方式。**生态地图**(按需点亮):框架层 Next.js(全栈默认)、Remix(嵌套路由激进派);状态 XState(状态机);表单 RHF;动画 framer-motion;样式 Tailwind;数据 TanStack Query;i18n react-i18next;表格 TanStack Table;图表 ECharts/Recharts;拖拽 dnd-kit;虚拟滚动 TanStack Virtual;CLI 脚手架 Vite + create-react-app(已停更,别再用)。

## 岔路口:React 学完去哪

- **Next.js**:React 的全家桶框架——路由、SSR/SSG、Server Components、API 路由,现在 React 岗位的默认技能树。[Next.js 学习路线](/learning-paths/frontend/nextjs)
- **React Native**:同一套组件心智写移动应用。[React Native 学习路线](/learning-paths/mobile/react-native)
- **Remix**:嵌套路由与数据加载理念前卫,了解拓宽视野。

## 通关标准

能独立做到:用函数组件 + Hooks + TS 实现一个带筛选、搜索、本地存储的完整应用;说清"点击按钮后 setState 到界面更新"的完整流程(批处理 → 渲染阶段协调 → 提交);解释为什么 key 不能用下标、为什么不能条件调用 Hook、memo 为什么需要稳定的 props 引用;能说出 useState 与 useReducer、useEffect 与 useLayoutEffect、useTransition 与 useDeferredValue 的区别;写过的组件能过 RTL 测试与基本无障碍检查——React 主线通关。

最后记住两句:React 只是 View 层,路由/状态/数据都要自己组装——这是它灵活的原因,也是学习成本的来源;别在不理解渲染原理时盲目"优化"。React 生态日新月异,但组件化 + 单向数据流 + 不可变更新的心智模型十年没变——把根扎稳,枝叶随它长。
