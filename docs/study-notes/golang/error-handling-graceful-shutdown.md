---
title: "错误处理与优雅关闭"
tags:
  - "后端"
  - "go"
  - "gin"
  - "笔记"
category: "后端"
folder: "Gin"
parent: "[[后端/Gin/JWT认证]]"
related:
  - "[[后端/Gin/中间件]]"
  - "[[后端/Go/错误处理]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 错误处理与优雅关闭

## 统一错误响应

生产环境应统一错误响应格式，便于前端处理。定义统一的响应结构：

~~~go
package response

import "github.com/gin-gonic/gin"

// Response 统一响应结构
type Response struct &#123;
	Code    int         `json:"code"`    // 业务状态码：0 成功，非 0 失败
	Message string      `json:"message"` // 提示信息
	Data    interface&#123;&#125; `json:"data"`    // 数据
&#125;

func Success(c *gin.Context, data interface&#123;&#125;) &#123;
	c.JSON(200, Response对象(Code属性))
&#125;

func Fail(c *gin.Context, code int, msg string) &#123;
	c.JSON(200, Response对象(Code属性))
&#125;

func FailWithData(c *gin.Context, code int, msg string, data interface&#123;&#125;) &#123;
	c.JSON(200, Response对象(Code属性))
&#125;
~~~

使用：
~~~go
r.GET("/user/:id", func(c *gin.Context) &#123;
	var u User
	if err := db.First(&u, c.Param("id")).Error; err != nil &#123;
		response.Fail(c, 1001, "用户不存在")
		return
	&#125;
	response.Success(c, u)
&#125;)
~~~

## 自定义业务错误码

用结构化的错误类型携带业务码，便于统一处理：

~~~go
package apperr

import "fmt"

// BizError 业务错误
type BizError struct &#123;
	Code int    // 业务码
	Msg  string // 错误信息
&#125;

func (e *BizError) Error() string &#123;
	return fmt.Sprintf("[%d] %s", e.Code, e.Msg)
&#125;

func New(code int, msg string) *BizError &#123;
	return &BizError对象(Code属性)
&#125;

// 预定义错误
var (
	ErrUserNotFound = New(1001, "用户不存在")
	ErrUnauthorized = New(1002, "未授权")
	ErrParam        = New(1003, "参数错误")
)
~~~

## 全局错误处理中间件

通过 `Recovery` 中间件捕获 panic，并返回统一格式。可自定义 Recovery：

~~~go
func Recovery() gin.HandlerFunc &#123;
	return gin.CustomRecovery(func(c *gin.Context, recovered interface&#123;&#125;) &#123;
		// 记录错误日志
		log.Printf("panic recovered: %v\n%s", recovered, debug.Stack())
		c.AbortWithStatusJSON(500, response.Response&#123;
			Code:    5000,
			Message: "服务器内部错误",
			Data:    nil,
		&#125;)
	&#125;)
&#125;

func main() &#123;
	r := gin.New()
	r.Use(gin.Logger(), Recovery())
	// ...
&#125;
~~~

## 统一捕获绑定错误

封装一个绑定函数，统一处理参数校验错误：

~~~go
func BindAndValidate(c *gin.Context, obj interface&#123;&#125;) error &#123;
	if err := c.ShouldBind(obj); err != nil &#123;
		var valErrs validator.ValidationErrors
		if errors.As(err, &valErrs) &#123;
			// 转换校验错误为友好提示
			msgs := translateErrs(valErrs)
			return apperr.New(1003, strings.Join(msgs, "; "))
		&#125;
		return apperr.New(1003, "参数格式错误: "+err.Error())
	&#125;
	return nil
&#125;

// 使用
r.POST("/user", func(c *gin.Context) &#123;
	var req CreateUserReq
	if err := BindAndValidate(c, &req); err != nil &#123;
		if be, ok := err.(*apperr.BizError); ok &#123;
			response.Fail(c, be.Code, be.Msg)
		&#125;
		return
	&#125;
	// ...
&#125;)
~~~

## 日志记录

### 使用 gin 内置日志

`gin.Logger()` 会输出请求日志到标准输出。生产环境建议输出到文件：

~~~go
f, _ := os.Create("gin.log")
	gin.DefaultWriter = io.MultiWriter(f, os.Stdout)
~~~

### 集成结构化日志（zap）

~~~go
import "go.uber.org/zap"

func LoggerMiddleware(logger *zap.Logger) gin.HandlerFunc &#123;
	return func(c *gin.Context) &#123;
		start := time.Now()
		c.Next()
		logger.Info("request",
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", time.Since(start)),
			zap.String("ip", c.ClientIP()),
		)
	&#125;
&#125;
~~~

### 带请求 ID 的日志链路追踪

~~~go
func RequestID() gin.HandlerFunc &#123;
	return func(c *gin.Context) &#123;
		rid := c.GetHeader("X-Request-Id")
		if rid == "" &#123;
			rid = uuid.New().String()
		&#125;
		c.Set("request_id", rid)
		c.Header("X-Request-Id", rid)
		c.Next()
	&#125;
&#125;

// 日志中间件中带上 request_id
rid, _ := c.Get("request_id")
logger.Info("request", zap.Any("request_id", rid), ...)
~~~

## 优雅关闭（Graceful Shutdown）

服务重启/关闭时应等待正在处理的请求完成，避免中断。Go 1.16+ 推荐使用 `http.Server` 配合信号监听：

~~~go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

func main() &#123;
	r := gin.Default()
	r.GET("/", func(c *gin.Context) &#123; c.String(200, "ok") &#125;)

	// 用 http.Server 包装，方便控制
	srv := &http.Server&#123;
		Addr:    ":8080",
		Handler: r,
	&#125;

	// 启动服务（非阻塞）
	go func() &#123;
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed &#123;
			log.Fatalf("启动失败: %v", err)
		&#125;
	&#125;()
	log.Println("服务启动，监听 :8080")

	// 监听中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("正在关闭服务...")

	// 给在处理的请求最多 5 秒完成
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil &#123;
		log.Printf("强制关闭: %v", err)
	&#125;

	// 关闭数据库等资源
	// sqlDB, _ := db.DB()
	// sqlDB.Close()

	log.Println("服务已优雅退出")
&#125;
~~~

::: tip
优雅关闭的关键点：
1. `http.Server` 启动在 goroutine 中，主协程监听信号。
2. 收到 `SIGINT`（Ctrl+C）或 `SIGTERM`（kill）后调用 `srv.Shutdown`。
3. `Shutdown` 会等待活跃请求结束再退出，超时则强制关闭。
4. 关闭前释放数据库连接、消息队列等外部资源。
:::

## 健康检查接口

配合容器编排（K8s）做存活与就绪探针：

~~~go
r.GET("/health", func(c *gin.Context) &#123;
	c.JSON(200, gin.H&#123;"status": "ok"&#125;)
&#125;)

r.GET("/ready", func(c *gin.Context) &#123;
	// 检查依赖（数据库等）是否就绪
	if err := db.Ping(); err != nil &#123;
		c.JSON(503, gin.H&#123;"status": "not ready"&#125;)
		return
	&#125;
	c.JSON(200, gin.H&#123;"status": "ready"&#125;)
&#125;)
~~~
