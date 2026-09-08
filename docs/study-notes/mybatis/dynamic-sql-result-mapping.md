---
title: "动态SQL与结果映射"
aliases:
  - "MyBatis 动态 SQL"
  - "resultMap"
  - "一对多映射"
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
  - "[[后端/MyBatis/缓存机制与插件开发]]"
  - "[[后端/数据库/MySQL/高级查询与函数]]"
  - "[[后端/Spring/事务管理与失效场景]]"
created: 2026-09-07
updated: 2026-09-07
---

# 动态 SQL 与结果映射

## 1. 动态 SQL 九大标签 ★★★★★

**动态 SQL 是 MyBatis 最强大的特性**：根据条件动态拼接 SQL，彻底告别 JDBC 时代的字符串拼接地狱。

| 标签 | 作用 | 类比 |
| --- | --- | --- |
| **`<if>`** | 条件判断 | if |
| **`<where>`** | ★ 智能 WHERE（自动去除开头多余的 AND/OR） | — |
| **`<set>`** | ★ 智能 SET（自动去除末尾多余的逗号） | — |
| **`<trim>`** | 通用前后缀处理（where/set 的底层） | — |
| **`<choose>/<when>/<otherwise>`** | 多选一 | switch-case-default |
| **`<foreach>`** | ★ 集合遍历（IN、批量插入） | for |
| **`<sql>` + `<include>`** | SQL 片段复用 | 函数/宏 |
| **`<bind>`** | 创建变量（OGNL 表达式） | 局部变量 |

### 1.1 `<if>` 与 `<where>` ★★★★★

```xml
<!-- ─── ❌ 不用 where 标签的坑 ─── -->
<select id="selectBad" resultType="User">
    SELECT * FROM t_user
    WHERE
    <if test="name != null">user_name = #{name}</if>
    <if test="age != null">AND age = #{age}</if>
</select>
<!-- 如果 name 为 null 而 age 不为 null，生成的 SQL：
     SELECT * FROM t_user WHERE AND age = 20     ← ★ 语法错误！ -->
<!-- 如果两个都为 null：SELECT * FROM t_user WHERE   ← ★ 语法错误！ -->

<!-- ─── ✅ 用 <where> 标签（★ 智能处理）─── -->
<select id="selectByCondition" resultType="User">
    SELECT <include refid="Base_Column_List"/>
    FROM t_user
    <where>
        <if test="name != null and name != ''">
            AND user_name LIKE CONCAT('%', #{name}, '%')
        </if>
        <if test="age != null">
            AND age = #{age}
        </if>
        <if test="status != null">
            AND status = #{status}
        </if>
        <if test="deptIds != null and deptIds.size() > 0">
            AND dept_id IN
            <foreach collection="deptIds" item="deptId" open="(" separator="," close=")">
                #{deptId}
            </foreach>
        </if>
    </where>
    ORDER BY create_time DESC
</select>
<!-- <where> 的行为：
     ① 内部有内容 → 自动加上 WHERE
     ② 内部内容以 AND/OR 开头 → ★ 自动去掉这个 AND/OR
     ③ 内部无内容 → 不加 WHERE
     生成的 SQL（name 为 null 时）：
     SELECT ... FROM t_user WHERE age = 20 AND status = 1 ORDER BY create_time DESC   ✅ -->

<!-- ─── <where> 的等价 <trim> 写法（理解原理）─── -->
<trim prefix="WHERE" prefixOverrides="AND |OR |AND\n|OR\n">
    <if test="name != null">AND user_name = #{name}</if>
</trim>
<!-- prefix="WHERE"           → 有内容时加 WHERE 前缀
     prefixOverrides="AND |OR " → ★ 去掉开头的 AND 或 OR（注意 AND 后面有空格） -->
```

**`<if>` 的 test 表达式（OGNL）：**

```xml
<!-- ─── 基本判断 ─── -->
<if test="name != null">                          <!-- 非 null -->
<if test="name != null and name != ''">            <!-- ★ 字符串必须同时判空串！ -->
<if test="age != null and age > 18">                <!-- 数值比较 -->
<if test="age != null and age >= 18 and age &lt;= 60">   <!-- ★ < 要写成 &lt; -->
<if test="flag">                                    <!-- boolean 直接判断 -->
<if test="!flag">                                   <!-- 取反 -->
<if test="list != null and list.size() > 0">        <!-- ★ 集合判空 -->
<if test="list != null and !list.isEmpty()">        <!-- 同上 -->
<if test="map != null and map.size() > 0">          <!-- Map 判空 -->
<if test="arr != null and arr.length > 0">          <!-- ★ 数组用 length（不是 size） -->
<if test="name != null and name.contains('张')">     <!-- ★ 调用方法（OGNL 支持） -->
<if test="name != null and name.length() > 5">
<if test="type == 1 or type == 2">                  <!-- 或 -->
<if test="type != null and type == 'A'.toString()"> <!-- ★ 字符比较的坑，见下 -->
<if test='type != null and type == "A"'>            <!-- ✅ 推荐：单引号包 test，双引号包字符串 -->
<if test="user != null and user.name != null">      <!-- 嵌套属性 -->
<if test="@com.example.util.StringUtils@isNotBlank(name)">   <!-- ★ 调用静态方法 -->

<!-- ★★ 经典坑：单字符比较 -->
<if test="type == 'A'">          <!-- ❌ 失效！OGNL 把 'A' 当成 char，而 type 是 String -->
<if test="type == 'A'.toString()">   <!-- ✅ 方案 1：转成 String -->
<if test='type == "A"'>             <!-- ✅ 方案 2：外单内双（★ 推荐） -->
<if test="type.equals('A'.toString())">   <!-- ✅ 方案 3：equals -->
<!-- 原因：OGNL 中单引号包裹的单个字符被解析为 char 类型，String != char 恒为 false -->
<!-- 多字符没问题：<if test="type == 'ABC'"> 是 String 比较 ✅ -->

<!-- ─── test 中可用的变量（取决于参数类型）─── -->
<!-- ① 单个 POJO 参数：直接用属性名 -->
User selectByName(User user);      → test="userName != null"
<!-- ② 单个基本类型/字符串：用 _parameter 或任意名 -->
User selectById(Long id);          → test="id != null" 或 test="_parameter != null"
<!-- ③ 多个参数（有 @Param）：用 @Param 指定的名字 -->
User select(@Param("name") String name, @Param("age") Integer age);
                                   → test="name != null and age != null"
<!-- ④ 多个参数（无 @Param）：只能用 arg0/arg1 或 param1/param2 -->
User select(String name, Integer age);   → test="arg0 != null"（★ 强烈建议加 @Param）
<!-- ⑤ Map 参数：用 key -->
User select(Map<String, Object> map);    → test="name != null"
<!-- ⑥ 集合参数：collection / list / array -->
List<User> select(List<Long> ids);       → foreach collection="list"
List<User> select(Long[] ids);           → foreach collection="array"
List<User> select(@Param("ids") List<Long> ids);  → foreach collection="ids"  ★ 推荐
```

### 1.2 `<set>` 与动态更新 ★★★★★

```xml
<!-- ─── ❌ 手写 SET 的坑 ─── -->
<update id="updateBad">
    UPDATE t_user SET
    <if test="name != null">user_name = #{name},</if>
    <if test="age != null">age = #{age},</if>
    WHERE id = #{id}
</update>
<!-- 如果 name 和 age 都为 null：UPDATE t_user SET WHERE id = 1     ← ★ 语法错误 -->
<!-- 如果只有 name：UPDATE t_user SET user_name = 'x', WHERE id = 1 ← ★ 多了逗号，语法错误 -->

<!-- ─── ✅ 用 <set> 标签 ─── -->
<update id="updateSelective" parameterType="User">
    UPDATE t_user
    <set>
        <if test="userName != null and userName != ''">user_name = #{userName},</if>
        <if test="age != null">age = #{age},</if>
        <if test="email != null">email = #{email},</if>
        <if test="phone != null">phone = #{phone},</if>
        <if test="status != null">status = #{status},</if>
        <if test="deptId != null">dept_id = #{deptId},</if>
        update_time = NOW(),                       <!-- ★ 总是更新的字段（放最后，无逗号） -->
        version = version + 1                       <!-- ★ 乐观锁版本号自增 -->
    </set>
    WHERE id = #{id}
      AND version = #{version}                       <!-- ★ 乐观锁条件 -->
      AND deleted = 0
</update>
<!-- <set> 的行为：
     ① 自动加 SET 前缀
     ② ★ 自动去掉【末尾】多余的逗号
     ③ 内部无内容 → 报错（因为 UPDATE 必须有 SET） -->

<!-- ─── <set> 的等价 <trim> ─── -->
<trim prefix="SET" suffixOverrides=",">
    <if test="name != null">user_name = #{name},</if>
</trim>

<!-- ─── ★ 乐观锁更新的返回值处理 ─── -->
```

```java
// Service 层必须检查影响行数（乐观锁的核心）
@Service
public class UserServiceImpl {
    @Transactional(rollbackFor = Exception.class)
    public void update(User user) {
        int rows = userMapper.updateSelective(user);
        if (rows == 0) {
            // ★ 影响行数为 0 说明版本不匹配（被其他事务修改过）
            throw new BusinessException(ResultCode.DATA_CONFLICT, "数据已被他人修改，请刷新后重试");
        }
    }
}
```

```xml
<!-- ─── 批量更新（三种方式，性能差异巨大）─── -->

<!-- 方式 1：foreach + 多条 UPDATE（★ 需要 allowMultiQueries=true，不推荐） -->
<update id="batchUpdate1">
    <foreach collection="list" item="item" separator=";">
        UPDATE t_user SET user_name = #{item.userName}, age = #{item.age}
        WHERE id = #{item.id}
    </foreach>
</update>
<!-- JDBC URL 必须加 allowMultiQueries=true（★ 有 SQL 注入风险，慎用） -->

<!-- 方式 2：★ CASE WHEN（一条 SQL 更新多行，★ 推荐） -->
<update id="batchUpdate2">
    UPDATE t_user
    <trim prefix="SET" suffixOverrides=",">
        <trim prefix="user_name = CASE id" suffix="END,">
            <foreach collection="list" item="item">
                WHEN #{item.id} THEN #{item.userName}
            </foreach>
        </trim>
        <trim prefix="age = CASE id" suffix="END,">
            <foreach collection="list" item="item">
                WHEN #{item.id} THEN #{item.age}
            </foreach>
        </trim>
        update_time = NOW(),
    </trim>
    WHERE id IN
    <foreach collection="list" item="item" open="(" separator="," close=")">
        #{item.id}
    </foreach>
</update>
<!-- 生成的 SQL：
     UPDATE t_user SET
       user_name = CASE id WHEN 1 THEN '张三' WHEN 2 THEN '李四' END,
       age = CASE id WHEN 1 THEN 20 WHEN 2 THEN 30 END,
       update_time = NOW()
     WHERE id IN (1, 2)
     ★ 一次网络往返，性能最好 -->

<!-- 方式 3：INSERT ... ON DUPLICATE KEY UPDATE（★ MySQL 特有，最简洁） -->
<insert id="batchUpsert">
    INSERT INTO t_user (id, user_name, age, create_time, update_time)
    VALUES
    <foreach collection="list" item="item" separator=",">
        (#{item.id}, #{item.userName}, #{item.age}, NOW(), NOW())
    </foreach>
    ON DUPLICATE KEY UPDATE
        user_name = VALUES(user_name),
        age = VALUES(age),
        update_time = NOW()
</insert>
<!-- ★ 存在则更新，不存在则插入（需要 id 或唯一索引） -->
<!-- MySQL 8.0.20+ 推荐用别名语法（VALUES() 已废弃）：
     INSERT INTO t_user (...) VALUES (...) AS new
     ON DUPLICATE KEY UPDATE user_name = new.user_name, ... -->

<!-- 方式 4：REPLACE INTO（★ 慎用！会先 DELETE 再 INSERT，触发外键级联删除、自增 ID 变化） -->
```

### 1.3 `<choose>` / `<when>` / `<otherwise>`

```xml
<!-- 相当于 switch-case-default：★ 只会命中一个分支 -->
<select id="selectByChoose" resultType="User">
    SELECT * FROM t_user
    <where>
        <choose>
            <!-- ★ 优先级从高到低，命中第一个就停止 -->
            <when test="id != null">
                AND id = #{id}
            </when>
            <when test="userName != null and userName != ''">
                AND user_name = #{userName}
            </when>
            <when test="phone != null and phone != ''">
                AND phone = #{phone}
            </when>
            <when test="email != null and email != ''">
                AND email = #{email}
            </when>
            <!-- ★ 兜底：防止无条件全表扫描 -->
            <otherwise>
                AND create_time &gt;= DATE_SUB(NOW(), INTERVAL 7 DAY)
            </otherwise>
        </choose>
        <!-- 其他公共条件（与 choose 并列，都会生效） -->
        <if test="status != null">AND status = #{status}</if>
    </where>
</select>

<!-- ─── choose vs if 的区别 ─── -->
<!-- if：所有满足条件的都会拼接（AND 关系） -->
<!-- choose：★ 只拼接第一个满足的（互斥关系） -->
```

### 1.4 `<foreach>` ★★★★★（最常用）

```xml
<!-- ─── 属性说明 ─── -->
<foreach collection="集合名"        <!-- ★ list/array/Map的key/@Param名 -->
         item="元素变量名"          <!-- 当前元素 -->
         index="索引变量名"         <!-- 下标（List）或 key（Map） -->
         open="开始符号"
         close="结束符号"
         separator="分隔符"
         nullable="false">          <!-- MyBatis 3.5+：允许集合为 null -->
</foreach>

<!-- ─── ① IN 查询（★ 最常见）─── -->
<select id="selectByIds" resultType="User">
    SELECT * FROM t_user WHERE id IN
    <foreach collection="ids" item="id" open="(" separator="," close=")">
        #{id}
    </foreach>
</select>
<!-- 生成：WHERE id IN (?, ?, ?) -->

<!-- IN 查询的多种参数形式 -->
List<User> selectByIds(@Param("ids") List<Long> ids);          // collection="ids"
List<User> selectByIds(List<Long> ids);                         // collection="list" ★ 无 @Param 时
List<User> selectByIds(Long[] ids);                             // collection="array"
List<User> selectByIds(Map<String, Object> map);                // collection="map中的key"

<!-- ─── ② ★ 批量插入（一条 SQL 多 VALUES，性能最优）─── -->
<insert id="batchInsert" useGeneratedKeys="true" keyProperty="id">
    INSERT INTO t_user (user_name, age, email, status, create_time)
    VALUES
    <foreach collection="list" item="item" separator=",">
        (#{item.userName}, #{item.age}, #{item.email}, #{item.status}, NOW())
    </foreach>
</insert>
<!-- 生成：INSERT INTO t_user (...) VALUES (?,?,?,?), (?,?,?,?), (?,?,?,?) -->
<!-- ★ useGeneratedKeys 在批量插入时也能回填所有主键（MyBatis 3.3.1+） -->

<!-- ─── ③ 遍历 Map ─── -->
<insert id="insertFromMap">
    INSERT INTO t_user
    <trim prefix="(" suffix=")" suffixOverrides=",">
        <foreach collection="map" index="key" item="value">
            ${key},                              <!-- ⚠️ 列名只能用 ${}（白名单校验！） -->
        </foreach>
    </trim>
    <trim prefix="VALUES (" suffix=")" suffixOverrides=",">
        <foreach collection="map" index="key" item="value">
            #{value},
        </foreach>
    </trim>
</insert>

<!-- ─── ④ 遍历对象列表的某个字段 ─── -->
<select id="selectByUsers" resultType="Order">
    SELECT * FROM t_order WHERE (user_id, status) IN
    <foreach collection="users" item="u" open="(" separator="," close=")">
        (#{u.id}, #{u.status})
    </foreach>
</select>

<!-- ─── ⑤ 嵌套 foreach（多维条件）─── -->
<select id="selectByMultiConditions" resultType="User">
    SELECT * FROM t_user
    <where>
        <foreach collection="groups" item="group" separator=" OR ">
            (
            <foreach collection="group.conditions" item="cond" separator=" AND ">
                ${cond.column} ${cond.operator} #{cond.value}
                <!-- ⚠️ column 和 operator 是 ${}，★ 必须白名单校验 -->
            </foreach>
            )
        </foreach>
    </where>
</select>
<!-- 生成：WHERE (age > 18 AND status = 1) OR (dept_id = 5 AND level > 3) -->

<!-- ─── ⑥ index 的使用（List 的下标 / Map 的 key）─── -->
<foreach collection="list" item="item" index="i" separator=",">
    #{i}: #{item}                     <!-- 0: a, 1: b, 2: c -->
</foreach>

<!-- ─── ⑦ 批量删除（逻辑删除）─── -->
<update id="batchLogicDelete">
    UPDATE t_user
    SET deleted = 1, update_time = NOW(), update_by = #{operator}
    WHERE id IN
    <foreach collection="ids" item="id" open="(" separator="," close=")">
        #{id}
    </foreach>
    AND deleted = 0                    <!-- ★ 只删未删除的，避免重复 -->
</update>

<!-- ─── ⑧ foreach 中的 <if>（跳过无效元素）─── -->
<insert id="batchInsertValid">
    INSERT INTO t_user (user_name, age) VALUES
    <foreach collection="list" item="item" separator=",">
        <if test="item.userName != null">
            (#{item.userName}, #{item.age})
        </if>
    </foreach>
</insert>
<!-- ⚠️ 危险：如果某个 item 被 if 跳过，会留下多余的分隔符逗号 → SQL 语法错误！
     ✅ 正确做法：在 Java 层先过滤，再传给 MyBatis -->
```

**foreach 的性能与限制：**

| 要点 | 说明 |
| --- | --- |
| **IN 的元素数量限制** | MySQL 无硬性限制，但 Oracle 限制 **1000 个**；过多会导致 SQL 过长、解析慢、无法命中索引 |
| **建议分批** | IN 查询每批 **500~1000 个**；批量插入每批 **500~2000 条** |
| **`max_allowed_packet`** | MySQL 默认 4MB（8.0 是 64MB），单条 SQL 超过会报 `PacketTooBigException` |
| **预编译参数上限** | MySQL 的 PreparedStatement 参数上限 **65535 个**，超过报错 |
| **`rewriteBatchedStatements=true`** | ★ MySQL 批量插入必加（驱动会把多条合并，性能提升 5~10 倍） |

```java
// ─── 分批处理的工具方法（★ 生产必备）───
public class BatchUtils {

    /** 分批执行（避免 IN 过长 / SQL 过大） */
    public static <T> void batchProcess(List<T> list, int batchSize, Consumer<List<T>> processor) {
        if (CollectionUtils.isEmpty(list)) return;
        for (int i = 0; i < list.size(); i += batchSize) {
            List<T> batch = list.subList(i, Math.min(i + batchSize, list.size()));
            processor.accept(batch);
        }
    }

    /** 分批查询并合并结果 */
    public static <T, R> List<R> batchQuery(List<T> ids, int batchSize,
                                            Function<List<T>, List<R>> queryFn) {
        if (CollectionUtils.isEmpty(ids)) return Collections.emptyList();
        List<R> result = new ArrayList<>(ids.size());
        // 先去重，减少查询量
        List<T> distinctIds = ids.stream().distinct().collect(Collectors.toList());
        for (int i = 0; i < distinctIds.size(); i += batchSize) {
            List<T> batch = distinctIds.subList(i, Math.min(i + batchSize, distinctIds.size()));
            result.addAll(queryFn.apply(batch));
        }
        return result;
    }
}

// 使用
BatchUtils.batchProcess(userIds, 500, batch -> userMapper.selectByIds(batch));
List<User> users = BatchUtils.batchQuery(userIds, 500, userMapper::selectByIds);

// Guava 的分批
for (List<Long> batch : Lists.partition(userIds, 500)) {
    userMapper.selectByIds(batch);
}
// Hutool 的分批
ListUtil.partition(userIds, 500).forEach(userMapper::selectByIds);
// JDK 的 IntStream 分批
IntStream.iterate(0, i -> i + 500).limit((ids.size() + 499) / 500)
    .mapToObj(i -> ids.subList(i, Math.min(i + 500, ids.size())))
    .forEach(userMapper::selectByIds);
```

### 1.5 `<sql>` 与 `<include>`（SQL 片段复用）

```xml
<!-- ─── 定义片段 ─── -->
<sql id="Base_Column_List">
    id, user_name, age, email, phone, status, dept_id, create_time, update_time
</sql>

<sql id="Base_Where_Clause">
    <where>
        deleted = 0
        <if test="userName != null and userName != ''">
            AND user_name LIKE CONCAT('%', #{userName}, '%')
        </if>
        <if test="status != null">AND status = #{status}</if>
        <if test="deptId != null">AND dept_id = #{deptId}</if>
        <if test="createTimeStart != null">AND create_time &gt;= #{createTimeStart}</if>
        <if test="createTimeEnd != null">
            AND create_time &lt; DATE_ADD(#{createTimeEnd}, INTERVAL 1 DAY)
        </if>
    </where>
</sql>

<!-- ─── 带参数的片段（★ 用 ${alias} 实现表别名）─── -->
<sql id="User_Columns">
    ${alias}.id, ${alias}.user_name, ${alias}.age, ${alias}.dept_id
</sql>

<!-- ─── 使用 ─── -->
<select id="selectById" resultMap="BaseResultMap">
    SELECT <include refid="Base_Column_List"/>
    FROM t_user
    WHERE id = #{id} AND deleted = 0
</select>

<select id="selectByCondition" resultMap="BaseResultMap">
    SELECT <include refid="Base_Column_List"/>
    FROM t_user
    <include refid="Base_Where_Clause"/>
    ORDER BY create_time DESC
</select>

<!-- ─── ★ 跨 namespace 引用（全限定名）─── -->
<select id="selectWithAlias" resultMap="BaseResultMap">
    SELECT <include refid="com.example.mapper.CommonMapper.User_Columns">
             <property name="alias" value="u"/>        <!-- ★ 传入片段参数 -->
           </include>
    FROM t_user u
    WHERE u.id = #{id}
</select>

<!-- ─── 片段中的属性引用 ─── -->
<sql id="paginationSuffix">
    LIMIT #{offset}, #{pageSize}
</sql>
```

> 【规范】**禁止 `SELECT *`**，理由：
> 1. 无法使用「覆盖索引」（多读无用列）。
> 2. 表结构变更时代码可能出错（列顺序/数量变化）。
> 3. 网络传输浪费（尤其有 TEXT/BLOB 大字段时）。
> 4. 结果映射时可能命中意外的列。
>
> **用 `<sql id="Base_Column_List">` 统一维护列清单**，改动时只改一处。

### 1.6 `<trim>` 与 `<bind>`

```xml
<!-- ─── <trim>：万能的前后缀处理（where/set 都是它的特例）─── -->
<trim prefix=""              <!-- 前缀 -->
      prefixOverrides=""      <!-- ★ 要移除的前缀（多个用 | 分隔） -->
      suffix=""               <!-- 后缀 -->
      suffixOverrides="">     <!-- ★ 要移除的后缀 -->
</trim>

<!-- 示例 1：等价于 <where> -->
<trim prefix="WHERE" prefixOverrides="AND |OR ">
    <if test="x != null">AND x = #{x}</if>
</trim>

<!-- 示例 2：等价于 <set> -->
<trim prefix="SET" suffixOverrides=",">
    <if test="x != null">x = #{x},</if>
</trim>

<!-- 示例 3：拼接 VALUES 子句 -->
INSERT INTO t_user (
    <trim suffixOverrides=",">
        <if test="name != null">user_name,</if>
        <if test="age != null">age,</if>
        create_time,
    </trim>
) VALUES (
    <trim suffixOverrides=",">
        <if test="name != null">#{name},</if>
        <if test="age != null">#{age},</if>
        NOW(),
    </trim>
)
<!-- ★ 这是「动态插入非 null 字段」的标准写法（数据库有默认值的字段不插入） -->

<!-- ─── <bind>：创建变量（OGNL 表达式求值）─── -->
<select id="selectByLike" resultType="User">
    <!-- ★ 解决 LIKE 的模糊查询（避免用 ${} 导致注入） -->
    <bind name="namePattern" value="'%' + name + '%'"/>
    SELECT * FROM t_user WHERE user_name LIKE #{namePattern}
</select>

<!-- 数据库方言适配（★ 多数据库兼容） -->
<select id="selectPage" resultType="User">
    SELECT * FROM t_user
    <if test="_databaseId == 'mysql'">
        LIMIT #{offset}, #{pageSize}
    </if>
    <if test="_databaseId == 'oracle'">
        WHERE ROWNUM &lt;= #{end}
    </if>
</select>

<!-- 兼容不同数据库的 LIKE（Oracle 用 || 拼接） -->
<bind name="pattern" value="'%' + keyword + '%'"/>       <!-- ★ 通用方案，避免方言问题 -->
SELECT * FROM t_user WHERE user_name LIKE #{pattern}

<!-- _parameter：单个参数时的引用 -->
<select id="selectById" resultType="User">
    <bind name="idValue" value="_parameter"/>
    SELECT * FROM t_user WHERE id = #{idValue}
</select>

<!-- 内置变量 -->
<!-- _parameter      传入的参数对象（单参数时就是它本身） -->
<!-- _databaseId     数据库厂商标识（配合 databaseIdProvider） -->
```

### 1.7 动态 SQL 的解析原理

```java
// MyBatis 的动态 SQL 不是「字符串拼接」，而是【SqlNode 树】
// 每个标签对应一个 SqlNode 实现：

SqlNode 接口
├── StaticTextSqlNode           静态文本
├── DynamicTextSqlNode          含 ${} 的文本
├── IfSqlNode                   <if>
├── ForEachSqlNode              <foreach>
├── WhereSqlNode                <where>（继承 TrimSqlNode）
├── SetSqlNode                  <set>（继承 TrimSqlNode）
├── TrimSqlNode                 <trim>
├── ChooseSqlNode               <choose>
├── VarDeclSqlNode              <bind>
├── MixedSqlNode                ★ 组合多个 SqlNode（树形结构）
└── TextSqlNode                 文本

// 解析流程：
// ① 启动时：XML/注解 → SqlSource（DynamicSqlSource 或 RawSqlSource）
//    - 有动态标签或 ${} → DynamicSqlSource（每次执行都重新解析）
//    - 纯静态 SQL → RawSqlSource（★ 启动时就解析成静态 SQL，性能更好）
// ② 执行时：SqlSource.getBoundSql(参数) → BoundSql
//    - 遍历 SqlNode 树，用【OGNL】对 test 表达式求值
//    - 拼接出最终的 SQL 文本，把 #{} 替换为 ?
//    - 生成 ParameterMapping 列表（记录每个 ? 对应的参数）
// ③ PreparedStatement 设置参数并执行

// ─── 查看 MyBatis 生成的最终 SQL（调试技巧）───
// 方式 1：日志（Mapper 包设为 DEBUG）
// 方式 2：拦截器打印 BoundSql（见 [[后端/MyBatis/缓存机制与插件开发]]）
// 方式 3：单元测试中手动获取
SqlSessionFactory factory = ...;
Configuration config = factory.getConfiguration();
MappedStatement ms = config.getMappedStatement("com.example.mapper.UserMapper.selectByCondition");
BoundSql boundSql = ms.getBoundSql(queryParam);
System.out.println("SQL: " + boundSql.getSql());
System.out.println("参数: " + boundSql.getParameterObject());
boundSql.getParameterMappings().forEach(pm ->
    System.out.println("  " + pm.getProperty() + " → " + pm.getJdbcType()));
```

## 2. 结果映射（resultMap）★★★★★

### 2.1 resultType vs resultMap

| | `resultType` | `resultMap` |
| --- | --- | --- |
| 适用 | 简单映射（列名与属性名一致，或开启了驼峰转换） | ★ 复杂映射（列名不一致、嵌套对象、集合） |
| 写法 | `resultType="User"` 或别名 | `resultMap="BaseResultMap"` |
| 能否映射关联对象 | ❌ | ✅（association / collection） |
| 性能 | 略快 | 略慢（需查映射规则） |
| 常用度 | 简单查询 | ★ 复杂查询、生产项目 |

```xml
<!-- ─── resultType 的三种情况 ─── -->
<!-- ① 映射为实体（列名与属性名一致，或开启驼峰转换） -->
<select id="selectById" resultType="com.example.entity.User">
    SELECT id, user_name, age FROM t_user WHERE id = #{id}
</select>
<!-- 开启 mapUnderscoreToCamelCase 后 user_name → userName 自动映射 -->

<!-- ② 用别名手动对应（未开启驼峰转换时） -->
<select id="selectById2" resultType="User">
    SELECT id, user_name AS userName, create_time AS createTime FROM t_user WHERE id = #{id}
</select>

<!-- ③ 映射为基本类型/Map -->
<select id="countAll" resultType="long">SELECT COUNT(*) FROM t_user</select>
<select id="selectNameById" resultType="string">SELECT user_name FROM t_user WHERE id = #{id}</select>
<select id="selectAsMap" resultType="map">SELECT * FROM t_user WHERE id = #{id}</select>
<!-- ★ 返回 Map：列名作为 key（注意：null 值的列默认不出现在 Map 中，需 callSettersOnNulls=true） -->

<!-- ④ 多列返回 Map（★ 用 @MapKey） -->
@MapKey("id")                                    // ★ 指定用哪个字段做 Map 的 key
Map<Long, User> selectAllAsMap();
<select id="selectAllAsMap" resultType="User">SELECT * FROM t_user</select>
<!-- 返回：{1=User(1), 2=User(2), ...} -->
```

### 2.2 resultMap 完整语法

```xml
<resultMap id="BaseResultMap" type="com.example.entity.User">
    <!-- ★ 构造器映射（用于不可变对象，字段是 final 的） -->
    <constructor>
        <idArg column="id" javaType="long"/>
        <arg column="user_name" javaType="string"/>
        <arg column="age" javaType="int"/>
    </constructor>

    <!-- ★ 主键映射（★ 必须有，用于缓存和嵌套映射的去重） -->
    <id column="id" property="id"
        javaType="java.lang.Long"
        jdbcType="BIGINT"/>

    <!-- ★ 普通字段映射 -->
    <result column="user_name" property="userName"
            javaType="java.lang.String"          <!-- Java 类型（通常可省略，自动推断） -->
            jdbcType="VARCHAR"                    <!-- JDBC 类型（★ 字段可为 null 时建议指定） -->
            typeHandler="com.example.handler.StringTrimTypeHandler"  <!-- ★ 自定义类型处理器 -->
            />
    <result column="age" property="age"/>
    <result column="email" property="email" jdbcType="VARCHAR"/>
    <result column="status" property="status"/>
    <result column="create_time" property="createTime" jdbcType="TIMESTAMP"/>
    <result column="ext_info" property="extInfo"
            typeHandler="com.example.handler.JsonTypeHandler"/>   <!-- ★ JSON 字段 → 对象 -->

    <!-- ★ 一对一关联（见 2.3） -->
    <association property="dept" javaType="com.example.entity.Dept">
        <id column="dept_id" property="id"/>
        <result column="dept_name" property="name"/>
    </association>

    <!-- ★ 一对多集合（见 2.4） -->
    <collection property="roles" ofType="com.example.entity.Role">
        <id column="role_id" property="id"/>
        <result column="role_name" property="name"/>
    </collection>

    <!-- ★ 鉴别器（根据某列的值选择不同的映射，类似 switch） -->
    <discriminator javaType="int" column="user_type">
        <case value="1" resultType="com.example.vo.VipUserVO">
            <result column="vip_level" property="vipLevel"/>
        </case>
        <case value="2" resultType="com.example.vo.NormalUserVO">
            <result column="register_source" property="source"/>
        </case>
    </discriminator>
</resultMap>
```

**属性说明：**

| 属性 | 说明 |
| --- | --- |
| `column` | 数据库列名（或 SQL 中的别名） |
| `property` | Java 属性名 |
| `javaType` | Java 类型（通常自动推断，可省略） |
| `jdbcType` | ★ JDBC 类型（**字段可能为 null 时建议指定**，某些数据库需要） |
| `typeHandler` | 自定义类型处理器 |
| `select` | ★ 嵌套查询的 statement id（延迟加载用） |
| `columnPrefix` | 列名前缀（多表 JOIN 时区分同名列） |
| `notNullColumn` | 只有该列非 null 时才创建对象 |
| `fetchType` | 覆盖全局的延迟加载设置（lazy/eager） |
| `resultSet` | 多结果集时指定 |
| `foreignColumn` | 多结果集的关联列 |

> 【坑】**`jdbcType` 什么时候必须写？**
> 当字段值为 **null** 时，MyBatis 需要知道 JDBC 类型才能调用 `setNull(i, jdbcType)`。某些数据库（**Oracle**）在 `jdbcTypeForNull` 设置不当时会报错：
> ```
> JdbcType OTHER 的错误：无效的列类型
> ```
> 解决：① 全局设置 `<setting name="jdbcTypeForNull" value="NULL"/>`；② 或在字段上显式写 `jdbcType="VARCHAR"`。MySQL 一般不需要。

### 2.3 一对一映射（association）★★★★★

**场景：用户 → 部门（一个用户属于一个部门）**

#### 方式 1：嵌套结果（JOIN 查询，★ 推荐）

```xml
<!-- ─── 一次 SQL 查询（JOIN）+ 嵌套 resultMap ─── -->
<resultMap id="UserWithDeptMap" type="com.example.entity.User">
    <id     column="id"          property="id"/>
    <result column="user_name"   property="userName"/>
    <result column="age"         property="age"/>
    <result column="dept_id"     property="deptId"/>

    <!-- ★ association：一对一 -->
    <association property="dept" javaType="com.example.entity.Dept">
        <id     column="d_id"        property="id"/>
        <result column="d_name"      property="deptName"/>
        <result column="d_code"      property="deptCode"/>
        <result column="d_manager"   property="manager"/>
    </association>
</resultMap>

<select id="selectUserWithDept" resultMap="UserWithDeptMap">
    SELECT
        u.id, u.user_name, u.age, u.dept_id,
        d.id       AS d_id,          <!-- ★ 用别名区分同名列 -->
        d.dept_name AS d_name,
        d.dept_code AS d_code,
        d.manager   AS d_manager
    FROM t_user u
    LEFT JOIN t_dept d ON u.dept_id = d.id     <!-- ★ LEFT JOIN：部门为 null 时用户仍能查出 -->
    WHERE u.id = #{id}
</select>
```

```java
// 实体类
@Data
public class User {
    private Long id;
    private String userName;
    private Integer age;
    private Long deptId;
    private Dept dept;              // ★ 关联对象
}
@Data
public class Dept {
    private Long id;
    private String deptName;
    private String deptCode;
    private String manager;
}
```

**优点**：一次 SQL，无 N+1 问题，性能好。
**缺点**：SQL 较复杂，列名要用别名区分。

#### 方式 2：嵌套查询（分步查询，支持延迟加载）

```xml
<resultMap id="UserWithDeptLazyMap" type="User">
    <id     column="id"        property="id"/>
    <result column="user_name" property="userName"/>
    <result column="dept_id"   property="deptId"/>

    <!-- ★ 嵌套查询：select 指向另一个 statement，column 是传给它的参数 -->
    <association property="dept"
                 javaType="com.example.entity.Dept"
                 select="com.example.mapper.DeptMapper.selectById"
                 column="dept_id"
                 fetchType="lazy"/>              <!-- ★ 延迟加载（用到时才查） -->
</resultMap>

<select id="selectUserLazy" resultMap="UserWithDeptLazyMap">
    SELECT id, user_name, dept_id FROM t_user WHERE id = #{id}
</select>

<!-- DeptMapper.xml -->
<select id="selectById" resultType="Dept">
    SELECT id, dept_name, dept_code, manager FROM t_dept WHERE id = #{id}
</select>
```

**多列参数传递：**

```xml
<!-- 传多列给嵌套查询 -->
<association property="dept" select="selectDeptByUser"
             column="{deptId=dept_id, tenantId=tenant_id}"/>
<!-- ★ 语法：{嵌套查询的参数名=当前结果的列名} -->
<!-- 等价于调用 selectDeptByUser(@Param("deptId") Long, @Param("tenantId") Long) -->

<!-- 也可以传整行 -->
<association property="dept" select="selectDept" column="id"/>
<!-- column="id" 时，嵌套查询收到的参数就是 id 的值 -->
```

**两种方式对比：**

| | 嵌套结果（JOIN） | 嵌套查询（分步） |
| --- | --- | --- |
| SQL 数量 | ★ **1 条** | N+1 条（列表查询时） |
| 性能 | ★ **好** | 差（N+1 问题），但支持**延迟加载**可缓解 |
| SQL 复杂度 | 高（多表 JOIN） | 低（各自简单） |
| 适用 | ★ **列表查询、性能敏感** | 详情查询、关联数据很少用到时 |
| 缓存 | 一条 SQL 的结果 | 每个子查询可独立缓存 |

> 【★ N+1 问题】用嵌套查询做**列表查询**时的经典性能陷阱：
> ```xml
> <select id="selectAll" resultMap="UserWithDeptLazyMap">
>     SELECT id, user_name, dept_id FROM t_user        <!-- 1 次查询，返回 100 条 -->
> </select>
> <!-- 若每条都触发 dept 的查询 → 共 1 + 100 = 101 次 SQL！ -->
> ```
> **解决方案**：
> 1. **列表查询用 JOIN**（嵌套结果方式）。
> 2. **开启延迟加载**（`lazyLoadingEnabled=true` + `fetchType="lazy"`），不用 dept 就不查。
> 3. **手动批量查询 + Map 组装**（★ 最可控）：
>    ```java
>    List<User> users = userMapper.selectAll();
>    Set<Long> deptIds = users.stream().map(User::getDeptId).filter(Objects::nonNull)
>                             .collect(Collectors.toSet());
>    Map<Long, Dept> deptMap = deptMapper.selectByIds(deptIds).stream()
>            .collect(Collectors.toMap(Dept::getId, Function.identity()));
>    users.forEach(u -> u.setDept(deptMap.get(u.getDeptId())));    // ★ 共 2 次 SQL
>    ```

### 2.4 一对多映射（collection）★★★★★

**场景：用户 → 多个角色；订单 → 多个订单项**

#### 方式 1：嵌套结果（JOIN）

```xml
<resultMap id="UserWithRolesMap" type="User">
    <id     column="id"        property="id"/>          <!-- ★★ 必须有 id！用于去重 -->
    <result column="user_name" property="userName"/>

    <!-- ★ collection：一对多 -->
    <collection property="roles" ofType="com.example.entity.Role">
        <!--                     ↑ ★ ofType 指定【集合元素】的类型（不是集合本身） -->
        <id     column="role_id"   property="id"/>       <!-- ★ 子对象的 id 也必须有 -->
        <result column="role_name" property="roleName"/>
        <result column="role_code" property="roleCode"/>
    </collection>
</resultMap>

<select id="selectUserWithRoles" resultMap="UserWithRolesMap">
    SELECT
        u.id, u.user_name,
        r.id AS role_id, r.role_name, r.role_code
    FROM t_user u
    LEFT JOIN t_user_role ur ON u.id = ur.user_id
    LEFT JOIN t_role r       ON ur.role_id = r.id
    WHERE u.id = #{id}
</select>
<!-- SQL 返回 3 行（用户有 3 个角色）：
     1, 张三, 10, 管理员, ADMIN
     1, 张三, 11, 编辑,   EDITOR
     1, 张三, 12, 访客,   GUEST
     ★ MyBatis 根据 <id> 去重合并为一个 User 对象，roles 集合有 3 个元素 -->
```

> 【★ 关键】**没有 `<id>` 会导致重复对象和性能问题**：
> MyBatis 用 `<id>` 列的值判断「是否是同一个对象」。如果不配 `<id>`（全用 `<result>`），MyBatis 会比较**所有列的值**来判断，性能差且可能产生重复对象。

#### 方式 2：嵌套查询

```xml
<resultMap id="UserWithRolesLazyMap" type="User">
    <id     column="id"        property="id"/>
    <result column="user_name" property="userName"/>
    <collection property="roles"
                ofType="com.example.entity.Role"
                select="com.example.mapper.RoleMapper.selectByUserId"
                column="id"                          <!-- ★ 把用户的 id 传给子查询 -->
                fetchType="lazy"/>
</resultMap>
```

#### 方式 3：多对多（本质是两个一对多）

```xml
<!-- 订单 → 订单项 → 商品（三层嵌套） -->
<resultMap id="OrderDetailMap" type="Order">
    <id     column="o_id"       property="id"/>
    <result column="o_no"       property="orderNo"/>
    <result column="o_amount"   property="amount"/>

    <!-- 订单项（一对多） -->
    <collection property="items" ofType="OrderItem">
        <id     column="i_id"        property="id"/>
        <result column="i_qty"       property="quantity"/>
        <result column="i_price"     property="price"/>

        <!-- ★ 商品（一对一，嵌套在集合内） -->
        <association property="product" javaType="Product">
            <id     column="p_id"     property="id"/>
            <result column="p_name"   property="productName"/>
            <result column="p_price"  property="price"/>
        </association>
    </collection>
</resultMap>

<select id="selectOrderDetail" resultMap="OrderDetailMap">
    SELECT
        o.id AS o_id, o.order_no AS o_no, o.amount AS o_amount,
        i.id AS i_id, i.quantity AS i_qty, i.price AS i_price,
        p.id AS p_id, p.product_name AS p_name, p.price AS p_price
    FROM t_order o
    LEFT JOIN t_order_item i ON o.id = i.order_id
    LEFT JOIN t_product p    ON i.product_id = p.id
    WHERE o.id = #{orderId}
</select>
```

### 2.5 延迟加载（Lazy Loading）

```yaml
# ─── 全局配置 ───
mybatis:
  configuration:
    lazy-loading-enabled: true          # ★ 开启延迟加载（默认 false）
    aggressive-lazy-loading: false      # ★ false = 按需加载（true = 调用任意方法都加载全部）
    lazy-load-trigger-methods: equals,clone,hashCode,toString   # 触发加载的方法
```

```xml
<!-- 单个关联的加载策略（★ 覆盖全局配置） -->
<association property="dept" select="selectDept" column="dept_id" fetchType="lazy"/>
<collection property="roles" select="selectRoles" column="id" fetchType="eager"/>
<!-- fetchType: lazy（延迟）/ eager（立即） -->
```

**延迟加载的原理：**

```java
// MyBatis 用【动态代理】实现延迟加载
// ① 查询 User 时，dept 字段不查询，而是设置一个【代理对象】
//    （CGLIB/Javassist 增强，内部持有 Configuration 和嵌套查询的信息）
// ② 当调用 user.getDept().getDeptName() 时：
//    代理拦截 getDeptName() → 检查 dept 是否已加载
//    未加载 → 执行嵌套查询 selectDept → 填充真实对象 → 返回
// ③ 之后再次调用不会重复查询

// 验证代理（开启延迟加载后）
User user = userMapper.selectUserLazy(1L);
System.out.println(user.getClass());
// class com.example.entity.User$$EnhancerByCGLIB$$xxx        ← ★ 是代理对象！
System.out.println(user.getDept());                           // 此时才触发查询
```

**延迟加载的坑：**

| 坑 | 现象 | 解决 |
| --- | --- | --- |
| ★ **SqlSession 已关闭才访问关联属性** | `LazyInitializationException` 或数据为 null | 在同一事务/SqlSession 内访问；整合 Spring 后事务内没问题 |
| 序列化代理对象 | JSON 序列化时触发所有懒加载（性能差）或报错 | VO 中不含懒加载字段，或转 VO 时显式赋值 |
| N+1 问题 | 列表查询触发 N 次子查询 | 列表用 JOIN；或批量查询 + Map 组装 |
| `aggressiveLazyLoading=true` | 调用任意 getter 都加载全部关联 | 设为 false |
| toString() 触发全部加载 | 日志打印对象时触发所有懒加载 | `lazy-load-trigger-methods` 去掉 toString |

### 2.6 TypeHandler（类型处理器）★★★★★

**处理 Java 类型 ↔ JDBC 类型的转换，常见于 JSON 字段、枚举、加密字段。**

```java
// ─── 示例 1：JSON 字段 ↔ 对象（★ 最常用）───
@MappedTypes({UserExtInfo.class, List.class})           // 处理的 Java 类型
@MappedJdbcTypes(JdbcType.VARCHAR)                       // 对应的 JDBC 类型
public class JsonTypeHandler<T> extends BaseTypeHandler<T> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final Class<T> type;

    public JsonTypeHandler(Class<T> type) {              // ★ MyBatis 会传入类型
        if (type == null) throw new IllegalArgumentException("Type argument cannot be null");
        this.type = type;
    }

    /** Java → JDBC（写入） */
    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, T parameter, JdbcType jdbcType)
            throws SQLException {
        try {
            ps.setString(i, MAPPER.writeValueAsString(parameter));      // ★ 对象转 JSON 字符串
        } catch (JsonProcessingException e) {
            throw new SQLException("JSON 序列化失败", e);
        }
    }

    /** JDBC → Java（读取） */
    @Override
    public T getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return parse(rs.getString(columnName));
    }
    @Override
    public T getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return parse(rs.getString(columnIndex));
    }
    @Override
    public T getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return parse(cs.getString(columnIndex));
    }

    private T parse(String json) throws SQLException {
        if (json == null || json.isBlank()) return null;
        try {
            return MAPPER.readValue(json, type);
        } catch (Exception e) {
            throw new SQLException("JSON 反序列化失败: " + json, e);
        }
    }
}

// ─── 示例 2：List<String> ↔ 逗号分隔字符串 ───
@MappedTypes(List.class)
@MappedJdbcTypes(JdbcType.VARCHAR)
public class StringListTypeHandler extends BaseTypeHandler<List<String>> {
    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<String> parameter, JdbcType t)
            throws SQLException {
        ps.setString(i, String.join(",", parameter));
    }
    @Override
    public List<String> getNullableResult(ResultSet rs, String col) throws SQLException {
        return split(rs.getString(col));
    }
    @Override
    public List<String> getNullableResult(ResultSet rs, int idx) throws SQLException {
        return split(rs.getString(idx));
    }
    @Override
    public List<String> getNullableResult(CallableStatement cs, int idx) throws SQLException {
        return split(cs.getString(idx));
    }
    private List<String> split(String s) {
        return (s == null || s.isBlank()) ? Collections.emptyList()
                                          : Arrays.asList(s.split(","));
    }
}

// ─── 示例 3：字段加解密（★ 敏感数据）───
public class EncryptTypeHandler extends BaseTypeHandler<String> {
    private static final AesUtils AES = new AesUtils(System.getenv("ENCRYPT_KEY"));

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, String parameter, JdbcType t)
            throws SQLException {
        ps.setString(i, AES.encrypt(parameter));         // ★ 写入时加密
    }
    @Override
    public String getNullableResult(ResultSet rs, String col) throws SQLException {
        return AES.decrypt(rs.getString(col));            // ★ 读取时解密
    }
    // ... 其他两个方法同理
}
// ⚠️ 加密字段无法用 LIKE 查询、无法建普通索引（可用「盲索引」方案）

// ─── 示例 4：枚举处理（★ 三种方式）───
// 方式 1：MyBatis 内置的 EnumTypeHandler（存 name，如 "PAID"）—— 默认
// 方式 2：MyBatis 内置的 EnumOrdinalTypeHandler（存 ordinal，如 1）—— ⚠️ 危险，枚举顺序变了就错乱
// 方式 3：★ 自定义（实现 IEnum 或用 @EnumValue，MyBatis-Plus 提供）
@MappedTypes(OrderStatus.class)
public class OrderStatusTypeHandler extends BaseTypeHandler<OrderStatus> {
    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, OrderStatus p, JdbcType t)
            throws SQLException {
        ps.setInt(i, p.getCode());                       // ★ 存自定义 code
    }
    @Override
    public OrderStatus getNullableResult(ResultSet rs, String col) throws SQLException {
        return OrderStatus.ofCode(rs.getInt(col));        // ★ 按 code 反查
    }
    // ...
}

// ─── 示例 5：Base64/byte[] 处理、几何类型、JSONB（PostgreSQL）等 ───
```

**注册 TypeHandler：**

```yaml
# ─── 方式 1：包扫描（★ 推荐）───
mybatis:
  type-handlers-package: com.example.mybatis.typehandler
```

```xml
<!-- ─── 方式 2：mybatis-config.xml 逐个注册 ─── -->
<typeHandlers>
    <package name="com.example.mybatis.typehandler"/>
    <typeHandler handler="com.example.mybatis.typehandler.JsonTypeHandler"
                 javaType="com.example.entity.UserExtInfo" jdbcType="VARCHAR"/>
</typeHandlers>

<!-- ─── 方式 3：在 resultMap / 参数中指定（★ 精确控制）─── -->
<resultMap id="UserMap" type="User">
    <result column="ext_info" property="extInfo"
            typeHandler="com.example.mybatis.typehandler.JsonTypeHandler"/>
    <result column="tags" property="tags"
            typeHandler="com.example.mybatis.typehandler.StringListTypeHandler"/>
    <result column="id_card" property="idCard"
            typeHandler="com.example.mybatis.typehandler.EncryptTypeHandler"/>
</resultMap>

<!-- 参数中使用 -->
<insert id="insert">
    INSERT INTO t_user (user_name, ext_info, id_card) VALUES
    (#{userName},
     #{extInfo, typeHandler=com.example.mybatis.typehandler.JsonTypeHandler},
     #{idCard, javaType=string, jdbcType=VARCHAR, typeHandler=...EncryptTypeHandler})
</insert>

<!-- ★ WHERE 条件中使用（容易漏！） -->
<select id="selectByIdCard" resultType="User">
    SELECT * FROM t_user
    WHERE id_card = #{idCard, typeHandler=com.example.mybatis.typehandler.EncryptTypeHandler}
</select>
```

```java
// ─── 方式 4：JavaConfig 注册 ───
@Bean
public ConfigurationCustomizer typeHandlerCustomizer() {
    return configuration -> {
        configuration.getTypeHandlerRegistry()
                .register(UserExtInfo.class, JdbcType.VARCHAR, new JsonTypeHandler<>(UserExtInfo.class));
        configuration.getTypeHandlerRegistry()
                .register(new EncryptTypeHandler());
    };
}
```

## 3. 参数处理与 @Param ★★★★★

```java
// ─── 单参数 ───
User selectById(Long id);
// XML 中可用任意名称引用：#{id}、#{value}、#{abc} 都可以（★ 但不推荐，语义不清）
// 推荐：#{id} 与参数名一致

// ─── 单个 POJO ───
int insert(User user);
// XML 中用属性名：#{userName}、#{age}
// 嵌套属性：#{address.city}

// ─── ★ 多个参数（必须用 @Param！）───
// ❌ 不加 @Param：只能用 arg0/arg1 或 param1/param2（可读性极差，且 JDK 版本相关）
User select(String name, Integer age);
// → #{arg0}、#{arg1}  或  #{param1}、#{param2}

// ✅ 加 @Param（★ 强制规约）
User select(@Param("name") String name, @Param("age") Integer age);
// → #{name}、#{age}

// ─── Map 参数 ───
User selectByMap(Map<String, Object> map);
// XML 中用 key：#{name}、#{age}

// ─── 集合参数（★ foreach 的 collection 名称规则）───
List<User> selectByIds(List<Long> ids);              // collection="list"（★ 固定名）
List<User> selectByIds(Long[] ids);                  // collection="array"（★ 固定名）
List<User> selectByIds(Set<Long> ids);               // ❌ 不支持！要转 List
List<User> selectByIds(@Param("ids") List<Long> ids); // ★ collection="ids"（推荐）
List<User> selectByIds(Collection<Long> ids);         // collection="collection"

// ─── 混合参数（POJO + 其他）───
List<User> selectByPage(@Param("query") UserQuery query,
                        @Param("offset") int offset,
                        @Param("limit") int limit);
// XML：#{query.userName}、#{offset}、#{limit}

// ─── RowBounds（★ 逻辑分页，不推荐）───
List<User> selectAll(RowBounds rowBounds);            // RowBounds 不用 @Param
// 使用：new RowBounds(offset, limit)
// ⚠️ RowBounds 是【内存分页】：把全部数据查出来再截取！大数据量会 OOM
//    ✅ 用 PageHelper 或 SQL 的 LIMIT

// ─── ResultHandler（流式处理，★ 大数据量必备）───
void selectAll(ResultHandler<User> handler);
// 使用
mapper.selectAll(ctx -> {
    User user = ctx.getResultObject();
    processOne(user);                                  // 逐条处理，不占内存
});

// ─── Cursor（★ JDK 8+ 的流式查询，更优雅）───
@Select("SELECT * FROM t_user")
@Options(resultSetType = ResultSetType.FORWARD_ONLY, fetchSize = 1000)   // ★ 必须配
Cursor<User> scanAll();
// 使用（★ 必须在事务或 SqlSession 打开期间）
@Transactional(readOnly = true)
public void processAll() {
    try (Cursor<User> cursor = userMapper.scanAll()) {
        cursor.forEach(user -> processOne(user));      // 惰性迭代，内存中只有一条
        // 或 cursor.stream().filter(...).forEach(...);
    }
}
// ⚠️ Cursor 需要：① SqlSession 保持打开（用 @Transactional 或在 SqlSessionTemplate 中）
//                ② fetchSize 设置合理（MySQL 需要 Integer.MIN_VALUE 才真正流式！）
// MySQL 的真流式查询：
@Options(resultSetType = ResultSetType.FORWARD_ONLY, fetchSize = Integer.MIN_VALUE)
```

```xml
<!-- ─── 多参数在 XML 中的引用 ─── -->
<select id="select" resultType="User">
    SELECT * FROM t_user
    WHERE user_name = #{name} AND age = #{age}
</select>

<select id="selectByPage" resultType="User">
    SELECT * FROM t_user
    <where>
        <if test="query.userName != null">AND user_name LIKE CONCAT('%', #{query.userName}, '%')</if>
        <if test="query.status != null">AND status = #{query.status}</if>
    </where>
    LIMIT #{offset}, #{limit}
</select>
```

**`<if test>` 中多参数的判断：**

```xml
<!-- ✅ 正确：直接用 @Param 的名字 -->
<if test="name != null and age != null">

<!-- ✅ POJO 的属性 -->
<if test="query.userName != null">

<!-- ❌ 错误：未加 @Param 时用 arg0/param1（可读性差） -->
<if test="arg0 != null">

<!-- ★ 特殊：只有一个 Map 参数时，test 中直接用 key -->
<if test="status != null">       <!-- map.get("status") -->
```

## 4. 特殊字符与 CDATA

```xml
<!-- ─── XML 中的特殊字符必须转义 ─── -->
<!-- < → &lt;    > → &gt;    & → &amp;    ' → &apos;    " → &quot; -->

<select id="selectByAge" resultType="User">
    SELECT * FROM t_user
    WHERE age &gt;= 18              <!-- ✅ age >= 18 -->
      AND age &lt;= 60              <!-- ✅ age <= 60 -->
      AND name &lt;&gt; 'admin'       <!-- ✅ name <> 'admin' -->
</select>
<!-- 注意：> 可以不转义（XML 中合法），但 < 必须转义！ -->

<!-- ─── ★ CDATA 区（推荐，可读性好）─── -->
<select id="selectByAge2" resultType="User">
    SELECT * FROM t_user
    <![CDATA[
    WHERE age >= 18 AND age <= 60
      AND create_time < DATE_SUB(NOW(), INTERVAL 1 DAY)
      AND remark <> ''
    ]]>
</select>

<!-- ─── CDATA 与动态标签混用（★ 常见写法）─── -->
<select id="selectMixed" resultType="User">
    SELECT * FROM t_user
    <where>
        <![CDATA[ age >= #{minAge} ]]>
        <if test="maxAge != null">
            <![CDATA[ AND age <= #{maxAge} ]]>
        </if>
        <if test="name != null">
            AND user_name LIKE CONCAT('%', #{name}, '%')
        </if>
    </where>
</select>
<!-- ⚠️ CDATA 内部【不能】使用 MyBatis 的动态标签（<if>、<foreach> 等）！
     因为 CDATA 的内容被当作纯文本，不会被 XML 解析器处理 -->
<!-- ❌ 错误示范 -->
<![CDATA[
    <if test="x != null">AND x = #{x}</if>      <!-- 会被当成 SQL 文本输出！ -->
]]>
```

## 5. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 不用 `<where>` 手写 WHERE + if | `WHERE AND xxx` 语法错误 | 用 `<where>` 标签 |
| 2 | 不用 `<set>` 手写 SET + if | `SET , xxx` 或 `SET WHERE` 语法错误 | 用 `<set>` 标签 |
| 3 | `<if test="type == 'A'">` | 条件恒不成立 | 单引号包 test，双引号包字符串：`test='type == "A"'` |
| 4 | 字符串只判 null 不判空串 | `LIKE '%%'` 全表扫描 | `name != null and name != ''` |
| 5 | 集合判空用 `size` 而非 `size()` | OGNL 报错 | `list != null and list.size() > 0` |
| 6 | 数组判空用 `size()` | 报错 | 数组用 `arr.length` |
| 7 | foreach 未加 @Param | `Parameter 'ids' not found` | 加 `@Param("ids")`，或用 `list`/`array` |
| 8 | Set 类型参数 | foreach 找不到 | Set 不支持，转 List |
| 9 | foreach 内嵌 `<if>` 跳过元素 | 多余逗号，SQL 语法错误 | Java 层先过滤 |
| 10 | IN 的元素过多 | SQL 过长、解析慢、Oracle 超 1000 限制 | ★ 分批（500~1000） |
| 11 | 批量插入单条 SQL 过大 | `PacketTooBigException` | 分批 + 调 `max_allowed_packet` |
| 12 | 未开 `rewriteBatchedStatements` | 批量插入性能提升不明显 | JDBC URL 加该参数 |
| 13 | `SELECT *` | 无法用覆盖索引、传输浪费 | 用 `<sql id="Base_Column_List">` |
| 14 | `<` 未转义 | XML 解析错误 | `&lt;` 或 `<![CDATA[ ]]>` |
| 15 | CDATA 内用动态标签 | 标签被当文本输出 | CDATA 外写标签，内写纯 SQL |
| 16 | resultMap 缺少 `<id>` | 嵌套映射产生重复对象、性能差 | ★ 主键必须用 `<id>` |
| 17 | `collection` 用 `javaType` 而非 `ofType` | 映射错误 | `ofType` 指定元素类型 |
| 18 | JOIN 后同名列未加别名 | 值互相覆盖 | 用 `AS u_id`、`AS d_id` 区分 |
| 19 | 嵌套查询导致 N+1 | 列表查询性能极差 | 改用 JOIN，或批量查询 + Map 组装 |
| 20 | 延迟加载在 Session 关闭后访问 | `LazyInitializationException` / null | 在事务内访问 |
| 21 | 延迟加载对象被 JSON 序列化 | 触发全部加载或序列化失败 | 转 VO |
| 22 | `RowBounds` 做分页 | 内存分页，大数据量 OOM | PageHelper 或 SQL LIMIT |
| 23 | TypeHandler 只在 resultMap 配了 | WHERE 条件中的加密字段查询失效 | 参数处也要指定 typeHandler |
| 24 | 乐观锁更新未检查影响行数 | 并发覆盖无感知 | `if (rows == 0) throw` |
| 25 | `${}` 用于排序未白名单 | **SQL 注入** | 列名/方向都用白名单映射 |
| 26 | 动态表名未校验 | SQL 注入 | 正则/白名单校验 |
| 27 | `selectOne` 返回多条 | `TooManyResultsException` | 加 LIMIT 1 或用 selectList |
| 28 | 多参数未加 @Param 用 arg0 | 可读性差、易错 | ★ 一律加 `@Param` |
| 29 | `callSettersOnNulls` 未开 | 返回 Map 时 null 字段的 key 丢失 | 开启该配置 |
| 30 | Cursor 未在事务中使用 | `Cursor is closed` | 加 `@Transactional` |

---

## 关联笔记

- 上一篇：[[后端/MyBatis/MyBatis入门与核心配置]]
- 下一篇：[[后端/MyBatis/缓存机制与插件开发]]
- 相关：[[后端/MyBatis/MyBatisPlus]]（自动 CRUD、Lambda 条件构造器）
- 数据库：[[后端/数据库/MySQL/高级查询与函数]]、[[后端/数据库/MySQL/索引与执行计划]]
- 安全：[[后端/JavaWeb/JWT认证与Web安全]]（SQL 注入防护）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
