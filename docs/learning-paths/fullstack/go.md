# Go 全栈学习路线

**Go 全栈是"云原生时代的效率之选"**:Go 语法极简、并发天生强悍(goroutine),编译产物是**单个静态二进制**(无运行时依赖),部署运维极其省心——写 API、容器化、上 K8s 一条龙顺滑。它的典型组合:**Go 写后端 API + Vue/React 前端 + PostgreSQL + Docker 部署**(语言见 [Go+Gin](/learning-paths/backend/golang),前端任选 [Vue](/learning-paths/frontend/vue) 或 [React](/learning-paths/frontend/react))。**适合画像**:追求性能与简洁、面向云原生/高并发场景、喜欢"部署零焦虑"的开发者;**不适合**:想要"全家桶开箱即用"(Go 生态偏"小而精",没有 Django/Rails 那种一体框架——前后端分离是它的默认形态)。

## 为什么选 Go 做全栈(三条核心理由)

**①高并发是母语**:goroutine 轻松支撑海量连接,写并发代码(WebSocket 服务/推送/网关)比任何语言都省心——**全栈应用里"实时/高并发"的部分,Go 是舒适区**(见 [Go 并发](/learning-paths/backend/golang) 章);**②部署简单到奢侈**:交叉编译一条命令出 Linux 二进制(`GOOS=linux GOARCH=amd64 go build`),配多阶段 Docker 镜像可压到**几十 MB**,云服务器直接跑 + systemd 守护——**没有 Node 的 node_modules、没有 JVM 的启动调优**(见 [Docker](/learning-paths/devops/docker));**③生态在云原生中心**:Docker/Kubernetes/etcd/Prometheus 全是 Go 写的——**你学的语言就是基础设施的语言**,写云原生工具/中间件近水楼台。

## 配方:Gin + Vue/React 前后端分离(推荐)

**后端**:Gin(路由与中间件、参数绑定与校验——见 [Go+Gin](/learning-paths/backend/golang))+ **GORM 操作 PostgreSQL/MySQL**(模型即表、预加载防 N+1)+ JWT 认证(golang-jwt) + Redis(缓存/会话——见 [Redis](/learning-paths/database/redis));分层 handler/service/repository(依赖注入手工组装,见 [Go](/learning-paths/backend/golang) 项目结构章)。**前端**:Vue 3 + Vite + TS 或 React(见 [Vue](/learning-paths/frontend/vue))——Axios 请求封装、Pinia/Zustand 状态、路由守卫带 token。**最小打通路径**:Gin 起一个 `/api/ping` 返回 JSON → 前端 fetch 调通(跨域配 CORS)→ 再加路由分组/中间件/GORM——**先通后深,是 Go 全栈最快的上手方式**。

## 其他形态

**①服务端渲染方案(轻量工具/内容站)**:`html/template` + HTMX(局部刷新少写 JS)——后台工具/内容型站点不用上 SPA;**前端静态资源用 `embed` 打进二进制——单文件发布,连静态目录都不用拷**(全栈部署的极致省心);**②一体化 Web 框架**:想要"框架多管一点"可看 Buffalo 或 Templ(模板组件化)——生态小众,按需。**③微服务与云原生延伸**:Go 在微服务/网关方向是主力(go-zero/Kratos 等企业框架,见 [Go](/learning-paths/backend/golang) 下一步章)——**全栈做到后期,Go 栈自然通向云原生架构**。

## 跨层工程要点

**①类型与契约**:Go 强类型 + struct tag 绑定 JSON——**API 的请求/响应模型用结构体定死,前后端对照 OpenAPI 契约联调**(可加 swaggo 自动生成 Swagger 文档,见 [协作](/learning-paths/fullstack/collaboration));**②错误处理纪律**:Go 的 error 显式处理 + 统一错误响应中间件(见 [Go](/learning-paths/backend/golang) 错误章)——**"错误必处理"让后端质量天然高一个档**;**③测试**:go test 表格驱动 + httptest 接口测试(见 [测试](/learning-paths/fullstack/testing) 与 [Go](/learning-paths/backend/golang) 测试章);**④部署与监控**:二进制 + systemd 或 Docker/K8s、Prometheus 指标(见 [监控](/learning-paths/devops/monitoring))——**Go 服务的可观测接入是各语言里最顺的**(官方 client 库齐全)。

## 学习路径建议

**第一步**:Go 语法地基(类型/函数/结构体/接口——约两周,见 [Go 语言](/learning-paths/backend/golang) 前四站);**第二步**:Gin 写 REST API + GORM 接 PostgreSQL(CRUD 跑通);**第三步**:接 Vue/React 前端(登录 JWT 打通——全栈最小闭环);**第四步**:补并发实战(WebSocket/推送,体验 goroutine 的爽)与 Redis 缓存;**第五步**:单二进制 + Docker 部署上线 + CI 自动构建——**"部署零焦虑"在这一步兑现**。

## 通关标准

能独立做到:用 Gin + GORM 写出带 JWT 认证、统一错误、分层清晰的 REST API;前端调通并完成"登录→CRUD→登出"闭环;交叉编译出 Linux 二进制并用 Docker 多阶段构建出小镜像部署上线;写过一个 goroutine + channel 的并发场景(如 WebSocket 广播);跑通 go test + httptest 的接口测试——Go 全栈主线通关。

Go 全栈是"**少即是多**"哲学的全栈版:没有全家桶、没有黑魔法,换来的是极简的心智负担与极致的部署体验——**你的精力花在业务与架构上,而不是框架版本与部署环境上**。它的边界也清晰:前端生态它不掺和(安心做后端),复杂业务快速迭代不如 Python/JS 快——**选它,是因为你重视"长期运行的系统"多于"最快的第一版"**。下一步:[前后端协作](/learning-paths/fullstack/collaboration) 补契约,或深入 [Go+Gin](/learning-paths/backend/golang) 把后端做深。
