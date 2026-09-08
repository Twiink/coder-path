---
title: "基础语法与数据类型"
aliases:
  - "Java 基本数据类型"
  - "Java 变量与常量"
tags:
  - "后端"
  - "java"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/Java语言概述与开发环境]]"
  - "[[后端/Java基础/运算符与流程控制]]"
  - "[[后端/Java基础/常用类与API]]"
  - "[[后端/JVM/JVM概述与运行时数据区]]"
created: 2026-09-06
updated: 2026-09-06
---

# 基础语法与数据类型

## 1. Java 代码的基本结构

一个标准 Java 源文件的组成顺序：

```java
package com.example.demo;              // 1. 包声明（只能有一个，必须第一行）

import java.util.List;                 // 2. 导入语句（可多个）
import java.util.ArrayList;

/**
 * 3. 类文档注释
 */
public class Demo {                    // 4. 类声明（public 类必须与文件同名）

    // 4.1 静态变量（类变量）
    private static final int MAX = 100;
    static int counter = 0;

    // 4.2 实例变量（成员变量）
    private String name;
    int age;                           // 包级私有

    // 4.3 静态代码块（类加载时执行一次）
    static {
        System.out.println("静态代码块");
    }

    // 4.4 实例代码块（每次 new 对象时执行，在构造器之前）
    {
        System.out.println("实例代码块");
    }

    // 4.5 构造方法
    public Demo() { }
    public Demo(String name) { this.name = name; }

    // 4.6 实例方法
    public void show() { }

    // 4.7 静态方法
    public static void main(String[] args) { }

    // 4.8 内部类
    static class Inner { }
}
```

**代码执行顺序（高频面试题）：**

```
父类静态变量/静态代码块 → 子类静态变量/静态代码块   （类加载初始化，仅一次）
      ↓ new 对象时
父类实例变量/实例代码块 → 父类构造器
      ↓
子类实例变量/实例代码块 → 子类构造器
```

> 精确顺序：静态部分在 `<clinit>()` 中按代码书写顺序执行；实例部分在 `<init>()` 中执行，且**实例变量的显式赋值和实例代码块会被编译器搬到构造器中 `super()` 之后**，按书写顺序执行。

## 2. 标识符与关键字

### 2.1 关键字（50 个）

| 分类 | 关键字 |
| --- | --- |
| 访问修饰符 | `public` `protected` `private` |
| 类/接口/枚举 | `class` `interface` `enum` `record`（JDK 16+） `extends` `implements` |
| 包 | `package` `import` |
| 数据类型 | `byte` `short` `int` `long` `float` `double` `char` `boolean` `void` |
| 流程控制 | `if` `else` `switch` `case` `default` `for` `while` `do` `break` `continue` `return` |
| 修饰符 | `static` `final` `abstract` `synchronized` `volatile` `transient` `native` `strictfp` |
| 异常 | `try` `catch` `finally` `throw` `throws` `assert` |
| 对象 | `new` `this` `super` `instanceof` |
| 其他 | `goto`（保留未用） `const`（保留未用） |

**JDK 9+ 新增的「受限关键字」（contextual keywords）**：`var`、`yield`、`sealed`、`permits`、`non-sealed`、`module`、`requires`、`exports`、`opens`、`uses`、`provides`、`with`、`to`、`transitive`、`open`。这些词在特定上下文有关键字含义，但**仍可作为标识符使用**（`String var = "x";` 合法但不推荐）。

> 【强制】`true`、`false`、`null` 不是关键字，是**字面量**（literal）。

### 2.2 标识符命名规则

**硬性规则（编译器检查）：**
1. 由字母、数字、下划线 `_`、美元符号 `$` 组成（字母包含 Unicode 字符，所以**中文可以做标识符**）。
2. **不能以数字开头**。
3. **不能是关键字**（`int`、`class` 等）。
4. 严格区分大小写（`name` 与 `Name` 是两个标识符）。
5. 不能包含空格和 `-`。

```java
int userName = 1;      // ✅
int _count = 1;        // ✅ 下划线开头（不推荐）
int $amount = 1;       // ✅ 美元符号（编译器生成的内部类会用，如 Outer$Inner）
int user_name = 1;     // ✅ 但不符合 Java 驼峰规范
int 用户名 = 1;         // ✅ 语法合法，绝对不要这么写
int 2ndPlace = 1;      // ❌ 数字开头
int user-name = 1;     // ❌ 含减号
int class = 1;         // ❌ 关键字
```

> 【坑】JDK 21 中单独的 `_` 是**未命名变量**（unnamed variable），不能用作普通标识符：`int _ = 5;` 会报错。

**命名规范（阿里手册）：**

| 类型 | 规范 | 示例 |
| --- | --- | --- |
| 类名 | 大驼峰 UpperCamelCase | `UserServiceImpl`、`HttpUtil` |
| 方法名 | 小驼峰 lowerCamelCase | `getUserById`、`isValid` |
| 变量名 | 小驼峰 | `userName`、`orderCount` |
| 常量名 | 全大写 + 下划线 | `MAX_RETRY_COUNT`、`DEFAULT_CHARSET` |
| 包名 | 全小写，点分隔，单数 | `com.alibaba.trade.util` |
| 抽象类 | `Abstract`/`Base` 前缀 | `AbstractProcessor` |
| 异常类 | `Exception` 后缀 | `BusinessException` |
| 测试类 | `Test` 后缀 | `UserServiceTest` |
| 接口实现 | `Impl` 后缀 | `UserServiceImpl` |
| 数组声明 | 类型后加括号 | `int[] arr`（推荐），而非 `int arr[]` |
| 布尔变量 | 不加 `is` 前缀（POJO） | `Boolean deleted` |

**领域模型命名约定：**

| 后缀 | 含义 | 示例 |
| --- | --- | --- |
| DTO | Data Transfer Object，传输对象 | `UserDTO` |
| VO | View Object，视图对象 | `UserVO` |
| PO/DO | Persistent Object，持久化对象 | `UserPO` |
| BO | Business Object，业务对象 | `OrderBO` |
| Query | 查询条件封装 | `UserQuery` |
| Form | 表单对象 | `LoginForm` |
| Response | 响应包装 | `OrderResponse` |

## 3. 变量与常量

### 3.1 变量的分类

| 分类维度 | 类型 | 存储位置 | 生命周期 | 默认值 |
| --- | --- | --- | --- | --- |
| 按修饰符 | 局部变量（方法内） | **虚拟机栈**的局部变量表 | 方法执行期间 | **无默认值，必须初始化** |
| | 成员变量（实例变量） | **堆**中对象内 | 与对象相同 | 有默认值 |
| | 静态变量（类变量） | JDK 8 前方法区，**JDK 8+ 堆** | 与类相同（类卸载才销毁） | 有默认值 |
| 按数据类型 | 基本类型变量 | 存**值本身** | — | 零值 |
| | 引用类型变量 | 存**对象地址**（引用） | — | `null` |

```java
public class VariableDemo {
    static int staticVar;          // 静态变量，默认 0
    int instanceVar;               // 成员变量，默认 0
    String refVar;                 // 引用类型成员变量，默认 null

    public void method() {
        int localVar;              // 局部变量，无默认值
        // System.out.println(localVar);  // ❌ 编译错误：可能尚未初始化
        localVar = 10;             // 必须先赋值才能用
        System.out.println(localVar);
    }

    public static void main(String[] args) {
        VariableDemo demo = new VariableDemo();
        System.out.println(demo.staticVar);    // 0
        System.out.println(demo.instanceVar);  // 0
        System.out.println(demo.refVar);       // null
    }
}
```

**【面试】成员变量与局部变量的区别？**

| 对比项 | 成员变量 | 局部变量 |
| --- | --- | --- |
| 位置 | 类中方法外 | 方法内、方法参数、代码块内 |
| 内存 | 堆（随对象）；静态变量 JDK 8+ 也在堆 | 栈（栈帧的局部变量表） |
| 生命周期 | 随对象创建/回收 | 随方法调用开始/结束 |
| 默认值 | 有（数值 0、布尔 false、引用 null） | 无，必须显式初始化 |
| 修饰符 | 可用 public/private/static/final 等 | 只能用 final（不能有访问修饰符和 static） |

### 3.2 常量与 final

```java
// 字面量常量
final int MAX = 100;               // 编译期常量（值在编译时确定）
final String NAME = "Tom";         // 编译期常量
final double PI = 3.14;

// 引用类型 final：引用不可变，对象内容可变
final List<String> list = new ArrayList<>();
list.add("a");                     // ✅ 允许，修改的是对象内容
// list = new ArrayList<>();       // ❌ 编译错误，不能重新赋值

// 静态常量（真正的「常量」）
public static final String APP_NAME = "Mall";

// final 修饰方法：不能被重写
public final void doSth() { }

// final 修饰类：不能被继承（String 就是 final 类）
public final class ImmutableUtil { }

// final 修饰方法参数：方法内不能修改
public void process(final String input) {
    // input = "other";            // ❌
}
```

**final、finally、finalize 的区别（经典面试题）：**

| | 作用 | 类型 |
| --- | --- | --- |
| `final` | 修饰类（不可继承）、方法（不可重写）、变量（不可重新赋值） | 修饰符 |
| `finally` | 异常处理中**一定执行**的代码块（除 `System.exit()`、JVM 崩溃、守护线程被杀） | 关键字，配合 try-catch |
| `finalize` | `Object` 的方法，GC 回收对象前调用；**JDK 9 已废弃，禁止使用** | 方法 |

> 【坑】`finalize()` 的问题：执行时机不确定、可能导致对象复活、性能差、GC 需要两轮才能回收。**永远不要用**，资源清理用 `try-with-resources` 或 `Cleaner`（JDK 9+）。

**编译期常量与运行期常量：**

```java
final int a = 10;                  // 编译期常量，会被内联替换
final int b = new Random().nextInt(); // 运行期才确定，不是编译期常量
final String s = "he" + "llo";     // 编译期常量，编译器直接优化为 "hello"

// 编译期常量内联的经典陷阱
class Config {
    public static final String VERSION = "1.0";
}
class App {
    public static void main(String[] args) {
        System.out.println(Config.VERSION);  // 编译后变成 System.out.println("1.0")
    }
}
// 此时只替换 Config.class 的 VERSION 为 "2.0" 而不重新编译 App.class，
// App 输出的仍是 "1.0"！所以修改常量所在的 jar 后必须重新编译依赖它的代码。
```

### 3.3 变量声明与初始化

```java
// 单个声明
int age = 20;
String name = "Tom";

// 同时声明多个（不推荐，可读性差）
int a = 1, b = 2, c;

// 先声明后赋值
int score;
score = 95;

// JDK 10+ 局部变量类型推断 var（只能用于局部变量，且必须初始化）
var list = new ArrayList<String>();      // 推断为 ArrayList<String>
var map = new HashMap<String, Integer>(); // HashMap<String, Integer>
var stream = list.stream();               // Stream<String>
for (var i = 0; i < 10; i++) { }          // ✅ 可用于 for
try (var reader = Files.newBufferedReader(path)) { }  // ✅ try-with-resources
// var x;                ❌ 必须初始化
// var y = null;         ❌ 无法推断类型
// var z = () -> {};     ❌ Lambda 需要显式目标类型
// private var field;    ❌ 不能用于成员变量、方法参数、返回类型
```

> 【规范】`var` 适合右侧类型显而易见的场景（`new`、工厂方法、字面量），不适合 `var result = service.process(data);` 这种看不出类型的情况。

## 4. 八种基本数据类型

Java 是**强类型**语言，每个变量必须先声明类型。基本数据类型（primitive type）共 **4 类 8 种**：

### 4.1 整数类型

| 类型 | 占用字节 | 位数 | 取值范围 | 默认值 | 字面量示例 |
| --- | --- | --- | --- | --- | --- |
| `byte` | 1 | 8 | -128 ~ 127（-2⁷ ~ 2⁷-1） | 0 | `byte b = 10;` |
| `short` | 2 | 16 | -32768 ~ 32767（-2¹⁵ ~ 2¹⁵-1） | 0 | `short s = 100;` |
| **`int`** | 4 | 32 | -2147483648 ~ 2147483647（-2³¹ ~ 2³¹-1，约 ±21.4 亿） | 0 | `int i = 100;` |
| `long` | 8 | 64 | -2⁶³ ~ 2⁶³-1（约 ±922 亿亿） | 0L | `long l = 100L;` |

```java
int maxInt = Integer.MAX_VALUE;        // 2147483647
int minInt = Integer.MIN_VALUE;        // -2147483648
long maxLong = Long.MAX_VALUE;         // 9223372036854775807

// 整数字面量默认是 int 类型
long a = 2147483648L;          // ✅ 必须加 L（大写，小写 l 易与 1 混淆）
long b = 2147483648;           // ❌ 编译错误：整数过大

// 溢出演示（重要！）
int c = Integer.MAX_VALUE;
System.out.println(c + 1);     // -2147483648  ← 溢出回绕，不报错！
System.out.println(c * 2);     // -2

// 大数运算的正确姿势
long d = (long) Integer.MAX_VALUE * 2;    // ✅ 先转 long 再运算 → 4294967294
long e = Integer.MAX_VALUE * 2L;          // ✅ 同上
BigDecimal f = new BigDecimal("1.0");     // 精确小数运算

// JDK 8+ 精确运算（溢出抛异常而非静默回绕）
Math.addExact(Integer.MAX_VALUE, 1);      // 抛 ArithmeticException
Math.multiplyExact(100000, 100000);       // 抛 ArithmeticException
```

> 【坑】**整数溢出是生产事故高发区**。经典案例：`(int) 毫秒时间戳` 溢出、分页 `offset = pageNo * pageSize` 溢出、金额以「分」为单位存 int 溢出。**解决**：金额一律 `BigDecimal`（分为单位用 `long`）；乘法前判断范围或用 `Math.multiplyExact`；数据库对应字段用 `BIGINT`。

**进制字面量（JDK 7+）：**

```java
int dec = 100;             // 十进制
int oct = 0144;            // 八进制，0 开头 → 100
int hex = 0x64;            // 十六进制，0x/0X 开头 → 100
int bin = 0b1100100;       // 二进制，0b/0B 开头 → 100

// JDK 7+ 数字下划线分隔（提高可读性，位置有讲究）
int million = 1_000_000;           // ✅
long card = 6222_0212_3456_7890L;  // ✅
int bad1 = _1000;                  // ❌ 开头
int bad2 = 1000_;                  // ❌ 结尾
double bad3 = 3._14;               // ❌ 小数点前
double bad4 = 1_0.0_1;             // ✅
int bad5 = 0x_52;                  // ❌ 进制前缀后
```

### 4.2 浮点类型

| 类型 | 占用字节 | 位数 | 精度（有效数字） | 取值范围 | 默认值 |
| --- | --- | --- | --- | --- | --- |
| `float` | 4 | 32 | **约 7 位** | ±3.4E38 | 0.0f |
| **`double`** | 8 | 64 | **约 15~16 位** | ±1.8E308 | 0.0d |

```java
// 浮点字面量默认是 double，赋给 float 必须加 f/F
float f = 3.14f;           // ✅
float f2 = 3.14;           // ❌ 编译错误：可能损失精度
double d = 3.14;           // ✅
double d2 = 3.14D;         // ✅

// 科学计数法
double e1 = 1.5e3;         // 1500.0
double e2 = 1.5e-3;        // 0.0015

// 特殊值
double inf = Double.POSITIVE_INFINITY;   // 正无穷
double ninf = Double.NEGATIVE_INFINITY;  // 负无穷
double nan = Double.NaN;                 // 非数字

System.out.println(1.0 / 0);      // Infinity（浮点除 0 不抛异常！）
System.out.println(0.0 / 0);      // NaN
System.out.println(nan == nan);   // false！NaN 与任何值（含自己）都不相等
System.out.println(Double.isNaN(nan));  // true，正确的判断方式
System.out.println(Double.isInfinite(inf));  // true
```

**【重点】浮点数精度丢失（必考 + 必踩）：**

```java
System.out.println(0.1 + 0.2);            // 0.30000000000000004
System.out.println(0.1 + 0.2 == 0.3);     // false
System.out.println(1.0 - 0.9);            // 0.09999999999999998
System.out.println(2.0f - 1.1f);          // 0.8999996
System.out.println(1.0 / 3 * 3);          // 1.0000000000000002
```

**原因**：IEEE 754 标准用「尾数 × 2 的幂」表示小数，而 0.1、0.2 这样的十进制小数在二进制下是**无限循环**的（0.1 = 0.0001100110011...₂），存储时被截断，运算后误差累积。

**float 与 double 的存储结构（IEEE 754）：**

```
float (32位):  1位符号 | 8位指数(偏移127)  | 23位尾数
double(64位):  1位符号 | 11位指数(偏移1023) | 52位尾数
```

**正确方案 —— 用 BigDecimal：**

```java
// ❌ 错误：new BigDecimal(0.1) 传入 double，精度已经丢了
BigDecimal bad = new BigDecimal(0.1);
System.out.println(bad);
// 0.1000000000000000055511151231257827021181583404541015625

// ✅ 正确：用字符串构造
BigDecimal good = new BigDecimal("0.1");       // 0.1
BigDecimal good2 = BigDecimal.valueOf(0.1);    // 内部走 Double.toString，也正确

// 运算
BigDecimal a = new BigDecimal("0.1");
BigDecimal b = new BigDecimal("0.2");
System.out.println(a.add(b));                  // 0.3
System.out.println(a.subtract(b));             // -0.1
System.out.println(a.multiply(b));             // 0.02
System.out.println(a.divide(b, 2, RoundingMode.HALF_UP));  // 0.50（必须指定精度和舍入模式）

// 比较大小用 compareTo，不用 equals！
BigDecimal x = new BigDecimal("1.0");
BigDecimal y = new BigDecimal("1.00");
System.out.println(x.equals(y));         // false！equals 比较值和精度（scale）
System.out.println(x.compareTo(y) == 0); // true，compareTo 只比较数值
```

> 【强制】阿里手册规约：**禁止使用构造器 `BigDecimal(double)`**，用 `BigDecimal.valueOf(double)` 或字符串构造。
>
> 【强制】**金额运算全用 `BigDecimal`，且用字符串构造**；数据库字段用 `DECIMAL(16,2)`，禁止 `FLOAT`/`DOUBLE`。
>
> 【坑】`divide` 不指定精度遇到无限小数（如 1/3）会抛 `ArithmeticException: Non-terminating decimal expansion`，**必须传 scale 和 RoundingMode**。

**RoundingMode 舍入模式：**

| 枚举值 | 含义 | 示例（保留 1 位） |
| --- | --- | --- |
| `UP` | 远离零方向舍入（绝对值变大） | 1.15 → 1.2，-1.15 → -1.2 |
| `DOWN` | 趋向零方向舍入（截断） | 1.15 → 1.1 |
| `CEILING` | 向正无穷舍入 | 1.11 → 1.2，-1.19 → -1.1 |
| `FLOOR` | 向负无穷舍入 | 1.19 → 1.1，-1.11 → -1.2 |
| **`HALF_UP`** | **四舍五入**（≥5 进位），最常用 | 1.15 → 1.2，1.14 → 1.1 |
| `HALF_DOWN` | 五舍六入 | 1.15 → 1.1，1.16 → 1.2 |
| `HALF_EVEN` | 银行家舍入（四舍六入五成双） | 1.15 → 1.2，1.25 → 1.2 |
| `UNNECESSARY` | 断言无需舍入，否则抛异常 | — |

> 【坑】`HALF_EVEN`（银行家舍入）是金融行业标准，能减少大量累加时的系统性偏差。中国人民银行规范中利息计算常用此模式。

### 4.3 字符类型

| 类型 | 占用字节 | 位数 | 取值范围 | 默认值 |
| --- | --- | --- | --- | --- |
| `char` | 2 | 16 | 0 ~ 65535（**无符号**） | `\u0000`（空字符） |

```java
char c1 = 'A';               // 单个字符，用单引号
char c2 = '中';              // 中文占 1 个 char（BMP 范围内）
char c3 = 65;                // 数字赋值，等同 'A'（自动类型转换）
char c4 = '\u0041';          // Unicode 转义，等同 'A'
// char c5 = 'AB';           // ❌ 单引号只能一个字符
// String s = 'A';           // ❌ 单引号不能赋给 String

System.out.println(c1);              // A
System.out.println((int) c1);        // 65，char 转 int 得到码点
System.out.println(c1 + 1);          // 66，char 参与运算自动提升为 int
System.out.println((char)(c1 + 1));  // B

// 常用转义字符
char tab = '\t';         // 制表符
char nl = '\n';          // 换行
char cr = '\r';          // 回车
char bs = '\\';          // 反斜杠
char sq = '\'';          // 单引号
char dq = '\"';          // 双引号
char nul = '\0';         // 空字符（null character，不是 null）

// Emoji 需要 2 个 char（代理对 surrogate pair）
String emoji = "😀";
System.out.println(emoji.length());       // 2！不是 1
System.out.println(emoji.codePointCount(0, emoji.length()));  // 1，正确的字符数
```

> 【坑】`char` 是**无符号**的，这是 Java 中唯一无符号的基本类型。所以 `char` 可以表示 0~65535，而 `short` 是 -32768~32767。

### 4.4 布尔类型

| 类型 | 占用字节 | 取值 | 默认值 |
| --- | --- | --- | --- |
| `boolean` | JVM 未明确规定（单个通常按 4 字节处理，数组按 1 字节） | `true` / `false` | `false` |

```java
boolean flag = true;
boolean ok = (1 > 2);

// ❌ Java 不支持非 0 即真！这与 C/C++/Python 完全不同
// if (1) { }              // 编译错误
// boolean b = 1;          // 编译错误
// if (flag = true) { }    // 能编译但是坑：这是赋值不是比较，恒为 true

// JDK 规范：boolean 单独声明时编译为 int（用 0/1 表示），数组时编译为 byte 数组
```

> 【坑】`if (flag = true)` 是极隐蔽的 bug：`=` 是赋值，表达式值为 `true`，所以 if 恒成立，且把 flag 改了。IDEA 会给出警告「Condition 'flag = true' is always 'true'」。

### 4.5 八种类型速查总表

| 类型 | 关键字 | 字节 | 位数 | 范围 | 默认值 | 包装类 |
| --- | --- | --- | --- | --- | --- | --- |
| 字节 | `byte` | 1 | 8 | -128 ~ 127 | 0 | `Byte` |
| 短整型 | `short` | 2 | 16 | -32768 ~ 32767 | 0 | `Short` |
| 整型 | `int` | 4 | 32 | 约 ±21.4 亿 | 0 | `Integer` |
| 长整型 | `long` | 8 | 64 | 约 ±922 亿亿 | 0L | `Long` |
| 单精度浮点 | `float` | 4 | 32 | ±3.4E38，7 位精度 | 0.0f | `Float` |
| 双精度浮点 | `double` | 8 | 64 | ±1.8E308，15 位精度 | 0.0d | `Double` |
| 字符 | `char` | 2 | 16 | 0 ~ 65535（无符号） | `\u0000` | `Character` |
| 布尔 | `boolean` | 1 或 4 | — | true/false | false | `Boolean` |

**与数据库类型对应（MyBatis/JPA 映射时重要）：**

| Java | MySQL | 说明 |
| --- | --- | --- |
| `Long` | `BIGINT` | 主键 ID 推荐 |
| `Integer` | `INT` | 状态、数量 |
| `Short` | `SMALLINT` | 少用 |
| `Byte` | `TINYINT` | 状态枚举值 |
| `BigDecimal` | `DECIMAL(M,D)` | **金额必须** |
| `Double` | `DOUBLE` | 科学计算，禁用于金额 |
| `String` | `VARCHAR(n)` / `TEXT` | 长文本用 TEXT |
| `Boolean` | `TINYINT(1)` | MySQL 无原生布尔 |
| `LocalDate` | `DATE` | JDK 8+ |
| `LocalDateTime` | `DATETIME` | JDK 8+，推荐 |
| `LocalTime` | `TIME` | — |
| `byte[]` | `BLOB` | 二进制大对象 |

## 5. 类型转换

### 5.1 自动类型转换（隐式，小 → 大，安全）

```
byte → short → int → long → float → double
              ↑
             char
```

```java
byte b = 10;
int i = b;              // ✅ byte → int 自动
long l = i;             // ✅ int → long
float f = l;            // ✅ long → float（注意：可能丢精度，见下）
double d = f;           // ✅ float → double
char c = 'A';
int ci = c;             // ✅ char → int，得到 65

// 【坑】long → float 会丢精度！float 只有 23 位尾数，long 有 64 位
long bigLong = 1234567890123456789L;
float asFloat = bigLong;
System.out.println(asFloat);          // 1.2345679E18，末尾精度丢失
double asDouble = bigLong;
System.out.println(asDouble);         // 1.23456789012345677E18，也有损失但比 float 好
```

> **转换规则**：容量小的自动转容量大，但 `float` 的「容量」比 `long` 大（指数范围广）而精度低，所以 `long → float` 是自动转换却会丢精度。这是 Java 类型系统的一个历史遗留问题。

### 5.2 强制类型转换（显式，大 → 小，可能丢精度或溢出）

```java
double d = 3.99;
int i = (int) d;               // 3，直接截断小数部分（不是四舍五入！）

int big = 130;
byte b = (byte) big;           // -126，溢出回绕（130 - 256 = -126）

long l = 1000L;
int x = (int) l;               // 1000，安全但需显式

// 四舍五入
int rounded = (int) Math.round(3.99);   // 4
int rounded2 = (int) Math.round(3.4);   // 3

// 【坑】BigDecimal 转 int
BigDecimal bd = new BigDecimal("3.99");
int a1 = bd.intValue();                          // 3，截断
int a2 = bd.setScale(0, RoundingMode.HALF_UP).intValue();  // 4，四舍五入
int a3 = bd.add(new BigDecimal("0.5")).intValue();         // 4，土办法
```

**byte 溢出的原理（补码运算）：**

```
130 的二进制（int 32位）:  00000000 00000000 00000000 10000010
强转 byte 只保留低 8 位:                       10000010
按补码解释: 符号位 1 → 负数，取反加一 → 1111110 + 1 = 1111111 = 127，所以是 -126+... 
实际计算: 10000010 = -128 + 2 = -126
```

### 5.3 字符串与基本类型互转

```java
// String → 基本类型（包装类的 parseXxx 静态方法）
int i = Integer.parseInt("123");
long l = Long.parseLong("123");
double d = Double.parseDouble("3.14");
float f = Float.parseFloat("3.14");
boolean b = Boolean.parseBoolean("true");     // 只有 "true"（忽略大小写）才是 true，其他全是 false！
char c = "abc".charAt(0);                     // 'a'

// 指定进制
int hex = Integer.parseInt("ff", 16);         // 255
int bin = Integer.parseInt("1010", 2);        // 10
int oct = Integer.parseInt("77", 8);          // 63

// 基本类型 → String
String s1 = String.valueOf(123);              // "123"（推荐，能处理 null）
String s2 = Integer.toString(123);            // "123"
String s3 = 123 + "";                         // "123"（最简单但可读性差）
String s4 = String.format("%d", 123);         // "123"

// 二进制/十六进制字符串
String binStr = Integer.toBinaryString(10);   // "1010"
String hexStr = Integer.toHexString(255);     // "ff"
String octStr = Integer.toOctalString(8);     // "10"

// 【坑】数字格式化（千分位、补零）
String money = String.format("%,.2f", 1234567.891);  // "1,234,567.89"
String padded = String.format("%05d", 42);           // "00042"
String leftAlign = String.format("%-10s|", "ab");    // "ab        |"

// 解析失败的异常
try {
    Integer.parseInt("abc");     // NumberFormatException
} catch (NumberFormatException e) {
    // 处理
}
// JDK 8+ 安全解析（返回 Optional）
OptionalInt opt = Arrays.stream(new String[]{"1","a"}).mapToInt(s -> {
    try { return Integer.parseInt(s); } catch (Exception e) { return 0; }
});
```

### 5.4 类型提升规则（表达式中的自动转换）

**规则 1：`byte`、`short`、`char` 参与运算时先自动提升为 `int`。**

```java
byte b1 = 1, b2 = 2;
byte b3 = b1 + b2;            // ❌ 编译错误！b1+b2 结果是 int，不能隐式转 byte
byte b4 = (byte)(b1 + b2);    // ✅
final byte b5 = 1, b6 = 2;
byte b7 = b5 + b6;            // ✅ 编译期常量折叠，编译时算出 3

short s = 1;
s = s + 1;                    // ❌ 编译错误，s+1 是 int
s = (short)(s + 1);           // ✅
s += 1;                       // ✅ 复合赋值运算符隐含强制转换！

char c = 'a';
int i = c + 1;                // ✅ 98
char c2 = (char)(c + 1);      // ✅ 'b'
```

**规则 2：表达式结果的类型 = 参与运算的操作数中「容量最大」的类型。**

```java
int + long   → long
int + double → double
float + long → float（float 容量大于 long）
byte + short → int（都先提升为 int）
```

**规则 3：复合赋值运算符（`+=`、`-=`、`*=`、`/=`、`%=`）自带强制转换。**

```java
int i = 5;
i += 3.5;                     // 等价于 i = (int)(i + 3.5) → 8，不报错！
long l = 5;
l += 2.7;                     // 等价于 l = (long)(l + 2.7) → 7

short s = 10;
s *= 1.5;                     // 等价于 s = (short)(s * 1.5) → 15
```

> 【坑】复合赋值的隐式转换是「合法但危险」的语法糖，可能悄悄丢失精度。

## 6. 包装类（Wrapper Class）与自动装箱拆箱

### 6.1 为什么需要包装类

1. 基本类型不是对象，无法作为泛型参数（`List<int>` ❌，`List<Integer>` ✅）。
2. 集合框架只接受对象。
3. 提供类型转换、常量、工具方法（`parseInt`、`MAX_VALUE`）。
4. 支持 `null`，可以表达「无值」语义（数据库字段可为 NULL）。

**对应关系：**

| 基本类型 | 包装类 | 构造 | 父类 |
| --- | --- | --- | --- |
| `byte` | `Byte` | `new Byte((byte)1)` | `Number` |
| `short` | `Short` | — | `Number` |
| `int` | **`Integer`** | `new Integer(1)`（JDK 9 废弃） | `Number` |
| `long` | `Long` | — | `Number` |
| `float` | `Float` | — | `Number` |
| `double` | `Double` | — | `Number` |
| `char` | **`Character`**（名字不同！） | — | `Object` |
| `boolean` | `Boolean` | — | `Object` |

**常用工具方法：**

```java
Integer i = Integer.valueOf(123);        // 推荐（走缓存池）
Integer j = new Integer(123);            // JDK 9 起废弃，每次都 new 对象

int x = i.intValue();                    // 拆箱
String s = i.toString();                 // "123"
int p = Integer.parseInt("456");         // 字符串转 int

// 进制转换
Integer.toBinaryString(10);              // "1010"
Integer.toHexString(255);                // "ff"
Integer.toString(255, 16);               // "ff"
Integer.parseInt("ff", 16);              // 255
Integer.rotateLeft(1, 1);                // 循环左移
Integer.bitCount(7);                     // 3，二进制中 1 的个数
Integer.highestOneBit(10);               // 8
Integer.numberOfLeadingZeros(1);         // 31

// 数值比较（JDK 7+）
Integer.compare(1, 2);                   // -1
Integer.max(1, 2);                       // 2
Integer.sum(1, 2);                       // 3
Integer.divideUnsigned(-1, 2);           // 无符号除法

// Character 工具
Character.isDigit('5');                  // true
Character.isLetter('a');                 // true
Character.isLetterOrDigit('a');          // true
Character.isUpperCase('A');              // true
Character.isWhitespace(' ');             // true
Character.toLowerCase('A');              // 'a'
Character.digit('a', 16);                // 10
```

### 6.2 自动装箱与拆箱（JDK 5+）

```java
// 装箱：基本类型 → 包装类，编译器自动插入 valueOf()
Integer i = 10;                  // 编译后：Integer.valueOf(10)
int[] arr = {1,2,3};
List<Integer> list = new ArrayList<>();
list.add(1);                     // 装箱

// 拆箱：包装类 → 基本类型，编译器自动插入 xxxValue()
int x = i;                       // 编译后：i.intValue()
int y = i + 5;                   // 拆箱后运算
```

**【面试】经典陷阱题：**

```java
Integer a = 100;
Integer b = 100;
Integer c = 200;
Integer d = 200;

System.out.println(a == b);      // true
System.out.println(c == d);      // false ← ！
System.out.println(a.equals(b)); // true
System.out.println(c.equals(d)); // true
```

**原因 —— IntegerCache 缓存池：**

```java
// Integer.valueOf 的源码
public static Integer valueOf(int i) {
    if (i >= IntegerCache.low && i <= IntegerCache.high)   // 默认 -128 ~ 127
        return IntegerCache.cache[i + (-IntegerCache.low)];
    return new Integer(i);
}

// IntegerCache 是 Integer 的私有静态内部类
private static class IntegerCache {
    static final int low = -128;
    static final int high;              // 默认 127，可通过 JVM 参数调整！
    static final Integer[] cache;
    static {
        int h = 127;
        String s = System.getProperty("java.lang.Integer.IntegerCache.high");
        // 也可通过 -XX:AutoBoxCacheMax=<size> 设置
        ...
    }
}
```

- `-128 ~ 127` 范围内的 `Integer` 是**缓存的同一对象**，`==` 比较地址为 `true`。
- 超出范围每次 `new Integer(...)`，是不同对象，`==` 为 `false`。
- 上界可通过 `-XX:AutoBoxCacheMax=1000` 调整，**但下界 -128 固定不可改**。

**其他包装类的缓存范围：**

| 包装类 | 是否缓存 | 缓存范围 |
| --- | --- | --- |
| `Byte` | ✅ | -128 ~ 127（全部） |
| `Short` | ✅ | -128 ~ 127 |
| `Integer` | ✅ | -128 ~ 127（可调上界） |
| `Long` | ✅ | -128 ~ 127 |
| `Character` | ✅ | 0 ~ 127 |
| `Boolean` | ✅ | `TRUE` / `FALSE` 两个静态实例 |
| `Float` | ❌ | 不缓存（浮点值太多） |
| `Double` | ❌ | 不缓存 |

```java
// 所以这些也都是坑
Long l1 = 100L, l2 = 100L;
System.out.println(l1 == l2);        // true（缓存）
Double d1 = 100.0, d2 = 100.0;
System.out.println(d1 == d2);        // false！Double 不缓存
Boolean b1 = true, b2 = true;
System.out.println(b1 == b2);        // true（Boolean.TRUE 单例）
```

> 【强制】**所有包装类对象的值比较，一律用 `equals`，禁止用 `==`**。这是阿里手册的强制规约。

### 6.3 拆箱 NPE 陷阱（生产事故高发）

```java
// 陷阱 1：null 拆箱
Integer i = null;
int x = i;                    // NullPointerException！编译器插入 i.intValue()

// 陷阱 2：三目运算符的类型提升
Integer a = null;
Integer b = 1;
int c = (a != null) ? a : b;  // ✅ 安全
Integer d = (a != null) ? a : 0;   // ⚠️ 编译器推断类型为 int，会对 a 拆箱！
                                   // 当 a 为 null 时 NPE

// 陷阱 3：三目运算两侧类型不一致
Map<String, Integer> map = new HashMap<>();
Integer value = map.containsKey("k") ? map.get("k") : null;
// 若写成三目：Integer v = flag ? map.get("k") : 0;  ← 同样有拆箱风险

// 陷阱 4：数据库查询结果为 null
Integer count = userMapper.countByAge(20);   // COUNT 可能返回 null？实际不会，但 SUM 会
Integer sum = userMapper.sumAmount();        // SUM 无数据返回 null
int total = sum;                             // NPE！

// 陷阱 5：包装类型作为方法参数
public void process(int value) { }
Integer param = null;
process(param);                              // NPE！

// 陷阱 6：POJO 中用基本类型，数据库 null 反序列化失败
class User {
    private int age;      // ❌ 数据库 age 为 NULL 时，MyBatis 映射抛异常或置 0（丢失语义）
    private Integer age;  // ✅ 可以为 null，表达「未填写」
}
```

> 【强制】阿里手册：**所有的 POJO 类属性必须使用包装数据类型**；**RPC 方法的返回值和参数必须使用包装数据类型**；**所有的局部变量使用基本数据类型**。
>
> 理由：数据库字段可能为 NULL，用 `int` 无法表达「没有值」，且 `Integer` 默认 null 能暴露问题；局部变量用基本类型避免不必要的拆装箱开销和 NPE。

**防御写法：**

```java
// 方案 1：判空
int x = (i != null) ? i : 0;

// 方案 2：Objects.requireNonNullElse（JDK 9+）
int y = Objects.requireNonNullElse(i, 0);

// 方案 3：Optional
int z = Optional.ofNullable(i).orElse(0);

// 方案 4：数据库层用 IFNULL/COALESCE
// SELECT IFNULL(SUM(amount), 0) FROM orders;
```

### 6.4 包装类与字符串的性能

```java
// ❌ 循环中频繁拆装箱，性能极差
Long sum = 0L;
for (long i = 0; i < 10_000_000; i++) {
    sum += i;               // 每次都要拆箱 → 加法 → 装箱，产生千万个 Long 对象
}

// ✅ 用基本类型
long sum2 = 0L;
for (long i = 0; i < 10_000_000; i++) {
    sum2 += i;
}
// 实测：前者约 500ms，后者约 5ms，差 100 倍
```

> 【坑】这是《Effective Java》第 6 条「避免创建不必要的对象」的经典案例。IDEA 会提示「Boxing/unboxing in loop」。

## 7. 字符串常量池与 String 的不可变性

### 7.1 String 的底层实现

```java
// JDK 8 及以前
public final class String implements Serializable, Comparable<String>, CharSequence {
    private final char value[];        // 字符数组
    private int hash;
}

// JDK 9+（Compact Strings，JEP 254）
public final class String {
    private final byte[] value;        // 改为 byte 数组
    private final byte coder;          // 0 = LATIN1（每字符1字节），1 = UTF16（每字符2字节）
}
```

**JDK 9 的 Compact Strings 优化**：大部分字符串只含 Latin-1 字符（英文、数字），用 1 字节存比 UTF-16 的 2 字节省一半内存。实测能减少 Java 堆内存占用 10%~20%。

**String 的不可变性（immutable）体现在三处：**

1. `class String` 被 `final` 修饰 → 不能被继承（防止子类破坏不可变性）。
2. `value` 数组被 `final` 修饰 → 引用不能改。
3. `value` 数组被 `private` 修饰，且 String **不提供任何修改数组的方法** → 内容不能改。
4. JDK 9 之前 `value` 还是 `private final char[]`，通过反射可破坏（`setAccessible(true)`），JDK 9+ 模块化后需要 `--add-opens` 才能反射。

**不可变的好处：**

| 好处 | 说明 |
| --- | --- |
| 字符串常量池得以实现 | 内容不变才能安全共享，节省大量内存 |
| 线程安全 | 不可变对象天生线程安全，可自由传递 |
| hashCode 可缓存 | 只需计算一次（`private int hash`），HashMap 的 key 性能好 |
| 安全性 | 网络连接、文件路径、类名等参数不会被恶意篡改（防止 path traversal） |

```java
String s = "abc";
s = s + "def";
// 并不是修改了原对象，而是：
// 1. 创建新的 String 对象 "abcdef"
// 2. 让 s 指向新对象
// 3. 原 "abc" 若无引用则等待 GC
```

### 7.2 字符串常量池（String Pool）

字符串常量池是 JVM 在**堆**中维护的一块区域（JDK 6 及以前在永久代，**JDK 7 起移到堆**，因为永久代容易 OOM）。

```java
// 情况 1：字面量创建 → 走常量池
String s1 = "abc";         // 常量池中创建 "abc"，s1 指向池中
String s2 = "abc";         // 池中已有，直接返回同一引用
System.out.println(s1 == s2);        // true，同一对象
System.out.println(s1.equals(s2));   // true

// 情况 2：new 创建 → 堆中新对象
String s3 = new String("abc");   // 堆中创建新对象（其 value 指向池中 "abc" 的数组）
System.out.println(s1 == s3);        // false，地址不同
System.out.println(s1.equals(s3));   // true，内容相同

// 情况 3：intern() → 返回池中引用
String s4 = s3.intern();
System.out.println(s1 == s4);        // true

// 【面试】new String("abc") 创建了几个对象？
// 答：1 个或 2 个。
// - 若常量池中还没有 "abc"：先在池中创建 "abc"，再在堆中创建新对象 → 2 个
// - 若池中已有 "abc"：只在堆中创建 1 个
```

**内存图示：**

```
             字符串常量池（堆中的一块）
            ┌──────────────┐
            │  "abc"       │←───────────┐
            └──────────────┘            │
                    ↑                   │
                    │ 引用               │
   栈               │                   │
┌──────────┐       │              ┌─────┴──────┐
│ s1 ──────┼───────┘              │  堆         │
│ s2 ──────┼──────────────────────┤ "abc"(新对象)│←── s3
│ s3 ──────┼──────────────────────┴────────────┘
└──────────┘
```

### 7.3 字符串拼接的底层机制

```java
// 情况 1：编译期常量折叠（不涉及运行时拼接）
String a = "he" + "llo";          // 编译后直接是 "hello"，走常量池
String b = "hello";
System.out.println(a == b);       // true

final String x = "he";            // final 修饰的编译期常量
String c = x + "llo";
System.out.println(c == b);       // true，编译期就折叠了

String y = "he";                  // 非 final，运行时才知道值
String d = y + "llo";
System.out.println(d == b);       // false！运行时 StringBuilder 拼接后 new String

// 情况 2：运行时拼接 → StringBuilder（JDK 8）
String s1 = "a";
String s2 = s1 + "b" + "c";
// JDK 8 编译为：
// new StringBuilder().append(s1).append("b").append("c").toString()

// JDK 9+ 改为 invokedynamic + StringConcatFactory（JEP 280），更高效

// 情况 3：字符串 + 基本类型的顺序陷阱
System.out.println("result: " + 1 + 2);   // "result: 12"，从左到右，先拼接
System.out.println(1 + 2 + "result: ");   // "3result: "，先算加法
System.out.println('a' + 1);              // 98，char 提升为 int
System.out.println('a' + "1");            // "a1"
System.out.println("" + 1 + 2);           // "12"

// 情况 4：循环中拼接的性能问题
// ❌ 极慢：每次循环都 new StringBuilder + new String，O(n²) 复杂度
String result = "";
for (int i = 0; i < 100000; i++) {
    result += i;
}

// ✅ 快：复用一个 StringBuilder
StringBuilder sb = new StringBuilder(200000);   // 预分配容量
for (int i = 0; i < 100000; i++) {
    sb.append(i);
}
String result2 = sb.toString();
// 实测：前者数十秒甚至 OOM，后者几十毫秒
```

> 【坑】单次拼接用 `+` 没问题（编译器会优化成 StringBuilder），**循环内拼接必须显式用 StringBuilder**。

### 7.4 String、StringBuilder、StringBuffer 对比

| 对比项 | String | StringBuilder | StringBuffer |
| --- | --- | --- | --- |
| 可变性 | **不可变** | 可变 | 可变 |
| 线程安全 | 安全（不可变天然安全） | **不安全** | **安全**（方法加 `synchronized`） |
| 性能 | 拼接时最差 | **最好** | 中等（同步开销） |
| 底层 | `final char[]`（JDK8）/`byte[]`（JDK9+） | `char[]`/`byte[]`，非 final，可扩容 | 同 StringBuilder，方法同步 |
| 适用场景 | 少量字符串操作、常量 | **单线程大量拼接（首选）** | 多线程共享（实际很少见） |
| 父类 | `Object` | `AbstractStringBuilder` | `AbstractStringBuilder` |

```java
// StringBuilder 常用 API（链式调用）
StringBuilder sb = new StringBuilder();          // 默认容量 16
StringBuilder sb2 = new StringBuilder(100);      // 指定容量
StringBuilder sb3 = new StringBuilder("abc");    // 容量 = 16 + 3 = 19

sb.append("hello").append(123).append(true).append(3.14);  // 追加任意类型
sb.insert(0, "START-");             // 指定位置插入
sb.delete(0, 5);                    // 删除 [start, end)
sb.deleteCharAt(0);                 // 删除单个字符
sb.replace(0, 3, "xyz");            // 替换
sb.reverse();                       // 反转
sb.setLength(10);                   // 设置长度（截断或补 \0）
sb.charAt(0);                       // 取字符
sb.length();                        // 当前长度
sb.capacity();                      // 当前容量
sb.toString();                      // 转 String

// StringBuffer 的同步实现（源码）
@Override
public synchronized StringBuffer append(String str) {
    toStringCache = null;
    super.append(str);
    return this;
}
```

**StringBuilder 扩容机制：**

```java
// AbstractStringBuilder.ensureCapacityInternal
private void ensureCapacityInternal(int minimumCapacity) {
    if (minimumCapacity - value.length > 0) {
        value = Arrays.copyOf(value, newCapacity(minimumCapacity));
    }
}

private int newCapacity(int minCapacity) {
    int newCapacity = (value.length << 1) + 2;   // 新容量 = 旧容量 * 2 + 2
    if (newCapacity - minCapacity < 0) {
        newCapacity = minCapacity;
    }
    return (newCapacity <= 0 || MAX_ARRAY_SIZE - newCapacity < 0)
        ? hugeCapacity(minCapacity) : newCapacity;
}
```

- 默认容量 **16**，扩容为 **2 倍 + 2**（16 → 34 → 70 → 142 ...）。
- `new StringBuilder("abc")` 的初始容量是 **16 + 3 = 19**。
- 预估长度时**指定初始容量**可避免多次 `Arrays.copyOf` 数组拷贝：`new StringBuilder(expectedLen)`。

### 7.5 字符串比较与判等

```java
String s1 = "abc";
String s2 = new String("abc");

// 内容比较（永远用这个）
s1.equals(s2);                      // true
s1.equalsIgnoreCase("ABC");         // true，忽略大小写
s1.compareTo(s2);                   // 0，按字典序比较，返回差值
s1.compareToIgnoreCase("ABC");      // 0
s1.contentEquals(s2);               // true，可比较 CharSequence
Objects.equals(s1, s2);             // true，null 安全（推荐）

// 引用比较
s1 == s2;                           // false
s1 == s2.intern();                  // true

// 判空
s1.isEmpty();                       // false，等价于 length() == 0
s1.isBlank();                       // JDK 11+，全空白字符也算 true
StringUtils.isEmpty(s1);            // Spring/Apache 工具，null 安全
StringUtils.hasText(s1);            // Spring：非 null、非空、含非空白字符
StringUtils.isNotBlank(s1);         // Apache Commons
```

**【坑】`null` 调用 equals 会 NPE：**

```java
String status = null;
status.equals("active");        // NullPointerException
"active".equals(status);        // ✅ false，常量在前
Objects.equals(status, "active"); // ✅ false
```

> 【强制】阿里手册：**`equals` 应由常量或确定有值的对象调用**。`"const".equals(obj)` 而非 `obj.equals("const")`。JDK 7+ 也可用 `Objects.equals(a, b)`。

**isEmpty vs isBlank：**

```java
"".isEmpty();          // true
"   ".isEmpty();       // false（有字符）
"   ".isBlank();       // true（JDK 11+，全是空白字符）
"\t\n".isBlank();      // true
```

## 8. 转义字符与文本块

### 8.1 常用转义字符

| 转义 | 含义 | ASCII |
| --- | --- | --- |
| `\n` | 换行（Line Feed） | 10 |
| `\r` | 回车（Carriage Return） | 13 |
| `\t` | 水平制表符 | 9 |
| `\b` | 退格 | 8 |
| `\f` | 换页 | 12 |
| `\\` | 反斜杠 | 92 |
| `\'` | 单引号 | 39 |
| `\"` | 双引号 | 34 |
| `\0` | 空字符 | 0 |
| `\uXXXX` | Unicode 字符 | — |
| `\XXX` | 八进制表示的字符（0~377） | — |

> 【坑】Windows 换行是 `\r\n`，Linux/macOS 是 `\n`。跨平台处理文本时用 `System.lineSeparator()` 或 `System.getProperty("line.separator")`。

```java
// Windows 路径要双反斜杠
String path = "C:\\Users\\admin\\file.txt";
String path2 = "C:/Users/admin/file.txt";      // 正斜杠在 Windows 也认，更省事

// Unicode 转义在编译期就处理（早于词法分析），有个著名陷阱
// \u000A 是换行符，下面这行会导致编译错误
// String s = "abc"; \u000A   ← 编译器把它当成真正的换行，语法被破坏
```

### 8.2 文本块（JDK 15+ 正式，13/14 预览）

```java
// 传统写法：JSON 需要大量转义
String json = "{\n" +
              "  \"name\": \"Tom\",\n" +
              "  \"age\": 20\n" +
              "}";

// 文本块：三引号包裹，所见即所得
String json2 = """
        {
          "name": "Tom",
          "age": 20
        }
        """;

// SQL
String sql = """
        SELECT u.id, u.name, o.amount
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.status = 'ACTIVE'
          AND o.create_time >= ?
        ORDER BY o.amount DESC
        """;

// HTML
String html = """
        <html>
          <body>
            <p>Hello</p>
          </body>
        </html>
        """;

// 配合 format 使用
String msg = """
        订单 %s 已支付，金额 %s 元。
        """.formatted(orderNo, amount);

// 行尾反斜杠：抑制换行（JDK 14+）
String oneLine = """
        abc \
        def \
        ghi""";       // → "abc def ghi"

// 行尾 \s：保留尾部空格（默认会被去掉）
String padded = """
        red  \s
        green\s
        """;
```

**文本块的规则：**
1. 开头 `"""` 后必须换行，内容从下一行开始。
2. **缩进会被自动移除**（以所有行中最靠左的非空白字符为基准，含结尾 `"""` 的位置）。
3. 结尾 `"""` 的位置影响缩进剥离的基准。
4. 每行末尾的空白默认被去掉（用 `\s` 保留）。
5. 依然是 `String` 对象，同样进常量池。

## 9. null 与 Optional

### 9.1 null 的本质

```java
String s = null;        // 引用不指向任何对象
s.length();             // NullPointerException

// null 不是关键字，是字面量，可以赋给任何引用类型
Object o = null;
int[] arr = null;
Runnable r = null;

// null 不能赋给基本类型
// int i = null;        // ❌ 编译错误

// 与 null 的比较只能用 == 或 !=
if (s == null) { }
if (s != null) { }
// s.equals(null);      // ❌ NPE

// instanceof 对 null 返回 false（安全）
if (s instanceof String) { }   // s 为 null 时不会进入，也不会 NPE

// 三目运算符中的 null 与拆箱
Integer i = null;
int x = (i != null) ? i : 0;   // ✅
```

**NPE 的常见来源：**

| 场景 | 示例 | 预防 |
| --- | --- | --- |
| 调用 null 对象的方法 | `user.getName()` | 判空、`Optional` |
| 自动拆箱 | `int x = nullInteger` | POJO 用包装类型，取前判空 |
| 数组/集合元素为 null | `list.get(0).toString()` | 判空 |
| Map.get 返回 null | `map.get("k").length()` | `getOrDefault`、`containsKey` |
| 方法返回 null | `service.find(id)` | 返回空集合而非 null |
| 三目运算符类型提升 | 见上文 | 两侧类型统一 |
| 字符串比较 | `nullStr.equals("x")` | 常量在前 / `Objects.equals` |
| 数据库查询无结果 | `selectOne` 返回 null | 判空 |

**防御式编程：**

```java
// 1. 判空
if (user != null && user.getName() != null) {
    System.out.println(user.getName().trim());
}

// 2. JDK 8 Optional
Optional.ofNullable(user)
        .map(User::getName)
        .map(String::trim)
        .ifPresent(System.out::println);

// 3. 返回空集合而非 null（Effective Java 第 54 条）
public List<User> findUsers() {
    List<User> list = mapper.select();
    return list == null ? Collections.emptyList() : list;   // 调用方无需判空
}

// 4. JDK 9+ 集合工厂方法不接受 null
List.of("a", null);        // NullPointerException
Set.of(1, 2, 2);           // IllegalArgumentException（重复元素）

// 5. 断言工具
Objects.requireNonNull(user, "user 不能为 null");
Objects.requireNonNullElse(user, defaultUser);          // JDK 9+
Objects.requireNonNullElseGet(user, User::new);         // JDK 9+，惰性求值

// 6. 注解 + 静态检查（编译期发现 NPE）
public void process(@NonNull String input) { }          // Lombok / Spring / JetBrains 注解
public @Nullable String find() { return null; }
```

### 9.2 JDK 14+ 友好的 NPE 提示

```java
// JDK 13 及以前
// Exception in thread "main" java.lang.NullPointerException

// JDK 14+（Helpful NullPointerExceptions，JEP 358）
// Exception in thread "main" java.lang.NullPointerException:
//     Cannot invoke "String.length()" because "<local1>.name" is null
```

JDK 14+ 默认开启（`-XX:+ShowCodeDetailsInExceptionMessages`，JDK 15 起默认 true），能精确指出哪个变量为 null，排查效率大幅提升。

## 10. 输入输出基础

### 10.1 Scanner（控制台输入，教学用）

```java
import java.util.Scanner;

public class InputDemo {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        System.out.print("请输入姓名：");
        String name = sc.nextLine();          // 读一整行（含空格）

        System.out.print("请输入年龄：");
        int age = sc.nextInt();               // 读整数

        System.out.print("请输入身高：");
        double height = sc.nextDouble();      // 读浮点

        System.out.print("是否已婚：");
        boolean married = sc.nextBoolean();

        System.out.printf("姓名：%s，年龄：%d，身高：%.2f，已婚：%b%n",
                          name, age, height, married);

        sc.close();                           // 关闭（实际会关 System.in，慎用）
    }
}
```

**Scanner 常用方法：**

| 方法 | 作用 |
| --- | --- |
| `next()` | 读一个单词（遇空格/换行停止，**不含空格**） |
| `nextLine()` | 读一整行（含空格，遇换行停止） |
| `nextInt()` / `nextLong()` / `nextDouble()` / `nextBoolean()` | 读对应类型 |
| `hasNext()` / `hasNextInt()` / `hasNextLine()` | 判断是否有下一个 |
| `useDelimiter(",")` | 设置分隔符 |
| `close()` | 关闭流 |

> 【坑】**`nextInt()` 后接 `nextLine()` 的经典 bug**：`nextInt()` 只读数字，**不读后面的换行符**，导致随后的 `nextLine()` 读到空字符串。
>
> ```java
> Scanner sc = new Scanner(System.in);
> int age = sc.nextInt();        // 用户输入 "20\n"，只读了 20，\n 留在缓冲区
> String name = sc.nextLine();   // 读到 "\n"，即空字符串！
> // 解决：中间插一个 sc.nextLine() 吃掉换行，或全程用 nextLine + parseInt
> ```

### 10.2 BufferedReader（性能更好，生产常用）

```java
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;

public class InputDemo2 {
    public static void main(String[] args) throws IOException {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(System.in))) {
            System.out.print("请输入：");
            String line = br.readLine();
            int num = Integer.parseInt(line.trim());
            System.out.println("结果：" + num * 2);
        }
    }
}
```

**Scanner vs BufferedReader：**

| 对比 | Scanner | BufferedReader |
| --- | --- | --- |
| 功能 | 解析多种类型、正则分词 | 只读字符串 |
| 性能 | 慢（内部有解析逻辑） | 快（默认 8KB 缓冲） |
| 线程安全 | 否 | 否（可自己同步） |
| 缓冲区 | 1KB | 8KB（可指定） |
| 适用 | 教学、简单交互 | 生产、大量输入（如算法题） |

### 10.3 System 类常用成员

```java
// 标准流
System.out.println("普通输出");          // PrintStream
System.err.println("错误输出");          // 红色，用于异常信息
System.in;                               // InputStream，标准输入

// print / println / printf
System.out.print("不换行");
System.out.println("换行");
System.out.printf("姓名:%s 年龄:%d 金额:%.2f%n", "Tom", 20, 99.5);

// 时间
long start = System.currentTimeMillis();   // 当前毫秒时间戳（1970-01-01 UTC）
long nano = System.nanoTime();             // 高精度计时（仅用于测量间隔，无绝对意义）
// ... 业务代码
System.out.println("耗时：" + (System.currentTimeMillis() - start) + "ms");

// 系统属性
System.getProperty("java.version");        // "17.0.9"
System.getProperty("os.name");             // "Mac OS X"
System.getProperty("user.dir");            // 当前工作目录
System.getProperty("file.separator");      // "/" 或 "\"
System.getProperty("line.separator");      // "\n" 或 "\r\n"
System.setProperty("my.key", "value");     // 设置属性（配合 java -Dmy.key=value）

// 环境变量
System.getenv("PATH");
System.getenv();                           // Map<String,String> 所有环境变量

// 数组拷贝（底层 native，性能极高）
int[] src = {1,2,3,4,5};
int[] dest = new int[5];
System.arraycopy(src, 0, dest, 0, 3);      // src[0..2] → dest[0..2]

// GC 与退出
System.gc();                               // 建议 JVM 进行 GC（不保证立即执行，生产慎用）
System.exit(0);                            // 退出 JVM，0 正常，非 0 异常
Runtime.getRuntime().availableProcessors();// CPU 核心数
Runtime.getRuntime().freeMemory();         // 空闲内存
Runtime.getRuntime().maxMemory();          // 最大堆内存
Runtime.getRuntime().totalMemory();        // 当前已分配内存
Runtime.getRuntime().addShutdownHook(new Thread(() -> System.out.println("关闭钩子")));
```

### 10.4 printf 格式化占位符

| 占位符 | 含义 | 示例 |
| --- | --- | --- |
| `%s` | 字符串 | `String.format("%s", "abc")` → `abc` |
| `%d` | 十进制整数 | `%d` → `123` |
| `%f` | 浮点数（默认 6 位小数） | `%.2f` → `3.14` |
| `%e` | 科学计数法 | `%e` → `1.234500e+03` |
| `%c` | 字符 | `%c` → `A` |
| `%b` | 布尔 | `%b` → `true` |
| `%x` / `%X` | 十六进制 | `%x` → `ff` |
| `%o` | 八进制 | `%o` → `17` |
| `%n` | 平台相关换行符 | 比 `\n` 更跨平台 |
| `%%` | 百分号本身 | `%%` → `%` |

**格式修饰：**

```java
String.format("%d", 42);           // "42"
String.format("%5d", 42);          // "   42"（宽度 5，右对齐补空格）
String.format("%-5d|", 42);        // "42   |"（左对齐）
String.format("%05d", 42);         // "00042"（补零）
String.format("%,d", 1234567);     // "1,234,567"（千分位）
String.format("%.2f", 3.14159);    // "3.14"（保留 2 位小数）
String.format("%.3e", 12345.6);    // "1.235e+04"
String.format("%s-%s", "a", "b");  // "a-b"
String.format("%1$s %1$s", "ha");  // "ha ha"（索引参数，$1 表示第 1 个参数）
String.format("%+(d", -42);        // 带符号

// 日期格式化（%t 系列）
String.format("%tF", new Date());       // "2026-09-06"
String.format("%tT", new Date());       // "17:45:30"
String.format("%tY-%tm-%td", new Date());// "2026-09-06"
```

## 11. 编码与字符集

### 11.1 编码发展史

| 编码 | 说明 | 字节数 |
| --- | --- | --- |
| ASCII | 美国标准，128 个字符（英文、数字、符号） | 1 字节（实际用 7 位） |
| Extended ASCII | 扩展到 256 个 | 1 字节 |
| ISO-8859-1（Latin-1） | 西欧语言 | 1 字节 |
| GB2312 | 中国简体，6763 个汉字 | 2 字节 |
| GBK | GB2312 扩展，2 万+ 汉字 | 2 字节 |
| GB18030 | 国标，兼容 GBK，含少数民族文字 | 1/2/4 字节 |
| Big5 | 繁体中文 | 2 字节 |
| Unicode | 全球统一码点，为每个字符分配唯一编号（U+0000 ~ U+10FFFF） | 编码方式决定 |
| **UTF-8** | Unicode 的**变长**实现，兼容 ASCII | 1~4 字节 |
| UTF-16 | 定长 2 字节 + 代理对（Java 内部用） | 2 或 4 字节 |
| UTF-32 | 定长 4 字节 | 4 字节 |

**UTF-8 的编码规则：**

| Unicode 码点范围 | UTF-8 字节数 | 格式 |
| --- | --- | --- |
| U+0000 ~ U+007F | 1 | `0xxxxxxx`（与 ASCII 完全兼容） |
| U+0080 ~ U+07FF | 2 | `110xxxxx 10xxxxxx` |
| U+0800 ~ U+FFFF | 3 | `1110xxxx 10xxxxxx 10xxxxxx`（汉字在此范围） |
| U+10000 ~ U+10FFFF | 4 | `11110xxx 10xxxxxx 10xxxxxx 10xxxxxx`（Emoji） |

### 11.2 Java 中的编码处理

```java
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

// String → byte[]（编码）
byte[] bytes = "你好".getBytes(StandardCharsets.UTF_8);       // 6 字节
byte[] gbkBytes = "你好".getBytes(Charset.forName("GBK"));    // 4 字节
byte[] defaultBytes = "你好".getBytes();   // ⚠️ 用平台默认编码，跨平台隐患！

// byte[] → String（解码）
String s1 = new String(bytes, StandardCharsets.UTF_8);        // "你好"
String s2 = new String(gbkBytes, StandardCharsets.UTF_8);     // 乱码！编码解码要一致

// 查看所有支持的字符集
Charset.availableCharsets().keySet();
Charset.defaultCharset();          // JDK 17 及以前取决于平台，JDK 18+ 默认 UTF-8

// 判断是否支持
Charset.isSupported("UTF-8");
StandardCharsets.UTF_8.name();     // "UTF-8"
```

> 【重要】**JDK 18（JEP 400）起，`Charset.defaultCharset()` 默认返回 UTF-8**，不再依赖操作系统区域设置。这解决了一大类跨平台乱码问题。JDK 17 及以前在 Windows 上默认是 GBK，`new String(bytes)` 不加参数就会乱码。
>
> 【强制】**任何字符串与字节流的转换都必须显式指定字符集**，禁止使用无参 `getBytes()` 和 `new String(byte[])`。

**乱码排查思路：**

1. **确认各环节编码**：源文件编码、编译器 `-encoding`、JVM `file.encoding`、数据库 `character_set_server`、连接串 `useUnicode=true&characterEncoding=utf8`、HTTP `Content-Type: charset=UTF-8`、Nginx `charset utf-8`、终端编码。
2. **乱码的典型表现**：
   - UTF-8 中文按 GBK 解码：`浣犲ソ`（3 字节被当 2 字节切）
   - GBK 中文按 UTF-8 解码：`???` 或 ``（非法字节被替换）
   - Latin-1 解码 UTF-8：`ä½ å¥½`
3. **快速验证**：`new String(str.getBytes("错误编码"), "正确编码")` 能还原就说明诊断正确。

## 12. Java 语法常见坑汇总

| # | 坑 | 现象 | 正确做法 |
| --- | --- | --- | --- |
| 1 | 整数溢出 | `Integer.MAX_VALUE + 1` 变负数，无异常 | 用 `long` 或 `Math.addExact` |
| 2 | 浮点精度 | `0.1 + 0.2 != 0.3` | 金额用 `BigDecimal("字符串")` |
| 3 | `BigDecimal.equals` | `1.0` 与 `1.00` 不相等 | 用 `compareTo() == 0` |
| 4 | `BigDecimal.divide` | 无限小数抛 `ArithmeticException` | 必须传 scale + RoundingMode |
| 5 | 包装类 `==` | 200 == 200 为 false | 一律 `equals` |
| 6 | 拆箱 NPE | `int x = nullInteger` | 判空 / POJO 用包装类型 |
| 7 | 三目运算拆箱 | `Integer d = flag ? nullInt : 0` NPE | 两侧类型统一或显式判空 |
| 8 | 循环内字符串拼接 | 性能极差、OOM | `StringBuilder` 且预分配容量 |
| 9 | `nullStr.equals("x")` | NPE | 常量在前 / `Objects.equals` |
| 10 | `getBytes()` 不指定编码 | 跨平台乱码 | 显式 `StandardCharsets.UTF_8` |
| 11 | `nextInt()` 后 `nextLine()` | 读到空串 | 中间补一次 `nextLine()` |
| 12 | `if (flag = true)` | 恒为真 | 用 `==`，IDEA 有警告 |
| 13 | `byte b = 1; b = b + 1;` | 编译错误 | `b += 1` 或强转 |
| 14 | `String s = 1 + 2 + "a"` | 结果是 `"3a"` 不是 `"12a"` | 注意运算顺序 |
| 15 | `switch` 忘记 `break` | 穿透执行 | 每个 case 加 break，或用 JDK 14 新语法 |
| 16 | 魔法值 | `if (type == 3)` | 定义常量或枚举 |
| 17 | POJO 布尔字段 `isXxx` | 序列化后字段名丢失 | 属性名不加 `is` 前缀 |
| 18 | `long l = 100` 与 `100L` | 大数超 int 范围编译错误 | 字面量加 `L`（大写） |
| 19 | `new BigDecimal(0.1)` | 精度已丢失 | 用字符串构造或 `valueOf` |
| 20 | 编译期常量内联 | 改了常量 jar 未重编译依赖方，值不变 | 修改常量后全量重新编译 |

---

## 关联笔记

- 上一篇：[[后端/Java基础/Java语言概述与开发环境]]
- 下一篇：[[后端/Java基础/运算符与流程控制]]
- 相关：[[后端/Java基础/常用类与API]]、[[后端/Java基础/面向对象基础]]
- 底层：[[后端/JVM/JVM概述与运行时数据区]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
