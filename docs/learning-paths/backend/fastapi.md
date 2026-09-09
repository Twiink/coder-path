# FastAPI 学习路线

FastAPI 是 Python 异步 Web 框架的新秀,找到了"甜蜜点":**性能媲美 Node/Go(基于 Starlette + ASGI 异步),开发体验是纯 Python(类型提示贯穿一切),文档自动生成(零配置 Swagger UI)**。它的核心魔法一句话:**类型提示即契约**——你写 `id: int` 与 Pydantic 模型,FastAPI 自动完成请求解析、数据校验、OpenAPI 文档与 IDE 补全。适合 API 服务、微服务、实时应用、AI 应用后端(LLM 生态示例几乎全是 FastAPI),也是 2024 年后 Python 后端新项目的默认推荐之一。对比:[Flask](/learning-paths/backend/flask)(同步轻量自由)、[Django](/learning-paths/backend/django)(全家桶,自带 Admin)。

这条线按 **类型驱动与请求参数 → Pydantic 与响应 → 依赖注入 → 数据库 → 认证授权 → 中间件与错误 → 模块化与配置 → 文档 → WebSocket 与任务 → 测试 → 部署与最佳实践** 推进。

## 第一站:类型驱动开发

**起步**:`pip install "fastapi[standard]"`;main.py:`app = FastAPI()` + `@app.get("/")` 路径操作函数;**运行**:`uvicorn main:app --reload`(ASGI 服务器,开发热重载);**打开 `http://127.0.0.1:8000/docs`——自动生成的 Swagger UI(可交互调试)与 /redoc**,这就是"类型提示换文档"的即得收益;**`def` vs `async def` 端点**(FastAPI 性能的关键心智):`def` 端点 FastAPI 自动放进**线程池**运行(适合同步阻塞代码:同步 SQLAlchemy/requests),`async def` 直接跑在事件循环(适合异步库)——**不是越 async 越好:阻塞库配 def,异步库配 async def**。**路径参数类型即校验**:`@app.get("/items/{item_id}")` 配 `item_id: int`——传非数字自动 422(验证错误),`item_id: float`/`bool`/`uuid.UUID` 同理;路径操作声明顺序(动态参数路由写在静态路由后面,避免遮蔽);`status_code=201` 等配置。

## 第二站:请求参数三件套与校验

**路径参数**:`Path(..., title=..., ge=1, le=1000)`(ge/le/gt/lt 数值范围校验,`...` 表示必填,`Query(默认值)`);**查询参数**:`q: str | None = Query(None, min_length=3, max_length=50, pattern="^[a-z]+$")`——默认值即"可选";**请求体**:Pydantic 模型(见下),参数混用无压力(FastAPI 按类型自动分辨:路径参数按名字、标量非路径非体 → 查询、Pydantic 模型 → 体);**表单 Form(...)**:`python-multipart` 依赖,登录表单/OAuth2 用;**文件**:`file: UploadFile = File(...)`(异步读 `await file.read()`,带 filename/content_type——比 bytes 更省内存;多文件 `list[UploadFile]`);**Header/Cookie**:`x_token: str | None = Header(None)`(自动转下划线,`convert_underscores=False` 细节)、Cookie 同款;**embed**:单个 Body 参数要 `Body(..., embed=True)` 包一层。**校验失败响应**:默认 422 + `{detail: [...]}`,格式可自定义(见错误章)。

## 第三站:Pydantic 与响应模型

**Pydantic v2**(FastAPI 的校验引擎,基于 Rust 的 pydantic-core,快):`class Item(BaseModel): name: str; price: float = Field(gt=0, description=...)`——字段类型即校验(自动类型转换)、`Field` 加约束与元数据、**嵌套模型**(模型套模型自动递归校验)、**模型继承**(基类 + 扩展)、`Union`/`list[Item]` 组合、`Optional`;**校验器**(v2):`@field_validator("name")`(字段级:值转换/业务校验)、`@model_validator(mode="after")`(模型级:跨字段如"两次密码一致");**序列化**:`model_dump()`/`model_dump_json()`(v2 语法;v1 的 dict/json 老代码会读)、`model_validate()`(dict/ORM 对象转模型);**配置**:`model_config = ConfigDict(from_attributes=True)`(从 ORM 对象构建——ORM 转 schema 的开关)。**响应模型 response_model**(输出控制的核心):`@app.get("/users/{id}", response_model=UserOut)`——**自动过滤响应字段**(模型里有 password 但 UserOut 没有 → 不会泄露)、响应校验、嵌套序列化;`response_model_exclude_unset`(不输出未设字段)等细粒度控制;**多响应模型**:`response_model=Union[...]` 或 `Response` 参数动态返回;**状态码与头**:`status_code=status.HTTP_201_CREATED`、`response.headers`;**响应类型**:默认 JSON,`FileResponse`(文件下载)/`StreamingResponse`(流式:大文件/SSE 流式输出——LLM 场景核心)/`HTMLResponse`/`RedirectResponse`/`PlainTextResponse`。

## 第四站:依赖注入——FastAPI 的架构灵魂

**Depends 依赖注入**(比手写参数传递优雅得多):`def get_db(): db = SessionLocal(); try: yield db; finally: db.close()`——**yield 依赖:yield 前是"获取",yield 后是"清理"**,数据库会话/连接的标准姿势;端点 `def read(db: Session = Depends(get_db))`——**每次请求自动调用依赖、自动清理**;**子依赖**:依赖还能 Depends 别的依赖(FastAPI 自动解析依赖树,共享子依赖默认缓存(use_cache),请求内只执行一次);**类依赖**:`class Paginator: def __init__(self, page: int = Query(1)): ...` + `Depends(Paginator)`——带状态的分页/过滤参数组;**依赖的用途**(FastAPI 分层设计的基石):数据库会话、**当前用户**(`get_current_user` 依赖里验 token 查库,需要用户的路由声明 `user: User = Depends(get_current_user)`——**认证即依赖,业务函数零认证代码**)、公共查询参数、权限校验;**路由级/全局依赖**:`APIRouter(dependencies=[Depends(verify_api_key)])`(整个路由组都过);**测试替换**:`app.dependency_overrides[get_db] = test_get_db`——**测试时换依赖是 FastAPI 测试的标准姿势**,不用起真数据库/真认证。

## 第五站:数据库与异步

**SQLAlchemy 2.x**(FastAPI 官方文档标准):同步方案——`create_engine` + `SessionLocal` + `DeclarativeBase` 模型(字段与关系同 SQLAlchemy);**异步方案**(吃满 FastAPI 性能):`create_async_engine("postgresql+asyncpg://...")` + `async_sessionmaker` + `AsyncSession`,查询 `await db.execute(select(User).where(...))`(需要 asyncpg/aiomysql 驱动);**会话依赖**(见上,yield 模式,`sessionmaker` 依赖里创建);**SQLModel**(FastAPI 作者开发的"表即模型":一个类同时是 SQLAlchemy 模型与 Pydantic 模型——小项目/原型省一半代码,可了解);**迁移 Alembic**(异步引擎也用它:`alembic init` + env.py 配 async);**CRUD 分层**:路由薄 → service/repository 层,避免"路由里堆 SQL";N+1 查询用 `selectinload`/`joinedload` 预加载;**常见坑**:同步引擎在 async 端点里会阻塞事件循环(要么 def 端点线程池,要么用异步引擎);事务边界与 commit 时机。

## 第六站:认证与授权

FastAPI 官方文档的"OAuth2 密码流 + JWT"是必走教程:**流程**:`OAuth2PasswordRequestForm`(收 form 的 username/password)→ 查用户 + `bcrypt` 验哈希(passlib 封装,注意 passlib 维护状态,直接 bcrypt 亦可)→ `python-jose` 或 PyJWT 签 JWT(`sub`=用户名、`exp` 过期)→ 返回 `{access_token, token_type: "bearer"}`;**拿令牌**:`OAuth2PasswordBearer(tokenUrl="/token")` 依赖(OAuth2 规范声明,Swagger 文档自动出现 Authorize 按钮)→ `get_current_user` 依赖:decode token → 失败抛 401(带 `WWW-Authenticate` 头)→ 查库返回 User;**权限**:`get_current_active_user` 链式依赖(禁用检查)、自定义 `require_roles("admin")` 依赖(验 user.role);**401 vs 403 语义**(未认证 401 / 无权限 403);**API Key**:`X-API-Key` Header 依赖(内部服务用);**第三方 OAuth2**(Google/GitHub 登录:authlib 或 social 库,理解授权码流程,见 [认证授权路线](/learning-paths/security/auth));**密码**:别存明文、别自研哈希,见 [Web 安全](/learning-paths/security/web-security)。

## 第七站:中间件、错误处理与后台任务

**CORS**:`CORSMiddleware`(allow_origins 精确列表——**别 `["*"]` 还带 credentials**,allow_methods/headers 按需);**自定义中间件**:`@app.middleware("http")`(纯 ASGI 包装:计时/加头/日志)或 BaseHTTPMiddleware 类——执行时机在路由前;**错误处理**:主动抛 `HTTPException(status_code=404, detail="Item not found")`(detail 中文/结构化皆可);**自定义异常与处理器**:`@app.exception_handler(MyError)`(业务错误码体系:自定义异常携带 code/status,处理器统一转 JSON)、`RequestValidationError` 处理器(把默认 422 格式改成团队统一格式)、覆盖 `HTTPException` 处理器;**后台任务 BackgroundTasks**:`background_tasks.add_task(send_email, ...)`——响应返回后执行,轻量异步(发邮件/写日志/清理);**重活交给队列**:Celery 或 ARQ(任务持久化/重试/定时,请求外执行)。**WebSocket**:`@app.websocket("/ws")` + `await websocket.accept()`/`receive_text`/`send_text`——聊天/推送;连接管理(断连清理、房间表)、依赖注入在 WS 里也能用(鉴权 token 查询参数);生产级广播用独立方案(Redis pub/sub 或多 worker 注意)。

## 第八站:模块化、配置与文档

**APIRouter 模块化**(中大型项目的骨架):`router = APIRouter(prefix="/users", tags=["users"], dependencies=[...])`——每个功能域一个 router 文件,`app.include_router(router)`;tags 让文档分组;**项目结构推荐**:`app/`(main.py + api/routers + models + schemas(Pydantic) + crud/services + core(配置/安全)+ dependencies);**配置即模型**:`class Settings(BaseSettings): app_name: str; database_url: str; secret_key: str` + `settings = Settings()`——**pydantic-settings 读环境变量/.env、类型校验配置**(比 os.environ 裸读强得多);敏感项(密钥)只从环境注入。**OpenAPI 定制**:`FastAPI(title=..., version=..., openapi_tags=[...])`、路径操作的 `summary/description/response_description`(docstring 也会进文档)、`deprecated=True` 标旧接口、`responses={404: {"description": ...}}` 声明错误响应、`example`/`examples`(请求/响应示例——文档与调试体验)、安全方案(声明后 docs 出现 Authorize)、`operation_id`;**文档即契约**:前端/联调/测试都对着 /docs 或导出的 openapi.json——**schema 变了文档自动变,接口文档永不腐烂**,这是 FastAPI 对比 Flask/Django 的最大体验差。

## 第九站:测试

**TestClient**:`from fastapi.testclient import TestClient` + `client.get("/items/1")`(基于 httpx,同步风格);**依赖覆盖测试**(FastAPI 测试王牌):`app.dependency_overrides[get_db] = override_get_db`——测接口不碰真库/真 JWT;**异步测试**:httpx 的 `AsyncClient(transport=ASGITransport(app=app))` + pytest-asyncio/anyio;**数据库测试**:独立测试库(SQLite 内存或 Postgres 测试库)+ 每测试建表/事务回滚;**覆盖场景**:参数校验(422)、业务错误(404/400)、权限(401/403)、正常路径(200 + 响应模型字段)——**一个 CRUD 的测试骨架应能默写**;覆盖率 coverage.py;pytest fixture 组织(app/client/db 三个 fixture 起步)。

## 第十站:部署与最佳实践

**ASGI 服务器**:开发 uvicorn --reload;**生产**:`uvicorn main:app --workers N` 或多 worker 交 Gunicorn(`gunicorn -k uvicorn.workers.UvicornWorker -w 4 main:app`)——**注意**:多 worker 下内存态(内存缓存/WS 连接表)不共享,需要 Redis 等外部存储;**Docker**:多阶段(依赖装好后拷代码)、非 root、`CMD uvicorn`、健康检查;**健康检查端点**:`/healthz` 返回 200 + 依赖状态(数据库 ping)——K8s/Docker 探针用;**反向代理**:Nginx/Traefik 终止 HTTPS + 静态;环境变量管理(见配置章);**日志**:logging 或 structlog、uvicorn 访问日志、JSON 结构化、Sentry(错误上报)/OpenTelemetry(链路)/Prometheus(prometheus-fastapi-instrumentator 一行接指标);**限流**:slowapi(基于 limits);**性能**:全异步链路(阻塞库用 def 端点/`run_in_threadpool`)、响应模型裁剪字段(别把大模型全量吐出去)、Redis 缓存热点、连接池(asyncpg 默认池)、gzip 中间件、`ORJSONResponse`(可选,JSON 更快);**最佳实践清单**:版本化(/api/v1 前缀)、统一错误结构、输入全走 Pydantic(不信裸 request)、依赖注入组织公共逻辑、文档开着写(description 写全)、安全头与 CORS 收紧、密钥只进环境变量。**生态**:SQLModel(快速 ORM)、Strawberry(GraphQL)、LangChain/OpenAI 集成(AI 应用后端标配)、WebSocket 广播、Celery/ARQ、Pydantic 的 settings 与 types 全家。

## 通关标准

能独立做到:写一个带分页/过滤/校验/统一错误/版本化的完整 CRUD API(router + schema + service 分层);讲清 def 与 async def 端点的区别与选择、Depends + yield 依赖的获取清理流程、dependency_overrides 为什么是测试王牌;手写 OAuth2 密码流 + JWT + 当前用户依赖并保护路由;把接口接上 SQLAlchemy(同步或异步)并用 Alembic 管迁移;会用 TestClient + 依赖覆盖写接口测试;部署到 Docker + Uvicorn 并配好健康检查与日志——FastAPI 主线通关。

FastAPI 把"类型提示"这一个特性用到了极致:校验、文档、补全、重构全部由它驱动——你写的是普通 Python,拿到的却是堪比类型语言框架的体验。它不完美(生态比 Django 小、模板/Admin 不是它的活),但在 **API/微服务/AI 后端**这个赛道上,它已经是 Python 的默认答案。学完它,配合 [SQL 与数据库](/learning-paths/database/postgresql) 与 [Docker](/learning-paths/devops/docker),你就能独立交付一个生产级后端服务。
