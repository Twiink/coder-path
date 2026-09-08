# FastAPI 学习路线

Python 异步 Web 框架的新秀，性能媲美 Node.js 和 Go，自动生成 API 文档，类型提示贯穿始终。FastAPI 把现代 Python 的优势发挥到了极致：类型注解、异步编程、依赖注入，一个都不少。

## 为什么选择 FastAPI

Flask 简单但不够快，Django 全能但太重，FastAPI 找到了甜蜜点：既有现代框架的性能，又有 Python 的开发体验。它基于 Starlette（ASGI 框架）和 Pydantic（数据验证），自动生成 OpenAPI 文档，类型提示让 IDE 的自动补全和错误检查如虎添翼。

如果你要做 API 服务、微服务、实时应用，FastAPI 是 2024 年的最佳选择之一。

## 学习路线图

### 基础篇：类型驱动开发

- **快速开始**
  - 安装和环境配置
  - 第一个 FastAPI 应用
  - 自动文档（Swagger UI、ReDoc）
  - 异步和同步端点

- **路径操作**
  - 路径参数和类型验证
  - 查询参数和默认值
  - 请求体（Pydantic 模型）
  - 多个参数类型组合
  - 路径操作配置

- **请求数据**
  - 路径参数验证（Path）
  - 查询参数验证（Query）
  - 请求体验证（Body）
  - 表单数据（Form）
  - 文件上传（File、UploadFile）
  - Headers 和 Cookies

- **响应模型**
  - response_model 定义
  - 响应过滤字段
  - 响应状态码
  - 多种响应类型
  - 流式响应

- **Pydantic 模型**
  - 模型定义和字段类型
  - 字段验证（Field）
  - 嵌套模型
  - 模型继承
  - 配置和示例

### 进阶篇：依赖注入与数据库

- **依赖注入系统**
  - 依赖函数定义
  - Depends 使用
  - 类依赖
  - 子依赖
  - 全局依赖
  - 依赖缓存

- **数据库集成**
  - SQLAlchemy ORM 集成
  - 异步数据库（databases、SQLModel）
  - 模型定义和关系
  - CRUD 操作
  - 数据库会话管理
  - 迁移（Alembic）

- **认证与授权**
  - OAuth2 密码流
  - JWT 令牌生成和验证
  - 密码哈希（passlib、bcrypt）
  - 依赖注入认证
  - 作用域和权限
  - API Key 认证

- **中间件**
  - CORS 中间件
  - 自定义中间件
  - 请求/响应拦截
  - 性能监控
  - 限流中间件

- **后台任务**
  - BackgroundTasks
  - 异步任务执行
  - Celery 集成
  - 任务队列

### 实战篇：高级特性与部署

- **WebSocket**
  - WebSocket 端点
  - 连接管理
  - 消息广播
  - 房间和分组
  - 认证集成

- **文件处理**
  - 单文件上传
  - 多文件上传
  - 文件下载
  - 流式文件处理
  - 文件验证

- **APIRouter 模块化**
  - 路由器创建和配置
  - 路由分组
  - 标签和元数据
  - 依赖共享
  - 路由前缀

- **错误处理**
  - HTTPException
  - 自定义异常类
  - 异常处理器
  - 验证错误处理
  - 统一错误格式

- **配置管理**
  - Pydantic Settings
  - 环境变量
  - 多环境配置
  - 配置验证
  - 敏感信息处理

- **元数据与文档**
  - OpenAPI 定制
  - 标签和描述
  - 响应示例
  - 安全方案声明
  - 文档定制

- **测试**
  - TestClient 使用
  - 异步测试
  - 数据库测试
  - Mock 依赖
  - 测试覆盖率

- **性能优化**
  - 异步数据库查询
  - 响应模型优化
  - 流式响应
  - 缓存策略
  - 连接池配置

- **部署**
  - Uvicorn 服务器
  - Gunicorn + Uvicorn Workers
  - Docker 容器化
  - 环境变量管理
  - 日志配置
  - 健康检查端点

- **监控与日志**
  - 请求日志
  - 错误追踪
  - 性能监控
  - APM 集成
  - Prometheus 指标

- **最佳实践**
  - 项目结构设计
  - 依赖注入模式
  - 错误处理策略
  - API 版本控制
  - 安全防护

## 下一步学习

- **GraphQL**：Strawberry 或 Ariadne 集成
- **gRPC**：高性能 RPC 框架
- **微服务**：服务发现、负载均衡
- **事件驱动**：消息队列和事件总线
- **全栈开发**：FastAPI + Vue/React

---

FastAPI 把 Python 的现代特性发挥到了极致，类型提示不仅让代码更安全，还自动生成文档和验证逻辑。异步支持让性能直逼 Node.js，是做 API 服务的不二之选。
