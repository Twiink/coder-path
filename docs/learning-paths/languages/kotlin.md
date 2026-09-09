# Kotlin 学习路线

Kotlin 是 JetBrains 出品的"现代化 Java":简洁到样板几乎消失,安全到空指针成为编译错误,又与 Java **100% 互操作**(同一个项目里两种语言随便混写)。Google 宣布 Android 开发 **Kotlin-first** 后,它成了移动端第一语言;在服务端(Spring Boot/Ktor)与多平台(KMP)上也势头强劲。如果你会 Java,学 Kotlin 大约一周就能上手写——但**别只当"少写几行"的 Java**,它的函数式风格、协程与 DSL 是新的思维方式。

这条线按 **基础语法 → Null 安全 → 函数与 Lambda → 集合 → 类与对象 → 继承与委托 → 泛型 → 协程 → Android → 多平台与服务端 → 测试与工程** 推进。

## 第一站:基础语法

**入口**:`fun main() &#123;&#125;`(顶层函数,没有 class 仪式);`println()`。**变量**:`var` 可变/`val` 只读(**默认 val**——不可变优先);类型推断为主,注解 `val x: Int = 1`。**类型**:Int/Long/Double/Float/Boolean/String/Char;**没有"基本类型 vs 包装类型"之分**(编译期自动优化,`Int?` 才装箱);`String` 与 Java 相同。
**字符串模板**:`"Hello, $name! 长度 $&#123;name.length&#125;"`(比 Java 拼接优雅一百倍);三引号 `"""多行"""`(JSON/正则/模板字符串)。**控制流**:`if` **是表达式**(有值:`val max = if (a > b) a else b`——没有三元运算符,if 就是);**`when` 表达式**(Kotlin 版 switch,但强得多):可匹配常量/区间(`in 1..10`)/类型(`is String`)/无参布尔分支(`when &#123; x > 0 -> ... &#125;`),每个分支是表达式,`else` 兜底;for:遍历集合与**区间**(`1..10`/`1 until 10`/`10 downTo 1`/`step 2`),没有 C 风格 for;while/do-while。
**运算符的坑**:`==` 是**结构相等**(调 equals,与 Java 相反!)、`===` 才是引用相等——从 Java 过来第一个要改的肌肉记忆;`in` 判断包含、`!in`。**字符串比较**:直接用 `==`(再也不用 equals)。**Int 溢出**:Kotlin 的 Int 运算默认不检查溢出(与 Java 相同),`Math` 相关看 java.lang。

## 第二站:Null 安全——Kotlin 的立身之本

**类型系统内置可空性**:`String` 与 `String?` 是两个类型——**可空类型的值不检查直接用 = 编译错误**,空指针从"运行时崩溃"变成"编译期拦截",这是 Kotlin 消灭 NPE 的方式。四件套:`?.`(安全调用:`user?.address?.city`,链上任意 null 得 null)、**`?:` Elvis 运算符**(`val name = user?.name ?: "匿名"`——"给默认值"的日常主力)、`!!` 非空断言(告诉编译器"我保证非空",null 时抛 NPE——**Java 迁移期工具,新代码尽量别用**)、`as?` 安全转换(失败得 null,替代 Java 的 ClassCastException)。
**智能转换(smart cast)**:局部变量判空后编译器自动视为非空(`if (x != null) &#123; x.length &#125;` 直接可用,无需再转换)——配合 val 与不可变,空安全是"零成本"的。**平台类型 `String!`**:调 Java 代码返回的类型,编译器不强制(Kotlin 侧可当可空也可当非空)——**互操作的红线:Java 返回 null 而你按非空用,运行时照样炸**,所以 Java 边界要小心。
组合技巧:`?.let &#123; &#125;`(非空才执行块)、`takeIf`/`takeUnless`、`require`/`check`(前置条件断言)。

## 第三站:函数与 Lambda

**函数**:`fun add(a: Int, b: Int): Int = a + b`(**表达式体**单行函数)、**默认参数**(`fun greet(name: String = "world")`——调用方可省略,替代 Java 的方法重载海)、**命名参数**(`greet(name = "Kotlin")`——参数多时可读性神器,还能跳过中间默认参)、`vararg` 可变参数、局部函数(函数内定义函数)、**中缀函数 `infix`**(`1 shl 2`/自定义 `infix fun Int.pow2()`,自然语言式调用)。
**扩展函数**(Kotlin 的招牌特性):`fun String.isEmail(): Boolean = ...`——**给任何类(包括 Java 第三方类)加方法**,不用继承不用装饰器;标准库全是扩展(集合操作符、协程的 `viewModelScope` 本质也是扩展);扩展函数是**静态分发**(本质是静态方法 + 接收者参数,不是真的改类);**扩展属性**同理(不能有幕后字段)。
**高阶函数**:函数类型 `(Int, Int) -> Int`,函数可作参数/返回值——Kotlin 集合 API 与协程全建立在这上面。**Lambda**:(&#123; a: Int, b: Int -> a + b &#125;);**尾随 lambda**(最后一个参数是 lambda 可提出括号:`list.map &#123; it * 2 &#125;`)、**`it` 隐式参数**(单参 lambda 自动命名)、未用参数用 `_`;**函数引用 `::method`**。
**`inline`**:高阶函数默认会为 lambda 建对象,**内联**把 lambda 体直接展开(零开销 + 允许非局部返回)——性能敏感与 reified(见泛型章)用,普通代码别滥用。

## 第四站:集合——操作符的海洋

Kotlin 集合**默认只读**:`listOf(1,2,3)` 返回 `List`(只读接口:不能 add)**vs** `mutableListOf` 返回 `MutableList`——函数参数声明 `List` 就没人能改它(编译期防护);注意**只读 ≠ 不可变**(底层可能仍是可变集合,别跨线程共享)。
三兄弟:List/Set/Map + 各自 mutable 版;`emptyList`/`listOfNotNull`/`buildList`(构建器)。**操作符库**(全量过一遍,日常 80% 代码是它们):过滤:`filter`/`filterNot`/`filterNotNull`/`filterIsInstance`/`partition`(二分);映射:`map`/`mapIndexed`/`mapNotNull`/**`flatMap`(摊平)/`associate`(转 Map)**;聚合:`reduce`/`fold`(带初始值)/`sumOf`/`count`/`average`;查找:`find`/`firstOrNull`/`lastOrNull`(用 OrNull 版本避免异常)/`indexOfFirst`/`any`/`all`/`none`/`contains`;分组:`groupBy`/`groupingBy`(可折叠分组);排序:`sorted`/`sortedBy`(指定键)/`sortedWith`(比较器)/`reversed`/`shuffled`;切片与窗口:`take`/`drop`/`chunked`(分批)/`windowed`(滑窗)/`zip`;其他:`distinct`/`distinctBy`、`joinToString`(输出列表标配)、`toSet`/`toMap` 互转、解构(遍历 Map 的 `(k, v)`)。
**Sequence(惰性序列)**:集合的每个操作符都立即执行(中间集合),大数据链式处理用 `asSequence()`——**只在终结操作( toList/first 等)时计算**,减少中间对象,配合 `generateSequence`/`sequence &#123;&#125;`(协程式 yield);**什么时候用**:数据量大或链长,小集合直接用 list 反而更快。
**集合与 Java**:toList/toMutableList/toTypedArray 互转;`list.forEachIndexed` 等。

## 第五站:类与对象

**类**:`class Person(val name: String, var age: Int)`——**主构造器直接在类头**,参数带 val/var 自动成为属性(样板终结者);`constructor` 次构造器(必须委托主构造);**`init` 初始化块**(属性初始化与校验:主构造执行时机)。
**属性**:自定义 getter/setter(`val isAdult get() = age >= 18`——计算属性)、**幕后字段 `field`**(访问器里引用自身属性用,防递归);属性初始化顺序。**data class**(日常之王):`data class User(val id: Long, val name: String)` 自动生成 equals/hashCode/toString/**copy**(非破坏更新:`user.copy(name = "新")`)/**componentN 解构**(`val (id, name) = user`)——DTO/模型层首选;**密封类 sealed**:受限继承(子类必须同文件/同包),when 配 sealed **穷尽匹配**(编译器不让你漏分支)——**UI 状态/网络结果的建模首选**:(sealed class Result &#123; data class Success(val data: T): Result(); data class Error(val msg: String): Result() &#125;)。
**枚举 enum class**:可带属性与方法(比 Java 简洁)。**object 三兄弟**:`object` 声明(**单例**:`object Config &#123; val url = ... &#125;`——没有 static 的 Kotlin 单例姿势)、`companion object`(**伴生对象**:类级成员(替代 static),可命名可实现接口;`@JvmStatic` 给 Java 调用)、**对象表达式**(匿名类:`val x = object : Listener &#123; ... &#125;`——替代 Java 匿名内部类)。
嵌套类(默认静态,不持外部引用)vs `inner class`(持外部引用,要 outer 前缀)。

## 第六站:继承、接口与委托

**默认 final**:Kotlin 的类默认**不可继承**(与 Java 相反——这是刻意的:继承是设计决策,要显式 `open`);`open class`/`open fun` 开放,`override` 必须显式(编译器强制);抽象类 abstract;**接口 interface**:可以有属性与**默认实现**(多实现,比 Java 8 更完整);**属性也可以 override**。
**委托 by**(Kotlin 的语法糖高峰):**类委托**:`class CountingSet(val inner: MutableSet&lt;Int&gt;) : MutableSet&lt;Int&gt; by inner`——接口实现全部转发给 inner,**一行实现装饰器模式**(组合替代继承);**属性委托**:`by lazy &#123; &#125;`(首次访问才初始化,线程安全——val 延迟初始化的标准解)、`by observable(初始值) &#123; prop, old, new -> &#125;`(属性变化监听)、`by vetoable`(可拦截)、`by map`(属性存在 Map 里——动态配置)、**自定义委托**(实现 `operator getValue/setValue`,配合 `ReadOnlyProperty`——ViewModel 的 by viewModels() 全是委托);**标准库的 by lazy 是面试必问**(线程模式 SYNCHRONIZED/PUBLICATION/NONE)。

## 第七站:泛型、异常与注解反射

**泛型**:与 Java 同为**类型擦除**,但语法不同:**声明处型变**——`interface List<out T>`(协变:List&lt;String&gt; 是 List&lt;Any&gt; 的子类型,生产者,只能 out 不能 in——Java 的 `? extends` 变成了声明处标注)、`interface Comparable<in T>`(逆变,消费者);不变默认;**星投影 `*`**(Java 的 `?`);约束 `where T : Comparable&lt;T&gt;, T : Any`;**`reified`**(内联 + 具体化类型参数):`inline fun <reified T> Gson.fromJson(json: String): T`——**突破擦除,在函数里拿 T::class**(JSON 解析、类型安全 API 的标准姿势)。
**异常**:与 Java 同体系但**没有受检异常**(不用声明 throws——Kotlin 认为受检异常是 Java 的失败设计);`try` 是**表达式**(可返回值);`Nothing` 类型(永不返回:`error("msg")`/`TODO()` 返回 Nothing,可用于"不可能分支"的类型表达);自定义异常同 Java。
**注解**:与 Java 注解互操作,自定义注解 `annotation class JsonName(val name: String)`(构造器参数);**反射**:Kotlin 反射基于 KClass(`User::class`——比 Java 的 User.class 更全),KProperty/KFunction 可调用,`javaClass`/`.java` 转 Java 反射;**kotlin-reflect 依赖**体积大,Android 上慎用(用注解处理器/kapt 或编译期方案)。

## 第八站:协程——Kotlin 的杀手锏

**协程不是语言关键字,是官方库 kotlinx-coroutines**(设计精良的"线程管理的框架")。核心心智:**suspend 挂起函数**——可以"暂停"而不阻塞线程(暂停时线程去干别的),恢复后继续;**挂起函数只能在协程或其他挂起函数里调用**。**三个构建器**:`launch`(火并忘:返回 Job,无结果)、`async`(有结果:返回 Deferred,`await()` 取)、`runBlocking`(阻塞当前线程等协程——**main 函数与测试的桥,业务代码别用**)。
**结构化并发**(Kotlin 协程的骄傲):协程必须有 **CoroutineScope**(作用域),scope 取消 → 所有子协程取消;**取消自动传播、父协程等待子协程**——没有"泄漏的孤儿任务";`GlobalScope` 是反模式(应用级孤儿),Android 用 `viewModelScope`/`lifecycleScope`(自动随生命周期取消),服务端用 `CoroutineScope(SupervisorJob())` 自定义。
**上下文与调度器 Dispatchers**:`Main`(UI 线程,Android)/`IO`(网络与磁盘,线程池大)/`Default`(CPU 密集,线程数=核数)/`Unconfined`(不限定);`withContext(Dispatchers.IO) &#123; &#125;`(切线程干活——**"一步切换"的日常写法**)。
**取消是协作式**的:只有挂起点(check 点)才响应取消,`isActive` 检查、`ensureActive`、`withTimeout`(超时即抛);CPU 密集循环要主动检查。**Job 层级**:`SupervisorJob`(子协程失败不影响兄弟——UI 场景每个任务独立失败时用)vs 默认(失败向上传播)。
**Channel**:协程间通信(生产者-消费者,`send`/`receive`——容量与缓冲)。**Flow(冷数据流)**:`flow &#123; emit(x) &#125;` 构建,与集合同款操作符(map/filter……)+ 协程能力(挂起发射);`collect` 才执行(冷:每次收集重新跑);操作符:`map/filter/transform`、`flowOn`(切上游上下文——注意位置语义)、`buffer`(背压)、`catch`/`onCompletion`(错误处理在流内)、`debounce/sample`(输入联想)、`flatMapConcat/Merge/Latest`(异步展平三兄弟,竞态答案);**热流两兄弟**:`StateFlow`(持有状态,`value` 可读,去重——**UI 状态的首选,替代 LiveData 的新方向**)与 `SharedFlow`(事件广播,无状态);`collectAsState`(Compose 消费)。
**测试**:`runTest` + 虚拟时间(StandardTestDispatcher)——协程/Flow 测试不真等,官方推荐。

## 第九站:Android 开发(主战场)

**架构演进一句话**:Activity/Fragment(系统组件,生命周期复杂)→ Jetpack 组件(ViewModel/Room/Navigation/WorkManager)→ 声明式 Compose。**Jetpack 全家**(Android 官方组件库):`ViewModel`(持有 UI 状态,旋转屏幕不丢——**别把状态放 Activity**)+ `LiveData`(生命周期感知的可观察,老方案)或 **StateFlow**(新方案)、`Room`(SQLite 的注解 ORM:Entity 表/Dao 接口(挂起函数与 Flow 查询)/Database;配 KSP 编译期生成)、`Navigation`(导航图 + SafeArgs 类型安全传参;Compose 用 navigation-compose)、`WorkManager`(延迟/约束后台任务)、`DataStore`(键值,替代 SharedPreferences)、`Paging 3`(分页加载)。
**Jetpack Compose(2019+,新项目默认)**:**声明式 UI**——`@Composable` 函数描述界面(与 SwiftUI/React 同心智,会一个学三个快);**重组**:状态变 → 自动重绘最小范围;状态:`remember`/`mutableStateOf`(局部)/`rememberSaveable`(进程重建存活)/`ViewModel + collectAsState`(页面级);布局 Column/Row/Box、`LazyColumn`(列表,key 参数)、Material3 主题、`Modifier` 链(对应 SwiftUI modifier/React style);导航与对话框/动画同套声明式。
**传统 View 体系**(存量项目):Activity 生命周期(onCreate…)、`setContentView` + findViewById(或 ViewBinding——类型安全找视图)、Fragment、RecyclerView(适配器模式)、AsyncTask 已死。**依赖注入**:**Hilt**(基于 Dagger 的编译期 DI,Google 推荐:@HiltAndroidApp/@Inject/@Module/@Singleton)、Koin(运行时 DI,轻量无 KSP)。
**权限/清单/签名/多渠道**是 Android 工程课,边做边学。

## 第十站:多平台与服务端

**Kotlin Multiplatform(KMP)**:一套业务逻辑(网络/数据/领域)多端复用——`commonMain`(共享代码)+ `expect`/`actual`(平台差异声明/实现,如文件路径与日期 API)+ androidMain/iosMain 源集;配套:kotlinx.serialization(多平台 JSON)、Ktor Client(多平台 HTTP)、SQLDelight(多平台 SQL)、**Compose Multiplatform**(UI 也共享,iOS 支持已可用)——"一次编写、Android/iOS/桌面运行"是 Kotlin 的远期愿景。
**服务端**:**Ktor**(JetBrains 轻量异步框架:Routing 路由、ContentNegotiation + kotlinx.serialization 自动 JSON、Netty 引擎、TestHost 测试——协程原生);或 **Spring Boot + Kotlin**(Java 生态全都要,语法更爽);Exposed(官方 ORM)/Room 类似物。
**Gradle Kotlin DSL**:`build.gradle.kts`(类型安全、补全友好——现代 Gradle 默认)。**脚本**:Kotlin Script 写自动化(了解)。

## 第十一站:测试与工程

**测试栈**:JUnit5 + Kotlin Test;断言 `assertEquals`/`assertTrue` 或 kotlin.test 的 `shouldBe` 风格;**MockK**(Kotlin 原生 mock:协程支持 `coEvery`/`coVerify`、`every &#123; &#125; answers &#123; &#125;`);协程/Flow 测试 `runTest` + `advanceTimeBy`(虚拟时间);Android:本地单测(Robolectric 可选)/插桩测试/Compose UI 测试(`createComposeRule` + `onNodeWithText`);内存泄漏:LeakCanary。
**性能**:优先避免装箱(`IntArray` vs `Array&lt;Int&gt;`)与多余对象(`value class`:`@JvmInline value class UserId(val value: Long)`——零开销包装,防"传错参数"的编译期防线)、Sequence 大数据、inline 合理用、协程选对 Dispatcher;Android Profiler/基准库 Macrobenchmark。
**规范与工具**:ktlint(格式)/detekt(静态分析)、K2 编译器(2.0 起默认,提速明显)、版本节奏(1.x 常规,关注 K2 与多平台进展)。**学习资源**:官方文档(交互式教程)、Android 开发者官网的 Kotlin 课程、《Kotlin 实战》(中文经典)、Kotlin Playground(浏览器直接跑)。

## 通关标准

能独立做到:不看文档写出用 data class + when + 可空类型 + 集合操作符处理业务数据的小模块;说清 val/var、==/===、List 与 MutableList、sealed 与 enum、open 的意义;能解释协程的挂起不阻塞、结构化并发取消传播、Dispatchers 选择、Flow 与 StateFlow 用途;用 Compose + ViewModel + Room 搭过完整 App 并知道每个组件为何存在;给 Java 同事讲过一遍"Kotlin 为什么更安全"——Kotlin 主线通关。

Kotlin 务实、现代、被大厂力挺:它不搞语言玄学,每一项特性(空安全/扩展/委托/协程)都直接消灭一类样板与 bug。学它最快的路径是"带着 Java 的问题来":每学一个特性,问一句"这在 Java 里要写多少行、埋多少雷"——答案会让你上瘾。打开 Kotlin Playground 敲几行,然后去 Android Studio 建个项目,让 Compose + 协程带你体验"声明式 + 结构化并发"的现代开发。
