# Vite 学习路线

Vite 是新一代前端构建工具，"快"是它的代名词。开发服务器秒启动，热更新毫秒级响应，生产构建基于 Rollup 优化到极致。如果说 Webpack 是老大哥，Vite 就是年轻力壮的新秀，专为现代浏览器和 ES 模块设计。

## 基础篇：核心概念


### 工作原理
- 开发模式：利用浏览器原生 ES 模块，按需编译
- 生产模式：基于 Rollup 打包优化
- 传统工具对比：Webpack 需要先打包整个应用
- 冷启动极快：不打包，直接启动
- 热更新极快：只编译改动的模块

### 快速开始
- npm create vite@latest：创建项目
- 模板选择：vanilla、vue、react、preact、svelte、lit
- 开发服务器：npm run dev
- 生产构建：npm run build
- 预览构建：npm run preview

### 项目配置
- vite.config.js：配置文件
- root：项目根目录
- base：公共基础路径
- publicDir：静态资源目录
- resolve：路径解析、别名
- server：开发服务器配置
- build：构建配置

## 基础篇：开发功能

### 静态资源处理
- 导入资源：import 语法
- public 目录：直接访问
- 资源 URL：?url 后缀
- 内联资源：?inline 后缀
- Web Workers：?worker 后缀
- JSON：命名导入、tree-shaking

### CSS 处理
- CSS 模块：.module.css
- CSS 预处理器：Sass、Less、Stylus（自动支持）
- PostCSS：postcss.config.js
- CSS 代码分割：自动处理
- Lightning CSS：新选择，更快

### 开发服务器
- HMR：热模块替换，自动支持
- HTTPS：server.https
- 代理：server.proxy
- CORS：server.cors
- 文件监听：自动重启

## 进阶篇：框架集成

### Vue 支持
- @vitejs/plugin-vue：官方插件
- Vue 3 单文件组件
- JSX 支持：@vitejs/plugin-vue-jsx
- 自动导入：unplugin-vue-components

### React 支持
- @vitejs/plugin-react：官方插件
- Fast Refresh：快速刷新
- JSX 自动转换
- TypeScript：原生支持

### 其他框架
- Svelte：@sveltejs/vite-plugin-svelte
- Preact：@preact/preset-vite
- Solid：vite-plugin-solid

## 进阶篇：插件系统

### 使用插件
- plugins 配置：数组形式
- 插件顺序：影响执行顺序
- 条件应用：apply: 'build' | 'serve'
- 插件钩子：enforce: 'pre' | 'post'

### 常用插件
- vite-plugin-pwa：PWA 支持
- vite-plugin-compression：Gzip/Brotli 压缩
- vite-plugin-html：HTML 模板处理
- unplugin-auto-import：自动导入 API
- unplugin-vue-components：自动导入组件
- vite-plugin-inspect：调试工具

### Rollup 插件
- 兼容性：大部分 Rollup 插件可用
- 插件容器：统一接口
- 常用 Rollup 插件：@rollup/plugin-alias、@rollup/plugin-commonjs

## 进阶篇：构建优化

### 代码分割
- 动态导入：import()
- 手动分割：manualChunks
- 入口分割：多入口配置
- CSS 代码分割：自动处理

### 依赖预构建
- 为什么需要：CommonJS 转 ES 模块、减少 HTTP 请求
- optimizeDeps：预构建配置
- include：强制预构建
- exclude：排除预构建
- esbuild：预构建引擎

### 打包优化
- minify：压缩工具（terser、esbuild）
- sourcemap：source map 生成
- chunkSizeWarningLimit：chunk 体积警告
- rollupOptions：Rollup 配置传递
- assetsInlineLimit：资源内联阈值

## 进阶篇：环境变量

### .env 文件
- .env：所有环境
- .env.local：本地覆盖（不提交）
- .env.development：开发环境
- .env.production：生产环境

### 使用变量
- import.meta.env：访问环境变量
- VITE_ 前缀：客户端暴露
- MODE：当前模式
- BASE_URL：公共基础路径
- PROD、DEV：环境标识

### 自定义配置
- envPrefix：自定义前缀
- define：定义全局常量
- 类型声明：vite-env.d.ts

## 实战篇：TypeScript 支持

### 原生支持
- 开箱即用：无需配置
- 仅转译：不做类型检查
- 类型检查：tsc --noEmit
- tsconfig.json：配置文件

### 类型增强
- vite/client：类型定义
- 环境变量类型：ImportMetaEnv 扩展
- 静态资源类型：声明模块

## 实战篇：SSR 支持

### 服务端渲染
- 双入口：client.js、server.js
- 中间件模式：开发服务器集成
- 生产构建：client + server 构建
- 预渲染：静态生成

### SSR 框架
- Nuxt 3：Vue SSR
- Next.js：不支持（有自己的构建）
- SvelteKit：Svelte SSR
- Astro：静态站点生成

## 实战篇：部署上线

### 构建输出
- dist 目录：默认输出
- 静态资源：assets 目录
- index.html：入口文件
- 相对路径：base 配置

### 部署平台
- Vercel：零配置部署
- Netlify：自动检测 Vite
- GitHub Pages：base 配置
- Cloudflare Pages：边缘部署
- 自建服务器：Nginx、Apache

### 后端集成
- Django：静态文件服务
- Rails：Asset Pipeline
- Express：静态中间件

## 实战篇：性能与调试

### 性能优化
- 依赖预构建：减少模块请求
- 浏览器缓存：强缓存 + hash
- 代码分割：按需加载
- tree-shaking：自动移除死代码
- 压缩：CSS、JS、图片

### 调试工具
- vite-plugin-inspect：可视化调试
- Rollup 插件调试：enforce、order
- 性能分析：浏览器 Performance
- 构建分析：rollup-plugin-visualizer

## 下一步学习

掌握 Vite 后，继续探索：

- **Vitest** - Vite 原生测试框架
- **VitePress** - 基于 Vite 的静态站点生成器
- **Vite SSR** - 服务端渲染
- **Rollup** - 了解 Vite 的构建基础
- **自定义插件** - 深入 Vite 插件开发

Vite 的哲学就是"快"。不是通过各种优化挤出来的快，而是从架构设计上就快。开发时用浏览器原生 ES 模块，生产时用 Rollup 打包，两套方案各司其职。上手 Vite 后，你会觉得等待 Webpack 打包是上个世纪的事。新项目直接 Vite，别犹豫。
