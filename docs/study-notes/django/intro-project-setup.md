# 01 Django 入门与项目搭建

## 1.1 Django 是什么

Django 是 2005 年发布的 Python 开源 Web 框架,由劳伦斯日报的新闻团队开发,以"快速开发、DRY(Don't Repeat Yourself)"为设计哲学,是目前 Python 生态使用最广的"重量级"框架。

**"重量级"的含义 —— 它自带全家桶:**

| 内置组件 | 作用 |
| --- | --- |
| ORM(对象关系映射) | 用 Python 类操作数据库,不用手写 SQL |
| 模板系统 | 服务端渲染 HTML 页面 |
| 路由系统 | URL 到视图函数的映射 |
| Admin 后台 | 开箱即用的数据管理后台(自动生成) |
| 认证系统 | 用户、权限、组、会话、密码哈希 |
| 表单系统 | 表单生成、数据校验、CSRF 防护 |
| 缓存框架 | 页面/片段/数据库缓存 |
| 中间件 | 请求/响应钩子(安全、会话、CSRF 等都靠它) |
| 国际化、静态文件管理、信号、测试框架 | 配套齐全 |

**适用场景:** 内容型网站(博客/新闻)、后台管理系统、电商、企业级 Web 应用 —— 需要"完整方案、快速交付"的场景。

**与 Flask / FastAPI 的定位对比:**

| | Django | Flask | FastAPI |
| --- | --- | --- | --- |
| 定位 | 全家桶,约定优于配置 | 微内核,自由拼装 | 现代 API 框架,类型驱动 |
| ORM/表单/Admin | 内置 | 需第三方扩展 | 需第三方扩展 |
| 异步 | 3.x 起支持 async 视图,ORM 为同步 | 生态多为同步 | 原生一等公民 |
| 最佳场景 | 完整 Web 系统、后台、CMS | 小服务、原型 | 高并发 API、AI 应用 |

**版本现状:** 本笔记基于 **Django 4.2 LTS(长期支持)与 5.x** 的现行写法。原笔记基于 3.2,主要差异:3.2 起 `path()` 与异步视图稳定;4.0 起支持异步 ORM 查询(可选);5.0 起要求 Python 3.10+。老项目升级时以官方迁移指南为准。

官方资源:官网 https://www.djangoproject.com ;中文文档 https://docs.djangoproject.com/zh-hans/

## 1.2 MVC 与 MTV 设计模式

### MVC(Model-View-Controller)

- **Model(模型)**:数据层,封装数据库
- **View(视图)**:展示层,给用户看结果
- **Controller(控制器)**:接收请求、调模型、选视图、返回结果

### Django 的 MTV

Django 的命名与 MVC 略有错位(框架自己掌控 Controller 部分),叫 MTV:

| MTV | 对应 MVC | 职责 |
| --- | --- | --- |
| M:Model 模型 | Model | 与数据库交互(models.py + ORM) |
| T:Template 模板 | View | 呈现内容到浏览器(HTML) |
| V:View 视图 | Controller | 核心:接收请求、查数据、选模板、返回响应 |

一次请求的完整链路:

```
浏览器请求 → urls.py(路由匹配)→ views.py(视图逻辑)
              → models.py(ORM 查数据库)
              → templates/(模板渲染)
              → HttpResponse(返回浏览器)
```

## 1.3 安装与环境

### 版本要求

| Django 版本 | Python 要求 | 状态 |
| --- | --- | --- |
| 3.2 LTS | 3.6 ~ 3.10 | 旧 LTS |
| 4.2 LTS | 3.8 ~ 3.12 | 当前 LTS(推荐) |
| 5.x | 3.10+ | 最新特性版 |

### 虚拟环境 + 安装

```bash
# 1. 创建并激活虚拟环境(隔离项目依赖,必备习惯)
python3 -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate

# 2. 安装(二选一)
pip install django                  # 最新版
pip install "Django==4.2.*"         # 锁定 LTS 版本(生产推荐)

# 3. 验证
python -m django --version
# 4.2.x
```

国内镜像加速:`pip install django -i https://pypi.tuna.tsinghua.edu.cn/simple`

卸载:`pip uninstall django`

## 1.4 创建第一个项目

```bash
django-admin startproject mysite1
cd mysite1
python manage.py runserver          # 开发服务器,默认 127.0.0.1:8000
```

浏览器打开 http://127.0.0.1:8000 ,看到火箭欢迎页即成功。

`runserver` 参数:

```bash
python manage.py runserver 8080              # 指定端口
python manage.py runserver 0.0.0.0:8000      # 监听所有网卡(局域网可访问,需配 ALLOWED_HOSTS)
python manage.py runserver --noreload        # 关闭热重载
```

> `runserver` 是**开发专用**服务器(单线程、自动重载、静态文件自动服务),生产环境必须使用 Gunicorn/uWSGI(见 12 章),严禁用它承载生产流量。

## 1.5 项目目录结构

```shell
$ django-admin startproject mysite1
$ tree mysite1/
mysite1/
├── manage.py              # 项目管理入口(与 django-admin 类似,但自动带项目环境)
└── mysite1/               # 项目配置包(名称与项目同名)
    ├── __init__.py        # 包标记
    ├── settings.py        # 全局配置(数据库、中间件、模板……)
    ├── urls.py            # 主路由配置(ROOT_URLCONF 指向它)
    ├── asgi.py            # ASGI 入口(异步服务器、WebSocket 用)
    └── wsgi.py            # WSGI 入口(传统部署用)
```

### manage.py 常用子命令

| 命令 | 作用 |
| --- | --- |
| `runserver` | 启动开发服务器 |
| `startapp <name>` | 创建应用(见 2.2) |
| `makemigrations` | 生成数据库迁移文件 |
| `migrate` | 执行迁移(建表/改表) |
| `createsuperuser` | 创建后台管理员 |
| `shell` | 进入带项目环境的交互式 shell(调试 ORM 利器) |
| `shell_plus` | 同上(需 django-extensions,自动导入所有模型) |
| `collectstatic` | 收集静态文件到统一目录(部署用) |
| `test` | 运行测试 |
| `check` | 检查项目配置问题 |
| `startproject <name>` | (django-admin 用)创建项目 |
| `dbshell` | 进入数据库命令行 |
| `showmigrations` | 查看迁移状态 |

> `manage.py` 与 `django-admin` 的区别:`manage.py` 会先加载项目的 settings,所以含项目相关命令;`django-admin` 是全局命令。创建项目两者皆可,其他操作一律用 `manage.py`。

## 1.6 settings.py 配置详解

settings.py 是项目的"总开关",启动时自动加载。可通过 `from django.conf import settings` 在代码中读取。

### 核心配置项

```python
# ---- 路径 ----
BASE_DIR = Path(__file__).resolve().parent.parent   # 项目根目录绝对路径,所有相对路径以此为基准

# ---- 运行模式 ----
DEBUG = True            # 开发 True / 生产必须 False!
                        # True:报错显示详细堆栈页面;False:显示通用错误页
                        # 生产开 True = 泄露代码路径、SQL、环境变量,高危!

ALLOWED_HOSTS = []      # 允许访问的域名/IP 列表(校验 HTTP Host 头)
# []        → DEBUG=True 时放行 localhost/127.0.0.1
# ['*']     → 放行一切(生产不推荐)
# ['api.example.com', '192.168.1.3'] → 白名单

# ---- 应用 ----
INSTALLED_APPS = [      # 注册的应用列表,后续 startapp 后要在这里登记
    'django.contrib.admin',          # 后台管理
    'django.contrib.auth',           # 认证系统
    'django.contrib.contenttypes',   # 内容类型框架
    'django.contrib.sessions',       # 会话框架
    'django.contrib.messages',       # 消息框架(flash message)
    'django.contrib.staticfiles',    # 静态文件管理
    # 你自己的应用:
    # 'bookstore',
]

# ---- 中间件(按顺序执行,见 09 章)----
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ---- 模板(见 05 章)----
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],     # 全局模板目录(需要自己建)
        'APP_DIRS': True,                     # 同时搜索各应用下的 templates
        'OPTIONS': {'context_processors': [...]},
    },
]

# ---- 数据库(见 03 章)----
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ---- 国际化与本地化 ----
LANGUAGE_CODE = 'zh-Hans'     # 中文界面(admin、表单错误等)
TIME_ZONE = 'Asia/Shanghai'   # 服务器时区
USE_I18N = True               # 国际化
USE_TZ = True                 # 时区感知:库中存 UTC,显示时转换(强烈建议保持 True)

# ---- 静态文件与媒体文件 ----
STATIC_URL = 'static/'        # 静态文件访问前缀(05 章)
MEDIA_URL = 'media/'          # 用户上传文件访问前缀
MEDIA_ROOT = BASE_DIR / 'media'

# ---- 主路由 ----
ROOT_URLCONF = 'mysite1.urls'

# ---- WSGI/ASGI 入口 ----
WSGI_APPLICATION = 'mysite1.wsgi.application'
ASGI_APPLICATION = 'mysite1.asgi.application'
```

### 自定义全局变量

settings 里可以定义自己的变量,全局读取:

```python
# settings.py
SMS_API_KEY = "your-key"
```

```python
# 任意代码中
from django.conf import settings
key = settings.SMS_API_KEY
```

> **生产环境的安全配置**(12 章展开):`DEBUG=False`、`ALLOWED_HOSTS` 白名单、`SECRET_KEY` 放环境变量、数据库密码放环境变量、配置 HSTS/安全头。

## 1.7 多环境配置拆分(进阶)

单文件 settings 在"开发/测试/生产"切换时很痛苦,业界标准做法是拆包:

```
mysite1/
├── settings/
│   ├── __init__.py
│   ├── base.py        # 公共配置
│   ├── dev.py         # 开发(DEBUG=True、SQLite)
│   └── prod.py        # 生产(DEBUG=False、MySQL、环境变量)
```

```python
# settings/base.py
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
INSTALLED_APPS = [...]
# 公共部分放这里

# settings/dev.py
from .base import *
DEBUG = True
ALLOWED_HOSTS = ["*"]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

# settings/prod.py
import os
from .base import *
DEBUG = False
ALLOWED_HOSTS = ["api.example.com"]
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]          # 从环境变量读
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.environ["DB_NAME"],
        "USER": os.environ["DB_USER"],
        "PASSWORD": os.environ["DB_PASSWORD"],
        "HOST": os.environ["DB_HOST"],
        "PORT": "3306",
    }
}
```

运行时指定用哪套配置:

```bash
python manage.py runserver --settings=mysite1.settings.dev
gunicorn mysite1.wsgi --env DJANGO_SETTINGS_MODULE=mysite1.settings.prod
```

## 1.8 一个最小可运行的例子

创建项目后,在 `mysite1/urls.py` 加路由、`mysite1/views.py` 写视图:

```python
# mysite1/views.py
from django.http import HttpResponse

def home(request):
    return HttpResponse("<h1>你好,Django!</h1>")
```

```python
# mysite1/urls.py
from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home),        # 访问 / 显示你好
]
```

访问 http://127.0.0.1:8000 即可看到页面。路由与视图的完整体系在下一章展开。

## 1.9 开发工具与习惯

- **编辑器**:PyCharm 专业版(Django 支持最好)或 VS Code + Python/Django 插件
- **django-extensions**(强烈推荐):
  ```bash
  pip install django-extensions
  # INSTALLED_APPS 加 'django_extensions'
  python manage.py shell_plus    # 自动导入所有模型,调试 ORM 神器
  python manage.py show_urls     # 列出全部路由
  python manage.py runserver_plus
  ```
- **代码风格**:遵循 Django 官方风格(PEP8 + 模型/视图命名约定);`ruff`/`black` 保持格式
- **依赖管理**:`pip freeze > requirements.txt` 起步;团队项目用 `uv` 或 `poetry` 锁版本
- **调试技巧**:`print()` 起步 → `manage.py shell` 验证 ORM → `ipdb`/断点 → Django Debug Toolbar(生产禁用)

---

## 本章小结

- Django 是自带 ORM/模板/Admin/认证/表单的全家桶框架,适合完整 Web 系统
- MTV 分层:Model 管数据、Template 管展示、View 管调度
- `startproject` 建项目,`manage.py` 管理一切;`runserver` 仅限开发
- settings.py 是配置中枢:`DEBUG`/`ALLOWED_HOSTS`/`DATABASES`/`INSTALLED_APPS` 是前四个必须搞懂的
- 生产安全红线:DEBUG=False、密钥与密码进环境变量、多环境配置拆分
