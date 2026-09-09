# Vite 学习路线

Vite 是新一代前端构建工具,"快"是它的代名词——不是靠优化挤出来的快,而是**架构上就快**:开发时利用浏览器原生 ES 模块按需编译(不打包!),生产时交给 Rollup 打包优化。如果说 Webpack 是"把所有模块先捆成一团再启动"的老大哥,Vite 就是"谁被用到才编译谁"的新秀。新项目直接 Vite 已是默认答案,而理解它为什么快,是前端工程化面试的高频题。

这条线按 **工作原理 → 项目与配置 → 开发功能(资源/CSS/服务器)→ 框架集成 → 插件系统 → 构建与优化 → 环境变量 → TypeScript → SSR → 部署 → 调试与生态** 推进。

## 第一站:工作原理——为什么 Vite 这么快

**传统工具(Webpack)的开发流程**:启动时从入口出发,递归构建**整个应用的模块依赖图**,打包成 bundle 后浏览器才能开始加载——项目一大,冷启动以分钟计,改一行代码也要重新打包相关 chunk。**Vite 的思路**:开发服务器启动时什么都不打包,只启动一个轻量服务器;浏览器请求哪个模块,Vite 才**实时编译那一个**(源码用 esbuild 转译,依赖提前预打包)——所以冷启动几乎瞬时,与项目规模基本无关。
**HMR(热更新)**:只对"被改动的模块"做精准更新并推送,毫秒级生效,且**不刷新页面、不丢状态**(配合框架的 Fast Refresh)。代价:开发模式要求浏览器支持原生 ESM(现代浏览器都行);生产环境仍需打包(大量小文件的 HTTP 请求开销太大),Vite 用 **Rollup** 做生产构建(将来迁移到自研的 Rolldown,基于 Rust 的打包器,Vite 6/7 路线图上的事)。
**依赖预构建**:`node_modules` 里的依赖在首次启动时用 esbuild 预打包成 ESM(解决 CommonJS 兼容 + 把上千个小模块合并减少请求),产物缓存在 `node_modules/.vite`。

## 第二站:项目与配置

**快速开始**:`npm create vite@latest` 选模板(vanilla/vue/react/preact/svelte/solid/lit 等,还有 `--template react-ts` 这种直接指定);`npm run dev`(开发)/`build`(生产)/`preview`(本地预览构建产物——部署前必跑,否则 dev 正常 build 挂掉的事常有)。
**配置文件 `vite.config.js/ts`**(TS 配置用 `defineConfig` 拿类型提示),常用项:root/base(公共路径,**部署到子路径/GitHub Pages 必配**,`base: './'` 或 `/repo/`)/publicDir(静态资源目录,按原路径直接访问,不走打包)/resolve.alias(`@` → `src`,配 tsconfig paths 同步)/server(host/port/open/https/cors/proxy)/build(见第六站)/plugins。
**依赖与引擎**:Node 版本要求、`"type": "module"`、Vite 5/6/7 各版本差异(升级注意 Node 与插件兼容)。

## 第三站:开发功能

**静态资源**:`import img from './x.png'` 返回处理后的 URL(小文件自动内联 base64,阈值 `assetsInlineLimit` 可调);`?url` 强制返回 URL、`?raw` 拿文件原文(字符串)、**`?worker`**(`new Worker(new URL(...))` 或 `?worker&inline`——Web Worker 的现代姿势);public 目录的文件直接 `/logo.png` 访问(不经过打包与 hash);JSON 支持命名导入(tree-shake 友好);SVG 可当组件(框架插件提供)。
**CSS**:`.module.css` **CSS Modules**(类名局部化,`styles.xxx` 访问);预处理器开箱即用(`npm i -D sass` 后直接写 `<style lang="scss">`,Less/Stylus 同理);**PostCSS**(`postcss.config.js` 自动生效,Autoprefixer/Tailwind 都走它);**Lightning CSS** 可选(更快的新引擎);CSS 代码分割自动(异步模块的 CSS 随模块加载)。
**开发服务器**:HTTPS(`server.https`,本地证书或 mkcert)、**代理 `server.proxy`**(('/api': &#123; target: 'http://localhost:3000', changeOrigin: true, rewrite &#125;)——**前端跨域开发的标准解**,别开 CORS 硬闯)、`server.host`(局域网访问 `--host`)、`fs.allow`(允许 serve 工作区外目录,Vite 默认有文件系统访问白名单——安全设计)、`server.watch`(文件监听,`usePolling` 修 Docker/虚拟机里的不生效问题)。

## 第四站:框架集成

Vue:`@vitejs/plugin-vue`(SFC 编译;`script setup`/`lang="ts"` 都支持)、`@vitejs/plugin-vue-jsx`(Vue 里写 JSX);React:`@vitejs/plugin-react`(JSX 转换 + **Fast Refresh**:改组件只重渲染该组件不丢 state——react-refresh 的原理;Babel 自动注入,不用配 preset)、React 19 可换 `plugin-react-swc`(SWC 更快);Svelte:`@sveltejs/vite-plugin-svelte`;Solid/Preact/Lit 各有官方插件。
**自动导入生态**:unplugin-auto-import(API 自动导入,`ref` 不用 import)、unplugin-vue-components(组件按需自动注册,Element Plus 等库的按需方案)、unplugin-icons(图标按需)。Vite 的核心哲学:**框架无关的编译底座 + 插件适配**——换框架只换插件,工具链心智不变。

## 第五站:插件系统

**用插件**:`plugins: [vue()]`;插件是"带钩子的对象/函数",关键控制:**`enforce: 'pre' | 'post'`**(调整执行顺序,别名/特殊转换要 pre)、`apply: 'build' | 'serve'`(只在某模式生效,如 mock 插件只在 serve)。
**常用插件地图**:vite-plugin-pwa(离线/PWA)、vite-plugin-compression(gzip/brotli 预压缩,配 Nginx 用)、vite-plugin-inspect(可视化每个模块被哪些插件处理过——**调试插件链的第一工具**)、rollup-plugin-visualizer(产物依赖图,查"谁把包撑大了")、vite-plugin-html(HTML 模板注入)、@vitejs/plugin-legacy(老浏览器兼容,生成降级包 + polyfill)。
**写插件入门**:核心钩子 `config`(改配置)、`configureServer`(开发服务器中间件,mock 接口就是这么写的)、`transform`(转换模块内容:传 code + id,返回处理后的代码——写"自定义文件类型加载器"的入口)、`resolveId`/`load`(虚拟模块:`virtual:my-module`)、`closeBundle`(构建结束收尾);Rollup 插件大部分可直接用(同一插件接口,Vite 兼容层),`@rollup/plugin-alias`/`@rollup/plugin-commonjs` 等是底层常客。

## 第六站:构建与优化

**代码分割**:动态 `import()` 自动产出独立 chunk;`build.rollupOptions.output.manualChunks` 手动分组(把 react/vue 这类大依赖拆成 vendor chunk 吃缓存);多入口 `rollupOptions.input`。**压缩**:默认 esbuild 压缩(快),要极致体积换 `minify: 'terser'`;gzip/brotli 交给插件或服务器。
**产物控制**:`sourcemap: true`(线上排错)、`chunkSizeWarningLimit`(调大块警告阈值,别被警告吓到——先看 visualizer 再决定)、`assetsInlineLimit`(内联阈值)、`target`(构建目标浏览器,esbuild 语法降级范围)、`cssCodeSplit`。
**Tree-shaking**:ESM 静态分析自动摇树——所以写库/业务都优先 ESM、副作用标记(`sideEffects: false`)、别写有副作用的顶层代码(摇不掉的元凶)。**产物指纹**:文件名带 hash(`assets/index-a1b2c3.js`),内容变 hash 变 → **强缓存放心开**(`Cache-Control: immutable`),部署不刷新缓存的核心机制。
**依赖预构建配置**:`optimizeDeps.include/exclude`(强制/排除预构建——遇到"依赖改了不生效"先清 `.vite` 缓存再 include 排查)。

## 第七站:环境变量

**`.env` 体系**:`.env`(所有环境)/`.env.development`/`.env.production`/`.env.local`(本地覆盖,不提交 git);**暴露规则:只有 `VITE_` 前缀的变量会进客户端**(其他都是给构建脚本用的,别把密钥写 VITE_ 开头的变量——它们会公开到浏览器!服务端密钥走框架的私有环境变量)。
访问:`import.meta.env.VITE_API_URL`;内置:`MODE`(当前模式 development/production)、`PROD`/`DEV`、`BASE_URL`(对应 base 配置)、`SSR`;动态读取 `import.meta.env` 整个对象(注意 tree-shake:直接属性访问才能被静态替换);自定义前缀 `envPrefix`;构建期常量注入用 `define`(注意值要 JSON 序列化,(define: &#123; __APP_VERSION__: JSON.stringify(v) &#125;));类型声明:`src/vite-env.d.ts`(`/// <reference types="vite/client" />`)加 `ImportMetaEnv` 接口扩展让 `import.meta.env` 有类型。

## 第八站:TypeScript 与 SSR

**TS 支持**:Vite 对 TS 是**开箱即用但只转译不检查**(esbuild 剥类型,快;类型错误它不管)——**类型检查单独跑 `tsc --noEmit`**(CI 里加上;或 `vue-tsc`/`svelte-check` 检查模板类型);`vite-env.d.ts` 里声明静态资源模块类型(`*.vue`/`*.png` 的模块声明,让 import 不报错);**注意**:esbuild 转译不支持 `enum` 的某些运行时特性与装饰器(experimentalDecorators 要配 esbuild 选项),const enum 会出问题——写库/老项目要注意。
**SSR**:Vite 原生支持服务端渲染——开发时用**中间件模式**把 Vite 接进 Node 服务器(HTML + 模块按需转换),生产构建出 client/server 双包;自己搭 SSR 是进阶玩法,日常用框架:**Nuxt 3**(Vue)、**SvelteKit**(Svelte)、**Astro**(群岛架构,静态优先)、SolidStart(Solid);Next.js 不用 Vite(自研 Turbopack/Webpack)。

## 第九站:部署与调试

**构建产物**:`dist/` 目录——`index.html` + `assets/`(带 hash 的 js/css/图片);**部署注意**:SPA 需要**路由回退**(服务器把不存在的路径都指向 index.html,否则刷新 404;Nginx `try_files $uri /index.html`);子路径部署配 `base`。**平台**:Vercel(零配置,自动识别 Vite)、Netlify、Cloudflare Pages(边缘)、GitHub Pages(配 base)、自建 Nginx(静态托管 + gzip + 缓存头);后端集成:Django/Express 等把 dist 当静态目录 serve。**调试三板斧**:vite-plugin-inspect(看模块转换链)、rollup-plugin-visualizer(看产物构成,找大依赖)、浏览器 Performance/Network(看加载时序,发现没拆的 chunk);`vite build --debug`(打印构建日志)、`vite --debug`(dev 日志)。

## 第十站:生态与下一步

Vite 生态已自成体系:**Vitest**(Vite 原生测试框架:同配置、快,`expect`/`vi.mock`/组件测试配 Testing Library 或 Vue Test Utils——Vue/React 项目单测默认答案)、**VitePress**(基于 Vite 的文档站生成器,你现在看的站就是)、**Storybook**(组件开发环境,Vite 版已成熟)、**Ladle**(轻量 Storybook 替代)、Astro/Slidev(演示文稿,`npm create slidev`)。
**了解 Rollup/Rolldown**:Vite 生产构建的地基是 Rollup(插件体系同源);Rolldown(Rust 重写)成熟后 Vite 将统一 dev/build 引擎,`rolldown-vite` 已可尝鲜。**学习路径建议**:先用(模板/配置/代理/env/部署)→ 再懂(工作原理、预构建、HMR)→ 后造(自定义插件、manualChunks、SSR 集成)→ 最后对比(Webpack 的 bundle 模型 vs Vite 的 unbundle 模型,面试常考)。

## 通关标准

能独立做到:从零初始化一个 Vue/React + TS 项目并配好别名、代理、环境变量与部署;说清"Vite 开发为什么快"(ESM 按需 + 依赖预构建 + 精准 HMR)与"生产为什么要打包";会看 visualizer 并手动拆 vendor chunk;遇到"依赖更新不生效/样式不生效"知道清缓存与排查顺序;能给项目写一个简单的自定义插件(如虚拟模块或 mock 中间件)——Vite 主线通关。

Vite 的哲学是"相信浏览器,尊重现代标准":开发时的原生 ESM、生产时的 Rollup、未来的 Rolldown,每一步都在删掉"为了兼容而打包"的旧成本。上手 Vite 后,你会觉得等 Webpack 打包是上个世纪的事。新项目直接 Vite,别犹豫——但也别只会用不会修,工程化的下一站是理解它、扩展它。
