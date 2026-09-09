# Python 进阶特性

## 1. 异常处理

### 1.1 基本结构

```python
try:
    num = int(input("输入数字: "))
    result = 100 / num
except ValueError:
    print("不是合法数字")
except ZeroDivisionError:
    print("不能除以零")
except (TypeError, OverflowError) as e:    # 捕获多种异常
    print(f"其他错误: {e}")
else:
    print(f"结果: {result}")    # 无异常时执行
finally:
    print("无论是否异常都执行")   # 资源清理
```

### 1.2 常见内置异常

| 异常 | 触发场景 |
| ---- | -------- |
| `ValueError` | 值不合法（如 `int("abc")`） |
| `TypeError` | 类型不匹配（如 `1 + "a"`） |
| `KeyError` | 字典键不存在 |
| `IndexError` | 下标越界 |
| `AttributeError` | 属性/方法不存在 |
| `ZeroDivisionError` | 除零 |
| `FileNotFoundError` | 文件不存在 |
| `ImportError` / `ModuleNotFoundError` | 导入失败 |
| `StopIteration` | 迭代器取完 |
| `KeyboardInterrupt` | Ctrl+C 中断 |
| `AssertionError` | 断言失败 |

异常继承树：所有异常继承自 `BaseException`，业务异常继承 `Exception`。**捕获时不要用裸 `except:`**，应精确指定异常类型或 `except Exception`。

### 1.3 自定义异常

```python
class InsufficientBalanceError(Exception):
    """余额不足异常"""
    def __init__(self, balance, amount):
        self.balance = balance
        self.amount = amount
        super().__init__(f"余额 {balance} 不足，需要 {amount}")

raise InsufficientBalanceError(10, 100)
```

### 1.4 异常链与抛出

```python
try:
    ...
except ValueError as e:
    raise RuntimeError("处理数据失败") from e   # 保留原始异常链
    # 或 raise ... from None   # 隐藏原始异常

# 重新抛出当前异常
try:
    ...
except Exception:
    logger.exception("出错了")   # 记录完整堆栈
    raise                        # 不带参数重新抛出
```

### 1.5 断言

```python
assert age >= 0, "年龄不能为负"    # 条件为假时抛 AssertionError
# 注意：python -O 运行时断言会被移除，勿用于业务校验
```

## 2. 上下文管理器

自动管理资源（文件、锁、数据库连接），保证异常时也能正确释放。

### 2.1 with 语句

```python
# 文件
with open("data.txt", encoding="utf-8") as f:
    content = f.read()        # 退出 with 自动关闭文件

# 锁
import threading
lock = threading.Lock()
with lock:                    # 自动 acquire / release
    ...

# 多上下文
with open("a.txt") as fa, open("b.txt") as fb:
    ...

# 括号换行（Python 3.10+）
with (
    open("a.txt") as fa,
    open("b.txt") as fb,
):
    ...
```

### 2.2 contextlib 工具

```python
from contextlib import contextmanager, suppress, redirect_stdout

# 1. 生成器写法（推荐）
@contextmanager
def open_file(path):
    f = open(path, encoding="utf-8")
    try:
        yield f                  # yield 之前的代码在进入 with 时执行
    finally:
        f.close()                # 之后的代码在退出时执行（无论是否异常）

with open_file("data.txt") as f:
    ...

# 2. 忽略特定异常
with suppress(FileNotFoundError):    # 等价 try/except pass
    os.remove("tmp.txt")

# 3. 重定向输出
import sys
with redirect_stdout(sys.stderr):
    print("去 stderr 了")

# 4. 计时
from contextlib import ContextDecorator

class LogTime(ContextDecorator):
    def __enter__(self): ...
    def __exit__(self, *exc): ...

@LogTime()          # 装饰函数时自动包 with
def slow_func(): ...
```

## 3. 深浅拷贝回顾

```python
import copy

a = [[1, 2], [3, 4]]
b = a                    # 引用，完全共享
c = copy.copy(a)         # 浅拷贝：外层新列表，内层共享
d = copy.deepcopy(a)     # 深拷贝：完全独立

b[0].append(99)   # a、c 都变
d[0].append(99)   # a 不变
```

- 不可变对象（int/str/tuple）不需要拷贝。
- 自定义类实现 `__copy__` / `__deepcopy__` 可控制拷贝行为。

## 4. 类型提示（Type Hints）

Python 是动态类型语言，类型提示只做标注和静态检查（mypy/pyright），**不影响运行时**。

### 4.1 基础标注

```python
def add(a: int, b: int) -> int:
    return a + b

name: str = "Python"
scores: list[int] = [90, 85]        # 3.9+；3.8 用 List[int]（from typing import List）
```

### 4.2 typing 常用泛型

```python
from typing import Optional, Union, Any, Callable, Literal, TypedDict, Protocol

x: Optional[int] = None        # 等价 int | None
y: Union[int, str] = 1         # 等价 int | str（3.10+ 可用 | 语法）
z: Any = anything              # 跳过检查
f: Callable[[int, int], int] = add    # 函数类型
mode: Literal["r", "w", "a"] = "r"    # 字面量限制

# 自定义类型别名
UserId = int
Vector = list[float]

# 泛型函数
from typing import TypeVar
T = TypeVar("T")

def first(items: list[T]) -> T:
    return items[0]

first([1, 2])    # T 推断为 int
```

### 4.3 TypedDict 与 Protocol

```python
from typing import TypedDict, Protocol

class User(TypedDict):        # 字典的结构化标注
    name: str
    age: int

u: User = {"name": "小明", "age": 18}

class HasSpeak(Protocol):     # 结构化子类型（鸭子类型标注）
    def speak(self) -> str: ...

def announce(thing: HasSpeak) -> None:
    print(thing.speak())
```

### 4.4 运行期检查

```python
# 普通类型提示不影响运行；需要运行期强制可用 pydantic / attrs

from typing import get_type_hints

def f(x: int) -> str:
    return str(x)

get_type_hints(f)   # {'x': int, 'return': str}
```

## 5. 迭代器与生成器补充

```python
# 反向迭代
for x in reversed([1, 2, 3]): ...

# 并行迭代
for a, b in zip(xs, ys, strict=True): ...   # strict=True（3.10+）长度不一致抛错

# 带索引迭代
for i, v in enumerate(data, start=1): ...

# 高级解包
head, *middle, tail = [1, 2, 3, 4, 5]   # head=1, middle=[2,3,4], tail=5
```

## 6. 并发编程

### 6.1 三种并发方式对比

| 方式 | 适用场景 | 特点 |
| ---- | -------- | ---- |
| threading | IO 密集（网络、文件） | 受 GIL 限制，多核无加速；线程切换开销小 |
| multiprocessing | CPU 密集（计算） | 多进程真并行，进程间通信开销大 |
| asyncio | 高并发 IO（爬虫、服务器） | 单线程协程，极低开销，需异步库配合 |

### 6.2 多线程 threading

```python
import threading
import time

def worker(name, delay):
    time.sleep(delay)
    print(f"{name} 完成")

threads = [threading.Thread(target=worker, args=(f"线程{i}", i)) for i in range(3)]
for t in threads:
    t.start()
for t in threads:
    t.join()            # 等待所有线程结束
```

线程安全：共享数据用 `threading.Lock` 保护。

```python
lock = threading.Lock()
count = 0

def inc():
    global count
    with lock:          # with 形式自动获取/释放
        count += 1
```

### 6.3 线程池 / 进程池

```python
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

def fetch(url):
    ...

with ThreadPoolExecutor(max_workers=10) as pool:
    results = pool.map(fetch, urls)          # 阻塞式批量
    # 或
    futures = [pool.submit(fetch, u) for u in urls]
    for f in futures:
        print(f.result())
```

### 6.4 多进程 multiprocessing

```python
from multiprocessing import Pool

def cpu_task(n):
    return sum(range(n))

if __name__ == "__main__":
    with Pool(4) as p:          # 4 个进程
        print(p.map(cpu_task, [10**6] * 4))
```

> 注意：Windows/macOS 下多进程代码必须放在 `if __name__ == "__main__":` 里（macOS 默认 spawn 启动方式）。

### 6.5 GIL 全局解释器锁

- 同一时刻只有一个线程执行 Python 字节码，**纯计算多线程不加速**。
- IO 操作（网络、磁盘）会释放 GIL，所以 IO 密集场景多线程依然有效。
- 绕过方式：多进程、C 扩展（numpy 等内部释放 GIL）、`asyncio`。

## 7. 异步编程 asyncio

### 7.1 基本用法（Python 3.7+）

```python
import asyncio

async def fetch(name, delay):
    await asyncio.sleep(delay)          # 遇到 await 让出控制权
    return f"{name} 完成"

async def main():
    # 并发执行
    results = await asyncio.gather(
        fetch("任务A", 1),
        fetch("任务B", 2),
    )
    print(results)

asyncio.run(main())     # 3.7+ 统一入口
```

### 7.2 协程与任务

```python
async def main():
    task = asyncio.create_task(fetch("后台任务", 3))   # 创建任务，不阻塞
    await asyncio.sleep(1)
    await task            # 等待任务完成
    # 超时控制
    try:
        await asyncio.wait_for(fetch("慢任务", 10), timeout=2)
    except asyncio.TimeoutError:
        print("超时")
```

### 7.3 异步上下文管理器与迭代器

```python
# 异步上下文管理器（aiohttp、async 数据库连接等）
async with session.get(url) as resp:
    data = await resp.text()

# 异步迭代器
async for chunk in stream:
    ...
```

> 关键认知：`async` 函数中不能调用阻塞的同步函数（会卡住整个事件循环）；需要配合异步库（aiohttp、httpx、asyncpg 等）。CPU 密集任务在协程中同样卡循环，应交给进程池。

## 8. 元类与动态特性

> 元类是"创建类的类"。`type` 是万物之源：所有类都是 `type` 的实例。

```python
class Meta(type):
    def __new__(cls, name, bases, namespace):
        namespace["created_by_meta"] = True     # 给所有子类注入属性
        return super().__new__(cls, name, bases, namespace)

class MyClass(metaclass=Meta):     # 指定元类
    pass

MyClass.created_by_meta    # True
```

```python
# 动态创建类
MyClass = type("MyClass", (Base,), {"attr": 1})
# 等价于 class MyClass(Base): attr = 1

# 动态创建函数
dynamic_func = eval("lambda x: x * 2")    # 慎用 eval/exec（安全风险）
```

### 8.1 元类实战：ORM 式字段定义

```python
class Field:
    def __init__(self, default=None):
        self.default = default

class ModelMeta(type):
    def __new__(cls, name, bases, namespace):
        fields = {}
        for k, v in namespace.items():
            if isinstance(v, Field):
                fields[k] = v
                namespace.pop(k)
        namespace["_fields"] = fields
        return super().__new__(cls, name, bases, namespace)

class Model(metaclass=ModelMeta):
    pass

class User(Model):
    name = Field(default="匿名")
    age = Field(default=0)

User._fields     # {'name': Field(...), 'age': Field(...)}
```

> 日常开发几乎不需要自己写元类，但理解它有助于理解 ORM（SQLAlchemy、Django ORM）、dataclass、`enum` 等框架的实现原理。

## 9. 常用标准库速览

### 9.1 文件与路径

```python
import os, sys, glob, shutil

os.getcwd()                # 当前目录
os.mkdir("newdir")         # 创建目录
os.remove("a.txt")         # 删除文件
os.path.join("a", "b")     # 路径拼接（跨平台）
os.path.exists("a.txt")
os.listdir(".")

from pathlib import Path    # 3.4+，面向对象路径（推荐）
p = Path("data/report.txt")
p.name          # report.txt
p.suffix        # .txt
p.parent        # data
p.exists()      # 是否存在
p.read_text()   # 读文本
p.write_text()  # 写文本
p.mkdir(parents=True, exist_ok=True)
p.glob("*.py")  # 通配匹配

# 递归删除目录树
import shutil
shutil.rmtree("tmpdir", ignore_errors=True)
```

### 9.2 时间与日期

```python
from datetime import datetime, date, time, timedelta, timezone

now = datetime.now()                # 本地当前时间
now.strftime("%Y-%m-%d %H:%M:%S")   # 格式化
datetime.strptime("2024-01-01", "%Y-%m-%d")   # 解析字符串
now + timedelta(days=7)             # 日期运算
now.timestamp()                     # 时间戳

import time
time.sleep(1)               # 休眠
time.perf_counter()         # 高精度计时
```

### 9.3 正则表达式

```python
import re

pattern = r"\d{3}-\d{8}"           # 建议用原始字符串

re.search(pattern, "电话 010-12345678")   # 匹配第一个，返回 Match 或 None
re.match(pattern, "010-12345678")         # 从开头匹配
re.findall(r"\d+", "a1b22c333")           # ['1', '22', '333']
re.sub(r"\s+", " ", "a   b")              # 'a b'
re.split(r"[,;]", "a,b;c")                # ['a', 'b', 'c']
re.fullmatch(r"\d{3}", "123")             # 完全匹配

# 捕获组
m = re.search(r"(\d{4})-(\d{2})-(\d{2})", "2024-05-01")
m.group(1)        # '2024'
m.groups()        # ('2024', '05', '01')

# 预编译
phone = re.compile(r"\d{3}-\d{8}")
phone.findall("a 010-12345678 b")
```

常用正则语法：`\d` 数字、`\w` 单词字符、`\s` 空白、`.` 任意字符（除换行）、`*` `+` `?` 量词、`&#123;n,m&#125;` 次数、`[...]` 字符类、`^` `$` 锚点、`(?:...)` 非捕获组、`(?P&lt;name&gt;...)` 命名组、`re.IGNORECASE` 等标志。

### 9.4 JSON 与序列化

```python
import json

data = {"name": "小明", "scores": [90, 85]}

json.dumps(data, ensure_ascii=False, indent=2)   # 转字符串（中文不转义）
json.loads('{"a": 1}')                            # 解析字符串
json.dump(data, open("data.json", "w", encoding="utf-8"))
json.load(open("data.json", encoding="utf-8"))

import pickle    # Python 专属序列化（不安全，勿反序列化不可信数据）
```

### 9.5 其他常用模块

```python
import math      # math.sqrt, math.pi, math.ceil, math.floor, math.gcd
import random    # random.randint(a,b), random.choice(x), random.shuffle(x)
import hashlib   # hashlib.md5(b"x").hexdigest(), hashlib.sha256(b"x").hexdigest()
import logging   # 日志：logging.basicConfig(level=logging.INFO); logging.info("...")
import argparse  # 命令行参数解析
import unittest  # 单元测试（或 pytest 第三方）
import dataclasses, enum, collections, itertools, functools, contextlib, typing
import subprocess    # 运行外部命令
import sqlite3       # 内置 SQLite
```

## 10. 性能与优化

### 10.1 内置数据结构选择

```python
# 列表 vs 集合/字典
lst = list(range(10000))
s = set(lst)
9000 in lst     # O(n)
9000 in s       # O(1)，快得多

# 栈：list.append/pop；队列：collections.deque
from collections import deque
dq = deque()
dq.append(1); dq.popleft()     # O(1)
```

### 10.2 常用优化手段

```python
# 1. 局部变量化：函数内重复使用的全局查找改局部
def f(items):
    append = items.append          # 把方法绑定到局部变量
    for x in range(1000):
        append(x)

# 2. 生成器惰性求值省内存
sum(x * x for x in range(10**6))   # 不创建 100 万元素列表

# 3. 字符串拼接用 join
s = "".join(chr(i) for i in range(65, 91))

# 4. 用内置函数/标准库，别自己造轮子
# bisect、heapq、statistics、itertools 等

# 5. 需要速度的热点代码用 numpy（C 实现）
import numpy as np
arr = np.array([1, 2, 3])
```

### 10.3 性能测量

```python
import timeit

timeit.timeit("'-'.join(map(str, range(100)))", number=10000)

# cProfile 分析
import cProfile
cProfile.run("sum(range(10**6))")
```

## 11. 常用开发工具链

| 工具 | 用途 |
| ---- | ---- |
| pip | 包管理：`pip install requests`、`pip freeze > requirements.txt` |
| venv | 虚拟环境：`python -m venv .venv`，隔离项目依赖 |
| mypy / pyright | 静态类型检查 |
| ruff / flake8 / pylint | 代码规范检查 |
| black / yapf | 代码格式化 |
| pytest | 单元测试框架（推荐） |
| ipython / jupyter | 交互式开发 |
| requests / httpx | HTTP 客户端 |
| numpy / pandas | 数值计算与数据分析 |
| django / flask / fastapi | Web 开发 |

## 12. 常见进阶陷阱

| 陷阱 | 原因与对策 |
| ---- | ---------- |
| 可变对象做默认参数 | 默认值在定义时创建一次，共享；改 `None` |
| 循环内 lambda 延迟绑定 | 闭包捕获的是变量而非值；用默认参数绑定 |
| `is` 比较数值/字符串 | 只对 `None` 用 `is` |
| 类属性 vs 实例属性混淆 | 可变类属性会被所有实例共享，注意区分 |
| `except:` 吞掉所有异常 | 连 `KeyboardInterrupt` 都吞；改 `except Exception` |
| 在函数内给全局变量赋值报错 | 忘记 `global` 声明 |
| 修改列表时遍历列表 | 遍历副本 `for x in lst[:]` 或先收集再删 |
| `and`/`or` 返回的不是布尔 | 返回的是操作数本身（短路求值），用 `bool()` 包裹 |
| 异步代码里调用阻塞函数 | 卡死事件循环；用异步库或 `asyncio.to_thread` |
| 反序列化不可信 pickle | 可执行任意代码；改用 JSON |
