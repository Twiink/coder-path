# C# 学习路线

C# 是微软的亲儿子,也是"集大成者"语言:它从 Java 学了严谨的 OOP,从 C++ 学了性能控制,从函数式语言吸收了 LINQ 与不可变思想,又用 async/await 把异步做成了一等公民。配合 .NET(如今完全开源、跨平台,统一了 Web/桌面/移动/游戏/云),C# 在企业应用、游戏(Unity)与云原生里都是主力。它每年迭代一次,越写越现代——**学 C# 别学老写法,直接从最新 LTS(.NET 8)+ 现代语法起步**。

这条线按 **环境与基础 → 面向对象 → 委托/事件/Lambda → 泛型与集合 → LINQ → 异常与文件 → 异步与并发 → 反射与元编程 → 内存与性能 → 现代 C# 特性 → 工程与生态** 推进。

## 第一站:环境与语法地基

**环境**:装 **.NET SDK**(跨平台,Windows/macOS/Linux 通吃);CLI 是主力:`dotnet new console`(模板:console/webapi/mvc/blazor/xunit……)/`dotnet run`/`dotnet build`/`dotnet test`/`dotnet add package`;IDE:Visual Studio(Windows 全家桶)/Rider(跨平台)/VS Code + C# Dev Kit。
现代模板默认**顶级语句**(Program.cs 从一行 `Console.WriteLine("Hello");` 开始,没有 class Program 仪式——老教程的 Main 样板认识即可)。**类型系统**(C# 的根基,与 Java 最大不同):**值类型**(存栈/内联:int/double/bool/char/**decimal(128 位高精度,金融计算内置**)/enum/struct)与**引用类型**(string/数组/class/interface——存堆,变量持引用);`var`(类型推断,右侧类型可见时用);常量 const/readonly;**可空值类型 `int?`**(Nullable&lt;T&gt;,配 `?.`/`??`/`??=` 空安全三件套——C# 对 null 的处理是语言级设计)。
**运算符**:算术/比较/逻辑、`is`(类型检查 + **模式匹配**:`x is int i` 同时取出来)/`as`(安全转换,失败得 null)/`typeof`;switch **语句**(古老)与 **switch 表达式**(8+,`=>` 写法+模式,现代首选)。**数组**:一维、多维 `int[,]`(矩形)、**交错 `int[][]`**(数组的数组,更常用);`Length` 属性与 `for`/**foreach**(迭代器)。
**字符串**:不可变;`$"插值 &#123;x&#125;"`(现代主力,比 + 拼接优雅);verbatim `@"C:\path"`(原样字符串,路径正则福音);`"""` 原始字符串(11+);字符串方法家族与 **StringBuilder**(循环拼接必用)。**方法**:参数传递三件套是 C# 特色——值传递(默认)/**`ref`(引用传递,改原变量)/`out`(输出参数,不读只写,`TryParse` 模式)/`in`(只读引用)**;可选参数(带默认值)/命名参数(`f(b: 2)`);`params int[]`(可变参数);表达式体方法 `=>`(一行方法);本地函数(方法内定义方法,闭包)。
**注释**:`//`、`///` XML 文档注释(生成文档与 IDE 提示)。

## 第二站:面向对象

**类**:字段 + **属性 Property**(C# 的招牌:封装不靠 getter/setter 方法,靠属性语法)——自动属性 `public string Name &#123; get; set; &#125;`、只读 `&#123; get; &#125;`(构造器里赋值)/**`init`**(9+,仅初始化期可设)、**计算属性**(只有 get 体,动态算)、属性初始化器与**对象初始化器** `new Person &#123; Name = "x" &#125;`(少写构造器重载);构造器(可重载、`this(...)` 链);**访问修饰符五档**:public/private/protected/internal(同程序集)/protected internal,还有 file(12);static 类(工具类,如 Math)/static 成员;**扩展方法**(static 类里 `this T` 首参——**LINQ 就是扩展方法**!自己写扩展方法是 C# 日常);`nameof`(拿标识符字符串,防硬编码)。
**继承与多态**:`sealed`(禁继承,如 string)、`virtual` 方法 + `override` 重写(必须显式标,防拼错)、`base`、抽象类 abstract(不能实例化,含抽象成员)、**接口**:可多实现、**显式接口实现**(同名冲突)、默认接口方法(8+,给接口加默认实现,演进友好);**多态三要素**:继承/重写/父类引用。
**record**(9+,C# 对不可变数据类的答案):`record Person(string Name, int Age);`——主构造器自动生成属性、**值相等**(按内容比较,不同于 class 的引用相等)、`with &#123; &#125;` 非破坏更新(拷贝并改)、解构;`record struct`(10)。
**结构体 struct**:值类型、轻量数据;什么时候用:小、不可变、高频创建(见内存章节)。**运算符重载**:==/!=/+ 等(record 自动);**枚举 enum**(可带值,配 switch 模式)。

## 第三站:委托、事件与 Lambda

**委托 delegate**:类型安全的函数指针——`delegate int Op(int a, int b);`,实例化传方法、`op(1, 2)` 调用;**多播委托**(`+=` 链多个方法,按序调用;`-=` 移除);**内置委托三件套**(现代基本不用自建 delegate):`Action`(无返回)/`Func&lt;T, TResult&gt;`(有返回,泛型 0~16 参)/`Predicate&lt;T&gt;`(返回 bool);**Lambda**:`(x) => x * 2`——闭包(捕获外部变量)、语句体 lambda;方法组转换(`list.Where(IsEven)` 直接传方法名)。
**事件 event**:`event EventHandler&lt;EventArgs&gt;` 声明(本质是受限委托:外部只能 +=/-=,不能直接调用/赋值——封装回调的规范姿势);`+=` 订阅、自定义 EventArgs 传数据、`?.Invoke(...)` 安全触发;**发布-订阅模式**是 WinForms/WPF/ASP.NET 的骨架(按钮点击就是事件)。
理解"委托是回调的抽象、事件是安全的委托"这一层,读任何框架代码都不怵。

## 第四站:泛型与集合

**泛型**:泛型类/方法/接口;约束 `where T : class`(引用)/`struct`(值)/`new()`(可无参构造)/基类/接口/`notnull`;泛型的实现是**真泛型**(不像 Java 擦除——值类型特化,List&lt;int&gt; 与 List&lt;string&gt; 是不同机器码,性能好);**协变与逆变**:`out` 协变(只能返回:`IEnumerable<out T>`,`IEnumerable&lt;string&gt;` 能赋给 `IEnumerable&lt;object&gt;`)与 `in` 逆变(只能接收:`Action<in T>`——Func/Action 的类型参数就是这么标的),**可变性安全**是面试点。
**可空引用类型(NRT,8+)**:项目里 `&lt;Nullable&gt;enable</Nullable>`,`string?` 声明可空——编译器全量静态分析,把"百万美元错误"变成编译警告;**现代 C# 必须开**,老代码补这个最痛苦。**集合**(都实现 IEnumerable&lt;T&gt;):`List&lt;T&gt;`(动态数组,默认)/`Dictionary&lt;TKey,TValue&gt;`(哈希)/`HashSet&lt;T&gt;`(去重)/`Queue&lt;T&gt;`/`Stack&lt;T&gt;`/`LinkedList&lt;T&gt;`/`SortedDictionary`;接口层次:`IEnumerable&lt;T&gt;`(只读遍历,foreach 只需要它)→ ICollection → IList/IDictionary;只读视图 `IReadOnlyList&lt;T&gt;`(API 设计用);**集合初始化器** `new List&lt;int&gt; &#123; 1, 2 &#125;`;非泛型 ArrayList/Hashtable 是古董(装箱+类型不安全,别用)。

## 第五站:LINQ——C# 的杀手锏

**LINQ(语言集成查询)** 让"查集合"像写 SQL 一样自然,是现代 C# 日常的 30%:两种语法——**方法语法**(链式,主流):`list.Where(x => x.Age > 18).OrderBy(x => x.Name).Select(x => x.Email).ToList()`;**查询语法**(`from x in list where x.Age > 18 select x`,编译成方法链,类 SQL,老代码多)。
**操作符地图**:过滤 Where/OfType(按类型滤);投影 Select/SelectMany(摊平嵌套集合);排序 OrderBy/ThenBy/OrderByDescending;分组 GroupBy(→ IGrouping);联接 Join(内联)/GroupJoin;聚合 Aggregate/Count/Sum/Min/Max/Average;元素 First/FirstOrDefault/Single/SingleOrDefault(取唯一,多则炸)/Last/ElementAt;量词 Any/All/Contains;分页 Skip/Take(每页十条就是 `Skip(n*10).Take(10)`);去重 Distinct;转换 ToList/ToArray/ToDictionary/ToLookup;`Range`/`Repeat`/`Empty` 生成。
**延迟执行(面试必考)**:查询只是"配方",**遍历时才执行**——所以 Where 后改原集合结果会变、无限序列 `Range` 不会炸;`ToList()` 等是立即执行的"拍照"。**LINQ to Objects**(内存)/**LINQ to XML**/**LINQ to SQL → EF Core**:IQueryable 把"配方"编译成表达式树,由 EF Core 翻译成 SQL 在数据库执行——**写 LINQ 就是写查询,这是 EF Core 好用之源**。

## 第六站:异常、文件与序列化

**异常**:try/catch/finally/throw;异常类型体系(继承 Exception;SystemException/ApplicationException 是历史包袱,别自定义继承它们);自定义异常(继承 Exception,名字以 Exception 结尾);**异常过滤器 `when`**(6+,`catch (HttpException e) when (e.Status == 404)`——按条件分流,比内部 if 优雅);最佳实践:catch 具体类型、别吞异常、用 finally 或 using 清理;**`using` 语句**(释放 IDisposable:文件/连接/HttpClient——`using (var f = File.Open...) &#123;&#125;` 老式,`using var f = ...;` 声明式 8+,块结束自动释放)。
**文件与 IO**:静态 `File`/`Directory`(一次性操作:ReadAllText/WriteAllText/Exists)vs 实例 `FileInfo`/`DirectoryInfo`(多次操作持句柄);`Path`(Combine/GetExtension——**别手动拼路径**)/`Environment`(GetFolderPath 等);**流**:FileStream/MemoryStream(字节流基操,配 `StreamReader`/`StreamWriter`(文本)/`BinaryReader`/`BinaryWriter`);大文件流式读写配异步。
**序列化**:现代首选 **System.Text.Json**(内置:JsonSerializer.Serialize/Deserialize、`[JsonPropertyName]`、JsonSerializerOptions(驼峰/忽略 null)、**源生成器**性能优化)与遗留 Newtonsoft.Json(老项目多,会读);XML 用 XmlSerializer(配置/互操作场景)。

## 第七站:异步与并发

**async/await**(C# 5 起,现代 C# 的核心能力,面试主战场):`async Task&lt;int&gt; GetAsync()` + `await`;规矩:**async 方法返回 Task/Task&lt;T&gt;/ValueTask**,`async void` 只有事件处理器能用(异常会崩进程);**await 不阻塞线程**(状态机:线程回到池中,完成后续跑——UI 不卡、服务器线程不占);同步与异步混合的坑:`.Result`/`.Wait()` 会死锁(UI 上下文)——**一路 async 到底(Async All the Way)**;库代码加 `ConfigureAwait(false)`;取消:`CancellationToken`(协作式:token.ThrowIfCancellationRequested,配 `CancelAfter` 超时);并发:`Task.WhenAll`(等全部)/`Task.WhenAny`(等最先);`Task.Run`(把 CPU 工作丢线程池);**异步流 IAsyncEnumerable&lt;T&gt;**(8+,`await foreach` 消费分页数据/流式行);ValueTask(高频异步路径零分配,进阶)。
**多线程与并行**(老 API 认识即可):Thread(远古)、ThreadPool(池)、`lock` 语句(Monitor 语法糖,**锁引用类型**,用私有 object 当锁);Mutex(跨进程)/Semaphore(限流)/ReaderWriterLockSlim(读多写少);`Interlocked`(原子自增,替代锁的轻量路)/volatile(了解即可,现代代码用 Interlocked/锁);线程安全集合:ConcurrentDictionary/ConcurrentQueue/BlockingCollection(生产者消费者);**Parallel.For/ForEach**(数据并行,CPU 密集)+ PLINQ(`AsParallel()`——**注意线程安全与开销,默认别用**);现代管道:**Channel&lt;T&gt;**(生产者-消费者首选,无锁队列 + 异步读写);async 与 Parallel 的选择:IO 密集 → async/await;CPU 密集 → Task.Run/Parallel;混用小心上下文。

## 第八站:反射、特性与元编程

**反射**:`typeof(T)`/`obj.GetType()` 拿 **Type**(类型的元数据入口);`Assembly.GetTypes()` 扫程序集(插件加载);`Activator.CreateInstance`(动态建对象);MethodInfo.Invoke 动态调用——**慢,框架才用**;**特性 Attribute**(C# 的注解):`[Obsolete]`/`[Serializable]` 内置;自定义:`[MyAttr] class`——定义继承 Attribute 的类 + `[AttributeUsage]`(Targets/AllowMultiple/Inherited)标明可用位置;读取:`GetCustomAttribute&lt;T&gt;()`;**特性 + 反射 = 框架魔法**:ASP.NET 的 `[HttpGet]`/`[Authorize]`、EF 的 `[Key]`、序列化控制、数据校验,全是特性在起作用——**"代码标记 + 框架读取"是理解 .NET 一切约定的钥匙**。
**表达式树**(高级):`Expression<Func<T, bool>>` 把 lambda 存成**数据结构**(不是可执行代码),可遍历/改写/编译——**EF Core 把 C# 查询翻译成 SQL 的原理**、动态查询构造、规则引擎的基石;`Expression.Compile()` 又变回委托(性能优化用)。
**dynamic**(4.0,运行时绑定:DLR、ExpandoObject 动态加属性、与 COM/Python 互操作)——方便但**丢了类型安全与智能提示,业务代码慎用**。

## 第九站:内存管理与性能

**.NET GC**:托管堆自动回收(分代:Gen0(新对象,回收最勤)/Gen1/Gen2;**大对象堆 LOH**(≥85KB,不压缩);GC 是"代际假说"驱动的——短命对象多;`GC.Collect()` 手动调是反模式(生产别调);非托管资源(文件句柄/数据库连接/网络流)实现 **IDisposable + using**(Dispose 模式:Dispose(bool) + 终结器兜底,读得懂即可,现代用 `SafeHandle` 少写终结器)。
**值类型 vs 引用类型的性能语义**(C# 工程师的必修):struct 存栈/内联(数组里连续,**缓存友好**),class 存堆(引用、GC 追踪);**装箱拆箱**:值类型转 object/接口时复制进堆——`ArrayList.Add(1)` 每次装箱,**性能陷阱**;泛型集合避免了装箱(List&lt;int&gt; 内部就是 int[])。
**现代高性能三板斧**:`readonly struct`/`ref struct`、**`Span&lt;T&gt;`**(任意连续内存的只读视图:数组/字符串/栈,零拷贝切片解析——高性能文本/网络解析的标配)、`stackalloc`(栈分配);`ArrayPool&lt;T&gt;`(高频数组复用,JSON/网络库内部都在用);**BenchmarkDotNet**(性能测试事实标准——"我觉得快"不算数,跑基准);unsafe + 指针(互操作与极致场景,了解);内存诊断:dotnet-counters/dotnet-dump/Visual Studio 诊断工具。

## 第十站:现代 C# 特性时间线(新代码的日常)

**C# 6**:字符串插值 `$""`、null 条件 `?.`、表达式体成员、自动属性初始化器;**C# 7**:元组 `(int, string)`(ValueTuple,多返回值)、模式匹配 `is`、out var、本地函数、ref 返回;**C# 8**:可空引用类型、**范围与索引** `arr[1..^1]`(切片/倒数,`^` 从尾数)、**switch 表达式**、异步流、using 声明、默认接口方法;**C# 9**:record、init、**顶级语句**、模式增强(`is not null` 成为主流判空!);**C# 10**:全局 using、文件级命名空间、`record struct`;**C# 11**:原始字符串 `"""`、required 成员、列表模式;**C# 12**:主构造函数、集合表达式 `[..]`、`nameof` 泛型参数。
**.NET 版本节奏**:Framework(Windows 遗留)→ .NET Core → 统一 .NET 5,此后每年一发,偶数 LTS(6/8/10)——**新项目用 LTS**;`dotnet --version`/global.json 管版本。

## 第十一站:工程与生态

**.NET 生态地图**(按方向选主线):**Web 后端 ASP.NET Core**(事实主力:Web API + MVC、Minimal API(小服务几行一个接口)、中间件管道、依赖注入内建、配置系统——可对照 [全栈路线](/learning-paths/fullstack/overview) 学习整体架构);**EF Core**(ORM:Code First 迁移、LINQ 即 SQL、导航属性);**Blazor**(C# 写前端:Server 模式实时、WASM 模式浏览器跑);**SignalR**(实时通信);**gRPC**(高性能 RPC);**桌面**:WPF(Windows 企业应用,XAML)/WinForms(遗留);**跨平台移动/桌面**:.NET MAUI(原 Xamarin.Forms);**游戏**:Unity(C# 脚本,游戏开发最大入口);**云**:Azure Functions/App Service + 容器(K8s 见 [DevOps 路线](/learning-paths/devops/kubernetes));**微服务**:Dapr、MassTransit。
**依赖注入**:Microsoft.Extensions.DependencyInjection(ASP.NET Core 内建):生命周期三兄弟 AddSingleton/AddScoped(每请求)/AddTransient(每次)——**选错生命周期 = 诡异 bug**(Scoped 服务被 Singleton 捕获是经典坑)。
**测试**:xUnit(主流)/NUnit/MSTest;Moq 或 NSubstitute(mock);FluentAssertions(可读断言);`dotnet test` 一键跑;TDD 与测试金字塔。**设计原则**:SOLID 五原则(单一职责/开闭/里氏替换/接口隔离/依赖倒置)在 C# 生态讲得最透;Clean Architecture(分层:Presentation/Application/Domain/Infrastructure)是 .NET 企业项目的默认架构。
**书籍**:《C# 本质论》(权威教材)、《深入理解 C#》(特性原理)、《C# in a Nutshell》(手册)、《Concurrency in C# Cookbook》(异步并发实战)。

## 通关标准

能独立做到:用顶级语句 + record + LINQ + async/await 写一个完整的小工具;说清值类型与引用类型、可空引用类型、async void 为什么危险、延迟执行是什么;能讲 LINQ 与 EF Core 的关系(IQueryable → SQL);会写自定义 Attribute 并用反射读取;能用 BenchmarkDotNet 验证一次"哪种写法快"的争论;搭一个 ASP.NET Core Web API 并说明依赖注入生命周期——C# 主线通关。

C# 是一门不断进化的语言,微软每年带来新特性,但万变不离其宗:类型系统、LINQ、async、DI 这些"底层乐高"才是值钱的部分。学它别背 API——**理解 .NET 的运行时(GC/泛型/异步状态机)与设计理念(特性+反射、约定、依赖注入),你就掌握了整个微软技术栈的钥匙**。从 `dotnet new webapi` 开始,让 C# 带你看一看"优雅与强大可以兼得"是什么体验。
