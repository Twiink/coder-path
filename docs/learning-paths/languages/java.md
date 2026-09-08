# Java 学习路线

Java，这门"一次编写，到处调试"的语言，凭借其严谨的类型系统和无处不在的 JVM，成为了企业级开发的中流砥柱。从 Android 应用到大型分布式系统，Java 的身影无处不在。

## 基础篇

### Java 入门
- **环境搭建**：JDK 安装、IDE 选择（IntelliJ IDEA 或 Eclipse）、第一个 Hello World
- **基本语法**：变量、数据类型、运算符、控制流（if/else、switch、循环）
- **数组**：一维数组、多维数组、数组遍历
- 📖 笔记：[Java 语言概述与开发环境](/study-notes/java/language-overview-env-setup)
- 📖 笔记：[基础语法与数据类型](/study-notes/java/syntax-data-types)
- 📖 笔记：[运算符与流程控制](/study-notes/java/operators-control-flow)
- 📖 笔记：[数组与方法](/study-notes/java/arrays-methods)

```java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, Java World!");
    }
}
```

**下一步学习**：掌握基本语法后，立即进入面向对象编程的世界。

### 面向对象基础
- **类与对象**：类的定义、对象的创建、构造方法、this 关键字
- **封装**：访问修饰符（private、protected、public）、getter/setter
- **继承**：extends 关键字、方法重写、super 关键字、Object 类
- **多态**：向上转型、方法重载与重写、动态绑定
- 📖 笔记：[面向对象基础](/study-notes/java/oop-basics)
- 📖 笔记：[面向对象进阶](/study-notes/java/oop-advanced)

**下一步学习**：理解 OOP 三大特性后，探索 Java 的核心类库。

### Java 核心类库
- **String 类**：不可变性、常用方法、字符串拼接、StringBuilder/StringBuffer
- **包装类**：Integer、Double 等、自动装箱拆箱
- **Math 类**：常用数学运算
- **日期时间**：Date、Calendar、Java 8 的 LocalDateTime
- **异常处理**：try-catch-finally、throw/throws、自定义异常、异常链
- 📖 笔记：[常用类与 API](/study-notes/java/common-classes-api)
- 📖 笔记：[异常处理](/study-notes/java/exceptions)

**下一步学习**：核心类库熟练后，掌握集合框架这一 Java 开发的利器。

## 进阶篇

### 集合框架
- **List**：ArrayList（动态数组）、LinkedList（链表）、Vector
- **Set**：HashSet、TreeSet、LinkedHashSet
- **Map**：HashMap、TreeMap、LinkedHashMap、Hashtable
- **Queue**：LinkedList、PriorityQueue、Deque
- **Collections 工具类**：排序、查找、同步包装
- 📖 笔记：[集合框架 List 与 Set](/study-notes/java/collections-list-set)
- 📖 笔记：[集合框架 Map 与源码剖析](/study-notes/java/collections-map-source-analysis)

**下一步学习**：集合是数据的容器，而泛型让容器类型安全。

### 泛型编程
- **泛型类**：类型参数、类型变量
- **泛型方法**：方法级别的类型参数
- **通配符**：`? extends T`（上界）、`? super T`（下界）
- **类型擦除**：运行时的类型信息丢失、桥接方法
- 📖 笔记：[泛型、枚举与注解](/study-notes/java/generics-enums-annotations)

**下一步学习**：泛型让代码更安全，注解让代码更智能。

### 注解与反射
- **内置注解**：@Override、@Deprecated、@SuppressWarnings
- **元注解**：@Target、@Retention、@Documented、@Inherited
- **自定义注解**：定义注解、注解处理器
- **反射机制**：Class 对象、获取构造器/方法/字段、动态调用
- **反射应用**：框架开发、动态代理
- 📖 笔记：[反射与动态代理](/study-notes/java/reflection-dynamic-proxy)

**下一步学习**：反射是框架的基石，I/O 是程序与外界的桥梁。

### I/O 流与 NIO
- **字节流**：InputStream、OutputStream、FileInputStream/FileOutputStream
- **字符流**：Reader、Writer、FileReader/FileWriter
- **缓冲流**：BufferedReader、BufferedWriter、性能优化
- **对象流**：序列化与反序列化
- **NIO**：Buffer、Channel、Selector、非阻塞 I/O、内存映射文件
- 📖 笔记：[IO 流与文件操作](/study-notes/java/io-streams-file-operations)

**下一步学习**：I/O 让程序读写数据，多线程让程序并发执行。

### 多线程与并发
- **线程基础**：Thread 类、Runnable 接口、线程生命周期
- **线程同步**：synchronized 关键字、Lock 接口、ReentrantLock
- **线程通信**：wait/notify、Condition
- **线程池**：Executor 框架、ThreadPoolExecutor、常见线程池类型
- **并发工具类**：CountDownLatch、CyclicBarrier、Semaphore、Exchanger
- **并发集合**：ConcurrentHashMap、CopyOnWriteArrayList、BlockingQueue
- **原子类**：AtomicInteger、AtomicReference、CAS 操作
- **volatile 关键字**：可见性、禁止指令重排序
- 📖 笔记：[线程基础与生命周期](/study-notes/java/thread-basics-lifecycle)
- 📖 笔记：[线程安全与 synchronized](/study-notes/java/thread-safety-synchronized)
- 📖 笔记：[volatile 与 CAS 原子类](/study-notes/java/volatile-cas)
- 📖 笔记：[Lock 与 AQS 原理](/study-notes/java/lock-and-aqs)
- 📖 笔记：[线程池原理与实战](/study-notes/java/thread-pool-practice)
- 📖 笔记：[JUC 工具类与 ThreadLocal](/study-notes/java/juc-tools-threadlocal)
- 📖 笔记：[异步编程 CompletableFuture](/study-notes/java/completable-future-async)

**下一步学习**：并发是性能的关键，JVM 是理解 Java 的核心。

## 实战篇

### JVM 深入理解
- **JVM 架构**：类加载子系统、运行时数据区、执行引擎
- **内存模型**：堆、栈、方法区、程序计数器、本地方法栈
- **垃圾回收**：GC 算法（标记-清除、复制、标记-整理）、分代收集
- **垃圾收集器**：Serial、Parallel、CMS、G1、ZGC
- **类加载机制**：加载、验证、准备、解析、初始化、双亲委派模型
- **JVM 调优**：JVM 参数、性能监控工具（jps、jstat、jmap、jstack）
- 📖 笔记：[JVM 概述与运行时数据区](/study-notes/jvm/overview-runtime-data-areas)
- 📖 笔记：[垃圾回收机制与收集器](/study-notes/jvm/gc-mechanisms-collectors)
- 📖 笔记：[类加载机制与字节码](/study-notes/jvm/class-loading-bytecode)
- 📖 笔记：[JVM 调优与线上排查](/study-notes/jvm/tuning-troubleshooting)

**下一步学习**：理解 JVM 后，你将掌握 Java 的底层运行机制。

### 网络编程
- **Socket 编程**：TCP/UDP 通信、ServerSocket、Socket
- **HTTP 协议**：HttpURLConnection、第三方库（HttpClient、OkHttp）
- **NIO 网络编程**：Selector、SocketChannel、ServerSocketChannel
- **Netty 框架**：事件驱动、异步非阻塞、编解码器
- 📖 笔记：[Java 网络编程](/study-notes/java/network-programming)

**下一步学习**：网络编程让应用连接世界，新特性让 Java 保持活力。

### Java 8+ 新特性
- **Lambda 表达式**：函数式接口、方法引用、构造器引用
- **Stream API**：中间操作、终止操作、并行流
- **Optional 类**：避免 NullPointerException
- **日期时间 API**：LocalDate、LocalTime、LocalDateTime、ZonedDateTime
- **接口默认方法**：default 关键字、多继承冲突解决
- **Java 9+**：模块化系统、JShell、改进的 Stream API
- **Java 11+**：局部变量类型推断（var）、HTTP Client API
- **Java 14+**：记录类型（Record）、模式匹配（instanceof）
- **Java 17+**：密封类（Sealed Classes）、文本块
- 📖 笔记：[Java 8 新特性 Lambda 与 Stream](/study-notes/java/java8-lambda-stream)

**下一步学习**：新特性让代码更简洁，设计模式让架构更优雅。

### 设计模式
- **创建型模式**：单例、工厂、抽象工厂、建造者、原型
- **结构型模式**：适配器、装饰器、代理、外观、桥接、组合、享元
- **行为型模式**：策略、模板方法、观察者、迭代器、责任链、命令、备忘录、状态、访问者、中介者、解释器

**下一步学习**：设计模式是经验的结晶，测试是质量的保证。

### 单元测试
- **JUnit**：断言、测试套件、参数化测试
- **Mockito**：Mock 对象、Stub、Spy
- **测试覆盖率**：JaCoCo、代码覆盖率分析

**下一步学习**：测试保障代码质量，框架提升开发效率。

### 常用框架与工具
- **构建工具**：Maven、Gradle
- **日志框架**：Log4j、SLF4J、Logback
- **JSON 处理**：Jackson、Gson、Fastjson
- **XML 处理**：DOM、SAX、JAXB
- **Spring 框架**：IoC、DI、AOP、Spring MVC、Spring Boot
- **持久层框架**：JDBC、MyBatis、Hibernate、JPA

**下一步学习**：框架让开发事半功倍，现在你已掌握 Java 的全貌！

## 学习建议

### 推荐书籍
- 《Java 核心技术》：全面深入的基础教材
- 《Effective Java》：编写高质量代码的黄金准则
- 《深入理解 Java 虚拟机》：JVM 必读经典
- 《Java 并发编程实战》：并发编程权威指南

### 学习周期
- **基础篇**：2-3 个月（每天 2-3 小时）
- **进阶篇**：3-4 个月（每天 2-3 小时）
- **实战篇**：3-6 个月（需要项目实践）

### 职业方向
- **后端开发**：Spring Boot + 微服务架构
- **Android 开发**：Android SDK + Kotlin
- **大数据**：Hadoop、Spark、Flink
- **企业级应用**：传统 Java EE、分布式系统

Java 的学习之路漫长但充实，每一步都能看到自己的成长。记住：好的 Java 程序员不是记住了多少 API，而是理解了编程的本质和系统的设计。继续加油，你会成为优秀的 Java 工程师！
