# Python 学习路线

Python，这门"人生苦短，我用 Python"的语言，以其简洁优雅的语法和强大的生态系统，征服了从 Web 开发到数据科学的各个领域。无论是写个脚本还是训练 AI 模型，Python 总能让你事半功倍。

## 基础篇

### Python 入门
- **环境搭建**：Python 安装、pip 包管理器、虚拟环境（venv/virtualenv）
- **基本语法**：变量、注释、缩进规则、输入输出
- **数据类型**：数字（int、float、complex）、布尔值、None
- **运算符**：算术、比较、逻辑、位运算、成员运算、身份运算
- **控制流**：if/elif/else、for/while 循环、break/continue、pass
- 📖 笔记：[Python 基础语法](/study-notes/python/syntax-basics)

```python
# Python 的哲学：简洁就是美
print("Hello, Python!")
```

**下一步学习**：基础语法只是开胃菜，数据结构才是主菜。

### 数据结构
- **列表（List）**：创建、索引、切片、增删改查、列表推导式
- **元组（Tuple）**：不可变序列、解包、命名元组
- **字典（Dict）**：键值对、字典推导式、常用方法
- **集合（Set）**：去重、交并差集、集合推导式
- **字符串（String）**：格式化（f-string、format）、常用方法、编码解码
- 📖 笔记：[Python 数据结构](/study-notes/python/data-structures)

**下一步学习**：数据结构是容器，函数是逻辑的封装。

### 函数与模块
- **函数定义**：def 关键字、参数、返回值、文档字符串
- **参数类型**：位置参数、默认参数、关键字参数、可变参数（*args、**kwargs）
- **作用域**：局部变量、全局变量、global/nonlocal 关键字
- **匿名函数**：lambda 表达式
- **内置函数**：map、filter、reduce、zip、enumerate
- **模块导入**：import、from...import、as 别名、__name__ == '__main__'
- **包管理**：创建包、__init__.py、相对导入与绝对导入
- 📖 笔记：[函数与函数式编程](/study-notes/python/functions-functional-programming)

**下一步学习**：函数让代码复用，面向对象让代码更有结构。

### 面向对象基础
- **类与对象**：class 定义、__init__ 构造器、self 参数
- **属性与方法**：实例属性、类属性、实例方法、类方法、静态方法
- **封装**：私有属性（_var、__var）、property 装饰器
- **继承**：单继承、多继承、super() 函数、MRO（方法解析顺序）
- **多态**：鸭子类型、抽象基类（ABC）
- **特殊方法**：__str__、__repr__、__len__、__getitem__、__call__
- 📖 笔记：[Python 面向对象编程](/study-notes/python/oop)

**下一步学习**：OOP 是组织代码的方式，文件操作是与外界交互的开始。

### 文件与异常处理
- **文件操作**：open()、read/write、with 语句、文本模式与二进制模式
- **路径处理**：os 模块、pathlib 模块
- **异常处理**：try-except-else-finally、raise 抛出异常、自定义异常
- **上下文管理器**：with 语句、__enter__ 和 __exit__ 方法

**下一步学习**：文件操作是基础，标准库是 Python 的宝库。

## 进阶篇

> 📖 篇笔记：[Python 进阶特性](/study-notes/python/advanced-features)

### 标准库精要
- **日期时间**：datetime、time、calendar
- **正则表达式**：re 模块、匹配、查找、替换
- **JSON/CSV**：json 模块、csv 模块
- **网络请求**：urllib、requests（第三方）
- **系统交互**：sys、os、subprocess
- **数学运算**：math、random、statistics
- **数据压缩**：zipfile、tarfile、gzip

**下一步学习**：标准库覆盖常见需求，装饰器让代码更优雅。

### 装饰器
- **函数装饰器**：基本概念、装饰器语法糖、functools.wraps
- **带参数的装饰器**：装饰器工厂
- **类装饰器**：装饰类、装饰方法
- **内置装饰器**：@property、@classmethod、@staticmethod
- **装饰器链**：多个装饰器的执行顺序
- **常见应用**：日志记录、性能计时、权限检查、缓存

**下一步学习**：装饰器是语法糖，生成器是内存的救星。

### 生成器与迭代器
- **迭代器协议**：__iter__ 和 __next__ 方法
- **生成器函数**：yield 关键字、生成器表达式
- **生成器方法**：send()、throw()、close()
- **itertools 模块**：chain、cycle、repeat、combinations、permutations
- **惰性求值**：节省内存、处理大数据

**下一步学习**：生成器处理序列，并发编程处理任务。

### 多线程与多进程
- **多线程**：threading 模块、Thread 类、Lock、RLock、Semaphore、Event
- **GIL（全局解释器锁）**：CPython 的限制、I/O 密集型 vs CPU 密集型
- **多进程**：multiprocessing 模块、Process 类、Pool、Queue、Pipe
- **进程间通信**：共享内存、Manager
- **concurrent.futures**：ThreadPoolExecutor、ProcessPoolExecutor、Future 对象

**下一步学习**：多线程适合 I/O，协程适合高并发。

### 异步编程
- **协程基础**：async/await 关键字、协程函数与协程对象
- **asyncio 模块**：事件循环、Task、Future
- **异步上下文管理器**：async with
- **异步迭代器**：async for
- **异步生成器**：async def + yield
- **异步库**：aiohttp、aiofiles、asyncpg
- **并发控制**：Semaphore、Lock、Queue

**下一步学习**：异步是现代 Python 的核心，元编程是高级技巧。

## 实战篇

### 元编程
- **动态属性**：getattr、setattr、delattr、hasattr
- **描述符**：__get__、__set__、__delete__、property 的实现原理
- **元类**：type() 函数、__new__ 和 __init__、metaclass 参数
- **类装饰器**：修改类行为
- **抽象基类**：abc 模块、@abstractmethod
- **数据类**：dataclasses 模块（Python 3.7+）

**下一步学习**：元编程改变类的行为，类型提示提升代码质量。

### 类型提示与静态检查
- **类型注解**：变量注解、函数注解、类型别名
- **typing 模块**：List、Dict、Tuple、Optional、Union、Callable
- **泛型**：TypeVar、Generic
- **Protocol**：结构化子类型
- **静态类型检查器**：mypy、pyright、类型检查工具集成

**下一步学习**：类型提示让代码更健壮，性能优化让程序更快。

### 性能优化
- **性能分析**：timeit、cProfile、line_profiler、memory_profiler
- **优化技巧**：列表推导式 vs for 循环、生成器、局部变量缓存
- **内置优化**：__slots__、字符串拼接优化
- **C 扩展**：ctypes、cffi、Cython
- **Numba**：JIT 编译加速
- **并行计算**：multiprocessing、concurrent.futures、joblib

**下一步学习**：性能优化是锦上添花，测试是质量保证。

### 测试与调试
- **单元测试**：unittest 模块、TestCase 类、断言方法
- **pytest 框架**：简洁的测试语法、fixture、参数化测试
- **测试覆盖率**：coverage.py
- **Mock 对象**：unittest.mock、MagicMock
- **调试工具**：pdb、ipdb、IDE 调试器
- **日志系统**：logging 模块、日志级别、格式化、处理器

**下一步学习**：测试保证正确性，包管理让分发简单。

### 包管理与项目结构
- **虚拟环境**：venv、virtualenv、conda
- **依赖管理**：requirements.txt、setup.py、pyproject.toml
- **Poetry**：现代包管理工具
- **Pipenv**：Pipfile、依赖锁定
- **项目结构**：模块组织、配置文件、测试目录
- **打包发布**：setuptools、wheel、上传到 PyPI

**下一步学习**：项目管理是工程化，Web 开发是常见应用。

### Web 开发
- **Flask**：轻量级框架、路由、模板、表单处理
- **Django**：全功能框架、ORM、Admin、中间件
- **FastAPI**：异步框架、自动文档、类型提示、高性能
- **数据库**：SQLite、MySQL/PostgreSQL、SQLAlchemy ORM
- **RESTful API**：设计规范、序列化
- **WebSocket**：实时通信

**下一步学习**：Web 是应用的常见形态，数据科学是 Python 的另一片天地。

### 数据科学基础
- **NumPy**：数组计算、广播、线性代数
- **Pandas**：DataFrame、数据清洗、数据分析
- **Matplotlib/Seaborn**：数据可视化
- **SciPy**：科学计算、统计分析
- **Jupyter Notebook**：交互式编程环境
- **机器学习入门**：scikit-learn、基本算法

**下一步学习**：数据科学是趋势，现在你已掌握 Python 的核心！

## 学习建议

### 推荐书籍
- 《Python 编程：从入门到实践》：适合零基础入门
- 《流畅的 Python》：深入理解 Pythonic 编程
- 《Python Cookbook》：实用技巧大全
- 《Effective Python》：编写高质量 Python 代码

### 学习周期
- **基础篇**：1-2 个月（每天 2-3 小时）
- **进阶篇**：2-3 个月（每天 2-3 小时）
- **实战篇**：3-6 个月（需要项目实践）

### 职业方向
- **Web 开发**：Django/Flask/FastAPI 后端开发
- **数据分析**：Pandas/NumPy 数据处理
- **机器学习**：scikit-learn/TensorFlow/PyTorch
- **自动化运维**：脚本编写、系统管理
- **爬虫开发**：Scrapy/BeautifulSoup

Python 的哲学是"优雅、明确、简单"，学习 Python 不仅仅是学一门语言，更是学习一种编程思维。记住：代码是写给人看的，只是顺便让机器执行而已。享受 Python 带来的编程乐趣吧！
