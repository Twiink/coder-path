# TypeScript 学习路线

TypeScript 是 JavaScript 的超集:所有 JS 代码都是合法的 TS,TS 只是在上面加了一套**类型系统**,并在编译时把类型全部擦除、输出干净 JS。如果说 JavaScript 是"能跑就行"的野路子,TypeScript 就是"跑得稳才算数"的正规军——把错误从"运行时才炸"提前到"写代码时就告诉你",还给编辑器装上智能提示与安全重构。如今新项目几乎默认 TS,项目越大、人越多,类型护栏的价值越明显。

这条线按 **类型入门 → 函数与对象 → 联合与收窄 → 泛型 → 高级类型编程 → 模块与声明 → 工程化配置 → 类型设计实战 → 框架集成 → 类型体操 → 编译器内部** 推进。前四站就能干活,后面决定你吃不吃得透。

## 第一站:基本类型与类型注解

先把"素材"认全。**原始类型**:`number`、`string`、`boolean`、`null`、`undefined`、`symbol`、`bigint` 与 JS 一一对应;`number` 没有整数小数之分(和 JS 一样所有数字一个类型);`symbol` 用 `unique symbol` 做字面量类型(少见但类型体操里会出现)。**数组**:`number[]` 或 `Array<number>`;**元组 tuple**:`[string, number]` 固定长度与位置类型,支持 `readonly [string, number]`(只读元组,`as const` 推断的产物)、可选元素 `[string, number?]`、剩余元素 `[string, ...number[]]`——React 的 useState 返回值就是元组。**枚举 enum**:能用,但现代风格更推荐 `as const` 对象或字符串字面量联合(enum 有运行时对象与"数字枚举反向映射"的历史包袱,`const enum` 又依赖特定编译配置,团队内部统一即可)。

四个"特殊类型"要分清:**`any`**(类型逃生舱,等于关闭检查,少用)、**`unknown`**(类型安全的 any:不知道是什么,用前必须收窄——处理外部输入的首选)、**`void`**(函数无返回,注意它不代表 undefined,回调里"不关心返回值"用它)、**`never`**(永不返回:抛错函数、死循环、**穷尽检查**——switch 处理完所有 case 后 default 赋给 never 变量,以后新增 case 忘处理会编译报错,这是 never 最实用的场景)。**字面量类型**:具体的值当类型,`'success' | 'error'` 就是"现代枚举";`bigint` 字面量、模板字面量类型见后。

**类型注解与推断**:能推断就不写(函数参数与导出边界建议显式);`let` 推断为宽类型、`const` 推断为字面量类型——"我明明赋了 'a' 它却不认"的困惑多源于此;数组推断取"最佳公共类型";**上下文类型推断**(回调参数自动获得类型,`arr.map(x => …)` 的 x 不用标)。**类型断言 `as`**(尖括号写法与 JSX 冲突别用);断言只能"收窄或放宽到重叠类型",强转要过 unknown(双断言,是代码坏味道);**非空断言 `!`**(告诉编译器"这里不是 null",运行时风险自负,少用;更稳的是收窄或可选链)。

## 第二站:函数与对象类型

**函数**:参数/返回值注解、可选参数 `?`(必须在必选之后)、默认值参数(可省 `?`)、剩余参数 `...args: number[]`;**函数重载**:同函数多签名(实现签名要兼容所有重载且不对外可见)——DOM 的 getElementById、库的复杂 API 都靠它;**this 参数**:`function f(this: Window, …)` 显式声明 this 类型,回调场景救星(配合 `noImplicitThis`)。函数类型两种写法:类型表达式 `(a: number) => void` 与**调用签名** `{ (a: number): void }`(描述"可调用对象",还能同时带属性,`bind`/`call` 的类型就是这么描述的);**构造签名** `new (a: string) => Thing` 描述类/构造函数。

**对象类型**:字面量形状 `{ name: string; age?: number; readonly id: string }`;可选属性 `?`;**只读 `readonly`**(编译期约束;注意它是浅的,数组用 `ReadonlyArray`/`readonly T[]`);**索引签名** `[key: string]: unknown`(描述字典;数值索引 `[index: number]` 用于类数组);**interface 与 type 怎么选**:描述对象/类用 interface(可 `extends`、同名自动**声明合并**),组合类型用 type(联合 `|`、交叉 `&`、映射结果);两者大部分场景互换,团队统一即可。**属性检查的"新鲜字面量"规则**:直接把对象字面量赋给类型时多出的属性会报错(多余属性检查),先存变量再传就放行——常见困惑,知道机制就不懵;交叉类型 `A & B` 合并属性,同名属性类型冲突时可能变 never,用 Omit 先剔再交。

## 第三站:联合类型与类型收窄——TS 的看家本领

**联合类型** `string | number | null` 表达"可能是这些之一";配合**收窄**才有意义:typeof(原始类型)、`instanceof`(类)、`in`(属性存在)、`Array.isArray`(内置守卫)、**真值收窄**(if (x) 后排除 null/undefined/0/''/NaN)、`===` 比较收窄、`switch` 收窄、`??=` 赋值收窄、**判别收窄**(可辨识联合的 tag)。

**可辨识联合(discriminated union)** 是 TS 最值钱的模式:成员共享一个字面量 tag(`type Result = { ok: true; data: T } | { ok: false; error: string }`),switch tag 后每个分支自动收窄——**错误处理、状态机、表单状态、API 响应的标准建模**,配合 never 穷尽检查,新增分支漏处理编译器会报警。**类型守卫**:把收窄逻辑封装成 `x is T` 返回值的函数(自定义守卫),让复杂判断也能被编译器理解;`asserts x is T` 断言守卫(校验函数,失败抛错,之后类型收窄——运行时校验库(zod)的 TS 推导就常用这类技巧)。

## 第四站:泛型——类型的函数

**泛型**是"类型的参数":`function identity<T>(arg: T): T`——输入输出类型联动,调用时自动推断(也能显式 `<User>(...)`)。考点清单:

- **泛型约束 `extends`**:`T extends HasId` 限制 T 必须有某形状,约束内才能安全访问属性;
- **`keyof` 配合**:`function get<T, K extends keyof T>(obj: T, key: K): T[K]` 是"类型安全的取值器"样板;
- 默认泛型参数 `<T = string>`、多参数 `<T, U>`、泛型可以用于接口/类/工具类型;
- 泛型在**类**(class Box<T> 存值取类型)、**React 组件**(`useState<T>`、`List<T>` 泛型组件)里的实战;
- **泛型上下文推断**:回调参数反向推断(T 由参数数组推,回调参数自动获得 T)——写 `Array.prototype` 风格 API 时常用;
- 约定俗成的命名:T/U 类型、K 键、V 值、P 属性、R 返回,看多了就习惯;
- 经典封装:API 请求 `request<T>(url): Promise<T>`、事件发射器 `emit<K extends keyof Events>(name: K, data: Events[K])`。

## 第五站:高级类型编程——映射、条件、infer、工具类型

**类型操作符**:`typeof`(值→类型)、`keyof`(对象→键联合)、`in`(遍历键,映射类型里用)、`extends`(条件判断)、**`infer`**(从类型里"抠"子类型)、`as const`(值断言最窄字面量:配 `satisfies` 用——TS 4.9+ 的 `satisfies` 既要"按类型检查"又要"保留精确字面量推断",`const routes = {...} satisfies Record<string, Route>` 是经典场景)。

**映射类型**:批量改类型的工厂,`{ [K in keyof T]: T[K] }` 遍历键;加/减修饰符(`readonly`/`?` 与 `-readonly`/`-?`);**键重映射** `as`(`[K in keyof T as \`get${Capitalize<string & K>}\`]` 造新键);`as const` 配合映射做枚举对象。**条件类型**:`T extends U ? X : Y`——TS 的 if;注意裸类型参数的**分布式**:联合类型自动逐个分发(Exclude 的原理),不想分发就 `[T]` 包一层;**infer 的妙用**:`ReturnType<T>` = `T extends (...args: any[]) => infer R ? R : never`,同理 Parameters/InstanceType/ConstructorParameters——工具类型全是"映射 + 条件 + infer"三块乐高拼出来的,能手写它们的实现(每个两三行),你对 TS 的理解立刻上台阶。

**内置工具类型全清单**:`Partial`(全可选)/`Required`(全必选)/`Readonly`(全只读)/`Pick<T,K>`(挑属性)/`Omit<T,K>`(排除属性,实现 = Pick + Exclude)/`Record<K,V>`(键值映射,`Record<string, number>` 就是索引签名语法糖)/`Exclude<T,U>`/`Extract<T,U>`(联合剔除/提取)/`NonNullable`/`ReturnType`/`Parameters`/`ConstructorParameters`/`InstanceType`/`Awaited`(解包 Promise,async 场景)/`Uppercase`/`Lowercase`/`Capitalize`/`Uncapitalize`(字符串操作类型)。**模板字面量类型**:`\`${T}Id\`` 拼字符串类型,`${number}` 匹配任意数字串——做事件名映射(`click-${string}`)、路由参数提取的利器。

## 第六站:类、模块与声明

**类**:访问修饰符 `public`/`private`(编译期)/`protected`(子类可见)/`readonly`;**参数属性**(constructor 参数前加修饰符自动变属性,少写一半样板);`implements` 实现接口、`abstract` 抽象类(不能实例化,抽象方法强制子类实现);`static` 静态成员;`#` 真私有字段(ES 标准,与 TS private 并存,新代码用 #)。**声明合并**:interface 同名合并(给第三方库补类型、给全局 Window 加自定义属性 `declare global { interface Window { xxx: string } }`)、namespace 合并(古董,认识即可)。

**模块**:ESM 语法同 JS;TS 特有——`import type`/`inline type`(类型导入编译期擦除,verbatimModuleSyntax 下必须)、`export type`;路径别名 `paths` + `baseUrl`(配 `@/`);**模块解析**:`moduleResolution: bundler`(现代打包器)/`node16`/`nodenext`(Node ESM 严格模式,相对导入要写扩展名!)。**声明文件 .d.ts**:只存类型;`@types/*`(DefinitelyTyped,如 @types/node/@types/express)补第三方类型;没有类型又没人维护的库:自己 `declare module 'xxx'` 声明最小形状,或 `// @ts-expect-error` 压住;编写 d.ts 的要点:导出类型/函数重载/泛型默认值。**三斜线指令** `/// <reference types="node" />` 是老式引用,新代码基本不用(types 字段替代)。**enum vs const 断言** 团队定夺;`verbatimModuleSyntax`/`isolatedModules` 开启后写法更规范(单文件编译友好)。

## 第七站:工程化——tsconfig 与工具链

**tsconfig.json** 重点项:`target`(编译目标 ES 版本)/`module`(模块格式,Node 现代用 nodenext)/`lib`(环境类型:ES2023/DOM/DOM.Iterable——Node 项目别引 DOM)/`strict: true`(总开关,必须开,内含:`strictNullChecks`(null/undefined 不随便赋值——TS 核心价值)、`noImplicitAny`(禁隐式 any)、`strictFunctionTypes`(函数参数逆变检查)、`strictPropertyInitialization`(类属性必须初始化)、`noUncheckedIndexedAccess`(索引访问可能 undefined,严格党的最爱));其他:`noEmit`(仅检查,配合打包器)、`declaration`(+`declarationDir` 输出 d.ts,写库要开)、`sourceMap`、`esModuleInterop`(默认开,让 CJS 默认导入不报错)、`skipLibCheck`(跳第三方声明检查,提速)、`isolatedModules`、`incremental`/`composite`(**项目引用 project references**:monorepo 按包拆分类型检查,`tsc -b` 增量构建——大仓性能解药)、`include`/`exclude`。**CLI**:`tsc`(编译/检查一体)、`tsc --watch`、`tsc --noEmit`(CI 里类型检查)。**运行工具**:ts-node(老)、tsx(现代零配置,esbuild 驱动,推荐)、`tsc` 编译后 node 跑(生产姿势);**与 Babel/SWC 的关系**:Babel/SWC 只转译不检查类型(快),类型检查交给 tsc 或编辑器——"为什么构建没报类型错"的答案。**编辑器**:VSCode 内置 TS server,`// @ts-check` + JSDoc 让 .js 文件也有检查(渐进迁移:allowJs + checkJs,一行行 .js → .ts)。

## 第八站:类型设计实战——写"好类型"的艺术

- **interface 描述对象,type 组合类型**;状态用可辨识联合表达(别用三个互相矛盾的 boolean);外部数据(API 响应、JSON.parse、localStorage 读取)一律先 `unknown` 再收窄——用 zod 做运行时校验,类型与校验同源(`z.infer<typeof schema>`),这是现代全栈的黄金组合(trpc 就是在类型层面打通前后端);
- **any 是债,unknown 是墙**:函数边界(参数/返回值)宁可 unknown + 收窄;`as` 滥用是类型腐化的开始;逃逸 hatch:`@ts-expect-error`(比 @ts-ignore 好:错误消失时会提醒你删);
- **避免过度泛型化**:三层嵌套泛型没人看得懂;泛型参数命名遵循惯例;约束能写就写(不写约束 = 隐式 any);
- **错误处理 Result 模式**:可辨识联合 `{ ok: true, data } | { ok: false, error }` 或 Option(Some/None)模式——"异常只在边界抛,业务流里走类型",比裸 throw 可预测;
- **类型性能**:别搞深递归类型(TS 有递归深度上限)、条件类型分发会指数膨胀、`skipLibCheck` 开着、复杂体操放 .d.ts 或单独文件;类型检查慢先查"大联合 + 条件类型"。

## 第九站:框架集成——类型落地

**React + TS**:组件 Props 用 interface + `PropsWithChildren`;事件类型(`React.ChangeEvent<HTMLInputElement>` 别 any);`useRef<T>(null)`(泛型带 null,配 `useRef<HTMLInputElement>(null)` 后 `ref.current?.focus()`);`useState<User | null>(null)`;`ComponentProps<'button'>` 拿原生属性(封装 Button 组件);多态组件 `as` prop 泛型;自定义 Hook 返回类型显式标注(元组 `as const` 保类型,或返回对象)。**Vue + TS**:`<script setup lang="ts">`、`defineProps<{ user: User }>()` + `withDefaults`、`defineEmits<{ (e: 'save', u: User): void }>()`、`ref<User | null>(null)`、`PropType`(选项式用)。**Node + TS**:`@types/node`、Express 泛型 `Request<Params, ResBody, ReqBody>`、路径别名 tsconfig-paths;**全栈类型打通**:trpc/GraphQL codegen/OpenAPI 生成——前后端共享类型,告别"接口文档与代码不一致"。

## 第十站:类型体操——给大脑的举铁

类型体操 = 用类型系统"编程":`DeepReadonly`(递归只读)、`DeepPartial`、`Flatten`(数组拍平)、`CamelCase`/`KebabCase`、`UnwrapPromise`(infer 递归)、`TupleToUnion`、路由字符串提取(`ExtractRouteParams<'/user/:id'>`)、`UnionToIntersection`、`Permutation`(全排列)、`Length`(元组长度当数字用:类型级加法/减法靠元组 push/pop)——type-challenges 仓库有全套题库,建议按 Easy → Medium → Hard 刷。它的价值不在生产代码炫技(生产里写 DeepReadonly 是过度设计),而在**训练对类型系统能力的感知**:体操练多了,写业务类型时"这能不能用类型表达/怎么写最稳"的直觉会强很多;看知名库的类型定义(axios/zod/react 的 d.ts)也更有底气。

## 第十一站:编译器内部

TS 本质是编译器:源码 → **Scanner** 分词 → **Parser** 建 AST → **Binder** 建符号表 → **Checker** 类型检查(最耗时)→ **Emitter** 生成 JS(类型在此被擦除)。**类型只存在于编译期**——运行时保护必须靠守卫函数或 zod;`tsc` 错误信息格式(文件:行:列 + 错误码 TSxxxx)要会读,`--pretty`/`--diagnostics` 调输出。**Compiler API**(ts.createProgram/getSourceFile/forEachChild/getTypeAtLocation/Transformer)是写代码生成工具、LSP 插件的基础——99% 的人用不到,但知道"类型检查器是可以编程调用的"这一事实,能帮你理解很多工程工具(ast-grep、TS-morph 等)的原理。**类型系统内部**:Type 对象/TypeFlags、`isTypeAssignableTo`、结构化类型系统的运行时体现(鸭子类型:形状相同即兼容,与 Java 名义类型不同;模拟名义类型用 branded type `type UserId = string & { __brand: 'UserId' }`)、协变与逆变(数组协变、函数参数逆变——strictFunctionTypes 开关控制)、`any` 的双向兼容是类型系统的"漏洞"。

## 通关标准

能独立做到:全程 `strict: true` 零 `@ts-ignore` 写完一个带泛型 API 封装 + 可辨识联合状态 + zod 校验的 React/Vue 应用;给任意工具类型说出作用并能手写 Partial/Pick/ReturnType 实现;读懂第三方库 .d.ts 并能为无类型库补最小声明;配置过 tsconfig(知道 strict 全家各管什么、项目引用怎么提速);处理过至少一种"类型体操"题——TypeScript 主线通关。

最后说句掏心窝的:TS 刚上手确实繁琐,"写个变量都要标类型";但当项目变大、同事变多、重构变频,你会感激这些"啰嗦"。坚持严格模式,别因为报错烦就关掉检查——类型报错是编译器在替你踩雷,它拦下的每个错,都是本该在凌晨两点线上炸掉的 bug。
