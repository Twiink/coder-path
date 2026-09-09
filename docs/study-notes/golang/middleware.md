---
title: "中间件"
tags:
  - "后端"
  - "go"
  - "gin"
  - "笔记"
category: "后端"
folder: "Gin"
parent: "[[后端/Gin/响应与模板渲染]]"
related:
  - "[[后端/Gin/数据校验]]"
  - "[[后端/Gin/JWT认证]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 中间件

中间件（Middleware）是 Gin 的核心特性之一。它允许在请求到达处理函数前后插入处理逻辑，例如日志记录、鉴权、CORS、限流等。

Gin 的中间件本质上是一个 `gin.HandlerFunc`。每个请求会经过一个中间件链，通过 `c.Next()` 调用下一个处理函数。

## 中间件执行流程

```
请求 → 中间件A(前置) → 中间件B(前置) → 处理函数 → 中间件B(后置) → 中间件A(后置) → 响应
```

`c.Next()` 之前的代码在请求处理前执行，之后的代码在请求处理后执行。

## 内置中间件

`gin.Default()` 会自动注册两个中间件：
- **Logger**：记录请求日志
- **Recovery**：捕获 panic 防止程序崩溃

`gin.New()` 创建不含任何中间件的路由引擎，需要手动添加。

~~~go
// 等价于 gin.Default()
r := gin.New()
r.Use(gin.Logger())
r.Use(gin.Recovery())
~~~

## 自定义中间件

~~~go
// 定义一个计时中间件
func Timing() gin.HandlerFunc &#123;
	return func(c *gin.Context) &#123;
		start := time.Now()

		// 处理请求前
		c.Set("start_time", start)

		// 调用下一个中间件/处理函数
		c.Next()

		// 处理请求后（响应已生成）
		duration := time.Since(start)
		log.Printf("%s %s 耗时: %v", c.Request.Method, c.Request.URL.Path, duration)
	&#125;
&#125;

func main() &#123;
	r := gin.Default()
	r.Use(Timing())
	r.GET("/", func(c *gin.Context) &#123; c.String(200, "ok") &#125;)
	r.Run()
&#125;
~~~

## 中间件的作用域

### 全局中间件

对所有路由生效：
~~~go
r := gin.Default()
r.Use(Timing(), CORS()) // 所有请求都会经过
~~~

### 路由组中间件

只对某个路由组生效：
~~~go
api := r.Group("/api")
api.Use(AuthMiddleware()) // 仅 /api 下路由经过鉴权
&#123;
	api.GET("/users", getUsers)
	api.POST("/users", createUser)
&#125;

// 公开路由不需要鉴权
r.GET("/public", getPublic)
~~~

### 单个路由中间件

~~~go
r.GET("/secret", AuthMiddleware(), func(c *gin.Context) &#123;
	c.JSON(200, gin.H&#123;"msg": "机密数据"&#125;)
&#125;)
~~~

## 中断请求

在中间件中可以直接终止请求，不再调用 `c.Next()`：

~~~go
func AuthMiddleware() gin.HandlerFunc &#123;
	return func(c *gin.Context) &#123;
		token := c.GetHeader("Authorization")
		if token == "" &#123;
			c.AbortWithStatusJSON(401, gin.H&#123;"error": "未授权"&#125;)
			return // 必须 return，停止后续处理
		&#125;
		// 校验 token ...
		c.Set("user_id", 1001) // 设置上下文数据，供后续使用
		c.Next()
	&#125;
&#125;

// 后续处理函数中获取上下文数据
r.GET("/profile", AuthMiddleware(), func(c *gin.Context) &#123;
	uid, _ := c.Get("user_id")
	c.JSON(200, gin.H&#123;"user_id": uid&#125;)
&#125;)
~~~

::: tip
`c.Abort()` 会阻止后续中间件和处理函数执行，但不会中断当前中间件剩余代码，因此通常配合 `return` 使用。`c.AbortWithStatusJSON` 是 `Abort + 写响应` 的快捷方式。
:::

## Next 与 Abort 的原理

Gin 内部维护一个 `HandlersChain`（处理函数切片）和一个 `index`（当前执行位置）：

- `c.Next()`：`index++` 执行下一个 handler，执行完返回后 `index--`
- `c.Abort()`：将 `index` 设为最大值，后续 handler 不再执行

## 常用中间件示例

### CORS 跨域

~~~go
func CORS() gin.HandlerFunc &#123;
	return func(c *gin.Context) &#123;
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if c.Request.Method == "OPTIONS" &#123;
			c.AbortWithStatus(204)
			return
		&#125;
		c.Next()
	&#125;
&#125;
~~~

也可直接使用官方库 `github.com/gin-contrib/cors`。

### 请求日志

~~~go
func Logger() gin.HandlerFunc &#123;
	return func(c *gin.Context) &#123;
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		log.Printf("[GIN] %v | %3d | %13v | %15s | %-7s %s",
			start.Format("2006/01/02 - 15:04:05"),
			c.Writer.Status(),
			time.Since(start),
			c.ClientIP(),
			c.Request.Method,
			path,
		)
	&#125;
&#125;
~~~

### 限流中间件（简单令牌桶）

~~~go
func RateLimit(maxRequests int) gin.HandlerFunc &#123;
	limiter := rate.NewLimiter(rate.Limit(maxRequests), maxRequests)
	return func(c *gin.Context) &#123;
		if !limiter.Allow() &#123;
			c.AbortWithStatusJSON(429, gin.H&#123;"error": "请求过于频繁"&#125;)
			return
		&#125;
		c.Next()
	&#125;
&#125;
~~~

## 中间件复用 goroutine

在中间件中若要启动新 goroutine 处理异步任务，必须使用 `c.Copy()` 复制上下文，因为 `gin.Context` 非并发安全：

~~~go
func AsyncLog() gin.HandlerFunc &#123;
	return func(c *gin.Context) &#123;
		c.Next()
		cc := c.Copy() // 复制一份在 goroutine 中使用
		go func() &#123;
			log.Printf("异步记录: %s %s", cc.Request.Method, cc.Request.URL.Path)
		&#125;()
	&#125;
&#125;
~~~
