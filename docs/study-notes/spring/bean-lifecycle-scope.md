---
title: "Bean生命周期与作用域"
aliases:
  - "Bean 生命周期"
  - "BeanPostProcessor"
  - "Bean 作用域"
tags:
  - "后端"
  - "java"
  - "spring"
  - "面试"
category: "后端"
folder: "Spring"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Spring/Spring概述与IoC容器]]"
  - "[[后端/Spring/循环依赖与三级缓存]]"
  - "[[后端/Spring/AOP面向切面编程]]"
  - "[[后端/SpringBoot/自动配置原理]]"
created: 2026-09-07
updated: 2026-09-07
---

# Bean 生命周期与作用域

## 1. Bean 生命周期全流程 ★★★★★

**这是 Spring 面试的头号考点。一个 Bean 从「BeanDefinition」到「可用对象」再到「销毁」，经历约 13 个关键步骤。**

### 1.1 完整流程图

```
                    BeanDefinition（Bean 的蓝图，refresh 阶段已注册）
                              │
        ══════════════════ 实例化前 ══════════════════
①  InstantiationAwareBeanPostProcessor.postProcessBeforeInstantiation()
       ★ 可在此返回代理对象【短路】整个创建流程（AOP 的目标源、@Lazy 代理）
                              │
②  推断构造方法 + 实例化（Instantiation）
       createBeanInstance()：反射调用构造器 → 得到「原始对象」（属性都是 null）
       ★ 此时对象还没注入任何依赖
                              │
③  MergedBeanDefinitionPostProcessor.postProcessMergedBeanDefinition()
       ★ 收集 @Autowired/@Resource/@PostConstruct 的元数据（提前解析，加速后续）
                              │
④  （提前暴露）三级缓存 putSingletonFactory()  ★ 解决循环依赖的关键
                              │
        ══════════════════ 属性填充 ══════════════════
⑤  InstantiationAwareBeanPostProcessor.postProcessProperties()
       ★★ AutowiredAnnotationBeanPostProcessor 在此完成 @Autowired/@Value 注入
       ★★ CommonAnnotationBeanPostProcessor 在此完成 @Resource 注入
       populateBean()：依赖注入（DI）真正发生的地方
                              │
        ══════════════════ 初始化 ══════════════════
⑥  Aware 接口回调（按顺序）
       BeanNameAware.setBeanName()
       BeanClassLoaderAware.setBeanClassLoader()
       BeanFactoryAware.setBeanFactory()
       ↓（以下由 ApplicationContextAwareProcessor 处理）
       EnvironmentAware / EmbeddedValueResolverAware / ResourceLoaderAware
       ApplicationEventPublisherAware / MessageSourceAware
       ApplicationContextAware.setApplicationContext()
       ServletContextAware / ServletConfigAware（Web 环境）
                              │
⑦  BeanPostProcessor.postProcessBeforeInitialization()  ★★ 前置处理
       ★ CommonAnnotationBeanPostProcessor 在此执行 @PostConstruct
       ★ ApplicationContextAwareProcessor 在此执行各种 Aware
       （所有 BPP 按顺序执行）
                              │
⑧  InitializingBean.afterPropertiesSet()               ★ 接口方式
                              │
⑨  自定义 init-method（@Bean(initMethod=) 或 XML init-method）  ★ 配置方式
                              │
⑩  BeanPostProcessor.postProcessAfterInitialization()   ★★★ 后置处理
       ★★ AnnotationAwareAspectJAutoProxyCreator 在此【创建代理对象】！
       ★ 返回的可能是代理对象而非原始对象 → 这就是 AOP 的织入时机
                              │
                    ★ Bean 创建完成，放入单例池（singletonObjects），可被使用
                              │
        ══════════════════ 使用阶段 ══════════════════
                              │
        ══════════════════ 销毁阶段（容器关闭时）══════════════════
⑪  @PreDestroy                              ★ 注解方式（CommonAnnotationBeanPostProcessor）
⑫  DisposableBean.destroy()                 ★ 接口方式
⑬  自定义 destroy-method                      ★ 配置方式
```

### 1.2 三大初始化 / 销毁方式的执行顺序 ★★★★★

```java
@Component
public class LifecycleBean implements InitializingBean, DisposableBean {

    public LifecycleBean() {
        System.out.println("① 构造方法");                  // 实例化
    }

    // ─── Aware ───
    @Override public void setBeanName(String name) {
        System.out.println("③ BeanNameAware: " + name);
    }
    @Override public void setBeanFactory(BeanFactory bf) {
        System.out.println("④ BeanFactoryAware");
    }

    // ─── 注解方式（★ 最先执行）───
    @PostConstruct
    public void postConstruct() {
        System.out.println("⑥ @PostConstruct");
    }

    // ─── 接口方式（★ 第二）───
    @Override
    public void afterPropertiesSet() {
        System.out.println("⑦ InitializingBean.afterPropertiesSet");
    }

    // ─── 自定义方法（★ 第三，由 @Bean(initMethod) 或 XML 指定）───
    public void customInit() {
        System.out.println("⑧ 自定义 init-method");
    }

    // ─── 销毁：顺序同上 ───
    @PreDestroy
    public void preDestroy() {
        System.out.println("⑩ @PreDestroy");               // ★ 最先
    }
    @Override
    public void destroy() {
        System.out.println("⑪ DisposableBean.destroy");    // ★ 第二
    }
    public void customDestroy() {
        System.out.println("⑫ 自定义 destroy-method");      // ★ 第三
    }
}

@Configuration
public class LifecycleConfig {
    @Bean(initMethod = "customInit", destroyMethod = "customDestroy")   // ★ 指定自定义方法
    public LifecycleBean lifecycleBean() {
        return new LifecycleBean();
    }
}

// 输出顺序（★ 必背）：
// ① 构造方法
// ② （属性填充：@Autowired 注入）
// ③ BeanNameAware.setBeanName
// ④ BeanFactoryAware.setBeanFactory
// ⑤ ApplicationContextAware.setApplicationContext
// ⑥ @PostConstruct                    ← ★ 注解
// ⑦ afterPropertiesSet                ← ★ 接口
// ⑧ customInit                        ← ★ 自定义方法
// ⑨ （BeanPostProcessor.postProcessAfterInitialization → AOP 代理）
// ═══ Bean 可用 ═══
// ⑩ @PreDestroy                       ← ★ 注解
// ⑪ DisposableBean.destroy            ← ★ 接口
// ⑫ customDestroy                     ← ★ 自定义方法
```

**三种方式的对比与选择：**

| 方式 | 初始化 | 销毁 | 侵入性 | 推荐度 |
| --- | --- | --- | --- | --- |
| **注解** | `@PostConstruct` | `@PreDestroy` | ★ **无**（JSR-250 标准注解） | ⭐⭐⭐⭐⭐ **首选** |
| **接口** | `InitializingBean` | `DisposableBean` | 有（要实现 Spring 接口） | ⭐⭐⭐ |
| **配置** | `@Bean(initMethod=)` / XML | `@Bean(destroyMethod=)` | ★ **无**（第三方类唯一选择） | ⭐⭐⭐⭐ 第三方类用 |

> 【规范】**自己的类用 `@PostConstruct`/`@PreDestroy`（无侵入）；第三方类无法改源码，用 `@Bean(initMethod/destroyMethod)`。**
>
> 【坑】`@PostConstruct`/`@PreDestroy` 在 JDK 11 被移出 JDK（属 Java EE），Spring Boot 3 中由 `jakarta.annotation-api` 提供（spring-boot-starter 已传递依赖，一般无需手动加）。若报找不到，加：
> ```xml
> <dependency><groupId>jakarta.annotation</groupId><artifactId>jakarta.annotation-api</artifactId></dependency>
> ```

### 1.3 BeanPostProcessor（★ Spring 扩展性的核心）

**BeanPostProcessor（BPP）是 Spring 最强大的扩展点，AOP、@Autowired、@Async、@Transactional 全靠它实现。它作用于「每个 Bean 的初始化前后」。**

```java
public interface BeanPostProcessor {
    /** ★ 初始化【前】调用（在 @PostConstruct 之前） */
    default Object postProcessBeforeInitialization(Object bean, String beanName) {
        return bean;                       // 返回 null 会中断后续处理！通常返回 bean 或代理
    }
    /** ★ 初始化【后】调用（在 afterPropertiesSet/init-method 之后）—— ★ AOP 代理在这里生成 */
    default Object postProcessAfterInitialization(Object bean, String beanName) {
        return bean;
    }
}
```

```java
// ─── 自定义 BPP 示例 1：为所有 Bean 打印创建日志 ───
@Component
@Slf4j
public class BeanLogPostProcessor implements BeanPostProcessor {
    @Override
    public Object postProcessBeforeInitialization(Object bean, String name) {
        log.debug("Bean 初始化前：{}", name);
        return bean;
    }
    @Override
    public Object postProcessAfterInitialization(Object bean, String name) {
        log.debug("Bean 初始化后：{} ({})", name, bean.getClass().getSimpleName());
        return bean;
    }
}

// ─── 自定义 BPP 示例 2：自动填充公共字段（如创建人、创建时间）───
@Component
public class AuditFieldPostProcessor implements BeanPostProcessor {
    @Override
    public Object postProcessBeforeInitialization(Object bean, String name) {
        // 为所有实现了 Auditable 接口的 Bean 注入审计器
        if (bean instanceof Auditable auditable) {
            auditable.setAuditor(new SystemAuditor());
        }
        return bean;
    }
}

// ─── 自定义 BPP 示例 3：★ 模拟 @Autowired 的原理（理解 Spring 如何注入）───
@Component
public class MyAutowiredPostProcessor implements BeanPostProcessor {
    private final BeanFactory beanFactory;
    public MyAutowiredPostProcessor(BeanFactory beanFactory) { this.beanFactory = beanFactory; }

    @Override
    public Object postProcessBeforeInitialization(Object bean, String name) {
        // 遍历所有字段，找到 @MyInject 注解的字段，反射注入
        for (Field field : bean.getClass().getDeclaredFields()) {
            if (field.isAnnotationPresent(MyInject.class)) {
                Object dependency = beanFactory.getBean(field.getType());   // 从容器找
                field.setAccessible(true);
                try {
                    field.set(bean, dependency);                            // ★ 反射赋值
                } catch (IllegalAccessException e) {
                    throw new BeanCreationException(name, "注入失败", e);
                }
            }
        }
        return bean;
    }
}
// 这就是 AutowiredAnnotationBeanPostProcessor 的简化版原理！
```

**Spring 内置的关键 BeanPostProcessor（★ 必知）：**

| BeanPostProcessor | 作用 | 阶段 |
| --- | --- | --- |
| **`AutowiredAnnotationBeanPostProcessor`** | 处理 `@Autowired`、`@Value`、`@Inject` | postProcessProperties（属性填充） |
| **`CommonAnnotationBeanPostProcessor`** | 处理 `@Resource`、`@PostConstruct`、`@PreDestroy` | 属性填充 + 初始化前后 |
| **`AnnotationAwareAspectJAutoProxyCreator`** | ★★ **AOP：创建代理对象** | postProcessAfterInitialization |
| `ApplicationContextAwareProcessor` | 处理各种 `Aware` 接口 | postProcessBeforeInitialization |
| `ApplicationListenerDetector` | 检测 Bean 是否为事件监听器 | 初始化前后 |
| `ServletContextAwareProcessor` | Web 环境的 Aware | 前置 |
| `ConfigurationClassPostProcessor` | ★ 解析 `@Configuration`（严格说是 BeanFactoryPostProcessor） | refresh 阶段 |

> 【关键】**AOP 代理是在 `postProcessAfterInitialization` 中创建的**，此时 Bean 已经完成实例化、属性注入、初始化。所以：
> - `@PostConstruct` 中的 `this` 是**原始对象**，不是代理对象（切面不生效）。
> - 这就是「自调用（this.method()）导致 AOP 失效」的根本原因（见 [[后端/Spring/AOP面向切面编程]]）。

### 1.4 BeanFactoryPostProcessor（★ 修改 BeanDefinition）

**BeanFactoryPostProcessor（BFPP）作用于「BeanDefinition 加载后、Bean 实例化前」，可以修改 Bean 的定义（元数据），而非 Bean 实例。**

```java
public interface BeanFactoryPostProcessor {
    /** ★ 在所有 BeanDefinition 加载完成、Bean 实例化之前调用 */
    void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException;
}

// 它的子接口：可以【新增/删除】BeanDefinition
public interface BeanDefinitionRegistryPostProcessor extends BeanFactoryPostProcessor {
    void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry);   // ★ 更早，可注册新 BD
}
```

| 对比 | BeanFactoryPostProcessor | **BeanPostProcessor** |
| --- | --- | --- |
| 作用对象 | **BeanDefinition（元数据）** | **Bean 实例** |
| 执行时机 | 实例化**之前**（refresh 步骤 ⑤） | 每个 Bean 初始化前后（步骤 ⑦⑩） |
| 执行次数 | **整个容器一次** | **每个 Bean 一次** |
| 典型用途 | 修改属性、注册新 Bean 定义、占位符替换 | 依赖注入、AOP 代理、Aware 回调 |
| 内置实现 | `ConfigurationClassPostProcessor`（解析注解）、`PropertySourcesPlaceholderConfigurer`（`${}`）、`MapperScannerConfigurer`（MyBatis） | `AutowiredAnnotationBeanPostProcessor`、`AnnotationAwareAspectJAutoProxyCreator` |

```java
// ─── BFPP 示例：修改所有 Bean 的作用域 / 属性 ───
@Component
public class MyBeanFactoryPostProcessor implements BeanFactoryPostProcessor {
    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory bf) {
        for (String name : bf.getBeanDefinitionNames()) {
            BeanDefinition bd = bf.getBeanDefinition(name);
            // 例：把所有 com.example 下的 Bean 设为懒加载
            if (bd.getBeanClassName() != null && bd.getBeanClassName().startsWith("com.example")) {
                bd.setLazyInit(true);
            }
            // 例：修改属性值
            bd.getPropertyValues().add("timeout", "5000");
        }
    }
}

// ─── BeanDefinitionRegistryPostProcessor 示例：动态注册 Bean ───
@Component
public class DynamicBeanRegistrar implements BeanDefinitionRegistryPostProcessor {
    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {
        // ★ 动态注册一个 Bean（MyBatis 的 Mapper 接口就是这么被注册成 Bean 的）
        for (String mapperName : scanMapperInterfaces()) {
            BeanDefinitionBuilder builder = BeanDefinitionBuilder
                    .genericBeanDefinition(MapperFactoryBean.class);
            builder.addPropertyValue("mapperInterface", mapperName);
            builder.addConstructorArgValue(mapperName);
            registry.registerBeanDefinition(mapperName, builder.getBeanDefinition());
        }
    }
    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory bf) { }
}
// ★ MyBatis 的 Mapper 接口没有实现类却能被注入，就是靠这个机制
//   （MapperFactoryBean 是 FactoryBean，getObject() 返回 JDK 动态代理的 Mapper）
```

> 【坑】**BFPP 的 @Bean 方法必须声明为 `static`**：
> ```java
> @Bean
> public static PropertySourcesPlaceholderConfigurer configurer() { ... }   // ★ static
> ```
> 因为 BFPP 在容器极早期执行，此时配置类本身还没被实例化。如果 BFPP 的 @Bean 是非静态方法，Spring 为了调用它必须提前实例化配置类，导致配置类的 `@Autowired`/`@Value` 失效，并打印警告：
> `@Bean method XxxConfigurer is non-static and returns an object assignable to BeanFactoryPostProcessor... will not be processed for @Autowired`。

### 1.5 FactoryBean（★ 定制 Bean 的创建）

**FactoryBean 是一个「能生产其他 Bean 的 Bean」，用于封装复杂的实例化逻辑。**

```java
public interface FactoryBean<T> {
    T getObject() throws Exception;          // ★ 返回真正要用的对象
    Class<?> getObjectType();                 // 返回对象的类型
    default boolean isSingleton() { return true; }
}

// ─── 示例：创建复杂的连接对象 ───
@Component
public class ConnectionFactoryBean implements FactoryBean<Connection> {
    @Value("${db.url}") private String url;
    @Value("${db.driver}") private String driver;

    @Override
    public Connection getObject() throws Exception {
        // ★ 复杂的创建逻辑（加载驱动、建连接、配参数）
        Class.forName(driver);
        Connection conn = DriverManager.getConnection(url, props);
        conn.setAutoCommit(false);
        return conn;                            // ★ 返回的对象才是注入到别处的
    }
    @Override
    public Class<?> getObjectType() { return Connection.class; }
    @Override
    public boolean isSingleton() { return true; }
}

// ─── 使用（★ 关键：getBean 拿到的是 getObject() 的返回值，不是 FactoryBean 本身）───
@Autowired
private Connection connection;                  // ★ 注入的是 getObject() 返回的 Connection

Connection conn = ctx.getBean("connectionFactoryBean", Connection.class);   // ★ 拿到 Connection
Object factory = ctx.getBean("&connectionFactoryBean");   // ★ 加 & 前缀才拿到 FactoryBean 本身
```

| | `getBean("xxx")` | `getBean("&xxx")` |
| --- | --- | --- |
| xxx 是普通 Bean | 返回该 Bean | 报错（& 只对 FactoryBean 有意义） |
| xxx 是 FactoryBean | ★ 返回 `getObject()` 的产物 | ★ 返回 FactoryBean 本身 |

**FactoryBean 的框架应用：**

| FactoryBean | 产出的 Bean | 框架 |
| --- | --- | --- |
| `MapperFactoryBean` | ★ MyBatis 的 Mapper 代理对象 | MyBatis-Spring |
| `SqlSessionFactoryBean` | `SqlSessionFactory` | MyBatis-Spring |
| `ProxyFactoryBean` | AOP 代理对象 | Spring AOP |
| `LocalSessionFactoryBean` | `SessionFactory` | Hibernate |
| `JpaVendorAdapter` 相关 | JPA 的 `EntityManagerFactory` | Spring Data JPA |
| `FeignClientFactoryBean` | ★ OpenFeign 的 Feign 客户端代理 | Spring Cloud OpenFeign |

> 【面试】**BeanFactory vs FactoryBean（★ 名字像但完全不同）**：
> - **BeanFactory**：Spring IoC 容器的**顶层接口**，管理所有 Bean（是「工厂」本身）。
> - **FactoryBean**：一个**特殊的 Bean**，它能生产另一个 Bean（是「会下蛋的鸡」）。用 `&` 前缀区分拿到 FactoryBean 本身还是它的产物。
> - 一句话：**BeanFactory 是容器，FactoryBean 是容器里的一个能生产对象的对象。**

## 2. Bean 的作用域（Scope）★★★★★

### 2.1 五种作用域

| Scope | 说明 | 生命周期 | 适用 |
| --- | --- | --- | --- |
| **`singleton`**（默认）★ | **整个容器只有一个实例** | 随容器创建和销毁 | 99% 的 Bean（Service、Dao、工具） |
| **`prototype`** | **每次 getBean 都创建新实例** | 容器不管理销毁（创建后即「脱管」） | 有状态对象、每次需独立的对象 |
| **`request`** | 每个 **HTTP 请求**一个实例 | 请求结束销毁 | Web 环境（请求上下文） |
| **`session`** | 每个 **HTTP Session** 一个实例 | Session 失效销毁 | Web 环境（用户会话） |
| **`application`** | 每个 **ServletContext** 一个实例 | 应用关闭销毁 | Web 环境（≈ singleton，但在多 ServletContext 时不同） |
| `websocket` | 每个 WebSocket 会话一个实例 | 会话结束销毁 | WebSocket 环境 |

```java
// ─── 声明作用域 ───
@Component
@Scope("prototype")                            // 字符串
public class PrototypeBean { }

@Component
@Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)   // 常量（推荐，类型安全）
public class PrototypeBean2 { }

@Scope(value = WebApplicationContext.SCOPE_REQUEST,
       proxyMode = ScopedProxyMode.TARGET_CLASS)  // ★ request/session 需要代理模式
@Component
public class RequestBean { }

@Bean
@Scope("session")
public SessionData sessionData() { return new SessionData(); }
```

### 2.2 singleton 与 prototype 的关键差异（★ 大坑）

```java
// ─── singleton：容器管理完整生命周期 ───
@Component
public class SingletonBean {
    @PostConstruct public void init() { }        // ✅ 会执行
    @PreDestroy public void destroy() { }        // ✅ 容器关闭时会执行
}

// ─── prototype：容器只负责创建，不负责销毁！───
@Component
@Scope("prototype")
public class PrototypeBean {
    @PostConstruct public void init() { }        // ✅ 会执行
    @PreDestroy public void destroy() { }        // ❌★ 永远不会执行！
}
// ★ prototype 的 @PreDestroy/DisposableBean/destroy-method 都不会被调用！
// 原因：容器创建完 prototype 就「放手」了，不再持有引用，无法在关闭时回调销毁方法
// 后果：如果 prototype 持有资源（连接、文件），会资源泄漏！
// 解决：手动销毁，或用 DisposableBeanAdapter + 自定义销毁逻辑

// ─── ★★ 最大的坑：singleton 注入 prototype ───
@Component                                        // 默认 singleton
public class SingletonService {
    @Autowired
    private PrototypeBean prototypeBean;           // ★ 只会注入【一次】！
    // 之后每次用 prototypeBean 都是【同一个对象】，prototype 失效了！
}
// 原因：singleton 只创建一次，注入也只发生一次，prototype 的「每次新建」语义被破坏

// ─── 解决方案 ───
// ✅ 方案 1：ObjectProvider / ObjectFactory（★ 推荐）
@Component
public class SingletonService {
    private final ObjectProvider<PrototypeBean> provider;
    public SingletonService(ObjectProvider<PrototypeBean> provider) { this.provider = provider; }
    public void use() {
        PrototypeBean bean = provider.getObject();      // ★ 每次都拿到新实例
    }
}

// ✅ 方案 2：@Lookup 方法注入（CGLIB 重写方法）
@Component
public abstract class SingletonService {
    @Lookup                                          // ★ Spring 用 CGLIB 动态实现此方法
    public abstract PrototypeBean createPrototype();    // 每次调用返回新实例
    public void use() {
        PrototypeBean bean = createPrototype();         // ★ 新实例
    }
}

// ✅ 方案 3：@Scope + proxyMode（注入的是代理，每次方法调用转发给新实例）
@Component
@Scope(value = "prototype", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class PrototypeBean { }
// 注入的是 CGLIB 代理，每次调用代理的方法都会 getBean 一个新实例

// ✅ 方案 4：ApplicationContext 主动获取（不推荐，侵入性强）
@Component
public class SingletonService implements ApplicationContextAware {
    private ApplicationContext ctx;
    @Override public void setApplicationContext(ApplicationContext c) { this.ctx = c; }
    public void use() {
        PrototypeBean bean = ctx.getBean(PrototypeBean.class);   // 每次新建
    }
}
```

**proxyMode 的两种模式：**

| 模式 | 说明 |
| --- | --- |
| `ScopedProxyMode.NO` | 不代理（默认） |
| `ScopedProxyMode.INTERFACES` | JDK 动态代理（需接口） |
| **`ScopedProxyMode.TARGET_CLASS`** | ★ CGLIB 代理（无需接口，推荐） |

```java
// request/session 作用域为什么【必须】用 proxyMode？
// 因为 singleton 的 Service 在启动时创建，但此时还没有 HTTP 请求（没有 request 作用域的 Bean）
// 若直接注入会报错：No thread-bound request found
// 解决：注入一个「代理」，代理在【方法调用时】才从当前请求上下文中解析真正的 Bean
@Component
@Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class RequestScopedBean { }

@Component
public class MyService {
    @Autowired
    private RequestScopedBean requestBean;      // ★ 注入的是代理，运行时解析到当前请求的实例
}
```

## 3. 单例 Bean 的线程安全 ★★★★★

**Spring 的 Bean 默认是单例的，多线程共享同一个实例 → 必须考虑线程安全！**

```java
// ─── ❌ 危险：单例 Bean 中的可变实例变量 ───
@Service
public class UnsafeService {
    private int count = 0;                    // ★ 可变状态，多线程共享 → 竞态条件！
    private User currentUser;                 // ★★ 灾难：用户 A 的数据被用户 B 覆盖
    private List<String> cache = new ArrayList<>();   // ★ 非线程安全集合

    public void process(User user) {
        this.currentUser = user;              // 线程 A 设置后，线程 B 可能覆盖
        count++;                               // 非原子操作，丢失更新
        doSomething(currentUser);              // ★ 可能读到别的用户！
    }
}

// ─── ✅ 安全方案 1：无状态（★ 最佳，Spring Bean 应该无状态）───
@Service
public class SafeService {
    // ★ 没有可变的实例字段，所有状态都是方法内的局部变量（线程私有）
    private final UserDao userDao;            // final 依赖，不可变 → 安全

    public SafeService(UserDao userDao) { this.userDao = userDao; }

    public void process(User user) {
        int localVar = 0;                      // ★ 局部变量在栈上，线程私有 → 安全
        List<String> localList = new ArrayList<>();
        doSomething(user, localVar, localList);
    }
}

// ─── ✅ 安全方案 2：final 不可变对象 ───
@Service
public class ImmutableService {
    private final Config config;               // ★ final + 不可变对象 → 线程安全
    private final Map<String, String> constantMap = Map.of("a", "1");   // 不可变集合

    public ImmutableService() { this.config = loadConfig(); }   // 构造时初始化，之后只读
}

// ─── ✅ 安全方案 3：ThreadLocal（每线程一份）───
@Service
public class ContextService {
    private static final ThreadLocal<User> HOLDER = new ThreadLocal<>();   // ★ 线程隔离
    public void set(User u) { HOLDER.set(u); }
    public User get() { return HOLDER.get(); }
    public void clear() { HOLDER.remove(); }   // ★ 必须清理（见 JUC 篇的内存泄漏）
}

// ─── ✅ 安全方案 4：并发工具类 ───
@Service
public class CounterService {
    private final AtomicInteger count = new AtomicInteger();       // ★ 原子类
    private final LongAdder fastCount = new LongAdder();           // 高并发计数
    private final Map<String, Object> cache = new ConcurrentHashMap<>();   // ★ 并发容器
    private final List<String> list = new CopyOnWriteArrayList<>();
    public void inc() { count.incrementAndGet(); }
}

// ─── ✅ 安全方案 5：加锁（不推荐，丧失并发能力）───
@Service
public class LockedService {
    private int count;
    public synchronized void inc() { count++; }   // ★ 串行化，性能差
}

// ─── ✅ 安全方案 6：改用 prototype（每请求一个实例，但要处理销毁）───
@Service
@Scope("prototype")
public class StatefulService {
    private int count;                            // prototype 下每次新建，无共享 → 安全
}
```

**线程安全的判断标准：**

| Bean 中的字段 | 是否线程安全 |
| --- | --- |
| 局部变量 | ✅ 安全（栈上，线程私有） |
| `final` 且指向不可变对象 | ✅ 安全 |
| 注入的依赖（Service/Dao，本身无状态） | ✅ 安全 |
| **可变的实例字段**（int、List、自定义对象） | ❌ **不安全** |
| `static` 可变字段 | ❌ **不安全** |
| `AtomicXxx` / 并发容器 / ThreadLocal | ✅ 安全 |

> 【结论】**Spring 的 Service/Controller/Dao 默认单例，应该设计成「无状态」的**：只持有 final 的依赖（本身也无状态），所有业务状态用局部变量或方法参数传递。这样天然线程安全，也是 Spring 的设计前提。

## 4. 实战：Bean 生命周期的应用

```java
// ─── 应用 1：@PostConstruct 做缓存预热 / 资源初始化 ───
@Service
@Slf4j
public class DictCacheService {
    private final DictMapper dictMapper;
    private final Map<String, Dict> cache = new ConcurrentHashMap<>();

    public DictCacheService(DictMapper dictMapper) { this.dictMapper = dictMapper; }

    @PostConstruct                                       // ★ 容器启动后立即加载字典到内存
    public void init() {
        log.info("开始预热字典缓存...");
        List<Dict> all = dictMapper.selectAll();
        all.forEach(d -> cache.put(d.getCode(), d));
        log.info("字典缓存预热完成，共 {} 条", cache.size());
    }

    @PreDestroy                                          // ★ 关闭时清理
    public void destroy() {
        cache.clear();
        log.info("字典缓存已清理");
    }

    public Dict get(String code) { return cache.get(code); }
}

// ─── 应用 2：SmartInitializingSingleton（所有单例创建完成后执行）───
@Component
public class AllBeansReadyProcessor implements SmartInitializingSingleton {
    @Override
    public void afterSingletonsInstantiated() {
        // ★ 在【所有】单例 Bean 都初始化完成后调用（比 @PostConstruct 晚）
        // 适合：需要依赖其他所有 Bean 都就绪的初始化（如构建路由表、注册所有策略）
        log.info("所有 Bean 已就绪，开始构建路由表");
    }
}

// ─── 应用 3：InitializingBean + DisposableBean 管理资源 ───
@Component
public class ThreadPoolBean implements InitializingBean, DisposableBean {
    private ThreadPoolExecutor executor;

    @Override
    public void afterPropertiesSet() {                   // 初始化线程池
        executor = new ThreadPoolExecutor(10, 50, 60, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(1000), new NamedThreadFactory("biz"));
    }
    @Override
    public void destroy() {                              // ★ 优雅关闭线程池
        executor.shutdown();
        try {
            if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
    public void submit(Runnable task) { executor.submit(task); }
}

// ─── 应用 4：ApplicationRunner / CommandLineRunner（★ Spring Boot 启动后执行）───
@Component
@Order(1)                                                // 多个 Runner 的执行顺序
public class DataInitRunner implements ApplicationRunner {
    @Override
    public void run(ApplicationArguments args) {          // ★ 容器完全启动后执行一次
        log.info("应用启动完成，初始化基础数据");
        // 参数：args.getOptionNames()、args.getOptionValues("key")、args.getSourceArgs()
    }
}

@Component
public class CmdRunner implements CommandLineRunner {
    @Override
    public void run(String... args) {                     // 原始参数数组
        log.info("启动参数：{}", Arrays.toString(args));
    }
}
// ApplicationRunner vs CommandLineRunner：前者封装了参数（能区分 --key=value），后者是原始数组
// 执行时机：都在 refresh() 完成后、应用「就绪」时执行，早于 ApplicationReadyEvent

// ─── 应用 5：监听容器事件 ───
@Component
public class StartupListener {
    @EventListener(ApplicationReadyEvent.class)           // ★ 应用完全就绪（可对外服务）
    public void onReady() { log.info("应用就绪，可以接收流量"); }

    @EventListener(ContextRefreshedEvent.class)           // 容器刷新完成
    public void onRefreshed(ApplicationEvent e) { }

    @EventListener(ContextClosedEvent.class)              // 容器关闭
    public void onClosed() { log.info("容器关闭中"); }

    @EventListener                                        // 自定义业务事件
    @Async                                                // ★ 异步执行，不阻塞主流程
    public void onOrderCreated(OrderCreatedEvent event) { }
}
```

**容器启动的事件顺序（★ Spring Boot）：**

```
ApplicationStartingEvent              应用开始启动（还没创建容器）
    ↓
ApplicationEnvironmentPreparedEvent   环境准备好（配置已加载，容器未创建）
    ↓
ApplicationContextInitializedEvent    上下文初始化（BeanDefinition 加载前）
    ↓
ApplicationPreparedEvent              上下文准备好（BeanDefinition 已加载，未 refresh）
    ↓
ApplicationStartedEvent               ★ 容器 refresh 完成，Runner 执行前
    ↓
（执行 ApplicationRunner / CommandLineRunner）
    ↓
ApplicationReadyEvent                 ★★ 应用完全就绪，可对外服务（最常用）
    ↓
（应用运行中...）
    ↓
ContextClosedEvent / ApplicationShutdownEvent   关闭
```

## 5. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 三种初始化方式顺序记错 | 面试/排查困惑 | @PostConstruct → afterPropertiesSet → init-method |
| 2 | prototype 的 @PreDestroy 不执行 | 资源泄漏 | 手动销毁；prototype 不持有资源 |
| 3 | singleton 注入 prototype | prototype 只创建一次，语义失效 | `ObjectProvider` / `@Lookup` / proxyMode |
| 4 | 单例 Bean 有可变实例字段 | ★ 线程不安全，数据串号 | 无状态设计；局部变量；ThreadLocal；并发容器 |
| 5 | `@PostConstruct` 中用 `this` 调本类被 AOP 增强的方法 | 切面不生效 | 此时还是原始对象，代理在初始化后才生成 |
| 6 | BFPP 的 @Bean 非 static | 配置类提前实例化，@Value 失效 | 声明为 static |
| 7 | `@PostConstruct` 找不到（JDK 11+） | 编译错误 | 加 jakarta.annotation-api 依赖 |
| 8 | request/session Bean 未配 proxyMode | 启动报「No thread-bound request」 | `@Scope(proxyMode=TARGET_CLASS)` |
| 9 | 构造器中依赖未注入就用 | NPE | 初始化逻辑放 @PostConstruct，不放构造器 |
| 10 | `getBean` 拿 FactoryBean 得到产物 | 想拿 FactoryBean 本身却拿到产品 | 用 `&beanName` |
| 11 | 忘记 Bean 名称规则 | getBean 找不到 | 默认类名首字母小写；@Component("x") 自定义 |
| 12 | 两个 Bean 同名（不同包） | `ConflictingBeanDefinitionException` | 显式指定名称，或自定义 BeanNameGenerator |
| 13 | 循环依赖（构造器） | `BeanCurrentlyInCreationException` | 见 [[后端/Spring/循环依赖与三级缓存]] |
| 14 | `@Async`/`@Transactional` 同类调用失效 | 切面不生效 | 代理机制导致，拆类或注入自身 |
| 15 | ApplicationRunner 中依赖的 Bean 未就绪 | NPE | Runner 在所有 Bean 就绪后执行，一般无此问题；跨 Runner 依赖用 @Order |
| 16 | SmartInitializingSingleton vs @PostConstruct 时机混淆 | 初始化顺序错 | SIPS 在所有单例后执行，@PostConstruct 在当前 Bean 初始化时 |
| 17 | prototype Bean 期望容器管理销毁 | 资源不释放 | 容器不管 prototype 销毁，需手动 |
| 18 | 大量 prototype Bean | GC 压力大 | 评估是否真需要 prototype，多数用 singleton 即可 |
| 19 | ThreadLocal 在单例 Bean 中未清理 | 内存泄漏 + 数据串号 | 用完 remove（线程池场景尤其重要） |
| 20 | @Scope 加在 @Bean 方法但类上也有 | 作用域冲突 | 以一处为准，避免重复声明 |

---

## 关联笔记

- 上一篇：[[后端/Spring/Spring概述与IoC容器]]
- 下一篇：[[后端/Spring/循环依赖与三级缓存]]
- 相关：[[后端/Spring/AOP面向切面编程]]（代理在 postProcessAfterInitialization 生成）、[[后端/Spring/动态代理-JDK与CGLIB]]
- 并发安全：[[后端/Java基础/并发编程/线程安全与synchronized]]、[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]（ThreadLocal）
- Boot：[[后端/SpringBoot/自动配置原理]]（条件注解与 BeanFactoryPostProcessor）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
