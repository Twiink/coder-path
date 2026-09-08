# Maven 学习路线

Maven 是 Java 生态的项目管理和构建工具，以"约定优于配置"著称。通过 XML 配置和标准目录结构，Maven 统一了 Java 项目的构建流程、依赖管理、测试运行、打包部署。虽然 Gradle 后来居上，但 Maven 的成熟度、稳定性和生态系统依然无可替代，是 Java 开发者的必修课。

## 基础篇：入门与安装

### Maven 核心概念
- 项目对象模型：POM（Project Object Model）
- 坐标系统：groupId、artifactId、version
- 生命周期：clean、default、site
- 插件机制：goal 绑定到 phase
- 依赖管理：传递依赖、依赖范围
- 仓库：本地仓库、中央仓库、私服

### 安装配置
- 下载：Apache Maven 官网
- 环境变量：M2_HOME、PATH
- 验证安装：mvn -version
- 配置文件：settings.xml（全局、用户级）
- 本地仓库：默认 ~/.m2/repository
- 镜像配置：国内镜像加速（阿里云）

### 第一个项目
- 创建项目：mvn archetype:generate
- Archetype：项目模板（quickstart、webapp）
- 目录结构：src/main/java、src/test/java、pom.xml
- 编译：mvn compile
- 测试：mvn test
- 打包：mvn package
- 运行：java -jar target/*.jar

### POM 文件结构
- 基本信息：groupId、artifactId、version、packaging
- 项目信息：name、description、url
- 依赖：dependencies
- 构建配置：build
- 插件：plugins
- 父 POM：parent、继承

## 基础篇：依赖管理

### 坐标系统
- groupId：组织/公司域名倒序（com.example）
- artifactId：项目名称（myapp）
- version：版本号（1.0.0-SNAPSHOT）
- packaging：打包类型（jar、war、pom）
- classifier：附加分类器（javadoc、sources）

### 依赖声明
- dependency：依赖项
- scope：依赖范围（compile、test、provided、runtime、system）
- optional：可选依赖
- exclusions：排除传递依赖
- 版本管理：固定版本 vs 范围版本

### 依赖范围
- compile：编译、测试、运行（默认）
- test：仅测试（JUnit、Mockito）
- provided：编译、测试，运行时由容器提供（Servlet API）
- runtime：测试、运行，编译不需要（JDBC 驱动）
- system：类似 provided，需要显式指定路径（不推荐）
- import：仅用于 dependencyManagement（BOM）

### 传递依赖
- 自动引入：A 依赖 B，B 依赖 C，则 A 自动依赖 C
- 依赖冲突：就近原则、第一声明原则
- 排除依赖：exclusions 避免冲突
- 查看依赖树：mvn dependency:tree

### 依赖管理
- dependencyManagement：统一版本管理（父 POM）
- 子模块继承：不声明 version
- BOM：Bill of Materials（Spring Boot、Spring Cloud）
- 版本属性：properties 统一定义

## 基础篇：生命周期与插件

### 三大生命周期
- clean：清理项目（pre-clean、clean、post-clean）
- default：构建项目（compile、test、package、install、deploy）
- site：生成站点文档（pre-site、site、post-site、site-deploy）

### Default 生命周期
- validate：验证项目正确性
- compile：编译源代码
- test：运行单元测试
- package：打包（jar、war）
- verify：验证包有效性
- install：安装到本地仓库
- deploy：部署到远程仓库

### 插件与 Goal
- 插件：plugin（maven-compiler-plugin）
- Goal：插件目标（compile:compile）
- 绑定：phase 和 goal 的关联
- 配置：configuration 块
- 执行：execution 定义多次执行

### 常用插件
- maven-compiler-plugin：编译源码（指定 Java 版本）
- maven-surefire-plugin：运行单元测试
- maven-jar-plugin：打包 jar
- maven-war-plugin：打包 war
- maven-resources-plugin：资源文件复制
- maven-clean-plugin：清理目标目录
- maven-install-plugin：安装到本地仓库
- maven-deploy-plugin：部署到远程仓库

## 进阶篇：多模块项目

### 项目结构
- 父项目：packaging 为 pom
- 子模块：modules 声明
- 聚合：一次构建所有模块
- 继承：子模块继承父 POM 配置
- 目录组织：parent/module1、parent/module2

### 聚合与继承
- 聚合：modules 列表，统一构建
- 继承：parent 引用，共享配置
- 区别：聚合是容器，继承是复用
- 通常结合使用

### 依赖管理
- 父 POM：dependencyManagement 统一版本
- 子模块：只声明 groupId 和 artifactId
- 模块间依赖：子模块互相依赖
- 版本一致性：避免版本冲突

### 插件管理
- pluginManagement：统一插件配置
- 子模块继承：减少重复
- 版本锁定：避免插件版本不一致

### 构建顺序
- 自动分析：Maven 分析依赖关系
- 拓扑排序：依赖的模块先构建
- 并行构建：-T 参数（如 -T 4）

## 进阶篇：Profile 与环境

### Profile 概念
- 构建配置切换：开发、测试、生产
- 激活条件：手动、环境变量、文件存在、操作系统
- 配置覆盖：依赖、插件、属性

### 定义 Profile
- 位置：pom.xml、settings.xml
- id：唯一标识
- activation：激活条件
- properties：环境变量
- dependencies：环境特定依赖
- build：构建配置

### 激活 Profile
- 命令行：-P profileId
- 默认激活：activeByDefault
- 环境变量：MAVEN_OPTS
- JDK 版本：jdk 匹配
- 操作系统：os 匹配
- 文件存在：file exists/missing

### 资源过滤
- filtering：true 开启
- 占位符：${property}
- 资源目录：src/main/resources
- 环境配置：application-dev.properties
- 打包时替换：不同环境不同配置

## 进阶篇：仓库管理

### 仓库类型
- 本地仓库：~/.m2/repository
- 中央仓库：Maven Central（https://repo.maven.apache.org/maven2/）
- 私服：Nexus、Artifactory
- 远程仓库：公司内部、第三方

### 仓库配置
- settings.xml：mirrors、servers、repositories
- pom.xml：repositories、pluginRepositories
- 优先级：本地 > 私服 > 中央

### 镜像配置
- mirror：加速下载
- mirrorOf：匹配仓库（*、central、repo1）
- 阿里云镜像：https://maven.aliyun.com/repository/public
- 腾讯云镜像：https://mirrors.cloud.tencent.com/nexus/repository/maven-public/

### 部署到私服
- distributionManagement：发布配置
- repository：release 仓库
- snapshotRepository：snapshot 仓库
- server：settings.xml 中配置认证
- mvn deploy：上传到私服

### 私服管理
- Nexus：流行的私服工具
- 仓库类型：hosted、proxy、group
- 代理中央仓库：加速下载
- 存储内部依赖：闭源组件

## 实战篇：常用插件详解

### 编译插件
- maven-compiler-plugin
- source、target：Java 版本
- release：Java 9+ 新参数
- encoding：字符编码（UTF-8）
- compilerArgs：额外编译参数

### 测试插件
- maven-surefire-plugin：单元测试
- maven-failsafe-plugin：集成测试
- skip：跳过测试
- includes/excludes：测试类过滤
- argLine：JVM 参数
- reportsDirectory：测试报告目录

### 打包插件
- maven-jar-plugin：jar 打包
- manifest：MANIFEST.MF 配置
- mainClass：主类
- maven-war-plugin：war 打包
- maven-assembly-plugin：自定义打包（zip、tar.gz）
- maven-shade-plugin：fat jar（依赖打包）

### 资源插件
- maven-resources-plugin
- filtering：资源过滤
- includes/excludes：文件过滤
- 复制资源：到 target 目录

### 源码与文档
- maven-source-plugin：打包源码
- maven-javadoc-plugin：生成 Javadoc
- attach：附加到构建产物
- 发布到仓库：sources.jar、javadoc.jar

### Spring Boot 插件
- spring-boot-maven-plugin
- repackage：打包可执行 jar
- 内嵌 Tomcat：直接运行
- mainClass：指定主类
- 分层打包：Docker 优化

## 实战篇：依赖管理技巧

### 版本管理
- properties：统一定义版本号
- ${spring.version}：引用属性
- BOM：Spring Boot、Spring Cloud
- dependencyManagement：锁定版本

### 依赖冲突
- 冲突原因：传递依赖版本不一致
- 查看依赖树：mvn dependency:tree
- 排除依赖：exclusions
- 强制版本：直接声明依赖
- 就近原则：路径短的优先

### 依赖分析
- mvn dependency:analyze：未使用、未声明依赖
- mvn dependency:resolve：解析所有依赖
- mvn dependency:list：列出依赖
- IDEA：Maven Helper 插件

### 依赖瘦身
- 排除不需要的依赖
- provided 范围：容器提供
- optional：可选依赖不传递
- 按需引入：不全量依赖

## 实战篇：构建优化

### 加速构建
- 并行构建：-T 1C（按 CPU 核心数）
- 离线模式：-o（不检查更新）
- 跳过测试：-DskipTests
- 增量编译：只编译变化的文件
- 本地仓库：减少网络请求

### 缓存优化
- 本地仓库：重复使用依赖
- CI 缓存：缓存 .m2 目录
- 依赖锁定：减少版本检查
- 离线构建：完全离线

### 构建配置
- maven.compiler.source/target：统一 Java 版本
- project.build.sourceEncoding：UTF-8
- maven.test.skip：跳过测试编译和执行
- maven.javadoc.skip：跳过文档生成

### 分层构建
- 基础层：稳定依赖
- 应用层：业务代码
- Docker 分层：利用缓存
- 减少重复构建时间

## 实战篇：CI/CD 集成

### GitHub Actions
- setup-java：配置 JDK
- cache：缓存 Maven 依赖
- mvn clean verify：构建验证
- 上传产物：actions/upload-artifact

### Docker 构建
- 多阶段构建：构建阶段 + 运行阶段
- Maven 镜像：maven:3-openjdk-17
- 缓存优化：先复制 pom.xml，再复制代码
- 减小镜像大小：删除 Maven 缓存

### 发布流程
- 版本号管理：SNAPSHOT vs RELEASE
- mvn release:prepare：准备发布
- mvn release:perform：执行发布
- Git 标签：自动打标签
- 部署到仓库：Nexus、Maven Central

### 质量检查
- maven-checkstyle-plugin：代码规范
- maven-pmd-plugin：代码质量
- jacoco-maven-plugin：代码覆盖率
- SonarQube：综合质量分析

## 实战篇：最佳实践

### 项目组织
- 单模块：小型项目
- 多模块：大型项目、微服务
- 父子结构：共享配置
- 聚合模块：统一构建

### 版本策略
- 语义化版本：major.minor.patch
- SNAPSHOT：开发版本
- RELEASE：稳定版本
- 依赖版本：不使用 LATEST、RELEASE

### 依赖原则
- 最小化依赖：只引入需要的
- 直接声明：不依赖传递
- 版本锁定：避免意外升级
- 定期更新：修复安全漏洞

### 性能优化
- 并行构建：多核利用
- 离线模式：网络不佳时
- 跳过非必要步骤：调试时跳过测试
- 分离测试：单元测试 vs 集成测试

### 安全建议
- 不提交 settings.xml：包含密码
- 使用环境变量：敏感信息
- 定期扫描依赖：漏洞检测
- 私服访问控制：权限管理

## 下一步学习

掌握 Maven 后，可以探索更多 Java 构建生态：

- **Gradle** - 更灵活、更快的构建工具
- **Nexus** - Maven 私服管理
- **Artifactory** - JFrog 的仓库管理器
- **Maven Release Plugin** - 自动化发布
- **Maven Wrapper** - 项目内嵌 Maven 版本
- **JReleaser** - 跨平台发布工具

Maven 是 Java 世界的基础设施，虽然 XML 冗长、构建有时慢，但它的稳定性和生态无人能敌。约定优于配置的理念让项目结构标准化，插件机制让构建流程可扩展，依赖管理让开发更轻松。记住，Maven 不是完美的，但它是可靠的。理解生命周期、掌握依赖管理、善用 Profile，你会发现 Maven 比想象中强大。有了 Maven，Java 项目构建不再混乱。
