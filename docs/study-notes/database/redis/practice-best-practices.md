# 08 Redis 实战案例与最佳实践

本章通过真实业务场景，展示 Redis 的各种应用模式，并总结生产环境的最佳实践与调优技巧。

## 8.1 计数器与排行榜

### 8.1.1 文章阅读量计数器

**需求**：每篇文章的阅读量需要实时统计，高并发场景下要快速自增。

```python
import redis

r = redis.Redis(host='localhost', port=6379)

def increment_article_view(article_id):
    """增加文章阅读量"""
    key = f"article:{article_id}:views"
    
    # INCR 是原子操作，天然防并发
    views = r.incr(key)
    
    # 设置过期时间（可选，如 30 天后自动清理）
    # r.expire(key, 30 * 24 * 3600)
    
    return views

def get_article_views(article_id):
    """获取文章阅读量"""
    key = f"article:{article_id}:views"
    views = r.get(key)
    return int(views) if views else 0

def batch_increment_views(article_ids):
    """批量增加阅读量（Pipeline 优化）"""
    pipe = r.pipeline()
    for article_id in article_ids:
        key = f"article:{article_id}:views"
        pipe.incr(key)
    return pipe.execute()
```

**性能优化**：
- 使用 `INCR` 原子自增，无需加锁
- 批量操作使用 Pipeline，减少网络往返
- 定期将 Redis 数据同步到 MySQL（如每小时）

### 8.1.2 用户积分排行榜

**需求**：实时展示用户积分排行榜（Top 100），支持查看用户排名。

```python
import redis
import time

r = redis.Redis(host='localhost', port=6379)

def update_user_score(user_id, score):
    """更新用户积分"""
    key = "leaderboard:user_scores"
    
    # ZADD 自动排序，O(log N)
    r.zadd(key, {str(user_id): score})
    
    # 只保留 Top 10000（避免内存无限增长）
    r.zremrangebyrank(key, 0, -10001)

def get_top_users(count=100):
    """获取 Top N 用户"""
    key = "leaderboard:user_scores"
    
    # ZREVRANGE 降序获取
    results = r.zrevrange(key, 0, count - 1, withscores=True)
    
    return [
        {"user_id": int(user_id), "score": score}
        for user_id, score in results
    ]

def get_user_rank(user_id):
    """获取用户排名（从 1 开始）"""
    key = "leaderboard:user_scores"
    
    # ZREVRANK 返回降序排名（从 0 开始）
    rank = r.zrevrank(key, str(user_id))
    
    return rank + 1 if rank is not None else None

def get_users_around(user_id, count=5):
    """获取用户前后的排名（如：前 5 名 + 自己 + 后 5 名）"""
    key = "leaderboard:user_scores"
    
    rank = r.zrevrank(key, str(user_id))
    if rank is None:
        return []
    
    start = max(0, rank - count)
    end = rank + count
    
    results = r.zrevrange(key, start, end, withscores=True)
    return [
        {"user_id": int(uid), "score": score, "rank": start + i + 1}
        for i, (uid, score) in enumerate(results)
    ]
```

**时间维度排行榜**：

```python
def update_daily_score(user_id, score):
    """更新每日排行榜"""
    today = time.strftime("%Y-%m-%d")
    key = f"leaderboard:daily:{today}"
    
    r.zadd(key, {str(user_id): score})
    
    # 设置过期时间（保留 30 天）
    r.expire(key, 30 * 24 * 3600)

def get_daily_top(date, count=100):
    """获取某天的排行榜"""
    key = f"leaderboard:daily:{date}"
    return r.zrevrange(key, 0, count - 1, withscores=True)

def get_weekly_score(user_id):
    """获取用户本周总积分"""
    # 使用 SUNIONSTORE 合并 7 天的数据
    today = time.time()
    keys = []
    for i in range(7):
        date = time.strftime("%Y-%m-%d", time.localtime(today - i * 86400))
        keys.append(f"leaderboard:daily:{date}")
    
    temp_key = f"temp:weekly:{user_id}"
    r.zunionstore(temp_key, keys, aggregate='SUM')
    
    score = r.zscore(temp_key, str(user_id))
    r.delete(temp_key)
    
    return score or 0
```

## 8.2 限流与防刷

### 8.2.1 接口限流（滑动窗口）

**需求**：限制每个用户每分钟最多请求 100 次。

```python
import redis
import time

r = redis.Redis(host='localhost', port=6379)

def is_rate_limited(user_id, limit=100, window=60):
    """
    滑动窗口限流
    
    Args:
        user_id: 用户 ID
        limit: 窗口内最大请求数
        window: 窗口大小（秒）
    
    Returns:
        True: 被限流，False: 未限流
    """
    key = f"rate_limit:{user_id}"
    now = time.time()
    window_start = now - window
    
    # 使用 Lua 脚本保证原子性
    lua_script = """
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window_start = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    
    -- 移除窗口外的请求
    redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
    
    -- 统计当前窗口内的请求数
    local count = redis.call('ZCARD', key)
    
    if count < limit then
        -- 未超限，添加当前请求
        redis.call('ZADD', key, now, now .. math.random())
        redis.call('EXPIRE', key, ARGV[4])
        return 0
    else
        -- 已超限
        return 1
    end
    """
    
    result = r.eval(lua_script, 1, key, now, window_start, limit, window)
    return result == 1

# 使用示例
user_id = 12345
for i in range(120):
    if is_rate_limited(user_id, limit=100, window=60):
        print(f"第 {i+1} 次请求被限流")
        break
    else:
        print(f"第 {i+1} 次请求成功")
```

### 8.2.2 IP 黑名单（防爬虫）

**需求**：自动识别并封禁恶意 IP。

```python
import redis
import time

r = redis.Redis(host='localhost', port=6379)

def record_request(ip):
    """记录 IP 请求"""
    key = f"ip_requests:{ip}"
    
    # 使用 INCR 统计请求数
    count = r.incr(key)
    
    # 首次设置过期时间（1 小时）
    if count == 1:
        r.expire(key, 3600)
    
    # 超过阈值，加入黑名单
    if count > 1000:
        add_to_blacklist(ip, reason="请求频率过高")
    
    return count

def add_to_blacklist(ip, reason="unknown", duration=86400):
    """加入黑名单"""
    key = "blacklist:ips"
    
    # 使用 Hash 存储黑名单信息
    r.hset(key, ip, f"{reason}:{time.time()}")
    
    # 设置过期时间（默认 1 天）
    r.expire(key, duration)

def is_blacklisted(ip):
    """检查 IP 是否在黑名单"""
    key = "blacklist:ips"
    return r.hexists(key, ip)

# 中间件中使用
def request_middleware(request):
    ip = request.client.host
    
    # 检查黑名单
    if is_blacklisted(ip):
        return Response("IP 已被封禁", status=403)
    
    # 记录请求
    record_request(ip)
    
    return None
```

### 8.2.3 验证码防刷

**需求**：同一手机号 60 秒内只能发送一次验证码。

```python
import redis
import random

r = redis.Redis(host='localhost', port=6379)

def send_sms_code(phone):
    """发送短信验证码"""
    # 检查是否在冷却期
    cooldown_key = f"sms:cooldown:{phone}"
    if r.exists(cooldown_key):
        ttl = r.ttl(cooldown_key)
        return False, f"请 {ttl} 秒后再试"
    
    # 检查今日发送次数
    daily_key = f"sms:daily:{phone}"
    daily_count = r.get(daily_key)
    if daily_count and int(daily_count) >= 5:
        return False, "今日发送次数已达上限"
    
    # 生成验证码
    code = str(random.randint(100000, 999999))
    
    # 存储验证码（5 分钟有效）
    code_key = f"sms:code:{phone}"
    r.setex(code_key, 300, code)
    
    # 设置冷却时间（60 秒）
    r.setex(cooldown_key, 60, "1")
    
    # 增加今日发送次数
    r.incr(daily_key)
    r.expire(daily_key, 86400)  # 24 小时后重置
    
    # 实际发送短信（调用第三方服务）
    # send_sms(phone, code)
    
    return True, "发送成功"

def verify_sms_code(phone, code):
    """验证短信验证码"""
    code_key = f"sms:code:{phone}"
    stored_code = r.get(code_key)
    
    if not stored_code:
        return False, "验证码已过期"
    
    if stored_code.decode() != code:
        return False, "验证码错误"
    
    # 验证成功，删除验证码
    r.delete(code_key)
    
    return True, "验证成功"
```

## 8.3 社交场景

### 8.3.1 用户关注关系

**需求**：实现关注、粉丝、共同关注等功能。

```python
import redis

r = redis.Redis(host='localhost', port=6379)

def follow_user(user_id, target_id):
    """用户 A 关注用户 B"""
    # A 的关注列表
    following_key = f"user:{user_id}:following"
    # B 的粉丝列表
    followers_key = f"user:{target_id}:followers"
    
    # 使用 Pipeline 保证原子性
    pipe = r.pipeline()
    pipe.sadd(following_key, target_id)
    pipe.sadd(followers_key, user_id)
    pipe.execute()

def unfollow_user(user_id, target_id):
    """取消关注"""
    following_key = f"user:{user_id}:following"
    followers_key = f"user:{target_id}:followers"
    
    pipe = r.pipeline()
    pipe.srem(following_key, target_id)
    pipe.srem(followers_key, user_id)
    pipe.execute()

def is_following(user_id, target_id):
    """检查是否已关注"""
    following_key = f"user:{user_id}:following"
    return r.sismember(following_key, target_id)

def get_following_list(user_id, offset=0, count=20):
    """获取关注列表"""
    following_key = f"user:{user_id}:following"
    return r.smembers(following_key)[offset:offset+count]

def get_followers_list(user_id, offset=0, count=20):
    """获取粉丝列表"""
    followers_key = f"user:{user_id}:followers"
    return r.smembers(followers_key)[offset:offset+count]

def get_following_count(user_id):
    """获取关注数"""
    return r.scard(f"user:{user_id}:following")

def get_followers_count(user_id):
    """获取粉丝数"""
    return r.scard(f"user:{user_id}:followers")

def get_mutual_following(user_id1, user_id2):
    """获取共同关注"""
    following_key1 = f"user:{user_id1}:following"
    following_key2 = f"user:{user_id2}:following"
    
    # SINTER 求交集
    return r.sinter(following_key1, following_key2)

def get_mutual_followers(user_id1, user_id2):
    """获取共同粉丝"""
    followers_key1 = f"user:{user_id1}:followers"
    followers_key2 = f"user:{user_id2}:followers"
    
    return r.sinter(followers_key1, followers_key2)
```

### 8.3.2 Feed 流（微博/朋友圈）

**需求**：用户发布动态后，粉丝能看到。

**方案一：推模式（Push）**

```python
def publish_post(user_id, content):
    """发布动态（推模式）"""
    # 1. 存储动态内容
    post_id = r.incr("global:post_id")
    post_key = f"post:{post_id}"
    r.hset(post_key, mapping={
        "user_id": user_id,
        "content": content,
        "created_at": time.time()
    })
    
    # 2. 添加到自己的时间线
    timeline_key = f"user:{user_id}:timeline"
    r.zadd(timeline_key, {str(post_id): time.time()})
    
    # 3. 推送给所有粉丝
    followers = r.smembers(f"user:{user_id}:followers")
    pipe = r.pipeline()
    for follower_id in followers:
        follower_timeline = f"user:{follower_id}:timeline"
        pipe.zadd(follower_timeline, {str(post_id): time.time()})
        
        # 限制时间线长度（保留最近 1000 条）
        pipe.zremrangebyrank(follower_timeline, 0, -1001)
    
    pipe.execute()
    
    return post_id

def get_timeline(user_id, offset=0, count=20):
    """获取用户时间线"""
    timeline_key = f"user:{user_id}:timeline"
    
    # ZREVRANGE 按时间倒序
    post_ids = r.zrevrange(timeline_key, offset, offset + count - 1)
    
    # 批量获取动态详情
    pipe = r.pipeline()
    for post_id in post_ids:
        pipe.hgetall(f"post:{post_id.decode()}")
    
    posts = pipe.execute()
    return posts
```

**方案二：拉模式（Pull）**

```python
def publish_post_pull(user_id, content):
    """发布动态（拉模式）"""
    # 只存储到自己的发布列表
    post_id = r.incr("global:post_id")
    post_key = f"post:{post_id}"
    r.hset(post_key, mapping={
        "user_id": user_id,
        "content": content,
        "created_at": time.time()
    })
    
    # 添加到自己的发布列表
    posts_key = f"user:{user_id}:posts"
    r.zadd(posts_key, {str(post_id): time.time()})
    
    return post_id

def get_timeline_pull(user_id, offset=0, count=20):
    """获取用户时间线（拉模式）"""
    # 1. 获取关注列表
    following = r.smembers(f"user:{user_id}:following")
    
    # 2. 合并所有关注用户的动态
    temp_key = f"temp:timeline:{user_id}:{time.time()}"
    
    # ZUNIONSTORE 合并多个有序集合
    posts_keys = [f"user:{uid.decode()}:posts" for uid in following]
    r.zunionstore(temp_key, posts_keys)
    
    # 3. 获取最新 N 条
    post_ids = r.zrevrange(temp_key, offset, offset + count - 1)
    
    # 4. 清理临时 key
    r.delete(temp_key)
    
    # 5. 批量获取动态详情
    pipe = r.pipeline()
    for post_id in post_ids:
        pipe.hgetall(f"post:{post_id.decode()}")
    
    return pipe.execute()
```

**推 vs 拉对比**：

| 维度 | 推模式 | 拉模式 |
|------|--------|--------|
| **写性能** | 慢（要推送给所有粉丝） | 快（只写自己） |
| **读性能** | 快（直接读时间线） | 慢（要合并多个列表） |
| **内存占用** | 大（每个粉丝一份） | 小（只存原始数据） |
| **适用场景** | 粉丝数少（如微博大V） | 关注数少（如普通用户） |

**混合模式**：
- 大 V（粉丝 > 10000）：拉模式
- 普通用户（粉丝 < 10000）：推模式

## 8.4 消息队列

### 8.4.1 简单任务队列（List）

```python
import redis
import json
import time

r = redis.Redis(host='localhost', port=6379)

class SimpleQueue:
    def __init__(self, queue_name):
        self.queue_key = f"queue:{queue_name}"
    
    def push(self, task):
        """入队"""
        r.rpush(self.queue_key, json.dumps(task))
    
    def pop(self, timeout=0):
        """出队（阻塞）"""
        result = r.blpop(self.queue_key, timeout)
        if result:
            _, data = result
            return json.loads(data)
        return None
    
    def size(self):
        """队列长度"""
        return r.llen(self.queue_key)

# 生产者
queue = SimpleQueue("email")
for i in range(100):
    queue.push({"to": f"user{i}@example.com", "subject": "Hello"})
    time.sleep(0.1)

# 消费者（多进程/多线程）
def worker():
    queue = SimpleQueue("email")
    while True:
        task = queue.pop(timeout=5)
        if task:
            print(f"处理任务：{task}")
            # send_email(task['to'], task['subject'])
        else:
            print("队列为空，等待...")
```

### 8.4.2 延迟队列（ZSet）

```python
import redis
import time
import json

r = redis.Redis(host='localhost', port=6379)

class DelayedQueue:
    def __init__(self, queue_name):
        self.queue_key = f"delayed:{queue_name}"
    
    def push(self, task, delay_seconds):
        """延迟入队"""
        execute_at = time.time() + delay_seconds
        r.zadd(self.queue_key, {json.dumps(task): execute_at})
    
    def pop_ready(self, count=10):
        """获取已到期的任务"""
        now = time.time()
        
        # ZRANGEBYSCORE 获取 score <= now 的任务
        tasks = r.zrangebyscore(self.queue_key, 0, now, start=0, num=count)
        
        # 从队列中移除
        if tasks:
            r.zremrangebyscore(self.queue_key, 0, now)
        
        return [json.loads(task) for task in tasks]

# 使用示例
queue = DelayedQueue("order_timeout")

# 订单创建后 30 分钟未支付，自动取消
order_id = "ORDER_12345"
queue.push({"order_id": order_id, "action": "cancel"}, delay_seconds=30 * 60)

# 消费者循环检查
while True:
    ready_tasks = queue.pop_ready()
    for task in ready_tasks:
        print(f"执行延迟任务：{task}")
        # cancel_order(task['order_id'])
    
    time.sleep(1)
```

### 8.4.3 消息队列（Stream）

```python
import redis
import time

r = redis.Redis(host='localhost', port=6379)

class MessageQueue:
    def __init__(self, stream_name, group_name, consumer_name):
        self.stream = stream_name
        self.group = group_name
        self.consumer = consumer_name
        
        # 创建消费者组（如果不存在）
        try:
            r.xgroup_create(self.stream, self.group, id='0', mkstream=True)
        except redis.exceptions.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise
    
    def publish(self, message):
        """发布消息"""
        return r.xadd(self.stream, message)
    
    def consume(self, count=10, block=1000):
        """消费消息"""
        # XREADGROUP 从消费者组读取
        messages = r.xreadgroup(
            groupname=self.group,
            consumername=self.consumer,
            streams={self.stream: '>'},
            count=count,
            block=block
        )
        
        if messages:
            for stream, stream_messages in messages:
                for message_id, data in stream_messages:
                    yield message_id, data
    
    def ack(self, message_id):
        """确认消息"""
        r.xack(self.stream, self.group, message_id)

# 生产者
mq = MessageQueue("orders", "order_group", "producer")
for i in range(100):
    mq.publish({"order_id": i, "amount": 100})
    time.sleep(0.1)

# 消费者
def consumer_worker(consumer_name):
    mq = MessageQueue("orders", "order_group", consumer_name)
    
    for message_id, data in mq.consume():
        print(f"[{consumer_name}] 处理消息：{message_id} - {data}")
        
        # 处理业务逻辑
        # process_order(data)
        
        # 确认消息
        mq.ack(message_id)
```

## 8.5 Session 共享

### 8.5.1 分布式 Session

**需求**：多台服务器共享用户登录状态。

```python
import redis
import json
import secrets
import time

r = redis.Redis(host='localhost', port=6379)

class SessionManager:
    def __init__(self, redis_client, prefix="session:", ttl=3600):
        self.redis = redis_client
        self.prefix = prefix
        self.ttl = ttl
    
    def create_session(self, user_id, data=None):
        """创建 Session"""
        session_id = secrets.token_urlsafe(32)
        key = f"{self.prefix}{session_id}"
        
        session_data = {
            "user_id": user_id,
            "created_at": time.time(),
            **(data or {})
        }
        
        # 存储 Session（JSON 格式）
        self.redis.setex(key, self.ttl, json.dumps(session_data))
        
        return session_id
    
    def get_session(self, session_id):
        """获取 Session"""
        key = f"{self.prefix}{session_id}"
        data = self.redis.get(key)
        
        if data:
            # 续期
            self.redis.expire(key, self.ttl)
            return json.loads(data)
        
        return None
    
    def update_session(self, session_id, data):
        """更新 Session"""
        key = f"{self.prefix}{session_id}"
        existing = self.get_session(session_id)
        
        if existing:
            existing.update(data)
            self.redis.setex(key, self.ttl, json.dumps(existing))
            return True
        
        return False
    
    def delete_session(self, session_id):
        """删除 Session"""
        key = f"{self.prefix}{session_id}"
        self.redis.delete(key)

# FastAPI 中间件示例
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

app = FastAPI()
session_manager = SessionManager(r)

@app.middleware("http")
async def session_middleware(request: Request, call_next):
    # 从 Cookie 获取 session_id
    session_id = request.cookies.get("session_id")
    
    if session_id:
        session = session_manager.get_session(session_id)
        request.state.session = session
    else:
        request.state.session = None
    
    response = await call_next(request)
    return response

@app.post("/login")
async def login(username: str, password: str):
    # 验证用户名密码
    user_id = authenticate(username, password)
    
    if user_id:
        # 创建 Session
        session_id = session_manager.create_session(user_id, {"username": username})
        
        response = JSONResponse({"status": "ok"})
        response.set_cookie("session_id", session_id, httponly=True)
        return response
    
    return JSONResponse({"status": "error"}, status_code=401)

@app.post("/logout")
async def logout(request: Request, response: Response):
    session = request.state.session
    if session:
        session_id = request.cookies.get("session_id")
        session_manager.delete_session(session_id)
    
    response.delete_cookie("session_id")
    return {"status": "ok"}
```

## 8.6 地理位置（LBS）

### 8.6.1 附近的人

```python
import redis

r = redis.Redis(host='localhost', port=6379)

def add_user_location(user_id, longitude, latitude):
    """添加用户位置"""
    r.geoadd("user_locations", longitude, latitude, str(user_id))

def get_nearby_users(longitude, latitude, radius_km=5, count=10):
    """获取附近用户"""
    # GEORADIUS 按半径查询
    results = r.georadius(
        "user_locations",
        longitude, latitude,
        radius_km, unit='km',
        withcoord=True,
        withdist=True,
        count=count
    )
    
    return [
        {
            "user_id": int(user_id.decode()),
            "distance": distance,
            "longitude": coord[0],
            "latitude": coord[1]
        }
        for user_id, distance, coord in results
    ]

def get_distance(user_id1, user_id2):
    """计算两个用户的距离"""
    return r.geodist("user_locations", str(user_id1), str(user_id2), unit='km')

# 使用示例
add_user_location(1, 116.397128, 39.916527)  # 北京
add_user_location(2, 116.407128, 39.926527)  # 北京附近
add_user_location(3, 121.473701, 31.230416)  # 上海

nearby = get_nearby_users(116.397128, 39.916527, radius_km=10)
print(f"附近的人：{nearby}")

distance = get_distance(1, 2)
print(f"距离：{distance} km")
```

## 8.7 布隆过滤器

### 8.7.1 安装 RedisBloom 模块

```bash
# 下载 RedisBloom
git clone https://github.com/RedisBloom/RedisBloom.git
cd RedisBloom
make

# 加载模块
redis-server --loadmodule /path/to/redisbloom.so
```

### 8.7.2 使用布隆过滤器

```python
from redisbloom.client import Client

rb = Client(host='localhost', port=6379)

# 创建布隆过滤器（容量 100 万，误判率 0.1%）
rb.bfCreate('email_filter', 0.001, 1000000)

# 添加元素
rb.bfAdd('email_filter', 'user1@example.com')
rb.bfAdd('email_filter', 'user2@example.com')

# 批量添加
rb.bfMAdd('email_filter', 'user3@example.com', 'user4@example.com')

# 检查是否存在
exists = rb.bfExists('email_filter', 'user1@example.com')  # True
not_exists = rb.bfExists('email_filter', 'unknown@example.com')  # 可能 False（有误判）

# 查看信息
info = rb.bfInfo('email_filter')
print(info)
```

**应用场景：注册时检查邮箱是否已存在**

```python
def check_email_available(email):
    """检查邮箱是否可用"""
    # 1. 先查布隆过滤器（快速排除）
    if not rb.bfExists('email_filter', email):
        return True  # 一定不存在，可用
    
    # 2. 布隆过滤器说存在，再查数据库确认
    exists = db.query("SELECT 1 FROM users WHERE email = ?", email)
    return not exists

def register_user(email, password):
    """注册用户"""
    if not check_email_available(email):
        raise Exception("邮箱已被注册")
    
    # 创建用户
    user_id = create_user(email, password)
    
    # 添加到布隆过滤器
    rb.bfAdd('email_filter', email)
    
    return user_id
```

## 8.8 生产环境最佳实践

### 8.8.1 Key 命名规范

```text
✅ 推荐：
  user:1001:profile          # 用户资料
  article:2001:views         # 文章阅读量
  order:3001:status          # 订单状态
  session:abc123def456       # Session
  
❌ 不推荐：
  user_1001_profile          # 使用冒号分隔，便于 SCAN
  u:1001:p                   # 太简短，不易理解
  user:1001                  # 没有说明存储什么数据
```

**规范**：
- 使用冒号 `:` 分隔层级
- 包含业务前缀（user/article/order）
- 包含对象 ID
- 说明数据类型（profile/views/status）

### 8.8.2 内存优化

**策略一：使用 Hash 存储小对象**

```python
# ❌ 不推荐：每个字段一个 key
r.set("user:1001:name", "Alice")
r.set("user:1001:age", 25)
r.set("user:1001:email", "alice@example.com")
# 3 个 key，每个都有元数据开销（~64 bytes）

# ✅ 推荐：使用 Hash
r.hset("user:1001", mapping={
    "name": "Alice",
    "age": 25,
    "email": "alice@example.com"
})
# 1 个 key，使用 ziplist 编码，内存占用更小
```

**策略二：使用整型而非字符串**

```python
# ❌ 不推荐
r.set("user:1001:status", "active")

# ✅ 推荐
r.set("user:1001:status", 1)  # 1=active, 0=inactive
```

**策略三：压缩大 Value**

```python
import gzip
import json

def set_compressed(key, data, ttl=None):
    """存储压缩数据"""
    json_str = json.dumps(data)
    compressed = gzip.compress(json_str.encode())
    
    if ttl:
        r.setex(key, ttl, compressed)
    else:
        r.set(key, compressed)

def get_compressed(key):
    """获取压缩数据"""
    compressed = r.get(key)
    if compressed:
        json_str = gzip.decompress(compressed).decode()
        return json.loads(json_str)
    return None
```

### 8.8.3 高可用配置

```conf
# redis.conf（生产环境）

# 内存
maxmemory 8gb
maxmemory-policy allkeys-lru

# 持久化
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# 网络
timeout 0
tcp-keepalive 300

# 安全
requirepass your_strong_password
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command CONFIG "CONFIG_b9f2a8c1"

# 性能优化
hz 100
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
replica-lazy-flush yes

# 集群（如果使用）
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 15000
```

### 8.8.4 监控指标

**关键指标**：

```bash
# 1. 内存使用
redis-cli INFO memory | grep used_memory_human

# 2. 命中率
redis-cli INFO stats | grep keyspace_hits
redis-cli INFO stats | grep keyspace_misses
# 命中率 = hits / (hits + misses)

# 3. 连接数
redis-cli INFO clients | grep connected_clients

# 4. 慢查询
redis-cli SLOWLOG GET 10

# 5. 大 Key
redis-cli --bigkeys

# 6. 热 Key
redis-cli --hotkeys
```

**告警规则**：

```yaml
# Prometheus 告警
- alert: RedisHighMemory
  expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.8
  for: 5m
  
- alert: RedisLowHitRate
  expr: rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) < 0.9
  for: 5m
  
- alert: RedisHighConnections
  expr: redis_connected_clients > 1000
  for: 5m
```

### 8.8.5 故障排查清单

| 问题 | 排查命令 | 解决方案 |
|------|---------|---------|
| 内存使用高 | `INFO memory` | 增加内存、优化 Key、调整淘汰策略 |
| 命中率低 | `INFO stats` | 检查 Key 设计、增加缓存预热 |
| 响应慢 | `SLOWLOG GET` | 优化慢查询、避免大 Key |
| 连接数满 | `INFO clients` | 增加 maxclients、优化连接池 |
| 主从延迟 | `INFO replication` | 检查网络、增加从节点 |
| 集群异常 | `CLUSTER INFO` | 检查节点状态、重新分片 |

## 8.9 总结

Redis 是后端开发的必备技能，掌握以下核心能力：

**基础能力**：
- ✅ 5 种基本数据类型的使用场景
- ✅ Key 设计规范与命名规范
- ✅ Pipeline 批量操作

**进阶能力**：
- ✅ 分布式锁（Redlock、Fencing Token）
- ✅ 缓存穿透/击穿/雪崩的解决方案
- ✅ 数据一致性保证（延迟双删、Canal）

**高级能力**：
- ✅ Redis Cluster 集群部署
- ✅ 性能调优（内存优化、慢查询分析）
- ✅ 生产环境监控与故障排查

**实战经验**：
- ✅ 计数器、排行榜、限流、Session 共享
- ✅ 社交关系、Feed 流、消息队列
- ✅ 地理位置、布隆过滤器

持续学习，多实践，才能成为 Redis 高手！
