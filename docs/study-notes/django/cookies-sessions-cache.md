# 07 Cookie、Session 与缓存

HTTP 是无状态协议 —— 服务器记不住"你是谁"。Cookie 与 Session 解决状态问题,缓存解决性能问题。本章整合原笔记第 5、6 章并扩写。

## 7.1 Cookie:存浏览器的键值对

Cookie 是服务器让浏览器保存的小段数据(4KB 左右),浏览器之后的每个请求都会自动携带回来。特点:**存在客户端**,可被用户看到/修改 —— 只能存非敏感、可篡改无害的数据(主题偏好、购物车标识)。

### 设置 Cookie

```python
def set_cookie_view(request):
    resp = HttpResponse("设置成功")
    resp.set_cookie(
        key='theme',
        value='dark',
        max_age=3600,            # 秒;不设则会话级(关浏览器消失)
        expires=None,            # 具体到期时间(与 max_age 二选一)
        path='/',                # 哪些路径会携带
        domain=None,             # 哪些域携带(默认当前域)
        secure=False,            # True = 仅 HTTPS 传输
        httponly=True,           # True = JS 读不到(防 XSS 窃取)
        samesite='Lax',          # Strict/Lax/None(防 CSRF,见 6.4)
    )
    return resp
```

### 读取与删除 Cookie

```python
def read_cookie_view(request):
    theme = request.COOKIES.get('theme', 'light')   # COOKIES 是普通 dict
    return HttpResponse(f"当前主题: {theme}")

def del_cookie_view(request):
    resp = HttpResponse("已清除")
    resp.delete_cookie('theme')      # 设过期时间到过去
    return resp
```

### Cookie 应用:记住登录状态

```python
# 登录成功时:
resp = redirect('/')
resp.set_cookie('username', user.username, max_age=3600 * 24 * 30)
return resp

# 视图里:
username = request.COOKIES.get('username')   # 判断是否"记住"过
```

> **注意:** 这种把用户名直接存 cookie 的做法只用于"记住用户名"这类展示需求;**身份认证绝不能靠 cookie 值**(可伪造),必须用 Session 或签名 token。

## 7.2 Session:存服务端的会话

Session 解决的正是"安全地记住登录用户":服务器生成随机 session_id(通过 cookie 发给浏览器),用户数据**存在服务端**,客户端只有一把不可猜测的"钥匙"。

```text
浏览器(cookie: sessionid=abc123)
        │ 每个请求自动携带
        ▼
服务器(django_session 表:abc123 → {"user_id": 1, "cart": [...]})
```

### 配置:三种存储引擎

```python
# settings.py
# 方式 1(默认):存数据库。简单可靠,适合绝大多数项目
SESSION_ENGINE = 'django.contrib.sessions.backends.db'

# 方式 2:存缓存(本机内存)。最快,但重启丢失、多进程不共享(开发体验用)
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}

# 方式 3(生产推荐):Redis 缓存,读写快 + 持久化 + 多进程共享
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',   # 4.0+
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}

# 方式 4:混合(缓存优先,写回数据库;缓存挂了不丢数据)
SESSION_ENGINE = 'django.contrib.sessions.backends.cached_db'

# 常用参数:
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14    # 会话有效期 14 天
SESSION_COOKIE_HTTPONLY = True            # 防 JS 读取(默认)
SESSION_COOKIE_SECURE = True              # 生产开启:仅 HTTPS
SESSION_SAVE_EVERY_REQUEST = False        # True = 每次请求刷新过期时间
```

### 使用 Session(类字典对象)

```python
def login_session_view(request):
    # 写入
    request.session['user_id'] = user.id
    request.session['cart'] = [1, 2, 3]
    # 键名含特殊字符时:
    request.session['fav_color'] = 'blue'

    # 读取
    user_id = request.session.get('user_id')   # 没有返回 None,不报错

    # 更新
    request.session['fav_color'] = 'red'

    # 删除单个键
    del request.session['cart']

    # 清空当前会话(用户登出)
    request.session.flush()        # 同时删除服务端数据 + 浏览器 cookie

    # 过期相关
    request.session.set_expiry(300)            # 5 分钟后过期
    request.session.set_expiry(0)              # 浏览器关闭即过期

    return HttpResponse("ok")
```

### Django 的登录是怎么用 Session 的

```python
# django.contrib.auth.login() 内部做了:
# 1. 生成新 session_id(防会话固定攻击)
# 2. request.session['_auth_user_id'] = user.pk
# 之后每次请求,AuthenticationMiddleware 根据 _auth_user_id 查出用户
# 挂到 request.user 上 —— 所以登出 flush()、封号立即生效
```

### Cookie vs Session 对比

| | Cookie | Session |
| --- | --- | --- |
| 数据存哪 | 浏览器(客户端) | 服务器 |
| 安全性 | 低(可看可改) | 高(客户端只有 sessionid) |
| 容量 | ~4KB | 几乎不限 |
| 网络开销 | 每次请求都传全部 cookie | 只传 sessionid,数据按需取 |
| 适用 | 非敏感偏好、追踪标识 | 登录态、购物车、验证码 |

## 7.3 缓存:性能加速器

### 为什么要缓存

数据库/计算是慢的,相同数据反复查反复算就是浪费。缓存把结果放在高速存储(内存),命中就直接返回。

```text
用户请求 → 查缓存 → 命中?直接返回(1ms)
                  └─ 未命中 → 查库/计算 → 写入缓存 → 返回(50ms)
```

**适合缓存的数据:** 读多写少、计算昂贵、容忍短暂不一致 —— 商品列表、热门文章、用户信息、配置项。**不适合:** 实时性要求极高、每请求都不同的数据。

### 配置缓存后端

```bash
pip install redis django-redis
```

```python
# settings.py
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'TIMEOUT': 300,              # 默认过期 5 分钟
        'OPTIONS': {
            # 配合 django-redis 可用 CONNECTION_POOL_KWARGS 调连接池
        },
    }
}

# 开发环境没有 Redis 时:
# CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
```

> 4.0 前 Django 官方不内置 Redis 后端,用 django-redis 包的 `django_redis.cache.RedisCache`;4.0+ 内置 `RedisCache`。两个写法的 LOCATION 都是 redis URL。

### 缓存 API

```python
from django.core.cache import cache

# 存 / 取
cache.set('hot_books', book_list, timeout=300)   # 5 分钟
book_list = cache.get('hot_books')               # 未命中返回 None

# 不存在才设置(防并发击穿)
cache.add('lock_key', 1, timeout=60)

# 读取并删除(原子)
value = cache.get_or_set('key', default_func, timeout=300)

# 删除 / 清空
cache.delete('hot_books')
cache.clear()                   # 谨慎:全库清空

# 版本控制(改数据结构时用,避免读到旧格式数据)
cache.set('books', data, version=2)
cache.get('books', version=2)

# 键命名规范:业务前缀 + 标识 → cache.set(f'user:{user_id}:profile', ...)
```

### 缓存模式:旁路缓存(Cache-Aside,最常用)

```python
def get_hot_books():
    key = 'hot_books'
    books = cache.get(key)
    if books is None:                       # 未命中
        books = list(Book.objects.filter(is_onsale=True).order_by('-sales')[:10])
        cache.set(key, books, timeout=300)  # 回填缓存
    return books

# 写路径:更新数据后主动删除缓存(而不是更新缓存 —— 删比改简单且不会错)
def update_book(book_id, **fields):
    Book.objects.filter(id=book_id).update(**fields)
    cache.delete('hot_books')               # 失效,下次读重建
```

### 缓存三大问题与对策

| 问题 | 现象 | 对策 |
| --- | --- | --- |
| 缓存穿透 | 查不存在的数据,每次都打到库 | 空结果也缓存(短过期)/布隆过滤器 |
| 缓存击穿 | 热点 key 过期瞬间,海量请求打到库 | 互斥锁重建(`cache.add` 锁)/热点 key 不过期 + 异步刷新 |
| 缓存雪崩 | 大量 key 同时过期,库被打垮 | 过期时间加随机抖动(`timeout=300 + random.randint(0,60)`) |

### 页面级与片段级缓存

```python
# 视图缓存:整个页面
from django.views.decorators.cache import cache_page

@cache_page(60 * 15)                     # 缓存 15 分钟(按 URL 区分,含匿名/登录差异)
def home_view(request):
    return render(request, 'home.html')
```

```python
# settings.py 里的缓存中间件(整站缓存,按需使用)
MIDDLEWARE = [
    'django.middleware.cache.UpdateCacheMiddleware',     # 放最前
    ...,
    'django.middleware.cache.FetchFromCacheMiddleware',  # 放最后
]
CACHE_MIDDLEWARE_SECONDS = 60 * 15
```

```html
<!-- 模板片段缓存 -->
{% load cache %}
{% cache 300 sidebar user.id %}      <!-- 按 user.id 区分缓存 -->
    <aside>...昂贵的渲染...</aside>
{% endcache %}
```

> 页面/片段缓存只适合**无用户差异或差异可枚举**的页面;含登录用户、CSRF token 的页面用页面缓存会串数据(危险),此时优先缓存数据/查询结果而非整页。

## 7.4 常见问题

**Q1:改了代码,用户看到还是旧页面?**
页面缓存没过期。上线后 `cache.clear()` 或按版本换 key;合理设置过期时间。

**Q2:多进程部署下 Session 失效?**
locmem 缓存每个进程一份 → 换 Redis 引擎,所有进程共享。

**Q3:退出登录后后退按钮还能看到页面?**
浏览器 bfcache 缓存了页面。敏感页加 `Cache-Control: no-store` 或靠前端处理;关键数据接口每次校验登录态。

**Q4:cookie 里能存中文吗?**
set_cookie 会自动 URL 编码,可以;但注意 4KB 总大小限制。

## 7.5 最佳实践小结

1. **登录态用 Session**(数据在服务端),Cookie 只存 sessionid
2. **生产环境 Session + 缓存统一 Redis**,多进程共享、可持久化
3. **Cookie 一律 httponly**,生产加 `secure=True`、`samesite='Lax'`
4. 缓存键用 `业务:标识` 命名规范,团队内统一
5. **写操作后主动删缓存**,过期时间加随机抖动
6. 缓存查无也要考虑穿透;热点 key 防击穿
7. 页面级缓存前先想清楚"这个页面有用户差异吗"
