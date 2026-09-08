# Serverless 学习路线

Serverless 不是"没有服务器"，而是"你不用管服务器"。从函数即服务（FaaS）到后端即服务（BaaS），从事件驱动到按需计费，Serverless 改变了应用开发和部署的方式。这条路线会带你了解 Serverless 的核心概念、主要服务、架构模式、最佳实践，以及它的优势与局限。

## 基础篇：核心概念

### 什么是 Serverless
- 定义：无需管理服务器的计算服务
- 核心特点：按需执行、自动扩展、按使用付费、事件驱动
- 不等于 FaaS：Serverless = FaaS + BaaS + 更多
- 抽象层级：从 IaaS → PaaS → FaaS
- 运维责任：开发者只关注代码、云厂商负责基础设施

### FaaS（函数即服务）
- 定义：以函数为单位的计算服务
- 执行模型：触发器 → 函数执行 → 返回结果 → 销毁环境
- 无状态：每次调用独立、不保留上下文
- 生命周期：短暂（秒级-分钟级）
- 主流服务：AWS Lambda、Azure Functions、Google Cloud Functions、阿里云函数计算

### BaaS（后端即服务）
- 定义：后端功能作为服务
- 常见服务：数据库、存储、认证、推送通知、API
- 示例：Firebase、Supabase、AWS Amplify、Auth0
- 优势：开箱即用、无需维护、快速开发
- 前后端分离：前端直接调用 BaaS API

### 事件驱动
- 核心思想：事件触发函数执行
- 事件源：HTTP 请求、消息队列、数据库变更、定时任务、文件上传
- 异步处理：解耦、削峰填谷
- 事件总线：EventBridge、Cloud Pub/Sub
- 发布订阅模式：一对多、松耦合

### 计费模型
- 按调用次数：每百万次请求
- 按执行时间：GB-秒（内存 × 时间）
- 免费额度：Lambda 每月 100 万次请求 + 40 万 GB-秒
- 成本优势：无请求时零成本
- 成本陷阱：高频调用、长时间执行

## 进阶篇：AWS Lambda

### Lambda 基础
- 运行时：Node.js、Python、Java、Go、.NET、Ruby、自定义运行时
- 触发器：API Gateway、S3、DynamoDB、SNS、SQS、EventBridge、CloudWatch
- 配置：内存（128MB-10GB）、超时（最长 15 分钟）、环境变量、IAM 角色
- 并发：账户级并发限制（默认 1000）、函数级预留并发
- 层（Layers）：共享代码、依赖库、自定义运行时

### 冷启动
- 定义：首次调用或长时间未调用后的启动延迟
- 耗时：几十毫秒到几秒（取决于运行时、依赖、代码大小）
- 影响因素：运行时语言、VPC、代码包大小、内存配置
- 优化：预留并发、Provisioned Concurrency、保持函数温暖、减少依赖
- 语言对比：Go/Rust 快、Java/C# 慢、Node.js/Python 中等

### 执行环境
- 容器复用：同一容器可复用、全局变量保留
- /tmp 目录：512MB-10GB、容器复用时保留
- 环境变量：配置参数、密钥（加密）
- 超时：最长 15 分钟、超时后强制终止
- 内存与 CPU：内存越大 CPU 越多（成正比）

### Lambda 集成
- API Gateway：HTTP API、REST API、WebSocket
- ALB（应用负载均衡器）：直接触发 Lambda
- S3 事件：文件上传触发处理
- DynamoDB Streams：数据变更触发
- SQS/SNS：消息队列与发布订阅
- EventBridge：定时任务、跨服务事件

### Lambda 最佳实践
- 单一职责：一个函数做一件事
- 最小化依赖：减少冷启动时间
- 环境变量：配置外部化
- 幂等性：重试不影响结果
- 异步处理：长时间任务使用队列
- 监控告警：CloudWatch Logs、X-Ray 追踪

## 进阶篇：其他 FaaS 平台

### Azure Functions
- 托管计划：消费计划、高级计划、专用计划
- Durable Functions：有状态工作流、编排模式
- 绑定：输入输出绑定简化集成
- 运行时：跨平台、开源
- 触发器：HTTP、Timer、Blob、Queue、Event Grid

### Google Cloud Functions
- 两代版本：1st gen、2nd gen（基于 Cloud Run）
- 事件源：Cloud Storage、Pub/Sub、Firestore、Firebase
- Cloud Run：容器化 Serverless、更灵活
- 最长执行时间：60 分钟（2nd gen）

### 阿里云函数计算
- 触发器：HTTP、定时、对象存储、消息队列、数据库
- 函数计算 2.0：实例级别弹性、预留实例
- 容器镜像：自定义运行环境
- 边缘函数：CDN 边缘节点执行

### 开源 FaaS
- OpenFaaS：Kubernetes 上的 Serverless
- Knative：Kubernetes 原生 Serverless 平台
- Apache OpenWhisk：IBM 开源的 FaaS
- Fission：Kubernetes 原生、快速冷启动
- Fn Project：容器原生、多语言

## 实战篇：Serverless 架构模式

### API 后端
- API Gateway + Lambda + DynamoDB
- 无服务器 REST API
- 自动扩展、按需付费
- 适合：中小型 API、不规则流量

### 事件处理
- S3 → Lambda → 数据处理
- 图片压缩、视频转码、日志分析
- 异步、并行、高吞吐
- 适合：批处理、ETL、媒体处理

### 数据流处理
- Kinesis/Kafka → Lambda → 实时分析
- 流式处理、实时聚合
- 适合：实时监控、点击流分析

### 定时任务
- EventBridge/CloudWatch Events → Lambda
- Cron 表达式、定时触发
- 适合：数据备份、报表生成、清理任务

### Web 应用
- S3（静态资源） + API Gateway + Lambda（API）
- JAMstack 架构：JavaScript + APIs + Markup
- CDN 加速、全球分发
- 适合：博客、单页应用、营销页面

### WebSocket 实时应用
- API Gateway WebSocket + Lambda
- 聊天应用、实时推送、协作工具
- 双向通信、持久连接

### 微服务
- 每个服务一个或多个 Lambda 函数
- 独立部署、独立扩展
- 服务网格：API Gateway 统一入口
- 适合：解耦、灵活扩展

## 实战篇：状态管理

### 无状态设计
- 函数无状态：每次调用独立
- 外部状态：数据库、缓存、对象存储
- 会话管理：JWT、DynamoDB Session Store
- 上传/下载：S3 预签名 URL

### 有状态工作流
- AWS Step Functions：状态机编排
- Azure Durable Functions：工作流引擎
- 长时间任务：分解为多个步骤
- 重试与补偿：容错机制
- 适合：订单处理、审批流程、ETL 管道

### 缓存策略
- API Gateway 缓存：减少 Lambda 调用
- Lambda 全局变量：容器复用时缓存
- ElastiCache：外部缓存层
- /tmp 目录：临时文件缓存

### 数据库选择
- DynamoDB：Serverless NoSQL、自动扩展
- Aurora Serverless：关系型数据库、按需计费
- S3：对象存储、无限容量
- RDS Proxy：连接池、减少冷启动

## 实战篇：性能优化

### 减少冷启动
- Provisioned Concurrency：预留实例
- 最小化依赖：删除无用库、Tree Shaking
- 代码分割：避免单体函数
- 语言选择：Go/Rust 冷启动快
- VPC：避免 VPC 增加冷启动（除非必要）

### 提高并发
- 并发限制：账户级 1000（可申请提高）
- 预留并发：保证关键函数
- 异步调用：不阻塞、削峰填谷
- 批处理：合并请求、减少调用次数

### 内存与 CPU
- 内存调优：找到性价比最优点
- CPU 受限任务：增加内存获得更多 CPU
- 基准测试：不同内存配置对比
- 计算密集型：考虑容器或 EC2

### 网络优化
- 区域选择：靠近用户和资源
- 减少跳数：同区域内集成
- 批量操作：减少往返次数
- 压缩传输：减少数据量

## 实战篇：监控与调试

### CloudWatch 日志
- 自动日志：stdout/stderr 自动收集
- 结构化日志：JSON 格式、方便查询
- 日志保留：设置保留期限、控制成本
- 日志洞察：CloudWatch Logs Insights 查询

### 指标监控
- 调用次数：Invocations
- 错误次数：Errors、Throttles
- 执行时间：Duration、冷启动时间
- 并发：ConcurrentExecutions
- 自定义指标：CloudWatch Metrics

### 分布式追踪
- AWS X-Ray：请求链路追踪
- 服务地图：可视化依赖关系
- 性能瓶颈：定位慢查询、慢调用
- 错误分析：异常堆栈、根因分析

### 本地调试
- SAM CLI：本地模拟 Lambda
- Serverless Framework Offline：离线开发
- LocalStack：本地 AWS 服务模拟
- 单元测试：模拟事件、依赖注入

### 错误处理
- 重试机制：Lambda 自动重试异步调用
- 死信队列（DLQ）：失败消息存储
- 错误告警：CloudWatch Alarms、SNS 通知
- 优雅降级：超时、熔断、限流

## 实战篇：安全与成本

### 安全最佳实践
- 最小权限：IAM 角色精细化
- 环境变量加密：KMS 加密敏感数据
- VPC：隔离网络、访问内网资源
- 资源策略：限制函数调用者
- Secrets Manager：密钥管理
- 依赖扫描：检测漏洞、及时更新

### 成本优化
- 合理内存：不要过度配置
- 减少调用次数：批处理、缓存
- 冷启动与预留并发权衡：按需选择
- 日志保留：定期清理、S3 归档
- 监控成本：Cost Explorer、预算告警
- Savings Plans：长期使用有折扣

### 访问控制
- API Gateway 授权：Lambda 授权器、IAM、Cognito
- 跨账户访问：资源策略
- 临时凭证：STS、AssumeRole
- IP 白名单：资源策略限制

## 下一步学习

掌握 Serverless 后，可以继续深入：

- **容器服务** - AWS Fargate、Cloud Run、Azure Container Instances
- **事件驱动架构** - Event Sourcing、CQRS、Saga 模式
- **微服务架构** - 服务拆分、服务网格、API Gateway
- **云原生模式** - 12-Factor、健康检查、优雅关闭
- **基础设施即代码** - Terraform、CloudFormation、Pulumi
- **DevOps** - CI/CD、蓝绿部署、金丝雀发布

Serverless 是云计算的未来吗？也许不完全是，但它确实改变了我们构建应用的方式。它不是银弹，不适合所有场景：长时间运行的任务、高性能计算、有状态应用都有更好的选择。但对于事件驱动、不规则流量、快速开发的场景，Serverless 是强大的工具。理解它的优势与局限，选择合适的场景，才能发挥最大价值。
