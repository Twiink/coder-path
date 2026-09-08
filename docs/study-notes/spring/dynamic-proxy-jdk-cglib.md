---
title: "动态代理-JDK与CGLIB"
aliases:
  - "Spring 动态代理"
  - "AopProxy"
  - "CGLIB"
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
  - "[[后端/Java基础/反射与动态代理]]"
  - "[[后端/Spring/事务管理与失效场景]]"
  - "[[后端/Spring/Spring注解大全与配置类]]"
created: 2026-09-07
updated: 2026-09-07
---

# 动态代理：JDK 与 CGLIB（Spring 视角）

> JDK Proxy / CGLIB 的**语言层原理**（`Proxy.newProxyInstance`、`InvocationHandler`、`Enhancer`、`MethodInterceptor`、字节码结构）见 [[后端/Java基础/反射与动态代理]]。本篇聚焦 **Spring AOP 如何使用动态代理**：AopProxy 体系、代理选择策略、拦截器链、以及框架中的代理应用。

## 1. Spring AOP 的代理体系

```
                    AopProxy（接口）
                    ├── getProxy()
                    └── getProxy(ClassLoader)
                        △
          ┌─────────────┴──────────────────┐
          │                                │
  JdkDynamicAopProxy              CglibAopProxy
  （implements InvocationHandler）  │
  ★ JDK 动态代理实现                └── ObjenesisCglibAopProxy
                                          （★ 用 Objenesis 绕过构造器）
                    ▲
                    │ 创建
          DefaultAopProxyFactory（★ 决定用哪种代理）
                    ▲
                    │ 调用
     AbstractAutoProxyCreator（★ BeanPostProcessor，自动创建代理）
                    △
                    │
     AnnotationAwareAspectJAutoProxyCreator（★ 处理 @Aspect 注解）
     InfrastructureAdvisorAutoProxyCreator（只处理基础设施 Advisor，如事务）
```

**核心类职责：**

| 类 | 职责 |
| --- | --- |
| **`AbstractAutoProxyCreator`** | ★ BeanPostProcessor，在 Bean 初始化后判断是否需要代理并创建 |
| `AnnotationAwareAspectJAutoProxyCreator` | 解析 `@Aspect` 切面，找出所有 Advisor |
| **`DefaultAopProxyFactory`** | ★ 决定用 JDK 还是 CGLIB |
| **`JdkDynamicAopProxy`** | JDK 动态代理的实现（本身是 InvocationHandler） |
| **`CglibAopProxy`** | CGLIB 代理的实现 |
| `ObjenesisCglibAopProxy` | ★ CGLIB 的增强版（用 Objenesis 创建实例，不调构造器） |
| `AdvisedSupport` / `ProxyFactory` | 代理配置（目标对象、接口、Advisor 列表） |
| `ReflectiveMethodInvocation` | ★ 拦截器链的执行载体（责任链） |
| `TargetSource` | 目标对象的封装（支持池化、热替换） |

## 2. 代理方式的选择逻辑 ★★★★★

```java
// DefaultAopProxyFactory.createAopProxy()
@Override
public AopProxy createAopProxy(AdvisedSupport config) throws AopConfigException {

    // ─── ① 判断是否强制使用 CGLIB ───
    if (config.isOptimize()                              // 优化标志（默认 false）
        || config.isProxyTargetClass()                   // ★ proxyTargetClass=true（强制 CGLIB）
        || hasNoUserSuppliedProxyInterfaces(config)) {    // ★ 目标类没有实现任何接口

        Class<?> targetClass = config.getTargetClass();
        if (targetClass == null) {
            throw new AopConfigException("...");
        }

        // ─── ② 特殊情况：目标本身就是接口 或 已经是 JDK 代理 ───
        if (targetClass.isInterface() || Proxy.isProxyClass(targetClass)
                || ClassUtils.isLambdaClass(targetClass)) {
            return new JdkDynamicAopProxy(config);        // ★ 仍用 JDK 代理
        }

        // ─── ③ 使用 CGLIB（★ 用 Objenesis 版本）───
        return new ObjenesisCglibAopProxy(config);
    }
    else {
        // ─── ④ 有接口且未强制 CGLIB → JDK 动态代理 ───
        return new JdkDynamicAopProxy(config);
    }
}

/** 判断目标类是否没有「用户指定的」代理接口 */
private boolean hasNoUserSuppliedProxyInterfaces(AdvisedSupport config) {
    Class<?>[] ifcs = config.getProxiedInterfaces();
    // 只有 SpringProxy 等内部接口，没有业务接口 → 视为「无接口」
    return (ifcs.length == 0 || (ifcs.length == 1 && SpringProxy.class.isAssignableFrom(ifcs[0])));
}
```

**决策流程图：**

```
需要创建代理
    │
    ▼
proxyTargetClass == true？（Spring Boot 2.x+ 默认 true）
    ├── 是 ──┐
    │        │
    └── 否 ──┤
             ▼
     目标类实现了业务接口？
        ├── 否（无接口）────────────────────→ ★ CGLIB
        └── 是 ──┐
                 │
                 ├─ proxyTargetClass=true ──┐
                 │                          │
                 │                          ▼
                 │                  目标类是接口/已是代理/Lambda？
                 │                    ├── 是 → JDK 动态代理
                 │                    └── 否 → ★ CGLIB
                 │
                 └─ proxyTargetClass=false → ★ JDK 动态代理
```

**Spring 各版本的默认策略：**

| 版本 | 默认策略 | 配置项 |
| --- | --- | --- |
| Spring 4.x 及以前 | **有接口 → JDK；无接口 → CGLIB** | `proxyTargetClass=false` |
| **Spring Boot 2.x+** | ★ **全部用 CGLIB** | `spring.aop.proxy-target-class=true`（默认 true） |
| Spring Framework 6 / Boot 3 | 同 Boot 2（默认 CGLIB） | 同上 |

```yaml
# 显式控制
spring:
  aop:
    auto: true                    # 是否自动代理（默认 true）
    proxy-target-class: true      # ★ true = 强制 CGLIB；false = 有接口用 JDK
```

```java
// 注解方式
@EnableAspectJAutoProxy(proxyTargetClass = true)      // 强制 CGLIB
@EnableAspectJAutoProxy(proxyTargetClass = false)     // 有接口用 JDK
@EnableAspectJAutoProxy(exposeProxy = true)           // ★ 暴露代理到 AopContext（解决自调用）
@EnableTransactionManagement(proxyTargetClass = true) // 事务的代理方式
@EnableCaching(proxyTargetClass = true)               // 缓存的代理方式
@EnableAsync(proxyTargetClass = true)                 // 异步的代理方式
// ⚠️ 这些 Enable 注解的 proxyTargetClass 是【独立的】，但 Spring Boot 会统一设置
```

> 【面试】**为什么 Spring Boot 2 把默认改成 CGLIB？**
> 1. **减少新手困惑**：JDK 代理下 `@Autowired UserServiceImpl impl` 会失败（代理只能转成接口），报 `NoSuchBeanDefinitionException` 或 `ClassCastException`，非常反直觉。CGLIB 代理是实现类的子类，两种注入都能成功。
> 2. **`@Configuration` 类本来就必须用 CGLIB**（保证 `@Bean` 方法的单例语义），统一策略更一致。
> 3. **CGLIB 的性能已足够好**（FastClass 机制避免反射），且 Spring 内置了 repackaged 版本，无额外依赖。
> 4. **一致性**：所有 Bean 用同一种代理方式，行为可预测。
>
> **代价**：CGLIB 不能代理 final 类和 final/private/static 方法；会调用构造器（Spring 用 Objenesis 规避）。

## 3. JdkDynamicAopProxy 源码剖析

```java
/**
 * ★ 它本身既是 AopProxy 又是 InvocationHandler
 */
final class JdkDynamicAopProxy implements AopProxy, InvocationHandler, Serializable {

    private final AdvisedSupport advised;                 // ★ 代理配置（目标、接口、Advisor 链）
    private int cachedHashCode;

    JdkDynamicAopProxy(AdvisedSupport config) {
        this.advised = config;
    }

    @Override
    public Object getProxy(ClassLoader classLoader) {
        // ★ 收集要代理的接口（业务接口 + SpringProxy + Advised + DecoratingProxy）
        Class<?>[] proxiedInterfaces = AopProxyUtils.completeProxiedInterfaces(this.advised);
        // ★ 找出 equals 和 hashCode 方法（特殊处理）
        findDefinedEqualsAndHashCodeMethods(proxiedInterfaces);
        // ★★ 用 JDK 的 Proxy 生成代理（this 作为 InvocationHandler）
        return Proxy.newProxyInstance(classLoader, proxiedInterfaces, this);
    }

    /** ★★ 核心：所有方法调用都进入这里 */
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        TargetSource targetSource = this.advised.targetSource;
        Object target = null;

        try {
            // ─── ① equals 方法的特殊处理 ───
            if (method.equals(equalsMethod)) {
                return equals(args[0]);                    // 比较的是【代理对象】，不是目标对象
            }
            // ─── ② hashCode 的特殊处理 ───
            if (method.equals(hashCodeMethod)) {
                return hashCode();
            }
            // ─── ③ 目标类自己声明的方法（如 finalize）直接调用 ───
            if (method.getDeclaringClass() == target.getClass()) {
                return method.invoke(target, args);
            }

            // ─── ④ ★★ 获取拦截器链（Advisor 转换成的 MethodInterceptor 列表）───
            List<Object> chain = this.advised.getInterceptorsAndDynamicInterceptionAdvice(method, targetClass);

            if (chain.isEmpty() && CglibMethodInvocation.isMethodProxyCompatible(method)) {
                // ─── ⑤ 没有拦截器 → 直接反射调用目标方法（快速路径）───
                Object[] argsToUse = AopProxyUtils.adaptArgumentsIfNecessary(method, args);
                target = targetSource.getTarget();
                return AopUtils.invokeJoinpointUsingReflection(target, method, argsToUse);
            } else {
                // ─── ⑥ ★★ 有拦截器 → 创建 MethodInvocation，启动责任链 ───
                target = targetSource.getTarget();
                Class<?> targetClass = (target != null ? target.getClass() : null);
                MethodInvocation invocation =
                    new ReflectiveMethodInvocation(proxy, target, method, args, targetClass, chain);
                // ★ 执行拦截器链（内部递归调用 proceed()）
                return invocation.proceed();
            }
        } finally {
            if (target != null && !targetSource.isStatic()) {
                targetSource.releaseTarget(target);
            }
        }
    }

    /** ★ 代理对象的 equals：只有指向同一个目标对象的代理才相等 */
    private boolean equals(Object other) {
        if (other == this) return true;
        if (other == null) return false;
        // 同为 JdkDynamicAopProxy 且 advised 配置相同
        if (other instanceof JdkDynamicAopProxy otherProxy) {
            return this.advised.equals(otherProxy.advised);
        }
        return false;
    }
}
```

**拦截器链的执行（★ 责任链 + 递归）：**

```java
// ReflectiveMethodInvocation.proceed()
@Override
public Object proceed() throws Throwable {
    // ─── ① 所有拦截器执行完毕 → 调用真实的目标方法 ───
    if (this.currentInterceptorIndex == this.interceptorsAndDynamicMethodMatchers.size() - 1) {
        return invokeJoinpoint();                  // ★ 反射调用 target.method(args)
    }

    // ─── ② 取下一个拦截器 ───
    Object interceptorOrInterceptionAdvice =
        this.interceptorsAndDynamicMethodMatchers.get(++this.currentInterceptorIndex);

    // ③ 动态方法匹配（运行时再判断一次切点是否匹配）
    if (interceptorOrInterceptionAdvice instanceof InterceptorAndDynamicMethodMatcher dm) {
        Class<?> targetClass = (this.target != null ? this.target.getClass() : null);
        if (!dm.matcher().matches(this.method, targetClass, this.arguments)) {
            return proceed();                       // 不匹配 → 跳过，继续下一个
        }
        interceptorOrInterceptionAdvice = dm.interceptor();
    }

    // ─── ④ ★★ 调用拦截器，把自己传进去（拦截器内部会再调 invocation.proceed()）───
    return ((MethodInterceptor) interceptorOrInterceptionAdvice).invoke(this);
}
```

```
拦截器链的执行过程（洋葱模型）：

proceed() → index=0 → interceptor0.invoke(this)
              └── 前置逻辑
                  └── invocation.proceed() → index=1 → interceptor1.invoke(this)
                        └── 前置逻辑
                            └── invocation.proceed() → index=2 → ★ 没有更多拦截器
                                  └── invokeJoinpoint() → ★ 反射调用真实方法
                            ┌── 返回结果
                        ┌── 后置逻辑
              ┌── 后置逻辑
            ← 最终返回

对应到通知类型：
  interceptor0 = AspectJAroundAdvice      → @Around 的前后都在这层
  interceptor1 = MethodBeforeAdviceInterceptor  → @Before
  interceptor2 = AspectJAfterAdvice             → @After（finally 语义）
  interceptor3 = AfterReturningAdviceInterceptor → @AfterReturning
  interceptor4 = AspectJAfterThrowingAdvice      → @AfterThrowing
  interceptor5 = TransactionInterceptor          → @Transactional
```

## 4. ObjenesisCglibAopProxy（★ Spring 的 CGLIB 增强）

```java
// CglibAopProxy 的问题：创建代理对象时会调用【目标类的构造器】
// 后果：
//   1. 构造器被执行两次（一次创建 target，一次创建 proxy）
//   2. 构造器中的副作用（注册监听、启动线程、初始化资源）会重复执行
//   3. 如果构造器有参数校验，可能因参数为 null 而失败

// ★ Spring 的解决：Objenesis（字节码库，能【不调用构造器】直接创建对象实例）
class ObjenesisCglibAopProxy extends CglibAopProxy {

    private static SpringObjenesis objenesis = new SpringObjenesis();

    @Override
    public Object getProxy(ClassLoader classLoader) {
        // ... CGLIB 的 Enhancer 配置

        // ★ 先用 Objenesis 创建代理实例（不调构造器）
        Object proxy = objenesis.newInstance(proxyClass, enhancer.getUseFactory());
        // 如果 Objenesis 失败（某些 JVM/类加载器环境），回退到 CGLIB 的 create()（会调构造器）
        if (proxy == null) {
            proxy = enhancer.create(...);
        }
        return proxy;
    }
}

// Objenesis 的原理：
// - 使用 JVM 的 sun.reflect.ReflectionFactory.newConstructorForSerialization()
//   创建一个「序列化专用构造器」，绕过真实的构造器
// - 或用 Unsafe.allocateInstance()（直接分配内存，不执行构造器）
```

**CGLIB 代理的回调体系（DynamicAdvisedInterceptor）：**

```java
// CglibAopProxy 内部类：实现 CGLIB 的 MethodInterceptor
private static class DynamicAdvisedInterceptor implements MethodInterceptor, Serializable {

    private final AdvisedSupport advised;

    @Override
    public Object intercept(Object proxy, Method method, Object[] args, MethodProxy methodProxy)
            throws Throwable {

        Object oldProxy = null;
        boolean setProxyContext = false;
        Object target = null;
        TargetSource targetSource = this.advised.getTargetSource();

        try {
            // ① exposeProxy=true 时，把代理放入 AopContext（解决自调用）
            if (this.advised.exposeProxy) {
                oldProxy = AopContext.setCurrentProxy(proxy);
                setProxyContext = true;
            }

            target = targetSource.getTarget();
            Class<?> targetClass = (target != null ? target.getClass() : null);

            // ② ★ 获取拦截器链
            List<Object> chain = this.advised.getInterceptorsAndDynamicInterceptionAdvice(method, targetClass);

            Object retVal;
            if (chain.isEmpty() && CglibMethodInvocation.isMethodProxyCompatible(method)) {
                // ③ 无拦截器 → 用 MethodProxy 直接调用（★ FastClass，无反射，性能好）
                Object[] argsToUse = AopProxyUtils.adaptArgumentsIfNecessary(method, args);
                retVal = invokeMethod(target, method, argsToUse, methodProxy);
            } else {
                // ④ ★ 有拦截器 → 创建 CglibMethodInvocation，启动责任链
                retVal = new CglibMethodInvocation(
                        proxy, target, method, args, targetClass, chain, methodProxy).proceed();
            }
            return processReturnType(proxy, target, method, retVal);

        } finally {
            if (target != null && !targetSource.isStatic()) targetSource.releaseTarget(target);
            if (setProxyContext) AopContext.setCurrentProxy(oldProxy);    // ★ 恢复
        }
    }
}

// ★ MethodProxy.invokeSuper 用的是 FastClass（CGLIB 的性能优化）
// FastClass 为每个方法分配一个索引，调用时用 switch 直接跳转，完全避免反射
```

## 5. AopContext 与自调用问题 ★★★★★

```java
// ─── AopContext 的实现（ThreadLocal）───
public abstract class AopContext {
    private static final ThreadLocal<Object> currentProxy = new NamedThreadLocal<>(
            "Current AOP proxy");

    /** ★ 获取当前代理对象（未开启 exposeProxy 会抛异常） */
    public static Object currentProxy() throws IllegalStateException {
        Object proxy = currentProxy.get();
        if (proxy == null) {
            throw new IllegalStateException(
                "Cannot find current proxy: Set 'exposeProxy' property on Advised to 'true' to make it available, "
              + "and ensure that AopContext.currentProxy() is invoked in the same thread as the AOP proxy context.");
        }
        return proxy;
    }

    static Object setCurrentProxy(Object proxy) {        // 由 AopProxy 调用
        Object old = currentProxy.get();
        if (proxy != null) currentProxy.set(proxy);
        else currentProxy.remove();
        return old;
    }
}

// ─── 使用（解决自调用）───
// ① 开启 exposeProxy
@EnableAspectJAutoProxy(exposeProxy = true)
// 或 Spring Boot：spring.aop.expose-proxy=true（★ 注意：Boot 2.x 的该配置在 3.x 中仍有效）

// ② 在业务代码中使用
@Service
public class OrderService {

    @Transactional
    public void outer() {
        // ★ 从 ThreadLocal 拿到代理对象，通过代理调用 → 切面生效
        ((OrderService) AopContext.currentProxy()).inner();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void inner() { }
}
```

**AopContext 的限制（★ 必须知道）：**

| 限制 | 说明 |
| --- | --- |
| **只在同步调用中有效** | ThreadLocal 绑定线程，`@Async`/线程池中拿不到 |
| 需要显式开启 | `exposeProxy = true`，默认关闭（有轻微性能开销） |
| 代码侵入性强 | 业务代码依赖 `AopContext`（Spring API） |
| 必须 cast | 需要强转回具体类型，IDE 会警告 |
| 嵌套代理会覆盖 | `setCurrentProxy` 保存并恢复旧值（Spring 已处理） |

> 【建议】**优先用「拆分类」的方案解决自调用**（符合单一职责，无框架耦合），`AopContext` 只作为遗留代码的临时手段。四种方案对比见 [[后端/Spring/AOP面向切面编程]] 第 6 节。

## 6. Spring 中动态代理的应用地图 ★★★★★

| 功能 | 注解 | 代理创建者 | 说明 |
| --- | --- | --- | --- |
| **AOP 切面** | `@Aspect` | `AnnotationAwareAspectJAutoProxyCreator` | 自定义切面 |
| **声明式事务** | ★ `@Transactional` | `InfrastructureAdvisorAutoProxyCreator` | `TransactionInterceptor` |
| **异步方法** | `@Async` | `AsyncAnnotationBeanPostProcessor` | `AnnotationAsyncExecutionInterceptor` |
| **方法级缓存** | `@Cacheable`/`@CacheEvict` | `CachingConfigurer` 相关 | `CacheInterceptor` |
| **方法级校验** | `@Validated`（类上） | `MethodValidationPostProcessor` | `MethodValidationInterceptor` |
| **重试** | `@Retryable` | `RetryConfiguration` | `AnnotationAwareRetryOperationsInterceptor` |
| **配置类** | ★ `@Configuration` | `ConfigurationClassPostProcessor` | ★ **强制 CGLIB**，保证 `@Bean` 单例 |
| **限流熔断** | `@SentinelResource` | Sentinel 的 BPP | `SentinelResourceAspect`（切面方式） |
| **Feign 客户端** | `@FeignClient` | `FeignClientFactory` | ★ **JDK 动态代理**（接口无实现类） |
| **MyBatis Mapper** | `@Mapper` 接口 | `MapperFactoryBean` | ★ **JDK 动态代理**（MapperProxy） |
| **Spring Data Repository** | `extends JpaRepository` | `RepositoryFactory` | JDK 动态代理 |
| **`@Lazy` 注入** | `@Lazy` | `ContextAnnotationAutowireCandidateResolver` | 注入延迟解析的代理 |
| **request/session 作用域** | `@Scope(proxyMode=)` | `ScopedProxyFactoryBean` | 运行时从上下文解析真实 Bean |
| **`@Scheduled`** | — | ❌ 不用代理 | 由 ScheduledAnnotationBeanPostProcessor 直接注册任务 |

### 6.1 @Configuration 的 CGLIB 代理（★ 特殊且重要）

```java
// @Configuration 类会被 CGLIB 增强，目的是保证 @Bean 方法的单例语义
@Configuration
public class AppConfig {
    @Bean
    public DataSource dataSource() {
        return new DruidDataSource();
    }

    @Bean
    public JdbcTemplate jdbcTemplate() {
        // ★ 这里调用 dataSource()，如果是普通类会 new 一个新的 DataSource
        //   CGLIB 增强后：拦截这个调用 → 从容器中获取【已存在的单例】
        return new JdbcTemplate(dataSource());
    }
}

// CGLIB 增强后的行为（ConfigurationClassEnhancer）
// ① BeanMethodInterceptor：拦截 @Bean 方法
//    - 检查容器中是否已有该 Bean
//    - 有 → 直接返回容器中的单例（★ 不执行方法体！）
//    - 没有 → 执行方法体，创建 Bean，注册到容器
// ② NoOp 处理：非 @Bean 方法不拦截
// ③ 保证同一个 @Bean 方法多次调用返回同一对象
```

```java
// 验证 CGLIB 增强
@Configuration
public class DemoConfig {
    @Bean public Foo foo() {
        System.out.println("foo() 被调用了！");       // ★ 只会打印一次
        return new Foo();
    }
    @Bean public Bar bar() {
        return new Bar(foo(), foo());                  // 调用两次 foo()
    }
}
// 输出：只打印一次 "foo() 被调用了！"
// 因为第二次 foo() 被 CGLIB 拦截，直接返回容器中的单例

// 查看代理类名
System.out.println(demoConfig.getClass());
// class com.example.DemoConfig$$SpringCGLIB$$0        ← ★ 被增强了

// ─── proxyBeanMethods = false（★ Spring Boot 的性能优化）───
@Configuration(proxyBeanMethods = false)               // ★ 不做 CGLIB 增强
public class FastConfig {
    @Bean public Foo foo() { return new Foo(); }
    @Bean public Bar bar(Foo foo) {                    // ★ 必须用【参数注入】，不能调 foo()
        return new Bar(foo);
    }
}
// 优点：启动更快（不生成代理类）、内存更省
// 缺点：@Bean 方法之间不能互相调用（调了就是普通方法调用，会创建新对象）
// ★ Spring Boot 的所有自动配置类都用了 proxyBeanMethods = false
```

### 6.2 @Lazy 注入的代理

```java
// @Lazy 注入的不是真实 Bean，而是一个「延迟解析代理」
@Service
public class OrderService {
    @Autowired
    @Lazy                                      // ★ 注入代理，首次调用方法时才 getBean
    private ReportService reportService;

    public void export() {
        reportService.generate();               // ★ 此时才真正解析并调用 ReportService
    }
}

// 原理：ContextAnnotationAutowireCandidateResolver.buildLazyResolutionProxy()
// 用 ProxyFactory 创建一个代理，TargetSource 是「每次调用时从容器解析」
// 用途：
// ① 解决循环依赖（构造器注入 + @Lazy 是标准解法，见 [[后端/Spring/循环依赖与三级缓存]]）
// ② 加速启动（重 Bean 延迟到首次使用时才创建）
// ③ 每次获取新实例（配合 prototype）
```

### 6.3 Feign 与 MyBatis 的 JDK 代理（★ 无实现类也能调用）

```java
// ─── MyBatis Mapper：只有接口，没有实现类 ───
public interface UserMapper {
    @Select("SELECT * FROM user WHERE id = #{id}")
    User selectById(Long id);
}
@Autowired private UserMapper userMapper;      // ★ 注入的是 JDK 动态代理对象

// MapperProxyFactory.newInstance()
public T newInstance(SqlSession sqlSession) {
    final MapperProxy<T> mapperProxy =
        new MapperProxy<>(sqlSession, mapperInterface, methodCache);
    return (T) Proxy.newProxyInstance(
        mapperInterface.getClassLoader(),
        new Class[] { mapperInterface },
        mapperProxy);                            // ★ JDK 动态代理
}

// MapperProxy.invoke()：根据方法找到对应的 SQL 并执行
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    if (Object.class.equals(method.getDeclaringClass())) {
        return method.invoke(this, args);                    // Object 方法直接调
    }
    return cachedInvoker(method).invoke(proxy, method, args, sqlSession);
    // → MapperMethod.execute() → sqlSession.selectOne/insert/update/delete
}

// ─── OpenFeign：只有接口，代理内部发起 HTTP 调用 ───
@FeignClient(name = "user-service", path = "/users")
public interface UserClient {
    @GetMapping("/{id}")
    UserDTO getById(@PathVariable("id") Long id);
}
// 代理对象的方法调用 → 解析注解构建 HTTP 请求 → LoadBalancer 选实例 → 发起调用 → 反序列化响应
// 详见 [[后端/微服务/OpenFeign服务调用]]
```

## 7. 代理相关的常见问题与排查

### 7.1 ClassCastException（★ JDK 代理的经典问题）

```java
// 场景：JDK 代理下，注入实现类类型
@Service
public class UserServiceImpl implements UserService { }

@Autowired
private UserServiceImpl userServiceImpl;       // ❌ 注入失败
// 报错（Spring Boot 1.x/2.x proxyTargetClass=false 时）：
// Bean named 'userServiceImpl' is expected to be of type 'UserServiceImpl'
//   but was actually of type 'com.sun.proxy.$Proxy123'
// 或
// java.lang.ClassCastException: class com.sun.proxy.$Proxy123
//   cannot be cast to class com.example.UserServiceImpl

// 原因：JDK 代理生成的 $Proxy 只 implements UserService，与 UserServiceImpl 无继承关系
//      $Proxy extends java.lang.reflect.Proxy implements UserService
//      UserServiceImpl 不在其继承链上 → 无法强转

// ✅ 解决方案
// 方案 1：注入接口类型（★ 推荐，面向接口编程）
@Autowired
private UserService userService;

// 方案 2：改用 CGLIB 代理（代理是实现类的子类，可强转）
// spring.aop.proxy-target-class=true（Spring Boot 2+ 默认）
// 此时代理类是 UserServiceImpl$$SpringCGLIB$$0 extends UserServiceImpl → 可强转

// 方案 3：手动获取时也用接口
UserService service = ctx.getBean(UserService.class);        // ✅
UserServiceImpl impl = ctx.getBean(UserServiceImpl.class);   // ❌ JDK 代理下失败
```

### 7.2 判断一个 Bean 是否被代理

```java
// ─── 编程式判断 ───
@Autowired private ApplicationContext ctx;

public void checkProxy() {
    Object bean = ctx.getBean("orderService");

    // ① 是否 JDK 代理
    boolean isJdkProxy = Proxy.isProxyClass(bean.getClass());

    // ② 是否 CGLIB 代理（类名含 $$）
    boolean isCglibProxy = bean.getClass().getName().contains("$$");

    // ③ ★ Spring 提供的工具（推荐）
    boolean isAopProxy = AopUtils.isAopProxy(bean);                    // 是否 AOP 代理
    boolean isJdk = AopUtils.isJdkDynamicProxy(bean);                  // 是否 JDK 代理
    boolean isCglib = AopUtils.isCglibProxy(bean);                     // 是否 CGLIB 代理

    // ④ 获取目标类（穿透代理）
    Class<?> targetClass = AopUtils.getTargetClass(bean);              // ★ 原始类
    Class<?> ultimateClass = AopUtils.getUltimateTargetClass(bean);     // 多层代理的最终类

    // ⑤ 获取代理的配置（Advisor 列表）
    if (bean instanceof Advised advised) {
        Advisor[] advisors = advised.getAdvisors();
        Object target = advised.getTargetSource().getTarget();
        System.out.println("目标对象：" + target);
        System.out.println("Advisor 数量：" + advisors.length);
        for (Advisor a : advisors) {
            System.out.println("  " + a.getClass().getSimpleName() + " → " + a.getAdvice());
        }
    }

    log.info("Bean={}, class={}, isProxy={}, isCglib={}, targetClass={}",
            bean, bean.getClass().getName(), isAopProxy, isCglib, targetClass);
}

// ─── 命令行排查（Arthas）───
// sc -d com.example.service.OrderService      # 看类名是否含 $$SpringCGLIB$$
// vmtool --action getInstances --className com.example.service.OrderService
```

### 7.3 代理导致的常见问题汇总

| 问题 | 原因 | 解决 |
| --- | --- | --- |
| 注入实现类失败 | JDK 代理只能转接口 | 注入接口 / `proxyTargetClass=true` |
| 自调用切面失效 | this 绕过代理 | 拆类 / `AopContext` / 注入 self |
| `final` 方法不被增强 | CGLIB 无法重写 final | 去掉 final |
| `private` 方法不被增强 | 子类不可见 | 改为 public/protected |
| `static` 方法不被增强 | 静态方法不参与多态 | 改为实例方法 |
| 构造器执行两次 | CGLIB 未用 Objenesis | Spring 已用 ObjenesisCglibAopProxy 规避 |
| `@PostConstruct` 中 this 是原始对象 | 代理在初始化后才生成 | 初始化后逻辑用 `SmartInitializingSingleton` |
| `toString()`/`equals()` 行为异常 | 代理重写了这些方法 | 理解 JdkDynamicAopProxy 的特殊处理 |
| 多层代理嵌套 | 多个 BPP 都创建了代理 | 检查 Advisor 链，Spring 会合并到一个代理 |
| 序列化失败 | 代理类不可序列化 | 目标类实现 Serializable，或用接口 |
| `getClass()` 返回代理类名 | 日志/监控中看到 `$$SpringCGLIB$$` | 用 `AopUtils.getTargetClass()` |
| 反射调用代理方法 | 可能触发或不触发切面 | 明确用代理还是目标对象 |

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | Spring Boot 2/3 默认 CGLIB，老代码假设 JDK 代理 | `AopUtils.isJdkDynamicProxy` 返回 false | 代码不要依赖具体代理类型 |
| 2 | 强制 `proxyTargetClass=false` 后注入实现类失败 | `ClassCastException` | 注入接口类型 |
| 3 | `@Configuration` 未开启 CGLIB（用 `@Component`） | `@Bean` 互相调用创建多个对象 | 用 `@Configuration`，或参数注入 + `proxyBeanMethods=false` |
| 4 | `proxyBeanMethods=false` 却调用其他 `@Bean` 方法 | 创建了新对象（不在容器中） | 改用方法参数注入 |
| 5 | `AopContext.currentProxy()` 未开 exposeProxy | `IllegalStateException` | `@EnableAspectJAutoProxy(exposeProxy=true)` |
| 6 | `AopContext` 在异步线程中使用 | 抛异常（ThreadLocal 为空） | 异步场景用其他方式（拆类） |
| 7 | 以为 CGLIB 能代理 final 类 | `IllegalArgumentException` | 去掉 final，或用 JDK 代理（需接口） |
| 8 | 目标类无 public 无参构造器 + 老版 CGLIB | 创建代理失败 | Spring 用 Objenesis 已规避；升级 Spring |
| 9 | 多层代理导致 Advisor 重复执行 | 切面被执行多次 | 检查是否有多个 BPP 都创建了代理 |
| 10 | 序列化代理对象 | `NotSerializableException` | 目标类实现 Serializable；序列化用目标对象 |
| 11 | 在 BFPP 中 getBean 导致提前实例化 | 该 Bean 的 AOP/事务失效 | BFPP 中不要 getBean |
| 12 | `@Async` 方法的代理与事务代理冲突 | 顺序不符合预期 | 用 `@Order` 明确；理解 Advisor 排序 |
| 13 | Feign/Mapper 接口代理注入失败 | `NoSuchBeanDefinition` | 检查 `@EnableFeignClients`/`@MapperScan` 的包路径 |
| 14 | 测试中手动 new Service 后期望事务生效 | 事务不生效 | 必须由容器管理，用 `@SpringBootTest` |
| 15 | 用反射直接调用目标对象的方法 | 绕过所有切面 | 明确意图：要切面用代理，不要切面用 target |

---

## 关联笔记

- 上一篇：[[后端/Spring/AOP面向切面编程]]
- 下一篇：[[后端/Spring/事务管理与失效场景]]
- 语言层原理：[[后端/Java基础/反射与动态代理]]（JDK Proxy / CGLIB / Byte Buddy 详解）
- 相关：[[后端/Spring/循环依赖与三级缓存]]（代理与三级缓存的配合）、[[后端/Spring/Spring注解大全与配置类]]（@Configuration 的代理）
- 应用：[[后端/MyBatis/MyBatis入门与核心配置]]（Mapper 动态代理）、[[后端/微服务/OpenFeign服务调用]]（Feign 代理）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
