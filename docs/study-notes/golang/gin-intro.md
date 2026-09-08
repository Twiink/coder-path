---
title: "Gin框架入门"
tags:
  - "后端"
  - "go"
  - "gin"
  - "笔记"
category: "后端"
folder: "Gin"
parent: "[[目录]]"
related:
  - "[[后端/Gin/请求参数与数据绑定]]"
  - "[[后端/Gin/中间件]]"
  - "[[后端/Go/Go语言概述]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# Gin 框架入门

Gin 是一个用 Go（Golang）编写的 HTTP Web 框架。它是一个类似 Martini 但拥有更好性能的 API 框架，速度提高了 40 倍。如果你需要性能和开发效率，Gin 是个好选择。

[官网地址](https://gin-gonic.com/) | [GitHub 仓库](https://github.com/gin-gonic/gin)

## 特点
- **速度快**：基于 Radix 树的路由，内存占用小，性能高。
- **支持中间件**：请求处理管道中可插入任意中间件。
- **Crash 恢复**：内置 Recovery 中间件，捕获 panic 防止服务崩溃。
- **JSON 校验**：基于 [go-playground/validator](https://github.com/go-playground/validator) 进行 JSON 数据校验。
- **路由分组**：通过路由组更好地组织路由。
- **错误管理**：方便地收集请求中发生的所有错误。

## 安装

首先确保已安装 Go（1.18+），然后创建项目并安装 Gin：

~~~shell
# 初始化模块
mkdir gin-demo && cd gin-demo
go mod init gin-demo

# 安装 gin
go get -u github.com/gin-gonic/gin
~~~

## Hello World

创建 `main.go`：

~~~go
package main

import "github.com/gin-gonic/gin"

func main() {
	// 创建一个默认的路由引擎，包含 Logger 和 Recovery 中间件
	r := gin.Default()

	// 注册 GET 路由
	r.GET("/ping", func(c *gin.Context) {
		// 返回 JSON 数据，状态码 200
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	// 默认监听 0.0.0.0:8080
	r.Run()
}
~~~

运行：
~~~shell
go run main.go
~~~

访问 `http://localhost:8080/ping`，将得到：
```json
{"message":"pong"}
```

::: tip
`gin.H` 是 `map[string]interface{}` 的简写，用于快速构造 JSON 响应。
:::

## 路由基础

Gin 支持所有常见的 HTTP 方法：

~~~go
r.GET("/get", func(c *gin.Context) { c.String(200, "GET") })
r.POST("/post", func(c *gin.Context) { c.String(200, "POST") })
r.PUT("/put", func(c *gin.Context) { c.String(200, "PUT") })
r.DELETE("/delete", func(c *gin.Context) { c.String(200, "DELETE") })
r.PATCH("/patch", func(c *gin.Context) { c.String(200, "PATCH") })
r.HEAD("/head", func(c *gin.Context) { c.String(200, "HEAD") })
r.OPTIONS("/options", func(c *gin.Context) { c.String(200, "OPTIONS") })

// Any 注册所有 HTTP 方法的路由
r.Any("/any", func(c *gin.Context) { c.String(200, "Any") })

// NoRoute 处理所有未匹配的路由（404）
r.NoRoute(func(c *gin.Context) {
	c.JSON(404, gin.H{"msg": "页面不存在"})
})
~~~

## 路由参数

~~~go
// 路径参数 /user/tom
r.GET("/user/:name", func(c *gin.Context) {
	name := c.Param("name")
	c.String(200, "Hello %s", name)
})

// 通配参数 /files/xxx/yyy，*action 匹配 / 后所有内容
r.GET("/files/*filepath", func(c *gin.Context) {
	filepath := c.Param("filepath")
	c.String(200, "文件路径: %s", filepath)
})
~~~

## 路由分组

通过 `Group` 可以将相关路由组织在一起，便于统一添加中间件（如鉴权）：

~~~go
v1 := r.Group("/v1")
{
	v1.GET("/users", func(c *gin.Context) { c.JSON(200, "用户列表") })
	v1.GET("/users/:id", func(c *gin.Context) { c.JSON(200, "用户详情") })
	v1.POST("/users", func(c *gin.Context) { c.JSON(200, "创建用户") })
}

// 带中间件的路由组
auth := r.Group("/admin")
auth.Use(AuthMiddleware()) // 该组下所有路由都会经过鉴权中间件
{
	auth.GET("/dashboard", func(c *gin.Context) { c.JSON(200, "控制台") })
}
~~~

::: tip
`Group` 中的 `{}` 只是代码分块，没有实际作用，纯粹是为了代码可读性。
:::

## 获取客户端信息

~~~go
r.GET("/info", func(c *gin.Context) {
	// 请求方法
	c.JSON(200, gin.H{
		"method": c.Request.Method,
		"path":   c.Request.URL.Path,
		"ip":     c.ClientIP(),
		"ua":     c.Request.UserAgent(),
	})
})
~~~

## 热重载开发

开发时每次修改代码都要手动重启很麻烦，推荐使用 [air](https://github.com/cosmtrek/air) 实现热重载：

~~~shell
go install github.com/cosmtrek/air@latest
# 在项目根目录执行
air
~~~

修改代码后会自动重新编译运行，极大提升开发效率。
