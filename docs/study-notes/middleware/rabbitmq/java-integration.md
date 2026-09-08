---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - RabbitMQ
  - AMQP
  - 消息队列
---

# RabbitMQ核心与Java整合

> **核心定位**：RabbitMQ 是基于 AMQP 协议的企业级消息中间件，以低延迟、丰富路由、高可靠性著称。

## 1. RabbitMQ 核心概念

```
┌─────────────────────────────────────────────┐
│ RabbitMQ 消息流转模型                         │
├─────────────────────────────────────────────┤
│                                              │
│  Producer                                     │
│      │                                       │
│      ↓ Exchange（交换机）                     │
│      │   ├── Direct：精确路由（routing key）  │
│      │   ├── Topic：模式匹配（*.order.*）     │
│      │   ├── Fanout：广播（忽略 key）         │
│      │   └── Headers：头部匹配               │
│      │                                       │
│      ↓ Binding（绑定）                        │
│      │   Exchange → Queue 的绑定关系          │
│      │                                       │
│      ↓ Queue（队列）                          │
│      │   消息存储（FIFO）                     │
│      │                                       │
│      ↓ Consumer                              │
│          消费消息                             │
│                                              │
│  关键概念：                                   │
│    - Routing Key：路由键                      │
│    - Binding Key：绑定键                      │
│    - Virtual Host：虚拟主机（隔离）          │
│    - Connection：TCP 连接                     │
│    - Channel：虚拟连接（复用 TCP）           │
└─────────────────────────────────────────────┘
```

## 2. 四种 Exchange 类型

```java
// ─── 1. Direct Exchange（精确匹配）───
// routing key = "order.create" → 只路由到 binding key = "order.create" 的队列

// ─── 2. Topic Exchange（模式匹配）─── ★ 最常用
// routing key = "order.create.success"
// binding key = "order.#" → 匹配（# 匹配零或多个词）
// binding key = "order.create.*" → 匹配（* 匹配一个词）
// binding key = "order.#.fail" → 不匹配

// ─── 3. Fanout Exchange（广播）───
// 忽略 routing key，消息发送到所有绑定的队列

// ─── 4. Headers Exchange（头部匹配）───
// 根据 message header 匹配，性能差，少用
```

## 3. Spring Boot 整合

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

```yaml
spring:
  rabbitmq:
    host: localhost
    port: 5672
    username: guest
    password: guest
    virtual-host: /
    publisher-confirm-type: correlated  # ★ 发布确认
    publisher-returns: true             # ★ 消息返回（路由失败）
    listener:
      simple:
        acknowledge-mode: manual        # ★ 手动 ACK
        prefetch: 10                     # 预取数量
        concurrency: 3                   # 消费者线程数
        max-concurrency: 10
        retry:
          enabled: true
          max-attempts: 3
          initial-interval: 1000ms
```

### 3.1 队列与交换机声明

```java
@Configuration
public class RabbitMQConfig {
    
    // ─── 订单模块 ───
    public static final String ORDER_EXCHANGE = "order.exchange";
    public static final String ORDER_CREATE_QUEUE = "order.create.queue";
    public static final String ORDER_PAY_QUEUE = "order.pay.queue";
    public static final String ORDER_DEAD_QUEUE = "order.dead.queue";  // 死信队列
    
    // ─── 延迟队列（TTL + DLX）───
    public static final String DELAY_EXCHANGE = "delay.exchange";
    public static final String DELAY_QUEUE = "delay.queue";
    
    @Bean
    public TopicExchange orderExchange() {
        return ExchangeBuilder.topicExchange(ORDER_EXCHANGE)
            .durable(true)      // 持久化
            .build();
    }
    
    @Bean
    public Queue orderCreateQueue() {
        return QueueBuilder.durable(ORDER_CREATE_QUEUE)
            .withArgument("x-dead-letter-exchange", ORDER_EXCHANGE)  // 死信交换机
            .withArgument("x-dead-letter-routing-key", "order.dead")
            .withArgument("x-max-priority", 10)  // 优先级队列
            .build();
    }
    
    @Bean
    public Binding orderCreateBinding() {
        return BindingBuilder.bind(orderCreateQueue())
            .to(orderExchange())
            .with("order.create");  // routing key
    }
    
    /**
     * ★ 延迟队列（TTL + 死信交换机）
     */
    @Bean
    public Queue delayQueue() {
        return QueueBuilder.durable(DELAY_QUEUE)
            .withArgument("x-message-ttl", 30000)  // 消息 30 秒后过期
            .withArgument("x-dead-letter-exchange", ORDER_EXCHANGE)
            .withArgument("x-dead-letter-routing-key", "order.close")
            .build();
    }
    
    @Bean
    public TopicExchange delayExchange() {
        return ExchangeBuilder.topicExchange(DELAY_EXCHANGE).durable(true).build();
    }
    
    @Bean
    public Binding delayBinding() {
        return BindingBuilder.bind(delayQueue())
            .to(delayExchange())
            .with("order.delay");
    }
}
```

### 3.2 生产者

```java
@Service
public class OrderMessageProducer {
    
    @Autowired
    private RabbitTemplate rabbitTemplate;
    
    /**
     * 发送消息（可靠投递）
     */
    public void sendOrderCreated(OrderEvent event) {
        CorrelationData correlationData = new CorrelationData(event.getOrderId());
        
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.ORDER_EXCHANGE,
            "order.create",
            event,
            message -> {
                message.getMessageProperties().setMessageId(event.getOrderId());
                message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                message.getMessageProperties().setHeader("traceId", TraceContext.getTraceId());
                return message;
            },
            correlationData  // ★ 用于回调确认
        );
    }
    
    /**
     * ★ 发布确认回调（消息是否到达 Exchange）
     */
    @Autowired
    public void setConfirmCallback(RabbitTemplate rabbitTemplate) {
        rabbitTemplate.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack) {
                log.error("★ 消息未到达 Exchange: correlationData={}, cause={}", 
                    correlationData, cause);
                // 重发或告警
            }
        });
        
        /**
         * ★ 消息返回回调（消息到达 Exchange 但无路由队列）
         */
        rabbitTemplate.setReturnsCallback(returned -> {
            log.error("★ 消息路由失败: exchange={}, routingKey={}, replyCode={}, replyText={}",
                returned.getExchange(),
                returned.getRoutingKey(),
                returned.getReplyCode(),
                returned.getReplyText());
            // 记录到数据库，人工处理
        });
    }
    
    /**
     * ★ 发送延迟消息（订单超时关闭）
     */
    public void sendDelayMessage(String orderId, long delayMillis) {
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.DELAY_EXCHANGE,
            "order.delay",
            orderId,
            message -> {
                message.getMessageProperties().setExpiration(String.valueOf(delayMillis));
                return message;
            }
        );
    }
}
```

### 3.3 消费者

```java
@Component
@Slf4j
public class OrderMessageConsumer {
    
    @Autowired
    private OrderService orderService;
    
    @Autowired
    private IdempotentService idempotentService;
    
    /**
     * ★ 手动 ACK 消费
     */
    @RabbitListener(queues = RabbitMQConfig.ORDER_CREATE_QUEUE)
    public void handleOrderCreated(OrderEvent event, Channel channel, 
                                    long tag) throws IOException {
        String msgId = event.getOrderId();
        log.info("收到订单创建消息: orderId={}", msgId);
        
        try {
            // ★ 幂等检查
            if (!idempotentService.tryAcquire("rabbit:order:" + msgId, Duration.ofDays(7))) {
                log.warn("消息已处理，跳过: {}", msgId);
                channel.basicAck(tag, false);  // ★ 确认（不重新入队）
                return;
            }
            
            // 业务处理
            orderService.handleOrderCreated(event);
            
            // ★ 手动确认
            channel.basicAck(tag, false);
            
        } catch (BusinessException e) {
            // ★ 业务异常：确认（不重试），记录到死信
            log.error("业务异常: {}", e.getMessage());
            channel.basicAck(tag, false);
            deadLetterService.save(event, e.getMessage());
            
        } catch (Exception e) {
            // ★ 系统异常：拒绝并重新入队（重试）
            log.error("系统异常，消息将重试", e);
            // basicNack: requeue=true 重新入队
            channel.basicNack(tag, false, true);
        }
    }
}
```

## 4. 死信队列

```
┌─────────────────────────────────────────────┐
│ 死信队列（Dead Letter Queue）                 │
├─────────────────────────────────────────────┤
│ 消息变为死信的条件：                          │
│ 1. 消息被拒绝（basicNack/basicReject 且      │
│    requeue=false）                           │
│ 2. 消息 TTL 过期                             │
│ 3. 队列达到最大长度                          │
│                                              │
│ 死信队列的应用：                              │
│ - 延迟队列（TTL + DLX）                      │
│ - 失败消息重试                               │
│ - 异常消息人工处理                           │
└─────────────────────────────────────────────┘
```

## 5. 常见问题

```
┌─────────────────────────────────────────────┐
│ RabbitMQ 常见问题                            │
├─────────────────────────────────────────────┤
│ 1. 消息丢失                                   │
│    - 生产端：发布确认 + 返回回调             │
│    - Broker：持久化（durable + persistent）  │
│    - 消费端：手动 ACK                        │
│                                              │
│ 2. 消息重复                                  │
│    - 网络重传                                │
│    - ★ 消费者幂等                            │
│                                              │
│ 3. 消息顺序                                  │
│    - 单队列单消费者                          │
│    - routing key 路由同一队列                │
│                                              │
│ 4. 消息积压                                  │
│    - 扩容消费者                               │
│    - 增加 prefetch                           │
│    - 临时队列转储                             │
│                                              │
│ 5. 延迟队列精度                              │
│    - TTL + DLX 有顺序问题（头部过期）        │
│    - ★ 用 rabbitmq-delayed-message-exchange  │
│      插件解决                                │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/消息队列/消息队列概述与选型]]：MQ 选型
- [[后端/消息队列/消息可靠性与常见问题]]：可靠性方案
- [[后端/SpringBoot/测试与常用整合实战]]：Spring Boot 整合
