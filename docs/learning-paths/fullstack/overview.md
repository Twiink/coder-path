# 全栈开发学习路线

**全栈工程师不是"什么都会一点"的万金油,而是能独立把一个产品从 0 做到 1 的实战派**:前端界面、后端接口、数据库、部署运维,一个人打通全链路。它要求的是"广度足够 + 一条主线足够深"——**先有主技术栈的深度,再谈跨层的广度**。本页是"全栈"的地图与组合方法;每个领域的纵深请跳转到对应路线页([前端](/learning-paths/frontend/javascript)/[后端](/learning-paths/backend/nodejs)/[数据库](/learning-paths/database/mysql)/[DevOps](/learning-paths/devops/docker))。

## 全栈工程师的能力地图

**①前端能力**:HTML/CSS/JavaScript 基础扎实(见 [前端路线](/learning-paths/frontend/html-css));至少精通一个框架(React 或 Vue——见 [React](/learning-paths/frontend/react)/[Vue](/learning-paths/frontend/vue));响应式与移动端适配;前端性能与用户体验(见 [性能](/learning-paths/fullstack/performance))。**②后端能力**:至少一门后端语言(下节选主线);RESTful API 设计与错误规范(见 [协作](/learning-paths/fullstack/collaboration));数据库设计与 SQL(见 [MySQL](/learning-paths/database/mysql));认证授权(JWT/OAuth——见 [认证](/learning-paths/security/auth));缓存与队列(见 [Redis](/learning-paths/database/redis) 与 [消息队列](/learning-paths/middleware/rabbitmq))。**③DevOps 能力**:Git(见 [Git](/learning-paths/tools/git))、Docker([Docker](/learning-paths/devops/docker))、CI/CD([GitHub Actions](/learning-paths/devops/github-actions))、云服务与部署([部署](/learning-paths/fullstack/deployment))、监控日志([监控](/learning-paths/devops/monitoring))。**④软技能**:产品思维(理解"为什么做"比"怎么做"先)、架构意识(系统怎么拆、数据怎么流)、沟通协作、**快速学习(技术日新月异,但底层(HTTP/数据结构/操作系统)不变——把底层学扎实,框架只是换皮)**。

## 选择你的主力语言——四条主流全栈线

**全栈的捷径不是学四套栈,而是"一门语言/一个生态贯穿前后端"**,四选一(每条的完整配方见各自页):

- **JavaScript/TypeScript 全栈**(上手最快、生态最大):React/Vue 写前端,Node.js(Nest/Express)写后端,**一门语言通吃**,Next.js/Nuxt 还能前后端同仓——见 [JavaScript 全栈](/learning-paths/fullstack/javascript);
- **Python 全栈**(开发效率最高):Django 自带 ORM/Admin/认证(一个框架撑起后端),FastAPI 做现代 API,适合快速迭代与 AI 应用——见 [Python 全栈](/learning-paths/fullstack/python);
- **Java 全栈**(企业级最稳):Spring Boot 生态成熟,适合大型项目与团队协作(国内岗位量最大)——见 [Java 全栈](/learning-paths/fullstack/java);
- **Go 全栈**(云原生效率之选):高并发、单二进制部署、前后端分离干净利落——见 [Go 全栈](/learning-paths/fullstack/go)。

**怎么选**:要"最快做出完整产品、前后端自由切"→ JS 线;要"写起来快、想接 AI"→ Python;要"进大厂做企业级"→ Java;要"高性能、云原生"→ Go。**别纠结太久**:全栈的核心能力(HTTP/数据建模/部署/调试)与语言无关,**先选一条跑通一个完整产品,第二门语言自然水到渠成**。

## 全栈通用工程实践——必刷的公共副本

选定语言后,每个全栈开发者都会遇到同样的横向问题,四条"公共副本"建议逐一通关:

- **前后端协作**:API 怎么设计、错误怎么统一、鉴权怎么流转、联调怎么少吵架(契约先行/类型共享)——见 [前后端协作](/learning-paths/fullstack/collaboration);
- **性能优化**:前端(代码分割/缓存/加载)与后端(查询/缓存/并发)的完整套路——见 [性能优化](/learning-paths/fullstack/performance);
- **测试**:单元(前端组件/后端逻辑)+ 接口测试 + E2E 的分层策略——见 [测试](/learning-paths/fullstack/testing);
- **部署与监控**:前端静态托管/CDN、后端容器化、数据库迁移、CI/CD、日志与错误监控——见 [部署与监控](/learning-paths/fullstack/deployment)。

## 建议的成长路径(从 0 到独立交付)

**阶段一(会做页面)**:HTML/CSS/JS → 一个框架(React/Vue) → 能调 API 渲染数据([前端路线](/learning-paths/frontend/html-css) 通关)。**阶段二(会写接口)**:一门后端语言 + 框架 → REST API + 数据库增删改查 → JWT 登录——**此时你已能"前端调自己写的接口"**,完成第一个全栈 demo(见 [Node.js](/learning-paths/backend/nodejs) 或 [Django](/learning-paths/backend/django))。**阶段三(会上线)**:Docker 容器化 + 部署到云服务器 + 域名 HTTPS——**让作品能被别人访问**(见 [Docker](/learning-paths/devops/docker) 与 [部署](/learning-paths/fullstack/deployment))。**阶段四(会做工程)**:CI/CD 自动测试发布、监控日志、缓存与性能优化、代码规范与协作流程——**从"能跑"到"能维护"**(见 [GitHub Actions](/learning-paths/devops/github-actions) 与 [监控](/learning-paths/devops/monitoring))。**阶段五(会做架构)**:按业务拆服务、消息队列解耦、读写分离/缓存分层——**从"单体"到"可扩展"**(见 [微服务](/learning-paths/microservices/microservices-patterns) 与 [云原生](/learning-paths/cloud-native/cloud-native-patterns))。

## 心态与常见误区

**误区一:"全栈 = 每层都精通"**——不现实也不必:前端/后端各有纵深页,你的目标是**每层"能独立交付",有一层"足够深"**(面试与实战都看深度)。**误区二:只学框架不学底层**——全栈的天花板在底层(HTTP/网络/操作系统/数据结构,见 [计算机基础](/learning-paths/cs-basics/computer-networks));框架迭代快,底层二十年不变。**误区三:东一榔头西一棒子**——**先把一条主线(如 JS 全栈)从页面做到上线**,再横向扩展:一个完整产品带来的体系感,胜过十个半途而废的教程。**全栈的真正优势**:能独立验证想法(个人项目/创业/接活)、能当"胶水人"(跨团队协作时谁都聊得来)、对系统有端到端的判断力——**它是"独立交付能力"的代名词**。

## 通关标准

能独立做到:从零做出一个带登录注册、增删改查、数据库持久化的完整 Web 应用并部署上线(他人可访问);说清一次请求从前端到数据库再返回的完整链路(每层能指出对应代码);会用 CI 自动测试与部署、看得懂监控日志定位线上问题;在四条主线中能说出自己主线的完整技术栈与选型理由——全栈主线通关。

全栈开发是一条宽广的路,不可能精通所有技术——**它的正确打开方式是"T 字型":一竖(主栈深度)扎到底,一横(跨层广度)铺得开**。别被"全栈"二字吓到:先跑通一个最小产品,再逐层加厚;保持好奇心,持续学习,你会越走越远。下一步:选一条语言主线(上表四选一)开始,或先刷 [前后端协作](/learning-paths/fullstack/collaboration) 这篇公共副本。
