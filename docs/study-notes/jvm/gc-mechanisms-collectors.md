---
title: "垃圾回收机制与收集器"
aliases:
  - "GC 原理"
  - "G1 ZGC CMS"
  - "三色标记"
tags:
  - "后端"
  - "java"
  - "jvm"
  - "面试"
category: "后端"
folder: "JVM"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/JVM/JVM概述与运行时数据区]]"
  - "[[后端/JVM/类加载机制与字节码]]"
  - "[[后端/JVM/JVM调优与线上问题排查]]"
created: 2026-09-07
updated: 2026-09-07
---

# 垃圾回收机制与收集器

## 1. 如何判断对象已死

### 1.1 引用计数法（Java 未采用）

```java
// 给对象加一个引用计数器，被引用 +1，引用失效 -1，为 0 即可回收
// 优点：实现简单、判定高效、回收及时（无停顿）
// ★ 致命缺陷：无法解决循环引用

class Node { Object ref; }
Node a = new Node();      // a 计数 = 1
Node b = new Node();      // b 计数 = 1
a.ref = b;                // b 计数 = 2
b.ref = a;                // a 计数 = 2
a = null;                 // a 对象计数 = 1（仍被 b.ref 引用）
b = null;                 // b 对象计数 = 1（仍被 a.ref 引用）
// 两个对象计数都不为 0，但已不可达 → 永远无法回收 → 内存泄漏

// 使用引用计数法的语言：Python、Objective-C/Swift（ARC）、C++ shared_ptr
// Python 的补救：额外的「循环检测器」定期扫描容器对象
```

### 1.2 可达性分析（Reachability Analysis）★★★★★（Java 采用）

**从一系列「GC Roots」出发向下搜索，不可达的对象判定为可回收。**

```
        GC Roots（虚拟机栈中的引用、静态变量、常量、native 引用...）
           │
     ┌─────┴─────┐
     ▼           ▼
   对象A ──→ 对象B          ← 可达，存活
     │
     ▼
   对象C                    ← 可达，存活

   对象D ──→ 对象E          ← ★ 从 GC Roots 不可达，即使 D↔E 互相引用也要回收
     ↑           │
     └───────────┘           （循环引用被正确识别）
```

**GC Roots 包括（必背）：**

| # | GC Root 类型 | 具体位置 | 说明 |
| --- | --- | --- | --- |
| 1 | **虚拟机栈中引用的对象** | 各线程栈帧的**局部变量表** | 方法正在执行，其局部变量引用的对象必然存活 |
| 2 | **方法区中静态变量引用的对象** | 类的 `static` 字段 | `static User user = new User()` |
| 3 | **方法区中常量引用的对象** | 字符串常量池等 | `static final String S = "abc"` |
| 4 | **本地方法栈中 JNI 引用的对象** | native 方法持有的引用 | `GlobalRef`、`LocalRef` |
| 5 | **JVM 内部引用** | 基本类型的 Class 对象、常驻异常对象（NPE、OOM）、系统类加载器 | 不可能被回收 |
| 6 | **同步锁持有的对象** | `synchronized(obj)` 中被锁定的 obj | 锁未释放前不能回收 |
| 7 | **JMXBean、JVMTI 回调、本地代码缓存** | 反映 JVM 内部情况的对象 | — |
| 8 | **分代收集/局部回收时的「临时 GC Roots」** | 如 G1 的 Remembered Set 记录跨 Region 引用 | Minor GC 时把老年代对象也当作 Root |

> 【面试】**为什么 Minor GC 时也要扫描老年代？**
>
> 因为老年代的对象可能引用新生代的对象（如老年代的 List 里 add 了新对象）。如果不扫描老年代，这些新生代对象会被误判为垃圾。全量扫描老年代太慢，所以用 **卡表（Card Table）+ 写屏障（Write Barrier）** 记录「哪些老年代卡页可能引用新生代」，只扫描这些脏卡页。这就是**跨代引用的记忆集（Remembered Set）**机制。

**卡表与写屏障：**

```
卡表（Card Table）：把老年代内存按 512 字节分成一个个「卡页（Card Page）」，
                  用一个 byte 数组记录每个卡页的状态（0=干净，1=脏）
                  
写屏障（Write Barrier）：在对象引用字段赋值前后插入的一小段代码
   // 伪代码：obj.field = value 实际执行为
   cardTable[obj >> 9] = DIRTY;      // ★ 把 obj 所在的卡页标脏（512 = 2^9）
   obj.field = value;

Minor GC 时：只扫描「脏卡页」中的对象作为 GC Roots，而非整个老年代
效果：把 O(老年代大小) 的扫描降为 O(脏卡页数量)
代价：每次引用赋值多一次写操作（约 1~2 条指令），且卡表本身占堆的 1/512
```

### 1.3 finalize 与「对象自救」（了解即可，禁止使用）

```java
// 可达性分析后，不可达的对象并非「立即死亡」，要经历两次标记：
// 第一次标记：可达性分析发现无 GC Roots 相连的引用链
//   ↓
// 判断是否有必要执行 finalize()：
//   - 未覆盖 finalize()，或 finalize() 已被 JVM 调用过 → 视为「没有必要执行」，直接回收
//   - 有必要 → 放入 F-Queue 队列，由低优先级的 Finalizer 线程执行（但不承诺等待）
//   ↓
// 第二次标记：GC 对 F-Queue 中的对象进行小规模标记
//   - 如果在 finalize() 中重新与引用链建立关联（如 this 赋给某个类变量）→ 移出「即将回收」集合
//   - ★ 自救只能生效一次！因为 finalize() 只会被 JVM 调用一次
//   ↓
// 真正回收

public class FinalizeEscapeGC {
    public static FinalizeEscapeGC SAVE_HOOK = null;

    @Override
    protected void finalize() throws Throwable {
        super.finalize();
        System.out.println("finalize 被执行");
        FinalizeEscapeGC.SAVE_HOOK = this;         // ★ 自救：重新挂到静态字段上
    }

    public static void main(String[] args) throws Exception {
        SAVE_HOOK = new FinalizeEscapeGC();

        SAVE_HOOK = null;
        System.gc();
        Thread.sleep(500);                          // finalize 优先级低，等它执行
        System.out.println(SAVE_HOOK != null ? "我还活着" : "我已死");    // "我还活着"

        // 第二次：finalize 已执行过，不再触发 → 自救失败
        SAVE_HOOK = null;
        System.gc();
        Thread.sleep(500);
        System.out.println(SAVE_HOOK != null ? "我还活着" : "我已死");    // "我已死"
    }
}
```

> 【强制】**`finalize()` 是 JDK 9 明确废弃（deprecated for removal）的机制，永远不要用**：
> 1. 执行时机不确定（Finalizer 线程优先级低，可能永远不执行）。
> 2. 影响性能（有 finalize 的对象需要至少两轮 GC 才能回收，且会拖慢整个 Finalizer 队列）。
> 3. 可能导致对象复活，引发难以排查的 bug。
> 4. 异常被吞（finalize 中抛异常会被忽略，线程不终止）。
> 5. 安全问题（Finalizer Attack：子类通过 finalize 获取未完全构造的对象）。
>
> **正确替代**：资源清理用 `try-with-resources`（`AutoCloseable`）；确实需要「兜底清理」用 **`java.lang.ref.Cleaner`**（JDK 9+，基于虚引用，独立线程，比 finalize 安全可控）。
>
> ```java
> // Cleaner 示例（JDK 9+）
> public class Resource implements AutoCloseable &#123;
>     private static final Cleaner CLEANER = Cleaner.create();
>     private final Cleaner.Cleanable cleanable;
>     private final NativeHandle handle;
>
>     public Resource() &#123;
>         this.handle = openNative();
>         // ★ 清理逻辑放在独立的静态类中（不能引用 Resource 实例，否则永不回收！）
>         this.cleanable = CLEANER.register(this, new CleanupAction(handle));
>     &#125;
>
>     private static class CleanupAction implements Runnable &#123;      // ★ 必须 static
>         private final NativeHandle h;
>         CleanupAction(NativeHandle h) &#123; this.h = h; &#125;
>         @Override public void run() &#123; closeNative(h); &#125;           // 兜底清理
>     &#125;
>
>     @Override public void close() &#123; cleanable.clean(); &#125;           // 主动清理（推荐路径）
> &#125;
> // DirectByteBuffer 的堆外内存释放就是用 Cleaner（JDK 8 是 sun.misc.Cleaner）
> ```

### 1.4 四种引用类型 ★★★★★

| 引用类型 | 类 | 回收时机 | 用途 | 典型应用 |
| --- | --- | --- | --- | --- |
| **强引用（Strong）** | 普通赋值 `Object o = new Object()` | **永不回收**（只要可达，宁可 OOM） | 常规对象引用 | 几乎所有代码 |
| **软引用（Soft）** | `SoftReference&lt;T&gt;` | **内存不足时**才回收（OOM 之前） | **内存敏感的缓存** | 图片缓存、Guava `softValues()` |
| **弱引用（Weak）** | `WeakReference&lt;T&gt;` | **下次 GC 就回收**（不管内存够不够） | 不希望影响对象生命周期的引用 | **`ThreadLocalMap.Entry` 的 key**、`WeakHashMap` |
| **虚引用（Phantom）** | `PhantomReference&lt;T&gt;` | 随时回收，**无法通过它获取对象**（get() 永远返回 null） | **跟踪对象被回收的时机**，做资源清理 | `DirectByteBuffer` 的 `Cleaner`（堆外内存释放） |

```java
import java.lang.ref.*;

// ─── 强引用 ───
Object strong = new Object();          // 只要 strong 存在，对象就不回收
strong = null;                          // ★ 断掉引用后才可回收

// ─── 软引用：内存不足才回收（适合缓存）───
SoftReference<byte[]> soft = new SoftReference<>(new byte[10 * 1024 * 1024]);   // 10MB
System.out.println(soft.get() != null);    // true
System.gc();                                // 内存充足，不回收
System.out.println(soft.get() != null);    // true
// 分配一个大对象制造内存压力
byte[] pressure = new byte[500 * 1024 * 1024];
System.out.println(soft.get() != null);    // ★ false（内存不足时被回收）
// 运行参数：-Xmx50m 可轻松复现

// ─── 弱引用：GC 就回收 ───
WeakReference<Object> weak = new WeakReference<>(new Object());
System.out.println(weak.get() != null);    // true
System.gc();
Thread.sleep(100);
System.out.println(weak.get() != null);    // ★ false（必然被回收）

// WeakHashMap：key 是弱引用，key 无强引用时条目自动清理
Map<Object, String> cache = new WeakHashMap<>();
Object key = new Object();
cache.put(key, "value");
key = null;                                 // 断掉强引用
System.gc();
System.out.println(cache.size());           // 0（条目被自动移除）
// ⚠️ 注意：如果 value 强引用 key，则 key 永远不会被回收（内存泄漏）

// ─── 虚引用：只用于接收「对象已被回收」的通知 ───
ReferenceQueue<Object> queue = new ReferenceQueue<>();
PhantomReference<Object> phantom = new PhantomReference<>(new Object(), queue);
System.out.println(phantom.get());          // ★ null（永远拿不到对象）
System.gc();
Reference<?> polled = queue.poll();          // 从队列取出被回收的通知
System.out.println(polled == phantom);       // true → 可以执行资源清理逻辑

// Cleaner 就是基于虚引用实现的（JDK 9+ 替代 finalize）
```

**ReferenceQueue 的作用：**

```java
// 引用对象可以关联一个 ReferenceQueue：当引用指向的对象被回收后，
// 这个 Reference 对象本身会被放入队列 → 应用可以感知「谁被回收了」并做清理
ReferenceQueue<Object> rq = new ReferenceQueue<>();
SoftReference<Object> ref = new SoftReference<>(obj, rq);
// 对象被回收后
Reference<?> r = rq.poll();        // 返回 ref
// 应用可以借此清理关联的数据结构（WeakHashMap 的 expungeStaleEntries 就是这么做的）
```

**软引用 vs 弱引用做缓存的选择：**

| | SoftReference 缓存 | WeakReference 缓存 | Caffeine/Guava Cache |
| --- | --- | --- | --- |
| 回收时机 | OOM 前才回收 | GC 就回收 | 按大小/时间/权重 |
| 缓存命中率 | **高**（尽量留着） | 低（一 GC 就没了） | 可控（W-TinyLFU 算法，命中率高） |
| 内存风险 | 高（Full GC 频繁、STW 长） | 低 | 低 |
| 生产推荐 | ❌ 不推荐 | ❌ | ✅ **强烈推荐** |

> 【实践】**不要用 SoftReference 做生产缓存**：软引用只在 OOM 前回收，会导致堆长期高水位、Full GC 频繁、STW 变长，性能极差。用 **Caffeine**（`maximumSize` + `expireAfterWrite`）替代。

## 2. 垃圾回收算法 ★★★★★

### 2.1 标记-清除（Mark-Sweep）

```
标记阶段：从 GC Roots 遍历，标记所有存活对象
清除阶段：遍历整个区域，回收未被标记的对象

回收前：  [A][B][C][D][E][F][G][H]     B、D、F 是垃圾
标记后：  [A][ ][C][ ][E][ ][G][H]
清除后：  [A][空][C][空][E][空][G][H]   ★ 产生大量不连续的内存碎片
```

| 优点 | 缺点 |
| --- | --- |
| 实现简单 | **产生内存碎片**（大对象分配失败 → 提前触发 GC） |
| 不需要移动对象（无 STW 的引用更新） | **效率不稳定**（耗时与对象数量成正比，存活越多越慢） |
| 适合存活率高的区域 | 分配时需要维护空闲列表（Free List），速度慢 |

**使用者**：CMS（老年代）、ZGC/Shenandoah 的部分思想。

### 2.2 标记-复制（Mark-Copy）★★★★★（新生代标准算法）

```
把内存分成两块（A、B），只用一块，GC 时把存活对象复制到另一块，然后整块清空

回收前：  From 区 [A][B][C][D][E]        To 区 [          ]（空）
              ↑ B、D 是垃圾
复制后：  From 区 [          ]（清空）    To 区 [A][C][E]（紧凑排列）
              ★ 无碎片，分配只需移动指针（极快）
然后 From 和 To 角色互换
```

| 优点 | 缺点 |
| --- | --- |
| **无内存碎片** | **可用内存减半**（改进：Eden + 2 Survivor = 8:1:1，只浪费 10%） |
| 分配高效（指针碰撞） | 存活率高时复制成本大 |
| **效率与存活对象数量成正比**（存活少 = 快） | 需要额外空间做「分配担保」 |

**为什么新生代用复制算法？** 因为「弱分代假说」——新生代约 98% 的对象活不过第一轮 GC，只需复制极少量存活对象，效率极高。

**Survivor 的 8:1:1 设计（IBM 研究结论）：**

```
如果 Survivor 是 1:1（各 50%），浪费太大
IBM 研究发现：新生代中 98% 的对象活不过第一轮 → 不需要 50% 的备用空间
方案：Eden : S0 : S1 = 8 : 1 : 1
     - 对象在 Eden + S0（一个 Survivor）中分配，共 90% 空间可用
     - Minor GC 时，Eden + S0 的存活对象复制到 S1（10% 空间）
     - 如果 S1 装不下 → ★ 分配担保（Handle Promotion）：直接晋升老年代
     - 然后清空 Eden 和 S0，S0 与 S1 角色互换
```

**分配担保（Handle Promotion）：**

```java
// Minor GC 前，JVM 必须检查「老年代最大可用连续空间是否大于新生代对象总空间」
// - 是 → 执行 Minor GC（安全）
// - 否 → 检查 -XX:+HandlePromotionFailure 是否允许担保失败
//         - 允许 → 检查「老年代最大可用连续空间是否大于历次晋升的平均大小」
//                   - 大于 → 尝试 Minor GC（有风险）
//                   - 小于 → 改为 Full GC
//         - 不允许 → 改为 Full GC
// JDK 6u24+ 后规则简化：只要「老年代连续空间 > 新生代对象总大小 或 > 历次晋升平均大小」就 Minor GC，否则 Full GC
// （HandlePromotionFailure 参数在 JDK 6u24 后已不再起作用）
```

### 2.3 标记-整理（Mark-Compact）

```
标记阶段：同标记-清除
整理阶段：把存活对象向一端移动，然后清理掉边界以外的内存

回收前：  [A][B][C][D][E]      B、D 是垃圾
标记后：  [A][ ][C][ ][E]
整理后：  [A][C][E][   空闲   ]   ★ 无碎片，且不浪费空间
```

| 优点 | 缺点 |
| --- | --- |
| **无碎片** | **移动对象成本高**（需要更新所有引用，且必须 STW） |
| **不浪费空间** | 效率低于标记-清除（多了移动步骤） |
| 适合存活率高的区域 | — |

**使用者**：Serial Old、Parallel Old、G1 的混合回收（部分）。

### 2.4 三种算法对比与分代收集

| 算法 | 碎片 | 空间浪费 | 效率 | 存活率高时 | 移动对象 | 适用区域 |
| --- | --- | --- | --- | --- | --- | --- |
| 标记-清除 | **有** | 无 | 中 | 中 | ❌ | CMS 老年代 |
| 标记-复制 | 无 | **有（10%）** | **高（存活少时）** | **低** | ✅ | **新生代** |
| 标记-整理 | 无 | 无 | 低 | **高** | ✅ | **老年代** |

**分代收集理论（Generational Collection）的三大假说：**

1. **弱分代假说**：绝大多数对象都是朝生夕死的。
2. **强分代假说**：熬过越多次 GC 的对象越难以消亡。
3. **跨代引用假说**：跨代引用相对于同代引用只占极少数（所以用卡表/记忆集而非全扫描）。

```
基于这三个假说的设计：
  新生代（Eden + 2 Survivor）：对象朝生夕死 → 复制算法（存活少，复制快）→ Minor GC 频繁但快
  老年代：对象存活率高 → 标记-整理/清除（不浪费空间）→ Major GC 少但慢
  
  Minor GC / Young GC：只回收新生代（频繁、快、STW 短）
  Major GC / Old GC：只回收老年代（部分收集器如 CMS 支持）
  Mixed GC：回收新生代 + 部分老年代（★ G1 特有）
  Full GC：回收整个堆 + 方法区（最慢，★ 应极力避免）
```

> 【术语澄清】**Major GC 与 Full GC 经常被混用**，严格来说：
> - **Minor GC / Young GC**：只收集新生代。
> - **Major GC / Old GC**：只收集老年代（**只有 CMS 有单独的老年代收集**）。
> - **Mixed GC**：收集整个新生代 + 部分老年代（**只有 G1 有这个概念**）。
> - **Full GC**：收集整个堆（新生代 + 老年代）+ 方法区，是最重量级的。
> 
> 日常交流中「Major GC」常被当作「Full GC」的同义词，面试时最好先明确定义。

## 3. 垃圾收集器 ★★★★★

### 3.1 收集器全景与组合关系

```
新生代收集器                    老年代收集器
┌──────────────┐             ┌──────────────────┐
│ Serial       │─────────────│ Serial Old       │
│ (单线程，复制) │             │ (单线程，标记-整理) │
└──────────────┘             └──────────────────┘
       ↕ 可搭配                        ↕
┌──────────────┐             ┌──────────────────┐
│ ParNew       │─────────────│ CMS              │
│ (多线程，复制) │             │ (并发，标记-清除)  │
└──────────────┘             └──────────────────┘
       ↕                                ↕
┌──────────────┐             ┌──────────────────┐
│ Parallel     │─────────────│ Parallel Old     │
│ Scavenge     │             │ (多线程，标记-整理) │
│ (多线程，复制) │             └──────────────────┘
└──────────────┘

─── 整堆收集器（不分代或弱分代）───
┌────────────────────────────────────────────┐
│ G1（JDK 7u4+，JDK 9 起默认）                  │  Region 化 + 可预测停顿
│ ZGC（JDK 11 试验，15 正式；JDK 21 分代 ZGC）    │ ★ 停顿 < 1ms，TB 级堆
│ Shenandoah（OpenJDK 12+，Red Hat）           │ ★ 停顿 < 10ms，Brooks 指针
│ Epsilon（JDK 11+）                           │ 不回收（No-Op GC，用于性能测试）
└────────────────────────────────────────────┘

合法组合（连线）：
Serial     + Serial Old / CMS
ParNew     + Serial Old / CMS
Parallel Scavenge + Serial Old / Parallel Old
★ 注意：Parallel Scavenge 不能配 CMS！（两者架构不兼容）
G1 / ZGC / Shenandoah：独立管理整个堆，不与其他搭配
```

### 3.2 Serial / Serial Old（单线程）

```bash
-XX:+UseSerialGC        # 新生代 Serial + 老年代 Serial Old
```

- **单线程**收集，GC 时**必须 STW**（Stop The World，暂停所有用户线程）。
- 简单高效（无线程切换开销），**在单核 CPU 上反而是最优的**。
- **适用场景**：客户端应用（Client 模式默认）、小内存应用（几十~几百 MB）、容器中的微服务（内存 < 2GB）、GraalVM Native Image 的默认 GC。
- 是 G1/ZGC 的「后备」收集器（`-XX:+UseSerialGC` 在某些降级场景生效）。

### 3.3 ParNew（Serial 的多线程版）

```bash
-XX:+UseParNewGC                 # 新生代 ParNew + 老年代 Serial Old
-XX:ParallelGCThreads=4          # GC 线程数（默认 = CPU 核数，>8 时按公式计算）
```

- Serial 的多线程版本，能配合 **CMS** 工作。
- **JDK 9 起被标记废弃**，JDK 14 移除（因为 CMS 也被移除了）。
- 在单核 CPU 上性能不如 Serial（线程切换开销）。

### 3.4 Parallel Scavenge / Parallel Old（吞吐量优先）★★★★

```bash
-XX:+UseParallelGC               # ★ JDK 8 的默认 GC（Parallel Scavenge + Parallel Old）
-XX:+UseParallelOldGC            # JDK 8 中 -XX:+UseParallelGC 会自动启用
-XX:ParallelGCThreads=8          # GC 线程数
-XX:MaxGCPauseMillis=200         # ★ 最大 GC 停顿时间目标（毫秒）
-XX:GCTimeRatio=99               # ★ 吞吐量目标：GC 时间占比 = 1/(1+99) = 1%
-XX:+UseAdaptiveSizePolicy       # ★ 自适应调节（默认开启，自动调整 Eden/Survivor/晋升阈值）
```

**核心目标：吞吐量（Throughput）= 用户代码运行时间 / (用户代码时间 + GC 时间)**

```
吞吐量 = 1 - GC时间占比
GCTimeRatio=99 → 允许 GC 时间占 1/(1+99) = 1%
MaxGCPauseMillis 与 GCTimeRatio 是「矛盾」的目标：
  要停顿短 → 每次只回收少量内存 → GC 次数多 → 吞吐量下降
  要吞吐高 → 每次回收大量内存 → 单次停顿长
Parallel Scavenge 提供「自适应策略」让 JVM 自己权衡（UseAdaptiveSizePolicy）
```

**适用场景：**
- **后台计算型任务**（批处理、科学计算、数据分析）—— 不关心单次响应延迟，关心总完成时间。
- **不需要交互的服务**（定时任务、消息处理的非实时链路）。
- JDK 8 的默认选择，堆 < 8GB 时表现良好。

**不适用：** 面向用户的 Web 服务（需要低延迟响应）→ 应该用 G1/ZGC。

### 3.5 CMS（Concurrent Mark Sweep）★★★★★（已废弃但必考）

**目标：最短回收停顿时间。基于「标记-清除」算法，是第一个真正意义上的「并发收集器」。**

```bash
-XX:+UseConcMarkSweepGC                    # 启用 CMS（新生代自动用 ParNew）
-XX:CMSInitiatingOccupancyFraction=75      # ★ 老年代使用率达 75% 时触发 CMS
-XX:+UseCMSInitiatingOccupancyOnly         # ★ 只按这个阈值触发（禁用 JVM 自适应）
-XX:+CMSScavengeBeforeRemark               # 重新标记前先做一次 Minor GC（减少标记量）
-XX:CMSFullGCsBeforeCompaction=0           # 多少次 Full GC 后做一次压缩整理（治碎片）
-XX:+CMSParallelRemarkEnabled              # 并行重新标记
-XX:CMSInitiatingPermOccupancyFraction   # JDK 7 及以前的永久代阈值（JDK 8 无效）
-XX:+CMSClassUnloadingEnabled              # 允许卸载类（回收永久代/元空间）
```

**CMS 的四个阶段（★ 必背）：**

```
① 初始标记（Initial Mark）       ★ STW（很短）
   只标记 GC Roots 能【直接】关联到的对象（一层引用）
   ↓
② 并发标记（Concurrent Mark）    ☆ 与用户线程并发（耗时最长）
   从 GC Roots 开始遍历整个对象图（可达性分析）
   ↓
③ 重新标记（Remark）             ★ STW（比初始标记长，比并发标记短）
   修正「并发标记期间因用户程序运行而变动的标记记录」
   ★ 使用【增量更新（Incremental Update）】：记录被删除的引用（黑 → 灰/白）
   ↓
④ 并发清除（Concurrent Sweep）   ☆ 与用户线程并发
   清除死亡对象（标记-清除，不移动对象）
```

```
用户线程: ────────┐  ┌──────────────────────┐  ┌──────┐  ┌──────────────────
                 │  │                      │  │      │  │
GC 线程:         └──┘                      └──┘      └──┘
                 ①STW  ②并发标记（长）        ③STW  ④并发清除
                初始标记                    重新标记
```

**CMS 的三大缺陷：**

| 缺陷 | 说明 | 后果 |
| --- | --- | --- |
| **① CPU 敏感** | 并发阶段占用 CPU 资源（默认 GC 线程数 = (CPU核数 + 3) / 4） | CPU 核数少时，用户程序明显变慢（吞吐下降 25%+） |
| **② 浮动垃圾 + Concurrent Mode Failure** ★ | 并发清理阶段用户线程还在产生新垃圾（浮动垃圾），必须预留空间。若预留不足 → **CMS 失败，退化为 Serial Old 单线程 Full GC** | **STW 时间暴涨**（几秒到几十秒），线上事故常见原因 |
| **③ 内存碎片** | 标记-清除不整理，长期运行产生大量碎片 | 大对象无法分配 → 提前触发 Full GC（用 `-XX:+UseCMSCompactAtFullCollection` 缓解） |

**触发 Concurrent Mode Failure 的原因：**
1. `CMSInitiatingOccupancyFraction` 设得太高（如 92%），预留空间不足。
2. 老年代对象增长过快（大对象频繁晋升、内存泄漏）。
3. 并发标记/清除阶段耗时过长（堆大、CPU 少）。

Concurrent Mode Failure 的典型日志（★ 生产常见）：

```
[GC (Allocation Failure) ...
[CMS-concurrent-mark: 1.2/1.3 secs]
[Full GC (Allocation Failure) [CMS: (concurrent mode failure): 2000K->1900K(2048K), 8.5 secs]
                              ↑ ★ 退化为 Serial Old，STW 8.5 秒！
```

**解决**：调低 `CMSInitiatingOccupancyFraction`（70~75%）+ 开启 `UseCMSInitiatingOccupancyOnly`，或**换 G1/ZGC**。

> 【版本状态】**CMS 在 JDK 9 被标记废弃（JEP 291），JDK 14 被彻底移除（JEP 363）**。官方替代是 **G1**（JDK 9 起默认）和 **ZGC/Shenandoah**（低延迟需求）。
>
> 但**面试必考**，且**大量 JDK 8 存量项目仍在用 CMS**，必须掌握。

### 3.6 G1（Garbage-First）★★★★★（JDK 9+ 默认）

**G1 是「面向服务端应用」的收集器，目标是在「可控的停顿时间」内获得尽可能高的吞吐量。**

```bash
-XX:+UseG1GC                                  # 启用 G1（JDK 9+ 默认）
-XX:MaxGCPauseMillis=200                      # ★ 期望最大停顿时间（默认 200ms，不要设太小）
-XX:G1HeapRegionSize=4m                       # Region 大小（1~32MB，必须是 2 的幂，默认按堆大小自适应）
-XX:InitiatingHeapOccupancyPercent=45         # ★ IHOP：堆使用率达 45% 触发并发标记周期
-XX:G1NewSizePercent=5                        # 新生代最小占比（默认 5%）
-XX:G1MaxNewSizePercent=60                    # 新生代最大占比（默认 60%）
-XX:G1HeapWastePercent=5                      # 允许浪费的堆百分比（低于此值不做 Mixed GC）
-XX:G1MixedGCCountTarget=8                    # Mixed GC 的目标次数
-XX:G1MixedGCLiveThresholdPercent=85          # 存活率超过 85% 的 Region 不参与 Mixed GC
-XX:G1ReservePercent=10                       # 预留空间（防 to-space exhausted）
-XX:ConcGCThreads=4                           # 并发标记线程数
-XX:ParallelGCThreads=8                       # STW 阶段的并行线程数
-XX:+PrintAdaptiveSizePolicy                  # 打印 G1 的自适应决策（调试用）
```

**G1 的核心设计：Region 化堆布局**

```
G1 把堆划分为 2048 个左右大小相等的 Region（1~32MB），
每个 Region 可以「动态地」扮演 Eden / Survivor / Old / Humongous 角色

┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│ E  │ E  │ S  │ O  │ O  │ H  │ E  │ O  │    │ O  │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ O  │    │ E  │ O  │ H  │ O  │    │ S  │ O  │ E  │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
 E = Eden    S = Survivor    O = Old    H = Humongous（大对象，超过 Region 的 50%）
 空白 = Free（空闲 Region）

★ 特点：
1. 物理上不再连续划分新生代/老年代，但逻辑上仍分代
2. Humongous Region 专门存放大对象（连续多个 Region 存储超大对象）
3. G1 会跟踪每个 Region 的「回收价值」（能回收多少空间 / 需要多少时间）
4. ★ 优先回收价值最大的 Region（这就是 "Garbage-First" 的由来）
```

**Remembered Set（RSet）与 Card Table：**

```
问题：G1 做 Mixed GC 时只回收部分 Region，如何知道「其他 Region 有没有引用本 Region 的对象」？
      如果全堆扫描，就失去了「部分回收」的意义

解决：每个 Region 有一个 RSet（Remembered Set），记录「谁引用了我」（points-into）
      RSet 本质是一个 Hash 表：key = 其他 Region 的地址，value = 卡页索引集合

写屏障（Post-Write Barrier）：
  obj.field = value;
  ↓ 实际执行
  if (跨 Region 引用 && 不是 young→young) {
      把 (obj 所在 Region, field 所在卡页) 记录到 value 所在 Region 的 RSet 中
  }

代价：RSet 可能占用堆的 1%~20% 内存（G1 的空间开销主要来源）
```

**G1 的回收过程（三种模式）：**

```
─── ① Young GC（新生代回收，全程 STW）───
触发：Eden Region 用满
过程：并行复制 Eden + Survivor 的存活对象到新的 Survivor（或晋升到 Old Region）
停顿：与新生代大小成正比（G1 会动态调整新生代大小来满足 MaxGCPauseMillis）

─── ② 并发标记周期（Concurrent Marking Cycle）───
触发：堆占用达到 IHOP（默认 45%）
  ① 初始标记（Initial Mark）        ★ STW（借助 Young GC 顺便完成，很快）
     标记 GC Roots 直接可达的对象，并修改 TAMS（Top at Mark Start）指针
  ② 根区域扫描（Root Region Scan）   ☆ 并发
     扫描 Survivor 区中引用的老年代对象（必须在下次 Young GC 前完成）
  ③ 并发标记（Concurrent Mark）      ☆ 并发（耗时最长）
     遍历整个对象图，用 SATB（Snapshot-At-The-Beginning）算法处理并发变动
     ★ 发现空 Region 会立即回收（这就是 G1 的「即时回收」优势）
  ④ 重新标记（Remark）               ★ STW
     处理 SATB 缓冲区中记录的引用变动
  ⑤ 清理（Cleanup）                  ★ 部分 STW
     统计每个 Region 的存活率，排序（CSet 候选）
     完全空的 Region 直接回收（重置 RSet）

─── ③ Mixed GC（混合回收，STW）───
触发：并发标记完成后
过程：回收【全部新生代 Region】+【回收价值最高的部分老年代 Region】
     ★ 不是回收全部老年代！根据 MaxGCPauseMillis 和 Region 存活率挑选
     用「标记-复制」算法（无碎片）
可能连续执行多次 Mixed GC，直到老年代垃圾比例低于 G1HeapWastePercent

─── ④ Full GC（兜底，★ 应该极力避免）───
触发：Mixed GC 跟不上分配速度 / to-space exhausted（复制时没有空闲 Region）
过程：★ JDK 10 之前是【单线程】标记-整理（极慢！）
     ★ JDK 10+ 改为【多线程】并行 Full GC（JEP 307，大幅改善）
```

**SATB（Snapshot-At-The-Beginning）vs CMS 的增量更新（★ 高频面试）：**

```
并发标记时，用户线程在同时修改引用关系，会导致「对象消失」（漏标）问题：

漏标的两个充要条件（同时满足才会漏）：
  条件 1：赋值器插入了一条或多条「从黑色对象到白色对象」的新引用
  条件 2：赋值器删除了全部「从灰色对象到该白色对象」的直接或间接引用

破坏条件 1 → 【增量更新 Incremental Update】（CMS 采用）
  当黑色对象插入新引用到白色对象时，用【写后屏障】记录这个引用，
  并把黑色对象「降级」为灰色，重新扫描
  → 重新标记阶段要重新扫描这些黑色对象（STW 时间较长）

破坏条件 2 → 【原始快照 SATB】（G1 采用）
  当灰色对象要删除到白色对象的引用时，用【写前屏障 pre-write barrier】
  把「即将被删除的引用」记录到 SATB 队列，标记时把这个白色对象当作「仍存活」处理
  → ★ 相当于按「标记开始那一刻的对象图快照」来标记
  → 重新标记只需处理 SATB 队列（比 CMS 的增量更新快得多）
  → 代价：可能产生「浮动垃圾」（快照后变成垃圾的对象本轮不回收，下轮再收）
```

| 对比 | CMS（增量更新） | G1（SATB） |
| --- | --- | --- |
| 屏障类型 | **写后屏障**（post-write） | **写前屏障**（pre-write） |
| 记录内容 | 新增的「黑 → 白」引用 | 被删除的「灰 → 白」引用 |
| 重新标记耗时 | **长**（要重新扫描降级的黑色对象） | **短**（只处理 SATB 队列） |
| 浮动垃圾 | 少 | **多**（快照后的垃圾本轮不收） |
| 适用 | 堆较小、Region 化不需要 | 大堆、Region 化（RSet 维护也用写屏障，可复用） |

**G1 的「可预测停顿」模型：**

```
G1 会跟踪每个 Region 的：
  - 存活对象数量、回收耗时（滑动平均 + 衰减均值 Decaying Average）
  - RSet 的脏卡数量

回收时按 MaxGCPauseMillis 预算，选择「回收价值最高」（垃圾最多、耗时最少）的 Region 组成 CSet
→ 实现「在指定停顿时间内回收尽可能多的垃圾」

⚠️ MaxGCPauseMillis 不要设太小（如 20ms）：
  G1 为了满足目标会把新生代缩得很小 → Young GC 极其频繁 → 吞吐量暴跌
  官方建议：不小于 100ms，通常 200ms 是好的起点
```

**G1 的优缺点：**

| 优点 | 缺点 |
| --- | --- |
| **可控的停顿时间**（MaxGCPauseMillis） | **内存占用高**（RSet 可占堆的 1%~20%） |
| **无碎片**（标记-复制） | **写屏障开销大**（要维护 RSet + SATB，比 CMS 重 2~3 倍） |
| 大堆表现好（6GB~几十 GB） | 小堆（< 4GB）性能可能不如 Parallel/CMS |
| 可预测的回收（Region 价值排序） | Full GC 在 JDK 10 前是单线程（灾难） |
| JDK 9+ 默认，生态成熟 | 参数多，调优复杂 |

### 3.7 ZGC ★★★★★（JDK 15 正式，JDK 21 分代 ZGC）

**目标：亚毫秒级停顿（< 1ms），支持 TB 级堆，且停顿时间不随堆大小增长。**

```bash
-XX:+UseZGC                        # 启用（JDK 15+ 生产可用）
-XX:+ZGenerational                 # ★ JDK 21：启用分代 ZGC（性能大幅提升）
                                   #   JDK 23 起分代 ZGC 成为默认，非分代被移除
-XX:SoftMaxHeapSize=4g             # 软上限（尽量不超过，但可临时突破）
-XX:ConcGCThreads=4                # 并发 GC 线程数
-XX:+ZUncommit                     # 归还未使用的内存给 OS（默认开启）
-XX:ZCollectionInterval=120        # 至少每 120 秒做一次 GC（防止长期不 GC）
-XX:-ZProactive                    # 关闭主动 GC
```

**ZGC 的三大核心技术：**

```
─── ① 染色指针（Colored Pointers）★★★ ───
在 64 位指针中「借用」几位来存储 GC 元数据（而非存在对象头里）

 63        47 46 45 44 43                          0
┌────────────┬──┬──┬──┬──┬──────────────────────────┐
│  未使用(17)  │F │R │M0│M1│     对象地址(44位=16TB)    │
└────────────┴──┴──┴──┴──┴──────────────────────────┘
  F = Finalizable（是否只能通过 finalize 到达）
  R = Remapped（是否已完成重映射）
  M0/M1 = Marked0/Marked1（两轮标记的标记位，交替使用）

优势：
  - GC 信息在指针上，判断对象状态【无需访问对象内存】→ 极快
  - 支持「自愈（self-healing）」：读取引用时若发现是旧地址，CPU 陷阱处理后直接修正
局限：
  - 需要 64 位系统，且地址空间限制在 16TB（44 位）
  - 不支持 32 位 JVM、不支持压缩指针（因为指针被占用了）

─── ② 读屏障（Load Barrier / Read Barrier）★★★ ───
ZGC 用的是【读屏障】而非写屏障（与 G1/CMS 相反）

  Object o = obj.field;      // 源码
  ↓ 实际插入
  Object o = obj.field;
  if ((o & BAD_MASK) != 0) {          // ★ 检查指针的染色位是否「坏」
      o = slow_path_remap(o);          // 是 → 修正为最新地址（自愈）
      obj.field = o;                   // 把修正后的值写回（下次就快了）
  }

作用：在【并发转移对象】的同时，应用线程读到旧地址时能自动修正到新地址
     → ★ 这就是「并发转移（Concurrent Relocation）」得以实现的关键
     → 不需要 STW 来更新所有引用！

代价：每次读引用多几条指令（约 4% 的吞吐量损失）

─── ③ 内存多重映射（Multi-Mapping）───
把同一块物理内存映射到三个不同的虚拟地址（对应 M0、M1、Remapped 三种染色视图）
好处：无论指针处于哪个染色状态，都能访问到同一份数据
```

**ZGC 的回收过程（几乎全程并发）：**

```
① 并发标记（Concurrent Mark）        ☆ 并发
   遍历对象图，染色指针标记
   ┌ 两个极短的 STW 点（各 < 10μs，且★ 与堆大小无关）：
   │  - Pause Mark Start：扫描 GC Roots（栈、静态变量）
   │  - Pause Mark End：处理剩余的 SATB 缓冲
② 并发预备重分配（Concurrent Prepare for Relocate）
   ★ 一个 STW 点（< 1ms）：选择要回收的 Region（Relocation Set），扫描其根引用
③ 并发重分配（Concurrent Relocate）   ☆ 并发
   ★ 把存活对象复制到新 Region（同时应用线程通过读屏障自愈）
④ 并发重映射（Concurrent Remap）      ☆ 并发
   修正全堆中指向旧地址的引用（可延迟到下一轮标记中顺便完成）

★ 关键：ZGC 的停顿时间只与 GC Roots 数量（线程栈大小）有关，与堆大小【完全无关】
   → 16GB 堆和 16TB 堆的停顿时间都是 < 1ms
```

**ZGC vs G1 vs CMS：**

| 对比 | CMS | G1 | **ZGC** |
| --- | --- | --- | --- |
| 最大停顿 | 几百 ms~几秒（CMF 时） | 可控（几十~几百 ms） | **< 1ms** ★ |
| 停顿与堆大小关系 | 相关 | 相关 | **无关** ★ |
| 支持堆大小 | < 8GB | 6GB~几十 GB | **8MB~16TB** ★ |
| 算法 | 标记-清除 | 标记-复制（Region） | 标记-复制（Region） |
| 碎片 | **有** | 无 | 无 |
| 屏障 | 写后屏障 | 写前屏障（SATB） | **读屏障 + 染色指针** |
| 分代 | 是 | 是 | JDK 21 起支持（**分代 ZGC**） |
| 吞吐量 | 中 | 中高 | **略低**（约 5~10% 损失） |
| 内存占用 | 低 | **高**（RSet 1~20%） | 中（染色指针无需 RSet） |
| 压缩指针 | ✅ | ✅ | ❌ **不支持**（指针位被占用） |
| 适用 | 已废弃 | **通用默认** | **超大堆 + 超低延迟** |

**分代 ZGC（JDK 21）的意义：**

```
非分代 ZGC 的问题：每次 GC 都扫描全堆 → 短命对象被反复扫描，CPU 开销大
分代 ZGC（-XX:+ZGenerational）：
  - 引入新生代/老年代，短命对象只在新生代回收（弱分代假说）
  - 吞吐量提升约 10%，内存占用降低，分配停滞（Allocation Stall）大幅减少
  - JDK 23 起成为默认，非分代模式被移除
```

### 3.8 Shenandoah

```bash
-XX:+UseShenandoahGC               # OpenJDK 12+（Red Hat 主导，Oracle JDK 不含）
```

- 与 ZGC 目标相同（低停顿 < 10ms），实现思路不同。
- 早期用 **Brooks Pointer**（每个对象头加一个转发指针）实现并发转移；**2.0 后改用染色指针 + 读屏障**（与 ZGC 趋同）。
- 支持 **LRPM（Low Pause Marking）**、**Elastic Heap**（弹性堆，归还未用内存）。
- JDK 13+ 支持分代实验特性。
- 主要在 OpenJDK 发行版（Red Hat、Corretto、Zulu）中可用。

### 3.9 收集器选型指南 ★★★★★

| 场景 | 推荐 | 理由 |
| --- | --- | --- |
| 客户端/桌面应用、小内存（< 2GB） | **Serial** | 单线程无切换开销，简单高效 |
| 后台批处理、科学计算（吞吐优先） | **Parallel Scavenge + Parallel Old** | JDK 8 默认，吞吐量最高 |
| 通用 Web 服务（JDK 8） | **G1**（堆 > 6GB）或 **CMS**（堆 < 6GB，但要注意 CMF） | G1 停顿可控 |
| 通用 Web 服务（JDK 9~17） | **G1**（默认） | 成熟稳定，调优资料多 |
| 超大堆（> 32GB）+ 低延迟 | **ZGC**（JDK 17+） | 停顿 < 1ms 且不随堆增长 |
| 金融交易、实时计算、游戏服务器 | **ZGC** 或 **Shenandoah** | 亚毫秒停顿 |
| JDK 21+ 新项目 | **分代 ZGC** 或 **G1** | 分代 ZGC 综合性能最优 |
| Serverless / 短生命周期任务 | **Serial** 或 **Epsilon**（不回收） | 启动快，无需 GC 优化 |
| GraalVM Native Image | **Serial GC**（默认）/ G1（企业版） | AOT 编译，无 JIT profile |

**JDK 各版本的默认 GC：**

| JDK 版本 | 默认 GC |
| --- | --- |
| JDK 8 | **Parallel Scavenge + Parallel Old** |
| JDK 9 ~ JDK 22 | **G1** |
| JDK 23+ | G1（默认）/ **分代 ZGC**（若显式启用 UseZGC） |

```bash
# 切换 GC（互斥，只能选一个）
-XX:+UseSerialGC          # Serial + Serial Old
-XX:+UseParallelGC        # Parallel Scavenge + Parallel Old
-XX:+UseConcMarkSweepGC   # ParNew + CMS（JDK 14 移除）
-XX:+UseG1GC              # G1
-XX:+UseZGC               # ZGC
-XX:+UseShenandoahGC      # Shenandoah
-XX:+UseEpsilonGC         # Epsilon（不回收，用于测试）
-XX:+UseSerialGC -XX:+UnlockExperimentalVMOptions   # 某些实验 GC 需要解锁
```

## 4. GC 日志分析 ★★★★★

### 4.1 GC 日志配置

```bash
# ─── JDK 8 及以前 ───
-XX:+PrintGCDetails                       # 打印详细信息
-XX:+PrintGCDateStamps                    # 打印日期时间（便于关联业务日志）
-XX:+PrintGC                              # 简略信息
-XX:+PrintGCTimeStamps                    # 相对 JVM 启动的秒数
-XX:+PrintTenuringDistribution            # ★ 打印晋升年龄分布（调 MaxTenuringThreshold）
-XX:+PrintHeapAtGC                        # GC 前后各打印一次堆
-XX:+PrintGCApplicationStoppedTime        # ★ STW 总时长（含安全点等待）
-XX:+PrintGCApplicationConcurrentTime     # 应用线程运行时间
-XX:+PrintReferenceGC                     # 引用处理耗时（软/弱/虚引用多时有用）
-XX:+PrintAdaptiveSizePolicy              # Parallel/G1 的自适应决策
-Xloggc:/logs/gc-%t.log                   # ★ %t = 时间戳，避免覆盖
-XX:+UseGCLogFileRotation                 # 日志轮转
-XX:NumberOfGCLogFiles=5
-XX:GCLogFileSize=20M

# ─── JDK 9+ 统一日志框架（-Xlog）───
-Xlog:gc*                                   # 所有 gc 相关
-Xlog:gc+age=trace                          # 年龄分布（trace 级别）
-Xlog:gc+heap=debug                         # 堆变化
-Xlog:safepoint                             # ★ 安全点日志（排查非 GC 停顿的关键）
-Xlog:gc*:file=/logs/gc.log:time,uptime,level,tags:filecount=5,filesize=20m
#                     ↑装饰器    ↑输出目标  ↑文件轮转
-Xlog:gc*=info,safepoint=debug:stdout       # 输出到标准输出（容器场景，配合日志采集）

# 常用装饰器（decorators）
# time       绝对时间 2026-09-07T10:30:45.123+0800
# uptime     JVM 运行时长 12.345s
# timemillis / uptimemillis / timenanos
# level      日志级别
# tags       日志标签
# pid / tid  进程/线程 ID
```

### 4.2 G1 日志解读

```
# ─── Young GC 日志 ───
[2026-09-07T10:30:45.123+0800][12.345s][info][gc,start    ] GC(5) Pause Young (Normal) (G1 Evacuation Pause)
[2026-09-07T10:30:45.123+0800][12.345s][info][gc,task     ] GC(5) Using 8 workers of 8 for evacuation
[2026-09-07T10:30:45.145+0800][12.367s][info][gc,phases   ] GC(5)   Pre Evacuate Collection Set: 0.2ms
[2026-09-07T10:30:45.145+0800][12.367s][info][gc,phases   ] GC(5)   Merge Heap Roots: 1.1ms
[2026-09-07T10:30:45.145+0800][12.367s][info][gc,phases   ] GC(5)   Evacuate Collection Set: 18.3ms      ← ★ 最耗时（复制对象）
[2026-09-07T10:30:45.145+0800][12.367s][info][gc,phases   ] GC(5)   Post Evacuate Collection Set: 2.1ms
[2026-09-07T10:30:45.145+0800][12.367s][info][gc,phases   ] GC(5)   Other: 0.5ms
[2026-09-07T10:30:45.145+0800][12.367s][info][gc,heap     ] GC(5) Eden regions: 24->0(28)              ← 回收前->回收后(下次分配的数量)
[2026-09-07T10:30:45.145+0800][12.367s][info][gc,heap     ] GC(5) Survivor regions: 3->4(4)
[2026-09-07T10:30:45.145+0800][12.367s][info][gc,heap     ] GC(5) Old regions: 12->13
[2026-09-07T10:30:45.145+0800][12.367s][info][gc,heap     ] GC(5) Humongous regions: 1->1              ← ★ 大对象 Region（要关注！）
[2026-09-07T10:30:45.145+0800][12.367s][info][gc,metaspace] GC(5) Metaspace: 45678K(46080K)->45678K(46080K) NonClass: ...
[2026-09-07T10:30:45.145+0800][12.367s][info][gc          ] GC(5) Pause Young (Normal) (G1 Evacuation Pause) 160M->68M(256M) 22.456ms
                                                                            ↑     ↑    ↑        ↑
                                                                        回收前 回收后 堆总量    ★ 停顿时长

# ─── 并发标记周期 ───
GC(10) Pause Remark 180M->175M(256M) 8.123ms                    ← 重新标记（STW）
GC(10) Pause Cleanup 175M->175M(256M) 0.234ms                    ← 清理（STW）
GC(9)  Concurrent Mark Cycle                                     ← 并发标记周期开始
GC(9)  Concurrent Mark From Roots 45.123ms                        ← ☆ 并发阶段（不停顿）
GC(9)  Concurrent Preclean 2.345ms
GC(9)  Concurrent Undo Mark Cycle                                 ← ★ 撤销标记（IHOP 自适应判断无需继续）

# ─── Mixed GC ───
GC(12) Pause Young (Mixed) (G1 Evacuation Pause) 200M->80M(256M) 45.678ms
                     ↑ ★ Mixed 表示同时回收了老年代 Region

# ─── ★ 危险信号 ───
GC(15) To-space exhausted                                          ← ★★ 复制时没有空闲 Region！
GC(15) Pause Full (G1 Compaction Pause) 250M->200M(256M) 3456.789ms ← ★★ Full GC（G1 失败）
GC(16) Pause Young (Concurrent Start) (GCLocker Initiated GC)       ← JNI 临界区触发的 GC
```

**必须告警的 GC 信号：**

| 日志关键字 | 含义 | 处理 |
| --- | --- | --- |
| `To-space exhausted` | 复制时没有空闲 Region，G1 即将失败 | 增大堆、降低 IHOP、检查内存泄漏 |
| `Pause Full` | **Full GC**（G1 的最后手段） | ★ 立即排查：内存泄漏、大对象、堆太小 |
| `concurrent mode failure`（CMS） | CMS 退化为 Serial Old | 调低 `CMSInitiatingOccupancyFraction` |
| `promotion failed` | 晋升失败（老年代空间不足） | 增大老年代或堆 |
| `Humongous regions` 持续增长 | 大对象过多 | 检查大数组/大集合，调大 `G1HeapRegionSize` |
| `Allocation Stall`（ZGC） | 分配停滞（GC 跟不上分配速度） | 增大堆或增加 ConcGCThreads |
| GC 频率突然升高 | 内存压力增大 | 检查流量、缓存、内存泄漏 |

### 4.3 GC 日志分析工具

| 工具 | 类型 | 特点 |
| --- | --- | --- |
| **GCEasy**（https://gceasy.io） | 在线 | ★ 最易用，上传日志即出可视化报告 + 问题诊断 |
| **GCViewer** | 桌面（开源） | 支持 CMS/G1/Parallel，离线分析 |
| **HPjmeter** | 桌面 | HP 出品，功能全 |
| **GCPlot** | 自建服务 | 持续监控 + 告警 |
| **Eclipse MAT** | 桌面 | 分析 heap dump（不是 GC 日志） |
| **Prometheus + Grafana** | 监控体系 | 通过 Micrometer/JMX 采集 GC 指标 |

```java
// 代码方式获取 GC 指标（Micrometer / Actuator）
GarbageCollectorMXBean g1Young = ManagementFactory.getGarbageCollectorMXBeans().stream()
    .filter(b -> b.getName().contains("G1 Young Generation"))
    .findFirst().orElseThrow();
g1Young.getCollectionCount();       // Young GC 次数
g1Young.getCollectionTime();        // Young GC 总耗时（ms）

MemoryMXBean memory = ManagementFactory.getMemoryMXBean();
memory.getHeapMemoryUsage().getUsed();       // 堆已用
memory.getHeapMemoryUsage().getMax();        // 堆最大
memory.getNonHeapMemoryUsage().getUsed();    // 非堆（元空间等）

// Spring Boot Actuator 自动暴露
// GET /actuator/metrics/jvm.gc.pause          → GC 停顿时间分布
// GET /actuator/metrics/jvm.gc.memory.allocated
// GET /actuator/metrics/jvm.memory.used
// GET /actuator/metrics/jvm.memory.committed
```

## 5. 安全点与安全区域

### 5.1 Safepoint（安全点）★★★★★

**STW 不是「立即」暂停所有线程，而是要等所有线程都跑到「安全点」才能暂停。安全点是代码中特定的位置，在这些位置上「引用关系是确定的」，GC 可以安全地开始扫描。**

```
安全点的选定原则：「是否具有让程序长时间执行的特征」
  - 方法调用
  - 循环跳转（回边 back edge）
  - 异常跳转
  → 这些位置会生成安全点（因为可能长时间执行，不能只在方法入口/出口设点）

线程如何跑到安全点：
  ① 抢先式中断（Preemptive Suspension）：JVM 直接中断所有线程，不在安全点的再恢复运行到安全点
     → 几乎没有 JVM 用
  ② ★ 主动式中断（Voluntary Suspension）：设置一个标志（轮询标志），线程执行时不断轮询，
     发现标志为 true 就自己挂起
     → HotSpot 采用（安全点轮询用内存保护陷阱实现，性能优于每次读标志）
```

**轮询页（Polling Page）机制：**

```asm
; HotSpot 的安全点检查（在方法返回、循环回边处插入）
test polling_page, %eax      ; ★ 读一个「轮询页」的地址
; 当需要 STW 时，JVM 把这个页设为「不可读」
; 线程执行 test 指令时触发 SIGSEGV → 陷入内核 → JVM 挂起该线程
; 好处：无需每次都判断标志位（一次内存访问，且被 CPU 缓存优化）
```

**长时间 STW 的元凶：无法到达安全点的代码**

```java
// ─── 场景 1：大循环中没有安全点（JDK 10 前的问题）───
for (int i = 0; i < 1_000_000_000; i++) {
    count++;                   // 纯计算，JIT 可能优化掉循环回边的安全点检查
}
// → 这个线程要跑完整个循环才能到安全点，其他线程已全部暂停等它
// → 表现为「GC 只用了 10ms，但 STW 有 2 秒」

// ─── 场景 2：可数循环（Counted Loop）───
// int 索引的 for 循环，JIT 认为是「可数循环」，会省略循环内的安全点（只在进出口设）
for (int i = 0; i < n; i++) { }        // int → 可数循环，循环内无安全点
for (long i = 0; i < n; i++) { }       // long → 不可数循环，循环内有安全点 ✅
// ★ 这是一个实用技巧：大循环用 long 索引，能让 GC 及时暂停它

// ─── 场景 3：大数组拷贝 / 大对象分配 ───
System.arraycopy(big, 0, dest, 0, 100_000_000);      // native 方法，不可中断
Arrays.copyOf(hugeArray, newSize);
// → 期间无法进入安全点

// ─── 场景 4：native 方法执行中 ───
// JNI 调用、文件 IO、socket read（阻塞）
// → 解决：使用「安全区域（Safe Region）」
```

**Safe Region（安全区域）：**

```
问题：线程处于 Sleep 或 Blocked 状态时，无法主动跑到安全点
解决：安全区域 = 一段「引用关系不会变化」的代码区域
  - 线程进入安全区域时先打标记，然后 JVM 可以不用管它（直接 GC）
  - 线程要离开安全区域时，检查「根节点枚举（GC）」是否完成
    - 完成 → 继续执行
    - 未完成 → 等待，直到收到可以离开的信号

典型的安全区域：Thread.sleep()、Object.wait()、阻塞 IO
```

**排查非 GC 停顿（关键）：**

```bash
# ★ 开启安全点日志
-Xlog:safepoint                                # JDK 9+
-XX:+PrintSafepointStatistics                  # JDK 8
-XX:PrintSafepointStatisticsCount=1

# 日志解读
# JDK 8
         vmop            [threads: Total initially_threaded]  [time: spin block sync cleanup vmop] page_trap_count
12.345: RevokeBias               [      10        0         ]    [  1000    50    20     30    100 ]  0
#                                                    ↑spin(自旋等待) ↑block(阻塞) ↑sync(同步到安全点耗时)
# ★ sync 很大 → 有线程迟迟到不了安全点

# JDK 9+
[12.345s][info][safepoint] Safepoint "G1CollectForAllocation", Time since last: 1234567 ns,
                           Reaching safepoint: 5000000 ns, At safepoint: 20000000 ns, Total: 25000000 ns
#                                            ↑ ★ 到达安全点耗时 5ms（太长！）
#                                                              ↑ STW 总时长 25ms

# 常见原因与解决
# 1. 可数循环 → 改用 long 索引，或 -XX:+UseCountedLoopSafepoints（JDK 10+ 默认改善）
# 2. 大量 JIT 反优化（deoptimization）→ -XX:+PrintCompilation 观察
# 3. 偏锁撤销（RevokeBias）→ JDK 15+ 禁用偏向锁 -XX:-UseBiasedLocking
# 4. 代码缓存满（CodeCache full）→ 增大 -XX:ReservedCodeCacheSize
# 5. 元空间扩容触发的 Full GC → 预设 -XX:MetaspaceSize
```

## 6. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 依赖 `System.gc()` 释放内存 | GC 时机不可控，性能抖动 | 禁止调用，或 `-XX:+DisableExplicitGC` |
| 2 | `DisableExplicitGC` 后堆外内存泄漏 | DirectByteBuffer 不回收 → `Direct buffer memory` OOM | 用 `-XX:+ExplicitGCInvokesConcurrent`（把 System.gc 变成并发 GC） |
| 3 | CMS 的 `InitiatingOccupancyFraction` 太高 | Concurrent Mode Failure，STW 数秒 | 降到 70~75% + `UseCMSInitiatingOccupancyOnly` |
| 4 | CMS 长期运行碎片化 | 大对象分配失败触发 Full GC | `UseCMSCompactAtFullCollection` 或换 G1 |
| 5 | G1 的 `MaxGCPauseMillis` 设太小（如 20ms） | 新生代极小，Young GC 频繁，吞吐量暴跌 | 不低于 100ms，从 200ms 起调 |
| 6 | G1 堆太小（< 4GB） | RSet 开销占比高，性能不如 Parallel | 小堆用 Parallel，大堆用 G1 |
| 7 | G1 出现 `To-space exhausted` | 即将退化为 Full GC | 增大堆、降低 IHOP、排查泄漏 |
| 8 | G1 Humongous 对象过多 | 大对象直接进老年代，频繁 Full GC | 调大 `G1HeapRegionSize`，或拆分大对象 |
| 9 | 软引用做缓存 | 堆长期高水位，Full GC 频繁 | 用 Caffeine（大小/时间淘汰） |
| 10 | 用 `finalize` 清理资源 | 执行时机不定、性能差、对象复活 | `try-with-resources` 或 `Cleaner` |
| 11 | WeakHashMap 的 value 强引用 key | key 永不回收（泄漏） | 避免 value→key 的引用 |
| 12 | 未开启 GC 日志 | 出问题无现场 | `-Xlog:gc*` + 日志轮转（生产必配） |
| 13 | 未开 `HeapDumpOnOutOfMemoryError` | OOM 后无法分析 | **生产必配** |
| 14 | STW 长但 GC 时间短 | 有线程到不了安全点 | 开 `-Xlog:safepoint`，检查可数循环（改 long 索引） |
| 15 | 大数组拷贝期间停顿 | `System.arraycopy` 不可中断 | 分批拷贝 |
| 16 | ZGC 下期望压缩指针 | 不支持（指针位被染色占用） | 接受 8 字节引用，或换 G1 |
| 17 | JDK 8 升 JDK 11 后 GC 行为大变 | 默认 GC 从 Parallel 变 G1 | 显式指定 GC 或全面压测 |
| 18 | 容器内 GC 线程数按宿主机核数计算 | GC 线程过多，CPU 争抢 | JDK 8u191+ 且 `UseContainerSupport`；显式 `ParallelGCThreads` |
| 19 | 内存泄漏误判为「堆太小」 | 加大堆后依然 OOM（只是延后） | MAT 分析 dump，找支配树 |
| 20 | 频繁 Young GC 但耗时短 | 新生代太小或对象分配速率过高 | 增大 `-Xmn`/Eden，或优化代码减少临时对象 |

---

## 关联笔记

- 上一篇：[[后端/JVM/JVM概述与运行时数据区]]
- 下一篇：[[后端/JVM/类加载机制与字节码]]
- 实战：[[后端/JVM/JVM调优与线上问题排查]]（GC 调优步骤、dump 分析）
- 相关：[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]（弱引用与 ThreadLocalMap）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
