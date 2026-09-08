# Webpack 学习路线

Webpack 是前端工程化的基石，模块打包工具的事实标准。它把各种资源（JS、CSS、图片、字体等）都当作模块处理，通过依赖关系构建出优化后的静态资源。虽然配置起来有点头疼，但理解了原理后，你就掌握了现代前端构建的核心。

## 基础篇：核心概念

### 四大核心概念
- Entry：入口，指示 Webpack 从哪个文件开始构建依赖图
- Output：输出，指定打包后文件的输出位置和命名
- Loader：转换器，处理非 JavaScript 文件
- Plugin：插件，执行更广泛的任务（优化、压缩、注入变量）

### 基本配置
- webpack.config.js：配置文件
- mode：development、production、none
- entry：单入口、多入口
- output：path、filename、publicPath
- devtool：source map 配置

### 模块解析
- resolve：模块解析规则
- extensions：自动解析扩展名
- alias：路径别名
- modules：模块搜索目录

## 进阶篇：Loader 使用

### 样式处理
- style-loader：将 CSS 注入 DOM
- css-loader：解析 CSS 文件
- sass-loader、less-loader：预处理器
- postcss-loader：CSS 后处理（Autoprefixer）
- mini-css-extract-plugin：提取 CSS 为独立文件

### JavaScript 处理
- babel-loader：转译 ES6+
- ts-loader：处理 TypeScript
- eslint-loader：代码检查

### 资源处理
- file-loader：处理文件（图片、字体）
- url-loader：小文件转 base64
- asset modules：Webpack 5 内置资源处理

### 其他 Loader
- html-loader：处理 HTML
- markdown-loader：Markdown 转换
- vue-loader：Vue 单文件组件
- svg-sprite-loader：SVG 雪碧图

## 进阶篇：Plugin 使用

### 常用插件
- HtmlWebpackPlugin：自动生成 HTML
- CleanWebpackPlugin：清理输出目录
- MiniCssExtractPlugin：提取 CSS
- CopyWebpackPlugin：复制静态资源
- DefinePlugin：定义环境变量
- ProvidePlugin：自动加载模块
- HotModuleReplacementPlugin：热更新

### 优化插件
- TerserWebpackPlugin：压缩 JavaScript
- CssMinimizerWebpackPlugin：压缩 CSS
- CompressionWebpackPlugin：Gzip 压缩
- BundleAnalyzerPlugin：打包体积分析
- SpeedMeasurePlugin：构建速度分析

## 进阶篇：优化技巧

### 构建性能优化
- 缩小搜索范围：include、exclude
- 缓存：cache、babel-loader cacheDirectory
- 多线程：thread-loader、HappyPack
- DLL：预编译依赖库
- 外部扩展：externals

### 打包体积优化
- Tree Shaking：移除未使用代码
- Code Splitting：代码分割
- 动态导入：import()
- SplitChunksPlugin：提取公共代码
- 压缩：Terser、CSS Minimizer
- scope hoisting：作用域提升

### 运行性能优化
- 按需加载：路由懒加载
- 预加载：prefetch、preload
- 持久化缓存：contenthash
- CDN：publicPath 配置
- 资源内联：小图片、关键 CSS

## 实战篇：代码分割

### 分割策略
- 入口分割：多入口配置
- 动态导入：import() 语法
- SplitChunks：自动分割公共代码

### SplitChunksPlugin
- chunks：all、async、initial
- minSize：最小体积
- maxSize：最大体积
- minChunks：最小引用次数
- cacheGroups：缓存组、自定义分割

## 实战篇：开发体验

### DevServer
- devServer：开发服务器配置
- hot：热更新
- proxy：API 代理
- historyApiFallback：SPA 路由支持
- overlay：错误覆盖层

### Source Map
- devtool 选项：速度 vs 质量权衡
- eval：最快，无列信息
- source-map：最慢，最完整
- cheap-module-source-map：开发推荐
- hidden-source-map：生产环境

### 模块热替换（HMR）
- module.hot.accept：接受热更新
- 框架集成：React Hot Loader、Vue Loader 自带
- 样式热更新：style-loader 自动支持

## 实战篇：多环境配置

### 配置分离
- webpack.common.js：公共配置
- webpack.dev.js：开发配置
- webpack.prod.js：生产配置
- webpack-merge：合并配置

### 环境变量
- DefinePlugin：注入全局变量
- process.env.NODE_ENV：环境判断
- dotenv：.env 文件支持

## 实战篇：高级主题

### 自定义 Loader
- Loader 本质：导出函数的 Node 模块
- this.callback：返回多个值
- this.async：异步处理
- 常见场景：自定义模板、国际化

### 自定义 Plugin
- Plugin 本质：带 apply 方法的类
- Compiler、Compilation：核心对象
- Tapable：事件系统
- 常见场景：资源优化、自动化任务

### Module Federation
- 微前端解决方案：Webpack 5 新特性
- 模块共享：跨应用共享代码
- 远程模块：动态加载其他应用模块

## 下一步学习

掌握 Webpack 后，可以探索：

- **Vite** - 新一代构建工具，开发体验更好
- **Rollup** - 专注于库打包
- **esbuild** - 极快的 JavaScript 打包器
- **Webpack 5 Module Federation** - 微前端解决方案
- **自定义 Loader/Plugin** - 深入理解 Webpack 原理

Webpack 配置看起来复杂，但掌握了核心概念后，其实就是各种 Loader 和 Plugin 的组合。先把基础配置跑通，然后按需添加功能。不要一上来就追求完美配置，实际项目中慢慢优化才是正道。现在 Vite 这些新工具很火，但 Webpack 的生态和稳定性依然无可替代，学会它依然很值得。
