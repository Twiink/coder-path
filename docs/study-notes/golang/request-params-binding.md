---
title: "请求参数与数据绑定"
tags:
  - "后端"
  - "go"
  - "gin"
  - "笔记"
category: "后端"
folder: "Gin"
parent: "[[后端/Gin/Gin框架入门]]"
related:
  - "[[后端/Gin/响应与模板渲染]]"
  - "[[后端/Gin/数据校验]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 请求参数与数据绑定

Gin 提供了多种方式获取请求参数，并支持将请求参数自动绑定到结构体。

## 获取 Query 参数

查询字符串参数（`/search?keyword=gin&page=1`）：

~~~go
r.GET("/search", func(c *gin.Context) &#123;
	keyword := c.Query("keyword")       // 不存在返回空字符串
	page := c.DefaultQuery("page", "1") // 不存在返回默认值
	c.JSON(200, gin.H&#123;"keyword": keyword, "page": page&#125;)
&#125;)
~~~

## 获取表单参数（POST Form）

~~~go
r.POST("/form", func(c *gin.Context) &#123;
	name := c.PostForm("name")
	age := c.DefaultPostForm("age", "0")
	c.JSON(200, gin.H&#123;"name": name, "age": age&#125;)
&#125;)
~~~

`c.Query` / `c.PostForm` 都有对应的 `Get` 版本，返回值和是否存在的布尔值：
~~~go
val, ok := c.GetQuery("keyword")
~~~

## 路径参数 Path

~~~go
r.GET("/user/:id", func(c *gin.Context) &#123;
	id := c.Param("id")
	c.JSON(200, gin.H&#123;"id": id&#125;)
&#125;)
~~~

## 数据绑定（ShouldBind 系列）

Gin 支持根据 `Content-Type` 自动将请求数据绑定到结构体。常用方法：

| 方法 | 说明 |
|------|------|
| `ShouldBindJSON` | 绑定 JSON 请求体 |
| `ShouldBindQuery` | 绑定 URL 查询参数 |
| `ShouldBind` | 根据请求 Content-Type 自动选择绑定方式 |
| `ShouldBindUri` | 绑定 URI 路径参数 |
| `ShouldBindForm` | 绑定表单数据 |
| `ShouldBindHeader` | 绑定请求头 |

### 绑定 JSON

~~~go
type Login struct &#123;
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
&#125;

r.POST("/login", func(c *gin.Context) &#123;
	var req Login
	// ShouldBindJSON 解析 JSON 请求体到结构体
	if err := c.ShouldBindJSON(&req); err != nil &#123;
		c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
		return
	&#125;
	c.JSON(200, gin.H&#123;"user": req.Username, "msg": "登录成功"&#125;)
&#125;)
~~~

请求示例：
~~~shell
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '&#123;"username":"admin","password":"123456"&#125;'
~~~

### 绑定 Query 参数

~~~go
type Search struct &#123;
	Keyword string `form:"keyword" binding:"required"`
	Page    int    `form:"page,default=1"`
	Size    int    `form:"size,default=10"`
&#125;

r.GET("/users", func(c *gin.Context) &#123;
	var s Search
	if err := c.ShouldBindQuery(&s); err != nil &#123;
		c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
		return
	&#125;
	c.JSON(200, gin.H&#123;"search": s&#125;)
&#125;)
~~~

::: tip
Query/Form 绑定使用 `form` tag，JSON 绑定使用 `json` tag。一个结构体可同时声明多种 tag 以复用。
:::

### 绑定 URI 参数

~~~go
type UserURI struct &#123;
	ID   int    `uri:"id" binding:"required"`
	Name string `uri:"name"`
&#125;

r.GET("/user/:id/:name", func(c *gin.Context) &#123;
	var u UserURI
	if err := c.ShouldBindUri(&u); err != nil &#123;
		c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
		return
	&#125;
	c.JSON(200, gin.H&#123;"id": u.ID, "name": u.Name&#125;)
&#125;)
~~~

### 通用绑定 ShouldBind

`ShouldBind` 会根据请求的 `Content-Type` 自动选择绑定方式：

~~~go
r.POST("/bind", func(c *gin.Context) &#123;
	var req Login
	// 自动判断：JSON / form / query
	if err := c.ShouldBind(&req); err != nil &#123;
		c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
		return
	&#125;
	c.JSON(200, gin.H&#123;"data": req&#125;)
&#125;)
~~~

### 绑定数组与 Map

~~~go
// 绑定数组 ?ids=1&ids=2&ids=3
r.GET("/ids", func(c *gin.Context) &#123;
	ids := c.QueryArray("ids")
	c.JSON(200, gin.H&#123;"ids": ids&#125;)
&#125;)

// 绑定 Map ?ids[a]=1&ids[b]=2
r.GET("/map", func(c *gin.Context) &#123;
	ids := c.QueryMap("ids")
	c.JSON(200, gin.H&#123;"ids": ids&#125;)
&#125;)
~~~

## 获取请求头

~~~go
r.GET("/header", func(c *gin.Context) &#123;
	contentType := c.GetHeader("Content-Type")
	auth := c.GetHeader("Authorization")
	c.JSON(200, gin.H&#123;"Content-Type": contentType, "Authorization": auth&#125;)
&#125;)
~~~

## 文件上传

单个文件上传：
~~~go
r.POST("/upload", func(c *gin.Context) &#123;
	file, err := c.FormFile("file")
	if err != nil &#123;
		c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
		return
	&#125;
	// 保存到指定路径
	dst := "./uploads/" + file.Filename
	c.SaveUploadedFile(file, dst)
	c.JSON(200, gin.H&#123;"filename": file.Filename, "size": file.Size&#125;)
&#125;)
~~~

::: tip
`ShouldBind` 系列遇到错误只返回 error 不自动写响应，方便自定义错误处理。另有 `Bind` 系列会自动写 400 响应，灵活性较差，推荐使用 `ShouldBind`。
:::
