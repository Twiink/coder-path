# Nuxt.js 学习路线

Nuxt 是 Vue 的全栈框架——如果说 Vue 是组件库,Nuxt 就是把路由、SSR、状态、API、部署全打包的"精装房"。核心是三大件:**Vue 3(组件)+ Vite(构建)+ Nitro(服务端引擎)**,外加"约定大于配置"的目录结构与自动导入。熟悉 Vue 的人学 Nuxt,基本是零成本升级;从零学 Nuxt 也建议先过一遍 [Vue 学习路线](/learning-paths/frontend/vue)。**Nuxt 3 是当前版本**(Nuxt 2 已 EOL;Nuxt Bridge 是 2→3 的过渡工具,不必专门学)。

这条线按 **核心架构 → 目录与自动导入 → 路由与布局 → 数据获取与状态 → 服务端(Nitro)→ SEO → 样式与 UI → 认证与模块生态 → 性能 → 部署 → 测试** 推进。

## 第一站:核心架构与渲染模式

Nuxt 3 的架构一句话:Vue 3 + **Nitro**(自研服务端引擎,可部署到 Node/Serverless/边缘)+ Vite + 文件路由 + 自动导入。**渲染模式四选**(`nuxt.config.ts` 的 `ssr` 或路由级控制):

- **SSR(默认)**:请求时服务端渲染 HTML——SEO 好、首屏快;代价:每请求服务端渲染耗时。
- **SSG/静态**:`nuxi generate` 构建期生成全站静态 HTML(配 `routeRules` 的 prerender),部署到任何静态托管。
- **CSR/SPA**:`ssr: false`,纯客户端渲染(内部工具类站点)。
- **混合(hybrid)**:Nuxt 3 的杀手锏——**`routeRules`** 按路径模式配不同行为:`{ '/': { prerender: true }, '/products/**': { swr: 3600 }, '/admin/**': { ssr: false }, '/old': { redirect: '/new' } }`——同一应用里静态页、SWR 页、SPA 页共存,还有 `isr`(增量静态再生)与 `swr`(stale-while-revalidate)两种缓存语义、`headers`/`cors` 等;理解 routeRules = 理解 Nuxt 部署调优的一半。

**项目结构约定**(新项目长这样):`app.vue`(根组件,`<NuxtPage />` 出口)、`pages/`(路由)、`components/`(自动导入组件)、`composables/`(自动导入组合式函数)、`layouts/`(布局)、`server/`(服务端代码:api/middleware/routes/utils)、`public/`(静态资源原样服务)、`assets/`(走构建的资源)、`nuxt.config.ts`、`app.config.ts`(运行时公开配置)。**nuxi CLI**:`nuxi init`/`dev`/`build`/`generate`/`preview`/`upgrade`。

## 第二站:自动导入——少写一万个 import

Nuxt 最"爽"的特性:**目录约定 + 自动导入**。`components/` 下的组件自动注册(嵌套目录自动拼名:`components/base/Button.vue` → `<BaseButton />`;同名冲突用 `<BaseButton>` 显式?优先级按深度,有歧义时组件内用 `<Lazy>` 或改目录);**`Lazy` 前缀懒加载**(`<LazyBaseButton />` 按需加载,长页面性能手段);**`.client.vue` 后缀**(仅客户端渲染,避开 SSR 下 window 未定义的坑)与 **`.server.vue`**(仅服务端渲染,配合 `$fetch` 从客户端拿数据);`composables/` 下的 `useXxx` 自动导入(命名与默认导出都行);**Vue/Nuxt API 全自动导入**(ref/computed/watch/useFetch/navigateTo,`imports` 配置可扩展第三方库);`utils/` 目录工具函数也自动导入。代价是"隐式依赖"——新人看代码找不到 import 来源,用 Nuxt DevTools 或按住 Ctrl 跳转即可。

## 第三站:路由、布局与导航

**文件路由**:`pages/index.vue` → `/`,`pages/about.vue` → `/about`;动态路由 `[id].vue`、catch-all `[...slug].vue`(404 页用);嵌套路由=目录嵌套 + 子页面(父页面里放 `<NuxtPage />`);`pages/` 可配 `definePageMeta`(页面元信息:布局、中间件、标题、`validate` 校验参数);导航:`<NuxtLink>`(客户端导航 + **自动预加载**,`to` 支持对象/相对路径)、`navigateTo()`(编程式,服务端也能用,`redirect` 兼容)、`useRouter()`/`useRoute()`(`route.params`/`query`);**路由中间件**:`middleware/` 目录定义,`definePageMeta({ middleware: 'auth' })` 或全局配置使用——**登录鉴权与页面守卫的标准姿势**(函数内 `navigateTo('/login')` 拦截);中间件还能内联在页面 `definePageMeta` 里。**布局**:`layouts/default.vue`(默认,含 `<slot />`)、自定义布局 + `definePageMeta({ layout: 'custom' })`;`app.vue` 里也能用 `<NuxtLayout>` 手动控制。

## 第四站:数据获取与状态

**数据获取三件套**(Nuxt 的精华,SSR 下自动服务端取数 + 序列化传给客户端,无水合双请求):

- **`useFetch`**:`const { data, pending, error, refresh } = await useFetch('/api/users', { query: { page }, watch: [page] })`——封装 $fetch + 去重 + 响应式;选项:`key`(缓存键,多个同 URL 请求合并)、`lazy`(不阻塞导航,配 pending 显示)、`pick`/`transform`(只取需要的字段,减小载荷与响应式开销)、`server: false`(只在客户端取)、`watch`(响应式重取,参数变化的自动刷新)、`immediate`(先不取,手动 refresh)、`default`(初始值)。
- **`useAsyncData`**:不直接发请求时用——`useAsyncData('users', () => $fetch('/api/users'))`,包任意异步逻辑(数据库查询),key 手动给。
- **`$fetch`**(ofetch):通用请求工具,组件外/事件里用;`useLazyFetch`/`useLazyAsyncData` 是 `lazy: true` 的便捷版。
- **`refresh`/`refreshNuxtData`/`clearNuxtData`**:手动失效重取;`key` 是缓存与去重的基础(同名 key 同一次渲染只执行一次)。

**状态管理**:`useState<T>(key, init)`(Nuxt 内置 SSR 安全的全局状态——**SSR 下必须用它而不是模块级变量**(模块变量在服务端被所有请求共享,串数据!),同 key 在服务端渲染与客户端水合间自动同步);复杂状态用 **Pinia**(`@pinia/nuxt` 模块,store 定义在 `stores/`,自动导入,SSR 安全开箱即用);Vuex 是 Nuxt 2 时代方案,别用。

## 第五站:服务端与 Nitro

Nuxt 的"后端"在 `server/` 目录,由 **Nitro** 驱动:

- **API 路由**:`server/api/users.get.ts`(文件路由,**方法后缀 .get/.post/.put/.delete** 即 HTTP 方法)→ `/api/users`;handler:`export default defineEventHandler(async (event) => {...})`;读请求:`readBody(event)`(POST JSON/表单)、`getQuery(event)`、`getRouterParams(event)`(动态 `[id]`)、`getCookie`/`setCookie`、`readFormData`;返回:对象自动 JSON 化,`sendRedirect`/`createError`(`{ statusCode, statusMessage }` 配 `throw` 抛错,客户端能 catch);`server/routes/` 下放非 /api 前缀的端点。
- **服务端中间件**:`server/middleware/`(全局:token 校验、日志、CORS 头)、`server/utils/`(服务端工具,自动导入,如密码哈希函数——**别把密钥/数据库代码放客户端可达的地方**);`server/plugins/`(Nitro 生命周期)。
- **Nitro 特性**:开发热重载、**部署目标多**(node-server/vercel/netlify/cloudflare-workers/deno…… `nitro.preset` 或平台自动检测,同一套代码到处跑)、`routeRules` 的 API 缓存:`cachedEventHandler`(手动缓存,`maxAge`/`swr: true`)——高频接口的缓存答案;`defineCachedFunction` 缓存任意函数(数据库查询)。
- **环境变量/runtimeConfig**:`runtimeConfig: { apiSecret: '', public: { apiBase: '/api' } }`——`useRuntimeConfig()` 访问;`public` 下的暴露给客户端(`NUXT_PUBLIC_` 前缀可覆盖);**私密配置只在服务端读,别放 public**;.env 文件自动加载(dev 用 .env,部署用平台 env 注入)。

## 第六站:SEO 与元信息

**`useHead`**(组合式,组件/页面内动态设 title/meta/link,支持响应式参数与模板 `%s`);**`useSeoMeta`**(SEO 专用简化:title/description/og:title 等一次配齐,自动生成 og/twitter 标签);**`definePageMeta`**(静态页面元信息,还能配 `title` 模板);`app.head`(nuxt.config 全局默认);**结构化数据**:`useHead` 里插 JSON-LD script(script 数组 + type application/ld+json);**@nuxtjs/sitemap**(自动站点地图,配 i18n 多语言 URL);**@nuxtjs/i18n**(国际化:路由前缀、语言切换、useI18n、SEO hreflang——Nuxt 站出海标配);`useRequestHeaders`(SSR 时透传请求头,cookie 透传场景)。

## 第七站:样式与 UI

**CSS 能力**:`<style scoped>`(SFC 自带)、CSS Modules(`.module.css`)、**Tailwind**(`@nuxtjs/tailwindcss` 模块,零配置 + 内容自动扫描)、Sass(`npm i -D sass` 即用)、PostCSS(postcss.config)、`assets/css/` 全局样式 + `css: []` 配置;`useHead` 引外部字体。**UI 组件库**:Nuxt UI(官方,基于 Tailwind + Headless UI + icon,`<UButton>` 全家,配 `app.config.ts` 主题定制——Nuxt 项目现代首选)、Vuetify(模块 `nuxt-vuetify`)、Element Plus(企业后台,国内常用)、PrimeVue、Naive UI;**@nuxtjs/color-mode**(暗色模式:class/script 策略 + `useColorMode` 切换,配 Tailwind dark: 类用)。**@nuxt/image**:`<NuxtImg>`/`<NuxtPicture>` 自动优化(格式转换/尺寸/CDN provider 配置:ipx 自托管或 vercel/cloudinary 等)。**@nuxt/content**:`content/` 目录写 Markdown → 组件内 `queryContent()` 取(文档站/博客的官方方案,本站同款思路);**@nuxt/icon** 图标。

## 第八站:认证、模块与插件

**认证方案**:官方生态 @sidebase/nuxt-auth(NextAuth 风格:OAuth/凭据、`useAuth`、session 中间件保护)或 @nuxtjs/supabase(托管认证 + 数据库,小团队快车道);自建:middleware 守卫 + `useState` 存 session + server/api 里校验——注意 JWT 存 httpOnly cookie、密钥只在服务端。**模块机制**(Nuxt 的"插件系统"):`nuxt.config.ts` 的 `modules: ['@pinia/nuxt', ...]`;模块本质是"在 Nuxt 生命周期里改配置/加组件/加 API 的函数",自定义模块用 `defineNuxtModule` + `createResolver`/`addComponent`/`addImports`(写团队脚手架时用);**插件 plugins/**:`plugins/foo.client.ts`(仅客户端,`useNuxtApp().provide` 注入全局工具,`$myTool` 风格)、`.server.ts`(仅服务端);文件名数字前缀控制顺序(`1.xxx.ts`)。

## 第九站:性能与部署

**性能三板斧**:①routeRules(静态/ISR/SWR 缓存,见第一站);②组件与页面懒加载(Lazy 前缀、动态 import);③Nuxt DevTools(官方调试台:组件/状态/路由/性能面板,`nuxi devtools` 开启);配套:@nuxt/image 图片优化、NuxtLink 自动预加载、代码自动分割与 tree-shaking。**部署**:`nuxi build` 产物 `.output/`,按平台:Vercel(自动检测,`preset: 'vercel'`)、Netlify、Cloudflare Pages/Workers、Railway(容器)、自建 Node 服务器(`.output/server/index.mjs` + PM2 或 systemd,静态部分交给 Nginx/CDN)、纯静态用 `nuxi generate`(配 routeRules.prerender)。**测试**:Vitest + @nuxt/test-utils(组件测试 mountSuspended、页面测试、API 测试 `$fetch` 打本地 server)、Playwright E2E(完整用户流程)。**版本提醒**:Nuxt 3.x 仍在快速迭代(3.8→3.15+),升级看 release notes;Nuxt 4 在路上(目录结构调整),核心心智不变。

## Nuxt vs Next.js(一句话对照)

| 维度 | Nuxt | Next.js |
| --- | --- | --- |
| 底层 | Vue 3 | React |
| 学习曲线 | 平缓(自动导入多) | 中等(需理解 Server/Client 边界) |
| 数据获取 | useFetch/useAsyncData | RSC + fetch 缓存体系 |
| 服务端 | Nitro(多平台预设) | Route Handlers + Vercel |
| 生态 | Vue 生态 + 官方模块 | React 生态 + Vercel 全家 |

## 通关标准

能独立做到:用 Nuxt 3 从零搭一个带页面路由、布局、useFetch 取数、Pinia 状态、服务端 API、中间件鉴权的完整应用;配 routeRules 让首页静态、商品页 SWR、后台 SPA;说清 useState 为什么 SSR 安全而模块变量会串数据;会用 runtimeConfig 区分公开与私密配置;部署到至少一个平台并验证 SSR 与静态两种模式——Nuxt 主线通关。

Nuxt 是 Vue 开发者的最佳搭档:文件路由、自动导入、SSR、Nitro,要什么有什么,模块生态一装即用。如果你会 Vue,学 Nuxt 就是给武器库升级;如果你在 Vue 与 React 之间摇摆,Nuxt 的"少配置、多约定"会是让你生产力翻倍的那个选择。
