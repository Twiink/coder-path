---
title: "数组与方法"
aliases:
  - "Java 数组"
  - "Java 方法重载与值传递"
tags:
  - "后端"
  - "java"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/运算符与流程控制]]"
  - "[[后端/Java基础/面向对象基础]]"
  - "[[后端/Java基础/集合框架-List与Set]]"
  - "[[后端/JVM/JVM概述与运行时数据区]]"
created: 2026-09-06
updated: 2026-09-06
---

# 数组与方法

## 1. 数组概述

**数组是一组相同类型数据的有序集合**，是 Java 中最基础的引用类型（不是基本类型）。

| 特性 | 说明 |
| --- | --- |
| 长度固定 | 创建时确定，之后**不能改变**（要扩容只能新建数组 + 拷贝） |
| 类型一致 | 所有元素必须是同一类型（或其子类） |
| 有序可索引 | 下标从 **0** 开始，到 `length - 1` |
| 引用类型 | 数组变量存的是**地址**，数组对象在**堆**中 |
| 实现了 `Cloneable` 和 `java.io.Serializable` | 可克隆、可序列化 |
| `length` 是**属性**不是方法 | `arr.length`，字符串是 `str.length()`，集合是 `list.size()` |

```java
// 数组是 Object 的子类
int[] arr = new int[10];
System.out.println(arr instanceof Object);   // true
System.out.println(arr.getClass());          // class [I  （I = int 的类型签名）
System.out.println(arr.getClass().getSuperclass());  // class java.lang.Object
```

## 2. 数组的声明与初始化

### 2.1 声明方式

```java
int[] arr1;        // ✅ 推荐：类型后加 []，强调「int 数组」是一个整体类型
int arr2[];        // ✅ 合法但不推荐（C 风格）
String[] names;
User[] users;
int[][] matrix;    // 二维数组
```

> 声明只是创建一个引用变量（值为 null），**没有分配数组内存**。

### 2.2 静态初始化（声明 + 赋值同时，长度由元素个数推断）

```java
int[] a = {1, 2, 3, 4, 5};                        // 简写形式（只能在声明语句中用）
int[] b = new int[]{1, 2, 3, 4, 5};               // 完整形式
String[] strs = {"a", "b", "c"};
User[] users = {new User("Tom"), new User("Jerry")};
Object[] objs = {1, "abc", 3.14, true, new User()};   // Object 数组可混装

// 作为方法参数传递时必须用完整形式
print(new int[]{1, 2, 3});        // ✅
// print({1, 2, 3});              // ❌ 编译错误

// 声明与初始化分开时必须用完整形式
int[] c;
c = new int[]{1, 2, 3};           // ✅
// c = {1, 2, 3};                 // ❌ 编译错误
```

### 2.3 动态初始化（先指定长度，元素用默认值）

```java
int[] arr = new int[5];           // 全部为 0
double[] d = new double[3];       // 全部为 0.0
boolean[] b = new boolean[2];     // 全部为 false
char[] c = new char[3];           // 全部为 '\u0000'
String[] s = new String[3];       // 全部为 null（引用类型默认 null）
User[] u = new User[3];           // 全部为 null，u[0].name 会 NPE！

// 长度可以是变量或表达式（运行时确定）
int n = 10;
int[] arr2 = new int[n];
int[] arr3 = new int[getList().size()];

// ❌ 不能同时指定长度和初始值
// int[] bad = new int[5]{1,2,3};   // 编译错误
```

**各类型数组的默认值：**

| 元素类型 | 默认值 | 元素类型 | 默认值 |
| --- | --- | --- | --- |
| `byte` `short` `int` `long` | 0 / 0L | `float` `double` | 0.0f / 0.0 |
| `char` | `'\u0000'`（空字符，打印时无显示） | `boolean` | `false` |
| 任意引用类型 | `null` | — | — |

> 【坑】`char[]` 默认值是 `\u0000`，打印出来是空白而不是 "0" 或 "null"，容易被误认为「没初始化」。

### 2.4 JDK 9+ 集合工厂与数组

```java
// List.of 返回不可变 List，不是数组
List<Integer> list = List.of(1, 2, 3);
Integer[] arr = list.toArray(new Integer[0]);    // List → 数组

// Stream → 数组
int[] arr2 = IntStream.rangeClosed(1, 100).toArray();
String[] arr3 = Stream.of("a", "b").toArray(String[]::new);
```

## 3. 数组的内存分析

**理解数组必须画出栈、堆的内存图**（这是面试高频）：

```java
int[] arr = new int[3];
arr[0] = 10;
int[] arr2 = arr;          // 引用赋值，指向同一数组
arr2[1] = 20;
System.out.println(arr[1]);   // 20！arr 也被改了
```

```
     栈内存（每个线程独立）              堆内存（所有线程共享）
   ┌─────────────────┐              ┌──────────────────────┐
   │  arr  ──────────┼─────────────→│ 0x1234  int[3]       │
   │                 │              │  ┌────┬────┬────┐    │
   │  arr2 ──────────┼─────────────→│  │ 10 │ 20 │  0 │    │
   └─────────────────┘              │  └────┴────┴────┘    │
                                    │   [0]  [1]  [2]      │
                                    └──────────────────────┘
```

**null 数组与空数组：**

```java
int[] a = null;              // 引用不指向任何对象
// a.length;                 // ❌ NullPointerException
// a[0] = 1;                 // ❌ NullPointerException

int[] b = new int[0];        // 空数组，长度为 0，是合法对象
System.out.println(b.length);   // 0
System.out.println(Arrays.toString(b));  // []

// 【规范】方法返回集合/数组时，返回空数组而非 null，调用方无需判空
public String[] find() {
    return new String[0];    // ✅ Effective Java 第 54 条
    // return null;          // ❌ 调用方容易 NPE
}
```

**数组越界：**

```java
int[] arr = new int[3];      // 合法下标 0,1,2
arr[3] = 1;                  // ArrayIndexOutOfBoundsException: Index 3 out of bounds for length 3
arr[-1] = 1;                 // ArrayIndexOutOfBoundsException: Index -1 out of bounds for length 3
```

## 4. 数组的遍历

```java
int[] arr = {10, 20, 30, 40, 50};

// 方式 1：普通 for（可修改元素，可获取下标）
for (int i = 0; i < arr.length; i++) {
    System.out.println("arr[" + i + "] = " + arr[i]);
    arr[i] *= 2;                  // ✅ 可以修改
}

// 方式 2：增强 for（简洁，不能修改基本类型元素，无下标）
for (int n : arr) {
    System.out.println(n);
    // n *= 2;                    // ❌ 只改副本
}

// 方式 3：Arrays.toString（打印用）
System.out.println(Arrays.toString(arr));    // [10, 20, 30, 40, 50]
System.out.println(arr);                     // [I@1b6d3586 ← 打印地址，没用！

// 方式 4：JDK 8 Stream
Arrays.stream(arr).forEach(System.out::println);
int sum = Arrays.stream(arr).sum();
int max = Arrays.stream(arr).max().orElse(0);
OptionalDouble avg = Arrays.stream(arr).average();
List<Integer> boxed = Arrays.stream(arr).boxed().collect(Collectors.toList());

// 方式 5：JDK 8 forEach（对象数组）
String[] strs = {"a", "b"};
Arrays.asList(strs).forEach(s -> System.out.println(s.toUpperCase()));
```

> 【坑】**直接 `System.out.println(arr)` 打印的是对象地址**。因为数组没有重写 `toString()`，用的是 `Object.toString()` = `类名@哈希码`。`[I` 表示 int 数组（`[` 表示数组，`I` 表示 int 类型签名）。必须用 `Arrays.toString()`；二维数组用 `Arrays.deepToString()`。

**类型签名对照：**

| 类型 | 签名 | 示例 |
| --- | --- | --- |
| `boolean` | `Z` | `[Z` = boolean[] |
| `byte` | `B` | `[B` = byte[] |
| `char` | `C` | `[C` = char[] |
| `short` | `S` | |
| `int` | `I` | `[I` = int[] |
| `long` | `J` | `[J` = long[] |
| `float` | `F` | |
| `double` | `D` | |
| 引用类型 | `L全限定名;` | `[Ljava.lang.String;` = String[] |
| 二维数组 | 两个 `[` | `[[I` = int[][] |

## 5. Arrays 工具类（必背 API）

`java.util.Arrays` 提供了数组操作的静态方法，全部是数组开发的基础设施。

### 5.1 打印与比较

```java
int[] a = {1, 2, 3};
int[] b = {1, 2, 3};

Arrays.toString(a);              // "[1, 2, 3]"
Arrays.deepToString(new int[][]{{1,2},{3,4}});   // "[[1, 2], [3, 4]]"
Arrays.equals(a, b);             // true，逐元素比较
Arrays.deepEquals(obj2d1, obj2d2);   // 二维数组比较
a == b;                          // false，比较地址

// JDK 9+ 更多打印
Arrays.toString(a, ", ");        // 自定义分隔符？不，实际没有此重载；用 Stream 替代
```

### 5.2 填充与复制

```java
int[] arr = new int[5];
Arrays.fill(arr, 7);                       // 全部填 7 → [7,7,7,7,7]
Arrays.fill(arr, 1, 3, 9);                 // [1,3) 填 9 → [7,9,9,7,7]

int[] copy = Arrays.copyOf(arr, arr.length);        // 完整复制（新数组）
int[] copy2 = Arrays.copyOf(arr, 10);               // 扩容复制，多出部分用默认值
int[] copy3 = Arrays.copyOf(arr, 2);                // 截断复制 → 只取前 2 个
int[] copy4 = Arrays.copyOfRange(arr, 1, 4);        // 复制 [1,4) 区间

// 引用类型复制的是引用（浅拷贝！）
User[] users = {new User("Tom")};
User[] users2 = Arrays.copyOf(users, 1);
users2[0].setName("Jerry");
System.out.println(users[0].getName());     // "Jerry"！同一对象被改

// 底层用 System.arraycopy（native，性能最高）
System.arraycopy(src, srcPos, dest, destPos, length);
```

> 【面试】**`Arrays.copyOf` 与 `System.arraycopy` 的区别？**
> - `System.arraycopy` 是 native 方法，**需要目标数组已存在**，只做拷贝，性能最高（ArrayList 扩容就靠它）。
> - `Arrays.copyOf` 内部先 `new` 一个新数组，再调用 `System.arraycopy`，返回新数组，更方便。

### 5.3 排序

```java
int[] nums = {5, 2, 9, 1, 7};
Arrays.sort(nums);                                    // 升序，原地修改
System.out.println(Arrays.toString(nums));            // [1, 2, 5, 7, 9]

Arrays.sort(nums, 1, 4);                              // 只排序 [1,4) 区间

// 对象数组：自然排序（元素需实现 Comparable）
String[] strs = {"banana", "apple", "cherry"};
Arrays.sort(strs);                                    // [apple, banana, cherry]

// 对象数组：自定义排序（Comparator）
User[] users = {...};
Arrays.sort(users, Comparator.comparingInt(User::getAge));                    // 按年龄升序
Arrays.sort(users, Comparator.comparingInt(User::getAge).reversed());         // 降序
Arrays.sort(users, Comparator.comparing(User::getName)                        // 多字段排序
                        .thenComparingInt(User::getAge));
Arrays.sort(users, (u1, u2) -> u2.getAge() - u1.getAge());                    // Lambda 降序

// ⚠️ 基本类型数组不能传 Comparator（因为没有装箱，无法用泛型）
// Arrays.sort(nums, (a, b) -> b - a);   // ❌ 编译错误
// 解决方案 1：装箱
Integer[] boxed = Arrays.stream(nums).boxed().toArray(Integer[]::new);
Arrays.sort(boxed, Comparator.reverseOrder());
// 解决方案 2：升序排序后手动反转
Arrays.sort(nums);
for (int i = 0, j = nums.length - 1; i < j; i++, j--) {
    int t = nums[i]; nums[i] = nums[j]; nums[j] = t;
}

// 并行排序（大数据量，多核 CPU）
Arrays.parallelSort(bigArray);
```

**【原理】Arrays.sort 的算法选择（面试高频）：**

| 数组类型 | 算法 | 时间复杂度 | 稳定性 |
| --- | --- | --- | --- |
| 基本类型（int/long/double...） | **双轴快排**（Dual-Pivot Quicksort，Vladimir Yaroslavskiy 实现） | O(n log n) | **不稳定**（但基本类型值相同无法区分，无所谓） |
| 对象数组 | **TimSort**（归并排序的优化版，来自 Python） | O(n log n)，部分有序时接近 O(n) | **稳定** |
| 小数组（< 47） | 插入排序 | O(n²) | 稳定 |
| 几乎有序的数组 | 归并排序 | O(n) | 稳定 |

**为什么基本类型用快排、对象用归并？**
- 快排的平均性能更好、原地排序省内存，但**不稳定**。基本类型两个相同值无法区分，不稳定无所谓 → 用快排。
- 对象数组中「相等」的元素可能是不同对象（`equals` 相等但内容不同），**不稳定会改变原有相对顺序**，产生难以察觉的 bug → 必须用稳定的 TimSort。

### 5.4 查找

```java
int[] arr = {1, 3, 5, 7, 9};

// 二分查找（前提：数组必须已排序！否则结果无意义）
int idx = Arrays.binarySearch(arr, 5);       // 2
int idx2 = Arrays.binarySearch(arr, 4);      // -3  ← 找不到时返回 -(插入点) - 1
                                             // 4 应插在下标 2，所以 -(2)-1 = -3
int idx3 = Arrays.binarySearch(arr, 1, 4, 7);// 在 [1,4) 区间查找

// 转换为插入点
int insertPos = -(idx2) - 1;                 // 2

// JDK 9+ 更多查找
Arrays.mismatch(arr, arr2);                  // 第一个不同元素的下标，全同返回 -1
Arrays.compare(arr, arr2);                   // 字典序比较
```

> 【坑】`binarySearch` **不检查数组是否有序**，对无序数组调用会返回错误结果且不报错。

### 5.5 数组与 List 互转

```java
// 数组 → List
Integer[] arr = {1, 2, 3};
List<Integer> list1 = Arrays.asList(arr);
// ⚠️ 返回的是 Arrays$ArrayList（内部类），不是 java.util.ArrayList！
//    固定长度，不支持 add/remove！
list1.add(4);           // ❌ UnsupportedOperationException
list1.remove(0);        // ❌ UnsupportedOperationException
list1.set(0, 99);       // ✅ 可以修改（会影响原数组！）
arr[0] = 100;
System.out.println(list1.get(0));   // 100，二者共享底层数组

// ✅ 得到可变的 ArrayList
List<Integer> list2 = new ArrayList<>(Arrays.asList(arr));
List<Integer> list3 = Arrays.stream(arr).collect(Collectors.toList());      // JDK 8
List<Integer> list4 = List.of(arr);           // JDK 9+，完全不可变（连 set 都不行）
List<Integer> list5 = Stream.of(arr).collect(Collectors.toCollection(ArrayList::new));

// ⚠️ 基本类型数组转 List 的大坑
int[] nums = {1, 2, 3};
List list6 = Arrays.asList(nums);
System.out.println(list6.size());        // 1！不是 3！
System.out.println(list6.get(0));        // [I@... 整个数组作为一个元素
// 原因：Arrays.asList(T... a) 的泛型 T 不能是基本类型，
//      int[] 被当作一个 Object（引用类型），所以 List<int[]> 长度为 1

// ✅ 正确做法
List<Integer> list7 = Arrays.stream(nums).boxed().collect(Collectors.toList());
List<Integer> list8 = IntStream.of(nums).boxed().collect(Collectors.toList());
Integer[] boxed = {1, 2, 3};
List<Integer> list9 = Arrays.asList(boxed);    // 用包装类数组

// List → 数组
List<String> strList = Arrays.asList("a", "b");
String[] arr2 = strList.toArray(new String[0]);          // ✅ 推荐（JVM 会优化，无需预估长度）
String[] arr3 = strList.toArray(new String[strList.size()]);  // 旧写法
Object[] arr4 = strList.toArray();                       // 得到 Object[]，不能强转 String[]
// Integer[] → int[]
int[] primitives = intList.stream().mapToInt(Integer::intValue).toArray();
```

> 【面试】**`Arrays.asList()` 的三大坑**：
> 1. 返回的是 `Arrays` 的私有静态内部类 `Arrays$ArrayList`，不是 `java.util.ArrayList`，**不支持增删**。
> 2. 传入**基本类型数组**时，整个数组作为一个元素（泛型不支持基本类型）。
> 3. 与原数组**共享底层数据**，修改一方会影响另一方。

### 5.6 其他常用

```java
// 哈希码
Arrays.hashCode(arr);              // 一维数组哈希
Arrays.deepHashCode(obj2d);        // 多维数组哈希

// 前缀比较
Arrays.compareUnsigned(bytes1, bytes2);    // 无符号比较（字节数组）

// 流转换
IntStream stream = Arrays.stream(nums);
IntStream stream2 = Arrays.stream(nums, 0, 3);   // 区间流

// spliterator（并行处理）
Spliterator<Integer> sp = Arrays.spliterator(arr);
```

## 6. 多维数组

### 6.1 二维数组

Java 的多维数组本质是**数组的数组**（不规则数组是合法的，这与 C 不同）。

```java
// 动态初始化
int[][] m1 = new int[3][4];            // 3 行 4 列，全部为 0
int[][] m2 = new int[3][];             // 3 行，列数未定（合法！）
m2[0] = new int[2];                    // 第 0 行 2 列
m2[1] = new int[5];                    // 第 1 行 5 列 ← 不规则数组
m2[2] = new int[3];

// 静态初始化
int[][] m3 = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
int[][] m4 = new int[][]{{1, 2}, {3, 4}};

// 访问
m3[0][0];          // 1
m3.length;         // 3（行数）
m3[0].length;      // 3（第 0 行的列数）
```

**二维数组的内存结构：**

```
栈                    堆
┌────────┐
│ m3 ────┼────→ [0x100] int[3][]   ← 外层数组，元素是引用
└────────┘         ├─[0]──→ [0x200] int[3] {1,2,3}
                   ├─[1]──→ [0x300] int[3] {4,5,6}
                   └─[2]──→ [0x400] int[3] {7,8,9}
```

**遍历二维数组：**

```java
int[][] m = {{1,2,3},{4,5,6},{7,8,9}};

// 普通 for
for (int i = 0; i < m.length; i++) {
    for (int j = 0; j < m[i].length; j++) {   // ⚠️ 用 m[i].length 而非固定值（支持不规则数组）
        System.out.print(m[i][j] + " ");
    }
    System.out.println();
}

// 增强 for
for (int[] row : m) {
    for (int n : row) {
        System.out.print(n + " ");
    }
    System.out.println();
}

// 打印
System.out.println(Arrays.deepToString(m));   // [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
```

### 6.2 三维及以上

```java
int[][][] cube = new int[2][3][4];       // 2 个 3x4 的平面
cube[0][1][2] = 99;

// 三维遍历
for (int i = 0; i < cube.length; i++) {
    for (int j = 0; j < cube[i].length; j++) {
        for (int k = 0; k < cube[i][j].length; k++) {
            System.out.print(cube[i][j][k] + " ");
        }
    }
}
```

> 【规范】**实际开发中很少用超过 2 维的数组**，可读性差。复杂结构应封装成对象（如 `Matrix` 类）或嵌套集合 `List<List<List&lt;T&gt;>>`。

### 6.3 数组 vs 集合的选择

| 对比项 | 数组 | 集合（List） |
| --- | --- | --- |
| 长度 | 固定 | 动态扩容 |
| 元素类型 | 可存基本类型和引用类型 | **只能存对象**（基本类型自动装箱） |
| 性能 | 更高（无装箱、无对象头开销、CPU 缓存友好） | 略低 |
| 内存 | 紧凑 | 每个元素有对象包装开销 |
| API | 少，靠 `Arrays` 工具 | 丰富（增删改查、排序、流） |
| 多维 | 原生支持不规则数组 | 需嵌套泛型 |
| 线程安全 | 无 | 有 `CopyOnWriteArrayList` 等 |
| 适用场景 | 长度已知、基本类型、高性能计算、算法题 | 业务开发主流选择 |

> 【结论】**业务开发用集合，算法/性能敏感场景用数组**。JDK 内部（如 `ArrayList`、`HashMap`）底层都是数组。

## 7. 方法（Method）

### 7.1 方法定义与调用

```java
// 完整语法
[修饰符] 返回值类型 方法名([参数类型 参数名, ...]) [throws 异常列表] {
    方法体
    [return 返回值;]
}

public static int add(int a, int b) {
    return a + b;
}

// 无返回值
public static void print(String msg) {
    System.out.println(msg);
}

// 无参数
public static long currentTime() {
    return System.currentTimeMillis();
}

// 调用
int sum = add(3, 5);          // 8
print("hello");
```

**修饰符组合（顺序不强制但惯例）：**

```java
public static final synchronized strictfp native abstract void method()
└─访问─┘ └─static─┘ └final┘  └─synchronized─┘          └─返回─┘
```

| 修饰符 | 作用 | 能否共存 |
| --- | --- | --- |
| `public/protected/default/private` | 访问权限 | 四选一 |
| `static` | 静态方法，属类不属对象 | 与 `abstract`、`final`（可）、实例方法互斥 |
| `final` | 不能被子类重写 | 与 `abstract` 互斥 |
| `abstract` | 无方法体，子类必须实现 | 与 `final`、`static`、`private` 互斥 |
| `synchronized` | 加锁 | 可与 static 共存（锁的是 Class 对象） |
| `native` | 由 JNI 实现，无 Java 方法体 | 与 `abstract` 类似 |
| `strictfp` | 严格浮点计算（IEEE 754） | — |

### 7.2 方法的内存与栈帧

**每次方法调用都会创建一个栈帧（Stack Frame）压入当前线程的虚拟机栈：**

```java
public static void main(String[] args) {
    int result = add(3, 5);
    System.out.println(result);
}

public static int add(int a, int b) {
    int sum = a + b;
    return sum;
}
```

```
虚拟机栈（main 线程）                     堆
┌─────────────────────┐
│  add 栈帧（栈顶）      │
│  ├ 局部变量表: a=3,b=5,sum=8
│  ├ 操作数栈            │
│  ├ 动态链接            │
│  └ 返回地址            │
├─────────────────────┤
│  main 栈帧            │
│  ├ 局部变量表: args, result
│  └ ...                │
└─────────────────────┘
方法返回 → 栈帧弹出 → 局部变量随之销毁
```

**栈溢出（StackOverflowError）：**

```java
public static void recurse() {
    recurse();        // 无限递归，无终止条件
}
// Exception in thread "main" java.lang.StackOverflowError

// 默认栈大小：Linux 512KB ~ 1MB，可通过 -Xss 调整
// java -Xss256k Test   → 更容易触发 StackOverflowError（可用于测试）
```

> 【坑】**递归深度过大导致 `StackOverflowError`**（不是 OOM）。常见于：树形结构递归无终止、链表过长、JSON 深层嵌套、快速排序在已排序数组上的最坏情况。**解决**：改成迭代 + 显式栈，或增大 `-Xss`，或做递归深度限制。

### 7.3 方法重载（Overload）

**同一个类中，方法名相同、参数列表不同**，称为重载。这是编译期多态（静态分派）。

```java
public class Calculator {
    // 参数个数不同
    public int add(int a, int b) { return a + b; }
    public int add(int a, int b, int c) { return a + b + c; }

    // 参数类型不同
    public double add(double a, double b) { return a + b; }
    public String add(String a, String b) { return a + b; }

    // 参数顺序不同
    public void show(String name, int age) { }
    public void show(int age, String name) { }
}
```

**重载的规则（重要）：**

| 项 | 是否影响重载 | 说明 |
| --- | --- | --- |
| 方法名 | 必须相同 | — |
| 参数个数 | ✅ 可以不同 | — |
| 参数类型 | ✅ 可以不同 | — |
| 参数顺序 | ✅ 可以不同 | — |
| **返回值类型** | ❌ **不能区分重载** | `int f()` 与 `void f()` 无法共存，编译错误 |
| **访问修饰符** | ❌ 不能区分重载 | — |
| 参数名 | ❌ 不能区分重载 | `f(int a)` 与 `f(int b)` 是同一方法 |
| `throws` | ❌ 不能区分重载 | — |

```java
// ❌ 编译错误：只有返回值不同
public int f() { return 1; }
public double f() { return 1.0; }   // error: method f() is already defined

// ✅ 可变参数也算一种重载
public void log(String msg) { }
public void log(String format, Object... args) { }
```

**重载的解析优先级（编译期静态分派）：**

```java
public void f(byte b)  { System.out.println("byte"); }
public void f(short s) { System.out.println("short"); }
public void f(int i)   { System.out.println("int"); }
public void f(long l)  { System.out.println("long"); }
public void f(float f) { System.out.println("float"); }
public void f(double d){ System.out.println("double"); }
public void f(char c)  { System.out.println("char"); }
public void f(Byte b)  { System.out.println("Byte"); }
public void f(Object o){ System.out.println("Object"); }
public void f(int... a){ System.out.println("varargs"); }

f((byte)1);
// 匹配顺序（编译器按此优先级选择）：
// 1. 精确匹配：byte → f(byte)  ✅ 选这个
// 2. 自动类型提升：byte → short → int → long → float → double
//    char → int → long → float → double（char 不转 byte/short！）
// 3. 自动装箱：byte → Byte → f(Byte)
// 4. 向上转型：Byte → Number → Object → f(Object)
// 5. 可变参数：f(int...)  ← 最后考虑

// 删掉 f(byte) 后：f((byte)1) → f(short)
// 再删 f(short) → f(int)
// 全部删掉只剩 f(Object) 和 f(int...) → f(int...)（varargs 优先级低于 Object？
//   实际上 varargs 在阶段 3 之后，Object 在阶段 3，所以选 f(Object)）
```

**经典重载陷阱：**

```java
// 陷阱 1：null 的歧义
public void f(Object o)  { System.out.println("Object"); }
public void f(String s)  { System.out.println("String"); }
public void f(Integer i) { System.out.println("Integer"); }

f(null);        // 编译错误！ambiguous（String 和 Integer 都是 Object 子类，无法确定最具体）
// 只保留 Object 和 String 时：f(null) → String（更具体）

// 陷阱 2：装箱与 varargs
public void g(int i) { }
public void g(Integer i) { }
g(1);           // 选 g(int)（精确匹配优先于装箱）

// 陷阱 3：可变参数的优先级最低
public void h(int a, int b) { }
public void h(int... a) { }
h(1, 2);        // 选 h(int, int)

// 陷阱 4：类型提升 vs 装箱
public void k(long l) { }
public void k(Integer i) { }
k(1);           // 选 k(long)！类型提升在装箱之前（阶段 2 < 阶段 3）
```

### 7.4 可变参数（Varargs，JDK 5+）

```java
// 语法：类型... 参数名，必须是最后一个参数，且一个方法只能有一个
public static int sum(int... nums) {
    // nums 在方法内部就是 int[] 数组
    int total = 0;
    for (int n : nums) total += n;
    return total;
}

sum();                    // ✅ 传 0 个，nums 是长度 0 的数组（不是 null）
sum(1);                   // ✅ nums = {1}
sum(1, 2, 3);             // ✅ nums = {1,2,3}
sum(new int[]{1, 2, 3});  // ✅ 直接传数组

// 与其他参数共存（必须在最后）
public void log(String level, String format, Object... args) { }
log("INFO", "user {} login at {}", name, time);

// 底层实现：编译器把调用包装成数组
sum(1, 2, 3);
// 编译后等价于
sum(new int[]{1, 2, 3});
```

**可变参数的规则与坑：**

```java
// 1. 必须是最后一个参数
public void f(int... a, String s) { }   // ❌ 编译错误

// 2. 一个方法只能有一个可变参数
public void f(int... a, String... s) { } // ❌ 编译错误

// 3. 重载冲突
public void f(int... a) { }
public void f(int[] a) { }              // ❌ 编译错误：擦除后签名相同

// 4. 泛型可变参数的堆污染（heap pollution）警告
@SafeVarargs                             // 抑制警告（作者确认安全时使用）
public static <T> List<T> asList(T... elements) { }

public static <T> void unsafe(List<T>... lists) { }   // ⚠️ 警告：不能创建泛型数组
// 泛型 + varargs 会创建泛型数组（Java 不允许），存在类型安全隐患

// 5. 每次调用都会创建数组（性能开销）
// 高频调用场景考虑显式重载：
public void f() { }
public void f(int a) { }
public void f(int a, int b) { }
public void f(int... rest) { }          // EnumSet.of 就是这种写法

// 6. 传 null 的歧义
public void f(Integer... nums) { }
f(null);                    // ⚠️ nums == null（不是长度 0 的数组），方法内遍历时 NPE！
f((Integer[]) null);        // 同上
f((Integer) null);          // nums = {null}，长度 1
```

> 【规范】可变参数在**调用频率高的场景要谨慎**（每次都 new 数组）。JDK 源码中 `EnumSet.of` 就为 1~5 个参数写了独立重载，最后才是 varargs。

### 7.5 方法重写（Override）

**子类重新实现父类的方法**，是运行时多态的基础（详见 [[后端/Java基础/面向对象基础]]）。

```java
class Animal {
    public void sound() { System.out.println("动物叫"); }
    protected void eat() { }
}

class Dog extends Animal {
    @Override                          // 强烈建议加，编译器会检查签名是否匹配
    public void sound() { System.out.println("汪汪"); }

    @Override
    protected void eat() { }           // 访问权限不能变小
}
```

**重写的规则（两同两小一大）：**

| 规则 | 说明 |
| --- | --- |
| **方法名相同** | — |
| **参数列表相同** | 类型、个数、顺序都要一致 |
| **返回值类型 ≤ 父类**（协变返回） | 可以是父类返回值的子类（JDK 5+） |
| **抛出异常 ≤ 父类** | 不能抛父类未声明的**受检异常**（可抛其子类或不抛） |
| **访问权限 ≥ 父类** | 不能更严格（private → public ✅，public → protected ❌） |
| 父类 `final` 方法 | **不能重写**（编译错误） |
| 父类 `static` 方法 | **不能重写，只能隐藏**（hiding） |
| 父类 `private` 方法 | 子类看不到，不构成重写（子类同名方法是新方法） |
| 父类构造方法 | 不能重写 |

```java
// 协变返回类型示例
class Parent {
    public Number get() { return 1; }
}
class Child extends Parent {
    @Override
    public Integer get() { return 2; }   // ✅ Integer 是 Number 的子类
}

// 异常范围示例
class Parent {
    public void f() throws IOException { }
}
class Child extends Parent {
    @Override
    public void f() throws FileNotFoundException { }  // ✅ IOException 的子类
    @Override
    public void f() { }                               // ✅ 不抛异常
    // public void f() throws Exception { }           // ❌ 范围更大
}
```

**【面试】重载（Overload）vs 重写（Override）：**

| 对比项 | 重载 Overload | 重写 Override |
| --- | --- | --- |
| 发生位置 | **同一个类**中（或父子类间） | **父子类**之间（继承关系） |
| 方法名 | 相同 | 相同 |
| 参数列表 | **必须不同** | **必须相同** |
| 返回值 | 无要求 | 相同或是父类返回值的子类 |
| 访问修饰符 | 无要求 | 不能比父类更严格 |
| 异常 | 无要求 | 不能抛更大的受检异常 |
| 多态类型 | **编译时多态**（静态分派） | **运行时多态**（动态分派） |
| 绑定时机 | 编译期根据参数类型确定 | 运行期根据实际对象类型确定 |
| static 方法 | 可以重载 | 不能被重写（只能隐藏） |

**static 方法的「隐藏」而非重写：**

```java
class Parent {
    public static void f() { System.out.println("Parent.f"); }
}
class Child extends Parent {
    public static void f() { System.out.println("Child.f"); }   // 隐藏，不是重写
}

Parent p = new Child();
p.f();              // "Parent.f"！静态方法在编译期就绑定到声明类型
Child.f();          // "Child.f"
Parent.f();         // "Parent.f"
```

### 7.6 值传递（Java 只有值传递！）

**【面试核心】Java 中所有参数传递都是「值传递」（pass by value），没有引用传递。**

- **基本类型**：传递的是**值的副本**，方法内修改不影响原变量。
- **引用类型**：传递的是**引用（地址）的副本**，方法内通过引用修改对象内容会影响原对象，但**重新赋值引用不影响原引用**。

```java
// 案例 1：基本类型
public static void change(int x) {
    x = 100;
}
int a = 10;
change(a);
System.out.println(a);       // 10，没变

// 案例 2：引用类型 - 修改对象内容（生效）
public static void change(User u) {
    u.setName("Jerry");
}
User user = new User("Tom");
change(user);
System.out.println(user.getName());   // "Jerry"，变了！

// 案例 3：引用类型 - 重新赋值引用（不生效）★ 最经典的面试题
public static void change(User u) {
    u = new User("Jerry");            // 只是让副本 u 指向新对象
}
User user = new User("Tom");
change(user);
System.out.println(user.getName());   // "Tom"，没变！

// 案例 4：交换两个对象（失败）
public static void swap(User u1, User u2) {
    User temp = u1;
    u1 = u2;
    u2 = temp;                        // 只交换了副本引用
}
User x = new User("X"), y = new User("Y");
swap(x, y);
System.out.println(x.getName() + y.getName());   // "XY"，没交换

// 案例 5：字符串不可变（看起来像值传递）
public static void change(String s) {
    s = s + " world";                 // 创建新对象，原引用不变
}
String str = "hello";
change(str);
System.out.println(str);              // "hello"

// 案例 6：数组（引用类型）
public static void change(int[] arr) {
    arr[0] = 99;                      // ✅ 生效
    arr = new int[]{1, 2, 3};         // ❌ 重新赋值不影响外部
    arr[1] = 100;                     // 改的是新数组
}
int[] a = {1, 2};
change(a);
System.out.println(Arrays.toString(a));   // [99, 2]
```

**内存图解（案例 3）：**

```
调用前：
  栈(main)              堆
  user ─────────────→ [User{name="Tom"}]

调用 change(user) 后：
  栈(main)   栈(change)      堆
  user ──────────────────→ [User{name="Tom"}]
             u ────────────┘      ↑ 一开始 u 也指向这里
调用中 u = new User("Jerry")：
  user ──────────────────→ [User{name="Tom"}]     ← 原对象未变
             u ───────────→ [User{name="Jerry"}]   ← 新对象，方法结束后成为垃圾
方法返回：u 栈帧销毁，新对象等待 GC，user 依旧指向 "Tom"
```

**为什么有人误以为是引用传递？**

因为「修改对象内容生效」这个现象在 C++ 的引用传递中也存在。但真正的引用传递（C++ `T&`）中，函数内 `u = new User()` **会影响外部变量**，Java 不会。所以 Java 是「**传递引用的值**」（call by sharing / call by object-sharing），术语上仍归类为值传递。

**如果确实需要「修改外部变量」的效果：**

```java
// 方案 1：返回值
public static int change(int x) { return x * 2; }
a = change(a);

// 方案 2：包装成对象/数组
public static void change(int[] holder) { holder[0] = 100; }
int[] holder = {10};
change(holder);
System.out.println(holder[0]);   // 100

// 方案 3：AtomicReference（并发场景）
AtomicReference<String> ref = new AtomicReference<>("a");
public static void change(AtomicReference<String> ref) { ref.set("b"); }

// 方案 4：可变包装类（如自定义 Holder<T>）
class Holder<T> { T value; }
```

### 7.7 递归（Recursion）

```java
// 递归三要素：
// 1. 终止条件（base case）—— 必须有，否则 StackOverflowError
// 2. 递归公式（recursive case）
// 3. 每次递归都向终止条件靠近

// 阶乘 n! = n × (n-1)!
public static long factorial(int n) {
    if (n <= 1) return 1;              // 终止条件
    return n * factorial(n - 1);       // 递归公式
}

// 斐波那契（朴素递归，O(2ⁿ) 极慢）
public static int fib(int n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}

// 优化：记忆化递归（Memoization），O(n)
private static Map<Integer, Long> memo = new HashMap<>();
public static long fibFast(int n) {
    if (n <= 1) return n;
    if (memo.containsKey(n)) return memo.get(n);
    long result = fibFast(n - 1) + fibFast(n - 2);
    memo.put(n, result);
    return result;
}

// 优化：迭代替代递归（最优）
public static long fibIter(int n) {
    if (n <= 1) return n;
    long a = 0, b = 1;
    for (int i = 2; i <= n; i++) {
        long c = a + b;
        a = b;
        b = c;
    }
    return b;
}

// 尾递归（Java 未做尾递归优化 TCO！）
public static long factTail(int n, long acc) {
    if (n <= 1) return acc;
    return factTail(n - 1, n * acc);    // 仍会累积栈帧，与 Scala/Kotlin 不同
}
```

**递归的调用栈分析（`factorial(4)`）：**

```
调用 factorial(4) → 压栈
  调用 factorial(3) → 压栈
    调用 factorial(2) → 压栈
      调用 factorial(1) → 压栈
        返回 1 → 弹栈
      返回 2 * 1 = 2 → 弹栈
    返回 3 * 2 = 6 → 弹栈
  返回 4 * 6 = 24 → 弹栈
结果 24，最大栈深度 4
```

> 【重点】**Java 不做尾递归优化（Tail Call Optimization）**，即使是尾递归形式也会累积栈帧。深度递归（如 10 万层）必然 `StackOverflowError`。**解决**：改为迭代 + 显式栈（`Deque`），或用 `Trampoline` 模式（函数式技巧）。

**递归 vs 迭代的权衡：**

| 对比 | 递归 | 迭代 |
| --- | --- | --- |
| 代码简洁性 | 高（树、图、分治天然契合） | 低 |
| 性能 | 低（方法调用开销、栈帧分配） | 高 |
| 内存 | 栈空间 O(深度)，可能溢出 | O(1) 或显式堆栈 |
| 可读性 | 递归问题可读性好 | 简单循环可读性好 |
| 适用 | 树遍历、DFS、分治（快排/归并）、回溯、动态规划 | 线性遍历、斐波那契、阶乘 |

### 7.8 方法设计的最佳实践

```java
// 1. 单一职责：一个方法只做一件事
// ❌
public void processOrder(Order order) {
    validate(order); calculatePrice(order); deductStock(order);
    saveOrder(order); sendEmail(order); updateCache(order);
}
// ✅ 提取为多个小方法，主方法只编排流程
public void processOrder(Order order) {
    validateOrder(order);
    BigDecimal price = calculatePrice(order);
    deductStock(order);
    Order saved = saveOrder(order, price);
    notifyUser(saved);
}

// 2. 参数不超过 3~4 个，多了封装成对象
// ❌
public void createUser(String name, int age, String email, String phone,
                       String address, String city, String country, boolean active)
// ✅
public void createUser(UserCreateParam param)

// 3. 不要返回 null 集合/数组，返回空集合
public List<User> find() {
    return Collections.emptyList();     // ✅
}

// 4. 不要用异常做流程控制
// ❌
try { Integer.parseInt(input); return true; } catch (Exception e) { return false; }
// ✅
public static boolean isNumeric(String s) {
    if (s == null || s.isEmpty()) return false;
    for (char c : s.toCharArray()) if (!Character.isDigit(c)) return false;
    return true;
}

// 5. 布尔参数是坏味道（说明方法有两套逻辑），拆成两个方法
// ❌
public void print(List<String> list, boolean withIndex)
// ✅
public void print(List<String> list)
public void printWithIndex(List<String> list)

// 6. 命名规范：动词开头，读起来像自然语言
getUserById / isExpired / hasPermission / calculateTotal / convertToDto / buildQuery
```

**阿里手册方法设计规约：**

- 【推荐】方法行数不超过 **80 行**（不含注释和空行）。
- 【推荐】方法内部的单行语句数不超过 **1 条**（避免 `if (x) return;` 挤在一行）。
- 【强制】所有的类都添加 `serialVersionUID`（若实现 Serializable）。
- 【推荐】谨慎使用方法内部的重载，容易被误调用。
- 【强制】外部正在调用的接口，不允许修改方法签名，可用 `@Deprecated` 标注并新增方法。

## 8. 综合案例：数组算法工具箱

```java
/**
 * 数组常用算法工具类（面试手写高频）
 */
public final class ArrayAlgorithms {

    private ArrayAlgorithms() { }        // 工具类禁止实例化

    /** 反转数组（原地，O(1) 空间） */
    public static void reverse(int[] arr) {
        for (int i = 0, j = arr.length - 1; i < j; i++, j--) {
            int t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
    }

    /** 求最大值 */
    public static int max(int[] arr) {
        int max = arr[0];                 // 不用 Integer.MIN_VALUE，避免空数组外的误用
        for (int n : arr) if (n > max) max = n;
        return max;
    }

    /** 求和（防溢出用 long） */
    public static long sum(int[] arr) {
        long sum = 0;
        for (int n : arr) sum += n;
        return sum;
    }

    /** 平均值 */
    public static double avg(int[] arr) {
        return arr.length == 0 ? 0 : (double) sum(arr) / arr.length;
    }

    /** 数组去重（保持顺序） */
    public static int[] distinct(int[] arr) {
        LinkedHashSet<Integer> set = new LinkedHashSet<>();
        for (int n : arr) set.add(n);
        return set.stream().mapToInt(Integer::intValue).toArray();
    }

    /** 合并两个有序数组（归并，O(m+n)） */
    public static int[] merge(int[] a, int[] b) {
        int[] result = new int[a.length + b.length];
        int i = 0, j = 0, k = 0;
        while (i < a.length && j < b.length) {
            result[k++] = a[i] <= b[j] ? a[i++] : b[j++];
        }
        while (i < a.length) result[k++] = a[i++];
        while (j < b.length) result[k++] = b[j++];
        return result;
    }

    /** 二分查找（迭代版） */
    public static int binarySearch(int[] arr, int target) {
        int left = 0, right = arr.length - 1;
        while (left <= right) {
            int mid = left + ((right - left) >> 1);   // 防溢出
            if (arr[mid] == target) return mid;
            if (arr[mid] < target) left = mid + 1;
            else right = mid - 1;
        }
        return -1;
    }

    /** 两数之和（HashMap，O(n)） */
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();     // 值 → 下标
        for (int i = 0; i < nums.length; i++) {
            int need = target - nums[i];
            if (seen.containsKey(need)) {
                return new int[]{seen.get(need), i};
            }
            seen.put(nums[i], i);
        }
        return new int[0];
    }

    /** 移动零到末尾（保持非零元素相对顺序） */
    public static void moveZeroes(int[] nums) {
        int slow = 0;
        for (int fast = 0; fast < nums.length; fast++) {
            if (nums[fast] != 0) {
                nums[slow++] = nums[fast];
            }
        }
        while (slow < nums.length) nums[slow++] = 0;
    }

    /** 最大子数组和（Kadane 算法，O(n)） */
    public static int maxSubArray(int[] nums) {
        int maxSoFar = nums[0], current = nums[0];
        for (int i = 1; i < nums.length; i++) {
            current = Math.max(nums[i], current + nums[i]);
            maxSoFar = Math.max(maxSoFar, current);
        }
        return maxSoFar;
    }

    /** 数组扩容（模拟 ArrayList 的 1.5 倍扩容） */
    public static int[] grow(int[] arr, int minCapacity) {
        int newCapacity = Math.max(arr.length + (arr.length >> 1), minCapacity);
        return Arrays.copyOf(arr, newCapacity);
    }
}
```

**运行验证：**

```java
public static void main(String[] args) {
    int[] arr = {5, 2, 9, 1, 7};
    System.out.println("原数组: " + Arrays.toString(arr));
    System.out.println("最大值: " + ArrayAlgorithms.max(arr));
    System.out.println("求和: " + ArrayAlgorithms.sum(arr));
    System.out.printf("平均值: %.2f%n", ArrayAlgorithms.avg(arr));

    int[] sorted = Arrays.copyOf(arr, arr.length);
    Arrays.sort(sorted);
    System.out.println("排序后: " + Arrays.toString(sorted));
    System.out.println("二分查找 7: " + ArrayAlgorithms.binarySearch(sorted, 7));

    ArrayAlgorithms.reverse(arr);
    System.out.println("反转后: " + Arrays.toString(arr));

    int[] withZero = {0, 1, 0, 3, 12};
    ArrayAlgorithms.moveZeroes(withZero);
    System.out.println("移零后: " + Arrays.toString(withZero));   // [1, 3, 12, 0, 0]

    int[] neg = {-2, 1, -3, 4, -1, 2, 1, -5, 4};
    System.out.println("最大子数组和: " + ArrayAlgorithms.maxSubArray(neg));  // 6
}
```

## 9. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `System.out.println(arr)` | 打印 `[I@1b6d3586` | 用 `Arrays.toString()` |
| 2 | `Arrays.asList(int[])` | size 为 1 | 用 `Arrays.stream().boxed()` |
| 3 | `Arrays.asList()` 结果增删 | `UnsupportedOperationException` | `new ArrayList<>(Arrays.asList(...))` |
| 4 | `Arrays.asList` 共享底层数组 | 修改互相影响 | 需要独立时拷贝一份 |
| 5 | 数组越界 | `ArrayIndexOutOfBoundsException` | 检查边界，`i < length` |
| 6 | null 数组调方法 | NPE | 判空，返回空数组而非 null |
| 7 | 引用类型数组默认 null | `arr[0].x` NPE | 逐元素初始化 |
| 8 | 基本类型数组不能用 Comparator | 编译错误 | 装箱后排序或手动反转 |
| 9 | `binarySearch` 用于无序数组 | 结果错误且不报错 | 先排序 |
| 10 | 深拷贝误当浅拷贝 | 修改副本影响原对象 | 逐层拷贝元素 |
| 11 | 递归无终止条件 | `StackOverflowError` | 加 base case；改迭代 |
| 12 | 尾递归期望优化 | 仍栈溢出（Java 无 TCO） | 改循环 |
| 13 | `x = x++` | 值不变 | 直接 `x++` |
| 14 | 以为 Java 有引用传递 | 交换对象失败 | 理解值传递本质 |
| 15 | 方法只有返回值不同想重载 | 编译错误 | 改参数或方法名 |
| 16 | 可变参数 + null | NPE（数组为 null） | 显式判空 |
| 17 | 二维数组用固定列数遍历 | 不规则数组越界 | 用 `m[i].length` |
| 18 | `Arrays.sort` 期望稳定（基本类型） | 相同值顺序变化 | 对象数组才用 TimSort |
| 19 | 递归深度大 | 栈溢出 | 增大 `-Xss` 或改迭代 |
| 20 | 忘记 `@Override` | 签名写错变成重载，不报错 | 一律加 `@Override` |

---

## 关联笔记

- 上一篇：[[后端/Java基础/运算符与流程控制]]
- 下一篇：[[后端/Java基础/面向对象基础]]
- 相关：[[后端/Java基础/集合框架-List与Set]]（动态数组）、[[后端/JVM/JVM概述与运行时数据区]]（栈帧与堆）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
