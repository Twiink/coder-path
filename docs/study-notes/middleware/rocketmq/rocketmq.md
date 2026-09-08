---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - RocketMQ
  - 消息队列
  - 事务消息
---

# RocketMQ

> **核心定位**：RocketMQ 是阿里巴巴开源的分布式消息中间件，以高可靠、事务消息、延迟消息著称，是国内电商/金融场景的首选 MQ。

## 1. RocketMQ 架构

```
┌─────────────────────────────────────────────┐
│ RocketMQ 集群架构                            │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ NameServer  │  │ NameServer  │  (无状态)  │
│  │  (注册中心)   │  │  (注册中心)  │  互相独立  │
│  └──────┬──────┘  └──────┬──────┘           │
│         │                │                   │
│  ┌──────┴────────────────┴──────┐           │
│  │                               │           │
│  │    ┌──────────────────┐       │           │
│  │    │ Broker Master 1   │       │           │
│  │    │  - Topic-A        │       │           │
│  │    │  - Queue-0~3      │       │           │
│  │    └────────┬─────────┘       │           │
│  │             │ 同步/异步         │           │
│  │    ┌────────┴─────────┐       │           │
│  │    │ Broker Slave 1   │       │           │
│  │    └──────────────────┘       │           │
│  │                               │           │
│  │    ┌──────────────────┐       │           │
│  │    │ Broker Master 2   │       │           │
│  │    └────────┬─────────┘       │           │
│  │             │                  │           │
│  │    ┌────────┴─────────┐       │           │
│  │    │ Broker Slave 2   │       │           │
│  │    └──────────────────┘       │           │
│  └───────────────────────────────┘           │
│                                              │
│  Producer → 连接 NameServer → 获取 Broker    │
│  Consumer → 连接 NameServer → 获取 Broker    │
│                                              │
│  特点：                                       │
│  - NameServer 无状态，可部署多台（各独立）     │
│  - Broker 主从架构，主写从读                  │
│  - Topic 分为多个 Queue（队列）实现并行       │
└─────────────────────────────────────────────┘
```

## 2. 核心概念

```
┌─────────────────────────────────────────────┐
│ RocketMQ 消息模型                             │
├─────────────────────────────────────────────┤
│                                              │
│ Topic（主题）                                 │
│  ├── Queue 0（队列0）                         │
│  ├── Queue 1（队列1）                         │
│  ├── Queue 2（队列2）                         │
│  └── Queue 3（队列3）                         │
│                                              │
│ Tag（标签）：消息二级分类                     │
│   topic = "order", tag = "create" / "pay"    │
│                                              │
│ Group（消费组）：                              │
│   - 同组内负载均衡（一条消息只被一个消费）     │
│   - 不同组各自消费（广播）                    │
│                                              │
│ 消费模式：                                    │
│   CLUSTERING（集群）：★ 默认，负载均衡        │
│   BROADCASTING（广播）：所有消费者都消费       │
│                                              │
│ 消息类型：                                    │
│   - 普通消息                                  │
│   - ★ 顺序消息（同一 key 进同一队列）         │
│   - ★ 延迟消息（延迟级别）                   │
│   - ★ 事务消息（半消息 + 本地事务 + 回查）    │
│   - 批量消息                                  │
└─────────────────────────────────────────────┘
```

## 3. Spring Boot 整合

```xml
<dependency>
    <groupId>org.apache.rocketmq</groupId>
    <artifactId>rocketmq-spring-boot-starter</artifactId>
    <version>2.3.0</version>
</dependency>
```

```yaml
rocketmq:
  name-server: ${ROCKETMQ_NAMESRV:127.0.0.1:9876}
  producer:
    group: mall-producer-group
    send-message-timeout: 3000
    retry-times-when-send-failed: 2
    retry-times-when-send-async-failed: 2
    max-message-size: 4194304
    compress-message-body-threshold: 4096
```

### 3.1 生产者

```java
@Service
public class RocketMQProducer {
    
    @Autowired
    private RocketMQTemplate rocketMQTemplate;
    
    /**
     * 普通消息（同步发送）
     */
    public SendResult sendOrderCreated(OrderEvent event) {
        Message<OrderEvent> message = MessageBuilder
            .withPayload(event)
            .setHeader(RocketMQHeaders.KEYS, event.getOrderNo())
            .setHeader("traceId", TraceContext.getTraceId())
            .build();
        
        SendResult result = rocketMQTemplate.syncSend("order-topic:created", message);
        log.info("发送订单创建消息: msgId={}, status={}", 
            result.getMsgId(), result.getSendStatus());
        
        if (result.getSendStatus() != SendStatus.SEND_OK) {
            throw new BusinessException("消息发送失败: " + result.getSendStatus());
        }
        return result;
    }
    
    /**
     * ★ 顺序消息（同一订单的操作必须有序）
     */
    public void sendOrderStatusChange(Long orderId, OrderStatus status) {
        Message<OrderStatus> message = MessageBuilder.withPayload(status).build();
        // ★ hashKey = orderId → 同一订单进同一队列
        rocketMQTemplate.syncSendOrderly("order-topic:status", 
            message, String.valueOf(orderId));
    }
    
    /**
     * ★ 延迟消息（订单超时关闭）
     * RocketMQ 延迟级别：
     * 1=1s 2=5s 3=10s 4=30s 5=1m 6=2m 7=3m 8=4m 9=5m 10=6m
     * 11=7m 12=8m 13=9m 14=10m 15=20m 16=30m 17=1h 18=2h
     */
    public void sendDelayClose(String orderNo, int delayLevel) {
        rocketMQTemplate.syncSend("order-topic:delay-close",
            MessageBuilder.withPayload(orderNo).build(),
            3000, delayLevel);
    }
    
    /**
     * ★★ 事务消息（保证本地事务与发消息的原子性）
     */
    public void sendTransactionMessage(OrderEvent event) {
        Message<OrderEvent> message = MessageBuilder
            .withPayload(event)
            .setHeader(RocketMQHeaders.TRANSACTION_ID, event.getOrderNo())
            .build();
        
        // ★ 半消息发送 + 执行本地事务
        rocketMQTemplate.sendMessageInTransaction(
            "order-tx-topic", message, event);
    }
}
```

### 3.2 事务消息监听器

```java
@RocketMQTransactionListener
public class OrderTransactionListener implements RocketMQLocalTransactionListener {
    
    @Autowired
    private OrderService orderService;
    @Autowired
    private OrderMapper orderMapper;
    
    /**
     * ★ 执行本地事务（半消息发送成功后回调）
     */
    @Override
    public RocketMQLocalTransactionState executeLocalTransaction(Message msg, Object arg) {
        OrderEvent event = (OrderEvent) arg;
        try {
            orderService.createInTransaction(event);
            log.info("本地事务成功，提交消息: {}", event.getOrderNo());
            return RocketMQLocalTransactionState.COMMIT;
        } catch (Exception e) {
            log.error("本地事务失败，回滚消息: {}", event.getOrderNo(), e);
            return RocketMQLocalTransactionState.ROLLBACK;
        }
    }
    
    /**
     * ★ 事务回查（Broker 未收到确认时调用）
     * 必须实现幂等
     */
    @Override
    public RocketMQLocalTransactionState checkLocalTransaction(Message msg) {
        String orderNo = (String) msg.getHeaders().get(RocketMQHeaders.TRANSACTION_ID);
        Order order = orderMapper.selectByOrderNo(orderNo);
        
        if (order != null) {
            log.info("回查：订单已存在，提交: {}", orderNo);
            return RocketMQLocalTransactionState.COMMIT;
        } else {
            log.warn("回查：订单不存在，回滚: {}", orderNo);
            return RocketMQLocalTransactionState.ROLLBACK;
        }
    }
}
```

### 3.3 消费者

```java
@Component
@Slf4j
public class OrderMessageConsumer {
    
    @Autowired
    private IdempotentService idempotentService;
    @Autowired
    private OrderHandler orderHandler;
    
    /**
     * ★ 消费者（幂等是核心）
     */
    @RocketMQMessageListener(
        topic = "order-topic",
        selectorExpression = "created || status",  // tag 过滤
        consumerGroup = "order-consumer-group",
        messageModel = MessageModel.CLUSTERING,
        consumeMode = ConsumeMode.CONCURRENT,
        consumeThreadMax = 64,
        maxReconsumeTimes = 5,        // ★ 最大重试次数
        consumeTimeout = 15           // 分钟
    )
    public void onMessage(OrderMessage message) {
        String msgId = message.getMsgId();
        
        // ★ 幂等检查
        if (!idempotentService.tryAcquire("rocket:order:" + msgId, Duration.ofDays(7))) {
            log.warn("消息已处理: {}", msgId);
            return;
        }
        
        try {
            orderHandler.handle(message);
        } catch (BusinessException e) {
            // 业务异常：不重试，记死信
            idempotentService.release("rocket:order:" + msgId);
            deadLetterService.save(message, e.getMessage());
        } catch (Exception e) {
            // 系统异常：释放幂等标记，抛异常触发重试
            idempotentService.release("rocket:order:" + msgId);
            throw e;
        }
    }
}
```

## 4. 事务消息原理

```
┌─────────────────────────────────────────────┐
│ RocketMQ 事务消息流程                        │
├─────────────────────────────────────────────┤
│                                              │
│ 1. Producer 发送半消息（Half Message）       │
│    → 半消息对消费者不可见                    │
│                                              │
│ 2. 半消息发送成功 → 执行本地事务              │
│    → 成功：COMMIT                            │
│    → 失败：ROLLBACK                          │
│                                              │
│ 3. Broker 收到 COMMIT → 消息对消费者可见      │
│    Broker 收到 ROLLBACK → 删除半消息          │
│                                              │
│ 4. ★ 事务回查（Producer 异常未回复时）       │
│    Broker 定时回查 Producer                   │
│    → Producer 检查本地事务状态                │
│    → 返回 COMMIT 或 ROLLBACK                  │
│                                              │
│ ★ 保证了「本地事务」与「发消息」的原子性      │
│ ★ 比本地消息表方案更优雅                      │
└─────────────────────────────────────────────┘
```

## 5. 常见问题

```
┌─────────────────────────────────────────────┐
│ RocketMQ 常见问题                            │
├─────────────────────────────────────────────┤
│ 1. 消息丢失                                   │
│    - 生产端：同步发送 + 重试                   │
│    - Broker：同步刷盘 + 主从同步              │
│    - 消费端：手动 ACK + 幂等                  │
│                                              │
│ 2. 消息重复                                  │
│    - MQ 保证「至少一次」                     │
│    - ★ 消费者幂等                            │
│                                              │
│ 3. 消息顺序                                  │
│    - ★ 同 key 路由到同一队列                 │
│    - ConsumeMode.ORDERLY 顺序消费            │
│    - 代价：并发度降低                        │
│                                              │
│ 4. 消息积压                                  │
│    - 扩容消费者实例                          │
│    - 增加 consumeThreadMax                   │
│    - 临时 Topic 转储                         │
│                                              │
│ 5. 延迟级别有限                              │
│    - 18 个固定级别（1s~2h）                  │
│    - ★ RocketMQ 5.x 支持任意延迟             │
│    - 或用 Redis ZSet + 定时轮询替代          │
│                                              │
│ 6. 事务消息回查超时                          │
│    - 回查默认 60 秒                          │
│    - 长事务需调大 transactionTimeout         │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/消息队列/消息队列概述与选型]]：MQ 选型
- [[后端/消息队列/消息可靠性与常见问题]]：可靠性方案
- [[后端/SpringBoot/测试与常用整合实战]]：Spring Boot 整合 RocketMQ
- [[后端/Spring/事务管理与失效场景]]：事务消息与本地事务
