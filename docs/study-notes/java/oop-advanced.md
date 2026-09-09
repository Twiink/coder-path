---
title: "面向对象进阶"
aliases:
  - "抽象类与接口"
  - "Java 内部类"
tags:
  - "后端"
  - "java"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/面向对象基础]]"
  - "[[后端/Java基础/泛型枚举与注解]]"
  - "[[后端/Java基础/Java8新特性-Lambda与Stream]]"
  - "[[后端/Spring/AOP面向切面编程]]"
created: 2026-09-06
updated: 2026-09-06
---

# 面向对象进阶

## 1. 抽象类（Abstract Class）

### 1.1 概念与语法

**抽象类是对一类事物的抽象描述，可以包含抽象方法（只有声明没有实现），不能被实例化。**

```java
// 抽象类：用 abstract 修饰
public abstract class Shape {

    protected String color;

    // 抽象方法：只有签名没有方法体，子类必须实现
    public abstract double area();             // 计算面积
    public abstract double perimeter();        // 计算周长

    // 普通方法：可以有完整实现（子类直接继承）
    public void describe() {
        System.out.println("我是" + color + "的图形，面积=" + area() + "，周长=" + perimeter());
    }

    // 构造器：抽象类可以有构造器（供子类 super() 调用）
    public Shape(String color) {
        this.color = color;
    }

    // 静态方法、final 方法、私有方法都可以有
    public static Shape create(String type) { return null; }
    public final void lock() { }               // final 方法子类不能重写
    private void internal() { }
}

// 子类必须实现所有抽象方法，否则子类自己也得是抽象类
public class Circle extends Shape {
    private double radius;

    public Circle(String color, double radius) {
        super(color);                          // 调用抽象父类的构造器
        this.radius = radius;
    }

    @Override
    public double area() { return Math.PI * radius * radius; }

    @Override
    public double perimeter() { return 2 * Math.PI * radius; }
}

public class Rectangle extends Shape {
    private double width, height;

    public Rectangle(String color, double w, double h) {
        super(color);
        this.width = w;
        this.height = h;
    }

    @Override
    public double area() { return width * height; }

    @Override
    public double perimeter() { return 2 * (width + height); }
}
```

**使用（多态）：**

```java
Shape s1 = new Circle("红", 2.0);
Shape s2 = new Rectangle("蓝", 3.0, 4.0);

s1.describe();    // 我是红的图形，面积=12.566，周长=12.566
s2.describe();    // 我是蓝的图形，面积=12.0，周长=14.0

// Shape s = new Shape();    // ❌ 编译错误：抽象类不能实例化
```

### 1.2 抽象类的语法规则

| 规则 | 说明 |
| --- | --- |
| 抽象类**不能被实例化** | `new Shape()` 编译错误，但可以有构造器供子类调用 |
| 抽象方法**不能有以下修饰符** | `private`（子类看不到无法重写）、`static`（属于类无法重写）、`final`（不能重写）、`synchronized`、`native` |
| 抽象类**可以没有抽象方法** | `abstract class A &#123; &#125;` 合法（用于禁止实例化） |
| **有抽象方法的类必须是抽象类** | 否则编译错误 |
| 抽象类可以有**任意普通成员** | 字段、构造器、普通方法、静态方法、内部类 |
| 子类要么实现**全部**抽象方法，要么自己也声明为抽象类 | — |
| 抽象类**不能被 final 修饰** | `final abstract class` 矛盾（final 不可继承，abstract 必须继承） |

```java
// ❌ 非法的抽象方法修饰符组合
public abstract class Bad {
    // private abstract void f();          // ❌ private 抽象方法
    // public abstract static void g();    // ❌ static 抽象方法
    // public abstract final void h();     // ❌ final 抽象方法
}
```

### 1.3 抽象类的应用：模板方法模式

**抽象类最重要的应用是「模板方法模式」—— 父类定义算法骨架，子类填充具体步骤。**

```java
/**
 * 数据导出模板：定义「查询 → 转换 → 写出 → 通知」的固定流程
 */
public abstract class AbstractExporter {

    /** 模板方法：final 防止子类破坏流程骨架 */
    public final void export(ExportParam param) {
        List<?> rawData = queryData(param);            // 1. 抽象：子类实现
        List<List<String>> rows = transform(rawData);  // 2. 抽象：子类实现
        if (!rows.isEmpty()) {                         // 3. 钩子：可选校验
            String path = writeToFile(rows, param);    // 4. 抽象：子类实现
            afterExport(path);                          // 5. 钩子：默认空实现
        }
    }

    protected abstract List<?> queryData(ExportParam param);
    protected abstract List<List<String>> transform(List<?> rawData);
    protected abstract String writeToFile(List<List<String>> rows, ExportParam param);

    /** 钩子方法（Hook）：有默认实现，子类可选择性重写 */
    protected void afterExport(String path) {
        // 默认什么都不做，子类可重写为发通知
    }
}

// 具体实现：Excel 导出
public class ExcelExporter extends AbstractExporter {
    @Override protected List<?> queryData(ExportParam p) { return orderMapper.select(p); }
    @Override protected List<List<String>> transform(List<?> data) { /* 转成表格行 */ }
    @Override protected String writeToFile(List<List<String>> rows, ExportParam p) { /* EasyExcel 写文件 */ }
    @Override protected void afterExport(String path) { mailService.send("导出完成：" + path); }
}

// CSV 导出只需实现三个抽象方法，流程骨架完全复用
public class CsvExporter extends AbstractExporter { /* ... */ }
```

**JDK 中的抽象类范例：**

| 抽象类 | 模板方法 | 抽象方法 |
| --- | --- | --- |
| `AbstractList` / `AbstractSet` | 提供 `equals`、`hashCode`、`iterator` 等通用实现 | `get(int)`、`size()` |
| `AbstractMap` | 通用 Map 行为 | `entrySet()` |
| `InputStream` / `OutputStream` | 通用的 `read(byte[])` 基于 `read()` | `read()`、`write(int)` |
| `HttpServlet` | `service()` 分发到 doGet/doPost | `doGet`、`doPost`（非抽象但有默认实现） |
| Spring `AbstractApplicationContext` | `refresh()` 12 步模板 | `refreshBeanFactory()` 等 |
| Spring `AbstractBeanFactory` | `getBean()` → `doGetBean()` | `createBean()` |

## 2. 接口（Interface）

### 2.1 接口的演进

| 版本 | 接口能力 |
| --- | --- |
| JDK 1.0 | 抽象方法 + 常量（`public static final` 字段） |
| **JDK 8** | 新增 **`default` 方法**（有实现）、**`static` 方法** |
| **JDK 9** | 新增 **`private` 方法**、`private static` 方法（供 default 方法复用逻辑） |
| 一直 | 接口**不能有构造器**、不能有实例字段、不能被实例化 |

```java
public interface PaymentService {

    // ─── 常量（隐式 public static final）───
    String DEFAULT_CURRENCY = "CNY";          // 等价 public static final String
    int MAX_AMOUNT = 100_000;

    // ─── 抽象方法（隐式 public abstract）───
    PayResult pay(BigDecimal amount, String channel);   // 等价 public abstract

    // ─── JDK 8 default 方法（有实现，实现类可直接继承或重写）───
    default boolean refund(String orderNo) {
        validateOrderNo(orderNo);
        return doRefund(orderNo);
    }

    default PayResult pay(BigDecimal amount) {          // default 方法可重载
        return pay(amount, DEFAULT_CURRENCY);
    }

    // ─── JDK 8 static 方法（只能通过接口名调用，不能被继承）───
    static PaymentService of(String type) {
        return switch (type) {
            case "ALIPAY" -> new AlipayService();
            case "WECHAT" -> new WechatPayService();
            default -> throw new IllegalArgumentException("不支持：" + type);
        };
    }

    // ─── JDK 9 private 方法（复用 default 方法的公共逻辑，不对外暴露）───
    private void validateOrderNo(String orderNo) {
        if (orderNo == null || orderNo.isBlank()) {
            throw new IllegalArgumentException("订单号非法");
        }
    }
    private boolean doRefund(String orderNo) {
        // 公共退款逻辑
        return true;
    }

    private static void log(String msg) {               // JDK 9 private static
        System.out.println("[Payment] " + msg);
    }
}
```

**实现接口：**

```java
// 用 implements，可实现多个接口（弥补单继承的不足）
public class AlipayService implements PaymentService {

    @Override
    public PayResult pay(BigDecimal amount, String channel) {
        // 必须实现所有抽象方法
        return new PayResult(true, "支付宝支付成功");
    }

    // default 方法可选择重写，不重写则用接口的默认实现
    @Override
    public boolean refund(String orderNo) {
        System.out.println("支付宝专属退款逻辑");
        return true;
    }
}

// 一个类可以实现多个接口
public class UserServiceImpl implements UserService, InitializingBean, DisposableBean { }

// 接口可以继承多个接口（接口间是多继承！）
public interface Readable { void read(); }
public interface Writable { void write(); }
public interface ReadWritable extends Readable, Writable {      // 接口多继承
    void flush();
}
// 实现类必须实现三个接口的所有抽象方法
public class FileChannel implements ReadWritable {
    public void read() { }
    public void write() { }
    public void flush() { }
}
```

### 2.2 接口的修饰符规则

| 成员类型 | 隐式修饰符 | 可否显式写 | 说明 |
| --- | --- | --- | --- |
| 字段（常量） | `public static final` | 冗余，不推荐写 | 接口**不能有实例字段** |
| 抽象方法 | `public abstract` | 冗余 | JDK 9 前只能是 public |
| `default` 方法 | `public` | 可写 private（JDK 9+） | 有方法体 |
| `static` 方法 | `public` | 可写 private（JDK 9+） | 只能通过接口名调用 |
| `private` 方法 | — | JDK 9+ | 供 default/static 复用 |
| 嵌套类/接口 | `public static` | — | 静态内部类 |
| 构造器 | ❌ **不能有** | — | 接口不是类 |

```java
// 接口字段的验证
interface Const {
    int X = 10;              // 实际是 public static final int X = 10
}
// Const.X = 20;             // ❌ 编译错误：final 不可修改
System.out.println(Const.X); // 10，通过接口名访问

// 【反模式】「常量接口」—— 用接口定义一堆常量
public interface Constants {                    // ❌ Effective Java 第 22 条明确反对
    int STATUS_A = 1;
    int STATUS_B = 2;
}
public class Service implements Constants {     // 污染了类的 API，实现细节泄漏
    void f() { System.out.println(STATUS_A); }
}
// ✅ 正确做法：用枚举，或用 final 工具类 + private 构造器
public enum Status { A, B }
public final class Constants {
    private Constants() { }
    public static final int STATUS_A = 1;
}
```

### 2.3 default 方法的冲突解决

当一个类实现的**多个接口有同名 default 方法**时，编译器强制要求显式解决冲突：

```java
interface A { default void hello() { System.out.println("A"); } }
interface B { default void hello() { System.out.println("B"); } }

// ❌ 编译错误：class C inherits unrelated defaults for hello() from both A and B
class C implements A, B { }

// ✅ 必须重写，显式指定用哪个（或全新实现）
class C implements A, B {
    @Override
    public void hello() {
        A.super.hello();       // 语法：接口名.super.方法名
    }
}

// 也可以完全自己实现
class D implements A, B {
    @Override
    public void hello() { System.out.println("D 自己的实现"); }
}
```

**冲突解决的选择规则（JVM 按此顺序判定「谁赢」）：**

1. **类优先（Class wins）**：父类中的具体实现 > 接口的 default 实现。
   ```java
   interface A { default void f() { System.out.println("A"); } }
   class Parent { public void f() { System.out.println("Parent"); } }
   class Child extends Parent implements A { }   // 不冲突，用 Parent 的
   new Child().f();    // "Parent"
   ```
2. **子接口优先**：更具体的接口 default 胜出。
   ```java
   interface A { default void f() { System.out.println("A"); } }
   interface B extends A { @Override default void f() { System.out.println("B"); } }
   class C implements A, B { }        // 不冲突，B 更具体
   new C().f();    // "B"
   ```
3. **都不同层级 → 编译错误，必须手动重写**（如上面的 A、B 无继承关系）。

> 【设计原则】default 方法的初衷是**接口演化**（给已有接口加新方法而不破坏所有实现类），典型如 JDK 8 给 `Collection` 加 `stream()`、`forEach()`、`removeIf()`。**不要滥用 default 方法实现复杂业务逻辑**。

### 2.4 抽象类 vs 接口（核心面试）

| 对比项 | 抽象类（abstract class） | 接口（interface） |
| --- | --- | --- |
| 关系语义 | **is-a**（是一种） | **can-do / like-a**（能做什么，行为契约） |
| 继承数量 | 单继承（只能 extends 一个） | **多实现**（implements 多个） |
| 构造器 | ✅ 有（供子类 super 调用） | ❌ 没有 |
| 成员变量 | 任意类型（普通字段、final、static） | **只能是 `public static final` 常量** |
| 方法 | 抽象方法 + 普通方法（任意访问修饰符） | 抽象方法（public）+ default + static + private(JDK9) |
| 访问修饰符 | public/protected/private/default 都可以 | 方法默认 public，字段默认 public static final |
| 状态（字段） | ✅ 可以持有状态 | ❌ 无实例状态 |
| 代码复用 | 通过继承复用字段 + 方法实现 | 通过 default 方法复用逻辑（无状态） |
| 设计目的 | 抽取子类的**共性模板**（含状态） | 定义**行为契约**（能力声明） |
| 演化成本 | 加抽象方法会破坏所有子类 | **加 default 方法不破坏实现类**（JDK 8 的优势） |
| 实例化 | 都不能实例化 | 都不能实例化 |

**如何选择：**

| 场景 | 选择 |
| --- | --- |
| 多个类有**共同的状态字段** + 部分公共实现 | **抽象类**（如 `AbstractList` 持有 `modCount`） |
| 定义一种**能力/行为契约**，与继承体系无关 | **接口**（如 `Comparable`、`Serializable`、`Runnable`） |
| 需要**多重继承**能力 | **接口**（类只能单继承） |
| 骨架实现 + 契约的组合 | **接口定义契约 + 抽象类提供骨架**（如 `List` 接口 + `AbstractList` 抽象类） |
| 想给已有接口**新增方法**且不破坏实现类 | **接口的 default 方法** |

```java
// JDK 的经典设计：接口 + 抽象骨架类（Skeletal Implementation）
public interface List<E> extends Collection<E> {        // 契约：定义能做什么
    E get(int index);
    int size();
    // ... 大量 default 方法
}

public abstract class AbstractList<E> implements List<E> {  // 骨架：提供基于 get/size 的通用实现
    protected transient int modCount = 0;                    // 抽象类才能持有状态！
    public Iterator<E> iterator() { return new Itr(); }      // 基于抽象方法实现
    public boolean equals(Object o) { /* 通用实现 */ }
}

public class ArrayList<E> extends AbstractList<E> {          // 只需实现少数抽象方法
    public E get(int index) { /* 数组实现 */ }
    public int size() { return size; }
}
```

### 2.5 面向接口编程（依赖倒置）

**这是 Spring 整个框架的哲学基础**，务必吃透。

```java
// ❌ 面向实现编程：调用方与具体实现强耦合
public class OrderService {
    private AlipayService payment = new AlipayService();   // 硬编码依赖
    public void pay(Order o) { payment.pay(o.getAmount()); }
    // 换成微信支付要改代码 + 重新编译 + 重新测试
}

// ✅ 面向接口编程：依赖抽象，不依赖具体
public class OrderService {
    private final PaymentService payment;                  // 依赖接口

    // 依赖注入（构造器注入，Spring 会自动装配）
    public OrderService(PaymentService payment) {
        this.payment = payment;
    }

    public void pay(Order o) { payment.pay(o.getAmount()); }   // 多态：运行时决定实现
}

// Spring 中：实现类打上 @Service，接口被自动注入
@Service
public class WechatPayService implements PaymentService { }

@Service
public class OrderService {
    private final PaymentService paymentService;
    public OrderService(PaymentService paymentService) {   // Spring 注入
        this.paymentService = paymentService;
    }
}
```

**依赖倒置原则（DIP）：**
- 高层模块（业务）不应依赖低层模块（实现），两者都应依赖**抽象**。
- 抽象不应依赖细节，细节应依赖抽象。

**SOLID 五大设计原则：**

| 原则 | 全称 | 含义 |
| --- | --- | --- |
| **S** | Single Responsibility 单一职责 | 一个类只负责一项职责（一个类只有一个引起它变化的原因） |
| **O** | Open/Closed 开闭原则 | 对扩展开放，对修改关闭（加功能靠新增类，不改已有代码）——**多态是实现手段** |
| **L** | Liskov Substitution 里氏替换 | 子类必须能替换父类且行为正确（重写时不要改变父类方法的语义契约） |
| **I** | Interface Segregation 接口隔离 | 接口要小而专，不要强迫实现类依赖用不到的方法（拆分胖接口） |
| **D** | Dependency Inversion 依赖倒置 | 依赖抽象而非具体实现 |

```java
// 里氏替换的反例：正方形继承长方形（经典违反 LSP）
class Rectangle {
    protected int width, height;
    public void setWidth(int w) { this.width = w; }
    public void setHeight(int h) { this.height = h; }
    public int area() { return width * height; }
}
class Square extends Rectangle {                 // ❌ 违反 LSP
    @Override public void setWidth(int w) { this.width = w; this.height = w; }
    @Override public void setHeight(int h) { this.width = h; this.height = h; }
}
// 测试代码对 Rectangle 成立，对 Square 不成立：
void test(Rectangle r) {
    r.setWidth(4); r.setHeight(5);
    assert r.area() == 20;      // Square 时 area=25，断言失败！
}
// 结论：Square 不是 Rectangle 的正确子类型（数学上是，行为契约上不是）
```

## 3. 内部类（Inner Class）

**内部类是定义在另一个类内部的类。** 分四种，各有不同的内存和引用语义。

### 3.1 四种内部类对比

| 类型 | 定义位置 | 是否持有外部类引用 | 能否有静态成员 | 访问外部成员 | 典型用途 |
| --- | --- | --- | --- | --- | --- |
| **成员内部类** | 类中方法外（无 static） | ✅ **持有** | JDK 16 前不能，JDK 16+ 可以 | 全部（含 private） | 逻辑分组、事件监听 |
| **静态内部类** | 类中方法外（有 static） | ❌ **不持有** | ✅ 可以 | 只能访问外部**静态**成员 | Builder、Holder、DTO |
| **局部内部类** | 方法/代码块内 | ✅ 持有 | ❌ | 外部成员 + 方法的 final/等效 final 变量 | 极少用 |
| **匿名内部类** | 方法内 `new X()&#123;&#125;` | ✅ 持有 | ❌ | 同上 | 一次性实现（Lambda 前身） |

### 3.2 成员内部类（Member Inner Class）

```java
public class Outer {
    private String outerField = "外部字段";
    private static String staticField = "外部静态字段";
    private int count = 0;

    // 成员内部类：默认持有外部类实例的引用（Outer.this）
    public class Inner {
        private String innerField = "内部字段";

        public void show() {
            System.out.println(outerField);        // ✅ 可直接访问外部私有成员
            System.out.println(staticField);       // ✅ 可访问静态成员
            System.out.println(this.innerField);   // 内部类自己的字段
            // 访问外部类实例：Outer.this
            System.out.println(Outer.this.outerField);
            Outer.this.count++;                    // 可修改外部状态
        }
    }

    public void createInner() {
        Inner inner = new Inner();                 // 外部类内部可直接 new
        inner.show();
    }
}

// 在外部创建成员内部类实例：必须先有外部类对象
Outer outer = new Outer();
Outer.Inner inner = outer.new Inner();    // ★ 特殊语法：外部对象.new 内部类()
inner.show();
```

**成员内部类持有外部引用的证据（编译后）：**

```java
// 反编译 Outer$Inner.class，会看到编译器自动加了外部类引用字段
class Outer$Inner {
    final Outer this$0;                    // ← 隐式持有外部类引用！
    private String innerField;
    Outer$Inner(Outer outer) {             // ← 构造器隐式接收外部对象
        this.this$0 = outer;
        this.innerField = "内部字段";
    }
}
```

> 【坑 - 内存泄漏】**成员内部类隐式持有外部类引用，是 Android/Java 内存泄漏的经典来源。**
>
> ```java
> public class BigService &#123;
>     private byte[] hugeData = new byte[1024 * 1024 * 100];   // 100MB
>
>     public Runnable getTask() &#123;
>         return new Runnable() &#123;                 // 匿名内部类，持有 BigService.this
>             public void run() &#123; System.out.println("task"); &#125;
>         &#125;;
>     &#125;
> &#125;
> // 如果 getTask() 返回的 Runnable 被线程池长期持有，
> // 整个 BigService（含 100MB 数据）都无法被 GC 回收！
> ```
>
> **解决**：如果内部类不需要访问外部实例，**一律用 `static` 静态内部类**。这是《Effective Java》第 24 条的强制建议。

### 3.3 静态内部类（Static Nested Class）★ 最常用

```java
public class Outer {
    private String instanceField = "实例字段";
    private static String staticField = "静态字段";

    // 静态内部类：不持有外部类引用，可独立存在
    public static class Nested {
        private String name;
        private static int sharedCount = 0;        // ✅ 可以有静态成员

        public void show() {
            System.out.println(staticField);        // ✅ 只能访问外部静态成员
            // System.out.println(instanceField);   // ❌ 编译错误：无法访问实例字段
            // （因为静态内部类没有外部类实例的引用）
        }
        public static void staticMethod() { }       // ✅ 可以有静态方法
    }
}

// 创建静态内部类：不需要外部类实例
Outer.Nested nested = new Outer.Nested();     // 直接 new，无需 outer.new
nested.show();
```

**静态内部类的经典应用：**

```java
// 应用 1：Builder 建造者模式（最典型）
public class User {
    private final String name;
    private final int age;
    private final String email;

    private User(Builder builder) {          // 私有构造器
        this.name = builder.name;
        this.age = builder.age;
        this.email = builder.email;
    }

    public static class Builder {            // 静态内部类作为建造者
        private String name;                 // 必需
        private int age;
        private String email;                // 可选

        public Builder(String name) { this.name = name; }
        public Builder age(int age) { this.age = age; return this; }
        public Builder email(String email) { this.email = email; return this; }
        public User build() { return new User(this); }
    }
}
// 使用（链式）
User user = new User.Builder("Tom")
                    .age(25)
                    .email("tom@example.com")
                    .build();

// 应用 2：单例的 Holder 模式
public class Singleton {
    private Singleton() { }
    private static class Holder {            // 静态内部类，懒加载 + 线程安全
        static final Singleton INSTANCE = new Singleton();
    }
    public static Singleton getInstance() { return Holder.INSTANCE; }
}
// 原理：Holder 类在首次调用 getInstance() 时才被加载初始化（类加载机制保证线程安全）

// 应用 3：Map.Entry（JDK 源码）
public interface Map<K,V> {
    interface Entry<K,V> {                   // 接口中的嵌套接口（隐式 public static）
        K getKey();
        V getValue();
        V setValue(V value);
    }
}

// 应用 4：DTO/VO 分组
public class OrderResponse {
    private String orderNo;
    private List<Item> items;

    public static class Item {               // 响应的嵌套结构
        private String productName;
        private int quantity;
        // getter/setter
    }
}
```

### 3.4 局部内部类（Local Inner Class）

```java
public class Outer {
    private int outerVar = 10;

    public void method() {
        final int localVar = 20;             // 局部变量
        int effectivelyFinal = 30;           // JDK 8+：事实上 final（未再赋值）

        // 局部内部类：定义在方法内，作用域仅限于该方法
        class LocalInner {
            public void show() {
                System.out.println(outerVar);          // ✅ 访问外部类成员
                System.out.println(localVar);          // ✅ 访问 final 局部变量
                System.out.println(effectivelyFinal);  // ✅ JDK 8+ 访问 effectively final
                // 如果 localVar 之后被重新赋值，这里就编译错误
            }
        }

        LocalInner li = new LocalInner();
        li.show();
        // 局部内部类不能用 public/private/protected/static 修饰
    }
}
```

> **为什么局部内部类只能访问 final（或 effectively final）的局部变量？**
>
> 局部变量存在**栈**中，方法执行完栈帧就销毁了；而局部内部类的对象可能存在**堆**中，生命周期更长。为了让内部类对象仍能访问该变量，编译器会把变量的**值拷贝**一份到内部类中。如果变量可变，就会出现「外部改了但内部类副本没改」的数据不一致。所以 Java 强制要求这些变量是 final（或事实上 final），保证拷贝的值和原值永远一致。

### 3.5 匿名内部类（Anonymous Inner Class）

**没有类名的一次性内部类，常用于实现接口/继承类的临时实例。**

```java
// 场景 1：实现接口
Runnable task = new Runnable() {              // 匿名实现 Runnable
    @Override
    public void run() {
        System.out.println("线程运行");
    }
};
new Thread(task).start();

// JDK 8+ 用 Lambda 替代（函数式接口才能用）
Runnable task2 = () -> System.out.println("线程运行");
new Thread(task2).start();

// 场景 2：继承抽象类（Lambda 不能替代，因为有多个抽象方法或有状态）
AbstractExporter exporter = new AbstractExporter() {
    @Override protected List<?> queryData(ExportParam p) { return null; }
    @Override protected List<List<String>> transform(List<?> data) { return null; }
    @Override protected String writeToFile(List<List<String>> rows, ExportParam p) { return null; }
};

// 场景 3：事件监听（Swing/Android 经典）
button.addActionListener(new ActionListener() {
    @Override
    public void actionPerformed(ActionEvent e) {
        System.out.println("按钮被点击");
    }
});
// Lambda 版
button.addActionListener(e -> System.out.println("按钮被点击"));

// 场景 4：创建带额外方法的一次性对象（双括号初始化，⚠️ 反模式）
List<String> list = new ArrayList<String>() {{   // 匿名子类 + 实例代码块
    add("a");
    add("b");
}};
// ❌ 不推荐：创建了 ArrayList 的匿名子类，持有外部引用，且序列化/反射出问题
// ✅ 推荐：List.of("a","b")（JDK 9+）或 Arrays.asList 或 Stream
```

**匿名内部类的编译产物：**

```java
// 源码中的匿名内部类会被编译成 Outer$1.class、Outer$2.class（数字编号）
Outer.java → Outer.class, Outer$1.class, Outer$2.class
```

**匿名内部类 vs Lambda：**

| 对比 | 匿名内部类 | Lambda |
| --- | --- | --- |
| 适用 | 任意接口/抽象类 | **仅函数式接口**（单抽象方法） |
| 编译产物 | 生成独立的 `.class` 文件（`Outer$1`） | 不生成 class，用 `invokedynamic` 运行时生成 |
| this 指向 | **匿名类实例自己** | **外部类实例**（Lambda 不引入新作用域） |
| 性能 | 每次 new 一个对象 | 可被 JVM 缓存复用（无状态时） |
| 变量捕获 | final / effectively final | 同 |
| 多方法/有状态 | ✅ 支持 | ❌ 不支持 |

```java
// this 指向的差异（重要）
public class ThisDemo {
    private String name = "外部类";

    public void test() {
        // 匿名内部类：this 指向匿名类实例
        Runnable r1 = new Runnable() {
            private String name = "匿名类";
            public void run() {
                System.out.println(this.name);            // "匿名类"
                System.out.println(ThisDemo.this.name);   // "外部类"（显式引用外部）
            }
        };
        // Lambda：this 指向外部类（Lambda 没有自己的 this）
        Runnable r2 = () -> {
            System.out.println(this.name);                // "外部类"！
        };
    }
}
```

### 3.6 内部类的选型建议

| 需求 | 选择 |
| --- | --- |
| 需要访问外部类实例状态，且生命周期与外部对象绑定 | 成员内部类（谨慎，注意内存泄漏） |
| 逻辑辅助类，不需要外部实例（Builder、Holder、工具） | **静态内部类（首选）** |
| 一次性、临时的接口实现（无多方法/无状态） | **Lambda（首选）** 或匿名内部类 |
| 需要多方法或有状态的一次性实现 | 匿名内部类 |
| 方法内的临时辅助逻辑 | 局部内部类（几乎不用，改为私有方法或 Lambda） |

> 【强制】《Effective Java》第 24 条：**优先使用静态成员类，非静态成员类会隐式持有外部引用，除非确实需要访问外部实例。**

## 4. 关键字深度解析

### 4.1 final 全景

```java
// 1. final 修饰变量 → 值不可变（只能赋值一次）
final int MAX = 100;                    // 常量（编译期常量，会内联）
final User user = new User();
user.setName("Tom");                    // ✅ 可改对象内容
// user = new User();                   // ❌ 不可改引用

final int x;                            // 空白 final（blank final）
// 必须在使用前赋值（构造器或实例代码块中）
public MyClass() { this.x = 10; }

// final 修饰引用类型：引用不变，对象可变 → 想要真不可变需字段也 final + 无 setter
final List<String> list = new ArrayList<>();
list.add("a");                          // ✅ 允许

// 2. final 修饰方法 → 不能被子类重写
public final void lock() { }
// 子类：void lock() { }                // ❌ 编译错误

// 3. final 修饰类 → 不能被继承
public final class ImmutableString { }
// class Sub extends ImmutableString { }// ❌ 编译错误

// 4. final 修饰方法参数 → 方法内不能重新赋值
public void process(final String input) {
    // input = "other";                 // ❌
}

// 5. final 修饰局部变量 → 只能赋值一次
final int localVar = 5;
```

**final、finally、finalize 三兄弟（必考）：**

| | 是什么 | 作用 | 状态 |
| --- | --- | --- | --- |
| `final` | 修饰符 | 修饰类/方法/变量，表示不可继承/不可重写/不可重新赋值 | 正常使用 |
| `finally` | 关键字 | try-catch-finally 的一部分，**一定执行**的清理代码 | 正常使用 |
| `finalize` | Object 的方法 | GC 回收对象前调用一次 | **JDK 9 废弃，禁用** |

**不可变对象（Immutable Object）的设计：**

```java
// 不可变对象的 5 个条件
public final class Money {              // 1. 类 final，防止子类破坏不可变性
    private final long amount;           // 2. 所有字段 private final
    private final String currency;       // 3. 无 setter
    private final BigDecimal value;      // 可变引用类型需特殊处理

    public Money(long amount, String currency) {
        this.amount = amount;
        this.currency = currency;
        this.value = new BigDecimal(amount);
    }

    public long getAmount() { return amount; }
    public String getCurrency() { return currency; }

    // 4. getter 返回可变对象时要做防御性拷贝
    public BigDecimal getValue() {
        return value;                    // BigDecimal 本身不可变，可直接返回
    }

    // 5. 「修改」操作返回新对象，不改自身
    public Money add(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("币种不一致");
        }
        return new Money(this.amount + other.amount, this.currency);   // 返回新对象
    }
}
// JDK 中的不可变类：String、Integer 等包装类、LocalDate/LocalDateTime、BigInteger、Optional
```

**不可变对象的好处：**
1. **天生线程安全**：状态不变，多线程可自由共享，无需同步。
2. **可安全作为 HashMap 的 key**：hashCode 不变。
3. **可缓存/享元**：`Integer.valueOf` 缓存池、`String` 常量池。
4. **失败原子性**：方法要么成功返回新对象，要么抛异常，原对象不变。

### 4.2 static 全景

见 [[后端/Java基础/面向对象基础]] 第 7 节。补充静态导入：

```java
// 静态导入：省去类名前缀
import static java.lang.Math.*;              // 导入 Math 所有静态成员
import static org.junit.jupiter.api.Assertions.*;   // 测试常用
import static java.util.stream.Collectors.toList;   // 单个导入

// 使用
double r = sqrt(pow(3, 2) + pow(4, 2));     // 无需 Math.sqrt、Math.pow
assertEquals(1, 1);                          // 无需 Assertions.assertEquals
list.stream().collect(toList());             // 无需 Collectors.toList
```

> 【规范】静态导入过度使用会降低可读性（不知道方法来自哪里）。**建议只对常量类、断言、Collectors 等高频工具静态导入**，业务代码少用。

### 4.3 transient

```java
// transient：修饰的字段不参与序列化
public class User implements Serializable {
    private String name;                     // 会被序列化
    private transient String password;       // 不会被序列化（敏感信息）
    private transient Socket socket;         // 不可序列化的资源字段
}

User u = new User("Tom", "123456");
// 序列化后再反序列化：name="Tom"，password=null（被跳过）
```

> **transient 的作用**：告诉 JVM 序列化时跳过该字段。用于：密码、密钥等敏感数据；不可序列化的对象（如 `Connection`、`Thread`）；可重新计算的缓存字段。
>
> 【坑】`static` 字段本身就不参与序列化（属于类不属于对象），所以 `static transient` 中 transient 是多余的。

## 5. 枚举的深度应用（承上启下）

枚举的完整讲解见 [[后端/Java基础/泛型枚举与注解]]，这里给出与 OOP 结合的高级用法。

```java
/**
 * 枚举 + 抽象方法 = 每个枚举值有自己的行为（多态）
 * 这是替代 if-else / switch 的利器
 */
public enum Operation {
    PLUS("+") {
        @Override public double apply(double x, double y) { return x + y; }
    },
    MINUS("-") {
        @Override public double apply(double x, double y) { return x - y; }
    },
    TIMES("*") {
        @Override public double apply(double x, double y) { return x * y; }
    },
    DIVIDE("/") {
        @Override public double apply(double x, double y) {
            if (y == 0) throw new ArithmeticException("除数不能为 0");
            return x / y;
        }
    };

    private final String symbol;
    Operation(String symbol) { this.symbol = symbol; }
    public String getSymbol() { return symbol; }

    public abstract double apply(double x, double y);    // 抽象方法，每个值必须实现
}

// 使用：无需 switch！
double result = Operation.PLUS.apply(3, 5);       // 8.0
for (Operation op : Operation.values()) {
    System.out.printf("3 %s 5 = %.1f%n", op.getSymbol(), op.apply(3, 5));
}
```

**枚举实现策略模式（替代大量 if-else）：**

```java
public enum PayChannel {
    ALIPAY {
        @Override public PayResult doPay(Order order) {
            return alipayClient.pay(order.getAmount());
        }
        @Override public boolean supportRefund() { return true; }
    },
    WECHAT {
        @Override public PayResult doPay(Order order) {
            return wechatClient.pay(order.getAmount());
        }
        @Override public boolean supportRefund() { return true; }
    },
    BALANCE {
        @Override public PayResult doPay(Order order) {
            return balanceService.deduct(order.getUserId(), order.getAmount());
        }
        @Override public boolean supportRefund() { return false; }   // 余额支付不支持退款
    };

    public abstract PayResult doPay(Order order);
    public abstract boolean supportRefund();
}

// 调用（消除 switch）
PayResult result = PayChannel.valueOf(channelStr).doPay(order);
```

**枚举携带状态和查表：**

```java
public enum OrderStatus {
    PENDING(1, "待支付"),
    PAID(2, "已支付"),
    SHIPPED(3, "已发货"),
    COMPLETED(4, "已完成"),
    CANCELLED(5, "已取消");

    private final int code;
    private final String desc;

    // 静态 Map 缓存，用于 O(1) 反查（避免每次 values() 遍历）
    private static final Map<Integer, OrderStatus> CODE_MAP =
        Arrays.stream(values()).collect(Collectors.toMap(OrderStatus::getCode, s -> s));

    OrderStatus(int code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public int getCode() { return code; }
    public String getDesc() { return desc; }

    public static OrderStatus ofCode(int code) {
        OrderStatus status = CODE_MAP.get(code);
        if (status == null) {
            throw new IllegalArgumentException("未知状态码：" + code);
        }
        return status;
    }
}
```

> 【强制】阿里手册：**枚举类名带 Enum 后缀，枚举成员名称全大写、下划线分隔**；**如果某个值只在一个地方使用，用常量而非枚举**；**枚举可以直接比较（==），比 equals 更快更安全（null 安全）**。

## 6. 综合案例：用 OOP 设计一个通知系统

```java
/**
 * 通知系统：演示接口 + 抽象类 + 多态 + 枚举 + 静态内部类的综合运用
 */

// 1. 接口定义契约（能力声明）
public interface NotificationSender {
    /** 发送通知 */
    SendResult send(Notification notification);

    /** 支持的渠道类型 */
    ChannelType supportChannel();

    /** 是否可用（健康检查）*/
    default boolean isAvailable() { return true; }
}

// 2. 枚举定义渠道类型（携带行为）
public enum ChannelType {
    SMS("短信") {
        @Override public int maxContentLength() { return 70; }
    },
    EMAIL("邮件") {
        @Override public int maxContentLength() { return 65535; }
    },
    WECHAT("微信") {
        @Override public int maxContentLength() { return 2048; }
    };

    private final String desc;
    ChannelType(String desc) { this.desc = desc; }
    public String getDesc() { return desc; }
    public abstract int maxContentLength();    // 每个渠道不同限制（多态）
}

// 3. 抽象类提供模板骨架（含公共状态和流程）
public abstract class AbstractNotificationSender implements NotificationSender {

    protected final NotificationConfig config;      // 抽象类才能持有状态字段

    protected AbstractNotificationSender(NotificationConfig config) {
        this.config = config;
    }

    /** 模板方法：定义「校验 → 限流 → 发送 → 记录」的固定流程 */
    @Override
    public final SendResult send(Notification notification) {
        try {
            validate(notification);                 // 公共校验
            if (!checkRateLimit(notification)) {    // 公共限流
                return SendResult.fail("触发限流");
            }
            SendResult result = doSend(notification);   // 抽象：子类实现真正的发送
            record(notification, result);           // 公共记录日志
            return result;
        } catch (Exception e) {
            return SendResult.fail("发送异常：" + e.getMessage());
        }
    }

    /** 抽象方法：各渠道的具体发送逻辑 */
    protected abstract SendResult doSend(Notification notification);

    /** 公共校验逻辑 */
    protected void validate(Notification notification) {
        if (notification.getContent() == null) {
            throw new IllegalArgumentException("内容不能为空");
        }
        int max = supportChannel().maxContentLength();
        if (notification.getContent().length() > max) {
            throw new IllegalArgumentException("内容超过 " + max + " 字");
        }
    }

    /** 钩子方法：默认放行，子类可重写 */
    protected boolean checkRateLimit(Notification notification) { return true; }

    protected void record(Notification n, SendResult r) {
        System.out.printf("[%s] 发送%s：%s%n",
            supportChannel().getDesc(), r.isSuccess() ? "成功" : "失败", n.getTarget());
    }
}

// 4. 具体实现类
public class SmsSender extends AbstractNotificationSender {
    public SmsSender(NotificationConfig config) { super(config); }

    @Override protected SendResult doSend(Notification n) {
        // 调用短信网关 API
        System.out.println("调用短信网关 → " + n.getTarget());
        return SendResult.ok();
    }
    @Override public ChannelType supportChannel() { return ChannelType.SMS; }
}

public class EmailSender extends AbstractNotificationSender {
    public EmailSender(NotificationConfig config) { super(config); }

    @Override protected SendResult doSend(Notification n) {
        System.out.println("调用 SMTP 发送邮件 → " + n.getTarget());
        return SendResult.ok();
    }
    @Override protected boolean checkRateLimit(Notification n) {
        return n.getTarget().contains("@");     // 重写钩子：邮箱格式校验
    }
    @Override public ChannelType supportChannel() { return ChannelType.EMAIL; }
}

// 5. 值对象：用静态内部类做 Builder
public class Notification {
    private final String target;
    private final String title;
    private final String content;
    private final ChannelType channel;

    private Notification(Builder builder) {
        this.target = builder.target;
        this.title = builder.title;
        this.content = builder.content;
        this.channel = builder.channel;
    }

    public String getTarget() { return target; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public ChannelType getChannel() { return channel; }

    public static Builder builder(ChannelType channel, String target) {
        return new Builder(channel, target);
    }

    public static class Builder {               // 静态内部类（不持有外部引用）
        private final ChannelType channel;
        private final String target;
        private String title = "";
        private String content;

        private Builder(ChannelType channel, String target) {
            this.channel = channel;
            this.target = target;
        }
        public Builder title(String title) { this.title = title; return this; }
        public Builder content(String content) { this.content = content; return this; }
        public Notification build() {
            Objects.requireNonNull(content, "content 不能为空");
            return new Notification(this);
        }
    }
}

// 6. 结果对象（不可变 + 静态工厂）
public class SendResult {
    private final boolean success;
    private final String message;

    private SendResult(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
    public static SendResult ok() { return new SendResult(true, "OK"); }
    public static SendResult fail(String msg) { return new SendResult(false, msg); }
    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
}

// 7. 简单配置类
public class NotificationConfig {
    private String apiKey;
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
}

// 8. 工厂：根据渠道路由到对应 sender（面向接口 + 多态）
public class NotificationSenderFactory {
    private final Map<ChannelType, NotificationSender> senders = new EnumMap<>(ChannelType.class);

    public NotificationSenderFactory(NotificationConfig config) {
        register(new SmsSender(config));
        register(new EmailSender(config));
    }

    private void register(NotificationSender sender) {
        senders.put(sender.supportChannel(), sender);
    }

    public NotificationSender getSender(ChannelType channel) {
        NotificationSender sender = senders.get(channel);
        if (sender == null) {
            throw new IllegalArgumentException("不支持的渠道：" + channel);
        }
        return sender;
    }
}

// 9. 客户端调用（完全面向接口，新增渠道无需改这里）
public class NotificationDemo {
    public static void main(String[] args) {
        NotificationConfig config = new NotificationConfig();
        NotificationSenderFactory factory = new NotificationSenderFactory(config);

        // 批量发送：用多态统一处理
        List<Notification> notifications = List.of(
            Notification.builder(ChannelType.SMS, "13800138000").content("您的验证码是 1234").build(),
            Notification.builder(ChannelType.EMAIL, "tom@example.com").title("欢迎").content("欢迎注册").build()
        );

        for (Notification n : notifications) {
            NotificationSender sender = factory.getSender(n.getChannel());   // 多态
            SendResult result = sender.send(n);                              // 模板方法执行
            System.out.println("结果：" + result.getMessage());
        }
    }
}
```

**这个案例用到的 OOP 知识点：**

| 知识点 | 体现 |
| --- | --- |
| 接口定义契约 | `NotificationSender`（能力声明，支持多渠道扩展） |
| 抽象类模板方法 | `AbstractNotificationSender.send()` 固定流程骨架 |
| 钩子方法 | `checkRateLimit()` 默认放行，`EmailSender` 重写 |
| 多态 | `sender.send(n)` 运行时决定调用哪个实现 |
| 枚举携带行为 | `ChannelType.maxContentLength()` 每渠道不同 |
| 静态内部类 Builder | `Notification.Builder`（不持有外部引用） |
| 不可变对象 | `Notification`、`SendResult` 字段 final + 无 setter |
| 静态工厂方法 | `SendResult.ok()` / `SendResult.fail()` |
| 工厂模式 + EnumMap | `NotificationSenderFactory` 用 EnumMap 高效路由 |
| 面向接口编程 | 客户端只依赖 `NotificationSender` 接口 |
| 防御性设计 | `Objects.requireNonNull`、参数校验、异常处理 |

## 7. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 成员内部类持有外部引用 | 内存泄漏 | 不需要外部实例就用 `static` |
| 2 | 匿名内部类捕获非 final 变量 | 编译错误 | 变量声明为 final 或 effectively final |
| 3 | 匿名内部类的 this | 指向匿名类而非外部类 | 用 `Outer.this` 或改 Lambda |
| 4 | 双括号初始化 | 创建匿名子类，序列化/引用问题 | 用 `List.of` / `Arrays.asList` |
| 5 | 多接口 default 冲突 | 编译错误 | 重写并 `A.super.method()` 指定 |
| 6 | 接口当常量容器 | 污染实现类 API | 用枚举或 final 工具类 |
| 7 | abstract + private/static/final 方法 | 编译错误 | 抽象方法必须可被重写 |
| 8 | 抽象类被实例化 | 编译错误 | 只能实例化具体子类 |
| 9 | 子类未实现全部抽象方法 | 编译错误 | 实现或声明为抽象类 |
| 10 | 违反里氏替换 | 子类替换父类后行为异常 | 重新审视 is-a 关系（正方形≠长方形） |
| 11 | 构造器调用可重写方法 | 子类字段未初始化，NPE | 构造器只调 private/final/static 方法 |
| 12 | 静态内部类访问外部实例字段 | 编译错误 | 静态内部类只能访问外部静态成员 |
| 13 | `Outer.Inner` 创建方式错 | 编译错误 | 成员内部类用 `outer.new Inner()` |
| 14 | default 方法滥用 | 接口臃肿、逻辑分散 | default 只用于接口演化和简单公共逻辑 |
| 15 | 过度使用继承 | 脆弱基类、层次过深 | 组合优先，继承层次 ≤ 3 |
| 16 | Lambda 用于非函数式接口 | 编译错误 | 只有单抽象方法接口能用 Lambda |
| 17 | 静态导入过多 | 可读性差 | 只对常量、断言等高频工具静态导入 |

---

## 关联笔记

- 上一篇：[[后端/Java基础/面向对象基础]]
- 下一篇：[[后端/Java基础/常用类与API]]
- 相关：[[后端/Java基础/泛型枚举与注解]]（枚举完整讲解）、[[后端/Java基础/Java8新特性-Lambda与Stream]]（Lambda 替代匿名内部类）
- 应用：[[后端/Spring/AOP面向切面编程]]、[[后端/Spring/Spring概述与IoC容器]]（面向接口 + 依赖倒置）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
