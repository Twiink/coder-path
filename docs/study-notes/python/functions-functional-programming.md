# Python 函数与函数式编程

## 1. 函数定义与调用

```python
def add(a, b):
    """两数相加"""
    return a + b

add(1, 2)          # 3
```

- 函数是一等公民：可赋值给变量、作为参数传递、作为返回值。
- 没有 `return` 时返回 `None`。

## 2. 参数传递

### 2.1 参数类型

```python
def f(a, b=10, *args, c, d=20, **kwargs):
    """a: 位置参数；b: 默认参数；*args: 多余位置参数打包为元组
       c: 仅限关键字参数；d: 带默认值的关键字参数；**kwargs: 多余关键字打包为字典"""
    print(a, b, args, c, d, kwargs)

f(1, 2, 3, 4, c=5)                 # 1 2 (3, 4) 5 20 {}
f(1, c=5, x=9)                     # 1 10 () 5 20 {'x': 9}
f(1, 2, 3, 4, c=5, d=6, e=7)       # 1 2 (3, 4) 5 6 {'e': 7}
```

### 2.2 解包调用

```python
def add(a, b, c):
    return a + b + c

add(*[1, 2, 3])        # 6，列表解包为位置参数
add(**{"a": 1, "b": 2, "c": 3})   # 6，字典解包为关键字参数
```

### 2.3 仅限位置参数（Python 3.8+）

```python
def f(a, b, /, c, *, d):
    """a、b 只能按位置传；c 位置/关键字均可；d 只能按关键字传"""
    pass

f(1, 2, 3, d=4)    # OK
f(1, 2, c=3, d=4)  # OK
f(a=1, b=2, c=3, d=4)  # 报错：a、b 不能按关键字传
```

### 2.4 可变默认参数陷阱

```python
def bad(x, lst=[]):        # ❌ 默认列表在所有调用间共享
    lst.append(x)
    return lst

def good(x, lst=None):     # ✅ 每次调用创建新列表
    if lst is None:
        lst = []
    lst.append(x)
    return lst

bad(1)  # [1]
bad(2)  # [1, 2] ← 出问题了
```

## 3. 返回值

```python
def stats(data):
    return len(data), sum(data) / len(data)   # 返回元组

n, avg = stats([1, 2, 3])   # 自动解包
```

## 4. 作用域与闭包

### 4.1 LEGB 查找规则

变量查找顺序：**Local（局部）→ Enclosing（外层函数）→ Global（全局）→ Built-in（内置）**

```python
x = "global"          # 全局

def outer():
    x = "enclosing"   # 外层
    def inner():
        x = "local"   # 局部
        return x
    return inner()
```

### 4.2 global 与 nonlocal

```python
count = 0

def inc():
    global count      # 声明修改全局变量
    count += 1

def outer():
    n = 0
    def inner():
        nonlocal n    # 声明修改外层函数变量
        n += 1
        return n
    return inner
```

> 只读全局变量不需要 `global`，只有赋值/修改时才需要。

## 5. 闭包

**闭包 = 内层函数 + 捕获的外层变量（自由变量）**。即使外层函数已返回，内层函数仍能访问并记住那些变量。

```python
def make_counter():
    count = 0                    # 自由变量，被内层函数捕获
    def counter():
        nonlocal count
        count += 1
        return count
    return counter

c1 = make_counter()
c2 = make_counter()              # 每个闭包独立持有自己的 count
c1()  # 1
c1()  # 2
c2()  # 1
```

### 5.1 闭包的应用

```python
# 1. 函数工厂：生成带配置的函数
def make_multiplier(n):
    return lambda x: x * n

double = make_multiplier(2)
double(10)          # 20

# 2. 延迟计算
def lazy_power(base, exp):
    def calc():
        return base ** exp
    return calc

# 3. 避免循环中延迟绑定的坑
funcs = [lambda: i ** 2 for i in range(3)]
[f() for f in funcs]        # [4, 4, 4] ← i 是同一个变量，循环结束后为 2

funcs2 = [lambda i=i: i ** 2 for i in range(3)]   # 用默认参数绑定当前值
[f() for f in funcs2]       # [0, 1, 4]
```

### 5.2 闭包实现缓存（记忆化）

```python
def memoize(fn):
    cache = {}
    def wrapper(*args):
        if args not in cache:
            cache[args] = fn(*args)
        return cache[args]
    return wrapper

@memoize
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
```

## 6. 装饰器

**装饰器是一个接受函数并返回新函数的可调用对象**，用于在不修改原函数代码的前提下增强其功能。语法糖 `@decorator` 等价于 `func = decorator(func)`。

### 6.1 基础装饰器

```python
import time
import functools

def timer(func):
    @functools.wraps(func)          # 保留原函数的 __name__、__doc__ 等元信息
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__} 耗时 {time.perf_counter() - start:.4f}s")
        return result
    return wrapper

@timer
def slow_add(a, b):
    """两数相加"""
    time.sleep(0.1)
    return a + b

slow_add(1, 2)          # 输出耗时，返回 3
print(slow_add.__name__)  # slow_add（因为用了 @functools.wraps）
```

> 为什么必须 `@functools.wraps`：不加的话 `slow_add.__name__` 会变成 `wrapper`，且丢失文档字符串，影响调试和部分库（如 Sphinx、Flask）。

### 6.2 带参数的装饰器

```python
def repeat(times):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(times):
                func(*args, **kwargs)
        return wrapper
    return decorator

@repeat(3)
def say_hi():
    print("hi")

say_hi()   # 打印 3 次 hi
```

### 6.3 类实现装饰器

```python
class CountCalls:
    def __init__(self, func):
        functools.update_wrapper(self, func)
        self.func = func
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.func(*args, **kwargs)

@CountCalls
def f():
    pass

f(); f()
f.calls      # 2
```

### 6.4 带参数的类装饰器

```python
class Retry:
    def __init__(self, times=3):
        self.times = times

    def __call__(self, func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for i in range(self.times):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last = e
            raise last
        return wrapper

@Retry(times=5)
def flaky():
    ...
```

### 6.5 多个装饰器叠加

```python
@decorator_b        # 先应用（最外层）
@decorator_a        # 后应用
def f(): ...

# 等价于 f = decorator_b(decorator_a(f))
# 执行顺序：装饰器从下往上应用，调用时从上往下
```

### 6.6 类方法装饰器 @staticmethod / @classmethod / @property

```python
class Circle:
    def __init__(self, radius):
        self._radius = radius

    @staticmethod                       # 静态方法：与实例无关
    def area_formula():
        return 3.14159

    @classmethod                        # 类方法：第一个参数是类
    def from_diameter(cls, d):
        return cls(d / 2)

    @property                           # 属性：把方法变成只读属性
    def area(self):
        return 3.14159 * self._radius ** 2

    @area.setter                        # 属性 setter：校验赋值
    def area(self, value):
        raise ValueError("area 只读")

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value <= 0:
            raise ValueError("半径必须为正")
        self._radius = value

c = Circle.from_diameter(4)   # 类方法构造
c.radius = 5                  # setter 校验
c.area                        # 属性访问，无需括号
```

### 6.7 常用内置装饰器与工具

```python
from functools import lru_cache, cached_property, singledispatch

@lru_cache(maxsize=128)       # 缓存函数结果（参数须可哈希）
def expensive(n):
    return n * n

class Box:
    @cached_property           # 首次访问后缓存到实例上（3.8+）
    def heavy(self):
        return [0] * 100000

@singledispatch                # 单分派泛型：按第一个参数类型分派
def handle(x):
    return f"默认: {x}"

@handle.register
def _(x: int):
    return f"整数: {x}"

@handle.register
def _(x: str):
    return f"字符串: {x}"

handle(1)      # '整数: 1'
handle("a")    # '字符串: a'
handle(1.5)    # '默认: 1.5'
```

## 7. 匿名函数 lambda

```python
f = lambda x, y: x + y     # 只能写单个表达式，不能含语句
f(1, 2)                    # 3

# 典型场景：作为参数
sorted([(1, 2), (3, 1)], key=lambda t: t[1])
list(map(lambda x: x * 2, [1, 2, 3]))
list(filter(lambda x: x % 2 == 0, range(10)))
```

## 8. 高阶函数

```python
# map / filter / reduce
list(map(str, [1, 2, 3]))            # ['1', '2', '3']
list(filter(None, [0, 1, "", "a"]))  # [1, 'a']
from functools import reduce
reduce(lambda a, b: a + b, [1, 2, 3, 4])   # 10

# 部分函数
from functools import partial
def power(base, exp): return base ** exp
square = partial(power, exp=2)
square(5)              # 25
```

> 现代 Python 更推荐用推导式/生成器表达式替代 map/filter（可读性更好），reduce 用循环替代。列表推导 `[x*2 for x in lst]` 优于 `list(map(...))`。

## 9. 迭代器

**迭代器**是实现了 `__iter__` 和 `__next__` 的对象，用 `next()` 逐个取值，取完抛 `StopIteration`。

```python
lst = [1, 2, 3]
it = iter(lst)          # 拿到迭代器
next(it)                # 1
next(it)                # 2
next(it)                # 3
next(it)                # StopIteration
```

- 迭代器是**一次性**的，遍历完不能重来。
- 可迭代对象（list、dict、str、range 等）都能被 `iter()` 转成迭代器。

自定义迭代器：

```python
class CountDown:
    def __init__(self, n):
        self.n = n

    def __iter__(self):
        return self

    def __next__(self):
        if self.n <= 0:
            raise StopIteration
        self.n -= 1
        return self.n + 1

for x in CountDown(3):   # 3, 2, 1
    print(x)
```

## 10. 生成器

**生成器**是用 `yield` 写的迭代器，惰性求值，一次只产生一个值，节省内存。

```python
def count_up(n):
    i = 0
    while i < n:
        yield i          # 每次 next() 执行到这里暂停，保存状态
        i += 1

g = count_up(3)
next(g)      # 0
next(g)      # 1
list(count_up(3))   # [0, 1, 2]
```

### 10.1 生成器表达式

```python
g = (x ** 2 for x in range(10))   # 圆括号，惰性
sum(x ** 2 for x in range(10))    # 285，sum 直接吃生成器

# 对比列表推导：生成器不一次性建出全部元素
```

### 10.2 yield 接收值（双向通信）

```python
def echo():
    while True:
        received = yield       # yield 右侧可接收 send 进来的值
        print(f"收到: {received}")

g = echo()
next(g)          # 启动到第一个 yield
g.send("hello")  # 打印 收到: hello
```

### 10.3 yield from 委托

```python
def chain(*iters):
    for it in iters:
        yield from it      # 把子迭代器的值逐个产出

list(chain([1, 2], [3, 4]))   # [1, 2, 3, 4]
```

### 10.4 生成器应用场景

```python
# 1. 处理大文件（不会一次性读入内存）
def read_lines(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            yield line.strip()

# 2. 无限序列
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

# 3. 惰性管道
nums = (int(x) for x in data)
filtered = (x for x in nums if x > 0)
squares = (x * x for x in filtered)
```

### 10.5 itertools 常用工具

```python
import itertools

itertools.chain([1, 2], [3])        # 串联
itertools.islice(gen, 10)           # 切片生成器
itertools.cycle("AB")               # 无限循环
itertools.repeat(7, 3)              # 重复
itertools.groupby(data, key)        # 分组（需先排序）
itertools.permutations("ABC", 2)    # 排列
itertools.combinations("ABC", 2)    # 组合
itertools.product([1, 2], "ab")     # 笛卡尔积
itertools.count(10, 2)              # 无限等差序列
itertools.zip_longest(a, b)         # 长 zip，短序列补 None
```

## 11. 递归

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

- 默认递归深度上限约 1000，可用 `sys.setrecursionlimit()` 调整（有栈溢出风险）。
- 深递归优先改写为循环或迭代。

## 12. 实战示例：登录重试装饰器

```python
def retry_on_exception(retries=3, delay=0.5, exceptions=(Exception,)):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == retries:
                        raise
                    print(f"第 {attempt} 次失败: {e}，{delay}s 后重试")
                    time.sleep(delay)
        return wrapper
    return decorator

@retry_on_exception(retries=3)
def login(user, pwd):
    # 模拟可能失败的请求
    ...
```

## 13. 核心概念总结

| 概念 | 一句话 |
| ---- | ------ |
| 闭包 | 内层函数记住外层变量，即使外层已返回 |
| 装饰器 | 不改原函数代码，动态增强函数功能的函数 |
| 迭代器 | 有 `__next__`、可被 `next()` 逐个取值的对象 |
| 生成器 | 用 `yield` 惰性产值的迭代器，节省内存 |
| 高阶函数 | 接收函数或返回函数的函数 |
| lambda | 单表达式匿名函数 |
