# Java 全栈学习路线

**Java 全栈以 Spring Boot 为核心**:企业级生态成熟、稳定性强、岗位量大,是大型项目与金融/电商系统的标配。它的学习曲线更陡(IoC/事务/安全的概念密度大),但**后端深度与职业天花板可观**——Java 全栈工程师通常是"后端很强、前端够用"的形态(与 JS 全栈的"两端平衡"不同)。前提:语言见 [Java](/learning-paths/languages/java),后端主体见 [Spring Boot](/learning-paths/backend/spring-boot)。

## 配方:Spring Boot(后端)+ Vue 或 React(前端)

**后端:Spring Boot 全家**(见 [Spring Boot](/learning-paths/backend/spring-boot)):Spring Web 写 REST API、**Spring Security + JWT 做认证授权**(SecurityFilterChain/方法级权限)、数据层二选一——**Spring Data JPA**(对象关系映射,官方主线)或 **MyBatis-Plus**(SQL 可控,国内互联网公司主流)、Swagger/knife4j **自动生成接口文档**(前端照着调,见 [Spring Boot](/learning-paths/backend/spring-boot) 文档章)、全局异常处理统一错误格式。
**前端:Vue 3 或 React**(Java 后端不绑定前端——同一套 REST API,Vue/React 随意切换,团队熟悉哪个用哪个):Vue 见 [Vue](/learning-paths/frontend/vue)、React 见 [React](/learning-paths/frontend/react),Vite + TypeScript 是标配。
**国内主流组合**:Spring Boot + Vue(生态资料多)+ MyBatis-Plus + MySQL + Redis——**中后台管理系统(Admin)的黄金配方**(前端框架自带 Table/Form 组件,后端 CRUD 接口一套生成)。

## Java 全栈的工程特征

**①企业级规范是默认值**:分层架构(Controller/Service/Mapper——见 [Spring Boot](/learning-paths/backend/spring-boot) 工程章)、统一返回体 Result&lt;T&gt; 与错误码、参数校验注解(@Valid)、事务边界(@Transactional)——**Java 生态把"规范"焊进了框架与约定,团队写出来的是同一种风格**;**②认证授权体系最完整**:Spring Security 的 JWT 无状态认证 + RBAC 方法级权限 + OAuth2(见 [认证](/learning-paths/security/auth) 与 [Spring Boot](/learning-paths/backend/spring-boot) 安全章)——**复杂权限需求(多角色/数据权限)Java 栈的答案最成熟**;**③接口文档即契约**:knife4j/Swagger 自动生成 + DTO 校验注解即文档——前后端对接的沟通成本被框架吃掉(见 [协作](/learning-paths/fullstack/collaboration))。
**④性能与扩展**:JVM 调优、连接池(HikariCP)、Redis 缓存、分库分表(见 [Java](/learning-paths/languages/java) 的 JVM 章与 [MySQL](/learning-paths/database/mysql))——**量大时的深度题 Java 栈全有现成答案**。

## 学习路径建议

**第一步**:Spring Boot 从 [start.spring.io](无外链,用 Initializr 建项目)跑通 REST CRUD(实体→Repository→Service→Controller——见 [Spring Boot](/learning-paths/backend/spring-boot) 前五站);**第二步**:接 Vue 或 React 前端调通自己写的 API(前后端分离最小闭环);**第三步**:补认证(Spring Security + JWT——**Java 全栈必过的一关**)与全局异常/统一返回;**第四步**:上 MyBatis-Plus/JPA 的复杂查询、Redis 缓存、Swagger 文档;**第五步**:部署(Docker + 云服务器,见 [部署](/learning-paths/fullstack/deployment))与 CI([GitHub Actions](/learning-paths/devops/github-actions) 跑 mvn test + 构建镜像)。
**企业进阶**:微服务(Spring Cloud,见 [Spring Cloud](/learning-paths/microservices/spring-cloud))、消息队列、分库分表——**Java 栈的成长路径最清晰:从单体 CRUD 到企业级架构一路有教材**。

## 通关标准

能独立做到:用 Spring Boot + Vue/React 做出带 JWT 登录、RBAC 权限、MyBatis/JPA 数据层、Swagger 文档、统一异常的完整中后台;说清一次带 token 的请求在 Spring Security 过滤器链里的流转;会用 DTO 校验与全局异常返回统一错误结构;理解"为什么 Java 全栈强调规范"(分层/事务/安全注解);能 Docker 部署并跑通 CI——Java 全栈主线通关。

Java 全栈是"**用学习曲线换工程上限**"的选择:它不给你最快的第一版,但给你最稳的第十版——规范、事务、安全、性能的答案都经过二十年企业级验证。**它的典型画像:后端深度扎实的工程师 + 够用的前端能力**,适合目标是大厂/金融/大型系统的开发者。别被 Spring 的概念密度劝退:每搞懂一个(容器/事务/安全),你就在"值钱"的方向上前进一步。下一步:[前后端协作](/learning-paths/fullstack/collaboration) 补契约规范,或对照 [Go 全栈](/learning-paths/fullstack/go) 看云原生派的取舍。
