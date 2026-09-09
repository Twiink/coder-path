---
title: "RabbitMQ封装实践"
tags:
  - "后端"
  - "rabbitmq"
  - "go"
  - "笔记"
category: "后端"
folder: "Go"
parent: "[[后端/Go/Go操作RabbitMQ]]"
related:
  - "[[后端/Go/RabbitMQ概述]]"
  - "[[目录]]"
created: 2025-12-06
updated: 2026-09-06
---

# RabbitMQ 封装的完整代码

## 封装代码
~~~go
package rabbitmq

import (
    "fmt"
    "log"
    "strconv"
    "strings"
    "yoyo/pkg/config"

    "github.com/streadway/amqp"
)

// 消息体：DelayTime 仅在 SendDelayMessage 方法有效
type Message struct &#123;
    DelayTime int // desc:延迟时间(秒)
    Body      string
&#125;

type MessageQueue struct &#123;
    conn         *amqp.Connection // amqp链接对象
    ch           *amqp.Channel    // channel对象
    ExchangeName string           // 交换器名称
    RouteKey     string           // 路由名称
    QueueName    string           // 队列名称
&#125;

// 消费者回调方法
type Consumer func(amqp.Delivery)

// NewRabbitMQ 新建 rabbitmq 实例
func NewRabbitMQ(exchange, route, queue string) MessageQueue &#123;
    var messageQueue = MessageQueue&#123;
        ExchangeName: exchange,
        RouteKey:     route,
        QueueName:    queue,
    &#125;

    // 建立amqp链接
    conn, err := amqp.Dial(fmt.Sprintf(
        "amqp://%s:%s@%s:%s%s",
        config.Viper.GetString("rabbitmq.username"),
        config.Viper.GetString("rabbitmq.password"),
        config.Viper.GetString("rabbitmq.host"),
        config.Viper.GetString("rabbitmq.port"),
        "/"+strings.TrimPrefix(config.Viper.GetString("rabbitmq.vhost"), "/"),
    ))
    failOnError(err, "Failed to connect to RabbitMQ")
    messageQueue.conn = conn

    // 建立channel通道
    ch, err := conn.Channel()
    failOnError(err, "Failed to open a channel")
    messageQueue.ch = ch

    // 声明exchange交换器
    messageQueue.declareExchange(exchange, nil)

    return messageQueue
&#125;

// SendMessage 发送普通消息
func (mq *MessageQueue) SendMessage(message Message) &#123;
    err := mq.ch.Publish(
        mq.ExchangeName, // exchange
        mq.RouteKey,     // route key
        false,
        false,
        amqp.Publishing&#123;
            ContentType: "text/plain",
            Body:        []byte(message.Body),
        &#125;,
    )
    failOnError(err, "send common msg err")
&#125;

// SendDelayMessage 发送延迟消息
func (mq *MessageQueue) SendDelayMessage(message Message) &#123;
    delayQueueName := mq.QueueName + "_delay:" + strconv.Itoa(message.DelayTime)
    delayRouteKey := mq.RouteKey + "_delay:" + strconv.Itoa(message.DelayTime)

    // 定义延迟队列(死信队列)
    dq := mq.declareQueue(
        delayQueueName,
        amqp.Table&#123;
            "x-dead-letter-exchange":    mq.ExchangeName, // 指定死信交换机
            "x-dead-letter-routing-key": mq.RouteKey,     // 指定死信routing-key
        &#125;,
    )

    // 延迟队列绑定到exchange
    mq.bindQueue(dq.Name, delayRouteKey, mq.ExchangeName)

    // 发送消息，将消息发送到延迟队列，到期后自动路由到正常队列中
    err := mq.ch.Publish(
        mq.ExchangeName,
        delayRouteKey,
        false,
        false,
        amqp.Publishing&#123;
            ContentType: "text/plain",
            Body:        []byte(message.Body),
            Expiration:  strconv.Itoa(message.DelayTime * 1000),
        &#125;,
    )
    failOnError(err, "send delay msg err")
&#125;

// Consume 获取消费消息
func (mq *MessageQueue) Consume(fn Consumer) &#123;
    // 声明队列
    q := mq.declareQueue(mq.QueueName, nil)

    // 队列绑定到exchange
    mq.bindQueue(q.Name, mq.RouteKey, mq.ExchangeName)

    // 设置Qos
    err := mq.ch.Qos(1, 0, false)
    failOnError(err, "Failed to set QoS")

    // 监听消息
    msgs, err := mq.ch.Consume(
        q.Name, // queue name,
        "",     // consumer
        false,  // auto-ack
        false,  // exclusive
        false,  // no-local
        false,  // no-wait
        nil,    // args
    )
    failOnError(err, "Failed to register a consumer")

    // forever := make(chan bool), 注册在主进程，不需要阻塞

    go func() &#123;
        for d := range msgs &#123;
            fn(d)
            d.Ack(false)
        &#125;
    &#125;()

    log.Printf(" [*] Waiting for logs. To exit press CTRL+C")
    // <-forever
&#125;

// Close 关闭链接
func (mq *MessageQueue) Close() &#123;
    mq.ch.Close()
    mq.conn.Close()
&#125;

// declareQueue 定义队列
func (mq *MessageQueue) declareQueue(name string, args amqp.Table) amqp.Queue &#123;
    q, err := mq.ch.QueueDeclare(
        name,
        true,
        false,
        false,
        false,
        args,
    )
    failOnError(err, "Failed to declare a delay_queue")

    return q
&#125;

// declareQueue 定义交换器
func (mq *MessageQueue) declareExchange(exchange string, args amqp.Table) &#123;
    err := mq.ch.ExchangeDeclare(
        exchange,
        "direct",
        true,
        false,
        false,
        false,
        args,
    )
    failOnError(err, "Failed to declare an exchange")
&#125;

// bindQueue 绑定队列
func (mq *MessageQueue) bindQueue(queue, routekey, exchange string) &#123;
    err := mq.ch.QueueBind(
        queue,
        routekey,
        exchange,
        false,
        nil,
    )
    failOnError(err, "Failed to bind a queue")
&#125;

// failOnError 错误处理
func failOnError(err error, msg string) &#123;
    if err != nil &#123;
        log.Fatalf("%s : %s", msg, err)
    &#125;
&#125;
~~~

## 消费消息
~~~go
func registerRabbitMQConsumer() &#123;
    // 新建连接
    rabbit := rabbitmq.NewRabbitMQ("yoyo_exchange", "yoyo_route", "yoyo_queue")
    // 一般来说消费者不关闭，常驻进程进行消息消费处理
    // defer rabbit.Close() 

    // 执行消费
    rabbit.Consume(func(d amqp.Delivery) &#123;
        //logger.Info("rabbitmq", zap.String("rabbitmq", string(d.Body)))
    &#125;)
&#125;
~~~

## 发送消息
~~~go
rabbit := rabbitmq.NewRabbitMQ("yoyo_exchange", "yoyo_route", "yoyo_queue")
defer rabbit.Close()
rabbit.SendMessage(rabbitmq.Message对象(Body属性))
rabbit.SendDelayMessage(rabbitmq.Message对象(Body属性))
~~~
