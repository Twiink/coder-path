---
title: "响应与模板渲染"
tags:
  - "后端"
  - "go"
  - "gin"
  - "笔记"
category: "后端"
folder: "Gin"
parent: "[[后端/Gin/请求参数与数据绑定]]"
related:
  - "[[后端/Gin/中间件]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 响应与模板渲染

Gin 支持多种响应格式：JSON、XML、YAML、String、HTML、文件下载、重定向等。

## JSON 响应

最常用的响应格式：

~~~go
r.GET("/json", func(c *gin.Context) &#123;
	// 方式一：gin.H
	c.JSON(200, gin.H&#123;"message": "ok", "code": 0&#125;)

	// 方式二：直接使用结构体（json tag 控制字段名）
	type Resp struct &#123;
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	&#125;
	c.JSON(200, Resp对象(Code属性))
&#125;)

// PureJSON 不会转义 HTML 字符（如 < >），JSON 会转义
r.GET("/purejson", func(c *gin.Context) &#123;
	c.PureJSON(200, gin.H&#123;"html": "<b>Hello</b>"&#125;)
&#125;)

// AsciiJSON 将非 ASCII 字符转为 \uXXXX
r.GET("/ascii", func(c *gin.Context) &#123;
	c.AsciiJSON(200, gin.H&#123;"lang": "中文"&#125;)
&#125;)
~~~

## XML / YAML 响应

~~~go
r.GET("/xml", func(c *gin.Context) &#123;
	c.XML(200, gin.H&#123;"message": "ok"&#125;)
&#125;)

r.GET("/yaml", func(c *gin.Context) &#123;
	c.YAML(200, gin.H&#123;"message": "ok"&#125;)
&#125;)
~~~

## String 响应

~~~go
r.GET("/string", func(c *gin.Context) &#123;
	// 支持格式化
	c.String(200, "你好, %s", "Gin")
&#125;)
~~~

## 文件下载

~~~go
// 返回文件，浏览器会下载
r.GET("/download", func(c *gin.Context) &#123;
	c.File("./files/report.pdf")
&#125;)

// 自定义下载文件名
r.GET("/attachment", func(c *gin.Context) &#123;
	c.Header("Content-Disposition", `attachment; filename="report.pdf"`)
	c.File("./files/report.pdf")
&#125;)

// FileFromFS 可获取文件信息
r.GET("/file", func(c *gin.Context) &#123;
	c.FileFromFS("report.pdf", http.Dir("./files"))
&#125;)
~~~

## 重定向

~~~go
r.GET("/redirect", func(c *gin.Context) &#123;
	// 内部重定向
	c.Redirect(302, "/home")
&#125;)

r.GET("/external", func(c *gin.Context) &#123;
	// 外部重定向
	c.Redirect(302, "https://gin-gonic.com")
&#125;)

// 路由命名重定向
r.GET("/home", func(c *gin.Context) &#123; c.String(200, "首页") &#125;)
r.GET("/go-home", func(c *gin.Context) &#123;
	c.Request.URL.Path = "/home"
	r.HandleContext(c) // 转发到 /home
&#125;)
~~~

## HTML 模板渲染

Gin 使用 Go 标准库的 `html/template` 进行模板渲染。

项目结构：
```
gin-demo/
├── main.go
└── templates/
    ├── index.html
    └── posts/
        └── post.html
```

加载模板：
~~~go
func main() &#123;
	r := gin.Default()

	// 加载模板文件，** 表示递归匹配子目录
	r.LoadHTMLGlob("templates/**/*")
	// 或者指定多个文件
	// r.LoadHTMLFiles("templates/index.html", "templates/posts/post.html")

	// 设置静态资源目录
	r.Static("/assets", "./assets")

	r.GET("/index", func(c *gin.Context) &#123;
		c.HTML(200, "index.html", gin.H&#123;
			"title":   "Gin 示例",
			"content": "欢迎使用 Gin 模板渲染",
		&#125;)
	&#125;)

	r.Run()
&#125;
~~~

`templates/index.html`：
~~~html
<!DOCTYPE html>
&lt;html&gt;
&lt;head&gt;&lt;title&gt;&#123;&#123; .title &#125;&#125;</title></head>
&lt;body&gt;
	&lt;h1&gt;&#123;&#123; .title &#125;&#125;</h1>
	<p>&#123;&#123; .content &#125;&#125;</p>
</body>
</html>
~~~

### 模板中使用函数

~~~go
r.SetFuncMap(template.FuncMap&#123;
	"safe": func(str string) template.HTML &#123; return template.HTML(str) &#125;,
	"upper": strings.ToUpper,
&#125;)

r.GET("/html", func(c *gin.Context) &#123;
	c.HTML(200, "index.html", gin.H&#123;
		"title": "Gin 示例",
		"desc":  "<b>加粗文本</b>",
	&#125;)
&#125;)
~~~

模板中：
~~~html
&#123;&#123; .desc | safe &#125;&#125;
&#123;&#123; .title | upper &#125;&#125;
~~~

## 不同内容协商（Content Negotiation）

根据客户端 `Accept` 头返回不同格式：

~~~go
r.GET("/data", func(c *gin.Context) &#123;
	data := gin.H&#123;"message": "hello", "code": 0&#125;
	format := c.NegotiateFormat(gin.MIMEJSON, gin.MIMEXML, gin.MIMEHTML)
	switch format &#123;
	case gin.MIMEJSON:
		c.JSON(200, data)
	case gin.MIMEXML:
		c.XML(200, data)
	default:
		c.String(200, "不支持的格式")
	&#125;
&#125;)
~~~

## 设置响应头

~~~go
r.GET("/header", func(c *gin.Context) &#123;
	c.Header("X-Custom-Header", "gin")
	c.Header("Cache-Control", "no-cache")
	c.JSON(200, gin.H&#123;"msg": "ok"&#125;)
&#125;)
~~~
