---
title: "Gradle与构建工具对比"
aliases:
  - "Gradle"
  - "构建工具选型"
tags:
  - "后端"
  - "java"
  - "工程化"
category: "后端"
folder: "Java工程化与部署"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java工程化与部署/Maven依赖管理与多模块]]"
  - "[[后端/Java工程化与部署/Linux与Java项目部署]]"
  - "[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]"
created: 2026-09-07
updated: 2026-09-07
---

# Gradle 与构建工具对比

## 1. Gradle 是什么

**Gradle 是基于 Groovy/Kotlin DSL 的构建工具**，用「代码」而非「XML」描述构建逻辑，兼具 Maven 的依赖管理和 Ant 的灵活性，通过**增量构建 + 构建缓存 + 守护进程**实现远超 Maven 的速度。

| 版本 | 关键变化 |
| --- | --- |
| Gradle 4.x | 支持 Java 9 模块化 |
| Gradle 5.x | Kotlin DSL 稳定 |
| Gradle 6.x | 配置缓存（孵化）、依赖锁定 |
| Gradle 7.x | ★ 支持 JDK 17、移除大量废弃 API、`implementation` 成为默认 |
| **Gradle 8.x** | ★ 配置缓存正式、支持 JDK 21、构建性能大幅提升 |

**Spring Boot 与 Gradle 的对应：** Spring Boot 官方同时提供 Maven 和 Gradle 两套 starter 插件，`start.spring.io` 生成项目时可选。

## 2. Gradle vs Maven ★★★★★

| 对比项 | Maven | **Gradle** |
| --- | --- | --- |
| 配置语言 | XML（声明式） | **Groovy / Kotlin DSL（代码）** |
| 灵活性 | 低（只能通过插件扩展） | ★ **高**（可用任意代码逻辑） |
| 配置文件体积 | pom.xml 冗长 | build.gradle 简洁 |
| **构建速度** | 中（每次全量） | ★★ **快 2~10 倍**（增量 + 缓存 + 守护进程） |
| 增量构建 | 有限 | ★ **任务级增量 + up-to-date 检查** |
| 构建缓存 | ❌ | ★ **本地 + 远程缓存（团队共享）** |
| 守护进程 | ❌（每次启动新 JVM） | ★ **Daemon 常驻**（省去 JVM 启动） |
| 依赖管理 | ✅ 完善 | ✅ 完善（**兼容 Maven 仓库**） |
| 依赖冲突处理 | 最短路径 + 声明顺序（隐式） | ★ **显式 resolutionStrategy**（更可控） |
| 多模块 | ✅ modules | ✅ 更灵活（composite build） |
| 学习曲线 | ★ **低**（约定固定） | 中高（DSL + 生命周期概念） |
| 生态/文档 | ★ **最广** | Android 首选，服务端增长中 |
| IDEA 支持 | ★ 优秀 | 优秀（但索引/同步较慢） |
| 构建可预测性 | ★ **高**（XML 无副作用） | 中（脚本可能有副作用，配置缓存缓解） |
| 团队协作 | ★ 新人上手快 | 需要约定规范（否则 build 脚本五花八门） |
| 典型场景 | **企业后端主流** | Android（强制）、大型多模块项目、需要复杂构建逻辑 |

**速度差异的实际来源：**

```
Maven：mvn clean package
  → 每次都 clean（删 target）→ 全量编译 → 全量测试 → 全量打包
  → 每次启动新 JVM（约 2~3 秒）

Gradle：gradle build
  → 守护进程常驻（无 JVM 启动开销）
  → 任务级 up-to-date 检查：源码没变的模块【跳过】编译
  → 增量编译：只编译改动的文件
  → 构建缓存：相同的输入 → 直接复用输出（可从远程缓存拉取，CI 提速巨大）
  → 配置缓存：跳过配置阶段（大型项目配置阶段可能占 10 秒+）
  
实测（20 个模块的项目，改一行代码后构建）：
  Maven:  45 秒（全量）
  Gradle: 3 秒（只重编改动的模块）
```

> 【选型建议】
> - **国内企业后端项目**：Maven 仍是主流（生态、文档、团队熟悉度、招聘），**没有明确理由就用 Maven**。
> - **Android 项目**：必须 Gradle（Android Gradle Plugin）。
> - **超大型多模块项目 / 构建时间成为瓶颈**：Gradle（增量和缓存的收益巨大）。
> - **需要复杂构建逻辑**（如动态生成模块、条件化依赖、自定义代码生成）：Gradle。
> - **Spring Boot 单体/中小型微服务**：两者都可以，跟随团队现状。

## 3. Gradle 项目结构

```
my-project/
├── build.gradle(.kts)              # ★ 构建脚本（Groovy / Kotlin DSL）
├── settings.gradle(.kts)           # ★ 项目设置（多模块声明、仓库）
├── gradle.properties               # ★ 全局属性（JVM 参数、版本号、开关）
├── gradlew / gradlew.bat           # ★ Gradle Wrapper（团队必备）
├── gradle/
│   ├── wrapper/
│   │   ├── gradle-wrapper.jar
│   │   └── gradle-wrapper.properties   # 指定 Gradle 版本
│   └── libs.versions.toml           # ★ 版本目录（Gradle 7.4+，统一管理版本）
├── buildSrc/                        # 自定义构建逻辑（插件、约定）
│   ├── build.gradle.kts
│   └── src/main/kotlin/
├── src/
│   ├── main/java/                   # ★ 与 Maven 完全相同的目录约定
│   ├── main/resources/
│   ├── test/java/
│   └── test/resources/
└── build/                           # 构建输出（对应 Maven 的 target/）
    ├── classes/
    ├── resources/
    ├── libs/my-project-1.0.0.jar
    ├── reports/                     # 测试报告
    └── tmp/
```

> 【兼容】Gradle **默认采用与 Maven 相同的目录布局**，所以 Maven 项目迁移到 Gradle 不需要移动源码，只需把 pom.xml 翻译成 build.gradle。

## 4. Groovy DSL 基础（build.gradle）

```groovy
// ══════════ build.gradle ══════════

// ─── 插件 ───
plugins {
    id 'java'                                          // Java 基础插件
    id 'org.springframework.boot' version '3.2.0'       // ★ Spring Boot 插件
    id 'io.spring.dependency-management' version '1.1.4' // ★ 依赖版本管理（等价 Maven 的 BOM）
    id 'java-library'                                   // 库项目（区分 api/implementation）
    id 'maven-publish'                                  // 发布到仓库
    id 'jacoco'                                         // 覆盖率
    id 'idea'
}

// ─── 项目坐标（对应 Maven 的 GAV）───
group = 'com.example'
version = '1.0.0-SNAPSHOT'
description = '示例项目'

// ─── Java 版本 ───
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
    toolchain {                                         // ★ 工具链（自动下载指定 JDK）
        languageVersion = JavaLanguageVersion.of(17)
    }
    withSourcesJar()                                     // 同时打源码 jar
    withJavadocJar()
}

// ─── 编码 ───
compileJava.options.encoding = 'UTF-8'
compileTestJava.options.encoding = 'UTF-8'
tasks.withType(JavaCompile).configureEach {
    options.encoding = 'UTF-8'
    options.compilerArgs << '-parameters'                // ★ 保留参数名（Spring/MyBatis 需要）
}

// ─── 仓库（对应 Maven 的 repositories）───
repositories {
    mavenLocal()                                         // 本地仓库 ~/.m2/repository
    maven { url 'https://maven.aliyun.com/repository/public' }   // ★ 国内镜像
    maven { url 'https://maven.aliyun.com/repository/spring' }
    mavenCentral()                                        // 中央仓库
    maven {                                               // 私服（带认证）
        url 'https://nexus.company.com/repository/maven-public/'
        credentials {
            username = project.findProperty('nexusUser') ?: System.getenv('NEXUS_USER')
            password = project.findProperty('nexusPassword') ?: System.getenv('NEXUS_PASSWORD')
        }
    }
    gradlePluginPortal()                                  // Gradle 插件仓库
    maven { url 'https://repo.spring.io/milestone' }       // Spring 里程碑
}

// ─── 依赖（★ 核心）───
dependencies {
    // ─── Spring Boot Starter ───
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    implementation 'org.springframework.boot:spring-boot-starter-data-redis'
    implementation 'org.springframework.boot:spring-boot-starter-aop'

    // ─── 数据库 ───
    implementation 'com.baomidou:mybatis-plus-boot-starter:3.5.5'
    runtimeOnly 'com.mysql:mysql-connector-j'              // ★ runtimeOnly（对应 Maven 的 runtime）
    implementation 'com.alibaba:druid-spring-boot-3-starter:1.2.20'

    // ─── 工具库 ───
    implementation 'cn.hutool:hutool-all:5.8.23'
    implementation 'org.apache.commons:commons-lang3'      // 版本由 BOM 管理
    implementation 'com.google.guava:guava:32.1.3-jre'
    implementation 'org.mapstruct:mapstruct:1.5.5.Final'

    // ─── 编译期依赖（对应 Maven 的 provided）───
    compileOnly 'org.projectlombok:lombok'                  // ★ compileOnly
    annotationProcessor 'org.projectlombok:lombok'           // ★ 注解处理器必须单独声明！
    annotationProcessor 'org.mapstruct:mapstruct-processor:1.5.5.Final'

    // ─── 测试 ───
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testCompileOnly 'org.projectlombok:lombok'
    testAnnotationProcessor 'org.projectlombok:lombok'
    testImplementation 'org.testcontainers:mysql'

    // ─── 内部模块依赖（多模块项目）───
    implementation project(':mall-common')
    api project(':mall-domain')                             // ★ api（会传递给依赖方）

    // ─── 排除传递依赖（对应 Maven 的 exclusions）───
    implementation('org.springframework.boot:spring-boot-starter-web') {
        exclude group: 'org.springframework.boot', module: 'spring-boot-starter-tomcat'
        exclude module: 'spring-boot-starter-logging'        // 只写 module 也可
    }
    implementation 'org.springframework.boot:spring-boot-starter-undertow'

    // ─── 文件依赖 ───
    implementation files('libs/ojdbc8.jar')                 // 单个文件
    implementation fileTree(dir: 'libs', include: ['*.jar'])  // 目录下所有 jar
}

// ─── 依赖冲突解决（★ 比 Maven 更显式可控）───
configurations.all {
    resolutionStrategy {
        // ① 强制指定版本（★ 等价 Maven 的 dependencyManagement）
        force 'com.fasterxml.jackson.core:jackson-databind:2.16.0'
        force 'org.slf4j:slf4j-api:2.0.9'

        // ② 失败快速（有冲突就报错，而非静默选择）
        // failOnVersionConflict()

        // ③ 优先使用项目中的模块（多模块 + 同 GAV 的外部依赖时）
        preferProjectModules()

        // ④ 依赖替换
        // dependencySubstitution {
        //     substitute module('commons-logging:commons-logging') using module('org.slf4j:jcl-over-slf4j:2.0.9')
        // }

        // ⑤ 缓存策略
        cacheChangingModulesFor 0, 'seconds'                // SNAPSHOT 不缓存
        cacheDynamicVersionsFor 10, 'minutes'
    }

    // 全局排除某个依赖（★ 很实用）
    exclude group: 'commons-logging', module: 'commons-logging'
    exclude group: 'log4j', module: 'log4j'

    // 所有依赖都失败时打印详细信息
    // resolutionStrategy.eachDependency { details ->
    //     if (details.requested.group == 'org.slf4j') {
    //         details.useVersion '2.0.9'
    //         details.because '统一 SLF4J 版本'
    //     }
    // }
}

// ─── 测试配置 ───
test {
    useJUnitPlatform()                                       // ★ JUnit 5 必须声明！
    maxHeapSize = '1G'
    systemProperty 'file.encoding', 'UTF-8'
    testLogging {
        events 'passed', 'skipped', 'failed'
        exceptionFormat 'full'
        showStandardStreams = true
    }
    // 排除集成测试
    exclude '**/*IntegrationTest.class'
    finalizedBy jacocoTestReport                             // 测试后生成覆盖率报告
    // ignoreFailures = true                                 // 测试失败不中断构建
}

// ─── Spring Boot 配置 ───
springBoot {
    mainClass = 'com.example.MyApplication'                  // ★ 主类
    buildInfo {                                              // 生成 META-INF/build-info.properties
        properties {
            additional = ['buildTime': new Date().toString()]
        }
    }
}

bootJar {
    archiveFileName = "${project.name}.jar"                   // ★ 产物名不带版本号
    launchScript()                                            // 生成可 ./app.jar 直接执行的脚本
    requiresUnpack '**/jruby*.jar'                            // 需要解压的依赖
    // ★ 分层打包（Docker 缓存优化）
    layered {
        application {
            intoLayer("spring-boot-loader") { includes "org/springframework/boot/loader/**" }
            intoLayer("application")
        }
    }
}

// ─── 打包时排除 Lombok ───
bootJar {
    // Lombok 是 compileOnly，本来就不会打进去
}
jar {
    enabled = false                                           // ★ 禁用普通 jar（避免与 bootJar 冲突）
}

// ─── JaCoCo 覆盖率 ───
jacoco {
    toolVersion = '0.8.11'
}
jacocoTestReport {
    dependsOn test
    reports {
        xml.required = true                                   // CI 需要
        html.required = true
        csv.required = false
    }
}
jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit { counter = 'LINE'; value = 'COVEREDRATIO'; minimum = 0.60 }
        }
    }
}
check.dependsOn jacocoTestCoverageVerification

// ─── 自定义任务（★ Gradle 的灵活性体现）───
tasks.register('printInfo') {
    group = 'help'
    description = '打印项目信息'
    doLast {
        println "项目：${project.name}"
        println "版本：${project.version}"
        println "Java：${JavaVersion.current()}"
        println "依赖数：${configurations.implementation.dependencies.size()}"
    }
}

// 拷贝配置文件到构建目录
tasks.register('copyConfigs', Copy) {
    from 'src/main/config'
    into "$buildDir/configs"
    include '**/*.yml'
    filter { line -> line.replace('@version@', project.version.toString()) }   // 变量替换
}

// 生成 Docker 镜像（调用 docker 命令）
tasks.register('buildImage', Exec) {
    dependsOn bootJar
    workingDir project.rootDir
    commandLine 'docker', 'build',
            '-t', "registry.example.com/${project.name}:${project.version}", '.'
}

// 打包成 tar.gz（含启动脚本和配置）
tasks.register('distTar2', Tar) {
    dependsOn bootJar
    archiveBaseName = project.name
    archiveClassifier = 'dist'
    compression = Compression.GZIP
    from(bootJar) { into 'lib' }
    from('src/main/resources') { include 'application*.yml'; into 'config' }
    from('scripts') { into 'bin'; fileMode 0755 }
}
```

### 4.1 依赖配置（Configuration）★★★★★

| 配置 | 含义 | 传递性 | Maven 对应 |
| --- | --- | --- | --- |
| **`implementation`** ★ | 实现依赖（**不传递**给依赖方） | ❌ 不传递 | `compile`（但 Gradle 优化了编译隔离） |
| **`api`** | API 依赖（**传递**给依赖方，仅 `java-library` 插件） | ✅ 传递 | `compile` |
| `compileOnly` | 仅编译期 | ❌ | ★ `provided` |
| `runtimeOnly` | 仅运行期 | ✅ | ★ `runtime` |
| `testImplementation` | 测试实现 | ❌ | `test` |
| `testCompileOnly` / `testRuntimeOnly` | 测试的编译/运行期 | — | `test` |
| `annotationProcessor` | ★ **注解处理器**（Lombok、MapStruct） | ❌ | 无直接对应（Maven 走 classpath） |
| `testAnnotationProcessor` | 测试的注解处理器 | ❌ | — |
| `compile` / `runtime` / `testCompile` | ❌ **已废弃**（Gradle 7 移除） | — | — |

**`implementation` vs `api` 的意义（★ 编译隔离，提速关键）：**

```
模块 A 依赖 guava（用 api 声明）
模块 B 依赖 A
  → B 的编译 classpath 包含 guava
  → ★ 修改 guava 版本时，A 和 B 都要重新编译

模块 A 依赖 guava（用 implementation 声明）
模块 B 依赖 A
  → B 的编译 classpath 【不包含】guava（除非 A 的公开 API 暴露了 guava 类型）
  → ★ 修改 guava 版本时，只需重编 A（B 被"隔离"了）
  → 大型项目的增量构建速度显著提升

规则：
  - 依赖的类型出现在你的【公开 API】（public 方法签名、public 字段）中 → 用 api
  - 只在内部实现中使用 → 用 implementation（★ 默认选这个）
  - 应用模块（可执行 jar）→ 一律 implementation（没有依赖方）
```

### 4.2 Kotlin DSL（build.gradle.kts）★ 推荐

```kotlin
// ══════════ build.gradle.kts（类型安全，IDEA 补全更好）══════════

plugins {
    java
    id("org.springframework.boot") version "3.2.0"
    id("io.spring.dependency-management") version "1.1.4"
}

group = "com.example"
version = "1.0.0-SNAPSHOT"

java {
    sourceCompatibility = JavaVersion.VERSION_17
    toolchain { languageVersion.set(JavaLanguageVersion.of(17)) }
}

repositories {
    maven { url = uri("https://maven.aliyun.com/repository/public") }
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("com.baomidou:mybatis-plus-boot-starter:3.5.5")
    runtimeOnly("com.mysql:mysql-connector-j")
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    implementation(project(":mall-common"))
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
    options.compilerArgs.add("-parameters")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    archiveFileName.set("${project.name}.jar")
}
```

**Groovy DSL vs Kotlin DSL：**

| | Groovy DSL | **Kotlin DSL** |
| --- | --- | --- |
| 文件 | `build.gradle` | `build.gradle.kts` |
| 类型安全 | ❌ 运行时才发现错误 | ★ **编译期检查** |
| IDE 补全 | 差（动态类型） | ★ **优秀**（能跳转到源码） |
| 语法 | 更简洁（可省括号） | 更严格（需要括号和类型） |
| 文档 | 老资料多 | 官方现在主推 |
| 配置速度 | 快 | 略慢（需要编译脚本，但有缓存） |
| Android | 传统 | ★ Google 官方推荐 |

> 【建议】**新项目用 Kotlin DSL**（类型安全 + IDE 支持好），存量 Groovy 项目不必强行迁移。

### 4.3 settings.gradle 与多模块

```groovy
// ══════════ settings.gradle（★ 多模块项目的入口）══════════
rootProject.name = 'mall'

// ─── 声明子模块 ───
include 'mall-common'
include 'mall-domain'
include 'mall-dao'
include 'mall-service'
include 'mall-service-impl'
include 'mall-web'

// 嵌套模块（目录层级）
include 'mall-framework:framework-core'
include 'mall-framework:framework-web'
include 'mall-module-user:user-api'
include 'mall-module-user:user-biz'

// 自定义模块的项目目录
project(':mall-web').projectDir = new File(rootDir, 'web')

// ─── 插件管理（★ Gradle 7+ 推荐，统一插件版本）───
pluginManagement {
    repositories {
        maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
        gradlePluginPortal()
        mavenCentral()
    }
    plugins {
        id 'org.springframework.boot' version '3.2.0'
        id 'io.spring.dependency-management' version '1.1.4'
    }
}

// ─── 依赖解析管理（★ 统一仓库，子模块不用重复配）───
dependencyResolutionManagement {
    // repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)   // 禁止子模块自己声明仓库
    repositories {
        maven { url 'https://maven.aliyun.com/repository/public' }
        mavenCentral()
    }
    // ★ 版本目录（Gradle 7.4+，见下）
    versionCatalogs {
        libs { from(files("gradle/libs.versions.toml")) }
    }
}
```

```toml
# ══════════ gradle/libs.versions.toml（★ 版本目录，统一管理版本）══════════
[versions]
spring-boot = "3.2.0"
mybatis-plus = "3.5.5"
hutool = "5.8.23"
lombok = "1.18.30"
mapstruct = "1.5.5.Final"
guava = "32.1.3-jre"

[libraries]
mybatis-plus = { module = "com.baomidou:mybatis-plus-boot-starter", version.ref = "mybatis-plus" }
hutool-all = { module = "cn.hutool:hutool-all", version.ref = "hutool" }
guava = { module = "com.google.guava:guava", version.ref = "guava" }
mapstruct = { module = "org.mapstruct:mapstruct", version.ref = "mapstruct" }
mapstruct-processor = { module = "org.mapstruct:mapstruct-processor", version.ref = "mapstruct" }
lombok = { module = "org.projectlombok:lombok", version.ref = "lombok" }

# 依赖组（一次引入多个）
mybatis = ["mybatis-plus"]
test-libs = ["org.springframework.boot:spring-boot-starter-test"]

[bundles]                                # ★ 依赖包（组合多个库）
common = ["hutool-all", "guava", "mapstruct"]

[plugins]
spring-boot = { id = "org.springframework.boot", version.ref = "spring-boot" }
```

```groovy
// 子模块中使用版本目录（★ 类型安全的访问器）
dependencies {
    implementation libs.mybatis.plus          // 对应 [libraries] 的 mybatis-plus
    implementation libs.hutool.all
    implementation libs.bundles.common         // ★ 一次引入整个 bundle
    annotationProcessor libs.mapstruct.processor
}
```

**多模块的公共配置（避免重复）：**

```groovy
// ══════════ 方案 1：在 settings.gradle 或根 build.gradle 中用 subprojects ══════════
// 根 build.gradle
subprojects {
    apply plugin: 'java'
    apply plugin: 'io.spring.dependency-management'

    group = rootProject.group
    version = rootProject.version

    java {
        sourceCompatibility = JavaVersion.VERSION_17
    }

    repositories {
        maven { url 'https://maven.aliyun.com/repository/public' }
        mavenCentral()
    }

    dependencies {
        compileOnly 'org.projectlombok:lombok'
        annotationProcessor 'org.projectlombok:lombok'
        testImplementation 'org.springframework.boot:spring-boot-starter-test'
    }

    tasks.withType(JavaCompile).configureEach {
        options.encoding = 'UTF-8'
        options.compilerArgs << '-parameters'
    }

    test { useJUnitPlatform() }
}

// ★ 只有 web 模块应用 Spring Boot 插件（生成可执行 jar）
project(':mall-web') {
    apply plugin: 'org.springframework.boot'
    bootJar { archiveFileName = 'mall.jar' }
}
// 其他模块禁用 bootJar，只生成普通 jar
configure(subprojects.findAll { it.name != 'mall-web' }) {
    tasks.named('bootJar') { enabled = false }
    tasks.named('jar') { enabled = true }
}

// ══════════ 方案 2：buildSrc 约定插件（★ 大型项目推荐）══════════
// buildSrc/src/main/groovy/mall.java-conventions.gradle
plugins {
    id 'java'
}
group = 'com.example'
java { sourceCompatibility = JavaVersion.VERSION_17 }
repositories { mavenCentral() }
tasks.withType(JavaCompile) { options.encoding = 'UTF-8' }
test { useJUnitPlatform() }

// 子模块中使用
plugins {
    id 'mall.java-conventions'         // ★ 一行搞定所有公共配置
}
```

### 4.4 gradle.properties

```properties
# JVM 内存（★ 大型项目必调，否则构建 OOM 或极慢）
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8

# ★★ 性能开关（全部建议开启）
org.gradle.daemon=true                  # 守护进程（默认 true）
org.gradle.parallel=true                # ★ 多模块并行构建
org.gradle.caching=true                 # ★ 构建缓存
org.gradle.configureondemand=true       # 按需配置（只配置需要的模块）
org.gradle.configuration-cache=true     # ★★ 配置缓存（Gradle 8+ 稳定，大幅提速）
org.gradle.configuration-cache.problems=warn

# Kotlin DSL 编译
kotlin.incremental=true
kotlin.code.style=official

# 项目属性（build.gradle 中用 project.xxx 读取）
nexusUser=deploy
nexusPassword=xxx
profilesActive=dev

# Spring Boot / 依赖版本
springBootVersion=3.2.0
```

## 5. Gradle 常用命令

```bash
# ─── 构建 ───
gradle build                        # ★ 完整构建（compile + test + jar）
gradle clean build                  # 清理并构建
gradle assemble                     # 只打包（不跑测试）
gradle bootJar                      # ★ Spring Boot 可执行 jar
gradle jar                          # 普通 jar
gradle build -x test                # ★ 排除测试任务（exclude）
gradle clean build --parallel       # 并行构建
gradle build --build-cache          # 使用构建缓存
gradle build --refresh-dependencies # ★ 强制刷新依赖（等价 mvn -U）
gradle build --offline              # 离线模式
gradle build --scan                 # ★ 生成构建扫描报告（在线分析性能瓶颈）
gradle build --profile              # 生成构建性能报告（build/reports/profile）
gradle build --info / --debug       # 详细日志
gradle build --continue             # 失败后继续（等价 mvn -fae）
gradle build --rerun-tasks          # ★ 忽略 up-to-date，强制重跑所有任务
gradle build --no-build-cache       # 禁用缓存（排查缓存问题时）

# ─── 运行 ───
gradle bootRun                       # ★ 运行 Spring Boot 应用
gradle bootRun --args='--server.port=9090'
gradle bootRun -Dspring-boot.run.profiles=dev
gradle bootRun --debug-jvm           # 远程调试模式（端口 5005）

# ─── 依赖 ───
gradle dependencies                  # ★ 打印依赖树（所有配置）
gradle dependencies --configuration compileClasspath    # 指定配置
gradle dependencyInsight --dependency jackson-databind  # ★ 查看某依赖的来源和版本决策
gradle dependencyInsight --configuration runtimeClasspath --dependency slf4j-api
gradle dependencies --write-locks    # 生成依赖锁文件
gradle --write-verification-metadata sha256    # 生成依赖校验和

# ─── 项目信息 ───
gradle projects                      # 列出所有模块
gradle tasks                         # ★ 列出所有可用任务
gradle tasks --all                   # 含隐藏任务
gradle properties                    # 项目属性
gradle help --task bootJar           # 查看任务详情
gradle -q projects                   # 安静模式

# ─── 发布 ───
gradle publish                       # 发布到配置的仓库
gradle publishToMavenLocal           # ★ 发布到本地 ~/.m2（供其他项目依赖）
gradle bootBuildImage                # ★ 用 Buildpacks 构建 Docker 镜像

# ─── Wrapper（★ 必须提交到 Git）───
gradle wrapper --gradle-version 8.5   # 生成/更新 Wrapper
./gradlew build                       # ★ 用 Wrapper（保证团队版本一致）
./gradlew wrapper --gradle-version 8.6  # 升级 Gradle 版本

# ─── 缓存清理（排查诡异问题）───
gradle --stop                        # 停止守护进程
rm -rf ~/.gradle/caches/build-cache-1 # 清构建缓存
rm -rf ~/.gradle/caches/modules-2     # 清依赖缓存（会重新下载所有依赖）
```

**依赖冲突排查（★ 对应 Maven 的 dependency:tree）：**

```bash
gradle dependencyInsight --configuration runtimeClasspath --dependency jackson-databind
# 输出示例：
# com.fasterxml.jackson.core:jackson-databind:2.16.0
#    variant "runtime" [ ... ]
#    Selection reasons:
#      constraint          : by constraint     ← 被 dependency-management 约束
#      was requested       : by upgrade        ← 版本被提升
#
# com.fasterxml.jackson.core:jackson-databind:2.16.0
# \--- org.springframework.boot:spring-boot-starter-json:3.2.0
#      \--- org.springframework.boot:spring-boot-starter-web:3.2.0
#
# com.fasterxml.jackson.core:jackson-databind:2.15.3 -> 2.16.0
# \--- com.example:legacy-lib:1.0                ← ★ 请求 2.15.3，被提升到 2.16.0
```

## 6. 其他构建工具与选型

| 工具 | 特点 | 现状 |
| --- | --- | --- |
| **Maven** | XML、约定强、生态最广 | ★ **Java 后端主流** |
| **Gradle** | DSL、快、灵活 | ★ Android 强制、大型项目 |
| **Bazel** | Google 出品，超大规模 monorepo、远程执行、极致可重现 | 超大厂（Google、Uber、Twitter） |
| **Buck/Buck2** | Meta 出品，类似 Bazel | Meta 内部 |
| **sbt** | Scala 生态的构建工具 | Scala 项目 |
| **Ant** | 纯脚本，无依赖管理 | 已淘汰 |
| **Ant + Ivy** | Ant 加依赖管理 | 已淘汰 |
| **JBang** | 单文件脚本运行 Java（无需构建配置） | 脚本、原型、CLI 工具 |

```bash
# JBang：无需项目结构，一个 .java 文件直接跑（★ 脚本化利器）
# install: curl -Ls https://sh.jbang.dev | bash -s - app setup
# 单文件应用
///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS com.google.guava:guava:32.1.3-jre       ← 内联声明依赖
//JAVA 17

import com.google.common.collect.ImmutableList;
public class Hello {
    public static void main(String[] args) {
        System.out.println(ImmutableList.of("Hello", "JBang"));
    }
}
# 运行
jbang hello.java                # 自动下载依赖并运行
jbang init hello.java           # 生成模板
jbang app install hello.java    # 安装为命令
```

**选型决策：**

```
是 Android 项目？           → Gradle（唯一选择）
是 Scala 项目？             → sbt
是超大 monorepo（数百模块）？ → Bazel / Buck2（需专门团队维护）
是国内企业 Java 后端？       → ★ Maven（生态、团队熟悉度、招聘）
构建时间成为瓶颈？          → ★ Gradle（增量 + 缓存收益显著）
需要复杂自定义构建逻辑？     → Gradle
写脚本/工具/原型？          → JBang
不确定 / 新项目？           → Maven（除非有明确的 Gradle 需求）
```

## 7. Maven ↔ Gradle 对照速查

| 概念 | Maven | Gradle |
| --- | --- | --- |
| 构建文件 | `pom.xml` | `build.gradle(.kts)` |
| 多模块声明 | `<modules>` | `settings.gradle` 的 `include` |
| 父项目 | `<parent>` | `plugins` / `subprojects` / buildSrc 约定 |
| 坐标 | `groupId:artifactId:version` | `group:name:version` |
| 打包类型 | `<packaging>jar/war/pom</packaging>` | 插件（`java`/`war`） |
| 属性 | `<properties>` | `gradle.properties` / `ext` |
| 仓库 | `<repositories>` | `repositories { }` |
| 依赖版本管理 | `<dependencyManagement>` + BOM | `platform()` / `dependency-management` 插件 / `resolutionStrategy.force` |
| 编译依赖 | `compile` scope | `implementation` / `api` |
| 运行期依赖 | `runtime` | `runtimeOnly` |
| 编译期依赖 | `provided` | `compileOnly` |
| 测试依赖 | `test` | `testImplementation` |
| 注解处理器 | 直接在 classpath | ★ `annotationProcessor`（必须显式） |
| 排除依赖 | `<exclusions>` | `exclude group:, module:` |
| 生命周期 | `clean/compile/test/package/install/deploy` | **任务（Task）** + 依赖图（`build` 依赖 `assemble`+`check`） |
| 插件 | `<plugin>` + `<executions>` | `plugins { }` + `tasks` |
| 本地安装 | `mvn install` | `gradle publishToMavenLocal` |
| 部署 | `mvn deploy` | `gradle publish` |
| 跳过测试 | `-DskipTests` / `-Dmaven.test.skip` | `-x test` |
| 强制更新依赖 | `-U` | `--refresh-dependencies` |
| 依赖树 | `dependency:tree` | `dependencies` / `dependencyInsight` |
| 并行构建 | `-T 4` | `--parallel` |
| 输出目录 | `target/` | `build/` |
| Wrapper | `mvn wrapper:wrapper` → `mvnw` | `gradle wrapper` → `gradlew` |

**一个 Spring Boot 项目的两种写法对比：**

```xml
<!-- Maven: pom.xml（约 60 行） -->
<project>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
  </parent>
  <groupId>com.example</groupId>
  <artifactId>demo</artifactId>
  <version>1.0.0</version>
  <properties><java.version>17</java.version></properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.projectlombok</groupId>
      <artifactId>lombok</artifactId>
      <optional>true</optional>
    </dependency>
    <dependency>
      <groupId>com.mysql</groupId>
      <artifactId>mysql-connector-j</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
        <configuration>
          <excludes>
            <exclude><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId></exclude>
          </excludes>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
```

```groovy
// Gradle: build.gradle（约 20 行，★ 明显更简洁）
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
    id 'io.spring.dependency-management' version '1.1.4'
}
group = 'com.example'
version = '1.0.0'
java { sourceCompatibility = JavaVersion.VERSION_17 }

repositories { mavenCentral() }

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
    runtimeOnly 'com.mysql:mysql-connector-j'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}

tasks.named('test') { useJUnitPlatform() }
```

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 忘记 `annotationProcessor` | Lombok/MapStruct 不生效（找不到 getter） | ★ Gradle 中注解处理器必须单独声明 |
| 2 | 忘记 `useJUnitPlatform()` | JUnit 5 测试不执行（0 个测试） | `test { useJUnitPlatform() }` |
| 3 | 库模块也应用了 boot 插件 | 生成的 jar 无法被其他模块依赖 | 只在启动模块应用；其他模块 `bootJar.enabled=false` |
| 4 | 用 `api` 声明所有依赖 | 增量构建变慢（编译隔离失效） | 默认用 `implementation`，只在公开 API 暴露时用 `api` |
| 5 | 依赖冲突时静默选择 | 运行时 `NoSuchMethodError` | `resolutionStrategy.force` 或 `failOnVersionConflict()` |
| 6 | 未配 `gradle.properties` 内存 | 大项目构建 OOM/极慢 | `org.gradle.jvmargs=-Xmx4g` |
| 7 | 未开并行/缓存 | 构建慢 | `org.gradle.parallel/caching=true` |
| 8 | 未提交 Wrapper | 团队 Gradle 版本不一致 | `gradlew` + `gradle/wrapper/` 提交 Git |
| 9 | `build/` 提交到 Git | 仓库膨胀、冲突 | `.gitignore` 加 `build/`、`.gradle/` |
| 10 | Groovy 脚本运行时错误 | 配置写错但构建到一半才报 | 改用 Kotlin DSL（编译期检查） |
| 11 | 配置缓存与老插件不兼容 | `configuration-cache` 报错 | 升级插件，或临时关闭该开关 |
| 12 | SNAPSHOT 依赖未更新 | 拿到旧版本 | `--refresh-dependencies` 或 `cacheChangingModulesFor 0` |
| 13 | 中文乱码 | 编译报错/输出乱码 | `options.encoding = 'UTF-8'` + `gradle.properties` 设 `-Dfile.encoding=UTF-8` |
| 14 | 未加 `-parameters` | Spring MVC/MyBatis 拿不到参数名 | `options.compilerArgs << '-parameters'` |
| 15 | 依赖 `mavenLocal()` 优先级过高 | 拿到本地过期版本 | 把 `mavenLocal()` 放最后或去掉 |
| 16 | 私服认证信息硬编码 | 密码泄漏到 Git | 用 `gradle.properties`（不提交）或环境变量 |
| 17 | 多模块公共配置重复 | 每个 build.gradle 都写一遍 | `subprojects {}` 或 buildSrc 约定插件 |
| 18 | `jar` 与 `bootJar` 都生成 | 产物混乱 | 禁用 `jar`（应用模块）或禁用 `bootJar`（库模块） |
| 19 | 自定义任务未声明依赖顺序 | 任务在错误时机执行 | `dependsOn` / `finalizedBy` / `mustRunAfter` |
| 20 | 忽略 `--scan` 的性能诊断价值 | 构建慢但找不到原因 | 用 `gradle build --scan` 在线分析 |

---

## 关联笔记

- 上一篇：[[后端/Java工程化与部署/Maven依赖管理与多模块]]
- 下一篇：[[后端/Java工程化与部署/Linux与Java项目部署]]
- 部署：[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]、[[后端/SpringBoot/日志-Actuator与打包部署]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
