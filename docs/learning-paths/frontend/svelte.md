# Svelte 学习路线

Svelte 是前端框架中的"编译系的新秀"。和 React、Vue 不同，Svelte 在构建时就把代码编译成高效的原生 JavaScript，运行时没有虚拟 DOM 的开销。写起来简洁优雅，性能还特别好，是真正的"写得少，跑得快"。

## 基础篇：核心概念

### 响应式基础
- 响应式赋值：直接赋值就能触发更新
- 响应式声明：$: 标记自动响应依赖变化
- 响应式语句：$: console.log()
- 数组和对象更新：赋值触发，push/splice 不触发

### 组件基础
- 单文件组件：.svelte 文件
- script、style、markup 三段式结构
- Props：export let 声明
- 事件：on:click、事件修饰符
- 双向绑定：bind:value
- 插槽：\<slot\>、具名插槽、插槽 props

### 模板语法
- 插值：{expression}
- HTML 插值：{@html content}
- 条件渲染：{#if}、{:else if}、{:else}、{/if}
- 列表渲染：{#each items as item}、key 指定
- await 块：{#await promise}、异步数据渲染
- 调试：{@debug variable}

### 事件处理
- 事件绑定：on:eventname
- 事件修饰符：preventDefault、stopPropagation、once、capture
- 组件事件：createEventDispatcher
- 事件转发：on:click
- DOM 事件：鼠标、键盘、表单

## 进阶篇：高级特性

### 生命周期
- onMount：组件挂载后
- onDestroy：组件销毁前
- beforeUpdate：更新前
- afterUpdate：更新后
- tick()：等待 DOM 更新完成

### Store（状态管理）
- writable：可读写 store
- readable：只读 store
- derived：派生 store
- 自动订阅：$store 语法糖
- 自定义 store：subscribe 方法

### 动画与过渡
- transition：内置过渡指令
- 过渡事件：introstart、outroend
- 自定义过渡：CSS、JavaScript
- animate：flip 动画
- motion：tweened、spring

### 动作（Actions）
- use:action：元素级别的指令
- 参数传递：use:action={param}
- 生命周期：mount、update、destroy
- 常见用途：工具提示、点击外部、拖拽

### 特殊元素
- \<svelte:self\>：递归组件
- \<svelte:component\>：动态组件
- \<svelte:window\>：窗口事件
- \<svelte:body\>、\<svelte:head\>、\<svelte:document\>
- \<svelte:options\>：编译器选项

### Context API
- setContext：设置上下文
- getContext：获取上下文
- 跨组件传递数据
- 不响应式：需要配合 store

## 进阶篇：SvelteKit

### 项目结构
- src/routes：文件路由
- +page.svelte：页面组件
- +layout.svelte：布局组件
- +server.js：API 端点
- +error.svelte：错误页面

### 路由系统
- 文件路由：目录结构即路由
- 动态路由：[slug]、[...rest]
- 嵌套路由：嵌套目录
- 路由组：(group) 不影响 URL
- 高级路由：匹配器、可选参数

### 数据加载
- load 函数：+page.js、+layout.js
- 服务端数据：fetch、数据库查询
- 通用 load：同构代码
- 流式传输：streaming、defer

### 表单处理
- 表单操作：form actions
- 渐进增强：use:enhance
- 表单验证：服务端验证
- 文件上传

### SSR 与 SSG
- 服务端渲染：默认行为
- 客户端渲染：ssr: false
- 预渲染：prerender = true
- 适配器：Node、Vercel、Netlify、静态

## 实战篇：性能与优化

### 编译优化
- 编译时处理：无运行时框架
- 自动作用域样式：组件级 CSS
- 自动代码分割：路由级
- Tree-shaking：未使用代码自动移除

### 性能最佳实践
- 避免不必要的响应式：let vs const
- 使用 immutable：数组、对象更新
- 懒加载：动态 import
- 虚拟列表：svelte-virtual-list

## 实战篇：工具与生态

### 开发工具
- Vite：官方推荐构建工具
- SvelteKit：全栈框架
- Svelte for VS Code：官方插件
- Svelte DevTools：浏览器调试

### UI 组件库
- Svelte Material UI：Material Design
- Carbon Components Svelte：IBM Carbon
- Flowbite Svelte：Tailwind 组件
- Skeleton：UI 工具包

### 工具库
- svelte-dnd-action：拖拽
- svelte-i18n：国际化
- svelte-spa-router：SPA 路由（非 SvelteKit）

## 实战篇：TypeScript 集成

### 类型支持
- \<script lang="ts"\>：启用 TypeScript
- Props 类型：interface、type
- 事件类型：ComponentEvents
- 泛型组件：$$Generic

## 下一步学习

掌握 Svelte 后，继续探索：

- **SvelteKit** - 全栈框架、SSR/SSG
- **Svelte Native** - 用 Svelte 开发移动应用
- **Svelte 组件库** - Svelte Material UI、Carbon Components
- **动画深入** - motion、transition 高级用法

Svelte 的设计哲学就是"少即是多"。没有虚拟 DOM、没有复杂的 Hooks、没有繁琐的 API，就是最接近原生 JavaScript 的写法。编译时优化让它既快又小，非常适合对性能有要求的项目。学完 Svelte，你会发现前端开发原来可以这么简单。
