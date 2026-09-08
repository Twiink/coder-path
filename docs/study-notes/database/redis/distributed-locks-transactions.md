# 07 Redis 分布式锁与事务

Redis 不仅可以做缓存，还能实现分布式锁、事务等高级功能。本章深入讲解分布式锁的实现原理、常见坑点，以及 Redis 事务的正确用法。

## 7.1 分布式锁的基本概念

### 7.1.1 为什么需要分布式锁

**单机锁的局限**：

```text
单机应用：
  进程 A ──→ 共享资源
  进程 B ──→ 共享资源
  
  使用 JVM 内置锁（synchronized）或 ReentrantLock 即可保证互斥

分布式应用：
  服务器 1 (进程 A) ──→ 共享资源
  服务器 2 (进程 B) ──→ 共享资源
  服务器 3 (进程 C) ──→ 共享资源
  
  JVM 锁无法跨进程，需要分布式锁
```

**典型场景**：
- 防止重复提交（用户连续点击"下单"按钮）
- 秒杀库存扣减（防止超卖）
- 定时任务防重复执行（多节点部署时只让一个节点执行）
- 分布式计数器（原子自增）

### 7.1.2 分布式锁的核心要求

| 要求 | 说明 |
|------|------|
| **互斥性** | 任意时刻只有一个客户端持有锁 |
| **安全性** | 不会发生死锁（即使客户端崩溃，锁也能释放） |
| **可用性** | 锁服务本身要高可用（不能单点故障） |
| **性能** | 加锁/解锁操作要快 |

## 7.2 Redis 分布式锁实现

### 7.2.1 基础实现（单节点）

**加锁**：

```bash
# SET key value NX EX timeout
# NX：key 不存在时才设置（互斥性）
# EX：设置过期时间（防止死锁）

SET mylock "client_id_123" NX EX 30
# 返回 OK 表示加锁成功
# 返回 nil 表示加锁失败（已被其他客户端持有）
```

**解锁**：

```bash
# Lua 脚本保证原子性
EVAL "if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end" 1 mylock "client_id_123"
```

**为什么需要 Lua 脚本？**

```text
错误做法（非原子操作）：
  ① GET mylock → 返回 "client_id_123"
  ② 判断是否等于自己
  ③ DEL mylock
  
问题：
  · 步骤 1 和 3 之间，锁可能已过期并被其他客户端获取
  · 此时 DEL 会误删别人的锁
  
正确做法（原子操作）：
  · 使用 Lua 脚本，保证 GET + DEL 是一个原子操作
  · 或者使用 Redis 6.2+ 的 GETDEL 命令
```

**Python 实现**：

```python
import redis
import time
import uuid

class RedisLock:
    def __init__(self, redis_client, lock_key, timeout=30):
        self.redis = redis_client
        self.lock_key = lock_key
        self.timeout = timeout
        self.identifier = str(uuid.uuid4())  # 唯一标识，防止误删别人的锁
    
    def acquire(self, acquire_timeout=10):
        """获取锁，最多等待 acquire_timeout 秒"""
        end_time = time.time() + acquire_timeout
        
        while time.time() < end_time:
            # 尝试加锁
            if self.redis.set(self.lock_key, self.identifier, nx=True, ex=self.timeout):
                return True
            time.sleep(0.001)  # 1ms 后重试
        
        return False  # 超时未获取到锁
    
    def release(self):
        """释放锁"""
        lua_script = """
        if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
        else
            return 0
        end
        """
        return self.redis.eval(lua_script, 1, self.lock_key, self.identifier)

# 使用示例
r = redis.Redis(host='localhost', port=6379)
lock = RedisLock(r, "order_lock:1001", timeout=30)

if lock.acquire(acquire_timeout=5):
    try:
        # 执行业务逻辑（如扣减库存）
        process_order(1001)
    finally:
        lock.release()
else:
    print("获取锁失败，请稍后重试")
```

### 7.2.2 常见问题与解决方案

**问题一：锁过期但业务未完成**

```text
场景：
  · 锁设置 30 秒过期
  · 业务逻辑执行了 40 秒
  · 锁在 30 秒时自动释放
  · 其他客户端获取到锁，导致并发问题

解决方案：锁续期（Watchdog 机制）
  · 后台线程定期检查锁是否即将过期
  · 如果快过期且业务未完成，自动续期
```

```python
import threading

class RedisLockWithRenewal:
    def __init__(self, redis_client, lock_key, timeout=30):
        self.redis = redis_client
        self.lock_key = lock_key
        self.timeout = timeout
        self.identifier = str(uuid.uuid4())
        self.renewal_thread = None
        self.stop_renewal = False
    
    def acquire(self, acquire_timeout=10):
        end_time = time.time() + acquire_timeout
        
        while time.time() < end_time:
            if self.redis.set(self.lock_key, self.identifier, nx=True, ex=self.timeout):
                # 启动续期线程
                self._start_renewal()
                return True
            time.sleep(0.001)
        
        return False
    
    def _start_renewal(self):
        """启动后台续期线程"""
        def renew():
            while not self.stop_renewal:
                time.sleep(self.timeout / 3)  # 在过期前 1/3 时间续期
                
                # Lua 脚本：检查锁是否还是自己的，如果是则续期
                lua_script = """
                if redis.call('GET', KEYS[1]) == ARGV[1] then
                    return redis.call('EXPIRE', KEYS[1], ARGV[2])
                else
                    return 0
                end
                """
                self.redis.eval(lua_script, 1, self.lock_key, self.identifier, self.timeout)
        
        self.renewal_thread = threading.Thread(target=renew, daemon=True)
        self.renewal_thread.start()
    
    def release(self):
        """释放锁"""
        self.stop_renewal = True  # 停止续期
        
        lua_script = """
        if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
        else
            return 0
        end
        """
        return self.redis.eval(lua_script, 1, self.lock_key, self.identifier)
```

**问题二：Redis 主从切换导致锁丢失**

```text
场景：
  · 客户端 A 在 Master 上加锁成功
  · Master 宕机，Slave 提升为新 Master
  · 锁数据未同步到 Slave（异步复制）
  · 客户端 B 在新 Master 上加锁成功
  · 两个客户端同时持有锁，互斥性被破坏

解决方案：Redlock 算法（见 7.3）
```

**问题三：可重入锁**

```text
场景：
  · 同一个线程需要多次获取同一把锁
  · 如：方法 A 加锁后调用方法 B，方法 B 也需要加锁

解决方案：记录锁的持有次数
```

```python
class ReentrantRedisLock:
    def __init__(self, redis_client, lock_key, timeout=30):
        self.redis = redis_client
        self.lock_key = lock_key
        self.timeout = timeout
        self.identifier = str(uuid.uuid4())
        self.lock_count = 0  # 重入计数
    
    def acquire(self, acquire_timeout=10):
        # 检查是否已经持有锁
        current_holder = self.redis.get(self.lock_key)
        if current_holder == self.identifier.encode():
            self.lock_count += 1
            return True
        
        # 尝试获取新锁
        end_time = time.time() + acquire_timeout
        while time.time() < end_time:
            if self.redis.set(self.lock_key, self.identifier, nx=True, ex=self.timeout):
                self.lock_count = 1
                return True
            time.sleep(0.001)
        
        return False
    
    def release(self):
        if self.lock_count <= 0:
            return
        
        self.lock_count -= 1
        
        # 最后一次释放才真正删除锁
        if self.lock_count == 0:
            lua_script = """
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('DEL', KEYS[1])
            else
                return 0
            end
            """
            self.redis.eval(lua_script, 1, self.lock_key, self.identifier)
```

## 7.3 Redlock 算法

### 7.3.1 Redlock 原理

**核心思想**：使用多个独立的 Redis 实例（通常 5 个），客户端必须在**大多数实例**上加锁成功才算获取锁成功。

```text
Redlock 架构（5 个独立 Redis 节点）：
  
  Client ──→ Redis-1 ──→ 加锁
        ──→ Redis-2 ──→ 加锁
        ──→ Redis-3 ──→ 加锁
        ──→ Redis-4 ──→ 加锁
        ──→ Redis-5 ──→ 加锁
  
  成功条件：至少 3 个节点加锁成功（N/2 + 1）
```

### 7.3.2 Redlock 加锁流程

```text
步骤：
  ① 获取当前时间戳 T1
  
  ② 依次向 N 个 Redis 实例请求加锁（使用相同的 key 和 identifier）
     · 每个实例设置较短的超时时间（如 5~50ms）
     · 避免某个实例故障导致长时间阻塞
  
  ③ 计算加锁耗时：T2 = 当前时间 - T1
  
  ④ 统计成功加锁的实例数
     · 如果成功数 >= N/2 + 1 且 T2 < 锁的过期时间
       → 加锁成功，实际有效时间 = 原过期时间 - T2
     · 否则
       → 加锁失败，向所有实例发送解锁请求（即使某些实例加锁失败也要解锁）
  
  ⑤ 如果加锁失败，等待随机时间后重试
```

### 7.3.3 Redlock Python 实现

```python
import time
import random
from redis import Redis

class Redlock:
    def __init__(self, servers, lock_key, timeout=30, retry_times=3, retry_delay=0.2):
        """
        servers: Redis 实例列表，如 [{'host': '127.0.0.1', 'port': 6379}, ...]
        lock_key: 锁的名称
        timeout: 锁的过期时间（秒）
        retry_times: 最大重试次数
        retry_delay: 重试间隔（秒）
        """
        self.servers = [Redis(**server) for server in servers]
        self.lock_key = lock_key
        self.timeout = timeout
        self.retry_times = retry_times
        self.retry_delay = retry_delay
        self.identifier = str(uuid.uuid4())
        self.quorum = len(servers) // 2 + 1  # 多数派
    
    def acquire(self):
        """获取分布式锁"""
        for retry in range(self.retry_times):
            # 1. 记录开始时间
            start_time = time.time()
            
            # 2. 依次向所有实例加锁
            success_count = 0
            for server in self.servers:
                try:
                    # 每个实例设置较短的超时
                    if server.set(self.lock_key, self.identifier, nx=True, ex=self.timeout):
                        success_count += 1
                except Exception:
                    pass  # 某个实例故障，继续尝试其他实例
            
            # 3. 计算耗时
            elapsed_time = time.time() - start_time
            
            # 4. 判断是否成功
            if success_count >= self.quorum and elapsed_time < self.timeout:
                # 成功：实际有效时间 = 原超时 - 耗时
                valid_time = self.timeout - elapsed_time
                return True, valid_time
            else:
                # 失败：向所有实例发送解锁请求
                self._release_all()
                
                # 等待随机时间后重试（避免多个客户端同时重试）
                time.sleep(self.retry_delay + random.uniform(0, self.retry_delay))
        
        return False, 0
    
    def _release_all(self):
        """向所有实例发送解锁请求"""
        lua_script = """
        if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
        else
            return 0
        end
        """
        for server in self.servers:
            try:
                server.eval(lua_script, 1, self.lock_key, self.identifier)
            except Exception:
                pass
    
    def release(self):
        """释放分布式锁"""
        self._release_all()

# 使用示例
servers = [
    {'host': 'redis1.example.com', 'port': 6379},
    {'host': 'redis2.example.com', 'port': 6379},
    {'host': 'redis3.example.com', 'port': 6379},
    {'host': 'redis4.example.com', 'port': 6379},
    {'host': 'redis5.example.com', 'port': 6379},
]

lock = Redlock(servers, "my_distributed_lock", timeout=30)
success, valid_time = lock.acquire()

if success:
    try:
        # 执行业务逻辑
        process_critical_section()
    finally:
        lock.release()
else:
    print("获取分布式锁失败")
```

### 7.3.4 Redlock 的争议

**Martin Kleppmann 的质疑**（2016 年）：

```text
问题 1：时钟跳跃
  · Redlock 依赖多个 Redis 实例的时钟一致
  · 如果某个实例发生时钟跳跃（NTP 同步、闰秒等），可能导致锁提前过期
  · 多个客户端可能同时持有锁

问题 2：进程暂停（GC Pause）
  · 客户端 A 获取锁后，进程被 GC 暂停了几秒
  · 锁已过期，客户端 B 获取到锁
  · 客户端 A 恢复后继续执行，两个客户端同时操作共享资源

问题 3：网络延迟
  · 客户端 A 发送解锁请求时网络延迟
  · 锁已过期，客户端 B 获取到锁
  · 客户端 A 的解锁请求到达，删除了客户端 B 的锁
```

**Antirez 的反驳**：

```text
回应 1：时钟跳跃
  · Redis 使用 gettimeofday()，不会发生跳跃
  · 可以配置 NTP 限制最大调整幅度

回应 2：进程暂停
  · 这是所有分布式锁的通用问题，不是 Redlock 特有的
  · 可以使用 fencing token（见 7.4）解决

回应 3：网络延迟
  · Redlock 的锁有过期时间，即使网络延迟，锁也会自动释放
```

**结论**：
- Redlock 在**大多数场景**下是可靠的
- 如果对一致性要求极高（如金融交易），建议使用 Zookeeper/etcd
- 如果追求性能，Redlock 是不错的选择

## 7.4 Fencing Token（防护令牌）

### 7.4.1 问题场景

```text
场景：客户端 A 持有锁，但进程暂停（GC）导致锁过期

  时间线：
    T1: 客户端 A 获取锁（valid_until = T1 + 30s）
    T2: 客户端 A 进程暂停（GC Pause）
    T3: 锁过期（T1 + 30s）
    T4: 客户端 B 获取锁（valid_until = T4 + 30s）
    T5: 客户端 A 恢复，继续执行业务逻辑（认为自己还持有锁）
    T6: 客户端 A 和 B 同时操作共享资源 → 数据不一致
```

### 7.4.2 Fencing Token 解决方案

**核心思想**：每次获取锁时分配一个**单调递增的令牌（token）**，资源服务端只接受更大的 token。

```text
改进后的流程：
  T1: 客户端 A 获取锁，token = 33
  T2: 客户端 A 进程暂停
  T3: 锁过期
  T4: 客户端 B 获取锁，token = 34
  T5: 客户端 A 恢复，发送写请求（token = 33）
  T6: 资源服务端检查：33 < 34，拒绝请求
  T7: 客户端 B 发送写请求（token = 34），成功
```

### 7.4.3 实现示例

**Redis 端（生成 token）**：

```python
class FencingRedisLock:
    def __init__(self, redis_client, lock_key, timeout=30):
        self.redis = redis_client
        self.lock_key = lock_key
        self.timeout = timeout
        self.identifier = str(uuid.uuid4())
    
    def acquire(self):
        """获取锁并返回 fencing token"""
        if not self.redis.set(self.lock_key, self.identifier, nx=True, ex=self.timeout):
            return None, None
        
        # 使用 Redis 的 INCR 生成单调递增的 token
        # 注意：这个 token 是全局的，不是每个锁独立的
        token = self.redis.incr("global_fencing_token")
        return self.identifier, token
    
    def release(self):
        """释放锁"""
        lua_script = """
        if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
        else
            return 0
        end
        """
        self.redis.eval(lua_script, 1, self.lock_key, self.identifier)
```

**资源服务端（验证 token）**：

```python
class ResourceServer:
    def __init__(self):
        self.max_token_seen = 0  # 记录见过的最大 token
    
    def write(self, data, client_id, token):
        """写入数据，验证 fencing token"""
        if token <= self.max_token_seen:
            raise Exception(f"拒绝请求：token {token} <= 已见过的最大 token {self.max_token_seen}")
        
        # 更新最大 token
        self.max_token_seen = token
        
        # 执行写入
        self._do_write(data, client_id)
        return True
```

**客户端使用**：

```python
# 客户端 A
lock = FencingRedisLock(redis_client, "my_lock")
identifier, token_a = lock.acquire()
# token_a = 33

# 客户端 A 进程暂停...

# 客户端 B（在 A 暂停期间获取了锁）
lock_b = FencingRedisLock(redis_client, "my_lock")
identifier_b, token_b = lock_b.acquire()
# token_b = 34

resource_server = ResourceServer()

# 客户端 B 写入成功
resource_server.write("data_b", "client_b", token_b)  # OK

# 客户端 A 恢复后尝试写入
resource_server.write("data_a", "client_a", token_a)
# Exception: 拒绝请求：token 33 <= 已见过的最大 token 34
```

### 7.4.4 Fencing Token 的局限

| 局限 | 说明 |
|------|------|
| 需要资源服务端支持 | 不是所有资源都支持 token 验证 |
| 全局 token 可能冲突 | 多个锁共享同一个 token 计数器 |
| 实现复杂 | 需要修改资源服务端代码 |

**替代方案**：使用 Zookeeper/etcd 的**版本号机制**（天然支持 fencing）

## 7.5 Redis 事务（MULTI/EXEC）

### 7.5.1 基本用法

```bash
# 开启事务
MULTI
# 返回 OK

# 命令入队（不会立即执行）
SET key1 "value1"
# 返回 QUEUED
SET key2 "value2"
# 返回 QUEUED
INCR counter
# 返回 QUEUED

# 执行事务
EXEC
# 返回：
# 1) OK
# 2) OK
# 3) (integer) 1

# 取消事务
DISCARD
```

### 7.5.2 事务的特性

**Redis 事务 vs 数据库事务**：

| 特性 | 数据库事务（ACID） | Redis 事务 |
|------|-------------------|-----------|
| **原子性** | ✅ 全部成功或全部回滚 | ❌ 不支持回滚，部分失败继续执行 |
| **一致性** | ✅ 数据始终一致 | ⚠️ 可能不一致 |
| **隔离性** | ✅ 多隔离级别 | ✅ 串行执行（单线程） |
| **持久性** | ✅ 持久化 | ⚠️ 取决于 AOF 配置 |

**关键差异**：

```text
数据库事务：
  BEGIN
  UPDATE account SET balance = balance - 100 WHERE id = 1;  （成功）
  UPDATE account SET balance = balance + 100 WHERE id = 2;  （失败，余额不足）
  COMMIT
  → 全部回滚，余额不变

Redis 事务：
  MULTI
  DECRBY account:1:balance 100  （成功）
  DECRBY account:2:balance 100  （失败，余额不足）
  EXEC
  → 第一条执行成功，第二条失败，不会回滚！
  → account:1 扣款成功，account:2 未扣款，数据不一致
```

### 7.5.3 事务的错误处理

**入队阶段的错误**：

```bash
MULTI
SET key1 "value1"
INVALID_COMMAND  # 命令不存在
SET key2 "value2"
EXEC
# 返回错误：EXECABORT Transaction discarded because of previous errors.
# 整个事务被取消
```

**执行阶段的错误**：

```bash
MULTI
SET key1 "value1"
INCR key1  # key1 是字符串，无法自增
SET key2 "value2"
EXEC
# 返回：
# 1) OK
# 2) (error) ERR value is not an integer or out of range
# 3) OK
# 第一条和第三条执行成功，第二条失败，不会回滚！
```

### 7.5.4 WATCH 乐观锁

**WATCH 命令**：监视一个或多个 key，如果在 EXEC 之前被其他客户端修改，事务自动失败。

```bash
# 客户端 A
WATCH balance:1
# 监视 balance:1
GET balance:1
# 返回 "100"
MULTI
SET balance:1 "50"
# QUEUED

# 此时客户端 B 修改了 balance:1
# SET balance:1 "200"

# 客户端 A 执行事务
EXEC
# 返回 nil（事务失败，因为 balance:1 被修改过）
```

**Python 示例**：

```python
def transfer_with_watch(redis_client, from_account, to_account, amount):
    """使用 WATCH 实现乐观锁转账"""
    with redis_client.pipeline() as pipe:
        while True:
            try:
                # 1. 监视账户余额
                pipe.watch(f"balance:{from_account}", f"balance:{to_account}")
                
                # 2. 读取余额
                from_balance = int(pipe.get(f"balance:{from_account}"))
                to_balance = int(pipe.get(f"balance:{to_account}"))
                
                # 3. 检查余额
                if from_balance < amount:
                    raise Exception("余额不足")
                
                # 4. 开启事务
                pipe.multi()
                
                # 5. 命令入队
                pipe.set(f"balance:{from_account}", from_balance - amount)
                pipe.set(f"balance:{to_account}", to_balance + amount)
                
                # 6. 执行事务
                pipe.execute()
                
                # 成功，退出循环
                return True
                
            except redis.WatchError:
                # 事务失败（账户被其他客户端修改），重试
                print("账户被修改，重试...")
                continue
```

### 7.5.5 事务的最佳实践

**不推荐使用 Redis 事务的场景**：

```text
❌ 需要原子性（全部成功或全部回滚）
   → 使用 Lua 脚本

❌ 需要复杂的条件判断
   → 使用 Lua 脚本

❌ 需要跨多个 key 的原子操作
   → 使用 Lua 脚本
```

**推荐使用 Redis 事务的场景**：

```text
✅ 简单的批量操作（不需要原子性）
✅ 配合 WATCH 实现乐观锁
✅ 需要保证命令的串行执行
```

## 7.6 Lua 脚本（推荐替代事务）

### 7.6.1 为什么 Lua 脚本更好

| 对比项 | Redis 事务 | Lua 脚本 |
|--------|-----------|---------|
| **原子性** | ❌ 不支持回滚 | ✅ 完全原子 |
| **性能** | 多次网络往返 | 一次网络往返 |
| **灵活性** | 只能顺序执行 | 支持条件判断、循环 |
| **错误处理** | 部分失败继续 | 可以捕获错误 |

### 7.6.2 Lua 脚本基础

```bash
# EVAL script numkeys key [key ...] arg [arg ...]
EVAL "return redis.call('SET', KEYS[1], ARGV[1])" 1 mykey "myvalue"

# redis.call()：调用 Redis 命令，失败时抛出错误
# redis.pcall()：调用 Redis 命令，失败时返回错误对象（不抛出）
```

**示例：原子自增（带上限）**

```bash
EVAL "
local current = tonumber(redis.call('GET', KEYS[1]))
if current == nil then
    current = 0
end
if current >= tonumber(ARGV[1]) then
    return -1  -- 达到上限
end
return redis.call('INCR', KEYS[1])
" 1 counter 100
```

**示例：分布式锁的安全释放**

```bash
EVAL "
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
else
    return 0
end
" 1 mylock "client_id_123"
```

### 7.6.3 Python 中使用 Lua 脚本

```python
import redis

r = redis.Redis(host='localhost', port=6379)

# 定义 Lua 脚本
lua_script = """
local current = tonumber(redis.call('GET', KEYS[1]))
if current == nil then
    current = 0
end
if current >= tonumber(ARGV[1]) then
    return -1
end
return redis.call('INCR', KEYS[1])
"""

# 注册脚本
incr_with_limit = r.register_script(lua_script)

# 调用脚本
result = incr_with_limit(keys=['counter'], args=[100])
if result == -1:
    print("达到上限")
else:
    print(f"当前值：{result}")
```

### 7.6.4 Lua 脚本的注意事项

| 注意项 | 说明 |
|--------|------|
| **脚本要短小** | 长时间运行的脚本会阻塞其他客户端 |
| **避免死循环** | Lua 脚本没有超时机制，死循环会导致 Redis 卡死 |
| **不要修改全局变量** | Lua 脚本是沙箱环境，全局变量不会持久化 |
| **使用 KEYS 和 ARGV** | 不要硬编码 key 名，使用 KEYS[1]、ARGV[1] 等 |

## 7.7 总结与对比

### 7.7.1 分布式锁方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **单节点 Redis 锁** | 简单快速 | 单点故障 | 开发/测试环境 |
| **Redis 主从锁** | 高可用 | 主从切换可能丢锁 | 一般生产环境 |
| **Redlock** | 高可用，较安全 | 实现复杂，有争议 | 高要求生产环境 |
| **Zookeeper/etcd** | 强一致，可靠 | 性能较低 | 金融级场景 |

### 7.7.2 事务方案对比

| 方案 | 原子性 | 性能 | 灵活性 | 推荐度 |
|------|--------|------|--------|--------|
| **MULTI/EXEC** | ❌ 弱 | 中 | 低 | ⭐⭐ |
| **WATCH + MULTI/EXEC** | ⚠️ 乐观锁 | 中 | 中 | ⭐⭐⭐ |
| **Lua 脚本** | ✅ 强 | 高 | 高 | ⭐⭐⭐⭐⭐ |

### 7.7.3 最佳实践

**分布式锁**：
- ✅ 使用 `SET NX EX` + Lua 脚本释放锁
- ✅ 锁的 value 使用唯一标识（如 UUID）
- ✅ 设置合理的过期时间（业务时间 + 缓冲）
- ✅ 考虑锁续期（Watchdog 机制）
- ✅ 高可用场景使用 Redlock 或 Zookeeper

**事务**：
- ✅ 优先使用 Lua 脚本（原子性 + 性能）
- ✅ 简单场景可以使用 MULTI/EXEC
- ✅ 需要乐观锁时使用 WATCH
- ❌ 不要依赖 Redis 事务的回滚（不支持）
