---
title: "自动配置原理"
aliases:
  - "@EnableAutoConfiguration"
  - "spring.factories"
  - "AutoConfiguration"
tags:
  - "后端"
  - "java"
  - "spring"
  - "springboot"
  - "面试"
category: "后端"
folder: "SpringBoot"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/SpringBoot/SpringBoot入门与项目搭建]]"
  - "[[后端/SpringBoot/配置文件与自定义Starter]]"
  - "[[后端/Spring/Spring注解大全与配置类]]"
  - "[[后端/Spring/Spring概述与IoC容器]]"
created: 2026-09-07
updated: 2026-09-07
---

# Spring Boot 自动配置原理

> **一句话原理**：`@EnableAutoConfiguration` 通过 `@Import` 导入 `AutoConfigurationImportSelector`，它在容器刷新早期从所有 jar 的 `META-INF/spring/...AutoConfiguration.imports` 中读取候选自动配置类名，再经过**去重、排除、`@Conditional` 条件过滤**，把最终生效的配置类注册为 BeanDefinition，由后续的 `ConfigurationClassPostProcessor` 解析其中的 `@Bean` 方法完成装配。

## 1. 从 @SpringBootApplication 到自动配置 ★★★★★

```java
@SpringBootApplication
public class Application { public static void main(String[] args) { SpringApplication.run(Application.class, args); } }

// ─── 展开 ───
@SpringBootConfiguration          // = @Configuration
@EnableAutoConfiguration          // ★★ 自动配置的入口
@ComponentScan(...)               // 扫描自己的包
public @interface SpringBootApplication { }

// ─── @EnableAutoConfiguration 展开 ───
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@AutoConfigurationPackage                              // ① 注册「主类所在包」为自动配置包
@Import(AutoConfigurationImportSelector.class)          // ② ★★ 导入选择器（核心）
public @interface EnableAutoConfiguration {
    String ENABLED_OVERRIDE_PROPERTY = "spring.boot.enableautoconfiguration";
    Class<?>[] exclude() default {};                    // 排除的自动配置类
    String[] excludeName() default {};                   // 按名称排除
}
```

**两条支线：**

| 注解 | 作用 | 实现 |
| --- | --- | --- |
| **`@AutoConfigurationPackage`** | 把**主类所在的包名**注册到容器，供后续需要「扫描业务包」的组件使用（如 JPA 的 `@Entity` 扫描、MyBatis 的 Mapper 扫描） | `@Import(AutoConfigurationPackages.Registrar.class)` → 注册 `AutoConfigurationPackages` Bean |
| **`@Import(AutoConfigurationImportSelector.class)`** | ★★ **加载并筛选自动配置类** | 实现 `DeferredImportSelector` |

```java
// ─── @AutoConfigurationPackage 的实现（理解「为什么启动类要在根包」）───
public class AutoConfigurationPackages {

    /** 保存主类所在的包名 */
    private final List<String> packages;

    public static void register(BeanDefinitionRegistry registry, String... packageNames) {
        if (registry.containsBeanDefinition(BEAN)) {
            registry.getBeanDefinition(BEAN).getConstructorArgumentValues()
                    .addGenericArgumentValue(packageNames);      // 追加
        } else {
            registry.registerBeanDefinition(BEAN,
                new RootBeanDefinition(AutoConfigurationPackages.class,
                    () -> new AutoConfigurationPackages(packageNames)));
        }
    }

    public static List<String> get(BeanFactory beanFactory) {
        return beanFactory.getBean(BEAN, AutoConfigurationPackages.class).getPackageNames();
    }

    /** ★ Registrar：由 @Import 触发，把主类的包名注册进去 */
    static class Registrar implements ImportBeanDefinitionRegistrar, DeterminableImports {
        @Override
        public void registerBeanDefinitions(AnnotationMetadata metadata, BeanDefinitionRegistry registry) {
            register(registry, new PackageImports(metadata).get().toArray(new String[0]));
        }
        @Override
        public Set<Object> determineImports(AnnotationMetadata metadata) {
            return Collections.singleton(new PackageImports(metadata));
        }
    }
}

// PackageImports 的解析逻辑：
// ① 先找 @AutoConfigurationPackage 的 basePackages / basePackageClasses
// ② 都没有 → 取【标注了该注解的类（即启动类）所在的包】
// ★ 这就是「启动类必须放在根包」的技术原因：所有自动配置都以它的包为基准
```

## 2. AutoConfigurationImportSelector ★★★★★

```java
public class AutoConfigurationImportSelector
        implements DeferredImportSelector, BeanClassLoaderAware, ResourceLoaderAware,
                   BeanFactoryAware, EnvironmentAware, Ordered {

    private static final String[] NO_IMPORTS = {};
    private ConfigurableListableBeanFactory beanFactory;
    private Environment environment;
    private ClassLoader beanClassLoader;
    private ResourceLoader resourceLoader;

    @Override
    public String[] selectImports(AnnotationMetadata annotationMetadata) {
        // ★ 检查开关
        if (!isEnabled(annotationMetadata)) return NO_IMPORTS;
        // ① 获取所有候选的自动配置类
        AutoConfigurationEntry autoConfigurationEntry = getAutoConfigurationEntry(annotationMetadata);
        return StringUtils.toStringArray(autoConfigurationEntry.getConfigurations());
    }

    /** ★★ 核心方法：获取自动配置项 */
    protected AutoConfigurationEntry getAutoConfigurationEntry(AnnotationMetadata annotationMetadata) {
        if (!isEnabled(annotationMetadata)) return EMPTY_ENTRY;

        // ① 读取注解属性（exclude、excludeName）
        AnnotationAttributes attributes = getAttributes(annotationMetadata);

        // ② ★★ 加载所有候选自动配置类（从 imports 文件）
        List<String> configurations = getCandidateConfigurations(annotationMetadata, attributes);

        // ③ ★ 去重
        configurations = removeDuplicates(configurations);

        // ④ ★ 收集排除项（注解的 exclude + 配置的 spring.autoconfigure.exclude）
        Set<String> exclusions = getExclusions(annotationMetadata, attributes);
        // 校验排除的类是否真的是自动配置类（防止写错）
        checkExcludedClasses(configurations, exclusions);
        configurations.removeAll(exclusions);

        // ⑤ ★★★ 条件过滤（@ConditionalOnClass 等）+ 加载排除过滤器
        configurations = getConfigurationClassFilter().filter(configurations);

        // ⑥ ★ 触发 AutoConfigurationImportEvent（供 ConditionEvaluationReport 记录）
        fireAutoConfigurationImportEvents(configurations, exclusions);

        return new AutoConfigurationEntry(configurations, exclusions);
    }

    /** ★★ 从 SPI 文件加载候选配置类 */
    protected List<String> getCandidateConfigurations(AnnotationMetadata metadata, AnnotationAttributes attributes) {
        // Spring Boot 2.7+ / 3.x：新的 imports 文件
        List<String> configurations = ImportCandidates.load(AutoConfiguration.class, getBeanClassLoader())
                .getCandidates();
        Assert.notEmpty(configurations,
            "No auto configuration classes found in META-INF/spring/"
          + AutoConfiguration.class.getName() + ".imports. "
          + "If you are using a custom packaging, make sure that file is correct.");
        return configurations;
    }

    // ★ 老版本（Spring Boot 2.6 及以前）用 spring.factories
    // protected List<String> getCandidateConfigurations(...) {
    //     List<String> configurations = SpringFactoriesLoader.loadFactoryNames(
    //             getSpringFactoriesLoaderFactoryClass(), getBeanClassLoader());
    //     ...
    // }

    /** 检查开关：spring.boot.enableautoconfiguration=false 可全局关闭 */
    private boolean isEnabled(AnnotationMetadata metadata) {
        if (ClassUtils.isPresent("org.springframework.web.context.WebApplicationContext", getClass().getClassLoader())) {
            return getEnvironment().getProperty(ENABLED_OVERRIDE_PROPERTY, Boolean.class, true);
        }
        return true;
    }
}
```

### 2.1 SPI 文件：候选配置的来源

```
// ═══ Spring Boot 2.7 之前：META-INF/spring.factories ═══
// spring-boot-autoconfigure-2.6.x.jar!/META-INF/spring.factories
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
org.springframework.boot.autoconfigure.admin.SpringApplicationAdminJmxAutoConfiguration,\
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration,\
org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration,\
org.springframework.boot.autoconfigure.batch.BatchAutoConfiguration,\
org.springframework.boot.autoconfigure.cache.CacheAutoConfiguration,\
org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,\
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,\
org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,\
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration,\
... （约 130+ 个）

// ═══ Spring Boot 2.7+ / 3.x：META-INF/spring/...AutoConfiguration.imports ═══
// spring-boot-autoconfigure-3.4.0.jar!/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
// ★ 每行一个类名（无需续行符，格式更简洁，加载更快）
org.springframework.boot.autoconfigure.admin.SpringApplicationAdminJmxAutoConfiguration
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration
org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration
org.springframework.boot.autoconfigure.cache.CacheAutoConfiguration
org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration
org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration
org.springframework.boot.autoconfigure.transaction.TransactionAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.error.ErrorMvcAutoConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration
org.springframework.boot.autoconfigure.task.TaskExecutionAutoConfiguration
org.springframework.boot.autoconfigure.task.TaskSchedulingAutoConfiguration
...

// ★ 变化原因（2.7 的迁移）：
// ① spring.factories 是通用机制（混装了 Listener、Initializer、FailureAnalyzer 等），
//    解析时要按 key 过滤，加载慢
// ② 新文件【专门】给自动配置用，一行一个，可用 BufferedReader 流式读取，★ 启动更快
// ③ Spring Boot 3.0 移除了 spring.factories 对自动配置的支持（只保留其他用途）
```

```java
// ─── ImportCandidates.load 的实现（★ 流式读取）───
public static ImportCandidates load(Class<?> annotation, ClassLoader classLoader) {
    String location = String.format("META-INF/spring/%s.imports", annotation.getName());
    Enumeration<URL> urls = classLoader.getResources(location);        // ★ 所有 jar 中的该文件
    List<String> candidates = new ArrayList<>();
    while (urls.hasMoreElements()) {
        URL url = urls.nextElement();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(url.openStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = stripComment(line);                              // ★ 去掉 # 注释
                if (!line.isEmpty()) candidates.add(line);
            }
        }
    }
    return new ImportCandidates(candidates);
}

// ─── 老版本 SpringFactoriesLoader（按 key 过滤 Properties）───
// 解析所有 spring.factories 为 MultiValueMap<String, String>，再取 EnableAutoConfiguration 对应的 value
// 缺点：要解析全部条目（包括不需要的），且用 Properties 加载，性能差
```

### 2.2 DeferredImportSelector：为什么是「延迟」★★★★★

```java
// 普通 ImportSelector：立即执行（在解析当前配置类时同步执行）
public interface ImportSelector {
    String[] selectImports(AnnotationMetadata importingClassMetadata);
}

// ★ DeferredImportSelector：延迟执行（在【所有】@Configuration 类解析完之后才执行）
public interface DeferredImportSelector extends ImportSelector {
    @Override
    default String[] selectImports(AnnotationMetadata importingClassMetadata) { ... }

    /** ★ 分组处理（同一组的 Selector 一起处理，可排序） */
    default Class<? extends Group> getImportGroup() { return null; }

    interface Group {
        void process(AnnotationMetadata metadata, DeferredImportSelector selector);
        Iterable<Group.Entry> selectImports();        // 返回 (importingClass, importedClass) 对
        record Entry(AnnotationMetadata metadata, String importClassName) { }
    }
}
```

**为什么要延迟？（★ 面试核心）**

| 原因 | 说明 |
| --- | --- |
| **① 保证用户配置优先** | ★ **最关键**。自动配置必须在**所有用户自定义的 `@Configuration` 解析完成后**才执行，这样才能通过 `@ConditionalOnMissingBean` 判断「用户是否已自己定义了 Bean」→ 用户配置生效，自动配置让路 |
| ② 性能优化 | 一次性批量处理所有自动配置类，减少重复的条件评估 |
| ③ 排序可控 | `AutoConfigurationGroup` 会先收集全部候选，再**按 `@AutoConfigureOrder`/`@AutoConfigureBefore`/`@AutoConfigureAfter` 排序**，最后统一评估条件 |

```java
// ─── AutoConfigurationGroup（★ 分组处理的实现）───
private class AutoConfigurationGroup implements DeferredImportSelector.Group, ... {

    private final List<DeferredImportSelectorHolder> autoConfigurationEntries = new ArrayList<>();

    @Override
    public void process(AnnotationMetadata annotationMetadata, DeferredImportSelector deferredSelector) {
        AutoConfigurationImportSelector selector = (AutoConfigurationImportSelector) deferredSelector;
        // ★ 获取候选配置（含条件过滤）
        AutoConfigurationEntry entry = selector.getAutoConfigurationEntry(annotationMetadata);
        this.autoConfigurationEntries.add(new DeferredImportSelectorHolder(annotationMetadata, entry));
        // 记录到元数据（供报告使用）
        for (String className : entry.getConfigurations()) {
            this.entries.putIfAbsent(className, annotationMetadata);
        }
    }

    @Override
    public Iterable<Group.Entry> selectImports() {
        if (this.autoConfigurationEntries.isEmpty()) return Collections.emptyList();

        // ★★ 收集所有候选（此时还未排序）
        Set<String> allExclusions = ..., processedConfigurations = ...;
        processedConfigurations.removeAll(allExclusions);

        // ★★★ 排序：按 @AutoConfigureOrder → @AutoConfigureBefore/After
        return sortAutoConfigurations(processedConfigurations, getAutoConfigurationMetadata())
                .stream()
                .map(importClass -> new Entry(this.entries.get(importClass), importClass))
                .toList();
    }
}

// ─── 排序的三个注解 ───
@AutoConfiguration(
    before = DataSourceAutoConfiguration.class,      // 在数据源配置之前
    after = RedisAutoConfiguration.class,             // 在 Redis 配置之后
    beforeName = "com.x.Y",
    afterName = "com.x.Z"
)
@AutoConfigureOrder(Ordered.HIGHEST_PRECEDENCE)        // 数字越小越先
public class MyAutoConfiguration { }
// ★ 老写法：@Configuration + @AutoConfigureOrder + @AutoConfigureBefore/After
// ★ 新写法（2.7+）：@AutoConfiguration（一个注解含全部）
```

**排序的必要性示例：**

```java
// MybatisPlusAutoConfiguration 必须在 DataSourceAutoConfiguration 【之后】
// 因为它需要注入 DataSource Bean
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
public class MybatisPlusAutoConfiguration { }

// ★ 排序机制保证：DataSource 的 BeanDefinition 先注册，MyBatis 的条件判断才能看到它
//   若不排序，MyBatis 的 @ConditionalOnBean(DataSource.class) 可能误判为「不存在」
```

## 3. 条件过滤：AutoConfigurationImportFilter ★★★★★

**候选的自动配置类有 140+ 个，但实际生效的可能只有 30 个。过滤发生在两个阶段：**

```
① 加载阶段（AutoConfigurationImportFilter，★ 快速粗筛，不加载类）
     ↓
② 注册阶段（@Conditional，★ 精确判断，需要解析配置类）
```

### 3.1 快速过滤（OnClassCondition / OnBeanCondition / OnWebApplicationCondition）

```java
// ─── getConfigurationClassFilter()：加载三个快速过滤器 ───
private ConfigurationClassFilter getConfigurationClassFilter() {
    // 从 spring.factories 读取 AutoConfigurationImportFilter 的实现
    List<AutoConfigurationImportFilter> filters =
        loadAutoConfigurationImportFilters(this.beanFactory, this.beanClassLoader);
    // ★ 三个内置过滤器：
    //   OnClassCondition          → @ConditionalOnClass / @ConditionalOnMissingClass
    //   OnBeanCondition           → @ConditionalOnBean / @ConditionalOnMissingBean / @ConditionalOnSingleCandidate
    //   OnWebApplicationCondition → @ConditionalOnWebApplication / @ConditionalOnNotWebApplication
    return new ConfigurationClassFilter(this.beanClassLoader, filters);
}

// ─── filter：批量过滤（★ 性能关键）───
private List<String> filter(List<String> configurations) {
    long startTime = System.nanoTime();
    String[] candidates = StringUtils.toStringArray(configurations);
    boolean[] skip = new boolean[candidates.length];
    boolean skipped = false;

    for (AutoConfigurationImportFilter filter : this.filters) {
        // ★ 关键：调用 getAutoConfigurationMetadata() 获取【预计算的元数据】
        boolean[] match = filter.match(candidates, this.autoConfigurationMetadata);
        for (int i = 0; i < match.length; i++) {
            if (!match[i]) {
                skip[i] = true;                      // 标记跳过
                candidates[i] = null;
                skipped = true;
            }
        }
    }
    // 只保留未被跳过的
    ...
    logger.trace("Filtered {} auto configuration class in {} ms", count, timeTaken);
}
```

**★ 关键优化：`AutoConfigurationMetadata`（编译期预计算）**

```java
// 问题：判断 @ConditionalOnClass(RedisOperations.class) 需要【加载】配置类才能读到注解
//      加载 140 个类 = 大量 IO + 类初始化 = 启动慢
//
// 解决：★ 在【编译期】就把每个自动配置类的条件信息提取出来，存到一个 properties 文件
//      spring-boot-autoconfigure.jar!/META-INF/spring-autoconfigure-metadata.properties

// 文件内容示例（★ 编译期生成，运行时直接读，无需加载类）：
org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration=
org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration.ConditionalOnClass=org.springframework.data.redis.core.RedisOperations
org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration.AutoConfigureBefore=org.springframework.boot.autoconfigure.cache.CacheAutoConfiguration
org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration.AutoConfigureOrder=0
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration.ConditionalOnClass=javax.sql.DataSource,org.springframework.jdbc.core.JdbcTemplate
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration.ConditionalOnMissingBean=org.springframework.jdbc.datasource.embedded.EmbeddedDatabase
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration.AutoConfigureOrder=0

// ★ 效果：
//   ① 运行时用 Class.forName(..., false, ...) 【不初始化】地检查类是否存在
//   ② 不存在的直接跳过，【完全不加载】那个自动配置类
//   ③ 140 个类可能只需要真正加载 30 个 → ★ 启动速度大幅提升

// 生成器：AutoConfigurationMetadataProcessor（注解处理器，编译期运行）
// 由 spring-boot-autoconfigure-processor 依赖提供
```

```java
// ─── OnClassCondition 的实现（★ 用 ASM 而非反射，避免加载类）───
class OnClassCondition extends FastAutoConfigurationImportFilter {

    @Override
    protected boolean[] match(String[] autoConfigurationClasses, AutoConfigurationMetadata metadata) {
        ClassLoader classLoader = getClassLoader();
        ConditionEvaluationReport report = getConditionEvaluationReport();
        // ★ 用【并行流】加速匹配（Boot 2.x 引入）
        ConditionOutcome[] outcomes = getOutcomes(autoConfigurationClasses, metadata, classLoader);
        boolean[] match = new boolean[outcomes.length];
        for (int i = 0; i < outcomes.length; i++) {
            match[i] = (outcomes[i] == null || outcomes[i].isMatch());
            if (!match[i] && outcomes[i] != null) {
                logOutcome(autoConfigurationClasses[i], outcomes[i]);
                if (report != null) report.recordConditionEvaluation(...);
            }
        }
        return match;
    }

    private ConditionOutcome[] getOutcomes(String[] classes, AutoConfigurationMetadata metadata, ClassLoader cl) {
        ConditionOutcome[] outcomes = new ConditionOutcome[classes.length];
        int split = classes.length / 2;
        if (split > 0 && Runtime.getRuntime().availableProcessors() > 1) {
            // ★ 多线程并行评估（启动优化）
            OutcomesResolver firstHalf = new StandardOutcomesResolver(classes, 0, split, metadata, cl);
            OutcomesResolver secondHalf = new StandardOutcomesResolver(classes, split, classes.length, metadata, cl);
            // ... 用 CompletableFuture 并行
        }
        return outcomes;
    }
}

// ★ 类存在性检查：ClassUtils.isPresent 用 Class.forName(name, false, classLoader)
//   initialize=false → ★ 不执行静态初始化块，不触发类加载的完整流程，性能高
public static boolean isPresent(String className, ClassLoader classLoader) {
    try {
        resolveClassName(className, classLoader);
        return true;
    } catch (Throwable ex) {
        return false;                              // ClassNotFoundException / NoClassDefFoundError
    }
}
```

### 3.2 精确条件评估（@Conditional）

```java
// 通过快速过滤的配置类，仍需在注册 BeanDefinition 时评估【全部】条件
// ConfigurationClassParser 中：
private boolean shouldSkip(AnnotatedTypeMetadata metadata, ConfigurationPhase phase) {
    List<Condition> conditions = getConditions(metadata);        // 收集所有 @Conditional
    for (Condition condition : conditions) {
        ConfigurationPhase requiredPhase = ...;
        if (!condition.matches(this.context, metadata)) {         // ★ 逐个评估
            return true;                                          // 任一不满足 → 跳过
        }
    }
    return false;
}
```

## 4. 一个自动配置类的完整剖析 ★★★★★

**以 `RedisAutoConfiguration` 为例（最经典、最好懂）：**

```java
// ═══ spring-boot-autoconfigure.jar 中的源码 ═══

@AutoConfiguration                                        // ★ 标记为自动配置类（2.7+）
@ConditionalOnClass(RedisOperations.class)                 // ① classpath 有 RedisOperations 才生效
@EnableConfigurationProperties(RedisProperties.class)       // ② ★ 绑定 spring.redis.* 配置
@Import({ LettuceConnectionConfiguration.class,            // ③ ★ 导入两种客户端的配置
          JedisConnectionConfiguration.class })
public class RedisAutoConfiguration {

    /**
     * ★★ 核心：@ConditionalOnMissingBean 让「用户配置优先」
     * name = "redisTemplate" → 只有容器中没有名为 redisTemplate 的 Bean 时才注册
     */
    @Bean
    @ConditionalOnMissingBean(name = "redisTemplate")
    @ConditionalOnSingleCandidate(RedisConnectionFactory.class)     // ④ 有且仅有一个连接工厂
    public RedisTemplate<Object, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<Object, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        return template;
        // ★ 注意：默认用 JdkSerializationRedisSerializer（序列化后是二进制乱码！）
        //   生产环境几乎都会自定义这个 Bean 覆盖它
    }

    /** 字符串专用的 Template（name 不同，所以可以共存） */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnSingleCandidate(RedisConnectionFactory.class)
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }
}

// ═══ 连接工厂的配置（内部类，也是自动配置）═══
@Configuration(proxyBeanMethods = false)                   // ★ lite 模式（不生成 CGLIB 代理，启动更快）
@ConditionalOnClass(RedisClient.class)                      // classpath 有 Lettuce
@ConditionalOnProperty(name = "spring.data.redis.client-type", havingValue = "lettuce",
                       matchIfMissing = true)                // ★ 默认用 Lettuce
class LettuceConnectionConfiguration extends RedisConnectionConfiguration {

    @Bean(destroyMethod = "shutdown")
    @ConditionalOnMissingBean(RedisConnectionFactory.class)   // ★ 用户没配才用默认的
    LettuceConnectionFactory redisConnectionFactory(
            ObjectProvider<LettuceClientConfigurationBuilderCustomizer> builderCustomizer,
            ObjectProvider<ClientResourcesBuilderCustomizer> clientResourcesCustomizer) {
        LettuceClientConfiguration clientConfig = builderClientConfiguration(...);
        return createLettuceConnectionFactory(clientConfig);
    }
}

@Configuration(proxyBeanMethods = false)
@ConditionalOnClass({ GenericObjectPool.class, JedisConnection.class, Jedis.class })
@ConditionalOnProperty(name = "spring.data.redis.client-type", havingValue = "jedis")   // ★ 显式指定才用 Jedis
class JedisConnectionConfiguration extends RedisConnectionConfiguration { ... }

// ═══ 配置属性类 ═══
@ConfigurationProperties(prefix = "spring.data.redis")      // ★ Boot 3.x 前缀（2.x 是 spring.redis）
public class RedisProperties {
    private int database = 0;                               // ★ 默认值
    private String url;
    private String host = "localhost";                       // ★ 默认值
    private String password;
    private int port = 6379;                                 // ★ 默认值
    private String clientType;                               // lettuce / jedis
    private Duration timeout;
    private Duration connectTimeout;
    private Pool pool;                                       // 嵌套对象
    private Sentinel sentinel;
    private Cluster cluster;
    private Ssl ssl = new Ssl();

    public static class Pool {
        private int maxActive = 8;                           // ★ 连接池默认值
        private int maxIdle = 8;
        private int minIdle = 0;
        private int maxWait = -1;                            // -1 = 无限等待
        private Duration timeBetweenEvictionRuns;
    }
    // ... getter/setter
}
```

**对应的 YAML（用户只需写这几行）：**

```yaml
spring:
  data:
    redis:                       # Boot 2.x 是 spring.redis
      host: 192.168.1.100
      port: 6379
      password: ${REDIS_PASSWORD:}
      database: 0
      timeout: 3s
      connect-timeout: 1s
      client-type: lettuce
      lettuce:
        pool:
          max-active: 50          # ★ 对应 RedisProperties.Pool.maxActive
          max-idle: 20
          min-idle: 10
          max-wait: 3s
```

```java
// ═══ 用户覆盖自动配置（★ 只需声明同名的 Bean）═══
@Configuration
public class RedisConfig {

    /**
     * ★ Bean 名与自动配置的相同 → @ConditionalOnMissingBean 生效 → 自动配置让路
     */
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        // ★ 自定义序列化（解决默认 JDK 序列化的乱码问题）
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }
}
// ★ 这就是「约定优于配置」的完整体现：
//   - 不配置 → 用自动配置的默认值（能用，但序列化不友好）
//   - 配置了 → 自动配置退让，用户的生效
```

**自动配置类的通用套路（★ 学会这个模板就能写任何 starter）：**

```java
@AutoConfiguration                                        // ① 声明为自动配置类
@ConditionalOnClass(Xxx.class)                             // ② 前提：classpath 有相关类
@EnableConfigurationProperties(XxxProperties.class)         // ③ 绑定配置属性
@ConditionalOnProperty(prefix = "xxx", name = "enabled",    // ④ 开关（默认开启）
                       havingValue = "true", matchIfMissing = true)
public class XxxAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean                              // ⑤ ★ 用户没配才注册默认的
    public XxxClient xxxClient(XxxProperties props) {
        return new XxxClient(props.getUrl(), props.getTimeout());
    }

    @Bean
    @ConditionalOnBean(XxxClient.class)                    // ⑥ 依赖其他 Bean 存在
    @ConditionalOnMissingBean
    public XxxTemplate xxxTemplate(XxxClient client) {
        return new XxxTemplate(client);
    }
}

@ConfigurationProperties(prefix = "xxx")
@Data
public class XxxProperties {
    private boolean enabled = true;         // 默认值
    private String url = "http://localhost:8080";
    private Duration timeout = Duration.ofSeconds(5);
    private int maxRetry = 3;
}
```

## 5. 条件注解的执行时机 ★★★★★

```java
// ─── ConfigurationPhase：条件评估的两个阶段 ───
public enum ConfigurationPhase {
    /** ★ 阶段 1：解析配置类时（决定「这个配置类要不要处理」） */
    PARSE_CONFIGURATION,
    /** ★ 阶段 2：注册 Bean 时（决定「这个 @Bean 要不要注册」） */
    REGISTER_BEAN
}

// ─── 各条件注解所属的阶段 ───
@ConditionalOnClass / @ConditionalOnMissingClass      → PARSE_CONFIGURATION（类级别）
@ConditionalOnWebApplication                          → PARSE_CONFIGURATION
@ConditionalOnProperty                                → 两者都可
@ConditionalOnBean / @ConditionalOnMissingBean        → ★ REGISTER_BEAN（★ 依赖注册顺序！）
@ConditionalOnExpression                              → 两者都可
@ConditionalOnResource                                → 两者都可
```

> 【★★ 最重要的一条规则】**`@ConditionalOnBean` / `@ConditionalOnMissingBean` 强烈依赖 Bean 的注册顺序！**
>
> 官方文档明确警告：
> > The condition can only match the bean definitions that have been processed by the application context so far and, as such, it is strongly recommended to use this condition on auto-configuration classes only.
>
> 含义：这两个注解**只能看到「到目前为止已经处理过的 BeanDefinition」**。如果在自己的 `@Configuration` 中用它判断「某个 Bean 是否存在」，而那个 Bean 是在**另一个更晚处理的配置类**中定义的，判断结果会是「不存在」→ 逻辑错误。
>
> **规则**：
> 1. `@ConditionalOnBean` / `@ConditionalOnMissingBean` **只在自动配置类中使用**（自动配置由 `DeferredImportSelector` 保证最后处理）。
> 2. 自动配置类之间用 `@AutoConfigureAfter` / `@AutoConfigureBefore` 明确顺序。
> 3. 优先用 `@ConditionalOnClass`（不依赖顺序，只看 classpath）。
> 4. 业务配置类中避免用这两个注解。

## 6. 排查自动配置：ConditionEvaluationReport ★★★★★

```java
// ═══ 方式 1：启动参数（★ 最常用）═══
// java -jar app.jar --debug
// 或 application.yml: debug: true
// 或 logging.level.root=DEBUG

// 输出「CONDITIONS EVALUATION REPORT」（★ 极其有用）
/*
=========================
AUTO-CONFIGURATION REPORT
=========================

Positive matches:（★ 生效的自动配置）
-----------------
   DataSourceAutoConfiguration matched:
      - @ConditionalOnClass found required classes 'javax.sql.DataSource',
        'org.springframework.jdbc.core.JdbcTemplate' (OnClassCondition)
      - @ConditionalOnMissingBean (types: org.springframework.jdbc.datasource.embedded.EmbeddedDatabase)
        did not find any beans (OnBeanCondition)

   RedisAutoConfiguration matched:
      - @ConditionalOnClass found required class 'org.springframework.data.redis.core.RedisOperations'
      - @ConditionalOnProperty (spring.data.redis.enabled) did not find property 'enabled'
        but found match with 'matchIfMissing' (OnPropertyCondition)

   WebMvcAutoConfiguration matched:
      - @ConditionalOnClass found required classes 'javax.servlet.Servlet',
        'org.springframework.web.servlet.DispatcherServlet'
      - @ConditionalOnWebApplication (required) found 'session' scope (OnWebApplicationCondition)

Negative matches:（★ 未生效的自动配置及原因）
-----------------
   MongoAutoConfiguration:
      Did not match:
         - @ConditionalOnClass did not find required class 'com.mongodb.client.MongoClient'
            (OnClassCondition)

   SecurityAutoConfiguration:
      Did not match:
         - @ConditionalOnClass did not find required class
            'org.springframework.security.authentication.DefaultAuthenticationEventPublisher'

   RedisRepositoriesAutoConfiguration:
      Did not match:
         - @ConditionalOnProperty (spring.data.redis.repositories.enabled) did not find property
            'enabled' (OnPropertyCondition)
      Matched:
         - @ConditionalOnClass found required class 'org.springframework.data.redis.repository.configuration.EnableRedisRepositories'

Exclusions:（★ 被排除的）
-----------
    org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration

Unconditional classes:（★ 无条件加载的）
----------------------
    org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration
    org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration
*/
```

```java
// ═══ 方式 2：Actuator 端点（★ 运行时查看）═══
// application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,conditions,beans,mappings,configprops,env

// 访问：GET /actuator/conditions     ← 自动配置的评估报告（JSON）
// 访问：GET /actuator/beans          ← 所有 Bean（含来源）
// 访问：GET /actuator/configprops    ← ★ 所有 @ConfigurationProperties 的实际值（敏感信息会脱敏）
// 访问：GET /actuator/mappings       ← ★ 所有 URL 映射（排查 404 神器）
// 访问：GET /actuator/env            ← ★ 所有配置源及优先级

// ═══ 方式 3：编程式获取报告 ═══
@Component
@RequiredArgsConstructor
public class AutoConfigReporter implements ApplicationRunner {

    private final ApplicationContext ctx;

    @Override
    public void run(ApplicationArguments args) {
        ConditionEvaluationReport report =
                ConditionEvaluationReport.get((ConfigurableListableBeanFactory)
                        ((ConfigurableApplicationContext) ctx).getBeanFactory());

        // ★ 生效的
        report.getConditionAndOutcomesBySource().forEach((source, outcomes) -> {
            if (outcomes.isFullMatch()) {
                log.info("✅ {}", source);
            }
        });
        // ★ 未生效的
        report.getConditionAndOutcomesBySource().forEach((source, outcomes) -> {
            if (!outcomes.isFullMatch()) {
                log.info("❌ {} → {}", source, outcomes.getConditionAndOutcomes());
            }
        });
        // 排除项
        log.info("排除的自动配置: {}", report.getExclusions());
        // 无条件加载的
        log.info("无条件加载: {}", report.getUnconditionalClasses());
    }
}

// ═══ 方式 4：验证某个 Bean 从哪来 ═══
@Bean
public CommandLineRunner beanSourceChecker(ApplicationContext ctx) {
    return args -> {
        // ★ 找出所有 RedisTemplate 类型的 Bean
        ctx.getBeansOfType(RedisTemplate.class).forEach((name, bean) -> {
            BeanDefinition bd = ((ConfigurableApplicationContext) ctx)
                    .getBeanFactory().getBeanDefinition(name);
            log.info("Bean[{}] 来自配置类: {}", name,
                    bd.getAttribute(ConfigurationClassPostProcessor.CONFIGURATION_CLASS_ATTRIBUTE));
            // 输出：Bean[redisTemplate] 来自配置类: configurationClass
            //      或来自你的 RedisConfig
        });
    };
}
```

## 7. 启动性能优化 ★★★★

```java
// ─── ① 排除不需要的自动配置（★ 效果最直接）───
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,          // 不用数据库
    HibernateJpaAutoConfiguration.class,
    SecurityAutoConfiguration.class,            // 不用 Security
    GsonAutoConfiguration.class,                // 只用 Jackson
    MongoAutoConfiguration.class,
    RedisAutoConfiguration.class,               // 不用 Redis
    RabbitAutoConfiguration.class,
    KafkaAutoConfiguration.class,
    ElasticsearchRestClientAutoConfiguration.class,
    QuartzAutoConfiguration.class,
    BatchAutoConfiguration.class,
    MailSenderAutoConfiguration.class,
    WebSocketMessagingAutoConfiguration.class,
    ValidationAutoConfiguration.class,           // 已用自定义 Validator
    FreeMarkerAutoConfiguration.class,
    GroovyTemplateAutoConfiguration.class,
    MustacheAutoConfiguration.class,
    ThymeleafAutoConfiguration.class,            // 纯 API 服务，不用模板引擎
    MultipartAutoConfiguration.class,            // 不用文件上传
    WebMvcAutoConfiguration.class                // ⚠️ 谨慎（会失去 MVC 自动配置）
})
// yml 方式
spring:
  autoconfigure:
    exclude:
      - org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
      - org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration

// ─── ② 关闭 CGLIB 代理（@Configuration 的 full → lite）───
@SpringBootApplication(proxyBeanMethods = false)      // ★ 不生成配置类的代理子类
// 自己的配置类也用
@Configuration(proxyBeanMethods = false)
// 注意：@Bean 方法之间不能互相调用，改用参数注入

// ─── ③ 懒加载（★ 双刃剑）───
spring:
  main:
    lazy-initialization: true       // ★ 全局懒加载：启动快，但首次请求慢 + 隐藏配置错误
// 更精细：只对非核心 Bean 懒加载
@Bean @Lazy public HeavyService heavyService() { ... }

// ─── ④ 索引组件（Spring 5+，替代 classpath 扫描）───
// 加依赖：org.springframework:spring-context-indexer
// 编译时生成 META-INF/spring.components 索引文件，避免运行时扫描全部 class
// ⚠️ Boot 3 中收益有限（已有 CDS 等更好的方案）

// ─── ⑤ ★ CDS（Class Data Sharing，Boot 3.3+ 官方支持）───
// 训练运行（生成共享归档）
java -Dspring.context.exit=onRefresh -jar app.jar
// 正式运行（加载归档，★ 启动提速 20~50%）
java -XX:SharedArchiveFile=app-cds archive  ...

// ─── ⑥ ★ AOT 处理 + GraalVM Native Image（★ 毫秒级启动）───
// Maven
mvn -Pnative native:compile
// 生成的可执行文件启动只需 50~100ms（vs JVM 的 2~5s），内存占用降 5~10 倍
// 代价：编译慢（几分钟）、不支持动态代理/反射的部分场景（需要 reachability metadata）
// 适用：Serverless、CLI 工具、K8s 快速扩缩容、Sidecar

// ─── ⑦ 减少依赖（依赖越少，扫描和条件评估越少）───
mvn dependency:tree | wc -l          // 看依赖数量
// 移除未使用的 starter，用 optional 标记

// ─── ⑧ 关闭不必要的启动动作 ───
spring:
  main:
    banner-mode: off                    // 不打印 banner
  jpa:
    open-in-view: false                 // ★ 关闭（默认 true 会有性能警告日志）
mybatis-plus:
  global-config:
    banner: false                        // 不打印 MP banner
```

**启动耗时分析：**

```bash
# ─── 用 ApplicationStartup 追踪每一步耗时（★ Spring 5.3+）───
```

```java
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(Application.class);
        // ★ 开启启动步骤追踪
        app.setApplicationStartup(new BufferingApplicationStartup(4096));
        ConfigurableApplicationContext ctx = app.run(args);

        // 导出耗时报告
        BufferingApplicationStartup startup =
                (BufferingApplicationStartup) ctx.getBean(ApplicationStartup.class);
        startup.getBufferedTimeline().getEvents().stream()
                .sorted(Comparator.comparing(StartupTimeline.TimelineEvent::getDuration).reversed())
                .limit(20)
                .forEach(e -> System.out.printf("%6dms  %s%n",
                        e.getDuration().toMillis(), e.getStartupStep().getName()));
    }
}
// 输出示例：
//   2100ms  spring.beans.instantiate     ← Bean 实例化（最耗时）
//    850ms  spring.context.refresh
//    320ms  spring.context.config-classes.parse
//    180ms  spring.boot.application.starting

# ─── 用 Actuator 的 startup 端点（Boot 2.4+）───
management.endpoints.web.exposure.include=startup
# POST /actuator/startup  → 返回并清空缓冲区（只能取一次）
# 可导入 https://spring-boot-startup-analyzer.fly.dev/ 可视化分析
```

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | ★ 启动类不在根包 | `@AutoConfigurationPackage` 注册的包不对，Entity/Mapper 扫不到 | 启动类放最外层包 |
| 2 | `@ConditionalOnBean` 用在业务配置类 | 判断结果错误（Bean 还没注册） | ★ 只在自动配置类中用 |
| 3 | 自动配置顺序不对 | `@ConditionalOnBean` 误判 | `@AutoConfigureAfter` / `@AutoConfiguration(after=)` |
| 4 | 自定义 starter 没写 imports 文件 | 自动配置完全不生效 | 创建 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` |
| 5 | Boot 2.7+ 仍用 spring.factories | 自动配置不加载（3.x 已移除支持） | 迁移到 `.imports` 文件 |
| 6 | Redis 默认 JDK 序列化 | Redis 中是乱码二进制 | 自定义 `RedisTemplate` Bean 覆盖 |
| 7 | 未排除不用的自动配置 | 启动慢、日志噪音 | `exclude` |
| 8 | `@EnableWebMvc` 误加 | ★ `WebMvcAutoConfiguration` 失效，丢失所有默认配置 | Boot 中不要加，用 `WebMvcConfigurer` |
| 9 | `proxyBeanMethods=true` 但配置类多 | 启动慢（每个类都生成 CGLIB 代理） | 设 `false` + 参数注入 |
| 10 | 全局懒加载隐藏配置错误 | 启动成功但首次请求 500 | 开发环境关闭 `lazy-initialization` |
| 11 | `spring.autoconfigure.exclude` 排除了必要的类 | 功能缺失且报错难懂 | 用 `--debug` 看 Negative matches |
| 12 | 配置属性前缀在 Boot 3 变了 | 配置不生效 | `spring.redis` → `spring.data.redis`（2.4→3.x 有大量前缀变更） |
| 13 | 三方 starter 与 Boot 版本不匹配 | 自动配置报错 | 严格对应版本（如 `mybatis-plus-spring-boot3-starter`） |
| 14 | 多个 starter 都配了同一功能 | Bean 冲突 | 用 `@Primary` 或排除 |
| 15 | 不知道某个 Bean 哪来的 | 难以排查 | `/actuator/beans` + `--debug` |
| 16 | Native Image 下反射失效 | `ClassNotFoundException` | 配 reachability metadata（hints） |
| 17 | devtools 改变了 ClassLoader | 序列化/类型判断异常 | 生产环境 devtools 自动禁用 |
| 18 | `@ConfigurationProperties` 未注册 | 属性为默认值 | 加 `@EnableConfigurationProperties` 或 `@ConfigurationPropertiesScan` |

---

## 关联笔记

- 上一篇：[[后端/SpringBoot/SpringBoot入门与项目搭建]]
- 下一篇：[[后端/SpringBoot/配置文件与自定义Starter]]（自定义 Starter 完整实战）
- 底层：[[后端/Spring/Spring注解大全与配置类]]（@Conditional、@Import 的机制）、[[后端/Spring/Spring概述与IoC容器]]（refresh 流程）
- 运维：[[后端/SpringBoot/日志-Actuator与打包部署]]（Actuator 端点）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
