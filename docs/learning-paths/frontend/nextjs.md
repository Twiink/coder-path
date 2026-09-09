# Next.js 学习路线

Next.js 是 React 的**生产级全栈框架**:路由、SSR/SSG、API 路由、图片优化、字体优化、缓存体系,生产环境需要的东西全内置了。如果说 React 是工具箱,Next.js 就是精装房——开箱即用,专为生产优化。它是 Vercel 的拳头产品,也是当下 React 岗位的默认技能树。学它之前先把 React 本身学扎实([React 学习路线](/learning-paths/frontend/react)),这里只讲框架层的知识。

这条线按 **渲染模式 → App Router 路由体系 → 数据获取与缓存 → 数据变更(Server Actions)→ 样式与资源优化 → API 与后端能力 → 认证与数据库 → 性能与部署 → 测试与高级特性** 推进。

## 第一站:渲染模式——先建立大局观

Next.js 的核心价值是把"在哪里渲染"变成可选项,四种模式要门清:

- **SSG(静态生成)**:构建时生成 HTML,全球 CDN 缓存,性能最好——适合内容站、文档、博客(默认倾向)。
- **SSR(服务端渲染)**:每次请求在服务器生成 HTML——适合强 SEO + 个性化页面。
- **ISR(增量静态再生)**:SSG + 定时更新(`export const revalidate = 60` 或 `fetch(..., { next: { revalidate: 60 } })`),静态的速度 + 动态的新鲜度——电商商品页的经典解。
- **CSR(客户端渲染)**:`'use client'` + useEffect 取数,SPA 模式,SEO 弱,交互应用内局部使用。
- **PPR(Partial Prerendering,Next 14 实验/15 推进)**:同一页面"静态外壳 + 动态洞",SSG 与 SSR 的终极融合,方向性概念,关注即可。

**App Router vs Pages Router**:Pages Router(Next 12 及以前:pages/ 目录 + getServerSideProps/getStaticProps)稳定成熟但已是过去式;**App Router(Next 13+)是官方推荐与默认**,基于 **React Server Components**,本路线以 App Router 为主。老项目的 Pages Router 代码要能读懂(`getServerSideProps`/`getStaticProps`/`_app.js`/`_document.js` 那套),新项目一律 App Router。

## 第二站:路由体系——文件即路由

**App Router 约定**:`app/` 目录下,文件夹 = URL 段,特殊文件 = 路由能力:

- **`page.js`**:页面(必须有,否则 404);`layout.js`:布局(嵌套共享 UI,保留状态,**根布局必须存在**且含 `<html>`/`<body>`);`template.js`:类似 layout 但每次导航重新挂载(重置状态场景);`loading.js`:加载 UI(自动包 Suspense,配合流式渲染);`error.js`:错误边界(客户端组件,`'use client'` + error/reset 两个 props,配 `global-error.js` 兜根布局);`not-found.js`:404 页;`route.js`:API 端点(见第六站)。
- **动态路由**:`[id]`(单段)、`[...slug]`(catch-all 多段)、`[[...slug]]`(可选 catch-all);`generateStaticParams`(SSG 时枚举动态参数);**路由组 `(group)`**:仅组织不产生 URL(如 `(auth)/login`);**平行路由 `@slot`**:同层多个页面并存(复杂 dashboard,配 `default.js`);**拦截路由 `(.)photo`**:从别的路由"截胡"渲染(模态框内看照片,URL 却是独立页——分享链接与体验兼得)。
- **导航**:`<Link>`(客户端导航 + 自动预加载视口内链接)、`useRouter()`(`push`/`replace`/`refresh`(刷新服务端数据,不丢客户端状态))、`usePathname`/`useSearchParams`(读路径/查询;注意 useSearchParams 在 SSG 页要包 Suspense,否则构建警告)、服务端 `redirect()`/`notFound()`(抛异常式跳转/404)。
- **metadata(SEO)**:layout/page 导出 `metadata` 对象或 `generateMetadata`(动态页从数据生成标题描述);自动生成 `<title>`/OG 标签;`viewport`/`robots`/`sitemap.ts`/`icon` 等**元数据文件约定**。

## 第三站:Server Components 与数据获取

**Server Components(服务端组件)是 App Router 的灵魂**:组件默认在服务端渲染——可以直接 `async` + `await` 查数据库、读文件、调内部 API,**密钥安全**(服务端代码不进客户端包)、**客户端 JS 体积骤减**(组件只在服务端跑,不发浏览器)。**Client Components**:文件顶部 `'use client'` 标记(交互/Hooks/浏览器 API 用);**混合模型**:客户端组件可以嵌服务端组件(children 传下去),服务端组件不能直接 import 进客户端组件——"组件边界"是 App Router 最需要适应的心智,搞懂"哪些代码跑在哪"就赢了一半。`'use server'` 标记服务端函数(Server Actions)。

**数据缓存四层体系**(面试重灾区,要能背):①**Full Route Cache**:静态路由整页缓存(构建/ISR);②**Data Cache**:`fetch` 结果持久缓存(`cache: 'force-cache'` 默认 / `'no-store'` 跳过 / `next: { revalidate: 60 }` 定时 / `next: { tags: [...] }` 标签);③**Router Cache**:客户端导航的页面缓存(30 秒/交互失效,`router.refresh()` 手动刷);④**React Cache**:同一次渲染内请求去重(相同 fetch 只发一次;`cache()` 函数手动复用数据库查询)。**`unstable_cache`**(现名 `cache`)给数据库查询加类似 fetch 的缓存与 revalidate——纯数据库应用(无 fetch)想用 ISR 就靠它。**路由段配置**:`export const dynamic = 'force-dynamic'/'force-static'`、`revalidate`——页面级控制渲染行为。

## 第四站:数据变更——Server Actions 与表单

**Server Actions**(`'use server'` 标记的函数,Next 14 稳定):表单 `<form action={createUser}>` 直接调用服务端函数——**无 JS 也能提交**(渐进增强),服务端处理完调 `revalidatePath('/users')`(按路径刷新缓存)或 `revalidateTag('users')`(按标签批量失效),再 `redirect()` 回列表页——**"变更 → 重验证 → 跳转"**是标准三步曲。客户端调用 server action 也能(`startTransition` 包住,拿 pending 态)。配套 React 19 hooks:`useActionState`(表单状态机:pending/error/返回值回显)、`useOptimistic`(乐观更新列表)、`useFormStatus`(提交中禁用按钮)。**为什么不用传统 API + fetch 也行**:Route Handlers 仍在(见第六站),但同源变更(表单/按钮操作)用 Server Actions 更少样板;第三方回调/移动端才需要显式 API。

## 第五站:样式、字体与图片

**样式**:CSS Modules 默认支持(`xxx.module.css`)、全局 CSS(`app/globals.css`,只能在根布局引入)、**Tailwind 官方推荐**(脚手架可选,`@tailwindcss/postcss`)、Sass 内置(`.scss`)、CSS-in-JS(styled-components/Emotion 在 RSC 下要配 `use client` 注册表,较麻烦——**新项目优先 Tailwind 或 CSS Modules,少用运行时 CSS-in-JS**)。**字体 `next/font`**:自动自托管 Google Fonts(无第三方请求,GDPR 友好)、`next/font/google` 与 `next/font/local`;`variable` 变量字体 + CSS 变量注入——**消除 CLS(布局偏移)**的官方答案,配 Tailwind 的 font-sans 系列用。**图片 `next/image`**:`<Image>` 组件自动优化——resize/转 **WebP/AVIF**/懒加载(视口内自动)、`fill`(撑满父容器,配 `sizes` 响应式)、`priority`(首屏图禁用懒加载,配 LargestContentfulPaint 优化)、`placeholder="blur"`(模糊占位,`blurDataURL`);**remotePatterns** 配置允许的远程图片域名(安全),本地图片自动生成占位。**脚本 `next/script`**:`strategy`(afterInteractive 等)优化第三方脚本加载。

## 第六站:Route Handlers 与后端能力

**`route.js`**:导出 `GET`/`POST`/`PUT`/`PATCH`/`DELETE` 函数即成 API 端点(`app/api/users/route.js` → `/api/users`);用标准 **Web Request/Response API**(`request.json()`、`NextResponse.json()`);动态路由 `[id]` 的 handler 收 params;`export const dynamic = 'force-dynamic'` 防缓存;Streaming 响应(ReadableStream,SSE/AI 流式输出);**中间件 middleware.ts**(根目录):在**边缘网络**跑,请求到达页面/API 前执行——鉴权重定向(`matcher` 配置哪些路径)、国际化语言重定向、A/B 测试、请求头改写;注意 middleware 跑在 Edge 运行时,别用 Node API(数据库都别碰),重活放 route handler 或 server action。**认证方案**:NextAuth.js(Auth.js:OAuth/Email/Credentials、`getServerSession` 服务端读会话、`auth()` 新 API、中间件保护、JWT 或数据库 session)、Clerk(托管全功能)、Auth0(企业);自己写 session(JWT + httpOnly cookie)也行但别碰安全红线。**ORM/数据库**:Prisma(类型安全 + 迁移工具,生态最顺)、Drizzle(轻量 SQL 优先,性能好)、Kysely;数据库选型:PostgreSQL 首选(配 Supabase/Neon 托管)、MySQL、MongoDB;**注意**:服务端组件里直接 `await prisma.user.findMany()` 是官方姿势(不用再包 API 层,除非要复用给客户端)。

## 第七站:环境变量、性能与部署

**环境变量**:`.env.local`(本地,不提交);**`NEXT_PUBLIC_` 前缀的变量进浏览器**,其余只在服务端(Node/Edge);`NEXT_PUBLIC_` 是构建期内联的——**运行时改它不生效,要重新构建**;服务端读 `process.env` 任意时刻。**性能三板斧**:①next/image + next/font(见第五站);②`next/dynamic`(客户端组件动态导入,`ssr: false` 关服务端渲染——配第三方浏览器库);③`Suspense` 流式渲染(loading.js 自动;慢数据不阻塞整页,先发 HTML 再流式补);`@next/bundle-analyzer` 查包体积;React Compiler(Next 15 可开,自动记忆化,少写 useMemo)。**缓存策略总览**(部署后调优的主战场):静态优先,动态数据用 ISR 或 no-store,变更后 revalidatePath/Tag。**部署**:Vercel(零配置:git 推送自动部署、PR 预览、边缘网络、Serverless 自动扩缩——`output: 'standalone'` 也可自托管);自托管:`next start`(Node 服务器)或 Docker standalone 镜像(Node 20+,最小运行时);其他:Netlify/Cloudflare Pages/Railway;**监控**:Vercel Analytics/ Speed Insights(Web Vitals)、Sentry 错误追踪、Pino/Winston 日志。

## 第八站:测试、国际化与高级特性

**测试**:单测 Jest + React Testing Library 或 **Vitest**(Next 15 官方示例已支持);关键点:测客户端交互组件(Server Components 测试有限,逻辑下沉到纯函数/服务端函数测返回值);E2E **Playwright**(官方推荐,`next dev` + 真实浏览器走完整流程,`npx playwright test`);集成测试 Supertest 打 route handler。**国际化 i18n**:`next-intl`(推荐:路由前缀 /en /zh、`useTranslations`、服务端/客户端都支持)或自建;middleware 里按 cookie/header 重定向到语言路由。**微前端**:Module Federation(与 React 生态打通,大组织多团队用)。**版本差异速记**:Next 13(App Router 引入)→ 14(Server Actions 稳定)→ 15(异步请求 API:params/searchParams 变 Promise、`cookies()`/`headers()` 异步、缓存默认调整、Turbopack 默认 dev)——升级时看官方 codemod,别硬搬老写法。

## 通关标准

能独立做到:用 App Router + Server Components + Server Actions + Prisma 写一个带认证、CRUD、表单校验的完整全栈应用;说清四层缓存体系与"何时用 ISR/force-dynamic/revalidate";能解释 Server vs Client 组件边界与"为什么默认服务端";配好 next/image/next/font 并说出它们分别消除了什么性能问题(LCP/CLS);部署到 Vercel 并配好环境变量与监控——Next.js 主线通关。

Next.js 就是 React 的"最佳实践集合":路由、渲染、数据、优化全给你定好了标准答案。学会它,你就掌握了现代 React 全栈开发的默认姿势;配合 Vercel,从开发到上线一气呵成。但也记住:框架替你做的越多,你越要理解它替你做了什么——缓存四层和渲染模式,就是 Next.js 工程师的"内功心法"。
