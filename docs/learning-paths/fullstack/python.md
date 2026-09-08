# Python 全栈学习路线

Python 以"开发效率"见长：语法简洁、生态丰富，Django 甚至自带 ORM、Admin 与认证，一个框架就能撑起整个后端。适合快速验证想法、内容型站点，以及 AI 应用的落地。

## Django 全栈

**后端：Django**
- 自带 ORM、认证、Admin
- 开箱即用的功能多
- 适合快速开发

**前端：Django Templates + HTMX**
- 服务端渲染
- 少写 JavaScript
- 适合内容型网站

**或者：Django REST Framework + React**
- 前后端分离
- API 驱动


## FastAPI + 前端分离

偏好更现代、更轻量的 API 开发？FastAPI 是 Django 之外的另一条主线：

- FastAPI + SQLModel/SQLAlchemy + PostgreSQL
- Pydantic 自动校验，自动生成 OpenAPI 文档
- JWT 认证与依赖注入
- 前端 React/Vue 通过 REST API 对接
- 部署：uvicorn + Docker + Nginx 反代

