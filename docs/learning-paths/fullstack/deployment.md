# 部署与监控

写完代码只是开始：构建、迁移、上线、盯监控，全栈工程师得把自己写的服务"送佛送到西"。
## 前端部署（Vercel）

安装 Vercel CLI → 项目根目录执行 `vercel` 部署预览环境 → `vercel --prod` 发布生产；也可以开启 Git 集成，push 即自动部署。

## 后端部署（Docker + Railway）

用多阶段 Dockerfile 构建（先装依赖、再复制源码与产物，运行镜像尽量精简）；本地用 `docker build -t my-api .` 构建、`docker run -p 3000:3000 --env-file .env my-api` 运行。托管平台可选用 Railway、Render 等。

## 数据库迁移

开发环境用 `migrate dev` 生成并应用迁移，生产环境用 `migrate deploy` 只应用不生成；迁移文件要提交进 Git。

## CI/CD（GitHub Actions）

掌握 GitHub Actions 基础流程：push 到 main 触发 → 依次执行 checkout、setup-node、依赖安装（npm ci）、测试、构建 → 用仓库配置的 `VERCEL_TOKEN` secret 部署到 Vercel。

## 监控与日志

错误监控接 Sentry（初始化 DSN、挂全局错误处理器、按环境区分）；日志用 Winston 分级输出，error 与普通日志分文件保存，方便排查。

