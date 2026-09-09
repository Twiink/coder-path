---
title: "SSM整合实战"
aliases:
  - "SSM"
  - "Spring SpringMVC MyBatis 整合"
tags:
  - "后端"
  - "java"
  - "spring"
  - "mybatis"
  - "实战"
category: "后端"
folder: "Spring"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Spring/SpringMVC入门与执行流程]]"
  - "[[后端/MyBatis/MyBatis入门与核心配置]]"
  - "[[后端/Spring/事务管理与失效场景]]"
  - "[[后端/SpringBoot/SpringBoot入门与项目搭建]]"
created: 2026-09-07
updated: 2026-09-07
---

# SSM 整合实战

> **SSM = Spring + Spring MVC + MyBatis**，是 Spring Boot 普及之前 Java Web 的主流技术栈。虽然现在新项目一律用 Spring Boot，但：
> 1. **大量存量企业系统仍是 SSM**（尤其是政府、金融、传统行业），维护需求真实存在。
> 2. **理解 SSM 的手动整合，才能真正理解 Spring Boot 的自动配置做了什么**（Boot 就是把这些 XML/JavaConfig 自动化了）。
> 3. 面试仍会问「SSM 整合的关键配置」「Spring 和 SpringMVC 的容器关系」。
>
> 本篇给出**完整可运行的 SSM 项目骨架**，并在每处标注「Spring Boot 中对应的自动配置」。

## 1. SSM 三大框架的职责划分 ★★★★★

```
┌──────────────────────────────────────────────────────────────┐
│                        SSM 架构分层                            │
├──────────────────────────────────────────────────────────────┤
│  浏览器 / 客户端                                                │
└────────────────────────┬─────────────────────────────────────┘
                         ↓ HTTP
┌──────────────────────────────────────────────────────────────┐
│  Tomcat（Servlet 容器）                                         │
│  ├── ContextLoaderListener     ★ 启动【Spring 根容器】          │
│  │     → 加载 applicationContext.xml                           │
│  │     → 管理 Service、DAO、DataSource、TransactionManager      │
│  └── DispatcherServlet         ★ 启动【Spring MVC 子容器】       │
│        → 加载 spring-mvc.xml                                   │
│        → 管理 Controller、HandlerMapping、ViewResolver          │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  Controller 层（Spring MVC）                                    │
│  @Controller / @RestController                                 │
│  职责：接收请求、参数校验、调用 Service、返回 JSON/视图             │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  Service 层（Spring）★ 业务核心 + 事务边界                        │
│  @Service + @Transactional                                     │
│  职责：业务逻辑、事务控制、跨 DAO 编排                             │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  DAO 层（MyBatis）                                              │
│  @Mapper 接口 + Mapper.xml                                     │
│  职责：SQL 执行、ORM 映射                                        │
│  ★ Mapper 接口由 MyBatis 生成动态代理，注册为 Spring Bean          │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  MySQL / Redis / ...                                           │
└──────────────────────────────────────────────────────────────┘
```

**三者的分工与协作关系：**

| 框架 | 角色 | 核心职责 | 关键组件 |
| --- | --- | --- | --- |
| **Spring** | ★ **容器 + 粘合剂** | IoC 管理所有 Bean、AOP、**事务管理** | `ApplicationContext`、`@Service`、`PlatformTransactionManager` |
| **Spring MVC** | **Web 层** | 请求分发、参数绑定、视图/JSON 渲染 | `DispatcherServlet`、`@Controller` |
| **MyBatis** | **持久层** | SQL 映射、ORM、动态 SQL | `SqlSessionFactory`、`Mapper` 接口 |

**整合的三个关键点（★ 面试）：**

1. **Spring 管理 MyBatis**：通过 `mybatis-spring` 桥接包，把 `SqlSessionFactory`、`Mapper` 接口注册为 Spring Bean，Mapper 的 SqlSession 与 Spring 事务同步。
2. **Spring 管理事务**：`DataSourceTransactionManager` 管理 JDBC 连接，MyBatis 通过 `SpringManagedTransaction` 使用同一个连接 → 实现声明式事务。
3. **两个容器（父子容器）**：Spring 根容器（Service/DAO）+ Spring MVC 子容器（Controller），子容器能访问父容器的 Bean，反之不行。

### 1.1 父子容器（★ SSM 的核心设计，也是常见坑源）

```
┌─────────────────────────────────────────────┐
│  WebApplicationContext（根容器 / 父容器）      │
│  由 ContextLoaderListener 创建                │
│  存储位置：ServletContext 属性                 │
│    WebApplicationContext.ROOT_                │
│    WEB_APPLICATION_CONTEXT_ATTRIBUTE          │
│  管理：@Service、@Repository、@Component、     │
│        DataSource、TransactionManager、        │
│        Mapper、AOP 切面                        │
└──────────────────┬──────────────────────────┘
                   │ parent（子容器可访问父容器的 Bean）
                   ↓
┌─────────────────────────────────────────────┐
│  WebApplicationContext（MVC 子容器）          │
│  由 DispatcherServlet 创建                    │
│  存储位置：ServletConfig / ServletContext      │
│    属性名带 servlet 名                        │
│  管理：@Controller、HandlerMapping、           │
│        HandlerAdapter、ViewResolver、          │
│        Interceptor、MessageConverter          │
└─────────────────────────────────────────────┘
```

```java
// ─── 父子容器的规则 ───
// ① 子容器可以获取父容器的 Bean（Controller 注入 Service ✅）
// ② 父容器【不能】获取子容器的 Bean（Service 注入 Controller ❌）
// ③ 两个容器是【独立】的：各自有自己的 BeanPostProcessor、AOP 代理

// ─── ★ 常见坑：重复扫描导致 Bean 被创建两次 ───
// 错误配置：
// applicationContext.xml:  <context:component-scan base-package="com.example"/>  ← 扫描了全部
// spring-mvc.xml:          <context:component-scan base-package="com.example"/>  ← 又扫描了全部
// 后果：
//   1. Service 被创建两次（父容器一个、子容器一个）
//   2. ★ 父容器的 Service 上的 @Transactional【不生效】！
//      因为 <tx:annotation-driven> 只在父容器配置，只对父容器的 Bean 生效
//      而 Controller 注入的是【子容器】的 Service（子容器优先）→ 没有事务代理
//   3. AOP 切面可能重复执行或失效
//   4. @PostConstruct 执行两次

// ✅ 正确配置：职责分离，互不重叠
// applicationContext.xml（父容器）：扫描 Service/DAO，排除 Controller
<context:component-scan base-package="com.example">
    <context:exclude-filter type="annotation"
        expression="org.springframework.stereotype.Controller"/>
    <context:exclude-filter type="annotation"
        expression="org.springframework.web.bind.annotation.RestController"/>
    <context:exclude-filter type="annotation"
        expression="org.springframework.web.bind.annotation.ControllerAdvice"/>
</context:component-scan>

// spring-mvc.xml（子容器）：只扫描 Controller
<context:component-scan base-package="com.example" use-default-filters="false">
    <context:include-filter type="annotation"
        expression="org.springframework.stereotype.Controller"/>
    <context:include-filter type="annotation"
        expression="org.springframework.web.bind.annotation.RestController"/>
    <context:include-filter type="annotation"
        expression="org.springframework.web.bind.annotation.ControllerAdvice"/>
</context:component-scan>
```

> 【Spring Boot 的变化】**Spring Boot 只有一个容器**（没有父子之分），`DispatcherServlet` 和所有 Bean 都在同一个 `ApplicationContext` 中。所以「重复扫描」「事务不生效」这类坑在 Boot 中不存在。这也是 Boot 简化配置的体现之一。

## 2. 完整项目结构与依赖

### 2.1 目录结构

```
ssm-demo/
├── pom.xml
├── src/main/
│   ├── java/com/example/
│   │   ├── config/                        # ★ JavaConfig 方式的配置类（可选，替代 XML）
│   │   │   ├── RootConfig.java
│   │   │   ├── WebConfig.java
│   │   │   ├── DataSourceConfig.java
│   │   │   └── MyBatisConfig.java
│   │   ├── controller/
│   │   │   └── UserController.java
│   │   ├── service/
│   │   │   ├── UserService.java           # 接口
│   │   │   └── impl/UserServiceImpl.java  # 实现
│   │   ├── mapper/  (或 dao/)
│   │   │   └── UserMapper.java            # ★ MyBatis Mapper 接口
│   │   ├── entity/  (或 domain/po/)
│   │   │   └── User.java
│   │   ├── dto/                           # 请求参数对象
│   │   │   └── UserQuery.java
│   │   ├── vo/                            # 响应视图对象
│   │   │   └── UserVO.java
│   │   ├── common/
│   │   │   ├── Result.java                # 统一响应
│   │   │   ├── ResultCode.java            # 错误码
│   │   │   ├── PageResult.java            # 分页
│   │   │   └── exception/
│   │   │       ├── BusinessException.java
│   │   │       └── GlobalExceptionHandler.java
│   │   ├── aspect/                        # AOP 切面
│   │   ├── interceptor/                   # 拦截器
│   │   ├── filter/                        # 过滤器
│   │   ├── listener/                      # 监听器
│   │   └── util/
│   └── resources/
│       ├── jdbc.properties                # ★ 数据库配置
│       ├── spring/                        # ★ Spring 配置（XML 方式）
│       │   ├── applicationContext.xml     # 根容器
│       │   ├── spring-mvc.xml             # MVC 子容器
│       │   ├── spring-dao.xml             # 数据源 + MyBatis
│       │   └── spring-tx.xml              # 事务
│       ├── mapper/                        # ★ MyBatis 的 Mapper XML
│       │   └── UserMapper.xml
│       ├── mybatis-config.xml             # MyBatis 全局配置
│       ├── logback.xml                    # 日志
│       └── static/                        # 静态资源
└── src/main/webapp/
    ├── WEB-INF/
    │   ├── web.xml                        # ★★ SSM 的核心配置入口
    │   └── views/                         # JSP（★ 放 WEB-INF 下，外部无法直接访问）
    │       ├── user/list.jsp
    │       └── error/404.jsp
    └── static/                            # 也可放这里的静态资源
```

### 2.2 pom.xml（完整依赖）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>ssm-demo</artifactId>
    <version>1.0.0</version>
    <packaging>war</packaging>                       <!-- ★ SSM 传统方式打 war -->

    <properties>
        <java.version>1.8</java.version>              <!-- 老项目多为 JDK 8 -->
        <maven.compiler.source>${java.version}</maven.compiler.source>
        <maven.compiler.target>${java.version}</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>

        <!-- ★ 版本统一管理 -->
        <spring.version>5.3.31</spring.version>        <!-- Spring 5.x（JDK 8 可用） -->
        <mybatis.version>3.5.13</mybatis.version>
        <mybatis.spring.version>2.1.1</mybatis.spring.version>
        <mysql.version>8.0.33</mysql.version>
        <druid.version>1.2.20</druid.version>
        <jackson.version>2.15.3</jackson.version>
        <slf4j.version>1.7.36</slf4j.version>
        <logback.version>1.2.12</logback.version>
        <servlet.version>4.0.1</servlet.version>       <!-- javax.servlet（Spring 5） -->
        <jstl.version>1.2</jstl.version>
        <lombok.version>1.18.30</lombok.version>
        <hutool.version>5.8.23</hutool.version>
        <pagehelper.version>5.3.2</pagehelper.version>
    </properties>

    <dependencies>
        <!-- ═══════ Spring 核心 ═══════ -->
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-context</artifactId>       <!-- ★ 含 core、beans、aop、expression -->
            <version>${spring.version}</version>
        </dependency>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-webmvc</artifactId>        <!-- ★ Spring MVC -->
            <version>${spring.version}</version>
        </dependency>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-jdbc</artifactId>           <!-- ★ JdbcTemplate + 事务管理 -->
            <version>${spring.version}</version>
        </dependency>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-tx</artifactId>             <!-- 事务抽象 -->
            <version>${spring.version}</version>
        </dependency>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-aop</artifactId>
            <version>${spring.version}</version>
        </dependency>
        <dependency>
            <groupId>org.aspectj</groupId>
            <artifactId>aspectjweaver</artifactId>         <!-- ★ AOP 必需（切点表达式解析） -->
            <version>1.9.20.1</version>
        </dependency>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-test</artifactId>           <!-- 单元测试 -->
            <version>${spring.version}</version>
            <scope>test</scope>
        </dependency>

        <!-- ═══════ MyBatis ═══════ -->
        <dependency>
            <groupId>org.mybatis</groupId>
            <artifactId>mybatis</artifactId>
            <version>${mybatis.version}</version>
        </dependency>
        <dependency>
            <groupId>org.mybatis</groupId>
            <artifactId>mybatis-spring</artifactId>        <!-- ★★ 桥接包（整合的关键！） -->
            <version>${mybatis.spring.version}</version>
        </dependency>
        <dependency>
            <groupId>com.github.pagehelper</groupId>
            <artifactId>pagehelper</artifactId>             <!-- 分页插件 -->
            <version>${pagehelper.version}</version>
        </dependency>

        <!-- ═══════ 数据库 ═══════ -->
        <dependency>
            <groupId>com.mysql</groupId>
            <artifactId>mysql-connector-j</artifactId>
            <version>${mysql.version}</version>
            <scope>runtime</scope>                          <!-- ★ runtime -->
        </dependency>
        <dependency>
            <groupId>com.alibaba</groupId>
            <artifactId>druid</artifactId>                   <!-- ★ 连接池 -->
            <version>${druid.version}</version>
        </dependency>

        <!-- ═══════ Web / Servlet ═══════ -->
        <dependency>
            <groupId>javax.servlet</groupId>
            <artifactId>javax.servlet-api</artifactId>
            <version>${servlet.version}</version>
            <scope>provided</scope>                          <!-- ★★ 必须 provided！ -->
        </dependency>
        <dependency>
            <groupId>javax.servlet.jsp</groupId>
            <artifactId>javax.servlet.jsp-api</artifactId>
            <version>2.3.3</version>
            <scope>provided</scope>
        </dependency>
        <dependency>
            <groupId>javax.servlet</groupId>
            <artifactId>jstl</artifactId>                     <!-- JSP 标签库 -->
            <version>${jstl.version}</version>
        </dependency>
        <dependency>
            <groupId>javax.validation</groupId>
            <artifactId>validation-api</artifactId>            <!-- ★ JSR-303 校验 API -->
            <version>2.0.1.Final</version>
        </dependency>
        <dependency>
            <groupId>org.hibernate.validator</groupId>
            <artifactId>hibernate-validator</artifactId>        <!-- ★ 校验实现 -->
            <version>6.2.5.Final</version>
        </dependency>

        <!-- ═══════ JSON ═══════ -->
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>          <!-- ★ @ResponseBody 必需 -->
            <version>${jackson.version}</version>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.datatype</groupId>
            <artifactId>jackson-datatype-jsr310</artifactId>    <!-- ★ JDK 8 日期支持 -->
            <version>${jackson.version}</version>
        </dependency>

        <!-- ═══════ 日志 ═══════ -->
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
            <version>${slf4j.version}</version>
        </dependency>
        <dependency>
            <groupId>ch.qos.logback</groupId>
            <artifactId>logback-classic</artifactId>
            <version>${logback.version}</version>
        </dependency>
        <!-- ★ 把其他框架的日志桥接到 SLF4J -->
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>jcl-over-slf4j</artifactId>            <!-- Spring 的 commons-logging -->
            <version>${slf4j.version}</version>
        </dependency>
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>log4j-over-slf4j</artifactId>
            <version>${slf4j.version}</version>
        </dependency>

        <!-- ═══════ 工具 ═══════ -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <version>${lombok.version}</version>
            <scope>provided</scope>
        </dependency>
        <dependency>
            <groupId>cn.hutool</groupId>
            <artifactId>hutool-all</artifactId>
            <version>${hutool.version}</version>
        </dependency>
        <dependency>
            <groupId>org.apache.commons</groupId>
            <artifactId>commons-lang3</artifactId>
            <version>3.13.0</version>
        </dependency>
        <dependency>
            <groupId>commons-io</groupId>
            <artifactId>commons-io</artifactId>
            <version>2.15.0</version>
        </dependency>

        <!-- ═══════ 测试 ═══════ -->
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <finalName>ssm-demo</finalName>
        <resources>
            <!-- ★★ 让 src/main/java 下的 XML 也被打包（Mapper XML 与接口同目录时需要） -->
            <resource>
                <directory>src/main/java</directory>
                <includes><include>**/*.xml</include></includes>
                <filtering>false</filtering>
            </resource>
            <resource>
                <directory>src/main/resources</directory>
                <filtering>true</filtering>                  <!-- ★ 开启变量替换 -->
                <includes>
                    <include>**/*.xml</include>
                    <include>**/*.properties</include>
                    <include>**/*.yml</include>
                </includes>
            </resource>
            <resource>
                <directory>src/main/resources</directory>
                <filtering>false</filtering>                  <!-- 二进制文件不过滤 -->
                <excludes>
                    <exclude>**/*.xml</exclude>
                    <exclude>**/*.properties</exclude>
                    <exclude>**/*.yml</exclude>
                </excludes>
            </resource>
        </resources>

        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>${java.version}</source>
                    <target>${java.version}</target>
                    <encoding>UTF-8</encoding>
                    <compilerArgs><arg>-parameters</arg></compilerArgs>   <!-- ★ 保留参数名 -->
                </configuration>
            </plugin>
            <!-- ★ Tomcat 插件（本地运行，无需外部 Tomcat） -->
            <plugin>
                <groupId>org.apache.tomcat.maven</groupId>
                <artifactId>tomcat7-maven-plugin</artifactId>
                <version>2.2</version>
                <configuration>
                    <port>8080</port>
                    <path>/</path>
                    <uriEncoding>UTF-8</uriEncoding>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-war-plugin</artifactId>
                <version>3.4.0</version>
                <configuration>
                    <failOnMissingWebXml>false</failOnMissingWebXml>   <!-- ★ 无 web.xml 也能打包 -->
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.2.2</version>
                <configuration><skipTests>true</skipTests></configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

> 【坑】**`mybatis-spring` 的版本必须与 Spring/MyBatis 匹配**：
> | mybatis-spring | MyBatis | Spring | JDK |
> | --- | --- | --- | --- |
> | 1.3.x | 3.4+ | 3.2.2+ | 6+ |
> | **2.0.x** | 3.5+ | **5.0+** | **8+** |
> | **2.1.x** | 3.5+ | 5.0+ | 8+（★ SSM 常用） |
> | **3.0.x** | 3.5+ | **6.0+** | **17+**（jakarta） |
>
> 版本不匹配的典型报错：`NoClassDefFoundError: org/springframework/...` 或 `NoSuchMethodError`。

## 3. web.xml 配置详解 ★★★★★

```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
                             http://xmlns.jcp.org/xml/ns/javaee/web-app_4_0.xsd"
         version="4.0"
         metadata-complete="false">          <!-- ★ false 才扫描注解（@WebServlet 等） -->

    <display-name>SSM Demo</display-name>

    <!-- ═══════════ ① 全局参数：指定 Spring 配置文件位置 ═══════════ -->
    <context-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>
            classpath:spring/applicationContext.xml,
            classpath:spring/spring-dao.xml,
            classpath:spring/spring-tx.xml
        </param-value>
        <!-- ★ 支持通配符：classpath:spring/applicationContext-*.xml -->
        <!-- ★ 支持多个文件（逗号/空格/换行分隔） -->
    </context-param>

    <!-- ═══════════ ② ★★ 启动 Spring 根容器 ═══════════ -->
    <listener>
        <listener-class>org.springframework.web.context.ContextLoaderListener</listener-class>
    </listener>
    <!-- 作用：
         ① 应用启动时读取 contextConfigLocation，创建【根 WebApplicationContext】
         ② 存入 ServletContext（属性名 ROOT_WEB_APPLICATION_CONTEXT_ATTRIBUTE）
         ③ 应用关闭时销毁容器（触发所有 Bean 的 destroy）
         ★ 它实现了 ServletContextListener，在 contextInitialized 中启动 Spring -->

    <!-- 请求级别的监听器（★ 让非 Web 层也能拿到 request） -->
    <listener>
        <listener-class>org.springframework.web.context.request.RequestContextListener</listener-class>
    </listener>

    <!-- ═══════════ ③ ★ 字符编码过滤器（必须放在最前面！）═══ -->
    <filter>
        <filter-name>characterEncodingFilter</filter-name>
        <filter-class>org.springframework.web.filter.CharacterEncodingFilter</filter-class>
        <init-param>
            <param-name>encoding</param-name>
            <param-value>UTF-8</param-value>
        </init-param>
        <init-param>
            <param-name>forceEncoding</param-name>       <!-- ★ 强制请求和响应都用 UTF-8 -->
            <param-value>true</param-value>
        </init-param>
        <async-supported>true</async-supported>
    </filter>
    <filter-mapping>
        <filter-name>characterEncodingFilter</filter-name>
        <url-pattern>/*</url-pattern>                     <!-- ★ 拦截所有请求 -->
    </filter-mapping>

    <!-- ═══════════ ④ ★★ DispatcherServlet（Spring MVC 入口）═══ -->
    <servlet>
        <servlet-name>dispatcher</servlet-name>
        <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
        <init-param>
            <param-name>contextConfigLocation</param-name>
            <param-value>classpath:spring/spring-mvc.xml</param-value>
            <!-- ★ 不配置时默认找 /WEB-INF/{servlet-name}-servlet.xml -->
        </init-param>
        <init-param>
            <param-name>throwExceptionIfNoHandlerFound</param-name>   <!-- ★ 404 抛异常（便于全局处理） -->
            <param-value>true</param-value>
        </init-param>
        <init-param>
            <param-name>detectAllHandlerMappings</param-name>
            <param-value>true</param-value>
        </init-param>
        <load-on-startup>1</load-on-startup>              <!-- ★★ 启动时初始化（避免首个请求慢） -->
        <async-supported>true</async-supported>            <!-- ★ 支持异步 -->
        <multipart-config>                                 <!-- ★ 文件上传配置（Servlet 3.0+） -->
            <location>/data/tmp/upload</location>
            <max-file-size>52428800</max-file-size>        <!-- 50MB -->
            <max-request-size>104857600</max-request-size>  <!-- 100MB -->
            <file-size-threshold>1048576</file-size-threshold>  <!-- 1MB 以上写磁盘 -->
        </multipart-config>
    </servlet>
    <servlet-mapping>
        <servlet-name>dispatcher</servlet-name>
        <url-pattern>/</url-pattern>                       <!-- ★★ 用 / 而非 /* -->
    </servlet-mapping>
    <!-- ★ / 与 /* 的区别：
         /     → 匹配所有请求，但【不匹配 JSP】（JSP 由容器的 JspServlet 处理）★ 推荐
         /*    → 匹配所有请求，【包括 JSP】→ 会导致 JSP 也被 DispatcherServlet 处理而报错 -->

    <!-- ═══════════ ⑤ 其他实用 Filter ═══════════ -->
    <!-- 把 POST 伪装成 PUT/DELETE（RESTful 支持） -->
    <filter>
        <filter-name>hiddenHttpMethodFilter</filter-name>
        <filter-class>org.springframework.web.filter.HiddenHttpMethodFilter</filter-class>
    </filter>
    <filter-mapping>
        <filter-name>hiddenHttpMethodFilter</filter-name>
        <url-pattern>/*</url-pattern>
    </filter-mapping>

    <!-- 让 PUT/PATCH/DELETE 也能解析表单参数 -->
    <filter>
        <filter-name>formContentFilter</filter-name>
        <filter-class>org.springframework.web.filter.FormContentFilter</filter-class>
    </filter>
    <filter-mapping>
        <filter-name>formContentFilter</filter-name>
        <url-pattern>/*</url-pattern>
    </filter-mapping>

    <!-- XSS 过滤（自定义） -->
    <filter>
        <filter-name>xssFilter</filter-name>
        <filter-class>com.example.filter.XssFilter</filter-class>
        <async-supported>true</async-supported>
    </filter>
    <filter-mapping>
        <filter-name>xssFilter</filter-name>
        <url-pattern>/*</url-pattern>
    </filter-mapping>

    <!-- ═══════════ ⑥ Session 配置 ═══════════ -->
    <session-config>
        <session-timeout>30</session-timeout>               <!-- 分钟 -->
        <cookie-config>
            <http-only>true</http-only>                     <!-- ★ 防 XSS -->
            <secure>true</secure>                            <!-- ★ 只走 HTTPS -->
            <name>JSESSIONID</name>
        </cookie-config>
        <tracking-mode>COOKIE</tracking-mode>                <!-- ★ 禁用 URL 重写（防 SessionID 泄漏） -->
    </session-config>

    <!-- ═══════════ ⑦ 欢迎页与错误页 ═══════════ -->
    <welcome-file-list>
        <welcome-file>index.html</welcome-file>
        <welcome-file>index.jsp</welcome-file>
    </welcome-file-list>

    <error-page>
        <error-code>404</error-code>
        <location>/WEB-INF/views/error/404.jsp</location>
    </error-page>
    <error-page>
        <error-code>500</error-code>
        <location>/WEB-INF/views/error/500.jsp</location>
    </error-page>
    <error-page>
        <exception-type>java.lang.Throwable</exception-type>
        <location>/WEB-INF/views/error/error.jsp</location>
    </error-page>

    <!-- ═══════════ ⑧ Spring 的 Log4j/Web 监控等（可选）═══ -->
    <!-- Druid 监控 -->
    <servlet>
        <servlet-name>DruidStatView</servlet-name>
        <servlet-class>com.alibaba.druid.support.http.StatViewServlet</servlet-class>
        <init-param><param-name>loginUsername</param-name><param-value>admin</param-value></init-param>
        <init-param><param-name>loginPassword</param-name><param-value>admin123</param-value></init-param>
        <init-param><param-name>allow</param-name><param-value>127.0.0.1</param-value></init-param>
    </servlet>
    <servlet-mapping>
        <servlet-name>DruidStatView</servlet-name>
        <url-pattern>/druid/*</url-pattern>
    </servlet-mapping>
</web-app>
```

**web.xml 中各组件的加载顺序（★ 面试）：**

```
① <context-param>          读取全局参数（只是数据，不执行逻辑）
② <listener>                ★ ContextLoaderListener → 创建 Spring 根容器
③ <filter>                  初始化所有 Filter
④ <servlet>                 ★ DispatcherServlet → 创建 Spring MVC 子容器
                            （按 load-on-startup 的数字大小顺序初始化）
⑤ 应用就绪，开始接收请求

请求处理顺序：
  Filter 链（按 web.xml 中 filter-mapping 的声明顺序）
    → DispatcherServlet
      → Interceptor.preHandle
        → Controller
      → Interceptor.postHandle
      → 视图渲染
    → Interceptor.afterCompletion
  → Filter 链（逆序返回）
```

> 【Spring Boot 的对应关系】Spring Boot **没有 web.xml**，上述配置全部通过自动配置和 `application.yml` 完成：
> | web.xml 配置 | Spring Boot 对应 |
> | --- | --- |
> | `ContextLoaderListener` | `SpringApplication.run()` 自动创建容器 |
> | `DispatcherServlet` | `DispatcherServletAutoConfiguration` 自动注册 |
> | `CharacterEncodingFilter` | `HttpEncodingAutoConfiguration`（`server.servlet.encoding.*`） |
> | `HiddenHttpMethodFilter` | `WebMvcAutoConfiguration`（`spring.mvc.hiddenmethod.filter.enabled`） |
> | `&lt;session-config&gt;` | `server.servlet.session.*` |
> | `&lt;error-page&gt;` | `ErrorMvcAutoConfiguration` + `ErrorController` |
> | `&lt;multipart-config&gt;` | `MultipartAutoConfiguration`（`spring.servlet.multipart.*`） |
> | `&lt;load-on-startup&gt;` | `spring.mvc.servlet.load-on-startup` |

## 4. Spring 配置文件详解

### 4.1 applicationContext.xml（根容器）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xsi:schemaLocation="
           http://www.springframework.org/schema/beans
           https://www.springframework.org/schema/beans/spring-beans.xsd
           http://www.springframework.org/schema/context
           https://www.springframework.org/schema/context/spring-context.xsd
           http://www.springframework.org/schema/aop
           https://www.springframework.org/schema/aop/spring-aop.xsd">

    <!-- ═══ ① ★ 组件扫描（排除 Controller）═══ -->
    <context:component-scan base-package="com.example">
        <context:exclude-filter type="annotation"
            expression="org.springframework.stereotype.Controller"/>
        <context:exclude-filter type="annotation"
            expression="org.springframework.web.bind.annotation.RestController"/>
        <context:exclude-filter type="annotation"
            expression="org.springframework.web.bind.annotation.ControllerAdvice"/>
    </context:component-scan>

    <!-- ═══ ② ★ 加载属性文件 ═══ -->
    <context:property-placeholder
        location="classpath:jdbc.properties"
        ignore-unresolvable="true"
        file-encoding="UTF-8"/>

    <!-- ═══ ③ ★ 开启 AOP 注解支持 ═══ -->
    <aop:aspectj-autoproxy proxy-target-class="true"/>
    <!-- proxy-target-class=true → 强制 CGLIB（无接口的类也能代理） -->

    <!-- ═══ ④ 导入其他配置 ═══ -->
    <import resource="spring-dao.xml"/>
    <import resource="spring-tx.xml"/>

    <!-- ═══ ⑤ 国际化 ═══ -->
    <bean id="messageSource"
          class="org.springframework.context.support.ReloadableResourceBundleMessageSource">
        <property name="basenames">
            <list>
                <value>classpath:i18n/messages</value>
                <value>classpath:i18n/validation</value>      <!-- ★ 校验消息的国际化 -->
            </list>
        </property>
        <property name="defaultEncoding" value="UTF-8"/>
        <property name="cacheSeconds" value="60"/>             <!-- 60 秒后重新加载（开发方便） -->
        <property name="useCodeAsDefaultMessage" value="true"/>
    </bean>

    <!-- ═══ ⑥ 事件广播器（可选，自定义名称）═══ -->
    <bean id="applicationEventMulticaster"
          class="org.springframework.context.event.SimpleApplicationEventMulticaster">
        <property name="taskExecutor">                          <!-- ★ 让事件异步执行 -->
            <bean class="org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor">
                <property name="corePoolSize" value="5"/>
                <property name="maxPoolSize" value="20"/>
                <property name="queueCapacity" value="100"/>
                <property name="threadNamePrefix" value="event-"/>
            </bean>
        </property>
    </bean>
</beans>
```

### 4.2 spring-dao.xml（数据源 + MyBatis 整合）★★★★★

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
           https://www.springframework.org/schema/beans/spring-beans.xsd">

    <!-- ═══ ① ★ 数据源（Druid 连接池）═══ -->
    <bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource"
          init-method="init" destroy-method="close">
        <!-- 基本属性 -->
        <property name="driverClassName" value="${jdbc.driver}"/>
        <property name="url" value="${jdbc.url}"/>
        <property name="username" value="${jdbc.username}"/>
        <property name="password" value="${jdbc.password}"/>

        <!-- ★ 连接池配置 -->
        <property name="initialSize" value="5"/>            <!-- 初始化连接数 -->
        <property name="minIdle" value="10"/>                <!-- 最小空闲 -->
        <property name="maxActive" value="50"/>              <!-- ★ 最大连接数 -->
        <property name="maxWait" value="3000"/>              <!-- ★ 获取连接的最大等待时间（ms），防止无限等待 -->

        <!-- ★ 连接有效性检测 -->
        <property name="validationQuery" value="SELECT 1"/>
        <property name="testWhileIdle" value="true"/>        <!-- 空闲时检测（推荐） -->
        <property name="testOnBorrow" value="false"/>        <!-- 借出时检测（性能差，关闭） -->
        <property name="testOnReturn" value="false"/>
        <property name="timeBetweenEvictionRunsMillis" value="60000"/>   <!-- 检测间隔 -->
        <property name="minEvictableIdleTimeMillis" value="300000"/>      <!-- 空闲多久被回收 -->

        <!-- ★ 连接泄漏检测（开发环境开启）-->
        <property name="removeAbandoned" value="false"/>
        <property name="removeAbandonedTimeout" value="180"/>
        <property name="logAbandoned" value="true"/>

        <!-- PSCache（Oracle 建议开，MySQL 建议关） -->
        <property name="poolPreparedStatements" value="false"/>

        <!-- ★ Druid 监控（SQL 统计、防火墙） -->
        <property name="filters" value="stat,wall,slf4j"/>
        <property name="connectionProperties" value="druid.stat.mergeSql=true;druid.stat.slowSqlMillis=2000"/>

        <!-- 连接初始化 SQL -->
        <!-- <property name="connectionInitSqls"><list><value>SET NAMES utf8mb4</value></list></property> -->
    </bean>

    <!-- ═══ ② ★★ SqlSessionFactory（MyBatis 的核心）═══ -->
    <bean id="sqlSessionFactory" class="org.mybatis.spring.SqlSessionFactoryBean">
        <!-- 数据源 -->
        <property name="dataSource" ref="dataSource"/>
        <!-- ★ MyBatis 全局配置文件 -->
        <property name="configLocation" value="classpath:mybatis-config.xml"/>
        <!-- ★ Mapper XML 的位置（支持通配符） -->
        <property name="mapperLocations" value="classpath*:mapper/**/*.xml"/>
        <!-- ★ 实体类别名包（XML 中可直接写类名而非全限定名） -->
        <property name="typeAliasesPackage" value="com.example.entity"/>
        <!-- ★ 类型处理器包 -->
        <property name="typeHandlersPackage" value="com.example.mybatis.handler"/>
        <!-- 插件（分页等） -->
        <property name="plugins">
            <array>
                <bean class="com.github.pagehelper.PageInterceptor">
                    <property name="properties">
                        <value>
                            helperDialect=mysql
                            reasonable=true
                            supportMethodsArguments=true
                            params=count=countSql
                        </value>
                    </property>
                </bean>
            </array>
        </property>
        <!-- 也可以直接内联配置（不用 mybatis-config.xml） -->
        <!--
        <property name="configuration">
            <bean class="org.apache.ibatis.session.Configuration">
                <property name="mapUnderscoreToCamelCase" value="true"/>
                <property name="logImpl" value="org.apache.ibatis.logging.slf4j.Slf4jImpl"/>
            </bean>
        </property>
        -->
    </bean>

    <!-- ═══ ③ ★★ Mapper 接口扫描（把 Mapper 注册为 Spring Bean）═══ -->
    <bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
        <property name="basePackage" value="com.example.mapper"/>
        <property name="sqlSessionFactoryBeanName" value="sqlSessionFactory"/>
        <!-- ★ 用 BeanName 而非 ref（避免 SqlSessionFactory 提前初始化） -->
        <!-- 也可按注解/标记接口筛选 -->
        <!-- <property name="annotationClass" value="org.apache.ibatis.annotations.Mapper"/> -->
        <!-- <property name="markerInterface" value="com.example.mapper.BaseMapper"/> -->
    </bean>

    <!-- ═══ ④ JdbcTemplate（可选，简单 SQL 用它更方便）═══ -->
    <bean id="jdbcTemplate" class="org.springframework.jdbc.core.JdbcTemplate">
        <property name="dataSource" ref="dataSource"/>
        <property name="queryTimeout" value="10"/>
    </bean>

    <!-- ═══ ⑤ Redis（可选）═══ -->
    <bean id="jedisConnectionFactory"
          class="org.springframework.data.redis.connection.jedis.JedisConnectionFactory">
        <property name="hostName" value="${redis.host}"/>
        <property name="port" value="${redis.port}"/>
        <property name="password" value="${redis.password}"/>
        <property name="database" value="${redis.database}"/>
    </bean>
    <bean id="redisTemplate" class="org.springframework.data.redis.core.StringRedisTemplate">
        <property name="connectionFactory" ref="jedisConnectionFactory"/>
    </bean>
</beans>
```

```properties
# jdbc.properties
jdbc.driver=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://localhost:3306/mall?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true&rewriteBatchedStatements=true
jdbc.username=mall
jdbc.password=${DB_PASSWORD:mall123}

redis.host=127.0.0.1
redis.port=6379
redis.password=
redis.database=0
```

> 【坑】**`&` 在 XML 中是特殊字符**！JDBC URL 中的 `&` 必须写成 `&amp;`：
> ```xml
> <property name="url" value="jdbc:mysql://host/db?useUnicode=true&amp;characterEncoding=utf8"/>
> ```
> 在 `.properties` 文件中则不需要转义（上面用的是 properties，所以直接写 `&`）。

### 4.3 spring-tx.xml（事务配置）★★★★★

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:tx="http://www.springframework.org/schema/tx"
       xmlns:aop="http://www.springframework.org/schema/aop"
       xsi:schemaLocation="
           http://www.springframework.org/schema/beans
           https://www.springframework.org/schema/beans/spring-beans.xsd
           http://www.springframework.org/schema/tx
           https://www.springframework.org/schema/tx/spring-tx.xsd
           http://www.springframework.org/schema/aop
           https://www.springframework.org/schema/aop/spring-aop.xsd">

    <!-- ═══ ① ★ 事务管理器 ═══ -->
    <bean id="transactionManager"
          class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
        <property name="dataSource" ref="dataSource"/>
        <!-- 全局默认超时 -->
        <property name="defaultTimeout" value="30"/>
        <!-- 嵌套事务支持（savepoint） -->
        <property name="nestedTransactionAllowed" value="true"/>
        <!-- 回滚时验证连接 -->
        <property name="validateExistingTransaction" value="false"/>
    </bean>

    <!-- ═══ ② ★★ 开启注解事务（@Transactional 生效的前提）═══ -->
    <tx:annotation-driven transaction-manager="transactionManager"
                          proxy-target-class="true"
                          mode="proxy"
                          order="2147483647"/>
    <!-- proxy-target-class=true → CGLIB 代理 -->
    <!-- order → 事务切面的执行顺序（默认最低优先级，即最内层） -->

    <!-- ═══ ③ 声明式事务（XML 方式，不用注解的老项目）═══ -->
    <tx:advice id="txAdvice" transaction-manager="transactionManager">
        <tx:attributes>
            <!-- ★ 按方法名前缀配置事务规则 -->
            <tx:method name="save*"     propagation="REQUIRED" rollback-for="Exception"/>
            <tx:method name="insert*"   propagation="REQUIRED" rollback-for="Exception"/>
            <tx:method name="add*"      propagation="REQUIRED" rollback-for="Exception"/>
            <tx:method name="create*"   propagation="REQUIRED" rollback-for="Exception"/>
            <tx:method name="update*"   propagation="REQUIRED" rollback-for="Exception"/>
            <tx:method name="modify*"   propagation="REQUIRED" rollback-for="Exception"/>
            <tx:method name="delete*"   propagation="REQUIRED" rollback-for="Exception"/>
            <tx:method name="remove*"   propagation="REQUIRED" rollback-for="Exception"/>
            <tx:method name="batch*"    propagation="REQUIRED" rollback-for="Exception"/>
            <tx:method name="transfer*" propagation="REQUIRED" rollback-for="Exception" timeout="60"/>
            <!-- ★ 查询方法：只读，不加事务锁 -->
            <tx:method name="get*"      propagation="SUPPORTS" read-only="true"/>
            <tx:method name="query*"    propagation="SUPPORTS" read-only="true"/>
            <tx:method name="find*"     propagation="SUPPORTS" read-only="true"/>
            <tx:method name="select*"   propagation="SUPPORTS" read-only="true"/>
            <tx:method name="list*"     propagation="SUPPORTS" read-only="true"/>
            <tx:method name="count*"    propagation="SUPPORTS" read-only="true"/>
            <tx:method name="check*"    propagation="SUPPORTS" read-only="true"/>
            <!-- 独立事务 -->
            <tx:method name="log*"      propagation="REQUIRES_NEW"/>
            <tx:method name="audit*"    propagation="REQUIRES_NEW"/>
            <!-- 兜底 -->
            <tx:method name="*"         propagation="SUPPORTS" read-only="true"/>
        </tx:attributes>
    </tx:advice>

    <!-- ★ 用 AOP 把事务通知织入到 Service 层 -->
    <aop:config>
        <aop:pointcut id="servicePointcut"
                      expression="execution(* com.example.service..*.*(..))"/>
        <aop:advisor advice-ref="txAdvice" pointcut-ref="servicePointcut" order="100"/>
    </aop:config>

    <!-- ═══ ④ 编程式事务模板（需要精细控制时用）═══ -->
    <bean id="transactionTemplate"
          class="org.springframework.transaction.support.TransactionTemplate">
        <property name="transactionManager" ref="transactionManager"/>
        <property name="propagationBehaviorName" value="PROPAGATION_REQUIRED"/>
        <property name="isolationLevelName" value="ISOLATION_READ_COMMITTED"/>
        <property name="timeout" value="30"/>
    </bean>
</beans>
```

> 【注解 vs XML 事务】现代项目一律用 `@Transactional` 注解（精细、就近、可读）。XML 的 `<tx:advice>` 方式适合「大量遗留方法不想逐个加注解」的迁移期，或需要统一策略的场景。两者可以共存，但要注意**不要对同一方法重复配置**（会以注解为准，或产生两个事务切面）。

### 4.4 spring-mvc.xml（MVC 子容器）★★★★★

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:mvc="http://www.springframework.org/schema/mvc"
       xsi:schemaLocation="
           http://www.springframework.org/schema/beans
           https://www.springframework.org/schema/beans/spring-beans.xsd
           http://www.springframework.org/schema/context
           https://www.springframework.org/schema/context/spring-context.xsd
           http://www.springframework.org/schema/mvc
           https://www.springframework.org/schema/mvc/spring-mvc.xsd">

    <!-- ═══ ① ★ 只扫描 Controller ═══ -->
    <context:component-scan base-package="com.example" use-default-filters="false">
        <context:include-filter type="annotation"
            expression="org.springframework.stereotype.Controller"/>
        <context:include-filter type="annotation"
            expression="org.springframework.web.bind.annotation.RestController"/>
        <context:include-filter type="annotation"
            expression="org.springframework.web.bind.annotation.ControllerAdvice"/>
    </context:component-scan>

    <!-- ═══ ② ★★ 注解驱动（★ 最重要的一行）═══ -->
    <mvc:annotation-driven>
        <!-- 自定义消息转换器 -->
        <mvc:message-converters register-defaults="true">
            <!-- ★ 字符串转换器（防止中文乱码） -->
            <bean class="org.springframework.http.converter.StringHttpMessageConverter">
                <constructor-arg value="UTF-8"/>
                <property name="supportedMediaTypes">
                    <list>
                        <value>text/plain;charset=UTF-8</value>
                        <value>text/html;charset=UTF-8</value>
                    </list>
                </property>
                <property name="writeAcceptCharset" value="false"/>
            </bean>
            <!-- ★ Jackson（JSON） -->
            <bean class="org.springframework.http.converter.json.MappingJackson2HttpMessageConverter">
                <property name="objectMapper" ref="objectMapper"/>
                <property name="supportedMediaTypes">
                    <list>
                        <value>application/json;charset=UTF-8</value>
                    </list>
                </property>
            </bean>
        </mvc:message-converters>
        <!-- 参数校验器 -->
        <mvc:validator validator="validator"/>
        <!-- 格式化器 -->
        <mvc:argument-resolvers>
            <bean class="com.example.resolver.CurrentUserArgumentResolver"/>
        </mvc:argument-resolvers>
    </mvc:annotation-driven>
    <!-- ★ <mvc:annotation-driven> 做了什么：
         ① 注册 RequestMappingHandlerMapping（处理 @RequestMapping）
         ② 注册 RequestMappingHandlerAdapter（调用 Controller 方法）
         ③ 注册默认的 HttpMessageConverter（JSON、XML、String、字节流...）
         ④ 注册 @NumberFormat / @DateTimeFormat 的格式化支持
         ⑤ 注册 @Valid 的校验支持
         ⑥ 注册 ExceptionHandlerExceptionResolver（处理 @ExceptionHandler）
         没有这一行，@RequestMapping 和 @ResponseBody 全部失效！ -->

    <!-- ═══ ③ ObjectMapper 配置 ═══ -->
    <bean id="objectMapper"
          class="org.springframework.http.converter.json.Jackson2ObjectMapperFactoryBean">
        <property name="failOnUnknownProperties" value="false"/>       <!-- 未知字段不报错 -->
        <property name="serializationInclusions">
            <array><value>NON_NULL</value></array>                      <!-- 不输出 null -->
        </property>
        <property name="dateFormat">
            <bean class="java.text.SimpleDateFormat">
                <constructor-arg value="yyyy-MM-dd HH:mm:ss"/>
            </bean>
        </property>
        <property name="modules">
            <list>
                <!-- ★ JDK 8 日期时间支持 -->
                <bean class="com.fasterxml.jackson.datatype.jsr310.JavaTimeModule"/>
            </list>
        </property>
        <property name="featuresToDisable">
            <array>
                <value type="com.fasterxml.jackson.databind.SerializationFeature">
                    WRITE_DATES_AS_TIMESTAMPS
                </value>
                <value type="com.fasterxml.jackson.databind.DeserializationFeature">
                    FAIL_ON_UNKNOWN_PROPERTIES
                </value>
            </array>
        </property>
    </bean>

    <!-- ═══ ④ ★ 视图解析器（JSP）═══ -->
    <bean class="org.springframework.web.servlet.view.InternalResourceViewResolver">
        <property name="prefix" value="/WEB-INF/views/"/>      <!-- ★ WEB-INF 下，外部无法直接访问 -->
        <property name="suffix" value=".jsp"/>
        <property name="viewClass"
                  value="org.springframework.web.servlet.view.JstlView"/>   <!-- 支持 JSTL -->
        <property name="contentType" value="text/html;charset=UTF-8"/>
        <property name="order" value="1"/>
    </bean>

    <!-- 多视图解析器（按 order 依次尝试） -->
    <bean class="org.springframework.web.servlet.view.BeanNameViewResolver">
        <property name="order" value="0"/>                     <!-- ★ 优先按 Bean 名找视图 -->
    </bean>
    <!-- JSON 视图（返回 JSON 而不经过 @ResponseBody） -->
    <bean id="jsonView"
          class="org.springframework.web.servlet.view.json.MappingJackson2JsonView"/>

    <!-- ═══ ⑤ ★ 静态资源处理 ═══ -->
    <mvc:resources mapping="/static/**" location="/static/,classpath:/static/"/>
    <mvc:resources mapping="/upload/**" location="file:/data/uploads/"/>
    <mvc:resources mapping="/webjars/**" location="classpath:/META-INF/resources/webjars/"/>
    <mvc:resources mapping="/favicon.ico" location="/favicon.ico"/>
    <!-- ★ 关键：让容器的 DefaultServlet 处理静态资源（否则 DispatcherServlet 会拦截） -->
    <mvc:default-servlet-handler/>

    <!-- ═══ ⑥ ★ 拦截器 ═══ -->
    <mvc:interceptors>
        <!-- 全局拦截器 -->
        <bean class="com.example.interceptor.TraceInterceptor"/>
        <!-- 带路径的拦截器 -->
        <mvc:interceptor>
            <mvc:mapping path="/api/**"/>
            <mvc:exclude-mapping path="/api/auth/**"/>
            <mvc:exclude-mapping path="/api/public/**"/>
            <bean class="com.example.interceptor.AuthInterceptor"/>
        </mvc:interceptor>
        <mvc:interceptor>
            <mvc:mapping path="/**"/>
            <mvc:exclude-mapping path="/static/**"/>
            <bean class="com.example.interceptor.LogInterceptor"/>
        </mvc:interceptor>
    </mvc:interceptors>

    <!-- ═══ ⑦ ★ 文件上传解析器（Bean 名必须是 multipartResolver）═══ -->
    <bean id="multipartResolver"
          class="org.springframework.web.multipart.support.StandardServletMultipartResolver">
        <property name="resolveLazily" value="false"/>
    </bean>
    <!-- 老方式（commons-fileupload，Spring 5 仍支持但不推荐） -->
    <!--
    <bean id="multipartResolver" class="org.springframework.web.multipart.commons.CommonsMultipartResolver">
        <property name="defaultEncoding" value="UTF-8"/>
        <property name="maxUploadSize" value="104857600"/>
        <property name="maxInMemorySize" value="1048576"/>
    </bean>
    -->

    <!-- ═══ ⑧ ★ CORS 跨域 ═══ -->
    <mvc:cors>
        <mvc:mapping path="/api/**"
                     allowed-origin-patterns="https://*.example.com, http://localhost:*"
                     allowed-methods="GET,POST,PUT,DELETE,OPTIONS"
                     allowed-headers="*"
                     exposed-headers="Content-Disposition,X-Trace-Id"
                     allow-credentials="true"
                     max-age="3600"/>
    </mvc:cors>

    <!-- ═══ ⑨ 异常处理 ═══ -->
    <bean class="org.springframework.web.servlet.handler.SimpleMappingExceptionResolver">
        <property name="exceptionMappings">
            <props>
                <prop key="com.example.exception.BusinessException">error/business</prop>
                <prop key="org.springframework.dao.DuplicateKeyException">error/duplicate</prop>
                <prop key="java.lang.Exception">error/error</prop>
            </props>
        </property>
        <property name="defaultErrorView" value="error/error"/>
        <property name="exceptionAttribute" value="ex"/>       <!-- 异常放入 request 的属性名 -->
        <property name="defaultStatusCode" value="500"/>
    </bean>
    <!-- ★ 更现代的方式：用 @ControllerAdvice + @ExceptionHandler（见参数绑定与异常处理篇） -->

    <!-- ═══ ⑩ 异步支持 ═══ -->
    <mvc:annotation-driven>
        <mvc:async-support default-timeout="30000">
            <mvc:callable-interceptors>
                <bean class="com.example.interceptor.AsyncLogInterceptor"/>
            </mvc:callable-interceptors>
        </mvc:async-support>
    </mvc:annotation-driven>

    <!-- ═══ ⑪ 校验器 ═══ -->
    <bean id="validator"
          class="org.springframework.validation.beanvalidation.LocalValidatorFactoryBean">
        <property name="providerClass" value="org.hibernate.validator.HibernateValidator"/>
        <property name="validationMessageSource" ref="messageSource"/>   <!-- ★ 校验消息国际化 -->
    </bean>

    <!-- ═══ ⑫ 内容协商 ═══ -->
    <mvc:annotation-driven content-negotiation-manager="contentNegotiationManager"/>
    <bean id="contentNegotiationManager"
          class="org.springframework.web.accept.ContentNegotiationManagerFactoryBean">
        <property name="favorParameter" value="true"/>
        <property name="parameterName" value="format"/>
        <property name="defaultContentType" value="application/json"/>
        <property name="mediaTypes">
            <map>
                <entry key="json" value="application/json"/>
                <entry key="xml" value="application/xml"/>
                <entry key="html" value="text/html"/>
            </map>
        </property>
    </bean>

    <!-- ═══ ⑬ 简单页面的直接映射（不写 Controller）═══ -->
    <mvc:view-controller path="/login" view-name="login"/>
    <mvc:view-controller path="/404" view-name="error/404"/>
    <mvc:redirect-view-controller path="/" redirect-url="/index.html"/>
</beans>
```

### 4.5 mybatis-config.xml

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE configuration PUBLIC "-//mybatis.org//DTD Config 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-config.dtd">
<configuration>

    <!-- ① 引入属性文件（也可由 Spring 的 property-placeholder 统一管理） -->
    <!-- <properties resource="jdbc.properties"/> -->

    <!-- ② ★ 全局设置 -->
    <settings>
        <!-- ★★ 下划线转驼峰（user_name → userName）必开！ -->
        <setting name="mapUnderscoreToCamelCase" value="true"/>
        <!-- ★ 使用 SLF4J 输出 SQL 日志 -->
        <setting name="logImpl" value="SLF4J"/>
        <!-- 延迟加载 -->
        <setting name="lazyLoadingEnabled" value="false"/>
        <setting name="aggressiveLazyLoading" value="false"/>
        <!-- ★ 二级缓存（生产建议关闭，用 Redis 做缓存） -->
        <setting name="cacheEnabled" value="false"/>
        <!-- null 值也调用 setter（保证字段完整） -->
        <setting name="callSettersOnNulls" value="true"/>
        <!-- 查询超时 -->
        <setting name="defaultStatementTimeout" value="30"/>
        <!-- ★ 允许 JDBC 自动生成主键 -->
        <setting name="useGeneratedKeys" value="true"/>
        <!-- 多结果集支持 -->
        <setting name="multipleResultSetsEnabled" value="true"/>
        <!-- 返回 Map 时 null 值也保留 key -->
        <setting name="returnInstanceForEmptyRow" value="false"/>
        <!-- 本地缓存范围（STATEMENT 可避免脏读） -->
        <setting name="localCacheScope" value="SESSION"/>
    </settings>

    <!-- ③ 类型别名（也可由 Spring 的 typeAliasesPackage 配置） -->
    <typeAliases>
        <package name="com.example.entity"/>
        <!-- <typeAlias type="com.example.entity.User" alias="User"/> -->
    </typeAliases>

    <!-- ④ 类型处理器（Java 类型 ↔ JDBC 类型） -->
    <typeHandlers>
        <package name="com.example.mybatis.handler"/>
        <!-- <typeHandler handler="com.example.mybatis.handler.JsonTypeHandler"
                        javaType="com.example.entity.UserExt"/> -->
    </typeHandlers>

    <!-- ⑤ 插件（拦截器） -->
    <plugins>
        <!-- ★ PageHelper 分页（也可在 Spring 的 SqlSessionFactoryBean 中配置） -->
        <plugin interceptor="com.github.pagehelper.PageInterceptor">
            <property name="helperDialect" value="mysql"/>
            <property name="reasonable" value="true"/>
            <property name="supportMethodsArguments" value="true"/>
            <property name="params" value="count=countSql"/>
        </plugin>
        <!-- 自定义 SQL 性能监控插件 -->
        <plugin interceptor="com.example.mybatis.plugin.SqlCostInterceptor"/>
    </plugins>

    <!-- ⑥ ★ 环境配置（由 Spring 管理数据源时【不需要】这段！） -->
    <!--
    <environments default="development">
        <environment id="development">
            <transactionManager type="JDBC"/>
            <dataSource type="POOLED">
                <property name="driver" value="${jdbc.driver}"/>
                <property name="url" value="${jdbc.url}"/>
                <property name="username" value="${jdbc.username}"/>
                <property name="password" value="${jdbc.password}"/>
            </dataSource>
        </environment>
    </environments>
    <mappers>
        <mapper resource="mapper/UserMapper.xml"/>
    </mappers>
    -->
    <!-- ★ 整合 Spring 后，environments 和 mappers 都由 Spring 配置，这里必须注释掉！ -->
</configuration>
```

> 【坑】**整合 Spring 后，`mybatis-config.xml` 中的 `&lt;environments&gt;` 和 `&lt;mappers&gt;` 必须去掉或注释**：
> - 数据源由 Spring 的 `SqlSessionFactoryBean.dataSource` 提供
> - Mapper 由 `MapperScannerConfigurer` 扫描 + `mapperLocations` 指定
> - 如果同时配置，会冲突或导致 Spring 的事务管理失效（MyBatis 用了自己的连接）。

## 5. 完整代码示例（一条请求的全链路）

```java
// ═══════════ ① Entity（数据库实体）═══════════
package com.example.entity;

import lombok.Data;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public class User implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String username;
    private String password;              // ★ 不返回给前端（VO 中不含）
    private String nickname;
    private String phone;
    private String email;
    private Integer status;               // 0-禁用 1-启用
    private Long deptId;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private Integer version;               // 乐观锁
}

// ═══════════ ② DTO（请求参数）═══════════
package com.example.dto;

import lombok.Data;
import javax.validation.constraints.*;

@Data
public class UserCreateDTO {
    @NotBlank(message = "用户名不能为空")
    @Size(min = 2, max = 20, message = "用户名长度 2~20")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "用户名只能含字母数字下划线")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 32, message = "密码长度 8~32")
    private String password;

    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @Email(message = "邮箱格式不正确")
    private String email;

    private Long deptId;
}

@Data
public class UserQuery {
    private String keyword;
    private Integer status;
    private Long deptId;
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate createTimeStart;
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate createTimeEnd;
    private Integer pageNum = 1;
    private Integer pageSize = 20;
    private String orderBy = "create_time";
    private String orderDir = "DESC";
}

// ═══════════ ③ VO（响应对象，★ 不含敏感字段）═══════════
package com.example.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;

@Data
public class UserVO {
    @JsonSerialize(using = ToStringSerializer.class)     // ★ Long 转 String 防精度丢失
    private Long id;
    private String username;
    private String nickname;
    private String phone;
    private String email;
    private Integer status;
    private String statusDesc;                            // ★ 翻译后的描述
    private String deptName;                              // ★ 关联查询的部门名

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private LocalDateTime createTime;

    public static UserVO from(User user) {
        UserVO vo = new UserVO();
        BeanUtils.copyProperties(user, vo);
        vo.setStatusDesc(user.getStatus() != null && user.getStatus() == 1 ? "启用" : "禁用");
        return vo;
    }
}

// ═══════════ ④ Mapper 接口 ═══════════
package com.example.mapper;

import com.example.entity.User;
import com.example.dto.UserQuery;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper                                                  // ★ 标记为 Mapper（可选，有 MapperScannerConfigurer 时）
public interface UserMapper {

    /** 按 ID 查询（注解 SQL） */
    @Select("SELECT * FROM sys_user WHERE id = #{id}")
    User selectById(@Param("id") Long id);

    /** 条件查询（XML SQL） */
    List<User> selectByQuery(UserQuery query);

    /** 批量查询 */
    List<User> selectByIds(@Param("ids") List<Long> ids);

    /** 统计 */
    long countByQuery(UserQuery query);

    /** 插入（返回自增主键） */
    int insert(User user);

    /** 批量插入 */
    int batchInsert(@Param("list") List<User> users);

    /** 更新（乐观锁） */
    int updateById(User user);

    /** 删除（逻辑删除） */
    int logicDeleteById(@Param("id") Long id, @Param("operator") String operator);

    /** 检查用户名是否存在 */
    int existsByUsername(@Param("username") String username);
}

// ═══════════ ⑤ Mapper XML ═══════════
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.mapper.UserMapper">

    <!-- ★ 结果映射（下划线转驼峰已开启，简单字段可省略 resultMap） -->
    <resultMap id="BaseResultMap" type="com.example.entity.User">
        <id     column="id"          property="id"/>
        <result column="username"    property="username"/>
        <result column="password"    property="password"/>
        <result column="nick_name"   property="nickname"/>
        <result column="phone"       property="phone"/>
        <result column="email"       property="email"/>
        <result column="status"      property="status"/>
        <result column="dept_id"     property="deptId"/>
        <result column="create_time" property="createTime"/>
        <result column="update_time" property="updateTime"/>
        <result column="version"     property="version"/>
    </resultMap>

    <!-- ★ 公共字段（复用，避免 SELECT *） -->
    <sql id="Base_Column_List">
        id, username, password, nick_name, phone, email, status,
        dept_id, create_time, update_time, version
    </sql>

    <!-- ★ 动态查询条件（复用） -->
    <sql id="Query_Where">
        <where>
            deleted = 0
            <if test="keyword != null and keyword != ''">
                AND (username LIKE CONCAT('%', #{keyword}, '%')
                     OR nick_name LIKE CONCAT('%', #{keyword}, '%')
                     OR phone LIKE CONCAT('%', #{keyword}, '%'))
            </if>
            <if test="status != null">
                AND status = #{status}
            </if>
            <if test="deptId != null">
                AND dept_id = #{deptId}
            </if>
            <if test="createTimeStart != null">
                AND create_time &gt;= #{createTimeStart}
            </if>
            <if test="createTimeEnd != null">
                AND create_time &lt; DATE_ADD(#{createTimeEnd}, INTERVAL 1 DAY)
            </if>
        </where>
    </sql>

    <!-- 条件查询 -->
    <select id="selectByQuery" parameterType="com.example.dto.UserQuery" resultMap="BaseResultMap">
        SELECT <include refid="Base_Column_List"/>
        FROM sys_user
        <include refid="Query_Where"/>
        ORDER BY ${orderBy} ${orderDir}      <!-- ⚠️ ${} 用于排序字段，必须在 Service 层白名单校验！ -->
    </select>

    <!-- 批量查询 -->
    <select id="selectByIds" resultMap="BaseResultMap">
        SELECT <include refid="Base_Column_List"/>
        FROM sys_user
        WHERE deleted = 0 AND id IN
        <foreach collection="ids" item="id" open="(" separator="," close=")">
            #{id}
        </foreach>
    </select>

    <!-- 统计 -->
    <select id="countByQuery" parameterType="com.example.dto.UserQuery" resultType="long">
        SELECT COUNT(*) FROM sys_user
        <include refid="Query_Where"/>
    </select>

    <!-- ★ 插入（useGeneratedKeys 回填主键） -->
    <insert id="insert" parameterType="com.example.entity.User"
            useGeneratedKeys="true" keyProperty="id" keyColumn="id">
        INSERT INTO sys_user (username, password, nick_name, phone, email,
                              status, dept_id, create_time, update_time, version, deleted)
        VALUES (#{username}, #{password}, #{nickname}, #{phone}, #{email},
                #{status}, #{deptId}, NOW(), NOW(), 0, 0)
    </insert>

    <!-- ★ 批量插入（★ 一条 SQL 插入多行，性能比循环 insert 高 10 倍） -->
    <insert id="batchInsert" useGeneratedKeys="true" keyProperty="id">
        INSERT INTO sys_user (username, password, nick_name, phone, status, create_time, update_time, deleted)
        VALUES
        <foreach collection="list" item="item" separator=",">
            (#{item.username}, #{item.password}, #{item.nickname}, #{item.phone},
             #{item.status}, NOW(), NOW(), 0)
        </foreach>
    </insert>

    <!-- ★ 动态更新（只更新非 null 字段）+ 乐观锁 -->
    <update id="updateById" parameterType="com.example.entity.User">
        UPDATE sys_user
        <set>
            <if test="nickname != null">nick_name = #{nickname},</if>
            <if test="phone != null">phone = #{phone},</if>
            <if test="email != null">email = #{email},</if>
            <if test="status != null">status = #{status},</if>
            <if test="deptId != null">dept_id = #{deptId},</if>
            update_time = NOW(),
            version = version + 1                       <!-- ★ 乐观锁 -->
        </set>
        WHERE id = #{id}
          AND version = #{version}                       <!-- ★ 版本校验 -->
          AND deleted = 0
    </update>

    <!-- 逻辑删除 -->
    <update id="logicDeleteById">
        UPDATE sys_user
        SET deleted = 1, update_by = #{operator}, update_time = NOW()
        WHERE id = #{id} AND deleted = 0
    </update>

    <!-- 存在性检查 -->
    <select id="existsByUsername" resultType="int">
        SELECT COUNT(*) FROM sys_user WHERE username = #{username} AND deleted = 0
    </select>
</mapper>
```

```java
// ═══════════ ⑥ Service 接口与实现 ═══════════
package com.example.service;

public interface UserService {
    UserVO getById(Long id);
    PageResult<UserVO> page(UserQuery query);
    Long create(UserCreateDTO dto);
    void update(Long id, UserCreateDTO dto);
    void delete(Long id);
    void updateStatus(Long id, Integer status);
}

package com.example.service.impl;

import com.example.common.*;
import com.example.common.exception.BusinessException;
import com.example.dto.*;
import com.example.entity.User;
import com.example.mapper.UserMapper;
import com.example.service.UserService;
import com.example.util.PasswordUtils;
import com.example.vo.UserVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor                                  // ★ 构造器注入（Lombok）
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;                   // ★ MyBatis 代理对象（Spring 注入）
    private final DeptService deptService;
    private final CacheService cacheService;

    /** ★ 排序字段白名单（防 SQL 注入，因为 XML 中用了 ${}） */
    private static final Map<String, String> SORT_WHITELIST = Map.of(
            "id", "id", "createTime", "create_time", "username", "username",
            "status", "status", "updateTime", "update_time");
    private static final Set<String> SORT_DIRECTIONS = Set.of("ASC", "DESC");

    // ─── 查询（只读事务）───
    @Override
    @Transactional(readOnly = true)
    public UserVO getById(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND, "用户不存在: " + id);
        }
        return UserVO.from(user);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<UserVO> page(UserQuery query) {
        // ① ★ 排序字段白名单校验（防注入）
        String safeOrderBy = SORT_WHITELIST.getOrDefault(query.getOrderBy(), "create_time");
        String safeDir = SORT_DIRECTIONS.contains(
                Optional.ofNullable(query.getOrderDir()).orElse("DESC").toUpperCase())
                ? query.getOrderDir().toUpperCase() : "DESC";
        query.setOrderBy(safeOrderBy);
        query.setOrderDir(safeDir);

        // ② 分页参数校验
        query.setPageNum(Math.max(1, Optional.ofNullable(query.getPageNum()).orElse(1)));
        query.setPageSize(Math.min(100, Math.max(1, Optional.ofNullable(query.getPageSize()).orElse(20))));

        // ③ ★ PageHelper 分页（必须在查询前调用，只对紧随其后的第一个查询生效）
        PageHelper.startPage(query.getPageNum(), query.getPageSize());
        List<User> users = userMapper.selectByQuery(query);
        PageInfo<User> pageInfo = new PageInfo<>(users);

        // ④ ★ 批量查询关联数据（避免 N+1）
        Set<Long> deptIds = users.stream().map(User::getDeptId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> deptNames = deptService.getNamesByIds(deptIds);

        // ⑤ 转 VO
        List<UserVO> vos = users.stream().map(u -> {
            UserVO vo = UserVO.from(u);
            vo.setDeptName(deptNames.get(u.getDeptId()));
            return vo;
        }).collect(Collectors.toList());

        return PageResult.of(vos, pageInfo.getTotal(), query.getPageNum(), query.getPageSize());
    }

    // ─── 写操作（★ 必须指定 rollbackFor）───
    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long create(UserCreateDTO dto) {
        // ① 业务校验（唯一性）
        if (userMapper.existsByUsername(dto.getUsername()) > 0) {
            throw new BusinessException(ResultCode.USER_ALREADY_EXISTS,
                    "用户名已存在: " + dto.getUsername());
        }

        // ② 构建实体
        User user = new User();
        BeanUtils.copyProperties(dto, user);
        user.setPassword(PasswordUtils.encode(dto.getPassword()));     // ★ BCrypt 加密
        user.setNickname(dto.getUsername());
        user.setStatus(1);

        // ③ 插入（★ 主键回填到 user.id）
        userMapper.insert(user);
        log.info("创建用户成功: id={}, username={}", user.getId(), user.getUsername());

        // ④ ★ 事务提交后再做副作用（缓存、消息）
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                cacheService.evict("user:list");
                // eventPublisher.publishEvent(new UserCreatedEvent(user.getId()));
            }
        });

        return user.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void update(Long id, UserCreateDTO dto) {
        User existing = userMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        User user = new User();
        BeanUtils.copyProperties(dto, user);
        user.setId(id);
        user.setVersion(existing.getVersion());                 // ★ 乐观锁版本号
        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            user.setPassword(PasswordUtils.encode(dto.getPassword()));
        } else {
            user.setPassword(null);                              // 不改密码
        }

        int rows = userMapper.updateById(user);
        if (rows == 0) {                                         // ★ 乐观锁冲突
            throw new BusinessException(ResultCode.DATA_CONFLICT, "数据已被他人修改，请刷新后重试");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        int rows = userMapper.logicDeleteById(id, UserContext.requireUsername());
        if (rows == 0) throw new BusinessException(ResultCode.USER_NOT_FOUND);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateStatus(Long id, Integer status) {
        User user = new User();
        user.setId(id);
        user.setStatus(status);
        userMapper.updateById(user);
    }
}

// ═══════════ ⑦ Controller ═══════════
package com.example.controller;

import com.example.common.*;
import com.example.dto.*;
import com.example.service.UserService;
import com.example.vo.UserVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import javax.validation.Valid;
import javax.validation.constraints.Min;

@Slf4j
@Validated                                                  // ★ 支持单参数校验
@RestController                                             // = @Controller + @ResponseBody
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;                  // ★ 注入父容器的 Service

    /** 分页查询 */
    @GetMapping
    public Result<PageResult<UserVO>> page(UserQuery query) {
        return Result.success(userService.page(query));
    }

    /** 详情 */
    @GetMapping("/{id}")
    public Result<UserVO> get(@PathVariable @Min(value = 1, message = "ID必须大于0") Long id) {
        return Result.success(userService.getById(id));
    }

    /** 创建 */
    @PostMapping
    public Result<Long> create(@RequestBody @Valid UserCreateDTO dto) {
        return Result.success("创建成功", userService.create(dto));
    }

    /** 更新 */
    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody @Valid UserCreateDTO dto) {
        userService.update(id, dto);
        return Result.success();
    }

    /** 删除 */
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return Result.success();
    }

    /** 修改状态（非 CRUD 动作用 POST + 子路径） */
    @PatchMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id,
                                     @RequestParam @Min(0) @Max(1) Integer status) {
        userService.updateStatus(id, status);
        return Result.success();
    }
}

// ═══════════ ⑧ 单元测试（★ 验证整合是否成功）═══
package com.example;

import com.example.service.UserService;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.transaction.annotation.Transactional;

@RunWith(SpringJUnit4ClassRunner.class)                     // ★ Spring 的测试运行器
@ContextConfiguration(locations = {                          // ★ 加载 Spring 配置
        "classpath:spring/applicationContext.xml",
        "classpath:spring/spring-mvc.xml"
})
@WebAppConfiguration                                         // ★ Web 环境测试
@Transactional                                               // ★ 测试后自动回滚（不污染数据库）
public class UserServiceTest {

    @Autowired
    private UserService userService;

    @Test
    public void testCreate() {
        UserCreateDTO dto = new UserCreateDTO();
        dto.setUsername("test_" + System.currentTimeMillis());
        dto.setPassword("Test123456");
        dto.setPhone("13800138000");
        Long id = userService.create(dto);
        Assert.assertNotNull(id);
        System.out.println("创建的用户 ID: " + id);
    }

    @Test
    public void testPage() {
        UserQuery query = new UserQuery();
        query.setPageNum(1);
        query.setPageSize(10);
        PageResult<UserVO> page = userService.page(query);
        System.out.println("总数: " + page.getTotal());
    }
}
```

## 6. SSM 整合常见问题排查 ★★★★★

| # | 问题 | 现象 | 原因与解决 |
| --- | --- | --- | --- |
| 1 | ★ **Service 中 @Transactional 不生效** | 数据不回滚 | ① 父子容器重复扫描（Controller 注入了子容器的 Service）② 方法非 public ③ 异常被 catch ④ 受检异常未配 rollbackFor ⑤ 缺 `<tx:annotation-driven>` |
| 2 | ★ **Mapper 注入失败** | `NoSuchBeanDefinitionException` | ① 缺 `MapperScannerConfigurer` ② basePackage 路径错 ③ 缺 `mybatis-spring` 依赖 |
| 3 | ★ **@RequestMapping 无效（404）** | 所有请求 404 | 缺 `<mvc:annotation-driven>` |
| 4 | **@ResponseBody 返回乱码** | JSON 中文乱码 | `StringHttpMessageConverter` 默认 ISO-8859-1，需设为 UTF-8 |
| 5 | **静态资源 404** | js/css 加载失败 | DispatcherServlet 拦截了，需 `<mvc:resources>` + `<mvc:default-servlet-handler/>` |
| 6 | **JSP 报「找不到 JSTL」** | `Unable to find taglib` | 缺 jstl 依赖，或 jar 未打入 WEB-INF/lib |
| 7 | **中文参数乱码** | 表单提交乱码 | `CharacterEncodingFilter` 未配置或未放最前面 |
| 8 | **MyBatis XML 找不到** | `Invalid bound statement (not found)` | `mapperLocations` 路径错，或 XML 在 src/main/java 下未配 `&lt;resources&gt;` |
| 9 | **namespace 与方法名不匹配** | 同上 | XML 的 namespace 必须是 Mapper 接口全限定名，id 必须与方法名一致 |
| 10 | **下划线字段映射为 null** | `userName` 为 null | 未开启 `mapUnderscoreToCamelCase` |
| 11 | **事务管理器与数据源不匹配** | 事务无效 | `DataSourceTransactionManager` 的 dataSource 必须与 MyBatis 用的是**同一个** |
| 12 | **重复扫描导致 Bean 创建两次** | `@PostConstruct` 执行两次、切面执行两次 | 父子容器的 component-scan 要职责分离 |
| 13 | **servlet-api 打入 war** | `ClassCastException`、`LinkageError` | scope 必须 `provided` |
| 14 | **AOP 切面不生效** | 日志/权限切面无反应 | 缺 `<aop:aspectj-autoproxy>` 或缺 aspectjweaver 依赖 |
| 15 | **日期格式不对** | 返回时间戳或数组 | 缺 `jackson-datatype-jsr310`，或未注册 JavaTimeModule |
| 16 | **文件上传失败** | `MultipartException` | 缺 `multipartResolver` Bean（★ Bean 名必须是这个） |
| 17 | **404 未走全局异常处理** | 返回容器默认错误页 | `throwExceptionIfNoHandlerFound=true` + 关闭默认静态资源映射 |
| 18 | **Druid 监控页 404** | /druid 打不开 | StatViewServlet 未配置，或被 DispatcherServlet 拦截 |
| 19 | **日志不输出 SQL** | 看不到 SQL | ① `logImpl=SLF4J` ② logback 中 Mapper 包设为 DEBUG |
| 20 | **PageHelper 分页失效** | 返回全部数据 | `startPage` 后必须**紧跟**查询语句，中间不能有其他查询 |
| 21 | **单元测试注入失败** | NPE | 缺 `@RunWith(SpringJUnit4ClassRunner.class)` 或 `@ContextConfiguration` |
| 22 | **war 部署后 contextPath 不符预期** | URL 前缀错 | contextPath 由 war 文件名决定，部署为 `ROOT.war` 才是根路径 |
| 23 | **多个 contextConfigLocation 冲突** | Bean 重复或找不到 | 检查父子容器的配置文件划分 |
| 24 | **`&` 在 XML 中未转义** | XML 解析错误 | JDBC URL 中 `&` → `&amp;` |

```java
// ─── 问题 1 的完整排查流程（★ 最常见）───
// 步骤 1：确认 <tx:annotation-driven> 已配置
// 步骤 2：确认方法是 public
// 步骤 3：确认异常类型（受检异常需 rollbackFor = Exception.class）
// 步骤 4：确认异常没有被 catch 吞掉
// 步骤 5：确认不是自调用（this.method()）
// 步骤 6：★ 确认 Bean 是不是「父容器的那个」
@Component
public class TxDiagnostic implements ApplicationRunner {
    @Autowired private UserService userService;
    @Autowired private ApplicationContext ctx;

    @Override
    public void run(ApplicationArguments args) {
        // ★ 检查注入的 Service 是否是代理对象
        System.out.println("Service 类名: " + userService.getClass().getName());
        System.out.println("是否 AOP 代理: " + AopUtils.isAopProxy(userService));
        // 期望输出：com.example.service.impl.UserServiceImpl$$EnhancerBySpringCGLIB$$xxx
        //          是否 AOP 代理: true
        // 如果输出的是原始类名且 isAopProxy=false → 事务切面没织入！

        // ★ 检查有几个 UserService Bean（父子容器各一个 = 2 个）
        Map<String, UserService> beans = ctx.getBeansOfType(UserService.class);
        System.out.println("容器中的 UserService 数量: " + beans.size());
        beans.forEach((name, bean) ->
            System.out.println("  " + name + " → " + bean.getClass().getName()
                + " isProxy=" + AopUtils.isAopProxy(bean)));
    }
}
```

## 7. SSM → Spring Boot 的迁移对照 ★★★★★

| SSM（手动配置） | Spring Boot（自动配置） |
| --- | --- |
| `web.xml` | ❌ **完全不需要** |
| `ContextLoaderListener` | `SpringApplication.run()` |
| `DispatcherServlet` 注册 | `DispatcherServletAutoConfiguration` |
| `applicationContext.xml` | `@SpringBootApplication` + `@Configuration` |
| `spring-mvc.xml` | `WebMvcAutoConfiguration` |
| `spring-dao.xml`（DataSource） | `DataSourceAutoConfiguration` + `application.yml` |
| `SqlSessionFactoryBean` | `MybatisAutoConfiguration`（引入 `mybatis-spring-boot-starter`） |
| `MapperScannerConfigurer` | `@MapperScan` 或 `@Mapper` |
| `mybatis-config.xml` | `application.yml` 的 `mybatis.configuration.*` |
| `<tx:annotation-driven>` | `TransactionAutoConfiguration`（自动开启） |
| `DataSourceTransactionManager` | 自动配置 |
| `CharacterEncodingFilter` | `HttpEncodingAutoConfiguration` |
| `InternalResourceViewResolver` | `ThymeleafAutoConfiguration`（或用 Thymeleaf 替代 JSP） |
| `<mvc:annotation-driven>` | `WebMvcAutoConfiguration` |
| `<mvc:resources>` | `spring.web.resources.*` |
| `<mvc:interceptors>` | `WebMvcConfigurer.addInterceptors()` |
| `<mvc:cors>` | `WebMvcConfigurer.addCorsMappings()` |
| `MultipartResolver` | `MultipartAutoConfiguration` |
| `jdbc.properties` | `application.yml` + `@ConfigurationProperties` |
| `<context:component-scan>` | `@ComponentScan`（`@SpringBootApplication` 已含） |
| 父子容器 | ★ **单一容器**（无父子之分） |
| `war` 打包 + 外部 Tomcat | ★ **jar 打包 + 内嵌 Tomcat** |
| `logback.xml` | `logback-spring.xml`（支持 profile） |
| `mvn package` → 部署到 Tomcat | `java -jar app.jar` |

```xml
<!-- ★ Spring Boot 版本的依赖（对比 SSM 的 30+ 个依赖，只需 4 个 starter） -->
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
        <!-- 含：spring-webmvc、spring-context、Jackson、Tomcat、validation -->
    </dependency>
    <dependency>
        <groupId>org.mybatis.spring.boot</groupId>
        <artifactId>mybatis-spring-boot-starter</artifactId>
        <version>3.0.3</version>
        <!-- 含：mybatis、mybatis-spring、spring-boot-starter-jdbc（DataSource + 事务） -->
    </dependency>
    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

```yaml
# ★ Spring Boot 的 application.yml（替代 4 个 XML + 1 个 properties）
spring:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/mall?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
    username: mall
    password: ${DB_PASSWORD}
    hikari:                              # Boot 默认连接池是 HikariCP
      maximum-pool-size: 50
      minimum-idle: 10
      connection-timeout: 3000
  servlet:
    multipart:
      max-file-size: 50MB
      max-request-size: 100MB
  jackson:
    date-format: yyyy-MM-dd HH:mm:ss
    time-zone: GMT+8
    default-property-inclusion: non_null
  mvc:
    throw-exception-if-no-handler-found: true
  web:
    resources:
      add-mappings: false                # 配合上一行，让 404 走全局异常处理

mybatis:
  mapper-locations: classpath*:mapper/**/*.xml
  type-aliases-package: com.example.entity
  configuration:
    map-underscore-to-camel-case: true   # ★ 下划线转驼峰
    log-impl: org.apache.ibatis.logging.slf4j.Slf4jImpl
    call-setters-on-nulls: true
    default-statement-timeout: 30

server:
  port: 8080
  servlet:
    encoding:
      charset: UTF-8
      force: true
    session:
      timeout: 30m
      cookie:
        http-only: true
        secure: true
```

> 【结论】**Spring Boot 的价值就是把 SSM 的这 400+ 行 XML 配置变成了 40 行 YAML + 几个 starter 依赖**。理解了 SSM 的手动配置，才能明白 Boot 的自动配置到底做了什么、出问题时该去哪里查。详见 [[后端/SpringBoot/自动配置原理]]。

## 8. 关联笔记

- 上一篇：[[后端/Spring/SpringMVC参数绑定与异常处理]]
- 下一篇：[[后端/Spring/Spring注解大全与配置类]]
- 相关：[[后端/Spring/SpringMVC入门与执行流程]]、[[后端/Spring/事务管理与失效场景]]
- MyBatis：[[后端/MyBatis/MyBatis入门与核心配置]]、[[后端/MyBatis/动态SQL与结果映射]]
- 升级：[[后端/SpringBoot/SpringBoot入门与项目搭建]]、[[后端/SpringBoot/自动配置原理]]
- Servlet：[[后端/JavaWeb/Servlet核心与生命周期]]、[[后端/JavaWeb/Tomcat架构与部署]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
