---
title: "Spring注解大全与配置类"
aliases:
  - "Spring 注解"
  - "@Conditional"
  - "@Import"
tags:
  - "后端"
  - "java"
  - "spring"
  - "速查"
category: "后端"
folder: "Spring"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Spring/Spring概述与IoC容器]]"
  - "[[后端/SpringBoot/自动配置原理]]"
  - "[[后端/Spring/Bean生命周期与作用域]]"
  - "[[后端/Spring/AOP面向切面编程]]"
created: 2026-09-07
updated: 2026-09-07
---

# Spring 注解大全与配置类

> 本篇是 **Spring 注解的速查手册 + 高级配置类机制**。基础注解的用法穿插在各篇中，这里做系统性汇总；`@Conditional`、`@Import`、`FactoryBean` 是 Spring Boot 自动配置的基石，重点讲解。

## 1. 注解分类总览 ★★★★★

```
Spring 注解体系
├── ① 组件注册（把类变成 Bean）
│     @Component @Service @Repository @Controller @RestController
│     @Configuration @Bean @ControllerAdvice @RestControllerAdvice
│     @Aspect @Mapper（MyBatis） @FeignClient（Feign）
├── ② 组件扫描
│     @ComponentScan @SpringBootApplication
├── ③ 依赖注入
│     @Autowired @Qualifier @Resource @Value @Inject
│     @Primary @Lazy @Lookup
├── ④ 条件装配（★ Boot 自动配置的核心）
│     @Conditional @Profile
│     @ConditionalOnClass @ConditionalOnMissingBean @ConditionalOnProperty ...
├── ⑤ 配置导入
│     @Import @ImportResource @PropertySource @EnableXxx
├── ⑥ Web MVC
│     @RequestMapping @GetMapping ... @RequestParam @PathVariable @RequestBody
│     @ResponseBody @ModelAttribute @RequestHeader @CookieValue
│     @CrossOrigin @SessionAttributes @InitBinder
├── ⑦ 生命周期
│     @PostConstruct @PreDestroy
├── ⑧ AOP
│     @Aspect @Pointcut @Before @After @AfterReturning @AfterThrowing @Around
├── ⑨ 事务
│     @Transactional @EnableTransactionManagement @TransactionalEventListener
├── ⑩ 异步与调度
│     @Async @EnableAsync @Scheduled @EnableScheduling @Schedules
├── ⑪ 缓存
│     @Cacheable @CachePut @CacheEvict @Caching @CacheConfig @EnableCaching
├── ⑫ 校验
│     @Valid @Validated + JSR-380 注解
├── ⑬ 测试
│     @SpringBootTest @WebMvcTest @DataJpaTest @MockBean @TestConfiguration
└── ⑭ Boot 专属
      @SpringBootApplication @EnableAutoConfiguration @ConfigurationProperties
      @EnableConfigurationProperties @SpringBootConfiguration
```

## 2. 组件注册注解详解

### 2.1 四个 stereotype 注解

```java
@Component      // ★ 通用组件（所有其他三个的「父注解」）
@Service        // ★ 业务层（语义化）
@Repository     // ★ 持久层（★ 额外功能：异常转换）
@Controller     // ★ Web 层（返回视图）
@RestController // = @Controller + @ResponseBody（返回 JSON）
```

| 注解 | 功能差异 | 特殊行为 |
| --- | --- | --- |
| `@Component` | 基础 | 无 |
| `@Service` | 与 `@Component` **功能完全相同** | 仅语义区分 |
| **`@Repository`** | 与 `@Component` 相同 | ★ **额外**：`PersistenceExceptionTranslationPostProcessor` 把 JDBC/JPA 异常转换为 Spring 的 `DataAccessException`（如唯一键冲突 → `DuplicateKeyException`） |
| `@Controller` | 与 `@Component` 相同 | 被 `RequestMappingHandlerMapping` 识别为处理器 |
| `@RestController` | = `@Controller` + `@ResponseBody` | 所有方法返回值直接序列化为响应体 |

```java
// @Repository 的异常转换示例
@Repository
public class UserDaoImpl implements UserDao {
    public void insert(User u) {
        jdbcTemplate.update("INSERT ...");
        // 抛出的 SQLIntegrityConstraintViolationException（JDBC 原生）
        // 会被自动转换为 DuplicateKeyException（Spring 的非受检异常）★
    }
}
// 需要开启：<context:component-scan> 会自动注册 PersistenceExceptionTranslationPostProcessor
// 或手动：@Bean PersistenceExceptionTranslationPostProcessor

// Bean 命名规则（★ 四个注解通用）
@Service                                    // Bean 名 = "userServiceImpl"（类名首字母小写）
@Service("userService")                      // ★ 显式指定
@Service(UserService.SERVICE_NAME)            // 常量（必须是编译期常量）
// 特殊情况：类名前两个字母都大写时，保持原样
// 如 UserService → "userService"；但 UService → "UService"（不转小写！）
// 规则来自 java.beans.Introspector.decapitalize()
```

### 2.2 @Configuration 与 @Bean

```java
@Configuration                                    // ★ 配置类（full 模式，CGLIB 代理）
@Configuration(proxyBeanMethods = false)           // ★ lite 模式（Boot 自动配置都用这个，启动更快）
public class AppConfig {

    @Bean                                          // ★ Bean 名 = 方法名
    @Bean("customName")                            // 指定名称
    @Bean(name = {"a", "b", "c"})                  // ★ 名称 + 别名
    @Bean(initMethod = "init", destroyMethod = "close")   // 生命周期方法
    @Scope("prototype")                            // 作用域
    @Lazy                                          // 懒加载
    @Primary                                       // 同类型多 Bean 时优先
    @ConditionalOnMissingBean                      // 条件装配
    @Profile("dev")                                // 环境
    @Order(1)                                      // 顺序（对 List 注入生效）
    public DataSource dataSource() { return new DruidDataSource(); }

    /** ★ 参数注入（推荐，避免 @Bean 方法间调用） */
    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    /** ★ 静态 @Bean（BeanFactoryPostProcessor 必须用 static） */
    @Bean
    public static PropertySourcesPlaceholderConfigurer configurer() {
        return new PropertySourcesPlaceholderConfigurer();
    }

    /** ★ 返回 null 表示「条件不满足，不注册」 */
    @Bean
    public OptionalService optionalService() {
        return featureEnabled ? new OptionalServiceImpl() : null;
    }
}
```

**@Configuration 的 full / lite 模式**（详见 [[后端/Spring/Spring概述与IoC容器]] 3.2 节）：

| | full（`@Configuration`） | lite（`proxyBeanMethods=false` 或 `@Component`） |
| --- | --- | --- |
| CGLIB 代理 | ✅ | ❌ |
| `@Bean` 方法互调 | 返回容器单例 | ★ 每次新建对象（Bug 风险） |
| 启动速度 | 慢 | ★ 快 |
| 适用 | 有互调需求 | Boot 自动配置、无互调 |

### 2.3 @ControllerAdvice 与 @Aspect

```java
// ─── @ControllerAdvice：全局增强 Controller ───
@RestControllerAdvice                           // = @ControllerAdvice + @ResponseBody
@Order(1)                                          // 多个 Advice 的优先级
public class GlobalHandler {
    @ExceptionHandler(BusinessException.class)      // ★ 全局异常处理
    public Result<Void> handle(BusinessException e) { return Result.failed(e.getMsg()); }

    @ModelAttribute                                  // ★ 所有 Controller 方法执行前调用
    public void addCommonAttrs(Model model) { model.addAttribute("appName", "Mall"); }

    @InitBinder                                       // ★ 自定义参数绑定/类型转换
    public void initBinder(WebDataBinder binder) {
        binder.registerCustomEditor(LocalDate.class, new LocalDateEditor());
        binder.setDisallowedFields("id", "password");  // ★ 禁止绑定某些字段（防篡改）
    }
}
// 限定作用范围
@ControllerAdvice(basePackages = "com.example.api")
@ControllerAdvice(assignableTypes = BaseController.class)
@ControllerAdvice(annotations = RestController.class)

// ─── @Aspect：AOP 切面（必须配合 @Component）───
@Aspect
@Component
@Order(10)
public class LogAspect {
    @Pointcut("execution(* com.example.service..*.*(..))")
    public void pointcut() { }

    @Around("pointcut()")
    public Object around(ProceedingJoinPoint pjp) throws Throwable { return pjp.proceed(); }
}
```

## 3. 条件装配注解 ★★★★★（Spring Boot 自动配置的核心）

### 3.1 @Conditional 与 Condition 接口

```java
// ─── @Conditional 是所有条件注解的「父注解」───
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Conditional {
    Class<? extends Condition>[] value();       // ★ 条件判断类
}

// ─── Condition 接口（自己实现条件）───
@FunctionalInterface
public interface Condition {
    /** 返回 true 才注册这个 Bean */
    boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata);
}

// ConditionContext 能拿到的信息
public interface ConditionContext {
    BeanDefinitionRegistry getRegistry();          // Bean 定义注册表
    ConfigurableListableBeanFactory getBeanFactory();
    Environment getEnvironment();                   // ★ 环境（配置、profile）
    ResourceLoader getResourceLoader();
    ClassLoader getClassLoader();
}

// ─── 自定义条件示例：只有 Linux 系统才注册 ───
public class OnLinuxCondition implements Condition {
    @Override
    public boolean matches(ConditionContext ctx, AnnotatedTypeMetadata metadata) {
        String os = ctx.getEnvironment().getProperty("os.name", "").toLowerCase();
        return os.contains("linux");
    }
}

@Configuration
public class NativeConfig {
    @Bean
    @Conditional(OnLinuxCondition.class)             // ★ 条件注册
    public EpollEventLoopGroup epollGroup() { return new EpollEventLoopGroup(); }
}

// ─── 带参数的条件（读取注解属性）───
public class OnFeatureCondition implements Condition {
    @Override
    public boolean matches(ConditionContext ctx, AnnotatedTypeMetadata metadata) {
        // ★ 从注解元数据中读取属性
        Map<String, Object> attrs = metadata.getAnnotationAttributes(ConditionalOnFeature.class.getName());
        String feature = (String) attrs.get("value");
        return ctx.getEnvironment().getProperty("features." + feature, Boolean.class, false);
    }
}
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
@Conditional(OnFeatureCondition.class)               // ★ 元注解组合
public @interface ConditionalOnFeature {
    String value();
}
// 使用
@Bean
@ConditionalOnFeature("export")
public ExportService exportService() { return new ExportService(); }
```

### 3.2 Spring Boot 的条件注解全家桶 ★★★★★

| 注解 | 生效条件 | 典型用途 |
| --- | --- | --- |
| **`@ConditionalOnClass`** | ★ classpath 中**存在**指定类 | 有某个依赖才自动配置（如有 `RedisTemplate` 类才配 Redis） |
| **`@ConditionalOnMissingClass`** | classpath 中**不存在**指定类 | — |
| **`@ConditionalOnBean`** | ★ 容器中**存在**指定 Bean | 依赖其他 Bean 存在 |
| **`@ConditionalOnMissingBean`** | ★★ 容器中**不存在**指定 Bean | **让用户配置覆盖默认配置**（Boot 最核心） |
| **`@ConditionalOnProperty`** | ★ 配置属性满足条件 | `havingValue`、`matchIfMissing` |
| `@ConditionalOnResource` | 存在指定资源文件 | 有 `logback.xml` 才配日志 |
| `@ConditionalOnWebApplication` | 是 Web 应用 | Web 相关配置 |
| `@ConditionalOnNotWebApplication` | 不是 Web 应用 | — |
| `@ConditionalOnExpression` | ★ SpEL 表达式为 true | 复杂条件 |
| `@ConditionalOnJava` | Java 版本匹配 | `range = EQUAL_OR_NEWER, value = JAVA_17` |
| `@ConditionalOnJndi` | JNDI 环境 | 传统企业应用 |
| `@ConditionalOnCloudPlatform` | 指定云平台 | K8s/CF |
| `@ConditionalOnThreading` | 线程模型（Boot 3.2+） | 虚拟线程 vs 平台线程 |
| `@ConditionalOnBoolean`（Boot 3.4+） | 属性为布尔值 | 简化 OnProperty |
| `@Profile` | ★ Spring 的激活环境 | `dev`/`test`/`prod` |

```java
// ═══════ 完整示例：模拟一个 Starter 的自动配置 ═══════

@Configuration(proxyBeanMethods = false)             // ★ lite 模式（性能）
// ─── ① 前提条件：classpath 中必须有 Redis 相关类 ───
@ConditionalOnClass({RedisOperations.class, RedisTemplate.class})
// ─── ② 配置开关：myapp.cache.enabled=true（默认开启）───
@ConditionalOnProperty(prefix = "myapp.cache", name = "enabled",
                       havingValue = "true", matchIfMissing = true)
// ─── ③ 绑定配置属性 ───
@EnableConfigurationProperties(MyCacheProperties.class)
// ─── ④ 导入其他配置 ───
@Import({MyCacheSerializerConfig.class})
@AutoConfiguration(after = RedisAutoConfiguration.class)   // ★ 在其他自动配置之后
public class MyCacheAutoConfiguration {

    /**
     * ★★ @ConditionalOnMissingBean 的精髓：
     * 只有用户【没有】自己定义 RedisTemplate 时，才用这个默认的
     * → 用户配置优先于自动配置（这就是 Boot「约定优于配置」的实现方式）
     */
    @Bean
    @ConditionalOnMissingBean(name = "redisTemplate")     // ★ 按名称判断
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory,
                                                       MyCacheProperties props) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }

    /** 按类型判断 */
    @Bean
    @ConditionalOnMissingBean(CacheManager.class)          // ★ 按类型判断
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        return RedisCacheManager.builder(factory).build();
    }

    /** 按类型 + 忽略某些类型 */
    @Bean
    @ConditionalOnMissingBean(value = DataSource.class, ignored = EmbeddedDataSource.class)
    public DataSource dataSource() { return null; }

    /** 条件：Bean 存在 */
    @Bean
    @ConditionalOnBean(UserService.class)                  // ★ 有 UserService 才注册
    public UserCacheAspect userCacheAspect() { return new UserCacheAspect(); }

    /** 条件：资源存在 */
    @Bean
    @ConditionalOnResource(resources = "classpath:my-cache-rules.json")
    public CacheRuleLoader ruleLoader() { return new CacheRuleLoader(); }

    /** 条件：SpEL 表达式 */
    @Bean
    @ConditionalOnExpression("${myapp.cache.enabled:false} && '${myapp.mode}' == 'advanced'")
    public AdvancedCache advancedCache() { return new AdvancedCache(); }

    /** 条件：Web 应用 */
    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public CacheMonitorEndpoint endpoint() { return new CacheMonitorEndpoint(); }

    /** 条件：Java 版本 */
    @Bean
    @ConditionalOnJava(range = ConditionalOnJava.Range.EQUAL_OR_NEWER,
                       value = ConditionalOnJava.JavaVersion.SEVENTEEN)
    public VirtualThreadExecutor virtualExecutor() { return new VirtualThreadExecutor(); }

    /** ★ 内部配置类（分层条件，更精细） */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(prefix = "myapp.cache", name = "type", havingValue = "redis")
    static class RedisCacheConfig {
        @Bean public RedisCacheWriter writer() { return null; }
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(prefix = "myapp.cache", name = "type", havingValue = "caffeine",
                           matchIfMissing = true)          // ★ 不配 type 时默认用 caffeine
    static class CaffeineCacheConfig {
        @Bean public CaffeineCacheManager manager() { return new CaffeineCacheManager(); }
    }
}

// ═══════ @ConfigurationProperties（类型安全的配置绑定）═══════
@ConfigurationProperties(prefix = "myapp.cache")
@Data
public class MyCacheProperties {
    /** 是否启用 */
    private boolean enabled = true;                        // ★ 默认值
    /** 缓存类型 */
    private CacheType type = CacheType.CAFFEINE;           // 枚举自动转换
    /** 过期时间（支持 30s / 5m / 1h 格式） */
    private Duration ttl = Duration.ofMinutes(30);
    /** 最大条目数 */
    private int maxSize = 10000;
    /** 嵌套对象 */
    private Redis redis = new Redis();
    /** List */
    private List<String> excludeKeys = new ArrayList<>();
    /** Map */
    private Map<String, Duration> keyTtl = new HashMap<>();

    @Data
    public static class Redis {
        private String keyPrefix = "cache:";
        private boolean useKeyPrefix = true;
    }

    public enum CacheType { CAFFEINE, REDIS, BOTH }
}
```

```yaml
# 对应的 application.yml
myapp:
  cache:
    enabled: true
    type: redis
    ttl: 30m                       # ★ Duration 自动解析
    max-size: 10000                # ★ 松散绑定：max-size → maxSize
    redis:
      key-prefix: "mall:cache:"
      use-key-prefix: true
    exclude-keys:                  # ★ List
      - "temp:*"
      - "session:*"
    key-ttl:                       # ★ Map
      user: 1h
      product: 30m
      dict: 24h
```

> 【@ConditionalOnProperty 详解】
> ```java
> @ConditionalOnProperty(
>     prefix = "myapp.cache",           // 前缀
>     name = "enabled",                  // 属性名（完整为 myapp.cache.enabled）
>     havingValue = "true",              // ★ 期望值（属性值等于它才生效）
>     matchIfMissing = true              // ★ 属性不存在时是否视为匹配（默认 false）
> )
> // matchIfMissing=true 的含义：不配置这个属性时也生效（默认开启）
> // 这是 Starter 的常见做法：默认开启，用户可显式关闭
> ```

## 4. 配置导入注解 ★★★★★

### 4.1 @Import 的三种用法

```java
// ─── ① 直接导入配置类/普通类 ───
@Import({DataSourceConfig.class, RedisConfig.class, MyService.class})
// ★ 普通类（没有 @Component）也能被导入并注册为 Bean
@Configuration
public class AppConfig { }

// ─── ② ★ 导入 ImportSelector（动态决定导入哪些类）───
@Import(MyImportSelector.class)
@Configuration
public class AppConfig { }

public class MyImportSelector implements ImportSelector {
    @Override
    public String[] selectImports(AnnotationMetadata importingClassMetadata) {
        // ★ 可以读取导入方的注解信息，动态决定
        Map<String, Object> attrs = importingClassMetadata
                .getAnnotationAttributes(EnableMyFeature.class.getName());
        boolean advanced = (Boolean) attrs.get("advanced");

        List<String> configs = new ArrayList<>();
        configs.add("com.example.config.BasicConfig");
        if (advanced) configs.add("com.example.config.AdvancedConfig");

        // 也可以根据 Environment 判断
        // Environment env = ...;
        return configs.toArray(new String[0]);            // 返回全限定类名数组
    }
}

// ★★ 这就是 @EnableAutoConfiguration 的实现原理！
// AutoConfigurationImportSelector implements DeferredImportSelector
//   → 读取 META-INF/spring/...AutoConfiguration.imports 文件中的所有自动配置类名
//   → 经过 @Conditional 筛选后注册

// ─── ③ ★ 导入 ImportBeanDefinitionRegistrar（编程式注册 BeanDefinition，最强大）───
@Import(MyBeanRegistrar.class)
@Configuration
public class AppConfig { }

public class MyBeanRegistrar implements ImportBeanDefinitionRegistrar, EnvironmentAware {

    private Environment environment;
    @Override public void setEnvironment(Environment env) { this.environment = env; }

    @Override
    public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata,
                                        BeanDefinitionRegistry registry) {
        // ★ 可以编程式注册任意数量的 Bean（MyBatis 的 Mapper、Feign 客户端都是这么注册的）
        // 读取注解属性
        Map<String, Object> attrs = importingClassMetadata
                .getAnnotationAttributes(EnableMyClients.class.getName());
        String[] basePackages = (String[]) attrs.get("basePackages");

        // 扫描接口并注册为 Bean
        for (String pkg : basePackages) {
            for (Class<?> clazz : scanInterfaces(pkg)) {
                BeanDefinitionBuilder builder = BeanDefinitionBuilder
                        .genericBeanDefinition(MyClientFactoryBean.class);
                builder.addConstructorArgValue(clazz);
                builder.addPropertyValue("timeout", environment.getProperty("client.timeout", "5000"));
                registry.registerBeanDefinition(
                        Introspector.decapitalize(clazz.getSimpleName()),
                        builder.getBeanDefinition());
            }
        }
    }
}

// ─── ④ 导入 ConfigurationClass 的其他形式 ───
// DeferredImportSelector（★ 延迟导入，在所有配置类处理完后执行 —— 自动配置用它）
public class MyDeferredSelector implements DeferredImportSelector {
    @Override public String[] selectImports(AnnotationMetadata metadata) { return new String[0]; }
    @Override public Class<? extends Group> getImportGroup() { return MyGroup.class; }   // 分组处理
}
```

**三种方式的对比：**

| 方式 | 能力 | 典型应用 |
| --- | --- | --- |
| 直接导入类 | 静态导入固定的类 | 模块化组织配置 |
| **`ImportSelector`** | 返回**类名字符串数组**，动态决定 | ★ `@EnableAutoConfiguration` |
| **`ImportBeanDefinitionRegistrar`** | ★ **编程式注册 BeanDefinition**（最灵活） | MyBatis `@MapperScan`、Feign `@EnableFeignClients` |

```java
// ─── @EnableXxx 注解的实现套路（★ 看懂这个就看懂了所有 Enable 注解）───
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Import(SchedulingConfiguration.class)                    // 方式 1：直接导入配置类
public @interface EnableScheduling { }

@Import(AsyncConfigurationSelector.class)                  // 方式 2：导入 Selector
public @interface EnableAsync {
    boolean proxyTargetClass() default false;
    AdviceMode mode() default AdviceMode.PROXY;
    int order() default Ordered.LOWEST_PRECEDENCE;
}

@Import(TransactionManagementConfigurationSelector.class)   // 方式 3：Selector 里再分支
public @interface EnableTransactionManagement {
    boolean proxyTargetClass() default false;
    AdviceMode mode() default AdviceMode.PROXY;             // PROXY / ASPECTJ
    int order() default Ordered.LOWEST_PRECEDENCE;
}

@Import(MapperScannerRegistrar.class)                       // 方式 4：Registrar（编程式注册）
@Repeatable(MapperScans.class)
public @interface MapperScan {
    String[] value() default {};
    String[] basePackages() default {};
    Class<?>[] basePackageClasses() default {};
    Class<? extends Annotation> annotationClass() default Annotation.class;
    String sqlSessionFactoryRef() default "";
    String sqlSessionTemplateRef() default "";
}

// 结论：★ @EnableXxx 本质就是「@Import + 一个配置类/Selector/Registrar」的语法糖
```

### 4.2 @PropertySource 与 @ImportResource

```java
// ─── @PropertySource：加载 .properties 到 Environment ───
@PropertySource("classpath:jdbc.properties")                  // 单个
@PropertySource(value = {"classpath:a.properties", "classpath:b.properties"})   // 多个
@PropertySource(value = "classpath:secret.properties", ignoreResourceNotFound = true)  // 不存在不报错
@PropertySource(value = "classpath:app.properties", encoding = "UTF-8")          // ★ 编码
@PropertySource(value = "classpath:app.properties", factory = MyPropertySourceFactory.class)  // 自定义（支持 YAML）

// 使用
@Value("${jdbc.url}") private String url;
environment.getProperty("jdbc.url");

// ★ 加载 YAML（需要自定义 Factory，因为默认只支持 properties）
public class YamlPropertySourceFactory implements PropertySourceFactory {
    @Override
    public PropertySource<?> createPropertySource(String name, EncodedResource resource) throws IOException {
        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(resource.getResource());
        Properties props = factory.getObject();
        return new PropertiesPropertySource(
                name != null ? name : resource.getResource().getFilename(), props);
    }
}
@PropertySource(value = "classpath:custom.yml", factory = YamlPropertySourceFactory.class)

// ⚠️ @PropertySource 【不支持】加载 application.yml（Boot 的配置文件由 ConfigFileApplicationListener 处理）
// ⚠️ @PropertySource 的属性优先级【低于】application.yml 和命令行参数

// ─── @ImportResource：导入老的 XML 配置（迁移期用）───
@ImportResource("classpath:spring/legacy.xml")
@ImportResource(locations = {"classpath:a.xml", "classpath:b.xml"},
                reader = XmlBeanDefinitionReader.class)
@Configuration
public class AppConfig { }

// ─── 属性优先级（★ 从高到低，Boot 中）───
// ① 命令行参数（--server.port=9090）
// ② SPRING_APPLICATION_JSON
// ③ ServletConfig / ServletContext 参数
// ④ JNDI（java:comp/env）
// ⑤ System.getProperties()（-Dserver.port=9090）
// ⑥ 操作系统环境变量
// ⑦ RandomValuePropertySource（random.*）
// ⑧ jar 外部的 application-{profile}.yml
// ⑨ jar 内部的 application-{profile}.yml
// ⑩ jar 外部的 application.yml
// ⑪ jar 内部的 application.yml
// ⑫ @PropertySource
// ⑬ SpringApplication.setDefaultProperties()
```

## 5. 常用注解速查表 ★★★★★

### 5.1 生命周期与注入

| 注解 | 位置 | 作用 |
| --- | --- | --- |
| `@PostConstruct` | 方法 | ★ 初始化后执行（依赖注入完成后） |
| `@PreDestroy` | 方法 | ★ 销毁前执行（singleton 才生效） |
| `@Autowired` | 字段/构造器/setter/方法/参数 | ★ 按类型注入 |
| `@Qualifier("name")` | 配合 @Autowired | 按名称筛选 |
| `@Resource` | 字段/setter | ★ 按名称注入（JSR-250） |
| `@Value("$&#123;x&#125;")` | 字段/参数 | ★ 注入配置值 / SpEL |
| `@Primary` | 类/@Bean | 同类型多 Bean 时优先 |
| `@Lazy` | 类/@Bean/注入点 | ★ 延迟初始化 / 延迟注入代理 |
| `@Scope` | 类/@Bean | singleton/prototype/request/session |
| `@Order(n)` | 类/方法 | 排序（List 注入、切面顺序） |
| `@DependsOn("x")` | 类/@Bean | ★ 强制先初始化指定 Bean |
| `@Lookup` | 方法 | 方法注入（singleton 中获取 prototype） |
| `@Required`（已废弃） | setter | 强制必须注入 |

```java
// @Value 的各种写法
@Value("${app.name}")                       private String name;          // 配置项
@Value("${app.name:默认值}")                 private String name2;          // ★ 带默认值
@Value("${app.list}")                        private List<String> list;     // 逗号分隔自动转 List
@Value("#{'${app.list}'.split(',')}")        private List<String> list2;    // SpEL 分割
@Value("#{T(java.lang.Math).PI}")            private double pi;             // ★ 静态字段
@Value("#{T(java.lang.Math).random() * 100}") private double rand;          // 静态方法
@Value("#{systemProperties['user.home']}")    private String home;           // 系统属性
@Value("#{systemEnvironment['PATH']}")        private String path;           // 环境变量
@Value("#{1 + 2 * 3}")                        private int calc;              // 运算
@Value("#{'hello'.toUpperCase()}")            private String upper;          // 调用方法
@Value("#{otherBean.name}")                   private String ref;            // ★ 引用其他 Bean
@Value("#{otherBean.list.?[age > 18]}")       private List<User> filtered;   // ★ SpEL 过滤
@Value("#{dataSource != null ? dataSource.url : 'none'}") private String safe;  // 三元
@Value("#{null}")                             private Object n;
// ⚠️ @Value 不能用在 static 字段上（注入失败，为 null）
```

### 5.2 Web MVC 注解

| 注解 | 作用 |
| --- | --- |
| `@RequestMapping` | 通用映射（method 可指定） |
| `@GetMapping`/`@PostMapping`/`@PutMapping`/`@DeleteMapping`/`@PatchMapping` | ★ 语义化快捷方式 |
| `@RequestParam` | 查询参数 / 表单字段 |
| `@PathVariable` | ★ 路径变量 |
| `@RequestBody` | ★ JSON 请求体 |
| `@ResponseBody` | 返回值直接写响应体（JSON） |
| `@RequestHeader` / `@CookieValue` | 请求头 / Cookie |
| `@RequestPart` | multipart 的一部分（文件 + JSON） |
| `@ModelAttribute` | 表单 → 对象；或方法返回值放入 Model |
| `@SessionAttributes` | ★ 把 Model 中的数据同步到 Session |
| `@SessionAttribute` | 读取 Session 属性 |
| `@RequestAttribute` | 读取 request 属性 |
| `@InitBinder` | 自定义参数绑定/类型转换 |
| `@CrossOrigin` | 跨域 |
| `@ResponseStatus` | 指定响应状态码 |
| `@ExceptionHandler` | ★ 异常处理方法 |
| `@ControllerAdvice` / `@RestControllerAdvice` | ★ 全局增强 |
| `@MatrixVariable` | 矩阵变量 |

```java
// @SessionAttributes（★ 跨请求保持数据）
@Controller
@SessionAttributes(value = {"loginUser", "cart"}, types = {Order.class})
public class CartController {
    @GetMapping("/cart/add")
    public String add(Model model) {
        model.addAttribute("cart", cart);          // ★ 会自动同步到 Session
        return "cart";
    }
    @GetMapping("/cart/view")
    public String view(@ModelAttribute("cart") Cart cart) {   // ★ 从 Session 取
        return "cart";
    }
    @GetMapping("/cart/clear")
    public String clear(SessionStatus status) {
        status.setComplete();                       // ★ 清除 @SessionAttributes 的数据
        return "redirect:/";
    }
}

// @InitBinder（自定义类型转换 + 字段白名单）
@Controller
public class UserController {
    @InitBinder
    public void initBinder(WebDataBinder binder) {
        // 日期格式
        binder.registerCustomEditor(LocalDate.class,
            new CustomDateEditor(new SimpleDateFormat("yyyy-MM-dd"), true));
        // ★ 字段白名单（防止恶意提交 id、role 等字段 —— 防「批量赋值攻击」）
        binder.setAllowedFields("username", "nickname", "phone", "email");
        binder.setDisallowedFields("id", "role", "status", "balance");
        // 字符串去空格
        binder.registerCustomEditor(String.class, new StringTrimmerEditor(true));
    }
}

// @ResponseStatus
@ResponseStatus(HttpStatus.CREATED)                 // 201
@PostMapping public Result<Long> create(...) { }

@ResponseStatus(value = HttpStatus.NOT_FOUND, reason = "用户不存在")
public class UserNotFoundException extends RuntimeException { }   // ★ 加在异常类上
```

### 5.3 事务、异步、缓存、调度

```java
// ─── 事务 ───
@Transactional(rollbackFor = Exception.class)                    // ★ 标准写法
@Transactional(propagation = Propagation.REQUIRES_NEW)
@Transactional(isolation = Isolation.READ_COMMITTED)
@Transactional(readOnly = true)
@Transactional(timeout = 30)
@Transactional(transactionManager = "secondaryTxManager")        // 多数据源
@EnableTransactionManagement                                     // 开启（Boot 自动开启）

// ─── 异步 ───
@EnableAsync                                                       // ★ 必须开启
@Async                                                             // 用默认执行器
@Async("bizExecutor")                                              // ★ 指定线程池
@Async public CompletableFuture<String> queryAsync() { ... }        // 有返回值
// 异常处理
@Bean public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() { ... }

// ─── 定时任务 ───
@EnableScheduling                                                  // ★ 必须开启
@Scheduled(cron = "0 0 2 * * ?")                                   // ★ cron 表达式
@Scheduled(fixedRate = 5000)                                       // 上次开始后 5 秒（不管上次是否结束）
@Scheduled(fixedDelay = 5000)                                      // ★ 上次结束后 5 秒
@Scheduled(fixedDelayString = "${task.delay:5000}")                // 支持占位符
@Scheduled(initialDelay = 10000, fixedRate = 5000)                  // 延迟 10 秒后开始
@Scheduled(cron = "${task.cron}", zone = "Asia/Shanghai")           // 指定时区
// ⚠️ 默认是【单线程】执行所有定时任务！配置 spring.task.scheduling.pool.size

// ─── 缓存（Spring Cache 抽象）───
@EnableCaching                                                     // ★ 必须开启
@Cacheable(value = "user", key = "#id")                            // ★ 查缓存，没有则执行方法并缓存
@Cacheable(value = "user", key = "#id", unless = "#result == null") // ★ null 不缓存
@Cacheable(value = "user", key = "#id", condition = "#id > 0")      // 条件缓存
@CachePut(value = "user", key = "#user.id")                         // ★ 总是执行方法并更新缓存
@CacheEvict(value = "user", key = "#id")                            // ★ 删除缓存
@CacheEvict(value = "user", allEntries = true)                      // 清空整个缓存
@CacheEvict(value = "user", key = "#id", beforeInvocation = true)   // ★ 方法执行前就删（防止异常时缓存不一致）
@Caching(                                                          // 组合多个操作
    cacheable = {@Cacheable(value = "user", key = "#id")},
    evict = {@CacheEvict(value = "userList", allEntries = true)}
)
@CacheConfig(cacheNames = "user", keyGenerator = "myKeyGenerator")  // ★ 类级别公共配置

// SpEL 可用的变量
// #root.methodName  #root.target  #root.args  #root.caches
// #参数名  #p0 #a0（按索引）  #result（返回值，仅 unless/condition 后置）
@Cacheable(value = "user", key = "#root.methodName + '_' + #id")
@Cacheable(value = "users", key = "#query.deptId + '_' + #query.pageNum")
```

### 5.4 测试注解

```java
// ─── Spring Boot 测试 ───
@SpringBootTest                                    // ★ 完整容器（集成测试）
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)    // 随机端口（真实 HTTP）
@SpringBootTest(webEnvironment = WebEnvironment.MOCK)           // Mock 环境（默认，配 MockMvc）
@SpringBootTest(classes = TestConfig.class)                       // 指定配置类
@SpringBootTest(properties = {"app.mode=test"})                   // 注入属性
@SpringBootTest(args = "--server.port=0")

@RunWith(SpringRunner.class)                        // JUnit 4（JUnit 5 不需要）
@ExtendWith(SpringExtension.class)                   // JUnit 5（@SpringBootTest 已包含）

@WebMvcTest(UserController.class)                    // ★ 只测 Web 层（不加载 Service，快）
@DataJpaTest                                          // 只测 JPA（内嵌数据库，自动回滚）
@MybatisTest                                          // 只测 MyBatis（mybatis-spring-boot-starter-test）
@JdbcTest                                             // 只测 JDBC
@RestClientTest                                       // 只测 RestTemplate
@JsonTest                                             // 只测 JSON 序列化

@MockBean                                             // ★ 用 Mock 替换容器中的 Bean
@SpyBean                                              // ★ 包装真实 Bean，可部分 Mock
@TestConfiguration                                    // 测试专用配置（不影响主配置）
@TestPropertySource(locations = "classpath:test.properties")
@ActiveProfiles("test")                                // ★ 激活 test profile
@Transactional                                         // ★ 测试后自动回滚（不污染数据库）
@Rollback(false)                                       // 不回滚（保留数据便于查看）
@Commit
@DirtiesContext                                        // 测试后重置容器（慢，慎用）
@Sql("/sql/init.sql")                                  // ★ 测试前执行 SQL
@RecordApplicationEvents                               // 记录发布的事件（Spring 5.3.3+）
@AutoConfigureMockMvc                                   // 自动配置 MockMvc
@AutoConfigureWebTestClient

// ─── 完整测试示例 ───
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UserServiceTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserService userService;
    @MockBean private SmsClient smsClient;             // ★ Mock 外部依赖
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        when(smsClient.send(any())).thenReturn(true);
    }

    @Test
    @DisplayName("创建用户 - 正常流程")
    void shouldCreateUser() throws Exception {
        UserCreateDTO dto = new UserCreateDTO();
        dto.setUsername("testuser");

        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data").isNumber());
    }

    @Test
    @DisplayName("创建用户 - 参数校验失败")
    void shouldRejectInvalidUsername() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"a\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(40000));
    }
}
```

## 6. FactoryBean 与 @EnableXxx 实战

```java
// ─── FactoryBean：定制复杂对象的创建 ───
public class RpcClientFactoryBean<T> implements FactoryBean<T>, InitializingBean {

    private Class<T> interfaceType;                    // 要代理的接口
    private String serverAddress;
    private int timeout;
    private T proxy;                                    // 缓存代理对象

    @Override
    public void afterPropertiesSet() {
        // ★ 在属性设置完成后创建代理（JDK 动态代理）
        this.proxy = (T) Proxy.newProxyInstance(
                interfaceType.getClassLoader(),
                new Class[]{interfaceType},
                (p, method, args) -> {
                    // 发起 RPC 调用
                    return remoteInvoke(serverAddress, method, args, timeout);
                });
    }

    @Override public T getObject() { return proxy; }              // ★ 返回代理对象
    @Override public Class<?> getObjectType() { return interfaceType; }
    @Override public boolean isSingleton() { return true; }
}

// 配合 ImportBeanDefinitionRegistrar 批量注册（★ MyBatis/Feign 的做法）
public class RpcClientRegistrar implements ImportBeanDefinitionRegistrar {
    @Override
    public void registerBeanDefinitions(AnnotationMetadata metadata, BeanDefinitionRegistry registry) {
        // 扫描 @RpcClient 注解的接口
        for (Class<?> intf : scanRpcClients()) {
            BeanDefinitionBuilder builder = BeanDefinitionBuilder
                    .genericBeanDefinition(RpcClientFactoryBean.class);
            builder.addPropertyValue("interfaceType", intf);
            builder.addPropertyValue("serverAddress", "127.0.0.1:9090");
            builder.addPropertyValue("timeout", 5000);
            builder.setAutowireMode(AbstractBeanDefinition.AUTOWIRE_BY_TYPE);
            registry.registerBeanDefinition(intf.getSimpleName(), builder.getBeanDefinition());
        }
    }
}

// 用户只需一个注解
@EnableRpcClients(basePackages = "com.example.rpc")
@Configuration
public class AppConfig { }

// 然后直接注入使用（★ 接口没有实现类！）
@RpcClient
public interface UserRpcService {
    UserDTO getById(Long id);
}

@Service
public class MyService {
    @Autowired private UserRpcService userRpcService;      // ★ 注入的是 FactoryBean.getObject() 的代理
}
```

## 7. 注解使用的常见坑

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `@Service` 忘加，或包不在扫描范围 | Bean 找不到 | 检查注解和 `@ComponentScan` |
| 2 | `@Value` 用在 static 字段 | 注入为 null | 改实例字段，或用 setter |
| 3 | `@Value` 用在构造器参数但构造器没 `@Autowired` | 注入失败 | 单构造器可省略，多构造器要标注 |
| 4 | `@Qualifier` 与 `@Resource(name)` 混用 | 混乱 | 统一风格 |
| 5 | `@Bean` 方法名重复 | 后者覆盖前者 | 用 `@Bean("name")` 显式区分 |
| 6 | `@ConditionalOnMissingBean` 顺序问题 | 用户配置未生效 | 自动配置要用 `@AutoConfiguration(after=...)` |
| 7 | `@Profile` 未激活 | Bean 不存在 | 检查 `spring.profiles.active` |
| 8 | `@Async` 未加 `@EnableAsync` | 同步执行 | 加 Enable 注解 |
| 9 | `@Scheduled` 默认单线程 | 任务互相阻塞 | 配 `spring.task.scheduling.pool.size` |
| 10 | `@Cacheable` 的 key 写错 | 缓存命中率低/错乱 | 用 `#root` 调试，或自定义 KeyGenerator |
| 11 | `@Cacheable` 缓存了 null | 缓存穿透 | `unless = "#result == null"` |
| 12 | `@Transactional` 未指定 rollbackFor | 受检异常不回滚 | ★ 一律 `rollbackFor = Exception.class` |
| 13 | `@RestControllerAdvice` 捕获不到 Filter 异常 | 返回容器错误页 | Filter 内自行处理，或配 ErrorController |
| 14 | `@PropertySource` 不支持 yml | 加载失败 | 自定义 `PropertySourceFactory` |
| 15 | `@PropertySource` 优先级低于 application.yml | 配置被覆盖 | 理解优先级顺序 |
| 16 | `@Import` 导入的类重复注册 | Bean 定义冲突 | 检查是否也被 `@ComponentScan` 扫到 |
| 17 | `@Order` 对单个 Bean 注入无效 | 顺序不对 | `@Order` 只对**集合注入**和**切面**生效 |
| 18 | `@Lazy` 注入后 NPE | 代理未正确生成 | 检查接口注入与代理方式 |
| 19 | `@DependsOn` 拼错 Bean 名 | 启动报 `NoSuchBeanDefinitionException` | 核对名称 |
| 20 | `@SessionAttributes` 数据不清理 | Session 膨胀 | `SessionStatus.setComplete()` |
| 21 | `@ModelAttribute` 方法每次请求都执行 | 性能开销 | 只放公共数据，避免重逻辑 |
| 22 | `@InitBinder` 未设字段白名单 | **批量赋值攻击**（用户提交 `role=ADMIN`） | `setAllowedFields` / `setDisallowedFields` |
| 23 | `@ConditionalOnClass` 写在方法上但类不存在 | 类加载错误 | ★ 用字符串形式 `name = "com.x.Y"` |
| 24 | 自动配置类的 `@Configuration` 未设 `proxyBeanMethods=false` | 启动变慢 | Boot 自动配置一律用 false |
| 25 | `@EnableXxx` 重复标注 | 配置重复注册 | 只标一次（通常在启动类） |

---

## 关联笔记

- 上一篇：[[后端/Spring/SSM整合实战]]
- 下一篇：[[后端/MyBatis/MyBatis入门与核心配置]]
- 相关：[[后端/Spring/Spring概述与IoC容器]]（三种配置方式）、[[后端/Spring/Bean生命周期与作用域]]
- Boot：[[后端/SpringBoot/自动配置原理]]（`@Conditional` 与 `@Import` 的完整应用）、[[后端/SpringBoot/配置文件与自定义Starter]]
- 注解基础：[[后端/Java基础/泛型枚举与注解]]（元注解、自定义注解）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
