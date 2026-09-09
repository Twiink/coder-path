# Spring Boot 学习路线

Spring Boot 是 Java 企业级开发的事实标准:它把 Spring 框架(IoC/AOP/事务……)打包成"开箱即用"——内嵌 Tomcat、自动配置、starter 依赖管理,**不用 XML,不用纠结版本,约定优于配置**。金融、电商、企业软件,哪里都有它的身影。学习曲线比 Node/Python 框架陡(容器、代理、事务的概念密度大),但掌握后你会发现它的设计极其优雅,而且**岗位量与生态成熟度让这份投入非常值**。前置:扎实的 [Java](/learning-paths/languages/java) 基础(集合/反射/注解/多线程)与 SQL 基础。

这条线按 **快速开始 → 自动配置原理 → IoC 与 DI → REST API → 数据访问 → AOP → 事务 → 异常处理 → Spring Security → 缓存/异步/定时 → 消息与事件 → 监控 → 测试 → 部署与源码** 推进。

## 第一站:快速开始

**项目生成**:start.spring.io 或 IDEA 内置 Initializr——选依赖(Web/Validation/Data JPA/Security……)即得可运行项目;**启动类**:`@SpringBootApplication`(= @SpringBootConfiguration + **@EnableAutoConfiguration** + @ComponentScan)+ `main` 里 `SpringApplication.run(XxxApplication.class)`;**配置**:`application.yml`(端口/数据源/日志……),`spring-boot-devtools` 开发热重启;**依赖**:starter 机制(`spring-boot-starter-web` 一个坐标带齐 web 全家——版本由 Boot BOM 统一管理,不写版本号);目录结构(src/main/java + resources、启动类放根包——**组件扫描的边界**)。第一个接口:Controller + @GetMapping 返回 JSON。

## 第二站:自动配置与 Starter 原理——"零配置"的秘密

Boot 凭什么不写配置就能连数据库?答案:**自动配置类 + 条件注解**。启动时 `@EnableAutoConfiguration` 加载 `META-INF/spring/...AutoConfiguration.imports`(Boot 3;2.x 是 spring.factories)里注册的自动配置类(DataSourceAutoConfiguration、JpaRepositoriesAutoConfiguration……);每个自动配置类用**条件注解**按需生效:`@ConditionalOnClass`(classpath 有驱动才配)、`@ConditionalOnMissingBean`(你自定义了就不覆盖)、`@ConditionalOnProperty`(按配置开关)——**"有才配、你配了我不动"是自动配置的黄金法则**。**@ConfigurationProperties**(强类型配置绑定):`@ConfigurationProperties(prefix = "app.jwt")` + 类字段,自动绑定 yml——比 @Value 散装注入优雅;开启 @EnableConfigurationProperties 或 @Component 注册;**自定义 Starter**(给团队/公司写公共组件时):命名规范 `xxx-spring-boot-starter`、自动配置类 + imports 文件 + spring.factories(旧)——会写 starter 才算真懂自动配置。

## 第三站:IoC 容器与依赖注入

**Bean 注册**:@Component 族(通用/@Service 业务/@Repository 数据/@Controller 控制——**语义注解,扫描与代理有区别**)与 @Configuration + @Bean(第三方类:RestTemplate/RedisTemplate);**注入**:构造器注入(推荐:final 字段、不可变、易测——**Spring 官方也推荐**)vs 字段 @Autowired(简洁但难测、隐藏依赖)vs setter;多实现选择:@Qualifier("name")/@Primary(默认优先);@Value 注配置;**作用域**:singleton(默认,一个容器一个——**无状态服务 bean**)/prototype(每次新)/request/session(Web);**生命周期**:@PostConstruct(初始化,依赖注入完成后)/@PreDestroy(销毁前)/InitializingBean;BeanPostProcessor(bean 创建后置处理——AOP 代理的注入点);**为什么 Controller/Service 常配接口**:JDK 动态代理需要接口(事务/AOP 生效的前提之一);**循环依赖**(两个 bean 互相依赖):Spring 用**三级缓存**(singletonObjects(成品)/earlySingletonObjects(半成品)/singletonFactories(工厂))解决 setter/字段循环;**构造器循环无解**(bean 都没建完没法给对方)——解法 @Lazy;这些是 Spring 面试的深水区,但理解它们能解释 90% 的"启动失败/代理不生效"。

## 第四站:REST API 开发

**@RestController**(= @Controller + @ResponseBody,方法返回值直接 JSON);**路由**:@RequestMapping + 快捷注解(@GetMapping/@PostMapping/@PutMapping/@DeleteMapping/@PatchMapping),路径变量 @PathVariable、查询 @RequestParam(required/defaultValue)、请求体 @RequestBody(自动 JSON 反序列化)、@RequestHeader;DTO 校验:@Valid 触发(spring-boot-starter-validation):DTO 字段加 @NotNull/@NotBlank/@Size/@Email/@Pattern——**请求入口全校验**(Bean Validation 标准);**响应**:ResponseEntity<T>(状态码/响应头/Location)或统一 Result<T>(code/message/data——团队约定,别混用);业务分层:Controller(薄:参数与响应)→ Service(@Service,事务与业务)→ Repository;**API 规范**:资源复数/状态码语义/版本化(见 [全栈路线](/learning-paths/fullstack/overview))。

## 第五站:数据访问

**Spring Data JPA**(Java 持久层标准,基于 Hibernate):**Entity**:@Entity + @Table + @Id @GeneratedValue + @Column + @Enumerated;**Repository**:接口继承 JpaRepository<User, Long> 即得 CRUD——**方法命名查询**(findByEmailAndStatus、countByXxx、existsBy——Spring 按方法名解析 SQL)、**@Query**(JPQL 或 nativeQuery=true 原生 SQL)、分页(Pageable/Page)、Specification 或 QueryDSL(多条件动态查询:筛选列表);**关系映射**:@OneToMany/@ManyToOne/@ManyToMany(mappedBy、joinTable)+ **fetch = LAZY**(默认一对多懒加载——**懒加载发生在事务外会 LazyInitializationException**,经典坑)+ **N+1 问题**(循环里查库:join fetch / @EntityGraph 预加载);**实体与 DTO 转换**:MapStruct(编译期生成,性能好)或手动(别把 Entity 直接吐给前端——密码/内部字段泄露与循环引用);**事务**见第七站;**国产替代 MyBatis-Plus**(国内互联网公司极流行:注解 SQL/XML 分离/代码生成器——会 JPA 后按需补);**连接池**:默认 HikariCP(性能最好,配置 maximum-pool-size 等)。

## 第六站:AOP——切面编程

**AOP(Aspect Oriented)**:把横切逻辑(日志/鉴权/事务/耗时/审计)从业务里抽出来——**切面 Aspect(切点+通知)、切点 Pointcut(匹配哪些方法:execution(* com.demo.service.*.*(..)) 表达式、@annotation(xxx) 匹配注解)、通知 Advice:@Before/@After/@AfterReturning/@AfterThrowing/@Around(最强:ProceedingJoinPoint 手动控制,日志与耗时统计用它)**;实战:**自定义注解 + @annotation 切点**(@OperationLog 注解标方法、切面里记录操作日志——中后台系统标配);**原理**:Spring AOP 基于**动态代理**——有接口用 JDK 动态代理(Proxy),无接口用 **CGLIB(Boot 2+ 默认,基于继承)**——所以 final 方法/类无法被代理、同类内自调用不走代理(**事务/AOP 失效头号原因**,要注入 self 或用 AopContext.currentProxy())。

## 第七站:事务管理

**@Transactional**(Spring 声明式事务的核心):默认**运行时异常(RuntimeException)回滚、受检异常不回滚**——要全回滚写 `rollbackFor = Exception.class`(经典坑:catch 住异常再抛出导致不回滚/事务失效);**传播机制(propagation)七种**:REQUIRED(默认:有事务加入,没有新建)/REQUIRES_NEW(挂起当前、开新事务——**日志表独立提交**场景)/NESTED(嵌套保存点,内层回滚不影响外层已提交部分)/SUPPORTS/MANDATORY/NOT_SUPPORTED/NEVER——前三种是面试核心;**隔离级别**(isolation):与数据库概念对应(读未提交/读已提交/可重复读/串行化,见 [MySQL 路线](/learning-paths/database/mysql));**失效场景大全**(面试必考):同类自调用、private 方法、异常被 try-catch 吞掉、多线程里调(@Transactional 绑线程)、非 Spring 管理的对象;**编程式事务**:TransactionTemplate(细粒度控制);**分布式事务**:Seata/2PC/TCC(微服务场景,见 [微服务路线](/learning-paths/microservices/spring-cloud))。

## 第八站:全局异常处理

**@RestControllerAdvice + @ExceptionHandler**(全局异常中心,替代每个 Controller try-catch):`@ExceptionHandler(BizException.class)` 返回统一错误码;`@ExceptionHandler(MethodArgumentNotValidException.class)`(DTO 校验失败 → 400/422 + 字段错误明细——**前端表单报错的标准数据源**);**自定义业务异常**:继承 RuntimeException + code(如 UserNotFoundException extends BizException)——业务里 throw,切面外统一兜;**统一响应结构**(Result<T> + 错误码表 + i18n 消息)。**过滤器与拦截器**(请求链路的两个层次):`Filter`(Servlet 级,最早最外:编码、CORS 预检、请求日志——注册 @Component 或 FilterRegistrationBean)vs `HandlerInterceptor`(Spring MVC 级:preHandle(登录校验/权限)/postHandle/afterCompletion——注册到 WebMvcConfigurer)——面试常问区别与顺序:Filter → DispatcherServlet → Interceptor → Controller。

## 第九站:Spring Security 与认证授权

**Spring Security**(Java 安全标准,学习曲线最陡的一站):**核心概念**:SecurityFilterChain(过滤器链:每个请求过一组安全过滤器)、Authentication(认证信息)、SecurityContext(当前线程上下文)、UserDetailsService(查用户)、PasswordEncoder(BCrypt——**永远别明文**);**JWT 无状态认证架构**(现代 API 标配):登录接口用 AuthenticationManager 校验 → 签发 JWT(github 的 jjwt 或 java-jwt)→ **JwtAuthenticationFilter**(OncePerRequestFilter:解析 Authorization: Bearer → 验证签名与过期 → 塞 SecurityContext)→ 后续接口从 SecurityContext 拿当前用户;**SecurityFilterChain 配置**:`authorizeHttpRequests`(放行白名单:/api/auth/**,其余 authenticated)、sessionCreationPolicy STATELESS、csrf disable(无状态 API)、cors、exceptionHandling(401/403 JSON);**方法级安全**:@EnableMethodSecurity + @PreAuthorize("hasRole('ADMIN')")/@Secured;`spring-boot-starter-oauth2-resource-server`(官方 JWT 资源服务器姿势,含 JWK 校验);OAuth2 登录(第三方)/SSO 概念见 [认证授权路线](/learning-paths/security/auth)。

## 第十站:缓存、异步与定时

**缓存抽象**(spring-boot-starter-cache + Redis):@Cacheable(cacheNames + key SpEL——**击穿/穿透/雪崩的应对**:空值缓存/随机过期/互斥锁,见 [Redis 路线](/learning-paths/database/redis))、@CachePut(更新)、@CacheEvict(失效,allEntries 清空)、@Caching 组合;RedisCacheManager 配置(序列化 Jackson/JSON、TTL、key 前缀);**异步 @Async**:@EnableAsync + 方法加 @Async(默认 SimpleAsyncTaskExecutor——**生产必须自定义线程池**:核心/最大/队列/拒绝策略;异步方法同类自调用同样失效;异常默认丢失,配 AsyncUncaughtExceptionHandler);CompletableFuture 编排(见 [Java 路线](/learning-paths/languages/java));**定时 @Scheduled**:@EnableScheduling + @Scheduled(cron 六段式/fixedDelay(上次结束算)/fixedRate(上次开始算))——**默认单线程,任务重叠会排队**:长任务自己吃线程;多实例部署会重复执行(分布式锁 Redisson/`ShedLock` 保证单点);复杂调度 Quartz。

## 第十一站:消息与事件驱动

**消息队列集成**:spring-boot-starter-amqp(RabbitMQ:RabbitTemplate 发、@RabbitListener 收——交换机/队列/死信见 [RabbitMQ 路线](/learning-paths/middleware/rabbitmq))与 spring-kafka(@KafkaListener/生产者——见 [Kafka 路线](/learning-paths/middleware/kafka))——**异步解耦/削峰**的架构级工具;**Spring 事件**(应用内解耦,比 MQ 轻):ApplicationEventPublisher.publishEvent + @EventListener 监听(默认同步——监听器抛错影响主流程,注意)/@Async 异步事件/@TransactionalEventListener(phase = AFTER_COMMIT:**事务提交后才发事件**——解决"事件发了但事务回滚"的经典问题,领域事件的标准姿势)、@Order 控制顺序。

## 第十二站:日志、监控与文档

**日志**:默认 Logback——logback-spring.xml(级别/格式/滚动 RollingFileAppender(按天+大小)/**AsyncAppender(异步写,别让日志拖慢接口)**);**MDC**(日志链路追踪:过滤器里 MDC.put("traceId", UUID) → 日志 pattern 输出 %X{traceId}——排查一次请求的全链路日志,分布式用 OpenTelemetry/SkyWalking);**Actuator(生产监控)**::management.endpoints.web.exposure.include=health,info,metrics,env(prometheus)——**/actuator/health(探针:数据库/Redis 存活探测,K8s 就靠它)、自定义 HealthIndicator(业务依赖状态)、Micrometer 指标 + micrometer-registry-prometheus(/actuator/prometheus → Prometheus → Grafana 看板)**、/env 暴露配置(生产脱敏!)、Spring Boot Admin(多实例可视化管理);**API 文档**:springdoc-openapi(swagger-ui:自动从 Controller 与 DTO 生成——@Tag/@Operation/@Schema 完善;knife4j 国内增强 UI),**文档与代码同源**。

## 第十三站:测试

**测试金字塔的 Spring 版**:@SpringBootTest(全容器集成测试:起真实上下文,配 @ActiveProfiles("test") + H2 或 **Testcontainers**(真实 MySQL/Redis 容器——现代集成测试标配));**切片测试**(只起需要的层,快):@WebMvcTest(只测 Controller 层,自动 mock 下层 @MockBean)+ **MockMvc**(mockMvc.perform(get("/api/users/1")).andExpect(status().isOk())——接口测试的标准姿势)、@DataJpaTest(只测 Repository);**Mockito**(when/thenReturn/verify——mock 外部依赖)、AssertJ(流畅断言);覆盖率 JaCoCo;**测试策略**:Service 业务逻辑全覆盖、Controller 测契约(状态码/JSON 结构/校验 400)、安全规则测 401/403、事务回滚场景必测。

## 第十四站:部署、性能与源码

**部署**:`mvn package` 出可执行 JAR(`java -jar app.jar`,内嵌 Tomcat——WAR 外置已是历史)、Docker 多阶段镜像(或 spring-boot-maven-plugin 的 build-image/jib 分层镜像——**分层缓存让 Java 镜像构建不再痛苦**)、K8s 部署(actuator 探针 + ConfigMap 配置,见 [K8s 路线](/learning-paths/devops/kubernetes))、CI/CD;**性能**:HikariCP 连接池参数、索引与 N+1、Redis 缓存、响应压缩、JVM 参数(-Xmx/GC,见 [Java 路线](/learning-paths/languages/java) 的 JVM 章);**WebFlux**(响应式编程:Netty + 非阻塞——高并发 IO 赛道的另一选择,与 MVC 二选一,了解概念即可);**微服务**:Spring Cloud 生态(注册发现 Nacos/Eureka、网关、配置中心、熔断——见 [Spring Cloud 路线](/learning-paths/microservices/spring-cloud));**源码阅读(进阶)**:从 `SpringApplication.run()` 出发:prepareEnvironment → createApplicationContext → **refresh()(容器启动的核心:BeanFactory 创建与注册 → BeanPostProcessor → 单例实例化(三级缓存解循环)→ 事件发布)**;自动配置(ConfigurationClassPostProcessor 处理 @Configuration/AutoConfigurationImportSelector);AOP 代理创建时机(BeanPostProcessor 在 bean 初始化后包代理)——建议配合"手写迷你 Spring"类教程,把 IoC/AOP 各实现一遍,胜过读十遍源码。

## 通关标准

能独立做到:用 Initializr 搭项目并写出分层完整、带 DTO 校验、全局异常、统一响应的 CRUD API;说清自动配置的条件注解机制、构造器注入 vs 字段注入、三级缓存解决的是什么;@Transactional 的失效场景能列全并解释为什么;会用 JwtAuthenticationFilter + SecurityFilterChain 配出无状态 JWT 认证并保护路由;AOP 自定义注解切面做操作日志;会写 @SpringBootTest/MockMvc/Mockito 三层测试;把 actuator + Prometheus 接上——Spring Boot 主线通关。

Spring Boot 是 Java 生态的集大成者:它替你决策(自动配置),也把最难的决策留给你(事务边界、安全模型、代理原理)——所以"会用"只需一周,"用对"需要数年。别被陡峭的学习曲线劝退:每搞懂一个概念(容器、代理、事务传播),你的 Java 后端能力就上一个台阶;而这些概念在 Spring Cloud、任何 Java 中间件源码里全都复用。从 start.spring.io 的第一个接口开始,一步一步,你会理解为什么企业级 Java 二十年不倒。
