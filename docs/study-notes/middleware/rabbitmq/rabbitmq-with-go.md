---
title: "Go操作RabbitMQ"
tags:
  - "后端"
  - "rabbitmq"
  - "go"
  - "笔记"
category: "后端"
folder: "Go"
parent: "[[后端/Go/RabbitMQ概述]]"
related:
  - "[[后端/Go/RabbitMQ封装实践]]"
  - "[[目录]]"
created: 2025-12-06
updated: 2026-09-06
---

# Go 中使用 RabbitMQ
要在 `Go` 中使用 `RabbitMQ`，您需要使用 `RabbitMQ` 的官方 `Go` 客户端库，它叫做 "`amqp`"。以下是一个简单的示例，展示了如何在 `Go` 中使用 `RabbitMQ` 发送正常消息和延时消息。

首先，确保您已经安装 `RabbitMQ` 并且 `RabbitMQ` 服务器正在运行。

**安装 "amqp" Go 客户端库:**
~~~shell
go get github.com/streadway/amqp
~~~

## 发送正常消息
~~~go
package main

import (
    "fmt"
    "log"

    "github.com/streadway/amqp"
)

func main() {
    // 连接 RabbitMQ 服务器
    conn, err := amqp.Dial("amqp://guest:guest@localhost:5672/")
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    // 创建一个通道
    ch, err := conn.Channel()
    if err != nil {
        log.Fatal(err)
    }
    defer ch.Close()

    // 声明一个队列
    queueName := "myqueue"
    _, err = ch.QueueDeclare(
        queueName, // 队列名称
        false,     // 持久性
        false,     // 自动删除
        false,     // 排他性
        false,     // 不阻塞
        nil,       // 额外参数
    )
    if err != nil {
        log.Fatal(err)
    }

    // 发送消息到队列
    message := "Hello, RabbitMQ!"
    err = ch.Publish(
        "",        // 交换机
        queueName, // 队列名称
        false,     // 强制
        false,     // 立即
        amqp.Publishing{
            ContentType: "text/plain",
            Body:        []byte(message),
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Sent message: %s\n", message)
}
~~~

## 发送延时消息
要发送延时消息，您可以结合 `RabbitMQ` 的 `TTL（Time-To-Live`）和**死信队列机制**。以下是一个示例代码，用于发送延时消息：
~~~go
package main

import (
    "fmt"
    "log"

    "github.com/streadway/amqp"
)

func main() {
    // 连接 RabbitMQ 服务器
    conn, err := amqp.Dial("amqp://guest:guest@localhost:5672/")
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    // 创建一个通道
    ch, err := conn.Channel()
    if err != nil {
        log.Fatal(err)
    }
    defer ch.Close()

    // 声明一个交换机
    exchangeName := "delayed-exchange"
    err = ch.ExchangeDeclare(
        exchangeName, // 交换机名称
        "x-delayed-message", // 交换机类型，注意这是 RabbitMQ 插件 "rabbitmq_delayed_message_exchange" 的类型
        true,  // 持久性
        false, // 自动删除
        false, // 内部
        false, // 不阻塞
        map[string]interface{}{
            "x-delayed-type": "direct", // 声明交换机的类型，direct、topic、fanout 等
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    // 声明一个队列
    queueName := "delayed-queue"
    _, err = ch.QueueDeclare(
        queueName, // 队列名称
        true,      // 持久性
        false,     // 自动删除
        false,     // 排他性
        false,     // 不阻塞
        map[string]interface{}{
            "x-message-ttl":    5000, // 消息的 TTL，以毫秒为单位
            "x-dead-letter-exchange":    "",
            "x-dead-letter-routing-key": "myqueue", // 死信消息发送的目标队列
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    // 发送消息到队列
    message := "Hello, Delayed RabbitMQ!"
    err = ch.Publish(
        exchangeName, // 交换机
        "",           // 队列名称
        false,        // 强制
        false,        // 立即
        amqp.Publishing{
            ContentType: "text/plain",
            Body:        []byte(message),
        },
    )
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Sent delayed message: %s\n", message)
}
~~~
在上述代码中，我们创建了一个交换机类型为 "`x-delayed-message`" 的交换机，并设置了消息的 `TTL（Time-To-Live）` 为 5 秒。这会导致消息被延时发送到队列，然后通过死信队列机制发送到目标队列（"`myqueue`"）。
::: tip
请确保在代码中的连接字符串、队列名称和其他参数中适当配置您的 `RabbitMQ` 环境。
:::
