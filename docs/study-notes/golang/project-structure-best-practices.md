---
title: "项目结构与最佳实践"
tags:
  - "后端"
  - "go"
  - "gin"
  - "笔记"
category: "后端"
folder: "Gin"
parent: "[[后端/Gin/错误处理与优雅关闭]]"
related:
  - "[[后端/Gin/Gin框架入门]]"
  - "[[后端/Go/环境配置与fmt]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 项目结构与最佳实践

随着项目变大，合理的目录结构和分层设计至关重要。本篇总结 Gin 项目的推荐结构和工程实践。

## 推荐目录结构

参考 [Go 项目标准布局](https://github.com/golang-standards/project-layout)，结合 Gin 特点：

```
gin-demo/
├── cmd/                    # 程序入口
│   └── server/
│       └── main.go         # main 函数
├── internal/               # 私有代码，不可被外部导入
│   ├── config/             # 配置加载
│   │   └── config.go
│   ├── controller/         # 控制器层（处理 HTTP 请求响应）
│   │   ├── user.go
│   │   └── auth.go
│   ├── service/            # 业务逻辑层
│   │   ├── user.go
│   │   └── auth.go
│   ├── repository/         # 数据访问层（DB 操作）
│   │   └── user.go
│   ├── model/              # 数据模型
│   │   └── user.go
│   ├── middleware/         # 中间件
│   │   ├── jwt.go
│   │   └── cors.go
│   ├── router/             # 路由注册
│   │   └── router.go
│   └── pkg/                # 工具包
│       ├── response/       # 统一响应
│       └── errcode/        # 错误码
├── configs/                # 配置文件
│   └── config.yaml
├── migrations/             # 数据库迁移脚本
├── templates/              # HTML 模板
├── assets/                 # 静态资源
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

::: tip
`internal/` 是 Go 编译器强制约束的目录，其中的代码不能被其他 module 导入，适合放项目私有逻辑。
:::

## 分层架构

经典三层架构，职责清晰：

```
请求 → Controller → Service → Repository → DB
响应 ← Controller ← Service ← Repository ← DB
```

### Model 层

~~~go
// internal/model/user.go
package model

import "gorm.io/gorm"

type User struct {
	gorm.Model
	Name  string `gorm:"size:50;not null" json:"name"`
	Email string `gorm:"size:100;uniqueIndex" json:"email"`
}
~~~

### Repository 层（数据访问）

~~~go
// internal/repository/user.go
package repository

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(u *model.User) error {
	return r.db.Create(u).Error
}

func (r *UserRepository) FindByID(id uint) (*model.User, error) {
	var u model.User
	err := r.db.First(&u, id).Error
	return &u, err
}

func (r *UserRepository) List(page, size int) ([]model.User, int64, error) {
	var users []model.User
	var total int64
	r.db.Model(&model.User{}).Count(&total)
	err := r.db.Offset((page - 1) * size).Limit(size).Find(&users).Error
	return users, total, err
}
~~~

### Service 层（业务逻辑）

~~~go
// internal/service/user.go
package service

type UserService struct {
	repo *repository.UserRepository
}

func NewUserService(repo *repository.UserRepository) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) Register(req *CreateUserReq) (*model.User, error) {
	// 业务校验：邮箱是否已存在
	exist, err := s.repo.ExistsByEmail(req.Email)
	if err != nil {
		return nil, err
	}
	if exist {
		return nil, apperr.New(2001, "邮箱已被注册")
	}
	// 密码加密
	hashed, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	user := &model.User{
		Name:  req.Name,
		Email: req.Email,
	}
	if err := s.repo.Create(user); err != nil {
		return nil, err
	}
	return user, nil
}
~~~

### Controller 层（HTTP 处理）

~~~go
// internal/controller/user.go
package controller

type UserController struct {
	svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
	return &UserController{svc: svc}
}

func (uc *UserController) Register(c *gin.Context) {
	var req service.CreateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, 1003, err.Error())
		return
	}
	user, err := uc.svc.Register(&req)
	if err != nil {
		if be, ok := err.(*apperr.BizError); ok {
			response.Fail(c, be.Code, be.Msg)
			return
		}
		response.Fail(c, 5000, "服务器错误")
		return
	}
	response.Success(c, user)
}
~~~

### Router 层（依赖注入与路由注册）

~~~go
// internal/router/router.go
package router

func Setup(r *gin.Engine, deps *Dependencies) {
	// 公开路由
	r.POST("/login", deps.Auth.Login)

	// 需认证路由
	api := r.Group("/api")
	api.Use(middleware.JWTAuth())
	{
		api.GET("/users", deps.User.List)
		api.POST("/users", deps.User.Register)
		api.GET("/users/:id", deps.User.Get)
	}
}
~~~

### main.go（组装依赖）

~~~go
// cmd/server/main.go
package main

func main() {
	// 1. 加载配置
	cfg := config.Load("configs/config.yaml")

	// 2. 连接数据库
	db := database.MustConnect(cfg.DB)

	// 3. 组装依赖（依赖注入）
	userRepo := repository.NewUserRepository(db)
	userSvc := service.NewUserService(userRepo)
	userCtrl := controller.NewUserController(userSvc)

	deps := &Dependencies{User: userCtrl}

	// 4. 启动服务
	r := gin.Default()
	router.Setup(r, deps)
	r.Run(":" + cfg.Server.Port)
}
~~~

## 配置管理

使用 [viper](https://github.com/spf13/viper) 管理配置，支持 YAML + 环境变量覆盖：

`configs/config.yaml`：
~~~yaml
server:
  port: 8080
db:
  host: 127.0.0.1
  port: 3306
  name: gin_demo
  user: root
  password: secret
jwt:
  secret: my-secret
  expire: 24h
~~~

~~~go
package config

func Load(path string) *Config {
	viper.SetConfigFile(path)
	viper.AutomaticEnv() // 支持环境变量覆盖
	if err := viper.ReadInConfig(); err != nil {
		log.Fatal("读取配置失败: ", err)
	}
	var c Config
	viper.Unmarshal(&c)
	return &c
}
~~~

::: tip
生产环境敏感配置（密码、密钥）应通过环境变量注入，不要写入配置文件提交到 Git。
:::

## 环境区分

通过环境变量区分 dev / prod：

~~~go
gin.SetMode(gin.ReleaseMode) // 生产环境关闭调试日志
// 或
if os.Getenv("GIN_MODE") == "release" {
	gin.SetMode(gin.ReleaseMode)
}
~~~

## Makefile 自动化

~~~makefile
.PHONY: run build test

run:
	air

build:
	go build -o bin/server ./cmd/server

test:
	go test -v ./...

docker:
	docker build -t gin-demo .
~~~

## Dockerfile

~~~dockerfile
# 多阶段构建，减小镜像体积
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o server ./cmd/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/configs ./configs
EXPOSE 8080
CMD ["./server"]
~~~

## 最佳实践总结

1. **分层清晰**：Controller / Service / Repository 各司其职，不越界。
2. **依赖注入**：在 main 中组装依赖，通过构造函数注入，便于测试和替换。
3. **统一响应**：所有接口返回统一结构，前端处理一致。
4. **错误码规范**：定义全局错误码表，业务错误与系统错误区分。
5. **配置外置**：配置文件 + 环境变量，敏感信息不入库。
6. **优雅关闭**：捕获信号，等待请求完成，释放资源。
7. **日志规范**：结构化日志 + 请求 ID，便于链路追踪。
8. **参数校验**：用 validator tag + 统一错误翻译，保证数据合法。
9. **安全**：JWT 鉴权、密码哈希（bcrypt）、SQL 注入防护（GORM 参数化）、CORS 控制。
10. **测试**：对 service 层写单元测试，用 mock 替换 repository。
