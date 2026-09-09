# Spring Cloud 学习路线

Spring Cloud 是 **Java 微服务的"全家桶"**:基于 Spring Boot,把服务注册发现、配置中心、负载均衡、熔断、网关、追踪、消息驱动等微服务组件**打包成一套开箱即用的方案**——"给分布式系统装上自动驾驶,不用从零造轮子"。**重要背景(选型必懂)**:Spring Cloud 有两个"套餐"——**Netflix 全家(Eureka/Ribbon/Hystrix/Zuul:经典教材里的名字,已进入维护模式,新项目别用)** 与 **Spring Cloud Alibaba(Nacos/Sentinel/Seata/RocketMQ:国内事实主流,社区活跃)**;外加官方维护的 LoadBalancer/OpenFeign/Gateway/Resilience4j 集成。
**再泼一盆冷水**:云原生时代,注册发现与配置正被 K8s/平台能力吸收(见 [云原生](/learning-paths/cloud-native/cloud-native-patterns))——**Spring Cloud 仍是大规模 Java 微服务的标配,但先想清楚"要不要微服务"(见 [模式](/learning-paths/microservices/microservices-patterns))**,再谈全家桶。
前置:[Spring Boot](/learning-paths/backend/spring-boot) 通关。

## 第一站:生态版图与版本管理

**组件全景(先认识名字,再用时查)**:注册发现(Nacos/Eureka)、配置中心(Nacos Config/Spring Cloud Config)、服务调用(**OpenFeign** 声明式 HTTP 客户端)、负载均衡(**Spring Cloud LoadBalancer**,Ribbon 的官方继任)、熔断降级(Resilience4j 集成/Sentinel)、API 网关(**Spring Cloud Gateway**,Zuul 的继任)、链路追踪(Micrometer Tracing/Sleuth 演进)、消息驱动(Spring Cloud Stream)、配置刷新总线(Bus)、分布式事务(Seata,Alibaba 套餐)。
**版本管理(Java 微服务第一坑)**:Spring Cloud 用**发布列车命名**(2020.0/2021.0/2022.0 或 Hoxton——**必须与 Spring Boot 版本严格对应**(如 2022.0.x ↔ Boot 3.x),对照官方兼容矩阵选版本——**版本配错 = 启动即各种 NoSuchMethodError**;子组件版本可独立覆盖。
**学习路径**:建议 **Spring Cloud Alibaba 套餐为主(Nacos+OpenFeign+Sentinel+Seata+Gateway)**,Netflix 组件只做"看懂老项目"的考古。

## 第二站:服务注册与发现——服务怎么找到彼此

**问题**:微服务实例地址动态变化(扩缩容/重启),调用方不能写死 IP。**方案:注册中心——服务启动自注册+心跳续约,调用方从注册中心拿实例列表**。**Eureka(Netflix,维护模式,考古)**:Server 集群互相注册 + **自我保护模式**(网络分区时保留实例而非误删——AP 倾向);Client 心跳/拉取缓存。**Nacos(Alibaba,现代主流)**:注册发现 + 配置管理二合一——服务注册/发现、**健康检查、权重(负载均衡权重)、保护阈值(健康实例比例过低时只给健康实例)、命名空间与分组(环境/租户隔离)**;支持临时/持久实例;**控制台可视化**(看服务/实例/健康状态——排障体验好)。**选型**:新 Java 微服务用 **Nacos**(或云厂商注册中心);Eureka 只出现在老项目。**服务调用的完整链路**:服务 A 调 B → A 从 Nacos 拿 B 的实例列表 → **LoadBalancer 选一个**(客户端负载均衡:轮询/随机/权重)→ OpenFeign 发请求。

## 第三站:服务调用与负载均衡——OpenFeign + LoadBalancer

**OpenFeign(声明式 HTTP 客户端,Java 微服务的"调用标准")**:定义一个接口 + 注解,就能像调本地方法一样调远程服务:`@FeignClient(name = "order-service")` 接口里 `@GetMapping("/orders/&#123;id&#125;") Order getOrder(@PathVariable Long id)`——**框架自动生成实现:服务发现 + 负载均衡 + HTTP 序列化全包**;配置:超时(连接/读——**必配,防无限等待**)、日志级别(NONE/BASIC/FULL——排查用 FULL)、**拦截器 RequestInterceptor(统一加 token/请求头——服务间认证透传的关键)**、错误处理(fallback/异常解码)。
**LoadBalancer(Ribbon 继任)**:客户端负载均衡(进程内选实例——与 Nginx 的服务端 LB 互补,见 [API 网关](/learning-paths/microservices/api-gateway) 分层);策略:轮询/随机/权重(Nacos 权重),`@LoadBalanced RestTemplate` 或 Feign 自动集成;**注意**:Spring Cloud 2020 后默认用 LoadBalancer,**Ribbon 相关配置已失效——老教程的坑**。

## 第四站:配置中心——配置统一与热更新

**问题**:几十个服务的配置散在各处,改一个要重发 N 个服务。**方案:配置中心(集中管理 + 动态刷新)**。**Spring Cloud Config(官方,考古)**:**Git 仓库当配置存储**(配置文件版本化),Config Server 提供拉取,客户端启动时获取;**刷新**:`@RefreshScope` + POST /actuator/refresh(手动)/ Spring Cloud Bus(消息总线广播刷新——Git Webhook 触发全自动)。
**Nacos Config(现代主流)**:配置存在 Nacos,**变更实时推送**(无需 Bus/Webhook——体验质的提升);支持多环境(namespace/group)、YAML/Properties、历史版本与回滚、灰度发布;**配 @RefreshScope 实现热更新**(配置变更不用重启——生产救命的体验)。
**选型**:Nacos Config 完胜(实时推送+控制台);Config Server 只剩考古;**配置安全**:敏感配置加密/走环境变量与密钥管理(见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 配置章)。**现代替代思考**:K8s ConfigMap 也能管配置,但**无推送、无灰度**——Java 微服务仍普遍用 Nacos。

## 第五站:熔断限流——Resilience4j 与 Sentinel

**Hystrix(Netflix,停止维护,考古)**:线程池隔离+熔断+降级+Dashboard——**概念经典,实现退役**(见 [模式](/learning-paths/microservices/microservices-patterns) 可靠性章)。**Resilience4j(官方推荐,函数式)**:轻量模块化——**CircuitBreaker(熔断:失败率/慢调用率阈值 + 滑动窗口 + 半开恢复)、RateLimiter(限流)、Bulkhead(线程池/信号量隔离)、Retry(重试)、TimeLimiter(超时)**——注解式(`@CircuitBreaker(name, fallbackMethod)`)接入 Spring,指标走 Micrometer(见 [Spring Boot](/learning-paths/backend/spring-boot) 弹性章)。
**Sentinel(Alibaba,国内主流)**:流量控制(按 QPS/并发线程,支持热点参数限流)、熔断降级(慢调用比例/异常比例/异常数)、**系统自适应保护(按 CPU/负载)**,规则可持久化到 Nacos、**Dashboard 可视化实时监控与规则管理**——**国内团队做限流熔断的首选,与 Nacos 同生态集成顺**。
**选型**:跟着套餐走——Alibaba 套餐用 Sentinel,官方线用 Resilience4j;两者都实现断路器概念(见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 弹性章)。

## 第六站:网关与追踪——Gateway + Micrometer Tracing

**Spring Cloud Gateway(Zuul 的官方继任,见 [API 网关](/learning-paths/microservices/api-gateway))**:基于 WebFlux **异步非阻塞**(高并发不占线程);**路由 = Predicates(匹配:Path/Method/Header/Query/Weight)+ Filters(处理:加头/重写路径/限流/熔断/重试)**——YAML 声明路由:`id/uri/predicates/filters`;**动态路由**:从注册中心(Nacos)按服务名转发——新服务上线网关自动路由;**限流**:RequestRateLimiter(Redis 令牌桶);**鉴权**:全局过滤器验 JWT(见 [认证](/learning-paths/security/auth) 微服务章);**CORS 在网关统一配**。
**链路追踪(Java 微服务排障神器)**:旧 Sleuth(停止维护)→ **Micrometer Tracing(新标准,接 OpenTelemetry)**:自动为 Feign/RestTemplate/MQ/DB 调用生成 **Trace ID 并在服务间传播**,日志自动带 traceId、上报 Zipkin/Jaeger 可视化调用链——**"请求慢在哪一跳"靠它**(落地见 [监控](/learning-paths/devops/monitoring) 追踪章);不想自建追踪接 SkyWalking(国内 APM 常用)。

## 第七站:Spring Cloud Alibaba 全家——国内微服务的标准答案

**Nacos**(注册+配置:见第二/四站);**Sentinel**(限流熔断:见第五站);**Seata(分布式事务,微服务数据一致性的答案,理论见 [模式](/learning-paths/microservices/microservices-patterns) 的 Saga)**:四种模式——**AT 模式(自动补偿:框架生成 undo log 自动回滚,无侵入——默认首选,适合"本地事务+SQL"场景)**、TCC(Try-Confirm-Cancel 手动三阶段,强业务控制)、Saga(长事务编排)、XA(强一致);用法:`@GlobalTransactional` 一个注解包住全局事务——**下单扣库存跨服务回滚的体验:像本地事务一样**(实际是 Seata 协调的最终一致);**RocketMQ**(消息:见 [RocketMQ](/learning-paths/middleware/rocketmq),与 Stream 集成做异步解耦)。
**套餐组装(国内生产配方)**:Nacos(注册+配置)+ OpenFeign(调用)+ Sentinel(限流熔断)+ Seata(分布式事务)+ Gateway(入口)+ RocketMQ(异步)+ Micrometer Tracing(追踪)——**一套代码覆盖 [微服务模式](/learning-paths/microservices/microservices-patterns) 的九成模式**。

## 第八站:监控、安全与演进判断

**监控(Java 微服务标配)**:Spring Boot Admin(服务健康/JVM/日志可视化管理台)+ **Actuator 端点(/health 探针//metrics——见 [Spring Boot](/learning-paths/backend/spring-boot) 监控章)** + Micrometer → Prometheus/Grafana(统一大盘——见 [监控](/learning-paths/devops/monitoring));**安全**:网关统一 OAuth2/JWT 认证 + Feign 拦截器透传 token + 服务内方法级权限(@PreAuthorize——见 [认证](/learning-paths/security/auth) 与 [Spring Boot](/learning-paths/backend/spring-boot) 安全章);**演进判断(架构师视角)**:Spring Cloud 解决了"JVM 微服务的基础设施",但 2020 后**云原生平台(K8s/Service Mesh)正在吸收注册发现/负载均衡/熔断/追踪等能力**(见 [K8s](/learning-paths/devops/kubernetes) 与 [Service Mesh](/learning-paths/cloud-native/service-mesh))——**趋势判断**:老系统/Java 团队继续 Spring Cloud(成熟省心);新系统可评估"Spring Boot + K8s 平台能力 + 少量组件"的混合(配置与注册交给平台,Nacos 退场);**但无论怎么演进,微服务的模式(见 [模式页](/learning-paths/microservices/microservices-patterns))不变,组件只是实现**。

## 通关标准

能独立做到:用 Nacos + OpenFeign + LoadBalancer 搭出两个服务互相调用的完整链路(注册/发现/负载均衡工作正常);配好 Nacos Config + @RefreshScope 并演示一次不重启的热更新;用 Sentinel 或 Resilience4j 给关键接口配置熔断与限流并触发验证;用 Seata AT 模式跑通一次跨服务事务回滚;说清 Netflix 套餐退役与 Alibaba/官方组件的对应关系、Spring Cloud 与 K8s 平台能力的边界——Spring Cloud 主线通关。

Spring Cloud 是 Java 微服务的"**成熟答案集**":注册、配置、调用、熔断、网关、事务——每个分布式难题都有开箱组件,学习曲线被框架大幅抹平。**它也是"版本与套餐的迷宫"**:记住三条主线(Alibaba 主流/N 系考古/官方继任)与版本兼容矩阵,你就能在组件海洋里不迷路。**最后那句忠告值得刻在桌上:再好的框架也救不了糟糕的架构——微服务不是银弹,拆分需谨慎(先读 [模式](/learning-paths/microservices/microservices-patterns))**,Spring Cloud 是"怎么实现"的答案,而"该不该拆"是更先的问题。下一步:国内同生态的 [Dubbo](/learning-paths/microservices/dubbo) 对照,或平台级能力看 [K8s](/learning-paths/devops/kubernetes)。
