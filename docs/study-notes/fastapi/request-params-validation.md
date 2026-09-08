# 02 请求参数与校验

FastAPI 中客户端传参的位置共有五类:路径参数、查询参数、请求体、Header、Cookie。本章逐一深挖,重点是 **Pydantic v2 数据校验**的完整能力。

## 2.1 路径参数(Path Parameters)

路径参数写在 URL 路径中,用 `{}` 占位,函数参数同名接收。

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/users/{user_id}")
def get_user(user_id: int):          # 声明为 int,自动校验并转换
    return {"user_id": user_id}


@app.get("/files/{file_path:path}")  # :path 转换器:匹配含 / 的整段路径
def read_file(file_path: str):
    return {"file_path": file_path}
```

**行为验证:**

```bash
curl http://127.0.0.1:8000/users/123
# {"user_id": 123}          ← 字符串 "123" 被自动转换为 int

curl http://127.0.0.1:8000/users/abc
# 422 错误,因为 "abc" 不能转成 int:
# {"detail":[{"type":"int_parsing","loc":["path","user_id"],"msg":"Input should be a valid integer..."}]}
```

### 路径参数校验 — Path()

```python
from fastapi import Path
from typing import Annotated

@app.get("/items/{item_id}")
def get_item(
    item_id: Annotated[int, Path(ge=1, le=1000, title="商品ID", description="必须为1-1000的整数")],
):
    return {"item_id": item_id}
```

`Path` / `Query` / `Field` 共享同一套校验参数:

| 参数 | 含义 | 示例 |
| --- | --- | --- |
| `ge` / `gt` | 大于等于 / 大于 | `ge=0` |
| `le` / `lt` | 小于等于 / 小于 | `le=100` |
| `multiple_of` | 必须是某数的倍数 | `multiple_of=5` |
| `min_length` / `max_length` | 字符串长度范围 | `min_length=3` |
| `pattern` | 正则匹配(旧名 regex 已废弃) | `pattern=r"^\d{4}-\d{2}$"` |
| `min_items` / `max_items` | 列表元素个数 | `max_items=10` |
| `title` / `description` | 文档中的名称/说明 | — |
| `examples` | 文档示例值 | `examples=["A", "B"]` |
| `deprecated` | 标记参数已废弃(文档划线) | `deprecated=True` |
| `include_in_schema` | 是否在文档显示 | `include_in_schema=False` |
| `alias` | 参数在请求中的名字 | `alias="item-id"` |

> **关于 `Annotated`:** FastAPI 推荐 `Annotated[类型, 校验信息]` 写法,把"类型"和"元数据"解耦,一个参数可挂多个校验器(依次写进 Annotated 即可)。老写法 `item_id: int = Path(...)` 仍可用,但无法叠加多组元数据,官方推荐前者。

### 路径参数顺序陷阱

```python
# ❌ 错误:/users/me 永远不会被匹配,因为 "me" 会被 user_id 捕获并报 422
@app.get("/users/{user_id}")
def get_user(user_id: int): ...

@app.get("/users/me")
def get_me(): ...

# ✅ 正确:固定路径必须定义在参数路径之前(FastAPI 按注册顺序匹配)
@app.get("/users/me")
def get_me(): ...

@app.get("/users/{user_id}")
def get_user(user_id: int): ...
```

### 枚举路径参数

```python
from enum import Enum

class ModelName(str, Enum):          # 继承 str,值可直接当字符串用
    alexnet = "alexnet"
    resnet = "resnet"
    lenet = "lenet"

@app.get("/models/{model_name}")
def get_model(model_name: ModelName):
    if model_name is ModelName.alexnet:      # is 比较枚举身份
        return {"model": model_name, "msg": "深度学习第一课"}
    return {"model": model_name, "value": model_name.value}
```

> 枚举的好处:传非法值时 422 拒绝,且 `/docs` 自动生成下拉框列出合法值。

## 2.2 查询参数(Query Parameters)

URL 中 `?` 之后的部分。**判断规则:函数参数不在路径占位符里、且类型不是 Pydantic 模型,默认就是查询参数。**

### 基础用法与校验

```python
from fastapi import Query
from typing import Annotated

@app.get("/search")
def search(
    q: Annotated[str | None, Query(max_length=50)] = None,   # 可选参数,默认 None
    page: Annotated[int, Query(ge=1)] = 1,                   # 有默认值,可不传
    size: Annotated[int, Query(ge=1, le=100)] = 10,
    sort: Annotated[str, Query(pattern=r"^(asc|desc)$")] = "desc",
    # 必填查询参数:不给默认值,或用 ... (Ellipsis) 显式声明必填
    keyword: Annotated[str, Query(min_length=1)] = ...,      # ... = 必填
):
    return {"q": q, "page": page, "size": size, "sort": sort, "keyword": keyword}
```

```bash
curl "http://127.0.0.1:8000/search?q=手机&page=2&size=20&sort=asc&keyword=新品"
# {"q":"手机","page":2,"size":20,"sort":"asc","keyword":"新品"}

curl "http://127.0.0.1:8000/search?page=0&keyword=x"
# 422:page 必须 ge=1
```

### 多值查询参数(列表)

```python
@app.get("/tags")
def get_tags(tag: Annotated[list[str] | None, Query()] = None):
    return {"tags": tag}

# curl "http://127.0.0.1:8000/tags?tag=a&tag=b&tag=c"
# {"tags": ["a", "b", "c"]}
```

### 别名:URL 名与变量名不同

```python
@app.get("/items")
def read_items(
    item_type: Annotated[str | None, Query(alias="item-type")] = None,
):
    return {"item_type": item_type}

# curl "http://127.0.0.1:8000/items?item-type=book"
# {"item_type": "book"}
```

### 特殊值:None 之外的可选默认

```python
@app.get("/empty")
def empty_default(
    # 不传时返回 None(默认);显式传 q=(空字符串)则得到 ""
    q: Annotated[str | None, Query()] = None,
    # 传参但赋空值 ?q= → q = "",用 max_length 校验时 "" 也合法(长度 0)
    # 若希望空字符串非法,再加 min_length=1
):
    return {"q": q}
```

### 隐藏参数、过期参数

```python
@app.get("/internal")
def internal(
    token: Annotated[str, Query(include_in_schema=False)],   # 文档不显示,但可传
    old_param: Annotated[str | None, Query(deprecated=True)] = None,
):
    return {"token": token}
```

## 2.3 请求体(Request Body)与 Pydantic 模型

请求体是 POST/PUT/PATCH 时客户端发来的 JSON(Content-Type: application/json)。用 Pydantic `BaseModel` 声明,校验与文档全自动。

### 基础模型与嵌套模型

```python
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime


class Address(BaseModel):
    """嵌套模型:城市与详细地址"""
    city: str = Field(min_length=1, max_length=50)
    detail: str = Field(default="", max_length=200)


class Item(BaseModel):
    """商品模型"""
    name: str = Field(min_length=1, max_length=100)
    price: float = Field(gt=0, description="价格,必须大于0")
    is_offer: bool = False                       # 有默认值的字段可省略
    tags: list[str] = Field(default_factory=list)  # 可变默认值必须用 default_factory!
    address: Address | None = None               # 嵌套模型
    created_at: datetime | None = None           # 自动解析 ISO8601 时间字符串


@app.post("/items")
def create_item(item: Item):                     # 单个 Pydantic 模型 = 请求体
    print(item.model_dump())                     # 转为 dict(v1 旧写法 .dict())
    return {"item": item, "price_with_tax": item.price * 1.13}
```

```bash
curl -X POST http://127.0.0.1:8000/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "机械键盘",
    "price": 299.5,
    "tags": ["外设", "办公"],
    "address": {"city": "深圳", "detail": "南山区"},
    "created_at": "2025-01-01T10:00:00"
  }'

# 校验失败示例:price 为 0 → 422
# {"detail":[{"type":"greater_than","loc":["body","price"],
#   "msg":"Input should be greater than 0","input":0}]}
```

> **可变默认值陷阱:** `tags: list[str] = []` 在 Pydantic 中会被正确处理(每次实例化给新列表),但**其他普通 Python 代码**里是共享引用的经典 bug。Pydantic 推荐 `Field(default_factory=list)` 显式声明,本笔记统一用后者。

### 类型自动转换(宽松模式 lax)

Pydantic 默认宽松转换,收到的 JSON 字符串会尽量转成目标类型:

| 目标类型 | 输入 | 结果 |
| --- | --- | --- |
| `int` | `"299"` | `299` |
| `float` | `"299.5"` | `299.5` |
| `bool` | `"true"` / `"1"` / `"yes"` / `"on"` | `True`;其余为 `False` |
| `datetime` | `"2025-01-01T10:00:00"` | datetime 对象 |
| `UUID` | `"550e8400-..."` | UUID 对象 |
| `Decimal` | `"19.99"` | Decimal 对象(金额场景防浮点误差) |

需要严格模式(禁止隐式转换)时,对字段用 `Field(strict=True)`,或类型用 `StrictInt`、`StrictBool` 等。

### 常用约束类型(内置快捷校验)

```python
from pydantic import (
    BaseModel, Field, EmailStr, HttpUrl, IPvAnyAddress,
    UUID4, Decimal, conint, constr, conlist,
)
from typing import Annotated

class Profile(BaseModel):
    email: EmailStr                          # 校验邮箱格式(需 pip install pydantic[email])
    homepage: HttpUrl | None = None          # 校验 URL
    ip: IPvAnyAddress | None = None          # 校验 IP(v4/v6)
    uid: UUID4                               # 校验 UUID4
    balance: Decimal = Decimal("0.00")       # 精确小数,金额推荐
    # 约束类型(旧式快捷方式,功能与 Field 等价)
    age: conint(ge=0, le=150) = 18           # = int + 范围
    code: constr(pattern=r"^[A-Z]{3}$")      # = str + 正则
    items: conlist(int, min_length=1)        # = list[int] + 长度
```

> `EmailStr`、`HttpUrl` 需要 `pip install "pydantic[email]"`。注意:这些是 Pydantic 的约束类型,与 FastAPI 的 `Query/Path/Form` 无关,两者可叠加使用。

## 2.4 Pydantic v2 模型深度

### model_config:模型级配置

```python
from pydantic import BaseModel, ConfigDict

class Product(BaseModel):
    model_config = ConfigDict(
        # extra: 多余字段处理。ignore=忽略(默认);forbid=报错;allow=保留
        extra="forbid",
        # from_attributes: 允许从 ORM 对象等属性对象读取(04 章要用,v1 叫 orm_mode)
        from_attributes=True,
        # populate_by_name: 同时接受字段名和别名(否则传原始字段名会报错)
        populate_by_name=True,
        # validate_assignment: 属性赋值时也校验(默认不校验!)
        validate_assignment=True,
        # str_strip_whitespace: 字符串自动去首尾空格
        str_strip_whitespace=True,
        # use_enum_values: 序列化时输出枚举值而非枚举对象
        use_enum_values=True,
        # frozen: 模型不可变(类似 dataclass frozen)
        frozen=False,
        # strict: 全模型严格模式
        strict=False,
        # 自定义 JSON Schema 生成参数
        json_schema_extra={"example": {"sku": "SKU-01"}},
    )

    sku: str = Field(min_length=5, max_length=20, pattern=r"^[A-Z0-9-]+$")
    stock: int = Field(ge=0, le=99999)
    # 别名:请求/响应里叫 productName,Python 里叫 product_name
    product_name: str = Field(alias="productName")
```

```python
p = Product(sku="SKU-01", stock=10, productName="鼠标")
p.model_dump(by_alias=True)      # {"sku": "SKU-01", "stock": 10, "productName": "鼠标"}
p.model_dump()                   # {"sku": "SKU-01", "stock": 10, "product_name": "鼠标"}
```

### 模型继承与复用

```python
class ItemBase(BaseModel):
    name: str
    price: float = Field(gt=0)

class ItemCreate(ItemBase):
    """创建时提交的字段(继承 name/price)"""
    pass

class ItemUpdate(BaseModel):
    """更新时字段全部可选(部分更新)"""
    name: str | None = None
    price: float | None = Field(default=None, gt=0)

class ItemOut(ItemBase):
    """输出:在基础字段上增加 id"""
    model_config = ConfigDict(from_attributes=True)
    id: int
```

> 这种 Base/Create/Update/Out 四件套是 FastAPI 项目的标准建模范式:请求校验用 Create/Update,响应过滤用 Out,底层数据结构复用 Base。**Out 模型绝不能包含密码等敏感字段**(04、06 章会反复强调)。

### 联合类型与判别联合

```python
from typing import Literal, Union
from pydantic import Field

class Cat(BaseModel):
    pet_type: Literal["cat"]
    meows: int

class Dog(BaseModel):
    pet_type: Literal["dog"]
    barks: float

# 普通 Union:按顺序尝试解析,文档不友好
Pet = Union[Cat, Dog]

# 判别联合(推荐):根据 discriminator 字段的值选择模型
Pet = Annotated[Union[Cat, Dog], Field(discriminator="pet_type")]

@app.post("/pets")
def create_pet(pet: Pet):
    return {"pet": pet}
```

判别联合的好处:解析快、错误信息精准,且 `/docs` 中会正确展示两种结构。**多态请求体(如不同类型的消息事件)必用此模式。**

### 校验器(v2 写法)

#### 字段级校验 field_validator

```python
from pydantic import BaseModel, field_validator, ValidationInfo

class User(BaseModel):
    username: str
    password: str
    password_confirm: str
    age: int = 18

    @field_validator("username")
    @classmethod
    def username_no_space(cls, v: str) -> str:
        if " " in v:
            raise ValueError("用户名不能包含空格")
        return v.strip()                 # 校验后转换:去空格

    @field_validator("password", "password_confirm")   # 一个函数校验多字段
    @classmethod
    def password_not_empty(cls, v: str) -> str:
        if not v:
            raise ValueError("密码不能为空")
        return v

    @field_validator("age")
    @classmethod
    def age_adult(cls, v: int, info: ValidationInfo) -> int:
        # info.data: 已经校验过的字段值(注意顺序,age 之后的字段看不到)
        print("已校验字段:", info.data)
        if v < 18:
            raise ValueError("未成年")
        return v
```

#### mode="before":在类型转换之前拦截

```python
from pydantic import field_validator

class Order(BaseModel):
    amount: float

    @field_validator("amount", mode="before")
    @classmethod
    def strip_currency(cls, v):
        # 此时 v 还是原始输入(可能是字符串 "¥299.00")
        if isinstance(v, str):
            v = v.replace("¥", "").replace(",", "")
        return v      # 返回 "299.00",之后再做 float 转换
```

#### 模型级校验 model_validator

```python
from pydantic import BaseModel, model_validator

class RegisterIn(BaseModel):
    username: str
    password: str
    password_confirm: str

    # mode="after":模型构建完成后校验,可访问全部字段
    @model_validator(mode="after")
    def check_password_match(self):
        if self.password != self.password_confirm:
            raise ValueError("两次输入的密码不一致")
        return self

    # mode="before":拿到原始输入 dict 时校验(可用于字段级解决不了的重组)
    @model_validator(mode="before")
    @classmethod
    def merge_name(cls, data):
        if isinstance(data, dict) and "full_name" in data:
            first, _, last = data.pop("full_name").partition(" ")
            data["first_name"], data["last_name"] = first, last
        return data
```

> **跨字段校验规则:** 用 `@model_validator(mode="after")`(如密码确认、日期起止)。**查库/调接口的业务校验**(如"用户名是否已注册")不要放 validator 里 —— validator 应保持纯函数,业务校验放依赖注入或服务层(03 章)。

### computed_field:计算字段(v2 新特性)

```python
from pydantic import BaseModel, computed_field

class Rectangle(BaseModel):
    width: int
    height: int

    @computed_field               # 不参与输入校验,只在输出中出现
    @property
    def area(self) -> int:
        return self.width * self.height

r = Rectangle(width=3, height=4)
r.model_dump()                    # {"width": 3, "height": 4, "area": 12}
```

### 私有属性(不参与校验与序列化)

```python
from pydantic import BaseModel, PrivateAttr

class Cache(BaseModel):
    key: str
    _value: str = PrivateAttr(default="")     # 下划线开头 + PrivateAttr

    def set(self, v: str):
        self._value = v

# _value 不出现在 model_dump()、不进 JSON Schema、不参与校验
```

### model_dump 进阶:序列化控制

```python
item = Item(name="键盘", price=299.5, is_offer=True, address=Address(city="深圳", detail=""))

item.model_dump()                        # 全量转 dict
item.model_dump(exclude={"is_offer"})    # 排除字段
item.model_dump(include={"name", "price"})  # 只要部分字段
item.model_dump(exclude_none=True)       # 丢掉值为 None 的字段
item.model_dump(exclude_unset=True)      # 丢掉"没显式赋值"的字段(区分 None 与未传)
item.model_dump(by_alias=True)           # 用别名输出
item.model_dump_json()                   # 直接转 JSON 字符串
```

> `exclude_none` 是响应瘦身常用手段;`exclude_unset` 在做 PATCH 部分更新(04 章)时非常关键 —— 能区分"客户端没传"和"客户端传了 null"。

## 2.5 多参数混用:路径 + 查询 + 请求体

```python
from fastapi import Body

@app.put("/items/{item_id}")
def update_item(
    item_id: int,                                # 路径参数
    q: str | None = None,                        # 查询参数
    item: Item | None = None,                    # 请求体(单个模型)
    importance: Annotated[int, Body()] = 0,      # 用 Body() 声明,并入请求体
):
    return {"item_id": item_id, "q": q, "item": item, "importance": importance}
```

对应请求体结构:

```json
{
  "item": {"name": "...", "price": 1},
  "importance": 5
}
```

**多模型请求体两种方案:**

```python
# 方案一:多个独立模型参数(需要 embed=True 才合法,否则 FastAPI 报错)
@app.post("/order1")
def create_order1(item: Item, user: User): ...            # ❌ 报错:无法区分

@app.post("/order1")
def create_order1(item: Item = Body(embed=True), user: User = Body(embed=True)):
    # ✅ 请求体 {"item": {...}, "user": {...}}
    ...

# 方案二(推荐):外层包装模型,结构自解释
class OrderCreate(BaseModel):
    item: Item
    user: User

@app.post("/order2")
def create_order2(order: OrderCreate): ...                # ✅ 结构清晰
```

### 标量请求体(不常见的裸 JSON)

```python
@app.post("/echo")
def echo(payload: Annotated[str, Body()]):
    # 接受裸 JSON 字符串请求体: "hello"
    return {"got": payload}
```

## 2.6 Header 与 Cookie

```python
from fastapi import Header, Cookie
from typing import Annotated

@app.get("/whoami")
def whoami(
    user_agent: Annotated[str | None, Header()] = None,
    # 默认名 user_agent 会自动匹配 User-Agent;
    # 自定义头用 alias 保留原始连字符名
    x_token: Annotated[str | None, Header(alias="X-Token")] = None,
    session_id: Annotated[str | None, Cookie()] = None,
):
    return {"user_agent": user_agent, "x_token": x_token, "session_id": session_id}
```

```bash
curl http://127.0.0.1:8000/whoami \
  -H "X-Token: secret123" \
  -H "Cookie: session_id=abc"
# {"user_agent":"curl/8.x","x_token":"secret123","session_id":"abc"}
```

**Header 的自动转换规则:**

- Header 名**大小写不敏感**:声明 `x_token` 会自动匹配 `X-Token`、`x-token`
- `-` 与 `_` 等价:`user_agent` 能匹配 `User-Agent` 头
- 重复头(如多次 `X-Tag: a` + `X-Tag: b`):声明 `list[str]` 接收为列表

```python
@app.get("/multi-header")
def multi(x_tag: Annotated[list[str] | None, Header(alias="X-Tag")] = None):
    return {"tags": x_tag}     # ["a", "b"]
```

### 在响应中设置 Cookie

```python
from fastapi import Response

@app.post("/login-set-cookie")
def login_set_cookie(response: Response):
    # 通过注入的 Response 对象设置
    response.set_cookie(
        key="session",
        value="abc123",
        max_age=3600,          # 秒
        httponly=True,         # JS 读不到,防 XSS 窃取
        secure=True,           # 仅 HTTPS 传输
        samesite="lax",        # 防 CSRF(见 06 章)
        path="/",
    )
    return {"ok": True}

@app.post("/logout-cookie")
def logout_cookie(response: Response):
    response.delete_cookie("session")
    return {"ok": True}
```

## 2.7 表单与文件上传

```bash
pip install python-multipart   # 处理表单和文件必须先装这个包
```

### 表单(Form)

```python
from fastapi import Form, File, UploadFile
from typing import Annotated

@app.post("/login")
def login(
    username: Annotated[str, Form(min_length=3)],
    password: Annotated[str, Form(min_length=6)],
):
    return {"username": username, "ok": True}
```

```bash
curl -X POST http://127.0.0.1:8000/login \
  -d "username=alice&password=secret123"
```

**硬性限制:** 表单数据以 `application/x-www-form-urlencoded` 提交,**一个接口不能同时声明 JSON 请求体(模型)和 Form 字段** —— FastAPI 启动时会直接报错。API 优先用 JSON,表单只用于传统表单页或 OAuth2 登录(06 章)。

### 文件上传(File / UploadFile)

```python
from fastapi import File, UploadFile

@app.post("/upload")
async def upload(file: UploadFile):
    content = await file.read()                    # 读全部内容
    size = len(content)
    with open(f"uploads/{file.filename}", "wb") as f:
        f.write(content)
    return {"filename": file.filename, "size": size, "content_type": file.content_type}


@app.post("/upload-many")
async def upload_many(files: list[UploadFile]):    # 多文件(名字可不同)
    return {"filenames": [f.filename for f in files]}


@app.post("/upload-with-meta")
async def upload_with_meta(
    file: Annotated[UploadFile, File(description="要上传的图片")],
    folder: Annotated[str, Form()] = "default",    # 文件 + 表单字段可以共存
):
    return {"filename": file.filename, "folder": folder}
```

**`UploadFile` vs `bytes`:**

| 方式 | 声明 | 特点 |
| --- | --- | --- |
| `UploadFile` | `file: UploadFile` | 异步、惰性读取、直接流式落盘,**推荐大文件** |
| `bytes` | `file: bytes = File()` | 整个文件读进内存,只适合小文件 |

**UploadFile 的属性和方法:**

```python
@app.post("/upload-inspect")
async def upload_inspect(file: UploadFile):
    file.filename       # 原始文件名(可能带路径,落盘前要清洗!)
    file.content_type   # MIME 类型(客户端声明,不可信)
    file.size           # 大小(需先读完才有准确值)
    content = await file.read(n)   # 读 n 字节,不传 n 读全部
    await file.seek(0)  # 回卷
    await file.close()  # 关闭底层文件对象(路由结束框架会自动关)
```

**大文件流式写入(避免内存爆炸):**

```python
CHUNK = 1024 * 1024  # 1MB

@app.post("/upload-large")
async def upload_large(file: UploadFile):
    saved = 0
    # 文件名安全清洗:只取 basename,去掉路径穿越
    safe_name = Path(file.filename or "upload.bin").name
    with open(f"uploads/{safe_name}", "wb") as f:
        while chunk := await file.read(CHUNK):
            f.write(chunk)
            saved += len(chunk)
    return {"filename": safe_name, "size": saved}
```

> **上传安全三件事:** ① 文件名清洗(`Path(name).name` 防路径穿越);② 校验扩展名/大小(`file.content_type` 不可信);③ 生产环境限制请求体大小(Uvicorn 不限制,**Nginx `client_max_body_size`** 限制,见 07 章)。

## 2.8 类型转换与校验错误详解

### 自动转换规则回顾

请求数据到达时是字符串(路径/查询)或 JSON 原始值,声明类型驱动转换:

```python
@app.get("/convert")
def convert(
    i: int,              # "123" → 123;"abc" → 422
    f: float,            # "3.14" → 3.14
    b: bool,             # "true"/"1"/"yes"/"on" → True;"0"/"false" → False
    d: datetime,         # "2025-01-01T10:00:00" → datetime
):
    return {"i": i, "f": f, "b": b, "d": d}
```

> **bool 的坑:** 查询参数 `?b=0` 会得到 `False` 而不是错误;`?b=abc` 直接 422。前端传布尔建议用 `"true"/"false"` 字符串。

### 422 校验错误的结构

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "name"],
      "msg": "Field required",
      "input": {"price": 10}
    }
  ]
}
```

| 字段 | 含义 |
| --- | --- |
| `loc` | 错误位置:`["path", "item_id"]`、`["query", "page"]`、`["body", "price"]`、`["header", "x-token"]` |
| `type` | 机器可读错误类型:`missing`、`int_parsing`、`greater_than`、`string_pattern_mismatch` 等 |
| `msg` | 人类可读信息(默认英文) |
| `input` | 触发错误的原始输入 |

### 自定义错误消息(中文)

默认错误是英文,通过 validator 抛 `ValueError` 可换成自定义文案,错误直接进入 `msg`:

```python
class User(BaseModel):
    username: str
    age: int

    @field_validator("age")
    @classmethod
    def check_age(cls, v: int) -> int:
        if v < 0:
            raise ValueError("年龄不能为负数")     # 客户端会收到 "年龄不能为负数"
        return v

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        if len(v) < 3:
            raise ValueError("用户名至少 3 个字符")
        return v
```

更高阶:用 `PydanticCustomError` 自定义 `type` 和完整错误模板:

```python
from pydantic import PydanticCustomError, field_validator

class Product(BaseModel):
    price: float

    @field_validator("price")
    @classmethod
    def check_price(cls, v: float) -> float:
        if v <= 0:
            raise PydanticCustomError(
                "price_positive",               # 自定义 type
                "价格必须为正数,收到 {price}",   # 带占位符的模板
                {"price": v},                    # 模板变量
            )
        return v
# 客户端收到: {"type": "price_positive", "msg": "价格必须为正数,收到 0.0"}
```

**全局统一处理** 422 的格式(把英文数组换成业务格式)在 03 章异常处理中讲解。

## 2.9 直接获取 Request 对象

绝大多数场景用不上,但需要读原始 body、客户端 IP、任意 header 时:

```python
from fastapi import Request

@app.post("/raw")
async def raw(request: Request):
    client_ip = request.client.host          # 客户端 IP(注意反向代理时是 Nginx IP)
    headers = dict(request.headers)          # 所有请求头
    method = request.method
    path = request.url.path                  # 不含查询串的路径
    query = dict(request.query_params)       # 查询参数 dict
    body = await request.body()              # 原始字节 body(注意:读走一次后,再读为空)
    body_json = await request.json()         # 按 JSON 解析(解析失败抛异常)
    return {"ip": client_ip, "path": path, "query": query}
```

> 小心:手动 `request.body()` 之后,FastAPI 再解析声明参数会拿到空 body。要么全手动,要么全声明,别混着用。`X-Forwarded-For` 与真实 IP 的关系见 07 章 Nginx 配置。

## 2.10 参数校验最佳实践小结

1. **必填性**:路径参数必须传;查询/请求体字段无默认值则必填(`...` 显式声明)
2. **类型转换**:`int`、`float`、`bool`、`datetime`、`Decimal`、`UUID`、枚举全部自动转换
3. **数值**用 `ge/gt/le/lt/multiple_of`;字符串用 `min_length/max_length/pattern`;列表用 `min_items/max_items`
4. **跨字段校验**用 `@model_validator(mode="after")`;输入预处理用 `mode="before"`
5. **自定义错误消息**用 validator 抛 `ValueError` 或 `PydanticCustomError`
6. **可变默认值**用 `Field(default_factory=...)`
7. **优先 `Annotated` 写法**,可读性好、可叠加多个校验器
8. **请求用 Create/Update 模型,响应用 Out 模型**,Out 里绝不放敏感字段
9. 查库/调接口的业务校验放依赖注入或服务层(03 章),validator 保持纯函数
10. 表单和 JSON 不混用;上传文件注意文件名清洗、大小限制
