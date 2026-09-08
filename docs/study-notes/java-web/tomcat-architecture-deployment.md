---
title: "Tomcat架构与部署"
aliases:
  - "Tomcat"
  - "Servlet 容器"
  - "嵌入式 Tomcat"
tags:
  - "后端"
  - "java"
  - "javaweb"
  - "面试"
category: "后端"
folder: "JavaWeb"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/JavaWeb/Servlet核心与生命周期]]"
  - "[[后端/JVM/类加载机制与字节码]]"
  - "[[后端/SpringBoot/SpringBoot入门与项目搭建]]"
  - "[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]"
created: 2026-09-07
updated: 2026-09-07
---

# Tomcat 架构与部署

## 1. Tomcat 是什么

**Tomcat 是 Apache 基金会开源的「Servlet 容器 + JSP 引擎」**，实现了 Jakarta Servlet、Jakarta Server Pages、WebSocket 等规范，是全球使用最广的 Java Web 服务器。

| 角色 | 说明 | 代表 |
| --- | --- | --- |
| **Web 服务器** | 处理 HTTP 请求、返回静态资源 | Nginx、Apache httpd、IIS |
| **Servlet 容器** | 管理 Servlet 生命周期、执行 Java Web 代码 | **Tomcat**、Jetty、Undertow |
| **应用服务器** | 完整的 Jakarta EE（EJB、JMS、JTA、JPA...） | WebLogic、WebSphere、WildFly、GlassFish |

Tomcat 严格来说是「**轻量级应用服务器**」（只实现 Web 相关规范，不含 EJB），但在实际使用中它既是 Web 服务器也是 Servlet 容器。

### 1.1 主流 Servlet 容器对比

| 容器 | 特点 | 适用 |
| --- | --- | --- |
| **Tomcat** | ★ 最通用、生态最全、文档最多、稳定 | 默认选择，99% 的 Spring Boot 项目 |
| **Jetty** | 轻量、启动快、长连接和异步支持好、可嵌入性强 | 需要长连接（如聊天）、嵌入式场景 |
| **Undertow** | WildFly 默认，**基于 NIO/XNIO，内存占用小、并发高** | 高并发、微服务、内存敏感场景 |
| **Netty** | 非 Servlet 容器（纯 NIO 框架），WebFlux 可用它 | 响应式编程、自定义协议 |
| **Resin** | Caucho 出品，曾以性能著称 | 已少用 |

```xml
<!-- Spring Boot 切换容器：排除 Tomcat，引入 Undertow -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-undertow</artifactId>
</dependency>
```

```yaml
# Undertow 配置
server:
  undertow:
    threads:
      io: 8              # IO 线程数（默认 = CPU 核数）
      worker: 256          # 工作线程数（默认 = io × 8）
    buffer-size: 1024        # 缓冲区大小（字节，默认 1024，堆 < 128MB 时；否则 16KB）
    direct-buffers: true     # 使用直接内存
    max-http-post-size: 10MB
```

| 对比 | Tomcat | Undertow |
| --- | --- | --- |
| IO 模型 | NIO（默认）、APR、BIO（已移除） | **XNIO（非阻塞 + 任务分离）** |
| 内存占用 | 中（默认堆较大） | **低**（可低至几十 MB） |
| 并发能力 | 高（线程池模型） | **更高**（非阻塞） |
| 生态/文档 | **最全** | 较少 |
| 兼容性 | **最好**（Servlet 规范标杆） | 个别边缘特性有差异 |
| 生产实践 | **主流** | WildFly、部分高性能微服务 |

> 【实践】**默认用 Tomcat**。除非有明确的内存/并发瓶颈且压测证明 Undertow 更优，否则不要换（生态和排错资料的差距很实际）。

### 1.2 Tomcat 版本与 JDK/Servlet 对应 ★★★★★

| Tomcat | Servlet | Jakarta EE | **最低 JDK** | 包名 | Spring Boot |
| --- | --- | --- | --- | --- | --- |
| 8.5 | 3.1 | Java EE 7 | **JDK 7** | `javax.servlet` | 1.5（已 EOL） |
| **9.0** | **4.0** | Java EE 8 | **JDK 8** | `javax.servlet` | **2.x** ★ |
| **10.0** | **5.0** | **Jakarta EE 9** | **JDK 8** | **`jakarta.servlet`** ★ | — |
| **10.1** | **6.0** | Jakarta EE 10 | **JDK 11** | `jakarta.servlet` | **3.x** ★ |
| 11.0 | 6.1 | Jakarta EE 11 | **JDK 17** | `jakarta.servlet` | 3.4+ |

> 【强制】**版本必须匹配**：
> - Spring Boot 2.x → Tomcat 9.x → `javax.servlet.*` → JDK 8+
> - Spring Boot 3.x → Tomcat 10.1.x → `jakarta.servlet.*` → **JDK 17+**
>
> **混用的典型报错**：
> ```
> java.lang.NoClassDefFoundError: javax/servlet/Filter
> （Spring Boot 3 项目中引入了 javax.servlet 的旧依赖，如老版本的 druid、pagehelper、shiro）
> 
> Caused by: java.lang.ClassNotFoundException: jakarta.servlet.http.HttpServletRequest
> （Spring Boot 2 项目中引入了 jakarta.servlet 的新依赖）
> ```
> **解决**：升级/降级第三方依赖到匹配的版本（Druid 1.2.20+、PageHelper 5.3.2+、Shiro 1.11+ 都已适配 jakarta）。

## 2. Tomcat 目录结构

```
apache-tomcat-10.1.16/
├── bin/                        # ★ 启动/管理脚本
│   ├── startup.sh / shutdown.sh    # 启停（Linux/macOS）
│   ├── startup.bat / shutdown.bat  # 启停（Windows）
│   ├── catalina.sh / catalina.bat  # ★ 核心启动脚本（startup 内部调它）
│   ├── setenv.sh                    # ★ 自定义 JVM 参数（推荐，不改 catalina.sh）
│   ├── tomcat-juli.jar             # 日志实现
│   ├── bootstrap.jar                # ★ 启动入口（Main-Class: org.apache.catalina.startup.Bootstrap）
│   ├── tool-wrapper.sh             # 工具类启动器
│   ├── digest.sh                    # 生成密码摘要
│   ├── configtest.sh                # ★ 检查 server.xml 语法
│   └── version.sh                   # 版本信息
├── conf/                       # ★ 配置文件
│   ├── server.xml               # ★★ 主配置（Connector、Engine、Host、Context、Realm）
│   ├── web.xml                  # ★ 全局 web.xml（所有应用共享的默认 Servlet、JSP 配置、MIME 映射、Session 超时）
│   ├── context.xml              # ★ 全局 Context 配置（所有应用共享，可配资源、Manager）
│   ├── tomcat-users.xml         # ★ 用户/角色（Manager、Admin 控制台登录）
│   ├── logging.properties       # 日志配置（java.util.logging）
│   ├── catalina.properties      # 类加载器路径、包扫描排除（性能优化）
│   ├── jaspic-providers.xml     # 认证提供者
│   └── CACHEDIR.TAG / cert/
├── lib/                        # ★ Tomcat 自身的库（所有应用共享，Servlet API 在这里）
├── logs/                       # 日志（catalina.out ★、localhost_access_log.*.txt）
├── temp/                       # 临时文件（上传文件的临时目录）
├── webapps/                    # ★★ 应用部署目录
│   ├── ROOT/                    # ★ 根应用（contextPath = ""，访问 http://host:8080/）
│   ├── docs/                    # Tomcat 文档
│   ├── examples/                # 示例（★ 生产必须删除！有安全风险）
│   ├── host-manager/            # 虚拟主机管理（★ 生产删除）
│   ├── manager/                 # ★ 应用管理控制台（生产删除或严格限制 IP）
│   └── myapp.war / myapp/       # 你的应用
└── work/                       # ★ JSP 编译后的 Servlet 源码和 class（Catalina/localhost/myapp/）
```

### 2.1 启动脚本与 JVM 参数

```bash
# ─── 推荐方式：用 setenv.sh 配置（Tomcat 会自动加载，不改官方脚本）───
# bin/setenv.sh
#!/bin/sh
export JAVA_HOME=/usr/local/jdk-17
export JAVA_OPTS="-server \
  -XX:InitialRAMPercentage=70.0 -XX:MaxRAMPercentage=70.0 \
  -XX:MaxMetaspaceSize=256m -XX:MetaspaceSize=256m \
  -XX:+UseG1GC -XX:MaxGCPauseMillis=200 \
  -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/ \
  -XX:+ExitOnOutOfMemoryError \
  -Xlog:gc*,safepoint:file=/logs/gc.log:time,uptime:filecount=5,filesize=20m \
  -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Shanghai"
export CATALINA_OPTS="-Dspring.profiles.active=prod -Dserver.port=8080"
export CATALINA_PID=/var/run/tomcat.pid      # ★ 记录 PID，让 shutdown.sh 能可靠停止
chmod +x setenv.sh

# JAVA_OPTS vs CATALINA_OPTS 的区别
# JAVA_OPTS：所有 Java 程序通用（含 shutdown 命令）
# CATALINA_OPTS：★ 只用于 Tomcat 启动（不含 shutdown）→ 应用参数放这里

# ─── 启停命令 ───
./bin/startup.sh                  # 启动（后台，实际是 catalina.sh start）
./bin/catalina.sh start           # 启动
./bin/catalina.sh run             # ★ 前台启动（容器/调试用，能看到日志）
./bin/shutdown.sh                 # ★ 优雅停止（发 SHUTDOWN 命令到 8005 端口）
./bin/shutdown.sh -force          # 强制（先 shutdown，超时后 kill）
./bin/catalina.sh stop 10 -force  # 等待 10 秒后强制 kill
./bin/configtest.sh               # 检查 server.xml 配置语法

# ─── 日志 ───
tail -f logs/catalina.out         # ★ 主日志（stdout + stderr，所有 System.out 都在这）
tail -f logs/localhost_access_log.2026-09-07.txt    # ★ 访问日志（Nginx 风格）
ls logs/
# catalina.2026-09-07.log         # Catalina 引擎日志（按天）
# localhost.2026-09-07.log        # 应用层日志（Servlet 抛的未捕获异常）
# manager.2026-09-07.log          # Manager 应用日志
# host-manager.2026-09-07.log

# ⚠️ catalina.out 不会自动切割！长期运行会撑爆磁盘
# 解决：用 cronolog 或 logrotate，或配置 logging.properties 的 ConsoleHandler
```

> 【坑】**`shutdown.sh` 经常无法真正停止 Tomcat**：如果有非守护线程未结束（线程池、自定义线程、数据库连接），JVM 不会退出。解决：
> 1. 应用实现优雅关闭（`@PreDestroy` 中关闭线程池）。
> 2. 配置 `CATALINA_PID`，让 shutdown 超时后能 kill 指定进程。
> 3. 用 `shutdown.sh -force` 或 `catalina.sh stop 30 -force`。
> 4. Tomcat 10+ 支持 `-Dorg.apache.catalina.startup.EXIT_ON_INIT_FAILURE=true`。

## 3. Tomcat 架构 ★★★★★

### 3.1 整体架构（Server → Service → Connector + Container）

```
┌──────────────────────────────────────────────────────────────────┐
│  Server（服务器）★ 整个 Tomcat 实例，最顶层                          │
│  org.apache.catalina.Server / 实现类 StandardServer                │
│  ├── 全局命名资源（GlobalNamingResources，JNDI 数据源）              │
│  ├── shutdownPort="8005" shutdown="SHUTDOWN"（★ 关闭端口）          │
│  └── Service（服务）★ 一个 Server 可有多个 Service                   │
│      org.apache.catalina.Service / StandardService                 │
│      ├── Connector（连接器）★ 可多个！负责网络通信                     │
│      │   ├── HTTP Connector（8080，NIO）                            │
│      │   ├── AJP Connector（8009，与 Apache httpd 通信）             │
│      │   └── HTTPS Connector（8443）                                │
│      └── Container（容器）★ 只有一个！负责 Servlet 执行                │
│          Engine（引擎）                                              │
│            └── Host（虚拟主机，一个域名一个 Host）                     │
│                └── Context（Web 应用，一个应用一个 Context）★          │
│                    └── Wrapper（Servlet，一个 Servlet 一个 Wrapper）  │
└──────────────────────────────────────────────────────────────────┘

请求流向：
Connector（接收 HTTP 请求，解析成 Request/Response）
    → Engine → Host → Context → Wrapper（找到 Servlet）
    → Servlet.service()
    → 响应沿原路返回，Connector 写出 HTTP 响应
```

### 3.2 四层容器详解

| 容器 | 接口 | 职责 | 对应配置 | 数量 |
| --- | --- | --- | --- | --- |
| **Engine** | `org.apache.catalina.Engine` | 顶层容器，管理多个 Host，处理所有请求的路由 | `<Engine name="Catalina" defaultHost="localhost">` | 每 Service 一个 |
| **Host** | `org.apache.catalina.Host` | **虚拟主机**，一个域名对应一个 Host，可部署多个应用 | `<Host name="localhost" appBase="webapps" autoDeploy="true">` | 每 Engine 多个 |
| **Context** | `org.apache.catalina.Context` | ★ **一个 Web 应用**（对应一个 ServletContext） | `<Context path="/myapp" docBase="myapp"/>` | 每 Host 多个 |
| **Wrapper** | `org.apache.catalina.Wrapper` | **一个 Servlet** 的封装（管理其生命周期、映射） | 由 Context 根据 web.xml/注解自动生成 | 每 Context 多个 |

```xml
<!-- server.xml 的完整层次 -->
<Server port="8005" shutdown="SHUTDOWN">

  <Listener className="org.apache.catalina.startup.VersionLoggerListener"/>
  <Listener className="org.apache.catalina.core.AprLifecycleListener" SSLEngine="on"/>
  <Listener className="org.apache.catalina.core.JreMemoryLeakPreventionListener"/>  <!-- ★ 防内存泄漏 -->
  <Listener className="org.apache.catalina.mbeans.GlobalResourcesLifecycleListener"/>
  <Listener className="org.apache.catalina.core.ThreadLocalLeakPreventionListener"/> <!-- ★ 防 ThreadLocal 泄漏 -->

  <GlobalNamingResources>
    <Resource name="UserDatabase" auth="Container" type="org.apache.catalina.UserDatabase"
              pathname="conf/tomcat-users.xml"/>
  </GlobalNamingResources>

  <Service name="Catalina">

    <!-- ★ Connector：HTTP/1.1 NIO -->
    <Connector port="8080" protocol="HTTP/1.1"
               connectionTimeout="20000"
               redirectPort="8443"
               maxThreads="200" minSpareThreads="10"
               acceptCount="100" maxConnections="8192"
               URIEncoding="UTF-8"
               compression="on" compressionMinSize="2048"
               compressibleMimeType="text/html,text/xml,text/plain,text/css,application/json,application/javascript"
               enableLookups="false"
               disableUploadTimeout="false" connectionUploadTimeout="60000"
               maxPostSize="2097152"
               server="MyServer"/>                    <!-- ★ 隐藏 Tomcat 版本号（安全） -->

    <!-- AJP Connector（默认注释，不用就别开，有安全漏洞历史） -->
    <!-- <Connector protocol="AJP/1.3" address="::1" port="8009" redirectPort="8443" secretRequired="true" secret="xxx"/> -->

    <!-- HTTPS Connector -->
    <Connector port="8443" protocol="org.apache.coyote.http11.Http11Nio2Protocol"
               SSLEnabled="true" scheme="https" secure="true">
      <SSLHostConfig protocols="TLSv1.2+TLSv1.3" honorCipherOrder="false">
        <Certificate certificateKeystoreFile="conf/localhost-rsa.jks" type="RSA"/>
      </SSLHostConfig>
    </Connector>

    <Engine name="Catalina" defaultHost="localhost">

      <Realm className="org.apache.catalina.realm.LockOutRealm">
        <Realm className="org.apache.catalina.realm.UserDatabaseRealm" resourceName="UserDatabase"/>
      </Realm>

      <Host name="localhost" appBase="webapps"
            unpackWARs="true" autoDeploy="true"
            deployOnStartup="true" xmlValidation="false" xmlNamespaceAware="false">

        <!-- ★ 显式配置 Context（也可自动部署：webapps/myapp.war → /myapp） -->
        <Context path="/api" docBase="/data/apps/api-app" reloadable="false">
          <Resources cachingAllowed="true" cacheMaxSize="102400"/>
        </Context>

        <!-- 访问日志（★ 生产必开） -->
        <Valve className="org.apache.catalina.valves.AccessLogValve" directory="logs"
               prefix="localhost_access_log" suffix=".txt"
               pattern="%h %l %u %t &quot;%r&quot; %s %b %D"
               rotatable="true" maxDays="30" renameOnRotate="true"/>
        <!-- pattern 说明：%h 客户端IP %l - %u 用户 %t 时间 "%r" 请求行 %s 状态码 %b 响应字节 %D ★处理耗时(毫秒) -->
      </Host>

      <!-- ★ 第二个虚拟主机（多域名部署） -->
      <Host name="www.example.com" appBase="/data/www-example" autoDeploy="true">
        <Alias>example.com</Alias>
      </Host>

    </Engine>
  </Service>
</Server>
```

### 3.3 Connector 的三大组件

```
Connector
├── ProtocolHandler（协议处理器）★ 核心
│   ├── Http11NioProtocol      ← 默认（Java NIO，非阻塞 IO + 线程池）
│   ├── Http11Nio2Protocol     ← NIO.2（AIO，异步非阻塞）
│   ├── Http11AprProtocol      ← APR（Apache Portable Runtime，本地库，性能最高但需装 native）
│   └── AjpNioProtocol / AjpAprProtocol   ← AJP 协议
│
│   ProtocolHandler 内部又分两部分：
│   ├── Endpoint（端点）★ 处理底层 Socket 连接
│   │   ├── Acceptor（1 个）      ← 接受新连接（accept）
│   │   ├── Poller（1~2 个）      ← ★ Selector 轮询，监听已连接 Socket 的读写事件
│   │   └── SocketProcessor       ← 提交到线程池执行的任务
│   └── Http11Processor           ← 解析 HTTP 报文（请求行、头、体），生成 Request/Response
│
├── Adapter（适配器）★ CoyoteAdapter
│   把 Coyote 的 Request/Response 转换为 Catalina 的（Servlet 规范的）
│   并调用 Container（Engine）的 pipeline 处理
│
└── Mapper / MapperListener      ← URL 到 Host/Context/Wrapper 的映射
```

**Tomcat 的线程模型（★ NIO 的核心）：**

```
① Acceptor 线程（1 个，阻塞 accept）
   └── 接受新连接 → 注册到 Poller

② Poller 线程（1~2 个，非阻塞 Selector）
   └── 监听所有连接的读写就绪事件
       ├── 数据到达 → 封装为 SocketProcessor 任务，提交到【工作线程池】
       └── 无事件 → 继续 select（★ 这就是 NIO 的优势：一个线程管理成千上万连接）

③ 工作线程池（maxThreads，默认 200）
   └── 执行 SocketProcessor → Http11Processor 解析 HTTP → CoyoteAdapter → Container
       → Servlet.service() → 业务代码
       → 响应写回

④ 异步模式（AsyncContext）
   └── 业务线程可以先返回，线程归还池中，另一个线程完成后写响应
```

```
连接数 vs 线程数的关系（★ 关键理解）
maxConnections = 8192      ← Tomcat 能【同时保持】的 TCP 连接数
maxThreads = 200           ← 同时【处理请求】的线程数
acceptCount = 100          ← 连接满后的【OS 级等待队列】长度（backlog）

因为 NIO：8192 个连接只需 200 个线程处理（大部分连接是 idle 的长连接，不占线程）
→ 这就是 NIO 相比 BIO（一连接一线程）的核心优势

请求排队的三层：
  ① 连接层：超过 maxConnections → 进入 acceptCount 的 OS 队列
  ② OS 队列满 → 客户端连接超时/被拒绝
  ③ 线程层：连接建立但没有空闲线程 → 请求在 Tomcat 内部等待（表现为响应慢）
```

## 4. 核心配置调优 ★★★★★

### 4.1 Connector 参数（性能关键）

| 参数 | 默认值 | 说明 | 推荐值 |
| --- | --- | --- | --- |
| `port` | 8080 | 监听端口 | — |
| `protocol` | `HTTP/1.1`（= Http11NioProtocol） | 协议处理器 | 保持默认（NIO） |
| **`maxThreads`** | **200** | ★ **最大工作线程数**（并发处理能力上限） | **200~800**（按业务和 CPU 核数） |
| `minSpareThreads` | 10 | 最小空闲线程（常驻） | 25~50 |
| **`acceptCount`** | **100** | ★ **等待队列长度**（backlog） | **500~1000** |
| **`maxConnections`** | **8192**（NIO） | ★ **最大连接数** | 10000~20000 |
| `connectionTimeout` | 20000ms | ★ 连接建立后等待请求数据的超时 | 20000（**不要设 -1，会导致连接泄漏**） |
| `keepAliveTimeout` | 同 connectionTimeout | Keep-Alive 连接的保活超时 | 15000~60000 |
| `maxKeepAliveRequests` | 100 | 单个连接最多处理多少请求（-1 无限制） | 100~1000 |
| `URIEncoding` | **UTF-8**（Tomcat 8+） | URL 编码 | UTF-8 |
| `compression` | off | ★ **gzip 压缩** | `on` |
| `compressionMinSize` | 2048 | 超过此大小才压缩 | 2048 |
| `compressibleMimeType` | text/html,text/xml,text/plain | 可压缩的类型 | 加上 `application/json,application/javascript,text/css` |
| `maxPostSize` | 2MB | POST 表单最大字节（-1 无限制） | 按业务（文件上传走 multipart，不受此限） |
| `maxSwallowSize` | 2MB | 中止上传时最多吞掉多少字节 | 2MB |
| `enableLookups` | false | ★ 是否 DNS 反查（`getRemoteHost`） | **必须 false**（开了会严重拖慢性能） |
| `disableUploadTimeout` | true | 是否禁用上传超时 | **false**（启用超时，防慢速攻击） |
| `connectionUploadTimeout` | 60000 | 上传超时 | 60000 |
| `server` | — | ★ 响应头的 Server 值 | 自定义（隐藏版本，防攻击） |
| `redirectPort` | 8443 | 需要 SSL 时重定向的端口 | 443 或 8443 |
| `relaxedQueryChars` | — | 允许的额外查询字符 | 有特殊字符需求时配 |
| `socket.bufferPool` | 500 | NIO 的 ByteBuffer 池大小 | 500~1000 |
| `socket.appReadBufSize` | 8192 | 读缓冲区 | 8192~65536 |
| `socket.directBuffer` | false | 是否用直接内存 | 大文件传输可 true |
| `threads.maxIdleTime` | 60000 | 线程空闲回收时间 | 60000 |

**高并发场景的推荐配置：**

```xml
<Connector port="8080" protocol="org.apache.coyote.http11.Http11NioProtocol"
           connectionTimeout="20000"
           URIEncoding="UTF-8"
           disableUploadTimeout="false"
           connectionUploadTimeout="60000"
           enableLookups="false"
           maxThreads="500"
           minSpareThreads="50"
           maxConnections="20000"
           acceptCount="1000"
           maxKeepAliveRequests="500"
           keepAliveTimeout="30000"
           compression="on"
           compressionMinSize="2048"
           compressibleMimeType="text/html,text/xml,text/plain,text/css,text/javascript,application/json,application/javascript,application/xml"
           server="WebServer"
           maxPostSize="10485760"
           socket.bufferPool="1000"
           socket.appReadBufSize="16384"
           socket.appWriteBufSize="16384"/>
```

```yaml
# ★ Spring Boot（嵌入式 Tomcat）的等价配置
server:
  port: 8080
  tomcat:
    threads:
      max: 500                    # ★ maxThreads
      min-spare: 50                # minSpareThreads
    max-connections: 20000         # ★ maxConnections
    accept-count: 1000             # ★ acceptCount（等待队列）
    connection-timeout: 20000
    keep-alive-timeout: 30000
    max-keep-alive-requests: 500
    uri-encoding: UTF-8
    remoteip:                       # ★ 反向代理后获取真实 IP
      remote-ip-header: X-Forwarded-For
      protocol-header: X-Forwarded-Proto
      internal-proxies: "10\\.\\d+\\.\\d+\\.\\d+|192\\.168\\.\\d+\\.\\d+"
    basedir: /tmp/tomcat            # 临时目录
    accesslog:                      # ★ 访问日志
      enabled: true
      directory: /logs
      prefix: access_log
      suffix: .log
      pattern: "%h %l %u %t &quot;%r&quot; %s %b %D"
      rotate: true
      max-days: 30
      rename-on-rotate: true
      request-attributes-enabled: true
    relaxed-query-chars: "[,],{,},|,\,^"
  compression:                      # ★ gzip
    enabled: true
    min-response-size: 2048
    mime-types: application/json,application/javascript,text/css,text/html,text/plain
  max-http-form-post-size: 10MB
  servlet:
    session:
      timeout: 30m
      cookie:
        http-only: true
        secure: true
        same-site: lax
    encoding:
      charset: UTF-8
      force: true                   # ★ 强制请求和响应都用 UTF-8
  shutdown: graceful                # ★ Spring Boot 2.3+ 优雅停机
```

> 【调优原则】**`maxThreads` 不是越大越好**：
> - 线程数超过 CPU 能并行处理的数量后，增加的只是上下文切换开销。
> - **CPU 密集型**：`maxThreads` ≈ CPU 核数 × 2。
> - **IO 密集型**（大部分 Web 应用）：`maxThreads` = 200~500（线程大部分时间在等 IO，可以多开）。
> - **判断依据**：压测时观察 CPU 使用率。CPU < 70% 且响应慢 → 加线程；CPU > 90% → 优化代码或加机器。
> - 每个线程约 1MB 栈内存，500 线程 ≈ 500MB 额外内存（不算在堆里！）。

### 4.2 Host 与 Context 配置

```xml
<Host name="localhost" appBase="webapps"
      unpackWARs="true"          <!-- ★ 自动解压 war（true 性能更好，false 省磁盘） -->
      autoDeploy="true"          <!-- ★ 自动部署（监听 webapps 变化，生产建议 false） -->
      deployOnStartup="true"     <!-- 启动时部署 -->
      createDirs="true">

  <!-- ★ 部署应用的三种方式见下文 -->

  <!-- 禁止目录列表（安全） -->
  <Context path="" docBase="ROOT">
    <Resources allowLinking="false"/>
  </Context>
</Host>
```

**Context 的配置位置（优先级从高到低）：**

| 位置 | 说明 | 推荐度 |
| --- | --- | --- |
| `$CATALINA_BASE/conf/[EngineName]/[HostName]/[appName].xml` | ★ **推荐**（独立文件，改动不影响 server.xml） | ⭐⭐⭐⭐⭐ |
| `server.xml` 中的 `<Context>` | 改动需重启，且 server.xml 不支持热加载 | ⭐⭐ |
| 应用内 `META-INF/context.xml` | 随应用打包，多环境不便 | ⭐⭐⭐ |

```xml
<!-- conf/Catalina/localhost/api.xml → 部署为 http://host:8080/api -->
<Context docBase="/data/apps/api.war"
         reloadable="false"              <!-- ★ 生产必须 false！true 会监听 class 变化并重启应用，性能极差 -->
         crossContext="false"            <!-- 是否允许跨应用访问（安全考虑设 false） -->
         swallowOutput="false"           <!-- 是否把 System.out 重定向到日志 -->
         sessionCookiePath="/"
         sessionCookieName="APISESSIONID"  <!-- ★ 多应用同域时区分 Session Cookie -->
         useHttpOnly="true">

  <!-- ★ JNDI 数据源 -->
  <Resource name="jdbc/mydb" auth="Container" type="javax.sql.DataSource"
            factory="org.apache.tomcat.jdbc.pool.DataSourceFactory"
            driverClassName="com.mysql.cj.jdbc.Driver"
            url="jdbc:mysql://localhost:3306/mydb?useSSL=false&amp;characterEncoding=utf8&amp;serverTimezone=Asia/Shanghai"
            username="app" password="xxx"
            maxTotal="100" maxIdle="20" minIdle="5" maxWaitMillis="10000"
            testOnBorrow="true" validationQuery="SELECT 1"
            removeAbandonedOnBorrow="true" removeAbandonedTimeout="60"/>

  <!-- 禁止访问某些路径 -->
  <Resources>
    <PreResources className="org.apache.catalina.webresources.DirResourceSet"
                  base="/data/shared" webAppMount="/shared"/>
  </Resources>

  <!-- 环境注入（应用可通过 JNDI 读取） -->
  <Environment name="appEnv" value="prod" type="java.lang.String" override="false"/>

  <!-- 参数（Servlet 通过 ServletContext.getInitParameter 读取） -->
  <Parameter name="configServer" value="nacos.internal:8848" override="false"/>

  <!-- Valve（阀门，AOP 式的请求处理） -->
  <Valve className="org.apache.catalina.valves.RemoteAddrValve"
         allow="127\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+"/>   <!-- ★ IP 白名单 -->
</Context>
```

### 4.3 部署方式 ★★★★

| 方式 | 操作 | contextPath | 优缺点 |
| --- | --- | --- | --- |
| **① 放入 webapps** | 把 war/目录拷到 `webapps/` | war 文件名（`myapp.war` → `/myapp`） | ★ 最简单；自动解压、自动部署 |
| **② ROOT 目录** | 应用放在 `webapps/ROOT/` | **`/`（空）** | ★ 想去掉 URL 中的应用名就用它 |
| **③ server.xml 的 Context** | `<Context path="/api" docBase="/data/app"/>` | 自定义 | 改动需重启；docBase 可在任意路径 |
| **④ conf/Catalina/localhost/*.xml** ★ | 创建 `api.xml`，内容 `<Context docBase="..."/>` | **文件名**（api.xml → `/api`） | ★ **推荐**：热部署、隔离配置、不改 server.xml |
| **⑤ Manager 控制台** | 上传 war 到 `/manager/html` | 上传时指定 | 方便但**有安全风险**（生产禁用或严格限制） |

```bash
# 方式 1：直接放 war（自动解压和部署）
cp myapp.war $CATALINA_HOME/webapps/
# 访问：http://localhost:8080/myapp/

# 方式 2：部署为根应用
rm -rf $CATALINA_HOME/webapps/ROOT
cp myapp.war $CATALINA_HOME/webapps/ROOT.war       # ★ 改名为 ROOT.war
# 访问：http://localhost:8080/

# 方式 4：★ 推荐（不改 server.xml，支持热部署）
cat > $CATALINA_HOME/conf/Catalina/localhost/api.xml <<'EOF'
<Context docBase="/data/apps/api-1.0.0.war" reloadable="false"/>
EOF
# 访问：http://localhost:8080/api/
# ★ 修改 api.xml 或删除它都会触发应用的卸载/重新部署（无需重启 Tomcat）

# 卸载应用
rm $CATALINA_HOME/conf/Catalina/localhost/api.xml   # 或删 webapps 下的目录

# 多应用共存（虚拟主机 + 多 Context）
# www.example.com/api    → conf/Catalina/www.example.com/api.xml
# www.example.com/admin  → conf/Catalina/www.example.com/admin.xml
# admin.example.com      → <Host name="admin.example.com" appBase="/data/admin-apps">
```

**Spring Boot 打包成 war 部署到外部 Tomcat：**

```xml
<!-- ① pom.xml：打包方式改为 war，排除内嵌 Tomcat -->
<packaging>war</packaging>
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
        <exclusions>
            <exclusion>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-starter-tomcat</artifactId>
            </exclusion>
        </exclusions>
    </dependency>
    <!-- ★ 编译期提供 Servlet API（provided，不打进 war） -->
    <dependency>
        <groupId>jakarta.servlet</groupId>
        <artifactId>jakarta.servlet-api</artifactId>
        <scope>provided</scope>
    </dependency>
</dependencies>
```

```java
// ② 启动类继承 SpringBootServletInitializer
@SpringBootApplication
public class MyApplication extends SpringBootServletInitializer {

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) {
        return builder.sources(MyApplication.class);      // ★ 指定配置源
    }

    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);  // ★ 保留 main，支持 java -jar 直接运行
    }
}
```

```bash
# ③ 打包并部署
mvn clean package -P war
cp target/myapp-1.0.0.war $CATALINA_HOME/webapps/
# ★ 注意：war 部署时 contextPath 由文件名决定（myapp-1.0.0），
#   而 server.servlet.context-path 配置【失效】！
#   要么改 war 名为想要的 contextPath，要么部署为 ROOT.war
```

> 【实践】**Spring Boot 时代主流是「内嵌 Tomcat + 可执行 jar」**，外部 Tomcat 部署 war 只在以下场景需要：
> 1. 公司统一的 Tomcat 运维体系（多个应用共享一个 Tomcat）。
> 2. 需要 Tomcat 的 JNDI 数据源、Realm 认证等企业特性。
> 3. 老项目迁移过渡期。
>
> **war 部署的坑**：`server.port`、`server.servlet.context-path` 等配置**失效**（由 Tomcat 决定）；日志配置要注意与 Tomcat 的 juli 冲突；`@PreDestroy` 的优雅停机依赖 Tomcat 的关闭流程。

## 5. Tomcat 的类加载器 ★★★★★

**Tomcat 的类加载器架构是「打破双亲委派」的经典案例**（详见 [[后端/JVM/类加载机制与字节码]] 2.4 节）。

```
        Bootstrap ClassLoader（JDK 核心类）
                 ↑ parent
        System(Ext/Platform) ClassLoader
                 ↑ parent
        Common ClassLoader（$CATALINA_HOME/lib）★ Tomcat 自身 + 所有应用共享
             ↗              ↖
Catalina ClassLoader    Shared ClassLoader（默认与 Common 相同）
（$CATALINA_HOME/server，            ↓
 Tomcat 自身专用，默认不用）    ┌──────┴───────┬───────────────┐
                        WebApp1 ClassLoader  WebApp2 ClassLoader   ← ★ 每个应用独立
                        (WEB-INF/classes,     (互相隔离)
                         WEB-INF/lib)
                              ↓
                        Jsp1/Jsp2 ClassLoader ← ★ 每个 JSP 一个（支持热更新）
```

**WebappClassLoader 的查找顺序（★ 与标准双亲委派不同）：**

```
① 检查本地缓存（已加载过的类）
② ★ 委派给 Bootstrap（防止用户代码覆盖 JDK 核心类）
③ ★★ 在自己的 WEB-INF/classes 和 WEB-INF/lib 中查找（优先于父加载器！）
④ 委派给 Common/Shared ClassLoader（父加载器）
⑤ 都找不到 → ClassNotFoundException
```

**为什么要「先自己后父亲」（打破双亲委派）？**

| 目的 | 说明 |
| --- | --- |
| **隔离** | App1 用 Spring 4，App2 用 Spring 5，各自加载自己的版本，互不干扰 |
| **优先级** | 应用可以用自己的版本覆盖 Tomcat 共享库的版本（灵活性） |
| **保留安全性** | 第 ② 步仍委派给 Bootstrap，`java.lang.String` 等核心类不可能被覆盖 |

> Tomcat 的 WebappClassLoader 支持通过 `delegate="true"` 属性切回标准双亲委派模式（`<Loader delegate="true"/>`），某些框架（依赖类加载顺序）需要这样配。

**类加载相关的常见异常：**

```
① ClassNotFoundException / NoClassDefFoundError
   原因：jar 放错位置（WEB-INF/lib vs $CATALINA_HOME/lib）；依赖冲突；war 未正确解压
   排查：
     - 检查 WEB-INF/lib 中是否有该 jar
     - Arthas: sc -d com.example.X  （看类由哪个 ClassLoader 加载、从哪个 jar 来）
     - Tomcat 日志的 WebappClassLoader 详细信息

② ClassCastException: com.example.User cannot be cast to com.example.User  ★ 诡异！
   原因：同一个类被【两个不同的 ClassLoader】加载（如 WEB-INF/lib 和 $CATALINA_HOME/lib 各有一份）
        → JVM 认为是两个不同的类
   排查：Arthas 的 sc -d 看 ClassLoader hash 和 code source
   解决：只在一处放置 jar（应用私有的放 WEB-INF/lib，共享的放 $CATALINA_HOME/lib）

③ java.lang.LinkageError: loader constraint violation
   原因：两个 ClassLoader 加载的同名类在方法签名中交互
   常见于：Servlet API 同时存在于 WEB-INF/lib 和 Tomcat lib
   解决：servlet-api.jar 的 scope 必须是 provided（★ 绝对不能打进 war！）

④ Memory leak / Metaspace OOM（热部署后）
   原因：WebappClassLoader 无法被回收（有引用残留）
   Tomcat 的防护：<Listener className="...JreMemoryLeakPreventionListener"/>
                  <Listener className="...ThreadLocalLeakPreventionListener"/>
   日志中会有：The web application [myapp] appears to have started a thread named [xxx]
              but has failed to stop it. This is very likely to create a memory leak.
   常见泄漏源：ThreadLocal、JDBC Driver 未反注册、shutdown hook、Timer 线程、日志框架
```

```xml
<!-- pom.xml 中 Servlet API 必须是 provided（★ 最常见的错误之一） -->
<dependency>
    <groupId>jakarta.servlet</groupId>
    <artifactId>jakarta.servlet-api</artifactId>
    <version>6.0.0</version>
    <scope>provided</scope>          <!-- ★ 编译需要，运行时由 Tomcat 提供，不打进 war -->
</dependency>
<!-- 若用 compile scope → war 的 WEB-INF/lib 中会有 servlet-api.jar
     → 与 Tomcat lib 中的冲突 → LinkageError 或 ClassCastException -->
```

## 6. Tomcat 的安全加固 ★★★★★

```bash
# ─── 1. 删除不必要的应用（★ 必做）───
cd $CATALINA_HOME/webapps
rm -rf docs examples host-manager manager      # ★ 全部删除！
# examples 有大量可被利用的示例（如 Session Manipulation、SSRF）
# manager/host-manager 若被爆破，攻击者可上传恶意 war → 直接 getshell

# 如果必须保留 manager，严格限制访问 IP
# conf/Catalina/localhost/manager.xml
<Context antiResourceLocking="false" privileged="true">
  <Valve className="org.apache.catalina.valves.RemoteAddrValve" allow="127\.\d+\.\d+\.\d+"/>
</Context>

# ─── 2. 修改/禁用 shutdown 端口（★ 高危）───
# 默认：port="8005" shutdown="SHUTDOWN"
# 风险：任何能访问 8005 端口的人，执行 telnet host 8005 然后输入 SHUTDOWN 就能关闭 Tomcat！
<Server port="-1" shutdown="SHUTDOWN">        <!-- ★ port=-1 禁用该端口（推荐） -->
# 或用随机强口令（但仍监听端口，不如禁用）
<Server port="8005" shutdown="Xk9$mP2$vL7qR4">

# ─── 3. 隐藏版本信息（防信息泄漏）───
<Connector port="8080" server="WebServer" .../>     <!-- ★ 自定义 Server 头 -->
# 更彻底：修改 $CATALINA_HOME/lib/catalina.jar 中的 org/apache/catalina/util/ServerInfo.properties
#   server.info=WebServer
#   server.number=1.0.0.0
# 错误页的版本信息：conf/web.xml 中配置自定义 <error-page>

# ─── 4. 以非 root 用户运行（★ 必做）───
useradd -r -s /sbin/nologin tomcat
chown -R tomcat:tomcat /opt/tomcat
# systemd 中 User=tomcat
# root 运行 + 被 getshell = 整台服务器沦陷

# ─── 5. 目录权限最小化 ──
chmod 750 $CATALINA_HOME
chmod 640 $CATALINA_HOME/conf/*.xml
chmod -R 750 $CATALINA_HOME/logs
# webapps 目录禁止应用写入（除非确实需要上传）

# ─── 6. 禁用不必要的方法和特性 ──
# conf/web.xml 中禁用目录列表（DefaultServlet 的 listings 参数）
<servlet>
    <servlet-name>default</servlet-name>
    <init-param><param-name>listings</param-name><param-value>false</param-value></init-param>  <!-- ★ 默认已是 false -->
    <init-param><param-name>readonly</param-name><param-value>true</param-value></init-param>   <!-- ★ 禁止 PUT/DELETE 写文件 -->
</servlet>

# 禁用 TRACE 方法（防 XST）：在 web.xml 或用 SecurityConstraint
<security-constraint>
    <web-resource-collection>
        <web-resource-name>restricted</web-resource-name>
        <url-pattern>/*</url-pattern>
        <http-method>TRACE</http-method>
        <http-method>PUT</http-method>
        <http-method>DELETE</http-method>
    </web-resource-collection>
    <auth-constraint/>     <!-- ★ 空的 auth-constraint = 拒绝所有 -->
</security-constraint>

# ─── 7. 关闭 AJP Connector（★ 除非确实需要）───
# AJP 有著名漏洞：CVE-2020-1938（Ghostcat，可读取任意文件/RCE）
# server.xml 中 AJP Connector 默认已注释，★ 不要开启
# 若必须开启：secretRequired="true" secret="强口令" allowedRequestAttributesPattern=".*"

# ─── 8. 用 Nginx 做前置（★ 标准架构）───
# Nginx 处理：HTTPS 终止、静态资源、限流、IP 黑白名单、隐藏后端
# Tomcat 只监听内网 IP（address="127.0.0.1" 或内网网卡）
<Connector port="8080" address="127.0.0.1" .../>     <!-- ★ 只监听本地，外部无法直连 -->

# ─── 9. Session 安全 ──
<Context sessionCookieName="JSESSIONID" useHttpOnly="true">
    <Manager className="org.apache.catalina.session.StandardManager"
             maxInactiveInterval="1800"
             sessionAttributeNameFilter=".*"          <!-- 允许序列化的属性 -->
             maxActiveSessions="10000"/>               <!-- ★ 限制 Session 数量，防 Session 攻击 -->
</Context>

# ─── 10. 及时升级 ──
# 关注 CVE：CVE-2017-12615（PUT 上传 JSP getshell）、CVE-2020-1938（Ghostcat）、
#          CVE-2025-24813（PUT + session 反序列化 RCE）
# 订阅 Tomcat 安全公告，定期升级小版本
```

## 7. Spring Boot 的嵌入式 Tomcat ★★★★★

### 7.1 启动流程

```java
// SpringApplication.run() 的核心流程
@SpringBootApplication
public class App {
    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
    }
}

// 内部：
// ① 判断应用类型：SERVLET（Web）/ REACTIVE（WebFlux）/ NONE
//    → 依据：classpath 中有 spring-webmvc + Servlet + ConfigurableWebApplicationContext
// ② 创建 ApplicationContext：AnnotationConfigServletWebServerApplicationContext
// ③ 刷新容器（refresh）
//    → onRefresh() 中调用 createWebServer()
//       → ServletWebServerFactory（TomcatServletWebServerFactory）.getWebServer()
//          ★ 创建 Tomcat 实例、Connector、Context，但不启动
//    → finishRefresh() 中调用 WebServerStartStopLifecycle.start()
//       ★ tomcat.start()，绑定端口，开始接收请求
// ④ 发布 ServletWebServerInitializedEvent
```

```java
// TomcatServletWebServerFactory 的核心代码（简化）
@Override
public WebServer getWebServer(ServletContextInitializer... initializers) {
    Tomcat tomcat = new Tomcat();
    File baseDir = (this.baseDirectory != null) ? this.baseDirectory : createTempDir("tomcat");
    tomcat.setBaseDir(baseDir.getAbsolutePath());

    Connector connector = new Connector(this.protocol);         // ★ 创建 Connector
    connector.setThrowOnFailure(true);
    tomcat.getService().addConnector(connector);
    customizeConnector(connector);                              // ★ 应用 server.tomcat.* 配置
    tomcat.setConnector(connector);

    tomcat.getHost().setAutoDeploy(false);                       // ★ 关闭自动部署（不需要）
    configureEngine(tomcat.getEngine());

    prepareContext(tomcat.getHost(), initializers);              // ★ 创建 Context，注册 DispatcherServlet
    return getTomcatWebServer(tomcat);                           // 返回 TomcatWebServer（此时才 start）
}
```

**嵌入式 vs 外部 Tomcat：**

| 对比 | 嵌入式（jar） | 外部（war） |
| --- | --- | --- |
| 打包 | `java -jar app.jar`（Tomcat 在 jar 内） | 部署 war 到 Tomcat |
| 启动 | **应用启动 Tomcat** | Tomcat 启动应用 |
| 配置 | `application.yml`（`server.*`） | `server.xml` + `web.xml` |
| 端口 | 应用控制 | Tomcat 控制 |
| 部署 | ★ **简单**（一个 jar 走天下，容器友好） | 需要运维 Tomcat |
| 多应用共享 | ❌ 一个进程一个应用 | ✅ 一个 Tomcat 多个应用 |
| 隔离性 | **进程级隔离**（一个挂了不影响其他） | 应用级（一个 OOM 可能拖垮整个 Tomcat） |
| 升级 Tomcat | 改 Maven 依赖版本 | 替换 Tomcat 安装包 |
| 运维复杂度 | **低** | 高 |
| 现状 | ★ **主流**（云原生、微服务） | 传统企业、存量系统 |

### 7.2 自定义嵌入式 Tomcat

```java
// ─── 方式 1：WebServerFactoryCustomizer（★ 推荐）───
@Configuration
public class TomcatConfig {

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> tomcatCustomizer() {
        return factory -> {
            factory.setPort(8080);
            factory.setUriEncoding(StandardCharsets.UTF_8);
            factory.setContextPath("/api");
            factory.setSessionTimeout(Duration.ofMinutes(30));
            factory.addConnectorCustomizers(connector -> {
                connector.setProperty("maxThreads", "500");
                connector.setProperty("acceptCount", "1000");
                connector.setProperty("compression", "on");
                connector.setProperty("server", "WebServer");       // ★ 隐藏版本
                connector.setProperty("relaxedQueryChars", "[,],{,}");
            });
            factory.addContextCustomizers(context -> {
                context.addLifecycleListener(new Tomcat.FixContextListener());
            });
            // 错误页
            factory.addErrorPages(
                new ErrorPage(HttpStatus.NOT_FOUND, "/404.html"),
                new ErrorPage(HttpStatus.INTERNAL_SERVER_ERROR, "/500.html"),
                new ErrorPage(Throwable.class, "/error"));
        };
    }

    // ─── 方式 2：额外的 Connector（多端口监听）───
    @Bean
    public TomcatServletWebServerFactory servletContainer() {
        TomcatServletWebServerFactory factory = new TomcatServletWebServerFactory();
        factory.addAdditionalTomcatConnectors(createManagementConnector());    // ★ 管理端口
        return factory;
    }
    private Connector createManagementConnector() {
        Connector connector = new Connector("org.apache.coyote.http11.Http11NioProtocol");
        connector.setPort(9090);                    // 内部监控端口（不对外暴露）
        connector.setProperty("maxThreads", "20");
        return connector;
    }

    // ─── 方式 3：HTTPS 配置 ───
    @Bean
    public TomcatServletWebServerFactory sslFactory() {
        TomcatServletWebServerFactory factory = new TomcatServletWebServerFactory() {
            @Override
            protected void postProcessContext(Context context) {
                SecurityConstraint constraint = new SecurityConstraint();
                constraint.setUserConstraint("CONFIDENTIAL");        // ★ 强制 HTTPS
                SecurityCollection collection = new SecurityCollection();
                collection.addPattern("/*");
                constraint.addCollection(collection);
                context.addConstraint(constraint);
            }
        };
        factory.addAdditionalTomcatConnectors(httpConnector());       // HTTP → HTTPS 重定向
        return factory;
    }
    private Connector httpConnector() {
        Connector connector = new Connector("org.apache.coyote.http11.Http11NioProtocol");
        connector.setScheme("http");
        connector.setPort(8080);
        connector.setSecure(false);
        connector.setRedirectPort(8443);                // ★ 重定向到 HTTPS 端口
        return connector;
    }
}
```

```yaml
# application.yml 中配置 HTTPS
server:
  port: 8443
  ssl:
    enabled: true
    key-store: classpath:keystore.p12
    key-store-password: ${SSL_PASSWORD}
    key-store-type: PKCS12
    key-alias: tomcat
    protocol: TLS
    enabled-protocols: TLSv1.2,TLSv1.3
    ciphers: TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_AES_256_GCM_SHA384
```

### 7.3 Tomcat 线程池监控

```java
// 通过 MBean 获取 Tomcat 线程池指标（暴露给 Prometheus）
@Component
@RequiredArgsConstructor
public class TomcatMetricsExporter {

    private final MeterRegistry registry;

    @PostConstruct
    public void bindTomcatMetrics() {
        // Spring Boot Actuator 已自动暴露：
        // tomcat_threads_busy_threads      正在忙的线程
        // tomcat_threads_current_threads   当前线程数
        // tomcat_threads_config_max_threads 最大线程配置
        // tomcat_sessions_active_current_sessions
        // tomcat_global_request_seconds    请求耗时
        // tomcat_global_error_total        错误数
        // tomcat_servlet_request_seconds

        // 自定义补充
        TomcatConnectorCustomizer customizer = connector -> {
            Executor executor = connector.getProtocolHandler().getExecutor();
            if (executor instanceof org.apache.tomcat.util.threads.ThreadPoolExecutor tpe) {
                Gauge.builder("tomcat.threadpool.queue.size", tpe,
                        e -> e.getQueue().size()).register(registry);
                Gauge.builder("tomcat.threadpool.completed", tpe,
                        ThreadPoolExecutor::getCompletedTaskCount).register(registry);
                Gauge.builder("tomcat.threadpool.largest", tpe,
                        ThreadPoolExecutor::getLargestPoolSize).register(registry);
            }
        };
    }
}
```

**★ Tomcat 线程池打满的排查（生产高频故障）：**

```bash
# 现象：接口大量超时/拒绝，但 CPU 不高
# 判断：tomcat_threads_busy_threads ≈ tomcat_threads_config_max_threads

# 排查步骤
# ① 看线程栈，找出线程都卡在哪
jstack <pid> | grep -A 20 'http-nio-8080-exec' | grep 'at com.example' | sort | uniq -c | sort -rn | head
# 或 Arthas
thread --state WAITING | head -50
thread -n 10

# ② 常见原因
```

| 原因 | 特征 | 解决 |
| --- | --- | --- |
| **慢 SQL** | 大量线程卡在 JDBC `socketRead` | 加索引、优化 SQL、设 `queryTimeout` |
| **下游 RPC/HTTP 无超时** | 线程卡在 `HttpClient`、Feign | ★ **必须设连接/读超时**（默认可能是无限！） |
| **锁竞争** | 大量线程 BLOCKED | jstack 找锁持有者，缩小临界区 |
| **线程池嵌套等待** | 业务线程等待子任务，子任务在同一池 | 拆分线程池 |
| **同步日志写盘慢** | 线程卡在 logback 的 appender | 改异步日志 |
| **maxThreads 设置过小** | 流量增长后打满 | 调大 + 加机器 |
| **连接泄漏**（数据库/HTTP） | 等待获取连接超时 | 连接池 `maxWait` + 泄漏检测 |

```java
// ★ 最重要的防护：所有外部调用必须设超时
// Feign
feign:
  client:
    config:
      default:
        connectTimeout: 2000        # 2 秒
        readTimeout: 5000           # 5 秒
// RestTemplate
@Bean
public RestTemplate restTemplate() {
    var factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(2000);
    factory.setReadTimeout(5000);
    return new RestTemplate(factory);
}
// JDBC（MyBatis）
mybatis:
  configuration:
    default-statement-timeout: 10     # ★ SQL 超时 10 秒
// HikariCP
spring.datasource.hikari.connection-timeout: 3000    # 获取连接超时 3 秒
spring.datasource.hikari.max-lifetime: 1800000
// Redis
spring.data.redis.timeout: 2000
spring.data.redis.lettuce.pool.max-wait: 2000
```

> 【核心教训】**Tomcat 线程池打满，99% 是因为「某个下游依赖没有超时设置」**。一个没有超时的 HTTP 调用可以让 200 个线程全部永久阻塞，整个应用假死。**所有外部调用（DB、Redis、HTTP、RPC）必须显式设置超时**，这是生产环境的第一铁律。

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | Servlet/Tomcat/JDK 版本不匹配 | `NoClassDefFoundError: javax/jakarta.servlet.Filter` | 严格对应（Boot 2→Tomcat 9→javax；Boot 3→Tomcat 10.1→jakarta） |
| 2 | servlet-api 打进 war（scope=compile） | `LinkageError` / `ClassCastException` | **scope 必须 provided** |
| 3 | 未删除 `examples`/`manager` | 安全漏洞（getshell） | 生产删除，或限制 IP |
| 4 | shutdown 端口 8005 暴露 | 任何人可关闭 Tomcat | `port="-1"` 禁用 |
| 5 | 以 root 运行 | 被攻破后服务器沦陷 | 专用低权限用户 |
| 6 | `enableLookups=true` | 性能骤降（每次请求做 DNS 反查） | 设 false |
| 7 | `connectionTimeout=-1` | 慢速连接攻击耗尽线程 | 设 20000 |
| 8 | `reloadable=true` 上生产 | CPU 高、频繁重启应用 | 生产设 false |
| 9 | `autoDeploy=true` 上生产 | 误传文件导致意外部署 | 生产设 false（用发布流程） |
| 10 | catalina.out 无限增长 | 磁盘写满 | logrotate / cronolog / 用 logback 接管 |
| 11 | maxThreads 设得过大 | 上下文切换开销、内存不足 | 200~500，压测确定 |
| 12 | acceptCount 太小 | 高峰期连接被拒 | 500~1000 |
| 13 | 未开 compression | 带宽浪费、页面慢 | `compression="on"` |
| 14 | Session Cookie 未设 HttpOnly/Secure | XSS 窃取、明文传输 | `useHttpOnly=true` + Secure |
| 15 | 同域多应用 Session 冲突 | 登录状态互相覆盖 | 各应用设不同 `sessionCookieName` |
| 16 | 反向代理后拿到的是代理 IP | 日志/限流基于错误 IP | `RemoteIpValve` + `X-Forwarded-For` |
| 17 | war 部署时 context-path 配置失效 | URL 前缀不符预期 | contextPath 由 war 文件名决定，或部署为 ROOT.war |
| 18 | 应用线程未关闭 | `shutdown.sh` 无效、内存泄漏警告 | `@PreDestroy` 关闭线程池；`CATALINA_PID` + force |
| 19 | AJP Connector 开启 | CVE-2020-1938（Ghostcat） | 不需要就注释掉 |
| 20 | 同一 jar 在 WEB-INF/lib 和 Tomcat lib 都有 | `ClassCastException: A cannot be cast to A` | 只放一处 |
| 21 | Tomcat 只监听 0.0.0.0 且直接暴露公网 | 绕过 Nginx 的安全控制 | `address="127.0.0.1"` 或内网 IP |
| 22 | 外部调用无超时 | **线程池打满，应用假死** | ★ 所有 DB/HTTP/RPC 必须设超时 |
| 23 | 未开访问日志 | 出问题无法追溯请求 | `AccessLogValve` + `%D`（耗时） |
| 24 | maxPostSize 限制导致表单提交失败 | 大表单静默丢参数 | 调大或设 -1 |
| 25 | 临时目录（temp）无权限 | 文件上传失败 | 检查 `java.io.tmpdir` 权限 |

---

## 关联笔记

- 上一篇：[[后端/JavaWeb/Servlet核心与生命周期]]
- 下一篇：[[后端/JavaWeb/JSP-EL-JSTL与前后端分离]]
- 相关：[[后端/JavaWeb/Filter-Listener与会话管理]]（Tomcat 的 Valve 与 Filter）
- 类加载：[[后端/JVM/类加载机制与字节码]]（双亲委派的破坏）
- 部署：[[后端/SpringBoot/日志-Actuator与打包部署]]（jar/war 打包）、[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]（Nginx + Tomcat 架构）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
