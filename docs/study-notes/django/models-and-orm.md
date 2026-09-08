# 03 模型层与 ORM

模型层是 Django 与数据库打交道的核心。本章覆盖:数据库配置、模型定义、字段全集、迁移系统、ORM 增删改查、高级查询与事务。

## 3.1 什么是 ORM

ORM(Object Relational Mapping,对象关系映射):用类和对象操作数据库,自动翻译成 SQL。

```
Python 类  ←→  数据库表
类属性    ←→  字段
类实例    ←→  一行记录
```

**优点:**

- 只写面向对象代码,不用手写 SQL
- 与具体数据库解耦:切换 SQLite → MySQL → PostgreSQL 只需改配置
- 自动防 SQL 注入(参数化查询)

**缺点:**

- 复杂 SQL(多层子查询、窗口函数)表达吃力,需退回到原生 SQL
- 映射过程有少量性能损耗

## 3.2 创建应用与注册

Django 项目中,业务按"应用(app)"组织。app 是拥有自己路由、视图、模板、模型的独立业务模块。

```bash
python manage.py startapp bookstore      # 创建应用
```

```python
# settings.py 注册应用(不注册则迁移、模板搜索都不生效)
INSTALLED_APPS = [
    ...,
    'bookstore',
]
```

应用目录结构:

```text
bookstore/
├── migrations/       # 迁移文件(数据库变更历史)
├── __init__.py
├── admin.py          # 后台管理配置(08 章)
├── apps.py           # 应用元信息配置
├── models.py         # 模型定义 ← 本章主角
├── tests.py          # 测试(12 章)
└── views.py          # 视图
```

## 3.3 数据库配置

### SQLite(默认,开发用)

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
```

### MySQL

```bash
# 安装驱动(推荐 mysqlclient;备选 PyMySQL 需在 __init__.py 里伪装)
pip install mysqlclient
# Linux 需先装系统依赖:sudo apt install python3-dev default-libmysqlclient-dev
```

```sql
-- MySQL 里建库
CREATE DATABASE mywebdb DEFAULT CHARACTER SET utf8mb4;
```

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'mywebdb',          # 库名
        'USER': 'root',             # 用户名(生产用专用低权限账号!)
        'PASSWORD': '123456',       # 密码(生产放环境变量!)
        'HOST': '127.0.0.1',
        'PORT': '3306',
        'OPTIONS': {'charset': 'utf8mb4'},   # 完整支持 emoji
    }
}
```

### PostgreSQL(生产推荐)

```bash
pip install psycopg[binary]
```

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'mywebdb',
        'USER': 'myuser',
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': '127.0.0.1',
        'PORT': '5432',
        # 连接池(psycopg3 驱动):
        'OPTIONS': {'pool': True, 'maxsize': 10},
    }
}
```

**选型建议:** 新项目优先 PostgreSQL(JSON、全文检索、并发强);MySQL 次之;SQLite 只用于开发/测试/桌面小应用。`ENGINE` 决定一切,业务代码不感知数据库差异 —— 这就是 ORM 的换库能力。

## 3.4 定义模型

```python
# bookstore/models.py
from django.db import models

class Book(models.Model):
    # 不写 id 时 Django 自动加自增主键 AutoField
    title = models.CharField("书名", max_length=50, default='')
    price = models.DecimalField("定价", max_digits=7, decimal_places=2, default=0.0)
    pub_date = models.DateField("出版日期", null=True, blank=True)
    is_onsale = models.BooleanField("在售", default=True)

    class Meta:
        db_table = 'book'                    # 自定义表名(默认 app名_类名小写)
        verbose_name = '图书'
        verbose_name_plural = '图书'          # admin 里显示名(08 章)

    def __str__(self):
        return f"{self.title}({self.price}元)"
```

**命名约定:** 类名首字母大写(表名的一部分);字段名是类属性名;`verbose_name` 作为第一个位置参数是 Django 惯例。

## 3.5 字段类型全集

| 字段类型 | 数据库类型(MySQL) | 说明 |
| --- | --- | --- |
| `AutoField` | INT 自增主键 | 通常不用写,Django 自动加 |
| `BigAutoField` | BIGINT 自增主键 | 大表主键(Django 3.2+ 新项目默认此类型) |
| `BooleanField` | TINYINT(1) | 布尔 |
| `CharField` | VARCHAR(max_length) | 短字符串,**必须指定 max_length** |
| `TextField` | LONGTEXT | 长文本(正文、评论) |
| `IntegerField` | INT | 整数 |
| `BigIntegerField` | BIGINT | 64 位整数 |
| `SmallIntegerField` | SMALLINT | 小整数 |
| `PositiveIntegerField` | INT UNSIGNED | 非负整数(点赞数、库存) |
| `PositiveSmallIntegerField` | SMALLINT UNSIGNED | 非负小整数 |
| `FloatField` | DOUBLE | 浮点(科学计算用,金额**禁用**) |
| `DecimalField` | DECIMAL(max_digits, decimal_places) | 定点小数,**金额必备** |
| `DateField` | DATE | 日期 |
| `DateTimeField` | DATETIME(6) | 日期时间,支持微秒 |
| `TimeField` | TIME(6) | 时间 |
| `DurationField` | BIGINT(微秒) | 时间段(timedelta) |
| `EmailField` | VARCHAR(254) | 带格式校验的 CharField |
| `URLField` | VARCHAR(200) | 带 URL 校验 |
| `SlugField` | VARCHAR(50) | 短标签(字母/数字/连字符/下划线),用于 URL |
| `UUIDField` | CHAR(32) | UUID 主键(分布式系统常用) |
| `GenericIPAddressField` | CHAR(39) | IPv4/IPv6 |
| `JSONField` | JSON | JSON 数据(MySQL 5.7.8+/PG 支持) |
| `FileField` | VARCHAR(路径) | 文件上传,需 `upload_to` |
| `ImageField` | VARCHAR(路径) | 图片上传,需 Pillow |
| `FilePathField` | VARCHAR | 限定目录内文件路径 |
| `ForeignKey` | INT + 外键约束 | 多对一(04 章) |
| `OneToOneField` | INT + 唯一外键 | 一对一(04 章) |
| `ManyToManyField` | 中间表 | 多对多(04 章) |

### 时间字段的 auto_now 与 auto_now_add

| 选项 | 时机 | 用途 |
| --- | --- | --- |
| `auto_now=True` | **每次 save() 都更新** | `updated_at` 最后修改时间 |
| `auto_now_add=True` | **仅创建时设置** | `created_at` 创建时间 |

```python
created_at = models.DateTimeField(auto_now_add=True)   # 创建时间
updated_at = models.DateTimeField(auto_now=True)       # 修改时间
```

> 两个选项互斥,且会令字段 `editable=False`(admin 里不可编辑)。批量 `QuerySet.update()` **不会**触发 auto_now,注意这一坑。

## 3.6 字段选项(约束)

| 选项 | 说明 |
| --- | --- |
| `primary_key=True` | 主键(隐含 unique + not null;指定后不再自动建 id) |
| `unique=True` | 唯一约束(自动建索引) |
| `db_index=True` | 建索引(高频查询字段) |
| `null=True` | **数据库层**:允许存 NULL |
| `blank=True` | **校验层**:表单/admin 中允许留空 |
| `default=值` | 默认值(可传可调用对象,每次调用) |
| `choices=[(值, 显示名), ...]` | 可选值集合(admin 生成下拉框) |
| `db_column='列名'` | 自定义数据库列名 |
| `editable=False` | 不出现在表单/admin 编辑中 |
| `verbose_name='名称'` | admin 显示名 |
| `help_text='帮助文字'` | 表单帮助文本 |
| `validators=[...]` | 校验器列表(如 `MinLengthValidator`) |
| `error_messages={...}` | 自定义错误消息 |
| `db_comment='注释'` | 数据库列注释(4.2+) |

**null 与 blank 的区别(高频考点):**

```python
nickname = models.CharField(max_length=50, null=True, blank=True)
# null=True:数据库列允许 NULL(表结构层面)
# blank=True:表单验证允许不填(业务校验层面)
# 字符串字段惯例:blank=True + null=False,用 "" 表示空(避免两种空值)
```

**default 的可调用对象:**

```python
import uuid
id = models.UUIDField(primary_key=True, default=uuid.uuid4)   # 每次生成新 UUID
created_at = models.DateTimeField(auto_now_add=True)
# 不要写 default=datetime.now → 那是"导入时求值一次",所有记录同一时间!
# 正确:default=timezone.now(可调用对象)
```

**choices 用法:**

```python
class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', '待支付'),
        ('paid', '已支付'),
        ('shipped', '已发货'),
        ('done', '已完成'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

# 取显示名:
# order.get_status_display()  →  '待支付'
```

**Meta 内部类常用属性:**

| 属性 | 作用 |
| --- | --- |
| `db_table` | 自定义表名 |
| `ordering = ['-created_at']` | 默认排序(查询时自动 ORDER BY) |
| `verbose_name` / `verbose_name_plural` | 单/复数显示名 |
| `unique_together = [('a', 'b')]` | 联合唯一(4.2+ 推荐改用 constraints) |
| `indexes = [models.Index(fields=['title'])]` | 复杂索引(联合索引等) |
| `constraints = [models.UniqueConstraint(...), models.CheckConstraint(...)]` | 数据库约束 |
| `abstract = True` | 抽象基类(不建表,供继承) |
| `managed = False` | 不管理表结构(对接已有数据库时) |

## 3.7 迁移系统(Migrations)

迁移 = 数据库结构的版本控制。每次修改模型,都要生成并执行迁移:

```bash
# 1. 生成迁移文件:对比模型与迁移历史的差异,写入 migrations/ 目录
python manage.py makemigrations
# 指定应用:python manage.py makemigrations bookstore

# 2. 执行迁移:把变更同步到数据库
python manage.py migrate

# 3. 常用查看命令
python manage.py showmigrations       # 各应用的迁移及执行状态
python manage.py sqlmigrate bookstore 0001   # 预览某迁移对应的 SQL
python manage.py migrate bookstore 0001      # 迁移到指定版本(回滚)
python manage.py migrate bookstore zero      # 全部回滚
```

迁移文件示例(migrations/0001_initial.py):

```python
operations = [
    migrations.CreateModel(
        name='Book',
        fields=[
            ('id', models.BigAutoField(...)),
            ('title', models.CharField(max_length=50)),
        ],
    ),
]
```

### 迁移的坑与纪律

**坑 1:新增非空字段没有默认值**

```text
You are trying to add a non-nullable field 'des' to book without a default;
we can't do that (the database needs something to populate existing rows).
Please select a fix:
 1) Provide a one-off default now (will be set on all existing rows)
 2) Quit, and let me add a default in models.py
```

解决:给字段加 `default=...`(或 `null=True`)。生产数据无默认值的加列是危险操作。

**坑 2:迁移文件冲突(多人开发)**:各自分支生成 0002 重号。解决:合并后执行 `python manage.py makemigrations --merge`。

**坑 3:手改数据库却不生成迁移** → 代码与库结构漂移,部署必炸。**纪律:改模型必迁移,迁移文件进 git,生产先 migrate 后发代码。**

**坑 4:误以为 migrate 会"重建"。** migrate 只做增量变更;想清空重来:删库 + 删 migrations 里的 `000*_*.py`(保留 `__init__.py`)+ 重新 makemigrations/migrate(仅限开发环境!)。

## 3.8 ORM 基础操作(CRUD)

### 管理器对象

每个模型类自动获得 `objects` 管理器,所有查询从它出发:

```python
Book.objects.create(...)
Book.objects.all()
```

### 创建(Create)

```python
# 方式一:create(),一步到位,返回对象
book = Book.objects.create(title='Python入门', price=59.9)

# 方式二:实例化 + save(),适合需要先修改再保存的场景
book = Book(title='Django实战', price=79.0)
book.price = 69.9
book.save()

# 批量创建(性能:一次 SQL 多条)
Book.objects.bulk_create([
    Book(title='书1'), Book(title='书2'), Book(title='书3'),
])
```

### 查询(Read)

```python
# 查全部 → QuerySet(惰性求值:不真正执行 SQL,直到被迭代/取值)
books = Book.objects.all()

# 查单条 → get():恰一条,否则抛异常
book = Book.objects.get(id=1)                  # 0 条: DoesNotExist;多条: MultipleObjectsReturned

# 条件过滤(多个参数 = AND)
books = Book.objects.filter(pub='清华大学出版社', price__lt=50)

# 排除
books = Book.objects.exclude(price=50)

# 取第一条(没有返回 None)
book = Book.objects.filter(title='x').first()

# 数量
count = Book.objects.filter(price__gt=50).count()

# 存在性(比 count 高效)
exists = Book.objects.filter(title='x').exists()

# 排序(默认 Meta.ordering,可覆盖;'-' 降序)
books = Book.objects.order_by('-price', 'title')

# 分页(切片)
page2 = Book.objects.all()[10:20]              # LIMIT 10 OFFSET 10

# 只取部分列:values → 字典列表;values_list → 元组列表
titles = Book.objects.values('title', 'pub')          # [{'title':..,'pub':..}, ...]
titles = Book.objects.values_list('title', flat=True) # ['书1', '书2']

# 去重
pubs = Book.objects.values('pub').distinct()
```

**QuerySet 三大特性(必考):**

1. **惰性求值**:`qs = Book.objects.filter(...)` 不查库;迭代、切片、len、print 时才查
2. **缓存**:同一个 QuerySet 迭代一次后结果缓存,再次迭代不再查库
3. **链式调用**:filter/order_by 等返回新 QuerySet,可持续叠加

### 修改(Update)

```python
# 单条:查-改-存
book = Book.objects.get(id=1)
book.price = 49.9
book.save()

# 批量:QuerySet.update() 一条 SQL 完成,不触发 save()/信号/auto_now
Book.objects.filter(pub='清华大学出版社').update(price=0)
# 返回受影响行数
```

### 删除(Delete)

```python
# 单条
book = Book.objects.get(id=1)
book.delete()

# 批量
Book.objects.filter(price__lt=5).delete()
```

> 删除会级联触发关联对象的 `on_delete` 行为(04 章),批量删除跳过对象级 delete() 钩子。

## 3.9 查询谓词速查(字段名__谓词)

| 谓词 | 含义 | 示例 |
| --- | --- | --- |
| `__exact` | 等于(默认,可省略) | `id__exact=1` |
| `__iexact` | 等于(忽略大小写) | `name__iexact='a'` |
| `__contains` | 包含(大小写敏感) | `name__contains='w'` |
| `__icontains` | 包含(忽略大小写,常用) | `title__icontains='python'` |
| `__startswith` / `__istartswith` | 以…开头 | `name__startswith='张'` |
| `__endswith` / `__iendswith` | 以…结尾 | `email__endswith='.com'` |
| `__in` | 在集合中 | `id__in=[1,2,3]` |
| `__gt` / `__gte` | 大于 / 大于等于 | `age__gt=18` |
| `__lt` / `__lte` | 小于 / 小于等于 | `price__lte=100` |
| `__range` | 区间(闭区间) | `age__range=(18, 35)` |
| `__isnull` | 是否为 NULL | `deleted_at__isnull=True` |
| `__year` / `__month` / `__day` | 日期部分 | `pub_date__year=2024` |
| `__date` | 取日期部分比较 | `created_at__date='2024-01-01'` |
| `__regex` / `__iregex` | 正则 | `title__regex=r'^[A-Z]'` |

```python
# 综合示例:找 2024 年出版、价格在 30~100 之间、书名含"Python"的书
books = Book.objects.filter(
    pub_date__year=2024,
    price__range=(30, 100),
    title__icontains='python',
)
```

## 3.10 聚合查询

```python
from django.db.models import Sum, Avg, Count, Max, Min

# 全表聚合:aggregate() 返回字典
result = Book.objects.aggregate(avg_price=Avg('price'))
# {'avg_price': 58.2}

result = Book.objects.aggregate(Count('id'), Max('price'))
# {'id__count': 100, 'price__max': 999.0}

# 分组聚合:values(...).annotate(...) 按出版社统计
result = Book.objects.values('pub').annotate(count=Count('id'))
# <QuerySet [{'pub': '清华', 'count': 7}, {'pub': '机械', 'count': 3}]>

# annotate 加在对象上:每个出版社的最新一本书(进阶)
from django.db.models import Max
latest = Book.objects.values('pub').annotate(max_id=Max('id'))
```

## 3.11 F 对象:字段间运算(不加载到内存)

```python
from django.db.models import F

# 全部涨价 10 元 —— 一条 SQL 在数据库端完成
Book.objects.all().update(price=F('price') + 10)
# UPDATE bookstore_book SET price = price + 10

# 字段间比较:零售价高于定价的书
books = Book.objects.filter(market_price__gt=F('price'))
```

**为什么不用循环?** `for b in books: b.price += 10; b.save()` 是 N+1 条 SQL 且并发下会互相覆盖;`F()` 是单条原子 SQL,并发安全。

## 3.12 Q 对象:复杂逻辑条件

```python
from django.db.models import Q

# 或:清华出版社 或 价格低于 50
Book.objects.filter(Q(pub='清华大学出版社') | Q(price__lt=50))

# 与 + 非:不是机械工业出版社 且 价格低于 50
Book.objects.filter(Q(price__lt=50) & ~Q(pub='机械工业出版社'))

# Q 与普通 kwargs 混用(混用时 Q 在前)
Book.objects.filter(Q(pub='清华') | Q(pub='机械'), price__lt=50)

# 动态拼条件(搜索接口常用)
conditions = Q()
if keyword:
    conditions &= Q(title__icontains=keyword)
if pub:
    conditions |= Q(pub=pub)
books = Book.objects.filter(conditions)
```

## 3.13 原生 SQL(退路)

### raw():查模型对象

```python
books = Book.objects.raw('SELECT * FROM bookstore_book WHERE id > %s', [10])
for b in books:
    print(b.title)
```

> **SQL 注入红线:** `raw('... where id=%s' % user_input)` 是注入漏洞;参数永远走占位符 `%s` 列表。ORM 的 filter 是参数化的,天然安全。

### cursor():完全手写(增删改查皆可)

```python
from django.db import connection

with connection.cursor() as cur:
    cur.execute("UPDATE bookstore_book SET price = %s WHERE id = %s", [9.9, 10])
    cur.execute("SELECT title, price FROM bookstore_book WHERE price > %s", [50])
    rows = cur.fetchall()
```

> `with` 保证游标异常时也能释放。ORM 表达不了的复杂 SQL(报表、窗口函数、存储过程)才用 cursor,且集中在 DAO/服务层管理。

## 3.14 事务

Django 默认**自动提交**:每条写 SQL 立即提交。

```python
from django.db import transaction

# 方式一:装饰器/上下文(最常用)—— 块内异常自动回滚
@transaction.atomic
def transfer(from_id, to_id, amount):
    from_acc = Account.objects.select_for_update().get(id=from_id)   # 行锁!
    to_acc = Account.objects.get(id=to_id)
    from_acc.balance -= amount
    to_acc.balance += amount
    from_acc.save()
    to_acc.save()
    # 正常退出自动提交;抛异常自动回滚

# 视图里用上下文管理器
def transfer_view(request):
    with transaction.atomic():
        ...

# 嵌套 atomic:内层 atomic 是保存点(savepoint),内层回滚不影响外层

# 手动回滚
with transaction.atomic():
    order = Order.objects.create(...)
    if not check_stock():
        transaction.set_rollback(True)     # 标记回滚,继续执行完块
```

**关键:** 并发改同一行必须 `select_for_update()` 行锁,否则"查-算-写"之间数据会被并发覆盖(超卖经典 bug)。

## 3.15 Django Shell:调试 ORM 的主战场

```bash
python manage.py shell            # 进入带 Django 环境的交互终端
# 装了 django-extensions 后:
python manage.py shell_plus      # 自动导入全部模型,还能 --print-sql 显示每条 SQL
```

```python
>>> from bookstore.models import Book
>>> Book.objects.filter(price__gt=50).values('title', 'price')
<QuerySet [{'title': 'Django实战', 'price': 59.9}]>
>>> qs = Book.objects.filter(pub='清华')
>>> print(qs.query)              # 打印生成的 SQL,调优利器
```

## 3.16 常见问题与最佳实践

1. **金额用 DecimalField,禁用 FloatField**(浮点误差在金融场景致命)
2. **字符串用空串不用 NULL**(`blank=True` + `null=False`)
3. **高频过滤/排序字段加 `db_index=True`**;但别滥用(拖慢写入)
4. **默认时间用 `auto_now_add`/`timezone.now`,别用 `datetime.now`**(时区)
5. **唯一性靠 `unique`/数据库约束兜底**,不能只靠代码查重(并发下重复)
6. **批量操作优先 update/bulk_create**,避免 N+1 循环 save
7. **`get()` 只用于主键等必唯一场景**;列表页永远 filter + 分页
8. **`values()` 只取需要的列**,别一查全表字段
9. 迁移文件进版本库;生产先 migrate 再上线(04 章补充关联迁移细节)
10. **QuerySet 惰性 + 缓存**:`if qs:` 用 `exists()`;循环前 `list(qs)` 固定结果,避免循环中重复查库
