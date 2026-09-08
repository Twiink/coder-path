# Nuxt.js 学习路线

Nuxt.js 是 Vue 的全栈框架，Next.js 的 Vue 版本。服务端渲染、静态生成、文件路由、自动导入，Vue 开发者的生产力工具。如果你熟悉 Vue，学 Nuxt 就是给 Vue 加了全家桶，开箱即用。

## 基础篇：核心概念

### 渲染模式
- SSR（Server-Side Rendering）：服务端渲染，每次请求生成 HTML
- SSG（Static Site Generation）：静态生成，构建时生成所有页面
- CSR（Client-Side Rendering）：客户端渲染，SPA 模式
- 混合模式：路由级别选择渲染方式

### Nuxt 3 vs Nuxt 2
- Nuxt 3：Vue 3、Vite、Nitro 引擎
- 性能提升：更快的冷启动、更小的包体积
- TypeScript：原生支持
- Composition API：优先支持
- 这份路线以 Nuxt 3 为主

### 项目结构
- pages/：文件路由
- components/：自动导入组件
- composables/：自动导入组合式函数
- layouts/：布局文件
- server/：服务端 API
- public/：静态资源
- app.vue：根组件

## 基础篇：路由系统

### 文件路由
- 自动路由：pages/ 目录结构即路由
- 动态路由：[id].vue、[...slug].vue
- 嵌套路由：目录嵌套 + \<NuxtPage\>
- 命名视图：不支持（用嵌套路由代替）

### 导航
- NuxtLink：客户端导航、预加载
- navigateTo：编程式导航
- useRouter：路由实例
- useRoute：当前路由信息

### 布局
- layouts/default.vue：默认布局
- 自定义布局：layouts/custom.vue
- 页面指定布局：definePageMeta({ layout: 'custom' })
- NuxtLayout：布局组件

## 基础篇：数据获取

### 数据获取函数
- useFetch：封装的 fetch，自动请求去重
- useAsyncData：通用异步数据获取
- useLazyFetch、useLazyAsyncData：懒加载版本
- $fetch：Nuxt 封装的 fetch 工具

### 数据缓存
- key：缓存键
- server：是否服务端执行
- lazy：是否懒加载
- pick：选择返回字段
- transform：转换数据

### 状态管理
- useState：跨组件共享状态
- Pinia：官方推荐状态管理
- Vuex：Nuxt 2 方案（不推荐）

## 进阶篇：自动导入

### 组件自动导入
- components/ 目录：自动注册
- 嵌套目录：组件名包含路径
- 懒加载：Lazy 前缀
- 客户端组件：.client.vue 后缀
- 服务端组件：.server.vue 后缀

### Composables 自动导入
- composables/ 目录：自动导入
- 命名导出：export function useFoo()
- 默认导出：export default function()
- 工具函数：自动导入

### API 自动导入
- Vue API：ref、computed、watch 等
- Nuxt API：navigateTo、useFetch 等
- 第三方库：配置 imports

## 进阶篇：服务端功能

### API 路由
- server/api/：API 端点
- 文件路由：server/api/users.get.ts
- HTTP 方法：.get、.post、.put、.delete
- 动态路由：[id].ts
- 中间件：defineEventHandler

### 服务端中间件
- server/middleware/：全局中间件
- 认证检查：token 验证
- 日志记录
- 错误处理

### Nitro 引擎
- 服务端引擎：高性能、跨平台
- 输出目标：Node.js、Workers、Lambda
- 热重载：开发模式
- 缓存：路由缓存、响应缓存

## 进阶篇：模块生态

### 官方模块
- @nuxt/content：内容管理、Markdown
- @nuxt/image：图片优化
- @nuxtjs/i18n：国际化
- @pinia/nuxt：状态管理
- @nuxtjs/tailwindcss：Tailwind 集成

### 社区模块
- @nuxtjs/color-mode：暗色模式
- @vueuse/nuxt：VueUse 集成
- nuxt-icon：图标组件
- @nuxtjs/sitemap：站点地图

### 模块配置
- nuxt.config.ts：modules 数组
- 模块选项：模块级配置
- 自定义模块：createResolver、addComponent

## 进阶篇：插件系统

### 插件定义
- plugins/ 目录：自动注册
- 命名约定：.client、.server
- 插件顺序：文件名数字前缀
- 提供注入：provide、inject

### 常见用途
- 全局组件注册
- Vue 指令
- Pinia store
- 第三方库集成

## 进阶篇：SEO 优化

### Meta 标签
- useHead：动态 meta
- useSeoMeta：SEO meta 简化
- definePageMeta：页面级 meta
- app.head：全局配置

### Sitemap
- @nuxtjs/sitemap：自动生成
- 动态路由：配置 URLs
- 多语言：i18n 集成

### Open Graph
- og:title、og:image
- Twitter Cards
- 结构化数据：JSON-LD

## 实战篇：样式方案

### CSS 支持
- CSS Modules：自动支持
- Scoped CSS：\<style scoped\>
- Tailwind CSS：@nuxtjs/tailwindcss
- Sass/SCSS：自动检测
- PostCSS：postcss.config.js

### UI 组件库
- Vuetify：Material Design
- Element Plus：企业级
- PrimeVue：丰富组件
- Naive UI：TypeScript 友好

## 实战篇：认证与权限

### 认证方案
- @sidebase/nuxt-auth：NextAuth 风格
- @nuxtjs/supabase：Supabase 集成
- 自定义方案：JWT、Session

### 路由守卫
- middleware/：全局中间件
- definePageMeta：页面中间件
- 认证检查：重定向

## 实战篇：性能优化

### 自动优化
- 代码分割：路由级自动分割
- Tree Shaking：自动移除死代码
- 预加载：NuxtLink 自动预加载
- 图片优化：@nuxt/image

### 缓存策略
- 路由缓存：routeRules
- API 缓存：cachedEventHandler
- 静态资源：强缓存
- CDN：部署平台支持

### 性能分析
- Nuxt DevTools：性能面板
- Lighthouse：性能评分
- Bundle Analyzer：包体积分析

## 实战篇：部署上线

### 部署平台
- Vercel：零配置
- Netlify：自动检测
- Cloudflare Pages：边缘部署
- Railway：容器部署
- 自建服务器：PM2、Docker

### 输出模式
- Node.js：服务端渲染
- Static：静态生成
- Hybrid：混合模式
- Workers：边缘函数

### 环境变量
- .env 文件：开发环境
- runtimeConfig：运行时配置
- public：客户端暴露
- 服务端私密：不暴露

## 实战篇：测试

### 单元测试
- Vitest：官方推荐
- @nuxt/test-utils：测试工具
- 组件测试：@vue/test-utils

### E2E 测试
- Playwright：官方推荐
- Cypress：流行选择

## 下一步学习

掌握 Nuxt 后，继续探索：

- **Nuxt Modules** - 探索官方和社区模块
- **Nitro** - 深入服务端引擎
- **UnJS** - Nuxt 底层工具库
- **Nuxt DevTools** - 开发者工具
- **Nuxt Bridge** - Nuxt 2 到 3 迁移

## Nuxt vs Next.js

| 维度 | Nuxt | Next.js |
|------|------|---------|
| 基础框架 | Vue | React |
| 学习曲线 | 平缓 | 中等 |
| 自动导入 | 是 | 否 |
| 文件路由 | 简单 | 复杂（App Router） |
| 模块生态 | Vue 生态 | React 生态 |

Nuxt.js 是 Vue 开发者的最佳搭档。文件路由、自动导入、服务端渲染，Vue 项目需要的功能全都内置。配合丰富的模块生态，从博客到企业应用都能快速搭建。如果你会 Vue，学 Nuxt 就是给自己升级装备，开发效率直接翻倍。
