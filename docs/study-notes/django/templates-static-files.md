# 05 模板与静态文件

模板(Templates)负责"呈现内容到浏览器"—— MTV 中的 T。本章覆盖模板配置、DTL 语法、模板继承与静态文件管理。

## 5.1 模板是什么

模板 = 可以根据数据动态变化的 HTML 页面。视图把数据打包成字典传给模板,模板渲染后返回给浏览器。

```python
# views.py
def index(request):
    context = {"name": "小明", "items": ["Django", "FastAPI"]}
    return render(request, 'index.html', context)
```

```html
<!-- templates/index.html -->
<h1>你好, {{ name }}</h1>
<ul>
{% for item in items %}
    <li>{{ item }}</li>
{% endfor %}
</ul>
```

> 前后端分离项目(SPA)里模板退居二线,API 由 DRF(11 章)提供;但服务端渲染场景(官网、SEO 敏感页、后台)模板仍是主力。

## 5.2 模板配置与查找顺序

```python
# settings.py
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',  # 模板引擎
        'DIRS': [BASE_DIR / 'templates'],     # 全局模板目录(需手动创建)
        'APP_DIRS': True,                     # 同时搜索每个应用下的 templates/
        'OPTIONS': {
            'context_processors': [           # 每个请求自动注入模板的变量
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',   # 注入 user
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]
```

**模板查找顺序(同名文件谁生效):**

1. 先找 `DIRS` 指定的全局目录
2. 再按 `INSTALLED_APPS` 顺序找各应用的 `templates/` 目录

```text
mysite1/
├── templates/            # 全局模板(优先命中)
│   └── index.html
└── bookstore/
    └── templates/        # 应用模板
        └── bookstore/
            └── index.html
```

> **应用模板的命名空间惯例:** 应用内模板放 `templates/应用名/xxx.html`(如 `templates/bookstore/index.html`),避免多应用同名模板互相覆盖 —— 视图里写 `render(request, 'bookstore/index.html')`。

### 传参技巧

```python
def page(request):
    dic = {"变量1": "值1", "变量2": "值2"}
    return render(request, 'page.html', dic)

    # 局部变量多时,locals() 自动打包(注意:会传多余变量,团队规范里谨慎使用)
    # title = "首页"; items = [...]
    # return render(request, 'page.html', locals())
```

## 5.3 模板变量

```html
{{ 变量名 }}            <!-- 基本变量 -->
{{ 变量名.index }}      <!-- 列表索引:items.0 -->
{{ 变量名.key }}        <!-- 字典取值:d.name -->
{{ 对象.属性 }}          <!-- 对象属性 -->
{{ 对象.方法 }}          <!-- 无参方法(自动调用,不能带括号) -->
{{ user.username }}     <!-- 由 auth context processor 自动注入 -->
{{ request.path }}      <!-- 由 request context processor 自动注入 -->
```

**变量解析规则:** `{{ book.title }}` 按顺序尝试:① 字典键 `book['title']` ② 属性/方法 `book.title` ③ 列表索引。查找失败返回空字符串(不报错),这是模板"宽容"哲学 —— 也意味着字段拼写错误不会被发现,注意。

## 5.4 模板标签

标签 = 服务器端功能嵌入模板,格式 `{% 标签 %}...{% 结束标签 %}`。

### if 分支

```html
{% if age >= 18 and has_id %}
    <p>成年人</p>
{% elif age >= 6 %}
    <p>未成年人</p>
{% else %}
    <p>儿童</p>
{% endif %}
```

支持的运算符:`==`、`!=`、`<`、`>`、`<=`、`>=`、`in`、`not in`、`is`、`is not`、`and`、`or`、`not`。
> DTL 的 if **不支持括号**;复杂条件在视图里算好传布尔值进来,别在模板里堆逻辑。

### for 循环

```html
<ul>
{% for book in books %}
    <li>{{ forloop.counter }}. {{ book.title }}</li>  <!-- 序号从 1 开始 -->
{% empty %}
    <li>暂无图书</li>                                  <!-- 可迭代对象为空时 -->
{% endfor %}
</ul>
```

`forloop` 常用变量:

| 变量 | 含义 |
| --- | --- |
| `forloop.counter` | 当前序号,从 1 开始 |
| `forloop.counter0` | 从 0 开始 |
| `forloop.revcounter` | 倒序序号 |
| `forloop.first` / `forloop.last` | 是否首/末项 |

### url:反向解析(与 02 章联动)

```html
<a href="{% url 'bookstore:book_detail' book.id %}">详情</a>
<a href="{% url 'bookstore:list' %}">列表</a>
```

### 其他常用标签

```html
{% csrf_token %}            <!-- 表单里防 CSRF,渲染隐藏 input -->

{% load static %}           <!-- 加载 static 标签库 -->
<img src="{% static 'images/logo.png' %}">

{% include 'partials/header.html' %}              <!-- 复用片段 -->
{% include 'card.html' with item=book %}          <!-- 带参数 -->

{% now "Y-m-d H:i" %}       <!-- 当前时间 -->

{% lorem 3 p %}             <!-- 占位文本(开发用) -->

{% comment %}
多行注释,不会输出到页面
{% endcomment %}
```

## 5.5 过滤器

过滤器对变量做加工:`{{ 变量|过滤器:参数 }}`,可链式。

```html
{{ name|lower }}                <!-- 转小写 -->
{{ name|upper }}                <!-- 转大写 -->
{{ text|truncatechars:10 }}     <!-- 截断加省略号(按字符) -->
{{ text|truncatewords:20 }}     <!-- 按单词截断 -->
{{ price|floatformat:2 }}       <!-- 保留两位小数 -->
{{ count|default:"暂无" }}      <!-- 为 False/None/空串时显示默认值 -->
{{ content|linebreaks }}        <!-- 换行转 <p>/<br> -->
{{ dt|date:"Y-m-d H:i" }}       <!-- 格式化时间 -->
{{ num|add:1 }}                 <!-- 加法(拼接/数值加) -->
{{ items|length }}              <!-- 长度 -->
{{ html|safe }}                 <!-- 标记为安全,不转义(慎用!) -->
{{ value|join:", " }}           <!-- 列表拼接 -->
{{ qs|first }} / {{ qs|last }}  <!-- 首/末元素 -->
{{ text|striptags }}            <!-- 去 HTML 标签 -->
```

### 自动转义与 XSS(安全重点)

Django 模板**默认自动转义** HTML:`{{ user_content }}` 里的 `<script>` 会渲染成无害文本 —— 这是防 XSS 的默认防线。

```html
<!-- 用户输入 <script>alert(1)</script> 时 -->
{{ user_content }}        <!-- 输出 &lt;script&gt;... 浏览器不执行,安全 -->
{{ user_content|safe }}   <!-- ❌ 原样输出,执行脚本!仅限可信内容 -->
```

> `|safe` 和 `{% autoescape off %}` 只用于**自己生成的可信 HTML**(富文本经过清洗后);用户输入直接 `|safe` = 挖 XSS 漏洞。富文本场景用 `bleach`/`nh3` 库白名单过滤后再放行。

## 5.6 模板继承(复用布局的核心机制)

**base.html(父模板):**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>{% block title %}默认标题{% endblock %}</title>
</head>
<body>
    <header>{% include 'partials/nav.html' %}</header>

    <main>
        {% block content %}{% endblock %}   <!-- 子模板填充区 -->
    </main>

    <footer>© 2025 mysite</footer>
</body>
</html>
```

**book_list.html(子模板):**

```html
{% extends 'base.html' %}          <!-- 必须第一行 -->

{% block title %}图书列表{% endblock %}

{% block content %}
    <h1>全部图书</h1>
    {% for book in books %}
        <p>{{ book.title }} - {{ book.price|floatformat:2 }}元</p>
    {% endfor %}
{% endblock %}
```

**继承规则:**

- `{% extends %}` 必须是模板第一行
- 子模板只写要覆盖的 block;不写则用父模板默认内容
- 三层模板:base → 分块模板(如书籍相关页面共用 layout)→ 具体页
- 父模板 block 内容想保留时:`{{ block.super }}` 把父内容嵌入

## 5.7 自定义过滤器与标签

内置不够用时自己写:

```text
bookstore/
├── templatetags/               # 包目录(必须叫这个名字)
│   ├── __init__.py
│   └── mytags.py
```

```python
# bookstore/templatetags/mytags.py
from django import template

register = template.Library()

@register.filter
def multiply(value, arg):
    """{{ price|multiply:0.8 }} → 打八折"""
    try:
        return round(float(value) * float(arg), 2)
    except (ValueError, TypeError):
        return ''

@register.simple_tag
def discount_price(price, ratio):
    """{% discount_price book.price 0.8 %}"""
    return round(float(price) * float(ratio), 2)
```

```html
{% load mytags %}                     <!-- 使用前先加载 -->
<p>折后价:{{ book.price|multiply:0.8 }}</p>
<p>折后价:{% discount_price book.price 0.8 %}</p>
```

> 过滤器 = 管道加工单值;simple_tag = 任意参数、可返回任意内容。**模板里放展示逻辑,复杂计算放模型方法/视图**,别把模板写成程序。

## 5.8 静态文件

静态文件 = 不与服务器动态交互的资源:图片、CSS、JS、字体、音频。

### 配置

```python
# settings.py
STATIC_URL = 'static/'              # 访问前缀:/static/xxx
# 开发模式:各处的静态文件目录(全局 + 应用)
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]
# 生产模式:collectstatic 收集到统一目录
STATIC_ROOT = BASE_DIR / 'staticfiles'
```

```text
mysite1/
├── static/              # 全局静态目录
│   ├── css/style.css
│   └── images/logo.png
└── bookstore/
    └── static/
        └── bookstore/   # 应用静态文件(同样按应用名隔开)
```

### 模板中引用

```html
{% load static %}
<link rel="stylesheet" href="{% static 'css/style.css' %}">
<img src="{% static 'images/logo.png' %}">
```

开发模式下 `runserver` 自动服务静态文件;生产模式(Debug=False)不服务,需执行:

```bash
python manage.py collectstatic      # 收集全部静态文件到 STATIC_ROOT
# 之后由 Nginx 直接服务 STATIC_ROOT 目录(12 章)
```

## 5.9 媒体文件(用户上传)

```python
# settings.py
MEDIA_URL = 'media/'                        # 访问前缀
MEDIA_ROOT = BASE_DIR / 'media'             # 存储目录

# urls.py(开发模式:让 runserver 服务上传文件)
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [...]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

```html
<img src="{{ user.profile.avatar.url }}">   <!-- ImageField 的 .url -->
```

> 生产环境媒体文件同样交给 Nginx/CDN/对象存储,Python 进程不碰静态/媒体服务(12 章)。

## 5.10 模板最佳实践

1. **布局用 base.html + block**,杜绝复制粘贴整页 HTML
2. **片段用 include**,公共组件(导航、卡片)独立成文件
3. **URL 一律 `{% url %}`**,不硬编码
4. **模板只做展示**,查询、判断、聚合放视图/模型
5. **用户输入默认转义**,`|safe` 仅限清洗后的可信 HTML
6. **静态文件带应用命名空间**,多应用项目不打架
7. 业务逻辑可复用 → 模型方法(`book.discount_price()`),只在本模板用一次 → 自定义过滤器
8. 模板继承层级 ≤ 3 层,过深难维护
