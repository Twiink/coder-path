# JavaScript 学习路线

JavaScript 是前端的灵魂，也是唯一能在浏览器中原生运行的编程语言。从简单的表单验证到复杂的单页应用，从前端到后端（Node.js），JavaScript 无处不在。这条路线会带你从基础语法到高级特性，从理解原理到工程实践。

## 基础篇：语法与核心概念


### 变量与数据类型
- 变量声明：var、let、const（优先用 const）
- 基本类型：Number、String、Boolean、Undefined、Null、Symbol、BigInt
- 引用类型：Object、Array、Function
- 类型检测：typeof、instanceof、Object.prototype.toString
- 类型转换：隐式转换、显式转换、== vs ===

### 运算符与表达式
- 算术运算符：+、-、*、/、%、**
- 比较运算符：==、===、!=、!==、>、<、>=、<=
- 逻辑运算符：&&、||、!、??（空值合并）
- 位运算符：&、|、^、~、<<、>>、>>>
- 赋值运算符：=、+=、-=、*=、/=
- 三元运算符：条件 ? 值1 : 值2
- 可选链：?.、?.[]、?.()

### 流程控制
- 条件语句：if-else、switch-case
- 循环语句：for、while、do-while、for...in、for...of
- 跳转语句：break、continue、return
- 异常处理：try-catch-finally、throw

### 函数基础
- 函数声明 vs 函数表达式
- 箭头函数：语法与 this 绑定
- 参数：默认参数、剩余参数、解构参数
- 返回值：显式返回、隐式返回
- 立即执行函数（IIFE）
- 高阶函数：函数作为参数和返回值

### 数组操作
- 创建：字面量、Array()、Array.of()、Array.from()
- 访问与修改：索引、length
- 增删改：push、pop、shift、unshift、splice
- 遍历：forEach、map、filter、reduce、some、every、find、findIndex
- 转换：join、concat、slice、flat、flatMap
- 排序：sort、reverse
- 查找：indexOf、includes、find

### 对象操作
- 创建：字面量、new Object()、Object.create()
- 属性访问：点记法、括号记法
- 属性操作：增删改查、属性描述符
- 对象方法：Object.keys()、Object.values()、Object.entries()
- 解构赋值：对象解构、数组解构、嵌套解构
- 展开运算符：...、对象合并、数组合并
- 简写语法：属性简写、方法简写

## 进阶篇：核心机制深入

### 作用域与闭包
- 全局作用域、函数作用域、块级作用域
- 作用域链：变量查找机制
- 闭包：定义、原理、应用场景
- 闭包陷阱：循环中的闭包、内存泄漏

### this 绑定
- 默认绑定：独立函数调用
- 隐式绑定：对象方法调用
- 显式绑定：call、apply、bind
- new 绑定：构造函数调用
- 箭头函数的 this：词法绑定
- 绑定优先级

### 原型与继承
- 原型链：__proto__、prototype、constructor
- 原型继承：原型链继承、构造函数继承、组合继承
- ES6 class：语法糖、constructor、static、extends、super
- 原型方法 vs 实例方法
- instanceof 原理

### 异步编程
- 同步 vs 异步
- 回调函数：Callback Hell（回调地狱）
- Promise：状态、then、catch、finally、链式调用
- Promise API：Promise.all、Promise.race、Promise.allSettled、Promise.any
- async/await：语法糖、错误处理、并发控制
- 事件循环：宏任务、微任务、执行顺序

### 模块化
- CommonJS：require、module.exports（Node.js）
- ES6 Module：import、export、default export
- 动态导入：import()
- 模块加载机制

## 进阶篇：ES6+ 新特性

### 解构与展开
- 对象解构：默认值、重命名、嵌套
- 数组解构：跳过元素、剩余元素
- 展开运算符：数组展开、对象展开
- 剩余参数：函数参数收集

### 字符串增强
- 模板字符串：反引号、插值、多行
- 标签模板：自定义字符串处理
- 新方法：startsWith、endsWith、includes、repeat、padStart、padEnd

### 数组与对象增强
- Array 新方法：find、findIndex、fill、copyWithin、entries、keys、values
- Object 新方法：Object.assign、Object.is、Object.setPrototypeOf
- Map 与 Set：数据结构、API、应用场景
- WeakMap 与 WeakSet：弱引用、垃圾回收

### 迭代器与生成器
- Iterator 协议：next()、done、value
- 可迭代对象：Symbol.iterator
- Generator 函数：function*、yield、yield*
- 异步迭代器：for await...of

### Symbol 与代理
- Symbol：唯一值、内置 Symbol
- Proxy：拦截对象操作、handler、traps
- Reflect：标准化对象操作
- 应用：数据验证、响应式系统

### 类与继承增强
- class 语法：constructor、方法、getter/setter
- static 静态成员
- 私有字段：#privateField
- extends 继承、super 调用

## 实战篇：浏览器与 DOM

### BOM（浏览器对象模型）
- window 对象：全局作用域、浏览器窗口
- location：URL 操作、页面跳转
- navigator：浏览器信息、用户代理
- history：历史记录导航
- screen：屏幕信息
- 定时器：setTimeout、setInterval、requestAnimationFrame

### DOM 操作
- 节点选择：getElementById、querySelector、querySelectorAll
- 节点创建：createElement、createTextNode、cloneNode
- 节点操作：appendChild、removeChild、replaceChild、insertBefore
- 属性操作：getAttribute、setAttribute、removeAttribute、dataset
- 样式操作：style、classList（add、remove、toggle、contains）
- 内容操作：innerHTML、textContent、innerText

### 事件系统
- 事件监听：addEventListener、removeEventListener
- 事件对象：type、target、currentTarget、preventDefault、stopPropagation
- 事件冒泡与捕获
- 事件委托：利用冒泡优化性能
- 常用事件：click、input、change、submit、scroll、load、DOMContentLoaded

### 表单操作
- 表单获取：FormData API
- 表单验证：Constraint Validation API
- 输入事件：input、change、focus、blur
- 文件上传：FileReader API

## 实战篇：进阶技术

### 网络请求
- XMLHttpRequest：传统方式
- Fetch API：现代方式、Promise 风格
- 请求方法：GET、POST、PUT、DELETE
- 请求头：Content-Type、Authorization
- 响应处理：json()、text()、blob()
- 错误处理：网络错误、HTTP 错误
- CORS：跨域资源共享

### 本地存储
- Cookie：读写、过期时间、路径、域
- localStorage：持久化存储
- sessionStorage：会话存储
- IndexedDB：客户端数据库

### Web API
- Geolocation：地理定位
- Notification：桌面通知
- Clipboard API：剪贴板操作
- IntersectionObserver：元素可见性监听
- MutationObserver：DOM 变化监听
- ResizeObserver：元素尺寸监听
- Web Workers：多线程
- Service Worker：离线应用、PWA

### 性能优化
- 防抖（debounce）与节流（throttle）
- 懒加载：图片、组件
- 代码分割：动态导入
- 虚拟列表：长列表优化
- requestAnimationFrame：流畅动画
- 内存管理：避免内存泄漏

### 设计模式
- 单例模式：全局唯一实例
- 工厂模式：对象创建
- 观察者模式：发布-订阅
- 策略模式：算法替换
- 装饰器模式：功能增强
- 代理模式：访问控制
- 适配器模式：接口转换

### 函数式编程
- 纯函数：无副作用、可预测
- 不可变性：immutable
- 高阶函数：map、filter、reduce
- 函数组合：compose、pipe
- 柯里化：curry
- 偏函数应用

## 实战篇：工程化实践

### 调试技巧
- console 方法：log、warn、error、table、time、trace
- debugger 断点
- Chrome DevTools：Sources、Network、Performance、Memory
- 性能分析：Lighthouse

### 代码规范
- ESLint：代码检查
- Prettier：代码格式化
- 命名规范：驼峰、蛇形、常量大写
- 注释规范：JSDoc

### 测试
- 单元测试：Jest、Mocha
- 断言库：Chai、assert
- 测试覆盖率：istanbul
- E2E 测试：Playwright、Cypress

### 构建工具
- npm/yarn/pnpm：包管理器
- Webpack：模块打包
- Vite：现代构建工具
- Babel：代码转译

## 下一步学习

掌握 JavaScript 后，可以向多个方向发展：

- **TypeScript** - 类型安全的 JavaScript
- **前端框架** - React、Vue、Angular、Svelte
- **Node.js** - 后端开发、全栈能力
- **构建工具** - Webpack、Vite、Rollup
- **移动端** - React Native、Flutter
- **桌面端** - Electron、Tauri

JavaScript 看似简单，实则深不可测。基础语法容易上手，但要真正精通需要理解原型、闭包、异步、事件循环等核心概念。多写代码，多思考，你会发现 JavaScript 的魅力。
