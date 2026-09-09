---
title: "JUC工具类与ThreadLocal"
aliases:
  - "ThreadLocal 内存泄漏"
  - "CountDownLatch Semaphore"
  - "并发容器"
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
  - "[[后端/Java基础/并发编程/线程池原理与实战]]"
  - "[[后端/Java基础/并发编程/异步编程-CompletableFuture]]"
  - "[[后端/微服务/分布式ID与链路追踪]]"
created: 2026-09-07
updated: 2026-09-07
---

# JUC 工具类与 ThreadLocal

> 本篇覆盖 `java.util.concurrent` 中除锁与线程池之外的核心工具：**ThreadLocal**、**CountDownLatch / CyclicBarrier / Semaphore / Exchanger / Phaser**、**并发容器**、**Future 系列**。这些工具类大多基于 [[后端/Java基础/并发编程/Lock与AQS原理]] 中的 AQS。

## 1. ThreadLocal ★★★★★（面试高频 + 生产事故高发）

### 1.1 是什么

**ThreadLocal 提供「线程局部变量」：每个线程都拥有该变量的独立副本，线程之间互不干扰。**

```java
// 最简单的用法
ThreadLocal<String> userHolder = new ThreadLocal<>();

userHolder.set("Tom");                    // 当前线程设置
String name = userHolder.get();           // 当前线程获取
userHolder.remove();                      // ★ 当前线程移除（必须！）

// 线程 A 和线程 B 各自 set，互不影响
```

**三种典型使用场景：**

| 场景 | 说明 | 示例 |
| --- | --- | --- |
| **线程隔离**（Thread Confinement） | 把非线程安全的对象变成「每线程一份」，无需加锁 | `SimpleDateFormat`、`Random`、数据库连接 |
| **隐式参数传递** | 避免在方法签名中层层传递上下文 | 登录用户、traceId、事务上下文、租户 ID |
| **资源/连接绑定** | 一个线程绑定一个连接，保证同一事务用同一连接 | `ConnectionHolder`、`TransactionSynchronizationManager` |

```java
// ─── 场景 1：线程隔离（经典：SimpleDateFormat）───
// ❌ SimpleDateFormat 内部有可变状态（Calendar），多线程共享会解析错乱
private static final SimpleDateFormat SDF = new SimpleDateFormat("yyyy-MM-dd");
// 多线程调用 SDF.parse() → NumberFormatException、结果错乱

// ✅ 方案 1：ThreadLocal（JDK 8 之前）
private static final ThreadLocal<SimpleDateFormat> DATE_FORMAT =
        ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));   // JDK 8+
public String format(Date d) { return DATE_FORMAT.get().format(d); }

// ✅✅ 方案 2：直接用 JDK 8 的 DateTimeFormatter（不可变、线程安全，无需 ThreadLocal）
private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
public String format(LocalDate d) { return d.format(FMT); }

// ─── 场景 2：隐式传递登录用户（Web 项目标配）───
public class UserContext {
    private static final ThreadLocal<LoginUser> HOLDER = new ThreadLocal<>();

    public static void set(LoginUser user) { HOLDER.set(user); }
    public static LoginUser get() { return HOLDER.get(); }
    public static Long getUserId() {
        LoginUser u = HOLDER.get();
        return u == null ? null : u.getUserId();
    }
    public static Long requireUserId() {
        Long id = getUserId();
        if (id == null) throw new BusinessException(ResultCode.UNAUTHORIZED);
        return id;
    }
    public static void clear() { HOLDER.remove(); }          // ★ 必须提供清理方法
}

// 拦截器中设置与清理
public class AuthInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse resp, Object handler) {
        String token = req.getHeader("Authorization");
        LoginUser user = jwtService.parse(token);
        if (user == null) { resp.setStatus(401); return false; }
        UserContext.set(user);                                // ★ 设置
        return true;
    }
    @Override
    public void afterCompletion(HttpServletRequest req, HttpServletResponse resp,
                               Object handler, Exception ex) {
        UserContext.clear();                                   // ★★ 必须清理！
    }
}

// 业务代码中随处可取，无需层层传参
public Order createOrder(OrderDTO dto) {
    Long userId = UserContext.requireUserId();                 // 从上下文取
    ...
}

// ─── 场景 3：数据库连接绑定（Spring 事务的底层）───
// TransactionSynchronizationManager 内部就是 ThreadLocal
private static final ThreadLocal<Map<Object, Object>> resources =
        new NamedThreadLocal<>("Transactional resources");
private static final ThreadLocal<Set<TransactionSynchronization>> synchronizations =
        new NamedThreadLocal<>("Transaction synchronizations");
// 这就是「同一事务中的所有 DAO 操作用同一个数据库连接」的实现原理
// 也是「@Transactional 在异步线程中失效」的根本原因
```

### 1.2 底层结构 ★★★★★

```java
public class ThreadLocal<T> {

    /** ★ ThreadLocal 的哈希值（用于在 ThreadLocalMap 中定位槽位） */
    private final int threadLocalHashCode = nextHashCode();
    private static AtomicInteger nextHashCode = new AtomicInteger();
    private static final int HASH_INCREMENT = 0x61c88647;      // ★ 斐波那契散列（黄金分割数）
    private static int nextHashCode() { return nextHashCode.addAndGet(HASH_INCREMENT); }

    /** JDK 8+ 的初始值工厂 */
    protected T initialValue() { return null; }
    public static <S> ThreadLocal<S> withInitial(Supplier<? extends S> supplier) {
        return new SuppliedThreadLocal<>(supplier);
    }

    public T get() {
        Thread t = Thread.currentThread();
        ThreadLocalMap map = getMap(t);                 // ★ 从当前线程对象上取 map
        if (map != null) {
            ThreadLocalMap.Entry e = map.getEntry(this);   // ★ 以 this（ThreadLocal 对象）为 key
            if (e != null) return (T) e.value;
        }
        return setInitialValue();                        // map 为 null 或无此 key → 初始化
    }

    private T setInitialValue() {
        T value = initialValue();
        Thread t = Thread.currentThread();
        ThreadLocalMap map = getMap(t);
        if (map != null) map.set(this, value);
        else createMap(t, value);                         // ★ 首次使用才创建 map（懒初始化）
        return value;
    }

    public void set(T value) {
        Thread t = Thread.currentThread();
        ThreadLocalMap map = getMap(t);
        if (map != null) map.set(this, value);
        else createMap(t, value);
    }

    public void remove() {
        ThreadLocalMap m = getMap(Thread.currentThread());
        if (m != null) m.remove(this);                     // ★ 清理，防内存泄漏
    }

    /** ★★★ 关键：Map 存在 Thread 对象上，而不是 ThreadLocal 上！ */
    ThreadLocalMap getMap(Thread t) { return t.threadLocals; }
    void createMap(Thread t, T firstValue) { t.threadLocals = new ThreadLocalMap(this, firstValue); }
}

// Thread 类中
public class Thread implements Runnable {
    ThreadLocal.ThreadLocalMap threadLocals = null;        // ★ 每个线程一个 map
    ThreadLocal.ThreadLocalMap inheritableThreadLocals = null;   // 可继承版
}
```

**结构图（务必理解这个「反向引用」关系）：**

```
Thread 对象
   │
   └── threadLocals（ThreadLocalMap）
            │
            ├── Entry[0] : key=ThreadLocal@A (弱引用) → value="用户信息"
            ├── Entry[1] : key=ThreadLocal@B (弱引用) → value=SimpleDateFormat实例
            ├── Entry[2] : key=null（已回收）        → value="孤儿值" ★ 泄漏点！
            └── ...
            
            Table 长度 = 16（初始），2 的幂，扩容为 2 倍

★ 反直觉设计：
  不是「一个 ThreadLocal 持有所有线程的值」，
  而是「一个 Thread 持有所有 ThreadLocal 的值」
  
  好处：
  1. 线程死亡时，整个 map 随之被 GC，无需逐个清理
  2. 访问时不需要加锁（map 是线程私有的）
  3. ThreadLocal 对象本身可以被回收（弱引用 key）
```

**ThreadLocalMap 的 Entry（弱引用 key）：**

```java
static class ThreadLocalMap {

    /** ★★ Entry 的 key 是弱引用！ */
    static class Entry extends WeakReference<ThreadLocal<?>> {
        Object value;
        Entry(ThreadLocal<?> k, Object v) {
            super(k);          // ★ key 用弱引用包装
            value = v;
        }
    }

    private Entry[] table;
    private int size;
    private int threshold;      // = 容量 × 2/3（负载因子是 0.667，不是 HashMap 的 0.75）

    // ─── 开放地址法（线性探测）解决哈希冲突，而非 HashMap 的链表法 ───
    private Entry getEntry(ThreadLocal<?> key) {
        int i = key.threadLocalHashCode & (table.length - 1);     // 定位槽位
        Entry e = table[i];
        if (e != null && e.get() == key)                            // 直接命中
            return e;
        else
            return getEntryAfterMiss(key, i, e);                    // 线性探测查找
    }

    private Entry getEntryAfterMiss(ThreadLocal<?> key, int i, Entry e) {
        Entry[] tab = table;
        int len = tab.length;
        while (e != null) {
            ThreadLocal<?> k = e.get();
            if (k == key) return e;
            if (k == null)
                expungeStaleEntry(i);        // ★★ 顺带清理 key 已回收的「脏 Entry」
            else
                i = nextIndex(i, len);        // ★ 线性探测：i = (i + 1) % len
            e = tab[i];
        }
        return null;
    }

    private void set(ThreadLocal<?> key, Object value) {
        Entry[] tab = table;
        int len = tab.length;
        int i = key.threadLocalHashCode & (len-1);

        for (Entry e = tab[i]; e != null; e = tab[i = nextIndex(i, len)]) {
            ThreadLocal<?> k = e.get();
            if (k == key) { e.value = value; return; }              // 已存在 → 更新
            if (k == null) {                                         // 遇到脏 Entry
                replaceStaleEntry(key, value, i);                    // ★ 复用它并清理周围脏数据
                return;
            }
        }
        tab[i] = new Entry(key, value);                              // 新建
        if (!cleanSomeSlots(i, len) && size >= threshold)
            rehash();                                                // 阈值 = 容量 × 2/3
    }
}
```

> 【面试】**ThreadLocalMap 为什么用「开放地址法（线性探测）」而 HashMap 用「链地址法」？**
>
> 1. **数据量小**：一个线程通常只有几个 ThreadLocal，冲突概率低，线性探测的缓存局部性更好（数组连续访问）。
> 2. **弱引用 key 可能被回收**：链表法需要额外维护节点，线性探测在遍历时可以顺便清理「key 为 null 的脏 Entry」（`expungeStaleEntry`），实现「启发式清理」。
> 3. **内存紧凑**：不需要 Node 对象，只有一个 Entry 数组。
>
> 代价：装载因子必须很低（2/3），且大量脏 Entry 会导致探测链变长、性能下降。

### 1.3 内存泄漏问题 ★★★★★（必考）

```java
// ─── 泄漏链条 ───
// 引用链：Thread → ThreadLocalMap → Entry → (弱引用) ThreadLocal
//                                          → (强引用) value ★ 泄漏点

public class LeakDemo {
    // 静态字段，生命周期与应用相同
    private static final ThreadLocal<byte[]> HOLDER = new ThreadLocal<>();

    public void process() {
        HOLDER.set(new byte[10 * 1024 * 1024]);      // 10MB
        // 方法结束，但没有 remove()
        // ★ 如果这个线程是线程池中的核心线程（永不销毁），这 10MB 永远无法回收！
    }
}

// 泄漏发生的完整条件（三者缺一不可）：
// 1. ThreadLocal 引用被置 null 或被 GC（弱引用 key 失效）
// 2. 线程仍然存活（线程池的核心线程、长生命周期线程）
// 3. 没有调用 remove()，且之后没有再 get/set 触发启发式清理
```

**为什么 key 要设计成弱引用？**

```java
// 假设 key 是强引用：
// 引用链：Thread → Map → Entry → key(强) → ThreadLocal 对象
//                              → value(强) → 大对象
// 即使业务代码把 ThreadLocal 变量置 null，Entry 的 key 仍强引用它 → ThreadLocal 永不回收
// value 也永不回收 → 双重泄漏，且完全无法自愈

// 用弱引用后：
// 业务代码不再持有 ThreadLocal（如方法结束、变量置 null）
// → GC 时弱引用 key 被回收 → Entry 变成 key=null 的「脏 Entry」
// → 后续任意 get/set/remove 都会触发 expungeStaleEntry 清理 value ★ 自愈机制
// → 即使一直不触发，至少 ThreadLocal 对象本身被回收了

// 结论：弱引用是「减轻」泄漏而非「杜绝」泄漏，value 仍需手动 remove
```

**ThreadLocal 的三层清理机制：**

| 机制 | 触发时机 | 作用范围 |
| --- | --- | --- |
| `expungeStaleEntry` | `getEntryAfterMiss`、`set` 遇到 key=null 的 Entry | 从当前位置向后连续清理，直到遇到空槽 |
| `cleanSomeSlots` | `set` 新 Entry 后 | 对数级扫描（log₂n 次），启发式清理 |
| `remove()` | **手动调用** ★ | 精确清理当前 Entry + 触发 expunge |
| 线程死亡 | 线程结束，Thread 对象被 GC | 整个 ThreadLocalMap 被回收 |

```java
// ✅ 唯一可靠的做法：try-finally 中 remove
public void handleRequest(Request req) {
    try {
        UserContext.set(parseUser(req));
        MDC.put("traceId", generateTraceId());
        doBusiness();
    } finally {
        UserContext.clear();          // ★ 必须！
        MDC.clear();                  // ★ 必须！
    }
}

// ✅ 更好的封装：把 set/clear 成对封装成模板方法
public static <T> T callWithUser(LoginUser user, Supplier<T> action) {
    LoginUser previous = UserContext.get();
    try {
        UserContext.set(user);
        return action.get();
    } finally {
        if (previous != null) UserContext.set(previous);   // 恢复原值（支持嵌套）
        else UserContext.clear();
    }
}
```

**ThreadLocal 的三大生产事故：**

```java
// ─── 事故 1：数据串号（最严重！用户 A 看到用户 B 的数据）───
// 原因：线程池线程复用，上一个任务的 ThreadLocal 未清理，下一个任务读到脏数据
@GetMapping("/profile")
public UserProfile profile() {
    LoginUser user = UserContext.get();
    // ★ 若某个分支忘记 set（如白名单接口跳过鉴权），
    //   这里读到的是「上一个请求的用户」→ 越权访问！
    return userService.getProfile(user.getUserId());
}
// ✅ 防御措施：
// 1. 拦截器 afterCompletion 中无条件 clear
// 2. 每次请求开始时先 clear 再 set（Filter 的 doFilter 开头）
// 3. 关键场景用 requireXxx() 而非 getXxx()，null 时抛异常而非降级

// ─── 事故 2：内存泄漏导致 Full GC 频繁 ──
// 线程池 200 个核心线程，每个 ThreadLocal 存了 5MB 的对象 → 1GB 常驻内存
// ✅ 排查：jmap -histo | grep ThreadLocalMap，MAT 中找 "Thread Local Variables" 支配树

// ─── 事故 3：异步/子线程拿不到上下文 ───
UserContext.set(user);
pool.execute(() -> {
    UserContext.get();          // ❌ null（不同线程）
});
@Async
public void asyncMethod() {
    UserContext.get();          // ❌ null
}
// ✅ 解决方案见 [[后端/Java基础/并发编程/线程池原理与实战]] 的 TaskDecorator / TTL
```

### 1.4 InheritableThreadLocal 与 TransmittableThreadLocal

```java
// ─── InheritableThreadLocal：父线程 → 子线程（创建时复制）───
InheritableThreadLocal<String> itl = new InheritableThreadLocal<>();
itl.set("parent-value");

new Thread(() -> {
    System.out.println(itl.get());     // "parent-value" ★ 子线程能读到
}).start();

// 原理：Thread 构造器中复制父线程的 inheritableThreadLocals
// Thread.init() 源码
if (parent.inheritableThreadLocals != null)
    this.inheritableThreadLocals =
        ThreadLocal.createInheritedMap(parent.inheritableThreadLocals);
// ★ 是「浅拷贝」：复制 Entry 引用，value 是同一个对象（可变对象会被共享修改！）

// ❌ InheritableThreadLocal 的致命缺陷：线程池场景失效！
ExecutorService pool = Executors.newFixedThreadPool(4);
itl.set("task-1");
pool.execute(() -> System.out.println(itl.get()));   // 可能是 null 或旧值
// 原因：线程池的线程是「复用的」，不是每次 new Thread，
//      复制只发生在「线程创建时」，而池化线程早已创建 → 拿到的是创建时的旧值或 null

// ─── TransmittableThreadLocal（TTL，阿里开源）★ 解决线程池传递 ───
// Maven: com.alibaba:transmittable-thread-local:2.14.5
import com.alibaba.ttl.TransmittableThreadLocal;
import com.alibaba.ttl.TtlRunnable;
import com.alibaba.ttl.threadpool.TtlExecutors;

TransmittableThreadLocal<String> ttl = new TransmittableThreadLocal<>();

// 用法 1：包装 Runnable/Callable
ttl.set("value-1");
Runnable task = TtlRunnable.get(() -> System.out.println(ttl.get()));   // ★ 提交时捕获快照
pool.execute(task);                                                      // 正确输出 "value-1"

// 用法 2：包装整个线程池（★ 推荐，业务代码无感知）
ExecutorService ttlPool = TtlExecutors.getTtlExecutorService(originalPool);
ttl.set("value-2");
ttlPool.execute(() -> System.out.println(ttl.get()));    // "value-2"

// 用法 3：Java Agent（无侵入，全局生效）
// java -javaagent:path/to/transmittable-thread-local-2.14.5.jar -jar app.jar

// 原理：TtlRunnable 在「构造时（提交任务的线程）」捕获所有 TTL 变量的快照，
//      在「run 时（执行任务的线程）」回放快照，执行完还原 → 实现「提交时传递」而非「创建时传递」

// ─── JDK 21 的 ScopedValue（虚拟线程时代的替代方案，预览中）───
private static final ScopedValue<LoginUser> USER = ScopedValue.newInstance();

ScopedValue.where(USER, currentUser).run(() -> {
    // 作用域内（含 fork 的子任务）都能读，作用域结束自动清理
    System.out.println(USER.get());
    StructuredTaskScope.ShutdownOnFailure scope = new StructuredTaskScope.ShutdownOnFailure();
    scope.fork(() -> USER.get());          // ★ 自动继承（结构化并发）
});
// 优势：不可变（无数据串号风险）、自动清理（无泄漏）、继承开销 O(1)（不复制 map）
```

**四种 ThreadLocal 变体对比：**

| 类型 | 传递时机 | 线程池可用 | 可变性 | 泄漏风险 |
| --- | --- | --- | --- | --- |
| `ThreadLocal` | 不传递 | — | 可变 | **有**（必须 remove） |
| `InheritableThreadLocal` | **线程创建时** | ❌ 失效 | 可变 | 有 |
| `TransmittableThreadLocal` | **任务提交时** | ✅ | 可变 | 有（需 remove） |
| `ScopedValue`（JDK 21） | **作用域绑定时** | ✅ | **不可变** | **无**（自动清理） |

### 1.5 ThreadLocal 使用规范

```java
// ✅ 1. 声明为 private static final（避免重复创建）
private static final ThreadLocal<SimpleDateFormat> SDF = ThreadLocal.withInitial(...);

// ✅ 2. 命名清晰，用 NamedThreadLocal 便于调试
public class NamedThreadLocal<T> extends ThreadLocal<T> {
    private final String name;
    public NamedThreadLocal(String name) { this.name = name; }
    @Override public String toString() { return name; }    // jstack/MAT 中可见
}

// ✅ 3. 封装成工具类，成对提供 set/get/clear
public final class UserContext {
    private static final ThreadLocal<LoginUser> HOLDER =
            new NamedThreadLocal<>("UserContext");
    private UserContext() { }
    public static void set(LoginUser u) { HOLDER.set(u); }
    public static LoginUser get() { return HOLDER.get(); }
    public static void clear() { HOLDER.remove(); }        // ★ 对外暴露清理方法
}

// ✅ 4. 用完必须 remove（try-finally）
// ✅ 5. 请求开始时先 clear（防御线程池脏数据）
// ✅ 6. 异步场景用 TaskDecorator / TTL 传递
// ❌ 7. 不要用 ThreadLocal 存大对象（内存放大 N 倍，N = 线程数）
// ❌ 8. 不要用 ThreadLocal 做「跨方法的全局变量」（隐蔽的耦合，难排查）
// ❌ 9. 不要在 static 块外随意 new ThreadLocal（每个实例都会在 Map 中占一个槽）
```

## 2. 同步工具类 ★★★★★

### 2.1 CountDownLatch（倒计时门闩）—— 一次性

**让一个或多个线程等待其他线程完成。基于 AQS 的共享模式，state = 计数值。**

```java
import java.util.concurrent.CountDownLatch;

public class CountDownLatchDemo {

    /** 场景 1：主线程等待所有子任务完成（并行加载首页数据） */
    public HomePageData loadHomePage(Long userId) throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(4);          // ★ 计数 = 子任务数
        HomePageData data = new HomePageData();

        executor.execute(() -> {
            try { data.setUserInfo(userService.get(userId)); }
            finally { latch.countDown(); }                      // ★ 必须在 finally 中！
        });
        executor.execute(() -> {
            try { data.setOrders(orderService.recent(userId)); }
            finally { latch.countDown(); }
        });
        executor.execute(() -> {
            try { data.setRecommend(recommendService.list(userId)); }
            finally { latch.countDown(); }
        });
        executor.execute(() -> {
            try { data.setCoupons(couponService.available(userId)); }
            finally { latch.countDown(); }
        });

        // ★ 带超时等待（生产必须！避免某个任务卡死导致主线程永久阻塞）
        boolean finished = latch.await(3, TimeUnit.SECONDS);
        if (!finished) {
            log.warn("首页数据加载超时，剩余计数={}，返回部分数据", latch.getCount());
            // 降级：返回已加载的部分 + 默认值
        }
        return data;
    }

    /** 场景 2：多个线程同时开始（模拟并发压测） */
    public void concurrentTest(int threadCount) throws InterruptedException {
        CountDownLatch startSignal = new CountDownLatch(1);      // 「发令枪」
        CountDownLatch doneSignal = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.execute(() -> {
                try {
                    startSignal.await();                          // ★ 所有线程在此等待
                    doRequest();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneSignal.countDown();
                }
            });
        }
        Thread.sleep(500);                                        // 等所有线程就位
        long start = System.nanoTime();
        startSignal.countDown();                                  // ★ 一声令下，同时开始
        doneSignal.await();
        System.out.println("并发 " + threadCount + " 总耗时："
                + (System.nanoTime() - start) / 1_000_000 + "ms");
    }
}
```

**CountDownLatch 源码要点：**

```java
public class CountDownLatch {
    private static class Sync extends AbstractQueuedSynchronizer {
        Sync(int count) { setState(count); }                  // ★ state = 计数值
        int getCount() { return getState(); }

        // 共享模式获取：state == 0 才成功（返回 1），否则失败（返回 -1）
        protected int tryAcquireShared(int acquires) {
            return (getState() == 0) ? 1 : -1;
        }

        // 释放：CAS 把 state 减 1，减到 0 时返回 true → 触发共享传播唤醒
        protected boolean tryReleaseShared(int releases) {
            for (;;) {
                int c = getState();
                if (c == 0) return false;                      // 已经是 0，不再减
                int nextc = c - 1;
                if (compareAndSetState(c, nextc))
                    return nextc == 0;                          // ★ 减到 0 才需要唤醒等待者
            }
        }
    }

    public void await() throws InterruptedException { sync.acquireSharedInterruptibly(1); }
    public boolean await(long timeout, TimeUnit unit) throws InterruptedException {
        return sync.tryAcquireSharedNanos(1, unit.toNanos(timeout));
    }
    public void countDown() { sync.releaseShared(1); }
    public long getCount() { return sync.getCount(); }
}
```

**CountDownLatch 的特性与限制：**

| 特性 | 说明 |
| --- | --- |
| **一次性** | 计数减到 0 后**无法重置**，不能复用（要复用用 `CyclicBarrier`） |
| 谁都能 countDown | 不要求是等待的线程，任何线程都可以减计数 |
| await 可多个线程 | 计数归零时，**所有**等待线程一起被唤醒（共享模式的传播特性） |
| 计数为 0 时 await 立即返回 | `new CountDownLatch(0).await()` 不阻塞 |
| countDown 到负数无效 | state 已是 0 时 `tryReleaseShared` 返回 false，不再减 |

### 2.2 CyclicBarrier（循环栅栏）—— 可重复使用

**让一组线程互相等待，全部到达「屏障点」后再一起继续。可循环使用。**

```java
import java.util.concurrent.CyclicBarrier;

public class CyclicBarrierDemo {

    /** 场景：分片计算，每轮所有分片算完后汇总，然后进入下一轮 */
    public void parallelCompute() {
        int parties = 4;                                          // 参与方数量

        // ★ barrierAction：所有线程到达后、放行前，由「最后一个到达的线程」执行
        CyclicBarrier barrier = new CyclicBarrier(parties, () -> {
            System.out.println("─── 本轮所有分片计算完成，开始汇总 ───");
            mergeResults();
        });

        for (int i = 0; i < parties; i++) {
            final int shard = i;
            executor.execute(() -> {
                try {
                    for (int round = 1; round <= 3; round++) {     // ★ 多轮，barrier 可重复使用
                        System.out.printf("分片%d 第%d轮计算中%n", shard, round);
                        compute(shard, round);

                        int waitCount = barrier.await();           // ★ 等待其他分片
                        // waitCount = 该线程是第几个到达的（0 表示最后一个，会执行 barrierAction）
                        System.out.printf("分片%d 第%d轮完成，等待序号=%d%n", shard, round, waitCount);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (BrokenBarrierException e) {               // ★ 栅栏被破坏
                    System.err.println("栅栏已损坏，任务终止：" + e.getMessage());
                }
            });
        }
    }

    /** 带超时的 await（推荐） */
    public void withTimeout(CyclicBarrier barrier) {
        try {
            barrier.await(10, TimeUnit.SECONDS);                   // 超时抛 TimeoutException
        } catch (TimeoutException e) {
            log.error("等待其他线程超时");
            // ★ 超时会自动把栅栏置为 broken 状态，其他线程收到 BrokenBarrierException
        } catch (InterruptedException | BrokenBarrierException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** 重置栅栏（broken 或需要重新开始时） */
    public void reset(CyclicBarrier barrier) {
        barrier.reset();      // ★ 重置为初始状态；正在等待的线程收到 BrokenBarrierException
    }
}
```

**CyclicBarrier 的实现原理（用 ReentrantLock + Condition，不是直接继承 AQS）：**

```java
public class CyclicBarrier {
    private static class Generation {                 // ★ 「代」的概念：每次屏障触发就是一代
        boolean broken = false;
    }

    private final ReentrantLock lock = new ReentrantLock();
    private final Condition trip = lock.newCondition();   // ★ 用 Condition 实现等待/唤醒
    private final int parties;                            // 参与方总数
    private final Runnable barrierCommand;                // 屏障动作
    private Generation generation = new Generation();
    private int count;                                    // 还未到达的线程数

    public CyclicBarrier(int parties, Runnable barrierAction) {
        if (parties <= 0) throw new IllegalArgumentException();
        this.parties = parties;
        this.count = parties;
        this.barrierCommand = barrierAction;
    }

    private int dowait(boolean timed, long nanos) throws ... {
        final ReentrantLock lock = this.lock;
        lock.lock();                                       // ① 加锁
        try {
            final Generation g = generation;
            if (g.broken) throw new BrokenBarrierException();
            if (Thread.interrupted()) { breakBarrier(); throw new InterruptedException(); }

            int index = --count;                            // ② 计数减 1
            if (index == 0) {                                // ③ ★ 最后一个到达
                boolean ranAction = false;
                try {
                    if (barrierCommand != null)
                        barrierCommand.run();                 // ④ 在当前线程执行屏障动作
                    ranAction = true;
                    nextGeneration();                         // ⑤ ★ 开启新一代（重置 count + signalAll）
                    return 0;
                } finally {
                    if (!ranAction) breakBarrier();
                }
            }

            // ⑥ 非最后一个 → 循环等待
            for (;;) {
                try {
                    if (!timed) trip.await();                 // ★ Condition.await 等待
                    else if (nanos > 0L) nanos = trip.awaitNanos(nanos);
                } catch (InterruptedException ie) { ... }

                if (g == generation)                          // 还是同一代 → 继续等
                    continue;                                  // （可能是虚假唤醒）
                if (!timed && !g.broken)
                    return index;                              // 换代了 → 返回
                ...
            }
        } finally {
            lock.unlock();
        }
    }

    private void nextGeneration() {
        trip.signalAll();                    // ★ 唤醒所有等待线程
        count = parties;                     // ★ 重置计数（这就是「可循环」的关键）
        generation = new Generation();       // ★ 新建一代
    }

    private void breakBarrier() {
        generation.broken = true;
        count = parties;
        trip.signalAll();
    }
}
```

### 2.3 CountDownLatch vs CyclicBarrier ★★★★★

| 对比 | CountDownLatch | CyclicBarrier |
| --- | --- | --- |
| **语义** | **一个/多个线程等待其他线程完成** | **一组线程互相等待，全部到齐再一起走** |
| 计数变化 | 只能递减（`countDown`） | 递减到 0 后**自动重置** |
| 可重用 | ❌ **一次性** | ✅ **可循环使用**（reset / 自动换代） |
| 参与方角色 | 计数者与等待者可以是**不同线程** | 等待者本身就是计数者（**同一批线程**） |
| 屏障动作 | ❌ 无 | ✅ 支持（最后一个到达的线程执行） |
| 底层实现 | **AQS 共享模式**（state = 计数） | **ReentrantLock + Condition** |
| 异常 | 无特殊异常 | `BrokenBarrierException`（超时/中断/重置会破坏栅栏） |
| 类比 | **火箭发射倒计时**（等所有检查项完成） | **人齐了才发车**（旅游团集合） |
| 典型场景 | 主线程等 N 个子任务；并发压测发令枪 | 多阶段并行计算；多线程分片后汇总 |

```java
// 一句话记忆：
// CountDownLatch：A 等 B、C、D 干完活（一次性，A 不参与干活）
// CyclicBarrier： A、B、C、D 互相等，都到齐了一起进入下一阶段（可循环）
```

### 2.4 Semaphore（信号量）—— 限流

**控制同时访问某个资源的线程数量。基于 AQS 共享模式，state = 剩余许可数。**

```java
import java.util.concurrent.Semaphore;

public class SemaphoreDemo {

    /** 场景 1：限流（★ 最常见，保护下游资源） */
    // 数据库连接只有 20 个，限制同时查询的线程数
    private final Semaphore dbSemaphore = new Semaphore(20);          // 20 个许可

    public List<Data> queryWithLimit(String sql) {
        try {
            dbSemaphore.acquire();                        // ★ 获取许可（阻塞等待）
            try {
                return jdbcTemplate.query(sql, rowMapper);
            } finally {
                dbSemaphore.release();                     // ★★ 必须 release！
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("查询被中断", e);
        }
    }

    /** 场景 2：非阻塞限流（快速失败，比阻塞更适合面向用户的请求） */
    public Result<Object> queryWithTryLimit(String key) {
        if (!dbSemaphore.tryAcquire()) {                   // ★ 拿不到许可立即返回
            return Result.failed(429, "系统繁忙，请稍后重试");   // HTTP 429 Too Many Requests
        }
        try {
            return Result.success(doQuery(key));
        } finally {
            dbSemaphore.release();
        }
    }

    /** 场景 3：带超时的限流 */
    public void queryWithTimeout() throws InterruptedException {
        if (dbSemaphore.tryAcquire(3, TimeUnit.SECONDS)) {
            try { doQuery(); } finally { dbSemaphore.release(); }
        } else {
            throw new BusinessException("获取资源超时");
        }
    }

    /** 场景 4：批量获取许可 */
    semaphore.acquire(5);                                  // 一次获取 5 个
    semaphore.release(5);
    semaphore.tryAcquire(5, 1, TimeUnit.SECONDS);

    /** 场景 5：公平模式（FIFO，避免饥饿） */
    Semaphore fair = new Semaphore(10, true);              // ★ 第二个参数 fair
    Semaphore unfair = new Semaphore(10);                   // 默认非公平（吞吐量高）

    /** 场景 6：用 Semaphore(1) 实现互斥锁（但不可重入，且可被其他线程 release！） */
    Semaphore mutex = new Semaphore(1);
    mutex.acquire();
    try { ... } finally { mutex.release(); }
    // ⚠️ 与 Lock 的区别：Semaphore 没有「持有者」概念，
    //   A 线程 acquire，B 线程 release 是合法的 → 容易出错，不要用 Semaphore 当锁

    /** 诊断 API */
    semaphore.availablePermits();                          // 当前可用许可数
    semaphore.getQueueLength();                            // 等待的线程数
    semaphore.hasQueuedThreads();
    semaphore.drainPermits();                              // ★ 一次性取走所有许可（变为 0）
    semaphore.reducePermits(5);                            // ★ 减少许可（protected，需继承）
    semaphore.isFair();
}
```

**Semaphore 的实现（非公平版）：**

```java
static class NonfairSync extends Sync {
    protected int tryAcquireShared(int acquires) {
        return nonfairTryAcquireShared(acquires);
    }
}
// Sync（AQS 子类）
final int nonfairTryAcquireShared(int acquires) {
    for (;;) {
        int available = getState();
        int remaining = available - acquires;
        if (remaining < 0 ||                                   // 许可不足 → 失败
            compareAndSetState(available, remaining))           // ★ CAS 扣减许可
            return remaining;                                   // 返回剩余（共享模式语义）
    }
}
protected final boolean tryReleaseShared(int releases) {
    for (;;) {
        int current = getState();
        int next = current + releases;
        if (next < current) throw new Error("Maximum permit count exceeded");  // 溢出
        if (compareAndSetState(current, next)) return true;     // ★ CAS 归还许可
    }
}
```

### 2.5 Exchanger（线程间数据交换）与 Phaser（分阶段同步）

```java
// ─── Exchanger：两个线程在同步点交换数据（用得少）───
Exchanger<List<String>> exchanger = new Exchanger<>();

// 生产者线程
executor.execute(() -> {
    List<String> produced = new ArrayList<>();
    try {
        for (int i = 0; i < 10; i++) {
            produced.add("data-" + i);
            if (produced.size() == 5) {
                produced = exchanger.exchange(produced);   // ★ 交换：给出 produced，拿到消费者的
                // 现在 produced 是消费者处理完（清空）的列表，可以复用
            }
        }
    } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
});

// 消费者线程
executor.execute(() -> {
    List<String> buffer = new ArrayList<>();
    try {
        while (true) {
            buffer = exchanger.exchange(buffer);           // ★ 拿到生产者的数据，给回空列表
            process(buffer);
            buffer.clear();
        }
    } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
});
// 应用：缓冲区复用（双缓冲）、遗传算法、对账系统（两个数据源比对）

// ─── Phaser：可动态注册参与方的多阶段栅栏（CyclicBarrier + CountDownLatch 的合体）───
Phaser phaser = new Phaser(1);                            // 注册主线程（1 个参与方）

for (int i = 0; i < 5; i++) {
    phaser.register();                                     // ★ 动态注册（参与方 +1）
    final int taskId = i;
    executor.execute(() -> {
        for (int phase = 0; phase < 3; phase++) {
            doWork(taskId, phase);
            phaser.arriveAndAwaitAdvance();                // ★ 到达并等待本阶段所有参与方
        }
        phaser.arriveAndDeregister();                       // ★ 完成并注销（参与方 -1）
    });
}

phaser.arriveAndAwaitAdvance();                            // 主线程等待所有阶段完成
phaser.arriveAndDeregister();

// Phaser 的核心 API
phaser.register();                       // 注册一个参与方，返回当前 phase
phaser.bulkRegister(10);                  // 批量注册
phaser.arrive();                          // 到达（不等待），返回 phase 号
phaser.arriveAndAwaitAdvance();           // 到达并等待（等价 CyclicBarrier.await）
phaser.arriveAndDeregister();             // 到达并注销
phaser.awaitAdvance(phase);               // 等待指定 phase 完成
phaser.getPhase();                        // 当前阶段号
phaser.getRegisteredParties();            // 注册的参与方总数
phaser.getArrivedParties();               // 已到达数
phaser.isTerminated();
// 可重写 onAdvance(phase, registeredParties) 自定义每阶段结束的逻辑，返回 true 终止 Phaser
```

### 2.6 同步工具类选型速查

| 需求 | 选择 |
| --- | --- |
| 主线程等 N 个子任务完成 | **CountDownLatch** |
| 并发压测的「同时开始」发令枪 | **CountDownLatch(1)** |
| N 个线程互相等待、分阶段推进、需重复 | **CyclicBarrier** |
| 限制并发访问资源的线程数（限流） | **Semaphore** |
| 两个线程交换缓冲区 | **Exchanger** |
| 参与方数量动态变化的多阶段同步 | **Phaser** |
| 异步任务编排（有依赖关系） | **CompletableFuture** ★ 首选 |
| 单个异步结果等待 | **Future / FutureTask** |
| 生产消费解耦 | **BlockingQueue** |

## 3. 并发容器 ★★★★★

### 3.1 并发容器全景

| 类型 | 非线程安全 | 同步包装（过时） | **并发容器（推荐）** |
| --- | --- | --- | --- |
| List | `ArrayList`、`LinkedList` | `Vector`、`Collections.synchronizedList` | **`CopyOnWriteArrayList`** |
| Set | `HashSet`、`TreeSet` | `Collections.synchronizedSet` | **`CopyOnWriteArraySet`**、**`ConcurrentSkipListSet`** |
| Map | `HashMap`、`TreeMap` | `Hashtable`、`Collections.synchronizedMap` | **`ConcurrentHashMap`**、**`ConcurrentSkipListMap`** |
| Queue | `ArrayDeque`、`PriorityQueue` | — | **`ConcurrentLinkedQueue`**、**`BlockingQueue` 系列** |
| Deque | `ArrayDeque` | — | **`ConcurrentLinkedDeque`**、**`LinkedBlockingDeque`** |

### 3.2 CopyOnWriteArrayList（写时复制）

```java
// 原理：读无锁，写时复制整个数组 → 替换 volatile 引用
// 详见 [[后端/Java基础/集合框架-List与Set]] 第 2.3 节

// ✅ 适用场景
// 1. 读多写极少：监听器列表、订阅者列表、白名单/黑名单、路由表
// 2. 配置类数据：启动时加载，运行时只读
private final List<EventListener> listeners = new CopyOnWriteArrayList<>();
public void register(EventListener l) { listeners.add(l); }         // 偶发写
public void fireEvent(Event e) {
    for (EventListener l : listeners) l.onEvent(e);                  // 高频读，无锁，迭代安全
}

// ❌ 不适用
// 1. 写频繁（每次 add 都复制整个数组，O(n) + GC 压力）
// 2. 数据量大（内存翻倍：新旧两个数组同时存在）
// 3. 要求强一致性（读到的是快照，可能不是最新）
// 4. 需要排序/去重的 Set 语义（CopyOnWriteArraySet 的 contains 是 O(n)）
```

### 3.3 BlockingQueue 深入（生产者-消费者的标准方案）

**七种 BlockingQueue 对比：**

| 实现 | 底层 | 有界 | 锁 | 特点 |
| --- | --- | --- | --- | --- |
| `ArrayBlockingQueue` | 数组 | ★ 必须指定 | 1 把锁 + 2 Condition | FIFO，支持公平模式，内存紧凑 |
| `LinkedBlockingQueue` | 链表 | 可选（默认 `Integer.MAX_VALUE`） | ★ 2 把锁（put/take 分离） | 吞吐量高，⚠️ 默认无界 |
| `PriorityBlockingQueue` | 二叉堆 | 无界 | 1 把锁 | 按优先级出队，元素需 Comparable |
| `DelayQueue` | PriorityQueue | 无界 | 1 把锁 | 元素到期才能取（实现 Delayed 接口） |
| `SynchronousQueue` | 无容量 | 0 | CAS | 直接交付（put 必须等 take），newCachedThreadPool 用它 |
| `LinkedTransferQueue` | 链表 | 无界 | CAS | 支持 transfer（等消费者真正接收），性能优于 LinkedBlockingQueue |
| `LinkedBlockingDeque` | 双向链表 | ★ 有界 | 1 把锁 | 双端阻塞，适合工作窃取 |

**四组 API（★ 必须记清）：**

| 操作 | 抛异常 | 返回特殊值 | 阻塞 | 超时 |
| --- | --- | --- | --- | --- |
| 插入 | `add(e)` → IllegalStateException | `offer(e)` → false | `put(e)` | `offer(e, t, u)` → false |
| 移除 | `remove()` → NoSuchElementException | `poll()` → null | `take()` | `poll(t, u)` → null |
| 检查 | `element()` → NoSuchElementException | `peek()` → null | — | — |

```java
// 其他实用方法
queue.remainingCapacity();          // 剩余容量
queue.drainTo(list);                // ★ 批量取出（比循环 poll 高效得多）
queue.drainTo(list, 100);           // 最多取 100 个
queue.removeIf(x -> ...);

// ─── DelayQueue 实战：订单超时自动关闭 ───
public class DelayedOrder implements Delayed {
    private final String orderId;
    private final long expireTime;               // 到期时间戳（毫秒）

    public DelayedOrder(String orderId, long delayMs) {
        this.orderId = orderId;
        this.expireTime = System.currentTimeMillis() + delayMs;
    }

    /** ★ 剩余延迟时间，<= 0 表示已到期可取出 */
    @Override
    public long getDelay(TimeUnit unit) {
        return unit.convert(expireTime - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
    }

    /** ★ 按到期时间排序（PriorityQueue 用） */
    @Override
    public int compareTo(Delayed other) {
        return Long.compare(this.getDelay(TimeUnit.MILLISECONDS),
                            other.getDelay(TimeUnit.MILLISECONDS));
    }

    public String getOrderId() { return orderId; }
}

// 消费端
DelayQueue<DelayedOrder> delayQueue = new DelayQueue<>();
delayQueue.put(new DelayedOrder("ORD001", 30 * 60 * 1000));   // 30 分钟后到期

executor.execute(() -> {
    while (!Thread.currentThread().isInterrupted()) {
        try {
            DelayedOrder order = delayQueue.take();            // ★ 阻塞直到有元素到期
            closeOrderIfUnpaid(order.getOrderId());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            break;
        }
    }
});
// ⚠️ DelayQueue 的局限：数据在内存中，应用重启丢失 → 生产用 RocketMQ 延时消息 / Redis ZSet / XXL-JOB

// ─── SynchronousQueue 实战：直接交付（无缓冲）───
SynchronousQueue<Task> queue = new SynchronousQueue<>();
// put 会阻塞直到有线程 take，反之亦然 → 适合「任务必须立即被处理」的场景
// newCachedThreadPool 用它：来一个任务就必须有线程接手，没有就新建线程

// ─── 完整的生产者-消费者（★ 标准模板）───
public class ProducerConsumer {
    private final BlockingQueue<Task> queue = new ArrayBlockingQueue<>(1000);
    private final AtomicInteger producedCount = new AtomicInteger();
    private final AtomicInteger consumedCount = new AtomicInteger();
    private volatile boolean running = true;

    // 生产者（多个）
    public void produce() {
        while (running || hasMoreSource()) {
            try {
                Task task = fetchTask();                       // 可能阻塞（如从 MQ 拉取）
                if (task == null) { Thread.sleep(100); continue; }
                queue.put(task);                               // ★ 队列满则阻塞（天然背压）
                producedCount.incrementAndGet();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    // 消费者（多个）
    public void consume() {
        while (running) {
            try {
                // ★ poll + 超时：既能响应停止信号，又不会空转
                Task task = queue.poll(1, TimeUnit.SECONDS);
                if (task == null) continue;
                process(task);
                consumedCount.incrementAndGet();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                log.error("任务处理失败，进入死信队列", e);
                deadLetterQueue.offer(task);                    // ★ 失败不阻塞主流程
            }
        }
        // 优雅关闭：处理完剩余任务
        queue.drainTo(remainingTasks);
        remainingTasks.forEach(this::process);
    }

    public void shutdown() {
        running = false;                                        // 先停止生产
        // 等消费者处理完队列（或超时后 drainTo 兜底）
    }
}
```

### 3.4 ConcurrentLinkedQueue（无锁非阻塞队列）

```java
// 基于 CAS 的无锁队列（Michael-Scott 算法），高并发下性能优于 LinkedBlockingQueue
ConcurrentLinkedQueue<Task> queue = new ConcurrentLinkedQueue<>();

queue.offer(task);            // 非阻塞入队（永远成功，因为无界）
queue.poll();                 // ★ 非阻塞出队，队列空返回 null（不阻塞！）
queue.peek();
queue.size();                 // ⚠️ O(n) 遍历，且是弱一致的（并发下不准确）→ 高频调用性能差
queue.isEmpty();              // O(1)
queue.remove(obj);            // O(n)
queue.addAll(collection);
queue.clear();                // ⚠️ 不是原子操作

// 适用：多线程间传递消息、无需阻塞语义的场景
// 不适用：需要阻塞等待（用 BlockingQueue）、需要精确 size（用 LongAdder 单独计数）
// 特点：无界（不会拒绝任务，但可能 OOM）、弱一致性迭代器、高吞吐
```

### 3.5 并发容器选型

| 需求 | 选择 |
| --- | --- |
| 高并发 Map | **ConcurrentHashMap** |
| 需要排序的并发 Map | **ConcurrentSkipListMap** |
| 读多写极少的 List | **CopyOnWriteArrayList** |
| 高并发 List/Set（写也多） | 无完美方案 → 分段锁 / `Collections.synchronizedList` + 细粒度锁 |
| 阻塞的生产消费 | **ArrayBlockingQueue**（有界）/ **LinkedBlockingQueue**（指定容量） |
| 高吞吐非阻塞队列 | **ConcurrentLinkedQueue** |
| 优先级 + 并发 | **PriorityBlockingQueue** |
| 延时任务 | **DelayQueue**（内存）/ RocketMQ 延时消息（持久化） |
| 双端 + 工作窃取 | **LinkedBlockingDeque** |
| 直接交付 | **SynchronousQueue** |

## 4. Future 系列

### 4.1 Future 的局限

```java
ExecutorService pool = Executors.newFixedThreadPool(4);
Future<String> future = pool.submit(() -> queryData());

future.get();                       // ★ 阻塞等待（浪费当前线程）
future.get(5, TimeUnit.SECONDS);    // 带超时
future.isDone();                    // 只能轮询
future.isCancelled();
future.cancel(true);                // true = 中断正在执行的线程

// ❌ Future 的四大痛点（这就是 CompletableFuture 出现的原因）
// 1. get() 阻塞：无法在完成后自动执行后续逻辑（不支持回调）
// 2. 不能链式组合：多个 Future 的依赖关系需要手写嵌套 get
// 3. 不能合并多个 Future：allOf/anyOf 需要自己实现
// 4. 异常处理笨拙：异常被包装成 ExecutionException，需要 getCause 层层剥

// ❌ 手写「先查用户，再查订单，再查商品」的依赖链（阻塞式）
Future<User> userFuture = pool.submit(() -> getUser(id));
User user = userFuture.get();                                  // 阻塞 1
Future<List<Order>> orderFuture = pool.submit(() -> getOrders(user));
List<Order> orders = orderFuture.get();                         // 阻塞 2
Future<List<Product>> productFuture = pool.submit(() -> getProducts(orders));
List<Product> products = productFuture.get();                   // 阻塞 3
// 总耗时 = 三次之和，且主线程全程阻塞

// ✅ CompletableFuture 版本（非阻塞、链式）
CompletableFuture.supplyAsync(() -> getUser(id), pool)
    .thenApplyAsync(user -> getOrders(user), pool)
    .thenApplyAsync(orders -> getProducts(orders), pool)
    .thenAccept(products -> render(products))
    .exceptionally(ex -> { log.error("失败", ex); return null; });
// 总耗时 = 三次之和，但主线程不阻塞，可以继续处理其他请求
```

> CompletableFuture 的完整 API 见 [[后端/Java基础/并发编程/异步编程-CompletableFuture]]。

### 4.2 FutureTask

```java
// FutureTask 是 Future 的唯一 JDK 实现（RunnableFuture = Runnable + Future）
FutureTask<String> task = new FutureTask<>(() -> {
    Thread.sleep(1000);
    return "结果";
});

new Thread(task).start();            // 可以当 Runnable 用
String result = task.get();           // 阻塞等待

// FutureTask 的状态机（JDK 7+ 用 volatile int state 表示）
// NEW → COMPLETING → NORMAL          正常完成
// NEW → COMPLETING → EXCEPTIONAL     抛异常
// NEW → CANCELLED                     cancel(false)
// NEW → INTERRUPTING → INTERRUPTED    cancel(true)

task.getState();                      // 内部方法，外部用 isDone/isCancelled 判断
```

**FutureTask 的实战应用：防止缓存重复加载（singleflight 模式）**

```java
// 场景：热点 key 失效时，100 个线程同时请求，只让 1 个去查库，其他等待结果
private final ConcurrentHashMap<String, FutureTask<Data>> loadingTasks = new ConcurrentHashMap<>();

public Data getWithSingleFlight(String key) {
    Data cached = cache.get(key);
    if (cached != null) return cached;

    FutureTask<Data> newTask = new FutureTask<>(() -> queryFromDb(key));
    // ★ putIfAbsent 的原子性保证只有一个线程的 task 被放入
    FutureTask<Data> existing = loadingTasks.putIfAbsent(key, newTask);

    if (existing == null) {
        existing = newTask;
        newTask.run();                     // ★ 只有第一个线程真正执行查询
    }
    try {
        return existing.get(3, TimeUnit.SECONDS);    // 其他线程等待同一个结果
    } catch (Exception e) {
        throw new BusinessException("加载失败", e);
    } finally {
        loadingTasks.remove(key, existing);          // ★ 清理（CAS 语义，避免删掉别人的）
    }
}
// Guava 的 LoadingCache、Caffeine 的 get(key, mappingFunction) 内部就是这个思路
```

## 5. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | ThreadLocal 未 remove | **内存泄漏 + 数据串号**（用户 A 看到 B 的数据） | `finally` 中 `remove()` |
| 2 | 线程池 + ThreadLocal | 线程复用读到上个任务的残留值 | 请求开始先 clear 再 set |
| 3 | `InheritableThreadLocal` 用于线程池 | 拿不到值或拿到旧值 | 用 TTL（`TransmittableThreadLocal`） |
| 4 | ThreadLocal 存大对象 | 内存放大 N 倍（N=线程数） | 只存必要的小对象 |
| 5 | ThreadLocal 的 value 是可变共享对象 | 多线程修改同一对象 | 每线程独立创建（`withInitial`） |
| 6 | 静态 ThreadLocal 被置 null | Entry 变脏，探测链变长 | 不要置 null，用 remove |
| 7 | `CountDownLatch.countDown` 不在 finally | 任务抛异常导致计数永不归零，主线程永久阻塞 | 必须 `finally &#123; countDown(); &#125;` |
| 8 | `CountDownLatch.await()` 无超时 | 某任务卡死 → 主线程永久阻塞 | `await(timeout, unit)` |
| 9 | 期望 CountDownLatch 可重用 | 第二次 await 立即返回 | 用 `CyclicBarrier` |
| 10 | `CyclicBarrier` 未处理 `BrokenBarrierException` | 编译错误/异常未处理 | 必须 catch（受检异常） |
| 11 | CyclicBarrier 某线程超时 | 栅栏 broken，所有线程抛异常 | 合理设置超时 + reset 恢复 |
| 12 | `Semaphore.release()` 不在 finally | 许可泄漏，最终全部阻塞 | 必须 `finally &#123; release(); &#125;` |
| 13 | 把 Semaphore 当互斥锁 | 其他线程可 release，状态错乱 | 用 `ReentrantLock` |
| 14 | Semaphore 许可数配错（过大） | 限流失效，下游被打垮 | 按下游承载能力配置 + 压测验证 |
| 15 | `LinkedBlockingQueue` 默认无界 | OOM | 显式指定容量 |
| 16 | `ConcurrentLinkedQueue.size()` 高频调用 | 性能差（O(n) 遍历） | 用单独的 `LongAdder` 计数 |
| 17 | `CopyOnWriteArrayList` 频繁写 | 内存翻倍 + GC 压力 + 性能差 | 改用其他方案 |
| 18 | `PriorityBlockingQueue` 放不可比较对象 | `ClassCastException` | 实现 `Comparable` 或传 `Comparator` |
| 19 | `DelayQueue` 存持久化数据 | 应用重启丢失 | 用 MQ 延时消息 / Redis ZSet |
| 20 | `submit()` 任务异常静默丢失 | 无日志无告警 | `future.get()` 或重写 `afterExecute` |
| 21 | `future.get()` 无超时 | 永久阻塞 | `get(timeout, unit)` |
| 22 | `ExecutionException` 未取 cause | 日志中看不到真实异常 | `e.getCause()` |
| 23 | 线程池嵌套 + `future.get()` 等待 | **死锁** | 拆分线程池或用 CompletableFuture |
| 24 | `CompletableFuture` 未处理异常 | 异常静默丢失 | `exceptionally` / `whenComplete` |
| 25 | CompletableFuture 用默认 ForkJoinPool | 阻塞 IO 拖垮 commonPool | 显式传入自定义线程池 |
| 26 | TTL 未包装线程池 | 上下文传递失效 | `TtlExecutors.getTtlExecutorService` |

---

## 关联笔记

- 上一篇：[[后端/Java基础/并发编程/线程池原理与实战]]
- 下一篇：[[后端/Java基础/并发编程/异步编程-CompletableFuture]]
- 原理：[[后端/Java基础/并发编程/Lock与AQS原理]]（CountDownLatch/Semaphore 基于 AQS，CyclicBarrier 基于 Condition）
- 相关：[[后端/Java基础/集合框架-List与Set]]（BlockingQueue）、[[后端/Java基础/集合框架-Map与源码剖析]]（ConcurrentHashMap）
- 应用：[[后端/微服务/分布式ID与链路追踪]]（MDC 与 ThreadLocal 传递 traceId）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
