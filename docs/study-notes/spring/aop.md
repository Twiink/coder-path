---
title: "AOP面向切面编程"
aliases:
  - "Spring AOP"
  - "切面 切点 通知"
  - "AspectJ"
tags:
  - "后端"
  - "java"
  - "spring"
  - "面试"
category: "后端"
folder: "Spring"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Spring/动态代理-JDK与CGLIB]]"
  - "[[后端/Spring/事务管理与失效场景]]"
  - "[[后端/Spring/Bean生命周期与作用域]]"
  - "[[后端/Java基础/反射与动态代理]]"
created: 2026-09-07
updated: 2026-09-07
---

# AOP 面向切面编程

## 1. AOP 是什么

**AOP（Aspect-Oriented Programming，面向切面编程）：把散落在各处的「横切关注点」抽取为独立的切面，通过声明式配置织入到目标方法中，实现业务逻辑与通用逻辑的解耦。**

### 1.1 横切关注点问题

```java
// ─── 没有 AOP：每个方法都要写一遍通用逻辑 ───
@Service
public class OrderService {
    public Order createOrder(OrderDTO dto) {
        long start = System.currentTimeMillis();                    // ① 日志
        log.info("创建订单开始, 参数={}", dto);                        // ① 日志
        checkPermission("order:create");                             // ② 权限
        TransactionStatus tx = txManager.getTransaction(def);        // ③ 事务
        try {
            Order order = doCreate(dto);                              // ★ 真正的业务（1 行）
            txManager.commit(tx);                                    // ③ 事务
            cache.put(order.getId(), order);                          // ④ 缓存
            publisher.publishEvent(new OrderCreatedEvent(order));      // ⑤ 事件
            return order;
        } catch (Exception e) {
            txManager.rollback(tx);                                   // ③ 事务
            log.error("创建订单失败", e);                              // ① 日志
            throw e;
        } finally {
            log.info("创建订单结束, 耗时={}ms", System.currentTimeMillis() - start);   // ① 日志
            metrics.record("order.create", System.currentTimeMillis() - start);       // ⑥ 监控
        }
    }
    // ★ 100 个方法就要写 100 遍这些重复代码！
}

// ─── 有 AOP：业务代码只剩核心逻辑 ───
@Service
public class OrderService {
    @Transactional(rollbackFor = Exception.class)      // ③ 事务
    @RequiresPermission("order:create")                 // ② 权限
    @Cacheable("order")                                 // ④ 缓存
    @LogExecutionTime                                   // ①⑥ 日志+监控
    public Order createOrder(OrderDTO dto) {
        Order order = doCreate(dto);                     // ★ 只写业务
        publisher.publishEvent(new OrderCreatedEvent(order));
        return order;
    }
}
// 通用逻辑全部抽到「切面」中，声明式织入
```

**横切关注点（Cross-Cutting Concern）的典型例子：**

| 关注点 | 说明 | Spring 的实现 |
| --- | --- | --- |
| **日志记录** | 方法入参、返回值、耗时 | 自定义切面 |
| **事务管理** | 开启/提交/回滚事务 | ★ `@Transactional` |
| **权限校验** | 认证、授权 | ★ Spring Security、自定义注解 |
| **性能监控** | 耗时统计、慢方法告警 | Micrometer + 切面 |
| **缓存** | 结果缓存、缓存失效 | ★ `@Cacheable`/`@CacheEvict` |
| **参数校验** | 入参合法性 | `@Validated` + MethodValidationInterceptor |
| **异常处理** | 统一异常转换 | `@ControllerAdvice`（不完全是 AOP） |
| **重试** | 失败自动重试 | Spring Retry `@Retryable` |
| **限流熔断** | 流量控制 | ★ Sentinel `@SentinelResource` |
| **幂等控制** | 防重复提交 | 自定义注解 + Redis |
| **数据脱敏** | 敏感字段打码 | 序列化时处理 |
| **多租户** | 自动加 tenant_id | MyBatis-Plus 插件 |
| **异步执行** | 方法异步化 | ★ `@Async` |
| **分布式锁** | 方法级加锁 | Redisson `@Lock` |
| **数据权限** | 自动加数据过滤条件 | 自定义切面 |
| **国际化** | 消息本地化 | `MessageSource` |

### 1.2 AOP 的核心术语 ★★★★★（必背）

| 术语 | 英文 | 含义 | 类比 |
| --- | --- | --- | --- |
| **切面** | **Aspect** | 横切关注点的模块化实现（**通知 + 切点的组合**） | 一个「功能模块」类 |
| **连接点** | **Join Point** | 程序执行中可以被拦截的点（Spring AOP 中**只有方法执行**） | 所有可能被增强的方法 |
| **切点** | **Pointcut** | ★ 用表达式筛选出真正要拦截的连接点 | 「哪些方法」的规则 |
| **通知** | **Advice** | ★ 在切点上执行的动作（前置/后置/环绕...） | 「做什么」的代码 |
| **目标对象** | **Target** | 被代理的原始对象 | 你的 Service 实现类 |
| **代理** | **Proxy** | 织入通知后生成的对象 | CGLIB/JDK 生成的子类或接口实现 |
| **织入** | **Weaving** | 把切面应用到目标对象生成代理的过程 | 「组装」动作 |
| **引入** | **Introduction** | 为类动态添加新方法/接口 | `@DeclareParents` |

```
图示关系：

    Aspect（切面）= Pointcut（在哪切） + Advice（切了做什么）
        │
        │  Weaving（织入）
        ▼
    Target（目标对象：OrderServiceImpl）
        │
        ▼
    Proxy（代理对象：OrderServiceImpl$$EnhancerBySpringCGLIB$$xxx）

    Join Point（连接点）：所有方法执行点
        createOrder()、queryOrder()、cancelOrder()... 全部方法
    Pointcut（切点）：筛选条件
        "execution(* com.example.service..*.*(..))" → 只匹配 service 包下的方法
    Advice（通知）：@Before、@After、@Around...
```

### 1.3 AOP 与 OOP 的关系

| | OOP | AOP |
| --- | --- | --- |
| 关注方向 | **纵向**（继承层次：Animal → Dog） | **横向**（跨类的通用逻辑） |
| 抽象单位 | 类、对象 | 切面 |
| 复用方式 | 继承、组合、多态 | 织入 |
| 解决问题 | 业务领域的建模 | 通用逻辑的解耦 |
| 关系 | **互补**，不是替代 | 依赖 OOP（切面作用于类的方法） |

## 2. Spring AOP 的两种实现与 AspectJ ★★★★★

### 2.1 Spring AOP vs AspectJ

| 对比项 | **Spring AOP** | **AspectJ** |
| --- | --- | --- |
| 实现方式 | ★ **动态代理**（运行时生成代理对象） | ★ **字节码织入**（编译期/加载期修改字节码） |
| 织入时机 | **运行时** | **编译期**（ajc 编译器）、**编译后**（weaver）、**类加载期**（LTW） |
| 拦截粒度 | ★ **只能拦截方法**（public 方法） | 方法、**字段、构造器**、静态初始化块 |
| 自调用（this.method()） | ❌ **失效** | ✅ **有效**（字节码已被修改） |
| private/final/static 方法 | ❌ 不能拦截 | ✅ 能拦截 |
| 性能 | 有代理调用开销（约 5~10%） | ★ **几乎无开销**（就是普通方法调用） |
| 复杂度 | ★ **简单**（只需 spring-aop） | 复杂（需要 ajc 编译器或 LTW agent） |
| 依赖 | Spring 内置 | 需要 aspectjweaver.jar |
| 使用方式 | 注解（借用 AspectJ 的注解语法） | 注解 + **.aj 文件**（AspectJ 原生语法） |
| 适用 | ★ **99% 的企业应用** | 需要拦截字段/构造器、极致性能、自调用场景 |

> 【关键理解】**Spring AOP 借用了 AspectJ 的「注解和切点表达式语法」，但底层实现是自己的动态代理。**
> 所以你在 Spring 中写的 `@Aspect`、`@Pointcut`、`execution(...)` 都是 AspectJ 的语法，但织入方式是 Spring 的动态代理，因此有「只能拦截方法」「自调用失效」等限制。
>
> Spring 也支持真正的 AspectJ 织入（`spring-aspects` 模块 + LTW/CTW），用于需要拦截字段或解决自调用的场景，但配置复杂，很少用。

### 2.2 Spring AOP 的代理方式

见 [[后端/Spring/动态代理-JDK与CGLIB]]，这里只列结论：

| 条件 | 使用的代理 |
| --- | --- |
| 目标类**实现了接口** + Spring 4.x 及以前默认 | **JDK 动态代理** |
| 目标类**没有接口** | **CGLIB** |
| `proxyTargetClass=true`（★ Spring Boot 2.x+ 默认） | **强制 CGLIB** |
| `@Configuration` 类 | **CGLIB**（保证 @Bean 方法的单例语义） |

```java
// 配置代理方式
@EnableAspectJAutoProxy(proxyTargetClass = true)     // ★ true = 强制 CGLIB；false = 有接口用 JDK
// application.yml（Spring Boot）
spring:
  aop:
    auto: true                    # 自动代理（默认 true）
    proxy-target-class: true      # ★ Spring Boot 2.x+ 默认 true（全用 CGLIB）
```

## 3. 五种通知类型 ★★★★★

```java
import org.aspectj.lang.annotation.*;

@Aspect                                        // ★ 标记为切面
@Component                                     // ★ 必须也是 Spring Bean（否则不生效）
@Slf4j
public class MethodLogAspect {

    /**
     * ① 前置通知：目标方法执行【前】
     * 不能阻止方法执行（除非抛异常）
     */
    @Before("execution(* com.example.service..*.*(..))")
    public void before(JoinPoint joinPoint) {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();
        log.info("[前置] {}.{}({})", className, methodName, Arrays.toString(args));
    }

    /**
     * ② 返回通知：目标方法【正常返回】后（抛异常不执行）
     * returning 指定接收返回值的参数名（必须与形参名一致）
     */
    @AfterReturning(
        pointcut = "execution(* com.example.service..*.*(..))",
        returning = "result"                              // ★ 返回值绑定到 result 参数
    )
    public void afterReturning(JoinPoint joinPoint, Object result) {
        log.info("[返回] {}.{} 返回：{}",
                joinPoint.getSignature().getName(),
                joinPoint.getTarget().getClass().getSimpleName(),
                result);
        // ★ 可以修改 result 的内容（若是可变对象），但【不能改变返回值本身】
        //   要改返回值必须用 @Around
    }

    /**
     * ③ 异常通知：目标方法【抛异常】后
     * throwing 指定接收异常的参数名
     */
    @AfterThrowing(
        pointcut = "execution(* com.example.service..*.*(..))",
        throwing = "ex"                                    // ★ 异常绑定到 ex 参数
    )
    public void afterThrowing(JoinPoint joinPoint, Throwable ex) {
        log.error("[异常] {}.{} 抛出：{}",
                joinPoint.getTarget().getClass().getSimpleName(),
                joinPoint.getSignature().getName(),
                ex.getMessage(), ex);
        // 可以按异常类型过滤（见下文 args/annotation 示例）
    }

    /**
     * ④ 后置通知（最终通知）：无论成功失败都执行（类似 finally）
     * ★ 拿不到返回值和异常
     */
    @After("execution(* com.example.service..*.*(..))")
    public void after(JoinPoint joinPoint) {
        log.info("[后置] {}.{} 执行完毕",
                joinPoint.getTarget().getClass().getSimpleName(),
                joinPoint.getSignature().getName());
    }

    /**
     * ⑤ ★★ 环绕通知：最强大，完全控制方法的执行
     * 必须返回 Object，第一个参数必须是 ProceedingJoinPoint
     */
    @Around("execution(* com.example.service..*.*(..))")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        String methodName = pjp.getSignature().getName();
        long start = System.nanoTime();

        // ─── 前置逻辑 ───
        log.info("[环绕-前] {} 开始，参数={}", methodName, Arrays.toString(pjp.getArgs()));
        // ★ 可以修改入参
        Object[] args = pjp.getArgs();
        for (int i = 0; i < args.length; i++) {
            if (args[i] instanceof String s) {
                args[i] = s.trim();                        // 例：自动 trim 所有字符串参数
            }
        }

        try {
            // ─── ★★ 执行目标方法（不调用则方法不执行！）───
            Object result = pjp.proceed(args);              // ★ 传入修改后的参数

            // ─── 返回后逻辑 ───
            log.info("[环绕-后] {} 成功，耗时={}μs", methodName, (System.nanoTime() - start) / 1000);
            // ★ 可以修改返回值
            return postProcess(result);

        } catch (Throwable e) {
            // ─── 异常处理 ───
            log.error("[环绕-异常] {} 失败，耗时={}μs", methodName, (System.nanoTime() - start) / 1000, e);
            throw e;                                        // ★★ 必须重新抛出！否则异常被吞，事务不回滚
            // 或返回降级值：return fallbackValue();

        } finally {
            // ─── 最终逻辑 ───
            Metrics.timer("method.duration", "method", methodName)
                   .record(System.nanoTime() - start, TimeUnit.NANOSECONDS);
        }
    }

    private Object postProcess(Object result) { return result; }
}
```

### 3.1 五种通知对比

| 通知类型 | 注解 | 执行时机 | 能拿到返回值 | 能拿到异常 | 能阻止执行 | 能改返回值 | 参数类型 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **前置** | `@Before` | 方法执行前 | ❌ | ❌ | ✅（抛异常） | ❌ | `JoinPoint` |
| **返回** | `@AfterReturning` | ★ **正常返回后** | ✅ | ❌ | ❌ | ⚠️ 只能改内容 | `JoinPoint` + returning |
| **异常** | `@AfterThrowing` | ★ **抛异常后** | ❌ | ✅ | ❌ | ❌ | `JoinPoint` + throwing |
| **后置** | `@After` | **无论成功失败**（finally） | ❌ | ❌ | ❌ | ❌ | `JoinPoint` |
| **环绕** | `@Around` | ★ **包裹整个方法** | ✅ | ✅ | ★ ✅（不 proceed） | ✅ **完全控制** | `ProceedingJoinPoint` |

**`JoinPoint` vs `ProceedingJoinPoint`：**

```java
// JoinPoint：连接点信息（只读）
public interface JoinPoint {
    Object getTarget();                    // ★ 目标对象（原始对象，不是代理）
    Object getThis();                      // ★ 代理对象
    Object[] getArgs();                     // ★ 方法参数
    Signature getSignature();               // ★ 方法签名
    Object proceed() throws Throwable;       // （ProceedingJoinPoint 才有）
    String toShortString(); String toLongString();
    Kind getKind();                          // METHOD / CONSTRUCTOR / ...
    StaticPart getStaticPart();
}

// Signature 的常用方法
Signature sig = joinPoint.getSignature();
sig.getName();                              // 方法名
sig.getDeclaringType();                     // 声明该方法的类
sig.getDeclaringTypeName();                 // 类名
sig.getModifiers();                          // 修饰符
// ★ 强转为 MethodSignature 可获取 Method 对象（读注解必需！）
MethodSignature ms = (MethodSignature) joinPoint.getSignature();
Method method = ms.getMethod();              // ★ java.lang.reflect.Method
Class<?> returnType = ms.getReturnType();
Class<?>[] paramTypes = ms.getParameterTypes();
String[] paramNames = ms.getParameterNames();   // ★ 参数名（需 -parameters 编译）
// 读取方法上的注解
LogExecutionTime anno = method.getAnnotation(LogExecutionTime.class);
boolean hasTx = method.isAnnotationPresent(Transactional.class);
// 读取类上的注解
Class<?> targetClass = joinPoint.getTarget().getClass();
Annotation classAnno = targetClass.getAnnotation(Service.class);
// ★ 推荐用 Spring 的工具（能处理代理、继承、桥接方法）
Method specificMethod = AopUtils.getMostSpecificMethod(method, targetClass);
LogExecutionTime anno2 = AnnotatedElementUtils.findMergedAnnotation(specificMethod, LogExecutionTime.class);

// ProceedingJoinPoint：继承 JoinPoint，多了 proceed()
public interface ProceedingJoinPoint extends JoinPoint {
    Object proceed() throws Throwable;                    // ★ 执行目标方法
    Object proceed(Object[] args) throws Throwable;        // ★ 用修改后的参数执行
}
```

### 3.2 通知的执行顺序 ★★★★★（易错，Spring 5.2.7 前后不同）

```java
// ─── Spring 5.2.7+（★ 当前版本，Spring Boot 2.3+/3.x）───
// 正常执行：
@Around 前置部分
  ↓
@Before
  ↓
目标方法执行
  ↓
@AfterReturning
  ↓
@After
  ↓
@Around 后置部分

// 抛异常：
@Around 前置部分
  ↓
@Before
  ↓
目标方法抛异常
  ↓
@AfterThrowing
  ↓
@After
  ↓
@Around 的 catch 块（若捕获）

// ─── Spring 5.2.7 之前（老版本，面试可能问）───
// 正常：@Around前 → @Before → 方法 → @Around后 → @After → @AfterReturning
// 异常：@Around前 → @Before → 方法 → @After → @AfterThrowing

// ★ 变化原因：老版本的顺序不直观（@After 在 @AfterReturning 之前），
//   新版改为「先具体后通用」，更符合直觉（与 try-catch-finally 语义一致）
```

**记忆口诀（Spring 5.2.7+）：**

```
环绕前 → 前置 → 【目标方法】→ 返回/异常 → 后置 → 环绕后

正常：Around前 → Before → 方法 → AfterReturning → After → Around后
异常：Around前 → Before → 方法(抛) → AfterThrowing → After → Around的catch
```

```java
// ─── 多个切面的执行顺序（由 @Order 控制）───
@Aspect @Component @Order(1)                 // ★ 数字越小，优先级越高（越外层）
public class SecurityAspect { }

@Aspect @Component @Order(2)
public class TransactionAspect { }

@Aspect @Component @Order(3)
public class LogAspect { }

// 执行顺序（洋葱模型）：
// SecurityAspect.@Around 前
//   TransactionAspect.@Around 前
//     LogAspect.@Around 前
//       SecurityAspect.@Before
//         TransactionAspect.@Before
//           LogAspect.@Before
//             ★ 目标方法
//           LogAspect.@AfterReturning/@After
//         TransactionAspect.@AfterReturning/@After
//       SecurityAspect.@AfterReturning/@After
//     LogAspect.@Around 后
//   TransactionAspect.@Around 后
// SecurityAspect.@Around 后

// ★ 重要：@Transactional 的默认 Order 是 Ordered.LOWEST_PRECEDENCE（Integer.MAX_VALUE）
//   所以自定义的鉴权/日志切面（Order 较小）会在事务【外层】执行
//   这意味着：@AfterReturning 中事务已提交；@Before 中事务还未开始
//   如果需要在事务提交后发消息，用 @TransactionalEventListener(AFTER_COMMIT)
```

```
洋葱模型图示：
┌─────────────────────────────────────────┐
│ Aspect A (@Order 1)                     │
│  ┌───────────────────────────────────┐  │
│  │ Aspect B (@Order 2)               │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ Aspect C (@Order 3)         │  │  │
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │   ★ 目标方法           │  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
先进后出：A前 → B前 → C前 → 方法 → C后 → B后 → A后
```

## 4. 切点表达式（Pointcut Expression）★★★★★

### 4.1 execution 表达式（★ 最常用）

```
execution(修饰符? 返回类型 包名.类名.方法名(参数) throws 异常?)
           ↓        ↓        ↓        ↓      ↓      ↓
         可选     必需      可选     必需   必需   可选

完整语法：
execution([public|protected|private|static|final|abstract] [返回值类型] [包名].[类名].[方法名]([参数列表]) [throws 异常])

通配符：
  *   匹配任意【一层】内容（一个单词/一段路径）
  ..  匹配任意【多层】（包名中任意层级 / 参数列表任意个数）
  +   匹配指定类及其子类（用在类型后）
```

**常用表达式速查（★ 必背）：**

```java
// ─── 基础匹配 ───
"execution(public * *(..))"
//         ↑public ↑任意返回值 ↑任意方法 ↑任意参数
// 所有 public 方法

"execution(* *(..))"                       // 所有方法（不限修饰符）
"execution(* com.example.service.UserService.*(..))"    // ★ 指定类的所有方法
"execution(* com.example.service.*.*(..))"               // ★ service 包下所有类的所有方法（不含子包）
"execution(* com.example.service..*.*(..))"              // ★★ service 包【及所有子包】的所有方法
"execution(* com.example..*.*(..))"                       // com.example 下所有方法

// ─── 按返回值匹配 ───
"execution(* com.example.service..*.find*(..))"          // 返回任意类型，方法名以 find 开头
"execution(String com.example.service..*.*(..))"          // ★ 返回 String 的方法
"execution(void com.example.service..*.*(..))"            // 返回 void 的方法
"execution(com.example.dto.* com.example..*.*(..))"        // 返回 dto 包下的类型
"execution(java.util.List<com.example.User> *(..))"         // ★ 泛型返回值（需要写全）

// ─── 按参数匹配 ───
"execution(* *(Long))"                       // 只有一个 Long 参数的方法
"execution(* *(Long, ..))"                    // ★ 第一个参数是 Long，后面任意
"execution(* *(.., Long))"                    // 最后一个参数是 Long
"execution(* *(*))"                           // 只有一个任意类型参数
"execution(* *())"                            // 无参方法
"execution(* *(..))"                          // 任意参数（含无参）
"execution(* *(String, int))"                 // 两个参数：String, int
"execution(* set*(..))"                       // 方法名以 set 开头
"execution(* *Service.save*(..))"              // Service 结尾的类的 save 开头的方法

// ─── 通配符组合 ───
"execution(* com.example.*.*(..))"            // 一层包
"execution(* com.example.*..*.*(..))"         // ★ 一层或多层包
"execution(* com..*.*Service.*(..))"          // com 下任意包中，类名以 Service 结尾的所有方法

// ─── 修饰符 ───
"execution(public * *(..))"                   // public
"execution(!public * *(..))"                  // ★ 非 public（! 取反）
"execution(static * *(..))"                   // 静态方法（★ Spring AOP 拦截不到静态方法！）
"execution(final * *(..))"                    // final 方法（★ CGLIB 拦截不到 final！）

// ─── 异常 ───
"execution(* *(..) throws java.io.IOException)"     // 声明抛 IOException 的方法
```

### 4.2 其他切点指示符（Designators）

```java
// ─── ① within：按【类型】匹配（类/接口级别）───
"@within(org.springframework.stereotype.Service)"    // 标注了 @Service 的类的所有方法
"within(com.example.service.UserService)"             // ★ 指定类
"within(com.example.service.*)"                       // service 包下的类（不含子包）
"within(com.example.service..*)"                      // ★ service 包及子包下的所有类
"within(com.example..*Controller)"                    // 所有 Controller 类

// ─── ② this / target：按【代理对象/目标对象】的类型匹配 ───
"this(com.example.service.UserService)"               // ★ 代理对象是 UserService 类型（JDK 代理时匹配接口）
"target(com.example.service.UserService)"             // ★ 目标对象是 UserService 类型
"target(com.example.service.impl.*Impl)"              // 目标对象是 XxxImpl
// this vs target 的区别：
//   this  → 匹配【代理对象】的类型（JDK 代理时是接口，CGLIB 时是子类）
//   target → 匹配【被代理的原始对象】的类型
//   通常用 target 更直观

// ─── ③ args：按【运行时参数类型】匹配 ───
"args(java.lang.Long)"                                // 只有一个 Long 参数的方法
"args(Long, ..)"                                       // 第一个参数是 Long（或其子类）
"args(.., String)"                                     // 最后一个参数是 String
"args(com.example.dto..*)"                             // 参数是 dto 包下的类型
// ⚠️ args 是【运行时】匹配（每次调用都判断），性能比 execution 差，尽量少用

// ─── ④ @annotation：★ 按方法上的注解匹配（最常用！）───
"@annotation(com.example.annotation.LogExecutionTime)"       // ★ 标注了该注解的方法
"@annotation(org.springframework.transaction.annotation.Transactional)"   // @Transactional 方法
"@annotation(com.example.annotation.RateLimit)"               // 自定义限流注解
// 配合参数绑定（★ 直接拿到注解实例，无需反射）
"@Around(\"@annotation(logAnno)\")"
public Object around(ProceedingJoinPoint pjp, LogExecutionTime logAnno) {
    // ★ logAnno 就是方法上的注解实例，可直接读属性
    String value = logAnno.value();
}

// ─── ⑤ @within：按【类上】的注解匹配 ───
"@within(org.springframework.stereotype.Service)"     // 类上有 @Service → 该类所有方法
"@within(org.springframework.web.bind.annotation.RestController)"   // 所有 Controller 的方法

// ─── ⑥ @target：目标对象的类上有指定注解 ───
"@target(com.example.annotation.MyAnno)"

// ─── ⑦ @args：参数的运行时类型上有指定注解 ───
"@args(com.example.annotation.Valid)"                  // 参数对象的类上有 @Valid

// ─── ⑧ bean：★ 按 Bean 名称匹配（Spring AOP 特有，AspectJ 没有）───
"bean(userService)"                                    // 名为 userService 的 Bean
"bean(*Service)"                                       // ★ 名称以 Service 结尾的 Bean
"bean(*Controller)"
"bean(order*)"

// ─── 逻辑组合 ───
"execution(* com.example.service..*.*(..)) && @annotation(com.example.annotation.Log)"
"within(com.example.service..*) || within(com.example.dao..*)"
"execution(public * *(..)) && !execution(* com.example..*.toString())"
"bean(*Service) && !bean(userService)"
// && 或 and     || 或 or     ! 或 not
```

### 4.3 切点的定义与复用

```java
@Aspect
@Component
public class ReusablePointcutAspect {

    // ─── ★ 用 @Pointcut 抽取表达式（复用 + 可读性）───

    /** 所有 Service 层的 public 方法 */
    @Pointcut("execution(public * com.example.service..*.*(..))")
    public void serviceLayer() { }                        // ★ 方法体为空，只是承载表达式

    /** 所有 Controller 层方法 */
    @Pointcut("within(@org.springframework.web.bind.annotation.RestController *)")
    public void controllerLayer() { }

    /** 标注了 @LogExecutionTime 的方法 */
    @Pointcut("@annotation(com.example.annotation.LogExecutionTime)")
    public void logAnnotated() { }

    /** 带 Long 类型 ID 参数的方法 */
    @Pointcut("args(java.lang.Long, ..)")
    public void withIdParam() { }

    /** ★ 组合切点 */
    @Pointcut("serviceLayer() && !withIdParam()")
    public void serviceWithoutId() { }

    /** ★ 带参数的切点（可传递绑定值） */
    @Pointcut("@annotation(com.example.annotation.RateLimit) && @annotation(rateLimit)")
    public void rateLimited(RateLimit rateLimit) { }

    // ─── 使用抽取的切点 ───
    @Before("serviceLayer()")
    public void logServiceCall(JoinPoint jp) { }

    @Around("logAnnotated()")
    public Object measureTime(ProceedingJoinPoint pjp) throws Throwable { }

    @Around("rateLimited(rateLimit)")                       // ★ 参数名要与切点方法参数一致
    public Object doRateLimit(ProceedingJoinPoint pjp, RateLimit rateLimit) throws Throwable {
        int limit = rateLimit.limit();                      // ★ 直接用注解属性
        ...
    }

    // ─── 跨切面引用切点（全限定名）───
    @Before("com.example.aspect.ReusablePointcutAspect.serviceLayer()")
    public void crossAspectAdvice(JoinPoint jp) { }
}
```

### 4.4 获取方法参数值（★ 实战必备）

```java
// ─── 方式 1：JoinPoint.getArgs()（按索引取，脆弱）───
@Before("execution(* com.example.service..*.*(..))")
public void before(JoinPoint jp) {
    Object[] args = jp.getArgs();
    if (args.length > 0 && args[0] instanceof Long id) {
        log.info("第一个参数（ID）：{}", id);
    }
}

// ─── 方式 2：args() 绑定（★ 推荐，类型安全）───
@Before("execution(* com.example.service..*.getById(..)) && args(id)")
public void beforeGetById(Long id) {                    // ★ 参数名 id 与 args(id) 对应
    log.info("查询 ID：{}", id);
}

// 多参数
@Before("execution(* com.example.service..*.transfer(..)) && args(fromId, toId, amount)")
public void beforeTransfer(Long fromId, Long toId, BigDecimal amount) {
    log.info("转账：{} → {}，金额 {}", fromId, toId, amount);
}

// 泛型/父类匹配
@Before("execution(* *(..)) && args(com.example.dto.BaseDTO, ..)")
public void beforeWithDto(BaseDTO dto) { }

// ─── 方式 3：获取参数名（需要 -parameters 编译参数）───
@Around("execution(* com.example.service..*.*(..))")
public Object around(ProceedingJoinPoint pjp) throws Throwable {
    MethodSignature sig = (MethodSignature) pjp.getSignature();
    String[] paramNames = sig.getParameterNames();        // ★ ["id", "name"]（需 -parameters）
    Object[] paramValues = pjp.getArgs();
    Map<String, Object> paramMap = new LinkedHashMap<>();
    for (int i = 0; i < paramNames.length; i++) {
        paramMap.put(paramNames[i], paramValues[i]);
    }
    log.info("{}.{} 参数：{}", sig.getDeclaringType().getSimpleName(), sig.getName(), paramMap);
    return pjp.proceed();
}
// ⚠️ 若未加 -parameters，getParameterNames() 返回 null 或 arg0/arg1
//   Spring 的 DefaultParameterNameDiscoverer 会尝试从 LocalVariableTable 读取（需 -g 编译）
```

## 5. AOP 实战案例 ★★★★★

### 5.1 通用日志切面（含脱敏、耗时、异常）

```java
/**
 * ★ 方法执行日志切面（企业级完整实现）
 */
@Aspect
@Component
@Slf4j
@Order(100)                                    // 在事务（LOWEST_PRECEDENCE）外层
public class MethodLogAspect {

    /** 需要脱敏的字段名（★ 支持通配） */
    private static final Set<String> SENSITIVE_FIELDS = Set.of(
            "password", "pwd", "secret", "token", "idCard", "idNumber",
            "bankCard", "cardNo", "cvv", "accessKey", "privateKey");
    /** 手机号/邮箱的正则（内容脱敏） */
    private static final Pattern PHONE = Pattern.compile("(1[3-9]\\d)(\\d{4})(\\d{4})");
    private static final Pattern EMAIL = Pattern.compile("(\\w{1,3})\\w*(@\\w+\\.\\w+)");

    private final ObjectMapper objectMapper;

    /** 慢方法阈值（超过则 WARN） */
    @Value("${log.slow-method-threshold:2000}")
    private long slowThresholdMs;

    public MethodLogAspect(ObjectMapper objectMapper) { this.objectMapper = objectMapper; }

    /** 切点：所有 Service 和 Controller 的 public 方法，排除 getter/setter/toString */
    @Pointcut("("
            + "  within(@org.springframework.stereotype.Service *)"
            + "  || within(@org.springframework.web.bind.annotation.RestController *)"
            + ") && execution(public * *(..))"
            + " && !execution(* get*())"                        // 排除无参 getter
            + " && !execution(* set*(..))"                       // 排除 setter
            + " && !execution(* toString())"
            + " && !execution(* hashCode())"
            + " && !execution(* equals(..))"
            + " && !@annotation(org.springframework.context.event.EventListener)")   // 排除事件监听
    public void logPointcut() { }

    @Around("logPointcut()")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        MethodSignature sig = (MethodSignature) pjp.getSignature();
        String className = sig.getDeclaringType().getSimpleName();
        String methodName = sig.getName();
        String fullMethod = className + "." + methodName;

        // ① 记录入参（脱敏 + 截断）
        String argsStr = safeSerializeArgs(pjp.getArgs(), sig.getParameterNames());

        long start = System.nanoTime();
        boolean success = false;
        Object result = null;
        Throwable error = null;

        try {
            result = pjp.proceed();                              // ★ 执行目标方法
            success = true;
            return result;
        } catch (Throwable e) {
            error = e;
            throw e;                                              // ★★ 必须重新抛出
        } finally {
            long costMs = (System.nanoTime() - start) / 1_000_000;

            // ② 分级记录
            if (!success) {
                // 业务异常用 warn（可预期），系统异常用 error
                if (error instanceof BusinessException be) {
                    log.warn("[{}] 业务失败 cost={}ms args={} code={} msg={}",
                            fullMethod, costMs, argsStr, be.getCode(), be.getMsg());
                } else {
                    log.error("[{}] 执行异常 cost={}ms args={}", fullMethod, costMs, argsStr, error);
                }
            } else if (costMs > slowThresholdMs) {
                log.warn("[{}] ★慢方法★ cost={}ms args={} result={}",
                        fullMethod, costMs, argsStr, abbreviate(serialize(result), 500));
            } else if (log.isDebugEnabled()) {
                log.debug("[{}] cost={}ms args={} result={}",
                        fullMethod, costMs, argsStr, abbreviate(serialize(result), 200));
            }

            // ③ 监控埋点
            Metrics.timer("method.duration",
                         "class", className,
                         "method", methodName,
                         "status", success ? "success" : "error")
                   .record(costMs, TimeUnit.MILLISECONDS);
        }
    }

    /** 安全序列化参数（脱敏 + 过滤不可序列化对象 + 截断） */
    private String safeSerializeArgs(Object[] args, String[] paramNames) {
        if (args == null || args.length == 0) return "[]";
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < args.length; i++) {
            String name = (paramNames != null && i < paramNames.length) ? paramNames[i] : ("arg" + i);
            // ★ 跳过无法序列化的类型（Servlet、文件流、连接等）
            if (args[i] == null) { map.put(name, null); continue; }
            if (isUnserializable(args[i])) {
                map.put(name, "[" + args[i].getClass().getSimpleName() + "]");
                continue;
            }
            try {
                Object value = args[i];
                // ★ 敏感参数名直接打码
                if (SENSITIVE_FIELDS.stream().anyMatch(f -> name.toLowerCase().contains(f.toLowerCase()))) {
                    map.put(name, "******");
                } else {
                    map.put(name, desensitize(value));
                }
            } catch (Exception e) {
                map.put(name, "[序列化失败:" + e.getClass().getSimpleName() + "]");
            }
        }
        return abbreviate(serialize(map), 2000);
    }

    private boolean isUnserializable(Object obj) {
        return obj instanceof ServletRequest
            || obj instanceof ServletResponse
            || obj instanceof HttpSession
            || obj instanceof MultipartFile
            || obj instanceof InputStream
            || obj instanceof OutputStream
            || obj instanceof Connection
            || obj instanceof org.springframework.web.multipart.MultipartFile[]
            || obj.getClass().getName().startsWith("org.springframework.web.");
    }

    /** 递归脱敏对象中的敏感字段 */
    private Object desensitize(Object value) {
        if (value instanceof CharSequence cs) {
            String s = cs.toString();
            s = PHONE.matcher(s).replaceAll("$1****$3");          // 138****8888
            s = EMAIL.matcher(s).replaceAll("$1***$2");           // tom***@x.com
            return s;
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.forEach((k, v) -> {
                String key = String.valueOf(k);
                boolean sensitive = SENSITIVE_FIELDS.stream()
                        .anyMatch(f -> key.toLowerCase().contains(f.toLowerCase()));
                result.put(key, sensitive ? "******" : desensitize(v));
            });
            return result;
        }
        if (value instanceof Collection<?> col) {
            // ★ 集合只处理前 3 个元素，避免大集合拖慢日志
            return col.stream().limit(3).map(this::desensitize).collect(Collectors.toList());
        }
        // 普通对象：用 Jackson 转 Map 再脱敏（避免反射的性能开销，也可只在 DEBUG 时做）
        if (value.getClass().getName().startsWith("com.example")) {
            try {
                Map<String, Object> asMap = objectMapper.convertValue(value, Map.class);
                return desensitize(asMap);
            } catch (Exception ignored) { return value; }
        }
        return value;
    }

    private String serialize(Object obj) {
        try { return objectMapper.writeValueAsString(obj); }
        catch (Exception e) { return String.valueOf(obj); }
    }

    private String abbreviate(String s, int max) {
        if (s == null) return "null";
        return s.length() <= max ? s : s.substring(0, max) + "...(截断,共" + s.length() + "字符)";
    }
}
```

### 5.2 自定义注解 + 切面：分布式锁

```java
// ─── 注解定义 ───
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface DistributedLock {
    /** 锁的 key，支持 SpEL（如 "#order.userId"） */
    String key();
    /** 前缀（业务隔离） */
    String prefix() default "lock:";
    /** 等待获取锁的最长时间 */
    long waitTime() default 3;
    /** 锁自动释放时间（防死锁） */
    long leaseTime() default 30;
    TimeUnit timeUnit() default TimeUnit.SECONDS;
    /** 获取锁失败的处理策略 */
    FailStrategy failStrategy() default FailStrategy.THROW_EXCEPTION;
    String message() default "操作太频繁，请稍后重试";

    enum FailStrategy { THROW_EXCEPTION, RETURN_NULL, EXECUTE_ANYWAY }
}

// ─── 切面实现 ───
@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
@Order(1)                                  // ★ 优先级最高（在事务之外，防止「事务未提交锁已释放」）
public class DistributedLockAspect {

    private final RedissonClient redisson;
    private final ExpressionParser parser = new SpelExpressionParser();
    private final ParameterNameDiscoverer discoverer = new DefaultParameterNameDiscoverer();

    @Around("@annotation(distributedLock)")
    public Object around(ProceedingJoinPoint pjp, DistributedLock distributedLock) throws Throwable {
        // ① 解析 SpEL 得到真实的锁 key
        String lockKey = distributedLock.prefix() + parseKey(pjp, distributedLock.key());
        RLock lock = redisson.getLock(lockKey);

        // ② 尝试获取锁
        boolean locked = false;
        try {
            locked = lock.tryLock(distributedLock.waitTime(),
                                  distributedLock.leaseTime(),
                                  distributedLock.timeUnit());
            if (!locked) {
                log.warn("获取分布式锁失败, key={}, method={}", lockKey,
                        pjp.getSignature().toShortString());
                return handleFailure(pjp, distributedLock);
            }

            log.debug("获取分布式锁成功, key={}", lockKey);
            // ③ ★ 执行业务
            return pjp.proceed();

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("获取锁被中断", e);
        } finally {
            // ④ ★★ 释放锁（必须判断是当前线程持有，否则抛 IllegalMonitorStateException）
            if (locked && lock.isHeldByCurrentThread()) {
                try {
                    lock.unlock();
                    log.debug("释放分布式锁, key={}", lockKey);
                } catch (Exception e) {
                    log.error("释放分布式锁异常, key={}", lockKey, e);
                }
            }
        }
    }

    /** ★ SpEL 解析：把 "#order.userId" 解析为实际值 */
    private String parseKey(ProceedingJoinPoint pjp, String keyExpression) {
        if (!keyExpression.contains("#")) return keyExpression;      // 无 SpEL，直接用

        MethodSignature sig = (MethodSignature) pjp.getSignature();
        Method method = sig.getMethod();
        Object[] args = pjp.getArgs();
        String[] paramNames = discoverer.getParameterNames(method);

        EvaluationContext ctx = new StandardEvaluationContext();
        if (paramNames != null) {
            for (int i = 0; i < paramNames.length; i++) {
                ctx.setVariable(paramNames[i], args[i]);              // 注入方法参数
            }
        }
        // 额外的内置变量
        ctx.setVariable("methodName", method.getName());
        ctx.setVariable("className", sig.getDeclaringType().getSimpleName());

        try {
            Object value = parser.parseExpression(keyExpression).getValue(ctx);
            if (value == null) {
                throw new IllegalStateException("锁 key 解析为 null：" + keyExpression);
            }
            return value.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SpEL 解析失败：" + keyExpression, e);
        }
    }

    private Object handleFailure(ProceedingJoinPoint pjp, DistributedLock anno) throws Throwable {
        return switch (anno.failStrategy()) {
            case THROW_EXCEPTION -> throw new BusinessException(ResultCode.LOCK_FAILED, anno.message());
            case RETURN_NULL -> null;
            case EXECUTE_ANYWAY -> pjp.proceed();       // 降级：不加锁直接执行
        };
    }
}

// ─── 使用 ───
@Service
public class StockService {

    /** 扣减库存（同一 SKU 串行） */
    @DistributedLock(key = "'stock:' + #skuId", waitTime = 5, leaseTime = 10)
    public void deduct(Long skuId, int quantity) {
        int remain = stockMapper.getStock(skuId);
        if (remain < quantity) throw new BusinessException("库存不足");
        stockMapper.deduct(skuId, quantity);
    }

    /** 防重复下单（同一用户同一商品） */
    @DistributedLock(prefix = "order:create:",
                     key = "#dto.userId + ':' + #dto.skuId",
                     waitTime = 0,                      // ★ 不等待，拿不到直接失败
                     failStrategy = DistributedLock.FailStrategy.THROW_EXCEPTION,
                     message = "订单正在处理中，请勿重复提交")
    public Order createOrder(OrderCreateDTO dto) { ... }
}
```

### 5.3 数据权限切面（自动改写查询条件）

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface DataScope {
    /** 部门表的别名 */
    String deptAlias() default "d";
    /** 用户表的别名 */
    String userAlias() default "u";
    /** 权限范围：ALL=全部, DEPT=本部门, DEPT_AND_CHILD=本部门及以下, SELF=仅本人, CUSTOM=自定义 */
    DataScopeType type() default DataScopeType.DEPT_AND_CHILD;
}

@Aspect
@Component
@RequiredArgsConstructor
public class DataScopeAspect {

    /** ★ 用 ThreadLocal 传递数据权限 SQL 片段给 MyBatis 拦截器 */
    private static final ThreadLocal<String> SCOPE_SQL = new ThreadLocal<>();

    @Before("@annotation(dataScope)")
    public void before(JoinPoint jp, DataScope dataScope) {
        LoginUser user = UserContext.get();
        if (user == null || user.isAdmin()) {
            SCOPE_SQL.remove();                     // 管理员不限制
            return;
        }
        StringBuilder sql = new StringBuilder();
        switch (dataScope.type()) {
            case ALL -> { /* 不加限制 */ }
            case DEPT -> sql.append(String.format(
                    " AND %s.dept_id = %d", dataScope.deptAlias(), user.getDeptId()));
            case DEPT_AND_CHILD -> sql.append(String.format(
                    " AND %s.dept_id IN (SELECT dept_id FROM sys_dept WHERE dept_id = %d "
                  + "OR find_in_set(%d, ancestors))",
                    dataScope.deptAlias(), user.getDeptId(), user.getDeptId()));
            case SELF -> sql.append(String.format(
                    " AND %s.user_id = %d", dataScope.userAlias(), user.getUserId()));
            case CUSTOM -> { /* 从角色配置中读取自定义 SQL */ }
        }
        SCOPE_SQL.set(sql.toString());
    }

    @After("@annotation(dataScope)")
    public void after() {
        SCOPE_SQL.remove();                          // ★ 必须清理
    }

    public static String getScopeSql() { return SCOPE_SQL.get(); }
}

// MyBatis 拦截器中拼接（Executor 或 StatementHandler 层）
@Intercepts(@Signature(type = Executor.class, method = "query",
        args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}))
public class DataScopeInterceptor implements Interceptor {
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        String scopeSql = DataScopeAspect.getScopeSql();
        if (StringUtils.hasText(scopeSql)) {
            // 改写 BoundSql，追加数据权限条件
            ...
        }
        return invocation.proceed();
    }
}
```

## 6. AOP 失效的场景 ★★★★★（★ 高频面试 + 生产事故来源）

| # | 失效场景 | 原因 | 解决方案 |
| --- | --- | --- | --- |
| 1 | **★ 同类内部方法调用（自调用）** | `this.method()` 绕过代理对象 | 拆分类 / 注入自身 / `AopContext.currentProxy()` |
| 2 | **方法不是 public** | Spring AOP 只代理 public 方法 | 改为 public |
| 3 | **方法是 final** | CGLIB 无法重写 final 方法 | 去掉 final |
| 4 | **方法是 static** | 静态方法不参与多态，无法被代理 | 改为实例方法 |
| 5 | **方法是 private** | 子类不可见，无法重写 | 改为 public/protected |
| 6 | **对象不是 Spring 管理的**（自己 new） | 没有经过容器，自然没有代理 | 交给容器管理 |
| 7 | **忘记加 `@EnableAspectJAutoProxy`** | 未开启 AOP 自动代理（Boot 已自动开启） | 加注解 |
| 8 | **切面类未加 `@Component`** | 切面本身不是 Bean，不会被处理 | 加 `@Component` |
| 9 | **切点表达式写错** | 匹配不到任何方法 | 用 IDEA 的切点提示，或单元测试验证 |
| 10 | **`@Async` 与 `@Transactional` 混用顺序** | 代理链顺序问题 | 用 `@Order` 明确顺序 |
| 11 | **接口方法用 JDK 代理，注入实现类** | `ClassCastException` | 注入接口类型，或 `proxyTargetClass=true` |
| 12 | **`@Around` 忘记调 `proceed()`** | 目标方法根本不执行 | 必须调用 |
| 13 | **`@Around` 吞掉异常** | 事务不回滚，调用方无感知 | `catch` 后必须 `throw` |
| 14 | **多个切面顺序不确定** | 未按预期执行 | 用 `@Order` 明确 |
| 15 | **Bean 在 BPP 注册前就被创建** | 代理未织入 | 避免在 BFPP 中提前 getBean |
| 16 | **循环依赖 + @Async** | 注入了原始对象而非代理 | 见 [[后端/Spring/循环依赖与三级缓存]] |

```java
// ─── 失效场景 1 详解：自调用（★ 最常见的坑）───
@Service
public class OrderService {

    @Transactional
    public void outer() {
        this.inner();              // ❌ this 指向【原始对象】，不是代理 → 事务不生效
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void inner() { ... }    // 通过 this 调用，切面完全失效
}

// 原因：
// 容器中存的是【代理对象】proxy，proxy 内部持有【原始对象】target
// 外部调用 proxy.outer() → 代理拦截 → 开启事务 → 调用 target.outer()
// target.outer() 中的 this 就是 target 自己 → this.inner() = target.inner()
// ★ 完全绕过了代理 → inner 的 @Transactional 不生效

// ✅ 解决方案
// 方案 1：拆到两个 Bean（★★ 最佳，符合单一职责）
@Service
public class OrderService {
    @Autowired private OrderTxService txService;      // 跨 Bean 调用，走代理
    public void outer() { txService.inner(); }
}
@Service
public class OrderTxService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void inner() { ... }
}

// 方案 2：注入自身（Spring 4.3+ 支持自注入）
@Service
public class OrderService {
    @Autowired
    @Lazy                                        // ★ 必须加 @Lazy，否则循环依赖报错
    private OrderService self;                   // 注入的是【代理对象】

    @Transactional
    public void outer() {
        self.inner();                            // ✅ 通过代理调用，切面生效
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void inner() { }
}

// 方案 3：AopContext（需开启 exposeProxy）
// 配置：@EnableAspectJAutoProxy(exposeProxy = true)
//      或 spring.aop.expose-proxy=true（Spring Boot 2.x+ 无此项，需 @EnableAspectJAutoProxy）
@Service
public class OrderService {
    @Transactional
    public void outer() {
        OrderService proxy = (OrderService) AopContext.currentProxy();   // ★ 从 ThreadLocal 拿代理
        proxy.inner();                                                    // ✅ 生效
    }
}
// 原理：AbstractAutoProxyCreator 在调用前把代理放入 ThreadLocal，调用后清除
// 缺点：代码侵入性强（依赖 Spring API）；异步线程中拿不到

// 方案 4：从 ApplicationContext 获取
@Service
public class OrderService implements ApplicationContextAware {
    private ApplicationContext ctx;
    @Override public void setApplicationContext(ApplicationContext c) { this.ctx = c; }
    @Transactional
    public void outer() {
        ctx.getBean(OrderService.class).inner();    // ✅ 从容器拿的是代理
    }
}

// 方案 5：编程式事务（不依赖代理）
@Service
public class OrderService {
    @Autowired private TransactionTemplate txTemplate;
    public void outer() {
        txTemplate.execute(status -> { innerLogic(); return null; });   // ✅ 手动控制事务
    }
}
```

## 7. AOP 的原理与源码要点

```java
// ─── AOP 的核心组件 ───
// 1. AnnotationAwareAspectJAutoProxyCreator（★ 核心 BPP）
//    - 是一个 SmartInstantiationAwareBeanPostProcessor
//    - 在 postProcessAfterInitialization 中判断 Bean 是否需要代理
//    - 需要则创建代理对象并返回

// 2. 创建代理的流程
public Object postProcessAfterInitialization(Object bean, String beanName) {
    ...
    return wrapIfNecessary(bean, beanName, cacheKey);
}

protected Object wrapIfNecessary(Object bean, String beanName, Object cacheKey) {
    // ① 判断是否需要代理
    Object[] specificInterceptors = getAdvicesAndAdvisorsForBean(bean.getClass(), beanName, null);
    if (specificInterceptors != DO_NOT_PROXY) {
        // ② ★ 创建代理
        Object proxy = createProxy(bean.getClass(), beanName, specificInterceptors,
                                   new SingletonTargetSource(bean));
        this.proxyTypes.put(cacheKey, proxy.getClass());
        return proxy;                              // ★ 返回代理对象，替换原始 Bean
    }
    return bean;
}

// 3. DefaultAopProxyFactory 决定用哪种代理
public AopProxy createAopProxy(AdvisedSupport config) {
    if (config.isOptimize() || config.isProxyTargetClass()
            || hasNoUserSuppliedProxyInterfaces(config)) {
        Class<?> targetClass = config.getTargetClass();
        if (targetClass.isInterface() || Proxy.isProxyClass(targetClass)) {
            return new JdkDynamicAopProxy(config);          // 目标本身就是接口 → JDK
        }
        return new ObjenesisCglibAopProxy(config);           // ★ CGLIB（用 Objenesis 绕过构造器）
    } else {
        return new JdkDynamicAopProxy(config);               // 有接口 → JDK 动态代理
    }
}

// 4. JdkDynamicAopProxy 的 invoke（★ 拦截器链的执行）
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    TargetSource targetSource = this.advised.targetSource;
    try {
        // Object 的方法直接调用
        if (method.equals(equalsMethod)) return equals(args[0]);
        if (method.equals(hashCodeMethod)) return hashCode();
        // 获取拦截器链
        List<Object> chain = this.advised.getInterceptorsAndDynamicInterceptionAdvice(method, targetClass);
        if (chain.isEmpty()) {
            // 没有拦截器 → 直接反射调用目标方法
            return AopUtils.invokeJoinpointUsingReflection(target, method, args);
        } else {
            // ★★ 有拦截器 → 创建方法调用对象，递归执行拦截器链
            MethodInvocation invocation =
                new ReflectiveMethodInvocation(proxy, target, method, args, targetClass, chain);
            return invocation.proceed();          // ★ 启动拦截器链
        }
    } finally { ... }
}

// 5. ReflectiveMethodInvocation.proceed()（★ 责任链的精髓）
public Object proceed() throws Throwable {
    // ① 所有拦截器都执行完了 → 调用目标方法
    if (this.currentInterceptorIndex == this.interceptorsAndDynamicMethodMatchers.size() - 1) {
        return invokeJoinpoint();                  // ★ 反射调用真实方法
    }
    // ② 取下一个拦截器
    Object interceptorOrInterceptionAdvice =
        this.interceptorsAndDynamicMethodMatchers.get(++this.currentInterceptorIndex);
    // ③ ★ 把自己（invocation）传给拦截器 → 拦截器内部调用 invocation.proceed() 继续链
    return ((MethodInterceptor) interceptorOrInterceptionAdvice).invoke(this);
}
// 这就是「责任链 + 递归」：每个拦截器调用 proceed() 推进到下一个，
// 最后一个 proceed() 触发真实方法，然后逐层返回 → 形成洋葱模型
```

**Spring AOP 的核心类：**

| 类/接口 | 作用 |
| --- | --- |
| `Aspect` | 切面（@Aspect 标注的类） |
| `Advisor` | ★ **切面 = Pointcut + Advice 的组合体**（Spring 内部的核心抽象） |
| `Pointcut` | 切点（`ClassFilter` + `MethodMatcher`） |
| `Advice` / `MethodInterceptor` | 通知（AOP Alliance 标准接口） |
| `ProxyFactory` | 编程式创建代理的工厂 |
| `AopProxy` | 代理创建的抽象（`JdkDynamicAopProxy` / `CglibAopProxy`） |
| `MethodInvocation` | 方法调用对象（承载拦截器链的执行状态） |
| `TargetSource` | 目标对象的封装（可动态切换目标） |
| `AbstractAutoProxyCreator` | ★ 自动代理创建器（BPP） |
| `AnnotationAwareAspectJAutoProxyCreator` | ★ 支持 @Aspect 注解的自动代理创建器 |

```java
// ─── 编程式 AOP（不用注解，理解原理用）───
public class ProgrammaticAopDemo {
    public static void main(String[] args) {
        UserService target = new UserServiceImpl();

        ProxyFactory factory = new ProxyFactory();
        factory.setTarget(target);                                  // 目标对象
        factory.setInterfaces(UserService.class);                    // 代理的接口
        factory.setProxyTargetClass(false);                          // false = JDK 代理

        // ★ Advisor = Pointcut + Advice
        NameMatchMethodPointcut pointcut = new NameMatchMethodPointcut();
        pointcut.addMethodName("create*");                            // 匹配 create 开头的方法
        pointcut.addMethodName("update*");

        MethodInterceptor advice = invocation -> {
            System.out.println("前置增强：" + invocation.getMethod().getName());
            Object result = invocation.proceed();                     // ★ 执行目标方法
            System.out.println("后置增强");
            return result;
        };

        factory.addAdvisor(new DefaultPointcutAdvisor(pointcut, advice));

        UserService proxy = (UserService) factory.getProxy();         // ★ 得到代理
        proxy.createUser(new User());                                 // 会触发增强
    }
}
```

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | ★ 自调用（this.method()） | 事务/缓存/日志切面失效 | 拆类 / 注入 self / `AopContext` |
| 2 | 切面类忘加 `@Component` | 切面完全不生效 | 加注解 |
| 3 | 忘开 `@EnableAspectJAutoProxy` | 非 Boot 项目中 AOP 不生效 | 加注解（Boot 自动开启） |
| 4 | 切点表达式路径写错 | 匹配不到 | 单元测试验证切点；用 IDEA 提示 |
| 5 | `@Around` 不调 `proceed()` | 目标方法不执行 | 必须调用 |
| 6 | `@Around` 吞异常 | 事务不回滚、错误被掩盖 | catch 后必须 `throw` |
| 7 | 拦截 private/final/static 方法 | 不生效 | Spring AOP 只支持 public 实例方法 |
| 8 | 自己 new 的对象 | 不生效 | 必须由容器管理 |
| 9 | 通知顺序记错 | 逻辑不符合预期 | Spring 5.2.7+：Around前→Before→方法→AfterReturning→After→Around后 |
| 10 | 多切面无 `@Order` | 顺序不确定 | 显式 `@Order` |
| 11 | JDK 代理下注入实现类 | `ClassCastException` | 注入接口，或 `proxyTargetClass=true` |
| 12 | `@Transactional` 默认 Order 最低 | 自定义切面在事务内/外不符合预期 | 理解 Order，事务是 LOWEST_PRECEDENCE |
| 13 | 切面中抛异常 | 目标方法不执行（@Before 抛异常会阻止） | 切面内做好异常处理 |
| 14 | `args()` 切点性能差 | 每次调用都做类型判断 | 优先用 `execution` 的静态匹配 |
| 15 | 参数名获取为 arg0 | `getParameterNames()` 返回 null | 编译加 `-parameters` |
| 16 | 切面日志序列化大对象 | 性能骤降、日志爆炸 | 截断 + 排除大对象 + 只在 DEBUG 时详细记录 |
| 17 | 日志切面记录敏感信息 | 密码/token 泄漏到日志 | ★ 脱敏处理 |
| 18 | 切面中修改参数 | 副作用难追踪 | 谨慎，明确文档说明 |
| 19 | `@Async` 与切面组合 | 顺序/线程问题 | 明确 Order；异步方法内 ThreadLocal 不传递 |
| 20 | 在 `@PostConstruct` 中调本类的切面方法 | 切面不生效 | 此时代理还没生成 |
| 21 | 大量切点匹配 | 启动变慢、内存增加 | 收窄切点范围 |
| 22 | 引入（Introduction）用错 | 类型转换失败 | `@DeclareParents` 需谨慎 |

---

## 关联笔记

- 上一篇：[[后端/Spring/循环依赖与三级缓存]]
- 下一篇：[[后端/Spring/动态代理-JDK与CGLIB]]
- 相关：[[后端/Spring/事务管理与失效场景]]（`@Transactional` 的 AOP 实现与失效场景）
- 底层：[[后端/Java基础/反射与动态代理]]（JDK Proxy 与 CGLIB 原理）
- 注解：[[后端/Java基础/泛型枚举与注解]]（自定义注解 + AOP 实战）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
