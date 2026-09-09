# Swift 学习路线

Swift 是苹果精心打造的"现代、安全、快速"的语言——它的设计目标几乎是对着 C/Objective-C 的痛点来的:可选值消灭空指针崩溃、值类型减少共享可变状态、ARC 自动管理内存、协议优先于继承。如今它是 iOS/macOS/watchOS 全系生态的唯一主流语言(SwiftUI 时代连 UI 都"Swift 原生"了),也会用在服务端(Vapor)。**学 Swift = 打开苹果生态的大门**,而且它本身的设计理念(安全、表达力)就值得任何平台开发者学一遍。

这条线按 **基础语法 → 可选值 → 集合 → 函数与闭包 → 枚举与结构体 → 类与 ARC → 属性与协议 → 泛型与错误 → 并发 → SwiftUI/UIKit → 网络与持久化 → 工程与生态** 推进。

## 第一站:环境与语法地基

**环境**:Xcode(唯一完整 IDE:编辑器/模拟器/调试器/ Instruments 一体)、**Swift Playgrounds**(iPad/Mac 上边玩边学)、命令行 `swift` REPL 与 `swiftc` 编译。**变量与常量**:`var` 可变/`let` 常量(**默认用 let**——不可变性是 Swift 价值观);类型推断为主、显式注解 `let x: Int = 1` 为辅。
**类型**:Int/Double/Float/Bool/String/Character;**没有隐式类型转换**(`Int` 与 `Double` 混算必须显式 `Double(x)`/`Int(x)`——"类型安全"的第一课,与 C/JS 完全相反);数值字面量可加下划线 `1_000_000`。
**输出**:`print(x)` 与**字符串插值 `\(表达式)`**。**运算符**:常规 + **区间运算符**(`1...5` 闭区间/`1..<5` 半开/`...5` 单侧——数组切片与 for 循环的常客)、溢出运算符 `&+`(整型溢出默认崩溃——故意不静默);`==` 比较值。**控制流**:if/else;switch(**不需要 break,不穿透**,case 可以匹配区间/元组/模式并用 `where` 加条件——比 C 系 switch 强大得多,`default` 兜底;枚举+switch 是 Swift 的灵魂用法,见第五站);**for-in**(遍历集合与 `stride(from:to:by:)` 步进);while/repeat-while;**`guard` 是 Swift 的招牌**(早退守卫:`guard 条件 else &#123; return &#125;`——条件不满足立刻退出,成功路径保持主流程不嵌套,替代"金字塔式 if";配 `guard let` 解包见第二站)。

## 第二站:可选值——空安全的语言级解

**Optional** 是 Swift 最核心的设计:`Int?` 表示"有值或 nil";`nil` 不是指针不是魔法值,而是"缺省"的一等状态(任何类型都可选)。**为什么没有隐式解包**:一个 `Int?` 和一个 `Int` 是**不同的类型**,编译器不允许混用——null 问题从运行时挪到了编译期。**解包全家**:

- 强制解包 `x!`(不推荐——nil 时崩溃,只在"逻辑上保证非 nil"时用);
- **可选绑定 `if let x = optional`**(有值才进分支,可同时绑多个 `if let a = x, b = y` 并加 where 条件);
- **`guard let x = optional else &#123; return &#125;`**(函数开头解包,失败早退——**日常主力写法**,解出来的 x 在 guard 之后全程可用);
- **可选链 `?.`**(一路安全访问:`user?.address?.city`,链上任意 nil 整个表达式为 nil;还支持 `?` 下标与方法);
- **空合并 `??`**(`let name = user?.name ?? "匿名"` 给默认值);
- switch 可选模式(处理 .some/.none)。

**隐式解包可选值 `String!`**(声明时保证有值、用时可自动解包):IBOutlet 老代码与确实"初始化晚于构造"的场景;新代码少用。**Optional 本质是枚举**:`enum Optional&lt;T&gt; &#123; case some(T), none &#125;`——把"可选"变成类型系统的普通一员,这是 Swift 消灭了一整类 bug 的根源。最佳实践:函数返回"可能没有结果"时返回 Optional 而不是 -1/""哨兵值;能 guard 不嵌套、能 ?? 不 if、能 ?. 不 !。

## 第三站:集合类型

**Array**(有序,值类型):`[1, 2, 3]` 字面量、`let` 不可变 vs `var` 可变;方法:append/insert/remove(at:)/removeLast、contains/firstIndex、切片 `arr[1..<3]`(ArraySlice,视图非拷贝)、`+` 拼接;遍历 `for x in` 与 `enumerated()`(带索引)。
**Set**(无序唯一):`Set&lt;Int&gt;()`,增删 contains、**交并差**:intersection/union/subtracting/symmetricDifference、子集判断 isSubset。**Dictionary**(键值):`["key": value]`,增删改、`updateValue`、`dict["key", default: 0]`(带默认读取)、遍历(键值元组)。
**高阶函数**(集合的日常):`map`/`filter`/`reduce`/`sorted(by:)`/**`compactMap`(映射并丢弃 nil——解析数组里的可选值)/`flatMap`(拍平)/`forEach`/`contains(where:)`/`first(where:)`/`split`;链式 `users.filter&#123;...&#125;.map&#123;...&#125;` 一气呵成。
值语义细节:数组赋值即拷贝(实际写时复制 COW,性能无忧)——函数里改传入数组不会影响外面(与 Java 的引用共享相反)。

## 第四站:函数与闭包

**函数**:`func greet(name: String, with greeting: String = "Hi") -> String &#123;&#125;`;**参数标签双轨制**:外部标签(调用点可读:`greet(name: "x")`)与内部标签(函数体内用),`_` 省略外部标签;默认参数/可变参数 `Int...`;**inout 参数**(`&` 传入,函数内改外部变量——替代"返回新值再赋值");多返回值用元组 `(Int, String)`;函数是**一等公民**:可存变量、可作参数/返回(函数类型 `(Int) -> Bool`)。
**闭包**:`&#123; (参数) -> 返回 in 语句 &#125;`;**尾随闭包**(闭包是最后参数时可省略标签:`users.sorted &#123; $0.age < $1.age &#125;`);**简写参数 `$0`/`$1`**;**捕获值**(闭包捕获并持有上下文变量——与 JS 同概念);**`@escaping`**:默认闭包**非逃逸**(函数返回前用完),标记 escaping 才能存起来异步调用(网络回调/存储——**编译器强制你声明,这是 Swift 安全性的体现**);`@autoclosure`(参数自动包成闭包,延迟求值:`assert` 的实现);`weak`/`unowned` 捕获见第六站。

## 第五站:枚举与结构体——值类型的王国

**枚举 enum**(Swift 的枚举是"带能力的代数数据类型",远超 C/Java):`case` 简单成员;**关联值**(每个 case 可以带不同类型的数据:`case user(name: String, age: Int)`——建模"请求成功带数据/失败带错误"这类状态的首选);**原始值**(`enum Status: String &#123; case ok = "OK" &#125;`,自动 rawValue);递归枚举 `indirect`(链表/表达式树);枚举可以有方法、计算属性、遵循协议;**switch + 枚举 = 穷尽匹配**(编译器强制处理所有 case——加新 case 时所有 switch 报错提醒,这就是"编译期安全")。
**结构体 struct**(值类型,Swift 的默认选择):属性/方法/**成员逐一初始化器**(memberwise init 自动生成)、方法里改属性要标 **`mutating`**(值类型方法不能静默改自己——语义清晰);**struct vs class 选型**(Swift 面试必问):模型/值语义(Point、User、配置)用 struct(拷贝安全、无共享可变、线程友好),需要"共享同一实例、身份、继承"用 class——**Swift 标准库几乎全是 struct**,你的默认也应该是 struct。
标准协议自动合成:`Equatable`/`Hashable`/`Comparable` 声明即实现(按属性比较)。

## 第六站:类、继承与 ARC

**class**(引用类型):`init`(指定初始化器,必须保证所有存储属性有值;**convenience** 便利初始化器(调 self.init)、可失败 `init?`、`required`);`deinit`(析构,ARC 归零时);继承单继承、`override` 显式重写、`final` 禁继承;类型检查 `is`/`as?`(安全转换,得可选)/`as!`(强制,少用)/`as`(向上);`Any`/`AnyObject`(类型擦除容器,少用)。
**ARC(自动引用计数)**:Swift 的内存管理——每个引用类型对象有引用计数,归零即释放(**没有 GC 停顿,靠编译期插入 retain/release**);引用默认 strong;**`weak`**(不增加计数、对象释放自动变 nil——**必须 var + 可选**,代理 delegate、父子关系中"子指父"用它打破循环);**`unowned`**(不增加计数但不自动 nil——引用对象保证活得比自己久才用,否则野指针崩溃);**循环引用**(两个对象互持 strong,计数永不归零 = 泄漏);**闭包循环引用是重灾区**:闭包捕获 self(持 strong)→ self 又持有闭包属性 → 环;解法:**捕获列表 `[weak self]`**(闭包体里 `self?.xxx`)/`[unowned self]`(self 必活更久,如动画闭包);检测:Instruments Leaks、Xcode Memory Graph(可视化环)。

## 第七站:属性、方法与协议

**属性**:存储属性(实例/类型 `static`);**计算属性**(get/set,派生值:`var area: Double &#123; width * height &#125;`——只读可省略 get;计算属性不能是 let);**属性观察器** `willSet`/`didSet`(属性变化前后钩子——注意 init 阶段不触发;UI 同步/校验常用);`lazy var`(首次访问才初始化,闭包初始化 `lazy var x = &#123; ... &#125;()`);**类型属性/方法**:static(结构体/枚举)与 class(类,可被 override);**下标 subscript**(`obj[index]` 自定义——数组字典的本质);`mutating` 见上。
**协议 protocol**(Swift 的设计核心,对应接口的加强版):声明要求(属性 get/set、方法、初始化器);**类/结构体/枚举都能遵循**(值类型也能"面向接口");**协议扩展 extension 提供默认实现**(协议 + 扩展 = C# 默认接口方法 + mixin——遵循协议就免费获得方法库);协议继承、`AnyObject` 类专属协议、**协议组合 `P & Q`**(一个参数要求同时满足多个协议,不必定义新协议);**associatedtype**(协议里的泛型:`protocol Container &#123; associatedtype Item &#125;`——实现时指定);**POP(面向协议编程)**:Swift 的推荐架构是"用协议描述能力、用扩展给默认实现、用组合替代继承树"——对比类的继承链,POP 更灵活;**标准协议**:Equatable/Hashable/Comparable(自动合成)、Codable(见网络章)、CaseIterable(枚举全量)。

## 第八站:泛型、错误处理与扩展

**泛型**:泛型函数/类型 `struct Stack&lt;Element&gt;`;类型约束 `where Element: Equatable`;泛型 + 协议是标准库的骨架(Array&lt;Element&gt;、Optional&lt;T&gt;)。**错误处理**(Swift 不用异常泛滥,用类型化错误):定义:`enum FileError: Error &#123; case notFound &#125;`;抛出 `throws`/`throw`;处理 `do &#123; try risky() &#125; catch FileError.notFound &#123; &#125; catch &#123; &#125;`;**`try?`**(失败得 nil)/`try!`(失败崩溃,少用);**`defer`**(作用域退出时执行,**逆序**——成对的开/关资源、加/解锁的优雅写法:文件句柄用完即关,提前 return 也安全);**Result&lt;T, Error&gt;**(把成功/失败打包成返回值——回调风格 API 的现代封装);Swift 的错误哲学:**能用类型表达的状态用 Optional/Result(可预期),真正的异常才 throw**。
**扩展 extension**(Swift 最上瘾的特性):给**任何类型**(包括 String/Int 和别人的类)加方法/计算属性/下标/嵌套类型(**不能加存储属性**);**让类型在扩展里遵循协议**(`extension User: Codable &#123;&#125;`);**按扩展组织代码**(每个 extension 一个关注点:UI/数据处理/协议实现——读 Swift 源码的常见结构);条件扩展 `extension Array where Element: Equatable`(只对特定类型生效的方法)。

## 第九站:并发——async/await 与 Actor

**Swift 5.5+ 的现代并发**(替代老 GCD 回调地狱):`async` 函数(可挂起)+ `await` 调用;**Task**(创建异步工作单元,`Task &#123; &#125;`,继承所在上下文;`Task.detached` 不继承);**`async let`**(并行:`async let a = f1(); async let b = f2(); let (x, y) = try await (a, b)`);**TaskGroup/withTaskGroup**(动态数量的并行任务,结构化并发:任务有父子层级、**取消自动传播**——父任务取消子任务全停);**Actor**(Swift 并发的主角):actor 类型隔离自己的可变状态——**同一时刻只有一个任务能访问其属性**(编译器保证,数据竞争从源头消失);访问 actor 属性要 `await`;**@MainActor**(把操作钉在主线程:UI 更新注解——SwiftUI 视图自动 MainActor);**Sendable**(可安全跨并发域传递的类型标注);**AsyncSequence + `for await`**(异步流:分页/推送);`withCheckedContinuation`(把回调 API 桥接成 async——老库集成必会);**老并发要能读**:DispatchQueue(global/main/serial/concurrent、asyncAfter)、OperationQueue、`DispatchSemaphore`。
**并发选型**:UI 与轻量并发 @MainActor/Task,共享状态 Actor,大批量并行 TaskGroup。

## 第十站:SwiftUI 与 UIKit

**SwiftUI(2019+,新项目默认)**:声明式 UI——`View` 协议 + `body` 计算属性描述界面;**布局三件套** VStack/HStack/ZStack;`Text`/`Image`/`Button`/`List`/`Form`/`TextField`/`Toggle`/`Picker`/`NavigationStack`;**modifier 链**(`.font().padding().background()`)是 SwiftUI 的"CSS";**状态管理全景**(SwiftUI 的灵魂):`@State`(视图局部状态,变化自动重绘)/`@Binding`(子视图读写父状态,`$` 前缀)/`@Observable` + `@State`(iOS 17 新模型)/`@StateObject`/`@ObservedObject` + `@Published`(可观察对象,旧模型)/`@EnvironmentObject`(全局注入)/`@AppStorage`(UserDefaults 绑定);**数据流单向**:状态 → 视图,事件 → 改状态;`.task`(异步加载)/`.sheet`/`.alert` 等 modifier;**预览 Previews**(SwiftUI 开发的加速器)。
**UIKit(2008+,存量 App 与复杂交互仍是它)**:UIViewController + 生命周期(viewDidLoad/viewWillAppear…)、UIView 树(addSubview)、UINavigationController/UITabBarController、**UITableView**(dataSource/delegate 双协议——iOS 面试经典)、UICollectionView、**Auto Layout**(约束:NSLayoutConstraint/SnapKit 库)、UIView.animate 动画;**UIViewRepresentable**(SwiftUI 里嵌 UIKit 的桥)。
**iOS 15+ 策略**:新界面 SwiftUI,复杂/存量 UIKit,两套都会是常态。

## 第十一站:网络与持久化

**网络**:URLSession(苹果官方:dataTask + 回调,或 async/await 版 `try await URLSession.shared.data(from:)`——现代写法);配置(超时/缓存策略/后台下载);第三方 Alamofire(封装更爽,老项目多)/Kingfisher(图片异步加载+缓存——列表图标配)。
**JSON:Codable 是 Swift 的杀手锏**:struct 遵循 Codable → `JSONDecoder().decode(User.self, from: data)` 一行解析;`keyDecodingStrategy = .convertFromSnakeCase`(服务端 snake_case 自动转驼峰)、自定义 CodingKeys;Date 策略。
**持久化四层**:UserDefaults(小键值:设置/开关)、文件(FileManager + Documents 目录)、**Keychain(密码/Token 等敏感数据——别放 UserDefaults!)**、Core Data(重型对象图,老项目)或 **SwiftData(iOS 17 新,声明式)**、SQLite(SQLite.swift 库,复杂查询);CloudKit(iCloud 同步)。
**Combine**(苹果响应式框架,类似 RxSwift):Publisher/Subscriber/操作符——async/await 时代新代码少写,但存量代码(尤其 UIKit 绑定)要能读。

## 第十二站:测试、工具与生态

**测试**:XCTest 单元测试(XCTestCase/XCTAssertEqual 家族 + async 测试)、XCUITest UI 测试(自动点按断言)、覆盖率;Mock 靠协议 + 注入(值类型+协议让 Swift 测试特别好写);**调试**:断点 + lldb(`po` 打印对象、`expression`)、视图层级调试、**Instruments**(Time Profiler 查卡顿/Allocations 查内存/Leaks 查循环引用——上线前必跑)。
**包管理**:Swift Package Manager(官方:Package.swift、Xcode File > Add Packages;库作者默认发 SPM)、CocoaPods(历史存量,会读 Podfile 即可);**版本**:Swift 5.x 长线演进(5.5 并发/5.9 macro;6 完整并发与严格检查)、Xcode 每年大版本(SwiftUI 也随之进化——看 WWDC 是苹果开发者的年课)。
**跨平台**:Swift on Server(Vapor 框架写后端)、Swift Playgrounds;macOS 开发(SwiftUI + AppKit)。**学习资源**:官方《The Swift Programming Language》(免费,必读)、Stanford CS193p(SwiftUI 经典课程)、WWDC 视频、Hacking with Swift(实战教程站)。
**常用第三方**:Alamofire/Kingfisher/SnapKit/RxSwift/SwiftLint(规范)。

## 通关标准

能独立做到:不看文档写出用 guard let + 可选链 + ?? 处理可选值的函数;说清 struct 与 class、weak 与 unowned、@escaping 的意义;会建 Codable 模型解析 JSON;用 async/await + Actor 写过并发代码并解释为什么 Actor 防数据竞争;能用 SwiftUI 的 @State/@Binding/可观察对象搭一个有列表、导航、表单的 App 并通过 XCTest 给模型层写了测试——Swift 主线通关。

Swift 年轻但成熟,它教你的不只是苹果生态的开发,更是"现代语言如何用类型系统消灭一整类 bug"的设计理念:可选值、值类型、协议优先、结构化并发——每一条都值得带着思考去学。打开 Xcode,建一个 iOS App,从 SwiftUI 的 Hello World 开始;当你第一次被编译器拦住一个"其他语言要跑到线上才炸"的错误时,你会爱上这种安全感。
