# 04 数据库与 ORM

FastAPI 本身不绑定任何 ORM,社区主流方案:

| 方案 | 定位 | 适用场景 |
| --- | --- | --- |
| **SQLAlchemy 2.0 + Pydantic** | 最主流、最强大 | 大多数项目,生态最全 |
| **SQLModel**(作者即 FastAPI 作者) | SQLAlchemy + Pydantic 合体 | 中小项目,少写一层转换代码 |
| Tortoise ORM | 纯异步 ORM(Django 风格) | 想全异步、喜欢 Django ORM 手感 |
| 原生 asyncpg / aiomysql | 不用 ORM 直接写 SQL | 追求极致性能、复杂 SQL |

本章以 **SQLAlchemy 2.0(异步)** 为主线,SQLModel 与 Tortoise 各给完整示例。

## 4.1 安装与连接

```bash
pip install sqlalchemy
# 异步驱动按数据库选一个:
pip install asyncpg        # PostgreSQL(推荐)
pip install aiomysql       # MySQL
pip install aiosqlite      # SQLite(开发环境)
```

### 引擎与配置

```python
# core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

# 连接串格式: 方言+驱动://用户:密码@主机:端口/库名
DATABASE_URL = "postgresql+asyncpg://user:password@localhost:5432/mydb"
# 开发时也常用 SQLite:
# DATABASE_URL = "sqlite+aiosqlite:///./dev.db"

engine = create_async_engine(
    DATABASE_URL,
    echo=True,             # 打印执行的 SQL(开发用)
    pool_pre_ping=True,    # 取连接前先 ping,自动剔除失效连接(推荐开启)
    pool_size=10,          # 连接池常驻连接数(默认 5)
    max_overflow=20,       # 超出 pool_size 后最多再借多少(默认 10)
    pool_timeout=30,       # 池满后等待连接的秒数,超时抛 TimeoutError(默认 30)
    pool_recycle=1800,     # 连接最大存活秒数,防数据库端主动断开(MySQL 常见)
)

# async_sessionmaker:会话工厂
async_session = async_sessionmaker(
    engine,
    expire_on_commit=False,    # commit 后对象属性不失效(异步场景必设,否则访问属性报错)
)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类(SQLAlchemy 2.0 风格)"""
    pass
```

**连接池参数怎么定?**

- `pool_size + max_overflow` = 并发上限。超了会排队等待(等 `pool_timeout` 后报错)
- 经验:`pool_size` = 每个 worker 的常规并发数,`max_overflow` = 突发容量。总并发 ≤ 数据库的 `max_connections`
- 例如 4 worker、每 worker 并发 10:`pool_size=10, max_overflow=10`,总共最多 80 连接,需确认数据库 `max_connections` ≥ 100

> **SQLAlchemy 1.4 旧风格**(`declarative_base()`、`Column()`、`session.query()`)网上教程很多,但 2.0 已全面转向 `DeclarativeBase`、`Mapped`、`mapped_column`、`select()`。旧 API 仍兼容但官方不推荐,本笔记只讲 2.0 写法。认旧代码技巧:`session.query(User)` 是旧式,`select(User)` 是新式。

## 4.2 定义 ORM 模型

```python
# models/user.py
from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
    # server_default:由数据库端生成;default:由 ORM 在 Python 端生成
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    # onupdate:每次 UPDATE 自动更新时间
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    posts: Mapped[list["Post"]] = relationship(back_populates="author")
```

```python
# models/post.py
from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    content: Mapped[str] = mapped_column(Text)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # index=True 单独建索引;下面这种是命名联合索引
    # __table_args__ = (Index("ix_posts_author_created", "author_id", "created_at"),)

    author: Mapped["User"] = relationship(back_populates="posts")
```

### 常用列类型速查

| 类型 | 用途 |
| --- | --- |
| `Integer` / `BigInteger` / `SmallInteger` | 整数(id 用 BigInteger 防溢出) |
| `String(n)` / `Text` | 定长字符串 / 长文本 |
| `Boolean` | 布尔(库内 tinyint/bool) |
| `DateTime(timezone=True)` / `Date` / `Time` | 时间 |
| `Float` / `Numeric(10, 2)` | 浮点 / 定点小数(金额**必须** Numeric/Decimal) |
| `JSON` | JSON 数据(PG 有 jsonb,更强) |
| `LargeBinary` | 二进制(文件内容,一般存 OSS 只存 URL) |
| `Enum` | 枚举(PG 原生枚举,或 `String` + Python Enum 更简单) |
| `UUID` | UUID 主键(PG 可用 `Uuid` 类型) |
| `ARRAY(Integer)` | 数组(PG 专有) |

### 常用参数

- `primary_key`、`unique`、`index`、`nullable`
- `default`(Python 端默认值,如 `datetime.now`)/ `server_default`(数据库端,如 `func.now()`)
- `onupdate`:每次 UPDATE 自动写值(自动更新时间戳)
- `ondelete`:外键删除策略(`CASCADE` 级联删除、`SET NULL`、`RESTRICT`)

## 4.3 建表

开发阶段快速建表:

```python
# create_tables.py
import asyncio
from core.database import engine, Base
import models.user, models.post   # 必须 import,让模型注册到 Base.metadata

async def init_models():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

asyncio.run(init_models())
```

> `create_all` 只建**不存在的表**,不会修改已有表结构。生产环境必须使用 **Alembic 迁移**(4.8 节),`create_all` 仅限开发/测试。

## 4.4 Pydantic Schema 与 ORM 的转换

FastAPI 请求/响应结构用 Pydantic 定义(02 章),ORM 模型负责数据库。两者之间手动或自动转换:

```python
# schemas/user.py
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from datetime import datetime


class UserCreate(BaseModel):
    """创建用户的请求体"""
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("密码至少 8 位")
        return v


class UserOut(BaseModel):
    """返回给客户端的结构(绝不能包含密码哈希)"""
    model_config = ConfigDict(from_attributes=True)   # v2 必加:允许从 ORM 对象读取属性(旧版叫 orm_mode)

    id: int
    username: str
    email: EmailStr
    is_active: bool
    created_at: datetime


class UserLogin(BaseModel):
    username: str
    password: str
```

> **安全红线:** 永远不要直接把 ORM 对象 return 出去(密码哈希、内部字段会泄露)。必须经过 `response_model=UserOut` 过滤。`from_attributes=True` 是响应模型直接接收 ORM 对象的前提。

## 4.5 CRUD 完整示例

### 数据库会话依赖(与 03 章联动)

```python
# deps.py
from typing import AsyncGenerator
from core.database import async_session
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """每个请求一个独立会话,请求结束自动关闭(归还连接池)"""
    async with async_session() as session:
        yield session
```

### 路由与 CRUD(异步版)

```python
# routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from deps import get_db
from models.user import User
from schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/users", tags=["用户"])

@router.post("/", response_model=UserOut, status_code=201)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    # 唯一性检查(并发下依赖数据库唯一约束兜底,见 4.9)
    result = await db.execute(select(User).where(User.username == payload.username))
    if result.scalar_one_or_none():
        raise HTTPException(409, "用户名已存在")

    user = User(username=payload.username, email=payload.email)
    user.hashed_password = hash_password(payload.password)   # 06 章
    db.add(user)
    await db.commit()
    await db.refresh(user)      # 拿到数据库生成的值(id、created_at)
    return user                 # response_model=UserOut 自动过滤字段


@router.get("/", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.id))
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: int, email: str | None = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    if email is not None:
        user.email = email
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    await db.delete(user)
    await db.commit()
    # 204 无内容,函数体不要 return
```

## 4.6 SQLAlchemy 2.0 查询速查表

### 基础条件

```python
stmt = select(User)                                     # 全表
stmt = select(User).where(User.id == 1)                 # 等值
stmt = select(User).where(User.age >= 18)               # 比较
stmt = select(User).where(User.name.like("%张%"))       # 模糊(% 通配)
stmt = select(User).where(User.name.ilike("%a%"))       # 忽略大小写模糊
stmt = select(User).where(User.id.in_([1, 2, 3]))       # IN
stmt = select(User).where(User.id.not_in([4, 5]))       # NOT IN
stmt = select(User).where(User.deleted_at.is_(None))    # IS NULL(不要用 == None!)
stmt = select(User).where(User.deleted_at.is_not(None)) # IS NOT NULL
stmt = select(User).where(User.age.between(18, 60))     # BETWEEN
stmt = select(User).where(User.data.contains({"k": "v"}))  # JSON 包含(PG)
stmt = select(User).where((User.age > 18) & (User.is_active == True))  # AND(&)
stmt = select(User).where((User.role == "a") | (User.role == "b"))     # OR(|)
stmt = select(User).where(~User.is_active)              # NOT(~)
```

### 排序 / 分页 / 聚合

```python
# 排序与分页
stmt = select(User).order_by(User.id.desc(), User.username)  # 多级排序
stmt = select(User).order_by(User.id.desc()).limit(10).offset(20)

# 聚合
from sqlalchemy import func
stmt = select(func.count(User.id)).where(User.is_active == True)
total = (await db.execute(stmt)).scalar()               # 取单个标量值
stmt = select(User.role, func.count(User.id)).group_by(User.role)
rows = (await db.execute(stmt)).all()                   # [("admin", 3), ("user", 97)]

# HAVING:对分组结果过滤
stmt = (select(User.role, func.count(User.id))
        .group_by(User.role).having(func.count(User.id) > 10))
```

### 通用分页封装(项目必备)

```python
async def paginate(
    db: AsyncSession,
    stmt: Select,
    page: int = 1,
    size: int = 20,
) -> dict:
    """传入查询语句,返回 {items, total, page, size, pages}"""
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar()
    items = (await db.execute(stmt.limit(size).offset((page - 1) * size))).scalars().all()
    return {"items": items, "total": total, "page": page, "size": size,
            "pages": (total + size - 1) // size}
```

### JOIN 与关联查询

```python
# inner join
stmt = (select(Post, User.username)
        .join(User, Post.author_id == User.id)
        .where(User.is_active == True))

# outer join(保留左表无匹配的行)
stmt = select(User, func.count(Post.id)).outerjoin(Post).group_by(User.id)

# 只取部分列
stmt = select(User.id, User.username)
rows = (await db.execute(stmt)).all()                   # 每行是元组 (id, username)

# 子查询
subq = select(func.max(Post.id)).where(Post.author_id == User.id).scalar_subquery()
stmt = select(User.username, subq.label("last_post_id"))

# EXISTS
from sqlalchemy import exists
has_posts = exists().where(Post.author_id == User.id)
stmt = select(User.username).where(has_posts)
```

### 结果取值四件套

```python
result = await db.execute(stmt)
users = result.scalars().all()          # ORM 对象列表
user = result.scalars().first()         # 第一个或 None
user = result.scalar_one_or_none()      # 零个或一个,多了报错(查主键标准姿势)
user = result.scalar_one()              # 必须恰好一个,否则 MultipleResultsFound/NoResultFound
```

### 更新与删除语句(批量,不先查再改)

```python
from sqlalchemy import update, delete

# 批量更新(比逐条查改快得多)
stmt = (update(User).where(User.is_active == False)
        .values(is_active=True))
await db.execute(stmt)
await db.commit()

# 表达式更新(原子自增,并发安全)
stmt = update(Account).where(Account.id == 1).values(balance=Account.balance - 10)

# 批量删除
stmt = delete(Post).where(Post.created_at < datetime(2024, 1, 1))
await db.execute(stmt)
await db.commit()
```

### 批量插入

```python
# 单条
db.add(user); await db.commit()

# 多条(逐条 add 再一次 commit,常规量够用)
db.add_all([User(...), User(...), User(...)])
await db.commit()

# 大批量(原生 executemany 路径,不构造 ORM 对象)
await db.execute(
    insert(User),
    [{"username": f"user{i}", "email": f"u{i}@x.com"} for i in range(10000)],
)
await db.commit()
# 更大批量(百万级):PG 用 COPY(psycopg/asyncpg 的 copy 接口),不经过 ORM
```

### UPSERT(存在则更新,PG 专有)

```python
from sqlalchemy.dialects.postgresql import insert as pg_insert

stmt = pg_insert(User).values(username="alice", email="a@x.com")
stmt = stmt.on_conflict_do_update(
    index_elements=[User.username],          # 冲突判定的唯一键
    set_={"email": stmt.excluded.email},     # 冲突时更新的字段
)
await db.execute(stmt)
await db.commit()
# MySQL 对应 on_duplicate_key_update;SQLite 对应 on_conflict_do_update(不同参数)
```

## 4.7 关系(Relationship)详解

### 一对多 / 多对一(4.2 已建模型)

```python
# 创建带关联的记录
user = User(username="alice", ...)
post1 = Post(title="第一篇文章", content="...", author=user)   # 直接挂对象
post2 = Post(title="第二篇", content="...", author_id=user.id) # 或显式外键
db.add_all([user, post1, post2])
await db.commit()

# 预加载(selectinload),避免 N+1 查询
from sqlalchemy.orm import selectinload, joinedload

stmt = select(Post).options(selectinload(Post.author)).where(Post.id == 1)
post = (await db.execute(stmt)).scalar_one()
print(post.author.username)     # 已一次性查出,不会额外发 SQL

# 批量场景:
stmt = select(User).options(selectinload(User.posts)).limit(100)
users = (await db.execute(stmt)).scalars().unique().all()   # 注意 .unique()
```

> **异步模式下的陷阱:** SQLAlchemy 异步会话**禁止隐式懒加载**(访问未预加载的 relationship 会抛 `MissingGreenlet` 错误)。必须用 `selectinload` / `joinedload` 预加载,或 `await session.refresh(obj, attribute_names=["posts"])` 显式加载。这是同步版迁移异步版最常见的坑。

- `selectinload`:发第二条 `WHERE id IN (...)` 查询,**一对多/集合**推荐
- `joinedload`:一条 SQL JOIN 取回,多对一/单值推荐,但多级关联小心结果爆炸

### 多对多(association table)

```python
# models/tag.py
from sqlalchemy import Table, Column, ForeignKey

# 中间表(不用类,直接 Table)
post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    posts: Mapped[list["Post"]] = relationship(secondary=post_tags, back_populates="tags")

class Post(Base):
    __tablename__ = "posts"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    tags: Mapped[list[Tag]] = relationship(secondary=post_tags, back_populates="posts")
```

```python
# 用法
post = Post(title="...", tags=[Tag(name="python"), Tag(name="web")])
db.add(post); await db.commit()

# 查所有含某标签的文章
tag = (await db.execute(select(Tag).where(Tag.name == "python"))).scalar_one()
posts = (await db.execute(
    select(Post).options(selectinload(Post.tags)).join(post_tags).where(post_tags.c.tag_id == tag.id)
)).scalars().unique().all()
```

### 级联删除

```python
# 数据库层面(推荐,简单可靠):
#   ForeignKey("users.id", ondelete="CASCADE")   → 删用户,库自动删其文章
# ORM 层面(需要"删孤儿"等复杂行为时):
#   posts: Mapped[list["Post"]] = relationship(back_populates="author",
#                                               cascade="all, delete-orphan")
```

## 4.8 事务与一致性

```python
async def transfer(from_id: int, to_id: int, amount: float, db: AsyncSession):
    # 方案一:async with db.begin(),成功自动 commit,异常自动 rollback
    async with db.begin():
        await db.execute(
            update(Account).where(Account.id == from_id)
            .values(balance=Account.balance - amount)
        )
        await db.execute(
            update(Account).where(Account.id == to_id)
            .values(balance=Account.balance + amount)
        )

    # 方案二:手动控制
    # try:
    #     db.add(...)
    #     await db.commit()
    # except Exception:
    #     await db.rollback()
    #     raise
```

**要点:**

- 一个请求内多次写操作要么全成要么全回滚,业务一致性靠事务
- 转账这种"先查余额再扣"必须**原子更新**(4.6 的表达式 update)或 `SELECT ... FOR UPDATE` 行锁,否则并发下会扣成负数
- 幂等:网络重试会重复请求,写接口考虑唯一键/幂等键设计(如订单号唯一)

```python
# 行锁示例(扣库存的正确姿势)
stmt = select(Product).where(Product.id == pid).with_for_update()
product = (await db.execute(stmt)).scalar_one()
if product.stock < n:
    raise HTTPException(400, "库存不足")
product.stock -= n
await db.commit()
```

## 4.9 数据库迁移:Alembic

Alembic 是 SQLAlchemy 官方 schema 迁移工具(类似 Django 的 migrate)。**生产环境必须用它管理表结构变更。**

### 初始化与配置

```bash
pip install alembic
alembic init alembic            # 生成 alembic/ 目录
```

```python
# alembic/env.py 关键修改(异步引擎模板)
import asyncio
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool
from core.database import Base
import models.user, models.post      # 必须 import 所有模型!

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", DATABASE_URL)   # 或读环境变量
target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(url=config.get_main_option("sqlalchemy.url"),
                      target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online():
    asyncio.run(run_async_migrations())
```

### 日常工作流

```bash
# 1. 改完 ORM 模型后,自动生成迁移脚本(对比模型与库的差异)
alembic revision --autogenerate -m "add posts table"

# 2. 人工检查 alembic/versions/xxx.py —— 必须审查!(见下)

# 3. 应用迁移
alembic upgrade head

# 4. 其他常用命令
alembic current                 # 当前在哪个版本
alembic history                 # 版本历史
alembic downgrade -1            # 回滚一步
alembic upgrade +2              # 前进两步
alembic heads                   # 查看分支头(多人协作冲突时)
```

### 迁移脚本长什么样

```python
# alembic/versions/20250101_abc123_add_posts_table.py
def upgrade() -> None:
    op.create_table(
        "posts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_posts_title", "posts", ["title"])

def downgrade() -> None:
    op.drop_index("ix_posts_title", table_name="posts")
    op.drop_table("posts")
```

### autogenerate 的盲区(必须人工审查!)

| 场景 | autogenerate 表现 |
| --- | --- |
| 列重命名 | 识别为"删一列 + 加一列"(**数据丢失!**) |
| 表重命名 | 识别为删表建表 |
| 默认值/约束的部分改动 | 可能漏掉 |
| 改 nullable | 能识别 |
| 数据迁移(存量数据回填) | 完全不管,需手写 `op.execute("UPDATE ...")` |

**纪律:每次 autogenerate 后打开脚本检查;列重命名先手改脚本为 `op.alter_column(... new_column_name=...)`;涉及数据变更写 `op.execute()`。**

### 生产发布顺序(零停机)

```
1. 部署新代码(新代码必须兼容新旧两种表结构 —— 加列优先,先别删列)
2. 运行 alembic upgrade head
3. 验证
4. 回滚时:代码先回,结构后回(downgrade)
```

## 4.10 SQLModel:少一层转换的轻量方案

SQLModel 把 SQLAlchemy 的 ORM 模型和 Pydantic 的校验模型**合并成一个类**,省去 4.4 节的 schema 转换层。

```bash
pip install sqlmodel
```

```python
from typing import Optional
from sqlmodel import SQLModel, Field, Session, select, Relationship

class User(SQLModel, table=True):       # table=True 表示这是数据库表
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str
    password: str
    posts: list["Post"] = Relationship(back_populates="author")

class Post(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    author_id: int | None = Field(default=None, foreign_key="user.id")
    author: User | None = Relationship(back_populates="posts")

class UserCreate(SQLModel):             # table=False(默认):纯数据模型,请求体用
    username: str
    email: str
    password: str

class UserRead(SQLModel):               # 响应模型,不含密码
    id: int
    username: str
    email: str

engine = create_engine("sqlite:///dev.db")
SQLModel.metadata.create_all(engine)    # 建表

def get_session():
    with Session(engine) as session:
        yield session

@app.post("/users", response_model=UserRead)
def create_user(user_in: UserCreate, session: Session = Depends(get_session)):
    user = User.model_validate(user_in)         # 直接转换,无需手写字段拷贝
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@app.get("/users", response_model=list[UserRead])
def list_users(session: Session = Depends(get_session)):
    return session.exec(select(User)).all()
```

**SQLModel 的取舍:**

- ✅ 少写一半模型代码;类型提示、校验、文档自动生成
- ✅ 与 FastAPI 文档风格完全一致(同一个作者)
- ✅ 同样支持异步:`create_async_engine` + `async_sessionmaker`
- ⚠️ 社区生态比纯 SQLAlchemy 小;高级查询最终仍要写 SQLAlchemy 语句(两者相通)
- ⚠️ 复杂项目里"一个类既当表结构又当接口结构"的耦合会带来尴尬(如 User 表有密码哈希,响应要剔除,还得再建 UserRead)

**选择建议:** 学习或中小项目用 SQLModel 很舒服;大型/复杂项目直接 SQLAlchemy 2.0 全异步 + Pydantic 分层。

## 4.11 Tortoise ORM:纯异步方案

```bash
pip install tortoise-orm
```

```python
# models.py
from tortoise import fields
from tortoise.models import Model

class User(Model):
    id = fields.IntField(pk=True)
    username = fields.CharField(max_length=50, unique=True)
    email = fields.CharField(max_length=255)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "users"
```

```python
# main.py
from tortoise import Tortoise

@app.on_event("startup")
async def init_db():
    await Tortoise.init(
        db_url="postgres://user:pass@localhost:5432/mydb",   # 注意:同步前缀
        modules={"models": ["models"]},
    )
    await Tortoise.generate_schemas()   # 开发建表;生产用 aerich(其迁移工具)

# 路由里直接 await(Django 风格 API)
@app.get("/users")
async def list_users():
    return await User.filter(is_active=True).order_by("-id").limit(20).values()

@app.post("/users")
async def create_user(payload: UserCreate):
    user = await User.create(username=payload.username, email=payload.email)
    return {"id": user.id}
```

**Tortoise 特点:** 全异步、API 接近 Django ORM、自带 `aerich` 迁移工具。适合想要"异步 + Django 手感"的团队。生态小于 SQLAlchemy。

## 4.12 常见问题与排障

**Q1:`MissingGreenlet` 异常?**
异步 session 触发了隐式懒加载。用 `selectinload`/`joinedload` 预加载,或 `await session.refresh(obj, attribute_names=[...])`。

**Q2:连接池报 "QueuePool limit of size 5 overflow 10 reached"?**
并发过高或连接泄漏(忘记 commit/close)。检查依赖里每个请求是否关闭 session;调大 `pool_size`/`max_overflow`(治标),修复泄漏(治本)。异步引擎下用 `async with async_session() as session:` 最省心。

**Q3:同步 SQLAlchemy 能用在 async 路由里吗?**
能,但同步驱动会**阻塞事件循环**(05 章详述)。要么路由用 `def`(自动进线程池),要么用异步引擎。两者不要混在一个模型工程。

**Q4:MySQL 还是 PostgreSQL?**
新项目强烈建议 PostgreSQL:asyncpg 驱动成熟、JSONB 支持好、迁移能力强;MySQL 的 aiomysql 相对小众。SQLite 只用于开发和学习。

**Q5:DateTime 时区问题?**
全链路 UTC:`DateTime(timezone=True)` + 存 UTC,Pydantic 序列化时输出 ISO8601,前端负责显示本地化。避免各端各存各的时间。

**Q6:大字段(长文本/JSON)拖慢查询?**
只取需要的列(`select(User.id, User.username)`);Text 大字段用懒加载列(高级);JSON 频繁查询用 PG 的 `GIN` 索引。

**Q7:性能突然变慢怎么排查?**
① 开 `echo=True` 看 SQL;② 检查 N+1(用 selectinload);③ `EXPLAIN ANALYZE` 看是否走索引;④ 检查连接池是否耗尽(`pool_timeout` 报错即信号)。

**Q8:ORM 还是原生 SQL?**
95% 场景 ORM;复杂报表、多表聚合、性能敏感热点用原生 SQL(`text()` 或存储过程),两者可在同一 session 混用:

```python
from sqlalchemy import text
result = await db.execute(text("SELECT * FROM users WHERE id = :id"), {"id": 1})
```
