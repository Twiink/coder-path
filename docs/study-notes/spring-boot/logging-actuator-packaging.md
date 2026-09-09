---
title: "日志-Actuator与打包部署"
aliases:
  - "Logback"
  - "Actuator"
  - "SpringBoot 打包"
  - "Prometheus"
tags:
  - "后端"
  - "java"
  - "spring"
  - "springboot"
  - "运维"
category: "后端"
folder: "SpringBoot"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/SpringBoot/SpringBoot入门与项目搭建]]"
  - "[[后端/SpringBoot/自动配置原理]]"
  - "[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]"
  - "[[后端/Java工程化与部署/Linux与Java项目部署]]"
created: 2026-09-07
updated: 2026-09-07
---

# 日志、Actuator 与打包部署

## 1. 日志框架体系 ★★★★★

### 1.1 日志门面与实现

```
业务代码
   ↓ 调用
┌─────────────────────────────────────┐
│  ★ 日志门面（Facade，只是接口）        │
│  SLF4J（Simple Logging Facade for Java）★ 事实标准
│  commons-logging（JCL，老）           │
└────────────────┬────────────────────┘
                 ↓ 运行时绑定
┌─────────────────────────────────────┐
│  ★ 日志实现（真正干活的）              │
│  Logback   ← ★ Spring Boot 默认      │
│  Log4j2    ← 性能更好（异步、无锁）    │
│  java.util.logging（JUL，JDK 自带）   │
│  log4j 1.x（已废弃，有安全漏洞）        │
└─────────────────────────────────────┘

其他框架（Spring、MyBatis、Hibernate、Druid）的日志 → 通过桥接包统一转到 SLF4J：
  jcl-over-slf4j      ← Spring 的 commons-logging
  log4j-over-slf4j    ← 老的 log4j 1.x API
  jul-to-slf4j        ← JUL
  ★ log4j-to-slf4j    ← Log4j2 API（spring-boot-starter-logging 已含）
```

**Spring Boot 的默认日志依赖链：**

```
spring-boot-starter-web
  └── spring-boot-starter
        └── spring-boot-starter-logging          ★ 默认日志
              ├── logback-classic                 ★ Logback 实现
              │     └── logback-core
              ├── log4j-to-slf4j                  ★ Log4j2 API → SLF4J
              │     └── log4j-api
              └── jul-to-slf4j                    ★ JUL → SLF4J
```

### 1.2 日志的正确写法 ★★★★★

```java
// ─── ① 声明 Logger ───
// 方式 1：Lombok（★ 推荐）
@Slf4j
public class OrderService { }
// 自动生成：private static final Logger log = LoggerFactory.getLogger(OrderService.class);

// 方式 2：手动（★ 必须 static final，用当前类）
private static final Logger log = LoggerFactory.getLogger(OrderService.class);
// ⚠️ 常见错误：
//   ① 复制粘贴时忘了改类名 → 日志来源错乱（log 打印的是别的类）
//   ② 用 String 而非 Class → 重构时不跟着改
//   ③ 非 static → 每个实例一个 Logger（浪费）
//   ④ 用 System.out.println → ★ 绝对禁止（无级别、无时间、无法关闭、性能差）

// ─── ② 五个日志级别（★ 用途必须分清）───
log.trace("最详细的追踪（一般不用，量太大）");
log.debug("调试信息：入参、中间状态、分支判断（★ 生产关闭）");
log.info("关键业务节点：订单创建成功、用户登录、任务开始/结束（★ 生产主力）");
log.warn("可预期的异常/降级：参数非法、重试、缓存未命中、限流触发（★ 需要关注但不紧急）");
log.error("★ 不可预期的错误：NPE、数据库连不上、第三方失败、数据不一致（必须告警）");

// ─── ③ ★★ 占位符（★ 性能关键，必须用！）───
// ❌ 字符串拼接：即使日志级别不输出，拼接也会执行（浪费 CPU + 产生垃圾对象）
log.debug("查询用户: " + userId + ", 结果: " + user);        // ★ 反例
// ✅ 占位符：级别不匹配时【完全不做字符串处理】
log.debug("查询用户: {}, 结果: {}", userId, user);            // ★ 正例
log.info("订单 {} 创建成功，金额 {}，用户 {}", orderNo, amount, userId);

// ─── ④ ★★ 异常日志的正确写法（★ 高频错误）───
try {
    doSomething();
} catch (Exception e) {
    // ❌ 错误 1：丢失栈信息（只打消息，无法定位）
    log.error("出错了: " + e.getMessage());
    // ❌ 错误 2：异常对象作为占位符参数（会调用 toString，丢失栈）
    log.error("出错了: {}", e);
    // ❌ 错误 3：先打消息再打异常（两条日志，上下文割裂）
    log.error("出错了");
    e.printStackTrace();                        // ★★ 绝对禁止（输出到 stderr，无法收集）
    // ✅ 正确：★ 异常对象作为【最后一个参数】，且不占位符
    log.error("订单处理失败, orderNo={}, userId={}", orderNo, userId, e);
    //                                                            ↑ ★ 最后一个 Throwable 会被识别为异常并打印完整栈
}

// ─── ⑤ isDebugEnabled 判断（大对象日志时）───
// 普通日志不需要判断（占位符已优化）
log.debug("用户信息: {}", user);                    // ✅ 直接写
// ★ 但如果日志参数本身【计算昂贵】，必须判断
if (log.isDebugEnabled()) {
    log.debug("完整报表数据: {}", generateExpensiveReport());    // 避免无谓计算
    log.debug("大对象 JSON: {}", JSON.toJSONString(hugeObject)); // 避免无谓序列化
}
// 或用 Supplier（Java 8+，SLF4J 2.0 支持）
log.atDebug().addArgument(() -> expensiveCompute()).log("结果: {}");

// ─── ⑥ 业务日志的规范内容 ───
log.info("下单成功 | orderNo={} userId={} amount={} skuCount={} cost={}ms",
        orderNo, userId, amount, items.size(), cost);
// ★ 用 | 分隔，字段用 key=value，便于日志系统（ELK）解析和检索
// ★ 关键业务操作必须记录：谁(userId)、做了什么(动作)、对象(id)、结果、耗时

// ─── ⑦ ★ 敏感信息脱敏（安全铁律）───
// ❌ 绝对禁止记录：密码、完整手机号、身份证、银行卡、Token、密钥、Cookie
log.info("用户登录, username={}, password={}", username, password);        // ★★ 事故！
log.info("请求头: {}", request.getHeader("Authorization"));                 // ★ 泄漏 Token
// ✅ 脱敏后记录
log.info("用户登录, username={}, mobile={}", username, DesensitizeUtil.mobile(mobile));
// DesensitizeUtil.mobile("13800138000") → "138****8000"
// DesensitizeUtil.idCard("110101199001011234") → "1101**********1234"
// DesensitizeUtil.bankCard("6222021234567890123") → "6222***********0123"
// DesensitizeUtil.password("xxx") → "******"

// ─── ⑧ ★ 日志与链路追踪（MDC）───
// MDC（Mapped Diagnostic Context）= ThreadLocal 的 Map，用于在同一线程的所有日志中带上 traceId
import org.slf4j.MDC;
MDC.put("traceId", traceId);                      // 请求开始时设置
MDC.put("userId", String.valueOf(userId));
log.info("这条日志会自动带上 traceId");              // 通过 %X{traceId} 输出
MDC.clear();                                       // ★★ 请求结束必须清理（线程池复用会串号）

// ★ 跨线程传递（异步场景）
// 方式 1：TaskDecorator（见 [[后端/SpringBoot/整合Web开发]] 第 4 节）
// 方式 2：TTL（transmittable-thread-local）
// 方式 3：手动传递
Map<String, String> context = MDC.getCopyOfContextMap();
executor.submit(() -> {
    MDC.setContextMap(context);
    try { doWork(); } finally { MDC.clear(); }
});
```

### 1.3 logback-spring.xml 完整配置（★ 生产模板）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!-- ★ 文件名必须是 logback-spring.xml（而非 logback.xml）才能用 <springProfile> 和 ${spring.xxx} -->
<configuration scan="true" scanPeriod="60 seconds">      <!-- ★ 热加载（改配置不用重启） -->

    <!-- ═══ 引入 Spring Boot 的默认配置（★ 获得 CONSOLE_LOG_PATTERN 等变量）═══ -->
    <include resource="org/springframework/boot/logging/logback/defaults.xml"/>
    <include resource="org/springframework/boot/logging/logback/console-appender.xml"/>

    <!-- ═══ 属性定义 ═══ -->
    <springProperty scope="context" name="APP_NAME" source="spring.application.name" defaultValue="app"/>
    <springProperty scope="context" name="LOG_PATH" source="logging.file.path" defaultValue="/data/logs"/>
    <property name="LOG_PATTERN"
              value="%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] [%X{traceId:-}] %-5level %logger{40} - %msg%n"/>
    <!-- ★ 各字段含义：
         %d{...}        时间（毫秒精度）
         [%thread]      线程名（★ 排查并发问题必需）
         [%X{traceId:-}] ★ MDC 中的 traceId（:- 表示缺失时为空）
         %-5level       日志级别（左对齐占 5 字符）
         %logger{40}    Logger 名（缩写到 40 字符）
         %msg%n         消息 + 换行
         其他常用：%file %line %method %class（★ 性能差，生产禁用！） -->
    <property name="MAX_HISTORY" value="30"/>             <!-- 保留天数 -->
    <property name="MAX_FILE_SIZE" value="200MB"/>        <!-- 单文件大小 -->
    <property name="TOTAL_SIZE_CAP" value="20GB"/>        <!-- 总容量上限 -->

    <!-- ═══ ① 控制台（★ 开发环境用彩色）═══ -->
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} %highlight(%-5level) [%thread] %cyan(%logger{36}) %magenta([%X{traceId}]) - %msg%n</pattern>
            <charset>UTF-8</charset>
        </encoder>
    </appender>

    <!-- ═══ ② 全量日志文件（INFO 及以上）═══ -->
    <appender name="FILE_INFO" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/${APP_NAME}/info.log</file>
        <!-- ★ 滚动策略：按时间 + 按大小 -->
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/${APP_NAME}/info.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>  <!-- ★ .gz 自动压缩 -->
            <maxFileSize>${MAX_FILE_SIZE}</maxFileSize>
            <maxHistory>${MAX_HISTORY}</maxHistory>
            <totalSizeCap>${TOTAL_SIZE_CAP}</totalSizeCap>
            <cleanHistoryOnStart>true</cleanHistoryOnStart>       <!-- 启动时清理过期日志 -->
        </rollingPolicy>
        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
            <charset>UTF-8</charset>
        </encoder>
        <!-- ★ 只记录 INFO ~ WARN（ERROR 单独一个文件，便于告警） -->
        <filter class="ch.qos.logback.classic.filter.LevelFilter">
            <level>INFO</level>
            <onMatch>ACCEPT</onMatch>
            <onMismatch>NEUTRAL</onMismatch>
        </filter>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>INFO</level>                                   <!-- 最低 INFO -->
        </filter>
    </appender>

    <!-- ═══ ③ ERROR 日志单独文件（★ 便于监控告警）═══ -->
    <appender name="FILE_ERROR" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/${APP_NAME}/error.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/${APP_NAME}/error.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>90</maxHistory>                            <!-- ★ 错误日志保留更久 -->
            <totalSizeCap>10GB</totalSizeCap>
        </rollingPolicy>
        <encoder>
            <!-- ★ 错误日志带更多上下文（文件、行号 —— 只在 ERROR 用，性能可接受） -->
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] [%X{traceId}] %-5level %logger{50}[%file:%line] - %msg%n</pattern>
            <charset>UTF-8</charset>
        </encoder>
        <filter class="ch.qos.logback.classic.filter.LevelFilter">
            <level>ERROR</level>
            <onMatch>ACCEPT</onMatch>
            <onMismatch>DENY</onMismatch>                          <!-- ★ 只要 ERROR -->
        </filter>
    </appender>

    <!-- ═══ ④ WARN 日志 ═══ -->
    <appender name="FILE_WARN" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/${APP_NAME}/warn.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/${APP_NAME}/warn.%d{yyyy-MM-dd}.log.gz</fileNamePattern>
            <maxHistory>30</maxHistory>
        </rollingPolicy>
        <encoder><pattern>${LOG_PATTERN}</pattern><charset>UTF-8</charset></encoder>
        <filter class="ch.qos.logback.classic.filter.LevelFilter">
            <level>WARN</level><onMatch>ACCEPT</onMatch><onMismatch>DENY</onMismatch>
        </filter>
    </appender>

    <!-- ═══ ⑤ ★ 业务操作日志（审计用，结构化 JSON）═══ -->
    <appender name="FILE_BIZ" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/${APP_NAME}/business.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/${APP_NAME}/business.%d{yyyy-MM-dd}.log.gz</fileNamePattern>
            <maxHistory>180</maxHistory>                            <!-- ★ 审计日志保留半年 -->
        </rollingPolicy>
        <!-- ★ JSON 格式（便于 ELK/Loki 解析） -->
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <includeMdcKeyName>traceId</includeMdcKeyName>
            <includeMdcKeyName>userId</includeMdcKeyName>
            <includeMdcKeyName>clientIp</includeMdcKeyName>
            <customFields>{"app":"${APP_NAME}","type":"business"}</customFields>
            <timeZone>Asia/Shanghai</timeZone>
        </encoder>
    </appender>
    <!-- 需要依赖：net.logstash.logback:logstash-logback-encoder:7.4 -->

    <!-- ═══ ⑥ ★ 异步 Appender（★★ 性能关键，生产必配）═══ -->
    <appender name="ASYNC_FILE_INFO" class="ch.qos.logback.classic.AsyncAppender">
        <appender-ref ref="FILE_INFO"/>
        <queueSize>4096</queueSize>                                  <!-- ★ 队列大小（默认 256 太小！） -->
        <discardingThreshold>0</discardingThreshold>                  <!-- ★ 0 = 队列满也不丢弃（默认丢 TRACE/DEBUG/INFO） -->
        <neverBlock>true</neverBlock>                                 <!-- ★ true = 队列满时丢弃而非阻塞业务线程（★ 保护业务） -->
        <includeCallerData>false</includeCallerData>                   <!-- ★ false = 不获取调用者信息（性能提升数倍，无法输出 %file %line） -->
        <maxFlushTime>5000</maxFlushTime>                              <!-- 关闭时最多等待刷盘时间 -->
    </appender>

    <appender name="ASYNC_FILE_ERROR" class="ch.qos.logback.classic.AsyncAppender">
        <appender-ref ref="FILE_ERROR"/>
        <queueSize>2048</queueSize>
        <discardingThreshold>0</discardingThreshold>                   <!-- ★ ERROR 绝不丢弃 -->
        <neverBlock>false</neverBlock>                                 <!-- ★ ERROR 宁可阻塞也不丢 -->
        <includeCallerData>true</includeCallerData>                     <!-- ★ ERROR 需要行号定位 -->
    </appender>

    <appender name="ASYNC_FILE_BIZ" class="ch.qos.logback.classic.AsyncAppender">
        <appender-ref ref="FILE_BIZ"/>
        <queueSize>4096</queueSize>
        <neverBlock>true</neverBlock>
    </appender>

    <!-- ═══ ⑦ ★ 按环境配置（logback-spring.xml 的独有能力）═══ -->
    <!-- 开发环境：控制台 + 详细日志 -->
    <springProfile name="dev,local">
        <root level="INFO">
            <appender-ref ref="CONSOLE"/>
        </root>
        <logger name="com.example" level="DEBUG"/>
        <logger name="com.example.mapper" level="DEBUG"/>              <!-- ★ 打印 SQL -->
        <logger name="org.springframework.web" level="DEBUG"/>
        <logger name="org.springframework.boot.autoconfigure" level="INFO"/>
    </springProfile>

    <!-- 测试环境：控制台 + 文件 -->
    <springProfile name="test">
        <root level="INFO">
            <appender-ref ref="CONSOLE"/>
            <appender-ref ref="ASYNC_FILE_INFO"/>
            <appender-ref ref="ASYNC_FILE_ERROR"/>
        </root>
        <logger name="com.example" level="DEBUG"/>
        <logger name="com.example.mapper" level="DEBUG"/>
    </springProfile>

    <!-- ★ 生产环境：只写文件，异步，WARN+ -->
    <springProfile name="prod,pre">
        <root level="WARN">                                              <!-- ★ 生产只记 WARN+ -->
            <appender-ref ref="ASYNC_FILE_INFO"/>
            <appender-ref ref="ASYNC_FILE_ERROR"/>
            <appender-ref ref="ASYNC_FILE_WARN"/>
        </root>
        <!-- ★ 业务代码 INFO（关键业务节点必须记录） -->
        <logger name="com.example" level="INFO" additivity="false">
            <appender-ref ref="ASYNC_FILE_INFO"/>
            <appender-ref ref="ASYNC_FILE_ERROR"/>
            <appender-ref ref="ASYNC_FILE_BIZ"/>
        </logger>
        <!-- ★ 审计日志独立 Logger -->
        <logger name="BUSINESS_LOG" level="INFO" additivity="false">
            <appender-ref ref="ASYNC_FILE_BIZ"/>
        </logger>
        <!-- ★ 压制框架的噪音日志 -->
        <logger name="org.springframework" level="WARN"/>
        <logger name="org.apache.ibatis" level="WARN"/>
        <logger name="org.mybatis" level="WARN"/>
        <logger name="com.zaxxer.hikari" level="WARN"/>
        <logger name="com.alibaba.druid" level="WARN"/>
        <logger name="org.apache.http" level="WARN"/>
        <logger name="io.lettuce" level="WARN"/>
        <logger name="io.netty" level="WARN"/>
        <logger name="com.netflix" level="WARN"/>
        <logger name="org.apache.kafka" level="WARN"/>
        <logger name="org.apache.rocketmq" level="WARN"/>
        <logger name="springfox" level="WARN"/>
        <logger name="org.springdoc" level="WARN"/>
        <!-- ★ SQL 日志（生产关闭，排查问题时临时开启） -->
        <logger name="com.example.mapper" level="WARN"/>
    </springProfile>

    <!-- ═══ ⑧ ★ 精细控制单个类 ═══ -->
    <!-- additivity="false" 表示不向上传递给 root（避免日志重复打印两遍！） -->
    <logger name="com.example.service.PaymentService" level="DEBUG" additivity="false">
        <appender-ref ref="FILE_INFO"/>
    </logger>
</configuration>
```

**additivity 的坑（★ 日志重复打印的原因）：**

```
如果 logger "com.example" 配了 appender，且 additivity="true"（默认）
→ 日志会同时写到 logger 自己的 appender 【和】 root 的 appender → 打印两遍！
✅ 解决：显式设置 additivity="false"
```

### 1.4 切换为 Log4j2（高并发场景）

```xml
<!-- pom.xml：排除 Logback，引入 Log4j2 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-logging</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-log4j2</artifactId>
</dependency>
<!-- ★ 异步日志需要 disruptor -->
<dependency>
    <groupId>com.lmax</groupId>
    <artifactId>disruptor</artifactId>
    <version>3.4.4</version>
</dependency>
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!-- log4j2-spring.xml -->
<Configuration status="WARN" monitorInterval="60">        <!-- ★ 热加载间隔 -->
    <Properties>
        <Property name="LOG_PATH">/data/logs/mall-service</Property>
        <Property name="PATTERN">%d{yyyy-MM-dd HH:mm:ss.SSS} [%t] [%X{traceId}] %-5level %logger{40} - %msg%n</Property>
    </Properties>

    <Appenders>
        <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="${PATTERN}" charset="UTF-8"/>
        </Console>

        <!-- ★ 滚动文件 -->
        <RollingFile name="InfoFile" fileName="${LOG_PATH}/info.log"
                     filePattern="${LOG_PATH}/info.%d{yyyy-MM-dd}.%i.log.gz">
            <PatternLayout pattern="${PATTERN}" charset="UTF-8"/>
            <Policies>
                <TimeBasedTriggeringPolicy/>
                <SizeBasedTriggeringPolicy size="200MB"/>
            </Policies>
            <DefaultRolloverStrategy max="100">
                <Delete basePath="${LOG_PATH}" maxDepth="1">
                    <IfFileName glob="info.*.log.gz"/>
                    <IfLastModified age="30d"/>               <!-- ★ 自动删除 30 天前的 -->
                </Delete>
            </DefaultRolloverStrategy>
            <ThresholdFilter level="INFO" onMatch="ACCEPT" onMismatch="DENY"/>
        </RollingFile>

        <RollingFile name="ErrorFile" fileName="${LOG_PATH}/error.log"
                     filePattern="${LOG_PATH}/error.%d{yyyy-MM-dd}.%i.log.gz">
            <PatternLayout pattern="${PATTERN}" charset="UTF-8"/>
            <Policies>
                <TimeBasedTriggeringPolicy/>
                <SizeBasedTriggeringPolicy size="100MB"/>
            </Policies>
            <LevelRangeFilter minLevel="ERROR" maxLevel="ERROR" onMatch="ACCEPT" onMismatch="DENY"/>
        </RollingFile>
    </Appenders>

    <Loggers>
        <!-- ★★ 全异步 Logger（Log4j2 的核心优势，吞吐量是 Logback 的 10 倍以上） -->
        <AsyncLogger name="com.example" level="INFO" additivity="false" includeLocation="false">
            <AppenderRef ref="InfoFile"/>
            <AppenderRef ref="ErrorFile"/>
        </AsyncLogger>

        <!-- 压制框架日志 -->
        <AsyncLogger name="org.springframework" level="WARN"/>
        <AsyncLogger name="org.apache" level="WARN"/>

        <Root level="WARN">
            <AppenderRef ref="Console"/>
            <AppenderRef ref="InfoFile"/>
            <AppenderRef ref="ErrorFile"/>
        </Root>
    </Loggers>
</Configuration>
<!-- ★ 开启全异步（JVM 参数）：-Dlog4j2.contextSelector=org.apache.logging.log4j.core.async.AsyncLoggerContextSelector -->
<!-- ★ includeLocation="false" 是关键：获取调用位置（类名/行号）在异步模式下极慢 -->
```

**Logback vs Log4j2 选择：**

| | Logback | ★ Log4j2 |
| --- | --- | --- |
| 性能（同步） | 中 | 稍快 |
| 性能（★ 异步） | 一般 | ★★ **极快**（Disruptor 无锁队列，吞吐量 10 倍+） |
| 垃圾回收 | 较多 | ★ 少（有 GC-free 模式） |
| 配置复杂度 | ★ 简单 | 稍复杂 |
| Spring Boot 默认 | ★ **是** | 需排除后引入 |
| Lambda 支持 | ❌ | ✅ |
| 适用 | 一般应用 | ★ 高并发、大日志量 |

## 2. Actuator 生产监控 ★★★★★

### 2.1 依赖与端点

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<!-- ★ Prometheus 指标导出 -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

```yaml
management:
  # ═══ ① 端点暴露 ═══
  endpoints:
    enabled-by-default: true                    # 默认启用所有端点
    web:
      base-path: /actuator                       # ★ 端点根路径
      exposure:
        include: health,info,metrics,prometheus,env,loggers,threaddump,heapdump,mappings,beans,configprops,shutdown,startup   # ★ 显式白名单
        # include: "*"                            # ⚠️ 全暴露（★ 生产禁止！）
        exclude: shutdown,heapdump                # ★ 危险端点排除
  # ═══ ② 端点行为 ═══
  endpoint:
    health:
      show-details: when_authorized             # ★ never / when_authorized / always
      show-components: when_authorized
      probes:
        enabled: true                            # ★ 开启 liveness/readiness（K8s 探针）
      group:
        readiness:
          include: readinessState,db,redis        # ★ 就绪探针检查组
        liveness:
          include: livenessState                  # 存活探针（只检查进程，不检查依赖）
      status:
        http-mapping:
          DOWN: 503                               # ★ DOWN 时返回 503（负载均衡器会摘除节点）
          OUT_OF_SERVICE: 503
        order: DOWN,OUT_OF_SERVICE,UNKNOWN,UP
    shutdown:
      enabled: false                              # ★★ 生产禁用（可通过 POST 关闭应用！）
    heapdump:
      enabled: false                               # ★ 生产禁用（能下载整个堆，泄漏数据）
    logfile:
      enabled: true
    metrics:
      enabled: true
    env:
      show-values: when_authorized                 # ★ 配置值默认脱敏
    loggers:
      enabled: true                                # ★ 动态改日志级别（排查神器）
  # ═══ ③ 独立管理端口（★ 生产强烈建议）═══
  server:
    port: 9090                                     # ★ 管理端口与业务端口分离
    address: 127.0.0.1                             # ★ 只监听本机（配合内网访问/VPN）
    servlet:
      context-path: /internal                       # 管理端点的路径前缀
  # ═══ ④ 健康检查 ═══
  health:
    db:
      enabled: true
    redis:
      enabled: true
    diskspace:
      enabled: true
      path: /data
      threshold: 1GB                                # ★ 磁盘剩余低于 1GB 报 DOWN
    livenessstate:
      enabled: true
    readinessstate:
      enabled: true
  # ═══ ⑤ 指标 ═══
  metrics:
    tags:
      application: ${spring.application.name}        # ★ 所有指标打上应用标签
      env: ${spring.profiles.active}                 # ★ 环境标签
      region: ${DEPLOY_REGION:cn-east}
    distribution:
      percentiles-histogram:
        http.server.requests: true                    # ★ HTTP 请求的直方图（计算分位数）
      percentiles:
        http.server.requests: 0.5,0.9,0.95,0.99        # ★ P50/P90/P95/P99
      slo:
        http.server.requests: 50ms,100ms,200ms,500ms,1s   # ★ SLO 边界统计
    enable:
      jvm: true
      process: true
      system: true
      hikaricp: true                                  # ★ 连接池指标
      logback: true                                   # ★ 日志事件计数
    export:
      prometheus:
        enabled: true
        step: 15s                                      # 采集间隔
        descriptions: true
  # ═══ ⑥ 追踪（Boot 3 + Micrometer Tracing）═══
  tracing:
    sampling:
      probability: 1.0                                 # ★ 采样率（生产建议 0.1 或更低）
    propagation:
      type: w3c                                         # W3C TraceContext（或 b3）
  zipkin:
    tracing:
      endpoint: http://zipkin:9411/api/v2/spans
  observations:
    key-values:
      region: cn-east
```

### 2.2 核心端点详解

| 端点 | 方法 | 说明 | 安全性 |
| --- | --- | --- | --- |
| **`/actuator/health`** ★ | GET | ★ 健康检查（数据库、Redis、磁盘、自定义） | 对外可暴露（详情要限制） |
| `/actuator/health/liveness` ★ | GET | ★ 存活探针（K8s：进程是否活着） | 内部 |
| `/actuator/health/readiness` ★ | GET | ★ 就绪探针（K8s：能否接收流量） | 内部 |
| **`/actuator/info`** | GET | 应用信息（版本、构建时间、Git 提交） | 可暴露 |
| **`/actuator/metrics`** ★ | GET | 所有指标列表 | 内部 |
| `/actuator/metrics/&#123;name&#125;` | GET | ★ 单个指标详情（如 `http.server.requests`） | 内部 |
| **`/actuator/prometheus`** ★ | GET | ★ Prometheus 格式的所有指标 | 内部 |
| `/actuator/env` | GET | ★ 所有配置源及值（**含敏感信息！**） | ★ 必须限制 |
| `/actuator/env/&#123;name&#125;` | GET | 单个配置项 | ★ 必须限制 |
| **`/actuator/loggers`** ★ | GET/POST | ★★ **动态修改日志级别**（排查神器） | 内部 |
| `/actuator/threaddump` ★ | GET | ★ 线程快照（排查死锁、CPU 高） | 内部 |
| **`/actuator/heapdump`** | GET | ★★ **下载堆转储（能提取内存中的密码！）** | ★★ **生产必须禁用** |
| `/actuator/mappings` | GET | 所有 URL 映射（★ 排查 404） | 内部 |
| `/actuator/beans` | GET | 所有 Bean 及其依赖 | 内部 |
| `/actuator/configprops` | GET | 所有 @ConfigurationProperties 的值 | ★ 敏感 |
| `/actuator/conditions` | GET | ★ 自动配置评估报告 | 内部 |
| `/actuator/scheduledtasks` | GET | 所有定时任务 | 内部 |
| `/actuator/caches` | GET/DELETE | 缓存内容 | 内部 |
| **`/actuator/shutdown`** | POST | ★★ **关闭应用！** | ★★ **必须禁用** |
| `/actuator/startup` | POST | 启动步骤耗时（需 BufferingApplicationStartup） | 内部 |
| `/actuator/httptrace`（`/httpexchanges`） | GET | 最近的 HTTP 请求记录 | ★ 敏感 |
| `/actuator/flyway` / `/liquibase` | GET | 数据库迁移状态 | 内部 |
| `/actuator/sessions` | GET/DELETE | Session 列表（Spring Session） | ★ 敏感 |
| `/actuator/quartz` | GET | Quartz 任务详情 | 内部 |

```bash
# ─── ① 健康检查（★ K8s / 负载均衡器 / 发布脚本都用它）───
$ curl -s http://localhost:9090/internal/actuator/health | jq
{
  "status": "UP",                                     # ★ UP / DOWN / OUT_OF_SERVICE / UNKNOWN
  "groups": ["liveness", "readiness"],
  "components": {
    "db": {
      "status": "UP",
      "details": { "database": "MySQL", "validationQuery": "isValid()" }
    },
    "diskSpace": {
      "status": "UP",
      "details": { "total": 500107862016, "free": 128849018880, "threshold": 1073741824, "path": "/data" }
    },
    "redis": { "status": "UP", "details": { "version": "7.2.3" } },
    "livenessState": { "status": "UP" },
    "readinessState": { "status": "UP" },
    "ping": { "status": "UP" }
  }
}

# ★ K8s 探针配置
# livenessProbe:  httpGet: { path: /internal/actuator/health/liveness, port: 9090 }
# readinessProbe: httpGet: { path: /internal/actuator/health/readiness, port: 9090 }

# ★ Nginx 健康检查（upstream）
# server 10.0.0.1:9090 max_fails=3 fail_timeout=30s;
# 或用 Tengine/nginx_upstream_check_module 主动探测 /actuator/health

# ─── ② ★★ 动态修改日志级别（生产排查神器，不用重启！）───
# 查看当前级别
$ curl -s http://localhost:9090/internal/actuator/loggers/com.example.mall.service | jq
{ "configuredLevel": "INFO", "effectiveLevel": "INFO" }

# ★ 临时开启 DEBUG（排查 SQL / 业务逻辑）
$ curl -X POST http://localhost:9090/internal/actuator/loggers/com.example.mall.mapper \
    -H "Content-Type: application/json" \
    -d '{"configuredLevel": "DEBUG"}'

# ★ 排查完立即恢复（否则日志爆炸）
$ curl -X POST .../actuator/loggers/com.example.mall.mapper \
    -d '{"configuredLevel": "INFO"}'

# 恢复为继承父级
$ curl -X POST .../actuator/loggers/com.example -d '{"configuredLevel": null}'

# ─── ③ 查看指标 ───
$ curl -s http://localhost:9090/internal/actuator/metrics | jq '.names'
[ "jvm.memory.used", "jvm.gc.pause", "http.server.requests", "hikaricp.connections.active",
  "process.cpu.usage", "system.load.average.1m", "logback.events", ... ]

# ★ 单个指标（含维度）
$ curl -s ".../actuator/metrics/http.server.requests" | jq
{
  "name": "http.server.requests",
  "description": "Duration of HTTP server request handling",
  "baseUnit": "seconds",
  "measurements": [
    { "statistic": "COUNT", "value": 15234.0 },           # ★ 总请求数
    { "statistic": "TOTAL_TIME", "value": 452.3 },         # ★ 总耗时
    { "statistic": "MAX", "value": 2.341 }                  # ★ 最大耗时
  ],
  "availableTags": [
    { "tag": "uri", "values": ["/api/v1/users/{id}", "/api/v1/orders"] },
    { "tag": "method", "values": ["GET", "POST"] },
    { "tag": "status", "values": ["200", "400", "500"] },
    { "tag": "exception", "values": ["None", "BusinessException"] }
  ]
}

# ★ 按维度查询（某个接口的耗时）
$ curl -s ".../actuator/metrics/http.server.requests?tag=uri:/api/v1/users/{id}&tag=method:GET" | jq
# 平均耗时 = TOTAL_TIME / COUNT

# ★ 连接池指标（排查连接泄漏）
$ curl -s ".../actuator/metrics/hikaricp.connections.active" | jq      # 活跃连接
$ curl -s ".../actuator/metrics/hikaricp.connections.pending" | jq     # ★ 等待获取连接的线程数（>0 说明池不够）
$ curl -s ".../actuator/metrics/hikaricp.connections.timeout" | jq     # ★ 获取连接超时次数

# ★ JVM 指标
$ curl -s ".../actuator/metrics/jvm.memory.used?tag=area:heap" | jq
$ curl -s ".../actuator/metrics/jvm.gc.pause" | jq
$ curl -s ".../actuator/metrics/jvm.threads.live" | jq
$ curl -s ".../actuator/metrics/process.cpu.usage" | jq

# ─── ④ 线程快照（★ 排查 CPU 100% / 死锁）───
$ curl -s ".../actuator/threaddump" | jq '.threads[] | select(.threadState=="RUNNABLE")'
$ curl -s ".../actuator/threadump?format=text"                        # 文本格式（同 jstack）
# 用 jvisualvm / fastthread.io 分析

# ─── ⑤ Prometheus 抓取 ───
$ curl -s http://localhost:9090/internal/actuator/prometheus | head -50
# HELP http_server_requests_seconds
# TYPE http_server_requests_seconds summary
# http_server_requests_seconds_count{application="mall-service",exception="None",method="GET",outcome="SUCCESS",status="200",uri="/api/v1/users/{id}",} 1523.0
# http_server_requests_seconds_sum{...} 12.456
# HELP jvm_memory_used_bytes The amount of used memory
# jvm_memory_used_bytes{application="mall-service",area="heap",id="G1 Eden Space",} 2.68435456E8
# HELP hikaricp_connections_active Active connections
# hikaricp_connections_active{application="mall-service",pool="MallHikariPool",} 5.0
```

### 2.3 自定义健康检查与指标

```java
// ─── ① 自定义 HealthIndicator（★ 检查外部依赖）───
@Component
public class ThirdPartyApiHealthIndicator implements HealthIndicator {

    private final ThirdPartyClient client;
    public ThirdPartyApiHealthIndicator(ThirdPartyClient client) { this.client = client; }

    @Override
    public Health health() {
        try {
            long start = System.currentTimeMillis();
            boolean ok = client.ping();                                  // 调用第三方的健康接口
            long cost = System.currentTimeMillis() - start;
            if (!ok) {
                return Health.down().withDetail("reason", "ping 返回 false").build();
            }
            return Health.up()
                    .withDetail("api", client.getEndpoint())
                    .withDetail("responseTime", cost + "ms")
                    .withDetail("version", client.getVersion())
                    .build();
        } catch (Exception e) {
            // ★ DOWN 会导致负载均衡摘除节点！第三方故障不应该让本服务不可用
            // → 用「降级」状态而非 DOWN
            return Health.status("DEGRADED")                             // ★ 自定义状态
                    .withDetail("reason", "第三方 API 不可用: " + e.getMessage())
                    .withDetail("fallback", "已启用本地缓存降级")
                    .build();
        }
    }
}
// Bean 名 ThirdPartyApiHealthIndicator → 端点中的 key 是 "thirdPartyApi"

// ─── ② 自定义健康检查组（★ 区分核心与非核心依赖）───
@Configuration
public class HealthConfig {
    @Bean
    public HealthEndpointGroup coreHealthGroup() {
        // 只检查核心依赖（数据库），Redis 挂了不影响就绪
        return new SimpleHealthEndpointGroup(
                HealthEndpointSupport.KEYS_ALL,        // 或指定 keys
                new HealthStatusHttpMapper(),
                false);
    }
}
// yml 配置分组
management.endpoint.health.group:
  core:
    include: db                                          # ★ 只含数据库
  full:
    include: db,redis,thirdPartyApi,diskSpace

// ─── ③ ★ 自定义业务指标（Micrometer）───
@Service
@RequiredArgsConstructor
public class OrderMetrics {

    private final MeterRegistry registry;

    /** Counter：计数器（只增不减） */
    private final Counter orderCreatedCounter;
    /** Timer：耗时统计 */
    private final Timer orderProcessTimer;
    /** Gauge：瞬时值 */
    private final AtomicInteger pendingOrderCount = new AtomicInteger(0);

    public OrderMetrics(MeterRegistry registry) {
        this.registry = registry;
        // ★ Counter
        this.orderCreatedCounter = Counter.builder("mall.order.created")
                .description("创建的订单总数")
                .tag("channel", "unknown")                // 默认标签（后续可覆盖）
                .register(registry);
        // ★ Timer
        this.orderProcessTimer = Timer.builder("mall.order.process.duration")
                .description("订单处理耗时")
                .publishPercentiles(0.5, 0.9, 0.95, 0.99)   // ★ 分位数
                .publishPercentileHistogram()                 // ★ 直方图（Prometheus 聚合用）
                .sla(Duration.ofMillis(100), Duration.ofMillis(500), Duration.ofSeconds(1))  // ★ SLO 边界
                .register(registry);
        // ★ Gauge（绑定到一个对象/方法，Prometheus 拉取时实时计算）
        Gauge.builder("mall.order.pending", this, OrderMetrics::getPendingCount)
                .description("待处理订单数")
                .register(registry);
    }

    public void recordOrderCreated(String channel) {
        // ★ 带标签的 Counter（不同 channel 是不同的时间序列）
        registry.counter("mall.order.created", "channel", channel).increment();
    }

    public void recordOrderProcessed(String channel, boolean success, long costMs) {
        registry.timer("mall.order.process.duration",
                       "channel", channel,
                       "success", String.valueOf(success))
                .record(costMs, TimeUnit.MILLISECONDS);
    }

    /** ★ Timer 的自动计时（包裹业务代码） */
    public Order createOrderWithMetrics(OrderDTO dto) {
        return Timer.builder("mall.order.create")
                .tag("type", dto.getType())
                .register(registry)
                .record(() -> orderService.create(dto));        // ★ 自动记录耗时
    }

    /** ★ 用 @Timed 注解（需配 TimedAspect） */
    @Timed(value = "mall.order.query", description = "订单查询耗时",
           percentiles = {0.5, 0.95, 0.99}, histogram = true)
    public Order queryOrder(Long id) { return orderMapper.selectById(id); }

    public void incrementPending() { pendingOrderCount.incrementAndGet(); }
    public double getPendingCount() { return pendingOrderCount.get(); }

    /** ★ DistributionSummary：非时间的分布统计（如订单金额） */
    public void recordOrderAmount(BigDecimal amount) {
        registry.summary("mall.order.amount",
                        "channel", "app")
                .record(amount.doubleValue());
    }
}

// ★ 启用 @Timed / @Counted 注解
@Bean
public TimedAspect timedAspect(MeterRegistry registry) { return new TimedAspect(registry); }
@Bean
public CountedAspect countedAspect(MeterRegistry registry) { return new CountedAspect(registry); }
```

```java
// ─── ④ 应用信息（/actuator/info）───
@Configuration
public class InfoConfig {

    @Bean
    public InfoContributor customInfo() {
        return builder -> builder
                .withDetail("deploy", Map.of(
                        "region", System.getenv().getOrDefault("DEPLOY_REGION", "unknown"),
                        "instance", System.getenv().getOrDefault("HOSTNAME", "local"),
                        "jdk", System.getProperty("java.version"),
                        "startTime", LocalDateTime.now().toString()))
                .withDetail("features", Map.of(
                        "cache", "redis",
                        "mq", "rocketmq",
                        "search", "elasticsearch"));
    }
}
```

```xml
<!-- pom.xml：把 Git 提交信息和构建时间写入 info 端点（★ 排查「线上跑的是哪个版本」） -->
<plugin>
    <groupId>io.github.git-commit-id</groupId>
    <artifactId>git-commit-id-maven-plugin</artifactId>
    <version>7.0.0</version>
    <executions>
        <execution>
            <goals><goal>revision</goal></goals>
        </execution>
    </executions>
    <configuration>
        <generateGitPropertiesFile>true</generateGitPropertiesFile>
        <generateGitPropertiesFilename>${project.build.outputDirectory}/git.properties</generateGitPropertiesFilename>
        <includeOnlyProperties>
            <includeOnlyProperty>^git.branch$</includeOnlyProperty>
            <includeOnlyProperty>^git.commit.id.abbrev$</includeOnlyProperty>
            <includeOnlyProperty>^git.commit.time$</includeOnlyProperty>
            <includeOnlyProperty>^git.commit.message.full$</includeOnlyProperty>
            <includeOnlyProperty>^git.dirty$</includeOnlyProperty>
        </includeOnlyProperties>
    </configuration>
</plugin>
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <executions>
        <execution>
            <goals><goal>build-info</goal></goals>           <!-- ★ 生成 META-INF/build-info.properties -->
        </execution>
    </executions>
</plugin>
```

```json
// /actuator/info 的输出
{
  "git": {
    "branch": "master",
    "commit": { "id": "a1b2c3d", "time": "2026-09-07T10:30:00Z" },
    "dirty": false
  },
  "build": {
    "artifact": "mall-service",
    "name": "mall-service",
    "version": "1.0.0",
    "time": "2026-09-07T10:35:00Z",
    "group": "com.example"
  },
  "deploy": { "region": "cn-east", "instance": "mall-service-7d9f8-x2k4p", "jdk": "21.0.1" }
}
```

### 2.4 ★ Actuator 安全（生产事故高发区）

```yaml
# ═══ 必须做的四件事 ═══
management:
  server:
    port: 9090                    # ① ★ 独立端口（业务端口不暴露管理端点）
    address: 127.0.0.1            # ② ★ 只监听本机（K8s 中用 sidecar/网络策略访问）
  endpoints:
    web:
      exposure:
        include: health,info,prometheus,loggers    # ③ ★ 白名单，绝不用 "*"
    shutdown:
      enabled: false              # ④ ★★ 禁用 shutdown（能远程关闭应用！）
    heapdump:
      enabled: false               # ★★ 禁用 heapdump（能下载整个堆，含密码/Token/用户数据）
    env:
      show-values: never           # ★ 配置值永不显示
    configprops:
      show-values: never
    health:
      show-details: when_authorized  # 健康详情需要权限
```

```nginx
# ═══ Nginx 层屏蔽（★ 双保险）═══
location /actuator {
    # ★ 只允许内网访问
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    allow 127.0.0.1;
    deny all;

    # ★ 危险端点直接拒绝
    location ~ ^/actuator/(heapdump|threaddump|env|configprops|shutdown|beans|mappings|httpexchanges) {
        deny all;
        return 404;
    }

    # Basic 认证
    auth_basic "Actuator Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;

    proxy_pass http://backend;
}
```

> 【★ 真实事故案例】未做防护的 Actuator 导致的事故：
> 1. `/actuator/heapdump` 被下载 → **提取出数据库密码、JWT 密钥、用户手机号** → 数据库被拖。
> 2. `/actuator/env` + `/actuator/refresh`（配合 Spring Cloud）→ **远程改配置，植入恶意 `spring.cloud.bootstrap.location` 实现 RCE**。
> 3. `/actuator/shutdown` 被调用 → **服务被远程关闭**。
> 4. `/actuator/jolokia`（若引入了 Jolokia）→ **JMX 远程执行代码**。
> 5. `/actuator/gateway/routes`（Spring Cloud Gateway）→ **注入恶意路由实现 RCE**（CVE-2022-22947）。
>
> **铁律**：管理端口独立 + 只监听内网 + 端点白名单 + 禁用 heapdump/shutdown/env 详情 + Nginx 二次屏蔽。

## 3. 打包与部署 ★★★★★

### 3.1 可执行 jar 的结构

```bash
# ─── 打包 ───
mvn clean package -DskipTests
# 产物：target/mall-service.jar

# ─── ★ jar 内部结构（Spring Boot 的 Fat Jar）───
$ jar tf target/mall-service.jar | head -30
META-INF/
META-INF/MANIFEST.MF                            # ★ 清单文件
META-INF/maven/com.example/mall-service/pom.xml
org/springframework/boot/loader/                 # ★ Spring Boot 的类加载器！
org/springframework/boot/loader/JarLauncher.class
org/springframework/boot/loader/launch/JarLauncher.class
org/springframework/boot/loader/launch/LaunchedClassLoader.class
BOOT-INF/
BOOT-INF/classes/                                # ★ 你的代码和资源
BOOT-INF/classes/com/example/mall/MallApplication.class
BOOT-INF/classes/application.yml
BOOT-INF/classes/mapper/UserMapper.xml
BOOT-INF/lib/                                    # ★ 所有依赖 jar（★ 这就是 Fat Jar）
BOOT-INF/lib/spring-boot-3.4.0.jar
BOOT-INF/lib/spring-webmvc-6.2.0.jar
BOOT-INF/lib/mybatis-plus-spring-boot3-starter-3.5.9.jar
BOOT-INF/classpath.idx                           # ★ 类路径索引
BOOT-INF/layers.idx                              # ★ 分层索引（Docker 缓存优化）

# ─── MANIFEST.MF 内容 ───
Main-Class: org.springframework.boot.loader.launch.JarLauncher        # ★ 真正的入口
Start-Class: com.example.mall.MallApplication                          # ★ 你的启动类
Spring-Boot-Version: 3.4.0
Spring-Boot-Classes: BOOT-INF/classes/
Spring-Boot-Lib: BOOT-INF/lib/
Spring-Boot-Classpath-Index: BOOT-INF/classpath.idx
Spring-Boot-Layers-Index: BOOT-INF/layers.idx
Build-Jdk-Spec: 21
Implementation-Title: mall-service
Implementation-Version: 1.0.0

# ★ 启动流程：
# java -jar mall-service.jar
#   → JarLauncher.main()                       （Spring Boot 的启动器）
#   → 创建 LaunchedClassLoader（能加载 BOOT-INF/lib 中的 jar）
#   → 反射调用 Start-Class 的 main()            （你的 MallApplication.main）
#   → SpringApplication.run(...)
```

### 3.2 启动脚本（★ 生产标准）

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════
#  mall-service 启动脚本（生产标准模板）
# ═══════════════════════════════════════════════════════
set -euo pipefail

# ─── 基础配置 ───
APP_NAME="mall-service"
APP_HOME="/data/app/${APP_NAME}"
JAR_FILE="${APP_HOME}/${APP_NAME}.jar"
LOG_DIR="/data/logs/${APP_NAME}"
PID_FILE="${APP_HOME}/${APP_NAME}.pid"
PROFILE="${PROFILE:-prod}"
JAVA_OPTS_FILE="${APP_HOME}/jvm.options"               # ★ JVM 参数外置（改参数不改脚本）

mkdir -p "${LOG_DIR}"

# ─── ★ JVM 参数（★ 生产推荐配置）───
# 堆内存：容器环境下用 MaxRAMPercentage 更灵活
JAVA_OPTS="
  -XX:+UseContainerSupport
  -XX:InitialRAMPercentage=70.0
  -XX:MaxRAMPercentage=70.0
  -XX:MinRAMPercentage=70.0
  -Xss512k
  -XX:MetaspaceSize=256m
  -XX:MaxMetaspaceSize=512m
  -XX:+UseG1GC
  -XX:MaxGCPauseMillis=200
  -XX:G1HeapRegionSize=16m
  -XX:InitiatingHeapOccupancyPercent=45
  -XX:+ParallelRefProcEnabled
  -XX:+ExplicitGCInvokesConcurrent
  -XX:+UseStringDeduplication
"

# ★ GC 日志（JDK 9+ 统一日志）
GC_OPTS="
  -Xlog:gc*,gc+heap=debug,gc+age=trace:file=${LOG_DIR}/gc-%t.log:time,uptime,level,tags:filecount=10,filesize=50M
"

# ★★ OOM 时自动 dump（★ 排查内存泄漏的救命配置）
DUMP_OPTS="
  -XX:+HeapDumpOnOutOfMemoryError
  -XX:HeapDumpPath=${LOG_DIR}/heapdump.hprof
  -XX:OnOutOfMemoryError=sh ${APP_HOME}/oom-handler.sh %p
  -XX:+ExitOnOutOfMemoryError
"

# ★ 错误日志
ERROR_OPTS="
  -XX:ErrorFile=${LOG_DIR}/hs_err_%p.log
  -XX:+UnlockDiagnosticVMOptions
"

# ─── 应用参数 ───
APP_OPTS="
  --spring.profiles.active=${PROFILE}
  --spring.config.additional-location=file:${APP_HOME}/config/
  --logging.file.path=${LOG_DIR}
"

# ─── 启动 ───
start() {
    if [ -f "${PID_FILE}" ] && kill -0 "$(cat ${PID_FILE})" 2>/dev/null; then
        echo "★ ${APP_NAME} 已在运行 (PID: $(cat ${PID_FILE}))"
        return 1
    fi
    echo "启动 ${APP_NAME} ..."
    # ★ 合并所有 JVM 参数（去换行）
    ALL_JAVA_OPTS=$(echo "${JAVA_OPTS} ${GC_OPTS} ${DUMP_OPTS} ${ERROR_OPTS}" | tr -s ' \n' ' ')

    nohup java ${ALL_JAVA_OPTS} \
        -Dfile.encoding=UTF-8 \
        -Duser.timezone=Asia/Shanghai \
        -Djava.security.egd=file:/dev/./urandom \      # ★ 加快随机数生成（避免启动卡顿）
        -jar "${JAR_FILE}" \
        ${APP_OPTS} \
        > "${LOG_DIR}/stdout.log" 2>&1 &

    echo $! > "${PID_FILE}"
    echo "PID: $(cat ${PID_FILE})"

    # ★ 等待健康检查通过
    echo -n "等待应用就绪"
    for i in $(seq 1 60); do
        sleep 1
        echo -n "."
        if curl -sf "http://127.0.0.1:9090/internal/actuator/health/readiness" > /dev/null 2>&1; then
            echo ""
            echo "✅ ${APP_NAME} 启动成功！耗时 ${i} 秒"
            return 0
        fi
        if ! kill -0 "$(cat ${PID_FILE})" 2>/dev/null; then
            echo ""
            echo "❌ 进程已退出，请查看 ${LOG_DIR}/stdout.log"
            tail -50 "${LOG_DIR}/stdout.log"
            return 1
        fi
    done
    echo ""
    echo "⚠️ 60 秒内未就绪，请检查日志"
    return 1
}

# ─── ★ 优雅停机（关键！）───
stop() {
    if [ ! -f "${PID_FILE}" ]; then
        echo "${APP_NAME} 未在运行"
        return 0
    fi
    PID=$(cat "${PID_FILE}")
    if ! kill -0 "${PID}" 2>/dev/null; then
        echo "进程 ${PID} 不存在，清理 PID 文件"
        rm -f "${PID_FILE}"
        return 0
    fi

    echo "★ 开始优雅停机 ${APP_NAME} (PID: ${PID}) ..."

    # ① 先摘流量（从注册中心下线 / Nginx 摘除）
    curl -sf -X POST "http://127.0.0.1:9090/internal/actuator/serviceregistry?status=DOWN" || true
    echo "已从注册中心下线，等待 10 秒让流量切走..."
    sleep 10                                            # ★ 关键：等在途请求处理完

    # ② ★ 发送 SIGTERM（触发 Spring 的优雅停机钩子）
    kill -15 "${PID}"                                   # ★★ 必须用 -15，绝不用 -9！

    # ③ 等待进程退出（最多 60 秒）
    for i in $(seq 1 60); do
        if ! kill -0 "${PID}" 2>/dev/null; then
            echo "✅ 优雅停机完成，耗时 ${i} 秒"
            rm -f "${PID_FILE}"
            return 0
        fi
        sleep 1
        echo -n "."
    done

    # ④ 超时强制杀掉（最后手段）
    echo ""
    echo "⚠️ 60 秒未退出，强制终止..."
    kill -9 "${PID}" || true
    rm -f "${PID_FILE}"
    echo "已强制终止"
}

# ─── 重启 / 状态 ───
restart() { stop && sleep 2 && start; }

status() {
    if [ -f "${PID_FILE}" ] && kill -0 "$(cat ${PID_FILE})" 2>/dev/null; then
        PID=$(cat "${PID_FILE}")
        echo "✅ ${APP_NAME} 运行中 (PID: ${PID})"
        echo "  内存: $(ps -o rss= -p ${PID} | awk '{printf "%.0f MB", $1/1024}')"
        echo "  CPU:  $(ps -o %cpu= -p ${PID})%"
        echo "  运行时长: $(ps -o etime= -p ${PID})"
        curl -s "http://127.0.0.1:9090/internal/actuator/health" | jq -r '.status' 2>/dev/null || echo "  健康检查: 未知"
    else
        echo "❌ ${APP_NAME} 未运行"
        return 1
    fi
}

# ─── 入口 ───
case "${1:-}" in
    start)   start ;;
    stop)    stop ;;
    restart) restart ;;
    status)  status ;;
    *)
        echo "用法: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
```

```bash
# ─── 命令行启动（快速测试）───
java -jar mall-service.jar                                        # 最简
java -jar mall-service.jar --spring.profiles.active=prod          # 指定 profile
java -jar mall-service.jar --server.port=9090                     # 覆盖端口
java -Xms2g -Xmx2g -jar mall-service.jar                          # ★ JVM 参数必须在 -jar 之前！
java -Dspring.profiles.active=prod -jar mall-service.jar          # 系统属性也在 -jar 之前
java -jar mall-service.jar -Dspring.profiles.active=prod          # ❌ 错误！这会被当成应用参数

# ─── 后台运行 ───
nohup java -jar mall-service.jar > /dev/null 2>&1 &               # ★ 输出重定向到 /dev/null（日志由 logback 管）

# ─── systemd 管理（★ Linux 生产推荐）───
# /etc/systemd/system/mall-service.service
```

```ini
[Unit]
Description=Mall Service
Documentation=https://wiki.example.com/mall
After=network.target mysql.service redis.service
Wants=mysql.service redis.service

[Service]
Type=simple
User=appuser                                            # ★ 非 root 用户运行
Group=appgroup
WorkingDirectory=/data/app/mall-service
# ★ 环境变量（敏感信息用 EnvironmentFile）
EnvironmentFile=/data/app/mall-service/env/production.env
Environment="JAVA_HOME=/usr/lib/jvm/java-21"
Environment="TZ=Asia/Shanghai"
# ★ 启动命令（exec 让 Java 进程成为主进程，能正确接收信号）
ExecStart=/usr/lib/jvm/java-21/bin/java \
    -XX:+UseContainerSupport \
    -XX:MaxRAMPercentage=70.0 \
    -XX:+UseG1GC \
    -XX:MaxGCPauseMillis=200 \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:HeapDumpPath=/data/logs/mall-service/heapdump.hprof \
    -Xlog:gc*:file=/data/logs/mall-service/gc-%t.log:time,uptime:filecount=10,filesize=50M \
    -Dfile.encoding=UTF-8 \
    -Duser.timezone=Asia/Shanghai \
    -jar /data/app/mall-service/mall-service.jar \
    --spring.profiles.active=prod \
    --spring.config.additional-location=file:/data/app/mall-service/config/
# ★★ 优雅停机（关键配置）
SuccessExitStatus=143                                    # ★ SIGTERM 退出码（128+15）视为成功
KillMode=mixed                                           # ★ 先给主进程发信号，超时后杀整个 cgroup
KillSignal=SIGTERM                                       # ★ 用 SIGTERM（触发 Spring 的 shutdown hook）
TimeoutStopSec=60                                        # ★ 等待 60 秒再强杀
Restart=on-failure                                       # ★ 异常退出自动重启
RestartSec=10s
StartLimitInterval=300
StartLimitBurst=5                                        # ★ 5 分钟内最多重启 5 次（防止崩溃循环）

# ★ 资源限制
LimitNOFILE=65536                                        # ★ 文件描述符（默认 1024 太少！）
LimitNPROC=65536
MemoryMax=4G                                             # cgroup 内存上限
CPUQuota=200%                                            # 2 核

# ★ 安全加固
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/data/logs/mall-service /data/app/mall-service

# 标准输出/错误 → journald（也可用 logback 写文件）
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mall-service

[Install]
WantedBy=multi-user.target
```

```bash
# systemd 常用命令
sudo systemctl daemon-reload                    # 改了 service 文件后必须执行
sudo systemctl start mall-service
sudo systemctl stop mall-service                 # ★ 触发优雅停机
sudo systemctl restart mall-service
sudo systemctl status mall-service               # 状态 + 最近日志
sudo systemctl enable mall-service               # ★ 开机自启
sudo systemctl disable mall-service
journalctl -u mall-service -f                    # ★ 实时日志
journalctl -u mall-service --since "1 hour ago"
journalctl -u mall-service -p err                # 只看错误

# ★ 优雅停机的前提配置（application.yml）
# server:
#   shutdown: graceful                              # ★ 开启
# spring:
#   lifecycle:
#     timeout-per-shutdown-phase: 30s                # ★ 等待时间
# 停机流程：
#   ① 收到 SIGTERM → Spring 发布 ContextClosedEvent
#   ② ★ Tomcat 停止接收新请求（但保持连接）
#   ③ ★ 等待在途请求处理完成（最多 timeout-per-shutdown-phase）
#   ④ 销毁所有 Bean（触发 @PreDestroy / DisposableBean）
#   ⑤ 关闭线程池、连接池、MQ 消费者
#   ⑥ JVM 退出
```

### 3.3 Docker 部署

```dockerfile
# ═══════ Dockerfile（★ 生产最佳实践）═══════
# ─── 阶段 1：构建（★ 多阶段构建，最终镜像不含 Maven 和源码）───
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /build
# ★ 先只复制 pom（利用 Docker 层缓存：依赖不变时不重新下载）
COPY pom.xml .
RUN mvn dependency:go-offline -B
# 再复制源码构建
COPY src ./src
RUN mvn clean package -DskipTests -B

# ─── 阶段 2：提取分层（★ Boot 3.3+ 的 layertools）───
FROM eclipse-temurin:21-jre-alpine AS extractor
WORKDIR /extract
COPY --from=builder /build/target/*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# ─── 阶段 3：运行镜像 ───
FROM eclipse-temurin:21-jre-alpine
# ★ 用 JRE 而非 JDK（镜像更小）；alpine 更小但可能有 musl 兼容问题，生产可用 -jammy

LABEL maintainer="dev@example.com" \
      org.opencontainers.image.title="mall-service" \
      org.opencontainers.image.version="1.0.0"

# ★ 安装必要工具（时区、curl 用于健康检查、字体用于导出 PDF/Excel）
RUN apk add --no-cache tzdata curl fontconfig ttf-dejavu \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata

# ★★ 创建非 root 用户（安全铁律）
RUN addgroup -S -g 1000 app && adduser -S -u 1000 -G app app
WORKDIR /app
RUN mkdir -p /app/logs /app/config && chown -R app:app /app

# ★★ 分层复制（★ Docker 层缓存优化：依赖层变化少，代码层变化多）
COPY --from=extractor --chown=app:app /extract/dependencies/ ./
COPY --from=extractor --chown=app:app /extract/spring-boot-loader/ ./
COPY --from=extractor --chown=app:app /extract/snapshot-dependencies/ ./
COPY --from=extractor --chown=app:app /extract/application/ ./

USER app                                                 # ★ 切换为非 root

# ★ JVM 参数（容器感知 + 优雅停机 + OOM dump）
ENV JAVA_OPTS="-XX:+UseContainerSupport \
    -XX:MaxRAMPercentage=70.0 \
    -XX:InitialRAMPercentage=70.0 \
    -XX:+UseG1GC \
    -XX:MaxGCPauseMillis=200 \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:HeapDumpPath=/app/logs/heapdump.hprof \
    -XX:+ExitOnOutOfMemoryError \
    -Xlog:gc*:file=/app/logs/gc.log:time,uptime:filecount=5,filesize=20M \
    -Dfile.encoding=UTF-8 \
    -Duser.timezone=Asia/Shanghai \
    -Djava.security.egd=file:/dev/./urandom"

# 应用参数（可在 docker run -e 覆盖）
ENV SPRING_PROFILES_ACTIVE=prod \
    SERVER_PORT=8080 \
    MANAGEMENT_SERVER_PORT=9090

EXPOSE 8080 9090

# ★ 健康检查（Docker/K8s 会用）
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:9090/internal/actuator/health/readiness || exit 1

# ★ 用 exec 格式（不用 shell 包装，确保 Java 进程是 PID 1 并能接收 SIGTERM）
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/org/springframework/boot/loader/launch/JarLauncher.class 2>/dev/null || exec java $JAVA_OPTS org.springframework.boot.loader.launch.JarLauncher"]
# ★ 更简单的写法（分层解压后）：
# ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -cp /app org.springframework.boot.loader.launch.JarLauncher"]
# ★★ 关键：必须有 exec，否则信号被 sh 拦截，无法优雅停机！
```

```dockerfile
# ═══════ 简化版 Dockerfile（不分层，适合小项目）═══════
FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache tzdata curl && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --chown=app:app target/mall-service.jar app.jar
USER app
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseG1GC -XX:+HeapDumpOnOutOfMemoryError"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
```

```bash
# ─── 构建与运行 ───
docker build -t mall-service:1.0.0 -t mall-service:latest .
docker images | grep mall-service
# ★ 查看分层历史（验证缓存优化）
docker history mall-service:latest

# 运行
docker run -d \
  --name mall-service \
  -p 8080:8080 -p 9090:9090 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e DB_PASSWORD=xxx \
  -e JAVA_OPTS="-Xmx2g -Xms2g" \
  -v /data/logs/mall-service:/app/logs \               # ★ 日志挂载到宿主机
  -v /data/app/mall-service/config:/app/config:ro \     # ★ 配置挂载（只读）
  --memory=4g --cpus=2 \                                # ★ 资源限制
  --restart=unless-stopped \
  --health-cmd="curl -sf http://localhost:9090/internal/actuator/health || exit 1" \
  mall-service:1.0.0

# 常用命令
docker logs -f --tail 200 mall-service                  # ★ 实时日志
docker stats mall-service                                # 资源占用
docker exec -it mall-service sh                          # 进入容器
docker inspect mall-service | jq '.[0].State.Health'      # 健康状态
docker stop -t 60 mall-service                           # ★ -t 60 = 等待 60 秒优雅停机
```

```yaml
# ═══════ docker-compose.yml（本地完整环境）═══════
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: mall-mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: mall
      TZ: Asia/Shanghai
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_general_ci
      - --max_connections=1000
      - --innodb_buffer_pool_size=1G
      - --slow_query_log=1
      - --long_query_time=1
    ports: ["3306:3306"]
    volumes:
      - mysql_data:/var/lib/mysql
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [mall-net]

  redis:
    image: redis:7.2-alpine
    container_name: mall-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru
    ports: ["6379:6379"]
    volumes: [redis_data:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      retries: 5
    networks: [mall-net]

  mall-service:
    build:
      context: .
      dockerfile: Dockerfile
    image: mall-service:1.0.0
    container_name: mall-service
    depends_on:
      mysql: { condition: service_healthy }             # ★ 等 MySQL 健康后才启动
      redis: { condition: service_healthy }
    environment:
      SPRING_PROFILES_ACTIVE: prod
      DB_URL: jdbc:mysql://mysql:3306/mall?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
      DB_USERNAME: root
      DB_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      REDIS_HOST: redis
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JAVA_OPTS: "-XX:MaxRAMPercentage=70 -XX:+UseG1GC"
    ports: ["8080:8080", "9090:9090"]
    volumes:
      - ./logs:/app/logs
      - ./config:/app/config:ro
    deploy:
      resources:
        limits: { cpus: '2', memory: 4G }
        reservations: { cpus: '1', memory: 2G }
    restart: unless-stopped
    networks: [mall-net]

  # ★ 监控栈
  prometheus:
    image: prom/prometheus:v2.50.0
    container_name: prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports: ["9091:9090"]
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    networks: [mall-net]

  grafana:
    image: grafana/grafana:10.3.0
    container_name: grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    ports: ["3000:3000"]
    depends_on: [prometheus]
    networks: [mall-net]

volumes:
  mysql_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  mall-net:
    driver: bridge
```

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'mall-service'
    metrics_path: '/internal/actuator/prometheus'
    static_configs:
      - targets: ['mall-service:9090']
        labels:
          application: 'mall-service'
          env: 'prod'

  - job_name: 'mysql'
    static_configs:
      - targets: ['mysqld-exporter:9104']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

# ★ 告警规则
rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

```yaml
# monitoring/alerts.yml（★ 关键告警规则）
groups:
  - name: mall-service-alerts
    rules:
      # ─── 应用存活 ───
      - alert: ServiceDown
        expr: up{application="mall-service"} == 0
        for: 1m
        labels: { severity: critical }
        annotations:
          summary: "★ 服务不可用: {{ $labels.instance }}"
          description: "mall-service 实例已下线超过 1 分钟"

      # ─── 健康检查 ───
      - alert: HealthCheckFailed
        expr: |
          (http_server_requests_seconds_count{uri="/internal/actuator/health", status!="200"} > 0)
          or absent(up{application="mall-service"})
        for: 2m
        labels: { severity: critical }

      # ─── ★ 接口性能 ───
      - alert: HighP99Latency
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_server_requests_seconds_bucket{application="mall-service"}[5m])) by (le, uri)
          ) > 1
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "P99 延迟超过 1 秒: {{ $labels.uri }}"
          description: "当前 P99: {{ $value }}s"

      - alert: HighErrorRate
        expr: |
          sum(rate(http_server_requests_seconds_count{application="mall-service",status=~"5.."}[5m]))
          /
          sum(rate(http_server_requests_seconds_count{application="mall-service"}[5m]))
          > 0.01
        for: 3m
        labels: { severity: critical }
        annotations:
          summary: "★ 5xx 错误率超过 1%"
          description: "当前错误率: {{ $value | humanizePercentage }}"

      # ─── ★ JVM ───
      - alert: HighHeapUsage
        expr: |
          sum(jvm_memory_used_bytes{application="mall-service",area="heap"})
          /
          sum(jvm_memory_max_bytes{application="mall-service",area="heap"})
          > 0.85
        for: 10m
        labels: { severity: warning }
        annotations:
          summary: "堆内存使用率超过 85%: {{ $value | humanizePercentage }}"

      - alert: FrequentFullGC
        expr: rate(jvm_gc_pause_seconds_count{application="mall-service",action="end of major GC"}[5m]) > 0.1
        for: 5m
        labels: { severity: critical }
        annotations:
          summary: "★ Full GC 频繁（可能存在内存泄漏）"

      - alert: LongGCPause
        expr: jvm_gc_pause_seconds_max{application="mall-service"} > 1
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "GC 停顿超过 1 秒: {{ $value }}s"

      # ─── ★ 连接池 ───
      - alert: ConnectionPoolExhausted
        expr: hikaricp_connections_pending{application="mall-service"} > 0
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "★ 数据库连接池耗尽，有线程在等待连接"
          description: "等待线程数: {{ $value }}，活跃连接: {{ with query \"hikaricp_connections_active\" }}{{ . | first | value }}{{ end }}"

      # ─── ★ 线程池 ───
      - alert: ThreadPoolRejected
        expr: increase(executor_rejected_total{application="mall-service"}[5m]) > 0
        for: 1m
        labels: { severity: critical }
        annotations:
          summary: "★ 线程池拒绝任务: {{ $labels.name }}"

      # ─── 系统资源 ───
      - alert: HighCpuUsage
        expr: process_cpu_usage{application="mall-service"} > 0.85
        for: 10m
        labels: { severity: warning }

      - alert: DiskSpaceLow
        expr: disk_free_bytes{application="mall-service"} < 1073741824
        for: 5m
        labels: { severity: critical }
        annotations:
          summary: "★ 磁盘剩余空间不足 1GB"

      # ─── 业务指标 ───
      - alert: OrderCreationFailed
        expr: increase(mall_order_created_total{success="false"}[5m]) > 10
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "订单创建失败数异常增加"
```

### 3.4 K8s 部署要点

```yaml
# deployment.yaml（★ 关键配置）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mall-service
  labels: { app: mall-service, version: v1 }
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1                    # 最多多 1 个 Pod
      maxUnavailable: 0              # ★ 0 = 不允许可用副本减少（无损发布）
  selector:
    matchLabels: { app: mall-service }
  template:
    metadata:
      labels: { app: mall-service, version: v1 }
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/path: "/internal/actuator/prometheus"
        prometheus.io/port: "9090"
    spec:
      terminationGracePeriodSeconds: 90      # ★★ 优雅停机总时间（> Spring 的 timeout）
      containers:
        - name: mall-service
          image: registry.example.com/mall/mall-service:1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - { name: http, containerPort: 8080 }
            - { name: mgmt, containerPort: 9090 }
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: "prod"
            - name: POD_NAME                              # ★ 用于日志标识实例
              valueFrom: { fieldRef: { fieldPath: metadata.name } }
            - name: DB_PASSWORD
              valueFrom: { secretKeyRef: { name: mall-secrets, key: db-password } }   # ★ Secret
          resources:
            requests: { cpu: "1", memory: "2Gi" }         # ★ 请求（调度依据）
            limits:   { cpu: "2", memory: "4Gi" }         # ★ 上限（超过被 OOMKill）
            # ★ 关键：limits.memory 与 -XX:MaxRAMPercentage 配合
            #   MaxRAMPercentage=70 → 堆最大 = 4Gi × 70% = 2.8Gi
            #   剩余 1.2Gi 给 Metaspace、线程栈、直接内存、GC 开销
          # ★★ 存活探针（失败则重启 Pod）
          livenessProbe:
            httpGet:
              path: /internal/actuator/health/liveness     # ★ 用 liveness（不检查外部依赖！）
              port: mgmt
            initialDelaySeconds: 60                        # ★ 给 Spring Boot 足够的启动时间
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          # ★★ 就绪探针（失败则从 Service 摘除流量，但不重启）
          readinessProbe:
            httpGet:
              path: /internal/actuator/health/readiness     # ★ 用 readiness（检查 DB/Redis）
              port: mgmt
            initialDelaySeconds: 20
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
            successThreshold: 1
          # ★ 启动探针（慢启动应用用，避免 liveness 误杀）
          startupProbe:
            httpGet: { path: /internal/actuator/health, port: mgmt }
            failureThreshold: 30                            # 最多等 30×10=300 秒
            periodSeconds: 10
          lifecycle:
            preStop:                                         # ★★ 优雅停机的前置钩子
              exec:
                command: ["/bin/sh", "-c", "sleep 15"]       # ★ 等 15 秒：让 K8s 先把 Pod 从 Endpoints 摘除
          volumeMounts:
            - { name: logs, mountPath: /app/logs }
            - { name: config, mountPath: /app/config, readOnly: true }
      volumes:
        - name: logs
          emptyDir: {}                                       # 或用 PVC / hostPath
        - name: config
          configMap: { name: mall-service-config }
---
apiVersion: v1
kind: Service
metadata:
  name: mall-service
spec:
  selector: { app: mall-service }
  ports:
    - { name: http, port: 8080, targetPort: http }
```

> 【★★ K8s 优雅停机的完整时序】（生产必懂）
> ```
> ① kubectl delete pod / 滚动更新
> ② Pod 状态改为 Terminating
> ③ ★ 并行发生两件事：
>    a) Pod 从 Service 的 Endpoints 中移除（★ 但传播到各节点的 kube-proxy 需要时间！）
>    b) 执行 preStop 钩子（sleep 15）
> ④ preStop 结束后，发送 SIGTERM 给容器主进程
> ⑤ Spring 收到 SIGTERM → 触发 graceful shutdown
>    - Tomcat 停止接收新请求
>    - 等待在途请求完成（spring.lifecycle.timeout-per-shutdown-phase）
>    - 从注册中心下线（如果是微服务）
>    - 销毁 Bean、关闭连接池
> ⑥ 进程退出
> ⑦ 若超过 terminationGracePeriodSeconds（90s）仍未退出 → SIGKILL 强杀
> ```
> **为什么需要 `preStop: sleep 15`？**
> Endpoints 的摘除是**异步**的，可能有几秒延迟。如果 SIGTERM 立即到达，应用已经开始拒绝新连接，但 kube-proxy 还在往这个 Pod 转发流量 → **502/503 错误**。sleep 15 秒给了 K8s 足够的时间完成流量摘除。

## 4. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | ★ 用 `System.out.println` | 无级别、无法关闭、性能差、日志丢失 | 一律用 SLF4J |
| 2 | ★ 日志字符串拼接 | 性能浪费（即使不输出也拼接） | 用 `&#123;&#125;` 占位符 |
| 3 | ★ `log.error("msg: &#123;&#125;", e)` | 丢失栈信息 | `log.error("msg", e)`（异常作最后参数） |
| 4 | `e.printStackTrace()` | 输出到 stderr，日志系统收集不到 | 用 logger |
| 5 | Logger 名写错（复制粘贴） | 日志来源混乱 | 用 Lombok `@Slf4j` |
| 6 | 日志记录敏感信息 | ★ 密码/Token/手机号泄漏 | 脱敏工具类 |
| 7 | Logback 未用异步 Appender | 高并发下日志成瓶颈 | `AsyncAppender` + `neverBlock=true` |
| 8 | `includeCallerData=true` + 异步 | 性能骤降 | 设 false（放弃 %file %line） |
| 9 | logger 未设 `additivity=false` | ★ 日志重复打印两遍 | 显式设 false |
| 10 | 用 `logback.xml` 而非 `logback-spring.xml` | `<springProfile>` 不生效 | ★ 用 `logback-spring.xml` |
| 11 | 生产开着 DEBUG | 磁盘写满、性能差 | 生产 root=WARN，业务 INFO |
| 12 | 未配日志轮转 | 单个日志文件几十 GB | `SizeAndTimeBasedRollingPolicy` + `totalSizeCap` |
| 13 | 未配 MDC 清理 | traceId 串号（线程池复用） | `finally &#123; MDC.clear(); &#125;` |
| 14 | ★ `/actuator` 全暴露 | heapdump 被下载 → 数据泄漏 | 端点白名单 + 禁用 heapdump/shutdown |
| 15 | 管理端口未隔离 | 外网能访问 Actuator | `management.server.port` + `address: 127.0.0.1` |
| 16 | `/actuator/env` 显示明文密码 | 配置泄漏 | `show-values: never` |
| 17 | K8s liveness 探针检查了 DB | DB 抖动导致 Pod 被反复重启 | ★ liveness 只检查进程，readiness 才检查依赖 |
| 18 | 未配 `preStop` sleep | 发布时出现 502 | `preStop: sleep 15` |
| 19 | `terminationGracePeriodSeconds` 太短 | 在途请求被强杀 | 设为 > Spring 的 shutdown timeout |
| 20 | Docker ENTRYPOINT 未用 exec | SIGTERM 被 sh 拦截，无法优雅停机 | `ENTRYPOINT ["sh","-c","exec java ..."]` |
| 21 | 容器以 root 运行 | 安全风险 | `USER app` |
| 22 | 容器内 JVM 堆设置超过 limits | ★ OOMKilled（Exit Code 137） | `MaxRAMPercentage=70`（留出非堆空间） |
| 23 | 未配 `HeapDumpOnOutOfMemoryError` | OOM 后无法排查 | 必配 + 挂载持久化卷 |
| 24 | JVM 参数写在 `-jar` 之后 | 被当成应用参数，不生效 | ★ 必须在 `-jar` 之前 |
| 25 | `kill -9` 停服务 | 数据丢失、连接泄漏、无法优雅停机 | ★ `kill -15` |
| 26 | systemd 未配 `SuccessExitStatus=143` | 优雅停机被记为失败并触发重启 | 配置该项 |
| 27 | `LimitNOFILE` 未调 | 高并发下 `Too many open files` | 设 65536 |
| 28 | Fat jar 未分层 | Docker 每次构建都要重传全部依赖 | `&lt;layers&gt;&lt;enabled&gt;true</enabled>` |
| 29 | war 部署到外部 Tomcat | 需继承 `SpringBootServletInitializer` | 现代项目一律用 jar |
| 30 | 未配 `spring.main.register-shutdown-hook` | 无法优雅停机 | 默认 true，别改成 false |
| 31 | 静态资源打进 jar | 改前端要重新发布 | 前端独立部署（Nginx / CDN） |
| 32 | 配置文件打进 jar | 改配置要重新打包 | `spring.config.additional-location` 外置 |

---

## 关联笔记

- 上一篇：[[后端/SpringBoot/整合Web开发]]
- 下一篇：[[后端/SpringBoot/测试与常用整合实战]]
- 部署：[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]、[[后端/Java工程化与部署/Linux与Java项目部署]]
- JVM：[[后端/JVM/JVM调优与线上问题排查]]（GC 日志分析、OOM 排查）
- 监控进阶：[[后端/微服务/分布式ID与链路追踪]]（SkyWalking / Zipkin）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
