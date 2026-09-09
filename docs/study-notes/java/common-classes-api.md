---
title: "常用类与API"
aliases:
  - "String 与日期时间 API"
  - "Java 常用类库"
tags:
  - "后端"
  - "java"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/基础语法与数据类型]]"
  - "[[后端/Java基础/面向对象进阶]]"
  - "[[后端/Java基础/集合框架-List与Set]]"
created: 2026-09-06
updated: 2026-09-06
---

# 常用类与 API

> String 三兄弟、`Integer` 缓存池、不可变性、常量池在 [[后端/Java基础/基础语法与数据类型]] 已详解，本篇聚焦 **Object 方法、日期时间 API、Objects/Math、正则、系统工具类** 等日常高频 API。

## 1. Object 类的核心方法

所有类的根，11 个方法中最常用的是 `equals`、`hashCode`、`toString`、`getClass`、`wait/notify`、`clone`。

### 1.1 getClass()

```java
User u = new User();
Class<?> clazz = u.getClass();                 // 返回运行时类型的 Class 对象

clazz.getName();                               // "com.example.User" 全限定名
clazz.getSimpleName();                         // "User" 简单名
clazz.getSuperclass();                         // class java.lang.Object
clazz.getInterfaces();                         // 实现的接口数组
clazz.getDeclaredFields();                     // 所有字段（含 private，不含继承）
clazz.getDeclaredMethods();                    // 所有方法
clazz.getModifiers();                          // 修饰符位掩码
clazz.newInstance();                           // 反射创建实例（JDK 9 废弃，用 getDeclaredConstructor().newInstance()）

// instanceof vs getClass
obj instanceof User          // true（含子类，判断是否为该类型或其子类）
obj.getClass() == User.class // true（精确类型，不含子类）
```

### 1.2 clone() 与深浅拷贝

```java
// 浅拷贝：只复制对象本身和基本类型字段，引用类型字段复制引用（指向同一对象）
// 深拷贝：递归复制所有引用类型字段，创建全新的对象图

public class User implements Cloneable {          // 必须实现 Cloneable，否则抛 CloneNotSupportedException
    private String name;                           // String 不可变，浅拷贝安全
    private Address address;                       // 引用类型，浅拷贝共享！

    @Override
    protected User clone() throws CloneNotSupportedException {
        // 浅拷贝
        User copy = (User) super.clone();
        // 深拷贝：手动克隆引用字段
        copy.address = this.address.clone();       // Address 也要实现 Cloneable
        return copy;
    }
}
```

**深浅拷贝对比：**

| | 浅拷贝（Shallow Copy） | 深拷贝（Deep Copy） |
| --- | --- | --- |
| 基本类型字段 | 值复制（独立） | 值复制（独立） |
| 引用类型字段 | **复制引用（共享同一对象）** | **递归创建新对象** |
| 修改副本影响原对象 | 会（对引用字段） | 不会 |
| 实现 | `super.clone()` | 递归 clone / 序列化 / JSON / 手动 new |

**深拷贝的几种实现：**

```java
// 方案 1：递归 clone（繁琐，需每层都实现 Cloneable）
// 方案 2：序列化（对象必须 Serializable）
public static <T extends Serializable> T deepCopy(T obj) {
    try (ByteArrayOutputStream bos = new ByteArrayOutputStream();
         ObjectOutputStream oos = new ObjectOutputStream(bos)) {
        oos.writeObject(obj);
        try (ObjectInputStream ois = new ObjectInputStream(
                new ByteArrayInputStream(bos.toByteArray()))) {
            return (T) ois.readObject();
        }
    } catch (Exception e) {
        throw new RuntimeException("深拷贝失败", e);
    }
}

// 方案 3：JSON 序列化（简单，性能一般，需处理特殊类型）
User copy = JSON.parseObject(JSON.toJSONString(user), User.class);   // Fastjson
User copy2 = objectMapper.readValue(objectMapper.writeValueAsString(user), User.class);  // Jackson

// 方案 4：手动拷贝构造器 / 拷贝工厂（推荐，Effective Java 第 13 条）
public class User {
    public User(User other) {                    // 拷贝构造器
        this.name = other.name;
        this.address = new Address(other.address);   // 显式深拷贝
    }
    public static User copyOf(User other) { return new User(other); }  // 拷贝工厂
}
```

> 【建议】《Effective Java》第 13 条：**慎用 clone，优先用拷贝构造器或拷贝工厂**。clone 机制的问题：`Cloneable` 是空标记接口却改变父类行为、`clone` 方法是 protected、绕过构造器（final 字段难处理）、异常处理别扭。集合类推荐用 `new ArrayList<>(otherList)`。

### 1.3 wait/notify（线程协作）

```java
// 必须在 synchronized 块中调用，否则抛 IllegalMonitorStateException
public class WaitNotifyDemo {
    private final Object lock = new Object();
    private boolean ready = false;

    public void producer() throws InterruptedException {
        synchronized (lock) {
            while (!ready) {             // 用 while 而非 if（防虚假唤醒）
                lock.wait();             // 释放锁并等待
            }
            System.out.println("生产");
        }
    }

    public void consumer() {
        synchronized (lock) {
            ready = true;
            lock.notify();               // 唤醒一个等待线程
            // lock.notifyAll();         // 唤醒所有等待线程（推荐，避免信号丢失）
        }
    }
}
```

> 现代并发编程**几乎不用 wait/notify**，改用 `java.util.concurrent` 的 `Condition`、`CountDownLatch`、`BlockingQueue`。详见 [[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]。
>
> 【坑】**为什么 wait 要用 while 而不是 if？** 防止「虚假唤醒」（spurious wakeup）：JVM 允许线程在没有 notify 的情况下被唤醒，或被 notifyAll 唤醒后条件又不满足。while 会重新检查条件，if 不会。

## 2. Objects 工具类（JDK 7+）

`java.util.Objects` 全是静态方法，用于**空安全的对象操作**，是现代 Java 必备。

```java
import java.util.Objects;

// 1. 空安全比较
Objects.equals(a, b);              // null 安全的 equals：都为 null 返回 true，一个 null 返回 false
// 等价于：(a == b) || (a != null && a.equals(b))

// 2. 哈希码
Objects.hash(f1, f2, f3);          // 组合多个字段生成 hashCode（内部 Arrays.hashCode）
Objects.hashCode(obj);             // null 安全的单对象 hashCode

// 3. 非空校验（防御式编程，构造器/setter 中用）
Objects.requireNonNull(obj);                          // null 抛 NullPointerException
Objects.requireNonNull(obj, "参数不能为空");            // 带消息
Objects.requireNonNull(obj, () -> "延迟构造消息");      // Supplier，性能优化

// 4. JDK 9+ 空值处理
Objects.requireNonNullElse(obj, defaultObj);          // null 时返回默认值
Objects.requireNonNullElseGet(obj, () -> new Obj());  // null 时惰性计算默认值
Objects.isNull(obj);                                  // 等价 obj == null（用于 Stream filter）
Objects.nonNull(obj);                                 // 等价 obj != null

// 5. 比较
Objects.compare(a, b, comparator);                    // null 安全比较
Objects.deepEquals(arr1, arr2);                       // 数组深度比较

// 6. JDK 9+ 索引检查
Objects.checkIndex(5, 10);                            // 5 < 10 返回 5，否则 IndexOutOfBoundsException
Objects.checkFromToIndex(2, 8, 10);
Objects.checkFromIndexSize(2, 5, 10);

// 实战：Stream 中过滤 null
list.stream().filter(Objects::nonNull).collect(Collectors.toList());
```

**Objects.equals 源码：**

```java
public static boolean equals(Object a, Object b) {
    return (a == b) || (a != null && a.equals(b));
}
```

> 【规范】比较两个可能为 null 的对象**一律用 `Objects.equals`**，避免 `"x".equals(maybeNull)` 之外的场景漏判空。

## 3. 日期时间 API

### 3.1 旧 API 的问题（Date/Calendar）

```java
// ❌ java.util.Date 的设计缺陷
Date date = new Date();                 // 可变对象（线程不安全）
date.setYear(2026);                     // 年份要减 1900！setYear(126) 才是 2026
date.getMonth();                        // 月份从 0 开始！0=一月
// SimpleDateFormat 线程不安全（作为静态共享变量会解析错乱！）

// SimpleDateFormat 的经典并发 bug
private static SimpleDateFormat SDF = new SimpleDateFormat("yyyy-MM-dd");
// 多线程调用 SDF.parse() → 数据错乱、NumberFormatException、数组越界
// 原因：SimpleDateFormat 内部用 Calendar 存中间状态，多线程共享导致竞争
```

**旧 API 的临时正确用法（JDK 8 前）：**

```java
// 方案 1：每次 new（性能差）
new SimpleDateFormat("yyyy-MM-dd").format(date);

// 方案 2：ThreadLocal（每线程一份）
private static final ThreadLocal<SimpleDateFormat> SDF =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));
SDF.get().format(date);

// 方案 3：Apache Commons 的 FastDateFormat（线程安全）
FastDateFormat.getInstance("yyyy-MM-dd").format(date);
```

### 3.2 新 API（JSR-310，JDK 8+）★ 推荐

`java.time` 包，**不可变、线程安全、语义清晰**，是现在的标准。

**核心类一览：**

| 类 | 含义 | 示例 | 含时区 |
| --- | --- | --- | --- |
| `LocalDate` | 日期（年月日） | `2026-09-06` | ❌ |
| `LocalTime` | 时间（时分秒纳秒） | `14:30:15.123` | ❌ |
| `LocalDateTime` | 日期 + 时间 | `2026-09-06T14:30:15` | ❌ |
| `Instant` | 时间戳（UTC 瞬间点） | `2026-09-06T06:30:15Z` | UTC |
| `ZonedDateTime` | 带时区的日期时间 | `2026-09-06T14:30:15+08:00[Asia/Shanghai]` | ✅ |
| `OffsetDateTime` | 带偏移量的日期时间 | `2026-09-06T14:30:15+08:00` | 偏移量 |
| `Duration` | 时间间隔（时分秒纳秒） | `PT2H30M` | — |
| `Period` | 日期间隔（年月日） | `P1Y2M3D` | — |
| `Year`/`YearMonth`/`MonthDay` | 年/年月/月日 | `2026` | ❌ |
| `ZoneId`/`ZoneOffset` | 时区/偏移量 | `Asia/Shanghai` | — |
| `DateTimeFormatter` | 格式化/解析（**线程安全**） | `yyyy-MM-dd HH:mm:ss` | — |

### 3.3 创建日期时间对象

```java
import java.time.*;
import java.time.format.DateTimeFormatter;

// now()：当前时间（系统默认时区）
LocalDate today = LocalDate.now();                       // 2026-09-06
LocalTime now = LocalTime.now();                         // 14:30:15.123
LocalDateTime dateTime = LocalDateTime.now();            // 2026-09-06T14:30:15.123
Instant instant = Instant.now();                         // UTC 时间戳
ZonedDateTime zdt = ZonedDateTime.now();                 // 带时区
ZonedDateTime zdt2 = ZonedDateTime.now(ZoneId.of("America/New_York"));

// of()：指定值（月份从 1 开始！比旧 API 友好）
LocalDate d1 = LocalDate.of(2026, 9, 6);                 // 2026-09-06
LocalDate d2 = LocalDate.of(2026, Month.SEPTEMBER, 6);   // 用枚举
LocalTime t1 = LocalTime.of(14, 30, 15);                 // 14:30:15
LocalTime t2 = LocalTime.of(14, 30);                     // 14:30:00
LocalDateTime dt = LocalDateTime.of(2026, 9, 6, 14, 30, 0);
LocalDateTime dt2 = LocalDateTime.of(d1, t1);            // 组合

// parse()：从字符串解析
LocalDate d3 = LocalDate.parse("2026-09-06");            // ISO 格式默认可解析
LocalDateTime dt3 = LocalDateTime.parse("2026-09-06T14:30:00");

// 从时间戳转换
long epochMilli = System.currentTimeMillis();
Instant ins = Instant.ofEpochMilli(epochMilli);
LocalDateTime dtFromEpoch = LocalDateTime.ofInstant(ins, ZoneId.systemDefault());

// 从旧 Date 转换
Date oldDate = new Date();
LocalDateTime ldt = oldDate.toInstant()
                          .atZone(ZoneId.systemDefault())
                          .toLocalDateTime();
// LocalDateTime → Date
Date date = Date.from(ldt.atZone(ZoneId.systemDefault()).toInstant());
```

### 3.4 获取与修改

```java
LocalDateTime dt = LocalDateTime.of(2026, 9, 6, 14, 30, 45);

// 获取各字段（不可变，都是 get）
dt.getYear();                       // 2026
dt.getMonthValue();                 // 9
dt.getMonth();                      // SEPTEMBER（枚举）
dt.getDayOfMonth();                 // 6
dt.getDayOfYear();                  // 249
dt.getDayOfWeek();                  // SUNDAY（枚举）
dt.getHour();                       // 14
dt.getMinute();                     // 30
dt.getSecond();                     // 45
dt.toLocalDate();                   // 提取日期部分
dt.toLocalTime();                   // 提取时间部分

// 修改：不可变对象，所有「修改」都返回新对象！
LocalDateTime dt2 = dt.withYear(2027);              // 改年份 → 新对象
LocalDateTime dt3 = dt.withMonth(12);               // 改月份
LocalDateTime dt4 = dt.withDayOfMonth(1);           // 改日
LocalDateTime dt5 = dt.withHour(0).withMinute(0).withSecond(0);  // 归零时间（当天零点）
// ⚠️ dt 本身没变！必须接收返回值
// dt.withYear(2027);   ← 无效，返回值被丢弃

// TemporalAdjusters：复杂调整
import java.time.temporal.TemporalAdjusters;
dt.with(TemporalAdjusters.firstDayOfMonth());       // 本月第一天
dt.with(TemporalAdjusters.lastDayOfMonth());        // 本月最后一天
dt.with(TemporalAdjusters.firstDayOfNextMonth());   // 下月第一天
dt.with(TemporalAdjusters.next(DayOfWeek.MONDAY));  // 下一个周一
dt.with(TemporalAdjusters.previous(DayOfWeek.FRIDAY));  // 上一个周五
dt.with(TemporalAdjusters.dayOfWeekInMonth(2, DayOfWeek.TUESDAY));  // 本月第 2 个周二
```

### 3.5 加减运算

```java
LocalDate date = LocalDate.of(2026, 9, 6);

// 加减（返回新对象，不可变）
date.plusDays(10);                    // +10 天
date.plusWeeks(2);                    // +2 周
date.plusMonths(3);                   // +3 月
date.plusYears(1);                    // +1 年
date.minusDays(5);                    // -5 天
date.minusMonths(1);                  // -1 月

// 通用加减
date.plus(1, ChronoUnit.MONTHS);      // 用 ChronoUnit 指定单位
date.plus(100, ChronoUnit.DAYS);
date.plusAmount(Period.ofMonths(2));  // 加一个 Period

LocalDateTime dt = LocalDateTime.now();
dt.plusHours(3).plusMinutes(30);      // 链式（每次都返回新对象）
dt.plus(Duration.ofHours(2));         // 加一个 Duration

// 边界处理：月末加月的智能调整
LocalDate jan31 = LocalDate.of(2026, 1, 31);
jan31.plusMonths(1);                  // 2026-02-28（2 月没有 31 号，自动调整到最后一天）
```

### 3.6 比较与间隔

```java
LocalDate d1 = LocalDate.of(2026, 1, 1);
LocalDate d2 = LocalDate.of(2026, 12, 31);

// 比较
d1.isBefore(d2);                    // true
d1.isAfter(d2);                     // false
d1.isEqual(d2);                     // false
d1.compareTo(d2);                   // 负数（d1 < d2）
d1.equals(d2);                      // false

// Period：日期间隔（年月日）
Period period = Period.between(d1, d2);
period.getYears();                  // 0
period.getMonths();                 // 11
period.getDays();                   // 30
period.toTotalMonths();             // 11

// Duration：时间间隔（时分秒纳秒），用于 LocalDateTime/Instant
LocalDateTime t1 = LocalDateTime.of(2026, 9, 6, 10, 0);
LocalDateTime t2 = LocalDateTime.of(2026, 9, 6, 14, 30);
Duration duration = Duration.between(t1, t2);
duration.toHours();                 // 4
duration.toMinutes();               // 270
duration.getSeconds();              // 16200
duration.toMillis();                // 16200000
duration.toDays();                  // 0

// ChronoUnit：直接算差值
ChronoUnit.DAYS.between(d1, d2);    // 364
ChronoUnit.MONTHS.between(d1, d2);  // 11
ChronoUnit.HOURS.between(t1, t2);   // 4

// 年龄计算（经典）
LocalDate birthday = LocalDate.of(1995, 5, 20);
Period age = Period.between(birthday, LocalDate.now());
System.out.printf("年龄：%d 岁 %d 月 %d 天%n", age.getYears(), age.getMonths(), age.getDays());
```

> 【坑】**Period vs Duration 的区别**：
> - `Period` 基于**日期**（年月日），用于 `LocalDate`。
> - `Duration` 基于**时间**（时分秒纳秒），用于 `LocalDateTime`/`Instant`/`LocalTime`。
> - 对 `LocalDate` 用 `Duration.between` 会得到 0（因为没有时间部分）！

### 3.7 格式化与解析（DateTimeFormatter）

```java
import java.time.format.DateTimeFormatter;

// DateTimeFormatter 是不可变、线程安全的！可作为静态常量共享
private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

// 格式化：对象 → 字符串
LocalDateTime dt = LocalDateTime.of(2026, 9, 6, 14, 30, 45);
String s1 = dt.format(DATETIME_FMT);              // "2026-09-06 14:30:45"
String s2 = DATETIME_FMT.format(dt);              // 同上（两种写法都行）
String s3 = dt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);  // "2026-09-06T14:30:45"
String s4 = dt.format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.LONG));  // 本地化

// 解析：字符串 → 对象
LocalDateTime parsed = LocalDateTime.parse("2026-09-06 14:30:45", DATETIME_FMT);
LocalDate date = LocalDate.parse("2026-09-06", DATE_FMT);

// 预定义格式常量
DateTimeFormatter.ISO_LOCAL_DATE;              // yyyy-MM-dd
DateTimeFormatter.ISO_LOCAL_TIME;              // HH:mm:ss
DateTimeFormatter.ISO_LOCAL_DATE_TIME;         // yyyy-MM-dd'T'HH:mm:ss
DateTimeFormatter.BASIC_ISO_DATE;              // yyyyMMdd
DateTimeFormatter.ofLocalizedDate(FormatStyle.SHORT);  // 本地化短日期

// 带时区格式化
ZonedDateTime zdt = ZonedDateTime.now(ZoneId.of("Asia/Shanghai"));
zdt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss z"));   // 2026-09-06 14:30:45 CST
```

**格式化模式字母（易错重点）：**

| 字母 | 含义 | 示例 | ⚠️ 陷阱 |
| --- | --- | --- | --- |
| `y` | 年 | `yyyy` → 2026 | — |
| `M` | **月**（大写） | `MM` → 09 | **大写 M 是月** |
| `d` | 日 | `dd` → 06 | — |
| `H` | **时（24 小时制）** | `HH` → 14 | 大写 H 是 24 小时制 |
| `h` | 时（12 小时制） | `hh` → 02 | 小写 h 是 12 小时制 |
| `m` | **分**（小写） | `mm` → 30 | **小写 m 是分** |
| `s` | 秒 | `ss` → 45 | — |
| `S` | 毫秒 | `SSS` → 123 | — |
| `D` | 一年中的第几天 | `DDD` → 249 | **大写 D 不是日！** |
| `E` | 星期几 | `EEE` → Sun | — |
| `a` | 上午/下午 | `a` → PM | — |
| `z`/`Z` | 时区 | `z` → CST | — |

> 【坑】**最经典的日期格式化错误**：
> - `YYYY`（大写，week-year 周年）vs `yyyy`（日历年）。跨年那几天用 `YYYY-MM-dd` 会显示错误的年份！例如 2026-12-31 用 `YYYY` 可能显示 2027。
> - `DD`（大写，一年中第几天）vs `dd`（小写，月中第几天）。
> - `mm`（分）vs `MM`（月）。
> - `HH`（24 小时）vs `hh`（12 小时）。

### 3.8 时区处理

```java
// 获取时区
ZoneId systemZone = ZoneId.systemDefault();          // 系统时区 Asia/Shanghai
ZoneId shanghai = ZoneId.of("Asia/Shanghai");
ZoneId utc = ZoneId.of("UTC");
ZoneOffset offset = ZoneOffset.of("+08:00");
ZoneId.getAvailableZoneIds();                         // 所有可用时区 ID

// 时区转换
ZonedDateTime beijingTime = ZonedDateTime.now(ZoneId.of("Asia/Shanghai"));
ZonedDateTime nyTime = beijingTime.withZoneSameInstant(ZoneId.of("America/New_York"));
// 同一瞬间，不同时区表示

// Instant（UTC 时间戳，与时区无关，适合存储和传输）
Instant instant = Instant.now();
long epochSecond = instant.getEpochSecond();          // 秒级时间戳
long epochMilli = instant.toEpochMilli();             // 毫秒级时间戳
Instant.ofEpochSecond(1725600000L);                   // 从秒创建

// LocalDateTime ↔ ZonedDateTime
LocalDateTime ldt = LocalDateTime.now();
ZonedDateTime zdt = ldt.atZone(ZoneId.of("Asia/Shanghai"));   // 附加时区
LocalDateTime ldt2 = zdt.toLocalDateTime();                    // 剥离时区

// Instant ↔ LocalDateTime
LocalDateTime fromInstant = LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
Instant toInstant = ldt.toInstant(ZoneOffset.of("+08:00"));
```

**【最佳实践】日期时间的存储与传输：**

| 场景 | 推荐类型 | 理由 |
| --- | --- | --- |
| 数据库存储 | `DATETIME` / `TIMESTAMP` + `LocalDateTime` | MySQL `TIMESTAMP` 自动转 UTC，`DATETIME` 存字面值 |
| 跨服务传输 | `Instant` 或 UTC 时间戳（long） | 无时区歧义 |
| 展示给用户 | `ZonedDateTime` → 转用户时区格式化 | 用户体验 |
| API 返回 | ISO-8601 字符串（`2026-09-06T14:30:45Z`） | 国际标准，前端可解析 |
| 生日/纪念日 | `LocalDate` | 与时区无关 |
| 定时任务时间 | `LocalTime` | 每天固定时刻 |

**Jackson 序列化配置（Spring Boot）：**

```java
// Spring Boot 默认已注册 JavaTimeModule，LocalDateTime 可正常序列化
// 自定义格式：在字段上加注解
public class OrderVO {
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private LocalDateTime createTime;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate orderDate;
}

// 全局配置 application.yml
// spring:
//   jackson:
//     date-format: yyyy-MM-dd HH:mm:ss
//     time-zone: GMT+8
//     serialization:
//       write-dates-as-timestamps: false   # 输出字符串而非时间戳
```

### 3.9 时间工具类封装（实战）

```java
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Date;

/**
 * 日期时间工具类（基于 JDK 8 time API，线程安全）
 */
public final class DateUtils {

    private DateUtils() { throw new UnsupportedOperationException("工具类"); }

    public static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    public static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    public static final DateTimeFormatter COMPACT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    /** 当前日期字符串 yyyy-MM-dd */
    public static String today() { return LocalDate.now().format(DATE); }

    /** 当前日期时间字符串 */
    public static String now() { return LocalDateTime.now().format(DATETIME); }

    /** Date → LocalDateTime */
    public static LocalDateTime toLocalDateTime(Date date) {
        return date == null ? null : date.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
    }

    /** LocalDateTime → Date */
    public static Date toDate(LocalDateTime ldt) {
        return ldt == null ? null : Date.from(ldt.atZone(ZoneId.systemDefault()).toInstant());
    }

    /** 字符串 → LocalDateTime */
    public static LocalDateTime parse(String str) { return LocalDateTime.parse(str, DATETIME); }

    /** LocalDateTime → 字符串 */
    public static String format(LocalDateTime ldt) { return ldt.format(DATETIME); }

    /** 当天开始时刻 00:00:00 */
    public static LocalDateTime startOfDay(LocalDate date) { return date.atStartOfDay(); }

    /** 当天结束时刻 23:59:59.999999999 */
    public static LocalDateTime endOfDay(LocalDate date) {
        return date.atTime(LocalTime.MAX);       // 23:59:59.999999999
    }

    /** 计算两个时间相差的天数 */
    public static long daysBetween(LocalDateTime start, LocalDateTime end) {
        return ChronoUnit.DAYS.between(start, end);
    }

    /** N 天后的日期 */
    public static LocalDate plusDays(LocalDate date, long days) { return date.plusDays(days); }

    /** 判断是否为同一天 */
    public static boolean isSameDay(LocalDateTime a, LocalDateTime b) {
        return a.toLocalDate().equals(b.toLocalDate());
    }

    /** 毫秒时间戳 → 格式化字符串 */
    public static String fromEpochMilli(long millis) {
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(millis), ZoneId.systemDefault()).format(DATETIME);
    }

    /** 秒级时间戳 */
    public static long epochSecond(LocalDateTime ldt) {
        return ldt.atZone(ZoneId.systemDefault()).toEpochSecond();
    }
}
```

## 4. Math 与 Random 补充

见 [[后端/Java基础/运算符与流程控制]] 第 2 节。补充几个易忽略的：

```java
// BigDecimal 精确运算（金额）—— 复习重点
BigDecimal price = new BigDecimal("19.99");
BigDecimal count = new BigDecimal("3");
BigDecimal total = price.multiply(count);                     // 59.97
BigDecimal discount = total.multiply(new BigDecimal("0.8"))   // 打 8 折
                             .setScale(2, RoundingMode.HALF_UP);  // 保留 2 位四舍五入
BigDecimal each = total.divide(count, 2, RoundingMode.HALF_UP);   // 除法必须指定精度

// StrictMath：保证跨平台结果完全一致（比 Math 慢，Math 允许平台相关的优化）
StrictMath.sin(1.0);

// 大数运算
BigInteger big = new BigInteger("123456789012345678901234567890");
big.add(big).multiply(BigInteger.TEN);
big.pow(100);                          // 大数幂运算
big.mod(BigInteger.valueOf(7));        // 取模
BigInteger.valueOf(100);               // 从 long 创建
```

## 5. 字符串处理进阶

### 5.1 String 常用方法全表

```java
String s = "Hello, World";

// 长度与取值
s.length();                    // 12
s.charAt(0);                   // 'H'
s.codePointAt(0);              // 72（Unicode 码点）
s.isEmpty();                   // false
s.isBlank();                   // false（JDK 11+，全空白为 true）

// 查找
s.indexOf('o');                // 4（第一次出现）
s.indexOf('o', 5);             // 8（从索引 5 开始找）
s.indexOf("World");            // 7
s.lastIndexOf('o');            // 8
s.contains("World");           // true
s.startsWith("Hello");         // true
s.endsWith("World");           // true

// 截取（左闭右开 [begin, end)）
s.substring(7);                // "World"
s.substring(0, 5);             // "Hello"

// 替换
s.replace('o', '0');           // "Hell0, W0rld"（替换所有）
s.replace("World", "Java");    // "Hello, Java"
s.replaceFirst("o", "0");      // "Hell0, World"（正则，替换第一个）
s.replaceAll("o", "0");        // "Hell0, W0rld"（正则，替换所有）

// 大小写
s.toUpperCase();               // "HELLO, WORLD"
s.toLowerCase();               // "hello, world"

// 去空白
"  abc  ".trim();              // "abc"（去除 <= \u0020 的字符）
"  abc  ".strip();             // "abc"（JDK 11+，去除 Unicode 空白，更彻底）
"  abc  ".stripLeading();      // "abc  "
"  abc  ".stripTrailing();     // "  abc"

// 分割（参数是正则！）
"a,b,c".split(",");            // ["a","b","c"]
"a|b|c".split("|");            // ⚠️ | 是正则或，结果错误！要用 split("\\|")
"a  b".split("\\s+");          // 按空白分割
"a,b,,c".split(",");           // ["a","b","","c"]
"a,b,c,,".split(",");          // ["a","b","c"]（尾部空串被丢弃！）
"a,b,c,,".split(",", -1);      // ["a","b","c","",""]（limit=-1 保留尾部空串）

// 拼接
String.join("-", "a", "b", "c");      // "a-b-c"（JDK 8+）
String.join(", ", listOfStrings);     // 拼接集合
String.join("\n", "line1", "line2");

// 转换
s.toCharArray();               // char[]
s.getBytes(StandardCharsets.UTF_8);   // byte[]
String.valueOf(123);           // "123"
String.valueOf(new char[]{'a','b'});  // "ab"

// 比较
s.compareTo("Hello");          // > 0（字典序）
s.compareToIgnoreCase("HELLO, WORLD");  // 0
s.regionMatches(0, "Hello", 0, 5);      // true（比较子串）

// 重复（JDK 11+）
"ab".repeat(3);                // "ababab"

// 字符流（JDK 8+）
s.chars();                     // IntStream（字符码点流）
s.codePoints();                // IntStream（完整码点流，处理 emoji 正确）
s.chars().filter(c -> c == 'o').count();   // 统计 'o' 出现次数

// 格式化
String.format("%s 今年 %d 岁", "Tom", 20);
"{} 今年 {} 岁".formatted("Tom", 20);    // JDK 15+（注意是 %s 风格，不是 {}）
// 实际 formatted 用法："%s 今年 %d 岁".formatted("Tom", 20)
```

### 5.2 字符串处理的坑

```java
// 坑 1：split 参数是正则
"a.b.c".split(".");            // [] 空数组！. 匹配任意字符
"a.b.c".split("\\.");          // ✅ ["a","b","c"]
"a|b".split("|");              // ❌ 错误
"a|b".split("\\|");            // ✅

// 坑 2：split 丢弃尾部空串
"a,b,,,".split(",");           // ["a","b"]，尾部空串没了
"a,b,,,".split(",", -1);       // ["a","b","","",""]，用 -1 保留

// 坑 3：substring 的索引越界
"abc".substring(5);            // StringIndexOutOfBoundsException
"abc".substring(2, 1);         // begin > end，抛异常

// 坑 4：replace vs replaceAll
"aXbXc".replace("X", "-");     // "a-b-c"（字面量替换）
"aXbXc".replaceAll("X", "-");  // "a-b-c"（正则替换，X 恰好不是特殊字符）
"$100".replaceAll("$", "￥");   // ❌ $ 是正则特殊字符（组引用），抛异常
"$100".replace("$", "￥");      // ✅ 字面量替换
"$100".replaceAll("\\$", "￥"); // ✅ 正则转义

// 坑 5：trim vs strip（全角空格）
"\u3000abc\u3000".trim();      // 不去除全角空格（\u3000 > \u0020）
"\u3000abc\u3000".strip();     // ✅ 去除（JDK 11+，识别 Unicode 空白）

// 坑 6：字符串拼接性能
// 见 [[后端/Java基础/基础语法与数据类型]] 7.3 节，循环内用 StringBuilder

// 坑 7：== 比较
new String("a") == new String("a");   // false，用 equals
```

### 5.3 StringBuilder 补充 API

```java
StringBuilder sb = new StringBuilder("abc");
sb.append(1).append(2.5).append(true).append('x').append(new Object());  // 追加任意类型
sb.insert(0, "START");           // 插入
sb.delete(0, 5);                 // 删除 [0,5)
sb.deleteCharAt(0);              // 删除单字符
sb.replace(0, 3, "xyz");         // 替换
sb.reverse();                    // 反转 → "cba"
sb.setCharAt(0, 'Z');            // 设置指定位置字符
sb.length();                     // 长度
sb.capacity();                   // 容量
sb.ensureCapacity(1000);         // 确保容量（预分配，避免扩容）
sb.trimToSize();                 // 收缩到实际长度
sb.toString();                   // 转 String

// 链式构建 SQL（实战）
StringBuilder sql = new StringBuilder("SELECT * FROM user WHERE 1=1");
if (name != null) sql.append(" AND name = '").append(name).append("'");
if (age != null) sql.append(" AND age = ").append(age);
sql.append(" ORDER BY id DESC");
// ⚠️ 拼接 SQL 有注入风险！实际用 MyBatis 动态 SQL 或 PreparedStatement
```

## 6. System 与 Runtime

见 [[后端/Java基础/基础语法与数据类型]] 10.3 节。补充：

```java
// 退出码
System.exit(0);                  // 0 = 正常，非 0 = 异常（触发 shutdown hook）
Runtime.getRuntime().exit(1);    // 等价

// 关闭钩子（优雅停机的关键）
Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    System.out.println("应用关闭中，释放资源...");
    // 关闭线程池、数据库连接、释放锁、刷盘
}));
// 触发时机：System.exit()、所有非守护线程结束、Ctrl+C、kill（非 kill -9）
// kill -9（SIGKILL）不会触发关闭钩子！

// GC
System.gc();                     // 建议 GC（不保证立即执行，且可能触发 Full GC 导致停顿，生产慎用）
System.runFinalization();        // 建议执行 finalize（已废弃）

// 身份哈希码
System.identityHashCode(obj);    // 默认 hashCode（基于地址），即使对象重写了 hashCode 也返回原始值

// 环境
System.lineSeparator();          // 换行符（跨平台）
System.getProperty("user.home");
System.getProperty("java.io.tmpdir");   // 临时目录
System.getProperties();          // 所有系统属性
System.getenv("JAVA_HOME");
```

## 7. 正则表达式（java.util.regex）

```java
import java.util.regex.*;

// 1. String 内置的正则方法（简单场景）
"abc123".matches("\\d+");                 // false（整体匹配，含字母）
"123".matches("\\d+");                    // true
"a,b,c".split(",");                       // 分割
"abc".replaceAll("[aeiou]", "*");         // 替换
"abc".replaceFirst("a", "X");             // 替换第一个

// 2. Pattern + Matcher（复杂场景，Pattern 可复用，线程安全）
Pattern pattern = Pattern.compile("\\d{3}-\\d{4}");    // 编译正则（ expensive，应复用）
Matcher matcher = pattern.matcher("电话:010-1234 和 020-5678");

// 查找（部分匹配）
while (matcher.find()) {
    System.out.println(matcher.group());       // 010-1234, 020-5678
    System.out.println(matcher.start());       // 起始索引
    System.out.println(matcher.end());         // 结束索引
}

// 整体匹配
matcher.matches();                              // 整个字符串是否匹配

// 分组捕获
Pattern p = Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})");   // 括号分组
Matcher m = p.matcher("日期:2026-09-06");
if (m.find()) {
    m.group(0);      // 2026-09-06（整体匹配）
    m.group(1);      // 2026（第 1 组）
    m.group(2);      // 09
    m.group(3);      // 06
    m.groupCount();  // 3（分组数）
}

// 命名分组（JDK 7+，可读性好）
Pattern np = Pattern.compile("(?<year>\\d{4})-(?<month>\\d{2})");
Matcher nm = np.matcher("2026-09");
if (nm.find()) {
    nm.group("year");    // 2026
    nm.group("month");   // 09
}

// 替换（可引用分组）
"2026-09-06".replaceAll("(\\d{4})-(\\d{2})-(\\d{2})", "$1/$2/$3");  // 2026/09/06
"abc".replaceAll("[abc]", "[$0]");   // $0 引用整个匹配

// 查找全部并收集
List<String> all = pattern.matcher(text).results()   // JDK 9+ Stream
                          .map(MatchResult::group)
                          .collect(Collectors.toList());
```

**常用正则元字符：**

| 元字符 | 含义 | 示例 |
| --- | --- | --- |
| `\d` | 数字 [0-9] | `\d&#123;3&#125;` 三个数字 |
| `\D` | 非数字 | |
| `\w` | 单词字符 [a-zA-Z0-9_] | |
| `\W` | 非单词字符 | |
| `\s` | 空白字符 | |
| `.` | 任意字符（除换行） | |
| `*` | 0 次或多次 | |
| `+` | 1 次或多次 | |
| `?` | 0 次或 1 次 | |
| `&#123;n&#125;` | 恰好 n 次 | `\d&#123;4&#125;` |
| `&#123;n,m&#125;` | n 到 m 次 | |
| `^` | 开头 | `^abc` |
| `$` | 结尾 | `abc$` |
| `[]` | 字符集 | `[a-z]` |
| `()` | 分组 | `(\d+)` |
| `\|` | 或 | `a\|b` |
| `\` | 转义 | `\\.` 匹配点 |

> 【坑】**Java 字符串中 `\` 要写成 `\\`**。正则的 `\d` 在 Java 字符串里是 `"\\d"`；正则的 `\\`（匹配反斜杠）在 Java 里是 `"\\\\"`。

**常用正则速查：**

```java
手机号：      "^1[3-9]\\d{9}$"
邮箱：        "^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$"
身份证：      "^\\d{17}[\\dXx]$"
URL：         "^https?://[\\w.-]+(:\\d+)?(/[\\w./?%&=-]*)?$"
IP：          "^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$"
中文：        "[\\u4e00-\\u9fa5]+"
数字（含小数）："^-?\\d+(\\.\\d+)?$"
```

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `Date.getMonth()` 从 0 开始 | 月份少 1 | 用 JDK 8 `LocalDate` |
| 2 | `SimpleDateFormat` 静态共享 | 多线程解析错乱 | 用 `DateTimeFormatter`（线程安全） |
| 3 | `YYYY-MM-dd` 跨年错误 | 周年 vs 日历年 | 用小写 `yyyy` |
| 4 | `DD` 当日期 | 显示一年中第几天 | 用小写 `dd` |
| 5 | `mm` 当月份 | 显示分钟 | 月份用大写 `MM` |
| 6 | 日期时间对象「修改」无效 | 不可变对象 | 接收返回值 `dt = dt.plusDays(1)` |
| 7 | `Period` 用于 LocalDateTime | 得到 0 | 时间间隔用 `Duration` |
| 8 | `split(".")` / `split("|")` | 结果错误 | 正则转义 `split("\\.")` |
| 9 | `split` 丢尾部空串 | 数组长度不符预期 | `split(regex, -1)` |
| 10 | `replaceAll("$", x)` | 抛异常 | `$` 是正则特殊字符，用 `replace` |
| 11 | `trim()` 不去全角空格 | 空白仍在 | 用 `strip()`（JDK 11+） |
| 12 | `clone()` 浅拷贝引用共享 | 修改副本影响原对象 | 深拷贝或拷贝构造器 |
| 13 | `new Date().getYear()` 要减 1900 | 年份错误 | 用 `LocalDate` |
| 14 | LocalDateTime 存数据库丢时区 | 跨时区显示错误 | 存 UTC 或带时区，展示时转换 |
| 15 | `Instant` 直接格式化 | 无时区信息 | 先 `atZone()` 转 ZonedDateTime |

---

## 关联笔记

- 上一篇：[[后端/Java基础/面向对象进阶]]
- 下一篇：[[后端/Java基础/集合框架-List与Set]]
- 相关：[[后端/Java基础/基础语法与数据类型]]（String 底层、包装类）、[[后端/Java基础/Java8新特性-Lambda与Stream]]（Stream 处理日期）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
