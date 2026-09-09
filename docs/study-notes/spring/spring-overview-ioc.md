---
title: "Spring概述与IoC容器"
aliases:
  - "Spring IoC"
  - "依赖注入"
  - "ApplicationContext"
tags:
  - "后端"
  - "java"
  - "spring"
  - "面试"
category: "后端"
folder: "Spring"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Spring/Bean生命周期与作用域]]"
  - "[[后端/Spring/循环依赖与三级缓存]]"
  - "[[后端/Spring/Spring注解大全与配置类]]"
  - "[[后端/SpringBoot/自动配置原理]]"
created: 2026-09-07
updated: 2026-09-07
---

# Spring 概述与 IoC 容器

## 1. Spring 是什么

**Spring 是一个「轻量级的 Java 开发框架」**，核心是 **IoC（控制反转）** 和 **AOP（面向切面编程）**，通过「约定 + 声明式配置」把开发者从繁琐的底层技术中解放出来。

### 1.1 Spring 解决什么问题

```java
// ─── 没有 Spring 的年代（EJB 2.x / 纯 Servlet）───
public class OrderServlet extends HttpServlet {
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) {
        // ① 手动创建依赖（强耦合，换实现要改代码）
        Connection conn = null;
        try {
            conn = DriverManager.getConnection(url, user, pwd);        // 手动管理连接
            conn.setAutoCommit(false);                                   // 手动管理事务

            UserDao userDao = new UserDaoImpl(conn);                     // 手动 new
            UserService userService = new UserServiceImpl(userDao);      // 手动 new
            OrderDao orderDao = new OrderDaoImpl(conn);
            OrderService orderService = new OrderServiceImpl(orderDao, userService);

            // ② 手动解析参数、类型转换
            Long userId = Long.parseLong(req.getParameter("userId"));
            BigDecimal amount = new BigDecimal(req.getParameter("amount"));

            // ③ 业务逻辑
            Order order = orderService.create(userId, amount);

            // ④ 手动提交事务
            conn.commit();

            // ⑤ 手动写 JSON
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write("{\"code\":0,\"orderId\":" + order.getId() + "}");

        } catch (SQLException e) {
            try { if (conn != null) conn.rollback(); } catch (SQLException ignored) {}   // ⑥ 手动回滚
            throw new ServletException(e);
        } finally {
            try { if (conn != null) conn.close(); } catch (SQLException ignored) {}      // ⑦ 手动关连接
        }
    }
}

// ─── 有 Spring 之后 ───
@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;        // ① ★ 依赖注入，无需 new

    @PostMapping
    public Result<Long> create(@RequestBody @Valid OrderCreateDTO dto) {   // ② ★ 自动解析+校验
        return Result.success(orderService.create(dto));                    // ③ 只写业务
    }
}

@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderMapper orderMapper;          // ★ 注入（MyBatis 动态代理生成）
    private final UserService userService;          // ★ 注入接口，运行时决定实现（多态）

    @Override
    @Transactional(rollbackFor = Exception.class)    // ④ ★ 声明式事务（自动提交/回滚）
    public Long create(OrderCreateDTO dto) {
        Order order = Order.builder()
                .userId(dto.getUserId())
                .amount(dto.getAmount())
                .status(OrderStatus.PENDING)
                .build();
        orderMapper.insert(order);                   // ⑤ 连接池自动管理，无需 close
        userService.addPoints(dto.getUserId(), dto.getAmount());
        return order.getId();
    }
}
// 代码量减少 80%，且职责清晰、可测试、可扩展
```

**Spring 解决的核心痛点：**

| 痛点 | Spring 的方案 |
| --- | --- |
| **对象耦合严重**（到处 new） | ★ **IoC 容器**：对象由容器创建和管理，通过 DI 注入 |
| **横切关注点重复**（日志、事务、权限散落在每个方法） | ★ **AOP**：抽取为切面，声明式织入 |
| **事务管理繁琐**（手动 begin/commit/rollback/close） | ★ **声明式事务** `@Transactional` |
| **Web 层样板代码多**（解析参数、写 JSON、异常处理） | ★ **Spring MVC**：注解驱动 |
| **数据访问重复**（JDBC 模板代码） | **Spring JDBC / JdbcTemplate**、集成 ORM |
| **技术整合困难**（每个框架一套配置） | ★ **统一的配置和生命周期管理** |
| **测试困难**（依赖硬编码无法 mock） | IoC 让依赖可替换 + **Spring Test** |

### 1.2 Spring 全家桶（模块划分）

```
┌──────────────────────────────────────────────────────────────────┐
│                        Spring 生态全景                              │
├──────────────────────────────────────────────────────────────────┤
│  ★ 应用层                                                          │
│  Spring Boot（自动配置、起步依赖、内嵌容器、Actuator）                  │
│  Spring Cloud（微服务：Gateway、OpenFeign、Config、Stream）           │
│  Spring Cloud Alibaba（Nacos、Sentinel、Seata、RocketMQ）            │
├──────────────────────────────────────────────────────────────────┤
│  ★ Web / 表现层                                                     │
│  Spring MVC（Servlet Web）  Spring WebFlux（响应式）                  │
│  Spring WebSocket  Spring GraphQL  Spring HATEOAS                    │
├──────────────────────────────────────────────────────────────────┤
│  ★ 数据访问层                                                       │
│  Spring JDBC（JdbcTemplate）  Spring ORM（Hibernate/JPA 整合）        │
│  Spring Data（JPA / Redis / MongoDB / Elasticsearch 统一抽象）        │
│  Spring Transaction（★ 事务抽象，声明式事务的基础）                     │
├──────────────────────────────────────────────────────────────────┤
│  ★ 安全 / 集成                                                      │
│  Spring Security（认证授权）  Spring OAuth2  Spring Session           │
│  Spring Integration  Spring Batch（批处理）  Spring AMQP（RabbitMQ）   │
│  Spring Kafka  Spring for Apache Pulsar                              │
├──────────────────────────────────────────────────────────────────┤
│  ★★ 核心容器（Core Container）—— 一切的基石                          │
│  spring-core（工具类、资源抽象、SpEL）                                 │
│  spring-beans（★ BeanFactory、Bean 定义与解析）                       │
│  spring-context（★ ApplicationContext、事件、国际化、校验）            │
│  spring-aop（★ AOP 实现）  spring-expression（SpEL）                 │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Spring 版本演进

| 版本 | 年份 | 关键变化 | JDK 要求 |
| --- | --- | --- | --- |
| Spring 1.0 | 2004 | 首发，IoC + AOP | JDK 1.3 |
| Spring 2.5 | 2007 | ★ **注解驱动**（`@Autowired`、`@Component`、`@Controller`） | JDK 5 |
| Spring 3.0 | 2009 | ★ **JavaConfig**（`@Configuration`、`@Bean`）、REST 支持、SpEL | JDK 5 |
| Spring 4.0 | 2013 | Java 8 支持、WebSocket、`@Conditional` | JDK 6 |
| **Spring 5.0** | 2017 | ★ **WebFlux 响应式**、Kotlin 支持、JDK 9 支持 | **JDK 8** |
| Spring 5.3 | 2020 | 长期维护版本（Spring Boot 2.x 配套） | JDK 8 |
| **Spring 6.0** | 2022 | ★★ **Jakarta EE 9（javax→jakarta）**、JDK 17 基线、AOT/Native | **JDK 17** |
| Spring 6.1 | 2023 | ★ **虚拟线程支持**、RestClient、JSpecify | JDK 17 |
| Spring 6.2 | 2024 | API 版本控制、SSL Bundles 热重载 | JDK 17 |
| Spring 7.0 | 2025 | API 版本控制增强、JSpecify 空安全、JDK 17+ | JDK 17 |

**Spring Boot 与 Spring 的对应关系（★ 必须匹配，否则各种诡异报错）：**

| Spring Boot | Spring Framework | JDK | Servlet | Tomcat | 包名 |
| --- | --- | --- | --- | --- | --- |
| 2.7.x（最后的 2.x） | 5.3.x | 8+ | 4.0 | 9.x | `javax.*` |
| **3.0.x ~ 3.1.x** | 6.0.x | **17+** | 6.0 | 10.1 | `jakarta.*` |
| **3.2.x** | 6.1.x | 17+ | 6.0 | 10.1 | `jakarta.*` |
| 3.3.x ~ 3.4.x | 6.1.x/6.2.x | 17+ | 6.1 | 10.1/11 | `jakarta.*` |
| 4.0（2025.11） | 7.0 | **17+（推荐 21）** | 6.1 | 11.x | `jakarta.*` |

> 【强制】**升级 Spring Boot 3 的三大破坏性变更**：
> 1. **`javax.*` → `jakarta.*`**：所有 Servlet、Validation、Annotation、Persistence 的包名都要改。IDEA 有迁移工具（`Code → Migrate to Jakarta EE 9+`），或用 OpenRewrite 脚本自动转换。
> 2. **JDK 17 最低要求**：JDK 8/11 无法运行。
> 3. **第三方依赖要跟着升级**：Druid 1.2.20+、PageHelper 5.3.2+、MyBatis-Plus 3.5.3.1+、Shiro 1.11+、EasyExcel 3.3+、Knife4j 4.x（`knife4j-openapi3-jakarta-spring-boot-starter`）。

### 1.4 Spring 的设计哲学

| 原则 | 体现 |
| --- | --- |
| **面向接口编程** | 处处是接口（`BeanFactory`、`ApplicationContext`、`TransactionManager`），实现可替换 |
| **约定优于配置** | Spring Boot 的自动配置、默认值 |
| **POJO 优先** | 业务类不需要继承 Spring 的类（对比 EJB 必须继承 EntityBean） |
| **非侵入性** | 业务代码几乎不依赖 Spring API（除了注解） |
| **开闭原则** | `BeanPostProcessor`、`BeanFactoryPostProcessor` 等扩展点，不改源码就能扩展 |
| **模板方法模式** | `JdbcTemplate`、`RestTemplate`、`TransactionTemplate`（消除样板代码） |

## 2. IoC 与 DI ★★★★★

### 2.1 控制反转（Inversion of Control）

**IoC 的核心思想：把「创建对象和管理依赖」的控制权，从程序员手中交给容器。**

```java
// ─── 传统方式（正向控制）：我自己创建依赖 ───
public class OrderService {
    // ★ 我主动去创建（控制在我手里）
    private UserDao userDao = new UserDaoImpl();
    private PaymentClient payment = new AlipayClient();
}
// 问题：
// 1. OrderService 与 UserDaoImpl、AlipayClient 强耦合
// 2. 想换成微信支付要改代码 + 重新编译
// 3. 单元测试无法 mock（依赖是 new 出来的，换不掉）

// ─── IoC 方式（控制反转）：容器创建好，注入给我 ───
public class OrderService {
    private final UserDao userDao;              // ★ 我只声明「我需要什么」
    private final PaymentClient payment;

    public OrderService(UserDao userDao, PaymentClient payment) {   // 构造器注入
        this.userDao = userDao;
        this.payment = payment;
    }
}
// 控制权反转给了 Spring 容器：
// - 容器负责创建 UserDaoImpl（或其他实现）
// - 容器负责把它注入到 OrderService 中
// - OrderService 完全不知道具体实现类是谁
```

**「控制」和「反转」分别指什么（★ 面试必问）：**

| | 含义 |
| --- | --- |
| **控制** | 指「对象的创建、装配、生命周期管理」的权力 |
| **反转** | 从「程序自己主动创建（正向）」变成「被动接受容器注入（反向）」 |
| **正转** | `new UserDaoImpl()` —— 我在控制 |
| **反转** | 容器把创建好的对象给我 —— 容器在控制 |

> 【类比】
> - **正向**：你想吃pizza，自己买面粉、揉面、烤制（全流程自己控制，累且专业度低）。
> - **反转**：你想吃pizza，打电话订外卖，店家做好送来（你只声明需求，「怎么获得 pizza」的控制权交给了外卖平台）。

### 2.2 依赖注入（Dependency Injection）

**DI 是 IoC 的「实现手段」**：IoC 是思想（谁来控制），DI 是具体做法（怎么把依赖给进去）。

```java
// Martin Fowler 在 2004 年提出 DI 这个词，就是为了把 IoC 说得更清楚
// IoC 太抽象（"控制反转"到底反转了什么？），DI 明确了：是「依赖」被「注入」进来
```

**三种注入方式（★ 必考）：**

```java
// ─── ① 构造器注入（★★★ 强烈推荐，Spring 4.3+ 单构造器可省略 @Autowired）───
@Service
public class OrderService {

    private final UserDao userDao;                    // ★ final，不可变
    private final PaymentService paymentService;
    private final CacheService cacheService;

    // Spring 4.3+：只有一个构造器时，@Autowired 可省略
    @Autowired                                           // 可省略
    public OrderService(UserDao userDao,
                        PaymentService paymentService,
                        CacheService cacheService) {
        this.userDao = userDao;
        this.paymentService = paymentService;
        this.cacheService = cacheService;
    }
}

// ✅ 配合 Lombok 更简洁（★ 实际项目的标准写法）
@Service
@RequiredArgsConstructor              // ★ 自动为所有 final 字段生成构造器
public class OrderService {
    private final UserDao userDao;
    private final PaymentService paymentService;
    private final CacheService cacheService;
}

// 优点：
// 1. ★ 依赖不可变（final），线程安全
// 2. ★ 依赖不能为 null（对象创建完成即依赖齐全，不会出现 NPE）
// 3. ★ 强制暴露「依赖过多」的坏味道（构造器参数超过 5 个就该重构了）
// 4. ★ 易于单元测试（直接 new OrderService(mockDao, mockPayment)）
// 5. 能在构造器中做校验
public OrderService(@NonNull UserDao userDao) {
    this.userDao = Objects.requireNonNull(userDao, "userDao 不能为空");
}

// ─── ② Setter 注入（可选依赖、需要重新配置时用）───
@Service
public class NotifyService {

    private SmsClient smsClient;                        // 不能 final
    private EmailClient emailClient;

    @Autowired(required = false)                         // ★ required=false：找不到也不报错（可选依赖）
    public void setSmsClient(SmsClient smsClient) {
        this.smsClient = smsClient;
    }

    @Autowired
    public void setEmailClient(EmailClient emailClient) {
        this.emailClient = emailClient;
    }
}
// 优点：可选依赖、可重新注入、支持循环依赖（构造器注入的循环依赖无法解决）
// 缺点：不能 final、对象可能在依赖未注入时被使用（NPE 风险）

// ─── ③ 字段注入（★ 最常见但【不推荐】）───
@Service
public class BadService {
    @Autowired
    private UserDao userDao;                            // ★ 直接注入字段（反射赋值）

    @Autowired
    private PaymentService paymentService;
}
// ❌ 不推荐的原因：
// 1. 不能 final（依赖可变，线程安全隐患）
// 2. ★ 无法脱离容器使用（单元测试必须用反射或 @SpringBootTest，不能简单 new）
// 3. 隐藏依赖（看构造器不知道这个类依赖了什么）
// 4. 依赖过多时不会有「坏味道」警告（构造器参数太多会很显眼）
// 5. 循环依赖被掩盖（字段注入能绕过循环依赖检查，让设计问题潜伏）
// 6. IDEA 会警告："Field injection is not recommended"

// ─── 三种方式对比（★ 必背）───
```

| 对比项 | 构造器注入 ★ | Setter 注入 | 字段注入 |
| --- | --- | --- | --- |
| 是否可 final | ✅ **可以** | ❌ | ❌ |
| 依赖是否可能为 null | ❌ 不可能（构造完即齐全） | ✅ 可能 | ✅ 可能 |
| 循环依赖 | ❌ **报错**（好事，暴露设计问题） | ✅ 支持（三级缓存） | ✅ 支持 |
| 单元测试友好度 | ✅ **最好**（直接 new） | 中 | ❌ 差（需反射/容器） |
| 依赖过多的警示 | ✅ 构造器参数爆炸（促使重构） | ❌ 无感 | ❌ 无感 |
| 可选依赖 | ❌ 不方便 | ✅ **适合** | ✅ `required=false` |
| 代码量 | 多（Lombok 可解决） | 多 | **最少** |
| Spring 官方推荐 | ✅ **推荐** | 可选依赖时 | ❌ 不推荐 |
| 实现原理 | 反射调用构造器 | 反射调用 setter | ★ **反射直接给字段赋值** |

> 【规范】**一律用构造器注入 + `@RequiredArgsConstructor`（Lombok）**。这是 Spring 官方、阿里手册、以及所有代码审查工具的共识。字段注入只应在维护老代码时保留。

### 2.3 依赖查找 vs 依赖注入

```java
// ─── 依赖注入（DI，被动，★ 主流）───
@Autowired
private UserDao userDao;                 // 容器主动推给我（Push）

// ─── 依赖查找（Dependency Lookup，主动，IoC 的另一半）───
// ① 从 ApplicationContext 中主动获取
@Component
public class MyService implements ApplicationContextAware {
    private ApplicationContext ctx;
    @Override public void setApplicationContext(ApplicationContext ctx) { this.ctx = ctx; }

    public void doWork() {
        UserDao dao = ctx.getBean(UserDao.class);                    // ★ 主动拉取（Pull）
        UserDao dao2 = ctx.getBean("userDao", UserDao.class);         // 按名称 + 类型
        Map<String, UserDao> all = ctx.getBeansOfType(UserDao.class);  // ★ 获取所有实现（策略模式利器）
        String[] names = ctx.getBeanNamesForType(UserDao.class);
        String[] aliases = ctx.getAliases("userDao");
    }
}

// ② Aware 接口回调（Spring 提供的「受控的依赖查找」）
public class MyBean implements BeanNameAware, BeanFactoryAware, ApplicationContextAware,
                               EnvironmentAware, ResourceLoaderAware, ApplicationEventPublisherAware {
    @Override public void setBeanName(String name) { }              // 自己的 Bean 名称
    @Override public void setBeanFactory(BeanFactory bf) { }         // BeanFactory
    @Override public void setApplicationContext(ApplicationContext c) { }
    @Override public void setEnvironment(Environment env) { }
    @Override public void setResourceLoader(ResourceLoader rl) { }
    @Override public void setApplicationEventPublisher(ApplicationEventPublisher p) { }
}
// ⚠️ Aware 接口会让代码耦合 Spring API（侵入性），非必要不用

// ③ ObjectProvider（★ 优雅的可选依赖 / 延迟查找，Spring 4.3+）
@Service
public class OrderService {
    private final ObjectProvider<DiscountService> discountProvider;   // ★ 可以是可选依赖

    public OrderService(ObjectProvider<DiscountService> discountProvider) {
        this.discountProvider = discountProvider;
    }

    public BigDecimal calc(Order order) {
        // 优雅处理「Bean 可能不存在」的场景
        return discountProvider
                .getIfAvailable(() -> new DefaultDiscountService())   // 不存在则用默认实现
                .discount(order);
        // discountProvider.getIfUnique();          // 唯一时才返回，否则 null
        // discountProvider.getIfAvailable();       // 不存在返回 null
        // discountProvider.getObject();            // 不存在抛异常
        // discountProvider.stream().forEach(...);  // ★ 遍历所有实现（策略模式）
        // discountProvider.orderedStream();        // 按 @Order 排序的流
    }
}
// 优点：延迟解析（避免循环依赖）、可选依赖、支持多个 Bean 遍历，比 @Autowired(required=false) 更优雅
```

## 3. Spring 容器体系 ★★★★★

### 3.1 BeanFactory vs ApplicationContext

```
                    BeanFactory（顶层接口，IoC 容器的基本规范）
                    ├── getBean() / containsBean() / isSingleton() / getType()
                    │
      ┌─────────────┴──────────────────┐
      │                                │
ListableBeanFactory            HierarchicalBeanFactory
（可列举所有 Bean）              （可访问父容器）
      │                                │
      └─────────────┬──────────────────┘
                    │
          ★ ApplicationContext（★ 应用上下文，企业级容器）
          ├── 继承 BeanFactory 的全部能力
          ├── MessageSource（国际化 i18n）
          ├── ApplicationEventPublisher（★ 事件发布）
          ├── ResourcePatternResolver（★ 资源加载 classpath:/*.xml）
          ├── EnvironmentCapable（★ 环境抽象 profiles/properties）
          └── LifecycleProcessor（生命周期管理）
                    │
      ┌─────────────┼─────────────────┬──────────────────────┐
      │             │                 │                      │
ClassPathXml    FileSystemXml    AnnotationConfig      ★ Web 应用容器
ApplicationContext  ApplicationContext  ApplicationContext   WebApplicationContext
（XML 类路径）    （XML 文件系统）   （★ 注解/JavaConfig）      │
                                                   ┌─────┴──────────────────┐
                                          GenericWebApplicationContext
                                          AnnotationConfigServletWebServerApplicationContext
                                          （★ Spring Boot Web 应用用的就是这个）
                                          AnnotationConfigReactiveWebServerApplicationContext
                                          （WebFlux）

AbstractBeanFactory（BeanFactory 的骨架实现）
    └── DefaultListableBeanFactory（★★ 最完整的实现，ApplicationContext 内部也用它）
```

**BeanFactory vs ApplicationContext 的区别（★ 必考）：**

| 对比项 | BeanFactory | **ApplicationContext** |
| --- | --- | --- |
| 定位 | IoC 容器的**基本规范** | **企业级容器**（BeanFactory 的超集） |
| Bean 加载时机 | ★ **懒加载**（首次 `getBean()` 才创建） | ★ **预加载**（容器启动时创建所有单例） |
| 国际化 | ❌ | ✅ `MessageSource` |
| 事件发布 | ❌ | ✅ `ApplicationEventPublisher` |
| 资源访问 | ❌ | ✅ `ResourceLoader`（`classpath:`、`file:`、`http:`） |
| 环境抽象 | ❌ | ✅ `Environment`（profiles、配置属性） |
| 注解支持 | 基础 | ✅ **完整**（`@Component` 扫描、`@Autowired`） |
| AOP 集成 | 需手动 | ✅ **自动**（`@Aspect` 自动代理） |
| `BeanPostProcessor` | 需手动注册 | ✅ **自动注册** |
| 实现类 | `DefaultListableBeanFactory`、`XmlBeanFactory`（已废弃） | `ClassPathXmlApplicationContext`、`AnnotationConfigApplicationContext`、`GenericApplicationContext` |
| 使用场景 | 资源受限（Applet、嵌入式）、需要精确控制加载时机 | ★ **99% 的应用** |

```java
// ─── BeanFactory：懒加载 ───
DefaultListableBeanFactory beanFactory = new DefaultListableBeanFactory();
beanFactory.registerBeanDefinition("userDao", new RootBeanDefinition(UserDaoImpl.class));
// ★ 此时 UserDaoImpl 还没被创建！
UserDao dao = beanFactory.getBean("userDao", UserDao.class);   // ★ 这时才创建
// 需要手动注册 BeanPostProcessor（否则 @Autowired 不生效！）
beanFactory.addBeanPostProcessor(new AutowiredAnnotationBeanPostProcessor());

// ─── ApplicationContext：预加载 ───
ApplicationContext ctx = new AnnotationConfigApplicationContext(AppConfig.class);
// ★ 构造完成时，所有非懒加载的单例 Bean 已经创建好了
// 好处：启动时就暴露配置错误（如依赖找不到），而不是等到运行时
UserDao dao2 = ctx.getBean(UserDao.class);                      // 直接拿，已存在

// ─── 常用的 ApplicationContext 实现 ───
// ① XML 配置（传统 SSM）
ApplicationContext ctx1 = new ClassPathXmlApplicationContext("applicationContext.xml");
ApplicationContext ctx2 = new ClassPathXmlApplicationContext(
        new String[]{"spring-dao.xml", "spring-service.xml", "spring-mvc.xml"});
ApplicationContext ctx3 = new FileSystemXmlApplicationContext("/data/config/app.xml");

// ② ★ 注解/JavaConfig（现代主流）
ApplicationContext ctx4 = new AnnotationConfigApplicationContext(AppConfig.class);
ApplicationContext ctx5 = new AnnotationConfigApplicationContext("com.example");   // 扫描包
AnnotationConfigApplicationContext ctx6 = new AnnotationConfigApplicationContext();
ctx6.register(AppConfig.class, DataSourceConfig.class);          // 注册配置类
ctx6.scan("com.example.service");                                 // 扫描包
ctx6.refresh();                                                   // ★ 必须调 refresh 才生效

// ③ 通用（编程式，最灵活）
GenericApplicationContext ctx7 = new GenericApplicationContext();
ctx7.registerBean(UserDao.class, UserDaoImpl::new);              // ★ 函数式注册（Spring 5+）
ctx7.registerBean("orderService", OrderService.class,
        () -> new OrderService(ctx7.getBean(UserDao.class)));
ctx7.refresh();

// ④ Web 应用（Spring Boot 内部使用）
AnnotationConfigServletWebServerApplicationContext ctx8 = new ...();  // 内嵌 Tomcat

// ⑤ Spring Boot 的入口（★ 最常用的方式）
ApplicationContext ctx9 = SpringApplication.run(Application.class, args);
```

### 3.2 三种配置方式 ★★★★★

#### ① XML 配置（传统 SSM，存量项目）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xmlns:tx="http://www.springframework.org/schema/tx"
       xmlns:mvc="http://www.springframework.org/schema/mvc"
       xsi:schemaLocation="
           http://www.springframework.org/schema/beans
           https://www.springframework.org/schema/beans/spring-beans.xsd
           http://www.springframework.org/schema/context
           https://www.springframework.org/schema/context/spring-context.xsd
           http://www.springframework.org/schema/aop
           https://www.springframework.org/schema/aop/spring-aop.xsd
           http://www.springframework.org/schema/tx
           https://www.springframework.org/schema/tx/spring-tx.xsd
           http://www.springframework.org/schema/mvc
           https://www.springframework.org/schema/mvc/spring-mvc.xsd">

    <!-- ★ 开启注解扫描（否则 @Service/@Autowired 都不生效） -->
    <context:component-scan base-package="com.example">
        <context:exclude-filter type="annotation"
            expression="org.springframework.stereotype.Controller"/>   <!-- 排除 Controller（由 spring-mvc.xml 扫） -->
    </context:component-scan>

    <!-- ─── 方式 A：setter 注入 ─── -->
    <bean id="userDao" class="com.example.dao.impl.UserDaoImpl">
        <property name="dataSource" ref="dataSource"/>       <!-- ref 引用其他 Bean -->
        <property name="tableName" value="t_user"/>          <!-- value 基本类型/字符串 -->
        <property name="timeout" value="3000"/>              <!-- 自动类型转换为 int -->
        <property name="maxRetry">                            <!-- 内部 Bean -->
            <bean class="java.lang.Integer">
                <constructor-arg value="3"/>
            </bean>
        </property>
        <property name="columns">                             <!-- List -->
            <list><value>id</value><value>name</value><value>age</value></list>
        </property>
        <property name="props">                               <!-- Map -->
            <map>
                <entry key="url" value="jdbc:mysql://localhost/db"/>
                <entry key="timeout" value="3000"/>
            </map>
        </property>
        <property name="tags">                                <!-- Set -->
            <set><value>a</value><value>b</value></set>
        </property>
        <property name="config">                              <!-- Properties -->
            <props><prop key="k1">v1</prop></props>
        </property>
        <property name="address" ref="address"/>              <!-- null 与空串 -->
        <property name="remark"><null/></property>
        <property name="emptyStr"><value></value></property>
    </bean>

    <!-- ─── 方式 B：构造器注入 ─── -->
    <bean id="orderService" class="com.example.service.impl.OrderServiceImpl">
        <constructor-arg ref="orderDao"/>                     <!-- 按顺序 -->
        <constructor-arg ref="userService"/>
        <constructor-arg name="timeout" value="5000"/>         <!-- ★ 按名称（推荐，不怕顺序变） -->
        <constructor-arg index="0" type="com.example.dao.OrderDao" ref="orderDao"/>  <!-- 按下标+类型 -->
    </bean>

    <!-- ─── 作用域与生命周期 ─── -->
    <bean id="cache" class="com.example.Cache"
          scope="singleton"                <!-- singleton(默认) / prototype / request / session / application -->
          lazy-init="true"                 <!-- ★ 懒加载 -->
          init-method="init"               <!-- ★ 自定义初始化方法 -->
          destroy-method="close"           <!-- ★ 自定义销毁方法 -->
          depends-on="dataSource,redis"    <!-- ★ 强制先初始化这些 Bean -->
          primary="true"                   <!-- ★ 同类型多 Bean 时优先选它 -->
          autowire="byType"                <!-- byName / byType / constructor（老式自动装配） -->
          factory-bean="factoryBean"       <!-- 用工厂 Bean 创建 -->
          factory-method="createInstance"  <!-- 用工厂方法创建 -->
          parent="abstractBean"            <!-- 继承父 Bean 的配置 -->
          abstract="true">                 <!-- 抽象 Bean（只做模板，不实例化） -->
    </bean>

    <!-- ★ 静态工厂方法 -->
    <bean id="calendar" class="java.util.Calendar" factory-method="getInstance"/>
    <!-- ★ 实例工厂方法 -->
    <bean id="factory" class="com.example.ClientFactory"/>
    <bean id="client" factory-bean="factory" factory-method="createClient"/>

    <!-- ─── 引入其他配置 + 读属性文件 ─── -->
    <import resource="classpath:spring-dao.xml"/>
    <context:property-placeholder location="classpath:jdbc.properties"
                                  ignore-unresolvable="true"
                                  file-encoding="UTF-8"/>
    <bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource">
        <property name="url" value="${jdbc.url}"/>            <!-- ★ ${} 占位符 -->
        <property name="username" value="${jdbc.username}"/>
        <property name="password" value="${jdbc.password}"/>
        <property name="maxActive" value="${jdbc.maxActive:50}"/>   <!-- ★ :默认值 -->
    </bean>

    <!-- ─── 开启 AOP 和事务注解 ─── -->
    <aop:aspectj-autoproxy proxy-target-class="true"/>        <!-- ★ @Aspect 生效 -->
    <tx:annotation-driven transaction-manager="transactionManager"/>   <!-- ★ @Transactional 生效 -->

    <!-- ─── SpEL 表达式（★ 强大）─── -->
    <bean id="spelDemo" class="com.example.SpelDemo">
        <property name="count" value="#{T(java.lang.Math).random() * 100}"/>       <!-- 静态方法 -->
        <property name="name" value="#{userDao.tableName}"/>                       <!-- 引用其他 Bean 的属性 -->
        <property name="upper" value="#{'hello'.toUpperCase()}"/>                   <!-- 调用方法 -->
        <property name="sum" value="#{1 + 2 * 3}"/>                                 <!-- 运算 -->
        <property name="list" value="#{userDao.findAll().![name]}"/>                <!-- ★ 投影（提取字段） -->
        <property name="filtered" value="#{userDao.findAll().?[age > 18]}"/>         <!-- ★ 选择（过滤） -->
        <property name="env" value="#{systemProperties['user.home']}"/>              <!-- 系统属性 -->
        <property name="ternary" value="#{userDao != null ? userDao.name : 'none'}"/> <!-- 三元 -->
        <property name="safe" value="#{userDao?.name}"/>                             <!-- ★ 安全导航（防 NPE） -->
        <property name="regex" value="#{'abc' matches '[a-z]+'}"/>                   <!-- 正则 -->
    </bean>
</beans>
```

```properties
# jdbc.properties
jdbc.url=jdbc:mysql://localhost:3306/mall?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
jdbc.username=root
jdbc.password=123456
jdbc.maxActive=50
```

#### ② 注解配置（★ 最常用）

```java
// ─── 组件注册（4 个 stereotype 注解）───
@Component          // ★ 通用组件（不明确的类）
@Service            // ★ 业务逻辑层（语义化，功能与 @Component 相同）
@Repository         // ★ 数据访问层（额外：把数据库异常转换为 Spring 的 DataAccessException）
@Controller         // ★ Web 控制层（配合 Spring MVC，返回视图）
@RestController     // = @Controller + @ResponseBody（返回 JSON）
@Configuration      // ★ 配置类（内部用 @Bean 声明，是特殊的 @Component）

// 它们的本质都一样（都是 @Component 的派生）：
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Component                                    // ★ 元注解就是 @Component
public @interface Service {
    @AliasFor(annotation = Component.class)
    String value() default "";                // Bean 名称
}

// ─── 组件扫描 ───
@Configuration
@ComponentScan(
    basePackages = {"com.example.service", "com.example.dao"},   // ★ 扫描哪些包
    basePackageClasses = {AppConfig.class},                       // 按类所在包扫描（类型安全，推荐）
    useDefaultFilters = false,                                    // ★ false = 不用默认过滤器（不扫 @Component）
    includeFilters = {                                            // 包含规则
        @ComponentScan.Filter(type = FilterType.ANNOTATION,
                              classes = {Service.class, Repository.class}),
        @ComponentScan.Filter(type = FilterType.REGEX,
                              pattern = "com\\.example\\.dao\\..*Impl"),
        @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                              classes = MySpecialDao.class),
        @ComponentScan.Filter(type = FilterType.CUSTOM,
                              classes = MyTypeFilter.class)
    },
    excludeFilters = {                                            // ★ 排除规则
        @ComponentScan.Filter(type = FilterType.ANNOTATION,
                              classes = Controller.class),         // Controller 由 MVC 容器单独扫
        @ComponentScan.Filter(type = FilterType.ASPECTJ,
                              pattern = "com.example..*Test")
    },
    lazyInit = true,                                              // ★ 所有扫描到的 Bean 默认懒加载
    nameGenerator = MyBeanNameGenerator.class,                    // 自定义 Bean 名称生成策略
    scopedProxy = ScopedProxyMode.TARGET_CLASS                    // 作用域代理（request/session 作用域需要）
)
public class AppConfig { }

// ─── 依赖注入注解 ───
@Autowired           // ★ Spring 的注解，按【类型】注入（byType）
@Qualifier("name")   // ★ 配合 @Autowired，指定 Bean 名称（byName）
@Resource            // ★ JSR-250（jakarta.annotation），默认按【名称】，找不到再按类型
@Value("${x}")       // ★ 注入配置值 / SpEL
@Primary             // ★ 同类型多 Bean 时的首选
@Inject              // JSR-330（需 javax.inject 依赖），等价 @Autowired
@Lazy                // ★ 延迟注入（注入代理对象，首次使用时才创建真实 Bean）
```

**@Autowired vs @Resource（★ 高频面试）：**

| 对比项 | `@Autowired` | `@Resource` |
| --- | --- | --- |
| 来源 | **Spring**（`org.springframework.beans.factory.annotation`） | **JSR-250**（`jakarta.annotation`，Java 标准） |
| 默认装配方式 | ★ **按类型**（byType） | ★ **按名称**（byName），找不到再按类型 |
| 指定名称 | 需配合 `@Qualifier("name")` | `@Resource(name = "xxx")` |
| required 属性 | ✅ `@Autowired(required = false)` | ❌ 没有（找不到就报错） |
| 可用位置 | 构造器、字段、setter、方法参数 | 字段、setter（**不能用于构造器**） |
| 与 Spring 耦合 | 是 | 否（换框架更容易） |
| 支持多个 Bean 注入 | ✅ 配合 `List&lt;T&gt;`/`Map&lt;String,T&gt;` | ❌ |
| 阿里手册建议 | — | ★ **推荐用 @Resource**（减少对 Spring 的耦合） |

```java
// 场景：一个接口有两个实现
public interface PaymentService { void pay(); }

@Service("alipayService")
public class AlipayService implements PaymentService { }

@Service("wechatPayService")
public class WechatPayService implements PaymentService { }

// ─── @Autowired 的解析过程 ───
@Autowired
private PaymentService paymentService;
// ❌ 报错：NoUniqueBeanDefinitionException: expected single matching bean but found 2

// ✅ 解决方案
// 方案 1：@Qualifier 指定名称
@Autowired
@Qualifier("alipayService")
private PaymentService paymentService;

// 方案 2：@Resource 按名称（★ 更简洁）
@Resource(name = "alipayService")
private PaymentService paymentService;
@Resource                          // ★ 不写 name 时，默认用「字段名」当 Bean 名查找
private PaymentService alipayService;   // 字段名 = alipayService → 找到同名 Bean ✅

// 方案 3：@Primary 标记默认实现
@Service("alipayService")
@Primary                           // ★ 没指定 Qualifier 时优先选它
public class AlipayService implements PaymentService { }

// 方案 4：变量名与 Bean 名一致（★ @Autowired 的兜底策略）
@Autowired
private PaymentService alipayService;   // 类型匹配到 2 个 → 用字段名 alipayService 再筛选 → 命中

// 方案 5：注入所有实现（★ 策略模式的利器）
@Autowired
private List<PaymentService> allServices;                    // 按 @Order 排序的列表
@Autowired
private Map<String, PaymentService> serviceMap;              // ★ key = Bean 名称
public void pay(String channel) {
    serviceMap.get(channel + "Service").pay();               // 运行时选择实现
}
// 或用 ObjectProvider（更优雅）
private final ObjectProvider<List<PaymentService>> provider;
```

**@Autowired 的完整查找流程（★ 源码级）：**

```
① 按类型查找（byType）：findAutowireCandidates(beanName, type, descriptor)
   → 得到所有匹配的候选 Bean 名称集合
② 候选数量判断：
   ├── 0 个 → required=true 则抛 NoSuchBeanDefinitionException；required=false 则注入 null
   ├── 1 个 → ★ 直接注入
   └── 多个 → 进入筛选
③ 筛选多个候选（按优先级依次判断）：
   a. @Qualifier / @Primary 指定的名称
   b. @Primary 标记的 Bean（多个 @Primary 会报错）
   c. @Priority 值最小的（javax.annotation.Priority，数字越小优先级越高）
   d. ★ 字段名/参数名 与 Bean 名称匹配（fallback to matching by name）
   e. 都不满足 → NoUniqueBeanDefinitionException
```

```java
// @Autowired 支持的各种注入位置
@Component
public class AutowireDemo {

    @Autowired private UserDao fieldInject;                    // 字段（反射赋值）

    private final OrderDao orderDao;
    @Autowired                                                  // ★ 构造器（推荐）
    public AutowireDemo(OrderDao orderDao) { this.orderDao = orderDao; }

    @Autowired                                                  // setter
    public void setPayDao(PayDao payDao) { this.payDao = payDao; }

    @Autowired                                                  // 任意方法（可以有多参数）
    public void configure(CacheDao cache, LogDao log) { }

    @Autowired
    public void init(@Qualifier("special") SpecialDao dao) { }   // ★ 方法参数上也可加 Qualifier

    @Autowired(required = false)                                 // ★ 可选依赖
    private OptionalFeature optionalFeature;

    @Autowired
    private List<Handler> handlers;                              // ★ 所有 Handler 实现（有序）

    @Autowired
    private Map<String, Handler> handlerMap;                     // ★ beanName → 实现

    @Autowired
    private Handler[] handlerArray;                              // 数组

    @Autowired
    private ObjectProvider<HeavyService> heavyProvider;           // ★ 延迟/可选

    @Autowired
    private Provider<HeavyService> jsr330Provider;                // JSR-330 的 Provider（每次 get 新建 prototype）

    @Autowired
    private ApplicationContext ctx;                              // 容器自身也能注入
    @Autowired
    private Environment env;
    @Autowired
    private BeanFactory beanFactory;
}
```

#### ③ JavaConfig（★ Spring 3.0+ 的现代方式，Spring Boot 的基础）

```java
/**
 * ★ 配置类：完全替代 XML
 */
@Configuration                                        // ★ 标记为配置类（本身也是个 Bean，会被 CGLIB 代理）
@ComponentScan(basePackages = "com.example")             // 组件扫描
@PropertySource(value = "classpath:jdbc.properties",      // ★ 加载属性文件
                encoding = "UTF-8",
                ignoreResourceNotFound = true)
@Import({DataSourceConfig.class, RedisConfig.class})      // ★ 导入其他配置类
@ImportResource("classpath:legacy.xml")                   // ★ 兼容导入老 XML（迁移期用）
@EnableAspectJAutoProxy(proxyTargetClass = true)          // ★ 开启 AOP
@EnableTransactionManagement                              // ★ 开启注解事务
@EnableScheduling                                         // 开启定时任务
@EnableAsync                                              // 开启异步
@EnableCaching                                            // 开启缓存
public class AppConfig {

    /** 读取配置文件中的值 */
    @Value("${jdbc.url}")
    private String jdbcUrl;

    @Value("${jdbc.username:root}")                       // ★ 带默认值
    private String username;

    @Value("#{systemProperties['user.home']}")             // ★ SpEL
    private String userHome;

    @Value("${jdbc.maxActive:50}")
    private int maxActive;

    /** 环境抽象（读配置、判断 profile） */
    @Autowired
    private Environment env;

    // ═══════════ @Bean 方法（★ 核心）═══════════

    /**
     * ★ 数据源：方法名即 Bean 名称
     */
    @Bean(name = {"dataSource", "mainDataSource"},          // ★ 可指定名称和别名
          initMethod = "init",                               // ★ 初始化方法（Druid 需要）
          destroyMethod = "close")                           // ★ 销毁方法（关闭连接池）
    @Primary                                                  // ★ 多数据源时的主数据源
    @Scope("singleton")                                       // 作用域
    @Lazy                                                     // ★ 懒加载
    @ConditionalOnMissingBean(DataSource.class)               // ★ 条件装配（Boot 常用）
    public DataSource dataSource() {
        DruidDataSource ds = new DruidDataSource();
        ds.setUrl(env.getProperty("jdbc.url"));                // 方式 1：从 Environment 读
        ds.setUsername(username);                              // 方式 2：@Value
        ds.setPassword(env.getProperty("jdbc.password"));
        ds.setMaxActive(maxActive);
        ds.setInitialSize(5);
        ds.setMinIdle(10);
        ds.setMaxWait(3000);
        ds.setValidationQuery("SELECT 1");
        ds.setTestWhileIdle(true);
        return ds;
    }

    /**
     * ★ @Bean 方法可以有参数（Spring 自动注入）
     */
    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {   // ★ 参数自动从容器获取
        JdbcTemplate template = new JdbcTemplate(dataSource);
        template.setQueryTimeout(10);
        return template;
    }

    /**
     * ★ @Bean 方法之间的调用（full 模式下会返回同一个单例，而非新建！）
     */
    @Bean
    public TransactionManager transactionManager() {
        return new DataSourceTransactionManager(dataSource());   // ★ 调用 dataSource()
        // full 模式（@Configuration）：CGLIB 代理拦截了这个调用 → 返回容器中的单例
        // lite 模式（@Component）：就是普通方法调用 → ★ 会新建一个 DataSource（Bug！）
    }

    @Bean
    public UserService userService() {
        // 也可以在这里手动 new 并装配（适合第三方类无法加注解的情况）
        return new UserServiceImpl(jdbcTemplate(), transactionManager());
    }

    /**
     * ★ 为第三方类注册 Bean（无法在其源码上加 @Component）
     */
    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        return mapper;
    }

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(3))
                .setReadTimeout(Duration.ofSeconds(10))
                .build();
    }

    /**
     * ★ 静态 @Bean 方法（BeanFactoryPostProcessor 必须用 static，否则会提前实例化配置类）
     */
    @Bean
    public static PropertySourcesPlaceholderConfigurer propertyConfigurer() {
        PropertySourcesPlaceholderConfigurer configurer = new PropertySourcesPlaceholderConfigurer();
        configurer.setIgnoreUnresolvablePlaceholders(true);
        return configurer;
    }

    /**
     * ★ 按 Profile 条件注册（多环境）
     */
    @Bean
    @Profile("dev")
    public DataSource devDataSource() { return new EmbeddedDatabaseBuilder().build(); }

    @Bean
    @Profile({"prod", "pre"})
    public DataSource prodDataSource() { return dataSource(); }
}
```

**@Configuration 的 full 模式 vs lite 模式（★ 高频面试）：**

| | full 模式（`@Configuration`） | lite 模式（`@Component`/`@Service` 等） |
| --- | --- | --- |
| 是否被 CGLIB 代理 | ✅ **是** | ❌ 否 |
| `@Bean` 方法间调用的行为 | ★ **返回容器中的单例** | ★ **每次都新建对象**（普通方法调用） |
| 性能 | 启动稍慢（要生成代理类） | 快 |
| 适用 | 有 `@Bean` 方法互相依赖的配置类 | 简单的 `@Bean` 声明（无互相调用） |
| 判断 | `@Configuration` | `@Component`、`@Service`、`@Import` 导入的普通类、`@Bean` 直接在 `@Component` 中 |

```java
// ─── full 模式：CGLIB 代理拦截 @Bean 方法调用 ───
@Configuration
public class FullConfig {
    @Bean
    public A a() { return new A(b()); }          // ★ 调用 b()

    @Bean
    public B b() { return new B(); }
}
// 实际行为：
// a() 被调用 → CGLIB 拦截 → 检查容器中是否已有 B 的单例
//   没有 → 执行真正的 b() 方法，创建 B，存入容器
//   有   → ★ 直接返回容器中的 B（不会新建）
// 结果：容器中的 B 和 a 持有的 B 是【同一个对象】✅

// ─── lite 模式：普通方法调用 ───
@Component                                        // ★ 换成 @Component
public class LiteConfig {
    @Bean
    public A a() { return new A(b()); }           // ★ 这就是普通的 Java 方法调用！

    @Bean
    public B b() { return new B(); }
}
// 实际行为：
// 容器创建 a → 调用 a() → 内部调 b() → ★ new 了一个新的 B（不在容器中！）
// 容器创建 b → 调用 b() → 又 new 了一个 B（存入容器）
// 结果：容器中的 B 和 a 持有的 B 是【两个不同对象】❌ 潜在 Bug

// 验证
@Configuration
public class VerifyConfig {
    @Bean public Foo foo() { return new Foo(bar()); }
    @Bean public Bar bar() { return new Bar(); }
}
// 测试
Foo foo = ctx.getBean(Foo.class);
Bar barInFoo = foo.getBar();
Bar barInCtx = ctx.getBean(Bar.class);
System.out.println(barInFoo == barInCtx);   // full 模式：true ✅   lite 模式：false ❌

// ─── Spring Boot 2.2+ 的 proxyBeanMethods = false（★ 性能优化）───
@Configuration(proxyBeanMethods = false)      // ★ 关闭 CGLIB 代理，变成 lite 模式
public class FastConfig {
    @Bean
    public A a(B b) { return new A(b); }       // ★ 通过【方法参数】注入依赖（而非调用 b()）
    @Bean
    public B b() { return new B(); }
}
// 优点：启动更快（不生成代理类）、内存更省
// 前提：@Bean 方法之间不互相调用，而是通过【参数注入】获取依赖
// ★ Spring Boot 的所有自动配置类都用了 proxyBeanMethods = false（启动性能优化）
```

**三种配置方式对比：**

| 对比项 | XML | 注解 | **JavaConfig** |
| --- | --- | --- | --- |
| 配置位置 | 独立 XML 文件 | 分散在各类上 | ★ **集中在配置类** |
| 可读性 | 中（结构清晰但冗长） | 高（就近） | ★ **最高**（类型安全 + IDE 跳转） |
| 类型安全 | ❌（写错类名运行时才发现） | ✅ | ★ ✅ |
| IDE 支持 | 一般 | 好 | ★ **最好**（重构、补全、跳转） |
| 修改需重新编译 | ❌（改 XML 即可） | ✅ 需要 | ✅ 需要 |
| 第三方类注册 | ✅ | ❌（无法在别人的类上加注解） | ★ ✅ |
| 条件化配置 | ❌ | 有限 | ★ ✅（`@Conditional`、`@Profile`） |
| 现状 | 存量项目 | ★ 主流（组件注册） | ★ 主流（Bean 装配） |

> 【最佳实践】**混合使用**：自己的类用 `@Service`/`@Component` 注解 + `@ComponentScan`；第三方类、需要复杂初始化逻辑的 Bean 用 `@Configuration` + `@Bean`。这也是 Spring Boot 的做法。

## 4. IoC 容器的启动流程（refresh）★★★★★

**`refresh()` 是 Spring 容器的核心方法，13 个步骤串起了整个 IoC 的初始化流程。**

```java
// AbstractApplicationContext.refresh() —— Spring 的心脏
public void refresh() throws BeansException, IllegalStateException {
    synchronized (this.startupShutdownMonitor) {          // ★ 加锁，防止并发刷新

        // ─── ① 准备刷新 ───
        prepareRefresh();
        // - 记录启动时间、设置 active 标志
        // - initPropertySources()：初始化属性源（Web 环境会把 ServletContext 参数放入 Environment）
        // - validateRequiredProperties()：校验必需的环境变量

        // ─── ② 获取新的 BeanFactory ───
        ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();
        // - refreshBeanFactory()：创建 DefaultListableBeanFactory
        // - ★ XML 模式：解析 XML，把 <bean> 转为 BeanDefinition 注册进去
        // - ★ 注解模式：BeanDefinition 已在构造器/scan 中注册好
        // - getBeanFactory()：返回 BeanFactory

        // ─── ③ 准备 BeanFactory ───
        prepareBeanFactory(beanFactory);
        // - 设置类加载器、SpEL 解析器、属性编辑器注册器
        // - ★ 添加 ApplicationContextAwareProcessor（处理各种 Aware 接口回调）
        // - ★ 注册「不能自动注入的类型」（BeanFactory、ResourceLoader、ApplicationEventPublisher 等，
        //   因为它们需要通过 Aware 接口注入，避免歧义）
        // - 添加 ApplicationListenerDetector（检测 Bean 是否是监听器）

        try {
            // ─── ④ 留给子类的扩展点（模板方法）───
            postProcessBeanFactory(beanFactory);
            // Web 环境下：注册 ServletContextAwareProcessor、注册 request/session/application 作用域

            // ─── ⑤ ★★ 执行 BeanFactoryPostProcessor ───
            invokeBeanFactoryPostProcessors(beanFactory);
            // 这是 Spring 最重要的扩展点之一！
            // - BeanDefinitionRegistryPostProcessor：可以【新增/修改/删除 BeanDefinition】
            //   ★ ConfigurationClassPostProcessor 就在这里工作：
            //     解析 @Configuration/@ComponentScan/@Import/@Bean/@ImportResource
            //     扫描所有 @Component 类并注册为 BeanDefinition
            // - BeanFactoryPostProcessor：可以【修改 BeanDefinition 的属性】
            //   ★ PropertySourcesPlaceholderConfigurer（处理 ${} 占位符）
            //   ★ MapperScannerConfigurer（MyBatis 扫描 Mapper 接口）
            // - 执行顺序：BeanDefinitionRegistryPostProcessor（PriorityOrdered → Ordered → 普通）
            //          → BeanFactoryPostProcessor（同上顺序）

            // ─── ⑥ ★ 注册 BeanPostProcessor ───
            registerBeanPostProcessors(beanFactory);
            // 只是【注册】，不执行！按 PriorityOrdered → Ordered → 普通 → MergedBeanDefinition 顺序注册
            // ★ 关键的 BeanPostProcessor：
            //   AutowiredAnnotationBeanPostProcessor  → 处理 @Autowired/@Value/@Inject
            //   CommonAnnotationBeanPostProcessor     → 处理 @Resource/@PostConstruct/@PreDestroy
            //   AnnotationAwareAspectJAutoProxyCreator → ★ AOP 自动代理（创建代理对象）
            //   ApplicationContextAwareProcessor      → 处理 Aware 接口

            // ─── ⑦ 初始化 MessageSource（国际化）───
            initMessageSource();

            // ─── ⑧ 初始化事件广播器 ───
            initApplicationEventMulticaster();

            // ─── ⑨ 留给子类的扩展点（Web 环境在此创建并启动内嵌 Tomcat！）───
            onRefresh();
            // ★ ServletWebServerApplicationContext 在这里 createWebServer()
            //   创建 Tomcat/Jetty/Undertow，但还没启动

            // ─── ⑩ 注册事件监听器 ───
            registerListeners();
            // 注册 ApplicationListener，并发布「早期事件」

            // ─── ⑪ ★★★ 实例化所有非懒加载的单例 Bean ───
            finishBeanFactoryInitialization(beanFactory);
            // - 设置 ConversionService、格式化器
            // - ★ 冻结配置（缓存 BeanDefinition 名称列表）
            // - ★★ preInstantiateSingletons()：遍历所有 BeanDefinition，调用 getBean() 创建
            //   这一步会触发完整的 Bean 生命周期（详见 [[后端/Spring/Bean生命周期与作用域]]）：
            //   实例化 → 属性填充 → Aware 回调 → BeanPostProcessor 前置 → 初始化 → 后置 → 完成

            // ─── ⑫ 完成刷新（发布事件、启动 Web 服务器）───
            finishRefresh();
            // - 清除资源缓存
            // - 初始化 LifecycleProcessor
            // - ★ 调用 LifecycleProcessor.onRefresh()：启动所有 Lifecycle Bean（含 WebServer！）
            // - ★ 发布 ContextRefreshedEvent 事件
            // - 注册 MBean（JMX）

        } catch (BeansException ex) {
            // ─── 失败处理：销毁已创建的 Bean，防止资源泄漏 ───
            destroyBeans();
            cancelRefresh(ex);
            throw ex;
        } finally {
            resetCommonCaches();                       // 清除反射缓存等
        }
    }
}
```

**refresh 的 13 步速记（★ 面试）：**

```
① prepareRefresh()                    准备刷新（属性源、校验）
② obtainFreshBeanFactory()            获取 BeanFactory（解析 BeanDefinition）
③ prepareBeanFactory()                准备（类加载器、Aware 处理器）
④ postProcessBeanFactory()            子类扩展（Web 作用域）
⑤ invokeBeanFactoryPostProcessors()   ★★ 执行 BFPP（解析注解、扫描组件、修改 BD）
⑥ registerBeanPostProcessors()        ★ 注册 BPP（AOP、@Autowired 处理器）
⑦ initMessageSource()                 国际化
⑧ initApplicationEventMulticaster()   事件广播器
⑨ onRefresh()                         ★ 子类扩展（创建内嵌 Web 服务器）
⑩ registerListeners()                 注册监听器
⑪ finishBeanFactoryInitialization()   ★★★ 实例化所有单例 Bean
⑫ finishRefresh()                     ★ 完成（启动 Web 服务器、发布事件）
⑬ catch → destroyBeans + cancelRefresh   失败清理
```

**BeanDefinition（Bean 的「蓝图」）：**

```java
// BeanDefinition 描述了如何创建一个 Bean（元数据），是 IoC 容器的核心数据结构
public interface BeanDefinition extends AttributeAccessor, BeanMetadataElement {
    String getBeanClassName();                    // 类名
    String getScope();                            // singleton / prototype / request / session
    boolean isLazyInit();                          // 是否懒加载
    String[] getDependsOn();                       // depends-on
    boolean isAutowireCandidate();                 // 是否作为自动注入的候选
    boolean isPrimary();                           // 是否首选
    String getFactoryBeanName();                   // 工厂 Bean 名
    String getFactoryMethodName();                 // 工厂方法名
    ConstructorArgumentValues getConstructorArgumentValues();   // 构造器参数
    MutablePropertyValues getPropertyValues();      // 属性值
    String getInitMethodName();                      // 初始化方法
    String getDestroyMethodName();                   // 销毁方法
    int getRole();                                   // ROLE_APPLICATION / SUPPORT / INFRASTRUCTURE
}

// 实现类：
// RootBeanDefinition     ★ 最常用（最终的 Bean 定义）
// ChildBeanDefinition    有 parent 的
// GenericBeanDefinition  通用（可设 parent）
// AnnotatedGenericBeanDefinition   由 @Configuration/@Component 解析而来
// ScannedGenericBeanDefinition     由 @ComponentScan 扫描而来
// ConfigurationClassBeanDefinition 由 @Bean 方法解析而来

// 编程式注册 BeanDefinition
DefaultListableBeanFactory bf = new DefaultListableBeanFactory();
BeanDefinitionBuilder builder = BeanDefinitionBuilder.rootBeanDefinition(UserDaoImpl.class);
builder.addPropertyValue("tableName", "t_user")        // 等价 <property name value>
       .addConstructorArgValue(dataSource)              // 等价 <constructor-arg>
       .addPropertyReference("cacheManager", "cache")   // 等价 ref
       .setScope(BeanDefinition.SCOPE_SINGLETON)
       .setLazyInit(true)
       .setInitMethodName("init")
       .setDestroyMethodName("close")
       .setPrimary(true);
bf.registerBeanDefinition("userDao", builder.getBeanDefinition());

// Spring 5+ 的函数式注册（更简洁）
GenericApplicationContext ctx = new GenericApplicationContext();
ctx.registerBean(UserDao.class, UserDaoImpl::new);
ctx.registerBean("orderService", OrderService.class,
        () -> new OrderService(ctx.getBean(UserDao.class)),
        bd -> bd.setLazyInit(true));
ctx.refresh();
```

## 5. IoC 实战：策略模式的优雅实现

```java
// ═══════════ 场景：多渠道支付，运行时动态选择实现 ═══════════

// ① 定义策略接口
public interface PaymentStrategy {
    /** 支付渠道标识（与业务传入的 channel 对应） */
    PayChannel supportChannel();
    /** 执行支付 */
    PayResult pay(PayRequest request);
    /** 是否支持退款 */
    default boolean supportRefund() { return true; }
}

public enum PayChannel {
    ALIPAY("alipay", "支付宝"),
    WECHAT("wechat", "微信支付"),
    UNIONPAY("unionpay", "银联"),
    BALANCE("balance", "余额支付");

    private final String code;
    private final String desc;
    PayChannel(String code, String desc) { this.code = code; this.desc = desc; }
    public String getCode() { return code; }
    public String getDesc() { return desc; }

    public static PayChannel of(String code) {
        return Arrays.stream(values())
                .filter(c -> c.code.equalsIgnoreCase(code))
                .findFirst()
                .orElseThrow(() -> new BusinessException("不支持的支付渠道：" + code));
    }
}

// ② 各个实现（★ 只需加 @Component，无需改任何工厂代码 —— 开闭原则）
@Component
@RequiredArgsConstructor
public class AlipayStrategy implements PaymentStrategy {
    private final AlipayClient alipayClient;
    @Override public PayChannel supportChannel() { return PayChannel.ALIPAY; }
    @Override public PayResult pay(PayRequest req) { /* 调支付宝 SDK */ }
}

@Component
public class WechatPayStrategy implements PaymentStrategy {
    @Override public PayChannel supportChannel() { return PayChannel.WECHAT; }
    @Override public PayResult pay(PayRequest req) { /* 调微信 SDK */ }
}

@Component
public class BalanceStrategy implements PaymentStrategy {
    @Override public PayChannel supportChannel() { return PayChannel.BALANCE; }
    @Override public PayResult pay(PayRequest req) { /* 扣余额 */ }
    @Override public boolean supportRefund() { return false; }       // 余额不支持退款
}

// ③ ★ 策略工厂（利用 IoC 容器自动收集所有实现）
@Component
@Slf4j
public class PaymentStrategyFactory implements InitializingBean {

    /** ★ 方式 1：注入 List，Spring 会自动收集所有 PaymentStrategy 实现（按 @Order 排序） */
    private final List<PaymentStrategy> strategies;

    /** ★ 方式 2：注入 Map，key = beanName，value = 实现（beanName 要有规律） */
    private final Map<String, PaymentStrategy> strategyMap;

    /** 自己维护的查找表（★ 最快，O(1)） */
    private final Map<PayChannel, PaymentStrategy> channelMap = new EnumMap<>(PayChannel.class);

    public PaymentStrategyFactory(List<PaymentStrategy> strategies,
                                  Map<String, PaymentStrategy> strategyMap) {
        this.strategies = strategies;
        this.strategyMap = strategyMap;
    }

    /** ★ 容器初始化完成后构建查找表 */
    @Override
    public void afterPropertiesSet() {
        for (PaymentStrategy strategy : strategies) {
            PayChannel channel = strategy.supportChannel();
            PaymentStrategy existing = channelMap.put(channel, strategy);
            if (existing != null) {
                throw new IllegalStateException(String.format(
                    "支付渠道 %s 存在重复的策略实现：%s 和 %s",
                    channel, existing.getClass().getSimpleName(), strategy.getClass().getSimpleName()));
            }
        }
        log.info("支付策略初始化完成，已注册 {} 个渠道：{}", channelMap.size(), channelMap.keySet());
        // 校验：确保所有枚举都有对应实现
        for (PayChannel channel : PayChannel.values()) {
            if (!channelMap.containsKey(channel)) {
                log.warn("支付渠道 {} 没有对应的策略实现", channel);
            }
        }
    }

    /** 按渠道获取策略 */
    public PaymentStrategy getStrategy(PayChannel channel) {
        PaymentStrategy strategy = channelMap.get(channel);
        if (strategy == null) {
            throw new BusinessException(ResultCode.PAY_CHANNEL_UNSUPPORTED,
                    "不支持的支付渠道：" + channel.getDesc());
        }
        return strategy;
    }

    public PaymentStrategy getStrategy(String channelCode) {
        return getStrategy(PayChannel.of(channelCode));
    }

    /** 支付（对外统一入口） */
    public PayResult pay(PayRequest request) {
        PaymentStrategy strategy = getStrategy(request.getChannel());
        log.info("使用 {} 策略处理支付，订单号={}", strategy.getClass().getSimpleName(), request.getOrderNo());
        return strategy.pay(request);
    }
}

// ④ 业务调用（★ 完全不知道具体实现是谁）
@Service
@RequiredArgsConstructor
public class PayService {
    private final PaymentStrategyFactory strategyFactory;

    public PayResult pay(PayRequest request) {
        // 前置校验、幂等检查、订单状态流转...
        PayResult result = strategyFactory.pay(request);      // ★ 一行搞定，新增渠道零改动
        // 后续处理...
        return result;
    }
}

// ★ 新增一个「银联支付」只需：新建 UnionPayStrategy implements PaymentStrategy + @Component
//   → 工厂自动收集 → 业务代码零改动 → 完美符合「开闭原则」
```

**其他收集多实现的写法：**

```java
// 写法 1：ObjectProvider（★ 支持延迟和可选，最优雅）
@Component
public class Factory1 {
    private final ObjectProvider<List<PaymentStrategy>> provider;
    public Factory1(ObjectProvider<List<PaymentStrategy>> provider) { this.provider = provider; }
    public void use() {
        provider.orderedStream().forEach(s -> log.info("{}", s.supportChannel()));   // ★ 按 @Order 排序
    }
}

// 写法 2：ApplicationContext 主动查找
@Component
public class Factory2 implements ApplicationContextAware {
    private ApplicationContext ctx;
    @Override public void setApplicationContext(ApplicationContext ctx) { this.ctx = ctx; }
    public void use() {
        Map<String, PaymentStrategy> map = ctx.getBeansOfType(PaymentStrategy.class);
        String[] names = ctx.getBeanNamesForType(PaymentStrategy.class, true, false);
    }
}

// 写法 3：@Order 控制顺序
@Component @Order(1)   // 数字越小越先执行
public class FirstStrategy implements PaymentStrategy { }
@Component @Order(2)
public class SecondStrategy implements PaymentStrategy { }
// 注入 List 时按 Order 排序；注入 Map 时【不保证】顺序（Map 无序）

// 写法 4：注解驱动的策略（★ 更灵活，用自定义注解标记渠道）
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Component                                     // ★ 元注解带 @Component，自动成为 Bean
public @interface PayHandler {
    PayChannel value();                         // 渠道
    int order() default 0;
}

@PayHandler(PayChannel.ALIPAY)                  // ★ 一个注解搞定「注册 + 标记渠道」
public class AlipayHandler implements PaymentStrategy { }

// 工厂通过读注解构建映射
@PostConstruct
public void init() {
    Map<String, PaymentStrategy> beans = ctx.getBeansOfType(PaymentStrategy.class);
    beans.values().forEach(s -> {
        PayHandler anno = AnnotationUtils.findAnnotation(s.getClass(), PayHandler.class);
        if (anno != null) channelMap.put(anno.value(), s);
    });
}
```

## 6. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 字段注入 | 无法单测、依赖不可见、不能 final | ★ 构造器注入 + `@RequiredArgsConstructor` |
| 2 | 忘加 `@ComponentScan` 或包路径不对 | `NoSuchBeanDefinitionException` | 检查扫描范围（默认只扫启动类所在包及子包） |
| 3 | `@Autowired` 同类型多 Bean | `NoUniqueBeanDefinitionException` | `@Qualifier` / `@Primary` / `@Resource(name=)` / 字段名匹配 |
| 4 | lite 模式下 `@Bean` 互相调用 | 生成了两个不同的对象 | 用 `@Configuration`，或改参数注入 + `proxyBeanMethods=false` |
| 5 | `@Bean` 方法不是 public | Spring 4 前无法识别 | 建议 public（Spring 5+ 支持 protected/package） |
| 6 | 静态方法上加 `@Bean` 期望注入 | 无法注入实例字段 | 静态 @Bean 方法只能用参数注入 |
| 7 | `BeanFactoryPostProcessor` 用非 static @Bean | 提前实例化配置类，警告日志 | ★ 声明为 `static` 方法 |
| 8 | 第三方类无法加 `@Component` | 无法注册 | 用 `@Bean` 方法注册 |
| 9 | 构造器循环依赖 | `BeanCurrentlyInCreationException` | 拆分类 / `@Lazy` / setter 注入（见 [[后端/Spring/循环依赖与三级缓存]]） |
| 10 | `@Value` 在静态字段上 | 注入失败（null） | 静态字段不能注入，改用实例字段或 setter |
| 11 | `@Value` 用在 `@Configuration` 的静态 @Bean | 拿不到值 | 同上 |
| 12 | XML 中 `$&#123;&#125;` 未配 property-placeholder | 值是字面量 `$&#123;jdbc.url&#125;` | 加 `<context:property-placeholder/>` |
| 13 | 同一属性被多处配置 | 值不确定 | 明确优先级（`PropertySource` 顺序） |
| 14 | `@Service` 加了但没被扫到 | Bean 不存在 | 检查包路径、`excludeFilters`、是否被 `@ComponentScan` 覆盖 |
| 15 | 内部类/嵌套类的 Bean | 扫描不到 | 静态内部类才能被扫描（非静态内部类需外部实例） |
| 16 | 手动 new 的类中用 `@Autowired` | 注入为 null | ★ 对象必须由容器创建，`new` 出来的不受容器管理 |
| 17 | `getBean` 频繁调用 | 性能开销 + 侵入性强 | 优先 DI，必要时用 `ObjectProvider` |
| 18 | 依赖查找滥用（Aware 接口） | 代码耦合 Spring API | 优先构造器注入 |
| 19 | 单例 Bean 中持有可变状态 | 线程安全问题 | 单例应无状态；有状态用 prototype 或 ThreadLocal |
| 20 | `prototype` Bean 注入到 `singleton` | prototype 只创建一次（失去意义） | 用 `ObjectProvider`/`@Lookup`/`ProxyMode` |
| 21 | Spring Boot 2 → 3 未改 jakarta | 大量 ClassNotFound | 全量替换 `javax.*` → `jakarta.*` |
| 22 | 版本不匹配（Boot 3 + 老的三方库） | 各种诡异错误 | 严格按对应关系升级依赖 |
| 23 | `@Configuration` 类被 `@ComponentScan` 重复扫描 | Bean 定义冲突 | 检查扫描范围，避免重叠 |
| 24 | 忘记 `@EnableXxx` | 注解不生效（如 `@Transactional`、`@Async`） | 加上对应的 Enable 注解（Boot 已自动开启大部分） |

---

## 关联笔记

- 下一篇：[[后端/Spring/Bean生命周期与作用域]]
- 深入：[[后端/Spring/循环依赖与三级缓存]]、[[后端/Spring/AOP面向切面编程]]、[[后端/Spring/动态代理-JDK与CGLIB]]
- 配置：[[后端/Spring/Spring注解大全与配置类]]
- Boot：[[后端/SpringBoot/自动配置原理]]（条件注解与 starter）
- 设计思想：[[后端/Java基础/面向对象进阶]]（面向接口编程、依赖倒置、SOLID）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
