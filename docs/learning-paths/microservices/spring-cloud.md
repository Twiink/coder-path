# Spring Cloud 学习路线

Spring Cloud 是微服务架构的瑞士军刀，基于 Spring Boot 构建，提供了配置管理、服务发现、断路器、智能路由、微代理、控制总线等一整套解决方案。它就像是给分布式系统装上了自动驾驶系统，让你不用从零开始造轮子。

## 基础篇：核心组件概览

### Spring Cloud 生态系统
- Spring Cloud Netflix：Netflix OSS 组件集成（Eureka、Ribbon、Hystrix、Zuul）
- Spring Cloud Alibaba：阿里巴巴开源组件（Nacos、Sentinel、Seata、RocketMQ）
- Spring Cloud Gateway：新一代 API 网关
- Spring Cloud Config：分布式配置中心
- Spring Cloud Stream：消息驱动微服务
- Spring Cloud Sleuth：分布式链路追踪
- Spring Cloud Bus：消息总线
- Spring Cloud OpenFeign：声明式 HTTP 客户端
- Spring Cloud LoadBalancer：客户端负载均衡（Ribbon 替代品）
- Spring Cloud Circuit Breaker：断路器抽象层

### 版本管理
- 发布列车（Release Train）命名：Hoxton、2020.0、2021.0、2022.0
- 版本兼容性：Spring Cloud 与 Spring Boot 版本对应关系
- 子项目版本：各组件独立版本号
- 升级策略：兼容性矩阵、迁移指南

## 服务注册与发现：Eureka

### Eureka 架构
- Eureka Server：注册中心服务端
- Eureka Client：服务提供者和消费者
- 服务注册：心跳机制、续约
- 服务发现：获取注册表、缓存
- 自我保护模式：网络分区容错

### Eureka Server 配置
- 单机模式：开发环境
- 集群模式：生产环境高可用
- 服务端配置：端口、主机名、副本节点
- 关闭自我保护：测试环境
- 清理间隔：失效服务剔除时间

### Eureka Client 配置
- 服务注册：应用名、实例 ID、IP 地址
- 心跳配置：续约间隔、过期时间
- 获取注册表：拉取间隔、缓存刷新
- 健康检查：actuator 健康端点
- 优雅下线：取消注册

### 服务发现方式
- 客户端发现：Ribbon 负载均衡
- RestTemplate 集成：@LoadBalanced 注解
- Feign 集成：声明式调用
- 服务实例信息：元数据、状态

## 配置管理：Spring Cloud Config

### Config Server
- Git 仓库：配置文件版本管理
- 本地文件系统：开发测试
- 多环境配置：dev、test、prod
- 配置文件命名：application-{profile}.yml
- 加密解密：对称加密、非对称加密

### Config Client
- 配置拉取：启动时从 Config Server 获取
- 配置绑定：@Value、@ConfigurationProperties
- 配置刷新：@RefreshScope、/actuator/refresh
- 重试机制：启动失败重试
- 快速失败：fail-fast 配置

### 配置刷新机制
- 手动刷新：POST /actuator/refresh
- 自动刷新：Spring Cloud Bus + Git Webhook
- 配置热更新：无需重启服务
- 刷新范围：指定服务、全局广播

### 配置安全
- 配置加密：敏感信息保护
- 密钥管理：JCE、Key Store
- 访问控制：Config Server 认证
- 传输安全：HTTPS

## 服务调用：OpenFeign

### Feign 基础
- 声明式客户端：接口 + 注解
- @FeignClient：指定服务名
- 请求映射：@GetMapping、@PostMapping
- 请求参数：@RequestParam、@PathVariable、@RequestBody
- 请求头：@RequestHeader

### Feign 配置
- 超时配置：连接超时、读超时
- 日志级别：NONE、BASIC、HEADERS、FULL
- 编码器解码器：请求响应转换
- 拦截器：RequestInterceptor
- 重试机制：Retryer

### Feign 与其他组件集成
- 负载均衡：Spring Cloud LoadBalancer
- 断路器：Resilience4j、Sentinel
- 服务发现：Eureka、Nacos
- 链路追踪：Sleuth

## 负载均衡：Ribbon 与 LoadBalancer

### Ribbon（维护模式）
- 客户端负载均衡：进程内 LB
- 负载均衡策略：轮询、随机、加权响应时间、最少并发、重试
- 自定义策略：实现 IRule 接口
- 服务列表：从 Eureka 获取
- 健康检查：Ping 机制

### Spring Cloud LoadBalancer
- Ribbon 替代方案：Spring Cloud 官方推荐
- 负载均衡策略：轮询、随机
- 自定义策略：ReactorServiceInstanceLoadBalancer
- 缓存：服务实例列表缓存
- 响应式支持：WebFlux 兼容

### 负载均衡配置
- 全局配置：所有服务通用
- 特定服务配置：针对某个服务
- 超时配置：结合 Feign 使用
- 重试配置：失败重试次数

## 断路器：Hystrix 与 Resilience4j

### Hystrix（维护模式）
- 断路器模式：熔断、降级
- 资源隔离：线程池、信号量
- 超时控制：execution.isolation.thread.timeoutInMilliseconds
- 熔断条件：错误率、请求量阈值
- 熔断恢复：半开状态、自动恢复
- 降级策略：fallback 方法
- 请求合并：HystrixCollapser
- 请求缓存：HystrixRequestCache
- Dashboard：实时监控面板
- Turbine：聚合多个服务监控数据

### Resilience4j（推荐）
- CircuitBreaker：断路器
- RateLimiter：限流
- Bulkhead：隔离
- Retry：重试
- TimeLimiter：超时
- Cache：缓存
- 函数式编程风格：装饰器模式
- Spring Boot 集成：自动配置、Actuator 端点
- 监控指标：Micrometer 集成

### 断路器配置
- 失败率阈值：触发熔断的错误率
- 慢调用阈值：超时视为失败
- 等待时长：熔断后恢复时间
- 滑动窗口：基于时间或计数
- 最小请求数：触发熔断的最小调用量

## API 网关：Zuul 与 Gateway

### Zuul（维护模式）
- 路由功能：URL 路径映射
- 过滤器：pre、routing、post、error
- 自定义过滤器：ZuulFilter
- 负载均衡：集成 Ribbon
- 熔断降级：集成 Hystrix
- 限流：自定义实现

### Spring Cloud Gateway（推荐）
- 异步非阻塞：基于 WebFlux
- 路由配置：predicates、filters、uri
- 断言（Predicates）：Path、Method、Header、Query、Cookie、Host、Weight
- 过滤器（Filters）：AddRequestHeader、AddResponseHeader、StripPrefix、Retry、CircuitBreaker
- 全局过滤器：GlobalFilter
- 自定义过滤器：GatewayFilter、GatewayFilterFactory
- 限流：RequestRateLimiter（Redis）
- 熔断：Spring Cloud Circuit Breaker 集成
- 跨域配置：CORS

### 网关功能
- 统一入口：所有请求经过网关
- 路由转发：动态路由、服务发现
- 认证授权：JWT、OAuth2
- 限流降级：保护后端服务
- 日志监控：请求响应日志
- 协议转换：HTTP、WebSocket

## 链路追踪：Spring Cloud Sleuth

### Sleuth 核心概念
- Trace：一次完整请求链路
- Span：链路中的一个操作单元
- Trace ID：全局唯一追踪 ID
- Span ID：操作单元唯一 ID
- Parent ID：父 Span ID
- 采样率：控制追踪数据量

### 日志集成
- MDC（Mapped Diagnostic Context）：日志中自动添加 Trace ID
- 日志格式：[appName,traceId,spanId,exportable]
- 日志关联：跨服务日志串联

### 数据导出
- Zipkin：分布式追踪系统
- HTTP 上报：Zipkin Server
- 消息队列上报：RabbitMQ、Kafka
- 可视化：Zipkin UI 查看调用链

### 追踪范围
- HTTP 请求：RestTemplate、Feign
- 消息队列：RabbitMQ、Kafka
- 数据库：JDBC
- 异步任务：@Async

## 消息总线：Spring Cloud Bus

### Bus 核心功能
- 配置刷新：广播配置变更
- 事件传播：自定义事件分发
- 消息中间件：RabbitMQ、Kafka

### 配置刷新流程
- Git 提交配置变更
- Webhook 触发 Config Server
- Config Server 发送刷新事件到 Bus
- Bus 广播到所有服务
- 服务接收事件刷新配置

### 自定义事件
- 远程事件：RemoteApplicationEvent
- 事件发送：ApplicationEventPublisher
- 事件监听：@EventListener
- 目标服务：指定接收方

## 消息驱动：Spring Cloud Stream

### Stream 抽象
- Binder：消息中间件适配器（RabbitMQ、Kafka、RocketMQ）
- Binding：输入输出通道
- Source：消息生产者
- Sink：消息消费者
- Processor：既生产又消费

### 函数式编程模型
- Supplier：生产者（无参数）
- Function：处理器（一进一出）
- Consumer：消费者（有参数无返回）
- 多输入输出：`Function<Tuple2<Flux<A>, Flux<B>>, Flux<C>>`

### 消息配置
- 目的地（Destination）：主题、队列
- 消费组（Group）：负载均衡、消息不重复
- 分区（Partitioning）：消息有序
- 错误处理：重试、死信队列
- 消息序列化：JSON、Avro

## Spring Cloud Alibaba

### Nacos
- 服务注册发现：替代 Eureka
- 配置管理：替代 Config Server
- 命名空间：环境隔离
- 分组：配置分类
- 配置格式：YAML、Properties、JSON
- 配置监听：实时推送
- 服务元数据：自定义元信息
- 权重配置：负载均衡权重
- 保护阈值：健康实例比例

### Sentinel
- 流量控制：QPS、并发线程数
- 熔断降级：慢调用、异常比例、异常数
- 系统保护：CPU、负载、RT、线程数、入口 QPS
- 热点参数限流：针对参数值
- 授权规则：黑白名单
- 规则持久化：Nacos、Apollo
- 实时监控：Sentinel Dashboard
- 集群流控：Token Server

### Seata
- 分布式事务解决方案
- AT 模式：自动补偿
- TCC 模式：手动补偿
- Saga 模式：长事务
- XA 模式：强一致性
- 全局事务：@GlobalTransactional
- 事务分组：资源隔离

### RocketMQ
- 消息队列：高性能、高可靠
- 普通消息：异步解耦
- 顺序消息：严格顺序
- 事务消息：分布式事务
- 延迟消息：定时任务
- 批量消息：提升性能

## 监控与管理

### Spring Boot Admin
- 服务监控：健康状态、JVM、线程、HTTP 追踪
- 应用管理：重启、关闭、日志级别
- 日志查看：在线查看日志文件
- 通知告警：邮件、钉钉、Slack
- 权限控制：Spring Security

### Actuator
- 健康检查：/actuator/health
- 指标监控：/actuator/metrics
- 环境信息：/actuator/env
- 配置属性：/actuator/configprops
- Bean 列表：/actuator/beans
- 日志配置：/actuator/loggers
- 端点暴露：web、jmx
- 端点安全：Spring Security

### Micrometer
- 指标收集：JVM、HTTP、数据库、缓存
- 多种后端：Prometheus、Grafana、InfluxDB、Datadog
- 自定义指标：Counter、Gauge、Timer、Summary
- 标签（Tags）：指标维度

## 安全：Spring Cloud Security

### OAuth2
- 授权码模式：第三方应用
- 密码模式：自家应用
- 客户端模式：服务间调用
- 简化模式：纯前端应用
- 授权服务器：颁发 Token
- 资源服务器：验证 Token
- JWT：无状态 Token

### 服务间认证
- Token 传递：Feign 拦截器
- Token 刷新：过期自动刷新
- 网关认证：统一认证入口
- 服务鉴权：方法级权限

## 下一步学习

掌握 Spring Cloud 后，可以深入以下方向：

- **Kubernetes** - 云原生时代的容器编排
- **Service Mesh** - Istio、Linkerd 服务网格
- **Spring Cloud Alibaba** - 阿里巴巴微服务全家桶
- **API 网关** - Kong、APISIX 高性能网关
- **可观测性** - ELK、Prometheus、Grafana、SkyWalking
- **分布式事务** - Seata、TCC、Saga
- **DevOps** - CI/CD、自动化部署、监控告警

Spring Cloud 就像是微服务的全家桶套餐，Netflix 套餐虽然经典但已经不太新鲜，Alibaba 套餐越来越香。不过别忘了，再好的框架也救不了糟糕的架构设计，微服务不是银弹，拆分需谨慎。
