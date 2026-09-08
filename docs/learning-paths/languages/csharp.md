# C# 学习路线

C#，这门"微软的亲儿子"语言，凭借其优雅的语法、强大的 .NET 生态和跨平台能力，成为企业级应用开发的首选。从桌面应用到 Web 服务，从游戏开发到云计算，C# 总能给你惊喜。

## 基础篇

### C# 入门
- **环境搭建**：Visual Studio、VS Code + C# 扩展、.NET SDK
- **基本语法**：变量、数据类型、常量、运算符、注释
- **控制流**：if/else、switch、for/foreach/while/do-while
- **数组与集合**：一维数组、多维数组、交错数组
- **方法**：方法定义、参数传递（值传递、引用传递、out/ref）、可选参数、命名参数

```csharp
using System;
class Program {
    static void Main() {
        Console.WriteLine("Hello, C#!");
    }
}
```

**下一步学习**：基础语法是起点，面向对象是 C# 的核心。

### 面向对象基础
- **类与对象**：类定义、对象创建、构造函数、析构函数
- **封装**：访问修饰符（public、private、protected、internal）、属性（Property）
- **继承**：base 关键字、方法重写、sealed 类
- **多态**：虚方法（virtual）、抽象类（abstract）、接口（interface）
- **this 关键字**：引用当前对象
- **静态成员**：static 字段、方法、构造函数

**下一步学习**：OOP 让代码结构化，属性和索引器让访问更优雅。

### 属性与索引器
- **自动属性**：简化的属性声明
- **只读属性**：get 访问器、init 访问器（C# 9.0）
- **计算属性**：动态计算值
- **索引器**：像数组一样访问对象、this[int index]
- **属性初始化器**：对象初始化语法

**下一步学习**：属性简化访问，委托和事件实现回调机制。

### 委托与事件
- **委托基础**：delegate 关键字、委托链、多播委托
- **匿名方法**：delegate() 语法
- **Lambda 表达式**：=> 语法、捕获变量
- **事件**：event 关键字、发布-订阅模式
- **内置委托**：Action、Func、Predicate
- **事件处理器**：EventHandler、自定义事件参数

**下一步学习**：委托是回调，泛型让代码复用。

### 泛型编程
- **泛型类**：类型参数、泛型实例化
- **泛型方法**：方法级别的类型参数
- **泛型约束**：where 子句、类约束、接口约束、new() 约束
- **泛型集合**：`List<T>`、`Dictionary<TKey, TValue>`、`Queue<T>`、`Stack<T>`
- **协变与逆变**：out（协变）、in（逆变）
- **泛型委托**：`Func<T>`、`Action<T>`

**下一步学习**：泛型提供类型安全，集合是数据的容器。

### 集合与 LINQ
- **集合接口**：IEnumerable、ICollection、IList、IDictionary
- **泛型集合**：List、Dictionary、HashSet、SortedSet、LinkedList
- **非泛型集合**：ArrayList、Hashtable（不推荐使用）
- **LINQ 基础**：查询语法、方法语法
- **LINQ 操作符**：Where、Select、OrderBy、GroupBy、Join
- **延迟执行**：查询不立即执行、ToList/ToArray 强制执行
- **LINQ to Objects/XML/SQL**：不同数据源

**下一步学习**：LINQ 让查询优雅，异常处理让程序健壮。

## 进阶篇

### 异常处理
- **异常基础**：try-catch-finally、throw
- **异常类型**：Exception 基类、SystemException、ApplicationException
- **自定义异常**：继承 Exception 类
- **异常过滤器**：when 子句（C# 6.0）
- **异常最佳实践**：捕获具体异常、避免空 catch、finally 清理资源

**下一步学习**：异常处理保证安全，文件和 I/O 操作处理数据。

### 文件与 I/O
- **文件操作**：File 类、FileInfo 类、读写文本文件
- **目录操作**：Directory 类、DirectoryInfo 类
- **流操作**：Stream、FileStream、MemoryStream
- **读写器**：StreamReader、StreamWriter、BinaryReader、BinaryWriter
- **序列化**：JSON（System.Text.Json、Newtonsoft.Json）、XML
- **路径操作**：Path 类

**下一步学习**：I/O 操作处理文件，反射让程序自省。

### 反射与特性
- **反射基础**：Type 类、Assembly 类、获取类型信息
- **动态调用**：MethodInfo.Invoke、动态创建对象
- **特性（Attribute）**：内置特性、自定义特性、特性参数
- **特性应用**：标记元数据、序列化控制、验证
- **反射性能**：缓存、表达式树优化

**下一步学习**：反射是元编程，异步编程是现代 C# 的核心。

### 异步编程
- **async/await**：异步方法、Task 返回类型
- **Task 类**：创建任务、等待任务、任务延续
- **`Task<T>`**：返回结果的异步操作
- **异步最佳实践**：避免 async void、ConfigureAwait
- **并行编程**：Task.WhenAll、Task.WhenAny
- **取消令牌**：CancellationToken、超时控制
- **异步流**：IAsyncEnumerable（C# 8.0）

**下一步学习**：异步提升响应性，多线程提升性能。

### 多线程与并发
- **Thread 类**：创建线程、线程生命周期
- **线程池**：ThreadPool、QueueUserWorkItem
- **线程同步**：lock、Monitor、Mutex、Semaphore、ReaderWriterLock
- **线程安全集合**：ConcurrentDictionary、ConcurrentQueue、BlockingCollection
- **并行计算**：Parallel.For、Parallel.ForEach、PLINQ
- **数据竞争**：volatile、Interlocked

**下一步学习**：多线程处理并发，现代语法特性让代码更简洁。

### C# 现代特性
- **C# 6.0**：
  - 字符串插值、null 条件运算符（?.）、表达式体成员、自动属性初始化器
- **C# 7.0-7.3**：
  - 元组、模式匹配、out 变量、本地函数、ref 返回值
- **C# 8.0**：
  - 可空引用类型、范围和索引、switch 表达式、异步流、默认接口方法
- **C# 9.0**：
  - 记录类型（record）、init 访问器、顶级语句
- **C# 10.0**：
  - 全局 using、文件范围命名空间、结构体改进
- **C# 11.0**：
  - 原始字符串字面量、列表模式、required 成员

**下一步学习**：新特性让语法现代化，表达式树是高级技巧。

## 实战篇

### 表达式树
- **表达式树基础**：Expression 类、Lambda 转表达式树
- **构建表达式树**：手动创建表达式
- **解析表达式树**：遍历节点、访问者模式
- **应用场景**：ORM 框架、动态查询、规则引擎

**下一步学习**：表达式树是元编程工具，动态编程提供运行时灵活性。

### 动态编程
- **dynamic 类型**：动态类型绑定、运行时解析
- **DLR（动态语言运行时）**：与动态语言互操作
- **ExpandoObject**：动态添加属性
- **DynamicObject**：自定义动态行为
- **应用场景**：JSON 处理、COM 互操作

**下一步学习**：动态编程灵活，内存管理保证性能。

### 内存管理与性能
- **垃圾回收**：GC 工作原理、分代收集、大对象堆
- **值类型 vs 引用类型**：栈与堆、装箱拆箱
- **结构体优化**：readonly struct、ref struct、`Span<T>`
- **性能分析**：BenchmarkDotNet、性能计数器、诊断工具
- **内存池**：ArrayPool、对象池模式
- **unsafe 代码**：指针操作、fixed 语句

**下一步学习**：性能优化是进阶，依赖注入是设计模式。

### 依赖注入与设计模式
- **依赖注入**：构造器注入、属性注入、方法注入
- **IoC 容器**：Microsoft.Extensions.DependencyInjection、生命周期管理
- **常见模式**：单例、工厂、策略、观察者、装饰器
- **SOLID 原则**：单一职责、开闭原则、里氏替换、接口隔离、依赖倒置

**下一步学习**：设计模式是架构基础，单元测试是质量保证。

### 单元测试
- **测试框架**：MSTest、xUnit、NUnit
- **断言**：Assert 类、流畅断言（FluentAssertions）
- **Mock 框架**：Moq、NSubstitute
- **测试覆盖率**：测量代码覆盖
- **测试驱动开发**：TDD 实践

**下一步学习**：测试保证质量，.NET 生态是应用基础。

### .NET 生态
- **ASP.NET Core**：Web API、MVC、Blazor
- **Entity Framework Core**：ORM、Code First、Database First
- **SignalR**：实时通信、WebSocket
- **gRPC**：高性能 RPC 框架
- **WPF/WinForms**：桌面应用开发
- **Xamarin/MAUI**：跨平台移动应用
- **Unity**：游戏开发、C# 脚本

**下一步学习**：.NET 生态丰富，云原生是未来趋势。

### 云原生与微服务
- **Docker**：容器化 .NET 应用
- **Kubernetes**：容器编排
- **微服务架构**：服务拆分、API 网关、服务发现
- **Azure 云服务**：Azure Functions、Azure App Service
- **消息队列**：RabbitMQ、Azure Service Bus
- **分布式系统**：Dapr、CAP 理论

**下一步学习**：云原生是趋势，现在你已掌握 C# 全貌！

## 学习建议

### 推荐书籍
- 《C# 本质论》：全面深入的权威教材
- 《深入理解 C#》：深入剖析 C# 特性
- 《C# 并发编程经典实例》：并发编程实战
- 《ASP.NET Core 实战》：Web 开发指南

### 学习周期
- **基础篇**：2-3 个月（每天 2-3 小时）
- **进阶篇**：3-4 个月（每天 2-3 小时）
- **实战篇**：4-6 个月（需要项目实践）

### 职业方向
- **Web 开发**：ASP.NET Core 后端开发
- **桌面应用**：WPF、WinForms 企业应用
- **游戏开发**：Unity 游戏脚本
- **移动开发**：Xamarin/MAUI 跨平台应用
- **云计算**：Azure 云服务开发

C# 是一门不断进化的语言，微软每年都会发布新版本带来更多特性。学习 C# 不仅仅是学语法，更要理解 .NET 生态和现代软件开发理念。记住：优秀的 C# 开发者不是记住了多少 API，而是能用合适的工具解决实际问题。加油！
