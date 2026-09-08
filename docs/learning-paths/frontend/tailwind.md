# Tailwind CSS 学习路线

Tailwind CSS 是 Utility-First（工具优先）的 CSS 框架。不写传统的 CSS 类，而是用原子化的工具类直接在 HTML 中组合样式。听起来反直觉，用起来真香。告别命名焦虑，告别样式覆盖，开发速度直接起飞。

## 基础篇：核心概念

### Utility-First 理念
- 原子化类名：每个类做一件事
- 组合样式：多个类组合成效果
- 无命名焦虑：不用想 class 叫什么
- 样式不冲突：原子化天然隔离
- HTML 看起来乱：但维护成本低

### 快速开始
- 安装：npm install -D tailwindcss postcss autoprefixer
- 初始化：npx tailwindcss init -p
- 配置路径：content 指定扫描文件
- 引入样式：@tailwind base/components/utilities
- JIT 模式：按需生成，默认开启

### 基础工具类
- 间距：p-4、m-2、space-x-4
- 尺寸：w-64、h-screen、max-w-xl
- 颜色：bg-blue-500、text-red-600
- 字体：text-xl、font-bold、leading-relaxed
- 边框：border、rounded-lg、border-gray-300
- 阴影：shadow-md、shadow-xl
- 布局：flex、grid、block、inline

## 基础篇：布局系统

### Flexbox
- 容器：flex、inline-flex
- 方向：flex-row、flex-col
- 对齐：justify-center、items-center
- 换行：flex-wrap、flex-nowrap
- 增长：flex-1、flex-auto、flex-none
- 间距：gap-4、space-x-2

### Grid
- 容器：grid、inline-grid
- 列数：grid-cols-3、grid-cols-12
- 行数：grid-rows-4
- 跨越：col-span-2、row-span-3
- 间距：gap-4、gap-x-2、gap-y-4
- 自动流：grid-flow-row、grid-flow-col

### 定位
- position：static、relative、absolute、fixed、sticky
- 位置：top-0、right-4、bottom-0、left-0
- z-index：z-10、z-50、-z-10
- 浮动：float-left、float-right、clear-both

## 进阶篇：响应式设计

### 断点系统
- sm：640px 及以上
- md：768px 及以上
- lg：1024px 及以上
- xl：1280px 及以上
- 2xl：1536px 及以上

### 断点前缀
- 移动优先：默认样式 + 断点覆盖
- 用法：md:text-lg、lg:grid-cols-3
- 组合使用：sm:p-4 md:p-8 lg:p-12

### 自定义断点
- tailwind.config.js：screens 配置
- 添加断点：3xl、xs
- 修改断点：调整默认值

## 进阶篇：状态变体

### 伪类
- hover：hover:bg-blue-600
- focus：focus:ring-2
- active：active:scale-95
- disabled：disabled:opacity-50
- visited：visited:text-purple-600

### 伪元素
- before：before:content-['']
- after：after:absolute
- first-line、first-letter
- placeholder：placeholder:text-gray-400

### 组合变体
- 多个状态：hover:focus:ring-2
- 响应式 + 状态：md:hover:bg-blue-600
- 组变体：group-hover:visible

### 其他变体
- dark：暗色模式
- rtl：右到左语言
- motion-safe：减少动画（用户偏好）
- peer：兄弟元素状态

## 进阶篇：自定义配置

### 主题定制
- colors：颜色系统
- spacing：间距系统
- fontFamily：字体家族
- fontSize：字体大小
- borderRadius：圆角
- extend：扩展默认主题

### 自定义工具类
- @layer utilities：添加工具类
- @apply：组合类名
- addUtilities：插件 API

### 插件系统
- 官方插件：forms、typography、aspect-ratio
- 社区插件：daisyui、flowbite
- 自定义插件：plugin() API

## 进阶篇：优化与最佳实践

### 生产优化
- PurgeCSS：自动移除未使用样式（已内置）
- 压缩：cssnano
- 缓存：contenthash
- CDN：不推荐生产环境

### 组件抽取
- @apply：提取重复样式
- 组件化：React/Vue 组件
- 插槽模式：传递 className
- 变体：cva、class-variance-authority

### 命名约定
- 避免自定义类名：优先用工具类
- 组件级类名：BEM 命名
- 配置别名：简化长类名

## 实战篇：常见场景

### 表单样式
- 输入框：border、focus:ring、rounded
- 按钮：bg、hover、active、disabled
- 表单插件：@tailwindcss/forms

### 卡片布局
- 容器：bg-white、rounded-lg、shadow
- 内边距：p-6
- 分割线：border-t、border-gray-200

### 导航栏
- Flexbox：flex、justify-between、items-center
- 响应式：md:flex、hidden、block
- 粘性定位：sticky、top-0

### 模态框
- 遮罩：fixed、inset-0、bg-black/50
- 内容：relative、bg-white、rounded
- 居中：flex、items-center、justify-center

## 实战篇：与框架集成

### React
- className：直接使用
- 条件类名：clsx、classnames
- 组件库：Headless UI、Radix UI + Tailwind

### Vue
- class 绑定：:class="['p-4', isActive && 'bg-blue']"
- 组件库：Headless UI、Naive UI + Tailwind

### Angular
- ngClass：动态类名
- 组件库：Flowbite

## 实战篇：插件与工具

### 官方插件
- @tailwindcss/typography：富文本样式
- @tailwindcss/forms：表单重置
- @tailwindcss/aspect-ratio：宽高比
- @tailwindcss/line-clamp：文本截断

### UI 组件库
- DaisyUI：组件类名
- Flowbite：组件库
- Tailwind UI：官方付费组件
- shadcn/ui：组件源码复制

### 开发工具
- Tailwind CSS IntelliSense：VSCode 插件
- Prettier Plugin：自动排序类名
- Tailwind Play：在线 Playground

## 实战篇：暗色模式

### 实现方式
- class 策略：手动切换 dark 类
- media 策略：跟随系统
- darkMode 配置：'class' | 'media'

### 使用方法
- dark 前缀：dark:bg-gray-900
- 颜色方案：定义深色版本
- 切换实现：JavaScript 切换 class

## 下一步学习

掌握 Tailwind 后，继续探索：

- **Headless UI** - 无样式的可访问组件
- **DaisyUI** - 基于 Tailwind 的组件库
- **Tailwind UI** - 官方付费组件库
- **深入自定义** - 插件开发

## Tailwind vs 传统 CSS

| 维度 | Tailwind | 传统 CSS |
|------|----------|----------|
| 开发速度 | 快 | 慢 |
| 命名负担 | 无 | 重 |
| 样式冲突 | 少 | 多 |
| HTML 可读性 | 差 | 好 |
| 维护性 | 改哪看哪 | 全局搜索 |
| 体积 | 按需生成 | 可能冗余 |

Tailwind 刚开始看着会觉得 HTML 很乱，一堆 class 堆在一起。但用一周后你就回不去了。不用想类名、不用切文件、不用担心样式冲突，开发速度直接翻倍。配合组件化开发，Tailwind 就是现代前端的最佳搭档。
