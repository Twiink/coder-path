# Django 学习路线

Python 界的全能选手，从数据库迁移到后台管理，从身份认证到模板渲染，Django 给你准备了全家桶。它的座右铭是"内置电池"（Batteries Included），意思是开箱即用，不用东拼西凑找轮子。

## 为什么选择 Django

Flask 是个灵活的微框架，你得自己搭积木。Django 反其道而行之：我把房子盖好了，你直接搬家具就行。它有自己的 ORM、模板引擎、表单验证、用户系统、后台管理界面，还有一套成熟的安全机制。

适合快速开发，特别是内容管理系统、电商平台、社交网络这类数据驱动的应用。Instagram、Pinterest、Mozilla 都在用 Django，可见其工业强度。

## 学习路线图

### 基础篇：MTV 架构

- **项目初始化**
  - 创建 Django 项目和应用
  - 项目结构解析
  - 开发服务器和调试
  - 虚拟环境管理
  - 📖 笔记：[Django 入门与项目搭建](/study-notes/django/intro-project-setup)
  - 📖 笔记：[员工信息管理项目实战](/study-notes/django/employee-management-demo)

- **URL 路由**
  - URLconf 配置
  - 路由匹配规则
  - 路径转换器（int、slug、uuid、path）
  - 正则表达式路由
  - URL 命名和反向解析
  - 路由分组和命名空间

- **视图（Views）**
  - 函数视图（FBV）
  - 类视图（CBV）
  - 通用视图（ListView、DetailView、CreateView）
  - 请求和响应对象
  - HTTP 方法处理
  - 重定向和错误处理
  - 📖 笔记：[URL 路由与视图](/study-notes/django/urls-and-views)

- **模型与 ORM**
  - 模型定义和字段类型
  - 字段选项（null、blank、default、choices）
  - 主键和自增字段
  - 模型元数据（Meta 类）
  - 字符串表示（__str__）
  - 📖 笔记：[模型层与 ORM](/study-notes/django/models-and-orm)

- **数据库操作**
  - 数据库迁移（makemigrations、migrate）
  - QuerySet API
  - CRUD 操作（create、filter、update、delete）
  - 链式查询和惰性求值
  - Q 对象和 F 对象
  - 聚合和分组查询
  - 原生 SQL 查询

- **模型关系**
  - 一对多（ForeignKey）
  - 多对多（ManyToManyField）
  - 一对一（OneToOneField）
  - 关系查询和反向查询
  - related_name 使用
  - 预加载（select_related、prefetch_related）
  - 📖 笔记：[关系映射与关联查询](/study-notes/django/relationships-queries)

### 进阶篇：模板与表单

- **模板系统**
  - 模板语法（变量、标签、过滤器）
  - 模板继承（extends、block）
  - 模板包含（include）
  - 静态文件处理
  - 上下文处理器
  - 自定义模板标签和过滤器
  - 📖 笔记：[模板与静态文件](/study-notes/django/templates-static-files)

- **表单处理**
  - Form 类定义
  - ModelForm 自动生成
  - 字段验证
  - 清洗方法（clean_*）
  - 表单渲染（as_p、as_table、as_ul）
  - 表单集（Formset）
  - 文件上传表单
  - 📖 笔记：[表单与用户认证](/study-notes/django/forms-user-auth)

- **用户认证**
  - User 模型
  - 登录和登出
  - 注册功能实现
  - 密码管理（修改、重置）
  - 权限和组
  - 自定义用户模型
  - 登录装饰器（@login_required）

- **后台管理**
  - Admin 注册模型
  - ModelAdmin 配置
  - 列表显示定制
  - 搜索和过滤
  - 内联编辑
  - 自定义 Action
  - 权限控制
  - 📖 笔记：[Admin 后台管理](/study-notes/django/admin-site)

### 实战篇：API 与高级特性

- **Django REST Framework**
  - Serializer 序列化器
  - API 视图（APIView、ViewSet）
  - 路由器（Router）
  - 认证和权限
  - 分页和过滤
  - 节流和限流
  - 📖 笔记：[Django REST Framework](/study-notes/django/django-rest-framework)

- **中间件**
  - 中间件执行流程
  - 内置中间件
  - 自定义中间件
  - 请求/响应处理
  - 异常处理
  - 📖 笔记：[中间件、信号与邮件](/study-notes/django/middleware-signals-email)

- **信号（Signals）**
  - 信号机制
  - 内置信号（pre_save、post_save、pre_delete、post_delete）
  - 接收器函数
  - 自定义信号

- **缓存**
  - 缓存配置（内存、Redis、Memcached）
  - 视图缓存
  - 模板片段缓存
  - 低级缓存 API
  - 缓存键策略

- **会话管理**
  - Session 配置
  - 会话数据读写
  - 会话存储后端
  - Cookie vs Session
  - 📖 笔记：[Cookie、Session 与缓存](/study-notes/django/cookies-sessions-cache)

- **文件与媒体**
  - 文件上传处理
  - MEDIA_ROOT 配置
  - ImageField 和 FileField
  - 文件存储后台
  - 云存储集成

- **国际化与本地化**
  - 多语言支持
  - 翻译标记
  - 语言切换
  - 时区处理

- **安全特性**
  - CSRF 防护
  - XSS 防护
  - SQL 注入防护
  - 点击劫持防护
  - HTTPS 配置

- **性能优化**
  - 数据库索引
  - 查询优化
  - 静态文件压缩
  - select_related 和 prefetch_related
  - 数据库连接池

- **异步支持**
  - ASGI 服务器
  - 异步视图
  - 异步 ORM 操作
  - Channels WebSocket
  - 📖 笔记：[Celery 异步与定时任务](/study-notes/django/celery-tasks-scheduling)

- **测试**
  - 单元测试
  - 测试客户端
  - 数据库测试
  - 测试覆盖率
  - Mock 和 Fixture
  - 📖 笔记：[测试与部署](/study-notes/django/testing-deployment)

- **部署**
  - 生产环境配置
  - 静态文件收集
  - Gunicorn + Nginx
  - Docker 容器化
  - 数据库迁移策略

## 下一步学习

- **Django Channels**：WebSocket 和实时功能
- **Celery**：异步任务队列
- **Django CMS**：内容管理系统
- **GraphQL**：django-graphene
- **微服务**：Django 作为微服务

---

Django 的哲学是"不要重复造轮子"，它已经帮你准备好了大部分工具。学会用 Django 的方式思考问题，你会发现开发效率能提升一大截。
