---
title: "缓存机制与插件开发"
aliases:
  - "MyBatis 一级缓存"
  - "MyBatis 二级缓存"
  - "MyBatis 插件"
tags:
  - "后端"
  - "java"
  - "mybatis"
  - "面试"
category: "后端"
folder: "MyBatis"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/MyBatis/MyBatis入门与核心配置]]"
  - "[[后端/MyBatis/动态SQL与结果映射]]"
  - "[[后端/中间件/Redis在Java项目中的整合]]"
  - "[[后端/Spring/事务管理与失效场景]]"
created: 2026-09-07
updated: 2026-09-07
---

# MyBatis 缓存机制与插件开发

## 1. 一级缓存（Local Cache）★★★★★

### 1.1 基本概念

**一级缓存是 `SqlSession` 级别的缓存**，默认开启且无法关闭（只能设为 STATEMENT 级别变相禁用）。

| 特性 | 说明 |
| --- | --- |
| **作用域** | ★ **一个 SqlSession（一次会话）** |
| **存储位置** | `BaseExecutor` 的 `localCache` 字段（`PerpetualCache`，底层是 HashMap） |
| **默认状态** | ★ **默认开启**，无法完全关闭（可设 `localCacheScope=STATEMENT` 变相禁用） |
| **生命周期** | SqlSession 关闭或清空时失效 |
| **线程安全** | SqlSession 本身线程不安全，所以一级缓存也无需考虑并发 |
| **key 组成** | ★ `statementId + offset + limit + SQL + 参数值 + environmentId`（CacheKey） |

```java
// ─── 一级缓存的命中演示 ───
try (SqlSession session = factory.openSession()) {
    UserMapper mapper = session.getMapper(UserMapper.class);

    User u1 = mapper.selectById(1L);        // ★ 查数据库
    User u2 = mapper.selectById(1L);        // ★ 命中一级缓存，不查库！
    System.out.println(u1 == u2);            // true（★ 同一个对象引用）

    // 插入/更新/删除后，缓存被清空
    mapper.insert(new User());
    User u3 = mapper.selectById(1L);        // ★ 重新查库
    System.out.println(u1 == u3);            // false

    session.clearCache();                    // ★ 手动清空一级缓存
    User u4 = mapper.selectById(1L);        // 重新查库
}
```

### 1.2 一级缓存的失效场景（★ 必考）

| # | 失效场景 | 说明 |
| --- | --- | --- |
| 1 | **不同的 SqlSession** | ★ 每个 SqlSession 有独立的一级缓存（最常见） |
| 2 | **执行了 insert/update/delete** | ★ 任何写操作都会 `clearLocalCache()`（不管改的是不是同一张表） |
| 3 | **调用 `sqlSession.clearCache()`** | 手动清空 |
| 4 | **`localCacheScope=STATEMENT`** | 每条语句执行完就清空（相当于禁用） |
| 5 | **`flushCache=true`** | 在 `<select>` 上显式配置 |
| 6 | **SqlSession 关闭或提交** | `close()` / `commit()` 都会清缓存 |
| 7 | **查询条件不同** | CacheKey 不同（SQL、参数、分页任一不同） |
| 8 | **不同的 namespace** | CacheKey 含 statementId（含 namespace） |

```java
// ─── 场景 1：不同 SqlSession（★ Spring 整合后最常见）───
// 在 Spring 中，SqlSession 的生命周期与【事务】绑定：
// - 有事务：整个事务方法内共用一个 SqlSession → 一级缓存生效
// - 无事务：★ 每次 Mapper 调用都是【新的 SqlSession】→ 一级缓存【几乎不生效】！

@Service
public class UserService {

    // ❌ 没有事务：两次查询是两个 SqlSession，一级缓存不生效
    public void noTx() {
        User u1 = userMapper.selectById(1L);      // SqlSession 1 → 查库
        User u2 = userMapper.selectById(1L);      // SqlSession 2 → ★ 又查库！
        System.out.println(u1 == u2);              // false
    }

    // ✅ 有事务：同一个 SqlSession，一级缓存生效
    @Transactional(readOnly = true)
    public void withTx() {
        User u1 = userMapper.selectById(1L);      // 查库
        User u2 = userMapper.selectById(1L);      // ★ 命中缓存
        System.out.println(u1 == u2);              // true
    }
}
```

```java
// ─── 场景 2：写操作清空缓存（★ 即使是不同的表）───
@Transactional
public void test() {
    User u1 = userMapper.selectById(1L);          // 查库
    orderMapper.insert(order);                     // ★ 插入订单（不同的表！）
    User u2 = userMapper.selectById(1L);           // ★ 仍然重新查库（缓存被全清）
}
// 原因：BaseExecutor.update() 中无条件调用 clearLocalCache()
//      不区分表，只要有写操作就清空整个一级缓存
```

### 1.3 一级缓存的原理

```java
// ─── BaseExecutor（一级缓存的实现）───
public abstract class BaseExecutor implements Executor {

    /** ★ 一级缓存（PerpetualCache 内部就是 HashMap） */
    protected PerpetualCache localCache;

    @Override
    public <E> List<E> query(MappedStatement ms, Object parameter, RowBounds rowBounds,
                             ResultHandler resultHandler, CacheKey key, BoundSql boundSql) {
        // ① ★ 先查一级缓存
        List<E> list = (List<E>) localCache.getObject(key);
        if (list != null) {
            // 命中缓存 → 处理存储过程和嵌套结果映射
            handleLocallyCachedOutputParameters(ms, key, parameter, boundSql);
        } else {
            // ② 未命中 → 查数据库
            list = queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql);
        }
        return list;
    }

    private <E> List<E> queryFromDatabase(...) {
        localCache.putObject(key, EXECUTION_IN_PROGRESS);      // ★ 占位（防递归查询死循环）
        try {
            list = doQuery(ms, parameter, rowBounds, resultHandler, boundSql);   // ★ 子类实现，查库
        } finally {
            localCache.removeObject(key);                       // 移除占位
        }
        localCache.putObject(key, list);                        // ★ 放入缓存
        return list;
    }

    /** ★ 写操作时清空一级缓存 */
    @Override
    public int update(MappedStatement ms, Object parameter) throws SQLException {
        clearLocalCache();                                      // ★★ 无条件清空！
        return doUpdate(ms, parameter);
    }

    /** CacheKey 的构成（★ 决定缓存命中的关键） */
    public CacheKey createCacheKey(MappedStatement ms, Object parameterObject,
                                   RowBounds rowBounds, BoundSql boundSql) {
        CacheKey cacheKey = new CacheKey();
        cacheKey.update(ms.getId());                            // ① statement id（含 namespace）
        cacheKey.update(rowBounds.getOffset());                  // ② 分页 offset
        cacheKey.update(rowBounds.getLimit());                   // ③ 分页 limit
        cacheKey.update(boundSql.getSql());                      // ④ ★ SQL 文本
        // ⑤ ★ 所有参数值
        for (ParameterMapping pm : boundSql.getParameterMappings()) {
            cacheKey.update(value);
        }
        cacheKey.update(configuration.getEnvironment().getId()); // ⑥ 环境 id
        return cacheKey;
    }
}

// ─── CacheKey 的 hashCode/equals（多因子哈希）───
public class CacheKey implements Cloneable, Serializable {
    private static final int DEFAULT_MULTIPLIER = 17;
    private static final int DEFAULT_HASHCODE = 17;
    private final int multiplier;                    // 乘数
    private int hashcode;                             // ★ 组合哈希
    private long checksum;                            // ★ 校验和
    private int count;
    private List<Object> updateList;                  // ★ 所有组成因子

    public void update(Object object) {               // 加入一个因子
        int baseHashCode = object == null ? 1 : object.hashCode();
        count++;
        checksum += baseHashCode;
        baseHashCode *= count;
        hashcode = multiplier * hashcode + baseHashCode;   // ★ 滚动哈希
        updateList.add(object);
    }

    @Override
    public boolean equals(Object object) {
        // 先比 hashcode 和 checksum（快速排除），再逐个比 updateList
    }
}
```

**一级缓存的问题（★ 为什么 Spring 整合后建议禁用）：**

| 问题 | 说明 |
| --- | --- |
| **脏读风险** | 同一个 SqlSession 内，如果其他连接修改了数据，缓存仍是旧值 |
| **对象引用共享** | 缓存返回的是**同一个对象引用**，业务代码修改了它，下次拿到的是被改过的（★ 隐蔽 Bug） |
| **长事务内存膨胀** | 大事务中查询大量数据，全部缓存在内存 |
| **分布式无效** | 每个 JVM 的每个 SqlSession 独立，多实例间无法共享 |
| **写操作全清** | 改一张表清空所有缓存，命中率低 |

```java
// ─── 脏对象引用的坑（★ 隐蔽 Bug）───
@Transactional
public void bugDemo() {
    User u1 = userMapper.selectById(1L);
    u1.setUserName("被业务代码改了");          // ★ 修改了缓存中的对象！

    User u2 = userMapper.selectById(1L);       // 命中缓存，返回【同一个对象】
    System.out.println(u2.getUserName());       // "被业务代码改了" ← ★ 数据错乱！
    // 而数据库中的值其实没变
}

// ─── 禁用一级缓存的方式 ───
```

```yaml
# 方式 1：全局设为 STATEMENT 级别（每条语句后清空，★ 相当于禁用）
mybatis:
  configuration:
    local-cache-scope: statement
```

```xml
<!-- 方式 2：单个 select 上禁用 -->
<select id="selectById" resultType="User" flushCache="true" useCache="false">
    SELECT * FROM t_user WHERE id = #{id}
</select>

<!-- 方式 3：MyBatis-Plus 的全局配置 -->
mybatis-plus:
  configuration:
    local-cache-scope: statement
```

> 【实践建议】**生产环境建议把一级缓存设为 `STATEMENT` 级别（变相禁用）**，理由：
> 1. 避免脏对象引用导致的隐蔽 Bug。
> 2. Spring 事务内的一级缓存可能造成脏读（其他连接修改了数据）。
> 3. 缓存收益有限（同事务内重复查询同一数据的场景不多）。
> 4. 真正需要缓存应该用 Redis（二级缓存也有问题，见下节）。

## 2. 二级缓存（Namespace Cache）★★★★★

### 2.1 基本概念

**二级缓存是 `namespace`（Mapper）级别的缓存，跨 SqlSession 共享，默认关闭。**

| 特性 | 说明 |
| --- | --- |
| **作用域** | ★ **一个 namespace（一个 Mapper）**，多个 SqlSession 共享 |
| **存储位置** | `CachingExecutor` 中的 `TransactionalCacheManager` |
| **默认状态** | ★ **默认关闭**（需 `cacheEnabled=true` + Mapper 上配 `<cache/>`） |
| **生效时机** | ★ **SqlSession commit 或 close 后**才写入缓存（事务隔离） |
| **序列化** | ★ 默认要求实体**实现 Serializable**（因为要序列化存储） |
| **key** | 与一级缓存相同的 CacheKey |

```
查询流程（二级缓存 → 一级缓存 → 数据库）：

  请求
   ↓
CachingExecutor（★ 二级缓存层，namespace 级别）
   ↓ 未命中
BaseExecutor（★ 一级缓存层，SqlSession 级别）
   ↓ 未命中
SimpleExecutor → 数据库
```

### 2.2 开启二级缓存

```yaml
# ─── 步骤 1：全局开关（mybatis-config.xml 或 yml）───
mybatis:
  configuration:
    cache-enabled: true              # ★ 默认就是 true，但 Mapper 上没配 <cache/> 仍不生效
```

```xml
<!-- ─── 步骤 2：在 Mapper XML 中声明 <cache/>（★ 必须！）─── -->
<mapper namespace="com.example.mapper.UserMapper">

    <!-- ★ 最简单的写法 -->
    <cache/>

    <!-- ★ 完整配置 -->
    <cache
        eviction="LRU"                 <!-- 回收策略：LRU(默认)/FIFO/WEAK/SOFT -->
        flushInterval="60000"          <!-- ★ 刷新间隔（ms），默认 0 = 不自动刷新 -->
        size="1024"                    <!-- ★ 最大缓存对象数，默认 1024 -->
        readOnly="false"               <!-- ★★ false = 序列化（安全）；true = 返回同一引用（危险但快） -->
        blocking="false"               <!-- ★ 是否阻塞（防缓存击穿，默认 false） -->
        type="org.mybatis.caches.ehcache.EhcacheCache"/>   <!-- 自定义缓存实现 -->
</mapper>

<!-- ─── 步骤 2（替代）：注解方式 ─── -->
```

```java
@CacheNamespace(
    eviction = LruCache.class,           // 回收策略
    flushInterval = 60000,                // 刷新间隔
    size = 1024,                          // 最大条目
    readWrite = true,                     // ★ 对应 readOnly=false
    blocking = false,                     // 是否阻塞
    implementation = PerpetualCache.class // 缓存实现
)
public interface UserMapper { }

// ★ 多表关联时，需要「引用」其他 namespace 的缓存（避免脏数据）
@CacheNamespaceRef(UserMapper.class)
public interface UserExtMapper { }
```

```xml
<!-- XML 中引用其他 namespace 的缓存 -->
<mapper namespace="com.example.mapper.OrderMapper">
    <cache-ref namespace="com.example.mapper.UserMapper"/>
    <!-- ★ OrderMapper 与 UserMapper 共用同一个缓存区
         用于：两个 Mapper 查询有交集（JOIN）时，避免各自缓存导致脏数据 -->
</mapper>
```

```java
// ─── 步骤 3：实体必须实现 Serializable（readOnly=false 时）───
@Data
public class User implements Serializable {          // ★ 必须！
    private static final long serialVersionUID = 1L;
    private Long id;
    private String userName;
}
// 否则报错：Cache 'xxx' is not serializable
```

### 2.3 二级缓存的失效与问题 ★★★★★

```xml
<!-- ─── 控制单个语句的缓存行为 ─── -->
<select id="selectById" resultType="User" useCache="true">      <!-- ★ 是否使用二级缓存（默认 true） -->
<select id="selectRealtime" resultType="User" useCache="false" flushCache="true">  <!-- 禁用 + 清缓存 -->
<insert id="insert" flushCache="true">       <!-- ★ 写操作默认 flushCache=true -->
<update id="update" flushCache="true">
<delete id="delete" flushCache="true">
```

**★ 二级缓存的致命问题（这就是为什么生产不推荐用）：**

| # | 问题 | 说明 |
| --- | --- | --- |
| 1 | ★★ **多表 JOIN 的脏数据** | 缓存按 namespace 隔离，A 表的更新不会清空 B 表 namespace 的缓存，JOIN 查询结果可能是脏的 |
| 2 | ★ **多实例间不一致** | 缓存是 JVM 内的，多个应用实例各自缓存，更新后其他实例仍是旧数据 |
| 3 | ★ **readOnly=true 的对象污染** | 返回同一对象引用，业务代码修改会污染缓存 |
| 4 | **序列化开销** | readOnly=false 时每次读写都要序列化/反序列化，可能比查库还慢 |
| 5 | **粒度太粗** | 一个 namespace 内任何写操作都清空整个缓存 |
| 6 | **无过期策略** | `flushInterval` 是「定期全清」，不是「单个 key 过期」 |
| 7 | **事务未提交不缓存** | 长事务中查询无法被其他会话复用 |

```java
// ─── 问题 1 详解：多表关联的脏数据（★ 最严重）───
// UserMapper.xml
<select id="selectUserWithDept" resultMap="UserWithDeptMap">
    SELECT u.*, d.dept_name FROM t_user u LEFT JOIN t_dept d ON u.dept_id = d.id
    WHERE u.id = #{id}
</select>
// 这个查询的结果缓存在 UserMapper 的 namespace 下

// 现在 DeptMapper 修改了部门名：
deptMapper.updateName(deptId, "新部门名");
// ★ 这只会清空 DeptMapper 的缓存，UserMapper 的缓存【不受影响】！
// → 再查 selectUserWithDept 仍返回【旧的部门名】→ 脏数据！

// 解决方案：
// ① 用 <cache-ref> 让关联的 Mapper 共用一个缓存区（粒度更粗，性能下降）
// ② ★ 不用二级缓存，改用 Redis（可控性强）
// ③ 手动在 DeptMapper 的写操作中清空 UserMapper 的缓存（复杂易漏）
```

```java
// ─── 问题 3 详解：readOnly=true 的对象污染 ───
// <cache readOnly="true"/>
User u1 = userMapper.selectById(1L);      // 第一次查库，放入缓存
User u2 = userMapper.selectById(1L);      // 命中缓存，★ 返回同一个对象引用
System.out.println(u1 == u2);              // true

u1.setUserName("被改了");                  // ★ 修改了缓存中的对象！
User u3 = userMapper.selectById(1L);
System.out.println(u3.getUserName());       // "被改了" ← ★ 缓存被污染

// readOnly=false（默认）：每次返回反序列化的新对象，安全但有性能开销
```

### 2.4 自定义二级缓存实现（整合 Redis/Ehcache）

```java
// ─── 实现 MyBatis 的 Cache 接口，对接 Redis ───
public class MybatisRedisCache implements Cache {

    private final String id;                                   // ★ namespace
    private static RedisTemplate<String, Object> redisTemplate;  // ★ 静态注入（MyBatis 创建时无法注入）

    public MybatisRedisCache(String id) {
        if (id == null) throw new IllegalArgumentException("Cache instances require an ID");
        this.id = id;
    }

    /** ★ 通过 Spring 的静态持有者注入 RedisTemplate */
    @Autowired
    public void setRedisTemplate(RedisTemplate<String, Object> template) {
        MybatisRedisCache.redisTemplate = template;
    }
    // 或用 ApplicationContextAware 的方式获取

    @Override public String getId() { return id; }

    @Override
    public void putObject(Object key, Object value) {
        if (value != null) {
            redisTemplate.opsForValue().set(key.toString(), value, Duration.ofMinutes(30));   // ★ TTL
        }
    }

    @Override
    public Object getObject(Object key) {
        return redisTemplate.opsForValue().get(key.toString());
    }

    @Override
    public Object removeObject(Object key) {
        Object value = getObject(key);
        redisTemplate.delete(key.toString());
        return value;
    }

    @Override
    public void clear() {
        // ★ 清空该 namespace 的所有缓存（用 SCAN 而非 KEYS，避免阻塞 Redis）
        Set<String> keys = redisTemplate.keys(id + "*");
        if (!CollectionUtils.isEmpty(keys)) redisTemplate.delete(keys);
    }

    @Override
    public int getSize() {
        Set<String> keys = redisTemplate.keys(id + "*");
        return keys == null ? 0 : keys.size();
    }

    @Override public ReadWriteLock getReadWriteLock() { return null; }      // Redis 自己保证线程安全
}
```

```xml
<!-- 在 Mapper 中使用自定义缓存 -->
<mapper namespace="com.example.mapper.UserMapper">
    <cache type="com.example.mybatis.cache.MybatisRedisCache"
           eviction="LRU"
           flushInterval="0"
           size="1024"
           readOnly="false"/>
</mapper>
```

```java
// ─── 使用 Ehcache 作为二级缓存（官方支持）───
// pom.xml
<dependency>
    <groupId>org.mybatis.caches</groupId>
    <artifactId>mybatis-ehcache</artifactId>
    <version>1.2.3</version>
</dependency>
// ehcache.xml 中配置缓存区，然后：
```
```xml
<cache type="org.mybatis.caches.ehcache.EhcacheCache"/>
```

### 2.5 一级 vs 二级缓存对比 ★★★★★

| 对比项 | **一级缓存** | **二级缓存** |
| --- | --- | --- |
| 作用域 | **SqlSession** | **namespace（Mapper）** |
| 默认 | ★ **开启**（无法完全关闭） | ★ **关闭** |
| 跨会话共享 | ❌ | ✅ |
| 跨 JVM 共享 | ❌ | ❌（除非自定义 Redis 实现） |
| 存储位置 | `BaseExecutor.localCache`（HashMap） | `CachingExecutor`（TransactionalCache） |
| 写入时机 | 查询后立即写入 | ★ **SqlSession commit/close 后** |
| 清空时机 | 任何写操作、clearCache、session 关闭 | namespace 内任何写操作、flushInterval |
| 序列化要求 | 无 | ★ readOnly=false 时需 Serializable |
| 多表关联问题 | 无（会话内一致） | ★ **有脏数据风险** |
| 生产推荐 | 建议设 `STATEMENT` 禁用 | ★ **不推荐**（用 Redis 替代） |

**为什么生产环境不推荐二级缓存？（★ 面试标准答案）**

1. **多表关联脏数据**：缓存按 namespace 隔离，跨表的更新不会互相通知。
2. **多实例不一致**：JVM 内缓存，多实例部署时数据不同步。
3. **粒度太粗**：一个写操作清空整个 namespace 的缓存，命中率低。
4. **无精细过期**：只有全量刷新间隔，没有单 key TTL。
5. **序列化开销**：可能比直接查库还慢。
6. **可控性差**：难以监控命中率、难以手动清理特定 key。

**✅ 正确方案：Spring Cache + Redis**

```java
// 用 @Cacheable 精细控制（★ 生产标准做法）
@Service
@CacheConfig(cacheNames = "user")
public class UserService {

    @Cacheable(key = "#id", unless = "#result == null")          // ★ 精确到 key
    public UserVO getById(Long id) { return userMapper.selectById(id); }

    @CacheEvict(key = "#id")                                      // ★ 精确失效
    @Transactional(rollbackFor = Exception.class)
    public void update(Long id, UserDTO dto) { userMapper.updateById(...); }

    @CacheEvict(allEntries = true)                                // 清空整个 cacheName
    public void clearAll() { }

    @Cacheable(key = "'dept:' + #deptId + ':users'", condition = "#deptId != null")
    public List<UserVO> listByDept(Long deptId) { }
}

// Redis 缓存配置（带 TTL、序列化、多级缓存）
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(30))                        // ★ 默认 TTL
                .disableCachingNullValues()                               // 不缓存 null（或改为缓存空值防穿透）
                .computePrefixWith(name -> "mall:cache:" + name + ":")    // ★ key 前缀
                .serializeKeysWith(SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(SerializationPair.fromSerializer(
                        new GenericJackson2JsonRedisSerializer()));        // ★ JSON 序列化（可读、跨语言）

        // 不同 cacheName 不同 TTL
        Map<String, RedisCacheConfiguration> configs = new HashMap<>();
        configs.put("user", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        configs.put("dict", defaultConfig.entryTtl(Duration.ofHours(24)));      // 字典缓存久一点
        configs.put("product", defaultConfig.entryTtl(Duration.ofMinutes(10)));

        return RedisCacheManager.builder(factory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(configs)
                .transactionAware()                                       // ★ 与事务同步（提交后才写缓存）
                .build();
    }
}
```

> 完整的 Redis 缓存设计（穿透/击穿/雪崩、双写一致性、布隆过滤器）见 [[后端/中间件/Redis在Java项目中的整合]]。

## 3. 插件（拦截器）机制 ★★★★★

### 3.1 四大可拦截对象

**MyBatis 只允许拦截以下四个核心对象的方法（这是插件机制的边界）：**

| 对象 | 职责 | 可拦截的方法 | 典型用途 |
| --- | --- | --- | --- |
| **`Executor`** | ★ SQL 执行调度（一级缓存、事务） | `update`、`query`、`flushStatements`、`commit`、`rollback`、`getTransaction`、`close`、`isClosed` | ★ **分页、性能监控、SQL 改写、多租户** |
| **`StatementHandler`** | ★ 处理 JDBC Statement | `prepare`、`parameterize`、`batch`、`update`、`query`、`queryCursor` | ★ **SQL 改写（分页、数据权限）、慢 SQL 统计** |
| **`ParameterHandler`** | ★ 设置参数 | `getParameterObject`、`setParameters` | 参数加密、公共参数填充 |
| **`ResultSetHandler`** | ★ 处理结果集 | `handleResultSets`、`handleOutputParameters`、`handleCursorResultSets` | 结果解密、脱敏、字段填充 |

```java
// ─── 插件的定义方式 ───
@Intercepts({                                                   // ★ 声明拦截目标
    @Signature(
        type = Executor.class,                                   // 拦截哪个对象
        method = "query",                                        // 拦截哪个方法
        args = {MappedStatement.class, Object.class,              // ★ 方法参数类型（必须精确匹配）
                RowBounds.class, ResultHandler.class}
    ),
    @Signature(
        type = Executor.class,
        method = "update",
        args = {MappedStatement.class, Object.class}
    )
})
public class MyPlugin implements Interceptor {

    /** ★ 核心：拦截逻辑 */
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        // ① 前置处理
        Object[] args = invocation.getArgs();
        MappedStatement ms = (MappedStatement) args[0];
        Object parameter = args[1];

        long start = System.nanoTime();

        try {
            // ② ★ 执行原方法（不调用则原逻辑不执行！）
            Object result = invocation.proceed();

            // ③ 后置处理
            long cost = (System.nanoTime() - start) / 1_000_000;
            log.info("SQL 执行耗时: {}ms, statement={}", cost, ms.getId());
            return result;

        } catch (Throwable e) {
            log.error("SQL 执行异常: {}", ms.getId(), e);
            throw e;                                              // ★ 必须重新抛出
        }
    }

    /** ★ 生成代理对象（一般直接用 Plugin.wrap） */
    @Override
    public Object plugin(Object target) {
        // 只对声明的目标类型生成代理，其他直接返回（减少代理层级）
        if (target instanceof Executor) {
            return Plugin.wrap(target, this);
        }
        return target;
    }

    /** 接收配置参数（<plugin> 的 <property>） */
    @Override
    public void setProperties(Properties properties) {
        String slowSqlMillis = properties.getProperty("slowSqlMillis", "1000");
    }
}
```

### 3.2 插件的实现原理（★ 动态代理 + 责任链）

```java
// ─── Plugin.wrap：判断是否需要代理 ───
public class Plugin implements InvocationHandler {

    private final Object target;                                       // 被代理对象
    private final Interceptor interceptor;                              // 拦截器
    private final Map<Class<?>, Set<Method>> signatureMap;              // ★ 拦截规则

    /** ★ 核心方法：根据 @Intercepts 判断是否为目标对象生成代理 */
    public static Object wrap(Object target, Interceptor interceptor) {
        // ① 解析拦截器的 @Intercepts 注解 → Map<接口类型, Set<方法>>
        Map<Class<?>, Set<Method>> signatureMap = getSignatureMap(interceptor);
        // ② 判断 target 是否是需要拦截的类型
        Class<?> type = target.getClass();
        Class<?>[] interfaces = getAllInterfaces(type, signatureMap);
        // ③ ★ 有匹配的接口才生成 JDK 动态代理，否则直接返回原对象
        if (interfaces.length > 0) {
            return Proxy.newProxyInstance(type.getClassLoader(), interfaces,
                    new Plugin(target, interceptor, signatureMap));
        }
        return target;                                                  // ★ 不代理
    }

    /** ★ 拦截逻辑（JDK 动态代理的 InvocationHandler） */
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        try {
            // 从 signatureMap 中查找该方法是否被声明拦截
            Set<Method> methods = signatureMap.get(method.getDeclaringClass());
            if (methods != null && methods.contains(method)) {
                // ★ 命中 → 调用拦截器
                return interceptor.intercept(new Invocation(target, method, args));
            }
            // 未命中 → 直接调用原方法
            return method.invoke(target, args);
        } catch (Exception e) {
            throw ExceptionUtil.unwrapThrowable(e);
        }
    }
}

// ─── 多个插件的执行顺序（★ 责任链，后注册的先执行）───
// 注册顺序：plugin1 → plugin2 → plugin3
// 包装过程：
//   executor = plugin1.plugin(executor)     → proxy1(target=executor)
//   executor = plugin2.plugin(executor)     → proxy2(target=proxy1)
//   executor = plugin3.plugin(executor)     → proxy3(target=proxy2)
// 执行顺序：
//   ★ plugin3.intercept → plugin2.intercept → plugin1.intercept → 真实 executor
// 结论：【后注册的插件先执行】（洋葱模型，像栈一样）
```

```
插件的洋葱模型：

调用 query()
   ↓
Plugin3.intercept()      ← ★ 最后注册的最先执行
   ↓ invocation.proceed()
Plugin2.intercept()
   ↓ invocation.proceed()
Plugin1.intercept()      ← ★ 最先注册的最后执行
   ↓ invocation.proceed()
真实的 Executor.query()
   ↓
返回结果（逆序返回：Plugin1 → Plugin2 → Plugin3）
```

### 3.3 实战插件 1：SQL 执行耗时监控

```java
/**
 * SQL 性能监控插件：记录慢 SQL 并告警
 */
@Slf4j
@Intercepts({
    @Signature(type = Executor.class, method = "update",
               args = {MappedStatement.class, Object.class}),
    @Signature(type = Executor.class, method = "query",
               args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class})
})
public class SqlCostInterceptor implements Interceptor {

    /** 慢 SQL 阈值（ms） */
    private long slowSqlMillis = 1000;
    /** 是否打印完整 SQL */
    private boolean printSql = false;

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        MappedStatement ms = (MappedStatement) invocation.getArgs()[0];
        Object parameter = invocation.getArgs()[1];

        // ★ 获取真实 SQL（含参数替换，便于复制执行）
        BoundSql boundSql = ms.getBoundSql(parameter);
        String sql = getRealSql(boundSql, ms.getConfiguration());

        long start = System.currentTimeMillis();
        try {
            return invocation.proceed();
        } finally {
            long cost = System.currentTimeMillis() - start;
            if (cost > slowSqlMillis) {
                // ★ 慢 SQL 告警
                log.warn("★慢SQL★ 耗时={}ms, statement={}, sql={}", cost, ms.getId(), sql);
                // 上报监控系统
                Metrics.timer("mybatis.slow.sql", "statement", ms.getId())
                       .record(cost, TimeUnit.MILLISECONDS);
                // alertService.sendSlowSql(ms.getId(), cost, sql);
            } else if (printSql) {
                log.info("SQL 耗时={}ms, sql={}", cost, sql);
            }
        }
    }

    /** ★ 把 #{} 占位符替换为真实参数值（★ 调试神器，生成的 SQL 可直接执行） */
    private String getRealSql(BoundSql boundSql, Configuration configuration) {
        String sql = boundSql.getSql().replaceAll("[\\s]+", " ");       // 压缩空白
        Object parameterObject = boundSql.getParameterObject();
        List<ParameterMapping> mappings = boundSql.getParameterMappings();
        if (mappings.isEmpty()) return sql;

        TypeHandlerRegistry registry = configuration.getTypeHandlerRegistry();
        for (ParameterMapping pm : mappings) {
            if (pm.getMode() == ParameterMode.OUT) continue;
            Object value;
            String propertyName = pm.getProperty();
            if (boundSql.hasAdditionalParameter(propertyName)) {
                value = boundSql.getAdditionalParameter(propertyName);      // foreach 的动态参数
            } else if (parameterObject == null) {
                value = null;
            } else if (registry.hasTypeHandler(parameterObject.getClass())) {
                value = parameterObject;                                     // 单参数
            } else {
                value = configuration.newMetaObject(parameterObject).getValue(propertyName);
            }
            // ★ 按类型格式化
            TypeHandler<?> handler = pm.getTypeHandler();
            String valueStr = (value == null) ? "NULL"
                    : (value instanceof String) ? "'" + value + "'"
                    : (value instanceof Date) ? "'" + new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format((Date) value) + "'"
                    : value.toString();
            sql = sql.replaceFirst("\\?", Matcher.quoteReplacement(valueStr));   // ★ 替换第一个 ?
        }
        return sql;
    }

    @Override
    public Object plugin(Object target) {
        return target instanceof Executor ? Plugin.wrap(target, this) : target;
    }

    @Override
    public void setProperties(Properties props) {
        this.slowSqlMillis = Long.parseLong(props.getProperty("slowSqlMillis", "1000"));
        this.printSql = Boolean.parseBoolean(props.getProperty("printSql", "false"));
    }
}
```

### 3.4 实战插件 2：数据权限自动拼接（StatementHandler）

```java
/**
 * 数据权限插件：自动给 SQL 追加部门过滤条件
 * 拦截 StatementHandler.prepare（★ SQL 即将提交给数据库前的最后时机）
 */
@Slf4j
@Intercepts({
    @Signature(type = StatementHandler.class, method = "prepare",
               args = {Connection.class, Integer.class})
})
public class DataPermissionInterceptor implements Interceptor {

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        StatementHandler handler = (StatementHandler) invocation.getTarget();
        // ★ 通过 MetaObject 优雅地读取/修改内部属性（MyBatis 的反射工具）
        MetaObject metaObject = SystemMetaObject.forObject(handler);

        // 分离代理对象（可能被其他插件代理了多层）
        while (metaObject.hasGetter("h")) {
            Object obj = metaObject.getValue("h");
            metaObject = SystemMetaObject.forObject(obj);
        }
        while (metaObject.hasGetter("target")) {
            Object obj = metaObject.getValue("target");
            metaObject = SystemMetaObject.forObject(obj);
        }

        MappedStatement ms = (MappedStatement) metaObject.getValue("delegate.mappedStatement");

        // ★ 只处理查询，且只处理标注了 @DataScope 的方法
        if (ms.getSqlCommandType() != SqlCommandType.SELECT) {
            return invocation.proceed();
        }
        Method method = getMapperMethod(ms);
        DataScope dataScope = method == null ? null : method.getAnnotation(DataScope.class);
        if (dataScope == null) {
            return invocation.proceed();
        }

        // ★ 获取当前用户的数据权限范围
        LoginUser user = UserContext.get();
        if (user == null || user.isAdmin()) {
            return invocation.proceed();                      // 管理员不限制
        }

        // ★ 改写 SQL
        BoundSql boundSql = handler.getBoundSql();
        String originalSql = boundSql.getSql();
        String permissionSql = buildPermissionSql(dataScope, user);
        String newSql = addConditionToSql(originalSql, permissionSql);

        // ★★ 用反射把新 SQL 写回 BoundSql（BoundSql 的 sql 字段是 final 的）
        metaObject.setValue("delegate.boundSql.sql", newSql);
        log.debug("数据权限改写 SQL: \n原: {}\n新: {}", originalSql, newSql);

        return invocation.proceed();
    }

    private String buildPermissionSql(DataScope anno, LoginUser user) {
        String deptAlias = anno.deptAlias();
        String userAlias = anno.userAlias();
        return switch (anno.type()) {
            case ALL -> null;                                                   // 不限制
            case DEPT -> String.format("%s.dept_id = %d", deptAlias, user.getDeptId());
            case DEPT_AND_CHILD -> String.format(
                    "%s.dept_id IN (SELECT dept_id FROM sys_dept WHERE dept_id = %d "
                  + "OR FIND_IN_SET(%d, ancestors))", deptAlias, user.getDeptId(), user.getDeptId());
            case SELF -> String.format("%s.user_id = %d", userAlias, user.getUserId());
            case CUSTOM -> user.getDataScopeSql();                               // 自定义 SQL（角色配置）
        };
    }

    /** ★ 把条件加到 SQL 中（用子查询包装，避免破坏原 SQL 结构） */
    private String addConditionToSql(String originalSql, String condition) {
        if (condition == null || condition.isBlank()) return originalSql;
        // ★ 最安全的做法：用子查询包装（不需要解析原 SQL 的 WHERE/ORDER BY 结构）
        return "SELECT * FROM (" + originalSql + ") _data_scope_tmp WHERE " + condition;
        // ⚠️ 更好的做法是用 JSqlParser 解析 SQL AST 后精确插入条件（MyBatis-Plus 就是这么做的）
    }
}
```

### 3.5 实战插件 3：字段自动填充（ParameterHandler）

```java
/**
 * 公共字段自动填充插件：创建人、创建时间、更新人、更新时间、租户 ID
 */
@Intercepts({
    @Signature(type = ParameterHandler.class, method = "setParameters",
               args = {PreparedStatement.class})
})
public class AutoFillInterceptor implements Interceptor {

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        ParameterHandler handler = (ParameterHandler) invocation.getTarget();
        MetaObject metaObject = SystemMetaObject.forObject(handler);

        // 拿到参数对象
        Object parameterObject = handler.getParameterObject();
        if (parameterObject == null) return invocation.proceed();

        // ★ 处理批量参数（foreach 的 list）
        if (parameterObject instanceof Map<?, ?> map) {
            Object list = map.get("list");
            if (list instanceof Collection<?> col) {
                col.forEach(this::fill);
            } else if (map.get("collection") instanceof Collection<?> col2) {
                col2.forEach(this::fill);
            } else {
                fill(parameterObject);
            }
        } else if (parameterObject instanceof Collection<?> col) {
            col.forEach(this::fill);
        } else {
            fill(parameterObject);
        }

        return invocation.proceed();
    }

    /** ★ 根据注解填充字段 */
    private void fill(Object entity) {
        if (entity == null || isSimpleType(entity.getClass())) return;
        LoginUser user = UserContext.get();
        LocalDateTime now = LocalDateTime.now();

        for (Field field : ReflectionUtils.getAllFields(entity.getClass())) {
            field.setAccessible(true);
            try {
                if (field.isAnnotationPresent(TableField.class)) {
                    TableField tf = field.getAnnotation(TableField.class);
                    if (tf.fill() == FieldFill.INSERT || tf.fill() == FieldFill.INSERT_UPDATE) {
                        if (field.get(entity) == null) {
                            setFieldValue(field, entity, "createTime", now);
                            setFieldValue(field, entity, "createBy", user != null ? user.getUsername() : "system");
                        }
                    }
                    if (tf.fill() == FieldFill.UPDATE || tf.fill() == FieldFill.INSERT_UPDATE) {
                        setFieldValue(field, entity, "updateTime", now);
                        setFieldValue(field, entity, "updateBy", user != null ? user.getUsername() : "system");
                    }
                }
                // ★ 租户 ID 自动填充
                if ("tenantId".equals(field.getName()) && field.get(entity) == null) {
                    field.set(entity, TenantContext.getTenantId());
                }
            } catch (Exception e) {
                log.debug("字段填充跳过 {}: {}", field.getName(), e.getMessage());
            }
        }
    }
}
```

### 3.6 注册插件

```yaml
# ─── Spring Boot 方式（★ 最简单，声明为 Bean 即可）───
# 只要实现 Interceptor 并注册为 Spring Bean，mybatis-spring-boot-starter 会自动加入
```

```java
@Configuration
public class MyBatisPluginConfig {

    @Bean
    public SqlCostInterceptor sqlCostInterceptor() {
        SqlCostInterceptor interceptor = new SqlCostInterceptor();
        Properties props = new Properties();
        props.setProperty("slowSqlMillis", "500");
        props.setProperty("printSql", "false");
        interceptor.setProperties(props);
        return interceptor;
    }

    @Bean
    public DataPermissionInterceptor dataPermissionInterceptor() {
        return new DataPermissionInterceptor();
    }

    /** ★ 通过 ConfigurationCustomizer 控制插件顺序 */
    @Bean
    public ConfigurationCustomizer mybatisCustomizer() {
        return configuration -> {
            // ★ 后添加的先执行
            configuration.addInterceptor(new DataPermissionInterceptor());
            configuration.addInterceptor(new SqlCostInterceptor());
        };
    }
}
```

```xml
<!-- ─── XML 方式 ─── -->
<plugins>
    <!-- ★ 注册顺序影响执行顺序：后注册的先执行 -->
    <plugin interceptor="com.example.mybatis.plugin.DataPermissionInterceptor"/>
    <plugin interceptor="com.example.mybatis.plugin.SqlCostInterceptor">
        <property name="slowSqlMillis" value="500"/>
        <property name="printSql" value="true"/>
    </plugin>
    <plugin interceptor="com.github.pagehelper.PageInterceptor">
        <property name="helperDialect" value="mysql"/>
        <property name="reasonable" value="true"/>
    </plugin>
</plugins>
```

### 3.7 MetaObject（MyBatis 的反射工具）★★★★★

```java
// MetaObject 是 MyBatis 提供的优雅反射工具，能读写嵌套属性、Map、集合
MetaObject metaObject = SystemMetaObject.forObject(target);

// 读取（支持嵌套路径）
MappedStatement ms = (MappedStatement) metaObject.getValue("delegate.mappedStatement");
String sql = (String) metaObject.getValue("delegate.boundSql.sql");
Object param = metaObject.getValue("parameterHandler.parameterObject");

// ★ 写入（能修改 final 字段？不能，但能修改对象的内部属性）
metaObject.setValue("delegate.boundSql.sql", newSql);

// 判断
metaObject.hasGetter("delegate.mappedStatement");
metaObject.hasSetter("delegate.boundSql.sql");
metaObject.getGetterType("delegate.boundSql.sql");
metaObject.getOriginalObject();                      // 原始对象

// 集合操作
metaObject.getValue("list[0].name");
metaObject.setValue("list[0].name", "newValue");

// Map 操作
metaObject.getValue("map.key");

// ★ 分离多层代理（被多个插件包装时）
while (metaObject.hasGetter("h")) {                   // JDK 代理的 InvocationHandler
    Object obj = metaObject.getValue("h");
    metaObject = SystemMetaObject.forObject(obj);
}
while (metaObject.hasGetter("target")) {              // CGLIB/自定义代理的 target
    Object obj = metaObject.getValue("target");
    metaObject = SystemMetaObject.forObject(obj);
}
```

## 4. PageHelper 分页插件 ★★★★★

**PageHelper 是最流行的 MyBatis 分页插件，本质是一个拦截 `Executor.query` 的插件。**

```xml
<dependency>
    <groupId>com.github.pagehelper</groupId>
    <artifactId>pagehelper-spring-boot-starter</artifactId>
    <version>2.1.0</version>
</dependency>
```

```yaml
pagehelper:
  helper-dialect: mysql                 # 数据库方言（不配则自动检测）
  reasonable: true                       # ★ 分页合理化：pageNum<1 查第一页，pageNum>pages 查最后一页
  support-methods-arguments: true        # ★ 支持通过 Mapper 方法参数传递分页（pageNum/pageSize）
  params: count=countSql                 # 参数映射
  page-size-zero: false                  # pageSize=0 时是否查全部
  auto-runtime-dialect: true             # 多数据源时自动识别方言
  close-conn: true                       # 分页后关闭连接
  count-suffix: _COUNT                   # count 查询的 msId 后缀（自定义 count SQL）
```

```java
// ─── 基本用法 ───
@Service
public class UserService {

    public PageResult<UserVO> page(UserQuery query) {
        // ★★ 关键：startPage 必须【紧跟】查询语句，中间不能有其他查询！
        PageHelper.startPage(query.getPageNum(), query.getPageSize());
        List<User> list = userMapper.selectByCondition(query);      // ★ 被拦截并改写为分页 SQL

        // ★ 用 PageInfo 包装，获取分页信息
        PageInfo<User> pageInfo = new PageInfo<>(list);
        pageInfo.getPageNum();          // 当前页
        pageInfo.getPageSize();         // 每页大小
        pageInfo.getTotal();            // ★ 总记录数
        pageInfo.getPages();            // ★ 总页数
        pageInfo.isHasNextPage();
        pageInfo.isHasPreviousPage();
        pageInfo.isIsFirstPage();
        pageInfo.isIsLastPage();
        pageInfo.getNavigatePages();    // 导航页码数量
        pageInfo.getNavigatepageNums(); // ★ 导航页码数组 [1,2,3,4,5]（用于前端页码条）
        pageInfo.getList();             // 当前页数据

        // 转 VO
        List<UserVO> vos = list.stream().map(UserVO::from).collect(Collectors.toList());
        return PageResult.of(vos, pageInfo.getTotal(), pageInfo.getPageNum(), pageInfo.getPageSize());
    }

    // ─── startPage 的其他重载 ───
    PageHelper.startPage(1, 10);                            // 基本分页
    PageHelper.startPage(1, 10, true);                       // 是否执行 count 查询（false 则不查总数，性能更好）
    PageHelper.startPage(1, 10, "create_time desc");          // ★ 排序（会自动加到 SQL 后）
    PageHelper.startPage(1, 10).setReasonable(false);         // 链式配置
    PageHelper.offsetPage(100, 10);                           // ★ 用 offset 分页（深分页场景）
    PageHelper.orderBy("create_time desc");                   // 只排序不分页

    // ─── ★ 通过方法参数自动分页（supportMethodsArguments=true）───
    // Mapper 方法参数中包含 pageNum 和 pageSize 即可
    List<User> selectByQuery(@Param("pageNum") int pageNum,
                             @Param("pageSize") int pageSize,
                             @Param("query") UserQuery query);
}
```

```xml
<!-- ─── PageHelper 生成的 SQL ─── -->
<!-- 原始 SQL -->
<select id="selectByCondition" resultType="User">
    SELECT id, user_name, age FROM t_user
    <where>...</where>
    ORDER BY create_time DESC
</select>

<!-- ★ 拦截后实际执行两条 SQL -->
<!-- ① count 查询（自动改写，★ 会智能去除 ORDER BY 和 LEFT JOIN） -->
SELECT COUNT(0) FROM t_user WHERE ...

<!-- ② 分页查询 -->
SELECT id, user_name, age FROM t_user WHERE ... ORDER BY create_time DESC LIMIT 0, 10

<!-- ─── ★ 自定义 count SQL（复杂查询时优化性能）─── -->
<select id="selectByCondition_COUNT" resultType="long">
    <!-- ★ id 后缀加 _COUNT，PageHelper 会优先用它 -->
    SELECT COUNT(*) FROM t_user u WHERE u.status = 1
</select>
```

**PageHelper 的原理：**

```java
// PageHelper 拦截 Executor.query，在真正执行前：
// ① 从 ThreadLocal 中取出分页参数（startPage 时放入的）
// ② 用【JSqlParser】解析原 SQL，改写为 count SQL 和分页 SQL
// ③ 先执行 count 查询，再执行分页查询
// ④ 把结果包装为 Page 对象（继承 ArrayList）
// ⑤ ★ 清除 ThreadLocal（finally 中，防止污染后续查询）

// PageHelper 的核心类
public class PageInterceptor implements Interceptor {
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        // ...
        Page page = pageParams.getPage(parameterObject, rowBounds);      // 从 ThreadLocal 取参数
        if (page == null) return invocation.proceed();                    // 没有分页参数，正常执行

        // ① count 查询
        Long count = count(executor, ms, parameter, rowBounds, resultHandler, boundSql, page);
        if (!page.isOrderByOnly() && page.getPageSize() > 0 && (!page.isCount() || count > 0)) {
            // ② 分页查询（★ 用方言改写 SQL）
            List resultList = ExecutorUtil.pageQuery(dialect, executor, ms, parameter, rowBounds,
                                                     resultHandler, boundSql, cacheKey);
            // ③ 包装为 Page
            ...
        }
    }
}
```

**PageHelper 的坑（★ 高频事故）：**

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | ★ **`startPage` 后有其他查询** | 分页作用到了错误的查询上 | `startPage` 必须**紧跟**目标查询 |
| 2 | ★ **`startPage` 后查询未执行**（如抛异常） | ThreadLocal 未清理，**下一个查询被错误分页** | PageHelper 有 finally 清理；但代码结构异常时仍可能泄漏，用 `PageHelper.clearPage()` |
| 3 | 分页后修改 List | `UnsupportedOperationException` | 返回的是 `Page`（ArrayList 子类），可修改但注意类型 |
| 4 | `PageInfo` 用了错误的 List | 分页信息全为 0 | ★ 必须用 `startPage` 后**立即返回的 List** 构建 PageInfo |
| 5 | count SQL 性能差 | 复杂 JOIN 的 count 很慢 | 自定义 `_COUNT` SQL，或 `startPage(x,y,false)` 不查 count |
| 6 | 深分页（offset 很大） | 越翻越慢 | ★ 用「延迟关联」或「游标分页」，见下 |
| 7 | 多数据源方言错误 | SQL 语法错误 | `auto-runtime-dialect: true` |
| 8 | 与 `@Transactional(readOnly=true)` 配合 | count 查询也在事务中 | 正常，无影响 |
| 9 | 嵌套查询（association）分页 | 分页只作用于主查询 | 理解语义，通常正确 |
| 10 | 排序字段注入 | ★ SQL 注入 | `orderBy` 参数要白名单校验 |

```java
// ─── 深分页优化（★ 面试高频 + 生产实战）───
// 问题：LIMIT 1000000, 10 需要扫描并丢弃前 100 万行，越翻越慢

// ❌ 慢：SELECT * FROM t_order ORDER BY id LIMIT 1000000, 10

// ✅ 方案 1：延迟关联（先用覆盖索引取主键，再回表）
SELECT o.* FROM t_order o
INNER JOIN (SELECT id FROM t_order ORDER BY id LIMIT 1000000, 10) t
ON o.id = t.id
// 子查询只扫索引（覆盖索引），主查询只回表 10 次 → 快 10 倍以上

// ✅ 方案 2：游标分页（★ 最优，但不能跳页）
// 前端传「上一页最后一条的 id」
SELECT * FROM t_order WHERE id > #{lastId} ORDER BY id LIMIT 10
// 无论翻到第几页都是 O(log n)，性能恒定
// 缺点：不能直接跳到第 N 页（适合「加载更多」的交互）

// ✅ 方案 3：限制最大页数
if (query.getPageNum() * query.getPageSize() > 10000) {
    throw new BusinessException("最多只能查看前 10000 条，请缩小查询范围");
}

// ✅ 方案 4：业务上避免深分页
// - 用搜索代替翻页（Elasticsearch）
// - 用筛选条件缩小结果集
// - 导出功能走异步任务
```

## 5. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 期望一级缓存跨请求生效 | 每次都查库 | Spring 中无事务时每次是新 SqlSession |
| 2 | 一级缓存返回同一对象引用 | 业务代码修改导致数据错乱 | `local-cache-scope: statement` 禁用 |
| 3 | 二级缓存多表 JOIN 脏数据 | 关联数据不更新 | `cache-ref` 或改用 Redis |
| 4 | 二级缓存多实例不一致 | 不同节点数据不同 | 用 Redis |
| 5 | `readOnly=true` 对象污染 | 缓存数据被业务代码改了 | `readOnly=false`（序列化） |
| 6 | 实体未实现 Serializable | 二级缓存报错 | 实现 Serializable + serialVersionUID |
| 7 | 只开 `cache-enabled` 没配 `<cache/>` | 二级缓存不生效 | 两者都要 |
| 8 | 二级缓存命中率低 | 任何写操作清空整个 namespace | 粒度太粗，改用 Redis 精细控制 |
| 9 | 插件的 `args` 参数类型写错 | 插件不生效（无报错！） | 必须与方法签名**完全一致** |
| 10 | 插件 `intercept` 中不调 `proceed()` | 原逻辑不执行，返回 null | 必须调用 |
| 11 | 插件 `intercept` 吞异常 | 错误被掩盖 | catch 后必须 throw |
| 12 | 插件顺序误解 | 执行顺序不符预期 | ★ 后注册的先执行（洋葱模型） |
| 13 | 插件 `plugin()` 无条件代理所有对象 | 性能下降、代理层过多 | 只对目标类型 `Plugin.wrap` |
| 14 | 修改 BoundSql.sql 失败 | sql 字段是 final | 用 `metaObject.setValue("delegate.boundSql.sql", x)` |
| 15 | PageHelper 的 `startPage` 后插入其他查询 | ★ 分页作用到错误的查询 | `startPage` 紧跟目标查询 |
| 16 | `PageInfo` 传了转换后的 List | 分页信息全为 0 | 用 `startPage` 后**原始返回的 List** |
| 17 | PageHelper 的 count SQL 太慢 | 分页接口整体慢 | 自定义 `_COUNT` SQL |
| 18 | 深分页性能差 | 翻页越深越慢 | 延迟关联 / 游标分页 / 限制页数 |
| 19 | `orderBy` 参数未校验 | SQL 注入 | 白名单校验 |
| 20 | ThreadLocal 分页参数泄漏 | 后续查询被错误分页 | 异常路径 `PageHelper.clearPage()` |
| 21 | 插件中用 MetaObject 未分离代理 | 取不到属性 | `while (hasGetter("h"))` 循环解包 |
| 22 | 多个插件都改 SQL | 互相覆盖 | 明确顺序，或用 JSqlParser 统一处理 |
| 23 | 手写 SQL 拼接改写（非 AST） | 复杂 SQL 改错（子查询、UNION） | 用 JSqlParser 解析 AST |
| 24 | 插件依赖 Spring Bean 但注册太早 | 注入为 null | 用静态持有者或 `ConfigurationCustomizer` |

---

## 关联笔记

- 上一篇：[[后端/MyBatis/动态SQL与结果映射]]
- 下一篇：[[后端/MyBatis/MyBatisPlus]]
- 相关：[[后端/MyBatis/MyBatis入门与核心配置]]（Executor 与四大对象）
- 缓存进阶：[[后端/中间件/Redis在Java项目中的整合]]（Redis 缓存设计、穿透/击穿/雪崩、双写一致性）
- Spring Cache：[[后端/Spring/事务管理与失效场景]]（事务与缓存的时序）
- 动态代理：[[后端/Java基础/反射与动态代理]]（插件的实现基础）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
