# 04 关系映射与关联查询

现实数据几乎都有关系。本章讲 Django 三种表关系(一对一、一对多、多对多)的定义、级联策略与跨表查询。

## 4.1 三种关系总览

| 关系 | 现实例子 | Django 字段 | 数据库实现 |
| --- | --- | --- | --- |
| 一对一 | 人 ↔ 身份证、用户 ↔ 资料 | `OneToOneField` | 外键 + 唯一约束 |
| 一对多(多对一) | 出版社 ↔ 图书、用户 ↔ 订单 | `ForeignKey` | 外键 |
| 多对多 | 学生 ↔ 课程、文章 ↔ 标签 | `ManyToManyField` | 自动中间表 |

## 4.2 on_delete:删除策略(必须显式指定)

`ForeignKey` 和 `OneToOneField` **必须**指定 `on_delete`,决定主对象被删时关联对象怎么办:

| 选项 | 行为 | 适用场景 |
| --- | --- | --- |
| `models.CASCADE` | 级联删除:主删,关联也删 | 订单 ↔ 订单明细 |
| `models.PROTECT` | 有引用则**阻止删除**(抛 ProtectedError) | 出版社下有书不可删 |
| `models.SET_NULL` | 置为 NULL(字段需 `null=True`) | 文章的"最后编辑人" |
| `models.SET_DEFAULT` | 置为默认值(需 `default`) | 状态字段有兜底值 |
| `models.SET(值/函数)` | 置为指定值或函数返回值 | 指向"匿名用户" |
| `models.DO_NOTHING` | 什么都不做(靠数据库级约束) | 极少用,易产生悬挂引用 |

```python
author = models.ForeignKey(User, on_delete=models.PROTECT)      # 有文章的用户删不掉
owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
last_editor = models.ForeignKey(User, on_delete=models.SET(get_anonymous_user))
```

> **选择心法:** 宁可 PROtECT 误删,别乱 CASCADE。删除是不可逆的,涉及资金/内容的表要么 PROTECT、要么软删除(03 章)。

## 4.3 一对多(ForeignKey)

"一"是出版社(Press),"多"是图书(Book):每本书属于一个出版社,一个出版社有多本书。**外键建在"多"的一方。**

```python
from django.db import models

class Press(models.Model):
    name = models.CharField(max_length=50, unique=True)
    site = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.name

class Book(models.Model):
    title = models.CharField(max_length=100)
    press = models.ForeignKey(
        Press,                       # 关联的模型类
        on_delete=models.PROTECT,    # 出版社有书时禁止删除
        related_name='books',        # 反向查询名:press.books.all()
        db_index=True,               # ForeignKey 默认建索引
    )
```

> `related_name` 不指定时,反向查询名默认 `book_set`(模型名小写 + `_set`)。显式命名可读性更好,是团队规范。

### 正向查询(从"多"到"一")

```python
book = Book.objects.get(id=1)
press = book.press              # 直接点属性 → 触发一次查询取到 Press 对象
print(press.name)

# 正向过滤:查"清华出版社"的书
books = Book.objects.filter(press__name='清华大学出版社')   # 双下划线穿透关联
books = Book.objects.filter(press=press_obj)
```

### 反向查询(从"一"到"多")

```python
press = Press.objects.get(name='清华大学出版社')
books = press.books.all()       # related_name='books'
books = press.books.filter(title__icontains='python')   # 反向也可以过滤
```

### 创建关联对象

```python
# 方式一:直接传对象
press = Press.objects.get(id=1)
Book.objects.create(title='Django实战', press=press)

# 方式二:传外键值(省一次查询)
Book.objects.create(title='Python入门', press_id=1)

# 方式三:从"一"端反向创建
press.books.create(title='Django从入门到放弃')
```

## 4.4 一对一(OneToOneField)

人 ↔ 身份证:一个人一个身份证。**建在哪个模型取决于"谁依赖谁"** —— 扩展 User 时通常建在扩展模型上。

```python
class UserProfile(models.Model):
    user = models.OneToOneField(
        User,                        # auth 的用户模型
        on_delete=models.CASCADE,    # 用户删除,资料级联删除
        related_name='profile',
    )
    phone = models.CharField(max_length=11, blank=True)
    bio = models.TextField(blank=True)
```

```python
# 正向:user.profile
profile = user.profile

# 反向:profile.user
u = profile.user

# 创建(一对一,重复创建会报错)
UserProfile.objects.create(user=user, phone='13800000000')
```

> 功能上等价于 `ForeignKey(unique=True)`,但语义更清晰,ORM 反向返回单对象而非 QuerySet。**扩展 auth.User 的标准做法**(替代自定义用户模型的轻量方案,见 06 章)。

## 4.5 多对多(ManyToManyField)

学生 ↔ 课程:一个学生选多门课,一门课有多个学生。Django 自动建中间表,字段写在任意一侧。

```python
class Student(models.Model):
    name = models.CharField(max_length=50)
    courses = models.ManyToManyField(
        'Course',                    # 字符串引用避免定义顺序问题
        related_name='students',     # 反向:course.students.all()
    )

class Course(models.Model):
    name = models.CharField(max_length=50)
```

### 多对多操作

```python
s = Student.objects.get(id=1)
c1, c2 = Course.objects.get(id=1), Course.objects.get(id=2)

# 添加关联
s.courses.add(c1, c2)                # 传对象或 id 均可
# 设置(整体替换,去掉旧的)
s.courses.set([c1])
# 移除
s.courses.remove(c2)
# 清空
s.courses.clear()
# 判断
has = s.courses.filter(id=1).exists()
# 反向同样可用: c1.students.add(s)
```

### 跨表查询

```python
# 查选了某门课的学生
students = Student.objects.filter(courses__name='Django')

# 查某学生的全部课程
courses = s.courses.all()

# 多级穿透:选课记录里课程属于某分类
Student.objects.filter(courses__category__name='后端')
```

### 自定义中间表(through)

自动中间表只能存"谁和谁有关";需要存**关系本身的属性**(选课时间、成绩)时自定义:

```python
class Enrollment(models.Model):                # 自定义中间表
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    enrolled_at = models.DateTimeField(auto_now_add=True)
    score = models.DecimalField(max_digits=5, decimal_places=1, null=True)

    class Meta:
        unique_together = [('student', 'course')]   # 防重复选课

class Student(models.Model):
    name = models.CharField(max_length=50)
    courses = models.ManyToManyField(
        Course,
        through='Enrollment',                # 指定中间表
        related_name='students',
    )

# 操作必须经过中间表
Enrollment.objects.create(student=s, course=c, score=95.5)
# 此时不能用 add/set/remove;查询仍可 s.courses.all()
```

## 4.6 自关联(树形结构)

员工 ↔ 上级、分类 ↔ 父分类,外键指向自己:

```python
class Category(models.Model):
    name = models.CharField(max_length=50)
    parent = models.ForeignKey(
        'self',                          # 指向自身
        on_delete=models.CASCADE,
        null=True, blank=True,           # 顶级分类没有父级
        related_name='children',         # 反向:cat.children.all()
    )

# 顶级分类
root = Category.objects.create(name='计算机')
# 子分类
sub = Category.objects.create(name='编程语言', parent=root)
# 查某分类的子分类
subs = root.children.all()
# 查顶级分类
top = Category.objects.filter(parent__isnull=True)
```

## 4.7 关联查询的 N+1 问题与优化(重点)

**N+1 场景:** 列表页显示每本书的出版社名:

```python
# ❌ N+1:1 次查书 + 每本书 1 次查出版社 = N+1 条 SQL
books = Book.objects.all()[:50]
for book in books:
    print(book.press.name)        # 每次点属性都查一次库
```

**解法一:select_related(正向关联/一对一,JOIN 一条 SQL)**

```python
books = Book.objects.select_related('press').all()[:50]
# SELECT ... FROM book INNER JOIN press ON ...
for book in books:
    print(book.press.name)        # 不再查库

# 多级穿透:select_related('press', 'press__city')
```

**解法二:prefetch_related(反向/多对多,两条 SQL + 内存拼装)**

```python
# 列出所有出版社及每家的书:先查出版社,再一次性 IN 查书
presses = Press.objects.prefetch_related('books').all()
for p in presses:
    for b in p.books.all():       # 从预取缓存中取,不再查库
        print(b.title)

# 两者可叠加:
books = Book.objects.select_related('press').prefetch_related('tags').all()
```

**选择规则:**

| 关系方向 | 工具 | 原理 |
| --- | --- | --- |
| 正向(book.press)、一对一 | `select_related` | SQL JOIN,一次查询 |
| 反向(press.books)、多对多 | `prefetch_related` | 二次查询 + 内存关联 |

> 经验:列表页/详情页**必查**关联字段时,永远带着 `select_related`/`prefetch_related`;查漏了就用 django-debug-toolbar 看 SQL 数量,见到循环里查库就改。

## 4.8 关联字段常用查询示例

```python
# 一对多:某出版社下价格最高的书
Book.objects.filter(press__name='清华').order_by('-price').first()

# 反向过滤 + 聚合:每家出版社的图书数量
Press.objects.annotate(book_count=Count('books')).order_by('-book_count')

# 多对多:没有选任何课的学生
Student.objects.filter(courses__isnull=True)

# 关联对象存在性:有书在售的出版社
Press.objects.filter(books__is_onsale=True).distinct()    # 注意 distinct

# 反向不存在:没有图书的出版社
Press.objects.filter(books__isnull=True)
```

## 4.9 级联删除实战提醒

```python
# CASCADE 下删出版社 → 自动删旗下全部书(逐条执行 delete(),会触发信号)
press.delete()

# 大批量级联删除用 QuerySet.delete() 时,关联对象的 delete() 钩子不执行
# 需要删关联文件(如图片)时,用信号 post_delete 处理(09 章)
```

**删除前确认三件事:** ① on_delete 策略是否符合预期;② 是否有文件/资源需要同步清理(信号);③ 重要数据是否要软删除(`is_deleted=True` 代替物理删除)。

## 4.10 关系设计最佳实践

1. **外键建在"多"方 / 依赖方**,字段名用 `press_id` 式语义(ORM 自动生成)
2. **on_delete 必写**,优先 PROTECT / SET_NULL,慎用 CASCADE
3. **related_name 必写**(或统一约定 `related_name='+'` 禁用反向,避免隐式命名混乱)
4. 关联模型用**字符串引用**(`'Course'`),避免定义顺序与循环导入问题
5. 关系带属性(成绩、时间)→ `through` 自定义中间表
6. 列表页查关联 → `select_related`(正向)/`prefetch_related`(反向/多对多)
7. 反向多值条件注意 `.distinct()`(join 膨胀)
8. 树形结构用自关联 `ForeignKey('self')`;深层树(无限级 + 频繁子树查询)考虑 MPTT(django-mptt)或物化路径
