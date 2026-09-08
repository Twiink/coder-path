---
title: "类加载机制与字节码"
aliases:
  - "双亲委派"
  - "ClassLoader"
  - "字节码增强"
tags:
  - "后端"
  - "java"
  - "jvm"
  - "面试"
category: "后端"
folder: "JVM"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/JVM/JVM概述与运行时数据区]]"
  - "[[后端/JVM/垃圾回收机制与收集器]]"
  - "[[后端/Java基础/反射与动态代理]]"
  - "[[后端/JavaWeb/Tomcat架构与部署]]"
created: 2026-09-07
updated: 2026-09-07
---

# 类加载机制与字节码

## 1. 类加载的完整过程 ★★★★★

```
      .class 文件（字节码）
            │
   ┌────────▼────────┐
   │  ① 加载 Loading   │  通过全限定名获取二进制流 → 转为方法区的运行时数据结构 → 在堆中生成 Class 对象
   └────────┬────────┘
            │
   ┌────────▼────────────────────────────────────┐
   │              ② 连接 Linking                   │
   │  ┌──────────────────────────────────────┐    │
   │  │ 2.1 验证 Verification                  │    │  确保字节码合法安全（格式、元数据、字节码、符号引用）
   │  ├──────────────────────────────────────┤    │
   │  │ 2.2 准备 Preparation                   │    │  ★ 为「静态变量」分配内存并赋【零值】
   │  ├──────────────────────────────────────┤    │
   │  │ 2.3 解析 Resolution                    │    │  符号引用 → 直接引用（可在初始化之后才做，支持动态绑定）
   │  └──────────────────────────────────────┘    │
   └────────┬────────────────────────────────────┘
            │
   ┌────────▼──────────────┐
   │ ③ 初始化 Initialization │  ★ 执行 <clinit>()：静态变量赋真实值 + 静态代码块
   └────────┬──────────────┘
            │
   ┌────────▼────────┐
   │  ④ 使用 Using     │
   └────────┬────────┘
            │
   ┌────────▼──────────────┐
   │ ⑤ 卸载 Unloading      │  该类所有实例、Class 对象、ClassLoader 都被回收
   └───────────────────────┘
```

### 1.1 加载（Loading）

```java
// 三件事：
// ① 通过类的全限定名获取定义此类的二进制字节流
//    来源可以是：.class 文件、jar/war/ear、网络（Applet）、运行时生成（动态代理）、
//              其他文件生成（JSP）、数据库、加密文件（防反编译）
// ② 将字节流所代表的静态存储结构转化为方法区的运行时数据结构
// ③ 在堆中生成一个代表该类的 java.lang.Class 对象，作为方法区数据的访问入口

// ★ 数组类比较特殊：不由类加载器创建，而是由 Java 运行时直接创建
//   但数组的「元素类型」仍由类加载器加载
int[] arr = new int[10];
System.out.println(arr.getClass().getClassLoader());   // null（由 JVM 直接创建）
User[] users = new User[10];
System.out.println(users.getClass().getClassLoader()); // null（数组类本身）
System.out.println(User.class.getClassLoader());        // AppClassLoader（元素类型的加载器）
```

### 1.2 验证（Verification）

| 阶段 | 校验内容 |
| --- | --- |
| **文件格式验证** | 魔数是否为 `0xCAFEBABY`、主次版本号是否在当前 JVM 支持范围、常量池是否有不支持的常量类型 |
| **元数据验证** | 语义分析：是否有父类（除 Object）、是否继承了 final 类、非抽象类是否实现了所有抽象方法、字段/方法是否与父类冲突 |
| **字节码验证**（最复杂） | 数据流/控制流分析：操作数栈数据类型与指令匹配、跳转指令指向合法位置、类型转换有效 |
| **符号引用验证** | 能否找到对应的类/字段/方法、访问权限是否正确（private/protected/public） |

```bash
# 关闭验证（可缩短类加载时间，但★ 极不安全，仅用于确定安全的场景）
-Xverify:none           # JDK 13 起已废弃
-noverify               # 同上
# 实际生产中不建议关闭：验证是防止恶意字节码的重要屏障
```

> 【面试】**为什么需要字节码验证？** 因为 Java 的字节码可以由任何工具生成（不只是 javac），甚至是人手写的。如果不验证，攻击者可以构造恶意 class（如把私有字段访问改为 public、跳转到非法地址、栈溢出攻击 JVM）。**这是 Java 沙箱安全模型的重要一环。**

### 1.3 准备（Preparation）★★★★★

**为「类的静态变量」分配内存并设置【零值】（不是代码中写的初始值！）**

```java
public class Demo {
    public static int value = 123;
    public static String name = "abc";
    public static final int CONST = 456;
    public int instanceVar = 789;              // 实例变量在对象实例化时分配（堆中）
}
```

| 变量 | 准备阶段后的值 | 初始化阶段后的值 | 说明 |
| --- | --- | --- | --- |
| `static int value` | **0** | 123 | 零值 |
| `static String name` | **null** | "abc" | 引用类型零值是 null |
| `static final int CONST` | **456** ★ | 456 | **编译期常量（ConstantValue 属性）在准备阶段就赋真值！** |
| `int instanceVar` | 不参与（对象创建时才分配） | 789 | 实例变量在堆的对象中 |

**各类型的零值：**

| 类型 | 零值 | 类型 | 零值 |
| --- | --- | --- | --- |
| `int` / `long` / `short` / `byte` | 0 / 0L | `float` / `double` | 0.0f / 0.0 |
| `char` | `'\u0000'` | `boolean` | **false**（JVM 用 int 0 表示） |
| 引用类型 | **null** | — | — |

```java
// ★ 编译期常量 vs 非编译期常量的区别
public static final int A = 100;                    // 编译期常量（ConstantValue 属性），准备阶段就是 100
public static final int B = new Random().nextInt();  // ★ 不是编译期常量！准备阶段是 0，初始化才赋值
public static final String C = "abc";               // 编译期常量
public static final String D = C + "def";           // ★ 编译期常量（常量折叠）
public static final Integer E = 100;                // ★ 不是编译期常量（Integer 是对象）

// 判断标准：值能否在【编译期】确定（字面量、常量运算、字符串拼接）
```

### 1.4 解析（Resolution）

**把常量池中的「符号引用」替换为「直接引用」。**

| 引用类型 | 说明 | 示例 |
| --- | --- | --- |
| **符号引用（Symbolic Reference）** | 用一组符号描述所引用的目标（字面量，与内存布局无关） | `com/example/User.getName:()Ljava/lang/String;` |
| **直接引用（Direct Reference）** | 直接指向目标的指针、相对偏移量、或句柄 | 内存地址 `0x7f8a1c00e000` |

**解析的对象：** 类/接口、字段、类方法、接口方法、方法类型、方法句柄、调用限定符 7 类符号引用。

```java
// 字节码中的符号引用
invokevirtual #15    // Method com/example/User.getName:()Ljava/lang/String;
                          ↑ 这是符号引用（字符串描述），解析后变成直接引用（方法表索引/地址）

// ★ 解析可能在「初始化之后」才发生！
// 因为 Java 支持动态绑定（运行时才知道实际类型），
// invokevirtual 的解析要等到方法真正被调用时（invokedynamic 更是完全运行时决定）
```

### 1.5 初始化（Initialization）★★★★★

**执行类构造器 `<clinit>()` 方法。**

```java
// <clinit>() 是编译器自动收集的：
//   ① 所有「静态变量的赋值动作」
//   ② 所有「静态代码块 static { }」
//   按源码中出现的顺序合并而成

public class Demo {
    static { a = 1; System.out.println("静态块 1"); }      // ①
    static int a = 2;                                       // ②
    static { System.out.println("静态块 2, a=" + a); }       // ③

    public static void main(String[] args) { }
}
// <clinit>() 的内容（按顺序）：
//   a = 1; println("静态块 1");
//   a = 2;
//   println("静态块 2, a=2");
// 输出：静态块 1  →  静态块 2, a=2
```

**`<clinit>()` 的关键特性：**

| 特性 | 说明 |
| --- | --- |
| **JVM 保证线程安全** | 多线程同时初始化一个类，只有一个线程执行 `<clinit>()`，其他线程**阻塞等待** ★ |
| 父类优先 | 初始化子类时，若父类未初始化则先初始化父类；但**接口不要求先初始化父接口** |
| 不需要显式调用父类 | `<clinit>()` 不会调用父类的 `<clinit>()`（JVM 保证顺序） |
| 可以没有 | 类中没有静态变量赋值和静态代码块，编译器就不生成 `<clinit>()` |
| 接口也有 | 接口不能有静态代码块，但静态变量赋值仍会生成 `<clinit>()` |

```java
// ★ <clinit> 的线程安全性 = 「静态内部类单例」的理论基础
public class Singleton {
    private Singleton() { }
    private static class Holder {
        static final Singleton INSTANCE = new Singleton();     // 在 Holder 的 <clinit> 中执行
    }
    public static Singleton getInstance() {
        return Holder.INSTANCE;      // 首次调用才触发 Holder 类初始化，JVM 保证只初始化一次
    }
}
// 这就是为什么这种写法「懒加载 + 线程安全 + 无锁」

// ★ 但 <clinit> 的线程安全也带来「死锁」风险
public class DeadlockDemo {
    static class A {
        static { sleep(100); B.doSomething(); }         // A 的初始化中调用 B
    }
    static class B {
        static { A.doSomething(); }                      // B 的初始化中调用 A
    }
}
// 两个线程分别触发 A 和 B 的初始化 → 互相等待对方完成 <clinit> → ★ 类初始化死锁
// jstack 会显示：waiting on condition / in Object.wait() at ClassLoader
```

**`<clinit>()` vs `<init>()`：**

| | `<clinit>()` | `<init>()` |
| --- | --- | --- |
| 名称 | 类构造器（class initializer） | 实例构造器（instance initializer） |
| 触发 | **类初始化阶段**（首次主动使用） | **对象创建时**（new） |
| 执行次数 | 每个类**只执行一次** | 每创建一个对象执行一次 |
| 内容 | 静态变量赋值 + 静态代码块 | 实例变量赋值 + 实例代码块 + 构造器体（先 `super()`） |
| 线程安全 | **JVM 保证** | 不保证 |
| 调用父类版本 | 不调用（JVM 保证父类先初始化） | **必须先调用** `super.<init>()` |
| 是否必须 | 无静态初始化内容时不生成 | 无构造器时编译器生成默认的 |

### 1.6 类初始化的触发时机（主动引用 vs 被动引用）★★★★★

**六种「主动引用」场景（必然触发初始化）：**

| # | 场景 | 示例 |
| --- | --- | --- |
| 1 | 使用 `new` 实例化、读写静态字段（非编译期常量）、调用静态方法 | `new User()`、`Config.NAME`、`Util.f()` |
| 2 | **反射调用** | `Class.forName("com.example.User")` |
| 3 | **初始化子类时，父类未初始化** | 先触发父类的初始化 |
| 4 | **JVM 启动的主类**（含 main 方法） | — |
| 5 | JDK 7+ 动态语言支持：`MethodHandle` 解析结果为 REF_getStatic 等 | — |
| 6 | **接口中定义了 default 方法，其实现类初始化时接口要先初始化** | — |

**「被动引用」不触发初始化（★ 面试高频）：**

```java
class Parent {
    static int value = 1;
    static { System.out.println("Parent 初始化"); }
}
class Child extends Parent {
    static { System.out.println("Child 初始化"); }
}

// ① 通过子类引用父类的静态字段 → 只初始化 Parent，不初始化 Child
System.out.println(Child.value);
// 输出："Parent 初始化" + "1"（★ 没有 "Child 初始化"）
// 原因：JVM 规范规定「对于静态字段，只有直接定义这个字段的类才会被初始化」

// ② 定义类的数组 → 不触发初始化
Child[] arr = new Child[10];
// 无任何输出（只是创建了一个数组类型，不初始化元素类）

// ③ 引用编译期常量 → 不触发初始化（常量已在编译期存入调用类的常量池）
class Const {
    static final String NAME = "hello";
    static { System.out.println("Const 初始化"); }
}
System.out.println(Const.NAME);
// 输出："hello"（★ 没有 "Const 初始化"）
// 原因：javac 把 "hello" 直接内联到调用方的常量池中，运行时已不依赖 Const 类

// ④ ClassLoader.loadClass() → 只加载，不初始化
ClassLoader.getSystemClassLoader().loadClass("com.example.User");

// ⑤ Class.forName(name, false, loader) → 第二个参数 false 表示不初始化
Class.forName("com.example.User", false, loader);

// ⑥ 查询 Class 对象本身不触发初始化？★ 会触发！
Class<?> c = User.class;          // ❌ 这个「不会」触发（.class 字面量是编译期确定的）
Class<?> c2 = Class.forName("com.example.User");   // ✅ 这个「会」触发
```

## 2. 类加载器（ClassLoader）★★★★★

### 2.1 四种类加载器

| 加载器 | 名称 | 加载范围 | 实现 |
| --- | --- | --- | --- |
| **启动类加载器** | Bootstrap ClassLoader | `<JAVA_HOME>/lib`（如 `rt.jar`、`java.lang.*`）；或被 `-Xbootclasspath` 指定 | **C++ 实现**，是 JVM 的一部分，**Java 中获取到的是 `null`** |
| **扩展类加载器** | Extension ClassLoader（JDK 9+ 改名 **Platform ClassLoader**） | `<JAVA_HOME>/lib/ext` 目录，或 `java.ext.dirs` 指定 | `sun.misc.Launcher$ExtClassLoader`（JDK 9+: `jdk.internal.loader.ClassLoaders$PlatformClassLoader`） |
| **应用类加载器** | Application ClassLoader（System ClassLoader） | **用户 classpath**（`-cp` 指定的路径，即我们写的代码和依赖 jar） | `sun.misc.Launcher$AppClassLoader` |
| **自定义类加载器** | Custom ClassLoader | 任意来源 | 继承 `java.lang.ClassLoader` |

```java
// 查看类加载器
System.out.println(String.class.getClassLoader());           // null（Bootstrap）
System.out.println(javax.sql.DataSource.class.getClassLoader());  // null 或 Platform（JDK 9+）
System.out.println(MyApp.class.getClassLoader());            // jdk.internal.loader.ClassLoaders$AppClassLoader@...

// 类加载器的层次（★ 不是继承关系，是「组合」关系！）
AppClassLoader
    │ parent（字段，不是继承）
    ▼
PlatformClassLoader（JDK 8 是 ExtClassLoader）
    │ parent
    ▼
null（Bootstrap，C++ 实现，Java 中无对象）

// 获取层次
ClassLoader cl = MyApp.class.getClassLoader();
while (cl != null) {
    System.out.println(cl);
    cl = cl.getParent();
}
System.out.println("Bootstrap: null");

// 三个重要方法
ClassLoader.getSystemClassLoader();          // AppClassLoader
Thread.currentThread().getContextClassLoader();   // ★ 线程上下文类加载器（默认 = AppClassLoader）
ClassLoader.getPlatformClassLoader();        // JDK 9+
```

### 2.2 JDK 9 模块化后的变化

| | JDK 8 及以前 | JDK 9+ |
| --- | --- | --- |
| 类路径 | classpath（`-cp`） | classpath + **module path**（`--module-path`） |
| ExtClassLoader | 存在（`lib/ext`） | **移除**，改为 PlatformClassLoader |
| rt.jar | 存在 | **移除**，拆分为约 70 个模块（`java.base`、`java.sql`...） |
| tools.jar | 存在 | **移除**（`javac` 成为 `jdk.compiler` 模块） |
| 可见性 | public 即全局可见 | 需要模块 `exports` 才可见（**强封装**） |

```java
// JDK 9+ 的三层类加载器
// BootClassLoader（C++）→ 加载 java.base 等基础模块
// PlatformClassLoader   → 加载 java.sql、java.xml 等平台模块（取代 ExtClassLoader）
// AppClassLoader        → 加载应用模块和 classpath 上的类

// 强封装的影响（★ JDK 17 收紧）
// JDK 9~15：反射访问 JDK 内部 API 会有警告（--illegal-access=permit 默认）
// JDK 16：默认 deny，警告变异常
// JDK 17：★ 强封装生效，必须显式 --add-opens
Field f = String.class.getDeclaredField("value");
f.setAccessible(true);
// JDK 17: InaccessibleObjectException: module java.base does not "opens java.lang" to unnamed module
// 解决：java --add-opens java.base/java.lang=ALL-UNNAMED -jar app.jar
```

### 2.3 双亲委派模型（Parents Delegation Model）★★★★★

**核心规则：收到类加载请求时，先委派给父加载器处理，只有父加载器无法完成（找不到类）时，子加载器才自己尝试加载。**

```java
// ClassLoader.loadClass 的源码（这就是双亲委派的实现）
protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
    synchronized (getClassLoadingLock(name)) {
        // ① 检查该类是否已被加载过
        Class<?> c = findLoadedClass(name);
        if (c == null) {
            long t0 = System.nanoTime();
            try {
                if (parent != null) {
                    c = parent.loadClass(name, false);       // ★ 委派给父加载器（递归向上）
                } else {
                    c = findBootstrapClassOrNull(name);      // 到达顶层，找 Bootstrap
                }
            } catch (ClassNotFoundException e) {
                // 父加载器找不到，不抛异常，继续往下
            }

            if (c == null) {
                // ② ★ 父加载器都找不到，才自己加载
                long t1 = System.nanoTime();
                c = findClass(name);                          // ★ 子类重写这个方法
                ...
            }
        }
        if (resolve) resolveClass(c);
        return c;
    }
}

// AppClassLoader.findClass 的实现（URLClassLoader）
protected Class<?> findClass(final String name) throws ClassNotFoundException {
    // 把类名转为路径（com.example.User → com/example/User.class）
    // 从 classpath 的 URL 中查找并读取字节流
    // 调用 defineClass(name, bytes, 0, bytes.length) 转为 Class 对象
}
```

**双亲委派的两大好处：**

| 好处 | 说明 |
| --- | --- |
| **① 避免类的重复加载** | 父加载器加载过的类，子加载器不会重复加载（节省元空间） |
| **② 保证核心类的安全**（最重要） | 用户自定义的 `java.lang.String` 会被委派到 Bootstrap，Bootstrap 加载 JDK 自带的 String → **用户写的 String 永远不生效**，防止核心 API 被篡改 |

```java
// ★ 安全性的经典验证：自定义 java.lang.String
package java.lang;
public class String {
    public String() { System.out.println("我是假的 String！"); }
}
// 编译通过，但运行时：
// ① 双亲委派：AppClassLoader → PlatformClassLoader → Bootstrap
//    Bootstrap 在 rt.jar/java.base 中找到真正的 java.lang.String 并加载 → 假 String 永远不会被加载
// ② 即使绕过双亲委派强行加载，也会抛：
//    java.lang.SecurityException: Prohibited package name: java.lang
//    （defineClass 中有包名保护检查）
```

### 2.4 破坏双亲委派的三大场景 ★★★★★

| # | 场景 | 原因 | 实现方式 |
| --- | --- | --- | --- |
| 1 | **JDBC / JNDI / JAXP 等 SPI** | 接口（`java.sql.Driver`）在 Bootstrap 加载的 `java.base` 中，但**实现类（MySQL Driver）在 classpath**，Bootstrap 无法加载 → 需要「反向委派」 | **线程上下文类加载器（TCCL）** |
| 2 | **Tomcat 的 Web 应用隔离** | 不同 Web 应用可能用同一个库的不同版本（App1 用 Spring 4，App2 用 Spring 5），必须互相隔离 | **每个 WebApp 一个独立的 WebappClassLoader，优先加载自己 WEB-INF 下的类** |
| 3 | **热部署 / OSGi / JRebel** | 需要在运行时替换类（重新加载修改后的代码），双亲委派会「已加载过就不再加载」 | 自定义 ClassLoader，每次重新加载都创建新的 ClassLoader 实例 |
| 4 | JDK 9 模块化 | 模块之间的类可见性由 `exports` 决定，不再是简单的层次委派 | ClassLoader 增加了「按模块查找」的逻辑 |

#### 场景 1：线程上下文类加载器（TCCL）

```java
// 问题：java.sql.DriverManager 在 java.base 模块（Bootstrap 加载），
//      但 MySQL 的 Driver 实现在 classpath（AppClassLoader 才能加载）
//      Bootstrap 无法「向下」委派给 AppClassLoader（双亲委派是单向向上的）

// 解决：DriverManager 使用「线程上下文类加载器」来加载 SPI 实现
public class DriverManager {
    static {
        loadInitialDrivers();                 // 静态初始化时加载所有 Driver
    }
    private static void loadInitialDrivers() {
        // ★ 用 ServiceLoader（SPI 机制），它内部使用 TCCL
        ServiceLoader<Driver> loadedDrivers = ServiceLoader.load(Driver.class);
        ...
    }
}

// ServiceLoader.load 的源码
public static <S> ServiceLoader<S> load(Class<S> service) {
    ClassLoader cl = Thread.currentThread().getContextClassLoader();   // ★ 关键
    return new ServiceLoader<>(Reflection.getCallerClass(), service, cl);
}

// TCCL 的默认值 = AppClassLoader（在 Launcher 构造时设置）
// main 线程启动时，JVM 自动把 TCCL 设为 AppClassLoader
```

**TCCL 的意义：** 它让「父加载器加载的代码」能够使用「子加载器加载的实现」，是一种**约定俗成的「后门」**（并非 JVM 规范强制）。

```java
// 使用 TCCL 的标准写法
ClassLoader contextLoader = Thread.currentThread().getContextClassLoader();
try {
    // 临时切换为需要的加载器
    Thread.currentThread().setContextClassLoader(myClassLoader);
    Class<?> clazz = Class.forName("com.example.SomeClass", true, myClassLoader);
    ...
} finally {
    Thread.currentThread().setContextClassLoader(contextLoader);      // ★ 必须还原！
}
```

> 【坑】**TCCL 是 ThreadLocal 的，线程池中如果不还原会导致后续任务用错加载器**。Spring、Tomcat 在切换 TCCL 时都用 try-finally 严格还原。

#### 场景 2：Tomcat 的类加载器架构

```
                    Bootstrap ClassLoader
                           ↑ parent
                    System(Ext/Platform) ClassLoader
                           ↑ parent
                    Common ClassLoader          ← $CATALINA_HOME/lib（Tomcat 自身 + 共享库）
                     ↗              ↖
      Catalina ClassLoader      Shared ClassLoader   ← 可选，服务器与所有 WebApp 共享
                                       ↓
                    ┌──────────────────┴──────────────────┐
              WebApp1 ClassLoader                    WebApp2 ClassLoader
              （WEB-INF/classes, WEB-INF/lib）        （独立，互不影响）★
                    ↓                                      ↓
              Jsp1 ClassLoader                       Jsp2 ClassLoader
              （每个 JSP 一个，支持热更新）
```

**Tomcat 的 WebappClassLoader 加载顺序（★ 打破双亲委派）：**

```
① 先在本地缓存中查找（已加载过的类）
② 委派给 Bootstrap（加载 JDK 核心类，防止被篡改）★ 这一步保留双亲委派的安全价值
③ ★ 在自己的 WEB-INF/classes 和 WEB-INF/lib 中查找（优先于父加载器！）
④ 委派给 Common ClassLoader（父加载器）
⑤ 都找不到 → ClassNotFoundException
```

**为什么 WebApp 要「优先加载自己的类」？**
1. **隔离**：App1 用 Spring 4，App2 用 Spring 5，各自加载自己的版本，互不干扰。
2. **同一个类在不同 ClassLoader 中是不同的类**：`类的唯一标识 = 全限定名 + ClassLoader 实例`。

```java
// ★ 验证：不同 ClassLoader 加载的「同一个类」互不兼容
ClassLoader loader1 = new MyClassLoader();
ClassLoader loader2 = new MyClassLoader();
Class<?> c1 = loader1.loadClass("com.example.User");
Class<?> c2 = loader2.loadClass("com.example.User");

System.out.println(c1.getName().equals(c2.getName()));   // true（全限定名相同）
System.out.println(c1 == c2);                             // ★ false！（ClassLoader 不同）

Object obj = c1.getDeclaredConstructor().newInstance();
c2.cast(obj);      // ❌ ClassCastException: com.example.User cannot be cast to com.example.User
                   // ★ 报错信息看起来很诡异（同名类无法转换），这是 ClassLoader 隔离的典型症状
```

#### 场景 3：热部署与类卸载

```java
// 类卸载的三个必要条件（缺一不可）：
// ① 该类所有的实例都已被 GC
// ② 加载该类的 ClassLoader 已被 GC
// ③ 该类对应的 Class 对象没有任何地方被引用（无法通过反射访问）

// ★ 关键：Bootstrap/Platform/App 这三个加载器在 JVM 生命周期内不会被回收，
//   所以它们加载的类【永远不会被卸载】
//   只有【自定义 ClassLoader】加载的类才可能被卸载 → 这就是热部署的基础

// 热部署的实现思路
public class HotDeployClassLoader extends ClassLoader {
    private final String classPath;

    public HotDeployClassLoader(String classPath) {
        super(null);                    // ★ parent 设为 null（不用 AppClassLoader 做父）
        this.classPath = classPath;
    }

    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        byte[] data = loadClassData(name);
        return defineClass(name, data, 0, data.length);
    }

    private byte[] loadClassData(String name) {
        String path = classPath + "/" + name.replace('.', '/') + ".class";
        try (InputStream in = Files.newInputStream(Paths.get(path))) {
            return in.readAllBytes();
        } catch (IOException e) {
            throw new RuntimeException("加载类失败: " + name, e);
        }
    }
}

// 热部署流程
HotDeployClassLoader loader = new HotDeployClassLoader("/path/to/classes");
Class<?> clazz = loader.loadClass("com.example.Plugin");
Object instance = clazz.getDeclaredConstructor().newInstance();
// ... 使用

// 代码更新后：
loader = null;                           // ★ 丢弃旧的 ClassLoader
System.gc();                              // 触发 GC，旧 ClassLoader 及其所有类被卸载
loader = new HotDeployClassLoader("/path/to/classes");   // 创建新的，加载新版本的类
clazz = loader.loadClass("com.example.Plugin");          // 得到新版本的 Class
```

> 【坑】**热部署导致元空间泄漏（Metaspace OOM）的常见原因**：旧 ClassLoader 无法被回收，因为有「意外引用」存在。常见持有者：
> 1. **ThreadLocal** 中存了旧 ClassLoader 加载的对象（线程池线程长期存活）。
> 2. **JDBC DriverManager** 注册了旧 ClassLoader 加载的 Driver（静态引用）。
> 3. **shutdown hook** 线程引用了旧类。
> 4. **定时器线程**（`java.util.Timer`）未取消。
> 5. **JNI 全局引用**（`NewGlobalRef`）未释放。
> 6. **日志框架**（Log4j/Logback）的配置持有旧类引用。
>
> 这是 Tomcat 反复部署后 `PermGen space`/`Metaspace` OOM 的经典原因。Tomcat 的 `WebappClassLoaderBase.clearReferences()` 方法专门做这些清理。

### 2.5 自定义 ClassLoader 实战

```java
/**
 * 加密 class 文件的解密加载器（防反编译）
 */
public class DecryptClassLoader extends ClassLoader {

    private final String basePath;
    private final byte[] decryptKey;

    public DecryptClassLoader(String basePath, byte[] decryptKey) {
        super(DecryptClassLoader.class.getClassLoader());     // parent = AppClassLoader
        this.basePath = basePath;
        this.decryptKey = decryptKey;
    }

    /**
     * ★ 只重写 findClass（不重写 loadClass），保持双亲委派
     * 若需打破双亲委派，重写 loadClass
     */
    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        try {
            Path path = Paths.get(basePath, name.replace('.', '/') + ".classx");   // 加密后的扩展名
            if (!Files.exists(path)) throw new ClassNotFoundException(name);

            byte[] encrypted = Files.readAllBytes(path);
            byte[] decrypted = decrypt(encrypted, decryptKey);      // 解密

            // ★ defineClass：把字节数组转为 Class 对象（native 方法）
            return defineClass(name, decrypted, 0, decrypted.length);
        } catch (IOException e) {
            throw new ClassNotFoundException(name, e);
        }
    }

    private byte[] decrypt(byte[] data, byte[] key) {
        byte[] result = new byte[data.length];
        for (int i = 0; i < data.length; i++) {
            result[i] = (byte) (data[i] ^ key[i % key.length]);     // 简单异或（实际用 AES）
        }
        return result;
    }
}

/**
 * 打破双亲委派：优先加载自己的类（模拟 Tomcat WebappClassLoader）
 */
public class IsolatedClassLoader extends URLClassLoader {

    private final Set<String> excludedPackages;     // 仍然委派给父加载器的包（如 java.*）

    public IsolatedClassLoader(URL[] urls, ClassLoader parent) {
        super(urls, parent);
        this.excludedPackages = Set.of("java.", "javax.", "sun.", "jdk.");
    }

    /** ★ 重写 loadClass 打破双亲委派 */
    @Override
    protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
        synchronized (getClassLoadingLock(name)) {
            // ① 已加载过则直接返回
            Class<?> c = findLoadedClass(name);
            if (c != null) return c;

            // ② 核心类仍然委派给父加载器（★ 必须保留，否则 SecurityException）
            if (excludedPackages.stream().anyMatch(name::startsWith)) {
                return super.loadClass(name, resolve);
            }

            // ③ ★ 优先自己加载
            try {
                c = findClass(name);
                if (resolve) resolveClass(c);
                return c;
            } catch (ClassNotFoundException e) {
                // ④ 自己找不到才委派给父
                return super.loadClass(name, resolve);
            }
        }
    }
}

// ─── defineClass 的三个重载 ───
protected final Class<?> defineClass(String name, byte[] b, int off, int len);
protected final Class<?> defineClass(String name, byte[] b, int off, int len, ProtectionDomain pd);
protected final Class<?> defineClass(String name, ByteBuffer b, ProtectionDomain pd);
// ★ defineClass 是 final 的，不可重写；它内部会做：
//   - 包名保护检查（java.* 开头抛 SecurityException）
//   - 字节码验证
//   - 在方法区创建类元数据，在堆中创建 Class 对象
```

**自定义 ClassLoader 的应用场景：**

| 场景 | 说明 | 代表 |
| --- | --- | --- |
| **隔离** | 不同模块加载同名不同版本的类 | Tomcat、OSGi、SOFAArk、Java Agent |
| **热部署/热替换** | 运行时替换类实现 | JRebel、Spring Boot DevTools、Arthas `redefine` |
| **加密保护** | 加载加密的 class 防反编译 | 商业软件保护 |
| **动态生成** | 运行时生成类字节码并加载 | CGLIB、Byte Buddy、JDK Proxy、Groovy |
| **网络加载** | 从远程服务器加载类 | Applet（已淘汰）、微内核插件系统 |
| **类修改/增强** | 加载时织入切面代码 | SkyWalking、JaCoCo、Arthas（Java Agent + Instrumentation） |

### 2.6 SPI 机制（Service Provider Interface）

```java
// SPI 是「双亲委派破坏」的标准场景，也是插件化架构的基础

// ─── 步骤 1：定义接口（在核心包中）───
package com.example.spi;
public interface HelloService {
    String sayHello(String name);
}

// ─── 步骤 2：提供实现（在扩展 jar 中）───
package com.example.spi.impl;
public class ChineseHello implements HelloService {
    public String sayHello(String name) { return "你好，" + name; }
}
public class EnglishHello implements HelloService {
    public String sayHello(String name) { return "Hello, " + name; }
}

// ─── 步骤 3：在扩展 jar 的 META-INF/services/ 下创建以「接口全限定名」命名的文件 ───
// 文件路径：META-INF/services/com.example.spi.HelloService
// 文件内容（每行一个实现类的全限定名）：
// com.example.spi.impl.ChineseHello
// com.example.spi.impl.EnglishHello

// ─── 步骤 4：用 ServiceLoader 加载 ───
ServiceLoader<HelloService> loader = ServiceLoader.load(HelloService.class);
for (HelloService service : loader) {          // ★ 懒加载：迭代时才实例化
    System.out.println(service.sayHello("Tom"));
}
// 输出：你好，Tom
//      Hello, Tom

// 其他 API
loader.stream();                                 // JDK 9+：Stream<Provider<S>>
loader.reload();                                 // 清除缓存，重新加载
loader.findFirst();                              // JDK 9+：Optional<S>
ServiceLoader.load(HelloService.class, myClassLoader);   // 指定 ClassLoader
```

**JDK/框架中的 SPI 应用：**

| SPI 接口 | 实现 | 配置文件位置 |
| --- | --- | --- |
| `java.sql.Driver` | MySQL/Oracle/PostgreSQL Driver | `META-INF/services/java.sql.Driver` |
| `java.nio.charset.spi.CharsetProvider` | 自定义字符集 | 同上 |
| `javax.sound.midi.spi.MidiFileReader` | MIDI 解析器 | 同上 |
| `java.util.spi.LocaleNameProvider` | 本地化名称 | 同上 |
| **Dubbo 的 `@SPI`** | Dubbo 扩展点（比 JDK SPI 强，支持按名加载、AOP、DI） | `META-INF/dubbo/接口名` |
| **Spring 的 `spring.factories`** | 自动配置类、监听器、初始化器 | `META-INF/spring.factories`（Spring Boot 2）<br>`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`（Boot 2.7+/3） |
| SLF4J | 日志实现绑定 | `META-INF/services/org.slf4j.spi.SLF4JServiceProvider` |

```java
// Dubbo 的 SPI 增强（对比 JDK SPI 的不足）
// JDK SPI 的问题：
// 1. 一次性实例化所有实现（即使只用一个）→ 浪费资源
// 2. 不能按需获取指定实现（只能遍历）
// 3. 不支持依赖注入和 AOP

// Dubbo 的 @SPI
@SPI("dubbo")                                  // 默认实现名
public interface Protocol {
    @Adaptive
    <T> Exporter<T> export(Invoker<T> invoker);
}
// 配置文件：META-INF/dubbo/org.apache.dubbo.rpc.Protocol
// dubbo=org.apache.dubbo.rpc.protocol.dubbo.DubboProtocol
// http=org.apache.dubbo.rpc.protocol.http.HttpProtocol

Protocol p = ExtensionLoader.getExtensionLoader(Protocol.class).getExtension("http");
// ★ 按名加载，懒实例化，支持 Wrapper（AOP）和 @Adaptive（运行时自适应）
```

## 3. 字节码与字节码增强

### 3.1 class 文件结构

```
ClassFile {
    u4             magic;                 // 魔数 0xCAFEBABY（标识这是个 class 文件）
    u2             minor_version;         // 次版本号
    u2             major_version;         // ★ 主版本号（52=JDK8, 61=JDK17, 65=JDK21）
    u2             constant_pool_count;   // 常量池大小
    cp_info        constant_pool[];       // ★ 常量池（字面量 + 符号引用）
    u2             access_flags;          // 访问标志（public/final/abstract/interface...）
    u2             this_class;            // 类索引
    u2             super_class;           // 父类索引
    u2             interfaces_count;      // 接口数量
    u2             interfaces[];          // 接口索引集合
    u2             fields_count;          // 字段数量
    field_info     fields[];              // ★ 字段表
    u2             methods_count;         // 方法数量
    method_info    methods[];             // ★ 方法表（含字节码 Code 属性）
    u2             attributes_count;      // 属性数量
    attribute_info attributes[];          // ★ 属性表（SourceFile、LineNumberTable、注解等）
}
```

**访问标志（access_flags）：**

| 标志 | 值 | 含义 |
| --- | --- | --- |
| `ACC_PUBLIC` | 0x0001 | public |
| `ACC_FINAL` | 0x0010 | final |
| `ACC_SUPER` | 0x0020 | 允许使用 `invokespecial`（JDK 1.0.2 后的类都为 true） |
| `ACC_INTERFACE` | 0x0200 | 接口 |
| `ACC_ABSTRACT` | 0x0400 | abstract |
| `ACC_SYNTHETIC` | 0x1000 | **编译器生成**（非源码中定义，如桥接方法、内部类的 this$0） |
| `ACC_ANNOTATION` | 0x2000 | 注解类型 |
| `ACC_ENUM` | 0x4000 | 枚举 |
| `ACC_MODULE` | 0x8000 | 模块（JDK 9+） |

**常用属性（attributes）：**

| 属性名 | 作用 |
| --- | --- |
| `Code` | **方法的字节码**（含 max_stack、max_locals、字节码指令、异常表、行号表） |
| `ConstantValue` | **编译期常量**的值（`static final` 在准备阶段就赋值的来源） |
| `LineNumberTable` | 字节码行号 ↔ 源码行号（异常栈信息的来源） |
| `LocalVariableTable` | 局部变量名 ↔ Slot 索引（调试器用；`-g` 参数控制是否生成） |
| `Exceptions` | 方法 throws 的受检异常列表 |
| `Signature` | **泛型签名**（类型擦除后泛型信息的保存处，反射读取泛型靠它） |
| `RuntimeVisibleAnnotations` | **运行时可见注解**（`@Retention(RUNTIME)`） |
| `RuntimeInvisibleAnnotations` | 编译期/类文件期注解 |
| `SourceFile` | 源文件名 |
| `Deprecated` | `@Deprecated` |
| `BootstrapMethods` | **invokedynamic 的引导方法**（Lambda 的实现基础） |
| `InnerClasses` | 内部类信息 |

### 3.2 字节码指令集（了解）

```
约 200 条指令，操作码 1 字节（理论最多 256 条），按功能分类：

┌─────────────────────────────────────────────────────────────┐
│ 加载与存储：aload iload ldc getstatic getfield astore istore   │
│ 运算：iadd isub imul idiv iinc（自增）ladd dadd                 │
│ 类型转换：i2l i2d d2i checkcast（强转）                          │
│ 对象创建与访问：new dup invokespecial（构造器）putfield getfield  │
│ 操作数栈管理：pop dup swap                                      │
│ 控制转移：ifeq ifne iflt goto tableswitch lookupswitch         │
│          ireturn areturn return                                │
│ 方法调用：                                                      │
│   invokestatic    静态方法                                      │
│   invokespecial   构造器 <init>、私有方法、super.method()          │
│   invokevirtual   ★ 普通实例方法（虚方法，运行时动态分派）          │
│   invokeinterface ★ 接口方法（运行时动态分派）                     │
│   invokedynamic   ★ Lambda、字符串拼接、动态语言                   │
│ 同步：monitorenter monitorexit                                  │
│ 异常：athrow                                                    │
└─────────────────────────────────────────────────────────────┘
```

**javap 实战：**

```bash
javap -c ClassName              # 反编译为字节码（disassemble）
javap -v ClassName              # ★ 详细信息（常量池、属性、访问标志）
javap -p ClassName              # 显示所有成员（含 private）
javap -s ClassName              # 显示内部类型签名（descriptor）
javap -l ClassName              # 显示行号和局部变量表
javap -constants ClassName      # 显示 static final 常量的值
javap -classpath target/classes com.example.User

# 示例输出解读
public int add(int, int);
  descriptor: (II)I                      ← 类型描述符：两个 int 参数，返回 int
  flags: (0x0001) ACC_PUBLIC
  Code:
    stack=2, locals=3, args_size=3       ← ★ 操作数栈深度 2，局部变量 3 个 Slot，参数 3 个（含 this）
       0: iload_1                        ← 把 Slot1（参数 a）压入操作数栈
       1: iload_2                        ← 把 Slot2（参数 b）压入栈
       2: iadd                           ← 弹出两个，相加，结果压栈
       3: ireturn                        ← 弹出结果返回
    LineNumberTable:                     ← 行号表（异常栈用）
      line 5: 0
    LocalVariableTable:                  ← 局部变量表（调试用）
      Start  Length  Slot  Name   Signature
          0       4     0  this   Lcom/example/Calc;
          0       4     1  a      I
          0       4     2  b      I
```

**类型描述符（Descriptor）规则：**

| Java 类型 | 描述符 | Java 类型 | 描述符 |
| --- | --- | --- | --- |
| `void` | `V` | `int` | `I` |
| `boolean` | `Z` | `long` | `J` |
| `byte` | `B` | `float` | `F` |
| `char` | `C` | `double` | `D` |
| `short` | `S` | 对象 | `L全限定名;`（如 `Ljava/lang/String;`） |
| 数组 | `[元素描述符`（如 `[I` = int[]，`[[I` = int[][]，`[Ljava/lang/String;` = String[]） |

```
方法签名示例：
String getName()                          → ()Ljava/lang/String;
void setName(String name)                 → (Ljava/lang/String;)V
int compare(Integer a, Long b)            → (Ljava/lang/Integer;Ljava/lang/Long;)I
List<String> process(Map<String,Object>)  → (Ljava/util/Map;)Ljava/util/List;   ← ★ 泛型被擦除
```

### 3.3 字节码增强技术

| 工具 | 抽象层次 | 性能 | 特点 | 使用者 |
| --- | --- | --- | --- | --- |
| **ASM** | 最低（直接操作字节码指令，访问者模式） | **最快** | 学习曲线陡，功能最强 | CGLIB、Spring、JaCoCo、Groovy、字节码工具 |
| **Javassist** | 高（可用 **Java 源码字符串** 编辑） | 中 | 简单，无需懂字节码 | MyBatis（延迟加载）、Hibernate（旧）、Dubbo |
| **Byte Buddy** | 高（**类型安全的 DSL API**） | 快 | 现代、活跃维护、API 优雅 | Mockito、Hibernate 5.2+、SkyWalking、Spring 6 部分场景 |
| **CGLIB** | 中（基于 ASM 的高级封装） | 快 | 停滞维护（3.3.0，2019） | Spring（repackaged 内置） |
| **Instrumentation API** | JVM 原生 | — | 通过 Java Agent 在类加载时修改字节码 | Arthas、JaCoCo、APM 探针、JRebel |

```java
// ─── Byte Buddy 示例：给所有方法织入日志 ───
Class<?> proxyType = new ByteBuddy()
    .subclass(UserService.class)                          // 生成子类
    .method(ElementMatchers.any())                        // 匹配所有方法
    .intercept(MethodDelegation.to(LoggingInterceptor.class))   // 委托给拦截器
    .make()
    .load(getClass().getClassLoader(),
          ClassLoadingStrategy.Default.INJECTION)
    .getLoaded();

public class LoggingInterceptor {
    @RuntimeType
    public static Object intercept(@Origin Method method,        // 原方法
                                   @SuperCall Callable<?> callable,  // 调用父类方法
                                   @AllArguments Object[] args) throws Exception {
        long start = System.nanoTime();
        try {
            Object result = callable.call();
            log.info("{}.{} 耗时 {}μs", method.getDeclaringClass().getSimpleName(),
                     method.getName(), (System.nanoTime() - start) / 1000);
            return result;
        } catch (Exception e) {
            log.error("{}.{} 异常", method.getName(), method.getName(), e);
            throw e;
        }
    }
}

// ─── Java Agent（Instrumentation）：JVM 级别的字节码修改 ───
// 1. 编写 Agent（带 premain 或 agentmain 方法）
public class MyAgent {
    /** JVM 启动时加载（-javaagent 方式） */
    public static void premain(String args, Instrumentation inst) {
        inst.addTransformer(new MyClassFileTransformer());       // ★ 注册类转换器
    }
    /** 运行时动态附加（Attach API，Arthas 用这种方式） */
    public static void agentmain(String args, Instrumentation inst) {
        inst.addTransformer(new MyClassFileTransformer(), true);  // true = 支持 retransform
        // 已加载的类可以重新转换
        inst.retransformClasses(TargetClass.class);
    }
}

// 2. 实现 ClassFileTransformer
public class MyClassFileTransformer implements ClassFileTransformer {
    @Override
    public byte[] transform(ClassLoader loader, String className, Class<?> classBeingRedefined,
                            ProtectionDomain pd, byte[] classfileBuffer) {
        if (!className.startsWith("com/example/")) return null;   // 返回 null 表示不修改
        // 用 ASM/ByteBuddy 修改字节码
        ClassReader cr = new ClassReader(classfileBuffer);
        ClassWriter cw = new ClassWriter(cr, ClassWriter.COMPUTE_FRAMES);
        cr.accept(new MyClassVisitor(cw), ClassReader.EXPAND_FRAMES);
        return cw.toByteArray();                                  // 返回修改后的字节码
    }
}

// 3. MANIFEST.MF 中声明
// Premain-Class: com.example.MyAgent
// Agent-Class: com.example.MyAgent          （支持运行时 attach）
// Can-Retransform-Classes: true
// Can-Redefine-Classes: true

// 4. 使用
java -javaagent:/path/myagent.jar=args -jar app.jar     // 启动时加载
// 或运行时 attach（Arthas、JProfiler、APM 都用这种）
VirtualMachine vm = VirtualMachine.attach(pid);
vm.loadAgent("/path/myagent.jar");
vm.detach();
```

**字节码增强的典型应用：**

| 应用 | 工具 | 说明 |
| --- | --- | --- |
| **AOP** | CGLIB / Byte Buddy | Spring AOP 的代理生成 |
| **APM 链路追踪** | Java Agent + Byte Buddy | SkyWalking、Pinpoint、Arms、Datadog（**无侵入**） |
| **代码覆盖率** | Java Agent + ASM | JaCoCo（在每个分支插入探针） |
| **热部署** | Instrumentation | JRebel、Spring Boot DevTools、Arthas `redefine` |
| **Mock 测试** | Byte Buddy | Mockito 动态生成 Mock 类 |
| **ORM 懒加载** | Javassist / Byte Buddy | Hibernate 的实体代理、MyBatis 的延迟加载 |
| **Lombok** | hack javac AST | 编译期生成 getter/setter（**不是标准 APT**） |
| **MapStruct** | 标准 APT | 编译期生成对象映射代码 |
| **性能诊断** | Arthas | `trace`、`watch`、`monitor` 命令动态增强方法 |

## 4. JIT 即时编译

### 4.1 解释执行 vs 编译执行

| | 解释器（Interpreter） | JIT 编译器 |
| --- | --- | --- |
| 工作方式 | 逐条把字节码翻译为机器码执行 | 把「热点代码」整体编译为本地机器码并缓存 |
| 启动速度 | **快**（无需编译） | 慢（编译耗时） |
| 执行速度 | 慢 | **快**（可达解释执行的 10~100 倍） |
| 内存 | 省 | 需要代码缓存（CodeCache） |

**HotSpot 的「混合模式（Mixed Mode）」：** 启动时用解释器（快速启动），运行中检测热点代码并 JIT 编译（提升峰值性能）。`java -version` 输出的 `mixed mode` 就是这个含义。

### 4.2 分层编译（Tiered Compilation）★★★★★

```
JDK 8+ 默认开启 -XX:+TieredCompilation，分 5 层（Level 0~4）：

Level 0：解释执行（Interpreter）
         ↓ 方法调用次数 / 循环回边次数达到阈值
Level 1：C1 简单编译（Simple）—— 无 profiling，用于确定不会被重编译的方法（如 getter）
Level 2：C1 有限 profiling（受限的计数器：方法调用 + 回边）
Level 3：C1 完整 profiling（★ 收集分支跳转、类型等运行时信息）
         ↓ profiling 数据成熟
Level 4：C2 深度优化编译（Server Compiler，基于 profiling 做激进优化）

典型路径：0 → 3 → 4（大部分方法）
特殊路径：0 → 1（简单方法，不需要 C2）
         0 → 2 → 3 → 4（C1 编译线程繁忙时跳过 Level 3）
```

| 编译器 | 别名 | 特点 |
| --- | --- | --- |
| **C1** | Client Compiler | 编译快，优化程度低（方法内联、简单的冗余消除） |
| **C2** | Server Compiler | 编译慢，优化激进（**逃逸分析、基于 profiling 的推测优化、循环展开**） |
| **Graal** | 实验性（JDK 10+ `-XX:+UnlockExperimentalVMOptions -XX:+UseJVMCICompiler`） | Java 编写的 JIT，可替换 C2，GraalVM 的基础 |

### 4.3 热点探测与优化

```java
// ─── 热点探测的两种方式 ───
// ① 基于采样的热点探测（Sample Based Hot Spot Detection）
//    周期性检查各线程的栈顶，出现频繁的方法就是热点
//    优点：简单；缺点：不精确（受线程阻塞影响），无法区分「调用频繁」和「循环频繁」
// ② ★ 基于计数器的热点探测（Counter Based Hot Spot Detection）—— HotSpot 采用
//    为每个方法建立两个计数器：
//      方法调用计数器（Invocation Counter）：统计方法被调用的次数
//      回边计数器（Back Edge Counter）：统计循环体执行的次数
//    两者之和超过阈值 → 触发 JIT 编译

// 阈值参数
-XX:CompileThreshold=10000         # 混合模式关闭时的编译阈值（Client=1500，Server=10000）
-XX:Tier3InvocationThreshold=200   # Level 3 的方法调用阈值
-XX:Tier4InvocationThreshold=5000  # Level 4 的方法调用阈值
-XX:-UseCounterDecay               # 关闭计数器衰减（默认开启：每 30 分钟未触发的计数器减半）

// ─── 回边计数器与 OSR（On-Stack Replacement，栈上替换）───
public void longLoop() {
    for (int i = 0; i < 1_000_000_000; i++) {      // 只调用 1 次，但循环 10 亿次
        sum += i;
    }
}
// 方法调用计数器只有 1，但回边计数器暴涨 → 触发编译
// ★ OSR：在循环执行过程中「替换」正在运行的栈帧为编译后的代码
//        （不需要等方法返回后重新调用）

// 查看 JIT 编译日志
-XX:+PrintCompilation            # 打印每次编译（方法名、层级、耗时）
// 输出示例：
// 1234  4  com.example.Service::process (56 bytes)   made not entrant
//   ↑时间戳 ↑层级                ↑方法名     ↑字节码大小  ↑状态

// ─── JIT 的核心优化手段 ───
// ① 方法内联（Method Inlining）★ 最重要的优化
public int calculate(int x) { return square(x) + 1; }
private int square(int x) { return x * x; }
// 内联后 → return x * x + 1;   （消除了方法调用开销 + 为后续优化打开空间）
-XX:MaxInlineSize=35             # 内联的最大字节码大小（热点方法）
-XX:FreqInlineSize=325           # 频繁调用的方法的内联阈值
-XX:+PrintInlining               # 打印内联决策（需 -XX:+UnlockDiagnosticVMOptions）

// ② 逃逸分析 + 标量替换 + 锁消除（见 [[后端/JVM/JVM概述与运行时数据区]] 3.4 节）
// ③ 基于 profiling 的推测优化（Speculative Optimization）
//    例如：invokevirtual 的调用点如果 99% 都是同一个类型 → 内联为直接调用（单态内联缓存）
//    如果推测失败 → ★ 去优化（Deoptimization），退回解释执行
-XX:+PrintCompilation 中会看到 "made not entrant" / "deoptimize"

// ④ 其他：公共子表达式消除、数组边界检查消除、循环展开、空值检查消除、强度削减
```

**去优化（Deoptimization）：**

```java
// JIT 的激进优化基于「运行时统计的假设」，假设失效时要「回退」
// 常见触发：
// 1. 单态调用点变成多态（原本只调用 Dog.bark()，现在也调用了 Cat.bark()）
// 2. 类型假设失效（原本都是 Integer，现在出现了 Long）
// 3. 未检查的异常首次被抛出
// 4. 类被重新定义（Instrumentation.redefineClasses）

// 去优化的代价：编译后的代码作废，退回解释执行，性能骤降
// 排查：-XX:+TraceDeoptimization（需 UnlockDiagnosticVMOptions）
```

## 5. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 以为静态变量在准备阶段就有值 | 读到 0 或 null | 准备阶段是零值，初始化阶段才赋真值 |
| 2 | `static final` 非编译期常量当常量用 | 值在准备阶段是 0 | 只有字面量/常量运算才是编译期常量 |
| 3 | 常量内联导致修改不生效 | 改了常量类未重新编译依赖方，值不变 | 全量重新编译，或改用方法返回 |
| 4 | `<clinit>` 中互相调用其他类 | **类初始化死锁** | 避免静态块中的复杂依赖 |
| 5 | 静态块抛异常 | `ExceptionInInitializerError`，之后访问抛 `NoClassDefFoundError` | 静态块中做好异常处理 |
| 6 | 以为 `Child.value` 会初始化 Child | 只初始化 Parent | JVM 规范：只初始化定义字段的类 |
| 7 | TCCL 未还原 | 后续任务用错 ClassLoader | try-finally 中还原 |
| 8 | 不同 ClassLoader 的同类强转 | `ClassCastException`（同名类无法转换） | 理解「类 = 全限定名 + ClassLoader」 |
| 9 | 自定义 `java.lang.*` 类 | `SecurityException: Prohibited package name` | 不要自定义核心包名 |
| 10 | 重写 `loadClass` 完全打破委派 | 核心类被篡改、安全问题 | 核心包（java./javax./sun.）仍委派给父 |
| 11 | 热部署后元空间 OOM | ClassLoader 泄漏 | 检查 ThreadLocal/JDBC/hook/Timer 持有 |
| 12 | 未设 `MaxMetaspaceSize` | 动态生成类耗尽物理内存 | 显式设置上限 |
| 13 | 大量 CGLIB/Groovy 动态生成类 | 元空间持续增长 | 开启缓存（`setUseCache(true)`）、增大 MetaspaceSize |
| 14 | JDK 8 升 JDK 17 反射失败 | `InaccessibleObjectException` | `--add-opens` 参数 |
| 15 | JDK 9+ 找不到 `rt.jar`/`tools.jar` | 构建脚本报错 | 模块已拆分，改用 `jlink`/`jdeps` |
| 16 | 可数循环导致 STW 变长 | GC 时间短但停顿长 | 循环索引改 `long`，或开安全点日志排查 |
| 17 | JIT 去优化导致性能抖动 | 优化后又变慢 | `-XX:+PrintCompilation` 观察，减少多态调用点 |
| 18 | 方法过大无法内联 | 性能不如拆分后 | 保持小方法（`MaxInlineSize=35` 字节码） |
| 19 | SPI 一次性实例化所有实现 | 启动慢、浪费资源 | 用 Dubbo SPI 或懒加载封装 |
| 20 | `defineClass` 重复定义同类 | `LinkageError: attempted duplicate class definition` | 先 `findLoadedClass` 检查 |

---

## 关联笔记

- 上一篇：[[后端/JVM/垃圾回收机制与收集器]]
- 下一篇：[[后端/JVM/JVM调优与线上问题排查]]
- 相关：[[后端/Java基础/反射与动态代理]]（动态代理与字节码生成）、[[后端/Java基础/泛型枚举与注解]]（类型擦除与 Signature 属性）
- 应用：[[后端/JavaWeb/Tomcat架构与部署]]（Tomcat 的类加载器架构）、[[后端/SpringBoot/自动配置原理]]（spring.factories SPI）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
