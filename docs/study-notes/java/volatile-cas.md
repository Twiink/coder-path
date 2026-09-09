---
title: "volatile与CAS原子类"
aliases:
  - "volatile 原理"
  - "CAS 与 ABA 问题"
  - "Atomic 原子类"
tags:
  - "后端"
  - "java"
  - "并发"
  - "面试"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/并发编程/线程安全与synchronized]]"
  - "[[后端/Java基础/并发编程/Lock与AQS原理]]"
  - "[[后端/Java基础/并发编程/线程池原理与实战]]"
  - "[[后端/JVM/JVM概述与运行时数据区]]"
created: 2026-09-07
updated: 2026-09-07
---

# volatile 与 CAS 原子类

## 1. JMM 内存模型（理解 volatile 的前提）

### 1.1 JMM 的抽象结构

**JMM（Java Memory Model）是一个规范**，定义了多线程环境下变量的访问规则，屏蔽了各种硬件和操作系统的内存访问差异。

```
              主内存（Main Memory，所有线程共享）
         ┌──────────────────────────────────────┐
         │  共享变量：volatile 变量、实例字段、静态字段  │
         │  （对应堆和方法区中的变量）                  │
         └────────┬──────────────────┬────────────┘
              read/write         read/write
         ┌────────▼───────┐  ┌──────▼──────────┐
         │  线程 A 工作内存  │  │  线程 B 工作内存    │
         │ ┌────────────┐ │  │ ┌────────────┐  │
         │ │ 共享变量副本 │ │  │ │ 共享变量副本 │  │
         │ └────────────┘ │  │ └────────────┘  │
         │  本地变量（栈）   │  │  本地变量（栈）    │
         └────────────────┘  └─────────────────┘
              线程 A                线程 B
```

**JMM 规定的 8 种内存交互操作（原子性、不可再分）：**

| 操作 | 作用域 | 说明 |
| --- | --- | --- |
| `lock` | 主内存 | 把变量标识为线程独占 |
| `unlock` | 主内存 | 释放锁定的变量（释放前必须 sync 回主内存） |
| `read` | 主内存 | 把变量值从主内存传到工作内存 |
| `load` | 工作内存 | 把 read 得到的值放入工作内存的副本 |
| `use` | 工作内存 | 把副本值传给执行引擎 |
| `assign` | 工作内存 | 把执行引擎的结果赋给副本 |
| `store` | 工作内存 | 把副本值传回主内存 |
| `write` | 主内存 | 把 store 得到的值写入主内存变量 |

**规则：** read/load 必须顺序执行、store/write 必须顺序执行；不允许丢弃 assign（必须同步回主内存）；不允许无原因地把数据从工作内存同步回主内存。

### 1.2 可见性问题的硬件根源

```
CPU 核心 0                     CPU 核心 1
┌──────────┐                  ┌──────────┐
│ L1 Cache │                  │ L1 Cache │   ← 每核独享，纳秒级
│ L2 Cache │                  │ L2 Cache │
└────┬─────┘                  └────┬─────┘
     └──────────┬──────────────────┘
           ┌────▼─────┐
           │ L3 Cache │                      ← 多核共享
           └────┬─────┘
                │
           ┌────▼─────┐
           │  主内存    │                      ← 数十纳秒
           └──────────┘

问题：核心 0 修改了变量 x，写在自己的 L1/L2 中（未刷回主内存），
     核心 1 读取 x 时从自己的缓存读，看不到修改 → 可见性问题
     
解决：缓存一致性协议（MESI）+ 总线嗅探（Bus Snooping）
     volatile 写入会触发缓存行失效（Invalidate）并刷回主内存
```

**内存访问速度差异（为什么要缓存）：**

| 存储层 | 访问延迟 | 相对 CPU 周期 |
| --- | --- | --- |
| L1 Cache | ~1 ns | ~4 周期 |
| L2 Cache | ~3-4 ns | ~12 周期 |
| L3 Cache | ~10-20 ns | ~40 周期 |
| 主内存 | ~60-100 ns | ~200-300 周期 |
| SSD | ~100 μs | ~30 万周期 |
| 机械硬盘 | ~10 ms | ~3000 万周期 |

**缓存行（Cache Line）与伪共享：**

```java
// CPU 缓存以「缓存行」为单位（通常 64 字节），一次加载 64 字节到缓存
// 伪共享（False Sharing）：两个线程修改同一缓存行内的不同变量，导致缓存行反复失效

// ❌ 伪共享示例（性能极差）
class Counter {
    volatile long a;      // 这两个字段在同一个缓存行
    volatile long b;
}
// 线程 1 频繁写 a，线程 2 频繁写 b
// 每次写都会让对方的缓存行失效 → 缓存疯狂来回同步 → 性能下降 10~100 倍

// ✅ 缓存行填充（Padding，JDK 8 的 @Contended 之前用手动填充）
class PaddedCounter {
    volatile long a;
    long p1, p2, p3, p4, p5, p6;      // 填充 48 字节，把 b 推到下一个缓存行
    volatile long b;
    long p7, p8, p9, p10, p11, p12;
}

// ✅ JDK 8+ 官方方案：@Contended 注解（需 -XX:-RestrictContended）
@sun.misc.Contended
class Counter2 {
    volatile long a;
    volatile long b;
}

// JDK 中的实际应用：ConcurrentHashMap 的 CounterCell、LongAdder 的 Cell 都用了 @Contended
@sun.misc.Contended static final class Cell {
    volatile long value;
}
```

> 【面试】**伪共享**是高并发编程的隐形杀手。`LongAdder` 比 `AtomicLong` 快的重要原因之一就是它的 `Cell` 数组用了 `@Contended` 消除伪共享（每个 Cell 独占一个缓存行，不同线程更新不同 Cell 不会互相干扰）。

## 2. volatile 关键字 ★★★★★

### 2.1 volatile 的两大语义

| 语义 | 是否保证 | 实现机制 |
| --- | --- | --- |
| **可见性** | ✅ 保证 | 写入时刷回主内存 + 使其他 CPU 缓存行失效（MESI 协议）；读取时从主内存重新加载 |
| **有序性** | ✅ 保证（禁止指令重排） | **插入内存屏障（Memory Barrier）** |
| **原子性** | ❌ **不保证** | 只有单次读/单次写是原子的，复合操作（`i++`）不是 |

```java
// ─── 可见性演示 ───
public class VisibilityDemo {
    private static boolean stop = false;              // ❌ 无 volatile

    public static void main(String[] args) throws Exception {
        new Thread(() -> {
            int i = 0;
            while (!stop) {                            // ★ 可能永远不退出
                i++;
            }
            System.out.println("线程退出，i = " + i);
        }).start();

        Thread.sleep(1000);
        stop = true;                                   // main 线程的修改，工作线程可能看不到
        System.out.println("main 已设置 stop = true");
    }
}
// 加 volatile 后：while (!stop) 每次都从主内存读，立即感知修改 → 正常退出

// ⚠️ 这个 demo 的行为取决于 JVM 优化：
//   - 解释执行模式下可能正常退出（每次都读字段）
//   - JIT 编译后（热点代码）会优化为「提升」到循环外 → 死循环
//   - 在循环体内加 System.out.println 会「意外」修复问题（println 内有 synchronized，形成内存屏障）
//   这就是著名的 Heisenbug（观测行为影响 bug 表现）

// ─── 原子性不保证的演示 ───
public class VolatileAtomicityDemo {
    private static volatile int count = 0;             // ★ volatile 也救不了 i++

    public static void main(String[] args) throws Exception {
        Runnable task = () -> { for (int i = 0; i < 10000; i++) count++; };
        Thread t1 = new Thread(task), t2 = new Thread(task);
        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println(count);                     // 大概率 < 20000
    }
}
// count++ 的字节码：
//   getstatic count    ← ① 读（volatile 读，从主内存，这一步是安全的）
//   iconst_1
//   iadd               ← ② 加（在工作内存/CPU 寄存器中）
//   putstatic count    ← ③ 写（volatile 写，刷回主内存）
// 线程 A 执行完 ①（读到 100），被切换到线程 B，B 完整执行 ①②③（写回 101）；
// A 恢复后执行 ②③，把 101 写回 → B 的更新丢失！
// volatile 只保证每次读到最新值，不保证「读-改-写」的原子性
```

### 2.2 内存屏障与指令重排 ★★★★★

**编译器和 CPU 会对指令重排序（优化性能），只要不改变单线程语义（as-if-serial）。但多线程下重排会导致可见性和有序性问题。**

**JMM 定义的四种内存屏障（x86 上的实现）：**

| 屏障类型 | 指令组合 | 作用 | x86 实现 |
| --- | --- | --- | --- |
| **LoadLoad** | Load1; LoadLoad; Load2 | Load1 的数据装载完成前，Load2 及后续读不能执行 | 无需（x86 天然保证） |
| **StoreStore** | Store1; StoreStore; Store2 | Store1 的数据对其他处理器可见前，Store2 不能执行 | 无需（x86 天然保证） |
| **LoadStore** | Load1; LoadStore; Store2 | Load1 的数据装载完成前，Store2 不能执行 | 无需 |
| **StoreLoad** | Store1; StoreLoad; Load2 | **Store1 的数据对其他处理器可见前，Load2 不能执行** | **`lock` 前缀指令**（开销最大） |

> x86 是强内存模型，只对 **StoreLoad** 这一种重排不设限制，所以只需在 volatile 写后插入 StoreLoad 屏障（`lock addl $0, (%esp)`）。ARM/POWER 是弱内存模型，需要插入全部四种屏障。

**volatile 的内存屏障插入策略（JMM 保守策略）：**

```
普通读
  ↓
LoadLoad 屏障
LoadStore 屏障
volatile 读                    ← ① volatile 读之后插入两个屏障
  ↓
普通写
  ↓
StoreStore 屏障
volatile 写                    ← ② volatile 写之前插入两个屏障
  ↓
StoreLoad 屏障                 ← ③ volatile 写之后插入（★ 关键，防止 volatile 写与后续读重排）
  ↓
LoadLoad 屏障
LoadStore 屏障
volatile 读                    ← ④ 下一个 volatile 读之前
```

**volatile 的实现（HotSpot）：**

```cpp
// hotspot/src/share/vm/interpreter/interp_masm_x86.cpp
void InterpreterMacroAssembler::lock_object(Register lock_reg) { ... }

// volatile 写的底层：OrderedStore → fence
inline void OrderedStore volatile_ptr = ...;
// 编译为汇编时插入：
//   lock addl $0x0, (%esp)      ← ★ lock 前缀指令
```

**`lock` 前缀指令的两个作用（这是 volatile 的硬件基础）：**
1. **把当前处理器缓存行的数据立即写回主内存**。
2. **这个写回动作通过缓存一致性协议（MESI）使其他 CPU 中缓存的同一地址数据无效**（其他核心下次读时必须重新从主内存加载）。

```
MESI 协议的四个状态：
  M (Modified)   已修改，脏数据，只在本 CPU 缓存中，未写回主内存
  E (Exclusive)  独占，与主内存一致，只在本 CPU 缓存中
  S (Shared)     共享，与主内存一致，多个 CPU 缓存中都有
  I (Invalid)    无效，已被其他 CPU 修改，需要重新加载

线程 A 写 volatile 变量：
  ① A 的缓存行状态 M → 强制刷回主内存
  ② 通过总线嗅探/广播，通知其他 CPU：这个地址失效
  ③ B 的缓存行状态 → I
  ④ B 下次读该变量时发现是 I 状态 → 重新从主内存加载 → 看到最新值
```

### 2.3 volatile 的经典应用

#### 应用 1：DCL 双重检查锁单例 ★★★★★

```java
public class Singleton {
    // ★ 必须加 volatile！
    private static volatile Singleton instance;

    private Singleton() { }

    public static Singleton getInstance() {
        if (instance == null) {                         // 第一次检查（无锁，快速路径）
            synchronized (Singleton.class) {
                if (instance == null) {                 // 第二次检查（防重复创建）
                    instance = new Singleton();          // ★ 非原子操作，可能重排
                }
            }
        }
        return instance;
    }
}
```

**为什么必须 volatile？`instance = new Singleton()` 的三个步骤：**

```
① memory = allocate()          分配对象内存空间
② ctorInstance(memory)         调用构造器初始化对象
③ instance = memory            把 instance 指向分配的内存地址

JIT/CPU 可能重排为 ①③②（这不违反单线程语义，因为最终结果一样）：

线程 A 执行了 ①③（instance 已非 null，但对象还没初始化完！）
线程 B 在第一次检查时看到 instance != null
线程 B 直接返回一个「半成品对象」→ 使用时 NPE 或读到默认值（脏数据）

加上 volatile 后：
  ③ 之前插入 StoreStore 屏障 → 保证 ② 一定在 ③ 之前完成
  ③ 之后插入 StoreLoad 屏障 → 保证写回主内存后其他线程才能读
```

**更好的替代方案（不需要 volatile）：**

```java
// 方案 1：静态内部类（Holder）★ 推荐
public class Singleton {
    private Singleton() { }
    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }
    public static Singleton getInstance() { return Holder.INSTANCE; }
}
// 原理：Holder 类的初始化由 JVM 保证线程安全（类加载的 <clinit> 有锁），
//      且首次调用 getInstance() 才触发 Holder 加载 → 懒加载 + 线程安全 + 无锁

// 方案 2：枚举（《Effective Java》推荐，防反射和序列化破坏）
public enum Singleton {
    INSTANCE;
    public void doWork() { }
}
// 缺点：不能懒加载（类加载时就创建），不能继承其他类

// 方案 3：饿汉式（不需要懒加载时最简单）
public class Singleton {
    private static final Singleton INSTANCE = new Singleton();   // final 保证安全发布
    private Singleton() { }
    public static Singleton getInstance() { return INSTANCE; }
}
```

#### 应用 2：状态标志位（优雅停机）

```java
public class Worker implements Runnable {
    // ★ volatile 保证所有线程立即看到停止信号
    private volatile boolean running = true;

    @Override
    public void run() {
        while (running) {                          // 每次循环都从主内存读
            Task task = queue.poll(1, TimeUnit.SECONDS);
            if (task != null) process(task);
        }
        cleanup();                                 // 优雅退出前清理资源
        log.info("工作线程正常退出");
    }

    public void shutdown() {
        running = false;                           // 另一个线程调用
    }
}

// Spring Boot 的优雅停机就是这个思路（配合 shutdown hook）
@PreDestroy
public void destroy() {
    worker.shutdown();
    pool.shutdown();
    if (!pool.awaitTermination(30, TimeUnit.SECONDS)) pool.shutdownNow();
}
```

#### 应用 3：一次性安全发布（One-Time Safe Publication）

```java
// ❌ 不安全发布：其他线程可能看到未完全构造的对象
public class Config {
    private static Config instance;                // 无 volatile
    private final Map<String, String> properties;

    private Config() {
        properties = new HashMap<>();
        properties.put("key", "value");            // ① 填充数据
        instance = this;                            // ② 发布引用（可能重排到 ① 之前！）
    }
    public static Config get() { return instance; }
}

// ✅ 安全发布的四种方式
// 1. volatile 字段
private volatile Config instance;
// 2. final 字段（构造完成后正确初始化的 final 字段对所有线程可见）
private final Config instance = new Config();
// 3. 静态初始化器（JVM 类加载时加锁）
private static Config instance = new Config();
// 4. 用锁保护（synchronized / Lock / 并发容器）
private final AtomicReference<Config> ref = new AtomicReference<>();
```

#### 应用 4：happens-before 的建立

```java
public class VolatileHappensBefore {
    int a = 0;
    volatile boolean flag = false;

    // 线程 A
    public void writer() {
        a = 1;                    // ① 普通写
        flag = true;              // ② volatile 写
    }

    // 线程 B
    public void reader() {
        if (flag) {                // ③ volatile 读
            System.out.println(a); // ④ 保证看到 1 ！
        }
    }
}
// 推导：① hb ②（程序顺序规则）
//      ② hb ③（volatile 规则：写 hb 于后续读）
//      ③ hb ④（程序顺序规则）
//      → ① hb ④（传递性）→ 线程 B 一定能看到 a = 1
// 这就是「volatile 的写-读」建立的 happens-before 链条，让普通变量也获得可见性
```

#### 应用 5：CAS 操作的底层依赖

```java
// Atomic 类的所有 CAS 操作都依赖 volatile
public class AtomicInteger extends Number {
    // ★ value 必须是 volatile，保证 CAS 读到最新值
    private volatile int value;

    public final int incrementAndGet() {
        return U.getAndAddInt(this, VALUE, 1) + 1;
    }
}
// Unsafe.getAndAddInt 的循环 CAS 依赖 volatile 读的可见性
```

### 2.4 volatile 的性能与适用场景

```java
// ─── 性能对比（单线程 1000 万次操作，参考值）───
// 普通变量读写：        ~10 ms   （会被 JIT 优化到寄存器）
// volatile 读：         ~40 ms   （约普通读的 4 倍，因为要绕过 CPU 缓存优化）
// volatile 写：         ~300 ms  （约普通写的 30 倍，因为要刷缓存 + lock 指令）
// synchronized 加解锁： ~800 ms  （无竞争的偏向/轻量级锁）
// 重量级锁（有竞争）：    ~10000 ms（内核态切换）

// 结论：volatile 的读性能接近普通读，写性能开销较大但仍远低于锁
//      volatile 是「轻量级的同步机制」，但不能替代锁
```

**volatile 的适用与不适用：**

| ✅ 适用 | ❌ 不适用 |
| --- | --- |
| 写入不依赖当前值（只是设置标志位） | `i++`、`i *= 2` 等**读-改-写**复合操作 |
| 变量不与其他变量共同参与不变式 | 多个 volatile 变量之间需要一致性（如 `if (a > b) swap()`） |
| 状态标志、开关、配置热更新 | 需要互斥的临界区 |
| 一次性安全发布 | 复合条件的检查与执行 |
| 配合 CAS 实现无锁算法 | 计数、累加、余额变更 |

```java
// ❌ volatile 不能保证的场景
volatile int start, end;
// 线程 A：start = 1; end = 10;
// 线程 B：if (start < end) { ... }     ← 可能看到 start=1, end=0（不一致快照）
// ✅ 需要用锁保护，或封装成一个不可变对象用 volatile 引用
volatile Range range;                  // Range 是 final 字段的不可变类
range = new Range(1, 10);              // 原子发布一致的状态

// ✅ volatile + CAS 组合（无锁且原子）
private volatile int count = 0;
public void increment() {
    int current;
    do {
        current = count;                            // volatile 读
    } while (!compareAndSet(current, current + 1));  // CAS 重试
}
// 这就是 AtomicInteger 的实现（封装在 Unsafe 中）
```

### 2.5 volatile vs synchronized

| 对比 | volatile | synchronized |
| --- | --- | --- |
| 本质 | JMM 的**轻量级同步机制**（内存屏障） | JVM 的**互斥锁**（monitor） |
| 原子性 | ❌ 不保证复合操作 | ✅ 保证临界区原子 |
| 可见性 | ✅ | ✅ |
| 有序性 | ✅ 禁止重排 | ✅ 临界区串行 |
| 阻塞 | **❌ 不会阻塞** | ✅ 会阻塞（等锁） |
| 作用范围 | **只能修饰变量** | 可修饰方法、代码块 |
| 编译器优化 | 禁止部分优化 | 禁止跨越锁的重排 |
| 性能 | 高（无上下文切换） | 无竞争时高，有竞争时低 |
| 用途 | 状态标志、安全发布 | 复合操作的互斥 |

## 3. CAS 与原子类 ★★★★★

### 3.1 CAS（Compare-And-Swap）原理

**CAS 是一条 CPU 原子指令，包含三个操作数：内存位置 V、期望值 A、新值 B。当且仅当 V 的当前值等于 A 时，才把 V 更新为 B，否则不做任何操作。整个过程是原子的（硬件保证）。**

```
CAS(V, A, B):
  if (V == A) {        // 当前值等于期望值（说明期间没被其他线程修改）
      V = B;           // 更新为新值
      return true;
  } else {
      return false;    // 已被其他线程修改，需要重试（自旋）
  }
```

**CAS 的硬件实现（x86）：**

```asm
; JDK 中 Unsafe.compareAndSwapInt 的汇编实现（HotSpot x86）
lock cmpxchg [address], newValue
;  └─ lock 前缀：锁定总线或缓存行，保证多核下的原子性
;     cmpxchg：比较并交换指令
;     现代 CPU 用 MESI 缓存一致性协议实现，锁的是缓存行而非总线（性能更好）
```

**Java 中的 CAS 入口 —— Unsafe 类：**

```java
// sun.misc.Unsafe（JDK 9+ 迁移到 jdk.internal.misc.Unsafe，应用层无法直接获取）
public final native boolean compareAndSwapInt(Object obj, long offset, int expected, int update);
public final native boolean compareAndSwapLong(Object obj, long offset, long expected, long update);
public final native boolean compareAndSwapObject(Object obj, long offset, Object expected, Object update);

// 获取字段偏移量
private static final long VALUE_OFFSET = unsafe.objectFieldOffset(AtomicInteger.class.getDeclaredField("value"));

// JDK 9+ 的替代：VarHandle（更安全、更现代的 API）
private static final VarHandle VALUE_HANDLE;
static {
    try {
        VALUE_HANDLE = MethodHandles.lookup().findVarHandle(Counter.class, "value", int.class);
    } catch (Exception e) { throw new ExceptionInInitializerError(e); }
}
VALUE_HANDLE.compareAndSet(this, expect, update);            // CAS
VALUE_HANDLE.getAndAdd(this, 1);                             // 原子加
VALUE_HANDLE.getAndSet(this, newValue);                       // 原子设置
VALUE_HANDLE.compareAndExchange(this, expect, update);        // CAS 并返回旧值
VALUE_HANDLE.getAndAddAcquire(this, 1);                       // 带 acquire 语义
VALUE_HANDLE.getAndAddRelease(this, 1);                       // 带 release 语义
```

### 3.2 AtomicInteger 源码剖析

```java
public class AtomicInteger extends Number implements java.io.Serializable {

    // JDK 8 的实现（基于 Unsafe）
    private static final Unsafe unsafe = Unsafe.getUnsafe();
    private static final long valueOffset;
    static {
        try {
            valueOffset = unsafe.objectFieldOffset(AtomicInteger.class.getDeclaredField("value"));
        } catch (Exception ex) { throw new Error(ex); }
    }

    private volatile int value;                 // ★ volatile 保证可见性

    public AtomicInteger(int initialValue) { value = initialValue; }

    // ─── 核心：getAndAddInt（自旋 CAS）───
    public final int getAndAddInt(Object var1, long var2, int var4) {
        int var5;
        do {
            var5 = this.getIntVolatile(var1, var2);        // ① volatile 读当前值
        } while (!this.compareAndSwapInt(var1, var2, var5, var5 + var4));   // ② CAS，失败则重试
        return var5;                                        // 返回旧值
    }

    public final int getAndIncrement() { return unsafe.getAndAddInt(this, valueOffset, 1); }
    public final int incrementAndGet() { return unsafe.getAndAddInt(this, valueOffset, 1) + 1; }
    public final int getAndDecrement() { return unsafe.getAndAddInt(this, valueOffset, -1); }
    public final int decrementAndGet() { return unsafe.getAndAddInt(this, valueOffset, -1) - 1; }
    public final int getAndAdd(int delta) { return unsafe.getAndAddInt(this, valueOffset, delta); }
    public final int addAndGet(int delta) { return unsafe.getAndAddInt(this, valueOffset, delta) + delta; }

    public final int getAndSet(int newValue) { return unsafe.getAndSetInt(this, valueOffset, newValue); }

    public final boolean compareAndSet(int expect, int update) {
        return unsafe.compareAndSwapInt(this, valueOffset, expect, update);
    }

    // JDK 8+ 的函数式 API（★ 推荐，语义清晰）
    public final int getAndUpdate(IntUnaryOperator updateFunction) {
        int prev, next;
        do {
            prev = get();
            next = updateFunction.applyAsInt(prev);
        } while (!compareAndSet(prev, next));
        return prev;
    }
    public final int updateAndGet(IntUnaryOperator updateFunction) {
        return updateFunction.applyAsInt(getAndUpdate(updateFunction));
    }
    public final int getAndAccumulate(int x, IntBinaryOperator accumulatorFunction) { ... }
    public final int accumulateAndGet(int x, IntBinaryOperator accumulatorFunction) { ... }

    // 读取
    public final int get() { return value; }              // volatile 读
    public final void set(int newValue) { value = newValue; }   // volatile 写
    public final void lazySet(int newValue) {
        unsafe.putOrderedInt(this, valueOffset, newValue);   // ★ 延迟写（不插入 StoreLoad 屏障，性能更好但可见性延迟）
    }
    public int intValue(); public long longValue(); public float floatValue(); public double doubleValue();
}
```

**CAS 自旋的性能特征：**

```java
// 低竞争：CAS 一次成功，性能极高（无锁、无上下文切换）
// 高竞争：大量线程 CAS 失败并自旋重试 → CPU 空转，性能急剧下降甚至不如锁

// 实测（4 线程各累加 1000 万次）
// synchronized：    ~2000 ms（有上下文切换但无 CPU 空转）
// AtomicInteger：   ~5000 ms（大量 CAS 失败自旋）★ 高竞争下 CAS 反而更慢！
// LongAdder：       ~300 ms （分散热点，Cell 数组）★ 最优

// lazySet 的用途：不需要立即对其他线程可见时（如统计计数），省掉 StoreLoad 屏障，性能提升明显
```

### 3.3 CAS 的三大问题 ★★★★★

#### 问题 1：ABA 问题

**如果一个变量的值从 A 变成 B，又变回 A，CAS 检查时会认为「它没有被修改过」，但实际上中间发生了变化。**

```java
// ─── ABA 的经典危害场景：无锁链表 ───
// 链表：head → A → B → C
// 线程 1 准备执行 CAS(head, A, B) 来删除 A
//   ① 读取 head = A，next = B（准备把 head 指向 B）
//   ② 线程 1 被挂起
// 线程 2 执行了：
//   ③ 删除 A（head = B）
//   ④ 删除 B（head = C）
//   ⑤ 把 A 重新插入到头部（head = A，A.next = C）★ A 的 next 已经从 B 变成 C！
// 线程 1 恢复：
//   ⑥ CAS(head, A, B) 成功（head 确实是 A）→ head = B
//   ⑦ ★ 但 B 已经被删除了！链表变成 head → B（已释放的内存）→ ？
//      整个 C 节点丢失，链表结构损坏
```

**解决方案 1：AtomicStampedReference（版本号 / 时间戳）**

```java
import java.util.concurrent.atomic.AtomicStampedReference;

// 每次修改都递增版本号，CAS 同时比较「值」和「版本号」
AtomicStampedReference<Integer> ref = new AtomicStampedReference<>(100, 0);   // 值 100，版本 0

int[] stampHolder = new int[1];
Integer value = ref.get(stampHolder);                 // 同时获取值和版本号
int stamp = stampHolder[0];

// CAS：值和版本号都必须匹配
boolean success = ref.compareAndSet(
        100,                    // 期望值
        200,                    // 新值
        stamp,                  // 期望版本号
        stamp + 1);             // ★ 新版本号

ref.getStamp();                                        // 获取当前版本号
ref.getReference();                                    // 获取当前值
ref.attemptStamp(100, 5);                              // 仅当值未变时更新版本号
ref.set(300, 10);                                      // 同时设置值和版本号
```

**解决方案 2：AtomicMarkableReference（布尔标记，只关心「是否被修改过」）**

```java
// 简化版：只维护一个 boolean 标记（不关心改了几次）
AtomicMarkableReference<Integer> ref = new AtomicMarkableReference<>(100, false);
boolean[] markHolder = new boolean[1];
Integer value = ref.get(markHolder);
ref.compareAndSet(100, 200, false, true);              // 期望值、新值、期望标记、新标记
ref.isMarked();
```

| 类 | 版本管理 | 适用场景 |
| --- | --- | --- |
| `AtomicStampedReference&lt;V&gt;` | int 版本号（每次 +1） | **需要精确检测修改次数**（如上面的链表） |
| `AtomicMarkableReference&lt;V&gt;` | boolean 标记 | **只关心「有没有被改过」**（如一次性状态翻转） |

**解决方案 3：业务上规避（最常用）**

```java
// 大多数业务场景其实不受 ABA 影响，因为：
// 1. 计数器的 ABA（1→2→1）在语义上无害（我们只关心值正确）
// 2. 用锁或事务保护的场景不存在 ABA
// 3. 数据库乐观锁用 version 字段（本质就是 AtomicStampedReference 的思想）

// MyBatis-Plus 的乐观锁插件
@Version
private Integer version;
// UPDATE user SET name=?, version=version+1 WHERE id=? AND version=?
// 如果 version 被其他事务改过，UPDATE 影响行数为 0 → 业务感知冲突并重试
```

> 【面试】ABA 问题的标准回答结构：
> 1. **什么是 ABA**：值从 A→B→A，CAS 误判为未修改。
> 2. **危害**：在依赖「引用关系」的场景（无锁链表/栈）会破坏数据结构；在纯计数场景通常无害。
> 3. **解决**：加版本号（`AtomicStampedReference`）、加标记（`AtomicMarkableReference`）、数据库乐观锁 version 字段。
> 4. **辩证**：大多数业务用不到，Java 的原子类默认也不防 ABA（因为多数场景无害，加版本号有性能成本）。

#### 问题 2：自旋开销（高竞争下 CPU 空转）

```java
// 问题：CAS 失败会不断重试（自旋），竞争激烈时大量 CPU 周期浪费在无效 CAS 上
// 表现：CPU 使用率 100%，但吞吐量下降

// ✅ 解决方案 1：LongAdder（★ 分散热点，JDK 8+ 高并发计数的标准答案）
LongAdder adder = new LongAdder();
adder.increment();                     // 分散到多个 Cell
adder.sum();                           // 求和（弱一致）
adder.longValue(); adder.intValue(); adder.doubleValue();
adder.sumThenReset();                  // 求和并重置（统计场景）
adder.reset();

// ✅ 解决方案 2：限制自旋次数后降级为锁
int spinCount = 0;
while (!cas()) {
    if (++spinCount > MAX_SPIN) {
        synchronized (lock) { /* 用锁 */ }
        return;
    }
    Thread.onSpinWait();               // JDK 9+，PAUSE 指令降低功耗
}

// ✅ 解决方案 3：退避策略（Exponential Backoff）
int backoff = 1;
while (!cas()) {
    Thread.sleep(ThreadLocalRandom.current().nextInt(backoff));
    backoff = Math.min(backoff * 2, 100);      // 指数退避，上限 100ms
}

// ✅ 解决方案 4：用锁（竞争激烈时锁的性能反而更好，因为线程会阻塞而非空转）
```

**LongAdder 的原理（热点分散）★★★★★：**

```java
// LongAdder 继承 Striped64，核心思想：把一个热点变量拆成多个 Cell，
// 不同线程更新不同的 Cell，最后求和 → 把「一个 CAS 热点」变成「N 个低竞争热点」

public class LongAdder extends Striped64 {
    public void add(long x) {
        Cell[] as; long b, v; int m; Cell a;
        // ① 如果 Cell 数组已存在，或 CAS base 失败（说明有竞争）
        if ((as = cells) != null || !casBase(b = base, b + x)) {
            boolean uncontended = true;
            // ② 根据线程探针哈希（ThreadLocalRandom.getProbe()）定位到某个 Cell
            if (as == null || (m = as.length - 1) < 0 ||
                (a = as[getProbe() & m]) == null ||           // Cell 未初始化
                !(uncontended = a.cas(v = a.value, v + x))) { // ★ CAS 更新 Cell
                longAccumulate(x, null, uncontended);          // ③ 失败则扩容 Cell 数组或新建 Cell
            }
        }
    }

    // ④ 求和：base + 所有 Cell 的 value
    public long sum() {
        Cell[] as = cells; Cell a;
        long sum = base;
        if (as != null) {
            for (int i = 0; i < as.length; ++i) {
                if ((a = as[i]) != null) sum += a.value;
            }
        }
        return sum;
    }

    // Cell 用 @Contended 填充，避免伪共享
    @sun.misc.Contended static final class Cell {
        volatile long value;
        Cell(long x) { value = x; }
        final boolean cas(long cmp, long val) {
            return UNSAFE.compareAndSwapLong(this, valueOffset, cmp, val);
        }
    }
}
```

**LongAdder 的图解：**

```
低竞争时（只有 base）：
  ┌───────────┐
  │ base = 100 │  ← 所有线程 CAS 这一个变量
  └───────────┘

高竞争时（base + Cell[]）：
  ┌───────────┐
  │ base = 20  │
  └───────────┘
  ┌─────────┬─────────┬─────────┬─────────┐
  │ Cell[0] │ Cell[1] │ Cell[2] │ Cell[3] │   ← 每个 Cell 独占一个缓存行（@Contended）
  │  val=30 │  val=25 │  val=15 │  val=40 │   ← 线程按 probe 哈希分散到不同 Cell
  └─────────┴─────────┴─────────┴─────────┘
       ↑          ↑         ↑          ↑
     线程A,B    线程C,D   线程E      线程F,G
  Cell 数组会动态扩容（最多到 CPU 核数），扩容用 CAS 抢 cellsBusy 标志

sum() = 20 + 30 + 25 + 15 + 40 = 130   ← ★ 求和过程不加锁，是「弱一致」的快照
```

**LongAdder vs AtomicLong：**

| 对比 | AtomicLong | LongAdder |
| --- | --- | --- |
| 结构 | 单个 volatile long | base + Cell 数组 |
| 低竞争性能 | **略好**（无 Cell 分配开销） | 略差（首次竞争要初始化 Cell） |
| 高竞争性能 | **差**（所有线程 CAS 同一变量，失败率高） | **极好**（分散热点，快 10 倍以上） |
| `sum()` 一致性 | **强一致**（读的就是当前值） | **弱一致**（求和期间可能有并发修改） |
| 内存占用 | 小（1 个 long） | 大（最多 CPU 核数个 Cell） |
| CAS 失败处理 | 自旋重试 | 换 Cell 或扩容 |
| 伪共享 | 存在 | **@Contended 消除** |
| 支持的操作 | 全部（getAndSet、compareAndSet、updateAndGet 等） | 只有 add/increment/sum/reset |
| 适用 | 需要精确值、需要 CAS 语义、低竞争 | **高并发计数统计**（QPS、UV、监控指标） |

```java
// 选择建议
AtomicLong counter = new AtomicLong();          // 需要 compareAndSet / getAndSet 语义
LongAdder qpsCounter = new LongAdder();          // 纯计数统计，追求吞吐
LongAccumulator accumulator = new LongAccumulator(   // 自定义累加逻辑（LongAdder 的通用版）
        (a, b) -> Math.max(a, b), Long.MIN_VALUE);   // 例：求最大值
accumulator.accumulate(100);
accumulator.get();                                // 当前最大值
```

#### 问题 3：只能保证一个共享变量的原子性

```java
// CAS 只能对单个变量操作，多个变量的复合操作无法用 CAS 保证原子
volatile int a, b;
// ❌ 无法原子地「同时更新 a 和 b」
cas(a, 1, 2);
cas(b, 3, 4);                    // 两步之间可能被其他线程插入

// ✅ 方案 1：封装成对象，用 AtomicReference 对整个对象 CAS
class Pair { final int a; final int b; Pair(int a, int b) { this.a = a; this.b = b; } }
AtomicReference<Pair> ref = new AtomicReference<>(new Pair(1, 3));
ref.compareAndSet(oldPair, new Pair(2, 4));      // 原子更新整个对象

// ✅ 方案 2：用锁
synchronized (lock) { a = 2; b = 4; }

// ✅ 方案 3：AtomicStampedReference 组合（多字段场景不适用）
// ✅ 方案 4：不可变对象 + volatile 引用（Copy-On-Write 思想）
private volatile Config config;                   // Config 是不可变类
public void update(String key, String value) {
    Config newConfig = config.with(key, value);    // 创建新对象
    config = newConfig;                            // volatile 写，原子发布
}
```

### 3.4 原子类全家桶（JDK 8 共 17 个）

#### 基本类型

```java
AtomicInteger    // int
AtomicLong       // long
AtomicBoolean    // boolean（内部用 int 0/1 表示）
// ❌ 没有 AtomicShort / AtomicByte / AtomicFloat / AtomicDouble
//    原因：可以用 AtomicInteger/AtomicLong 转换实现（float 用 intToBits）
//    需要时用 AtomicLongFieldUpdater + doubleToLongBits

AtomicInteger i = new AtomicInteger(0);
i.get(); i.set(5);
i.getAndIncrement();  i.incrementAndGet();
i.getAndDecrement();  i.decrementAndGet();
i.getAndAdd(10);      i.addAndGet(10);
i.getAndSet(100);
i.compareAndSet(0, 1);
i.getAndUpdate(x -> x * 2);                 // JDK 8+ 函数式
i.updateAndGet(x -> x * 2);
i.accumulateAndGet(5, Integer::sum);         // 累积
i.lazySet(10);                               // 延迟写（性能优化）
i.intValue(); i.longValue(); i.floatValue(); i.doubleValue();

AtomicBoolean b = new AtomicBoolean(false);
b.get(); b.set(true); b.compareAndSet(false, true);
b.getAndSet(true);
```

#### 数组类型

```java
AtomicIntegerArray    // int[]
AtomicLongArray       // long[]
AtomicReferenceArray<E>  // Object[]

AtomicIntegerArray arr = new AtomicIntegerArray(10);          // 长度 10，全 0
AtomicIntegerArray arr2 = new AtomicIntegerArray(new int[]{1,2,3});   // ★ 会拷贝数组！
int[] original = {1,2,3};
AtomicIntegerArray arr3 = new AtomicIntegerArray(original);
arr3.set(0, 99);
System.out.println(original[0]);      // 1（原数组不变，AtomicIntegerArray 内部是 clone）

arr.get(0); arr.set(0, 5);
arr.getAndIncrement(0); arr.addAndGet(0, 10);
arr.compareAndSet(0, 5, 6);
arr.length();
arr.getAndUpdate(0, x -> x * 2);

AtomicReferenceArray<String> refArr = new AtomicReferenceArray<>(5);
refArr.compareAndSet(0, null, "first");
```

#### 引用类型

```java
AtomicReference<V>              // 原子更新对象引用
AtomicStampedReference<V>       // 引用 + int 版本号（防 ABA）
AtomicMarkableReference<V>      // 引用 + boolean 标记（防 ABA 简化版）

AtomicReference<User> ref = new AtomicReference<>(user1);
ref.get(); ref.set(user2);
ref.compareAndSet(user1, user2);           // ★ 引用相等（==）才 CAS 成功
ref.getAndSet(user3);
ref.updateAndGet(u -> new User(u.getName() + "_new"));
ref.accumulateAndGet(user2, (old, neu) -> old.getId() > neu.getId() ? old : neu);

// 实战：无锁的对象状态机
AtomicReference<State> state = new AtomicReference<>(State.INIT);
public boolean transition(State expected, State target) {
    return state.compareAndSet(expected, target);       // 原子状态流转
}
if (!transition(State.INIT, State.RUNNING)) {
    throw new IllegalStateException("状态流转失败，当前：" + state.get());
}
```

#### 字段更新器（不改变类结构，原子更新已有字段）★★★★★

```java
// 场景：无法修改类的源码（第三方类），或不想为每个字段创建原子对象（节省内存）
public class Config {
    volatile int retryCount;              // ★ 必须是 volatile！
    volatile String version;
    private Config() { }                  // 可以是私有构造器
}

// 创建更新器（静态字段，只需创建一次，开销极小）
private static final AtomicIntegerFieldUpdater<Config> RETRY_UPDATER =
        AtomicIntegerFieldUpdater.newUpdater(Config.class, "retryCount");
private static final AtomicReferenceFieldUpdater<Config, String> VERSION_UPDATER =
        AtomicReferenceFieldUpdater.newUpdater(Config.class, String.class, "version");
private static final AtomicLongFieldUpdater<Config> LONG_UPDATER = ...;

// 使用（传入对象实例）
RETRY_UPDATER.incrementAndGet(config);
RETRY_UPDATER.compareAndSet(config, 0, 1);
RETRY_UPDATER.get(config);
VERSION_UPDATER.compareAndSet(config, "1.0", "2.0");
```

**字段更新器的要求：**
1. 字段必须是 **`volatile`**（不能是 static、不能是 private？实际可以 private，只要 FieldUpdater 创建时用反射打开）。
2. 字段**不能是 static**（`AtomicIntegerFieldUpdater` 只支持实例字段）。
3. 字段类型必须精确匹配（`int` 对应 `AtomicIntegerFieldUpdater`）。
4. 字段不能是 `final`。

**优势：** 一个类有 10 个需要原子更新的 int 字段，用 `AtomicInteger` 需要创建 10 个对象（每个约 16 字节 + 对象头）；用 `AtomicIntegerFieldUpdater` 只需 1 个静态更新器，字段本身就是 4 字节。**JDK 源码中大量使用**（如 `ConcurrentSkipListMap`、`ThreadPoolExecutor` 的 ctl 字段）。

```java
// ThreadPoolExecutor 的经典用法：一个 int 打包「线程池状态 + 线程数」
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));
// ctl 的高 3 位是状态（RUNNING/SHUTDOWN/STOP/TIDYING/TERMINATED），低 29 位是线程数
private static int runStateOf(int c)     { return c & ~COUNT_BITS; }   // 取高 3 位
private static int workerCountOf(int c)  { return c & COUNT_BITS; }    // 取低 29 位
private static int ctlOf(int rs, int wc) { return rs | wc; }           // 组合
// 一次 CAS 同时更新两个逻辑字段 → 保证原子性（这就是「只能 CAS 单变量」问题的经典解法）
```

#### 高性能原子类（JDK 8+）

```java
LongAdder          // 高并发计数（分散热点）
LongAccumulator    // 自定义累积函数（LongAdder 的通用版）
DoubleAdder        // JDK 8 有，但很少用
// 注意：没有 IntAdder（LongAdder 覆盖了 int 的场景）

LongAccumulator max = new LongAccumulator(Long::max, Long.MIN_VALUE);
max.accumulate(10); max.accumulate(50); max.accumulate(30);
max.get();                     // 50

LongAccumulator product = new LongAccumulator((a, b) -> a * b, 1L);
product.accumulate(3); product.accumulate(4);
product.get();                 // 12
```

### 3.5 原子类选型速查

| 需求 | 推荐类 |
| --- | --- |
| 简单计数（低竞争） | `AtomicInteger` / `AtomicLong` |
| 高并发计数统计（QPS、UV） | **`LongAdder`** ★ |
| 自定义累积逻辑（求最大/最小/乘积） | `LongAccumulator` |
| 布尔标志的原子翻转 | `AtomicBoolean` |
| 数组元素的原子更新 | `AtomicIntegerArray` / `AtomicReferenceArray` |
| 对象引用的原子替换 | `AtomicReference` |
| 防 ABA（需要版本） | `AtomicStampedReference` |
| 防 ABA（只需标记） | `AtomicMarkableReference` |
| 第三方类/多字段/省内存 | `AtomicXxxFieldUpdater` |
| 读多写极少的列表 | `CopyOnWriteArrayList` |
| 读多写极少的 Map | `ConcurrentHashMap` |

## 4. 无锁编程实战

### 4.1 无锁栈（Treiber Stack）

```java
import java.util.concurrent.atomic.AtomicReference;

/**
 * 无锁栈：完全基于 CAS 实现的线程安全栈（Treiber's Stack, 1986）
 */
public class LockFreeStack<E> {

    private static class Node<E> {
        final E value;
        final Node<E> next;
        Node(E value, Node<E> next) {
            this.value = value;
            this.next = next;
        }
    }

    private final AtomicReference<Node<E>> head = new AtomicReference<>();
    private final LongAdder size = new LongAdder();

    public void push(E value) {
        Node<E> newHead = new Node<>(value, null);
        Node<E> oldHead;
        do {
            oldHead = head.get();
            newHead = new Node<>(value, oldHead);      // 新节点的 next 指向当前头
        } while (!head.compareAndSet(oldHead, newHead)); // ★ CAS 替换头，失败重试
        size.increment();
    }

    public E pop() {
        Node<E> oldHead;
        Node<E> newHead;
        do {
            oldHead = head.get();
            if (oldHead == null) return null;
            newHead = oldHead.next;                     // 新头是旧头的下一个
        } while (!head.compareAndSet(oldHead, newHead));
        size.decrement();
        return oldHead.value;
    }

    public E peek() {
        Node<E> h = head.get();
        return h == null ? null : h.value;
    }

    public long size() { return size.sum(); }
    public boolean isEmpty() { return head.get() == null; }
}
// ⚠️ 这个实现在有内存回收的场景下存在 ABA 风险（节点被 GC 后地址可能被复用）
//    Java 有 GC，地址复用问题比 C++ 轻，但对象仍可能被逻辑删除后重新压栈
//    严格场景需要 AtomicStampedReference
```

### 4.2 无锁队列与 ABA 防护

```java
/**
 * 带版本号的无锁队列节点（防 ABA）
 */
public class SafeLockFreeQueue<E> {

    private static class VersionedNode<E> {
        final E value;
        final AtomicReference<NodeRef<E>> next;
        VersionedNode(E value) {
            this.value = value;
            this.next = new AtomicReference<>();
        }
    }
    private static class NodeRef<E> {
        final VersionedNode<E> node;
        final long version;                     // ★ 版本号
        NodeRef(VersionedNode<E> node, long version) {
            this.node = node;
            this.version = version;
        }
    }

    private final AtomicStampedReference<VersionedNode<E>> head;
    private final AtomicStampedReference<VersionedNode<E>> tail;

    public boolean offer(E value) {
        VersionedNode<E> newNode = new VersionedNode<>(value);
        while (true) {
            int[] tailStamp = new int[1];
            VersionedNode<E> curTail = tail.get(tailStamp);
            int[] nextStamp = new int[1];
            NodeRef<E> next = curTail.next.get() == null ? null : null;
            // ... CAS 更新 tail 和 next 指针，版本号递增
        }
        return true;
    }
}
// 实践中：直接用 JDK 的 ConcurrentLinkedQueue（Michael-Scott 无锁队列的工业级实现）
//        或 LinkedBlockingQueue / ArrayBlockingQueue
```

### 4.3 无锁的实战应用地图

| 场景 | 无锁方案 | 说明 |
| --- | --- | --- |
| 计数统计 | `LongAdder` | 监控指标、QPS 统计 |
| 状态机流转 | `AtomicReference.compareAndSet` | 订单状态、连接状态 |
| 配置热更新 | `volatile` 引用 + 不可变对象 | 原子发布新配置 |
| 单例懒加载 | DCL + `volatile` | — |
| 无锁队列 | `ConcurrentLinkedQueue` | Michael-Scott 算法 |
| 无锁 Map | `ConcurrentHashMap` | CAS + synchronized 桶级锁（混合） |
| 跳表 | `ConcurrentSkipListMap` | CAS 更新指针 |
| 序列号生成 | `AtomicLong` / 雪花算法 | — |
| 位图/布隆过滤器 | `AtomicLongArray` | 每个 long 的位独立 CAS |
| AQS | `state` 字段 CAS | 所有 Lock 的基础 |
| 环形缓冲区 | Disruptor | 序列号 CAS（性能极高） |

```java
// 实战：配置热更新的无锁方案
public class DynamicConfig {

    // 不可变配置对象
    public record Config(int timeout, int maxRetry, String endpoint, Map<String, String> extra) {
        public Config withTimeout(int t) { return new Config(t, maxRetry, endpoint, extra); }
    }

    // ★ volatile 引用 + 不可变对象 = 无锁的原子发布
    private volatile Config current = new Config(3000, 3, "http://api.example.com", Map.of());

    public Config get() { return current; }                  // 读无锁，性能极高

    public void updateTimeout(int timeout) {
        Config old, neu;
        do {
            old = current;
            neu = old.withTimeout(timeout);
        } while (!compareAndSet(old, neu));                   // CAS 保证并发更新不丢失
    }

    // 用 AtomicReference 更简洁
    private final AtomicReference<Config> ref = new AtomicReference<>(current);
    public void updateTimeout2(int timeout) {
        ref.updateAndGet(c -> c.withTimeout(timeout));        // ★ 一行搞定，原子且无锁
    }
    public Config get2() { return ref.get(); }
}

// 实战：无锁的限流计数器（滑动窗口的简化版）
public class RateLimiter {
    private final LongAdder counter = new LongAdder();
    private volatile long windowStart = System.currentTimeMillis();
    private final long windowMs;
    private final long limit;

    public RateLimiter(long limit, long windowMs) {
        this.limit = limit;
        this.windowMs = windowMs;
    }

    public boolean tryAcquire() {
        long now = System.currentTimeMillis();
        if (now - windowStart > windowMs) {
            synchronized (this) {                             // 只在窗口切换时加锁
                if (now - windowStart > windowMs) {
                    windowStart = now;
                    counter.reset();
                }
            }
        }
        counter.increment();
        return counter.sum() <= limit;                        // ★ 弱一致，可能略微超限
    }
}
// 生产环境用 Guava RateLimiter 或 Sentinel（令牌桶/漏桶，精确控制）
```

## 5. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 以为 volatile 保证原子性 | `volatile int i; i++` 结果错误 | 用原子类或锁 |
| 2 | 状态标志无 volatile | 线程死循环不退出 | 加 `volatile` |
| 3 | DCL 单例缺 volatile | 拿到未初始化对象，偶发 NPE | 加 `volatile`，或用 Holder/枚举 |
| 4 | 多个 volatile 变量要求一致性 | 读到不一致的中间状态 | 封装成不可变对象，用 volatile 引用 |
| 5 | volatile 写性能期望过高 | 高频写场景性能下降 | 减少写频率，或改用其他方案 |
| 6 | CAS 高竞争下 CPU 空转 | CPU 100% 但吞吐低 | `LongAdder`、退避策略、或改用锁 |
| 7 | ABA 破坏无锁数据结构 | 链表/栈损坏 | `AtomicStampedReference` |
| 8 | ABA 在计数场景过度设计 | 无谓的性能损失 | 纯计数不受 ABA 影响，无需版本号 |
| 9 | CAS 多变量误以为原子 | 数据不一致 | 封装对象用 `AtomicReference`，或位打包（ctl 技巧） |
| 10 | `AtomicXxxFieldUpdater` 字段非 volatile | 更新无效/可见性问题 | 字段必须 volatile |
| 11 | FieldUpdater 用于 static 字段 | 抛异常 | 只支持实例字段 |
| 12 | `LongAdder.sum()` 当强一致用 | 统计值不准 | sum 是弱一致快照，需要精确用 AtomicLong |
| 13 | `AtomicIntegerArray` 修改原数组期望 | 原数组不变 | 构造时会 clone |
| 14 | 伪共享导致性能下降 | 多线程修改相邻字段性能差 | `@Contended` 或手动填充 |
| 15 | `lazySet` 期望立即可见 | 其他线程短暂读不到 | lazySet 是延迟写，只用于统计等场景 |
| 16 | 用 `volatile` 修饰数组/对象引用 | 只保证引用可见，内容不保证 | 元素本身要 volatile，或用并发容器 |
| 17 | Unsafe 直接使用（JDK 9+） | 无法访问 / 编译警告 | 用 `VarHandle` 替代 |
| 18 | 自旋无退出条件 | 永久自旋 | 限制次数后降级为锁或阻塞 |
| 19 | 活锁（两个线程互相谦让重试） | CPU 高无进展 | 加随机退避 |
| 20 | 数据库乐观锁未检查影响行数 | 更新丢失无感知 | `if (rows == 0) throw/重试` |

---

## 关联笔记

- 上一篇：[[后端/Java基础/并发编程/线程安全与synchronized]]
- 下一篇：[[后端/Java基础/并发编程/Lock与AQS原理]]
- 相关：[[后端/Java基础/并发编程/线程池原理与实战]]（ctl 字段的 CAS）、[[后端/Java基础/集合框架-Map与源码剖析]]（ConcurrentHashMap 的 CAS + CounterCell）
- 底层：[[后端/JVM/JVM概述与运行时数据区]]（JMM 与运行时数据区）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
