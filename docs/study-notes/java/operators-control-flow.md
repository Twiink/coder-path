---
title: "运算符与流程控制"
aliases:
  - "Java 运算符"
  - "Java 流程控制"
tags:
  - "后端"
  - "java"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/基础语法与数据类型]]"
  - "[[后端/Java基础/数组与方法]]"
  - "[[后端/Java基础/集合框架-List与Set]]"
created: 2026-09-06
updated: 2026-09-06
---

# 运算符与流程控制

## 1. 运算符总览

| 分类 | 运算符 |
| --- | --- |
| 算术运算符 | `+` `-` `*` `/` `%` `++` `--` |
| 赋值运算符 | `=` `+=` `-=` `*=` `/=` `%=` `&=` `\|=` `^=` `<<=` `>>=` `>>>=` |
| 关系运算符 | `==` `!=` `>` `<` `>=` `<=` `instanceof` |
| 逻辑运算符 | `&&` `\|\|` `!` `&` `\|` `^` |
| 位运算符 | `&` `\|` `^` `~` `<<` `>>` `>>>` |
| 三元运算符 | `条件 ? 值1 : 值2` |
| 其他 | `()` `[]` `.` `::`（方法引用） |

**优先级（从高到低，同级别左结合，除赋值和三元为右结合）：**

```
() [] .                    →  最高
++ -- (后置)
! ~ + - (一元正负) ++ -- (前置) (类型)
* / %
+ -
<< >> >>>
< <= > >= instanceof
== !=
&
^
|
&&
||
? :
= += -= *= /= %= &= |= ^= <<= >>= >>>=   →  最低
```

> 【规范】**不要依赖优先级记忆写复杂表达式，用括号明确意图**。`(a & b) == 0` 必须加括号，因为 `==` 优先级高于 `&`，写成 `a & b == 0` 会变成 `a & (b == 0)` 直接编译错误。

## 2. 算术运算符

```java
int a = 10, b = 3;

System.out.println(a + b);    // 13
System.out.println(a - b);    // 7
System.out.println(a * b);    // 30
System.out.println(a / b);    // 3   ← 整数相除，结果取整（截断，不是四舍五入）
System.out.println(a % b);    // 1   ← 取余
System.out.println(-a % b);   // -1  ← 余数符号与被除数一致
System.out.println(a / -b);   // -3
System.out.println(a / 0.0);  // Infinity（浮点除 0）
// System.out.println(a / 0); // ❌ ArithmeticException: / by zero

// 想得到小数结果，必须有一方是浮点数
System.out.println(a / (double) b);   // 3.3333333333333335
System.out.println(10.0 / 3);         // 3.3333333333333335
System.out.println(a * 1.0 / b);      // 3.3333333333333335
```

**【面试】`/` 与 `%` 的边界情况：**

```java
System.out.println(7 / 2);        // 3
System.out.println(-7 / 2);       // -3（向零截断，不是向下取整）
System.out.println(7 / -2);       // -3
System.out.println(-7 / -2);      // 3
System.out.println(-7 % 2);       // -1（余数符号跟随被除数）
System.out.println(7 % -2);       // 1
System.out.println(-7 % -2);      // -1

// 与 Python 的差异（Python 是向下取整）
// Python: -7 // 2 = -4,  -7 % 2 = 1
// Java:   -7 / 2  = -3,  -7 % 2 = -1

// 想要「向下取整」和「正余数」
Math.floorDiv(-7, 2);      // -4，向下取整除法（JDK 8+）
Math.floorMod(-7, 2);      // 1，正余数（JDK 8+）

// 浮点取余
System.out.println(7.5 % 2);    // 1.5
Math.IEEEremainder(7.5, 2);     // -0.5（IEEE 754 标准余数，最近整数）
```

**`++` 与 `--`（自增自减）：**

```java
int i = 5;

// 前置：先自增，再取值
int a = ++i;      // i 变 6，a = 6

i = 5;
// 后置：先取值，再自增
int b = i++;      // b = 5，i 变 6

// 经典面试题
int x = 10;
x = x++;          // x 还是 10！
System.out.println(x);   // 10
// 原理：x++ 先把 x 的原值 10 压入操作数栈，然后 x 自增为 11，
//      最后赋值语句把栈里的 10 赋回给 x，覆盖了 11。

int y = 10;
y = ++y;          // y = 11
System.out.println(y);   // 11

// 连续自增
int z = 5;
System.out.println(z++ + ++z);   // 5 + 7 = 12（z: 5→6→7）
```

> 【坑】`x = x++` 是典型的无意义写法，IDEA 会警告。**不要在同一表达式中多次修改同一变量**（Java 虽然不像 C 那样是未定义行为，但可读性极差、结果难以推理）。

**Math 类的数学运算：**

```java
// 取整
Math.ceil(3.2);          // 4.0，向上取整
Math.floor(3.8);         // 3.0，向下取整
Math.round(3.5);         // 4，四舍五入（返回 long/int）
Math.round(-3.5);        // -3（-3.5 + 0.5 = -3.0，floor 后为 -3）
Math.round(-3.6);        // -4
Math.rint(3.5);          // 4.0，最近的整数（.5 时取偶数，银行家舍入）
Math.rint(2.5);          // 2.0

// 最值与绝对值
Math.max(3, 5);          // 5
Math.min(3, 5);          // 3
Math.abs(-5);            // 5
Math.abs(Integer.MIN_VALUE);   // 仍是负数！溢出（-(-2147483648) 超出 int 范围）

// 幂与开方
Math.pow(2, 10);         // 1024.0（返回 double）
Math.sqrt(16);           // 4.0
Math.cbrt(27);           // 3.0，立方根
Math.hypot(3, 4);        // 5.0，直角三角形斜边（避免中间溢出）

// 对数
Math.log(Math.E);        // 1.0，自然对数
Math.log10(100);         // 2.0
Math.log1p(0);           // 0.0，ln(1+x)，x 很小时更精确
Math.exp(1);             // 2.718281828459045

// 三角函数（参数是弧度）
Math.sin(Math.PI / 2);   // 1.0
Math.cos(0);             // 1.0
Math.tan(Math.PI / 4);   // 0.9999999999999999
Math.toRadians(180);     // 3.141592653589793，角度转弧度
Math.toDegrees(Math.PI); // 180.0
Math.atan2(1, 1);        // 0.7853981633974483，象限正确的反正切

// 随机数
Math.random();           // [0.0, 1.0) 的 double
(int)(Math.random() * 100);              // [0, 100) 的整数
(int)(Math.random() * (max - min + 1) + min);   // [min, max] 区间

// 符号与拷贝
Math.signum(-5.0);       // -1.0
Math.copySign(3.0, -1.0);// -3.0
Math.addExact(Integer.MAX_VALUE, 1);   // 抛 ArithmeticException（JDK 8+，溢出检测）
Math.multiplyExact(100000, 100000);    // 抛异常
Math.incrementExact(Integer.MAX_VALUE);// 抛异常
Math.negateExact(Integer.MIN_VALUE);   // 抛异常
```

**Random 类（更可控的随机数）：**

```java
import java.util.Random;

Random r = new Random();                 // 用当前时间纳秒作种子
Random r2 = new Random(12345L);          // 固定种子 → 每次运行序列相同（可用于复现测试）

r.nextInt();                             // 任意 int（可能为负）
r.nextInt(100);                          // [0, 100)
r.nextInt(50, 100);                      // [50, 100)  ← JDK 17+
r.nextLong();
r.nextLong(1000);                        // JDK 17+
r.nextDouble();                          // [0.0, 1.0)
r.nextFloat();
r.nextBoolean();
r.nextGaussian();                        // 正态分布，均值 0 标准差 1
byte[] bytes = new byte[16];
r.nextBytes(bytes);                      // 填充随机字节
r.ints(10, 0, 100);                      // JDK 8+，IntStream 10 个 [0,100) 随机数
r.ints().limit(5).forEach(System.out::println);

// JDK 17+ 新一代随机数生成器
RandomGenerator gen = RandomGeneratorFactory.of("L64X128MixRandom").create();
```

> 【安全】密码、Token、验证码等安全敏感场景**必须用 `SecureRandom`**，`Random` 的种子可预测（线性同余算法），能被推算出后续所有值。
> ```java
> SecureRandom sr = new SecureRandom();
> byte[] token = new byte[32];
> sr.nextBytes(token);
> ```

## 3. 赋值运算符

### 3.1 基本赋值

```java
int a = 10;
int b = a;              // 值拷贝
String s = "x";
User u = new User();    // 引用赋值：u 和右边指向同一对象
```

### 3.2 复合赋值运算符（自带隐式强转）

```java
int a = 10;
a += 5;      // 等价 a = (int)(a + 5) → 15
a -= 3;      // 12
a *= 2;      // 24
a /= 4;      // 6
a %= 4;      // 2

// 隐式强转的体现
byte b = 10;
b += 5;              // ✅ 15，等价 b = (byte)(b + 5)
// b = b + 5;        // ❌ 编译错误，b+5 是 int

short s = 10;
s *= 1.5;            // ✅ 15，等价 s = (short)(s * 1.5)

int i = 5;
i += 3.7;            // ✅ 8，等价 i = (int)(i + 3.7)，小数被截断
```

**位运算复合赋值：**

```java
int a = 0b1010;      // 10
a &= 0b1100;         // 0b1000 = 8
a |= 0b0011;         // 0b1011 = 11
a ^= 0b1111;         // 0b0100 = 4
a <<= 2;             // 左移 2 位
a >>= 1;             // 右移 1 位（算术，补符号位）
a >>>= 1;            // 无符号右移
```

## 4. 关系运算符与 == vs equals

```java
int a = 10, b = 20;
System.out.println(a == b);    // false
System.out.println(a != b);    // true
System.out.println(a < b);     // true
System.out.println(a <= b);    // true
System.out.println(a > b);     // false
System.out.println(a >= b);    // false

// 关系运算符不能用于 boolean（Java 不像 C 那样把布尔当数字）
boolean flag = true;
// if (flag > false) { }       // ❌ 编译错误
// if (flag == 1) { }          // ❌ 编译错误
```

### 4.1 == 与 equals 的区别（必考）

| 对比 | `==` | `equals` |
| --- | --- | --- |
| 本质 | **运算符** | **方法**（`Object.equals`） |
| 基本类型 | 比较**值**是否相等 | 不适用（不能对基本类型调用方法） |
| 引用类型 | 比较**地址**（是否同一对象） | 默认同 `==`；重写后比较**内容** |
| 能否重写 | 不能 | 能，且**建议所有值对象都重写** |

```java
// 基本类型：== 比较值
int x = 10, y = 10;
System.out.println(x == y);        // true

// 引用类型：== 比较地址
User u1 = new User("Tom");
User u2 = new User("Tom");
System.out.println(u1 == u2);          // false，两个不同对象
System.out.println(u1.equals(u2));     // false（未重写 equals，等同 ==）

// 重写了 equals 的类
String s1 = new String("abc");
String s2 = new String("abc");
System.out.println(s1 == s2);          // false
System.out.println(s1.equals(s2));     // true，String 重写了 equals 比较字符内容

// 包装类
Integer i1 = 100, i2 = 100;
System.out.println(i1 == i2);          // true（缓存池 -128~127）
Integer i3 = 200, i4 = 200;
System.out.println(i3 == i4);          // false（超出缓存范围）
System.out.println(i3.equals(i4));     // true
```

**String.equals 源码：**

```java
public boolean equals(Object anObject) {
    if (this == anObject) {              // 1. 地址相同直接 true（快速路径）
        return true;
    }
    if (anObject instanceof String) {    // 2. 类型判断（JDK 15 前用 instanceof，之后有优化）
        String aString = (String)anObject;
        if (!COMPACT_STRINGS || this.coder == aString.coder) {
            return StringLatin1.equals(value, aString.value);  // 3. 逐字符比较
        }
    }
    return false;
}
```

### 4.2 equals 的五大契约（重写必须遵守）

1. **自反性（Reflexive）**：`x.equals(x)` 必须为 true。
2. **对称性（Symmetric）**：`x.equals(y)` 为 true 则 `y.equals(x)` 也必须 true。
3. **传递性（Transitive）**：`x.equals(y)` 且 `y.equals(z)` 为 true，则 `x.equals(z)` 为 true。
4. **一致性（Consistent）**：多次调用结果不变（前提是比较的字段没被修改）。
5. **非空性**：`x.equals(null)` 必须返回 false。

> 【坑】**继承时重写 equals 极易破坏对称性**。经典错误：子类用 `instanceof` 判断，父类用 `getClass()` 判断，导致 `parent.equals(child)` 为 true 而 `child.equals(parent)` 为 false。
>
> 《Effective Java》的建议：**要么用 `getClass()` 严格同类型比较，要么不要在可实例化的父类上重写 equals（改用抽象类 + 模板方法）**。用 `instanceof` 只在「父类是接口/抽象类且子类不会新增影响相等的字段」时安全。

### 4.3 重写 equals 必须同时重写 hashCode

**【强制】契约：equals 相等的两个对象，hashCode 必须相等**（反之不要求）。

```java
// ❌ 只重写 equals 不重写 hashCode 的灾难
class User {
    private String name;
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof User)) return false;
        User user = (User) o;
        return Objects.equals(name, user.name);
    }
    // 没重写 hashCode，用的是 Object 的地址哈希
}

Set<User> set = new HashSet<>();
set.add(new User("Tom"));
System.out.println(set.contains(new User("Tom")));   // false！
// HashSet 先用 hashCode 定位桶，两个对象 hashCode 不同 → 落到不同桶 → 找不到
Map<User, String> map = new HashMap<>();
map.put(new User("Tom"), "v");
map.get(new User("Tom"));    // null！同一个原因
```

**标准重写模板（IDEA `Alt+Insert` → equals() and hashCode() 生成）：**

```java
import java.util.Objects;

public class User {
    private Long id;
    private String name;
    private Integer age;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;                          // 1. 快速路径
        if (o == null || getClass() != o.getClass()) return false;  // 2. 类型判断
        User user = (User) o;                                // 3. 强转
        return Objects.equals(id, user.id)                   // 4. 逐字段比较（null 安全）
            && Objects.equals(name, user.name)
            && Objects.equals(age, user.age);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, age);                  // 用相同字段
    }

    @Override
    public String toString() {
        return "User{" + "id=" + id + ", name='" + name + '\'' + ", age=" + age + '}';
    }
}
```

**hashCode 的手写实现（理解原理）：**

```java
@Override
public int hashCode() {
    int result = 17;                                          // 非零初始值
    result = 31 * result + (id != null ? id.hashCode() : 0);  // 31 是质数，分布均匀
    result = 31 * result + (name != null ? name.hashCode() : 0);
    result = 31 * result + (age != null ? age.hashCode() : 0);
    return result;
}
// 为什么是 31？
// 1. 质数，减少哈希冲突
// 2. 31 * i 可被 JVM 优化为 (i << 5) - i，位运算比乘法快
```

> 【Lombok】用 `@EqualsAndHashCode` 或 `@Data` 自动生成，注意 JPA 实体要用 `@EqualsAndHashCode(onlyExplicitlyIncluded = true)` 只基于主键，避免懒加载触发全表查询。

### 4.4 instanceof 与模式匹配

```java
// 传统写法
if (obj instanceof String) {
    String s = (String) obj;       // 需要显式强转
    System.out.println(s.length());
}

// JDK 16+ 模式匹配 for instanceof（JEP 394）
if (obj instanceof String s) {     // 判断 + 强转 + 声明一步到位
    System.out.println(s.length());
}
if (obj instanceof String s && s.length() > 3) {   // 可在同一表达式中使用 s
    System.out.println(s);
}

// JDK 21 Record 模式（JEP 440）
record Point(int x, int y) {}
if (obj instanceof Point(int x, int y)) {
    System.out.println(x + y);
}

// instanceof 对 null 安全
String n = null;
System.out.println(n instanceof String);   // false，不抛 NPE

// 数组类型判断
int[] arr = new int[10];
System.out.println(arr instanceof int[]);  // true
System.out.println(arr instanceof Object); // true（数组是 Object 的子类）
```

## 5. 逻辑运算符

| 运算符 | 名称 | 规则 | 短路 |
| --- | --- | --- | --- |
| `&&` | 短路与 | 两边都 true 才 true | **✅ 左边 false 则不计算右边** |
| `\|\|` | 短路或 | 有一边 true 就 true | **✅ 左边 true 则不计算右边** |
| `!` | 逻辑非 | 取反 | — |
| `&` | 逻辑与 / 按位与 | 两边都 true 才 true | ❌ 两边都计算 |
| `\|` | 逻辑或 / 按位或 | 有一边 true 就 true | ❌ 两边都计算 |
| `^` | 异或 | 两边不同才 true | ❌ |

```java
// 短路的重要性（避免 NPE）
String s = null;
if (s != null && s.length() > 0) {        // ✅ s 为 null 时右边不执行
    System.out.println(s);
}
if (s != null & s.length() > 0) {         // ❌ NullPointerException！两边都执行
}

// 短路或
if (isValid() || checkExpensive()) { }    // isValid 为 true 时不做昂贵检查

// 短路的副作用陷阱
int i = 0;
boolean b = (i++ > 0) || (i++ > 5);       // 左边 0>0 false，执行右边 1>5 false
System.out.println(i);                    // 2

int j = 0;
boolean c = (j++ >= 0) || (j++ > 5);      // 左边 true，右边不执行！
System.out.println(j);                    // 1

// 异或的特性
System.out.println(true ^ true);     // false
System.out.println(true ^ false);    // true
// 不用第三个变量交换两数
int x = 3, y = 5;
x = x ^ y;
y = x ^ y;
x = x ^ y;
// x=5, y=3（可读性差，实际开发不推荐）
```

> 【规范】**逻辑运算一律用 `&&` 和 `||`**，除非确实需要求值两边的副作用（极罕见）。用 `&`/`|` 做布尔运算是 bug 温床。

## 6. 位运算符

位运算直接操作二进制位，是理解 `HashMap` 扰动函数、`ConcurrentHashMap`、雪花算法的基础。

| 运算符 | 名称 | 规则 | 示例（8 位） |
| --- | --- | --- | --- |
| `&` | 按位与 | 两位都为 1 才为 1 | `1010 & 1100 = 1000` |
| `\|` | 按位或 | 有一位为 1 就为 1 | `1010 \| 1100 = 1110` |
| `^` | 按位异或 | 两位不同为 1 | `1010 ^ 1100 = 0110` |
| `~` | 按位取反 | 0 变 1，1 变 0 | `~1010 = 0101` |
| `<<` | 左移 | 低位补 0，值 × 2ⁿ | `00001010 << 2 = 00101000`（10→40） |
| `>>` | 算术右移 | **高位补符号位**，值 ÷ 2ⁿ | `1010...  >> 1`（负数仍为负） |
| `>>>` | 逻辑右移 | **高位补 0** | 负数右移变正数 |

```java
int a = 10;    // 0000 1010
int b = 12;    // 0000 1100

System.out.println(a & b);     // 8    (0000 1000)
System.out.println(a | b);     // 14   (0000 1110)
System.out.println(a ^ b);     // 6    (0000 0110)
System.out.println(~a);        // -11  (补码：取反加一)

System.out.println(a << 1);    // 20   （× 2）
System.out.println(a << 3);    // 80   （× 8）
System.out.println(a >> 1);    // 5    （÷ 2）
System.out.println(a >>> 1);   // 5    （正数时 >> 与 >>> 相同）

int neg = -10;
System.out.println(neg >> 1);    // -5    （算术右移，高位补 1，保持负号）
System.out.println(neg >>> 1);   // 2147483643 （逻辑右移，高位补 0，变成大正数）

// 移位超过类型位数：对 int 取模 32，对 long 取模 64
System.out.println(1 << 32);    // 1 ！ 等价 1 << 0
System.out.println(1 << 33);    // 2 ！ 等价 1 << 1
```

**负数的补码表示（理解 ~ 和 >> 的前提）：**

```
正数 10 的原码:   0000 0000 0000 0000 0000 0000 0000 1010
负数 -10 的表示：
  原码:          1000 0000 0000 0000 0000 0000 0000 1010
  反码(符号位不变，其余取反): 1111 1111 1111 1111 1111 1111 1111 0101
  补码(反码+1):  1111 1111 1111 1111 1111 1111 1111 0110   ← 计算机实际存储
  
~10 = 1111...1111 0101 = -11（补码解释）
-1 的补码 = 全 1
```

**位运算的经典应用：**

```java
// 1. 判断奇偶（比 % 2 快）
boolean isOdd = (n & 1) == 1;              // ✅
boolean isOdd2 = (n & 1) != 0;             // ✅ 更安全（负数时 % 2 得 -1）
// n % 2 == 1 对负数是错的：-3 % 2 == -1

// 2. 乘除 2 的幂
n * 8   →  n << 3
n / 4   →  n >> 2        // 仅对正数等价，负数是向下取整而非向零

// 3. 判断是否为 2 的幂
boolean isPowerOfTwo = (n > 0) && ((n & (n - 1)) == 0);
// HashMap 的 tableSizeFor 用它找不小于 cap 的最小 2 的幂

// 4. 交换两个数（不用临时变量）
a ^= b; b ^= a; a ^= b;

// 5. 取出二进制中 1 的个数
Integer.bitCount(n);          // JDK 内置，比循环快

// 6. 权限/状态位标志（Linux 文件权限、用户权限组合）
final int READ    = 1 << 0;   // 0001
final int WRITE   = 1 << 1;   // 0010
final int EXECUTE = 1 << 2;   // 0100
int permission = READ | WRITE;            // 授权：置位
boolean canRead = (permission & READ) != 0;   // 检查：与运算
permission &= ~WRITE;                     // 撤销：与非
permission ^= EXECUTE;                    // 切换：异或

// 7. HashMap 的扰动函数（降低碰撞）
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
    // 高 16 位与低 16 位异或，让高位也参与索引计算
}

// 8. 雪花算法中的位运算（分布式 ID）
long id = ((timestamp - epoch) << 22)     // 时间戳左移 22 位（10 位机器 + 12 位序列）
        | (workerId << 12)                // 机器 ID 左移 12 位
        | sequence;                        // 序列号占低 12 位

// 9. 布隆过滤器的位数组
BitSet bits = new BitSet(1 << 20);
bits.set(hashCode);
boolean maybeExists = bits.get(hashCode);

// 10. 掩码提取字节
int color = 0xFFAABBCC;
int alpha = (color >>> 24) & 0xFF;   // 0xFF
int red   = (color >>> 16) & 0xFF;   // 0xAA
int green = (color >>> 8)  & 0xFF;   // 0xBB
int blue  = color & 0xFF;            // 0xCC
```

## 7. 三元运算符

```java
// 语法：条件 ? 表达式1 : 表达式2
int max = (a > b) ? a : b;
String status = (score >= 60) ? "及格" : "不及格";

// 嵌套（可读性差，最多一层）
String level = (score >= 90) ? "A" : (score >= 60) ? "B" : "C";

// 常见用法
int abs = (n < 0) ? -n : n;
String name = (user != null) ? user.getName() : "匿名";
```

**【坑】三元运算符的类型推断陷阱（生产事故来源）：**

```java
// 陷阱 1：拆箱导致 NPE
Integer a = null;
Integer b = 1;
Integer result = (Math.random() > 0.5) ? a : b;
// 编译器推断第二、三操作数的公共类型为 int（因为 b 可以拆箱），
// 于是对整个表达式做拆箱 → a 为 null 时 NPE！

// 修复：让两侧类型都是 Integer
Integer result2 = (Math.random() > 0.5) ? a : (Integer) b;

// 陷阱 2：数值类型提升
Object o = true ? 1 : 2.0;
System.out.println(o.getClass());   // class java.lang.Double！int 被提升为 double

// 陷阱 3：不同引用类型的公共父类
CharSequence cs = true ? "str" : new StringBuilder("sb");   // 类型是 CharSequence

// 陷阱 4：与泛型结合
List<String> list = flag ? Collections.emptyList() : new ArrayList<>();
// 可能推断为 List<Object>，需要显式 Collections.<String>emptyList()
```

> 【规范】**三元运算符的两侧类型必须一致，或都是引用类型/都是基本类型**。IDEA 会对可疑的类型提升给出警告「Numeric conversion in conditional expression」。

## 8. 流程控制总览

```
流程控制
├── 顺序结构：代码从上到下依次执行（默认）
├── 分支结构
│   ├── if / if-else / if-else if-else
│   └── switch（传统 / JDK 14+ 表达式）
└── 循环结构
    ├── for（基本 / 增强 for-each）
    ├── while
    ├── do-while
    └── break / continue / return / 标签
```

## 9. if 分支

```java
// 单分支
if (age >= 18) {
    System.out.println("成年");
}

// 双分支
if (score >= 60) {
    System.out.println("及格");
} else {
    System.out.println("不及格");
}

// 多分支（if-else if 链）
if (score >= 90) {
    grade = "A";
} else if (score >= 80) {
    grade = "B";
} else if (score >= 70) {
    grade = "C";
} else if (score >= 60) {
    grade = "D";
} else {
    grade = "F";
}
// 注意：条件从上往下判断，第一个满足就退出，所以顺序必须从严格到宽松

// JDK 条件必须是 boolean，不能是数字或非空判断
// if (1) { }              // ❌ 编译错误
// if (str) { }            // ❌ 编译错误（不像 Python/JS）
if (str != null && !str.isEmpty()) { }   // ✅
```

**卫语句（Guard Clause）—— 减少嵌套的最佳实践：**

```java
// ❌ 深层嵌套（"箭头形代码"，难读难维护）
public String process(User user) {
    if (user != null) {
        if (user.getStatus() == 1) {
            if (user.getAge() >= 18) {
                return doBusiness(user);
            } else {
                return "未成年";
            }
        } else {
            return "状态异常";
        }
    } else {
        return "用户为空";
    }
}

// ✅ 卫语句：提前返回，主逻辑在最外层
public String process(User user) {
    if (user == null) {
        return "用户为空";
    }
    if (user.getStatus() != 1) {
        return "状态异常";
    }
    if (user.getAge() < 18) {
        return "未成年";
    }
    return doBusiness(user);
}
```

> 【强制】阿里手册：**避免采用取反逻辑运算符**；**超过 3 层的 if-else 逻辑判断代码，可以使用卫语句、策略模式、状态模式重构**。

## 10. switch 分支

### 10.1 传统 switch

**支持的类型（编译期决定）：**

| 版本 | 支持的 switch 表达式类型 |
| --- | --- |
| JDK 1.0 | `byte`、`short`、`char`、`int` |
| JDK 5 | 加上**枚举** |
| JDK 7 | 加上 **`String`** |
| ❌ 永远不支持 | `long`、`float`、`double`、`boolean`（及其包装类，除 Integer 等） |

```java
int day = 3;
switch (day) {
    case 1:
        System.out.println("周一");
        break;                       // 必须 break，否则穿透（fall-through）
    case 2:
        System.out.println("周二");
        break;
    case 3:
    case 4:                          // 多个 case 共享一段逻辑（穿透的合法用途）
        System.out.println("周三或周四");
        break;
    default:                         // 所有 case 都不匹配时执行，位置任意（惯例放最后）
        System.out.println("其他");
        break;
}
```

**switch 的穿透（fall-through）：**

```java
int x = 1;
switch (x) {
    case 1:
        System.out.print("A");    // 执行
    case 2:
        System.out.print("B");    // 也执行！没有 break
    case 3:
        System.out.print("C");    // 也执行！
    default:
        System.out.print("D");    // 也执行！
}
// 输出：ABCD
```

**String switch 的底层原理：**

```java
String s = "b";
switch (s) {
    case "a": System.out.println(1); break;
    case "b": System.out.println(2); break;
}

// javac 编译后实际是：
int hash = s.hashCode();
int index = -1;
switch (hash) {
    case 97:                          // "a".hashCode()
        if (s.equals("a")) index = 0;
        break;
    case 98:                          // "b".hashCode()
        if (s.equals("b")) index = 1;
        break;
}
switch (index) {
    case 0: System.out.println(1); break;
    case 1: System.out.println(2); break;
}
// 结论：String switch = hashCode 定位 + equals 精确比较
// 所以 case 的字符串不能重复（hashCode + equals 都相同会冲突），
// 且 switch 的字符串变量不能为 null（会 NPE，调用 hashCode 时）
```

**switch 的实现机制（字节码层面）：**

| 情况 | 生成的指令 | 效率 |
| --- | --- | --- |
| case 值**密集连续** | `tableswitch`（跳转表，数组索引直接定位） | O(1)，最快 |
| case 值**稀疏** | `lookupswitch`（二分查找的有序键值对） | O(log n) |
| String | 先 `hashCode` 的 `lookupswitch` + `equals`，再 `tableswitch` | O(log n) |
| 枚举 | `switch(枚举)` 编译为 `switch(ordinal)` + 合成数组 | O(1) |

```java
// tableswitch 示例（case 连续）
switch (n) { case 1: ...; case 2: ...; case 3: ...; }   // → tableswitch

// lookupswitch 示例（case 稀疏）
switch (n) { case 1: ...; case 100: ...; case 10000: ...; }  // → lookupswitch
```

> 【性能】所以 `switch` 的 case 值如果连续密集，JVM 会用跳转表，效率高于 if-else 链。但**分支数少于 5 个时，if-else 与 switch 差异可忽略**。

### 10.2 JDK 14+ switch 表达式（推荐）

**新语法用 `->` 代替 `:`，无穿透，可返回值：**

```java
// 1. 箭头形式（无 break，无穿透）
int day = 3;
switch (day) {
    case 1 -> System.out.println("周一");
    case 2 -> System.out.println("周二");
    case 3, 4, 5 -> System.out.println("工作日");   // 多值合并
    case 6, 7 -> System.out.println("周末");
    default -> System.out.println("非法");
}

// 2. 作为表达式返回值（必须有 default 或穷尽所有情况）
String dayName = switch (day) {
    case 1 -> "周一";
    case 2 -> "周二";
    case 3 -> "周三";
    default -> "未知";
};

// 3. 多条语句用 yield 返回值
int numLetters = switch (dayName) {
    case "MONDAY", "FRIDAY", "SUNDAY" -> 6;
    case "TUESDAY" -> 7;
    case "THURSDAY", "SATURDAY" -> {
        System.out.println("计算中...");
        yield 8;                    // yield 代替 return
    }
    default -> {
        log.warn("Unexpected: " + dayName);
        yield 0;
    }
};

// 4. 枚举 + switch 表达式（穷尽时无需 default）
enum Status { PENDING, PAID, SHIPPED, DONE, CANCELLED }
String desc = switch (status) {
    case PENDING -> "待支付";
    case PAID -> "已支付";
    case SHIPPED -> "已发货";
    case DONE -> "已完成";
    case CANCELLED -> "已取消";
    // 穷尽所有枚举值，编译器保证完整，新增枚举值时这里会编译报错（优点！）
};

// 5. JDK 21 switch 模式匹配（JEP 441）
static String format(Object obj) {
    return switch (obj) {
        case Integer i -> "整数: " + i;
        case Long l    -> "长整数: " + l;
        case String s  -> "字符串: " + s.trim();
        case int[] arr -> "整型数组，长度 " + arr.length;
        case null      -> "空值";           // JDK 21 可显式匹配 null
        default        -> "其他: " + obj;
    };
}

// 6. JDK 21 带条件的模式（guarded pattern）
static String classify(Integer i) {
    return switch (i) {
        case null -> "null";
        case Integer x when x > 100 -> "大数";
        case Integer x when x < 0   -> "负数";
        case Integer _              -> "普通正数";
    };
}
```

**传统 switch vs switch 表达式：**

| 对比项 | 传统 switch（语句） | switch 表达式（JDK 14+） |
| --- | --- | --- |
| 分隔符 | `:` | `->`（也支持 `:` + `yield`） |
| 穿透 | 需要 `break`，否则穿透 | **无穿透** |
| 返回值 | 不能返回值 | 可作为表达式返回值 |
| default | 可选 | 作为表达式时**必需**（除非穷尽） |
| 多值 case | 需堆叠 case | `case 1, 2, 3 ->` |
| 局部变量作用域 | 整个 switch 共享（易冲突） | **每个分支独立作用域** |

### 10.3 if-else vs switch 的选择

| 场景 | 推荐 |
| --- | --- |
| 判断区间（`score >= 90`） | if-else（switch 不支持范围） |
| 判断布尔组合条件 | if-else |
| 等值判断且分支 ≥ 4 个 | switch（可读性好，可能有跳转表优化） |
| 枚举映射 | switch（穷尽性检查是巨大优势） |
| 类型分发 | JDK 21 switch 模式匹配 |
| 分支极多（> 10）且是等值 | 考虑用 `Map&lt;K, Handler&gt;` 策略模式替代 |

## 11. for 循环

### 11.1 基本 for

```java
// 语法：for (初始化; 循环条件; 迭代) { 循环体 }
for (int i = 0; i < 10; i++) {
    System.out.println(i);
}

// 执行顺序：
// 1. 初始化（只执行一次）
// 2. 判断条件 → false 则退出
// 3. 执行循环体
// 4. 执行迭代语句
// 5. 回到 2

// 三部分都可省略（死循环）
for (;;) {
    // 等价 while(true)
    break;
}

// 多个初始化/迭代变量（必须同类型）
for (int i = 0, j = 10; i < j; i++, j--) {
    System.out.println(i + "," + j);
}

// 倒序
for (int i = 10; i > 0; i--) { }

// 步长 2
for (int i = 0; i < 100; i += 2) { }

// 遍历数组
int[] arr = {1, 2, 3, 4, 5};
for (int i = 0; i < arr.length; i++) {
    System.out.println(arr[i]);
}
```

> 【性能】`i < arr.length` 每次都会读 `length`（数组的 length 是字段访问，很快），JIT 会优化。但遍历 `List` 时 `list.size()` 是方法调用，**大集合建议提前存变量**：`for (int i = 0, n = list.size(); i < n; i++)`。

### 11.2 增强 for（for-each，JDK 5+）

```java
// 遍历数组
int[] arr = {1, 2, 3};
for (int n : arr) {
    System.out.println(n);
}

// 遍历集合（必须实现 Iterable）
List<String> list = Arrays.asList("a", "b", "c");
for (String s : list) {
    System.out.println(s);
}

// 遍历 Map（不能直接 for-each Map，要遍历 entrySet）
Map<String, Integer> map = new HashMap<>();
for (Map.Entry<String, Integer> entry : map.entrySet()) {
    System.out.println(entry.getKey() + "=" + entry.getValue());
}
// JDK 8+
map.forEach((k, v) -> System.out.println(k + "=" + v));
```

**增强 for 的底层：**

```java
// 数组 → 编译为普通 for + 索引
for (int n : arr) { ... }
// 等价于
for (int i = 0; i < arr.length; i++) {
    int n = arr[i];
    ...
}

// Iterable → 编译为 Iterator
for (String s : list) { ... }
// 等价于
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    String s = it.next();
    ...
}
```

**增强 for 的限制（重要）：**

```java
// ❌ 不能修改元素值（对基本类型是值拷贝）
int[] arr = {1, 2, 3};
for (int n : arr) {
    n = n * 2;        // 只改了副本，arr 不变！
}
// arr 仍是 {1, 2, 3}

// ✅ 修改引用类型对象的内容可以生效
List<User> users = ...;
for (User u : users) {
    u.setName("new");    // ✅ 修改的是堆中对象
}
// users = ...;          // ❌ 无法给集合本身重新赋值

// ❌ 不能在 for-each 中增删元素（ConcurrentModificationException）
for (String s : list) {
    list.remove(s);      // 抛 ConcurrentModificationException！
}
// ✅ 正确做法
list.removeIf(s -> s.startsWith("a"));          // JDK 8+
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (it.next().startsWith("a")) it.remove();  // 用 Iterator.remove
}
```

> 【面试】**为什么 for-each 中 remove 会抛 `ConcurrentModificationException`？**
>
> `ArrayList.iterator()` 返回的 `Itr` 记录了 `expectedModCount = modCount`。`list.remove()` 会让 `modCount++`，而 `Itr` 的 `expectedModCount` 没变。下次调用 `next()` 时执行 `checkForComodification()`，发现 `modCount != expectedModCount`，抛异常。用 `it.remove()` 则会同步更新 `expectedModCount`。

**三种遍历方式性能对比：**

| 方式 | 数组 | ArrayList | LinkedList |
| --- | --- | --- | --- |
| 普通 for（索引） | **最快** | 快（随机访问 O(1)） | **极慢**（每次 get(i) 是 O(n)，总体 O(n²)） |
| 增强 for（迭代器） | 快 | 快 | **最快**（顺序遍历 O(n)） |
| `forEach` + Lambda | 快 | 快 | 快 |
| Stream | 略慢（有创建开销） | 略慢 | 略慢 |

> 【结论】**随机访问集合（ArrayList、数组）用索引 for；链式集合（LinkedList）必须用迭代器/for-each**。

## 12. while 与 do-while

```java
// while：先判断后执行（可能一次都不执行）
int i = 0;
while (i < 5) {
    System.out.println(i);
    i++;
}

// do-while：先执行后判断（至少执行一次）
int j = 0;
do {
    System.out.println(j);
    j++;
} while (j < 5);      // 注意末尾有分号！

// 至少执行一次的场景：用户输入校验
Scanner sc = new Scanner(System.in);
int input;
do {
    System.out.print("请输入 1~10：");
    input = sc.nextInt();
} while (input < 1 || input > 10);

// while(true) 死循环 + break（常用模式）
while (true) {
    Task task = queue.poll();
    if (task == null) break;
    process(task);
}
```

**while vs for 的选择：**

| 场景 | 推荐 |
| --- | --- |
| 循环次数已知 | `for` |
| 循环次数未知（依赖条件） | `while` |
| 至少要执行一次 | `do-while` |
| 无限循环 + 退出条件 | `while(true) &#123; if(...) break; &#125;` |

## 13. break、continue、return 与标签

### 13.1 break 与 continue

```java
// break：立即结束整个循环
for (int i = 0; i < 10; i++) {
    if (i == 5) break;       // i=5 时退出循环
    System.out.print(i);     // 01234
}

// continue：跳过本次循环，进入下一次
for (int i = 0; i < 10; i++) {
    if (i % 2 == 0) continue;  // 偶数跳过
    System.out.print(i);       // 13579
}

// break 也可用于 switch，continue 不能用于 switch
```

### 13.2 标签（Label）—— 跳出多层循环

```java
// 标签语法：标识符 + 冒号，放在循环语句前
outer:
for (int i = 0; i < 5; i++) {
    inner:
    for (int j = 0; j < 5; j++) {
        if (j == 2) continue outer;    // 跳过外层循环本次，i++ 后继续
        if (i == 3) break outer;       // 直接结束外层循环
        System.out.println(i + "," + j);
    }
}

// 实用示例：在二维数组中查找目标
int[][] matrix = {{1,2,3},{4,5,6},{7,8,9}};
int target = 5;
boolean found = false;
search:
for (int[] row : matrix) {
    for (int n : row) {
        if (n == target) {
            found = true;
            break search;          // 一次跳出两层
        }
    }
}
```

> 【规范】标签命名用小驼峰，且**尽量避免超过 2 层嵌套循环**（用卫语句、抽取方法替代）。阿里手册：「避免采用多层循环嵌套，必要时使用标签 break」。

### 13.3 return

```java
public int max(int a, int b) {
    if (a > b) return a;      // 提前返回，结束方法
    return b;
}

public void process() {
    if (!valid()) return;     // void 方法用 return 提前结束
    doWork();
}
```

**break / continue / return 对比：**

| 关键字 | 作用范围 | 效果 |
| --- | --- | --- |
| `break` | 当前循环/switch | 结束**整个**循环，执行循环后的代码 |
| `continue` | 当前循环 | 跳过**本次**，进入下一次迭代 |
| `return` | 当前方法 | 结束**整个方法**，返回调用处 |

### 13.4 finally 中的 return 陷阱

```java
public static int test() {
    try {
        return 1;
    } finally {
        return 2;         // ❌ 覆盖 try 的返回值，且会吞掉异常！
    }
}
// test() 返回 2

public static int test2() {
    int x = 1;
    try {
        return x;         // 把 x 的值 1 暂存到返回值槽
    } finally {
        x = 2;            // 修改局部变量不影响已暂存的返回值
    }
}
// test2() 返回 1

public static int test3() {
    StringBuilder sb = new StringBuilder("a");
    try {
        return sb.length();   // 暂存 1
    } finally {
        sb.append("b");       // 修改对象内容，但返回值已确定
    }
}
// test3() 返回 1
```

> 【强制】**禁止在 finally 块中使用 return**。它会覆盖 try/catch 中的返回值，并且如果 try 中抛出了异常，finally 的 return 会**吞掉异常**，导致问题无法排查。

## 14. 嵌套循环与经典算法示例

### 14.1 打印图形

```java
// 直角三角形
for (int i = 1; i <= 5; i++) {
    for (int j = 1; j <= i; j++) {
        System.out.print("* ");
    }
    System.out.println();
}
// *
// * *
// * * *
// * * * *
// * * * * *

// 倒三角形
for (int i = 5; i >= 1; i--) {
    for (int j = 1; j <= i; j++) System.out.print("* ");
    System.out.println();
}

// 等腰三角形
int n = 5;
for (int i = 1; i <= n; i++) {
    for (int j = 1; j <= n - i; j++) System.out.print(" ");     // 空格
    for (int j = 1; j <= 2 * i - 1; j++) System.out.print("*"); // 星号
    System.out.println();
}

// 九九乘法表
for (int i = 1; i <= 9; i++) {
    for (int j = 1; j <= i; j++) {
        System.out.printf("%d×%d=%-2d ", j, i, i * j);
    }
    System.out.println();
}
```

### 14.2 常用算法片段

```java
// 求 1~100 的和
int sum = 0;
for (int i = 1; i <= 100; i++) sum += i;

// 求阶乘（注意溢出，20! 已超 long）
long fact = 1;
for (int i = 1; i <= 20; i++) fact *= i;

// 斐波那契数列
int a = 0, b = 1;
for (int i = 0; i < 20; i++) {
    System.out.print(a + " ");
    int next = a + b;
    a = b;
    b = next;
}

// 判断素数
boolean isPrime(int n) {
    if (n < 2) return false;
    for (int i = 2; (long) i * i <= n; i++) {   // 只需试到 √n，注意防溢出
        if (n % i == 0) return false;
    }
    return true;
}

// 水仙花数（153 = 1³+5³+3³）
for (int i = 100; i < 1000; i++) {
    int g = i % 10, s = i / 10 % 10, b = i / 100;
    if (g*g*g + s*s*s + b*b*b == i) System.out.println(i);
}

// 冒泡排序
void bubbleSort(int[] arr) {
    for (int i = 0; i < arr.length - 1; i++) {
        boolean swapped = false;              // 优化：本轮无交换则已有序
        for (int j = 0; j < arr.length - 1 - i; j++) {
            if (arr[j] > arr[j+1]) {
                int t = arr[j]; arr[j] = arr[j+1]; arr[j+1] = t;
                swapped = true;
            }
        }
        if (!swapped) break;
    }
}

// 二分查找（前提：有序）
int binarySearch(int[] arr, int target) {
    int left = 0, right = arr.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;  // 防溢出写法，不用 (left+right)/2
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}
```

## 15. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 整数除法丢小数 | `10 / 3 == 3` | 有一方转 double：`10 / 3.0` |
| 2 | `x = x++` 不生效 | x 值不变 | 直接写 `x++` |
| 3 | `-7 % 2 == -1` | 负余数 | 用 `Math.floorMod(-7, 2)` |
| 4 | `Math.abs(MIN_VALUE)` 仍为负 | 溢出 | 先转 long |
| 5 | `n % 2 == 1` 判负奇数错误 | -3 % 2 = -1 | 用 `(n & 1) != 0` |
| 6 | `1 << 32 == 1` | 移位取模 32 | 注意移位量范围 |
| 7 | `&` 代替 `&&` | NPE | 用短路运算符 |
| 8 | switch 忘记 break | 穿透执行多个 case | 用 JDK 14 `->` 语法 |
| 9 | switch(String) 传 null | NPE | 先判空 |
| 10 | switch 用 long/double | 编译错误 | 改用 if-else |
| 11 | 三目运算符拆箱 | NPE | 两侧类型统一 |
| 12 | for-each 中 remove | `ConcurrentModificationException` | `removeIf` 或 `Iterator.remove` |
| 13 | for-each 修改基本类型元素 | 不生效（值拷贝） | 用索引 for |
| 14 | LinkedList 用索引 for | O(n²) 极慢 | 用 for-each |
| 15 | finally 中 return | 覆盖返回值 + 吞异常 | 禁止 |
| 16 | 只重写 equals 不重写 hashCode | HashSet/HashMap 行为异常 | 必须同时重写 |
| 17 | `(a & b) == 0` 不加括号 | 编译错误 | 显式加括号 |
| 18 | `if (flag = true)` | 恒为真 | 用 `==` |

---

## 关联笔记

- 上一篇：[[后端/Java基础/基础语法与数据类型]]
- 下一篇：[[后端/Java基础/数组与方法]]
- 相关：[[后端/Java基础/集合框架-Map与源码剖析]]（位运算应用）、[[后端/Java基础/泛型枚举与注解]]（枚举 switch）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
