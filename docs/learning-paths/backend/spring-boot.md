# Spring Boot 学习路线

Java 企业级开发的事实标准，Spring Boot 把 Spring 框架的强大功能打包成开箱即用的体验。不用写一堆 XML 配置，不用纠结依赖版本，约定优于配置，让你专注业务逻辑。

## 为什么选择 Spring Boot

Spring 框架很强大，但配置太繁琐。Spring Boot 说：我帮你配好，你直接用。它内置了 Tomcat/Jetty，自动配置数据库连接、日志、缓存等，提供了生产级的监控和管理功能。

Java 生态最成熟，Spring Boot 是这个生态的集大成者。金融、电商、企业软件，哪里都有它的身影。

## 学习路线图

### 基础篇：Spring Boot 核心

- **项目初始化**
  - Spring Initializr 使用
  - Maven/Gradle 依赖管理
  - 项目结构和启动类
  - 配置文件（application.properties/yml）

- **自动配置原理**
  - @SpringBootApplication 注解解析
  - @EnableAutoConfiguration 自动配置
  - spring.factories 文件机制
  - 条件注解：@ConditionalOnClass、@ConditionalOnBean
  - 自动配置的加载顺序
  - 自定义自动配置类
  - @ConfigurationProperties 配置绑定

- **Starter 机制**
  - Starter 的设计理念
  - spring-boot-starter 依赖管理
  - 自定义 Starter 开发
  - Starter 命名规范
  - META-INF/spring.factories 配置
  - 常用 Starter 分析：web、data-jpa、redis

- **依赖注入与 IoC**
  - @Component、@Service、@Repository
  - @Autowired 自动装配
  - 构造函数注入 vs 字段注入
  - @Qualifier 和 @Primary
  - Bean 作用域和生命周期

- **Spring IoC 容器深入**
  - BeanFactory vs ApplicationContext
  - Bean 的实例化过程
  - Bean 的初始化和销毁回调
  - @PostConstruct 和 @PreDestroy
  - BeanPostProcessor 后置处理器
  - BeanFactoryPostProcessor 工厂后置处理器
  - 循环依赖的处理：三级缓存机制

- **RESTful API**
  - @RestController 和 @Controller
  - @RequestMapping 和快捷注解
  - @PathVariable、@RequestParam、@RequestBody
  - ResponseEntity 响应处理
  - HTTP 状态码控制

- **数据传输对象**
  - DTO 设计模式
  - 请求验证（@Valid、@NotNull、@Size）
  - 数据转换（MapStruct、ModelMapper）
  - 响应模型定制

- **配置管理**
  - 配置文件结构
  - @Value 注入配置
  - @ConfigurationProperties
  - Profile 多环境配置
  - 外部化配置

### 进阶篇：数据访问与安全

- **Spring Data JPA**
  - Entity 实体定义
  - Repository 接口
  - 自定义查询方法
  - @Query 注解查询
  - 分页和排序
  - 关系映射（@OneToMany、@ManyToOne、@ManyToMany）

- **数据库操作**
  - JPA CRUD 操作
  - 查询方法命名规则
  - Specification 动态查询
  - QueryDSL 查询
  - 原生 SQL 查询
  - 事务管理（@Transactional）

- **Spring AOP 面向切面编程**
  - AOP 核心概念：切面、切点、通知
  - @Aspect 定义切面
  - @Before、@After、@Around、@AfterReturning、@AfterThrowing
  - 切点表达式：execution、within、@annotation
  - JoinPoint 和 ProceedingJoinPoint
  - AOP 的应用场景：日志、权限、事务
  - AOP 实现原理：JDK 动态代理 vs CGLIB

- **事务管理深入**
  - @Transactional 注解详解
  - 事务传播机制：REQUIRED、REQUIRES_NEW、NESTED
  - 事务隔离级别
  - 事务回滚规则：rollbackFor、noRollbackFor
  - 编程式事务：TransactionTemplate
  - 分布式事务：Seata、两阶段提交
  - 事务失效场景与解决方案

- **异常处理**
  - @ControllerAdvice 全局异常处理
  - @ExceptionHandler 异常处理器
  - 自定义异常类
  - 统一错误响应格式
  - 验证异常处理

- **Spring Security**
  - 安全配置
  - 认证和授权
  - JWT 令牌集成
  - 密码加密（BCrypt）
  - 方法级安全（@PreAuthorize、@Secured）
  - OAuth2 和 SSO

- **过滤器与拦截器**
  - Filter 过滤器
  - HandlerInterceptor 拦截器
  - 请求/响应拦截
  - 日志和性能监控
  - 跨域配置（CORS）

### 实战篇：高级特性与部署

- **文件上传与下载**
  - MultipartFile 处理
  - 文件存储策略
  - 文件类型验证
  - 大文件处理
  - 流式下载

- **缓存**
  - @Cacheable、@CachePut、@CacheEvict
  - Redis 缓存集成
  - 缓存管理器配置
  - 缓存失效策略
  - 分布式缓存

- **异步处理**
  - @Async 异步方法
  - 线程池配置
  - CompletableFuture
  - 异步结果处理
  - 异常处理

- **定时任务**
  - @Scheduled 定时任务
  - Cron 表达式
  - 固定延迟和固定速率
  - 动态任务调度
  - Quartz 集成

- **消息队列**
  - RabbitMQ 集成
  - Kafka 集成
  - 消息发送和接收
  - 消息确认机制
  - 死信队列

- **日志管理**
  - Logback 配置
  - 日志级别控制
  - 日志文件轮转
  - 异步日志
  - MDC 追踪

- **监控与管理**
  - Spring Boot Actuator
  - 健康检查端点
  - Metrics 指标
  - 自定义端点
  - Prometheus 集成

- **Spring Boot Actuator 深入**
  - 内置端点详解：health、info、metrics、env
  - 自定义健康检查：HealthIndicator
  - 自定义指标：MeterRegistry
  - 端点安全配置
  - 远程监控：Spring Boot Admin
  - APM 集成：Micrometer、Prometheus、Grafana
  - 生产级监控指标设计

- **Spring 事件机制**
  - ApplicationEvent 事件模型
  - @EventListener 事件监听器
  - 自定义事件发布与监听
  - 异步事件处理：@Async
  - 事件顺序控制：@Order
  - 事务事件：@TransactionalEventListener
  - 事件的应用场景：解耦、审计

- **API 文档**
  - Swagger/OpenAPI 集成
  - API 注解
  - 文档定制
  - 在线调试

- **测试**
  - @SpringBootTest 集成测试
  - @WebMvcTest Web 层测试
  - @DataJpaTest 数据层测试
  - MockMvc 模拟请求
  - Mockito Mock 对象
  - 测试覆盖率

- **部署**
  - JAR 打包和运行
  - WAR 部署到容器
  - Docker 容器化
  - Kubernetes 部署
  - CI/CD 集成

- **微服务**
  - Spring Cloud 生态
  - 服务注册与发现（Eureka、Consul）
  - 配置中心（Config Server）
  - API 网关（Gateway）
  - 负载均衡（Ribbon）
  - 熔断器（Resilience4j）

- **性能优化**
  - 数据库连接池（HikariCP）
  - 查询优化和索引
  - JVM 调优
  - 响应压缩
  - 静态资源优化

## 下一步学习

- **Spring Cloud**：微服务全家桶
- **响应式编程**：Spring WebFlux
- **gRPC**：高性能 RPC
- **GraphQL**：Spring for GraphQL
- **事件驱动**：Spring Cloud Stream

## 源码篇：Spring Boot 源码分析

### 启动流程源码
- SpringApplication.run() 启动入口
- SpringApplicationRunListeners 监听器
- prepareEnvironment：环境准备
- createApplicationContext：容器创建
- prepareContext：容器准备阶段
- refreshContext：容器刷新（核心）
- ApplicationRunner 和 CommandLineRunner 执行

### 自动配置源码
- AutoConfigurationImportSelector 选择器
- spring.factories 加载机制
- 条件注解的判断逻辑
- @Conditional 注解处理器
- ConfigurationClassPostProcessor 配置类处理
- 自动配置的排序与过滤

### Spring IoC 容器源码
- AbstractApplicationContext.refresh()
- BeanDefinition 注册过程
- Bean 实例化：createBean()
- 属性填充：populateBean()
- 初始化：initializeBean()
- 三级缓存解决循环依赖
- AOP 代理的创建时机

### Spring AOP 源码
- ProxyFactory 代理工厂
- JdkDynamicAopProxy 动态代理
- CglibAopProxy CGLIB 代理
- 拦截器链的执行流程
- @Transactional 注解的处理

---

Spring Boot 是 Java 企业级开发的首选，生态成熟、文档齐全、社区活跃。虽然学习曲线比 Node.js 或 Python 框架陡一些，但掌握后你会发现它的设计非常优雅，值得投入时间深入学习。
