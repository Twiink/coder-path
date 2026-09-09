---
title: "配置文件与自定义Starter"
aliases:
  - "application.yml"
  - "@ConfigurationProperties"
  - "自定义 Starter"
tags:
  - "后端"
  - "java"
  - "spring"
  - "springboot"
category: "后端"
folder: "SpringBoot"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/SpringBoot/自动配置原理]]"
  - "[[后端/SpringBoot/SpringBoot入门与项目搭建]]"
  - "[[后端/SpringBoot/整合数据访问层]]"
  - "[[后端/微服务/Nacos注册中心与配置中心]]"
created: 2026-09-07
updated: 2026-09-07
---

# 配置文件与自定义 Starter

## 1. 配置文件的类型与加载 ★★★★★

### 1.1 properties vs yml

| | `.properties` | ★ **`.yml`** |
| --- | --- | --- |
| 层级表达 | 重复前缀（`a.b.c=1`） | ★ 缩进（更清晰） |
| 列表 | `a[0]=x`、`a[1]=y` | ★ `- x`、`- y` |
| 注释 | `#` | `#` |
| 单文件多环境 | ❌ | ★ **`---` 分隔** |
| 复杂结构 | 繁琐 | ★ 优雅 |
| IDE 提示 | 有 | 有（需 configuration-processor） |
| 加载优先级 | ★ **高于 yml**（同前缀时覆盖） | 低 |
| 缩进要求 | 无 | ★ **严格**（只能空格，**禁止 Tab**） |

```yaml
# ─── YAML 语法要点 ───
# ① 键值对（冒号后【必须有空格】）
server:
  port: 8080                    # ✅
  #port:8080                    # ❌ 无空格，解析错误

# ② 字符串（一般不用引号）
spring:
  application:
    name: mall-service          # 普通字符串
    desc: "带: 冒号的字符串"     # ★ 特殊字符要加引号
    path: 'C:\data\logs'         # ★ 单引号不转义（\ 是字面量）
    msg: "第一行\n第二行"        # ★ 双引号会转义（\n 是换行）

# ③ ★ 列表（短横线 + 空格）
  list:
    - item1
    - item2
    - item3
  # 行内写法（flow style）
  list2: [item1, item2, item3]

# ④ ★ 对象列表
  users:
    - name: tom
      age: 20
    - name: jerry
      age: 18
  # 行内
  users2: [{name: tom, age: 20}, {name: jerry, age: 18}]

# ⑤ Map
  map:
    key1: value1
    key2: value2

# ⑥ ★ 多行字符串
  script: |                       # | 保留换行（块标量）
    line1
    line2
  folded: >                       # > 折叠换行为空格
    line1
    line2
  chomped: |-                     # |- 保留换行且去掉末尾空行
    no trailing newline

# ⑦ ★ 单文件多环境（用 --- 分隔）
spring:
  application:
    name: mall
---
spring:
  config:
    activate:
      on-profile: dev              # ★ Boot 2.4+ 的新语法
server:
  port: 8080
---
spring:
  config:
    activate:
      on-profile: prod
server:
  port: 80
---
# ★ 老语法（Boot 2.3 及以前）
spring:
  profiles: prod
  config:
    activate:
      on-profile: prod             # 两种不能混用！

# ⑧ ★ 锚点与引用（避免重复）
defaults: &defaults                 # 定义锚点
  timeout: 3000
  retries: 3
service-a:
  <<: *defaults                     # ★ 合并锚点（继承所有属性）
  url: http://a.com
service-b:
  <<: *defaults
  timeout: 5000                     # ★ 覆盖锚点中的值
  url: http://b.com

# ⑨ 引用其他属性
app:
  base-path: /data
  log-path: ${app.base-path}/logs        # ★ 引用
  name: ${spring.application.name}
  full: "${app.name} - ${app.version}"

# ⑩ 数字与布尔（★ 注意隐式转换的坑）
  port: 8080                        # int
  ratio: 0.85                        # double
  enabled: true                      # boolean
  version: 1.10                      # ★ 是 1.1（浮点），不是 "1.10"！
  zip: "07701"                       # ★ 邮编要加引号（否则被解析为 7701）
  on/off/yes/no: "off"               # ★ YAML 1.1 中 on/off/yes/no 是布尔值！加引号更安全
```

> 【★ YAML 经典坑】**YAML 1.1 规范中，`yes`/`no`/`on`/`off`/`true`/`false` 都被解析为布尔值**！
> 例如挪威国家代码 `NO` 会被解析成 `false`。解决办法：**用引号包裹**。
> ```yaml
> countries:
>   - "NO"        # ✅ 字符串 "NO"
>   - NO          # ❌ false
> country-code: "SE"   # ✅（SE 没问题，但养成加引号的习惯）
> ```

### 1.2 配置文件的加载位置与优先级 ★★★★★

```
★ 优先级从高到低（高优先级覆盖低优先级）：

① 命令行参数
   java -jar app.jar --server.port=9090 --spring.profiles.active=prod

② SPRING_APPLICATION_JSON（内嵌 JSON）
   export SPRING_APPLICATION_JSON='{"server":{"port":9090}}'

③ Java 系统属性（-D）
   java -Dserver.port=9090 -jar app.jar

④ 操作系统环境变量
   export SERVER_PORT=9090              ★ 松散绑定：SERVER_PORT → server.port

⑤ JNDI（java:comp/env）

⑥ ★ jar 包【外部】的 profile 专属配置
   ./config/application-prod.yml
   ./application-prod.yml

⑦ ★ jar 包【内部】的 profile 专属配置
   classpath:/config/application-prod.yml
   classpath:/application-prod.yml

⑧ ★ jar 包【外部】的通用配置
   ./config/application.yml
   ./application.yml

⑨ ★ jar 包【内部】的通用配置
   classpath:/config/application.yml
   classpath:/application.yml           ★ 最常用

⑩ @PropertySource 引入的配置

⑪ SpringApplication.setDefaultProperties()
```

**外部配置目录（★ 生产部署的关键）：**

```
/deploy/
├── app.jar                          # 应用包（不含环境配置）
├── config/                          # ★ 优先级最高的外部配置目录
│   ├── application.yml               # 通用配置（覆盖 jar 内的）
│   ├── application-prod.yml          # 生产环境
│   └── logback-spring.xml            # 日志配置
└── logs/

# 启动（外部配置自动覆盖 jar 内配置）
java -jar app.jar --spring.profiles.active=prod

# 或显式指定配置文件位置（★ 优先级更高）
java -jar app.jar --spring.config.location=file:/deploy/config/
java -jar app.jar --spring.config.additional-location=file:/deploy/config/
#   location          = ★ 【替换】默认位置（jar 内的配置不加载）
#   additional-location = ★ 【追加】（jar 内的仍加载，外部的覆盖）★ 推荐

# 指定具体文件
java -jar app.jar --spring.config.location=file:/deploy/config/application.yml,classpath:/application.yml
```

### 1.3 配置属性源（PropertySource）

```java
// ─── Environment：配置的统一访问入口 ───
@Component
@RequiredArgsConstructor
public class ConfigReader {

    private final Environment env;

    public void read() {
        // ★ 读取单个属性（带类型转换）
        String name = env.getProperty("spring.application.name");
        Integer port = env.getProperty("server.port", Integer.class);
        Boolean debug = env.getProperty("debug", Boolean.class, false);        // 带默认值
        Duration timeout = env.getProperty("app.timeout", Duration.class);      // ★ 支持 Duration
        DataSize maxSize = env.getProperty("app.max-size", DataSize.class);     // ★ 支持 DataSize
        List<String> list = env.getProperty("app.list", List.class);
        String[] arr = env.getProperty("app.array", String[].class);

        // 必须存在的属性（不存在抛异常）
        String required = env.getRequiredProperty("db.url");
        Integer requiredPort = env.getRequiredProperty("server.port", Integer.class);

        // 属性是否存在
        boolean exists = env.containsProperty("app.custom");

        // ★ Profile 相关
        String[] active = env.getActiveProfiles();               // 激活的 profile
        String[] defaultP = env.getDefaultProfiles();            // 默认 profile
        boolean isProd = env.matchesProfiles("prod");            // 是否匹配
        boolean isDevOrTest = env.matchesProfiles("dev | test");  // 支持表达式
        boolean notProd = env.matchesProfiles("!prod");

        // ★ 属性占位符解析
        String resolved = env.resolvePlaceholders("${app.name} - ${server.port}");
        String required2 = env.resolveRequiredPlaceholders("${app.name}");

        // ★ 遍历所有属性源（诊断用）
        if (env instanceof ConfigurableEnvironment ce) {
            for (PropertySource<?> ps : ce.getPropertySources()) {
                log.info("属性源: {} ({})", ps.getName(), ps.getClass().getSimpleName());
                if (ps instanceof EnumerablePropertySource<?> eps) {
                    // 打印该源的所有 key
                    log.info("  keys: {}", Arrays.toString(eps.getPropertyNames()));
                }
            }
        }
    }
}

// ─── 用 @Value 注入 ───
@Component
public class ValueDemo {
    @Value("${app.name}") private String name;
    @Value("${app.name:默认名}") private String nameWithDefault;
    @Value("${app.list}") private List<String> list;              // 逗号分隔自动转 List
    @Value("#{'${app.list}'.split(',')}") private List<String> list2;   // SpEL 分割
    @Value("${app.timeout:30}") private int timeout;
    @Value("#{T(java.lang.Math).PI}") private double pi;           // SpEL 静态字段
    @Value("#{${app.ratio} * 100}") private double calculated;     // SpEL 运算
    @Value("${app.map.key1}") private String mapValue;             // Map 的某个 key
    @Value("#{systemProperties['user.home']}") private String home;
    @Value("#{systemEnvironment['PATH']}") private String path;
    @Value("#{new java.util.Date()}") private Date now;             // SpEL 构造对象
    @Value("#{otherBean.name}") private String fromBean;            // 引用其他 Bean

    // ⚠️ @Value 的限制：
    // ① 不能用在 static 字段（注入为 null）
    // ② 不能注入复杂嵌套结构（用 @ConfigurationProperties）
    // ③ 构造函数注入需要 @Autowired（多构造器时）
}
```

**@Value vs @ConfigurationProperties（★ 必考）：**

| 对比 | `@Value` | ★ **`@ConfigurationProperties`** |
| --- | --- | --- |
| 功能 | 单个属性注入 | ★ **批量绑定到对象** |
| 松散绑定 | ❌（必须完全匹配） | ★ ✅（`max-size` = `maxSize` = `MAX_SIZE`） |
| SpEL | ★ ✅ 支持 | ❌ 不支持 |
| 复杂类型 | ❌（List/Map/嵌套对象麻烦） | ★ ✅ **完美支持** |
| JSR-303 校验 | ❌ | ★ ✅ 支持 `@Validated` |
| 元数据提示 | ❌ | ★ ✅（配合 configuration-processor） |
| Duration/DataSize | ⚠️ 需自己转 | ★ ✅ 原生支持 |
| 嵌套配置 | ❌ | ★ ✅ |
| 适用 | 简单值、SpEL 运算 | ★ **成组的配置** |

## 2. @ConfigurationProperties 详解 ★★★★★

### 2.1 基本用法与注册方式

```java
// ─── 属性类（★ 完整规范写法）───
/**
 * ★ 订单模块配置
 *
 * @author yourname
 */
@Data                                                // Lombok（或用 getter/setter）
@ConfigurationProperties(prefix = "mall.order")       // ★ 前缀（必须是 kebab-case）
@Validated                                             // ★ 开启 JSR-303 校验
public class OrderProperties {

    /** 是否启用订单模块 */
    private boolean enabled = true;                     // ★ 提供默认值

    /** 订单支付超时时间（支持 30s、5m、1h、2d） */
    @NotNull(message = "支付超时时间不能为空")
    private Duration payTimeout = Duration.ofMinutes(30);

    /** 单个用户最大待支付订单数 */
    @Min(value = 1, message = "至少为 1")
    @Max(value = 100, message = "最多 100")
    private int maxPendingOrders = 5;

    /** 订单号前缀 */
    @NotBlank(message = "订单号前缀不能为空")
    @Pattern(regexp = "^[A-Z]{2,5}$", message = "必须是 2~5 位大写字母")
    private String orderNoPrefix = "ORD";

    /** 自动关闭的 cron 表达式 */
    private String closeCron = "0 */5 * * * ?";

    /** ★ 嵌套对象（必须初始化为 final 或提供 setter） */
    private final Notify notify = new Notify();          // ★ final + 无 setter（构造器绑定）

    /** ★ List */
    private List<String> whiteList = new ArrayList<>();

    /** ★ Map（key 支持复杂格式） */
    private Map<String, Duration> itemTimeout = new HashMap<>();

    /** ★ List<Map> */
    private List<Rule> rules = new ArrayList<>();

    /** 枚举 */
    private Strategy strategy = Strategy.STRICT;

    /** 文件大小（支持 10MB、1GB） */
    private DataSize maxAttachmentSize = DataSize.ofMegabytes(10);

    @Data
    public static class Notify {
        /** 是否发送短信 */
        private boolean smsEnabled = true;
        /** 模板 ID */
        private String templateId;
        /** 重试次数 */
        private int maxRetry = 3;
    }

    @Data
    public static class Rule {
        private String name;
        private BigDecimal minAmount;
        private BigDecimal maxAmount;
        private List<String> tags;
    }

    public enum Strategy {
        /** 严格模式 */
        STRICT,
        /** 宽松模式 */
        LOOSE
    }
}
```

```yaml
# 对应的 YAML（★ 松散绑定：以下写法都能绑定到同一个字段）
mall:
  order:
    enabled: true
    pay-timeout: 30m                # ★ kebab-case（推荐，官方规范）
    # payTimeout: 30m               # camelCase（也支持）
    # pay_timeout: 30m              # snake_case（也支持）
    # PAY_TIMEOUT: 30m              # 环境变量风格（也支持）
    max-pending-orders: 10
    order-no-prefix: "MALL"
    close-cron: "0 0/5 * * * ?"
    strategy: LOOSE                  # ★ 枚举（不区分大小写）
    max-attachment-size: 20MB        # ★ DataSize
    notify:                          # ★ 嵌套对象
      sms-enabled: true
      template-id: "SMS_123456"
      max-retry: 5
    white-list:                      # ★ List
      - "user-a"
      - "user-b"
    item-timeout:                    # ★ Map
      default: 30m
      presale: 24h
      flash-sale: 5m
    rules:                           # ★ List<Object>
      - name: "小额订单"
        min-amount: 0
        max-amount: 100
        tags: ["small"]
      - name: "大额订单"
        min-amount: 10000
        max-amount: 99999999
        tags: ["large", "audit"]
```

**四种注册方式：**

```java
// ─── 方式 1：@EnableConfigurationProperties（★ 推荐，在配置类中）───
@Configuration
@EnableConfigurationProperties(OrderProperties.class)      // ★ 显式注册
public class OrderConfig {
    @Bean
    public OrderService orderService(OrderProperties props) {
        return new OrderService(props);
    }
}

// ─── 方式 2：@ConfigurationPropertiesScan（★ 批量扫描）───
@SpringBootApplication
@ConfigurationPropertiesScan("com.example.mall.config")     // ★ 扫描包下所有属性类
public class Application { }

// ─── 方式 3：@Component（★ 让属性类自己成为 Bean）───
@Component
@ConfigurationProperties(prefix = "mall.order")
public class OrderProperties { }
// ⚠️ 缺点：属性类与 Spring 耦合；且如果同时用了 @EnableConfigurationProperties 会注册两次

// ─── 方式 4：@Bean + @ConfigurationProperties（★ 第三方类无法加注解时）───
@Configuration
public class ThirdPartyConfig {
    @Bean
    @ConfigurationProperties(prefix = "mall.datasource")     // ★ 直接绑定到 Bean
    public DataSource dataSource() {
        return DataSourceBuilder.create().build();           // 第三方类，无法加注解
    }

    @Bean
    @ConfigurationProperties("mall.redis")
    public RedisStandaloneConfiguration redisConfig() {
        return new RedisStandaloneConfiguration();
    }
}

// ─── 方式 5：构造器绑定（★ 不可变对象，推荐用于 starter）───
@ConfigurationProperties(prefix = "mall.sms")
@Validated
public class SmsProperties {
    private final String accessKey;
    private final String secretKey;
    private final Duration timeout;

    /** ★ 只有一个构造器时自动使用构造器绑定（无需 @ConstructorBinding） */
    public SmsProperties(String accessKey,
                         String secretKey,
                         @DefaultValue("5s") Duration timeout) {
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.timeout = timeout;
    }
    // ★ 只有 getter，无 setter → 真正的不可变对象，线程安全
    public String getAccessKey() { return accessKey; }
    public String getSecretKey() { return secretKey; }
    public Duration getTimeout() { return timeout; }
}
// Boot 2.2~2.x 需要显式 @ConstructorBinding（类或构造器上）
// Boot 3.0+ 单构造器自动识别，多构造器时才需要 @ConstructorBinding
```

### 2.2 校验

```java
@ConfigurationProperties(prefix = "mall.order")
@Validated                                              // ★ 必须加，否则校验注解无效
public class OrderProperties {

    @NotNull
    @Min(1) @Max(100)
    private Integer maxPendingOrders;

    @NotBlank
    @Pattern(regexp = "^[A-Z]{2,5}$")
    private String orderNoPrefix;

    @Valid                                               // ★ 级联校验嵌套对象
    @NotNull
    private final Notify notify = new Notify();

    @NotEmpty(message = "白名单不能为空")
    private List<@NotBlank String> whiteList;             // ★ 校验集合元素

    @Valid
    private List<Rule> rules;

    @Data
    public static class Notify {
        @NotBlank(message = "模板 ID 不能为空")            // ★ 嵌套对象的校验
        private String templateId;
    }
}

// 校验失败的效果：★ 应用【启动失败】，并给出详细报告
/*
***************************
APPLICATION FAILED TO START
***************************

Description:

Binding to target [class com.example.mall.config.OrderProperties] failed:

    Property: mall.order.order-no-prefix
    Value: "abc"
    Reason: 必须是 2~5 位大写字母

    Property: mall.order.notify.template-id
    Value: null
    Reason: 模板 ID 不能为空

Action:

Update your application's configuration
*/
// ★ 这是 Boot 的「快速失败」设计：配置错误在启动时就暴露，而非运行时
```

### 2.3 松散绑定规则 ★★★★★

| 字段名 | properties | YAML | 环境变量 | 说明 |
| --- | --- | --- | --- | --- |
| `maxSize` | `max-size` ★ / `maxSize` / `max_size` / `MAX_SIZE` | `max-size` ★ | `MAX_SIZE` | ★ kebab-case 是官方推荐 |
| `app.name` | `app.name` | `app.name` | `APP_NAME` | — |
| Map 的 key | `map.key-with-dash` | `"[key-with-dash]"` ★ | — | ★ 保留特殊字符要用 `[]` |
| 数字索引 | `list[0]` | `- item` | `LIST_0_` | — |

```yaml
# ─── Map 的 key 含特殊字符时必须用 [] 包裹 ───
mall:
  cache:
    configs:
      "[user:info]": 30m            # ★ key 是 "user:info"
      "[/api/v1/users]": 5m          # ★ key 是 URL
      "simple-key": 10m              # 普通 key 不用括号
```

```java
// ─── 环境变量的转换规则（★ K8s/Docker 部署关键）───
// YAML 属性           环境变量
// server.port         SERVER_PORT
// spring.datasource.url   SPRING_DATASOURCE_URL
// mall.order.max-pending-orders   MALL_ORDER_MAXPENDINGORDERS   ★ 注意：kebab 被去掉
// mall.order.rules[0].name        MALL_ORDER_RULES_0_NAME
// logging.level.com.example       LOGGING_LEVEL_COM_EXAMPLE

// ★ 规则：点 → 下划线；短横线 → 删除（或下划线）；全大写
// 实践：Docker 环境变量建议用下划线分隔且全大写
//   docker run -e SERVER_PORT=9090 -e SPRING_PROFILES_ACTIVE=prod app
```

### 2.4 Binder API（编程式绑定）

```java
// ─── Binder：不用注解，编程式绑定任意前缀 ───
@Component
public class DynamicConfigService {

    private final Environment environment;
    public DynamicConfigService(Environment env) { this.environment = env; }

    /** ★ 动态绑定（前缀在运行时确定） */
    public OrderProperties loadOrderConfig() {
        return Binder.get(environment)
                .bind("mall.order", OrderProperties.class)
                .orElseGet(OrderProperties::new);              // 绑定失败用默认对象
    }

    /** 绑定单个值 */
    public String getName() {
        return Binder.get(environment)
                .bind("mall.name", String.class)
                .orElse("default-name");
    }

    /** 绑定 Map */
    public Map<String, String> getMap() {
        return Binder.get(environment)
                .bind("mall.map", Bindable.mapOf(String.class, String.class))
                .orElse(Collections.emptyMap());
    }

    /** 绑定 List */
    public List<String> getList() {
        return Binder.get(environment)
                .bind("mall.list", Bindable.listOf(String.class))
                .orElse(Collections.emptyList());
    }

    /** 检查属性是否存在 */
    public boolean exists(String prefix) {
        return Binder.get(environment).bind(prefix, Bindable.of(String.class)).isBound();
    }

    /** ★ 绑定到已有对象（不新建） */
    public void bindTo(OrderProperties existing) {
        Binder.get(environment).bind("mall.order", Bindable.ofInstance(existing));
    }

    /** ★ 从任意 Map 绑定（不依赖 Environment） */
    public OrderProperties bindFromMap(Map<String, Object> map) {
        Map<String, Object> flat = new HashMap<>();
        map.forEach((k, v) -> flat.put("mall.order." + k, v));
        return new Binder(new MapConfigurationPropertySource(flat))
                .bind("mall.order", OrderProperties.class)
                .orElse(null);
    }
}
```

## 3. Profile 多环境管理 ★★★★★

### 3.1 Profile 的激活方式

```yaml
# ─── application.yml（主配置：公共部分 + 激活哪个 profile）───
spring:
  application:
    name: mall-service
  profiles:
    active: dev                      # ★ 默认激活 dev
    # active: ${SPRING_PROFILES_ACTIVE:dev}   # ★ 从环境变量读，默认 dev
    include:                          # ★ 额外包含（与 active 叠加）
      - common
      - monitor
    group:                            # ★★ Profile 分组（Boot 2.4+）
      prod:
        - proddb                      # prod 组包含 proddb、prodmq
        - prodmq
      dev:
        - devdb
        - local-cache
    default: dev                       # 未指定 active 时的默认值
```

```
src/main/resources/
├── application.yml              # 公共配置（所有环境共享）
├── application-dev.yml          # 开发环境
├── application-test.yml         # 测试环境
├── application-pre.yml          # 预发布环境
├── application-prod.yml         # ★ 生产环境
├── application-proddb.yml       # 生产数据库（组内）
├── application-prodmq.yml       # 生产 MQ（组内）
└── application-local.yml        # 本地（不提交 git）
```

**六种激活方式（★ 优先级从低到高）：**

| # | 方式 | 示例 |
| --- | --- | --- |
| 1 | **yml 中指定** | `spring.profiles.active: dev` |
| 2 | **properties 中指定** | `spring.profiles.active=dev` |
| 3 | **命令行参数** ★ | `java -jar app.jar --spring.profiles.active=prod` |
| 4 | **JVM 系统属性** | `java -Dspring.profiles.active=prod -jar app.jar` |
| 5 | **环境变量** ★ | `export SPRING_PROFILES_ACTIVE=prod`（Docker/K8s 常用） |
| 6 | **编程式** | `SpringApplication.setAdditionalProfiles("prod")` |

```java
// ─── 编程式激活 ───
public static void main(String[] args) {
    SpringApplication app = new SpringApplication(Application.class);
    app.setAdditionalProfiles("prod", "monitor");        // ★ 追加 profile
    // app.setDefaultProperties(Map.of("spring.profiles.active", "dev"));
    app.run(args);
}

// ─── 按 Profile 注册 Bean（★ 多环境不同实现）───
@Configuration
public class DataSourceConfig {

    @Bean
    @Profile("dev")                                    // ★ 只在 dev 生效
    public DataSource devDataSource() {
        return new EmbeddedDatabaseBuilder()
                .setType(EmbeddedDatabaseType.H2)
                .addScript("classpath:db/schema.sql")
                .build();
    }

    @Bean
    @Profile({"prod", "pre"})                           // 多个 profile
    public DataSource prodDataSource() { return DataSourceBuilder.create().build(); }

    @Bean
    @Profile("!dev")                                    // ★ 取反（非 dev）
    public DataSource otherDataSource() { return null; }

    @Bean
    @Profile("dev & debug")                             // ★ 表达式（且）
    public DebugTool debugTool() { return new DebugTool(); }

    @Bean
    @Profile("(prod | pre) & !readonly")                // ★ 复杂表达式
    public WriteService writeService() { return new WriteService(); }
}

// ─── 类级别的 @Profile ───
@Component
@Profile("dev")
public class DevOnlyTool { }

// ─── 判断当前 Profile ───
@Component
public class ProfileChecker implements EnvironmentAware {
    private Environment env;
    @Override public void setEnvironment(Environment e) { this.env = e; }

    public void check() {
        if (env.matchesProfiles("prod")) { /* 生产逻辑 */ }
        if (env.acceptsProfiles(Profiles.of("dev", "test"))) { /* 开发或测试 */ }
        if (env.matchesProfiles("!prod")) { /* 非生产 */ }
        log.info("当前激活的 Profile: {}", Arrays.toString(env.getActiveProfiles()));
    }
}
```

### 3.2 各环境的典型配置

```yaml
# ═══════ application-dev.yml（开发环境）═══════
server:
  port: 8080
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mall_dev?useSSL=false&serverTimezone=Asia/Shanghai
    username: root
    password: 123456
    hikari:
      maximum-pool-size: 10                       # 开发环境小连接池
  data:
    redis:
      host: localhost
      port: 6379
      database: 15                                # ★ 用独立的 db，避免影响其他人
  devtools:
    restart:
      enabled: true                                # ★ 热部署
    livereload:
      enabled: true

mybatis-plus:
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl    # ★ 打印 SQL 到控制台

logging:
  level:
    root: INFO
    com.example: DEBUG                             # ★ 业务代码 DEBUG
    org.springframework.web: DEBUG
    org.springframework.jdbc: DEBUG
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] %highlight(%-5level) %cyan(%logger{36}) - %msg%n"

management:
  endpoints:
    web:
      exposure:
        include: "*"                               # ★ 开发环境暴露所有端点
  endpoint:
    health:
      show-details: always

# 业务配置
mall:
  order:
    pay-timeout: 5m                                # 开发环境短超时便于测试
  mock:
    sms-enabled: true                               # ★ Mock 短信，不真发
    pay-enabled: true                               # ★ Mock 支付

# ═══════ application-prod.yml（生产环境）═══════
server:
  port: 8080
  tomcat:
    threads:
      max: 400                                     # ★ 生产调大
      min-spare: 50
    max-connections: 10000
    accept-count: 200
    connection-timeout: 20000
  shutdown: graceful                                # ★ 优雅停机
  compression:
    enabled: true                                    # 响应压缩
    mime-types: application/json,text/html,text/css,application/javascript
    min-response-size: 2048
  http2:
    enabled: true

spring:
  datasource:
    url: ${DB_URL}                                   # ★★ 敏感信息从环境变量读！
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    hikari:
      maximum-pool-size: 50
      minimum-idle: 20
      connection-timeout: 3000
      max-lifetime: 1800000
      leak-detection-threshold: 60000
  data:
    redis:
      host: ${REDIS_HOST}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASSWORD}
      database: 0
      timeout: 3s
      lettuce:
        pool:
          max-active: 100
          max-idle: 50
          min-idle: 20
  lifecycle:
    timeout-per-shutdown-phase: 30s                  # ★ 优雅停机超时
  devtools:
    restart:
      enabled: false                                  # ★ 生产禁用热部署

mybatis-plus:
  configuration:
    log-impl: org.apache.ibatis.logging.slf4j.Slf4jImpl   # ★ 生产用 SLF4J
    map-underscore-to-camel-case: true

logging:
  level:
    root: WARN                                        # ★ 生产只记 WARN+
    com.example: INFO
    com.example.mapper: WARN                          # ★ 不打印 SQL
  file:
    name: /data/logs/mall-service/app.log
  logback:
    rollingpolicy:
      max-file-size: 200MB
      max-history: 30
      total-size-cap: 20GB
      file-name-pattern: /data/logs/mall-service/app.%d{yyyy-MM-dd}.%i.log.gz

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus        # ★ 只暴露必要的
      base-path: /internal-actuator                     # ★ 改路径，配合网关屏蔽
  endpoint:
    health:
      show-details: never                               # ★ 不显示详情（安全）
      probes:
        enabled: true                                    # ★ 开启 liveness/readiness（K8s）
  server:
    port: 9090                                          # ★ 管理端口独立（不对外）
  metrics:
    tags:
      application: ${spring.application.name}
    export:
      prometheus:
        enabled: true

mall:
  order:
    pay-timeout: 30m
  mock:
    sms-enabled: false                                   # ★ 生产真发短信
    pay-enabled: false
```

> 【★ 生产环境配置安全铁律】
> 1. **密码、密钥、Token 绝不写入配置文件**（尤其不能提交 git）→ 用环境变量、K8s Secret、Vault、Nacos 加密配置。
> 2. **生产配置文件不打包进 jar**（用外部 `config/` 目录），或打包但不含敏感值。
> 3. **`/actuator/env` 端点会脱敏**，但仍建议不对外暴露。
> 4. **Actuator 端点用独立端口** + 网关/Nginx 屏蔽外网访问。
> 5. **`.gitignore` 加上 `application-local.yml`、`*.pem`、`*.key`**。

## 4. 自定义 Starter ★★★★★（进阶必备）

### 4.1 Starter 的组成

```
my-sms-spring-boot-starter/           # ★ 命名规范：{功能}-spring-boot-starter
├── pom.xml
└── src/main/
    ├── java/com/example/sms/
    │   ├── SmsClient.java                     # ① 核心功能类（普通 Java 类）
    │   ├── SmsTemplate.java                   # ① 门面/模板类
    │   ├── SmsProperties.java                 # ② 配置属性类
    │   ├── SmsAutoConfiguration.java          # ③ ★ 自动配置类
    │   ├── model/                              # 数据模型
    │   │   ├── SmsRequest.java
    │   │   └── SmsResponse.java
    │   └── exception/
    │       └── SmsException.java
    └── resources/
        └── META-INF/
            └── spring/
                └── org.springframework.boot.autoconfigure.AutoConfiguration.imports  # ④ ★ SPI 文件
```

### 4.2 完整实现

```xml
<!-- pom.xml -->
<project>
    <groupId>com.example</groupId>
    <artifactId>sms-spring-boot-starter</artifactId>       <!-- ★ 命名规范 -->
    <version>1.0.0</version>

    <properties>
        <java.version>17</java.version>
        <spring-boot.version>3.4.0</spring-boot.version>
    </properties>

    <dependencies>
        <!-- ★ provided/optional：由使用方决定版本 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-autoconfigure</artifactId>
            <version>${spring-boot.version}</version>
        </dependency>
        <!-- ★ 配置元数据处理器（生成 IDE 提示，optional） -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-configuration-processor</artifactId>
            <version>${spring-boot.version}</version>
            <optional>true</optional>
        </dependency>
        <!-- 核心 SDK（真正的功能依赖） -->
        <dependency>
            <groupId>com.aliyun</groupId>
            <artifactId>dysmsapi20170525</artifactId>
            <version>3.0.0</version>
        </dependency>
        <!-- 测试 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <version>${spring-boot.version}</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <configuration>
                    <annotationProcessorPaths>
                        <path>
                            <groupId>org.springframework.boot</groupId>
                            <artifactId>spring-boot-configuration-processor</artifactId>
                            <version>${spring-boot.version}</version>
                        </path>
                    </annotationProcessorPaths>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

```java
// ═══════ ① 配置属性类 ═══════
package com.example.sms;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;
import java.time.Duration;

/**
 * 短信服务配置属性
 */
@ConfigurationProperties(prefix = "example.sms")
@Validated
public class SmsProperties {

    /** 是否启用短信功能 */
    private boolean enabled = true;

    /** 短信服务商：aliyun / tencent / mock */
    @NotNull
    private Provider provider = Provider.ALIYUN;

    /** AccessKey ID */
    @NotBlank(message = "example.sms.access-key-id 不能为空")
    private String accessKeyId;

    /** AccessKey Secret */
    @NotBlank(message = "example.sms.access-key-secret 不能为空")
    private String accessKeySecret;

    /** 短信签名 */
    @NotBlank(message = "example.sms.sign-name 不能为空")
    private String signName;

    /** 请求超时时间 */
    private Duration timeout = Duration.ofSeconds(5);

    /** 连接超时 */
    private Duration connectTimeout = Duration.ofSeconds(3);

    /** 最大重试次数 */
    private int maxRetry = 3;

    /** 重试间隔 */
    private Duration retryInterval = Duration.ofMillis(500);

    /** 是否记录发送日志到数据库 */
    private boolean logToDb = false;

    /** ★ 模板映射（业务标识 → 模板 ID） */
    private Map<String, String> templates = new HashMap<>();

    /** ★ 各服务商的扩展配置 */
    private Aliyun aliyun = new Aliyun();
    private Tencent tencent = new Tencent();

    public enum Provider { ALIYUN, TENCENT, MOCK }

    @Data
    public static class Aliyun {
        /** 区域 ID */
        private String regionId = "cn-hangzhou";
        /** 服务接入点 */
        private String endpoint = "dysmsapi.aliyuncs.com";
    }

    @Data
    public static class Tencent {
        private String sdkAppId;
        private String region = "ap-guangzhou";
    }

    // ★ getter/setter（省略，实际用 @Data 或手写）
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    // ... 其他 getter/setter
}
```

```java
// ═══════ ② 核心接口与实现 ═══════
package com.example.sms;

/** 短信发送客户端（★ 面向接口，便于扩展和 Mock） */
public interface SmsClient {
    /** 发送短信 */
    SmsResponse send(SmsRequest request);
    /** 服务商类型 */
    SmsProperties.Provider provider();
}

@Data
@Builder
public class SmsRequest {
    /** 手机号 */
    @NotBlank private String mobile;
    /** 模板 ID（或用 templateCode 从配置映射） */
    private String templateId;
    /** ★ 业务模板标识（从 SmsProperties.templates 映射为真实模板 ID） */
    private String templateCode;
    /** 模板参数 */
    private Map<String, String> params;
    /** 幂等 ID（防重发） */
    private String bizId;
}

@Data
@Builder
public class SmsResponse {
    private boolean success;
    private String code;
    private String message;
    private String requestId;
}

/** ★ 阿里云实现 */
public class AliyunSmsClient implements SmsClient {
    private final SmsProperties props;
    private final Client client;

    public AliyunSmsClient(SmsProperties props) {
        this.props = props;
        Config config = new Config()
                .setAccessKeyId(props.getAccessKeyId())
                .setAccessKeySecret(props.getAccessKeySecret())
                .setEndpoint(props.getAliyun().getEndpoint())
                .setReadTimeout((int) props.getTimeout().toMillis())
                .setConnectTimeout((int) props.getConnectTimeout().toMillis());
        this.client = new Client(config);
    }

    @Override
    public SmsResponse send(SmsRequest request) {
        String templateId = resolveTemplateId(request);
        SendSmsRequest req = new SendSmsRequest()
                .setPhoneNumbers(request.getMobile())
                .setSignName(props.getSignName())
                .setTemplateCode(templateId)
                .setTemplateParam(JSON.toJSONString(request.getParams()))
                .setOutId(request.getBizId());
        try {
            SendSmsResponse resp = client.sendSms(req);
            SendSmsResponseBody body = resp.getBody();
            boolean ok = "OK".equals(body.getCode());
            return SmsResponse.builder()
                    .success(ok).code(body.getCode()).message(body.getMessage())
                    .requestId(body.getRequestId()).build();
        } catch (Exception e) {
            throw new SmsException("阿里云短信发送失败", e);
        }
    }

    private String resolveTemplateId(SmsRequest request) {
        if (StringUtils.hasText(request.getTemplateId())) return request.getTemplateId();
        if (StringUtils.hasText(request.getTemplateCode())) {
            String id = props.getTemplates().get(request.getTemplateCode());
            if (id == null) throw new SmsException("未配置模板映射: " + request.getTemplateCode());
            return id;
        }
        throw new SmsException("templateId 和 templateCode 至少提供一个");
    }

    @Override public SmsProperties.Provider provider() { return SmsProperties.Provider.ALIYUN; }
}

/** ★ Mock 实现（开发测试用，不真发短信） */
@Slf4j
public class MockSmsClient implements SmsClient {
    @Override
    public SmsResponse send(SmsRequest request) {
        log.info("【MOCK 短信】手机号={}, 模板={}, 参数={}",
                request.getMobile(), request.getTemplateCode(), request.getParams());
        return SmsResponse.builder().success(true).code("OK").message("mock").build();
    }
    @Override public SmsProperties.Provider provider() { return SmsProperties.Provider.MOCK; }
}
```

```java
// ═══════ ③ 门面类（对外暴露的 API，含重试、日志）═══════
package com.example.sms;

@Slf4j
public class SmsTemplate {

    private final SmsClient client;
    private final SmsProperties props;
    private final List<SmsInterceptor> interceptors;

    public SmsTemplate(SmsClient client, SmsProperties props, List<SmsInterceptor> interceptors) {
        this.client = client;
        this.props = props;
        this.interceptors = interceptors != null ? interceptors : Collections.emptyList();
    }

    /** ★ 发送验证码 */
    public SmsResponse sendVerifyCode(String mobile, String code) {
        return send(SmsRequest.builder()
                .mobile(mobile)
                .templateCode("verify-code")
                .params(Map.of("code", code))
                .bizId("verify:" + mobile)
                .build());
    }

    /** ★ 通用发送（含重试） */
    public SmsResponse send(SmsRequest request) {
        validate(request);
        // 前置拦截（脱敏日志、频控）
        interceptors.forEach(i -> i.before(request));

        SmsResponse response = null;
        Exception lastError = null;
        for (int attempt = 1; attempt <= props.getMaxRetry(); attempt++) {
            try {
                response = client.send(request);
                if (response.isSuccess()) {
                    log.info("短信发送成功: mobile={}, code={}",
                            mask(request.getMobile()), response.getRequestId());
                    interceptors.forEach(i -> i.afterSuccess(request, response));
                    return response;
                }
                log.warn("短信发送失败(第{}次): {}", attempt, response.getMessage());
            } catch (Exception e) {
                lastError = e;
                log.warn("短信发送异常(第{}次): {}", attempt, e.getMessage());
            }
            // 重试间隔（指数退避）
            if (attempt < props.getMaxRetry()) {
                sleep(props.getRetryInterval().toMillis() * attempt);
            }
        }
        interceptors.forEach(i -> i.afterFailure(request, response, lastError));
        if (lastError != null) throw new SmsException("短信发送失败", lastError);
        return response;
    }

    private void validate(SmsRequest request) {
        if (!request.getMobile().matches("^1[3-9]\\d{9}$")) {
            throw new SmsException("手机号格式不正确: " + request.getMobile());
        }
    }
    private String mask(String mobile) {
        return mobile.replaceAll("(\\d{3})\\d{4}(\\d{4})", "$1****$2");
    }
    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }

    public SmsClient getClient() { return client; }
}

/** ★ 扩展点：拦截器（用户可注册自己的实现） */
public interface SmsInterceptor {
    default void before(SmsRequest request) { }
    default void afterSuccess(SmsRequest request, SmsResponse response) { }
    default void afterFailure(SmsRequest request, SmsResponse response, Exception e) { }
}
```

```java
// ═══════ ④ 自动配置类（★ 核心）═══════
package com.example.sms;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.*;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * ★ 短信服务自动配置
 */
@AutoConfiguration                                                   // ① 声明为自动配置类
@ConditionalOnClass(SmsClient.class)                                  // ② classpath 有核心类
@ConditionalOnProperty(prefix = "example.sms", name = "enabled",      // ③ 开关（默认开启）
                       havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(SmsProperties.class)                    // ④ 绑定配置属性
public class SmsAutoConfiguration {

    /**
     * ★ 阿里云客户端：只在 provider=aliyun 且有相应 SDK 时创建
     */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "com.aliyun.dysmsapi20170525.Client")     // ★ 用 name 避免类加载失败
    @ConditionalOnProperty(prefix = "example.sms", name = "provider",
                           havingValue = "aliyun", matchIfMissing = true)
    static class AliyunSmsConfiguration {
        @Bean
        @ConditionalOnMissingBean(SmsClient.class)                       // ★ 用户没配才用默认的
        public SmsClient aliyunSmsClient(SmsProperties props) {
            return new AliyunSmsClient(props);
        }
    }

    /** ★ Mock 客户端：开发环境用 */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(prefix = "example.sms", name = "provider", havingValue = "mock")
    static class MockSmsConfiguration {
        @Bean
        @ConditionalOnMissingBean(SmsClient.class)
        public SmsClient mockSmsClient() { return new MockSmsClient(); }
    }

    /**
     * ★ 门面类：注入所有 SmsClient，按配置选择
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnBean(SmsClient.class)                                  // 必须有 Client 才创建
    public SmsTemplate smsTemplate(SmsClient client,
                                   SmsProperties props,
                                   ObjectProvider<List<SmsInterceptor>> interceptors) {
        return new SmsTemplate(client, props, interceptors.getIfAvailable());
    }

    /**
     * ★ 多服务商场景：注入 Map<Provider, SmsClient>，用户按 key 取
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "example.sms", name = "multi-provider-enabled",
                           havingValue = "true")
    public Map<SmsProperties.Provider, SmsClient> smsClientMap(List<SmsClient> clients) {
        return clients.stream().collect(Collectors.toMap(SmsClient::provider, Function.identity()));
    }

    /**
     * ★ Actuator 健康检查（体现 starter 的完整性）
     */
    @Bean
    @ConditionalOnClass(name = "org.springframework.boot.actuate.health.HealthIndicator")
    @ConditionalOnBean(SmsClient.class)
    @ConditionalOnMissingBean(name = "smsHealthIndicator")
    @ConditionalOnEnabledHealthIndicator("sms")
    public SmsHealthIndicator smsHealthIndicator(SmsClient client) {
        return new SmsHealthIndicator(client);
    }
}
```

```java
// ═══════ ⑤ SPI 注册文件（★★ 最关键，缺了自动配置完全不生效）═══════
// 文件路径：src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
// 文件内容（每行一个全限定类名）：
com.example.sms.SmsAutoConfiguration

// ★ 注意：
// ① 文件名必须完全一致（含大小写）
// ② 路径必须是 META-INF/spring/（不是 META-INF/）
// ③ Boot 2.6 及以前用 META-INF/spring.factories，格式：
//    org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
//    com.example.sms.SmsAutoConfiguration
```

```java
// ═══════ ⑥ 健康检查（可选但专业）═══════
package com.example.sms;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;

public class SmsHealthIndicator implements HealthIndicator {
    private final SmsClient client;
    public SmsHealthIndicator(SmsClient client) { this.client = client; }

    @Override
    public Health health() {
        try {
            // 轻量级探活（不发真实短信）
            boolean available = checkAvailable();
            return available
                ? Health.up().withDetail("provider", client.provider().name()).build()
                : Health.down().withDetail("provider", client.provider().name()).build();
        } catch (Exception e) {
            return Health.down(e).withDetail("provider", client.provider().name()).build();
        }
    }
    private boolean checkAvailable() { /* 调服务商的状态接口 */ return true; }
}
```

### 4.3 使用自定义 Starter

```xml
<!-- 业务项目引入 -->
<dependency>
    <groupId>com.example</groupId>
    <artifactId>sms-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

```yaml
# 只需配置，无需任何 Java 代码
example:
  sms:
    enabled: true
    provider: aliyun
    access-key-id: ${SMS_AK}                 # ★ 从环境变量读
    access-key-secret: ${SMS_SK}
    sign-name: "我的商城"
    timeout: 5s
    max-retry: 3
    retry-interval: 1s
    templates:
      verify-code: "SMS_123456789"           # ★ 业务标识 → 阿里云模板 ID
      order-paid: "SMS_987654321"
      delivery: "SMS_111222333"
    aliyun:
      region-id: cn-hangzhou
```

```java
// ★ 直接注入使用（零配置代码）
@Service
@RequiredArgsConstructor
public class VerifyCodeService {

    private final SmsTemplate smsTemplate;              // ★ starter 自动装配的 Bean

    public void sendCode(String mobile) {
        String code = RandomUtil.randomNumbers(6);
        // 存 Redis（5 分钟有效）
        redisTemplate.opsForValue().set("sms:code:" + mobile, code, Duration.ofMinutes(5));
        // ★ 一行发送
        smsTemplate.sendVerifyCode(mobile, code);
    }
}

// 或自定义拦截器（★ starter 提供的扩展点）
@Component
public class SmsRateLimitInterceptor implements SmsInterceptor {
    @Override
    public void before(SmsRequest request) {
        // 频控：同一手机号 60 秒内只能发一条
        String key = "sms:limit:" + request.getMobile();
        if (!redisTemplate.opsForValue().setIfAbsent(key, "1", Duration.ofSeconds(60))) {
            throw new BusinessException("短信发送太频繁，请稍后再试");
        }
    }
}
```

### 4.4 Starter 命名规范与最佳实践

| 规范 | 说明 |
| --- | --- |
| **官方 Starter** | `spring-boot-starter-&#123;name&#125;`（如 `spring-boot-starter-web`） |
| **第三方 Starter** | ★ **`&#123;name&#125;-spring-boot-starter`**（如 `mybatis-spring-boot-starter`、`druid-spring-boot-starter`） |
| **不要占用官方命名** | 避免 `spring-boot-starter-sms`（会与未来官方冲突） |
| 自动配置类命名 | `&#123;Name&#125;AutoConfiguration` |
| 属性类命名 | `&#123;Name&#125;Properties` |
| 前缀 | 用组织/产品名（`example.sms`、`alibaba.cloud.nacos`），避免 `spring.*` |

**最佳实践清单：**

1. **`@ConditionalOnMissingBean` 必须加**：让用户配置能覆盖默认。
2. **`proxyBeanMethods = false`**：内部配置类用 lite 模式，提升启动速度。
3. **属性类提供合理默认值**：让用户「零配置可用」。
4. **提供 `enabled` 开关**：`matchIfMissing = true`（默认开启）。
5. **`@ConditionalOnClass` 用 `name` 形式**：避免可选依赖缺失时类加载失败。
6. **面向接口设计**：核心功能定义接口，便于用户替换实现。
7. **提供扩展点**：拦截器、Customizer（如 `RestTemplateBuilder` 的模式）。
8. **配置元数据处理器**：让 IDE 有提示（★ 用户体验的关键）。
9. **写单元测试**：用 `ApplicationContextRunner` 验证各种条件组合。
10. **文档 + 示例**：README 说明所有配置项。

```java
// ═══════ 测试自定义 Starter（★ ApplicationContextRunner）═══════
class SmsAutoConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(SmsAutoConfiguration.class));

    @Test
    void shouldNotCreateBeansWhenDisabled() {
        runner.withPropertyValues("example.sms.enabled=false")
              .run(context -> assertThat(context).doesNotHaveBean(SmsTemplate.class));
    }

    @Test
    void shouldCreateMockClientWhenProviderIsMock() {
        runner.withPropertyValues("example.sms.provider=mock",
                                  "example.sms.access-key-id=x",
                                  "example.sms.access-key-secret=y",
                                  "example.sms.sign-name=test")
              .run(context -> {
                  assertThat(context).hasSingleBean(SmsTemplate.class);
                  assertThat(context.getBean(SmsClient.class)).isInstanceOf(MockSmsClient.class);
              });
    }

    @Test
    void shouldBackOffWhenUserDefinesClient() {
        runner.withUserConfiguration(CustomClientConfig.class)
              .withPropertyValues("example.sms.provider=mock", ...)
              .run(context -> {
                  assertThat(context).hasSingleBean(SmsClient.class);
                  // ★ 验证用户的 Bean 生效，自动配置退让
                  assertThat(context.getBean(SmsClient.class))
                          .isInstanceOf(CustomSmsClient.class);
              });
    }

    @Test
    void shouldFailWhenAccessKeyMissing() {
        runner.withPropertyValues("example.sms.provider=aliyun")
              .run(context -> assertThat(context).hasFailed());      // ★ 校验失败启动失败
    }

    @Configuration
    static class CustomClientConfig {
        @Bean SmsClient customClient() { return new CustomSmsClient(); }
    }
}
```

## 5. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | YAML 缩进用了 Tab | 解析错误 | ★ 只能用空格 |
| 2 | 冒号后无空格 | 解析为字符串 | `key: value` |
| 3 | YAML 1.1 的布尔陷阱 | `NO` 变成 false | ★ 用引号包裹 |
| 4 | `version: 1.10` | 变成 1.1 | 用引号 `"1.10"` |
| 5 | 邮编 `07701` | 变成 7701 | 用引号 |
| 6 | properties 与 yml 同时存在同名配置 | properties 生效（优先级高） | 统一用一种 |
| 7 | profile 文件名与 active 值不匹配 | 配置不加载 | `application-&#123;profile&#125;.yml` 严格对应 |
| 8 | 单文件多 profile 用了老语法 | Boot 2.4+ 报错 | 用 `spring.config.activate.on-profile` |
| 9 | `@ConfigurationProperties` 未注册 | 属性全是默认值 | 加 `@EnableConfigurationProperties` 或 `@ConfigurationPropertiesScan` |
| 10 | `@Validated` 忘加 | 校验注解无效 | 属性类上加 `@Validated` |
| 11 | 嵌套对象未初始化 | NPE | `private final Notify notify = new Notify();` |
| 12 | 构造器绑定用了 setter | 绑定失败 | 单构造器 + 无 setter（不可变） |
| 13 | Map key 含特殊字符未用 `[]` | 绑定失败 | `"[key:with:colon]": value` |
| 14 | 环境变量命名不对 | 配置不生效 | 点→下划线，短横线删除，全大写 |
| 15 | ★ 敏感信息写入配置文件并提交 git | 泄漏事故 | 环境变量 / Secret / Vault / Nacos |
| 16 | 生产配置打包进 jar | 改配置要重新打包 | 外部 `config/` 目录 + `spring.config.additional-location` |
| 17 | Starter 忘了 `.imports` 文件 | 自动配置完全不生效 | 创建 SPI 文件，路径和文件名严格一致 |
| 18 | Starter 未加 `@ConditionalOnMissingBean` | 用户配置无法覆盖 | ★ 每个 @Bean 都加 |
| 19 | `@ConditionalOnClass` 用 Class 引用可选依赖 | `NoClassDefFoundError` | 用 `name = "com.x.Y"` 字符串形式 |
| 20 | Starter 命名占用官方前缀 | 未来冲突 | `&#123;name&#125;-spring-boot-starter` |
| 21 | 属性类用了 `@Component` + `@EnableConfigurationProperties` | Bean 重复注册 | 二选一 |
| 22 | 未加 configuration-processor | IDE 无提示，用户体验差 | 加 optional 依赖 |
| 23 | `Duration` 配置写成数字 | 默认按毫秒 | 用 `30s`、`5m`、`1h` 格式 |
| 24 | `spring.config.location` 覆盖了 jar 内配置 | 部分配置丢失 | 用 `additional-location`（追加） |
| 25 | Profile group 与 include 混用混淆 | 加载顺序不符预期 | 理解 group（Boot 2.4+）与 include 的区别 |
| 26 | `@Value` 绑定复杂对象 | 只能拿到字符串 | 改用 `@ConfigurationProperties` |
| 27 | `@Value` 用在 static 字段 | null | 改实例字段 |
| 28 | 配置项拼写错误无提示 | 配置不生效且无报错 | 用 IDE 提示 + `/actuator/configprops` 核对 |

---

## 关联笔记

- 上一篇：[[后端/SpringBoot/自动配置原理]]
- 下一篇：[[后端/SpringBoot/整合数据访问层]]
- 相关：[[后端/SpringBoot/SpringBoot入门与项目搭建]]、[[后端/Spring/Spring注解大全与配置类]]
- 配置中心：[[后端/微服务/Nacos注册中心与配置中心]]（分布式配置管理）
- 部署：[[后端/SpringBoot/日志-Actuator与打包部署]]、[[后端/Java工程化与部署/Linux与Java项目部署]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
