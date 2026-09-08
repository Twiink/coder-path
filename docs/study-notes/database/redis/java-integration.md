---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - Redis
  - 缓存
  - Spring
  - 分布式锁
---

# Redis在Java项目中的整合

> **核心定位**：Redis 是 Java 后端最常用的中间件，用于缓存、分布式锁、限流、排行榜等场景。本文聚焦 Spring Boot 项目的实战整合。

## 1. Spring Boot 整合 Redis

### 1.1 基础配置

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<!-- Redisson（分布式锁、分布式集合） -->
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.25.0</version>
</dependency>

<!-- 连接池（Lettuce 需要） -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

```yaml
# application.yml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password: your_password
      database: 0
      timeout: 3000ms  # 连接超时
      lettuce:
        pool:
          max-active: 16      # 最大连接数
          max-idle: 8         # 最大空闲连接
          min-idle: 2         # 最小空闲连接
          max-wait: 2000ms    # 获取连接超时
        shutdown-timeout: 100ms
```

### 1.2 RedisTemplate 配置

```java
@Configuration
public class RedisConfig {
    
    /**
     * ★ 自定义 RedisTemplate 序列化
     * 默认使用 JDK 序列化（二进制，不友好）
     * 改为 JSON 序列化（可读，跨语言）
     */
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        
        // Key 使用 String 序列化
        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        
        // Value 使用 JSON 序列化
        GenericJackson2JsonRedisSerializer jsonSerializer = 
            new GenericJackson2JsonRedisSerializer();
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);
        
        template.afterPropertiesSet();
        return template;
    }
    
    /**
     * ★ StringRedisTemplate（专门操作字符串）
     */
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }
}
```

**序列化方式对比**：

```
┌─────────────────────────────────────────────┐
│ RedisTemplate 序列化方式对比                  │
├─────────────────────────────────────────────┤
│ JDK 序列化（默认）：                          │
│   - 二进制，不可读                            │
│   - 跨语言不兼容                              │
│   - 占用空间大（包含类信息）                  │
│   - 缺点：不推荐生产使用                      │
│                                              │
│ String 序列化：                               │
│   - 纯字符串                                  │
│   - 可读性好                                  │
│   - 适合 Key 和简单字符串 Value               │
│                                              │
│ ★ JSON 序列化（推荐）：                       │
│   - 可读性好                                  │
│   - 跨语言兼容                                │
│   - 占用空间适中                              │
│   - ★ 生产推荐                               │
│                                              │
│ Protobuf 序列化：                             │
│   - 二进制，体积小                            │
│   - 性能高                                    │
│   - 需要定义 proto 文件                       │
│   - 适合高性能场景                            │
└─────────────────────────────────────────────┘
```

## 2. Redis 工具类封装

```java
@Component
public class RedisUtils {
    
    @Autowired
    private StringRedisTemplate stringRedisTemplate;
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // ============ String 类型 ============
    
    /**
     * 设置缓存（带过期时间）
     */
    public void set(String key, Object value, long timeout, TimeUnit unit) {
        redisTemplate.opsForValue().set(key, value, timeout, unit);
    }
    
    /**
     * 获取缓存
     */
    public <T> T get(String key, Class<T> clazz) {
        Object value = redisTemplate.opsForValue().get(key);
        if (value == null) return null;
        if (clazz.isInstance(value)) {
            return clazz.cast(value);
        }
        // JSON 反序列化
        return JSON.parseObject(JSON.toJSONString(value), clazz);
    }
    
    /**
     * 删除缓存
     */
    public Boolean delete(String key) {
        return redisTemplate.delete(key);
    }
    
    /**
     * 自增
     */
    public Long increment(String key, long delta) {
        return redisTemplate.opsForValue().increment(key, delta);
    }
    
    /**
     * 设置过期时间
     */
    public Boolean expire(String key, long timeout, TimeUnit unit) {
        return redisTemplate.expire(key, timeout, unit);
    }
    
    // ============ Hash 类型 ============
    
    /**
     * Hash 设置
     */
    public void hSet(String key, String field, Object value) {
        redisTemplate.opsForHash().put(key, field, value);
    }
    
    /**
     * Hash 获取
     */
    public Object hGet(String key, String field) {
        return redisTemplate.opsForHash().get(key, field);
    }
    
    /**
     * Hash 获取全部
     */
    public Map<Object, Object> hGetAll(String key) {
        return redisTemplate.opsForHash().entries(key);
    }
    
    /**
     * Hash 删除字段
     */
    public Long hDelete(String key, Object... fields) {
        return redisTemplate.opsForHash().delete(key, fields);
    }
    
    // ============ List 类型 ============
    
    /**
     * List 右推（尾部插入）
     */
    public Long lRightPush(String key, Object value) {
        return redisTemplate.opsForList().rightPush(key, value);
    }
    
    /**
     * List 左弹（头部弹出）
     */
    public Object lLeftPop(String key) {
        return redisTemplate.opsForList().leftPop(key);
    }
    
    /**
     * List 范围查询
     */
    public List<Object> lRange(String key, long start, long end) {
        return redisTemplate.opsForList().range(key, start, end);
    }
    
    // ============ Set 类型 ============
    
    /**
     * Set 添加
     */
    public Long sAdd(String key, Object... values) {
        return redisTemplate.opsForSet().add(key, values);
    }
    
    /**
     * Set 获取全部
     */
    public Set<Object> sMembers(String key) {
        return redisTemplate.opsForSet().members(key);
    }
    
    /**
     * Set 判断是否包含
     */
    public Boolean sIsMember(String key, Object value) {
        return redisTemplate.opsForSet().isMember(key, value);
    }
    
    // ============ ZSet 类型（有序集合） ============
    
    /**
     * ZSet 添加（带分数）
     */
    public Boolean zAdd(String key, Object value, double score) {
        return redisTemplate.opsForZSet().add(key, value, score);
    }
    
    /**
     * ZSet 范围查询（按分数升序）
     */
    public Set<Object> zRange(String key, long start, long end) {
        return redisTemplate.opsForZSet().range(key, start, end);
    }
    
    /**
     * ZSet 范围查询（按分数降序，常用于排行榜）
     */
    public Set<Object> zReverseRange(String key, long start, long end) {
        return redisTemplate.opsForZSet().reverseRange(key, start, end);
    }
    
    /**
     * ZSet 增加分数
     */
    public Double zIncrementScore(String key, Object value, double delta) {
        return redisTemplate.opsForZSet().incrementScore(key, value, delta);
    }
}
```

## 3. Spring Cache 注解缓存

### 3.1 启用缓存

```java
@EnableCaching  // ★ 开启 Spring Cache
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### 3.2 核心注解

```java
@Service
public class UserService {
    
    @Autowired
    private UserMapper userMapper;
    
    /**
     * ★ @Cacheable：查询缓存，命中则直接返回，不执行方法
     */
    @Cacheable(
        value = "user",           // 缓存名称（前缀）
        key = "#id",              // 缓存 Key（SpEL 表达式）
        unless = "#result == null",  // 结果为 null 不缓存
        condition = "#id > 0"     // 条件：id > 0 才缓存
    )
    public User getUserById(Long id) {
        log.info("查询数据库，id = {}", id);  // 缓存命中时不会打印
        return userMapper.selectById(id);
    }
    
    /**
     * ★ @CachePut：更新缓存（总是执行方法，更新缓存）
     */
    @CachePut(value = "user", key = "#user.id")
    public User updateUser(User user) {
        userMapper.updateById(user);
        return user;
    }
    
    /**
     * ★ @CacheEvict：删除缓存
     */
    @CacheEvict(value = "user", key = "#id")
    public void deleteUser(Long id) {
        userMapper.deleteById(id);
    }
    
    /**
     * ★ @CacheEvict 清除全部缓存
     */
    @CacheEvict(value = "user", allEntries = true)
    public void clearUserCache() {
        // 清除 user:* 全部缓存
    }
    
    /**
     * ★ @Caching：组合多个缓存操作
     */
    @Caching(
        put = @CachePut(value = "user", key = "#user.id"),
        evict = @CacheEvict(value = "userList", allEntries = true)
    )
    public User updateUserAndClearList(User user) {
        userMapper.updateById(user);
        return user;
    }
}
```

**缓存 Key 生成规则**：

```
┌─────────────────────────────────────────────┐
│ Spring Cache Key 生成规则（SpEL 表达式）      │
├─────────────────────────────────────────────┤
│ #参数名          → 使用方法参数               │
│ #p0, #p1         → 第0个、第1个参数           │
│ #root.methodName → 方法名                    │
│ #root.target     → 目标对象                   │
│ #result          → 方法返回值（仅 unless 可用）│
│                                              │
│ 示例：                                        │
│ key = "#id"                    → user::1     │
│ key = "#user.id"               → user::1     │
│ key = "#root.methodName"       → user::getUserById │
│ key = "'user:' + #id"          → user:user:1 │
│ key = "#id + ':' + #name"      → user::1:张三 │
└─────────────────────────────────────────────┘
```

### 3.3 缓存配置

```java
@Configuration
@EnableCaching
public class CacheConfig {
    
    /**
     * ★ 自定义 CacheManager（使用 Redis）
     */
    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        // 默认缓存配置
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))  // 默认过期时间 30 分钟
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair
                    .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair
                    .fromSerializer(new GenericJackson2JsonRedisSerializer()))
            .disableCachingNullValues();  // 不缓存 null 值
        
        // 为不同缓存名设置不同过期时间
        Map<String, RedisCacheConfiguration> configMap = new HashMap<>();
        configMap.put("user", defaultConfig.entryTtl(Duration.ofHours(2)));
        configMap.put("product", defaultConfig.entryTtl(Duration.ofDays(1)));
        configMap.put("config", defaultConfig.entryTtl(Duration.ofDays(7)));
        
        return RedisCacheManager.builder(factory)
            .cacheDefaults(defaultConfig)
            .withInitialCacheConfigurations(configMap)
            .transactionAware()  // 事务感知（事务提交后才写入缓存）
            .build();
    }
    
    /**
     * ★ 自定义 KeyGenerator（当不指定 key 时使用）
     */
    @Bean
    public KeyGenerator keyGenerator() {
        return (target, method, params) -> {
            StringBuilder sb = new StringBuilder();
            sb.append(target.getClass().getSimpleName()).append(":");
            sb.append(method.getName()).append(":");
            for (Object param : params) {
                sb.append(param.toString()).append(",");
            }
            return sb.toString();
        };
    }
}
```

## 4. 缓存三大问题实战

```
┌─────────────────────────────────────────────┐
│ 缓存三大问题                                 │
├─────────────────────────────────────────────┤
│ 1. 缓存穿透                                  │
│    - 查询不存在的数据，每次都打到数据库        │
│    - 解决：布隆过滤器 / 缓存空值               │
│                                              │
│ 2. 缓存击穿                                  │
│    - 热点 Key 过期瞬间，大量请求打到数据库     │
│    - 解决：互斥锁 / 永不过期                   │
│                                              │
│ 3. 缓存雪崩                                  │
│    - 大量 Key 同时过期，数据库压力剧增          │
│    - 解决：随机过期时间 / 多级缓存             │
└─────────────────────────────────────────────┘
```

### 4.1 缓存穿透解决方案

```java
@Service
public class ProductService {
    
    @Autowired
    private ProductMapper productMapper;
    
    @Autowired
    private RedisUtils redisUtils;
    
    /**
     * ★ 方案1：缓存空值（简单，但浪费内存）
     */
    public Product getProductWithNullCache(Long id) {
        // 1. 查缓存
        String key = "product:" + id;
        Product product = redisUtils.get(key, Product.class);
        
        if (product != null) {
            // 判断是否是空值标记
            if (product.getId() == null) {
                return null;  // 缓存的空值
            }
            return product;
        }
        
        // 2. 查数据库
        product = productMapper.selectById(id);
        
        if (product == null) {
            // ★ 缓存空值（防止穿透）
            Product empty = new Product();
            empty.setId(null);  // 标记为空
            redisUtils.set(key, empty, 5, TimeUnit.MINUTES);  // 空值过期时间短
        } else {
            redisUtils.set(key, product, 30, TimeUnit.MINUTES);
        }
        
        return product;
    }
    
    /**
     * ★ 方案2：布隆过滤器（推荐，节省内存）
     */
    @Autowired
    private RBloomFilter<Long> productBloomFilter;  // Redisson 布隆过滤器
    
    public Product getProductWithBloomFilter(Long id) {
        // 1. 布隆过滤器判断（可能误判，但不会漏判）
        if (!productBloomFilter.contains(id)) {
            return null;  // 一定不存在
        }
        
        // 2. 查缓存
        String key = "product:" + id;
        Product product = redisUtils.get(key, Product.class);
        if (product != null) {
            return product;
        }
        
        // 3. 查数据库
        product = productMapper.selectById(id);
        if (product != null) {
            redisUtils.set(key, product, 30, TimeUnit.MINUTES);
        }
        
        return product;
    }
}

// 布隆过滤器配置
@Configuration
public class BloomFilterConfig {
    
    @Bean
    public RBloomFilter<Long> productBloomFilter(RedissonClient redisson) {
        RBloomFilter<Long> bloomFilter = redisson.getBloomFilter("product:bloom");
        // 初始化：预计存储 1000 万个元素，误判率 1%
        bloomFilter.tryInit(10_000_000L, 0.01);
        return bloomFilter;
    }
    
    /**
     * 应用启动时加载布隆过滤器
     */
    @Bean
    public CommandLineRunner loadBloomFilter(
            RBloomFilter<Long> bloomFilter,
            ProductMapper productMapper) {
        return args -> {
            // 从数据库加载所有商品 ID 到布隆过滤器
            List<Long> allIds = productMapper.selectAllIds();
            for (Long id : allIds) {
                bloomFilter.add(id);
            }
            log.info("布隆过滤器加载完成，元素数量：{}", allIds.size());
        };
    }
}
```

### 4.2 缓存击穿解决方案

```java
@Service
public class HotProductService {
    
    @Autowired
    private ProductMapper productMapper;
    
    @Autowired
    private RedisUtils redisUtils;
    
    @Autowired
    private RedissonClient redisson;
    
    /**
     * ★ 方案1：互斥锁（Redisson 分布式锁）
     */
    public Product getHotProductWithLock(Long id) {
        String key = "product:" + id;
        
        // 1. 查缓存
        Product product = redisUtils.get(key, Product.class);
        if (product != null) {
            return product;
        }
        
        // 2. 缓存未命中，加分布式锁
        RLock lock = redisson.getLock("lock:product:" + id);
        try {
            // 尝试加锁（最多等待3秒，锁持有10秒自动释放）
            if (lock.tryLock(3, 10, TimeUnit.SECONDS)) {
                // ★ 双重检查（防止重复加载）
                product = redisUtils.get(key, Product.class);
                if (product != null) {
                    return product;
                }
                
                // 3. 查数据库
                product = productMapper.selectById(id);
                if (product != null) {
                    redisUtils.set(key, product, 30, TimeUnit.MINUTES);
                }
            } else {
                // 加锁失败，短暂休眠后重试
                Thread.sleep(50);
                return getHotProductWithLock(id);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("获取锁中断", e);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
        
        return product;
    }
    
    /**
     * ★ 方案2：逻辑过期（永不过期，后台异步更新）
     */
    public Product getHotProductWithLogicalExpire(Long id) {
        String key = "product:" + id;
        String expireKey = key + ":expire";
        
        // 1. 查缓存
        Product product = redisUtils.get(key, Product.class);
        if (product == null) {
            return null;
        }
        
        // 2. 检查是否逻辑过期
        String expireTime = redisUtils.get(expireKey, String.class);
        if (expireTime != null && Long.parseLong(expireTime) < System.currentTimeMillis()) {
            // 已过期，异步更新（不阻塞当前请求）
            asyncUpdateCache(id, key, expireKey);
        }
        
        // 3. 返回旧数据（保证高可用）
        return product;
    }
    
    @Async
    public void asyncUpdateCache(Long id, String key, String expireKey) {
        // 加分布式锁（防止多个线程同时更新）
        RLock lock = redisson.getLock("lock:update:" + id);
        try {
            if (lock.tryLock()) {
                // 双重检查
                String expireTime = redisUtils.get(expireKey, String.class);
                if (expireTime != null && Long.parseLong(expireTime) < System.currentTimeMillis()) {
                    // 查数据库
                    Product product = productMapper.selectById(id);
                    if (product != null) {
                        // 更新缓存
                        redisUtils.set(key, product);  // 不设过期时间
                        // 更新逻辑过期时间（30分钟后）
                        long newExpireTime = System.currentTimeMillis() + 30 * 60 * 1000;
                        redisUtils.set(expireKey, String.valueOf(newExpireTime), 30, TimeUnit.MINUTES);
                    }
                }
            }
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }
}
```

### 4.3 缓存雪崩解决方案

```java
@Service
public class AntiAvalancheService {
    
    @Autowired
    private RedisUtils redisUtils;
    
    /**
     * ★ 方案1：随机过期时间（避免同时过期）
     */
    public void setWithRandomExpire(String key, Object value) {
        // 基础过期时间 30 分钟
        long baseExpire = 30 * 60;
        // 随机波动 0~5 分钟
        long randomExpire = ThreadLocalRandom.current().nextLong(5 * 60);
        long totalExpire = baseExpire + randomExpire;
        
        redisUtils.set(key, value, totalExpire, TimeUnit.SECONDS);
    }
    
    /**
     * ★ 方案2：多级缓存（L1 本地缓存 + L2 Redis）
     */
    @Autowired
    private Cache<String, Object> caffeineCache;  // Caffeine 本地缓存
    
    public Object getWithMultiLevelCache(String key) {
        // L1：本地缓存（毫秒级）
        Object value = caffeineCache.getIfPresent(key);
        if (value != null) {
            return value;
        }
        
        // L2：Redis 缓存（毫秒级）
        value = redisUtils.get(key, Object.class);
        if (value != null) {
            caffeineCache.put(key, value);  // 回填 L1
            return value;
        }
        
        // L3：数据库（百毫秒级）
        value = queryFromDatabase(key);
        if (value != null) {
            redisUtils.set(key, value, 30, TimeUnit.MINUTES);
            caffeineCache.put(key, value);
        }
        
        return value;
    }
}

// Caffeine 配置
@Configuration
public class CaffeineConfig {
    
    @Bean
    public Cache<String, Object> caffeineCache() {
        return Caffeine.newBuilder()
            .maximumSize(1000)                    // 最大缓存数
            .expireAfterWrite(5, TimeUnit.MINUTES) // 写入后5分钟过期
            .recordStats()                        // 开启统计
            .build();
    }
}
```

## 5. 分布式锁实现

### 5.1 Redisson 分布式锁

```java
@Component
public class DistributedLockService {
    
    @Autowired
    private RedissonClient redisson;
    
    /**
     * ★ 基础分布式锁
     */
    public boolean tryLock(String key, long waitTime, long leaseTime, TimeUnit unit) {
        RLock lock = redisson.getLock(key);
        try {
            // waitTime：最多等待时间
            // leaseTime：锁持有时间（到期自动释放）
            return lock.tryLock(waitTime, leaseTime, unit);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
    
    public void unlock(String key) {
        RLock lock = redisson.getLock(key);
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }
    
    /**
     * ★ 模板方法：自动加锁解锁
     */
    public <T> T executeWithLock(String key, long waitTime, long leaseTime, 
                                 TimeUnit unit, Supplier<T> supplier) {
        RLock lock = redisson.getLock(key);
        try {
            if (lock.tryLock(waitTime, leaseTime, unit)) {
                return supplier.get();
            } else {
                throw new RuntimeException("获取分布式锁失败：" + key);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("获取锁中断", e);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }
}

// 使用示例
@Service
public class OrderService {
    
    @Autowired
    private DistributedLockService lockService;
    
    @Autowired
    private StockMapper stockMapper;
    
    public void deductStock(Long productId, int quantity) {
        String lockKey = "lock:stock:" + productId;
        
        lockService.executeWithLock(lockKey, 3, 10, TimeUnit.SECONDS, () -> {
            // 查询库存
            Stock stock = stockMapper.selectByProductId(productId);
            if (stock.getQuantity() < quantity) {
                throw new RuntimeException("库存不足");
            }
            
            // 扣减库存
            stock.setQuantity(stock.getQuantity() - quantity);
            stockMapper.updateById(stock);
            
            return null;
        });
    }
}
```

### 5.2 可重入锁 vs 不可重入锁

```java
@Component
public class ReentrantLockDemo {
    
    @Autowired
    private RedissonClient redisson;
    
    /**
     * ★ Redisson 默认是可重入锁（同一个线程可以多次加锁）
     */
    public void reentrantLock() {
        RLock lock = redisson.getLock("lock:reentrant");
        
        lock.lock();
        try {
            log.info("第一次加锁成功");
            
            // 可重入：同一个线程可以再次加锁
            lock.lock();
            try {
                log.info("第二次加锁成功（可重入）");
            } finally {
                lock.unlock();
            }
        } finally {
            lock.unlock();
        }
    }
    
    /**
     * ★ 不可重入锁（RedissonLock + tryLock）
     */
    public void nonReentrantLock() {
        RLock lock = redisson.getLock("lock:nonReentrant");
        
        if (lock.tryLock()) {
            try {
                log.info("加锁成功");
                
                // 不可重入：同一个线程再次加锁会失败
                if (lock.tryLock()) {
                    try {
                        log.info("第二次加锁成功（不会执行）");
                    } finally {
                        lock.unlock();
                    }
                } else {
                    log.info("第二次加锁失败（不可重入）");
                }
            } finally {
                lock.unlock();
            }
        }
    }
}
```

### 5.3 读写锁

```java
@Component
public class ReadWriteLockDemo {
    
    @Autowired
    private RedissonClient redisson;
    
    /**
     * ★ 读写锁：读读不互斥，读写互斥，写写互斥
     */
    public void readWriteLock() {
        RReadWriteLock rwLock = redisson.getReadWriteLock("lock:rw");
        
        // 读锁
        RLock readLock = rwLock.readLock();
        readLock.lock();
        try {
            log.info("获取读锁，执行读操作");
            // 多个线程可以同时持有读锁
        } finally {
            readLock.unlock();
        }
        
        // 写锁
        RLock writeLock = rwLock.writeLock();
        writeLock.lock();
        try {
            log.info("获取写锁，执行写操作");
            // 写锁是独占的
        } finally {
            writeLock.unlock();
        }
    }
}
```

## 6. 分布式限流

```java
@Component
public class RateLimiterService {
    
    @Autowired
    private RedissonClient redisson;
    
    /**
     * ★ 基于 Redisson 的限流器（令牌桶算法）
     */
    public boolean tryAcquire(String key, int rate, int rateInterval, RateIntervalUnit unit) {
        RRateLimiter rateLimiter = redisson.getRateLimiter(key);
        
        // 初始化限流器（只需要调用一次）
        rateLimiter.trySetRate(RateType.OVERALL, rate, rateInterval, unit);
        
        // 尝试获取一个令牌
        return rateLimiter.tryAcquire(1);
    }
}

// 使用示例：接口限流
@RestController
public class ApiController {
    
    @Autowired
    private RateLimiterService rateLimiter;
    
    @GetMapping("/api/order")
    public Result<?> createOrder(HttpServletRequest request) {
        String userId = getCurrentUserId(request);
        String key = "rate:order:" + userId;
        
        // 限制每个用户每分钟最多创建 10 个订单
        if (!rateLimiter.tryAcquire(key, 10, 1, RateIntervalUnit.MINUTES)) {
            return Result.error("操作过于频繁，请稍后再试");
        }
        
        // 业务逻辑
        return Result.success("订单创建成功");
    }
}
```

## 7. Redis 实战场景

### 7.1 排行榜（ZSet）

```java
@Service
public class LeaderboardService {
    
    @Autowired
    private StringRedisTemplate redisTemplate;
    
    private static final String LEADERBOARD_KEY = "leaderboard:score";
    
    /**
     * 更新分数（增加）
     */
    public void addScore(String userId, double score) {
        redisTemplate.opsForZSet().incrementScore(LEADERBOARD_KEY, userId, score);
    }
    
    /**
     * 获取排行榜 Top N
     */
    public List<LeaderboardItem> getTopN(int n) {
        Set<ZSetOperations.TypedTuple<String>> tuples = 
            redisTemplate.opsForZSet().reverseRangeWithScores(LEADERBOARD_KEY, 0, n - 1);
        
        List<LeaderboardItem> list = new ArrayList<>();
        int rank = 1;
        for (ZSetOperations.TypedTuple<String> tuple : tuples) {
            LeaderboardItem item = new LeaderboardItem();
            item.setRank(rank++);
            item.setUserId(tuple.getValue());
            item.setScore(tuple.getScore());
            list.add(item);
        }
        return list;
    }
    
    /**
     * 获取用户排名
     */
    public Long getUserRank(String userId) {
        Long rank = redisTemplate.opsForZSet().reverseRank(LEADERBOARD_KEY, userId);
        return rank != null ? rank + 1 : null;  // 排名从1开始
    }
}

@Data
public class LeaderboardItem {
    private Integer rank;
    private String userId;
    private Double score;
}
```

### 7.2 延迟队列（ZSet 实现）

```java
@Component
public class DelayQueueService {
    
    @Autowired
    private StringRedisTemplate redisTemplate;
    
    private static final String DELAY_QUEUE_KEY = "delay:queue";
    
    /**
     * 添加延迟任务
     */
    public void addDelayTask(String taskId, long delayMillis) {
        // score = 执行时间戳
        long executeTime = System.currentTimeMillis() + delayMillis;
        redisTemplate.opsForZSet().add(DELAY_QUEUE_KEY, taskId, executeTime);
    }
    
    /**
     * 轮询获取到期任务
     */
    public List<String> getExpiredTasks() {
        long now = System.currentTimeMillis();
        
        // 获取所有到期的任务（score <= now）
        Set<String> tasks = redisTemplate.opsForZSet().rangeByScore(
            DELAY_QUEUE_KEY, 0, now);
        
        if (tasks != null && !tasks.isEmpty()) {
            // 删除已处理的任务
            redisTemplate.opsForZSet().remove(DELAY_QUEUE_KEY, tasks.toArray());
            return new ArrayList<>(tasks);
        }
        
        return Collections.emptyList();
    }
}

// 定时任务消费延迟队列
@Component
@EnableScheduling
public class DelayTaskConsumer {
    
    @Autowired
    private DelayQueueService delayQueueService;
    
    @Scheduled(fixedDelay = 1000)  // 每秒轮询一次
    public void consumeDelayTasks() {
        List<String> tasks = delayQueueService.getExpiredTasks();
        for (String taskId : tasks) {
            // 处理任务
            processTask(taskId);
        }
    }
    
    private void processTask(String taskId) {
        log.info("处理延迟任务：{}", taskId);
        // 业务逻辑
    }
}
```

### 7.3 分布式 Session

```java
// 1. 添加依赖
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>

// 2. 开启 Redis Session
@Configuration
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800)  // 30分钟过期
public class SessionConfig {
}

// 3. 使用（与原生 HttpSession 完全一致）
@RestController
public class SessionController {
    
    @GetMapping("/login")
    public Result<?> login(HttpServletRequest request) {
        HttpSession session = request.getSession();
        session.setAttribute("userId", 123L);
        session.setAttribute("username", "张三");
        return Result.success("登录成功");
    }
    
    @GetMapping("/info")
    public Result<?> getUserInfo(HttpServletRequest request) {
        HttpSession session = request.getSession();
        Long userId = (Long) session.getAttribute("userId");
        String username = (String) session.getAttribute("username");
        return Result.success(Map.of("userId", userId, "username", username));
    }
}
```

## 8. 生产环境最佳实践

```
┌─────────────────────────────────────────────┐
│ Redis 生产环境最佳实践                        │
├─────────────────────────────────────────────┤
│ 1. 连接池配置                                │
│    - max-active: CPU*2（16~32）              │
│    - max-idle: max-active / 2                │
│    - min-idle: 2~4                           │
│    - timeout: 3000ms                         │
│                                              │
│ 2. 内存管理                                  │
│    - maxmemory: 物理内存的 70%               │
│    - maxmemory-policy: allkeys-lru（推荐）   │
│    - 监控内存使用率，设置告警                  │
│                                              │
│ 3. 持久化策略                                │
│    - AOF + RDB 混合持久化                     │
│    - AOF：每秒同步（everysec）               │
│    - RDB：定时快照（用于备份）                │
│                                              │
│ 4. 高可用                                    │
│    - ★ 哨兵模式（1主2从+3哨兵）              │
│    - 或集群模式（数据分片）                  │
│                                              │
│ 5. 安全                                      │
│    - 设置密码（requirepass）                 │
│    - 禁用危险命令（rename-command）          │
│    - 绑定内网 IP（bind 127.0.0.1）           │
│                                              │
│ 6. 监控                                      │
│    - 慢查询日志（slowlog-log-slower-than）   │
│    - 内存碎片率（mem_fragmentation_ratio）   │
│    - 连接数、QPS、命中率                     │
└─────────────────────────────────────────────┘
```

## 9. 常见问题

```
┌─────────────────────────────────────────────┐
│ Redis 常见问题                                │
├─────────────────────────────────────────────┤
│ 1. 缓存与数据库一致性                         │
│    - ★ 先更新数据库，再删除缓存              │
│    - 延迟双删（更新后延迟删除缓存）            │
│    - 订阅 binlog 异步删除缓存                 │
│                                              │
│ 2. 大 Key 问题                               │
│    - 避免单个 Key 存储过多数据                │
│    - Hash 代替 String（100个字段以下）        │
│    - 拆分大 Key（如拆分大 List）              │
│                                              │
│ 3. 热 Key 问题                               │
│    - 本地缓存（Caffeine）                     │
│    - Key 加随机后缀（分散到多个 Key）         │
│    - 读写分离（从节点分担读压力）             │
│                                              │
│ 4. 内存碎片                                  │
│    - activedefrag yes（开启自动碎片整理）     │
│    - 定期重启（释放碎片）                     │
│                                              │
│ 5. 连接泄漏                                  │
│    - 使用连接池                               │
│    - 设置 timeout（自动释放空闲连接）         │
│    - 监控 connected_clients                   │
└─────────────────────────────────────────────┘
```

## 10. 总结

```
┌─────────────────────────────────────────────┐
│ Redis 整合核心知识点                          │
├─────────────────────────────────────────────┤
│ 1. 基础整合                                  │
│    - RedisTemplate 序列化配置                │
│    - ★ JSON 序列化（推荐）                   │
│                                              │
│ 2. Spring Cache                              │
│    - @Cacheable / @CachePut / @CacheEvict    │
│    - Key 生成规则（SpEL 表达式）              │
│                                              │
│ 3. 缓存三大问题                              │
│    - 穿透：布隆过滤器 / 缓存空值              │
│    - 击穿：互斥锁 / 逻辑过期                 │
│    - 雪崩：随机过期 / 多级缓存               │
│                                              │
│ 4. 分布式锁                                  │
│    - Redisson（推荐）                        │
│    - 可重入锁 / 读写锁 / 红锁                │
│                                              │
│ 5. 实战场景                                  │
│    - 排行榜（ZSet）                          │
│    - 延迟队列（ZSet + 定时任务）              │
│    - 分布式 Session                          │
│                                              │
│ 6. 生产最佳实践                              │
│    - 连接池、内存管理、持久化、高可用          │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/数据库/Redis/Redis学习笔记]]：Redis 核心原理
- [[后端/SpringBoot/SpringBoot入门与项目搭建]]：Spring Boot 基础
- [[后端/微服务/分布式ID与链路追踪]]：分布式锁应用场景
