# GitHub Actions 学习路线

GitHub Actions，把 CI/CD 搬到 GitHub 里的神器。从代码提交到自动部署，一个 YAML 文件搞定所有流程。学会它，你就掌握了现代化的自动化工作流。

## 为什么学 GitHub Actions

- 与 GitHub 深度集成，无需额外服务器
- 免费额度慷慨（公开仓库无限制）
- 生态丰富，海量现成 Actions 可用
- YAML 配置简单，上手快
- 支持矩阵构建、缓存、并行任务

## 学习路线图

### 第一阶段：基础概念

**核心组件**
- Workflow：自动化流程
- Job：一组 steps
- Step：单个任务
- Action：可复用任务单元
- Runner：执行环境
- Event：触发事件

**第一个 Workflow**
- .github/workflows/ 目录
- name 和 on 触发条件
- jobs 任务定义
- runs-on 运行环境
- steps 步骤编排
- actions/checkout 检出代码

**触发事件**
- push 代码推送
- pull_request PR 触发
- schedule 定时任务
- workflow_dispatch 手动触发
- release 发布触发
- issues / comments 事件

### 第二阶段：构建测试

**Node.js 项目**
- actions/setup-node 环境准备
- npm install 依赖安装
- npm test 运行测试
- npm run build 构建
- 缓存 node_modules
- 多 Node 版本矩阵

**Python 项目**
- actions/setup-python
- pip install 依赖
- pytest 测试
- flake8 / black 代码检查
- 多 Python 版本测试
- 覆盖率报告

**前端项目**
- 安装依赖
- ESLint / Prettier 检查
- 单元测试
- E2E 测试
- 构建产物
- 部署到静态托管

**后端项目**
- 数据库服务（services）
- 环境变量配置
- 集成测试
- Docker 镜像构建
- 推送到镜像仓库

### 第三阶段：进阶功能

**缓存优化**
- actions/cache 缓存依赖
- 缓存键策略
- 恢复键（restore-keys）
- 缓存路径配置
- 加速构建时间

**矩阵构建**
- matrix 多版本测试
- Node 版本矩阵
- OS 系统矩阵
- include / exclude 控制
- fail-fast 策略

**条件执行**
- if 条件判断
- success() / failure() 函数
- 分支条件
- 路径过滤
- 环境变量判断

**环境与 Secrets**
- 仓库 Secrets 配置
- 环境变量使用
- 环境（Environments）
- 审批流程
- 敏感信息保护

### 第四阶段：自动化部署

**静态网站部署**
- GitHub Pages 部署
- Vercel 部署
- Netlify 部署
- actions/deploy-pages
- CNAME 域名配置

**Docker 镜像**
- docker/build-push-action
- Docker Hub 推送
- GitHub Container Registry
- 多平台构建
- 镜像标签策略

**云服务部署**
- AWS 部署
- 阿里云部署
- 腾讯云部署
- SSH 远程部署
- Kubernetes 部署

**发布管理**
- 自动创建 Release
- 生成 Changelog
- 上传构建产物
- GitHub Releases API
- 语义化版本

### 第五阶段：高级技巧

**自定义 Action**
- JavaScript Action
- Docker Action
- Composite Action
- action.yml 定义
- 发布到 Marketplace

**工作流复用**
- 可复用工作流（Reusable Workflows）
- workflow_call 触发
- inputs 和 outputs
- secrets 传递
- 跨仓库复用

**并发控制**
- concurrency 配置
- 取消正在运行的任务
- 队列管理
- 分支保护规则
- 部署环境限制

**调试技巧**
- 启用 debug 日志
- 使用 tmate 远程调试
- act 本地测试
- 查看 workflow 历史
- 失败重试策略

## 下一步学习

学完 GitHub Actions 后，可以继续探索：
- **GitLab CI**：对比学习另一套 CI/CD
- **Jenkins**：传统 CI/CD 工具
- **CircleCI / Travis CI**：其他云 CI 方案
- **自托管 Runner**：私有化部署

## 实用 Actions

- **actions/checkout**：检出代码
- **actions/setup-node**：Node.js 环境
- **actions/cache**：缓存依赖
- **docker/build-push-action**：Docker 构建
- **peaceiris/actions-gh-pages**：GitHub Pages 部署

掌握 GitHub Actions，你就掌握了自动化的精髓。从简单的 CI 到复杂的多环境部署，一个 YAML 文件搞定一切。别被 YAML 缩进吓到，照着官方示例改就行。先从一个简单的测试流程开始，慢慢添加构建、部署步骤。多实践，多思考，GitHub Actions 会成为你最高效的自动化工具。
