# Python 面向对象编程

## 1. 类与实例

```python
class Dog:
    species = "犬科"          # 类属性：所有实例共享

    def __init__(self, name, age):
        self.name = name     # 实例属性
        self.age = age

    def bark(self):
        return f"{self.name} 在叫"

d = Dog("旺财", 3)
print(d.name, d.age, d.bark(), d.species)
```

- `__init__` 是构造初始化方法（不是构造函数，对象此时已创建）。
- 所有实例方法第一个参数是 `self`（指向实例本身）。
- 类属性用 `类名.属性` 访问；`实例.属性 = 值` 只会创建实例属性，不修改类属性。

## 2. 属性访问与控制

### 2.1 属性查找顺序

实例属性 → 类属性 → 父类属性 → 抛 `AttributeError`。赋值时只在实例上创建新属性。

```python
class A:
    x = 1

a = A()
a.x          # 1（来自类属性）
a.x = 100    # 创建实例属性，类属性不变
A.x          # 1
```

### 2.2 property：方法变成属性

```python
class Temperature:
    def __init__(self, celsius):
        self._celsius = celsius

    @property
    def celsius(self):
        return self._celsius

    @property
    def fahrenheit(self):          # 只读属性
        return self._celsius * 9 / 5 + 32

    @celsius.setter
    def celsius(self, value):
        if value < -273.15:
            raise ValueError("低于绝对零度")
        self._celsius = value

    @celsius.deleter
    def celsius(self):
        del self._celsius

t = Temperature(25)
t.celsius           # 25
t.fahrenheit        # 77.0
t.celsius = 30      # setter 校验
del t.celsius       # deleter
```

> 惯例：私有属性用单下划线 `_name`（约定，非强制）；双下划线 `__name` 触发名称改写（name mangling），用于防止子类意外覆盖，如 `_ClassName__name`。

### 2.3 __slots__ 节省内存

```python
class Point:
    __slots__ = ("x", "y")     # 禁止动态添加属性，减少内存占用
    def __init__(self, x, y):
        self.x, self.y = x, y

p = Point(1, 2)
p.z = 3    # AttributeError
```

> 适用场景：创建大量实例（如百万级数据对象），可显著降低内存。代价：失去 `__dict__`、不能动态加属性。

## 3. 实例方法 / 类方法 / 静态方法

```python
class Math:
    pi = 3.14159

    def instance_method(self):          # 实例方法：能访问实例和类
        return self.pi

    @classmethod
    def class_method(cls):              # 类方法：只能访问类，不能访问实例
        return cls.pi

    @staticmethod
    def static_method():                # 静态方法：与类/实例都无关，只是逻辑归类
        return "与实例无关"

Math.class_method()    # 3.14159
Math.static_method()
Math().instance_method()
```

**类方法经典用法：替代构造函数**

```python
from datetime import date

class Person:
    def __init__(self, name, age):
        self.name, self.age = name, age

    @classmethod
    def from_birth_year(cls, name, year):
        return cls(name, date.today().year - year)

    @staticmethod
    def is_adult(age):
        return age >= 18

p = Person.from_birth_year("小明", 2000)   # 工厂方法
```

## 4. 继承

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return "..."

    def describe(self):
        return f"我叫 {self.name}"

class Dog(Animal):
    def speak(self):                      # 方法重写
        return "汪汪"

    def fetch(self):                      # 子类新增方法
        return f"{self.name} 叼回飞盘"

class Cat(Animal):
    def speak(self):
        return "喵"

d = Dog("旺财")
d.speak()          # 汪汪
d.describe()       # 我叫 旺财（继承父类方法）
d.fetch()
```

### 4.1 super() 调用父类

```python
class Animal:
    def __init__(self, name, age):
        self.name, self.age = name, age

class Dog(Animal):
    def __init__(self, name, age, breed):
        super().__init__(name, age)       # 调用父类构造
        self.breed = breed

    def describe(self):
        return super().describe() + f"，品种 {self.breed}"  # 扩展父类方法
```

### 4.2 多继承与 MRO

```python
class A:
    def hi(self):
        return "A"

class B:
    def hi(self):
        return "B"

class C(A, B):      # 方法解析顺序 MRO：C -> A -> B -> object
    pass

c = C()
c.hi()              # 'A'（按 MRO 顺序找第一个）
C.__mro__           # (<class 'C'>, <class 'A'>, <class 'B'>, <class 'object'>)
```

- MRO 使用 C3 线性化算法，保证父类只出现一次且保持声明顺序。
- 菱形继承（D(B, C)，B、C 都继承 A）中，`super()` 会沿 MRO 协作式调用，避免父类被重复初始化。
- 多继承容易踩坑，优先用**组合**（"有一个"）替代继承（"是一个"）。

### 4.3 isinstance / issubclass / type

```python
isinstance(d, Dog)        # True
isinstance(d, Animal)     # True（子类实例属于父类）
issubclass(Dog, Animal)   # True
type(d) is Dog            # True（精确类型判断）
```

## 5. 多态与鸭子类型

**多态**：同一方法在不同类上有不同实现，调用方不关心具体类型。

**鸭子类型**："如果它走路像鸭子、叫起来像鸭子，那它就是鸭子"——不要求继承关系，只要对象有相应方法即可。

```python
class Duck:
    def quack(self):
        return "呱呱"

class Person:
    def quack(self):
        return "我模仿鸭子叫"

def make_sound(thing):       # 不检查类型，只调用方法
    return thing.quack()

make_sound(Duck())       # 呱呱
make_sound(Person())     # 我模仿鸭子叫  ← 这就是鸭子类型
```

## 6. 抽象基类（ABC）

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self):
        """子类必须实现"""

class Square(Shape):
    def __init__(self, side):
        self.side = side
    def area(self):
        return self.side ** 2

Shape()          # TypeError：不能实例化抽象类
Square(4).area() # 16
```

- 抽象类定义"接口契约"，强制子类实现抽象方法。
- `collections.abc` 提供 `Iterable`、`Sequence`、`Mapping` 等抽象基类，可用 `isinstance(x, Iterable)` 做鸭子类型检查。

## 7. 魔术方法（双下划线方法）

### 7.1 构造与表示

```python
class Vector:
    def __init__(self, x, y):        # 构造
        self.x, self.y = x, y

    def __repr__(self):              # 调试用表示：repr(v)
        return f"Vector({self.x}, {self.y})"

    def __str__(self):               # 用户用表示：str(v) / print(v)
        return f"({self.x}, {self.y})"

    def __bool__(self):              # bool(v)
        return self.x != 0 or self.y != 0

    def __len__(self):               # len(v)
        return 2
```

### 7.2 运算符重载

```python
class Vector:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __add__(self, other):            # v + other
        return Vector(self.x + other.x, self.y + other.y)

    def __sub__(self, other):            # v - other
        return Vector(self.x - other.x, self.y - other.y)

    def __mul__(self, k):                # v * k
        return Vector(self.x * k, self.y * k)

    def __rmul__(self, k):               # k * v（左操作数不支持时调用）
        return self * k

    def __eq__(self, other):             # ==
        return self.x == other.x and self.y == other.y

    def __lt__(self, other):             # <（定义了即可用于排序）
        return (self.x ** 2 + self.y ** 2) < (other.x ** 2 + other.y ** 2)

    def __hash__(self):                  # 可哈希，才能放进 set / 做字典键
        return hash((self.x, self.y))

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

v1 = Vector(1, 2)
v2 = Vector(3, 4)
v1 + v2          # Vector(4, 6)
2 * v1           # Vector(2, 4)（走 __rmul__）
v1 == Vector(1, 2)   # True
```

### 7.3 比较运算全家桶

`functools.total_ordering` 只需实现 `__eq__` 和任意一个比较，其余自动补齐：

```python
from functools import total_ordering

@total_ordering
class Money:
    def __init__(self, amount):
        self.amount = amount

    def __eq__(self, other):
        return self.amount == other.amount

    def __lt__(self, other):
        return self.amount < other.amount

Money(5) <= Money(10)   # True，自动生成
```

### 7.4 容器协议

```python
class Inventory:
    def __init__(self, items):
        self._items = items

    def __getitem__(self, index):       # 支持 in、切片、迭代
        return self._items[index]

    def __setitem__(self, index, value):
        self._items[index] = value

    def __contains__(self, item):       # item in obj
        return item in self._items

    def __iter__(self):                 # for x in obj
        return iter(self._items)

    def __len__(self):                  # len(obj)
        return len(self._items)

inv = Inventory(["剑", "盾", "药水"])
inv[0]                # '剑'
"盾" in inv           # True
for i in inv: ...     # 迭代
len(inv)              # 3
```

### 7.5 上下文管理协议

```python
class Timer:
    def __enter__(self):                # with 进入时执行，返回值赋给 as 变量
        import time
        self.start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):   # with 退出时执行
        import time
        print(f"耗时 {time.perf_counter() - self.start:.4f}s")
        return False                    # 返回 True 表示吞掉异常

with Timer():
    sum(range(1000000))
```

### 7.6 其他常用魔术方法

```python
__call__          # 让实例可调用：obj()，常用于装饰器、可调用对象
__getattr__       # 属性不存在时调用
__setattr__       # 任何属性赋值时调用
__getattribute__  # 任何属性访问时调用（慎用，容易递归）
__new__           # 真正的构造函数（在 __init__ 之前），单例模式用它
__del__           # 对象被回收时调用（不保证立即执行）
__format__        # format(obj, spec)
__iter__ / __next__   # 迭代器协议
__enter__ / __exit__  # 上下文管理器协议
__hash__          # hash(obj)；定义 __eq__ 后默认不可哈希，需手动定义
__copy__ / __deepcopy__   # 自定义拷贝行为
```

### 7.7 __new__ 与单例模式

```python
class Singleton:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, value):
        self.value = value

a = Singleton(1)
b = Singleton(2)
a is b        # True，只有一个实例
```

## 8. 枚举

```python
from enum import Enum, auto

class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = auto()     # 自动编号 3

Color.RED.name      # 'RED'
Color.RED.value     # 1
Color(1)            # Color.RED
for c in Color:     # 遍历
    print(c.name, c.value)

class Status(IntEnum):    # IntEnum 可与整数比较
    OK = 200
    NOT_FOUND = 404
```

## 9. dataclass（Python 3.7+）

自动生成 `__init__`、`__repr__`、`__eq__` 等样板代码：

```python
from dataclasses import dataclass, field

@dataclass
class User:
    name: str
    age: int = 18                       # 默认值
    tags: list = field(default_factory=list)   # 可变默认值必须用 field
    id: int = field(init=False)         # 不参与 __init__

    def __post_init__(self):            # 初始化后钩子
        self.id = hash(self.name) % 10000

u1 = User("小明")
u2 = User("小明")
u1 == u2          # True（自动生成 __eq__）
print(u1)         # User(name='小明', age=18, tags=[], id=xxxx)
```

```python
@dataclass(frozen=True)     # 不可变（类似具名元组）
class Point:
    x: int
    y: int

@dataclass(order=True)      # 自动生成所有比较运算符
class Item:
    price: float
```

## 10. 设计原则小贴士

| 原则 | 说明 |
| ---- | ---- |
| 单一职责 | 一个类只做一件事 |
| 开闭原则 | 对扩展开放，对修改关闭（多用组合、少改原类） |
| 组合优于继承 | `class Engine` 组合进 `class Car`，而非 Car 继承 Engine |
| 依赖倒置 | 依赖抽象接口，不依赖具体实现 |
| 信息隐藏 | 属性加 `_` 前缀，通过 property 暴露受控访问 |

## 11. 实战：完整的小案例

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

class Payment(ABC):                     # 抽象基类定义支付接口
    @abstractmethod
    def pay(self, amount: float) -> str: ...

@dataclass
class Card(Payment):                    # 信用卡支付
    name: str
    def pay(self, amount):
        return f"{self.name} 刷卡支付 {amount} 元"

class Wallet(Payment):                  # 钱包支付
    def __init__(self, balance):
        self._balance = balance
    @property
    def balance(self):
        return self._balance
    def pay(self, amount):
        if amount > self._balance:
            raise ValueError("余额不足")
        self._balance -= amount
        return f"钱包支付 {amount} 元，余额 {self._balance}"

def checkout(payment: Payment, amount: float):   # 面向接口编程
    return payment.pay(amount)

checkout(Card("Visa"), 99.9)
checkout(Wallet(500), 88.8)
```
