---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - 消息队列
  - 可靠性
  - 幂等
  - 最终一致性
---

# 消息可靠性与常见问题

> **核心定位**：消息队列的可靠性是生产环境的核心关注点。本文系统梳理消息丢失、重复、顺序、积压四大问题的通用解决方案，适用于 RabbitMQ / RocketMQ / Kafka。

## 1. 消息可靠性全景

```
┌─────────────────────────────────────────────┐
│ 消息可靠性三大环节                            │
├─────────────────────────────────────────────┤
│                                              │
│  Producer → Broker → Consumer                │
│                                              │
│  ① 生产端可靠：消息不丢                       │
│     - 同步发送 + 确认机制                    │
│     - 失败重试                               │
│     - 本地消息表兜底                         │
│                                              │
│  ② Broker 可靠：存储不丢                     │
│     - 持久化（磁盘）                         │
│     - 主从副本                               │
│     - 同步刷盘                               │
│                                              │
│  ③ 消费端可靠：处理不丢                       │
│     - 手动 ACK                              │
│     - 处理完成后再 ACK                       │
│     - 死信队列兜底                           │
│                                              │
│  ★ 通用原则：                                │
│  - 生产端：确认 + 重试                       │
│  - Broker：持久化 + 副本                     │
│  - 消费端：手动 ACK + 幂等 + 死信            │
└─────────────────────────────────────────────┘
```

## 2. 消息丢失

### 2.1 生产端丢失

```java
// ─── 场景1：网络异常导致发送失败 ───
// 解决：同步发送 + 重试 + 本地消息表

@Service
public class ReliableMessageService {
    
    @Autowired
    private MessageMapper messageMapper;  // 本地消息表
    @Autowired
    private MQProducer mqProducer;
    
    /**
     * ★★ 本地消息表方案（保证业务操作与发消息的原子性）
     */
    @Transactional(rollbackFor = Exception.class)
    public void createOrder(OrderDTO dto) {
        // 1. 业务操作
        Order order = orderMapper.insert(dto);
        
        // 2. ★ 消息存入本地表（与业务同一事务）
        LocalMessage msg = new LocalMessage();
        msg.setMessageId(UUID.randomUUID().toString());
        msg.setTopic("order-topic");
        msg.setPayload(JSON.toJSONString(new OrderEvent(order)));
        msg.setStatus(MessageStatus.PENDING);
        msg.setRetryCount(0);
        msg.setNextRetryTime(LocalDateTime.now());
        messageMapper.insert(msg);
        
        // 3. ★ 尝试发送 MQ（失败不影响事务）
        try {
            mqProducer.send(msg);
            messageMapper.updateStatus(msg.getId(), MessageStatus.SENT);
        } catch (Exception e) {
            log.warn("MQ 发送失败，等待定时重试: {}", msg.getMessageId());
            // ★ 事务提交后由定时任务补偿
        }
    }
    
    /**
     * ★ 定时补偿任务（扫描未发送的消息）
     */
    @Scheduled(fixedDelay = 5000)
    public void compensateUnsentMessages() {
        List<LocalMessage> pending = messageMapper.selectPending(100);
        for (LocalMessage msg : pending) {
            try {
                mqProducer.send(msg);
                messageMapper.updateStatus(msg.getId(), MessageStatus.SENT);
            } catch (Exception e) {
                messageMapper.incrementRetry(msg.getId());
                if (msg.getRetryCount() >= 5) {
                    messageMapper.updateStatus(msg.getId(), MessageStatus.FAILED);
                    alertService.send("消息发送失败: " + msg.getMessageId());
                }
            }
        }
    }
}

// 本地消息表
CREATE TABLE local_message (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    message_id VARCHAR(64) UNIQUE COMMENT '消息唯一ID',
    topic VARCHAR(100) COMMENT 'MQ主题',
    tag VARCHAR(50) COMMENT '标签',
    payload TEXT COMMENT '消息内容JSON',
    status TINYINT COMMENT '0-待发送 1-已发送 2-失败',
    retry_count INT DEFAULT 0,
    max_retry INT DEFAULT 5,
    next_retry_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status_retry (status, next_retry_time)
);
```

### 2.2 Broker 丢失

```
┌─────────────────────────────────────────────┐
│ Broker 端防丢失配置                           │
├─────────────────────────────────────────────┤
│ RabbitMQ:                                    │
│   - Queue：durable=true                     │
│   - Message：deliveryMode=2（持久化）         │
│                                              │
│ RocketMQ:                                    │
│   - flushDiskType=SYNC_FLUSH（同步刷盘）     │
│   - brokerRole=SYNC_MASTER（主从同步）       │
│                                              │
│ Kafka:                                       │
│   - acks=all（ISR 全确认）                    │
│   - replication.factor >= 3（至少3副本）     │
│   - min.insync.replicas=2（至少2个同步）      │
│   - unclean.leader.election.enable=false     │
│     （禁止非 ISR 副本当 Leader）              │
└─────────────────────────────────────────────┘
```

### 2.3 消费端丢失

```java
// ─── 消费端防丢失：手动 ACK + 处理完成后再确认 ───

// RabbitMQ
@RabbitListener(queues = "order.queue")
public void handle(Message message, Channel channel, long tag) throws IOException {
    try {
        // 1. 处理业务
        orderService.process(message);
        
        // 2. ★ 处理成功后再 ACK
        channel.basicAck(tag, false);
        
    } catch (BusinessException e) {
        // 3. 业务异常：ACK + 死信（不重试）
        channel.basicAck(tag, false);
        deadLetterService.save(message);
    } catch (Exception e) {
        // 4. 系统异常：NACK + 重新入队（重试）
        channel.basicNack(tag, false, true);
        // ★ 达到最大重试次数后进入死信队列
    }
}

// RocketMQ：消费者返回状态决定是否重试
// RECONSUME_LATER → 重新投递
// SUCCESS → 不重试

// Kafka：手动提交 Offset
@KafkaListener(topics = "order-events")
public void handle(ConsumerRecord<String, Object> record, Acknowledgment ack) {
    try {
        orderService.process(record.value());
        ack.acknowledge();  // ★ 处理成功后才提交
    } catch (Exception e) {
        // ★ 不提交 → 下次重新消费
    }
}
```

## 3. 消息重复（幂等）

```
┌─────────────────────────────────────────────┐
│ 消息重复的原因                                │
├─────────────────────────────────────────────┤
│ 1. 生产端重试：网络超时但消息已到 Broker      │
│ 2. 消费端 rebalance：Offset 未提交导致重消费  │
│ 3. MQ 的「至少一次」语义                      │
│                                              │
│ ★ 解决方案（消费者幂等）：                    │
│ 1. 唯一 ID 去重（Redis/数据库）               │
│ 2. 业务状态判断（订单已支付则不重复支付）     │
│ 3. 数据库唯一约束（INSERT 失败即重复）        │
│ 4. 乐观锁（version 校验）                    │
└─────────────────────────────────────────────┘
```

```java
@Service
public class IdempotentService {
    
    @Autowired
    private StringRedisTemplate redisTemplate;
    
    /**
     * ★ 幂等检查（基于 Redis SETNX）
     */
    public boolean tryAcquire(String key, Duration expire) {
        Boolean success = redisTemplate.opsForValue()
            .setIfAbsent(key, "1", expire);
        return Boolean.TRUE.equals(success);
    }
    
    public void release(String key) {
        redisTemplate.delete(key);
    }
}

// 使用示例
public void consume(OrderMessage message) {
    String idempotentKey = "mq:order:" + message.getMsgId();
    
    // ★ 幂等检查
    if (!idempotentService.tryAcquire(idempotentKey, Duration.ofDays(7))) {
        log.warn("消息已处理: {}", message.getMsgId());
        return;  // 跳过
    }
    
    try {
        // 业务处理
        orderService.handle(message);
    } catch (Exception e) {
        idempotentService.release(idempotentKey);  // ★ 失败释放标记（允许重试）
        throw e;
    }
}
```

## 4. 消息顺序

```java
/**
 * ★ 顺序消息方案
 * 
 * 原理：同一业务 Key 的消息路由到同一队列
 * RocketMQ：sendOrderly（hashKey 路由）
 * Kafka：send(topic, key, value)（key 路由到同分区）
 */
public void sendOrderEvent(Long orderId, OrderEvent event) {
    // ★ key = orderId → 同一订单的事件在同一队列（保证顺序）
    mqProducer.send("order-events", String.valueOf(orderId), event);
}

// 消费端：顺序消费（单线程消费同一队列）
// RocketMQ: ConsumeMode.ORDERLY
// Kafka: 单分区单消费者
```

## 5. 消息积压

```
┌─────────────────────────────────────────────┐
│ 消息积压处理方案                              │
├─────────────────────────────────────────────┤
│                                              │
│ 1. ★ 扩容消费者                               │
│    - 增加消费者实例数（分区数 >= 消费者数）   │
│    - 增加消费线程数                          │
│                                              │
│ 2. 批量消费                                  │
│    - 一次拉取多条消息批量处理                 │
│    - 批量写入数据库                          │
│                                              │
│ 3. 临时 Topic 转储                           │
│    - 原始消费者只做转发                       │
│    - 转发到新 Topic（更多分区）               │
│    - 扩容新 Topic 的消费者                   │
│    - 积压清完后恢复                          │
│                                              │
│ 4. 降级处理                                  │
│    - 丢弃非关键消息                          │
│    - 降低消费精度（如采样）                  │
│                                              │
│ 5. 告警                                      │
│    - 监控积压量，超阈值告警                  │
│    - 自动触发扩容                            │
└─────────────────────────────────────────────┘
```

## 6. 死信处理

```java
/**
 * ★ 死信队列处理流程
 * 
 * 1. 消息达到最大重试次数 → 进入死信队列
 * 2. 死信队列消费者 → 存入数据库
 * 3. 人工/定时任务处理
 */
@Component
@Slf4j
public class DeadLetterHandler {
    
    @Autowired
    private DeadLetterMapper deadLetterMapper;
    
    @RabbitListener(queues = "order.dead.queue")
    public void handleDeadLetter(Message message) {
        DeadLetterRecord record = new DeadLetterRecord();
        record.setMessageId(message.getMessageProperties().getMessageId());
        record.setPayload(new String(message.getBody()));
        record.setReason("达到最大重试次数");
        record.setStatus(0);  // 待处理
        record.setCreateTime(LocalDateTime.now());
        deadLetterMapper.insert(record);
        
        // ★ 告警
        alertService.send("死信消息: " + record.getMessageId());
    }
    
    /**
     * ★ 定时处理死信（重放或人工审核）
     */
    @Scheduled(cron = "0 */30 * * * ?")
    public void processDeadLetters() {
        List<DeadLetterRecord> pending = deadLetterMapper.selectPending();
        for (DeadLetterRecord record : pending) {
            try {
                // 重新处理
                orderService.process(JSON.parseObject(record.getPayload(), OrderMessage.class));
                deadLetterMapper.updateStatus(record.getId(), 1);  // 已处理
            } catch (Exception e) {
                log.error("死信重放失败: {}", record.getMessageId(), e);
            }
        }
    }
}
```

## 7. 最终一致性方案对比

```
┌─────────────────────────────────────────────┐
│ 分布式事务最终一致性方案对比                   │
├─────────────────────────────────────────────┤
│                                              │
│ 1. 本地消息表                                │
│    - 业务 + 消息在同一事务                    │
│    - 定时补偿发送                            │
│    - ★ 通用、简单、可靠                       │
│    - 缺点：需要数据库表                      │
│                                              │
│ 2. RocketMQ 事务消息                         │
│    - 半消息 + 本地事务 + 回查                │
│    - ★ 无需额外表                            │
│    - 缺点：依赖 RocketMQ                      │
│                                              │
│ 3. 事务 Outbox 模式                          │
│    - 类似本地消息表，更规范                  │
│    - CDC（Debezium）监听 binlog               │
│    - ★ 无侵入                                │
│                                              │
│ 4. 最大努力通知                              │
│    - 发消息后不保证一定送达                  │
│    - 对方主动查询                            │
│    - 适合：支付回调                          │
│                                              │
│ ★ 推荐：                                     │
│   - 用 RocketMQ → 事务消息                   │
│   - 不用 RocketMQ → 本地消息表              │
└─────────────────────────────────────────────┘
```

## 8. 常见问题速查表

```
┌─────────────────────────────────────────────┐
│ 消息可靠性常见问题速查                        │
├─────────────────────────────────────────────┤
│ 问题           │ 方案                        │
├────────────────┼───────────────────────────┤
│ 生产端丢消息    │ 同步发送+重试+本地消息表    │
│ Broker 丢消息   │ 持久化+副本+同步刷盘        │
│ 消费端丢消息    │ 手动ACK+处理后确认          │
│ 消息重复        │ ★ 消费者幂等（唯一ID去重） │
│ 消息无序        │ 同key路由同队列+顺序消费    │
│ 消息积压        │ 扩容+批量消费+临时转储      │
│ 死信处理        │ 死信队列+数据库记录+告警    │
│ 分布式事务      │ 本地消息表/事务消息         │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/消息队列/消息队列概述与选型]]：MQ 选型
- [[后端/消息队列/RabbitMQ核心与Java整合]]：RabbitMQ
- [[后端/消息队列/RocketMQ]]：RocketMQ
- [[后端/消息队列/Kafka]]：Kafka
- [[后端/Spring/事务管理与失效场景]]：事务与消息
- [[后端/微服务/Seata分布式事务]]：分布式事务
- [[后端/中间件/Redis在Java项目中的整合]]：Redis 幂等
