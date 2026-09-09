# Gradle 学习路线

Gradle 是新一代构建工具:Maven 用 XML"声明",Gradle 用 **Groovy/Kotlin DSL"编程"**——更简洁、更灵活、更快(**增量构建/构建缓存/守护进程**三件套让速度碾压 Maven),且是 **Android 官方与 Spring 新项目的默认**。**定位**:不是 Maven 的简单替代,而是"构建即代码"的新思维——声明式配置保留简洁,编程能力带来灵活。**学习捷径**:先通关 [Maven](/learning-paths/build-tools/maven)(概念同源:坐标/依赖/生命周期),Gradle 只是"换语法 + 加强度"。

## 第一站:安装、Wrapper 与第一个项目

**安装**:官网/SDKMAN 装 Gradle;验证 `gradle -v`。**Gradle Wrapper(最重要的事,先于一切)**:项目里带 `gradlew` 脚本 + `gradle-wrapper.properties`(版本)——**团队构建版本统一、成员无需装 Gradle;生成方式:`gradle wrapper`;Wrapper 文件必须提交 git**(见 [Git](/learning-paths/tools/git) 章)。
**第一个项目**:`gradle init`(选 application/library);构建脚本两个:`settings.gradle(.kts)`(项目名与模块:include)——与 `build.gradle(.kts)`(构建逻辑);源码目录同 Maven(src/main/java);命令:`gradle build`(全量:编译+测试+打包)/`gradle run`(跑应用,配 mainClass)/`gradle test`。
**Groovy DSL vs Kotlin DSL**:老项目 Groovy(灵活但无类型),**新项目一律 Kotlin DSL(build.gradle.kts:类型安全/IDE 补全/重构友好)——本页以 Kotlin DSL 为准**。

## 第二站:构建脚本语法与配置块

**Kotlin DSL 基础(看着像代码,因为就是代码)**:`plugins &#123; id("java") &#125;`(声明插件)/`repositories &#123; mavenCentral() &#125;`(仓库)/(dependencies &#123; implementation("group:artifact:version") &#125;)(依赖)/`tasks.register&lt;T&gt;("name") &#123; &#125;`(任务)——**字符串插值、类型推断、Lambda 全用上,比 XML 少一半量且编译期检查**。
**配置块(脚本的骨架)**:plugins/repositories/dependencies/tasks/`configurations`(依赖配置管理)/publishing(发布)。**依赖配置(Maven scope 的精细化,必懂)**:`implementation`(本模块编译运行用,**不传递**——默认,Maven compile 的现代替代)/`api`(对外暴露,库项目用——**依赖它的人也能拿到**)/`compileOnly`(≈provided)/`runtimeOnly`/`testImplementation`(测试)/`annotationProcessor`(Lombok 等)——**"implementation vs api"是 Gradle 的经典面试点:库项目对外 API 用到才用 api,否则 implementation(封装性更好、编译更快)**。

## 第三站:任务系统——构建即代码

**任务是 Gradle 的最小执行单元**:`tasks.register("hello") &#123; doLast &#123; println("Hi") &#125; &#125;`;**任务依赖**:dependsOn(先跑它)/finalizedBy(收尾:test 完跑 report);**任务类型(内置常用)**:Copy/Zip/Delete/Exec(执行命令)/JavaCompile——`tasks.register&lt;Copy&gt;("copyRes") &#123; from("src"); into("build") &#125;`;**增量构建(性能核心)**:给自定义任务声明**输入输出注解(@Input/@OutputFile)**——**输入输出没变,任务标记 UP-TO-DATE 直接跳过**:Gradle 快的一半秘密在这里(另一半是缓存与守护进程)。**自定义任务进阶**:继承 DefaultTask + @TaskAction(写插件级任务才需要)。

## 第四站:依赖管理进阶

**依赖类型**:外部(坐标)/**项目依赖 `implementation(project(":module"))`**(多模块)/文件依赖(files("libs/x.jar")——少用)。**版本管理三件套**:①`platform("org.springframework.boot:spring-boot-dependencies:3.x")`(导入 BOM 锁版本,同 Maven 的 dependencyManagement)/enforcedPlatform(强制);②**Version Catalog(版本目录,Gradle 7+ 现代标准)**:`gradle/libs.versions.toml` 集中管版本(`[versions]` + `[libraries]`),脚本里 `implementation(libs.spring.web)`——**全项目版本单一来源,IDE 补全友好**;③依赖约束 constraints(进阶)。
**冲突解决**:默认**取最高版本**(与 Maven 的就近不同);排查:`gradle dependencies`(依赖树)/`gradle dependencyInsight --dependency xxx`(某个依赖为什么是这个版本——**冲突排查神器**);排除 exclude/强制 force。
**依赖纪律同 Maven**:别用动态版本、锁定可复现、定期查漏洞。

## 第五站:多项目构建

**结构**:根 `settings.gradle.kts` 里 `include(":common", ":service", ":web")`;根与子项目各有 build.gradle.kts;**共享配置两种姿势**:`subprojects &#123; &#125;`/`allprojects &#123; &#125;`(简单粗暴,老写法)与**约定插件(现代推荐:在 buildSrc 或独立构建里定义插件,子项目 `plugins &#123; id("my-conventions") &#125;` 一行套用——**"一处定义,处处复用"的构建逻辑共享**)**;模块依赖 `implementation(project(":common"))`;**构建顺序**:Gradle 自动按依赖拓扑排序 + **按需构建(只构建被请求的模块)**;加速:`--parallel`(多模块并行)/`--configuration-cache`(缓存配置阶段,重复构建极大提速——**新版默认推进中**)。

## 第六站:实战:Java/Spring/Android 项目

**Java 插件三选**:`java`(基础)/`java-library`(库项目:解锁 api 配置)/`application`(可执行:mainClass);Java 版本:`java &#123; toolchain &#123; languageVersion = JavaLanguageVersion.of(17) &#125; &#125;`(toolchain:自动找/装对应 JDK——现代姿势);**测试**:`tasks.test &#123; useJUnitPlatform() &#125;`(JUnit5)/useTestNG;**Spring Boot**:插件 `id("org.springframework.boot")` + `id("io.spring.dependency-management")`——**bootJar 出可执行 jar**(见 [Spring Boot](/learning-paths/backend/spring-boot) 部署章);**Android(Android 的官方构建就是 Gradle)**:`com.android.application` 插件 + compileSdk/minSdk/buildTypes(debug/release)/productFlavors(渠道风味:免费/付费 → 变体矩阵)/signingConfigs(签名,密码走环境变量——**别提交仓库**)/R8 混淆(minifyEnabled,配 mapping 文件)。
**发布**:maven-publish 插件(publications + repositories——发私服/中央,配 signing 签名)。

## 第七站:性能优化——Gradle 快在哪

**四板斧(面试/优化必答)**:①**增量构建**:任务声明输入输出,不变即 UP-TO-DATE 跳过(见第三站);②**构建缓存(--build-cache)**:任务结果按输入哈希缓存——**换分支/清目录后还能命中**(CI 与本地共享);③**守护进程(默认开)**:后台常驻 JVM,免每次启动开销(`gradle --stop` 停);④**配置缓存(--configuration-cache)**:配置阶段只跑一次——**大项目从"每次等配置"到"秒级"**。辅助:并行(--parallel)/离线(--offline)/`gradle build --scan`(构建扫描:性能分析报告——**"构建慢"用数据说话**)。**质量插件**:checkstyle/pmd/jacoco(覆盖率)/SonarQube/detekt(Kotlin)。

## 第八站:CI、Docker 与最佳实践

**CI(GitHub Actions)**:官方 `gradle/gradle-build-action`(含缓存:依赖与构建缓存都命中——**CI 构建速度的钥匙**)+ `./gradlew build`(Wrapper 保证版本一致,见 [CI](/learning-paths/devops/github-actions));**Docker 多阶段**:gradle 镜像构建 → 精简 JRE 运行(见 [Docker](/learning-paths/devops/docker));**最佳实践清单**:①**Wrapper 提交 git,缓存目录(.gradle/build)忽略**;②Kotlin DSL + Version Catalog + 约定插件(现代三件套);③依赖最小化与锁定(gradle.lockfile 可复现);④构建脚本别硬编码(属性/环境变量);⑤**大项目开启 build-cache + configuration-cache**。
**学习资源**:官方文档(Getting Started 系列是业内公认好教程)、Gradle 插件门户、Android 项目的 build.gradle 是最好范本。

## 通关标准

能独立做到:用 Kotlin DSL + Version Catalog 建多模块项目(插件/依赖/共享配置组织清晰);说清 implementation/api 区别与增量构建原理(输入输出);用 dependencyInsight 解决一次冲突、用 --build-cache 让 CI 提速;给 Spring Boot 项目配好 bootJar 与发布;理解 Wrapper 与配置缓存的必要性——Gradle 主线通关。

Gradle 的学习曲线比 Maven 陡(它首先是门"小语言"),但掌握后**构建从负担变成可编程的能力**:任务、缓存、约定插件——你想让构建做什么,它都能表达。**学习顺序建议:先 Maven 懂概念,再 Gradle 学表达**;新项目(尤其 Spring Boot 3+/Android)直接 Gradle + Kotlin DSL,老项目 Maven 维护也不慌——**双修是 Java 构建的完整形态**。下一步:版本目录与多模块实战见 [Spring Boot](/learning-paths/backend/spring-boot),构建之外看 [Make](/learning-paths/build-tools/make) 认识另一种构建哲学。
