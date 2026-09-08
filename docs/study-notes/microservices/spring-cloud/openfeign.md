---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - OpenFeign
  - 服务调用
  - 微服务
---

# OpenFeign服务调用

> **核心定位**：OpenFeign 是声明式 HTTP 客户端，用接口 + 注解替代 RestTemplate 手写 HTTP 调用。

## 1. 基础用法

```java
// ★ 声明式调用：定义接口，无需写实现
@FeignClient(name = "user-service", path = "/api/v1/users")
public interface UserClient {
    
    @GetMapping("/{id}")
    Result<UserVO> getById(@PathVariable Long id);
    
    @GetMapping
    Result<PageResult<UserVO>> page(
        @RequestParam int pageNum, 
        @RequestParam int pageSize,
        @RequestParam(required = false) String keyword);
    
    @PostMapping
    Result<Long> create(@RequestBody UserCreateDTO dto);
    
    @PutMapping("/{id}")
    Result<Void> update(@PathVariable Long id, @RequestBody UserCreateDTO dto);
    
    @DeleteMapping("/{id}")
    Result<Void> delete(@PathVariable Long id);
}

// 使用（注入即用，自动负载均衡）
@Service
@RequiredArgsConstructor
public class OrderService {
    private final UserClient userClient;
    
    public OrderVO create(OrderDTO dto) {
        // ★ 像调本地方法一样调远程
        Result<UserVO> result = userClient.getById(dto.getUserId());
        if (!result.isSuccess()) throw new BusinessException("用户不存在");
        // ...
    }
}
```

## 2. 配置

```yaml
spring:
  cloud:
    openfeign:
      client:
        config:
          default:                    # 全局默认
            connect-timeout: 3000
            read-timeout: 5000
            logger-level: BASIC
          user-service:               # 针对特定服务
            read-timeout: 10000
      compression:
        request:
          enabled: true
          mime-types: application/json
          min-request-size: 2048
        response:
          enabled: true
      circuitbreaker:
        enabled: true    # ★ 开启熔断器（配合 Sentinel）
```

## 3. 拦截器与请求头传递

```java
@Component
public class FeignTraceInterceptor implements RequestInterceptor {
    @Override
    public void apply(RequestTemplate template) {
        // ★ 传递 traceId
        String traceId = MDC.get("traceId");
        if (traceId != null) template.header("X-Trace-Id", traceId);
        
        // ★ 传递认证 Token
        HttpServletRequest request = 
            ((ServletRequestAttributes) RequestContextHolder
                .getRequestAttributes()).getRequest();
        String token = request.getHeader("Authorization");
        if (token != null) template.header("Authorization", token);
        
        // ★ 传递用户上下文
        LoginUser user = UserContext.get();
        if (user != null) {
            template.header("X-User-Id", String.valueOf(user.getUserId()));
            template.header("X-User-Name", user.getUsername());
        }
    }
}
```

## 4. 降级与熔断

```java
// ★ 降级工厂
@Component
public class UserClientFallbackFactory implements FallbackFactory<UserClient> {
    @Override
    public UserClient create(Throwable cause) {
        log.error("UserClient 调用失败，降级", cause);
        return new UserClient() {
            @Override
            public Result<UserVO> getById(Long id) {
                return Result.failed("用户服务不可用，降级返回默认");
            }
            @Override
            public Result<PageResult<UserVO>> page(int p, int s, String k) {
                return Result.failed("用户服务不可用");
            }
            // ... 其他方法
        };
    }
}

@FeignClient(name = "user-service", 
             path = "/api/v1/users",
             fallbackFactory = UserClientFallbackFactory.class)  // ★ 降级
public interface UserClient { }
```

## 5. 常见问题

```
┌─────────────────────────────────────────────┐
│ OpenFeign 常见问题                          │
├─────────────────────────────────────────────┤
│ 1. 超时                                    │
│    - connect-timeout / read-timeout        │
│    - ★ 针对不同服务单独配置                  │
│                                              │
│ 2. 请求头丢失                                │
│    - ★ RequestInterceptor 传递              │
│    - traceId/Token/UserInfo                │
│                                              │
│ 3. 调用失败无感知                            │
│    - fallbackFactory 降级处理               │
│    - ★ 配合 Sentinel 熔断                   │
│                                              │
│ 4. GET 请求传对象参数                        │
│    - @SpringQueryMap                        │
│    - 不要用 @RequestBody（GET 无 body）     │
│                                              │
│ 5. 压缩                                    │
│    - 开启 gzip 减少网络传输                  │
│    - min-request-size: 2048                │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/微服务/Nacos注册中心与配置中心]]：服务发现
- [[后端/微服务/Sentinel限流熔断]]：熔断降级
- [[后端/SpringBoot/整合Web开发]]：RestTemplate 对比
