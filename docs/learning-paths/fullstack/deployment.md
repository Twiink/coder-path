# 全栈部署与监控学习路线

写完代码只是开始:**构建、迁移、上线、盯监控——全栈工程师得把自己写的服务"送佛送到西"**。本页给"从本地到生产"的完整部署地图:前端怎么发、后端怎么跑、数据库怎么迁、CI 怎么自动、上线后怎么看——纵深见 [Docker](/learning-paths/devops/docker)、[GitHub Actions](/learning-paths/devops/github-actions)、[监控](/learning-paths/devops/monitoring) 与 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 各页。

## 第一站:前端部署——静态资源的最优解

**前端构建产物 = 纯静态文件(HTML/JS/CSS/图片)**,部署的核心是"让全球用户快速拿到 + 刷新不 404":**①托管平台(零运维首选)**:Vercel(Next 系一键)、Netlify、Cloudflare Pages、GitHub Pages——Git 集成开启后 **push 即自动部署**(见 [GitHub Actions](/learning-paths/devops/github-actions) 的 Pages/静态站部署章);**②自托管(服务器/Nginx)**:`npm run build` 出 dist → Nginx 指向 dist 目录 + **SPA 路由回退(try_files 到 index.html,否则刷新 404)** + 静态缓存头(gzip + hash 文件名长缓存——见 [Nginx](/learning-paths/middleware/nginx));**③CDN**:静态资源上 CDN 全球加速(云厂商/Cloudflare)——前端部署的"最后一公里";**④环境变量注意**:前端变量构建期内联(VITE_/NEXT_PUBLIC_)——**改环境变量要重新构建**,多环境靠 CI 分环境构建(见 [Vite](/learning-paths/frontend/vite) 环境章)。

## 第二站:后端部署——容器化是标准答案

**①Docker 化(后端部署的地基)**:多阶段 Dockerfile(构建阶段装依赖编译 → 运行阶段只拷产物,镜像尽量精简——见 [Docker](/learning-paths/devops/docker) 章);本地 `docker build` + `docker run -p 端口 --env-file .env` 验证;**②进程与守护**:容器里直接跑应用(exec 形式收信号),宿主机用 systemd 或 Docker restart 策略守护(见 [Linux](/learning-paths/devops/linux) systemd 章);**③托管平台(省心选项)**:Railway/Render/Fly.io/云厂商 App 服务——Git 推送即部署,适合小团队;**④自建服务器**:云服务器(阿里云/腾讯云/AWS ECS)+ Nginx 反代(HTTPS 证书 certbot——见 [Nginx](/learning-paths/middleware/nginx) HTTPS 章);**⑤规模演进**:容器编排(K8s,见 [Kubernetes](/learning-paths/devops/kubernetes))或 Serverless(见 [Serverless](/learning-paths/cloud-native/serverless))——**先单机跑稳,再谈集群**。
**环境与密钥**:生产环境变量与密钥用平台 Secret/环境变量注入,绝不进代码库(见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 配置章)。

## 第三站:数据库迁移——上线最容易翻车的环节

**迁移(migration)是把"表结构变更"变成版本化代码**:开发环境生成并应用(`migrate dev`/`makemigrations`),**生产只应用不生成(`migrate deploy`/`migrate`)——迁移文件必须提交进 Git**(团队与 CI 共用同一套,见 [Django](/learning-paths/backend/django)/[Prisma] 迁移章与 [MySQL](/learning-paths/database/mysql))。**上线纪律**:①先备份再迁移(数据库备份是生命线,见 [MySQL](/learning-paths/database/mysql) 备份章);②**迁移与代码发布的顺序**(先迁后发:新代码依赖新表;或先发后迁:旧代码兼容——**大表加列/加索引选低峰期,锁表风险要知道**);③**不可逆操作(删列/删表)要谨慎**——先确认无引用,分步走;④**数据修正(刷数据)用数据迁移脚本而非手工 SQL**(可评审可回滚);⑤**迁移失败预案**:事务性迁移可回滚,非事务的(加索引)失败要能重跑(幂等)。

## 第四站:CI/CD——让发布自动化且可回滚

**CI/CD 的价值不是"省手点",而是"每次发布都走同一套验证过的流程"**:①**CI(持续集成)**:push/PR 触发——装依赖 → 测试 → 构建(见 [测试](/learning-paths/fullstack/testing));②**CD(持续部署)**:通过测试的分支自动部署(前端 push main 即上 Vercel;后端构建镜像推送 + 服务器拉取重启或平台自动部署——见 [GitHub Actions](/learning-paths/devops/github-actions) 部署章);③**发布策略进阶**:生产部署带人工闸(environment 审批——见 [GitHub Actions](/learning-paths/devops/github-actions) 环境章)、金丝雀/蓝绿(小流量验证再全量,见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 发布章);④**可回滚是底线**:每次发布有版本标识(镜像 tag=commit sha),出问题一键回滚上一版——**"能快速回滚"比"保证不出错"更现实**。

## 第五站:监控与日志——上线后的眼睛

**①错误监控(第一优先)**:Sentry(初始化 DSN + 挂全局错误处理器 + 按环境区分——**线上报错第一时间进你的邮箱/IM**,见各框架错误处理章与 [监控](/learning-paths/devops/monitoring));**②日志(排查的现场)**:结构化分级输出(JSON + 级别),error 与普通日志分开便于检索;容器里走 stdout 由采集层收集(见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 日志章);**③指标(健康的仪表盘)**:请求量/错误率/延迟(P95)+ 资源(CPU/内存/磁盘)——Prometheus + Grafana(见 [监控](/learning-paths/devops/monitoring));**④可用性探针**:健康检查端点(/healthz)+ 外部拨测("用户视角的网站通不通",见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 健康检查章);**⑤告警纪律**:只告"可行动的"(磁盘 90%/错误率飙高/服务宕机),别让告警噪音淹没真信号(见 [监控](/learning-paths/devops/monitoring) 告警章)。

## 第六站:完整上线流程(把全站串起来)

**一次标准发布的长什么样(背下来当 checklist)**:①本地跑通测试与构建 → ②push → CI 自动测试(挂了打回)→ ③通过后构建产物(前端 dist/后端镜像)推送 → ④**数据库迁移先行**(或与发布同序,按第三站纪律)→ ⑤部署新版本(带版本标识)→ ⑥健康检查与关键接口冒烟(手动或自动)→ ⑦盯监控(Sentry 错误率/指标)10 分钟 → ⑧异常立即回滚——**"小步快发 + 快速回滚"比"憋大招 + 发布日通宵"健康一百倍**(发布频率是团队信心的标尺,见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 组织章)。

## 通关标准

能独立做到:前端 dist 部署到 Nginx(含 SPA 回退与缓存头)或托管平台;后端 Docker 化部署到云服务器(HTTPS + 反代 + 守护);用迁移工具管理一次表结构变更并说清"先迁后发"与"先发后迁"的取舍;把 CI/CD 接好(测试自动跑、生产带审批、版本可回滚);接上 Sentry + 指标监控并配出两条"可行动"的告警——全栈部署主线通关。

部署与监控是"全栈工程师的成人礼":**代码能跑不算完,能在线上稳定跑、坏了能快速发现与回滚,才算交付**。它的心法也是云原生的心法——**不可变发布(镜像/版本)、自动化流程(CI/CD)、可观测(日志/指标/追踪)、快速回滚**。别被"运维"吓到:先手工部署通一次(理解每一层),再上 Docker 与 CI(把流程固化),最后补监控告警(让系统自己说话)——**"送佛送到西"的完整链路走通一遍,你就不是"会写代码"而是"能交付"的工程师了**。下一步:把整套流程容器化/平台化看 [Docker](/learning-paths/devops/docker) 与 [Kubernetes](/learning-paths/devops/kubernetes),监控细化见 [Prometheus](/learning-paths/devops/monitoring)。
