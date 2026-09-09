# Python 基础语法

## 1. Python 简介与环境

- Python 是一种解释型、动态类型、面向对象的编程语言，语法简洁，生态丰富。
- 版本：Python 2 已于 2020 年停止维护，**一律使用 Python 3**。
- 运行方式：
  - 交互式：终端输入 `python`（或 `python3`）进入 REPL；
  - 脚本：`python hello.py`；
  - 指定解释器执行：`python3 -m script`（以模块方式运行，常用于包内脚本）。

```python
# 第一个程序
print("Hello, World!")
```

## 2. 注释与编码

```python
# 单行注释

"""
多行注释（本质是字符串字面量，
常用于函数/模块文档说明）
"""

# -*- coding: utf-8 -*-   # Python3 默认 UTF-8，无需声明
```

## 3. 变量与数据类型

### 3.1 变量

- 变量不需要声明类型，直接赋值即可，类型由赋值自动推断。
- 命名规则：字母、数字、下划线，不能以数字开头，不能是关键字。
- 命名风格：变量用小写+下划线（`user_name`），常量用全大写（`MAX_SIZE`）。

```python
name = "Python"     # str
age = 30            # int
pi = 3.14           # float
is_ok = True        # bool
data = None         # NoneType

# 多重赋值 / 交换
a, b = 1, 2
a, b = b, a         # 交换 a、b
```

### 3.2 基本数据类型

| 类型 | 说明 | 示例 |
| ---- | ---- | ---- |
| `int` | 整数，无长度限制 | `42` |
| `float` | 浮点数 | `3.14` |
| `complex` | 复数 | `1 + 2j` |
| `bool` | 布尔值 | `True` / `False` |
| `str` | 字符串（不可变） | `"hello"` |
| `bytes` | 字节串（不可变） | `b"hello"` |
| `list` | 列表（可变，有序） | `[1, 2, 3]` |
| `tuple` | 元组（不可变，有序） | `(1, 2, 3)` |
| `dict` | 字典（可变，键值对） | (&#123;"a": 1&#125;) |
| `set` / `frozenset` | 集合（无序不重复） | `&#123;1, 2&#125;` |
| `NoneType` | 空值 | `None` |

### 3.3 类型转换

```python
int("42")          # 42
float("3.14")      # 3.14
str(100)           # "100"
bool(0)            # False，非零数字、非空容器为 True
list("abc")        # ['a', 'b', 'c']
tuple([1, 2])      # (1, 2)
set([1, 1, 2])     # {1, 2}
ord("A")           # 65，字符转码点
chr(65)            # 'A'，码点转字符
```

### 3.4 判断类型

```python
type(1)            # <class 'int'>
isinstance(1, int) # True（推荐，支持继承关系判断）
```

## 4. 运算符

### 4.1 算术运算符

| 运算符 | 含义 | 示例 |
| ------ | ---- | ---- |
| `+` `-` `*` `/` | 加减乘除 | `7 / 2 == 3.5` |
| `//` | 整除（向下取整） | `7 // 2 == 3`，`-7 // 2 == -4` |
| `%` | 取余 | `7 % 2 == 1` |
| `**` | 幂 | `2 ** 10 == 1024` |

### 4.2 比较与逻辑运算符

```python
==  !=  >  <  >=  <=      # 比较
is    is not               # 身份比较（内存地址）
and   or   not             # 逻辑运算
```

注意：

- `==` 比较**值**，`is` 比较**身份**（是否同一对象）。
- 小整数（-5~256）和短字符串有缓存，`is` 可能为 True，但**不要依赖**，只对 `None` 使用 `is`。
- 链式比较：`1 < x < 10` 等价于 `1 < x and x < 10`。

### 4.3 成员与身份运算符

```python
"a" in "abc"       # True
3 in [1, 2, 3]     # True
"k" in {"k": 1}    # True（字典判断键）
```

### 4.4 赋值运算符与海象运算符

```python
x = 5
x += 1             # x = x + 1，同理 -= *= /= //= %= **=
```

海象运算符（Python 3.8+）：在表达式中赋值并返回该值。

```python
if (n := len("hello")) > 3:
    print(n)       # 5
```

### 4.5 位运算符

```python
a & b    # 按位与
a | b    # 按位或
a ^ b    # 按位异或
~a       # 按位取反
a << 2   # 左移（乘以 2^2）
a >> 2   # 右移（整除 2^2）
```

## 5. 流程控制

### 5.1 if / elif / else

```python
score = 85

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
else:
    grade = "C"

print(grade)  # B
```

- Python 用**缩进**（约定 4 个空格）表示代码块，不要混用 Tab 与空格。
- 条件表达式（三元运算符）：`grade = "A" if score >= 90 else "B"`。

### 5.2 match 语句（Python 3.10+）

```python
def describe(x):
    match x:
        case 0:
            return "零"
        case 1 | 2:                      # 多个值
            return "小"
        case [a, b]:                     # 解构列表
            return f"两元素列表 {a}, {b}"
        case {"name": n} if n:           # 字典匹配 + 守卫
            return f"名字为 {n}"
        case _:
            return "其他"
```

### 5.3 for 循环

```python
for i in range(5):        # range(5) -> 0,1,2,3,4
    print(i)

for i in range(2, 10, 2): # 起点 2，终点 10（不含），步长 2
    print(i)

for idx, val in enumerate(["a", "b"]):  # 同时取下标和值
    print(idx, val)

for k, v in {"a": 1}.items():
    print(k, v)

# 遍历两个序列
for x, y in zip([1, 2], ["a", "b"]):
    print(x, y)           # (1,'a') (2,'b')

# for + else：循环正常结束（未被 break）时执行 else
for n in range(2, 10):
    for x in range(2, n):
        if n % x == 0:
            break
    else:
        print(n, "是质数")
```

### 5.4 while 循环

```python
i = 0
while i < 3:
    i += 1
else:
    print("循环正常结束")   # 被 break 打断则不执行
```

### 5.5 break / continue / pass

```python
break       # 跳出当前循环
continue    # 跳过本次循环剩余语句，进入下一轮
pass        # 占位符，什么都不做（保证语法完整）
```

## 6. 输入与输出

```python
name = input("请输入名字：")     # 返回字符串
num = int(input("请输入数字："))  # 需要手动转换类型

print("hello", "world", sep=", ", end="!\n")
print(f"{name} 今年 {age} 岁")    # f-string 格式化
```

### 6.1 字符串格式化

```python
name, score = "小明", 92.5

# f-string（推荐，Python 3.6+）
print(f"{name} 得分 {score:.1f}")          # 小明 得分 92.5
print(f"{score:>8}")                       # 右对齐补空格
print(f"{score:08.2f}")                    # 00092.50

# format 方法
print("{} 得分 {}".format(name, score))
print("{1} 得分 {0}".format(score, name))  # 按序号

# 传统 % 格式化
print("%s 得分 %.2f" % (name, score))
```

## 7. 模块与包

```python
import math
from datetime import datetime
from collections import defaultdict as dd   # 起别名

# 自定义模块：另一个文件 mymod.py 中写函数，然后
# import mymod
# mymod.func()
```

- 模块搜索路径：当前目录 → `PYTHONPATH` → 标准库 → site-packages。
- 包：带 `__init__.py` 的目录（Python 3.3+ 可用命名空间包省略该文件）。
- `if __name__ == "__main__":` 用于区分"直接运行"与"被导入"。

```python
def main():
    print("程序入口")

if __name__ == "__main__":
    main()
```

## 8. 常见易错点

| 易错点 | 说明 |
| ------ | ---- |
| `==` 与 `is` 混用 | 值相等用 `==`，判 `None` 用 `is None` |
| 可变默认参数 | `def f(x, lst=[])` 中默认列表是共享的，应写 `lst=None` |
| 整数除法 | `/` 结果是 float，取整用 `//` |
| 缩进不一致 | 报 `IndentationError`，统一用 4 空格 |
| `+=` 与不可变类型 | `s += "x"` 实际创建了新字符串（str 不可变） |
| 变量作用域 | 函数内赋值会被当作局部变量，需修改外部变量用 `global`/`nonlocal` |
