---
title: "MyBatis入门与核心配置"
aliases:
  - "MyBatis"
  - "SqlSession"
  - "Mapper 动态代理"
tags:
  - "后端"
  - "java"
  - "mybatis"
  - "面试"
category: "后端"
folder: "MyBatis"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/MyBatis/动态SQL与结果映射]]"
  - "[[后端/MyBatis/缓存机制与插件开发]]"
  - "[[后端/Spring/SSM整合实战]]"
  - "[[后端/数据库/MySQL/索引与执行计划]]"
created: 2026-09-07
updated: 2026-09-07
---

# MyBatis 入门与核心配置

## 1. MyBatis 是什么

**MyBatis 是一款「半自动」的 ORM 框架**：SQL 由开发者手写（完全可控），但参数映射、结果集到对象的转换由框架自动完成。

| 对比 | JDBC | **MyBatis** | Hibernate/JPA |
| --- | --- | --- | --- |
| 定位 | 原生 API | ★ **半自动 ORM** | **全自动 ORM** |
| SQL 编写 | 手写 + 手动拼接 | ★ **手写**（灵活可控） | **自动生成**（HQL/Criteria） |
| 参数设置 | 手动 `setXxx` | ★ 自动（`#&#123;&#125;`） | 自动 |
| 结果映射 | 手动 `resultSet.getXxx` | ★ **自动**（resultMap） | 自动 |
| 连接管理 | 手动 | 连接池托管 | 连接池托管 |
| 学习成本 | 低但繁琐 | ★ **低** | 高 |
| SQL 优化 | ★ 完全可控 | ★ **完全可控** | 难（生成的 SQL 可能不优） |
| 数据库移植 | ❌ | ❌（SQL 方言） | ★ **好**（换库改方言即可） |
| 适用 | — | ★ **国内主流**（互联网、复杂 SQL） | 国外主流、领域模型驱动 |

**MyBatis 解决的 JDBC 痛点：**

```java
// ─── 原生 JDBC 的样板代码 ───
public User findById(Long id) {
    Connection conn = null;
    PreparedStatement ps = null;
    ResultSet rs = null;
    try {
        conn = DriverManager.getConnection(url, user, pwd);        // ① 手动获取连接
        String sql = "SELECT id, user_name, age FROM user WHERE id = ?";
        ps = conn.prepareStatement(sql);                            // ② 手动预编译
        ps.setLong(1, id);                                          // ③ 手动设参数
        rs = ps.executeQuery();                                     // ④ 手动执行
        if (rs.next()) {
            User u = new User();
            u.setId(rs.getLong("id"));                              // ⑤ ★ 手动逐字段映射
            u.setUserName(rs.getString("user_name"));
            u.setAge(rs.getInt("age"));
            return u;
        }
        return null;
    } catch (SQLException e) {
        throw new RuntimeException(e);                              // ⑥ 手动异常处理
    } finally {
        try { if (rs != null) rs.close(); } catch (Exception ignored) {}   // ⑦ ★ 手动关资源（易漏）
        try { if (ps != null) ps.close(); } catch (Exception ignored) {}
        try { if (conn != null) conn.close(); } catch (Exception ignored) {}
    }
}

// ─── MyBatis 版本 ───
// Mapper 接口
public interface UserMapper {
    User selectById(Long id);                  // ★ 一行搞定
}
// Mapper XML
<select id="selectById" resultType="User">
    SELECT id, user_name AS userName, age FROM user WHERE id = #{id}
</select>
// 使用
User u = userMapper.selectById(1L);            // ★ 注入的代理对象直接调用
// ① 连接由连接池管理 ② 参数自动绑定 ③ 结果自动映射 ④ 资源自动释放 ⑤ 异常转为 Spring 的 DataAccessException
```

**MyBatis 的核心能力：**

| 能力 | 说明 |
| --- | --- |
| **SQL 与代码分离** | SQL 写在 XML 中（或注解），改 SQL 不用改 Java 代码 |
| **自动参数映射** | `#&#123;&#125;` 预编译占位符，防 SQL 注入 |
| **自动结果映射** | `resultMap` 支持复杂映射（一对一、一对多、多对多） |
| **动态 SQL** | `&lt;if&gt;`/`&lt;foreach&gt;`/`&lt;choose&gt;` 等 9 大标签，按条件拼 SQL |
| **一级/二级缓存** | 减少数据库查询 |
| **插件机制** | 拦截四大对象，可实现分页、性能监控、多租户 |
| **延迟加载** | 关联对象按需加载 |
| **与 Spring 无缝整合** | `mybatis-spring` 桥接包 |

## 2. 快速入门（独立使用）

### 2.1 依赖与配置

```xml
<dependencies>
    <dependency>
        <groupId>org.mybatis</groupId>
        <artifactId>mybatis</artifactId>
        <version>3.5.13</version>
    </dependency>
    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
        <version>8.0.33</version>
    </dependency>
    <!-- 连接池（MyBatis 内置了简单的 POOLED，生产建议用 Druid/HikariCP） -->
    <dependency>
        <groupId>com.alibaba</groupId>
        <artifactId>druid</artifactId>
        <version>1.2.20</version>
    </dependency>
    <dependency>
        <groupId>org.slf4j</groupId>
        <artifactId>slf4j-api</artifactId><version>1.7.36</version>
    </dependency>
    <dependency>
        <groupId>ch.qos.logback</groupId>
        <artifactId>logback-classic</artifactId><version>1.2.12</version>
    </dependency>
</dependencies>
```

### 2.2 mybatis-config.xml（全局配置）

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE configuration PUBLIC "-//mybatis.org//DTD Config 3.0//EN"
        "https://mybatis.org/dtd/mybatis-3-config.dtd">
<configuration>

    <!-- ★★★ 元素的顺序是【强制】的，写错会报 XML 解析错误！
         properties → settings → typeAliases → typeHandlers
         → objectFactory → objectWrapperFactory → reflectorFactory
         → plugins → environments → databaseIdProvider → mappers -->

    <!-- ═══ ① 引入外部属性文件 ═══ -->
    <properties resource="jdbc.properties">
        <!-- 也可以在这里定义默认值（被外部文件覆盖） -->
        <property name="driver" value="com.mysql.cj.jdbc.Driver"/>
    </properties>

    <!-- ═══ ② ★ 全局设置（最常用）═══ -->
    <settings>
        <!-- ★★ 下划线转驼峰：user_name → userName（必开！） -->
        <setting name="mapUnderscoreToCamelCase" value="true"/>
        <!-- ★ 日志实现：SLF4J / LOG4J2 / STDOUT_LOGGING（开发用，生产禁） -->
        <setting name="logImpl" value="SLF4J"/>
        <!-- ★ 查询超时（秒），防止慢 SQL 拖垮系统 -->
        <setting name="defaultStatementTimeout" value="30"/>
        <!-- 获取 JDBC 结果的批量大小（提升批量查询性能） -->
        <setting name="defaultFetchSize" value="100"/>
        <!-- ★ 允许 JDBC 自动生成主键（配合 useGeneratedKeys） -->
        <setting name="useGeneratedKeys" value="true"/>
        <!-- ★ 二级缓存总开关（生产建议 false，用 Redis 替代） -->
        <setting name="cacheEnabled" value="false"/>
        <!-- 延迟加载 -->
        <setting name="lazyLoadingEnabled" value="false"/>
        <setting name="aggressiveLazyLoading" value="false"/>   <!-- false = 按需加载 -->
        <!-- ★ 一级缓存范围：SESSION（默认，同一 SqlSession 共享）/ STATEMENT（不缓存） -->
        <setting name="localCacheScope" value="SESSION"/>
        <!-- ★ 结果为 null 时也调用 setter（保证字段完整，返回 Map 时保留 null 的 key） -->
        <setting name="callSettersOnNulls" value="true"/>
        <!-- 空结果集时返回实例而非 null -->
        <setting name="returnInstanceForEmptyRow" value="false"/>
        <!-- ★ 多结果集支持 -->
        <setting name="multipleResultSetsEnabled" value="true"/>
        <!-- ★ 使用列标签（AS 别名）代替列名 -->
        <setting name="useColumnLabel" value="true"/>
        <!-- JDBC 类型转换时的 null 处理（Oracle 需要） -->
        <setting name="jdbcTypeForNull" value="NULL"/>
        <!-- ★ 允许在嵌套结果映射中延迟加载 -->
        <setting name="lazyLoadTriggerMethods" value="equals,clone,hashCode,toString"/>
        <!-- 安全的行边界（RowBounds） -->
        <setting name="safeRowBoundsEnabled" value="false"/>
        <setting name="safeResultHandlerEnabled" value="true"/>
        <!-- ★ 自动映射行为：NONE / PARTIAL（默认）/ FULL -->
        <setting name="autoMappingBehavior" value="PARTIAL"/>
        <!-- ★ 自动映射未知列的行为：NONE（默认，忽略）/ WARNING / FAILING（报错） -->
        <setting name="autoMappingUnknownColumnBehavior" value="WARNING"/>
        <!-- 默认执行器：SIMPLE（默认）/ REUSE（复用 Statement）/ BATCH（批量） -->
        <setting name="defaultExecutorType" value="SIMPLE"/>
        <!-- ★ 数据源代理（用于 Spring 事务同步） -->
        <setting name="proxyFactory" value=""/>
        <!-- 本地缓存范围 -->
    </settings>

    <!-- ═══ ③ 类型别名（简化 XML 中的类型书写）═══ -->
    <typeAliases>
        <!-- 单个类 -->
        <typeAlias type="com.example.entity.User" alias="User"/>
        <!-- ★ 整个包（别名 = 类名首字母小写，或类名本身，不区分大小写） -->
        <package name="com.example.entity"/>
    </typeAliases>
    <!-- MyBatis 内置的别名（可直接用）：
         _byte → byte, _int → int, int/integer → Integer, long → Long,
         string → String, map → Map, list → List, hashmap → HashMap, arraylist → ArrayList -->

    <!-- ═══ ④ 类型处理器（Java 类型 ↔ JDBC 类型）═══ -->
    <typeHandlers>
        <package name="com.example.mybatis.typehandler"/>
        <!-- <typeHandler handler="com.example.mybatis.typehandler.JsonTypeHandler"
                        javaType="com.example.entity.UserExt" jdbcType="VARCHAR"/> -->
    </typeHandlers>

    <!-- ═══ ⑤ 插件（拦截器）═══ -->
    <plugins>
        <plugin interceptor="com.github.pagehelper.PageInterceptor">
            <property name="helperDialect" value="mysql"/>
            <property name="reasonable" value="true"/>
            <property name="supportMethodsArguments" value="true"/>
        </plugin>
        <plugin interceptor="com.example.mybatis.plugin.SqlCostInterceptor"/>
    </plugins>

    <!-- ═══ ⑥ ★ 环境配置（数据源 + 事务管理器）═══ -->
    <environments default="development">              <!-- ★ 默认使用的环境 -->
        <environment id="development">
            <!-- ★ 事务管理器：JDBC（手动提交回滚）/ MANAGED（交给容器，如 Spring） -->
            <transactionManager type="JDBC">
                <property name="skipSetAutoCommitOnClose" value="false"/>
            </transactionManager>
            <!-- ★ 数据源类型：UNPOOLED（无池）/ POOLED（连接池）/ JNDI -->
            <dataSource type="POOLED">
                <property name="driver" value="${driver}"/>          <!-- ★ ${} 引用 properties -->
                <property name="url" value="${url}"/>
                <property name="username" value="${username}"/>
                <property name="password" value="${password}"/>
                <!-- 连接池参数 -->
                <property name="poolMaximumActiveConnections" value="50"/>   <!-- 最大活动连接 -->
                <property name="poolMaximumIdleConnections" value="10"/>      <!-- 最大空闲 -->
                <property name="poolMaximumCheckoutTime" value="20000"/>      <!-- 借出超时(ms) -->
                <property name="poolTimeToWait" value="20000"/>               <!-- 等待时间 -->
                <property name="poolPingQuery" value="SELECT 1"/>             <!-- ★ 心跳检测 SQL -->
                <property name="poolPingEnabled" value="true"/>
                <property name="poolPingConnectionsNotUsedFor" value="3600000"/>  <!-- 多久未用才检测 -->
            </dataSource>
        </environment>

        <environment id="production">
            <transactionManager type="JDBC"/>
            <dataSource type="POOLED">
                <property name="driver" value="${prod.driver}"/>
                <property name="url" value="${prod.url}"/>
                <property name="username" value="${prod.username}"/>
                <property name="password" value="${prod.password}"/>
            </dataSource>
        </environment>
    </environments>

    <!-- ═══ ⑦ 数据库厂商标识（多数据库支持）═══ -->
    <databaseIdProvider type="DB_VENDOR">
        <property name="MySQL" value="mysql"/>
        <property name="Oracle" value="oracle"/>
        <property name="PostgreSQL" value="postgresql"/>
    </databaseIdProvider>
    <!-- 之后可在 SQL 中用 databaseId 区分：
         <select id="x" databaseId="mysql">SELECT NOW()</select>
         <select id="x" databaseId="oracle">SELECT SYSDATE FROM DUAL</select> -->

    <!-- ═══ ⑧ ★ Mapper 注册（四种方式）═══ -->
    <mappers>
        <!-- 方式 1：逐个指定 XML 文件 -->
        <mapper resource="mapper/UserMapper.xml"/>
        <!-- 方式 2：绝对路径 -->
        <mapper url="file:///data/mapper/OrderMapper.xml"/>
        <!-- 方式 3：★ 指定 Mapper 接口（要求 XML 与接口同包同名） -->
        <mapper class="com.example.mapper.UserMapper"/>
        <!-- 方式 4：★★ 批量扫描包（推荐） -->
        <package name="com.example.mapper"/>
    </mappers>
</configuration>
```

```properties
# jdbc.properties
driver=com.mysql.cj.jdbc.Driver
url=jdbc:mysql://localhost:3306/mybatis_demo?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
username=root
password=123456

prod.driver=com.mysql.cj.jdbc.Driver
prod.url=jdbc:mysql://prod-db:3306/mybatis_demo?useSSL=true
prod.username=${DB_USER}
prod.password=${DB_PASSWORD}
```

### 2.3 实体、Mapper 接口与 XML

```java
// ─── 实体类 ───
package com.example.entity;
import lombok.Data;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public class User implements Serializable {
    private static final long serialVersionUID = 1L;
    private Long id;
    private String userName;              // ★ 对应 user_name（开启驼峰转换后自动映射）
    private Integer age;
    private String email;
    private Integer status;
    private LocalDateTime createTime;
}

// ─── Mapper 接口 ───
package com.example.mapper;
import com.example.entity.User;
import org.apache.ibatis.annotations.*;
import java.util.List;

public interface UserMapper {

    /** 方式 1：注解 SQL（简单 CRUD） */
    @Select("SELECT * FROM t_user WHERE id = #{id}")
    User selectById(Long id);

    @Insert("INSERT INTO t_user(user_name, age, email, status, create_time) "
          + "VALUES(#{userName}, #{age}, #{email}, #{status}, NOW())")
    @Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")   // ★ 主键回填
    int insert(User user);

    @Update("UPDATE t_user SET user_name = #{userName}, age = #{age} WHERE id = #{id}")
    int updateById(User user);

    @Delete("DELETE FROM t_user WHERE id = #{id}")
    int deleteById(Long id);

    /** 方式 2：XML SQL（复杂查询，★ 主流做法） */
    List<User> selectByCondition(UserQuery query);      // 对应 XML 中 id="selectByCondition"
    long countByCondition(UserQuery query);
    List<User> selectByIds(@Param("ids") List<Long> ids);
    int batchInsert(@Param("list") List<User> users);
}

// ─── Mapper XML（resources/mapper/UserMapper.xml）───
```

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "https://mybatis.org/dtd/mybatis-3-mapper.dtd">
<!-- ★ namespace 必须是 Mapper 接口的【全限定名】（这是动态代理的绑定依据） -->
<mapper namespace="com.example.mapper.UserMapper">

    <!-- 结果映射（简单场景可省略，用 resultType） -->
    <resultMap id="BaseResultMap" type="com.example.entity.User">
        <id     column="id"          property="id"/>
        <result column="user_name"   property="userName"/>
        <result column="age"         property="age"/>
        <result column="email"       property="email"/>
        <result column="status"      property="status"/>
        <result column="create_time" property="createTime"/>
    </resultMap>

    <!-- SQL 片段（复用） -->
    <sql id="Base_Column_List">
        id, user_name, age, email, status, create_time
    </sql>

    <!-- ★ id 必须与接口方法名【完全一致】 -->
    <select id="selectByCondition" parameterType="com.example.dto.UserQuery"
            resultMap="BaseResultMap">
        SELECT <include refid="Base_Column_List"/>
        FROM t_user
        <where>
            <if test="userName != null and userName != ''">
                AND user_name LIKE CONCAT('%', #{userName}, '%')
            </if>
            <if test="minAge != null">AND age &gt;= #{minAge}</if>
            <if test="maxAge != null">AND age &lt;= #{maxAge}</if>
            <if test="status != null">AND status = #{status}</if>
        </where>
        ORDER BY create_time DESC
    </select>

    <select id="countByCondition" parameterType="com.example.dto.UserQuery" resultType="long">
        SELECT COUNT(*) FROM t_user
        <include refid="Base_Column_List"/><!-- 这里应该是 where 片段，实际项目中抽 <sql id="Where_Clause"/> -->
    </select>

    <select id="selectByIds" resultMap="BaseResultMap">
        SELECT <include refid="Base_Column_List"/> FROM t_user
        WHERE id IN
        <foreach collection="ids" item="id" open="(" separator="," close=")">
            #{id}
        </foreach>
    </select>

    <!-- ★ 批量插入（一条 SQL 插多行，性能比循环 insert 高 10 倍以上） -->
    <insert id="batchInsert" useGeneratedKeys="true" keyProperty="id">
        INSERT INTO t_user (user_name, age, email, status, create_time) VALUES
        <foreach collection="list" item="item" separator=",">
            (#{item.userName}, #{item.age}, #{item.email}, #{item.status}, NOW())
        </foreach>
    </insert>
</mapper>
```

### 2.4 独立使用的入口代码

```java
public class MyBatisStandaloneDemo {

    private static SqlSessionFactory sqlSessionFactory;

    /** ① 构建 SqlSessionFactory（★ 全局唯一，应用启动时创建一次） */
    static {
        try (InputStream is = Resources.getResourceAsStream("mybatis-config.xml")) {
            sqlSessionFactory = new SqlSessionFactoryBuilder().build(is);
            // 也可以指定环境：<environments default="production">
            // new SqlSessionFactoryBuilder().build(is, "production");
            // 或用 Properties
            // new SqlSessionFactoryBuilder().build(is, props);
        } catch (IOException e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    public static void main(String[] args) {
        // ② ★ 获取 SqlSession（每次数据库操作一个，线程不安全！）
        try (SqlSession session = sqlSessionFactory.openSession()) {
            // ③ ★ 获取 Mapper 代理对象
            UserMapper mapper = session.getMapper(UserMapper.class);

            // ④ 调用方法
            User user = mapper.selectById(1L);
            System.out.println(user);

            // ⑤ 写操作必须手动提交（默认不自动提交！）
            User newUser = new User();
            newUser.setUserName("张三");
            newUser.setAge(20);
            mapper.insert(newUser);
            System.out.println("回填的主键：" + newUser.getId());    // ★ useGeneratedKeys 生效
            session.commit();                                         // ★★ 必须提交！

        }   // ⑥ try-with-resources 自动关闭 session（归还连接）
    }

    /** 事务的完整控制 */
    public static void transactionDemo() {
        SqlSession session = sqlSessionFactory.openSession(false);   // false = 不自动提交
        try {
            UserMapper mapper = session.getMapper(UserMapper.class);
            mapper.insert(new User());
            mapper.updateById(new User());
            session.commit();                                        // 全部成功才提交
        } catch (Exception e) {
            session.rollback();                                       // ★ 失败回滚
            throw e;
        } finally {
            session.close();                                          // ★ 必须关闭
        }
    }

    /** openSession 的重载 */
    // openSession()                              默认，不自动提交
    // openSession(true)                          ★ 自动提交（单条操作时方便）
    // openSession(ExecutorType.BATCH)            ★ 批量执行器
    // openSession(TransactionIsolationLevel.READ_COMMITTED)   指定隔离级别
    // openSession(ExecutorType.BATCH, TransactionIsolationLevel.REPEATABLE_READ)
}
```

> 【重要】**整合 Spring 后，不需要手动管理 SqlSession**：`SqlSessionTemplate` 是线程安全的，由 Spring 管理生命周期，且自动与 Spring 事务同步。上面的代码只是理解 MyBatis 原生用法。

## 3. 四大核心对象 ★★★★★

```
SqlSessionFactoryBuilder  ──build()──→  SqlSessionFactory  ──openSession()──→  SqlSession
     （用完即弃）                          （★ 全局单例）                        （★ 一次会话）
                                                                                   │
                                                                              getMapper()
                                                                                   ↓
                                                                              Mapper 代理对象
```

| 对象 | 生命周期 | 线程安全 | 说明 |
| --- | --- | --- | --- |
| **`SqlSessionFactoryBuilder`** | **方法内局部变量**（用完即弃） | ❌ | 构建 SqlSessionFactory 后就该丢弃（它持有 XML 解析的临时数据） |
| **`SqlSessionFactory`** | ★ **应用全局单例** | ✅ **线程安全** | 一旦创建就长期存在，类似数据库连接池的工厂 |
| **`SqlSession`** | ★ **一次请求/一个方法** | ❌ **线程不安全** | 相当于 JDBC 的 Connection，**必须关闭** |
| **`Mapper`（代理对象）** | 与 SqlSession 相同或更短 | ❌ | 由 SqlSession 创建，不应长期持有 |

```java
// ─── 正确的生命周期管理 ───
public class MyBatisUtil {

    /** ★ SqlSessionFactory 单例（应用级） */
    private static final SqlSessionFactory FACTORY;
    static {
        try (InputStream is = Resources.getResourceAsStream("mybatis-config.xml")) {
            FACTORY = new SqlSessionFactoryBuilder().build(is);
            // ★ builder 用完就丢弃（不保存为静态字段）
        } catch (IOException e) {
            throw new ExceptionInInitializerError("MyBatis 初始化失败", e);
        }
    }

    public static SqlSessionFactory getFactory() { return FACTORY; }

    /** ★ SqlSession 每次获取新的，用完必须关闭 */
    public static <T> T execute(Function<SqlSession, T> action) {
        try (SqlSession session = FACTORY.openSession()) {     // ★ try-with-resources
            T result = action.apply(session);
            session.commit();
            return result;
        }
    }
}
// 使用
User user = MyBatisUtil.execute(s -> s.getMapper(UserMapper.class).selectById(1L));

// ─── SqlSession 的常用方法 ───
public interface SqlSession extends Closeable {
    // ★ 查询
    <T> T selectOne(String statement);                            // 查一条（多条抛 TooManyResultsException）
    <T> T selectOne(String statement, Object parameter);
    <E> List<E> selectList(String statement);                     // 查多条
    <E> List<E> selectList(String statement, Object parameter);
    <E> List<E> selectList(String statement, Object parameter, RowBounds rowBounds);   // ★ 逻辑分页
    <K, V> Map<K, V> selectMap(String statement, String mapKey);   // 查成 Map（按某字段做 key）
    void select(String statement, ResultHandler handler);          // ★ 流式处理（大数据量，不 OOM）
    <T> Cursor<T> selectCursor(String statement);                  // ★ 游标查询（JDK 8+，惰性迭代）

    // ★ 写操作（返回值是【影响行数】）
    int insert(String statement, Object parameter);
    int update(String statement, Object parameter);                // update 也用于 delete？不，delete 单独有
    int delete(String statement, Object parameter);

    // ★ 事务控制
    void commit();
    void commit(boolean force);                 // force=true 强制提交（即使没有变更）
    void rollback();
    void rollback(boolean force);

    // ★ 批量操作的刷盘
    List<BatchResult> flushStatements();        // ExecutorType.BATCH 时必须调用才真正执行

    // ★ 获取 Mapper 代理
    <T> T getMapper(Class<T> type);

    // 其他
    Configuration getConfiguration();
    Connection getConnection();
    void clearCache();                           // 清空一级缓存
}
```

### 3.1 Executor（执行器）★★★★★

**Executor 是 MyBatis 调度 SQL 执行的核心，有三种类型：**

| 类型 | 说明 | 特点 | 适用 |
| --- | --- | --- | --- |
| **`SimpleExecutor`**（默认） | 每次执行都创建新的 Statement | 简单，无复用 | ★ 默认选择 |
| **`ReuseExecutor`** | ★ **复用 Statement**（以 SQL 为 key 缓存） | 减少预编译开销 | 同一 SQL 反复执行 |
| **`BatchExecutor`** | ★ **批量执行**（所有 update 攒起来，一次 flush） | 大幅提升批量写性能 | 批量插入/更新 |

```java
// 指定执行器类型
SqlSession session = factory.openSession(ExecutorType.BATCH);
UserMapper mapper = session.getMapper(UserMapper.class);

// ─── BatchExecutor 的正确用法（★ 性能关键）───
try (SqlSession session = factory.openSession(ExecutorType.BATCH, false)) {
    UserMapper mapper = session.getMapper(UserMapper.class);
    for (int i = 0; i < 100000; i++) {
        mapper.insert(buildUser(i));            // ★ 此时并未真正执行 SQL，只是攒着
        if (i % 1000 == 999) {
            session.flushStatements();           // ★★ 每 1000 条刷一次盘（防止内存爆炸）
            session.commit();
            session.clearCache();
        }
    }
    session.flushStatements();                   // ★★ 最后一批
    session.commit();
}
// 性能对比（插入 10 万条）：
//   SimpleExecutor（循环单条 insert）：约 60 秒
//   BatchExecutor：约 8 秒（快 7 倍）
//   ★ 一条 SQL 多 VALUES 的批量插入：约 2 秒（最快，见下）

// ─── 最优方案：一条 SQL 插入多行（★ 生产推荐）───
<insert id="batchInsert">
    INSERT INTO t_user (user_name, age) VALUES
    <foreach collection="list" item="item" separator=",">
        (#{item.userName}, #{item.age})
    </foreach>
</insert>
// ⚠️ 注意：
// 1. MySQL 的 max_allowed_packet 限制（默认 4MB），单条 SQL 不能太大
// 2. 建议每批 500~2000 条，分批调用
// 3. JDBC URL 加 rewriteBatchedStatements=true（★ MySQL 驱动会把多条 INSERT 合并，性能提升数倍）

// JDBC URL 示例
jdbc:mysql://host:3306/db?rewriteBatchedStatements=true&useServerPrepStmts=true&cachePrepStmts=true
```

**三种执行器的内部结构：**

```
Executor（接口）
├── BaseExecutor（抽象类，★ 实现了【一级缓存】）
│   ├── SimpleExecutor      doUpdate：每次 new Statement
│   ├── ReuseExecutor       doUpdate：从 statementMap 中复用（key = SQL）
│   └── BatchExecutor       doUpdate：攒到 statementList，flushStatements 时批量执行
└── CachingExecutor（★ 装饰器，实现了【二级缓存】）
      内部持有一个 Executor（默认 SimpleExecutor）
      查询时先查二级缓存 → 未命中则委托给内部 Executor（查一级缓存 → 数据库）
```

## 4. Mapper 接口的动态代理原理 ★★★★★（面试必考）

**Mapper 接口没有实现类，为什么能直接调用方法？** —— 答案是 **JDK 动态代理**。

### 4.1 代理的创建

```java
// ─── 获取 Mapper 的入口 ───
// SqlSession.getMapper(Class)
public <T> T getMapper(Class<T> type) {
    return configuration.getMapper(type, this);
}

// Configuration.getMapper
public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
    return mapperRegistry.getMapper(type, sqlSession);
}

// ─── MapperRegistry（Mapper 注册表）───
public class MapperRegistry {
    private final Configuration config;
    /** ★ 已知的所有 Mapper：接口 Class → MapperProxyFactory */
    private final Map<Class<?>, MapperProxyFactory<?>> knownMappers = new HashMap<>();

    public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
        // ① 从注册表中取出该接口的工厂
        final MapperProxyFactory<T> mapperProxyFactory = (MapperProxyFactory<T>) knownMappers.get(type);
        if (mapperProxyFactory == null) {
            throw new BindingException("Type " + type + " is not known to the MapperRegistry.");
        }
        try {
            // ② ★ 创建代理对象
            return mapperProxyFactory.newInstance(sqlSession);
        } catch (Exception e) {
            throw new BindingException("Error getting mapper instance. Cause: " + e, e);
        }
    }

    /** ★ 启动时注册所有 Mapper（扫描包或逐个添加） */
    public <T> void addMapper(Class<T> type) {
        if (type.isInterface()) {                        // ★ 必须是接口！
            if (hasMapper(type)) {
                throw new BindingException("Type " + type + " is already known to the MapperRegistry.");
            }
            boolean loadCompleted = false;
            try {
                knownMappers.put(type, new MapperProxyFactory<>(type));    // ★ 存入工厂
                // ★ 解析同名的 XML 文件和注解 SQL
                MapperAnnotationBuilder parser = new MapperAnnotationBuilder(config, type);
                parser.parse();                           // 解析 @Select/@Insert 等注解 + XML
                loadCompleted = true;
            } finally {
                if (!loadCompleted) knownMappers.remove(type);
            }
        }
    }
}

// ─── MapperProxyFactory：用 JDK 动态代理生成 Mapper 实例 ───
public class MapperProxyFactory<T> {
    private final Class<T> mapperInterface;               // Mapper 接口
    private final Map<Method, MapperMethodInvoker> methodCache = new ConcurrentHashMap<>();

    protected T newInstance(MapperProxy<T> mapperProxy) {
        return (T) Proxy.newProxyInstance(                // ★★ JDK 动态代理！
                mapperInterface.getClassLoader(),
                new Class[] { mapperInterface },
                mapperProxy);                              // ★ InvocationHandler = MapperProxy
    }

    public T newInstance(SqlSession sqlSession) {
        final MapperProxy<T> mapperProxy =
            new MapperProxy<>(sqlSession, mapperInterface, methodCache);
        return newInstance(mapperProxy);
    }
}
```

### 4.2 方法调用的分发（MapperProxy.invoke）

```java
public class MapperProxy<T> implements InvocationHandler, Serializable {

    private final SqlSession sqlSession;                   // ★ 持有的 SqlSession
    private final Class<T> mapperInterface;
    private final Map<Method, MapperMethodInvoker> methodCache;

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {

        // ─── ① Object 的方法（toString/hashCode/equals）直接调用，不走 SQL ───
        if (Object.class.equals(method.getDeclaringClass())) {
            return method.invoke(this, args);
        }

        // ─── ② JDK 8+ 接口的 default 方法：调用默认实现 ───
        if (method.isDefault()) {
            return invokeDefaultMethod(proxy, method, args);
            // 内部用 MethodHandles.Lookup 调用接口的 default 方法
        }

        // ─── ③ ★★ 普通接口方法：缓存 MapperMethodInvoker，执行 SQL ───
        return cachedInvoker(method).invoke(proxy, method, args, sqlSession);
    }

    /** ★ 缓存 MapperMethod（避免每次调用都重新解析方法） */
    private MapperMethodInvoker cachedInvoker(Method method) {
        return methodCache.computeIfAbsent(method, m -> {
            // 判断是否是「返回多个结果的游标方法」等特殊类型
            if (mapperInterface.isAnnotationPresent(Flush.class)) { ... }
            return new PlainMethodInvoker(new MapperMethod(mapperInterface, method, sqlSession.getConfiguration()));
        });
    }
}

// ─── MapperMethod：真正执行 SQL 的地方 ───
public class MapperMethod {

    private final SqlCommand command;         // ★ SQL 命令（名称 + 类型 INSERT/UPDATE/DELETE/SELECT）
    private final MethodSignature method;     // ★ 方法签名（返回值类型、参数、是否分页等）

    public Object execute(SqlSession sqlSession, Object[] args) {
        Object result;
        // ★★ 根据 SQL 类型分发到 SqlSession 的不同方法
        switch (command.getType()) {
            case INSERT: {
                Object param = method.convertArgsToSqlCommandParam(args);      // 参数转换
                result = rowCountResult(sqlSession.insert(command.getName(), param));   // ★ 返回影响行数
                break;
            }
            case UPDATE: {
                Object param = method.convertArgsToSqlCommandParam(args);
                result = rowCountResult(sqlSession.update(command.getName(), param));
                break;
            }
            case DELETE: {
                Object param = method.convertArgsToSqlCommandParam(args);
                result = rowCountResult(sqlSession.delete(command.getName(), param));
                break;
            }
            case SELECT:
                // ★ 根据返回值类型分四种情况
                if (method.returnsVoid() && method.hasResultHandler()) {
                    executeWithResultHandler(sqlSession, args);            // ① ResultHandler 流式处理
                    result = null;
                } else if (method.returnsMany()) {
                    result = executeForMany(sqlSession, args);              // ② 返回 List/数组/Cursor
                } else if (method.returnsMap()) {
                    result = executeForMap(sqlSession, args);               // ③ 返回 Map
                } else if (method.returnsCursor()) {
                    result = executeForCursor(sqlSession, args);            // ④ 返回 Cursor
                } else {
                    Object param = method.convertArgsToSqlCommandParam(args);
                    result = sqlSession.selectOne(command.getName(), param); // ⑤ ★ 返回单个对象
                    // Optional 包装处理
                    if (method.returnsOptional() && ...) { result = Optional.ofNullable(result); }
                }
                break;
            case FLUSH:
                result = sqlSession.flushStatements();
                break;
            default:
                throw new BindingException("Unknown execution method for: " + command.getName());
        }
        // ★ 查询返回 null 但方法返回基本类型 → 抛异常（防止自动拆箱 NPE）
        if (result == null && method.getReturnType().isPrimitive() && !method.returnsVoid()) {
            throw new BindingException("Mapper method '" + command.getName()
                + "' attempted to return null from a method with a primitive return type ("
                + method.getReturnType() + ").");
        }
        return result;
    }
}
```

### 4.3 完整调用链路

```
userMapper.selectById(1L)
    ↓ ① JDK 动态代理拦截
MapperProxy.invoke(proxy, method, args)
    ↓ ② 从 methodCache 取（或创建）MapperMethodInvoker
PlainMethodInvoker.invoke(...)
    ↓ ③ 执行 MapperMethod
MapperMethod.execute(sqlSession, args)
    ↓ ④ 判断 SQL 类型（SELECT）和返回值类型（单对象）
sqlSession.selectOne("com.example.mapper.UserMapper.selectById", 1L)
    ↓                              ↑ ★ statement = namespace + "." + 方法名
DefaultSqlSession.selectOne()
    ↓ ⑤ selectList 后取第一条
Executor.query(MappedStatement, parameter, rowBounds, resultHandler)
    ↓ ⑥ 先查二级缓存（CachingExecutor）→ 再查一级缓存（BaseExecutor）→ 都没有则查库
    ↓ ⑦ 构建 BoundSql（动态 SQL 解析 + #{} 替换为 ?）
    ↓ ⑧ StatementHandler.prepare() → 创建 PreparedStatement
    ↓ ⑨ ParameterHandler.setParameters() → ★ 设置参数（#{} 的值）
    ↓ ⑩ StatementHandler.query() → 执行 SQL
    ↓ ⑪ ResultSetHandler.handleResultSets() → ★ 结果集映射为对象
返回 User 对象
```

**关键设计（★ 面试要点）：**

| 要点 | 说明 |
| --- | --- |
| **接口与 XML 的绑定** | XML 的 `namespace` = 接口全限定名，`<select id>` = 方法名 → 组成 `statement` 全名 |
| **代理方式** | JDK 动态代理（因为 Mapper 必然是接口） |
| **MapperMethod 缓存** | `methodCache` 缓存解析结果，避免每次反射解析 |
| **返回值分派** | 根据方法返回类型（void/单个/多个/Map/Cursor）调用 SqlSession 的不同方法 |
| **影响行数** | insert/update/delete 返回 `int`（`rowCountResult` 处理） |
| **null 与基本类型** | 查询结果为 null 但返回类型是基本类型 → **抛异常**（而非返回 0，避免误解） |

> 【面试】MyBatis 的 Mapper 接口为什么「没有实现类也能工作」？
>
> **答**：MyBatis 用 **JDK 动态代理**为 Mapper 接口生成代理对象。调用方法时，代理拦截调用，根据「**接口全限定名 + 方法名**」定位到对应的 SQL（XML 中的 `<select id="方法名">` 或接口上的 `@Select` 注解），然后交给 `SqlSession` 执行，最后把结果集映射为方法返回类型。所以 Mapper 接口是「SQL 的声明」，代理是「SQL 的执行者」。

## 5. #&#123;&#125; 与 $&#123;&#125; ★★★★★（安全必考）

### 5.1 核心区别

| 对比 | **`#&#123;&#125;`** | **`$&#123;&#125;`** |
| --- | --- | --- |
| 本质 | ★ **预编译占位符**（替换为 `?`） | ★ **字符串直接拼接** |
| 实现 | `PreparedStatement.setXxx()` | SQL 文本替换后再编译 |
| **SQL 注入** | ✅ **安全**（参数永远是「值」） | ❌ **有风险** |
| 能替换的位置 | ★ **只能是「值」** | 值、**表名、列名、ORDER BY** 等标识符 |
| 类型处理 | 自动做类型转换和转义 | 原样拼接（需自己处理引号） |
| 性能 | ★ 可复用执行计划（预编译缓存） | 每次都是新 SQL（无法缓存） |
| 使用建议 | ★★ **默认一律用 `#&#123;&#125;`** | 仅在必须时用，且**白名单校验** |

```xml
<!-- ─── #{} 的实际效果 ─── -->
<select id="selectByName" resultType="User">
    SELECT * FROM t_user WHERE user_name = #{userName}
</select>
<!-- 生成的 SQL（预编译）：
     SELECT * FROM t_user WHERE user_name = ?
     然后 pstmt.setString(1, "Tom")
     ★ 无论 userName 是什么内容，都只会被当作「值」 -->

<!-- ─── ${} 的实际效果 ─── -->
<select id="selectByName2" resultType="User">
    SELECT * FROM t_user WHERE user_name = '${userName}'
</select>
<!-- 生成的 SQL（字符串拼接）：
     SELECT * FROM t_user WHERE user_name = 'Tom'
     ★ 如果 userName = "Tom' OR '1'='1"，SQL 变成：
       SELECT * FROM t_user WHERE user_name = 'Tom' OR '1'='1'
       → ★ SQL 注入！返回所有用户 -->
```

### 5.2 SQL 注入演示与防护

```java
// ─── 攻击示例 ───
// 1. 万能密码（登录绕过）
//    用户名输入：' OR '1'='1' --
//    ${} 拼接后：SELECT * FROM t_user WHERE user_name = '' OR '1'='1' --' AND password = 'xxx'
//    → -- 注释掉后面的密码校验，恒真条件成立 → 登录成功！

// 2. UNION 拖库
//    输入：' UNION SELECT username, password FROM t_admin --
//    → 窃取管理员密码

// 3. 堆叠注入（MySQL 需支持 multiStatements）
//    输入：'; DROP TABLE t_user; --
//    → 删表

// 4. 时间盲注
//    输入：' AND SLEEP(5) --
//    → 通过响应时间判断条件真假，逐位猜解数据

// ─── ${} 的合法使用场景（★ 必须白名单校验）───

// 场景 1：动态表名（分表）
<select id="selectFromShard" resultType="Order">
    SELECT * FROM order_${tableSuffix}      <!-- ★ 表名不能用 #{} -->
    WHERE user_id = #{userId}
</select>
// ★ 必须在 Service 层校验
private static final Pattern TABLE_SUFFIX = Pattern.compile("^\\d{4}$");   // 只允许 4 位数字
public List<Order> query(String suffix, Long userId) {
    if (!TABLE_SUFFIX.matcher(suffix).matches()) {
        throw new IllegalArgumentException("非法的表后缀：" + suffix);
    }
    return mapper.selectFromShard(suffix, userId);
}

// 场景 2：动态排序（★ ORDER BY 不能用 #{}）
<select id="selectWithSort" resultType="User">
    SELECT * FROM t_user
    <where>...</where>
    ORDER BY ${orderByColumn} ${orderByDirection}
</select>
// ★★★ 必须白名单校验！这是最常见的注入点
private static final Map<String, String> SORT_COLUMN_WHITELIST = Map.of(
        "id", "id",
        "createTime", "create_time",
        "userName", "user_name",
        "age", "age",
        "amount", "amount");
private static final Set<String> SORT_DIRECTION_WHITELIST = Set.of("ASC", "DESC");

public List<User> querySorted(UserQuery query) {
    // ① 列名白名单映射（前端传驼峰，映射为数据库列名）
    String column = SORT_COLUMN_WHITELIST.get(query.getOrderBy());
    if (column == null) {
        log.warn("非法排序字段：{}，回退到默认", query.getOrderBy());
        column = "create_time";
    }
    // ② 排序方向白名单
    String direction = SORT_DIRECTION_WHITELIST.contains(
            Optional.ofNullable(query.getOrderDir()).orElse("DESC").toUpperCase())
            ? query.getOrderDir().toUpperCase() : "DESC";
    query.setSafeOrderBy(column);
    query.setSafeOrderDir(direction);
    return mapper.selectWithSort(query);
}

// 场景 3：动态 SQL 片段（<include>）
<sql id="baseColumns">id, user_name, age</sql>
<select id="select">SELECT <include refid="baseColumns"/> FROM t_user</select>
// ★ 这种是编译期确定的，不涉及用户输入，安全

// 场景 4：IN 查询的表名/字段名（值仍要用 #{}）
<select id="selectByIds" resultType="User">
    SELECT * FROM ${tableName} WHERE id IN
    <foreach collection="ids" item="id" open="(" separator="," close=")">
        #{id}                              <!-- ★ 值仍然用 #{} -->
    </foreach>
</select>
```

> 【为什么 ORDER BY 不能用 `#&#123;&#125;`？】
> `#&#123;&#125;` 会被替换成 `?` 并通过 `setString()` 设值，而 **SQL 的 ORDER BY 后面跟的是「列名标识符」，不是「值」**。预编译占位符只能出现在「值」的位置，所以 `ORDER BY ?` 是非法的（会被当成排序依据一个常量，即不排序）。
>
> ```sql
> -- 错误：SELECT * FROM t ORDER BY ?   → setString(1, "age")
> -- 实际执行：SELECT * FROM t ORDER BY 'age'   → 按字符串常量排序（无效）
> ```

**防护 SQL 注入的完整清单：**

| # | 措施 | 说明 |
| --- | --- | --- |
| 1 | ★ **一律用 `#&#123;&#125;`** | 默认选择，从根源杜绝 |
| 2 | ★ `$&#123;&#125;` 必须白名单校验 | 表名、列名、排序字段都要枚举白名单 |
| 3 | 数据库账号最小权限 | 只给 DML（SELECT/INSERT/UPDATE/DELETE），**不给 DDL 和 GRANT** |
| 4 | 输入校验 | 类型、长度、格式、范围 |
| 5 | 输出转义 | 防止查询结果中的恶意数据造成二次注入/XSS |
| 6 | 关闭多语句执行 | JDBC URL **不要**加 `allowMultiQueries=true`（除非确实需要） |
| 7 | 错误信息不外泄 | 生产环境不返回 SQL 异常详情 |
| 8 | WAF / SQL 防火墙 | Druid 的 `wall` filter、云 WAF |
| 9 | 定期安全扫描 | SQLMap 等工具 |
| 10 | 敏感数据加密存储 | 即使拖库也无法直接使用 |

```java
// Druid 的 SQL 防火墙（wall filter）
<property name="filters" value="stat,wall,slf4j"/>
<property name="wallFilter">
    <bean class="com.alibaba.druid.wall.WallFilter">
        <property name="config">
            <bean class="com.alibaba.druid.wall.WallConfig">
                <property name="multiStatementAllow" value="false"/>    <!-- ★ 禁止多语句 -->
                <property name="deleteAllow" value="true"/>
                <property name="dropTableAllow" value="false"/>          <!-- ★ 禁止 DROP TABLE -->
                <property name="alterTableAllow" value="false"/>
                <property name="truncateAllow" value="false"/>
                <property name="commentAllow" value="false"/>            <!-- 禁止 SQL 注释（防注入） -->
                <property name="strictSyntaxCheck" value="true"/>
                <property name="conditionAndAlwayTrueAllow" value="false"/> <!-- ★ 禁止恒真条件 -->
                <property name="selectIntoAllow" value="false"/>
            </bean>
        </property>
    </bean>
</property>
```

## 6. Spring Boot 整合 MyBatis ★★★★★

```xml
<!-- 依赖（★ 一个 starter 搞定） -->
<dependency>
    <groupId>org.mybatis.spring.boot</groupId>
    <artifactId>mybatis-spring-boot-starter</artifactId>
    <version>3.0.3</version>          <!-- ★ Boot 3.x 用 3.0.x；Boot 2.x 用 2.3.x -->
</dependency>
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>
</dependency>
```

```yaml
# ═══════ application.yml（完整配置）═══════
spring:
  datasource:
    # ─── 单数据源（默认 HikariCP）───
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/mall?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true&rewriteBatchedStatements=true
    username: ${DB_USER:root}
    password: ${DB_PASSWORD:123456}
    # ★ HikariCP 配置（Boot 默认连接池，性能最好）
    hikari:
      pool-name: MallHikariPool
      minimum-idle: 10                    # 最小空闲连接
      maximum-pool-size: 50               # ★ 最大连接数
      idle-timeout: 600000                # 空闲连接超时回收（10 分钟）
      max-lifetime: 1800000               # ★ 连接最大存活时间（30 分钟，必须小于 MySQL 的 wait_timeout）
      connection-timeout: 3000            # ★ 获取连接超时（3 秒，快速失败）
      connection-test-query: SELECT 1      # 连接检测（JDBC4 驱动可省略，用 isValid）
      validation-timeout: 3000
      auto-commit: true
      leak-detection-threshold: 60000      # ★ 连接泄漏检测（60 秒未归还则告警，开发环境必开）
      data-source-properties:
        cachePrepStmts: true               # ★ 缓存预编译语句
        prepStmtCacheSize: 250
        prepStmtCacheSqlLimit: 2048
        useServerPrepStmts: true            # ★ 使用服务端预编译
        rewriteBatchedStatements: true      # ★ 批量插入优化（性能提升数倍）

# ═══════ MyBatis 配置 ═══════
mybatis:
  # ★ Mapper XML 位置（classpath*: 支持多模块/jar 中的 XML）
  mapper-locations: classpath*:mapper/**/*.xml
  # ★ 实体类别名包（XML 中可直接写类名）
  type-aliases-package: com.example.entity
  # 类型处理器包
  type-handlers-package: com.example.mybatis.typehandler
  # ★ 检查 XML 中的 configLocation 与 configuration 不能同时配置
  config-location: classpath:mybatis-config.xml      # 二选一：用外部配置文件
  configuration:                                      # 或直接内联配置（★ 推荐，更直观）
    # ★★ 下划线转驼峰
    map-underscore-to-camel-case: true
    # ★ 日志实现（开发用 STDOUT_LOGGING 能直接看 SQL，生产用 SLF4J）
    log-impl: org.apache.ibatis.logging.slf4j.Slf4jImpl
    # 二级缓存（生产建议关闭）
    cache-enabled: false
    # ★ 一级缓存范围（STATEMENT 可避免脏读，SESSION 性能更好）
    local-cache-scope: session
    # ★ null 值也调 setter（返回 Map 时保留 null 的 key）
    call-setters-on-nulls: true
    # 查询超时（秒）★ 防止慢 SQL 拖垮系统
    default-statement-timeout: 30
    default-fetch-size: 100
    # 延迟加载
    lazy-loading-enabled: false
    aggressive-lazy-loading: false
    # ★ 自动映射行为：PARTIAL（默认，不含嵌套）/ FULL（含嵌套）/ NONE
    auto-mapping-behavior: partial
    # ★ 未知列的处理：none（忽略）/ warning（警告）/ failing（报错）
    auto-mapping-unknown-column-behavior: warning
    # JDBC 类型
    jdbc-type-for-null: 'null'
    # ★ 默认执行器
    default-executor-type: simple
    # 允许在嵌套查询中使用列前缀
    use-column-label: true
    # 自动生成主键
    use-generated-keys: true
  # ★ 全局的 @Mapper 扫描（也可用 @MapperScan 注解）
  # mapper-scan: com.example.mapper

# ═══════ 日志级别（打印 SQL）═══════
logging:
  level:
    # ★ 把 Mapper 接口所在的包设为 DEBUG，就能看到完整 SQL 和参数
    com.example.mapper: debug
    # 或更精细：只针对某个 Mapper
    # com.example.mapper.UserMapper: debug
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
```

```java
// ═══════ 启动类 ═══════
@SpringBootApplication
@MapperScan(basePackages = "com.example.mapper",        // ★★ 扫描 Mapper 接口
            annotationClass = Mapper.class,              // 只扫描带 @Mapper 的（可选）
            markerInterface = BaseMapper.class,          // 只扫描继承了 BaseMapper 的（可选）
            sqlSessionFactoryRef = "sqlSessionFactory",  // 多数据源时指定
            sqlSessionTemplateRef = "sqlSessionTemplate",
            lazyInitialization = "false")                // 是否懒加载 Mapper
public class MallApplication {
    public static void main(String[] args) {
        SpringApplication.run(MallApplication.class, args);
    }
}

// ★ @MapperScan vs @Mapper 的区别
// @Mapper：加在每个 Mapper 接口上（逐个标注，接口多时繁琐）
// @MapperScan：加在配置类/启动类上，批量扫描整个包（★ 推荐）
// 两者可共存；用了 @MapperScan 后，@Mapper 可省略
// ⚠️ 都不用 → Mapper 无法注入（NoSuchBeanDefinitionException）
```

```java
// ═══════ 多数据源配置（★ 实战高频）═══════
@Configuration
public class MasterDataSourceConfig {

    /** 主数据源 */
    @Bean
    @Primary                                                  // ★ 标记为主数据源
    @ConfigurationProperties("spring.datasource.master")
    public DataSource masterDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean
    @Primary
    public SqlSessionFactory masterSqlSessionFactory(
            @Qualifier("masterDataSource") DataSource dataSource) throws Exception {
        SqlSessionFactoryBean factory = new SqlSessionFactoryBean();
        factory.setDataSource(dataSource);
        factory.setMapperLocations(new PathMatchingResourcePatternResolver()
                .getResources("classpath*:mapper/master/**/*.xml"));
        factory.setTypeAliasesPackage("com.example.entity");
        org.apache.ibatis.session.Configuration cfg = new org.apache.ibatis.session.Configuration();
        cfg.setMapUnderscoreToCamelCase(true);
        cfg.setLogImpl(org.apache.ibatis.logging.slf4j.Slf4jImpl.class);
        factory.setConfiguration(cfg);
        return factory.getObject();
    }

    @Bean
    @Primary
    public DataSourceTransactionManager masterTxManager(
            @Qualifier("masterDataSource") DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    @Bean
    @Primary
    public SqlSessionTemplate masterSqlSessionTemplate(
            @Qualifier("masterSqlSessionFactory") SqlSessionFactory factory) {
        return new SqlSessionTemplate(factory);
    }
}

@Configuration
@MapperScan(basePackages = "com.example.mapper.slave",          // ★ 扫描从库的 Mapper 包
            sqlSessionFactoryRef = "slaveSqlSessionFactory",
            sqlSessionTemplateRef = "slaveSqlSessionTemplate")
public class SlaveDataSourceConfig {
    @Bean
    @ConfigurationProperties("spring.datasource.slave")
    public DataSource slaveDataSource() { return DataSourceBuilder.create().build(); }

    @Bean
    public SqlSessionFactory slaveSqlSessionFactory(
            @Qualifier("slaveDataSource") DataSource ds) throws Exception {
        SqlSessionFactoryBean factory = new SqlSessionFactoryBean();
        factory.setDataSource(ds);
        factory.setMapperLocations(new PathMatchingResourcePatternResolver()
                .getResources("classpath*:mapper/slave/**/*.xml"));
        return factory.getObject();
    }

    @Bean
    public DataSourceTransactionManager slaveTxManager(@Qualifier("slaveDataSource") DataSource ds) {
        return new DataSourceTransactionManager(ds);
    }
}

// ★ 主库 Mapper 用 @MapperScan(basePackages="com.example.mapper.master", ...)
//   事务要指定：@Transactional(transactionManager = "slaveTxManager")
```

```yaml
# 多数据源的 yml
spring:
  datasource:
    master:
      jdbc-url: jdbc:mysql://master-host:3306/mall
      username: root
      password: xxx
      driver-class-name: com.mysql.cj.jdbc.Driver
    slave:
      jdbc-url: jdbc:mysql://slave-host:3306/mall
      username: readonly
      password: xxx
      driver-class-name: com.mysql.cj.jdbc.Driver
# ⚠️ HikariCP 用的是 jdbc-url 而非 url（@ConfigurationProperties 绑定时的差异）
```

## 7. SQL 日志与调试 ★★★★★

```
// ─── MyBatis 输出的 SQL 日志格式 ───
==>  Preparing: SELECT id, user_name, age FROM t_user WHERE id = ?
==> Parameters: 1(Long)
<==      Total: 1
<==    Columns: id, user_name, age
<==        Row: 1, 张三, 20

// 批量操作
==>  Preparing: INSERT INTO t_user (user_name, age) VALUES (?, ?)
==> Parameters: 张三(String), 20(Integer)
<==    Updates: 1                              ← ★ 影响行数

// 日志级别的含义
DEBUG：打印 SQL、参数、结果条数（★ 开发调试用）
TRACE：更详细（含结果集的每一行）
INFO：只打印基本信息
WARN/ERROR：异常
```

```yaml
# ─── 开启 SQL 日志的三种方式 ───
# 方式 1：把 Mapper 包设为 DEBUG（★ 推荐，精准）
logging:
  level:
    com.example.mapper: debug

# 方式 2：MyBatis 用 STDOUT_LOGGING（直接打到控制台，★ 仅本地调试）
mybatis:
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl

# 方式 3：全局 DEBUG（日志量太大，不推荐）
logging:
  level:
    root: debug
```

```xml
<!-- logback-spring.xml 中精细控制 -->
<configuration>
    <!-- ★ MyBatis 的 SQL 日志（按 Mapper 包） -->
    <logger name="com.example.mapper" level="DEBUG" additivity="false">
        <appender-ref ref="SQL_FILE"/>
    </logger>
    <!-- ★ JDBC 参数绑定 -->
    <logger name="java.sql.Connection" level="DEBUG"/>
    <logger name="java.sql.Statement" level="DEBUG"/>
    <logger name="java.sql.PreparedStatement" level="DEBUG"/>
    <logger name="java.sql.ResultSet" level="TRACE"/>      <!-- 打印结果集（日志量大，慎用） -->

    <appender name="SQL_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/sql.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/sql.%d{yyyy-MM-dd}.log.gz</fileNamePattern>
            <maxHistory>7</maxHistory>
        </rollingPolicy>
        <encoder><pattern>%d{HH:mm:ss.SSS} [%X{traceId}] %msg%n</pattern></encoder>
    </appender>
</configuration>
```

**其他调试手段：**

```java
// ─── ① p6spy（★ 打印【真实】的完整 SQL，参数已替换，可直接复制执行）───
// pom.xml
<dependency>
    <groupId>p6spy</groupId>
    <artifactId>p6spy</artifactId>
    <version>3.9.1</version>
</dependency>
// application.yml：把 driver 和 url 换成 p6spy 的
spring:
  datasource:
    driver-class-name: com.p6spy.engine.spy.P6SpyDriver      // ★
    url: jdbc:p6spy:mysql://localhost:3306/mall               // ★ jdbc:p6spy:mysql
// spy.properties
modulelist=com.p6spy.engine.spy.P6SpyFactory,com.p6spy.engine.logging.P6LogFactory
logMessageFormat=com.p6spy.engine.spy.appender.CustomLineFormat
customLogMessageFormat=%(currentTime) | 耗时 %(executionTime) ms | SQL: %(sqlSingleLine)
appender=com.p6spy.engine.spy.appender.Slf4JLogger
// 输出效果：
// 2026-09-07 10:30:45 | 耗时 12 ms | SQL: SELECT * FROM t_user WHERE id = 1
// ★ 参数已替换，可直接复制到数据库客户端执行 —— 排查问题神器

// ─── ② MyBatis 提供的 SQL 构建器（编程式，少用）───
String sql = new SQL() {{
    SELECT("id, user_name");
    FROM("t_user");
    WHERE("status = #{status}");
    if (query.getName() != null) WHERE("user_name LIKE #{name}");
    ORDER_BY("create_time DESC");
}}.toString();

// ─── ③ 单元测试验证 Mapper ───
@SpringBootTest
@MapperScan("com.example.mapper")
class UserMapperTest {
    @Autowired private UserMapper userMapper;

    @Test
    void testSelectById() {
        User user = userMapper.selectById(1L);
        Assertions.assertNotNull(user);
        Assertions.assertEquals("张三", user.getUserName());
    }
}
// ★ 更快的方式：@MybatisTest（只加载 MyBatis 相关，用内嵌数据库）
@MybatisTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)   // 用真实数据库
class UserMapperFastTest { ... }

// ─── ④ Druid 监控（★ 生产环境的 SQL 分析）───
// 访问 /druid/sql.html 可以看到：
//   每条 SQL 的执行次数、耗时分布（最大/最小/平均）、并发量、错误数
//   ★ 能直接定位慢 SQL
```

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | ★ 用 `$&#123;&#125;` 拼接用户输入 | **SQL 注入** | 一律 `#&#123;&#125;`；`$&#123;&#125;` 必须白名单校验 |
| 2 | ORDER BY 用 `#&#123;&#125;` | 排序不生效 | ORDER BY 只能用 `$&#123;&#125;` + 白名单 |
| 3 | 未开 `mapUnderscoreToCamelCase` | 字段映射为 null | 开启该配置 |
| 4 | XML 的 namespace 与接口不一致 | `Invalid bound statement (not found)` | namespace 必须是接口全限定名 |
| 5 | XML 的 id 与方法名不一致 | 同上 | id 必须与方法名完全一致 |
| 6 | XML 未被打包（放在 src/main/java 下） | 同上 | 配 `&lt;resources&gt;` 包含 `**/*.xml`，或放到 resources |
| 7 | `mapper-locations` 路径写错 | 同上 | 用 `classpath*:mapper/**/*.xml` |
| 8 | 忘记 `@MapperScan` 或 `@Mapper` | `NoSuchBeanDefinitionException` | 二者至少有一个 |
| 9 | SqlSession 未关闭 | 连接泄漏，池耗尽 | try-with-resources；整合 Spring 后自动管理 |
| 10 | 独立使用时忘记 `commit()` | 数据没写入 | `session.commit()`；或 `openSession(true)` |
| 11 | SqlSessionFactory 重复创建 | 性能差、连接池浪费 | 全局单例 |
| 12 | SqlSession 跨线程共享 | 线程不安全，数据错乱 | 每线程一个；Spring 中用 SqlSessionTemplate |
| 13 | `configLocation` 与 `configuration` 同时配 | 启动报错 | 二选一 |
| 14 | mybatis-config.xml 中保留 `&lt;environments&gt;` | Spring 整合后事务失效 | 整合后去掉 environments 和 mappers |
| 15 | XML 中 `<` `>` `&` 未转义 | XML 解析错误 | 用 `&lt;` `&gt;` `&amp;` 或 `<![CDATA[ ]]>` |
| 16 | `selectOne` 查到多条 | `TooManyResultsException` | 用 `selectList` 或加 LIMIT 1 |
| 17 | 查询返回 null 赋给基本类型 | `BindingException` | 返回类型用包装类，或 SQL 用 IFNULL |
| 18 | insert 后拿不到主键 | id 为 null | `useGeneratedKeys="true" keyProperty="id"` |
| 19 | 批量插入未开 `rewriteBatchedStatements` | 性能提升不明显 | JDBC URL 加该参数 |
| 20 | 批量插入单条 SQL 过大 | `PacketTooBigException` | 分批（每批 500~2000），调 MySQL 的 `max_allowed_packet` |
| 21 | `@Param` 忘加（多参数时） | `Parameter 'xxx' not found` | 多参数必须加 `@Param`，或编译加 `-parameters` |
| 22 | 日志级别不对看不到 SQL | 无法调试 | Mapper 包设为 DEBUG |
| 23 | 生产开着 STDOUT_LOGGING | 性能差、日志混乱 | 生产用 SLF4J |
| 24 | 未设 `defaultStatementTimeout` | 慢 SQL 拖垮连接池 | 设置超时（如 30 秒） |
| 25 | HikariCP 的 `max-lifetime` 大于 MySQL `wait_timeout` | 偶发连接失效报错 | max-lifetime 必须小于 MySQL 的 wait_timeout |
| 26 | 多数据源事务未指定 transactionManager | 事务管错库 | `@Transactional("slaveTxManager")` |
| 27 | 多数据源的 `@ConfigurationProperties` 用 `url` 而非 `jdbc-url` | HikariCP 绑定失败 | Hikari 用 `jdbc-url` |
| 28 | `allowMultiQueries=true` 开启 | 堆叠注入风险 | 非必要不开启 |

---

## 关联笔记

- 下一篇：[[后端/MyBatis/动态SQL与结果映射]]
- 相关：[[后端/MyBatis/缓存机制与插件开发]]、[[后端/MyBatis/MyBatisPlus]]
- 整合：[[后端/Spring/SSM整合实战]]、[[后端/SpringBoot/整合数据访问层]]
- 事务：[[后端/Spring/事务管理与失效场景]]
- 代理原理：[[后端/Java基础/反射与动态代理]]、[[后端/Spring/动态代理-JDK与CGLIB]]
- 数据库：[[后端/数据库/MySQL/索引与执行计划]]、[[后端/数据库/MySQL/慢查询与性能优化]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
