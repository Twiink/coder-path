# Node.js 学习路线

JavaScript 跑在服务器上，这就是 Node.js。用同一门语言写前后端，前端工程师的福音。事件驱动、非阻塞 I/O，天生适合高并发场景。npm 生态系统庞大到你想要的基本都有。

## 为什么学 Node.js

前端已经会 JavaScript 了，学 Node.js 就能搞后端，前后端通吃。而且 Node.js 的异步编程模型和浏览器很像，上手快。适合做 API 服务、实时应用、工具脚本、构建工具等。

性能方面，得益于 V8 引擎和事件循环机制，Node.js 处理 I/O 密集型任务很强。虽然 CPU 密集型任务不如 Go、Rust，但对大多数 Web 应用来说够用了。

## 学习路线图

### 基础篇：JavaScript 运行时

- **安装与环境配置**
  - 使用 nvm 管理 Node.js 版本
  - 理解 npm/yarn/pnpm 包管理器
  - 配置开发环境和编辑器

- **模块系统**
  - CommonJS 模块（require/module.exports）
  - ES Modules（import/export）
  - 模块解析机制和路径规则
  - 第三方包的引入与使用

- **核心模块**
  - `fs`：文件系统操作（同步/异步/Promise）
  - `path`：路径处理和拼接
  - `http/https`：HTTP 服务器和客户端
  - `url`：URL 解析和构建
  - `events`：事件驱动编程
  - `stream`：流式数据处理
  - `process`：进程信息和控制
  - `os`：操作系统信息
  - `crypto`：加密和哈希

- **事件循环机制**
  - 事件循环的六个阶段
  - timers 阶段：setTimeout、setInterval
  - pending callbacks 阶段：I/O 回调
  - idle、prepare 阶段：内部使用
  - poll 阶段：轮询 I/O 事件
  - check 阶段：setImmediate
  - close callbacks 阶段：关闭回调
  - process.nextTick 的执行时机
  - 微任务队列 vs 宏任务队列

- **libuv 与异步 I/O**
  - libuv 事件循环实现
  - 线程池机制：处理文件 I/O
  - 非阻塞 I/O：网络操作
  - 事件驱动架构
  - 句柄（Handle）与请求（Request）
  - 平台差异处理：epoll、kqueue、IOCP

- **V8 引擎与性能**
  - V8 编译流水线：解析、优化、执行
  - JIT 编译：TurboFan 优化编译器
  - 内联缓存（Inline Cache）
  - 隐藏类（Hidden Classes）
  - 垃圾回收：新生代、老生代
  - Scavenge 算法与 Mark-Sweep
  - 增量标记与并发标记
  - 内存泄漏检测与分析

- **异步编程**
  - 回调函数（Callback）
  - Promise 和链式调用
  - async/await 语法
  - 错误处理和异常捕获
  - 并发控制和 Promise.all

### 进阶篇：Express 框架与 Web 开发

- **Express 基础**
  - 创建 HTTP 服务器
  - 路由定义和参数处理
  - 中间件机制和执行顺序
  - 请求和响应对象
  - 静态文件服务

- **路由与控制器**
  - 路由模块化和分组
  - 路由参数、查询参数、请求体
  - RESTful API 设计
  - 路由前缀和版本控制

- **中间件开发**
  - 内置中间件（express.json、express.static）
  - 第三方中间件（morgan、helmet、compression）
  - 自定义中间件编写
  - 错误处理中间件

- **数据库集成**
  - MongoDB + Mongoose（文档数据库）
  - PostgreSQL/MySQL + Sequelize/Prisma（关系数据库）
  - 连接池配置
  - ORM/ODM 查询和关系处理

- **认证与授权**
  - JWT 令牌生成和验证
  - 密码加密（bcrypt）
  - Session 会话管理
  - OAuth 2.0 第三方登录
  - 权限中间件和角色控制

- **文件处理**
  - 文件上传（multer）
  - 文件存储策略（本地/云存储）
  - 图片处理和压缩
  - 流式上传和下载

### 实战篇：高级特性与生产部署

- **实时通信**
  - WebSocket 基础（ws 库）
  - Socket.IO 实时双向通信
  - 房间和广播机制
  - 心跳检测和断线重连

- **任务队列与定时任务**
  - Bull 队列（基于 Redis）
  - 任务重试和失败处理
  - 定时任务（node-cron）
  - 后台任务处理策略

- **测试**
  - 单元测试（Jest）
  - API 测试（Supertest）
  - 测试覆盖率
  - Mock 和 Stub

- **性能优化**
  - 集群模式（Cluster）
  - 缓存策略（Redis、内存缓存）
  - 响应压缩（compression）
  - 数据库查询优化
  - 负载均衡

- **Node.js 内存管理**
  - V8 堆内存结构
  - 新生代内存：From Space、To Space
  - 老生代内存：Old Pointer Space、Old Data Space
  - 大对象空间：Large Object Space
  - 内存限制：--max-old-space-size
  - 内存快照分析：heapdump
  - 内存泄漏排查：常见场景与解决

- **Stream 流式处理深入**
  - 四种流类型：Readable、Writable、Duplex、Transform
  - 流的模式：flowing mode vs paused mode
  - 背压（Backpressure）机制
  - pipe 方法的实现原理
  - pipeline 错误处理
  - 自定义流的实现
  - 流的性能优化技巧

- **Cluster 集群模式**
  - 多进程架构：Master-Worker 模式
  - 进程间通信：IPC
  - 负载均衡策略：Round-Robin
  - 进程守护与重启
  - 零停机重启（Zero Downtime）
  - PM2 集群管理
  - Worker Threads vs Cluster

- **部署与运维**
  - PM2 进程管理器
  - Docker 容器化
  - 环境变量管理（dotenv）
  - 日志管理（Winston）
  - 错误监控和报警
  - Nginx 反向代理

- **最佳实践**
  - 项目结构设计（MVC/分层架构）
  - 错误处理和统一响应格式
  - API 版本控制
  - 安全防护（CORS、XSS、CSRF、SQL 注入）
  - 代码规范和 ESLint

## 下一步学习

- **NestJS**：TypeScript + 依赖注入的企业级框架
- **GraphQL**：API 查询语言，替代 REST
- **微服务架构**：服务拆分、通信、治理
- **消息队列**：RabbitMQ、Kafka 深入学习
- **TypeScript**：类型安全的 Node.js 开发

## 性能调优篇

### 性能分析工具
- clinic.js：性能诊断套件
- node --inspect：Chrome DevTools 调试
- 火焰图（Flame Graph）：CPU 分析
- 0x：性能分析工具
- autocannon：HTTP 压测工具

### 性能优化策略
- 避免同步操作：使用异步 API
- 减少闭包创建：复用函数
- 使用对象池：减少 GC 压力
- 缓存热数据：Redis、内存缓存
- 数据库连接池优化
- 响应压缩与静态资源 CDN
- HTTP/2 与 Keep-Alive
- 日志异步写入

---

Node.js 让前端工程师也能写后端，降低了全栈开发的门槛。生态系统成熟，工具链完善，适合快速开发和迭代。记住：Node.js 擅长 I/O 密集型任务，CPU 密集型任务可以用 Worker Threads 或交给其他语言。加油！
