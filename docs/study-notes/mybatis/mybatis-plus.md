---
title: "MyBatisPlus"
aliases:
  - "MyBatis-Plus"
  - "BaseMapper"
  - "条件构造器"
tags:
  - "后端"
  - "java"
  - "mybatis"
  - "mybatis-plus"
category: "后端"
folder: "MyBatis"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/MyBatis/MyBatis入门与核心配置]]"
  - "[[后端/MyBatis/动态SQL与结果映射]]"
  - "[[后端/MyBatis/缓存机制与插件开发]]"
  - "[[后端/SpringBoot/整合数据访问层]]"
created: 2026-09-07
updated: 2026-09-07
---

# MyBatis-Plus

> **MyBatis-Plus（MP）是 MyBatis 的增强工具**：在 MyBatis 基础上只做增强不做改变，引入它不会对现有 MyBatis 工程产生任何影响。核心价值是「**单表 CRUD 零 SQL**」+「强大的条件构造器」+「丰富的插件」。

## 1. MyBatis-Plus 概述

### 1.1 MP 解决了什么

```java
// ─── 原生 MyBatis：简单的单表 CRUD 也要写 XML ───
// UserMapper.java
public interface UserMapper {
    User selectById(Long id);
    int insert(User user);
    int updateById(User user);
    int deleteById(Long id);
    List<User> selectAll();
}
// UserMapper.xml（每个方法都要写 SQL）
<select id="selectById" resultType="User">SELECT * FROM t_user WHERE id = #{id}</select>
<insert id="insert">INSERT INTO t_user (...) VALUES (...)</insert>
...

// ─── MyBatis-Plus：继承 BaseMapper 就有 17+ 个方法，零 SQL ───
public interface UserMapper extends BaseMapper<User> {
    // ★ 空的！自动拥有 selectById/insert/updateById/deleteById/selectList/selectPage...
}
// 使用
User user = userMapper.selectById(1L);
userMapper.insert(user);
List<User> list = userMapper.selectList(
    new LambdaQueryWrapper<User>()
        .eq(User::getStatus, 1)
        .like(User::getUserName, "张")
        .orderByDesc(User::getCreateTime));
```

**MP 的核心能力：**

| 能力 | 说明 |
| --- | --- |
| **BaseMapper** | ★ 单表 CRUD 零 SQL（17+ 内置方法） |
| **IService / ServiceImpl** | Service 层的 CRUD 封装（批量、链式） |
| **条件构造器** | ★ `Wrapper` 链式构建查询条件（Lambda 类型安全） |
| **自动 CRUD** | 主键生成、逻辑删除、乐观锁、自动填充 |
| **分页插件** | ★ 物理分页（自动 count + limit） |
| **代码生成器** | ★ 一键生成 Entity/Mapper/Service/Controller |
| **性能分析插件** | SQL 执行时间监控 |
| **多租户插件** | 自动拼接 tenant_id |
| **动态表名** | 分表支持 |
| **数据权限** | 行级权限拦截 |

### 1.2 MP vs MyBatis vs JPA

| 对比 | MyBatis | **MyBatis-Plus** | JPA/Hibernate |
| --- | --- | --- | --- |
| 单表 CRUD | 手写 SQL/XML | ★ **零 SQL** | 零 SQL |
| 复杂查询 | ★ 手写 SQL（灵活） | 手写 SQL + Wrapper | HQL/Criteria（受限） |
| 学习成本 | 中 | ★ **低** | 高 |
| SQL 可控性 | ★ 完全可控 | ★ 完全可控 | 弱 |
| 关联查询 | resultMap 手写 | 同 MyBatis | ★ 自动（懒加载） |
| 适用 | 复杂 SQL 场景 | ★ **国内主流** | 领域驱动、国外 |

> 【定位】MP **不是替代 MyBatis，而是增强**。复杂 SQL 仍写在 XML 中，简单单表 CRUD 用 MP 的 BaseMapper。二者共存。

## 2. 快速入门

### 2.1 依赖与配置

```xml
<!-- Spring Boot 3（JDK 17+） -->
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-spring-boot3-starter</artifactId>   <!-- ★ Boot 3 用这个 -->
    <version>3.5.5</version>
</dependency>
<!-- Spring Boot 2 用：mybatis-plus-boot-starter -->
<!-- 代码生成器（可选） -->
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-generator</artifactId>
    <version>3.5.5</version>
</dependency>
<dependency>
    <groupId>org.apache.velocity</groupId>
    <artifactId>velocity-engine-core</artifactId>   <!-- 模板引擎 -->
    <version>2.3</version>
</dependency>
```

```yaml
# application.yml
mybatis-plus:
  # Mapper XML 位置（复杂 SQL 仍写在 XML）
  mapper-locations: classpath*:mapper/**/*.xml
  # 实体类别名包
  type-aliases-package: com.example.entity
  # 全局配置
  global-config:
    banner: false                              # 关闭启动 banner
    db-config:
      id-type: assign_id                       # ★ 主键策略：雪花算法（默认）
      logic-delete-field: deleted              # ★ 逻辑删除字段名
      logic-delete-value: 1                    # 已删除值
      logic-not-delete-value: 0                # 未删除值
      table-prefix: t_                         # ★ 表前缀（t_user → User）
      insert-strategy: not_null                # ★ 插入策略：只插入非 null 字段
      update-strategy: not_null                # ★ 更新策略：只更新非 null 字段
      select-strategy: not_empty
      where-strategy: not_empty
    # 元对象处理器（自动填充）
  configuration:
    map-underscore-to-camel-case: true         # ★ 驼峰转换（MP 默认 true）
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl    # 开发打印 SQL
    cache-enabled: false                       # 二级缓存（建议关）
    call-setters-on-nulls: true
    default-enum-type-handler: com.baomidou.mybatisplus.core.handlers.MybatisEnumTypeHandler

# Mapper 扫描（也可用 @MapperScan 注解）
```

```java
// ─── 启动类 ───
@SpringBootApplication
@MapperScan("com.example.mapper")               // ★ 扫描 Mapper
public class Application {
    public static void main(String[] args) { SpringApplication.run(Application.class, args); }
}

// ─── ★ 配置分页插件（必须！否则分页失效）───
@Configuration
public class MybatisPlusConfig {

    /** ★ 核心插件：分页、乐观锁、防全表更新、多租户、数据权限 */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();

        // ① ★ 分页插件（★ 必须指定数据库类型）
        PaginationInnerInterceptor pagination = new PaginationInnerInterceptor(DbType.MYSQL);
        pagination.setMaxLimit(500L);                    // ★ 单页最大条数（防止 pageSize=999999 拖垮数据库）
        pagination.setOverflow(false);                   // 页码溢出是否回到首页
        interceptor.addInnerInterceptor(pagination);

        // ② ★ 乐观锁插件
        interceptor.addInnerInterceptor(new OptimisticLockerInnerInterceptor());

        // ③ ★ 防全表更新删除插件（★ 生产强烈建议，防止忘记 where 条件的灾难）
        BlockAttackInnerInterceptor blockAttack = new BlockAttackInnerInterceptor();
        interceptor.addInnerInterceptor(blockAttack);

        // ④ 多租户插件（顺序：多租户 → 分页）
        // interceptor.addInnerInterceptor(new TenantLineInnerInterceptor(new MyTenantHandler()));

        // ⑤ 数据权限插件
        // interceptor.addInnerInterceptor(new DataPermissionInterceptor(...));

        // ⑥ 动态表名插件（分表）
        // interceptor.addInnerInterceptor(new DynamicTableNameInnerInterceptor());

        return interceptor;
    }

    /** ★ 插件顺序很重要：多租户 → 动态表名 → 分页 → 乐观锁 → 防全表更新 */
}
```

> 【坑】**分页插件必须配置，否则 `selectPage` 返回全部数据且不报错**。这是 MP 最常见的坑。另外插件有**顺序要求**：多租户/动态表名要在分页之前（先改写表名再分页）。

### 2.2 实体类注解 ★★★★★

```java
package com.example.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ★ @TableName：指定表名（表名与类名不一致时必须）
 */
@Data
@TableName(value = "sys_user",                    // ★ 表名
           keepGlobalPrefix = false,               // 是否保留全局前缀
           autoResultMap = true,                   // ★ 自动构建 resultMap（有 TypeHandler 时必须）
           schema = "mall",                         // 数据库 schema
           excludeProperty = {"tempField"})         // 排除某些属性不映射
public class User implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * ★ @TableId：主键
     */
    @TableId(value = "id",                          // 主键列名
             type = IdType.ASSIGN_ID)                // ★ 主键生成策略
    private Long id;

    /** ★ @TableField：普通字段（列名不一致、类型处理、填充策略等） */
    @TableField(value = "user_name")                 // 列名（开启驼峰转换后可省略）
    private String userName;

    /** ★ 非数据库字段（不参与 SQL） */
    @TableField(exist = false)                       // ★ 表中不存在此列
    private String deptName;

    /** ★ 字段填充策略（自动填充 createTime/updateTime） */
    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(value = "update_time", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableField(value = "create_by", fill = FieldFill.INSERT)
    private String createBy;

    @TableField(value = "update_by", fill = FieldFill.INSERT_UPDATE)
    private String updateBy;

    /** ★ 乐观锁版本字段 */
    @Version
    @TableField("version")
    private Integer version;

    /** ★ 逻辑删除字段 */
    @TableLogic
    @TableField("deleted")
    private Integer deleted;

    /** ★ 更新时的 SQL 片段（如自增、数据库函数） */
    @TableField(value = "read_count", update = "read_count + 1")     // ★ 每次更新 +1
    private Integer readCount;

    /** ★ 条件构造（whereStrategy/insertStrategy/updateStrategy） */
    @TableField(whereStrategy = FieldStrategy.NOT_EMPTY)
    private String remark;

    /** ★ 枚举字段 */
    @TableField("status")
    private UserStatus status;                        // 配合 @EnumValue

    /** ★ JSON 字段（需要 autoResultMap=true） */
    @TableField(value = "ext_info", typeHandler = JacksonTypeHandler.class)
    private UserExtInfo extInfo;

    /** ★ 敏感字段（脱敏，MP 3.5.3+） */
    @TableField(value = "phone", typeHandler = SensitiveTypeHandler.class)
    private String phone;

    /** ★ select=false：查询时不返回该字段（如密码） */
    @TableField(value = "password", select = false)
    private String password;

    private Integer age;
    private BigDecimal balance;
}
```

**主键策略（IdType）★★★★★：**

| IdType | 说明 | 适用 |
| --- | --- | --- |
| **`ASSIGN_ID`**（默认） | ★ **雪花算法**生成 Long（分布式唯一） | ★ 分布式系统首选 |
| `ASSIGN_UUID` | 生成 32 位 UUID 字符串 | 需要字符串主键 |
| **`AUTO`** | ★ 数据库自增 | 单机、简单场景 |
| `INPUT` | 手动输入（用户自己设） | 业务主键 |
| `NONE` | 无策略（跟随全局） | — |
| ~~`ID_WORKER`~~ | 已废弃（同 ASSIGN_ID） | — |
| ~~`UUID`~~ | 已废弃（同 ASSIGN_UUID） | — |

```java
// ─── 雪花算法（ASSIGN_ID）的原理与坑 ───
// MP 的默认雪花算法（Sequence 类）：
// 64 位 = 1 符号位 + 41 时间戳 + 5 数据中心ID + 5 机器ID + 12 序列号
// 特点：趋势递增（对 B+ 树索引友好）、分布式唯一、不依赖数据库
// ⚠️ 坑：★ 依赖机器时钟，时钟回拨会导致 ID 重复或抛异常
//      ⚠️ 生成的 ID 是 Long（19 位），★ 传给前端 JS 会精度丢失！
//         → 必须配置 Jackson 把 Long 序列化为 String

// Jackson 配置（★ 必做）
@Configuration
public class JacksonConfig {
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer longToString() {
        return builder -> {
            builder.serializerByType(Long.class, ToStringSerializer.instance);
            builder.serializerByType(Long.TYPE, ToStringSerializer.instance);
        };
    }
}
// 或在字段上加 @JsonSerialize(using = ToStringSerializer.class)

// ─── 数据库自增（AUTO）───
@TableId(type = IdType.AUTO)
private Long id;
// 建表：id BIGINT AUTO_INCREMENT PRIMARY KEY

// ─── 手动指定（INPUT）───
@TableId(type = IdType.INPUT)
private String orderNo;         // 业务主键，插入前自己赋值
```

### 2.3 自定义枚举处理

```java
// ─── 方式 1：实现 IEnum 接口 ───
public enum OrderStatus implements IEnum<Integer> {
    PENDING(0, "待支付"),
    PAID(1, "已支付"),
    SHIPPED(2, "已发货"),
    COMPLETED(3, "已完成"),
    CANCELLED(4, "已取消");

    private final Integer code;
    private final String desc;
    OrderStatus(Integer code, String desc) { this.code = code; this.desc = desc; }

    @Override
    public Integer getValue() { return code; }        // ★ 存到数据库的值
    public String getDesc() { return desc; }
}

// ─── 方式 2：@EnumValue 注解（★ 更灵活，推荐）───
@Getter
public enum UserStatus {
    DISABLED(0, "禁用"),
    ENABLED(1, "启用");

    @EnumValue                                        // ★ 标记存数据库的字段
    private final Integer code;
    private final String desc;

    UserStatus(Integer code, String desc) { this.code = code; this.desc = desc; }

    // ★ 返回给前端时用 desc（配合 @JsonValue）
    @JsonValue
    public String getDesc() { return desc; }

    @JsonCreator                                       // 前端传 code 时反序列化
    public static UserStatus of(Integer code) {
        for (UserStatus s : values()) if (s.code.equals(code)) return s;
        throw new IllegalArgumentException("未知状态码: " + code);
    }
}
// 需配置：default-enum-type-handler: com.baomidou.mybatisplus.core.handlers.MybatisEnumTypeHandler
// 或 @EnumValue 会自动被 MP 识别

// ─── 方式 3：原生 MyBatis 的 EnumTypeHandler（存 name）───
// 不推荐（存字符串占空间，改枚举名会导致数据错乱）
```

## 3. BaseMapper 的 CRUD 方法 ★★★★★

```java
public interface UserMapper extends BaseMapper<User> {
    // ★ 继承即拥有以下所有方法，无需写任何 SQL
}
```

| 分类 | 方法 | 说明 |
| --- | --- | --- |
| **插入** | `int insert(T entity)` | ★ 插入（主键回填、null 字段不插入） |
| **删除** | `int deleteById(Serializable id)` | 按主键删除 |
| | `int deleteById(T entity)` | ★ 按实体删除（3.4.4+，用实体的主键） |
| | `int deleteByMap(Map<String,Object> map)` | 按 Map 条件删除 |
| | `int delete(Wrapper<T> queryWrapper)` | ★ 按条件删除 |
| | `int deleteBatchIds(Collection<?> ids)` | ★ 批量按 ID 删除 |
| **更新** | `int updateById(T entity)` | ★ 按主键更新（null 字段不更新） |
| | `int update(T entity, Wrapper<T> updateWrapper)` | ★ 按条件更新 |
| **查询单个** | `T selectById(Serializable id)` | ★ 按主键查询 |
| | `T selectOne(Wrapper<T> queryWrapper)` | ★ 查一条（多条抛异常） |
| | `T selectOne(Wrapper, boolean throwEx)` | ★ 3.5.4+，多条不抛异常 |
| **查询多个** | `List<T> selectBatchIds(Collection<?> ids)` | ★ 批量按 ID 查询 |
| | `List<T> selectByMap(Map<String,Object> map)` | 按 Map 条件查询 |
| | `List<T> selectList(Wrapper<T> queryWrapper)` | ★ 按条件查询列表 |
| | `List<T> selectObjs(Wrapper<T> queryWrapper)` | ★ 只查第一列 |
| | `List<Map<String,Object>> selectMaps(Wrapper)` | ★ 查成 Map |
| **统计** | `Long selectCount(Wrapper<T> queryWrapper)` | ★ 统计条数 |
| **分页** | `<P extends IPage<T>> P selectPage(P page, Wrapper<T> queryWrapper)` | ★★ 分页查询 |
| | `<P extends IPage<Map>> P selectMapsPage(P page, Wrapper)` | 分页查 Map |
| **其他** | `boolean exists(Wrapper)` | 3.5.3.2+ 是否存在 |

```java
// ─── 使用示例 ───
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;

    public void demo() {
        // ─── 插入 ───
        User user = new User();
        user.setUserName("张三");
        user.setAge(20);
        userMapper.insert(user);
        System.out.println("回填的主键：" + user.getId());        // ★ 雪花 ID 自动回填

        // ─── 按 ID 查询 ───
        User u = userMapper.selectById(1L);

        // ─── 批量查询 ───
        List<User> users = userMapper.selectBatchIds(Arrays.asList(1L, 2L, 3L));

        // ─── 条件查询（Wrapper）───
        List<User> list = userMapper.selectList(
            new QueryWrapper<User>()
                .eq("status", 1)
                .like("user_name", "张")
                .ge("age", 18)
                .orderByDesc("create_time"));

        // ─── 查一条 ───
        User one = userMapper.selectOne(
            new QueryWrapper<User>().eq("user_name", "张三"));
        // ⚠️ 若查到多条会抛 TooManyResultsException，用 last("LIMIT 1") 或 selectList

        // ─── 统计 ───
        Long count = userMapper.selectCount(
            new QueryWrapper<User>().eq("status", 1));

        // ─── 只查某列 ───
        List<Object> names = userMapper.selectObjs(
            new QueryWrapper<User>().select("user_name").eq("status", 1));

        // ─── 查成 Map ───
        List<Map<String, Object>> maps = userMapper.selectMaps(
            new QueryWrapper<User>().select("dept_id", "COUNT(*) as cnt")
                                     .groupBy("dept_id"));

        // ─── 更新（按 ID）───
        User update = new User();
        update.setId(1L);
        update.setAge(21);
        userMapper.updateById(update);                    // ★ 只更新 age（其他 null 字段不更新）

        // ─── 更新（按条件）───
        userMapper.update(null,                             // entity 为 null，用 wrapper 的 set
            new UpdateWrapper<User>()
                .set("status", 0)
                .set("update_time", LocalDateTime.now())
                .eq("last_login_time", LocalDateTime.of(2020,1,1,0,0))
                .lt("last_login_time", LocalDateTime.now().minusYears(1)));

        // ─── 删除（逻辑删除自动处理）───
        userMapper.deleteById(1L);                          // ★ 实际执行 UPDATE deleted=1
        userMapper.deleteBatchIds(Arrays.asList(1L, 2L));
        userMapper.delete(new QueryWrapper<User>().eq("status", 0));

        // ─── 分页 ───
        Page<User> page = new Page<>(1, 10);                // 第 1 页，每页 10 条
        Page<User> result = userMapper.selectPage(page,
            new QueryWrapper<User>().eq("status", 1));
        result.getRecords();                                 // 当前页数据
        result.getTotal();                                   // ★ 总记录数
        result.getPages();                                   // 总页数
        result.getCurrent();                                 // 当前页码
        result.getSize();                                    // 每页大小
    }
}
```

## 4. 条件构造器 Wrapper ★★★★★

### 4.1 Wrapper 体系

```
Wrapper（抽象基类）
├── AbstractWrapper
│   ├── QueryWrapper<T>          ★ 查询（字符串列名）
│   ├── UpdateWrapper<T>         ★ 更新（字符串列名 + set）
│   ├── LambdaQueryWrapper<T>    ★★ 查询（Lambda，类型安全，推荐！）
│   └── LambdaUpdateWrapper<T>   ★★ 更新（Lambda）
└── AbstractLambdaWrapper
```

| | QueryWrapper | **LambdaQueryWrapper**（★ 推荐） |
| --- | --- | --- |
| 列名写法 | 字符串 `"user_name"` | ★ **方法引用 `User::getUserName`** |
| 类型安全 | ❌ 列名写错运行时才发现 | ✅ **编译期检查** |
| 重构友好 | ❌ 改字段名要全局搜字符串 | ✅ IDE 自动重构 |
| 推荐度 | 一般 | ★★ **强烈推荐** |

### 4.2 LambdaQueryWrapper 完整 API

```java
// ─── 创建方式 ───
LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
LambdaQueryWrapper<User> w2 = Wrappers.<User>lambdaQuery();           // ★ 工具类（推荐）
QueryWrapper<User> w3 = Wrappers.<User>query();
LambdaUpdateWrapper<User> w4 = Wrappers.<User>lambdaUpdate();
// 空条件查询所有
List<User> all = userMapper.selectList(Wrappers.emptyWrapper());
List<User> all2 = userMapper.selectList(null);                         // 传 null 也是查所有

// ─── ① 比较运算 ───
.eq(User::getStatus, 1)                        // = status = 1
.ne(User::getStatus, 0)                        // != 
.gt(User::getAge, 18)                          // >
.ge(User::getAge, 18)                          // >=
.lt(User::getAge, 60)                          // <
.le(User::getAge, 60)                          // <=
.between(User::getAge, 18, 60)                 // BETWEEN 18 AND 60
.notBetween(User::getAge, 18, 60)              // NOT BETWEEN
.like(User::getUserName, "张")                  // ★ LIKE '%张%'
.notLike(User::getUserName, "张")               // NOT LIKE
.likeLeft(User::getUserName, "张")              // ★ LIKE '%张'（左模糊，无法用索引！）
.likeRight(User::getUserName, "张")             // ★ LIKE '张%'（右模糊，可用索引）
.in(User::getId, Arrays.asList(1, 2, 3))       // IN
.in(User::getId, collection)                    // IN（集合）
.notIn(User::getId, ids)                        // NOT IN
.inSql(User::getId, "SELECT id FROM t_order")   // ★ IN (子查询)

// ─── ② null 判断 ───
.isNull(User::getEmail)                         // IS NULL
.isNotNull(User::getEmail)                       // IS NOT NULL

// ─── ③ 逻辑运算 ───
.and(w -> w.eq(User::getStatus, 1).or().eq(User::getAge, 18))     // AND (status=1 OR age=18)
.or(w -> w.eq(...))                             // OR (...)
.or()                                            // 下一个条件用 OR 连接
.nested(w -> w.eq(...).or().eq(...))            // 嵌套括号

// ─── ④ 排序 ───
.orderByAsc(User::getAge)                        // ORDER BY age ASC
.orderByDesc(User::getCreateTime)                // ORDER BY create_time DESC
.orderBy(true, true, User::getAge, User::getId)  // orderBy(condition, isAsc, columns...)
.last("LIMIT 1")                                 // ★ 拼接 SQL 到末尾（谨慎，有注入风险）

// ─── ⑤ 分组与聚合 ───
.groupBy(User::getDeptId)                        // GROUP BY dept_id
.groupBy(User::getDeptId, User::getStatus)       // 多字段分组
.having("COUNT(*) > {0}", 10)                    // HAVING COUNT(*) > 10
.select(User::getId, User::getUserName)          // ★ 指定查询的列

// ─── ⑥ ★ 条件生效开关（condition 参数，超实用！）───
// 每个条件方法第一个参数都可以是 boolean，为 true 才拼接该条件
.eq(StringUtils.isNotBlank(query.getStatus()), User::getStatus, query.getStatus())
.like(StringUtils.isNotBlank(query.getKeyword()), User::getUserName, query.getKeyword())
.ge(query.getMinAge() != null, User::getAge, query.getMinAge())
.le(query.getMaxAge() != null, User::getAge, query.getMaxAge())
.in(query.getDeptIds() != null && !query.getDeptIds().isEmpty(),
    User::getDeptId, query.getDeptIds())
// ★ 这优雅地解决了「动态条件」，不用写一堆 if

// ─── ⑦ 其他 ───
.exists("SELECT 1 FROM t_order WHERE user_id = t_user.id")   // EXISTS 子查询
.notExists(...)
.apply("date_format(create_time, '%Y-%m-%d') = {0}", date)   // ★ 拼接 SQL 函数（{0} 防注入）
.setSql("read_count = read_count + 1")                       // UpdateWrapper 的自定义 SQL

// ─── 综合示例：动态查询条件构建 ───
public Page<UserVO> pageUsers(UserQuery query) {
    LambdaQueryWrapper<User> wrapper = Wrappers.<User>lambdaQuery()
        // 关键字模糊搜索（多字段 OR）
        .and(StringUtils.isNotBlank(query.getKeyword()),
             w -> w.like(User::getUserName, query.getKeyword())
                   .or().like(User::getPhone, query.getKeyword())
                   .or().like(User::getEmail, query.getKeyword()))
        // 精确条件
        .eq(query.getStatus() != null, User::getStatus, query.getStatus())
        .eq(query.getDeptId() != null, User::getDeptId, query.getDeptId())
        // 范围条件
        .ge(query.getStartTime() != null, User::getCreateTime, query.getStartTime())
        .le(query.getEndTime() != null, User::getCreateTime, query.getEndTime())
        .in(!CollectionUtils.isEmpty(query.getIds()), User::getId, query.getIds())
        // 排序（★ 动态排序需白名单校验，见下）
        .orderByDesc(User::getCreateTime)
        .orderByAsc(User::getId);

    Page<User> page = new Page<>(query.getPageNum(), query.getPageSize());
    Page<User> result = userMapper.selectPage(page, wrapper);

    return PageResult.of(convert(result.getRecords()), result.getTotal(),
                         result.getCurrent(), result.getSize());
}
```

### 4.3 UpdateWrapper

```java
// ─── 字符串列名版 ───
UpdateWrapper<User> uw = new UpdateWrapper<>();
uw.set("status", 0)                             // ★ SET status = 0
  .set("update_time", LocalDateTime.now())
  .set("remark", null)                           // ★ 显式设为 null（updateById 无法做到）
  .setSql("login_count = login_count + 1")       // ★ 自定义 SQL 片段
  .eq("id", 1L);                                  // WHERE id = 1
userMapper.update(null, uw);

// ─── Lambda 版（推荐）───
LambdaUpdateWrapper<User> luw = Wrappers.<User>lambdaUpdate();
luw.set(User::getStatus, 0)
   .set(User::getUpdateTime, LocalDateTime.now())
   .set(User::getRemark, null)
   .setSql("read_count = read_count + 1")
   .eq(User::getId, 1L);
userMapper.update(null, luw);

// ─── ★ 批量更新（按条件）───
// 把所有 30 天未登录的用户设为禁用
userMapper.update(null, Wrappers.<User>lambdaUpdate()
    .set(User::getStatus, 0)
    .lt(User::getLastLoginTime, LocalDateTime.now().minusDays(30))
    .eq(User::getStatus, 1));

// ─── ★ updateById 无法把字段设为 null 的问题 ───
User user = new User();
user.setId(1L);
user.setRemark(null);                            // ★ 想清空 remark
userMapper.updateById(user);                     // ❌ remark 不会被更新（null 字段被忽略）
// 解决方案：
// ① 用 UpdateWrapper 的 set(字段, null)
// ② 修改全局策略 update-strategy: ignored（不推荐，影响全局）
// ③ 字段上用 @TableField(updateStrategy = FieldStrategy.IGNORED)

// ─── 链式调用（Lambda Chain，★ MP 3.x 的优雅写法）───
// 需要 IService 或直接 Wrappers
userMapper.update(null, Wrappers.<User>lambdaUpdate()
    .set(User::getStatus, 0).eq(User::getId, 1L));
```

## 5. IService 与 ServiceImpl ★★★★

```java
// ─── Service 接口继承 IService ───
public interface UserService extends IService<User> {
    // ★ 继承即拥有 CRUD + 批量 + 链式方法
    PageResult<UserVO> pageUsers(UserQuery query);       // 自定义业务方法
}

// ─── Service 实现继承 ServiceImpl ───
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {
    // ★ ServiceImpl<M, T>：M = Mapper 类型，T = 实体类型
    // baseMapper 字段可直接使用

    @Override
    public PageResult<UserVO> pageUsers(UserQuery query) {
        LambdaQueryWrapper<User> wrapper = buildWrapper(query);
        Page<User> page = page(new Page<>(query.getPageNum(), query.getPageSize()), wrapper);
        return PageResult.of(convert(page.getRecords()), page.getTotal(), ...);
    }
}
```

**IService 的方法分类：**

| 分类 | 方法 |
| --- | --- |
| **保存** | `save(T)`、`saveBatch(Collection)`、`saveBatch(Collection, batchSize)`、`saveOrUpdate(T)`、`saveOrUpdateBatch(Collection)` |
| **删除** | `removeById(id)`、`removeByIds(Collection)`、`removeByMap(Map)`、`remove(Wrapper)` |
| **更新** | `updateById(T)`、`update(Wrapper)`、`update(T, Wrapper)`、`updateBatchById(Collection)`、`updateBatchById(Collection, batchSize)` |
| **查询单个** | `getById(id)`、`getOne(Wrapper)`、`getOne(Wrapper, boolean)`、`getObj(Wrapper, mapper)` |
| **查询多个** | `list()`、`listByIds(Collection)`、`listByMap(Map)`、`list(Wrapper)`、`listMaps(Wrapper)`、`listObjs(Wrapper)` |
| **统计** | `count()`、`count(Wrapper)` |
| **分页** | ★ `page(IPage)`、`page(IPage, Wrapper)`、`pageMaps(...)` |
| **链式** | ★ `lambdaQuery()`、`query()`、`lambdaUpdate()`、`update()` |

```java
// ─── 批量操作（★ MP 的批量是分批执行，非一条 SQL）───
List<User> users = buildUsers(10000);
userService.saveBatch(users);                      // 默认每批 1000
userService.saveBatch(users, 500);                 // ★ 指定批次大小
userService.updateBatchById(users);
userService.saveOrUpdateBatch(users);              // 有 ID 则更新，无则插入

// ⚠️ saveBatch 的性能：MP 的 saveBatch 是「多条 INSERT 分批提交」，
//    不是一条 INSERT 多 VALUES。要真正的批量 SQL 性能，需要：
//    ① JDBC URL 加 rewriteBatchedStatements=true（★ 关键，否则批量退化为逐条）
//    ② 或自定义 XML 的 foreach 批量插入

// ─── ★ 链式查询（最优雅的写法）───
List<User> users2 = userService.lambdaQuery()
        .eq(User::getStatus, 1)
        .like(User::getUserName, "张")
        .ge(User::getAge, 18)
        .orderByDesc(User::getCreateTime)
        .list();                                    // ★ list() 结束

User one = userService.lambdaQuery()
        .eq(User::getUserName, "张三")
        .one();                                     // ★ one() 查一条

boolean exists = userService.lambdaQuery()
        .eq(User::getPhone, phone)
        .exists();                                  // ★ exists() 判断存在

long cnt = userService.lambdaQuery().eq(User::getStatus, 1).count();

// 链式更新
userService.lambdaUpdate()
        .set(User::getStatus, 0)
        .eq(User::getId, 1L)
        .update();                                  // ★ update() 执行

// 链式删除
userService.lambdaUpdate()
        .eq(User::getStatus, 0)
        .lt(User::getCreateTime, LocalDateTime.now().minusYears(1))
        .remove();

// ─── getOne 的多条处理 ───
User u = userService.getOne(wrapper);              // ★ 多条会抛异常
User u2 = userService.getOne(wrapper, false);       // ★ false = 多条不抛异常，取第一条
```

## 6. 高级特性 ★★★★★

### 6.1 逻辑删除

```java
// ─── 配置 ───
// 全局：application.yml
// mybatis-plus.global-config.db-config.logic-delete-field: deleted
// mybatis-plus.global-config.db-config.logic-delete-value: 1
// mybatis-plus.global-config.db-config.logic-not-delete-value: 0

// 或字段级：@TableLogic
@TableLogic
@TableField("deleted")
private Integer deleted;
```

```java
// ─── 效果：所有操作自动追加逻辑删除条件 ───
userMapper.deleteById(1L);
// ★ 实际执行：UPDATE sys_user SET deleted = 1 WHERE id = 1 AND deleted = 0

userMapper.selectById(1L);
// ★ 实际执行：SELECT * FROM sys_user WHERE id = 1 AND deleted = 0   ← 自动过滤已删除

userMapper.selectList(wrapper);
// ★ 自动追加 AND deleted = 0

userMapper.updateById(user);
// ★ 自动追加 AND deleted = 0

// ─── ★ 逻辑删除的坑 ───
// 1. 自定义 XML 的 SQL 【不会】自动追加逻辑删除条件！需要手动加
//    <select id="selectCustom">SELECT * FROM sys_user WHERE ... AND deleted = 0</select>
// 2. 唯一索引问题：逻辑删除后，deleted=1 的记录仍占用唯一索引
//    → 用户名唯一约束下，删除的用户名无法再次注册
//    → 解决：唯一索引改为 (user_name, deleted) 联合，或用时间戳标记删除
// 3. 关联查询要手动处理被关联表的逻辑删除
// 4. 物理删除需要用自定义 SQL（绕过 @TableLogic）
@Delete("DELETE FROM sys_user WHERE id = #{id}")     // ★ 自定义 SQL 才能真正物理删除
int physicalDeleteById(Long id);
```

### 6.2 乐观锁

```java
// ─── 配置：@Version + 乐观锁插件 ───
@Version
private Integer version;

// ─── 使用：先查后改（★ version 必须有值）───
User user = userMapper.selectById(1L);       // ★ 查出当前 version
user.setAge(30);
int rows = userMapper.updateById(user);       // ★ 自动带上 version 条件
// 实际执行：
// UPDATE sys_user SET age=30, version=version+1
// WHERE id=1 AND version=【查出的version】
if (rows == 0) {
    throw new BusinessException("数据已被他人修改，请刷新重试");   // ★ 必须检查影响行数！
}

// ─── 乐观锁的完整流程（带重试）───
@Transactional(rollbackFor = Exception.class)
public void updateWithRetry(Long id, Consumer<User> updater) {
    int maxRetry = 3;
    for (int i = 0; i < maxRetry; i++) {
        User user = userMapper.selectById(id);          // 每次重新查最新 version
        if (user == null) throw new BusinessException("数据不存在");
        updater.accept(user);                            // 业务修改
        int rows = userMapper.updateById(user);          // 乐观锁更新
        if (rows > 0) return;                            // 成功
        log.warn("乐观锁冲突，第 {} 次重试, id={}", i + 1, id);
    }
    throw new BusinessException("操作冲突，请稍后重试");
}

// ⚠️ 乐观锁的前提：updateById 的实体必须【带 version 值】
//    如果 new User() 只 set 了 id 和要改的字段，version 为 null → 乐观锁不生效！
```

### 6.3 自动填充

```java
// ─── 实现 MetaObjectHandler ───
@Component
@Slf4j
public class MyMetaObjectHandler implements MetaObjectHandler {

    /** ★ 插入时填充 */
    @Override
    public void insertFill(MetaObject metaObject) {
        LocalDateTime now = LocalDateTime.now();
        String currentUser = getCurrentUsername();
        // ★ 第三个参数是字段的 Java 类型
        this.strictInsertFill(metaObject, "createTime", LocalDateTime.class, now);
        this.strictInsertFill(metaObject, "updateTime", LocalDateTime.class, now);
        this.strictInsertFill(metaObject, "createBy", String.class, currentUser);
        this.strictInsertFill(metaObject, "updateBy", String.class, currentUser);
        this.strictInsertFill(metaObject, "version", Integer.class, 0);
        this.strictInsertFill(metaObject, "deleted", Integer.class, 0);
        // setFieldValByName（旧 API，会覆盖已有值）
        // this.setFieldValByName("createTime", now, metaObject);
    }

    /** ★ 更新时填充 */
    @Override
    public void updateFill(MetaObject metaObject) {
        this.strictUpdateFill(metaObject, "updateTime", LocalDateTime.class, LocalDateTime.now());
        this.strictUpdateFill(metaObject, "updateBy", String.class, getCurrentUsername());
    }

    private String getCurrentUsername() {
        LoginUser user = UserContext.get();
        return user != null ? user.getUsername() : "system";
    }
}

// ─── 字段上标记填充策略 ───
@TableField(fill = FieldFill.INSERT)              // 仅插入填充
private LocalDateTime createTime;
@TableField(fill = FieldFill.INSERT_UPDATE)       // 插入和更新都填充
private LocalDateTime updateTime;
@TableField(fill = FieldFill.UPDATE)              // 仅更新填充
private LocalDateTime lastModifyTime;

// ─── strictFill vs setFieldValByName ───
// strictInsertFill/strictUpdateFill：★ 只在字段为 null 时填充（不覆盖已有值）
// setFieldValByName：无条件覆盖（可能覆盖业务设置的值）
// 推荐用 strict 系列
```

### 6.4 多租户与数据权限

```java
// ─── 多租户插件（自动给所有 SQL 追加 tenant_id）───
public class MyTenantHandler implements TenantLineHandler {
    @Override
    public Expression getTenantId() {
        Long tenantId = TenantContext.getTenantId();        // 从上下文取
        return new LongValue(tenantId);
    }
    @Override
    public String getTenantIdColumn() { return "tenant_id"; }   // 租户字段名
    @Override
    public boolean ignoreTable(String tableName) {
        // ★ 哪些表不需要租户隔离（如字典表、系统表）
        return "sys_dict".equals(tableName) || "sys_config".equals(tableName);
    }
    @Override
    public boolean ignoreInsert(List<Column> columns, String tenantIdColumn) {
        // ★ 插入时如果已包含 tenant_id 列则不重复追加
        return columns.stream().anyMatch(c -> c.getColumnName().equals(tenantIdColumn));
    }
}
// 注册：interceptor.addInnerInterceptor(new TenantLineInnerInterceptor(new MyTenantHandler()));
// 效果：SELECT * FROM t_user → SELECT * FROM t_user WHERE tenant_id = 1（自动追加）

// ─── 数据权限插件（行级权限）───
public class MyDataPermissionHandler implements MultiDataPermissionHandler {
    @Override
    public Expression getSqlSegment(Table table, Expression where, String mappedStatementId) {
        // 根据当前用户的数据权限范围，返回额外的 WHERE 条件
        LoginUser user = UserContext.get();
        if (user == null || user.isAdmin()) return null;      // 管理员不限制
        // 例：只能看本部门数据
        return new EqualsTo(new Column(table, "dept_id"), new LongValue(user.getDeptId()));
    }
}
```

### 6.5 代码生成器 ★★★★

```java
/**
 * MyBatis-Plus 3.5.1+ 的新版代码生成器（FastAutoGenerator）
 * 一键生成 Entity/Mapper/Mapper.xml/Service/ServiceImpl/Controller
 */
public class CodeGenerator {
    public static void main(String[] args) {
        FastAutoGenerator.create(
                "jdbc:mysql://localhost:3306/mall?serverTimezone=Asia/Shanghai",
                "root", "123456")
            // 全局配置
            .globalConfig(builder -> builder
                .author("yourname")                              // 作者
                .outputDir("/Users/mac/code/generated")          // ★ 输出目录
                .disableOpenDir()                                 // 生成后不打开目录
                .commentDate("yyyy-MM-dd")
                .enableSwagger())                                 // 开启 Swagger 注解
            // 包配置
            .packageConfig(builder -> builder
                .parent("com.example")                            // 父包名
                .entity("entity")
                .mapper("mapper")
                .service("service")
                .serviceImpl("service.impl")
                .controller("controller")
                .xml("mapper")                                    // XML 包
                .pathInfo(Collections.singletonMap(OutputFile.xml,   // ★ XML 输出路径
                        "/Users/mac/code/generated/mapper")))
            // 策略配置
            .strategyConfig(builder -> builder
                .addInclude("sys_user", "sys_role", "t_order")     // ★ 要生成的表
                .addTablePrefix("sys_", "t_")                       // ★ 去掉的表前缀
                // Entity 策略
                .entityBuilder()
                    .enableLombok()                                 // ★ 用 Lombok
                    .enableTableFieldAnnotation()                   // ★ 生成 @TableField
                    .enableChainModel()                             // 链式模型
                    .naming(NamingStrategy.underline_to_camel)      // ★ 下划线转驼峰
                    .logicDeleteColumnName("deleted")               // 逻辑删除字段
                    .versionColumnName("version")                   // 乐观锁字段
                    .addTableFills(new TableFill("createTime", FieldFill.INSERT))   // 自动填充
                    .formatFileName("%sEntity")                     // 文件名格式
                // Mapper 策略
                .mapperBuilder()
                    .enableBaseResultMap()                          // ★ 生成 resultMap
                    .enableBaseColumnList()                         // ★ 生成列清单
                    .superClass(BaseMapper.class)
                    .formatMapperFileName("%sMapper")
                    .formatXmlFileName("%sMapper")
                // Service 策略
                .serviceBuilder()
                    .formatServiceFileName("%sService")
                    .formatServiceImplFileName("%sServiceImpl")
                // Controller 策略
                .controllerBuilder()
                    .enableRestStyle()                              // ★ @RestController
                    .enableHyphenStyle()                            // URL 连字符风格
                    .formatFileName("%sController"))
            // 模板引擎
            .templateEngine(new VelocityTemplateEngine())
            .execute();                                             // ★ 执行生成
    }
}
```

### 6.6 其他实用特性

```java
// ─── ① AR 模式（ActiveRecord，实体自己操作数据库）───
public class User extends Model<User> {          // ★ 继承 Model
    @TableId private Long id;
    private String userName;
}
// 使用（实体直接 CRUD）
User user = new User();
user.setUserName("张三");
user.insert();                                    // ★ 实体自己插入
user.selectById(1L);
user.updateById();
user.deleteById();
user.selectAll();
// ⚠️ AR 模式需要实体继承 Model，且要有对应的 BaseMapper，实践中用得少

// ─── ② SQL 注入器（自定义全局方法）───
public class MySqlInjector extends DefaultSqlInjector {
    @Override
    public List<AbstractMethod> getMethodList(Class<?> mapperClass, TableInfo tableInfo) {
        List<AbstractMethod> methods = super.getMethodList(mapperClass, tableInfo);
        methods.add(new DeleteByIdWithFill());     // 自定义方法
        methods.add(new LogicDeleteByIdWithFill());
        return methods;
    }
}

// ─── ③ 动态表名（分表）───
DynamicTableNameInnerInterceptor interceptor = new DynamicTableNameInnerInterceptor();
interceptor.setTableNameHandler((sql, tableName) -> {
    if ("t_order".equals(tableName)) {
        return "t_order_" + ShardingContext.getSuffix();    // t_order_202609
    }
    return tableName;
});

// ─── ④ 性能分析（SQL 执行时间，开发环境用）───
// MP 3.x 移除了 PerformanceInterceptor，改用 p6spy 或自定义插件

// ─── ⑤ 主键回填的批量插入 ───
List<User> users = ...;
userMapper.insert(users);                          // MP 3.5.4+ 支持批量插入并回填主键
// 或 Db.saveBatch(users)（MP 3.5.3+ 的静态工具）

// ─── ⑥ Db 静态工具类（MP 3.5.3+，无需注入 Service）───
import com.baomidou.mybatisplus.extension.toolkit.Db;
List<User> list = Db.list(User.class);             // 静态调用
User u = Db.getById(User.class, 1L);
Db.save(user);
Db.saveBatch(userList);
Db.lambdaQuery().eq(User::getStatus, 1).list();
```

## 7. MP 与原生 MyBatis 混用

```java
// ─── 复杂查询仍写在 XML（MP 不改变 MyBatis 的用法）───
public interface UserMapper extends BaseMapper<User> {
    // ★ BaseMapper 提供单表 CRUD

    // ★ 自定义的复杂查询（多表 JOIN、统计报表），写在 XML
    List<UserWithDeptVO> selectUserWithDept(UserQuery query);

    UserStatisticsVO selectStatistics(@Param("deptId") Long deptId);

    // 也可以用注解 SQL
    @Select("SELECT u.*, d.dept_name FROM sys_user u "
          + "LEFT JOIN sys_dept d ON u.dept_id = d.id WHERE u.id = #{id}")
    UserWithDeptVO selectDetailById(Long id);
}
```

```xml
<!-- UserMapper.xml（复杂 SQL） -->
<mapper namespace="com.example.mapper.UserMapper">
    <!-- ★ 注意：MP 的 @TableLogic 逻辑删除【不会】自动作用于自定义 XML SQL -->
    <select id="selectUserWithDept" resultType="com.example.vo.UserWithDeptVO">
        SELECT u.id, u.user_name, u.age, d.dept_name
        FROM sys_user u
        LEFT JOIN sys_dept d ON u.dept_id = d.id
        <where>
            u.deleted = 0                              <!-- ★ 手动加逻辑删除条件 -->
            AND d.deleted = 0
            <if test="keyword != null and keyword != ''">
                AND u.user_name LIKE CONCAT('%', #{keyword}, '%')
            </if>
        </where>
        ORDER BY u.create_time DESC
    </select>
</mapper>
```

> 【选择原则】
> - **单表 CRUD、简单条件查询** → 用 MP 的 BaseMapper + Wrapper（零 SQL）
> - **多表 JOIN、复杂统计、动态报表** → 用 XML 手写 SQL（灵活可控）
> - 二者在同一个 Mapper 中共存，互不影响。

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | ★ 未配置分页插件 | `selectPage` 返回全部数据 | 注册 `PaginationInnerInterceptor` |
| 2 | 分页插件未指定 DbType | 分页 SQL 方言错误 | `new PaginationInnerInterceptor(DbType.MYSQL)` |
| 3 | 雪花 ID 传给前端精度丢失 | ID 末几位变 0 | ★ Jackson 的 Long → String |
| 4 | `updateById` 无法更新 null 字段 | 字段清不掉 | 用 `UpdateWrapper.set(field, null)` |
| 5 | 乐观锁 update 时 version 为 null | 乐观锁不生效 | 先 `selectById` 查出 version |
| 6 | 乐观锁未检查影响行数 | 并发覆盖无感知 | `if (rows == 0) throw` |
| 7 | `selectOne` 查到多条 | `TooManyResultsException` | 加 `last("LIMIT 1")` 或用 `selectList` |
| 8 | 逻辑删除对自定义 XML 无效 | 查出已删除数据 | XML 中手动加 `deleted = 0` |
| 9 | 逻辑删除 + 唯一索引冲突 | 删除后无法重新注册同名 | 唯一索引加 deleted，或用删除时间戳 |
| 10 | `@TableField(exist=false)` 忘加 | 报错「未知列」 | 非数据库字段必须标注 |
| 11 | JSON 字段未配 `autoResultMap` | typeHandler 不生效 | `@TableName(autoResultMap=true)` |
| 12 | `saveBatch` 性能差 | 逐条插入 | JDBC URL 加 `rewriteBatchedStatements=true` |
| 13 | `last()` 拼接用户输入 | ★ SQL 注入 | `last` 只用固定字符串（如 LIMIT 1） |
| 14 | `apply()` 用字符串拼接参数 | SQL 注入 | 用 `apply("x = {0}", param)` 占位符 |
| 15 | Wrapper 的 `orderBy` 用用户输入 | SQL 注入 | 排序字段白名单校验 |
| 16 | `@EnumValue` 未配 handler | 枚举存的是 name | 配 `default-enum-type-handler` |
| 17 | 插件顺序错误 | 多租户/分页互相干扰 | 多租户 → 动态表名 → 分页 → 乐观锁 |
| 18 | `selectById` 传 null | 查全表或报错 | 参数校验 |
| 19 | 实体类名与表名不一致未配 @TableName | 找不到表 | `@TableName("实际表名")` |
| 20 | 未开启驼峰转换 | 字段映射为 null | MP 默认开启，检查是否被关闭 |
| 21 | `ServiceImpl` 的 `saveBatch` 事务问题 | 部分成功部分失败 | `saveBatch` 有事务，但注意嵌套事务传播 |
| 22 | 多数据源下 MP 配置冲突 | 用错数据源 | 每个数据源独立配置 SqlSessionFactory |
| 23 | 逻辑删除字段有默认值但实体没设 | 插入时 deleted 为 null | 用自动填充设默认值 0 |
| 24 | `getOne(wrapper)` 多条不处理 | 抛异常 | `getOne(wrapper, false)` 取第一条 |
| 25 | Wrapper 复用 | 条件累积（脏数据） | 每次 new 一个新的 Wrapper |
| 26 | `selectObjs` 返回 Object 需强转 | 类型转换 | 注意返回的是第一列的值 |
| 27 | 自动填充用了 setFieldValByName | 覆盖业务设置的值 | 用 `strictInsertFill`（只填 null） |
| 28 | 防全表更新插件误伤 | 合法的无条件更新被拦截 | 确实需要时用 `Wrappers.emptyWrapper()` 绕过或移除插件 |

---

## 关联笔记

- 上一篇：[[后端/MyBatis/缓存机制与插件开发]]
- 相关：[[后端/MyBatis/MyBatis入门与核心配置]]、[[后端/MyBatis/动态SQL与结果映射]]
- 整合：[[后端/SpringBoot/整合数据访问层]]（MP + Spring Boot + 多数据源）
- 分布式 ID：[[后端/微服务/分布式ID与链路追踪]]（雪花算法详解与时钟回拨）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
