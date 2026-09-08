# Python 数据结构

## 1. 字符串 str

不可变的有序字符序列，支持索引、切片、成员判断。

```python
s = "hello world"

s[0]         # 'h'
s[-1]        # 'd'
s[0:5]       # 'hello'（含头不含尾）
s[::2]       # 'hlowrd'（步长为 2）
s[::-1]      # 'dlrow olleh'（反转）

len(s)       # 11
"hello" in s # True
```

### 1.1 常用方法

```python
s = "  Hello, World!  "

s.strip()          # 'Hello, World!'（去首尾空白，还有 lstrip/rstrip）
s.lower()          # 转小写
s.upper()          # 转大写
s.title()          # 每个单词首字母大写
s.replace("World", "Python")
s.split(",")       # ['  Hello', ' World!  ']
",".join(["a", "b"])   # 'a,b'
s.startswith("  H")    # True
s.endswith("!  ")      # True
s.find("World")        # 7，找不到返回 -1
s.index("World")       # 7，找不到抛 ValueError
s.count("l")           # 3
"123".isdigit()        # True
"abc".isalpha()        # True
"abc123".isalnum()     # True
" ".isspace()          # True
```

### 1.2 原始字符串与多行字符串

```python
path = r"C:\Users\name"     # 原始字符串，不转义
text = """第一行
第二行"""                   # 多行字符串
```

### 1.3 f-string 高级用法

```python
name = "Python"
f"{name!r}"          # 调用 repr()：'Python'
f"{name:^10}"        # 居中，宽 10
f"{3.14159:.2f}"     # 3.14
f"{255:#x}"          # 0xff
f"{1000000:,}"       # 1,000,000
```

## 2. 列表 list

可变、有序、可存放任意类型。**引用类型**，传参/赋值共享同一对象。

### 2.1 创建与索引

```python
lst = [1, 2, 3]
lst2 = list("abc")      # ['a', 'b', 'c']
lst3 = [0] * 5          # [0, 0, 0, 0, 0]

lst[0] = 100            # 修改元素
lst[-1]                 # 3
lst[1:]                 # [2, 3]
```

### 2.2 常用操作

```python
lst = [3, 1, 2]

lst.append(4)          # 末尾追加：[3, 1, 2, 4]
lst.insert(0, 0)       # 指定位置插入
lst.extend([5, 6])     # 扩展
lst.pop()              # 弹出末尾元素（可指定下标）
lst.remove(1)          # 删除第一个匹配值，不存在抛 ValueError
del lst[0]             # 按下标删除
lst.clear()            # 清空
lst.index(2)           # 元素下标
lst.count(2)           # 元素个数
lst.sort()             # 原地排序（默认升序，reverse=True 降序）
lst.reverse()          # 原地反转
sorted(lst)            # 返回新列表（不修改原列表）
lst.copy()             # 浅拷贝
```

### 2.3 排序进阶

```python
words = ["banana", "apple", "cherry"]
sorted(words, key=len)                    # 按长度排序
sorted(words, key=lambda w: w[1])         # 按第 2 个字符排序
sorted(words, reverse=True)               # 降序

items = [("a", 3), ("b", 1), ("c", 2)]
sorted(items, key=lambda x: x[1])         # 按元组第二项排序

# 按多条件：先按长度，再按字典序
sorted(words, key=lambda w: (len(w), w))
```

### 2.4 列表解析（推导式）

```python
[x ** 2 for x in range(5)]                # [0, 1, 4, 9, 16]
[x for x in range(10) if x % 2 == 0]      # 带条件 [0, 2, 4, 6, 8]
[(x, y) for x in range(2) for y in range(2)]  # 嵌套 [(0,0),(0,1),(1,0),(1,1)]
[0 if x % 2 else 1 for x in range(5)]     # 三元表达式
```

### 2.5 列表切片赋值

```python
lst = [1, 2, 3, 4, 5]
lst[1:3] = [20, 30]     # [1, 20, 30, 4, 5]
lst[::2] = [0, 0, 0]    # 步长切片必须等长替换
```

## 3. 元组 tuple

不可变有序序列。可哈希（内容可做字典键、集合元素）。

```python
t = (1, 2, 3)
t2 = 1, 2, 3            # 省略括号
t3 = (1,)               # 单元素元组必须加逗号
t4 = ()                 # 空元组

a, b, c = t             # 解包
x, *rest = [1, 2, 3, 4] # x=1, rest=[2,3,4]
_, b, _ = t             # 用 _ 忽略值
```

- 元组内部若包含可变对象（如列表），该对象本身仍可变。

```python
t = (1, [2, 3])
t[1].append(4)          # 合法，t 变为 (1, [2, 3, 4])
```

- 应用场景：函数返回多值、字典键、防止误改的数据。

## 4. 字典 dict

可变、无序（Python 3.7+ 保持插入顺序）的键值映射。键必须可哈希（不可变类型）。

### 4.1 创建与访问

```python
d = {"name": "小明", "age": 18}
d2 = dict(name="小红", age=20)      # 关键字创建
d3 = dict([("a", 1), ("b", 2)])    # 从键值对序列创建

d["name"]              # 访问，键不存在抛 KeyError
d.get("name")          # 访问，不存在返回 None
d.get("score", 0)      # 指定默认值
d.setdefault("city", "北京")   # 键存在返回值，不存在则设默认并返回

d["age"] = 19          # 修改/新增
d.update({"a": 1, "b": 2})     # 批量更新
d.pop("age")           # 删除并返回值
d.popitem()            # 删除并返回最后插入的键值对
del d["name"]          # 删除键
d.clear()              # 清空
"name" in d            # 判断键存在
```

### 4.2 遍历

```python
for k in d:                    # 遍历键
for k in d.keys():             # 同上，显式
for v in d.values():           # 遍历值
for k, v in d.items():         # 遍历键值对
```

### 4.3 字典推导式与合并

```python
{x: x ** 2 for x in range(3)}          # {0: 0, 1: 1, 2: 4}
{k: v for k, v in d.items() if v > 10} # 过滤

# 合并（Python 3.9+）
a = {"x": 1}
b = {"y": 2}
c = a | b                # {'x': 1, 'y': 2}，返回新字典
a |= b                   # 原地合并（等价 a.update(b)）
```

### 4.4 常见坑

```python
d = {}
d.setdefault("k", []).append(1)   # 常用技巧：列表默认值累加
# 等价写法
if "k" not in d:
    d["k"] = []
d["k"].append(1)
```

### 4.5 collections 高级容器

```python
from collections import defaultdict, Counter, OrderedDict, deque

# 默认值字典
dd = defaultdict(list)
dd["a"].append(1)          # 不需要先初始化

# 计数器
c = Counter("abracadabra") # Counter({'a': 5, 'b': 2, ...})
c.most_common(2)           # [('a', 5), ('r', 2)]

# 双向队列
q = deque([1, 2, 3])
q.appendleft(0)
q.popleft()

# 有序字典（Python 3.7+ 普通 dict 已保序，兼容旧版本用）
od = OrderedDict()
```

## 5. 集合 set / frozenset

无序、元素唯一、可哈希。适合去重与集合运算。

```python
s = {1, 2, 3}
s2 = set([3, 4, 5])

s.add(4)               # 添加
s.remove(4)            # 删除，不存在抛 KeyError
s.discard(99)          # 删除，不存在不报错
s.pop()                # 随机弹出一个元素
s.clear()

# 集合运算
s | s2                 # 并集 {1,2,3,4,5}
s & s2                 # 交集 {3}
s - s2                 # 差集 {1,2}
s ^ s2                 # 对称差 {1,2,4,5}
s <= s2                # 子集判断
s >= s2                # 超集判断

# 推导式
{x % 3 for x in range(10)}   # {0, 1, 2}

fs = frozenset([1, 2])       # 不可变集合，可做字典键
```

## 6. 深浅拷贝

```python
import copy

lst = [1, [2, 3]]
a = lst               # 引用：修改 a 会影响 lst
b = lst.copy()        # 浅拷贝：外层新对象，内层列表仍共享
c = copy.deepcopy(lst)  # 深拷贝：完全独立

b[1].append(4)        # lst 也变成 [1, [2, 3, 4]]
c[1].append(5)        # lst 不受影响
```

> 判断可变类型是否有内置拷贝方法：list/set/dict 有 `.copy()`，tuple/str 不可变无需拷贝。

## 7. 各容器对比速查

| 容器 | 可变 | 有序 | 可重复 | 可哈希（可做键） | 适用场景 |
| ---- | ---- | ---- | ------ | ---------------- | -------- |
| str | ❌ | ✅ | ✅ | ✅ | 文本 |
| list | ✅ | ✅ | ✅ | ❌ | 有序集合、栈、队列 |
| tuple | ❌ | ✅ | ✅ | ✅ | 固定结构、函数多返回值 |
| dict | ✅ | ✅(3.7+) | 键唯一 | 键需可哈希 | 映射 |
| set | ✅ | ❌ | 元素唯一 | 元素需可哈希 | 去重、成员判断 |
| frozenset | ❌ | ❌ | 元素唯一 | ✅ | 不可变集合、做键 |

## 8. 常用内置函数

```python
len(x)        # 长度
min(x) / max(x)   # 最小/最大值（可传 key）
sum(x)        # 求和
sorted(x)     # 排序返回新列表
reversed(x)   # 反向迭代器
enumerate(x)  # 下标-值迭代器
zip(x, y)     # 并行打包迭代器
range(n)      # 整数序列
any([True, False])   # 任一为真
all([1, 2])          # 全部为真
list() / tuple() / dict() / set()   # 类型转换
```

## 9. 性能小贴士

- 判断成员：`set`/`dict` O(1)，`list` O(n)。频繁查找时先转集合。
- 大量字符串拼接用 `"".join(list)`，不要用 `+`。
- 需要下标遍历用 `enumerate`，不要手动 `range(len())`。
- 排序用 `sorted` 的 `key` 参数，不要写比较函数。
- 大列表查找用 `bisect` 模块做二分。
