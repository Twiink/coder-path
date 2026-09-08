# Go + Gin 学习路线

Go 语言简洁高效，Gin 是 Go 生态中最流行的 Web 框架，性能强悍、API 优雅。如果你追求极致性能和简洁代码，Go + Gin 是绝佳组合。

## 为什么选择 Go + Gin

Go 天生为并发而生，goroutine 轻量高效，不像 Node.js 那样单线程受限，也不像 Java 那样线程开销大。Gin 框架性能卓越，路由快速，中间件系统灵活，文档清晰。

适合高并发 API 服务、微服务、实时系统。Docker、Kubernetes、Prometheus 都是 Go 写的，可见其在基础设施领域的统治力。

## 学习路线图

### 基础篇：Go 语言与 Gin 框架

- **Go 语言基础**
  - 变量、常量、数据类型
  - 函数和方法
  - 结构体和接口
  - 指针和引用
  - 切片和映射
  - 错误处理
  - 📖 笔记：[Go 语言概述](/study-notes/golang/go-overview)
  - 📖 笔记：[基础类型与常量指针](/study-notes/golang/basic-types-pointers)
  - 📖 笔记：[流程控制与函数](/study-notes/golang/control-flow-functions)
  - 📖 笔记：[结构体与 Map](/study-notes/golang/structs-maps)
  - 📖 笔记：[接口](/study-notes/golang/interfaces)
  - 📖 笔记：[泛型](/study-notes/golang/generics)
  - 📖 笔记：[反射](/study-notes/golang/reflection)
  - 📖 笔记：[环境配置与 fmt](/study-notes/golang/setup-and-fmt)

- **并发编程**
  - Goroutine 协程
  - Channel 通道
  - select 语句
  - sync 包（WaitGroup、Mutex、RWMutex）
  - Context 上下文管理
  - 📖 笔记：[并发编程](/study-notes/golang/concurrency)
  - 📖 笔记：[网络编程与并发模型](/study-notes/golang/network-concurrency-model)

- **Gin 快速开始**
  - 安装和项目初始化
  - 路由定义和分组
  - 处理函数和上下文
  - 参数绑定（Query、Path、JSON）
  - 响应格式（JSON、XML、HTML）
  - 📖 笔记：[Gin 框架入门](/study-notes/golang/gin-intro)

- **路由与参数**
  - 路径参数和通配符
  - 查询参数获取
  - 表单数据处理
  - JSON 请求体绑定
  - 自定义验证
  - 📖 笔记：[请求参数与数据绑定](/study-notes/golang/request-params-binding)
  - 📖 笔记：[响应与模板渲染](/study-notes/golang/responses-template-rendering)

- **中间件**
  - 中间件概念和执行流程
  - 全局中间件和路由中间件
  - 内置中间件（Logger、Recovery）
  - 自定义中间件开发
  - 中间件链管理
  - 📖 笔记：[Gin 中间件](/study-notes/golang/middleware)

### 进阶篇：数据库与认证

- **项目结构**
  - 标准项目布局
  - 分层架构（Handler、Service、Repository）
  - 模块化设计
  - 依赖管理（go mod）
  - 📖 笔记：[项目结构与最佳实践](/study-notes/golang/project-structure-best-practices)

- **数据库集成**
  - GORM ORM 框架
  - 数据库连接和配置
  - 模型定义和迁移
  - CRUD 操作
  - 关系映射和预加载
  - 事务处理
  - 📖 笔记：[Gin 结合 GORM 操作数据库](/study-notes/golang/gin-gorm-database)

- **请求验证**
  - 结构体标签验证
  - validator 库使用
  - 自定义验证规则
  - 错误信息定制
  - 验证器注册
  - 📖 笔记：[数据校验](/study-notes/golang/validation)

- **JWT 认证**
  - JWT 令牌生成
  - 令牌验证和解析
  - 认证中间件
  - 刷新令牌机制
  - 权限控制
  - 📖 笔记：[JWT 认证](/study-notes/golang/jwt-auth)

- **错误处理**
  - 统一错误响应
  - 自定义错误类型
  - 错误中间件
  - Panic 恢复
  - 错误日志记录
  - 📖 笔记：[Go 错误处理](/study-notes/golang/errors)
  - 📖 笔记：[错误处理与优雅关闭](/study-notes/golang/error-handling-graceful-shutdown)

### 实战篇：高级特性与部署

- **文件处理**
  - 单文件上传
  - 多文件上传
  - 文件验证和过滤
  - 文件存储策略
  - 流式上传
  - 📖 笔记：[文件操作](/study-notes/golang/file-operations)
  - 📖 笔记：[文件上传与静态资源](/study-notes/golang/file-upload-static)

- **CORS 配置**
  - 跨域中间件
  - 预检请求处理
  - 凭证支持
  - 白名单配置

- **日志管理**
  - 日志中间件
  - 日志格式化
  - 日志文件输出
  - 日志级别控制
  - 结构化日志（zap、logrus）

- **配置管理**
  - 环境变量
  - 配置文件（YAML、JSON）
  - Viper 配置库
  - 多环境配置
  - 配置热加载

- **缓存**
  - Redis 集成
  - 缓存中间件
  - 缓存策略
  - 分布式缓存
  - 缓存失效

- **测试**
  - 单元测试
  - HTTP 测试
  - Mock 对象
  - 测试覆盖率
  - 性能测试

- **性能优化**
  - Goroutine 池
  - 连接池配置
  - 数据库查询优化
  - 响应压缩
  - 内存优化

- **部署**
  - 编译和交叉编译
  - Docker 容器化
  - 二进制文件优化
  - 系统服务配置
  - 优雅关闭

- **监控与调试**
  - pprof 性能分析
  - Prometheus 指标
  - 健康检查端点
  - 链路追踪
  - 错误监控

- **安全防护**
  - 参数验证
  - SQL 注入防护
  - XSS 防护
  - 限流中间件
  - HTTPS 配置

## 下一步学习

- **gRPC**：高性能 RPC 框架
- **微服务**：服务发现、配置中心
- **消息队列**：Kafka、RabbitMQ
- **分布式系统**：Etcd、Consul
- **云原生**：Kubernetes 生态

---

Go + Gin 的组合简洁高效，性能卓越。Go 的并发模型让你轻松处理高并发场景，Gin 的简洁 API 让开发效率不输 Node.js。适合追求性能和简洁的开发者。
