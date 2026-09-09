# Webpack 学习路线

Webpack 是前端工程化的基石,模块打包器的事实标准(webpack 5 是当前大版本)。它把所有资源——JS、CSS、图片、字体——都当**模块**,从入口出发解析依赖图,最终产出优化后的静态资源。新项目已经默认 Vite 了,为什么还要学 Webpack?三个理由:海量存量项目还在用它(维护要会);它是理解"打包器原理"的最佳教材(面试必问 tree-shaking/代码分割);Module Federation 等高级能力仍无替代。配置确实繁琐,但**核心概念只有四个**,掌握了就一通百通。

这条线按 **核心概念 → 配置入门 → Loader 体系 → Plugin 体系 → 开发体验 → 性能优化 → 代码分割 → 多环境 → 自定义扩展 → Module Federation → 横向对比** 推进。

## 第一站:四大核心概念

Webpack 的一切都围绕四个词:**Entry(入口)、Output(出口)、Loader(转换器)、Plugin(插件)**。

- **Entry**:告诉 Webpack"从哪个文件开始捋依赖"——单入口 `entry: './src/index.js'` 或多入口(对象形式,多页面应用每页一个入口)。
- **Output**:打包产物去哪、叫什么——`path`(绝对路径,通常 `path.resolve(__dirname, 'dist')`)、`filename`(支持 `[name]`/`[contenthash]` 占位符)、**`publicPath`**(资源在浏览器里的公共 URL 前缀,部署到 CDN/子路径必配)。
- **Loader**:Webpack 原生只懂 JS;**loader 把"非 JS 资源"转成模块**——CSS、图片、TS、Vue SFC 全靠它(处理顺序:数组从右往左,`use: ['style-loader', 'css-loader']` 先 css 后 style)。
- **Plugin**:loader 管"单个文件转换",plugin 管"打包全流程的任意时刻"——优化、压缩、注入变量、生成 HTML,生命周期钩子上挂函数。

再加两个贯穿配置的:`mode`(development/production/none——production 自动开启压缩与 tree-shaking)、`devtool`(source map 策略)。配置文件 `webpack.config.js` 导出一个对象;不想建文件可以用 CLI 参数(`npx webpack --mode production`)。

**模块解析(resolve)**:`extensions: ['.js', '.jsx', '.ts', '.vue']`(import 时省略扩展名按序尝试)、`alias`(路径别名:`'@': path.resolve(__dirname, 'src')`,告别 `../../../`)、`modules`(模块搜索目录,默认 node_modules)、`mainFields`(包入口字段优先级)。**配置文件的坑**:路径用 `path.resolve(__dirname, ...)`(Node 的 __dirname 是配置文件的绝对路径),别写相对路径,否则换目录就废。

## 第二站:Loader 体系——按"链"理解

Loader 按链工作,记住"**从右到左、从下到上**"的执行顺序。常用链:

- **样式链**:`css-loader`(解析 CSS 中的 import/url)→ `style-loader`(把 CSS 以 `&lt;style&gt;` 注入 DOM,开发用)或 **`MiniCssExtractPlugin.loader`**(生产:提取成独立 .css 文件,配插件用);链路再加 `postcss-loader`(Autoprefixer/Tailwind 都在这层)、`sass-loader`/`less-loader`(预处理器,放最右先执行)。
- **JS 链**:`babel-loader`(ES6+ → 兼容语法,配 `@babel/preset-env` + `preset-react`/`preset-typescript`;`cacheDirectory` 开缓存)、`ts-loader`(TS 检查 + 转译,慢;新项目用 babel 转译 + `fork-ts-checker` 单独检查)。
- **资源模块(Webpack 5 内置)**:`asset/resource`(文件拷出给 URL,替代旧 file-loader)、`asset/inline`(转 base64 内联,替代 url-loader)、`asset`(自动:小文件内联,超阈值(`parser.dataUrlCondition.maxSize`)转文件)、`asset/source`(拿原文);规则里 `type` 字段配置。
- **框架与杂项**:`vue-loader`(Vue SFC,必须配 VueLoaderPlugin)、`html-loader`(HTML 里引资源)、`markdown-loader`、`svg-sprite-loader`(SVG 雪碧图);loader 可以带 options((&#123; loader: 'babel-loader', options: &#123;...&#125; &#125;))。

## 第三站:Plugin 体系——全家桶地图

**必备插件**:`HtmlWebpackPlugin`(自动生成 HTML 并注入打包后的 script/link——template 传自己的 HTML 模板,`title`/`meta`/`minify` 选项)、`MiniCssExtractPlugin`(配上面样式链)、`CopyWebpackPlugin`(public 静态资源拷进 dist)、`DefinePlugin`(构建期注入全局常量,`process.env.NODE_ENV` 的值替换——**注意值要 JSON.stringify**,否则变成变量引用)。
**开发插件**:`HotModuleReplacementPlugin`(webpack-dev-server 的 `hot: true` 会自动开,一般不用手写)。**优化插件**:`TerserWebpackPlugin`(压缩 JS,production 默认启用,可配 `parallel`)、`CssMinimizerWebpackPlugin`(压缩提取出的 CSS)、`CompressionWebpackPlugin`(预生成 .gz/.br,配 Nginx gzip_static)、`BundleAnalyzerPlugin`(打包体积可视化,**找"谁把包撑大"的第一工具**)、`SpeedMeasurePlugin`(各 loader/plugin 耗时,构建慢定位)。
插件的本质:带 `apply(compiler)` 方法的类,在 compiler 生命周期钩子上挂逻辑——理解这个,后面自定义插件就不难。

## 第四站:开发体验——DevServer、Source Map 与 HMR

**webpack-dev-server**:`devServer` 配置——`hot: true`(HMR)、`port`/`open`、**`proxy`**(('/api': &#123; target: 'http://localhost:3000', changeOrigin: true &#125;),跨域开发标准解)、**`historyApiFallback: true`**(SPA 路由刷新 404 的解:所有路径返回 index.html)、`static`(托管静态目录)、`overlay`(编译错误全屏提示)、`client` 配置。
**Source Map**:`devtool` 选项是"速度 vs 质量"的权衡谱——`eval`(最快,只有行)、`source-map`(最慢最全)、`cheap-module-source-map`(开发推荐:够用且快)、`hidden-source-map`(生产:报错映射但源码不暴露给用户,配错误监控用)、`nosources-source-map`(线上排错安全版)。
**HMR 原理**:模块更新时,dev server 推送更新 → 运行时**热替换模块而不刷新页面**(状态不丢)——框架集成:React Fast Refresh、Vue SFC 天然支持、样式由 style-loader 自动热更;自己写模块时用 `module.hot.accept('./dep', cb)` 声明接受热更新;HMR 失败会自动降级整页刷新。

## 第五站:性能优化——构建快 + 包小

**构建性能(开发体验)**:loader 缩小范围(`include: path.resolve(__dirname, 'src')`,别让 babel 遍历 node_modules)、(cache: &#123; type: 'filesystem' &#125;)(Webpack 5 默认持久化缓存,二次构建飞起)、`thread-loader`(多线程跑重 loader,项目够大再用,有线程启动开销)、`externals`(把 react/vue 这类用 CDN 引入的库排除出打包,(externals: &#123; react: 'React' &#125;)——**注意与 tree-shaking/版本管理的权衡,现在不常用**);DLL 方案已过时(缓存替代了它)。
**体积优化**:①**Tree Shaking**:ESM 静态分析删死代码——条件:代码必须 ESM(不能 CommonJS)、production 模式自动开、`package.json` 标 `"sideEffects": false`(或数组列出有副作用的文件,如全局 CSS——**sideEffects 配置错了会把样式摇没**,经典事故);②**代码分割**:动态 `import()` 自动拆 chunk + 路由级懒加载;③**SplitChunksPlugin**(Webpack 4+ 内置,替代老 CommonsChunkPlugin):`chunks: 'all'`(抽同步+异步公共代码)/`minSize`/`maxSize`/`minChunks`(最少被引用几次)/**`cacheGroups`**(自定义分组:把 react/vue 打成 vendor chunk、把 node_modules 大库单独拆——缓存策略的基础);④**Scope Hoisting**(production 自动,`ModuleConcatenationPlugin` 的效果):把能合并的模块提升成一个大函数,减少闭包开销——前提同样要 ESM;⑤压缩(Terser/CSS Minimizer)与 gzip/brotli。
**运行性能(加载体验)**:`contenthash` 文件名(内容变 hash 变 → 配合强缓存,`filename: '[name].[contenthash].js'`;**runtime chunk 单独拆**避免业务代码一变 vendor 缓存全失效)、`preload`/`prefetch`(魔法注释 `import(/* webpackPreload: true */ ...)` 控制加载时机)、小资源内联(asset/inline 或 `data URI`)、关键 CSS 内联、CDN(publicPath 指到 CDN 域名)。

## 第六站:代码分割实战

三招组合:①**入口分割**(多页应用天然多入口,(entry: &#123; home: ..., admin: ... &#125;) + 多 HtmlWebpackPlugin);②**动态导入**(`import()` 返回 Promise,路由懒加载/按需加载的语法基础;webpack 会为每个动态导入自动产出 chunk);③**SplitChunks 自动分割**(配 cacheGroups,如 (react: &#123; test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/, name: 'react-vendor', chunks: 'all' &#125;)——把框架代码锁进独立 chunk,业务更新不重新下载框架,这是"首屏优化 + 缓存命中"的经典组合)。验证成果:`npx webpack --profile` + BundleAnalyzerPlugin 看产物构成。

## 第七站:多环境配置

一套配置走天下不现实:拆三份——`webpack.common.js`(公共:entry/output/loader/resolve)+ `webpack.dev.js`(devServer/sourcemap/HMR,`mode: 'development'`)+ `webpack.prod.js`(压缩/提取 CSS/contenthash/`mode: 'production'`),用 **`webpack-merge`**(`merge(common, &#123;...&#125;)`)合并;npm scripts 里 `webpack --config webpack.dev.js`;环境变量:`DefinePlugin` 注入 `process.env.NODE_ENV`(webpack 自身会按 mode 设置,业务代码里 `if (process.env.NODE_ENV !== 'production')` 会被编译期替换并摇掉死分支)、`dotenv` 加载 .env 文件;跨平台设置变量用 `cross-env`(Windows 兼容)。

## 第八站:自定义 Loader 与 Plugin

**自定义 Loader**:本质是"导出一个函数的 Node 模块",入参是源码字符串,返回处理后的代码:`module.exports = function(source) &#123; return source.replace(...) &#125;`;需要异步/多返回值时用 `this.callback(null, code, map)` 或 `this.async()`;**loader 之间传数据**用 `this` 上下文(webpack 注入的 loader API:this.query/this.resourcePath/this.emitFile……);**pitching 阶段**(loader.pitch,从左到右先跑,可短路)是高级玩法。
场景:自定义模板语法、i18n 文案抽取、markdown 增强。**自定义 Plugin**:类 + `apply(compiler)`,核心对象 **Compiler**(整个构建周期,`compiler.hooks.emit/done` 等)与 **Compilation**(单次构建的模块图);事件系统基于 **Tapable**(同步/异步钩子);场景:产物处理、版权头注入、自动化部署前检查。
写之前先看 Tapable 钩子类型(SyncHook/AsyncSeriesHook……),这是 webpack 插件面试的深水区。

## 第九站:Module Federation(微前端)

Webpack 5 的旗舰特性,**运行时模块共享**的微前端方案(不是 iframe、不是路由级微应用壳):宿主应用通过 `remotes` 引用远程应用暴露的模块(remote 用 `exposes` 声明共享哪些组件/页面),`shared` 声明共享依赖(react 只加载一份);子应用可以独立开发部署,运行时动态加载——**解决了"多团队技术栈一致、独立发布、运行时组合"**的问题;对比 qiankun(基于 single-spa 的 JS 沙箱 + 样式隔离方案,技术栈无关);MF 更"webpack 原生",生态(webpack 5 全系 + Vite 侧有 @originjs/vite-plugin-federation 兼容实现)。场景:大型中后台的插件化、多团队协作、灰度发布独立模块。

## 第十站:Webpack 5 变化与横向对比

**Webpack 5 要点**(相对 4):资源模块内置(file/url/raw-loader 退役)、持久化缓存默认开、Module Federation、Terser 默认、移除了 Node polyfill(浏览器里用 `crypto` 等要手动配 `resolve.fallback`——老代码报 `Buffer is not defined` 的答案)、`output.clean` 替代 CleanWebpackPlugin。**横向对比**(面试常问):**Vite**——开发用原生 ESM 不打包(秒启动),生产用 Rollup;Webpack——dev/prod 都打包(慢但稳);**Rollup**——库打包(产物干净、tree-shaking 好);**esbuild**——极快但生态/产物优化有限(常被当"转译器"嵌入);**Turbopack**(Next.js 的 Rust 打包器,追赶中)。**什么时候还要 Webpack**:存量项目维护、需要 Module Federation、深度自定义构建、兼容极端老浏览器场景——其余新项目直接 Vite。

## 通关标准

能独立做到:从零手写一份支持 React/Vue + TS + 样式 + 图片 + HMR + 代码分割 + 缓存优化 + 多环境的 webpack 配置(不用脚手架);说清 loader 与 plugin 的区别与执行顺序、tree-shaking 生效的三个条件、contenthash 缓存策略为什么这样设计、SplitChunks 的 cacheGroups 怎么配;能读懂并修改现有项目的 webpack 配置(而不是一报错就搜博客)——Webpack 主线通关。

Webpack 配置看起来复杂,但拆开就是 loader 与 plugin 的组合游戏:先把基础配置跑通,再按需加功能,最后用 BundleAnalyzer 与 SpeedMeasure 数据驱动优化——别一上来追求"完美配置"。Vite 很香,但 Webpack 的生态与稳定性在存量世界依然无可替代;更重要的是,搞懂 Webpack,你就搞懂了"前端构建"这件事本身,以后学任何打包器都是降维打击。
