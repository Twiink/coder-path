# Maven 学习路线

Maven 是 Java 生态的**项目管理与构建工具的事实标准**:以"**约定优于配置**"统一了项目结构、依赖管理、构建流程与打包发布——**Java 开发者(尤其 Spring 系)的必修课**。虽然 Gradle 后来居上(更灵活更快),但 Maven 的成熟度、稳定性与生态(几乎所有 Java 库都在 Maven 中央仓库)让它依然不可替代。**心智先行**:Maven 不是"构建脚本",是"**项目对象模型(POM)+ 生命周期 + 插件**"三件事——理解这三样,Maven 对你就是透明的。

## 第一站:核心概念与第一个项目

**三件套先记牢**:①**POM(pom.xml)**:项目的"身份证+说明书"——坐标、依赖、构建配置全在这一个 XML 里;②**坐标系统**:`groupId`(组织,域名倒写:com.example)+ `artifactId`(项目名)+ `version`(版本:1.0.0 正式/1.0.0-SNAPSHOT 开发中)——**仓库里唯一定位一个库的三元组**;③**生命周期**:一串固定阶段,`clean`(清理)/`default`(构建:validate→compile→**test**→package→verify→install(装本地仓库)→deploy(传远程))/`site`(文档)——**你执行的每个命令(mvn test/package)都是"跑到某个阶段为止"**。**安装与配置**:官网下载解压 + 环境变量;`mvn -v` 验证;**settings.xml**(用户级 ~/.m2/settings.xml:镜像/私服/本地仓库路径——**国内必配阿里云镜像,否则下载慢到怀疑人生**)。**第一个项目**:标准目录结构——`src/main/java`(代码)/`src/main/resources`(资源)/`src/test/java`(测试)/`pom.xml`;常用命令:`mvn compile`(编译)/`mvn test`(跑测试)/`mvn package`(打包 jar——**配了 Spring Boot 插件才是可执行 jar**)/`mvn clean`(清 target)/`mvn install`。

## 第二站:依赖管理——Maven 的核心价值

**声明依赖**:`<dependency>` 里写坐标 + **scope(依赖范围,必懂)**:`compile`(默认:编译测试运行都要)/`test`(仅测试:JUnit/Mockito)/`provided`(编译测试要、运行由容器给:Servlet API——**打 war 时不会打进去**)/`runtime`(运行才要:JDBC 驱动)。**传递依赖(传递性的来源)**:A 依赖 B、B 依赖 C → A 自动拿到 C——**省事也埋雷:冲突**;解决冲突的**就近原则**(路径短的赢)与第一声明原则;**查依赖树 `mvn dependency:tree`(冲突排查第一命令)**,`exclusions` 排除多余传递依赖。**版本统一三板斧(大型项目必用)**:①`<properties>` 定义版本变量(`${spring.version}`)②**`dependencyManagement`**(父 POM 里锁版本,子模块只声明坐标不写版本——**全项目版本单一来源**;Spring Boot/Spring Cloud 的 BOM 就是它:import 一个 BOM = 全家依赖版本被锁定)③子模块继承父 POM。**依赖纪律**:别用 LATEST/RELEASE(不可复现)、最小化依赖、定期查漏洞(见质量章)。

## 第三站:生命周期与插件机制

**Maven 的构建能力全在插件**:生命周期阶段只是"时机",真正干活的是**绑定到阶段的插件 goal**(如 compile 阶段绑 maven-compiler-plugin 的 compile goal)——**想定制构建 = 配插件**。**必配插件清单**:`maven-compiler-plugin`(Java 版本:source/target/release + encoding=UTF-8——**Java 9+ 用 release 更正确**)、`maven-surefire-plugin`(跑 JUnit 单元测试:默认自动发现 *Test 类;skip 参数跳过)、`maven-failsafe-plugin`(集成测试,独立于单测)、打包三兄弟(jar-plugin/war-plugin/assembly(自定义压缩包)/**shade(fat jar:依赖打进一个 jar——工具类分发用)**)、source/javadoc 插件(发布到仓库要带 sources.jar);**Spring Boot 项目加 `spring-boot-maven-plugin`**:repackage 出**可执行 jar(内嵌 Tomcat,`java -jar` 直接跑)**——现代 Spring 部署的标准形态(见 [Spring Boot](/learning-paths/backend/spring-boot) 部署章)。**配置方式**:插件 `<configuration>` 块、`<executions>` 绑到特定阶段多次执行。

## 第四站:多模块项目——大型项目的骨架

**多模块 = 聚合 + 继承**:父项目 `packaging: pom` + `<modules>` 列出子模块(聚合:一条命令 `mvn install` 按依赖拓扑顺序构建全部);子模块 `<parent>` 指向父 POM(**继承:共享依赖管理/插件管理/属性**)——**"聚合管构建顺序,继承管配置复用",两者通常合一**。典型结构:父 pom + common/domain/service/web 各子模块,模块间互相依赖(web 依赖 service);依赖管理放父 POM 的 dependencyManagement,子模块不写版本——**改版本只改一处,全项目一致**;插件管理同理(pluginManagement)。**构建加速**:`-T 1C`(按核数并行)、`-o`(离线)、`-DskipTests`(跳过测试,调试用)。

## 第五站:Profile 与环境——一套代码多环境

**问题**:开发/测试/生产的数据源、配置不同——**Profile 让构建按环境切换**:pom 里定义 `<profiles>`(id: dev/prod),激活方式:命令行 `-P prod`、默认激活、按 JDK/OS/文件存在自动激活;配合**资源过滤**(`<resources><filtering>true</filtering>`):资源文件里的 `${env}` 占位符在打包时被替换——**application.properties 用占位符,不同 profile 注入不同值,打出的包自带环境配置**(更现代的做法:配置外置/环境变量注入,见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 配置章——Profile 管"构建时",环境变量管"运行时")。

## 第六站:仓库与私服

**仓库三级**:本地(~/.m2/repository:下载过的都在这,删了会重新下)/中央仓库(Maven Central:公共库的家)/**私服(公司内 Nexus/Artifactory:托管内部库 + 代理中央加速)**——**查找顺序:本地 → 私服 → 中央**。**配置**:settings.xml 的 `<mirrors>`(镜像:阿里云加速)/`<servers>`(私服认证:账号密码放 settings 别放 pom——**settings.xml 含密码,别提交 git**);发布用 `<distributionManagement>`(release 与 snapshot 仓库分开)+ `mvn deploy`。**Nexus 三种仓库**:hosted(内部构件)/proxy(代理中央)/group(聚合)——团队标配。

## 第七站:常用命令与实战技巧

**命令速查**:`mvn clean verify`(CI 标准:完整验证);`mvn dependency:tree/analyze`(依赖树与"未使用/未声明"分析——**analyze 帮你瘦身**);`mvn help:effective-pom`(看继承合并后的真实 POM——**排查"配置为什么不生效"神器**);`mvn versions:display-dependency-updates`(查依赖新版本)。**发布流程**:SNAPSHOT(开发,可覆盖)vs RELEASE(正式,不可变);`mvn release:prepare/perform`(自动升版本+打 Git 标签+发布——或走 CI 的语义化发布,见 [GitHub Actions](/learning-paths/devops/github-actions))。**质量插件**:checkstyle(规范)/pmd(静态分析)/**jacoco(覆盖率——CI 卡阈值,见 [JUnit](/learning-paths/testing/junit))**/SonarQube(综合质量门禁)。**Docker 集成**:多阶段构建(maven 镜像编译 → 精简 JRE 镜像运行——见 [Docker](/learning-paths/devops/docker))。**Maven Wrapper**(mvnw:项目内嵌 Maven 版本——**团队构建版本一致,推荐新项目带上**)。

## 通关标准

能独立做到:从零建一个多模块 Spring Boot 项目(父 POM 管依赖版本、子模块按层拆分),一条命令全量构建;用 dependencyManagement + properties 管住版本并会用 dependency:tree 解决一次冲突;理解生命周期阶段与插件 goal 的关系,配好 compiler/surefire/spring-boot 三插件;用 Profile + 资源过滤区分环境配置;配好私服/镜像并知道 settings.xml 的安全红线;在 CI 里跑 mvn clean verify + 覆盖率——Maven 主线通关。

Maven 是 Java 世界的"**标准化基础设施**":XML 冗长、构建不快,但它用"约定"换来了**全行业统一的项目形态**——任何 Java 项目打开就知道结构、依赖、构建方式。**理解生命周期、掌握依赖管理、善用 Profile 与多模块**,Maven 就从"报错看不懂"变成"构建尽在掌握";它也是理解 Gradle 的最佳跳板(概念同源,语法不同)。下一步:灵活与速度派看 [Gradle](/learning-paths/build-tools/gradle),Java 部署全链见 [Spring Boot](/learning-paths/backend/spring-boot)。
