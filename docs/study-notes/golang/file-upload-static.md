---
title: "文件上传与静态资源"
tags:
  - "后端"
  - "go"
  - "gin"
  - "笔记"
category: "后端"
folder: "Gin"
parent: "[[后端/Gin/数据校验]]"
related:
  - "[[后端/Gin/响应与模板渲染]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 文件上传与静态资源

## 单文件上传

~~~go
func main() &#123;
	r := gin.Default()
	// 限制上传大小（默认 32MB）
	r.MaxMultipartMemory = 8 << 20 // 8 MB

	r.POST("/upload", func(c *gin.Context) &#123;
		file, err := c.FormFile("file")
		if err != nil &#123;
			c.JSON(400, gin.H&#123;"error": "获取文件失败: " + err.Error()&#125;)
			return
		&#125;

		// 校验文件类型
		ext := filepath.Ext(file.Filename)
		allowed := map[string]bool&#123;".jpg": true, ".png": true, ".gif": true&#125;
		if !allowed[ext] &#123;
			c.JSON(400, gin.H&#123;"error": "不支持的文件类型"&#125;)
			return
		&#125;

		// 保存文件
		dst := filepath.Join("uploads", file.Filename)
		if err := c.SaveUploadedFile(file, dst); err != nil &#123;
			c.JSON(500, gin.H&#123;"error": "保存失败: " + err.Error()&#125;)
			return
		&#125;

		c.JSON(200, gin.H&#123;
			"filename": file.Filename,
			"size":     file.Size,
			"path":     dst,
		&#125;)
	&#125;)

	r.Run()
&#125;
~~~

请求示例：
~~~shell
curl -X POST http://localhost:8080/upload \
  -F "file=@/path/to/photo.jpg"
~~~

## 多文件上传

~~~go
r.POST("/uploads", func(c *gin.Context) &#123;
	form, err := c.MultipartForm()
	if err != nil &#123;
		c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
		return
	&#125;

	files := form.File["files"] // 表单字段名
	var results []string
	for _, file := range files &#123;
		dst := filepath.Join("uploads", file.Filename)
		if err := c.SaveUploadedFile(file, dst); err != nil &#123;
			results = append(results, file.Filename+": 失败")
			continue
		&#125;
		results = append(results, file.Filename+": 成功")
	&#125;
	c.JSON(200, gin.H&#123;"results": results&#125;)
&#125;)
~~~

## 上传文件绑定到结构体

文件可以和其他表单字段一起绑定到结构体：

~~~go
type UploadReq struct &#123;
	Title   string                `form:"title" binding:"required"`
	File    *multipart.FileHeader `form:"file" binding:"required"`
&#125;

r.POST("/upload-form", func(c *gin.Context) &#123;
	var req UploadReq
	if err := c.ShouldBind(&req); err != nil &#123;
		c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
		return
	&#125;
	c.SaveUploadedFile(req.File, filepath.Join("uploads", req.File.Filename))
	c.JSON(200, gin.H&#123;"title": req.Title, "file": req.File.Filename&#125;)
&#125;)
~~~

## 防止文件名冲突

使用 UUID 或时间戳重命名文件，避免覆盖：

~~~go
func genFilename(original string) string &#123;
	ext := filepath.Ext(original)
	name := uuid.New().String()
	return name + ext
&#125;

dst := filepath.Join("uploads", genFilename(file.Filename))
~~~

## 按日期分目录存储

~~~go
func saveFile(file *multipart.FileHeader) (string, error) &#123;
	dateDir := time.Now().Format("2006/01/02")
	dir := filepath.Join("uploads", dateDir)
	if err := os.MkdirAll(dir, 0755); err != nil &#123;
		return "", err
	&#125;
	ext := filepath.Ext(file.Filename)
	filename := uuid.New().String() + ext
	dst := filepath.Join(dir, filename)
	return dst, c.SaveUploadedFile(file, dst)
&#125;
~~~

## 提供静态资源服务

### Static 目录映射

~~~go
// 访问 /static/xxx.png 实际读取 ./assets/xxx.png
r.Static("/static", "./assets")

// 指定单个文件
r.StaticFile("/favicon.ico", "./assets/favicon.ico")

// StaticFS 使用 http.FileSystem，可自定义目录展示
r.StaticFS("/files", http.Dir("./uploads"))
~~~

::: tip
`Static` 和 `StaticFS` 默认会开启目录列表。若不希望暴露目录列表，可使用自定义的 `http.FileServer` 或中间件过滤。
:::

## 文件下载

~~~go
r.GET("/download/:name", func(c *gin.Context) &#123;
	name := c.Param("name")
	path := filepath.Join("uploads", name)

	// 设置响应头，强制下载
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Content-Disposition", `attachment; filename="`+name+`"`)
	c.Header("Content-Type", "application/octet-stream")

	c.File(path)
&#125;)

// 支持中文名下载（URL 编码）
r.GET("/download-cn/:name", func(c *gin.Context) &#123;
	name := c.Param("name")
	path := filepath.Join("uploads", name)
	c.Header("Content-Disposition",
		`attachment; filename*=UTF-8''`+url.QueryEscape(name))
	c.File(path)
&#125;)
~~~

## 流式响应（大文件）

对于大文件，使用 `c.File` 即可（内部用 `http.ServeContent` 支持断点续传 Range 请求）。也可手动写入：

~~~go
r.GET("/stream", func(c *gin.Context) &#123;
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	flusher, _ := c.Writer.(http.Flusher)
	for i := 0; i < 5; i++ &#123;
		c.String(200, "data: 消息 %d\n\n", i)
		flusher.Flush()
		time.Sleep(time.Second)
	&#125;
&#125;)
~~~
