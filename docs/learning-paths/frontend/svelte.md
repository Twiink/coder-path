# Svelte 学习路线

Svelte 是前端框架里的"编译派":React、Vue 在浏览器里跑一个庞大的运行时(虚拟 DOM、协调器),Svelte 选择在**构建时把组件编译成高效的原生 JavaScript**,运行时几乎没有框架开销——没有虚拟 DOM、没有 diff、没有 Hooks 依赖数组。写起来像"带增强的 HTML",性能却逼近手写原生,是真正的"写得少、跑得快"。代价是它的心智与其他框架都不同,别拿 React/Vue 的习惯硬套。

这条线按 **响应式基础 → 组件与模板 → 事件与交互 → 生命周期与 Store → 过渡动画与 Actions → 特殊元素与 Context → SvelteKit 全栈 → TypeScript 与生态** 推进,最后讲 Svelte 5 的 runes 新时代。

## 第一站:响应式基础——编译器帮你变魔术

Svelte 的组件是 `.svelte` 单文件:`&lt;script&gt;`(逻辑)+ `&lt;style&gt;`(样式,**自动作用域**:编译期给选择器加类名,天然隔离,不用操心命名冲突)+ markup(模板)。**响应式靠"赋值"触发**:`let count = 0`,`count += 1` 后用到它的 DOM 自动更新——不需要 setState、不需要 ref.value,**普通变量就是响应式的**。原理:编译器在构建时分析"哪些变量被模板/语句读取",赋值处自动插入更新代码,这是"编译器框架"与"运行时框架"的分水岭。

三条规则要牢记:①**数组/对象的变异方法不触发更新**(`arr.push(x)` 无效),必须重新赋值(`arr = [...arr, x]` 或 `arr.push(x); arr = arr`——推荐前者);②**响应式声明 `$:`**(标签语句,编译器魔法):`$: doubled = count * 2` 声明派生值(自动追踪依赖,count 变 doubled 自动重算,对应 Vue 的 computed);`$: console.log(count)` 是响应式语句(副作用,依赖变化自动跑);还能 `$: &#123; ... &#125;` 多行块、`$: if (x) ...` 条件语句;**③`$:` 的依赖是编译期静态分析的**,把依赖藏进函数体/间接引用会失效,要直接写在语句里。

Svelte 5 开始引入 **runes(符文)** 新语法:`$state`/`$derived`/`$effect`/`$props` 显式声明响应式(替代 let + $: 的魔法),`$state` 还支持类与深层响应式(类似 Vue reactive);runes 让响应式能逃出组件(进 .svelte.ts 模块),Svelte 5 已默认推荐 runes,新项目直接学 runes,旧 `$:` 语法认识即可(自动迁移工具 svelte-migrate 可转)。

## 第二站:组件与模板

**组件通信**:Props 用 `export let name = '默认值'` 声明(export 是 Svelte 的"接口约定":导出变量即接收外部传入;`export let` 支持默认值、rest props(`$$restProps` 透传)、`$$props` 拿全部);**双向绑定 `bind:`**:`bind:value`(input)、`bind:checked`、`bind:group`(radio/checkbox 组)、`bind:this`(拿 DOM/组件实例)、`bind:clientWidth`/`bind:scrollY` 等一堆可绑定属性(尺寸滚动响应式,不用自己监听);组件上 `bind:prop` 实现"子组件 prop 双向"(对应 Vue defineModel);子传父事件用 `createEventDispatcher`(`dispatch('save', data)`,父 `on:save=&#123;handler&#125;`)。

**模板语法**:插值 `&#123;expr&#125;`;`&#123;@html content&#125;` 渲染 HTML(**XSS 风险,用户输入别用**);条件 (&#123;#if&#125;...&#123;:else if&#125;...&#123;:else&#125;...&#123;/if&#125;);列表 **`&#123;#each items as item, i (item.id)&#125;`**——`(key)` 是可选但重要的身份标识(对应 React key,列表重排必须);`&#123;#each&#125;` 还能 (&#123;:else&#125;) 空态;**`&#123;#await promise&#125;`**(原生处理异步:三个块 (&#123;:then data&#125;)/(&#123;:catch err&#125;),还能 `&#123;#await promise then data&#125;` 跳过 pending——模板层处理 Promise,对应 Vue Suspense 的局部版);`&#123;@debug var&#125;`(断点调试,变量变化自动 debugger);`&#123;@const&#125;`(块内定义局部常量)。

**事件**:`on:click=&#123;handler&#125;`;修饰符链式:`on:click|preventDefault|stopPropagation`(还有 once/capture/self/trusted,`|` 语法是 Svelte 特色);**事件转发**:组件内部 `on:click` 不写处理函数即可"透传"给父组件(`<button on:click>…` 内部节点事件自动冒泡出组件边界——省掉 dispatch 样板);键盘事件 `on:keydown`;Svelte 5 里事件改 `onclick` 属性式(与 runes 配套,老 `on:` 语法迁移中)。

## 第三站:生命周期与 Store

**生命周期钩子**(都只能在组件初始化时调用):`onMount(cb)`(挂载后,返回清理函数自动在销毁时跑——订阅/定时器的主场)、`onDestroy(cb)`(销毁前清理)、`beforeUpdate`/`afterUpdate`(DOM 更新前后;afterUpdate 里做"依赖更新后 DOM 的测量")、**`tick()`**(等待所有待处理的 DOM 更新完成,返回 Promise——改完数据立刻量 DOM 高度为 0 时的答案;它不只在组件内可用)。Svelte 5 的 `$effect` 统一了这些(自动追踪依赖 + 返回清理函数)。

**Store(跨组件状态)**:`writable(初始值)`(可读写,含 `update` 函数式更新与 `subscribe`/`set`)、`readable`(只读:数据源在 store 内部管理,如系统时间/在线状态)、**`derived(a, fn)`**(依赖其他 store 派生);使用三姿势:①**`$store` 自动订阅语法糖**(组件/`.svelte` 文件里 `$count` 自动订阅与写入,离开组件自动退订——最常用);②`store.subscribe(fn)` 手动(返回退订函数);③模板里直接 `&#123;$store&#125;`。
**自定义 store**:任何带 `subscribe` 方法的对象都是 store——封装计数器的 `&#123; subscribe, increment &#125;` 这种"最小公开 API";store 能放组件外(.js 文件),所以它是 Svelte 的全局状态方案(比 Context 更"全局");模块作用域里 `$` 语法不可用,要手动 subscribe 或 `get(store)` 读一次。
**Context API**(`setContext(key, value)`/`getContext(key)`)用于组件树内传值(非全局),**不响应式**——传 store 或 writable 进去就响应式了;`hasContext` 判断。Svelte 5 里 `$state` 共享 + 模块导出也成了新常态。

## 第四站:过渡、动画与 Actions

**过渡指令**(元素进出场):`transition:fade`、(transition:fly=&#123;&#123; y: 200, duration: 500 &#125;&#125;)、`transition:slide`/`scale`/`blur`/`draw`/自定义;方向分开写 `in:`/`out:`(进出一套、单进 `in:fly` 只进场);`transition:` 双向都管;参数对象(延迟/时长/缓动)与事件 `introstart`/`introend`/`outrostart`/`outroend`;条件块 `&#123;#if show&#125;` + transition 就有进出场(不用包一层 Transition 组件——Svelte 又少一层心智);**`animate:flip`**(列表重排动画:元素移动平滑过渡,`&#123;#each&#125;` + `animate:flip` 两行搞定排序动画,对应 Vue TransitionGroup 的 v-move);**motion store**:`tweened`(数值补间,(tweened(0, &#123; duration: 400 &#125;)))与 `spring`(物理弹性,(spring(&#123; x: 0, y: 0 &#125;)))——数字滚动、拖拽跟手的标配;自定义过渡:CSS 类方案或 JS 过渡函数(返回 tick 回调)。
**Actions(动作)**:`use:action` 是"元素级指令"(对应 Vue 自定义指令):`use:tooltip`、`use:clickOutside`、`use:lazyload`;action 函数接收元素与参数,返回带 `update`(参数变)/`destroy`(元素移除)的生命周期对象——DOM 行为的复用单元,是 Svelte 最优雅的设计之一。

## 第五站:特殊元素

`<svelte:self>`(递归组件:树形菜单直接 `<svelte:self>` 引用自己);`<svelte:component this=&#123;which&#125; />`(动态组件);`<svelte:window on:keydown=&#123;...&#125; bind:scrollY />`(窗口事件与绑定,不用手动 addEventListener/remove);`<svelte:body>`/`<svelte:document>`(body/document 级事件);`<svelte:head>`(往 head 里放 title/meta——SEO 与动态标题);`<svelte:options>`(编译器选项:immutable 承诺、customElement 自定义元素模式——**用 Svelte 写 Web Component**);`<svelte:fragment>`(插槽片段);Svelte 5 新增 `<svelte:boundary>`(错误边界,配合 `$state` 错误捕获,替代手写 try/catch 渲染降级)。
**插槽 slot**:`<slot />` 默认、`<slot name="header">` 具名、**slot props**(`<slot &#123;item&#125;>` 让父组件拿到数据,`let:item` 接收——作用域插槽三件套);`$$slots` 检查某插槽是否被传入(条件渲染插槽外壳)。

## 第六站:SvelteKit——全栈框架

Svelte 的官方应用框架(类比 Next.js/Nuxt),**文件路由**:`src/routes/` 目录即路由——`+page.svelte`(页面)、`+layout.svelte`(布局,可嵌套,`<slot />` 渲染子页)、`+error.svelte`(错误页,`$page.error`)、`+server.js/ts`(API 端点:导出 GET/POST 处理函数,纯后端路由)、`+page.js`(页面数据加载);动态路由 `[slug]`、**rest 参数 `[...rest]`**、**路由组 `(group)`**(不影响 URL 的组织方式,如 `(auth)/login`)、可选参数 `[[optional]]`、路由匹配器(自定义 param 校验)。
**数据加载 load**:`+page.js` 导出 `load(&#123; params, fetch, url &#125;)` 返回 `&#123; props &#125;`(页面渲染前取数);`+page.server.js` 的 load 只在服务端跑(能直接查数据库/碰密钥,不会进客户端包);**同构 load 与流式传输**:`defer` + `<SvelteComponent await>` 让慢数据流式到达(首屏不等慢接口);`load` 里 `parent()` 拿父布局数据。
**表单 actions**:`+page.server.js` 导出 `actions`(`default`/命名 action),`<form method="POST" action="?/actionName">` 原生提交即触发(无 JS 也能跑!);**`use:enhance`** 渐进增强:有 JS 时变 AJAX 提交、自动处理失效与反馈(禁用按钮/显示错误),无 JS 时退回原生表单——"渐进增强"的教科书实现;错误返回 `fail(400, &#123; errors &#125;)` + `$page.form` 读回显。
**适配器**:`@sveltejs/adapter-node`(自托管 Node)/`adapter-vercel`/`adapter-netlify`/`adapter-static`(纯静态输出,SSG);**渲染模式**:默认 SSR(每个请求服务端渲染)+ 客户端水合;页面级 `export const ssr = false`(纯 SPA);`export const prerender = true`(构建期静态生成);`export const csr` 开关;`load` 的 `ssr`/`csr` 组合出四象限(静态/SSR/SPA/混合)。
其他内置:环境变量 `$env`(区分公开/私有/动态,密钥安全)、`$app/state`、Hooks(`hooks.server.js` 的 handle 做鉴权中间件)、错误处理 `throw error()`/`redirect()` 辅助函数、`fetch` 直通服务端、图片优化(未内置,接第三方)。

## 第七站:TypeScript 与性能

**TS 集成**:`<script lang="ts">`;props:(interface Props &#123; name: string; count?: number &#125;) + `export let name: Props['name']`(或 Svelte 5 的 `let &#123; name &#125;: Props = $props()`);`$$Generic`(泛型组件:`<script lang="ts" generics="T extends Item">`);事件类型 (createEventDispatcher<&#123; save: User &#125;>());store 泛型 `writable<User | null>(null)`;`.svelte.ts` 模块文件(Svelte 5,响应式逻辑出组件)。
**性能哲学**:没有虚拟 DOM → 没有 diff 开销、没有协调器;更新是**编译期生成的精准 DOM 操作**(哪个绑定变了改哪);组件样式自动作用域;**tree-shaking 彻底**(没用的代码编译期就没了,产物以 KB 计);路由级自动代码分割(SvelteKit);最佳实践:`$:`/`$derived` 只声明真需要派生的;避免把大对象整个重新赋值(用 store update 局部改);`immutable` 编译器选项承诺不可变后跳过检查;懒加载动态 `import()` 大组件;虚拟列表(svelte-virtual-list / svelte-tiny-virtual-list)。
对比记忆:React 的"每次渲染重跑组件函数 + diff"、Vue 的"运行时响应式 + 编译优化",Svelte 是"编译期全静态分析,运行时最小化"——三者面试常被放在一起问。

## 第八站:生态与学习路径

**工具**:Vite(官方构建,Svelte 插件)、**SvelteKit**(应用框架,见第六站)、Svelte for VS Code(官方插件,`.svelte` 高亮/提示/格式化)、svelte-check(类型检查 CLI)、浏览器 DevTools 靠原生 DOM 检查即可(Svelte 组件编译后就是普通 DOM,调试反而最直接)。
**UI 库**(生态比 React/Vue 小,但够用):Skeleton(官方推荐的 Tailwind 系工具包,组件 + 主题系统)、shadcn-svelte(shadcn 移植,人气高)、Flowbite Svelte、Carbon Components Svelte(IBM 企业风)、Melt UI(无头组件库,类似 Radix)、Pico.css(轻量)。
**工具库**:svelte-dnd-action(拖拽)、svelte-i18n(国际化)、mode-watcher(暗色模式)、pocketbase/supabase 集成(全栈快车道)。**移动端**:Svelte Native(实验性)、或 Tauri + Svelte 做桌面(轻量组合很流行)。
**Svelte 5 迁移要点**:runes 模式、`on:` → `onclick` 属性、`$:` → `$derived`/`$effect`、事件转发 → 回调 props、`svelte:migrate` 自动迁移工具。

## 通关标准

能独立做到:用 Svelte 5(runes)+ SvelteKit 写一个带表单 action、鉴权、SSR 的完整应用;讲清"为什么 Svelte 没有虚拟 DOM 也很快"(编译期依赖分析 + 精准 DOM 更新);能说出 `$:`/`$derived`、writable/readable/derived store、`bind:` 各自解决什么;会写自定义 action 与过渡;理解 SvelteKit 的 load/actions/适配器三种机制如何配合——Svelte 主线通关。

Svelte 的设计哲学是"少即是多":没有虚拟 DOM、没有 Hooks 规则、没有繁琐的 API,写起来最接近原生 Web。它在 2020 年拿下"最受喜爱前端框架"不是偶然——如果你被 React/Vue 的仪式感磨累了,或者要做极致轻量的页面/组件库,试试 Svelte,你会发现前端可以这么简单。
