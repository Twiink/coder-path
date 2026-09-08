# 05 异步编程

FastAPI 的性能神话与"异步"强绑定,但异步用错了反而更慢。本章讲清:async/await 的底层机制、FastAPI 怎么跑你的函数、阻塞代码的坑,以及正确的并发姿势。

## 5.1 为什么需要异步:同步服务器的瓶颈

传统同步框架(如 Flask)每来一个请求,服务器开一个线程处理。当代码执行到"等待数据库返回"时,这个线程**只能干等**(阻塞),1000 个并发请求就需要 1000 个线程,内存和线程切换开销巨大。

异步的思路:**单线程 + 事件循环**。等待 IO 时把控制权交还事件循环,转去处理别的请求;IO 完成后再回来继续。一个进程就能扛住成千上万的并发 IO 等待。

```
同步(线程模型):
请求1 ────[查库等待 100ms]──── → 响应1
请求2 ────────[查库等待 100ms]──── → 响应2     ← 各占一个线程,等待期间线程闲置

异步(事件循环):
请求1 ──[查库等待 100ms]──→ 响应1
请求2 ────────[查库等待 100ms]──────→ 响应2   ← 单线程,等待期间交叉执行
```

**异步只对 IO 密集型有效。** CPU 密集任务(大量计算)在单线程里照样阻塞 —— 那是多进程的领域(5.8 节)。

## 5.2 事件循环怎么工作

```python
import asyncio

async def fetch(name, delay):
    print(f"{name}: 开始")
    await asyncio.sleep(delay)      # 模拟 IO 等待
    print(f"{name}: 完成")
    return f"{name} 的结果"

async def main():
    # 三个协程并发执行,总耗时 ≈ 最长的 delay,而不是三个之和
    results = await asyncio.gather(
        fetch("A", 1),
        fetch("B", 2),
        fetch("C", 0.5),
    )
    print(results)

asyncio.run(main())
```

执行轨迹:

```
1. main() 启动,创建三个 fetch 协程
2. A 开始,await sleep(1) → 挂起,控制权交回事件循环
3. B 开始,await sleep(2) → 挂起
4. C 开始,await sleep(0.5) → 挂起
5. 0.5s 后 C 的 sleep 完成,事件循环唤醒 C → 打印"C: 完成"
6. 1s 后唤醒 A → 打印"A: 完成"
7. 2s 后唤醒 B → 打印"B: 完成"
8. gather 收集齐三个结果,返回
```

**关键理解:** `await` 是把"等待期间"的 CPU 让给别人用;事件循环本质是一个任务调度器,在"就绪的任务"之间反复切换。所有这一切发生在一个线程里,**没有锁、没有线程切换开销**,但要求每段代码都"短小快速",谁占了 CPU 不放手,其他人都得等。

### async/await 语法规则

```python
async def coroutine_func():
    """async def 定义的函数叫协程"""
    await other_async_func()   # await 只能在 async def 内使用
    return "result"

# 直接调用不执行,只返回协程对象(会报 RuntimeWarning)
c = coroutine_func()           # <coroutine object ...>

# 三种执行方式:
# 1. await 它(必须在另一个协程里)
# 2. asyncio.run(协程)         —— 程序入口
# 3. asyncio.create_task(协程) —— 注册成任务交给事件循环
```

**只有 `await` 真正的异步 IO 才能获得并发收益**;`await` 一段纯 CPU 计算毫无意义。判断标准:底层是否在"等操作系统/网络/磁盘"。

## 5.3 asyncio 并发原语全集

### gather:并发执行、收集结果

```python
# 并发跑多个协程,全部完成后一起返回(顺序与传入顺序一致)
results = await asyncio.gather(task1(), task2(), task3())

# 异常处理:一个失败默认整体抛异常;return_exceptions=True 吞掉异常放进结果
results = await asyncio.gather(task1(), task2(), return_exceptions=True)
for r in results:
    if isinstance(r, Exception):
        print(f"某个任务失败: {r}")
```

### create_task:后台启动、先干别的

```python
task = asyncio.create_task(slow_work())   # 立即开始执行(注册进事件循环)
do_something_else()                        # 主流程继续
result = await task                        # 最后再等结果
```

> `create_task` 的任务一定要保持引用并在某处 `await`/`cancel`,否则可能被垃圾回收或产生"任务从未被获取"的告警。

### wait_for:超时控制

```python
try:
    result = await asyncio.wait_for(slow_api(), timeout=5)
except asyncio.TimeoutError:
    print("超时了")
```

> 注意:`wait_for` 超时后任务会被**取消**(抛 CancelledError),如果你的函数里有 `finally` 清理逻辑,它会被执行。给第三方调用包超时,这是必须的习惯 —— 上游挂了不能拖死自己。

### Semaphore:限制并发数量

```python
sem = asyncio.Semaphore(10)     # 最多同时 10 个

async def limited_call(item):
    async with sem:              # 超出的协程在此排队
        return await external_api(item)

# 1000 个任务,但任意时刻最多 10 个在飞
results = await asyncio.gather(*[limited_call(i) for i in range(1000)])
```

没有信号量的 `gather(*[1000 个请求])` 会瞬间打爆上游和本机连接池 —— **批量并发必须限流**。

### as_completed:按完成顺序处理(流式)

```python
tasks = [asyncio.create_task(fetch(i)) for i in range(100)]
for coro in asyncio.as_completed(tasks):
    result = await coro          # 谁先完成先处理谁,不等最慢的
    save(result)
```

适合"来一个处理一个"的流式场景(如批量爬取后逐个入库)。

### Queue:生产者-消费者模式

```python
queue = asyncio.Queue(maxsize=100)

async def producer():
    for i in range(1000):
        await queue.put(i)       # 满了会自动等
    await queue.put(None)        # 结束信号

async def consumer(worker_id):
    while True:
        item = await queue.get() # 空了会自动等
        if item is None:
            break
        await process(item)
        queue.task_done()

await asyncio.gather(producer(), *[consumer(i) for i in range(5)])
```

### Lock:异步互斥

```python
lock = asyncio.Lock()

async def safe_write(data):
    async with lock:             # 异步锁,等待时不阻塞事件循环
        await db_append(data)
```

> 同一事件循环内的协程切换点只在 `await` 处,简单的"检查-修改"若中间没有 await 其实天然原子;有 await 的复合操作(读-判断-写)才需要锁。

### to_thread:阻塞函数丢进线程

```python
result = await asyncio.to_thread(blocking_func, arg1, arg2)
# 等价于老写法:
# loop = asyncio.get_running_loop()
# result = await loop.run_in_executor(None, blocking_func, arg1, arg2)
```

## 5.4 FastAPI 如何运行你的函数

FastAPI 中 `async def` 和 `def` 路由**都能用**,运行机制完全不同:

| 声明方式 | 运行位置 | 适合场景 | 阻塞后果 |
| --- | --- | --- | --- |
| `async def` | **事件循环主线程** | 内部只有异步 IO(async DB、httpx.AsyncClient) | 阻塞 → 整个服务所有请求卡死 |
| `def`(同步) | **线程池**(AnyIO 内部默认上限 40 线程) | 内部有同步阻塞代码(同步 ORM、requests) | 只占一个线程,其他请求不受影响 |

```python
import time
import asyncio

@app.get("/async-route")
async def async_route():
    await asyncio.sleep(1)      # ✅ 异步等待,事件循环去处理别的请求
    return {"ok": True}

@app.get("/sync-route")
def sync_route():
    time.sleep(1)               # 在线程池里睡,占一个线程但不卡事件循环
    return {"ok": True}
```

**并发模型全景:**

```
客户端请求
   │
   ▼
Uvicorn 事件循环(单线程)
   ├── 请求是 async def 路由 → 直接在事件循环上执行
   └── 请求是 def 路由 → 丢给线程池(默认最多 40 个并发)
                              └─ 线程池满了 → 排队等待
```

**关键判断标准:路由内部干的事是异步还是同步?**

```python
# ✅ 正确的 async def 用法:全程异步
import httpx

@app.get("/proxy")
async def proxy():
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://api.example.com/data")   # 异步 IO
    return resp.json()
```

```python
# ❌ 灾难:async def 里调用阻塞代码 → 事件循环被卡死,所有请求一起冻住
import requests

@app.get("/bad")
async def bad():
    resp = requests.get("https://api.example.com/data")   # requests 是阻塞的!
    return resp.json()

# ✅ 改法一:换成 def,自动进线程池
@app.get("/ok1")
def ok1():
    return requests.get("https://api.example.com/data").json()

# ✅ 改法二:保持 async,阻塞部分丢进线程
@app.get("/ok2")
async def ok2():
    resp = await asyncio.to_thread(requests.get, "https://api.example.com/data")
    return resp.json()

# ✅ 改法三(推荐):用异步 HTTP 库 httpx(见 5.6)
```

> **一句话总结:async def 里只能 await 异步库;出现任何同步阻塞调用(requests、同步 SQLAlchemy、time.sleep、大文件 CPU 处理),要么改成 def,要么用 `asyncio.to_thread` 丢给线程。**

> **补充:** 依赖函数(03 章)同样遵循此规则 —— async 依赖在事件循环,def 依赖在线程池。中间件则只能 async。

## 5.5 阻塞场景的四个解决方案

| 场景 | 推荐方案 |
| --- | --- |
| 数据库查询 | 用异步驱动:asyncpg/aiomysql(04 章),从根上消除阻塞 |
| 调用外部 HTTP 接口 | `httpx.AsyncClient`(替代 requests) |
| 第三方 SDK 只有同步版(OSS、Kafka 客户端) | `await asyncio.to_thread(...)` 丢线程池 |
| CPU 密集计算(图像处理、加密、ML 推理) | 单独进程/任务队列(Celery);小任务可用 ProcessPoolExecutor(5.8) |

```python
# 同步 SDK 包一层异步壳,给路由用
async def upload_to_oss(data: bytes) -> str:
    return await asyncio.to_thread(oss_client.put, data)
```

## 5.6 异步 HTTP 客户端:httpx

```bash
pip install httpx
```

### 客户端复用与超时

```python
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 应用启动时创建全局客户端 —— 连接池复用,千万不能每请求 new 一个
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, connect=5.0),   # 总超时 10s,连接超时 5s
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    )
    yield
    await app.state.http_client.aclose()            # 关闭时释放连接

app = FastAPI(lifespan=lifespan)

@app.get("/call")
async def call_external(request: Request):
    client = request.app.state.http_client
    r = await client.get("https://api.example.com/data")
    r.raise_for_status()          # 4xx/5xx 抛异常(按需)
    return r.json()
```

### 并发调用模板

```python
@app.get("/aggregate")
async def aggregate(request: Request):
    client = request.app.state.http_client
    # 并发调用,总耗时 = 最慢的那个
    r1, r2, r3 = await asyncio.gather(
        client.get("https://api1.example.com/x"),
        client.get("https://api2.example.com/x"),
        client.get("https://api3.example.com/x"),
    )
    return {"a": r1.json(), "b": r2.json(), "c": r3.json()}
```

### 重试机制

```python
import asyncio

async def get_with_retry(client: httpx.AsyncClient, url: str, retries: int = 3):
    for attempt in range(retries):
        try:
            r = await client.get(url)
            r.raise_for_status()
            return r.json()
        except (httpx.TimeoutException, httpx.HTTPStatusError) as e:
            if attempt == retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)   # 指数退避:1s、2s、4s
```

> **幂等性警告:** 重试只适用于 GET 或幂等的写操作(带幂等键);重复 POST 可能造成重复下单。

## 5.7 应用生命周期:lifespan 详解

5.6 用到了 lifespan,这里完整讲。旧版 `@app.on_event("startup")` 已废弃,统一用 lifespan:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- 启动阶段:在开始接受请求前执行 ----
    await init_db()                       # 初始化连接池
    app.state.redis = await init_redis()  # 全局资源挂到 app.state
    print("应用已启动")
    yield
    # ---- 关闭阶段:收到停机信号后执行 ----
    await app.state.redis.aclose()
    await close_db()
    print("应用已关闭")

app = FastAPI(lifespan=lifespan)
```

**规则:**

- `yield` 前:启动逻辑(异常会阻止应用启动)
- `yield` 后:关闭逻辑(优雅停机,处理完存量请求后执行)
- 只能有一个 lifespan;资源用 `app.state.xxx` 存储,路由通过 `request.app.state.xxx` 访问
- 适合:数据库连接池、HTTP client、Redis 连接、模型加载(ML 推理预热)

## 5.8 CPU 密集任务:进程池

CPU 密集计算放线程池没用(Python GIL 下多线程算不动 CPU),要放**进程池**:

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

process_pool = ProcessPoolExecutor(max_workers=4)   # 建议 ≤ CPU 核数

def heavy_compute(data):
    """CPU 密集函数。注意:必须顶层定义、参数可 pickle"""
    total = 0
    for i in range(10_000_000):
        total += i * i
    return total

@app.post("/compute")
async def compute(data: str):
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(process_pool, heavy_compute, data)
    return {"result": result}
```

**要点:**

- 进程池有创建开销、参数要可 pickle,不适合高频小任务
- 重计算(视频转码、报表生成、ML 推理)应放到**独立任务队列**(Celery/RQ),别放 Web 进程,否则抢占 Web 的 CPU
- 使用 `--workers N` 多进程部署时,重 CPU 接口会互相影响,压测确认

## 5.9 异步后台任务(BackgroundTasks)

请求返回后还需要干点活(发邮件、写日志),又不想阻塞用户:

```python
from fastapi import BackgroundTasks

def send_email(email: str, message: str):
    # 注意:同步函数会在线程池中执行
    print(f"发送邮件给 {email}: {message}")

@app.post("/register")
def register(email: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(send_email, email, "欢迎注册!")
    return {"message": "注册成功,邮件稍后发送"}
```

```python
# 支持 async 任务函数、多个任务
async def async_notify(user_id: int):
    await push_message(user_id, "您有新的关注者")

@app.post("/follow")
async def follow(user_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(async_notify, user_id)
    background_tasks.add_task(send_email, "a@x.com", "通知")
    return {"ok": True}
```

**要点:**

- 响应**发送给客户端之后**才执行,用户无感知;多个任务按添加顺序执行
- 依赖注入里的 `yield` 清理代码在后台任务**之前**执行 → 后台任务里别用已关闭的 session,任务内部自己开 session
- 任务量级判定:轻量(几十 ms~几 s、无需重试)用 BackgroundTasks;**重量级(几分钟、需要重试、独立扩容)上 Celery**,进程重启后 BackgroundTasks 里的任务直接丢失

### Celery 简介与选型

```bash
pip install celery redis
```

```python
# tasks.py
from celery import Celery

celery_app = Celery("myapp", broker="redis://localhost:6379/0",
                    backend="redis://localhost:6379/1")

@celery_app.task(bind=True, max_retries=3)
def send_batch_email(self, user_ids: list[int]):
    for uid in user_ids:
        try:
            send_one(uid)
        except Exception as exc:
            self.retry(exc=exc, countdown=60)   # 失败重试
```

| | BackgroundTasks | Celery |
| --- | --- | --- |
| 执行位置 | Web 进程内 | 独立 worker 进程 |
| 持久化 | ❌ 重启即丢 | ✅ broker 持久化 |
| 重试/定时 | ❌ | ✅ 内置 |
| 适用 | 轻量通知 | 重任务、异步流程 |

## 5.10 性能验证:自己动手测

```python
# benchmark.py —— 用异步客户端压测自己的接口
import time
import httpx
import asyncio

async def main():
    async with httpx.AsyncClient() as client:
        start = time.perf_counter()
        # 100 个并发请求
        responses = await asyncio.gather(*[
            client.get("http://127.0.0.1:8000/async-route") for _ in range(100)
        ])
        elapsed = time.perf_counter() - start
        print(f"100 个请求总耗时 {elapsed:.2f}s,即 {100/elapsed:.0f} req/s")

asyncio.run(main())
```

再用专业压测工具交叉验证:

```bash
# oha(推荐,rust 编写):50 并发打 10 秒
oha -c 50 -z 10s http://127.0.0.1:8000/async-route

# 对比实验:把 /sync-route 里的 time.sleep 从 1s 改成 5s,
# 用 100 并发打它,观察线程池(40 上限)耗尽后请求排队、延迟飙升的现象
```

**实验预期:** `/sync-route` 在 100 并发下,前 40 个立即进线程池,后 60 个排队;总吞吐受 40 线程限制。而 `/async-route` 若内部全异步,100 并发几乎同时完成。**这就是 def 与 async def 的真正差别。**

## 5.11 常见误区清单

1. ❌ "async 一定比 sync 快" —— 全异步链路才快,混入阻塞调用反而更糟
2. ❌ "await 之后代码就并行跑了" —— `await` 是等待,不是并行;并行要 gather/create_task
3. ❌ "async def 里的 time.sleep 没问题" —— 它会卡死整个事件循环,所有请求一起冻住
4. ❌ "def 路由性能差" —— def 路由在线程池,对阻塞代码是**正确**的选择
5. ❌ "把 ORM 查询改成 async 就快了" —— 还要看数据库本身、N+1 查询、索引;异步解决的是并发等待,不是算法问题
6. ❌ "BackgroundTasks 能当消息队列用" —— 进程重启任务就丢,重要任务上 Celery
7. ❌ "CPU 密集任务用 asyncio.to_thread 就行" —— GIL 限制,to_thread 算不动 CPU,要用进程池/独立 worker
8. ❌ "gather 1000 个请求很爽" —— 不加 Semaphore 会打爆上游和自己,批量并发必须限流
9. ❌ "asyncio.sleep 是精确计时" —— 事件循环忙时唤醒会延迟,不要用于精确计时
10. ❌ "async def 里直接调 async 函数忘记 await" —— 拿到的是协程对象,函数根本没执行,也不报错(只有 RuntimeWarning),是最隐蔽的 bug:

```python
# 错误示例:
async def handler():
    send_notification()      # ❌ 没 await,什么都没发生!
    return {"ok": True}

# 正确:
async def handler():
    await send_notification()      # ✅
    return {"ok": True}
```
