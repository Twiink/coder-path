# Next.js 学习路线

Next.js 是 React 的生产级全栈框架。服务端渲染、静态生成、API 路由、文件路由、图片优化，该有的都有。如果说 React 是工具箱，Next.js 就是全装修的精装房，开箱即用，专为生产环境优化。

## 基础篇：核心概念

### 渲染模式
- SSG（Static Site Generation）：构建时生成 HTML，性能最好
- SSR（Server-Side Rendering）：请求时生成 HTML，SEO 友好
- ISR（Incremental Static Regeneration）：增量静态生成，定时更新
- CSR（Client-Side Rendering）：客户端渲染，SPA 模式

### App Router vs Pages Router
- App Router：Next.js 13+ 推荐，React Server Components
- Pages Router：传统方式，稳定成熟
- 这份路线以 App Router 为主

### 项目结构
- app/ 目录：App Router 根目录
- page.js：页面文件
- layout.js：布局文件
- loading.js：加载状态
- error.js：错误处理
- not-found.js：404 页面

## 基础篇：路由系统

### 文件路由
- 文件夹 = 路由段：app/about/page.js → /about
- 嵌套路由：app/blog/[slug]/page.js
- 动态路由：[id]、[...slug]、[[...slug]]
- 路由组：(group) 不影响 URL
- 平行路由：@folder、多个插槽
- 拦截路由：(..)、模态框

### 导航
- Link 组件：客户端导航、预加载
- useRouter：编程式导航
- redirect：服务端重定向
- usePathname：获取当前路径
- useSearchParams：查询参数

### 布局
- 根布局：app/layout.js，必需
- 嵌套布局：共享 UI
- 模板：template.js，每次重新挂载
- metadata：SEO 元数据

## 进阶篇：数据获取

### Server Components
- 默认服务端组件：async/await 直接获取数据
- 数据库查询：直接访问数据库
- API 调用：fetch、缓存控制
- 性能优势：减少客户端 JavaScript

### Client Components
- 'use client'：标记客户端组件
- 使用场景：交互、Hooks、浏览器 API
- 混合使用：服务端 + 客户端组件树

### 数据缓存
- fetch 缓存：cache: 'force-cache' | 'no-store'
- revalidate：定时重新验证
- 路由段配置：dynamic、revalidate
- unstable_cache：React Cache API

### 数据变更
- Server Actions：'use server'
- 表单处理：action 属性
- revalidatePath：重新验证路径
- revalidateTag：按标签重新验证

## 进阶篇：样式方案

### CSS 支持
- CSS Modules：默认支持
- Global CSS：app/globals.css
- Tailwind CSS：官方推荐
- CSS-in-JS：styled-components、Emotion（需配置）
- Sass：内置支持

### 字体优化
- next/font：字体优化
- Google Fonts：自动托管
- 本地字体：性能优化
- 变量字体：CSS 变量

## 进阶篇：图片与资源

### Image 组件
- next/image：自动优化
- 响应式：sizes、fill
- 懒加载：默认启用
- 占位符：blur、empty
- 优先加载：priority
- 格式转换：自动 WebP/AVIF

### 静态资源
- public 目录：直接访问
- 导入资源：import、URL
- 元数据文件：icon、favicon、sitemap

## 进阶篇：API 路由

### Route Handlers
- route.js：定义 API 端点
- HTTP 方法：GET、POST、PUT、DELETE
- 请求对象：Request API
- 响应：NextResponse
- 中间件：认证、CORS

### 服务端逻辑
- Server Actions：表单处理、数据变更
- 数据库操作：Prisma、Drizzle
- 认证：NextAuth.js
- 文件上传

## 进阶篇：性能优化

### 自动优化
- 代码分割：自动按路由分割
- 预加载：Link 组件自动预加载
- 图片优化：next/image
- 字体优化：next/font
- Script 优化：next/script

### 缓存策略
- Full Route Cache：完整路由缓存
- Router Cache：客户端路由缓存
- Data Cache：fetch 数据缓存
- React Cache：请求去重

### 性能分析
- @next/bundle-analyzer：包体积分析
- next/dynamic：动态导入、懒加载
- Suspense：流式渲染
- React DevTools Profiler

## 实战篇：身份认证

### NextAuth.js
- 多种认证方式：OAuth、Email、Credentials
- Session 管理：JWT、Database
- 中间件保护：matcher
- API 路由保护：getServerSession

### 其他方案
- Clerk：全功能认证
- Auth0：企业级
- Supabase Auth：开源方案

## 实战篇：数据库集成

### ORM 选择
- Prisma：类型安全、迁移
- Drizzle：轻量级、性能好
- Kysely：类型安全查询构建器

### 数据库选择
- PostgreSQL：首选关系型数据库
- MySQL：传统选择
- MongoDB：NoSQL
- Supabase：Postgres + 后端服务
- PlanetScale：无服务器 MySQL

## 实战篇：部署与生产

### Vercel 部署
- 零配置：自动检测 Next.js
- 预览部署：每个 PR 自动部署
- 边缘网络：全球 CDN
- Serverless Functions：自动扩展

### 其他部署
- Netlify：类似 Vercel
- Cloudflare Pages：边缘部署
- Railway：容器部署
- 自建服务器：Node.js、Docker

### 生产配置
- 环境变量：NEXT_PUBLIC_ 前缀
- 性能监控：Vercel Analytics
- 错误追踪：Sentry
- 日志：Winston、Pino

## 实战篇：测试

### 单元测试
- Jest：测试框架
- React Testing Library：组件测试
- Vitest：Vite 生态

### E2E 测试
- Playwright：官方推荐
- Cypress：流行选择

### 集成测试
- API 测试：Supertest
- 数据库测试：测试数据库

## 实战篇：高级特性

### Middleware
- 中间件：全局处理请求
- 认证检查：重定向未登录用户
- 国际化：语言重定向
- A/B 测试：边缘计算

### 国际化（i18n）
- next-intl：推荐方案
- 路由前缀：/en、/zh
- 翻译文件：JSON、YAML
- 语言切换

### Streaming SSR
- Suspense：流式渲染
- loading.js：加载占位
- 渐进式内容：先发送 HTML，后续流式传输

## 下一步学习

掌握 Next.js 后，继续探索：

- **Next.js 14 新特性** - Server Actions、Partial Prerendering
- **Prisma + Next.js** - 数据库集成
- **NextAuth.js** - 认证解决方案
- **Vercel AI SDK** - AI 应用开发
- **微前端** - Module Federation

Next.js 就是 React 的"最佳实践集合"。路由、SSR、SSG、API、优化，所有生产环境需要的功能都内置了。学会 Next.js，你就掌握了现代 React 全栈开发的标准答案。配合 Vercel 部署，从开发到上线一气呵成。
