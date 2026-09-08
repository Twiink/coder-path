---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - 分布式ID
  - 链路追踪
  - SkyWalking
  - 微服务
---

# 分布式ID与链路追踪

> **核心定位**：分布式系统的两个基础能力——唯一 ID 生成与全链路追踪，是排查问题和数据关联的基石。

## 1. 分布式 ID 方案对比

```
┌─────────────────────────────────────────────┐
│ 分布式 ID 方案对比                           │
├──────────┬────────┬────────┬───────────────┤
│ 方案      │ UUID   │ 雪花   │ 数据库自增   │
├──────────┼────────┼────────┼───────────────┤
│ 全局唯一  │ ★ 是  │ ★ 是  │ 是           │
│ 趋势递增  │ ❌     │ ★ 是  │ ★ 是        │
│ 不依赖DB │ ★ 是  │ ★ 是  │ ❌           │
│ 性能      │ ★ 高  │ ★ 高  │ 低           │
│ 可读性    │ 差     │ 中     │ ★ 好        │
│ 长度      │ 32字符 │ 19数字 │ 长数字      │
│ 适用      │ 文件名 │★ 主键 │ 单机        │
└──────────┴────────┴────────┴───────────────┘
```

## 2. 雪花算法（Snowflake）

```
┌─────────────────────────────────────────────┐
│ Snowflake ID 结构（64位）                    │
├─────────────────────────────────────────────┤
│  0 | 00000000 00000000 00000000 00000000     │
│    | 00000000 00 | 00000 00000 | 000000000000 │
│    ↑              ↑            ↑              ↑
│   符号位(1)    时间戳(41)   机器ID(10)  序列号(12)│
│                                              │
│  时间戳：41位，可用 69 年                    │
│  机器ID：5位数据中心 + 5位机器               │
│  序列号：12位，每毫秒 4096 个 ID             │
│                                              │
│  ★ 特点：趋势递增，对 B+ 树索引友好          │
│  ★ 分布式唯一，不依赖数据库                  │
│  ★ 性能极高（本地生成）                      │
│                                              │
│  ⚠️ 依赖机器时钟，时钟回拨会出问题           │
│  ★ 解决：回拨检测 + 等待 / 借未来时间        │
└─────────────────────────────────────────────┘
```

```java
// MyBatis-Plus 内置雪花算法
@TableId(type = IdType.ASSIGN_ID)
private Long id;  // 自动生成雪花 ID

// 自定义雪花算法
public class SnowflakeIdGenerator {
    private final long epoch = 1704067200000L;  // 2024-01-01
    private final long workerIdBits = 5L;
    private final long datacenterIdBits = 5L;
    private final long sequenceBits = 12L;
    
    private final long maxWorkerId = ~(-1L << workerIdBits);     // 31
    private final long maxDatacenterId = ~(-1L << datacenterIdBits); // 31
    
    private final long workerIdShift = sequenceBits;
    private final long datacenterIdShift = sequenceBits + workerIdBits;
    private final long timestampShift = sequenceBits + workerIdBits + datacenterIdBits;
    
    private final long sequenceMask = ~(-1L << sequenceBits);    // 4095
    
    private final long workerId;
    private final long datacenterId;
    private long sequence = 0L;
    private long lastTimestamp = -1L;
    
    public SnowflakeIdGenerator(long workerId, long datacenterId) {
        if (workerId > maxWorkerId || workerId < 0) 
            throw new IllegalArgumentException("workerId 非法");
        if (datacenterId > maxDatacenterId || datacenterId < 0)
            throw new IllegalArgumentException("datacenterId 非法");
        this.workerId = workerId;
        this.datacenterId = datacenterId;
    }
    
    public synchronized long nextId() {
        long timestamp = System.currentTimeMillis();
        
        // ★ 时钟回拨检测
        if (timestamp < lastTimestamp) {
            long offset = lastTimestamp - timestamp;
            if (offset <= 5) {
                // 回拨 5ms 内等待
                try { Thread.sleep(offset + 1); } catch (InterruptedException e) { 
                    Thread.currentThread().interrupt(); 
                }
                timestamp = System.currentTimeMillis();
            } else {
                throw new RuntimeException("时钟回拨 " + offset + "ms，拒绝生成 ID");
            }
        }
        
        if (timestamp == lastTimestamp) {
            sequence = (sequence + 1) & sequenceMask;
            if (sequence == 0) {
                // 当前毫秒序列耗尽，等待下一毫秒
                timestamp = tilNextMillis(lastTimestamp);
            }
        } else {
            sequence = 0L;
        }
        
        lastTimestamp = timestamp;
        return ((timestamp - epoch) << timestampShift)
            | (datacenterId << datacenterIdShift)
            | (workerId << workerIdShift)
            | sequence;
    }
    
    private long tilNextMillis(long lastTimestamp) {
        long timestamp = System.currentTimeMillis();
        while (timestamp <= lastTimestamp) {
            timestamp = System.currentTimeMillis();
        }
        return timestamp;
    }
}
```

## 3. 其他方案

```java
// ─── 1. Leaf（美团）───
//    - 号段模式：从数据库批量取 ID（减少 DB 访问）
//    - Snowflake 模式：增强版雪花（解决回拨）
//    - ★ 美团开源，双 buffer 保证可用性

// ─── 2. Tinyid（滴滴）───
//    - 号段模式，类似 Leaf
//    - 多 DB 支持

// ─── 3. UUID ───
//    UUID.randomUUID().toString().replace("-", "");
//    ★ 不适合做主键（无序，B+ 树索引差）
//    ★ 适合做文件名、Trace ID

// ─── 4. Redis INCR ───
//    Long id = redisTemplate.opsForValue().increment("id:order");
//    ★ 简单但依赖 Redis，性能不如本地生成
```

## 4. 链路追踪

```
┌─────────────────────────────────────────────┐
│ 分布式链路追踪                                │
├─────────────────────────────────────────────┤
│                                              │
│  请求 → Gateway → 用户服务 → 订单服务       │
│                              → 库存服务       │
│                              → 支付服务       │
│                                              │
│  一个请求经过多个服务，如何排查慢在哪？      │
│                                              │
│  ★ 链路追踪：每个请求生成唯一 TraceID        │
│    每个服务/每段调用生成 SpanID              │
│    Span 之间有父子关系                        │
│                                              │
│    TraceID: abc123                           │
│    ├─ Span1: Gateway (5ms)                   │
│    │  └─ Span2: 用户服务 (20ms)              │
│    │     ├─ Span3: DB查询 (5ms)              │
│    │     └─ Span4: Redis查询 (2ms)          │
│    └─ Span5: 订单服务 (50ms)                 │
│       └─ Span6: 库存服务 (10ms)              │
│                                              │
│  ★ 一眼看出哪个服务/哪个操作慢               │
└─────────────────────────────────────────────┘
```

## 5. Spring Boot 集成追踪

```xml
<!-- Spring Boot 3 + Micrometer Tracing -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>
<dependency>
    <groupId>io.zipkin.reporter2</groupId>
    <artifactId>zipkin-reporter-brave</artifactId>
</dependency>
```

```yaml
management:
  tracing:
    sampling:
      probability: 1.0    # ★ 采样率（生产建议 0.1）
    propagation:
      type: w3c            # W3C TraceContext
  zipkin:
    tracing:
      endpoint: http://zipkin:9411/api/v2/spans
```

```java
// ★ 自动注入 TraceID 到日志（MDC）
// logback-spring.xml 中配 %X{traceId}
// 每条日志自动带 traceId

// 手动创建 Span
@Autowired
private Tracer tracer;

public void doWork() {
    Span span = tracer.nextSpan().name("customOperation").start();
    try (Tracer.SpanInScope scope = tracer.withSpan(span)) {
        // 业务逻辑
        log.info("执行自定义操作");
    } catch (Exception e) {
        span.recordException(e);
        throw e;
    } finally {
        span.end();
    }
}
```

## 6. SkyWalking（APM）

```
┌─────────────────────────────────────────────┐
│ SkyWalking 架构                              │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 用户服务  │  │ 订单服务  │  │ 库存服务  │ │
│  │ + Agent  │  │ + Agent  │  │ + Agent  │ │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘ │
│        │             │             │       │
│        └─────────────┼─────────────┘       │
│                      │                      │
│              ┌───────┴───────┐            │
│              │  OAP Server   │            │
│              │  (分析+聚合)   │            │
│              └───────┬───────┘            │
│                      │                      │
│              ┌───────┴───────┐            │
│              │  Storage      │            │
│              │  (ES/H2/MySQL)│            │
│              └───────────────┘            │
│                      │                      │
│              ┌───────┴───────┐            │
│              │  UI (可视化)   │            │
│              └───────────────┘            │
│                                              │
│  特点：                                       │
│  - ★ Java Agent 无侵入（-javaagent）        │
│  - 自动追踪 HTTP/RPC/SQL/Redis              │
│  - 拓扑图 + 链路图 + 性能分析                │
│  - ★ 不需要改代码                            │
└─────────────────────────────────────────────┘
```

```bash
# 启动时加 Agent
java -javaagent:/path/to/skywalking-agent.jar \
     -Dskywalking.agent.service_name=user-service \
     -Dskywalking.collector.backend_service=oap:11800 \
     -jar user-service.jar
```

## 7. 常见问题

```
┌─────────────────────────────────────────────┐
│ 分布式 ID 与链路追踪常见问题                  │
├─────────────────────────────────────────────┤
│ 1. 雪花 ID 前端精度丢失                      │
│    - 19位 Long 超过 JS Number 精度          │
│    - ★ Jackson 序列化为 String              │
│                                              │
│ 2. 时钟回拨                                  │
│    - NTP 同步导致时钟倒退                    │
│    - ★ 回拨检测 + 等待/报错                  │
│                                              │
│ 3. workerId 分配                             │
│    - 多实例不能重复（否则 ID 重复）           │
│    - ★ 从配置中心/环境变量获取               │
│                                              │
│ 4. 采样率                                    │
│    - 生产 1.0 全量采样日志量大                │
│    - ★ 建议 0.1~0.01（10%~1%）              │
│                                              │
│ 5. traceId 跨线程丢失                        │
│    - ThreadLocal 不跨线程                    │
│    - ★ TaskDecorator 传递 MDC               │
│    - 或用 TransmittableThreadLocal          │
│                                              │
│ 6. OpenFeign 调用 traceId 丢失              │
│    - ★ RequestInterceptor 传递 traceId       │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]：ThreadLocal 与上下文传递
- [[后端/MyBatis/MyBatisPlus]]：雪花算法主键策略
- [[后端/SpringBoot/日志-Actuator与打包部署]]：日志与 MDC
- [[后端/微服务/OpenFeign服务调用]]：Feign 传递 traceId
