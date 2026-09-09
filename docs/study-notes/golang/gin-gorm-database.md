---
title: "Gin结合GORM操作数据库"
tags:
  - "后端"
  - "go"
  - "gin"
  - "gorm"
  - "笔记"
category: "后端"
folder: "Gin"
parent: "[[后端/Gin/文件上传与静态资源]]"
related:
  - "[[后端/Go/结构体与Map]]"
  - "[[后端/Redis/redis学习]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# Gin 结合 GORM 操作数据库

[GORM](https://gorm.io/) 是 Go 语言最流行的 ORM 库，支持 MySQL、PostgreSQL、SQLite、SQL Server 等。本篇演示在 Gin 项目中集成 GORM 实现完整的 CRUD。

## 安装

~~~shell
go get -u gorm.io/gorm
go get -u gorm.io/driver/mysql   # MySQL 驱动
# go get -u gorm.io/driver/postgres  # PostgreSQL
# go get -u gorm.io/driver/sqlite    # SQLite
~~~

## 数据库连接与模型定义

~~~go
package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// User 模型，对应 users 表
type User struct &#123;
	gorm.Model        // 内含 ID、CreatedAt、UpdatedAt、DeletedAt
	Name      string `gorm:"size:50;not null" json:"name"`
	Email     string `gorm:"size:100;uniqueIndex" json:"email"`
	Age       int    `json:"age"`
&#125;

var db *gorm.DB

func initDB() &#123;
	dsn := "root:password@tcp(127.0.0.1:3306)/gin_demo?charset=utf8mb4&parseTime=True&loc=Local"
	d, err := gorm.Open(mysql.Open(dsn), &gorm.Config&#123;&#125;)
	if err != nil &#123;
		log.Fatal("数据库连接失败: ", err)
	&#125;
	db = d

	// 自动迁移，根据模型创建/更新表结构
	if err := db.AutoMigrate(&User&#123;&#125;); err != nil &#123;
		log.Fatal("迁移失败: ", err)
	&#125;
&#125;

func main() &#123;
	initDB()
	r := gin.Default()
	registerRoutes(r)
	r.Run()
&#125;
~~~

## CRUD 路由

### 创建用户

~~~go
func registerRoutes(r *gin.Engine) &#123;
	// 创建用户
	r.POST("/users", func(c *gin.Context) &#123;
		var u User
		if err := c.ShouldBindJSON(&u); err != nil &#123;
			c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
			return
		&#125;
		if err := db.Create(&u).Error; err != nil &#123;
			c.JSON(500, gin.H&#123;"error": "创建失败: " + err.Error()&#125;)
			return
		&#125;
		c.JSON(201, u)
	&#125;)
~~~

### 查询用户

~~~go
	// 查询单个用户
	r.GET("/users/:id", func(c *gin.Context) &#123;
		var u User
		if err := db.First(&u, c.Param("id")).Error; err != nil &#123;
			c.JSON(404, gin.H&#123;"error": "用户不存在"&#125;)
			return
		&#125;
		c.JSON(200, u)
	&#125;)

	// 查询用户列表（带分页）
	r.GET("/users", func(c *gin.Context) &#123;
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		size, _ := strconv.Atoi(c.DefaultQuery("size", "10"))
		if page < 1 &#123;
			page = 1
		&#125;
		if size < 1 || size > 100 &#123;
			size = 10
		&#125;

		var users []User
		var total int64
		db.Model(&User&#123;&#125;).Count(&total)
		db.Offset((page - 1) * size).Limit(size).Find(&users)

		c.JSON(200, gin.H&#123;
			"total": total,
			"page":  page,
			"size":  size,
			"data":  users,
		&#125;)
	&#125;)
~~~

### 更新用户

~~~go
	// 更新用户
	r.PUT("/users/:id", func(c *gin.Context) &#123;
		var u User
		if err := db.First(&u, c.Param("id")).Error; err != nil &#123;
			c.JSON(404, gin.H&#123;"error": "用户不存在"&#125;)
			return
		&#125;
		if err := c.ShouldBindJSON(&u); err != nil &#123;
			c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
			return
		&#125;
		db.Save(&u)
		c.JSON(200, u)
	&#125;)

	// 部分更新（只更新传入的字段）
	r.PATCH("/users/:id", func(c *gin.Context) &#123;
		var updates map[string]interface&#123;&#125;
		if err := c.ShouldBindJSON(&updates); err != nil &#123;
			c.JSON(400, gin.H&#123;"error": err.Error()&#125;)
			return
		&#125;
		result := db.Model(&User&#123;&#125;).Where("id = ?", c.Param("id")).Updates(updates)
		if result.RowsAffected == 0 &#123;
			c.JSON(404, gin.H&#123;"error": "用户不存在"&#125;)
			return
		&#125;
		c.JSON(200, gin.H&#123;"msg": "更新成功"&#125;)
	&#125;)
~~~

### 删除用户

~~~go
	// 软删除（gorm.Model 含 DeletedAt，默认软删除）
	r.DELETE("/users/:id", func(c *gin.Context) &#123;
		result := db.Delete(&User&#123;&#125;, c.Param("id"))
		if result.RowsAffected == 0 &#123;
			c.JSON(404, gin.H&#123;"error": "用户不存在"&#125;)
			return
		&#125;
		c.JSON(200, gin.H&#123;"msg": "删除成功"&#125;)
	&#125;)
&#125;
~~~

## 常用查询技巧

~~~go
// 条件查询
db.Where("age > ?", 18).Find(&users)
db.Where("name LIKE ?", "%张%").Find(&users)
db.Where("email = ?", email).First(&user)

// 排序与分组
db.Order("age desc").Find(&users)
db.Select("gender, count(*) as count").Group("gender").Find(&results)

// 预加载关联（一对多）
db.Preload("Orders").Find(&users)

// 事务
err := db.Transaction(func(tx *gorm.DB) error &#123;
	if err := tx.Create(&user).Error; err != nil &#123;
		return err // 返回 error 自动回滚
	&#125;
	if err := tx.Create(&order).Error; err != nil &#123;
		return err
	&#125;
	return nil // 返回 nil 提交事务
&#125;)
~~~

::: tip
- `gorm.Model` 内置软删除：`db.Delete` 只是设置 `deleted_at`，查询自动过滤已删除记录。
- 想查询含已删除数据用 `db.Unscoped()`。
- GORM v2 默认批量操作需要显式 `Limit`，避免误操作全表更新。
:::

## 封装数据库操作层

实际项目应将数据库操作封装到 repository 层，保持路由处理函数简洁：

~~~go
type UserRepository struct &#123;
	db *gorm.DB
&#125;

func (r *UserRepository) Create(u *User) error &#123;
	return r.db.Create(u).Error
&#125;

func (r *UserRepository) FindByID(id uint) (*User, error) &#123;
	var u User
	err := r.db.First(&u, id).Error
	return &u, err
&#125;

func (r *UserRepository) List(page, size int) ([]User, int64, error) &#123;
	var users []User
	var total int64
	r.db.Model(&User&#123;&#125;).Count(&total)
	err := r.db.Offset((page - 1) * size).Limit(size).Find(&users).Error
	return users, total, err
&#125;
~~~

在路由中注入 repository，实现分层解耦。
