# 06 安全与认证

本章实现最常用的后端认证方案:**JWT(JSON Web Token)+ OAuth2 Password 流程**,并覆盖密码哈希、权限控制、限流、安全头与常见攻击防护。

## 6.1 密码哈希

**绝不存储明文密码。** 密码只以哈希形式入库,验证时重新计算比对。

### 哈希算法选择

| 算法 | 特点 | 推荐度 |
| --- | --- | --- |
| **bcrypt** | 自带盐、可调计算成本,久经考验 | ✅ 首选 |
| **argon2** | 2015 年密码哈希竞赛冠军,抗 GPU 破解更强 | ✅ 推荐(新项目) |
| PBKDF2 | 标准、兼容性好,抗 GPU 弱于前两者 | 可用 |
| MD5 / SHA-1 / SHA-256(裸用) | **快,可被暴力破解,严禁** | ❌ 禁用 |

> **为什么裸哈希不行?** SHA-256 每秒可算数十亿次,攻击者用彩虹表/暴力破解瞬间还原常见密码。bcrypt/argon2 故意"慢"(每个哈希 0.1~0.3 秒)且自动加盐 —— 每次哈希随机盐,相同密码哈希结果不同,直接废掉彩虹表。

### bcrypt 实现

```bash
pip install "passlib[bcrypt]"
```

```python
# core/security.py
from passlib.context import CryptContext

# schemes 列表按顺序尝试,deprecated 标记旧算法
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# 用法:
# hashed = hash_password("secret123")     # $2b$12$eImiTXuWVxfM37uY4JANjQ...
# verify_password("secret123", hashed)    # True
# verify_password("wrong", hashed)        # False
```

> ⚠️ passlib 1.7.4 与新版 bcrypt(4.1+)有兼容性告警,不影响功能;若嫌烦,可直接用 `bcrypt` 库原生 API。**哈希升级策略:** 登录验证通过后检查 `pwd_context.needs_update(hashed)`,需要时用新算法重新哈希覆盖旧值 —— 让老用户的密码在登录时平滑升级。

### 密码策略建议

- 最小长度 8 位(重要系统 12+),建议大小写+数字组合(02 章 validator 实现)
- 拒绝常见弱密码(查字典、与用户名相同)
- 登录失败限流 + 延迟响应(6.10 节),防爆破
- 明文密码只出现在"注册/登录"两个入口,日志、响应、数据库一律不得出现

## 6.2 JWT 基础与原理

### 结构:三段 Base64

```text
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSIsImV4cCI6MTczNTc0NzIwMH0.签名
└────── header ──────┘└────────── payload ──────────┘└── signature ──┘
```

- **header**:`{"alg": "HS256", "typ": "JWT"}`,声明签名算法
- **payload**:自定义数据(用户 id、过期时间)。Base64 编码,**不是加密,任何人可解码读取 —— 不要放敏感信息!**
- **signature**:`HMAC-SHA256(header + "." + payload, SECRET_KEY)`。密钥只有服务端知道,任何人篡改 payload 都会导致验签失败

### 签名算法对比

| 算法 | 机制 | 特点 |
| --- | --- | --- |
| HS256(HMAC) | 单一密钥签名+验证 | 简单,密钥必须严格保密(推荐大多数场景) |
| RS256(RSA) | 私钥签名、公钥验证 | 微服务间可共享公钥验签,私钥只在签发方 |

### payload 标准字段(claims)

| 字段 | 含义 |
| --- | --- |
| `sub` | subject,主体,通常放用户 id |
| `exp` | 过期时间(Unix 秒),**必须校验** |
| `iat` | 签发时间 |
| `nbf` | 在此之前不可用 |
| `iss` / `aud` | 签发者 / 受众(多服务间防串用) |

### 签发与校验实现

```bash
pip install "python-jose[cryptography]"
```

```python
# core/security.py(续)
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt

SECRET_KEY = "你的超长随机密钥,生产环境放环境变量!"    # 生成:openssl rand -hex 32
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """签发 token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    """校验签名与过期时间并解析,失败抛 JWTError"""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
```

> `SECRET_KEY` 泄露 = 任何人都能伪造 token。生产环境必须放环境变量/密钥管理服务(07 章的 pydantic-settings),禁止写死在代码/提交到 git。**泄漏后的处置:** 立即轮换密钥 —— 后果是所有已签发 token 全部失效,用户需重新登录(比被冒用强)。

## 6.3 OAuth2 Password 流程

OAuth2 是授权协议,"Password 模式"(资源所有者密码凭证)适合自家前端直连后端的场景:前端把用户名密码交给后端,后端验证后发 token。

```text
┌────────┐  (1) POST /auth/login  username+password      ┌────────┐
│  前端  │ ────────────────────────────────────────────▶ │ 后端   │
│        │                                               │        │
│        │  (2) {access_token, token_type}               │ 校验密码│
│        │ ◀──────────────────────────────────────────── │ 签发JWT│
│        │                                               └────────┘
│        │  (3) GET /users/me  Authorization: Bearer xxx ┌────────┐
│        │ ────────────────────────────────────────────▶ │ 后端   │
│        │                                               │ 验签   │
│        │  (4) 用户数据                                 │ 查用户 │
│        │ ◀──────────────────────────────────────────── │        │
└────────┘                                               └────────┘
```

### 登录接口实现

```python
# routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from core.security import verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["认证"])

# tokenUrl:登录接口路径;Swagger 文档右上角会出现 Authorize 按钮,
# 填完账号密码后自动在所有请求上带 Authorization: Bearer <token>
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    """登录接口,返回 access_token。
    注意:这是表单(form-data)提交,不是 JSON。
    固定字段:username、password(可带 scope、grant_type、client_id、client_secret)
    """
    user = await get_user_by_username(form.username)      # 查数据库
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误",
                            headers={"WWW-Authenticate": "Bearer"})

    token = create_access_token({"sub": str(user.id), "username": user.username})
    return {"access_token": token, "token_type": "bearer"}
```

```bash
curl -X POST http://127.0.0.1:8000/auth/login \
  -d "username=alice&password=secret123"
# {"access_token":"eyJhbGci...","token_type":"bearer"}
```

## 6.4 认证依赖:解析 token 拿当前用户

```python
# deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from core.security import decode_token
from core.database import async_session
from models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """校验 Bearer token,返回当前用户 ORM 对象"""
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="登录已失效,请重新登录",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error

    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_error
    return user
```

> `oauth2_scheme` 做两件事:从 `Authorization: Bearer xxx` 头提取 token;没带 token 时自动返回 401。注意它**不校验 token 内容**,校验在 `get_current_user` 里做。另外每次请求都查一次数据库是刻意的:**用户被禁用/删除后,旧 token 立即失效**;觉得浪费可加 Redis 缓存(注意缓存失效时机)。

### 保护接口

```python
@app.get("/users/me")
async def read_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username}
```

```bash
curl http://127.0.0.1:8000/users/me                              # 401
curl http://127.0.0.1:8000/users/me -H "Authorization: Bearer eyJhbGci..."  # 200
```

## 6.5 权限控制:角色与 scope

### 基于角色的依赖

```python
# deps.py(续)
def require_role(*allowed_roles: str):
    """依赖工厂:生成"校验指定角色"的依赖"""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="权限不足")
        return current_user
    return role_checker

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, admin: User = Depends(require_role("admin"))):
    # 只有 admin 能走到这里
    ...
```

### 基于 scope 的细粒度权限

OAuth2 的 scope 机制:签发 token 时声明权限范围,校验时比对:

```python
from fastapi.security import SecurityScopes

async def get_current_user_with_scopes(
    security_scopes: SecurityScopes,
    token: str = Depends(oauth2_scheme),
):
    """校验 token 里的 scope 是否覆盖接口要求的 scope"""
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(401, "token 无效", headers={"WWW-Authenticate": "Bearer"})

    token_scopes = payload.get("scopes", [])
    for scope in security_scopes.scopes:        # 接口声明要求的 scope
        if scope not in token_scopes:
            raise HTTPException(
                status_code=403,
                detail="权限不足,需要 scope: " + str(security_scopes.scopes),
                headers={"WWW-Authenticate": f'Bearer scope="{security_scopes.scope_str}"'},
            )
    return payload

# 接口声明所需 scope
@app.get("/users/me/items/", dependencies=[Depends(require_scope("items:read"))])
def read_own_items(current_user=Depends(get_current_user_with_scopes)):
    ...
```

登录时按用户角色签发对应 scope:

```python
@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    ...
    scopes = ["items:read"] if user.role == "user" else ["items:read", "items:write", "admin"]
    token = create_access_token({"sub": str(user.id), "scopes": scopes})
    return {"access_token": token, "token_type": "bearer"}
```

**状态码语义:** 401 = 未认证(没带 token / token 无效);403 = 已认证但无权限。

## 6.6 注册接口完整闭环

```python
# routers/auth.py(续)
from pydantic import BaseModel, EmailStr, field_validator

class RegisterIn(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str):
        if len(v) < 8:
            raise ValueError("密码至少 8 位")
        if not any(c.isdigit() for c in v):
            raise ValueError("密码必须包含数字")
        return v

@router.post("/register", status_code=201)
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db)):
    # 查重
    result = await db.execute(select(User).where(User.username == payload.username))
    if result.scalar_one_or_none():
        raise HTTPException(409, "用户名已存在")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),   # 哈希后入库
    )
    db.add(user)
    await db.commit()
    return {"message": "注册成功", "user_id": user.id}
```

## 6.7 Refresh Token 与登出

### 刷新令牌:短 access + 长 refresh

`access_token` 有效期短(15~30 分钟),过期后用 `refresh_token`(7~30 天)换新,避免频繁登录:

```python
@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await get_user_by_username(form.username)
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "用户名或密码错误")

    return {
        "access_token": create_access_token(
            {"sub": str(user.id), "type": "access"},
            expires_delta=timedelta(minutes=30),
        ),
        "refresh_token": create_access_token(
            {"sub": str(user.id), "type": "refresh"},
            expires_delta=timedelta(days=7),
        ),
        "token_type": "bearer",
    }

@router.post("/refresh")
async def refresh(token: str):
    """用 refresh token 换新的 access token"""
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(401, "refresh token 无效")
    if payload.get("type") != "refresh":
        raise HTTPException(401, "必须使用 refresh token")
    return {
        "access_token": create_access_token(
            {"sub": payload["sub"], "type": "access"},
            expires_delta=timedelta(minutes=30),
        )
    }
```

### 登出:黑名单方案

JWT 无状态,签出的 token 在过期前一直有效。需要"立即失效"时,用 Redis 维护黑名单:

```python
# deps.py
import redis.asyncio as aioredis

redis_client = aioredis.from_url("redis://localhost:6379/0")   # lifespan 里初始化

async def is_blacklisted(jti: str) -> bool:
    return await redis_client.exists(f"blacklist:{jti}") > 0

# 签发 token 时放入唯一 jti(04 章不用动,签发处加):
# to_encode["jti"] = str(uuid.uuid4())

# get_current_user 里加一步:
# if await is_blacklisted(payload.get("jti", "")):
#     raise credentials_error

@router.post("/logout")
async def logout(token: str = Depends(oauth2_scheme)):
    """把当前 token 加入黑名单直到它自然过期"""
    payload = decode_token(token)
    jti = payload.get("jti")
    ttl = payload["exp"] - int(time.time())     # 黑名单只需存到过期
    await redis_client.set(f"blacklist:{jti}", "1", ex=max(ttl, 1))
    return {"message": "已登出"}
```

### JWT 的固有局限与应对

| 问题 | 说明 | 应对 |
| --- | --- | --- |
| 无法主动失效 | token 签出后到过期前一直有效 | 短有效期 + refresh token;黑名单(登出/封禁) |
| 登出难 | 无状态 | 客户端删 token + 服务端黑名单 |
| payload 可被读取 | 只签名不加密 | 不放大权限之外的敏感信息 |
| 密钥管理难 | 泄露即沦陷 | 环境变量、密钥服务、定期轮换 |

> 需要"随时踢人下线"的强会话控制,可考虑改用**服务端 Session**(Redis 存会话)+ Cookie,或 OAuth2 授权码模式接第三方登录。

## 6.8 API Key 认证(机器间调用)

服务间调用、开放平台常用 API Key。**Key 要像密码一样哈希存储**,只展示一次:

```python
import secrets
from fastapi import Header, HTTPException

def generate_api_key() -> tuple[str, str]:
    """返回 (明文 key, 哈希后的 key)。明文只返回给用户一次"""
    plain = "sk_" + secrets.token_urlsafe(32)
    return plain, hash_password(plain)      # 复用 bcrypt 哈希

async def verify_api_key(x_api_key: str = Header(alias="X-API-Key")):
    """从库里按 id 取哈希,再 verify。简化版直接比对环境变量"""
    if not verify_password(x_api_key, settings.API_KEY_HASH):
        raise HTTPException(401, "API Key 无效")
    return x_api_key

@app.get("/external/data")
async def external_data(key: str = Depends(verify_api_key)):
    return {"data": "..."}
```

```bash
curl http://127.0.0.1:8000/external/data -H "X-API-Key: sk_xxx"
```

**API Key 管理:** 支持多个 key(按用途/租户)、记录使用日志、可单独吊销、定期轮换。key 泄露特征:异常调用量、异常来源 IP,配合监控告警。

## 6.9 第三方 OAuth2 登录(微信/Google/GitHub)

标准授权码流程:

```text
1. 前端跳转第三方授权页(带上 client_id、redirect_uri)
2. 用户授权后,第三方 302 回调我方接口,URL 带 code
3. 后端拿 code 调第三方接口换 access_token
4. 用 access_token 拉用户信息(openid 等)
5. 按 openid 查/建本地用户,签发自己的 JWT
```

```python
# 以 GitHub 为例的简化实现
import httpx

@app.get("/auth/github/callback")
async def github_callback(code: str, request: Request):
    client = request.app.state.http_client
    # 1. code 换 access_token
    r = await client.post(
        "https://github.com/login/oauth/access_token",
        data={
            "client_id": settings.GITHUB_CLIENT_ID,
            "client_secret": settings.GITHUB_CLIENT_SECRET,
            "code": code,
        },
        headers={"Accept": "application/json"},
    )
    access_token = r.json()["access_token"]
    # 2. 拉用户信息
    r = await client.get("https://api.github.com/user",
                         headers={"Authorization": f"Bearer {access_token}"})
    profile = r.json()
    # 3. 绑定/创建本地用户
    user = await get_or_create_user_by_oauth("github", profile["id"], profile["login"])
    # 4. 签发自己的 token
    return {"access_token": create_access_token({"sub": str(user.id)})}
```

**要点:** `client_secret` 只存后端;回调地址要白名单校验(防 open redirect);`state` 参数防 CSRF(生成随机 state 存 session,回调比对);库选型可用 `authlib` 封装得更完整。

## 6.10 限流:防暴力破解与滥用

登录/短信/注册接口必须限流。简单实现用 `slowapi`:

```bash
pip install slowapi
```

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/auth/login")
@limiter.limit("5/minute")       # 每个 IP 每分钟最多 5 次
async def login(form: OAuth2PasswordRequestForm = Depends()):
    ...

@app.get("/public/data")
@limiter.limit("100/minute")
async def public_data(request: Request):
    ...
```

```python
# 或者 03 章的中间件版(内存版,单进程;多进程用 Redis 版)
# 生产建议:slowapi 配 Redis 存储,跨 worker 共享计数
limiter = Limiter(key_func=get_remote_address,
                  storage_uri="redis://localhost:6379/0")
```

**限流策略分层:**

- 登录/验证码:IP + 账号双维度(如每 IP 5 次/分,每账号 10 次/时)
- 公开读接口:IP 维度(100/分)
- 写接口:用户维度(防脚本刷数据)
- 全局限流:Nginx `limit_req`(07 章)在边缘再兜一层

## 6.11 安全响应头

```python
from fastapi import FastAPI, Request

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"          # 防 MIME 嗅探
    response.headers["X-Frame-Options"] = "DENY"                    # 防点击劫持
    response.headers["X-XSS-Protection"] = "0"                      # 交给 CSP
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # CSP(若服务 API 则非必须;服务 HTML 页面才关键)
    # response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response

# HSTS(强制 HTTPS)在 Nginx 层配置更合适:
# add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## 6.12 常见攻击与防护

| 攻击 | 原理 | 防护 |
| --- | --- | --- |
| SQL 注入 | 拼接 SQL 字符串 | 全部参数化查询/ORM(默认安全);杜绝 `f"SELECT ... {user_input}"` |
| XSS | 注入脚本到页面 | API 返回 JSON 时不直接执行;HTML 页面严格转义 + CSP |
| CSRF | 诱导用户浏览器跨站发起请求 | token 放 Header 天然免疫;Cookie 认证必须 CSRF token + SameSite |
| 点击劫持 | iframe 套壳诱导点击 | `X-Frame-Options: DENY` |
| 重放攻击 | 截获请求原样重发 | HTTPS + 时间戳/nonce + 幂等键;关键操作二次验证 |
| 暴力破解 | 无限试密码 | 限流 + 锁定 + 延迟响应 |
| 信息泄露 | 堆栈/路径暴露 | 生产关闭 debug、Exception 兜底 handler(03 章)、错误信息不透露内部细节 |
| 路径穿越 | `../../etc/passwd` | 文件名清洗(02 章)、路径白名单 |
| DDoS | 海量请求打挂服务 | 边缘防护(CDN/WAF)+ 限流 + 自动扩容 |

## 6.13 安全清单(上线前逐项核对)

- [ ] 密码 bcrypt/argon2 哈希,绝不明文/可逆加密
- [ ] `SECRET_KEY` 在环境变量,随机且足够长,不提交 git
- [ ] access token 短有效期(≤30min),配 refresh token(≤30 天)
- [ ] 接口按需鉴权,401/403 语义正确;角色/scope 权限用依赖校验
- [ ] 登录/注册/验证码接口限流(IP + 账号双维度)
- [ ] 生产环境全站 HTTPS + HSTS
- [ ] 安全响应头齐全(X-Content-Type-Options 等)
- [ ] 日志脱敏:不打印 token、密码、身份证号
- [ ] CORS 白名单(03 章),不放开 `*`
- [ ] SQL 全部参数化;上传文件名校验 + 大小限制
- [ ] 异常兜底不泄露堆栈;Sentry 监控错误率告警
- [ ] API Key 哈希存储、可吊销、有审计日志
