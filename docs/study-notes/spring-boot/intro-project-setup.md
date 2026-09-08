---
title: "SpringBoot入门与项目搭建"
aliases:
  - "Spring Boot"
  - "SpringApplication.run"
tags:
  - "后端"
  - "java"
  - "spring"
  - "springboot"
category: "后端"
folder: "SpringBoot"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/SpringBoot/自动配置原理]]"
  - "[[后端/SpringBoot/配置文件与自定义Starter]]"
  - "[[后端/Spring/SSM整合实战]]"
  - "[[后端/SpringBoot/日志-Actuator与打包部署]]"
created: 2026-09-07
updated: 2026-09-07
---

# Spring Boot 入门与项目搭建

## 1. Spring Boot 是什么

**Spring Boot 不是新框架，而是「Spring 的快速开发脚手架」**：通过**自动配置**、**起步依赖**、**内嵌容器**、**生产级特性**，让开发者「开箱即用」地构建 Spring 应用，把 SSM 时代的数百行 XML 配置压缩到几行 YAML。

### 1.1 解决的痛点

| SSM 时代的痛点 | Spring Boot 的方案 |
| --- | --- |
| **配置繁琐**（web.xml + 4 个 spring XML + mybatis-config） | ★ **自动配置**（Auto Configuration） |
| **依赖版本冲突**（几十个 jar 手动配版本） | ★ **起步依赖**（Starter）+ BOM 统一管理 |
| **部署复杂**（打 war → 装 Tomcat → 部署） | ★ **内嵌容器**（jar 直接 `java -jar`） |
| **缺少监控**（无法感知应用健康状态） | ★ **Actuator**（健康检查、指标、端点） |
| **环境切换麻烦**（改配置重新打包） | ★ **Profile + 外置配置** |
| 编码、日志、事务等重复配置 | 全部有合理默认值 |

### 1.2 四大核心特性 ★★★★★

| 特性 | 说明 |
| --- | --- |
| **① 自动配置** | 根据 classpath 中的 jar、已有的 Bean、配置属性，**自动装配**合理的默认配置（详见 [[后端/SpringBoot/自动配置原理]]） |
| **② 起步依赖（Starter）** | `spring-boot-starter-web` 一个依赖引入 Web 开发所需的全部 jar（版本已协调好） |
| **③ 内嵌容器** | 内置 Tomcat（默认）/ Jetty / Undertow，打成 **可执行 jar**，无需外部容器 |
| **④ 生产就绪特性** | Actuator（健康检查、指标、环境）、外部化配置、Profile、优雅停机 |

**Spring Boot 的设计哲学：**

1. **约定优于配置（Convention over Configuration）**：绝大多数场景用默认配置即可，只在需要时覆盖。
2. **开箱即用（Out of the box）**：引入 starter 即可使用对应功能，零配置。
3. **无代码生成、无 XML 配置**：全注解 + YAML。
4. **不侵入 Spring**：Boot 只是 Spring 的封装，你写的仍是标准 Spring 代码。

### 1.3 版本选择

| Spring Boot | Spring | JDK | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 2.7.x | 5.3.x | 8+ | ★ 已 EOL（2023.11 停止 OSS 支持） | 存量项目主流 |
| 3.0.x | 6.0.x | **17+** | 已 EOL | 首个 jakarta 版本 |
| 3.1.x | 6.0.x | 17+ | 已 EOL | — |
| **3.2.x** | 6.1.x | 17+ | ★ OSS 支持至 2024.12 | RestClient、虚拟线程支持 |
| **3.3.x** | 6.1.x | 17+ | ★ 维护中（至 2025.06） | CDS 支持、可观测性增强 |
| **3.4.x** | 6.2.x | 17+ | ★ **当前推荐** | SSL Bundles 热重载、结构化日志 |
| 3.5.x | 6.2.x | 17+ | 最新 | API 版本控制 |
| **4.0** | 7.0 | **17+（推荐 21）** | 2025.11 发布 | JSpecify 空安全、模块化 |

> 【选型建议】
> - **新项目**：Spring Boot **3.4.x + JDK 21**（虚拟线程红利大）。
> - **JDK 17 环境**：Spring Boot 3.2~3.4。
> - **JDK 8 存量项目**：只能 2.7.x（商业支持需 Spring Enterprise/VMware Tanzu）。
> - **不要跨大版本混用**：Boot 2（javax）和 Boot 3（jakarta）的依赖不能混。

## 2. 创建项目

### 2.1 四种创建方式

| 方式 | 说明 | 适用 |
| --- | --- | --- |
| **① start.spring.io** ★ | 官方在线生成器（https://start.spring.io） | 最推荐，可视化选依赖 |
| **② IDEA 内置** | New Project → Spring Initializr | ★ 日常开发最方便 |
| **③ Spring CLI** | `spring init --dependencies=web,data-jpa myapp` | 命令行党 |
| **④ 手动创建** | 自己写 pom.xml + 启动类 | 理解原理、企业自定义脚手架 |

**start.spring.io 的选项：**

| 选项 | 说明 |
| --- | --- |
| Project | Maven Project / Gradle Project / **Gradle-Kotlin DSL** |
| Language | **Java** / Kotlin / Groovy |
| Spring Boot | 版本（选稳定版，非 SNAPSHOT） |
| Group | 组织（`com.example`） |
| Artifact | 项目名（`mall-service`） |
| Name / Description | 显示名 / 描述 |
| Package name | 包名（默认同 Artifact） |
| Packaging | **Jar**（推荐）/ War |
| Java | **17 / 21** |
| Dependencies | ★ 选择起步依赖（Add Dependencies → 搜索） |

### 2.2 手动创建（理解结构）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>

    <!-- ★ 继承 Spring Boot 的父 POM（获得依赖版本管理 + 插件配置） -->
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.4.0</version>
        <relativePath/>                       <!-- 从仓库查找，不用本地相对路径 -->
    </parent>

    <groupId>com.example</groupId>
    <artifactId>mall-service</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <name>mall-service</name>
    <description>商城服务</description>

    <properties>
        <java.version>21</java.version>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <mybatis-plus.version>3.5.9</mybatis-plus.version>
    </properties>

    <dependencies>
        <!-- ★★ 起步依赖：一个引入 Web 开发全部所需 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <!-- 参数校验 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <!-- AOP -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-aop</artifactId>
        </dependency>
        <!-- ★ 监控端点 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>

        <!-- 持久层 -->
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
            <version>${mybatis-plus.version}</version>
        </dependency>
        <dependency>
            <groupId>com.mysql</groupId>
            <artifactId>mysql-connector-j</artifactId>
            <scope>runtime</scope>
        </dependency>

        <!-- 工具 -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- 测试 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <!-- ★ 开发热部署（仅开发环境） -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-devtools</artifactId>
            <scope>runtime</scope>
            <optional>true</optional>
        </dependency>
    </dependencies>

    <build>
        <finalName>${project.artifactId}</finalName>
        <plugins>
            <!-- ★★ 打包为可执行 jar（核心插件） -->
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                    <layers><enabled>true</enabled></layers>      <!-- ★ 分层（Docker 缓存优化） -->
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

### 2.3 项目结构（★ 官方推荐）

```
mall-service/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/com/example/mall/
│   │   │   ├── MallApplication.java              # ★★ 启动类（必须在【根包】）
│   │   │   ├── controller/                        # 控制层（接收请求、参数校验、返回结果）
│   │   │   │   ├── UserController.java
│   │   │   │   └── OrderController.java
│   │   │   ├── service/                           # 业务层接口
│   │   │   │   ├── UserService.java
│   │   │   │   └── impl/                          # 业务实现
│   │   │   │       └── UserServiceImpl.java
│   │   │   ├── mapper/  (dao/)                    # 数据访问层
│   │   │   │   └── UserMapper.java
│   │   │   ├── entity/  (domain/po/)              # 数据库实体
│   │   │   ├── dto/                               # 入参对象（请求 DTO）
│   │   │   ├── vo/                                # 出参对象（响应 VO）
│   │   │   ├── query/                             # 查询条件对象
│   │   │   ├── converter/                         # ★ MapStruct 对象转换器
│   │   │   ├── config/                            # ★ 配置类
│   │   │   │   ├── WebMvcConfig.java
│   │   │   │   ├── MybatisPlusConfig.java
│   │   │   │   ├── RedisConfig.java
│   │   │   │   └── ThreadPoolConfig.java
│   │   │   ├── common/                            # 通用类
│   │   │   │   ├── Result.java                    # 统一响应
│   │   │   │   ├── ResultCode.java                # 错误码枚举
│   │   │   │   ├── PageResult.java                # 分页结果
│   │   │   │   ├── constant/                      # 常量
│   │   │   │   └── enums/                         # 枚举
│   │   │   ├── exception/                         # 自定义异常
│   │   │   │   ├── BusinessException.java
│   │   │   │   └── GlobalExceptionHandler.java    # ★ 全局异常处理
│   │   │   ├── aspect/                            # AOP 切面
│   │   │   ├── interceptor/                       # 拦截器
│   │   │   ├── filter/                            # 过滤器
│   │   │   ├── listener/                          # 事件监听器
│   │   │   ├── handler/                           # 类型处理器（MyBatis）
│   │   │   ├── task/                              # 定时任务
│   │   │   └── util/                              # 工具类
│   │   └── resources/
│   │       ├── application.yml                    # ★ 主配置
│   │       ├── application-dev.yml                # ★ 开发环境
│   │       ├── application-test.yml               # 测试环境
│   │       ├── application-prod.yml               # 生产环境
│   │       ├── mapper/                            # MyBatis XML
│   │       │   └── UserMapper.xml
│   │       ├── logback-spring.xml                 # ★ 日志配置
│   │       ├── static/                            # 静态资源（js/css/img）
│   │       ├── templates/                         # 模板（Thymeleaf）
│   │       ├── db/migration/                      # Flyway 数据库迁移脚本
│   │       └── META-INF/
│   │           └── spring/
│   │               └── org.springframework.boot.autoconfigure.AutoConfiguration.imports
│   └── test/java/com/example/mall/
│       ├── MallApplicationTests.java
│       ├── controller/
│       └── service/
└── Dockerfile
```

> 【★ 关键规则】**启动类必须放在「根包」**：
> `@SpringBootApplication` 隐含 `@ComponentScan`，**默认只扫描启动类所在包及其子包**。
> ```
> ✅ 启动类在 com.example.mall，Controller 在 com.example.mall.controller → 能扫到
> ❌ 启动类在 com.example.mall，Service 在 com.example.service        → 扫不到！Bean 不存在
> ```
> 这也是为什么 starter 的自动配置类放在 `org.springframework.boot.autoconfigure`（不在扫描范围），需要通过 `spring.factories`/`AutoConfiguration.imports` 显式注册。

### 2.4 启动类

```java
package com.example.mall;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * ★ 应用启动类
 */
@SpringBootApplication                            // ★★ 核心注解（三合一）
@MapperScan("com.example.mall.mapper")             // MyBatis Mapper 扫描
@EnableAsync                                       // 开启异步方法
@EnableScheduling                                  // 开启定时任务
// @EnableTransactionManagement                    // Boot 已自动开启，无需显式加
// @EnableCaching                                   // 开启 Spring Cache
public class MallApplication {

    public static void main(String[] args) {
        // ★★ 一行启动整个应用
        ConfigurableApplicationContext ctx = SpringApplication.run(MallApplication.class, args);

        // 启动后可做的事
        Environment env = ctx.getEnvironment();
        log.info("""
            ═══════════════════════════════════════════
              应用启动成功！
              应用名称: {}
              激活环境: {}
              访问地址: http://localhost:{}{}
              API 文档: http://localhost:{}/doc.html
              健康检查: http://localhost:{}/actuator/health
            ═══════════════════════════════════════════
            """,
            env.getProperty("spring.application.name"),
            Arrays.toString(env.getActiveProfiles()),
            env.getProperty("server.port", "8080"),
            env.getProperty("server.servlet.context-path", ""),
            env.getProperty("server.port", "8080"),
            env.getProperty("server.port", "8080"));
    }
}
```

**`@SpringBootApplication` 的组成（★ 必考）：**

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootConfiguration              // ① = @Configuration（标记为配置类）
@EnableAutoConfiguration              // ② ★★ 开启自动配置（Boot 的灵魂）
@ComponentScan(excludeFilters = {     // ③ ★ 组件扫描
    @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
    @Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class)
})
public @interface SpringBootApplication {

    @AliasFor(annotation = EnableAutoConfiguration.class)
    Class<?>[] exclude() default {};                    // 排除某些自动配置类

    @AliasFor(annotation = EnableAutoConfiguration.class)
    String[] excludeName() default {};                   // 按类名排除

    @AliasFor(annotation = ComponentScan.class, attribute = "basePackages")
    String[] scanBasePackages() default {};              // ★ 指定扫描包（默认是启动类所在包）

    @AliasFor(annotation = ComponentScan.class, attribute = "basePackageClasses")
    Class<?>[] scanBasePackageClasses() default {};      // 按类所在包扫描

    @AliasFor(annotation = SpringBootConfiguration.class, attribute = "proxyBeanMethods")
    boolean proxyBeanMethods() default true;              // ★ false 可提升启动速度

    Class<? extends TypeExcludeFilter> typeExcludeFilters() ...
}

// ─── 三个注解的作用 ───
// ① @SpringBootConfiguration = @Configuration
//    标记这是一个配置类，可以在其中用 @Bean 声明 Bean
// ② @EnableAutoConfiguration ★★ 核心
//    通过 @Import(AutoConfigurationImportSelector.class) 加载所有自动配置类
//    详见 [[后端/SpringBoot/自动配置原理]]
// ③ @ComponentScan
//    扫描启动类所在包及子包的 @Component/@Service/@Controller 等
//    excludeFilters 排除了自动配置类（避免重复注册）
```

```java
// ─── 常用变体 ───
// ① 排除某些自动配置（不需要某功能时，加快启动 + 避免报错）
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,              // 不用数据库时排除
    SecurityAutoConfiguration.class,                // 不用 Security
    RedisAutoConfiguration.class,
    MongoAutoConfiguration.class,
    GsonAutoConfiguration.class
})
// 或在 yml 中排除
// spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration

// ② 指定扫描包（启动类不在根包时）
@SpringBootApplication(scanBasePackages = {"com.example.mall", "com.example.common"})
@SpringBootApplication(scanBasePackageClasses = {MallApplication.class, CommonConfig.class})

// ③ 关闭 CGLIB 代理（提升启动速度，但 @Bean 方法不能互调）
@SpringBootApplication(proxyBeanMethods = false)

// ④ 拆开写（等价于 @SpringBootApplication）
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan("com.example.mall")
public class Application { }
```

## 3. SpringApplication.run() 启动流程 ★★★★★

```java
public static ConfigurableApplicationContext run(Class<?> primarySource, String... args) {
    return run(new Class<?>[] { primarySource }, args);
}

public static ConfigurableApplicationContext run(Class<?>[] primarySources, String[] args) {
    // ★ 两步：① 创建 SpringApplication 实例  ② 调用 run()
    return new SpringApplication(primarySources).run(args);
}
```

### 3.1 第一阶段：创建 SpringApplication 实例

```java
public SpringApplication(ResourceLoader resourceLoader, Class<?>... primarySources) {
    this.resourceLoader = resourceLoader;
    this.primarySources = new LinkedHashSet<>(Arrays.asList(primarySources));

    // ① ★ 推断应用类型
    this.webApplicationType = WebApplicationType.deduceFromClasspath();
    //   SERVLET：classpath 有 javax/jakarta.servlet + Spring MVC 的 ConfigurableWebApplicationContext
    //   REACTIVE：有 DispatcherHandler 且没有 DispatcherServlet
    //   NONE：都没有

    // ② ★ 加载 ApplicationContextInitializer（从 spring.factories）
    this.initializers = getSpringFactoriesInstances(ApplicationContextInitializer.class);

    // ③ ★ 加载 ApplicationListener（从 spring.factories）
    this.listeners = getSpringFactoriesInstances(ApplicationListener.class);

    // ④ ★ 推断主类（找 main 方法所在的类，用于日志和 banner）
    this.mainApplicationClass = deduceMainApplicationClass();
}
```

### 3.2 第二阶段：run() 方法的完整流程

```java
public ConfigurableApplicationContext run(String... args) {
    // JDK 9+ 用 StartupStep 做启动步骤追踪
    long startTime = System.nanoTime();
    DefaultBootstrapContext bootstrapContext = createBootstrapContext();
    ConfigurableApplicationContext context = null;

    // ① ★ 配置 Headless 模式（无显示器环境）
    configureHeadlessProperty();

    // ② ★★ 获取并启动 SpringApplicationRunListeners（发布启动事件）
    SpringApplicationRunListeners listeners = getRunListeners(args);
    listeners.starting(bootstrapContext, this.mainApplicationClass);
    //   → 发布 ApplicationStartingEvent（应用开始启动）

    try {
        ApplicationArguments applicationArguments = new DefaultApplicationArguments(args);

        // ③ ★★ 准备 Environment（加载所有配置）
        ConfigurableEnvironment environment = prepareEnvironment(listeners, bootstrapContext, applicationArguments);
        //   - 创建 Environment（StandardServletEnvironment）
        //   - 加载命令行参数、application.yml、系统属性、环境变量
        //   - ★ 处理 spring.profiles.active
        //   → 发布 ApplicationEnvironmentPreparedEvent
        //     ★ ConfigDataEnvironmentPostProcessor 在此加载配置文件（yml/properties）

        configureIgnoreBeanInfo(environment);

        // ④ ★ 打印 Banner（那个 Spring 图案）
        Banner printedBanner = printBanner(environment);

        // ⑤ ★★ 创建 ApplicationContext
        context = createApplicationContext();
        //   SERVLET → AnnotationConfigServletWebServerApplicationContext
        //   REACTIVE → AnnotationConfigReactiveWebServerApplicationContext
        //   NONE → AnnotationConfigApplicationContext
        context.setApplicationStartup(this.applicationStartup);

        // ⑥ ★ 准备上下文（注册主类、执行 Initializer）
        prepareContext(bootstrapContext, context, environment, listeners, applicationArguments, printedBanner);
        //   - 设置 Environment
        //   - 执行所有 ApplicationContextInitializer
        //   - ★ 注册主配置类（启动类）为 BeanDefinition
        //   - 发布 ApplicationContextInitializedEvent
        //   - 注册单例（applicationArguments、banner）
        //   - ★ 加载所有 BeanDefinition（但不实例化）
        //   - 发布 ApplicationPreparedEvent

        // ⑦ ★★★ 刷新上下文（★ 核心！IoC 容器启动）
        refreshContext(context);
        //   → AbstractApplicationContext.refresh() 的 13 个步骤
        //     见 [[后端/Spring/Spring概述与IoC容器]] 第 4 节
        //   ★ 其中 onRefresh() 会创建内嵌 Web 服务器（Tomcat）
        //   ★ finishBeanFactoryInitialization() 实例化所有单例 Bean

        // ⑧ 刷新后的处理（Boot 中为空实现，留给子类）
        afterRefresh(context, applicationArguments);

        // ⑨ 记录启动耗时
        Duration timeTakenToStartup = Duration.ofNanos(System.nanoTime() - startTime);

        // ⑩ ★★ 发布 ApplicationStartedEvent
        listeners.started(context, timeTakenToStartup);

        // ⑪ ★★ 执行 ApplicationRunner 和 CommandLineRunner
        callRunners(context, applicationArguments);

    } catch (Throwable ex) {
        handleRunFailure(context, ex, listeners);      // ★ 失败处理（发布失败事件、打印报告、关闭容器）
        throw new IllegalStateException(ex);
    }

    try {
        // ⑫ ★★ 发布 ApplicationReadyEvent（应用就绪，可对外服务）
        Duration timeTakenToReady = Duration.ofNanos(System.nanoTime() - startTime);
        listeners.ready(context, timeTakenToReady);
    } catch (Throwable ex) {
        handleRunFailure(context, ex, null);
        throw new IllegalStateException(ex);
    }

    return context;
}
```

**启动流程的完整时序：**

```
① 创建 SpringApplication（推断类型、加载 Initializer/Listener）
      ↓
② listeners.starting()        → ApplicationStartingEvent
      ↓
③ prepareEnvironment()        → ★ 加载 application.yml、profile
                              → ApplicationEnvironmentPreparedEvent
      ↓
④ printBanner()               → 打印 Spring 图案
      ↓
⑤ createApplicationContext()  → 创建容器（此时是空的）
      ↓
⑥ prepareContext()            → 注册启动类的 BeanDefinition
                              → ApplicationContextInitializedEvent
                              → ApplicationPreparedEvent
      ↓
⑦ ★ refreshContext()          → IoC 容器初始化（13 步）
                                 - invokeBeanFactoryPostProcessors（解析配置、扫描组件）
                                 - registerBeanPostProcessors
                                 - ★ onRefresh() → 创建内嵌 Tomcat（未启动）
                                 - finishBeanFactoryInitialization → 实例化所有单例 Bean
                                 - ★ finishRefresh() → 启动 Tomcat，开始接收请求
      ↓
⑧ listeners.started()         → ApplicationStartedEvent
      ↓
⑨ callRunners()               → ★ 执行 CommandLineRunner / ApplicationRunner
      ↓
⑩ listeners.ready()           → ★★ ApplicationReadyEvent（应用就绪）
      ↓
    应用运行中...
      ↓
⑪ 关闭时                      → ContextClosedEvent → 优雅停机
```

```java
// ─── 验证启动流程（自己写 Listener）───
@Component
@Slf4j
public class StartupListener {

    @EventListener
    public void onStarting(ApplicationStartingEvent e) { log.info("① 应用开始启动"); }

    @EventListener
    public void onEnvPrepared(ApplicationEnvironmentPreparedEvent e) {
        log.info("② 环境准备完成，profiles={}", Arrays.toString(e.getEnvironment().getActiveProfiles()));
    }

    @EventListener
    public void onCtxInitialized(ApplicationContextInitializedEvent e) { log.info("③ 上下文已初始化"); }

    @EventListener
    public void onPrepared(ApplicationPreparedEvent e) { log.info("④ BeanDefinition 已加载"); }

    @EventListener
    public void onStarted(ApplicationStartedEvent e) { log.info("⑤ 容器刷新完成"); }

    @EventListener
    public void onReady(ApplicationReadyEvent e) {
        log.info("⑥ ★ 应用就绪，耗时 {}ms，可以接收流量",
                e.getTimeTaken().toMillis());
    }

    @EventListener
    public void onFailed(ApplicationFailedEvent e) { log.error("启动失败", e.getException()); }

    @EventListener
    public void onClosed(ContextClosedEvent e) { log.info("⑦ 容器关闭"); }
}
// ⚠️ 注意：ApplicationStartingEvent 和 EnvironmentPreparedEvent 发生在容器创建之前，
//    @Component 的监听器【收不到】这两个事件！
//    要监听必须用 SpringApplication.addListeners() 或 META-INF/spring.factories 注册
```

### 3.3 内嵌 Tomcat 的创建时机

```java
// ServletWebServerApplicationContext.onRefresh()
@Override
protected void onRefresh() {
    super.onRefresh();
    try {
        createWebServer();                       // ★ 创建 Web 服务器
    } catch (Throwable ex) {
        throw new ApplicationContextException("Unable to start web server", ex);
    }
}

private void createWebServer() {
    WebServer webServer = this.webServer;
    ServletContext servletContext = getServletContext();
    if (webServer == null && servletContext == null) {
        // ★ 从容器中获取 ServletWebServerFactory
        ServletWebServerFactory factory = getWebServerFactory();
        // ★★ 创建 Web 服务器（此时还没启动，不绑定端口）
        this.webServer = factory.getWebServer(getSelfInitializer());
        getBeanFactory().registerSingleton("webServerGracefulShutdown", ...);
        getBeanFactory().registerSingleton("webServerStartStop", ...);
    }
    super.onRefresh();
}

// ServletWebServerApplicationContext.finishRefresh()
@Override
protected void finishRefresh() {
    super.finishRefresh();
    WebServer webServer = startWebServer();       // ★★ 启动 Web 服务器（绑定端口，开始接收请求）
    if (webServer != null) {
        publishEvent(new ServletWebServerInitializedEvent(webServer, this));
    }
}
```

> 【要点】**Tomcat 的「创建」和「启动」是分开的**：
> - `onRefresh()`：**创建** Tomcat 实例（配置 Connector、Context），但不绑定端口。
> - `finishRefresh()`：**启动** Tomcat（绑定端口，开始接收请求）。
> - 这样设计的好处：确保所有 Bean 都初始化完成后才开始接收流量，避免「端口开了但 Bean 还没好」。

## 4. 起步依赖（Starter）★★★★★

### 4.1 常用 Starter 清单

| Starter | 引入的能力 |
| --- | --- |
| **`spring-boot-starter`** | 核心（自动配置、日志、YAML） |
| **`spring-boot-starter-web`** | ★ Spring MVC + 内嵌 Tomcat + Jackson |
| `spring-boot-starter-webflux` | 响应式 Web（Reactor + Netty） |
| `spring-boot-starter-validation` | ★ JSR-380 参数校验（Hibernate Validator） |
| `spring-boot-starter-aop` | ★ AOP（AspectJ） |
| **`spring-boot-starter-data-jpa`** | JPA + Hibernate |
| **`spring-boot-starter-data-redis`** | ★ Redis（Lettuce） |
| `spring-boot-starter-data-mongodb` | MongoDB |
| `spring-boot-starter-data-elasticsearch` | Elasticsearch |
| `spring-boot-starter-jdbc` | ★ JDBC + HikariCP + 事务 |
| `spring-boot-starter-security` | Spring Security |
| `spring-boot-starter-oauth2-client/resource-server` | OAuth2 |
| **`spring-boot-starter-actuator`** | ★ 监控端点 |
| `spring-boot-starter-amqp` | RabbitMQ |
| `spring-boot-starter-mail` | 邮件 |
| `spring-boot-starter-thymeleaf` | Thymeleaf 模板 |
| `spring-boot-starter-freemarker` | FreeMarker |
| `spring-boot-starter-websocket` | WebSocket |
| `spring-boot-starter-cache` | 缓存抽象 |
| `spring-boot-starter-quartz` | Quartz 定时任务 |
| `spring-boot-starter-batch` | 批处理 |
| `spring-boot-starter-integration` | Spring Integration |
| `spring-boot-starter-test` | ★ JUnit5 + Mockito + AssertJ + Spring Test |
| `spring-boot-starter-undertow` | 替换 Tomcat 为 Undertow |
| `spring-boot-starter-jetty` | 替换 Tomcat 为 Jetty |
| `spring-boot-starter-log4j2` | ★ 替换 Logback 为 Log4j2 |
| `spring-boot-devtools` | 热部署（开发期） |
| `spring-boot-configuration-processor` | ★ 配置元数据生成（IDE 提示） |

**第三方常用 Starter：**

| Starter | 说明 |
| --- | --- |
| `mybatis-spring-boot-starter` / `mybatis-plus-spring-boot3-starter` | MyBatis / MyBatis-Plus |
| `druid-spring-boot-3-starter` | Druid 连接池 + 监控 |
| `knife4j-openapi3-jakarta-spring-boot-starter` | ★ API 文档（Swagger 增强） |
| `springdoc-openapi-starter-webmvc-ui` | OpenAPI 3 文档 |
| `redisson-spring-boot-starter` | ★ Redisson（分布式锁） |
| `rocketmq-spring-boot-starter` | RocketMQ |
| `spring-cloud-starter-alibaba-nacos-discovery` | Nacos 注册中心 |
| `spring-cloud-starter-alibaba-nacos-config` | Nacos 配置中心 |
| `spring-cloud-starter-openfeign` | Feign 声明式调用 |
| `spring-cloud-starter-gateway` | 网关 |
| `xxl-job-core` | XXL-JOB 分布式任务调度 |
| `easyexcel` | Excel 导入导出 |
| `hutool-all` | 工具库 |
| `transmittable-thread-local` | 跨线程池的 ThreadLocal |

```xml
<!-- ─── Starter 的本质：只是一个「依赖聚合 + 自动配置」的 pom ─── -->
<!-- spring-boot-starter-web 的 pom 内容（简化） -->
<dependencies>
    <dependency>spring-boot-starter</dependency>              <!-- 核心 -->
    <dependency>spring-boot-starter-json</dependency>          <!-- Jackson -->
    <dependency>spring-boot-starter-tomcat</dependency>        <!-- ★ 内嵌 Tomcat -->
    <dependency>spring-web</dependency>
    <dependency>spring-webmvc</dependency>
</dependencies>
<!-- 自动配置类在 spring-boot-autoconfigure 中（所有 starter 都传递依赖它） -->
```

### 4.2 排除与替换

```xml
<!-- ─── 替换内嵌容器：Tomcat → Undertow ─── -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>   <!-- ★ 排除 Tomcat -->
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-undertow</artifactId>          <!-- ★ 引入 Undertow -->
</dependency>

<!-- ─── 替换日志：Logback → Log4j2（性能更好，支持异步）─── -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-logging</artifactId>   <!-- ★ 排除 Logback -->
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-log4j2</artifactId>
</dependency>
```

## 5. 开发工具与效率提升

### 5.1 spring-boot-devtools（热部署）

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
    <scope>runtime</scope>                <!-- ★ runtime，不打进生产 jar -->
    <optional>true</optional>              <!-- ★ optional，不传递给依赖方 -->
</dependency>
```

```yaml
spring:
  devtools:
    restart:
      enabled: true                        # ★ 自动重启（默认 true）
      additional-paths: src/main/java      # 监听的额外路径
      exclude: static/**,public/**,templates/**   # ★ 排除（改静态资源不重启）
      poll-interval: 2s                     # 轮询间隔
      quiet-period: 1s                      # 静默期（避免频繁重启）
    livereload:
      enabled: true                         # ★ 浏览器自动刷新（需装 LiveReload 插件）
      port: 35729
    # ★ 属性覆盖（开发环境的默认值调整）
    # devtools 会自动设置：
    #   server.servlet.jsp.init-param.development=true
    #   spring.thymeleaf.cache=false         ← 模板不缓存
    #   spring.freemarker.cache=false
    #   spring.jpa.show-sql=true
    #   logging.level.web=DEBUG
```

**devtools 的原理与限制：**

| 特性 | 说明 |
| --- | --- |
| **两个 ClassLoader** | ★ base ClassLoader（加载不变的 jar）+ restart ClassLoader（加载项目类）。重启时只丢弃 restart ClassLoader，所以比重启 JVM 快很多 |
| 自动重启触发 | classpath 下的文件变化（IDEA 需要 `Build project automatically` + `Ctrl+F9` 或自动编译） |
| 属性覆盖 | 自动把缓存类配置设为 false（模板缓存、JPA 缓存） |
| LiveReload | 内置 LiveReload 服务器，浏览器装插件后自动刷新 |
| ★ **生产环境自动禁用** | 检测到 `java -jar` 运行时**自动禁用**（安全） |
| 局限 | 不能改方法签名/新增字段（需要完整重启）；不支持 JRebel 级别的真热替换 |

```
IDEA 配置自动编译：
① Settings → Build → Compiler → Build project automatically  ✅
② Settings → Advanced Settings → Allow auto-make to start even if developed application is currently running  ✅
③ 修改代码后按 Ctrl+F9（或等自动触发）→ 应用重启
```

> 【更好的方案】**JRebel**（商业，真热部署，改方法签名也生效）或 **HotSwapAgent**（开源，配合 DCEVM）。devtools 适合日常开发，JRebel 适合频繁调试。

### 5.2 配置元数据（IDE 智能提示）★★★★★

```xml
<!-- ★ 加入这个依赖，自定义的 @ConfigurationProperties 会有 IDE 提示 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-configuration-processor</artifactId>
    <optional>true</optional>
</dependency>
```

```java
/**
 * ★ 带完整文档的配置属性类（IDE 会有提示和说明）
 */
@ConfigurationProperties(prefix = "mall.order")
@Data
public class OrderProperties {

    /**
     * 订单超时未支付自动关闭的时间。
     * 支持Duration格式：30m、1h、2d
     */
    private Duration payTimeout = Duration.ofMinutes(30);

    /**
     * 单个用户同时可持有的最大待支付订单数。
     */
    private int maxPendingOrders = 5;

    /**
     * 是否开启库存预占。
     */
    private boolean stockPreemptEnabled = true;

    /**
     * 订单号前缀。
     */
    private String orderNoPrefix = "ORD";

    /**
     * ★ 嵌套配置
     */
    private final Notify notify = new Notify();

    @Data
    public static class Notify {
        /** 支付成功后是否发送短信 */
        private boolean smsEnabled = true;
        /** 通知模板 ID */
        private String templateId;
    }

    /**
     * ★ 提供可选值提示（IDE 下拉选择）
     */
    private Strategy strategy = Strategy.STRICT;

    public enum Strategy {
        /** 严格模式：库存不足直接失败 */
        STRICT,
        /** 宽松模式：允许超卖后补偿 */
        LOOSE
    }
}
```

```json
// 手动补充元数据：src/main/resources/META-INF/additional-spring-configuration-metadata.json
{
  "properties": [
    {
      "name": "mall.order.legacy-mode",
      "type": "java.lang.Boolean",
      "description": "【已废弃】兼容老版本的开关。",
      "deprecated": true,
      "deprecation": {
        "level": "warning",
        "replacement": "mall.order.strategy",
        "reason": "改用 strategy 配置"
      }
    }
  ],
  "hints": [
    {
      "name": "mall.order.strategy",
      "values": [
        { "value": "STRICT", "description": "严格模式，库存不足直接失败（推荐）" },
        { "value": "LOOSE", "description": "宽松模式，允许超卖后补偿" }
      ]
    }
  ]
}
```

## 6. 第一个完整示例（可运行）

```java
// ═══════ ① 实体 ═══════
@Data
@TableName("t_user")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String userName;
    private Integer age;
    private String email;
    private LocalDateTime createTime;
}

// ═══════ ② DTO / VO ═══════
@Data
public class UserCreateDTO {
    @NotBlank(message = "用户名不能为空")
    @Size(min = 2, max = 20, message = "用户名长度 2~20")
    private String userName;

    @NotNull @Min(0) @Max(150)
    private Integer age;

    @Email(message = "邮箱格式不正确")
    private String email;
}

@Data
@Builder
public class UserVO {
    @JsonSerialize(using = ToStringSerializer.class)      // ★ 防精度丢失
    private Long id;
    private String userName;
    private Integer age;
    private String email;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;

    public static UserVO from(User u) {
        return UserVO.builder()
                .id(u.getId()).userName(u.getUserName()).age(u.getAge())
                .email(u.getEmail()).createTime(u.getCreateTime())
                .build();
    }
}

// ═══════ ③ 统一响应 ═══════
@Data
@AllArgsConstructor
public class Result<T> {
    private Integer code;
    private String message;
    private T data;

    public static <T> Result<T> success(T data) { return new Result<>(0, "success", data); }
    public static <T> Result<T> failed(String msg) { return new Result<>(500, msg, null); }
    public static <T> Result<T> failed(int code, String msg) { return new Result<>(code, msg, null); }
}

// ═══════ ④ Mapper ═══════
public interface UserMapper extends BaseMapper<User> { }

// ═══════ ⑤ Service ═══════
public interface UserService extends IService<User> {
    Long create(UserCreateDTO dto);
    UserVO getById(Long id);
    PageResult<UserVO> page(int pageNum, int pageSize, String keyword);
}

@Service
@RequiredArgsConstructor
@Slf4j
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long create(UserCreateDTO dto) {
        // 唯一性校验
        if (lambdaQuery().eq(User::getUserName, dto.getUserName()).exists()) {
            throw new BusinessException("用户名已存在");
        }
        User user = new User();
        BeanUtils.copyProperties(dto, user);
        save(user);
        log.info("创建用户成功: id={}", user.getId());
        return user.getId();
    }

    @Override
    @Transactional(readOnly = true)
    public UserVO getById(Long id) {
        User user = getById(id);
        if (user == null) throw new BusinessException("用户不存在: " + id);
        return UserVO.from(user);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<UserVO> page(int pageNum, int pageSize, String keyword) {
        Page<User> page = lambdaQuery()
                .like(StringUtils.hasText(keyword), User::getUserName, keyword)
                .orderByDesc(User::getCreateTime)
                .page(new Page<>(pageNum, Math.min(pageSize, 100)));
        List<UserVO> vos = page.getRecords().stream().map(UserVO::from).toList();
        return PageResult.of(vos, page.getTotal(), pageNum, pageSize);
    }
}

// ═══════ ⑥ Controller ═══════
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "用户管理")
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}")
    @Operation(summary = "查询用户详情")
    public Result<UserVO> get(@PathVariable @Min(1) Long id) {
        return Result.success(userService.getById(id));
    }

    @GetMapping
    @Operation(summary = "分页查询用户")
    public Result<PageResult<UserVO>> page(
            @RequestParam(defaultValue = "1") @Min(1) int pageNum,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize,
            @RequestParam(required = false) String keyword) {
        return Result.success(userService.page(pageNum, pageSize, keyword));
    }

    @PostMapping
    @Operation(summary = "创建用户")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<Long> create(@RequestBody @Valid UserCreateDTO dto) {
        return Result.success(userService.create(dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除用户")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        userService.removeById(id);
    }
}

// ═══════ ⑦ 全局异常处理 ═══════
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusiness(BusinessException e) {
        log.warn("业务异常: {}", e.getMessage());
        return Result.failed(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return Result.failed(400, msg);
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception e) {
        log.error("系统异常", e);
        return Result.failed(500, "系统繁忙，请稍后重试");
    }
}

// ═══════ ⑧ 启动后初始化数据（可选）═══
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {
    private final UserService userService;

    @Override
    public void run(ApplicationArguments args) {
        if (userService.count() == 0) {
            log.info("初始化演示数据...");
            UserCreateDTO dto = new UserCreateDTO();
            dto.setUserName("demo");
            dto.setAge(25);
            dto.setEmail("demo@example.com");
            userService.create(dto);
        }
    }
}
```

```yaml
# application.yml
server:
  port: 8080
  servlet:
    context-path: /
    encoding:
      charset: UTF-8
      force: true
  shutdown: graceful                     # ★ 优雅停机

spring:
  application:
    name: mall-service
  profiles:
    active: dev
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/mall?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true&rewriteBatchedStatements=true
    username: root
    password: ${DB_PASSWORD:123456}
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 3000
  lifecycle:
    timeout-per-shutdown-phase: 30s
  jackson:
    date-format: yyyy-MM-dd HH:mm:ss
    time-zone: GMT+8
    default-property-inclusion: non_null
    serialization:
      write-dates-as-timestamps: false
    deserialization:
      fail-on-unknown-properties: false
  mvc:
    throw-exception-if-no-handler-found: true
  web:
    resources:
      add-mappings: false                 # 配合上一行，404 走全局异常处理

mybatis-plus:
  mapper-locations: classpath*:mapper/**/*.xml
  configuration:
    map-underscore-to-camel-case: true
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl      # 开发打印 SQL
  global-config:
    banner: false

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: always

logging:
  level:
    root: INFO
    com.example: DEBUG
```

```bash
# ─── 运行 ───
# 方式 1：IDEA 直接运行 MallApplication.main()
# 方式 2：Maven
mvn spring-boot:run
mvn spring-boot:run -Dspring-boot.run.profiles=prod
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=9090
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xmx1g"
# 方式 3：打包后运行
mvn clean package -DskipTests
java -jar target/mall-service.jar
java -jar target/mall-service.jar --spring.profiles.active=prod --server.port=9090

# ─── 验证 ───
curl http://localhost:8080/api/v1/users/1
curl -X POST http://localhost:8080/api/v1/users \
     -H "Content-Type: application/json" \
     -d '{"userName":"张三","age":25,"email":"zhangsan@example.com"}'
curl http://localhost:8080/actuator/health
```

## 7. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | ★ 启动类不在根包 | Bean 扫不到（`NoSuchBeanDefinitionException`） | 启动类放最外层包，或 `scanBasePackages` |
| 2 | javax/jakarta 混用 | `NoClassDefFoundError` | Boot 2 用 javax，Boot 3 用 jakarta |
| 3 | Boot 3 用老版本三方库 | 各种 ClassNotFound | 升级到 jakarta 兼容版本（MP 3.5.3.1+、Druid 1.2.20+） |
| 4 | 未加 `spring-boot-maven-plugin` | jar 无法执行（`no main manifest attribute`） | 必须加该插件 |
| 5 | 多模块项目中库模块也加了 boot 插件 | 依赖方无法引用 | ★ 只在启动模块加 |
| 6 | `@EnableWebMvc` 误加 | 丢失所有自动配置（JSON、静态资源） | ★ Boot 中不要加 |
| 7 | devtools 打进生产 jar | 安全风险、性能问题 | `scope=runtime` + `optional=true`（Boot 检测到 java -jar 会自动禁用） |
| 8 | devtools 改代码不重启 | 热部署失效 | IDEA 开启自动编译 |
| 9 | 端口被占用 | `Port 8080 was already in use` | `--server.port=0`（随机端口）或改端口 |
| 10 | `spring.profiles.active` 配错 | 用了错误的配置 | 检查 profile 名与文件名一致 |
| 11 | Long 型 ID 前端精度丢失 | 末几位变 0 | Jackson 的 `ToStringSerializer` |
| 12 | LocalDateTime 序列化为数组 | 前端拿到 `[2026,9,7]` | 引入 `jackson-datatype-jsr310`（starter-web 已含） |
| 13 | 未排除 `DataSourceAutoConfiguration` | 无数据库项目启动报错 | `@SpringBootApplication(exclude=...)` |
| 14 | `spring.main.allow-circular-references` | Boot 2.6+ 默认禁止循环依赖 | 重构（推荐）或临时开启 |
| 15 | 测试类加载完整容器太慢 | 单测跑几十秒 | 用 `@WebMvcTest`/`@DataJpaTest` 切片测试 |
| 16 | 打包后 `resources` 下的文件读不到 | `FileNotFoundException` | 用 `ClassPathResource`/`getResourceAsStream`，不能用 `File` |
| 17 | `finalName` 与 artifactId 混淆 | 部署脚本找不到 jar | 统一命名规范 |
| 18 | 未配 `server.shutdown=graceful` | 重启时请求 502 | Boot 2.3+ 配置优雅停机 |
| 19 | 启动时 `ApplicationRunner` 中依赖未就绪 | NPE | Runner 在所有 Bean 就绪后执行，一般是配置问题 |
| 20 | banner 关闭方式不对 | 仍打印 | `spring.main.banner-mode=off` |
| 21 | 多个 main 方法 | `spring-boot:run` 不知道启动哪个 | 配置 `<mainClass>` |
| 22 | 循环依赖 + `@Async` | 报错或行为异常 | 见 [[后端/Spring/循环依赖与三级缓存]] |

---

## 关联笔记

- 下一篇：[[后端/SpringBoot/自动配置原理]]
- 相关：[[后端/SpringBoot/配置文件与自定义Starter]]、[[后端/SpringBoot/整合Web开发]]
- 前置：[[后端/Spring/SSM整合实战]]（Boot 自动化了什么）、[[后端/Spring/Spring概述与IoC容器]]
- 部署：[[后端/SpringBoot/日志-Actuator与打包部署]]、[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
