---
title: "整合数据访问层"
aliases:
  - "SpringBoot 整合 MyBatis"
  - "多数据源"
  - "读写分离"
  - "Flyway"
tags:
  - "后端"
  - "java"
  - "spring"
  - "springboot"
  - "数据库"
category: "后端"
folder: "SpringBoot"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/MyBatis/MyBatisPlus]]"
  - "[[后端/MyBatis/MyBatis入门与核心配置]]"
  - "[[后端/Spring/事务管理与失效场景]]"
  - "[[后端/数据库/MySQL/事务与锁机制]]"
created: 2026-09-07
updated: 2026-09-07
---

# Spring Boot 整合数据访问层

> MySQL 的索引、事务、锁、优化原理见 [[后端/数据库/MySQL/索引与执行计划]]、[[后端/数据库/MySQL/事务与锁机制]]；Redis 原理见 [[后端/数据库/Redis/Redis学习笔记]]。本篇聚焦 **Java 侧的整合配置与实战**。

## 1. 连接池选型与配置 ★★★★★

### 1.1 四大连接池对比

| 连接池 | 特点 | 性能 | 监控 | 现状 |
| --- | --- | --- | --- | --- |
| **HikariCP** | ★ Spring Boot **默认**，极致轻量（130KB） | ★★ **最快** | ❌ 无内置 | ★ **主流首选** |
| **Druid** | 阿里出品，功能最全 | 中 | ★★ **最强**（SQL 监控、防火墙、Web 页面） | ★ 国内广泛使用 |
| DBCP2 | Apache 老牌 | 慢 | ❌ | 淘汰 |
| C3P0 | 老牌 | 慢 | ❌ | 淘汰 |
| Tomcat JDBC Pool | Tomcat 内置 | 中 | 一般 | Tomcat 环境 |

> 【选型】
> - **追求性能 + 简洁** → **HikariCP**（Boot 默认，无需额外依赖）。
> - **需要 SQL 监控、慢 SQL 分析、SQL 防火墙** → **Druid**（`/druid` 页面是排查生产 SQL 问题的利器）。
> - 二者不能同时作为主数据源，但可以 Druid 做主 + 手动埋点。

### 1.2 HikariCP 配置（默认）

```yaml
spring:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/mall?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true&rewriteBatchedStatements=true&cachePrepStmts=true&prepStmtCacheSize=250&prepStmtCacheSqlLimit=2048&useServerPrepStmts=true
    username: ${DB_USERNAME:root}
    password: ${DB_PASSWORD}
    type: com.zaxxer.hikari.HikariDataSource          # ★ 默认就是 Hikari
    hikari:
      pool-name: MallHikariPool                        # 池名（日志中可见）
      # ─── 连接数（★ 核心参数）───
      maximum-pool-size: 20                            # ★ 最大连接数（默认 10）
      minimum-idle: 10                                 # ★ 最小空闲（默认同 max）
      # ─── 超时（★ 防止请求无限等待）───
      connection-timeout: 3000                         # ★ 获取连接超时（ms，默认 30000）→ 抛 SQLTransientConnectionException
      validation-timeout: 3000                          # 连接校验超时
      idle-timeout: 600000                              # ★ 空闲连接回收时间（默认 600000 = 10 分钟）
      max-lifetime: 1800000                             # ★★ 连接最大存活时间（默认 1800000 = 30 分钟）
      keepalive-time: 300000                            # ★ 保活探测间隔（3.4.0+，防止被防火墙/MySQL 断开）
      # ─── 检测 ───
      connection-test-query: SELECT 1                   # ★ JDBC4 驱动可不配（用 isValid()，更快）
      # ─── 泄漏检测（★ 开发环境必开）───
      leak-detection-threshold: 60000                   # ★ 连接借出 60 秒未归还则告警
      # ─── 其他 ───
      auto-commit: true                                 # 自动提交（Spring 事务会接管）
      register-mbeans: false                             # JMX 注册
      allow-pool-suspension: false                       # 是否允许池挂起
      # ─── 传递给 JDBC 驱动的属性 ───
      data-source-properties:
        cachePrepStmts: true                             # ★ 缓存预编译语句
        prepStmtCacheSize: 250
        prepStmtCacheSqlLimit: 2048
        useServerPrepStmts: true                          # ★ 服务端预编译
        rewriteBatchedStatements: true                    # ★★ 批量插入性能关键（提升 5~10 倍）
        useLocalSessionState: true
        useLocalTransactionState: true
        maintainTimeStats: false
        cacheResultSetMetadata: true
        cacheServerConfiguration: true
        elideSetAutoCommits: true
```

**连接池参数怎么算（★ 面试 + 实战）：**

```
HikariCP 官方公式（来自 "About Pool Sizing"）：
    connections = ((core_count * 2) + effective_spindle_count)

例：4 核 CPU、SSD（spindle≈1）→ connections = 4*2 + 1 = 9
    → ★ 连接池不是越大越好！

为什么不是越大越好：
  ① 数据库的连接处理能力有限（MySQL 的 max_connections 默认 151）
  ② 连接数过多 → 上下文切换开销 + 锁竞争加剧 → 吞吐量反而下降
  ③ 每个连接占用内存（MySQL 每连接约 1~10MB）

实践经验值：
  - 小型应用（单机、低并发）：10~20
  - 中型应用（多实例、中并发）：20~50（★ 每实例）
  - 大型应用：按公式计算 + 压测验证
  - ★ 总连接数 = 实例数 × maximum-pool-size，必须小于 MySQL 的 max_connections × 0.8

验证方法：压测时观察
  - HikariCP 的 metrics：hikaricp_connections_pending（等待连接的线程数）
  - 若 pending 长期 > 0 → 池太小
  - 若 active 长期远低于 max → 池太大
```

```yaml
# MySQL 侧的配套配置（my.cnf）
max_connections = 1000                    # ★ 必须 > 应用总连接数
wait_timeout = 28800                       # ★ 空闲连接超时（8 小时）
interactive_timeout = 28800
# ★★ 关键：HikariCP 的 max-lifetime 必须【小于】MySQL 的 wait_timeout
#   否则 MySQL 先断开连接，应用拿到的是「死连接」→ 报 Communications link failure
#   建议：max-lifetime = wait_timeout - 60秒
```

### 1.3 Druid 配置（带监控）

```xml
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>druid-spring-boot-3-starter</artifactId>    <!-- ★ Boot 3 用这个 -->
    <version>1.2.23</version>
</dependency>
```

```yaml
spring:
  datasource:
    type: com.alibaba.druid.pool.DruidDataSource
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/mall?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    druid:
      # ─── 连接池 ───
      initial-size: 5                        # 初始化连接数
      min-idle: 10                            # 最小空闲
      max-active: 50                          # ★ 最大活动连接
      max-wait: 3000                          # ★ 获取连接最大等待（ms），-1 为无限（危险）
      # ─── 连接有效性检测 ───
      validation-query: SELECT 1               # ★ 检测 SQL
      test-while-idle: true                     # ★ 空闲时检测（推荐，性能影响小）
      test-on-borrow: false                     # 借出时检测（性能差，关闭）
      test-on-return: false                     # 归还时检测
      time-between-eviction-runs-millis: 60000   # 检测间隔（60 秒）
      min-evictable-idle-time-millis: 300000      # 空闲多久回收（5 分钟）
      max-evictable-idle-time-millis: 900000
      keep-alive: true                           # ★ 保活（对空闲连接主动检测，防止被 MySQL 断开）
      # ─── PSCache ───
      pool-prepared-statements: false             # ★ MySQL 建议 false，Oracle 建议 true
      max-pool-prepared-statement-per-connection-size: 20
      # ─── ★ 监控与防火墙（Druid 的核心价值）───
      filters: stat,wall,slf4j                    # ★ stat=SQL统计, wall=SQL防火墙, slf4j=日志
      filter:
        stat:
          enabled: true
          log-slow-sql: true                       # ★ 记录慢 SQL
          slow-sql-millis: 2000                    # ★ 慢 SQL 阈值（2 秒）
          merge-sql: true                           # ★ 合并相同结构的 SQL（统计更准）
        wall:
          enabled: true                             # ★ SQL 防火墙
          config:
            multi-statement-allow: false            # ★ 禁止多语句（防注入）
            drop-table-allow: false                 # 禁止 DROP TABLE
            alter-table-allow: false
            truncate-allow: false
            comment-allow: false                     # 禁止 SQL 注释
            strict-syntax-check: true
            condition-and-alway-true-allow: false     # ★ 禁止恒真条件（防万能密码）
            none-base-statement-allow: false
            select-into-outfile-allow: false          # 禁止导出文件
        slf4j:
          enabled: true
          statement-log-error-enabled: true
          result-set-log-enabled: false               # 关闭结果集日志（量大）
      # ─── ★ Web 监控页面 ───
      stat-view-servlet:
        enabled: true                                 # ★ 开启 /druid 页面
        url-pattern: /druid/*
        login-username: ${DRUID_USER:admin}            # ★ 必须设置账号密码！
        login-password: ${DRUID_PASSWORD}
        reset-enable: false                            # 禁止重置统计
        allow: 127.0.0.1,192.168.1.0/24                # ★ IP 白名单（生产必配）
        # deny: 1.2.3.4                                 # IP 黑名单
      web-stat-filter:
        enabled: true
        url-pattern: /*
        exclusions: "*.js,*.gif,*.jpg,*.png,*.css,*.ico,/druid/*"
        session-stat-enable: false                     # 关闭 Session 监控（前后端分离无意义）
      # ─── 连接泄漏检测 ───
      remove-abandoned: false                          # ★ 生产关闭（可能误杀长事务）
      remove-abandoned-timeout: 180                     # 秒
      log-abandoned: true
```

```
# ─── Druid 监控页面能看到什么（★ 生产排查神器）───
http://host:8080/druid/

① 数据源（datasource.html）
   连接池状态：活跃数、空闲数、等待线程数、逻辑连接打开/关闭次数
   ★ 能看出连接池是否够用、是否有泄漏

② SQL 监控（sql.html）★★★ 最有价值
   每条 SQL 的：执行次数、总耗时、★最大/最小/平均耗时、并发量、
              影响行数、返回行数、★ 慢 SQL 标记、执行时间分布直方图
   ★ 直接定位慢 SQL！还能看到 SQL 的执行计划

③ SQL 防火墙（wall.html）
   拦截记录：哪些 SQL 被防火墙拦截（★ 发现注入攻击尝试）
   白名单/黑名单统计

④ URI 监控（weburi.html）
   每个 URL 的请求次数、耗时、并发 → 定位慢接口

⑤ Session 监控（websession.html）

⑥ Spring 监控（spring.html）
   Spring Bean 的方法调用统计

⑦ JSON API（便于接入监控系统）
   /druid/stat.json  /druid/sql.json  /druid/wall.json
```

> 【★ 安全警告】Druid 监控页面**必须**设置：
> 1. `login-username` / `login-password`（默认无密码！任何人都能看你的 SQL 和数据源配置）
> 2. `allow` IP 白名单（限制内网访问）
> 3. 生产环境**建议关闭** `stat-view-servlet.enabled`，改用 Prometheus + Grafana
> 4. 不要在 Nginx 上把 `/druid/*` 暴露到公网

## 2. 整合 MyBatis / MyBatis-Plus ★★★★★

### 2.1 基础整合

```yaml
# ─── MyBatis-Plus（Boot 3）───
mybatis-plus:
  mapper-locations: classpath*:mapper/**/*.xml       # ★ classpath*: 支持多模块/jar
  type-aliases-package: com.example.mall.entity      # 实体别名包
  type-handlers-package: com.example.mall.handler     # 类型处理器包
  configuration:
    map-underscore-to-camel-case: true                # ★ 驼峰转换
    log-impl: org.apache.ibatis.logging.slf4j.Slf4jImpl
    cache-enabled: false                              # 二级缓存（建议关）
    call-setters-on-nulls: true                       # null 也调 setter
    default-statement-timeout: 30                     # ★ SQL 超时（秒）
    default-fetch-size: 1000
    local-cache-scope: session                        # 一级缓存
    auto-mapping-unknown-column-behavior: warning     # 未知列告警
    lazy-loading-enabled: false
  global-config:
    banner: false                                     # 关闭 MP 的启动 banner
    db-config:
      id-type: assign_id                              # ★ 雪花算法主键
      logic-delete-field: deleted                     # ★ 逻辑删除字段
      logic-delete-value: 1
      logic-not-delete-value: 0
      table-prefix: t_                                 # 表前缀
      insert-strategy: not_null                        # ★ 只插入非 null 字段
      update-strategy: not_null                        # ★ 只更新非 null 字段
      select-strategy: not_empty
      where-strategy: not_empty
      capital-mode: false                              # 表名/列名是否大写（Oracle 用）
```

```java
// ─── 配置类（★ 分页插件等必须注册）───
@Configuration
@MapperScan(basePackages = "com.example.mall.mapper",        // ★ Mapper 扫描
            sqlSessionTemplateRef = "sqlSessionTemplate")     // 多数据源时需指定
public class MybatisPlusConfig {

    /** ★ 核心插件链 */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();

        // ① ★ 分页（必须指定 DbType）
        PaginationInnerInterceptor pagination = new PaginationInnerInterceptor(DbType.MYSQL);
        pagination.setMaxLimit(1000L);              // ★ 单页上限（防 pageSize=999999）
        pagination.setOverflow(false);              // 页码超出不回首页
        interceptor.addInnerInterceptor(pagination);

        // ② ★ 乐观锁
        interceptor.addInnerInterceptor(new OptimisticLockerInnerInterceptor());

        // ③ ★ 防全表更新/删除（★ 生产强烈建议）
        interceptor.addInnerInterceptor(new BlockAttackInnerInterceptor());

        return interceptor;
    }

    /** ★ 自动填充（创建人、创建时间等） */
    @Bean
    public MetaObjectHandler metaObjectHandler() {
        return new MetaObjectHandler() {
            @Override
            public void insertFill(MetaObject metaObject) {
                LocalDateTime now = LocalDateTime.now();
                String user = UserContext.getUsernameOrSystem();
                strictInsertFill(metaObject, "createTime", LocalDateTime.class, now);
                strictInsertFill(metaObject, "updateTime", LocalDateTime.class, now);
                strictInsertFill(metaObject, "createBy", String.class, user);
                strictInsertFill(metaObject, "updateBy", String.class, user);
                strictInsertFill(metaObject, "version", Integer.class, 0);
                strictInsertFill(metaObject, "deleted", Integer.class, 0);
            }
            @Override
            public void updateFill(MetaObject metaObject) {
                strictUpdateFill(metaObject, "updateTime", LocalDateTime.class, LocalDateTime.now());
                strictUpdateFill(metaObject, "updateBy", String.class, UserContext.getUsernameOrSystem());
            }
        };
    }
}
```

### 2.2 多数据源配置 ★★★★★

**场景：主从库、业务库+日志库、多租户分库。**

```java
// ═══════ 方案 1：完全隔离的多数据源（★ 最清晰，按包路径区分）═══════

/** 主数据源（业务库） */
@Configuration
@MapperScan(basePackages = "com.example.mall.mapper.master",     // ★ 主库的 Mapper 包
            sqlSessionFactoryRef = "masterSqlSessionFactory",
            sqlSessionTemplateRef = "masterSqlSessionTemplate")
public class MasterDataSourceConfig {

    @Bean
    @Primary                                                      // ★ 主数据源
    @ConfigurationProperties("spring.datasource.master")
    public DataSourceProperties masterDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource.master.hikari")
    public DataSource masterDataSource() {
        return masterDataSourceProperties()
                .initializeDataSourceBuilder()
                .type(HikariDataSource.class)
                .build();
    }

    @Bean
    @Primary
    public SqlSessionFactory masterSqlSessionFactory(
            @Qualifier("masterDataSource") DataSource dataSource) throws Exception {
        MybatisSqlSessionFactoryBean factory = new MybatisSqlSessionFactoryBean();   // ★ MP 用这个
        factory.setDataSource(dataSource);
        factory.setMapperLocations(new PathMatchingResourcePatternResolver()
                .getResources("classpath*:mapper/master/**/*.xml"));
        factory.setTypeAliasesPackage("com.example.mall.entity");
        // ★ MP 的全局配置
        GlobalConfig globalConfig = new GlobalConfig();
        globalConfig.setBanner(false);
        globalConfig.setDbConfig(new GlobalConfig.DbConfig()
                .setIdType(IdType.ASSIGN_ID)
                .setLogicDeleteField("deleted")
                .setTablePrefix("t_"));
        factory.setGlobalConfig(globalConfig);
        // ★ 插件
        factory.setPlugins(mybatisPlusInterceptor(), metaObjectHandler());
        return factory.getObject();
    }

    @Bean
    @Primary
    public DataSourceTransactionManager masterTransactionManager(
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

/** 从数据源（日志库） */
@Configuration
@MapperScan(basePackages = "com.example.mall.mapper.log",        // ★ 日志库的 Mapper 包
            sqlSessionFactoryRef = "logSqlSessionFactory",
            sqlSessionTemplateRef = "logSqlSessionTemplate")
public class LogDataSourceConfig {

    @Bean
    @ConfigurationProperties("spring.datasource.log")
    public DataSourceProperties logDataSourceProperties() { return new DataSourceProperties(); }

    @Bean
    @ConfigurationProperties("spring.datasource.log.hikari")
    public DataSource logDataSource() {
        return logDataSourceProperties().initializeDataSourceBuilder()
                .type(HikariDataSource.class).build();
    }

    @Bean
    public SqlSessionFactory logSqlSessionFactory(
            @Qualifier("logDataSource") DataSource dataSource) throws Exception {
        MybatisSqlSessionFactoryBean factory = new MybatisSqlSessionFactoryBean();
        factory.setDataSource(dataSource);
        factory.setMapperLocations(new PathMatchingResourcePatternResolver()
                .getResources("classpath*:mapper/log/**/*.xml"));
        return factory.getObject();
    }

    /** ★ 独立的事务管理器（使用时要显式指定！） */
    @Bean
    public DataSourceTransactionManager logTransactionManager(
            @Qualifier("logDataSource") DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    @Bean
    public SqlSessionTemplate logSqlSessionTemplate(
            @Qualifier("logSqlSessionFactory") SqlSessionFactory factory) {
        return new SqlSessionTemplate(factory);
    }
}
```

```yaml
# ★ 多数据源的 YAML（注意 Hikari 用 jdbc-url）
spring:
  datasource:
    master:
      driver-class-name: com.mysql.cj.jdbc.Driver
      jdbc-url: jdbc:mysql://master-host:3306/mall?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
      username: ${MASTER_DB_USER}
      password: ${MASTER_DB_PASSWORD}
      hikari:
        pool-name: MasterPool
        maximum-pool-size: 30
        minimum-idle: 10
    log:
      driver-class-name: com.mysql.cj.jdbc.Driver
      jdbc-url: jdbc:mysql://log-host:3306/mall_log?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
      username: ${LOG_DB_USER}
      password: ${LOG_DB_PASSWORD}
      hikari:
        pool-name: LogPool
        maximum-pool-size: 10
        minimum-idle: 5
```

```java
// ─── 使用（★ 事务必须指定 transactionManager）───
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderMapper orderMapper;          // 主库（com.example.mall.mapper.master）
    private final OperLogMapper logMapper;          // 日志库（com.example.mall.mapper.log）

    /** ★ 主库事务：用 @Primary 的 transactionManager，可不指定 */
    @Transactional(rollbackFor = Exception.class)
    public void createOrder(OrderDTO dto) {
        orderMapper.insert(order);
    }

    /** ★ 日志库事务：必须显式指定！ */
    @Transactional(transactionManager = "logTransactionManager",
                   rollbackFor = Exception.class,
                   propagation = Propagation.REQUIRES_NEW)     // ★ 独立事务（不受主库回滚影响）
    public void saveLog(OperLog log) {
        logMapper.insert(log);
    }

    /** ★★ 跨数据源：两个事务独立，无法保证原子性！ */
    @Transactional(rollbackFor = Exception.class)
    public void createOrderWithLog(OrderDTO dto) {
        orderMapper.insert(order);                    // 主库事务
        // ★ 这个调用【不在】主库事务中（用的是 logTransactionManager）
        saveLog(buildLog(dto));                        // 日志库独立事务
        // 若后续主库回滚，日志【不会】回滚 → 数据不一致
        // 解决：① 日志用 REQUIRES_NEW（本就允许不一致）② 需要强一致用 Seata
    }
}
```

> 【★★ 多数据源的核心陷阱】**一个 `@Transactional` 只能管理一个数据源的事务！**
> - Spring 的事务管理器绑定到**特定 DataSource**，事务信息存在 ThreadLocal 中（以 DataSource 为 key）。
> - 跨数据源的操作**无法**用一个 `@Transactional` 保证原子性。
> - 需要跨库原子性 → **Seata**（见 [[后端/微服务/Seata分布式事务]]）或 **本地消息表**。

### 2.3 读写分离 ★★★★

```java
// ═══════ 方案 1：基于 AbstractRoutingDataSource + AOP（★ 应用层实现）═══════

/** 数据源类型的上下文 */
public class DataSourceContextHolder {
    private static final ThreadLocal<DataSourceType> HOLDER =
            new ThreadLocal<>();                                  // ★ 线程隔离

    public enum DataSourceType { MASTER, SLAVE }

    public static void set(DataSourceType type) { HOLDER.set(type); }
    public static DataSourceType get() {
        DataSourceType type = HOLDER.get();
        return type == null ? DataSourceType.MASTER : type;        // ★ 默认主库（安全）
    }
    public static void clear() { HOLDER.remove(); }               // ★ 必须清理
    public static boolean isMaster() { return get() == DataSourceType.MASTER; }
}

/** ★ 动态路由数据源 */
@Slf4j
public class DynamicRoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        DataSourceType type = DataSourceContextHolder.get();
        // ★ 事务中强制走主库（避免主从延迟导致读不到刚写的数据）
        if (TransactionSynchronizationManager.isActualTransactionActive()
                && !TransactionSynchronizationManager.isCurrentTransactionReadOnly()) {
            type = DataSourceType.MASTER;
        }
        log.debug("路由到数据源: {}", type);
        return type;
    }
}

/** ★ AOP 切面：自动切换数据源 */
@Aspect
@Component
@Order(-1)                                        // ★ 必须在【事务切面之前】执行！
@Slf4j
public class DataSourceAspect {

    /** 只读方法（查询）走从库 */
    @Around("@annotation(org.springframework.transaction.annotation.Transactional)")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        MethodSignature sig = (MethodSignature) pjp.getSignature();
        Method method = sig.getMethod();
        Transactional tx = method.getAnnotation(Transactional.class);

        // ★ 判断：@Master 注解优先，其次看 readOnly，最后看方法名前缀
        boolean useMaster = method.isAnnotationPresent(Master.class)
                || sig.getDeclaringType().isAnnotationPresent(Master.class)
                || (tx != null && !tx.readOnly())
                || isWriteMethod(method.getName());

        DataSourceContextHolder.set(useMaster
                ? DataSourceType.MASTER : DataSourceType.SLAVE);
        try {
            return pjp.proceed();
        } finally {
            DataSourceContextHolder.clear();       // ★★ 必须清理
        }
    }

    private boolean isWriteMethod(String name) {
        return name.startsWith("insert") || name.startsWith("save") || name.startsWith("add")
            || name.startsWith("update") || name.startsWith("modify")
            || name.startsWith("delete") || name.startsWith("remove")
            || name.startsWith("create") || name.startsWith("batch");
    }
}

/** ★ 强制主库的注解（主从延迟敏感的场景） */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface Master { }

/** 数据源配置 */
@Configuration
public class ReadWriteConfig {

    @Bean
    @ConfigurationProperties("spring.datasource.master")
    public DataSource masterDataSource() { return DataSourceBuilder.create().build(); }

    @Bean
    @ConfigurationProperties("spring.datasource.slave")
    public DataSource slaveDataSource() { return DataSourceBuilder.create().build(); }

    /** ★ 可选：多个从库（负载均衡） */
    @Bean
    @ConfigurationProperties("spring.datasource.slave2")
    public DataSource slave2DataSource() { return DataSourceBuilder.create().build(); }

    @Bean
    @Primary
    public DataSource dynamicDataSource(DataSource masterDataSource,
                                        DataSource slaveDataSource,
                                        DataSource slave2DataSource) {
        DynamicRoutingDataSource ds = new DynamicRoutingDataSource();
        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put(DataSourceType.MASTER, masterDataSource);
        // ★ 多从库用组合数据源（轮询）
        targetDataSources.put(DataSourceType.SLAVE,
                new RoundRobinDataSource(List.of(slaveDataSource, slave2DataSource)));
        ds.setTargetDataSources(targetDataSources);
        ds.setDefaultTargetDataSource(masterDataSource);       // ★ 默认主库（安全兜底）
        return ds;
    }
}

// 使用
@Service
public class UserService {

    @Transactional(readOnly = true)               // ★ 走从库
    public UserVO getById(Long id) { return userMapper.selectById(id); }

    @Master                                        // ★ 强制走主库（刚写入立即查询的场景）
    @Transactional(readOnly = true)
    public UserVO getByIdFromMaster(Long id) { return userMapper.selectById(id); }

    @Transactional(rollbackFor = Exception.class)  // ★ 走主库
    public void create(UserDTO dto) { userMapper.insert(...); }
}
```

```java
// ═══════ 方案 2：ShardingSphere-JDBC（★ 生产推荐，功能完整）═══════
// 支持：读写分离、分库分表、影子库、数据加密、分布式事务
```
```yaml
# 依赖：shardingsphere-jdbc-core-spring-boot-starter
spring:
  shardingsphere:
    datasource:
      names: master,slave0,slave1
      master:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://master:3306/mall
        username: root
        password: xxx
      slave0:
        type: com.zaxxer.hikari.HikariDataSource
        jdbc-url: jdbc:mysql://slave0:3306/mall
        username: readonly
        password: xxx
      slave1:
        type: com.zaxxer.hikari.HikariDataSource
        jdbc-url: jdbc:mysql://slave1:3306/mall
    rules:
      readwrite-splitting:
        data-sources:
          primary_ds:
            static-strategy:
              write-data-source-name: master              # ★ 写库
              read-data-source-names: slave0,slave1        # ★ 读库（自动负载均衡）
            load-balancer-name: round_robin                 # 负载均衡策略
        load-balancers:
          round_robin:
            type: ROUND_ROBIN
    props:
      sql-show: true                                       # ★ 打印路由后的 SQL（调试用）
```

> 【★★ 读写分离的核心风险：主从延迟】
> MySQL 主从复制是**异步**的（默认），主库提交后从库可能延迟几十毫秒到几秒。
> 典型问题：「创建订单成功 → 立即查订单 → 查不到」。
>
> **解决方案：**
> | 方案 | 说明 |
> | --- | --- |
> | ★ **写后立即读走主库** | 用 `@Master` 注解强制主库 |
> | ★ **事务内一律走主库** | `TransactionSynchronizationManager.isActualTransactionActive()` 判断 |
> | **半同步复制** | MySQL 的 `rpl_semi_sync_master`（至少一个从库确认，牺牲一点性能） |
> | **缓存标记** | 写入后在 Redis 标记 `user:123:dirty`（TTL 1s），期间读走主库 |
> | **前端延迟跳转** | 创建成功后不立即跳详情页（用前端数据兜底） |

### 2.4 整合 Spring Data JPA（对比）

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

```java
// ─── 实体（JPA 注解）───
@Entity
@Table(name = "t_user", indexes = {
    @Index(name = "idx_username", columnList = "user_name", unique = true)
})
@Data
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)       // 自增主键
    private Long id;

    @Column(name = "user_name", nullable = false, length = 50, unique = true)
    private String userName;

    @Column(columnDefinition = "int default 0")
    private Integer age;

    @Enumerated(EnumType.STRING)                               // ★ 枚举存字符串（不要用 ORDINAL）
    private UserStatus status;

    @Version                                                     // ★ 乐观锁
    private Integer version;

    @CreatedDate @Column(updatable = false)
    private LocalDateTime createTime;
    @LastModifiedDate
    private LocalDateTime updateTime;

    @ManyToOne(fetch = FetchType.LAZY)                           // ★ 懒加载
    @JoinColumn(name = "dept_id")
    private Dept dept;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Order> orders;
}

// ─── Repository（★ 零实现类）───
public interface UserRepository extends JpaRepository<User, Long>,
                                       JpaSpecificationExecutor<User> {
    // ★ 方法名自动生成 SQL
    User findByUserName(String userName);
    List<User> findByStatusAndAgeGreaterThan(UserStatus status, Integer age);
    List<User> findByUserNameContainingOrderByCreateTimeDesc(String keyword);
    Optional<User> findFirstByStatusOrderByCreateTimeDesc(UserStatus status);
    long countByDeptId(Long deptId);
    boolean existsByUserName(String userName);

    // ★ @Query 自定义（JPQL）
    @Query("SELECT u FROM User u WHERE u.dept.id = :deptId AND u.status = 'ENABLED'")
    List<User> findActiveByDept(@Param("deptId") Long deptId);

    // ★ 原生 SQL
    @Query(value = "SELECT * FROM t_user WHERE user_name LIKE %:kw%", nativeQuery = true)
    List<User> searchNative(@Param("kw") String keyword);

    // ★ 修改操作（必须加 @Modifying + @Transactional）
    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.status = :status WHERE u.id = :id")
    int updateStatus(@Param("id") Long id, @Param("status") UserStatus status);

    // ★ 分页
    Page<User> findByStatus(UserStatus status, Pageable pageable);

    // ★ 投影（只查部分字段，性能优化）
    @Query("SELECT u.userName AS userName, u.age AS age FROM User u WHERE u.status = :s")
    List<UserNameProjection> findNamesByStatus(@Param("s") UserStatus s);
}

public interface UserNameProjection {                     // ★ 接口投影
    String getUserName();
    Integer getAge();
}

// ─── 使用 ───
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    public Page<User> page(int pageNum, int pageSize) {
        // ★ Pageable 分页 + 排序
        Pageable pageable = PageRequest.of(pageNum - 1, pageSize,          // ★ 页码从 0 开始！
                Sort.by(Sort.Direction.DESC, "createTime"));
        return userRepository.findAll(pageable);
    }

    /** ★ 动态查询（Specification，等价于 MyBatis 的动态 SQL） */
    public List<User> search(UserQuery q) {
        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (StringUtils.hasText(q.getKeyword())) {
                predicates.add(cb.or(
                    cb.like(root.get("userName"), "%" + q.getKeyword() + "%"),
                    cb.like(root.get("email"), "%" + q.getKeyword() + "%")));
            }
            if (q.getStatus() != null) predicates.add(cb.equal(root.get("status"), q.getStatus()));
            if (q.getMinAge() != null) predicates.add(cb.greaterThanOrEqualTo(root.get("age"), q.getMinAge()));
            if (q.getStartTime() != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createTime"), q.getStartTime()));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return userRepository.findAll(spec);
    }
}
```

```yaml
spring:
  jpa:
    database-platform: org.hibernate.dialect.MySQLDialect
    hibernate:
      ddl-auto: none                        # ★★ 生产必须 none！绝不能 create/update
    show-sql: false                          # ★ 生产关闭（日志量大）
    open-in-view: false                      # ★★ 必须关闭！（默认 true 会有性能问题 + 警告日志）
    properties:
      hibernate:
        format_sql: true
        jdbc:
          batch_size: 50                     # ★ 批量操作大小
          fetch_size: 100
        order_inserts: true                   # ★ 排序后批量插入（提升性能）
        order_updates: true
        default_batch_fetch_size: 100         # ★ 缓解 N+1 问题
        generate_statistics: false
```

**MyBatis-Plus vs JPA 选型：**

| 对比 | MyBatis-Plus | JPA/Hibernate |
| --- | --- | --- |
| 单表 CRUD | ★ 零 SQL | ★ 零 SQL |
| 复杂查询 | ★ **手写 SQL，完全可控** | JPQL/Criteria，复杂 SQL 困难 |
| 性能优化 | ★ **容易**（SQL 透明） | 难（生成的 SQL 可能不优、N+1） |
| 学习成本 | ★ **低** | 高（一级/二级缓存、脏检查、懒加载、级联） |
| 数据库移植 | 差（SQL 方言） | ★ 好 |
| `open-in-view` 陷阱 | 无 | ★ 有（默认开启，性能差） |
| 国内生态 | ★★ **主流** | 少 |
| 适用 | ★ **互联网业务（复杂 SQL 多）** | 领域模型清晰、CRUD 为主、需跨库 |

> 【结论】**国内互联网项目首选 MyBatis-Plus**（SQL 可控 + 性能可优化）。JPA 适合领域驱动设计、业务模型稳定、SQL 简单的场景。

## 3. 数据库版本管理（Flyway / Liquibase）★★★★★

**问题：多环境（dev/test/prod）、多人协作时，数据库表结构如何同步？靠手动执行 SQL 一定会出错。**

### 3.1 Flyway（★ 推荐，简单直接）

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>                                      <!-- MySQL 8 需要 -->
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-mysql</artifactId>
</dependency>
```

```
src/main/resources/db/migration/
├── V1__init_schema.sql                       # ★ 版本号__描述.sql
├── V2__add_user_table.sql
├── V3__add_order_index.sql
├── V3.1__fix_column_type.sql                  # ★ 支持小数版本
├── V20260907103000__add_payment_table.sql      # ★ 时间戳版本（多人协作推荐，避免冲突）
├── R__create_user_view.sql                    # ★ R = Repeatable（内容变化就重跑）
└── U2__add_user_table.sql                     # U = Undo（回滚脚本，商业版）
```

```sql
-- V1__init_schema.sql（★ 幂等性：用 IF NOT EXISTS）
CREATE TABLE IF NOT EXISTS t_user (
    id            BIGINT       NOT NULL COMMENT '主键',
    user_name     VARCHAR(50)  NOT NULL COMMENT '用户名',
    password      VARCHAR(100) NOT NULL COMMENT '密码(BCrypt)',
    phone         VARCHAR(20)           COMMENT '手机号',
    status        TINYINT      NOT NULL DEFAULT 1 COMMENT '0-禁用 1-启用',
    deleted       TINYINT      NOT NULL DEFAULT 0 COMMENT '0-未删 1-已删',
    version       INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
    create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_name (user_name),
    KEY idx_phone (phone),
    KEY idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户表';

-- V2__add_dept_table.sql
CREATE TABLE IF NOT EXISTS t_dept (...);
ALTER TABLE t_user ADD COLUMN dept_id BIGINT NULL COMMENT '部门ID' AFTER status;
ALTER TABLE t_user ADD KEY idx_dept_id (dept_id);

-- V3__add_order_index.sql
ALTER TABLE t_order ADD INDEX idx_user_status (user_id, status);

-- R__create_user_view.sql（★ 视图/存储过程用 R 前缀，内容变了就重新执行）
CREATE OR REPLACE VIEW v_active_user AS
SELECT id, user_name, phone, create_time FROM t_user WHERE status = 1 AND deleted = 0;
```

```yaml
spring:
  flyway:
    enabled: true                              # ★ 开启
    locations: classpath:db/migration           # 脚本位置
    baseline-on-migrate: true                   # ★★ 对已有数据库建立基线（否则报错）
    baseline-version: 0                         # 基线版本（低于此版本的脚本不执行）
    baseline-description: "init baseline"
    validate-on-migrate: true                   # ★ 迁移前校验（脚本被改过则失败）
    out-of-order: false                         # ★ 是否允许乱序执行（多人协作时可设 true）
    clean-disabled: true                        # ★★ 禁止 clean（防止误删生产数据库！）
    table: flyway_schema_history                # 记录表名
    encoding: UTF-8
    sql-migration-prefix: V
    repeatable-sql-migration-prefix: R
    sql-migration-separator: __                 # ★ 两个下划线
    target: latest
    connect-retries: 3
    placeholder-replacement: false               # 是否替换 ${} 占位符（★ false 避免与 SQL 冲突）
```

```
# ─── Flyway 的工作原理 ───
① 应用启动时（★ 在 JPA/MyBatis 初始化之前）
② 检查数据库中是否有 flyway_schema_history 表
   - 没有 → 创建它（如果 baseline-on-migrate=true，则先建基线记录）
   - 有 → 读取已执行的版本记录
③ 扫描 locations 下的脚本，与记录对比
④ ★ 按版本号升序执行未执行的脚本
⑤ 每个脚本执行成功后，往 history 表插入一条记录
⑥ 校验已执行脚本的 checksum，若被修改 → ★ 启动失败（防止脚本被篡改）
```

**`flyway_schema_history` 表内容示例：**

| installed_rank | version | description | type | script | checksum | installed_by | installed_on | execution_time | success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | *(空)* | init baseline | BASELINE | `<< Flyway Baseline >>` | NULL | root | 2026-09-01 10:00:00 | 0 | 1 |
| 2 | 2 | add dept table | SQL | `V2__add_dept_table.sql` | 12345678 | root | 2026-09-02 10:00:00 | 45 | 1 |
| 3 | 3 | add order index | SQL | `V3__add_order_index.sql` | 87654321 | root | 2026-09-03 10:00:00 | 320 | 1 |

其中 `checksum` 是脚本内容的校验和（★ 改动已执行的脚本会导致 checksum 不匹配 → 启动失败），`execution_time` 单位是毫秒。

**Flyway 最佳实践（★ 生产铁律）：**

| 规则 | 说明 |
| --- | --- |
| ★ **已执行的脚本绝不修改** | 改了会导致 checksum 校验失败，启动不了。要改用新版本号 |
| ★ **脚本必须幂等** | 用 `IF NOT EXISTS`、`IF EXISTS`，防止部分失败后重跑出错 |
| ★ **生产环境 `clean-disabled: true`** | 防止误执行 clean（清空数据库！） |
| ★ **版本号用时间戳** | `V20260907103000__xxx.sql`，避免多人协作时版本号冲突 |
| **DDL 与 DML 分开** | 表结构变更和数据修复用不同脚本 |
| **大表 DDL 用在线工具** | `ALTER TABLE` 大表会锁表 → 用 gh-ost / pt-online-schema-change |
| **回滚靠正向脚本** | Flyway 社区版无 Undo，回滚要写新的正向脚本（`V4__rollback_xxx.sql`） |
| **CI 中校验** | 提交前跑 `flyway validate`，防止破坏性变更 |
| **备份优先** | 执行迁移前必须有备份 |

### 3.2 Liquibase（对比）

| | Flyway | Liquibase |
| --- | --- | --- |
| 脚本格式 | ★ **SQL**（也支持 Java） | XML / YAML / JSON / SQL |
| 学习成本 | ★ **低** | 中 |
| 数据库无关 | ❌（SQL 有方言） | ★ **是**（用抽象标签） |
| 回滚支持 | 商业版 | ★ **社区版支持**（rollback 标签） |
| 适用 | ★ 中小项目、SQL 熟悉者 | 需要跨数据库、复杂回滚 |

```xml
<!-- Liquibase 的 XML 脚本示例 -->
<changeSet id="1" author="yourname">
    <createTable tableName="t_user">
        <column name="id" type="BIGINT"><constraints primaryKey="true" nullable="false"/></column>
        <column name="user_name" type="VARCHAR(50)"><constraints unique="true" nullable="false"/></column>
    </createTable>
    <rollback>
        <dropTable tableName="t_user"/>          <!-- ★ 回滚定义 -->
    </rollback>
</changeSet>
```

## 4. JdbcTemplate（简单场景的利器）

```java
@Service
@RequiredArgsConstructor
public class StatService {

    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;      // ★ 命名参数版本

    public void demo() {
        // ─── 查询单个值 ───
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM t_user", Long.class);
        String name = jdbcTemplate.queryForObject(
                "SELECT user_name FROM t_user WHERE id = ?", String.class, 1L);

        // ─── 查询单行 ───
        User user = jdbcTemplate.queryForObject(
                "SELECT * FROM t_user WHERE id = ?",
                BeanPropertyRowMapper.newInstance(User.class),        // ★ 自动映射（驼峰）
                1L);
        // 或自定义 RowMapper
        User user2 = jdbcTemplate.queryForObject("SELECT * FROM t_user WHERE id = ?",
                (rs, rowNum) -> {
                    User u = new User();
                    u.setId(rs.getLong("id"));
                    u.setUserName(rs.getString("user_name"));
                    return u;
                }, 1L);

        // ─── 查询多行 ───
        List<User> users = jdbcTemplate.query("SELECT * FROM t_user WHERE status = ?",
                BeanPropertyRowMapper.newInstance(User.class), 1);

        // ─── 查询为 Map ───
        List<Map<String, Object>> maps = jdbcTemplate.queryForList(
                "SELECT dept_id, COUNT(*) AS cnt FROM t_user GROUP BY dept_id");

        // ─── ★ 查询第一列为 List ───
        List<Long> ids = jdbcTemplate.queryForList("SELECT id FROM t_user", Long.class);

        // ─── 插入/更新/删除（返回影响行数）───
        int rows = jdbcTemplate.update(
                "INSERT INTO t_user (user_name, age) VALUES (?, ?)", "张三", 20);
        // ★ 获取自增主键
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(conn -> {
            PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO t_user (user_name) VALUES (?)",
                    Statement.RETURN_GENERATED_KEYS);              // ★ 返回主键
            ps.setString(1, "李四");
            return ps;
        }, keyHolder);
        Long newId = keyHolder.getKey().longValue();

        // ─── ★ 批量操作（性能高）───
        List<Object[]> batchArgs = users.stream()
                .map(u -> new Object[]{u.getUserName(), u.getAge(), u.getId()})
                .toList();
        int[] results = jdbcTemplate.batchUpdate(
                "UPDATE t_user SET user_name = ?, age = ? WHERE id = ?", batchArgs);

        // ─── ★ 命名参数（可读性更好，参数可复用）───
        Map<String, Object> params = Map.of("status", 1, "minAge", 18, "name", "%张%");
        List<User> list = namedJdbcTemplate.query(
                "SELECT * FROM t_user WHERE status = :status AND age >= :minAge AND user_name LIKE :name",
                params, BeanPropertyRowMapper.newInstance(User.class));
        // 支持 List 参数自动展开为 IN
        namedJdbcTemplate.query("SELECT * FROM t_user WHERE id IN (:ids)",
                Map.of("ids", List.of(1, 2, 3)), rowMapper);

        // ─── ★ 流式查询（大数据量，不 OOM）───
        jdbcTemplate.query("SELECT * FROM t_user", rs -> {
            while (rs.next()) {                                  // ★ 逐行处理
                processOne(rs.getLong("id"), rs.getString("user_name"));
            }
        });
        // 或用 RowCallbackHandler
        jdbcTemplate.query("SELECT * FROM t_user", rs -> process(rs));
    }
}
```

**JdbcTemplate vs MyBatis 的选择：**

| 场景 | 选择 |
| --- | --- |
| 复杂业务 CRUD、动态 SQL | ★ **MyBatis/MP** |
| 简单统计、报表查询、一次性数据修复 | ★ **JdbcTemplate** |
| 需要执行原生 SQL 函数、存储过程 | JdbcTemplate |
| 批量数据迁移 | JdbcTemplate（batchUpdate 简洁） |
| 已有 MyBatis 的项目 | MyBatis（保持一致性） |

## 5. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 连接池 max-lifetime > MySQL wait_timeout | 偶发 `Communications link failure` | ★ max-lifetime 小于 wait_timeout |
| 2 | maximum-pool-size 设太大 | 吞吐量下降、MySQL 连接数爆 | 按公式 `CPU*2+磁盘数`，压测验证 |
| 3 | 未设 connection-timeout | 请求无限等待 | 设为 3000ms（快速失败） |
| 4 | 连接泄漏 | 池耗尽，服务不可用 | `leak-detection-threshold` + 检查未关闭的资源 |
| 5 | Druid 监控页未设密码 | ★ 数据泄漏（任何人可看 SQL 和数据源） | 必设 username/password + IP 白名单 |
| 6 | Druid 的 wall filter 误拦合法 SQL | SQL 执行失败 | 调整 wall 配置或关闭 |
| 7 | 多数据源事务未指定 transactionManager | 事务管错库、不回滚 | ★ `@Transactional("logTxManager")` |
| 8 | 跨数据源期望原子性 | 数据不一致 | 用 Seata 或本地消息表 |
| 9 | 多数据源的 @Primary 未设 | 注入歧义报错 | 主数据源加 `@Primary` |
| 10 | Hikari 用 `url` 而非 `jdbc-url` | `@ConfigurationProperties` 绑定失败 | 多数据源时 Hikari 用 `jdbc-url` |
| 11 | 读写分离后刚写入查不到 | ★ 主从延迟 | 写后读走主库 / `@Master` / 事务内走主库 |
| 12 | 数据源切面在事务之后执行 | 事务已开启但数据源没切 | ★ 切面 `@Order(-1)`（在事务切面之前） |
| 13 | ThreadLocal 未清理 | 数据源串号（下一个请求用错库） | finally 中 `clear()` |
| 14 | 线程池中 ThreadLocal 不传递 | 子线程用默认数据源 | 用 TransmittableThreadLocal 或显式传递 |
| 15 | JPA 的 `open-in-view` 默认开启 | 性能差 + 警告日志 | ★ 设为 false |
| 16 | JPA 的 `ddl-auto: update` 上生产 | ★ 表结构被意外修改/数据丢失 | 生产必须 `none`，用 Flyway |
| 17 | JPA N+1 查询 | 一次列表查询触发 N 次子查询 | `@EntityGraph` / JOIN FETCH / `default_batch_fetch_size` |
| 18 | `@Enumerated(EnumType.ORDINAL)` | 枚举顺序变化导致数据错乱 | 用 `EnumType.STRING` 或自定义 code |
| 19 | 批量插入未开 `rewriteBatchedStatements` | 性能提升不明显 | JDBC URL 加该参数 |
| 20 | Flyway 修改了已执行的脚本 | ★ 启动失败（checksum 不匹配） | 新建版本号的脚本 |
| 21 | Flyway 脚本不幂等 | 部分失败后重跑出错 | 用 `IF NOT EXISTS` |
| 22 | Flyway 多人协作版本号冲突 | 迁移顺序错乱 | 用时间戳版本号 `V20260907103000__` |
| 23 | 生产 Flyway 未禁 clean | 误清库 | `clean-disabled: true` |
| 24 | 大表 ALTER TABLE 锁表 | 服务不可用 | 用 gh-ost / pt-online-schema-change |
| 25 | 未设 SQL 超时 | 慢 SQL 拖垮连接池 | `default-statement-timeout` + HikariCP 超时 |
| 26 | 连接池监控缺失 | 池耗尽才发现 | 暴露 HikariCP/Druid 指标到 Prometheus |

---

## 关联笔记

- 上一篇：[[后端/SpringBoot/配置文件与自定义Starter]]
- 下一篇：[[后端/SpringBoot/整合Web开发]]
- 相关：[[后端/MyBatis/MyBatisPlus]]、[[后端/MyBatis/MyBatis入门与核心配置]]、[[后端/MyBatis/缓存机制与插件开发]]
- 事务：[[后端/Spring/事务管理与失效场景]]、[[后端/微服务/Seata分布式事务]]（分布式事务）
- 数据库原理：[[后端/数据库/MySQL/事务与锁机制]]、[[后端/数据库/MySQL/索引与执行计划]]、[[后端/数据库/MySQL/慢查询与性能优化]]
- Redis：[[后端/中间件/Redis在Java项目中的整合]]、[[后端/数据库/Redis/Redis学习笔记]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
