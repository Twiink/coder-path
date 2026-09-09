# 02 路由与视图

本章讲清 Django 的请求入口:URL 如何分发到视图函数,视图如何拿到请求数据并返回响应。

## 2.1 URL 基础

URL(Uniform Resource Locator,统一资源定位符)的语法:

```text
protocol://hostname[:port]/path[?query][#fragment]

http://example.com:8000/video/show?menuId=657&version=2#subject
└─协议─┘ └──域名/主机──┘└端口┘ └──路径──┘ └───查询串───┘ └片段┘
```

| 部分 | 说明 |
| --- | --- |
| protocol | `http` / `https` / `file` 等 |
| hostname | 域名或 IP |
| port | 可选,http 默认 80,https 默认 443 |
| path | 路由地址,**决定服务器如何处理请求** |
| query | 可选,`key=value` 多组用 `&` 连接,给动态页面传参 |
| fragment | 锚点,仅浏览器定位用,**不发送到服务器** |

## 2.2 Django 处理请求的完整流程

```text
浏览器请求 http://127.0.0.1:8000/page/1016/

1. settings.py 的 ROOT_URLCONF 找到主路由文件(默认 mysite1/urls.py)
2. 加载其中的 urlpatterns 列表
3. 从上到下依次匹配每个 URL 规则,匹配到第一个即停止
4. 匹配成功 → 调用对应视图函数,返回响应
5. 全部不匹配 → 404 响应
```

主路由样例:

```python
# mysite1/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('page/1001/', views.page_1001),
    path('page/1002/', views.page_1002),
]
```

> 匹配规则细节:① 按 urlpatterns 顺序,先匹配先赢;② 路径**末尾斜杠**严格区分(`/page/1` 与 `/page/1/` 是两个路由,后者访问前者默认 404;开启 `APPEND_SLASH`(默认)时 Django 会 301 自动补斜杠重试);③ 路由匹配与请求方法无关,GET/POST 同一入口,靠视图内判断。

## 2.3 path() 函数与路径转换器

```python
from django.urls import path

path(route, view, name=None)
# route:匹配的路径模式,可带 <转换器:参数名>
# view :视图函数(或 include() 分发)
# name :路由别名,反向解析用
```

### 内置路径转换器

| 转换器 | 匹配内容 | 示例 |
| --- | --- | --- |
| `str`(默认) | 除 `/` 外的非空字符串 | `users/<str:username>` |
| `int` | 0 或正整数,视图收到 int | `page/<int:page>` 匹配 /page/100 |
| `slug` | ASCII 字母/数字/连字符/下划线 | `detail/<slug:sl>` 匹配 /detail/this-is-django |
| `uuid` | UUID 格式 | `order/<uuid:oid>` |
| `path` | 非空任意字符(含 `/`) | `v1/<path:ph>` 匹配 /v1/a/b/c |

```python
# urls.py
urlpatterns = [
    path('page/<int:page>/', views.page_view),      # 视图参数 page: int
    path('users/<str:username>/', views.user_view),
    path('detail/<slug:slug>/', views.detail_view),
]

# views.py
def page_view(request, page):
    return HttpResponse(f"这是第 {page} 页")     # /page/5/ → 这是第 5 页
```

### re_path():正则匹配(旧风格兼容)

```python
from django.urls import re_path

urlpatterns = [
    # 命名分组 (?P<name>...),视图收到同名参数
    re_path(r'^articles/(?P<year>[0-9]{4})/$', views.year_archive),
]
```

> 能用 `path()` 尽量不用 `re_path()`:可读性更好、类型自动转换。只有复杂模式(path 转换器表达不了)才用正则。

## 2.4 include():分布式路由

项目变大后,所有路由堆在主 urls.py 不可维护。标准做法:**主路由只做分发,每个应用维护自己的路由**。

```python
# mysite1/urls.py —— 主路由分发
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('bookstore/', include('bookstore.urls')),   # 分发到 bookstore 应用
    path('sport/', include('sport.urls')),
]

# bookstore/urls.py —— 应用路由(需要自己创建)
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index),               # 实际路径 /bookstore/
    path('list/', views.list_books),     # 实际路径 /bookstore/list/
    path('<int:book_id>/', views.detail), # 实际路径 /bookstore/5/
]
```

> `include('bookstore.urls')` 相当于把应用路由"插"到 `/bookstore/` 前缀之后。被 include 的模块里必须有 `urlpatterns` 列表。

## 2.5 路由命名与反向解析

**问题:** 模板和代码里硬编码 URL(`/bookstore/5/`)时,一旦路由修改,所有引用都要改。

**解法:** 给路由起名字,用名字反查 URL。

```python
# urls.py
urlpatterns = [
    path('book/<int:book_id>/', views.book_detail, name='book_detail'),
    path('book/list/', views.book_list, name='book_list'),
]
```

```python
# 视图里反向解析
from django.urls import reverse

url = reverse('book_detail', args=[5])          # /book/5/
url = reverse('book_detail', kwargs={'book_id': 5})
url = reverse('book_list')                       # /book/list/
```

```html
<!-- 模板里反向解析 -->
<a href="{% url 'book_detail' 5 %}">第5本书</a>
<a href="{% url 'book_list' %}">书单</a>
```

**应用命名空间(多应用间防重名):**

```python
# bookstore/urls.py
app_name = 'bookstore'        # 声明命名空间
urlpatterns = [path('list/', views.list_books, name='list')]

# 使用时:
reverse('bookstore:list')     # 模板: {% url 'bookstore:list' %}
```

## 2.6 视图函数(FBV)

视图函数接收 HttpRequest,返回 HttpResponse:

```python
def xxx_view(request[, 其它参数...]):
    return HttpResponse对象
```

```python
# views.py 完整示例
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.http import JsonResponse

def index(request):
    return HttpResponse("<h1>首页</h1>")

def api_data(request):
    return JsonResponse({"code": 200, "data": [1, 2, 3]})   # 自动序列化 JSON

def go_home(request):
    return redirect('/')                    # 302 重定向(也可 redirect('book_list') 反解)
```

### render():加载模板的快捷方式

```python
from django.shortcuts import render

def page_view(request):
    context = {"name": "小明", "items": ["a", "b"]}
    return render(request, 'page.html', context)
# 等价于:加载模板 + 渲染 + HttpResponse 三步合一(05 章详解)
```

## 2.7 HttpRequest 对象:请求的方方面面

视图第一个参数 `request` 是 HttpRequest 实例,服务器根据请求报文创建。

### 常用属性

```python
def inspect(request):
    request.method            # 'GET' / 'POST' / 'PUT' ...
    request.path              # 路径,不含查询串:'/page/1/'
    request.get_full_path()   # 含查询串:'/page/1/?a=1'
    request.build_absolute_uri()  # 完整 URL
    request.scheme            # 'http' / 'https'
    request.META['REMOTE_ADDR']  # 客户端 IP(注意:反代后是 Nginx IP,见 12 章)
    request.META['HTTP_USER_AGENT']  # 任意请求头:META 里是 HTTP_ 前缀 + 大写 + 下划线
    request.headers['user-agent']    # Django 2.2+ 更直观的请求头访问方式
    request.body              # 原始请求体字节串(JSON 接口常用)
    request.COOKIES           # 所有 cookie 的字典
    request.session           # 会话对象(07 章)
    request.user              # 当前登录用户(06 章,启用 auth 中间件后可用)
    request.FILES             # 上传的文件(05/06 章)
```

### 核心:GET 与 POST 数据(QueryDict)

```python
request.GET    # 查询字符串参数(QueryDict 对象)
request.POST   # POST 表单数据(QueryDict 对象)
```

**QueryDict 的特性与正确用法:**

```python
# URL: /search/?q=python&page=2&tag=a&tag=b
q = request.GET['q']            # ❌ 不存在时抛 KeyError
q = request.GET.get('q')        # ✅ 没有返回 None
q = request.GET.get('q', '默认值')  # ✅ 带默认值
page = request.GET.get('page', '1')  # 值永远是字符串,需要 int(page)

# 同名多值:get 拿最后一个,getlist 拿全部
tags = request.GET.getlist('tag')    # ['a', 'b']

# QueryDict 是不可变的;要修改先 copy
params = request.GET.copy()
```

### 处理 GET 请求

GET 用于**获取数据**,参数走查询串,场景:地址栏访问、`<a href>` 链接、`method="get"` 表单。**敏感数据严禁放查询串**(会被记入访问日志、浏览器历史)。

```python
def search_view(request):
    if request.method == 'GET':
        keyword = request.GET.get('keyword', '')
        # 业务:按 keyword 查询
        return HttpResponse(f"你搜索了: {keyword}")
```

### 处理 POST 请求

POST 用于**提交数据**(表单、文件),数据在请求体中。表单控件的 `name` 属性决定提交的键名:

```html
<form method="post" action="/login/">
    {% csrf_token %}                  <!-- 必须!否则 403 -->
    姓名:<input type="text" name="username">
    <input type="submit" value="登录">
</form>
```

```python
def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username', '')
        return HttpResponse(f"欢迎, {username}")
    return HttpResponse("请用 POST 提交")
```

**标准骨架:同一 URL 区分方法**

```python
def birthday_view(request):
    if request.method == 'GET':
        # 展示页面
        return render(request, 'birthday.html')
    elif request.method == 'POST':
        year = request.POST.get('year')
        month = request.POST.get('month')
        day = request.POST.get('day')
        return HttpResponse(f"生日为: {year}年{month}月{day}日")
    else:
        return HttpResponse(status=405)     # 方法不允许
```

### 处理 JSON 请求体

```python
import json
from django.http import JsonResponse

def api_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)      # 手动解析 JSON
        except json.JSONDecodeError:
            return JsonResponse({"error": "无效 JSON"}, status=400)
        return JsonResponse({"received": data})
```

> 前后端分离的 API 项目建议直接用 DRF(11 章),它自动完成 JSON 解析、校验、序列化;纯 Django 手写 JSON 接口只适合极简单场景。

### 处理上传文件

```python
def upload_view(request):
    if request.method == 'POST' and request.FILES.get('file'):
        f = request.FILES['file']
        # 分块写入,避免大文件占满内存
        with open(f"uploads/{f.name}", 'wb+') as dest:
            for chunk in f.chunks():
                dest.write(chunk)
        return HttpResponse(f"上传成功: {f.name},大小 {f.size} 字节")
    return render(request, 'upload.html')
```

```html
<form method="post" enctype="multipart/form-data">  <!-- 文件上传必须加 -->
    {% csrf_token %}
    <input type="file" name="file">
    <button type="submit">上传</button>
</form>
```

## 2.8 HttpResponse 对象:响应的方方面面

### 构造函数

```python
HttpResponse(content=响应体, content_type=数据类型, status=状态码)
```

| 参数 | 说明 |
| --- | --- |
| content | 返回内容(字符串或字节) |
| content_type | MIME 类型,默认 `text/html` |
| status | 状态码,默认 200 |

常用 content_type:

| 值 | 用途 |
| --- | --- |
| `text/html` | HTML(默认) |
| `text/plain` | 纯文本 |
| `application/json` | JSON |
| `multipart/form-data` | 文件提交 |

### 常用子类

| 类 | 作用 | 状态码 |
| --- | --- | --- |
| `HttpResponseRedirect` | 重定向 | 302 |
| `HttpResponseNotModified` | 未修改 | 304 |
| `HttpResponseBadRequest` | 错误请求 | 400 |
| `HttpResponseNotFound` | 资源不存在 | 404 |
| `HttpResponseForbidden` | 禁止访问 | 403 |
| `HttpResponseServerError` | 服务器错误 | 500 |
| `JsonResponse` | JSON 响应 | 200 |
| `FileResponse` | 文件下载(流式) | 200 |
| `StreamingHttpResponse` | 流式响应(大文件/SSE) | 200 |

### 响应头操作

```python
def custom_response(request):
    resp = HttpResponse("ok")
    resp.status_code = 201
    resp['X-Custom-Header'] = 'value'
    resp.set_cookie('theme', 'dark', max_age=3600, httponly=True)   # 07 章详解
    return resp
```

### 文件下载

```python
from django.http import FileResponse

def download_view(request):
    file = open('report.pdf', 'rb')
    resp = FileResponse(file, as_attachment=True, filename='年度报告.pdf')
    return resp
```

### 常用状态码速查

| 状态码 | 含义 |
| --- | --- |
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 成功但无内容 |
| 301 / 302 | 永久 / 临时重定向 |
| 400 | 请求错误 |
| 401 | 未认证 |
| 403 | 无权限(含 CSRF 失败) |
| 404 | 资源不存在 |
| 405 | 方法不允许 |
| 500 | 服务器内部错误 |

## 2.9 类视图(CBV)

路由不仅能指向函数,还能指向类。Django 内置通用视图能大幅减少样板代码。

### 基础 CBV

```python
# views.py
from django.views import View
from django.http import HttpResponse, JsonResponse

class HelloView(View):
    def get(self, request):
        return HttpResponse("GET 请求")

    def post(self, request):
        return HttpResponse("POST 请求")

# urls.py
from django.urls import path
from .views import HelloView

urlpatterns = [
    path('hello/', HelloView.as_view()),    # 注意 .as_view()
]
```

### 内置通用视图速查

```python
from django.views.generic import (
    TemplateView, ListView, DetailView, CreateView, UpdateView, DeleteView, RedirectView
)

# 纯模板页
class AboutView(TemplateView):
    template_name = "about.html"

# 列表 + 详情(自动用模型默认管理器查询)
class BookListView(ListView):
    model = Book
    template_name = "book_list.html"
    context_object_name = "books"     # 模板里用 books 而非默认 object_list
    paginate_by = 20                  # 自动分页

class BookDetailView(DetailView):
    model = Book
    template_name = "book_detail.html"
    context_object_name = "book"
    # URL 里传 pk:/book/<int:pk>/ 自动查找 Book.objects.get(pk=pk)
```

**FBV vs CBV 选择:**

- FBV:逻辑简单、一行一个场景,直观,适合工具型接口
- CBV:一套逻辑分 GET/POST 多分支、CRUD 重复结构,继承复用强,适合标准资源操作
- 大原则:**项目内保持统一风格**;通用 CRUD 优先用内置 CBV 或 DRF(11 章)

## 2.10 404 与错误处理

### 路由不匹配 → 自动 404

```python
def detail_view(request, book_id):
    try:
        book = Book.objects.get(id=book_id)
    except Book.DoesNotExist:
        raise Http404("书不存在")        # 手动抛 404
    return render(request, 'detail.html', {'book': book})
```

```python
from django.shortcuts import get_object_or_404

# 快捷方式:查不到自动 404
book = get_object_or_404(Book, id=book_id)
```

### 自定义错误页面

```python
# urls.py 里注册(仅 DEBUG=False 时生效,开发模式 Django 显示调试页)
handler404 = 'mysite1.views.page_not_found'
handler500 = 'mysite1.views.server_error'
```

```python
# views.py
def page_not_found(request, exception):
    return render(request, '404.html', status=404)

def server_error(request):
    return render(request, '500.html', status=500)
```

## 2.11 路由与视图最佳实践

1. **主路由只 include,不写业务路径**;每个应用一个 urls.py
2. **路由必须命名** + `app_name` 命名空间,硬编码 URL 是重构噩梦
3. **模板里一律 `&#123;% url %&#125;`**,视图里 `reverse()`
4. `request.GET/POST` 永远用 `.get()` 而非下标;值永远是字符串,记得类型转换
5. 敏感数据不进查询串;POST 表单必须带 `&#123;% csrf_token %&#125;`
6. 查单个对象用 `get_object_or_404`;判断方法用 `request.method == ...` 骨架
7. API 项目直接上 DRF(11 章),不要用 HttpResponse 手拼 JSON
