# 09 中间件、信号与邮件

本章整合原笔记第 7 章:中间件的原理与自定义、Django 信号系统、发送邮件。

## 9.1 中间件(Middleware)

### 什么是中间件

中间件是**全局的请求处理钩子**:每个请求进入视图前、每个响应离开服务器前,都按顺序穿过中间件栈。Django 的安全、会话、认证、CSRF、消息框架全是中间件实现的。

```text
请求 → M1 → M2 → M3 → 视图 → 响应加工(M3→M2→M1)→ 客户端
      └──── 洋葱模型:先注册的先见请求,后处理响应 ────┘
```

### 内置中间件一览(settings.MIDDLEWARE 默认顺序)

| 中间件 | 作用 |
| --- | --- |
| SecurityMiddleware | 安全头:HSTS、X-Content-Type-Options 等 |
| SessionMiddleware | 解析 sessionid → request.session |
| CommonMiddleware | URL 规范化(斜杠补全 301)、禁用 User-Agent |
| CsrfViewMiddleware | CSRF 校验(06 章) |
| AuthenticationMiddleware | 按 session 注入 request.user |
| MessageMiddleware | 一次性消息框架 |
| XFrameOptionsMiddleware | 防点击劫持(X-Frame-Options) |

> **顺序有意义**:AuthenticationMiddleware 必须在 SessionMiddleware 之后(它依赖 session);CSRF 在认证后。自定义中间件插入位置想清楚依赖关系。

### 自定义中间件(函数式)

Django 支持两种写法,函数式最简洁:

```python
# middleware/mymiddleware.py
import time

def timing_middleware(get_response):
    """统计每个请求耗时并写入响应头"""
    def middleware(request):
        start = time.perf_counter()
        response = get_response(request)      # 继续走后面的中间件和视图
        elapsed = time.perf_counter() - start
        response['X-Process-Time'] = f"{elapsed:.4f}s"
        return response
    return middleware
```

```python
# settings.py
MIDDLEWARE = [
    ...,
    'middleware.mymiddleware.timing_middleware',
]
```

**执行时机:**

```python
def my_middleware(get_response):
    # 这里:服务器启动时执行一次(初始化资源)
    def middleware(request):
        # 这里:请求阶段(视图之前)
        response = get_response(request)
        # 这里:响应阶段(视图之后)
        return response
    return middleware
```

### 类式中间件

```python
class BlockIPMiddleware:
    """IP 黑名单"""
    BLOCKED = {'10.0.0.99'}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ip = request.META.get('REMOTE_ADDR')
        if ip in self.BLOCKED:
            from django.http import HttpResponseForbidden
            return HttpResponseForbidden('访问被拒绝')   # 直接短路,不进入视图
        return self.get_response(request)
```

### 实战例子

```python
# 1. 维护模式开关
class MaintenanceMiddleware:
    def __call__(self, request):
        if settings.MAINTENANCE_MODE and not request.path.startswith('/static'):
            return HttpResponse('系统维护中,请稍后再试', status=503)
        return self.get_response(request)

# 2. 请求日志(生产常用)
import logging
logger = logging.getLogger('request')

def logging_middleware(get_response):
    def middleware(request):
        response = get_response(request)
        logger.info("%s %s -> %s (%s)",
                    request.method, request.path,
                    response.status_code, request.META.get('REMOTE_ADDR'))
        return response
    return middleware
```

### 使用注意

1. **中间件要快**:它运行在每个请求上,里面查库/调外部接口会拖垮全站
2. **异常要兜底**:get_response 抛异常时要决定记录日志并转 500 响应
3. 与 FastAPI 不同,Django 中间件是同步模型(ASGI 中间件写法不同,少用)
4. 只影响全局的横切逻辑才放中间件;局部逻辑用装饰器/视图 mixin

## 9.2 信号(Signals)

信号是 Django 的**观察者模式**实现:某事件发生(保存、删除、请求开始),自动通知订阅者。用于解耦 —— 典型场景"注册后发欢迎邮件""删文章后清缓存"。

### 内置信号速查

| 信号 | 触发时机 |
| --- | --- |
| `pre_save` / `post_save` | 模型 save() 前 / 后 |
| `pre_delete` / `post_delete` | 模型 delete() 前 / 后 |
| `m2m_changed` | 多对多关系变化 |
| `pre_migrate` / `post_migrate` | 迁移前 / 后 |
| `request_started` / `request_finished` | 请求开始 / 结束 |
| `user_logged_in` / `user_logged_out` | 登录 / 登出 |
| `post_init` | 模型实例化后 |

### 定义与连接

```python
# bookstore/signals.py
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import Book

@receiver(post_save, sender=Book)
def invalidate_book_cache(sender, instance, created, **kwargs):
    """保存图书后失效缓存"""
    cache.delete('hot_books')
    cache.delete(f'book:{instance.id}')

@receiver(post_delete, sender=Book)
def on_book_deleted(sender, instance, **kwargs):
    print(f"图书《{instance.title}》已删除")

# 登录信号(内置 auth 信号)
from django.contrib.auth.signals import user_logged_in

@receiver(user_logged_in)
def log_login(sender, request, user, **kwargs):
    print(f"用户 {user.username} 于 {timezone.now()} 登录,IP: {request.META.get('REMOTE_ADDR')}")
```

```python
# bookstore/apps.py —— 在应用就绪时加载 signals 模块(否则不生效)
from django.apps import AppConfig

class BookstoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'bookstore'

    def ready(self):
        from . import signals        # 导入即注册
```

```python
# 或在 signals.py 尾部直接注册(不需要 ready)
post_save.connect(invalidate_book_cache, sender=Book)
```

### 注册用户后自动发欢迎邮件(实战)

```python
from django.contrib.auth.models import User
from django.core.mail import send_mail

@receiver(post_save, sender=User)
def send_welcome_email(sender, instance, created, **kwargs):
    if created:                        # 仅新建时
        send_mail(
            '欢迎注册',
            f'{instance.username},感谢加入!',
            'noreply@example.com',
            [instance.email],
            fail_silently=True,        # 邮件失败不中断注册主流程
        )
```

### 信号的坑

1. **同步执行**:信号处理函数在保存的同一个事务/请求里执行,慢逻辑(发邮件、缩图)会拖慢请求 → 信号里只做快事,重活丢 Celery(10 章)
2. **QuerySet 批量操作不触发**:`QuerySet.update()`/`bulk_create()` 不走 save(),信号不触发(官方文档明示)
3. **事务内执行**:post_save 在事务提交前触发,若事务回滚,信号副作用(已发邮件)不可撤销
4. **难追踪**:信号让流程"隐形",过度使用会变成谁都看不懂的魔法 —— 团队内限制用量,能用显式调用就不上信号
5. **重复注册**:apps.py ready() 里 import signals 时,用 `@receiver` 装饰器即可(内部去重);手动 connect 注意防重

## 9.3 发送邮件

### 配置

```python
# settings.py —— SMTP 方式(最通用)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.qq.com'            # QQ 企业邮箱示例;或 smtp.163.com 等
EMAIL_PORT = 465
EMAIL_USE_SSL = True                  # 465 用 SSL;587 用 TLS(EMAIL_USE_TLS=True)
EMAIL_HOST_USER = 'noreply@example.com'
EMAIL_HOST_PASSWORD = os.environ['EMAIL_PASSWORD']   # 授权码,不是登录密码!
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

# 开发模式:邮件输出到控制台(不真发)
# EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
# 开发模式:写到文件
# EMAIL_BACKEND = 'django.core.mail.backends.filebased.EmailBackend'
# EMAIL_FILE_PATH = BASE_DIR / 'sent_emails'
```

### 发送

```python
from django.core.mail import send_mail, send_mass_mail, EmailMultiAlternatives

# 简单邮件
send_mail(
    subject='标题',
    message='纯文本内容',
    from_email=None,                 # None 用 DEFAULT_FROM_EMAIL
    recipient_list=['user@example.com'],
    fail_silently=False,             # False:失败抛异常(建议);True:静默
)

# HTML 邮件
msg = EmailMultiAlternatives(
    '本周周报',
    '您的客户端不支持 HTML',                        # 纯文本降级
    None,
    ['user@example.com'],
)
msg.attach_alternative('<h1>本周周报</h1><p>...</p>', 'text/html')
msg.send()

# 群发(不同内容,共用连接)
send_mass_mail([
    ('标题1', '内容1', None, ['a@x.com']),
    ('标题2', '内容2', None, ['b@x.com']),
], fail_silently=False)

# 附件
msg.attach_file('/path/report.pdf')
```

### 验证码/通知类邮件的模板化

```python
from django.template.loader import render_to_string

html = render_to_string('emails/welcome.html', {'username': user.username})
msg = EmailMultiAlternatives('欢迎', '欢迎', None, [user.email])
msg.attach_alternative(html, 'text/html')
msg.send()
```

### 实践要点

1. **邮件密码放环境变量**(授权码),不进 git
2. 验证码/通知邮件**用 Celery 异步发**(10 章),别阻塞用户请求;失败要重试
3. `fail_silently=False` 才能感知失败;生产上发信失败要记日志/告警
4. 大批量营销邮件走专用服务(SES、SendGrid、阿里云邮件推送),SMTP 通道有频率限制
5. 邮件内容防注入:模板渲染自动转义;发信前确认收件人列表不为空
