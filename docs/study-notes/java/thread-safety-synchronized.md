---
title: "线程安全与synchronized"
aliases:
  - "synchronized 原理"
  - "锁升级"
  - "对象头 Mark Word"
tags:
  - "后端"
  - "java"
  - "并发"
  - "面试"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/并发编程/线程基础与生命周期]]"
  - "[[后端/Java基础/并发编程/volatile与CAS原子类]]"
  - "[[后端/Java基础/并发编程/Lock与AQS原理]]"
  - "[[后端/JVM/JVM概述与运行时数据区]]"
created: 2026-09-06
updated: 2026-09-06
---

# 线程安全与 synchronized

## 1. synchronized 的三种用法

```java
public class SyncDemo {

    private final Object lock = new Object();
    private static final Object STATIC_LOCK = new Object();
    private int instanceField;
    private static int staticField;

    // ─── 1. 修饰实例方法：锁的是 this（当前对象）───
    public synchronized void instanceMethod() {
        instanceField++;
    }
    // 字节码：方法访问标志加 ACC_SYNCHRONIZED，无 monitorenter/exit
    // 等价于：
    public void instanceMethod2() {
        synchronized (this) { instanceField++; }
    }

    // ─── 2. 修饰静态方法：锁的是 Class 对象（全局唯一）───
    public static synchronized void staticMethod() {
        staticField++;
    }
    // 等价于：
    public static void staticMethod2() {
        synchronized (SyncDemo.class) { staticField++; }
    }

    // ─── 3. 修饰代码块：锁的是括号里指定的对象 ───
    public void blockMethod() {
        synchronized (lock) {                       // 锁自定义对象（★ 推荐）
            instanceField++;
        }
        synchronized (this) { }                     // 锁当前对象
        synchronized (SyncDemo.class) { }           // 锁 Class
        synchronized ("literal") { }                // ❌ 锁字符串常量（全局共享，易冲突）
        synchronized (Integer.valueOf(1)) { }       // ❌ 锁包装类（缓存池导致意外共享）
    }
}
```

**三种用法的锁对象对照（必背）：**

| 用法 | 锁对象 | 作用范围 |
| --- | --- | --- |
| `synchronized` 实例方法 | **`this`**（当前实例） | 同一实例的多个线程互斥；**不同实例之间不互斥** |
| `synchronized` 静态方法 | **`Class` 对象**（`Xxx.class`） | 全局互斥（Class 对象唯一） |
| `synchronized(obj)` 代码块 | **`obj`** | 所有锁同一个 obj 的线程互斥 |

```java
// ★ 经典面试题：这两个方法会互斥吗？
public class Service {
    public synchronized void methodA() { sleep(3000); }      // 锁 this
    public synchronized static void methodB() { }            // 锁 Service.class
}
Service s = new Service();
// 线程1: s.methodA()；线程2: s.methodB()  → ★ 不互斥！锁对象不同（this vs Class）
// 线程1: s1.methodA()；线程2: s2.methodA() → ★ 不互斥！不同实例的 this 不同
// 线程1: s.methodA()；线程2: s.methodA()   → ✅ 互斥（同一 this）
// 线程1: Service.methodB()；线程2: s.methodB() → ✅ 互斥（同一 Class）
```

> 【坑】**用 `String` 字面量或包装类当锁对象**：
> ```java
> synchronized ("LOCK") &#123; &#125;              // ❌ 字符串常量池全局共享，
>                                        //    其他毫不相关的代码也用 "LOCK" 就会互相阻塞
> synchronized (Integer.valueOf(1)) &#123; &#125;  // ❌ -128~127 是缓存的同一对象
> // ✅ 用 private final Object lock = new Object();（不可被外部访问和修改）
> ```

## 2. synchronized 的底层实现

### 2.1 两种实现方式：monitorenter vs ACC_SYNCHRONIZED

```java
// ─── 代码块：monitorenter / monitorexit 指令 ───
public void block() {
    synchronized (lock) {
        doSomething();
    }
}
```

```
// javap -c -v 输出
public void block();
  Code:
     0: aload_0
     1: getfield      #7     // Field lock:Ljava/lang/Object;
     4: dup
     5: astore_1
     6: monitorenter              ← ★ 进入同步块，尝试获取 monitor
     7: aload_0
     8: invokevirtual #12    // Method doSomething:()V
    11: aload_1
    12: monitorexit               ← ★ 正常退出，释放 monitor
    13: goto          21
    16: astore_2                  ← ★ 异常处理开始
    17: aload_1
    18: monitorexit               ← ★ 异常退出也释放 monitor（编译器自动插入）
    19: aload_2
    20: athrow
    21: return
  Exception table:
     from    to  target type
         7    13    16   any      ← ★ 任何异常都跳到 16，保证锁被释放
```

**关键点：**
1. **一个 `monitorenter` 对应两个 `monitorexit`**：一个正常路径，一个异常路径（编译器自动生成），**保证异常时锁一定释放**（等价于 try-finally）。
2. `dup` 指令：复制对象引用到栈上两次，一次给 monitorenter，一次留给 monitorexit（因为 monitorenter 会消耗栈顶元素）。

```java
// ─── 方法：ACC_SYNCHRONIZED 标志 ───
public synchronized void method() { doSomething(); }
```

```
public synchronized void method();
  descriptor: ()V
  flags: (0x0021) ACC_PUBLIC, ACC_SYNCHRONIZED      ← ★ 方法级同步标志
  Code:
     0: aload_0
     1: invokevirtual #12
     4: return
// 没有 monitorenter/exit！
// JVM 调用方法时检查 ACC_SYNCHRONIZED 标志，
// 若设置则先获取 monitor（实例方法用 this，静态方法用 Class），执行完自动释放
```

### 2.2 对象监视器（ObjectMonitor）★★★★★

**每个 Java 对象都关联一个 C++ 实现的 `ObjectMonitor`（在 HotSpot 的 `objectMonitor.hpp` 中）：**

```cpp
ObjectMonitor() {
    _header       = NULL;      // ★ 指向对象的 Mark Word
    _count        = 0;         // ★ 重入计数
    _waiters      = 0;
    _recursions   = 0;         // 锁的重入次数
    _object       = NULL;      // 关联的 Java 对象
    _owner        = NULL;      // ★ 当前持有锁的线程
    _WaitSet      = NULL;      // ★ 调用 wait() 的线程队列
    _WaitSetLock  = 0;
    _EntryList    = NULL;      // ★ 等待获取锁的线程队列（竞争队列）
    _cxq          = NULL;      // ★ ContentionQueue，最近到达的竞争者（单向链表）
    _FreeList     = NULL;
    ...
}
```

**加锁流程（重量级锁）：**

```
线程进入 _EntryList/_cxq 排队
        ↓
_owner == null ？
   ├─ 是 → CAS 尝试设置 _owner = 自己，_count = 1 → 获得锁
   └─ 否 → _owner 是自己？
             ├─ 是 → _count++（★ 可重入）
             └─ 否 → 阻塞（park），等待 _owner 释放后被唤醒重试
        ↓
执行同步代码
        ↓
monitorexit → _count--，减到 0 时 _owner = null
        ↓
从 _EntryList/_cxq 中唤醒一个线程（unpark）
```

**wait 的流程：**

```
线程持有锁 → 调用 obj.wait()
        ↓
释放 monitor（_owner = null, _count 清零）★ 这是 wait 与 sleep 的本质区别
        ↓
线程被封装成 ObjectWaiter 节点，加入 _WaitSet 队列
        ↓
线程阻塞（park），状态变为 WAITING
        ↓
其他线程 notify() → 从 _WaitSet 移一个 ObjectWaiter 到 _EntryList
其他线程 notifyAll() → 把 _WaitSet 全部移到 _EntryList
        ↓
线程在 _EntryList 中重新竞争锁
        ↓
获得锁后从 wait() 返回，_count 恢复，状态变 RUNNABLE
```

### 2.3 对象头与 Mark Word ★★★★★

**Java 对象在堆中的内存布局：**

```
┌─────────────────────────────────────────────┐
│  对象头（Header）                              │
│  ├── Mark Word（64 位，存储运行时数据）★         │
│  ├── Klass Pointer（32/64 位，指向类元数据）     │
│  └── 数组长度（仅数组对象有，32 位）              │
├─────────────────────────────────────────────┤
│  实例数据（Instance Data）：各字段的值            │
├─────────────────────────────────────────────┤
│  对齐填充（Padding）：补齐到 8 字节的倍数         │
└─────────────────────────────────────────────┘
```

**Mark Word 的 64 位结构（随锁状态变化而复用同一块空间）：**

| 锁状态 | 56 位内容（低位在前） | 4 位分代年龄 | 1 位偏向标志 | 2 位锁标志位 |
| --- | --- | --- | --- | --- |
| **无锁** | 对象 hashCode（31）+ 未用（25） | GC 分代年龄 | 0 | **01** |
| **偏向锁** | 线程 ID（54）+ Epoch（2） | GC 分代年龄 | **1** | **01** |
| **轻量级锁** | 指向栈中 Lock Record 的指针（62） | — | — | **00** |
| **重量级锁** | 指向 ObjectMonitor 的指针（62） | — | — | **10** |
| **GC 标记** | 空 | — | — | **11** |

```
无锁：      [ unused:25 | identity_hashcode:31 | unused:1 | age:4 | biased:0 | lock:01 ]
偏向锁：    [ thread:54 | epoch:2 | unused:1 | age:4 | biased:1 | lock:01 ]
轻量级锁：  [ ptr_to_lock_record:62 | lock:00 ]
重量级锁：  [ ptr_to_heavyweight_monitor:62 | lock:10 ]
GC 标记：   [ lock:11 ]
```

**关键设计洞察：**
1. **Mark Word 被「复用」**：同一块 64 位空间，在不同锁状态下存储不同内容。这是锁升级能实现的基础。
2. **偏向锁时 hashCode 存哪里？** 一旦调用了 `hashCode()`（需要 31 位存 hash），**偏向锁就无法使用了**（空间不够同时放 thread ID 和 hashCode），会直接升级为轻量级锁。这是 `Object.hashCode()` 与偏向锁冲突的著名细节。
3. **偏向锁在 JDK 15 被废弃（JEP 374），JDK 18+ 默认禁用**。原因：现代应用大量使用并发容器，偏向锁的撤销成本（需要 STW）超过了收益。

**查看对象头的工具：**

```xml
<!-- JOL（Java Object Layout）：查看对象内存布局的神器 -->
<dependency>
    <groupId>org.openjdk.jol</groupId>
    <artifactId>jol-core</artifactId>
    <version>0.17</version>
</dependency>
```

```java
import org.openjdk.jol.info.ClassLayout;
import org.openjdk.jol.vm.VM;

public class ObjectHeaderDemo {
    public static void main(String[] args) throws Exception {
        Object obj = new Object();
        // 无锁状态
        System.out.println(ClassLayout.parseInstance(obj).toPrintable());
        // java.lang.Object@1b6d3586d object internals:
        //  OFFSET  SIZE   TYPE DESCRIPTION                               VALUE
        //       0     4        (object header: mark)     0x0000000000000001 (non-biasable; age: 0)
        //       4     4        (object header: class)    0x000001b3
        //  Instance size: 16 bytes

        // 加锁后
        synchronized (obj) {
            System.out.println(ClassLayout.parseInstance(obj).toPrintable());
            // 0x00000000b2a4e80a (fat lock: 0x00000000b2a4e80a)   ← 重量级锁
        }

        // 查看字段布局与填充
        System.out.println(ClassLayout.parseClass(User.class).toPrintable());
        System.out.println(VM.current().details());      // JVM 信息（压缩指针等）
    }

    static class User {
        boolean flag;      // 1 字节
        int age;           // 4 字节
        long id;           // 8 字节
        String name;       // 4/8 字节（引用）
    }
    // JOL 会显示字段重排（JVM 按大小排序字段减少空洞）和 padding
}
```

**字段重排与内存对齐：**

```java
// 声明顺序：boolean(1) + int(4) + long(8) + ref(4) = 17 字节
// JVM 实际布局（重排以减少对齐空洞）：
//   long id         8 字节  offset 12? 
//   int age         4 字节
//   ref name        4 字节（开启压缩指针）
//   boolean flag    1 字节
//   padding         3 字节  → 总计 24 字节（对象头 12 + 数据 9 + 填充 3）
// 对象头 12 字节 = Mark Word 8 + Klass Pointer 4（压缩后）
```

> 【优化】字段声明顺序影响对象大小！把 `long/double`（8 字节）放前面，`boolean/byte`（1 字节）放后面，可以减少对齐填充。不过在开启压缩指针（默认，堆 < 32GB）时 JVM 会自动重排，手动优化意义不大。

## 3. 锁升级机制 ★★★★★（面试核心）

**JDK 6 对 synchronized 做了重大优化：引入锁升级（Lock Escalation），按竞争程度逐步升级，避免一上来就用重量级锁。**

### 3.1 四种锁状态

```
无锁 ──→ 偏向锁 ──→ 轻量级锁 ──→ 重量级锁
        （一个线程）  （多线程交替）  （多线程竞争）
        
★ 锁只能升级，不能降级！（除了 GC 的 STW 阶段可能降级）
★ 升级过程不可逆（重量级锁不会退回轻量级）
```

| 锁状态 | 适用场景 | 实现方式 | 性能 |
| --- | --- | --- | --- |
| **无锁** | 无同步需求 | Mark Word 存 hashCode | — |
| **偏向锁** | **始终只有一个线程访问**（无竞争） | Mark Word 存线程 ID，第二次进入只需比较线程 ID | **最快**（无 CAS） |
| **轻量级锁** | **多线程交替访问**（无实际竞争，或竞争极短） | CAS 把 Mark Word 复制到栈的 Lock Record，替换为指针 | 快（CAS，不阻塞） |
| **重量级锁** | **多线程同时竞争** | 膨胀为 ObjectMonitor，未获锁线程阻塞（涉及内核态切换） | 慢（用户态↔内核态） |

### 3.2 偏向锁（Biased Locking）

**核心思想：如果自始至终只有一个线程访问同步块，那么连 CAS 都不需要，只要比较线程 ID 即可。**

```java
// 偏向锁的流程
synchronized (obj) {
    // ① 检查 Mark Word 的锁标志位是否为 01 且偏向位为 1
    // ② 是 → 比较 Mark Word 中的线程 ID 是否为当前线程
    //    ├─ 相同 → 直接进入同步块（★ 零成本，无 CAS！）
    //    └─ 不同 → 需要撤销偏向（★ 必须在 safepoint 进行，有 STW 开销）
    // ③ 否（无锁状态）→ CAS 尝试把自己的线程 ID 写入 Mark Word
    //    ├─ 成功 → 获得偏向锁
    //    └─ 失败 → 升级为轻量级锁
}
```

**偏向锁的撤销（Revocation）—— 这是它被废弃的原因：**

```java
// 撤销时机
// 1. 另一个线程尝试获取锁 → 原偏向线程必须在 safepoint 暂停，检查其状态
//    - 原线程已退出同步块 → 重新偏向为新线程 或 变为无锁
//    - 原线程还在同步块内 → 升级为轻量级锁
// 2. 调用了 hashCode() → Mark Word 空间不够，直接升级为轻量级锁
// 3. 调用了 wait()/notify() → 直接升级为重量级锁（ObjectMonitor 才有 WaitSet）
// 4. 批量重偏向/批量撤销（JDK 6 的优化）：
//    同一个类的对象撤销偏向超过 20 次 → 批量重偏向（Bulk Rebias）
//    超过 40 次 → 批量撤销（Bulk Revoke），该类以后不再使用偏向锁

// 批量重偏向的原理：Epoch（世代计数器）
// Mark Word 中有 2 位 Epoch，每次批量撤销会 +1
// 旧 Epoch 的偏向锁被视为无效，可以低成本重偏向到新线程
```

**偏向锁的启用与禁用：**

```bash
# JDK 8~14：默认开启（但有 4 秒的启动延迟！）
-XX:+UseBiasedLocking              # 显式开启
-XX:BiasedLockingStartupDelay=0    # ★ 取消 4 秒延迟（测试偏向锁效果时必须加）

# JDK 15（JEP 374）：废弃并默认禁用
-XX:-UseBiasedLocking              # JDK 15+ 默认值

# 为什么有 4 秒延迟？
# JVM 启动时会运行大量同步代码（类加载、初始化），这些锁竞争激烈，
# 偏向锁在此时反而是负担。延迟 4 秒让启动阶段过去后再启用。
```

> 【面试】**为什么 JDK 15 废弃了偏向锁？**
>
> JEP 374 的官方理由：
> 1. **收益下降**：偏向锁是为 JDK 1.0 时代的大量 `Vector`、`StringBuffer`（每个方法都 synchronized）设计的。现代代码大量使用 `java.util.concurrent` 的无锁/CAS 结构，偏向锁的适用场景大幅减少。
> 2. **成本高**：撤销需要 safepoint（STW），批量撤销逻辑复杂，给 JVM 同步子系统引入了大量复杂性，阻碍其他优化。
> 3. **有害场景**：高并发应用中，偏向锁的反复撤销反而拖慢性能。
> 4. 移除后可以简化 HotSpot 的锁实现，为后续的虚拟线程（Loom）铺路。

### 3.3 轻量级锁（Lightweight Locking）

**核心思想：多线程交替执行同步块（无实际竞争）时，用 CAS 替代操作系统互斥量，避免内核态切换。**

```java
// 轻量级锁的加锁流程
synchronized (obj) {
    // ① 在当前线程的栈帧中创建 Lock Record（锁记录）
    //    Lock Record = { owner: 指向对象的指针, displaced_mark_word: 对象 Mark Word 的副本 }
    // ② CAS 尝试把对象的 Mark Word 替换为「指向 Lock Record 的指针」，锁标志位改为 00
    //    ├─ 成功 → 当前线程获得轻量级锁
    //    └─ 失败 → 检查 Mark Word 是否指向当前线程的 Lock Record
    //                ├─ 是 → 重入，再分配一个 Lock Record（displaced_mark_word = null）作为重入计数
    //                └─ 否 → 说明有其他线程竞争
    //                        ③ 先自旋重试若干次（自适应自旋）
    //                        ④ 自旋失败 → ★ 膨胀为重量级锁
}

// 解锁流程
// CAS 把 displaced_mark_word 换回对象的 Mark Word
//   ├─ 成功 → 解锁完成
//   └─ 失败 → 说明期间发生过膨胀，需要释放重量级锁并唤醒等待线程
```

**Lock Record 结构：**

```
线程栈帧                          堆中的对象
┌──────────────────────┐         ┌──────────────────────┐
│  Lock Record         │         │  Mark Word           │
│  ┌────────────────┐  │         │  ┌────────────────┐  │
│  │displaced_mark  │←─┼─复制────┤  │原 Mark Word 副本 │  │
│  │  word          │  │         │  └────────────────┘  │
│  ├────────────────┤  │         │  Klass Pointer       │
│  │ owner ─────────┼──┼────────→│  实例数据             │
│  └────────────────┘  │         └──────────────────────┘
└──────────────────────┘              ↑
                                      │ Mark Word 现在存的是
                          指向 Lock Record 的指针，锁标志 = 00
```

### 3.4 自旋锁与自适应自旋

**自旋（Spinning）：获取锁失败时不立即阻塞，而是循环重试若干次**，因为锁可能很快就被释放，阻塞/唤醒涉及内核态切换（约 5~10μs），代价远大于自旋几十次。

```java
// 自旋的伪代码
for (int i = 0; i < spinCount; i++) {
    if (tryAcquire()) return;
    Thread.onSpinWait();          // JDK 9+，生成 PAUSE 指令，降低 CPU 功耗和流水线清空代价
}
blockAndWait();                   // 自旋失败才阻塞
```

**自适应自旋（Adaptive Spinning，JDK 6+ 默认开启）：**

```
自旋次数不再固定（JDK 5 是固定 10 次，可用 -XX:PreBlockSpin 调整），
而是由「上一次在同一个锁上的自旋结果 + 锁拥有者的状态」动态决定：

- 如果上次自旋成功获得了锁 → JVM 认为这次也大概率成功 → 允许更长的自旋（甚至 100 次）
- 如果自旋很少成功 → JVM 可能直接省略自旋过程，直接阻塞（避免浪费 CPU）
```

```bash
# 相关 JVM 参数
-XX:+UseSpinning                  # JDK 6+ 默认开启（JDK 5 需手动开）
-XX:PreBlockSpin=10               # 自旋次数（自适应开启后此参数意义减弱）
-XX:-UseSpinning                  # 禁用自旋
```

**自旋的适用与不适用：**

| 适用 | 不适用 |
| --- | --- |
| 锁持有时间**极短**（几十纳秒） | 锁持有时间长（自旋白白浪费 CPU） |
| 多核 CPU（自旋时其他核在干活） | **单核 CPU**（自旋时持有锁的线程无法运行，纯浪费） |
| 竞争线程数少 | 竞争激烈（大量线程自旋 → CPU 100%） |

### 3.5 重量级锁（Heavyweight Locking）

**膨胀为 ObjectMonitor 后，未获锁的线程会阻塞（进入内核态等待），涉及用户态/内核态切换，开销大。**

```java
// 膨胀触发条件
// 1. 轻量级锁的 CAS 失败且自旋超过阈值
// 2. 等待线程数超过一定数量（JVM 启发式判断）
// 3. 调用了 wait()/notify()（需要 WaitSet，只有 ObjectMonitor 有）
// 4. 调用了 hashCode()（偏向锁情况下）

// 膨胀后的行为
// - 未获锁线程被 park（阻塞），状态 BLOCKED
// - 依赖操作系统的 mutex/semaphore（Linux 上是 pthread_mutex + futex）
// - 上下文切换约 5~10μs（1~2 万 CPU 周期）
```

**锁升级的完整流程图：**

```
                    对象刚创建
                        │
                        ▼
              ┌──────────────────┐
              │      无锁         │  Mark Word: [hashcode | age | 0 | 01]
              └────────┬─────────┘
                       │ 第一个线程进入同步块
                       │ CAS 写入线程 ID（成功）
                       ▼
              ┌──────────────────┐
              │     偏向锁        │  Mark Word: [thread ID | epoch | age | 1 | 01]
              │  同一线程重入零成本 │
              └────────┬─────────┘
                       │ 第二个线程尝试获取锁
                       │ → safepoint 撤销偏向
                       ▼
              ┌──────────────────┐
              │    轻量级锁        │  Mark Word: [指向 Lock Record 的指针 | 00]
              │  CAS + 自适应自旋   │
              └────────┬─────────┘
                       │ 自旋失败 / 竞争激烈 / 调用 wait()
                       ▼
              ┌──────────────────┐
              │    重量级锁        │  Mark Word: [指向 ObjectMonitor 的指针 | 10]
              │  线程阻塞，内核调度  │
              └──────────────────┘
                  （不可逆，除 GC STW）
```

### 3.6 JDK 6 的其他 synchronized 优化

| 优化 | 说明 |
| --- | --- |
| **锁升级** | 偏向 → 轻量 → 重量，按需升级 |
| **自适应自旋** | 根据历史自旋成功率动态调整自旋次数 |
| **锁消除（Lock Elision）** | JIT 通过**逃逸分析**发现锁对象不可能被其他线程访问 → **直接删除锁** |
| **锁粗化（Lock Coarsening）** | 连续对同一对象加锁解锁 → 合并为一次更大范围的锁 |

```java
// ─── 锁消除示例 ───
public String concat(String a, String b) {
    StringBuilder sb = new StringBuilder();     // sb 是局部变量，不会逃逸出方法
    sb.append(a);                                // append 是 synchronized 方法！
    sb.append(b);                                // 同上
    return sb.toString();                        // toString 也是 synchronized
}
// JIT 逃逸分析发现 sb 只在方法内使用，其他线程不可能访问
// → 所有 synchronized 被消除，等价于非同步代码
// 验证：-XX:+EliminateLocks（默认开启）-XX:+PrintEliminateLocks（debug 版 JVM）

// ─── 锁粗化示例 ───
for (int i = 0; i < 1000; i++) {
    synchronized (lock) { list.add(i); }         // 循环内反复加锁解锁
}
// JIT 优化为：
synchronized (lock) {
    for (int i = 0; i < 1000; i++) { list.add(i); }   // 一次加锁
}
// ⚠️ 注意：锁粗化会扩大临界区，可能增加其他线程的等待时间。
//   这里的权衡是：1000 次加锁解锁的开销 > 扩大临界区的影响

// ─── 逃逸分析的三个应用 ───
// 1. 锁消除（如上）
// 2. 栈上分配（Scalar Replacement）：对象不逃逸则拆解为局部变量分配在栈上，减少 GC
// 3. 标量替换：对象的字段被拆散，直接分配到寄存器/栈
public Point calculate() {
    Point p = new Point(1, 2);       // p 不逃逸（只用了 x、y 就丢弃）
    return new Point(p.x + 1, p.y);  // JIT 可能把 p 优化为两个 int 局部变量，不在堆上分配
}
// -XX:+DoEscapeAnalysis（默认开启）-XX:+EliminateAllocations（默认开启）
```

## 4. synchronized 的特性

### 4.1 可重入性（Reentrant）★★★★★

**同一线程可以重复获取自己已持有的锁，不会死锁。**

```java
public class ReentrantDemo {
    public synchronized void methodA() {
        System.out.println("A");
        methodB();                    // ★ 同一线程再次获取 this 锁 → 可重入，不死锁
    }
    public synchronized void methodB() {
        System.out.println("B");
    }
}
new ReentrantDemo().methodA();        // 输出 A B（如果不支持重入会死锁）

// 继承场景的重入
class Parent {
    public synchronized void doWork() { System.out.println("Parent"); }
}
class Child extends Parent {
    @Override
    public synchronized void doWork() {
        super.doWork();                // ★ 子类锁和父类锁是同一个 this，可重入
        System.out.println("Child");
    }
}
```

**实现原理：** ObjectMonitor 的 `_count` 字段。同一线程每次进入 `_count++`，退出 `_count--`，减到 0 才真正释放锁。

```
线程 A 第一次进入：_owner = A, _count = 1
线程 A 第二次进入：_owner == A → _count = 2（无需竞争）
线程 A 第一次退出：_count = 1（锁仍被持有）
线程 A 第二次退出：_count = 0, _owner = null（真正释放）
```

> 【重要】**可重入是必须的**：否则「子类调用父类的同步方法」「同步方法调用同类其他同步方法」都会死锁。`ReentrantLock` 也是可重入的（AQS 的 state 累加）。

### 4.2 不可中断性

```java
// synchronized 等锁时无法被 interrupt 打断
Thread t = new Thread(() -> {
    synchronized (lock) {              // ★ 即使被 interrupt，也会一直等到拿到锁
        System.out.println("获得锁");
    }
});
t.start();
t.interrupt();                         // 无效！t 仍然 BLOCKED

// ✅ 需要可中断的锁等待 → 用 Lock
try {
    reentrantLock.lockInterruptibly();  // ★ 等锁期间可被中断，抛 InterruptedException
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
}
```

### 4.3 公平性：synchronized 是**非公平锁**

```java
// synchronized 不保证等待时间最长的线程先获得锁
// ObjectMonitor 的唤醒策略：
// 1. 新来的线程先尝试直接抢锁（可能插队成功）→ 非公平
// 2. 抢不到才进 _cxq（后进先出的栈结构）
// 3. _cxq 的线程会被移到 _EntryList（队列）
// 4. 释放锁时从 _EntryList 或 _cxq 唤醒（策略复杂，不保证 FIFO）

// 非公平的好处：吞吐量高（减少线程切换，刚释放锁的线程可能还在 CPU 上，立即重入效率高）
// 非公平的坏处：可能饥饿（某线程长期抢不到锁）

// ✅ 需要公平锁 → ReentrantLock(true)
ReentrantLock fairLock = new ReentrantLock(true);      // 严格 FIFO
```

### 4.4 synchronized 的三大保证

| 保证 | 实现方式 |
| --- | --- |
| **原子性** | 同一时刻只有一个线程能进入临界区；`monitorenter/exit` 保证加解锁的原子性 |
| **可见性** | 解锁前必须把工作内存的修改刷回主内存；加锁时清空工作内存重新读取主内存（JMM 规定） |
| **有序性** | 临界区内的代码不会重排到临界区外（但**临界区内部仍可能重排**！）；同步块的进入/退出形成 happens-before 关系 |

> 【坑】**synchronized 不保证临界区内部的有序性**：
> ```java
> synchronized (lock) &#123;
>     a = 1;          // ①
>     b = 2;          // ② 可能被重排为 ②①（单线程语义不变，JIT 允许）
> &#125;
> // 但对其他线程来说，因为解锁会插入 StoreStore/StoreLoad 屏障，
> // ①② 的结果对外部线程是可见且有序的（在同步块外部读取时）
> ```

### 4.5 happens-before 与 synchronized

**JMM 定义的 8 条 happens-before 规则：**

| # | 规则 | 说明 |
| --- | --- | --- |
| 1 | **程序顺序规则** | 同一线程内，前面的操作 hb 后面的操作（但不代表不能重排，只要结果不变） |
| 2 | **监视器锁规则** | **对同一把锁，unlock hb 于后续的 lock** ★ |
| 3 | **volatile 规则** | **volatile 写 hb 于后续的 volatile 读** ★ |
| 4 | **线程启动规则** | `Thread.start()` hb 于该线程的任何操作 |
| 5 | **线程终止规则** | 线程的所有操作 hb 于其他线程检测到它终止（`join()` 返回、`isAlive()` 返回 false） |
| 6 | **线程中断规则** | `interrupt()` hb 于被中断线程检测到中断（`isInterrupted()`、抛 InterruptedException） |
| 7 | **对象终结规则** | 构造函数执行完毕 hb 于 `finalize()` 开始 |
| 8 | **传递性** | A hb B，B hb C → A hb C |

```java
// 锁规则的实践
int value = 0;
// 线程 A
synchronized (lock) {
    value = 42;                    // 写操作
}                                  // ★ unlock：把修改刷到主内存

// 线程 B
synchronized (lock) {              // ★ lock：清空工作内存，从主内存重读
    System.out.println(value);     // 保证看到 42（happens-before 保证）
}
// 若线程 B 不在同步块内读 value，则不保证可见性
```

## 5. synchronized 与 Lock 的对比 ★★★★★

| 对比项 | synchronized | Lock（ReentrantLock） |
| --- | --- | --- |
| 层面 | **JVM 关键字**（字节码 monitorenter/exit） | **JDK API**（`java.util.concurrent.locks`） |
| 锁的获取释放 | JVM 自动（异常也释放） | **手动 `unlock()`，必须在 finally** |
| 可中断 | ❌ 等锁时不可中断 | ✅ `lockInterruptibly()` |
| 超时获取 | ❌ | ✅ `tryLock(timeout)` |
| 非阻塞尝试 | ❌ | ✅ `tryLock()` |
| 公平锁 | ❌ 只能非公平 | ✅ `new ReentrantLock(true)` |
| 条件变量 | 1 个（`wait/notify`） | **多个 Condition**（精确唤醒） |
| 锁状态查询 | ❌ | ✅ `isLocked()`、`getHoldCount()`、`isHeldByCurrentThread()` |
| 性能（JDK 6+） | **优化后与 Lock 相当** | 相当 |
| 底层 | ObjectMonitor + 锁升级 | AQS + CAS + LockSupport |
| 锁绑定条件 | 不支持 | 支持 |
| 读写分离 | 不支持 | ✅ `ReentrantReadWriteLock` |
| 代码简洁性 | ✅ 简洁不易出错 | 需要样板代码 |
| 死锁排查 | jstack 能显示 | jstack 也能显示（AQS 信息） |

**选择原则：**

| 场景 | 选择 |
| --- | --- |
| 简单的互斥保护，代码块不大 | **synchronized**（简洁、不会忘记释放、JVM 持续优化） |
| 需要可中断、超时、非阻塞获取锁 | **Lock** |
| 需要公平锁 | **Lock** |
| 需要多个等待条件（如生产者-消费者的满/空分离） | **Lock + 多 Condition** |
| 读多写少 | **ReentrantReadWriteLock** 或 `StampedLock` |
| 高并发计数 | **LongAdder**（不用锁） |
| 虚拟线程（JDK 21+）环境 | **Lock**（synchronized 在阻塞时会 pin 载体线程） |

```java
// Lock 的正确使用范式（★ 必须严格遵守）
Lock lock = new ReentrantLock();
lock.lock();                        // ★ 加锁必须在 try 之外！
try {
    // 临界区
} finally {
    lock.unlock();                  // ★ 必须在 finally 中释放
}

// ❌ 错误写法 1：lock 在 try 内
try {
    lock.lock();                    // 如果 lock() 本身抛异常（如 OOM）
    doWork();                       // finally 会执行 unlock → IllegalMonitorStateException
} finally {
    lock.unlock();
}

// ❌ 错误写法 2：忘记 finally
lock.lock();
doWork();                           // 抛异常 → 锁永远不释放 → 其他线程永久阻塞
lock.unlock();

// ✅ tryLock 的范式
if (lock.tryLock(3, TimeUnit.SECONDS)) {
    try {
        // 临界区
    } finally {
        lock.unlock();
    }
} else {
    // 获取锁超时的降级处理
    log.warn("获取锁超时，执行降级逻辑");
}
```

## 6. synchronized 的性能与实践

### 6.1 性能数据（JMH 基准测试参考值）

| 场景 | 无同步 | synchronized（无竞争，偏向锁） | synchronized（无竞争，轻量级锁） | synchronized（高竞争，重量级） | ReentrantLock（高竞争） | AtomicLong（CAS） | LongAdder |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 单线程 1000 万次自增 | ~4 ms（会被优化掉） | ~50 ms | ~90 ms | — | ~90 ms | ~200 ms | ~60 ms |
| 4 线程各 1000 万次 | — | — | — | ~3000 ms | ~2500 ms | ~5000 ms | **~300 ms** |

> 结论：
> 1. **无竞争时 synchronized 非常快**（偏向锁几乎零成本，轻量级锁只有 CAS）。
> 2. **高竞争时 LongAdder > Lock ≈ synchronized >> AtomicLong**（AtomicLong 高竞争下 CAS 失败率高，自旋浪费 CPU）。
> 3. **能用无锁方案（CAS/不可变对象/线程封闭）就不用锁**。

### 6.2 synchronized 使用的最佳实践

```java
// ✅ 1. 缩小同步范围（临界区越小越好）
// ❌ 整个方法加锁，包含了耗时的 IO
public synchronized List<Data> process() {
    List<Data> raw = queryFromDb();          // IO 操作，不需要锁
    List<Data> filtered = filter(raw);        // 只有这步需要保护
    saveToCache(filtered);                    // IO，不需要锁
    return filtered;
}
// ✅ 只锁必要的部分
public List<Data> process() {
    List<Data> raw = queryFromDb();
    List<Data> filtered;
    synchronized (this) {
        filtered = filter(raw);
    }
    saveToCache(filtered);
    return filtered;
}

// ✅ 2. 锁对象必须是 private final（防止外部锁同一对象造成干扰）
private final Object lock = new Object();     // ✅
public synchronized void bad() { }             // ⚠️ 锁 this，外部可能 synchronized(obj) 干扰

// ✅ 3. 不要在锁内做 IO / 远程调用 / 长耗时操作
synchronized (lock) {
    httpClient.execute(request);               // ❌ 网络调用可能几秒，锁一直持有
}
// ✅ 先取数据快照，锁外做 IO
List<Item> snapshot;
synchronized (lock) { snapshot = new ArrayList<>(items); }
for (Item i : snapshot) { httpClient.send(i); }

// ✅ 4. 固定的加锁顺序（防死锁）
// 见下一节

// ✅ 5. 优先用并发容器而非手动加锁
// ❌ Collections.synchronizedMap(new HashMap<>())
// ✅ ConcurrentHashMap

// ✅ 6. 优先用不可变对象（无需同步）
private final List<String> config = List.of("a", "b");   // 不可变，天然线程安全

// ✅ 7. 线程封闭（不共享就无需同步）
private static final ThreadLocal<SimpleDateFormat> SDF =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

// ✅ 8. 用原子类替代锁（简单计数场景）
private final AtomicInteger counter = new AtomicInteger();
counter.incrementAndGet();                      // 比 synchronized 快得多

// ❌ 9. 不要锁字符串、包装类、Class 对象（除静态方法）
synchronized ("LOCK") { }                       // ❌ 常量池共享
synchronized (Integer.valueOf(1)) { }           // ❌ 缓存池共享
synchronized (list) { }                         // ❌ list 可能被替换（引用改变）

// ✅ 10. 静态字段用静态锁对象保护
private static final Object STATIC_LOCK = new Object();
private static int staticCount;
public static void increment() {
    synchronized (STATIC_LOCK) { staticCount++; }
}
// 或直接用 synchronized static 方法
```

### 6.3 死锁的产生与排查 ★★★★★

**死锁的四个必要条件（Coffman 条件）—— 缺一不可：**

| # | 条件 | 说明 | 破坏方式 |
| --- | --- | --- | --- |
| 1 | **互斥** | 资源同时只能被一个线程占用 | 无法破坏（锁的本质） |
| 2 | **持有并等待** | 线程持有资源的同时等待其他资源 | **一次性申请所有资源** |
| 3 | **不可剥夺** | 资源只能由持有者主动释放 | **允许抢占**（tryLock 超时放弃） |
| 4 | **循环等待** | 存在线程资源的环形等待链 | **★ 固定加锁顺序**（最实用） |

```java
// ─── 死锁示例 ───
public class DeadlockDemo {
    private static final Object LOCK_A = new Object();
    private static final Object LOCK_B = new Object();

    public static void main(String[] args) {
        new Thread(() -> {
            synchronized (LOCK_A) {
                System.out.println("线程1 获得 A，等待 B");
                sleep(100);                       // 确保线程2 拿到 B
                synchronized (LOCK_B) {
                    System.out.println("线程1 获得 B");
                }
            }
        }, "Thread-1").start();

        new Thread(() -> {
            synchronized (LOCK_B) {                // ★ 加锁顺序相反 → 死锁！
                System.out.println("线程2 获得 B，等待 A");
                sleep(100);
                synchronized (LOCK_A) {
                    System.out.println("线程2 获得 A");
                }
            }
        }, "Thread-2").start();
    }
}
// 输出：
// 线程1 获得 A，等待 B
// 线程2 获得 B，等待 A
// （永久挂起）

// ─── jstack 能自动检测死锁 ───
// Found one Java-level deadlock:
// =============================
// "Thread-2":
//   waiting to lock monitor 0x00007f8a2c006208 (object 0x000000076ab62208, a java.lang.Object),
//   which is held by "Thread-1"
// "Thread-1":
//   waiting to lock monitor 0x00007f8a2c004e28 (object 0x000000076ab62300, a java.lang.Object),
//   which is held by "Thread-2"
//
// Java stack information for the threads listed above:
// "Thread-2":
//   at DeadlockDemo.lambda$main$1(DeadlockDemo.java:25)
//   - waiting to lock <0x000000076ab62208> (a java.lang.Object)
//   - locked <0x000000076ab62300> (a java.lang.Object)

// ─── 预防方案 1：固定加锁顺序（★ 最实用）───
// 给锁对象定义全局顺序（如按 hashCode 或业务 ID），所有线程都按此顺序加锁
public void transfer(Account from, Account to, BigDecimal amount) {
    // ★ 按账户 ID 排序，保证所有转账都以相同顺序加锁
    Account first = from.getId() < to.getId() ? from : to;
    Account second = from.getId() < to.getId() ? to : from;
    synchronized (first) {
        synchronized (second) {
            from.withdraw(amount);
            to.deposit(amount);
        }
    }
}
// 若 ID 相同（自己转自己）需要特殊处理，否则可重入没问题但要避免重复业务

// ─── 预防方案 2：tryLock 超时放弃（破坏「不可剥夺」）───
public boolean transfer(Account from, Account to, BigDecimal amount) {
    while (true) {
        if (from.getLock().tryLock(50, TimeUnit.MILLISECONDS)) {
            try {
                if (to.getLock().tryLock(50, TimeUnit.MILLISECONDS)) {
                    try {
                        from.withdraw(amount);
                        to.deposit(amount);
                        return true;
                    } finally { to.getLock().unlock(); }
                }
            } finally { from.getLock().unlock(); }
        }
        // 两个锁都没拿到 → 随机退避后重试（避免活锁）
        Thread.sleep(ThreadLocalRandom.current().nextInt(10));
    }
}

// ─── 预防方案 3：一次性申请所有资源（破坏「持有并等待」）───
// 用粗粒度锁保护所有相关资源
synchronized (globalLock) {
    from.withdraw(amount);
    to.deposit(amount);
}
// 缺点：并发度极低

// ─── 预防方案 4：使用无锁设计 ───
// CAS 原子类、不可变对象、消息传递（Actor 模型）、ThreadLocal
```

**死锁 vs 活锁 vs 饥饿：**

| 现象 | 定义 | 线程状态 | 解决 |
| --- | --- | --- | --- |
| **死锁（Deadlock）** | 多个线程互相等待对方持有的锁，永久阻塞 | BLOCKED | 破坏四个必要条件之一 |
| **活锁（Livelock）** | 线程不断响应对方，一直在运行但无法推进（如两人走廊相遇互相让路反复） | RUNNABLE（CPU 空转） | 引入**随机等待时间**打破对称 |
| **饥饿（Starvation）** | 某线程长期抢不到资源（优先级低、非公平锁、锁被长期持有） | 交替 RUNNABLE/BLOCKED | 公平锁、避免长时间持锁、优先级不悬殊 |

```java
// 活锁示例
public void transfer(Account other) {
    while (!tryTransfer(other)) {
        // 两个线程都在「礼貌地」释放锁重试，永远同步地冲突
    }
}
// ✅ 修复：加随机退避
Thread.sleep(ThreadLocalRandom.current().nextInt(10, 100));

// 饥饿示例
// 1. 非公平锁下，某线程一直抢不到（ReentrantLock(false) 默认）
// 2. synchronized 内做耗时 IO，其他线程长期等待
// 3. 线程优先级悬殊（Thread.MIN_PRIORITY 一直得不到调度）
// 4. 读写锁中写线程被大量读线程饿死（ReentrantReadWriteLock 非公平模式下）
```

### 6.4 数据库层面的死锁（延伸）

```sql
-- MySQL 的死锁检测
SHOW ENGINE INNODB STATUS\G      -- LATEST DETECTED DEADLOCK 段落
-- 事务 A: UPDATE account SET balance=balance-100 WHERE id=1;  （持有 id=1 的行锁）
-- 事务 B: UPDATE account SET balance=balance-100 WHERE id=2;  （持有 id=2 的行锁）
-- 事务 A: UPDATE account SET balance=balance+100 WHERE id=2;  （等待 B 的锁）
-- 事务 B: UPDATE account SET balance=balance+100 WHERE id=1;  （等待 A 的锁）→ 死锁

-- InnoDB 自动检测死锁并回滚「代价最小」的事务（undo log 量最少的）
-- 应用层要处理：捕获 DeadlockLoserDataAccessException 并重试
```

```java
// Spring 中的死锁重试
@Retryable(value = DeadlockLoserDataAccessException.class,
           maxAttempts = 3,
           backoff = @Backoff(delay = 100, multiplier = 2, random = true))
@Transactional
public void transfer(Long fromId, Long toId, BigDecimal amount) {
    // ★ 按 ID 排序查询，保证加锁顺序一致（这是解决数据库死锁的核心手段）
    Long firstId = Math.min(fromId, toId);
    Long secondId = Math.max(fromId, toId);
    Account first = accountMapper.selectByIdForUpdate(firstId);    // SELECT ... FOR UPDATE
    Account second = accountMapper.selectByIdForUpdate(secondId);
    // 业务逻辑
}
```

## 7. 常见的线程安全模式

```java
// ─── 模式 1：不可变对象（Immutable）★ 最优 ───
public final class Money {                    // final 类，防子类破坏
    private final BigDecimal amount;           // final 字段
    private final String currency;
    public Money(BigDecimal amount, String currency) {
        this.amount = Objects.requireNonNull(amount);
        this.currency = Objects.requireNonNull(currency);
    }
    public Money add(Money other) {            // 返回新对象，不改自身
        if (!currency.equals(other.currency)) throw new IllegalArgumentException("币种不一致");
        return new Money(amount.add(other.amount), currency);
    }
    public BigDecimal getAmount() { return amount; }    // BigDecimal 本身不可变，可直接返回
    // 无 setter；若字段是可变对象（Date、数组），getter 要返回防御性拷贝
}
// 不可变对象天生线程安全，可自由共享，无需任何同步

// ─── 模式 2：线程封闭（Thread Confinement）───
// 2.1 ThreadLocal（每线程一份副本）
private static final ThreadLocal<SimpleDateFormat> DATE_FORMAT =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));
public String format(Date d) { return DATE_FORMAT.get().format(d); }
// 2.2 局部变量封闭（栈上，天然线程私有）
public int calculate(int a, int b) {
    int temp = a + b;                          // 局部变量在栈帧中，线程私有
    return temp * 2;
}
// 2.3 栈封闭：对象只在方法内创建使用，不逃逸

// ─── 模式 3：线程安全的基础构件（组合而非继承）───
public class SafePoint {
    private int x, y;
    private SafePoint(int[] a) { this.x = a[0]; this.y = a[1]; }
    public SafePoint(SafePoint p) { this(p.get()); }        // 拷贝构造器
    public synchronized int[] get() { return new int[]{x, y}; }   // ★ 原子获取两个字段
    public synchronized void set(int x, int y) { this.x = x; this.y = y; }
}
// 关键：get() 返回数组而非分别返回 x、y，保证「读取一致性快照」

// ─── 模式 4：监控与容器（Monitor Pattern）───
// 所有状态私有，只通过同步方法访问（JavaBean + synchronized）

// ─── 模式 5：读写分离 ───
ReadWriteLock rwLock = new ReentrantReadWriteLock();
public Object read() {
    rwLock.readLock().lock();
    try { return data; } finally { rwLock.readLock().unlock(); }
}
public void write(Object newData) {
    rwLock.writeLock().lock();
    try { data = newData; } finally { rwLock.writeLock().unlock(); }
}

// ─── 模式 6：Copy-On-Write（写时复制）───
private volatile List<Config> configs = Collections.emptyList();
public void update(Config c) {
    synchronized (this) {
        List<Config> newList = new ArrayList<>(configs);     // 复制
        newList.add(c);                                       // 修改副本
        configs = Collections.unmodifiableList(newList);      // ★ volatile 写，原子替换引用
    }
}
public List<Config> getConfigs() { return configs; }          // 读无需加锁
// CopyOnWriteArrayList 就是这个思路

// ─── 模式 7：双检锁（DCL）与 volatile ───
private static volatile Singleton instance;                    // ★ 必须 volatile
public static Singleton getInstance() {
    if (instance == null) {                                     // 第一次检查（无锁快路径）
        synchronized (Singleton.class) {
            if (instance == null) {                             // 第二次检查
                instance = new Singleton();
            }
        }
    }
    return instance;
}
// ✅ 更简单：静态内部类（Holder）或枚举
```

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 以为 `synchronized` 方法锁的是 Class | 不同实例不互斥 | 实例方法锁 `this`，静态方法锁 `Class` |
| 2 | 锁字符串/包装类常量 | 意外阻塞、性能诡异 | `private final Object lock` |
| 3 | 锁对象引用被重新赋值 | 锁失效 | `final` 修饰锁对象 |
| 4 | 临界区内做 IO/RPC | 锁持有时间长，吞吐骤降 | 缩小临界区，锁外做 IO |
| 5 | 加锁顺序不一致 | 死锁 | 固定全局加锁顺序（按 ID 排序） |
| 6 | `Lock.lock()` 写在 try 内 | `unlock` 抛 IllegalMonitorState | `lock()` 在 try 之前 |
| 7 | 忘记 `finally &#123; unlock() &#125;` | 异常后锁永不释放 | 必须 finally |
| 8 | 期望 `synchronized` 可中断 | 无法响应中断 | 用 `lockInterruptibly()` |
| 9 | 单核 CPU 上依赖自旋 | CPU 100% 无进展 | 自旋只在多核有效 |
| 10 | 偏向锁 + `hashCode()` | 锁直接升级，性能下降 | 了解即可（JDK 15 已废弃偏向锁） |
| 11 | 批量撤销偏向锁导致 STW | 偶发的停顿 | JDK 15+ 禁用偏向锁 |
| 12 | 死锁时 jstack 无输出 | 进程假死 | `jstack -F` 强制，或 Arthas `thread -b` |
| 13 | 活锁（互相谦让） | CPU 高但无进展 | 加随机退避时间 |
| 14 | 饥饿（非公平锁） | 某线程长期得不到执行 | 公平锁、缩短临界区 |
| 15 | `Vector`/`Hashtable` 复合操作 | 仍线程不安全 | 外部加锁或换并发容器 |
| 16 | `SimpleDateFormat` 静态共享 | 解析结果错乱 | `DateTimeFormatter`（不可变） |
| 17 | 同步代码块嵌套过深 | 死锁风险 + 难维护 | 拆分、用更高层并发工具 |
| 18 | 在构造器中启动线程 | this 逃逸，看到未初始化对象 | 用工厂方法 + init |
| 19 | 锁的粒度太粗（全局一把锁） | 并发度低 | 分段锁 / ConcurrentHashMap |
| 20 | 锁的粒度太细 | 加锁开销 > 收益，且有复合操作问题 | 权衡，必要时粗化 |
| 21 | 数据库事务死锁 | 事务回滚 | 按固定顺序更新行 + 重试 |
| 22 | 虚拟线程中用 synchronized | pinning，吞吐下降 | JDK 21+ 改用 ReentrantLock |
| 23 | 误以为锁升级可降级 | 期望重量级锁自动变轻 | 锁只升不降（GC STW 除外） |
| 24 | 依赖锁消除优化写代码 | 逃逸分析失效时性能骤降 | 不要依赖 JIT 优化保证正确性 |

---

## 关联笔记

- 上一篇：[[后端/Java基础/并发编程/线程基础与生命周期]]
- 下一篇：[[后端/Java基础/并发编程/volatile与CAS原子类]]
- 相关：[[后端/Java基础/并发编程/Lock与AQS原理]]（Lock 的完整实现）
- 底层：[[后端/JVM/JVM概述与运行时数据区]]（对象内存布局、JMM）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
