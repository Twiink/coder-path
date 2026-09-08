# JavaScript 全栈学习路线

JavaScript 全栈的最大优势是"一门语言走天下"：前端 React/Vue，后端 Node.js，类型安全交给 TypeScript，连数据库都能用 MongoDB 无缝对接。适合想快速从 0 到 1 做出完整产品、前后端自由切换的开发者。

## MERN Stack

**前端：React**
- 组件化开发
- Hooks 管理状态
- React Router 路由
- Redux/Zustand 全局状态

**后端：Node.js + Express**
- RESTful API
- JWT 认证
- Mongoose ORM

**数据库：MongoDB**
- NoSQL 文档数据库
- 灵活的 Schema
- 与 JavaScript 对象无缝对接

**工具链**
- Vite 构建工具
- TypeScript 类型安全
- ESLint + Prettier 代码规范

## PERN Stack

**数据库：PostgreSQL**
- 关系型数据库
- 强大的查询能力
- ACID 事务保证

**ORM：Prisma**
- 类型安全的查询
- 自动生成类型
- 迁移管理


## Next.js 全栈

Next.js 让"前后端"住进同一个应用：React 组件里直接写服务端逻辑，一套代码同时搞定页面和 API。

**推荐组合**
- App Router + React Server Components
- Route Handlers / Server Actions 写接口
- Prisma + PostgreSQL 数据层
- 部署：Vercel 一键上线，静态资源自动分发

## Nuxt 全栈

Vue 生态的对应物是 Nuxt 3：内置 Nitro 服务端，`server/api` 目录写后端接口，同样一套代码跑完 SSR 与 API。

- Nuxt 3 + Vue 3 + TypeScript
- server/api 目录定义接口
- 可搭配 Prisma、Supabase 等后端服务
- 部署：Node 服务 / Vercel / Netlify
