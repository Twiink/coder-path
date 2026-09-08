---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - Sentinel
  - 限流
  - 熔断
  - 微服务
---

# Sentinel限流熔断

> **核心定位**：Sentinel 是阿里巴巴开源的流量控制组件，提供限流、熔断降级、系统自适应保护、热点参数限流等能力。

## 1. 核心概念

```
┌─────────────────────────────────────────────┐
│ Sentinel 两大基石                            │
├─────────────────────────────────────────────┤
│                                              │
│ 1. 限流（Flow Control）                      │
│    - QPS/并发数限流                          │
│    - 直接/关联/链路限流                      │
│    - 快速失败 / Warm Up / 排队等待           │
│                                              │
│ 2. 熔断降级（Circuit Breaker）               │
│    - 慢调用比例                             │
│    - 异常比例                               │
│    - 异常数                                 │
│    - ★ 熔断半开 → 探测恢复                   │
│                                              │
│ 3. 系统自适应保护                             │
│    - 根据 CPU/负载自适应限流                │
│                                              │
│ 4. 热点参数限流                             │
│    - 按参数值限流（如热门商品）             │
└─────────────────────────────────────────────┘
```

## 2. 整合

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>
```

```yaml
spring:
  cloud:
    sentinel:
      transport:
        dashboard: localhost:8080   # ★ Sentinel 控制台
        port: 8719                   # 与控制台通信端口
      eager: true                     # ★ 立即初始化
      datasource:                     # ★ 持久化规则到 Nacos
        ds1:
          nacos:
            server-addr: localhost:8848
            data-id: ${spring.application.name}-flow-rules
            group-id: SENTINEL_GROUP
            rule-type: flow
        ds2:
          nacos:
            data-id: ${spring.application.name}-degrade-rules
            group-id: SENTINEL_GROUP
            rule-type: degrade
```

## 3. 限流

```java
// ★ 注解限流
@RestController
public class OrderController {
    
    @SentinelResource(
        value = "createOrder",
        blockHandler = "createOrderBlockHandler",       // ★ 限流降级方法
        blockHandlerClass = OrderBlockHandler.class,
        fallback = "createOrderFallback",               // ★ 异常降级方法
        exceptionsToIgnore = {BusinessException.class}   // 忽略的异常
    )
    @PostMapping("/order")
    public Result<?> createOrder(OrderDTO dto) {
        return Result.success(orderService.create(dto));
    }
}

// ★ 限流降级方法（方法签名必须与原方法一致 + BlockException）
public class OrderBlockHandler {
    public static Result<?> createOrderBlockHandler(OrderDTO dto, BlockException e) {
        return Result.failed("系统繁忙，请稍后重试");
    }
}

// ★ 异常降级方法
public class OrderController {
    public Result<?> createOrderFallback(OrderDTO dto, Throwable e) {
        log.error("创建订单降级", e);
        return Result.failed("服务暂时不可用，请稍后重试");
    }
}
```

**流控效果**：

```
┌─────────────────────────────────────────────┐
│ Sentinel 流控效果                            │
├─────────────────────────────────────────────┤
│ 1. 快速失败（默认）                          │
│    超出阈值直接拒绝                         │
│                                              │
│ 2. Warm Up（预热）                          │
│    初始阈值低，逐步升到设定值                │
│    ★ 适合冷启动场景                          │
│                                              │
│ 3. 排队等待                                  │
│    匀速通过（漏桶算法）                     │
│    超时则拒绝                               │
│    ★ 削峰填谷                               │
└─────────────────────────────────────────────┘
```

## 4. 熔断降级

```java
// ★ 熔断规则（编程式）
@PostConstruct
public void initDegradeRules() {
    // 慢调用比例熔断
    DegradeRule slowCallRule = new DegradeRule("queryOrder")
        .setGrade(CircuitBreakerStrategy.SLOW_REQUEST_RATIO.getType())
        .setCount(500)        // ★ 最大 RT 500ms
        .setSlowRatioThreshold(0.5)  // 50% 慢调用
        .setMinRequestAmount(5)       // 最小请求量
        .setStatIntervalMs(10000)    // 统计窗口 10s
        .setTimeWindow(10);          // 熔断 10s
    
    // 异常比例熔断
    DegradeRule exceptionRatioRule = new DegradeRule("createOrder")
        .setGrade(CircuitBreakerStrategy.ERROR_RATIO.getType())
        .setCount(0.5)         // 50% 异常率
        .setTimeWindow(10);    // 熔断 10s
    
    DegradeRuleManager.loadRules(List.of(slowCallRule, exceptionRatioRule));
}
```

## 5. 热点参数限流

```java
// ★ 按参数值限流（如热门商品 ID）
@SentinelResource("getProduct")
@GetMapping("/product/{id}")
public Result<?> getProduct(@PathVariable Long id) {
    return Result.success(productService.getById(id));
}

// 配置：参数索引0，QPS=100
// 热门商品ID额外限流：id=1 → QPS=10
```

## 6. 常见问题

```
┌─────────────────────────────────────────────┐
│ Sentinel 常见问题                          │
├─────────────────────────────────────────────┤
│ 1. 规则不持久化                              │
│    - 默认存在内存，重启丢失                  │
│    - ★ 配置 Nacos 数据源持久化              │
│                                              │
│ 2. blockHandler vs fallback                 │
│    - blockHandler：限流/熔断时触发           │
│    - fallback：业务异常时触发                │
│                                              │
│ 3. 方法签名要求                              │
│    - blockHandler 需加 BlockException 参数  │
│    - fallback 需加 Throwable 参数           │
│    - ★ 返回类型必须一致                      │
│                                              │
│ 4. OpenFeign 整合                            │
│    - feign.sentinel.enabled=true             │
│    - fallbackFactory 实现降级                │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/微服务/OpenFeign服务调用]]：Feign 熔断降级
- [[后端/微服务/Gateway网关]]：网关限流
- [[后端/中间件/Redis在Java项目中的整合]]：Redis 限流对比
