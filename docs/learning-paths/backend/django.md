# Django 学习路线

Django 是 Python 界的"全家桶"——座右铭 **Batteries Included(内置电池)**:ORM、模板引擎、表单、认证、后台管理、安全防护,全都给你配好,开箱即用。它的哲学是"不要重复造轮子"与"约定优于配置"(项目结构固定)。Instagram、Pinterest、Mozilla、Disqus 都在用它,工业强度经得起验证。**适合场景**:数据驱动的 Web 应用(内容管理、电商后台、社交、SaaS)、需要自带 Admin 的运营系统、快速原型;**不适合**:极致高并发实时场景(可以异步/微服务补充,但它不是为那个设计的)。前端基础另见 [Python 学习路线](/learning-paths/languages/python),API 方向建议与 DRF 一起学。

这条线按 **项目与环境 → URL 与视图 → 模型与 ORM → 模板 → 表单 → 认证与 Admin → DRF(API)→ 中间件/信号/缓存 → 安全 → 异步 → 测试 → 部署与性能** 推进。

## 第一站:项目结构与环境

**创建**:`pip install django` → `django-admin startproject myproject .`(项目:全局配置)→ `python manage.py startapp blog`(**应用**:一个项目由多个 app 组成——Django 的模块化单位,app 之间解耦、可复用)。
**manage.py 命令全家**(日常全是它):`runserver`(开发服务器,自动重载)/`makemigrations` + `migrate`(模型→数据库)/`createsuperuser`/`shell`(交互式环境,ORM 调试神器)/`collectstatic`(部署收集静态文件)/`check`(配置体检)/`startapp`。
**settings.py 关键项**:`INSTALLED_APPS`(装了什么:内置 + 第三方 + 自己的 app,顺序影响模板/静态查找)、`DATABASES`(默认 SQLite,生产 PostgreSQL:`psycopg` + 配置)、`MIDDLEWARE`(见第八站)、`TEMPLATES`、`STATIC_URL`/`STATIC_ROOT`/`MEDIA_ROOT`、`LANGUAGE_CODE`/`TIME_ZONE`/`USE_TZ`、`AUTH_USER_MODEL`(见认证站)、`DEBUG`(生产必 False)、`ALLOWED_HOSTS`。
**十二要素建议**:配置走环境变量(django-environ 或 os.environ),密钥不进代码库。

## 第二站:URL 与视图

**URLconf**:项目级 `urls.py` 用 `path()` 配路由(`path('blog/<int:pk>/', views.detail)`);**路径转换器**:`<int:>`/`<str:>`/`<slug:>`/`<uuid:>`/`<path:>`(比正则好读;老代码 `re_path` 会读即可);`include()` 把 app 的 urls 挂进来(`path('api/', include('blog.urls'))`);**路由命名与反向解析**(Django 好习惯的核心):路由加 `name='detail'`,代码里 `reverse('detail', args=[pk])`、模板里 `&#123;% url 'detail' pk %&#125;`——**URL 改动只动 urls.py,别硬编码路径**;命名空间 `namespace`(多 app 同名路由)。
**视图两代**:FBV(函数视图):`def detail(request, pk):` → `render(request, 'x.html', ctx)`(快捷方式:模板+上下文)/`HttpResponse`/`JsonResponse`/`redirect`/`get_object_or_404`(查不到自动 404);**CBV(类视图,进阶主力)**:`View` 基类(方法名即 HTTP 方法)、**通用视图**:`ListView`(列表 + 自动分页,`model`/`queryset`/`template_name`/`context_object_name` 几个属性配置一切)、`DetailView`/`CreateView`(自动处理表单:fields 白名单 + 成功跳转 get_success_url)/`UpdateView`/`DeleteView`;**Mixins 组合**:`LoginRequiredMixin`/`PermissionRequiredMixin` + 通用视图 = 带权限的 CRUD 一行声明——**"通用视图 + Mixin"是 Django 高效的原因,值得吃透**;FBV 配装饰器(`@login_required`/`@require_GET`);视图里别堆业务:重逻辑下沉到 service 函数或模型方法。

## 第三站:模型与 ORM——Django 的心脏

**模型定义**:`class Post(models.Model):`——**字段类型全图**:CharField(短文本,必须 max_length)/TextField(长文)/IntegerField/FloatField/**DecimalField(金额必用,配 max_digits/decimal_places)**/BooleanField/DateField/DateTimeField(**auto_now_add(创建)/auto_now(更新)**)/FileField/ImageField(需 Pillow)/JSONField/UUIDField/EmailField/URLField;字段选项:null(数据库可空)vs **blank(表单可空)——区别是必考题**、default、**choices**(配枚举类,`get_字段名_display()` 拿中文)、unique、db_index、verbose_name(中文名);**Meta 类**:ordering/db_table/constraints/indexes(联合索引)/verbose_name;_str__(后台与调试显示);自定义 Manager(查询封装)。
**迁移机制**:改模型 → `makemigrations`(生成迁移文件)→ `migrate`(执行);**迁移是版本化的表结构变更**(团队协作/上线发布都靠它,禁止手改数据库);数据迁移(RunPython)与迁移合并是进阶。**ORM 查询 API**(写 Django 的日常):创建:`create`/`get_or_create`(查不到就建,返回 (obj, created))/`update_or_create`/`bulk_create`(批量插入,性能关键);读:`all`/`filter`(条件)/`exclude`(排除)/`get`(**查不到抛 DoesNotExist,多条抛 MultipleObjectsReturned**——用 `filter().first()` 或 get_object_or_404 更稳)/`order_by('-created')`/`values`/`values_list`(只要某几列);**QuerySet 惰性 + 缓存**(面试点:filter 只是攒条件,遍历/切片/len/list 才查库;同一个 QuerySet 二次遍历走缓存——何时用 `.iterator()` 省内存);**F 表达式**(`F('views') + 1` 数据库端原子自增,防并发覆盖)与 **Q 对象**(`Q(author=u) | Q(title__icontains='x')` 组合或查询);**聚合**:`aggregate`(整表:Count/Sum/Avg/Max/Min)与 `annotate`(分组每行:作者文章数);跨关系用**双下划线**:`filter(author__username='x')`、`order_by('category__name')`。
**关系字段**:ForeignKey(一对多,**on_delete 必填**:CASCADE(级联删)/PROTECT(有子记录禁删)/SET_NULL(置空,需 null=True)——面试三兄弟)/ManyToManyField(自动中间表;要带字段的关联(如"加入时间")用 through 自定义中间模型)/OneToOneField(用户资料扩展);**反向查询**:related_name 显式声明(默认 `模型名小写_set`);**预加载防 N+1**:`select_related`(外键,SQL JOIN 一次查完)与 `prefetch_related`(多对多/反向外键,两次查询)——列表页性能的第一课;原生 SQL(`.raw()`/`connection.cursor`)能不用就不用(ORM 参数化自带注入防护)。

## 第四站:模板系统

**语法三件套**:变量 `&#123;&#123; post.title &#125;&#125;`、标签 `&#123;% if %&#125;/&#123;% for %&#125;/&#123;% url %&#125;/&#123;% csrf_token %&#125;`、**过滤器 (&#123;&#123; value|date:"Y-m-d" &#125;&#125;)**(default/truncatechars/lower/join……可链式;自定义过滤器用 `@register.filter`)。
**继承是组织核心**:基模板 `&#123;% block content %&#125;&#123;% endblock %&#125;` + 子模板 `&#123;% extends "base.html" %&#125;` + `&#123;% block %&#125;` 覆盖——**别用 include 复制布局**;`&#123;% static 'css/app.css' %&#125;`(配 STATICFILES);模板里别写业务逻辑(复杂计算放视图/过滤器);**上下文处理器**(给所有模板注入公共数据:当前用户、站点配置——settings TEMPLATES 里配);**autoescape 默认开**(输出自动转义——XSS 第一道防线,`|safe` 与 `&#123;% autoescape off %&#125;` 三思后用,渲染富文本要专门 sanitize)。

## 第五站:表单

**Form 类**:声明字段(`forms.CharField(label=..., widget=forms.Textarea)`);视图里 `form = PostForm(request.POST)` → **`is_valid()`** → `form.cleaned_data`(清洗后的安全数据);**验证三层**:字段级 `clean_字段名`(单字段)/表单级 `clean()`(跨字段:两次密码一致)/字段 validators(复用校验器:EmailValidator/RegexValidator);`form.errors` 渲染错误;**ModelForm**:`class PostForm(forms.ModelForm): class Meta: model = Post; fields = ['title', 'content']`——**fields 白名单是防"批量赋值攻击"的关键(别用 `__all__` 对有权限字段的表单)**;ModelForm 的 `save()` 直接存库;渲染:`&#123;&#123; form.as_p &#125;&#125;` 快速版/手动逐字段定制版/crispy-forms(现代样式);**FormSet**(同页面多条记录:批量编辑子项);文件上传:表单 `FileField` + `request.FILES` + 存储(见缓存章)。
**表单 vs 前端校验**:后端校验永远要做(前端只是体验)。

## 第六站:认证与 Admin

**认证全家桶**(内置,别自己造):`User` 模型;**登录**:`authenticate(username, password)`(返回 User 或 None)+ `login(request, user)`(写 session);**登出** `logout`;**保护视图**:`@login_required` 装饰器 / CBV 的 `LoginRequiredMixin`(未登录跳 LOGIN_URL 或带 next 参数);**权限**:模型默认权限(add/change/delete/view_xxx),`@permission_required`、组 Group(角色);模板里 `&#123;&#123; user &#125;&#125;`/`&#123;% if user.is_authenticated %&#125;`;注册/密码修改重置(内置视图 + 邮件);**自定义 User 模型(新项目第一步就做!)**:`AUTH_USER_MODEL` 指向自定义 AbstractUser——项目上线后再换 User 模型极痛,一开工就换;轻量扩展用 OneToOne 的 Profile。
**Admin(白送的后台,招财猫)**:`admin.site.register(Post)` 即得增删改查后台;`ModelAdmin` 定制:`list_display`(列表列)/`list_filter`/`search_fields`/`readonly_fields`/`fieldsets`/`inlines`(内联子表)/`actions`(自定义批量操作:导出/下架);Admin 定位:**内部运营/管理工具**(给运营同事用),别直接暴露给 C 端用户(要定制 C 端就写普通视图/DRF)。

## 第七站:Django REST Framework(API)

现代 Django 项目大多"前后端分离",**DRF** 是 Django API 的标准答案:**Serializer/ModelSerializer**(模型 ↔ JSON:字段声明、嵌套序列化、`validate` 校验、自定义 create/update);**视图三档**:函数 `@api_view(['GET'])`、`APIView`(类,方法即动作)、**ViewSet + Router**(`ModelViewSet` 自动生成 list/create/retrieve/update/destroy 全套,`router.register` 一行注册路由——**CRUD API 的极速通道**,配 `permission_classes`/`queryset`/`serializer_class` 属性即用);**认证与权限**:`IsAuthenticated`/`IsAdminUser`/`IsAuthenticatedOrReadOnly`、自定义 `BasePermission`(对象级权限 has_object_permission)、Token 认证与 **JWT**(djangorestframework-simplejwt:登录换 token、刷新);**过滤/搜索/排序**:django-filter + `filter_backends`/`SearchFilter`/`OrderingFilter`;**分页**:PageNumberPagination/LimitOffset(列表接口标配);**限流 throttle**(防爬/防爆破:AnonRateThrottle/UserRateThrottle);**文档**:drf-spectacular(OpenAPI 自动文档 + Swagger UI);**DRF 最佳实践**:视图薄(逻辑进 serializer 或 service)、错误格式统一、版本化(/api/v1/)、权限默认收紧、输入用 serializer 校验——纯 API 项目甚至可以只学 Django 模型层 + DRF。

## 第八站:中间件、信号、缓存与会话

**中间件**(请求的"关卡链"):`MIDDLEWARE` 列表顺序——请求从上往下、响应从下往上;内置主力:`SecurityMiddleware`(安全响应头/HSTS/HTTPS 跳转)、`SessionMiddleware`、`AuthenticationMiddleware`(request.user 的来源)、`CsrfViewMiddleware`(**全站 CSRF 防护:表单必须带 &#123;% csrf_token %&#125;,AJAX 要 X-CSRFToken 头**)、`CommonMiddleware`;自定义中间件:类实现 `__call__` 或在旧版 process_request/process_response——做登录校验、统一响应头、维护窗口期。
**信号 Signals**:`post_save`/`pre_delete` 等内置信号 + `@receiver(post_save, sender=Post)` 监听——用途:缓存失效、审计日志、创建关联(用户注册自动建 Profile);**注意**:信号同步执行且隐式,**别把核心业务塞信号里**(出问题难排查),复杂联动显式调用更清晰。
**缓存**:`CACHES` 配置(内存 LocMem/Redis:`django-redis`);三档:`cache_page(60)` 装饰器(整页缓存,配 Vary 头)、模板片段 `&#123;% cache 600 sidebar %&#125;`、低级 API `cache.get/set/delete`(最灵活:热数据/计数);**失效策略**:主动 delete(信号里)+ 超时双保险;**会话 Session**:默认存数据库(可配 Redis/文件),`request.session['key']` 读写、`session.set_expiry`;登录状态/购物车/一次性消息(messages 框架也是 session 上的)。
**文件与媒体**:`MEDIA_ROOT`/`MEDIA_URL`、FileField 上传自动存、校验类型与大小、生产用云存储(S3/OSS 的自定义 Storage backend);`FileSystemStorage` 本地开发;大文件用流。

## 第九站:安全与异步

**Django 的默认安全**(比其他框架省心一大截,原理要懂,见 [Web 安全路线](/learning-paths/security/web-security)):**CSRF**(内置中间件 + 模板 token)、**XSS**(模板自动转义)、**SQL 注入**(ORM 参数化——原生 SQL 才危险)、**点击劫持**(X-Frame-Options DENY)、**安全响应头**(SecurityMiddleware:Content-Security-Policy/HSTS)、密码(内置 PBKDF2/bcrypt/argon2,别自己存明文);生产清单:`DEBUG=False`、`ALLOWED_HOSTS`、`SECURE_SSL_REDIRECT`/`SECURE_HSTS_SECONDS`/`SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE`(HTTPS 下全开)、`SECRET_KEY` 走环境变量。
**异步支持**:Django 3.0+ 可 `async def` 视图(ASGI);生产跑 ASGI 用 **uvicorn/daphne**;**ORM 是同步的**(异步视图里包 `sync_to_async` 或直接用数据库的异步驱动,复杂);**实时/WebSocket**:**Django Channels**(ASGI 之上:Consumer、路由、Channel Layer(Redis 群组广播)——聊天/通知/实时面板;Channels 把 Django 从"请求-响应"扩展到"长连接"世界)。

## 第十站:测试

Django 的测试设施是"买一送一"级别的:继承 `django.test.TestCase` → **每个测试在事务里跑,结束自动回滚**(测完数据库干干净净);**测试客户端**:`self.client.get('/blog/1/')`/`post('/login/', data)`——模拟请求测视图/表单/重定向/模板内容(`assertContains`);登录测试:`client.login` 或 `force_login`;ORM 测试直接建对象;**工厂**:factory_boy(批量造数据,比 setUp 手搓干净);Mock(unittest.mock:patch 外部调用);覆盖率 coverage.py;DRF 用 `APITestCase`(带 token 的请求);**测试对象分层**:模型方法与 ORM 查询、表单校验、视图行为(状态码+重定向+上下文)、权限(未登录 302/登录 200)——**"登录/权限/边界"三类测试是 Django 测试的骨架**;CI 里跑 `python manage.py test`。

## 第十一站:部署与性能

**生产部署**:Gunicorn(WSGI 多进程:workers = 2×核+1)或 uvicorn(异步)——Django 是同步为主,`gunicorn myproject.wsgi` 经典;**Nginx 在前**:静态文件(collectstatic 收集到 STATIC_ROOT)+ 媒体文件 + 反代(见 [Nginx 路线](/learning-paths/middleware/nginx));Docker 化(多阶段、非 root、健康检查,见 [Docker 路线](/learning-paths/devops/docker));环境变量配置;日志 LOGGING 配置(文件/JSON/按天轮转);迁移发布策略(先 migrate 后起新代码/反向兼容)。
**性能优化清单**(按性价比):①`select_related`/`prefetch_related` 灭 N+1;②`bulk_create`/`bulk_update`(批量写);③`db_index` 与外键自动索引——慢查询日志(PostgreSQL 的 pg_stat_statements);④Redis 缓存热点(用户信息/配置/列表页 cache_page);⑤`only`/`defer`(少取列,微优化);⑥模板与静态文件压缩(gzip/WhiteNoise 或 Nginx);⑦数据库连接池(pgbouncer);⑧排查工具:django-debug-toolbar(开发期 SQL 与耗时面板——**看 Queries 一栏,秒懂 N+1**)/silk(生产剖析)。
**下一步**:任务队列 **Celery**(异步任务 + 定时 beat,重活/邮件/报表的答案)、Channels(实时)、DRF 深度、wagtail/django-cms(内容站)、django-graphene(GraphQL)、多租户/微服务化(按需)。

## 通关标准

能独立做到:建项目 + 两个 app + 完整 CRUD(模型/迁移/视图/模板/表单) + 登录权限 + Admin 注册;能写带 filter/Q/F/annotate 与 select_related 的查询并解释 QuerySet 惰性;说清 null vs blank、on_delete 三兄弟、FBV vs CBV 的取舍;用 DRF 的 ModelViewSet + JWT 出一个带权限/分页/过滤的 API;给项目配好 Redis 缓存与测试并用 django-debug-toolbar 干掉一次 N+1——Django 主线通关。

Django 教会你的最重要一课是"**框架替你决策**":目录结构、安全默认、Admin、迁移——它把 Web 开发的"标准答案"焊死在框架里,让你专注业务。它不酷,但它稳;它不追求极致性能,但能让一个团队在两周内上线靠谱的产品。学 Django,学的不是"怎么搭",而是"什么是 Web 开发的成熟形态"——带着这套心智,你以后看任何框架都会快很多。
