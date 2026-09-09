---
title: "Maven依赖管理与多模块"
aliases:
  - "Maven"
  - "依赖冲突"
  - "POM"
tags:
  - "后端"
  - "java"
  - "工程化"
  - "面试"
category: "后端"
folder: "Java工程化与部署"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java工程化与部署/Gradle与构建工具对比]]"
  - "[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]"
  - "[[后端/Java基础/Java语言概述与开发环境]]"
  - "[[后端/JVM/类加载机制与字节码]]"
created: 2026-09-07
updated: 2026-09-07
---

# Maven 依赖管理与多模块

## 1. Maven 基础

### 1.1 Maven 是什么

**Maven 是 Apache 的「项目构建 + 依赖管理」工具**，核心价值：
1. **依赖管理**：声明坐标，自动下载 jar 及其**传递依赖**（不用手动拷 jar）。
2. **标准化项目结构**：约定优于配置（Convention over Configuration）。
3. **统一构建流程**：`clean` → `compile` → `test` → `package` → `install` → `deploy`。
4. **多模块管理**：父子模块继承、聚合。

| 对比 | Ant | **Maven** | Gradle |
| --- | --- | --- | --- |
| 定位 | 构建脚本 | 构建 + **依赖管理** | 构建 + 依赖管理 |
| 配置方式 | XML（命令式，写每一步） | **XML（声明式）** | Groovy/Kotlin DSL（代码） |
| 依赖管理 | ❌ 需配 Ivy | ✅ **内置** | ✅ 内置 |
| 约定 | 无 | ★ **强约定** | 有约定但可自由覆盖 |
| 学习曲线 | 低 | **低** | 中高 |
| 灵活性 | 高 | 中（插件扩展） | **极高** |
| 构建速度 | — | 中 | **快**（增量、缓存、守护进程） |
| 生态 | 少 | ★ **最广**（Java 事实标准） | 增长中（Android 首选） |
| 现状 | 淘汰 | ★ **主流** | Android 主流，部分大项目 |

### 1.2 标准目录结构（约定优于配置）

```
my-project/
├── pom.xml                                    # ★ 项目对象模型（唯一必须的配置文件）
├── src/
│   ├── main/                                  # 主代码
│   │   ├── java/                              # ★ Java 源码（包结构）
│   │   │   └── com/example/App.java
│   │   ├── resources/                         # ★ 资源文件（配置文件、mapper.xml）
│   │   │   ├── application.yml
│   │   │   ├── mapper/UserMapper.xml
│   │   │   └── logback-spring.xml
│   │   ├── webapp/                            # Web 资源（war 项目，含 WEB-INF/web.xml）
│   │   └── filtered/                          # 需要变量替换的资源（非标准，需配置）
│   └── test/                                  # 测试代码
│       ├── java/                              # 测试源码
│       └── resources/                         # 测试资源
├── target/                                    # ★ 构建输出（不提交 Git）
│   ├── classes/                               # 编译后的 class + 资源
│   ├── test-classes/
│   ├── generated-sources/                     # 注解处理器生成的代码（Lombok、MapStruct）
│   ├── maven-archiver/
│   ├── maven-status/
│   ├── my-project-1.0.0.jar                   # ★ 最终产物
│   ├── my-project-1.0.0.jar.original          # Spring Boot 重打包前的原始 jar
│   └── site/                                  # mvn site 生成的报告
└── .mvn/                                      # Maven Wrapper 配置
    └── wrapper/maven-wrapper.properties
```

> 【坑】**`src/main/resources` 下的 `.xml`/`.properties` 默认会被打包，但 `src/main/java` 下的 `.xml` 默认不会！** MyBatis 的 Mapper XML 如果放在 `src/main/java` 的包目录下，需要在 `pom.xml` 中额外配置：
> ```xml
> &lt;build&gt;
>   &lt;resources&gt;
>     &lt;resource&gt;
>       &lt;directory&gt;src/main/java</directory>
>       &lt;includes&gt;&lt;include&gt;**/*.xml</include></includes>
>     </resource>
>     &lt;resource&gt;
>       &lt;directory&gt;src/main/resources</directory>
>       &lt;filtering&gt;true</filtering>          <!-- ★ 开启变量替换 -->
>     </resource>
>   </resources>
> </build>
> ```

### 1.3 安装与配置

```bash
# 安装（macOS）
brew install maven
# 或手动下载解压
wget https://dlcdn.apache.org/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.tar.gz
tar -zxvf apache-maven-3.9.6-bin.tar.gz -C /usr/local/

# 环境变量
export MAVEN_HOME=/usr/local/apache-maven-3.9.6
export PATH=$MAVEN_HOME/bin:$PATH

# 验证
mvn -v
# Apache Maven 3.9.6
# Maven home: /usr/local/apache-maven-3.9.6
# Java version: 17.0.9, vendor: Eclipse Adoptium
# Default locale: zh_CN_#Hans, platform encoding: UTF-8
```

**settings.xml（全局配置，`~/.m2/settings.xml`）：**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">

  <!-- ★ 本地仓库位置（默认 ~/.m2/repository） -->
  <localRepository>/data/maven-repo</localRepository>

  <!-- ★★ 镜像（国内加速必配） -->
  <mirrors>
    <mirror>
      <id>aliyun</id>
      <name>Aliyun Maven Mirror</name>
      <url>https://maven.aliyun.com/repository/public</url>
      <mirrorOf>central</mirrorOf>       <!-- ★ 只镜像 central，不要写 * （会导致私服也被镜像） -->
    </mirror>
    <!-- 其他可选：
      https://repo.huaweicloud.com/repository/maven/
      https://mirrors.cloud.tencent.com/nexus/repository/maven-public/
    -->
  </mirrors>

  <!-- ★ 认证信息（私服账号密码，★ 不要提交到 Git！） -->
  <servers>
    <server>
      <id>my-nexus</id>                    <!-- ★ 必须与 pom 中 repository 的 id 一致 -->
      <username>deploy</username>
      <password>{加密后的密码}</password>       <!-- mvn -ep 生成加密密码 -->
    </server>
  </servers>

  <!-- ★ Profile（多环境配置） -->
  <profiles>
    <profile>
      <id>jdk17</id>
      <activation>
        <activeByDefault>true</activeByDefault>
        <jdk>17</jdk>                       <!-- ★ 按 JDK 版本自动激活 -->
      </activation>
      <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <maven.compiler.compilerVersion>17</maven.compiler.compilerVersion>
      </properties>
    </profile>
    <profile>
      <id>company-repo</id>
      <repositories>
        <repository>
          <id>my-nexus</id>
          <url>https://nexus.company.com/repository/maven-public/</url>
          <releases><enabled>true</enabled></releases>
          <snapshots><enabled>true</enabled><updatePolicy>always</updatePolicy></snapshots>
        </repository>
      </repositories>
      <pluginRepositories>
        <pluginRepository>
          <id>my-nexus</id>
          <url>https://nexus.company.com/repository/maven-public/</url>
        </pluginRepository>
      </pluginRepositories>
    </profile>
  </profiles>

  <activeProfiles>
    <activeProfile>company-repo</activeProfile>
  </activeProfiles>

  <!-- 代理（公司内网需要） -->
  <proxies>
    <proxy>
      <id>corp-proxy</id><active>true</active><protocol>http</protocol>
      <host>proxy.company.com</host><port>8080</port>
      <nonProxyHosts>*.company.com|localhost</nonProxyHosts>
    </proxy>
  </proxies>
</settings>
```

> 【坑】**`mirrorOf` 不要写 `*`**：`*` 会镜像**所有**仓库，包括公司私服和 Spring 里程碑仓库，导致内部依赖下载不到。正确写法：
> - `central` → 只镜像中央仓库（★ 推荐）
> - `*,!my-nexus,!spring-milestones` → 镜像除指定 id 外的所有仓库

**Maven Wrapper（★ 团队协作必配，保证 Maven 版本一致）：**

```bash
mvn wrapper:wrapper -Dmaven=3.9.6          # 生成 .mvn/ 和 mvnw / mvnw.cmd
# 之后团队成员用 ./mvnw 而非 mvn（自动下载指定版本的 Maven）
./mvnw clean package
```

## 2. POM 坐标与依赖 ★★★★★

### 2.1 GAV 坐标

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>           <!-- ★ 组织/公司（反写域名） -->
    <artifactId>spring-boot-starter-web</artifactId>       <!-- ★ 项目/模块名 -->
    <version>3.2.0</version>                                <!-- ★ 版本 -->
    <classifier>sources</classifier>                        <!-- 分类器（sources/javadoc/jdk15） -->
    <type>jar</type>                                        <!-- 打包类型（默认 jar） -->
    <scope>compile</scope>                                  <!-- ★ 作用域 -->
    <optional>true</optional>                               <!-- ★ 可选依赖（不传递） -->
    <exclusions>                                             <!-- ★ 排除传递依赖 -->
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>

<!-- GAV + classifier 唯一确定一个构件（artifact） -->
<!-- 仓库路径规则：groupId 的点转斜杠 / artifactId / version / artifactId-version[-classifier].type -->
<!-- org/springframework/boot/spring-boot-starter-web/3.2.0/spring-boot-starter-web-3.2.0.jar -->
```

### 2.2 依赖范围（scope）★★★★★

| scope | 编译期 | 测试期 | 运行期 | **打包进 jar/war** | **传递性** | 典型用途 |
| --- | --- | --- | --- | --- | --- | --- |
| **`compile`**（默认） | ✅ | ✅ | ✅ | ✅ | ✅ | 业务依赖（Spring、MyBatis） |
| **`provided`** | ✅ | ✅ | ❌ | **❌** | ❌ 不传递 | ★ **Servlet API、Lombok**（运行时容器提供） |
| **`runtime`** | ❌ | ✅ | ✅ | ✅ | ✅ | ★ **JDBC 驱动**（编译只需接口） |
| **`test`** | ❌ | ✅ | ❌ | ❌ | ❌ | JUnit、Mockito |
| **`system`** | ✅ | ✅ | ❌ | ❌（需额外配置） | ❌ | ❌ **禁用**（本地路径，不可移植） |
| **`import`** | — | — | — | — | — | ★ **只在 `<dependencyManagement>` 中用**，导入 BOM |

```xml
<!-- ★ provided 的典型应用 -->
<dependency>
    <groupId>jakarta.servlet</groupId>
    <artifactId>jakarta.servlet-api</artifactId>
    <scope>provided</scope>       <!-- war 部署到 Tomcat 时，Tomcat 的 lib 已有，不能重复打包 -->
</dependency>
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <scope>provided</scope>       <!-- ★ 只在编译期生成代码，运行时不需要 Lombok 本身 -->
    <optional>true</optional>
</dependency>

<!-- ★ runtime 的典型应用 -->
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>        <!-- 编译期只用 java.sql 接口，不需要驱动类 -->
</dependency>
<!-- ⚠️ 但如果代码中有 Class.forName("com.mysql.cj.jdbc.Driver") 或直接引用驱动类，就要用 compile -->

<!-- ★ import 的典型应用（导入 BOM 统一管理版本） -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>3.2.0</version>
            <type>pom</type>
            <scope>import</scope>     <!-- ★ 导入该 BOM 中所有的 dependencyManagement -->
        </dependency>
    </dependencies>
</dependencyManagement>
<!-- 之后声明依赖就不用写 version（由 BOM 决定） -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>   <!-- 版本由 BOM 管理 -->
</dependency>
```

### 2.3 传递依赖与冲突调解 ★★★★★

```
项目 A 依赖 B，B 依赖 C，则 A 自动获得 C（传递依赖 transitive dependency）

A → B(1.0) → C(1.0)
A → D(2.0) → C(2.0)
      ↓
A 最终用哪个版本的 C？→ ★ 依赖调解（Dependency Mediation）
```

**Maven 的两条调解规则（★ 必背，按优先级）：**

| 优先级 | 规则 | 说明 |
| --- | --- | --- |
| **① 最短路径优先** | 依赖树中**路径最短**的版本胜出 | `A→B→C(1.0)` 路径长度 2；`A→D→E→C(2.0)` 路径长度 3 → **选 C(1.0)** |
| **② 声明顺序优先** | 路径长度相同时，**pom 中先声明**的胜出 | `A→B→C(1.0)` 和 `A→D→C(2.0)` 都是长度 2；B 先声明 → **选 C(1.0)** |

```xml
<!-- ★ 打破调解规则的方法（按推荐度排序） -->

<!-- 方案 1：在 dependencyManagement 中显式锁定版本（★★★ 最佳实践） -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.16.0</version>          <!-- ★ 强制所有传递依赖用这个版本 -->
        </dependency>
    </dependencies>
</dependencyManagement>
<!-- dependencyManagement 的优先级高于依赖调解，是「版本仲裁」的标准手段 -->
<!-- 它只「管理」版本，不「引入」依赖（子模块声明时才生效） -->

<!-- 方案 2：直接声明依赖（第一层依赖，路径最短 → 必然胜出） -->
<dependencies>
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
        <version>2.16.0</version>
    </dependency>
</dependencies>

<!-- 方案 3：exclusions 排除不想要的传递依赖 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-logging</artifactId>   <!-- 排除 logback，改用 log4j2 -->
        </exclusion>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>     <!-- 排除 tomcat，改用 undertow -->
        </exclusion>
    </exclusions>
</dependency>
<!-- ★ exclusions 只需 groupId + artifactId，不需要 version（排除所有版本） -->

<!-- 方案 4：optional 阻止传递（库作者用） -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>          <!-- ★ 依赖我的项目不会自动获得 lombok -->
</dependency>
```

**依赖冲突的排查：**

```bash
# ─── 命令行 ───
mvn dependency:tree                              # ★ 打印依赖树
mvn dependency:tree -Dverbose                     # ★★ 显示被忽略/冲突的依赖（详细信息）
mvn dependency:tree -Dincludes=com.fasterxml.jackson.core:jackson-databind   # ★ 定位特定依赖
mvn dependency:tree -Dverbose -Dincludes=org.slf4j
mvn dependency:list                               # 列出最终解析的所有依赖
mvn dependency:analyze                            # ★ 分析「用了但未声明」和「声明了但未用」的依赖
mvn dependency:analyze-duplicate                  # 重复声明检查
mvn dependency:resolve                            # 解析并下载所有依赖
mvn dependency:go-offline                         # 预先下载所有依赖（CI 缓存用）
mvn dependency:copy-dependencies -DoutputDirectory=target/libs    # 把所有依赖拷到目录
mvn dependency:build-classpath                    # 输出 classpath

# ─── 输出解读 ───
mvn dependency:tree -Dverbose -Dincludes=org.slf4j:slf4j-api
# [INFO] +- org.springframework.boot:spring-boot-starter-web:jar:3.2.0:compile
# [INFO] |  \- org.springframework.boot:spring-boot-starter-logging:jar:3.2.0:compile
# [INFO] |     \- ch.qos.logback:logback-classic:jar:1.4.14:compile
# [INFO] |        \- org.slf4j:slf4j-api:jar:2.0.9:compile          ← ★ 最终选中
# [INFO] +- org.apache.kafka:kafka-clients:jar:3.6.0:compile
# [INFO] |  \- (org.slf4j:slf4j-api:jar:2.0.7:compile - omitted for conflict with 2.0.9)   ← ★ 被忽略
# [INFO] \- com.example:legacy-lib:jar:1.0:compile
# [INFO]    \- (org.slf4j:slf4j-api:jar:1.7.36:compile - omitted for duplicate)

# 关键标记：
#   omitted for conflict with X.Y.Z   → ★ 版本冲突，被 X.Y.Z 取代
#   omitted for duplicate              → 重复依赖（相同 GAV）
#   (xxx - scope managed from yyy)     → scope 被 dependencyManagement 修改
#   (xxx - version managed from yyy)   → ★ 版本被 dependencyManagement 强制修改

# ─── IDEA 的 Maven Helper 插件（★ 最直观）───
# 打开 pom.xml → 底部的 "Dependency Analyzer" 标签
# → 选 "Conflicts" → 直接看到所有冲突，右键 "Exclude" 一键排除
```

**冲突导致的典型运行时错误：**

| 错误 | 原因 | 解决 |
| --- | --- | --- |
| `NoSuchMethodError` | ★ 编译时用的是新版本（有该方法），运行时加载了旧版本 | `dependency:tree` 定位，锁定新版本 |
| `NoClassDefFoundError` | 依赖被排除或 scope 错误（provided/runtime） | 检查 scope 和 exclusions |
| `ClassNotFoundException` | 依赖未引入或 jar 未打进包 | 检查依赖和打包配置 |
| `AbstractMethodError` | 接口和实现类版本不匹配 | 统一版本（用 BOM） |
| `LinkageError` / `ClassCastException: A cannot be cast to A` | 同名类被不同 ClassLoader 加载（jar 重复） | 只在一处提供该 jar |
| `IncompatibleClassChangeError` | 类的类型变了（class → interface） | 统一版本 |
| `NoSuchMethodError: javax.servlet...` | javax/jakarta 混用 | 统一 Servlet 版本（Boot 2 vs 3） |

```java
// ★ NoSuchMethodError 的经典案例
// 项目依赖 A，A 传递依赖 guava:20.0
// 项目又直接依赖 guava:31.0
// 编译期用 31.0（有 ImmutableMap.toImmutableMap()），
// 但如果依赖调解选了 20.0（比如路径更短），运行时就会：
// java.lang.NoSuchMethodError: com.google.common.collect.ImmutableMap.toImmutableMap()
// 解决：在 dependencyManagement 中锁定 guava 版本为 31.0
```

### 2.4 BOM（Bill of Materials）★★★★★

**BOM 是一个「只有 `<dependencyManagement>` 的 pom」，用于统一管理一组依赖的版本，避免版本冲突。**

```xml
<!-- ★ Spring Boot 项目继承 spring-boot-starter-parent（本质是继承 BOM） -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
    <relativePath/>                       <!-- ★ 从仓库查找父 POM，而非本地目录 -->
</parent>

<!-- 之后所有依赖都不用写 version（由 parent 的 dependencyManagement 决定） -->
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
        <!-- ★ 无需 version -->
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
        <!-- ★ 版本由 spring-boot-dependencies 管理 -->
    </dependency>
</dependencies>

<!-- 覆盖 BOM 中的版本（★ 通过 properties，Spring Boot 特有的机制） -->
<properties>
    <mysql.version>8.2.0</mysql.version>              <!-- 覆盖 spring-boot-dependencies 中的 mysql 版本 -->
    <jackson-bom.version>2.16.1</jackson-bom.version>
    <lombok.version>1.18.30</lombok.version>
</properties>

<!-- ─── 不用 parent 继承时，用 import 导入 BOM（★ 多 BOM 共存的场景）─── -->
<dependencyManagement>
    <dependencies>
        <!-- 导入多个 BOM（★ 先导入的优先！） -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>3.2.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-alibaba-dependencies</artifactId>
            <version>2022.0.0.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2023.0.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <!-- 自己定义的版本（★ 优先级高于导入的 BOM，因为在本 pom 中显式声明） -->
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-boot-starter</artifactId>
            <version>3.5.5</version>
        </dependency>
    </dependencies>
</dependencyManagement>
```

**版本仲裁的优先级（从高到低）：**

```
① 当前 pom 的 <dependencies> 中显式声明的 version     ← 最高（直接依赖）
② 当前 pom 的 <dependencyManagement> 中声明的 version
③ 父 pom 的 <dependencyManagement>
④ import 的 BOM（★ 按声明顺序，先导入的优先）
⑤ 依赖调解（最短路径 → 声明顺序）                       ← 最低
```

### 2.5 常用 BOM 清单

| BOM | 用途 |
| --- | --- |
| `spring-boot-dependencies` | Spring Boot 全家桶版本管理 |
| `spring-cloud-dependencies` | Spring Cloud 组件 |
| `spring-cloud-alibaba-dependencies` | Nacos/Sentinel/Seata/RocketMQ |
| `jackson-bom` | Jackson 全系列 |
| `junit-bom` | JUnit 5 |
| `netty-bom` | Netty 全系列 |
| `google-cloud-bom` / `libraries-bom` | Google 云 / Guava 等 |
| `aws-sdk-bom` | AWS SDK v2 |
| `azure-sdk-bom` | Azure SDK |
| `micrometer-bom` | 监控指标 |
| `testcontainers-bom` | Testcontainers |
| `dubbo-bom` | Dubbo |
| `kotlin-bom` | Kotlin |

## 3. Maven 生命周期与插件 ★★★★★

### 3.1 三套独立的生命周期

```
① clean 生命周期（清理）
   pre-clean → clean → post-clean

② default 生命周期（★ 构建，核心，23 个阶段）
   validate          校验项目和配置是否正确
   initialize        初始化构建状态（如设置属性）
   generate-sources  生成源代码（如 protobuf 生成 Java 类）
   process-sources   处理源代码（如过滤变量）
   generate-resources 生成资源文件
   process-resources ★ 复制 src/main/resources 到 target/classes（并做变量替换）
   compile           ★★ 编译主代码到 target/classes
   process-classes   字节码后处理（如 AOP 织入）
   generate-test-sources
   process-test-sources
   generate-test-resources
   process-test-resources  复制测试资源
   test-compile      ★ 编译测试代码
   process-test-classes
   test              ★★ 运行单元测试（surefire 插件）
   prepare-package
   package           ★★ 打包（jar/war）
   pre-integration-test
   integration-test  ★ 运行集成测试（failsafe 插件）
   post-integration-test
   verify            校验包是否合法（如检查质量规则）
   install           ★★ 安装到【本地仓库】(~/.m2/repository)
   deploy            ★★ 部署到【远程仓库】（私服/Nexus）

③ site 生命周期（生成站点报告）
   pre-site → site → post-site → site-deploy
```

**★ 关键规则：执行某个阶段，会自动执行它之前的所有阶段。**

```bash
mvn compile      # 执行 validate → initialize → ... → compile
mvn test         # 执行 ... → compile → test-compile → test
mvn package      # 执行 ... → test → package
mvn install      # 执行 ... → package → install
mvn deploy       # 执行 ... → install → deploy
mvn clean package    # ★ 两个生命周期：先 clean，再 package（最常用的组合）
mvn clean install -DskipTests     # ★ 跳过测试的安装（日常开发）
mvn clean deploy -P release        # 发布到私服
```

### 3.2 插件与生命周期的绑定

**Maven 本身只是「生命周期调度器」，实际工作全部由「插件（Plugin）」完成。**

| 生命周期阶段 | 绑定的插件:目标 | 作用 |
| --- | --- | --- |
| `process-resources` | `maven-resources-plugin:resources` | 复制资源 |
| `compile` | **`maven-compiler-plugin:compile`** | 编译主代码 |
| `process-test-resources` | `maven-resources-plugin:testResources` | 复制测试资源 |
| `test-compile` | `maven-compiler-plugin:testCompile` | 编译测试代码 |
| `test` | **`maven-surefire-plugin:test`** | 运行单元测试 |
| `package` | **`maven-jar-plugin:jar`** / `maven-war-plugin:war` | 打包 |
| `verify` | `maven-failsafe-plugin:verify` | 集成测试验证 |
| `install` | **`maven-install-plugin:install`** | 安装到本地仓库 |
| `deploy` | **`maven-deploy-plugin:deploy`** | 部署到远程仓库 |
| （独立） | `maven-clean-plugin:clean` | 清理 target |
| （独立） | **`spring-boot-maven-plugin:repackage`** | ★ 打可执行 jar |

```xml
<build>
    <plugins>
        <!-- ─── 编译插件（★ 最常用）─── -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <version>3.11.0</version>
            <configuration>
                <source>17</source>                          <!-- 源码级别 -->
                <target>17</target>                          <!-- 字节码版本 -->
                <release>17</release>                         <!-- ★ JDK 9+ 推荐（同时限制 API） -->
                <encoding>UTF-8</encoding>                    <!-- ★ 源码编码（防中文乱码） -->
                <compilerArgs>
                    <arg>-parameters</arg>                     <!-- ★ 保留方法参数名（Spring MVC/MyBatis 需要） -->
                    <arg>-Xlint:all</arg>                      <!-- 开启所有警告 -->
                    <arg>--enable-preview</arg>                <!-- 预览特性 -->
                </compilerArgs>
                <annotationProcessorPaths>                     <!-- ★ 注解处理器（Lombok + MapStruct） -->
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                        <version>${lombok.version}</version>
                    </path>
                    <path>
                        <groupId>org.mapstruct</groupId>
                        <artifactId>mapstruct-processor</artifactId>
                        <version>${mapstruct.version}</version>
                    </path>
                    <path>                                      <!-- ★ Lombok + MapStruct 协同 -->
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok-mapstruct-binding</artifactId>
                        <version>0.2.0</version>
                    </path>
                </annotationProcessorPaths>
                <showWarnings>true</showWarnings>
                <showDeprecation>true</showDeprecation>
            </configuration>
        </plugin>

        <!-- ─── 测试插件 ─── -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-surefire-plugin</artifactId>
            <version>3.2.2</version>
            <configuration>
                <skipTests>${skipTests}</skipTests>             <!-- 跳过测试执行（仍编译） -->
                <includes>
                    <include>**/*Test.java</include>
                    <include>**/*Tests.java</include>
                </includes>
                <excludes>
                    <exclude>**/*IntegrationTest.java</exclude>
                </excludes>
                <argLine>@{argLine} -Xmx1024m -Dfile.encoding=UTF-8</argLine>   <!-- ★ @{argLine} 兼容 JaCoCo -->
                <parallel>classes</parallel>                     <!-- 并行测试 -->
                <threadCount>4</threadCount>
            </configuration>
        </plugin>

        <!-- ─── 集成测试插件（*IT.java，绑定 integration-test 阶段）─── -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-failsafe-plugin</artifactId>
            <version>3.2.2</version>
            <executions>
                <execution>
                    <goals><goal>integration-test</goal><goal>verify</goal></goals>
                </execution>
            </executions>
        </plugin>

        <!-- ─── ★ Spring Boot 打包插件 ─── -->
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <mainClass>com.example.MyApplication</mainClass>   <!-- 主类（通常自动检测） -->
                <executable>true</executable>                        <!-- 生成可直接 ./app.jar 执行的脚本 -->
                <layout>JAR</layout>                                 <!-- JAR / WAR / ZIP / NONE -->
                <excludes>
                    <exclude>                                        <!-- ★ 排除 Lombok（运行时不需要） -->
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                    </exclude>
                </excludes>
                <classifier>exec</classifier>                        <!-- 生成 xxx-exec.jar（原 jar 保留） -->
                <jvmArguments>-Xmx512m</jvmArguments>                 <!-- mvn spring-boot:run 的 JVM 参数 -->
                <profiles>
                    <profile>dev</profile>                            <!-- spring-boot:run 激活的 profile -->
                </profiles>
                <image>                                               <!-- ★ Buildpacks 构建镜像 -->
                    <name>registry.example.com/myapp:${project.version}</name>
                </image>
                <layers><enabled>true</enabled></layers>               <!-- ★ 分层 jar（Docker 缓存优化） -->
            </configuration>
            <executions>
                <execution>
                    <goals><goal>repackage</goal></goals>              <!-- ★ 绑定到 package 阶段 -->
                </execution>
            </executions>
        </plugin>

        <!-- ─── 源码/文档 jar ─── -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-source-plugin</artifactId>
            <executions>
                <execution><id>attach-sources</id><goals><goal>jar-no-fork</goal></goals></execution>
            </executions>
        </plugin>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-javadoc-plugin</artifactId>
            <configuration><doclint>none</doclint></configuration>     <!-- 关闭严格的 javadoc 检查 -->
            <executions>
                <execution><id>attach-javadocs</id><goals><goal>jar</goal></goals></execution>
            </executions>
        </plugin>

        <!-- ─── 打 fat jar（非 Spring Boot 项目的可执行 jar）─── -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-shade-plugin</artifactId>
            <version>3.5.1</version>
            <executions>
                <execution>
                    <phase>package</phase>
                    <goals><goal>shade</goal></goals>
                    <configuration>
                        <transformers>
                            <!-- ★ 合并 SPI 配置文件（否则多个 jar 的 META-INF/services 会互相覆盖） -->
                            <transformer implementation="org.apache.maven.plugins.shade.resource.ServicesResourceTransformer"/>
                            <transformer implementation="org.apache.maven.plugins.shade.resource.ManifestResourceTransformer">
                                <mainClass>com.example.Main</mainClass>
                            </transformer>
                            <!-- ★ 合并 spring.handlers/spring.schemas（Spring 项目必需） -->
                            <transformer implementation="org.apache.maven.plugins.shade.resource.AppendingTransformer">
                                <resource>META-INF/spring.handlers</resource>
                            </transformer>
                        </transformers>
                        <filters>
                            <filter>
                                <artifact>*:*</artifact>
                                <excludes>
                                    <exclude>META-INF/*.SF</exclude>       <!-- ★ 去掉签名文件（否则报 SecurityException） -->
                                    <exclude>META-INF/*.DSA</exclude>
                                    <exclude>META-INF/*.RSA</exclude>
                                </excludes>
                            </filter>
                        </filters>
                    </configuration>
                </execution>
            </executions>
        </plugin>

        <!-- ─── 其他常用插件 ─── -->
        <!-- maven-assembly-plugin：更灵活的打包（tar.gz + 启动脚本 + 配置） -->
        <!-- maven-dependency-plugin：依赖分析/拷贝 -->
        <!-- maven-enforcer-plugin：★ 强制规范（依赖收敛、禁止 SNAPSHOT、JDK 版本） -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-enforcer-plugin</artifactId>
            <version>3.4.1</version>
            <executions>
                <execution>
                    <id>enforce-rules</id>
                    <goals><goal>enforce</goal></goals>
                    <configuration>
                        <rules>
                            <requireJavaVersion><version>[17,)</version></requireJavaVersion>
                            <requireMavenVersion><version>[3.8,)</version></requireMavenVersion>
                            <dependencyConvergence/>                     <!-- ★ 强制依赖版本收敛（无冲突） -->
                            <banDuplicatePomDependencyVersions/>          <!-- 禁止重复声明 -->
                            <requireUpperBoundDeps/>                      <!-- 依赖版本不能低于传递依赖要求的版本 -->
                            <requireReleaseDeps>                          <!-- 发布时禁止 SNAPSHOT 依赖 -->
                                <onlyWhenRelease>true</onlyWhenRelease>
                            </requireReleaseDeps>
                            <bannedDependencies>                          <!-- 禁用特定依赖 -->
                                <excludes>
                                    <exclude>log4j:log4j</exclude>          <!-- 有漏洞的 log4j 1.x -->
                                    <exclude>commons-logging:commons-logging</exclude>
                                </excludes>
                            </bannedDependencies>
                        </rules>
                    </configuration>
                </execution>
            </executions>
        </plugin>

        <!-- jacoco-maven-plugin：代码覆盖率 -->
        <plugin>
            <groupId>org.jacoco</groupId>
            <artifactId>jacoco-maven-plugin</artifactId>
            <version>0.8.11</version>
            <executions>
                <execution><goals><goal>prepare-agent</goal></goals></execution>
                <execution>
                    <id>report</id><phase>test</phase>
                    <goals><goal>report</goal></goals>
                </execution>
                <execution>
                    <id>check</id><goals><goal>check</goal></goals>
                    <configuration>
                        <rules>
                            <rule>
                                <element>BUNDLE</element>
                                <limits>
                                    <limit><counter>LINE</counter><value>COVEREDRATIO</value><minimum>0.60</minimum></limit>
                                </limits>
                            </rule>
                        </rules>
                    </configuration>
                </execution>
            </executions>
        </plugin>
    </plugins>

    <!-- ─── 资源过滤 ─── -->
    <resources>
        <resource>
            <directory>src/main/resources</directory>
            <filtering>true</filtering>            <!-- ★ 开启 ${} 变量替换 -->
            <includes>
                <include>**/*.yml</include>
                <include>**/*.properties</include>
            </includes>
        </resource>
        <resource>
            <directory>src/main/resources</directory>
            <filtering>false</filtering>            <!-- 二进制文件不能过滤（会损坏） -->
            <excludes>
                <exclude>**/*.yml</exclude>
                <exclude>**/*.properties</exclude>
            </excludes>
        </resource>
    </resources>

    <!-- ─── 最终产物名 ─── -->
    <finalName>${project.artifactId}</finalName>    <!-- 去掉版本号：myapp.jar 而非 myapp-1.0.0.jar -->
</build>
```

```properties
# application.yml 中使用 Maven 的变量（★ 需要开启资源过滤）
app:
  version: @project.version@              # ★ 用 @ 而非 ${}（避免与 Spring 的占位符冲突）
  name: @project.artifactId@
  build-time: @maven.build.timestamp@
spring:
  profiles:
    active: @profiles.active@             # ★ 由 Maven profile 决定
```

### 3.3 常用命令速查

```bash
# ─── 构建 ───
mvn clean package                        # ★ 最常用
mvn clean install -DskipTests            # 跳过测试
mvn clean install -Dmaven.test.skip=true # ★ 跳过测试的编译和执行（更快）
mvn clean package -T 4                   # ★ 并行构建（4 线程，多模块提速明显）
mvn clean package -T 1C                  # 每核 1 线程
mvn clean package -o                     # 离线模式（不联网）
mvn clean package -U                     # ★ 强制更新 SNAPSHOT 和检查 release 更新
mvn clean package -P prod                # ★ 激活 profile
mvn clean package -P prod,fast           # 激活多个
mvn clean package -pl module-a -am       # ★ 只构建 module-a 及其依赖的模块
mvn clean package -pl module-b -amd      # 构建 module-b 和依赖它的模块
mvn clean package -rf :module-c          # ★ 从 module-c 开始继续构建（resume from）
mvn clean package -fae                   # 失败后继续构建其他模块（fail at end）
mvn clean package -Dmaven.compile.fork=true

# ─── 运行 Spring Boot ───
mvn spring-boot:run                      # 直接运行（开发）
mvn spring-boot:run -Dspring-boot.run.profiles=dev
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xmx1g -Dfoo=bar"
mvn spring-boot:build-image              # ★ 用 Buildpacks 构建 Docker 镜像（无需 Dockerfile）

# ─── 依赖 ───
mvn dependency:tree -Dverbose
mvn dependency:analyze
mvn dependency:purge-local-repository    # ★ 清理并重新下载（解决本地仓库损坏）
mvn dependency:purge-local-repository -DmanualInclude="com.example:my-lib"

# ─── 版本管理 ───
mvn versions:display-dependency-updates  # ★ 检查哪些依赖有新版本
mvn versions:display-plugin-updates
mvn versions:display-property-updates
mvn versions:set -DnewVersion=2.0.0      # ★ 批量修改项目版本（含子模块）
mvn versions:commit                       # 确认版本修改
mvn versions:revert                       # 回滚版本修改

# ─── 部署 ───
mvn deploy                               # 发布到远程仓库
mvn deploy -DskipTests
mvn release:prepare -DreleaseVersion=1.0.0 -DdevelopmentVersion=1.1.0-SNAPSHOT   # 发布流程
mvn release:perform

# ─── 其他 ───
mvn help:effective-pom                   # ★ 查看最终生效的 pom（合并了 parent 和 profile）
mvn help:effective-settings              # 查看最终生效的 settings
mvn help:describe -Dplugin=compiler -Ddetail   # 查看插件详情
mvn help:active-profiles
mvn archetype:generate -DgroupId=com.example -DartifactId=demo \
    -DarchetypeArtifactId=maven-archetype-quickstart -DinteractiveMode=false   # 生成项目骨架
mvn site                                 # 生成项目报告站点
mvn -e clean package                     # 显示详细错误栈
mvn -X clean package                     # ★ debug 模式（极详细日志，排查问题用）
mvn -q clean package                     # 安静模式（只输出错误）
```

## 4. 多模块项目（Multi-Module）★★★★★

### 4.1 聚合（Aggregation）与继承（Inheritance）

| 概念 | 配置 | 作用 |
| --- | --- | --- |
| **聚合** | 父 pom 的 `&lt;modules&gt;` | ★ 一条命令构建所有模块（`mvn clean install` 在父目录执行） |
| **继承** | 子 pom 的 `&lt;parent&gt;` | ★ 复用父 pom 的配置（依赖版本、插件、属性） |

> 聚合和继承是**两个独立的概念**，通常一起用（父 pom 既聚合又被子模块继承），但可以只用其一。

### 4.2 典型的企业级多模块结构

```
mall-parent/                                  # ★ 父工程（pom 打包类型）
├── pom.xml                                    # 聚合 + 继承（dependencyManagement、pluginManagement）
├── mall-common/                               # 通用模块（工具类、常量、异常、统一响应）
│   ├── pom.xml
│   └── src/main/java/com/example/common/
├── mall-domain/                               # 领域模型（Entity、DTO、VO、枚举）
│   └── pom.xml
├── mall-dao/                                  # 数据访问层（Mapper 接口 + XML）
│   └── pom.xml
├── mall-service/                              # 业务层接口
│   └── pom.xml
├── mall-service-impl/                         # 业务层实现
│   └── pom.xml
├── mall-web/                                  # Web 层（Controller、拦截器、启动类）★ 可执行 jar
│   ├── pom.xml
│   └── src/main/java/com/example/MallApplication.java
├── mall-api/                                  # 对外 API（Feign 接口 + DTO，供其他服务依赖）
│   └── pom.xml
└── mall-job/                                  # 定时任务模块
    └── pom.xml
```

**另一种常见的「按业务域拆分」结构（微服务）：**

```
mall/
├── pom.xml                              # 父 pom
├── mall-framework/                       # 技术框架（starter、公共配置）
│   ├── mall-framework-core/
│   ├── mall-framework-web/
│   ├── mall-framework-mybatis/
│   ├── mall-framework-redis/
│   └── mall-framework-security/
├── mall-common/                          # 公共模块
├── mall-module-user/                     # ★ 用户业务模块（自成一个完整应用）
│   ├── mall-module-user-api/             #   对外接口（Feign + DTO）
│   ├── mall-module-user-biz/             #   业务实现（Controller/Service/Mapper）
│   └── pom.xml
├── mall-module-order/
├── mall-module-product/
└── mall-module-pay/
```

**父 pom.xml：**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>

    <!-- ─── 继承 Spring Boot（获得依赖版本管理）─── -->
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
        <relativePath/>
    </parent>

    <!-- ─── 本项目的坐标 ─── -->
    <groupId>com.example</groupId>
    <artifactId>mall-parent</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>pom</packaging>                  <!-- ★★★ 父工程必须是 pom 类型！ -->
    <name>mall-parent</name>
    <description>商城项目父工程</description>

    <!-- ─── ★ 聚合：列出所有子模块 ─── -->
    <modules>
        <module>mall-common</module>
        <module>mall-domain</module>
        <module>mall-dao</module>
        <module>mall-service</module>
        <module>mall-service-impl</module>
        <module>mall-web</module>
    </modules>

    <!-- ─── ★ 统一的版本属性（便于集中升级）─── -->
    <properties>
        <java.version>17</java.version>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>

        <!-- 内部模块版本（★ 用属性统一管理，改一处即可） -->
        <revision>1.0.0-SNAPSHOT</revision>

        <!-- 第三方版本 -->
        <mybatis-plus.version>3.5.5</mybatis-plus.version>
        <druid.version>1.2.20</druid.version>
        <hutool.version>5.8.23</hutool.version>
        <knife4j.version>4.5.0</knife4j.version>
        <mapstruct.version>1.5.5.Final</mapstruct.version>
        <lombok.version>1.18.30</lombok.version>
        <easyexcel.version>3.3.3</easyexcel.version>
        <redisson.version>3.24.3</redisson.version>
    </properties>

    <!-- ─── ★ 依赖版本管理（只声明版本，不实际引入）─── -->
    <dependencyManagement>
        <dependencies>
            <!-- 内部模块 -->
            <dependency>
                <groupId>com.example</groupId>
                <artifactId>mall-common</artifactId>
                <version>${revision}</version>
            </dependency>
            <dependency>
                <groupId>com.example</groupId>
                <artifactId>mall-domain</artifactId>
                <version>${revision}</version>
            </dependency>
            <dependency>
                <groupId>com.example</groupId>
                <artifactId>mall-dao</artifactId>
                <version>${revision}</version>
            </dependency>
            <dependency>
                <groupId>com.example</groupId>
                <artifactId>mall-service</artifactId>
                <version>${revision}</version>
            </dependency>

            <!-- 第三方（★ 锁定版本，避免传递依赖冲突） -->
            <dependency>
                <groupId>com.baomidou</groupId>
                <artifactId>mybatis-plus-boot-starter</artifactId>
                <version>${mybatis-plus.version}</version>
            </dependency>
            <dependency>
                <groupId>com.alibaba</groupId>
                <artifactId>druid-spring-boot-3-starter</artifactId>
                <version>${druid.version}</version>
            </dependency>
            <dependency>
                <groupId>cn.hutool</groupId>
                <artifactId>hutool-all</artifactId>
                <version>${hutool.version}</version>
            </dependency>
            <dependency>
                <groupId>com.github.xiaoymin</groupId>
                <artifactId>knife4j-openapi3-jakarta-spring-boot-starter</artifactId>
                <version>${knife4j.version}</version>
            </dependency>
            <dependency>
                <groupId>org.mapstruct</groupId>
                <artifactId>mapstruct</artifactId>
                <version>${mapstruct.version}</version>
            </dependency>
            <dependency>
                <groupId>com.alibaba</groupId>
                <artifactId>easyexcel</artifactId>
                <version>${easyexcel.version}</version>
            </dependency>
            <dependency>
                <groupId>org.redisson</groupId>
                <artifactId>redisson-spring-boot-starter</artifactId>
                <version>${redisson.version}</version>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <!-- ─── ★ 所有子模块都需要的依赖（直接引入）─── -->
    <dependencies>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <!-- ─── ★ 插件版本管理（子模块引用时不用写 version）─── -->
    <build>
        <pluginManagement>
            <plugins>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-surefire-plugin</artifactId>
                    <version>3.2.2</version>
                    <configuration><skipTests>true</skipTests></configuration>   <!-- 默认跳过测试 -->
                </plugin>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-compiler-plugin</artifactId>
                    <version>3.11.0</version>
                    <configuration>
                        <release>17</release>
                        <encoding>UTF-8</encoding>
                        <parameters>true</parameters>
                        <annotationProcessorPaths>
                            <path>
                                <groupId>org.projectlombok</groupId>
                                <artifactId>lombok</artifactId>
                                <version>${lombok.version}</version>
                            </path>
                            <path>
                                <groupId>org.mapstruct</groupId>
                                <artifactId>mapstruct-processor</artifactId>
                                <version>${mapstruct.version}</version>
                            </path>
                        </annotationProcessorPaths>
                    </configuration>
                </plugin>
            </plugins>
        </pluginManagement>

        <plugins>
            <!-- ★ 所有模块都执行（不放在 pluginManagement 中） -->
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
            </plugin>
        </plugins>
    </build>

    <!-- ─── Profile（多环境）─── -->
    <profiles>
        <profile>
            <id>dev</id>
            <properties><profiles.active>dev</profiles.active></properties>
            <activation><activeByDefault>true</activeByDefault></activation>
        </profile>
        <profile>
            <id>test</id>
            <properties><profiles.active>test</profiles.active></properties>
        </profile>
        <profile>
            <id>prod</id>
            <properties><profiles.active>prod</profiles.active></properties>
            <build>
                <plugins>
                    <!-- 生产环境才做混淆/加固 -->
                </plugins>
            </build>
        </profile>
    </profiles>

    <!-- ─── 发布仓库 ─── -->
    <distributionManagement>
        <repository>
            <id>my-nexus</id>                                   <!-- ★ 与 settings.xml 的 server id 一致 -->
            <url>https://nexus.company.com/repository/maven-releases/</url>
        </repository>
        <snapshotRepository>
            <id>my-nexus</id>
            <url>https://nexus.company.com/repository/maven-snapshots/</url>
        </snapshotRepository>
    </distributionManagement>
</project>
```

**子模块 pom.xml（mall-service-impl）：**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>

    <!-- ─── ★ 继承父模块 ─── -->
    <parent>
        <groupId>com.example</groupId>
        <artifactId>mall-parent</artifactId>
        <version>1.0.0-SNAPSHOT</version>
        <!-- <relativePath>../pom.xml</relativePath> -->   <!-- 默认就是 ../pom.xml，可省略 -->
    </parent>

    <!-- ─── 本模块坐标（groupId 和 version 继承自父，可省略）─── -->
    <artifactId>mall-service-impl</artifactId>
    <packaging>jar</packaging>                    <!-- 默认就是 jar，可省略 -->
    <name>mall-service-impl</name>
    <description>业务逻辑实现</description>

    <dependencies>
        <!-- ★ 内部模块依赖（无需写 version，父 pom 的 dependencyManagement 已管理） -->
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>mall-service</artifactId>
        </dependency>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>mall-dao</artifactId>
        </dependency>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>mall-common</artifactId>
        </dependency>

        <!-- 第三方（无需 version） -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter</artifactId>
        </dependency>
        <dependency>
            <groupId>cn.hutool</groupId>
            <artifactId>hutool-all</artifactId>
        </dependency>
    </dependencies>
</project>
```

**Web 模块（可执行 jar）：**

```xml
<project>
    <parent>
        <groupId>com.example</groupId>
        <artifactId>mall-parent</artifactId>
        <version>1.0.0-SNAPSHOT</version>
    </parent>

    <artifactId>mall-web</artifactId>
    <packaging>jar</packaging>

    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>mall-service-impl</artifactId>
            <version>${revision}</version>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    </dependencies>

    <build>
        <finalName>mall-web</finalName>                 <!-- ★ 产物名不带版本号 -->
        <plugins>
            <!-- ★★ 只有这个模块需要 Spring Boot 打包插件（生成可执行 jar） -->
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <mainClass>com.example.MallApplication</mainClass>
                </configuration>
                <executions>
                    <execution><goals><goal>repackage</goal></goals></execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
```

**多模块构建：**

```bash
cd mall-parent
mvn clean install -DskipTests                    # ★ 构建所有模块（按依赖顺序）
# Maven 会自动分析模块间依赖，计算正确的构建顺序（Reactor 顺序）：
# [INFO] Reactor Build Order:
# [INFO]   mall-parent
# [INFO]   mall-common
# [INFO]   mall-domain
# [INFO]   mall-dao
# [INFO]   mall-service
# [INFO]   mall-service-impl
# [INFO]   mall-web

mvn clean install -pl mall-web -am -DskipTests    # ★ 只构建 mall-web 和它依赖的模块（-am = also-make）
mvn clean install -pl mall-common -amd            # 构建 mall-common 和依赖它的模块（-amd = also-make-dependents）
mvn clean install -rf :mall-service               # ★ 从 mall-service 开始继续（失败后恢复）
mvn clean install -T 4                            # 并行构建（4 线程，多模块提速 2~4 倍）
mvn clean install -fae                            # 某模块失败后继续构建其他模块
```

### 4.3 版本管理的最佳实践

**① SNAPSHOT vs RELEASE：**

| | SNAPSHOT（快照） | RELEASE（正式） |
| --- | --- | --- |
| 版本号 | `1.0.0-SNAPSHOT` | `1.0.0` |
| 含义 | **开发中的不稳定版本** | **已发布的稳定版本** |
| 仓库 | snapshots 仓库 | releases 仓库 |
| 重复部署 | ✅ **允许**（同一版本号可覆盖） | ❌ **禁止**（Nexus 默认拒绝覆盖） |
| 拉取行为 | ★ 每次构建都检查更新（默认每天一次，`-U` 强制） | 只下载一次，永久缓存 |
| 实际文件名 | `xxx-1.0.0-20260907.103045-3.jar`（带时间戳） | `xxx-1.0.0.jar` |
| 使用场景 | 开发期、联调 | 生产发布、对外提供 |
| 生产依赖 | ❌ **禁止**（不可重现构建！） | ✅ |

```bash
mvn clean install -U                     # ★ 强制更新 SNAPSHOT（依赖方改了但本地还是旧的）
# 常见坑：同事 deploy 了新的 SNAPSHOT，你本地缓存了旧的 → 加 -U 或删除本地仓库中该目录
```

> 【坑】**生产环境依赖 SNAPSHOT 是大忌**：SNAPSHOT 会变，同一份代码今天构建和明天构建的产物可能不同（**构建不可重现**），出问题时无法回溯。发布前必须把所有 SNAPSHOT 依赖改为 RELEASE。用 `maven-enforcer-plugin` 的 `requireReleaseDeps` 规则强制检查。

**② `$&#123;revision&#125;` 统一管理版本（Maven 3.5+ 的 CI Friendly Versions）：**

```xml
<!-- 父 pom -->
<version>${revision}</version>
<properties>
    <revision>1.0.0-SNAPSHOT</revision>       <!-- ★ 改这一处，所有模块版本都变 -->
</properties>
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>mall-common</artifactId>
            <version>${revision}</version>     <!-- ★ 用属性而非硬编码 -->
        </dependency>
    </dependencies>
</dependencyManagement>

<!-- 子 pom -->
<parent>
    <groupId>com.example</groupId>
    <artifactId>mall-parent</artifactId>
    <version>${revision}</version>
</parent>

<!-- ★ 必须加这个插件，否则 install/deploy 出去的 pom 中 ${revision} 不会被替换！ -->
<build>
    <plugins>
        <plugin>
            <groupId>org.codehaus.mojo</groupId>
            <artifactId>flatten-maven-plugin</artifactId>
            <version>1.5.0</version>
            <configuration>
                <updatePomFile>true</updatePomFile>
                <flattenMode>resolveCiFriendliesOnly</flattenMode>
            </configuration>
            <executions>
                <execution>
                    <id>flatten</id><phase>process-resources</phase>
                    <goals><goal>flatten</goal></goals>
                </execution>
                <execution>
                    <id>flatten.clean</id><phase>clean</phase>
                    <goals><goal>clean</goal></goals>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
```

```bash
# 修改版本号（三种方式）
mvn versions:set -DnewVersion=2.0.0 -DgenerateBackupPoms=false    # 传统方式（修改所有 pom）
mvn clean deploy -Drevision=2.0.0                                  # ★ revision 方式（不改文件，CI 友好）
```

**③ 版本号规范（语义化版本 SemVer）：**

```
主版本号.次版本号.修订号[-预发布标识][+构建元数据]
MAJOR.MINOR.PATCH[-alpha/beta/RC][+build]

1.0.0          正式版
1.0.1          修订号 +1：Bug 修复，向后兼容
1.1.0          次版本号 +1：新增功能，向后兼容
2.0.0          主版本号 +1：★ 不兼容的 API 变更
1.0.0-SNAPSHOT 开发中
1.0.0-alpha    内测版
1.0.0-beta     公测版
1.0.0-RC1      发布候选版
```

## 5. 私服（Nexus）与依赖发布

```xml
<!-- ─── 从私服拉取依赖 ─── -->
<repositories>
    <repository>
        <id>my-nexus</id>                              <!-- ★ 与 settings.xml 的 <server> id 一致 -->
        <name>Company Nexus</name>
        <url>https://nexus.company.com/repository/maven-public/</url>
        <releases><enabled>true</enabled><updatePolicy>never</updatePolicy></releases>
        <snapshots><enabled>true</enabled><updatePolicy>always</updatePolicy></snapshots>
    </repository>
    <!-- Spring 里程碑版（未正式发布的功能） -->
    <repository>
        <id>spring-milestones</id>
        <url>https://repo.spring.io/milestone</url>
        <snapshots><enabled>false</enabled></snapshots>
    </repository>
</repositories>

<pluginRepositories>
    <pluginRepository>
        <id>my-nexus</id>
        <url>https://nexus.company.com/repository/maven-public/</url>
    </pluginRepository>
</pluginRepositories>

<!-- ─── 发布到私服 ─── -->
<distributionManagement>
    <repository>
        <id>my-nexus</id>
        <url>https://nexus.company.com/repository/maven-releases/</url>
    </repository>
    <snapshotRepository>
        <id>my-nexus</id>
        <url>https://nexus.company.com/repository/maven-snapshots/</url>
    </snapshotRepository>
</distributionManagement>
```

**Nexus 的仓库类型：**

| 类型 | 说明 | 示例 |
| --- | --- | --- |
| **proxy**（代理仓库） | 代理远程仓库并缓存 | `maven-central`（代理中央仓库，加速） |
| **hosted**（宿主仓库） | 存放自己发布的构件 | `maven-releases`、`maven-snapshots`、`thirdparty`（放无法从公网获取的 jar） |
| **group**（仓库组） | ★ 把多个仓库聚合成一个 URL | `maven-public`（= central proxy + releases + snapshots） |

```bash
# 发布到私服
mvn clean deploy -DskipTests
# 常见失败原因：
# ① settings.xml 中没有对应 id 的 <server> 认证信息 → 401 Unauthorized
# ② RELEASE 版本重复发布 → 400 Bad Request（Nexus 默认禁止覆盖）
# ③ pom 中缺少 <distributionManagement> → "Deployment failed: repository element was not specified"
# ④ 没有该仓库的部署权限 → 403 Forbidden

# 手动安装第三方 jar 到本地仓库（无源码的 jar）
mvn install:install-file -Dfile=ojdbc8.jar \
    -DgroupId=com.oracle.database.jdbc -DartifactId=ojdbc8 \
    -Dversion=21.9.0.0 -Dpackaging=jar

# 部署到私服
mvn deploy:deploy-file -Dfile=ojdbc8.jar \
    -DgroupId=com.oracle -DartifactId=ojdbc8 -Dversion=21.9.0.0 \
    -Dpackaging=jar -DrepositoryId=my-nexus \
    -Durl=https://nexus.company.com/repository/thirdparty/
```

## 6. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `mirrorOf` 设为 `*` | 私服依赖下载不到 | 改为 `central` 或排除私服 id |
| 2 | 依赖版本冲突 | `NoSuchMethodError`、`NoClassDefFoundError` | `dependency:tree -Dverbose` 定位 + `dependencyManagement` 锁版本 |
| 3 | 多个 BOM 顺序错误 | 版本不符预期 | ★ **先导入的 BOM 优先**，把重要的放前面 |
| 4 | `src/main/java` 下的 XML 未打包 | MyBatis 找不到 Mapper XML | 配置 `&lt;resources&gt;` 包含 `**/*.xml` |
| 5 | 资源过滤损坏二进制文件 | 图片/字体损坏 | 二进制文件 `filtering=false` |
| 6 | Spring 占位符与 Maven 冲突 | `$&#123;xxx&#125;` 被 Maven 提前替换 | Spring Boot 中用 `@xxx@` 作为分隔符 |
| 7 | Servlet API 打进 war | `LinkageError`、`ClassCastException` | scope 设为 `provided` |
| 8 | Lombok 打进 jar | 无谓增大包体积 | `optional=true` + 在 boot 插件中 exclude |
| 9 | 生产依赖 SNAPSHOT | **构建不可重现** | 发布前全部改 RELEASE + enforcer 检查 |
| 10 | SNAPSHOT 更新不及时 | 拿到旧代码 | `mvn -U` 或删除本地仓库缓存 |
| 11 | 本地仓库损坏 | 各种诡异的解析错误 | `dependency:purge-local-repository` 或删 `~/.m2/repository` 中对应目录 |
| 12 | `$&#123;revision&#125;` 未被替换 | install 出去的 pom 中还是变量 | 必须加 `flatten-maven-plugin` |
| 13 | 未配 `-parameters` 编译参数 | Spring MVC/MyBatis 拿不到参数名 | `<compilerArgs>&lt;arg&gt;-parameters</arg>` |
| 14 | 编码未统一 | 中文乱码、`编码 GBK 的不可映射字符` | `project.build.sourceEncoding=UTF-8` |
| 15 | 忘记 `spring-boot-maven-plugin` | jar 无法执行（`no main manifest attribute`） | 添加插件 + `repackage` goal |
| 16 | 多个模块都加了 boot 插件 | 库模块被打成可执行 jar，无法被依赖 | ★ 只在「启动模块」加 |
| 17 | shade 打包后 SPI 失效 | `ServiceConfigurationError` | 加 `ServicesResourceTransformer` |
| 18 | shade 后签名校验失败 | `SecurityException: Invalid signature file` | 排除 `META-INF/*.SF/*.DSA/*.RSA` |
| 19 | 循环依赖的模块 | Maven 无法确定构建顺序 | 重新设计模块边界，抽取公共模块 |
| 20 | 子模块硬编码 version | 升级版本要改 N 处 | 用 `$&#123;revision&#125;` 或继承父 version |
| 21 | `dependency:analyze` 报「用了未声明」 | 传递依赖被直接使用（脆弱） | 显式声明所用依赖 |
| 22 | Nexus 认证失败 401 | 无法 deploy | settings.xml 的 `&lt;server&gt;` id 必须与 pom 一致 |
| 23 | RELEASE 重复发布被拒 | 400 Repository does not allow updating | 升版本号，或配置允许 redeploy（不推荐） |
| 24 | 插件版本未锁定 | 不同时间构建行为不同 | ★ 所有插件都写明确的 version |
| 25 | 未配 Maven Wrapper | 团队 Maven 版本不一致导致构建差异 | `mvn wrapper:wrapper` |

---

## 关联笔记

- 下一篇：[[后端/Java工程化与部署/Gradle与构建工具对比]]
- 相关：[[后端/Java基础/Java语言概述与开发环境]]（打包与 jar）、[[后端/JVM/类加载机制与字节码]]（ClassLoader 与 jar 冲突）
- 部署：[[后端/Java工程化与部署/Linux与Java项目部署]]、[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]
- Spring Boot：[[后端/SpringBoot/日志-Actuator与打包部署]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
