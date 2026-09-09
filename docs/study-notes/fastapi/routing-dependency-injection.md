# 03 路由与依赖注入

项目变大后,所有接口堆在一个 `main.py` 里不可维护。本章学习:**APIRouter 模块化拆分**、FastAPI 招牌的**依赖注入系统**(含内部缓存机制)、中间件、CORS、异常处理,以及 WebSocket 和子应用挂载。

## 3.1 APIRouter:模块化拆分路由

### 推荐的项目结构

```
myapp/
├── main.py                  # 入口:创建 app、挂载路由、注册中间件
├── routers/
│   ├── __init__.py
│   ├── users.py             # 用户模块
│   ├── items.py             # 商品模块
│   └── admin.py             # 管理后台
├── models/                  # Pydantic 模型(请求/响应结构)
│   ├── user.py
│   └── item.py
├── services/                # 业务逻辑层
│   ├── user_service.py
│   └── item_service.py
├── deps.py                  # 公共依赖(认证、数据库会话、分页)
└── core/
    ├── config.py            # 配置(环境变量)
    ├── database.py          # 数据库引擎/会话
    └── security.py          # 密码哈希、JWT
```

### 基本用法

`routers/users.py`:

```python
from fastapi import APIRouter

# prefix:该文件内所有路由统一前缀;tags:在文档中分组显示
router = APIRouter(prefix="/users", tags=["用户"])


@router.get("/")                       # 实际路径 /users/
def list_users():
    return [{"id": 1, "name": "alice"}]


@router.get("/{user_id}")              # 实际路径 /users/{user_id}
def get_user(user_id: int):
    return {"id": user_id, "name": "alice"}


@router.post("/", status_code=201)     # 创建成功返回 201
def create_user(name: str):
    return {"id": 2, "name": name}
```

`main.py`:

```python
from fastapi import FastAPI
from routers import users, items, admin

app = FastAPI()

app.include_router(users.router)
app.include_router(items.router)
app.include_router(admin.router)

# include_router 的常用参数:
app.include_router(
    users.router,
    prefix="/api/v1",            # 挂载时再统一加前缀(与 router 内 prefix 叠加)
    tags=["用户", "v1"],          # 追加标签(累加,不覆盖)
    dependencies=[Depends(verify_token)],   # 给整个 router 追加依赖
    include_in_schema=True,      # 是否出现在文档
    deprecated=False,            # 整组接口标记废弃
)
```

> **分层建议:** 路由层(router)只做参数校验和调用,业务逻辑放 `services/` 层,数据库操作通过依赖注入拿到 session。不要学小 demo 把逻辑全写在路由函数里 —— 逻辑进 services 才能复用和测试。

### APIRouter 构造参数速查

```python
router = APIRouter(
    prefix="/users",                     # 前缀,支持 {var} 占位
    tags=["用户"],                        # 文档分组
    dependencies=[Depends(check_admin)], # 本 router 下所有接口先执行
    responses={404: {"description": "资源不存在"}},  # 公共响应文档
    default_response_class=JSONResponse,
    include_in_schema=True,
    route_class=APIRoute,                # 高级:自定义路由类
)
```

### 嵌套 router:大项目分组

```python
# routers/admin/__init__.py
from fastapi import APIRouter
from .users import router as users_router
from .logs import router as logs_router

# 一个 router 可以挂其他 router
router = APIRouter(prefix="/admin", tags=["后台管理"])
router.include_router(users_router)     # 子前缀自动叠加
router.include_router(logs_router)
# 最终:app.include_router(admin.router) 一次挂载全部
```

### 路由级依赖:让某个 router 的所有接口都过一道校验

```python
def verify_token(x_token: str = Header()):
    if x_token != "expected-token":
        raise HTTPException(400, "X-Token 无效")
    return x_token

# dependencies=[Depends(verify_token)] → 该 router 下所有接口先执行此依赖
router = APIRouter(prefix="/users", tags=["用户"], dependencies=[Depends(verify_token)])
```

## 3.2 依赖注入(Dependency Injection)

**核心概念:** 路径操作函数需要什么"资源"(数据库会话、当前用户、分页参数、限流器),不自己创建,而是声明在参数里,由框架"注入"进来。好处:

- **复用**:几十个接口共享同一个"获取当前用户"逻辑,写一次到处用
- **解耦**:路由函数不需要知道"用户从哪来"(JWT?Session?Mock?)
- **可测试**:测试时用 `app.dependency_overrides` 替换真实依赖(03.7 节)

### 最简单的依赖:一个普通函数

```python
from fastapi import Depends, FastAPI

app = FastAPI()

def get_pagination(page: int = 1, size: int = 20):
    """把分页参数封装成可复用依赖。注意:依赖函数本身也能声明参数(自动解析)"""
    return {"page": page, "size": size, "offset": (page - 1) * size}


@app.get("/items")
def list_items(pagination: dict = Depends(get_pagination)):
    # pagination 由框架调用 get_pagination() 后注入
    return pagination
```

访问 `/items?page=3&size=10` → (&#123;"page":3,"size":10,"offset":20&#125;)。

### 依赖的链式嵌套

依赖里可以继续声明依赖,形成依赖树,每层结果都可注入:

```python
from fastapi import Header, HTTPException

def get_db_session():
    """伪代码:真实版本见 04 章数据库会话"""
    session = create_session()
    try:
        yield session          # 带 yield 的依赖 = 可清理资源
    finally:
        session.close()

def get_current_user(x_token: str = Header()):
    if x_token != "valid":
        raise HTTPException(status_code=401, detail="未登录")
    return {"username": "alice", "role": "admin"}

# 依赖函数声明 Depends 表示"我还要别的依赖"
def get_permission(current_user: dict = Depends(get_current_user)):
    return {"can_delete": current_user["role"] == "admin"}

@app.get("/profile")
def profile(user: dict = Depends(get_current_user), db=Depends(get_db_session)):
    return {"user": user}
```

依赖树示意图:

```
profile
 ├─ get_current_user (读取 Header)
 └─ get_db_session (yield → finally 关闭)
```

### 带 yield 的依赖:进入/退出逻辑

```python
# 类似上下文管理器:yield 之前 = 进入逻辑;yield 之后 = 退出逻辑(清理)
def get_db():
    db = DBSession()
    try:
        yield db
    finally:
        db.close()

@app.get("/data")
def read_data(db=Depends(get_db)):
    return db.query("SELECT 1")
```

执行时序:**进入逻辑 → 路由函数执行 → 响应发出后 → finally 清理**。常用于:数据库连接、临时文件、锁的释放。

```python
# 退出逻辑里可以捕获路由中抛出的异常(不吞掉,要 re-raise)
from contextlib import contextmanager

@contextmanager
def managed_resource():
    resource = acquire()
    try:
        yield resource
    except Exception as exc:
        print(f"请求处理失败,异常: {exc}")
        raise                       # 必须 re-raise,否则异常被吞
    finally:
        release(resource)
```

> **yield 依赖的坑:** ① yield 之后拿不到子依赖的返回值(Python 语法限制);② 依赖必须定义成 `contextmanager` 风格的 `try/finally`,否则异常时资源泄漏;③ 清理代码在响应发出**之后**执行,别在清理里改响应内容。

### 依赖缓存机制(use_cache)

**同一请求内,同一个依赖默认只执行一次**,结果被缓存复用:

```python
def get_db():
    print("创建 session")          # 一次请求内只打印一次
    return DBSession()

@app.get("/a")
def endpoint_a(db1=Depends(get_db), db2=Depends(get_db)):
    # db1 is db2 → True!两次 Depends(get_db) 拿到同一个对象
    return {"same": db1 is db2}
```

依赖链中的传递关系也算同一缓存:

```python
def dep_a(): return "A"
def dep_b(a=Depends(dep_a)): return a + "B"
def dep_c(a=Depends(dep_a)): return a + "C"

@app.get("/chain")
def chain(b=Depends(dep_b), c=Depends(dep_c)):
    # dep_a 只执行一次,b 和 c 共享同一个结果
    return {"b": b, "c": c}
```

需要每次都重新执行时,显式关闭缓存:

```python
@app.get("/nocache")
def nocache(db1=Depends(get_db, use_cache=False), db2=Depends(get_db, use_cache=False)):
    return {"same": db1 is db2}     # False,执行了两次
```

> 判断规则:**无 yield 的依赖**默认 `use_cache=True`;**带 yield 的依赖**无法缓存(每次都要执行完整的进入/退出)。绝大多数场景保持默认即可。

### 类作为依赖

```python
class Pagination:
    def __init__(self, page: int = 1, size: int = 20):
        self.page = page
        self.size = size
        self.offset = (page - 1) * size

@app.get("/orders")
def list_orders(p: Pagination = Depends(Pagination)):
    return {"page": p.page, "size": p.size, "offset": p.offset}
```

类依赖适合封装一组相关参数(分页、过滤条件)。FastAPI 调用 `Pagination(page=..., size=...)` 构造实例注入。

### Annotated 简化依赖写法

```python
from typing import Annotated

# 把"类型 + 依赖"打包成可复用别名
DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

@app.get("/users/me")
def read_me(db: DbSession, user: CurrentUser):     # 干净、可复用
    return {"user": user}
```

项目里把 `CurrentUser`、`DbSession` 等别名统一定义在 `deps.py`,路由签名既短又类型安全,是官方推荐风格。

### 全局依赖:应用级

```python
app = FastAPI(dependencies=[Depends(verify_token)])  # 所有接口都经过
```

> 注意:`dependencies` 里的依赖结果**不会注入**给路由函数,只执行"副作用"(如校验、记录)。需要拿返回值时要在路由参数里显式 `Depends()`。

### 依赖 vs 中间件的选择

| | 依赖注入 | 中间件 |
| --- | --- | --- |
| 执行时机 | 路由匹配**之后** | 路由匹配**之前** |
| 能拿到路径参数 | ✅ | ❌ |
| 结果可注入函数 | ✅ | ❌ |
| 适合 | 认证、权限、数据获取 | 日志、限流、统计、跨切面处理 |

### 依赖中的异常与安全

```python
from fastapi import HTTPException, Depends

def require_admin(current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "需要管理员权限")   # 异常自动中断请求链
    return current_user
```

依赖抛 `HTTPException` 会立即中断,后续依赖和路由函数都不执行,响应直接返回对应状态码 —— 这是认证/权限拦截的标准手法。

## 3.3 依赖覆盖:测试的杀手锏

`app.dependency_overrides` 按"原始依赖函数"为键替换实现:

```python
# tests 里
def fake_current_user():
    return {"username": "test_user", "role": "admin"}

app.dependency_overrides[get_current_user] = fake_current_user
# 之后所有 Depends(get_current_user) 都注入 fake 结果
# 测试完清理:
# app.dependency_overrides.clear()
```

```python
# 覆盖整个依赖树:替换顶层的 get_db,子依赖也随之替换
app.dependency_overrides[get_db] = override_get_db
```

配合 pytest fixture 的完整用法见 07 章。**这是依赖注入系统的核心收益:测试时无需真的登录、连库,一键换成假数据。**

## 3.4 中间件(Middleware)

中间件在**请求进入路由前**和**响应返回客户端前**执行,适合跨切面逻辑:日志、耗时统计、限流、统一响应头。

### 基础:耗时统计中间件

```python
import time
from fastapi import FastAPI, Request

app = FastAPI()

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """统计每个请求耗时并写入响应头"""
    start = time.perf_counter()
    response = await call_next(request)      # 继续执行后续中间件和路由
    process_time = time.perf_counter() - start
    response.headers["X-Process-Time"] = str(process_time)
    return response
```

### 例子一:全局异常兜底

```python
from fastapi.responses import JSONResponse

@app.middleware("http")
async def catch_all(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        print(f"未捕获异常: {e}")           # 记日志
        return JSONResponse(status_code=500, content={"detail": "服务器内部错误"})
```

> 更规范的异常处理用 `@app.exception_handler`(3.6 节),中间件兜底只作为最后防线。

### 例子二:请求 ID 贯穿日志

```python
import uuid

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    request.state.request_id = request_id      # 存进 state,路由里可取
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response

# 路由里读取:
@app.get("/echo-id")
def echo_id(request: Request):
    return {"request_id": request.state.request_id}
```

### 例子三:基于内存的简单限流

```python
from collections import defaultdict
import time

buckets = defaultdict(list)     # 生产环境换成 Redis(06 章)

@app.middleware("http")
async def rate_limit(request: Request, call_next):
    ip = request.client.host
    now = time.time()
    # 清理 60 秒窗口外的记录
    buckets[ip] = [t for t in buckets[ip] if now - t < 60]
    if len(buckets[ip]) >= 100:
        return JSONResponse(status_code=429, content={"detail": "请求过于频繁"})
    buckets[ip].append(now)
    return await call_next(request)
```

### 中间件注意事项

1. 按**注册顺序**执行:先注册的先处理请求、后处理响应(洋葱模型)
2. `call_next` 之前是"请求阶段",之后是"响应阶段"
3. 用 `@app.middleware("http")` 的写法**必须 `async def` + 非阻塞**(阻塞会卡死事件循环,见 05 章)
4. 需要读/改响应体(如压缩、加密)时,`@app.middleware("http")` 拿到的 response 是流式的,要先 `await response.body()` 缓存;复杂场景用 `BaseHTTPMiddleware` 或纯 ASGI 中间件
5. 中间件在路由解析之前运行,拿不到路径参数

### 纯 ASGI 中间件(最灵活)

```python
from starlette.middleware.base import BaseHTTPMiddleware

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Process-Time"] = str(time.perf_counter() - start)
        return response

app.add_middleware(TimingMiddleware)
```

> 注意:`BaseHTTPMiddleware` 每次请求都会产生小量开销(构造请求/响应包装),高频中间件(日志、统计)优先用 `@app.middleware("http")` 形式。

### 第三方中间件接入

```python
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)              # 响应 >1KB 自动压缩
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["api.example.com"])  # 防 Host 头攻击
app.add_middleware(HTTPSRedirectMiddleware)                        # 全站强制 HTTPS
```

## 3.5 CORS 跨域配置

前后端分离时,浏览器会拦截跨域请求(不同源:协议/域名/端口任一不同)。配置允许的前端来源:

```python
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://app.example.com"],  # 允许的前端地址
    allow_origin_regex=r"https://.*\.example\.com",   # 或用正则(与 allow_origins 二选一)
    allow_credentials=True,        # 允许携带 Cookie(此时 allow_origins 不能是 ["*"])
    allow_methods=["*"],           # 允许的 HTTP 方法,或 ["GET", "POST"]
    allow_headers=["*"],           # 允许的请求头
    expose_headers=["X-Process-Time", "X-Request-Id"],  # 让前端 JS 能读到这些响应头
    max_age=600,                   # 预检请求缓存秒数
)
```

**CORS 预检(Preflight)原理:**

1. 浏览器发现"跨域 + 非简单请求"(如带自定义头、Content-Type 为 application/json 的 PUT/DELETE)
2. 先发一个 `OPTIONS` 请求询问服务器是否允许
3. 服务器返回 `Access-Control-Allow-*` 头,浏览器确认后才发真实请求
4. FastAPI 的 CORSMiddleware 自动处理 OPTIONS 预检,你无需写 `@app.options`

> 调试阶段图省事可用 `allow_origins=["*"]` 配合 `allow_credentials=False`;生产环境务必写死具体域名。另外注意:**CORS 是浏览器机制**,curl/Postman 不受限制;服务端对敏感接口的防护靠认证(06 章),不能依赖 CORS。

## 3.6 异常处理

### 主动抛业务异常:HTTPException

```python
from fastapi import HTTPException, status

@app.get("/items/{item_id}")
def get_item(item_id: int):
    if item_id <= 0:
        raise HTTPException(status_code=404, detail="商品不存在")
    return {"item_id": item_id}
```

返回给客户端:(&#123;"detail": "商品不存在"&#125;),状态码 404。附加自定义响应头:

```python
raise HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="token 过期",
    headers={"WWW-Authenticate": "Bearer"},   # 认证场景标准头(06 章)
)
```

### 自定义业务异常类 + 处理器(全局统一错误格式)

```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI()

class BusinessError(Exception):
    """自定义业务异常"""
    def __init__(self, message: str, code: int = 40000):
        self.message = message
        self.code = code

@app.exception_handler(BusinessError)
async def business_error_handler(request: Request, exc: BusinessError):
    return JSONResponse(
        status_code=400,
        content={"code": exc.code, "message": exc.message, "success": False},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """覆盖 FastAPI 默认的 {"detail": ...} 格式"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.status_code, "message": exc.detail, "success": False},
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """兜底:捕获所有未处理异常,避免把堆栈暴露给客户端"""
    # 记日志 + 上报 Sentry(07 章)
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": "服务器内部错误", "success": False},
    )

@app.get("/business")
def business():
    raise BusinessError("库存不足")
```

> 定义 `Exception` 兜底后,**调试时注意**:所有错误都会被吞掉,handler 里务必 `print(exc)` / 记日志 / 上报 Sentry,否则线上排障两眼一抹黑。

### 自定义校验错误(422)格式

```python
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    # exc.errors() 每项含 type/loc/msg/input(02 章详述)
    messages = [f"{'.'.join(str(x) for x in e['loc'])}: {e['msg']}" for e in exc.errors()]
    return JSONResponse(
        status_code=422,
        content={"code": 422, "message": "; ".join(messages), "success": False},
    )
```

```json
// 客户端收到的效果:
{"code": 422, "message": "body.price: Input should be greater than 0", "success": false}
```

### 404 与 405 的全局处理

```python
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def not_found_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return JSONResponse(status_code=404, content={"code": 404, "message": "接口不存在", "success": False})
    return JSONResponse(status_code=exc.status_code, content={"code": exc.status_code, "message": str(exc.detail)})
```

> 细节:路由不匹配时抛的是 **Starlette** 的 `HTTPException`(不是 FastAPI 的),要统一格式需要像上面这样单独注册 handler。405(方法不允许)也走 Starlette 异常。

### 异常处理小结

- `HTTPException` → 业务逻辑中的预期错误(404、401、403、409...)
- `RequestValidationError` → 参数校验失败(422),可定制格式
- `BusinessError` 自定义类 → 团队统一错误码体系
- `Exception` handler → 兜底,配合日志/监控

## 3.7 路径操作函数参数总结(声明方式速查)

| 参数来源 | 声明方式 | 示例 |
| --- | --- | --- |
| 路径参数 | 同名函数参数(在路径中有 `&#123;x&#125;`) | `def f(item_id: int)` |
| 查询参数 | 非路径参数且是标量类型 | `def f(page: int = 1)` |
| 请求体 | Pydantic 模型 | `def f(item: Item)` |
| 请求体字段 | `Body()` | `def f(q: Annotated[str, Body()])` |
| 表单字段 | `Form()` | `def f(name: Annotated[str, Form()])` |
| 文件 | `File()` / `UploadFile` | `def f(file: UploadFile)` |
| 请求头 | `Header()` | `def f(token: Annotated[str, Header()])` |
| Cookie | `Cookie()` | `def f(sid: Annotated[str, Cookie()])` |
| 依赖注入 | `Depends(func)` | `def f(user=Depends(get_current_user))` |
| 请求对象 | `Request` 类型注解 | `def f(request: Request)` |
| 响应对象 | `Response` 类型注解 | `def f(response: Response)` |
| 后台任务 | `BackgroundTasks` | `def f(tasks: BackgroundTasks)` |

## 3.8 WebSocket:长连接通信

FastAPI 基于 ASGI 原生支持 WebSocket,适合聊天、实时通知、进度推送等场景。

### 服务端:完整聊天室示例

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

class ConnectionManager:
    """管理所有在线连接,负责广播"""
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()                    # 必须显式接受连接
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, message: str):
        for ws in self.active:
            try:
                await ws.send_text(message)  # 发送文本
            except Exception:
                self.disconnect(ws)          # 发送失败视为掉线

manager = ConnectionManager()

@app.websocket("/ws/chat/{username}")
async def chat_endpoint(websocket: WebSocket, username: str):
    await manager.connect(websocket)
    await manager.broadcast(f"{username} 加入了聊天室")
    try:
        while True:
            data = await websocket.receive_text()      # 等待客户端消息
            await manager.broadcast(f"{username}: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(f"{username} 离开了聊天室")
```

### WebSocket 收发 API

| 方法 | 作用 |
| --- | --- |
| `await ws.accept()` | 接受握手(可在 accept 前检查 token,拒绝则 `await ws.close()` 或直接 return) |
| `await ws.receive_text()` / `receive_bytes()` / `receive_json()` | 收消息 |
| `await ws.send_text()` / `send_bytes()` / `send_json()` | 发消息 |
| `await ws.close(code=1000)` | 关闭连接 |

### 客户端(浏览器 JS)

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/chat/小明");

ws.onopen = () => console.log("已连接");
ws.onmessage = (e) => console.log("收到:", e.data);
ws.send("大家好!");          // 发消息
ws.close();                  // 主动断开
```

### WebSocket 注意事项

1. **认证**:token 放 query(`?token=xxx`)或首个消息里(浏览器 WebSocket 不能自定义 header),`accept()` 之前校验,失败直接 `await ws.close(code=1008)`
2. **并发**:`receive_text` 和 `send_text` 可同时在多个 task 里跑,但同一连接不要并发 send(Starlette 不保证),需要的话加 `asyncio.Lock`
3. **心跳**:代理(Nginx)默认 60s 空闲断开,客户端定时发 ping 或服务端定时 ping 保活
4. **部署**:Nginx 需要 `proxy_set_header Upgrade $http_upgrade;` 等配置(07 章)
5. **广播依赖单进程内存**:多 worker 部署时 `manager.active` 各进程独立,跨进程广播需要 Redis Pub/Sub

## 3.9 子应用挂载(Mount)

把一个完整应用挂到路径前缀下,常见用途:静态文件、其他框架的集成(如已有的 Flask 应用)。

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# 1. 挂载静态文件目录:访问 /static/logo.png → ./static/logo.png
app.mount("/static", StaticFiles(directory="static"), name="static")

# 2. 挂载另一个 FastAPI 应用(如老系统迁移)
sub_app = FastAPI()

@sub_app.get("/ping")
def sub_ping():
    return {"from": "sub_app"}

app.mount("/legacy", sub_app)      # /legacy/ping 访问子应用

# 3. 挂载 Flask 等 WSGI 应用(需 a2wsgi 之类的适配器,不展开)
```

> 注意:`/static` 挂载后,主应用里不能定义 `/static/...` 路由,路径冲突按挂载优先级处理;挂载点上的路由不受主应用中间件完整影响(取决于挂载方式,ASGI 挂载在中间件外层)。

## 3.10 路由匹配顺序与 405

- FastAPI/Starlette 按**注册顺序**匹配路由,第一个匹配的胜出 —— 固定路径写前面(2.1 的陷阱)
- 路径匹配但方法不对:返回 405,并带 `Allow` 头
- 没有任何匹配:404(可用 3.6 的 Starlette 异常 handler 定制)
