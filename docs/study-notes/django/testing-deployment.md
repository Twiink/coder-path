# 12 测试与部署

最后一章:用测试守住质量,用正确的姿势把项目送上生产。本章整合《员工信息管理-Django》中的部署实战经验(日志、异常捕获、时区、跨域、gunicorn)并系统化。

## 12.1 自动化测试

### Django 内置测试框架

```python
# bookstore/tests.py
from django.test import TestCase
from django.urls import reverse
from .models import Book, Press

class BookModelTest(TestCase):
    def setUp(self):                     # 每个测试前执行
        self.press = Press.objects.create(name='测试出版社')

    def test_create_book(self):
        book = Book.objects.create(title='测试书', price=10, press=self.press)
        self.assertEqual(book.title, '测试书')
        self.assertEqual(Book.objects.count(), 1)

    def test_str_method(self):
        book = Book.objects.create(title='Django', price=10, press=self.press)
        self.assertIn('Django', str(book))

class BookViewTest(TestCase):
    def test_list_page(self):
        resp = self.client.get(reverse('bookstore:list'))     # client 模拟请求
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, '图书')

    def test_create_requires_login(self):
        resp = self.client.post(reverse('bookstore:create'), {'title': 'x'})
        self.assertRedirects(resp, '/accounts/login/?next=/bookstore/create/')
```

```bash
python manage.py test bookstore          # 跑指定应用
python manage.py test -v 2               # 详细输出
```

**TestCase 关键机制:** 每个测试跑在**独立事务**里,结束自动回滚 —— 测试数据不污染真实库;用 `--keepdb` 保留测试库加速。

### API 测试(DRF)

```python
from rest_framework.test import APITestCase
from rest_framework import status

class BookAPITest(APITestCase):
    def test_create_book(self):
        resp = self.client.post('/api/books/', {'title': 'x', 'price': 10}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.json()['title'], 'x')

    def test_unauthenticated_rejected(self):
        resp = self.client.get('/api/orders/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
```

### pytest 风格(团队主流)

```bash
pip install pytest pytest-django
```

```ini
# pytest.ini
[pytest]
DJANGO_SETTINGS_MODULE = mysite1.settings
```

```python
import pytest
from django.urls import reverse

@pytest.mark.django_db                     # 标记需要数据库
def test_book_creation():
    book = Book.objects.create(title='x', price=1)
    assert Book.objects.filter(title='x').exists()

@pytest.mark.parametrize('price,valid', [(0, False), (10, True), (-1, False)])
def test_price_validation(client, price, valid):
    resp = client.post('/api/books/', {'title': 'x', 'price': price})
    assert (resp.status_code == 201) == valid
```

### 测试分层建议

1. **模型层**:方法、约束、信号 —— 便宜大量写
2. **视图/API 层**:状态码、权限、校验失败路径 —— 中量
3. **集成测试**:登录→下单→支付 核心链路 —— 少量但必须
4. 覆盖率 `coverage run manage.py test && coverage report`,核心模块盯 80%+,不为凑数写测试

## 12.2 生产环境准备

### 生产 settings 加固清单

```python
# settings/prod.py
DEBUG = False                        # 铁律
ALLOWED_HOSTS = ['api.example.com']  # 白名单,不用 '*'

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']       # 环境变量!
DATABASES = {'default': {..., 'PASSWORD': os.environ['DB_PASSWORD']}}

# 安全头与 Cookie
SECURE_SSL_REDIRECT = True           # HTTP 强制跳 HTTPS
SESSION_COOKIE_SECURE = True         # 会话 cookie 仅 HTTPS
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000       # HSTS 一年
SECURE_CONTENT_TYPE_NOSNIFF = True

# 静态文件
STATIC_ROOT = BASE_DIR / 'staticfiles'
```

### 依赖锁定

```bash
pip freeze > requirements.txt          # 快照
# 或 uv/poetry 生成锁文件(推荐),保证部署环境可复现
```

## 12.3 日志配置(源自员工信息管理实战)

生产不能靠 print,日志要有级别、有文件、有轮转:

```python
# settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'verbose'},
        'file': {
            'class': 'logging.handlers.TimedRotatingFileHandler',   # 按天轮转
            'filename': BASE_DIR / 'logs' / 'django.log',
            'when': 'midnight',
            'backupCount': 30,               # 保留 30 天
            'formatter': 'verbose',
        },
    },
    'root': {'handlers': ['console', 'file'], 'level': 'INFO'},
    'loggers': {
        'django': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
        'django.request': {'handlers': ['file'], 'level': 'ERROR'},  # 请求错误单独记
    },
}
```

代码中使用:

```python
import logging
logger = logging.getLogger(__name__)
logger.info("用户 %s 创建了订单 %s", user.username, order.id)
logger.exception("订单处理失败")      # 自动附带堆栈
```

## 12.4 全局异常捕获与统一响应(源自实战)

```python
# utils/exceptions.py —— 中间件兜底,避免 500 裸奔给用户
import logging
logger = logging.getLogger(__name__)

def exception_middleware(get_response):
    def middleware(request):
        try:
            return get_response(request)
        except Exception:
            logger.exception("未捕获异常: %s %s", request.method, request.path)
            from django.http import JsonResponse
            # API 路径返回 JSON,页面路径返回友好页
            if request.path.startswith('/api'):
                return JsonResponse({"code": 500, "message": "服务器内部错误"}, status=500)
            from django.shortcuts import render
            return render(request, '500.html', status=500)
    return middleware
```

```python
# 视图层统一响应格式(API 项目)
def api_response(data=None, message='ok', code=200, status=200):
    return JsonResponse({"code": code, "message": message, "data": data}, status=status)
```

## 12.5 时区与数据库异常(源自实战)

```python
# settings.py
TIME_ZONE = 'Asia/Shanghai'    # 服务器时区
USE_TZ = True                  # 保持 True:库中存 UTC,展示时转换

# 代码中一律 timezone.now(),不要 datetime.now()
from django.utils import timezone
order.created_at = timezone.now()
```

```python
# 数据库连接异常兜底(重启/主从切换时自动恢复)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        ...,
        'CONN_MAX_AGE': 60,              # 持久连接 60 秒(减少握手开销)
        # MySQL 断连重试由 mysqlclient 驱动内置;PG 可配 OPTIONS
    }
}
```

## 12.6 CORS 跨域配置(前后端分离必配)

```bash
pip install django-cors-headers
```

```python
INSTALLED_APPS = [..., 'corsheaders']
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',    # 尽量靠前
    ...,
]

# 开发:全放行
CORS_ALLOW_ALL_ORIGINS = True
# 生产:白名单
CORS_ALLOWED_ORIGINS = [
    'https://app.example.com',
    'http://localhost:5173',
]
CORS_ALLOW_CREDENTIALS = True    # 允许带 cookie(前后端同域会话场景)
```

## 12.7 Gunicorn 部署(源自实战)

```bash
pip install gunicorn
```

```bash
# 常用生产命令(源自实战项目,含日志与字段限制调优):
gunicorn --bind=0.0.0.0:8000 \
  --access-logfile=/var/log/django/access.log \
  --error-logfile=/var/log/django/error.log \
  --capture-output \
  --workers=9 --threads=2 \
  --timeout=30 \
  --limit-request-fields=32768 --limit-request-field_size=64000 \
  EmpManagerBackend.wsgi
```

参数速查:

| 参数 | 说明 |
| --- | --- |
| `--workers` | 进程数(经验:`CPU核数*2+1`;IO 密集可多,压测定案) |
| `--threads` | 每进程线程数(提升 IO 并发;Django 同步模型常用 workers × threads) |
| `--timeout` | worker 无响应秒数(长请求调大) |
| `--access-logfile` / `--error-logfile` | 访问/错误日志 |
| `--limit-request-fields` / `--limit-request-field_size` | 请求头字段数量/大小限制(防御大 header 攻击) |
| `--graceful-timeout` | 优雅退出等待 |
| `--max-requests` | worker 处理 N 请求后重启(缓解内存泄漏) |

```bash
# 优雅重启(不停机发版):
kill -HUP $(cat /var/run/gunicorn.pid)
```

> **Django 是同步 WSGI 应用**:`async def` 视图是少数派,ORM 同步。gunicorn 用 sync/gevent worker 即可,不必像 FastAPI 那样上 uvicorn worker。选 gevent 时注意与某些 C 扩展库的兼容性。

## 12.8 systemd 守护

`/etc/systemd/system/mysite.service`:

```ini
[Unit]
Description=My Django Site
After=network.target

[Service]
User=webuser
Group=webuser
WorkingDirectory=/srv/mysite
EnvironmentFile=/srv/mysite/.env
ExecStart=/srv/mysite/venv/bin/gunicorn --workers 4 --bind 127.0.0.1:8000 mysite1.wsgi
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mysite
journalctl -u mysite -f              # 看日志
```

## 12.9 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name api.example.com;

    client_max_body_size 50M;        # 上传大小限制(与 02 章上传呼应)

    # 静态文件:Nginx 直出,不经过 Django
    location /static/ {
        alias /srv/mysite/staticfiles/;
        expires 30d;
    }
    location /media/ {
        alias /srv/mysite/media/;
        expires 7d;
    }

    # admin 路径限流(08 章安全加固)
    location /admin/ {
        limit_req zone=admin_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:8000;
        include proxy_params;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
# limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=10r/m;  (http 块)
```

HTTPS 证书(certbot 自动配置):

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com
```

## 12.10 发布流程(源自实战的自动部署思路)

```text
本地开发 → git push → CI(跑测试/lint)→ 服务器拉取新代码
  → pip install -r requirements.txt
  → python manage.py migrate          # 先迁移
  → python manage.py collectstatic    # 收集静态文件
  → kill -HUP gunicorn                # 优雅重启
  → 健康检查
```

要点:

- **迁移与代码解耦**:先加列后删列,新代码兼容旧表,滚动发布
- **collectstatic 前清空 STATIC_ROOT**(避免"是否覆盖"交互卡死自动化脚本,源自实战经验)
- 回滚预案:代码回滚 → migrate 回退(`migrate app 00xx`)
- 发布后盯日志错误率与响应时间

## 12.11 上线检查清单

- [ ] `DEBUG=False`,`ALLOWED_HOSTS` 白名单,`SECRET_KEY` 在环境变量
- [ ] 数据库密码/邮件密码等敏感配置全部环境变量,`.env` 不进 git
- [ ] `migrate` 已执行,迁移文件已审查(03 章纪律)
- [ ] `collectstatic` 已跑,Nginx 服务静态/媒体文件
- [ ] HTTPS + HSTS + 安全 Cookie 配置生效
- [ ] CORS 白名单收紧;admin URL 已改名 + 限流
- [ ] 日志轮转配置好;异常有兜底响应与告警(Sentry)
- [ ] 登录/注册接口有限流;CSRF 未被全局关闭
- [ ] Celery worker/beat 有 systemd 守护(10 章)
- [ ] 数据库备份 + 恢复演练;压测过目标流量,workers 数有据
- [ ] 监控接入:错误率、P95 延迟、队列积压、磁盘告警

## 12.12 常见生产问题

| 问题 | 原因与对策 |
| --- | --- |
| 502 Bad Gateway | gunicorn 挂了/超时:看 systemd 状态与 error log;调 timeout |
| 请求间歇性变慢 | workers 不足排队 / 慢 SQL:压测 + debug-toolbar 查 SQL(03 章) |
| 内存缓慢增长 | 进程泄漏:gunicorn `--max-requests` 定期重启;排查信号/缓存 |
| 静态文件 404 | 忘 collectstatic 或 Nginx alias 路径不对(05 章) |
| CSRF 403(生产) | 忘 `&#123;% csrf_token %&#125;` 或 HTTPS 下 cookie secure 与 Nginx 配置不匹配 |
| 数据库连接断开 | 加 `CONN_MAX_AGE`、驱动重试;检查数据库 wait_timeout |
| 定时任务不跑 | beat 没起 / 时区不一致(10 章排查清单) |
