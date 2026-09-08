# GitLab CI/CD 学习路线

GitLab CI/CD，集成在 GitLab 中的自动化神器。从代码提交到生产部署，一个 `.gitlab-ci.yml` 文件搞定所有流程。学会它，你就掌握了 DevOps 的核心工具。

## 为什么学 GitLab CI

- 与 GitLab 深度集成，开箱即用
- 功能强大，支持复杂流水线
- 自托管友好，数据完全可控
- Docker 原生支持，容器化构建轻松
- 免费额度慷慨，私有仓库也能用

## 学习路线图

### 第一阶段：基础概念

**核心组件**
- Pipeline：流水线
- Stage：阶段
- Job：任务
- Runner：执行器
- Artifact：构建产物
- Cache：缓存

**第一个 Pipeline**
- .gitlab-ci.yml 配置文件
- stages 阶段定义
- job 任务定义
- script 执行脚本
- image Docker 镜像
- 查看 Pipeline 结果

**Runner 配置**
- Shared Runner（共享）
- Specific Runner（专用）
- 注册 Runner
- tags 标签匹配
- executor 执行器类型

### 第二阶段：构建测试

**前端项目**
- Node.js 环境配置
- npm install 依赖
- npm test 测试
- npm run build 构建
- 缓存 node_modules
- artifacts 构建产物

**后端项目**
- 数据库服务（services）
- 环境变量配置
- 单元测试
- 集成测试
- 代码覆盖率
- 测试报告

**Docker 构建**
- docker:dind 服务
- docker build 构建镜像
- docker push 推送
- 多阶段构建
- 镜像标签策略

**代码质量**
- ESLint / Prettier
- SonarQube 集成
- Code Quality 报告
- SAST 安全扫描
- Dependency Scanning

### 第三阶段：进阶功能

**流水线控制**
- only / except 分支过滤
- rules 规则配置
- when 条件执行
- allow_failure 允许失败
- needs 依赖关系（DAG）

**缓存与产物**
- cache 缓存策略
- cache:key 缓存键
- cache:paths 缓存路径
- artifacts 产物传递
- dependencies 产物依赖

**变量管理**
- CI/CD 变量配置
- 预定义变量
- 自定义变量
- 变量优先级
- Protected Variables

**环境部署**
- environment 环境定义
- 部署到 staging
- 部署到 production
- Manual Jobs 手动触发
- 环境回滚

### 第四阶段：自动化部署

**Kubernetes 部署**
- kubectl 配置
- k8s 集群连接
- 部署 Deployment
- 服务更新
- 健康检查

**云服务部署**
- AWS 部署
- 阿里云部署
- SSH 远程部署
- Docker Compose 部署
- Helm Chart 部署

**多环境策略**
- 开发环境
- 测试环境
- 预发布环境
- 生产环境
- 环境隔离

**发布策略**
- 蓝绿部署
- 金丝雀发布
- 滚动更新
- Feature Flags
- 回滚机制

### 第五阶段：高级技巧

**复杂流水线**
- Parent-child pipelines
- Multi-project pipelines
- Merge request pipelines
- Branch pipelines
- Tag pipelines

**性能优化**
- 并行执行（parallel）
- 缓存优化
- Docker 层缓存
- 增量构建
- 流水线加速

**自定义 Runner**
- 自托管 Runner
- Docker executor
- Shell executor
- Kubernetes executor
- Autoscaling 配置

**安全与合规**
- SAST 静态代码分析
- DAST 动态安全测试
- Dependency Scanning
- Container Scanning
- License Compliance

## 下一步学习

学完 GitLab CI 后，可以继续探索：
- **GitHub Actions**：对比学习另一套 CI/CD
- **Jenkins**：传统 CI/CD 工具
- **Argo CD**：GitOps 部署方案
- **Kubernetes**：容器编排深入

## 实用模板

- **Auto DevOps**：自动化 DevOps 模板
- **Security Templates**：安全扫描模板
- **Code Quality**：代码质量模板
- **SAST**：静态代码分析
- **Dependency Scanning**：依赖扫描

掌握 GitLab CI/CD，你就掌握了自动化的精髓。从简单的测试到复杂的多环境部署，一个配置文件搞定一切。别被 YAML 语法吓到，照着官方文档慢慢调试。先从一个简单的构建任务开始，逐步添加测试、部署、监控。多实践，多思考，GitLab CI 会成为你最强大的 DevOps 工具。
