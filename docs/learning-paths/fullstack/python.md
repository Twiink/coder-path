# Python 全栈学习路线

**Python 全栈以"开发效率"见长**:语法简洁、生态庞大,Django 自带 ORM/Admin/认证(一个框架撑起整个后端),FastAPI 让现代 API 开发快到飞起——**它适合快速验证想法、内容型站点、内部工具,以及 AI 应用的后端**(LLM 生态的示例后端几乎全是 Python)。前提:语言本身见 [Python](/learning-paths/languages/python),这里讲"怎么组合成一条全栈线"。

## 路线一:Django 全栈——一个框架走天下

**Django 是 Python 全栈的"全家桶"**(见 [Django](/learning-paths/backend/django)):自带 ORM(模型即表)、Admin(运营后台白送)、认证(登录/权限内置)、模板(服务端渲染)——**一个小团队用 Django 能撑起内容站/后台系统/电商的完整后端**。
前端两条路:**①Django Templates + HTMX(服务端渲染派)**:模板里写 HTML + HTMX 属性实现局部刷新,几乎不写 JavaScript——**内容型网站(博客/文档/官网)的开发效率极高**(前后端一体,无跨域无联调);**②Django REST Framework + React/Vue(前后端分离派)**:Django 只做 API(DRF 序列化/权限/视图集,见 [Django](/learning-paths/backend/django) 的 DRF 章),前端框架消费——**交互复杂的中后台应用选这条**。
**选择**:内容为主选①,交互为主选②;同一条 Django 后端,两条路可并存(部分页面 SSR、部分 API)。

## 路线二:FastAPI + 前端分离——现代轻量 API 线

偏好更现代、更轻量、要异步性能的 API 开发?**FastAPI 是 Django 之外的第二条主线**(见 [FastAPI](/learning-paths/backend/fastapi)):**FastAPI + SQLAlchemy/SQLModel + PostgreSQL**(数据层)、Pydantic 自动校验(**请求/响应模型即文档**)、自动 OpenAPI 文档(前端照着 Swagger 对接,契约零沟通成本)、JWT 认证与依赖注入、前端 React/Vue 通过 REST API 对接;部署:uvicorn + Docker + Nginx 反代。**适配**:纯 API 后端、前后端分离的 SPA、异步高并发、**AI 应用后端(FastAPI 是 LLM 服务的事实标准)**;**对比 Django**:Django 全家桶(自带 Admin/模板/ORM,适合全栈一体与内容型),FastAPI 轻而现代(API 优先、类型与文档自动)——**要"开箱即用"选 Django,要"API 体验"选 FastAPI**。

## 路线三:数据/AI 全栈——Python 的独有分支

Python 全栈有个其他语言没有的杀手锏:**同一门语言贯穿"Web 后端 + 数据分析 + AI"**:FastAPI/Django 做应用后端 → pandas 做数据处理 → 大模型 API/框架做 AI 能力(见 [AI](/learning-paths/ai/agent-basics))——**"让用户上传数据 → Python 分析 → 网页展示结果/调用模型返回答案"这类应用,Python 线全程无语言切换**。典型产品形态:AI 客服/文档问答的后端(RAG 管道见 [RAG](/learning-paths/ai/rag-systems))、数据看板、自动化工具。

## 跨层工程要点

**①ORM 与迁移是后端的脊梁**:Django ORM(自带迁移)或 SQLAlchemy/Alembic——**改模型跑迁移,别手改表**(见 [Django](/learning-paths/backend/django) 与 [MySQL](/learning-paths/database/mysql));**②认证**:Django 内置认证(服务端渲染用 Session)或 DRF + JWT/SimpleJWT(前后端分离用)——完整流转见 [认证](/learning-paths/security/auth);**③模板渲染的安全**:Django 模板自动转义(防 XSS),`|safe` 慎用(见 [Web 安全](/learning-paths/security/web-security));**④任务与队列**:重活(邮件/报表/AI 推理)交给 Celery(见 [Django](/learning-paths/backend/django) 的 Celery 章)——**请求里别干重活**;**⑤部署**:Gunicorn/uvicorn + Nginx 反代 + Docker,静态文件与媒体文件的分发(见 [部署](/learning-paths/fullstack/deployment) 与 [Docker](/learning-paths/devops/docker));**⑥测试**:pytest 全家(见 [测试](/learning-paths/fullstack/testing) 与 [Pytest](/learning-paths/testing/pytest))。

## 学习路径建议

**第一步**:Django 官网教程做一个 Polls/博客(体验"模型→视图→模板→Admin"全家桶);**第二步**:加 DRF 把数据层暴露成 API,前端用 React/Vue 或 Postman 调通;或直接上 FastAPI 写一个带 Pydantic 校验与自动文档的 API;**第三步**:接入数据库设计、JWT 认证、部署上线——**完成全栈最小闭环**;**第四步**:按产品形态补方向——内容站补 HTMX/SEO,应用补前端框架,AI 产品补 [RAG](/learning-paths/ai/rag-systems) 与模型 API;**第五步**:工程化(CI、Celery 异步、监控、Celery beat 定时——见 [Django](/learning-paths/backend/django) 工程章)。

## 通关标准

能独立做到:用 Django(含 Admin/ORM/认证)做出一个带用户体系与 CRUD 的完整应用并部署;或/且用 FastAPI 写出带自动文档、校验、JWT 的 API 供前端对接;说清 Django 服务端渲染与前后端分离两条路的选型理由;把异步任务(Celery)接进重活场景;能做出一个"前端 + Python 后端 + 数据库"的完整产品并上线——Python 全栈主线通关。

Python 全栈的哲学是"**用开发效率换一切**":别的栈要拼三个框架的活,Django 一个就包了;要 AI 能力时,它是唯一"后端与模型同语言"的栈——**快速验证想法、内部工具、AI 应用,它是第一梯队**。它的代价:性能与并发上限低于 Go/Java(但 FastAPI 异步已拉近差距),大型团队协作的规范要自己立。**建议:内容型/快速原型走 Django 一体,API 型/AI 型走 FastAPI 分离**——两条线都熟,Python 全栈就毕业了。下一步:[前后端协作](/learning-paths/fullstack/collaboration) 补规范,或对照 [Java 全栈](/learning-paths/fullstack/java) 看企业级那派的取舍。
