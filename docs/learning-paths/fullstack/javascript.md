# JavaScript 全栈学习路线

**JavaScript 全栈的最大优势是"一门语言走天下"**:前端 React/Vue,后端 Node.js,类型安全交给 TypeScript,连数据建模的心智都统一——**组件、状态、异步、JSON 在哪一层都是同一套思维**,前后端切换几乎零成本。它适合:想快速从 0 到 1 做出完整产品的人、独立开发者与创业团队、前端转全栈的开发者。**前提**:先把语言本身学扎实([JavaScript](/learning-paths/frontend/javascript) 与 [TypeScript](/learning-paths/frontend/typescript) 主线),再按下面的配方组合。

## 配方一:MERN 栈(全 NoSQL 的极速原型)

**MongoDB + Express + React + Node.js**——经典的全 JS 配方,四层全是一门语言:**前端**:React(组件/Hooks/路由/状态——见 [React](/learning-paths/frontend/react));**后端**:Node.js + Express(见 [Node.js](/learning-paths/backend/nodejs));**数据**:MongoDB(文档模型与 JS 对象无缝对接——见 [MongoDB](/learning-paths/database/mongodb)),配 Mongoose 做 Schema 约束;**工具链**:Vite 构建 + TypeScript 类型 + ESLint/Prettier 规范。**适配场景**:原型与中小型应用、数据结构灵活多变、想最快看到完整产品;**注意**:MongoDB 弱事务与弱关联,涉及强一致(支付/订单联动)优先配方二。

## 配方二:PERN 栈(关系型 + 类型安全的工程化)

**PostgreSQL + Express + React + Node.js**,把 MERN 的数据库换成关系库、ORM 换成 **Prisma**:PostgreSQL 提供 ACID 事务与强查询([PostgreSQL](/learning-paths/database/postgresql));**Prisma 是 JS 全栈的工程化加分项**:schema.prisma 定义模型 → 自动迁移 → **生成类型安全客户端(前端也能共享类型)**——"改表结构,编译期全项目报错"的体验。**适配场景**:业务逻辑严谨、需要事务与关系、团队要类型安全的中大型应用。**前端 React(或 Vue)通过 REST API 对接后端**;后端分层(路由→服务→数据)见 [Node.js](/learning-paths/backend/nodejs) 的工程章。

## 配方三:Next.js 全栈(前后端同仓的现代默认)

**Next.js 让"前后端住进同一个应用"**:React 组件里直接写服务端逻辑(Server Components),一套代码同时搞定页面、API 与 SSR——**不需要再单独维护一个 Express 后端**(见 [Next.js](/learning-paths/frontend/nextjs)):**App Router + React Server Components**(页面即服务端渲染)、Route Handlers/Server Actions 写接口(表单直调,免手写 API 层)、**Prisma + PostgreSQL 数据层**(服务端组件里直接查库)、部署 Vercel 一键上线(静态资源 CDN + Serverless 自动扩缩)。**适配场景**:内容站/官网(SEO)、全栈应用、个人项目与创业产品的现代默认;**代价**:框架约定多、与 Vercel 生态耦合(自托管要配 Node 服务器)。**Vue 生态对应物**:Nuxt 3(内置 Nitro,`server/api` 目录写接口——见 [Nuxt](/learning-paths/frontend/nuxtjs)),配方完全同构。

## 跨层工程要点(JS 全栈特有)

**①类型贯通**:TypeScript 是 JS 全栈的"胶水"——后端 API 响应类型与前端共享(手写 d.ts 或 **tRPC/OpenAPI 生成**:一个 schema 前后端同源,改接口不再"前端等后端文档")(见 [协作](/learning-paths/fullstack/collaboration));**②认证流转**:JWT(access+refresh)在前后端的标准流转——前端存哪(HttpOnly Cookie vs localStorage 的权衡见 [认证](/learning-paths/security/auth))、请求拦截器统一带 token、401 统一跳登录——**"登录态"是全栈第一个要打通的横切关注点**;**③状态管理分层**:服务端状态(API 数据)交给 React Query/SWR(缓存与失效),全局 UI 状态才上 Zustand/Redux(见 [React](/learning-paths/frontend/react) 状态章)——**别把接口数据全塞全局 store**;**④环境与配置**:前后端各有一套环境变量(前端 VITE_ 前缀会进浏览器,后端密钥只在服务端——见 [Vite](/learning-paths/frontend/vite) 环境章);**⑤部署分工**:前端构建产物(静态/CDN/Vercel)与后端服务(Node 容器)可以分开部署,也可以 Next/Nuxt 一体化部署(见 [部署](/learning-paths/fullstack/deployment));**⑥测试分层**:Vitest/Jest 单测 → RTL 组件测试 → Supertest 接口测试 → Cypress/Playwright E2E(见 [测试](/learning-paths/fullstack/testing))。

## 学习路径建议(从 demo 到产品)

**第一步**:React 或 Vue 选一个学透(能独立做 CRUD 界面);**第二步**:Node + Express + 数据库(Mongo 或 Postgres)写 REST API,用 Postman/curl 调通;**第三步**:**前后端联调**——JWT 登录打通、前端调自己写的接口渲染数据(此时你完成了"全栈最小闭环");**第四步**:上 Next.js(或 Nuxt)把前后端合并,体验 Server Components 与现代全栈的省事;**第五步**:补工程化——Prisma 类型贯通、React Query 缓存、CI 自动部署、监控日志——**从"能跑"到"能交付"**。**每步对应页面**:前端见 [React](/learning-paths/frontend/react)/[Vue](/learning-paths/frontend/vue),后端见 [Node.js](/learning-paths/backend/nodejs)/[NestJS](/learning-paths/backend/nestjs)(要企业级架构换 Nest),数据见 [PostgreSQL](/learning-paths/database/postgresql)/[MongoDB](/learning-paths/database/mongodb)。

## 通关标准

能独立做到:用 Next.js(或 React+Node 分离)做出一个带 JWT 登录、CRUD、Prisma 数据层、部署上线的完整应用;说清"一次登录请求"在前后端的完整流转(token 存哪、拦截器、401 处理);用 TypeScript 让 API 类型前后端贯通(改接口字段编译期全项目报错);配好环境变量隔离与 CI 自动部署——JS 全栈主线通关。

JS 全栈是"**生态统一红利**"的最大受益者:一门语言、一套类型、一个包管理器贯穿五层,学习曲线被生态抹平了一大半。它的代价是"**自由度过高需要自律**"——架构分层、类型纪律、状态管理边界,都得自己立规矩(这也是 Nest/Next 这类"有主见"框架流行的原因)。**建议路线:React + Node 分离跑通原理 → Next.js 一体化提效**——先懂"为什么",再用"省事"的。下一步:前后端协作规范见 [协作](/learning-paths/fullstack/collaboration),或直接对照 [Python 全栈](/learning-paths/fullstack/python) 看另一条主线的取舍。
