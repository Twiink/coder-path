# Vue.js 学习路线

Vue 是尤雨溪(Evan You)创造的渐进式框架:"渐进式"的意思是——想用多少用多少,从页面里一个小组件到完整应用的前端解决方案,它都接得住。中文文档友好、上手曲线平缓,是无数人的前端框架初恋。**Vue 3 是绝对主流**(Composition API + 更好的 TypeScript 支持),Vue 2 已进入维护模式(EOL,新项目别用,老项目尽快规划迁移)。这条线完全以 Vue 3 为准。

路线按 **模板语法 → 组件与 SFC → 响应式系统 → Composition API → 状态管理 → 路由 → 表单与动画 → 性能优化 → 工具与生态 → TypeScript 与测试 → 原理深水区** 推进,知识点尽量铺全:常用的要顺手,不常用的要见过——面试与老代码都在这张图里。

## 第一站:模板语法——声明式渲染入门

Vue 模板是"增强版 HTML",核心是**插值**与**指令**。插值 `{{ message }}`(支持任意表达式,但别写复杂逻辑——那是 computed 的活);`v-text`/`v-html` 是插值的替代品,**v-html 渲染原始 HTML 有 XSS 风险,永远别用于用户输入**。

**指令体系**(`v-` 开头,简写要熟):

- `v-bind`(`:`):绑定属性/组件 props;`:class` 支持对象(`{ active: isOn }`)与数组语法、`:style` 支持对象(驼峰键/短横线都行,`fontSize` 或 `'font-size'`)——**动态 class/style 是日常最高频操作**;动态参数 `:[attrName]`、绑定整个对象 `v-bind="obj"`(批量传 props 给子组件)。
- `v-on`(`@`):绑定事件;事件修饰符全家:**`.stop`(停冒泡)/`.prevent`(拦默认)/`.capture`(捕获阶段)/`.self`(只自己触发)/`.once`(只一次)/`.passive`(滚动性能,常与 prevent 互斥)**;按键修饰符(`@keyup.enter`、`.esc`、`.tab`,还能精确到 `.exact`);鼠标修饰符(`.left`/`.right`/`.middle`);系统修饰键(`.ctrl`/`.shift`/`.alt`/`.meta`);动态事件 `@[eventName]`。
- **`v-model` 双向绑定**:本质是 `:modelValue` + `@update:modelValue` 的语法糖;修饰符 `.lazy`(改 change 触发)/`.number`(自动转数)/`.trim`(去空格);组件上自定义 v-model 参数(见第三站);`v-model` 在 `<script setup>` 里用 `defineModel`(3.4+)。
- 条件:`v-if`/`v-else-if`/`v-else`(真条件,不渲染就不进 DOM)vs `v-show`(仅切 display,频繁切换用);`v-if` 与 `v-for` 同元素时 Vue 3 中 **v-if 优先级更高**(官方不推荐同用,用 template 包一层分开)。
- 列表:`v-for` 遍历数组/对象/数字范围,`:key` 必须(身份指纹,别用 index);`v-for` + `<template>` 批量渲染。
- 其他:`v-once`(一次性渲染,内容永不变)、`v-memo`(3.2+,依赖数组不变则跳过更新,高级性能手段)、`v-cloak`(防插值闪烁,老技巧)、`v-pre`(跳过编译)。

**计算属性 computed**:带**缓存**的派生状态(依赖不变不重算,这是与方法的最大区别);支持 getter/setter(`computed({ get, set })`,一般只读)。**侦听器 watch**:监听响应式数据变化做副作用;选项:`deep`(深监听对象,开销大)、`immediate`(立即执行一次)、`once`(3.4+,只触发一次)、`flush: 'post'`(DOM 更新后再跑,配合 nextTick 场景);**watchEffect**:自动收集依赖,变化即重跑,适合"副作用与数据一一对应"的场景;`watchPostEffect`/`watchSyncEffect` 是带 flush 的变体;watch/watchEffect 都返回停止函数,组件卸载自动停,组合式函数里手动管理生命周期时记得调。**模板引用 ref**:`ref="el"` 拿 DOM 或组件实例(组件实例默认不暴露内部,配 `defineExpose`)。

## 第二站:组件与 SFC——搭积木的正确姿势

**单文件组件(SFC)**:一个 `.vue` 文件 = `<template>` + `<script setup>` + `<style>`;**`<style scoped>`** 局部作用域(编译期给选择器加 data 属性),穿透子组件样式用 **`:deep()`**(如改组件库内部样式)、`:slotted()`(影响插槽内容)、`:global()`(全局);`<style module>` 让 class 变成响应式对象(`$style.xxx`);还能用 **`v-bind()` 在 CSS 里用 JS 变量**(`:style` 之外的另一种动态样式)。

**组件通信四件套**:①Props 父传子:`defineProps<{ user: User }>()`(TS 写法)+ `withDefaults` 默认值;props 单向数据流、子组件只读;运行时校验(选项式写 type/required/validator)。②事件子传父:`defineEmits<{ (e: 'save', u: User): void }>()` + `emit('save', data)`;声明事件后还能校验载荷;父组件 `@save` 接收。③插槽:`<slot>` 默认插槽 + 具名插槽(`<slot name="header">` ↔ `<template #header>`,简写 `#`)+ **作用域插槽**(子组件把数据传回插槽内容:`<slot :item="item">`,父用 `#default="{ item }"`——表格列、列表项自定义渲染的标配)+ 插槽默认内容 + **动态插槽名**。④模板 ref + `defineExpose`(父组件命令式调用子组件方法)。跨层用 provide/inject(第五站),全局用 Pinia。

**组件形态**:动态组件 `<component :is>`(Tab 切换,配 KeepAlive 保状态);异步组件 `defineAsyncComponent`(支持 loading/error/delay/timeout 选项,组件级代码分割);递归组件(组件自己引用自己,树形菜单);`<Teleport>`(`to="body"` 传送到组件树外,Modal/Toast 标配,配 disabled 条件传送);**`<Suspense>`**(等待嵌套异步依赖:异步组件、`<script setup>` 顶层 await——实验性但 Nuxt 已大量使用);KeepAlive(缓存组件实例,`include`/`exclude` 按名字过滤,配合 `onActivated`/`onDeactivated` 生命周期)。**选项式 API**(Vue 2 心智:data/computed/methods/watch/lifecycle 选项)在 `<script setup>` 时代看老代码用,新代码一律组合式。

## 第三站:响应式系统——Vue 的心脏

**ref 与 reactive**:`ref` 包一切(基本类型必须),读写 `.value`(模板中自动解包,但**模板顶层解包、嵌套对象里不自动解包**的规则要记牢);`reactive` 只包对象/数组/Map/Set,直接访问属性;两者取舍:ref 全能且解构安全,reactive 写起来少敲 `.value` 但**解构/展开会丢响应性**——用 `toRefs`(整个解构)或 `toRef`(单属性)保住。`ref` 接收对象时会内部转 reactive。

**原理**:Vue 3 用 **Proxy** 替代 Vue 2 的 `Object.defineProperty`——能拦截新增/删除属性、数组索引修改,还支持 Map/Set;`reactive` 读取属性时 **track 收集依赖**(记录"谁在用"),修改时 **trigger 触发更新**(重跑依赖的 effect);副作用函数是 **effect**,组件渲染本身就是一个 effect;依赖存储为 targetMap → depsMap → dep 三层结构(WeakMap 外层,对象不用了可被回收);`computed` 是懒 effect(访问才求值 + 缓存),`watch` 是显式 effect。**Vue 2 响应式局限**(新增属性要 $set、数组索引失效、delete 不响应)是面试对比题,能讲清 Proxy 与 defineProperty 的差异就赢了。**shallowRef/shallowReactive**(只第一层响应式,大对象/低频数据省开销)、`triggerRef`(手动触发 shallowRef 更新)、`customRef`(自定义 get/set 逻辑,做防抖 ref)、`readonly`(只读代理,防篡改,provide 注入时常用)、`markRaw`(标记对象永不响应式:第三方实例、超大静态数据)、`effectScope`(高级:批量管理 effect 生命周期,写组合式函数库用)。

**模板 ref、组件 ref、响应式互转**的坑:响应式对象塞进 reactive/ref 会被代理,`toRaw` 取回原始对象(性能敏感操作);`isRef`/`isReactive` 类型判断。**响应式丢失**是新手第一大坑:从 store/组合式函数解构出普通变量,改了不更新——解法永远是 toRefs/直接读 .value。

## 第四站:Composition API——逻辑的组织艺术

**`<script setup>`** 是组合式的完全体:顶层变量/函数直接进模板,无需 return;编译宏不 import 直接用——`defineProps`/`defineEmits`/`defineExpose`/`defineModel`(组件上 v-model 双向绑定:替代"modelValue + update:modelValue"样板)/`defineOptions`(3.3+,给组件设 name/inheritAttrs 等选项,`defineOptions({ name: 'Xxx' })` 是递归组件与 KeepAlive include 的前提);顶层 `await` 让组件变异步组件(需 Suspense 包裹)。`useSlots()`/`useAttrs()` 拿插槽与透传属性(没在 props/emits 声明的属性默认透传到根元素,`inheritAttrs: false` 可关——封装组件常配合 `v-bind="$attrs"` 手动放置)。

**生命周期**(组合式,选项式对照):`onBeforeMount`/`onMounted`(发请求、初始化 DOM 操作——用得最多)、`onBeforeUpdate`/`onUpdated`(状态变了 DOM 更新后)、`onBeforeUnmount`/`onUnmounted`(清理定时器/取消订阅/移除监听——必配 onMounted 使用)、`onActivated`/`onDeactivated`(KeepAlive 缓存进出)、`onErrorCaptured`(捕获子孙组件错误,错误边界,可配合错误上报)、`onRenderTracked`/`onRenderTriggered`(调试响应式依赖,DevTools 出现前的利器);选项式的 `created` 逻辑直接写在 setup 顶层(所以没有 onCreated)。钩子只能在 setup 同步阶段调用(规则与 React Hooks 同源)。

**组合式函数(Composables)**:把有状态逻辑抽成 `use` 开头的函数,内部用 ref/computed/watch/生命周期,返回响应式数据与操作;样板:useMousePosition(事件+生命周期清理)、useFetch(loading/error/data + 竞态处理 + 取消)、useLocalStorage(读写+同步)、useDebounce/useThrottle、useEventListener;注意:每次调用状态独立;参数用 ref 接收(toRef 统一)更灵活;内部用生命周期钩子时"谁调用归谁管"。**VueUse** 提供了 200+ 个生产级 composables,先查再写。

**provide/inject 依赖注入**:父组件 `provide('key', value)`(传 ref 保响应式,`readonly` 防子组件篡改),任意深度后代 `inject('key', 默认值)`;函数式 provide(响应式函数,子组件调用,类似"作用域插槽的跨层版");应用级 `app.provide()` 全局注入。**组件通信全景复习**:父子 Props/Emits,跨层 provide/inject,兄弟靠父组件或状态库,任意组件事件总线(mitt)是反模式。

## 第五站:状态管理——Pinia

**Pinia** 是 Vue 3 官方状态库(Vuex 4 只是兼容层,Vuex 的 state/getters/mutations/actions 四件套与 mapState 辅助函数看老代码认识即可,新项目一律 Pinia):

- **defineStore('id', 选项式 | setup 式)**:setup 式更灵活(内部用 ref/computed/函数,return 出去),选项式字段清晰;
- **state**:就是 ref,直接 `store.count++`(没有 mutation 仪式);**getters**:computed,可依赖其他 getter,箭头函数写法要用 `this` 得用普通函数;**actions**:普通函数,可异步,直接改 state,`this` 指向 store;
- **storeToRefs** 解构保响应性(解构 action/getter 直接取,解构 state 必须 storeToRefs);
- `$patch`(批量修改 + 部分更新)、`$subscribe`(监听变化,默认只在 patch 后触发一次,配持久化)、`$onAction`(拦截 action 调用前后)、`$reset`(选项式 store 有);
- **store 之间互相调用**(storeA 里用 storeB);
- **插件**:`pinia.use()`——持久化(pinia-plugin-persistedstate)、日志、重置;store 定义在组件外也能用(组合式函数的天然搭档);
- 选型判断:纯前端状态小用 useState + provide 就够;多页面共享、复杂业务状态、需要 DevTools 时间旅行时上 Pinia。

## 第六站:路由——Vue Router 4

**基础**:`createRouter({ history, routes })`;两种 history——`createWebHistory`(HTML5 History,URL 干净,需服务器配 fallback 到 index.html,否则刷新 404)与 `createWebHashHistory`(#/ 形式,静态托管友好,无需服务端配置);`createMemoryHistory`(SSR/测试用,不操作地址栏)。模板:`<router-link>`(`to` 支持字符串/对象 `{ name, params, query }`,active-class 自动高亮,`custom` 模式自定义渲染)与 `<router-view>`。

**进阶**:动态路由 `/user/:id`(`useRoute().params`,支持多段 `/:path(.*)` 通配配 404 页);编程导航 `router.push`/`replace`/`go`(返回 Promise,失败要 catch——重复导航到同路径会 reject);**嵌套路由 children**(父组件里放 `<router-view>`,后台布局标配);命名路由 name(比路径稳,路径改了不用改代码);命名视图(一个路由渲染多个 `<router-view name>`);`query` 参数;`props: true` 把路由参数当 props 传给组件(组件解耦路由,可测);**meta 元信息**(标题/权限标记);**路由守卫**三兄弟:全局 `beforeEach`(登录鉴权主战场;注意异步守卫要 return 或 next,新 API 推荐 return 值)/`afterEach`(收尾:改标题、埋点)/`beforeResolve`;路由独享 `beforeEnter`;组件内 `onBeforeRouteUpdate`/`onBeforeRouteLeave`(离开前弹"未保存"确认);守卫里重定向 return 对象或路径;**导航故障**处理(`isNavigationFailure` 区分重定向/取消/重复);**动态路由管理**:`router.addRoute`(权限菜单动态挂载)、`removeRoute`/`hasRoute`;**滚动行为** `scrollBehavior`(切页回顶部/还原位置);路由级懒加载 `() => import('@/views/Xxx.vue')`——首屏性能基本盘。

## 第七站:表单与动画

**表单**:`v-model` 覆盖 text/textarea/checkbox/radio/select;checkbox 数组、select multiple;组件级双向绑定 `defineModel`(3.4+,`defineModel<string>({ default: '' })`,还能配 required 校验);**表单校验方案**:VeeValidate(声明式规则 + 组合式 `useField`/`useForm`,配 yup/zod schema)、Element Plus 等组件库自带 Form 校验(required/pattern/自定义 validator,中小项目够用)、纯手写(学习期理解原理:提交时统一 validate)。**过渡动画**:`<Transition>` 单元素进出场——原理:插入/移除时自动加类,类名机制要懂:`v-enter-from`/`v-enter-active`/`v-enter-to`(进入三段)与 `v-leave-from`/`v-leave-active`/`v-leave-to`(离开三段),CSS transition 或 @keyframes 动画都接得上;配 `name="fade"` 类名变 `fade-enter-active`;`appear` 初始渲染也动画;`mode="out-in"`(先出后进,防重叠——弹窗切换标配);JS 钩子(`@before-enter`/`@enter`/`@after-enter`/`@leave` 系列,配 done 回调,接 GSAP 做复杂动画);`<TransitionGroup>` 列表过渡(新增/删除/移动,配 `v-move` 实现"其他元素平滑让位",`tag` 指定渲染元素);第三方:GSAP、Motion One、Animate.css。**自定义指令**(3.x):`vFocus` 这类,钩子 mounted/updated/unmounted,应用:自动聚焦、权限控制(v-permission)、水印、懒加载;`app.directive` 全局注册——组件逻辑抽不出 composable 时(纯 DOM 行为)用它。

## 第八站:性能优化——Vue 为什么快

**武器库**:`KeepAlive`(缓存组件实例,Tab 切换不丢状态/不重复请求,`max` 限缓存数);`v-once`(纯静态内容只渲一次);`v-memo`(3.2+,条件缓存,大列表配合);`shallowRef`(大对象只追踪顶层);异步组件 + 路由懒加载(代码分割,首屏只下需要的);`defineAsyncComponent` 的 loading 组件提升感知体验;长列表虚拟滚动(vue-virtual-scroller);`<Teleport>` 避免弹窗引起父组件层叠上下文问题;`nextTick`(DOM 批量更新后读取——改完数据马上读 DOM 高度是 0 的答案);**列表 key**(稳定唯一,复用与 Diff 的前提);`v-for` 别和 `v-if` 同元素。

**Vue 3 为什么快(原理层,面试深水区)**:模板在**编译期**被静态分析——**静态提升**(不变的节点只创建一次,更新时直接复用,不参与 Diff)、**PatchFlag**(给动态节点打标记:动态文本/动态 class/动态 props……更新时只比对有标记的部分)、**事件缓存**(内联事件处理器编译期缓存,不再每次渲染新建)、**Block Tree**(只收集动态子节点成数组,更新时跳过静态子树)、**预字符串化**(大量连续静态内容直接合成字符串)、**Tree-shaking**(内置组件/指令按需打包,没用到的进不了产物)——对比 React 的"运行时 Diff 整棵虚拟 DOM",Vue 在编译期就把大部分工作干完,这就是"模板受限于语法反而成为性能优势"的经典案例。**Suspense + 异步组件**让组件级"加载中"体验顺滑。运行时全量构建 vs 运行时编译(用 template 字符串编译才需要)是另一个知识点:默认构建已预编译 SFC。

## 第九站:工具与生态

**开发标配**:Vite(官方钦定构建工具,秒级冷启动,`@vitejs/plugin-vue`;dev server 的模块热替换 HMR 体验是 Vue 开发灵魂;Vue CLI 是 legacy,新项目别用)、**Vue DevTools**(组件树/状态/Pinia/路由时间线、性能面板,响应式依赖可视化)、**Volar**(VSCode 官方插件,现已并入 Vue - Official;模板表达式类型检查、`<script setup>` 智能提示;记得禁用旧 Vetur)。**UI 组件库**按场景:Element Plus(PC 后台首选,中文文档最全)、Naive UI(TS 类型体验一流)、Ant Design Vue、Arco Design(字节系)、PrimeVue;移动端:Vant(国内 H5 主流)、NutUI;跨端:Quasar(一套代码 Web/移动/桌面)。**工具库**:VueUse(组合式函数宝库,先查再写)、unplugin-auto-import/unplugin-vue-components(自动导入 API 与组件,少写一半 import)、unplugin-icons(图标按需)。**上层框架**:Nuxt 3(全栈:SSR/SSG/文件路由/服务端 API,见 Nuxt 路线)、VitePress(用 Vue 写文档站——你现在看的这个站就是)、VuePress(老一代)。

## 第十站:TypeScript 与测试

**TS 集成**:`<script setup lang="ts">`;props:`defineProps<{ user: User; count?: number }>()` + `withDefaults` 给可选 props 默认值;emits:`defineEmits<{ (e: 'save', u: User): void; (e: 'delete', id: number): void }>()`(调用签名写法,载荷自动类型检查);`ref<User | null>(null)`、`computed<number>(...)`;模板里 props 用错类型直接红(配 Volar);**组件类型**:`defineComponent` 的类型推导(选项式),全局组件类型注册(ComponentCustomProperties 增强)让模板里 $xxx 有类型;`PropType<T>`(选项式复杂 props 校验)。

**测试**:单测跑 **Vitest**(Vite 原生,快);组件测试 **Vue Test Utils**:`mount`/`shallowMount`(后者 stub 子组件,隔离测试)、`wrapper.find`/`findAll`、`trigger`(触发事件)/`setValue`(v-model 输入)、`props()`/`emitted()`(断言子组件发出的事件——测"点了按钮父组件收到 save 事件"的标准姿势)、`global` 配置项(注入 stubs/plugins/混入,测带路由/状态库的组件要 mock);**@vue/test-utils` + jsdom/happy-dom 环境;E2E 用 Playwright(配 Vue 插件,数据驱动测试);策略:composables 与工具函数优先单测、关键交互组件测试、核心流程 E2E;快照测试慎用。

## 第十一站:原理深水区

**模板编译原理**:SFC 的 template → **parse**(模板字符串 → AST)→ **transform**(打 PatchFlag/静态提升标记、解析指令)→ **generate**(生成 render 函数)——`vue/compiler-sfc` 可以单独拿出来玩,看看自己的模板编译成什么样,是理解"编译时优化"最快的方式。**响应式源码线**:reactive(创建 Proxy)→ ref(RefImpl 类)→ effect(依赖收集与触发的核心)→ track/trigger(三层依赖结构)→ computed(懒缓存:脏值标记)→ watch(基于 effect + 调度)→ scheduler(任务队列批量刷新,nextTick 的底层)。**渲染器源码线**:createRenderer(平台无关渲染器工厂)→ mountComponent(挂载:创建实例、跑 setup、编译渲染)→ updateComponent(更新:触发重渲染、patch 新旧 VNode)→ patch 的 Diff(同层比较、key 优化、双端?)→ Fragment/Teleport/KeepAlive 特殊处理。**v-model 编译**:模板里的 `v-model` 展开成 `:modelValue` + `@update:modelValue` 的编译结果,看一眼就懂。**自定义指令编译**:指令在元素上生成对应生命周期钩子调用。大多数人不必通读源码,但"编译优化做了什么、响应式怎么收集依赖"值得搞透——它们直接解释了你每天写的模板为什么快。

## 岔路口:Vue 学完去哪

- **Nuxt 3**:Vue 的全家桶框架——SSR/SSG、文件路由、服务端 API、自动导入,想全栈直接上。[Nuxt.js 学习路线](/learning-paths/frontend/nuxtjs)
- **桌面应用**:Electron + Vue 或 Tauri + Vue。[Electron 学习路线](/learning-paths/desktop/electron)
- **移动端**:Vant 做 H5,或 uni-app 一套代码多端。[uni-app 学习路线](/learning-paths/mobile/uniapp)
- **微前端**:qiankun/single-spa(大厂多团队协作场景再学)。

## 通关标准

能独立做到:用 `<script setup>` + TS + Pinia + Vue Router 写一个带表单校验、列表增删、权限路由的中型应用;讲清 ref 与 reactive 的区别、响应式对象解构为什么会丢、数据更新到界面刷新的完整链路(track → trigger → scheduler → patch);说清 computed 与 watch 的适用场景、v-if 与 v-show 的选择、v-for 为什么必须配 key;用 defineModel 封装一个可双向绑定的自定义组件;解释静态提升与 PatchFlag 优化了什么——Vue 主线通关。

最后说一句:Vue 的学习曲线平缓,但不代表它浅——响应式系统与编译优化都是业界顶尖设计。先享受"写起来顺手"的快乐,再慢慢理解"为什么这么顺手",你会越来越喜欢这个"中庸而不平庸"的框架。
