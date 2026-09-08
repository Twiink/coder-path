# Nest.js 学习路线

Node.js 界的 Angular，TypeScript 原生支持，企业级架构设计，这就是 Nest.js。如果你厌倦了 Express 的自由散漫，想要一个有组织有纪律的框架，那 Nest.js 就是你的菜。

## 为什么选择 Nest.js

Express 很灵活，但自由过了头就是混乱。项目一大，代码结构就像一团意大利面条。Nest.js 借鉴了 Angular 的模块化设计和依赖注入，用装饰器把路由、中间件、验证这些东西组织得井井有条。它不是 Express 的替代品，而是站在 Express（或 Fastify）肩膀上的架构师。

TypeScript 不是可选项，是必选项。这意味着你写代码时 IDE 会给你完整的类型提示，重构起来也有底气。Nest.js 的核心理念就是：用现代化的方式构建可扩展的服务端应用。

## 学习路线图

### 基础篇：核心概念

- **项目初始化**
  - 使用 Nest CLI 创建项目
  - 项目结构解析
  - 运行和调试

- **控制器（Controllers）**
  - 路由装饰器（@Get、@Post、@Put、@Delete）
  - 参数装饰器（@Param、@Query、@Body）
  - 请求和响应处理
  - HTTP 状态码控制

- **服务层（Providers）**
  - 服务类和业务逻辑
  - @Injectable 装饰器
  - 依赖注入基础
  - 服务作用域（单例/请求/瞬态）

- **模块系统（Modules）**
  - 模块定义和组织
  - 模块导入和导出
  - 全局模块
  - 动态模块

- **依赖注入（DI）**
  - 构造函数注入
  - 自定义 Provider
  - 值提供者、类提供者、工厂提供者
  - 异步 Provider

### 进阶篇：请求生命周期与数据处理

- **中间件（Middleware）**
  - 中间件定义和应用
  - 函数式中间件
  - 全局中间件和路由中间件
  - 执行顺序

- **守卫（Guards）**
  - 守卫的作用和执行时机
  - 认证守卫实现
  - 角色权限守卫
  - 结合装饰器使用

- **拦截器（Interceptors）**
  - 拦截器原理
  - 响应转换
  - 日志记录
  - 缓存实现
  - 超时处理

- **管道（Pipes）**
  - 数据验证
  - 数据转换
  - 内置管道（ValidationPipe、ParseIntPipe）
  - 自定义管道

- **异常过滤器（Exception Filters）**
  - 异常处理机制
  - 自定义异常类
  - 全局异常过滤器
  - HTTP 异常过滤器

- **DTO 与数据验证**
  - class-validator 验证器
  - class-transformer 转换器
  - 验证装饰器
  - 自定义验证规则

### 实战篇：数据库与高级特性

- **数据库集成**
  - TypeORM 集成与配置
  - 实体定义和关系映射
  - Repository 模式
  - 查询构建器
  - Prisma 替代方案

- **认证与授权**
  - Passport.js 集成
  - JWT 策略实现
  - 本地策略（用户名密码）
  - OAuth 2.0 策略
  - 基于角色的访问控制（RBAC）

- **配置管理**
  - @nestjs/config 模块
  - 环境变量管理
  - 配置验证
  - 多环境配置

- **API 文档**
  - Swagger/OpenAPI 集成
  - API 装饰器
  - 模型定义
  - 自动文档生成

- **WebSocket**
  - Gateway 网关
  - 事件监听和触发
  - 房间和命名空间
  - 认证和授权

- **任务调度**
  - @nestjs/schedule 模块
  - Cron 表达式
  - 定时任务
  - 间隔任务

- **缓存**
  - Cache Manager 集成
  - Redis 缓存
  - 缓存装饰器
  - 缓存拦截器

- **文件上传**
  - Multer 集成
  - 文件拦截器
  - 文件验证
  - 多文件上传

- **微服务**
  - 微服务架构
  - 消息模式（Request-Response、Event-based）
  - TCP/Redis/MQTT/gRPC 传输层
  - 混合应用

- **测试**
  - 单元测试
  - E2E 测试
  - 测试模块
  - Mock 依赖

- **部署优化**
  - 生产环境配置
  - Docker 容器化
  - PM2 部署
  - 性能优化技巧
  - 压缩和 CORS 配置

## 下一步学习

- **GraphQL**：Nest.js 对 GraphQL 有完整支持
- **微服务架构**：深入学习服务间通信
- **gRPC**：高性能 RPC 框架
- **CQRS 模式**：命令查询职责分离
- **Event Sourcing**：事件溯源

---

Nest.js 把企业级应用开发需要的东西都准备好了，你只需要专注业务逻辑。它的学习曲线比 Express 陡一些，但一旦上手，你会发现代码组织得井井有条，维护起来舒服多了。
