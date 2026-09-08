# 06 Redis 缓存设计与常见问题

Redis 作为缓存使用时，需要解决一系列工程问题：缓存穿透、缓存击穿、缓存雪崩、数据一致性等。本章深入剖析这些问题的成因与解决方案。

## 6.1 缓存读写策略

### 6.1.1 Cache Aside（旁路缓存）

**最常用模式**：应用程序负责管理缓存与数据库的交互。

```text
读流程：
  ① 先读缓存
  ② 缓存未命中 → 读数据库
  ③ 写入缓存，设置过期时间
  ④ 返回数据

写流程（两种策略）：
  策略 A：先更新数据库，再删除缓存
  策略 B：先删除缓存，再更新数据库
```

**策略对比**：

| 策略 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| 先更新 DB，再删缓存 | 数据一致性较好 | 极端情况下可能不一致 | ⭐⭐⭐⭐ |
| 先删缓存，再更新 DB | 简单直接 | 并发读可能导致脏数据 | ⭐⭐ |

**推荐做法**：先更新数据库，再删除缓存（配合重试机制）。

```python
# Python 示例
def get_user(user_id):
    # 1. 先读缓存
    cached = redis.get(f"user:{user_id}")
    if cached:
        return json.loads(cached)
    
    # 2. 缓存未命中，读数据库
    user = db.query("SELECT * FROM users WHERE id = ?", user_id)
    if not user:
        # 防止缓存穿透：缓存空值
        redis.setex(f"user:{user_id}", 300, "null")
        return None
    
    # 3. 写入缓存
    redis.setex(f"user:{user_id}", 3600, json.dumps(user))
    return user

def update_user(user_id, data):
    # 1. 先更新数据库
    db.execute("UPDATE users SET ? WHERE id = ?", data, user_id)
    
    # 2. 再删除缓存（带重试）
    for _ in range(3):
        if redis.delete(f"user:{user_id}"):
            break
        time.sleep(0.1)
```

### 6.1.2 Read/Write Through

**缓存层代理**：应用程序只与缓存交互，缓存层负责同步数据库。

```text
读流程：
  ① 应用读缓存
  ② 缓存未命中 → 缓存层读数据库
  ③ 缓存层写入缓存
  ④ 返回数据

写流程：
  ① 应用写缓存
  ② 缓存层同步写入数据库
  ③ 返回成功
```

**优点**：应用代码简洁，不需要关心数据库  
**缺点**：缓存层实现复杂，Redis 原生不支持

### 6.1.3 Write Behind（异步写回）

**批量异步写**：缓存层收集写操作，批量异步写入数据库。

```text
写流程：
  ① 应用写缓存（立即返回）
  ② 缓存层记录脏数据
  ③ 后台线程定期批量写入数据库
```

**优点**：写入性能极高  
**缺点**：可能丢失数据（缓存宕机时）  
**适用场景**：日志、计数器等可容忍丢失的场景

## 6.2 缓存穿透（Cache Penetration）

### 6.2.1 问题描述

**定义**：查询**不存在的数据**，导致请求直接打到数据库。

```text
攻击场景：
  · 恶意用户频繁查询不存在的用户 ID（如 id=-1）
  · 每次查询都穿透缓存，直接访问数据库
  · 数据库压力剧增，可能崩溃

示例：
  GET /user?id=999999999  （不存在的 ID）
  → 缓存未命中
  → 查询数据库（未找到）
  → 不缓存结果（因为数据不存在）
  → 下次请求仍然穿透
```

### 6.2.2 解决方案

**方案一：缓存空值**

```python
def get_user(user_id):
    cached = redis.get(f"user:{user_id}")
    if cached:
        return json.loads(cached) if cached != "null" else None
    
    user = db.query("SELECT * FROM users WHERE id = ?", user_id)
    if not user:
        # 缓存空值，设置较短过期时间（防止恶意攻击）
        redis.setex(f"user:{user_id}", 300, "null")  # 5 分钟
        return None
    
    redis.setex(f"user:{user_id}", 3600, json.dumps(user))
    return user
```

**优点**：实现简单  
**缺点**：
- 大量空值占用缓存空间
- 攻击者可以构造大量不同的无效 key

**方案二：布隆过滤器（Bloom Filter）**

```text
原理：
  · 使用布隆过滤器存储所有合法的 key
  · 查询前先检查布隆过滤器
  · 过滤器说不存在 → 一定不存在（直接返回）
  · 过滤器说存在 → 可能存在（继续查缓存/数据库）

特点：
  · 空间效率高（1 亿个 key 只需 ~100MB）
  · 有误判率（可能把不存在的判断为存在）
  · 不支持删除（需要用 Counting Bloom Filter）
```

```python
# Redis 布隆过滤器（RedisBloom 模块）
from redisbloom.client import Client

rb = Client(host='localhost', port=6379)

# 初始化布隆过滤器（容量 1 亿，误判率 0.01%）
rb.bfCreate('user_ids', 0.0001, 100000000)

# 添加所有合法 ID
for user_id in all_valid_user_ids:
    rb.bfAdd('user_ids', user_id)

# 查询时先检查布隆过滤器
def get_user(user_id):
    # 布隆过滤器检查
    if not rb.bfExists('user_ids', user_id):
        return None  # 一定不存在，直接返回
    
    # 可能存在，继续正常查询流程
    cached = redis.get(f"user:{user_id}")
    if cached:
        return json.loads(cached)
    
    user = db.query("SELECT * FROM users WHERE id = ?", user_id)
    if user:
        redis.setex(f"user:{user_id}", 3600, json.dumps(user))
    return user
```

**方案三：参数校验**

```python
def get_user(user_id):
    # 前置校验：过滤明显非法的 ID
    if user_id <= 0 or user_id > 100000000:
        return None
    
    # 正常查询流程...
```

### 6.2.3 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 缓存空值 | 实现简单 | 占用空间，难防攻击 | 穿透量小，非恶意攻击 |
| 布隆过滤器 | 空间效率高，防攻击 | 有误判，实现复杂 | 穿透量大，需要防攻击 |
| 参数校验 | 简单直接 | 只能防简单攻击 | 作为第一道防线 |

**推荐组合**：参数校验 + 布隆过滤器（或缓存空值）

## 6.3 缓存击穿（Cache Breakdown）

### 6.3.1 问题描述

**定义**：**热点 key 过期瞬间**，大量并发请求同时打到数据库。

```text
场景：
  · 某个热点数据（如首页配置）缓存过期
  · 瞬间 10000 个请求同时到达
  · 缓存未命中，全部打到数据库
  · 数据库压力激增，可能崩溃

与缓存穿透的区别：
  · 穿透：查询不存在的数据
  · 击穿：查询存在的数据，但缓存刚好过期
```

### 6.3.2 解决方案

**方案一：互斥锁（Mutex Lock）**

```python
import time

def get_hot_data(key):
    # 1. 先查缓存
    cached = redis.get(key)
    if cached:
        return json.loads(cached)
    
    # 2. 缓存未命中，尝试获取锁
    lock_key = f"lock:{key}"
    lock_acquired = redis.set(lock_key, "1", nx=True, ex=10)  # 10 秒超时
    
    if lock_acquired:
        try:
            # 3. 获取锁成功，查数据库
            data = db.query("SELECT * FROM hot_data WHERE key = ?", key)
            
            # 4. 写入缓存
            redis.setex(key, 3600, json.dumps(data))
            return data
        finally:
            # 5. 释放锁
            redis.delete(lock_key)
    else:
        # 6. 获取锁失败，短暂休眠后重试
        time.sleep(0.1)
        return get_hot_data(key)
```

**优点**：保证只有一个线程查数据库  
**缺点**：
- 其他线程需要等待（用户体验下降）
- 实现复杂，需要处理死锁

**方案二：逻辑过期（永不过期 + 后台更新）**

```python
def get_hot_data(key):
    cached = redis.get(key)
    if not cached:
        return None
    
    data = json.loads(cached)
    
    # 检查是否逻辑过期
    if data.get('expire_time') < time.time():
        # 逻辑过期，异步更新缓存（不阻塞当前请求）
        threading.Thread(target=refresh_cache, args=(key,)).start()
    
    return data.get('value')

def refresh_cache(key):
    # 后台线程更新缓存
    data = db.query("SELECT * FROM hot_data WHERE key = ?", key)
    data['expire_time'] = time.time() + 3600  # 逻辑过期时间
    redis.set(key, json.dumps(data))
```

**优点**：不阻塞请求，用户体验好  
**缺点**：
- 短时间内可能返回旧数据
- 需要额外字段存储过期时间

**方案三：预热（Preload）**

```python
# 应用启动时预加载热点数据
def preload_hot_data():
    hot_keys = ['home_config', 'hot_products', 'banner_list']
    for key in hot_keys:
        data = db.query("SELECT * FROM hot_data WHERE key = ?", key)
        redis.setex(key, 3600, json.dumps(data))

# 定时任务刷新热点数据（过期前主动更新）
def refresh_hot_data():
    hot_keys = ['home_config', 'hot_products', 'banner_list']
    for key in hot_keys:
        data = db.query("SELECT * FROM hot_data WHERE key = ?", key)
        redis.setex(key, 3600, json.dumps(data))
```

**优点**：简单有效，避免过期  
**缺点**：需要维护热点 key 列表

### 6.3.3 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 互斥锁 | 保证数据最新 | 阻塞请求，实现复杂 | 对数据一致性要求高 |
| 逻辑过期 | 不阻塞请求 | 可能返回旧数据 | 允许短暂不一致 |
| 预热 | 简单有效 | 需要维护热点列表 | 热点数据可枚举 |

**推荐组合**：预热 + 互斥锁（双保险）

## 6.4 缓存雪崩（Cache Avalanche）

### 6.4.1 问题描述

**定义**：**大量缓存同时过期**，导致请求全部打到数据库。

```text
场景：
  · 凌晨 2 点批量更新缓存，设置相同的过期时间（如 1 小时）
  · 凌晨 3 点，大量缓存同时过期
  · 瞬间大量请求打到数据库
  · 数据库崩溃

与缓存击穿的区别：
  · 击穿：单个热点 key 过期
  · 雪崩：大量 key 同时过期
```

### 6.4.2 解决方案

**方案一：过期时间加随机值**

```python
import random

def set_cache(key, value):
    # 基础过期时间 + 随机抖动（避免同时过期）
    base_ttl = 3600  # 1 小时
    jitter = random.randint(0, 300)  # 0~5 分钟随机
    ttl = base_ttl + jitter
    
    redis.setex(key, ttl, json.dumps(value))
```

**优点**：简单有效，打散过期时间  
**缺点**：无法完全避免（如果数据量极大）

**方案二：多级缓存**

```text
架构：
  请求 → L1 缓存（本地缓存，如 Caffeine）
       → L2 缓存（Redis）
       → 数据库

策略：
  · L1 缓存：容量小，速度快，TTL 短（如 5 分钟）
  · L2 缓存：容量大，速度中等，TTL 长（如 1 小时）
  · L2 过期时，L1 可能还有数据，减轻数据库压力
```

```python
from cachetools import TTLCache

# L1：本地缓存（容量 1000，TTL 5 分钟）
local_cache = TTLCache(maxsize=1000, ttl=300)

def get_data(key):
    # 1. 查 L1 缓存
    if key in local_cache:
        return local_cache[key]
    
    # 2. 查 L2 缓存（Redis）
    cached = redis.get(key)
    if cached:
        data = json.loads(cached)
        local_cache[key] = data  # 写入 L1
        return data
    
    # 3. 查数据库
    data = db.query("SELECT * FROM data WHERE key = ?", key)
    if data:
        # 写入 L2（加随机抖动）
        ttl = 3600 + random.randint(0, 300)
        redis.setex(key, ttl, json.dumps(data))
        local_cache[key] = data  # 写入 L1
    
    return data
```

**优点**：多层保护，可靠性高  
**缺点**：实现复杂，数据一致性更难保证

**方案三：限流降级**

```python
from ratelimit import limits, sleep_and_retry

@sleep_and_retry
@limits(calls=100, period=1)  # 每秒最多 100 次数据库查询
def query_database(key):
    return db.query("SELECT * FROM data WHERE key = ?", key)

def get_data(key):
    cached = redis.get(key)
    if cached:
        return json.loads(cached)
    
    try:
        data = query_database(key)
        if data:
            redis.setex(key, 3600, json.dumps(data))
        return data
    except Exception:
        # 数据库压力过大，返回默认值或降级处理
        return get_default_data(key)
```

**优点**：保护数据库不崩溃  
**缺点**：部分请求可能失败或返回旧数据

### 6.4.3 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 过期时间加随机值 | 简单有效 | 无法完全避免 | 通用方案 |
| 多级缓存 | 多层保护，可靠性高 | 实现复杂 | 高可用要求 |
| 限流降级 | 保护数据库 | 部分请求失败 | 作为兜底方案 |

**推荐组合**：过期时间加随机值 + 限流降级

## 6.5 缓存与数据库一致性

### 6.5.1 问题描述

**核心问题**：缓存与数据库的数据可能不一致。

```text
不一致场景：
  ① 更新数据库成功，删除缓存失败 → 缓存中是旧数据
  ② 删除缓存成功，更新数据库失败 → 缓存被删，数据库未更新
  ③ 并发读写导致的数据竞争
```

### 6.5.2 解决方案

**方案一：重试机制**

```python
def update_user(user_id, data):
    # 1. 更新数据库
    db.execute("UPDATE users SET ? WHERE id = ?", data, user_id)
    
    # 2. 删除缓存（带重试）
    for attempt in range(3):
        if redis.delete(f"user:{user_id}"):
            return True
        time.sleep(0.1 * (attempt + 1))  # 指数退避
    
    # 3. 重试失败，记录日志，人工介入
    logger.error(f"Failed to delete cache for user:{user_id}")
    return False
```

**方案二：延迟双删**

```python
def update_user(user_id, data):
    # 1. 先删除缓存
    redis.delete(f"user:{user_id}")
    
    # 2. 更新数据库
    db.execute("UPDATE users SET ? WHERE id = ?", data, user_id)
    
    # 3. 延迟一段时间后再次删除缓存
    # （防止在步骤 1 和 2 之间有其他请求读取了旧数据并写入缓存）
    time.sleep(0.5)
    redis.delete(f"user:{user_id}")
```

**优点**：减少不一致窗口  
**缺点**：
- 延迟时间难以确定
- 仍然无法完全保证一致性

**方案三：消息队列异步删除**

```python
def update_user(user_id, data):
    # 1. 更新数据库
    db.execute("UPDATE users SET ? WHERE id = ?", data, user_id)
    
    # 2. 发送消息到 MQ
    mq.publish('cache_delete', {'key': f'user:{user_id}'})

# 消费者（独立服务）
def cache_delete_consumer():
    while True:
        msg = mq.consume('cache_delete')
        key = msg['key']
        
        # 删除缓存（带重试）
        for _ in range(3):
            if redis.delete(key):
                break
            time.sleep(0.1)
```

**优点**：
- 解耦，更新数据库与删除缓存异步
- 消费者可以重试，保证最终一致性

**缺点**：
- 引入 MQ，增加复杂度
- 存在短暂不一致窗口

**方案四：Canal 订阅 Binlog**

```text
架构：
  应用 → 更新 MySQL
  Canal → 订阅 MySQL binlog
  Canal → 发送消息到 MQ
  消费者 → 删除 Redis 缓存

优点：
  · 应用无感知，不需要修改代码
  · 保证最终一致性
  · 支持多种数据源
```

```java
// Canal 消费者示例（Java）
@CanalHandler(destination = "example")
public void handle(BinlogMessage message) {
    if (message.getTable().equals("users")) {
        Long userId = message.getChangedData().get("id");
        redisTemplate.delete("user:" + userId);
    }
}
```

### 6.5.3 方案对比

| 方案 | 优点 | 缺点 | 一致性保证 |
|------|------|------|-----------|
| 重试机制 | 简单直接 | 可能失败 | 弱 |
| 延迟双删 | 减少不一致窗口 | 延迟时间难定 | 中等 |
| 消息队列 | 解耦，可重试 | 引入 MQ | 最终一致 |
| Canal 订阅 | 应用无感知 | 实现复杂 | 最终一致 |

**推荐**：
- 简单场景：重试机制
- 高要求场景：Canal 订阅 binlog

## 6.6 缓存预热与更新策略

### 6.6.1 缓存预热

**定义**：系统启动前主动加载热点数据到缓存。

```python
def preload_cache():
    """应用启动时预热缓存"""
    # 1. 加载热点用户
    hot_users = db.query("SELECT * FROM users WHERE is_hot = 1")
    for user in hot_users:
        redis.setex(f"user:{user.id}", 3600, json.dumps(user))
    
    # 2. 加载首页配置
    home_config = db.query("SELECT * FROM config WHERE page = 'home'")
    redis.setex("home_config", 3600, json.dumps(home_config))
    
    # 3. 加载热门商品
    hot_products = db.query("SELECT * FROM products ORDER BY sales DESC LIMIT 100")
    redis.setex("hot_products", 3600, json.dumps(hot_products))
```

### 6.6.2 缓存更新策略

**策略一：定时刷新**

```python
# 定时任务每小时刷新热点数据
@schedule.every(1).hours
def refresh_hot_cache():
    hot_keys = ['home_config', 'hot_products', 'banner_list']
    for key in hot_keys:
        data = db.query(f"SELECT * FROM {key}")
        redis.setex(key, 3600, json.dumps(data))
```

**策略二：主动更新**

```python
def update_product(product_id, data):
    # 更新数据库
    db.execute("UPDATE products SET ? WHERE id = ?", data, product_id)
    
    # 立即更新缓存（而不是删除）
    product = db.query("SELECT * FROM products WHERE id = ?", product_id)
    redis.setex(f"product:{product_id}", 3600, json.dumps(product))
```

**策略三：监听数据变更**

```python
# 使用 Redis Pub/Sub 或 MQ 监听数据变更
def on_data_changed(table, record_id):
    if table == 'products':
        product = db.query("SELECT * FROM products WHERE id = ?", record_id)
        redis.setex(f"product:{record_id}", 3600, json.dumps(product))
```

## 6.7 缓存监控与指标

### 6.7.1 关键指标

| 指标 | 说明 | 健康值 |
|------|------|--------|
| **命中率** | 缓存命中次数 / 总查询次数 | > 95% |
| **内存使用率** | used_memory / maxmemory | < 80% |
| **驱逐率** | evicted_keys 增速 | 接近 0 |
| **响应时间** | 平均响应时间 | < 1ms |
| **连接数** | connected_clients | < maxclients * 80% |

### 6.7.2 监控命令

```bash
# 查看命中率
redis-cli INFO stats | grep keyspace_hits
redis-cli INFO stats | grep keyspace_misses
# 命中率 = hits / (hits + misses)

# 查看内存使用
redis-cli INFO memory

# 查看慢查询
redis-cli SLOWLOG GET 10

# 查看热点 key
redis-cli --hotkeys
```

### 6.7.3 告警规则

```yaml
# Prometheus 告警规则示例
groups:
  - name: redis_alerts
    rules:
      - alert: RedisHighMemoryUsage
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis 内存使用率超过 80%"
      
      - alert: RedisLowHitRate
        expr: rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) < 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis 命中率低于 90%"
      
      - alert: RedisHighEvictionRate
        expr: rate(redis_evicted_keys_total[5m]) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Redis 驱逐率过高"
```

## 6.8 总结与最佳实践

### 6.8.1 问题速查表

| 问题 | 现象 | 解决方案 |
|------|------|---------|
| **缓存穿透** | 查询不存在的数据 | 缓存空值 + 布隆过滤器 |
| **缓存击穿** | 热点 key 过期瞬间大量请求 | 互斥锁 + 预热 |
| **缓存雪崩** | 大量 key 同时过期 | 过期时间加随机值 + 多级缓存 |
| **数据不一致** | 缓存与数据库数据不同 | 延迟双删 + Canal 订阅 |

### 6.8.2 最佳实践清单

**缓存设计**：
- ✅ 选择合适的缓存读写策略（Cache Aside 最常用）
- ✅ 设置合理的 TTL（基础值 + 随机抖动）
- ✅ 使用多级缓存（L1 本地 + L2 Redis）
- ✅ 预热热点数据

**防护机制**：
- ✅ 参数校验（过滤非法请求）
- ✅ 布隆过滤器（防穿透）
- ✅ 互斥锁（防击穿）
- ✅ 限流降级（防雪崩）

**一致性保证**：
- ✅ 先更新数据库，再删除缓存
- ✅ 删除缓存带重试机制
- ✅ 高要求场景使用 Canal 订阅 binlog

**监控告警**：
- ✅ 监控命中率（> 95%）
- ✅ 监控内存使用率（< 80%）
- ✅ 监控驱逐率（接近 0）
- ✅ 监控响应时间（< 1ms）
