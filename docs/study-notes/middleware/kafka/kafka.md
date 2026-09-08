---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - Kafka
  - 消息队列
  - 高吞吐
  - 流处理
---

# Kafka

> **核心定位**：Kafka 是 LinkedIn 开源的分布式流处理平台，以超高吞吐（百万级/秒）著称，是大数据/日志/流计算场景的首选 MQ。

## 1. Kafka 架构

```
┌─────────────────────────────────────────────┐
│ Kafka 集群架构                               │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────┐                               │
│  │ Producer  │                               │
│  └─────┬────┘                               │
│        │                                     │
│        ↓                                     │
│  ┌──────────────────────────────────┐       │
│  │           Kafka Cluster           │       │
│  │                                    │       │
│  │  ┌──────────┐  ┌──────────┐      │       │
│  │  │ Broker 1  │  │ Broker 2  │      │       │
│  │  │ Topic-A   │  │ Topic-B   │      │       │
│  │  │  P0(L)   │  │  P0(L)    │      │       │
│  │  │  P1(F)   │  │  P1(F)    │      │       │
│  │  └──────────┘  └──────────┘      │       │
│  │                                    │       │
│  │  ┌──────────┐                    │       │
│  │  │ Broker 3  │                    │       │
│  │  │ Topic-A   │                    │       │
│  │  │  P2(L)   │                    │       │
│  │  └──────────┘                    │       │
│  └──────────────────────────────────┘       │
│        │                                     │
│        ↓                                     │
│  ┌──────────┐  ┌──────────┐               │
│  │ Consumer  │  │ Consumer  │               │
│  │ Group A   │  │ Group B   │               │
│  └──────────┘  └──────────┘               │
│                                              │
│  关键概念：                                   │
│  - Broker：Kafka 服务器节点                  │
│  - Topic：消息主题                           │
│  - Partition（分区）：并行单元               │
│  - Replica（副本）：Leader + Follower        │
│  - Consumer Group：消费者组                  │
│  - Offset：消费位移                          │
│                                              │
│  ★ L = Leader（读写），F = Follower（只同步） │
│  ★ 分区是并行的基本单位                       │
│  ★ 同一 Consumer Group 内分区负载均衡        │
│  ★ 不同 Consumer Group 各自独立消费          │
└─────────────────────────────────────────────┘
```

## 2. 核心概念详解

### 2.1 Partition 与并行度

```
Topic = "order-events"，3 个分区：

Partition 0: [msg0] [msg1] [msg4] [msg7]
Partition 1: [msg2] [msg3] [msg5] [msg8]
Partition 2:        [msg6] [msg9] [msg10]

★ 同一 Key 的消息在同一个分区（保证顺序）
★ 分区数 = Consumer Group 内最大并行度
★ 分区数过少 → 并行度受限
★ 分区数过多 → 元数据开销增大

生产建议：
  - 分区数 = 预期吞吐量 / 单分区吞吐量
  - 单分区吞吐量约 10MB/s
  - 如需 100MB/s → 10 个分区
```

### 2.2 副本与 ISR

```
Partition 0：
  Leader（Broker 1）：[msg0] [msg1] [msg2]    ← 读写都走 Leader
  Follower（Broker 2）：[msg0] [msg1] [msg2]  ← 只同步
  Follower（Broker 3）：[msg0] [msg1]         ← 落后了

ISR（In-Sync Replicas）：与 Leader 保持同步的副本集合
  → {Broker 1, Broker 2}（Broker 3 落后被踢出 ISR）

acks 参数：
  acks=0    → 不等待确认（最快，可能丢）
  acks=1    → Leader 确认（默认，Leader 宕机可能丢）
  acks=-1(all) → ★ ISR 全部确认（最安全，推荐生产）
```

### 2.3 Offset 管理

```
Consumer Group 的 Offset：

__consumer_offsets Topic（内部 Topic）：
  key = (group, topic, partition)
  value = offset

消费位移：
  earliest  → 从最早开始消费
  latest    → 从最新开始消费（默认）
  none      → 没有位移就报错

★ 自动提交 vs 手动提交
  自动：enable.auto.commit=true，定时提交（可能重复/丢失）
  手动：★ 生产推荐，精确控制提交时机
```

## 3. Spring Boot 整合

```xml
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
</dependency>
```

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      acks: all                    # ★ ISR 全确认
      retries: 3                   # 重试次数
      batch-size: 16384            # 批量大小
      buffer-memory: 33554432      # 缓冲区
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      properties:
        max.in.flight.requests.per.connection: 5  # ★ 顺序消息设为1
        enable.idempotence: true                   # ★ 幂等生产者
        compression.type: lz4                      # ★ 压缩
    consumer:
      group-id: mall-consumer
      auto-offset-reset: latest
      enable-auto-commit: false    # ★ 手动提交
      max-poll-records: 500         # 单次拉取最大记录
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties:
        spring.json.trusted.packages: "com.example.*"
    listener:
      ack-mode: manual              # ★ 手动 ACK
      concurrency: 3               # 消费者线程数
```

### 3.1 生产者

```java
@Service
public class KafkaProducer {
    
    @Autowired
    private KafkaTemplate<String, Object> kafkaTemplate;
    
    /**
     * 同步发送
     */
    public void sendSync(String topic, String key, Object value) {
        try {
            kafkaTemplate.send(topic, key, value).get(5, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new BusinessException("Kafka 发送失败", e);
        }
    }
    
    /**
     * ★ 异步发送（带回调）
     */
    public void sendAsync(String topic, String key, Object value) {
        kafkaTemplate.send(topic, key, value)
            .addCallback(
                result -> log.info("发送成功: topic={}, partition={}, offset={}",
                    result.getRecordMetadata().topic(),
                    result.getRecordMetadata().partition(),
                    result.getRecordMetadata().offset()),
                ex -> {
                    log.error("★ 发送失败", ex);
                    // 重试或降级
                    retryService.saveForRetry(topic, key, value);
                }
            );
    }
    
    /**
     * ★ 保证顺序（同 key 进同分区）
     */
    public void sendOrderEvent(String orderId, OrderEvent event) {
        // key = orderId → 同一订单的事件在同一分区（保证顺序）
        kafkaTemplate.send("order-events", orderId, event);
    }
}
```

### 3.2 消费者

```java
@Component
@Slf4j
public class KafkaConsumer {
    
    @Autowired
    private IdempotentService idempotentService;
    
    /**
     * ★ 手动提交 Offset + 幂等
     */
    @KafkaListener(topics = "order-events", groupId = "mall-consumer")
    public void handle(ConsumerRecord<String, OrderEvent> record, 
                       Acknowledgment ack) {
        String key = record.key();
        OrderEvent event = record.value();
        long offset = record.offset();
        int partition = record.partition();
        
        log.info("收到消息: topic={}, partition={}, offset={}, key={}",
            record.topic(), partition, offset, key);
        
        try {
            // ★ 幂等检查
            String idempotentKey = "kafka:order:" + record.topic() + ":" + offset;
            if (!idempotentService.tryAcquire(idempotentKey, Duration.ofDays(7))) {
                log.warn("消息已处理: {}", idempotentKey);
                ack.acknowledge();  // ★ 提交 Offset
                return;
            }
            
            // 业务处理
            orderHandler.handle(event);
            
            // ★ 手动提交 Offset
            ack.acknowledge();
            
        } catch (BusinessException e) {
            // 业务异常：提交 Offset（不重试），记死信
            log.error("业务异常: {}", e.getMessage());
            ack.acknowledge();
            deadLetterService.save(event, e.getMessage());
            
        } catch (Exception e) {
            // 系统异常：不提交 Offset（下次重新消费）
            log.error("系统异常，消息将重新消费", e);
            // ★ 不调用 ack.acknowledge()，下次会重新消费
        }
    }
}
```

## 4. Kafka 高级特性

### 4.1 幂等生产者

```java
// Kafka 0.11+ 支持幂等生产者
// 配置：enable.idempotence=true
// 原理：
//   Producer 发送时带上 PID（Producer ID）+ SequenceNumber
//   Broker 根据 (PID, Partition, SeqNum) 去重
//   ★ 保证单分区单会话内不重复
//   ★ 跨会话需配合事务

// ★ 跨分区的 Exactly Once（Kafka 事务）
props.put("transactional.id", "order-tx-1");  // 事务 ID
KafkaProducer producer = new KafkaProducer(props);
producer.initTransactions();  // 初始化事务
try {
    producer.beginTransaction();
    producer.send(new ProducerRecord<>("topic", "key", "value"));
    producer.send(new ProducerRecord<>("topic2", "key2", "value2"));
    producer.commitTransaction();  // ★ 原子提交
} catch (Exception e) {
    producer.abortTransaction();
}
```

### 4.2 Kafka Streams（流处理）

```java
// 用 Kafka Streams 做实时聚合（如实时统计订单金额）
@Bean
public KStream<String, OrderEvent> kStream(StreamsBuilder builder) {
    KStream<String, OrderEvent> stream = builder
        .stream("order-events", Consumed.with(Serdes.String(), jsonSerde()));
    
    // 按用户分组 → 聚合订单金额
    stream.filter((k, v) -> v.getStatus() == OrderStatus.PAID)
        .groupBy((k, v) -> v.getUserId(), Grouped.with(Serdes.String(), jsonSerde()))
        .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5)))  // 5分钟窗口
        .aggregate(
            () -> new BigDecimal(0),
            (key, value, aggregate) -> aggregate.add(value.getAmount()),
            Materialized.as("user-amount-store")
        )
        .toStream()
        .map((windowKey, amount) -> 
            new KeyValue<>(windowKey.key(), 
                new UserAmountVO(windowKey.key(), amount)))
        .to("user-amount-result");
    
    return stream;
}
```

## 5. 常见问题

```
┌─────────────────────────────────────────────┐
│ Kafka 常见问题                              │
├─────────────────────────────────────────────┤
│ 1. 消息丢失                                   │
│    - 生产端：acks=all + 重试 + 幂等          │
│    - Broker：副本数 >= 2 + min.insync.replicas │
│    - 消费端：手动提交 + 处理完成后提交      │
│                                              │
│ 2. 消息重复                                  │
│    - 开启幂等生产者                          │
│    - ★ 消费者幂等                            │
│                                              │
│ 3. 消息顺序                                  │
│    - 同 key 进同分区                         │
│    - max.in.flight.requests.per.connection=1 │
│                                              │
│ 4. 消息积压                                  │
│    - 增加分区数 + 消费者数                  │
│    - 增加 max-poll-records                  │
│    - 临时跳过堆积（重置 offset）            │
│                                              │
│ 5. 分区数选择                               │
│    - 吞吐量 / 10MB/s                        │
│    - 等于或大于消费者数                      │
│    - 不宜过多（元数据开销）                 │
│                                              │
│ 6. 重复消费/消息丢失（Offset 问题）         │
│    - 自动提交可能丢失/重复                  │
│    - ★ 手动提交 + 处理完成后提交            │
│                                              │
│ 7. rebalance 导致重复消费                   │
│    - 消费者上下线触发 rebalance              │
│    - ★ max.poll.interval.ms 调大            │
│    - 处理时间 < max.poll.interval.ms        │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/消息队列/消息队列概述与选型]]：MQ 选型
- [[后端/消息队列/消息可靠性与常见问题]]：可靠性方案
- [[后端/SpringBoot/日志-Actuator与打包部署]]：日志收集（Kafka 典型场景）
