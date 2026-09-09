---
title: "Filter-Listener与会话管理"
aliases:
  - "Filter 过滤器"
  - "Listener 监听器"
  - "Session 管理"
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
  - "[[后端/JavaWeb/JWT认证与Web安全]]"
  - "[[后端/JavaWeb/Web基础与HTTP协议]]"
  - "[[后端/Spring/SpringMVC参数绑定与异常处理]]"
created: 2026-09-07
updated: 2026-09-07
---

# Filter、Listener 与会话管理

## 1. Filter 过滤器 ★★★★★

### 1.1 是什么与能做什么

**Filter 是 Servlet 规范定义的「请求/响应拦截器」**，在请求到达 Servlet **之前**、响应返回客户端**之前**对它们进行预处理和后处理。

```
浏览器请求
    │
    ▼
┌──────────────────────┐
│ Filter1 (前置处理)      │──┐
├──────────────────────┤  │  Filter 链（责任链模式）
│ Filter2 (前置处理)      │  │
├──────────────────────┤  │
│ Filter3 (前置处理)      │──┘
├──────────────────────┤
│  Servlet / JSP        │   ← 业务处理
├──────────────────────┤
│ Filter3 (后置处理)      │──┐
├──────────────────────┤  │  ★ 逆序返回（栈式）
│ Filter2 (后置处理)      │  │
├──────────────────────┤  │
│ Filter1 (后置处理)      │──┘
└──────────────────────┘
    │
    ▼
浏览器响应
```

**典型用途：**

| 用途 | 说明 |
| --- | --- |
| **字符编码统一** | `CharacterEncodingFilter`（Spring Boot 默认注册） |
| **登录鉴权** | 校验 Token/Session，未登录重定向到登录页 |
| **权限校验** | 判断用户是否有访问该资源的权限 |
| **XSS / SQL 注入过滤** | 清洗请求参数中的危险字符 |
| **请求日志** | 记录 URI、参数、耗时、IP、UserAgent |
| **CORS 跨域处理** | 添加 CORS 响应头（详见 [[后端/JavaWeb/Web基础与HTTP协议]]） |
| **请求/响应包装** | 让请求体可重复读、压缩响应、加密响应 |
| **限流** | 基于 IP/用户/IP 的访问频率限制 |
| **敏感词过滤** | 替换响应内容中的敏感词 |
| **防盗链** | 校验 Referer |
| **灰度发布** | 根据用户标识路由到不同版本 |

### 1.2 Filter 接口与生命周期

```java
public interface Filter {

    /** ★ 初始化（容器启动时调用一次） */
    default void init(FilterConfig filterConfig) throws ServletException { }

    /** ★ 核心：拦截处理（每次请求都调用，多线程并发！） */
    void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException;

    /** ★ 销毁（容器关闭时调用一次） */
    default void destroy() { }
}

public interface FilterChain {
    /** ★ 放行到下一个 Filter 或目标 Servlet。不调用则请求被「拦截」（到此为止） */
    void doFilter(ServletRequest request, ServletResponse response) throws IOException, ServletException;
}

public interface FilterConfig {
    String getFilterName();
    ServletContext getServletContext();
    String getInitParameter(String name);           // Filter 的初始化参数
    Enumeration<String> getInitParameterNames();
}
```

**生命周期（与 Servlet 类似）：**

```
容器启动 → 实例化 Filter（反射无参构造）→ init(FilterConfig)（一次）
    ↓
每次请求 → doFilter(req, resp, chain)（★ 多线程并发，单例）
    ↓
容器关闭 → destroy()（一次）
```

> 【注意】Filter 也是**单例多线程**的，所以**不要定义可变的实例变量**（同 Servlet 的线程安全问题）。

### 1.3 完整示例：请求日志 + 耗时统计

```java
package com.example.filter;

import jakarta.servlet.*;
import jakarta.servlet.annotation.*;
import jakarta.servlet.http.*;
import lombok.extern.slf4j.Slf4j;
import java.io.IOException;
import java.util.Enumeration;
import java.util.UUID;

/**
 * 访问日志过滤器：记录请求信息、耗时、traceId
 */
@Slf4j
@WebFilter(
    filterName = "accessLogFilter",
    urlPatterns = "/*",                              // ★ 拦截所有请求
    dispatcherTypes = {DispatcherType.REQUEST, DispatcherType.ASYNC},
    asyncSupported = true                            // ★ 支持异步（否则异步请求会报错）
)
public class AccessLogFilter implements Filter {

    private String appName;                           // 只在 init 中赋值（安全发布）
    private boolean logParams;

    @Override
    public void init(FilterConfig config) throws ServletException {
        this.appName = config.getInitParameter("appName");
        this.logParams = Boolean.parseBoolean(
                config.getInitParameter("logParams"));
        log.info("AccessLogFilter 初始化完成, appName={}, logParams={}", appName, logParams);
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse resp, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) req;       // ★ 强转为 HTTP 类型
        HttpServletResponse response = (HttpServletResponse) resp;

        // ① 前置处理：生成 traceId 并放入 MDC（★ 全链路日志追踪）
        String traceId = Optional.ofNullable(request.getHeader("X-Request-Id"))
                                 .orElse(UUID.randomUUID().toString().replace("-", ""));
        MDC.put("traceId", traceId);
        response.setHeader("X-Request-Id", traceId);              // ★ 返回给前端，便于排查

        long start = System.currentTimeMillis();
        String uri = request.getRequestURI();
        String method = request.getMethod();
        String clientIp = getClientIp(request);

        try {
            // ② ★★ 放行（不调用则请求到此为止，不会到达 Servlet）
            chain.doFilter(request, response);

        } finally {
            // ③ 后置处理：无论成功失败都记录（★ 必须放 finally）
            long cost = System.currentTimeMillis() - start;
            int status = response.getStatus();

            if (cost > 1000 || status >= 500) {
                log.warn("[{}] {} {} status={} cost={}ms ip={} ua={}",
                        traceId, method, uri, status, cost, clientIp,
                        abbreviate(request.getHeader("User-Agent"), 100));
            } else {
                log.info("[{}] {} {} status={} cost={}ms ip={}",
                        traceId, method, uri, status, cost, clientIp);
            }

            // ④ ★★ 必须清理 MDC（线程池复用会导致 traceId 串号！）
            MDC.clear();
        }
    }

    @Override
    public void destroy() {
        log.info("AccessLogFilter 销毁");
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (isInvalid(ip)) ip = request.getHeader("X-Real-IP");
        if (isInvalid(ip)) ip = request.getHeader("Proxy-Client-IP");
        if (isInvalid(ip)) ip = request.getRemoteAddr();
        // X-Forwarded-For 可能是 "客户端IP, 代理1, 代理2"，★ 取第一个才是真实客户端
        if (ip != null && ip.contains(",")) ip = ip.split(",")[0].trim();
        return "0:0:0:0:0:0:0:1".equals(ip) ? "127.0.0.1" : ip;
    }

    private boolean isInvalid(String ip) {
        return ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip);
    }

    private String abbreviate(String s, int max) {
        return s == null ? null : (s.length() <= max ? s : s.substring(0, max) + "...");
    }
}
```

### 1.4 三种配置方式

```java
// ─── 方式 1：注解（@WebFilter）───
// ★ 需要在启动类加 @ServletComponentScan 才能扫描到（Spring Boot 中！）
@SpringBootApplication
@ServletComponentScan(basePackages = "com.example.filter")    // ★ 关键
public class Application { }

@WebFilter(
    filterName = "myFilter",
    urlPatterns = {"/api/*", "/admin/*"},              // 或 value = {...}
    servletNames = {"dispatcherServlet"},               // 也可按 Servlet 名匹配
    initParams = {@WebInitParam(name = "key", value = "value")},
    dispatcherTypes = {DispatcherType.REQUEST, DispatcherType.FORWARD},
    asyncSupported = true,
    description = "我的过滤器"
)
public class MyFilter implements Filter { }

// ⚠️ @WebFilter 的缺陷：★ 无法指定 Filter 的执行顺序！
//   多个 @WebFilter 的顺序由类名字母序或容器实现决定，不可控
//   需要精确控制顺序 → 用方式 2 或 3

// ─── 方式 2：FilterRegistrationBean（★ Spring Boot 推荐，可控制顺序）───
@Configuration
public class FilterConfig {

    @Bean
    public FilterRegistrationBean<AccessLogFilter> accessLogFilter() {
        FilterRegistrationBean<AccessLogFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new AccessLogFilter());
        bean.addUrlPatterns("/*");                        // ★ 拦截路径
        bean.addInitParameter("appName", "myapp");
        bean.addInitParameter("logParams", "true");
        bean.setName("accessLogFilter");
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);    // ★★ 顺序（数字越小越先执行）
        bean.setAsyncSupported(true);
        bean.setDispatcherTypes(DispatcherType.REQUEST, DispatcherType.ASYNC);
        bean.setEnabled(true);                             // 可动态开关
        return bean;
    }

    @Bean
    public FilterRegistrationBean<AuthFilter> authFilter() {
        FilterRegistrationBean<AuthFilter> bean = new FilterRegistrationBean<>(new AuthFilter());
        bean.addUrlPatterns("/api/*");
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE + 100);   // 在日志之后
        return bean;
    }

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilter() {
        FilterRegistrationBean<CorsFilter> bean = new FilterRegistrationBean<>(new CorsFilter());
        bean.addUrlPatterns("/*");
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);          // ★ CORS 必须最先执行
        return bean;
    }
}

// ─── 方式 3：web.xml（传统方式，了解即可）───
```

```xml
<filter>
    <filter-name>encodingFilter</filter-name>
    <filter-class>org.springframework.web.filter.CharacterEncodingFilter</filter-class>
    <init-param>
        <param-name>encoding</param-name>
        <param-value>UTF-8</param-value>
    </init-param>
    <init-param>
        <param-name>forceEncoding</param-name>
        <param-value>true</param-value>
    </init-param>
    <async-supported>true</async-supported>
</filter>
<filter-mapping>
    <filter-name>encodingFilter</filter-name>
    <url-pattern>/*</url-pattern>
    <dispatcher>REQUEST</dispatcher>
    <dispatcher>FORWARD</dispatcher>
</filter-mapping>
<!-- ★ web.xml 中 Filter 的顺序由 <filter-mapping> 的声明顺序决定 -->
```

**三种方式对比：**

| 方式 | 顺序控制 | 动态开关 | 适用 |
| --- | --- | --- | --- |
| `@WebFilter` | ❌ 不可控 | ❌ | 简单的单个 Filter，非 Spring 项目 |
| **`FilterRegistrationBean`** | ✅ **`setOrder()`** | ✅ `setEnabled()` | ★ **Spring Boot 推荐** |
| `web.xml` | ✅ 声明顺序 | ❌ | 传统 SSM 项目 |
| 实现 `Ordered` 接口 + `@Component` | ✅ `getOrder()` | ❌ | Filter 需要注入 Spring Bean 时 |

```java
// ─── 方式 4：@Component + Ordered（★ Filter 需要依赖注入时）───
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 50)              // ★ 用 @Order 控制顺序
public class InjectedFilter implements Filter {

    @Autowired                                          // ★ 可以注入 Spring Bean
    private UserService userService;

    @Value("${filter.enabled:true}")
    private boolean enabled;

    @Override
    public void doFilter(ServletRequest req, ServletResponse resp, FilterChain chain)
            throws IOException, ServletException {
        if (!enabled) { chain.doFilter(req, resp); return; }
        // 业务逻辑
        chain.doFilter(req, resp);
    }
}
// ⚠️ @Component 的 Filter 默认拦截所有路径（/*），要限制路径需配合 FilterRegistrationBean
```

### 1.5 Filter 链的执行原理

```java
// Tomcat 的 ApplicationFilterChain（简化）
final class ApplicationFilterChain implements FilterChain {
    private int pos = 0;                                    // ★ 当前位置
    private final int n;                                     // Filter 数量
    private final ApplicationFilterConfig[] filters;          // Filter 数组
    private Servlet servlet;                                  // 最终的目标 Servlet

    @Override
    public void doFilter(ServletRequest request, ServletResponse response) {
        if (pos < n) {                                        // 还有 Filter
            ApplicationFilterConfig config = filters[pos++];   // ★ 指针后移
            Filter filter = config.getFilter();
            filter.doFilter(request, response, this);          // ★ 把自己传进去（递归）
            return;
        }
        // ★ 所有 Filter 都执行完了，调用 Servlet
        servlet.service(request, response);
    }
}
```

**执行顺序图解（3 个 Filter）：**

```
chain.doFilter() 调用栈：

F1.doFilter 前置
  └─ chain.doFilter() → pos=0→1
     F2.doFilter 前置
       └─ chain.doFilter() → pos=1→2
          F3.doFilter 前置
            └─ chain.doFilter() → pos=2→3
               Servlet.service()  ★ 业务处理
          F3.doFilter 后置
     F2.doFilter 后置
F1.doFilter 后置

★ 关键理解：
1. chain.doFilter() 之前的代码 = 「前置处理」（正序执行 F1→F2→F3）
2. chain.doFilter() 之后的代码 = 「后置处理」（逆序执行 F3→F2→F1）
3. 不调用 chain.doFilter() = 拦截（后续 Filter 和 Servlet 都不执行）
4. 这是【责任链模式】+ 递归调用
```

```java
// ★ 拦截的三种方式
@Override
public void doFilter(ServletRequest req, ServletResponse resp, FilterChain chain) {
    HttpServletRequest request = (HttpServletRequest) req;
    HttpServletResponse response = (HttpServletResponse) resp;

    // ① 重定向（客户端跳转，302）
    if (!isLogin(request)) {
        response.sendRedirect(request.getContextPath() + "/login");
        return;                                    // ★ 必须 return！否则会继续执行下面的代码
    }

    // ② 转发（服务端跳转）
    if (forbidden) {
        request.getRequestDispatcher("/403.html").forward(req, resp);
        return;
    }

    // ③ 直接写响应（API 场景，返回 JSON）
    if (invalidToken) {
        response.setStatus(401);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":401,\"message\":\"未登录\"}");
        return;
    }

    // ④ 抛异常（交给全局异常处理器）
    if (badRequest) {
        throw new BusinessException("参数非法");
    }

    chain.doFilter(req, resp);                      // ★ 放行
}
```

> 【坑】**拦截后忘记 `return`**：会继续执行 `chain.doFilter()` 后面的代码，导致「已经重定向了但又执行了业务逻辑」，出现 `IllegalStateException: Response already committed` 或响应内容混乱。**拦截后必须立即 return。**

### 1.6 DispatcherType（拦截的请求类型）★★★★★

```java
public enum DispatcherType {
    FORWARD,      // 请求转发（RequestDispatcher.forward）
    INCLUDE,      // 请求包含（RequestDispatcher.include）
    REQUEST,      // ★ 客户端的直接请求（默认，也是唯一默认值）
    ASYNC,        // 异步请求（AsyncContext.dispatch）
    ERROR         // 错误页转发（<error-page> 或 sendError）
}
```

**默认只拦截 REQUEST！** 这是最常见的坑：

```java
// 场景：Filter 做了鉴权，Controller 里 forward 到一个 JSP
// /api/data → AuthFilter（拦截，鉴权通过）→ Controller → forward("/WEB-INF/view.jsp")
// ★ 默认情况下，forward 不会再经过 AuthFilter（因为 DispatcherType.FORWARD 未配置）
//   这通常是「期望的行为」（避免重复鉴权）

// 但如果 Filter 做的是「响应包装」「日志记录」，你可能希望 forward 也生效：
@WebFilter(urlPatterns = "/*",
           dispatcherTypes = {DispatcherType.REQUEST, DispatcherType.FORWARD,
                              DispatcherType.INCLUDE, DispatcherType.ERROR,
                              DispatcherType.ASYNC})     // ★ 全部拦截

// Spring Boot 中
bean.setDispatcherTypes(DispatcherType.REQUEST, DispatcherType.ASYNC, DispatcherType.ERROR);
```

| DispatcherType | 触发场景 | 是否需要拦截 |
| --- | --- | --- |
| `REQUEST` | 浏览器直接请求（★ 最常见） | **必须** |
| `FORWARD` | `request.getRequestDispatcher().forward()` | 视需求（鉴权不需要，日志可能需要） |
| `INCLUDE` | `include()`（包含片段） | 少用 |
| `ERROR` | 容器跳转到 `&lt;error-page&gt;` | ★ **需要**（否则错误页响应不会被包装/记录） |
| `ASYNC` | 异步 Servlet 的 `asyncContext.dispatch()` | ★ **异步应用需要** |

> 【坑】**异步 Servlet 场景忘记配 `DispatcherType.ASYNC`**：
> ```java
> @WebFilter(urlPatterns = "/*", asyncSupported = true)   // ★ 两个都要配
> // 只配 asyncSupported=true 不配 dispatcherTypes=ASYNC → 异步 dispatch 时 Filter 不生效
> // 只配 dispatcherTypes 不配 asyncSupported → 启动异步时报错：
> //   "A filter or servlet of the current chain does not support asynchronous operations"
> ```
> **整条链路（所有 Filter + Servlet）都必须 `asyncSupported=true`**，任何一个不支持就会导致异步失败。

### 1.7 请求/响应的包装（Wrapper）★★★★★

**`HttpServletRequestWrapper` / `HttpServletResponseWrapper` 是装饰器模式的应用，用于「增强」原生请求/响应对象。**

#### 应用 1：请求体可重复读（★ 最常见需求）

```java
/**
 * 问题：request.getInputStream() 只能读一次！
 * 场景：Filter 中要读 body 做签名校验/日志记录，但 Controller 的 @RequestBody 还要再读一次
 * 解决：包装 Request，把 body 缓存到 byte[]，可重复读
 */
public class RepeatableReadRequestWrapper extends HttpServletRequestWrapper {

    private final byte[] body;                                  // ★ 缓存的请求体

    public RepeatableReadRequestWrapper(HttpServletRequest request) throws IOException {
        super(request);
        // 一次性读取全部 body 并缓存
        try (InputStream is = request.getInputStream()) {
            this.body = is.readAllBytes();
        }
    }

    /** ★ 每次调用都返回一个新的流（基于缓存的 byte[]） */
    @Override
    public ServletInputStream getInputStream() {
        ByteArrayInputStream bais = new ByteArrayInputStream(body);
        return new ServletInputStream() {
            @Override public boolean isFinished() { return bais.available() == 0; }
            @Override public boolean isReady() { return true; }
            @Override public void setReadListener(ReadListener listener) { }
            @Override public int read() { return bais.read(); }
            @Override public int read(byte[] b, int off, int len) { return bais.read(b, off, len); }
        };
    }

    @Override
    public BufferedReader getReader() {
        String encoding = getCharacterEncoding();
        if (encoding == null) encoding = StandardCharsets.UTF_8.name();
        return new BufferedReader(new InputStreamReader(getInputStream(), Charset.forName(encoding)));
    }

    /** 便捷方法：直接获取 body 字符串 */
    public String getBodyString() {
        String encoding = getCharacterEncoding();
        return new String(body, encoding != null ? Charset.forName(encoding) : StandardCharsets.UTF_8);
    }
}

// Filter 中使用
@Override
public void doFilter(ServletRequest req, ServletResponse resp, FilterChain chain) throws ... {
    HttpServletRequest request = (HttpServletRequest) req;
    // ★ 只对 JSON 请求包装（表单请求由容器解析参数，包装会破坏 getParameter）
    String contentType = request.getContentType();
    if (contentType != null && contentType.contains(MediaType.APPLICATION_JSON_VALUE)) {
        RepeatableReadRequestWrapper wrapper = new RepeatableReadRequestWrapper(request);
        // 现在可以读多次
        log.info("请求体：{}", wrapper.getBodyString());
        String sign = calcSign(wrapper.getBodyString());        // 签名校验
        chain.doFilter(wrapper, resp);                          // ★ 传 wrapper 而非原 request
    } else {
        chain.doFilter(req, resp);
    }
}
```

> 【坑】**不要对 `application/x-www-form-urlencoded` 的请求做包装**：容器在调用 `getParameter()` 时会消费 InputStream 来解析表单参数。如果你先读了流，`getParameter()` 就拿不到值了。正确做法：表单请求直接读 `getParameterMap()`，只对 JSON/二进制请求包装流。
>
> Spring 已内置：`org.springframework.web.util.ContentCachingRequestWrapper`（但它是在**读取后**才缓存，`getInputStream()` 不能重复读，只适合在 Controller 之后读日志）。要真正的可重复读需自己实现或用它的 `getContentAsByteArray()`。

#### 应用 2：XSS 过滤（清洗请求参数）

```java
/**
 * XSS 过滤包装器：清洗所有参数和 Header 中的危险内容
 */
public class XssRequestWrapper extends HttpServletRequestWrapper {

    public XssRequestWrapper(HttpServletRequest request) { super(request); }

    @Override
    public String getParameter(String name) {
        return clean(super.getParameter(name));
    }

    @Override
    public String[] getParameterValues(String name) {
        String[] values = super.getParameterValues(name);
        if (values == null) return null;
        return Arrays.stream(values).map(this::clean).toArray(String[]::new);
    }

    @Override
    public Map<String, String[]> getParameterMap() {
        Map<String, String[]> original = super.getParameterMap();
        Map<String, String[]> cleaned = new LinkedHashMap<>(original.size());
        original.forEach((k, v) -> cleaned.put(k,
                Arrays.stream(v).map(this::clean).toArray(String[]::new)));
        return cleaned;
    }

    @Override
    public String getHeader(String name) {
        return clean(super.getHeader(name));
    }

    /** ★ 核心清洗逻辑 */
    private String clean(String value) {
        if (value == null || value.isEmpty()) return value;

        // ① HTML 转义（★ 最安全的方式：把 < > & " ' 转成实体）
        value = value.replace("&", "&amp;")
                     .replace("<", "&lt;")
                     .replace(">", "&gt;")
                     .replace("\"", "&quot;")
                     .replace("'", "&#x27;");

        // ② 移除危险标签和事件（多层防护，防绕过）
        value = value.replaceAll("(?i)<\\s*script[^>]*>.*?<\\s*/\\s*script\\s*>", "");
        value = value.replaceAll("(?i)javascript\\s*:", "");
        value = value.replaceAll("(?i)on\\w+\\s*=", "");            // onclick= onload= 等
        value = value.replaceAll("(?i)expression\\s*\\(", "");       // CSS expression
        value = value.replaceAll("(?i)vbscript\\s*:", "");
        value = value.replaceAll("(?i)<\\s*iframe[^>]*>.*?<\\s*/\\s*iframe\\s*>", "");
        value = value.replaceAll("(?i)<\\s*(object|embed|applet|meta|link|style)[^>]*>", "");
        // ③ 移除 NULL 字节和不可见控制字符
        value = value.replaceAll("\\u0000", "");
        return value;
    }
}

// ★ 更好的做法：用成熟的库
// ① OWASP Java Encoder（输出编码，比过滤输入更可靠）
//    Encode.forHtml(input)、Encode.forJavaScript(input)、Encode.forHtmlAttribute(input)
// ② AntiSamy / OWASP Java HTML Sanitizer（白名单策略，适合富文本）
//    Policy policy = new PolicyFactoryBuilder().allowElements("p","b","i").toFactory();
//    String safe = policy.sanitize(untrustedHtml);
// ③ Jsoup（白名单清洗富文本）
//    String safe = Jsoup.clean(untrustedHtml, Safelist.basic());
```

> 【安全原则】**防 XSS 的正确姿势是「输出时编码」而非「输入时过滤」**：
> 1. **输入过滤容易绕过**（编码变形、嵌套标签、大小写、注释），且会破坏合法数据（如用户真的要输入 `&lt;div&gt;`）。
> 2. **输出编码根据上下文选择**：HTML 内容用 `forHtml`，属性值用 `forHtmlAttribute`，JS 中用 `forJavaScript`，URL 中用 `forUriComponent`。
> 3. **富文本场景用白名单清洗**（Jsoup/AntiSamy），而非黑名单过滤。
> 4. **配合 CSP（Content-Security-Policy）响应头**做纵深防御。
> 5. Cookie 设 `HttpOnly`，防止 JS 读取。

#### 应用 3：响应包装（统计、加密、敏感词替换）

```java
/**
 * 响应包装器：缓存响应内容，便于后处理
 */
public class CachedResponseWrapper extends HttpServletResponseWrapper {

    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    private PrintWriter writer;
    private ServletOutputStream outputStream;

    public CachedResponseWrapper(HttpServletResponse response) { super(response); }

    /** ★ 返回基于内存缓冲的 OutputStream（不直接写到真正的响应） */
    @Override
    public ServletOutputStream getOutputStream() {
        if (outputStream == null) {
            outputStream = new ServletOutputStream() {
                @Override public boolean isReady() { return true; }
                @Override public void setWriteListener(WriteListener l) { }
                @Override public void write(int b) { buffer.write(b); }
                @Override public void write(byte[] b, int off, int len) { buffer.write(b, off, len); }
            };
        }
        return outputStream;
    }

    @Override
    public PrintWriter getWriter() {
        if (writer == null) {
            writer = new PrintWriter(new OutputStreamWriter(buffer,
                    getCharacterEncoding() != null ? Charset.forName(getCharacterEncoding())
                                                  : StandardCharsets.UTF_8));
        }
        return writer;
    }

    /** 获取缓存的响应内容 */
    public byte[] getContentAsByteArray() {
        if (writer != null) writer.flush();
        return buffer.toByteArray();
    }
    public String getContentAsString() {
        return new String(getContentAsByteArray(),
                getCharacterEncoding() != null ? Charset.forName(getCharacterEncoding())
                                              : StandardCharsets.UTF_8);
    }

    /** ★ 把缓存的内容真正写到原始响应 */
    public void copyBodyToResponse() throws IOException {
        byte[] body = getContentAsByteArray();
        if (body.length > 0) {
            HttpServletResponse raw = (HttpServletResponse) getResponse();
            raw.setContentLength(body.length);            // ★ 修正 Content-Length
            raw.getOutputStream().write(body);
            raw.getOutputStream().flush();
        }
    }
}

// Filter 中使用：记录响应日志 / 敏感词替换 / 统一加密
@Override
public void doFilter(ServletRequest req, ServletResponse resp, FilterChain chain) throws ... {
    CachedResponseWrapper wrapper = new CachedResponseWrapper((HttpServletResponse) resp);
    chain.doFilter(req, wrapper);                          // ★ 业务写入 wrapper 的缓冲区

    // 后处理
    String body = wrapper.getContentAsString();
    log.debug("响应体：{}", abbreviate(body, 2000));
    String sanitized = sensitiveWordFilter.replace(body);   // 敏感词替换
    if (!sanitized.equals(body)) {
        resp.getOutputStream().write(sanitized.getBytes(StandardCharsets.UTF_8));
    } else {
        wrapper.copyBodyToResponse();                       // ★ 原样写回
    }
}
```

> 【坑】**响应包装后必须修正 `Content-Length`**，否则浏览器可能截断或等待（内容长度变了但头没变）。另外，**大响应体（如文件下载）不要包装**（会把整个文件读进内存 → OOM），要根据 Content-Type 判断跳过。

### 1.8 Spring Boot 内置的常用 Filter

| Filter | 作用 | 配置 |
| --- | --- | --- |
| `CharacterEncodingFilter` | ★ 统一请求/响应编码为 UTF-8 | `server.servlet.encoding.*`（默认开启） |
| `HiddenHttpMethodFilter` | 用 `_method` 参数模拟 PUT/DELETE（表单只支持 GET/POST） | `spring.mvc.hiddenmethod.filter.enabled`（**Boot 2.2+ 默认关闭**） |
| `FormContentFilter` | 让 PUT/PATCH/DELETE 也能解析表单参数 | 默认开启 |
| `OrderedRequestContextFilter` | 绑定 `RequestContextHolder`（让非 Web 层能拿到 request） | 默认开启 |
| `WsFilter` | WebSocket 支持 | 引入 websocket starter |
| `SpringSecurityFilterChain` | ★ Spring Security 的全部安全逻辑（一个 Filter 内部包含 15+ 个 Filter） | 引入 security starter |
| `OncePerRequestFilter` | ★ **抽象基类**：保证一次请求只执行一次（即使 forward/include） | 自定义 Filter 建议继承它 |

```yaml
# application.yml 中的 Filter 配置
server:
  servlet:
    encoding:
      charset: UTF-8
      enabled: true
      force: true                    # ★ 强制请求和响应都用 UTF-8
      force-request: true
      force-response: true
spring:
  mvc:
    hiddenmethod:
      filter:
        enabled: true                # 启用 PUT/DELETE 表单模拟
```

```java
/**
 * ★ 自定义 Filter 建议继承 OncePerRequestFilter（Spring 提供）
 * 保证「一次请求只执行一次」，即使发生 forward/include/error 派发
 */
@Component
public class MyFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        // 前置
        chain.doFilter(request, response);
        // 后置
    }

    /** ★ 可以控制「哪些请求跳过这个 Filter」 */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri.startsWith("/static/")
            || uri.equals("/health")
            || uri.startsWith("/actuator/");
    }

    /** 异步请求是否也执行 */
    @Override
    protected boolean shouldNotFilterAsyncDispatch() { return false; }
    @Override
    protected boolean shouldNotFilterErrorDispatch() { return false; }
}
```

```java
// OncePerRequestFilter 的原理
@Override
public final void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
    HttpServletRequest httpRequest = (HttpServletRequest) request;
    // ★ 用 request attribute 标记「已经过滤过」
    String alreadyFilteredAttributeName = getAlreadyFilteredAttributeName();
    boolean hasAlreadyFilteredAttribute = request.getAttribute(alreadyFilteredAttributeName) != null;

    if (skipDispatch(httpRequest) || shouldNotFilter(httpRequest) || hasAlreadyFilteredAttribute) {
        chain.doFilter(request, response);                      // 已过滤 → 直接放行
    } else {
        request.setAttribute(alreadyFilteredAttributeName, Boolean.TRUE);   // 打标记
        try {
            doFilterInternal(httpRequest, (HttpServletResponse) response, chain);
        } finally {
            request.removeAttribute(alreadyFilteredAttributeName);          // ★ 清除标记
        }
    }
}
```

## 2. Filter vs Interceptor（拦截器）★★★★★

**这是 Spring MVC 面试的必考题。两者都能拦截请求，但层次和能力完全不同。**

| 对比项 | **Filter**（过滤器） | **HandlerInterceptor**（拦截器） |
| --- | --- | --- |
| 规范来源 | **Servlet 规范**（jakarta.servlet） | **Spring MVC 框架** |
| 依赖 | 只依赖 Servlet 容器 | 依赖 Spring MVC |
| 执行位置 | **Servlet 容器层**（DispatcherServlet 之前） | **Spring MVC 层**（DispatcherServlet 之内，Handler 前后） |
| 能否获取 Handler 信息 | ❌ 不知道会执行哪个 Controller 方法 | ✅ **能拿到 `HandlerMethod`**（方法、注解、参数） |
| 能否使用 Spring Bean | ⚠️ 可以（`@Component` + `@Autowired`，但要注意加载顺序） | ✅ **原生支持**（本身就是 Spring Bean） |
| 能否操作 ModelAndView | ❌ | ✅ `postHandle` 可修改 ModelAndView |
| 拦截粒度 | URL 模式（`/*`、`/api/*`、`*.jsp`） | URL 模式 + **可基于注解判断** |
| 三个方法 | `doFilter`（一个方法，靠 chain.doFilter 分前后） | `preHandle` / `postHandle` / `afterCompletion`（**三个独立方法**） |
| 异常处理 | 需自己 try-catch | `afterCompletion` 能拿到异常 |
| 典型用途 | 编码、CORS、XSS、请求包装、日志、限流 | **登录鉴权、权限校验、日志（含方法信息）、性能监控** |

```
执行顺序（完整链路）：

浏览器请求
   ↓
① Tomcat Connector（接收、解析 HTTP）
   ↓
② Filter 链（前置）        ← CharacterEncodingFilter、CorsFilter、XssFilter、SecurityFilterChain...
   ↓
③ DispatcherServlet
   ↓
④ HandlerMapping（找到 Controller 方法）
   ↓
⑤ Interceptor.preHandle    ← ★ 此时已知 HandlerMethod，可读取方法上的注解
   ↓
⑥ HandlerAdapter → 参数解析 → ★ Controller 方法执行 → 返回值处理
   ↓
⑦ Interceptor.postHandle   ← ★ 可修改 ModelAndView（@ResponseBody 时意义不大）
   ↓
⑧ 视图渲染 / JSON 序列化
   ↓
⑨ Interceptor.afterCompletion  ← ★ 无论成功失败都执行（资源清理）
   ↓
⑩ Filter 链（后置）
   ↓
浏览器响应

★ 异常发生时：
   Controller 抛异常 → HandlerExceptionResolver（@ControllerAdvice）处理
   → Interceptor.afterCompletion(ex) → Filter 的后置代码（如果 chain.doFilter 在 try 中）
   注意：postHandle 【不会】执行！
```

```java
// ─── HandlerInterceptor 完整示例 ───
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtService jwtService;
    private final UserService userService;

    /** ★ 前置：返回 false 则中断（不执行 Controller 和后续拦截器） */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {
        // ① 放行预检请求
        if (CorsUtils.isPreFlightRequest(request)) return true;

        // ② ★ 放行标注了 @IgnoreAuth 的方法（利用 HandlerMethod 拿到注解！Filter 做不到）
        if (handler instanceof HandlerMethod hm) {
            if (hm.hasMethodAnnotation(IgnoreAuth.class)
                || hm.getBeanType().isAnnotationPresent(IgnoreAuth.class)) {
                return true;
            }

            // ③ 权限校验（读取方法上的 @RequiresPermission 注解）
            RequiresPermission rp = hm.getMethodAnnotation(RequiresPermission.class);
            if (rp != null) {
                LoginUser user = UserContext.get();
                if (user == null || !user.hasAnyPermission(rp.value())) {
                    writeError(response, 403, "无访问权限");
                    return false;                        // ★ 中断
                }
            }
        } else {
            // handler 不是 HandlerMethod（如静态资源的 ResourceHttpRequestHandler）
            return true;
        }

        // ④ 记录开始时间（供 afterCompletion 计算耗时）
        request.setAttribute("startTime", System.currentTimeMillis());
        return true;
    }

    /** ★ 后置：Controller 成功执行后、视图渲染前（★ 抛异常时不执行） */
    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response,
                           Object handler, ModelAndView modelAndView) {
        // 可以修改 ModelAndView（加公共数据）
        if (modelAndView != null) {
            modelAndView.addObject("currentUser", UserContext.get());
        }
        // @ResponseBody 场景下 modelAndView 为 null，这里通常做不了什么
    }

    /** ★ 完成后：无论成功/异常都执行（★ 资源清理的正确位置） */
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        Long start = (Long) request.getAttribute("startTime");
        long cost = start == null ? 0 : System.currentTimeMillis() - start;

        if (ex != null) {
            log.error("请求异常 {} {} cost={}ms", request.getMethod(), request.getRequestURI(), cost, ex);
        } else if (cost > 2000) {
            log.warn("慢请求 {} {} cost={}ms handler={}", request.getMethod(),
                     request.getRequestURI(), cost,
                     handler instanceof HandlerMethod hm ? hm.getMethod().getName() : "-");
        }

        // ★★ 清理 ThreadLocal（防止线程池复用导致数据串号和内存泄漏）
        UserContext.clear();
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(JSON.toJSONString(Result.failed(status, message)));
    }
}

// ─── 注册拦截器 ───
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final LogInterceptor logInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(logInterceptor)
                .addPathPatterns("/**")                      // ★ 拦截路径
                .excludePathPatterns("/login", "/register",   // ★ 排除路径
                                     "/static/**", "/error",
                                     "/actuator/**", "/doc.html", "/webjars/**")
                .order(1);                                    // ★ 顺序（小的先执行）

        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/public/**", "/api/login")
                .order(2);
    }
}
```

**选择原则：**

| 需求 | 选择 |
| --- | --- |
| 修改请求/响应本身（编码、包装、压缩、加密） | **Filter**（Interceptor 拿不到原始流） |
| CORS 跨域 | **Filter**（必须在 Security 之前） |
| XSS/SQL 注入过滤 | **Filter** |
| 全局限流（含静态资源） | **Filter** |
| **需要读取 Controller 方法的注解** | **Interceptor** ★ |
| 登录鉴权、权限校验 | **Interceptor**（能用 HandlerMethod）或 Spring Security |
| 业务日志（记录调用了哪个方法） | **Interceptor** |
| 修改 ModelAndView | **Interceptor**（postHandle） |
| 与 Spring MVC 无关的全局处理 | **Filter** |
| 需要 Spring Bean 且顺序可控 | 两者都可以（Interceptor 更自然） |

## 3. Listener 监听器 ★★★★

**Listener 基于「观察者模式」，监听 Web 应用中「域对象的生命周期事件」和「Session 属性变化」。**

### 3.1 六大监听器接口（Servlet 规范）

| 接口 | 监听对象 | 方法 | 典型用途 |
| --- | --- | --- | --- |
| **`ServletContextListener`** | ServletContext（应用） | `contextInitialized` / `contextDestroyed` | ★ **应用启动初始化、关闭清理**（最常用） |
| `ServletContextAttributeListener` | ServletContext 属性 | `attributeAdded` / `Removed` / `Replaced` | 监控全局属性变化 |
| **`HttpSessionListener`** | Session | `sessionCreated` / `sessionDestroyed` | ★ **在线人数统计、单点登录控制** |
| `HttpSessionAttributeListener` | Session 属性 | `attributeAdded` / `Removed` / `Replaced` | 监控登录状态变化 |
| `HttpSessionBindingListener` | **对象自身**被绑定/解绑到 Session | `valueBound` / `valueUnbound` | ★ 对象自己感知（无需注册监听器） |
| `HttpSessionActivationListener` | Session 钝化/活化 | `sessionWillPassivate` / `sessionDidActivate` | Session 持久化到磁盘/迁移 |
| `ServletRequestListener` | 请求 | `requestInitialized` / `requestDestroyed` | 请求级别的统计、上下文初始化 |
| `ServletRequestAttributeListener` | 请求属性 | `attributeAdded` / `Removed` / `Replaced` | 监控 request 属性 |

```java
// ─── 1. ServletContextListener（★ 应用启动/关闭钩子）───
@WebListener                                  // 或 @Component（Spring Boot）
@Slf4j
public class AppLifecycleListener implements ServletContextListener {

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        ServletContext ctx = sce.getServletContext();
        log.info("★ 应用启动：{}", ctx.getContextPath());
        log.info("  Servlet 规范版本：{}.{}", ctx.getMajorVersion(), ctx.getMinorVersion());
        log.info("  服务器：{}", ctx.getServerInfo());
        log.info("  物理路径：{}", ctx.getRealPath("/"));

        // 初始化全局资源
        ctx.setAttribute("startTime", LocalDateTime.now());
        ctx.setAttribute("onlineCount", new AtomicInteger(0));

        // ★ 可以做：缓存预热、字典加载、定时任务启动、MQ 消费者启动
        // warmUpCache();
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        log.info("★ 应用关闭，开始清理资源...");
        // ★ 优雅关闭：关线程池、刷盘、注销注册中心、关连接池
        // executor.shutdown(); awaitTermination();
        // registry.deregister();
    }
}

// ─── 2. HttpSessionListener（在线人数统计）───
@WebListener
@Slf4j
public class OnlineUserListener implements HttpSessionListener {

    @Override
    public void sessionCreated(HttpSessionEvent se) {
        AtomicInteger online = (AtomicInteger) se.getSession()
                .getServletContext().getAttribute("onlineCount");
        int count = online.incrementAndGet();
        log.info("新会话创建，当前在线：{}", count);
        // ★ 也可记录到 Redis：用于分布式环境的在线统计
    }

    @Override
    public void sessionDestroyed(HttpSessionEvent se) {
        HttpSession session = se.getSession();
        AtomicInteger online = (AtomicInteger) session.getServletContext().getAttribute("onlineCount");
        int count = online.decrementAndGet();
        log.info("会话销毁，当前在线：{}", count);

        // ★ 单点登录：用户下线时清理其登录状态
        LoginUser user = (LoginUser) session.getAttribute("loginUser");
        if (user != null) {
            onlineUserRegistry.remove(user.getUserId(), session.getId());
        }
    }
}

// ─── 3. HttpSessionBindingListener（★ 对象自己感知，无需注册）───
/**
 * 实现此接口的对象，被 setAttribute 到 Session 时会收到 valueBound 通知，
 * 被 removeAttribute / Session 失效时会收到 valueUnbound 通知
 * ★ 优势：无需在 web.xml 或 @WebListener 注册，对象自带监听能力
 */
@Slf4j
public class OnlineUser implements HttpSessionBindingListener {

    private final Long userId;
    private final String username;
    private final LocalDateTime loginTime;
    private static final Set<Long> ONLINE_USERS = ConcurrentHashMap.newKeySet();

    public OnlineUser(Long userId, String username) {
        this.userId = userId;
        this.username = username;
        this.loginTime = LocalDateTime.now();
    }

    @Override
    public void valueBound(HttpSessionBindingEvent event) {
        ONLINE_USERS.add(userId);                          // ★ 上线
        log.info("用户 {} 上线，当前在线 {} 人", username, ONLINE_USERS.size());
    }

    @Override
    public void valueUnbound(HttpSessionBindingEvent event) {
        ONLINE_USERS.remove(userId);                       // ★ 下线（Session 超时/失效/移除时自动触发）
        log.info("用户 {} 下线，当前在线 {} 人", username, ONLINE_USERS.size());
    }

    public static Set<Long> getOnlineUsers() { return ONLINE_USERS; }
    public static int getOnlineCount() { return ONLINE_USERS.size(); }
}

// 使用：登录时放入 Session 即自动统计
session.setAttribute("onlineUser", new OnlineUser(userId, username));
// 登出或超时 → valueUnbound 自动调用 → 在线数自动减少（★ 不会漏）

// ─── 4. HttpSessionAttributeListener ───
@WebListener
public class SessionAttributeListener implements HttpSessionAttributeListener {
    @Override public void attributeAdded(HttpSessionBindingEvent e) {
        log.info("Session 添加属性 {}={}", e.getName(), e.getValue());
    }
    @Override public void attributeRemoved(HttpSessionBindingEvent e) { }
    @Override public void attributeReplaced(HttpSessionBindingEvent e) {
        log.info("Session 属性 {} 从 {} 改为 {}", e.getName(), e.getValue(),
                 e.getSession().getAttribute(e.getName()));
    }
}

// ─── 5. ServletRequestListener（每个请求都触发）───
@WebListener
public class RequestCounterListener implements ServletRequestListener {
    private static final LongAdder TOTAL = new LongAdder();

    @Override
    public void requestInitialized(ServletRequestEvent sre) {
        TOTAL.increment();
        // ★ 初始化请求上下文（如 RequestContextHolder 就是靠类似的机制）
        HttpServletRequest req = (HttpServletRequest) sre.getServletRequest();
        MDC.put("requestUri", req.getRequestURI());
    }

    @Override
    public void requestDestroyed(ServletRequestEvent sre) {
        MDC.clear();                                  // ★ 清理，防串号
    }
    public static long getTotal() { return TOTAL.sum(); }
}

// ─── 6. Session 钝化/活化（持久化到磁盘，重启后恢复）───
public class CartItem implements Serializable, HttpSessionActivationListener {
    private static final long serialVersionUID = 1L;
    @Override public void sessionWillPassivate(HttpSessionEvent se) {
        log.info("Session 即将钝化（写入磁盘）");        // ★ 可以在此释放不可序列化的资源
    }
    @Override public void sessionDidActivate(HttpSessionEvent se) {
        log.info("Session 已活化（从磁盘恢复）");        // ★ 可以在此重建资源
    }
}
// 配置 Tomcat 的 PersistentManager 才会钝化：
// <Manager className="org.apache.catalina.session.PersistentManager" maxIdleBackup="60">
//   <Store className="org.apache.catalina.session.FileStore" directory="sessions"/>
// </Manager>
```

**注册方式：**

```java
// 方式 1：@WebListener（需 @ServletComponentScan）
@WebListener
public class MyListener implements ServletContextListener { }

// 方式 2：@Component（★ Spring Boot 推荐，能注入 Bean）
@Component
@RequiredArgsConstructor
public class MyListener implements ServletContextListener {
    private final CacheService cacheService;              // ★ 可以注入
    @Override public void contextInitialized(ServletContextEvent sce) {
        cacheService.warmUp();
    }
}

// 方式 3：ServletListenerRegistrationBean（可控制顺序）
@Bean
public ServletListenerRegistrationBean<MyListener> myListener() {
    return new ServletListenerRegistrationBean<>(new MyListener());
}

// 方式 4：web.xml
<listener>
    <listener-class>com.example.MyListener</listener-class>
</listener>

// 方式 5：ServletContext 编程式注册（必须在容器初始化阶段，如 ServletContainerInitializer）
servletContext.addListener(MyListener.class);
```

### 3.2 Listener vs Spring 的事件机制

| | Servlet Listener | Spring `ApplicationListener` / `@EventListener` |
| --- | --- | --- |
| 规范 | Servlet 规范 | Spring 框架 |
| 监听的事件 | ServletContext/Session/Request 的生命周期 | **Spring 容器和应用的业务事件** |
| 触发时机 | 容器管理 | Spring 容器管理 |
| 能否异步 | ❌ | ✅ `@Async` |
| 能否自定义事件 | ❌ | ✅ `ApplicationEvent` 子类 |
| 典型用途 | 在线人数、应用启停 | ★ **业务解耦**（下单后发短信、注册后发欢迎邮件） |

```java
// Spring 的事件机制（★ 业务解耦的主流方案，比 Servlet Listener 常用得多）
// ① 定义事件
public record OrderCreatedEvent(Long orderId, Long userId, BigDecimal amount) { }
// 或继承 ApplicationEvent（Spring 4.2+ 支持任意对象作为事件）

// ② 发布事件
@Service
@RequiredArgsConstructor
public class OrderService {
    private final ApplicationEventPublisher publisher;

    @Transactional
    public void createOrder(OrderDTO dto) {
        Order order = save(dto);
        // ★ 发布事件（解耦：OrderService 不需要知道谁关心这个事件）
        publisher.publishEvent(new OrderCreatedEvent(order.getId(), order.getUserId(), order.getAmount()));
    }
}

// ③ 监听事件
@Component
@Slf4j
public class OrderEventListener {

    /** 同步监听（在发布者线程中执行，会影响事务和响应时间） */
    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        log.info("订单创建：{}", event.orderId());
    }

    /** ★ 异步监听（推荐：不阻塞主流程） */
    @Async("notifyExecutor")
    @EventListener
    public void sendSmsAsync(OrderCreatedEvent event) {
        smsService.send(event.userId(), "订单已创建");
    }

    /** ★ 事务提交后才执行（★ 重要：避免事务回滚了但短信已发） */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void afterOrderCommitted(OrderCreatedEvent event) {
        pointsService.addPoints(event.userId(), event.amount());
    }

    /** 事务回滚时执行 */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
    public void afterRollback(OrderCreatedEvent event) {
        log.warn("订单创建失败，回滚：{}", event.orderId());
    }

    /** 带条件过滤 */
    @EventListener(condition = "#event.amount > 1000")
    public void onBigOrder(OrderCreatedEvent event) {
        riskService.review(event.orderId());
    }

    /** 有返回值：处理结果会作为新事件发布 */
    @EventListener
    public OrderPaidEvent onOrderCreated(OrderCreatedEvent event) {
        return new OrderPaidEvent(event.orderId());
    }
}
```

> 【实践】**业务事件用 Spring 的 `@EventListener`/`@TransactionalEventListener`，Web 容器生命周期用 Servlet Listener。**
> ★ `@TransactionalEventListener(AFTER_COMMIT)` 是解决「事务提交了但消息已发出」问题的标准方案，比在 Service 中直接调 MQ 更安全。详见 [[后端/消息队列/消息可靠性与常见问题]]。

## 4. 会话管理 ★★★★★

### 4.1 Session 的生命周期

```
① 创建：首次调用 request.getSession()（或 getSession(true)）
        → 容器创建 HttpSession 对象，生成唯一 SessionID
        → 触发 HttpSessionListener.sessionCreated()
        → 响应 Set-Cookie: JSESSIONID=xxx
② 使用：后续请求带 Cookie: JSESSIONID=xxx
        → 容器据此找到对应 Session
        → ★ 每次访问都重置「最后访问时间」（超时计时重新开始）
③ 销毁（三种情况）：
   a. 超时：超过 maxInactiveInterval 未被访问（默认 30 分钟）
   b. 主动失效：session.invalidate()（★ 登出时必须调用）
   c. 容器关闭：应用卸载/服务器关闭（可配置持久化到磁盘）
        → 触发 HttpSessionListener.sessionDestroyed()
        → 触发所有属性的 HttpSessionBindingListener.valueUnbound()
```

```java
// 超时配置
session.getMaxInactiveInterval();              // 秒，默认 1800（30 分钟）
session.setMaxInactiveInterval(3600);           // 1 小时
// web.xml
<session-config><session-timeout>30</session-timeout></session-config>   <!-- 单位：分钟 -->
// Spring Boot
server.servlet.session.timeout=30m
// Tomcat 全局（conf/web.xml）
<session-config><session-timeout>30</session-timeout></session-config>
```

> 【坑】**`session.invalidate()` 后不能再使用 session**：会抛 `IllegalStateException`。登出流程应该是：
> ```java
> // ① 先取出需要的信息（如记录登出日志）
> LoginUser user = (LoginUser) session.getAttribute("loginUser");
> // ② 清理业务数据
> onlineRegistry.remove(user.getUserId());
> // ③ 最后 invalidate
> session.invalidate();
> // ④ 清除 Cookie（★ invalidate 不会清除浏览器端的 Cookie！）
> Cookie cookie = new Cookie("JSESSIONID", null);
> cookie.setMaxAge(0);
> cookie.setPath(request.getContextPath().isEmpty() ? "/" : request.getContextPath());
> response.addCookie(cookie);
> ```

### 4.2 URL 重写（Cookie 被禁用时的 Session 保持）

```java
// 如果浏览器禁用了 Cookie，SessionID 可以通过 URL 参数传递
String url = response.encodeURL("/shopping/cart");
// Cookie 可用 → 返回 "/shopping/cart"
// Cookie 不可用 → 返回 "/shopping/cart;jsessionid=A1B2C3D4"

String redirectUrl = response.encodeRedirectURL("/login");   // 重定向也要编码

// 链接中必须用 encodeURL 包装
<a href="<%= response.encodeURL("/product?id=1") %>">商品</a>
<form action="<%= response.encodeURL("/cart/add") %>">
```

**URL 重写的风险（★ 现代应用应禁用）：**
1. **SessionID 泄漏**：出现在浏览器历史、服务器访问日志、Referer 头、分享链接中 → **会话劫持**。
2. 爬虫会把带 SessionID 的 URL 当作不同页面，产生大量重复内容。
3. 用户分享带 SessionID 的链接，别人打开会「变成」这个用户。

```java
// ★ 禁用 URL 重写（只用 Cookie）
// web.xml
<session-config>
    <tracking-mode>COOKIE</tracking-mode>          <!-- ★ 只允许 Cookie，禁用 URL -->
</session-config>

// 代码方式（Servlet 3.0+）
servletContext.setSessionTrackingModes(EnumSet.of(SessionTrackingMode.COOKIE));

// Spring Boot
server.servlet.session.tracking-modes: cookie
```

### 4.3 分布式 Session 方案对比 ★★★★★

见 [[后端/JavaWeb/Web基础与HTTP协议]] 2.6 节的详细对比。这里补充实现细节：

```java
// ─── 方案 A：Spring Session + Redis（★ 改造成本最低）───
// 依赖
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>

// 配置
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800,
                        redisNamespace = "myapp:session")
// 或 Spring Boot 自动配置（只需 yml）
spring:
  session:
    store-type: redis
    timeout: 30m
    redis:
      namespace: myapp:session
      flush-mode: on_save            # ★ on_save（性能好）/ immediate（实时，多一次 Redis 调用）
      save-mode: on_set_attribute    # ★ 只在 setAttribute 时保存（性能优化）
      cleanup-cron: "0 * * * * *"    # 过期 Session 的清理任务

// ★ 业务代码零改动！session.setAttribute 自动写入 Redis
// Redis 中的数据结构：
//   spring:session:sessions:<id>              Hash（存储 Session 属性）
//   spring:session:sessions:expires:<id>      String（过期标记，TTL = session timeout）
//   spring:session:expirations:<timestamp>    Set（按过期时间分组，用于清理）

// 序列化问题（★ 常见坑）
@Bean
public RedisSerializer<Object> springSessionDefaultRedisSerializer() {
    // 默认用 JdkSerializationRedisSerializer（要求属性实现 Serializable，且可读性差）
    // ★ 改用 Jackson（可读性好，无需 Serializable，但要注意多态类型）
    ObjectMapper mapper = new ObjectMapper();
    mapper.activateDefaultTyping(mapper.getPolymorphicTypeValidator(),
                                 ObjectMapper.DefaultTyping.NON_FINAL);
    return new GenericJackson2JsonRedisSerializer(mapper);
}
```

```java
// ─── 方案 B：JWT 无状态（★ 新项目首选）───
// 服务端不存 Session，用户信息放在 Token 中（签名保护）
// 详见 [[后端/JavaWeb/JWT认证与Web安全]]

// ─── 方案 C：Tomcat Session 复制（不推荐）───
// conf/server.xml 的 Cluster 配置，Session 变化时广播到集群其他节点
// 缺点：网络开销 O(n²)、大 Session 时性能急剧下降、节点数不宜超过 4~6

// ─── 方案 D：Nginx Sticky Session（ip_hash 或 nginx-sticky-module）───
upstream backend {
    sticky;                                   # 需第三方模块，用 Cookie 标记节点
    server 10.0.1.10:8080;
    server 10.0.1.11:8080;
}
// 缺点：节点宕机则该节点上的所有 Session 丢失；负载可能不均
```

**四种方案的选型：**

| 方案 | 改造成本 | 扩展性 | 可靠性 | 性能 | 推荐度 |
| --- | --- | --- | --- | --- | --- |
| **JWT 无状态** | 中（改认证逻辑） | ★★★★★ | ★★★★（无法主动失效是短板） | ★★★★★ | ⭐⭐⭐⭐⭐ 新项目 |
| **Spring Session + Redis** | ★ **低（零代码改动）** | ★★★★★ | ★★★★★ | ★★★★ | ⭐⭐⭐⭐⭐ 存量改造 |
| Session 复制 | 低 | ★★ | ★★★★ | ★★ | ⭐ 不推荐 |
| Sticky Session | 低 | ★★★ | ★★（节点宕机丢会话） | ★★★★ | ⭐⭐ 临时方案 |

### 4.4 会话安全（防会话劫持与固定攻击）★★★★★

```java
// ─── 攻击 1：会话劫持（Session Hijacking）───
// 攻击者窃取 SessionID（XSS 读 Cookie、网络嗅探、URL 重写泄漏）→ 冒充用户

// 防护：
// ① Cookie 加 HttpOnly（防 XSS 读取）+ Secure（防明文传输）+ SameSite（防 CSRF）
server.servlet.session.cookie.http-only=true
server.servlet.session.cookie.secure=true
server.servlet.session.cookie.same-site=lax
// ② 禁用 URL 重写（tracking-modes: cookie）
// ③ 全站 HTTPS（防嗅探）+ HSTS
// ④ 缩短 Session 超时时间
// ⑤ ★ 绑定客户端特征（IP / User-Agent 指纹）—— 变化则强制重新登录
@Component
public class SessionFingerprintInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse resp, Object handler) {
        HttpSession session = req.getSession(false);
        if (session == null) return true;

        String fingerprint = DigestUtils.md5Hex(
                req.getRemoteAddr() + "|" + abbreviate(req.getHeader("User-Agent"), 100));
        String stored = (String) session.getAttribute("_fingerprint");

        if (stored == null) {
            session.setAttribute("_fingerprint", fingerprint);       // 首次记录
        } else if (!stored.equals(fingerprint)) {
            log.warn("会话指纹变化，可能存在会话劫持。session={}, old={}, new={}",
                     session.getId(), stored, fingerprint);
            session.invalidate();                                    // ★ 强制失效
            throw new BusinessException(ResultCode.SESSION_INVALID, "登录状态异常，请重新登录");
        }
        return true;
    }
}
// ⚠️ 注意：绑定 IP 对移动网络（IP 频繁变化）用户体验差，实践中常只绑 User-Agent 或做「变化时二次验证」

// ─── 攻击 2：会话固定（Session Fixation）───
// 攻击者先获取一个合法 SessionID（如自己访问网站得到），诱导受害者用这个 SessionID 登录，
// 受害者登录后，攻击者用同一个 SessionID 就获得了受害者的登录态

// ★ 防护：登录成功后【必须更换 SessionID】
@PostMapping("/login")
public Result<Void> login(@RequestBody LoginDTO dto, HttpServletRequest request) {
    LoginUser user = authService.authenticate(dto);

    // ★★ 会话固定防护：迁移 Session（保留数据，换新 ID）
    HttpSession oldSession = request.getSession(false);
    Map<String, Object> attributes = new HashMap<>();
    if (oldSession != null) {
        Enumeration<String> names = oldSession.getAttributeNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            attributes.put(name, oldSession.getAttribute(name));
        }
        oldSession.invalidate();                                     // ★ 销毁旧 Session
    }
    HttpSession newSession = request.getSession(true);                // ★ 创建新 Session（新 ID）
    attributes.forEach(newSession::setAttribute);                     // 恢复属性
    newSession.setAttribute("loginUser", user);

    // Spring Security 已自动做这个（SessionFixationProtectionStrategy）
    // 也可用 Spring 的工具：
    // request.changeSessionId();      // ★ Servlet 3.1+ 原生 API（最简洁，保留属性只换 ID）

    return Result.success();
}

// Servlet 3.1+ 的原生 API（★ 推荐，一行搞定）
request.changeSessionId();       // 更换 SessionID，保留所有属性

// Spring Security 自动处理（默认开启）
http.sessionManagement(session -> session
    .sessionFixation(SessionFixationConfigurer::changeSessionId)   // ★ 默认策略
    .maximumSessions(1)                                             // 单点登录
    .maxSessionsPreventsLogin(false)                                // false=踢掉旧会话，true=拒绝新登录
    .expiredUrl("/login?expired"));

// ─── 攻击 3：会话重放 / CSRF ───
// 详见 [[后端/JavaWeb/JWT认证与Web安全]]

// ─── 单点登录控制（一个账号只能一处登录）───
@Component
@RequiredArgsConstructor
public class SingleLoginService {
    private final StringRedisTemplate redis;

    /** 登录时：记录 userId → sessionId 映射，踢掉旧会话 */
    public void onLogin(Long userId, String newSessionId) {
        String key = "login:session:" + userId;
        String oldSessionId = redis.opsForValue().get(key);
        if (oldSessionId != null && !oldSessionId.equals(newSessionId)) {
            // ★ 标记旧会话为「被踢下线」
            redis.opsForValue().set("login:kicked:" + oldSessionId, "1", Duration.ofHours(1));
            log.info("用户 {} 在其他地方登录，旧会话 {} 被踢下线", userId, oldSessionId);
        }
        redis.opsForValue().set(key, newSessionId, Duration.ofMinutes(30));
    }

    /** 每次请求校验 */
    public boolean isKicked(String sessionId) {
        return Boolean.TRUE.equals(redis.hasKey("login:kicked:" + sessionId));
    }
}
```

### 4.5 Session vs Token 的深度对比

见 [[后端/JavaWeb/Web基础与HTTP协议]] 2.6 节。补充「什么时候必须用 Session」：

| 需求 | Session 更合适 | Token（JWT）更合适 |
| --- | --- | --- |
| 服务端主动踢人下线 | ✅ 直接 invalidate | ❌ 需要黑名单（Redis） |
| 实时修改用户权限立即生效 | ✅ 改 Session 即可 | ❌ Token 未过期前权限不变 |
| 购物车等大量临时数据 | ✅ 存服务端，客户端只存 ID | ❌ Token 会变得很大 |
| 分布式/微服务 | ❌ 需 Session 共享 | ✅ 天然无状态 |
| 前后端分离/移动端 | ❌ 跨域 Cookie 麻烦 | ✅ 放 Header |
| 高并发（减少服务端存储） | ❌ 每个用户占内存 | ✅ 无状态 |
| 安全审计（谁在线） | ✅ 容易统计 | ❌ 需要额外记录 |

> 【实践结论】**2024+ 的主流是 JWT + Redis 黑名单**：用 JWT 做无状态认证（解决分布式问题），用 Redis 存「已登出的 Token」和「权限版本号」来解决 JWT 无法主动失效的问题。详见 [[后端/JavaWeb/JWT认证与Web安全]]。

## 5. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | Filter 拦截后忘记 `return` | 已重定向又执行业务，`Response already committed` | 拦截后立即 return |
| 2 | Filter 中定义可变实例变量 | 数据串号（单例多线程） | 用局部变量 |
| 3 | 忘记调用 `chain.doFilter()` | 请求挂起/无响应 | 必须放行（除拦截场景） |
| 4 | 后置逻辑不在 finally 中 | 异常时清理代码不执行 | `try &#123; chain.doFilter &#125; finally &#123; 清理 &#125;` |
| 5 | MDC/ThreadLocal 未清理 | 日志 traceId 串号、内存泄漏 | finally 中 `MDC.clear()` |
| 6 | `@WebFilter` 期望控制顺序 | 顺序不可控 | 用 `FilterRegistrationBean.setOrder()` |
| 7 | `@WebFilter` 未加 `@ServletComponentScan` | Filter 不生效 | 启动类加注解，或用 `@Component` |
| 8 | 默认只拦截 REQUEST | forward/error 时 Filter 不生效 | 配 `dispatcherTypes` |
| 9 | 异步 Servlet 未配 `asyncSupported` | 启动异步时报错 | **整条链路**都要 asyncSupported |
| 10 | 包装表单请求的 InputStream | `getParameter()` 返回 null | 只包装 JSON/二进制请求 |
| 11 | 响应包装后未修正 Content-Length | 浏览器截断/挂起 | 写回时重设 Content-Length |
| 12 | 包装文件下载响应 | 大文件全读入内存 → OOM | 按 Content-Type 跳过包装 |
| 13 | 输入过滤防 XSS | 容易被绕过、破坏合法数据 | **输出编码**（OWASP Encoder）+ CSP |
| 14 | `session.invalidate()` 后继续用 session | `IllegalStateException` | 先取数据，最后 invalidate |
| 15 | 登出未清 Cookie | 浏览器仍带旧 SessionID | 同时删除 Cookie（Path 要一致） |
| 16 | 登录后不换 SessionID | **会话固定攻击** | `request.changeSessionId()` |
| 17 | 启用 URL 重写 | SessionID 泄漏到日志/Referer | `tracking-modes: cookie` |
| 18 | Session Cookie 未设 HttpOnly/Secure | XSS 窃取、明文传输 | 全部开启 |
| 19 | Session 存大对象 | 内存暴涨（分布式下 Redis 压力大） | 只存标识，数据放缓存/DB |
| 20 | Spring Session 属性未实现 Serializable | 序列化失败 | 实现 Serializable 或改 JSON 序列化器 |
| 21 | Session 超时设置过长 | 内存占用高、安全风险 | 30 分钟（按业务调整） |
| 22 | Interceptor 的 `postHandle` 期望处理异常 | 抛异常时不执行 | 清理逻辑放 `afterCompletion` |
| 23 | Filter 中抛业务异常无处理 | 返回容器的 HTML 错误页（非 JSON） | 捕获后写 JSON，或交给 `@ControllerAdvice`（需注意 Filter 异常不经过它） |
| 24 | `@ControllerAdvice` 处理不了 Filter 的异常 | 全局异常处理器失效 | Filter 在 DispatcherServlet 之前，需自己 try-catch 或配 `ErrorController` |
| 25 | 用 Servlet Listener 做业务解耦 | 事件粒度太粗 | 用 Spring `@EventListener`/`@TransactionalEventListener` |
| 26 | Filter 顺序：CORS 在鉴权之后 | 预检请求返回 401，前端报 CORS 错误 | CORS Filter 设最高优先级 |

---

## 关联笔记

- 上一篇：[[后端/JavaWeb/JSP-EL-JSTL与前后端分离]]
- 下一篇：[[后端/JavaWeb/JWT认证与Web安全]]
- 相关：[[后端/JavaWeb/Servlet核心与生命周期]]、[[后端/JavaWeb/Web基础与HTTP协议]]（Cookie/Session/CORS 原理）
- Spring 层：[[后端/Spring/SpringMVC参数绑定与异常处理]]（拦截器详解）、[[后端/SpringBoot/整合Web开发]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
