---
title: "线程基础与生命周期"
aliases:
  - "Java 线程"
  - "线程状态流转"
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
  - "[[后端/Java基础/并发编程/线程池原理与实战]]"
  - "[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]"
  - "[[后端/JVM/JVM概述与运行时数据区]]"
created: 2026-09-06
updated: 2026-09-06
---

# 线程基础与生命周期

> 并发编程模块共 7 篇，本篇是入口。后续：[[后端/Java基础/并发编程/线程安全与synchronized]]、[[后端/Java基础/并发编程/volatile与CAS原子类]]、[[后端/Java基础/并发编程/Lock与AQS原理]]、[[后端/Java基础/并发编程/线程池原理与实战]]、[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]、[[后端/Java基础/并发编程/异步编程-CompletableFuture]]

## 1. 并发基础概念

### 1.1 进程、线程、协程

| 概念 | 定义 | 资源 | 切换开销 | 通信方式 |
| --- | --- | --- | --- | --- |
| **进程（Process）** | 操作系统**资源分配**的基本单位，一个运行中的程序 | 独立的地址空间、文件句柄、内存 | 大（要切换页表、刷新 TLB） | IPC（管道、消息队列、共享内存、Socket、信号量） |
| **线程（Thread）** | CPU **调度执行**的基本单位，进程内的执行流 | 共享进程的堆和方法区；**独享栈和程序计数器** | 小（同进程内不需切换地址空间） | 共享内存（需同步）、`wait/notify`、JUC 工具 |
| **协程（Coroutine）** | 用户态的轻量级线程，由程序自己调度 | 极小（几 KB 栈） | **极小**（用户态切换，不进内核） | 直接函数调用/CSP channel |
| **纤程（Fiber）** | Windows 的协程实现 | — | — | — |

**Java 中的对应：**

| | Java 实现 | 栈大小 | 创建成本 | 数量上限 |
| --- | --- | --- | --- | --- |
| 平台线程 | `Thread`（1:1 映射内核线程） | 默认 512KB~1MB（`-Xss`） | 高（约 1ms，涉及内核调用） | 数千个 |
| **虚拟线程** | `Thread.ofVirtual()`（**JDK 21 正式**，M:N 调度） | **几百字节起，按需增长** | **极低（约 1μs）** | **百万级** |

```java
// JDK 21 虚拟线程（Project Loom）—— 并发的未来
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 1_000_000; i++) {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));     // 阻塞时自动让出载体线程（carrier thread）
            return callRemoteApi();
        });
    }
}
// 100 万个虚拟线程 ≈ 几十 MB 内存；100 万个平台线程需要 1TB 栈内存 → 不可能

Thread.startVirtualThread(() -> System.out.println("虚拟线程"));
Thread vThread = Thread.ofVirtual().name("v-", 0).start(task);
Thread.ofPlatform().name("p-").start(task);          // 传统平台线程的新 API
```

**虚拟线程的关键特性：**
1. **M:N 调度**：M 个虚拟线程由 N 个平台线程（载体线程，默认 = CPU 核数）承载。
2. **阻塞时自动 unmount**：虚拟线程阻塞（IO、sleep、锁等待）时，其栈帧被保存到堆中，载体线程去执行其他虚拟线程。
3. **不适合 CPU 密集型**：没有计算可让出，虚拟线程无收益。
4. **注意 pinning 问题**：`synchronized` 块内阻塞会导致虚拟线程「钉住」载体线程（JDK 21 的已知限制，JDK 24 已改善），高并发下应改用 `ReentrantLock`。
5. **ThreadLocal 慎用**：百万级线程下每个都存 ThreadLocal 会占用大量内存。

> 【趋势】Spring Boot 3.2+ 支持 `spring.threads.virtual.enabled=true`，Tomcat 会为每个请求分配一个虚拟线程，**IO 密集型 Web 应用吞吐量提升数倍，且无需改代码**。这是 Java 并发模型十年来最大的变革。

### 1.2 并发与并行

| | 并发（Concurrency） | 并行（Parallelism） |
| --- | --- | --- |
| 定义 | 多个任务在**同一时间段**内交替执行 | 多个任务在**同一时刻**同时执行 |
| 硬件要求 | 单核也可以 | **必须多核** |
| 类比 | 一个人边吃饭边接电话（快速切换） | 两个人同时吃饭 |
| 目标 | 提高资源利用率、响应性 | 提高吞吐量、缩短计算时间 |
| Java 体现 | 线程切换、NIO 多路复用 | `parallelStream`、ForkJoinPool、多核 CPU |

```java
Runtime.getRuntime().availableProcessors();    // CPU 逻辑核心数（含超线程）
// 4 核 8 线程的 CPU 返回 8
// ⚠️ 容器环境下（Docker/K8s）JDK 8u191+ 才能正确识别 cgroup 的 CPU 限制
//    老版本会返回宿主机的核心数 → 线程池配置错误 → 性能问题
//    检查：-XX:+UseContainerSupport（JDK 10+ 默认开启）
```

### 1.3 为什么需要多线程

| 收益 | 说明 |
| --- | --- |
| **提升 CPU 利用率** | 单线程 IO 阻塞时 CPU 空闲，多线程可让其他线程利用 CPU |
| **提升响应性** | GUI/服务端不因耗时操作卡死 |
| **提升吞吐量** | 并行处理，多核 CPU 才能发挥 |
| **建模简单** | 每个任务一个线程，比单线程的事件循环更直观 |

| 代价 | 说明 |
| --- | --- |
| **线程安全** | 共享变量需要同步（锁、CAS），编程复杂度剧增 |
| **上下文切换开销** | 每次切换约 1~10μs（保存/恢复寄存器、刷新缓存、TLB 失效） |
| **内存开销** | 每个平台线程 1MB 栈，1 万线程 = 10GB |
| **死锁风险** | 多锁交叉可能永久阻塞 |
| **调试困难** | 竞态条件难以复现，栈信息复杂 |

> 【原则】**不是线程越多越好**。CPU 密集型：线程数 ≈ 核数 + 1；IO 密集型：线程数 ≈ 核数 × (1 + 等待时间/计算时间)。详见 [[后端/Java基础/并发编程/线程池原理与实战]]。

## 2. 创建线程的方式

### 2.1 六种方式对比

```java
// ─── 方式 1：继承 Thread（不推荐，Java 单继承限制）───
public class MyThread extends Thread {
    @Override
    public void run() {
        System.out.println("MyThread: " + Thread.currentThread().getName());
    }
}
new MyThread().start();                    // ★ 必须调 start()，调 run() 就是普通方法调用

// ─── 方式 2：实现 Runnable（推荐，无返回值）───
public class MyTask implements Runnable {
    @Override
    public void run() {
        System.out.println("MyTask: " + Thread.currentThread().getName());
    }
}
new Thread(new MyTask()).start();
new Thread(new MyTask(), "自定义线程名").start();      // ★ 指定线程名（便于排查问题）

// Lambda 写法
new Thread(() -> System.out.println("lambda")).start();

// ─── 方式 3：实现 Callable + FutureTask（★ 有返回值、可抛异常）───
public class MyCallable implements Callable<String> {
    @Override
    public String call() throws Exception {           // ★ 可以 throws 受检异常
        Thread.sleep(1000);
        if (Math.random() < 0.1) throw new IOException("模拟失败");
        return "执行结果：" + Thread.currentThread().getName();
    }
}
FutureTask<String> futureTask = new FutureTask<>(new MyCallable());
new Thread(futureTask, "callable-thread").start();
// ... 做别的事
String result = futureTask.get();                      // ★ 阻塞等待结果
String result2 = futureTask.get(5, TimeUnit.SECONDS);  // ★ 带超时（推荐，防永久阻塞）
futureTask.cancel(true);                               // 取消（true = 中断正在执行的线程）
futureTask.isDone(); futureTask.isCancelled();

// ─── 方式 4：线程池（★★★ 生产环境唯一正确选择）───
ExecutorService pool = new ThreadPoolExecutor(
        10, 50, 60L, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(1000),
        new ThreadFactoryBuilder().setNameFormat("biz-pool-%d").build(),
        new ThreadPoolExecutor.CallerRunsPolicy());

pool.execute(() -> System.out.println("无返回值任务"));       // execute
Future<String> future = pool.submit(() -> "有返回值任务");    // submit
List<Future<String>> futures = pool.invokeAll(taskList);       // 批量提交，全部完成才返回
String first = pool.invokeAny(taskList);                        // 批量提交，任一完成即返回
pool.shutdown();                                                // 优雅关闭
pool.shutdownNow();                                             // 立即关闭（中断）
boolean terminated = pool.awaitTermination(30, TimeUnit.SECONDS);

// ─── 方式 5：CompletableFuture（★★ 异步编程的现代方式）───
CompletableFuture.supplyAsync(() -> queryUser(userId))            // 有返回值
    .thenApply(user -> user.getName())                            // 转换
    .thenAccept(System.out::println)                              // 消费
    .exceptionally(ex -> { log.error("失败", ex); return null; }); // 异常处理

CompletableFuture.runAsync(() -> sendEmail());                     // 无返回值
CompletableFuture.allOf(f1, f2, f3).join();                        // 等待全部
CompletableFuture.anyOf(f1, f2).join();                            // 任一完成

// ─── 方式 6：ForkJoinPool（分治任务）───
public class SumTask extends RecursiveTask<Long> {
    private final long[] array;
    private final int start, end;
    private static final int THRESHOLD = 10000;

    @Override
    protected Long compute() {
        if (end - start <= THRESHOLD) {                    // 小任务直接算
            long sum = 0;
            for (int i = start; i < end; i++) sum += array[i];
            return sum;
        }
        int mid = (start + end) / 2;
        SumTask left = new SumTask(array, start, mid);
        SumTask right = new SumTask(array, mid, end);
        left.fork();                                       // ★ 异步执行左半
        long rightResult = right.compute();                 // 当前线程执行右半
        long leftResult = left.join();                      // ★ 等待左半结果
        return leftResult + rightResult;
    }
}
ForkJoinPool forkJoinPool = new ForkJoinPool();
long total = forkJoinPool.invoke(new SumTask(array, 0, array.length));
// parallelStream() 底层就是用 ForkJoinPool.commonPool()
```

### 2.2 Runnable vs Callable vs FutureTask

| 对比 | Runnable | Callable | FutureTask |
| --- | --- | --- | --- |
| 方法 | `void run()` | `V call()` | 包装 Callable/Runnable |
| 返回值 | ❌ 无 | ✅ **有** | ✅ `get()` 获取 |
| 抛受检异常 | ❌ 不能 | ✅ **能** | ✅ 包装为 ExecutionException |
| 泛型 | ❌ | ✅ `Callable<V>` | ✅ |
| 取消 | ❌ | ❌ | ✅ `cancel()` |
| 状态查询 | ❌ | ❌ | ✅ `isDone()`、`isCancelled()` |
| 配合线程池 | `execute()` | `submit()` | 可提交给 Thread |
| 引入版本 | JDK 1.0 | JDK 5 | JDK 5 |

```java
// Runnable → Callable 的适配
Runnable runnable = () -> System.out.println("run");
Callable<Void> callable = Executors.callable(runnable);           // 返回 null
Callable<String> callable2 = Executors.callable(runnable, "result");  // 返回指定值

// FutureTask 的三种构造
new FutureTask<>(callable);                    // 包装 Callable
new FutureTask<>(runnable, "defaultValue");     // 包装 Runnable + 指定结果
// FutureTask 实现了 RunnableFuture = Runnable + Future，所以既能给 Thread 也能给线程池

// Future 的局限（这也是 CompletableFuture 出现的原因）
Future<String> f = pool.submit(task);
f.get();                       // ★ 阻塞等待，浪费线程
f.isDone();                    // 只能轮询
// ❌ 不能链式组合、不能注册回调、不能合并多个 Future
// ✅ CompletableFuture 全部解决，详见 [[后端/Java基础/并发编程/异步编程-CompletableFuture]]
```

### 2.3 start() vs run() ★★★★★（必考）

```java
Thread t = new Thread(() -> System.out.println(Thread.currentThread().getName()));

t.run();       // 输出 "main"     ← 只是普通方法调用，在当前线程执行，没有创建新线程！
t.start();     // 输出 "Thread-0" ← 真正启动新线程
```

**区别：**

| | `start()` | `run()` |
| --- | --- | --- |
| 作用 | 启动新线程（向 OS 申请资源） | 普通方法调用 |
| 执行线程 | **新线程** | 当前线程（调用者） |
| 底层 | native 方法 `start0()` → JVM 创建内核线程 → 回调 `run()` | 直接执行 Java 代码 |
| 能否多次调用 | ❌ 第二次抛 `IllegalThreadStateException` | ✅ 可以（就是个方法） |
| 异步 | 是 | 否 |

```java
// start() 的源码
public synchronized void start() {
    if (threadStatus != 0)                              // ★ 状态检查
        throw new IllegalThreadStateException();        // 已启动过就抛异常
    group.add(this);
    boolean started = false;
    try {
        start0();                                        // ★ native 方法，创建 OS 线程
        started = true;
    } finally {
        try {
            if (!started) group.threadStartFailed(this);
        } catch (Throwable ignore) { }
    }
}
private native void start0();

// 重复 start 的验证
Thread t = new Thread(() -> { });
t.start();
t.start();      // ❌ IllegalThreadStateException
// 想复用逻辑：重新 new Thread(sameRunnable).start()
```

**JVM 层面 start() 的完整流程：**
1. 检查线程状态（必须是 NEW）。
2. 调用 native `start0()` → JVM 的 `JVM_StartThread`。
3. 创建 `JavaThread` 对象，调用 OS API（`pthread_create` / `CreateThread`）创建内核线程。
4. 分配线程栈（大小由 `-Xss` 决定）。
5. 新线程启动后调用 `thread_entry_point` → `Thread::run()` → 反射调用 Java 层的 `run()` 方法。
6. 线程状态变为 RUNNABLE。

### 2.4 线程的命名（生产必备）

```java
// ❌ 默认线程名毫无意义：Thread-0、Thread-1、pool-1-thread-3
// 出问题时 jstack 看不出是哪个业务的线程

// ✅ 方式 1：Thread 构造器指定
new Thread(task, "order-processor-1").start();

// ✅ 方式 2：setName
Thread t = new Thread(task);
t.setName("my-thread");

// ✅ 方式 3：ThreadFactory（线程池必用）★★★
public class NamedThreadFactory implements ThreadFactory {
    private final AtomicInteger counter = new AtomicInteger(1);
    private final String prefix;
    private final boolean daemon;
    private final int priority;

    public NamedThreadFactory(String prefix) {
        this(prefix, false, Thread.NORM_PRIORITY);
    }
    public NamedThreadFactory(String prefix, boolean daemon, int priority) {
        this.prefix = prefix;
        this.daemon = daemon;
        this.priority = priority;
    }

    @Override
    public Thread newThread(Runnable r) {
        Thread t = new Thread(r, prefix + "-" + counter.getAndIncrement());
        t.setDaemon(daemon);
        t.setPriority(priority);
        // ★ 设置未捕获异常处理器（线程池的 execute 任务异常会丢失！）
        t.setUncaughtExceptionHandler((thread, ex) ->
            log.error("线程 {} 未捕获异常", thread.getName(), ex));
        return t;
    }
}
new ThreadPoolExecutor(10, 50, 60, TimeUnit.SECONDS, queue,
                       new NamedThreadFactory("order-async"));

// ✅ 方式 4：Guava 的 ThreadFactoryBuilder（最常用）
ThreadFactory factory = new ThreadFactoryBuilder()
        .setNameFormat("redis-pool-%d")
        .setDaemon(true)
        .setUncaughtExceptionHandler((t, e) -> log.error("线程异常", e))
        .build();

// ✅ 方式 5：Spring 的 CustomizableThreadFactory
new CustomizableThreadFactory("mq-consumer-");

// ✅ 方式 6：JDK 21 的 Builder API
Thread.ofVirtual().name("virtual-", 0).start(task);      // virtual-0, virtual-1, ...
Thread.ofPlatform().name("platform-", 0).start(task);
```

**线程命名的规范建议：**

| 场景 | 命名示例 |
| --- | --- |
| 业务异步任务 | `order-async-1`、`payment-notify-2` |
| MQ 消费者 | `rocketmq-consumer-order-1` |
| 定时任务 | `schedule-report-1` |
| IO 处理 | `netty-worker-3`、`http-nio-8080-exec-5` |
| 数据库连接池 | `hikari-housekeeper-1` |

> 【强制】阿里手册：**创建线程或线程池时请指定有意义的线程名称，方便出错时回溯**。jstack 输出中靠线程名定位问题是线上排查的基本功。

## 3. 线程的六种状态 ★★★★★

### 3.1 状态定义（Thread.State 枚举）

```java
public enum State {
    NEW,             // 新建：Thread 对象已创建，还没调 start()
    RUNNABLE,        // 可运行：包含 OS 的「就绪」和「运行中」两种状态
    BLOCKED,         // 阻塞：等待获取 synchronized 锁（monitorenter）
    WAITING,         // 无限期等待：需要其他线程显式唤醒
    TIMED_WAITING,   // 限期等待：超时后自动返回
    TERMINATED       // 终止：run() 执行完毕或抛异常退出
}
```

### 3.2 状态流转图

```
                     new Thread()
                          │
                          ▼
                    ┌──────────┐
                    │   NEW    │
                    └────┬─────┘
                         │ start()
                         ▼
                    ┌──────────┐      CPU 调度     ┌──────────┐
       ┌───────────→│ RUNNABLE │◄─────────────────│ Running  │
       │            │（就绪）    │                  │（运行中）  │
       │            └────┬─────┘                  └────┬─────┘
       │                 │                              │
       │   ┌─────────────┼──────────────┬───────────────┤
       │   │             │              │               │
       │   ▼             ▼              ▼               │
       │ ┌─────────┐ ┌─────────┐ ┌──────────────┐       │
       │ │ BLOCKED │ │ WAITING │ │TIMED_WAITING │       │
       │ │ 等锁     │ │ 无限等待 │ │  限时等待      │       │
       │ └────┬────┘ └────┬────┘ └──────┬───────┘       │
       │      │ 获得锁      │ notify/     │ 超时或被唤醒    │
       │      │            │ notifyAll/  │               │
       └──────┴────────────┴──unpark─────┴───────────────┘
                         │
                         │ run() 结束 / 抛异常
                         ▼
                  ┌────────────┐
                  │ TERMINATED │
                  └────────────┘
```

### 3.3 各状态的触发条件（必背）

| 状态 | 进入方式 | 退出方式 |
| --- | --- | --- |
| **NEW** | `new Thread()` | 调用 `start()` |
| **RUNNABLE** | `start()` 后；从阻塞/等待中恢复 | 获得锁、被唤醒、超时；或运行结束 |
| **BLOCKED** | ① 进入 `synchronized` 块/方法时抢锁失败<br>② 等待重新进入（reenter） | 获取到 monitor 锁 |
| **WAITING** | ① `Object.wait()`（无参）<br>② `Thread.join()`（无参）<br>③ `LockSupport.park()`<br>④ `BlockingQueue.take()/put()`<br>⑤ `Condition.await()` | ① `notify()`/`notifyAll()`<br>② 被 join 的线程结束<br>③ `LockSupport.unpark()`<br>④ 队列有数据/有空位<br>⑤ `signal()`/`signalAll()` |
| **TIMED_WAITING** | ① `Thread.sleep(ms)`<br>② `Object.wait(ms)`<br>③ `Thread.join(ms)`<br>④ `LockSupport.parkNanos/parkUntil`<br>⑤ `Lock.tryLock(timeout)`<br>⑥ `BlockingQueue.poll(timeout)`<br>⑦ `Condition.await(time, unit)` | 超时自动返回，或被提前唤醒 |
| **TERMINATED** | `run()` 正常结束或抛出未捕获异常 | — |

```java
// 状态验证代码
public class StateDemo {
    public static void main(String[] args) throws Exception {
        // NEW
        Thread t1 = new Thread(() -> { });
        System.out.println(t1.getState());          // NEW

        // RUNNABLE
        Thread t2 = new Thread(() -> {
            while (true) { }                         // 死循环
        });
        t2.start();
        Thread.sleep(100);
        System.out.println(t2.getState());           // RUNNABLE

        // TIMED_WAITING
        Thread t3 = new Thread(() -> {
            try { Thread.sleep(100000); } catch (InterruptedException e) { }
        });
        t3.start();
        Thread.sleep(100);
        System.out.println(t3.getState());           // TIMED_WAITING

        // WAITING
        Object lock = new Object();
        Thread t4 = new Thread(() -> {
            synchronized (lock) {
                try { lock.wait(); } catch (InterruptedException e) { }
            }
        });
        t4.start();
        Thread.sleep(100);
        System.out.println(t4.getState());           // WAITING

        // BLOCKED
        Thread t5 = new Thread(() -> {
            synchronized (lock) {
                try { Thread.sleep(100000); } catch (Exception e) { }
            }
        });
        Thread t6 = new Thread(() -> {
            synchronized (lock) { }                  // 抢不到锁
        });
        t5.start(); Thread.sleep(100);
        t6.start(); Thread.sleep(100);
        System.out.println(t5.getState());           // TIMED_WAITING（持有锁在 sleep）
        System.out.println(t6.getState());           // BLOCKED（等待锁）

        // TERMINATED
        Thread t7 = new Thread(() -> { });
        t7.start();
        t7.join();
        System.out.println(t7.getState());           // TERMINATED
    }
}
```

> 【面试】**Java 为什么没有「运行中」这个独立状态？**
>
> 因为 Java 线程是 1:1 映射到 OS 内核线程的，**是否真正占用 CPU 由操作系统调度器决定**，JVM 无法（也不需要）区分「就绪」和「运行中」。所以 Java 把两者合并为 `RUNNABLE`。而 Windows 的线程 API 有 READY 和 RUNNING 之分，Linux 的 `TASK_RUNNING` 也同时表示两者。

### 3.4 查看线程状态的工具

```bash
# 1. jstack（最常用）
jps -l                              # 找到 Java 进程 PID
jstack <pid> > thread_dump.txt      # 导出线程快照
jstack -l <pid>                     # 额外输出锁信息（owned monitors）
jstack -F <pid>                     # 强制（进程无响应时）

# 2. jcmd（推荐，JDK 7+）
jcmd <pid> Thread.print
jcmd <pid> Thread.print -l

# 3. Arthas（阿里开源，线上诊断神器）
thread                              # 查看所有线程
thread -n 3                         # CPU 最高的 3 个线程
thread -b                           # 找出阻塞其他线程的元凶（死锁检测）
thread <id>                         # 查看指定线程栈
thread --state BLOCKED              # 按状态过滤

# 4. 代码方式
Thread.currentThread().getState();
Thread.getAllStackTraces();          # Map<Thread, StackTraceElement[]>
ManagementFactory.getThreadMXBean().getThreadInfo(id);
ManagementFactory.getThreadMXBean().dumpAllThreads(true, true);

# 5. 可视化工具
JConsole / VisualVM / JProfiler / Arthas Tunnel Server
```

**jstack 输出示例：**

```
"http-nio-8080-exec-1" #25 daemon prio=5 os_prio=31 tid=0x00007f8a1c00e000 nid=0x6e03 waiting for monitor entry [0x000070000f5f4000]
   java.lang.Thread.State: BLOCKED (on object monitor)        ← 状态
        at com.example.Service.slowMethod(Service.java:42)
        - waiting to lock <0x000000076ab62208> (a java.lang.Object)   ← 等待这个锁
        - locked <0x000000076ab621f0> (a java.lang.Object)             ← 已持有的锁
        at com.example.Controller.handle(Controller.java:20)

"order-async-3" #30 prio=5 os_prio=31 tid=0x00007f8a1d00f800 nid=0x7003 waiting on condition
   java.lang.Thread.State: WAITING (parking)
        at jdk.internal.misc.Unsafe.park(java.base@17/Native Method)
        - parking to wait for  <0x000000076ab62300> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.park(...)
        at java.util.concurrent.LinkedBlockingQueue.take(...)

Found one Java-level deadlock:                               ← ★ 死锁会被自动检测出来
=============================
"Thread-1":
  waiting to lock monitor 0x00007f8a1c00e000 (object 0x000000076ab62208, a java.lang.Object),
  which is held by "Thread-0"
"Thread-0":
  waiting to lock monitor 0x00007f8a1d00f800 (object 0x000000076ab62300, a java.lang.Object),
  which is held by "Thread-1"
```

## 4. Thread 类的方法详解

### 4.1 sleep vs wait vs yield vs join ★★★★★

| 方法 | 所属类 | 释放锁 | 唤醒方式 | 是否进入等待队列 | 用途 |
| --- | --- | --- | --- | --- | --- |
| **`Thread.sleep(ms)`** | Thread（静态） | **❌ 不释放** | 超时自动醒 / `interrupt()` | 否 | 暂停执行（限时等待） |
| **`Object.wait()`** | Object | **✅ 释放** | `notify()`/`notifyAll()` / 超时 / 中断 | **是**（进入 wait set） | **线程间通信** |
| `Thread.yield()` | Thread（静态） | ❌ 不释放 | 立即重新竞争 CPU | 否 | 提示调度器让出 CPU（**不保证生效**） |
| `Thread.join()` | Thread（实例） | ✅ 释放当前持有的锁？（内部用 wait） | 目标线程结束 / 超时 / 中断 | 是 | 等待另一个线程完成 |
| `LockSupport.park()` | LockSupport（静态） | ❌ 不释放 | `unpark(thread)` / 中断 / 虚假唤醒 | 否 | AQS 的底层等待机制 |
| `Condition.await()` | Condition | ✅ 释放 | `signal()`/`signalAll()` | 是（Condition 队列） | Lock 版的 wait |

```java
// ─── sleep：不释放锁！───
synchronized (lock) {
    Thread.sleep(5000);       // ★ 睡 5 秒，但锁一直持有，其他线程进不来
}

// ─── wait：释放锁 ───
synchronized (lock) {
    lock.wait();              // ★ 释放 lock，其他线程可以进入 synchronized 块
}

// ⚠️ wait/notify 必须在 synchronized 中调用，否则抛 IllegalMonitorStateException
lock.wait();                  // ❌ IllegalMonitorStateException: current thread is not owner

// ─── sleep 的两个重载 ───
Thread.sleep(1000);                       // 毫秒
Thread.sleep(1000, 500000);               // 毫秒 + 纳秒（精度取决于 OS，通常无效）
TimeUnit.SECONDS.sleep(1);                // ★ 更易读的写法
TimeUnit.MILLISECONDS.sleep(500);

// ─── sleep 的精度问题 ───
long start = System.nanoTime();
Thread.sleep(1);                          // 请求 1ms
long actual = (System.nanoTime() - start) / 1_000_000;
System.out.println(actual);               // 实际可能 1~15ms（受 OS 调度粒度和时钟中断影响）
// Windows 的默认定时器精度约 15.6ms，Linux 约 1ms
// 需要高精度定时：用 ScheduledThreadPoolExecutor 或忙等待（浪费 CPU）

// ─── yield：仅仅是「建议」 ───
Thread.yield();      // 提示调度器：我愿意让出 CPU
// 但调度器完全可以忽略！且让出后可能立刻又被选中（同优先级）
// 用途：自旋锁中减少 CPU 空转（Thread.onSpinWait() 是 JDK 9 的更好选择）
while (!condition) {
    Thread.onSpinWait();     // JDK 9+，在 x86 上生成 PAUSE 指令，降低功耗和流水线惩罚
}

// ─── join：等待线程结束 ───
Thread t = new Thread(() -> { /* 耗时任务 */ });
t.start();
t.join();                       // ★ 当前线程阻塞，直到 t 结束
t.join(5000);                   // 最多等 5 秒
t.join(5000, 100000);           // 毫秒 + 纳秒

// join 的实现原理：基于 wait
public final synchronized void join(long millis) throws InterruptedException {
    ...
    while (isAlive()) {
        wait(0);                 // ★ 在 Thread 对象上 wait（释放的是 Thread 对象的锁）
    }
}
// 线程结束时，JVM 会自动调用 this.notifyAll() 唤醒所有 join 等待者

// ⚠️ join 的坑：不要对 Thread 对象加 synchronized！
synchronized (t) {               // ❌ 会与 join 内部的 synchronized 冲突
    ...
}
// JDK 早期的 Thread.stop/suspend 实现依赖这个锁，虽然已废弃，但仍是反模式

// join 的顺序执行示例（保证 t1 → t2 → t3 顺序）
Thread t1 = new Thread(task1), t2 = new Thread(task2), t3 = new Thread(task3);
t1.start(); t1.join();
t2.start(); t2.join();
t3.start(); t3.join();
// ✅ 更好的方式：单线程池（天然保证顺序）
ExecutorService single = Executors.newSingleThreadExecutor();
single.submit(task1); single.submit(task2); single.submit(task3);
```

### 4.2 线程中断机制 ★★★★★

**中断是「协作式」的：一个线程不能强制停止另一个线程，只能「发出中断请求」，被中断的线程自己决定如何响应。**

```java
// ─── 三个核心方法 ───
thread.interrupt();                    // 设置目标线程的中断标志位为 true
thread.isInterrupted();                // 查询中断标志（不清除）
Thread.interrupted();                  // ★ 静态方法：查询「当前线程」并【清除】标志位！

// ─── 中断的两种表现 ───

// 情况 1：线程处于阻塞状态（sleep/wait/join/park/BlockingQueue.take）
//         → 抛出 InterruptedException，★ 且中断标志被清除（重置为 false）！
Thread t = new Thread(() -> {
    try {
        Thread.sleep(10000);
    } catch (InterruptedException e) {
        // 此时 Thread.currentThread().isInterrupted() == false（标志已被清除）
        System.out.println("被中断，标志位：" + Thread.currentThread().isInterrupted());  // false
    }
});
t.start();
t.interrupt();

// 情况 2：线程正常运行中
//         → 只是设置标志位，代码不会有任何反应，需要自己检查
Thread t2 = new Thread(() -> {
    while (!Thread.currentThread().isInterrupted()) {    // ★ 主动检查
        doWork();
    }
    cleanup();                                            // 优雅退出前清理
});

// ─── 中断处理的标准范式 ★★★★★ ───

// ✅ 范式 1：恢复中断状态后退出（最通用）
public void run() {
    try {
        while (!Thread.currentThread().isInterrupted()) {
            // 业务逻辑
            Thread.sleep(1000);
        }
    } catch (InterruptedException e) {
        // ★ sleep 抛出异常时已清除标志，必须重新设置，让上层/线程池感知
        Thread.currentThread().interrupt();
    } finally {
        releaseResources();
    }
}

// ✅ 范式 2：向上抛出（方法签名允许时）
public void doTask() throws InterruptedException {
    Thread.sleep(1000);                  // 让调用方处理
}

// ✅ 范式 3：不能抛也不能吞时，包装为 RuntimeException
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    throw new IllegalStateException("任务被中断", e);
}

// ❌ 反模式 1：吞掉中断（最严重！线程池无法优雅关闭）
try { Thread.sleep(1000); } catch (InterruptedException e) { /* 什么都不做 */ }

// ❌ 反模式 2：只打日志不恢复标志
try { Thread.sleep(1000); } catch (InterruptedException e) { log.error("中断", e); }

// ❌ 反模式 3：在循环中捕获后继续（丢失中断信号）
while (true) {
    try { Thread.sleep(1000); } catch (InterruptedException e) { break; }   // break 勉强可以
    // 但如果循环体其他地方也 sleep，标志已被清除，无法感知中断
}

// ─── interrupt 对不同状态的影响 ───
// 1. sleep/wait/join → 抛 InterruptedException + 清除标志
// 2. LockSupport.park → 返回（不抛异常），标志保持 true
// 3. InterruptibleChannel 的 IO 操作 → 抛 ClosedByInterruptException + 关闭通道 + 设置标志
// 4. Selector.select → 立即返回（相当于 wakeup），不抛异常
// 5. 普通 synchronized 等锁（BLOCKED）→ ★ 无影响！interrupt 不能中断等锁
//    （只有 Lock.lockInterruptibly() 和 Lock.tryLock(timeout) 能响应中断）
// 6. 普通 IO（InputStream.read）→ ★ 无影响！只有 NIO 的 InterruptibleChannel 支持

// ─── 可中断的锁获取 ───
Lock lock = new ReentrantLock();
try {
    lock.lockInterruptibly();             // ★ 等锁期间可被中断（抛 InterruptedException）
    // 临界区
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
} finally {
    lock.unlock();
}
// 或 tryLock 带超时
if (lock.tryLock(5, TimeUnit.SECONDS)) {  // ★ 等待期间可中断
    try { ... } finally { lock.unlock(); }
}
```

**为什么 interrupt 不能中断 `synchronized` 等锁？**

`synchronized` 的锁获取是 JVM 层面的 `monitorenter` 指令，在 OS 层面对应 futex/mutex 的等待，**这个等待过程不检查线程的中断标志**。Java 设计者认为「锁的获取应该是原子的、不可打断的」，否则会造成锁状态混乱。如果需要可中断的锁等待，必须用 `java.util.concurrent.locks.Lock`（AQS 实现，内部用 `LockSupport.park` 且检查中断）。

### 4.3 已废弃的危险方法

```java
// ❌ Thread.stop()：已废弃（JDK 1.2 起 deprecated for removal）
thread.stop();
// 危害：
// 1. 立即释放所有持有的锁，但对象可能处于「不一致状态」（写了一半）
// 2. 抛出 ThreadDeath 异常，会传播到所有 catch(Exception) 中，破坏异常处理逻辑
// 3. 其他线程可能读到损坏的数据
// ✅ 替代：用 volatile 标志位 + 中断
private volatile boolean running = true;
public void run() {
    while (running) { doWork(); }
}
public void shutdown() { running = false; thread.interrupt(); }

// ❌ Thread.suspend() / resume()：已废弃
thread.suspend();       // 暂停（不释放锁！）
thread.resume();        // 恢复
// 危害：suspend 后线程仍持有锁，如果 resume 的线程需要先获取那个锁 → 死锁
// ✅ 替代：用 wait/notify 或 Condition

// ❌ Thread.destroy()：从未实现，直接抛 NoSuchMethodError

// ⚠️ Runtime.runFinalizersOnExit：已废弃（finalize 机制本身就有问题）
```

### 4.4 其他常用方法

```java
// ─── 线程属性 ───
thread.setName("name"); thread.getName();
thread.setPriority(Thread.MAX_PRIORITY);      // 1~10，默认 5（NORM_PRIORITY）
thread.getPriority();
// ⚠️ 优先级只是「建议」，OS 调度器可能完全忽略（Linux 的 CFS 调度器对 Java 优先级支持很差）
//    不要依赖优先级实现业务逻辑！

thread.setDaemon(true);                       // ★ 守护线程，必须在 start() 之前设置
thread.isDaemon();

thread.getId();                                // 线程 ID（唯一，不复用）
thread.getThreadGroup();
thread.getContextClassLoader();                // ★ 上下文类加载器（打破双亲委派用）
thread.setContextClassLoader(loader);
thread.getStackTrace();                        // 栈快照
thread.toString();

// ─── 静态方法（作用于当前线程）───
Thread.currentThread();                        // 当前线程
Thread.sleep(ms);
Thread.yield();
Thread.interrupted();                          // ★ 当前线程的中断状态并清除
Thread.getAllStackTraces();                    // 所有线程的栈
Thread.activeCount();                          // 当前线程组的活跃线程数（不准确，仅估算）
Thread.dumpStack();                            // 打印当前栈（调试用）
Thread.setDefaultUncaughtExceptionHandler(h);   // ★ 全局未捕获异常处理器
Thread.holdsLock(obj);                         // 当前线程是否持有 obj 的锁
Thread.onSpinWait();                           // JDK 9+ 自旋提示

// ─── 守护线程（Daemon Thread）★★★★★ ───
thread.setDaemon(true);
// 特性：
// 1. 所有非守护线程（用户线程）结束时，JVM 直接退出，不管守护线程是否执行完
// 2. 守护线程中创建的线程默认也是守护线程
// 3. GC 线程、JIT 编译线程都是守护线程
// 4. ⚠️ 守护线程中不要做持久化操作（写文件、写数据库），JVM 退出时会被强杀！
//    finally 块也不保证执行

public static void main(String[] args) throws Exception {
    Thread daemon = new Thread(() -> {
        while (true) {
            try { Thread.sleep(1000); System.out.println("守护线程运行"); }
            catch (InterruptedException e) { break; }
        }
    });
    daemon.setDaemon(true);       // ★ 必须在 start 前设置，否则抛 IllegalThreadStateException
    daemon.start();
    Thread.sleep(3000);
    System.out.println("main 结束");   // JVM 立即退出，守护线程被强杀（无 finally）
}

// ─── 未捕获异常处理 ───
// execute() 提交的任务异常会触发 UncaughtExceptionHandler（打印到 stderr）
// submit() 提交的任务异常被封装进 Future，不调 get() 就永远看不到！★ 大坑
ExecutorService pool = Executors.newFixedThreadPool(2);
pool.execute(() -> { throw new RuntimeException("execute 异常"); });   // 控制台可见
pool.submit(() -> { throw new RuntimeException("submit 异常"); });     // ★ 静默丢失！

// 三种解决方案
// 方案 1：自定义 ThreadFactory 设置 handler
ThreadFactory factory = r -> {
    Thread t = new Thread(r);
    t.setUncaughtExceptionHandler((thread, ex) -> log.error("线程 {} 异常", thread.getName(), ex));
    return t;
};
// 方案 2：任务内部 try-catch
pool.submit(() -> {
    try { doWork(); } catch (Throwable e) { log.error("任务失败", e); }
});
// 方案 3：重写 ThreadPoolExecutor.afterExecute（★ 最彻底，能拿到 submit 的异常）
@Override
protected void afterExecute(Runnable r, Throwable t) {
    super.afterExecute(r, t);
    if (t == null && r instanceof Future<?>) {
        try {
            Future<?> future = (Future<?>) r;
            if (future.isDone()) future.get();      // ★ 取出被封装的异常
        } catch (CancellationException ce) {
            t = ce;
        } catch (ExecutionException ee) {
            t = ee.getCause();                       // ★ 真实异常
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
    if (t != null) log.error("任务执行异常", t);
}
```

## 5. 线程安全问题的根源

### 5.2 三大特性

| 特性 | 含义 | 破坏原因 | 保障手段 |
| --- | --- | --- | --- |
| **原子性（Atomicity）** | 操作不可分割，要么全做要么全不做 | ① `i++` 是「读-改-写」三步<br>② 线程切换可能发生在任意指令间 | `synchronized`、`Lock`、CAS 原子类 |
| **可见性（Visibility）** | 一个线程的修改对其他线程立即可见 | ① CPU 多级缓存（L1/L2/L3）<br>② 工作内存副本<br>③ 编译器/CPU 优化 | `volatile`、`synchronized`、`final`、CAS |
| **有序性（Ordering）** | 程序执行顺序符合预期 | ① 编译器指令重排<br>② CPU 乱序执行<br>③ 内存系统重排 | `volatile`（内存屏障）、`synchronized`（临界区串行）、happens-before |

### 5.2 经典问题演示

```java
// ─── 问题 1：原子性 —— count++ 不是原子操作 ───
public class AtomicityProblem {
    private static int count = 0;

    public static void main(String[] args) throws Exception {
        Runnable task = () -> {
            for (int i = 0; i < 10000; i++) count++;
        };
        Thread t1 = new Thread(task), t2 = new Thread(task);
        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println("期望 20000，实际：" + count);     // 大概率 < 20000！
    }
}
// count++ 的字节码是 4 条指令：
//   getstatic  count      ← ① 读取
//   iconst_1              ← ② 准备常量 1
//   iadd                  ← ③ 相加
//   putstatic  count      ← ④ 写回
// 线程 A 执行完 ①（读到 100），被切换；线程 B 完整执行完（count=101）；
// 线程 A 继续执行 ②③④，把 101 写回 → B 的更新丢失！

// ─── 问题 2：可见性 —— 没有 volatile 的死循环 ───
public class VisibilityProblem {
    private static boolean running = true;        // ❌ 无 volatile

    public static void main(String[] args) throws Exception {
        Thread t = new Thread(() -> {
            int i = 0;
            while (running) {                      // ★ 可能永远不退出！
                i++;
            }
            System.out.println("退出，i = " + i);
        });
        t.start();
        Thread.sleep(100);
        running = false;                           // main 线程修改
        System.out.println("main 已设置 running = false");
    }
}
// 原因：JIT 编译器把 while(running) 优化为：
//   if (!running) { while(true) { i++; } }        ← 提升（hoisting）优化
// 因为循环体内没有修改 running，编译器认为它不会变
// 加上 volatile 后禁止这个优化，且每次读取都从主内存拿

// ⚠️ 注意：这个问题在某些环境下（如加打印语句）不会出现，因为 println 内部有 synchronized，
//    形成了内存屏障，间接刷新了缓存 → 这类 bug 极难复现，称为 "Heisenbug"

// ─── 问题 3：有序性 —— DCL 单例的经典 bug ───
public class Singleton {
    private static Singleton instance;             // ❌ 缺 volatile

    public static Singleton getInstance() {
        if (instance == null) {                    // 第一次检查（无锁，快速路径）
            synchronized (Singleton.class) {
                if (instance == null) {            // 第二次检查
                    instance = new Singleton();    // ★ 这行不是原子操作！
                }
            }
        }
        return instance;
    }
}
// instance = new Singleton() 分为三步：
//   ① 分配内存
//   ② 调用构造器初始化对象
//   ③ 把 instance 指向分配的内存
// JIT/CPU 可能重排为 ①③②！
// 线程 A 执行完 ①③（instance 已非 null 但对象未初始化），线程 B 在第一次检查时
// 发现 instance != null，直接返回一个「半成品对象」→ 使用时 NPE 或数据错乱

// ✅ 修复：加 volatile 禁止重排
private static volatile Singleton instance;

// ✅ 更好的方案（无需 volatile，JVM 类加载机制保证）
public class Singleton {
    private Singleton() { }
    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }
    public static Singleton getInstance() { return Holder.INSTANCE; }
}

// ─── 问题 4：复合操作的竞态（check-then-act）───
public class CheckThenAct {
    private final Map<String, Object> cache = new HashMap<>();

    // ❌ 非原子：两个线程可能同时判断不存在，然后都去创建
    public Object get(String key) {
        if (!cache.containsKey(key)) {              // 检查
            cache.put(key, createValue());           // 执行 ← 两步之间可能被插入
        }
        return cache.get(key);
    }

    // ✅ 用原子方法
    public Object getFixed(String key) {
        return cache.computeIfAbsent(key, k -> createValue());   // ConcurrentHashMap 保证原子
    }

    // ✅ 或加锁
    public synchronized Object getSync(String key) {
        if (!cache.containsKey(key)) cache.put(key, createValue());
        return cache.get(key);
    }
}

// ─── 问题 5：读-改-写的丢失更新（银行账户）───
public class Account {
    private int balance;
    public void transfer(Account target, int amount) {
        this.balance -= amount;                     // ❌ 非原子
        target.balance += amount;                   // ❌ 非原子 + 锁顺序问题（可能死锁）
    }
    // ✅ 需要对「两个账户」同时加锁，且按固定顺序（如按账户 ID）避免死锁
}
```

### 5.3 线程安全的四个级别

| 级别 | 说明 | 示例 |
| --- | --- | --- |
| **不可变（Immutable）** | 对象创建后状态不变，**天生线程安全** | `String`、`Integer`、`LocalDate`、`final` 字段全不可变的类 |
| **绝对线程安全** | 无论运行环境如何，调用者都不需要额外同步 | 几乎没有（`Vector` 自称但实际不是） |
| **相对线程安全** | 单次操作是安全的，**复合操作需要同步** | `Vector`、`Hashtable`、`Collections.synchronizedXxx`、`ConcurrentHashMap`（部分） |
| **线程不安全** | 需要同步才能并发使用 | `ArrayList`、`HashMap`、`StringBuilder`、`SimpleDateFormat` |

```java
// Vector 是「相对线程安全」的经典反例
Vector<Integer> v = new Vector<>();
// 单个方法安全，但复合操作不安全：
if (v.size() > 0) {                       // 线程 A 检查通过
    v.remove(v.size() - 1);               // ★ 线程 B 此时已清空，A 抛 ArrayIndexOutOfBounds
}
// ✅ 必须外部加锁
synchronized (v) {
    if (v.size() > 0) v.remove(v.size() - 1);
}

// ConcurrentHashMap 也是「相对线程安全」
// put/get/remove 单个原子，但「先 get 再 put」不原子 → 用 putIfAbsent/compute/merge
```

> 【结论】**真正的线程安全只能靠「不可变对象」**。这是函数式编程的核心优势，也是 `String`、`BigDecimal`、`java.time` 全部设计为不可变的原因。

## 6. 线程间的协作

### 6.1 wait/notify 机制（Object 的方法）

```java
/**
 * 经典的等待-通知模型
 * 核心：wait 释放锁并进入等待队列，notify 从等待队列唤醒一个线程去竞争锁
 */
public class WaitNotifyDemo {

    private static final Object LOCK = new Object();
    private static boolean condition = false;

    // 等待方（消费者）
    static class Waiter implements Runnable {
        public void run() {
            synchronized (LOCK) {                      // ① 必须先获得锁
                while (!condition) {                    // ② ★ 用 while 而非 if（防虚假唤醒）
                    try {
                        System.out.println(Thread.currentThread().getName() + " 条件不满足，等待");
                        LOCK.wait();                     // ③ 释放锁 + 进入 WAITING
                        System.out.println(Thread.currentThread().getName() + " 被唤醒");
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
                // ④ 被唤醒并重新获得锁后，继续执行业务
                System.out.println(Thread.currentThread().getName() + " 处理业务");
            }                                          // ⑤ 退出同步块，释放锁
        }
    }

    // 通知方（生产者）
    static class Notifier implements Runnable {
        public void run() {
            synchronized (LOCK) {                      // ① 也要先获得锁
                condition = true;                       // ② 修改条件（必须在锁内！）
                System.out.println("条件已设置，唤醒所有等待线程");
                LOCK.notifyAll();                       // ③ ★ 推荐 notifyAll 而非 notify
            }                                          // ④ 释放锁后，等待的线程才能真正被唤醒
        }
    }

    public static void main(String[] args) throws Exception {
        for (int i = 0; i < 3; i++) {
            new Thread(new Waiter(), "waiter-" + i).start();
        }
        Thread.sleep(500);
        new Thread(new Notifier(), "notifier").start();
    }
}
```

**wait/notify 的五大规则（每条都是坑）：**

| # | 规则 | 违反后果 |
| --- | --- | --- |
| 1 | **必须在 synchronized 块中调用**（当前线程必须持有该对象的锁） | `IllegalMonitorStateException` |
| 2 | **wait 的条件判断必须用 `while` 循环，不能用 `if`** | 虚假唤醒 / 条件被其他线程改变后继续执行 |
| 3 | **修改条件变量必须在锁内** | 可见性问题，等待线程看不到修改 |
| 4 | **优先用 `notifyAll()` 而非 `notify()`** | notify 只唤醒一个，若唤醒的线程条件不满足 → **信号丢失，永久等待** |
| 5 | wait 的对象必须是「双方都能访问的共享对象」 | 各等各的，永远无法通信 |

**为什么用 while 而不是 if？（虚假唤醒 spurious wakeup）**

```java
// ❌ if 版本
synchronized (lock) {
    if (!condition) lock.wait();      // 唤醒后直接往下走
    doBusiness();                      // ★ 但此时 condition 可能已被其他线程改回 false！
}

// 场景：两个消费者，一个生产者生产了 1 个商品
// 消费者 A 和 B 都在 wait，生产者 notifyAll
// A 先获得锁，取走商品，condition 变 false，A 释放锁
// B 获得锁，从 wait 返回（if 不重新检查），直接 doBusiness → 处理了一个不存在的商品！

// ✅ while 版本：唤醒后重新检查条件
synchronized (lock) {
    while (!condition) lock.wait();    // 条件不满足就继续等
    doBusiness();
}

// 另外：JVM 规范明确允许「虚假唤醒」（没有 notify 也可能被唤醒），
// 这是为了在某些 OS/硬件上实现更高效（如 Linux futex 的批量唤醒）
// Object.wait 的官方文档：「A thread can also wake up without being notified,
//                          interrupted, or timing out, a so-called spurious wakeup.」
```

**notify vs notifyAll：**

| | `notify()` | `notifyAll()` |
| --- | --- | --- |
| 唤醒数量 | **1 个**（随机，JVM 决定） | **全部** |
| 性能 | 好（只唤醒一个，减少竞争） | 差（可能大量线程被唤醒又阻塞，「惊群效应」） |
| 风险 | **信号丢失**（唤醒的线程条件不满足又 wait，其他线程永远不被唤醒） | 安全 |
| 适用 | 确定只有一个线程能继续，且所有等待线程等价 | **默认选择**（《Effective Java》和《Java 并发编程实战》都推荐） |

```java
// 信号丢失的经典场景
// 队列容量 1，两个生产者两个消费者
// 消费者 C1、C2 都在 queue.isEmpty() 时 wait
// 生产者 P1 放入 1 个元素，调用 notify() → 恰好唤醒了 P2（也在等队列有空位？不，P2 不在等）
// 假设唤醒了错误的线程 → C1、C2 都没被唤醒 → 元素永远不被消费，程序挂死

// ✅ 除非能严格证明「所有等待线程都在等同一条件且只需一个被唤醒」，否则一律 notifyAll
```

### 6.2 synchronized 与 monitor 的关系

```java
// Object 的 wait/notify 实际是操作对象监视器（monitor）的等待队列
synchronized (obj) {          // 字节码：monitorenter
    obj.wait();               // 进入 obj 的 wait set，释放 monitor
    obj.notify();             // 从 wait set 移一个线程到 entry set（竞争锁）
    obj.notifyAll();          // 把 wait set 全部移到 entry set
}                             // 字节码：monitorexit
```

```
                 ObjectMonitor（C++ 对象，每个 synchronized 对象一个）
    ┌──────────────────────────────────────────────────────┐
    │  _owner   = 当前持有锁的线程                            │
    │  _count   = 重入次数                                    │
    │  _EntryList（竞争队列）: [线程B, 线程C]  ← 抢锁失败的线程   │
    │  _WaitSet （等待队列）: [线程D, 线程E]  ← 调用 wait 的线程  │
    │  _cxq     （ContentionQueue，最近到达的竞争者）            │
    └──────────────────────────────────────────────────────┘

线程 A: monitorenter → _owner = A, _count = 1
线程 D: A.wait() → D 进入 _WaitSet，_owner = null（释放锁）
线程 B: monitorenter → 发现 _owner = null，抢到锁，_owner = B
线程 B: notifyAll() → _WaitSet 的线程移到 _EntryList
线程 B: monitorexit → _owner = null
线程 D: 从 _EntryList 抢到锁 → 从 wait() 返回，继续执行 while 检查
```

### 6.3 wait/notify 的替代方案（现代并发）

```java
// ❌ 原始 wait/notify：容易出错（忘记 while、忘记 synchronized、信号丢失）

// ✅ 方案 1：Condition（Lock 版的 wait/notify，可以有多个等待队列）
Lock lock = new ReentrantLock();
Condition notFull = lock.newCondition();         // ★ 精确的通知：满/空两个队列
Condition notEmpty = lock.newCondition();

public class BoundedBuffer<T> {
    private final Object[] items;
    private int putIndex, takeIndex, count;
    private final Lock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    public BoundedBuffer(int capacity) { items = new Object[capacity]; }

    public void put(T x) throws InterruptedException {
        lock.lock();
        try {
            while (count == items.length) notFull.await();      // 队列满 → 等待
            items[putIndex] = x;
            if (++putIndex == items.length) putIndex = 0;
            count++;
            notEmpty.signal();                                   // ★ 只唤醒消费者，不干扰其他生产者
        } finally {
            lock.unlock();
        }
    }

    @SuppressWarnings("unchecked")
    public T take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0) notEmpty.await();                 // 队列空 → 等待
            T x = (T) items[takeIndex];
            items[takeIndex] = null;
            if (++takeIndex == items.length) takeIndex = 0;
            count--;
            notFull.signal();                                     // ★ 只唤醒生产者
            return x;
        } finally {
            lock.unlock();
        }
    }
}
// 这就是 ArrayBlockingQueue 的实现！

// ✅ 方案 2：BlockingQueue（★ 生产者-消费者的最佳选择，无需自己写同步）
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);
// 生产者
queue.put(task);                    // 满则阻塞
queue.offer(task, 3, TimeUnit.SECONDS);
// 消费者
Task t = queue.take();              // 空则阻塞
queue.poll(3, TimeUnit.SECONDS);

// ✅ 方案 3：CountDownLatch / CyclicBarrier（详见 JUC 工具类篇）
// ✅ 方案 4：CompletableFuture（异步回调，避免阻塞等待）
// ✅ 方案 5：LockSupport.park/unpark（AQS 的底层，比 wait 更灵活）
LockSupport.park();                 // 不需要持有锁！
LockSupport.unpark(thread);         // ★ 可以先 unpark 后 park（信号不会丢失）
```

**LockSupport vs wait/notify：**

| 对比 | wait/notify | LockSupport.park/unpark |
| --- | --- | --- |
| 是否需要锁 | **必须在 synchronized 中** | **不需要** |
| 信号丢失 | notify 先于 wait 会丢失 | **unpark 先于 park 不丢失**（许可最多累积 1 个） |
| 精确唤醒 | 不能指定线程 | **可以指定 Thread** |
| 唤醒顺序 | 不保证 | 更可控 |
| 底层 | ObjectMonitor | Unsafe.park（futex/条件变量） |

```java
// LockSupport 的「许可（permit）」机制
Thread t = new Thread(() -> {
    System.out.println("线程开始，即将 park");
    LockSupport.park();                       // 阻塞（许可为 0）
    System.out.println("被 unpark，继续执行");
    LockSupport.park();                       // 如果之前 unpark 了两次，这里不会阻塞
});
t.start();
LockSupport.unpark(t);                        // 可以在 park 之前调用！许可 +1（最多 1）
LockSupport.unpark(t);                        // 再来一次也还是 1（不会累积）

// park 的其他形式
LockSupport.park(Object blocker);             // ★ 带 blocker，jstack 能显示等待的对象
LockSupport.parkNanos(1_000_000_000L);        // 限时 1 秒
LockSupport.parkUntil(deadline);              // 到指定时间点
Thread.currentThread().getParkBlocker();      // 获取 blocker（AQS 用它实现可诊断性）

// ⚠️ park 会「虚假唤醒」，也需要循环检查条件
while (!condition) { LockSupport.park(); }
```

## 7. 实战：手写线程安全的阻塞容器

```java
/**
 * 用 synchronized + wait/notifyAll 实现一个简易阻塞队列（理解原理用）
 * 生产环境直接用 ArrayBlockingQueue / LinkedBlockingQueue
 */
public class SimpleBlockingQueue<T> {

    private final Queue<T> queue = new LinkedList<>();
    private final int capacity;
    private final Object lock = new Object();

    public SimpleBlockingQueue(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("容量必须 > 0");
        this.capacity = capacity;
    }

    /** 入队：满则阻塞 */
    public void put(T element) throws InterruptedException {
        synchronized (lock) {
            // ★ while 循环检查（防虚假唤醒 + 防被其他线程抢先）
            while (queue.size() == capacity) {
                lock.wait();
            }
            queue.offer(element);
            // ★ notifyAll：既能唤醒等待 put 的（虽然此时队列满不会唤醒成功），
            //   也能唤醒等待 take 的。用 notify 可能唤醒到 put 线程导致信号丢失
            lock.notifyAll();
        }
    }

    /** 出队：空则阻塞 */
    public T take() throws InterruptedException {
        synchronized (lock) {
            while (queue.isEmpty()) {
                lock.wait();
            }
            T element = queue.poll();
            lock.notifyAll();
            return element;
        }
    }

    /** 带超时的入队 */
    public boolean offer(T element, long timeout, TimeUnit unit) throws InterruptedException {
        long nanos = unit.toNanos(timeout);
        synchronized (lock) {
            while (queue.size() == capacity) {
                if (nanos <= 0) return false;                  // 超时返回 false
                long start = System.nanoTime();
                lock.wait(nanos / 1_000_000, (int) (nanos % 1_000_000));
                nanos -= (System.nanoTime() - start);           // ★ 扣除已等待时间
            }
            queue.offer(element);
            lock.notifyAll();
            return true;
        }
    }

    public int size() {
        synchronized (lock) { return queue.size(); }            // ★ 读也要加锁（可见性）
    }

    public boolean isEmpty() {
        synchronized (lock) { return queue.isEmpty(); }
    }
}

// 测试
public static void main(String[] args) {
    SimpleBlockingQueue<String> queue = new SimpleBlockingQueue<>(3);
    // 生产者
    new Thread(() -> {
        try {
            for (int i = 0; i < 10; i++) {
                String item = "item-" + i;
                queue.put(item);
                System.out.println(Thread.currentThread().getName() + " 生产：" + item);
                Thread.sleep(100);
            }
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }, "producer").start();
    // 消费者
    new Thread(() -> {
        try {
            while (true) {
                String item = queue.take();
                System.out.println(Thread.currentThread().getName() + " 消费：" + item);
                Thread.sleep(300);                               // 消费慢，触发阻塞
            }
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }, "consumer").start();
}
```

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 调用 `run()` 而非 `start()` | 没有新线程，同步执行 | `start()` |
| 2 | 重复 `start()` | `IllegalThreadStateException` | 一个 Thread 对象只能启动一次 |
| 3 | `wait` 用 `if` 而非 `while` | 虚假唤醒导致业务错误 | `while (!condition)` |
| 4 | `wait/notify` 不在 synchronized 中 | `IllegalMonitorStateException` | 必须先持有锁 |
| 5 | 用 `notify` 导致信号丢失 | 线程永久挂起 | 用 `notifyAll` |
| 6 | 修改条件变量不在锁内 | 可见性问题，等待线程不醒 | 锁内修改 |
| 7 | `sleep` 期望释放锁 | 其他线程进不来 | sleep 不释放锁，用 wait |
| 8 | catch InterruptedException 后不处理 | 线程池无法关闭 | `interrupt()` 恢复标志或重抛 |
| 9 | 用 `Thread.stop()` | 数据不一致 | 标志位 + interrupt |
| 10 | `submit()` 的任务异常丢失 | 静默失败无日志 | 用 `execute()` 或重写 `afterExecute` |
| 11 | 线程未命名 | jstack 无法定位问题 | `ThreadFactory` 指定名称 |
| 12 | 守护线程做持久化 | JVM 退出时数据丢失 | 用用户线程 + 优雅关闭 |
| 13 | DCL 单例缺 volatile | 拿到未初始化的对象 | `volatile` 或用静态内部类/枚举 |
| 14 | 无 volatile 的标志位循环 | 死循环不退出 | `volatile boolean running` |
| 15 | 依赖线程优先级 | 行为不可预期 | OS 调度器可能忽略优先级 |
| 16 | 对 Thread 对象 synchronized | 与 join 冲突 | 用独立的锁对象 |
| 17 | `Vector` 复合操作不加锁 | `IndexOutOfBoundsException` | 外部同步或用并发容器 |
| 18 | 一连接一线程 | 万级连接 OOM | 线程池 / NIO / 虚拟线程 |
| 19 | `Executors` 创建线程池 | OOM（无界队列/无限线程） | 手动 `ThreadPoolExecutor` |
| 20 | `synchronized` 等锁想被中断 | interrupt 无效 | 用 `lock.lockInterruptibly()` |
| 21 | `Thread.interrupted()` 误用 | 清除了标志导致后续判断失效 | 实例方法 `isInterrupted()` 不清除 |
| 22 | sleep 精度期望过高 | 实际睡眠时间长于请求 | 用 `ScheduledExecutorService` |
| 23 | 容器内 CPU 核数识别错误 | 线程池过大导致性能下降 | JDK 8u191+ 且开启 UseContainerSupport |
| 24 | 虚拟线程中用 synchronized 阻塞 | pinning，载体线程被占满 | 改用 `ReentrantLock` |
| 25 | ThreadLocal 在虚拟线程中大量使用 | 内存爆炸 | 改用 Scoped Values（JDK 21 预览） |

---

## 关联笔记

- 下一篇：[[后端/Java基础/并发编程/线程安全与synchronized]]（锁升级、对象头）
- 相关：[[后端/Java基础/并发编程/线程池原理与实战]]、[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]
- 内存模型：[[后端/JVM/JVM概述与运行时数据区]]（JMM、栈与堆）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
