---
title: "事务管理与失效场景"
aliases:
  - "@Transactional"
  - "事务传播行为"
  - "事务失效"
tags:
  - "后端"
  - "java"
  - "spring"
  - "面试"
category: "后端"
folder: "Spring"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Spring/AOP面向切面编程]]"
  - "[[后端/Spring/动态代理-JDK与CGLIB]]"
  - "[[后端/数据库/MySQL/事务与锁机制]]"
  - "[[后端/微服务/Seata分布式事务]]"
created: 2026-09-07
updated: 2026-09-07
---

# 事务管理与失效场景

## 1. 事务基础回顾

### 1.1 ACID 与 Spring 事务的定位

| 特性 | 含义 | 由谁保证 |
| --- | --- | --- |
| **A** 原子性（Atomicity） | 事务内的操作要么全成功要么全失败 | **数据库**（undo log）+ Spring 的提交/回滚控制 |
| **C** 一致性（Consistency） | 事务前后数据处于合法状态 | 业务代码 + 其他三个特性共同保证 |
| **I** 隔离性（Isolation） | 并发事务互不干扰 | **数据库**（锁 + MVCC）+ Spring 设置隔离级别 |
| **D** 持久性（Durability） | 提交后永久保存 | **数据库**（redo log） |

> **Spring 事务的价值不是「实现 ACID」（那是数据库的事），而是：**
> 1. **统一的事务抽象**：屏蔽 JDBC、Hibernate、JPA、MyBatis 的差异（`PlatformTransactionManager`）。
> 2. **声明式事务**：一个 `@Transactional` 注解替代 try-catch-commit-rollback-close 的样板代码。
> 3. **事务边界的自动管理**：方法开始开启、正常结束提交、异常回滚。
> 4. **传播行为控制**：嵌套调用的事务如何处理。
> 5. **与资源绑定**：把 Connection 绑定到当前线程（ThreadLocal），保证同一事务用同一连接。

### 1.2 Spring 事务的两种编程模型

```java
// ─── ① 编程式事务（手动控制，灵活但侵入）───

// 方式 1：TransactionTemplate（★ 推荐，模板方法模式，自动处理提交回滚）
@Service
@RequiredArgsConstructor
public class OrderService {

    private final TransactionTemplate txTemplate;

    public Order create(OrderDTO dto) {
        // 有返回值
        return txTemplate.execute(status -> {
            Order order = saveOrder(dto);
            deductStock(dto);
            if (order.getAmount().compareTo(BigDecimal.ZERO) < 0) {
                status.setRollbackOnly();               // ★ 手动标记回滚
            }
            return order;
        });

        // 无返回值
        // txTemplate.executeWithoutResult(status -> { doSomething(); });
    }

    // 精细控制
    public void fineGrained() {
        txTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        txTemplate.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        txTemplate.setTimeout(30);
        txTemplate.setReadOnly(false);
        txTemplate.execute(status -> { ... });
    }
}

// 方式 2：PlatformTransactionManager（最原始，完全手动）
@Service
public class RawTxService {
    @Autowired private PlatformTransactionManager txManager;

    public void doWork() {
        DefaultTransactionDefinition def = new DefaultTransactionDefinition();
        def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
        def.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        def.setTimeout(30);

        TransactionStatus status = txManager.getTransaction(def);       // ★ 开启事务
        try {
            businessLogic();
            txManager.commit(status);                                    // ★ 提交
        } catch (Exception e) {
            txManager.rollback(status);                                  // ★ 回滚
            throw e;
        }
    }
}

// ─── ② 声明式事务（★ 主流，基于 AOP）───
@Service
public class OrderService {
    @Transactional(rollbackFor = Exception.class)
    public Order create(OrderDTO dto) {
        saveOrder(dto);
        deductStock(dto);
        return order;
    }
}
```

| 对比 | 编程式事务 | **声明式事务** |
| --- | --- | --- |
| 代码侵入 | 高（业务代码混入事务控制） | ★ **低**（一个注解） |
| 控制粒度 | **方法内任意代码块** | 方法级别（整个方法） |
| 灵活性 | ★ 高（可动态决定提交/回滚） | 中（靠配置） |
| 适用 | 只想给部分代码加事务、需要精细控制 | ★ **99% 的场景** |
| 失效风险 | 无（手动控制） | ★ **有 10+ 种失效场景** |

> 【实践】**默认用 `@Transactional`；当「方法中只有一小段需要事务」（如前面是耗时的远程调用，后面才是数据库操作）时用 `TransactionTemplate`**，能显著缩短事务持有时间、减少锁竞争。

## 2. @Transactional 详解 ★★★★★

### 2.1 全部属性

```java
@Transactional(
    // ─── ① 事务管理器（多数据源时必指定）───
    transactionManager = "primaryTxManager",        // 或 value = "xxx"
    // 不指定则用默认的（@Primary 标记的或唯一的 PlatformTransactionManager）

    // ─── ② ★★ 传播行为 ───
    propagation = Propagation.REQUIRED,             // 默认值，见下文详解

    // ─── ③ 隔离级别 ───
    isolation = Isolation.DEFAULT,                  // 默认用数据库的隔离级别

    // ─── ④ 超时时间（秒）───
    timeout = 30,                                    // ★ 超时后自动回滚
    timeoutString = "${tx.timeout:30}",              // Spring 5.3+ 支持占位符

    // ─── ⑤ 是否只读 ───
    readOnly = false,                                // ★ true 时数据库可做优化，且写操作会报错

    // ─── ⑥ ★★ 回滚规则（最重要，坑最多）───
    rollbackFor = {Exception.class},                 // ★ 指定哪些异常回滚（默认只回滚 RuntimeException 和 Error）
    rollbackForClassName = {"com.example.BizException"},
    noRollbackFor = {BusinessException.class},        // ★ 指定哪些异常【不】回滚
    noRollbackForClassName = {"java.io.IOException"}
)
public void doBusiness() { }
```

### 2.2 七种传播行为 ★★★★★（必背）

**传播行为（Propagation）解决的核心问题：一个有事务的方法 A 调用另一个有事务的方法 B 时，B 应该「加入 A 的事务」还是「自己开一个新事务」还是「不用事务」？**

| 传播行为 | 含义 | 外层有事务时 | 外层无事务时 |
| --- | --- | --- | --- |
| **`REQUIRED`**（默认）★ | **需要事务**：有就加入，没有就新建 | ★ **加入**当前事务（同一事务，一起提交/回滚） | 新建事务 |
| **`REQUIRES_NEW`** ★ | **总是新建**：挂起当前事务，开新的独立事务 | ★ **挂起**外层，新建**独立**事务（互不影响） | 新建事务 |
| **`SUPPORTS`** | **支持事务**：有就用，没有就非事务运行 | 加入当前事务 | **非事务**执行 |
| **`NOT_SUPPORTED`** | **不支持事务**：挂起当前事务，非事务运行 | ★ **挂起**外层，非事务执行 | 非事务执行 |
| **`MANDATORY`** | **强制要求**：必须在事务中，否则抛异常 | 加入当前事务 | ★ **抛 `IllegalTransactionStateException`** |
| **`NEVER`** | **绝不允许**：必须在非事务中，否则抛异常 | ★ **抛异常** | 非事务执行 |
| **`NESTED`** | **嵌套事务**：基于 savepoint 的子事务 | ★ 创建**保存点**，子事务回滚不影响父事务 | 等价于 REQUIRED（新建事务） |

```java
// ═══════ 场景演示 ═══════

// ─── ① REQUIRED（默认）：加入同一事务 ───
@Service
public class AService {
    @Autowired private BService bService;

    @Transactional                                    // 默认 REQUIRED
    public void a() {
        insertA();                                    // 操作 1
        bService.b();                                  // ★ 加入 a 的事务
        insertA2();                                    // 操作 2（抛异常）
        throw new RuntimeException();
    }
}
@Service
public class BService {
    @Transactional                                    // REQUIRED → 加入 a 的事务
    public void b() { insertB(); }
}
// 结果：a、b 的操作【全部回滚】（同一个事务，一个失败全失败）

// ─── ② REQUIRES_NEW：独立事务，互不影响 ───
@Service
public class LogService {
    /** ★ 记录操作日志：即使主业务回滚，日志也要保留 */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveLog(String content) {
        logMapper.insert(new SysLog(content));
    }
}

@Service
public class OrderService {
    @Autowired private LogService logService;

    @Transactional
    public void createOrder(OrderDTO dto) {
        orderMapper.insert(order);                     // 操作 1
        logService.saveLog("创建订单：" + order.getId());   // ★ 独立事务，立即提交
        throw new RuntimeException("库存不足");           // 操作 2 失败
    }
}
// 结果：订单【回滚】，但【日志保留】✅
// 原理：调用 saveLog 时，Spring 把当前事务【挂起】（解绑 Connection），
//      为 saveLog 新建一个事务（新的 Connection），提交后恢复原事务

// ─── ③ NESTED：嵌套事务（保存点）───
@Service
public class OrderService {
    @Transactional
    public void createOrder() {
        orderMapper.insert(order);                      // 主事务操作
        try {
            couponService.useCoupon(couponId);            // ★ NESTED 子事务
        } catch (Exception e) {
            log.warn("优惠券使用失败，主流程继续", e);        // ★ 子事务回滚，主事务不受影响
        }
        orderMapper.updateAmount(order);
    }
}
@Service
public class CouponService {
    @Transactional(propagation = Propagation.NESTED)
    public void useCoupon(Long id) {
        couponMapper.update(id);
        throw new RuntimeException("优惠券已过期");
    }
}
// 结果：优惠券操作回滚（到保存点），订单主流程【继续并提交】✅
// 对比 REQUIRES_NEW：
//   NESTED：子事务回滚不影响父，但【父事务回滚会连带子事务一起回滚】（因为是同一连接）
//   REQUIRES_NEW：完全独立，父回滚不影响已提交的子事务

// ─── ④ MANDATORY：强制要求在事务中 ───
@Service
public class StockService {
    /** 扣库存必须在事务中调用，防止误用 */
    @Transactional(propagation = Propagation.MANDATORY)
    public void deduct(Long skuId, int qty) {
        stockMapper.deduct(skuId, qty);
    }
}
// 如果调用方没有事务 → IllegalTransactionStateException:
//   "No existing transaction found for transaction marked with propagation 'mandatory'"
// 用途：防御性编程，明确「这个方法不能被单独调用」

// ─── ⑤ NOT_SUPPORTED：挂起事务（用于耗时的非事务操作）───
@Service
public class ReportService {
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public byte[] generateBigReport() {
        // ★ 耗时 30 秒的报表生成，不需要事务
        // 挂起外层事务 → 释放数据库连接和锁 → 避免长事务
        return doHeavyComputation();
    }
}
// 用途：长耗时的非数据库操作（调外部接口、复杂计算、文件生成），避免占用连接和锁

// ─── ⑥ SUPPORTS / NEVER（较少用）───
@Transactional(propagation = Propagation.SUPPORTS)      // 有事务就用，没有就非事务（查询方法常用）
public User queryUser(Long id) { return userMapper.selectById(id); }

@Transactional(propagation = Propagation.NEVER)         // 有事务就抛异常
public void mustNotInTx() { }
```

**REQUIRED vs REQUIRES_NEW vs NESTED（★ 高频对比）：**

| 对比项 | REQUIRED | REQUIRES_NEW | NESTED |
| --- | --- | --- | --- |
| 连接数 | **1 个**（共用） | **2 个**（各一个） | **1 个**（同一连接 + 保存点） |
| 外层回滚时 | 内层**一起回滚** | 内层已提交，**不受影响** | 内层**一起回滚** |
| 内层回滚时 | **外层也回滚**（异常传播） | 外层可捕获异常继续 | ★ **外层可继续**（只回滚到保存点） |
| 实现机制 | 同一 Connection | 挂起 + 新 Connection | ★ JDBC Savepoint |
| 数据库支持 | 全部 | 全部 | 需要支持 savepoint（MySQL InnoDB ✅） |
| 典型用途 | 默认业务事务 | ★ 日志、审计、独立子业务 | 部分失败可容忍的子操作 |
| 风险 | — | ★ 连接数翻倍（可能耗尽连接池） | 嵌套过深难理解 |

```java
// ─── 内层回滚对外层的影响（★ 经典陷阱）───
// REQUIRED：内层抛异常，即使外层 catch 了，外层仍会回滚！
@Service
public class OuterService {
    @Autowired private InnerService innerService;

    @Transactional
    public void outer() {
        insertOuter();
        try {
            innerService.inner();          // REQUIRED，与 outer 同一事务
        } catch (Exception e) {
            log.warn("捕获了异常，继续执行");   // ★ 以为捕获了就没事？
        }
        insertOuter2();
    }                                        // ★ 提交时抛 UnexpectedRollbackException！
}
@Service
public class InnerService {
    @Transactional                           // REQUIRED
    public void inner() { throw new RuntimeException("内层失败"); }
}
// 结果：UnexpectedRollbackException: Transaction silently rolled back because it has been
//       marked as rollback-only
// 原因：inner 抛异常时，Spring 把【整个事务】标记为 rollback-only（因为是同一个事务）
//      outer 捕获异常继续执行，最后提交时发现 rollback-only 标记 → 强制回滚并抛异常
// ✅ 解决：inner 改用 REQUIRES_NEW 或 NESTED

// REQUIRES_NEW：内层失败不影响外层
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void inner() { throw new RuntimeException("内层失败"); }
// outer 捕获异常后可以正常提交 ✅

// NESTED：内层失败回滚到保存点，外层可继续
@Transactional(propagation = Propagation.NESTED)
public void inner() { throw new RuntimeException("内层失败"); }
// outer 捕获异常后可以正常提交 ✅
```

### 2.3 隔离级别

```java
public enum Isolation {
    DEFAULT(-1),                       // ★ 默认：用数据库的隔离级别（MySQL 是 RR，Oracle 是 RC）
    READ_UNCOMMITTED(1),               // 读未提交：可能脏读、不可重复读、幻读
    READ_COMMITTED(2),                 // ★ 读已提交：避免脏读（Oracle/PostgreSQL 默认）
    REPEATABLE_READ(4),                // ★ 可重复读：避免脏读+不可重复读（MySQL InnoDB 默认）
    SERIALIZABLE(8);                   // 串行化：完全避免并发问题，性能最差
}
```

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 性能 | 数据库默认 |
| --- | --- | --- | --- | --- | --- |
| READ UNCOMMITTED | ❌ 会 | ❌ 会 | ❌ 会 | 最高 | — |
| **READ COMMITTED**（RC） | ✅ 避免 | ❌ 会 | ❌ 会 | 高 | ★ Oracle、PostgreSQL、SQL Server |
| **REPEATABLE READ**（RR） | ✅ 避免 | ✅ 避免 | ⚠️ InnoDB 用间隙锁基本避免 | 中 | ★ **MySQL InnoDB** |
| SERIALIZABLE | ✅ | ✅ | ✅ | 最低 | — |

```java
// 使用
@Transactional(isolation = Isolation.READ_COMMITTED)     // ★ 显式指定（跨数据库时推荐）
public void doWork() { }

// ★ 实践建议：
// 1. 一般用 DEFAULT（跟随数据库），避免应用与数据库配置不一致的困惑
// 2. 跨数据库部署（MySQL + PostgreSQL）时显式指定，保证行为一致
// 3. 高并发读场景可考虑降到 RC（减少间隙锁，提升并发）
//    但要注意 RC 下的不可重复读问题（同一事务内两次查询结果可能不同）
```

> MySQL 的 MVCC、间隙锁、幻读的详细原理见 [[后端/数据库/MySQL/事务与锁机制]]。

### 2.4 readOnly 的意义与坑

```java
@Transactional(readOnly = true)
public User queryUser(Long id) { return userMapper.selectById(id); }
```

**readOnly = true 的作用：**

| 层面 | 效果 |
| --- | --- |
| **数据库** | MySQL 会设置 `SET SESSION TRANSACTION READ ONLY`，InnoDB 可跳过部分加锁、优化 MVCC |
| **Hibernate/JPA** | 跳过脏检查（dirty checking）和 flush，★ 性能提升明显 |
| **MyBatis** | 影响较小（本身无脏检查） |
| **连接路由** | ★ 配合读写分离，`readOnly` 事务可路由到**从库** |
| **保护** | 意外执行写操作时数据库会报错 |

```java
// ★ 读写分离的经典实现（基于 readOnly 路由数据源）
public class ReadOnlyRoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        // TransactionSynchronizationManager 记录了当前事务是否只读
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
                ? "slave" : "master";
    }
}
// 配合 @Transactional(readOnly = true) 自动走从库

// ⚠️ 坑 1：readOnly 事务中执行写操作
@Transactional(readOnly = true)
public void badMethod() {
    userMapper.insert(user);        // MySQL 报错：Connection is read-only
                                     // 或静默失败（取决于驱动版本）
}

// ⚠️ 坑 2：readOnly=true 但方法内调用了 REQUIRED 的写方法
@Transactional(readOnly = true)
public void outer() {
    query();
    innerWriteService.write();       // ★ REQUIRED → 加入 outer 的只读事务 → 写操作失败！
}
// ✅ 解决：innerWrite 用 REQUIRES_NEW，或 outer 不要标 readOnly

// ⚠️ 坑 3：主从延迟导致读不到刚写的数据
@Transactional
public void createAndQuery(User u) {
    userMapper.insert(u);            // 写主库
    return userMapper.selectById(u.getId());   // ★ 同一事务 → 走主库（安全）
}
// 但如果拆成两个方法（第二个是 readOnly）→ 可能走从库 → 主从延迟导致查不到
// ✅ 解决：强一致性读走主库（不加 readOnly，或用 @Master 注解强制主库）
```

> 【规范】**所有纯查询方法都应该加 `@Transactional(readOnly = true)`**：既能让数据库优化，又能在读写分离架构中自动路由到从库，还能防止误写。但要注意主从延迟问题。

## 3. 事务失效的场景 ★★★★★（★ 生产事故重灾区）

### 3.1 完整失效清单

| # | 失效场景 | 原因 | 解决 |
| --- | --- | --- | --- |
| **1** | ★ **自调用（this.method()）** | 绕过代理对象 | 拆类 / 注入 self / AopContext |
| **2** | ★ **方法不是 public** | Spring 事务只拦截 public 方法 | 改为 public |
| **3** | ★ **异常被 catch 吞掉** | 事务切面感知不到异常 | 重新抛出，或 `setRollbackOnly()` |
| **4** | ★ **抛出受检异常但未配 rollbackFor** | 默认只回滚 RuntimeException/Error | `rollbackFor = Exception.class` |
| **5** | **抛出 Error 之外的自定义异常继承 Exception** | 同上 | 继承 RuntimeException 或配 rollbackFor |
| **6** | 类未被 Spring 管理（自己 new） | 没有代理 | 交给容器 |
| **7** | 数据库引擎不支持事务 | MyISAM 不支持事务 | 用 InnoDB |
| **8** | 未开启事务注解支持 | 非 Boot 项目缺 `@EnableTransactionManagement` | 加注解 |
| **9** | 多数据源未指定 transactionManager | 用了错误的（或没有）事务管理器 | `@Transactional("txManager2")` |
| **10** | 方法是 final / static / private | CGLIB 无法代理 | 改为普通 public 实例方法 |
| **11** | `propagation = NOT_SUPPORTED / NEVER` | 明确不使用事务 | 检查传播行为 |
| **12** | 多线程调用 | ★ 事务绑定在 ThreadLocal（连接与线程绑定） | 每个线程独立事务，或用其他方案 |
| **13** | `@Transactional` 与 `@Async` 混用 | 异步在新线程执行，事务上下文丢失 | 见 3.2 详解 |
| **14** | 异常在事务切面之外被处理 | 切面感知不到 | 检查切面顺序（Order） |
| **15** | 使用了错误的 Bean（原型/非代理） | — | 检查作用域 |
| **16** | 事务超时 | timeout 到了自动回滚 | 调大 timeout，优化慢操作 |
| **17** | 内部调用被 `@Transactional` 修饰的 private 方法 | 双重失效 | 改 public + 拆类 |
| **18** | 接口默认方法（default method） | JDK 代理对 default 方法处理特殊 | 避免在接口 default 方法上加事务 |

### 3.2 逐个场景的代码演示

#### 失效 1：自调用（★ 最高频）

```java
@Service
public class OrderService {

    /** 外层方法【没有】事务注解 */
    public void batchCreate(List<OrderDTO> dtos) {
        for (OrderDTO dto : dtos) {
            this.createOrder(dto);          // ❌ this 调用，@Transactional 完全失效
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void createOrder(OrderDTO dto) {
        orderMapper.insert(dto.toEntity());
        stockMapper.deduct(dto.getSkuId(), dto.getQty());
        if (dto.getQty() > 100) {
            throw new RuntimeException("数量超限");   // ★ 不会回滚！insert 已生效
        }
    }
}

// ✅ 解决方案（四种，推荐度递减）
// 方案 1：拆到两个 Bean（★★★ 最佳）
@Service
public class OrderBatchService {
    @Autowired private OrderService orderService;         // 跨 Bean，走代理
    public void batchCreate(List<OrderDTO> dtos) {
        for (OrderDTO dto : dtos) orderService.createOrder(dto);
    }
}

// 方案 2：注入自身代理
@Service
public class OrderService {
    @Autowired @Lazy
    private OrderService self;                            // ★ @Lazy 避免循环依赖报错
    public void batchCreate(List<OrderDTO> dtos) {
        for (OrderDTO dto : dtos) self.createOrder(dto);  // ✅ 通过代理调用
    }
}

// 方案 3：AopContext
// 需 @EnableAspectJAutoProxy(exposeProxy = true)
((OrderService) AopContext.currentProxy()).createOrder(dto);

// 方案 4：编程式事务（不依赖代理）
@Autowired private TransactionTemplate txTemplate;
public void batchCreate(List<OrderDTO> dtos) {
    for (OrderDTO dto : dtos) {
        txTemplate.executeWithoutResult(status -> createOrderInternal(dto));
    }
}
```

#### 失效 2：方法非 public

```java
@Service
public class OrderService {

    @Transactional
    protected void createOrder(OrderDTO dto) { }        // ❌ protected 无效

    @Transactional
    void createOrder2(OrderDTO dto) { }                  // ❌ 包级私有无效

    @Transactional
    private void createOrder3(OrderDTO dto) { }          // ❌ private 无效
}

// 原因：AbstractFallbackTransactionAttributeSource.computeTransactionAttribute()
protected TransactionAttribute computeTransactionAttribute(Method method, Class<?> targetClass) {
    // ★ 第一行就是权限检查
    if (allowPublicMethodsOnly() && !Modifier.isPublic(method.getModifiers())) {
        return null;                                     // 非 public → 返回 null → 不加事务
    }
    ...
}
// DefaultTransactionAttributeSource.allowPublicMethodsOnly() 返回 true

// ✅ 改为 public
@Transactional
public void createOrder(OrderDTO dto) { }
```

#### 失效 3 & 4：异常处理（★ 生产事故最多）

```java
// ─── 失效 3：异常被 catch 吞掉 ───
@Service
public class OrderService {
    @Transactional
    public void createOrder(OrderDTO dto) {
        try {
            orderMapper.insert(order);
            stockMapper.deduct(skuId, qty);
            if (qty > stock) throw new RuntimeException("库存不足");
        } catch (Exception e) {
            log.error("创建订单失败", e);        // ❌★ 异常被吃掉，事务【提交】了！
            // 结果：订单插入成功但库存没扣 → 数据不一致！
        }
    }
}

// ✅ 解决方案 1：catch 后重新抛出（推荐）
try {
    ...
} catch (Exception e) {
    log.error("创建订单失败", e);
    throw new BusinessException("创建订单失败", e);      // ★ 包装后抛出
}

// ✅ 解决方案 2：手动标记回滚
try {
    ...
} catch (Exception e) {
    log.error("创建订单失败", e);
    TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();   // ★ 标记回滚
    return Result.failed("创建失败");                      // 可以正常返回
}

// ✅ 解决方案 3：不 catch，交给全局异常处理器
@Transactional
public void createOrder(OrderDTO dto) {
    orderMapper.insert(order);
    stockMapper.deduct(skuId, qty);      // 抛异常直接冒泡，事务自动回滚
}
// 由 @RestControllerAdvice 统一处理（见 [[后端/Java基础/异常处理]]）

// ─── 失效 4：受检异常不回滚（★ 最隐蔽）───
@Service
public class FileService {
    @Transactional                                  // ❌ 没有 rollbackFor
    public void importData(File file) throws IOException {
        dataMapper.batchInsert(parse(file));
        Files.move(file, archivePath);                // ★ 抛 IOException（受检异常）
    }
}
// 结果：IOException 抛出，但事务【不回滚】！数据已插入
//
// 原因：Spring 的默认回滚规则
// DefaultTransactionAttribute.rollbackOn(Throwable ex)
public boolean rollbackOn(Throwable ex) {
    return (ex instanceof RuntimeException || ex instanceof Error);
    // ★ 只有 RuntimeException 和 Error 才回滚！
    // 受检异常（Checked Exception，如 IOException、SQLException）【不回滚】
}
// 设计理由：EJB 的历史约定 —— 受检异常通常是「业务可预期的失败」（如文件不存在），
//          不应回滚已完成的工作。但这个约定在现代开发中经常引发事故。

// ✅ 解决方案 1：显式指定 rollbackFor（★★★ 强制规约）
@Transactional(rollbackFor = Exception.class)         // ★ 所有异常都回滚
public void importData(File file) throws IOException { }

// ✅ 解决方案 2：全局修改默认回滚规则
@Configuration
public class TxConfig {
    @Bean
    public TransactionAttributeSource transactionAttributeSource() {
        // 自定义 AttributeSource，让所有受检异常也回滚
        return new AnnotationTransactionAttributeSource() {
            @Override
            protected TransactionAttribute determineTransactionAttribute(AnnotatedElement element) {
                TransactionAttribute attr = super.determineTransactionAttribute(element);
                if (attr instanceof DefaultTransactionAttribute dta) {
                    dta.setRollbackRules(List.of(new RollbackRuleAttribute(Exception.class)));
                }
                return attr;
            }
        };
    }
}

// ✅ 解决方案 3：自定义异常继承 RuntimeException（★ 推荐）
public class BusinessException extends RuntimeException { }   // 天然回滚
```

> 【强制】**阿里手册规约：`@Transactional` 必须显式指定 `rollbackFor = Exception.class`**。
> 原因：方法可能抛出受检异常（尤其是调用 IO、第三方 SDK 时），默认规则不回滚会造成数据不一致。
> **正确姿势**：`@Transactional(rollbackFor = Exception.class)` —— 形成肌肉记忆。

#### 失效 12 & 13：多线程与异步（★ 高频坑）

```java
// ─── 失效 12：事务在多线程中失效 ───
@Service
public class BatchService {

    @Transactional
    public void batchProcess(List<Item> items) {
        items.parallelStream().forEach(item -> {       // ❌ 并行流 = 多线程
            itemMapper.insert(item);                    // ★ 子线程中的操作【不在事务内】！
        });
    }

    @Transactional
    public void batchWithThread(List<Item> items) {
        for (Item item : items) {
            new Thread(() -> itemMapper.insert(item)).start();   // ❌ 同样失效
        }
    }
}
// 原因：Spring 事务通过 ThreadLocal 绑定 Connection
//      TransactionSynchronizationManager 内部：
//      private static final ThreadLocal<Map<Object, Object>> resources = new NamedThreadLocal<>();
//      子线程的 ThreadLocal 是空的 → 拿到的是【新的 Connection】（自动提交）→ 不在事务内
//      → 主事务回滚，子线程的插入【已经提交】无法回滚 → 数据不一致！

// ✅ 解决方案
// 方案 1：串行执行（★ 最简单可靠）
@Transactional
public void batchProcess(List<Item> items) {
    items.forEach(item -> itemMapper.insert(item));      // 同一线程，事务生效
    // 或批量插入（性能更好）
    itemMapper.batchInsert(items);                        // ★ 一条 SQL 插入多行
}

// 方案 2：每个子线程独立事务（★ 注意：不是「一个大事务」，各自提交/回滚）
@Transactional
public void batchProcess(List<Item> items) {
    List<CompletableFuture<Void>> futures = items.stream()
        .map(item -> CompletableFuture.runAsync(() -> {
            // ★ 子线程中开启【自己的】事务
            txTemplate.executeWithoutResult(status -> itemMapper.insert(item));
        }, executor))
        .toList();
    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    // ⚠️ 各子事务独立，一个失败不会回滚其他 → 需要业务层补偿
}

// 方案 3：主线程收集结果，统一在一个事务中写入
public void batchProcess(List<Item> items) {
    // ① 并行做【不需要事务】的计算/远程调用
    List<Result> results = items.parallelStream()
        .map(this::computeOrCallRemote)                  // 无数据库操作，可以并行
        .toList();
    // ② 串行做数据库写入（在一个事务中）
    saveAllInOneTransaction(results);
}
@Transactional
protected void saveAllInOneTransaction(List<Result> results) {
    results.forEach(r -> mapper.insert(r));
}

// ─── 失效 13：@Async 与 @Transactional 的四种组合 ───

// 组合 1：@Async + @Transactional 在同一方法（★ 事务生效，但是在【异步线程】中）
@Async
@Transactional(rollbackFor = Exception.class)
public void asyncWithTx() {
    mapper.insert(a);
    mapper.insert(b);
}
// ✅ 事务生效！异步线程中有自己独立的事务
// ⚠️ 但：① 调用方无法感知失败（异常在异步线程）② 与调用方的事务无关

// 组合 2：事务方法中调用 @Async 方法（★ 异步操作不在事务内）
@Transactional
public void outer() {
    mapper.insert(a);
    asyncService.doAsync();          // ★ 新线程执行，不在 outer 的事务内
    throw new RuntimeException();     // outer 回滚，但 doAsync 的写入【已提交】
}
// ⚠️ 数据不一致风险！

// 组合 3：@Async 方法中调用同类的 @Transactional 方法（自调用，双重失效）
@Async
public void asyncMethod() {
    this.txMethod();                  // ❌ 事务失效（自调用）
}

// ✅ 正确做法：事务提交后再触发异步任务
@Transactional
public void createOrder(OrderDTO dto) {
    Order order = save(dto);
    // ★ 用事务事件监听器，保证「事务提交成功后」才执行异步逻辑
    eventPublisher.publishEvent(new OrderCreatedEvent(order.getId()));
}

@Component
public class OrderEventListener {
    @Async("notifyExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)   // ★★ 关键
    public void onOrderCreated(OrderCreatedEvent event) {
        smsService.send(...);          // 事务已提交，发短信安全
        mqProducer.send(...);          // 事务已提交，发消息安全
    }
}
// TransactionPhase 的四个值：
//   BEFORE_COMMIT   提交前（还能回滚）
//   AFTER_COMMIT    ★ 提交后（最常用）
//   AFTER_ROLLBACK  回滚后
//   AFTER_COMPLETION 完成后（无论成功失败）
```

#### 失效 9：多数据源未指定事务管理器

```java
// 场景：主库 + 从库，或业务库 + 日志库
@Configuration
public class DataSourceConfig {

    @Bean
    @Primary                                          // ★ 主数据源
    @ConfigurationProperties("spring.datasource.master")
    public DataSource masterDataSource() { return DataSourceBuilder.create().build(); }

    @Bean
    @ConfigurationProperties("spring.datasource.slave")
    public DataSource slaveDataSource() { return DataSourceBuilder.create().build(); }

    @Bean
    @Primary
    public PlatformTransactionManager masterTxManager(
            @Qualifier("masterDataSource") DataSource ds) {
        return new DataSourceTransactionManager(ds);
    }

    @Bean
    public PlatformTransactionManager slaveTxManager(
            @Qualifier("slaveDataSource") DataSource ds) {
        return new DataSourceTransactionManager(ds);
    }
}

// ❌ 失效：不指定 transactionManager，用了默认的（master），但操作的是 slave 库
@Service
public class LogService {
    @Autowired private LogMapper logMapper;             // 走 slaveDataSource

    @Transactional                                       // ❌ 默认用 masterTxManager
    public void saveLog(SysLog log) {
        logMapper.insert(log);                            // 操作 slave，但事务管的是 master 的连接
    }                                                     // → slave 的操作【不在事务内】（自动提交）
}

// ✅ 显式指定
@Service
public class LogService {
    @Transactional(transactionManager = "slaveTxManager")   // ★ 明确指定
    public void saveLog(SysLog log) { logMapper.insert(log); }
}

// ⚠️ 注意：Spring 【不支持】跨数据源的分布式事务（一个 @Transactional 管两个库）
//   需要分布式事务 → Seata（见 [[后端/微服务/Seata分布式事务]]）
//   或本地消息表 / TCC / 最终一致性方案
```

## 4. Spring 事务的实现原理 ★★★★★

### 4.1 核心组件

```
┌──────────────────────────────────────────────────────────────┐
│  @EnableTransactionManagement                                 │
│    ↓ @Import(TransactionManagementConfigurationSelector)      │
│  注册 InfrastructureAdvisorAutoProxyCreator（★ 自动代理创建器）  │
│  注册 BeanFactoryTransactionAttributeSourceAdvisor（★ 切面）    │
│    ├── Pointcut: TransactionAttributeSourcePointcut           │
│    │            （匹配有 @Transactional 的方法）                 │
│    └── Advice:   TransactionInterceptor（★ 核心拦截器）         │
└──────────────────────────────────────────────────────────────┘

核心接口：
┌────────────────────────────────────────────────────┐
│ PlatformTransactionManager（★ 事务管理器抽象）        │
│   ├── getTransaction()   开启/获取事务                │
│   ├── commit()           提交                        │
│   └── rollback()         回滚                        │
│                                                      │
│ 实现：                                                │
│   DataSourceTransactionManager   ← ★ JDBC/MyBatis    │
│   JpaTransactionManager          ← JPA/Hibernate     │
│   HibernateTransactionManager    ← Hibernate 原生    │
│   JtaTransactionManager          ← 分布式 JTA        │
│   KafkaTransactionManager        ← Kafka 事务        │
└────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────┐
│ TransactionDefinition（事务定义：传播、隔离、超时、只读）│
│ TransactionStatus（事务运行时状态）                    │
│   ├── isNewTransaction()  是否新事务                  │
│   ├── isRollbackOnly()    是否标记回滚                 │
│   ├── setRollbackOnly()   ★ 手动标记回滚               │
│   ├── isCompleted()       是否已完成                  │
│   └── createSavepoint()   ★ 创建保存点（NESTED 用）    │
└────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────┐
│ TransactionSynchronizationManager（★ 线程绑定的资源管理）│
│   resources (ThreadLocal<Map>)   ← 存 Connection 等   │
│   synchronizations (ThreadLocal) ← 事务同步回调         │
│   currentTransactionName/ReadOnly/IsolationLevel      │
│   actualTransactionActive          ← 是否有活跃事务     │
└────────────────────────────────────────────────────┘
```

### 4.2 TransactionInterceptor 的执行流程

```java
// TransactionInterceptor.invoke() → invokeWithinTransaction()
protected Object invokeWithinTransaction(Method method, Class<?> targetClass,
                                         InvocationCallback invocation) throws Throwable {

    TransactionAttributeSource tas = getTransactionAttributeSource();
    // ① ★ 获取事务属性（解析 @Transactional 的配置）
    final TransactionAttribute txAttr = (tas != null ? tas.getTransactionAttribute(method, targetClass) : null);
    // ② ★ 获取事务管理器
    final TransactionManager tm = determineTransactionManager(txAttr);

    // PlatformTransactionManager 的情况
    if (tm instanceof CallbackPreferringPlatformTransactionManager cpptm) {
        // 带回调的事务管理器（如 WebSphere）
        ...
    } else {
        PlatformTransactionManager ptm = (PlatformTransactionManager) tm;

        // ③ ★ 生成事务的「唯一标识」（类名.方法名，用于日志和资源绑定）
        final String joinpointIdentification = methodIdentification(method, targetClass);

        // ④ ★★ 开启事务（根据传播行为决定：新建 / 加入 / 挂起）
        TransactionInfo txInfo = createTransactionIfNecessary(ptm, txAttr, joinpointIdentification);

        Object retVal;
        try {
            // ⑤ ★★ 执行目标方法（业务逻辑）
            retVal = invocation.proceedWithInvocation();

        } catch (Throwable ex) {
            // ⑥ ★★ 异常处理：判断是否回滚
            completeTransactionAfterThrowing(txInfo, ex);
            throw ex;                                     // ★ 异常继续抛出

        } finally {
            // ⑦ 清理事务信息（恢复被挂起的事务）
            cleanupTransactionInfo(txInfo);
        }

        // ⑧ 触发 afterCompletion 回调
        if (txAttr != null && txAttr.isReadOnly()) { ... }

        // ⑨ ★★ 提交事务
        commitTransactionAfterReturning(txInfo);
        return retVal;
    }
}

// ─── 回滚判断逻辑（★ 核心）───
protected void completeTransactionAfterThrowing(TransactionInfo txInfo, Throwable ex) {
    if (txInfo.transactionStatus != null) {
        // ★ 判断该异常是否应该回滚
        if (txInfo.transactionAttribute.rollbackOn(ex)) {
            try {
                txInfo.transactionManager.rollback(txInfo.transactionStatus);   // 回滚
            } catch (TransactionSystemException ex2) {
                logger.error("Application exception overridden by rollback exception", ex);
                ex2.initApplicationException(ex);
                throw ex2;
            }
        } else {
            // ★ 不该回滚 → 照常提交（即使抛了异常！）
            try {
                txInfo.transactionManager.commit(txInfo.transactionStatus);
            } catch (UnexpectedRollbackException ex2) { ... }
        }
    }
}

// ─── rollbackOn 的默认实现（★ 只回滚 RuntimeException 和 Error）───
// DefaultTransactionAttribute
public boolean rollbackOn(Throwable ex) {
    return (ex instanceof RuntimeException || ex instanceof Error);
}
```

### 4.3 Connection 与线程的绑定（★ 为什么事务能生效）

```java
// DataSourceTransactionManager.doBegin()
protected void doBegin(Object transaction, TransactionDefinition definition) {
    DataSourceTransactionObject txObject = (DataSourceTransactionObject) transaction;
    Connection con = null;
    try {
        // ① ★ 从连接池获取 Connection
        if (!txObject.hasConnectionHolder() || txObject.getConnectionHolder().isSynchronizedWithTransaction()) {
            Connection newCon = obtainDataSource().getConnection();
            txObject.setConnectionHolder(new ConnectionHolder(newCon), true);
        }

        con = txObject.getConnectionHolder().getConnection();
        Integer previousIsolationLevel = DataSourceUtils.prepareConnectionForTransaction(con, definition);
        txObject.setPreviousIsolationLevel(previousIsolationLevel);
        con.setReadOnly(definition.isReadOnly());

        // ② ★ 关闭自动提交（这是事务的关键！）
        if (con.getAutoCommit()) {
            txObject.setMustRestoreAutoCommit(true);
            con.setAutoCommit(false);                     // ★★ 手动管理事务
        }

        // ③ ★★ 把 Connection 绑定到当前线程（ThreadLocal）
        if (txObject.isNewConnectionHolder()) {
            TransactionSynchronizationManager.bindResource(obtainDataSource(), txObject.getConnectionHolder());
        }

        // ④ 设置超时
        int timeout = determineTimeout(definition);
        txObject.getConnectionHolder().setTimeoutInSeconds(timeout);

    } catch (Throwable ex) {
        // 失败时释放连接
        ...
    }
}

// ─── MyBatis / JdbcTemplate 如何拿到「同一个 Connection」───
// DataSourceUtils.getConnection(dataSource)
public static Connection doGetConnection(DataSource dataSource) {
    // ★ 先从 ThreadLocal 中查找（当前事务的连接）
    ConnectionHolder conHolder = (ConnectionHolder) TransactionSynchronizationManager.getResource(dataSource);
    if (conHolder != null && (conHolder.hasConnection() || conHolder.isSynchronizedWithTransaction())) {
        return conHolder.getConnection();              // ★ 返回事务绑定的连接！
    }
    // 没有事务 → 从连接池获取新连接
    Connection con = fetchConnection(dataSource);
    ...
    return con;
}
// 这就是「同一个事务内的多次数据库操作用同一个 Connection」的实现原理
// 也是「多线程事务失效」的根本原因：子线程的 ThreadLocal 中没有这个 Connection
```

**事务提交的流程：**

```java
// doCommit
protected void doCommit(DefaultTransactionStatus status) {
    Connection con = status.getTransaction().getConnection();
    con.commit();                                    // ★ JDBC 提交
}
// doRollback
protected void doRollback(DefaultTransactionStatus status) {
    Connection con = status.getTransaction().getConnection();
    con.rollback();                                  // ★ JDBC 回滚
}
// doCleanupAfterCompletion：恢复 autoCommit、隔离级别，释放连接回池，解绑 ThreadLocal
```

## 5. 事务的最佳实践 ★★★★★

```java
// ─── ① 事务边界要小（★ 最重要的原则）───
// ❌ 反面：整个大方法加事务，包含耗时操作
@Transactional
public void process(OrderDTO dto) {
    validate(dto);                              // 复杂校验（100ms）
    User user = userClient.getRemote(dto.getUserId());   // ★ RPC 调用（可能 1s+）
    BigDecimal price = pricingService.calc(dto);          // 复杂计算（200ms）
    orderMapper.insert(order);                             // 数据库操作（10ms）
    stockMapper.deduct(skuId, qty);                        // 数据库操作（10ms）
    mqProducer.send(new OrderEvent(order));                 // ★ MQ 发送（可能 500ms）
    cacheService.refresh(order);                            // Redis 操作
}
// 问题：事务持续 1.8 秒，Connection 被长期占用，行锁持有时间长 → 并发能力骤降、死锁风险高

// ✅ 正面：事务只包住数据库操作
public void process(OrderDTO dto) {
    validate(dto);                                          // 事务外
    User user = userClient.getRemote(dto.getUserId());       // 事务外（RPC）
    BigDecimal price = pricingService.calc(dto);             // 事务外（计算）

    Order order = doInTransaction(dto, price);                // ★ 只有数据库操作在事务内

    mqProducer.send(new OrderEvent(order));                   // 事务外（或用事务事件）
    cacheService.refresh(order);
}

@Transactional(rollbackFor = Exception.class)
protected Order doInTransaction(OrderDTO dto, BigDecimal price) {
    orderMapper.insert(order);
    stockMapper.deduct(dto.getSkuId(), dto.getQty());
    return order;
}
// ⚠️ 注意：protected + 同类调用 → 事务失效！要拆到另一个 Bean 或用 TransactionTemplate

// ✅ 用 TransactionTemplate 更清晰（推荐）
@Service
@RequiredArgsConstructor
public class OrderService {
    private final TransactionTemplate txTemplate;

    public void process(OrderDTO dto) {
        validate(dto);
        User user = userClient.getRemote(dto.getUserId());
        BigDecimal price = pricingService.calc(dto);

        // ★ 事务范围精确到这几行
        Order order = txTemplate.execute(status -> {
            orderMapper.insert(buildOrder(dto, price));
            stockMapper.deduct(dto.getSkuId(), dto.getQty());
            return order;
        });

        // 事务已提交，再做后续（发消息、刷缓存）
        eventPublisher.publishEvent(new OrderCreatedEvent(order.getId()));
    }
}

// ─── ② 事务中不做的事（★ 铁律）───
// ❌ RPC / HTTP 调用（超时不可控，可能几秒到几十秒）
// ❌ MQ 发送（应该用事务消息或事务事件监听器）
// ❌ 文件 IO / 大文件处理
// ❌ 复杂计算 / 大数据量循环
// ❌ Thread.sleep / 等待锁
// ❌ 发送短信/邮件/推送
// ❌ 调用 @Async 方法
// ❌ 大量数据的批量操作（应分批 + 每批一个事务）

// ─── ③ 事务提交后再做副作用操作（★★ 保证一致性）───
@Transactional(rollbackFor = Exception.class)
public void createOrder(OrderDTO dto) {
    Order order = save(dto);
    // ❌ 错误：事务还没提交就发消息 → 消费者查不到订单（或事务回滚了消息已发）
    // mqProducer.send(new OrderCreatedEvent(order.getId()));

    // ✅ 正确：注册事务同步回调
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
        @Override
        public void afterCommit() {                       // ★ 事务提交成功后执行
            mqProducer.send(new OrderCreatedEvent(order.getId()));
            cacheService.evict("order:" + order.getId());
        }
        @Override
        public void afterCompletion(int status) {
            // status: STATUS_COMMITTED / STATUS_ROLLED_BACK / STATUS_UNKNOWN
            if (status == STATUS_ROLLED_BACK) {
                log.warn("订单创建回滚，释放预占资源");
                stockService.release(dto.getSkuId(), dto.getQty());
            }
        }
    });

    // ✅✅ 更优雅：用事务事件监听器（推荐）
    eventPublisher.publishEvent(new OrderCreatedEvent(order.getId()));
}

@Component
public class OrderTxListener {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async("mqExecutor")                                   // ★ 异步执行，不阻塞主流程
    public void onOrderCreated(OrderCreatedEvent event) {
        mqProducer.send(event);
        smsService.notify(event.orderId());
    }
}
// ⚠️ @TransactionalEventListener 默认 fallbackExecution=false：
//    如果发布事件时没有事务，监听器【不会执行】！需要设 fallbackExecution=true

// ─── ④ 大批量数据的分批事务 ───
// ❌ 一个事务插入 100 万条（事务过大：undo log 暴涨、锁持有久、失败全回滚）
@Transactional
public void importAll(List<Data> million) {
    million.forEach(mapper::insert);
}

// ✅ 分批，每批一个独立事务
public void importInBatches(List<Data> million) {
    int batchSize = 1000;
    int success = 0, failed = 0;
    for (List<Data> batch : Lists.partition(million, batchSize)) {
        try {
            txTemplate.executeWithoutResult(status -> mapper.batchInsert(batch));
            success += batch.size();
        } catch (Exception e) {
            failed += batch.size();
            log.error("批次导入失败，已记录到失败表", e);
            failedRecordService.save(batch, e.getMessage());      // ★ 记录失败数据，可重试
        }
    }
    log.info("导入完成：成功 {}，失败 {}", success, failed);
}
// ✅ 更好：用批量 SQL（一条 INSERT 多行 VALUES），性能提升 10 倍以上
mapper.batchInsert(batch);
// INSERT INTO t (a,b) VALUES (1,2),(3,4),(5,6)...

// ─── ⑤ 只读查询加 readOnly ───
@Transactional(readOnly = true)
public List<User> queryUsers(UserQuery query) { return mapper.select(query); }

// ─── ⑥ 设置合理的超时 ───
@Transactional(rollbackFor = Exception.class, timeout = 10)     // ★ 防止事务无限持有锁
public void doWork() { }
// 超时后：TransactionTimedOutException，事务回滚
// 默认 -1（无超时，依赖数据库/连接池的超时）→ ★ 建议显式设置

// ─── ⑦ 全局默认配置（Spring Boot 2.x+）───
// spring.transaction.default-timeout=10s
// spring.transaction.rollback-on-commit-failure=true
```

### 5.1 事务注解的规范模板

```java
/**
 * ★ 推荐的事务注解写法（形成肌肉记忆）
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderMapper orderMapper;
    private final StockMapper stockMapper;
    private final ApplicationEventPublisher publisher;

    /**
     * 写操作：rollbackFor = Exception.class 是【必须】的
     */
    @Override
    @Transactional(rollbackFor = Exception.class)          // ★ 标准写法
    public Long createOrder(OrderCreateDTO dto) {
        // ① 前置校验（无需事务，但放这里也可以）
        checkParams(dto);

        // ② 数据库操作
        Order order = buildOrder(dto);
        orderMapper.insert(order);
        stockMapper.deduct(dto.getSkuId(), dto.getQuantity());

        // ③ 发布领域事件（事务提交后才真正执行副作用）
        publisher.publishEvent(new OrderCreatedEvent(order.getId(), order.getUserId()));

        return order.getId();
    }

    /**
     * 只读查询：readOnly = true
     */
    @Override
    @Transactional(readOnly = true)
    public OrderVO getOrder(Long id) {
        return OrderVO.from(orderMapper.selectById(id));
    }

    /**
     * 需要独立事务的操作（如日志、审计）
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void saveAuditLog(AuditLog log) {
        auditMapper.insert(log);
    }
}
```

## 6. 分布式事务简介

**单体应用的 `@Transactional` 只能管理「一个数据源」的事务。跨服务/跨库时需要分布式事务方案。**

| 方案 | 一致性 | 性能 | 复杂度 | 适用 |
| --- | --- | --- | --- | --- |
| **2PC/XA**（JTA） | 强一致 | ★ 差（同步阻塞） | 中 | 传统企业应用（少用） |
| **Seata AT 模式** | 最终一致（接近强一致） | 中 | ★ **低**（一个注解） | ★ **主流选择** |
| **Seata TCC 模式** | 强一致 | 较好 | 高（要写 Try/Confirm/Cancel） | 金融、高性能要求 |
| **本地消息表** | 最终一致 | ★ **好** | 中 | ★ **简单可靠，推荐** |
| **MQ 事务消息**（RocketMQ） | 最终一致 | ★ **好** | 中 | 异步解耦场景 |
| **Saga** | 最终一致 | 好 | 高（要写补偿） | 长事务、跨多服务 |
| **最大努力通知** | 弱一致 | 最好 | 低 | 对账、通知类 |

```java
// ─── 本地消息表方案（★ 最实用，无中间件依赖）───
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderMapper orderMapper;
    private final LocalMessageMapper messageMapper;
    private final MqProducer mqProducer;

    /** ① 业务操作 + 消息落库在【同一个本地事务】中 */
    @Transactional(rollbackFor = Exception.class)
    public void createOrder(OrderDTO dto) {
        Order order = saveOrder(dto);
        // ★ 消息先存到本地表（与业务同一事务，保证原子性）
        LocalMessage msg = LocalMessage.builder()
                .messageId(UUID.randomUUID().toString())
                .topic("order-created")
                .payload(JSON.toJSONString(new OrderCreatedEvent(order.getId())))
                .status(MessageStatus.PENDING)
                .retryCount(0)
                .maxRetry(5)
                .nextRetryTime(LocalDateTime.now())
                .build();
        messageMapper.insert(msg);
    }

    /** ② 定时任务扫描未发送的消息并投递 */
    @Scheduled(fixedDelay = 5000)
    public void sendPendingMessages() {
        List<LocalMessage> pending = messageMapper.selectPending(100);
        for (LocalMessage msg : pending) {
            try {
                mqProducer.send(msg.getTopic(), msg.getPayload(), msg.getMessageId());
                messageMapper.updateStatus(msg.getId(), MessageStatus.SENT);
            } catch (Exception e) {
                // 失败则增加重试次数，延迟下次重试
                messageMapper.incrementRetry(msg.getId(), calcNextRetryTime(msg.getRetryCount()));
                if (msg.getRetryCount() >= msg.getMaxRetry()) {
                    messageMapper.updateStatus(msg.getId(), MessageStatus.FAILED);
                    alertService.send("消息投递失败超过最大重试：" + msg.getMessageId());
                }
            }
        }
    }
}
// 消费端必须【幂等】（用 messageId 去重），因为可能重复投递
// 详见 [[后端/消息队列/消息可靠性与常见问题]]

// ─── Seata AT 模式（一个注解搞定）───
@GlobalTransactional(rollbackFor = Exception.class, timeoutMills = 60000, name = "create-order")
public void createOrder(OrderDTO dto) {
    orderService.create(dto);            // 服务 A：本地事务
    stockService.deduct(dto.getSkuId(), dto.getQty());    // 服务 B：远程调用
    accountService.deduct(dto.getUserId(), dto.getAmount());  // 服务 C：远程调用
}
// 任一失败 → Seata 通过 undo_log 回滚所有分支事务
// 详见 [[后端/微服务/Seata分布式事务]]
```

## 7. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | ★ 自调用（this.method） | 事务完全不生效 | 拆类 / 注入 self / AopContext / TransactionTemplate |
| 2 | ★ 方法非 public | 事务不生效 | 改为 public |
| 3 | ★ catch 吞掉异常 | 数据不一致（部分提交） | 重新抛出，或 `setRollbackOnly()` |
| 4 | ★ 受检异常不回滚 | 数据不一致 | **`rollbackFor = Exception.class`** |
| 5 | 多线程/并行流 | 子线程操作不在事务内 | 串行；或每线程独立事务 + 业务补偿 |
| 6 | `@Async` + 事务 | 异步操作脱离事务 | `@TransactionalEventListener(AFTER_COMMIT)` |
| 7 | 多数据源未指定 txManager | 事务管错了库 | `@Transactional("slaveTxManager")` |
| 8 | MyISAM 引擎 | 事务无效 | 改用 InnoDB |
| 9 | 未加 `@EnableTransactionManagement` | 注解不生效（非 Boot 项目） | 加注解 |
| 10 | 事务内做 RPC/MQ/文件 IO | 长事务、连接耗尽、锁等待 | ★ 事务外做，或用事务事件 |
| 11 | 事务未提交就发消息 | 消费者查不到数据 | `AFTER_COMMIT` 事件 / 本地消息表 |
| 12 | 事务回滚了但消息已发 | 数据不一致 | 本地消息表 / RocketMQ 事务消息 |
| 13 | `readOnly=true` 中执行写 | 报错或静默失败 | 写操作不加 readOnly |
| 14 | readOnly 方法调用写方法（REQUIRED） | 写操作失败 | 写方法用 REQUIRES_NEW |
| 15 | 未设 timeout | 慢查询导致长事务、锁等待 | `timeout = 10` |
| 16 | 批量数据一个事务 | undo log 暴涨、锁范围大 | 分批 + 每批独立事务 |
| 17 | 内层 REQUIRED 抛异常被外层 catch | `UnexpectedRollbackException` | 内层用 REQUIRES_NEW / NESTED |
| 18 | REQUIRES_NEW 过多 | 连接池耗尽（一个请求占多个连接） | 评估必要性，控制嵌套深度 |
| 19 | 事务方法返回 null 期望回滚 | 不回滚（无异常） | 抛异常，或 `setRollbackOnly()` |
| 20 | 事务中调用 `System.exit` 或 kill -9 | 数据部分提交 | 避免；用优雅停机 |
| 21 | `@Transactional` 加在接口上（JDK 代理可行，CGLIB 不行） | CGLIB 下不生效 | ★ **加在实现类的方法上** |
| 22 | 事务与缓存的时序 | 缓存更新了但事务回滚 | 缓存操作放 `AFTER_COMMIT` |
| 23 | 嵌套事务用 NESTED 但数据库不支持 savepoint | 报错 | 检查数据库支持；或改 REQUIRES_NEW |
| 24 | 事务传播行为理解错误 | 回滚范围不符预期 | 对照 7 种传播行为表复核 |
| 25 | 依赖注入的 Bean 是原始对象（非代理） | 事务失效 | 检查是否被 BFPP 提前实例化 |

---

## 关联笔记

- 上一篇：[[后端/Spring/动态代理-JDK与CGLIB]]
- 下一篇：[[后端/Spring/SpringMVC入门与执行流程]]
- 原理：[[后端/Spring/AOP面向切面编程]]（事务是 AOP 的应用）、[[后端/Spring/Bean生命周期与作用域]]
- 数据库：[[后端/数据库/MySQL/事务与锁机制]]（ACID、隔离级别、MVCC、锁）
- 分布式：[[后端/微服务/Seata分布式事务]]、[[后端/消息队列/消息可靠性与常见问题]]（本地消息表、事务消息）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
