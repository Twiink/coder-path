# JavaScript 学习路线

JavaScript 是浏览器的母语，打开浏览器控制台就能跑的唯一编程语言。它看起来人畜无害，学起来也确实门槛低——但别被骗了：这门语言深不见底，坑多梗多，面试官最爱拿它考人。它还有个独特身份：**全栈语言**——前端写页面靠它，后端有 Node.js，移动端有 React Native，桌面端有 Electron，一门语言几乎包圆整个开发生态。

这份路线是**索引和指南**，告诉你该学什么、重点在哪。具体怎么学、怎么区分、怎么踩坑，那是学习笔记的事。

## 第一站：变量、类型与运算符

欢迎来到 JavaScript 的新手村，这里有三兄弟等着你：const（别动我）、let（我会变）、var（别碰我，我有毒）。还有七个原始类型和一个万能的 Object 家族，以及一堆让你怀疑人生的类型转换规则。

**变量声明三剑客** ---- const 是不可重新赋值的变量，let 是块级作用域的变量，var 是上古遗物带着变量提升和作用域污染的光环，面试考它纯属为难你

**变量提升与暂时性死区** ---- var 和函数声明会提升到作用域顶部，let 和 const 有暂时性死区 TDZ，在声明前访问会报错，这是面试常客

**七个原始类型** ---- Number 所有数字都是浮点数所以 0.1 加 0.2 不等于 0.3、String 不可变的字符序列、Boolean 真和假但要知道假值清单、Undefined 还没赋值、Null 故意为空、Symbol 独一无二的标识符、BigInt 超大整数后面加 n

**特殊值三人组** ---- NaN 是不是数字的数字类型、Infinity 无穷大、负零也存在而且有它的用处

**引用类型大家族** ---- Object 对象、Array 数组、Function 函数、Date 日期、RegExp 正则、Map 键值对、Set 集合、WeakMap 和 WeakSet 弱引用版本，它们按引用存储复制的是地址不是内容

**类型检测四大法** ---- typeof 快但不准把 null 判断成 object 是永久 Bug、instanceof 查原型链、Object.prototype.toString.call 最可靠、Array.isArray 专治数组

**类型转换的幽默现场** ---- 显式转换用 String、Number、Boolean 函数，隐式转换就是 JavaScript 的喜剧舞台了，空数组加空数组等于空字符串，空对象加空数组等于零，保命原则是永远用三等号不碰双等号

**包装对象的秘密** ---- 原始类型调用方法时会临时包装成对象然后立即销毁，这是为什么字符串能调用方法但给它加属性会丢失

**运算符大军** ---- 算术运算符、比较运算符、逻辑运算符、位运算符是性能优化的隐藏武器、可选链问号点避免深层访问报错、空值合并双问号区分 null 和 undefined、逻辑赋值运算符与等于或等于问号问号等于

**流程控制基本功** ---- if 和 switch 的条件分支、三元运算符的简洁写法、for 和 while 的循环家族、for...in 遍历对象键、for...of 遍历可迭代对象、break 和 continue 控制循环、try catch finally 异常处理三件套

**假值清单必须背** ---- false、0、负零、空字符串、null、undefined、NaN，这七个是 JavaScript 世界的假值，其他都是真值包括空数组和空对象

**隐式转换的大坑** ---- 加号有字符串就拼接没字符串就相加、比较运算符会转换类型、逻辑运算符返回的是操作数本身不是布尔值、if 判断和逻辑运算都会触发转布尔

## 第二站：函数与作用域

第二站来到函数武馆：函数可以被传来传去、返回来返回去，甚至还能长出自己的属性。闭包是会记忆的老前辈，this 是天天换座位的调皮同学；学会它们，面试官的眉毛就不再那么容易挑起来。

**函数定义三兄弟** ---- 函数声明会提升整个函数、函数表达式不提升只是个赋值、箭头函数简洁但没有 this 没有 arguments 不能当构造函数

**参数的花样玩法** ---- 默认参数给参数兜底、剩余参数用三个点收集一堆参数成数组、解构参数直接拆对象和数组、arguments 对象是类数组存所有参数但箭头函数没有

**作用域四兄弟** ---- 全局作用域整个程序可见、函数作用域函数内部可见、块级作用域花括号内部可见、模块作用域模块内部可见

**词法作用域的铁律** ---- 代码写在哪里作用域就定在哪里，跟调用位置无关，这是静态作用域，查找变量沿着作用域链从内向外找到头

**闭包是灵魂也是噩梦** ---- 函数加它能访问的外部变量就是闭包，经典用途是数据私有化、函数工厂、缓存记忆化，经典陷阱是循环里的 var 让所有回调共享同一个变量

**this 绑定四大规则** ---- new 绑定优先级最高绑定到新创建的对象、显式绑定用 call apply bind 指定 this、隐式绑定对象方法调用时绑定到对象、默认绑定严格模式是 undefined 非严格是 window，箭头函数没有自己的 this 继承外层

**call apply bind 三剑客** ---- call 和 apply 立即调用区别是参数形式，bind 返回新函数不立即调用，三个都能改变 this 指向

**高阶函数的威力** ---- 接收函数作为参数或返回函数的函数，是函数式编程的基础，map filter reduce 都是高阶函数

**纯函数的优雅** ---- 相同输入永远相同输出、没有副作用不修改外部状态，是函数式编程的基石，便于测试和推理

**立即执行函数表达式** ---- IIFE 创建独立作用域避免污染全局，现在多用 ES 模块和块级作用域替代但面试还会考

**递归的三要素** ---- 递归出口终止条件、递归条件继续调用的情况、递归调用调用自身，经典应用是树形结构遍历、深拷贝、斐波那契

**函数柯里化** ---- 把多参数函数转换成单参数函数序列，好处是参数复用、延迟执行、函数组合

**函数组合与管道** ---- 把多个函数组合成一个函数，从右到左执行是 compose，从左到右执行是 pipe，是函数式编程的核心技术

**尾调用优化** ---- 函数最后一步是调用另一个函数，可以优化调用栈不会溢出，但现在只有严格模式的 Safari 支持

## 第三站：数组的十八般武艺

第三站是数组武林大会：push、pop、map、filter、reduce 一群方法各有绝活，sort 还喜欢偷偷改原数组。别被招式数量吓到，先练好增删改查、遍历和转换；reduce 练熟了，数组就从群演升级成主角。

**数组创建四兄弟** ---- 字面量方括号最常用、Array.of 创建指定元素的数组、Array.from 把类数组或可迭代对象转真数组还能传 map 函数、构造函数 new Array 不推荐容易踩坑

**增删改的暴力美学** ---- push 和 unshift 是尾部和头部添加、pop 和 shift 是尾部和头部删除、splice 是万能刀可以删除插入替换会改原数组

**查找定位六剑客** ---- indexOf 和 lastIndexOf 返回索引找不到返回负一、includes 返回布尔值、find 和 findIndex 接收判断函数、findLast 和 findLastIndex 从后往前找

**遍历迭代的黄金组合** ---- forEach 遍历每个元素不能中断、map 映射成新数组、filter 过滤满足条件的、reduce 是归并万能方法、some 和 every 判断是否满足条件、for...of 可以 break 和 continue

**reduce 的强大之处** ---- 能实现 map 和 filter、求和求积、扁平化数组、分组统计、数组去重、串行 Promise，有初始值从初始值开始没有从第一个元素开始

**转换与操作八仙过海** ---- join 数组转字符串、split 字符串转数组、concat 和展开运算符合并数组、slice 截取返回新数组、flat 拍平嵌套数组可以指定深度、flatMap 先 map 再 flat 一层

**排序与反转** ---- sort 排序会改原数组默认按字符串排序需要传比较函数、reverse 反转会改原数组、toSorted 和 toReversed 是新方法不改原数组

**数组判断与填充** ---- Array.isArray 判断是不是数组、fill 填充数组会改原数组、copyWithin 复制一部分到另一部分

**类数组与可迭代对象** ---- 类数组有 length 和索引但不是数组比如 arguments 和 DOM 集合、可迭代对象有 Symbol.iterator 方法可以用 for...of 遍历

**稀疏数组的坑** ---- 数组可以有空洞，forEach map filter 会跳过空洞，但 for 循环不会，这是个容易踩的坑

**数组去重五种方法** ---- Set 最简单、filter 加 indexOf、reduce 加 includes、对象键值对、Map 数据结构

## 第四站：字符串与正则表达式

第四站进入文字编辑部：字符串看起来温柔，正则表达式却像一把瑞士军刀，能切文本也能把浏览器卡到怀疑人生。模板字符串负责排版，Unicode 负责提醒你“一个字符不一定等于一个长度”。

**字符串的不可变性** ---- 字符串一旦创建就不能修改，所有方法都返回新字符串，这是性能优化的关键点

**字符串访问三种方式** ---- 方括号索引、charAt 方法、at 方法支持负数索引从后往前数

**查找定位全家桶** ---- indexOf 和 lastIndexOf 查找子串位置、includes 判断是否包含、startsWith 和 endsWith 判断开头结尾、search 用正则查找返回位置

**截取提取三兄弟** ---- slice 最常用支持负数索引、substring 不支持负数会交换参数、substr 已废弃别用了

**分割拼接双雄** ---- split 按分隔符拆成数组可以传正则、join 数组拼成字符串可以指定连接符

**大小写转换** ---- toLowerCase 和 toUpperCase 转换大小写、toLocaleLowerCase 和 toLocaleUpperCase 根据地区转换

**修剪填充四兄弟** ---- trim 去除两端空白、trimStart 和 trimEnd 去除开头或结尾、padStart 和 padEnd 填充到指定长度

**替换重复四兄弟** ---- replace 替换第一个匹配、replaceAll 替换所有匹配、repeat 重复字符串、normalize 标准化 Unicode

**匹配操作三剑客** ---- match 返回匹配结果数组、matchAll 返回迭代器包含所有匹配、localeCompare 比较字符串大小

**模板字符串的魔法** ---- 反引号包裹、美元符号花括号插值、多行字符串不用转义、标签模板函数是高级玩法可以自定义处理

**标签模板的妙用** ---- 防止 XSS 注入、国际化处理、样式组件 styled-components、SQL 查询构建器

**正则表达式的创建** ---- 字面量斜杠包裹、构造函数 new RegExp 可以动态创建、两种方式的区别是转义和动态性

**正则标志六兄弟** ---- g 全局匹配、i 忽略大小写、m 多行模式、s 点号匹配换行、u Unicode 模式、y 粘连模式

**字符类与预定义** ---- 点号匹配任意字符除了换行、方括号字符集、\d 数字、\w 单词字符、\s 空白字符、大写是取反

**量词的贪婪与懒惰** ---- 星号零次或多次、加号一次或多次、问号零次或一次、花括号指定次数、问号变懒惰模式

**位置锚点** ---- 脱字符行首、美元符号行尾、\b 单词边界、\B 非单词边界

**分组与捕获** ---- 圆括号分组、反向引用、非捕获分组、命名捕获组

**前瞻与后顾** ---- 正向前瞻、负向前瞻、正向后顾、负向后顾，是高级匹配技巧

**常用正则宝典** ---- 手机号、邮箱、URL、身份证、日期、IP 地址、中文字符、邮政编码

**灾难性回溯** ---- 嵌套量词加回溯会导致指数级复杂度，能卡死浏览器，写正则要小心

## 第五站：对象与内建对象

第五站来到对象动物园：普通对象、数组、函数、Map、Set、Date 都在这里排队，属性描述符像它们的身份证，Proxy 像门卫摄像头。你会发现“万物皆对象”不是夸张，而是 JavaScript 的一种生活态度。

**对象创建五种方式** ---- 字面量花括号最常用、Object.create 指定原型、构造函数 new 一个、class 类语法糖、工厂函数返回对象

**属性操作全家桶** ---- 点号访问、方括号访问可以用变量和特殊字符、可选链问号点避免报错、直接赋值添加或修改、delete 删除属性

**属性检查三剑客** ---- in 运算符检查属性包括原型链、hasOwnProperty 检查自身属性、Object.hasOwn 是新方法更安全

**属性枚举四兄弟** ---- for...in 遍历可枚举属性包括原型链、Object.keys 返回自身可枚举的键、Object.values 返回值、Object.entries 返回键值对数组

**属性描述符四个元属性** ---- value 属性值、writable 能否修改、enumerable 能否枚举、configurable 能否配置和删除

**访问器属性** ---- get 读取时调用、set 写入时调用，是 Vue 2 响应式的基础，Object.defineProperty 定义属性描述符

**属性保护三级跳** ---- Object.preventExtensions 不能添加新属性、Object.seal 不能添加删除属性只能修改、Object.freeze 完全冻结但是浅冻结

**对象拷贝深浅之分** ---- 浅拷贝用展开运算符和 Object.assign 只拷贝第一层、深拷贝用 structuredClone 或 JSON 方法或手写递归

**JSON 方法的局限** ---- JSON.stringify 序列化会丢失函数、Symbol、undefined，无法处理循环引用，Date 变字符串

**structuredClone 的优势** ---- 原生深拷贝、支持循环引用、支持大多数内置类型，但不支持函数和 Symbol

**Map 的优势** ---- 键可以是任意类型不限于字符串、保持插入顺序、有 size 属性、API 更清晰，常用方法 set get has delete clear

**WeakMap 的特殊性** ---- 键必须是对象、弱引用不影响垃圾回收、没有遍历方法、防止内存泄漏的利器

**Set 的集合操作** ---- 自动去重、add has delete clear 方法、可以遍历、常用于数组去重

**Set 的数学运算** ---- 并集用展开运算符、交集用 filter 加 has、差集用 filter 加非 has、子集用 every 加 has

**WeakSet 的特殊性** ---- 成员必须是对象、弱引用、没有遍历方法、没有 size 属性

**Number 的静态属性** ---- MAX_VALUE 最大值、MIN_VALUE 最小正值、MAX_SAFE_INTEGER 最大安全整数、MIN_SAFE_INTEGER 最小安全整数、EPSILON 最小精度、POSITIVE_INFINITY 正无穷、NEGATIVE_INFINITY 负无穷

**Number 的静态方法** ---- isNaN 判断是不是 NaN 比全局 isNaN 靠谱、isFinite 判断是不是有限数、isInteger 判断是不是整数、isSafeInteger 判断是不是安全整数、parseInt 和 parseFloat 转换

**Number 的实例方法** ---- toFixed 保留小数位、toExponential 科学计数法、toPrecision 指定有效数字、toString 转字符串可以指定进制

**Math 的常数** ---- E 自然对数底数、PI 圆周率、LN2 和 LN10 对数、SQRT2 根号二

**Math 的取整家族** ---- floor 向下取整、ceil 向上取整、round 四舍五入、trunc 截断小数部分

**Math 的其他方法** ---- max 和 min 最大最小值、random 随机数、pow 和 sqrt 幂和根、abs 绝对值、sign 符号、三角函数一大堆

**Date 的大坑** ---- 月份从零开始零是一月十一是十二月，这是历史包袱也是面试题

**Date 的创建** ---- new Date 当前时间、传时间戳、传年月日、传日期字符串，字符串格式要注意时区

**Date 的 Get 方法** ---- getFullYear getMonth getDate getDay getHours getMinutes getSeconds getMilliseconds，还有 UTC 版本

**Date 的 Set 方法** ---- setFullYear setMonth setDate setHours setMinutes setSeconds setMilliseconds，可以链式调用

**Date 的转换** ---- toString toDateString toTimeString toISOString toJSON toLocaleString，不同格式不同用途

**时间戳的获取** ---- Date.now 当前时间戳、getTime 实例时间戳、valueOf 也是时间戳、加号转时间戳

**console 的十八般武艺** ---- log 普通输出、info 信息、warn 警告、error 错误、dir 显示对象属性、table 表格显示数组和对象、group 和 groupEnd 分组、time 和 timeEnd 计时、count 计数、trace 追踪调用栈、assert 断言、clear 清空控制台

## 第六站：原型链与继承

第六站进入原型链家族剧：class 穿着现代西装登场，幕后却还是 prototype 和 __proto__ 两位老演员。new、instanceof、继承和 super 会轮番出场，别被语法糖哄住，底层关系才是剧情真相。

**原型三角关系** ---- 构造函数、原型对象 prototype、实例，实例的 \_\_proto\_\_ 指向构造函数的 prototype，这是铁三角

**原型链的本质** ---- 沿着 \_\_proto\_\_ 一路向上查找，直到 Object.prototype，再往上是 null，这是原型链的尽头

**构造函数的本质** ---- 任何函数都可以当构造函数，用 new 调用就会创建新对象、绑定 this、返回对象

**new 运算符的四步走** ---- 创建空对象、链接原型、绑定 this 执行构造函数、返回对象或构造函数的返回值

**instanceof 的原理** ---- 检查右边的 prototype 是否在左边的原型链上，可以被欺骗因为原型可以改

**原型链继承** ---- 子类原型指向父类实例，缺点是引用类型共享、不能传参给父类构造函数

**借用构造函数继承** ---- 子类构造函数里调用父类构造函数，缺点是方法不能复用

**组合继承** ---- 原型链加借用构造函数，经典继承方式但调用两次父类构造函数

**原型式继承** ---- Object.create 创建新对象，缺点和原型链继承一样

**寄生式继承** ---- 在原型式继承基础上增强对象，缺点是方法不能复用

**寄生组合继承** ---- 组合继承优化版，只调用一次父类构造函数，是最佳实践

**ES6 Class 语法** ---- class 关键字、constructor 构造器、实例方法、静态方法 static、继承 extends、super 关键字

**class 的本质** ---- 语法糖，底层还是原型，但更清晰、更接近传统面向对象语言

**静态方法与实例方法** ---- 静态方法用 static 修饰只能通过类调用、实例方法通过实例调用，静态方法里的 this 指向类

**私有字段与方法** ---- 井号开头的是私有字段和方法，ES2022 的真正私有，外部无法访问

**访问器属性 get set** ---- 在 class 里定义 get 和 set，读写属性时自动调用，常用于校验和计算

**继承的 super 关键字** ---- 子类构造函数必须调用 super、super 可以调用父类方法、super 在静态方法里指向父类

**new.target 的妙用** ---- 判断函数是否被 new 调用、实现抽象类不能被实例化

**Mixin 模式** ---- JavaScript 只支持单继承，Mixin 实现多重继承的效果，把多个类的方法混入一个类

**Object.create 的原理** ---- 创建新对象并指定原型，是原型式继承的基础

**Object.setPrototypeOf 与 getPrototypeOf** ---- 动态修改和获取原型，性能差不推荐频繁使用

## 第七站：异步编程与事件循环

第七站来到异步车站：JavaScript 只有一条主轨道，却要同时处理点击、请求、定时器和渲染。回调地狱是老式迷宫，Promise 是换乘大厅，async/await 是看起来像直达车的高级路线；事件循环负责决定谁先上车。

**单线程的宿命** ---- JavaScript 只有一个调用栈，同一时间只能做一件事，不会有多线程的竞态问题但容易阻塞

**调用栈与执行上下文** ---- 函数调用压栈，执行完出栈，栈溢出就是递归太深或死循环

**任务队列的两兄弟** ---- 宏任务 macro task 和微任务 micro task，微任务优先级更高

**宏任务家族** ---- setTimeout、setInterval、setImmediate (Node.js)、I/O 操作、UI 渲染

**微任务家族** ---- Promise.then catch finally、MutationObserver、queueMicrotask、process.nextTick (Node.js)

**事件循环的执行规则** ---- 执行一个宏任务、清空所有微任务队列、渲染页面、执行下一个宏任务，如此循环

**浏览器事件循环** ---- 宏任务到微任务到渲染，requestAnimationFrame 在渲染前执行

**Node.js 事件循环** ---- 六个阶段 timers、pending callbacks、idle prepare、poll、check、close callbacks，process.nextTick 优先级最高

**setTimeout 与 setInterval** ---- 延迟执行，但不精确，嵌套超过五层最小间隔四毫秒，setInterval 可能累积延迟

**requestAnimationFrame** ---- 浏览器下一次重绘前执行，帧率匹配刷新率，页面不可见自动暂停，动画首选

**requestIdleCallback** ---- 浏览器空闲时执行，适合低优先级任务，有超时参数

**回调函数的三大问题** ---- 回调地狱嵌套难看、错误处理困难、信任问题把控制权交给第三方

**Promise 的三种状态** ---- pending 等待中、fulfilled 已完成、rejected 已拒绝，状态一旦改变不可逆

**Promise 的基础 API** ---- then 注册成功回调、catch 注册失败回调、finally 无论成功失败都执行

**Promise 的静态方法** ---- Promise.resolve 和 reject 创建已决议的 Promise、Promise.all 全部成功才成功一个失败就失败、Promise.race 第一个决议的胜出、Promise.allSettled 等全部决议返回所有结果、Promise.any 第一个成功的胜出全部失败才失败

**Promise 链式调用** ---- then 返回新 Promise 可以链式调用、return 值会包装成 Promise、抛出错误会变成 rejected

**Promise 的错误处理** ---- catch 捕获错误、未捕获的错误会冒泡到最外层、unhandledrejection 事件捕获全局未处理的拒绝

**手写 Promise** ---- 面试高频题，要实现状态管理、then 方法、链式调用、错误处理、静态方法

**async/await 语法糖** ---- async 函数总是返回 Promise、await 暂停函数等待 Promise 决议、让异步代码看起来像同步

**async/await 错误处理** ---- try catch 捕获 await 的错误、不用 try catch 就用 catch 方法、Promise.allSettled 批量处理

**顺序执行 vs 并发执行** ---- 逐个 await 是串行慢、Promise.all 是并发快、根据场景选择

**async 函数的返回值** ---- 返回非 Promise 会包装成 fulfilled Promise、返回 Promise 直接返回、抛出错误会变成 rejected Promise

**顶层 await** ---- ES2022 支持模块顶层 await，模块变成异步模块，会阻塞其他模块

**异步迭代器** ---- Symbol.asyncIterator 定义异步迭代器、for await...of 遍历异步可迭代对象

**异步生成器** ---- async function* 定义异步生成器、yield 产生 Promise、返回异步迭代器

**并发控制** ---- 限制同时进行的异步任务数量，维护队列和计数器，常见于批量请求

**重试机制** ---- 失败后重试指定次数，指数退避策略，避免雪崩

**超时控制** ---- Promise.race 加 setTimeout 实现超时，AbortController 取消请求

**防抖与节流** ---- 防抖最后一次有效适合输入框搜索、节流固定间隔执行适合滚动和 resize

## 第八站：ES6+ 现代特性

第八站打开现代 JavaScript 装备箱：解构、展开、箭头函数、迭代器、生成器、代理和模块都来报到。ES6 像一次大版本搬家，后面每年继续添家具；不会这些新工具，写代码容易像骑马送快递。

**解构赋值的魔法** ---- 数组解构按位置取值、对象解构按键名取值、嵌套解构层层深入、默认值兜底、剩余元素收集、重命名别名、解构参数

**解构的应用场景** ---- 交换变量不用临时变量、函数返回多个值、提取对象部分属性、遍历 Map、模块导入

**展开运算符三个点** ---- 数组展开用于合并复制和函数参数、对象展开用于合并和覆盖属性、浅拷贝的快捷方式

**剩余参数收集器** ---- 函数参数用三个点收集剩余参数成数组、取代 arguments 对象、必须是最后一个参数

**增强对象字面量** ---- 属性简写同名可以省略、方法简写省略冒号和 function、计算属性名方括号包表达式

**Proxy 拦截器** ---- 拦截对象操作的十三种陷阱、get 拦截读取、set 拦截写入、has 拦截 in 运算符、deleteProperty 拦截 delete、apply 拦截函数调用

**Proxy 的应用场景** ---- Vue 3 响应式原理、数据校验、私有属性、日志记录、默认值、负数索引、链式调用

**Reflect 反射 API** ---- 和 Proxy 对应的十三个方法、操作对象的标准 API、返回布尔值而不是抛错、函数式风格

**Symbol 独一无二** ---- 创建独一无二的值、可以作为对象属性键、不会被常规方法遍历、Symbol.for 全局注册、Symbol.keyFor 获取键名

**内置 Symbol** ---- Symbol.iterator 定义迭代器、Symbol.toStringTag 定义对象类型标签、Symbol.toPrimitive 定义转原始值的行为、Symbol.hasInstance 定义 instanceof 行为、Symbol.species 定义派生对象的构造函数

**迭代器协议** ---- 对象有 next 方法返回 value 和 done 的对象、done 为 true 表示迭代结束

**可迭代协议** ---- 对象有 Symbol.iterator 方法返回迭代器、for...of 循环的基础、展开运算符和解构的基础

**生成器函数** ---- function* 定义、yield 暂停并产生值、next 方法恢复执行、return 和 throw 方法、惰性求值节省内存

**生成器的应用场景** ---- 实现迭代器、状态机、异步流程控制、无限序列、遍历树形结构

**可选链问号点** ---- 安全访问深层属性、遇到 null 或 undefined 短路返回 undefined、可以用在方法调用和方括号

**空值合并双问号** ---- 左边是 null 或 undefined 才取右边、和逻辑或的区别是空字符串和零不会被替换

**逻辑赋值运算符** ---- 与等于只在假值时赋值、或等于只在真值时赋值、问号问号等于只在 null 或 undefined 时赋值

**BigInt 大整数** ---- 任意精度的整数、数字后面加 n、不能和 Number 混合运算、没有 Math 方法

**数值分隔符** ---- 下划线分隔数字提高可读性、编译时移除、不影响值

**String.prototype.matchAll** ---- 返回所有匹配的迭代器、比 match 加 g 更强大、包含捕获组信息

**String.prototype.replaceAll** ---- 替换所有匹配、不用写正则加 g 标志

**Array.prototype.at** ---- 支持负数索引、负一是最后一个、比方括号更方便

**Array.prototype.flat** ---- 拍平嵌套数组、可以指定深度、默认一层、Infinity 全部拍平

**Array.prototype.flatMap** ---- 先 map 再 flat 一层、比分两步更高效

**Object.fromEntries** ---- 键值对数组转对象、和 Object.entries 相反、Map 转对象

**Object.hasOwn** ---- 替代 hasOwnProperty、更安全、不会被覆盖

**Promise.allSettled** ---- 等待所有 Promise 决议、不管成功失败都返回、返回状态和值或原因

**Promise.any** ---- 第一个成功的 Promise 胜出、全部失败才失败、返回 AggregateError

**顶层 await** ---- 模块顶层可以用 await、模块变异步模块、会阻塞导入它的模块

**私有字段与方法** ---- 井号开头、语言级私有、外部无法访问、包括子类

**静态块** ---- class 里的 static 块、初始化静态成员、可以有多个按顺序执行

## 第九站：模块化与工程化

第九站是项目管理处：模块负责把全局变量请出会议室，npm 负责发包，构建工具负责打包、压缩和搬运。单文件 Demo 到这里会开始长大，工程化就是给它办户口、定规矩、装监控。

**模块化的演进史** ---- 全局变量污染、命名空间对象、IIFE 立即执行函数、CommonJS 和 AMD、ES Module 标准模块

**CommonJS 规范** ---- Node.js 的模块系统、require 导入、module.exports 导出、运行时加载同步、输出值的拷贝

**ES Module 规范** ---- 浏览器和 Node.js 的标准、import 导入、export 导出、编译时加载静态、输出值的引用、支持 Tree Shaking

**export 的多种姿势** ---- 命名导出可以多个、默认导出只有一个、export default、export { name }、export { name as alias }、export * from

**import 的多种姿势** ---- 命名导入、默认导入、混合导入、整体导入、重命名导入、副作用导入

**动态导入 import()** ---- 返回 Promise、按需加载、条件加载、懒加载路由和组件

**ES Module 与 CommonJS 的区别** ---- 加载时机不同、输出机制不同、this 指向不同、文件扩展名不同

**循环依赖的处理** ---- CommonJS 输出已执行部分、ES Module 输出未初始化的变量、设计上尽量避免循环依赖

**package.json 核心字段** ---- name 包名、version 版本、main 入口文件、module ES 模块入口、type 模块类型、scripts 脚本命令、dependencies 生产依赖、devDependencies 开发依赖

**语义化版本 SemVer** ---- 主版本号不兼容修改、次版本号向后兼容的新功能、修订号向后兼容的问题修复

**版本范围符号** ---- 脱字符允许次版本和修订号更新、波浪号只允许修订号更新、大于小于精确指定、星号任意版本

**lock 文件的作用** ---- 锁定依赖树、确保多人协作环境一致、package-lock.json 对应 npm、yarn.lock 对应 yarn、pnpm-lock.yaml 对应 pnpm

**npm 包管理器** ---- Node.js 默认、生态最大、扁平化安装、幽灵依赖问题

**yarn 包管理器** ---- Facebook 出品、速度快、离线模式、工作区支持

**pnpm 包管理器** ---- 硬链接节省空间、内容寻址存储、严格依赖管理、推荐新项目使用

**Monorepo 与 Workspace** ---- 一个仓库多个包、共享依赖和配置、lerna 和 workspace 管理

**Babel 转译器** ---- 转译新语法到旧语法、插件和预设、polyfill 补丁、.babelrc 配置

**Webpack 构建工具** ---- 模块打包器、entry 入口、output 输出、loader 转换器、plugin 插件、code splitting 代码分割、Tree Shaking 摇树优化

**Vite 构建工具** ---- 基于 ESM 的开发服务器、冷启动极快、热更新快、Rollup 打包、推荐新项目使用

**Rollup 构建工具** ---- ES Module 打包器、Tree Shaking 强、输出更小、适合库开发

**ESLint 代码检查** ---- 静态分析代码、规则配置、插件扩展、--fix 自动修复

**Prettier 代码格式化** ---- 统一代码风格、配置简单、和 ESLint 配合使用

**EditorConfig 编辑器配置** ---- 统一缩进、换行、编码、跨编辑器生效

**Git Hooks 提交钩子** ---- Husky 管理 Git 钩子、lint-staged 只检查暂存文件、commitlint 检查提交信息格式

**单元测试框架** ---- Jest 功能全、Vitest 快、Mocha 灵活、断言库 expect 和 assert

**集成测试与 E2E** ---- 测试多个模块协作、Playwright 和 Cypress 端到端测试、Puppeteer 无头浏览器

**测试驱动开发 TDD** ---- 先写测试再写代码、红绿重构循环、提高代码质量

**持续集成 CI** ---- GitHub Actions、GitLab CI、Jenkins、自动化测试和部署

## 第十站：浏览器实战

第十站进入浏览器游乐园：DOM 是页面积木，BOM 是浏览器管家，事件是门铃，Fetch 是快递，Storage 是记事本。这里的代码会真正碰到用户、网络和设备，bug 也会因此变得更有现场感。

**BOM 五大对象** ---- window 全局对象顶层容器、location 管 URL 和跳转、history 管浏览历史和 SPA 路由、navigator 管浏览器信息和硬件、screen 管屏幕信息

**window 全局对象** ---- 浏览器窗口、全局作用域、全局变量和函数都是它的属性、innerWidth 和 innerHeight 视口尺寸、open 和 close 打开关闭窗口

**location 对象** ---- href 完整 URL、protocol 协议、host 主机和端口、hostname 主机名、port 端口、pathname 路径、search 查询字符串、hash 哈希值、reload 刷新、assign 和 replace 跳转

**history 对象** ---- back 和 forward 前进后退、go 跳转、pushState 和 replaceState 修改历史记录不跳转、popstate 事件监听前进后退、SPA 路由的基础

**navigator 对象** ---- userAgent 浏览器标识、platform 操作系统、language 语言、onLine 是否联网、geolocation 地理定位、clipboard 剪贴板、serviceWorker 注册

**DOM 节点层级** ---- Document 文档节点、Element 元素节点、Text 文本节点、Comment 注释节点、DocumentFragment 文档片段

**查询元素的方法** ---- getElementById 通过 ID 查询、getElementsByClassName 通过类名查询返回集合、getElementsByTagName 通过标签名查询、querySelector 用 CSS 选择器查询第一个、querySelectorAll 查询所有返回 NodeList

**节点关系** ---- parentNode 父节点、childNodes 子节点集合、firstChild 和 lastChild 第一个和最后一个子节点、previousSibling 和 nextSibling 前一个和后一个兄弟节点、children 子元素集合、firstElementChild 和 lastElementChild 第一个和最后一个子元素

**创建和插入节点** ---- createElement 创建元素、createTextNode 创建文本节点、cloneNode 克隆节点、appendChild 添加到末尾、insertBefore 插入到指定节点前、append 和 prepend 添加到末尾和开头、before 和 after 插入到前面和后面

**删除和替换节点** ---- removeChild 删除子节点、remove 删除自己、replaceChild 替换子节点

**属性操作** ---- setAttribute 设置属性、getAttribute 获取属性、removeAttribute 删除属性、hasAttribute 检查属性、dataset 访问 data- 属性

**类名操作** ---- className 字符串形式的类名、classList 类名集合、add 添加、remove 删除、toggle 切换、contains 检查、replace 替换

**样式操作** ---- style 内联样式对象、cssText 批量设置、getComputedStyle 获取计算后的样式、className 和 classList 改类名

**元素尺寸和位置** ---- offsetWidth 和 offsetHeight 包含边框的宽高、clientWidth 和 clientHeight 不含边框的宽高、scrollWidth 和 scrollHeight 包含滚动的宽高、offsetLeft 和 offsetTop 相对定位父元素的偏移、getBoundingClientRect 获取元素位置尺寸相对视口

**滚动操作** ---- scrollTop 和 scrollLeft 滚动距离、scrollTo 和 scrollBy 滚动到指定位置或滚动一段距离、scrollIntoView 滚动到可见区域

**事件监听** ---- addEventListener 添加事件监听、removeEventListener 移除、第三个参数是 capture 捕获阶段还是 options 对象

**事件传播三阶段** ---- 捕获阶段从 window 到目标元素、目标阶段在目标元素、冒泡阶段从目标元素到 window

**事件对象** ---- type 事件类型、target 触发事件的元素、currentTarget 监听事件的元素、preventDefault 阻止默认行为、stopPropagation 阻止冒泡、stopImmediatePropagation 阻止后续监听器

**事件委托** ---- 利用冒泡在父元素监听、节省内存、动态元素自动生效、通过 target 判断实际触发的元素

**鼠标事件** ---- click 单击、dblclick 双击、mousedown 和 mouseup 按下和释放、mousemove 移动、mouseenter 和 mouseleave 进入和离开不冒泡、mouseover 和 mouseout 进入和离开冒泡

**键盘事件** ---- keydown 按下、keyup 释放、key 按键字符、code 物理按键、ctrlKey altKey shiftKey metaKey 修饰键

**表单事件** ---- input 输入变化、change 失焦后变化、focus 和 blur 获得和失去焦点、submit 表单提交、reset 表单重置

**页面生命周期** ---- DOMContentLoaded DOM 加载完成、load 所有资源加载完成、beforeunload 页面卸载前、unload 页面卸载

**触摸事件** ---- touchstart 触摸开始、touchmove 触摸移动、touchend 触摸结束、touchcancel 触摸取消、touches 所有触摸点、targetTouches 目标元素的触摸点

**指针事件** ---- pointerdown pointerup pointermove pointercancel、统一鼠标和触摸、pointerType 类型、pointerId 标识

**自定义事件** ---- CustomEvent 构造函数、detail 传递数据、dispatchEvent 触发事件

**表单操作** ---- FormData 构造表单数据、append 添加字段、get 和 getAll 获取字段、entries 遍历、提交表单不刷新页面

**文件操作** ---- FileReader 读取文件、readAsText 读为文本、readAsDataURL 读为 Data URL、readAsArrayBuffer 读为二进制、load 事件读取完成

**拖放 API** ---- draggable 属性可拖动、dragstart drag dragend 拖动事件、dragenter dragover dragleave drop 放置事件、dataTransfer 传递数据

**本地存储四兄弟** ---- Cookie 客户端和服务器共享、localStorage 持久化存储同源共享、sessionStorage 标签页级存储、IndexedDB 浏览器内置数据库

**Cookie 操作** ---- document.cookie 读写、键值对形式、expires 和 max-age 过期时间、path 和 domain 作用域、secure 和 httpOnly 安全标志、SameSite 防 CSRF

**localStorage 和 sessionStorage** ---- setItem 设置、getItem 获取、removeItem 删除、clear 清空、key 获取键名、storage 事件监听变化

**IndexedDB 数据库** ---- 事务型数据库、对象存储空间、索引、游标、版本管理、异步操作

**XMLHttpRequest 老式 Ajax** ---- 了解即可、open 初始化、send 发送、onreadystatechange 监听状态、responseText 和 responseXML 响应

**Fetch API 现代网络请求** ---- 基于 Promise、fetch 函数、Request 和 Response 对象、Headers 管理请求头、Body 管理请求体

**Fetch 的配置** ---- method 请求方法、headers 请求头、body 请求体、mode 跨域模式、credentials 凭证、cache 缓存策略、redirect 重定向

**Fetch 的响应** ---- ok 是否成功、status 状态码、statusText 状态文本、headers 响应头、json 解析 JSON、text 解析文本、blob 解析二进制

**Fetch 的错误处理** ---- 网络错误会 reject、HTTP 错误不会 reject 要检查 ok、catch 捕获网络错误

**AbortController 取消请求** ---- 创建控制器、signal 传给 fetch、abort 方法取消、AbortSignal 的 aborted 事件

**跨域 CORS** ---- 同源策略限制跨域请求、简单请求直接发送、预检请求 OPTIONS 先问、Access-Control-Allow-Origin 响应头允许跨域

**WebSocket 全双工通信** ---- 长连接、双向通信、new WebSocket 创建连接、send 发送、message 事件接收、close 关闭

**SSE 服务器推送** ---- 单向通信服务器推送客户端、EventSource 创建连接、message 事件接收、自动重连

**Service Worker** ---- 运行在后台的脚本、拦截网络请求、离线缓存、推送通知、后台同步

**Web Worker** ---- 独立线程运行脚本、不阻塞主线程、postMessage 通信、无法访问 DOM

## 第十一站：原理深水区

第十一站下潜到 JavaScript 深海：执行上下文、调用栈、垃圾回收、JIT、事件循环和浏览器渲染都在下面。这里没有每十米一个宝箱，但有足够多的“原来如此”；想从会写代码进化到会解释代码，就得带着氧气瓶下去看看。

**执行上下文三兄弟** ---- 全局执行上下文、函数执行上下文、eval 执行上下文不推荐用

**执行上下文的组成** ---- 变量环境、词法环境、this 绑定、外部环境引用

**调用栈** ---- 函数调用压栈、执行完出栈、栈溢出是递归太深或死循环、调试时看调用栈

**变量提升 Hoisting** ---- var 声明和函数声明提升到作用域顶部、let 和 const 不提升有暂时性死区、函数声明优先级高于变量声明

**暂时性死区 TDZ** ---- let 和 const 声明前的区域、访问会报错、块级作用域的边界

**事件循环深入** ---- 单线程、调用栈、任务队列、宏任务和微任务、浏览器和 Node.js 的差异

**浏览器事件循环** ---- 执行宏任务、清空微任务队列、更新渲染、下一个宏任务、requestAnimationFrame 在渲染前、requestIdleCallback 在空闲时

**Node.js 事件循环六阶段** ---- timers 执行定时器、pending callbacks 执行推迟的回调、idle prepare 内部使用、poll 获取新 I/O 事件、check 执行 setImmediate、close callbacks 关闭回调

**process.nextTick** ---- Node.js 独有、优先级最高、在当前阶段结束后立即执行、微任务之前

**V8 引擎架构** ---- Parser 解析器生成 AST、Ignition 解释器生成字节码、TurboFan 优化编译器生成机器码、Deoptimization 反优化

**JIT 编译** ---- Just-In-Time 即时编译、热点代码优化、内联缓存 IC、隐藏类 Hidden Class

**内联缓存 IC** ---- 缓存属性访问、加速重复操作、对象结构一致时最有效

**隐藏类 Hidden Class** ---- V8 内部的类型系统、对象结构一致共享隐藏类、动态添加属性会创建新隐藏类影响性能

**V8 优化建议** ---- 对象结构保持一致、避免动态添加删除属性、避免稀疏数组、避免数组类型混杂、小整数和短字符串有特殊优化

**内存管理两大区** ---- 栈内存存原始类型和引用、堆内存存引用类型对象

**垃圾回收机制** ---- 自动管理内存、标记清除算法、引用计数已废弃因为循环引用

**新生代与老生代** ---- 新生代存活时间短用 Scavenge 算法、老生代存活时间长用标记清除和标记整理

**Scavenge 算法** ---- 把堆分成两半 From 和 To、复制存活对象到 To、交换 From 和 To、快但浪费空间

**标记清除算法** ---- 标记可达对象、清除未标记对象、会产生内存碎片

**标记整理算法** ---- 标记清除后整理内存、消除碎片、但更慢

**晋升机制** ---- 新生代对象经过一次 Scavenge 还存活晋升到老生代、或者 To 空间占比超过 25%

**增量标记** ---- 把标记过程分成多个小步、与 JavaScript 执行交替进行、避免长时间停顿

**并发标记** ---- 标记在后台线程进行、不阻塞主线程

**内存泄漏五大场景** ---- 意外的全局变量、被遗忘的定时器、闭包引用、脱离 DOM 的引用、console.log 输出对象

**内存泄漏检测** ---- Chrome DevTools Memory 面板、Heap Snapshot 堆快照、Allocation Timeline 时间线、对比快照找增长

**性能优化之渲染性能** ---- 重排 Reflow 改变布局、重绘 Repaint 改变外观、合成 Composite 只改变合成层、避免强制同步布局

**触发重排的操作** ---- 添加删除 DOM 元素、改变尺寸位置、改变内容、读取布局属性如 offsetWidth、改变字体、窗口大小变化

**触发重绘的操作** ---- 改变颜色、改变背景、改变阴影、改变可见性

**避免重排重绘** ---- 批量 DOM 操作用 DocumentFragment、读写分离先读后写、使用 transform 和 opacity 只触发合成、使用 will-change 提示浏览器

**防抖 Debounce** ---- 连续触发只执行最后一次、适合输入框搜索、实现是定时器延迟执行每次触发重置定时器

**节流 Throttle** ---- 固定时间间隔执行一次、适合滚动和 resize、实现是时间戳或定时器

**代码分割 Code Splitting** ---- 把代码拆成多个包、按需加载、减少首屏加载时间、动态 import 实现

**Tree Shaking** ---- 移除未使用的代码、依赖 ES Module 静态分析、副作用标记 sideEffects

**懒加载 Lazy Loading** ---- 图片懒加载用 Intersection Observer、路由懒加载用动态 import、组件懒加载

**预加载与预连接** ---- link 标签的 rel 属性、preload 预加载关键资源、prefetch 预加载未来可能用的资源、dns-prefetch 预解析 DNS、preconnect 预连接

**缓存策略** ---- 强缓存 Expires 和 Cache-Control、协商缓存 ETag 和 Last-Modified、Service Worker 缓存

**CDN 加速** ---- 内容分发网络、边缘节点、减少延迟

**压缩与混淆** ---- Gzip 和 Brotli 压缩、UglifyJS 和 Terser 混淆、减小体积

**性能指标 Web Vitals** ---- LCP Largest Contentful Paint 最大内容绘制、FID First Input Delay 首次输入延迟改为 INP、CLS Cumulative Layout Shift 累积布局偏移

**手写系列大全** ---- new 运算符、call apply bind、深拷贝、防抖节流、Promise 及其方法、instanceof、柯里化、函数组合、发布订阅、数组方法 map filter reduce、flat 拍平数组、Object.create、寄生组合继承、EventEmitter 事件发射器

**设计模式之创建型** ---- 单例模式全局唯一实例、工厂模式创建对象、建造者模式分步构建、原型模式克隆对象

**设计模式之结构型** ---- 代理模式控制访问、装饰器模式增强功能、适配器模式接口转换、外观模式简化接口、组合模式树形结构

**设计模式之行为型** ---- 观察者模式一对多依赖、发布订阅模式解耦、策略模式算法族、迭代器模式遍历聚合、状态机模式状态转换、职责链模式链式处理、命令模式请求封装、模板方法模式算法骨架

**函数式编程核心思想** ---- 函数是一等公民、数据不可变、无副作用、声明式、引用透明

**不可变数据** ---- 不修改原数据、返回新数据、避免副作用、Immutable.js 库

**纯函数的优势** ---- 可测试、可缓存、可并行、可推理

**柯里化 Currying** ---- 多参数函数变单参数函数序列、参数复用、延迟执行

**函数组合 Compose** ---- 多个函数组合成一个、从右到左执行、数据流管道

**高阶函数应用** ---- map filter reduce、柯里化、函数组合、memorize 缓存

**Functor 函子** ---- 实现 map 方法的容器、保持上下文、Maybe Either IO 等

## 第十二站：安全与最佳实践

安全是前端开发的重中之重，XSS 和 CSRF 是常见威胁，原型污染是隐蔽杀手。最佳实践让代码更健壮、更易维护。

**XSS 跨站脚本攻击三种类型** ---- 存储型 XSS 存在数据库、反射型 XSS 在 URL 参数、DOM 型 XSS 在前端代码

**XSS 防御策略** ---- 输出转义 HTML 实体、CSP 内容安全策略限制资源来源、HttpOnly Cookie 防止脚本读取、输入校验白名单、使用安全的 API 如 textContent 而不是 innerHTML

**CSRF 跨站请求伪造** ---- 利用用户身份发起恶意请求、攻击者无法获取响应只能执行操作

**CSRF 防御策略** ---- CSRF Token 随机令牌验证、SameSite Cookie 限制跨站发送、验证 Referer 和 Origin 请求头、关键操作二次验证

**原型污染攻击** ---- 修改 Object.prototype 影响所有对象、通过 JSON 解析或对象合并实现

**原型污染防御** ---- 过滤 \_\_proto\_\_ constructor prototype 键、Object.create(null) 创建无原型对象、Object.freeze 冻结原型、使用 Map 代替对象

**点击劫持 Clickjacking** ---- 透明 iframe 覆盖页面诱导点击、防御用 X-Frame-Options 和 CSP frame-ancestors

**中间人攻击 MITM** ---- 拦截和篡改通信、防御用 HTTPS 加密、HSTS 强制 HTTPS、证书验证

**安全的 API 使用** ---- textContent 代替 innerHTML、setAttribute 代替直接赋值、insertAdjacentHTML 指定位置、DOMPurify 库净化 HTML

**Content Security Policy** ---- CSP 响应头限制资源来源、default-src 默认策略、script-src 脚本来源、style-src 样式来源、img-src 图片来源、nonce 和 hash 内联脚本白名单

**子资源完整性 SRI** ---- script 和 link 标签的 integrity 属性、校验资源哈希、防止 CDN 被篡改

**HTTPS 与 TLS** ---- 传输层加密、证书验证、防止窃听和篡改、混合内容警告

**输入校验与消毒** ---- 白名单优于黑名单、前端校验加后端校验、正则表达式校验、转义特殊字符

**敏感数据处理** ---- 不在前端存储敏感信息、localStorage 不加密、Cookie 设置 Secure 和 HttpOnly、传输敏感数据用 HTTPS

**依赖安全** ---- npm audit 检查漏洞、定期更新依赖、使用 lock 文件、避免使用有漏洞的包

**错误处理不泄露信息** ---- 生产环境不显示详细错误、捕获并记录错误、给用户友好提示

**代码审查与测试** ---- Code Review 发现安全问题、单元测试覆盖边界情况、安全测试工具

**最佳实践之命名规范** ---- 有意义的变量名、驼峰命名法、常量全大写、私有字段下划线或井号开头、类名大驼峰

**最佳实践之代码组织** ---- 单一职责原则、模块化拆分、避免深层嵌套、提前返回减少 else、提取魔法数字为常量

**最佳实践之错误处理** ---- try catch 捕获异常、异步用 catch 或 try catch、全局错误监听 window.onerror、Promise 拒绝监听 unhandledrejection

**最佳实践之性能** ---- 避免不必要的重排重绘、防抖节流控制频率、虚拟滚动处理大列表、图片懒加载、代码分割按需加载

**最佳实践之可读性** ---- 注释说明复杂逻辑、函数保持简短、变量声明靠近使用、避免过度抽象

**最佳实践之一致性** ---- 统一代码风格、统一命名规范、统一错误处理、使用 ESLint 和 Prettier

**文档字符串 JSDoc** ---- 注释格式化、生成文档、类型提示、param return example

## 通关标准

**新手村能点亮控制台** ---- 会用 const、let、条件、循环、函数和数组，能做一个会加减删改的 Todo List，遇到 map、Promise 和闭包还会打开搜索引擎。代码可能像刚收拾完的房间——能住，但不建议开直播。面试问假值有哪些？你先深呼吸。

**初级前端能独立做功能** ---- 能讲清 this、闭包、原型、事件循环和 Promise，能做带筛选、排序、分页和本地存储的页面，模块也开始有边界。面试问手写 Promise，你的额头开始加载进度条。

**中级前端能读懂现场** ---- 能处理防抖节流、竞态、深浅拷贝、内存泄漏和浏览器渲染，能用 DevTools 找到性能瓶颈，能读懂常用库的关键源码。写代码不再只是“功能出来了”，而是知道为什么这样组织。面试问 V8 垃圾回收，你开始望向窗外。

**高级前端能搭建生态** ---- 能设计异步架构、工具库、组件边界、安全策略和性能方案，能解释引擎、模块、渲染与运行时的关系。代码不仅能跑，还能让别人接班；面试官问“还有什么要问我的？”时，你终于不是问午饭几点。

## 下一站去哪

JavaScript 是前端的基石，也是通往多个方向的钥匙：

- **[TypeScript](/learning-paths/frontend/typescript)** ---- 给 JS 加上类型系统，大厂标配，类型安全和开发体验的双重提升
- **[React](/learning-paths/frontend/react)** / **[Vue](/learning-paths/frontend/vue)** ---- 组件化开发的现代前端框架，声明式 UI 的代表
- **[Node.js](/learning-paths/backend/nodejs)** ---- JavaScript 写后端，全栈工程师的必经之路
- **[Vite](/learning-paths/frontend/vite)** / **[Webpack](/learning-paths/frontend/webpack)** ---- 现代前端项目的构建工具，从开发到生产的完整链路
- **React Native / Electron** ---- 移动端和桌面端，一套代码多端运行的跨平台方案
- **D3.js / Three.js** ---- 数据可视化和 3D 图形，创造视觉奇迹的利器

## 结语

JavaScript 看似简单，实则深不可测。它是披着 C 语言外衣的 Lisp，是唯一一门因为历史包袱太多反而成了面试题库的语言。从浏览器脚本语言到全栈开发的核心，JavaScript 已经渗透到软件开发的方方面面。

别被坑吓退——每一个坑都是前人替你踩过的经验值。0.1 加 0.2 不等于 0.3 是浮点数的宿命，typeof null 返回 object 是历史的包袱，但这些特性反而让它更有个性。

**多写、多错、多总结**。从 var 到 let const，从回调地狱到 async await，从手动 DOM 操作到框架的声明式，JavaScript 一直在进化，但核心思想没变：**函数是一等公民、闭包、原型链、异步编程**。掌握了这些，框架只是语法糖，新特性只是工具箱里的新工具。

当你能随手写出一个防抖函数，能在 Chrome DevTools 里追踪内存泄漏，能在面试官面前画出事件循环的流程图——恭喜，你已经不再是会写 JS，而是懂 JavaScript 了。

这门语言越学越有意思。**Go！**
