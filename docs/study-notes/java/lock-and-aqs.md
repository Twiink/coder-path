---
title: "Lock与AQS原理"
aliases:
  - "AQS 原理"
  - "ReentrantLock"
  - "读写锁 StampedLock"
tags:
  - "后端"
  - "java"
  - "并发"
  - "面试"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/并发编程/volatile与CAS原子类]]"
  - "[[后端/Java基础/并发编程/线程安全与synchronized]]"
  - "[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]"
  - "[[后端/Java基础/并发编程/线程池原理与实战]]"
created: 2026-09-07
updated: 2026-09-07
---

# Lock 与 AQS 原理

> AQS 是整个 `java.util.concurrent` 的基石：`ReentrantLock`、`ReentrantReadWriteLock`、`Semaphore`、`CountDownLatch`、`CyclicBarrier`、`ThreadPoolExecutor.Worker`、`FutureTask` 全部基于它。吃透 AQS，JUC 就通了一大半。

## 1. JUC 锁体系总览

```
java.util.concurrent.locks
│
├── Lock（接口）                     ← 锁的顶层抽象
│   ├── ReentrantLock               ← 可重入互斥锁（synchronized 的替代品）
│   ├── ReentrantReadWriteLock      ← 读写锁（内含 ReadLock / WriteLock）
│   │   ├── ReadLock
│   │   └── WriteLock
│   └── StampedLock（JDK 8）         ← 邮戳锁，支持乐观读（性能更高，但不可重入）
│
├── ReadWriteLock（接口）
│   └── ReentrantReadWriteLock
│
├── Condition（接口）                ← 等待/通知（替代 wait/notify，支持多条件队列）
│
├── AbstractQueuedSynchronizer（AQS）★ 核心：独占/共享模式的同步器框架
│   ├── AbstractQueuedLongSynchronizer（state 用 long，极少用）
│   └── 被以下类继承/组合：
│       ├── ReentrantLock.Sync（NonfairSync / FairSync）
│       ├── ReentrantReadWriteLock.Sync
│       ├── Semaphore.Sync（NonfairSync / FairSync）
│       ├── CountDownLatch.Sync
│       ├── ThreadPoolExecutor.Worker（继承 AQS 实现不可重入锁）
│       ├── FutureTask.Sync（JDK 6）/ WaitNode（JDK 8+）
│       └── CyclicBarrier（内部用 ReentrantLock + Condition）
│
├── LockSupport                       ← 线程阻塞/唤醒的底层工具（park/unpark）
│
└── 并发容器（在 java.util.concurrent 包）
    ├── ConcurrentHashMap           ← CAS + synchronized
    ├── CopyOnWriteArrayList        ← ReentrantLock + 数组复制
    ├── ConcurrentLinkedQueue       ← 无锁 CAS
    ├── BlockingQueue 系列           ← ReentrantLock + 2 个 Condition
    └── ConcurrentSkipListMap       ← CAS
```

## 2. Lock 接口

```java
public interface Lock {

    /** 获取锁（阻塞，不可中断，非公平） */
    void lock();

    /** 获取锁（★ 可响应中断，等待期间被 interrupt 会抛 InterruptedException） */
    void lockInterruptibly() throws InterruptedException;

    /** 尝试获取锁（★ 非阻塞，立即返回 true/false） */
    boolean tryLock();

    /** 尝试获取锁（★ 带超时 + 可中断） */
    boolean tryLock(long time, TimeUnit unit) throws InterruptedException;

    /** 释放锁 */
    void unlock();

    /** ★ 创建条件变量（一个 Lock 可以有多个 Condition，实现精确唤醒） */
    Condition newCondition();
}
```

**Lock 相比 synchronized 的五大增强能力：**

| 能力 | 方法 | synchronized |
| --- | --- | --- |
| 非阻塞尝试 | `tryLock()` | ❌ |
| 可中断等待 | `lockInterruptibly()` | ❌（等锁时不响应中断） |
| 超时获取 | `tryLock(time, unit)` | ❌ |
| 公平锁 | `new ReentrantLock(true)` | ❌（只能非公平） |
| 多条件变量 | `newCondition()`（可多个） | ❌（只有一个 wait set） |
| 锁状态查询 | `isLocked()`、`getHoldCount()`、`isHeldByCurrentThread()`、`getQueueLength()` | ❌ |
| 读写分离 | `ReentrantReadWriteLock` | ❌ |

**标准使用范式（★ 必须严格遵守）：**

```java
// ✅ 范式 1：lock() 在 try 之外
Lock lock = new ReentrantLock();
lock.lock();                          // ★ 加锁必须在 try 之前
try {
    // 临界区
} finally {
    lock.unlock();                     // ★ 必须在 finally 中释放
}

// ✅ 范式 2：tryLock 非阻塞（获取不到就走降级逻辑）
if (lock.tryLock()) {
    try {
        // 临界区
    } finally {
        lock.unlock();
    }
} else {
    log.warn("获取锁失败，执行降级");
    return fallback();
}

// ✅ 范式 3：tryLock 带超时（可中断）
try {
    if (lock.tryLock(3, TimeUnit.SECONDS)) {
        try {
            // 临界区
        } finally {
            lock.unlock();
        }
    } else {
        throw new TimeoutException("获取锁超时");
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();     // ★ 恢复中断标志
    throw new IllegalStateException("等锁被中断", e);
}

// ✅ 范式 4：可中断获取
try {
    lock.lockInterruptibly();
    try {
        // 临界区
    } finally {
        lock.unlock();
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
}

// ❌ 错误 1：lock 在 try 内
try {
    lock.lock();                     // 若这里抛异常（如 OOM），
    doWork();
} finally {
    lock.unlock();                   // ★ 没加上锁却执行 unlock → IllegalMonitorStateException
}

// ❌ 错误 2：忘记 unlock（异常路径锁永不释放）
lock.lock();
doWork();                            // 抛异常
lock.unlock();                       // 永远执行不到 → 其他线程永久阻塞

// ❌ 错误 3：unlock 不是当前线程持有的锁
// → IllegalMonitorStateException（Lock 不允许「解他人的锁」，synchronized 也一样）
```

## 3. ReentrantLock 源码剖析 ★★★★★

### 3.1 类结构

```java
public class ReentrantLock implements Lock, java.io.Serializable {

    /** ★ 所有操作都委托给 Sync（AQS 的子类） */
    private final Sync sync;

    abstract static class Sync extends AbstractQueuedSynchronizer {
        abstract void lock();                                // 模板方法

        final boolean nonfairTryAcquire(int acquires) {       // 非公平尝试获取
            final Thread current = Thread.currentThread();
            int c = getState();                              // ① 读 state
            if (c == 0) {                                     // ② state=0 表示锁空闲
                if (compareAndSetState(0, acquires)) {         // ③ ★ CAS 抢锁
                    setExclusiveOwnerThread(current);          // ④ 记录持有者
                    return true;
                }
            }
            else if (current == getExclusiveOwnerThread()) {   // ⑤ 是当前线程 → 重入
                int nextc = c + acquires;
                if (nextc < 0) throw new Error("Maximum lock count exceeded");
                setState(nextc);                               // ★ 重入不需要 CAS（已独占）
                return true;
            }
            return false;
        }

        protected final boolean tryRelease(int releases) {
            int c = getState() - releases;
            if (Thread.currentThread() != getExclusiveOwnerThread())
                throw new IllegalMonitorStateException();       // ★ 解他人的锁
            boolean free = false;
            if (c == 0) {                                       // 重入计数减到 0
                free = true;
                setExclusiveOwnerThread(null);                  // 清空持有者
            }
            setState(c);                                        // ★ 无需 CAS（当前线程独占）
            return free;
        }

        final ConditionObject newCondition() {
            return new ConditionObject();
        }
    }

    /** 非公平锁（★ 默认） */
    static final class NonfairSync extends Sync {
        final void lock() {
            if (compareAndSetState(0, 1))                       // ★ 上来就 CAS 抢一次（插队！）
                setExclusiveOwnerThread(Thread.currentThread());
            else
                acquire(1);                                     // 失败走 AQS 标准流程
        }
        protected final boolean tryAcquire(int acquires) {
            return nonfairTryAcquire(acquires);
        }
    }

    /** 公平锁 */
    static final class FairSync extends Sync {
        final void lock() {
            acquire(1);                                         // ★ 直接走 AQS 流程，不插队
        }
        protected final boolean tryAcquire(int acquires) {
            final Thread current = Thread.currentThread();
            int c = getState();
            if (c == 0) {
                if (!hasQueuedPredecessors() &&                 // ★★ 关键区别：先检查队列中是否有前驱
                    compareAndSetState(0, acquires)) {
                    setExclusiveOwnerThread(current);
                    return true;
                }
            }
            else if (current == getExclusiveOwnerThread()) {
                int nextc = c + acquires;
                setState(nextc);
                return true;
            }
            return false;
        }
    }

    public ReentrantLock() { sync = new NonfairSync(); }                    // ★ 默认非公平
    public ReentrantLock(boolean fair) {
        sync = fair ? new FairSync() : new NonfairSync();
    }
}
```

### 3.2 公平锁 vs 非公平锁 ★★★★★

**唯一区别：`tryAcquire` 时是否先调用 `hasQueuedPredecessors()` 检查队列中是否有等待更久的线程。**

```java
// AQS 的 hasQueuedPredecessors()
public final boolean hasQueuedPredecessors() {
    Node t = tail;
    Node h = head;
    Node s;
    return h != t &&
        ((s = h.next) == null || s.thread != Thread.currentThread());
    // 队列非空 && （头节点的下一个不是自己）→ 说明前面有人在等 → 应该排队
}
```

| 对比 | 公平锁 FairSync | 非公平锁 NonfairSync（默认） |
| --- | --- | --- |
| 获取顺序 | **严格 FIFO**（按等待时间） | 允许插队（先 CAS 抢，抢不到再排队） |
| 吞吐量 | 低（每次都要检查队列 + 唤醒队列头线程，必然有上下文切换） | **高**（刚释放锁的线程可能还在 CPU 上，直接重入，省去切换） |
| 饥饿风险 | 无 | 有（某线程可能一直抢不到，但实践中极少） |
| 实现差异 | `!hasQueuedPredecessors() && CAS` | `lock()` 先裸 CAS，`tryAcquire` 直接 CAS |
| 适用 | 需要严格顺序的场景（如任务队列） | **绝大多数场景** |

```java
// 非公平锁为什么吞吐量更高？（关键洞察）
// 线程 A 释放锁的瞬间，A 通常还在 CPU 上运行（时间片未用完）
// 非公平：A 可以立即再次获取锁（如果它又要用）→ 零上下文切换
// 公平：必须唤醒队列中等待的线程 B → B 从阻塞态恢复到运行态需要 5~10μs
//      这段时间锁是空闲的（无人持有），造成「锁空闲期」，吞吐量下降

// 实测（4 线程各获取释放锁 100 万次）：
// 非公平锁：约 300 ms
// 公平锁：  约 3000 ms   ← 慢 10 倍！
```

> 【结论】**除非有明确的公平性需求，一律用默认的非公平锁**。`synchronized` 也是非公平的（ObjectMonitor 的唤醒策略允许插队）。

### 3.3 可重入性的实现

```java
// 通过 state 计数实现：每次重入 state++，每次释放 state--，减到 0 才真正释放
ReentrantLock lock = new ReentrantLock();

lock.lock();                 // state: 0 → 1
System.out.println(lock.getHoldCount());     // 1
lock.lock();                 // state: 1 → 2（重入，无需 CAS）
System.out.println(lock.getHoldCount());     // 2
lock.lock();                 // state: 2 → 3
lock.unlock();               // state: 3 → 2
lock.unlock();               // state: 2 → 1
lock.unlock();               // state: 1 → 0 → 真正释放，唤醒队列中的线程
lock.unlock();               // ★ IllegalMonitorStateException（已经释放完了）

// 诊断 API
lock.isLocked();                          // 是否被任何线程持有
lock.isHeldByCurrentThread();             // ★ 是否被当前线程持有（用于安全的 unlock）
lock.getHoldCount();                       // 当前线程的重入次数
lock.getQueueLength();                     // 等待获取锁的线程数（估算）
lock.hasQueuedThreads();
lock.hasQueuedThread(thread);
lock.isFair();
lock.getQueuedThreads();                   // 等待线程集合

// 安全释放的写法
if (lock.isHeldByCurrentThread()) {
    lock.unlock();
}
```

> 【坑】**`unlock()` 次数多于 `lock()` 会抛 `IllegalMonitorStateException`**。在嵌套调用、异常路径复杂时容易出问题，务必用 `isHeldByCurrentThread()` 保护，或严格保证 lock/unlock 配对。

### 3.4 ReentrantLock 的实战应用

```java
// ─── 应用 1：分布式场景的本地互斥（缓存击穿防护）───
private final Map<String, ReentrantLock> lockMap = new ConcurrentHashMap<>();

public Object getWithCacheProtection(String key) {
    Object cached = cache.get(key);
    if (cached != null) return cached;

    // ★ 每个 key 一把锁，细粒度，避免全局锁
    ReentrantLock lock = lockMap.computeIfAbsent(key, k -> new ReentrantLock());
    if (lock.tryLock(3, TimeUnit.SECONDS)) {
        try {
            cached = cache.get(key);                        // 双重检查
            if (cached != null) return cached;
            Object value = queryFromDb(key);                // 只有一个线程查库
            cache.put(key, value);
            return value;
        } finally {
            lock.unlock();
            lockMap.remove(key);                            // ★ 清理，防止内存泄漏
        }
    } else {
        // 获取锁超时：直接查库（降级）或返回默认值
        return queryFromDb(key);
    }
}
// 生产环境用 Redisson 的分布式锁（详见 [[后端/中间件/Redis在Java项目中的整合]]）

// ─── 应用 2：tryLock 实现「非阻塞的资源竞争」───
public boolean tryTransfer(Account from, Account to, BigDecimal amount) {
    // ★ 按 ID 排序加锁（防死锁）+ tryLock 超时（防长时间等待）
    Account first = from.getId() < to.getId() ? from : to;
    Account second = from.getId() < to.getId() ? to : from;

    if (first.getLock().tryLock()) {
        try {
            if (second.getLock().tryLock()) {
                try {
                    from.withdraw(amount);
                    to.deposit(amount);
                    return true;
                } finally { second.getLock().unlock(); }
            }
        } finally { first.getLock().unlock(); }
    }
    return false;                     // 拿不到锁，返回失败让上层重试
}

// ─── 应用 3：lockInterruptibly 实现可取消的任务 ───
public void doLongTask() throws InterruptedException {
    lock.lockInterruptibly();          // ★ 等锁期间可被中断（synchronized 做不到）
    try {
        // 长任务
    } finally {
        lock.unlock();
    }
}
// 调用方
Future<?> future = pool.submit(() -> doLongTask());
future.cancel(true);                   // 中断线程 → doLongTask 抛 InterruptedException
```

## 4. AQS 原理 ★★★★★（核心）

### 4.1 AQS 的设计思想

**AQS（AbstractQueuedSynchronizer）是一个「模板方法模式 + 队列管理」的框架：**

1. **一个 volatile int state**：表示同步状态（含义由子类定义）。
2. **一个 FIFO 双向队列（CLH 变体）**：存放竞争失败的线程。
3. **模板方法**：子类只需实现 `tryAcquire`/`tryRelease`（独占）或 `tryAcquireShared`/`tryReleaseShared`（共享），AQS 负责排队、阻塞、唤醒的全部细节。

```
┌────────────────────────────────────────────────────────────────┐
│                      AQS 的核心结构                              │
│                                                                  │
│   volatile int state          ← 同步状态（CAS 修改）               │
│        │                                                         │
│        │  ReentrantLock:  0=空闲, N=重入 N 次                      │
│        │  Semaphore:      剩余许可数                                │
│        │  CountDownLatch: 剩余计数                                  │
│        │  ReadWriteLock:  高 16 位=读锁持有数, 低 16 位=写锁重入数    │
│        │  ThreadPoolExecutor.Worker: 0/-1/1                        │
│        ▼                                                         │
│   Thread exclusiveOwnerThread ← 独占模式下的持有线程                │
│                                                                  │
│   CLH 变体的 FIFO 双向队列：                                        │
│   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐                      │
│   │ head │←─→│ Node │←─→│ Node │←─→│ tail │                      │
│   │(哨兵) │   │(线程A)│   │(线程B)│   │(线程C)│                      │
│   └──────┘   └──────┘   └──────┘   └──────┘                      │
│   prev/next 双向指针 + waitStatus 状态                              │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 AQS 的核心字段与 Node

```java
public abstract class AbstractQueuedSynchronizer
        extends AbstractOwnableSynchronizer implements java.io.Serializable {

    // ─── 同步状态 ───
    private volatile int state;                      // ★ volatile 保证可见性

    protected final int getState() { return state; }
    protected final void setState(int newState) { state = newState; }
    protected final boolean compareAndSetState(int expect, int update) {
        return unsafe.compareAndSwapInt(this, stateOffset, expect, update);   // ★ CAS
    }

    // ─── CLH 队列的头尾指针 ───
    private transient volatile Node head;
    private transient volatile Node tail;

    // ─── 自旋超时阈值（纳秒），小于此值不 park，直接自旋 ───
    private static final long spinForTimeoutThreshold = 1000L;

    // ─── 节点定义 ───
    static final class Node {
        static final Node SHARED = new Node();       // 标记为共享模式
        static final Node EXCLUSIVE = null;          // 标记为独占模式

        /** ★ 等待状态（关键） */
        static final int CANCELLED =  1;             // 线程取消等待（超时/被中断）→ 需从队列移除
        static final int SIGNAL    = -1;             // ★ 后继节点需要被唤醒（当前节点释放锁时要 unpark 后继）
        static final int CONDITION = -2;             // 节点在 Condition 队列中等待
        static final int PROPAGATE = -3;             // 共享模式下，释放需要向后传播
        static final int INITIAL   =  0;             // 初始状态

        volatile int waitStatus;
        volatile Node prev;                           // ★ 前驱（CLH 原始设计只有 prev，AQS 加了 next）
        volatile Node next;
        volatile Thread thread;                       // 排队的线程
        Node nextWaiter;                              // Condition 队列的单链表指针 / SHARED/EXCLUSIVE 标记

        final boolean isShared() { return nextWaiter == SHARED; }
        final Thread predecessor() { ... }
    }

    // ─── 子类需要重写的钩子方法（模板方法）───
    protected boolean tryAcquire(int arg) { throw new UnsupportedOperationException(); }
    protected boolean tryRelease(int arg) { throw new UnsupportedOperationException(); }
    protected int tryAcquireShared(int arg) { throw new UnsupportedOperationException(); }
    protected boolean tryReleaseShared(int arg) { throw new UnsupportedOperationException(); }
    protected boolean isHeldExclusively() { throw new UnsupportedOperationException(); }
}
```

**为什么 AQS 用双向链表而非 CLH 的隐式单向链表？**

原始 CLH 锁只有 `prev` 指针，线程自旋监听**前驱节点的状态**。AQS 改成双向链表并加入 `waitStatus`，是为了：
1. 支持**阻塞（park）而非自旋**：需要 `next` 指针才能在释放锁时找到后继节点去 unpark。
2. 支持**取消节点的移除**：需要 prev 和 next 双向才能高效摘除中间节点。
3. 支持**超时和中断**：CANCELLED 节点需要被跳过。

### 4.3 独占模式的获取流程（acquire）★★★★★

```java
// AQS 的 acquire 模板方法（ReentrantLock.lock() 最终调用它）
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&                                  // ① 子类实现：尝试获取
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))       // ② 失败则入队 + 排队获取
        selfInterrupt();                                     // ③ 补一个中断标记
}
```

**完整流程图：**

```
线程调用 lock()
      │
      ▼
① tryAcquire(1)  ← 子类实现（CAS 修改 state）
      │
      ├─ 成功 → 设置 exclusiveOwnerThread，返回（获得锁）
      │
      └─ 失败
           │
           ▼
② addWaiter(EXCLUSIVE)：把当前线程包装成 Node，CAS 加到队列 tail
           │
           ▼
③ acquireQueued(node, 1)：在队列中自旋 + park
           │
           ▼
      ┌────────────────────────────┐
      │ for (;;) 自旋：              │
      │  ① 前驱是 head？             │
      │     ├─ 是 → tryAcquire(1)   │
      │     │        ├─ 成功 → 把自己设为 head，返回（获得锁）
      │     │        └─ 失败 → ②    │
      │     └─ 否 → ②               │
      │  ② shouldParkAfterFailedAcquire()：
      │     把前驱的 waitStatus 设为 SIGNAL（表示"你释放时要唤醒我"）
      │  ③ parkAndCheckInterrupt()：
      │     LockSupport.park(this)  ← ★ 线程在此阻塞（WAITING）
      │     被唤醒后检查是否被中断
      └────────────────────────────┘
```

**关键源码逐行解读：**

```java
// ─── addWaiter：把线程加入队列尾部 ───
private Node addWaiter(Node mode) {
    Node node = new Node(Thread.currentThread(), mode);
    Node pred = tail;
    if (pred != null) {                          // 快速路径：队列已初始化
        node.prev = pred;                         // ★ 先设 prev
        if (compareAndSetTail(pred, node)) {      // ★ CAS 更新 tail
            pred.next = node;                      // ★ 成功后再连 next（保证 prev 链总是完整的）
            return node;
        }
    }
    enq(node);                                     // 慢路径：队列未初始化或 CAS 失败
    return node;
}

private Node enq(final Node node) {
    for (;;) {                                      // 自旋直到入队成功
        Node t = tail;
        if (t == null) {                             // 队列为空 → 初始化（懒创建 head 哨兵节点）
            if (compareAndSetHead(new Node()))        // ★ head 是空节点的「哨兵」，不代表任何线程
                tail = head;
        } else {
            node.prev = t;
            if (compareAndSetTail(t, node)) {
                t.next = node;
                return t;
            }
        }
    }
}

// ─── acquireQueued：队列中的自旋与阻塞 ───
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (;;) {
            final Node p = node.predecessor();       // 取前驱
            if (p == head && tryAcquire(arg)) {       // ★ 只有前驱是 head 才尝试获取锁（避免无谓的 CAS）
                setHead(node);                         // 成功：把自己设为新的 head
                p.next = null;                          // 旧 head 出队（help GC）
                failed = false;
                return interrupted;                     // 返回等待期间是否被中断
            }
            if (shouldParkAfterFailedAcquire(p, node) &&  // ★ 判断是否应该 park
                parkAndCheckInterrupt())                   // park 并检查中断
                interrupted = true;
        }
    } finally {
        if (failed) cancelAcquire(node);                  // 异常时取消节点
    }
}

// ─── shouldParkAfterFailedAcquire：整理队列，决定是否阻塞 ───
private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
    int ws = pred.waitStatus;
    if (ws == Node.SIGNAL)                // ① 前驱已承诺释放时唤醒我 → 可以安全 park
        return true;
    if (ws > 0) {                          // ② 前驱是 CANCELLED → 向前跳过所有已取消节点
        do {
            node.prev = pred = pred.prev;
        } while (pred.waitStatus > 0);
        pred.next = node;
    } else {                               // ③ 前驱是 0 或 PROPAGATE → CAS 设为 SIGNAL
        compareAndSetWaitStatus(pred, ws, Node.SIGNAL);   // 本次不 park，下次循环再判断
    }
    return false;
}

// ─── parkAndCheckInterrupt：真正阻塞 ───
private final boolean parkAndCheckInterrupt() {
    LockSupport.park(this);                 // ★ 阻塞（this 作为 blocker，jstack 能显示在等哪个锁）
    return Thread.interrupted();             // 返回并清除中断标志
}
```

**SIGNAL 状态的设计精妙之处：**

```
SIGNAL(-1) 的语义：「我的后继节点在等我释放锁时唤醒它」

线程 A（持有锁）        线程 B（排队）
  head                   tail
    │                      │
    └──── waitStatus ──────┘
    
B 入队后，通过 CAS 把 A 节点（B 的前驱）的 waitStatus 设为 SIGNAL
含义：B 告诉 A「你释放锁时必须 unpark 我」
好处：A 释放锁时只需检查自己的 waitStatus 是否 < 0，就知道要不要唤醒后继
     ★ 避免了 A 每次都去检查队列（减少竞争）
```

### 4.4 独占模式的释放流程（release）

```java
public final boolean release(int arg) {
    if (tryRelease(arg)) {                     // ① 子类实现：state 减到 0 才返回 true
        Node h = head;
        if (h != null && h.waitStatus != 0)     // ② 有等待节点
            unparkSuccessor(h);                 // ③ 唤醒后继
        return true;
    }
    return false;
}

// ─── tryRelease（ReentrantLock.Sync 实现）───
protected final boolean tryRelease(int releases) {
    int c = getState() - releases;
    if (Thread.currentThread() != getExclusiveOwnerThread())
        throw new IllegalMonitorStateException();
    boolean free = false;
    if (c == 0) {                                // ★ 重入计数归零才真正释放
        free = true;
        setExclusiveOwnerThread(null);
    }
    setState(c);                                  // ★ 无需 CAS：当前线程独占，无竞争
    return free;
}

// ─── unparkSuccessor：唤醒队列中的下一个有效节点 ───
private void unparkSuccessor(Node node) {
    int ws = node.waitStatus;
    if (ws < 0)
        compareAndSetWaitStatus(node, ws, 0);      // ① 重置 head 的状态

    Node s = node.next;
    if (s == null || s.waitStatus > 0) {            // ② next 为空或已取消
        s = null;
        // ★★ 从 tail 往前遍历找最靠前的有效节点（关键！）
        for (Node t = tail; t != null && t != node; t = t.prev)
            if (t.waitStatus <= 0)
                s = t;
    }
    if (s != null)
        LockSupport.unpark(s.thread);                // ③ 唤醒
}
```

> 【面试】**为什么 `unparkSuccessor` 要从 tail 往前遍历，而不是直接用 `head.next`？**
>
> 因为在 `addWaiter`/`enq` 中，节点的入队操作是**非原子的三步**：
> ```java
> node.prev = pred;                  // ① 先设 prev（原子可见）
> compareAndSetTail(pred, node);      // ② CAS 更新 tail
> pred.next = node;                   // ③ 最后设 next（★ 这一步可能还没执行！）
> ```
> 如果在 ② 和 ③ 之间有另一个线程调用 `unparkSuccessor`，此时 `head.next` 可能为 null，但**从 tail 沿 prev 链一定能遍历到该节点**（因为 prev 是在 CAS 之前就设置好的）。
>
> **这就是 AQS 保证「prev 链完整、next 链可能不完整」的设计**：入队失败重试也是基于 prev 链。这个细节是 AQS 无锁队列正确性的关键。

### 4.5 共享模式（acquireShared）

```java
// 共享模式：多个线程可以同时获取（Semaphore、CountDownLatch、读锁）
public final void acquireShared(int arg) {
    if (tryAcquireShared(arg) < 0)                // ★ 返回值 < 0 表示失败
        doAcquireShared(arg);
}

// tryAcquireShared 的返回值语义（与独占的 boolean 不同）：
//   < 0  → 获取失败
//   = 0  → 获取成功，但后续线程无法再获取（资源用尽）
//   > 0  → 获取成功，且还有剩余资源（★ 需要向后传播唤醒）

private void doAcquireShared(int arg) {
    final Node node = addWaiter(Node.SHARED);      // ★ 标记为共享模式
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (;;) {
            final Node p = node.predecessor();
            if (p == head) {
                int r = tryAcquireShared(arg);
                if (r >= 0) {
                    setHeadAndPropagate(node, r);    // ★★ 关键：设置 head 并「传播」唤醒后继
                    p.next = null;
                    if (interrupted) selfInterrupt();
                    failed = false;
                    return;
                }
            }
            if (shouldParkAfterFailedAcquire(p, node) && parkAndCheckInterrupt())
                interrupted = true;
        }
    } finally {
        if (failed) cancelAcquire(node);
    }
}

// ─── setHeadAndPropagate：共享模式的传播唤醒 ───
private void setHeadAndPropagate(Node node, int propagate) {
    Node h = head;
    setHead(node);
    // ★ 如果还有剩余资源，或前驱状态要求传播 → 继续唤醒后继（链式唤醒）
    if (propagate > 0 || h == null || h.waitStatus < 0 ||
        (h = head) == null || h.waitStatus < 0) {
        Node s = node.next;
        if (s == null || s.isShared())
            doReleaseShared();                        // ★ 唤醒后继，后继又会继续传播
    }
}

// CountDownLatch 的 tryAcquireShared 实现
protected int tryAcquireShared(int acquires) {
    return (getState() == 0) ? 1 : -1;      // state 减到 0 时，所有等待线程一起被唤醒（传播）
}
// Semaphore 的 tryAcquireShared
final int nonfairTryAcquireShared(int acquires) {
    for (;;) {
        int available = getState();
        int remaining = available - acquires;
        if (remaining < 0 || compareAndSetState(available, remaining))
            return remaining;                 // 返回剩余许可数
    }
}
```

**PROPAGATE(-3) 状态的意义：** 解决共享模式下的「唤醒丢失」问题。在并发 release 时，如果 head 的 waitStatus 是 0，可能导致后继节点不被唤醒而永久阻塞。PROPAGATE 保证释放动作一定会向后传播。这是 JDK 6 修复的一个 AQS bug。

### 4.6 独占 vs 共享模式对比

| 对比 | 独占模式（Exclusive） | 共享模式（Shared） |
| --- | --- | --- |
| 同一时刻持有者 | **只能 1 个线程** | **可多个线程** |
| tryAcquire 返回值 | `boolean` | `int`（<0 失败，≥0 成功且表示剩余量） |
| 唤醒策略 | 唤醒 1 个后继 | **链式传播唤醒**（可能唤醒多个） |
| 节点标记 | `EXCLUSIVE`（null） | `SHARED` |
| 代表实现 | `ReentrantLock`、写锁 | `Semaphore`、`CountDownLatch`、读锁 |
| 重入 | 支持（state 累加） | 读锁支持（每线程计数） |

## 5. Condition 条件变量 ★★★★★

### 5.1 Condition 与 wait/notify 的对比

| 对比 | Object.wait/notify | Condition |
| --- | --- | --- |
| 前提 | 必须先获得 **synchronized 锁** | 必须先获得 **Lock** |
| 队列数量 | **1 个**（对象的 wait set） | **多个**（每个 Condition 一个独立队列） |
| 唤醒精度 | notify 随机唤醒一个（可能唤醒错的） | **精确唤醒指定条件的线程** |
| 等待方法 | `wait()`、`wait(ms)` | `await()`、`awaitNanos()`、`awaitUntil()`、`awaitUninterruptibly()` |
| 通知方法 | `notify()`、`notifyAll()` | `signal()`、`signalAll()` |
| 中断响应 | `wait` 抛 InterruptedException | `await` 抛异常；`awaitUninterruptibly` 不响应 |

### 5.2 Condition 的实现原理（两个队列的转换）★★★★★

```java
// AQS 的内部类 ConditionObject
public class ConditionObject implements Condition, java.io.Serializable {
    /** ★ Condition 队列的头尾（单向链表，用 nextWaiter 连接） */
    private transient Node firstWaiter;
    private transient Node lastWaiter;
}
```

**关键：使用 Condition 时，线程在「同步队列（CLH）」和「条件队列」之间转移。**

```
                    ┌─────────────────────────────────────────┐
                    │           ReentrantLock (AQS)             │
                    │                                           │
                    │  同步队列（CLH 双向链表）                    │
                    │  head ⇄ Node(线程A) ⇄ Node(线程B) ⇄ tail   │
                    │        （等待获取锁的线程）                  │
                    └───────────────┬───────────────────────────┘
                                    │
                        await() 时：释放锁 + 从同步队列移到条件队列
                        signal() 时：从条件队列移回同步队列
                                    │
        ┌───────────────────────────▼───────────────────────────┐
        │  notFull 条件队列           │  notEmpty 条件队列          │
        │  firstWaiter               │  firstWaiter                │
        │     ↓ nextWaiter            │     ↓ nextWaiter            │
        │  Node(线程C)                │  Node(线程E)                │
        │     ↓                       │     ↓                       │
        │  Node(线程D)                │  Node(线程F)                │
        │  lastWaiter                │  lastWaiter                 │
        │  （队列满，等待有空位）        │  （队列空，等待有数据）        │
        └─────────────────────────────────────────────────────────┘
```

**await() 的完整流程：**

```java
public final void await() throws InterruptedException {
    if (Thread.interrupted()) throw new InterruptedException();

    // ① 把当前线程包装成 Node（CONDITION 状态），加入【条件队列】尾部
    Node node = addConditionWaiter();

    // ② ★ 完全释放锁（保存当前 state，重入的也全部释放），返回释放前的 state
    int savedState = fullyRelease(node);

    int interruptMode = 0;

    // ③ ★ 检查自己是否在【同步队列】中（signal 会把它移到同步队列）
    //    不在 → park 阻塞
    while (!isOnSyncQueue(node)) {
        LockSupport.park(this);                    // ★ 阻塞（WAITING）
        if ((interruptMode = checkInterruptWhileWaiting(node)) != 0) break;
    }

    // ④ 被唤醒后（已在同步队列），重新竞争锁（acquireQueued）
    if (acquireQueued(node, savedState) && interruptMode != THROW_IE)
        interruptMode = REINTERRUPT;

    // ⑤ 清理条件队列中的取消节点
    if (node.nextWaiter != null) unlinkCancelledWaiters();

    // ⑥ 处理中断
    if (interruptMode != 0) reportInterruptAfterWait(interruptMode);
}

// fullyRelease：完全释放锁（把重入计数一次性清零）
final int fullyRelease(Node node) {
    boolean failed = true;
    try {
        int savedState = getState();               // ★ 保存重入次数
        if (release(savedState)) {                  // 一次性释放全部
            failed = false;
            return savedState;                       // 返回给 await 后重新获取时用
        } else {
            throw new IllegalMonitorStateException();   // 没持有锁就 await
        }
    } finally {
        if (failed) node.waitStatus = Node.CANCELLED;
    }
}
```

**signal() 的流程：**

```java
public final void signal() {
    if (!isHeldExclusively())                       // ★ 必须持有锁
        throw new IllegalMonitorStateException();
    Node first = firstWaiter;
    if (first != null)
        doSignal(first);
}

private void doSignal(Node first) {
    do {
        if ((firstWaiter = first.nextWaiter) == null)   // ① 摘除头节点
            lastWaiter = null;
        first.nextWaiter = null;
    } while (!transferForSignal(first) &&               // ② ★ 转移到同步队列
             (first = firstWaiter) != null);             //    失败则试下一个
}

final boolean transferForSignal(Node node) {
    if (!compareAndSetWaitStatus(node, Node.CONDITION, 0))   // CAS 改状态
        return false;                                          // 节点已取消

    Node p = enq(node);                    // ★ 加入【同步队列】尾部，返回前驱
    int ws = p.waitStatus;
    if (ws > 0 || !compareAndSetWaitStatus(p, ws, Node.SIGNAL))
        LockSupport.unpark(node.thread);     // 前驱已取消或设置失败 → 直接唤醒
    return true;
}
// 注意：signal 只是把节点移到同步队列，★ 被唤醒的线程还要重新竞争锁！
//      所以 signal 之后到该线程真正拿到锁之间有时间差
```

### 5.3 ArrayBlockingQueue 的双 Condition 实战（源码解析）★★★★★

**这是 Condition 最经典的应用：用两个条件队列分别管理「生产者等待」和「消费者等待」，实现精确唤醒。**

```java
public class ArrayBlockingQueue<E> extends AbstractQueue<E>
        implements BlockingQueue<E>, java.io.Serializable {

    final Object[] items;
    int takeIndex;                       // 下次 take 的位置
    int putIndex;                        // 下次 put 的位置
    int count;                           // 元素数量

    /** ★ 只用一把锁（对比 LinkedBlockingQueue 用两把锁） */
    final ReentrantLock lock;
    /** ★ 条件 1：队列不满，可以继续 put（生产者等待这个） */
    private final Condition notFull;
    /** ★ 条件 2：队列不空，可以继续 take（消费者等待这个） */
    private final Condition notEmpty;

    public ArrayBlockingQueue(int capacity, boolean fair) {
        this.items = new Object[capacity];
        lock = new ReentrantLock(fair);
        notEmpty = lock.newCondition();       // ★ 同一把锁的两个条件
        notFull  = lock.newCondition();
    }

    // ─── put：满则阻塞 ───
    public void put(E e) throws InterruptedException {
        checkNotNull(e);
        final ReentrantLock lock = this.lock;
        lock.lockInterruptibly();                 // ① 加锁（可中断）
        try {
            while (count == items.length)          // ② ★ while 循环检查（防虚假唤醒）
                notFull.await();                    // ③ 队列满 → 在 notFull 条件队列等待（释放锁）
            enqueue(e);                             // ④ 入队
        } finally {
            lock.unlock();                          // ⑤ 释放锁
        }
    }

    private void enqueue(E x) {
        final Object[] items = this.items;
        items[putIndex] = x;
        if (++putIndex == items.length) putIndex = 0;   // 循环数组
        count++;
        notEmpty.signal();                          // ★ 精确唤醒一个消费者（不干扰其他生产者）
    }

    // ─── take：空则阻塞 ───
    public E take() throws InterruptedException {
        E x;
        int c = -1;
        final AtomicInteger count = this.count;      // （实际是 int 字段）
        final ReentrantLock lock = this.lock;
        lock.lockInterruptibly();
        try {
            while (count == 0)
                notEmpty.await();                    // ★ 队列空 → 在 notEmpty 条件队列等待
            x = dequeue();
        } finally {
            lock.unlock();
        }
        return x;
    }

    private E dequeue() {
        final Object[] items = this.items;
        E x = (E) items[takeIndex];
        items[takeIndex] = null;                      // ★ help GC
        if (++takeIndex == items.length) takeIndex = 0;
        count--;
        notFull.signal();                             // ★ 精确唤醒一个生产者
        return x;
    }

    // ─── 带超时的 offer/poll ───
    public boolean offer(E e, long timeout, TimeUnit unit) throws InterruptedException {
        long nanos = unit.toNanos(timeout);
        lock.lockInterruptibly();
        try {
            while (count == items.length) {
                if (nanos <= 0) return false;                 // 超时返回 false
                nanos = notFull.awaitNanos(nanos);             // ★ 返回剩余时间（扣除了唤醒耗时）
            }
            enqueue(e);
            return true;
        } finally {
            lock.unlock();
        }
    }
}
```

**用 wait/notifyAll 实现同样的逻辑会怎样？**

```java
// ❌ 只有一个等待队列（wait set）的版本
public synchronized void put(E e) throws InterruptedException {
    while (count == items.length) wait();       // 生产者和消费者都在同一个队列
    enqueue(e);
    notifyAll();                                 // ★ 必须 notifyAll！
}
public synchronized E take() throws InterruptedException {
    while (count == 0) wait();
    E x = dequeue();
    notifyAll();
    return x;
}
// 问题：
// 1. notifyAll 会唤醒所有等待线程（包括大量不该醒的生产者）→ 「惊群效应」
//    100 个生产者 + 100 个消费者，一次 take 唤醒 200 个线程，其中 199 个白醒
// 2. 用 notify 则可能「信号丢失」：唤醒的生产者发现队列满又 wait，消费者没被唤醒 → 挂死
// 3. 性能差：大量无效的锁竞争和上下文切换

// ✅ 双 Condition 的优势：
// put 成功后只 signal(notEmpty) → 精确唤醒 1 个消费者，生产者不受打扰
// take 成功后只 signal(notFull) → 精确唤醒 1 个生产者
// 这就是「精确通知」的价值
```

**LinkedBlockingQueue 的进一步优化：两把锁**

```java
// ArrayBlockingQueue：1 把锁 + 2 个 Condition（put 和 take 互斥）
// LinkedBlockingQueue：2 把锁（putLock + takeLock）+ 2 个 Condition
private final ReentrantLock takeLock = new ReentrantLock();
private final Condition notEmpty = takeLock.newCondition();
private final ReentrantLock putLock = new ReentrantLock();
private final Condition notFull = putLock.newCondition();
private final AtomicInteger count = new AtomicInteger();     // ★ 用 AtomicInteger 跨两把锁共享

// 好处：put 和 take 可以真正并发（不互斥）→ 吞吐量比 ArrayBlockingQueue 高
// 代价：count 必须用原子类；实现更复杂
```

## 6. ReentrantReadWriteLock 读写锁 ★★★★★

### 6.1 基本概念

```java
ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
Lock readLock = rwLock.readLock();
Lock writeLock = rwLock.writeLock();

// 读操作：多个线程可同时持有读锁（共享）
readLock.lock();
try { return data; } finally { readLock.unlock(); }

// 写操作：独占（排斥所有读和写）
writeLock.lock();
try { data = newData; } finally { writeLock.unlock(); }
```

**读写锁的规则（互斥矩阵）：**

| 已持有 \ 请求 | 读锁 | 写锁 |
| --- | --- | --- |
| **无锁** | ✅ 允许 | ✅ 允许 |
| **读锁** | ✅ **允许**（读读共享） | ❌ 阻塞 |
| **写锁** | ❌ 阻塞 | ✅ 允许（**写写可重入**） |

**核心价值：读多写少的场景下，读操作完全并发，性能远超 `synchronized`/`ReentrantLock`。**

### 6.2 state 的位分割设计（精妙）★★★★★

```java
// ReentrantReadWriteLock 只用一个 int state，通过「按位切割」同时表示读锁和写锁
abstract static class Sync extends AbstractQueuedSynchronizer {

    static final int SHARED_SHIFT   = 16;
    static final int SHARED_UNIT    = (1 << SHARED_SHIFT);        // 65536
    static final int MAX_COUNT      = (1 << SHARED_SHIFT) - 1;    // 65535（读锁/写锁的最大计数）
    static final int EXCLUSIVE_MASK = (1 << SHARED_SHIFT) - 1;    // 0x0000FFFF

    /** ★ 高 16 位：读锁被持有的总次数（所有线程累加） */
    static int sharedCount(int c)    { return c >>> SHARED_SHIFT; }
    /** ★ 低 16 位：写锁的重入次数 */
    static int exclusiveCount(int c) { return c & EXCLUSIVE_MASK; }

    /** ★ 每个线程的读锁重入次数（用 ThreadLocal 保存，因为高 16 位是所有线程的总和） */
    static final class HoldCounter {
        int count = 0;
        final long tid = getThreadId(Thread.currentThread());
    }
    static final class ThreadLocalHoldCounter extends ThreadLocal<HoldCounter> {
        public HoldCounter initialValue() { return new HoldCounter(); }
    }
    private transient ThreadLocalHoldCounter readHolds;      // 当前线程的读锁计数
    private transient HoldCounter cachedHoldCounter;         // ★ 缓存「最后一个获取读锁的线程」的计数（优化）
    private transient Thread firstReader = null;             // ★ 第一个获取读锁的线程（快速路径优化）
    private transient int firstReaderHoldCount;
}
```

**图解 state 的结构：**

```
        31              16 15               0
        ┌─────────────────┬─────────────────┐
state = │   读锁持有总数     │   写锁重入次数    │
        │  (sharedCount)   │ (exclusiveCount) │
        └─────────────────┴─────────────────┘

例：state = 0x00020001 = 131073
   读锁被持有 2 次（可能是 2 个线程各 1 次，或 1 个线程重入 2 次）
   写锁重入 1 次
   ⚠️ 读锁和写锁不可能同时非零（写锁独占时会排斥读锁）

firstReader / cachedHoldCounter 的优化：
  - 读锁的持有计数是「全局总数」，无法知道「当前线程持有几次」
  - 用 ThreadLocal<HoldCounter> 记录每个线程的重入次数
  - 但 ThreadLocal 查找有开销，所以缓存两个特例：
    firstReader：第一个获取读锁且未释放的线程（大部分场景只有 1~2 个读线程时命中率高）
    cachedHoldCounter：最后一个获取读锁的线程（连续读的场景命中）
```

### 6.3 读锁的获取（tryAcquireShared）

```java
protected final int tryAcquireShared(int unused) {
    Thread current = Thread.currentThread();
    int c = getState();

    // ① ★ 写锁被其他线程持有 → 读锁获取失败（读写互斥）
    if (exclusiveCount(c) != 0 &&
        getExclusiveOwnerThread() != current)
        return -1;

    int r = sharedCount(c);                       // 当前读锁总数

    // ② 检查是否需要阻塞（公平锁检查队列；非公平锁检查 head 是否有等待者）
    if (!readerShouldBlock() &&
        r < MAX_COUNT &&
        compareAndSetState(c, c + SHARED_UNIT)) {  // ③ ★ CAS 增加高 16 位
        if (r == 0) {                               // ④ 第一个读线程
            firstReader = current;
            firstReaderHoldCount = 1;
        } else if (firstReader == current) {         // ⑤ firstReader 重入
            firstReaderHoldCount++;
        } else {                                     // ⑥ 其他线程：更新 HoldCounter
            HoldCounter rh = cachedHoldCounter;
            if (rh == null || rh.tid != getThreadId(current))
                cachedHoldCounter = rh = readHolds.get();
            else if (rh.count == 0)
                readHolds.set(rh);
            rh.count++;
        }
        return 1;                                    // ★ 返回正数表示成功且有剩余（共享模式）
    }
    return fullTryAcquireShared(current);             // CAS 失败或需要阻塞 → 自旋重试
}

// 公平 vs 非公平的 readerShouldBlock
final boolean writerShouldBlock() { return hasQueuedPredecessors(); }      // 公平
final boolean readerShouldBlock() { return hasQueuedPredecessors(); }      // 公平锁版
final boolean readerShouldBlock() {                                        // 非公平锁版（★ 特殊）
    return apparentlyFirstQueuedIsExclusive();
}
// apparentlyFirstQueuedIsExclusive：如果队列头部的下一个节点是「写请求」，则读请求应该阻塞
// ★ 这是为了避免「写线程饥饿」：非公平模式下如果读请求源源不断，写线程永远抢不到锁
```

### 6.4 锁降级与锁升级

```java
// ─── 锁降级（Lock Downgrading）：写锁 → 读锁，★ 支持 ───
// 场景：写完数据后立即读，需要保证读到的数据不被其他线程修改
public void processWithDowngrade() {
    writeLock.lock();
    try {
        // ① 写数据
        data = computeNewData();

        // ② ★ 在释放写锁之前先获取读锁（这就是「降级」）
        readLock.lock();
    } finally {
        writeLock.unlock();               // ③ 释放写锁，此时仍持有读锁
    }

    try {
        // ④ 现在持有读锁，可以安全地读数据（其他写线程进不来）
        return useData(data);
    } finally {
        readLock.unlock();                // ⑤ 释放读锁
    }
}
// 为什么要降级？如果不降级：
//   writeLock.unlock();  →  readLock.lock();
// 这两步之间有其他线程可能插入并修改 data → 读到的不是自己刚写的数据

// ─── 锁升级（Lock Upgrading）：读锁 → 写锁，★ 不支持（会死锁）───
readLock.lock();
try {
    if (needUpdate()) {
        writeLock.lock();          // ★ 死锁！写锁要等所有读锁释放，而自己持有读锁
        try { update(); } finally { writeLock.unlock(); }
    }
} finally {
    readLock.unlock();
}
// 原因：写锁是独占的，获取写锁需要「没有任何线程持有读锁」，
//      而当前线程自己就持有读锁 → 自己等自己 → 永久阻塞
// ✅ 正确做法：先释放读锁，再获取写锁（会有并发窗口，需要业务上处理）
readLock.unlock();
writeLock.lock();
try { 
    // 双重检查：可能其他线程已经更新过了
    if (stillNeedUpdate()) update(); 
} finally { writeLock.unlock(); }
```

### 6.5 读写锁的问题与 StampedLock

**ReentrantReadWriteLock 的三大痛点：**

| 问题 | 说明 |
| --- | --- |
| **写饥饿** | 读请求源源不断时，写线程可能长期抢不到锁（非公平模式已通过 `apparentlyFirstQueuedIsExclusive` 缓解） |
| **读锁不支持 Condition** | `readLock().newCondition()` 抛 `UnsupportedOperationException` |
| **读锁无法中断写等待** | 写锁等待时，大量读锁持有会导致长时间阻塞 |

**StampedLock（JDK 8）—— 更高性能的读写锁 ★★★★★**

```java
import java.util.concurrent.locks.StampedLock;

public class PointPosition {
    private double x, y;
    private final StampedLock sl = new StampedLock();

    // ─── 写锁（独占，悲观）───
    public void move(double deltaX, double deltaY) {
        long stamp = sl.writeLock();               // ★ 返回「邮戳」（stamp），代表锁的版本
        try {
            x += deltaX;
            y += deltaY;
        } finally {
            sl.unlockWrite(stamp);                 // ★ 必须传入 stamp 解锁
        }
    }

    // ─── 乐观读（★ StampedLock 的核心创新，完全不加锁！）───
    public double distanceFromOrigin() {
        long stamp = sl.tryOptimisticRead();       // ① 获取一个 stamp（不加锁，只是记录版本）
        double currentX = x, currentY = y;          // ② ★ 读取数据到局部变量（无锁）
        if (!sl.validate(stamp)) {                   // ③ 验证期间是否发生过写操作
            stamp = sl.readLock();                    // ④ 被写过 → 升级为悲观读锁，重读
            try {
                currentX = x;
                currentY = y;
            } finally {
                sl.unlockRead(stamp);
            }
        }
        return Math.sqrt(currentX * currentX + currentY * currentY);
    }

    // ─── 悲观读锁 ───
    public double getX() {
        long stamp = sl.readLock();
        try { return x; } finally { sl.unlockRead(stamp); }
    }

    // ─── ★ 锁升级：读锁 → 写锁（ReentrantReadWriteLock 做不到！）───
    public void moveIfAtOrigin(double newX, double newY) {
        long stamp = sl.readLock();                 // 先拿读锁
        try {
            while (x == 0.0 && y == 0.0) {
                long ws = sl.tryConvertToWriteLock(stamp);    // ★ 尝试升级为写锁
                if (ws != 0L) {                                // 升级成功
                    stamp = ws;                                 // 用新的 stamp
                    x = newX;
                    y = newY;
                    break;
                } else {                                       // 升级失败（有其他读线程）
                    sl.unlockRead(stamp);                       // 释放读锁
                    stamp = sl.writeLock();                     // 直接获取写锁
                }
            }
        } finally {
            sl.unlock(stamp);                                   // ★ unlock 通用（自动判断锁类型）
        }
    }

    // ─── 锁降级：写锁 → 读锁 ───
    public void downgradeExample() {
        long stamp = sl.writeLock();
        try {
            x = 1; y = 2;
            long rs = sl.tryConvertToReadLock(stamp);          // ★ 降级为读锁
            if (rs != 0L) {
                stamp = rs;
            } else {
                sl.unlockWrite(stamp);
                stamp = sl.readLock();
            }
            // 此时持有读锁，可以继续读
        } finally {
            sl.unlock(stamp);
        }
    }
}
```

**三种锁的对比：**

| 对比 | ReentrantLock | ReentrantReadWriteLock | **StampedLock** |
| --- | --- | --- | --- |
| 模式 | 独占 | 读共享 / 写独占 | **乐观读** / 读共享 / 写独占 |
| 乐观读 | ❌ | ❌ | ✅ **不加锁，只验证版本** |
| 可重入 | ✅ | ✅ | ❌ **不支持！** |
| Condition | ✅ | 只有写锁支持 | ❌ 不支持 |
| 公平性 | 可选 | 可选 | ❌ 不支持（始终非公平） |
| 锁升级（读→写） | — | ❌ 死锁 | ✅ `tryConvertToWriteLock` |
| 锁降级（写→读） | — | ✅ | ✅ `tryConvertToReadLock` |
| 中断响应 | ✅ | ✅ | ✅ `readLockInterruptibly` / `writeLockInterruptibly` |
| 性能（读多写少） | 低 | 中 | **高**（乐观读无锁） |
| 内存/CPU 占用 | — | — | 更低（乐观读不阻塞写） |
| 使用难度 | 低 | 中 | **高**（易出错，stamp 管理复杂） |

> 【坑】**StampedLock 的三大注意事项：**
> 1. **不可重入**：同一线程重复获取写锁会**死锁**！（没有持有者记录和计数）
> 2. **不支持 Condition**：无法做等待/通知。
> 3. **乐观读的数据可能是「脏」的**：读取字段到局部变量期间可能被修改，必须 `validate` 后重读。**不要直接把乐观读的数据用于业务逻辑而不验证**。
> 4. `unlock(stamp)` 是通用方法，但如果 stamp 不匹配当前锁状态会抛 `IllegalMonitorStateException`。
>
> 【实践建议】**优先用 `ReentrantReadWriteLock`**（成熟、可重入、有 Condition）；只有在**读远多于写 + 性能瓶颈确认 + 团队理解 StampedLock** 时才用 StampedLock。JDK 内部（如 `ConcurrentHashMap` 的部分实现思路）和 Caffeine 缓存用了类似思想。

### 6.6 读写锁的实战封装

```java
/**
 * 带缓存的读写锁封装（读多写少的通用模式）
 */
public class CachedService<K, V> {

    private final Map<K, V> cache = new HashMap<>();
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
    private final Lock readLock = rwLock.readLock();
    private final Lock writeLock = rwLock.writeLock();
    private final Function<K, V> loader;              // 缓存未命中时的加载函数

    public CachedService(Function<K, V> loader) { this.loader = loader; }

    public V get(K key) {
        // ① 先用读锁快速查缓存（大部分请求在这里返回）
        readLock.lock();
        try {
            V value = cache.get(key);
            if (value != null) return value;
        } finally {
            readLock.unlock();
        }

        // ② 缓存未命中 → 写锁加载
        writeLock.lock();
        try {
            // ★ 双重检查：可能其他线程已经加载了
            V value = cache.get(key);
            if (value != null) return value;

            value = loader.apply(key);                // 从 DB / 远程加载
            if (value != null) cache.put(key, value);
            return value;
        } finally {
            writeLock.unlock();
        }
    }

    public void invalidate(K key) {
        writeLock.lock();
        try { cache.remove(key); } finally { writeLock.unlock(); }
    }

    public void clear() {
        writeLock.lock();
        try { cache.clear(); } finally { writeLock.unlock(); }
    }

    /** 返回缓存的快照（读锁保护下拷贝，避免返回视图） */
    public Map<K, V> snapshot() {
        readLock.lock();
        try { return new HashMap<>(cache); } finally { readLock.unlock(); }
    }

    /** 诊断信息 */
    public String lockStatus() {
        return String.format("读锁持有数=%d, 写锁重入数=%d, 等待线程数=%d, 当前线程持有写锁=%b",
                rwLock.getReadLockCount(),
                rwLock.getWriteHoldCount(),
                rwLock.getQueueLength(),
                rwLock.isWriteLockedByCurrentThread());
    }
}
```

> 【注意】这个例子的读锁 → 写锁转换有并发窗口（释放读锁后到获取写锁之间），所以写锁内必须**双重检查**。这是读写锁使用中的标准模式。生产环境的本地缓存直接用 **Caffeine**（内部用了更精细的并发控制，性能和命中率都更好）。

## 7. Lock 的实战应用与坑

### 7.1 用 Lock 解决 synchronized 无法解决的问题

```java
// ─── 场景 1：可中断的锁等待（避免死锁的实用手段）───
public boolean transferWithInterrupt(Account from, Account to, BigDecimal amount)
        throws InterruptedException {
    Account first = from.getId() < to.getId() ? from : to;
    Account second = from.getId() < to.getId() ? to : from;

    try {
        first.getLock().lockInterruptibly();          // ★ 等锁时可被中断
        try {
            second.getLock().lockInterruptibly();
            try {
                from.withdraw(amount);
                to.deposit(amount);
                return true;
            } finally { second.getLock().unlock(); }
        } finally { first.getLock().unlock(); }
    } catch (InterruptedException e) {
        // 被中断 → 释放已持有的锁，回滚
        Thread.currentThread().interrupt();
        log.warn("转账被中断，已释放锁");
        return false;
    }
}

// ─── 场景 2：tryLock 打破死锁（带随机退避避免活锁）───
public boolean transferWithRetry(Account from, Account to, BigDecimal amount) {
    int maxAttempts = 10;
    for (int attempt = 0; attempt < maxAttempts; attempt++) {
        boolean gotFirst = false, gotSecond = false;
        try {
            gotFirst = from.getLock().tryLock(50, TimeUnit.MILLISECONDS);
            gotSecond = to.getLock().tryLock(50, TimeUnit.MILLISECONDS);
            if (gotFirst && gotSecond) {
                from.withdraw(amount);
                to.deposit(amount);
                return true;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } finally {
            if (gotFirst) from.getLock().unlock();
            if (gotSecond) to.getLock().unlock();
        }
        // ★ 都没拿到 → 随机退避后重试（避免活锁：两个线程总是同步地冲突）
        try {
            Thread.sleep(ThreadLocalRandom.current().nextInt(1, 10));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
    throw new BusinessException("转账失败：无法获取锁，请稍后重试");
}

// ─── 场景 3：分布式限流的本地降级 ───
public Object queryWithLock(String key) {
    if (lock.tryLock()) {                              // 非阻塞：拿不到锁直接降级
        try { return queryFromDb(key); } finally { lock.unlock(); }
    }
    return cache.getOrDefault(key, DEFAULT_VALUE);      // 降级返回缓存/默认值
}
```

### 7.2 Lock 使用的常见坑

```java
// 坑 1：忘记 unlock（异常路径）→ 锁永不释放
// ✅ 必须 finally

// 坑 2：lock() 在 try 内 → unlock 抛 IllegalMonitorStateException
// ✅ lock() 必须在 try 之前

// 坑 3：锁对象是局部变量或每次 new → 锁不住任何东西
public void bad() {
    Lock lock = new ReentrantLock();      // ❌ 每次调用都是新锁
    lock.lock(); ...
}
// ✅ 锁必须是共享的字段（private final Lock lock = new ReentrantLock();）

// 坑 4：StampedLock 重入 → 死锁
StampedLock sl = new StampedLock();
long stamp = sl.writeLock();
long stamp2 = sl.writeLock();              // ❌ 永久阻塞（不可重入）

// 坑 5：乐观读未 validate 就用数据 → 脏读
long stamp = sl.tryOptimisticRead();
double x = this.x, y = this.y;
// ❌ 直接用 x, y 计算 → 可能读到不一致的中间状态
if (!sl.validate(stamp)) { /* 必须重读 */ }

// 坑 6：读锁中获取写锁 → 死锁（锁升级不支持）
// ✅ 先释放读锁，再获取写锁 + 双重检查

// 坑 7：Condition 的 await 用 if 而非 while → 虚假唤醒
if (count == 0) notEmpty.await();          // ❌
while (count == 0) notEmpty.await();       // ✅

// 坑 8：await 前未持有锁 → IllegalMonitorStateException
condition.await();                          // ❌ 没有 lock.lock()

// 坑 9：signal 后期望立即执行 → 被唤醒的线程还要重新竞争锁
notFull.signal();
// ★ 此时等待的线程只是从条件队列移到同步队列，还没获得锁！

// 坑 10：读写锁的读锁不支持 Condition
readLock.newCondition();                    // ❌ UnsupportedOperationException

// 坑 11：unlock 不是自己持有的锁 → IllegalMonitorStateException
// synchronized 也一样（monitorexit 检查 owner）

// 坑 12：锁粒度不当
private final Lock globalLock = new ReentrantLock();
// ❌ 所有数据一把锁 → 并发度为 1
// ✅ 分段锁（如 ConcurrentHashMap 的思想）或按 key 加锁
private final Map<String, ReentrantLock> keyLocks = new ConcurrentHashMap<>();

// 坑 13：按 key 加锁时未清理 → 内存泄漏
ReentrantLock lock = keyLocks.computeIfAbsent(key, k -> new ReentrantLock());
// ★ 用完要 remove（或用 Guava Striped 固定数量的锁，避免无限增长）
Striped<Lock> striped = Striped.lock(64);   // Guava：固定 64 把锁，按 key 哈希分配
Lock lock = striped.get(key);
```

## 8. 锁的分类总结（面试速答）

| 分类维度 | 类型 | 说明 | 代表 |
| --- | --- | --- | --- |
| **悲观 / 乐观** | 悲观锁 | 假设一定会冲突，先加锁再操作 | `synchronized`、`ReentrantLock` |
| | 乐观锁 | 假设不冲突，更新时 CAS 校验 | `AtomicXxx`、数据库 version 字段、`StampedLock` 乐观读 |
| **公平 / 非公平** | 公平锁 | 按等待顺序获取（FIFO） | `ReentrantLock(true)` |
| | 非公平锁 | 允许插队（吞吐量高） | `synchronized`、`ReentrantLock()` 默认 |
| **独占 / 共享** | 独占锁（排他锁） | 同时只能一个线程持有 | `ReentrantLock`、写锁 |
| | 共享锁 | 多个线程可同时持有 | 读锁、`Semaphore`、`CountDownLatch` |
| **可重入 / 不可重入** | 可重入锁 | 同一线程可重复获取（计数） | `synchronized`、`ReentrantLock` |
| | 不可重入锁 | 重复获取会死锁 | `StampedLock` |
| **自旋锁** | — | 循环尝试获取，不阻塞（适合锁持有时间极短 + 多核） | CAS 自旋、`Thread.onSpinWait()` |
| **偏向 / 轻量 / 重量** | 锁升级 | `synchronized` 的三态优化（JDK 6） | 见 [[后端/Java基础/并发编程/线程安全与synchronized]] |
| **分段锁** | — | 把数据分段，每段一把锁，提高并发度 | JDK 7 `ConcurrentHashMap` 的 Segment、`Striped` |
| **读写锁** | — | 读共享、写独占 | `ReentrantReadWriteLock`、`StampedLock` |
| **分布式锁** | — | 跨 JVM/跨机器的互斥 | Redis（Redisson）、ZooKeeper、数据库 |
| **无锁** | — | CAS + volatile，不使用锁 | `AtomicXxx`、`LongAdder`、`ConcurrentLinkedQueue` |
| **数据库锁** | 行锁/表锁/间隙锁/临键锁 | InnoDB 的锁机制 | 见 [[后端/数据库/MySQL/事务与锁机制]] |

## 9. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `lock()` 写在 try 内 | `IllegalMonitorStateException` | `lock()` 在 try 之前 |
| 2 | 忘记 `finally unlock` | 锁永不释放，系统卡死 | 必须 finally |
| 3 | 锁对象是局部变量 | 锁不生效 | 锁必须是共享字段（final） |
| 4 | `unlock` 次数多于 `lock` | `IllegalMonitorStateException` | `isHeldByCurrentThread()` 保护 |
| 5 | 公平锁性能期望过高 | 吞吐量比非公平低 10 倍 | 默认用非公平 |
| 6 | StampedLock 重入 | **死锁** | 不支持重入，改用 ReadWriteLock |
| 7 | 乐观读不 validate | 脏数据 | 必须 `validate` 后重读 |
| 8 | 读写锁「锁升级」 | 死锁 | 先释放读锁再取写锁 + 双重检查 |
| 9 | 读锁调 `newCondition` | `UnsupportedOperationException` | 只有写锁支持 Condition |
| 10 | `Condition.await` 用 if | 虚假唤醒导致状态错误 | `while` 循环 |
| 11 | `await` 前未加锁 | `IllegalMonitorStateException` | 先 `lock.lock()` |
| 12 | 用 notify 代替 signalAll | 信号丢失 | 明确唤醒条件用对应 Condition |
| 13 | 按 key 加锁不清理 | 内存泄漏（Map 无限增长） | 用完 remove 或用 Guava `Striped` |
| 14 | 死锁时用 synchronized | 无法中断/超时，只能重启 | 用 `tryLock(timeout)` + 固定加锁顺序 |
| 15 | 读多写少用 ReentrantLock | 读操作也互斥，并发度低 | 用 `ReentrantReadWriteLock` |
| 16 | 写锁持有时间过长 | 大量读线程阻塞 | 缩小写临界区，写操作异步化 |
| 17 | 锁内做 IO/RPC | 吞吐量骤降 | 锁外做 IO，锁内只改内存状态 |
| 18 | 期望 `tryLock()` 无参版会等待 | 立即返回 false | 用带超时版本 |
| 19 | 分布式环境用本地锁 | 多实例下锁不住 | Redis/ZooKeeper 分布式锁 |
| 20 | 虚拟线程中用 synchronized | pinning 载体线程 | JDK 21+ 改用 `ReentrantLock` |

---

## 关联笔记

- 上一篇：[[后端/Java基础/并发编程/volatile与CAS原子类]]
- 下一篇：[[后端/Java基础/并发编程/线程池原理与实战]]
- 相关：[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]（Semaphore、CountDownLatch 基于 AQS）
- 对比：[[后端/Java基础/并发编程/线程安全与synchronized]]（synchronized vs Lock）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
