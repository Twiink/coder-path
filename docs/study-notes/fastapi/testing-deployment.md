# 07 测试与部署

代码写完只是开始。本章覆盖:**自动化测试**(pytest + TestClient + 异步测试 + CI)与**生产部署**(多进程、Docker、Nginx、监控、性能调优)。

## 7.1 自动化测试

### 环境准备

```bash
pip install pytest httpx pytest-cov
```

### 测试目录结构

```
myapp/
├── app/                    # 应用代码
│   ├── main.py
│   ├── routers/ ...
├── tests/
│   ├── conftest.py         # 公共 fixture
│   ├── test_items.py       # 接口测试
│   ├── test_auth.py
│   └── test_services.py    # 业务逻辑单测
└── pytest.ini              # pytest 配置
```

```ini
# pytest.ini
[pytest]
testpaths = tests
addopts = -v --tb=short
```

### conftest.py:公共 fixture

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    # TestClient 基于 httpx,不需要真正启动服务器
    # with 用法会触发 lifespan 事件(数据库初始化等)
    with TestClient(app) as c:
        yield c
```

### 基础接口测试

```python
# tests/test_items.py
from fastapi import status


def test_create_item_success(client):
    resp = client.post("/items", json={"name": "键盘", "price": 299.5})
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert data["name"] == "键盘"
    assert "price_with_tax" in data


def test_create_item_validation_error(client):
    """校验失败应返回 422"""
    resp = client.post("/items", json={"name": "", "price": -1})
    assert resp.status_code == 422
    assert "detail" in resp.json()


def test_get_item_not_found(client):
    resp = client.get("/items/999")
    assert resp.status_code == 404


def test_query_params(client):
    resp = client.get("/search", params={"q": "手机", "page": 2})
    assert resp.status_code == 200
    assert resp.json()["page"] == 2


def test_upload(client):
    resp = client.post(
        "/upload",
        files={"file": ("test.txt", b"hello world", "text/plain")},
    )
    assert resp.status_code == 200
    assert resp.json()["filename"] == "test.txt"
```

### 参数化测试(pytest.mark.parametrize)

```python
import pytest

@pytest.mark.parametrize("price,expected_status", [
    (0, 422),        # 必须大于 0
    (-1, 422),
    (0.01, 201),     # 边界:最小合法值
    (99999, 201),
])
def test_price_validation(client, price, expected_status):
    resp = client.post("/items", json={"name": "x", "price": price})
    assert resp.status_code == expected_status
```

### 测试需要登录的接口:依赖覆盖

```python
# tests/test_protected.py
from types import SimpleNamespace
from fastapi.testclient import TestClient
from app.deps import get_current_user
from app.main import app


def fake_user():
    return SimpleNamespace(id=1, username="test", role="admin")


@pytest.fixture
def auth_client():
    # 用假依赖替换真实认证,测试不再依赖真实 token
    app.dependency_overrides[get_current_user] = fake_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()          # 清理,防止污染其他测试


def test_me_endpoint(auth_client):
    resp = auth_client.get("/users/me")
    assert resp.status_code == 200
    assert resp.json()["username"] == "test"
```

### 测试真实登录流程(集成测试)

```python
def test_login_and_access(client):
    # 1. 注册
    r = client.post("/auth/register", json={
        "username": "alice", "email": "a@test.com", "password": "password123"
    })
    assert r.status_code == 201

    # 2. 登录拿 token
    r = client.post("/auth/login", data={"username": "alice", "password": "password123"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    # 3. 带 token 访问受保护接口
    r = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
```

### 测试数据库:策略与实现

**原则:测试绝不碰开发/生产库。**

两种主流策略:

| 策略 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| 独立测试库 | 每个测试会话建/删一套 SQLite/临时 PG | 隔离彻底、可测迁移 | 稍慢 |
| 事务回滚 | 每个测试开事务,结束回滚 | 快、共享数据准备简单 | 测不了事务逻辑本身 |

**独立测试库实现(SQLite 内存库 + 覆盖 get_db):**

```python
# tests/conftest.py(续)
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.database import Base, get_db
import app.models.user, app.models.post   # 注册所有模型

@pytest.fixture
async def test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with Session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    yield Session
    app.dependency_overrides.clear()
    await engine.dispose()
```

> SQLite 与 PG 行为有差异(JSON 查询、upsert 语法、并发锁),复杂项目用 **testcontainers** 起真 PostgreSQL 容器最贴近生产。

### 异步测试:pytest-asyncio

```python
# 直接测试异步函数(如 services 里的异步逻辑)
import pytest

@pytest.mark.asyncio
async def test_async_service(test_db):
    async with test_db() as session:
        result = await create_user(session, "alice", "a@x.com")
        assert result.username == "alice"
```

```ini
# pytest.ini 加 asyncio 模式配置
[pytest]
asyncio_mode = auto        # 自动识别 async 测试,无需标记
```

### Mock 外部服务:respx(httpx 官方 mock)

```python
import httpx
import respx

@respx.mock
async def test_call_external():
    # 拦截对特定 URL 的请求,返回假响应
    respx.get("https://api.example.com/data").mock(
        return_value=httpx.Response(200, json={"value": 42})
    )
    async with httpx.AsyncClient() as client:
        r = await client.get("https://api.example.com/data")
        assert r.json() == {"value": 42}
    assert respx.calls[0].request.url == "https://api.example.com/data"
```

`respx` 也可配合 TestClient 使用:路由里用 `httpx.AsyncClient` 调外部接口时,`respx.mock` 会把它们全部拦截,无需真实网络。

### TestClient 细节参数

```python
# raise_server_exceptions=False:服务端异常不抛出,而是返回 500 响应(便于断言)
with TestClient(app, raise_server_exceptions=False) as c:
    resp = c.get("/buggy")
    assert resp.status_code == 500

# base_url:模拟通过某个域名访问
client = TestClient(app, base_url="http://testserver")
```

### 覆盖率

```bash
pytest --cov=app tests/ --cov-report=term-missing
# 或生成 HTML 报告
pytest --cov=app tests/ --cov-report=html
```

**测试分层与投入建议:**

1. **单元测试**:纯函数、Pydantic 校验器、业务服务 —— 便宜、稳定,大量写
2. **接口测试**(TestClient):路由行为、状态码、校验失败路径 —— 中量
3. **集成测试**:真实数据库 + 真实依赖链 —— 少量、覆盖核心流程
4. 不追求 100% 覆盖率;优先覆盖**核心业务 + 易错边界**(分页、金额、权限、并发)

## 7.2 CI:GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov ruff
      - name: Lint
        run: ruff check app tests
      - name: Test
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/testdb
          SECRET_KEY: ci-secret
        run: pytest --cov=app --cov-report=term-missing
```

**CI 的价值:** 每个 PR 自动跑 lint + 测试,防止合并坏代码;配合分支保护规则,测试不过不允许合并。

## 7.3 生产部署总览

```
                        ┌───────────────────────────────────┐
  用户 ── HTTPS ──▶ CDN/WAF ──▶ Nginx(反向代理/负载均衡/限流/静态文件)
                        └──────────┬────────────────────────┘
                                   │
                   ┌───────────────┼────────────────┐
                   ▼               ▼                ▼
          Gunicorn worker 进程(多个,每个内部跑一个 Uvicorn 事件循环)
          ├─ worker1: 127.0.0.1:8001
          ├─ worker2: 127.0.0.1:8002
          └─ worker3: 127.0.0.1:8003
                                   │
                                   ▼
                          PostgreSQL / Redis
```

**核心思路:** Uvicorn 单进程单事件循环,只能用一个 CPU 核。生产环境用 **Gunicorn 管理多个 Uvicorn worker 进程**吃满多核,Nginx 在前面做负载均衡、HTTPS 终止、静态文件与限流。

## 7.4 配置文件与多环境管理

```python
# core/config.py —— pydantic-settings 读取环境变量
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "MyAPI"
    secret_key: str                          # 必填,缺失启动即报错
    database_url: str
    debug: bool = False
    cors_origins: list[str] = []             # 自动解析 JSON 字符串环境变量
    model_config = {"env_file": ".env"}      # .env 文件内容会被自动读取

settings = Settings()
```

```bash
# .env(不要提交到 git,提供 .env.example 模板)
SECRET_KEY=xxxx
DATABASE_URL=postgresql+asyncpg://...
DEBUG=false
```

```bash
pip install pydantic-settings
```

**多环境方案:** 开发用 `.env`;测试 CI 里用环境变量注入;生产用服务器环境变量或密钥管理服务。**关键点:配置校验前移 —— 缺失的必填配置在启动时直接报错,而不是运行时才炸。**

## 7.5 Gunicorn 多进程部署

```bash
pip install gunicorn
```

### 命令行启动

```bash
# 4 个 worker,每个 worker 内部跑一个 uvicorn 事件循环
gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
```

### 配置文件启动(推荐)

```python
# gunicorn.conf.py
import multiprocessing

bind = "0.0.0.0:8000"
workers = multiprocessing.cpu_count() * 2 + 1   # 经验公式,按压测调整
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 30                    # worker 无响应超时(秒),长请求调大
graceful_timeout = 30           # 优雅退出等待(处理完存量请求)
keepalive = 5                   # HTTP keep-alive 秒数
accesslog = "-"                 # 访问日志到 stdout
errorlog = "-"
loglevel = "info"
max_requests = 1000             # worker 处理 N 个请求后重启(缓解内存泄漏)
max_requests_jitter = 50        # 加上随机抖动,避免同时重启
```

```bash
gunicorn -c gunicorn.conf.py main:app
```

### workers 数量怎么定?

- CPU 密集型:核心数(超线程不建议算翻倍)
- IO 密集型(Web 服务常见):核心数 × 2~4,以压测为准
- Gunicorn 官方经验公式:`2 * CPU核心数 + 1`
- 别贪多:每个 worker 都占内存(约 100~300MB+),worker 过多会内存耗尽、上下文切换拖慢
- **压测定案:** 用 oha/wrk 打真实接口,逐个尝试 2/4/8 worker,取延迟和吞吐的拐点

### 常用信号

| 信号 | 作用 |
| --- | --- |
| `HUP` | 优雅重启:起新 worker,旧 worker 处理完存量请求后退出(**不停机发版**) |
| `TERM` | 优雅停止 |
| `TTIN` / `TTOU` | 增加 / 减少 worker 数(动态扩容) |

```bash
kill -HUP $(cat /var/run/gunicorn.pid)
```

### uvicorn --workers vs gunicorn + uvicorn worker

- `uvicorn --workers N`:内置多进程,简单,但重启粒度粗、管理功能少
- `gunicorn + UvicornWorker`:进程管理成熟(平滑重启、动态伸缩、信号完备),**生产推荐**

## 7.6 Docker 部署

### Dockerfile(多阶段构建)

```dockerfile
# ---- 构建阶段:安装依赖 ----
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- 运行阶段:精简镜像 ----
FROM python:3.12-slim

WORKDIR /app

# 只拷贝装好的依赖,不携带编译器残留
COPY --from=builder /install /usr/local
COPY . .

# 非 root 用户运行(安全最佳实践)
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

CMD ["gunicorn", "main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000"]
```

`.dockerignore`:

```text
__pycache__/
*.pyc
venv/
.env
.git/
tests/
docs/
```

### requirements.txt(锁版本示例)

```text
fastapi==0.115.*
uvicorn[standard]==0.34.*
gunicorn==23.*
sqlalchemy==2.0.*
asyncpg==0.30.*
pydantic-settings==2.*
python-jose[cryptography]==3.*
"passlib[bcrypt]"==1.7.*
httpx==0.28.*
alembic==1.*
```

> 生产必须锁版本(或 `uv lock`/`poetry.lock`),否则镜像构建不可复现,今天能跑明天装到不兼容版本。

### docker-compose.yml(API + PostgreSQL + Redis)

```yaml
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://app:secret@db:5432/appdb
      SECRET_KEY: ${SECRET_KEY}
      REDIS_URL: redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: appdb
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

volumes:
  pgdata:
```

```bash
docker compose up -d --build
docker compose logs -f api          # 看日志
docker compose exec api alembic upgrade head   # 跑迁移
```

> **迁移时机:** 建议入口脚本里先 `alembic upgrade head` 再启动 gunicorn,保证容器起来就是新结构(配合 04 章"先加列后删列"策略可滚动发布)。

### 镜像瘦身与安全

- 多阶段构建(见上),slim/alpine 基础镜像
- `pip install --no-cache-dir`
- 非 root 运行、`docker scan` 扫漏洞
- 固定基础镜像 tag(`python:3.12-slim` 而非 `latest`)

## 7.7 Nginx 反向代理

`/etc/nginx/conf.d/api.conf`:

```nginx
upstream fastapi_backend {
    server 127.0.0.1:8000;          # gunicorn 监听地址
    keepalive 32;                    # 与后端保持长连接
}

server {
    listen 80;
    server_name api.example.com;

    client_max_body_size 100M;       # 大文件上传限制(02 章呼应)
    client_body_timeout 60s;

    # gzip 压缩
    gzip on;
    gzip_types application/json text/plain;
    gzip_min_length 1024;

    # 接口限流:每个 IP 每秒最多 20 个请求,突发 30
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;
    limit_req zone=api_limit burst=30 nodelay;

    location / {
        limit_req zone=api_limit burst=30 nodelay;
        proxy_pass http://fastapi_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_http_version 1.1;
    }

    # WebSocket 代理(03 章)
    location /ws/ {
        proxy_pass http://fastapi_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;    # 长连接不断
    }

    # 静态文件由 Nginx 直接服务,不走 Python
    location /static/ {
        alias /app/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**多实例负载均衡:**

```nginx
upstream fastapi_backend {
    least_conn;                      # 最少连接策略(长请求场景)
    # ip_hash;                       # 会话黏滞(需要时)
    server 10.0.0.2:8000;
    server 10.0.0.3:8000;
    keepalive 64;
}
```

HTTPS(Let's Encrypt 免费证书):

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com   # 自动配置证书 + 续期
# 验证自动续期:
sudo certbot renew --dry-run
```

```nginx
# certbot 配置后追加安全头
add_header Strict-Transport-Security "max-age=31536000" always;
```

## 7.8 systemd 守护进程(裸机部署)

`/etc/systemd/system/myapi.service`:

```ini
[Unit]
Description=My FastAPI Service
After=network.target

[Service]
User=appuser
Group=appuser
WorkingDirectory=/srv/myapi
EnvironmentFile=/srv/myapi/.env
ExecStart=/srv/myapi/venv/bin/gunicorn -c /srv/myapi/gunicorn.conf.py main:app
Restart=always
RestartSec=3
# 限制资源
LimitNOFILE=65536
MemoryMax=2G

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now myapi      # 开机自启 + 立即启动
sudo systemctl status myapi
journalctl -u myapi -f                 # 实时日志
sudo systemctl restart myapi           # 重启(平滑发版用 kill -HUP 更好)
```

## 7.9 平滑发布流程

**目标:发版不停机。**

```
1. 部署新代码到新目录 /srv/myapi-v2(或拉新 Docker 镜像)
2. 确保新代码兼容当前数据库结构(加列优先,不删列)
3. 跑迁移:alembic upgrade head(向前兼容)
4. 切换:kill -HUP gunicorn → 新 worker 起来、旧 worker 处理完存量退出
5. 健康检查验证 /health
6. 观察错误率/延迟,异常则回滚:
   代码回滚到 v1 → alembic downgrade(如果迁移可回)
```

**Kubernetes 场景**则是标准滚动更新:`kubectl set image` → 新 Pod 就绪探针通过 → 逐步替换旧 Pod。

## 7.10 监控与可观测性

### 健康检查端点

```python
@app.get("/health")
def health():
    return {"status": "ok"}          # 存活探针:进程活着即可

@app.get("/ready")
async def ready():
    # 就绪探针:依赖(数据库)可用才接入流量
    try:
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(503, "database unreachable")
```

### 结构化日志(JSON)

```python
import logging, json, time
from fastapi import Request

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            entry["request_id"] = record.request_id
        return json.dumps(entry, ensure_ascii=False)

handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger("myapi")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    logger.info(
        "%s %s -> %s (%.0fms)",
        request.method, request.url.path, response.status_code,
        (time.perf_counter() - start) * 1000,
    )
    return response
```

> 生产建议:JSON 日志交给 ELK / Loki 采集;关键业务事件结构化记录(谁、何时、干了什么、结果如何);**脱敏**(06 章)。

### 错误监控:Sentry

```bash
pip install sentry-sdk
```

```python
import sentry_sdk

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,          # 环境变量注入
    traces_sample_rate=0.1,           # 采样 10% 的性能追踪
    environment=settings.env,         # production/staging
)

# 中间件/exception_handler 捕获到异常时,SDK 自动上报;
# 也可手动上报:
# try:
#     risky_operation()
# except Exception:
#     sentry_sdk.capture_exception()
```

### 指标:Prometheus

```bash
pip install prometheus-fastapi-instrumentator
```

```python
from prometheus_fastapi_instrumentator import Instrumentator

instrumentator = Instrumentator(
    should_group_status_codes=False,
    excluded_handlers=["/metrics", "/health"],
)
instrumentator.instrument(app).expose(app, endpoint="/metrics")
# 默认指标:请求量、延迟直方图、状态码分布 —— Grafana 直接建面板
```

### 压测工具

```bash
# oha:50 并发、持续 30 秒、输出延迟分位
oha -c 50 -z 30s http://api.example.com/items

# wrk:老牌工具
wrk -t4 -c100 -d30s http://api.example.com/items

# locust:Python 编写场景,分布式压测
```

**性能排查工具:** `py-spy top -p &lt;pid&gt;` 看 CPU 热点;`py-spy dump` 看卡在哪;数据库侧 `EXPLAIN ANALYZE`(04 章)。

## 7.11 性能调优清单

1. **全异步链路**:异步引擎 + `httpx.AsyncClient` + async 路由(05 章)
2. **连接池复用**:数据库引擎、HTTP client 全局单例,不每请求创建
3. **消灭 N+1**:`selectinload` 预加载关联(04 章)
4. **响应压缩**:GZipMiddleware(03 章)或 Nginx gzip
5. **静态文件交给 Nginx/CDN**,别让 Python 服务
6. **合理 worker 数** + 压测验证,而不是拍脑袋
7. **缓存热点数据**:Redis 缓存高频查询(用户信息、配置):

```python
import redis.asyncio as aioredis
import json

@app.get("/users/{user_id}/profile")
async def user_profile(user_id: int, request: Request):
    redis = request.app.state.redis
    cached = await redis.get(f"user:{user_id}:profile")
    if cached:
        return json.loads(cached)                    # 命中缓存直接返回
    profile = await load_profile_from_db(user_id)
    await redis.set(f"user:{user_id}:profile", json.dumps(profile), ex=300)
    return profile
```

8. **慢查询治理**:加索引、`EXPLAIN` 验证、必要时反范式化
9. **避免同步阻塞混入 async 路由**(05 章最大坑)
10. **Pydantic 响应校验开销**:极高 QPS 场景可对只读接口考虑关闭 `response_model` 的二次校验(用 `return` dict + 文档声明),先压测再决定

## 7.12 常见生产事故与预防

| 事故 | 根因 | 预防 |
| --- | --- | --- |
| 内存缓慢增长直到 OOM | worker 内存泄漏 | `max_requests` 定期重启 worker;py-spy 找泄漏点 |
| 连接池耗尽,请求排队超时 | 连接泄漏/并发过高 | `pool_pre_ping`、session 及时关闭、压测定容量 |
| 数据库连接断开报错 | 空闲连接被库端回收 | `pool_recycle`、`pool_pre_ping` |
| 上游接口挂掉拖垮自己 | 无超时/无限重试 | httpx 超时必设、熔断器、降级返回兜底数据 |
| 磁盘被日志写满 | 无日志轮转 | logrotate、日志级别控制、日志集中采集 |
| 发版后大面积 500 | 迁移与代码不同步 | CI 跑测试、金丝雀/灰度、可回滚 |
| 重复下单/扣款 | 网络重试无幂等 | 幂等键、唯一约束、事务(04 章) |

## 7.13 上线检查清单

**发布前:**

- [ ] `DEBUG` 关闭,`.env` 不进 git,`SECRET_KEY` 生产独立随机值
- [ ] `--reload` 已去掉(监听文件变动,拖慢生产)
- [ ] CORS 白名单收紧(03 章)
- [ ] 依赖版本锁定(requirements.lock / poetry.lock / uv.lock)
- [ ] 数据库迁移已跑(`alembic upgrade head`),脚本人工审查过
- [ ] 健康检查端点可用,限流配置生效
- [ ] 日志不含敏感信息(密码、token)
- [ ] HTTPS 证书有效且自动续期
- [ ] 压测过目标 QPS,worker 数、连接池、超时参数有据可依
- [ ] 异常上报(Sentry)+ 指标(Prometheus)已接入

**上线后:**

- [ ] 监控告警:错误率、P99 延迟、内存/CPU、磁盘、数据库连接数
- [ ] 灰度发布/回滚预案已演练
- [ ] 数据库备份与恢复演练定期进行
