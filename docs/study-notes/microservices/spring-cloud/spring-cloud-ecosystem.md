---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - SpringCloud
  - Nacos
  - 微服务
---

# SpringCloud技术体系与版本选型

> **核心定位**：Spring Cloud 是微服务一站式解决方案。本文对比 Spring Cloud Netflix / Alibaba / 原生三套体系，给出版本选型建议。

## 1. 三大技术体系对比

```
┌─────────────────────────────────────────────┐
│ Spring Cloud 三大体系                        │
├──────────┬────────────┬────────────────────┤
│ 组件      │ Netflix(老) │ Alibaba(★ 主流)  │
├──────────┼────────────┼────────────────────┤
│ 注册中心  │ Eureka(AP) │ ★ Nacos(AP/CP)   │
│ 配置中心  │ Config+Bus │ ★ Nacos           │
│ 服务调用  │ Feign      │ ★ OpenFeign       │
│ 负载均衡  │ Ribbon     │ LoadBalancer       │
│ 网关      │ Zuul       │ ★ Gateway         │
│ 限流熔断  │ Hystrix    │ ★ Sentinel        │
│ 分布式事务│ 无         │ ★ Seata           │
│ 消息队列  │ 无         │ ★ RocketMQ        │
│ 链路追踪  │ Sleuth+Zipkin│ SkyWalking      │
│ 状态      │ ★ 停更     │ ★ 活跃维护        │
└──────────┴────────────┴────────────────────┘

★ Netflix 体系（Eureka/Hystrix/Zuul）已停更，
  新项目一律用 Spring Cloud Alibaba。
```

## 2. 版本对应关系

```
┌─────────────────────────────────────────────┐
│ 版本对应关系（★ 必须匹配）                    │
├─────────────────────────────────────────────┤
│ Spring Cloud  │ Spring Boot │ Alibaba      │
│ 2020.0.x      │ 2.4~2.7    │ 2021.x       │
│ 2022.0.x      │ 3.0~3.2    │ 2022.x       │
│ 2023.0.x      │ 3.2~3.4    │ 2023.x       │
│ 2024.0.x      │ 3.4+       │ 2024.x       │
├─────────────────────────────────────────────┤
│ ★ Spring Cloud Alibaba 2022.x:              │
│   - Nacos 2.2+                              │
│   - Sentinel 1.8+                           │
│   - Seata 1.7+                             │
│   - OpenFeign 4.0+                         │
└─────────────────────────────────────────────┘
```

## 3. Spring Cloud Alibaba 核心组件

```xml
<!-- ★ 统一依赖管理 -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-alibaba-dependencies</artifactId>
            <version>2022.0.0.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2022.0.4</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<!-- 各组件按需引入 -->
<!-- Nacos 注册中心 + 配置中心 -->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
</dependency>
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
</dependency>
<!-- OpenFeign -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
<!-- Gateway -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
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
```

## 4. 各组件协作关系

```
┌─────────────────────────────────────────────┐
│ 微服务请求全链路                              │
├─────────────────────────────────────────────┤
│                                              │
│  客户端                                      │
│    ↓                                         │
│  ★ Gateway（网关）                           │
│    - 路由转发                                │
│    - 鉴权                                    │
│    - 限流                                    │
│    ↓                                         │
│  ★ Nacos（注册中心）                         │
│    - 服务发现                                │
│    - 配置管理                                │
│    ↓                                         │
│  ★ OpenFeign（服务调用）                     │
│    - 负载均衡                                │
│    - 声明式 HTTP 客户端                      │
│    ↓                                         │
│  ★ Sentinel（限流熔断）                      │
│    - 接口限流                                │
│    - 服务熔断降级                            │
│    ↓                                         │
│  ★ Seata（分布式事务）                      │
│    - AT 模式（自动补偿）                     │
│    - TCC 模式（手动补偿）                    │
│    ↓                                         │
│  ★ SkyWalking（链路追踪）                    │
│    - 全链路追踪                               │
│    - 性能分析                                │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/微服务/微服务架构演进与CAP理论]]：CAP 理论
- [[后端/微服务/Nacos注册中心与配置中心]]：Nacos
- [[后端/微服务/Gateway网关]]：Gateway
- [[后端/微服务/Sentinel限流熔断]]：Sentinel
