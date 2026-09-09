# Dubbo 学习路线

Dubbo 是阿里巴巴开源的高性能 **RPC 框架**,国内微服务领域的"扛把子"(双十一流量洪峰验证过):它解决的核心问题是"**Java 服务之间怎么高效、可靠、可治理地互相调用**"——内置服务发现、负载均衡、集群容错、限流熔断、动态配置等企业级特性,比 Spring Cloud 的 HTTP 调用更"重性能、重治理"。**定位对照**:Spring Cloud 是"微服务全家桶(以 HTTP/REST 为主)",Dubbo 是"**RPC 界的战斗机(以高性能二进制协议为主)**"——国内很多团队是 **Spring Boot + Dubbo 组合**(Web 层用 Spring,服务间调用用 Dubbo)。**版本认知**:Dubbo 3.x 已全面现代化(应用级服务发现、Triple 协议兼容 gRPC、云原生/Service Mesh 友好)——新项目直接 3.x。

## 第一站:架构与调用流程——五角色模型

**Dubbo 的架构(经典五角色,面试必画)**:①**Provider(服务提供者)**:暴露服务(实现类标注 @DubboService);②**Consumer(服务消费者)**:调用服务(@DubboReference 注入——**像调本地方法一样调远程服务,透明化是 RPC 的核心体验**);③**Registry(注册中心)**:服务注册与发现(Zookeeper 经典/Nacos 现代);④**Monitor(监控中心)**:调用统计(可选);⑤**Container(容器)**。
**调用流程(背下来)**:Provider 启动 → 注册服务到 Registry → Consumer 启动订阅服务(拿 Provider 列表)→ **Consumer 按负载均衡策略选一个 Provider 发起 RPC 调用** → 调用信息异步上报 Monitor——**服务上下线动态感知(Registry 推送),无需重启 Consumer**。
**为什么 Dubbo 快(与 HTTP 对比的心智)**:默认 **Dubbo 协议:单一长连接 + NIO 异步(Netty)+ 二进制序列化(Hessian2/Protobuf)**——对比 HTTP/1.1 的短连接+JSON,**连接复用与序列化开销的优势明显**(适合高并发小数据量;大数据量场景用其他协议,见后)。

## 第二站:服务暴露与引用——注解即 RPC

**Provider 侧**:实现类标 `@DubboService(version="1.0", timeout=3000)`(老 XML 配置考古);**暴露配置**:协议(默认 dubbo)、端口(默认 20880)、**version(版本:灰度与兼容——消费者按 version 选服务,升级不断服)**、group(逻辑分组)。
**Consumer 侧**:`@DubboReference(check=false, timeout=...)` 注入接口——**面向接口代理:框架生成代理,序列化请求/网络传输/负载均衡全透明**;配置:timeout(超时,**必配**)、retries(重试:默认 2 次——**非幂等操作别重试或配 Failfast**)、check(启动检查:false 则提供者没起来也能启动,生产建议 false)。
**降级三件套**:本地 Stub(调用前参数校验/缓存——客户端本地逻辑)、**Mock(服务降级:调用失败返回默认值——`mock="force:return null"` 屏蔽(不调用)/`fail:return` 容错(失败才降级))**——**降级预案是 Dubbo 治理的日常工具**。

## 第三站:注册中心与协议——ZooKeeper vs Nacos、Dubbo vs Triple

**注册中心**:**ZooKeeper(经典)**:目录树存服务节点(/dubbo/接口/providers|consumers|routers)+ **临时节点(Provider 宕机自动摘除)+ 监听(变更推送)**——原理见 [ZooKeeper](/learning-paths/middleware/zookeeper);**Nacos(现代主流)**:注册+配置一体、控制台友好——**新项目推荐 Nacos**(见 [Spring Cloud](/learning-paths/microservices/spring-cloud) 的 Nacos 章);Redis/Multicast(小规模/测试,了解)。
**协议选型(3.x 重点)**:**Dubbo 协议**(默认:单长连接+二进制——**Java 到 Java 高并发小数据量首选**);REST/HTTP(跨语言/异构系统集成——暴露 RESTful 风格);**gRPC 协议(3.x:HTTP/2 + Protobuf——跨语言标准)**;**Triple 协议(3.x 推荐:完全兼容 gRPC + HTTP/1.1 fallback——浏览器与网关友好,云原生/Service Mesh 友好)**——**新项目协议首选 Triple**(兼得性能与生态);序列化:Hessian2(默认)/Protobuf(高性能要定义 IDL)/Kryo(仅 Java 快)——**序列化选型影响性能与跨语言**。

## 第四站:负载均衡与集群容错——调用策略

**负载均衡五策略(Consumer 侧选 Provider)**:Random(随机,支持权重——默认)、RoundRobin(轮询,平滑加权)、LeastActive(最少活跃调用——**慢提供者自动少接活**)、ConsistentHash(一致性哈希——**同参数请求固定同一 Provider:有状态/缓存亲和场景**)、ShortestResponse(最短响应);**权重**:静态配置 + **预热权重(新节点上线流量逐步增加——防冷启动被压垮,阿里实践)**。
**集群容错六策略(调用失败怎么办)**:**Failover(失败自动切换:重试其他 Provider——默认,配 retries;幂等读操作首选)**/Failfast(快速失败不重试——**非幂等写操作**)/Failsafe(失败忽略记日志——日志上报类)/Failback(失败后台定时重发——通知类,注意重复)/Forking(并行调多个,一个成功即返回——**牺牲资源换延迟**)/Broadcast(逐个广播,全成功才算——**缓存刷新/状态同步**)。
**选型心法**:读操作 Failover 重试、写操作 Failfast(配幂等设计)、通知类 Failsafe/Failback——**容错策略与幂等性是一对,见 [模式](/learning-paths/microservices/microservices-patterns) 可靠性章**。

## 第五站:路由、限流熔断与治理——运行期流量调度

**路由(灰度与隔离的钥匙)**:条件路由(when→then:按参数/IP/方法——黑白名单、灰度:10% 流量到新版本)、**标签路由(按标签分组:把流量路由到指定标签的 Provider——金丝雀/环境隔离的标准手段,运行时动态改)**、脚本路由(动态逻辑,慎用)。**治理三板斧(运行期动态,不用发版)**:**降级(mock 配置 force/fail:高峰屏蔽非核心服务)**、限流(连接数/并发数 actives;**TPS 限流集成 Sentinel——规则进 Nacos 动态下发,见 [Spring Cloud](/learning-paths/microservices/spring-cloud) 的 Sentinel 章**)、熔断(错误率/慢调用——集成 Sentinel/Resilience4j);**动态配置**:配置中心(Nacos/Apollo)实时推送覆盖(方法 > 服务 > 全局);**Dubbo Admin(治理控制台)**:看服务列表/依赖关系、动态调权重/路由/降级——**"运行期改治理"是 Dubbo 相对 HTTP 微服务的体验优势**。
**监控**:指标(Prometheus/Grafana)、链路追踪(SkyWalking/Zipkin——Trace ID 贯穿 Dubbo 调用)。

## 第六站:高级特性——Dubbo 的隐藏武器

**异步调用**:CompletableFuture 异步返回(Provider 接口返回 Future,Consumer 不阻塞——高吞吐场景);**泛化调用(GenericService)**:没有接口 jar 也能调(传方法名+参数 Map)——**网关/测试平台的利器**;**回声测试($echo)**:连通性探活(不调业务);**RpcContext**:隐式传参(attachment——透传用户/租户上下文,注意异步下不继承);**本地调用(injvm)**:同 JVM 内短路(不走网络——本地调试/同应用调用优化);**SPI 扩展机制(Dubbo 的架构灵魂,进阶必懂)**:微内核+插件——Protocol/Registry/LoadBalance/Filter/Serialization 全是扩展点(@SPI/@Adaptive/@Activate——**读懂 SPI 才能读懂 Dubbo 源码与二次开发**;它也是"为什么 Dubbo 能适配 Nacos/Sentinel/各种协议"的原因)。

## 第七站:Dubbo 3.x 与云原生——新时代的 Dubbo

**3.x 三大变革(面试/选型重点)**:①**应用级服务发现**:从"接口级注册"(每个接口注册,注册中心数据爆炸)进化为"应用级"(对齐 K8s Service 模型——**大规模集群注册中心压力大降**;兼容双注册平滑迁移);②**Triple 协议**(见第三站:gRPC 兼容 + 浏览器友好);③**云原生集成**:K8s 原生服务发现(直连 Pod DNS)、Service Mesh 集成(Istio xDS——**Dubbo 与网格的关系:服务间通信可下沉到网格,见 [Service Mesh](/learning-paths/cloud-native/service-mesh)**)、OpenTelemetry 可观测——**"Dubbo 正在从纯 Java RPC 走向云原生服务框架"**。
**最佳实践**:接口粒度适中(不过细不过粗——按业务能力)、**版本管理(向后兼容,升级灰度)**、参数用对象(别一长串参数)、统一返回结构(Result/错误码,见 [协作](/learning-paths/fullstack/collaboration))、超时重试按业务配、高可用(Provider 多实例 + 容错 + 降级预案——见 [模式](/learning-paths/microservices/microservices-patterns))、安全(Token 验证/黑白名单/TLS)。

## 通关标准

能独立做到:搭出 Provider + Consumer + Nacos 的最小 Dubbo 应用并让调用跑通(理解注册→订阅→调用的完整链路);说清 Dubbo 协议为什么快(长连接/NIO/二进制序列化)与 Triple/gRPC 的选型理由;给读/写/通知三类接口分别选对容错策略并配好超时与幂等设计;用 Admin/Nacos 做一次运行期的权重调整或 mock 降级(不发版);理解 SPI 扩展机制与 3.x 应用级服务发现的动机——Dubbo 主线通关。

Dubbo 是"**国产 RPC 的骄傲**":性能强劲(双十一验证)、功能全面(治理能力开箱即用)、扩展灵活(SPI 微内核)——**在"Java 服务间高效调用"这个细分领域,它的地位稳如泰山**。它与 Spring Cloud 不是二选一,而是互补:**Web/网关用 Spring,服务间 RPC 用 Dubbo**——国内大厂微服务的经典组合。
**学习它的正确姿势:先懂 RPC 的本质(透明代理 + 序列化 + 网络协议),再玩治理(负载/容错/路由/降级),后读 SPI(知其所以然)**——协议与注册中心会演进(3.x 的 Triple/应用级发现就是证明),但这套"高性能调用 + 运行期治理"的心智不会过时。下一步:配套治理看 [Spring Cloud](/learning-paths/microservices/spring-cloud) 的 Nacos/Sentinel,底层协调看 [ZooKeeper](/learning-paths/middleware/zookeeper),云原生走向看 [Service Mesh](/learning-paths/cloud-native/service-mesh)。
