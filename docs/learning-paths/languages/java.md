# Java 学习路线

Java,"一次编写,到处运行"——靠的不是魔法,是 **JVM(Java 虚拟机)**:同一份字节码在任何装了 JVM 的平台上跑。它语法严谨、生态庞大,是企业后端、大数据、Android 的中流砥柱,也是国内招聘量最大的语言之一。Java 的学习曲线是"先平后陡":基础语法好上手,但集合、并发、JVM 每一层都能挖得很深——**好 Java 程序员拼的不是 API 记忆,而是对 JVM 与并发的理解**。

这条线按 **环境与语法 → 面向对象 → 核心类库 → 集合框架 → 泛型 → 注解与反射 → I/O 与 NIO → 多线程与并发 → JVM → 新特性 → 工程与框架** 推进。版本建议:直接学 **LTS 版本**(17 或 21),新特性(record/switch 表达式/虚拟线程)会让代码脱胎换骨。

## 第一站:环境与语法地基

**环境**:装 JDK(不是 JRE——JDK 含编译器 javac;17+ 有 jpackage 打包);分清 JDK/JRE/JVM 三者(面试送分题);IDE 用 **IntelliJ IDEA**(社区版免费够用),命令行流程也要会:`javac Hello.java` → `java Hello`(main 方法签名 `public static void main(String[] args)` 是 JVM 入口约定)。
**类型系统**:8 种基本类型(`byte/short/int/long`(默认 0)、`float/double`(默认 0.0,浮点精度问题用 BigDecimal)、`char`(16 位 Unicode)、`boolean`) + 引用类型(类/接口/数组/enum);基本类型存栈上、按值传递,引用类型按引用传递(**对象内容可变、引用本身按值**——"Java 只有值传递"是面试高频辨析)。
**运算符**:算术/比较/逻辑(短路 &&/||)/位运算/三元;`==` 对引用比较的是地址(字符串比较必须 equals!);字符串拼接 `+` 在循环里会产生大量中间对象(用 StringBuilder)。**控制流**:if/else、`switch`(支持 String 与 enum;**switch 表达式** 14+ 用 `->` 与 yield,不再穿透)、for/增强 for/while;**数组**:定长(创建后长度不可变)、`int[]` vs `int[][]`、`Arrays` 工具类(sort/binarySearch/fill/copyOf/toString)、遍历用增强 for 或 Arrays.stream。
**输入输出**:System.out.println、Scanner(System.in)、格式化 printf。

## 第二站:面向对象——Java 的立身之本

**类与对象**:`class` + `new`;构造器(与类同名、可重载;不写也有默认无参);`this`(区分参数与字段、构造器互调 `this(...)`)。**封装**:访问修饰符四档 `private`(类内)< 默认(包内)< `protected`(包内+子类)< `public`;字段私有 + getter/setter(不是教条,是"留变更余地");**包 package** 与 import(域名反写命名)。
**继承**:`extends` 单继承;方法重写(@Override 必须标——编译器帮查签名)、字段隐藏、`super`(调父类构造器/方法;**子类构造器第一行必须 super()**,不写编译器补默认);一切类继承 **Object**(其方法全要认识:equals/hashCode/toString/getClass/clone/finalize(已废弃)/wait/notify)。
**多态**:向上转型(父类引用指向子类对象)、**动态绑定**(调哪个方法运行时决定——多态的精髓)、重载(编译期,看参数列表)vs 重写(运行期,看继承关系)。**final**:final 类不可继承(String 就是)、final 方法不可重写、final 变量不可变(常量);**static**:静态字段(类级共享)/静态方法(不能访问实例成员)/静态代码块(类加载时执行一次)/静态导入。
**抽象与接口**:`abstract class`(可有实现,单继承限制)→ **interface**(Java 8+ 可以有 default/static/private 方法;一个类 implements 多个接口;同名 default 方法冲突必须重写解决;"接口是能力契约,抽象类是模板"是选型口诀)。
**内部类四兄弟**:成员内部类(持外部类引用)、静态内部类(不持)、局部内部类、**匿名内部类**(一次性回调,`new Runnable()&#123;...&#125;`——Lambda 出现前的痛,现在读老代码常见);**枚举 enum**:天然单例、可带字段与构造器、switch 可用、`values()` 遍历——**用 enum 做常量集与状态机**;**record**(14+):一行定义不可变数据类(自动生成构造器/equals/hashCode/toString,组件访问器),替代大量 Lombok 场景。
**Lambda 与函数式**(Java 8,放第十站新特性,但它是 OOP 世界的范式转换,早学早受益)。

## 第三站:核心类库

**String**:不可变(所有"修改"都返回新串;线程安全由此而来);**字符串常量池**(字面量入池,`new String` 不池——`==` 陷阱的根源);常用方法:length/charAt/substring/indexOf/contains/startsWith/endsWith/split/join/replace/trim/toUpperCase/compareTo;拼接用 **StringBuilder**(非线程安全,快)/StringBuffer(线程安全,慢,少用);`intern()` 手动入池(了解)。
**包装类**:Integer/Double/Boolean 等;**自动装箱拆箱**(编译器插入 valueOf/xxxValue);**缓存坑**:Integer 缓存 -128~127,`Integer a = 127, b = 127; a == b` 是 true,128 就是 false——**包装类比较一律 equals**;拆箱空指针(包装类为 null 时自动拆箱 NPE,集合里取数注意)。
**日期时间**(重点:用 **java.time**(Java 8)别用老的 Date/Calendar):LocalDate/LocalTime/LocalDateTime(无时区)/Instant(时间戳)/ZonedDateTime(带时区)/Duration 与 Period(时间差)/DateTimeFormatter(线程安全,格式化解析)/`LocalDate.now().plusDays(1)` 这种流畅 API;老代码里的 Date/SimpleDateFormat(线程不安全)要能看懂。
**BigDecimal**:金额计算必用(构造用字符串 `new BigDecimal("0.1")`,别传 double!);`setScale(2, RoundingMode.HALF_UP)` 四舍五入;比较用 compareTo 不用 equals(equals 看精度)。**异常体系**:`Throwable` → `Error`(JVM 级,别 catch)与 `Exception` → 分**受检异常 checked**(编译期强制处理:IOException/SQLException——设计上"可恢复")与**非受检 unchecked**(RuntimeException 系:NPE/IndexOutOfBounds/IllegalArgumentException/ClassCastException——"程序 bug");处理:`try-catch-finally`(finally 总会执行,注意 finally 里 return 会覆盖 try 的 return)、多重 catch、**try-with-resources**(`try (var in = new FileInputStream(...))`,自动 close,资源类要实现 AutoCloseable——现代首选)、`throw` 抛与 `throws` 声明、**自定义异常**(继承 Exception 或 RuntimeException,一般带几个构造器)、异常链(cause)。
**其他**:Math、System、Runtime、Objects(requireNonNull)、Optional(见新特性)。

## 第四站:集合框架——数据结构标准库

**体系图**(面试必画):Collection(List/Set/Queue)→ Map。**List**:**ArrayList**(动态数组,默认容量 10,扩容 1.5 倍(Arrays.copyOf);随机访问 O(1),中间插入删除 O(n))vs **LinkedList**(双向链表,插入删除 O(1) 但实际因缓存不友好常更慢;还实现 Deque);Vector 是同步老古董(别用)。
**Set**:**HashSet**(基于 HashMap,无序,**依赖 hashCode 与 equals**——重写 equals 必须重写 hashCode,否则去重失效,头号坑)/LinkedHashSet(插入序)/TreeSet(红黑树,自然排序或 Comparator,**元素需可比较**)。
**Map**:**HashMap**(核心中的核心:数组+链表+红黑树;put 流程、hash 扰动、负载因子 0.75、扩容翻倍、**链表超 8 转红黑树**、key 要不可变(用 String/Integer));LinkedHashMap(插入序/访问序——**实现 LRU 缓存**);TreeMap(有序);Hashtable 已废(全方法同步太慢)。
**Queue/Deque**:ArrayDeque(双端,当栈/队列用,比 Stack/LinkedList 好)、**PriorityQueue**(二叉堆,自动按优先级出队,`Comparator` 定制——TopK 问题);**BlockingQueue** 见并发章节。**迭代**:Iterator(hasNext/next/remove)与增强 for; **fail-fast 机制**(遍历中结构修改抛 ConcurrentModificationException——删除元素要用 iterator.remove 或 collect 后批量删);**Collections 工具**:sort(传入 List)/binarySearch/reverse/shuffle/unmodifiableXxx(只读视图)/synchronizedXxx(同步包装)/singletonXxx;`Arrays.asList`(固定长度视图,add 会炸)与 `List.of`(9+,真不可变)。
**排序接口**:`Comparable`(类自身自然序,compareTo)vs `Comparator`(外部比较器,Lambda 写 `Comparator.comparing(User::getAge).thenComparing(...)`)。

## 第五站:泛型——编译期的安全带

**泛型类/接口/方法**:`class Box&lt;T&gt;`、`<T extends Number>` 上界约束、泛型方法 `&lt;T&gt; T get(...)`。**类型擦除**(理解泛型的关键):泛型信息只存在于编译期,运行时全部擦成原始类型(Object/上界)——所以 `List&lt;String&gt;` 与 `List&lt;Integer&gt;` 运行时是同一个类;由此推出:不能 `new T()`、不能 `T.class`、不能建泛型数组、静态成员不能引用类泛型、重载 `f(List&lt;String&gt;)` 与 `f(List&lt;Integer&gt;)` 编译冲突;桥接方法(擦除后编译器生成的保持多态的方法,反射能看到)。
**通配符**:**`? extends T`(上界:只读不写,`List<? extends Number>` 能取 Number 不能 add——编译器不知道具体子类)**与 **`? super T`(下界:只写不读,`List<? super Integer>` 能 add Integer,取出来是 Object)**;**PECS 原则**:Producer Extends,Consumer Super(从容器读数据用 extends,往容器写数据用 super);无界 `?`。
**泛型方法 vs 通配符**的选择;`var`(10+)与泛型的配合。

## 第六站:注解与反射——框架的魔法

**注解(Annotation)**:本质是"标记接口",不自己做事,等着被工具/框架读取。内置:@Override/@Deprecated/@SuppressWarnings/@FunctionalInterface;**元注解**:**@Target**(能用在哪:类型/方法/字段/参数……)、**@Retention**(保留到何时:SOURCE(编译期丢弃,如 Lombok)/CLASS(字节码,默认)/**RUNTIME(反射可读——自定义业务注解几乎都用它)**)、@Documented/@Inherited/@Repeatable;**自定义注解**:`@interface` + 成员(带 default);**注解处理器**:运行时反射读取 + 编译期 Annotation Processor(生成代码,Lombok/Builders 的原理,进阶)。
**反射(Reflection)**:`Class` 对象三种获取(类名.class/实例.getClass()/Class.forName("全限定名"));`getConstructors/getMethods/getDeclaredFields`(getDeclared 拿私有的,`setAccessible(true)` 破封装——**有风险,框架才用**);动态调用:constructor.newInstance/method.invoke/field.get/set;应用:Spring 的组件扫描与注入、MyBatis 的 Mapper 代理、序列化框架;**动态代理**:JDK 的 `Proxy.newProxyInstance` + InvocationHandler(**只能代理接口**)vs CGLIB(子类继承代理,可代理类)——**Spring AOP 两种代理方式的区别**是面试高频。
反射的代价:慢(有缓存/性能敏感场景慎用)、破坏封装、难调试。**模块化(JPMS,9+)**:module-info.java 与 exports/requires——库作者与巨型应用才需要,了解。

## 第七站:I/O 与 NIO

**经典 IO(阻塞流)**:按单位分**字节流**(InputStream/OutputStream:FileInputStream/FileOutputStream/BufferedInputStream/DataInputStream/ObjectInputStream……)与**字符流**(Reader/Writer:FileReader/FileWriter/BufferedReader(带 readLine)/PrintWriter……);字节 ↔ 字符靠**转换流** InputStreamReader/OutputStreamWriter(指定编码,`UTF-8` 显式写!);**缓冲流**是性能基本盘(FileReader 逐字符读很慢,BufferedReader 包一层);**序列化**:实现 Serializable + **serialVersionUID 必须显式声明**(不写则随类结构变化而变,反序列化 InvalidClassException);transient 跳过字段;序列化安全风险(反序列化攻击——别反序列化不可信数据);**try-with-resources** 管理所有流。
**现代文件 API**:`java.nio.file.Files/Paths`(readAllLines/write/lines 流式/move/copy/walk 遍历)——新代码用它,别用 File 老 API。**NIO(非阻塞,New IO)**:三大件 **Buffer**(数据容器,flip/clear 语义)/**Channel**(FileChannel/SocketChannel,双向)/**Selector**(多路复用器:一个线程监控多个 Channel 的就绪事件——**Java 高并发的底层模型**,对应操作系统的 epoll);**内存映射文件** MappedByteBuffer(大文件高效读写);NIO 2 的异步通道(AsynchronousSocketChannel,回调式);**Netty**:基于 NIO 的工业级网络框架(见 backend 路线),理解"阻塞 vs 非阻塞 vs 多路复用"的演进是前提。

## 第八站:多线程与并发——面试主战场

**线程基础**:创建三种方式(继承 Thread(不推荐,单继承浪费)/实现 Runnable(推荐,无返回)/实现 Callable(有返回 + Future));生命周期六态:NEW/RUNNABLE(含运行与就绪)/BLOCKED/WAITING/TIMED_WAITING/TERMINATED(与 OS 五态对应);常用:sleep(不释放锁)/yield(让出 CPU)/join(等线程结束);**中断机制**:interrupt() 只是打标记,配合 isInterrupted/InterruptedException 协作式取消(别用已废弃的 stop)。
**同步**:`synchronized` 三种用法(同步实例方法锁 this/静态方法锁 Class/代码块锁指定对象);锁的底层(偏向锁→轻量级锁→重量级锁升级,见 JVM 章);**wait/notify/notifyAll**(必须在 synchronized 块内,配 while 条件防虚假唤醒)与 **Condition**(Lock 的等待通知,更精细);**Lock 家族**:ReentrantLock(可重入、可中断 lockInterruptibly、可超时 tryLock、公平锁参数——**比 synchronized 灵活,但记得 finally unlock**)、ReadWriteLock(读读并发)、StampedLock(乐观读,高级);**volatile**:保证可见性 + 禁止指令重排,**不保证原子性**(i++ 问题);**原子类**:AtomicInteger/AtomicLong/AtomicReference——底层 **CAS**(比较并交换,乐观锁思想,无锁编程;**ABA 问题**用 AtomicStampedReference);**ThreadLocal**:线程私有变量(SimpleDateFormat 线程安全方案、事务上下文),**内存泄漏坑**(线程池场景必须 remove);**JMM(Java 内存模型)**:主内存 + 工作内存,三大特性(原子性/可见性/有序性),**happens-before 规则**(程序顺序/锁/unlock-lock/volatile 写读/线程 start/join 等)——并发面试的理论地基。

**线程池**(生产必用,禁止手动 new Thread):**ThreadPoolExecutor 七大参数**要能背:corePoolSize/maximumPoolSize/keepAliveTime/unit/workQueue(任务队列)/threadFactory/RejectedExecutionHandler(四种拒绝策略:AbortPolicy 抛异常(默认)/CallerRunsPolicy(调用者线程跑)/DiscardPolicy/DiscardOldestPolicy);执行流程:核心线程 → 队列 → 最大线程 → 拒绝;**submit vs execute**(submit 返回 Future 能拿结果与异常);优雅关闭 shutdown(等已提交任务)与 shutdownNow;`Executors` 工厂的坑:newFixedThreadPool 与 newSingleThreadExecutor 用无界队列(任务堆积 OOM)、newCachedThreadPool 最大线程无限——**《阿里手册》禁止 Executors 工厂,手动 new ThreadPoolExecutor**;ForkJoinPool(分治并行,parallelStream 的底)。
**并发容器**:ConcurrentHashMap(**1.8 起 CAS + synchronized 锁桶头,放弃分段锁**;size 用 baseCount+CouterCell;迭代弱一致)、CopyOnWriteArrayList(写时复制,读多写少:监听器列表)、**BlockingQueue 家族**(ArrayBlockingQueue 有界/ LinkedBlockingQueue/ SynchronousQueue(直接交接)/ DelayQueue/ PriorityBlockingQueue——**生产者-消费者模式与线程池队列的地基**)。
**并发工具**:CountDownLatch(倒数门闩,等 N 个任务完成,一次性的)vs **CyclicBarrier**(循环栅栏,N 个线程互相等齐,可复用——区别是经典面试题)、Semaphore(信号量,限流)、Exchanger(两线程交换数据);**CompletableFuture**(异步编排神器:supplyAsync/thenApply/thenCompose(扁平化)/allOf/anyOf/exceptionally——链式异步代码,现代 Java 异步主力,替代回调地狱)。

## 第九站:JVM——Java 的灵魂

**运行时数据区**:程序计数器(线程私有)、**虚拟机栈**(线程私有,栈帧:局部变量表/操作数栈/动态链接/返回地址——**StackOverflowError 的由来**)、本地方法栈、**堆**(线程共享,对象与数组的家,GC 主战场;分代:Eden + 两个 Survivor(8:1:1) + 老年代)、**方法区**(类元信息/常量/静态变量;JDK8 起叫**元空间 Metaspace**,本地内存,不再永久代 OOM);直接内存(DirectByteBuffer,NIO 用)。
**对象创建流程**:类加载检查 → 分配内存(指针碰撞/空闲列表)→ 初始化零值 → 设置对象头(哈希码/GC 分代年龄/锁状态)→ 构造方法。**垃圾回收**:判定存活(可达性分析,GC Roots:栈引用/静态引用/JNI);**回收算法**:标记-清除(碎片)/复制(新生代,浪费空间换效率)/标记-整理(老年代);**收集器演进**:Serial(单线程)→ Parallel(默认,吞吐优先)→ CMS(并发低延迟,标记-清除导致碎片,JDK9 废弃)→ **G1(区域化 Region、可预测停顿、默认)** → ZGC(超低延迟,JDK15+ 可用,JDK21 默认转正?);GC 触发与日志(-Xlog:gc);**调优参数**:-Xms/-Xmx(堆初始与最大,生产设相等防抖动)/-Xmn(新生代)/-XX:MaxMetaspaceSize/-XX:+HeapDumpOnOutOfMemoryError;**OOM 四类**:堆溢出(对象太多,调大或查泄漏)/栈溢出(递归无底)/元空间(类太多)/直接内存;**调优工具**:命令行 jps/jstat(GC 情况)/jmap(堆转储)/jstack(线程栈——**查死锁与线程卡住的利器**) + 图形 VisualVM/Arthas(阿里,线上诊断神器);**类加载机制**:加载→验证→准备→解析→初始化 五阶段;**双亲委派模型**:启动类加载器 → 扩展类加载器 → 应用类加载器,子先问父——**为什么:防止核心类被篡改 + 避免重复加载**;破坏双亲委派(SPI/Tomcat/热部署,了解)。
**JIT**:热点代码编译成机器码(C1/C2),分层编译;逃逸分析与锁消除(高级优化,了解)。

## 第十站:Java 8+ 新特性(现代 Java 的日常)

**Java 8(改变最大的一代)**:Lambda 表达式(`(参数) -> 表达式`,配**函数式接口**(只有一个抽象方法,@FunctionalInterface):四大内置 Predicate(判)/Function(转)/Consumer(消费)/Supplier(生产));方法引用(类::静态方法/对象::方法/类::new);**Stream API**:集合的声明式流水线——创建(stream()/of/iterate)、中间操作(filter/map/flatMap/distinct/sorted/limit/skip/peek)、终止操作(forEach/collect(toList/toMap/groupingBy 分组/partitioningBy/joining)/reduce/count/max/min/anyMatch)、**惰性求值**(中间操作不执行,终止才跑)、并行流 parallelStream(小心:线程安全与性能,小数据别用);**Optional**:显式表达"可能为空",正确用法(ifPresent/orElse/orElseThrow/map 链),别拿它当字段;接口 default/static 方法;新日期 API(见第三站)。
**9~21 滚动更新**:9 模块化与集合工厂(List.of);10 局部变量 var;11 HTTP Client 与 String 新方法(isBlank/lines/strip);**14 record、switch 表达式、instanceof 模式匹配(16 完善)**;**15 文本块**;**16 流 toList**;**17 密封类 sealed/permits**(限制继承);**21 虚拟线程(Project Loom)**:轻量级线程(百万级),阻塞 IO 场景直接替代线程池,新项目尝鲜——**Java 的未来方向:结构化并发**。

## 第十一站:工程与框架

**构建**:Maven(约定目录、pom.xml、依赖坐标、生命周期;见 [Maven 学习路线](/learning-paths/build-tools/maven))与 Gradle(灵活、快;见 [Gradle 学习路线](/learning-paths/build-tools/gradle));**日志**:接口 **SLF4J** + 实现 **Logback**(或 Log4j2)——代码只面向 slf4j,`logger.info("用户 &#123;&#125; 登录", userId)` 占位符(别字符串拼接);级别与生产配置;**JSON**:Jackson(主流:ObjectMapper/注解 @JsonProperty/@JsonIgnoreProperties、JavaTimeModule 处理 LocalDateTime)或 Gson/Fastjson(注意安全漏洞史);**测试**:JUnit 5(@Test/@BeforeEach/@AfterEach/@ParameterizedTest/@DisplayName,断言 Assertions.assertThat? 那是 AssertJ) + Mockito(模拟依赖:when/thenReturn/verify,@Mock/@InjectMocks)+ JaCoCo 覆盖率;测试金字塔与"测试接口行为而非实现";**设计模式**:GoF 23 种在 JDK 里的影子(单例:枚举与双重检查;工厂:valueOf;建造者:StringBuilder;适配器:Arrays.asList;装饰:IO 流套娃;代理:动态代理;观察者:监听器;模板:AbstractList……)——先学"用得上"的 8-10 种,见 [Spring Boot 学习路线](/learning-paths/backend/spring-boot) 应用;**主流框架**:Spring/Spring Boot(容器 IoC + AOP,完整体系见 [Spring Boot 学习路线](/learning-paths/backend/spring-boot))、MyBatis/JPA(持久层)、Netty(网络)。
**书籍**:入门《Java 核心技术》、进阶《Effective Java》(必读)、《深入理解 Java 虚拟机》(JVM 圣经)、《Java 并发编程实战》(并发权威)。

## 通关标准

能独立做到:不查文档写一个多线程 + 集合 + 异常处理完整的小程序;画得出集合体系图并说清 HashMap 原理与 ConcurrentHashMap 的区别;能讲 synchronized 与 ReentrantLock、CountDownLatch 与 CyclicBarrier、== 与 equals 的区别;会用 Stream 与 Optional 写出干净的现代代码;看过 jstack 能找出死锁;能解释一次 new 对象在 JVM 里的完整旅程(类加载 → 内存分配 → GC 视角)——Java 主线通关。

Java 的学习之路漫长但回报扎实:它语法"啰嗦",但啰嗦换来的是工程上的稳定与团队协作的清晰;它版本迭代快,但 LTS 稳住节奏即可。记住:好的 Java 程序员不是记住了多少 API,而是理解了 JVM、并发与设计的本质。坚持写、坚持看源码(JDK 源码是最好的教材),你会成为值钱的 Java 工程师。
