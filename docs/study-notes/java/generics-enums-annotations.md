---
title: "泛型枚举与注解"
aliases:
  - "Java 泛型"
  - "类型擦除"
  - "Java 注解"
tags:
  - "后端"
  - "java"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/异常处理]]"
  - "[[后端/Java基础/反射与动态代理]]"
  - "[[后端/Java基础/Java8新特性-Lambda与Stream]]"
  - "[[后端/Spring/Spring注解大全与配置类]]"
created: 2026-09-06
updated: 2026-09-06
---

# 泛型、枚举与注解

## 第一部分：泛型（Generics）

### 1. 泛型是什么

**泛型 = 参数化类型（Parameterized Type）**，把类型当作参数传递，让同一份代码适用于多种类型，同时保证**编译期类型安全**。

```java
// ❌ JDK 5 之前：只能用 Object + 强转，无类型检查
List list = new ArrayList();
list.add("hello");
list.add(123);                        // 编译通过！埋下隐患
String s = (String) list.get(1);      // 运行时 ClassCastException

// ✅ 泛型：编译期就发现类型错误
List<String> list2 = new ArrayList<String>();
list2.add("hello");
// list2.add(123);                    // ❌ 编译错误：incompatible types
String s2 = list2.get(0);             // 无需强转
```

**泛型的三大价值：**

| 价值 | 说明 |
| --- | --- |
| 类型安全 | 编译期检查，把 ClassCastException 从运行时提前到编译时 |
| 消除强转 | 取出元素无需强制类型转换，代码简洁 |
| 代码复用 | 一份算法/容器代码适用于所有类型 |

### 2. 泛型的三种使用形式

#### 2.1 泛型类

```java
/**
 * 通用响应包装类（最典型的泛型类应用）
 * @param <T> 数据类型参数
 */
public class Result<T> {
    private Integer code;
    private String message;
    private T data;                    // 类型参数 T 在这里使用

    public Result(Integer code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public T getData() { return data; }
    public void setData(T data) { this.data = data; }

    // 静态工厂方法（静态方法中的泛型要单独声明，见 2.2）
    public static <T> Result<T> success(T data) {
        return new Result<>(0, "成功", data);
    }
}

// 使用
Result<String> r1 = Result.success("hello");        // T = String
Result<User> r2 = Result.success(new User());       // T = User
Result<List<Order>> r3 = Result.success(orderList); // T = List<Order>
String data = r1.getData();                          // 无需强转

// 多个类型参数
public class Pair<K, V> {
    private K key;
    private V value;
    public Pair(K key, V value) { this.key = key; this.value = value; }
    public K getKey() { return key; }
    public V getValue() { return value; }
}
Pair<String, Integer> pair = new Pair<>("age", 20);

// JDK 中的泛型类
public class ArrayList<E> { }                       // E = Element
public class HashMap<K, V> { }                      // K = Key, V = Value
public class Optional<T> { }
public class CompletableFuture<T> { }
public interface Map.Entry<K, V> { }
```

**类型参数的命名约定（非强制但普遍遵守）：**

| 字母 | 含义 | 示例 |
| --- | --- | --- |
| `T` | Type（类型） | `Result&lt;T&gt;` |
| `E` | Element（集合元素） | `List&lt;E&gt;` |
| `K` | Key（键） | `Map&lt;K,V&gt;` |
| `V` | Value（值） | `Map&lt;K,V&gt;` |
| `R` | Result / Return | `Function&lt;T,R&gt;` |
| `N` | Number | `Comparable&lt;N&gt;` |
| `S`, `U`, `V` | 第 2、3、4 个类型 | `<S extends T>` |

**泛型类的限制：**

```java
public class GenericDemo<T> {

    // ❌ 1. 静态字段不能用类的类型参数
    // private static T instance;              // 编译错误：cannot make a static reference to T
    // 原因：静态成员属于类，而类型参数属于实例（一个类可以有 T=String 和 T=Integer 两个实例）

    // ✅ 静态字段可以用自己声明的类型参数
    private static <S> S staticField;          // 这样也合法（S 是静态方法/字段自己的参数）

    // ❌ 2. 不能 new 类型参数的实例
    // public GenericDemo() { T obj = new T(); }    // 编译错误（类型擦除后不知道 T 是什么）
    // ✅ 通过反射或 Supplier 创建
    public GenericDemo(Class<T> clazz) throws Exception {
        T obj = clazz.getDeclaredConstructor().newInstance();
    }
    public GenericDemo(Supplier<T> supplier) {
        T obj = supplier.get();
    }

    // ❌ 3. 不能创建泛型数组
    // private T[] arr = new T[10];            // 编译错误
    // ✅ 用 Object[] 强转（有 unchecked 警告）
    private T[] arr = (T[]) new Object[10];
    // ✅ 或通过反射创建
    private T[] arr2 = (T[]) Array.newInstance(clazz, 10);

    // ❌ 4. 不能对类型参数用 instanceof
    // if (obj instanceof T) { }               // 编译错误
    // ✅ 用 Class 对象
    if (clazz.isInstance(obj)) { }

    // ❌ 5. 不能 catch 类型参数
    // catch (T e) { }                         // 编译错误

    // ✅ 6. 可以使用类型参数声明变量、参数、返回值、强转
    public T process(T input) { return input; }
    public void accept(T t) { }
}
```

#### 2.2 泛型方法

**泛型方法在方法返回值前声明自己的类型参数，独立于类的泛型。**

```java
public class GenericUtils {

    // 静态泛型方法（最常见）
    public static <T> T firstOf(List<T> list) {
        return list.isEmpty() ? null : list.get(0);
    }

    // 多个类型参数
    public static <K, V> Map<V, K> invert(Map<K, V> map) {
        Map<V, K> result = new HashMap<>();
        map.forEach((k, v) -> result.put(v, k));
        return result;
    }

    // 带类型上界的泛型方法
    public static <T extends Comparable<T>> T max(T a, T b) {
        return a.compareTo(b) >= 0 ? a : b;
    }

    // 泛型数组转换
    public static <T> T[] toArray(List<T> list, Class<T> clazz) {
        return list.toArray((T[]) Array.newInstance(clazz, list.size()));
    }

    // 复杂上界：T 必须是 Number 且实现 Comparable
    public static <T extends Number & Comparable<T>> T maxNumber(List<T> list) {
        return Collections.max(list);
    }

    // 类型参数用于返回值和多个参数（保证类型一致性）
    public static <T> List<T> singletonListWrapper(T item) {
        return Collections.singletonList(item);
    }

    // 递归类型边界（自我引用的泛型，用于 Builder 模式）
    public static <T extends Builder<T>> T build(T builder) {
        return builder.build();
    }
}

// 调用（通常无需显式指定类型，编译器自动推断）
String first = GenericUtils.firstOf(stringList);        // 推断 T = String
Map<Integer, String> inv = GenericUtils.invert(map);    // 推断 K=String, V=Integer
Integer m = GenericUtils.max(3, 5);                     // 推断 T = Integer

// 显式指定类型参数（语法：方法名前加 <T>）
Object o = GenericUtils.<Object>firstOf(stringList);    // 强制 T = Object
List<String> empty = Collections.<String>emptyList();   // 常见于 JDK 8 前的类型推断不足场景
```

**【面试】泛型方法与泛型类的区别？**

| | 泛型类 | 泛型方法 |
| --- | --- | --- |
| 类型参数位置 | 类名后 `class Foo&lt;T&gt;` | 返回值前 `public &lt;T&gt; T bar()` |
| 作用范围 | 整个类（除静态成员） | 仅该方法 |
| 确定时机 | **实例化时**确定 | **调用时**确定（每次调用可不同） |
| 静态成员 | ❌ 不能用类的 T | ✅ 静态方法可以有自己的 T |
| 典型用途 | 容器类、包装类 | 工具方法、转换方法 |

#### 2.3 泛型接口

```java
// 定义
public interface Comparable<T> {
    int compareTo(T o);
}

public interface Function<T, R> {              // JDK 8 函数式接口
    R apply(T t);
}

public interface Converter<S, T> {
    T convert(S source);
}

// 实现方式 1：实现时指定具体类型
public class UserComparable implements Comparable<User> {
    @Override
    public int compareTo(User o) {
        return this.getId().compareTo(o.getId());
    }
}

// 实现方式 2：实现类也是泛型类（传递类型参数）
public class BaseConverter<S, T> implements Converter<S, T> {
    @Override
    public T convert(S source) { /* ... */ return null; }
}

// 实现方式 3：实现类不指定类型（原始类型，会有警告）
public class RawConverter implements Converter {         // ⚠️ unchecked
    @Override
    public Object convert(Object source) { return null; }
}
```

**泛型接口的典型应用（Spring 中大量使用）：**

```java
// Spring 的通用 CRUD 接口
public interface BaseService<T, ID> {
    T findById(ID id);
    List<T> findAll();
    void save(T entity);
    void deleteById(ID id);
}

// 各业务实现只需指定类型
public class UserService implements BaseService<User, Long> {
    public User findById(Long id) { ... }
    public List<User> findAll() { ... }
    ...
}

// MyBatis-Plus 的 BaseMapper
public interface UserMapper extends BaseMapper<User> { }   // 自动拥有 17 个 CRUD 方法

// Spring Data JPA
public interface UserRepository extends JpaRepository<User, Long> { }
```

### 3. 类型通配符与上下界 ★★★★★

#### 3.1 为什么需要通配符

```java
// ❌ 泛型不具有继承性（协变）！即使 Integer 是 Number 的子类
List<Integer> intList = new ArrayList<>();
// List<Number> numList = intList;      // 编译错误！List<Integer> 不是 List<Number> 的子类型

// 原因：如果允许，就会出现类型漏洞
List<Number> numList = intList;         // 假设允许
numList.add(3.14);                       // 加入 Double（对 List<Number> 合法）
Integer i = intList.get(1);              // 但 intList 里现在是 Double → ClassCastException！
```

> 【面试】这叫**泛型的不变性（invariance）**。Java 泛型是「不变的」，`List&lt;Integer&gt;` 与 `List&lt;Number&gt;` 没有继承关系。这是为了类型安全（避免上面的「堆污染 heap pollution」）。
>
> 对比：数组是**协变的**（`Integer[]` 是 `Number[]` 的子类型），但这带来了运行时错误：
> ```java
> Integer[] ints = new Integer[10];
> Number[] nums = ints;          // ✅ 数组协变，编译通过
> nums[0] = 3.14;                // ❌ ArrayStoreException（运行时才发现）
> ```
> **泛型的不变性正是为了把这个错误提前到编译期。**

#### 3.2 无界通配符 `<?>`

```java
// ? 表示「未知类型」，用于「只读」场景
public static void printAll(List<?> list) {
    for (Object o : list) {
        System.out.println(o);           // ✅ 只能当 Object 读
    }
    System.out.println(list.size());     // ✅ 与类型无关的方法可用
    // list.add("x");                    // ❌ 编译错误：不能添加（除了 null）
    // list.add(new Object());           // ❌
    list.add(null);                       // ✅ null 是唯一能加的
    // Object o = list.get(0);           // ✅ 但只能赋值给 Object
}

// 常见用途
public void process(List<?> list) { }
Class<?> clazz = obj.getClass();          // Class 的通配符
Optional<?> opt = ...;
Map<?, ?> map = ...;
```

**`List<?>` 与 `List&lt;Object&gt;` 的区别（易混）：**

| | `List<?>` | `List&lt;Object&gt;` |
| --- | --- | --- |
| 含义 | 某种**未知但确定**的类型 | 明确是 Object 类型 |
| 能接受 `List&lt;String&gt;` | ✅ | ❌（`List&lt;String&gt;` 不是 `List&lt;Object&gt;` 的子类型） |
| 能 add 元素 | ❌（除 null） | ✅（任何对象） |
| get 的类型 | `Object` | `Object` |
| 用途 | 只读操作、类型无关的方法 | 需要存任意类型 |

```java
List<String> strings = new ArrayList<>();
List<?> wildcard = strings;         // ✅
// List<Object> objects = strings;  // ❌ 编译错误
```

#### 3.3 上界通配符 `<? extends T>`（协变，Producer）

```java
// ? extends Number：Number 本身或其任意子类（Integer、Double、BigDecimal...）
public static double sum(List<? extends Number> list) {
    double total = 0;
    for (Number n : list) {              // ✅ 可以当 Number 读（上界确定）
        total += n.doubleValue();
    }
    // list.add(1);                       // ❌ 不能添加任何元素（除 null）
    // 原因：编译器不知道 list 具体是 List<Integer> 还是 List<Double>，
    //      如果传进来的是 List<Double>，add(1) 就破坏了类型安全
    return total;
}

sum(List.of(1, 2, 3));                   // ✅ List<Integer>
sum(List.of(1.5, 2.5));                  // ✅ List<Double>
sum(List.of(new BigDecimal("1")));       // ✅ List<BigDecimal>

// JDK 源码示例
public static <T extends Comparable<? super T>> void sort(List<T> list) { ... }
// Collections.max(Collection<? extends T>)
public static <T> T max(Collection<? extends T> coll) { ... }
```

#### 3.4 下界通配符 `<? super T>`（逆变，Consumer）

```java
// ? super Integer：Integer 本身或其任意父类（Number、Object）
public static void addNumbers(List<? super Integer> list) {
    list.add(1);                          // ✅ 可以添加 Integer（及其子类）
    list.add(2);
    // Integer i = list.get(0);           // ❌ 读取只能得到 Object
    Object o = list.get(0);               // ✅
}

addNumbers(new ArrayList<Integer>());     // ✅
addNumbers(new ArrayList<Number>());     // ✅
addNumbers(new ArrayList<Object>());     // ✅

// 典型应用：Comparator
Comparator<? super User> comparator = ...;
// 可以是 Comparator<User>、Comparator<Person>（User 的父类）、Comparator<Object>
```

#### 3.5 PECS 原则 ★★★★★（必背）

**PECS = Producer Extends, Consumer Super**（生产者用 extends，消费者用 super）

| 场景 | 通配符 | 理由 | 记忆 |
| --- | --- | --- | --- |
| **只读取**集合（集合是数据的生产者） | `<? extends T>` | 读取时能确定上界类型，安全 | **P**roducer **E**xtends |
| **只写入**集合（集合是数据的消费者） | `<? super T>` | 写入 T 及其子类都安全 | **C**onsumer **S**uper |
| 既读又写 | `&lt;T&gt;`（精确类型） | 通配符无法同时满足 | — |

```java
// JDK 源码中的 PECS 典范：Collections.copy
public static <T> void copy(List<? super T> dest,       // dest 是消费者（写入）→ super
                            List<? extends T> src) {      // src 是生产者（读取）→ extends
    for (int i = 0; i < src.size(); i++)
        dest.set(i, src.get(i));
}

// Stack 弹出到集合
public static <T> void popAll(Collection<? super T> dst, Stack<T> src) {
    while (!src.isEmpty())
        dst.add(src.pop());           // dst 消费数据 → super
}

// 集合压入 Stack
public static <T> void pushAll(Collection<? extends T> src, Stack<T> dst) {
    for (T t : src)
        dst.push(t);                  // src 生产数据 → extends
}

// 实战：类型转换工具
public static <T> List<T> filter(List<? extends T> source,       // 读 source → extends
                                 Predicate<? super T> predicate, // 消费 T → super
                                 List<? super T> target) {        // 写 target → super
    for (T item : source) {
        if (predicate.test(item)) target.add(item);
    }
    return (List<T>) target;
}
```

**通配符速查表：**

| 写法 | 含义 | 能读 | 能写 | 用途 |
| --- | --- | --- | --- | --- |
| `List&lt;T&gt;` | 精确类型 T | ✅ T | ✅ T | 既读又写 |
| `List<?>` | 未知类型 | 只能当 Object | ❌（除 null） | 完全类型无关的操作 |
| `List<? extends T>` | T 或其子类 | ✅ T | ❌（除 null） | **只读**（生产者） |
| `List<? super T>` | T 或其父类 | 只能当 Object | ✅ T 及其子类 | **只写**（消费者） |
| `List&lt;Object&gt;` | 明确 Object | ✅ Object | ✅ 任意对象 | 存异构数据 |
| `List`（原始类型） | 无泛型 | ✅ Object | ✅ 任意 | ❌ **禁用**，丢失类型检查 |

#### 3.6 类型边界（Bounded Type Parameter）

```java
// 上界：T 必须是 Comparable 的子类型
public static <T extends Comparable<T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;      // 因为 T 保证有 compareTo 方法
}

// 多重边界：T 必须同时满足多个约束（用 & 连接，最多一个类且必须在最前）
public static <T extends Number & Comparable<T> & Serializable> void process(T t) {
    t.doubleValue();          // Number 的方法
    t.compareTo(t);           // Comparable 的方法
}

// 接口作为边界
public interface Closeable {
    void close();
}
public static <T extends Closeable> void safeClose(T resource) {
    resource.close();
}

// JDK 源码示例
public class Enum<E extends Enum<E>> { }      // 递归类型边界（自我引用）
public class ThreadLocal<T> {
    protected T initialValue() { return null; }
}
public interface Comparable<T> {
    int compareTo(T o);
}
// Collections.sort 的签名（经典 PECS + 边界）
public static <T extends Comparable<? super T>> void sort(List<T> list)
```

**递归类型边界（F-Bounded Polymorphism）：**

```java
// 用于 Builder 模式的类型安全继承
public abstract class Builder<T extends Builder<T>> {
    public T name(String name) { ...; return self(); }
    public T age(int age) { ...; return self(); }
    protected abstract T self();          // 返回自己的类型
}

public class UserBuilder extends Builder<UserBuilder> {
    @Override protected UserBuilder self() { return this; }
    public User build() { ... }
}

// 效果：链式调用不会丢失子类类型
User user = new UserBuilder().name("Tom").age(20).build();
//                          ↑ 返回 UserBuilder 而非 Builder，能继续调 build()

// 枚举的 Comparable 也是递归边界
public enum OrderStatus implements Comparable<OrderStatus> { }
// Enum<E extends Enum<E>> 保证枚举只能和自己比较
```

### 4. 类型擦除（Type Erasure）★★★★★

#### 4.1 什么是类型擦除

**Java 的泛型是「编译期特性」，编译后所有泛型信息都被擦除，运行时不存在泛型类型。**

```java
List<String> strings = new ArrayList<>();
List<Integer> ints = new ArrayList<>();

// 运行时它们是同一个类！
System.out.println(strings.getClass() == ints.getClass());   // true！都是 ArrayList.class
System.out.println(strings.getClass());                       // class java.util.ArrayList

// 擦除规则
// 无界类型参数 T        → 擦除为 Object
// 有界类型参数 T extends Number → 擦除为 Number（第一个边界）
// List<String>          → List
// Map<String, Integer>  → Map
```

**字节码验证（javap）：**

```java
public class GenericTest {
    public static void main(String[] args) {
        List<String> list = new ArrayList<>();
        list.add("hello");
        String s = list.get(0);
    }
}
```

```
// javap -c 的输出（泛型已消失）
public static void main(java.lang.String[]);
  Code:
     0: new           #2      // class java/util/ArrayList       ← 没有 <String>
     3: dup
     4: invokespecial #3      // Method java/util/ArrayList."<init>":()V
     7: astore_1
     8: aload_1
     9: ldc           #4      // String hello
    11: invokeinterface #5,  2 // InterfaceMethod java/util/List.add:(Ljava/lang/Object;)Z
                                                          ↑ 参数是 Object，不是 String
    16: pop
    17: aload_1
    18: iconst_0
    19: invokeinterface #6,  2 // InterfaceMethod java/util/List.get:(I)Ljava/lang/Object;
                                                          ↑ 返回 Object
    24: checkcast     #7      // class java/lang/String   ← ★ 编译器自动插入强转！
    27: astore_2
```

**结论：**
1. `list.add("hello")` 编译后是 `add(Object)`。
2. `list.get(0)` 编译后返回 `Object`，**编译器自动插入 `checkcast` 指令**强转为 String。
3. 所以「泛型的类型安全」是**编译器保证的**，运行时全靠自动插入的强转。

#### 4.2 为什么要类型擦除

**为了向后兼容 JDK 5 之前的代码**（这是 Java 泛型最大的历史包袱）：

```java
// JDK 5 的老代码（原始类型）
List oldList = new ArrayList();
oldList.add("x");

// JDK 5 的新代码（泛型）
List<String> newList = new ArrayList<>();
newList.add("y");

// 擦除后两者字节码相同，可以互相调用（老库和新代码无缝互操作）
```

> 【对比】C# 的泛型是**运行时具化（reification）**，`List&lt;int&gt;` 和 `List&lt;string&gt;` 在 CLR 中是不同类型，能保留泛型信息、支持 `new T()`、性能更好。Java 选择了擦除，换来兼容性但牺牲了很多能力。

#### 4.3 类型擦除带来的限制（面试高频）

```java
// 限制 1：不能 new 类型参数
public <T> void f() {
    // T obj = new T();                    // ❌ 擦除后不知道 T 是什么
    // 解决：传入 Class 或 Supplier
    T obj = clazz.getDeclaredConstructor().newInstance();
    T obj2 = supplier.get();
}

// 限制 2：不能创建泛型数组
public <T> void f() {
    // T[] arr = new T[10];                // ❌
    // 解决 1：Object[] + 强转（unchecked 警告）
    T[] arr = (T[]) new Object[10];
    // 解决 2：反射（类型安全）
    T[] arr2 = (T[]) Array.newInstance(clazz, 10);
    // 解决 3：用 List 代替数组
    List<T> list = new ArrayList<>();
}

// 限制 3：不能对泛型用 instanceof / getClass 判断
if (obj instanceof List<String>) { }     // ❌ 编译错误
if (obj instanceof List<?>) { }          // ✅ 只能这样
if (obj instanceof List) { }             // ✅ 原始类型可以
list.getClass() == ArrayList.class;      // ✅ 无法获取泛型参数

// 限制 4：不能用基本类型作类型参数
// List<int> list;                        // ❌ 擦除后是 Object，无法存基本类型
List<Integer> list;                      // ✅ 装箱（有性能开销）
// 解决：JDK 的特化集合库（Eclipse Collections、fastutil、Koloboke）提供 IntList、LongMap 等

// 限制 5：不能 catch/throw 类型参数
// catch (T e) { }                        // ❌
// throw new T();                         // ❌

// 限制 6：重载冲突（擦除后签名相同）
public void f(List<String> list) { }
// public void f(List<Integer> list) { }  // ❌ 擦除后都是 f(List)，签名冲突！

// 限制 7：静态成员不能用类的类型参数
public class Foo<T> {
    // static T field;                     // ❌
    // static T method() { }               // ❌
    static <T> T staticMethod() { }        // ✅ 方法自己的类型参数可以
}

// 限制 8：泛型类不能 extends Throwable（异常无法擦除后仍保持类型）
// class MyException<T> extends Exception { }   // ❌
```

#### 4.4 桥接方法（Bridge Method）

**类型擦除会破坏多态，编译器用「桥接方法」修复：**

```java
class Node<T> {
    public void set(T t) { System.out.println("Node.set"); }
}
class MyNode extends Node<Integer> {
    @Override
    public void set(Integer i) { System.out.println("MyNode.set"); }
}

Node<Integer> node = new MyNode();
node.set(1);        // 输出 "MyNode.set"（多态正常）
```

**如果没有桥接方法会怎样？**

```
擦除后：
  Node.set(Object)             ← 父类方法签名
  MyNode.set(Integer)          ← 子类方法签名（参数类型不同，不构成重写！）

node.set(1) 时，node 的声明类型是 Node，调用 Node.set(Object)，
而 MyNode 只有 set(Integer)，动态分派找不到重写方法 → 调用了 Node.set → 多态失效！
```

**编译器的解决方案 —— 自动生成桥接方法：**

```java
// javap -c MyNode 会看到两个 set 方法
public class MyNode extends Node<Integer> {
    public void set(Integer i) { ... }        // 真正的方法

    // ★ 编译器自动生成的桥接方法（synthetic + bridge 标记）
    public synthetic bridge void set(Object o) {
        set((Integer) o);                      // 强转后调用真正的方法
    }
}
```

**桥接方法引发的坑：**

```java
// 坑：反射遍历方法时会看到桥接方法
Method[] methods = MyNode.class.getDeclaredMethods();
// 会看到 set(Integer) 和 set(Object) 两个方法
// 处理时要过滤：
for (Method m : methods) {
    if (m.isBridge() || m.isSynthetic()) continue;   // ★ 跳过桥接和合成方法
}
// 框架（Spring、MyBatis）处理注解时都要过滤桥接方法，否则会重复处理或找不到注解
```

### 5. 泛型的实战应用

#### 5.1 获取泛型的实际类型（反射 + Type 体系）

```java
import java.lang.reflect.*;

// 虽然运行时擦除了泛型，但「类/方法/字段声明处的泛型信息」保留在字节码中（Signature 属性）
// 通过反射可以获取

// 场景 1：通过匿名子类获取泛型类型（Spring 的 ResolvableType、Jackson 的 TypeReference 都这么做）
public abstract class TypeReference<T> {
    private final Type type;

    protected TypeReference() {
        // ★ 关键：getClass().getGenericSuperclass() 保留了泛型信息
        Type superClass = getClass().getGenericSuperclass();
        if (superClass instanceof ParameterizedType) {
            this.type = ((ParameterizedType) superClass).getActualTypeArguments()[0];
        } else {
            throw new IllegalArgumentException("必须通过匿名子类创建");
        }
    }
    public Type getType() { return type; }
}

// 使用（注意末尾的 {}，创建匿名子类）
TypeReference<List<User>> ref = new TypeReference<List<User>>() { };
System.out.println(ref.getType());      // java.util.List<com.example.User>

// Jackson 的实际用法
List<User> users = objectMapper.readValue(json, new TypeReference<List<User>>() { });

// 场景 2：Spring 的 ResolvableType（更强大）
ResolvableType type = ResolvableType.forClassWithGenerics(List.class, User.class);
type.resolve();                        // List
type.getGeneric(0).resolve();          // User
type.asCollection();                   // 转成 Collection 视角
ResolvableType.forInstance(obj);       // 从实例推断
ResolvableType.forMethodParameter(method, 0);   // 方法参数的泛型

// 场景 3：获取类继承链上的泛型（BaseService<T, ID> 场景）
public abstract class BaseService<T, ID> {
    protected Class<T> entityClass;
    protected Class<ID> idClass;

    @SuppressWarnings("unchecked")
    public BaseService() {
        Type superClass = getClass().getGenericSuperclass();
        if (superClass instanceof ParameterizedType) {
            Type[] args = ((ParameterizedType) superClass).getActualTypeArguments();
            this.entityClass = (Class<T>) args[0];
            this.idClass = (Class<ID>) args[1];
        }
    }
}
public class UserService extends BaseService<User, Long> { }
// new UserService().entityClass == User.class  ✅

// 场景 4：Type 体系（JDK 反射）
// Type 是所有类型的父接口，5 个实现：
// - Class              原始类型（String.class）
// - ParameterizedType  参数化类型（List<String>）
//     .getRawType()             → List
//     .getActualTypeArguments() → [String]
//     .getOwnerType()           → 外部类（内部类时）
// - GenericArrayType   泛型数组（T[]、List<String>[]）
//     .getGenericComponentType()
// - TypeVariable       类型变量（T）
//     .getName()、.getBounds()
// - WildcardType       通配符（? extends Number）
//     .getUpperBounds()、.getLowerBounds()

// 获取方法的泛型签名
Method method = clazz.getMethod("process", List.class);
Type[] paramTypes = method.getGenericParameterTypes();     // 含泛型信息
Type returnType = method.getGenericReturnType();
// 获取字段的泛型
Field field = clazz.getDeclaredField("list");
Type fieldType = field.getGenericType();
```

#### 5.2 泛型方法实战工具箱

```java
public final class GenericUtils {

    private GenericUtils() { }

    /** 安全的类型转换（避免散落的 @SuppressWarnings） */
    @SuppressWarnings("unchecked")
    public static <T> T cast(Object obj) {
        return (T) obj;
    }

    /** 类型安全的转换（失败返回 null） */
    public static <T> T castOrNull(Object obj, Class<T> clazz) {
        return clazz.isInstance(obj) ? clazz.cast(obj) : null;
    }

    /** 批量转换 List 类型 */
    public static <S, T> List<T> convertList(List<S> source, Function<S, T> converter) {
        if (source == null) return Collections.emptyList();
        return source.stream().map(converter).collect(Collectors.toList());
    }

    /** 实体 → DTO 的通用转换 */
    public static <S, T> List<T> mapList(List<S> sources, Class<T> targetClass) {
        return sources.stream()
                .map(s -> BeanUtil.copyProperties(s, targetClass))
                .collect(Collectors.toList());
    }

    /** 分页转换 */
    public static <S, T> PageResult<T> convertPage(PageResult<S> source, Function<S, T> converter) {
        List<T> records = source.getRecords().stream().map(converter).collect(Collectors.toList());
        return new PageResult<>(records, source.getTotal(), source.getPageNum(), source.getPageSize());
    }

    /** 泛型三元（类型安全的默认值） */
    public static <T> T defaultIfNull(T value, T defaultValue) {
        return value != null ? value : defaultValue;
    }

    /** 从 Map 安全取值并转换 */
    public static <T> T getAs(Map<String, Object> map, String key, Class<T> type, T defaultValue) {
        Object v = map.get(key);
        if (v == null) return defaultValue;
        return type.isInstance(v) ? type.cast(v) : defaultValue;
    }

    /** 构建不可变 Map（避免 Map.of 的数量限制） */
    public static <K, V> Map<K, V> mapOf(Object... kvs) {
        if (kvs.length % 2 != 0) throw new IllegalArgumentException("参数必须成对");
        Map<K, V> map = new LinkedHashMap<>();
        for (int i = 0; i < kvs.length; i += 2) {
            map.put((K) kvs[i], (V) kvs[i + 1]);
        }
        return Collections.unmodifiableMap(map);
    }

    /** 泛型数组创建 */
    @SuppressWarnings("unchecked")
    public static <T> T[] newArray(Class<T> clazz, int size) {
        return (T[]) Array.newInstance(clazz, size);
    }

    /** 交换泛型 Map 的 K/V */
    public static <K, V> Map<V, List<K>> invertMultiMap(Map<K, V> map) {
        return map.entrySet().stream()
                .collect(Collectors.groupingBy(Map.Entry::getValue,
                        Collectors.mapping(Map.Entry::getKey, Collectors.toList())));
    }
}
```

#### 5.3 泛型与继承的组合应用

```java
// 通用分页响应（泛型嵌套）
public class PageResult<T> {
    private List<T> records;
    private long total;
    private int pageNum;
    private int pageSize;
    private int pages;

    public static <T> PageResult<T> of(List<T> records, long total, int pageNum, int pageSize) {
        PageResult<T> r = new PageResult<>();
        r.records = records;
        r.total = total;
        r.pageNum = pageNum;
        r.pageSize = pageSize;
        r.pages = (int) Math.ceil((double) total / pageSize);
        return r;
    }

    /** 类型转换（保持分页信息） */
    public <R> PageResult<R> map(Function<T, R> mapper) {
        List<R> newRecords = records.stream().map(mapper).collect(Collectors.toList());
        return PageResult.of(newRecords, total, pageNum, pageSize);
    }
}
// 使用
PageResult<User> userPage = ...;
PageResult<UserVO> voPage = userPage.map(this::toVO);      // 一行完成类型转换

// 泛型的泛型
Result<PageResult<UserVO>> response = Result.success(voPage);
Map<String, List<Map<Long, User>>> complex = new HashMap<>();
```

## 第二部分：枚举（Enum）

### 6. 枚举的本质

**枚举（enum）是 JDK 5 引入的特殊类，本质是「实例数量固定的类」，隐式继承 `java.lang.Enum`。**

```java
// 定义
public enum Season {
    SPRING, SUMMER, AUTUMN, WINTER;
}

// 反编译后（javap -p Season.class）等价于：
public final class Season extends Enum<Season> {
    public static final Season SPRING = new Season("SPRING", 0);
    public static final Season SUMMER = new Season("SUMMER", 1);
    public static final Season AUTUMN = new Season("AUTUMN", 2);
    public static final Season WINTER = new Season("WINTER", 3);

    private static final Season[] $VALUES;         // 所有实例的数组

    static {
        SPRING = new Season("SPRING", 0);
        ...
        $VALUES = new Season[]{SPRING, SUMMER, AUTUMN, WINTER};
    }

    private Season(String name, int ordinal) { super(name, ordinal); }

    public static Season[] values() { return $VALUES.clone(); }
    public static Season valueOf(String name) { /* 查 $VALUES */ }
}
```

**枚举的特性：**

| 特性 | 说明 |
| --- | --- |
| 隐式继承 `java.lang.Enum` | 所以**枚举不能再 extends 其他类**（但可以实现接口） |
| 隐式 `final` 类 | 不能被继承 |
| 实例是 `public static final` | 单例性质，全局唯一 |
| 构造器隐式 `private` | **不能在外部 new 枚举实例** |
| 类加载时创建所有实例 | 静态代码块中初始化，**线程安全**（JVM 保证） |
| 实现了 `Comparable`、`Serializable` | 可比较（按 ordinal）、可序列化 |
| 每个实例有 `name()` 和 `ordinal()` | 名称和序号（从 0 开始） |

### 7. Enum 类的方法

```java
Season s = Season.SPRING;

s.name();                    // "SPRING"（final，不可重写）
s.ordinal();                 // 0（声明顺序，final，不可重写）
s.toString();                // "SPRING"（默认返回 name，可重写）
s.compareTo(Season.WINTER);  // -3（ordinal 相减）
s.equals(Season.SPRING);     // true（Enum 的 equals 就是 ==）
s.getDeclaringClass();       // class Season
s.hashCode();                // 身份哈希（final）

// 静态方法
Season.valueOf("SPRING");    // 按名称获取，找不到抛 IllegalArgumentException
Season.valueOf(Season.class, "SUMMER");
Season.values();             // 所有实例的数组（编译器生成，每次返回 clone）

// 【坑】ordinal 不要用于业务！
// ordinal 是声明顺序，新增/删除/重排枚举值会改变 ordinal，
// 如果用 ordinal 存数据库，数据全部错乱！
// ✅ 自定义 code 字段
public enum Status {
    ACTIVE(1, "启用"),
    INACTIVE(0, "禁用");
    private final int code;
    private final String desc;
    ...
}
```

### 8. 枚举的高级用法

#### 8.1 带字段、构造器和方法的枚举

```java
/**
 * HTTP 状态码枚举（携带数据 + 行为）
 */
public enum HttpStatus {

    OK(200, "请求成功"),
    CREATED(201, "创建成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未认证"),
    FORBIDDEN(403, "无权限"),
    NOT_FOUND(404, "资源不存在"),
    METHOD_NOT_ALLOWED(405, "方法不允许"),
    CONFLICT(409, "资源冲突"),
    INTERNAL_SERVER_ERROR(500, "服务器内部错误"),
    BAD_GATEWAY(502, "网关错误"),
    SERVICE_UNAVAILABLE(503, "服务不可用"),
    GATEWAY_TIMEOUT(504, "网关超时");

    private final int code;
    private final String reason;

    // 构造器必须是 private（可省略，隐式 private）
    HttpStatus(int code, String reason) {
        this.code = code;
        this.reason = reason;
    }

    public int getCode() { return code; }
    public String getReason() { return reason; }

    public boolean is2xxSuccessful() { return code >= 200 && code < 300; }
    public boolean is4xxClientError() { return code >= 400 && code < 500; }
    public boolean is5xxServerError() { return code >= 500 && code < 600; }
    public boolean isError() { return is4xxClientError() || is5xxServerError(); }

    // 静态查找（用 Map 缓存，避免每次遍历 values()）
    private static final Map<Integer, HttpStatus> CODE_MAP =
            Arrays.stream(values()).collect(Collectors.toMap(HttpStatus::getCode, s -> s));

    public static HttpStatus of(int code) {
        HttpStatus status = CODE_MAP.get(code);
        if (status == null) throw new IllegalArgumentException("未知状态码：" + code);
        return status;
    }

    public static Optional<HttpStatus> find(int code) {
        return Optional.ofNullable(CODE_MAP.get(code));
    }

    @Override
    public String toString() {
        return code + " " + name();
    }
}
```

> 【性能】`values()` 每次调用都会**克隆数组**（防御性拷贝），高频调用有性能开销。**需要反查时用静态 Map 缓存**（如上面的 `CODE_MAP`）。

#### 8.2 枚举实现接口

```java
// 枚举不能 extends 类，但可以 implements 接口
public interface Describable {
    String getDescription();
}

public interface JsonSerializable {
    String toJson();
}

public enum OrderType implements Describable, JsonSerializable {
    NORMAL("普通订单"),
    FLASH_SALE("秒杀订单"),
    GROUP_BUY("拼团订单");

    private final String description;

    OrderType(String description) { this.description = description; }

    @Override
    public String getDescription() { return description; }

    @Override
    public String toJson() {
        return String.format("{\"type\":\"%s\",\"desc\":\"%s\"}", name(), description);
    }
}
```

#### 8.3 枚举的抽象方法（每个值有不同实现）★★★★★

```java
/**
 * 运算枚举：每个枚举值实现自己的 apply 逻辑（多态）
 * 这是消除 switch/if-else 的利器
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
    },
    MOD("%") {
        @Override public double apply(double x, double y) { return x % y; }
    };

    private final String symbol;

    Operation(String symbol) { this.symbol = symbol; }

    public String getSymbol() { return symbol; }

    /** 抽象方法：每个枚举值必须实现（编译期强制，新增运算不会漏） */
    public abstract double apply(double x, double y);

    /** 从符号反查（比 switch 更优雅） */
    public static Operation fromSymbol(String symbol) {
        return Arrays.stream(values())
                .filter(op -> op.symbol.equals(symbol))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("未知运算符：" + symbol));
    }
}

// 使用：完全消除 switch
double result = Operation.PLUS.apply(3, 5);        // 8.0
Operation op = Operation.fromSymbol("*");
System.out.println(op.apply(4, 5));                 // 20.0

// 对比 switch 写法（新增运算要改多处，容易漏）
switch (symbol) {
    case "+": return x + y;
    case "-": return x - y;
    // 忘记加 case "%" → 静默 bug
}
```

**编译器如何保证完整性？** 如果用 `switch(枚举)` 且没有 default，新增枚举值时 IDE/编译器会提示；而抽象方法方式，**新增枚举值必须实现抽象方法，否则直接编译错误**——这是更强的保证。

#### 8.4 枚举实现状态机

```java
/**
 * 订单状态机：状态 + 允许的事件 + 转换规则
 */
public enum OrderState {

    CREATED("已创建") {
        @Override
        public OrderState next(OrderEvent event) {
            return switch (event) {
                case PAY -> PAID;
                case CANCEL -> CANCELLED;
                default -> throw illegalTransition(this, event);
            };
        }
        @Override public boolean canCancel() { return true; }
    },

    PAID("已支付") {
        @Override
        public OrderState next(OrderEvent event) {
            return switch (event) {
                case SHIP -> SHIPPED;
                case REFUND -> REFUNDED;
                case CANCEL -> CANCELLED;
                default -> throw illegalTransition(this, event);
            };
        }
        @Override public boolean canCancel() { return true; }
        @Override public boolean canRefund() { return true; }
    },

    SHIPPED("已发货") {
        @Override
        public OrderState next(OrderEvent event) {
            return switch (event) {
                case CONFIRM -> COMPLETED;
                default -> throw illegalTransition(this, event);
            };
        }
        @Override public boolean canCancel() { return false; }
    },

    COMPLETED("已完成") {
        @Override
        public OrderState next(OrderEvent event) {
            return switch (event) {
                case AFTER_SALE -> AFTER_SALE_STATE;
                default -> throw illegalTransition(this, event);
            };
        }
        @Override public boolean canCancel() { return false; }
    },

    CANCELLED("已取消") {
        @Override
        public OrderState next(OrderEvent event) {
            throw illegalTransition(this, event);      // 终态，不能转换
        }
        @Override public boolean isFinal() { return true; }
    },

    REFUNDED("已退款") {
        @Override public OrderState next(OrderEvent e) { throw illegalTransition(this, e); }
        @Override public boolean isFinal() { return true; }
    },

    AFTER_SALE_STATE("售后中") {
        @Override public OrderState next(OrderEvent e) { throw illegalTransition(this, e); }
    };

    private final String desc;

    OrderState(String desc) { this.desc = desc; }
    public String getDesc() { return desc; }

    /** 抽象：状态转换规则（每个状态自己定义） */
    public abstract OrderState next(OrderEvent event);

    /** 钩子：默认返回 false */
    public boolean canCancel() { return false; }
    public boolean canRefund() { return false; }
    public boolean isFinal() { return false; }

    /** 校验并转换（统一入口） */
    public OrderState transition(OrderEvent event) {
        OrderState next = next(event);
        System.out.printf("状态流转：%s --[%s]--> %s%n", this.desc, event, next.desc);
        return next;
    }

    private static IllegalStateException illegalTransition(OrderState from, OrderEvent event) {
        return new IllegalStateException(
            String.format("非法状态流转：%s 不接受事件 %s", from.desc, event));
    }
}

public enum OrderEvent { PAY, SHIP, CONFIRM, CANCEL, REFUND, AFTER_SALE }

// 使用
OrderState state = OrderState.CREATED;
state = state.transition(OrderEvent.PAY);        // CREATED → PAID
state = state.transition(OrderEvent.SHIP);       // PAID → SHIPPED
state = state.transition(OrderEvent.CONFIRM);    // SHIPPED → COMPLETED
try {
    state.transition(OrderEvent.PAY);            // ❌ IllegalStateException
} catch (IllegalStateException e) {
    System.out.println(e.getMessage());
}
```

**枚举状态机的优势：**
1. 转换规则集中定义，一目了然。
2. 非法转换在编译期/运行期立即暴露。
3. 新增状态时，抽象方法强制要求实现 `next()`。
4. 无线程安全问题（枚举实例是单例且状态转换是纯函数）。

#### 8.5 EnumMap 与 EnumSet（枚举专用集合）

```java
// EnumSet：底层是位向量（long 的位），性能远超 HashSet
EnumSet<OrderState> cancellableStates = EnumSet.of(OrderState.CREATED, OrderState.PAID);
EnumSet<OrderState> all = EnumSet.allOf(OrderState.class);
EnumSet<OrderState> none = EnumSet.noneOf(OrderState.class);
EnumSet<OrderState> range = EnumSet.range(OrderState.CREATED, OrderState.SHIPPED);   // 闭区间
EnumSet<OrderState> complement = EnumSet.complementOf(cancellableStates);            // 补集
cancellableStates.contains(state);       // O(1)，实际是位运算

// EnumMap：底层是数组（下标 = ordinal），极致性能
EnumMap<OrderState, StateHandler> handlers = new EnumMap<>(OrderState.class);
handlers.put(OrderState.CREATED, new CreatedHandler());
handlers.put(OrderState.PAID, new PaidHandler());
StateHandler handler = handlers.get(state);      // O(1) 数组访问，无哈希计算

// 对比性能（100 万次 get）
// HashMap:    ~30 ms
// EnumMap:    ~5 ms      ← 快 6 倍
// EnumSet.contains vs HashSet.contains 同理
```

> 【推荐】**key 是枚举时一律用 EnumMap/EnumSet**：性能高、内存省、遍历顺序是枚举声明顺序（天然有序）。

#### 8.6 枚举做单例（最佳实践）

```java
/**
 * 《Effective Java》第 3 条：枚举是实现单例的最佳方式
 */
public enum Singleton {
    INSTANCE;

    private final Map<String, Object> cache = new ConcurrentHashMap<>();
    private final AtomicLong counter = new AtomicLong();

    public void put(String key, Object value) { cache.put(key, value); }
    public Object get(String key) { return cache.get(key); }
    public long nextId() { return counter.incrementAndGet(); }
}

// 使用
Singleton.INSTANCE.put("k", "v");
Singleton.INSTANCE.get("k");
```

**为什么枚举单例最好？**

| 攻击/问题 | 双重检查锁单例 | 静态内部类单例 | **枚举单例** |
| --- | --- | --- | --- |
| 多线程安全 | ✅（需 volatile + synchronized） | ✅（JVM 类加载保证） | ✅（JVM 保证枚举实例唯一） |
| 反射攻击 | ❌ 可用 `setAccessible(true)` 调私有构造器创建新实例 | ❌ 同上 | ✅ **反射无法创建枚举实例**（`Constructor.newInstance` 对枚举抛 `IllegalArgumentException`） |
| 序列化攻击 | ❌ 反序列化会创建新实例（需 `readResolve`） | ❌ 同上 | ✅ **序列化机制特殊处理枚举，保证唯一** |
| 代码量 | 多 | 中 | **极少** |
| 缺点 | 复杂易错 | 不能懒加载？（可以） | 不能继承其他类；语义上略奇怪 |

```java
// 反射攻击普通单例（能成功破坏）
Constructor<Singleton2> c = Singleton2.class.getDeclaredConstructor();
c.setAccessible(true);
Singleton2 hack = c.newInstance();      // 得到第二个实例！

// 反射攻击枚举（被 JDK 主动阻止）
Constructor<Singleton> c = Singleton.class.getDeclaredConstructor();
// NoSuchMethodException！枚举没有可调用的构造器
// 即使找到，Constructor.newInstance 源码中有：
// if ((clazz.getModifiers() & Modifier.ENUM) != 0)
//     throw new IllegalArgumentException("Cannot reflectively create enum objects");
```

### 9. 枚举的坑与规范

```java
// 坑 1：用 ordinal 存数据库
// 数据库存 ordinal=1，后来在 PAID 前面插入了新枚举 → 所有数据的含义都变了！
// ✅ 用自定义 code 字段
public enum Status {
    ENABLED(1), DISABLED(0);      // 显式 code，不受顺序影响
    private final int code;
}
// MyBatis 中配置：
// @EnumValue 标注 code 字段（MyBatis-Plus）
// 或实现 IEnum<Integer> 接口

// 坑 2：values() 高频调用（每次都 clone 数组）
for (int i = 0; i < 1000000; i++) {
    for (Status s : Status.values()) { }      // 100 万次数组克隆
}
// ✅ 缓存
private static final Status[] VALUES = Status.values();

// 坑 3：valueOf 抛异常
Status.valueOf("UNKNOWN");       // IllegalArgumentException
// ✅ 安全解析
public static Status ofNullable(String name) {
    return Arrays.stream(values())
            .filter(s -> s.name().equalsIgnoreCase(name))
            .findFirst().orElse(null);
}
// 或用 Apache Commons 的 EnumUtils.getEnum(Status.class, name)（返回 null 不抛异常）

// 坑 4：枚举的 name() 被重命名后，反序列化/数据库数据失效
// ✅ 用 @JsonValue 或自定义 code 保证稳定性
@JsonValue
public int getCode() { return code; }
@JsonCreator
public static Status fromCode(int code) { ... }

// 坑 5：枚举实现接口后，不能用接口类型访问枚举特有方法
Describable d = OrderType.NORMAL;
// d.name();     // ❌ Describable 没有 name()

// 坑 6：switch 枚举忘记处理新增值
// ✅ 不写 default，让编译器/IDE 提示未覆盖的分支
switch (state) {
    case CREATED: ...; break;
    case PAID: ...; break;
    // 不加 default，新增枚举值时 IDE 会警告
}
// ✅ 更好：用 JDK 14 switch 表达式（穷尽性检查）
String desc = switch (state) {
    case CREATED -> "已创建";
    case PAID -> "已支付";
    // 少一个分支直接编译错误！
};
```

**枚举使用规范（阿里手册）：**

- 【强制】枚举类名带 `Enum` 后缀，枚举成员全大写下划线分隔（`OrderStatusEnum.PAID`）。
- 【强制】枚举可以直接用 `==` 比较（比 equals 更快且 null 安全）。
- 【推荐】不要用 ordinal 做持久化，自定义 code 字段。
- 【推荐】需要「一组常量」且常量间有行为差异时，用枚举 + 抽象方法。
- 【推荐】单例优先用枚举实现。

## 第三部分：注解（Annotation）

### 10. 注解的本质

**注解（JDK 5+）是代码里的「元数据标记」，本身不改变代码语义，需要配合「读取注解的代码」（反射/编译期处理器）才能发挥作用。**

```java
// 注解的本质：继承 java.lang.annotation.Annotation 的接口
public @interface MyAnnotation { }

// 编译后等价于
public interface MyAnnotation extends java.lang.annotation.Annotation { }

// 所以注解不能被类 implements，只能通过反射读取
```

**注解的作用分类：**

| 作用 | 谁读取 | 示例 |
| --- | --- | --- |
| **编译期检查** | 编译器 | `@Override`、`@Deprecated`、`@SuppressWarnings` |
| **编译期代码生成** | 注解处理器（APT） | Lombok、MapStruct、Dagger、ButterKnife |
| **运行时反射处理** | 框架代码 | Spring 的 `@Autowired`、`@Service`；MyBatis 的 `@Select` |
| **文档生成** | javadoc | `@param`、`@author`、`@see` |
| **打包/部署描述** | 构建工具、容器 | `@WebServlet`（Servlet 3.0） |

### 11. 元注解（Meta-Annotation）★★★★★

**元注解是「注解的注解」，共 6 个，用于描述注解的行为。**

#### 11.1 @Target（作用目标）

```java
@Target(ElementType.METHOD)          // 只能标注方法
public @interface LogExecutionTime { }

// ElementType 枚举值
public enum ElementType {
    TYPE,               // 类、接口、枚举、注解（最常用）
    FIELD,              // 字段、枚举常量
    METHOD,             // 方法
    PARAMETER,          // 方法参数
    CONSTRUCTOR,        // 构造器
    LOCAL_VARIABLE,     // 局部变量
    ANNOTATION_TYPE,    // 注解类型（元注解用）
    PACKAGE,            // 包（package-info.java）
    MODULE,             // 模块（JDK 9+，module-info.java）
    TYPE_PARAMETER,     // 类型参数（JDK 8+，泛型 <T>）
    TYPE_USE            // 任何类型使用处（JDK 8+，最宽泛：强转、implements、throws 等）
}

// 多个目标
@Target({ElementType.FIELD, ElementType.METHOD, ElementType.PARAMETER})
public @interface NotNull { }

// TYPE_USE 的强大（JDK 8+）
List<@NonNull String> list;                  // 标注泛型参数
String s = (@NonNull String) obj;            // 标注强转
void f() throws @Critical IOException { }    // 标注异常
```

#### 11.2 @Retention（生命周期）★★★★★

```java
@Retention(RetentionPolicy.RUNTIME)      // 保留到运行时（反射可读）
public @interface MyAnno { }

public enum RetentionPolicy {
    SOURCE,      // 只在源码，编译后丢弃（编译器检查用）
    CLASS,       // 保留到 class 文件，但 JVM 加载后丢弃（★ 默认值）
    RUNTIME      // 保留到运行时，反射可读取（框架用）
}
```

| 策略 | 保留到 | 反射可读 | 典型注解 | 用途 |
| --- | --- | --- | --- | --- |
| `SOURCE` | 源码 | ❌ | `@Override`、`@SuppressWarnings`、Lombok 的 `@Data` | 编译器检查、APT 生成代码后丢弃 |
| `CLASS` | .class 文件 | ❌ | 大多数（**默认值**） | 字节码工具处理（如 ProGuard） |
| `RUNTIME` | 运行时 | ✅ | Spring 全家桶、`@Autowired`、JPA、MyBatis | 框架反射处理 |

> 【坑】**自定义注解忘记加 `@Retention(RUNTIME)` → 反射读不到！** 因为默认是 CLASS，运行时已被丢弃。**框架类注解必须显式声明 RUNTIME**。

```java
// 演示：默认 CLASS 策略下反射读不到
public @interface DefaultRetention { }        // 没写 @Retention

@DefaultRetention
public class Test { }

Test.class.isAnnotationPresent(DefaultRetention.class);   // false！
// 加上 @Retention(RetentionPolicy.RUNTIME) 后才是 true
```

#### 11.3 @Documented、@Inherited、@Repeatable

```java
// @Documented：注解会出现在 javadoc 中
@Documented
public @interface ApiDoc { }

// @Inherited：注解可以被子类继承（只对类上的注解有效！）
@Inherited
@Retention(RetentionPolicy.RUNTIME)
public @interface ParentAnno { }

@ParentAnno
class Parent { }
class Child extends Parent { }

Child.class.isAnnotationPresent(ParentAnno.class);    // true（因为有 @Inherited）
// 没有 @Inherited 则返回 false
// ⚠️ 注意：
// 1. 只对「类上的注解」继承，方法/字段上的注解不继承
// 2. 实现接口不会继承接口的注解（只有 extends 类才继承）
// 3. Spring 用 AnnotatedElementUtils 实现了更强的「元注解继承」查找

// @Repeatable（JDK 8+）：允许在同一元素上重复标注同一注解
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@Repeatable(Schedules.class)                 // ★ 指定「容器注解」
public @interface Schedule {
    String cron();
}

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface Schedules {                // 容器注解（value 是被重复注解的数组）
    Schedule[] value();
}

// 使用（可以标多次）
@Schedule(cron = "0 0 8 * * ?")
@Schedule(cron = "0 0 20 * * ?")
public void sendReport() { }

// 读取
Schedule[] schedules = method.getAnnotationsByType(Schedule.class);
Schedules container = method.getAnnotation(Schedules.class);    // 也能读容器

// JDK 中的可重复注解示例
@FindBugs：@SuppressWarnings 不可重复
Spring：@Scheduled 是可重复的（容器是 @Schedules）
JPA：@EntityListeners
```

### 12. 自定义注解 ★★★★★

#### 12.1 注解的定义与属性

```java
/**
 * 操作日志注解（企业级实战案例）
 */
@Target({ElementType.METHOD})                       // 作用于方法
@Retention(RetentionPolicy.RUNTIME)                 // 运行时可读
@Documented                                          // 进 javadoc
public @interface OperationLog {

    /** 操作模块（必填） */
    String module();

    /** 操作类型（有默认值） */
    OperationType type() default OperationType.OTHER;

    /** 操作描述，支持 SpEL 表达式 */
    String detail() default "";

    /** 是否记录请求参数 */
    boolean saveParams() default true;

    /** 是否记录响应结果 */
    boolean saveResult() default false;

    /** 风险等级 */
    RiskLevel risk() default RiskLevel.LOW;

    /** ★ value 是特殊属性：只有一个属性且名为 value 时，使用可省略属性名 */
    String value() default "";

    /** 数组类型属性 */
    String[] roles() default {};

    /** 嵌套注解 */
    Retry retry() default @Retry(times = 0);
}

// 配套枚举
public enum OperationType {
    CREATE("新增"), UPDATE("修改"), DELETE("删除"),
    QUERY("查询"), LOGIN("登录"), LOGOUT("登出"),
    EXPORT("导出"), IMPORT("导入"), OTHER("其他");
    private final String desc;
    OperationType(String desc) { this.desc = desc; }
    public String getDesc() { return desc; }
}

public enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }

// 嵌套注解
@Target({})
@Retention(RetentionPolicy.RUNTIME)
public @interface Retry {
    int times() default 3;
    long delay() default 1000;
}
```

**注解属性的规则：**

| 规则 | 说明 |
| --- | --- |
| 返回类型限制 | 只能是：基本类型、`String`、`Class`、枚举、注解、以上类型的一维数组 |
| 默认值 | 用 `default` 指定；**有默认值的属性使用时可省略** |
| `value` 属性 | 特殊：使用注解时若只赋 value，可省略 `value =` |
| 属性名 | 不能是关键字，通常小驼峰 |
| 不能有参数 | 注解方法不能有参数 |
| 不能有 throws | 注解方法不能声明异常 |
| 数组默认值 | `default &#123;&#125;` 表示空数组 |

```java
// 使用示例
@OperationLog(module = "用户管理", type = OperationType.CREATE, detail = "创建用户")
public void createUser(UserDTO dto) { }

// 只有 value 时省略属性名
@OperationLog("用户管理")                          // 等价 value = "用户管理"
// ⚠️ 但如果有其他必填属性（module 无默认值），就必须写全：
@OperationLog(module = "用户", value = "xxx")

// 数组属性
@OperationLog(module = "订单", roles = {"ADMIN", "OPERATOR"})
// 单元素数组可省略花括号
@OperationLog(module = "订单", roles = "ADMIN")

// 嵌套注解
@OperationLog(module = "支付", retry = @Retry(times = 3, delay = 500))
```

#### 12.2 用反射读取注解

```java
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;

public class AnnotationReader {

    public static void parse(Class<?> clazz) throws Exception {
        // 1. 类上的注解
        if (clazz.isAnnotationPresent(Service.class)) {
            Service service = clazz.getAnnotation(Service.class);
            System.out.println("Bean 名称：" + service.value());
        }

        // 2. 遍历所有方法
        for (Method method : clazz.getDeclaredMethods()) {
            if (!method.isAnnotationPresent(OperationLog.class)) continue;

            OperationLog log = method.getAnnotation(OperationLog.class);
            System.out.printf("方法：%s%n", method.getName());
            System.out.printf("  模块：%s%n", log.module());
            System.out.printf("  类型：%s（%s）%n", log.type(), log.type().getDesc());
            System.out.printf("  详情：%s%n", log.detail());
            System.out.printf("  记录参数：%b%n", log.saveParams());
            System.out.printf("  风险等级：%s%n", log.risk());
            System.out.printf("  角色：%s%n", Arrays.toString(log.roles()));
            System.out.printf("  重试：%d 次，间隔 %d ms%n", log.retry().times(), log.retry().delay());

            // 3. 参数上的注解
            Annotation[][] paramAnnotations = method.getParameterAnnotations();
            for (int i = 0; i < paramAnnotations.length; i++) {
                for (Annotation a : paramAnnotations[i]) {
                    System.out.printf("  参数 %d 的注解：%s%n", i, a.annotationType().getSimpleName());
                }
            }
        }

        // 4. 字段上的注解
        for (Field field : clazz.getDeclaredFields()) {
            if (field.isAnnotationPresent(NotNull.class)) {
                System.out.println("必填字段：" + field.getName());
            }
        }

        // 5. 获取所有注解
        Annotation[] all = clazz.getAnnotations();               // 含继承的（@Inherited）
        Annotation[] declared = clazz.getDeclaredAnnotations();  // 只含自己声明的
        // 6. 可重复注解
        Schedule[] schedules = method.getAnnotationsByType(Schedule.class);
    }
}
```

**反射 API 速查：**

| 方法 | 作用 |
| --- | --- |
| `isAnnotationPresent(Class)` | 是否存在某注解 |
| `getAnnotation(Class)` | 获取某注解实例（含继承的） |
| `getAnnotations()` | 获取所有注解（含继承的） |
| `getDeclaredAnnotation(Class)` | 获取自己声明的某注解（不含继承） |
| `getDeclaredAnnotations()` | 获取自己声明的所有注解 |
| `getAnnotationsByType(Class)` | 获取可重复注解的所有实例（JDK 8+） |
| `annotation.annotationType()` | 获取注解的类型（Class） |

> 【坑】**反射获取注解要过滤合成方法和桥接方法**：
> ```java
> for (Method m : clazz.getDeclaredMethods()) &#123;
>     if (m.isSynthetic() || m.isBridge()) continue;   // ★ 跳过编译器生成的方法
>     // 处理注解
> &#125;
> ```
> 否则会重复处理（泛型桥接方法上可能没有注解，导致误判）。

#### 12.3 实战：注解 + AOP 实现操作日志 ★★★★★

**这是自定义注解最典型的应用，完整可运行的企业级实现：**

```java
// ─── 1. 注解定义（上面已定义 OperationLog）───

// ─── 2. 日志实体 ───
@Data
@TableName("sys_operation_log")
public class SysOperationLog {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String module;              // 操作模块
    private String operationType;       // 操作类型
    private String detail;              // 操作描述
    private String method;              // 类名.方法名
    private String requestUri;          // 请求 URI
    private String httpMethod;          // GET/POST
    private String requestParams;       // 请求参数 JSON
    private String responseResult;      // 响应结果 JSON
    private String operatorId;          // 操作人 ID
    private String operatorName;        // 操作人名称
    private String operatorIp;          // IP
    private String userAgent;           // 浏览器信息
    private Integer status;             // 0 失败 1 成功
    private String errorMsg;            // 异常信息
    private Long costTime;              // 耗时 ms
    private String riskLevel;           // 风险等级
    private LocalDateTime createTime;
}

// ─── 3. SpEL 解析器（让 detail 支持动态表达式）───
@Component
public class LogSpELParser {

    private final ExpressionParser parser = new SpelExpressionParser();
    private final ParameterNameDiscoverer nameDiscoverer = new DefaultParameterNameDiscoverer();

    /**
     * 解析 SpEL 表达式
     * @param template 如 "删除用户 #{#userId}"
     * @param method 目标方法
     * @param args 实际参数
     */
    public String parse(String template, Method method, Object[] args) {
        if (!StringUtils.hasText(template) || !template.contains("#{")) {
            return template;
        }
        EvaluationContext context = new StandardEvaluationContext();
        String[] paramNames = nameDiscoverer.getParameterNames(method);
        if (paramNames != null) {
            for (int i = 0; i < paramNames.length; i++) {
                context.setVariable(paramNames[i], args[i]);      // 把参数注入 SpEL 上下文
            }
        }
        // 提取 #{...} 中的表达式并求值
        Matcher matcher = Pattern.compile("#\\{(.*?)}").matcher(template);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String expr = matcher.group(1);
            Object value = parser.parseExpression(expr).getValue(context);
            matcher.appendReplacement(sb, String.valueOf(value));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }
}

// ─── 4. AOP 切面（核心）───
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class OperationLogAspect {

    private final LogSpELParser spELParser;
    private final OperationLogService logService;
    private final ObjectMapper objectMapper;

    /** 异步线程池（日志写入不阻塞业务） */
    private final Executor logExecutor;

    /** 切点：标注了 @OperationLog 的方法 */
    @Pointcut("@annotation(com.example.common.annotation.OperationLog)")
    public void logPointcut() { }

    @Around("logPointcut() && @annotation(operationLog)")
    public Object around(ProceedingJoinPoint joinPoint, OperationLog operationLog) throws Throwable {

        long startTime = System.currentTimeMillis();
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Object[] args = joinPoint.getArgs();

        // 解析 SpEL 描述
        String detail = spELParser.parse(operationLog.detail(), method, args);

        SysOperationLog logEntity = new SysOperationLog();
        logEntity.setModule(operationLog.module());
        logEntity.setOperationType(operationLog.type().name());
        logEntity.setDetail(detail);
        logEntity.setMethod(signature.getDeclaringTypeName() + "." + method.getName());
        logEntity.setRiskLevel(operationLog.risk().name());
        logEntity.setCreateTime(LocalDateTime.now());

        // 填充请求上下文信息
        fillRequestContext(logEntity);
        fillOperatorInfo(logEntity);

        // 记录请求参数（脱敏）
        if (operationLog.saveParams()) {
            logEntity.setRequestParams(serializeArgs(args, method));
        }

        Object result = null;
        try {
            result = joinPoint.proceed();                     // ★ 执行目标方法
            logEntity.setStatus(1);                            // 成功
            if (operationLog.saveResult()) {
                logEntity.setResponseResult(toJson(result));
            }
            return result;
        } catch (Throwable e) {
            logEntity.setStatus(0);                            // 失败
            logEntity.setErrorMsg(StringUtils.abbreviate(e.getMessage(), 2000));
            throw e;                                           // ★ 异常必须继续抛出！
        } finally {
            logEntity.setCostTime(System.currentTimeMillis() - startTime);
            // 异步落库，不影响主流程
            CompletableFuture.runAsync(() -> saveLog(logEntity), logExecutor)
                             .exceptionally(ex -> {
                                 log.error("操作日志保存失败", ex);
                                 return null;
                             });
        }
    }

    private void fillRequestContext(SysOperationLog entity) {
        ServletRequestAttributes attrs =
            (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) return;                            // 非 Web 环境（如定时任务）
        HttpServletRequest request = attrs.getRequest();
        entity.setRequestUri(request.getRequestURI());
        entity.setHttpMethod(request.getMethod());
        entity.setOperatorIp(getIpAddress(request));
        entity.setUserAgent(StringUtils.abbreviate(
                request.getHeader("User-Agent"), 500));
    }

    private void fillOperatorInfo(SysOperationLog entity) {
        // 从 ThreadLocal / SecurityContext 获取当前登录用户
        LoginUser currentUser = UserContext.getCurrentUser();
        if (currentUser != null) {
            entity.setOperatorId(String.valueOf(currentUser.getUserId()));
            entity.setOperatorName(currentUser.getUsername());
        }
    }

    /** 序列化参数（过滤不可序列化的对象 + 敏感字段脱敏） */
    private String serializeArgs(Object[] args, Method method) {
        if (args == null || args.length == 0) return null;
        Parameter[] parameters = method.getParameters();
        List<Object> loggable = new ArrayList<>();
        for (int i = 0; i < args.length; i++) {
            // 跳过 Servlet 相关对象（无法序列化）
            if (args[i] instanceof ServletRequest
                || args[i] instanceof ServletResponse
                || args[i] instanceof MultipartFile) {
                loggable.add("[" + parameters[i].getType().getSimpleName() + "]");
                continue;
            }
            loggable.add(args[i]);
        }
        try {
            String json = objectMapper.writeValueAsString(loggable);
            return desensitize(StringUtils.abbreviate(json, 5000));   // 截断 + 脱敏
        } catch (Exception e) {
            return "[序列化失败]";
        }
    }

    /** 敏感信息脱敏 */
    private String desensitize(String json) {
        return json.replaceAll("(\"password\"\\s*:\\s*)\"[^\"]*\"", "$1\"******\"")
                   .replaceAll("(\"idCard\"\\s*:\\s*)\"[^\"]*\"", "$1\"******\"")
                   .replaceAll("(\"phone\"\\s*:\\s*\")(\\d{3})\\d{4}(\\d{4})\"", "$1$2****$3\"");
    }

    private String getIpAddress(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (!StringUtils.hasText(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (!StringUtils.hasText(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // X-Forwarded-For 可能是 "client, proxy1, proxy2"，取第一个
        if (ip != null && ip.contains(",")) ip = ip.split(",")[0].trim();
        return ip;
    }

    private String toJson(Object obj) {
        try {
            return StringUtils.abbreviate(objectMapper.writeValueAsString(obj), 5000);
        } catch (Exception e) {
            return null;
        }
    }

    private void saveLog(SysOperationLog entity) {
        try {
            logService.save(entity);
        } catch (Exception e) {
            log.error("保存操作日志失败: {}", entity, e);
        }
    }
}

// ─── 5. 使用 ───
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    @OperationLog(module = "用户管理", type = OperationType.CREATE,
                  detail = "创建用户 #{#dto.username}", risk = RiskLevel.MEDIUM)
    public Result<Long> create(@RequestBody @Valid UserCreateDTO dto) {
        return Result.success(userService.create(dto));
    }

    @DeleteMapping("/{id}")
    @OperationLog(module = "用户管理", type = OperationType.DELETE,
                  detail = "删除用户 ID=#{#id}", risk = RiskLevel.HIGH)
    public Result<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return Result.success();
    }

    @PutMapping("/{id}/status")
    @OperationLog(module = "用户管理", type = OperationType.UPDATE,
                  detail = "修改用户状态", saveParams = true, saveResult = true,
                  roles = {"ADMIN"})
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam Integer status) {
        userService.updateStatus(id, status);
        return Result.success();
    }
}
```

**这个实现体现的工程要点：**

| 要点 | 说明 |
| --- | --- |
| `@Around` + `@annotation(x)` | 直接拿到注解实例，无需反射 |
| SpEL 表达式 | 日志描述可以引用方法参数（`#&#123;#dto.username&#125;`） |
| 异步落库 | 日志写入不阻塞业务，用独立线程池 |
| 异常继续抛出 | `catch` 后必须 `throw e`，不能吞掉（否则事务不回滚、调用方无感知） |
| 参数过滤 | Servlet 对象、文件流不能序列化 |
| 敏感信息脱敏 | 密码、身份证、手机号打码 |
| 内容截断 | 防止超长参数撑爆数据库字段 |
| 非 Web 环境兼容 | `RequestContextHolder` 可能为 null（定时任务、MQ 消费者） |

#### 12.4 常用内置注解速查

**JDK 内置：**

| 注解 | 作用 | 保留策略 |
| --- | --- | --- |
| `@Override` | 检查是否重写父类方法（写错签名会编译报错） | SOURCE |
| `@Deprecated` | 标记过时（编译警告）；JDK 9+ 可加 `forRemoval`、`since` | RUNTIME |
| `@SuppressWarnings` | 抑制编译警告 | SOURCE |
| `@SafeVarargs` | 抑制泛型可变参数的堆污染警告（JDK 7+） | RUNTIME |
| `@FunctionalInterface` | 检查是否为函数式接口（只能有一个抽象方法） | RUNTIME |
| `@Native` | 标记字段可被 native 代码访问 | RUNTIME |

```java
// @SuppressWarnings 的常用值
@SuppressWarnings("unchecked")        // 未检查的类型转换
@SuppressWarnings("rawtypes")         // 原始类型
@SuppressWarnings("deprecation")      // 使用过时 API
@SuppressWarnings("unused")           // 未使用的变量/方法
@SuppressWarnings("all")              // 全部（不推荐，掩盖真问题）
@SuppressWarnings({"unchecked", "unused"})   // 多个

// @Deprecated 的 JDK 9+ 用法
@Deprecated(since = "2.0", forRemoval = true)
public void oldMethod() { }
// 调用方会收到「将在未来版本移除」的警告

// @FunctionalInterface 检查
@FunctionalInterface
public interface MyFunction<T, R> {
    R apply(T t);
    // boolean test(T t);     // ❌ 加了第二个抽象方法会编译错误
    default void log() { }    // ✅ default/static 方法不限数量
}
```

**Spring 核心注解**（详见 [[后端/Spring/Spring注解大全与配置类]]）：

| 分类 | 注解 |
| --- | --- |
| 组件注册 | `@Component`、`@Service`、`@Repository`、`@Controller`、`@RestController`、`@Configuration`、`@Bean` |
| 依赖注入 | `@Autowired`、`@Qualifier`、`@Resource`、`@Value`、`@Primary` |
| 组件扫描 | `@ComponentScan`、`@SpringBootApplication` |
| Web MVC | `@RequestMapping`、`@GetMapping`、`@PostMapping`、`@PathVariable`、`@RequestParam`、`@RequestBody`、`@ResponseBody` |
| AOP | `@Aspect`、`@Pointcut`、`@Before`、`@After`、`@Around`、`@AfterReturning`、`@AfterThrowing` |
| 事务 | `@Transactional`、`@EnableTransactionManagement` |
| 条件装配 | `@Conditional`、`@ConditionalOnClass`、`@ConditionalOnMissingBean`、`@ConditionalOnProperty` |
| 生命周期 | `@PostConstruct`、`@PreDestroy`、`InitializingBean`、`DisposableBean` |
| 异步与调度 | `@Async`、`@EnableAsync`、`@Scheduled`、`@EnableScheduling` |
| 缓存 | `@Cacheable`、`@CacheEvict`、`@CachePut`、`@EnableCaching` |
| 参数校验 | `@Valid`、`@Validated`、`@NotNull`、`@NotBlank`、`@Size`、`@Pattern`、`@Min`、`@Max` |

### 13. 注解处理器（APT，编译期）

**JSR 269 定义的编译期注解处理，Lombok、MapStruct、Dagger 都基于它。**

```java
// 自定义注解处理器
@SupportedAnnotationTypes("com.example.annotation.AutoService")
@SupportedSourceVersion(SourceVersion.RELEASE_17)
public class MyProcessor extends AbstractProcessor {

    @Override
    public boolean process(Set<? extends TypeElement> annotations, RoundEnvironment roundEnv) {
        for (Element element : roundEnv.getElementsAnnotatedWith(AutoService.class)) {
            // element 是编译期的 AST 节点（不是反射的 Class）
            if (element.getKind() == ElementKind.CLASS) {
                // 用 JavaPoet 生成新的 .java 源文件
                TypeSpec generated = TypeSpec.classBuilder(element.getSimpleName() + "_Impl")
                        .addMethod(...)
                        .build();
                JavaFile.builder("com.example.generated", generated)
                        .build()
                        .writeTo(processingEnv.getFiler());      // 写入生成目录
            }
        }
        return true;      // true 表示已处理，其他处理器不再处理
    }
}
// 注册：META-INF/services/javax.annotation.processing.Processor 文件中写入处理器全类名
```

**Lombok 的特殊性**：Lombok 不是标准 APT，它通过 **hack javac 的 AST**（修改已有的语法树，而非生成新文件）来注入 getter/setter。这也是为什么 Lombok 与某些注解处理器有兼容问题，且 JDK 升级时 Lombok 常需跟进适配。

**MapStruct（标准 APT，类型安全的对象映射）：**

```java
@Mapper(componentModel = "spring")
public interface UserConverter {
    UserVO toVO(User user);
    List<UserVO> toVOList(List<User> users);

    @Mapping(target = "createTime", source = "gmtCreate", dateFormat = "yyyy-MM-dd HH:mm:ss")
    @Mapping(target = "fullName", expression = "java(user.getFirst() + \" \" + user.getLast())")
    @Mapping(target = "statusDesc", source = "status", qualifiedByName = "statusToDesc")
    UserDetailVO toDetailVO(User user);

    @Named("statusToDesc")
    default String statusToDesc(Integer status) {
        return status != null && status == 1 ? "启用" : "禁用";
    }
}
// 编译后生成 UserConverterImpl.java，是纯粹的 getter/setter 调用，
// 性能远超 BeanUtils.copyProperties（反射），且编译期检查字段类型
```

| 对比 | BeanUtils.copyProperties | MapStruct |
| --- | --- | --- |
| 实现 | 反射 | 编译期生成代码 |
| 性能 | 慢（反射开销） | **快 10~100 倍**（等同手写） |
| 类型检查 | 运行时才发现 | **编译期报错** |
| 字段名不一致 | 静默失败（不复制） | 编译警告/报错 |
| 复杂映射 | 需手写 | 注解声明 |

## 14. 常见坑汇总

### 泛型

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 以为 `List&lt;Integer&gt;` 是 `List&lt;Number&gt;` 子类 | 编译错误 | 用 `List<? extends Number>` |
| 2 | 上界通配符想 add | 编译错误 | extends 只读（PECS） |
| 3 | 下界通配符想按具体类型读 | 编译错误 | super 只能当 Object 读 |
| 4 | `new T()` | 编译错误 | 传 Class 或 Supplier |
| 5 | `new T[10]` | 编译错误 | `Array.newInstance` 或 `List` |
| 6 | `instanceof List&lt;String&gt;` | 编译错误 | `instanceof List<?>` |
| 7 | `List&lt;int&gt;` | 编译错误 | 装箱 `List&lt;Integer&gt;` |
| 8 | 重载 `f(List&lt;String&gt;)` 和 `f(List&lt;Integer&gt;)` | 擦除后签名冲突 | 改方法名或参数 |
| 9 | 静态成员用类的 T | 编译错误 | 静态方法声明自己的 T |
| 10 | 用原始类型 `List` | 丢失类型检查，unchecked 警告 | 一律用参数化类型 |
| 11 | 桥接方法导致反射重复处理 | 注解被处理两次 | 过滤 `isBridge()`/`isSynthetic()` |
| 12 | 泛型类不能继承 Throwable | 编译错误 | 异常类不用泛型 |

### 枚举

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 13 | 用 ordinal 存数据库 | 重排枚举后数据全错 | 自定义 code 字段 |
| 14 | 高频 `values()` | 数组克隆开销 | 缓存静态数组 |
| 15 | `valueOf` 找不到 | `IllegalArgumentException` | `EnumUtils.getEnum` 或自己流式查找 |
| 16 | 枚举 name 改名 | 反序列化/DB 数据失效 | `@JsonValue` 用 code |
| 17 | switch 枚举忘加分支 | 静默走 default 或漏处理 | 用 JDK 14 switch 表达式（穷尽检查） |
| 18 | 枚举实现接口后用接口引用 | 访问不到枚举方法 | 强转或用枚举类型 |
| 19 | Jackson 默认序列化枚举为 name | 前端拿到的是英文名 | `@JsonValue` 或配置 `WRITE_ENUMS_USING_TO_STRING` |

### 注解

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 20 | 忘记 `@Retention(RUNTIME)` | 反射读不到注解 | 显式声明 RUNTIME |
| 21 | 忘记 `@Target` | 注解可乱标，语义混乱 | 明确作用目标 |
| 22 | `@Inherited` 期望方法注解继承 | 无效（只对类注解生效） | Spring 的 `AnnotatedElementUtils` |
| 23 | 可重复注解未定义容器注解 | 编译错误 | 容器注解 + `@Repeatable` |
| 24 | 注解属性用了不支持的类型 | 编译错误 | 只能是基本类型/String/Class/枚举/注解/数组 |
| 25 | AOP 中 catch 异常不重抛 | 事务不回滚、调用方无感知 | `throw e` |
| 26 | 日志切面序列化 Servlet 对象 | 异常/死循环 | 过滤不可序列化参数 |
| 27 | 注解处理与 Lombok 冲突 | 生成的代码缺少 Lombok 方法 | 调整处理器顺序或用 `lombok.config` |

---

## 关联笔记

- 上一篇：[[后端/Java基础/异常处理]]
- 下一篇：[[后端/Java基础/IO流与文件操作]]
- 相关：[[后端/Java基础/反射与动态代理]]（注解读取的基础）、[[后端/Java基础/Java8新特性-Lambda与Stream]]（函数式接口）
- 应用：[[后端/Spring/Spring注解大全与配置类]]、[[后端/Spring/AOP面向切面编程]]（注解 + 切面实战）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
