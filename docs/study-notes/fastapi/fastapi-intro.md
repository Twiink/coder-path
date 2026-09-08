# 01 初识 FastAPI

## 1.1 FastAPI 是什么

FastAPI 是一个用于构建 API 的现代、快速(高性能)的 Python Web 框架,基于标准 Python 类型提示构建。

**核心技术栈:**

| 组件 | 作用 | 说明 |
| --- | --- | --- |
| Starlette | Web 框架底层(ASGI) | 处理 HTTP、WebSocket、路由、中间件、后台任务 |
| Pydantic | 数据校验与序列化 | 基于类型提示定义数据结构,自动校验、转换、生成 JSON Schema |
| Uvicorn | ASGI 服务器 | 高性能异步服务器,基于 uvloop + httptools |

三者关系:`pip install fastapi` 时,Starlette 和 Pydantic 会作为依赖自动安装;Uvicorn 是独立安装的"服务器",负责把 HTTP 请求转交给 FastAPI 应用。

### 与 Flask / Django 的对比

| 维度 | Flask | Django(+DRF) | FastAPI |
| --- | --- | --- | --- |
| 异步支持 | 3.x 仅视图层可选,生态多为同步 | 3.x 起支持 async 视图,ORM 异步弱 | 原生一等公民,全链路可异步 |
| 数据校验 | 手动 / marshmallow | Serializer | Pydantic 类型提示自动校验 |
| API 文档 | 插件 | drf-spectacular | 内置 Swagger UI / ReDoc |
| 性能(同硬件) | 中等(WSGI + 线程) | 中等 | 高(ASGI 异步,接近 Go/Node) |
| 全家桶程度 | 极简,自己拼装 | 大而全(ORM、Admin、Auth) | 精简,ORM/队列等自选 |
| 上手难度 | 低 | 中 | 低(但异步概念有门槛) |
| 适合场景 | 小服务、原型 | 传统 Web 全栈、后台管理 | **前后端分离 API、高并发服务、AI 应用** |

**结论:** 纯 API 服务、微服务、AI/LLM 应用(大量外部接口等待)首选 FastAPI;需要开箱即用的 Admin 后台和完整全家桶选 Django。

## 1.2 先理解:ASGI 与 WSGI

这是理解 FastAPI 高性能的关键背景知识。

**WSGI**(Python Web 服务器网关接口,2003 年 PEP 333):规定"服务器 ↔ 应用"之间的同步调用约定。服务器一次处理一个请求,`app(environ, start_response)` 返回完整响应体。Flask、Django 传统模式都跑在 WSGI 上。

**ASGI**(异步服务器网关接口):WSGI 的异步超集,一个应用可以同时处理 HTTP 和 **WebSocket**,协议是 `async` 风格的:

```python
async def app(scope, receive, send):
    # scope: 连接类型(http/websocket)、路径、headers 等
    # receive/send: 异步收发消息的 callable
    ...
```

**WSGI 的并发瓶颈:** 请求处理中大量时间花在"等待"(查数据库、调外部 API)。同步模型下,每个等待中的请求都占着一个线程/进程。**ASGI 的解法:** 单线程事件循环,等待期间切换去处理别的请求(详见 05 章)。这就是 FastAPI 高并发的根本来源。

> 一句话:WSGI = 同步、一次一个请求、不支持 WebSocket;ASGI = 异步、高并发等待场景更省资源、原生 WebSocket。

## 1.3 安装与环境

### 前置要求

- Python 3.8+(推荐 3.10+,本笔记使用 3.10+ 语法如 `X | None`)
- 了解虚拟环境:`venv` / `uv` / `conda`

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 安装 FastAPI + Uvicorn(推荐带 standard)
pip install "fastapi[standard]"
```

`[standard]` 这个 extra 装了什么?

| 包 | 作用 |
| --- | --- |
| `uvicorn` | ASGI 服务器本体 |
| `uvloop` | 事件循环加速(仅 Linux/macOS,比 asyncio 默认快) |
| `httptools` | C 语言 HTTP 解析器,比纯 Python 快 |
| `websockets` | WebSocket 支持 |
| `watchfiles` | `--reload` 热重载的文件监听 |
| `python-dotenv` | 自动读取 `.env` 文件 |

国内加速:`pip install "fastapi[standard]" -i https://pypi.tuna.tsinghua.edu.cn/simple`

### 验证安装

```python
import fastapi, pydantic, starlette, uvicorn

print(fastapi.__version__)   # 例如 0.115.x
print(pydantic.__version__)  # 例如 2.x
```

> **版本注意:** FastAPI 0.100+ 默认使用 Pydantic v2(校验速度比 v1 快 5~50 倍,API 有少量不兼容)。网上大量旧教程基于 Pydantic v1(如 `orm_mode`、`@validator`、`.dict()`),学习时注意区分。本笔记全部基于 Pydantic v2 现行写法,遇到旧教程时对照关系:v1 的 `orm_mode=True` → v2 的 `ConfigDict(from_attributes=True)`;`@validator` → `@field_validator`;`.dict()` → `.model_dump()`。

## 1.4 第一个 FastAPI 应用

创建 `main.py`:

```python
from fastapi import FastAPI

# 创建应用实例,title 等信息会显示在自动文档里
app = FastAPI(
    title="我的第一个 API",
    description="FastAPI 入门示例",
    version="1.0.0",
)


@app.get("/")
def read_root():
    """根路径,返回一个简单的 JSON"""
    return {"message": "Hello, FastAPI!"}


@app.get("/hello/{name}")
def say_hello(name: str):
    """路径参数示例:/hello/张三 → {"name": "张三", "greeting": "你好, 张三!"}"""
    return {"name": name, "greeting": f"你好, {name}!"}
```

启动服务:

```bash
uvicorn main:app --reload
```

- `main` — 模块名(文件名 `main.py`)
- `app` — FastAPI 实例的变量名
- `--reload` — 开发模式,代码改动自动重启(**生产环境禁止使用**,它会监听文件、拖慢性能)
- 默认监听 `http://127.0.0.1:8000`

常用启动参数:

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `--host` | 监听地址,`0.0.0.0` 表示对外网可见 | `--host 0.0.0.0` |
| `--port` | 端口 | `--port 8080` |
| `--reload` | 热重载(开发用) | `--reload` |
| `--workers` | 多进程数(生产用,需去掉 --reload) | `--workers 4` |
| `--log-level` | 日志级别 | `--log-level info` |
| `--env-file` | 指定 .env 文件 | `--env-file .env.local` |

测试接口:

```bash
# 命令行
curl http://127.0.0.1:8000/
# {"message":"Hello, FastAPI!"}

curl http://127.0.0.1:8000/hello/张三
# {"name":"张三","greeting":"你好, 张三!"}
```

### 应用实例 FastAPI(...) 的完整参数

```python
app = FastAPI(
    title="API 名称",                        # 文档标题
    description="markdown 格式的描述",        # 文档说明,支持 Markdown
    version="1.0.0",                        # 接口版本,写进 OpenAPI
    terms_of_service="https://example.com/terms",
    contact={"name": "后端组", "email": "dev@example.com"},
    license_info={"name": "MIT"},
    openapi_tags=[                          # 文档左侧的分组元数据
        {"name": "用户", "description": "用户注册登录相关接口"},
        {"name": "商品", "description": "商品 CRUD"},
    ],
    docs_url="/docs",                       # Swagger UI 地址,设 None 关闭
    redoc_url="/redoc",                     # ReDoc 地址,设 None 关闭
    openapi_url="/openapi.json",            # OpenAPI Schema 地址
    root_path="/api",                       # 反向代理前缀(见 07 章 Nginx)
    debug=False,                            # 开启后异常时返回堆栈(仅开发)
)
```

## 1.5 自动交互式文档

FastAPI 根据类型提示和 Pydantic 模型**自动生成** OpenAPI Schema,并渲染成两份文档:

| 地址 | 文档类型 | 特点 |
| --- | --- | --- |
| `http://127.0.0.1:8000/docs` | Swagger UI | 可视化、可直接在页面上发请求调试 |
| `http://127.0.0.1:8000/redoc` | ReDoc | 阅读型,排版优雅 |
| `http://127.0.0.1:8000/openapi.json` | OpenAPI Schema | 机器可读 JSON,可导出给前端/客户端生成 SDK |

> **OpenAPI** 是一个 API 描述规范(原 Swagger Specification)。FastAPI 自动生成 OpenAPI 3.1 Schema,Swagger UI 和 ReDoc 只是它的两个渲染界面。协作价值:把 `openapi.json` 给前端团队,可用工具自动生成 TypeScript 类型和 axios 封装;也可以导入 Postman/Apifox 直接生成接口集合。

### 定制文档

```python
# 关闭文档(生产环境常因安全考虑关闭,或限制 IP 访问)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# 为单个接口写更详细的文档说明
@app.get(
    "/items/{item_id}",
    summary="查询单个商品",                # 列表页显示的短标题
    description="### 详细说明\n支持 **Markdown**,返回商品完整信息。",
    response_description="成功时返回商品对象",
    tags=["商品"],                        # 文档分组
    deprecated=True,                      # 标记接口已废弃(文档中划线显示)
    include_in_schema=False,              # True=不显示在文档中(但接口仍可用)
)
def get_item(item_id: int):
    return {"item_id": item_id}
```

```python
# Swagger UI 高级定制:深色模式、默认展开、隐藏 models
app = FastAPI(
    swagger_ui_parameters={
        "defaultModelsExpandDepth": -1,   # 默认收起 Schema 模型
        "tryItOutEnabled": True,          # 默认开启"Try it out"
        "persistAuthorization": True,     # 登录状态持久化(配合 06 章 Authorize)
    }
)
```

## 1.6 类型提示基础(必学前置)

FastAPI 的一切都建立在 Python 类型提示之上。这里系统过一遍,02 章会看到它们如何驱动校验。

### 简单类型

```python
name: str = "小明"            # 字符串
age: int = 18                # 整数
height: float = 1.75         # 浮点数
is_active: bool = True       # 布尔
nothing: None = None         # 空值
```

### 容器与复合类型

```python
from typing import Optional, Union, List, Dict, Tuple, Set, Any

ids: List[int] = [1, 2, 3]              # 整数列表
scores: Dict[str, float] = {"math": 95.5}   # 键 str 值 float 的字典
point: Tuple[int, int] = (10, 20)       # 定长定类型元组
tags: Set[str] = {"a", "b"}             # 集合
data: Any = "什么都可以"                 # 任意类型(慎用,失去校验)

nickname: Optional[str] = None          # 等价于 Union[str, None]
value: Union[int, str] = 10             # int 或 str
value = "hello"                          # 也合法
```

### Python 3.10+ 新语法(推荐)

```python
ids: list[int] = [1, 2, 3]              # 3.9+ 内置泛型写法
scores: dict[str, float] = {"math": 95.5}
value: int | str = 10                    # 3.10+ | 代替 Union
nickname: str | None = None              # 等价于 Optional[str]
```

### 函数与可调用对象

```python
from typing import Callable

def add(a: int, b: int) -> int:
    return a + b

# 参数默认值写在类型后面
def greet(name: str, greeting: str = "你好") -> str:
    return f"{greeting}, {name}!"

# 函数作为参数/返回值
def apply(func: Callable[[int, int], int], x: int, y: int) -> int:
    return func(x, y)

apply(add, 1, 2)   # 3
```

### 类型别名与 NewType

```python
from typing import NewType

UserId = int                       # 类型别名:纯粹的可读性
JsonDict = dict[str, Any]

# NewType:创建"名义上不同"的新类型,静态检查时区分,运行时不强制
UserId = NewType("UserId", int)
def get_user(uid: UserId): ...
get_user(UserId(1))   # 正确用法
```

### TypedDict:有结构的字典

```python
from typing import TypedDict

class Movie(TypedDict):
    title: str
    year: int

m: Movie = {"title": "流浪地球", "year": 2019}
# FastAPI 场景中,结构化数据更推荐 Pydantic BaseModel(可校验),TypedDict 偏轻量场景
```

### Annotated:类型 + 元数据(重点,02 章的主角)

```python
from typing import Annotated

# Annotated[类型, 元数据...]:在不改变类型的前提下附加信息
UserId = Annotated[int, "主键"]          # 元数据可以是任意对象
PositiveInt = Annotated[int, "必须 > 0"]

# FastAPI 用它挂校验规则:
# item_id: Annotated[int, Path(ge=1)] —— 类型是 int,附加 Path 校验元数据
```

> **关键认知:** 类型提示只是"标注",Python 解释器运行时**不会**强制校验 —— `add("1", 2)` 会正常返回 `"12"`。但 FastAPI/Pydantic 会**读取这些标注并真正执行校验**,这是 FastAPI 一切魔法的来源。且这些标注还顺便带来 IDE 补全和 mypy 静态检查收益。

## 1.7 一次请求的完整处理流程

理解这条流水线,后续章节的"参数校验何时发生、依赖何时执行"就都有坐标了:

```
客户端请求
    │
    ▼
Uvicorn(ASGI 服务器)接收 HTTP 请求,组装 ASGI scope
    │
    ▼
Starlette 中间件栈(按注册顺序执行;尚未做路由匹配)
    │
    ▼
路由匹配(找到路径操作函数;此时才解析出路径参数)
    │
    ▼
解析并校验请求参数(路径参数 → 查询参数 → Header → 请求体)
    ├─ 校验失败 → 自动返回 422 JSON 错误(结构见 02 章)
    │
    ▼
解析依赖项(Depends 声明的依赖树,见 03 章)
    │
    ▼
执行路径操作函数(见 05 章:async def 在事件循环,def 在线程池)
    │
    ▼
按 response_model 校验、过滤返回值(见 02 章)
    │
    ▼
生成 HTTP 响应,反向穿过中间件栈
    │
    ▼
返回客户端
```

## 1.8 路径操作装饰器

### HTTP 方法一览

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/items")          # 读取资源(查询)
def list_items(): ...

@app.post("/items")         # 创建资源
def create_item(): ...

@app.put("/items/{id}")     # 整体更新资源(全量替换)
def update_item(id: int): ...

@app.patch("/items/{id}")   # 部分更新资源
def partial_update(id: int): ...

@app.delete("/items/{id}")  # 删除资源
def delete_item(id: int): ...

@app.options("/items")      # 预检请求(CORS 会用到,见 03 章)
def options_items(): ...

@app.head("/items")         # 同 GET 但不返回 body
def head_items(): ...

@app.trace("/items")        # 调试用,极少用
def trace_items(): ...
```

不常用方法或自定义方法用通用装饰器:

```python
@app.api_route("/items", methods=["GET", "POST"])
def items():
    return {"msg": "同时支持 GET 和 POST"}
```

### 装饰器的完整参数

```python
@app.get(
    "/items",
    response_model=ItemOut,          # 响应结构校验(02 章)
    status_code=201,                 # 成功状态码,可用 fastapi.status.HTTP_201_CREATED
    tags=["商品"],                   # 文档分组
    summary="标题",
    description="详细说明(Markdown)",
    response_description="响应的说明",
    deprecated=True,                 # 标记废弃
    include_in_schema=False,         # 不显示在文档
    name="item_list",                # 接口在文档中的唯一标识名(默认函数名)
    dependencies=[Depends(verify_token)],  # 路由级依赖(03 章)
    responses={                      # 声明额外的响应文档(如 404)
        404: {"description": "商品不存在"},
    },
)
def list_items(): ...
```

> `status_code` 建议用 `from fastapi import status` 的常量(`status.HTTP_201_CREATED`)代替魔法数字,可读性更好。

## 1.9 响应类型详解

路径操作函数返回什么,决定响应长什么样:

### 返回 dict / list → 自动 JSON

```python
@app.get("/json")
def return_json():
    return {"msg": "dict 自动变 JSON"}          # Content-Type: application/json

@app.get("/list")
def return_list():
    return [{"id": 1}, {"id": 2}]               # list 也可以

@app.get("/text")
def return_text():
    return "纯字符串"                            # str → text/plain,不是 JSON!
```

> 注意:返回裸 `str` 时 Content-Type 是 `text/plain`,前端若按 JSON 解析会出错。要 JSON 就返回 dict/list/Pydantic 模型。

### 返回 Pydantic 模型 → 自动序列化

```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    price: float

@app.get("/pydantic", response_model=Item)
def return_model():
    return Item(name="键盘", price=299.5)        # 自动 model_dump 成 JSON
```

### 直接控制 Response 对象

```python
from fastapi import Response
from fastapi.responses import (
    JSONResponse, HTMLResponse, PlainTextResponse,
    FileResponse, StreamingResponse, RedirectResponse,
)

@app.get("/custom")
def custom():
    # 1. 通用 Response:手动指定内容类型
    return Response(content="ok", media_type="text/plain", status_code=200)

    # 2. HTML 页面
    return HTMLResponse("<h1>你好</h1>")

    # 3. 文件下载
    return FileResponse("/path/to/report.pdf", filename="报告.pdf")

    # 4. 重定向
    return RedirectResponse(url="https://example.com", status_code=302)

    # 5. 流式响应(大文件、AI 生成内容逐字输出)
    def generate():
        for i in range(100):
            yield f"data: 第{i}条\n"
    return StreamingResponse(generate(), media_type="text/event-stream")

    # 6. 在响应里设置 Cookie(02 章会再讲)
    resp = JSONResponse({"ok": True})
    resp.set_cookie(key="session", value="abc", httponly=True, max_age=3600)
    return resp
```

### 更快的 JSON:ORJSONResponse

```bash
pip install orjson   # Rust 实现,比标准 json 快数倍
```

```python
from fastapi.responses import ORJSONResponse

app = FastAPI(default_response_class=ORJSONResponse)   # 全局默认用 orjson
# 大响应体场景有明显收益;注意 orjson 会把 datetime 输出为 ISO8601 字符串等细节差异
```

## 1.10 开发工具建议

- **编辑器:** VS Code / PyCharm,安装 Python 插件以获得类型补全;VS Code 可装 Pylance
- **接口调试:** 直接使用 `/docs` 页,或 Postman / Apifox / curl
- **代码检查与格式化:** ruff(替代 flake8 + black + isort,速度快)
  ```bash
  pip install ruff
  ruff check main.py      # 检查
  ruff format main.py     # 格式化
  ```
- **类型检查(可选):** mypy,配合类型提示收益更大
- **依赖管理:** 个人项目 `pip freeze > requirements.txt`;团队项目建议 `uv` 或 `poetry`(锁版本,见 07 章)

---

## 本章小结

- FastAPI = Starlette(Web 层)+ Pydantic(数据层)+ 类型提示(开发体验),跑在 ASGI 协议上
- `uvicorn main:app --reload` 启动开发服务器;生产用多进程方案(07 章)
- `/docs`、`/redoc`、`/openapi.json` 自动可用,可用参数定制或关闭
- 类型提示是 FastAPI 的核心机制,`Annotated` 是挂校验元数据的推荐方式
- 一次请求的流水线:中间件 → 路由匹配 → 参数校验 → 依赖 → 函数 → 响应校验
