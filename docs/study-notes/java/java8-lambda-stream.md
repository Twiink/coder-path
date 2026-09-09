---
title: "Java8新特性-Lambda与Stream"
aliases:
  - "Lambda 表达式"
  - "Stream API"
  - "函数式编程"
tags:
  - "后端"
  - "java"
  - "笔记"
  - "面试"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/反射与动态代理]]"
  - "[[后端/Java基础/集合框架-List与Set]]"
  - "[[后端/Java基础/并发编程/异步编程-CompletableFuture]]"
  - "[[后端/Java基础/常用类与API]]"
created: 2026-09-06
updated: 2026-09-06
---

# Java 8+ 新特性：Lambda 与 Stream

## 1. JDK 8 为什么是里程碑

JDK 8（2014）是 Java 历史上最重要的版本之一，引入了函数式编程能力：

| 特性 | JEP | 价值 |
| --- | --- | --- |
| **Lambda 表达式** | — | 简化匿名内部类，支持函数式编程 |
| **函数式接口** | — | `@FunctionalInterface`，Lambda 的类型基础 |
| **方法引用** | — | Lambda 的简写形式 |
| **Stream API** | — | 集合的声明式处理（过滤、映射、聚合、并行） |
| **Optional** | — | 优雅处理 null |
| **新日期时间 API** | JSR-310 | 不可变、线程安全的 `java.time` |
| **接口 default/static 方法** | — | 接口演化不破坏实现类 |
| **CompletableFuture** | — | 强大的异步编程 API |
| **重复注解** | — | `@Repeatable` |
| **类型注解** | — | `TYPE_USE`，可标注任何类型使用处 |
| **Nashorn** | — | 新的 JavaScript 引擎（JDK 15 移除） |
| **元空间 Metaspace** | — | 替代永久代，减少 OOM |
| **并行数组排序** | — | `Arrays.parallelSort` |

**JDK 9~21 的重要特性（本笔记涉及的会标注版本）：**

| 版本 | 关键特性 |
| --- | --- |
| JDK 9 | 模块化 JPMS、`List.of()` 集合工厂、`Stream.iterate/generate` 增强、`takeWhile/dropWhile`、接口 private 方法、JShell |
| JDK 10 | `var` 局部变量类型推断、`List.copyOf()`、`Optional.orElseThrow()` 无参版 |
| JDK 11 (LTS) | `String.isBlank/strip/repeat/lines`、`Files.readString/writeString`、`Optional.isEmpty`、HTTP Client 正式版、单文件运行 |
| JDK 12 | `String.indent`、`switch` 表达式（预览）、`Collectors.teeing` |
| JDK 14 | `record`（预览）、`instanceof` 模式匹配（预览）、`NullPointerException` 详细信息、`Stream.toList()`（JDK 16） |
| JDK 15 | 文本块（正式）、密封类（预览）、隐藏类 |
| JDK 16 | `record` 正式、`Stream.toList()`、`instanceof` 模式匹配正式 |
| JDK 17 (LTS) | `sealed` 密封类正式、`switch` 模式匹配（预览）、强封装 JDK 内部 API |
| JDK 21 (LTS) | **虚拟线程**、Record 模式、`switch` 模式匹配正式、分代 ZGC、`SequencedCollection` |

## 2. Lambda 表达式 ★★★★★

### 2.1 什么是 Lambda

**Lambda 是「函数式接口实例」的简洁写法**，本质是把函数当作参数传递。

```java
// 传统写法：匿名内部类（12 行）
Runnable r1 = new Runnable() {
    @Override
    public void run() {
        System.out.println("Hello");
    }
};

// Lambda 写法（1 行）
Runnable r2 = () -> System.out.println("Hello");

// 排序对比
// 匿名类
list.sort(new Comparator<User>() {
    @Override
    public int compare(User a, User b) {
        return a.getAge() - b.getAge();
    }
});
// Lambda
list.sort((a, b) -> a.getAge() - b.getAge());
// 方法引用（更简洁）
list.sort(Comparator.comparingInt(User::getAge));
```

### 2.2 Lambda 语法

```java
// 完整语法：(参数列表) -> { 方法体 }
// 六个组成部分：参数类型、参数名、括号、箭头、方法体大括号、返回值

// ─── 参数部分 ───
() -> System.out.println("无参");                       // 无参数：必须有空括号
(int x) -> x * 2                                        // 显式类型（少用）
x -> x * 2                                              // ★ 单参数可省略类型和括号
(x, y) -> x + y                                         // 多参数必须加括号
(int x, int y) -> x + y                                 // 多参数显式类型
final int x -> x                                        // 参数可加 final

// ─── 方法体部分 ───
x -> x * 2                                              // ★ 单条表达式：省略 {} 和 return
x -> { return x * 2; }                                  // 完整写法
(a, b) -> {                                             // 多条语句必须加 {}
    int sum = a + b;
    System.out.println(sum);
    return sum;                                          // 有返回值必须显式 return
}
() -> { }                                               // void 方法体
x -> { throw new RuntimeException(); }                  // 抛异常也要 {}

// ─── 各种函数式接口的 Lambda ───
Runnable r = () -> System.out.println("run");
Callable<String> c = () -> "result";
Supplier<String> s = () -> "value";
Consumer<String> con = str -> System.out.println(str);
Function<String, Integer> f = str -> str.length();
Predicate<String> p = str -> str.isEmpty();
BiFunction<String, String, Integer> bf = (a, b) -> a.length() + b.length();
Comparator<User> cmp = (u1, u2) -> u1.getAge() - u2.getAge();

// 带受检异常的 Lambda（Callable 声明了 throws Exception）
Callable<String> task = () -> {
    return Files.readString(Paths.get("a.txt"));         // IOException 被 Callable 声明覆盖
};
// ⚠️ Runnable 不能抛受检异常
Runnable bad = () -> Files.readString(...);              // ❌ 编译错误：未处理的 IOException
Runnable ok = () -> {
    try { Files.readString(...); } catch (IOException e) { throw new RuntimeException(e); }
};
```

**语法省略规则总结：**

| 可省略项 | 条件 | 示例 |
| --- | --- | --- |
| 参数类型 | 编译器能推断（总是可以） | `(x, y) -> x + y` |
| 参数括号 | **只有一个参数**时 | `x -> x * 2` |
| 方法体大括号 | **只有一条语句**时 | `x -> x * 2` |
| `return` 关键字 | 省略大括号时（单表达式自动返回） | `x -> x * 2` |
| `return` | 有大括号时必须写 | `x -> &#123; return x * 2; &#125;` |

### 2.3 函数式接口 ★★★★★

**函数式接口（Functional Interface）= 有且仅有一个抽象方法的接口**，是 Lambda 的类型基础。

```java
@FunctionalInterface                    // 编译器检查是否为函数式接口（强烈建议加）
public interface MyFunction<T, R> {
    R apply(T t);                        // 唯一的抽象方法（SAM: Single Abstract Method）

    default void log() { }               // ✅ default 方法不限数量
    static MyFunction<String, Integer> identity() { return s -> s.length(); }  // ✅ static
    boolean equals(Object obj);          // ✅ Object 的 public 方法不算抽象方法
}
```

**`@FunctionalInterface` 的规则：**
1. 必须有且仅有一个**抽象方法**（不算 default、static、private、Object 的 public 方法）。
2. 加了注解后，编译器会检查，违反则报错。
3. 不加注解也可以是函数式接口（如 `Runnable` 本身没加）。

**JDK 内置的四大核心函数式接口（`java.util.function`，必背）★★★★★：**

| 接口 | 抽象方法 | 语义 | Lambda 示例 | 典型用途 |
| --- | --- | --- | --- | --- |
| **`Function&lt;T,R&gt;`** | `R apply(T t)` | 转换：T → R | `x -> x.toString()` | `Stream.map` |
| **`Consumer&lt;T&gt;`** | `void accept(T t)` | 消费：处理 T 无返回 | `x -> System.out.println(x)` | `Stream.forEach` |
| **`Supplier&lt;T&gt;`** | `T get()` | 供给：无参返回 T | `() -> new User()` | 懒加载、工厂、`orElseGet` |
| **`Predicate&lt;T&gt;`** | `boolean test(T t)` | 判断：T → boolean | `x -> x > 0` | `Stream.filter` |
| `UnaryOperator&lt;T&gt;` | `T apply(T t)` | Function 的特例（T → T） | `s -> s.trim()` | 同类型转换 |
| `BinaryOperator&lt;T&gt;` | `T apply(T t1, T t2)` | BiFunction 的特例 | `(a,b) -> a + b` | `reduce` |

**完整列表（43 个接口）：**

```java
// ─── 单参数版 ───
Function<T,R>       Consumer<T>       Supplier<T>       Predicate<T>

// ─── 双参数版（Bi）───
BiFunction<T,U,R>   BiConsumer<T,U>                     BiPredicate<T,U>

// ─── 三参数版 ───
TriFunction? ❌ JDK 没有三参数版（需要自己定义或用柯里化）

// ─── 基本类型特化版（避免装箱，性能优化）───
// int
IntFunction<R>      IntConsumer       IntSupplier       IntPredicate
ToIntFunction<T>    ToIntBiFunction<T,U>
IntUnaryOperator    IntBinaryOperator
// long
LongFunction<R>     LongConsumer      LongSupplier      LongPredicate
ToLongFunction<T>   ToLongBiFunction<T,U>
LongUnaryOperator   LongBinaryOperator
// double
DoubleFunction<R>   DoubleConsumer    DoubleSupplier    DoublePredicate
ToDoubleFunction<T> ToDoubleBiFunction<T,U>
DoubleUnaryOperator DoubleBinaryOperator

// ─── 类型转换专用 ───
IntToLongFunction   IntToDoubleFunction
LongToIntFunction   LongToDoubleFunction
DoubleToIntFunction DoubleToLongFunction
ToIntFunction<T>    ToLongFunction<T>   ToDoubleFunction<T>

// ─── 数组参数版 ───
ObjIntConsumer<T>   ObjLongConsumer<T>  ObjDoubleConsumer<T>

// ─── 基本类型 + 断言/消费 ───
IntPredicate        LongPredicate       DoublePredicate
```

**Function 的组合方法（default 方法，函数式编程的精髓）：**

```java
Function<String, Integer> strLen = String::length;
Function<Integer, String> intToStr = i -> "长度=" + i;

// andThen：先执行自己，再执行参数（f.andThen(g) = g(f(x))）
Function<String, String> f1 = strLen.andThen(intToStr);
f1.apply("hello");              // "长度=5"

// compose：先执行参数，再执行自己（f.compose(g) = f(g(x))）
Function<String, Integer> f2 = strLen.compose(s -> s + "!!!");
f2.apply("hi");                 // 5（"hi!!!" 的长度）

// identity：恒等函数（x -> x）
Function<String, String> id = Function.identity();
// 常用于 Collectors.toMap 的 value 映射：toMap(User::getId, Function.identity())

// Predicate 的组合
Predicate<Integer> positive = n -> n > 0;
Predicate<Integer> even = n -> n % 2 == 0;
positive.and(even).test(4);              // true
positive.or(even).test(-2);              // true
positive.negate().test(-1);              // true
Predicate.isEqual("abc").test("abc");    // true（用 equals 比较）

// Consumer 的组合
Consumer<String> print = System.out::println;
Consumer<String> upper = s -> print.accept(s.toUpperCase());
print.andThen(upper).accept("hello");    // hello 然后 HELLO

// Comparator 的组合（超实用）
Comparator<User> byAge = Comparator.comparingInt(User::getAge);
Comparator<User> byName = Comparator.comparing(User::getName);
byAge.reversed();                                    // 降序
byAge.thenComparing(byName);                          // 多字段排序
byAge.thenComparing(User::getName, Comparator.reverseOrder());
Comparator.nullsFirst(byAge);                         // null 排前面
Comparator.nullsLast(byAge);                          // null 排后面
Comparator.comparing(User::getDept).thenComparing(User::getAge).reversed();
```

### 2.4 Lambda 的变量捕获与限制

```java
// Lambda 可以访问外部变量，但必须是 final 或「事实上 final」（effectively final）
public void test() {
    int localVar = 10;                    // 事实上 final（后续未修改）
    final int finalVar = 20;
    String str = "abc";

    Runnable r = () -> {
        System.out.println(localVar);     // ✅ 捕获局部变量（副本）
        System.out.println(finalVar);     // ✅
        System.out.println(this.field);   // ✅ 访问实例字段（无限制！）
        System.out.println(str);          // ✅
    };

    // ❌ 捕获后被修改 → 编译错误
    int mutable = 10;
    // Runnable bad = () -> System.out.println(mutable);
    // mutable = 20;                       // 一旦修改，上面的 Lambda 就编译错误
    //   error: local variables referenced from a lambda expression must be final or effectively final

    // ❌ Lambda 内修改局部变量
    // Runnable bad2 = () -> { localVar = 30; };   // 编译错误
}

// ✅ 实例字段和静态字段无此限制（它们不在栈上）
class Demo {
    private int count = 0;
    private static int staticCount = 0;

    public void process(List<String> list) {
        list.forEach(s -> {
            count++;                       // ✅ 可以修改实例字段
            staticCount++;                 // ✅ 可以修改静态字段
        });
    }
}

// ✅ 需要在 Lambda 中「累积」局部变量值的替代方案
// 方案 1：用数组（引用不变，内容可变）
int[] counter = {0};
list.forEach(s -> counter[0]++);
System.out.println(counter[0]);

// 方案 2：AtomicInteger（并发安全）
AtomicInteger counter2 = new AtomicInteger(0);
list.forEach(s -> counter2.incrementAndGet());

// 方案 3：Stream 的聚合操作（★ 推荐，函数式思维）
int total = list.stream().mapToInt(String::length).sum();
long count = list.stream().filter(s -> s.length() > 3).count();
```

**【原理】为什么 Lambda 只能捕获 final 变量？**

- 局部变量存在**栈**中，方法结束后栈帧销毁。
- Lambda 可能被异步执行或存到堆中长期持有，此时原栈帧已不存在。
- 所以编译器把变量的**值拷贝**一份到 Lambda 中。
- 如果允许修改，就会出现「Lambda 里的副本」和「外部原变量」不一致的问题。
- Java 选择用 final 约束**从根源避免不一致**（而非像 C# 那样捕获引用）。

**Lambda 与匿名内部类的 this 差异（重要）：**

```java
public class ThisDemo {
    private String name = "外部类";

    public void test() {
        // 匿名内部类：有独立的作用域，this 指向自己
        Runnable r1 = new Runnable() {
            private String name = "匿名类";
            public void run() {
                System.out.println(this.name);            // "匿名类"
                System.out.println(ThisDemo.this.name);   // "外部类"（显式引用外部）
            }
        };

        // Lambda：没有新作用域，this 就是外部的 this
        Runnable r2 = () -> {
            System.out.println(this.name);                // "外部类"！
        };
    }
}
```

### 2.5 Lambda 的底层实现（invokedynamic）★★★★★

**Lambda 不像匿名内部类那样生成 `.class` 文件，而是用 `invokedynamic` 指令 + `LambdaMetafactory` 在运行时生成。**

```java
Runnable r = () -> System.out.println("hi");
```

```
// javap -c 的字节码
public static void main(java.lang.String[]);
  Code:
     0: invokedynamic #7,  0    // InvokeDynamic #0:run:()Ljava/lang/Runnable;
     5: astore_1
     ...

BootstrapMethods:
  0: #26 invokestatic java/lang/invoke/LambdaMetafactory.metafactory:
      (Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;
       Ljava/lang/invoke/MethodType;Ljava/lang/invoke/MethodType;
       Ljava/lang/invoke/MethodHandle;Ljava/lang/invoke/MethodType;)
      Ljava/lang/invoke/CallSite;
    Method arguments:
      #27 run:()V                                          // 接口方法签名
      #28 invokestatic Demo.lambda$main$0:()V              // ★ Lambda 体被编译成私有静态方法
      #27 run:()V

// Lambda 体实际生成为外部类的私有静态方法
private static void lambda$main$0() {
    System.out.println("hi");
}
```

**执行流程：**
1. 编译期：Lambda 体被提取为外部类的**私有静态方法** `lambda$main$0`。
2. 编译期：调用处生成 `invokedynamic` 指令 + BootstrapMethods 表。
3. 运行期：首次执行到 `invokedynamic` 时，调用 `LambdaMetafactory.metafactory()` **动态生成**一个实现 `Runnable` 的类（用 ASM，隐藏在 `jdk.internal.loader.ClassLoaders` 中）。
4. 生成的类通过 `MethodHandle` 调用 `lambda$main$0`。
5. **后续调用直接用缓存的 CallSite**（`ConstantCallSite`），性能接近直接调用。

**Lambda vs 匿名内部类的对比：**

| 对比 | 匿名内部类 | Lambda |
| --- | --- | --- |
| 编译产物 | 生成 `Outer$1.class` 文件 | **不生成 class 文件**，运行时动态生成 |
| 类数量 | 每个匿名类一个 | 不增加磁盘上的类 |
| Metaspace 占用 | 每个都占 | **共享，占用小** |
| this 指向 | 匿名类实例 | **外部类实例** |
| 对象创建 | 每次 new 一个新对象 | **无状态 Lambda 会被 JVM 缓存复用**（同一实例） |
| 性能 | 加载慢（要读 class 文件） | 首次慢（生成类），后续快 |
| 适用 | 多方法、有状态、需继承类 | 单方法接口的简洁实现 |

```java
// 无状态 Lambda 的实例复用（JVM 优化）
Runnable r1 = () -> System.out.println("x");
Runnable r2 = () -> System.out.println("x");
// 同一位置的 Lambda 通常返回同一个实例（ConstantCallSite 缓存）

// 有状态 Lambda（捕获变量）每次都是新实例
int i = 1;
Runnable r3 = () -> System.out.println(i);
int j = 2;
Runnable r4 = () -> System.out.println(j);
// r3 != r4
```

### 2.6 方法引用（Method Reference）★★★★★

**方法引用是 Lambda 的语法糖**，当 Lambda 体只是「调用一个已存在的方法」时可用。

```java
// 语法：类名或对象名 :: 方法名

// ─── 四种形式 ───

// 1. 静态方法引用：ClassName::staticMethod
Function<String, Integer> f1 = Integer::parseInt;        // s -> Integer.parseInt(s)
Supplier<Double> f2 = Math::random;                       // () -> Math.random()
Consumer<String> f3 = System.out::println;                // 实际是对象的实例方法引用
BiFunction<Double,Double,Double> f4 = Math::max;

// 2. 特定对象的实例方法引用：instance::method
String prefix = "LOG: ";
Function<String, String> f5 = prefix::concat;             // s -> prefix.concat(s)
User user = new User();
Supplier<String> f6 = user::getName;                      // () -> user.getName()

// 3. 任意对象的实例方法引用：ClassName::instanceMethod
//    ★ 第一个参数会成为方法调用者
Function<String, Integer> f7 = String::length;            // s -> s.length()
Function<String, String> f8 = String::trim;               // s -> s.trim()
BiFunction<String, String, Boolean> f9 = String::equals;  // (a, b) -> a.equals(b)
Consumer<String> f10 = System.out::println;               // s -> System.out.println(s)
Comparator<User> f11 = Comparator.comparing(User::getName);  // u -> u.getName()

// 4. 构造器引用：ClassName::new
Supplier<User> f12 = User::new;                            // () -> new User()
Function<String, User> f13 = User::new;                    // name -> new User(name)
BiFunction<String, Integer, User> f14 = User::new;         // (name, age) -> new User(name, age)
Function<Integer, User[]> f15 = User[]::new;               // size -> new User[size]（数组）
Function<Integer, int[]> f16 = int[]::new;                 // 基本类型数组
// Stream 收集为数组
User[] users = list.stream().toArray(User[]::new);

// 5. JDK 9+ 数组构造引用的简写
```

**方法引用的选择规则（编译器推断）：**

```java
// 编译器根据「函数式接口的抽象方法签名」匹配：
// 1. 参数个数和类型是否匹配
// 2. 返回类型是否兼容
// 3. 对 ClassName::instanceMethod 形式：第一个参数当作调用者

Function<String, Integer> a = String::length;
// 抽象方法：Integer apply(String s)
// 匹配：s.length() —— s 是第一个参数，作为调用者 ✅

BiPredicate<String, String> b = String::startsWith;
// 抽象方法：boolean test(String t, String u)
// 匹配：t.startsWith(u) —— t 是调用者，u 是参数 ✅

// ⚠️ 歧义示例
class Foo {
    static void bar(String s) { }
    void bar() { }                              // 重载
}
Runnable r = Foo::bar;                          // 匹配静态方法还是实例方法？
// Consumer<Foo> c = Foo::bar;                  // 匹配实例方法（Foo 作为调用者）
// 编译器根据目标函数式接口决定
```

**方法引用的实战应用：**

```java
// Stream 中的方法引用（最常见）
list.stream().map(User::getName).forEach(System.out::println);
list.stream().filter(Objects::nonNull).collect(Collectors.toList());
list.stream().sorted(Comparator.comparing(User::getAge));
list.stream().collect(Collectors.toMap(User::getId, Function.identity()));
list.stream().collect(Collectors.groupingBy(User::getDept));
list.stream().map(User::new).collect(Collectors.toList());
list.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
Optional.ofNullable(user).map(User::getAddress).map(Address::getCity).orElse("未知");

// 构造器引用用于类型转换
List<UserDTO> dtos = users.stream().map(UserDTO::new).collect(Collectors.toList());
// UserDTO 有 UserDTO(User user) 构造器

// 日志
log.info("处理完成：{}", list.stream().map(String::valueOf).collect(Collectors.joining(",")));
```

## 3. Stream API ★★★★★

### 3.1 Stream 是什么

**Stream 是「数据元素序列」的抽象，支持声明式的链式处理（过滤、映射、聚合），不是数据结构（不存储数据）。**

```java
// 传统命令式（告诉计算机「怎么做」）
List<String> result = new ArrayList<>();
for (User u : users) {
    if (u.getAge() >= 18) {                    // 过滤
        String name = u.getName().toUpperCase(); // 转换
        result.add(name);                        // 收集
    }
}
Collections.sort(result);

// Stream 声明式（告诉计算机「要什么」）
List<String> result2 = users.stream()
    .filter(u -> u.getAge() >= 18)             // 过滤
    .map(u -> u.getName().toUpperCase())       // 转换
    .sorted()                                   // 排序
    .collect(Collectors.toList());              // 收集
```

**Stream 的核心特性：**

| 特性 | 说明 |
| --- | --- |
| 不存储数据 | 只是数据源的「视图」，不修改原集合 |
| 不改变数据源 | 每个操作返回新的 Stream |
| **惰性求值** | 中间操作不执行，直到遇到终止操作 |
| **可消费一次** | 终止操作后 Stream 关闭，再用抛 `IllegalStateException` |
| 支持并行 | `parallelStream()` 一行代码变并行 |
| 可无限 | `Stream.iterate`、`Stream.generate`（配合 limit） |

### 3.2 Stream 的三段式结构

```
数据源 → [中间操作 0~N 个] → 终止操作
        （惰性，返回 Stream）    （触发执行，返回非 Stream）

users.stream()                       ← ① 创建 Stream（数据源）
     .filter(u -> u.getAge() > 18)   ← ② 中间操作（惰性）
     .map(User::getName)             ← ② 中间操作（惰性）
     .sorted()                       ← ② 中间操作（惰性，有状态）
     .limit(10)                      ← ② 中间操作（惰性，短路）
     .collect(Collectors.toList());  ← ③ 终止操作（触发全部执行）
```

### 3.3 创建 Stream 的 12 种方式

```java
// 1. 从集合创建（Collection 的默认方法）
Stream<User> s1 = list.stream();                    // 串行流
Stream<User> s2 = list.parallelStream();            // ★ 并行流（ForkJoinPool.commonPool）

// 2. 从数组创建
Stream<String> s3 = Arrays.stream(array);
Stream<String> s4 = Arrays.stream(array, 1, 5);     // 区间 [1,5)
IntStream s5 = Arrays.stream(intArray);              // 基本类型数组 → 特化流

// 3. Stream.of（可变参数）
Stream<String> s6 = Stream.of("a", "b", "c");
Stream<Integer> s7 = Stream.of(1, 2, 3);
Stream<Object> s8 = Stream.of(array);                // ⚠️ 数组作为单个元素！
Stream<String> s9 = Stream.of(array);                // String[] 会展开（泛型匹配）
Stream.empty();                                       // 空流

// 4. 基本类型特化流（避免装箱，性能高）
IntStream.range(1, 10);              // [1, 10)
IntStream.rangeClosed(1, 10);        // [1, 10]
IntStream.of(1, 2, 3);
LongStream.range(1, 100);
DoubleStream.of(1.1, 2.2);
IntStream.iterate(0, i -> i + 2).limit(10);         // 0,2,4,...18
IntStream.generate(() -> 1).limit(5);

// 5. 无限流（必须配合 limit）
Stream.iterate(1, n -> n * 2);                      // 1,2,4,8,16...
Stream.iterate(0, n -> n < 100, n -> n + 10);       // JDK 9+ 带条件版本
Stream.generate(Math::random);                      // 无限随机数
Stream.generate(() -> "x");
Stream.concat(stream1, stream2);                     // 合并两个流

// 6. 从文件创建（必须关闭！）
try (Stream<String> lines = Files.lines(path, StandardCharsets.UTF_8)) {
    long count = lines.filter(l -> l.contains("ERROR")).count();
}
Files.lines(path).forEach(System.out::println);      // ⚠️ 未关闭，泄漏文件句柄

// 7. 从其他源
"hello".chars();                                     // IntStream（字符码点）
"hello".codePoints();                                // IntStream（完整码点）
Pattern.compile(",").splitAsStream("a,b,c");         // 正则分割成流
new BufferedReader(reader).lines();                  // 流式读
BitSet.stream();                                      // JDK 8+
Optional.of("x").stream();                            // JDK 9+：Optional → Stream（0 或 1 个元素）

// 8. 从 Map（Map 不是 Collection，要用 entrySet）
map.entrySet().stream();
map.keySet().stream();
map.values().stream();
map.forEach((k, v) -> { });                           // Map 自己的 forEach

// 9. StreamSupport（自定义 Spliterator）
StreamSupport.stream(spliterator, false);
StreamSupport.stream(collection.spliterator(), true);  // 并行

// 10. JDK 9+ takeWhile / dropWhile
Stream.of(1, 2, 3, 10, 1, 2).takeWhile(n -> n < 5);   // [1,2,3]（遇到不满足就停）
Stream.of(1, 2, 3, 10, 1, 2).dropWhile(n -> n < 5);   // [10,1,2]（丢弃直到满足）

// 11. JDK 9+ ofNullable
Stream.ofNullable(null);                              // 空流（不抛 NPE）
Stream.ofNullable("x");                               // 单元素流

// 12. 从 Stream.Builder
Stream.Builder<String> builder = Stream.builder();
builder.add("a").add("b");
Stream<String> built = builder.build();
```

> 【坑】**Stream 只能消费一次**：
> ```java
> Stream&lt;String&gt; s = list.stream().filter(x -> x.length() > 1);
> long c1 = s.count();
> long c2 = s.count();     // ❌ IllegalStateException: stream has already been operated upon or closed
> // 解决：重新创建流
> long c2 = list.stream().filter(x -> x.length() > 1).count();
> ```

### 3.4 中间操作（Intermediate Operations）

**特点：返回 Stream，惰性求值，可链式。**

#### 无状态操作（每个元素独立处理）

```java
// filter：过滤
stream.filter(u -> u.getAge() >= 18)
stream.filter(Objects::nonNull)                       // 去除 null
stream.filter(((Predicate<String>) s -> s.length() > 3)
              .and(s -> s.startsWith("a")))           // 组合条件
stream.filter(u -> u.getStatus() == Status.ACTIVE)

// map：一对一转换（类型可不同）
stream.map(User::getName)                              // User → String
stream.map(u -> u.getAge() * 2)                        // 数值转换
stream.map(String::toUpperCase)
stream.map(u -> new UserVO(u))                         // 实体转 VO
stream.map(Function.identity())                        // 原样

// mapToInt / mapToLong / mapToDouble：转换为特化流（避免装箱）
stream.mapToInt(User::getAge)                          // Stream<User> → IntStream
stream.mapToDouble(Order::getAmount)
stream.mapToInt(String::length).sum()

// flatMap：一对多转换后「拍平」（解决嵌套集合）★★★
List<List<Integer>> nested = List.of(List.of(1,2), List.of(3,4));
nested.stream().flatMap(List::stream).collect(toList());    // [1,2,3,4]

// 实战：一个订单有多个商品，收集所有商品名
orders.stream()
      .flatMap(o -> o.getItems().stream())             // Stream<Order> → Stream<OrderItem>
      .map(OrderItem::getProductName)
      .distinct()
      .collect(toList());

// 实战：分割字符串后拍平
List<String> sentences = List.of("hello world", "java stream");
sentences.stream()
         .flatMap(s -> Arrays.stream(s.split(" ")))     // → 单词流
         .collect(toList());                            // [hello, world, java, stream]

// flatMapToInt / flatMapToDouble / flatMapToObj
stream.flatMapToInt(u -> IntStream.of(u.getAge(), u.getScore()));

// peek：偷看（调试用，不改变流）★★★
stream.map(User::getName)
      .peek(name -> System.out.println("映射后：" + name))   // 调试利器
      .filter(n -> n.length() > 3)
      .peek(n -> System.out.println("过滤后：" + n))
      .collect(toList());

// ⚠️ peek 的坑：如果流是「短路」的（如 findFirst、limit），peek 可能不执行
Stream.of(1,2,3).peek(System.out::println).findFirst();  // 只打印 1

// mapMulti（JDK 16+，flatMap 的高性能替代，避免创建子流）
stream.<String>mapMulti((obj, consumer) -> {
    if (obj instanceof String s) consumer.accept(s);
});
```

#### 有状态操作（需要看到全部/部分元素）

```java
// distinct：去重（依赖 equals/hashCode）
stream.distinct().collect(toList());
// 按某字段去重（需自己实现）
users.stream()
     .filter(distinctByKey(User::getDept))              // 自定义去重谓词
     .collect(toList());

public static <T> Predicate<T> distinctByKey(Function<? super T, ?> keyExtractor) {
    Set<Object> seen = ConcurrentHashMap.newKeySet();
    return t -> seen.add(keyExtractor.apply(t));         // add 返回 false 说明已存在
}

// sorted：排序
stream.sorted()                                          // 自然排序（需 Comparable）
stream.sorted(Comparator.comparing(User::getAge))        // 自定义
stream.sorted(Comparator.comparing(User::getAge).reversed())   // 降序
stream.sorted(Comparator.comparing(User::getDept)
                       .thenComparing(User::getAge))     // 多字段
stream.sorted(Comparator.nullsLast(Comparator.comparing(User::getName)))  // null 排后

// limit / skip：截取
stream.limit(10)                                         // 前 10 个（短路优化）
stream.skip(5)                                           // 跳过前 5 个
stream.skip(10).limit(10)                                // 分页：第 2 页 10 条

// ⚠️ 顺序问题：limit 在 sorted 之前 vs 之后
stream.limit(10).sorted(...)     // 先取 10 个再排序（错误的分页）
stream.sorted(...).limit(10)     // 先排序再取 10 个（正确的 Top 10）★
```

### 3.5 终止操作（Terminal Operations）★★★★★

**特点：触发整个流水线执行，返回非 Stream 结果，执行后流关闭。**

#### 匹配与查找（短路操作）

```java
// anyMatch / allMatch / noneMatch
boolean any = stream.anyMatch(u -> u.getAge() > 60);       // 任一满足（找到即返回）
boolean all = stream.allMatch(u -> u.getAge() >= 18);      // 全部满足
boolean none = stream.noneMatch(u -> u.getAge() < 0);      // 全不满足
// 空流的 allMatch 返回 true，anyMatch/noneMatch 返回 false/true（注意语义）

// findFirst / findAny
Optional<User> first = stream.findFirst();                  // 第一个（串行流常用）
Optional<User> any = stream.findAny();                      // 任意一个（★ 并行流性能好）
User u = stream.findFirst().orElseThrow(() -> new BusinessException("用户不存在"));
User u2 = stream.findFirst().orElse(defaultUser);
User u3 = stream.findFirst().orElseGet(User::new);          // 惰性创建默认值
stream.findFirst().ifPresent(System.out::println);
stream.findFirst().ifPresentOrElse(                          // JDK 9+
    u -> System.out.println(u),
    () -> System.out.println("没有"));

// ⚠️ findFirst 与 findAny 在串行流上结果通常相同，但：
// - findFirst 保证顺序，可能限制并行优化
// - findAny 在并行流中可以「谁先算完返回谁」，性能更好
// - 对无序流（如 HashSet.stream()）findFirst 也只是「第一个遇到的」

// max / min
Optional<User> oldest = stream.max(Comparator.comparingInt(User::getAge));
Optional<User> youngest = stream.min(Comparator.comparingInt(User::getAge));
Optional<Integer> max = stream.map(User::getAge).max(Integer::compareTo);
int maxAge = stream.mapToInt(User::getAge).max().orElse(0);   // 特化流更方便

// count
long count = stream.count();
long adultCount = stream.filter(u -> u.getAge() >= 18).count();
```

#### 遍历与消费

```java
// forEach：无序遍历（并行流时顺序不保证）
stream.forEach(System.out::println);
stream.forEach(u -> System.out.println(u.getName()));

// forEachOrdered：★ 并行流中也按遇到顺序执行
stream.parallel().forEachOrdered(System.out::println);

// reduce：归约（把流压缩成一个值）★★★★★
// 三种签名
// 1. reduce(BinaryOperator) → Optional
Optional<Integer> sum = stream.map(User::getAge).reduce((a, b) -> a + b);
Optional<String> concat = stream.reduce((a, b) -> a + "," + b);

// 2. reduce(identity, BinaryOperator) → T（有初始值，非 Optional）
Integer total = stream.map(User::getAge).reduce(0, Integer::sum);      // 求和
String all = stream.map(User::getName).reduce("", (a, b) -> a + b);    // 拼接
Integer max = stream.map(User::getAge).reduce(0, Integer::max);
BigDecimal amount = orders.stream()
    .map(Order::getAmount)
    .reduce(BigDecimal.ZERO, BigDecimal::add);                          // 金额求和

// 3. reduce(identity, BiFunction, BinaryOperator) → 并行友好（三个参数：初始值、累加器、组合器）
Integer totalParallel = stream.parallel()
    .reduce(0,                                    // identity
            (subtotal, u) -> subtotal + u.getAge(),   // accumulator（元素累加到部分结果）
            Integer::sum);                            // combiner（合并各线程的部分结果）

// reduce 的执行过程
Stream.of(1, 2, 3, 4).reduce(0, Integer::sum);
// 步骤：0+1=1 → 1+2=3 → 3+3=6 → 6+4=10
// identity 必须满足：combiner.apply(identity, x) == x（否则并行结果错误）

// collect：收集（最强大的终止操作，见下一节）
List<User> list = stream.collect(Collectors.toList());

// toArray
Object[] arr = stream.toArray();
User[] users = stream.toArray(User[]::new);           // ★ 指定类型
String[] strs = stream.toArray(String[]::new);

// iterator / spliterator
Iterator<User> it = stream.iterator();
```

### 3.6 Collectors 收集器大全 ★★★★★

**`Collectors` 是 Stream 收集操作的核心工具类，提供了 30+ 种收集方式。**

```java
import java.util.stream.Collectors;
import static java.util.stream.Collectors.*;

// ─── 1. 收集为集合 ───
List<User> list = stream.collect(toList());                 // ArrayList
Set<User> set = stream.collect(toSet());                    // HashSet（无序去重）
Collection<User> coll = stream.collect(toCollection(ArrayList::new));     // 指定集合类型
LinkedList<User> linked = stream.collect(toCollection(LinkedList::new));
TreeSet<User> tree = stream.collect(toCollection(TreeSet::new));          // 排序去重
TreeSet<User> tree2 = stream.collect(collectingAndThen(toList(),
        l -> new TreeSet<>(l)));                            // 组合收集器
List<User> concurrent = stream.collect(toCollection(CopyOnWriteArrayList::new));

// JDK 10+ 不可变集合
List<User> unmodifiable = stream.collect(toUnmodifiableList());
Set<User> unmodSet = stream.collect(toUnmodifiableSet());
Map<K,V> unmodMap = stream.collect(toUnmodifiableMap(User::getId, u -> u));

// JDK 16+ 最简洁的 toList（返回不可变 List！注意与 Collectors.toList 的区别）
List<User> list2 = stream.toList();                          // 不可变，允许 null
// Collectors.toList() 返回可变 ArrayList，允许 null
// toUnmodifiableList() 不可变，不允许 null

// ─── 2. 收集为 Map ───
// toMap(keyMapper, valueMapper)
Map<Long, User> byId = stream.collect(toMap(User::getId, u -> u));
Map<Long, User> byId2 = stream.collect(toMap(User::getId, Function.identity()));  // 同上
Map<Long, String> idToName = stream.collect(toMap(User::getId, User::getName));

// ★ key 冲突时必须提供 mergeFunction，否则抛 IllegalStateException: Duplicate key
Map<String, User> byName = stream.collect(toMap(
        User::getName,
        Function.identity(),
        (existing, replacement) -> replacement));            // 保留后者
        // (existing, replacement) -> existing              // 保留前者
        // (a, b) -> a.getAge() > b.getAge() ? a : b        // 保留年龄大的

// 指定 Map 类型（★ 排序后必须用 LinkedHashMap/TreeMap 保序）
Map<Long, User> sorted = stream
    .sorted(Comparator.comparing(User::getAge))
    .collect(toMap(User::getId, Function.identity(), (a,b) -> a, LinkedHashMap::new));
TreeMap<Long, User> treeMap = stream.collect(toMap(User::getId, u -> u,
        (a,b) -> a, TreeMap::new));
ConcurrentHashMap<Long, User> chm = stream.collect(toMap(User::getId, u -> u,
        (a,b) -> a, ConcurrentHashMap::new));

// ⚠️ toMap 的 value 为 null 会抛 NPE（JDK 8 的 HashMap.merge 限制）
stream.collect(toMap(User::getId, User::getNickname));   // nickname 为 null → NPE
// 解决：过滤 null，或手写收集
stream.filter(u -> u.getNickname() != null).collect(toMap(User::getId, User::getNickname));

// ─── 3. 分组 groupingBy ★★★★★（最常用）───
// 单级分组
Map<String, List<User>> byDept = stream.collect(groupingBy(User::getDept));
Map<Integer, List<User>> byAge = stream.collect(groupingBy(User::getAge));
Map<Status, List<Order>> byStatus = orders.stream().collect(groupingBy(Order::getStatus));

// 指定分组后的集合类型
Map<String, Set<User>> byDeptSet = stream.collect(groupingBy(User::getDept, toSet()));
Map<String, LinkedList<User>> byDeptList = stream.collect(
        groupingBy(User::getDept, toCollection(LinkedList::new)));
TreeMap<String, List<User>> sortedGroups = stream.collect(
        groupingBy(User::getDept, TreeMap::new, toList()));     // ★ 三参数：分组Map类型

// 分组后做统计（downstream collector）
Map<String, Long> countByDept = stream.collect(groupingBy(User::getDept, counting()));
Map<String, Integer> sumAgeByDept = stream.collect(
        groupingBy(User::getDept, summingInt(User::getAge)));
Map<String, Double> avgAgeByDept = stream.collect(
        groupingBy(User::getDept, averagingInt(User::getAge)));
Map<String, Optional<User>> oldestByDept = stream.collect(
        groupingBy(User::getDept, maxBy(Comparator.comparingInt(User::getAge))));
Map<String, User> oldestByDept2 = stream.collect(
        groupingBy(User::getDept, collectingAndThen(
            maxBy(Comparator.comparingInt(User::getAge)), Optional::get)));   // 去掉 Optional

// 分组后提取字段（mapping）
Map<String, List<String>> namesByDept = stream.collect(
        groupingBy(User::getDept, mapping(User::getName, toList())));
Map<String, String> namesJoinedByDept = stream.collect(
        groupingBy(User::getDept, mapping(User::getName, joining(", "))));
Map<String, Set<Long>> idsByDept = stream.collect(
        groupingBy(User::getDept, mapping(User::getId, toSet())));

// 分组后归约（reducing）
Map<String, Integer> totalAgeByDept = stream.collect(
        groupingBy(User::getDept, reducing(0, User::getAge, Integer::sum)));
Map<String, BigDecimal> amountByType = orders.stream().collect(
        groupingBy(Order::getType, reducing(BigDecimal.ZERO, Order::getAmount, BigDecimal::add)));

// ★ 多级分组（嵌套 groupingBy）
Map<String, Map<Integer, List<User>>> byDeptAndAge = stream.collect(
        groupingBy(User::getDept, groupingBy(User::getAge)));
Map<String, Map<Integer, Long>> countByDeptAndAge = stream.collect(
        groupingBy(User::getDept, groupingBy(User::getAge, counting())));

// ★ 按条件分组（分类 partitioningBy，只有 true/false 两组）
Map<Boolean, List<User>> partition = stream.collect(
        partitioningBy(u -> u.getAge() >= 18));
partition.get(true);     // 成年
partition.get(false);    // 未成年（★ 保证两个 key 都存在，即使为空列表）
Map<Boolean, Long> partitionCount = stream.collect(
        partitioningBy(u -> u.getAge() >= 18, counting()));

// 分组 + 分区组合
Map<String, Map<Boolean, List<User>>> byDeptAndAdult = stream.collect(
        groupingBy(User::getDept, partitioningBy(u -> u.getAge() >= 18)));

// 自定义分类器（多级条件）
Map<String, List<User>> byAgeGroup = stream.collect(groupingBy(u -> {
    int age = u.getAge();
    if (age < 18) return "未成年";
    if (age < 40) return "青年";
    if (age < 60) return "中年";
    return "老年";
}));

// ─── 4. 字符串拼接 joining ───
String names = stream.map(User::getName).collect(joining());              // "TomJerryBob"
String names2 = stream.map(User::getName).collect(joining(", "));         // "Tom, Jerry, Bob"
String names3 = stream.map(User::getName).collect(joining(", ", "[", "]")); // "[Tom, Jerry, Bob]"
String sql = ids.stream().map(String::valueOf).collect(joining(","));     // "1,2,3"（拼 SQL IN）
String sqlIn = ids.stream().map(id -> "'" + id + "'").collect(joining(",", "(", ")"));

// ─── 5. 统计 summarizing ───
IntSummaryStatistics stats = stream.collect(summarizingInt(User::getAge));
stats.getCount();      // 数量
stats.getSum();        // 总和
stats.getMin();        // 最小
stats.getMax();        // 最大
stats.getAverage();    // 平均
// 一次性拿到所有统计值，避免多次遍历流

DoubleSummaryStatistics dStats = stream.collect(summarizingDouble(Order::getAmount));
LongSummaryStatistics lStats = stream.collect(summarizingLong(User::getId));

// 单独的聚合收集器
int sum = stream.collect(summingInt(User::getAge));
double avg = stream.collect(averagingInt(User::getAge));
long count = stream.collect(counting());
Optional<User> max = stream.collect(maxBy(Comparator.comparingInt(User::getAge)));
Optional<User> min = stream.collect(minBy(Comparator.comparingInt(User::getAge)));

// ─── 6. 其他实用收集器 ───
// counting、reducing、collectingAndThen（收集后再处理）
List<User> unmodifiableList = stream.collect(collectingAndThen(toList(),
        Collections::unmodifiableList));
int size = stream.collect(collectingAndThen(toList(), List::size));

// teeing（JDK 12+）：一个流同时用两个收集器，然后合并结果
var result = stream.collect(teeing(
        maxBy(Comparator.comparingInt(User::getAge)),      // 收集器 1
        minBy(Comparator.comparingInt(User::getAge)),      // 收集器 2
        (max, min) -> Map.of("max", max.get(), "min", min.get())));   // 合并函数

// toConcurrentMap（并行流友好）
Map<Long, User> concurrentMap = stream.parallel().collect(toConcurrentMap(User::getId, u -> u));

// flatMapping（JDK 9+）：分组后拍平
Map<String, Set<String>> skillsByDept = stream.collect(
        groupingBy(User::getDept, flatMapping(u -> u.getSkills().stream(), toSet())));

// filtering（JDK 9+）：分组内过滤（与 groupingBy 的 filter 不同，保留所有分组）
Map<String, List<User>> adultsByDept = stream.collect(
        groupingBy(User::getDept, filtering(u -> u.getAge() >= 18, toList())));
// 即使某部门没有成年人，该部门 key 仍存在（空列表）
```

### 3.7 Optional 详解 ★★★★★

**Optional 是一个「容器」，用于优雅地表达「可能没有值」，替代裸 null 和层层判空。**

```java
import java.util.Optional;

// ─── 创建 Optional ───
Optional<User> opt1 = Optional.of(user);              // 包装非 null 对象，传 null 抛 NPE
Optional<User> opt2 = Optional.ofNullable(user);      // ★ 可为 null（null 时返回 empty）
Optional<User> opt3 = Optional.empty();               // 空 Optional

// ⚠️ Optional.of(null) → NullPointerException！不确定时用 ofNullable

// ─── 获取值（4 种方式）───
User u1 = opt.get();                                   // 为空抛 NoSuchElementException ❌ 不推荐
User u2 = opt.orElse(defaultUser);                     // 为空返回默认值（★ 默认值总是被创建）
User u3 = opt.orElseGet(() -> queryDefaultUser());     // ★ 为空才执行 Supplier（惰性，推荐）
User u4 = opt.orElseThrow();                           // 为空抛 NoSuchElementException（JDK 10+）
User u5 = opt.orElseThrow(() -> new BusinessException("用户不存在"));   // 自定义异常（★ 推荐）

// orElse vs orElseGet 的区别（重要）
opt.orElse(expensiveQuery());        // ⚠️ expensiveQuery() 总会被执行（即使有值）！
opt.orElseGet(() -> expensiveQuery());// ✅ 只在为空时执行

// JDK 9+ or：链式备选
opt.or(() -> Optional.ofNullable(queryFromCache()))
   .or(() -> Optional.ofNullable(queryFromDb()))
   .orElseThrow();

// ─── 判断与消费 ───
opt.isPresent();                                      // 是否有值（JDK 8）
opt.isEmpty();                                        // 是否为空（JDK 11+）
opt.ifPresent(u -> System.out.println(u.getName()));   // 有值才执行
opt.ifPresentOrElse(                                   // JDK 9+
    u -> System.out.println(u.getName()),
    () -> System.out.println("无用户"));

// ─── 链式转换（Optional 的最大价值：安全导航）★★★★★ ───
// ❌ 传统写法：层层判空（嵌套地狱）
String city = "未知";
if (user != null) {
    Address addr = user.getAddress();
    if (addr != null) {
        String c = addr.getCity();
        if (c != null && !c.isEmpty()) {
            city = c;
        }
    }
}

// ✅ Optional 链式（一行）
String city2 = Optional.ofNullable(user)
    .map(User::getAddress)                             // 有值才继续，自动处理 null
    .map(Address::getCity)
    .filter(c -> !c.isEmpty())
    .orElse("未知");

// Optional 的 API
opt.map(User::getName);                                // 转换（结果为 null 则返回 empty）
opt.flatMap(u -> Optional.ofNullable(u.getAddress())); // 转换（函数返回 Optional，避免嵌套）
opt.filter(u -> u.getAge() >= 18);                     // 过滤（不满足返回 empty）
opt.stream();                                          // JDK 9+：转 Stream（0 或 1 个元素）
opt.hashCode(); opt.equals(other); opt.toString();

// flatMap vs map（当函数本身返回 Optional 时）
Optional<Optional<Address>> bad = opt.map(u -> Optional.ofNullable(u.getAddress()));   // 嵌套
Optional<Address> good = opt.flatMap(u -> Optional.ofNullable(u.getAddress()));        // 拍平

// ─── Stream + Optional 的优雅组合 ───
// JDK 9+：过滤掉空的 Optional
List<Optional<User>> opts = ...;
List<User> users = opts.stream()
    .flatMap(Optional::stream)                          // ★ 空的被过滤，有值的解包
    .collect(toList());

// JDK 8 版本
List<User> users8 = opts.stream()
    .filter(Optional::isPresent)
    .map(Optional::get)
    .collect(toList());

// Optional 作为返回值处理数据库查询
public Optional<User> findById(Long id) {
    return Optional.ofNullable(userMapper.selectById(id));
}
// 调用方
User user = findById(1L).orElseThrow(() -> new BusinessException(ResultCode.USER_NOT_FOUND));
findById(1L).ifPresent(u -> log.info("找到用户 {}", u.getName()));
String name = findById(1L).map(User::getName).orElse("匿名");
```

**Optional 的正确用法与反模式：**

| ✅ 正确用法 | ❌ 反模式 |
| --- | --- |
| 作为**方法返回值**，明确表达「可能无结果」 | 作为**字段**（不实现 Serializable，且增加对象大小） |
| 链式 `map/filter/orElse` 处理 | `opt.get()` 不判空（等于 NPE 换了个异常） |
| `orElseThrow` 抛业务异常 | `if (opt.isPresent()) opt.get()`（等于判空，啰嗦） |
| 集合查询返回 `Optional&lt;T&gt;` | `Optional<List&lt;T&gt;>`（应返回空 List） |
| `orElseGet` 惰性创建默认值 | `orElse(expensiveCall())`（总是执行昂贵调用） |
| — | 作为方法参数（调用方要包装，啰嗦；用重载或 `@Nullable`） |
| — | `Optional<基本类型>`（用 `OptionalInt/Long/Double`） |

```java
// ❌ 反模式示例
// 1. 作为字段
class User {
    private Optional<String> nickname;    // ❌ 不能序列化，占 16 字节额外开销
    private String nickname;               // ✅
}

// 2. isPresent + get（等于判空）
if (opt.isPresent()) { use(opt.get()); }   // ❌
opt.ifPresent(this::use);                   // ✅

// 3. Optional 集合（应该返回空集合）
Optional<List<User>> findUsers();          // ❌
List<User> findUsers();                     // ✅ 返回 emptyList

// 4. 基本类型
Optional<Integer> count;                    // ❌ 装箱
OptionalInt count;                          // ✅
count.orElse(0); count.getAsInt();

// 5. 参数
void process(Optional<String> name);        // ❌ 调用方要 Optional.of(...)，啰嗦
void process(@Nullable String name);        // ✅ 或提供重载
```

> Brian Goetz（Optional 设计者）明确说明：**Optional 设计目标是「作为返回值，明确表示可能没有结果」**，不是用来替代所有 null 检查的。

### 3.8 惰性求值与短路 ★★★★★

```java
// 惰性求值：中间操作不会立即执行，直到遇到终止操作
Stream<String> s = Stream.of("a", "bb", "ccc")
    .filter(x -> {
        System.out.println("filter: " + x);
        return x.length() > 1;
    })
    .map(x -> {
        System.out.println("map: " + x);
        return x.toUpperCase();
    });
System.out.println("---- 流水线已构建，但上面没有任何输出 ----");

List<String> result = s.collect(toList());
// 输出（★ 逐元素纵向执行，而非逐阶段横向执行）：
// ---- 流水线已构建，但上面没有任何输出 ----
// filter: a
// filter: bb
// map: bb
// filter: ccc
// map: ccc
// 注意：不是「先 filter 全部，再 map 全部」，而是「a 走完 filter → bb 走完 filter+map → ...」
// 这种「循环合并（loop fusion）」减少遍历次数，是 Stream 性能的关键
```

**短路操作（Short-circuiting）：**

| 操作 | 短路行为 |
| --- | --- |
| `findFirst()` / `findAny()` | 找到第一个就停止 |
| `anyMatch()` | 有一个匹配就停止 |
| `allMatch()` / `noneMatch()` | 有一个不满足就停止 |
| `limit(n)` | 取够 n 个就停止（**能让无限流可用**） |

```java
// 短路让无限流成为可能
Stream.iterate(1, i -> i + 1)                        // 无限流
      .filter(i -> i % 100 == 0)
      .limit(5)                                       // ★ 短路：取到 5 个就停止
      .forEach(System.out::println);                  // 100, 200, 300, 400, 500

// anyMatch 短路（不会遍历全部）
boolean hasAdult = users.stream()
    .peek(u -> System.out.println("检查：" + u.getName()))
    .anyMatch(u -> u.getAge() >= 18);                  // 找到第一个成年人就停

// limit 的优化：sorted().limit(n) 用「堆」而非全排序（部分 JDK 实现）
Stream.of(5,3,8,1,9).sorted().limit(3).forEach(System.out::println);   // 1,3,5
```

**并行流的原理与陷阱 ★★★★★：**

```java
// 并行流：使用 ForkJoinPool.commonPool()，默认线程数 = CPU 核心数 - 1
List<Integer> result = list.parallelStream()
    .filter(x -> x > 0)
    .map(x -> x * 2)
    .collect(toList());

// 查看默认并行度
ForkJoinPool.getCommonPoolParallelism();      // 通常 = Runtime.availableProcessors() - 1
System.setProperty("java.util.concurrent.ForkJoinPool.common.parallelism", "8");

// 指定自定义线程池（避免全局池争抢）
ForkJoinPool customPool = new ForkJoinPool(4);
List<Integer> result2 = customPool.submit(() ->
    list.parallelStream().map(x -> x * 2).collect(toList())
).get();

// ─── 并行流的陷阱 ───

// 陷阱 1：有状态操作导致结果错误
List<Integer> unsafe = new ArrayList<>();          // ❌ 非线程安全容器
list.parallelStream().forEach(unsafe::add);         // 可能丢数据/抛异常
List<Integer> safe = list.parallelStream().collect(toList());   // ✅ collect 是线程安全的

// 陷阱 2：顺序不保证
list.parallelStream().forEach(System.out::println);          // 乱序
list.parallelStream().forEachOrdered(System.out::println);   // ✅ 保证顺序（损失部分并行性能）

// 陷阱 3：小数据量并行反而更慢（任务拆分和线程调度的开销 > 计算收益）
IntStream.range(0, 100).parallel().sum();          // 比串行慢！
// 经验法则：元素数 > 10000 且每个元素处理耗时 > 100μs 时才考虑并行

// 陷阱 4：IO 密集型任务不适合并行流（commonPool 线程数少，会阻塞其他并行任务）
list.parallelStream().forEach(this::callRemoteApi);  // ❌ 阻塞 commonPool
// ✅ 用自定义线程池或 CompletableFuture

// 陷阱 5：ThreadLocal 失效（并行流的任务在不同线程执行）
// 如 Spring 的 RequestContextHolder、SecurityContext、事务上下文都会丢失！
list.parallelStream().forEach(x -> {
    // ❌ RequestContextHolder.getRequestAttributes() 返回 null
    // ❌ @Transactional 不生效
    // ❌ MDC 日志追踪 ID 丢失
});

// 陷阱 6：Spliterator 拆分效率影响性能
// ArrayList、数组：拆分效率高（可精确二分）✅
// LinkedList：拆分效率极低（要遍历到中点）❌
// HashSet、TreeSet：拆分效率一般
// BufferedReader.lines()：无法有效拆分 ❌

// 陷阱 7：共享可变变量
int[] sum = {0};
list.parallelStream().forEach(x -> sum[0] += x);    // ❌ 竞态条件，结果错误
int correct = list.parallelStream().mapToInt(Integer::intValue).sum();   // ✅
```

**何时使用并行流（决策清单）：**

| 条件 | 说明 |
| --- | --- |
| ✅ 数据量大（> 10000） | 拆分/合并的固定开销能被摊薄 |
| ✅ 每个元素处理耗时（CPU 密集） | 计算 > 100μs/元素 |
| ✅ 数据源易拆分 | ArrayList、数组、IntStream.range |
| ✅ 无共享可变状态 | 无副作用，线程安全 |
| ✅ 不依赖 ThreadLocal/上下文 | 不需要事务、请求上下文、安全上下文 |
| ✅ 顺序不重要或用 forEachOrdered | — |
| ❌ IO 密集 | 用自定义线程池 + CompletableFuture |
| ❌ 小数据量 | 串行更快 |
| ❌ LinkedList / 无限流 | 拆分效率低 |

### 3.9 Stream 实战案例集

```java
// ─── 案例 1：List<Entity> → List<VO>（实体转 VO）───
List<UserVO> vos = users.stream()
    .map(u -> {
        UserVO vo = new UserVO();
        BeanUtils.copyProperties(u, vo);
        vo.setAgeDesc(u.getAge() >= 18 ? "成年" : "未成年");
        vo.setDeptName(deptMap.get(u.getDeptId()));        // 关联字典翻译
        return vo;
    })
    .collect(toList());
// 更优雅：给 VO 加构造器 VO(User user)，然后 map(UserVO::new)

// ─── 案例 2：提取 ID 列表（用于批量查询，避免 N+1）───
List<Long> userIds = orders.stream()
    .map(Order::getUserId)
    .distinct()                                            // 去重减少查询量
    .collect(toList());
Map<Long, User> userMap = userService.listByIds(userIds).stream()
    .collect(toMap(User::getId, Function.identity()));      // 转 Map 便于 O(1) 查找
orders.forEach(o -> o.setUserName(userMap.get(o.getUserId()).getName()));

// ─── 案例 3：多字段排序 + 分页 ───
public PageResult<UserVO> pageUsers(List<User> all, int pageNum, int pageSize, String keyword) {
    List<User> filtered = all.stream()
        .filter(u -> keyword == null
                || u.getName().contains(keyword)
                || u.getEmail().contains(keyword))          // 关键字过滤
        .sorted(Comparator.comparing(User::getStatus)       // 状态优先
                        .thenComparing(User::getCreateTime).reversed())  // 再按时间倒序
        .collect(toList());

    int total = filtered.size();
    List<UserVO> records = filtered.stream()
        .skip((long) (pageNum - 1) * pageSize)              // 跳过前面的
        .limit(pageSize)                                     // 取一页
        .map(UserVO::new)
        .collect(toList());

    return PageResult.of(records, total, pageNum, pageSize);
}

// ─── 案例 4：树形结构构建（部门树、菜单树、评论树）★★★★★ ───
public List<MenuVO> buildTree(List<Menu> menus) {
    // 1. 转 VO 并建立 id → VO 的索引
    Map<Long, MenuVO> voMap = menus.stream()
        .map(MenuVO::new)
        .collect(toMap(MenuVO::getId, Function.identity(), (a,b) -> a, LinkedHashMap::new));

    // 2. 遍历，把自己挂到父节点的 children 上
    List<MenuVO> roots = new ArrayList<>();
    voMap.values().forEach(vo -> {
        if (vo.getParentId() == null || vo.getParentId() == 0L) {
            roots.add(vo);                                    // 根节点
        } else {
            MenuVO parent = voMap.get(vo.getParentId());
            if (parent != null) {
                parent.getChildren().add(vo);                 // 挂到父节点
            } else {
                roots.add(vo);                                // 父节点不存在的孤儿，当根处理
            }
        }
    });

    // 3. 排序（可选）
    roots.sort(Comparator.comparingInt(MenuVO::getSort));
    return roots;
}
// 时间复杂度 O(n)，远优于递归查找的 O(n²)

// 用 groupingBy 的版本
public List<MenuVO> buildTree2(List<Menu> menus) {
    Map<Long, List<Menu>> byParent = menus.stream()
        .collect(groupingBy(m -> m.getParentId() == null ? 0L : m.getParentId()));
    return buildChildren(0L, byParent);
}
private List<MenuVO> buildChildren(Long parentId, Map<Long, List<Menu>> byParent) {
    return byParent.getOrDefault(parentId, Collections.emptyList()).stream()
        .map(m -> {
            MenuVO vo = new MenuVO(m);
            vo.setChildren(buildChildren(m.getId(), byParent));   // 递归
            return vo;
        })
        .sorted(Comparator.comparingInt(MenuVO::getSort))
        .collect(toList());
}

// ─── 案例 5：统计报表 ───
// 各部门人数、平均薪资、最高薪资
Map<String, Map<String, Object>> report = employees.stream()
    .collect(groupingBy(Employee::getDept, LinkedHashMap::new, collectingAndThen(
        summarizingDouble(Employee::getSalary),
        stats -> Map.of(
            "count", stats.getCount(),
            "avgSalary", Math.round(stats.getAverage() * 100) / 100.0,
            "maxSalary", stats.getMax(),
            "totalSalary", stats.getSum()
        ))));

// 按月统计订单量
Map<String, Long> monthlyCount = orders.stream()
    .collect(groupingBy(
        o -> o.getCreateTime().format(DateTimeFormatter.ofPattern("yyyy-MM")),
        TreeMap::new,                                   // 按月份排序
        counting()));

// 销售额 Top 10 商品
List<Map.Entry<String, BigDecimal>> top10 = products.stream()
    .collect(toMap(Product::getName, Product::getSalesAmount, BigDecimal::add))
    .entrySet().stream()
    .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
    .limit(10)
    .collect(toList());

// ─── 案例 6：数据校验（收集所有错误而非遇到第一个就抛）───
public List<String> validateOrder(OrderCreateDTO dto) {
    List<String> errors = new ArrayList<>();
    Optional.ofNullable(dto.getUserId())
            .filter(id -> id > 0)
            .orElseGet(() -> { errors.add("用户 ID 非法"); return null; });
    Optional.ofNullable(dto.getItems())
            .filter(l -> !l.isEmpty())
            .orElseGet(() -> { errors.add("订单项不能为空"); return null; });
    dto.getItems().stream()
       .filter(i -> i.getQuantity() <= 0)
       .forEach(i -> errors.add("商品 " + i.getSkuId() + " 数量必须大于 0"));
    return errors;
}
// 更函数式的写法（用 Predicate + 错误消息的组合）
record ValidationRule<T>(Predicate<T> rule, String message) { }
List<ValidationRule<OrderCreateDTO>> rules = List.of(
    new ValidationRule<>(d -> d.getUserId() != null && d.getUserId() > 0, "用户 ID 非法"),
    new ValidationRule<>(d -> d.getItems() != null && !d.getItems().isEmpty(), "订单项不能为空"),
    new ValidationRule<>(d -> d.getAmount().compareTo(BigDecimal.ZERO) > 0, "金额必须大于 0")
);
List<String> errors2 = rules.stream()
    .filter(r -> !r.rule().test(dto))
    .map(ValidationRule::message)
    .collect(toList());

// ─── 案例 7：批量处理（分批调用第三方接口，避免超限）───
public static <T> List<List<T>> partition(List<T> list, int size) {
    return IntStream.iterate(0, i -> i + size)
        .limit((list.size() + size - 1) / size)          // 向上取整
        .mapToObj(i -> list.subList(i, Math.min(i + size, list.size())))
        .collect(toList());
}
// Guava: Lists.partition(list, 500)
partition(userIds, 500).forEach(batch -> {
    thirdPartyClient.batchQuery(batch);                   // 每批 500 个
});

// ─── 案例 8：集合运算 ───
Set<Long> ids1 = Set.of(1L, 2L, 3L);
Set<Long> ids2 = Set.of(2L, 3L, 4L);
// 交集
Set<Long> intersection = ids1.stream().filter(ids2::contains).collect(toSet());
// 差集（ids1 - ids2）
Set<Long> difference = ids1.stream().filter(id -> !ids2.contains(id)).collect(toSet());
// 并集
Set<Long> union = Stream.concat(ids1.stream(), ids2.stream()).collect(toSet());
// 对称差集
Set<Long> symmetric = Stream.concat(
        ids1.stream().filter(id -> !ids2.contains(id)),
        ids2.stream().filter(id -> !ids1.contains(id))
).collect(toSet());

// ─── 案例 9：扁平化嵌套对象 ───
// 订单 → 订单项 → 商品，取出所有商品名（去重排序）
List<String> productNames = orders.stream()
    .flatMap(o -> o.getItems().stream())
    .flatMap(item -> item.getProduct().getTags().stream())
    .distinct()
    .sorted()
    .collect(toList());

// ─── 案例 10：Map 的处理 ───
// 过滤 Map
Map<String, Integer> filtered = map.entrySet().stream()
    .filter(e -> e.getValue() > 10)
    .collect(toMap(Map.Entry::getKey, Map.Entry::getValue));
// 转换 Map 的 value
Map<String, String> transformed = map.entrySet().stream()
    .collect(toMap(Map.Entry::getKey, e -> "值：" + e.getValue()));
// Map 按 value 排序
Map<String, Integer> sortedMap = map.entrySet().stream()
    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
    .collect(toMap(Map.Entry::getKey, Map.Entry::getValue, (a,b) -> a, LinkedHashMap::new));
// 合并两个 Map（同 key 累加）
Map<String, Integer> merged = Stream.concat(map1.entrySet().stream(), map2.entrySet().stream())
    .collect(toMap(Map.Entry::getKey, Map.Entry::getValue, Integer::sum));
// Map 反转（一对多）
Map<Integer, List<String>> reversed = map.entrySet().stream()
    .collect(groupingBy(Map.Entry::getValue,
             mapping(Map.Entry::getKey, toList())));

// ─── 案例 11：字符串处理 ───
// 驼峰转下划线
String toUnderline = IntStream.range(0, str.length())
    .mapToObj(i -> {
        char c = str.charAt(i);
        return Character.isUpperCase(c) && i > 0 ? "_" + Character.toLowerCase(c) : String.valueOf(c);
    })
    .collect(joining());
// 统计字符出现次数
Map<Character, Long> charCount = str.chars()
    .mapToObj(c -> (char) c)
    .collect(groupingBy(Function.identity(), counting()));
// 提取所有数字
String digits = str.chars().filter(Character::isDigit)
    .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
    .toString();

// ─── 案例 12：自定义 Collector（三参数 collect）───
// collect(Supplier, BiConsumer accumulator, BiConsumer combiner)
String joined = stream.collect(
    StringBuilder::new,                      // 容器创建
    (sb, u) -> sb.append(u.getName()).append(","),   // 累加（串行）
    StringBuilder::append);                  // 合并（并行时）
```

### 3.10 Stream 性能与最佳实践

```java
// 1. 优先用特化流避免装箱
// ❌ 装箱开销
int sum = list.stream().map(User::getAge).reduce(0, Integer::sum);   // Integer 装箱
// ✅ 特化流
int sum2 = list.stream().mapToInt(User::getAge).sum();               // 无装箱，快 3~5 倍

// 2. 预估集合大小（collect 到 ArrayList 时）
List<User> result = users.stream()
    .filter(...)
    .collect(Collectors.toCollection(() -> new ArrayList<>(users.size())));   // 预分配

// 3. 短路操作前置（减少后续操作的数据量）
// ❌ 先 map（对全部元素做昂贵转换）再 filter
stream.map(this::expensiveConvert).filter(x -> x.isValid()).findFirst();
// ✅ 先 filter 再 map
stream.filter(this::cheapCheck).map(this::expensiveConvert).findFirst();

// 4. limit 前置（如果只需要少量结果）
stream.limit(10).map(this::convert).collect(toList());    // 只转换 10 个
stream.map(this::convert).limit(10).collect(toList());    // 转换全部再取 10 个 ❌

// 5. 避免在 Stream 中做副作用操作
// ❌ 副作用（修改外部状态，破坏函数式语义，并行时出错）
List<String> result = new ArrayList<>();
stream.forEach(result::add);
// ✅ 用 collect
List<String> result2 = stream.collect(toList());

// 6. 简单的循环不要用 Stream（可读性和性能都更好）
// ❌
for (int i = 0; i < list.size(); i++) { list.get(i).process(); }
// ✅ 这种简单场景直接 for 循环或 list.forEach
list.forEach(Item::process);

// 7. Stream 创建有固定开销（约 100~200ns），高频小集合场景用循环
// 基准：处理 10 个元素的 List，for 循环约 20ns，Stream 约 200ns

// 8. 复用 Stream 定义（用 Supplier 包装）
Supplier<Stream<User>> streamSupplier = users::stream;
long count = streamSupplier.get().count();
List<User> list3 = streamSupplier.get().collect(toList());
```

## 4. 接口的 default 与 static 方法

见 [[后端/Java基础/面向对象进阶]] 第 2 节。补充 Stream 相关的：

```java
// Collection 接口新增的 default 方法（JDK 8）
default Stream<E> stream() { return StreamSupport.stream(spliterator(), false); }
default Stream<E> parallelStream() { return StreamSupport.stream(spliterator(), true); }
default void forEach(Consumer<? super E> action) { for (E e : this) action.accept(e); }
default boolean removeIf(Predicate<? super E> filter) {
    boolean removed = false;
    final Iterator<E> each = iterator();
    while (each.hasNext()) {
        if (filter.test(each.next())) { each.remove(); removed = true; }
    }
    return removed;
}
default Spliterator<E> spliterator() { return Spliterators.spliteratorUnknownSize(iterator(), 0); }

// Map 接口新增的 default 方法
default V getOrDefault(Object key, V defaultValue)
default void forEach(BiConsumer<? super K, ? super V> action)
default void replaceAll(BiFunction<? super K, ? super V, ? extends V> function)
default V putIfAbsent(K key, V value)
default boolean remove(Object key, Object value)
default boolean replace(K key, V oldValue, V newValue)
default V computeIfAbsent(K key, Function<? super K, ? extends V> mappingFunction)
default V computeIfPresent(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction)
default V compute(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction)
default V merge(K key, V value, BiFunction<? super V, ? super V, ? extends V> remappingFunction)

// Iterable 的新方法
default void forEach(Consumer<? super T> action)
default Spliterator<T> spliterator()

// 这些 default 方法让所有集合「自动」获得了新能力，无需修改任何实现类
// 这就是 default 方法的设计初衷：接口演化（API Evolution）
```

## 5. JDK 9~21 的实用新特性速查

```java
// ─── JDK 9 ───
// 集合工厂方法（真不可变，不接受 null，不允许重复）
List<String> l = List.of("a", "b", "c");
Set<Integer> s = Set.of(1, 2, 3);
Map<String, Integer> m = Map.of("a", 1, "b", 2);              // 最多 10 对
Map<String, Integer> m2 = Map.ofEntries(                       // 任意数量
    Map.entry("a", 1), Map.entry("b", 2));
List<Integer> copy = List.copyOf(mutableList);                 // 不可变副本
// ⚠️ 这些集合调用 add/remove/set 抛 UnsupportedOperationException
// ⚠️ List.of(null) 抛 NPE，Set.of(1,1) 抛 IllegalArgumentException

// Stream 新 API
Stream.of(1,2,3,4,5).takeWhile(n -> n < 4);        // [1,2,3]
Stream.of(1,2,3,4,5).dropWhile(n -> n < 4);        // [4,5]
Stream.iterate(1, n -> n < 100, n -> n * 2);       // 带条件的无限流
Stream.ofNullable(null);                            // 空流或单元素流
Optional.ifPresentOrElse(v -> {}, () -> {});
Optional.or(() -> Optional.of("backup"));
Optional.stream();                                  // Optional → Stream

// 接口 private 方法（供 default 方法复用逻辑）
interface MyInterface {
    private void helper() { }
    default void f() { helper(); }
}

// try-with-resources 支持外部 final 变量
InputStream in = new FileInputStream("a");
try (in) { }                                        // 无需重新声明

// 字符串处理
String str = "abc";
// （JDK 9 的 Compact Strings 是内部优化，无 API 变化）

// ─── JDK 10 ───
var list = new ArrayList<String>();                 // 局部变量类型推断
var map = new HashMap<String, List<Integer>>();
for (var i = 0; i < 10; i++) { }
try (var reader = Files.newBufferedReader(path)) { }
List<String> unmod = List.copyOf(mutableList);
Optional.orElseThrow();                             // 无参版（抛 NoSuchElementException）
Collectors.toUnmodifiableList();
Collectors.toUnmodifiableMap(k, v);
Collectors.toUnmodifiableSet();

// ─── JDK 11 (LTS) ───
"  abc  ".strip();                                  // 去除 Unicode 空白（比 trim 彻底）
"  abc  ".stripLeading();                           // 只去左边
"  abc  ".stripTrailing();                          // 只去右边
"".isBlank();                                       // 是否全空白
"ab".repeat(3);                                     // "ababab"
"a\nb\nc".lines();                                  // Stream<String>
Files.readString(path);                             // 一行读文件
Files.writeString(path, "content");
Optional.isEmpty();                                  // 是否有值（!isPresent）
// HTTP Client（正式版，替代 HttpURLConnection）
HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.example.com/users"))
    .header("Content-Type", "application/json")
    .GET()
    .timeout(Duration.ofSeconds(10))
    .build();
HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
response.statusCode(); response.body();
// 异步
client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
      .thenApply(HttpResponse::body)
      .thenAccept(System.out::println);

// ─── JDK 12~14 ───
"abc".indent(4);                                    // 缩进（JDK 12）
Collectors.teeing(c1, c2, merger);                   // JDK 12
String.transform(f);                                 // JDK 12："abc".transform(String::toUpperCase)
"1+2".formatted();                                   // JDK 15：String.format 的实例方法版
// switch 表达式（JDK 14 正式）
int numLetters = switch (day) {
    case MONDAY, FRIDAY -> 6;
    case TUESDAY -> {
        log.debug("周二");
        yield 7;                                     // yield 返回值
    }
    default -> 0;
};
// instanceof 模式匹配（JDK 16 正式，14 预览）
if (obj instanceof String s && s.length() > 3) { System.out.println(s); }
// NullPointerException 详细信息（JDK 14，默认开启于 15）
// Cannot invoke "String.length()" because "user.name" is null

// ─── JDK 15~16 ───
// 文本块（JDK 15 正式）
String json = """
        {
          "name": "Tom",
          "age": 20
        }
        """;
// record（JDK 16 正式）：不可变数据载体
public record UserDTO(Long id, String name, Integer age) {
    // 自动生成：private final 字段、全参构造器、getter（id() 不是 getId()）、equals、hashCode、toString
    // 可以加自定义方法和紧凑构造器（校验）
    public UserDTO {                                  // 紧凑构造器（无参数列表）
        Objects.requireNonNull(name, "name 不能为空");
        if (age < 0) throw new IllegalArgumentException("年龄非法");
    }
    public boolean isAdult() { return age >= 18; }
    // 可以实现接口，不能继承类（隐式继承 java.lang.Record）
}
UserDTO dto = new UserDTO(1L, "Tom", 20);
dto.name();                                           // 注意：不是 getName()
// Stream.toList()（JDK 16）
List<String> list = stream.toList();                   // 不可变，允许 null

// ─── JDK 17 (LTS) ───
// sealed 密封类：限制哪些类可以继承
public sealed interface Shape permits Circle, Rectangle, Triangle { }
public sealed class Animal permits Dog, Cat { }
public final class Dog extends Animal { }              // final
public non-sealed class Cat extends Animal { }         // non-sealed：任何类可继承
public sealed class Bird extends Animal permits Parrot { }
// 配合 switch 模式匹配实现「穷尽性检查」（编译器保证覆盖所有子类型）
String desc = switch (shape) {
    case Circle c -> "圆，半径 " + c.radius();
    case Rectangle r -> "矩形 " + r.w() + "x" + r.h();
    case Triangle t -> "三角形";
    // 少一个分支 → 编译错误！（因为 sealed 限定了子类范围）
};
// 强封装 JDK 内部 API（默认 --illegal-access=deny）

// ─── JDK 21 (LTS) ───
// ★ 虚拟线程（Virtual Threads）：轻量级线程，百万级并发
Thread.startVirtualThread(() -> System.out.println("虚拟线程"));
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 1_000_000; i++) {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));       // 阻塞时自动让出载体线程
            return "done";
        });
    }
}
// 每个虚拟线程只占约 1KB（平台线程约 1MB 栈），IO 密集型应用吞吐量提升 10 倍+

// Record 模式
record Point(int x, int y) { }
if (obj instanceof Point(int x, int y)) { System.out.println(x + y); }
// switch 模式匹配（正式）
static String format(Object obj) {
    return switch (obj) {
        case Integer i when i > 100 -> "大整数 " + i;    // 带条件的模式
        case Integer i -> "整数 " + i;
        case String s  -> "字符串 " + s;
        case null      -> "空值";                        // 显式匹配 null
        default        -> "其他";
    };
}
// SequencedCollection（有序集合的新接口）
interface SequencedCollection<E> {
    void addFirst(E e); void addLast(E e);
    E getFirst(); E getLast();
    E removeFirst(); E removeLast();
    SequencedCollection<E> reversed();
}
// List、Deque、LinkedHashSet 都实现了它，统一了「首尾操作」的 API

// 未命名变量与模式（JDK 21）
if (obj instanceof Point(int x, _)) { }                 // _ 表示不关心的变量
try (var _ = lock()) { }
catch (NumberFormatException _) { }
```

## 6. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | Lambda 修改局部变量 | 编译错误 | 用数组/AtomicXxx/Stream 聚合 |
| 2 | Lambda 抛受检异常 | 编译错误（接口未声明） | try-catch 包装成 RuntimeException |
| 3 | `invoke` 中用 proxy | 死循环 | 用 target |
| 4 | Stream 消费两次 | `IllegalStateException` | 重新创建流 |
| 5 | `Files.lines` 未关闭 | 文件句柄泄漏 | try-with-resources |
| 6 | `Stream.of(array)` | 数组作为单元素 | 用 `Arrays.stream(array)` |
| 7 | `Collectors.toMap` key 重复 | `IllegalStateException: Duplicate key` | 提供 mergeFunction |
| 8 | `Collectors.toMap` value 为 null | NPE | 过滤 null 或手写收集 |
| 9 | 排序后收集到 HashMap | 顺序丢失 | `LinkedHashMap::new` |
| 10 | `Optional.of(null)` | NPE | 用 `ofNullable` |
| 11 | `opt.get()` 不判空 | `NoSuchElementException` | `orElse`/`orElseThrow` |
| 12 | `orElse(expensiveCall())` | 总是执行昂贵调用 | `orElseGet(() -> ...)` |
| 13 | Optional 作为字段/参数 | 序列化问题、啰嗦 | 只作返回值 |
| 14 | 并行流用非线程安全容器 | 数据丢失、异常 | 用 `collect` |
| 15 | 并行流依赖 ThreadLocal | 上下文丢失（事务/请求失效） | 改用串行或自定义线程池 |
| 16 | 并行流处理小数据量 | 比串行慢 | 数据量 > 10000 才并行 |
| 17 | 并行流做 IO | 阻塞 commonPool | 用 CompletableFuture + 自定义线程池 |
| 18 | `forEach` 期望顺序（并行流） | 乱序 | `forEachOrdered` |
| 19 | `mapToInt` 后忘记 `sum()` | 类型不对 | 特化流有自己的聚合方法 |
| 20 | `limit` 在 `sorted` 前 | Top N 结果错误 | 先 sorted 后 limit |
| 21 | `peek` 不执行 | 短路操作或无终止操作 | 加终止操作，peek 只用于调试 |
| 22 | 基本类型装箱性能差 | Stream&lt;Integer&gt; 慢 | 用 IntStream/LongStream |
| 23 | `List.of()` 返回不可变 | add 抛异常 | 需要可变用 `new ArrayList<>(...)` |
| 24 | `stream.toList()` 不可变（JDK 16+） | add 抛异常 | 用 `collect(Collectors.toList())` 得可变 List |
| 25 | `distinct` 对未重写 hashCode 的对象 | 去重失效 | 重写 equals/hashCode 或 `distinctByKey` |
| 26 | `groupingBy` 的 key 为 null | NPE | 先过滤或给默认值 |
| 27 | flatMap 忘记拍平 | 嵌套集合 | `flatMap(List::stream)` |
| 28 | `reduce` 的 identity 不满足结合律 | 并行结果错误 | identity 必须是运算的单位元 |
| 29 | `Comparator.comparing` 的字段为 null | NPE | `Comparator.nullsFirst/nullsLast` |
| 30 | 方法引用的重载解析歧义 | 编译错误 | 改用显式 Lambda |

---

## 关联笔记

- 上一篇：[[后端/Java基础/反射与动态代理]]
- 下一篇：[[后端/Java基础/网络编程]]
- 相关：[[后端/Java基础/集合框架-List与Set]]（集合处理）、[[后端/Java基础/常用类与API]]（Optional 与日期）
- 异步进阶：[[后端/Java基础/并发编程/异步编程-CompletableFuture]]
- 应用：[[后端/SpringBoot/整合数据访问层]]（Stream 处理查询结果）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
