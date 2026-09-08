# Gradle 学习路线

Gradle 是新一代的项目自动化构建工具，以灵活性和性能著称。相比 Maven 的 XML 配置，Gradle 使用 Groovy 或 Kotlin DSL，更简洁、更强大。增量构建、构建缓存、守护进程让构建速度飞起，插件生态丰富，从 Android 到 Spring Boot，Gradle 正在成为 Java 生态的新标准。

## 基础篇：入门与安装

### Gradle 特点
- 声明式构建：DSL（Domain Specific Language）
- 灵活性：Groovy/Kotlin 编程能力
- 高性能：增量构建、构建缓存、守护进程
- 多语言支持：Java、Kotlin、Groovy、Scala、C++、Android
- 依赖管理：兼容 Maven/Ivy 仓库
- 插件生态：丰富的官方和社区插件

### 安装配置
- 下载：Gradle 官网或 SDKMAN
- Gradle Wrapper：推荐方式，项目内嵌版本
- 环境变量：GRADLE_HOME、PATH
- 验证安装：gradle -v
- 配置文件：gradle.properties、settings.gradle、build.gradle
- 本地仓库：~/.gradle/caches

### Gradle Wrapper
- gradlew：Unix/Linux/Mac 包装脚本
- gradlew.bat：Windows 包装脚本
- gradle-wrapper.properties：版本配置
- 优势：统一团队版本、无需安装 Gradle
- 生成 Wrapper：gradle wrapper

### 第一个项目
- 初始化：gradle init
- 项目类型：basic、application、library
- 构建脚本：build.gradle 或 build.gradle.kts
- 源码目录：src/main/java、src/test/java
- 编译：gradle build
- 运行：gradle run

## 基础篇：Groovy DSL 基础

### 基本语法
- 声明插件：plugins { id 'java' }
- 仓库配置：repositories { mavenCentral() }
- 依赖声明：dependencies { implementation 'group:artifact:version' }
- 任务定义：task myTask { doLast { println 'Hello' } }
- 属性：project.version、project.group

### 依赖配置
- implementation：编译和运行时依赖
- api：对外暴露的依赖（库项目）
- compileOnly：仅编译时依赖（provided）
- runtimeOnly：仅运行时依赖
- testImplementation：测试依赖
- annotationProcessor：注解处理器

### 配置块
- plugins：插件声明
- repositories：仓库配置
- dependencies：依赖管理
- tasks：任务配置
- configurations：配置管理
- publishing：发布配置

### 闭包与委托
- 闭包：{ } 代码块
- 委托对象：闭包内的 this
- it 参数：单参数闭包
- 链式调用：配置风格

## 基础篇：Kotlin DSL 基础

### Kotlin DSL 优势
- 类型安全：编译时检查
- IDE 支持：更好的自动补全
- 重构友好：重命名、查找引用
- Kotlin 语法：更现代、更简洁
- 文件扩展名：build.gradle.kts

### 基本语法
- 插件声明：plugins { kotlin("jvm") version "1.9.0" }
- 字符串插值：$variable
- 类型推断：val、var
- Lambda：{ } 尾随 Lambda
- 扩展函数：`tasks.register<JavaCompile>("compile")`

### 依赖声明
- 字符串语法：implementation("group:artifact:version")
- 命名参数：implementation(group = "...", name = "...", version = "...")
- 依赖约束：constraints { }
- 平台依赖：platform("...")

### 迁移 Groovy 到 Kotlin
- 单引号改双引号
- def 改 val/var
- = 赋值改属性访问
- 方法调用加括号
- 字符串插值：${}

## 基础篇：任务系统

### 任务基础
- 定义任务：task myTask
- 配置任务：doFirst、doLast
- 依赖任务：dependsOn
- 任务类型：Copy、Zip、Delete、JavaCompile
- 任务执行：gradle taskName

### 任务依赖
- dependsOn：依赖其他任务
- mustRunAfter：顺序约束
- shouldRunAfter：建议顺序
- finalizedBy：收尾任务
- 隐式依赖：输入输出关系

### 任务输入输出
- @Input：输入属性
- @InputFile：输入文件
- @InputDirectory：输入目录
- @OutputFile：输出文件
- @OutputDirectory：输出目录
- 增量构建：输入输出未变则跳过

### 任务类型
- Copy：复制文件
- Sync：同步目录
- Zip/Tar：压缩
- Delete：删除文件
- Exec：执行命令
- JavaCompile：编译 Java

### 自定义任务
- 继承 DefaultTask
- @TaskAction 注解
- 输入输出声明
- 任务组：group、description
- 注册任务：tasks.register()

## 进阶篇：依赖管理

### 依赖声明
- 外部依赖：implementation 'group:artifact:version'
- 项目依赖：implementation project(':module')
- 文件依赖：implementation files('libs/lib.jar')
- 目录依赖：implementation fileTree(dir: 'libs', include: '*.jar')
- Gradle 依赖：gradleApi()

### 依赖配置
- implementation：编译、运行时，不传递给消费者
- api：编译、运行时，传递给消费者（库项目）
- compileOnly：仅编译，类似 Maven provided
- runtimeOnly：仅运行时
- testImplementation、testCompileOnly、testRuntimeOnly

### 依赖约束
- 版本范围：[1.0, 2.0)、1.+、latest.release
- 动态版本：不推荐，影响可重复构建
- 严格版本：strictly '1.0'
- 排除依赖：exclude group: '...', module: '...'
- 替换依赖：依赖替换规则

### 依赖解析
- 冲突解决：默认最新版本
- 强制版本：force = true
- 查看依赖树：gradle dependencies
- 依赖洞察：gradle dependencyInsight --dependency xxx
- 失败策略：failOnVersionConflict()

### BOM 与平台
- platform：导入 BOM（Bill of Materials）
- enforcedPlatform：强制平台版本
- Spring Boot BOM：统一 Spring 依赖版本
- 版本目录：libs.versions.toml（Gradle 7.0+）

## 进阶篇：多项目构建

### 项目结构
- 根项目：settings.gradle、build.gradle
- 子项目：各自的 build.gradle
- 包含子项目：include ':module1', ':module2'
- 嵌套项目：include ':parent:child'

### settings.gradle
- rootProject.name：根项目名称
- include：包含子项目
- includeBuild：复合构建
- pluginManagement：插件仓库配置
- dependencyResolutionManagement：依赖仓库配置

### 子项目配置
- allprojects：配置所有项目（包括根项目）
- subprojects：配置所有子项目
- project(':module')：配置特定子项目
- 共享配置：插件、依赖、任务

### 项目依赖
- implementation project(':module')：依赖其他子项目
- api project(':module')：传递依赖
- 循环依赖：避免，重构模块划分
- 依赖图：gradle dependencies

### 构建顺序
- 自动分析：Gradle 分析依赖关系
- 按需构建：只构建需要的模块
- 并行构建：--parallel 参数
- 配置缓存：--configuration-cache

## 进阶篇：插件开发

### 插件类型
- 脚本插件：build.gradle 中定义
- 二进制插件：独立项目，可发布
- 约定插件：buildSrc 目录
- 社区插件：插件门户

### 应用插件
- plugins 块：plugins { id 'java' }
- apply 方法：apply plugin: 'java'
- 版本指定：plugins { id 'xxx' version '1.0' }
- 插件仓库：pluginManagement

### buildSrc 约定
- 特殊目录：buildSrc/src/main/groovy
- 自动编译：项目构建前编译
- 类型安全：Kotlin DSL 编写
- 版本管理：统一依赖版本
- 约定插件：共享构建逻辑

### 自定义插件
- 实现 `Plugin<Project>`
- apply 方法：插件逻辑
- 注册扩展：extensions.create
- 注册任务：tasks.register
- 发布插件：gradle-plugin-publish

### 插件扩展
- Extension：配置对象
- 嵌套配置：NamedDomainObjectContainer
- 惰性配置：Provider API
- 配置缓存：支持 Configuration Cache

## 实战篇：Java 项目

### Java 插件
- java：基础 Java 支持
- java-library：库项目（api 配置）
- application：可执行应用（mainClass）
- sourceCompatibility、targetCompatibility：Java 版本
- 源码集：main、test

### 源码集
- main：src/main/java、src/main/resources
- test：src/test/java、src/test/resources
- 自定义源码集：sourceSets { integrationTest { } }
- 源码目录：java.srcDirs、resources.srcDirs
- 输出目录：output.classesDirs

### 测试配置
- test 任务：运行单元测试
- useJUnitPlatform()：JUnit 5
- useJUnit()：JUnit 4
- useTestNG()：TestNG
- 测试选项：maxParallelForks、forkEvery

### 打包配置
- jar 任务：打包 jar
- manifest：MANIFEST.MF 配置
- fatJar：包含依赖的 jar（shadow 插件）
- bootJar：Spring Boot 可执行 jar
- 排除文件：exclude

### 发布配置
- maven-publish 插件
- publications：发布产物
- repositories：发布仓库
- POM 配置：groupId、artifactId、version
- 签名：signing 插件

## 实战篇：Android 项目

### Android 插件
- com.android.application：应用
- com.android.library：库
- compileSdk：编译 SDK 版本
- minSdk、targetSdk：版本范围
- buildTypes：debug、release

### 构建变体
- buildTypes：构建类型（debug、release）
- productFlavors：产品风味（free、paid）
- 变体：flavor + buildType（freeDebug）
- 维度：flavorDimensions
- 配置差异：applicationId、versionName

### 依赖管理
- implementation：私有依赖
- api：传递依赖
- debugImplementation：debug 专用
- releaseImplementation：release 专用
- kapt：Kotlin 注解处理

### 签名配置
- signingConfigs：签名配置
- keystore：密钥库文件
- storePassword、keyPassword：密码
- buildTypes：关联签名配置
- 环境变量：敏感信息

### ProGuard/R8
- minifyEnabled：代码混淆
- shrinkResources：资源压缩
- proguardFiles：混淆规则
- R8：默认优化器
- 调试混淆后代码：mapping.txt

## 实战篇：性能优化

### 增量构建
- 任务输入输出：声明依赖
- UP-TO-DATE：跳过未变任务
- 缓存：本地构建缓存
- 避免重复工作

### 构建缓存
- --build-cache：启用构建缓存
- org.gradle.caching：gradle.properties 配置
- 本地缓存：~/.gradle/caches/build-cache-1
- 远程缓存：Gradle Enterprise
- 缓存 key：输入哈希

### Gradle 守护进程
- 默认启用：后台常驻进程
- 加速启动：避免 JVM 启动开销
- 共享缓存：多次构建共享
- 停止守护进程：gradle --stop
- 配置：org.gradle.daemon=true

### 并行执行
- --parallel：并行执行任务
- maxWorkers：最大并行数
- 项目隔离：解耦依赖
- 适用场景：多模块项目

### 配置缓存
- --configuration-cache：缓存配置阶段
- 极大提速：跳过配置阶段
- 兼容性：插件需支持
- 调试：--configuration-cache-problems=warn

### 依赖优化
- 版本目录：统一版本管理
- 依赖锁定：lockfile
- 减少动态版本：避免网络检查
- 排除不需要的依赖

## 实战篇：CI/CD 集成

### GitHub Actions
- setup-java：配置 JDK
- cache：缓存 Gradle 依赖
- gradle-build-action：官方 Action
- ./gradlew build：构建项目
- 上传产物：actions/upload-artifact

### Docker 构建
- Gradle 镜像：gradle:8-jdk17
- 多阶段构建：构建 + 运行
- 缓存优化：分层复制文件
- .dockerignore：排除缓存目录

### 构建扫描
- --scan：生成构建扫描
- Gradle Enterprise：性能分析
- 失败诊断：构建历史
- 团队协作：分享扫描链接

### 质量检查
- checkstyle：代码规范
- pmd：代码质量
- jacoco：覆盖率
- SonarQube：综合分析
- detekt：Kotlin 静态分析

## 实战篇：最佳实践

### 项目组织
- buildSrc：共享构建逻辑
- 约定插件：复用配置
- 版本目录：libs.versions.toml
- 多模块：合理划分
- 单一职责：模块清晰

### 依赖管理
- 版本统一：版本目录或 buildSrc
- BOM：Spring、Kotlin 平台
- 依赖锁定：可重复构建
- 排除传递依赖：减少冲突
- 定期更新：安全漏洞修复

### 构建脚本
- Kotlin DSL：类型安全
- 插件版本：插件门户最新版本
- 避免硬编码：用属性
- 文档注释：复杂逻辑说明
- 可读性：清晰的命名

### 性能优化
- 构建缓存：开启本地和远程
- 并行构建：多模块项目
- 配置缓存：减少配置时间
- 增量构建：声明输入输出
- Gradle 守护进程：默认开启

### 版本控制
- 提交 Wrapper：gradlew、gradle-wrapper.jar
- 忽略缓存：.gradle、build/
- 锁定版本：gradle.lockfile
- settings.gradle：版本控制

## 下一步学习

掌握 Gradle 后，可以探索更多构建生态：

- **Gradle Enterprise** - 构建扫描、性能分析
- **JReleaser** - 自动化发布工具
- **Version Catalog** - Gradle 7+ 依赖管理新方式
- **Composite Builds** - 复合构建，多项目协作
- **Kotlin Multiplatform** - 跨平台 Kotlin 项目
- **Gradle Plugin Portal** - 探索社区插件

Gradle 是构建工具的未来。它不是 Maven 的简单替代，而是新一代的思维方式。声明式配置保留了简洁性，编程能力带来了灵活性，增量构建和缓存让速度飞起。从 Android 到 Spring Boot，从微服务到桌面应用，Gradle 无处不在。记住，Gradle 的学习曲线比 Maven 陡峭，但一旦掌握，你会发现它的强大。有了 Gradle，构建不再是负担，而是享受。
