---
title: "JWT认证"
tags:
  - "后端"
  - "go"
  - "gin"
  - "jwt"
  - "笔记"
category: "后端"
folder: "Gin"
parent: "[[后端/Gin/Gin结合GORM操作数据库]]"
related:
  - "[[后端/Gin/中间件]]"
  - "[[后端/Gin/错误处理与优雅关闭]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# JWT 认证与授权

JWT（JSON Web Token）是无状态认证的常用方案。服务端签发 token，客户端携带 token 访问受保护接口，服务端验证签名即可识别用户身份，无需在服务端存储 session。

## JWT 结构

JWT 由三部分组成：`Header.Payload.Signature`，用 `.` 连接。

- **Header**：算法类型（如 HS256）和 token 类型（JWT）
- **Payload**：声明（Claims），如 `user_id`、`exp`（过期时间）
- **Signature**：用密钥对 Header + Payload 的签名

## 安装

使用社区流行库 `golang-jwt`：

~~~shell
go get -u github.com/golang-jwt/jwt/v5
~~~

## 封装 JWT 工具

~~~go
package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var jwtKey = []byte("my-secret-key") // 生产环境从配置读取

// Claims 自定义声明
type Claims struct &#123;
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
&#125;

// GenerateToken 生成 token
func GenerateToken(userID uint, username string) (string, error) &#123;
	claims := Claims&#123;
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims&#123;
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)), // 24 小时过期
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "gin-demo",
		&#125;,
	&#125;
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
&#125;

// ParseToken 解析并验证 token
func ParseToken(tokenString string) (*Claims, error) &#123;
	token, err := jwt.ParseWithClaims(tokenString, &Claims&#123;&#125;, func(token *jwt.Token) (interface&#123;&#125;, error) &#123;
		return jwtKey, nil
	&#125;)
	if err != nil &#123;
		return nil, err
	&#125;
	if claims, ok := token.Claims.(*Claims); ok && token.Valid &#123;
		return claims, nil
	&#125;
	return nil, jwt.ErrTokenInvalidClaims
&#125;
~~~

## 登录接口签发 Token

~~~go
r.POST("/login", func(c *gin.Context) &#123;
	var req struct &#123;
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	&#125;
	if err := c.ShouldBindJSON(&req); err != nil &#123;
		c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
		return
	&#125;

	// 校验用户名密码（这里简化，实际查数据库）
	if req.Username != "admin" || req.Password != "123456" &#123;
		c.JSON(401, gin.H&#123;"error": "用户名或密码错误"&#125;)
		return
	&#125;

	// 生成 token
	token, err := auth.GenerateToken(1, req.Username)
	if err != nil &#123;
		c.JSON(500, gin.H&#123;"error": "生成 token 失败"&#125;)
		return
	&#125;

	c.JSON(200, gin.H&#123;
		"token": token,
		"type":  "Bearer",
	&#125;)
&#125;)
~~~

## JWT 鉴权中间件

~~~go
func JWTAuth() gin.HandlerFunc &#123;
	return func(c *gin.Context) &#123;
		// 从 Header 获取 token：Authorization: Bearer &lt;token&gt;
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" &#123;
			c.AbortWithStatusJSON(401, gin.H&#123;"error": "缺少认证信息"&#125;)
			return
		&#125;
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" &#123;
			c.AbortWithStatusJSON(401, gin.H&#123;"error": "认证格式错误"&#125;)
			return
		&#125;

		// 解析 token
		claims, err := auth.ParseToken(parts[1])
		if err != nil &#123;
			c.AbortWithStatusJSON(401, gin.H&#123;"error": "无效或过期的 token"&#125;)
			return
		&#125;

		// 将用户信息存入上下文，供后续使用
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Next()
	&#125;
&#125;
~~~

## 保护路由

~~~go
// 不需要认证的公开路由
r.POST("/login", loginHandler)

// 需要认证的路由组
auth := r.Group("/api")
auth.Use(JWTAuth())
&#123;
	auth.GET("/profile", func(c *gin.Context) &#123;
		uid, _ := c.Get("user_id")
		name, _ := c.Get("username")
		c.JSON(200, gin.H&#123;"user_id": uid, "username": name&#125;)
	&#125;)
	auth.PUT("/users/:id", updateUser)
	auth.DELETE("/users/:id", deleteUser)
&#125;
~~~

客户端请求受保护接口：
~~~shell
curl http://localhost:8080/api/profile \
  -H "Authorization: Bearer &lt;your-token&gt;"
~~~

## Token 续期方案

- **方案一**：token 过期时间设短（如 2 小时），配合 refresh token（长期）刷新。refresh token 失效前可换取新的 access token。
- **方案二**：滑动过期，每次请求检测 token 剩余时间，不足阈值则在响应头返回新 token。

Refresh token 示例：

~~~go
r.POST("/refresh", JWTAuth(), func(c *gin.Context) &#123;
	uid, _ := c.Get("user_id")
	name, _ := c.Get("username")
	token, _ := auth.GenerateToken(uid.(uint), name.(string))
	c.JSON(200, gin.H&#123;"token": token&#125;)
&#125;)
~~~

## 基于角色的权限控制（RBAC）

在 Claims 中加入角色，在中间件中校验：

~~~go
type Claims struct &#123;
	UserID uint   `json:"user_id"`
	Role   string `json:"role"` // admin / user
	jwt.RegisteredClaims
&#125;

// 角色校验中间件
func RequireRole(role string) gin.HandlerFunc &#123;
	return func(c *gin.Context) &#123;
		claims, exists := c.Get("role")
		if !exists || claims.(string) != role &#123;
			c.AbortWithStatusJSON(403, gin.H&#123;"error": "权限不足"&#125;)
			return
		&#125;
		c.Next()
	&#125;
&#125;
~~~

使用：
~~~go
admin := auth.Group("/admin")
admin.Use(RequireRole("admin"))
&#123;
	admin.DELETE("/users/:id", deleteUser)
&#125;
~~~

::: tip
- JWT 是无状态的，签发后无法主动失效。如需「退出登录」立即生效，需配合 Redis 维护黑名单，或在数据库记录 token 状态。
- 密钥务必妥善保管，从环境变量或配置中心读取，不要硬编码到代码中。
:::
