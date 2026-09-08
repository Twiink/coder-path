# 06 表单与用户认证

本章覆盖原笔记未展开的两个核心主题:**表单系统**(Form/ModelForm、校验)与**用户认证系统**(auth:注册、登录、登出、权限控制)。

## 6.1 表单的作用

用户提交的数据到达服务器后,要做三件事:**接收 → 校验 → 处理**。手写 if 校验(02 章的风格)又臭又长,Django 表单把"HTML 渲染 + 校验 + 错误回显"一站式解决:

```text
POST 数据 → Form(data=request.POST) → is_valid() 校验
              ├─ 通过 → cleaned_data 干净数据 → 业务处理
              └─ 失败 → form.errors → 渲染回页面(带错误提示 + 用户已填内容)
```

## 6.2 Form:纯数据表单

### 定义表单类

```python
# bookstore/forms.py
from django import forms

class BookSearchForm(forms.Form):
    keyword = forms.CharField(
        label='关键词',                # 渲染的标签文字
        max_length=50,
        required=False,                # 非必填
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': '输入书名'}),
    )
    min_price = forms.DecimalField(label='最低价', required=False, min_value=0)
    pub = forms.ChoiceField(
        label='出版社',
        required=False,
        choices=[('', '全部')] + [(p.name, p.name) for p in Press.objects.all()],
    )
```

### 常用字段与对应 widget

| Form 字段 | 默认 HTML 控件 | 常用参数 |
| --- | --- | --- |
| `CharField` | `<input type="text">` | max_length, min_length, strip |
| `EmailField` | `<input type="email">` | 自动校验邮箱格式 |
| `IntegerField` | `<input type="number">` | min_value, max_value |
| `DecimalField` | number | max_digits, decimal_places |
| `BooleanField` | checkbox | required |
| `ChoiceField` | select | choices |
| `MultipleChoiceField` | 多选 select | choices |
| `DateField` / `DateTimeField` | date/datetime 输入 | input_formats |
| `FileField` / `ImageField` | file 控件 | 需要 request.FILES |
| `ModelChoiceField` | select(选项来自模型) | queryset |

### 视图中的标准处理流程

```python
# views.py
def search_view(request):
    form = BookSearchForm(request.GET or None)     # GET 场景传 request.GET
    if form.is_valid():
        # cleaned_data 只含"通过校验"的字段,且已是正确类型
        keyword = form.cleaned_data['keyword']
        min_price = form.cleaned_data.get('min_price') or 0
        books = Book.objects.filter(title__icontains=keyword, price__gte=min_price)
        return render(request, 'bookstore/search_result.html', {'books': books})
    # 首次访问(GET 无数据)或校验失败,都回到表单页
    return render(request, 'bookstore/search.html', {'form': form})
```

### 模板渲染

```html
<form method="get" action="{% url 'bookstore:search' %}">
    {{ form.keyword.label_tag }}          <!-- 标签 -->
    {{ form.keyword }}                    <!-- 输入框(自动回填已填内容) -->
    {{ form.keyword.errors }}             <!-- 该字段错误列表 -->

    <button type="submit">搜索</button>
</form>

<!-- 快捷方式:整表渲染(样式不可控,项目里一般手动逐字段排) -->
{{ form.as_p }}     <!-- 或 as_table / as_ul / as_div -->
```

> 表单自动处理:错误回显(`form.errors`)、已填内容回填(重新渲染时保留)、`required` 校验、类型转换(字符串 → Decimal)。这就是"别手写校验"的理由。

### 自定义校验

```python
from django.core.exceptions import ValidationError

class RegisterForm(forms.Form):
    username = forms.CharField(max_length=50)
    password = forms.CharField(widget=forms.PasswordInput, min_length=8)
    password_confirm = forms.CharField(widget=forms.PasswordInput)

    # 单字段校验:方法名 clean_<字段名>
    def clean_username(self):
        username = self.cleaned_data['username']
        if User.objects.filter(username=username).exists():
            raise ValidationError('用户名已被注册')
        return username

    # 跨字段校验
    def clean(self):
        cleaned = super().clean()
        p1 = cleaned.get('password')
        p2 = cleaned.get('password_confirm')
        if p1 and p2 and p1 != p2:
            # 错误挂到具体字段上,便于模板定位显示
            self.add_error('password_confirm', '两次输入的密码不一致')
        return cleaned
```

## 6.3 ModelForm:与模型绑定的表单

模型已定义字段,表单再写一遍是重复。ModelForm 直接从模型生成表单字段与保存逻辑:

```python
# forms.py
from django import forms
from .models import Book

class BookForm(forms.ModelForm):
    class Meta:
        model = Book
        fields = ['title', 'price', 'pub_date', 'press']   # 需要的字段
        # fields = '__all__'           # 全部(危险:会把所有可编辑字段暴露)
        # exclude = ['is_onsale']      # 排除法
        labels = {'title': '书名'}
        widgets = {
            'pub_date': forms.DateInput(attrs={'type': 'date'}),
        }
```

```python
# views.py —— 创建 + 更新二合一
def book_create_or_update(request, book_id=None):
    book = None
    if book_id:                                    # 更新:带初始实例
        book = get_object_or_404(Book, id=book_id)
    form = BookForm(request.POST or None, instance=book)
    if form.is_valid():
        form.save()                                # ModelForm 直接保存模型实例!
        return redirect('bookstore:list')
    return render(request, 'bookstore/book_form.html', {'form': form, 'book': book})
```

**ModelForm 的额外校验**同样用 `clean_<字段>` / `clean`,保存前后钩子重写 `save()` 或在视图里:

```python
def book_create(request):
    form = BookForm(request.POST)
    if form.is_valid():
        book = form.save(commit=False)   # 先不落库
        book.created_by = request.user   # 补充表单里没有的字段
        book.save()
        form.save_m2m()                  # 多对多需要额外保存
        return redirect(...)
```

## 6.4 CSRF 防护

**CSRF(跨站请求伪造):** 恶意网站诱导已登录用户向你的站点发请求(如伪造转账 POST)。Django 内置 `CsrfViewMiddleware` 防护:POST 表单必须携带 token,否则 403。

```html
<form method="post">
    {% csrf_token %}        <!-- 渲染成 <input type="hidden" name="csrfmiddlewaretoken" value="..."> -->
    ...
</form>
```

```python
# AJAX 场景:从 cookie 取 token 放进请求头
# 模板里:
#   <meta name="csrf-token" content="{{ csrf_token }}">
# JS:
#   fetch(url, {method:'POST', headers: {'X-CSRFToken': token}, ...})
```

```python
# 豁免(仅限确有必要的接口,如第三方回调;用装饰器精准豁免,不要全局关中间件):
from django.views.decorators.csrf import csrf_exempt, csrf_protect

@csrf_exempt
def webhook(request):
    ...
```

> **API 注意:** 用 Token/JWT 认证的纯 API 接口不依赖 Cookie 会话,CSRF 风险本身不存在;DRF 的 SessionAuthentication 才需要 CSRF(11 章)。**永远不要注释掉 CsrfViewMiddleware** —— 要豁免用装饰器。

## 6.5 用户认证系统(auth)

Django 内置 `django.contrib.auth` 全家桶:用户模型、密码哈希、登录会话、权限、组。

### 用户模型(User)

```python
from django.contrib.auth.models import User

user = User.objects.create_user(     # 必须用 create_user:自动哈希密码!
    username='alice',
    email='alice@example.com',
    password='secret123',
)
user.check_password('secret123')     # True:验证密码
user.set_password('newpass')         # 改密码(自动哈希)
user.save()

# 字段:username、password(哈希)、email、first_name、last_name、
#       is_staff(能否进 admin)、is_active(可否登录)、is_superuser、groups、user_permissions
```

### 自定义用户模型(项目开始前决定!)

**铁律:项目初期就决定用户模型。** 中途更换自定义用户模型极其痛苦(要清库重建)。两种扩展方式:

**方式 A(轻量):Profile 一对一扩展(04 章已示)**

```python
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=11, blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True)

user.profile.phone        # 访问扩展字段
```

**方式 B(彻底):自定义用户模型(适合用邮箱/手机号登录)**

```python
# accounts/models.py
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    phone = models.CharField(max_length=11, blank=True)
    # 用邮箱登录:
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'          # 登录凭证字段
    REQUIRED_FIELDS = ['username']    # createsuperuser 时额外要求

# settings.py
AUTH_USER_MODEL = 'accounts.User'     # 必须同时配置!
```

```python
# 之后一律用 get_user_model() 或 settings.AUTH_USER_MODEL 引用:
from django.contrib.auth import get_user_model
User = get_user_model()
# 外键: models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
```

### 注册

```python
def register_view(request):
    form = RegisterForm(request.POST or None)      # 6.2 的定义
    if form.is_valid():
        User.objects.create_user(
            username=form.cleaned_data['username'],
            password=form.cleaned_data['password'],
        )
        return redirect('login')
    return render(request, 'accounts/register.html', {'form': form})
```

### 登录 / 登出

```python
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import AuthenticationForm

def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)   # 内置登录表单
        if form.is_valid():
            login(request, form.get_user())          # 写入 session
            return redirect(request.GET.get('next', '/'))   # 回跳原页面
    else:
        form = AuthenticationForm()
    return render(request, 'accounts/login.html', {'form': form})

# 或手写:
# user = authenticate(request, username=..., password=...)  # 验证成功返回 User,失败 None
# if user is not None: login(request, user)

def logout_view(request):
    logout(request)                  # 清 session
    return redirect('/')
```

> `authenticate()` 永远先于 `login()`:`login()` 只负责写会话,**不做密码验证** —— 跳过 authenticate 直接 login 等于开后门。

### 使用当前用户

```python
def my_orders(request):
    if not request.user.is_authenticated:      # 未登录判断
        return redirect('login')
    orders = Order.objects.filter(user=request.user)
    ...
```

### 登录保护装饰器

```python
from django.contrib.auth.decorators import login_required, permission_required

@login_required                      # 未登录 → 302 到 settings.LOGIN_URL(默认 /accounts/login/)
def my_orders(request):
    ...

@login_required(login_url='/custom-login/')   # 自定义登录页
def another(request):
    ...

@permission_required('bookstore.delete_book')   # 需特定权限
def delete_book(request, book_id):
    ...

# CBV 用 mixin:
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin

class OrderListView(LoginRequiredMixin, ListView):
    ...
```

### 模板中的用户

```html
{% if user.is_authenticated %}
    <span>{{ user.username }},你好!</span>
    <a href="{% url 'logout' %}">登出</a>
{% else %}
    <a href="{% url 'login' %}">登录</a>
{% endif %}
```

## 6.6 权限与组

Django 自带三层权限模型:模型级(add/change/delete/view 四类权限)→ 对象级(需第三方如 django-guardian)→ 组。

```python
# 代码中检查
user.has_perm('bookstore.delete_book')    # 权限字符串:应用名.动作_模型小写
user.has_perms(['a.add_x', 'a.change_x'])

# 分配权限
from django.contrib.auth.models import Permission
perm = Permission.objects.get(codename='delete_book')
user.user_permissions.add(perm)

# 组:批量授权
from django.contrib.auth.models import Group
editors = Group.objects.get(name='编辑')
user.groups.add(editors)

# 模板中检查(需要 auth context processor)
{% if perms.bookstore.delete_book %}
    <a href="...">删除</a>
{% endif %}
```

## 6.7 登录相关配置

```python
# settings.py
LOGIN_URL = '/accounts/login/'        # login_required 跳转地址
LOGIN_REDIRECT_URL = '/'              # 登录成功后默认跳转
LOGOUT_REDIRECT_URL = '/'

AUTH_PASSWORD_VALIDATORS = [          # 内置密码强度校验(注册/改密生效)
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},  # 防常见弱密码
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},  # 防纯数字
]
```

## 6.8 安全要点

1. **密码:** 永远 `create_user`/`set_password`(自动 PBKDF2 哈希),绝不存明文
2. **登录防爆破:** 登录接口加限流(第三方 django-ratelimit 或 Nginx 层,见 12 章);记录失败日志
3. **POST 必须 CSRF token**;豁免用装饰器精准控制
4. **`is_active=False` 即封号**,配合"每次请求查库"的会话机制立即生效
5. **admin 账号与业务账号分离**;`is_staff`/`is_superuser` 最小化授予
6. **找回密码流程:** 只提示"已发送"(不泄露账号是否存在);重置 token 短时效 + 一次性
7. **对象级权限**(谁能操作哪条数据)内置不支持,需要时上 django-guardian
8. 登录成功后再跳转:`redirect(request.GET.get('next', '/'))` 前校验 next 是站内路径,防开放重定向
