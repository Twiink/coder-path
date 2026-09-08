# TypeScript 学习路线

TypeScript 是 JavaScript 的超集，给 JavaScript 加上了类型系统。如果说 JavaScript 是"能跑就行"的野路子，TypeScript 就是"跑得稳才行"的正规军。大型项目必备，学会它能让你的代码更健壮、更易维护，还能大幅减少运行时错误。

## 基础篇：类型系统入门

### 基本类型
- 原始类型：number、string、boolean、null、undefined、symbol、bigint
- 数组类型：number[]、Array\<string\>
- 元组类型：[string, number]、只读元组
- 枚举类型：enum、常量枚举、字符串枚举
- any 类型：类型逃生舱（少用）
- unknown 类型：类型安全的 any
- void 类型：函数无返回值
- never 类型：永不返回、穷尽检查
- 字面量类型：具体的值作为类型

### 类型注解与推断
- 变量类型注解：显式声明
- 类型推断：let、const 的推断差异
- 最佳公共类型：数组推断
- 上下文类型推断：回调函数参数
- 类型断言：as、尖括号语法（不推荐）
- 非空断言：!、确定非 null/undefined

### 函数类型
- 参数类型注解
- 返回值类型注解
- 可选参数：?、默认值参数
- 剩余参数：...args
- 函数重载：多个签名、实现签名
- this 参数：显式声明 this 类型
- 函数类型表达式：(a: number) => void
- 调用签名：对象中的函数属性

### 对象类型
- 对象类型字面量：{ name: string; age: number }
- 可选属性：?
- 只读属性：readonly
- 索引签名：[key: string]: any
- 接口（interface）：类型别名的另一种方式
- 类型别名（type）：复杂类型命名
- interface vs type：扩展方式不同

## 进阶篇：高级类型

### 联合与交叉类型
- 联合类型：string | number、类型收窄
- 交叉类型：A & B、类型合并
- 类型守卫：typeof、instanceof、in、自定义守卫
- 可辨识联合：字面量类型 + 联合类型
- 类型收窄：if、switch、三元运算符

### 泛型
- 泛型函数：\<T\>(arg: T) => T
- 泛型接口：Interface\<T\>
- 泛型类：class Box\<T\>
- 泛型约束：extends、约束类型参数
- 默认泛型参数：\<T = string\>
- 多个类型参数：\<T, U\>
- 泛型工具类型的实现

### 类类型
- 类的基本定义：constructor、属性、方法
- 访问修饰符：public、private、protected
- 只读属性：readonly
- 参数属性：constructor 简写
- 抽象类：abstract class、抽象方法
- 类实现接口：implements
- 类表达式

### 类型操作符
- typeof：获取值的类型
- keyof：获取对象所有键的联合类型
- in：映射类型遍历
- extends：条件类型判断
- infer：条件类型中推断类型
- as const：常量断言、字面量类型收窄
- satisfies：类型验证（TS 4.9+）

### 映射类型
- 基础映射：{ [K in keyof T]: T[K] }
- 修饰符：readonly、?、-readonly、-?
- 键重映射：as 子句
- 过滤键：条件类型排除
- 模板字面量类型：`${T}Id`

### 映射类型深入
- 映射类型的遍历机制
- 键重映射：as 子句的高级用法
- never 过滤键：条件类型返回 never
- 修饰符的添加与移除
- 递归映射类型：深度转换
- 映射类型与同态性（Homomorphic）

### 条件类型
- 基本语法：T extends U ? X : Y
- 分布式条件类型：联合类型分发
- infer 推断：提取类型信息
- 递归条件类型：处理嵌套结构
- 条件类型约束

### 条件类型深入
- 条件类型的分布特性：联合类型自动分发
- 裸类型参数（Naked Type Parameter）
- 阻止分布：元组包裹 [T]
- infer 的多重推断
- 递归条件类型的应用场景
- 条件类型中的协变与逆变

### 工具类型
- Partial\<T\>：所有属性可选
- Required\<T\>：所有属性必选
- Readonly\<T\>：所有属性只读
- Pick\<T, K\>：挑选属性
- Omit\<T, K\>：排除属性
- Record\<K, T\>：键值对映射
- Exclude\<T, U\>：联合类型排除
- Extract\<T, U\>：联合类型提取
- NonNullable\<T\>：排除 null 和 undefined
- ReturnType\<T\>：函数返回类型
- Parameters\<T\>：函数参数类型元组
- ConstructorParameters\<T\>：构造函数参数类型
- InstanceType\<T\>：构造函数实例类型

### 工具类型实现原理
- Partial 实现：映射类型 + 可选修饰符
- Required 实现：映射类型 + 必选修饰符
- Readonly 实现：映射类型 + 只读修饰符
- Pick 实现：映射类型 + keyof 约束
- Omit 实现：Pick + Exclude 组合
- Record 实现：索引签名 + 映射类型
- Exclude 实现：条件类型 + 分布式
- Extract 实现：条件类型过滤
- ReturnType 实现：infer 推断返回值
- Parameters 实现：infer 推断参数元组

## 进阶篇：模块与命名空间

### 模块系统
- ES6 模块：import、export
- 命名导出 vs 默认导出
- 导入类型：import type、inline type imports
- 动态导入：import()
- 模块解析策略：Classic、Node
- 路径映射：paths、baseUrl

### 声明文件
- .d.ts 文件：类型声明
- declare：环境声明
- 全局声明：global、全局变量
- 模块声明：declare module
- UMD 模块声明
- 三斜线指令：/// \<reference\>

### 命名空间
- namespace：组织代码
- 嵌套命名空间
- 命名空间合并
- 命名空间 vs 模块：现代项目用模块

## 实战篇：配置与工程化

### tsconfig.json 配置
- compilerOptions：编译选项
- target：编译目标（ES5、ES6、ESNext）
- module：模块系统（CommonJS、ESNext）
- lib：类型库（ES2015、DOM）
- strict：严格模式（推荐开启）
- strictNullChecks：null/undefined 检查
- noImplicitAny：禁止隐式 any
- esModuleInterop：模块互操作
- skipLibCheck：跳过库文件检查
- include、exclude、files：文件包含规则
- paths：路径映射、别名
- outDir、rootDir：输出目录

### 与 JavaScript 共存
- allowJs：允许导入 JS 文件
- checkJs：检查 JS 文件（配合 JSDoc）
- 渐进式迁移：逐步添加类型
- @ts-ignore、@ts-expect-error：忽略错误

### 类型声明管理
- @types：DefinitelyTyped 类型包
- npm install @types/node
- 自定义类型声明：编写 .d.ts
- 模块增强：declare module 扩展第三方库

### 调试与工具
- Source Map：sourceMap 配置
- VSCode 集成：智能提示、类型检查
- ts-node：直接运行 TypeScript
- tsx：快速运行工具
- tsc --watch：监听模式
- TSC 错误信息解读

## 实战篇：最佳实践

### 类型设计原则
- 优先使用 interface 定义对象类型
- 优先使用 type 定义联合、交叉类型
- 避免过度使用 any
- 善用 unknown 代替 any
- 使用字面量类型增强类型安全
- 利用 const 断言收窄类型

### 类型守卫与收窄
- typeof 守卫：原始类型判断
- instanceof 守卫：类实例判断
- in 守卫：属性存在判断
- 自定义守卫：is 关键字
- 可辨识联合：tag 字段
- 真值收窄：truthy/falsy

### 泛型最佳实践
- 泛型参数命名：T、U、K、V（约定俗成）
- 约束泛型：extends 限制范围
- 默认泛型参数：提供默认值
- 避免过度泛型化：保持简单

### 错误处理
- 类型安全的错误：自定义错误类
- Result 模式：{ ok: true, data } | { ok: false, error }
- Option 模式：Some | None
- 避免抛出异常：返回错误类型

### 性能优化
- 避免过深的类型嵌套
- 延迟类型计算：条件类型优化
- 利用类型缓存：映射类型
- skipLibCheck：跳过第三方库检查

## 实战篇：框架集成

### React + TypeScript
- 函数组件类型：React.FC、Props 接口
- Hooks 类型：useState\<T\>、useRef\<T\>
- 事件类型：React.MouseEvent、React.ChangeEvent
- 子组件类型：React.ReactNode、React.ReactElement

### Vue + TypeScript
- defineComponent：组件定义
- Props 类型：PropType\<T\>
- Composition API：Ref\<T\>、ComputedRef\<T\>
- setup 语法糖：\<script setup lang="ts"\>

### Node.js + TypeScript
- @types/node：Node.js 类型定义
- Express + TypeScript：Request、Response 类型
- 路径别名：tsconfig-paths

## 实战篇：类型体操

### 常见类型挑战
- 实现 DeepReadonly：递归只读
- 实现 DeepPartial：递归可选
- 实现 Flatten：数组拍平
- 实现 TupleToObject：元组转对象
- 实现 Capitalize：首字母大写
- 实现 Replace：字符串替换
- 实现 Append：数组追加元素

### 高级类型技巧
- 递归类型：处理嵌套结构
- 模板字面量类型：字符串操作
- 类型编程：类型级别的逻辑
- infer 的妙用：提取深层类型

### 模板字面量类型深入
- 基本语法：`${Type}`
- 字符串联合类型：自动组合
- 内置字符串操作类型：Uppercase、Lowercase、Capitalize、Uncapitalize
- 模板字面量类型的推断
- 实现 CamelCase、KebabCase 转换
- 实现路径参数提取：ExtractRouteParams

### 类型体操进阶技巧
- 类型递归的终止条件
- 元组类型的操作：First、Last、Shift、Pop、Push
- 数组长度的类型级计算
- 实现类型级加法、减法
- Union to Tuple：联合类型转元组
- 实现 Permutation：全排列类型
- 实现 C 语言风格的 printf 类型检查
- 协变与逆变的实战应用

## 下一步学习

掌握 TypeScript 后，继续深入：

- **类型体操** - type-challenges 仓库刷题
- **框架集成** - 在 React、Vue、Angular 中熟练使用
- **工程化** - monorepo、类型生成、API 类型同步
- **源码阅读** - 阅读 TypeScript 源码和知名库的类型定义

## 编译器篇：TypeScript 编译器

### 编译流程
- Scanner 扫描器：源码转 Token
- Parser 解析器：Token 转 AST
- Binder 绑定器：建立符号表
- Checker 检查器：类型检查
- Emitter 发射器：生成 JavaScript 代码
- AST 抽象语法树结构

### TypeScript Compiler API
- ts.createProgram：创建程序
- ts.createSourceFile：解析源文件
- 遍历 AST：ts.forEachChild
- 类型检查器 API：getTypeAtLocation
- 符号表查询：getSymbolAtLocation
- 代码转换：Transformer
- 自定义编译插件开发

### 类型系统内部
- 类型的表示：Type 对象
- 类型标志（TypeFlags）
- 类型关系判断：isTypeAssignableTo
- 类型推断算法
- 泛型实例化过程
- 条件类型的求值
- 映射类型的展开
- 协变与逆变的实现

TypeScript 刚开始可能觉得繁琐，写个变量都要标类型。但当项目变大、团队协作时，你会感激这些类型约束。它们就像护栏，防止你掉进坑里。坚持用严格模式，别因为报错就关掉检查，那才是 TypeScript 的精髓。
