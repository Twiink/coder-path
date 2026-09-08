# HTML & CSS 学习路线

从最基础的网页骨架到现代化的响应式布局，这条路线会带你把网页从"能看"做到"好看"，再做到"各种设备都好看"。HTML 是网页的骨架，CSS 是网页的皮肤。分工明确，各司其职。

## 基础篇：HTML 骨架搭建

### 核心标签体系
- 文档结构：`<!DOCTYPE>`、`<html>`、`<head>`、`<body>`、`<meta>`
- 语义化标签：`<header>`、`<nav>`、`<main>`、`<article>`、`<section>`、`<aside>`、`<footer>`
- 文本内容：标题（h1-h6）、段落、强调、引用、代码
- 列表：无序列表、有序列表、描述列表
- 链接与导航：`<a>` 标签、锚点、target 属性
- 图像与多媒体：`<img>`、`<picture>`、`<video>`、`<audio>`、`<canvas>`、`<svg>`
- 表格：`<table>` 全家桶（thead、tbody、tr、th、td）
- 表单：`<form>`、`<input>`（各种type）、`<textarea>`、`<select>`、`<button>`、`<label>`

### HTML5 新特性
- 本地存储：localStorage、sessionStorage、IndexedDB
- 新增标签：`<details>`、`<dialog>`、`<progress>`、`<meter>`、`<time>`、`<mark>`
- API 支持：Geolocation、拖放、Web Workers、WebSockets、Service Worker

### 最佳实践
- 语义化标签优先，避免 div 一把梭
- 图片必须有 alt 属性
- 表单元素配 label
- 合理的标题层级
- viewport meta 标签确保移动端适配
- 无障碍访问（ARIA 属性）

## 基础篇：CSS 样式入门

### 选择器系统
- 基础选择器：标签、类、ID、通配
- 组合选择器：后代、子代、相邻兄弟、通用兄弟
- 属性选择器：精确匹配、开头匹配、结尾匹配
- 伪类：`:hover`、`:active`、`:focus`、`:nth-child()`、`:not()`
- 伪元素：`::before`、`::after`、`::first-letter`、`::selection`

### 盒模型与布局
- 标准盒模型 vs IE 盒模型
- `box-sizing: border-box` 的作用
- margin、padding、border、width/height
- 外边距合并现象

### 文本与字体
- 字体属性：family、size、weight、style、line-height
- 文本属性：align、decoration、transform、indent、spacing
- Web 字体：`@font-face`

### 背景与边框
- 背景：颜色、图片、重复、位置、尺寸、固定
- CSS3 渐变：线性、径向、锥形
- 边框：width、style、color、radius、shadow

## 进阶篇：现代布局技术

### 浮动与定位
- Float 布局：浮动与清除浮动
- Position 定位：static、relative、absolute、fixed、sticky

### Flexbox 弹性布局
- 容器属性：flex-direction、justify-content、align-items、flex-wrap
- 项目属性：flex-grow、flex-shrink、flex-basis、order
- 应用场景：一维布局、导航栏、卡片排列

### Grid 网格布局
- 容器属性：grid-template-columns/rows、gap、grid-template-areas
- 项目属性：grid-column、grid-row、grid-area
- 应用场景：二维布局、复杂页面结构

### 响应式设计
- 媒体查询：断点设置、移动优先
- 响应式单位：%、em、rem、vw/vh、vmin/vmax
- 响应式图片：max-width、picture、srcset
- viewport meta 标签

## 进阶篇：CSS3 动画与效果

### 过渡与动画
- Transition：平滑过渡效果
- Animation + @keyframes：复杂动画
- 变换：translate、rotate、scale、skew
- 3D 变换：translateZ、rotateX/Y、perspective

### CSS 变量
- 定义与使用：`:root` 和 `var()`
- 动态主题切换
- JavaScript 动态修改

### 现代 CSS 特性
- Container Queries：容器查询
- Cascade Layers：层级管理
- `:has()` 选择器
- 逻辑属性：支持 RTL
- color-mix()：颜色混合
- CSS 原生嵌套

## 实战篇：工程化与优化

### 预处理器
- Sass/SCSS：变量、嵌套、mixin、继承
- Less：简化版预处理器
- PostCSS：后处理器、Autoprefixer

### CSS 方法论
- BEM：块元素修饰符命名
- OOCSS：面向对象 CSS
- SMACSS：可扩展模块化架构
- Atomic CSS：原子化工具类

### 性能优化
- 减少选择器层级
- 避免重绘和回流
- GPU 加速：transform、opacity
- 关键 CSS 内联
- 异步加载非关键 CSS
- CSS Sprites 或 SVG 图标

### 浏览器兼容性
- Can I Use 查询支持情况
- Autoprefixer 自动添加前缀
- Normalize.css / Reset.css
- Polyfills 填补功能缺失
- 渐进增强与优雅降级

### 调试工具
- 浏览器开发者工具（Elements、Computed、Layout）
- Flexbox/Grid 调试工具
- CSS Lint、PurgeCSS、Stylelint

## 下一步学习

掌握 HTML 和 CSS 后，你已经可以做出好看的静态页面了。接下来：

- **JavaScript** - 给网页加上交互和逻辑
- **CSS 预处理器** - Sass/SCSS，提升编写效率
- **CSS 框架** - Bootstrap、Tailwind CSS（但别过度依赖，基础更重要）
- **响应式设计深化** - 移动端优化、PWA
- **设计系统** - 组件化设计思维

HTML 和 CSS 是前端的基石，看似简单，门道很深。别急着跳框架，基础打牢了，后面学什么都快。记住：网页好不好看，CSS 功力占七成。
