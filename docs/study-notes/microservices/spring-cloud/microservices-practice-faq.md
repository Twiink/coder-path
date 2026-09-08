---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - 微服务
  - 实战
  - 最佳实践
---

# 微服务实战与常见问题

> **核心定位**：综合微服务全栈技术（Nacos + Feign + Gateway + Sentinel + Seata），给出生产环境的实战经验与常见问题排查。

## 1. 完整微服务项目结构

```
mall-microservices/
├── mall-common/                  # 公共模块
│   ├── common-core/              #   核心工具（Result/PageResult/异常）
│   ├── common-redis/             #   Redis 工具
│   ├── common-mq/                #   MQ 工具
│   ├── common-mybatis/           #   MyBatis 配置
│   ├── common-security/          #   安全工具（JWT/权限）
│   └── common-feign/             #   Feign 配置（拦截器/降级）
│
├── mall-gateway/                 # API 网关
│   └── 端口 8000
│
├── mall-user-service/           # 用户服务
│   └── 端口 8001（数据库：mall_user）
│
├── mall-product-service/        # 商品服务
│   └── 端口 8002（数据库：mall_product）
│
├── mall-order-service/          # 订单服务
│   └── 端口 8003（数据库：mall_order）
│
├── mall-payment-service/        # 支付服务
│   └── 端口 8004
│
├── mall-inventory-service/      # 库存服务
│   └── 端口 8005（数据库：mall_inventory）
│
├── mall-notification-service/   # 通知服务
│   └── 端口 8006
│
└── pom.xml                       # 父 POM
```

## 2. 典型请求链路

```
┌─────────────────────────────────────────────┐
│ 下单请求全链路                                │
├─────────────────────────────────────────────┤
│                                              │
│ 1. 客户端 → POST /api/orders                 │
│    ↓                                         │
│ 2. ★ Gateway (8000)                         │
│    - 鉴权（验证 JWT Token）                   │
│    - 路由到 order-service                    │
│    - 限流（Sentinel）                        │
│    - 注入 X-User-Id / X-Trace-Id            │
│    ↓                                         │
│ 3. ★ order-service (8003)                    │
│    - @GlobalTransactional（Seata）           │
│    - 创建订单（本地 DB）                      │
│    ↓                                         │
│ 4. ★ Feign 调用 inventory-service            │
│    - 扣减库存（Seata 分支事务）              │
│    - 超时/熔断 → 降级（Sentinel）             │
│    ↓                                         │
│ 5. ★ Feign 调用 payment-service              │
│    - 创建支付单                               │
│    ↓                                         │
│ 6. ★ 发送 MQ 消息（RocketMQ）                 │
│    - 订单创建事件                             │
│    - 事务消息保证一致性                      │
│    ↓                                         │
│ 7. ★ notification-service 消费消息            │
│    - 发短信/邮件/推送                        │
│                                              │
│ 全链路通过 SkyWalking 追踪                   │
│ TraceID 贯穿所有服务                         │
└─────────────────────────────────────────────┘
```

## 3. 公共依赖管理

```xml
<!-- 父 POM -->
<dependencyManagement>
    <dependencies>
        <!-- Spring Cloud -->
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2023.0.3</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <!-- Spring Cloud Alibaba -->
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-alibaba-dependencies</artifactId>
            <version>2023.0.1.2</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <!-- Spring Boot -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>3.3.5</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<!-- 每个业务服务的依赖（统一） -->
<dependencies>
    <!-- Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <!-- Nacos 注册中心 -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    </dependency>
    <!-- Nacos 配置中心 -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
    </dependency>
    <!-- OpenFeign -->
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-openfeign</artifactId>
    </dependency>
    <!-- Sentinel -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
    </dependency>
    <!-- Seata -->
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-seata</artifactId>
    </dependency>
    <!-- MyBatis-Plus -->
    <dependency>
        <groupId>com.baomidou</groupId>
        <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
        <version>3.5.9</version>
    </dependency>
    <!-- MySQL -->
    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
    </dependency>
    <!-- Redis -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>
    <!-- RocketMQ -->
    <dependency>
        <groupId>org.apache.rocketmq</groupId>
        <artifactId>rocketmq-spring-boot-starter</artifactId>
        <version>2.3.3</version>
    </dependency>
    <!-- Lombok -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
    </dependency>
    <!-- 链路追踪 -->
    <dependency>
        <groupId>io.micrometer</groupId>
        <artifactId>micrometer-tracing-bridge-brave</artifactId>
    </dependency>
    <dependency>
        <groupId>io.zipkin.reporter2</groupId>
        <artifactId>zipkin-reporter-brave</artifactId>
    </dependency>
</dependencies>
```

## 4. 优雅上下线

```java
// ★ 优雅上线（预热）
// Nacos + Spring Boot Actuator
// 1. 服务注册后，初始权重为 0（不接流量）
// 2. 预热完成后逐步增加权重
// 3. 或用 readiness 探针

// application.yml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s

// ★ 优雅下线
// 1. 从 Nacos 注销（让 Gateway 不再转发流量）
// curl -X POST http://localhost:port/actuator/serviceregistry?status=DOWN
// 2. 等待 10-15 秒（让在途请求完成）
// 3. 发送 SIGTERM（Spring 优雅停机）
// 4. 等待 Bean 销毁
// 5. JVM 退出

// K8s 部署
// spec.terminationGracePeriodSeconds: 90
// lifecycle.preStop: sleep 15
```

## 5. 常见问题速查

```
┌─────────────────────────────────────────────┐
│ 微服务常见问题速查                           │
├─────────────────────────────────────────────┤
│                                              │
│ 1. 服务间调用 503                            │
│    → 检查服务是否注册到 Nacos                │
│    → 检查 Feign 的 name 与服务名一致        │
│    → 检查 Sentinel 是否熔断                  │
│                                              │
│ 2. Feign 请求超时                            │
│    → 调大 read-timeout                       │
│    → 检查下游服务是否真的慢                  │
│    → 链路追踪定位慢在哪                      │
│                                              │
│ 3. 配置不刷新                                │
│    → @RefreshScope 必须加                    │
│    → 检查 Nacos 配置格式（yaml/properties）  │
│    → 检查 namespace 和 group                │
│                                              │
│ 4. 分布式事务不回滚                          │
│    → 检查 @GlobalTransactional              │
│    → 检查 undo_log 表是否存在                │
│    → 检查 DataSource 是否被 Seata 代理        │
│    → 检查 XID 是否传递（Feign）              │
│                                              │
│ 5. Sentinel 规则不生效                       │
│    → 检查 @SentinelResource 的 value         │
│    → 检查 blockHandler 方法签名              │
│    → 检查 Nacos 数据源是否配置               │
│                                              │
│ 6. traceId 跨服务丢失                        │
│    → Feign 拦截器传递 traceId                │
│    → 检查 W3C TraceContext 配置              │
│                                              │
│ 7. 消息消费不到                               │
│    → 检查 consumer group                    │
│    → 检查 tag 过滤                           │
│    → 检查网络连通性                          │
│                                              │
│ 8. Gateway 路由 404                          │
│    → 检查 predicates 的 Path 匹配           │
│    → 检查 lb:// 后的服务名                    │
│    → 检查 StripPrefix 是否正确               │
│                                              │
│ 9. 服务注册不上                               │
│    → 检查 Nacos 地址和端口                   │
│    → 检查 namespace（dev/test/prod）        │
│    → 检查网络（防火墙/安全组）               │
│                                              │
│ 10. 日志无 traceId                           │
│     → 检查 logback 的 %X{traceId}           │
│     → 异步线程用 TaskDecorator 传递          │
└─────────────────────────────────────────────┘
```

## 6. 生产部署清单

```
┌─────────────────────────────────────────────┐
│ 微服务生产部署清单                           │
├─────────────────────────────────────────────┤
│                                              │
│ □ Nacos 集群（3节点）                        │
│ □ Seata Server（TC）                        │
│ □ Sentinel Dashboard                        │
│ □ RocketMQ 集群（2Master+2Slave）           │
│ □ Redis 集群（主从+哨兵 或 Cluster）        │
│ □ MySQL 主从                                │
│ □ SkyWalking OAP + UI                       │
│ □ ELK / Loki 日志聚合                       │
│ □ Prometheus + Grafana 监控                 │
│ □ K8s 容器编排                              │
│ □ CI/CD 流水线（Jenkins/GitLab CI）         │
│                                              │
│ 每个微服务：                                 │
│ □ 独立数据库                                │
│ □ 健康检查端点（/actuator/health）          │
│ □ 优雅停机（graceful shutdown）             │
│ □ 日志（logback-spring.xml + traceId）      │
│ □ 监控指标（Prometheus）                    │
│ □ 链路追踪（SkyWalking Agent）              │
│ □ 限流降级（Sentinel）                      │
│ □ 分布式事务（Seata，按需）                  │
│ □ 配置外置（Nacos）                         │
│ □ 密钥管理（K8s Secret / Vault）            │
└─────────────────────────────────────────────┘
```

## 7. 微服务学习路线

```
┌─────────────────────────────────────────────┐
│ 微服务学习路线                               │
├─────────────────────────────────────────────┤
│                                              │
│ 1. ★ Spring Boot 熟练                        │
│    → 独立开发单体应用                        │
│                                              │
│ 2. ★ 理论基础                                │
│    → CAP / BASE 理论                        │
│    → 微服务拆分原则                          │
│                                              │
│ 3. ★ 核心组件                                │
│    → Nacos（注册中心+配置中心）              │
│    → OpenFeign（服务调用）                   │
│    → Gateway（网关）                        │
│    → Sentinel（限流熔断）                    │
│                                              │
│ 4. ★ 分布式问题                              │
│    → Seata（分布式事务）                     │
│    → RocketMQ（消息最终一致）               │
│    → Redisson（分布式锁）                   │
│    → 雪花算法（分布式ID）                    │
│                                              │
│ 5. ★ 可观测性                                │
│    → SkyWalking（链路追踪）                  │
│    → ELK（日志聚合）                         │
│    → Prometheus+Grafana（监控）              │
│                                              │
│ 6. ★ 部署运维                                │
│    → Docker + K8s                           │
│    → CI/CD                                  │
│    → 优雅上下线                             │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/微服务/微服务架构演进与CAP理论]]：CAP / BASE 理论
- [[后端/微服务/SpringCloud技术体系与版本选型]]：技术选型
- [[后端/微服务/Nacos注册中心与配置中心]]：注册/配置
- [[后端/微服务/OpenFeign服务调用]]：服务调用
- [[后端/微服务/Gateway网关]]：网关
- [[后端/微服务/Sentinel限流熔断]]：限流熔断
- [[后端/微服务/Seata分布式事务]]：分布式事务
- [[后端/微服务/分布式ID与链路追踪]]：ID 与追踪
- [[后端/SpringBoot/日志-Actuator与打包部署]]：部署监控
- [[后端/Java工程化与部署/Docker与Nginx部署Java应用]]：Docker 部署
- [[后端/Java/Java学习笔记总索引]]：返回总索引
