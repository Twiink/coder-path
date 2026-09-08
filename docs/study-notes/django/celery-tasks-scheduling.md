# 10 Celery 异步任务与定时任务

发邮件、缩图、报表生成这类慢操作不该阻塞用户请求;凌晨备份、定时清理这类操作需要"到点执行"。本章整合 Celery 专题文档:与 Django 集成、任务调用方式、定时任务 beat 与排障。

## 10.1 为什么需要 Celery

**同步做慢事的代价:** 注册接口里发邮件,用户要等 SMTP 响应 3 秒才能看到"注册成功";邮件服务抖动,注册直接 500。

**Celery 的解法:** 任务丢给消息队列,由独立的 worker 进程异步执行:

```text
Web 请求 → 发消息到 Broker(Redis)→ 立即返回"已受理"
                    │
                    ▼
          Celery Worker 进程(可多台、可扩展)
                    │ 执行任务(发邮件/报表)
                    ▼
          Result Backend(Redis,存结果)
```

| 组件 | 作用 |
| --- | --- |
| Broker | 消息中间件:Redis / RabbitMQ(任务队列) |
| Worker | 干活的进程 |
| Result Backend | 结果存储(Redis/数据库,可选) |
| Beat | 定时调度器(可选) |

## 10.2 安装与 Django 集成

```bash
pip install celery redis
```

### 1. 创建 Celery 应用实例

```python
# mysite1/celery.py(与 settings.py 同级)
import os
from celery import Celery

# 必须先设置 DJANGO_SETTINGS_MODULE,后续才能用 Django 组件(ORM 等)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite1.settings')

app = Celery('mysite1')

# 从 Django 配置读取 Celery 配置(前缀 CELERY_)
app.config_from_object('django.conf:settings', namespace='CELERY')

# 自动发现所有应用下的 tasks.py 并注册任务
app.autodiscover_tasks()
```

### 2. 应用启动时加载 Celery

```python
# mysite1/__init__.py
from .celery import app as celery_app

__all__ = ('celery_app',)
```

### 3. settings 里的 Celery 配置

```python
# settings.py
CELERY_BROKER_URL = 'redis://127.0.0.1:6379/0'     # 消息中间件
CELERY_RESULT_BACKEND = 'redis://127.0.0.1:6379/1' # 结果仓库
CELERY_ACCEPT_CONTENT = ['json']                   # 可接收的序列化格式
CELERY_TASK_SERIALIZER = 'json'                    # 任务序列化
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Shanghai'                  # 时区(与项目保持一致!)
CELERY_TASK_TIME_LIMIT = 300                       # 单任务硬超时 5 分钟
CELERY_TASK_SOFT_TIME_LIMIT = 240                  # 软超时(抛异常给任务处理)
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True   # broker 未就绪时重试
CELERY_RESULT_EXPIRES = 3600                       # 结果保留 1 小时
```

### 4. 定义任务

```python
# bookstore/tasks.py(autodiscover_tasks 自动扫描此文件)
from celery import shared_task
from django.core.mail import send_mail
from .models import Book

@shared_task
def send_welcome_email(username, email):
    """发欢迎邮件 —— 会被丢到 worker 执行"""
    send_mail(
        '欢迎注册',
        f'{username},感谢加入!',
        'noreply@example.com',
        [email],
        fail_silently=False,
    )
    return f'sent to {email}'

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def daily_report(self):
    """自动重试的报表任务"""
    try:
        generate_and_save_report()
    except Exception as exc:
        raise self.retry(exc=exc)      # 失败 60 秒后重试,最多 3 次

@shared_task
def cleanup_expired_wristbands():
    Book.objects.filter(expired_at__lt=timezone.now()).delete()
    return 'ok'
```

### 5. 视图里调用(不阻塞用户)

```python
# views.py
from .tasks import send_welcome_email

def register_view(request):
    form = RegisterForm(request.POST or None)
    if form.is_valid():
        user = User.objects.create_user(...)
        # 关键区别:不直接调函数,而是 .delay() 丢给队列,立即返回
        send_welcome_email.delay(user.username, user.email)
        return redirect('login')
    return render(request, 'register.html', {'form': form})
```

### 6. 启动 Worker 与 Beat

```bash
# 终端 1:worker(处理任务)
celery -A mysite1 worker -l info
# 并发数:celery -A mysite1 worker -l info --concurrency=4

# 终端 2:beat(定时调度)
celery -A mysite1 beat -l info
```

## 10.3 任务调用方式对照(重点)

| 方式 | 行为 | 用途 |
| --- | --- | --- |
| `task.delay(args)` | 异步发送,不等结果 | **生产标准用法** |
| `task.apply_async(args, ...)` | 异步发送 + 高级选项 | 延时/指定队列/过期 |
| `task()` / `task.apply()` | **当前进程同步执行,不走队列** | 本地调试任务逻辑 |
| `task.s(args)` | 创建签名(可编排) | 链式/分组任务 |

```python
# delay:最简单
async_result = send_welcome_email.delay('alice', 'a@x.com')

# apply_async:支持执行选项
send_welcome_email.apply_async(
    args=('alice', 'a@x.com'),
    countdown=10,          # 10 秒后执行
    # eta=datetime(...),   # 指定时间点执行
    expires=60,            # 60 秒内未消费则丢弃
    queue='emails',        # 指定队列(配合 worker -Q emails)
)

# 同步执行(不经过 broker,排查任务代码问题用)
result = cleanup_expired_wristbands.apply()
print(result.status)       # SUCCESS
print(result.result)
```

> **调试思维(源自原笔记):** 定时任务不触发时,先 `apply()` 同步跑一遍区分"任务代码问题"还是"队列/worker/beat 配置问题"。

### 查看异步结果

```python
async_result = send_welcome_email.delay('alice', 'a@x.com')
async_result.id          # 任务 UUID
async_result.status      # PENDING / STARTED / SUCCESS / FAILURE / REVOKED
async_result.get(timeout=10)     # 阻塞等结果(注意:配置了 result backend 才有)
async_result.ready()     # 是否完成
```

## 10.4 定时任务(Beat)

### 配置调度表

```python
# settings.py
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'daily-cleanup': {                         # 调度项名称(唯一)
        'task': 'bookstore.tasks.cleanup_expired_wristbands',   # 任务完整路径
        'schedule': crontab(hour=3, minute=0),  # 每天凌晨 3:00
    },
    'weekly-report': {
        'task': 'bookstore.tasks.daily_report',
        'schedule': crontab(hour=9, minute=30, day_of_week=1),   # 每周一 9:30
    },
    'every-10-min': {
        'task': 'bookstore.tasks.some_task',
        'schedule': 600,                        # 每 600 秒
    },
}
```

crontab 参数:`minute`、`hour`、`day_of_week`(0=周日)、`day_of_month`、`month_of_year`。

### 动态添加(database scheduler)

不想改代码配定时?用 `django-celery-beat` 把调度表存数据库,可在 Admin 后台配置:

```bash
pip install django-celery-beat
```

```python
INSTALLED_APPS = [..., 'django_celery_beat']
# 启动:celery -A mysite1 beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### 定时任务不触发的排查清单(源自原笔记)

1. `beat` 进程是否启动(常见:只起了 worker 没起 beat)
2. 时区是否一致:`CELERY_TIMEZONE` 与 `settings.TIME_ZONE`、服务器时区三方对齐(经典坑:以为 9 点执行,结果按 UTC 跑)
3. 调度项是否被正确加载(`CELERY_BEAT_SCHEDULE` 拼写、任务路径)
4. 任务名与实际注册名是否一致
5. worker 是否监听了目标队列(用了 `queue=` 时)

## 10.5 排障手册(源自原笔记)

### 1. 任务能同步执行(apply),但异步失败

检查顺序:

- `CELERY_BROKER_URL` 配置正确?Redis 可达?
- worker 是否启动(`celery -A mysite1 worker`)
- 任务是否注册成功(启动日志里看 `[tasks]` 列表有无你的任务;`autodiscover_tasks` 依赖应用就绪)
- 队列名是否匹配

### 2. 任务创建成功,一直 PENDING

- worker 在线吗?broker 可达吗?
- **常见误区**:没配置 result backend 或任务 `ignore_result=True` 时,状态会长期显示 PENDING —— 不代表没执行,别被误导
- 检查路由/队列:worker 默认只监听默认队列,自定义 `queue=` 要配 `worker -Q`

### 3. worker 里任务用了 Django ORM 报错

- `celery.py` 里必须先 `os.environ.setdefault('DJANGO_SETTINGS_MODULE', ...)`
- `__init__.py` 里导入了 `celery_app`(保证 Django 启动时 Celery 同步初始化)
- 新进程忘跑 migrate(表不存在)

## 10.6 生产实践要点

1. **任务必须幂等**:网络重试可能执行多次,删除/扣款类任务要有幂等设计
2. **任务带超时**:`CELERY_TASK_TIME_LIMIT` 防任务卡死占住 worker
3. **失败要重试**:`max_retries` + `retry()`;但要区分"可重试"(网络抖动)与"不可重试"(参数错误)
4. **worker 用 systemd/supervisor 守护**,崩溃自动拉起(12 章)
5. **监控**:flower(Celery 可视化面板)看队列积压、任务失败率;队列积压要告警
6. 参数**必须可序列化**(JSON):传对象会报错,传主键到任务里再查库
7. 任务里不要用请求级对象(request/session),它是独立进程

## 10.7 官方资料

- Celery 任务调用:https://docs.celeryq.dev/en/stable/userguide/calling.html
- Celery + Django 入门:https://docs.celeryq.dev/en/stable/django/first-steps-with-django.html
- 定时任务:https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html
