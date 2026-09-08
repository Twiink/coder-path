# Go 全栈学习路线

Go 语法极简、并发能力天生强悍，编译产物是单个二进制，部署运维极其省心——云原生时代的后端主力。Go 全栈的典型组合：Go 写 API，前端配 Vue/React，数据库用 PostgreSQL，容器化部署。

## 为什么选 Go 做全栈

- **高并发**：goroutine 轻松支撑海量连接，写并发代码比任何语言都省心
- **部署简单**：交叉编译后一个二进制到处跑，没有运行时依赖
- **生态现代**：云原生基础设施（Docker、Kubernetes、etcd）几乎都是 Go 写的

## Gin + Vue 前后端分离（推荐）

**后端**
- Gin 路由与中间件、参数绑定与校验
- GORM 操作 PostgreSQL/MySQL
- JWT 认证 + Redis 缓存会话

**前端**
- Vue 3 + Vite + TypeScript（或 React）
- Axios 请求封装、Pinia 状态管理

**最小示例**

参考 Gin 官方文档的 quickstart，定义一个 /api/ping 路由返回 JSON 并启动服务，前端用 `fetch` 即可打通；跑通后再逐步加路由分组、中间件与 GORM。

## 服务端渲染方案

- `html/template` + HTMX：适合后台工具、内容型站点，少写 JavaScript
- 前端静态资源用 `embed` 打进二进制，单文件发布

## 部署

交叉编译用 `GOOS=linux GOARCH=amd64 go build -o app` 得到 Linux 二进制；配合多阶段 Docker 构建，镜像可以压到几十 MB。

- 云服务器直接跑二进制 + systemd 守护
- 或直接推到 Kubernetes / 云原生平台

## 生态速览

- **Web 框架**：Gin（最流行）、Echo、Fiber
- **数据层**：GORM、sqlc、ent
- **配套**：Redis、Kafka/NATS、Prometheus 监控
