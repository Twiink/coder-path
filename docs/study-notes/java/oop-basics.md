---
title: "面向对象基础"
aliases:
  - "Java OOP"
  - "封装继承多态"
tags:
  - "后端"
  - "java"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/数组与方法]]"
  - "[[后端/Java基础/面向对象进阶]]"
  - "[[后端/Java基础/常用类与API]]"
  - "[[后端/Spring/Spring概述与IoC容器]]"
created: 2026-09-06
updated: 2026-09-06
---

# 面向对象基础

## 1. 面向对象思想

### 1.1 面向过程 vs 面向对象

| 对比项 | 面向过程（POP） | 面向对象（OOP） |
| --- | --- | --- |
| 核心思想 | **步骤**：把问题拆成一系列函数，按顺序调用 | **对象**：把问题拆成一组协作的对象，每个对象负责自己的数据和行为 |
| 代表语言 | C、Go（部分）、Shell | Java、C++、C#、Python |
| 关注点 | 做什么、怎么做（动词） | 谁来做、有什么（名词） |
| 数据与行为 | 分离（结构体 + 函数） | 封装在一起（类） |
| 耦合度 | 高（函数间参数传递链长） | 低（对象间通过消息交互） |
| 复用性 | 靠函数复用 | 靠继承、组合、多态复用 |
| 可维护性 | 差（改一处影响全流程） | 好（改一个类影响局部） |
| 性能 | 略高（无对象创建/虚方法开销） | 略低（但现代 JVM 优化后可忽略） |
| 适用 | 嵌入式、脚本、算法密集 | 企业应用、大型系统 |

**经典例子 —— 洗衣服：**

```
面向过程：放水 → 加洗衣粉 → 浸泡 → 揉搓 → 拧干 → 晾晒
         （你亲自做每一步）

面向对象：把衣服交给洗衣机
         洗衣机.洗涤(衣服)     ← 你只关心「谁来做」，不关心内部实现
```

### 1.2 类与对象

| 概念 | 定义 | 类比 |
| --- | --- | --- |
| **类（Class）** | 对一类事物的抽象描述，是**模板/图纸** | 汽车设计图、月饼模具 |
| **对象（Object）** | 类的**具体实例**，是运行时真实存在的实体 | 一辆具体的汽车、一个月饼 |
| **属性（Field）** | 对象的状态数据（成员变量） | 汽车的颜色、品牌 |
| **方法（Method）** | 对象的行为（成员方法） | 汽车的启动、加速 |
| **实例化（new）** | 根据类创建对象的过程 | 用模具压出月饼 |

```java
// 类：抽象描述
public class Car {
    // 属性（成员变量 / 字段 / 实例变量）
    String brand;
    String color;
    int speed;

    // 方法（行为）
    void start() {
        System.out.println(brand + " 启动了");
    }
    void accelerate(int delta) {
        speed += delta;
    }
}

// 对象：具体实例
Car car1 = new Car();      // 实例化
car1.brand = "特斯拉";
car1.color = "白色";
car1.start();

Car car2 = new Car();      // 另一个独立对象
car2.brand = "比亚迪";
// car1 和 car2 互不影响
```

**内存图示：**

```
栈（main 线程）                    堆
┌───────────┐                ┌──────────────────┐
│ car1 ─────┼───────────────→│ Car@0x100        │
│           │                │  brand = "特斯拉"  │
│ car2 ─────┼──────────┐     │  color = "白色"   │
└───────────┘          │     │  speed = 0       │
                       │     ├──────────────────┤
                       └────→│ Car@0x200        │
                             │  brand = "比亚迪"  │
                             │  color = null    │
                             └──────────────────┘
```

### 1.3 面向对象三大特性

| 特性 | 含义 | 实现手段 | 解决的问题 |
| --- | --- | --- | --- |
| **封装（Encapsulation）** | 隐藏内部实现细节，只暴露必要接口 | `private` 字段 + `public` getter/setter、访问修饰符 | 数据安全性、降低耦合 |
| **继承（Inheritance）** | 子类复用父类的属性和方法，并扩展 | `extends`、`super`、方法重写 | 代码复用、建立 is-a 层次 |
| **多态（Polymorphism）** | 同一操作作用于不同对象产生不同行为 | 方法重写 + 父类引用指向子类对象、接口实现、重载 | 扩展性、解耦（面向接口编程） |

> 有些教材补充「抽象（Abstraction）」为第四特性，指用抽象类/接口抽取共性。

## 2. 类的完整结构

```java
package com.example.domain;

import java.io.Serializable;
import java.util.Objects;

/**
 * 用户类（类的文档注释）
 * @author yourname
 * @since 1.0
 */
public class User implements Serializable, Comparable<User> {

    private static final long serialVersionUID = 1L;        // 1. 序列化版本号

    // 2. 静态常量（public static final，全大写）
    public static final int MAX_NAME_LENGTH = 50;

    // 3. 静态变量（类变量，所有实例共享）
    private static int instanceCount = 0;

    // 4. 实例变量（成员变量），private + getter/setter
    private Long id;
    private String name;
    private Integer age;
    private transient String password;      // transient：不参与序列化

    // 5. 静态代码块（类初始化时执行一次）
    static {
        System.out.println("User 类被加载");
    }

    // 6. 实例代码块（每次 new 时执行，先于构造器）
    {
        instanceCount++;
    }

    // 7. 构造方法（与类同名，无返回值）
    public User() {
        // 无参构造（框架反射需要）
    }

    public User(String name, Integer age) {
        this.name = name;       // this 区分成员变量与参数
        this.age = age;
    }

    // 8. getter / setter
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }

    // 9. 业务方法
    public boolean isAdult() {
        return age != null && age >= 18;
    }

    // 10. 重写 Object 的三个方法
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return Objects.equals(id, user.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }

    @Override
    public String toString() {
        return "User{id=" + id + ", name='" + name + "', age=" + age + '}';
    }

    @Override
    public int compareTo(User other) {
        return this.age.compareTo(other.age);
    }

    // 11. 静态方法（工具方法，不能访问实例成员）
    public static int getInstanceCount() { return instanceCount; }

    // 12. 内部类
    public static class Builder { }
}
```

**成员排列顺序的推荐规范（阿里手册 & Google Java Style）：**

```
静态常量 → 静态变量 → 实例变量 → 静态代码块 → 实例代码块 → 构造器 → getter/setter → 业务方法 → 内部类
```

## 3. 封装（Encapsulation）

### 3.1 访问修饰符

| 修饰符 | 本类 | 同包 | 子类（跨包） | 任意位置 | 使用场景 |
| --- | --- | --- | --- | --- | --- |
| `private` | ✅ | ❌ | ❌ | ❌ | **字段一律 private**、构造器私有（单例/工具类） |
| default（包级私有，不写） | ✅ | ✅ | ❌ | ❌ | 包内协作类、辅助类 |
| `protected` | ✅ | ✅ | ✅ | ❌ | 供子类访问/重写的成员 |
| `public` | ✅ | ✅ | ✅ | ✅ | 对外暴露的 API |

```java
public class BankAccount {
    private double balance;              // private：外部无法直接访问

    public double getBalance() {         // 只读暴露
        return balance;
    }

    public void deposit(double amount) {  // 通过方法控制业务规则
        if (amount <= 0) {
            throw new IllegalArgumentException("存款金额必须大于 0");
        }
        balance += amount;
    }

    public boolean withdraw(double amount) {
        if (amount <= 0 || amount > balance) return false;
        balance -= amount;
        return true;
    }

    // balance 字段没有 setter！外部无法任意修改余额，只能通过业务方法
}
```

**封装的价值：**

1. **数据保护**：字段 private，杜绝外部随意赋值（`account.balance = -10000` 被阻止）。
2. **业务约束**：setter/业务方法中做校验（金额 > 0、年龄合法）。
3. **解耦实现**：内部实现可随时改（`balance` 从 `double` 改 `BigDecimal`），只要方法签名不变，调用方无感知。
4. **可控暴露**：只读属性不给 setter；派生属性（`isAdult()`）不给字段。

### 3.2 JavaBean 规范

**JavaBean 是符合以下约定的类**，是框架（Spring、MyBatis、Jackson）能自动处理对象的前提：

| 约定 | 说明 |
| --- | --- |
| public 类 | 有 public 无参构造器 |
| 字段 private | 通过 public getter/setter 访问 |
| getter 命名 | `getXxx()`；**boolean 类型用 `isXxx()`** |
| setter 命名 | `setXxx(类型 参数)`，返回 void |
| 可序列化 | 实现 `Serializable`（可选，需要网络传输/持久化时） |
| 重写 equals/hashCode/toString | 推荐 |

```java
// 标准 JavaBean
public class Product implements Serializable {
    private Long id;
    private String name;
    private boolean onSale;         // 注意：boolean 字段名不带 is 前缀

    public Product() { }            // 必须有无参构造器！

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isOnSale() { return onSale; }        // boolean → isXxx
    public void setOnSale(boolean onSale) { this.onSale = onSale; }
}
```

> 【坑】**boolean 字段命名 `isDeleted` 的序列化灾难**：
> ```java
> private Boolean isDeleted;
> public Boolean getIsDeleted() { ... }      // IDEA 生成 getIsDeleted
> // 或 Lombok 生成 getDeleted()（因为去掉 is 前缀）
> ```
> Jackson/Fastjson 会把属性名解析为 `deleted`，而前端期望 `isDeleted`，导致字段丢失。
> **规约：POJO 中布尔字段禁止 `is` 前缀**，数据库列可以叫 `is_deleted`，Java 属性叫 `deleted`，用 `@TableField("is_deleted")` 或 `@JsonProperty` 映射。

> 【坑】**没有无参构造器会导致 Jackson/MyBatis 反序列化失败**：`No Creators, like default constructor, exist`。加了带参构造器后，编译器不再自动生成无参构造器，**必须显式补上**。

### 3.3 Lombok（消除样板代码）

```java
import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data                              // = @Getter + @Setter + @ToString + @EqualsAndHashCode + @RequiredArgsConstructor
@Builder                           // 生成 Builder 模式代码
@NoArgsConstructor                 // 无参构造
@AllArgsConstructor                // 全参构造
public class Product {
    private Long id;
    private String name;
    private BigDecimal price;
    private Boolean onSale;
}

// 使用
Product p = Product.builder()
                   .id(1L)
                   .name("iPhone")
                   .price(new BigDecimal("5999"))
                   .onSale(true)
                   .build();
p.getName();                       // 自动生成的 getter
p.setName("iPad");                 // 自动生成的 setter
System.out.println(p);             // Product(id=1, name=iPhone, price=5999, onSale=true)
```

**Lombok 常用注解：**

| 注解 | 作用 |
| --- | --- |
| `@Getter` / `@Setter` | 生成 getter/setter（可设 `AccessLevel.NONE` 排除某字段） |
| `@ToString` | 生成 toString（`exclude`/`include` 控制字段） |
| `@EqualsAndHashCode` | 生成 equals/hashCode（`callSuper=true` 含父类字段） |
| `@Data` | 上述组合（不含 Builder） |
| `@NoArgsConstructor` / `@AllArgsConstructor` / `@RequiredArgsConstructor` | 三种构造器（Required 只含 final 和 @NonNull 字段） |
| `@Builder` | 建造者模式 |
| `@Slf4j` / `@Log4j2` | 注入 `private static final Logger log` |
| `@SneakyThrows` | 偷偷抛出受检异常（**慎用**，会破坏异常契约） |
| `@NonNull` | 参数非空校验，null 时抛 NPE |
| `@Value` | 不可变类（所有字段 private final，只有 getter） |
| `@Cleanup` | 自动调用 close() |
| `@Accessors(chain=true)` | setter 返回 this，支持链式调用 |

> 【坑】Lombok 注意事项：
> 1. **JPA 实体慎用 `@Data`**：`equals`/`hashCode` 会触发懒加载关联，导致全表查询甚至死循环（双向关联）。应显式 `@EqualsAndHashCode(onlyExplicitlyIncluded = true)` 只用主键。
> 2. **`@Builder` 与继承**：子类需要 `@SuperBuilder`，且 `@Builder` 默认不生成无参构造器（会影响 Jackson），需配 `@NoArgsConstructor @AllArgsConstructor`。
> 3. **`@Data` 生成的 equals 不含父类字段**：需要 `@EqualsAndHashCode(callSuper = true)`。
> 4. **IDEA 必须装 Lombok 插件**（新版已内置），否则代码报红。
> 5. **`@SneakyThrows` 是坏味道**：它把受检异常偷偷抛出，调用方无法感知，破坏 API 契约。

### 3.4 this 关键字

`this` 指向**当前对象**（正在调用方法的那个实例）。

```java
public class User {
    private String name;
    private int age;

    // 1. 区分成员变量与局部变量（同名时）
    public void setName(String name) {
        this.name = name;           // this.name 是字段，name 是参数
    }

    // 2. 调用本类的其他构造器（构造器重载复用）
    public User() {
        this("无名氏", 0);          // 必须是构造器的第一条语句！
    }
    public User(String name) {
        this(name, 0);
    }
    public User(String name, int age) {
        this.name = name;
        this.age = age;
    }

    // 3. 当前对象作为参数传递
    public void marry(User partner) {
        System.out.println(this.name + " 与 " + partner.name + " 结婚");
    }
    public void marryTo(User other) {
        other.marry(this);          // 把自己传过去
    }

    // 4. 返回当前对象（链式调用）
    public User setName2(String name) {
        this.name = name;
        return this;
    }
    // user.setName2("a").setName2("b")  ← 链式

    // 5. 在内部类中引用外部类实例
    class Inner {
        void f() {
            User.this.name = "外部类的name";    // Outer.this
        }
    }
}
```

**this 的限制：**

| 限制 | 说明 |
| --- | --- |
| 不能在**静态方法**中使用 | 静态方法属于类，没有「当前对象」概念 |
| 不能在**静态代码块**中使用 | 同上 |
| 调用构造器 `this(...)` 必须是**第一条语句** | 且不能与 `super(...)` 同时出现在一个构造器中 |
| 不能递归调用自身构造器 | `public A() { this(); }` 编译错误 |

```java
// ❌ 静态方法中不能用 this
public static void show() {
    // System.out.println(this.name);    // 编译错误
}

// ✅ 静态方法中用类名访问静态成员
public static void show() {
    System.out.println(User.MAX_NAME_LENGTH);
}
```

## 4. 构造器（Constructor）

### 4.1 构造器基础

```java
public class User {
    private String name;

    // 无参构造器
    public User() {
        System.out.println("无参构造");
    }

    // 有参构造器
    public User(String name) {
        System.out.println("有参构造");
        this.name = name;
    }

    // 构造器可以重载
    public User(String name, int age) {
        this(name);                 // 复用其他构造器
    }
}
```

**构造器的特点：**

| 特点 | 说明 |
| --- | --- |
| 方法名与类名**完全相同** | 包括大小写 |
| **无返回值类型**（连 void 都不能写） | 写了 `void User()` 就变成普通方法了 |
| 创建对象时**自动调用** | `new User()` 时执行 |
| 可以重载 | 一个类可有多个构造器 |
| 不能被继承 | 子类不能重写父类构造器，只能用 `super()` 调用 |
| 可被 `private` 修饰 | 用于单例、工具类、Builder 模式 |

### 4.2 默认构造器

```java
// 如果一个类没有显式定义任何构造器，编译器会自动生成一个 public 无参构造器
public class Simple {
    // 编译器自动加：public Simple() { }
}

// 一旦显式定义了构造器，编译器就不再生成默认构造器！
public class Simple2 {
    public Simple2(String s) { }
    // 此时 new Simple2() 编译错误！
}
```

> 【坑】**忘记无参构造器导致框架失效**：Jackson 反序列化、MyBatis 结果映射、Spring 实例化 Bean、JPA 实体，**都要求有无参构造器**（通过反射 `Class.newInstance()`）。定义了带参构造器后必须显式补一个无参构造器。

### 4.3 构造器与继承（super）

```java
class Animal {
    String name;
    public Animal() {
        System.out.println("1. Animal 无参构造");
    }
    public Animal(String name) {
        this.name = name;
        System.out.println("2. Animal 有参构造: " + name);
    }
}

class Dog extends Animal {
    int age;
    public Dog() {
        super();                       // 隐式调用（不写也会自动加）
        System.out.println("3. Dog 无参构造");
    }
    public Dog(String name, int age) {
        super(name);                   // 必须显式调用有参的父类构造器
        this.age = age;
        System.out.println("4. Dog 有参构造");
    }
}

new Dog("旺财", 3);
// 输出：
// 2. Animal 有参构造: 旺财
// 4. Dog 有参构造
```

**【面试】子类构造器一定先执行父类构造器吗？**

**是。** 编译器会在子类每个构造器的第一行自动插入 `super()`（无参父类构造器调用）。原因：子类继承了父类的字段，必须先由父类构造器初始化这些字段。

```java
// 如果父类没有无参构造器，子类必须显式调用父类的有参构造器
class Parent {
    Parent(String s) { }        // 只有有参构造器
    // 编译器不生成默认无参构造器
}
class Child extends Parent {
    Child() {
        super("x");             // ✅ 必须显式调用，否则编译错误
    }
    // Child() { }             // ❌ 隐式 super() 找不到无参构造器 → 编译错误
}
```

**super 的三种用法：**

| 用法 | 语法 | 说明 |
| --- | --- | --- |
| 调用父类构造器 | `super(...)` | **必须是构造器第一条语句**；与 `this(...)` 不能共存于同一构造器 |
| 访问父类成员变量 | `super.field` | 子类隐藏了父类同名字段时 |
| 调用父类方法 | `super.method()` | 子类重写了但想复用父类逻辑 |

```java
class Parent {
    String name = "父类name";
    void show() { System.out.println("Parent.show"); }
}
class Child extends Parent {
    String name = "子类name";              // 隐藏（不是重写）父类字段

    @Override
    void show() {
        super.show();                      // 先调父类逻辑
        System.out.println("Child.show");
    }

    void printNames() {
        System.out.println(this.name);     // "子类name"
        System.out.println(super.name);    // "父类name"
    }
}
```

> 【注意】**字段不能被重写，只能被隐藏（hiding）**。父类引用指向子类对象时，访问字段用的是**父类的字段**（编译期绑定），而调用方法用的是**子类的方法**（运行时绑定）。这是 Java 一个重要且反直觉的规则。
> ```java
> Parent p = new Child();
> System.out.println(p.name);     // "父类name"！字段看引用类型
> p.show();                        // Child.show！方法看对象类型
> ```

### 4.4 对象创建的完整流程（必考）

```java
class A {
    static int sa = initStatic("A.sa", 1);
    int ia = initInstance("A.ia", 1);
    static { System.out.println("A.静态代码块"); }
    { System.out.println("A.实例代码块"); }
    A() { System.out.println("A.构造器"); }
    static int initStatic(String tag, int v) { System.out.println(tag); return v; }
    static int initInstance(String tag, int v) { System.out.println(tag); return v; }
}
class B extends A {
    static int sb = initStatic("B.sb", 2);
    int ib = initInstance("B.ib", 2);
    static { System.out.println("B.静态代码块"); }
    { System.out.println("B.实例代码块"); }
    B() { System.out.println("B.构造器"); }
}

new B();   // 首次使用 B 类时
```

**输出顺序：**

```
A.sa                ← 1. 父类静态成员（类初始化 <clinit>，按书写顺序）
A.静态代码块
B.sb                ← 2. 子类静态成员
B.静态代码块
─────────────── 以上仅执行一次（类加载时）───────────────
A.ia                ← 3. 父类实例成员（<init>，super() 调用前）
A.实例代码块
A.构造器             ← 4. 父类构造器体
B.ib                ← 5. 子类实例成员（super() 返回后）
B.实例代码块
B.构造器             ← 6. 子类构造器体
```

**`new` 一个对象的 JVM 层面步骤：**

1. **类加载检查**：检查该类是否已加载、链接、初始化，没有则先执行类加载过程。
2. **分配内存**：在堆中为对象划分内存（指针碰撞 / 空闲列表，取决于堆是否规整）。
3. **内存初始化为零值**：所有字段设为默认值（int → 0，引用 → null）。**所以字段不赋值也能直接用**。
4. **设置对象头**：Mark Word（哈希码、GC 分代年龄、锁标志）+ 类型指针（指向 Class 元数据）。
5. **执行 `<init>()`**：按代码顺序执行实例变量赋值、实例代码块、构造器体（先 `super()`）。

**内存分配的两种方式：**

| 方式 | 条件 | 说明 |
| --- | --- | --- |
| 指针碰撞（Bump the Pointer） | 堆内存规整（用 Serial/ParNew 等带压缩的收集器） | 移动指针划出对象大小 |
| 空闲列表（Free List） | 堆内存不规整（用 CMS 这类标记-清除收集器） | 维护可用内存列表，找一块够大的 |

**并发安全：** 对象创建并非原子操作，JVM 用两种方式保证线程安全：
1. 对分配内存的空间加**同步锁**（CAS + 失败重试）。
2. **TLAB（Thread Local Allocation Buffer）**：每个线程预先在 Eden 区分配一小块私有缓冲区，创建对象优先在 TLAB 中分配（默认开启 `-XX:+UseTLAB`），避免竞争。

## 5. 继承（Inheritance）

### 5.1 基本语法

```java
// 语法：class 子类 extends 父类
public class Animal {                        // 父类（超类、基类、superclass）
    protected String name;
    protected int age;

    public void eat() { System.out.println(name + " 在吃东西"); }
    public void sleep() { System.out.println(name + " 在睡觉"); }
}

public class Dog extends Animal {            // 子类（派生类、subclass）
    public void bark() { System.out.println(name + " 汪汪叫"); }   // 子类扩展的新方法
}

Dog d = new Dog();
d.name = "旺财";      // 继承自父类的字段（protected 可访问）
d.eat();              // 继承自父类的方法
d.bark();             // 子类自己的方法
```

**子类继承了什么：**

| 父类成员 | 子类能否继承/访问 |
| --- | --- |
| `public` 字段和方法 | ✅ 继承并可访问 |
| `protected` 字段和方法 | ✅ 继承并可访问 |
| default（包级）字段和方法 | 同包时 ✅；跨包时**继承了但无法访问** |
| `private` 字段和方法 | **继承了（内存中存在），但无法直接访问**，只能通过父类的 getter/setter |
| 构造器 | ❌ **不继承**，只能用 `super()` 调用 |
| `static` 成员 | 继承（属于类），可通过子类名访问（不推荐） |
| `final` 方法 | 继承但**不能重写** |

> 【面试】**子类是否继承了父类的 private 成员？**
>
> **继承了**（内存中确实分配了这部分空间，否则父类方法无法正常工作），但**不能直接访问**（编译器不允许 `this.privateField`）。访问方式是调用父类提供的 public/protected 方法。这个区分很重要：`Class.getDeclaredFields()` 能拿到私有字段，反射可访问。

### 5.2 继承的三大限制

```java
// 1. Java 只支持单继承（一个类只能有一个直接父类）
class A { }
class B { }
class C extends A { }            // ✅
// class D extends A, B { }      // ❌ 编译错误，不支持多继承

// 2. 不能继承自己
// class E extends E { }         // ❌

// 3. 继承是传递的
class GrandParent { }
class Parent extends GrandParent { }
class Child extends Parent { }
// Child 拥有 GrandParent、Parent 的所有非私有成员
// 所有类的根父类都是 java.lang.Object
```

**为什么 Java 不支持多继承？**

- 菱形继承问题（Diamond Problem）：`D extends B, C`，而 `B`、`C` 都继承自 `A` 并重写了 `f()`，`D` 调用 `f()` 时无法确定用哪个。C++ 用虚继承解决但极其复杂。
- Java 的替代方案：**单继承类 + 多实现接口**（接口可多实现），JDK 8 后接口有 `default` 方法，能获得多继承的大部分好处。
- Java 的多重继承体现在：类可以**实现多个接口**，接口的 default 方法冲突时**必须显式重写解决**。

```java
interface A { default void f() { System.out.println("A.f"); } }
interface B { default void f() { System.out.println("B.f"); } }
class C implements A, B {
    // ❌ 编译错误：C inherits unrelated defaults for f() from both A and B
    // 必须显式重写
    @Override
    public void f() {
        A.super.f();       // 显式指定用 A 的 default 实现
    }
}
```

### 5.3 所有类的根：Object

**任何类都直接或间接继承 `java.lang.Object`**，所以 Object 的 11 个方法所有对象都有：

| 方法 | 签名 | 作用 | 常重写 |
| --- | --- | --- | --- |
| `getClass()` | `public final native Class<?> getClass()` | 返回运行时类型（final 不可重写） | ❌ |
| **`hashCode()`** | `public native int hashCode()` | 返回哈希码（默认基于内存地址） | ✅ |
| **`equals(Object)`** | `public boolean equals(Object obj)` | 判断相等（默认 `==`） | ✅ |
| **`clone()`** | `protected native Object clone() throws CloneNotSupportedException` | 浅拷贝（需实现 `Cloneable`） | ✅ |
| **`toString()`** | `public String toString()` | 字符串表示（默认 `类名@十六进制哈希`） | ✅ |
| `notify()` | `public final native void notify()` | 唤醒一个等待线程 | ❌ |
| `notifyAll()` | `public final native void notifyAll()` | 唤醒所有等待线程 | ❌ |
| `wait()` | `public final native void wait() throws InterruptedException` | 线程等待 | ❌ |
| `wait(long)` | `public final void wait(long timeout)` | 带超时的等待 | ❌ |
| `wait(long, int)` | `public final void wait(long timeout, int nanos)` | 纳秒级超时等待 | ❌ |
| `finalize()` | `protected void finalize() throws Throwable` | GC 前调用（**JDK 9 废弃**） | ❌ |

```java
// toString 默认实现
public String toString() {
    return getClass().getName() + "@" + Integer.toHexString(hashCode());
}
// 输出：com.example.User@1b6d3586

// 重写 toString（推荐，便于日志和调试）
@Override
public String toString() {
    return "User{" + "id=" + id + ", name='" + name + "', age=" + age + '}';
}
// 也可用 Apache Commons / Guava
@Override
public String toString() {
    return new ToStringBuilder(this, ToStringStyle.SHORT_PREFIX_STYLE)
            .append("id", id).append("name", name).toString();
}
```

> 【强制】阿里手册：**POJO 类必须重写 toString 方法**（用 IDEA 生成或 Lombok `@ToString`），继承时调用 `super.toString()`。日志打印对象时才不会输出无意义的地址。

### 5.4 继承 vs 组合（Composition）

**《Effective Java》第 18 条：优先使用组合，而非继承。**

| 对比 | 继承（is-a） | 组合（has-a） |
| --- | --- | --- |
| 关系 | 子类**是**父类的一种 | 类**持有**另一个类的实例 |
| 耦合 | 强（白盒复用，破坏封装） | 弱（黑盒复用，只依赖公开 API） |
| 灵活性 | 编译期确定，无法运行时改变 | 可运行时替换组件（依赖注入） |
| 风险 | 父类改动可能破坏子类（脆弱基类问题） | 需编写委托方法（样板代码多） |
| 语法 | `extends` | 持有字段 + 委托调用 |

**脆弱基类问题（Fragile Base Class）：**

```java
// 你以为 count 是「成功添加的元素数」
public class InstrumentedHashSet<E> extends HashSet<E> {
    private int addCount = 0;

    @Override
    public boolean add(E e) {
        addCount++;
        return super.add(e);
    }

    @Override
    public boolean addAll(Collection<? extends E> c) {
        addCount += c.size();
        return super.addAll(c);      // ⚠️ HashSet.addAll 内部调用 add！
    }

    public int getAddCount() { return addCount; }
}

InstrumentedHashSet<String> s = new InstrumentedHashSet<>();
s.addAll(Arrays.asList("a", "b", "c"));
System.out.println(s.getAddCount());   // 6！不是 3
// 因为 addAll 内部又调了 3 次 add，被重复计数
// 这是依赖了父类的「实现细节」（self-use），父类下个版本可能改掉
```

**组合 + 转发（Wrapper/Decorator 模式）：**

```java
public class InstrumentedSet<E> implements Set<E> {
    private final Set<E> s;              // 组合：持有被包装对象
    private int addCount = 0;

    public InstrumentedSet(Set<E> s) { this.s = s; }

    @Override
    public boolean add(E e) {
        addCount++;
        return s.add(e);                 // 转发（forwarding）
    }

    @Override
    public boolean addAll(Collection<? extends E> c) {
        addCount += c.size();
        return s.addAll(c);              // 不受内部实现影响
    }

    // ... 其余 Set 方法全部转发给 s（Guava 提供 ForwardingSet 简化）
    public int getAddCount() { return addCount; }
}
// 优点：不依赖 HashSet 的实现细节，且能包装任何 Set 实现
```

**什么时候该用继承：**

1. 确实是 **is-a** 关系（`Dog is an Animal`），且子类是父类的**真正子类型**。
2. 你**控制父类源码**，或父类专门为继承设计（有清晰的文档说明可重写点）。
3. 包内继承（同一 package，可控）。

**什么时候用组合：**

1. 只是想复用代码（has-a / uses-a 关系）：`Car` 有 `Engine`，不是继承 `Engine`。
2. 父类是第三方库，无法保证稳定性。
3. 需要运行时切换实现（策略模式、依赖注入）。

### 5.5 继承中的字段隐藏与方法重写

```java
class Parent {
    String name = "父类";
    static String staticName = "父类静态";
    void instanceMethod() { System.out.println("父类实例方法"); }
    static void staticMethod() { System.out.println("父类静态方法"); }
    private void privateMethod() { System.out.println("父类私有方法"); }
    final void finalMethod() { }
}

class Child extends Parent {
    String name = "子类";                       // 字段隐藏
    static String staticName = "子类静态";       // 静态字段隐藏
    @Override void instanceMethod() { System.out.println("子类实例方法"); }   // ✅ 重写
    static void staticMethod() { System.out.println("子类静态方法"); }        // 隐藏，非重写
    private void privateMethod() { System.out.println("子类私有方法"); }      // 新方法，非重写
    // final void finalMethod() { }             // ❌ 编译错误，final 不能重写
}

Parent p = new Child();
System.out.println(p.name);            // "父类"  ← 字段看引用类型（编译期绑定）
System.out.println(p.staticName);      // "父类静态"
p.instanceMethod();                     // "子类实例方法" ← 方法看对象类型（动态绑定）
p.staticMethod();                       // "父类静态方法" ← 静态方法编译期绑定到 Parent
// p.privateMethod();                   // ❌ 编译错误，Parent 中是 private
```

**总结规则：**

| 成员类型 | 绑定方式 | 访问哪个 |
| --- | --- | --- |
| 实例变量（字段） | **静态绑定**（编译期） | 看**引用类型** |
| 静态变量 | 静态绑定 | 看引用类型 |
| 实例方法（可重写） | **动态绑定**（运行期） | 看**对象实际类型** |
| 静态方法 | 静态绑定 | 看引用类型 |
| private 方法 | 静态绑定 | 看引用类型（子类看不到） |
| final 方法 | 静态绑定 | 不可重写 |

> 记忆口诀：**「字段看左边，方法看右边」**（`Parent p = new Child()` 中，字段用 Parent 的，实例方法用 Child 的）。

## 6. 多态（Polymorphism）

### 6.1 多态的三个必要条件

1. **有继承关系**（或实现接口）。
2. **子类重写父类方法**。
3. **父类引用指向子类对象**（向上转型 upcasting）。

```java
class Animal {
    public void sound() { System.out.println("动物叫"); }
    public void eat() { System.out.println("动物吃"); }
}
class Dog extends Animal {
    @Override
    public void sound() { System.out.println("汪汪"); }
    public void fetch() { System.out.println("叼飞盘"); }       // 子类独有方法
}
class Cat extends Animal {
    @Override
    public void sound() { System.out.println("喵喵"); }
}

// 多态的使用
Animal a1 = new Dog();      // 向上转型：Dog is a Animal
Animal a2 = new Cat();
a1.sound();                 // "汪汪"  ← 运行时确定调用 Dog 的方法
a2.sound();                 // "喵喵"
// a1.fetch();              // ❌ 编译错误！Animal 类型没有 fetch 方法

// 统一处理（多态的核心价值：扩展无需修改调用方）
Animal[] animals = {new Dog(), new Cat(), new Dog()};
for (Animal a : animals) {
    a.sound();              // 自动分派到实际类型的方法
}

// 向下转型（需要 instanceof 判断，否则 ClassCastException）
if (a1 instanceof Dog) {
    Dog dog = (Dog) a1;     // 传统写法
    dog.fetch();
}
if (a1 instanceof Dog dog) {  // JDK 16+ 模式匹配
    dog.fetch();
}
// Dog d = (Dog) a2;        // ❌ ClassCastException: Cat cannot be cast to Dog
```

### 6.2 多态的实现原理：动态绑定（虚方法表）

**【面试】Java 如何实现运行时多态？—— 动态绑定 + 虚方法表（vtable）**

**方法调用在字节码中的 5 种指令：**

| 指令 | 调用的方法类型 | 绑定时机 |
| --- | --- | --- |
| `invokestatic` | 静态方法 | **编译期**（静态绑定） |
| `invokespecial` | 构造器 `<init>`、私有方法、`super.method()` | **编译期** |
| `invokevirtual` | 普通实例方法（**虚方法**） | **运行期**（动态绑定） |
| `invokeinterface` | 接口方法 | **运行期** |
| `invokedynamic` | Lambda、动态语言、字符串拼接（JDK 9+） | 运行期，由用户代码决定 |

**能在编译期确定版本的方法叫「非虚方法」，包括：**
1. 静态方法
2. 私有方法
3. 构造器
4. 父类方法（通过 `super.` 调用）
5. `final` 方法（虽用 invokevirtual，但不会被重写，JIT 可内联优化）

**动态绑定的执行过程：**

```java
Animal a = new Dog();
a.sound();
```

1. 编译期：`javac` 看到 `a` 的**声明类型是 Animal**，检查 `Animal` 是否有 `sound()` 方法 → 有，生成 `invokevirtual #sound` 指令，符号引用指向 `Animal.sound`。
2. 运行期：JVM 执行 `invokevirtual` 时：
   - 从操作数栈取出对象引用 `a`，得到**实际对象类型 `Dog`**。
   - 在 `Dog` 的**虚方法表（vtable）** 中查找 `sound()` 的方法指针。
   - `Dog` 重写了 `sound()`，vtable 中该项指向 `Dog.sound()` → 调用它。
   - 如果 `Dog` 没重写，vtable 中该项继承自 `Animal` → 调用 `Animal.sound()`。

**虚方法表（vtable）结构：**

```
每个类在方法区有一张虚方法表，存放虚方法的实际入口地址。
子类继承父类的 vtable 并复制，重写的方法替换为子类实现地址。

Animal 的 vtable              Dog 的 vtable
┌────────────────────┐        ┌────────────────────┐
│ toString → Object  │        │ toString → Object  │
│ equals   → Object  │        │ equals   → Object  │
│ sound    → Animal  │        │ sound    → Dog ★   │  ← 被重写，替换地址
│ eat      → Animal  │        │ eat      → Animal  │
└────────────────────┘        │ fetch    → Dog     │  ← 子类新增
                              └────────────────────┘

调用 a.sound() 时，JVM 通过对象头中的类型指针找到 Dog 的 vtable，
按索引取出 sound 的地址（O(1)），无需遍历继承链。
```

> 【优化】vtable 是「**用空间换时间**」的经典设计。若没有 vtable，每次调用都要沿继承链向上查找，是 O(n)。有了 vtable，查找是 O(1)。
>
> 【内联缓存 Inline Cache】JIT 进一步优化：对**单态调用点**（一直调用同一个类型）直接缓存目标地址；对**双态**用两个分支；**多态**（超过 2 种类型）退化为查 vtable。所以「一个方法调用点的类型越少，性能越好」——这是 megamorphic call site 性能问题的根源。

### 6.3 多态的应用场景

```java
// 场景 1：统一处理不同类型（消除 if-else 分支）
// ❌ 不用多态
public void feed(Animal a) {
    if (a instanceof Dog) ((Dog) a).sound();
    else if (a instanceof Cat) ((Cat) a).sound();
    else if (a instanceof Bird) ((Bird) a).sound();
    // 每加一种动物就要改这里 —— 违反开闭原则
}
// ✅ 用多态
public void feed(Animal a) {
    a.sound();              // 新增动物无需修改此方法
}

// 场景 2：面向接口编程（Spring 的核心思想）
public interface PaymentService {
    void pay(BigDecimal amount);
}
@Service class AlipayService implements PaymentService { }
@Service class WechatPayService implements PaymentService { }

// 调用方只依赖接口，具体实现由 Spring 注入
@Service
public class OrderService {
    private final PaymentService paymentService;      // 依赖抽象
    public OrderService(PaymentService paymentService) {
        this.paymentService = paymentService;          // 构造器注入（依赖倒置）
    }
    public void checkout(Order order) {
        paymentService.pay(order.getAmount());         // 多态：运行时决定用哪个实现
    }
}

// 场景 3：模板方法模式（父类定义骨架，子类实现细节）
public abstract class AbstractProcessor {
    public final void process() {           // 模板方法（final 防止重写骨架）
        validate();                          // 钩子
        doProcess();                         // 抽象方法，子类实现
        afterProcess();                      // 钩子
    }
    protected void validate() { }            // 默认空实现，子类可选重写
    protected abstract void doProcess();     // 必须实现
    protected void afterProcess() { }
}

// 场景 4：策略模式（把 if-else 换成 Map<类型, 策略>）
Map<String, DiscountStrategy> strategies = new HashMap<>();
strategies.put("VIP", new VipDiscount());
strategies.put("NORMAL", new NormalDiscount());
// 使用
strategies.get(userType).apply(order);

// 场景 5：JDK 中的多态无处不在
List<String> list = new ArrayList<>();       // 接口引用指向实现类
Iterator<String> it = list.iterator();
Reader r = new BufferedReader(new FileReader(f));
OutputStream os = new FileOutputStream(f);
```

### 6.4 向上转型与向下转型

```java
// 向上转型（upcasting）：子类 → 父类，自动，安全
Animal a = new Dog();          // 隐式
Animal b = (Animal) new Dog(); // 显式（多余）
Object o = "string";           // 任何类型都能转 Object

// 向上转型后只能调用父类声明的方法
a.sound();     // ✅ Animal 有声明
a.eat();       // ✅
// a.fetch();  // ❌ 编译错误，Animal 没有 fetch

// 向下转型（downcasting）：父类 → 子类，强制，可能 ClassCastException
Dog d = (Dog) a;               // ✅ 运行时 a 确实指向 Dog
d.fetch();                     // 现在能调 Dog 独有方法了

Animal c = new Cat();
// Dog d2 = (Dog) c;           // ❌ ClassCastException

// 安全向下转型
if (a instanceof Dog dog) {    // JDK 16+ 模式匹配，推荐
    dog.fetch();
}
// 传统写法
if (a instanceof Dog) {
    Dog dog = (Dog) a;
    dog.fetch();
}
```

> 【坑】**ClassCastException 常见来源**：
> 1. 集合中混装类型后强转：`List<Object>` 里放不同类型，遍历时强转单一类型。
> 2. 泛型擦除后强转：`(List<String>) someList` 编译不报错但运行时可能异常。
> 3. Spring 中注入的代理对象：CGLIB 代理能转成目标类，JDK 动态代理只能转成接口（详见 [[后端/Spring/动态代理-JDK与CGLIB]]）。
>    ```java
>    @Service
>    public class UserServiceImpl implements UserService { }
>    // JDK 代理下：(UserServiceImpl) applicationContext.getBean("userServiceImpl")  → ClassCastException
>    ```

### 6.5 编译时多态 vs 运行时多态

| | 编译时多态（静态） | 运行时多态（动态） |
| --- | --- | --- |
| 实现 | **方法重载**（Overload） | **方法重写**（Override）+ 向上转型 |
| 绑定时机 | 编译期 | 运行期 |
| 依据 | 参数的**静态类型**（声明类型） | 对象的**实际类型** |
| 性能 | 快（无查表） | 略慢（查 vtable，JIT 可优化） |
| 术语 | 静态分派（Static Dispatch） | 动态分派（Dynamic Dispatch） |

```java
// 静态分派示例：重载决议只看声明类型
class Parent { }
class Child extends Parent { }

public void f(Parent p) { System.out.println("Parent 版本"); }
public void f(Child c) { System.out.println("Child 版本"); }

Parent obj = new Child();
f(obj);        // "Parent 版本"！编译期只看 obj 的声明类型 Parent

// 动态分派示例
Parent p = new Child();
p.method();    // 运行时看实际类型 Child
```

**静态分派的应用 —— 访问者模式（Visitor Pattern）：**

```java
// 双分派（double dispatch）：先按对象实际类型分派 visit，再按参数静态类型分派 accept
interface Shape { void accept(ShapeVisitor v); }
class Circle implements Shape {
    public void accept(ShapeVisitor v) { v.visit(this); }   // this 静态类型是 Circle
}
class Square implements Shape {
    public void accept(ShapeVisitor v) { v.visit(this); }   // this 静态类型是 Square
}
interface ShapeVisitor {
    void visit(Circle c);
    void visit(Square s);
}
// 两次分派：shape.accept(visitor) 是动态分派，
//          visitor.visit(this) 因 this 的静态类型不同而选中不同重载 → 静态分派
```

## 7. 静态（static）与实例成员

### 7.1 static 的四大用途

```java
public class StaticDemo {

    // 1. 静态变量（类变量）：所有实例共享一份
    private static int count = 0;
    public static final String APP_NAME = "Demo";     // 静态常量

    // 2. 静态方法：不依赖对象，通过类名调用
    public static void printInfo() {
        System.out.println("count = " + count);
        // System.out.println(this.name);   // ❌ 静态方法不能用 this
        // name = "x";                      // ❌ 静态方法不能访问实例变量
    }

    // 3. 静态代码块：类初始化时执行一次，用于加载配置
    static {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");   // 传统 JDBC 驱动注册
        } catch (ClassNotFoundException e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    // 4. 静态内部类：不持有外部类引用（不会内存泄漏）
    public static class Config {
        private String url;
    }

    // 静态导入
    // import static java.lang.Math.*;  → 可直接用 PI、max()

    private String name;             // 实例变量：每个对象一份

    public StaticDemo() {
        count++;                     // 实例方法可访问静态成员
    }
}

// 调用方式
StaticDemo.printInfo();              // 推荐：类名调用静态方法
StaticDemo.APP_NAME;                 // 类名访问静态常量
new StaticDemo().printInfo();        // ⚠️ 不推荐，IDEA 会警告（误导读者以为是实例方法）
```

### 7.2 静态 vs 实例对比

| 对比项 | 静态成员（static） | 实例成员 |
| --- | --- | --- |
| 归属 | 属于**类** | 属于**对象** |
| 内存 | JDK 7 及以前在方法区，**JDK 8+ 静态变量随 Class 对象存在堆中** | 堆中对象内 |
| 份数 | 全局唯一一份 | 每个对象一份 |
| 加载时机 | 类初始化时（`<clinit>`） | 对象创建时（`<init>`） |
| 访问方式 | 类名.成员（推荐）或对象.成员 | 必须通过对象 |
| 能否访问实例成员 | ❌ 不能（静态方法中没有 this） | ✅ 能访问静态和实例成员 |
| this / super | ❌ 不可用 | ✅ 可用 |
| 能否被重写 | ❌ 只能被隐藏 | ✅ 可重写（多态） |
| 线程安全 | ⚠️ 可变静态变量是共享状态，需同步 | 对象不共享时天然安全 |
| 典型用途 | 工具方法、常量、计数器、单例、工厂 | 业务状态与行为 |

> 【面试】**JDK 8 中静态变量存在哪里？**
>
> JDK 7 起永久代中的字符串常量池、静态变量已移到**堆**。JDK 8 彻底移除永久代，改为**元空间（Metaspace，使用本地内存）**，但**静态变量本身依然存在堆中**（随 `Class` 对象一起，Class 对象在堆里）。元空间只存类的元数据（方法字节码、常量池结构等）。这是高频易错点。

### 7.3 静态变量的线程安全问题

```java
// ❌ 危险：可变静态变量在多线程下是共享状态
public class Counter {
    private static int count = 0;               // 非线程安全
    public static void increment() { count++; }  // count++ 不是原子操作
}
// 10 个线程各调 1000 次，结果可能 < 10000

// ✅ 方案 1：AtomicInteger
private static final AtomicInteger count = new AtomicInteger(0);
public static void increment() { count.incrementAndGet(); }

// ✅ 方案 2：synchronized
public static synchronized void increment() { count++; }

// ✅ 方案 3：LongAdder（高并发下性能优于 AtomicLong）
private static final LongAdder count = new LongAdder();
public static void increment() { count.increment(); }

// ✅ 最佳方案：避免可变静态变量，改用实例 + 单例 Bean（Spring 管理）
```

> 【强制】阿里手册：**禁止在静态变量上做并发修改**；工具类中的静态方法必须是**无状态**的（不修改任何静态变量），否则在多线程下会产生数据污染。`SimpleDateFormat` 是典型反例（内部有可变状态），不能作为静态共享变量，应改用 `DateTimeFormatter`（不可变、线程安全）。

### 7.4 静态方法的典型应用

```java
// 1. 工具类（Utility Class）：全是静态方法，禁止实例化
public final class StringUtils {                    // final 防继承
    private StringUtils() {                          // private 构造器防实例化
        throw new UnsupportedOperationException("工具类不可实例化");
    }
    public static boolean isEmpty(String s) {
        return s == null || s.isEmpty();
    }
    public static boolean isBlank(String s) {
        return isEmpty(s) || s.trim().isEmpty();
    }
}
// 使用：StringUtils.isEmpty(str)

// 2. 工厂方法（Factory Method）：比构造器更灵活
public class Boolean {
    public static Boolean valueOf(boolean b) { return b ? TRUE : FALSE; }
    public static Boolean parseBoolean(String s) { return "true".equalsIgnoreCase(s); }
}
public class List {                                  // JDK 9+ 集合工厂
    public static <E> List<E> of(E... elements) { }
}
// 优势：有名字（可读性好）、可缓存（返回同一实例）、可返回子类型、可延迟创建

// 3. 单例模式
public class Singleton {
    private static final Singleton INSTANCE = new Singleton();   // 饿汉式
    private Singleton() { }
    public static Singleton getInstance() { return INSTANCE; }
}

// 静态内部类实现（推荐：懒加载 + 线程安全 + 无锁）
public class Singleton2 {
    private Singleton2() { }
    private static class Holder {
        static final Singleton2 INSTANCE = new Singleton2();
    }
    public static Singleton2 getInstance() { return Holder.INSTANCE; }
}

// 枚举实现（《Effective Java》推荐：天然防反射和序列化破坏）
public enum Singleton3 {
    INSTANCE;
    public void doSth() { }
}
```

## 8. 代码块的执行时机

| 代码块类型 | 语法 | 执行时机 | 执行次数 |
| --- | --- | --- | --- |
| 静态代码块 | `static { }` | **类初始化**时（首次主动使用该类） | **仅 1 次** |
| 实例代码块 | `{ }` | 每次创建对象时，在构造器体之前 | 每次 new |
| 普通代码块 | 方法内 `{ }` | 执行到该语句时 | 每次执行 |
| 同步代码块 | `synchronized(obj) { }` | 获得锁后执行 | — |

**类初始化的触发条件（主动引用，JVM 规范定义）：**

1. 使用 `new` 创建实例、读写静态字段（非编译期常量）、调用静态方法。
2. 反射调用（`Class.forName("X")`）。
3. 初始化子类时，若父类未初始化则先初始化父类。
4. JVM 启动时的主类（含 main 方法的类）。
5. JDK 7+ 动态语言支持 `MethodHandle` 解析到静态字段/方法。
6. 接口中定义了 default 方法，实现类初始化时接口要先初始化。

**不会触发类初始化的情况（被动引用）：**

```java
class Parent { static { System.out.println("Parent 初始化"); } static int value = 1; }
class Child extends Parent { static { System.out.println("Child 初始化"); } }

// 1. 通过子类引用父类的静态字段 → 只初始化 Parent，不初始化 Child
System.out.println(Child.value);         // 输出 "Parent 初始化" + 1，没有 "Child 初始化"

// 2. 定义类的数组 → 不触发初始化
Child[] arr = new Child[10];             // 无输出

// 3. 引用编译期常量 → 不触发初始化（常量已在编译期内联）
class Const { static final String NAME = "abc"; static { System.out.println("Const 初始化"); } }
System.out.println(Const.NAME);          // 输出 "abc"，没有 "Const 初始化"

// 4. Class.forName("X", false, loader) → 第二个参数 false 表示不初始化
// 5. ClassLoader.loadClass("X") → 只加载不初始化
```

## 9. 综合实战：设计一个订单领域模型

```java
package com.example.order.domain;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * 订单实体（充血模型示例：数据 + 行为封装在一起）
 */
public class Order {

    // ─── 静态常量 ───
    public static final int MAX_ITEMS = 100;
    private static int orderSequence = 0;

    // ─── 实例字段（全部 private）───
    private final String orderNo;                 // final：创建后不可变
    private final LocalDateTime createTime;
    private OrderStatus status;                   // 用枚举而非 int（类型安全）
    private final List<OrderItem> items;          // 组合：Order has-a OrderItem
    private BigDecimal totalAmount;
    private Long userId;

    // ─── 构造器 ───
    public Order(Long userId) {                   // 业务必需的参数放构造器
        this.orderNo = generateOrderNo();
        this.createTime = LocalDateTime.now();
        this.userId = Objects.requireNonNull(userId, "userId 不能为空");
        this.status = OrderStatus.PENDING;
        this.items = new ArrayList<>();
        this.totalAmount = BigDecimal.ZERO;
    }

    private static synchronized String generateOrderNo() {
        return String.format("ORD%s%05d",
                LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss")),
                ++orderSequence);
    }

    // ─── 业务方法（封装规则，而非暴露 setter）───
    /** 添加商品：内含状态校验、数量上限校验、金额重算 */
    public void addItem(Product product, int quantity) {
        // 卫语句：状态校验
        if (status != OrderStatus.PENDING) {
            throw new IllegalStateException("只有待支付订单可以修改商品，当前状态：" + status);
        }
        if (quantity <= 0) {
            throw new IllegalArgumentException("数量必须大于 0");
        }
        if (items.size() >= MAX_ITEMS) {
            throw new IllegalStateException("订单项不能超过 " + MAX_ITEMS + " 个");
        }
        items.add(new OrderItem(product, quantity));
        recalculateAmount();                       // 私有方法，内部编排
    }

    /** 支付：状态机流转 */
    public void pay() {
        if (status != OrderStatus.PENDING) {
            throw new IllegalStateException("订单不可支付，当前状态：" + status);
        }
        if (items.isEmpty()) {
            throw new IllegalStateException("订单为空，无法支付");
        }
        this.status = OrderStatus.PAID;
    }

    /** 取消 */
    public void cancel(String reason) {
        if (status == OrderStatus.SHIPPED || status == OrderStatus.COMPLETED) {
            throw new IllegalStateException("已发货订单不可取消");
        }
        this.status = OrderStatus.CANCELLED;
    }

    private void recalculateAmount() {
        this.totalAmount = items.stream()
                .map(OrderItem::subtotal)          // 方法引用
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // ─── 只读暴露（返回不可变视图，防止外部修改内部状态）───
    public List<OrderItem> getItems() {
        return Collections.unmodifiableList(items);   // ★ 防御性拷贝
    }

    public String getOrderNo() { return orderNo; }
    public OrderStatus getStatus() { return status; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public LocalDateTime getCreateTime() { return createTime; }
    public Long getUserId() { return userId; }

    public boolean isPayable() {
        return status == OrderStatus.PENDING && !items.isEmpty();
    }

    // ─── Object 方法 ───
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Order order = (Order) o;
        return Objects.equals(orderNo, order.orderNo);   // 只按业务主键比较
    }

    @Override
    public int hashCode() { return Objects.hash(orderNo); }

    @Override
    public String toString() {
        return "Order{orderNo='" + orderNo + "', status=" + status
             + ", totalAmount=" + totalAmount + ", items=" + items.size() + '}';
    }
}

/** 订单状态枚举（类型安全，可携带行为） */
enum OrderStatus {
    PENDING("待支付") {
        @Override
        public boolean canCancel() { return true; }
    },
    PAID("已支付") {
        @Override
        public boolean canCancel() { return true; }
    },
    SHIPPED("已发货") {
        @Override
        public boolean canCancel() { return false; }
    },
    COMPLETED("已完成") {
        @Override
        public boolean canCancel() { return false; }
    },
    CANCELLED("已取消") {
        @Override
        public boolean canCancel() { return false; }
    };

    private final String desc;
    OrderStatus(String desc) { this.desc = desc; }
    public String getDesc() { return desc; }
    public abstract boolean canCancel();      // 每个枚举值实现自己的行为（多态！）
}

/** 订单项（组合关系） */
class OrderItem {
    private final Product product;
    private final int quantity;

    OrderItem(Product product, int quantity) {
        this.product = Objects.requireNonNull(product);
        this.quantity = quantity;
    }

    BigDecimal subtotal() {
        return product.getPrice().multiply(BigDecimal.valueOf(quantity));
    }

    Product getProduct() { return product; }
    public int getQuantity() { return quantity; }

    @Override
    public String toString() {
        return product.getName() + " x" + quantity;
    }
}

/** 商品（简单值对象） */
class Product {
    private final Long id;
    private final String name;
    private final BigDecimal price;

    public Product(Long id, String name, BigDecimal price) {
        this.id = id;
        this.name = name;
        this.price = price;
    }
    public Long getId() { return id; }
    public String getName() { return name; }
    public BigDecimal getPrice() { return price; }
}
```

**使用示例：**

```java
public class OrderDemo {
    public static void main(String[] args) {
        Product iphone = new Product(1L, "iPhone 15", new BigDecimal("5999"));
        Product caseItem = new Product(2L, "手机壳", new BigDecimal("99"));

        Order order = new Order(1001L);
        order.addItem(iphone, 1);
        order.addItem(caseItem, 2);

        System.out.println(order);                 // Order{orderNo='ORD...', status=PENDING, totalAmount=6197, items=2}
        System.out.println("应付：" + order.getTotalAmount());
        System.out.println("订单项：" + order.getItems());

        // 尝试修改内部集合 → 被防御性拷贝阻止
        try {
            order.getItems().clear();
        } catch (UnsupportedOperationException e) {
            System.out.println("✅ 内部状态受保护：" + e.getMessage());
        }

        order.pay();
        System.out.println("支付后状态：" + order.getStatus().getDesc());

        // 状态机保护：已支付订单不能再改商品
        try {
            order.addItem(iphone, 1);
        } catch (IllegalStateException e) {
            System.out.println("✅ 状态校验生效：" + e.getMessage());
        }
    }
}
```

**这个例子体现了哪些 OOP 原则：**

| 原则 | 体现 |
| --- | --- |
| 封装 | 字段全 private，只读暴露用 `unmodifiableList`，无危险 setter |
| 组合 | `Order` 持有 `List<OrderItem>`，`OrderItem` 持有 `Product`（has-a） |
| 多态 | `OrderStatus` 每个枚举值实现自己的 `canCancel()` |
| 不变性 | `orderNo`、`createTime`、`Product` 字段都是 final |
| 卫语句 | `addItem` 中提前抛异常，无嵌套 |
| 类型安全 | 状态用枚举而非 int/String |
| 契约完整 | 重写 equals/hashCode/toString |
| 空安全 | `Objects.requireNonNull` 显式校验 |

## 10. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 字段隐藏被当成重写 | `Parent p = new Child(); p.name` 是父类值 | 理解「字段看引用类型」 |
| 2 | 静态方法期待多态 | `p.staticMethod()` 调的是父类的 | 静态方法不能重写 |
| 3 | 忘了无参构造器 | Jackson/MyBatis 反序列化失败 | 显式补无参构造器 |
| 4 | 子类构造器忘写 `super(参数)` | 编译错误（父类无无参构造器） | 显式调用 `super(...)` |
| 5 | 多继承需求 | 编译错误 | 单继承 + 多接口实现 |
| 6 | 向下转型不判断 | `ClassCastException` | `instanceof` 或 JDK 16 模式匹配 |
| 7 | JDK 代理对象强转实现类 | `ClassCastException` | 转成接口类型 |
| 8 | 继承 HashSet 计数错误 | 依赖父类内部实现 | 用组合 + 转发 |
| 9 | `@Data` 用于 JPA 实体 | 懒加载全表查询/死循环 | `@EqualsAndHashCode(onlyExplicitlyIncluded=true)` |
| 10 | 布尔字段 `isXxx` | 序列化字段名丢失 | 属性名不带 `is` |
| 11 | 返回内部集合引用 | 外部修改破坏封装 | `unmodifiableList` 或防御性拷贝 |
| 12 | 静态可变变量并发修改 | 数据错乱 | `AtomicXxx` 或改为实例状态 |
| 13 | 静态方法中用 this | 编译错误 | 静态方法不访问实例成员 |
| 14 | 以为 Java 有引用传递 | 交换对象失败 | 值传递（传引用的副本） |
| 15 | `finalize()` 清理资源 | 执行时机不确定、对象复活 | `try-with-resources` / `Cleaner` |
| 16 | 构造器中调用可重写方法 | 子类字段未初始化就被访问 | 构造器中只调 private/final 方法 |
| 17 | 忘记 `@Override` | 签名写错变成新方法，不报错 | 一律加 `@Override` |
| 18 | 深继承层次 | 脆弱基类、难以理解 | 组合优先，继承层次 ≤ 3 层 |

> 【坑 16 详解】**构造器中调用可被重写的方法**是隐蔽 bug：
> ```java
> class Parent {
>     Parent() { init(); }                 // 构造器调用可重写方法
>     void init() { }
> }
> class Child extends Parent {
>     private String name = "Tom";
>     @Override void init() { System.out.println(name.length()); }   // NPE！
> }
> new Child();
> // 执行顺序：Parent() → init()（动态分派到 Child.init）→ 此时 Child 的字段还没赋值 → name 为 null → NPE
> ```
> 规则：**构造器中只能调用 private、final、static 方法**。

---

## 关联笔记

- 上一篇：[[后端/Java基础/数组与方法]]
- 下一篇：[[后端/Java基础/面向对象进阶]]（抽象类、接口、内部类）
- 相关：[[后端/Java基础/泛型枚举与注解]]、[[后端/Spring/Spring概述与IoC容器]]（面向接口 + 依赖注入）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
