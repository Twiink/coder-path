# Vue.js 学习路线

渐进式 JavaScript 框架，从一个简单的视图层库到完整的前端解决方案，想用多少用多少。尤雨溪（Evan You）创造的国产框架，文档友好，上手简单，是很多人的前端框架入门首选。

## 基础篇：核心概念


### Vue 3 vs Vue 2
- Vue 3 是现在的主流：Composition API、更好的 TypeScript 支持
- Vue 2 已进入维护模式：不推荐新项目使用
- 这份路线以 Vue 3 为主

### 模板语法
- 插值：{{ message }}、v-text
- 指令：v-bind（:）、v-on（@）、v-model、v-if、v-for、v-show
- 属性绑定：:href、:class、:style
- 事件绑定：@click、@input、事件修饰符（.prevent、.stop）
- 双向绑定：v-model、修饰符（.lazy、.number、.trim）
- 条件渲染：v-if、v-else-if、v-else、v-show
- 列表渲染：v-for、key 的重要性
- 计算属性：computed、缓存特性
- 侦听器：watch、watchEffect

### 组件基础
- 组件定义：单文件组件（.vue）
- 组件注册：全局注册、局部注册
- Props：父传子、类型验证、默认值
- Events：子传父、$emit、defineEmits
- Slots：插槽、具名插槽、作用域插槽
- 动态组件：\<component :is=""\>
- 异步组件：defineAsyncComponent

### 响应式基础
- ref：基本类型响应式、.value 访问
- reactive：对象响应式
- toRefs：解构响应式对象
- computed：计算属性
- watch：侦听响应式数据
- watchEffect：自动追踪依赖

### 响应式原理深入
- Proxy vs Object.defineProperty
- 响应式代理的创建过程
- track 依赖收集机制
- trigger 触发更新机制
- effect 副作用函数
- targetMap、depsMap、dep 三层结构
- 响应式的嵌套处理
- 数组响应式的特殊处理
- WeakMap 与内存管理

## 进阶篇：Composition API

### 生命周期钩子
- onMounted：组件挂载后
- onUpdated：组件更新后
- onUnmounted：组件卸载前
- onBeforeMount、onBeforeUpdate、onBeforeUnmount
- 对比 Options API：created、mounted、updated、destroyed

### setup 函数
- setup() 基本用法：返回响应式数据和方法
- setup 参数：props、context
- \<script setup\> 语法糖：简化写法、自动暴露
- defineProps：声明 props
- defineEmits：声明事件
- defineExpose：暴露组件方法

### 组合式函数（Composables）
- 逻辑复用：提取公共逻辑
- 命名规范：use 开头
- 响应式数据返回：ref、reactive
- 常见组合式函数：useMousePosition、useFetch、useLocalStorage
- 组合多个 composables

### Composition API 原理
- setup 函数的执行时机
- currentInstance 实例上下文
- 响应式 API 的实现
- 生命周期 Hook 的注册机制
- provide/inject 的实现原理
- Composition API vs Options API 性能对比

### 依赖注入
- provide：提供数据
- inject：注入数据
- 响应式注入：ref、readonly
- 应用级 provide：app.provide()

## 进阶篇：状态管理

### 组件间通信
- Props / Events：父子组件
- provide / inject：跨层级
- Mitt / tiny-emitter：事件总线（不推荐）
- Vuex / Pinia：全局状态

### Pinia
- Store 定义：defineStore
- State：状态定义、访问
- Getters：计算属性、缓存
- Actions：修改状态、异步操作
- 订阅：$subscribe、$onAction
- 插件：持久化、日志

### Vuex（legacy）
- State、Getters、Mutations、Actions、Modules
- mapState、mapGetters、mapMutations、mapActions
- 命名空间模块：namespaced
- Vue 3 推荐使用 Pinia 代替

## 进阶篇：路由管理

### Vue Router
- 路由配置：createRouter、路由数组
- 路由模式：history、hash
- 路由组件：\<router-link\>、\<router-view\>
- 编程式导航：router.push、router.replace
- 动态路由：/user/:id、useRoute
- 嵌套路由：children、多层嵌套
- 命名路由：name、命名视图
- 路由参数：params、query
- 路由守卫：全局守卫、路由独享守卫、组件内守卫
- 懒加载：() => import()
- 路由元信息：meta

### 导航守卫
- 全局前置守卫：beforeEach
- 全局后置钩子：afterEach
- 路由独享守卫：beforeEnter
- 组件内守卫：onBeforeRouteUpdate、onBeforeRouteLeave

## 进阶篇：性能优化

### 渲染优化
- v-once：一次性渲染
- v-memo：条件缓存（Vue 3.2+）
- 计算属性：缓存计算结果
- 懒加载：异步组件、路由懒加载
- 虚拟滚动：vue-virtual-scroller
- KeepAlive：缓存组件实例

### 虚拟 DOM 与 Diff 算法
- 虚拟 DOM 的概念与优势
- VNode 节点结构：type、props、children
- patch 函数：新旧 VNode 比对
- Diff 算法优化：双端比较
- 静态标记（PatchFlag）：优化 Diff
- 静态提升（hoistStatic）：减少创建开销
- 事件缓存（cacheHandlers）
- Block Tree：优化动态节点收集
- 编译优化：模板静态分析

### 响应式优化
- shallowRef：浅层响应式
- shallowReactive：浅层对象响应式
- readonly：只读响应式
- markRaw：标记非响应式对象
- triggerRef：手动触发更新

### 编译优化深入
- 编译时优化 vs 运行时优化
- 静态节点提升：减少重复创建
- 预字符串化：大量静态内容直接字符串
- 动态节点收集：Block 机制
- Slot 编译优化
- v-for 的 key 优化
- Tree-shaking：按需编译
- SSR 优化：字符串拼接

### 代码分割
- 路由懒加载：动态 import
- 异步组件：defineAsyncComponent
- Vite 自动代码分割

## 实战篇：表单处理

### 表单绑定
- v-model：双向绑定
- 输入类型：text、textarea、checkbox、radio、select
- 修饰符：.lazy、.number、.trim
- 自定义组件 v-model：defineModel（Vue 3.4+）

### 表单验证
- 手动验证：规则函数
- VeeValidate：声明式验证
- 其他方案：Vuelidate、Element Plus Form

## 实战篇：过渡与动画

### 内置过渡
- \<Transition\>：单元素过渡
- 过渡类名：v-enter、v-enter-active、v-leave
- CSS 过渡：transition
- CSS 动画：@keyframes
- JavaScript 钩子：@before-enter、@enter、@after-enter

### 列表过渡
- \<TransitionGroup\>：列表过渡
- 移动过渡：v-move
- 交错过渡：延迟

### 第三方动画库
- Animate.css
- GSAP
- Motion One

## 实战篇：工具与生态

### 开发工具
- Vite：官方推荐构建工具
- Vue CLI：legacy 工具链
- Vue DevTools：浏览器调试插件
- Volar：VSCode 插件（TypeScript 支持）

### UI 组件库
- Element Plus：PC 端首选
- Ant Design Vue：企业级
- Naive UI：TypeScript 友好
- Vuetify：Material Design
- Vant：移动端
- Quasar：跨平台

### 工具库
- VueUse：组合式函数集合
- Vue Demi：兼容 Vue 2/3
- unplugin-vue-components：自动导入组件
- unplugin-auto-import：自动导入 API

## 实战篇：TypeScript 集成

### 组件类型
- defineComponent：组件定义（不推荐）
- \<script setup lang="ts"\>：推荐写法
- Props 类型：withDefaults、interface
- Emits 类型：defineEmits<{ ... }>
- Ref 类型：Ref\<T\>、ref\<T\>()

### Composables 类型
- 返回类型：明确标注
- 泛型 composables：\<T\> 类型参数
- 工具类型：PropType、ExtractPropTypes

## 实战篇：测试

### 测试工具
- Vitest：官方推荐
- Vue Test Utils：组件测试
- Playwright / Cypress：E2E 测试

### 测试策略
- 单元测试：composables、工具函数
- 组件测试：mount、wrapper、断言
- E2E 测试：完整流程

## 源码篇：Vue 3 源码分析


### 源码结构
- packages 目录结构
- reactivity 包：响应式系统
- runtime-core 包：运行时核心
- runtime-dom 包：DOM 渲染器
- compiler-core 包：编译器核心
- compiler-dom 包：DOM 编译器
- shared 包：公共工具

### 响应式系统源码
- reactive 创建代理
- ref 的实现：RefImpl 类
- effect 副作用函数实现
- track 依赖收集源码
- trigger 触发更新源码
- computed 的懒计算实现
- watch 的实现原理
- 调度器 scheduler 设计

### 渲染器源码
- createRenderer 渲染器工厂
- 组件的挂载流程：mountComponent
- 组件的更新流程：updateComponent
- patch 函数的实现
- Diff 算法源码解读
- Fragment、Teleport 实现
- KeepAlive 缓存机制

### 编译器源码
- 模板解析：parse 阶段
- AST 抽象语法树结构
- 转换优化：transform 阶段
- 代码生成：generate 阶段
- 指令的编译处理
- 插值表达式的编译
- 静态提升的实现

## 下一步学习

掌握 Vue 后，可以继续探索：

- **Nuxt 3** - Vue 的 SSR 框架，全栈开发
- **VueUse** - Vue 组合式工具集
- **Vue DevTools** - 浏览器调试工具
- **Pinia Plugin** - 持久化、日志等插件
- **微前端** - qiankun、single-spa
- **移动端开发** - Vant、Ionic Vue
- **桌面应用** - Electron + Vue、Tauri + Vue

Vue 3 是一个成熟、优雅的前端框架，学习曲线友好，生态完善。Composition API 让代码组织更灵活，\<script setup\> 让开发更高效。无论是个人项目还是企业应用，Vue 都是靠谱的选择。
