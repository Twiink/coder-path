---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - Nacos
  - 注册中心
  - 配置中心
  - 微服务
---

# Nacos注册中心与配置中心

> **核心定位**：Nacos = Naming + Configuration，阿里巴巴开源的服务发现与配置管理平台，同时提供 AP/CP 两种模式。

## 1. Nacos 架构

```
┌─────────────────────────────────────────────┐
│ Nacos 架构                                   │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────────────────┐                       │
│  │  Nacos Server    │  (3节点集群)          │
│  │  - 服务注册表    │                       │
│  │  - 配置仓库      │                       │
│  │  - 命名服务      │                       │
│  └────────┬────────┘                       │
│           │                                  │
│  ┌────────┴──────────────────────────┐    │
│  │          服务提供者/消费者          │    │
│  │  ┌──────┐  ┌──────┐  ┌──────┐    │    │
│  │  │用户   │  │订单   │  │商品   │    │    │
│  │  │服务   │  │服务   │  │服务   │    │    │
│  │  └──────┘  └──────┘  └──────┘    │    │
│  │  - 注册到 Nacos                   │    │
│  │  - 从 Nacos 拉取服务列表           │    │
│  │  - 从 Nacos 拉取配置               │    │
│  └──────────────────────────────────┘    │
│                                              │
│  两种模式：                                   │
│  AP（默认）：注册快，最终一致                 │
│  CP：注册慢，强一致（Raft）                   │
└─────────────────────────────────────────────┘
```

## 2. 服务注册与发现

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
</dependency>
```

```yaml
spring:
  application:
    name: user-service
  cloud:
    nacos:
      discovery:
        server-addr: localhost:8848
        namespace: prod          # 命名空间（环境隔离）
        group: DEFAULT_GROUP
        cluster-name: BJ         # 集群名
        weight: 1                 # 权重
        ephemeral: true           # ★ true=AP(临时实例) false=CP(永久实例)
        metadata:
          version: 1.0.0
          region: cn-east
```

```java
@SpringBootApplication
@EnableDiscoveryClient
public class UserServiceApplication { }

// 获取服务实例
@Service
public class ServiceListService {
    
    @Autowired
    private DiscoveryClient discoveryClient;
    
    public List<ServiceInstance> getInstances(String serviceName) {
        return discoveryClient.getInstances(serviceName);
    }
    
    public Set<String> getServices() {
        return discoveryClient.getServices();
    }
}
```

## 3. 配置中心

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
</dependency>
```

```yaml
spring:
  application:
    name: user-service
  profiles:
    active: prod
  cloud:
    nacos:
      config:
        server-addr: localhost:8848
        namespace: prod
        group: DEFAULT_GROUP
        file-extension: yaml       # 配置文件后缀
        refresh-enabled: true      # ★ 自动刷新
        shared-configs:            # ★ 共享配置
          - data-id: common.yaml
            refresh: true
          - data-id: redis.yaml
            refresh: true
        extension-configs:         # 扩展配置
          - data-id: custom.yaml
            refresh: true
```

```java
// ★ 配置自动刷新
@RestController
@RefreshScope    // ★ 配置变更后自动刷新
public class ConfigController {
    
    @Value("${user.max-size:100}")
    private int maxSize;          // Nacos 改了会自动刷新
    
    @Value("${user.cache-enabled:true}")
    private boolean cacheEnabled;
    
    @GetMapping("/config")
    public Map<String, Object> getConfig() {
        return Map.of("maxSize", maxSize, "cacheEnabled", cacheEnabled);
    }
}

// ★ 监听配置变更
@Component
public class ConfigChangeListener {
    
    @NacosConfigListener(dataId = "user-service.yaml", groupId = "DEFAULT_GROUP")
    public void onConfigChange(String config) {
        log.info("配置变更: {}", config);
        // 重新初始化相关组件
    }
}
```

**Nacos 配置加载顺序（优先级从高到低）**：

```
┌─────────────────────────────────────────────┐
│ 配置加载优先级（高 → 低）                     │
├─────────────────────────────────────────────┤
│ 1. 命令行参数                                │
│ 2. Nacos extension-configs                  │
│ 3. Nacos shared-configs                     │
│ 4. Nacos {application}-{profile}.yaml       │
│ 5. Nacos {application}.yaml                 │
│ 6. 本地 application-{profile}.yml           │
│ 7. 本地 application.yml                     │
│                                              │
│ ★ Nacos 中的配置优先级高于本地               │
│ ★ 共享配置可被各服务复用                     │
└─────────────────────────────────────────────┘
```

## 4. Nacos 集群部署

```
┌─────────────────────────────────────────────┐
│ Nacos 集群架构                               │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────┐  ┌─────┐  ┌─────┐                 │
│  │Nacos│  │Nacos│  │Nacos│  3节点          │
│  │ 1   │  │ 2   │  │ 3   │  Raft选举        │
│  └──┬──┘  └──┬──┘  └──┬──┘                 │
│     │        │        │                       │
│     └────────┴────────┘                     │
│              │                                │
│     ┌────────┴────────┐                     │
│     │  MySQL（外置）   │  持久化              │
│     └─────────────────┘                     │
│                                              │
│  前面挂 Nginx 负载均衡：                      │
│  upstream nacos {                            │
│    server 192.168.1.1:8848;                  │
│    server 192.168.1.2:8848;                  │
│    server 192.168.1.3:8848;                  │
│  }                                           │
│                                              │
│  cluster.conf 配置：                         │
│  192.168.1.1:8848                            │
│  192.168.1.2:8848                            │
│  192.168.1.3:8848                            │
└─────────────────────────────────────────────┘
```

## 5. 常见问题

```
┌─────────────────────────────────────────────┐
│ Nacos 常见问题                              │
├─────────────────────────────────────────────┤
│ 1. 服务注册不上                              │
│    - 检查 server-addr 和 namespace          │
│    - 检查网络连通性                          │
│                                              │
│ 2. 配置不刷新                                │
│    - ★ @RefreshScope 必须加                 │
│    - 检查 refresh-enabled: true              │
│                                              │
│ 3. 命名空间隔离                              │
│    - dev/test/prod 用不同 namespace         │
│    - ★ namespace ID 不是名称               │
│                                              │
│ 4. AP vs CP                                  │
│    - ephemeral=true（默认）：AP，临时实例    │
│    - ephemeral=false：CP，永久实例（Raft）   │
│    - ★ 微服务推荐 AP                        │
│                                              │
│ 5. 集群脑裂                                  │
│    - 至少3节点                               │
│    - 外置 MySQL 持久化                       │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/微服务/微服务架构演进与CAP理论]]：CAP 理论
- [[后端/微服务/SpringCloud技术体系与版本选型]]：技术体系
- [[后端/中间件/Zookeeper与分布式协调]]：ZK vs Nacos
- [[后端/SpringBoot/配置文件与自定义Starter]]：配置管理
