---
title: "Servlet核心与生命周期"
aliases:
  - "Servlet"
  - "HttpServletRequest"
tags:
  - "后端"
  - "java"
  - "javaweb"
  - "面试"
category: "后端"
folder: "JavaWeb"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/JavaWeb/Web基础与HTTP协议]]"
  - "[[后端/JavaWeb/Tomcat架构与部署]]"
  - "[[后端/JavaWeb/Filter-Listener与会话管理]]"
  - "[[后端/Spring/SpringMVC入门与执行流程]]"
created: 2026-09-07
updated: 2026-09-07
---

# Servlet 核心与生命周期

> Servlet 是 Java Web 的基石，Spring MVC 的 `DispatcherServlet`、Filter、Listener 全都建立在它之上。虽然日常业务开发不直接写 Servlet，但**必须理解其原理**，否则看不懂 Spring MVC 的执行流程、参数解析、请求上下文。
>
> ⚠️ **包名变化**：Servlet 5.0+（Jakarta EE 9，对应 Tomcat 10 / Spring Boot 3）包名从 `javax.servlet.*` 改为 **`jakarta.servlet.*`**。本篇代码以 `jakarta.servlet` 为准（Spring Boot 3 + JDK 17），JDK 8 + Spring Boot 2 项目请把 `jakarta` 换成 `javax`。

## 1. Servlet 是什么

### 1.1 定义与定位

**Servlet（Server Applet）是运行在服务端、用于接收 HTTP 请求并生成响应的 Java 程序**，由 Servlet 容器（Tomcat/Jetty/Undertow）管理其生命周期。

| 层次 | 角色 | 说明 |
| --- | --- | --- |
| **Servlet 规范** | 接口标准 | 由 Jakarta EE（原 Java EE）定义，`jakarta.servlet-api` |
| **Servlet 容器** | 规范的实现 | Tomcat、Jetty、Undertow、WebLogic、WildFly |
| **Servlet 实现** | 你的代码 | 实现 `Servlet` 接口或继承 `HttpServlet` |
| **上层框架** | 封装 | Spring MVC（`DispatcherServlet`）、Struts2（`StrutsPrepareAndExecuteFilter`） |

```
浏览器 ──HTTP请求──→ Servlet 容器（Tomcat）
                      │
                      ├── 解析 HTTP 报文 → HttpServletRequest / HttpServletResponse 对象
                      ├── 根据 URL 匹配 Servlet（web.xml 或注解）
                      ├── 从线程池取一个线程
                      ├── 调用 Servlet 的 service() 方法
                      │        ↓
                      │   你的业务代码
                      │        ↓
                      │   写入 HttpServletResponse
                      └── 把 Response 转成 HTTP 报文返回浏览器
```

### 1.2 Servlet 版本演进

| 版本 | 年份 | 对应 Java EE / Jakarta EE | 关键特性 | Tomcat |
| --- | --- | --- | --- | --- |
| 2.3 | 2001 | J2EE 1.3 | Filter（过滤器）★ | 4.x |
| 2.4 | 2003 | J2EE 1.4 | web.xml 支持 XML Schema | 5.x |
| **2.5** | 2005 | Java EE 5 | — | 6.x |
| **3.0** | 2009 | Java EE 6 | **注解配置（@WebServlet）、异步 Servlet、可编程注册、ServletContainerInitializer** ★ | 7.x |
| 3.1 | 2013 | Java EE 7 | **非阻塞 IO、HTTP 协议升级（WebSocket）** | 8.x |
| 4.0 | 2017 | Java EE 8 | **HTTP/2 支持、Servlet Mapping 发现** | 9.x |
| **5.0** | 2020 | **Jakarta EE 9** | **包名 javax → jakarta** ★ | 10.0 |
| 6.0 | 2022 | Jakarta EE 10 | 要求 Java 11+、清理废弃 API | 10.1 |
| **6.1** | 2024 | Jakarta EE 11 | 要求 Java 17+、`ServletRequest#getRequestId` | 11.x |

> 【实践】**Spring Boot 2.x = Servlet 4.0（javax）+ Tomcat 9；Spring Boot 3.x = Servlet 6.0（jakarta）+ Tomcat 10.1**。这是升级 Spring Boot 3 时最大的破坏性变更。

## 2. Servlet 接口体系

```
                    Servlet（接口）★ 核心
                    ├── init(ServletConfig)
                    ├── service(ServletRequest, ServletResponse)
                    ├── destroy()
                    ├── getServletConfig()
                    └── getServletInfo()
                        △
                        │ implements
                    GenericServlet（抽象类，与协议无关）
                    ├── 实现了除 service() 外的所有方法
                    ├── 持有 ServletConfig
                    └── abstract service(...)          ← 唯一需要实现的
                        △
                        │ extends
                    HttpServlet（抽象类，★ HTTP 专用）
                    ├── service() 根据请求方法分发到 doXxx()
                    ├── doGet / doPost / doPut / doDelete
                    ├── doHead / doOptions / doTrace
                    └── getLastModified()
                        △
                        │ extends
                    你的 Servlet（只需重写 doGet/doPost）
```

### 2.1 Servlet 接口源码

```java
package jakarta.servlet;

public interface Servlet {

    /** ★ 生命周期①：初始化（容器启动或首次请求时调用，只调一次） */
    void init(ServletConfig config) throws ServletException;

    /** ★ 生命周期②：处理请求（每次请求都调用，多线程并发！） */
    void service(ServletRequest req, ServletResponse res)
            throws ServletException, IOException;

    /** ★ 生命周期③：销毁（容器关闭或 Servlet 被卸载时调用，只调一次） */
    void destroy();

    /** 返回配置对象 */
    ServletConfig getServletConfig();

    /** 返回 Servlet 的描述信息 */
    String getServletInfo();
}
```

### 2.2 GenericServlet（协议无关的骨架实现）

```java
public abstract class GenericServlet implements Servlet, ServletConfig, java.io.Serializable {

    private static final long serialVersionUID = 1L;
    private transient ServletConfig config;                    // ★ 持有配置

    @Override
    public void init(ServletConfig config) throws ServletException {
        this.config = config;                                   // 保存配置
        this.init();                                            // ★ 调用无参 init（模板方法，子类重写这个）
    }

    /** 无参 init：子类重写这个，不必调 super.init(config) */
    public void init() throws ServletException { }

    @Override
    public abstract void service(ServletRequest req, ServletResponse res)   // ★ 唯一抽象方法
            throws ServletException, IOException;

    @Override
    public void destroy() { }

    @Override
    public ServletConfig getServletConfig() { return config; }

    // 委托给 config 的便捷方法（所以 GenericServlet 也实现了 ServletConfig）
    @Override public String getInitParameter(String name) { return config.getInitParameter(name); }
    @Override public Enumeration<String> getInitParameterNames() { return config.getInitParameterNames(); }
    @Override public ServletContext getServletContext() { return config.getServletContext(); }
    @Override public String getServletName() { return config.getServletName(); }

    @Override public String getServletInfo() { return ""; }
    protected ServletContext getServletContext() { ... }

    // 日志便捷方法
    public void log(String msg) { getServletContext().log(msg); }
    public void log(String message, Throwable t) { getServletContext().log(message, t); }
}
```

> 【坑】**重写 `init(ServletConfig)` 时必须调用 `super.init(config)`**，否则 `getServletConfig()` 返回 null。这就是 GenericServlet 提供无参 `init()` 的原因——让你重写无参版本就不会踩这个坑。

### 2.3 HttpServlet（HTTP 专用）★★★★★

```java
public abstract class HttpServlet extends GenericServlet {

    /** ★ 核心：service 方法根据请求方法分发（模板方法 + 策略模式） */
    @Override
    protected void service(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        String method = req.getMethod();                        // 获取请求方法

        if (method.equals(METHOD_GET)) {                         // "GET"
            long lastModified = getLastModified(req);
            if (lastModified == -1) {
                doGet(req, resp);                                // ★ 分发到 doGet
            } else {
                long ifModifiedSince = req.getDateHeader(HEADER_IFMODSINCE);
                if (ifModifiedSince < lastModified) {
                    maybeSetLastModified(resp, lastModified);
                    doGet(req, resp);
                } else {
                    resp.setStatus(HttpServletResponse.SC_NOT_MODIFIED);   // ★ 304，协商缓存
                }
            }
        } else if (method.equals(METHOD_HEAD)) {
            long lastModified = getLastModified(req);
            maybeSetLastModified(resp, lastModified);
            doHead(req, resp);
        } else if (method.equals(METHOD_POST)) {
            doPost(req, resp);
        } else if (method.equals(METHOD_PUT)) {
            doPut(req, resp);
        } else if (method.equals(METHOD_DELETE)) {
            doDelete(req, resp);
        } else if (method.equals(METHOD_OPTIONS)) {
            doOptions(req, resp);
        } else if (method.equals(METHOD_TRACE)) {
            doTrace(req, resp);
        } else {
            resp.sendError(HttpServletResponse.SC_NOT_IMPLEMENTED);   // 501
        }
    }

    /** ★ 父类的 service(ServletRequest, ServletResponse) 负责强转后调用上面的 protected service */
    @Override
    public void service(ServletRequest req, ServletResponse res)
            throws ServletException, IOException {
        HttpServletRequest request;
        HttpServletResponse response;
        try {
            request = (HttpServletRequest) req;                  // ★ 强转为 HTTP 专用类型
            response = (HttpServletResponse) res;
        } catch (ClassCastException e) {
            throw new ServletException("non-HTTP request or response");
        }
        service(request, response);                              // 调用重载版本
    }

    /** 默认实现：返回 405 Method Not Allowed */
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, ...);
    }
    protected void doPost(...) { /* 405 */ }
    protected void doPut(...) { /* 405 */ }
    protected void doDelete(...) { /* 405 */ }

    /** doHead 默认调用 doGet（只发响应头） */
    protected void doHead(HttpServletRequest req, HttpServletResponse resp) {
        NoBodyResponse response = new NoBodyResponse(resp);      // ★ 包装响应，丢弃 body
        doGet(req, response);
        response.setContentLength();
    }

    /** doOptions 默认返回 Allow 头（列出支持的方法） */
    protected void doOptions(HttpServletRequest req, HttpServletResponse resp) {
        // 通过反射查找子类重写了哪些 doXxx 方法，拼成 Allow: GET, POST, HEAD, OPTIONS
    }

    /** doTrace 默认回显请求（★ 有 XST 安全风险，生产应禁用） */
    protected void doTrace(HttpServletRequest req, HttpServletResponse resp) { ... }

    protected long getLastModified(HttpServletRequest req) { return -1; }   // 重写可支持 Last-Modified 缓存
}
```

**为什么要分两层 service？**
1. `public service(ServletRequest, ServletResponse)`：实现 Servlet 接口，负责**类型转换**（把通用的 Request/Response 强转为 HTTP 专用的）。
2. `protected service(HttpServletRequest, HttpServletResponse)`：**根据方法分发**到 doGet/doPost 等。
3. 开发者只需重写 `doGet`/`doPost`，不用关心分发逻辑——这是**模板方法模式**的教科书应用。

## 3. Servlet 生命周期 ★★★★★（必考）

### 3.1 三个阶段

```
┌─────────────────────────────────────────────────────────────┐
│  ① 加载与实例化（Loading & Instantiation）                     │
│     - 容器启动时（若 load-on-startup ≥ 0）或首次请求时（懒加载）    │
│     - ClassLoader 加载类 → 反射调用【无参构造器】创建实例           │
│     - ★ 默认是【单例】！整个应用只有一个实例                       │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  ② 初始化 init(ServletConfig)                                 │
│     - 只调用【一次】，且在构造之后、service 之前                    │
│     - 容器保证「初始化完成后才接收请求」（有同步机制）                 │
│     - 用于：读配置、建立连接池、加载缓存                            │
│     - 抛 ServletException → Servlet 不会被放入服务              │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  ③ 请求处理 service(req, resp)                                │
│     - ★ 每次请求都调用，【多线程并发】                             │
│     - HttpServlet 中分发到 doGet/doPost/...                    │
│     - 容器为每个请求分配一个线程（从线程池取）                       │
└───────────────────────┬─────────────────────────────────────┘
                        ▼ （服务停止 / 应用卸载 / 容器关闭）
┌─────────────────────────────────────────────────────────────┐
│  ④ 销毁 destroy()                                             │
│     - 只调用【一次】                                            │
│     - 用于：释放资源（关闭连接、停止线程、刷盘）                     │
│     - ★ 容器会等待正在执行的 service 完成（或超时）才调 destroy      │
│     - kill -9 / JVM 崩溃 → destroy 不会执行！                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 完整示例

```java
package com.example.servlet;

import jakarta.servlet.*;
import jakarta.servlet.annotation.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Servlet 生命周期完整演示
 */
@WebServlet(
    name = "lifecycleServlet",
    urlPatterns = {"/lifecycle", "/lc"},          // ★ 可映射多个 URL
    loadOnStartup = 1,                             // ★ 启动时初始化（数字越小越先）
    initParams = {                                 // ★ 初始化参数
        @WebInitParam(name = "encoding", value = "UTF-8"),
        @WebInitParam(name = "maxRetry", value = "3")
    },
    asyncSupported = true                          // ★ 支持异步
)
public class LifecycleServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    /** ★ 实例变量：单例 Servlet 中被所有线程共享 → 线程安全问题！ */
    private final AtomicLong requestCount = new AtomicLong(0);   // ✅ 用原子类
    private String encoding;                                      // ✅ 只在 init 中赋值（安全发布）
    private int maxRetry;
    private LocalDateTime startTime;

    // ─── ① 构造器（实例化）───
    public LifecycleServlet() {
        super();
        System.out.println("【1. 构造器】Servlet 实例被创建，线程："
                + Thread.currentThread().getName());
        System.out.println("   hashCode = " + this.hashCode());   // ★ 打印证明是单例
    }

    // ─── ② 初始化 ───
    @Override
    public void init(ServletConfig config) throws ServletException {
        super.init(config);                          // ★ 必须调用（保存 config）
        // 读取初始化参数
        this.encoding = config.getInitParameter("encoding");       // "UTF-8"
        this.maxRetry = Integer.parseInt(config.getInitParameter("maxRetry"));
        this.startTime = LocalDateTime.now();

        // 读取全局参数（ServletContext，即 application 范围）
        ServletContext ctx = config.getServletContext();
        String appName = ctx.getInitParameter("appName");
        String realPath = ctx.getRealPath("/");                     // 应用部署的物理路径

        System.out.println("【2. init】初始化完成，线程：" + Thread.currentThread().getName());
        System.out.println("   servletName = " + config.getServletName());
        System.out.println("   encoding = " + encoding + ", maxRetry = " + maxRetry);
        System.out.println("   appName = " + appName + ", realPath = " + realPath);

        // 可以做重量级初始化：连接池、缓存预热
        // dataSource = createDataSource();
        // cacheWarmUp();
    }

    // 也可以重写无参 init（GenericServlet 提供的模板方法，无需调 super.init(config)）
    // @Override public void init() throws ServletException { ... }

    // ─── ③ 请求处理 ───
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        long count = requestCount.incrementAndGet();
        System.out.printf("【3. service→doGet】第 %d 次请求，线程：%s，Servlet hashCode=%d%n",
                count, Thread.currentThread().getName(), this.hashCode());
        // ★ 多线程并发调用，但 this.hashCode() 始终相同 → 证明是单例

        // 设置响应编码（★ 必须在 getWriter() 之前！）
        response.setContentType("text/html;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");

        try (PrintWriter out = response.getWriter()) {
            out.println("<!DOCTYPE html><html><head><title>Servlet 生命周期</title></head><body>");
            out.println("<h1>LifecycleServlet</h1>");
            out.println("<p>Servlet 实例 hashCode：" + this.hashCode() + "（单例）</p>");
            out.println("<p>启动时间：" + startTime + "</p>");
            out.println("<p>累计请求数：" + count + "</p>");
            out.println("<p>当前线程：" + Thread.currentThread().getName() + "</p>");
            out.println("<p>初始化参数 encoding：" + encoding + "</p>");

            // 请求信息
            out.println("<h2>请求信息</h2><ul>");
            out.println("<li>请求方法：" + request.getMethod() + "</li>");
            out.println("<li>请求 URI：" + request.getRequestURI() + "</li>");
            out.println("<li>请求 URL：" + request.getRequestURL() + "</li>");
            out.println("<li>协议：" + request.getProtocol() + "</li>");
            out.println("<li>客户端 IP：" + getClientIp(request) + "</li>");
            out.println("<li>ContextPath：" + request.getContextPath() + "</li>");
            out.println("<li>ServletPath：" + request.getServletPath() + "</li>");
            out.println("</ul>");
            out.println("</body></html>");
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // ★ 处理中文参数（POST 表单）
        request.setCharacterEncoding("UTF-8");
        String name = request.getParameter("name");
        String[] hobbies = request.getParameterValues("hobby");       // 多值参数

        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"received\":\"" + name + "\"}");
    }

    // ─── ④ 销毁 ───
    @Override
    public void destroy() {
        System.out.println("【4. destroy】Servlet 被销毁，线程："
                + Thread.currentThread().getName());
        System.out.println("   累计处理请求：" + requestCount.get());
        System.out.println("   运行时长：" + java.time.Duration.between(startTime, LocalDateTime.now()));
        // 释放资源
        // dataSource.close();
        // executor.shutdown();
    }

    /** 获取客户端真实 IP（考虑代理） */
    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // X-Forwarded-For 可能是 "client, proxy1, proxy2"，取第一个
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        // IPv6 本地回环转换
        return "0:0:0:0:0:0:0:1".equals(ip) ? "127.0.0.1" : ip;
    }
}
```

### 3.3 load-on-startup（加载时机）★★★★★

```xml
<!-- web.xml 配置 -->
<servlet>
    <servlet-name>myServlet</servlet-name>
    <servlet-class>com.example.MyServlet</servlet-class>
    <load-on-startup>1</load-on-startup>       <!-- ★ 关键 -->
</servlet>
```

| 值 | 行为 |
| --- | --- |
| **负数或不配置** | **懒加载**：首次请求时才创建和初始化（★ 默认行为） |
| **0 或正数** | **容器启动时立即初始化**，数字越小优先级越高（先初始化） |

```java
@WebServlet(urlPatterns = "/x", loadOnStartup = 1)     // 启动时初始化，优先级 1
```

**为什么要用 load-on-startup？**

| 原因 | 说明 |
| --- | --- |
| **避免首次请求慢** | 懒加载时第一个用户要等待 Servlet 初始化（可能几秒） |
| **启动时暴露配置错误** | init 中的异常在启动时就发现，而不是运行时 |
| **预热资源** | 连接池、缓存、字典数据提前加载 |
| **框架需要** | **Spring 的 `DispatcherServlet` 默认 `load-on-startup=1`**（Spring Boot 中通过 `spring.mvc.servlet.load-on-startup` 配置，默认 -1 懒加载，但 Boot 会在启动时预初始化） |

```yaml
# Spring Boot 中配置 DispatcherServlet 的启动时机
spring:
  mvc:
    servlet:
      load-on-startup: 1        # ★ 启动时初始化 DispatcherServlet（避免首个请求慢）
```

### 3.4 Servlet 的线程安全问题 ★★★★★（必考）

**Servlet 是单例的，但 service() 会被多个线程并发调用 → 实例变量存在线程安全风险！**

```java
// ❌ 危险：可变的实例变量
@WebServlet("/unsafe")
public class UnsafeServlet extends HttpServlet {
    private int count = 0;                    // ★ 多线程共享，非原子操作
    private String currentUser;                // ★★ 灾难：用户 A 的数据可能被用户 B 看到！
    private StringBuilder sb = new StringBuilder();

    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        count++;                               // 竞态条件（丢失更新）
        currentUser = req.getParameter("user"); // ★ 线程 A 设置后，线程 B 可能覆盖
        // ... 中间有其他操作（线程切换）
        resp.getWriter().write("Hello " + currentUser);   // ★ 可能输出别的用户！
    }
}

// ✅ 安全的写法
@WebServlet("/safe")
public class SafeServlet extends HttpServlet {

    // ① 用原子类/并发工具
    private final AtomicLong count = new AtomicLong(0);
    private final LongAdder fastCount = new LongAdder();

    // ② ★ 用局部变量（栈上，线程私有）—— 最推荐
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String currentUser = req.getParameter("user");     // ★ 局部变量，天然线程安全
        long c = count.incrementAndGet();
        resp.getWriter().write("Hello " + currentUser + ", count=" + c);
    }

    // ③ 不可变对象（final + 无 setter）
    private final Config config;                            // init 中赋值，之后只读
    @Override public void init() { this.config = loadConfig(); }

    // ④ ThreadLocal（每线程一份）
    private static final ThreadLocal<SimpleDateFormat> SDF =
            ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

    // ⑤ 加锁（★ 不推荐：会串行化，丧失 Servlet 的并发能力）
    private final Object lock = new Object();
    protected void doPost(...) {
        synchronized (lock) { /* 临界区 */ }
    }
}
```

**Servlet 线程安全的规则（必背）：**

| 成员类型 | 线程安全？ | 说明 |
| --- | --- | --- |
| **局部变量**（方法内） | ✅ **安全** | 存在栈帧中，线程私有 |
| 方法参数 | ✅ 安全 | 同上 |
| **`final` 不可变对象字段** | ✅ 安全 | init 中赋值后只读（安全发布） |
| 只读的实例字段 | ✅ 安全 | 初始化后不再修改 |
| **可变的实例字段** | ❌ **不安全** | 多线程共享，需要同步 |
| **静态可变字段** | ❌ **不安全** | 全局共享，风险更大 |
| `HttpServletRequest`/`Response` | ⚠️ 单次请求内安全 | **不要跨线程传递**（异步 Servlet 除外，且有生命周期限制） |
| `HttpSession` | ❌ **不安全** | 同一用户的多个请求并发访问同一 Session，需要自己同步 |
| `ServletContext` | ❌ **不安全** | 全局共享，`setAttribute` 需要同步 |

> 【面试标准答案】**Servlet 是单例多线程的，线程不安全。保证安全的方式：① 尽量用局部变量；② 实例变量只用不可变对象或 final；③ 需要共享可变状态时用原子类/锁/ThreadLocal；④ 避免在 Servlet 中持有请求相关的状态。**
>
> 【延伸】**Spring 的 Controller/Service 默认也是单例的**，同样遵循这个规则。所以 Spring 的 Bean 中**不要定义可变的实例字段**（`@Autowired` 的依赖是 final 不可变的，安全）。

### 3.5 为什么 Servlet 是单例？

| 原因 | 说明 |
| --- | --- |
| **性能** | 避免每次请求都创建/销毁对象（Servlet 可能有重量级的 init） |
| **内存** | 一个应用可能有很多 Servlet，单例节省内存 |
| **规范设计** | Servlet 规范就是这么定义的（容器管理生命周期） |
| **与 Spring 一致** | Spring 的 Bean 默认也是 singleton |

> 历史上确实有 `SingleThreadModel` 接口（Servlet 2.4 前），实现它后容器会为每个请求创建 Servlet 实例或串行化 service 调用。**已在 Servlet 2.5 中废弃**（性能极差，且不能真正解决并发问题——Session 和静态变量仍共享）。

## 4. HttpServletRequest 详解 ★★★★★

### 4.1 请求信息获取

```java
// ─── 请求行 ───
request.getMethod();                  // "GET" / "POST"
request.getRequestURI();              // "/myapp/api/users"（★ 含 contextPath，不含查询串）
request.getRequestURL();              // StringBuffer: "http://localhost:8080/myapp/api/users"（不含查询串）
request.getQueryString();             // "id=1&name=tom"（★ 仅 GET 有，POST 表单没有）
request.getProtocol();                // "HTTP/1.1"
request.getScheme();                  // "http" / "https"
request.getHttpServletMapping();      // Servlet 4.0+：匹配到的映射信息

// ─── 路径分解（★ 容易混淆）───
// 假设请求：http://localhost:8080/myapp/api/users/1?x=1
request.getContextPath();             // "/myapp"          ← 应用上下文路径
request.getServletPath();             // "/api/users/1"    ← 匹配 Servlet 的路径部分
request.getPathInfo();                // null              ← Servlet 映射中 /* 之后的部分（精确映射时为 null）
request.getPathTranslated();          // 对应的文件系统路径
// URI = contextPath + servletPath + pathInfo

// ─── 服务器与客户端信息 ───
request.getServerName();              // "localhost"
request.getServerPort();              // 8080
request.getRemoteAddr();              // "127.0.0.1"（★ 有代理时是代理的 IP，不是真实客户端）
request.getRemoteHost();              // 客户端主机名
request.getRemotePort();              // 客户端端口（随机端口）
request.getLocalAddr();               // 服务端接收请求的网卡 IP
request.getLocalPort();               // 服务端端口
request.getRemoteUser();              // 已认证的用户名（容器认证时）
request.getUserPrincipal();           // 用户主体

// ─── 请求头 ───
request.getHeader("User-Agent");       // 获取单个头（大小写不敏感）
request.getHeader("Accept");
request.getHeaders("Accept");          // Enumeration<String>（同名多个值）
request.getHeaderNames();              // Enumeration<String>（所有头名）
request.getIntHeader("Content-Length");
request.getDateHeader("If-Modified-Since");   // 返回 long 时间戳
// 遍历所有头
Enumeration<String> names = request.getHeaderNames();
while (names.hasMoreElements()) {
    String name = names.nextElement();
    System.out.println(name + ": " + request.getHeader(name));
}
// JDK 8 风格
Collections.list(request.getHeaderNames())
        .forEach(n -> System.out.println(n + "=" + request.getHeader(n)));

// 常用头的快捷获取
request.getContentType();              // "application/json;charset=UTF-8"
request.getCharacterEncoding();         // "UTF-8"（从 Content-Type 解析）
request.getContentLength();             // int（-1 表示未知）
request.getContentLengthLong();         // long（Servlet 3.1+，大文件）
request.getCookies();                    // Cookie[]

// ─── 转发/包含信息（★ 重要）───
request.getRequestDispatcher("/other").forward(request, response);
// 转发后，在 /other 中：
request.getRequestURI();               // "/other"（★ 变成了新路径）
request.getAttribute("jakarta.servlet.forward.request_uri");   // ★ 原始 URI
request.getAttribute("jakarta.servlet.forward.servlet_path");
request.getAttribute("jakarta.servlet.include.request_uri");   // include 时用这个
```

### 4.2 请求参数获取 ★★★★★

```java
// ─── 1. 单值参数 ───
String id = request.getParameter("id");              // 不存在返回 null
String name = request.getParameter("name");

// ─── 2. 多值参数（复选框、多选下拉）───
String[] hobbies = request.getParameterValues("hobby");   // ★ 返回数组
// HTML: <input type="checkbox" name="hobby" value="读">
//       <input type="checkbox" name="hobby" value="写">

// ─── 3. 所有参数 ───
Map<String, String[]> paramMap = request.getParameterMap();   // ★ 不可修改的 Map
paramMap.forEach((k, v) -> System.out.println(k + "=" + Arrays.toString(v)));
Enumeration<String> paramNames = request.getParameterNames();

// ─── 4. 带默认值（避免 null）───
int page = Optional.ofNullable(request.getParameter("page"))
                   .map(Integer::parseInt)
                   .orElse(1);
// 或
int size = request.getParameter("size") != null ? Integer.parseInt(request.getParameter("size")) : 20;

// ─── 5. POST 表单的请求体（非参数形式）───
// Content-Type: application/json 时，getParameter 拿不到！必须读流
String body = request.getReader()                          // ★ 字符流（文本）
                     .lines()
                     .collect(Collectors.joining("\n"));
// 或
InputStream is = request.getInputStream();                  // ★ 字节流（二进制）
String body2 = new String(is.readAllBytes(), StandardCharsets.UTF_8);

// ─── 6. 文件上传（multipart/form-data）───
// 需要 @MultipartConfig 注解或 web.xml 配置
@WebServlet("/upload")
@MultipartConfig(
    location = "/tmp",                    // 临时文件目录
    maxFileSize = 10 * 1024 * 1024,       // ★ 单个文件最大 10MB
    maxRequestSize = 50 * 1024 * 1024,    // ★ 整个请求最大 50MB
    fileSizeThreshold = 1024 * 1024       // 超过 1MB 才写磁盘（否则在内存）
)
public class UploadServlet extends HttpServlet {
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws Exception {
        // 单个文件
        Part filePart = req.getPart("file");
        String fileName = getFileName(filePart);            // 从 Content-Disposition 解析
        filePart.write("/data/uploads/" + fileName);         // ★ 直接写文件（推荐）
        // 或用流
        try (InputStream in = filePart.getInputStream()) {
            Files.copy(in, Paths.get("/data/uploads", fileName), REPLACE_EXISTING);
        }
        filePart.getSize();                                  // 文件大小
        filePart.getContentType();                           // MIME 类型
        filePart.delete();                                    // 删除临时文件

        // 所有 part（含普通表单字段）
        for (Part part : req.getParts()) {
            String name = part.getName();
            if (part.getSubmittedFileName() == null) {       // ★ 普通字段（非文件）
                String value = req.getParameter(name);
            }
        }
        // 文件集合
        Collection<Part> files = req.getParts();
    }

    private String getFileName(Part part) {
        // Content-Disposition: form-data; name="file"; filename="测试.pdf"
        for (String cd : part.getHeader("content-disposition").split(";")) {
            if (cd.trim().startsWith("filename")) {
                String fileName = cd.substring(cd.indexOf('=') + 1).trim().replace("\"", "");
                return Paths.get(fileName).getFileName().toString();   // ★ 去掉路径，防目录穿越
            }
        }
        return "unknown";
    }
}
```

> 【坑】**GET 与 POST 的参数来源不同**：
> - `getParameter()` 能同时读取：**URL 查询串** + **`application/x-www-form-urlencoded` 的表单体** + **`multipart/form-data` 的字段**。
> - **不能读取 `application/json` 的请求体**！JSON 必须用 `getReader()`/`getInputStream()` 手动读并解析。
> - 这就是 Spring MVC 中 `@RequestParam`（读 parameter）与 `@RequestBody`（读原始流）的区别。

> 【坑】**请求体只能读一次**！`getInputStream()`/`getReader()` 读过之后，再调 `getParameter()` 可能拿不到表单参数（因为容器已经消费了流）。
> - 解决：用 `HttpServletRequestWrapper` 包装，缓存流内容（详见 [[后端/JavaWeb/Filter-Listener与会话管理]] 的可重复读请求包装）。
> - Spring 中：`ContentCachingRequestWrapper`。

> 【坑】**中文乱码**：
> ```java
> // POST 表单（application/x-www-form-urlencoded）
> request.setCharacterEncoding("UTF-8");     // ★ 必须在 getParameter 之前调用！
>
> // GET 查询串（Tomcat 8+ 默认 UTF-8，无需处理）
> // Tomcat 7 及以前需要：new String(value.getBytes("ISO-8859-1"), "UTF-8")
> // 或在 server.xml 的 Connector 中配 URIEncoding="UTF-8"
>
> // 响应
> response.setCharacterEncoding("UTF-8");
> response.setContentType("text/html;charset=UTF-8");   // ★ 一步搞定（含 charset）
>
> // Spring Boot 默认已配置 CharacterEncodingFilter（forceEncoding=true），无需手动处理
> ```

### 4.3 请求域（Attribute）★

**Attribute 是服务端在「一次请求/会话/应用」范围内传递 Java 对象的机制**（不同于 Parameter 是客户端传来的字符串）。

```java
// 设置/获取/删除
request.setAttribute("user", userObject);          // 存任意 Object
User user = (User) request.getAttribute("user");   // 取（需强转）
request.removeAttribute("user");                    // 删
request.getAttributeNames();                        // Enumeration<String>

// ★ Attribute vs Parameter
```

| 对比 | Parameter（参数） | Attribute（属性） |
| --- | --- | --- |
| 来源 | **客户端**（URL 查询串、表单体） | **服务端**代码设置 |
| 类型 | 只能是 **String / String[]** | **任意 Object** |
| 只读性 | 只读（无法 set） | 可读可写可删 |
| 作用域 | 单次请求 | request / session / application 三种范围 |
| 用途 | 接收用户输入 | **服务端内部数据传递**（转发、页面渲染） |

**四大作用域（从小到大）：**

| 作用域 | 对象 | 生命周期 | 典型用途 |
| --- | --- | --- | --- |
| **pageContext** | `PageContext`（仅 JSP） | 一个页面 | JSP 内部临时变量 |
| **request** | `HttpServletRequest` | **一次请求**（含转发） | Controller → View 传数据 ★ 最常用 |
| **session** | `HttpSession` | 一次会话（多次请求，超时销毁） | 登录用户信息、购物车 |
| **application** | `ServletContext` | 整个应用（从启动到关闭） | 全局配置、字典缓存、在线人数 |

```java
// 转发的典型用法（★ request 域能跨越 forward）
request.setAttribute("userList", users);
request.getRequestDispatcher("/WEB-INF/views/list.jsp").forward(request, response);
// JSP 中：${userList} 或 request.getAttribute("userList")

// Spring MVC 中
@GetMapping("/detail")
public String detail(Long id, Model model, HttpServletRequest request) {
    User user = userService.get(id);
    model.addAttribute("user", user);              // ★ 底层就是 request.setAttribute
    request.setAttribute("extra", "value");        // 也可以直接操作
    return "detail";                                // 转发到 detail.html（Thymeleaf）
}

// 重定向时 request 域会丢失！（新的请求）
response.sendRedirect("/other");                    // ❌ attribute 丢失
// ✅ 用 Flash Attribute（Spring MVC 提供，存 Session 中，重定向后取出并删除）
redirectAttributes.addFlashAttribute("message", "保存成功");
return "redirect:/list";

// ✅ 或用 URL 参数传递
response.sendRedirect("/other?msg=" + URLEncoder.encode("保存成功", "UTF-8"));
```

## 5. HttpServletResponse 详解 ★★★★★

### 5.1 状态行与响应头

```java
// ─── 状态码 ───
response.setStatus(200);                                    // 只设状态码
response.setStatus(HttpServletResponse.SC_OK);              // 用常量（推荐）
response.sendError(404, "资源不存在");                        // ★ 状态码 + 错误页面（会走容器的错误页）
response.sendError(HttpServletResponse.SC_NOT_FOUND, "用户不存在");
response.sendRedirect("/login");                            // ★ 302 + Location 头（客户端跳转）

// setStatus vs sendError 的区别
// setStatus：只设置状态码，不会触发容器的错误页机制，需要自己写响应体
// sendError：设置状态码 + 清空缓冲区 + 触发 <error-page> 配置的错误页
//             ⚠️ sendError 后不能再写响应体（会抛 IllegalStateException）

// ─── 响应头 ───
response.setHeader("X-Trace-Id", traceId);                  // 设置（覆盖同名）
response.addHeader("Set-Cookie", "a=1");                     // 添加（不覆盖，可多个同名）
response.setIntHeader("Retry-After", 60);
response.setDateHeader("Expires", System.currentTimeMillis() + 86400_000L);
response.addIntHeader(...); response.addDateHeader(...);
response.containsHeader("X-Trace-Id");                      // 是否已设置

// ─── Content-Type（★ 必须在 getWriter 之前设置）───
response.setContentType("application/json;charset=UTF-8");   // ★ 一步设置类型和编码（推荐）
// 等价于：
response.setCharacterEncoding("UTF-8");
response.setHeader("Content-Type", "application/json;charset=UTF-8");

// 常用 Content-Type
"application/json;charset=UTF-8"              // JSON API
"text/html;charset=UTF-8"                     // HTML 页面
"text/plain;charset=UTF-8"                    // 纯文本
"application/xml;charset=UTF-8"               // XML
"application/octet-stream"                     // 二进制流（文件下载）
"application/vnd.ms-excel"                     // xls
"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"   // xlsx
"application/pdf"                              // PDF
"image/png" / "image/jpeg"                     // 图片

// ─── 缓存控制 ───
response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
response.setHeader("Pragma", "no-cache");                      // 兼容 HTTP/1.0
response.setDateHeader("Expires", 0);                           // 兼容
response.setHeader("ETag", "\"" + md5 + "\"");
response.setDateHeader("Last-Modified", lastModified);

// ─── CORS（详见 Web基础与HTTP协议）───
response.setHeader("Access-Control-Allow-Origin", origin);
response.setHeader("Access-Control-Allow-Credentials", "true");

// ─── 安全头 ───
response.setHeader("X-Content-Type-Options", "nosniff");
response.setHeader("X-Frame-Options", "SAMEORIGIN");
response.setHeader("X-XSS-Protection", "1; mode=block");        // 已被现代浏览器废弃，用 CSP
response.setHeader("Content-Security-Policy", "default-src 'self'");
response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
```

### 5.2 响应体输出

```java
// ─── 1. 字符流（文本内容）★ 常用 ───
response.setContentType("text/html;charset=UTF-8");
PrintWriter out = response.getWriter();
out.println("<h1>Hello</h1>");
out.write("文本");
out.printf("用户：%s，年龄：%d%n", name, age);
out.flush();                              // ★ 刷新（或等缓冲区满/响应结束自动刷）
// out.close();                           // 容器会自动关闭，一般不用手动 close

// ─── 2. 字节流（二进制内容：图片、文件下载）───
response.setContentType("image/jpeg");
ServletOutputStream sos = response.getOutputStream();
sos.write(imageBytes);
sos.flush();

// ⚠️★ getWriter() 和 getOutputStream() 互斥！只能调用其中一个
//    同时调用会抛 IllegalStateException

// ─── 3. JSON 输出（★ API 开发最常见）───
response.setContentType("application/json;charset=UTF-8");
PrintWriter writer = response.getWriter();
Result<User> result = Result.success(user);
writer.write(objectMapper.writeValueAsString(result));    // Jackson 序列化
// 或用 Fastjson
writer.write(JSON.toJSONString(result));

// ─── 4. 文件下载 ★★★★★ ───
public void download(HttpServletRequest request, HttpServletResponse response, File file)
        throws IOException {
    if (!file.exists()) {
        response.sendError(404, "文件不存在");
        return;
    }
    // ① 设置 Content-Type（浏览器无法识别的用 octet-stream）
    String contentType = Files.probeContentType(file.toPath());
    response.setContentType(contentType != null ? contentType : "application/octet-stream");

    // ② ★ 设置 Content-Disposition（决定是内联显示还是下载，以及文件名）
    String fileName = file.getName();
    String encodedName = URLEncoder.encode(fileName, StandardCharsets.UTF_8)
                                    .replaceAll("\\+", "%20");    // ★ + 号要转成 %20
    // 兼容各浏览器的写法（RFC 5987）
    response.setHeader("Content-Disposition",
        String.format("attachment; filename=\"%s\"; filename*=UTF-8''%s",
                      encodedName, encodedName));
    // inline = 浏览器内联显示（如 PDF、图片）；attachment = 强制下载

    // ③ 设置文件大小（让浏览器显示下载进度）
    response.setContentLengthLong(file.length());

    // ④ 禁用缓存
    response.setHeader("Cache-Control", "no-store");

    // ⑤ ★ 流式输出（不要一次性读入内存！大文件会 OOM）
    try (InputStream in = new BufferedInputStream(Files.newInputStream(file.toPath()));
         ServletOutputStream out = response.getOutputStream()) {
        byte[] buffer = new byte[8192];
        int len;
        while ((len = in.read(buffer)) != -1) {
            out.write(buffer, 0, len);
        }
        out.flush();
    } catch (IOException e) {
        // ★ 客户端中断下载（关闭浏览器）会抛 IOException: Broken pipe
        //   这是正常现象，不应记录为 ERROR
        log.debug("文件下载中断（客户端可能已取消）: {}", fileName);
    }
}

// Spring MVC 的下载（更简洁）
@GetMapping("/download/{id}")
public ResponseEntity<Resource> download(@PathVariable Long id) {
    File file = fileService.getFile(id);
    Resource resource = new FileSystemResource(file);
    String encodedName = URLEncoder.encode(file.getName(), StandardCharsets.UTF_8)
                                    .replaceAll("\\+", "%20");
    return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename*=UTF-8''" + encodedName)
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .contentLength(file.length())
            .body(resource);
}

// ─── 5. 断点续传（Range 请求）───
public void downloadWithRange(HttpServletRequest req, HttpServletResponse resp, File file) throws IOException {
    long fileLength = file.length();
    String range = req.getHeader("Range");                 // "bytes=1024-2047"
    long start = 0, end = fileLength - 1;

    if (range != null && range.startsWith("bytes=")) {
        resp.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);    // ★ 206
        String[] parts = range.substring(6).split("-");
        start = Long.parseLong(parts[0]);
        if (parts.length > 1 && !parts[1].isEmpty()) end = Long.parseLong(parts[1]);
        end = Math.min(end, fileLength - 1);
        resp.setHeader("Content-Range",
                String.format("bytes %d-%d/%d", start, end, fileLength));
    }
    resp.setHeader("Accept-Ranges", "bytes");              // ★ 声明支持分段请求
    resp.setContentLengthLong(end - start + 1);
    resp.setContentType("application/octet-stream");

    try (RandomAccessFile raf = new RandomAccessFile(file, "r");
         OutputStream out = resp.getOutputStream()) {
        raf.seek(start);                                    // ★ 跳到起始位置
        byte[] buf = new byte[8192];
        long remaining = end - start + 1;
        while (remaining > 0) {
            int toRead = (int) Math.min(buf.length, remaining);
            int len = raf.read(buf, 0, toRead);
            if (len == -1) break;
            out.write(buf, 0, len);
            remaining -= len;
        }
    }
}
```

### 5.3 请求转发 vs 重定向 ★★★★★（必考）

```java
// ─── 转发（Forward）：服务端内部跳转 ───
request.setAttribute("data", value);
request.getRequestDispatcher("/WEB-INF/views/detail.jsp")
       .forward(request, response);

// ─── 重定向（Redirect）：客户端重新请求 ───
response.sendRedirect("/myapp/list");                       // ★ 会自动加 contextPath？不会！需自己加
response.sendRedirect(request.getContextPath() + "/list");  // ✅ 正确写法
// Servlet 3.1+ 支持相对路径
response.sendRedirect("list");                               // 相对当前路径
```

| 对比项 | 转发 forward | 重定向 redirect |
| --- | --- | --- |
| **发起方** | **服务端**（容器内部） | **客户端**（浏览器重新请求） |
| **请求次数** | **1 次** | **2 次** |
| **地址栏** | **不变**（用户看不到真实路径） | **改变**（显示新 URL） |
| **状态码** | 无（内部调用） | **302**（或 301/303/307）+ `Location` 头 |
| **request 域数据** | ✅ **保留**（同一个 request 对象） | ❌ **丢失**（新的 request） |
| **能否访问 WEB-INF** | ✅ **可以**（服务端内部，安全） | ❌ 不能（浏览器无法直接访问 WEB-INF） |
| **能否跳转到其他站点** | ❌ 不能（只能本应用内） | ✅ 可以（`sendRedirect("https://other.com")`） |
| **响应是否已提交** | 转发前不能提交响应 | 重定向后原响应结束 |
| **性能** | **快**（无网络往返） | 慢（多一次请求） |
| **典型用途** | Controller → View 渲染、内部路由 | 登录后跳转、PRG 模式、跳转外部 |

```java
// ─── PRG 模式（Post-Redirect-Get）★★★★★ ───
// 问题：POST 提交表单后直接 forward 到结果页，用户刷新页面会【重复提交】！
// 解决：POST 处理完后 redirect 到 GET 页面
protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    // 处理表单提交
    saveData(req);
    req.getSession().setAttribute("flashMessage", "保存成功");     // ★ 用 Session 传递一次性消息
    // ★ 重定向（而非转发）
    resp.sendRedirect(req.getContextPath() + "/list");
}
protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    String msg = (String) req.getSession().getAttribute("flashMessage");
    if (msg != null) req.getSession().removeAttribute("flashMessage");   // ★ 取出后立即删除
    req.setAttribute("message", msg);
    forward to list.jsp;
}
// Spring MVC 的对应实现：RedirectAttributes.addFlashAttribute()

// ─── 转发的注意事项 ───
// 1. 转发前不能提交响应（不能 flush/close，否则 IllegalStateException）
// 2. 转发到 WEB-INF 下的资源是安全的（外部无法直接访问）
// 3. 转发会再次经过 Filter（如果 Filter 配了 DispatcherType.FORWARD）
// 4. 转发不会改变 request 的 URI，但可以通过 attribute 获取原始 URI

// ─── include（包含）：把另一个资源的输出嵌入当前响应 ───
request.getRequestDispatcher("/common/header.jsp").include(request, response);
out.println("<h1>主内容</h1>");
request.getRequestDispatcher("/common/footer.jsp").include(request, response);
// include 中被包含的资源【不能修改响应状态码和头】（会被忽略）
```

## 6. ServletContext 与 ServletConfig

### 6.1 ServletConfig（Servlet 的配置）

```java
public interface ServletConfig {
    String getServletName();                       // <servlet-name> 或 @WebServlet(name=)
    ServletContext getServletContext();            // 获取全局上下文
    String getInitParameter(String name);           // ★ 该 Servlet 的初始化参数
    Enumeration<String> getInitParameterNames();
}
```

```xml
<!-- web.xml 配置 -->
<servlet>
    <servlet-name>myServlet</servlet-name>
    <servlet-class>com.example.MyServlet</servlet-class>
    <init-param>                                  <!-- ★ Servlet 级参数 -->
        <param-name>encoding</param-name>
        <param-value>UTF-8</param-value>
    </init-param>
    <init-param>
        <param-name>maxRows</param-name>
        <param-value>1000</param-value>
    </init-param>
</servlet>
```

### 6.2 ServletContext（应用全局上下文）★★★★★

**一个 Web 应用只有一个 ServletContext 实例（所有 Servlet 共享），代表整个应用。**

```java
public interface ServletContext {
    // ─── 全局初始化参数（web.xml 的 <context-param>）───
    String getInitParameter(String name);
    Enumeration<String> getInitParameterNames();

    // ─── ★ 全局属性（application 作用域）───
    void setAttribute(String name, Object object);
    Object getAttribute(String name);
    void removeAttribute(String name);
    Enumeration<String> getAttributeNames();

    // ─── 应用信息 ───
    String getContextPath();                       // "/myapp"
    String getServletContextName();                // 应用名
    String getServerInfo();                        // "Apache Tomcat/10.1.16"
    int getMajorVersion(); int getMinorVersion();   // Servlet 规范版本
    String getVirtualServerName();                  // 虚拟主机名

    // ─── 资源访问 ───
    String getRealPath(String path);                // ★ 虚拟路径 → 物理路径（jar 部署时可能返回 null）
    URL getResource(String path);                   // 获取资源的 URL
    InputStream getResourceAsStream(String path);    // ★ 读取 classpath/webapp 下的资源
    Set<String> getResourcePaths(String path);       // 列出目录下的资源

    // ─── 获取其他 Servlet / 转发 ───
    RequestDispatcher getRequestDispatcher(String path);
    RequestDispatcher getNamedDispatcher(String name);
    ServletContext getContext(String uripath);       // ★ 获取其他 Web 应用的上下文（需配置 crossContext）

    // ─── MIME 类型 ───
    String getMimeType(String file);                 // "image/png"

    // ─── 日志 ───
    void log(String msg);
    void log(String message, Throwable throwable);

    // ─── Servlet 3.0+ 动态注册（★ 编程式配置）───
    ServletRegistration.Dynamic addServlet(String name, String className);
    ServletRegistration.Dynamic addServlet(String name, Servlet servlet);
    ServletRegistration.Dynamic addServlet(String name, Class<? extends Servlet> clazz);
    <T extends Filter> T addFilter(String name, Class<T> clazz);
    <T extends EventListener> T addListener(Class<T> clazz);
    void addListener(String className);

    // ─── Session 配置（Servlet 3.0+）───
    SessionCookieConfig getSessionCookieConfig();
    void setSessionTrackingModes(Set<SessionTrackingMode> modes);

    // ─── Servlet 4.0+ ───
    ServletRegistration.Dynamic addJspFile(String name, String jspFile);
    int getSessionTimeout();
    String getRequestCharacterEncoding();
}
```

```xml
<!-- web.xml 的全局参数 -->
<context-param>
    <param-name>appName</param-name>
    <param-value>My Application</param-value>
</context-param>
<context-param>
    <param-name>contextConfigLocation</param-name>      <!-- ★ Spring 的经典用法 -->
    <param-value>classpath:applicationContext.xml</param-value>
</context-param>
```

```java
// 使用
ServletContext ctx = getServletContext();                // GenericServlet 的便捷方法
String appName = ctx.getInitParameter("appName");
ctx.setAttribute("onlineCount", new AtomicInteger(0));    // 全局共享数据
AtomicInteger count = (AtomicInteger) ctx.getAttribute("onlineCount");
count.incrementAndGet();

// ★ 经典应用：统计在线人数（配合 HttpSessionListener）
@WebListener
public class OnlineCounterListener implements HttpSessionListener, ServletContextListener {
    @Override
    public void contextInitialized(ServletContextEvent sce) {
        sce.getServletContext().setAttribute("online", new AtomicInteger(0));
    }
    @Override
    public void sessionCreated(HttpSessionEvent se) {
        AtomicInteger online = (AtomicInteger) se.getSession()
                .getServletContext().getAttribute("online");
        online.incrementAndGet();
    }
    @Override
    public void sessionDestroyed(HttpSessionEvent se) {
        AtomicInteger online = (AtomicInteger) se.getSession()
                .getServletContext().getAttribute("online");
        online.decrementAndGet();
    }
}
```

**四大作用域对象总结：**

| 作用域对象 | 类型 | 范围 | 生命周期 | Spring 对应 |
| --- | --- | --- | --- | --- |
| `PageContext` | JSP 特有 | 一个页面 | 页面渲染期间 | — |
| `ServletRequest` | `HttpServletRequest` | **一次请求** | 请求开始到响应结束（含 forward） | `RequestContextHolder` |
| `HttpSession` | `HttpSession` | **一次会话** | 首次 `getSession()` 到超时/`invalidate()` | `@SessionScope` |
| `ServletContext` | `ServletContext` | **整个应用** | 应用启动到关闭 | `ApplicationContext` |

## 7. Servlet 3.0+ 的注解配置

```java
// ─── @WebServlet ───
@WebServlet(
    name = "userServlet",                              // Servlet 名称（默认类全名）
    urlPatterns = {"/users", "/api/users"},            // ★ URL 映射（可多个）
    value = {"/users"},                                 // urlPatterns 的别名（二选一）
    loadOnStartup = 1,                                  // 启动时加载
    initParams = {
        @WebInitParam(name = "pageSize", value = "20", description = "每页条数")
    },
    asyncSupported = true,                              // ★ 支持异步
    displayName = "用户管理 Servlet",
    description = "处理用户的 CRUD"
)
public class UserServlet extends HttpServlet { }

// ─── @WebFilter ───
@WebFilter(
    filterName = "authFilter",
    urlPatterns = {"/api/*", "/admin/*"},
    servletNames = {"userServlet"},                     // 也可按 Servlet 名过滤
    initParams = {@WebInitParam(name = "excludePaths", value = "/api/login")},
    dispatcherTypes = {                                 // ★ 拦截的请求类型
        DispatcherType.REQUEST,                          // 正常请求（默认）
        DispatcherType.FORWARD,                          // 转发
        DispatcherType.INCLUDE,                          // 包含
        DispatcherType.ERROR,                            // 错误页
        DispatcherType.ASYNC                             // 异步
    },
    asyncSupported = true
)
public class AuthFilter implements Filter { }

// ─── @WebListener ───
@WebListener
public class AppListener implements ServletContextListener, HttpSessionListener { }

// ─── @MultipartConfig（文件上传）───
@WebServlet("/upload")
@MultipartConfig(
    location = "/tmp",
    maxFileSize = 10485760L,                // 10MB，-1 表示无限制
    maxRequestSize = 52428800L,             // 50MB
    fileSizeThreshold = 1048576              // 1MB，超过才写磁盘
)
public class UploadServlet extends HttpServlet { }

// ─── @ServletSecurity（声明式安全）───
@ServletSecurity(
    value = @HttpConstraint(rolesAllowed = {"ADMIN"}),
    httpMethodConstraints = {
        @HttpMethodConstraint(value = "POST", rolesAllowed = {"ADMIN", "OPERATOR"}),
        @HttpMethodConstraint(value = "DELETE", emptyRoleSemantic = ServletSecurity.EmptyRoleSemantic.DENY)
    }
)
@WebServlet("/admin/*")
public class AdminServlet extends HttpServlet { }

// ─── 启用注解扫描 ───
// web.xml 中需要 metadata-complete="false"（默认就是 false）
<web-app xmlns="https://jakarta.ee/xml/ns/jakartaee" version="6.0"
         metadata-complete="false">   <!-- ★ true 会禁用注解扫描！ -->
```

**URL 映射规则（★ 匹配优先级）：**

| 类型 | 示例 | 说明 | 优先级 |
| --- | --- | --- | --- |
| **精确匹配** | `/login`、`/api/users/1` | 完全一致 | **1（最高）** |
| **路径匹配** | `/api/*`、`/admin/*` | 以 `/` 开头、`/*` 结尾 | 2（最长前缀优先） |
| **扩展名匹配** | `*.jsp`、`*.do`、`*.action` | 以 `*.` 开头 | 3 |
| **默认匹配** | `/` | 匹配所有未被其他 Servlet 处理的请求 | **4（最低）** |
| 不能 | `/*.jsp`、`/api/*.json` | ★ 路径和扩展名不能混用 | 非法 |

```
匹配顺序示例：
请求 /api/users/list
① 精确匹配：有 /api/users/list 吗？→ 有就用它
② 路径匹配：找最长的前缀 /* → /api/users/* > /api/* > /*
③ 扩展名匹配：*.xxx
④ 默认匹配：/

★ Spring MVC 的 DispatcherServlet 通常映射为 "/"（默认匹配），接管所有请求，
  然后用内部的 HandlerMapping 做二级路由（@RequestMapping）
★ 静态资源需要单独配置（否则 DispatcherServlet 会拦截）
```

## 8. 异步 Servlet（Servlet 3.0+）

**问题：** 传统 Servlet 是「一请求一线程」，如果业务中有慢 IO（调远程接口、查数据库），线程会一直阻塞占用，**Tomcat 线程池（默认 200）很快耗尽**。

**解决：** 异步 Servlet 让请求线程可以**提前返回**去处理其他请求，业务在另一个线程中完成后写回响应。

```java
@WebServlet(urlPatterns = "/async", asyncSupported = true)     // ★ 必须开启
public class AsyncServlet extends HttpServlet {

    private static final ExecutorService BIZ_POOL = new ThreadPoolExecutor(
            20, 100, 60L, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(500),
            new NamedThreadFactory("async-biz"));

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // ① ★ 开启异步模式，返回 AsyncContext（此时请求线程可以返回了）
        AsyncContext asyncContext = request.startAsync();       // 或 startAsync(request, response)
        asyncContext.setTimeout(30_000L);                        // ★ 超时时间（默认 30 秒或容器配置）

        // ② 注册监听器（可选，用于超时/完成/错误的处理）
        asyncContext.addListener(new AsyncListener() {
            @Override
            public void onComplete(AsyncEvent event) throws IOException {
                log.info("异步请求完成");
            }
            @Override
            public void onTimeout(AsyncEvent event) throws IOException {
                log.error("异步请求超时");
                event.getAsyncContext().getResponse().setStatus(504);
                event.getAsyncContext().complete();               // ★ 必须 complete
            }
            @Override
            public void onError(AsyncEvent event) throws IOException {
                log.error("异步请求异常", event.getThrowable());
                event.getAsyncContext().complete();
            }
            @Override
            public void onStartAsync(AsyncEvent event) { }
        });

        // ③ ★ 提交业务到另一个线程池（释放 Tomcat 线程）
        BIZ_POOL.execute(() -> {
            try {
                // 耗时的业务（调远程接口、查数据库）
                String result = slowRemoteCall();

                // ④ 写响应（★ 通过 asyncContext 获取 response）
                HttpServletResponse resp = (HttpServletResponse) asyncContext.getResponse();
                resp.setContentType("application/json;charset=UTF-8");
                resp.getWriter().write("{\"result\":\"" + result + "\"}");
                resp.flushBuffer();

                // ⑤ ★★ 必须调用 complete()，否则容器一直等待 → 超时
                asyncContext.complete();
            } catch (Exception e) {
                log.error("异步业务失败", e);
                asyncContext.complete();                          // 异常也要 complete
            }
        });

        // ★ doGet 方法在此返回，Tomcat 线程被释放去处理其他请求
        // 但 HTTP 连接保持打开，等待 complete() 后才真正发送响应
    }

    // 也可以用 asyncContext.start()（用容器管理的线程池，不推荐——不可控）
    // asyncContext.start(() -> { ... });
}
```

**异步 Servlet 的价值与现状：**

| | 说明 |
| --- | --- |
| **解决的问题** | 慢 IO 场景下 Tomcat 线程被长期占用，吞吐量低 |
| **原理** | 请求线程与业务线程解耦，HTTP 连接保持但线程释放 |
| **典型应用** | Spring MVC 的 `Callable`、`DeferredResult`、`WebAsyncTask`、`SseEmitter`、返回 `CompletableFuture` |
| **现代替代** | ★ **虚拟线程（JDK 21）**：同步写法 + 异步性能，不需要复杂的回调；**WebFlux**：响应式非阻塞 |
| **注意事项** | 必须 `complete()`；`request`/`response` 在异步完成后不能再使用；ThreadLocal 不传递；Filter 也要 `asyncSupported=true` |

```java
// Spring MVC 对异步 Servlet 的封装（更简洁，见 [[后端/SpringBoot/整合Web开发]]）
@GetMapping("/callable")
public Callable<Result<String>> callable() {
    return () -> Result.success(slowQuery());       // Spring 自动处理 AsyncContext
}

@GetMapping("/deferred")
public DeferredResult<Result<String>> deferred() {
    DeferredResult<Result<String>> dr = new DeferredResult<>(30_000L);
    dr.onTimeout(() -> dr.setErrorResult(Result.failed("超时")));
    bizPool.execute(() -> dr.setResult(Result.success(slowQuery())));
    return dr;
}

@GetMapping("/future")
public CompletableFuture<Result<String>> future() {
    return CompletableFuture.supplyAsync(this::slowQuery, bizPool)
                            .thenApply(Result::success);
}

@GetMapping("/sse")
public SseEmitter sse() {                            // 服务端推送（Server-Sent Events）
    SseEmitter emitter = new SseEmitter(60_000L);
    bizPool.execute(() -> {
        try {
            for (int i = 0; i < 10; i++) {
                emitter.send(SseEmitter.event().data("进度 " + i));
                Thread.sleep(1000);
            }
            emitter.complete();
        } catch (Exception e) { emitter.completeWithError(e); }
    });
    return emitter;
}
```

## 9. Servlet 与 Spring MVC 的关系 ★★★★★

**Spring MVC 的核心就是一个 Servlet —— `DispatcherServlet`（前端控制器）。**

```
浏览器请求
   │
   ▼
Tomcat 容器
   │  根据 URL 匹配到 DispatcherServlet（映射为 "/"）
   ▼
DispatcherServlet.service(req, resp)
   │  ↓ 继承自 FrameworkServlet.service()
   │  ↓ 再调 processRequest() → doService()
   ▼
DispatcherServlet.doDispatch(request, response)     ★ 核心方法
   │
   ├─① HandlerMapping：根据 URL 找到处理器（@RequestMapping 的方法）
   │    → 返回 HandlerExecutionChain（Handler + 拦截器链）
   ├─② HandlerAdapter：适配不同类型的 Handler（注解方法、Controller 接口、HttpRequestHandler）
   ├─③ 拦截器 preHandle
   ├─④ HandlerAdapter.handle() → 反射调用你的 Controller 方法
   │    ├─ 参数解析（HandlerMethodArgumentResolver）：@RequestParam、@RequestBody、@PathVariable
   │    ├─ 执行业务
   │    └─ 返回值处理（HandlerMethodReturnValueHandler）：@ResponseBody → JSON
   ├─⑤ 拦截器 postHandle
   ├─⑥ ViewResolver（若返回视图名）→ 渲染
   ├─⑦ 拦截器 afterCompletion
   └─⑧ 异常处理（HandlerExceptionResolver / @ControllerAdvice）
   ▼
响应返回浏览器
```

```java
// DispatcherServlet 的 doDispatch 简化源码（★ 面试高频）
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) throws Exception {
    HttpServletRequest processedRequest = request;
    HandlerExecutionChain mappedHandler = null;

    try {
        ModelAndView mv = null;
        Exception dispatchException = null;
        try {
            processedRequest = checkMultipart(request);              // ① 文件上传解析
            // ② ★ 找到 Handler（Controller 方法）
            mappedHandler = getHandler(processedRequest);
            if (mappedHandler == null) { noHandlerFound(processedRequest, response); return; }
            // ③ ★ 找到 HandlerAdapter
            HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());
            // ④ 处理 Last-Modified（GET/HEAD）
            String method = request.getMethod();
            if (method.equals("GET") || method.equals("HEAD")) {
                long lastModified = ha.getLastModified(request, mappedHandler.getHandler());
                if (new ServletWebRequest(request, response).checkNotModified(lastModified)
                        && method.equals("GET")) return;              // 304
            }
            // ⑤ ★ 拦截器前置
            if (!mappedHandler.applyPreHandle(processedRequest, response)) return;
            // ⑥ ★★ 调用 Handler（你的 Controller 方法）
            mv = ha.handle(processedRequest, response, mappedHandler.getHandler());
            // ⑦ 拦截器后置
            mappedHandler.applyPostHandle(processedRequest, response, mv);
        } catch (Exception ex) {
            dispatchException = ex;
        }
        // ⑧ ★ 处理结果（渲染视图 or 写 JSON）+ 异常解析
        processDispatchResult(processedRequest, response, mappedHandler, mv, dispatchException);
    } catch (Exception ex) {
        triggerAfterCompletion(processedRequest, response, mappedHandler, ex);
    }
    // ...
}
```

| Servlet 概念 | Spring MVC 对应 |
| --- | --- |
| `HttpServlet` | **`DispatcherServlet`**（唯一的 Servlet） |
| `web.xml` 的 `<servlet-mapping>` | `DispatcherServletAutoConfiguration`（自动注册，映射 `/`） |
| `doGet`/`doPost` | `@GetMapping`/`@PostMapping` 标注的 Controller 方法 |
| `request.getParameter()` | `@RequestParam` |
| `request.getInputStream()` + JSON 解析 | `@RequestBody`（`HttpMessageConverter`） |
| `request.setAttribute()` + forward | `Model` / `ModelAndView` + `ViewResolver` |
| `response.getWriter().write(json)` | `@ResponseBody`（`HttpMessageConverter`） |
| `Filter` | `Filter`（Servlet 规范）/ `HandlerInterceptor`（Spring 层） |
| `ServletContextListener` | `ApplicationListener` / `@EventListener` |
| `HttpSessionListener` | `HttpSessionListener`（仍可注册） |
| `AsyncContext` | `Callable` / `DeferredResult` / `CompletableFuture` |
| `@MultipartConfig` + `Part` | `MultipartFile` |

> 【价值】理解了 Servlet，就理解了 Spring MVC「做了什么封装」：
> - 把「一个 URL 一个 Servlet」变成「一个 Servlet + 注解路由」。
> - 把「手动 getParameter + 类型转换」变成「`@RequestParam` 自动绑定 + 校验」。
> - 把「手动写 JSON」变成「`@ResponseBody` 自动序列化」。
> - 把「手动 try-catch」变成「`@ControllerAdvice` 全局异常处理」。
>
> 详见 [[后端/Spring/SpringMVC入门与执行流程]]。

## 10. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 可变实例变量 | 数据串号（用户 A 看到 B 的数据） | 用局部变量；共享状态用原子类/锁 |
| 2 | 重写 `init(ServletConfig)` 不调 super | `getServletConfig()` 返回 null | 调 `super.init(config)`，或重写无参 `init()` |
| 3 | `getWriter()` 和 `getOutputStream()` 同时用 | `IllegalStateException` | 二选一（文本用 Writer，二进制用 OutputStream） |
| 4 | `setContentType` 在 `getWriter()` 之后 | 编码不生效（乱码） | ★ 必须在 getWriter 之前 |
| 5 | `request.setCharacterEncoding` 在 getParameter 之后 | POST 参数乱码 | ★ 必须在 getParameter 之前 |
| 6 | 请求体被读两次 | 第二次为空 | 用 `HttpServletRequestWrapper` 缓存流 |
| 7 | `getParameter` 读 JSON 请求体 | 返回 null | JSON 要用 `getReader()` 读流并解析 |
| 8 | 重定向后取 request attribute | null（新请求） | 用 Session 传递（Flash Attribute）或 URL 参数 |
| 9 | `sendRedirect` 忘记加 contextPath | 404 | `req.getContextPath() + "/path"` |
| 10 | `sendError` 后继续写响应体 | `IllegalStateException` | sendError 会清空缓冲区并提交响应 |
| 11 | 转发前 flush 了响应 | `IllegalStateException` | 转发前不能提交响应 |
| 12 | 文件下载一次性读入内存 | 大文件 OOM | 流式输出（8KB 缓冲） |
| 13 | 下载文件名中文乱码 | 浏览器显示乱码 | `URLEncoder.encode` + `filename*=UTF-8''` |
| 14 | 下载被客户端中断报 ERROR | 日志大量 Broken pipe | 降级为 debug 日志（正常现象） |
| 15 | 异步 Servlet 忘记 `complete()` | 请求挂起直到超时 | 必须在 finally 中 complete |
| 16 | Filter 未配 `asyncSupported` | 异步请求报错 | 整条链路都要 `asyncSupported=true` |
| 17 | `load-on-startup` 未设 | 首次请求慢（要等初始化） | 设为 1 |
| 18 | 忘记 `destroy()` 中释放资源 | 连接/线程泄漏 | 释放线程池、连接、文件句柄 |
| 19 | 依赖 `destroy()` 做数据持久化 | kill -9 时不执行 | 关键数据实时落库，或用 shutdown hook |
| 20 | URL 映射用了 `/*.jsp` | 启动报错 | 路径匹配和扩展名匹配不能混用 |
| 21 | `javax.servlet` 与 `jakarta.servlet` 混用 | Spring Boot 3 下 ClassNotFound | 全部改为 `jakarta.servlet` |
| 22 | Tomcat 版本与 Servlet 版本不匹配 | 特性不可用/启动失败 | Tomcat 9=Servlet 4.0，Tomcat 10=Servlet 5/6 |
| 23 | Session 存大对象 | 内存暴涨（分布式下更严重） | 只存必要的标识，数据放缓存/DB |
| 24 | `getRealPath` 在 jar 部署时返回 null | 找不到资源路径 | 用 `getResourceAsStream` 读 classpath 资源 |
| 25 | TRACE 方法未禁用 | XST 跨站追踪攻击 | Nginx/Tomcat 中禁用 TRACE |

---

## 关联笔记

- 上一篇：[[后端/JavaWeb/Web基础与HTTP协议]]
- 下一篇：[[后端/JavaWeb/Tomcat架构与部署]]
- 相关：[[后端/JavaWeb/Filter-Listener与会话管理]]、[[后端/JavaWeb/JSP-EL-JSTL与前后端分离]]
- 框架层：[[后端/Spring/SpringMVC入门与执行流程]]（DispatcherServlet 的完整流程）、[[后端/Spring/SpringMVC参数绑定与异常处理]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
