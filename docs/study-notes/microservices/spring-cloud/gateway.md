---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - Gateway
  - 网关
  - 微服务
---

# Gateway网关

> **核心定位**：Spring Cloud Gateway 是微服务统一入口，提供路由转发、鉴权、限流、日志等能力。基于 Netty + 响应式编程。

## 1. 架构

```
┌─────────────────────────────────────────────┐
│ Gateway 架构                                 │
├─────────────────────────────────────────────┤
│                                              │
│  客户端                                      │
│    ↓                                         │
│  ★ Gateway                                  │
│    ┌──────────────────────────┐            │
│    │  Route（路由）            │            │
│    │   - Predicate（断言）     │            │
│    │   - Filter（过滤器）      │            │
│    └──────────────────────────┘            │
│    ↓                                         │
│  后端微服务                                   │
│    ├── user-service                          │
│    ├── order-service                         │
│    └── product-service                       │
│                                              │
│  三大核心：                                   │
│  Route：路由（id + uri + predicate + filter）│
│  Predicate：断言（匹配条件）                  │
│  Filter：过滤器（请求/响应处理）              │
│                                              │
│  ★ 基于 Netty（非阻塞，高并发）              │
│  ★ 响应式编程（Reactor）                     │
└─────────────────────────────────────────────┘
```

## 2. 路由配置

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service           # 路由 ID
          uri: lb://user-service     # ★ lb:// = 负载均衡到注册中心
          predicates:
            - Path=/api/users/**     # 路径匹配
            - Method=GET,POST        # 方法匹配
            - Header=X-Request-Id    # 头部存在
            - Query=token            # 参数存在
            - After=2024-01-01       # 时间之后
            
        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=2          # 去掉前2段路径
            - AddRequestHeader=X-Gateway, mall
            
        - id: product-service
          uri: lb://product-service
          predicates:
            - Path=/api/products/**
          filters:
            - name: RequestRateLimiter  # ★ 限流
              args:
                redis-rate-limiter.replenishRate: 10
                redis-rate-limiter.burstCapacity: 20
            - name: Retry               # ★ 重试
              args:
                retries: 3
                statuses: BAD_GATEWAY
```

## 3. 全局过滤器（鉴权）

```java
@Component
@Slf4j
@Order(-100)  // ★ 最高优先级（最先执行）
public class AuthGlobalFilter implements GlobalFilter, Ordered {
    
    @Autowired
    private JwtUtils jwtUtils;
    
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();
        
        // ★ 白名单
        if (isWhiteList(path)) {
            return chain.filter(exchange);
        }
        
        // ★ Token 校验
        String token = request.getHeaders().getFirst("Authorization");
        if (token == null || !token.startsWith("Bearer ")) {
            return unauthorized(exchange, "未认证");
        }
        
        JwtUtils.JwtValidationResult result = jwtUtils.validate(token.substring(7));
        if (!result.valid()) {
            return unauthorized(exchange, result.message());
        }
        
        // ★ 注入用户信息到下游请求头
        ServerHttpRequest modified = request.mutate()
            .header("X-User-Id", String.valueOf(result.userId()))
            .header("X-User-Name", result.username())
            .header("X-Trace-Id", generateOrGetTraceId(request))
            .build();
        
        return chain.filter(exchange.mutate().request(modified).build());
    }
    
    @Override
    public int getOrder() { return -100; }
    
    private boolean isWhiteList(String path) {
        return path.startsWith("/api/auth/")
            || path.startsWith("/api/public/")
            || path.equals("/actuator/health");
    }
    
    private Mono<Void> unauthorized(ServerWebExchange exchange, String msg) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = JSON.toJSONString(Result.failed(401, msg));
        return exchange.getResponse()
            .writeWith(Mono.just(
                exchange.getResponse().bufferFactory().wrap(body.getBytes())));
    }
}
```

## 4. 跨域配置

```java
@Configuration
public class GatewayCorsConfig {
    @Bean
    public CorsWebFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.addAllowedOriginPattern("https://*.example.com");
        config.addAllowedMethod("*");
        config.addAllowedHeader("*");
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsWebFilter(source);
    }
}
```

## 5. 常见问题

```
┌─────────────────────────────────────────────┐
│ Gateway 常见问题                             │
├─────────────────────────────────────────────┤
│ 1. 503 Service Unavailable                  │
│    - 服务未注册到 Nacos                      │
│    - 检查 lb:// 服务名                       │
│                                              │
│ 2. 跨域                                      │
│    - ★ 只在 Gateway 配 CORS，不要在下游也配  │
│                                              │
│ 3. 请求头丢失                                │
│    - Gateway 默认透传                       │
│    - 但某些头需手动 mutate                   │
│                                              │
│ 4. 限流                                      │
│    - RequestRateLimiter（Redis 令牌桶）      │
│    - 或配合 Sentinel                         │
│                                              │
│ 5. 响应式编程                                │
│    - ★ Gateway 是响应式的，不能阻塞          │
│    - 不要用 ThreadLocal（用 Reactor Context） │
│    - 过滤器中不要调同步阻塞方法              │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/微服务/Nacos注册中心与配置中心]]：服务发现
- [[后端/微服务/Sentinel限流熔断]]：限流
- [[后端/JavaWeb/JWT认证与Web安全]]：JWT 鉴权
- [[后端/SpringBoot/整合Web开发]]：跨域配置
