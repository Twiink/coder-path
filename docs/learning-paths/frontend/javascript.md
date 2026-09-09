# JavaScript 学习路线

JavaScript 是浏览器的母语,是唯一不用安装任何东西、打开网页就能跑起来的编程语言。它看起来人畜无害,学起来也确实门槛低——但千万别被它骗了:这门语言深不见底,坑多梗多,面试官最爱拿它考人。它还有一个独特身份:全栈语言——前端写页面靠它,后端有 Node.js 接着它,移动端有 React Native,桌面端有 Electron,一门语言几乎包圆整个开发生态。

这条路线从地基挖起:**变量与类型 → 函数与作用域 → 数据操作 → 对象模型与继承 → 异步编程 → ES6+ 特性与内建对象 → 模块与工程化 → 浏览器实战 → 原理深水区**。知识点尽量一次铺全,常用的要会用,不常用的至少见过——它们可能正是下次面试的考题。

## 第一站:变量与数据类型——地基里的每一块砖

先认识变量声明三兄弟:**var、let、const**。规矩:默认 `const`,需要重新赋值用 `let`。`var` 是历史文物,记住它的毛病即可:一是**变量提升**(声明提到作用域顶部但赋值留在原地,所以 var 声明的变量在声明前访问是 undefined 而不是报错);二是**没有块级作用域**(if/for 的花括号圈不住它);三是 var 声明的全局变量会挂到 `window` 上污染全局。`let`/`const` 有块级作用域和**暂时性死区(TDZ)**——声明之前访问直接抛 ReferenceError。命名规范:变量和函数用 camelCase,常量用 UPPER_SNAKE_CASE,类与构造函数用 PascalCase;`$` 和 `_` 可以当变量名开头。

**原始类型**七兄弟,按值存储、不可变:

- `Number`:所有数字都是浮点(所以有 `0.1 + 0.2` 的精度问题);特殊值 `NaN`(唯一不等于自身的值,判断用 `Number.isNaN` 而不是 `isNaN`——后者会先做类型转换,把字符串也误判)、`Infinity`/`-Infinity`、`-0`;整数安全上限 `Number.MAX_SAFE_INTEGER`(2^53-1)。
- `String`:不可变(所有方法都返回新串);三种写法(单引号、双引号、反引号模板字符串,支持插值、多行、嵌套);转义字符(`\n`、`\t`、`\\`、Unicode 转义)。
- `Boolean`:记住**假值清单**——`false`、`0`、`-0`、`''`、`null`、`undefined`、`NaN`,其余全是真值(包括空数组 `[]` 和空对象 `{}`,新手常在这翻车)。
- `Undefined` 与 `Null`:前者"声明了没赋值",后者"有意为空";`typeof null` 是 `"object"`——语言诞生时的历史遗留 Bug,官方承认但没法修,面试必问。
- `Symbol`:生成独一无二的值(哪怕描述相同也不相等),常用作对象私有键和内置行为标识(`Symbol.iterator`);`Symbol.for()` 可以取全局注册的共享 Symbol。
- `BigInt`:表示超过安全整数的大数,字面量加 `n`;不能和 Number 混算。

**引用类型**就是 `Object` 家族:普通对象、`Array`、`Function`、`Date`、`RegExp`、`Map`、`Set`、`Error` 等,按引用存储。**类型检测三件套**各有局限:`typeof`(能分原始类型,但对 null 和所有引用类型都失灵,只有函数返回 `"function"`)、`instanceof`(沿原型链判断,跨 iframe/realm 会失效)、`Object.prototype.toString.call()`(返回 `[object Array]` 这类精确标签,最可靠)。

**类型转换**是 JS 的笑话现场:隐式转换规则是 `+` 遇字符串转拼接、其余运算符尽量转数字;比较时对象会先 `valueOf` 再 `toString`(ToPrimitive)。所以 `"" == false`、`[] == ![]`、`"5" - 3` 得 2 而 `"5" + 3` 得 "53"。保命原则:**比较永远用 `===`/`!==`**(严格相等不转换类型)。显式转换:`String()`/`Number()`/`Boolean()`,`parseInt(str, radix)` 记得传进制(它能容忍 `"42px"` 这种尾巴),`parseFloat` 同理,`Number("42px")` 只会给 NaN。

**运算符**全家桶过一遍:算术(`+ - * / %` 取余、`**` 幂、`++`/`--` 前后置区别、一元 `+`/`-` 转数字)、比较(`>`/`<` 字符串按字典序)、逻辑(`&&`/`||` 短路返回操作数本身、`!`、**`??` 空值合并**只兜 null/undefined、三者优先级:`??` 不能和 `||`/`&&` 混用不加括号)、**位运算**(`&`/`|`/`^`/`~`/`<<`/`>>`/`>>>`,日常少用但标志位、权限位、颜色通道处理、乘除 2 的幂是它的主场)、赋值复合(`+=` 等)、**可选链 `?.`**(`?.`/`?.[]`/`?.()`,访问深层属性不再写 `&&` 保命符)、三元、`typeof`/`instanceof`/`in`(属性是否存在)/`delete`(删属性,数组 delete 会留空洞)/`new`/`void`(让表达式返回 undefined)。

**流程控制**:`if/else`、`switch`(严格相等比较、每个 case 记得 break 否则 fallthrough、default 兜底)、`for`/`while`/`do-while`(至少执行一次)、`for...in`(遍历可枚举键,**会带出原型链上的属性**,一般要配 `hasOwnProperty` 过滤)、`for...of`(遍历可迭代对象的值)、`break`/`continue`、标签语句(双层循环跳出用,见过即可)。异常:`try/catch/finally`(finally 无论是否抛错都执行,return 也拦不住它)、`throw new Error('信息')`,错误类型有层级:`Error` 基类、`TypeError`(调了不存在的方法)、`RangeError`(栈溢出/数组越界)、`SyntaxError`(解析期)。**严格模式** `'use strict'`:消除静默失败(给只读属性赋值会抛错)、this 不再默认指向 window、禁止八进制字面量等,模块与 class 体内默认严格。

## 第二站:函数与作用域——JS 的头号公民

函数可以被赋值、传递、返回,是"头号公民"。三种写法——**函数声明**(有提升,可以先调用后定义)、**函数表达式**(没有提升)、**箭头函数**(没有自己的 this 和 arguments,不能当构造函数,也没有 prototype;适合回调,不适合需要动态 this 的方法)。函数自带的 `name` 和 `length` 属性(参数个数)偶尔有用。

参数玩法:**默认参数**(`function f(a = 1)`,惰性求值,传 undefined 才生效)、**剩余参数 rest**(`...args` 收尾收集)、**解构参数**(直接 `function f({x, y})` 拆对象)、`arguments` 类数组对象(箭头函数没有,现在多用 rest 替代)。**高阶函数**(函数作参数/返回值)是 JS 的灵魂:数组方法、回调、事件监听、定时器全靠它。

**作用域与闭包**:JS 是**词法作用域**(作用域由代码写在哪决定,与调用位置无关)。每一层函数创建时都会"记住"出生地的变量环境,函数 + 这个词法环境就是**闭包**。用途:数据私有(计数器、防篡改的配置)、函数工厂、**缓存/memoize**、模拟模块。经典陷阱:循环里用 `var` 声明的变量被闭包共享,`setTimeout` 回调全部打印循环结束后的值——把 `var` 换成 `let`(每次迭代新绑定)或改用 IIFE 传参即可解决;另一个坑是闭包长期持有大对象导致内存泄漏(比如 DOM 事件回调闭包引用大数组)。

**this 绑定四规则**:默认绑定(独立调用,非严格模式指向 window)、隐式绑定(`obj.fn()` 指向 obj)、显式绑定(`call`/`apply`/`bind`——前两者立即执行、传参方式不同,后者返回新函数可延迟调用,也叫硬绑定)、`new` 绑定(指向新对象)。优先级:new > 显式 > 隐式 > 默认。箭头函数**没有自己的 this**,沿词法作用域向外找。React 类组件里 `this.handleClick = this.handleClick.bind(this)` 的写法、各种 `fn.call(context)` 的库代码,都是这套规则的实战。

**IIFE**(立即执行函数 `(function(){})()`):过去靠它造块级作用域、隐藏变量,现在 let/const 上岗后主要用于"需要立刻执行且不污染作用域"的场景,老代码里大量存在。**递归**配**尾调用**概念(ES6 尾调用优化在多数引擎未落地,深递归还是会爆栈)。`new` 一个函数时发生的事情要能背:创建空对象 → 该对象原型指向函数的 prototype → 函数体内的 this 指向该对象执行 → 函数返回对象则返回它,否则返回新对象——手写 `new` 是经典面试题。

## 第三站:数据操作——数组、字符串、对象、容器

**数组**(有序、可重复、动态长度):创建用字面量或 `Array.from()`(类数组/可迭代转数组,还能传映射函数)、`Array.of()`(避免 `Array(3)` 产生三个空位的坑)。增删:`push`/`pop`(尾部)、`shift`/`unshift`(头部,慢)、`splice`(任意位置增删,全能选手)。遍历变换:`forEach`(不返回)、`map`(映射)、`filter`(过滤)、`reduce`/`reduceRight`(归并,求和/分组/拍平/去重一把梭)、`some`/`every`(判断)、`find`/`findIndex`(找第一个满足的,find 返回元素本身)、`includes`(是否包含,比 indexOf 语义清晰,还能查 NaN)。转换:`join`(与字符串 `split` 互逆)、`concat`/展开运算符拷贝合并、`slice` 截取(不改变原数组,`slice()` 无参即浅拷贝)、`flat`/`flatMap` 拍平(flat 可传层数,`Infinity` 全拍平)。排序:`sort`(默认按字符串排!数字要传比较函数;现代 V8 排序稳定)、`reverse`。查找:`indexOf`/`lastIndexOf`。填充:`fill`、`copyWithin`。迭代器方法 `entries()`/`keys()`/`values()`(配合 for...of 拿索引)。其他知识点:数组可以"稀疏"(有空洞,forEach 会跳过)、`length` 可手动截断、解构交换变量 `[a, b] = [b, a]`、多维数组、类数组(arguments、NodeList)转真数组的三种方式。**字符串方法**是一家人:查找(`indexOf`/`includes`/`startsWith`/`endsWith`)、截取(`slice`/`substring`,`substr` 已废弃)、`split`、大小写 `toUpperCase`/`toLowerCase`、`trim` 去空白、`replace`/`replaceAll`(支持正则)、`padStart`/`padEnd`(补零、对齐)、`repeat`、`charAt`/`at`(支持负数索引)、模板字符串与**标签模板**(函数处理模板串,做国际化、转义很有用)、`localeCompare`(中文字典序)。

**正则表达式**是字符串处理的进阶必修:字面量 `/pattern/` 与 `new RegExp` 两种创建;flags——`g` 全局、`i` 忽略大小写、`m` 多行、`s` dotAll、`u` Unicode;语法:字符类(`\d` 数字、`\w` 单词、`\s` 空白、`\D` 取反、`[abc]` 集合、`[^abc]` 排除)、量词(`*`/`+`/`?`/`{n,m}`,默认贪婪,加 `?` 变懒惰)、分组捕获 `()` 与 `(?:)` 非捕获、回溯引用 `\1`、**前瞻 `(?=)` 与后瞻 `(?<=)`**、锚点 `^`/`$`/`\b` 词边界。方法:String 的 `match`(g 标志时返回全部)、`matchAll`(带捕获组的迭代器,推荐)、`search`、`replace`;RegExp 的 `test`/`exec`(exec 配合 g 和 `lastIndex` 可以遍历所有匹配)。实战:手机号/邮箱校验、URL 解析、模板替换——**能用正则一行解决的,别写十行循环**。

**对象**:创建(字面量/`new Object`/`Object.create`)、属性访问(点号与 `[]` 动态键、**计算属性名** `{[key]: value}`)、删除用 `delete`、存在性用 `in` 或 `hasOwnProperty`。遍历四件套:`for...in`、`Object.keys()`/`values()`/`entries()`(推荐,不带原型属性)。**访问器属性** getter/setter(计算属性、校验赋值)。**属性描述符**:每个属性有 writable/enumerable/configurable 三开关,`Object.defineProperty`/`defineProperties` 精细控制(Vue 2 响应式底层)、`Object.getOwnPropertyDescriptor` 查看。对象保护三档:`preventExtensions`(不能加属性)、`seal`(不能加不能删)、`freeze`(全只读,浅冻结)。拷贝:展开运算符/`Object.assign` 是浅拷贝(嵌套对象共享),深拷贝用 `structuredClone`(原生,处理循环引用)或 JSON 法(`JSON.parse(JSON.stringify(x))`,丢 undefined/函数/Date 变字符串,别用于带方法的对象)。`Object.is`(比 === 更严格,能区分 `-0` 和 `NaN`)。

**Map 与 Set**:Map 的键可以是任意类型、保持插入顺序、有 size——"需要对象当键/频繁增删/要顺序"时用它替代普通对象;Set 成员唯一,`new Set(arr)` 一行去重。API 都简单(`set/get/has/delete/clear/size`,遍历 keys/values/entries/forEach)。**WeakMap/WeakSet**:键必须是对象且**弱引用**——不阻止垃圾回收,适合缓存、对象私有数据、DOM 节点关联数据,防止内存泄漏;代价是不可遍历、没有 size。

**内建对象速览**:`Number`(`isInteger`/`isFinite`/`parseInt`/`parseFloat`/`toFixed`/`toExponential` 精度坑)、`Math`(`max`/`min`/`random`(含 0 不含 1)/`round`/`floor`/`ceil`/`trunc`/`abs`/`pow`/`sqrt`/`sign`/`hypot`)、`Date`(时间戳毫秒、`new Date()` 与 `Date.now()`、ISO 字符串解析的时区坑、`getTime`/`toISOString`/`getFullYear` 等;日常格式化更推荐 dayjs 这类库)、`JSON`(`stringify` 第二个参数做替换器/缩进、`parse` 第二参数 reviver)、`console` 全家。全局函数 `encodeURIComponent`/`decodeURIComponent`(URL 参数编码,别用 encodeURI 处理参数)。

## 第四站:对象模型与继承——JS 的"类"是假的

JS 的继承是**原型链**,`class` 只是语法糖。三角关系:函数有 `prototype` 属性;对象有 `__proto__`(非标准但到处能用,标准接口是 `Object.getPrototypeOf`)指向其构造函数的 prototype;prototype 上的 `constructor` 指回构造函数。属性查找沿 `__proto__` 一路向上直到 `Object.prototype`(再往上 null),这叫**原型链**;对象自己的属性会"遮蔽"原型上的同名属性(shadowing)。`instanceof` 就是沿原型链找;`hasOwnProperty` 区分自有与继承。

继承风格演进史(理解即可,面试偶尔考古):原型链继承(引用属性被实例共享的缺陷)→ 借用构造函数(属性独立了但方法无法复用)→ 组合继承(两者结合,最常用)→ 寄生组合继承(现代库的标准姿势)。ES6 `class`:`constructor`、实例方法、`static` 静态成员(挂类本身,`Math` 那种工具类就是)、`get`/`set` 访问器、**私有字段 `#`**(真私有,语言级保护,不是 `_` 约定)、`extends` 继承 + `super()`(必须先于 this 调用,初始化父类)、`super.method()` 调父类方法、`new.target`。class 与函数的对应关系:`class` 本质还是函数 + prototype,所以"class 的方法不可枚举、必须 new 调用"这些细节面试也问。**Mixin 组合**思路:JS 单继承,用"把方法对象混入 prototype"实现多继承效果。顺带了解**原型污染攻击**(攻击者改 `__proto__` 影响所有对象)的基本概念——合并用户输入的对象时记得做防护。

## 第五站:异步编程——JS 最深的坑,也是最高频的面试题

JS 单线程,一次只干一件事,但不想等网络时干瞪眼,于是有了事件循环。**事件循环**机制:调用栈执行同步代码;异步任务完成回调进任务队列;任务分**宏任务**(script 整体、`setTimeout`/`setInterval`、I/O、UI 事件)与**微任务**(`Promise.then/catch/finally`、`queueMicrotask`、MutationObserver);规则:**每执行完一个宏任务,清空整个微任务队列,再取下一个宏任务**。所以 `setTimeout(fn, 0)` 不是 0 毫秒后执行——要等当前宏任务和全部微任务结束。经典输出顺序题(`console.log`、`setTimeout`、`Promise.then` 混排)是面试保留节目,能画清楚执行顺序才算懂。Node 环境的事件循环还分 timers/poll/check 等阶段,并有 `process.nextTick`(微任务之前)、`setImmediate`(check 阶段),浏览器里没有它们。

**定时器三兄弟**:`setTimeout`(一次)、`setInterval`(重复,回调执行时间超过间隔会"叠罗汉",一般用 setTimeout 递归替代)、`requestAnimationFrame`(浏览器渲染前执行,动画专用,自动匹配刷新率,切后台自动暂停省电)。记得 `clearTimeout`/`clearInterval` 清理。

**异步写法三段进化史**:回调(简单但嵌套成"回调地狱";Node 风格还有 error-first callback 约定,`(err, data) => {}`)→ **Promise**(状态机 `pending`/`fulfilled`/`rejected`,一旦落定不可逆;`then` 返回新 Promise 所以能链式;`catch` 接错误,位置决定能捕获谁;`finally` 无论成败都执行;注意"then 里抛错没被 catch 会静默吞掉",养成链尾挂 catch 的习惯)→ **async/await**(语法糖,让异步代码长得像同步;`await` 只能在 async 函数里;错误处理用 `try/catch`;循环里逐个 await 会串行龟速,并发请求用 `Promise.all`)。Promise 静态方法全家:`all`(全部成功,一个失败整体失败,适合"缺一不可"的并发)、`race`(第一个落定者胜,做超时控制)、`allSettled`(等全部落定不关心成败,批量上报用)、`any`(第一个成功,全失败才 reject,ES2021)。进阶:**并发控制**(限制同时进行的请求数,手写或 p-limit 库)、`Promise.resolve`/`reject` 快速构造、手写迷你 Promise(面试高发,能串起状态机/链式/微任务所有知识点)。**异步迭代**:`for await...of` 遍历异步可迭代对象(分页拉取、流式读取),配异步生成器 `async function*` 使用。

## 第六站:ES6+ 特性拾遗——解构、Proxy、迭代器

**解构与展开**的高级玩法:对象解构的默认值(`{a = 1} = {}`)、重命名(`{a: alias}`)、嵌套解构;数组解构跳过元素、剩余收集;解构函数参数(配默认值实现"命名参数"效果);展开运算符的对象合并顺序(后者覆盖前者)、类数组展开。**增强对象字面量**:属性简写、方法简写、计算属性名。

**Proxy 与 Reflect**:`Proxy` 可以拦截对象的一切操作,13 种 trap 要认识:get/set(读写)、has(in)、deleteProperty、ownKeys、getOwnPropertyDescriptor、defineProperty、apply(函数调用)、construct(new)、getPrototypeOf/setPrototypeOf、isExtensible/preventExtensions。`Reflect` 提供与 trap 一一对应的静态方法(语义化的默认行为,`Reflect.set`/`Reflect.get` 返回值更规范)。应用场景:Vue 3 响应式、数据校验、隐藏私有属性、访问日志、虚拟化只读对象。Proxy 是"元编程"的入口,能读源码、能自己造轮子。

**迭代器与生成器**:迭代协议(对象实现 `[Symbol.iterator]` 返回 `next()` 方法,`next()` 返回 `{value, done}`)、可迭代对象(数组、字符串、Map、Set、arguments、NodeList 都实现了 Symbol.iterator,所以能 for...of);**生成器函数** `function*` + `yield` 是迭代器的语法糖(惰性求值,暂停/恢复,做无限序列、状态机、扁平化异步),`yield*` 委托给另一个可迭代对象;手写一个迭代器是理解"为什么 for...of 这么通用"的好练习。

## 第七站:模块化与工程化

**模块系统**:CommonJS(Node 的 `require`/`module.exports`,同步、运行时加载、可条件加载)与 **ES Module**(`import`/`export`,静态分析、异步、浏览器与 Node 通吃;导出形式:默认导出/命名导出/混合导出、`export { a as b }` 重命名、`import * as ns` 整体导入、`import type` 是 TS 专属)。细节:ESM 的 import 有提升且必须写顶层;循环依赖两个系统处理方式不同(了解即可);**动态 `import()`** 返回 Promise,路由懒加载与按需加载的基础;`import.meta.url` 拿当前模块路径。现代代码默认 ESM。

**包管理**:npm/pnpm/yarn 三选一(新项目推荐 pnpm,省磁盘);`package.json` 的 dependencies/devDependencies 区分、`scripts` 自定义命令、`npx` 免安装执行;语义化版本 `^1.2.3`(允许 minor)、`~`(允许 patch)、精确版本;**lock 文件必须提交**,它是依赖树的指纹。**构建工具链**:Babel 做语法转译(新语法 → 兼容语法),polyfill(如 core-js)补缺失的 API——两者是不同的事;打包器三巨头:Webpack(生态最老最全)、Vite(开发体验最好,基于 ESM,新项目默认)、Rollup(库打包首选)。**代码质量**:ESLint 管对错(未用变量、隐式转换)、Prettier 管格式,配合 EditorConfig 统一换行缩进;注释用 JSDoc 风格(类型、参数、返回值,还能给编辑器提示)。**测试**:单元测试(Jest/Vitest 框架 + `describe`/`it`/`expect` 断言,`toBe`/`toEqual` 区别要懂)、Mock(模拟接口与模块)、覆盖率(istanbul/v8,`--coverage`)、组件测试(Testing Library)、E2E(Playwright/Cypress 模拟真实用户操作)、TDD(先写测试再写实现)至少理解理念。**调试**:console 方法不止 log——`table`(表格)、`dir`(对象结构)、`group`(分组折叠)、`time`/`timeEnd`(耗时)、`trace`(调用栈)、`count`(计数)、`assert`(条件断言)、`warn`/`error` 分级;`debugger` 语句 + DevTools Sources 断点(条件断点、日志点);Network 面板看请求、Performance 面板看性能、Memory 面板抓内存泄漏;sourcemap 让线上报错能映射回源码;错误监控上报(Sentry 这类)是生产环境的标配意识。

## 第八站:浏览器实战

**BOM**:`window`(全局对象,`innerWidth`/`innerHeight`、`scrollTo`、`open`/`close`、`alert`/`confirm`/`prompt` 少用)、`location`(href 读写、`assign`/`replace`/`reload`、protocol/host/pathname/search/hash 各部分)、`history`(`back`/`forward`/`go`,SPA 路由核心是 `pushState`/`replaceState` + popstate 事件)、`navigator`(userAgent、`geolocation`、`clipboard`、`onLine` 在线状态)、`screen`。**DOM**:节点树概念(Node 与 Element 的区别);查询:`getElementById`、`querySelector`/`querySelectorAll`(CSS 选择器,现代首选;注意 `getElementsByClassName` 返回**动态集合**——遍历时增删节点会出鬼)、`closest`(找最近的匹配祖先,事件委托常用)、`matches`(判断是否匹配);创建与插入:`createElement`、`innerHTML`(快但有 **XSS 风险**,插入用户内容前必须转义)、`insertAdjacentHTML`、`DocumentFragment`(批量插入只触发一次渲染)、`template` 标签;遍历:`parentNode`/`children`/`firstElementChild`/`nextElementSibling`;增删:`append`/`prepend`/`remove`/`replaceWith`(现代 API,替代老的 appendChild/removeChild/insertBefore);属性:HTML 属性 vs DOM property 的区别(比如 input 的 value)、`setAttribute`/`getAttribute`/`removeAttribute`、`dataset`(data-* 自定义属性)、`classList`(`add`/`remove`/`toggle`/`contains`/`replace`);样式:行内 `style`、`getComputedStyle` 读最终样式;尺寸与滚动:`offsetWidth`/`clientWidth`/`scrollHeight`/`getBoundingClientRect()`(元素几何信息,读它会强制重排)、`scrollIntoView` 滚动到可见。

**事件系统**:`addEventListener` 优于 `onclick` 赋值(可挂多个、可移除);第三参数可以是对象:`capture`(捕获阶段监听)、`once`(只触发一次)、`passive`(告诉浏览器不 preventDefault——**滚动性能关键**,移动端不加 passive 的 touch 监听会卡);事件传播三阶段:捕获(顶层到目标)→ 目标 → 冒泡(目标回顶层);`event.target`(实际触发者)vs `currentTarget`(监听者,this 同义);`preventDefault`(阻止默认,如表单提交、链接跳转)与 `stopPropagation`(阻止冒泡)的区别要分清;**事件委托**:父容器挂一个监听 + `target.matches()` 判断,动态列表的标配,省内存;自定义事件 `new CustomEvent` + `dispatchEvent` 实现组件间通信。常用事件清单:页面 `DOMContentLoaded`(DOM 就绪,图片未加载完)vs `load`(全部加载完)、`click`/`dblclick`、`input`(每敲一下)vs `change`(失焦/回车)、`submit`、`keydown`/`keyup`(区分 e.key)、鼠标系 mouse 与指针系 pointer(统一鼠标/触屏/笔,新代码用 pointer)、`scroll`/`resize`(高频,配合节流)、`focus`/`blur`、`visibilitychange`(切标签页暂停动画/视频)、`online`/`offline`、`contextmenu`(右键菜单)、`wheel`。

**表单与文件**:FormData(拼 multipart 表单、文件上传)、`input[type=file]` + FileReader(`readAsDataURL`/`readAsText`)预览、拖拽(dragenter/dragover/drop 系列)、HTML5 校验(`required`/`pattern`/`minlength`,JS 侧 `checkValidity()` + `setCustomValidity` 自定义提示)。

**本地存储四兄弟**:Cookie(4KB、随请求自动发送——所以别存大东西;属性:过期时间/Path/Domain/**HttpOnly(防 JS 读取,XSS 窃取 Cookie 的克星)/Secure(仅 HTTPS)/SameSite(防 CSRF)**)、localStorage(5MB 持久化,同源共享)、sessionStorage(标签页级,关闭即失)、IndexedDB(客户端真数据库:对象仓库/索引/事务/游标,配 Dexie 封装库;存大量结构化数据、离线数据)。同源策略下跨标签通信用 `storage` 事件或 BroadcastChannel。

**网络请求**:XMLHttpRequest(老 API,事件驱动,了解 `readyState` 四阶段即可)已被 **Fetch** 取代:基于 Promise,`fetch(url, {method, headers, body})`、`res.json()`/`res.text()`/`res.blob()`;**错误处理要分清**:网络层失败(断网、跨域)才 reject,HTTP 404/500 不抛错,必须检查 `res.ok`;超时用 AbortController(`signal` 传进 fetch,`controller.abort()` 取消,卸载组件时取消请求防内存泄漏);文件上传用 FormData 作 body;实际项目中常包一层 axios(拦截器统一加 token、统一错误提示)。**跨域 CORS**:同源策略是浏览器的安全机制;跨域请求分简单请求与**预检 preflight**(复杂请求先 OPTIONS 问服务器);解决思路在服务端(加 `Access-Control-Allow-Origin` 等响应头)、开发环境用代理(DevServer proxy),前端硬闯无效。**实时通信**:WebSocket(全双工长连接,聊天/推送/协作;注意断线重连与心跳保活)、SSE(Server-Sent Events,服务器单向推送,`EventSource`,断线自动重连,适合通知流)、轮询(老办法)。

**渲染与性能**:关键渲染路径(HTML → DOM、CSS → CSSOM → 渲染树 → Layout 布局 → Paint 绘制 → Composite 合成);**重排(reflow)与重绘(repaint)**:改几何属性触发重排最贵,批量改样式、用 classList 切换、读布局属性会强制同步重排;动画只用 transform/opacity(走合成,不触发重排);**防抖(debounce)**(输入搜索、窗口 resize 停止后执行)与**节流(throttle)**(滚动、mousemove 固定频率执行)是两大高频优化手段,要能手写;`requestIdleCallback`(浏览器空闲时跑低优任务);懒加载(图片 `loading="lazy"`、IntersectionObserver 自定义、路由组件动态 import);资源提示 `preload`(当前页关键资源)/`prefetch`(下一页)/`preconnect`(提前建连);虚拟列表(长列表只渲染可视区,react-window/vue-virtual-scroller 的原理要懂);**内存泄漏三大来源**:意外全局变量、定时器/监听器未清理、闭包持有大引用——页面越来越卡的元凶;性能度量 Web Vitals(LCP 加载性能/INP 交互延迟/CLS 布局稳定)是上线前必查。

**Web API 广度地图**(按需深挖):IntersectionObserver(元素进入视口,懒加载/曝光统计)、MutationObserver(DOM 变化监听)、ResizeObserver(元素尺寸变化,响应式组件)、Web Worker(多线程,`postMessage` 通信,计算密集任务;SharedWorker 多标签共享)、Service Worker(网络代理,离线缓存/PWA/推送,生命周期 install→activate→fetch)、Geolocation(定位)、Notification(桌面通知,需授权)、Clipboard(剪贴板)、Fullscreen(全屏)、Web Animations API(命令式动画)、BroadcastChannel(跨标签广播)、History API(SPA 路由)、WebAssembly(把 C/Rust 编译成 Web 字节码,性能敏感模块)、WebGPU(浏览器里跑 GPU 计算,图形/机器学习方向)。

## 第九站:原理深水区

**执行上下文**:全局上下文、函数上下文(eval 已边缘化);每个上下文有变量环境与词法环境;调用栈记录执行位置,递归无底就栈溢出(Stack Overflow——这个网站的名字就是它)。**提升细节**:var 与函数声明提升、let/const 的 TDZ、class 声明也不提升。**事件循环深入**:宏任务里开微任务会插队(在当前宏任务结束前跑完)、微任务里开微任务同理;浏览器每轮循环之间可能渲染;Node 的 timers/pending callbacks/poll/check/close 阶段模型。**手写系列清单**(把知识点逼成肌肉记忆):`new`、`call`/`apply`/`bind`、深拷贝(递归 + 循环引用 WeakMap 记录)、防抖节流、`Promise`(状态机版)、`Array.prototype.map`/`reduce`、函数柯里化、`instanceof`、事件总线(发布订阅)。**V8 引擎**:JS 源码 → 解释器 Ignition 转字节码 → 热点代码被 TurboFan JIT 编译成机器码;隐藏类与内联缓存让动态语言"追平"静态语言;内存管理:新生代(Scavenge)与老生代(标记-清除/标记-整理)分代回收——所以有"闭包持大对象不释放"的教训。**设计模式在 JS 里的样子**:单例(全局唯一,模块天然单例)、工厂(封装创建逻辑)、观察者/发布订阅(事件系统、状态管理底层)、策略(算法替换,表单校验规则集)、装饰器(函数包装,日志/鉴权)、代理(Proxy 或包装函数)、适配器(接口转换)、迭代器(for...of 的实现)、状态机(复杂交互建模)。**函数式编程**:纯函数(同输入同输出、无副作用,可测试可缓存)、不可变数据(更新返回新值,配合解构)、高阶函数、柯里化(多参转单参链)、函数组合 compose/pipe、偏函数——React 的 reducer、Redux 的设计都源于此,理解它看框架源码不费劲。**安全常识**(JS 视角):XSS 防范(输出转义、CSP、避免 innerHTML 拼接用户输入)、`eval` 与新 Function 是危险品、依赖漏洞(`npm audit`)、原型污染防护(深拷贝/合并时过滤 `__proto__`、`constructor` 键)。

## 岔路口:JavaScript 学完去哪

- **TypeScript**:给 JS 系上安全带,类型系统拦住一大半低级错误,大厂新项目默认。[TypeScript 学习路线](/learning-paths/frontend/typescript)
- **前端框架**:React 或 Vue 二选一,组件化思想一通百通。[React 学习路线](/learning-paths/frontend/react) ｜ [Vue 学习路线](/learning-paths/frontend/vue)
- **Node.js 后端**:同一门语言杀到后端,写接口、连库、做实时通信。[Node.js 学习路线](/learning-paths/backend/nodejs)
- **工程化深挖**:Vite/Webpack/Babel 原理与插件开发。[Vite 学习路线](/learning-paths/frontend/vite) ｜ [Webpack 学习路线](/learning-paths/frontend/webpack)

## 通关标准

能独立完成一个"待办事项"应用(增删改查 + 本地存储 + 一点动画);能准确说出事件循环输出顺序题的答案并解释(`console.log(1); setTimeout(() => console.log(2), 0); Promise.resolve().then(() => console.log(3))` 输出 1 3 2);能给同事讲明白闭包、this 四规则、原型链;遇到不熟悉的 API 知道去哪查(MDN)并会读文档签名——做到这些,JavaScript 主线通关。

JavaScript 看似简单,实则深不可测:它是披着 C 语言外衣的 Lisp,是唯一一门"因为历史包袱太多反而成了面试题库"的语言。别被坑吓退——每一个坑都是前人替你踩过的经验值。多写、多错、多总结,你会发现这门语言越学越有意思。
