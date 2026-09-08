---
title: "线程池原理与实战"
aliases:
  - "ThreadPoolExecutor"
  - "线程池七大参数"
tags:
  - "后端"
  - "java"
  - "并发"
  - "面试"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/并发编程/Lock与AQS原理]]"
  - "[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]"
  - "[[后端/Java基础/并发编程/异步编程-CompletableFuture]]"
  - "[[后端/SpringBoot/整合Web开发]]"
created: 2026-09-07
updated: 2026-09-07
---

# 线程池原理与实战

## 1. 为什么要用线程池

| 收益 | 说明 |
| --- | --- |
| **降低资源消耗** | 复用已创建的线程，避免频繁创建/销毁（一个平台线程创建约 1ms + 1MB 栈内存） |
| **提高响应速度** | 任务到达时无需等待线程创建 |
| **提高可管理性** | 统一分配、调优、监控线程 |
| **流量削峰** | 用队列缓冲突发请求，避免系统被打垮 |
| **控制并发数** | 防止资源耗尽（如数据库连接、下游服务被压垮） |

```java
// ❌ 不用线程池：每个任务 new 一个线程
for (int i = 0; i < 100000; i++) {
    new Thread(() -> handle(request)).start();
}
// 后果：10 万线程 × 1MB 栈 = 100GB 内存 → OOM: unable to create new native thread
//      且大量上下文切换，CPU 全部耗在调度上，吞吐量反而下降

// ✅ 用线程池
ExecutorService pool = new ThreadPoolExecutor(...);
for (int i = 0; i < 100000; i++) {
    pool.submit(() -> handle(request));        // 复用固定数量的线程
}
```

## 2. Executor 框架体系

```
                    Executor（接口）
                   void execute(Runnable)
                        │
                        ▼
              ExecutorService（接口）★ 最常用
        submit / shutdown / invokeAll / Future
                        │
        ┌───────────────┼────────────────┬──────────────────┐
        ▼               ▼                ▼                  ▼
 AbstractExecutorService  ScheduledExecutorService  ForkJoinPool（JDK 7）
        │               │                │                  │
        ▼               ▼                ▼                  ▼
ThreadPoolExecutor ★  ScheduledThreadPoolExecutor   ForkJoinPool
        │                     │                      │
        │              DelayedWorkQueue         work-stealing
        │              （基于堆的延迟队列）        （分治、parallelStream）
        ▼
   Worker（内部类，继承 AQS）

工具类：Executors（★ 阿里手册禁止直接用！）
```

## 3. ThreadPoolExecutor 七大参数 ★★★★★

```java
public ThreadPoolExecutor(int corePoolSize,                  // ① 核心线程数
                          int maximumPoolSize,               // ② 最大线程数
                          long keepAliveTime,                // ③ 空闲线程存活时间
                          TimeUnit unit,                     // ④ 时间单位
                          BlockingQueue<Runnable> workQueue, // ⑤ 任务队列
                          ThreadFactory threadFactory,       // ⑥ 线程工厂
                          RejectedExecutionHandler handler)  // ⑦ 拒绝策略
```

| # | 参数 | 含义 | 配置要点 |
| --- | --- | --- | --- |
| ① | `corePoolSize` | **核心线程数**：即使空闲也不回收（除非设置 `allowCoreThreadTimeOut(true)`） | CPU 密集 = N+1；IO 密集 = 2N 或按公式 |
| ② | `maximumPoolSize` | **最大线程数**：队列满后能扩容到的上限 | 与队列容量共同决定「最大承载量」 |
| ③ | `keepAliveTime` | **非核心线程空闲存活时间**：超过则回收 | 通常 60s |
| ④ | `unit` | 时间单位 | `TimeUnit.SECONDS` |
| ⑤ | `workQueue` | **任务队列**：核心线程满时任务在此排队 | **必须有界**！见下文 |
| ⑥ | `threadFactory` | 线程工厂：自定义线程名、优先级、守护属性、异常处理器 | **必须命名**（jstack 排查） |
| ⑦ | `handler` | **拒绝策略**：队列满且线程数达 max 时如何处理 | 按业务选择，见下文 |

### 3.1 任务提交流程（核心）★★★★★

```java
// execute() 的源码（简化）
public void execute(Runnable command) {
    if (command == null) throw new NullPointerException();
    int c = ctl.get();                                   // ★ ctl：高3位状态 + 低29位线程数

    // ① 当前线程数 < corePoolSize → 创建核心线程执行
    if (workerCountOf(c) < corePoolSize) {
        if (addWorker(command, true))                      // true = 以 corePoolSize 为上限
            return;
        c = ctl.get();                                     // 创建失败，重新读 ctl
    }

    // ② 核心线程已满 → 尝试入队
    if (isRunning(c) && workQueue.offer(command)) {
        int recheck = ctl.get();
        if (!isRunning(recheck) && remove(command))         // ★ 双重检查：入队后线程池可能已关闭
            reject(command);
        else if (workerCountOf(recheck) == 0)               // ★ 核心线程可能全部超时回收了
            addWorker(null, false);                          //   → 补一个非核心线程防止任务无人执行
    }

    // ③ 队列已满 → 创建非核心线程执行
    else if (!addWorker(command, false))                    // false = 以 maximumPoolSize 为上限
        // ④ 线程数已达 maximumPoolSize → 执行拒绝策略
        reject(command);
}
```

**流程图（必背）：**

```
        提交任务 execute(task)
              │
              ▼
    ┌──────────────────────┐
    │ 线程数 < corePoolSize? │
    └────┬─────────────┬───┘
      是 │             │ 否
         ▼             ▼
  ┌────────────┐   ┌──────────────────┐
  │ 创建核心线程 │   │  队列未满？offer   │
  │  执行任务    │   └───┬──────────┬───┘
  └────────────┘     是 │          │ 否
                        ▼          ▼
                 ┌──────────┐  ┌──────────────────────┐
                 │ 任务入队   │  │ 线程数 < maxPoolSize? │
                 │  等待执行  │  └───┬────────────┬─────┘
                 └──────────┘    是 │            │ 否
                                   ▼            ▼
                          ┌──────────────┐  ┌──────────────┐
                          │ 创建非核心线程 │  │ ★ 拒绝策略     │
                          │   执行任务    │  │  handler      │
                          └──────────────┘  └──────────────┘

关键顺序：核心线程 → 队列 → 非核心线程 → 拒绝
⚠️ 注意：是「先入队，队满才扩容到 max」，不是「先扩容再入队」！
   这与很多人的直觉相反，也是「无界队列导致 maximumPoolSize 失效」的原因
```

> 【面试】**为什么是「先入队再扩容」而不是「先扩容再入队」？**
>
> 设计者的考量：**创建线程的成本远高于入队**。如果队列还有空间就创建新线程，会导致线程数频繁波动。先入队能最大化复用现有线程。
>
> **副作用**：如果用**无界队列**（如 `LinkedBlockingQueue()` 不指定容量，默认 `Integer.MAX_VALUE`），队列永远不会满 → **`maximumPoolSize` 完全失效**，线程数永远等于 `corePoolSize` → 任务无限堆积 → **OOM**。这正是阿里手册禁止 `Executors.newFixedThreadPool` 的原因。

### 3.2 ctl 字段的位打包技巧

```java
// 用一个 AtomicInteger 同时存储「线程池状态」和「线程数量」，保证两者的原子更新
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));

private static final int COUNT_BITS = Integer.SIZE - 3;        // 29
private static final int COUNT_MASK = (1 << COUNT_BITS) - 1;    // 0x1FFFFFFF（低 29 位）

// 高 3 位：线程池状态（注意：数值是负数递减，便于比较）
private static final int RUNNING    = -1 << COUNT_BITS;         // 111...  -536870912
private static final int SHUTDOWN   =  0 << COUNT_BITS;         // 000...   0
private static final int STOP       =  1 << COUNT_BITS;         // 001...   536870912
private static final int TIDYING    =  2 << COUNT_BITS;         // 010...
private static final int TERMINATED =  3 << COUNT_BITS;         // 011...

private static int runStateOf(int c)     { return c & ~COUNT_MASK; }   // 取高 3 位
private static int workerCountOf(int c)  { return c & COUNT_MASK; }    // 取低 29 位
private static int ctlOf(int rs, int wc) { return rs | wc; }           // 组合

// 状态判断（利用数值的单调性，一次比较即可）
private static boolean isRunning(int c) { return c < SHUTDOWN; }

// 限制：最大线程数 = 2^29 - 1 = 536,870,911（约 5.3 亿，实践中不可能达到）
```

**这是「用位打包保证多字段原子性」的经典范例**，与 [[后端/Java基础/并发编程/volatile与CAS原子类]] 中提到的「CAS 只能保证单变量」问题正好呼应。

### 3.3 五种线程池状态与流转

| 状态 | 值（高3位） | 含义 | 接受新任务 | 处理队列任务 |
| --- | --- | --- | --- | --- |
| **RUNNING** | -1 | 正常运行 | ✅ | ✅ |
| **SHUTDOWN** | 0 | `shutdown()` 后：不接受新任务，但会处理完队列中的任务 | ❌ | ✅ |
| **STOP** | 1 | `shutdownNow()` 后：不接受新任务，**中断正在执行的任务，丢弃队列任务** | ❌ | ❌ |
| **TIDYING** | 2 | 所有任务已终止，workerCount = 0，即将执行 `terminated()` 钩子 | ❌ | ❌ |
| **TERMINATED** | 3 | `terminated()` 执行完毕，线程池彻底结束 | ❌ | ❌ |

```
            RUNNING
           ┌───┴────────────────┐
  shutdown()│                    │shutdownNow()
           ▼                    ▼
       SHUTDOWN ──队列空且线程为0──→ STOP
           │                    │
           └────────┬───────────┘
                    ▼
                TIDYING ──terminated() 完成──→ TERMINATED
```

```java
// 状态查询 API
pool.isShutdown();            // 是否调用了 shutdown/shutdownNow（不代表已终止）
pool.isTerminated();          // 是否已完全终止（所有任务结束）
pool.isTerminating();         // 是否正在终止过程中
pool.shutdown();              // 优雅关闭：不接新任务，处理完队列
pool.shutdownNow();           // 立即关闭：中断执行中任务，返回未执行的任务列表
pool.awaitTermination(60, TimeUnit.SECONDS);   // ★ 阻塞等待终止（配合 shutdown 用）
pool.setCorePoolSize(20);     // ★ 运行时动态调整（JDK 6+）
pool.setMaximumPoolSize(100);
pool.allowCoreThreadTimeOut(true);    // 核心线程也允许超时回收
pool.prestartAllCoreThreads();         // 预启动所有核心线程
pool.getPoolSize();                    // 当前线程数
pool.getActiveCount();                 // 正在执行任务的线程数（估算）
pool.getLargestPoolSize();             // 历史峰值线程数
pool.getTaskCount();                   // 总任务数（估算）
pool.getCompletedTaskCount();          // 已完成任务数
pool.getQueue().size();                // ★ 队列中等待的任务数（最重要的监控指标！）
```

**优雅关闭的标准写法（生产必备）：**

```java
public static void shutdownGracefully(ExecutorService pool, long timeout, TimeUnit unit) {
    pool.shutdown();                                    // ① 停止接收新任务
    try {
        if (!pool.awaitTermination(timeout, unit)) {     // ② 等待任务完成
            List<Runnable> dropped = pool.shutdownNow();  // ③ 超时则强制中断
            log.warn("线程池强制关闭，丢弃 {} 个任务", dropped.size());
            if (!pool.awaitTermination(timeout, unit)) {  // ④ 再等一次
                log.error("线程池未能正常终止");
            }
        }
    } catch (InterruptedException e) {
        pool.shutdownNow();                              // ⑤ 等待期间被中断
        Thread.currentThread().interrupt();
    }
}

// Spring Boot 中的优雅关闭
@Bean(destroyMethod = "shutdown")
public ExecutorService bizExecutor() { ... }

// 或实现 DisposableBean / @PreDestroy
@PreDestroy
public void destroy() {
    shutdownGracefully(pool, 30, TimeUnit.SECONDS);
}

// Spring Boot 2.3+ 内置优雅停机
// application.yml
// server:
//   shutdown: graceful
// spring:
//   lifecycle:
//     timeout-per-shutdown-phase: 30s
```

## 4. 四种拒绝策略 ★★★★★

当「队列已满 **且** 线程数达到 `maximumPoolSize`」时触发（或线程池已关闭）。

| 策略 | 行为 | 适用场景 |
| --- | --- | --- |
| **`AbortPolicy`**（默认） | 抛出 `RejectedExecutionException` | 重要任务，需要调用方感知失败并处理 |
| **`CallerRunsPolicy`** ★ | **由提交任务的线程自己执行**（如 main 线程、Tomcat 线程） | **最常用**：天然限流（调用线程被占用，无法继续提交，形成背压） |
| **`DiscardPolicy`** | **静默丢弃**新任务，不抛异常 | 可丢弃的任务（如日志采样）；⚠️ 极易掩盖问题 |
| **`DiscardOldestPolicy`** | 丢弃**队列中最老的任务**，然后重试提交新任务 | 新数据更有价值的场景（如实时行情） |

```java
// ─── CallerRunsPolicy 的源码与妙处 ───
public static class CallerRunsPolicy implements RejectedExecutionHandler {
    public void rejectedExecution(Runnable r, ThreadPoolExecutor e) {
        if (!e.isShutdown()) {
            r.run();          // ★ 直接在调用者线程执行（不是 start，是同步 run）
        }
    }
}
// 妙处：调用者线程被占用去执行任务 → 无法继续提交新任务 → 生产者被迫降速
//      这就是「背压（back-pressure）」，比抛异常或丢弃更平滑
// ⚠️ 风险：如果调用者是 Tomcat 的 HTTP 线程，会阻塞该请求，可能导致请求超时
//          如果调用者是 main 线程，主流程会变慢

// ─── 自定义拒绝策略（生产推荐）───
public class CustomRejectedHandler implements RejectedExecutionHandler {

    private final String poolName;
    private final LongAdder rejectedCount = new LongAdder();      // 统计拒绝次数

    public CustomRejectedHandler(String poolName) { this.poolName = poolName; }

    @Override
    public void rejectedExecution(Runnable r, ThreadPoolExecutor executor) {
        rejectedCount.increment();

        // ① 告警（★ 必须！拒绝意味着系统已过载）
        log.error("线程池 [{}] 任务被拒绝！活跃线程={}, 队列大小={}, 已完成={}, 累计拒绝={}",
                poolName,
                executor.getActiveCount(),
                executor.getQueue().size(),
                executor.getCompletedTaskCount(),
                rejectedCount.sum());
        alertService.send(AlertLevel.CRITICAL,
                String.format("线程池 %s 拒绝任务，队列已满", poolName));

        // ② 监控埋点（Micrometer）
        Metrics.counter("threadpool.rejected", "pool", poolName).increment();

        // ③ 持久化任务（降级：存到 DB / MQ，稍后重试）
        if (r instanceof PersistableTask task) {
            taskRepository.save(task.toEntity());        // 落库，由定时任务补偿
            return;
        }

        // ④ 根据业务决定：抛异常让上游感知（而非静默丢弃）
        throw new RejectedExecutionException(
                String.format("线程池 %s 已饱和，任务被拒绝", poolName));
    }

    public long getRejectedCount() { return rejectedCount.sum(); }
}
```

> 【强制】**生产环境必须自定义拒绝策略并加告警**。默认的 `AbortPolicy` 抛异常但没人知道，`DiscardPolicy` 静默丢弃更是灾难。**线程池拒绝任务 = 系统已过载 = 需要立即告警**。

## 5. 工作队列的选择 ★★★★★

| 队列 | 有界性 | 底层 | 特点 | 适用 |
| --- | --- | --- | --- | --- |
| **`ArrayBlockingQueue`** | **有界**（必须指定容量） | 数组 | 一把锁，FIFO，支持公平模式 | **★ 生产首选** |
| **`LinkedBlockingQueue`** | 可选（默认 `Integer.MAX_VALUE` = 无界） | 链表 | **两把锁**（putLock/takeLock），吞吐量更高 | 指定容量后可用 |
| `SynchronousQueue` | **0 容量** | 无缓冲 | 每个 put 必须等一个 take（直接交付） | `newCachedThreadPool`，任务必须立即有线程接手 |
| `PriorityBlockingQueue` | 无界 | 二叉堆 | 按优先级出队（任务需 Comparable） | 有优先级的任务 |
| `DelayQueue` | 无界 | PriorityQueue | 元素到期才能取出 | 定时任务、延迟执行 |
| `LinkedTransferQueue` | 无界 | 链表 | 支持 `transfer()`（等待消费者接收） | 高性能传递 |
| `LinkedBlockingDeque` | 有界 | 双向链表 | 双端队列 | 工作窃取 |

```java
// ✅ 推荐：有界队列 + 明确容量
new ArrayBlockingQueue<>(1000);                 // 数组，内存紧凑，FIFO
new LinkedBlockingQueue<>(1000);                 // 链表，两把锁吞吐更高

// ❌ 危险：无界队列（maximumPoolSize 失效 + OOM 风险）
new LinkedBlockingQueue<>();                     // 容量 Integer.MAX_VALUE
new PriorityBlockingQueue<>();
new DelayQueue<>();

// 容量怎么定？
// 队列容量 = 可接受的最大等待任务数
// 估算：队列容量 ≈ 平均处理耗时(ms) × 峰值QPS / 1000 × 可容忍的等待倍数
// 例：单任务 100ms，峰值 500 QPS，容忍 2 秒排队
//     → 500 × 2 = 1000 个任务在队列中
// 更实用：从小容量开始（如 200），观察监控（队列长度、拒绝次数），逐步调整
```

> 【坑】**队列容量过大 vs 过小的权衡：**
> - **过大**：任务积压时响应时间飙升（用户等了 30 秒才得到结果，不如快速失败），且内存占用高、GC 压力大。
> - **过小**：频繁触发拒绝/扩容，吞吐量下降。
> - **原则**：**面向用户的同步请求，队列要小（甚至用 SynchronousQueue）+ 快速失败**；**后台异步任务，队列可以大一些**（但不能无界）。

## 6. Executors 的四个工厂方法（了解 + 知道为什么禁用）★★★★★

```java
// ─── 1. newFixedThreadPool：固定大小线程池 ───
public static ExecutorService newFixedThreadPool(int nThreads) {
    return new ThreadPoolExecutor(nThreads, nThreads,        // core == max
                                  0L, TimeUnit.MILLISECONDS, // 非核心线程存活 0（因为没有非核心线程）
                                  new LinkedBlockingQueue<Runnable>());   // ★★ 无界队列！
}
// ❌ 风险：无界队列 → 任务无限堆积 → OOM: Java heap space
// ❌ maximumPoolSize 失效（永远等于 corePoolSize）

// ─── 2. newSingleThreadExecutor：单线程池（保证任务顺序执行）───
public static ExecutorService newSingleThreadExecutor() {
    return new FinalizableDelegatedExecutorService(          // ★ 包装类，禁止运行时改参数
        new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
                               new LinkedBlockingQueue<Runnable>()));   // ★★ 无界队列
}
// ❌ 同样的 OOM 风险
// ✅ 用途：需要严格顺序执行的任务（如日志写入、事件序列）
//    与 new Thread() 的区别：线程异常退出后会自动补充新线程，任务不丢失

// ─── 3. newCachedThreadPool：可缓存线程池 ───
public static ExecutorService newCachedThreadPool() {
    return new ThreadPoolExecutor(0, Integer.MAX_VALUE,      // ★★ 最大线程数无上限！
                                  60L, TimeUnit.SECONDS,
                                  new SynchronousQueue<Runnable>());   // 0 容量，直接交付
}
// ❌ 风险：任务提交速度 > 处理速度时，线程数无限增长
//        → OOM: unable to create new native thread
// ✅ 用途：执行大量短生命周期的异步任务（如小型 RPC 调用）
//    60 秒空闲线程会被回收，负载低时几乎不占资源

// ─── 4. newScheduledThreadPool：定时/周期任务线程池 ───
public static ScheduledExecutorService newScheduledThreadPool(int corePoolSize) {
    return new ScheduledThreadPoolExecutor(corePoolSize);
}
public class ScheduledThreadPoolExecutor extends ThreadPoolExecutor {
    public ScheduledThreadPoolExecutor(int corePoolSize) {
        super(corePoolSize, Integer.MAX_VALUE,               // ★★ max 无上限
              0, NANOSECONDS,
              new DelayedWorkQueue());                        // 无界延迟队列
    }
}
// ❌ 风险：DelayedWorkQueue 无界 → 定时任务堆积 OOM

// ─── 5. JDK 8 新增 ───
newSingleThreadScheduledExecutor();      // 单线程定时
newWorkStealingPool();                   // ForkJoinPool（并行度 = CPU 核数）
newWorkStealingPool(int parallelism);

// ─── 6. JDK 21 虚拟线程 ───
Executors.newVirtualThreadPerTaskExecutor();       // ★ 每个任务一个虚拟线程（百万级并发）
Executors.newThreadPerTaskExecutor(threadFactory);
```

> 【强制】阿里手册：**线程池不允许使用 `Executors` 去创建，而是通过 `ThreadPoolExecutor` 的方式**。
> 原因：
> - `FixedThreadPool` / `SingleThreadPool`：**允许的请求队列长度为 `Integer.MAX_VALUE`**，可能会堆积大量的请求，从而导致 OOM。
> - `CachedThreadPool` / `ScheduledThreadPool`：**允许的创建线程数量为 `Integer.MAX_VALUE`**，可能会创建大量的线程，从而导致 OOM。
>
> 【补充】`newSingleThreadExecutor` 返回的 `FinalizableDelegatedExecutorService` 还**禁止了运行时调参**（`setCorePoolSize` 抛异常），这是它额外的坑。

## 7. Worker 线程的实现原理

```java
// Worker 继承 AQS，实现「不可重入的独占锁」
private final class Worker extends AbstractQueuedSynchronizer implements Runnable {

    final Thread thread;              // ★ 由 threadFactory 创建的线程
    Runnable firstTask;                // 首个任务（可以为 null）
    volatile long completedTasks;

    Worker(Runnable firstTask) {
        setState(-1);                  // ★ 初始 state = -1，禁止中断（runWorker 前）
        this.firstTask = firstTask;
        this.thread = getThreadFactory().newThread(this);   // Worker 自己就是 Runnable
    }

    public void run() { runWorker(this); }

    // ★ 为什么 Worker 要用 AQS 实现锁，而不是直接 synchronized？
    // 因为要「不可重入」：
    //   - 线程正在执行任务时（持有 Worker 锁），不能被 interruptIdleWorkers 中断
    //   - shutdownNow 只会中断「空闲的」（能获取到 Worker 锁的）线程
    //   - 如果可重入，任务内部调用 pool.setCorePoolSize() 等方法时会中断自己 → 混乱

    protected boolean tryAcquire(int unused) {
        if (compareAndSetState(0, 1)) {         // ★ 不检查当前持有者 → 不可重入
            setExclusiveOwnerThread(Thread.currentThread());
            return true;
        }
        return false;
    }
}

// ─── runWorker：Worker 的核心循环 ★★★★★ ───
final void runWorker(Worker w) {
    Thread wt = Thread.currentThread();
    Runnable task = w.firstTask;
    w.firstTask = null;
    w.unlock();                                  // ★ state 从 -1 → 0，允许被中断

    boolean completedAbruptly = true;
    try {
        // ★★ 核心循环：执行首个任务，然后不断从队列取任务
        while (task != null || (task = getTask()) != null) {
            w.lock();                            // ① 加 Worker 锁（标记为忙碌）
            // ② 如果线程池正在 STOP，确保当前线程被中断
            if ((runStateAtLeast(ctl.get(), STOP) ||
                 (Thread.interrupted() && runStateAtLeast(ctl.get(), STOP))) &&
                !wt.isInterrupted())
                wt.interrupt();
            try {
                beforeExecute(wt, task);          // ③ ★ 钩子：任务执行前
                Throwable thrown = null;
                try {
                    task.run();                    // ④ ★ 执行任务（注意是 run 不是 start）
                } catch (RuntimeException x) { thrown = x; throw x; }
                  catch (Error x) { thrown = x; throw x; }
                  catch (Throwable x) { thrown = x; throw new Error(x); }
                finally {
                    afterExecute(task, thrown);    // ⑤ ★ 钩子：任务执行后（含异常）
                }
            } finally {
                task = null;
                w.completedTasks++;
                w.unlock();                        // ⑥ 释放 Worker 锁（标记为空闲）
            }
        }
        completedAbruptly = false;
    } finally {
        processWorkerExit(w, completedAbruptly);    // ⑦ Worker 退出处理
    }
}

// ─── getTask：从队列取任务（★ 线程复用的关键）───
private Runnable getTask() {
    boolean timedOut = false;
    for (;;) {
        int c = ctl.get();
        int rs = runStateOf(c);
        // 线程池已关闭 → 返回 null → Worker 退出
        if (rs >= SHUTDOWN && (rs >= STOP || workQueue.isEmpty())) {
            decrementWorkerCount();
            return null;
        }
        int wc = workerCountOf(c);
        // ★ timed：是否允许超时回收
        //   - 线程数 > corePoolSize → 非核心线程，允许超时回收
        //   - allowCoreThreadTimeOut = true → 核心线程也允许回收
        boolean timed = allowCoreThreadTimeOut || wc > corePoolSize;

        // 超时或线程数超限 → 回收线程
        if ((wc > maximumPoolSize || (timed && timedOut))
            && (wc > 1 || workQueue.isEmpty())) {
            if (compareAndDecrementWorkerCount(c)) return null;
            continue;
        }
        try {
            // ★ poll(timeout)：超时返回 null → 线程回收
            //   take()：一直阻塞等待 → 核心线程永不退出
            Runnable r = timed ?
                workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS) :
                workQueue.take();
            if (r != null) return r;
            timedOut = true;                        // poll 超时
        } catch (InterruptedException retry) {
            timedOut = false;
        }
    }
}
```

**「线程复用」的本质：** `getTask()` 中的 `workQueue.take()` 阻塞等待新任务。线程执行完一个任务后**不退出**，而是回到循环开头再次 `take()`，从而复用同一个线程处理后续任务。这就是线程池的核心机制。

## 8. 钩子方法与异常处理 ★★★★★

### 8.1 三个可重写的钩子

```java
public class MonitoredThreadPoolExecutor extends ThreadPoolExecutor {

    private final String poolName;
    private final ThreadLocal<Long> startTime = new ThreadLocal<>();
    private final LongAdder taskCount = new LongAdder();
    private final LongAdder totalCost = new LongAdder();

    public MonitoredThreadPoolExecutor(String poolName, int core, int max,
                                       long keepAlive, BlockingQueue<Runnable> queue) {
        super(core, max, keepAlive, TimeUnit.SECONDS, queue,
              new NamedThreadFactory(poolName),
              new CustomRejectedHandler(poolName));
        this.poolName = poolName;
    }

    /** ① 任务执行前（在 Worker 线程中调用） */
    @Override
    protected void beforeExecute(Thread t, Runnable r) {
        super.beforeExecute(t, r);
        startTime.set(System.nanoTime());
        log.debug("线程池[{}] 线程{} 开始执行任务 {}", poolName, t.getName(), r);
    }

    /** ② 任务执行后（★ 无论成功或异常都会调用，t 是抛出的异常） */
    @Override
    protected void afterExecute(Runnable r, Throwable t) {
        super.afterExecute(r, t);
        long cost = (System.nanoTime() - startTime.get()) / 1_000_000;
        startTime.remove();                                    // ★ 必须 remove，防内存泄漏
        taskCount.increment();
        totalCost.add(cost);

        // ★★ 关键：submit() 提交的任务，异常被封装在 Future 中，t 为 null！
        //    必须主动从 Future 中取出
        if (t == null && r instanceof Future<?>) {
            try {
                Future<?> future = (Future<?>) r;
                if (future.isDone()) {
                    future.get();                               // 触发 ExecutionException
                }
            } catch (CancellationException ce) {
                t = ce;
            } catch (ExecutionException ee) {
                t = ee.getCause();                               // ★ 真实异常
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
        }
        if (t != null) {
            log.error("线程池[{}] 任务执行异常，耗时 {}ms", poolName, cost, t);
            alertService.send("任务异常：" + t.getMessage());
        } else if (cost > 1000) {
            log.warn("线程池[{}] 慢任务，耗时 {}ms", poolName, cost);
        }
    }

    /** ③ 线程池完全终止后调用（可用于资源清理、最终报告） */
    @Override
    protected void terminated() {
        super.terminated();
        log.info("线程池[{}] 已终止。总任务数={}, 平均耗时={}ms",
                poolName, taskCount.sum(),
                taskCount.sum() == 0 ? 0 : totalCost.sum() / taskCount.sum());
    }
}
```

### 8.2 execute vs submit 的异常处理差异 ★★★★★

```java
ExecutorService pool = Executors.newFixedThreadPool(2);

// ─── execute：异常会抛到线程的 UncaughtExceptionHandler ───
pool.execute(() -> {
    throw new RuntimeException("execute 的异常");
});
// 控制台输出完整栈信息：
// Exception in thread "pool-1-thread-1" java.lang.RuntimeException: execute 的异常
//   at ...
// 然后该 Worker 线程终止，线程池会补充一个新线程

// ─── submit：异常被封装进 FutureTask，静默丢失！★★★ 大坑 ───
pool.submit(() -> {
    throw new RuntimeException("submit 的异常");
});
// ★ 控制台什么都没有！异常被吞了！
// 因为 FutureTask.run() 内部 catch 了所有异常并存到 outcome 字段

// FutureTask.run() 的源码
public void run() {
    ...
    try {
        result = c.call();
        set(result);                    // 成功
    } catch (Throwable ex) {
        setException(ex);                // ★ 异常存起来，不抛出
    }
}

// ✅ 三种解决方案
// 方案 1：调用 future.get()（会抛 ExecutionException）
Future<?> f = pool.submit(() -> { throw new RuntimeException("x"); });
try {
    f.get();
} catch (ExecutionException e) {
    log.error("任务异常", e.getCause());      // ★ 真实异常在 getCause()
}

// 方案 2：任务内部自己 try-catch（★ 推荐，最直接）
pool.submit(() -> {
    try {
        doWork();
    } catch (Throwable e) {                    // ★ 捕获 Throwable，包含 Error
        log.error("任务执行失败", e);
        // 补偿逻辑：告警、重试、落库
    }
});

// 方案 3：重写 afterExecute（★ 最彻底，全局兜底，见上文）

// 方案 4：execute + 自定义 ThreadFactory 的 UncaughtExceptionHandler
ThreadFactory factory = r -> {
    Thread t = new Thread(r);
    t.setUncaughtExceptionHandler((thread, ex) ->
        log.error("线程 {} 未捕获异常", thread.getName(), ex));
    return t;
};
```

> 【强制】**用 `submit` 提交的任务，要么显式 `future.get()` 处理异常，要么任务内部 try-catch，要么重写 `afterExecute`。绝不能「提交后不管」**，否则线上任务失败无人知晓。

## 9. 线程池参数配置 ★★★★★

### 9.1 理论公式

```
CPU 密集型（计算为主，很少阻塞）：
    线程数 = CPU 核数 + 1
    （+1 是为了在某线程因缺页中断等原因暂停时，额外线程能顶上，保证 CPU 不空闲）

IO 密集型（大量等待 IO：数据库、网络、文件）：
    线程数 = CPU 核数 × 2                    （经验值）
    或
    线程数 = CPU 核数 × (1 + 等待时间 / 计算时间)     （★ 精确公式）

    例：4 核 CPU，每个任务计算 10ms、IO 等待 90ms
        线程数 = 4 × (1 + 90/10) = 40
```

```java
// 获取 CPU 核数
int cpuCores = Runtime.getRuntime().availableProcessors();

// 通过 JMX 获取更精确的任务耗时
ThreadMXBean threadMXBean = ManagementFactory.getThreadMXBean();
long cpuTime = threadMXBean.getCurrentThreadCpuTime();      // 线程 CPU 时间（纳秒）
// 等待时间 = 总耗时 - CPU 时间
```

### 9.2 实际配置方法（★ 理论公式只是起点）

**理论公式在实践中往往不准，因为：**
1. 「等待时间/计算时间」难以精确测量，且随负载变化。
2. 容器环境（Docker/K8s）的 CPU 限制与宿主机核数不同。
3. 下游服务（数据库、Redis、第三方）的承载能力才是真正的瓶颈。
4. 任务耗时分布不均（长尾任务）。

**科学的配置流程：**

```
① 初步估算（用理论公式给一个起点）
      ↓
② 压测验证（用 JMeter/wrk 模拟真实流量，观察指标）
      ↓
③ 观察关键指标：
   - CPU 使用率（目标 60~80%，超过 90% 说明线程过多或任务太重）
   - 队列长度（持续增长 = 处理能力不足）
   - 拒绝次数（> 0 就必须扩容或优化）
   - 任务平均/P99 耗时
   - 下游资源（DB 连接池使用率、Redis QPS、第三方限流）
      ↓
④ 调整参数 → 回到 ② 迭代
      ↓
⑤ 上线后持续监控 + 支持动态调参
```

**各类任务的推荐配置：**

| 任务类型 | corePoolSize | maximumPoolSize | 队列 | keepAlive | 拒绝策略 |
| --- | --- | --- | --- | --- | --- |
| **CPU 密集**（加密、压缩、复杂计算） | N+1 | N+1（不需要扩容） | 小容量（如 N×10） | 60s | CallerRuns |
| **IO 密集**（DB、RPC、HTTP） | 2N ~ 4N | 可扩容到 8N | 中等（200~1000） | 60s | CallerRuns / 自定义 |
| **高并发短任务**（缓存刷新） | N | 4N | SynchronousQueue | 30s | Discard（可丢） |
| **批量后台任务**（报表、对账） | 4~8 | 8~16 | 大容量（5000+） | 300s | 自定义（落库重试） |
| **定时任务** | 按任务数 | — | DelayedWorkQueue | — | — |
| **Web 请求处理**（Tomcat） | 由容器管理 | maxThreads=200~800 | acceptCount | — | — |

```java
// 实战示例 1：订单异步通知线程池（IO 密集）
@Bean("notifyExecutor")
public ThreadPoolExecutor notifyExecutor() {
    int cores = Runtime.getRuntime().availableProcessors();
    return new ThreadPoolExecutor(
        cores * 2,                                  // core = 8（4 核机器）
        cores * 4,                                  // max = 16
        60L, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(500),               // ★ 有界
        new NamedThreadFactory("order-notify"),      // ★ 命名
        new CustomRejectedHandler("order-notify")    // ★ 自定义拒绝 + 告警
    );
}

// 实战示例 2：报表计算线程池（CPU 密集）
@Bean("reportExecutor")
public ThreadPoolExecutor reportExecutor() {
    int cores = Runtime.getRuntime().availableProcessors();
    ThreadPoolExecutor pool = new ThreadPoolExecutor(
        cores + 1, cores + 1,                        // core == max，不扩容
        0L, TimeUnit.MILLISECONDS,
        new LinkedBlockingQueue<>(100),
        new NamedThreadFactory("report-calc"),
        new ThreadPoolExecutor.CallerRunsPolicy()
    );
    pool.allowCoreThreadTimeOut(true);                // 空闲时也回收，节省资源
    return pool;
}

// 实战示例 3：不同业务隔离线程池（★ 舱壁模式 Bulkhead）
@Bean("paymentExecutor") public Executor paymentExecutor() { ... }     // 支付
@Bean("smsExecutor")     public Executor smsExecutor()     { ... }     // 短信
@Bean("logExecutor")     public Executor logExecutor()     { ... }     // 日志
// 目的：一个业务的线程池打满，不影响其他业务（避免故障扩散）
```

### 9.3 动态调参（美团实践）★★★★★

**线程池参数需要随业务变化调整，重启应用代价太大 → 支持运行时动态修改。**

```java
// ThreadPoolExecutor 原生支持动态调参（JDK 6+）
pool.setCorePoolSize(20);           // 修改核心线程数（会立即创建或中断多余线程）
pool.setMaximumPoolSize(100);        // 修改最大线程数
pool.setKeepAliveTime(120, TimeUnit.SECONDS);
pool.setRejectedExecutionHandler(newHandler);
pool.allowCoreThreadTimeOut(true);

// ⚠️ 注意：修改顺序有讲究
// 若 corePoolSize > maximumPoolSize 会抛 IllegalArgumentException
// 扩容时：先 setMaximumPoolSize 再 setCorePoolSize
// 缩容时：先 setCorePoolSize 再 setMaximumPoolSize
public void resize(ThreadPoolExecutor pool, int newCore, int newMax) {
    if (newCore > pool.getMaximumPoolSize()) {
        pool.setMaximumPoolSize(newMax);        // 先扩 max
        pool.setCorePoolSize(newCore);
    } else {
        pool.setCorePoolSize(newCore);           // 先缩 core
        pool.setMaximumPoolSize(newMax);
    }
}
// ⚠️ 队列容量无法动态修改（ArrayBlockingQueue 的 capacity 是 final）
//    解决方案：自定义 ResizableCapacityLinkedBlockingQueue（美团的做法）

/**
 * 结合配置中心（Nacos/Apollo）实现动态调参 ★ 美团 DynamicTp 的思路
 */
@Component
@RefreshScope                                    // Spring Cloud 配置刷新
public class DynamicThreadPoolConfig {

    @Autowired private ThreadPoolExecutor bizExecutor;

    @Value("${threadpool.biz.core-size:10}")
    private int coreSize;
    @Value("${threadpool.biz.max-size:50}")
    private int maxSize;
    @Value("${threadpool.biz.queue-capacity:1000}")
    private int queueCapacity;

    @EventListener
    public void onRefresh(EnvironmentChangeEvent event) {
        resize(bizExecutor, coreSize, maxSize);
        log.info("线程池参数已动态更新：core={}, max={}", coreSize, maxSize);
    }
}

// 开源方案：
// - 美团 DynamicTp：https://github.com/dromara/dynamic-tp（支持 Nacos/Apollo/Zookeeper，含监控告警）
// - Hippo4j：https://github.com/opengoofy/hippo4j
```

### 9.4 线程池监控（生产必备）★★★★★

```java
/**
 * 线程池监控：定时采集指标 + 暴露给 Prometheus
 */
@Component
@Slf4j
public class ThreadPoolMonitor {

    private final Map<String, ThreadPoolExecutor> pools = new ConcurrentHashMap<>();

    public void register(String name, ThreadPoolExecutor pool) {
        pools.put(name, pool);
        // Micrometer 指标（Prometheus/Grafana 可视化）
        Gauge.builder("threadpool.core.size", pool, ThreadPoolExecutor::getCorePoolSize)
             .tag("pool", name).register(Metrics.globalRegistry);
        Gauge.builder("threadpool.max.size", pool, ThreadPoolExecutor::getMaximumPoolSize)
             .tag("pool", name).register(Metrics.globalRegistry);
        Gauge.builder("threadpool.active.count", pool, ThreadPoolExecutor::getActiveCount)
             .tag("pool", name).register(Metrics.globalRegistry);
        Gauge.builder("threadpool.pool.size", pool, ThreadPoolExecutor::getPoolSize)
             .tag("pool", name).register(Metrics.globalRegistry);
        Gauge.builder("threadpool.queue.size", pool, p -> p.getQueue().size())
             .tag("pool", name).register(Metrics.globalRegistry);
        Gauge.builder("threadpool.queue.remaining", pool, p -> p.getQueue().remainingCapacity())
             .tag("pool", name).register(Metrics.globalRegistry);
        FunctionCounter.builder("threadpool.completed.count", pool, ThreadPoolExecutor::getCompletedTaskCount)
             .tag("pool", name).register(Metrics.globalRegistry);
    }

    /** 定时巡检 + 告警 */
    @Scheduled(fixedRate = 30000)                     // 每 30 秒
    public void check() {
        pools.forEach((name, pool) -> {
            int active = pool.getActiveCount();
            int poolSize = pool.getPoolSize();
            int queueSize = pool.getQueue().size();
            int max = pool.getMaximumPoolSize();

            double usageRate = (double) poolSize / max;
            double queueRate = (double) queueSize / (queueSize + pool.getQueue().remainingCapacity());

            log.info("线程池[{}] 线程={}/{}, 活跃={}, 队列={}, 已完成={}, 历史峰值={}",
                    name, poolSize, max, active, queueSize,
                    pool.getCompletedTaskCount(), pool.getLargestPoolSize());

            // ★ 告警规则
            if (queueRate > 0.8) {
                alertService.send(AlertLevel.WARNING,
                    String.format("线程池[%s] 队列使用率 %.0f%%，接近饱和", name, queueRate * 100));
            }
            if (usageRate > 0.9) {
                alertService.send(AlertLevel.WARNING,
                    String.format("线程池[%s] 线程使用率 %.0f%%", name, usageRate * 100));
            }
        });
    }
}
```

**关键监控指标与含义：**

| 指标 | API | 告警阈值 | 说明 |
| --- | --- | --- | --- |
| 活跃线程数 | `getActiveCount()` | > max × 80% | 正在执行任务的线程（估算值） |
| 当前线程数 | `getPoolSize()` | > max × 90% | 池中线程总数 |
| 历史峰值 | `getLargestPoolSize()` | 接近 max | 曾达到的最大线程数 |
| **队列长度** | `getQueue().size()` | **> 容量 × 80%** | ★ **最重要的先行指标** |
| 队列剩余容量 | `getQueue().remainingCapacity()` | < 容量 × 20% | — |
| 完成任务数 | `getCompletedTaskCount()` | — | 吞吐量趋势 |
| 总任务数 | `getTaskCount()` | — | — |
| **拒绝次数** | 自定义统计 | **> 0 立即告警** | ★ 系统已过载 |
| 任务平均耗时 | `afterExecute` 埋点 | 突增 | 慢任务定位 |

## 10. Spring 中的线程池

```java
// ─── 1. Spring 的 ThreadPoolTaskExecutor（对 ThreadPoolExecutor 的封装）───
@Configuration
public class AsyncConfig {

    @Bean("bizExecutor")
    public ThreadPoolTaskExecutor bizExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(500);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("biz-async-");           // ★ 自动加序号
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);    // ★ 优雅关闭
        executor.setAwaitTerminationSeconds(60);               // 最多等 60 秒
        executor.setTaskDecorator(new MdcTaskDecorator());       // ★ 传递 MDC/上下文
        executor.initialize();                                 // 或让 Spring 调用 afterPropertiesSet
        return executor;
    }
}

// ─── 2. @Async 异步方法 ───
@EnableAsync                                   // ★ 必须开启
@Configuration
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {        // 默认执行器
        return bizExecutor();
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) ->          // ★ void 方法的异常处理（Future 方法的异常在 get() 时抛）
            log.error("异步方法 {} 执行异常，参数={}", method.getName(), Arrays.toString(params), ex);
    }
}

@Service
public class NotifyService {

    @Async("bizExecutor")                      // ★ 指定线程池（不指定则用默认的）
    public void sendSms(String phone, String content) {
        // 异步执行
    }

    @Async("bizExecutor")
    public CompletableFuture<String> queryAsync(String id) {
        return CompletableFuture.completedFuture(doQuery(id));   // ★ 有返回值必须用 CompletableFuture
    }
}

// ⚠️ @Async 的失效场景（与 @Transactional 相同的代理问题）
// 1. 同类内部方法调用（this.method() 不走代理）
// 2. 方法不是 public
// 3. 类没有被 Spring 管理（没有 @Service/@Component）
// 4. 没有加 @EnableAsync
// 5. 方法返回类型不是 void 或 Future（返回值会被丢弃）

// ─── 3. @Scheduled 定时任务（默认单线程！）───
@EnableScheduling
@Configuration
public class ScheduleConfig implements SchedulingConfigurer {
    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.setScheduler(taskScheduler());          // ★ 配置多线程调度器
    }
    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10);                         // ★ 默认是 1，多个定时任务会串行！
        scheduler.setThreadNamePrefix("schedule-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(60);
        scheduler.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        return scheduler;
    }
}
// 或简单配置：spring.task.scheduling.pool.size=10

// ─── 4. Spring Boot 的默认线程池配置 ───
// application.yml
spring:
  task:
    execution:                        # @Async 的默认线程池
      pool:
        core-size: 8
        max-size: 16
        queue-capacity: 100
        keep-alive: 60s
      thread-name-prefix: async-
      shutdown:
        await-termination: true
        await-termination-period: 30s
    scheduling:                       # @Scheduled 的线程池
      pool:
        size: 10
      thread-name-prefix: schedule-
  threads:
    virtual:
      enabled: true                   # ★ JDK 21 + Spring Boot 3.2+：启用虚拟线程
```

### 10.1 上下文传递（ThreadLocal / MDC / 事务）★★★★★

**线程池的线程是复用的，ThreadLocal 中的数据不会自动传递，且会污染后续任务！**

```java
// ─── 问题演示 ───
// 主线程设置了 MDC 追踪 ID 和登录用户
MDC.put("traceId", "abc123");
UserContext.set(currentUser);

pool.execute(() -> {
    log.info("异步任务");           // ❌ 日志中没有 traceId（不同线程，MDC 为空）
    UserContext.get();               // ❌ 返回 null 或「上一个任务的残留值」！
});

// ─── 解决方案：TaskDecorator（Spring）★★★ ───
public class MdcTaskDecorator implements TaskDecorator {
    @Override
    public Runnable decorate(Runnable runnable) {
        // ★ 在「提交任务的线程」中捕获上下文
        Map<String, String> contextMap = MDC.getCopyOfContextMap();
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        LoginUser user = UserContext.get();

        return () -> {
            try {
                // ★ 在「执行任务的线程」中恢复上下文
                if (contextMap != null) MDC.setContextMap(contextMap);
                if (attributes != null) RequestContextHolder.setRequestAttributes(attributes);
                if (user != null) UserContext.set(user);
                runnable.run();
            } finally {
                // ★★★ 必须清理！否则线程复用时污染下一个任务（内存泄漏 + 数据错乱）
                MDC.clear();
                RequestContextHolder.resetRequestAttributes();
                UserContext.clear();
            }
        };
    }
}

executor.setTaskDecorator(new MdcTaskDecorator());

// ─── 手动包装（不用 Spring 时）───
public static Runnable wrapWithMdc(Runnable task) {
    Map<String, String> mdc = MDC.getCopyOfContextMap();
    return () -> {
        Map<String, String> backup = MDC.getCopyOfContextMap();
        if (mdc != null) MDC.setContextMap(mdc); else MDC.clear();
        try {
            task.run();
        } finally {
            if (backup != null) MDC.setContextMap(backup); else MDC.clear();
        }
    };
}
pool.execute(wrapWithMdc(() -> doWork()));

// ─── 阿里 TransmittableThreadLocal（TTL）★ 最完善的方案 ───
// Maven: com.alibaba:transmittable-thread-local
TransmittableThreadLocal<LoginUser> userContext = new TransmittableThreadLocal<>();
// 用 TtlRunnable / TtlExecutors 包装
ExecutorService pool = TtlExecutors.getTtlExecutorService(originalPool);
// 之后所有提交的 Runnable/Callable 自动传递 TTL 变量
// 原理：在任务提交时（而非线程创建时）捕获快照，执行时恢复，执行后还原

// ─── JDK 21 的 ScopedValue（虚拟线程时代的 ThreadLocal 替代品）───
private static final ScopedValue<LoginUser> USER = ScopedValue.newInstance();
ScopedValue.where(USER, currentUser).run(() -> {
    // 在这个作用域内（含子线程/虚拟线程）都能读到 USER
    StructuredTaskScope.ShutdownOnFailure scope = new StructuredTaskScope.ShutdownOnFailure();
    scope.fork(() -> USER.get());            // 自动继承
});
```

## 11. ForkJoinPool 与工作窃取

```java
// ForkJoinPool 专为「分治任务」设计（JDK 7），parallelStream 底层用它
public class ForkJoinPool extends AbstractExecutorService {
    // ★ 工作窃取（Work-Stealing）：
    //   每个工作线程有自己的双端队列（Deque）
    //   线程从自己队列的「头部」取任务（LIFO，缓存友好）
    //   空闲线程从其他线程队列的「尾部」偷任务（FIFO，偷大任务，减少竞争）
}

// ─── RecursiveTask（有返回值）/ RecursiveAction（无返回值）───
public class SumTask extends RecursiveTask<Long> {
    private static final int THRESHOLD = 10_000;      // 任务拆分阈值
    private final long[] array;
    private final int start, end;

    @Override
    protected Long compute() {
        int length = end - start;
        if (length <= THRESHOLD) {                     // 小任务：直接计算
            long sum = 0;
            for (int i = start; i < end; i++) sum += array[i];
            return sum;
        }
        int mid = start + length / 2;
        SumTask left = new SumTask(array, start, mid);
        SumTask right = new SumTask(array, mid, end);

        left.fork();                                   // ★ 异步执行左半（放入队列，可能被偷）
        long rightResult = right.compute();             // ★ 当前线程执行右半（不浪费）
        long leftResult = left.join();                  // ★ 等待左半结果

        return leftResult + rightResult;
    }
}

ForkJoinPool pool = new ForkJoinPool();                 // 默认并行度 = CPU 核数
ForkJoinPool pool2 = new ForkJoinPool(8,
        ForkJoinPool.defaultForkJoinWorkerThreadFactory,
        null, false);                                   // 自定义并行度
long result = pool.invoke(new SumTask(array, 0, array.length));

// ─── parallelStream 用的是 commonPool（全局共享！）───
list.parallelStream().map(...).collect(toList());
// ForkJoinPool.commonPool()：并行度 = CPU 核数 - 1，全 JVM 共享
// ⚠️ 坑 1：commonPool 被所有 parallelStream 共享，一个慢任务会拖累其他
// ⚠️ 坑 2：在 commonPool 中做阻塞 IO 会导致并行度骤降（线程被占用）
// ✅ 隔离方案：提交到自己的 ForkJoinPool
ForkJoinPool customPool = new ForkJoinPool(4);
List<String> result = customPool.submit(() ->
    list.parallelStream().map(this::convert).collect(toList())
).get();                                                // ★ 在自己的池中执行

// ─── ManagedBlocker：在 ForkJoinPool 中安全地阻塞 ───
ForkJoinPool.ManagedBlocker blocker = new ForkJoinPool.ManagedBlocker() {
    private volatile boolean ready = false;
    public boolean block() throws InterruptedException {
        if (!ready) { lock.lock(); try { condition.await(); } finally { lock.unlock(); } }
        ready = true;
        return ready;
    }
    public boolean isReleasable() { return ready; }
};
ForkJoinPool.managedBlock(blocker);
// 作用：告诉 ForkJoinPool「我要阻塞了」，它会临时补偿一个线程维持并行度
```

## 12. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 用 `Executors` 创建线程池 | OOM（无界队列/无限线程） | 手动 `ThreadPoolExecutor` |
| 2 | 无界队列 | `maximumPoolSize` 失效、任务堆积 OOM | 有界队列 + 明确容量 |
| 3 | 线程未命名 | jstack 无法定位问题 | `ThreadFactory` 指定名称前缀 |
| 4 | `submit` 任务异常丢失 | 静默失败无日志 | `future.get()` / 任务内 try-catch / `afterExecute` |
| 5 | 默认拒绝策略无告警 | 任务被丢弃/抛异常无人知 | 自定义策略 + 告警 + 落库补偿 |
| 6 | `CallerRunsPolicy` 用于 Web 线程 | 请求阻塞超时 | 评估调用者身份，或用自定义策略 |
| 7 | `DiscardPolicy` 静默丢任务 | 数据丢失无感知 | 禁用，改自定义策略 |
| 8 | 全局共用一个线程池 | 一个业务拖垮全部 | **按业务隔离**（舱壁模式） |
| 9 | 线程池里做阻塞 IO 且线程数不足 | 吞吐量低 | 增加线程数或用异步 IO/虚拟线程 |
| 10 | ThreadLocal 未清理 | **内存泄漏 + 数据串号**（用户 A 看到用户 B 的数据！） | `finally` 中 `remove()` |
| 11 | MDC/上下文不传递 | 日志无 traceId、丢失登录用户 | `TaskDecorator` / TTL |
| 12 | `@Scheduled` 默认单线程 | 多个定时任务串行，互相拖延 | 配置 `pool.size` |
| 13 | `@Async` 同类调用失效 | 同步执行 | 拆分 Bean 或注入自身代理 |
| 14 | `@Async` 无 `@EnableAsync` | 不生效 | 加注解 |
| 15 | `shutdown` 后未 `awaitTermination` | 应用退出时任务被中断 | 标准优雅关闭流程 |
| 16 | `shutdownNow` 丢失队列任务 | 任务未执行就丢弃 | 记录返回的任务列表并持久化 |
| 17 | 容器环境 CPU 核数识别错误 | 线程池过大，性能下降 | JDK 8u191+ / 显式配置核数 |
| 18 | 队列容量设置过大 | 响应时间飙升、内存压力 | 面向用户请求用小队列 + 快速失败 |
| 19 | `parallelStream` 阻塞 IO | 拖垮全局 commonPool | 用自定义 ForkJoinPool 或 CompletableFuture |
| 20 | `parallelStream` 修改共享集合 | 数据丢失/异常 | 用 `collect` 而非 `forEach` + add |
| 21 | 线程池中再提交任务到同一池并等待 | **死锁**（线程都在等子任务，无线程可执行） | 拆分池，或用 `ManagedBlocker` |
| 22 | 任务持有大对象引用 | 队列中任务导致内存泄漏 | 任务只传必要参数，或用弱引用 |
| 23 | 核心线程数期望自动收缩 | 线程一直存在 | `allowCoreThreadTimeOut(true)` |
| 24 | 忘记监控 | 过载后才发现 | Prometheus + 告警 |
| 25 | 参数硬编码无法调整 | 每次调参都要重启 | 配置中心 + 动态调参 |
| 26 | 虚拟线程下用池化思维 | 限制并发反而降低吞吐 | 虚拟线程应「每任务一线程」，用 Semaphore 限流 |

> 【坑 21 详解】**线程池嵌套死锁**（《Java 并发编程实战》第 8.1.1 节的经典案例）：
> ```java
> ExecutorService pool = Executors.newFixedThreadPool(2);
> pool.submit(() -> {
>     Future<Integer> sub = pool.submit(() -> 1);      // 提交子任务到同一个池
>     return sub.get();                                 // ★ 等待子任务
> });
> pool.submit(() -> { /* 同样的逻辑 */ });
> // 2 个线程都在等待子任务，但子任务在队列中没有线程执行 → 死锁
> // ✅ 解决：子任务用独立的池，或改用 CompletableFuture 的组合 API（不阻塞线程）
> ```

---

## 关联笔记

- 上一篇：[[后端/Java基础/并发编程/Lock与AQS原理]]（Worker 基于 AQS）
- 下一篇：[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]
- 异步进阶：[[后端/Java基础/并发编程/异步编程-CompletableFuture]]
- 应用：[[后端/SpringBoot/整合Web开发]]（@Async、@Scheduled 配置）、[[后端/SpringBoot/测试与常用整合实战]]
- 队列原理：[[后端/Java基础/集合框架-List与Set]]（BlockingQueue）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
