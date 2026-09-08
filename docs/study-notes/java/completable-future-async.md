---
title: "异步编程-CompletableFuture"
aliases:
  - "CompletableFuture"
  - "Java 异步编排"
tags:
  - "后端"
  - "java"
  - "并发"
  - "面试"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]"
  - "[[后端/Java基础/并发编程/线程池原理与实战]]"
  - "[[后端/SpringBoot/整合Web开发]]"
  - "[[后端/微服务/OpenFeign服务调用]]"
created: 2026-09-07
updated: 2026-09-07
---

# 异步编程：CompletableFuture

> CompletableFuture 是 JDK 8 引入的异步编程利器，实现了 `Future` + `CompletionStage` 双接口，支持**链式调用、任务编排、异常处理、多任务组合**，彻底解决了 `Future.get()` 阻塞的痛点。这是现代 Java 异步编排的标准方案。

## 1. 为什么需要 CompletableFuture

### 1.1 Future 的四大痛点

```java
ExecutorService pool = Executors.newFixedThreadPool(4);

// 痛点 1：get() 阻塞，浪费线程
Future<String> f = pool.submit(() -> queryUser());
String result = f.get();                // ★ 阻塞当前线程，无法做别的事

// 痛点 2：不能链式组合（有依赖的任务要嵌套 get）
Future<User> uf = pool.submit(() -> getUser(id));
User user = uf.get();                                          // 阻塞
Future<List<Order>> of = pool.submit(() -> getOrders(user));    // 必须等上一步
List<Order> orders = of.get();                                  // 阻塞

// 痛点 3：不能合并多个 Future（要手写循环 + 计数）
List<Future<Data>> futures = tasks.stream().map(pool::submit).toList();
for (Future<Data> f : futures) results.add(f.get());            // 串行等待

// 痛点 4：异常处理笨拙（包装成 ExecutionException，要 getCause 层层剥）
try {
    f.get();
} catch (ExecutionException e) {
    Throwable real = e.getCause();       // 真实异常
}

// 痛点 5：只能轮询状态，不能注册回调
while (!f.isDone()) { Thread.sleep(100); }    // 忙等待，浪费 CPU
```

### 1.2 CompletableFuture 的能力

| 能力 | API | 说明 |
| --- | --- | --- |
| **非阻塞获取** | `thenApply`、`thenAccept`、`thenRun` | 完成后自动触发回调 |
| **链式转换** | `thenApply(f).thenApply(g)` | 类似 Stream 的管道 |
| **任务编排** | `thenCompose`、`thenCombine` | 串行依赖 / 并行合并 |
| **多任务聚合** | `allOf`、`anyOf` | 等待全部 / 任一完成 |
| **异常处理** | `exceptionally`、`handle`、`whenComplete` | 优雅的错误恢复 |
| **超时控制** | `orTimeout`、`completeOnTimeout`（JDK 9+） | 超时兜底 |
| **手动完成** | `complete`、`completeExceptionally` | 桥接回调式 API |
| **指定线程池** | `xxxAsync(fn, executor)` | 隔离业务线程池 |

```java
// 上面 5 个痛点的 CompletableFuture 版本（一行链式，全程非阻塞）
CompletableFuture.supplyAsync(() -> getUser(id), pool)
    .thenComposeAsync(user -> CompletableFuture.supplyAsync(() -> getOrders(user), pool))
    .thenApplyAsync(orders -> convert(orders), pool)
    .orTimeout(3, TimeUnit.SECONDS)
    .exceptionally(ex -> { log.error("失败", ex); return Collections.emptyList(); })
    .thenAcceptAsync(this::render, pool);
// 主线程立即返回，所有步骤在 pool 中异步流转
```

## 2. 创建 CompletableFuture

```java
// ─── 1. 无返回值的异步任务 ───
CompletableFuture<Void> f1 = CompletableFuture.runAsync(() -> doWork());
CompletableFuture<Void> f2 = CompletableFuture.runAsync(() -> doWork(), customExecutor);   // ★ 指定线程池

// ─── 2. 有返回值的异步任务 ───
CompletableFuture<String> f3 = CompletableFuture.supplyAsync(() -> "result");
CompletableFuture<User> f4 = CompletableFuture.supplyAsync(() -> queryUser(id), executor);

// ─── 3. 已完成的 Future（用于返回缓存值、降级值、单元测试）───
CompletableFuture<String> done = CompletableFuture.completedFuture("value");
CompletableFuture.failedFuture(new RuntimeException("失败"));        // JDK 9+
CompletableFuture<String> delayed = CompletableFuture.delayedExecutor(2, TimeUnit.SECONDS);  // JDK 9+ 延迟执行器

// ─── 4. 手动创建（桥接回调式 API，如老的异步 SDK）───
CompletableFuture<String> manual = new CompletableFuture<>();
// 在回调中手动完成
oldAsyncSdk.call(new Callback() {
    @Override public void onSuccess(String data) {
        manual.complete(data);                          // ★ 正常完成
    }
    @Override public void onError(Throwable e) {
        manual.completeExceptionally(e);                // ★ 异常完成
    }
});
// 也可以在其他线程中 complete
manual.complete("forced-value");
manual.completeExceptionally(new TimeoutException("超时"));
manual.cancel(true);                                     // 等价 completeExceptionally(CancellationException)

// ─── 5. JDK 9+ 的延迟与超时执行器 ───
CompletableFuture.supplyAsync(task, CompletableFuture.delayedExecutor(1, TimeUnit.SECONDS));
```

> 【坑】**不指定 Executor 时默认使用 `ForkJoinPool.commonPool()`**：
> - commonPool 的并行度 = CPU 核数 - 1（单核机器上是 1！）
> - **全 JVM 共享**，`parallelStream()` 也用它 → 互相影响
> - **在 commonPool 中做阻塞 IO 是灾难**：线程被占满后，其他并行任务全部排队
> - **虚拟线程时代（JDK 21）**：commonPool 的行为有变化，但仍建议显式指定
>
> 【强制】**生产环境一律显式传入自定义线程池**：`supplyAsync(task, bizExecutor)`。

## 3. 串行处理（一个任务的后续）★★★★★

```java
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> "hello", executor);

// ─── thenApply：有入参、有返回（Function<T,U>）—— 转换结果 ───
CompletableFuture<Integer> f1 = future.thenApply(String::length);              // String → Integer
CompletableFuture<String> f2 = future.thenApplyAsync(s -> s.toUpperCase(), executor);
// 结果：5 / "HELLO"

// ─── thenAccept：有入参、无返回（Consumer<T>）—— 消费结果 ───
CompletableFuture<Void> f3 = future.thenAccept(s -> System.out.println(s));
CompletableFuture<Void> f4 = future.thenAcceptAsync(s -> save(s), executor);
// 结果：Void（用于「拿到结果做点事，不关心返回值」）

// ─── thenRun：无入参、无返回（Runnable）—— 只关心「完成了」这个事实 ───
CompletableFuture<Void> f5 = future.thenRun(() -> System.out.println("完成了"));
CompletableFuture<Void> f6 = future.thenRunAsync(() -> cleanup(), executor);
// 结果：Void（拿不到前一步的结果，只做收尾动作）

// ─── 链式调用（流水线）───
CompletableFuture<Integer> chain = CompletableFuture
        .supplyAsync(() -> queryUser(id), executor)          // User
        .thenApply(User::getDeptId)                          // Long（转换）
        .thenApply(deptId -> queryDept(deptId))              // Dept（转换）
        .thenApply(Dept::getName)                            // String
        .thenApply(String::toUpperCase)                      // String
        .thenApply(String::length);                          // Integer
// 每一步都在上一步完成后自动触发，全程无阻塞
```

**三者对比（必背）：**

| 方法 | 参数类型 | 能否拿到上一步结果 | 有无返回值 | 典型用途 |
| --- | --- | --- | --- | --- |
| `thenApply` | `Function<T,U>` | ✅ | ✅ U | 数据转换、映射 |
| `thenAccept` | `Consumer<T>` | ✅ | ❌ Void | 消费结果（存库、发消息） |
| `thenRun` | `Runnable` | ❌ | ❌ Void | 收尾动作（清理、日志） |

**同步版 vs Async 版的执行线程（重要）：**

```java
// thenApply（无 Async）：执行线程取决于「谁完成了上一步」
//   ① 如果上一步已完成 → 在「调用 thenApply 的线程」中同步执行（当前线程）
//   ② 如果上一步未完成 → 在「完成上一步的那个线程」中执行
CompletableFuture<String> f = CompletableFuture.supplyAsync(() -> {
    sleep(100);
    return "x";
}, executor);
f.thenApply(s -> {
    System.out.println(Thread.currentThread().getName());   // pool-1-thread-1（异步线程）
    return s;
});

CompletableFuture<String> done = CompletableFuture.completedFuture("x");
done.thenApply(s -> {
    System.out.println(Thread.currentThread().getName());   // main（★ 当前线程，因为已完成）
    return s;
});

// thenApplyAsync（有 Async）：★ 总是提交到线程池执行
//   - 不传 executor → ForkJoinPool.commonPool()
//   - 传 executor → 指定的线程池
f.thenApplyAsync(s -> {
    System.out.println(Thread.currentThread().getName());   // 一定是线程池的线程
    return s;
}, executor);
```

> 【坑】**用同步版 `thenApply` 时，如果上一步已完成，回调会在当前线程执行**。在 Web 场景（Tomcat 线程）中这可能导致：本以为是异步的操作实际阻塞了请求线程。**对耗时操作一律用 `xxxAsync(fn, executor)` 显式指定线程池**。

## 4. 任务编排（组合多个任务）★★★★★

### 4.1 thenCompose：串行依赖（扁平化，避免嵌套）

```java
// 场景：查到用户后，用用户信息去查订单（第二个任务依赖第一个的结果）

// ❌ thenApply 会导致 CompletableFuture 嵌套
CompletableFuture<CompletableFuture<List<Order>>> nested =
    getUserAsync(id).thenApply(user -> getOrdersAsync(user));   // 双层嵌套，难用

// ✅ thenCompose：扁平化（相当于 Stream 的 flatMap）
CompletableFuture<List<Order>> flat =
    getUserAsync(id).thenCompose(user -> getOrdersAsync(user));   // ★ 单层
CompletableFuture<List<Order>> flat2 =
    getUserAsync(id).thenComposeAsync(UserService::getOrdersAsync, executor);

// 完整示例
public CompletableFuture<OrderDetailVO> loadOrderDetail(Long orderId) {
    return getOrderAsync(orderId)                                    // Order
        .thenComposeAsync(order ->
            getUserAsync(order.getUserId())                          // 依赖 order
                .thenCombineAsync(                                   // ★ 并行合并两个任务
                    getProductAsync(order.getProductId()),
                    (user, product) -> assemble(order, user, product)))
        .thenApplyAsync(this::toVO, executor);
}
```

**thenApply vs thenCompose：**

| | thenApply | thenCompose |
| --- | --- | --- |
| 函数返回 | 普通值 `U` | **`CompletionStage<U>`** |
| 结果类型 | `CompletableFuture<U>` | `CompletableFuture<U>`（扁平） |
| 类比 | Stream 的 `map` | Stream 的 `flatMap` |
| 用途 | 同步转换 | **异步调用有依赖的下一个任务** |

### 4.2 thenCombine：并行执行 + 合并两个结果

```java
// 场景：两个独立任务并行执行，都完成后合并结果
CompletableFuture<Double> priceFuture = CompletableFuture.supplyAsync(() -> queryPrice(skuId), executor);
CompletableFuture<Integer> stockFuture = CompletableFuture.supplyAsync(() -> queryStock(skuId), executor);

// ★ 两个任务并行执行，都完成后用 BiFunction 合并
CompletableFuture<String> combined = priceFuture.thenCombine(
        stockFuture,
        (price, stock) -> String.format("价格 %.2f，库存 %d", price, stock));
// 总耗时 = max(price 耗时, stock 耗时)，而非两者之和！

// Async 版
CompletableFuture<String> combined2 = priceFuture.thenCombineAsync(
        stockFuture,
        (price, stock) -> format(price, stock),
        executor);

// thenAcceptBoth：合并后消费（无返回）
priceFuture.thenAcceptBoth(stockFuture,
        (price, stock) -> saveToCache(skuId, price, stock));

// runAfterBoth：两个都完成后执行一个 Runnable（拿不到结果）
priceFuture.runAfterBoth(stockFuture, () -> log.info("价格和库存都查完了"));

// ─── 实战：并行调用多个下游服务（聚合页面数据）★★★ ───
public CompletableFuture<HomePageVO> loadHomePage(Long userId) {
    CompletableFuture<UserVO> userF = CompletableFuture.supplyAsync(() -> userService.get(userId), executor);
    CompletableFuture<List<OrderVO>> orderF = CompletableFuture.supplyAsync(() -> orderService.recent(userId), executor);
    CompletableFuture<List<CouponVO>> couponF = CompletableFuture.supplyAsync(() -> couponService.available(userId), executor);
    CompletableFuture<List<BannerVO>> bannerF = CompletableFuture.supplyAsync(() -> bannerService.list(), executor);
    CompletableFuture<WalletVO> walletF = CompletableFuture.supplyAsync(() -> walletService.get(userId), executor);

    // ★ 五个任务并行，全部完成后组装（比串行快 5 倍）
    return CompletableFuture.allOf(userF, orderF, couponF, bannerF, walletF)
        .thenApply(v -> HomePageVO.builder()
                .user(userF.join())              // ★ allOf 已完成，join 不会阻塞
                .orders(orderF.join())
                .coupons(couponF.join())
                .banners(bannerF.join())
                .wallet(walletF.join())
                .build());
}
```

### 4.3 applyToEither / acceptEither：任一完成即处理

```java
// 场景：调用两个数据源（主 + 备），谁先返回用谁（容灾/加速）
CompletableFuture<String> primary = CompletableFuture.supplyAsync(() -> queryFromMainDb(), executor);
CompletableFuture<String> backup = CompletableFuture.supplyAsync(() -> queryFromCache(), executor);

// ★ 任一完成就用它的结果
CompletableFuture<String> fastest = primary.applyToEither(backup, result -> result);
CompletableFuture<String> fastest2 = primary.applyToEitherAsync(backup, Function.identity(), executor);

// acceptEither：任一完成后消费
primary.acceptEither(backup, result -> log.info("最快结果：{}", result));

// runAfterEither：任一完成后执行 Runnable
primary.runAfterEither(backup, () -> log.info("有一个完成了"));

// 实战：多机房就近查询
public CompletableFuture<Data> queryWithFailover(String key) {
    return queryFromRegionA(key)
        .applyToEither(queryFromRegionB(key), Function.identity());
}
// ⚠️ 注意：另一个任务不会被取消，仍会继续执行（浪费资源）
//    需要取消时用 whenComplete 中判断并 cancel
```

### 4.4 allOf 与 anyOf：多任务聚合

```java
// ─── allOf：等待全部完成 ───
CompletableFuture<String> f1 = CompletableFuture.supplyAsync(() -> "A", executor);
CompletableFuture<String> f2 = CompletableFuture.supplyAsync(() -> "B", executor);
CompletableFuture<String> f3 = CompletableFuture.supplyAsync(() -> {
    sleep(1000);
    return "C";
}, executor);

CompletableFuture<Void> all = CompletableFuture.allOf(f1, f2, f3);
all.join();                                      // ★ 阻塞等待全部完成
// ⚠️ allOf 返回 CompletableFuture<Void>，拿不到各任务的结果！
//    需要自己从各个 future 中取（此时已完成，join 不阻塞）
List<String> results = Stream.of(f1, f2, f3)
        .map(CompletableFuture::join)
        .collect(Collectors.toList());           // [A, B, C]

// ★ 封装：让 allOf 直接返回结果列表（实用工具方法）
public static <T> CompletableFuture<List<T>> allOfList(List<CompletableFuture<T>> futures) {
    return CompletableFuture
            .allOf(futures.toArray(new CompletableFuture[0]))
            .thenApply(v -> futures.stream()
                    .map(CompletableFuture::join)
                    .collect(Collectors.toList()));
}
// 使用
List<CompletableFuture<User>> userFutures = ids.stream()
        .map(id -> CompletableFuture.supplyAsync(() -> getUser(id), executor))
        .collect(Collectors.toList());
CompletableFuture<List<User>> allUsers = allOfList(userFutures);

// ─── anyOf：任一完成即返回 ───
CompletableFuture<Object> any = CompletableFuture.anyOf(f1, f2, f3);
Object first = any.join();                       // "A"（最快完成的那个）
// ⚠️ 返回类型是 CompletableFuture<Object>（因为各 future 类型可能不同），需要强转
// ⚠️ 如果最快完成的那个是「异常完成」，anyOf 也会异常结束（不会等其他成功的）

// ─── 实战：批量并发调用 + 超时兜底 ───
public List<Product> batchQueryProducts(List<Long> ids, long timeoutMs) {
    List<CompletableFuture<Product>> futures = ids.stream()
            .map(id -> CompletableFuture.supplyAsync(() -> productService.get(id), executor)
                    .exceptionally(ex -> {                       // ★ 单个失败不影响整体
                        log.warn("查询商品 {} 失败", id, ex);
                        return null;
                    }))
            .collect(Collectors.toList());

    try {
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                .get(timeoutMs, TimeUnit.MILLISECONDS);          // ★ 整体超时
    } catch (TimeoutException e) {
        log.error("批量查询超时，返回已完成的部分");
    } catch (Exception e) {
        log.error("批量查询异常", e);
    }

    return futures.stream()
            .filter(f -> f.isDone() && !f.isCompletedExceptionally())   // 只取成功的
            .map(CompletableFuture::join)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
}
```

**编排 API 速查表：**

| 需求 | API |
| --- | --- |
| B 依赖 A 的结果，且 B 是异步的 | `A.thenCompose(a -> asyncB(a))` |
| B 依赖 A 的结果，且 B 是同步计算 | `A.thenApply(a -> transform(a))` |
| A、B 并行，合并两个结果 | `A.thenCombine(B, (a,b) -> merge(a,b))` |
| A、B 并行，都完成后消费 | `A.thenAcceptBoth(B, (a,b) -> ...)` |
| A、B 并行，都完成后执行动作 | `A.runAfterBoth(B, () -> ...)` |
| A、B 并行，取先完成的 | `A.applyToEither(B, fn)` |
| 等全部完成 | `CompletableFuture.allOf(...)` |
| 任一完成 | `CompletableFuture.anyOf(...)` |
| 多个任务批量并发 | `allOf` + 收集结果（或封装 `allOfList`） |

## 5. 异常处理 ★★★★★

```java
// ─── 1. exceptionally：异常时的降级值（相当于 catch）───
CompletableFuture<String> f = CompletableFuture
        .supplyAsync(() -> {
            if (Math.random() < 0.5) throw new RuntimeException("查询失败");
            return "正常数据";
        }, executor)
        .exceptionally(ex -> {                          // ★ 只在异常时执行
            log.error("降级处理", ex);
            return "默认数据";                            // 返回兜底值，链路继续
        });

// JDK 12+ 可区分「是否已完成」
.exceptionallyCompose(ex -> queryFromBackup())           // 异常时切换到另一个 Future
.exceptionallyAsync(ex -> "默认值", executor)

// ─── 2. handle：无论成功失败都执行，可改变结果（相当于 try-catch-finally + 转换）───
CompletableFuture<Integer> h = CompletableFuture
        .supplyAsync(() -> "hello", executor)
        .handle((result, ex) -> {                       // ★ BiFunction<T, Throwable, U>
            if (ex != null) {
                log.error("失败", ex);
                return -1;                               // 异常时返回默认
            }
            return result.length();                       // 成功时转换
        });

// ─── 3. whenComplete：无论成功失败都执行，★ 不能改变结果 ───
CompletableFuture<String> w = CompletableFuture
        .supplyAsync(() -> "data", executor)
        .whenComplete((result, ex) -> {                 // ★ BiConsumer<T, Throwable>
            if (ex != null) log.error("失败", ex);
            else log.info("成功：{}", result);
            // ★ 这里不能返回新值，也不能「吞掉」异常（异常会继续向下游传播）
        });

// ─── 4. 异常在链中的传播规则 ───
CompletableFuture.supplyAsync(() -> { throw new RuntimeException("boom"); }, executor)
    .thenApply(s -> s + "1")             // ★ 跳过（不执行）
    .thenApply(s -> s + "2")             // ★ 跳过
    .thenAccept(System.out::println)      // ★ 跳过
    .exceptionally(ex -> "recovered");    // ★ 只有这里执行，返回 "recovered"
// 规则：一旦某个阶段异常完成，后续所有「非异常处理」阶段都被跳过，
//      直到遇到 exceptionally / handle 才被「拦截」

// handle 和 whenComplete 不会被跳过（它们总是执行）：
CompletableFuture.supplyAsync(() -> { throw new RuntimeException("boom"); }, executor)
    .whenComplete((r, ex) -> log.info("whenComplete 执行了，ex={}", ex.getMessage()))   // ✅ 执行
    .handle((r, ex) -> "handled")                                                       // ✅ 执行
    .thenAccept(System.out::println);                                                   // 输出 "handled"

// ─── 5. 获取异常信息（阻塞式）───
try {
    String result = future.get();
} catch (ExecutionException e) {
    Throwable real = e.getCause();                // ★ 真实异常在 getCause()
    if (real instanceof BusinessException be) {
        log.warn("业务异常：{}", be.getMsg());
    } else {
        log.error("系统异常", real);
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
} catch (TimeoutException e) {                     // 带超时的 get 才有
    log.error("超时");
}

// join() 抛的是 unchecked 的 CompletionException（不需要 try-catch 受检异常）
try {
    future.join();
} catch (CompletionException e) {
    Throwable real = e.getCause();                 // ★ 同样要 getCause
}

// ─── 6. 异常处理的最佳实践（多层兜底）───
public CompletableFuture<OrderVO> loadOrder(Long id) {
    return CompletableFuture
            .supplyAsync(() -> orderService.get(id), executor)          // 主链路
            .thenApplyAsync(this::enrich, executor)                      // 补充信息
            .orTimeout(2, TimeUnit.SECONDS)                              // ★ 超时保护（JDK 9+）
            .exceptionally(ex -> {
                if (ex.getCause() instanceof TimeoutException) {
                    log.error("订单查询超时, id={}", id);
                    metrics.counter("order.timeout").increment();
                }
                return null;                                              // 降级返回 null
            })
            .thenApply(order -> order == null ? OrderVO.empty(id) : toVO(order));   // 最终兜底
}
```

**三者对比（必背）：**

| 方法 | 执行时机 | 能否改变结果 | 能否吞掉异常 | 参数类型 |
| --- | --- | --- | --- | --- |
| `exceptionally` | **仅异常时** | ✅ 返回降级值 | ✅ 吞掉（返回正常值） | `Function<Throwable,T>` |
| `handle` | **总是** | ✅ 返回新值 | ✅ 可吞掉或重新抛 | `BiFunction<T,Throwable,U>` |
| `whenComplete` | **总是** | ❌ 不能 | ❌ 异常继续传播 | `BiConsumer<T,Throwable>` |

## 6. 超时控制

```java
// ─── JDK 9+ 原生支持（推荐）───
future.orTimeout(3, TimeUnit.SECONDS);
// ★ 超时则以 TimeoutException 异常完成（不取消底层任务！任务仍在跑）
// 返回 this，可链式调用

future.completeOnTimeout("默认值", 3, TimeUnit.SECONDS);
// ★ 超时则以指定值正常完成（优雅降级）
// 返回 this

// 组合用法：超时降级 + 异常兜底
CompletableFuture.supplyAsync(() -> slowQuery(), executor)
    .completeOnTimeout(CACHED_VALUE, 2, TimeUnit.SECONDS)     // 超时用缓存值
    .exceptionally(ex -> DEFAULT_VALUE);                       // 其他异常用默认值

// ─── JDK 8 的实现方式（用 ScheduledExecutorService 模拟）───
public static <T> CompletableFuture<T> withTimeout(CompletableFuture<T> future,
                                                   long timeout, TimeUnit unit,
                                                   ScheduledExecutorService scheduler) {
    CompletableFuture<T> timeoutFuture = new CompletableFuture<>();
    ScheduledFuture<?> scheduled = scheduler.schedule(
            () -> timeoutFuture.completeExceptionally(new TimeoutException("超时")),
            timeout, unit);
    // 谁先完成用谁
    future.whenComplete((result, ex) -> {
        scheduled.cancel(false);                       // ★ 取消定时任务，避免泄漏
        if (ex != null) timeoutFuture.completeExceptionally(ex);
        else timeoutFuture.complete(result);
    });
    return timeoutFuture;
}

// ─── 阻塞式超时（get 带超时，JDK 5 就有）───
future.get(3, TimeUnit.SECONDS);              // ★ 抛 TimeoutException（受检）
future.join();                                 // ❌ 无超时版本，会永久阻塞

// ─── JDK 9+ 的延迟执行 ───
CompletableFuture.supplyAsync(task,
    CompletableFuture.delayedExecutor(5, TimeUnit.SECONDS));    // 延迟 5 秒后开始执行
```

> 【坑】**`orTimeout` 不会取消底层任务**：超时后 CompletableFuture 变成异常完成状态，但**执行任务的线程仍在运行**（继续占用线程池资源）。如果任务本身耗时很长（如慢 SQL），线程池可能被耗尽。
>
> **解决**：
> 1. 底层调用本身设置超时（HTTP 客户端的 readTimeout、JDBC 的 queryTimeout）。
> 2. 用 `future.cancel(true)` 尝试中断（但只有任务响应中断才有效）。
> 3. 对慢任务单独隔离线程池（舱壁模式）。

## 7. 获取结果的方式

```java
CompletableFuture<String> future = ...;

// ─── 阻塞获取 ───
future.get();                          // ★ 阻塞，抛受检异常（InterruptedException、ExecutionException）
future.get(3, TimeUnit.SECONDS);        // 带超时，抛 TimeoutException
future.join();                         // ★ 阻塞，抛 unchecked 的 CompletionException（★ 链式调用中更常用）
future.getNow("默认值");                // ★ 非阻塞：完成则返回结果，未完成返回默认值

// ─── 状态查询 ───
future.isDone();                        // 是否完成（含正常/异常/取消）
future.isCompletedExceptionally();       // 是否异常完成
future.isCancelled();                    // 是否被取消
future.getNumberOfDependents();          // 依赖它的下游任务数
future.resultNow();                      // JDK 19+：已完成则返回，否则抛 IllegalStateException
future.exceptionNow();                   // JDK 19+：异常完成则返回异常

// ─── 完成/取消 ───
future.complete("value");                // 手动正常完成（幂等，已完成则返回 false）
future.completeExceptionally(ex);         // 手动异常完成
future.cancel(true);                      // 取消（mayInterruptIfRunning 参数被忽略，不会真正中断线程）

// ─── 转换 ───
Future<String> plain = future;            // CompletableFuture 实现了 Future
CompletionStage<String> stage = future;    // 也实现了 CompletionStage（只暴露编排 API，隐藏完成能力）
future.toCompletableFuture();              // 返回自己
future.copy();                             // JDK 9+：返回一个新的 CompletableFuture，与原同步完成
future.minimalCompletionStage();            // JDK 9+：返回只读的 CompletionStage
future.thenCompose(CompletionStage::toCompletableFuture);
```

**get vs join：**

| | `get()` | `join()` |
| --- | --- | --- |
| 异常类型 | `ExecutionException`（受检）+ `InterruptedException` | `CompletionException`（**非受检**） |
| 是否需 try-catch | **必须**（受检异常） | 不强制 |
| 超时版本 | ✅ `get(timeout, unit)` | ❌ 无 |
| 适用 | 需要精确控制超时和中断 | 链式调用、Lambda 内部（`thenApply` 中不能用 get） |

```java
// 在 Lambda 内部只能用 join（因为 get 抛受检异常，Lambda 无法处理）
CompletableFuture.allOf(f1, f2).thenApply(v ->
    Stream.of(f1, f2).map(CompletableFuture::join).collect(toList())   // ✅
    // Stream.of(f1, f2).map(f -> f.get()).collect(toList())           // ❌ 编译错误
);
```

## 8. 实战案例 ★★★★★

### 8.1 电商商品详情页聚合（经典并行编排）

```java
/**
 * 商品详情页：需要聚合 6 个服务的数据
 * 串行调用：约 600ms；并行编排：约 150ms（最慢的那个）
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ProductDetailService {

    private final ProductService productService;
    private final StockService stockService;
    private final PriceService priceService;
    private final CommentService commentService;
    private final RecommendService recommendService;
    private final ShopService shopService;

    /** 业务专用线程池（★ 隔离，不用 commonPool） */
    private final Executor detailExecutor;

    public ProductDetailVO getDetail(Long productId, Long userId) {
        long start = System.currentTimeMillis();

        // ① 核心数据（必须成功，失败则整体失败）
        CompletableFuture<ProductDTO> productF = CompletableFuture
                .supplyAsync(() -> productService.getById(productId), detailExecutor);

        // ② 依赖商品数据的后续查询（串行依赖）
        CompletableFuture<ShopDTO> shopF = productF
                .thenApplyAsync(p -> shopService.getById(p.getShopId()), detailExecutor);

        // ③ 非核心数据（失败可降级，不影响主流程）★ 关键设计
        CompletableFuture<Integer> stockF = CompletableFuture
                .supplyAsync(() -> stockService.getStock(productId), detailExecutor)
                .exceptionally(ex -> {
                    log.warn("库存查询失败，降级为 0, productId={}", productId, ex);
                    return 0;
                });

        CompletableFuture<PriceDTO> priceF = CompletableFuture
                .supplyAsync(() -> priceService.getFinalPrice(productId, userId), detailExecutor)
                .exceptionally(ex -> {
                    log.warn("价格计算失败，使用原价, productId={}", productId, ex);
                    return PriceDTO.ofOriginal(productF.join().getOriginalPrice());
                });

        CompletableFuture<CommentSummaryDTO> commentF = CompletableFuture
                .supplyAsync(() -> commentService.summary(productId), detailExecutor)
                .orTimeout(800, TimeUnit.MILLISECONDS)          // ★ 评论服务慢，单独超时
                .exceptionally(ex -> CommentSummaryDTO.empty());

        CompletableFuture<List<ProductDTO>> recommendF = CompletableFuture
                .supplyAsync(() -> recommendService.similar(productId, 8), detailExecutor)
                .orTimeout(1, TimeUnit.SECONDS)                  // ★ 推荐可以慢，超时就放弃
                .exceptionally(ex -> Collections.emptyList());

        // ④ 等待全部完成并组装
        CompletableFuture.allOf(productF, shopF, stockF, priceF, commentF, recommendF)
                .join();                                          // 核心失败会抛 CompletionException

        ProductDetailVO vo = ProductDetailVO.builder()
                .product(productF.join())
                .shop(shopF.join())
                .stock(stockF.join())
                .price(priceF.join())
                .comments(commentF.join())
                .recommends(recommendF.join())
                .build();

        log.info("商品详情聚合完成, productId={}, 耗时={}ms",
                productId, System.currentTimeMillis() - start);
        return vo;
    }
}
```

**这个案例的设计要点：**

| 要点 | 说明 |
| --- | --- |
| **专用线程池** | 不用 commonPool，避免与其他并行任务争抢 |
| **核心 vs 非核心** | 核心数据（商品）失败则整体失败；非核心（评论、推荐）失败降级 |
| **分级超时** | 慢服务单独设置 `orTimeout`，不拖累整体 |
| **串行依赖用 thenCompose/thenApply** | 店铺依赖商品数据 |
| **并行独立任务** | 库存、价格、评论、推荐互不依赖，全部并行 |
| **异常兜底在 Future 内部** | `exceptionally` 紧跟在对应任务后，职责清晰 |

### 8.2 批量任务的并发控制（限流 + 分批）

```java
/**
 * 批量查询：10000 个 ID，限制并发数为 20，分批处理
 * 避免一次性提交 10000 个任务打满线程池 / 压垮下游
 */
public class BatchQueryService {

    private final Executor executor;
    private final Semaphore concurrencyLimiter;          // ★ 信号量限流

    public BatchQueryService(Executor executor, int maxConcurrency) {
        this.executor = executor;
        this.concurrencyLimiter = new Semaphore(maxConcurrency);
    }

    /** 方案 1：Semaphore 限流 */
    public <T, R> List<R> batchQuery(List<T> ids, Function<T, R> queryFn) {
        List<CompletableFuture<R>> futures = ids.stream()
            .map(id -> CompletableFuture.supplyAsync(() -> {
                try {
                    concurrencyLimiter.acquire();          // ★ 限制同时在跑的任务数
                    try {
                        return queryFn.apply(id);
                    } finally {
                        concurrencyLimiter.release();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new CompletionException(e);
                }
            }, executor).exceptionally(ex -> {
                log.error("查询失败: {}", id, ex);
                return null;
            }))
            .collect(Collectors.toList());

        return futures.stream()
                .map(CompletableFuture::join)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /** 方案 2：分批 + allOf（更简单直观）*/
    public <T, R> List<R> batchQueryByPartition(List<T> ids, Function<List<T>, List<R>> batchFn, int batchSize) {
        List<List<T>> partitions = Lists.partition(ids, batchSize);   // Guava 分批
        return partitions.parallelStream()                            // ⚠️ 用 commonPool，慎用
            .map(batchFn)
            .flatMap(List::stream)
            .collect(Collectors.toList());

        // ✅ 更可控的版本
        List<CompletableFuture<List<R>>> futures = partitions.stream()
            .map(batch -> CompletableFuture.supplyAsync(() -> batchFn.apply(batch), executor)
                    .exceptionally(ex -> { log.error("批次失败", ex); return Collections.<R>emptyList(); }))
            .collect(Collectors.toList());

        return futures.stream()
                .map(CompletableFuture::join)
                .flatMap(List::stream)
                .collect(Collectors.toList());
    }

    /** 方案 3：滑动窗口（保持固定并发数，完成一个补一个）*/
    public <T, R> List<R> batchQueryWithWindow(List<T> ids, Function<T, R> queryFn, int windowSize) {
        List<R> results = Collections.synchronizedList(new ArrayList<>());
        Deque<CompletableFuture<R>> window = new ArrayDeque<>(windowSize);

        for (T id : ids) {
            // 窗口满了就等最早的一个完成
            if (window.size() >= windowSize) {
                CompletableFuture<R> oldest = window.pollFirst();
                R r = oldest.join();
                if (r != null) results.add(r);
            }
            window.addLast(CompletableFuture
                    .supplyAsync(() -> queryFn.apply(id), executor)
                    .exceptionally(ex -> { log.error("失败: {}", id, ex); return null; }));
        }
        // 处理窗口中剩余的
        while (!window.isEmpty()) {
            R r = window.pollFirst().join();
            if (r != null) results.add(r);
        }
        return results;
    }
}
```

### 8.3 异步任务的上下文传递

```java
/**
 * CompletableFuture 默认不传递 ThreadLocal/MDC，需要手动装饰
 */
public class ContextAwareExecutor {

    /** 包装 Executor，自动传递 MDC 和自定义上下文 */
    public static Executor wrap(Executor delegate) {
        return command -> {
            // ★ 在「提交任务的线程」中捕获上下文
            Map<String, String> mdc = MDC.getCopyOfContextMap();
            LoginUser user = UserContext.get();
            RequestAttributes attrs = RequestContextHolder.getRequestAttributes();

            delegate.execute(() -> {
                // ★ 在「执行任务的线程」中恢复
                Map<String, String> backup = MDC.getCopyOfContextMap();
                LoginUser backupUser = UserContext.get();
                try {
                    if (mdc != null) MDC.setContextMap(mdc); else MDC.clear();
                    if (user != null) UserContext.set(user);
                    if (attrs != null) RequestContextHolder.setRequestAttributes(attrs);
                    command.run();
                } finally {
                    // ★★ 必须还原（线程池线程会被复用，防止污染）
                    if (backup != null) MDC.setContextMap(backup); else MDC.clear();
                    if (backupUser != null) UserContext.set(backupUser); else UserContext.clear();
                    RequestContextHolder.resetRequestAttributes();
                }
            });
        };
    }
}

// 使用
Executor ctxExecutor = ContextAwareExecutor.wrap(bizExecutor);
MDC.put("traceId", "abc123");
CompletableFuture.supplyAsync(() -> {
    log.info("异步任务");                    // ✅ 日志中有 traceId=abc123
    return UserContext.get();                // ✅ 能拿到登录用户
}, ctxExecutor);

// 或者用阿里 TTL（更完善，见 [[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]）
Executor ttlExecutor = TtlExecutors.getTtlExecutor(bizExecutor);
```

### 8.4 Spring 中的异步编排

```java
// ─── 与 @Async 的关系 ───
// @Async 底层就是返回 CompletableFuture（Spring 4.2+）
@Service
public class AsyncService {

    @Async("bizExecutor")
    public CompletableFuture<UserDTO> getUserAsync(Long id) {
        UserDTO user = userService.getById(id);
        return CompletableFuture.completedFuture(user);        // ★ 必须包成 CompletableFuture
    }

    @Async("bizExecutor")
    public CompletableFuture<List<OrderDTO>> getOrdersAsync(Long userId) {
        return CompletableFuture.completedFuture(orderService.listByUser(userId));
    }
}

// Controller 中编排
@GetMapping("/user-orders")
public CompletableFuture<Result<UserOrderVO>> getUserOrders(@RequestParam Long userId) {
    return asyncService.getUserAsync(userId)
        .thenCombine(asyncService.getOrdersAsync(userId),
                     (user, orders) -> new UserOrderVO(user, orders))
        .thenApply(Result::success)
        .exceptionally(ex -> Result.failed("查询失败"));
}
// ★ Spring MVC 支持 Controller 返回 CompletableFuture（异步 Servlet，释放 Tomcat 线程）

// ─── Spring MVC 的异步返回值 ───
@GetMapping("/deferred")
public DeferredResult<Result<String>> deferred() {              // DeferredResult（Spring 的异步容器）
    DeferredResult<Result<String>> dr = new DeferredResult<>(5000L);   // 超时 5 秒
    dr.onTimeout(() -> dr.setResult(Result.failed("超时")));
    dr.onError(ex -> dr.setResult(Result.failed("异常")));
    CompletableFuture.supplyAsync(() -> slowQuery(), executor)
        .whenComplete((r, ex) -> {
            if (ex != null) dr.setErrorResult(ex);
            else dr.setResult(Result.success(r));
        });
    return dr;                                                   // ★ 立即返回，释放容器线程
}

@GetMapping("/callable")
public Callable<Result<String>> callable() {                     // Callable（Spring 用 SimpleAsyncTaskExecutor）
    return () -> Result.success(slowQuery());
}

@GetMapping("/webasync")
public WebAsyncTask<Result<String>> webAsync() {                 // WebAsyncTask（可指定超时和线程池）
    return new WebAsyncTask<>(3000L, bizExecutor, () -> Result.success(slowQuery()));
}

@GetMapping("/streaming")
public SseEmitter sse() {                                         // SSE 流式推送
    SseEmitter emitter = new SseEmitter(60_000L);
    executor.execute(() -> {
        try {
            for (int i = 0; i < 10; i++) {
                emitter.send(SseEmitter.event().data("消息 " + i));
                Thread.sleep(1000);
            }
            emitter.complete();
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    });
    return emitter;
}

// ─── Spring WebFlux 的响应式（Reactor）对比 ───
// CompletableFuture：一次性的异步结果（0..1 个元素）
// Mono<T>：0..1 个元素的响应式流（可组合、可重试、背压）
// Flux<T>：0..N 个元素
// Spring 6 的 RestClient/WebClient 底层可用 CompletableFuture 或 Reactor
Mono<User> mono = Mono.fromFuture(userFuture);                   // Future → Mono
CompletableFuture<User> future = mono.toFuture();                 // Mono → Future
```

## 9. CompletableFuture 的坑与规范 ★★★★★

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 不指定 Executor | 用 commonPool，阻塞 IO 拖垮全局并行流 | **一律显式传自定义线程池** |
| 2 | `join()` 不 catch | `CompletionException` 冒泡到调用方 | `exceptionally` 或 catch CompletionException |
| 3 | `get()` 未取 `getCause()` | 日志中只有 ExecutionException 包装 | `e.getCause()` 拿真实异常 |
| 4 | `thenApply` 误当异步 | 上一步已完成时在**当前线程**同步执行 | 耗时操作用 `thenApplyAsync(fn, executor)` |
| 5 | 异常被静默吞掉 | 链路中某步失败，无人知晓 | 链尾加 `whenComplete` 记录日志 + 监控埋点 |
| 6 | `orTimeout` 不取消底层任务 | 超时后线程仍在跑，池被耗尽 | 底层调用自带超时（HTTP/JDBC timeout） |
| 7 | 嵌套 Future 未扁平化 | `CompletableFuture<CompletableFuture<T>>` | 用 `thenCompose` 而非 `thenApply` |
| 8 | `allOf` 期望拿到结果 | 返回 `CompletableFuture<Void>` | 完成后从各 future `join()`，或封装 `allOfList` |
| 9 | `anyOf` 类型是 Object | 需要强转 | 统一泛型类型，或用 `applyToEither` |
| 10 | `anyOf` 中最快的失败 | 整体失败（不等其他成功的） | 每个 future 先 `exceptionally` 兜底再 anyOf |
| 11 | 线程池嵌套 + join 等待 | **死锁**（父任务占满线程等子任务） | 拆分线程池，或用 `ManagedBlocker` |
| 12 | ThreadLocal/MDC 不传递 | 日志无 traceId、丢失登录用户 | 包装 Executor 或用 TTL |
| 13 | 长链路无超时 | 某步卡住导致整体永久等待 | `orTimeout` / `completeOnTimeout` |
| 14 | 大量 future 持有大对象 | 内存压力、GC 频繁 | 及时释放引用，分批处理 |
| 15 | 在 Future 内再创建 Future 无限嵌套 | 栈溢出/线程耗尽 | 控制嵌套深度，改用编排 API |
| 16 | `complete()` 后仍期望任务执行 | complete 会「短路」正在跑的任务结果 | 理解 complete 的语义（幂等，先到先得） |
| 17 | `cancel(true)` 期望中断线程 | 实际不会中断（参数被忽略） | CompletableFuture 不支持真中断，需自己实现 |
| 18 | 忘记监控 | 异步任务失败率无感知 | Micrometer 埋点 + 告警 |

```java
// 坑 11 详解：CompletableFuture 的嵌套死锁
ExecutorService pool = Executors.newFixedThreadPool(2);       // 只有 2 个线程
CompletableFuture<Void> parent = CompletableFuture.runAsync(() -> {
    CompletableFuture<Void> child1 = CompletableFuture.runAsync(() -> sleep(1000), pool);
    CompletableFuture<Void> child2 = CompletableFuture.runAsync(() -> sleep(1000), pool);
    child1.join();                                             // ★ 父任务占着 1 个线程等待
    child2.join();
}, pool);
parent.join();
// 2 个线程都被父任务占用（如果有 2 个这样的父任务），子任务在队列中永远没线程执行 → 死锁

// ✅ 解决 1：子任务用独立的线程池
// ✅ 解决 2：不阻塞等待，用编排 API
CompletableFuture<Void> fixed = CompletableFuture
    .runAsync(() -> {}, pool)
    .thenComposeAsync(v -> CompletableFuture.allOf(
            CompletableFuture.runAsync(() -> sleep(1000), pool2),
            CompletableFuture.runAsync(() -> sleep(1000), pool2)), pool);
// ✅ 解决 3：JDK 21 虚拟线程（无线程数量限制，不会死锁）
```

**使用规范总结（生产检查清单）：**

```java
// ✅ 1. 显式指定线程池
CompletableFuture.supplyAsync(task, bizExecutor);

// ✅ 2. 链尾必须有异常处理和日志
.whenComplete((r, ex) -> {
    if (ex != null) log.error("异步任务失败", ex);
})

// ✅ 3. 有超时保护
.orTimeout(3, TimeUnit.SECONDS)
.completeOnTimeout(defaultValue, 3, TimeUnit.SECONDS)

// ✅ 4. 非核心任务单独降级
.exceptionally(ex -> fallbackValue)

// ✅ 5. 上下文传递
用包装后的 Executor 或 TTL

// ✅ 6. 监控埋点
Metrics.timer("async.task", "type", "orderQuery").record(() -> ...);

// ✅ 7. 阻塞获取时用 join + catch CompletionException，或 get(timeout)
// ✅ 8. 独立业务用独立线程池（舱壁隔离）
```

## 10. 与其他异步方案的对比

| 方案 | 抽象层次 | 元素数量 | 背压 | 阻塞 | 适用 |
| --- | --- | --- | --- | --- | --- |
| `Future` | 单次结果 | 0..1 | ❌ | **get 阻塞** | 简单异步任务 |
| **`CompletableFuture`** | 可编排的异步 | 0..1 | ❌ | 可完全非阻塞 | **★ 业务异步编排（主流）** |
| `RxJava Observable` | 响应式流 | 0..N | ✅ | 非阻塞 | Android、复杂事件流 |
| `Reactor Mono/Flux` | 响应式流 | 0..1 / 0..N | ✅ | 非阻塞 | Spring WebFlux、云原生 |
| Kotlin Coroutine | 协程 | 0..1 / 流 | ✅ | **看起来同步** | Kotlin 项目 |
| **JDK 21 虚拟线程** | 轻量线程 | — | — | **同步写法，异步执行** | ★ IO 密集型的新标准 |

```java
// 虚拟线程时代：CompletableFuture 的编排可以用「同步写法」替代
// CompletableFuture 版（回调地狱）
CompletableFuture.supplyAsync(() -> getUser(id), executor)
    .thenComposeAsync(u -> getOrdersAsync(u), executor)
    .thenApplyAsync(this::convert, executor)
    .exceptionally(ex -> fallback);

// 虚拟线程版（★ 同步写法，可读性极高，性能相当）
Thread.startVirtualThread(() -> {
    try {
        User u = getUser(id);            // 阻塞时自动让出载体线程
        List<Order> orders = getOrders(u);
        Result r = convert(orders);
        send(r);
    } catch (Exception e) {
        log.error("失败", e);
        send(fallback);
    }
});

// 结构化并发（JDK 21 预览，JEP 453）：多个子任务的生命周期绑定到父作用域
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<User> userTask = scope.fork(() -> getUser(id));       // 并行
    Subtask<List<Order>> orderTask = scope.fork(() -> getOrders(id));
    scope.join();                                                  // 等待全部
    scope.throwIfFailed();                                         // 任一失败则抛异常
    return new Detail(userTask.get(), orderTask.get());            // 都成功才到这
}   // ★ 作用域结束时保证所有子任务已结束（不会泄漏）
```

> 【趋势】**虚拟线程不会取代 CompletableFuture**，而是提供了另一种选择：
> - **CPU 密集 + 复杂编排 + 需要函数式风格** → CompletableFuture
> - **IO 密集 + 逻辑线性 + 追求可读性** → 虚拟线程 + 同步写法
> - **流式数据 + 背压 + 云原生** → Reactor（WebFlux）
>
> Spring Boot 3.2+ 的 `spring.threads.virtual.enabled=true` 让 Tomcat 每请求一个虚拟线程，**大部分 CompletableFuture 编排可以直接改回同步代码**，这是 Java 并发编程范式的重大简化。

---

## 关联笔记

- 上一篇：[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]
- 相关：[[后端/Java基础/并发编程/线程池原理与实战]]（Executor 的选择与配置）
- 对比：[[后端/Java基础/并发编程/线程基础与生命周期]]（虚拟线程）
- 应用：[[后端/SpringBoot/整合Web开发]]（@Async 与 Controller 异步返回）、[[后端/微服务/OpenFeign服务调用]]（并行调用多个服务）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
