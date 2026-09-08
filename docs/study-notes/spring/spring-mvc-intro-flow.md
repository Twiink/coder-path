---
title: "SpringMVC入门与执行流程"
aliases:
  - "DispatcherServlet"
  - "Spring MVC"
  - "九大组件"
tags:
  - "后端"
  - "java"
  - "spring"
  - "springmvc"
  - "面试"
category: "后端"
folder: "Spring"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Spring/SpringMVC参数绑定与异常处理]]"
  - "[[后端/JavaWeb/Servlet核心与生命周期]]"
  - "[[后端/Spring/SSM整合实战]]"
  - "[[后端/SpringBoot/SpringBoot入门与项目搭建]]"
created: 2026-09-07
updated: 2026-09-07
---

# Spring MVC 入门与执行流程

## 1. Spring MVC 概述

**Spring MVC 是基于 Servlet 的 Web 框架，采用「前端控制器模式」—— 用一个 `DispatcherServlet` 统一接收所有请求，再分发给具体的处理器（Controller 方法）。**

### 1.1 MVC 设计模式

| 层 | 职责 | Spring MVC 对应 |
| --- | --- | --- |
| **Model**（模型） | 数据与业务逻辑 | Entity / DTO / Service / `Model` 对象 |
| **View**（视图） | 展示数据 | JSP / Thymeleaf / FreeMarker / **JSON**（前后端分离） |
| **Controller**（控制器） | 接收请求、调用 Model、选择 View | ★ `@Controller` / `@RestController` |

```
传统 MVC（JSP 时代）：
浏览器 ──请求──> Controller ──> Service/DAO ──> Model(数据)
                    │                              │
                    └──────> View(JSP) <───────────┘
                                │
浏览器 <────── HTML ────────────┘

现代 MVC（前后端分离）：
浏览器/APP ──JSON请求──> RestController ──> Service/DAO ──> Model
                            │                                │
                            └──── HttpMessageConverter ───────┘
                                        │
浏览器/APP <──── JSON ──────────────────┘
（View 层退化为「JSON 序列化」，真正的视图由前端框架渲染）
```

### 1.2 Spring MVC 的特点

| 特点 | 说明 |
| --- | --- |
| **基于 Servlet** | `DispatcherServlet` 是唯一入口（前端控制器模式） |
| **注解驱动** | `@RequestMapping`、`@GetMapping`、`@RequestParam` 等，无需实现接口 |
| **松耦合的组件化设计** | 九大组件都可替换（策略模式） |
| **强大的参数绑定** | 自动类型转换、数据校验、复合对象绑定 |
| **灵活的视图解析** | 支持 JSP、Thymeleaf、JSON、XML、PDF、Excel |
| **完善的异常处理** | `@ControllerAdvice` + `@ExceptionHandler` |
| **拦截器机制** | `HandlerInterceptor`（比 Filter 更贴近业务） |
| **RESTful 支持** | `@PathVariable`、`@ResponseBody`、内容协商 |
| **异步支持** | `Callable`、`DeferredResult`、`CompletableFuture`、SSE |
| **与 Spring 无缝集成** | 直接用 IoC、AOP、事务 |

### 1.3 与其他 Web 框架对比

| | Spring MVC | Struts2 | JAX-RS（Jersey/RESTEasy） | Spring WebFlux |
| --- | --- | --- | --- | --- |
| 核心 | DispatcherServlet | Filter（StrutsPrepareAndExecuteFilter） | Servlet/容器 | Reactor + Netty |
| 模型 | ★ 主流 | 已淘汰（多次安全漏洞） | REST 标准规范 | 响应式 |
| 线程模型 | 一请求一线程（Servlet） | 一请求一线程 | 一请求一线程 | ★ 事件循环（非阻塞） |
| 学习曲线 | 低 | 中 | 低 | ★ 高（响应式思维） |
| 生态 | ★★ 最全 | 衰退 | 一般 | 增长中 |
| 适用 | ★ 绝大多数 Web 应用 | 老项目 | 纯 REST API 服务 | 高并发 IO 密集、流式 |

## 2. 核心架构：九大组件 ★★★★★

`DispatcherServlet` 通过「九大组件」完成请求处理，每个组件都是接口，可替换（策略模式）。

```java
// DispatcherServlet 的九个成员变量（★ 必背）
/** 文件上传解析器 */
private MultipartResolver multipartResolver;
/** ★ 处理器映射器：URL → Handler */
private HandlerMapping handlerMapping;
/** ★ 处理器适配器：调用 Handler（因为 Handler 类型多样，需要适配） */
private HandlerAdapter handlerAdapter;
/** Handler 异常解析器 */
private HandlerExceptionResolver handlerExceptionResolver;
/** 请求到视图名的翻译器（如 /user → user/list） */
private RequestToViewNameTranslator viewNameTranslator;
/** 本地化解析器（国际化） */
private LocaleResolver localeResolver;
/** ★ 视图解析器：视图名 → View 对象 */
private ViewResolver viewResolver;
/** Flash 属性管理器（重定向间传递数据） */
private FlashMapManager flashMapManager;
/** 主题解析器（换肤，已少用） */
private ThemeResolver themeResolver;
```

| # | 组件 | 接口 | 默认实现 | 职责 |
| --- | --- | --- | --- | --- |
| 1 | **文件上传解析器** | `MultipartResolver` | `StandardServletMultipartResolver` | 解析 `multipart/form-data` 请求 |
| 2 | ★ **处理器映射器** | `HandlerMapping` | `RequestMappingHandlerMapping` | **URL → Handler（Controller 方法）** |
| 3 | ★ **处理器适配器** | `HandlerAdapter` | `RequestMappingHandlerAdapter` | **调用 Handler**（适配不同类型） |
| 4 | **异常解析器** | `HandlerExceptionResolver` | `ExceptionHandlerExceptionResolver` | 异常 → ModelAndView / JSON |
| 5 | **视图名翻译器** | `RequestToViewNameTranslator` | `DefaultRequestToViewNameTranslator` | URL → 默认视图名 |
| 6 | **本地化解析器** | `LocaleResolver` | `AcceptHeaderLocaleResolver` | 解析客户端语言（i18n） |
| 7 | ★ **视图解析器** | `ViewResolver` | `InternalResourceViewResolver`、`ThymeleafViewResolver` | **视图名 → View 对象** |
| 8 | **Flash 管理器** | `FlashMapManager` | `SessionFlashMapManager` | 重定向间传递一次性数据 |
| 9 | **主题解析器** | `ThemeResolver` | `FixedThemeResolver` | 换肤（已少用） |

**为什么需要 HandlerAdapter（适配器模式）？**

```java
// Handler 的类型是多样的（Spring MVC 支持多种处理器写法）：
// ① @RequestMapping 注解的方法（HandlerMethod）★ 99% 用这个
// ② 实现 Controller 接口的类（老式）
public class MyController implements Controller {
    public ModelAndView handleRequest(HttpServletRequest req, HttpServletResponse resp) { }
}
// ③ 实现 HttpRequestHandler 接口的类（静态资源）
public class MyHandler implements HttpRequestHandler {
    public void handleRequest(HttpServletRequest req, HttpServletResponse resp) { }
}
// ④ Servlet 实例

// DispatcherServlet 不想为每种 Handler 写 if-else，所以用【适配器模式】：
HandlerAdapter ha = getHandlerAdapter(handler);       // 找到支持该 handler 的适配器
ha.handle(request, response, handler);                 // 统一调用

// 适配器通过 supports() 判断能否处理
public interface HandlerAdapter {
    boolean supports(Object handler);                  // ★ 是否支持该 Handler
    ModelAndView handle(HttpServletRequest req, HttpServletResponse resp, Object handler);
    long getLastModified(HttpServletRequest req, Object handler);
}
```

## 3. 请求处理的完整流程 ★★★★★（面试核心）

### 3.1 流程图

```
① 浏览器发起请求
        ↓
② Tomcat 接收，匹配到 DispatcherServlet（映射为 "/"）
        ↓
③ DispatcherServlet.service() → processRequest() → doService() → ★ doDispatch()
        ↓
④ 【MultipartResolver】检查是否文件上传请求 → 是则包装为 MultipartHttpServletRequest
        ↓
⑤ 【HandlerMapping】★ 根据 URL 查找 Handler
        → 返回 HandlerExecutionChain（Handler + 匹配的拦截器链）
        → RequestMappingHandlerMapping 内部维护一个 Map<RequestMappingInfo, HandlerMethod>
        ↓
⑥ 【HandlerAdapter】★ 找到支持该 Handler 的适配器
        → RequestMappingHandlerAdapter
        ↓
⑦ 处理 Last-Modified（GET/HEAD 请求，协商缓存）→ 未修改则返回 304
        ↓
⑧ 【HandlerInterceptor.preHandle()】★ 拦截器前置处理
        → 返回 false 则中断（不执行 Handler 和后续拦截器）
        → 逆序调用 triggerAfterCompletion（已执行 preHandle 的）
        ↓
⑨ 【HandlerAdapter.handle()】★★ 执行 Controller 方法
        ├── HandlerMethodArgumentResolver：★ 解析方法参数
        │     @RequestParam → request.getParameter()
        │     @PathVariable → 从 URI 模板变量取
        │     @RequestBody  → HttpMessageConverter 反序列化 JSON
        │     @ModelAttribute → 表单绑定到对象
        │     Model/HttpServletRequest 等 → 直接注入
        ├── 数据校验（@Valid / @Validated）→ 失败抛 MethodArgumentNotValidException
        ├── ★ 反射调用你的 Controller 方法（invocableMethod.invokeAndHandle）
        └── HandlerMethodReturnValueHandler：★ 处理返回值
              @ResponseBody → HttpMessageConverter 序列化为 JSON，直接写入响应
              String（视图名）→ 封装为 ModelAndView
              ModelAndView → 直接使用
              void → 视为已自行处理响应
        ↓
⑩ 【HandlerInterceptor.postHandle()】拦截器后置处理（★ 逆序执行）
        → 可修改 ModelAndView（@ResponseBody 时为 null，意义不大）
        → ★ Controller 抛异常时【不执行】
        ↓
⑪ 【processDispatchResult】处理结果
        ├── 有异常 → 【HandlerExceptionResolver】★ 解析异常
        │     ExceptionHandlerExceptionResolver → @ExceptionHandler / @ControllerAdvice
        │     ResponseStatusExceptionResolver → @ResponseStatus
        │     DefaultHandlerExceptionResolver → Spring MVC 标准异常（404/405/400）
        │     → 都没有则抛给容器（web.xml 的 error-page）
        └── 无异常 → 处理 ModelAndView
              ├── ModelAndView 为空（@ResponseBody 已写完响应）→ 结束
              └── 有视图名 → 【ViewResolver】解析为 View 对象
                              → View.render(model, request, response) 渲染 HTML
        ↓
⑫ 【HandlerInterceptor.afterCompletion()】★ 无论成功失败都执行（逆序）
        → 资源清理、ThreadLocal 清除、日志记录
        ↓
⑬ 响应返回浏览器
```

### 3.2 doDispatch 源码精读

```java
// DispatcherServlet.doDispatch() —— ★ Spring MVC 的心脏
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) throws Exception {
    HttpServletRequest processedRequest = request;
    HandlerExecutionChain mappedHandler = null;
    boolean multipartRequestParsed = false;
    WebAsyncManager asyncManager = WebAsyncUtils.getAsyncManager(request);

    try {
        ModelAndView mv = null;
        Exception dispatchException = null;

        try {
            // ═══ ① 文件上传检查 ═══
            processedRequest = checkMultipart(request);
            multipartRequestParsed = (processedRequest != request);

            // ═══ ② ★ 查找 Handler（Controller 方法）+ 拦截器链 ═══
            mappedHandler = getHandler(processedRequest);
            if (mappedHandler == null) {
                noHandlerFound(processedRequest, response);       // 404
                return;
            }

            // ═══ ③ ★ 查找 HandlerAdapter ═══
            HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());

            // ═══ ④ 处理 Last-Modified（协商缓存）═══
            String method = request.getMethod();
            boolean isGet = HttpMethod.GET.matches(method);
            if (isGet || HttpMethod.HEAD.matches(method)) {
                long lastModified = ha.getLastModified(request, mappedHandler.getHandler());
                if (new ServletWebRequest(request, response).checkNotModified(lastModified) && isGet) {
                    return;                                        // ★ 304，直接返回
                }
            }

            // ═══ ⑤ ★ 拦截器前置处理 ═══
            if (!mappedHandler.applyPreHandle(processedRequest, response)) {
                return;                                            // 返回 false → 中断
            }

            // ═══ ⑥ ★★ 执行 Handler（你的 Controller 方法）═══
            mv = ha.handle(processedRequest, response, mappedHandler.getHandler());

            if (asyncManager.isConcurrentHandlingStarted()) {
                return;                                            // 异步处理中，直接返回
            }

            applyDefaultViewName(processedRequest, mv);             // 没有视图名则用默认的

            // ═══ ⑦ ★ 拦截器后置处理 ═══
            mappedHandler.applyPostHandle(processedRequest, response, mv);

        } catch (Exception ex) {
            dispatchException = ex;                                 // ★ 异常暂存
        } catch (Throwable err) {
            dispatchException = new NestedServletException("Handler dispatch failed", err);
        }

        // ═══ ⑧ ★★ 处理结果（渲染视图 or 解析异常）═══
        processDispatchResult(processedRequest, response, mappedHandler, mv, dispatchException);

    } catch (Exception ex) {
        triggerAfterCompletion(processedRequest, response, mappedHandler, ex);
    } catch (Throwable err) {
        triggerAfterCompletion(...);
    } finally {
        if (asyncManager.isConcurrentHandlingStarted()) {
            if (mappedHandler != null) mappedHandler.applyAfterConcurrentHandlingStarted(...);
        } else {
            if (multipartRequestParsed) cleanupMultipart(processedRequest);
        }
    }
}

// ═══ getHandler：遍历所有 HandlerMapping 找第一个匹配的 ═══
protected HandlerExecutionChain getHandler(HttpServletRequest request) throws Exception {
    if (this.handlerMappings != null) {
        for (HandlerMapping mapping : this.handlerMappings) {        // ★ 按顺序尝试
            HandlerExecutionChain handler = mapping.getHandler(request);
            if (handler != null) return handler;
        }
    }
    return null;
}
// HandlerMapping 的顺序（Ordered）：
// 1. RequestMappingHandlerMapping       ← ★ 处理 @RequestMapping（最常用）
// 2. WelcomePageHandlerMapping           ← 首页（index.html）
// 3. BeanNameUrlHandlerMapping           ← Bean 名称以 / 开头
// 4. RouterFunctionMapping               ← 函数式路由
// 5. SimpleUrlHandlerMapping             ← ★ 静态资源（/**）
// 6. （最后）DefaultServletHandler        ← 交给容器默认 Servlet

// ═══ getHandlerAdapter：遍历所有适配器找支持该 Handler 的 ═══
protected HandlerAdapter getHandlerAdapter(Object handler) throws ServletException {
    if (this.handlerAdapters != null) {
        for (HandlerAdapter adapter : this.handlerAdapters) {
            if (adapter.supports(handler)) return adapter;           // ★ supports() 判断
        }
    }
    throw new ServletException("No adapter for handler [" + handler + "]");
}

// ═══ processDispatchResult：结果处理 ═══
private void processDispatchResult(HttpServletRequest request, HttpServletResponse response,
        HandlerExecutionChain mappedHandler, ModelAndView mv, Exception exception) throws Exception {

    boolean errorView = false;

    // ① ★ 有异常 → 用 HandlerExceptionResolver 解析
    if (exception != null) {
        if (exception instanceof ModelAndViewDefiningException mde) {
            mv = mde.getModelAndView();
        } else {
            Object handler = (mappedHandler != null ? mappedHandler.getHandler() : null);
            mv = processHandlerException(request, response, handler, exception);   // ★ 关键
            errorView = (mv != null);
        }
    }

    // ② ★ 渲染视图（mv 为 null 说明是 @ResponseBody，已自行写完响应）
    if (mv != null && !mv.wasCleared()) {
        render(mv, request, response);                              // ★ 视图渲染
        if (errorView) WebUtils.clearErrorRequestAttributes(request);
    }

    // ③ ★ 拦截器的 afterCompletion（无论成功失败）
    if (mappedHandler != null) {
        mappedHandler.triggerAfterCompletion(request, response, null);
    }
}

// ═══ render：视图渲染 ═══
protected void render(ModelAndView mv, HttpServletRequest request, HttpServletResponse response) {
    // ① 确定 Locale
    Locale locale = ...;
    // ② ★ 解析视图名 → View 对象
    View view;
    if (mv.isReference()) {
        view = resolveViewName(mv.getViewName(), mv.getModelInternal(), locale, request);
    } else {
        view = (View) mv.getView();
    }
    if (view == null) {
        throw new ServletException("Could not resolve view with name '" + mv.getViewName() + "'");
    }
    // ③ ★ 渲染（View 自己决定怎么渲染）
    view.render(mv.getModelInternal(), request, response);
}
```

### 3.3 HandlerExecutionChain 与拦截器的执行

```java
// HandlerExecutionChain = Handler + 拦截器数组
public class HandlerExecutionChain {
    private final Object handler;                     // ★ HandlerMethod（Controller 方法）
    private final List<HandlerInterceptor> interceptorList;
    private int interceptorIndex = -1;                 // ★ 记录 preHandle 执行到哪（用于逆序 afterCompletion）

    /** 前置处理：正序执行，任一返回 false 则中断 */
    boolean applyPreHandle(HttpServletRequest request, HttpServletResponse response) throws Exception {
        for (int i = 0; i < this.interceptorList.size(); i++) {
            HandlerInterceptor interceptor = this.interceptorList.get(i);
            if (!interceptor.preHandle(request, response, this.handler)) {
                triggerAfterCompletion(request, response, null);     // ★ 逆序调用已执行的 afterCompletion
                return false;
            }
            this.interceptorIndex = i;                                // ★ 记录进度
        }
        return true;
    }

    /** 后置处理：★ 逆序执行（洋葱模型的返回路径） */
    void applyPostHandle(HttpServletRequest request, HttpServletResponse response, ModelAndView mv) {
        for (int i = this.interceptorList.size() - 1; i >= 0; i--) {
            this.interceptorList.get(i).postHandle(request, response, this.handler, mv);
        }
    }

    /** 完成后处理：★ 逆序执行，只执行到 interceptorIndex（preHandle 成功的） */
    void triggerAfterCompletion(HttpServletRequest request, HttpServletResponse response, Exception ex) {
        for (int i = this.interceptorIndex; i >= 0; i--) {
            HandlerInterceptor interceptor = this.interceptorList.get(i);
            try {
                interceptor.afterCompletion(request, response, this.handler, ex);
            } catch (Throwable ex2) {
                logger.error("HandlerInterceptor.afterCompletion threw exception", ex2);
            }
        }
    }
}
```

```
拦截器的洋葱模型（3 个拦截器）：

I1.preHandle → I2.preHandle → I3.preHandle
                                      ↓
                              ★ Controller 方法
                                      ↓
I1.postHandle ← I2.postHandle ← I3.postHandle      （★ 逆序）
                                      ↓
I1.afterCompletion ← I2.afterCompletion ← I3.afterCompletion   （★ 逆序）

若 I2.preHandle 返回 false：
I1.preHandle → I2.preHandle(false)
                     ↓
              I1.afterCompletion（★ 只调用已成功的 I1）
              Controller 和 I3 都不执行
```

## 4. HandlerMapping 与 URL 匹配 ★★★★★

### 4.1 RequestMappingHandlerMapping 的注册与查找

```java
// ─── 启动时：扫描并注册所有 @RequestMapping ───
// RequestMappingHandlerMapping.afterPropertiesSet() → initHandlerMethods()
protected void initHandlerMethods() {
    for (String beanName : getCandidateBeanNames()) {          // 遍历所有 Bean
        if (!beanName.startsWith(SCOPED_TARGET_NAME_PREFIX)) {
            processCandidateBean(beanName);
        }
    }
}

protected void processCandidateBean(String beanName) {
    Class<?> beanType = obtainApplicationContext().getType(beanName);
    if (beanType != null && isHandler(beanType)) {              // ★ 是否 @Controller/@RequestMapping
        detectHandlerMethods(beanName);                            // ★ 扫描所有方法
    }
}

protected void detectHandlerMethods(Object handler) {
    Class<?> handlerType = ...;
    Map<Method, T> methods = MethodIntrospector.selectMethods(handlerType,
        (MethodIntrospector.MetadataLookup<T>) method -> getMappingForMethod(method, handlerType));
    methods.forEach((method, mapping) -> {
        Method invocableMethod = AopUtils.selectInvocableMethod(method, handlerType);
        registerHandlerMethod(handler, invocableMethod, mapping);   // ★ 注册到 registry
    });
}

// ─── registry 的数据结构 ───
// MappingRegistry 内部：
//   Map<T, HandlerMethod> mappingLookup              mapping → 方法
//   MultiValueMap<String, T> urlLookup                URL → mappings（★ 快速查找）
//   Map<String, List<HandlerMethod>> nameLookup       名称 → 方法
//   Map<HandlerMethod, CorsConfiguration> corsLookup   CORS 配置

// ─── 运行时：查找 Handler ───
protected HandlerExecutionChain getHandlerInternal(HttpServletRequest request) {
    String lookupPath = initLookupPath(request);              // ★ 提取查找路径（去掉 contextPath）
    LookupPath mappingLookupPath = ...;

    // ① ★ 先尝试【精确匹配】（直接查 Map，O(1)，最快）
    HandlerMethod handlerMethod = lookupHandlerMethod(lookupPath, request);

    // ② 找不到则尝试去掉后缀再匹配（.html、.json 等）
    ...

    return (handlerMethod != null ? handlerMethod.createWithResolvedBean() : null);
}

protected HandlerMethod lookupHandlerMethod(String lookupPath, HttpServletRequest request) {
    List<Match> matches = new ArrayList<>();
    // ① 直接路径匹配（urlLookup 是 Map，O(1)）
    List<T> directPathMatches = this.mappingRegistry.getMappingsByDirectPath(lookupPath);
    if (directPathMatches != null) {
        addMatchingMappings(directPathMatches, matches, request);
    }
    if (matches.isEmpty()) {
        // ② 全量匹配（有通配符的路径，需要遍历 + 模式匹配）
        addMatchingMappings(this.mappingRegistry.getRegistrations().keySet(), matches, request);
    }
    if (!matches.isEmpty()) {
        // ③ ★ 多个匹配时排序，取最优的
        Match bestMatch = matches.get(0);
        if (matches.size() > 1) {
            Comparator<Match> comparator = new MatchComparator(getMappingComparator(request));
            matches.sort(comparator);
            bestMatch = matches.get(0);
            // 如果前两个得分相同 → 抛 IllegalStateException: Ambiguous handler methods
            Match secondBestMatch = matches.get(1);
            if (comparator.compare(bestMatch, secondBestMatch) == 0) {
                throw new IllegalStateException("Ambiguous handler methods mapped for '" + lookupPath + "'");
            }
        }
        return bestMatch.getHandlerMethod();
    }
    return null;
}
```

### 4.2 URL 匹配规则与优先级

```java
// ─── @RequestMapping 的路径模式 ───
@GetMapping("/users/{id}")                    // ★ 路径变量（精确度最高）
@GetMapping("/users/{id:\\d+}")                // 带正则约束的路径变量
@GetMapping("/files/{*path}")                  // ★ 捕获剩余全部路径（Spring 5+）
@GetMapping("/api/*/detail")                   // 单层通配
@GetMapping("/static/**")                      // ★ 多层通配
@GetMapping(value = "/data", params = "type=1")    // ★ 按请求参数区分
@GetMapping(value = "/data", headers = "X-Version=2")  // 按请求头区分
@GetMapping(value = "/data", produces = "application/json")   // ★ 按 Accept 区分（内容协商）
@GetMapping(value = "/data", consumes = "application/xml")    // 按 Content-Type 区分
@GetMapping(value = "/data", method = {RequestMethod.GET, RequestMethod.HEAD})

// ─── 匹配优先级（★ 越具体优先级越高）───
// 1. 精确路径          /users/list          ★ 最高
// 2. 带正则的变量      /users/{id:\d+}
// 3. 路径变量          /users/{id}
// 4. 单层通配          /users/*
// 5. 多层通配          /users/**            ★ 最低
```

```java
// ─── 冲突示例 ───
@GetMapping("/users/{id}")        public User byId(@PathVariable Long id) { }
@GetMapping("/users/list")        public List<User> list() { }
// 请求 /users/list → ★ 匹配 list()（精确路径优先于路径变量）
// 请求 /users/123  → 匹配 byId()

// ─── 歧义报错 ───
@GetMapping("/users/{id}")        public User a(@PathVariable Long id) { }
@GetMapping("/users/{name}")      public User b(@PathVariable String name) { }
// 启动或请求时报错：Ambiguous handler methods mapped for '/users/123'
// ★ 两个映射的「模式」完全等价，Spring 无法区分

// ─── PathPatternParser vs AntPathMatcher ───
// Spring 5.3+ 默认用 PathPatternParser（★ 性能更好，预解析模式）
// AntPathMatcher 是老实现（每次匹配都解析模式字符串）
// 配置：
spring:
  mvc:
    pathmatch:
      matching-strategy: path_pattern_parser     # ★ Spring Boot 2.6+ 默认
      # matching-strategy: ant_path_matcher       # 老行为（某些库如 Swagger 2.x 需要）
// ⚠️ Spring Boot 2.6+ 改为 path_pattern_parser 后，
//   springfox（老版 Swagger）会报错，需改回 ant_path_matcher 或换 Knife4j/SpringDoc
```

### 4.3 HandlerMethod（Controller 方法的封装）

```java
// HandlerMethod 封装了「Bean + Method」，是 @RequestMapping 方法在 Spring 内部的表示
public class HandlerMethod {
    private final Object bean;                  // Controller 实例（或 beanName）
    private final BeanFactory beanFactory;
    private final Class<?> beanType;             // Controller 类
    private final Method method;                 // ★ 方法对象
    private final Method bridgedMethod;          // 桥接方法处理
    private final MethodParameter[] parameters;   // ★ 参数列表（含注解、类型信息）
    private final int responseStatus;
}

// 在拦截器/切面中使用（★ 非常实用）
@Component
public class PermissionInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse resp, Object handler) {
        if (!(handler instanceof HandlerMethod hm)) return true;      // 静态资源等直接放行

        // ★ 读取 Controller 方法上的注解
        RequiresPermission anno = hm.getMethodAnnotation(RequiresPermission.class);
        if (anno == null) {
            // 类上的注解
            anno = hm.getBeanType().getAnnotation(RequiresPermission.class);
        }
        if (anno != null && !hasPermission(anno.value())) {
            throw new BusinessException(ResultCode.FORBIDDEN);
        }

        // 其他有用信息
        Class<?> controllerClass = hm.getBeanType();        // Controller 类
        Method method = hm.getMethod();                       // 方法
        String methodName = hm.getMethod().getName();
        MethodParameter[] params = hm.getMethodParameters();   // 参数
        log.info("调用 {}.{}", controllerClass.getSimpleName(), methodName);
        return true;
    }
}
```

## 5. 返回值处理与视图解析 ★★★★★

### 5.1 HandlerMethodReturnValueHandler（返回值处理器）

**Spring MVC 用「策略模式」处理各种返回类型，每种类型对应一个 ReturnValueHandler。**

| 返回值类型 | 处理器 | 行为 |
| --- | --- | --- |
| `@ResponseBody` / `@RestController` 的方法 | `RequestResponseBodyMethodProcessor` | ★ **序列化为 JSON 直接写入响应**（无视图） |
| `String` | `ViewNameMethodReturnValueHandler` | 作为**视图名** |
| `void` / `null` | — | 视为已自行处理响应（或配合 `@ResponseStatus`） |
| `ModelAndView` | `ModelAndViewMethodReturnValueHandler` | 直接使用 |
| `Model` / `ModelMap` | `ModelMethodProcessor` | 只加数据，视图名由 URL 推断 |
| `View` | `ViewMethodReturnValueHandler` | 直接使用 View |
| `HttpEntity<T>` / `ResponseEntity<T>` | `HttpEntityMethodProcessor` | ★ 设置状态码、头、体 |
| `Callable<T>` | `CallableMethodReturnValueHandler` | ★ 异步（容器线程立即释放） |
| `DeferredResult<T>` | `DeferredResultMethodReturnValueHandler` | ★ 异步 |
| `CompletableFuture<T>` | 同上（包装） | ★ 异步 |
| `WebAsyncTask<T>` | `WebAsyncTaskMethodReturnValueHandler` | 异步 + 超时配置 |
| `SseEmitter` | `SseEmitterReturnValueHandler` | ★ SSE 推送 |
| `StreamingResponseBody` | `StreamingResponseBodyReturnValueHandler` | 流式响应（大文件） |
| `@ModelAttribute` 方法 | `ModelAttributeMethodProcessor` | 加到 Model，视图名由 URL 推断 |

```java
// ─── 各种返回值示例 ───
@RestController                                    // = @Controller + @ResponseBody
@RequestMapping("/api/users")
public class UserApiController {

    // ① 返回对象 → JSON（★ 最常见）
    @GetMapping("/{id}")
    public UserVO getById(@PathVariable Long id) {
        return userService.get(id);                 // 自动序列化为 JSON
    }

    // ② 返回统一响应体
    @GetMapping("/list")
    public Result<List<UserVO>> list() {
        return Result.success(userService.list());
    }

    // ③ ★ ResponseEntity：完全控制 HTTP 响应
    @PostMapping
    public ResponseEntity<UserVO> create(@RequestBody @Valid UserCreateDTO dto) {
        UserVO vo = userService.create(dto);
        return ResponseEntity
                .status(HttpStatus.CREATED)                          // 201
                .header("Location", "/api/users/" + vo.getId())       // RESTful 规范
                .header("X-Trace-Id", TraceContext.get())
                .body(vo);
    }

    // ④ 无返回体
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)            // 204
    public void delete(@PathVariable Long id) { userService.delete(id); }

    // ⑤ 返回 HttpEntity（只要头不要体）
    @GetMapping("/check")
    public HttpEntity<Void> check() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Status", "OK");
        return new HttpEntity<>(headers);
    }
}

@Controller                                        // ★ 返回视图（前后端不分离）
@RequestMapping("/admin/users")
public class UserViewController {

    // ① 返回 String（视图名）
    @GetMapping
    public String list(Model model) {
        model.addAttribute("users", userService.list());
        return "user/list";                         // ★ 视图名 → ViewResolver 解析
    }

    // ② 返回 ModelAndView
    @GetMapping("/detail/{id}")
    public ModelAndView detail(@PathVariable Long id) {
        ModelAndView mav = new ModelAndView("user/detail");
        mav.addObject("user", userService.get(id));
        mav.addObject("title", "用户详情");
        return mav;
    }

    // ③ 返回 void（视图名由 URL 推断：/admin/users/detail → admin/users/detail）
    @GetMapping("/edit/{id}")
    public void edit(@PathVariable Long id, Model model) {
        model.addAttribute("user", userService.get(id));
        // 视图名自动推断为 "admin/users/edit/{id}"？实际是 URL 去掉变量后的路径
    }

    // ④ ★ 重定向与转发
    @PostMapping("/save")
    public String save(@Valid UserDTO dto, RedirectAttributes ra) {
        userService.save(dto);
        ra.addFlashAttribute("message", "保存成功");      // ★ Flash 属性（存 Session，取出即删）
        ra.addAttribute("id", dto.getId());               // 拼到 URL
        return "redirect:/admin/users/detail";             // ★ 302 重定向
        // return "forward:/admin/users/detail";           // ★ 服务端转发
    }

    // ⑤ 直接写响应（不经过视图解析）
    @GetMapping("/download/{id}")
    public void download(@PathVariable Long id, HttpServletResponse response) throws IOException {
        response.setContentType("application/octet-stream");
        response.setHeader("Content-Disposition", "attachment; filename=\"data.xlsx\"");
        response.getOutputStream().write(fileService.getBytes(id));
        // ★ 返回 void + 直接操作 response → Spring 认为已处理完毕
    }
}
```

### 5.2 HttpMessageConverter（★ JSON 序列化的核心）

```java
// HttpMessageConverter：HTTP 消息与 Java 对象的双向转换
public interface HttpMessageConverter<T> {
    boolean canRead(Class<?> clazz, MediaType mediaType);      // 能否读（反序列化）
    boolean canWrite(Class<?> clazz, MediaType mediaType);     // 能否写（序列化）
    Set<MediaType> getSupportedMediaTypes();
    T read(Class<? extends T> clazz, HttpInputMessage inputMessage);      // ★ 请求体 → 对象
    void write(T t, MediaType contentType, HttpOutputMessage outputMessage);  // ★ 对象 → 响应体
}
```

**Spring 内置的转换器：**

| Converter | 处理的 Content-Type | 说明 |
| --- | --- | --- |
| **`MappingJackson2HttpMessageConverter`** ★ | `application/json` | **默认**，Jackson 序列化 |
| `MappingJackson2XmlHttpMessageConverter` | `application/xml` | Jackson 的 XML |
| `GsonHttpMessageConverter` | `application/json` | 需引入 Gson |
| `StringHttpMessageConverter` | `text/plain`、`*/*` | ★ 字符串直接输出 |
| `ByteArrayHttpMessageConverter` | `application/octet-stream` | 字节数组（文件下载） |
| `ResourceHttpMessageConverter` | `*/*` | `Resource` 对象（文件下载） |
| `ResourceRegionHttpMessageConverter` | `*/*` | ★ 分段传输（视频播放、断点续传） |
| `FormHttpMessageConverter` | `application/x-www-form-urlencoded`、`multipart/form-data` | 表单 |
| `AllEncompassingFormHttpMessageConverter` | 同上 | 增强版（支持 JSON part） |

```java
// ─── 自定义 Jackson 配置（★ 生产必配）───
@Configuration
public class JacksonConfig {

    /** 方式 1：定制全局 ObjectMapper（★ 推荐） */
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
        return builder -> {
            // ① 时间格式（★ JDK 8 时间类型）
            JavaTimeModule javaTimeModule = new JavaTimeModule();
            javaTimeModule.addSerializer(LocalDateTime.class,
                new LocalDateTimeSerializer(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            javaTimeModule.addDeserializer(LocalDateTime.class,
                new LocalDateTimeDeserializer(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            javaTimeModule.addSerializer(LocalDate.class,
                new LocalDateSerializer(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
            javaTimeModule.addSerializer(LocalTime.class,
                new LocalTimeSerializer(DateTimeFormatter.ofPattern("HH:mm:ss")));
            builder.modules(javaTimeModule);
            builder.featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);   // ★ 输出字符串而非时间戳

            // ② ★ Long 转 String（防止前端 JS 精度丢失！JS 的 Number 只有 53 位精度）
            SimpleModule longModule = new SimpleModule();
            longModule.addSerializer(Long.class, ToStringSerializer.instance);
            longModule.addSerializer(Long.TYPE, ToStringSerializer.instance);
            longModule.addSerializer(BigInteger.class, ToStringSerializer.instance);
            builder.modules(longModule);

            // ③ null 值处理
            builder.serializationInclusion(JsonInclude.Include.NON_NULL);      // 不输出 null 字段
            // NON_EMPTY：不输出空集合/空字符串
            // ALWAYS：全部输出（默认）

            // ④ 未知字段不报错（★ 前后端字段不同步时很重要）
            builder.featuresToDisable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

            // ⑤ 命名策略
            // builder.propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);   // camelCase → snake_case

            // ⑥ BigDecimal 不用科学计数法
            builder.serializerByType(BigDecimal.class, new BigDecimalSerializer());
        };
    }

    /** 方式 2：扩展已有的转换器（保留 Spring Boot 的默认配置） */
    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        // 找到 Jackson 转换器并修改
        converters.stream()
                .filter(c -> c instanceof MappingJackson2HttpMessageConverter)
                .map(c -> (MappingJackson2HttpMessageConverter) c)
                .forEach(c -> {
                    ObjectMapper mapper = c.getObjectMapper();
                    mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
                });
        // 添加自定义转换器到最前面（优先级最高）
        converters.add(0, new MyCustomConverter());
    }

    /** 方式 3：完全替换（★ 不推荐，会丢失 Spring Boot 的所有默认配置） */
    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
        converters.add(new MappingJackson2HttpMessageConverter(customMapper()));
    }
}

// BigDecimal 序列化（不用科学计数法）
public class BigDecimalSerializer extends JsonSerializer<BigDecimal> {
    @Override
    public void serialize(BigDecimal value, JsonGenerator gen, SerializerProvider sp) throws IOException {
        if (value != null) {
            gen.writeString(value.setScale(2, RoundingMode.HALF_UP).toPlainString());
        }
    }
}
```

```yaml
# application.yml 的简化配置
spring:
  jackson:
    date-format: yyyy-MM-dd HH:mm:ss          # ★ 只对 java.util.Date 生效，LocalDateTime 无效！
    time-zone: GMT+8
    default-property-inclusion: non_null       # 不输出 null
    serialization:
      write-dates-as-timestamps: false          # ★ 日期输出字符串而非时间戳
      fail-on-empty-beans: false
      indent-output: false                      # 生产不要美化输出（浪费带宽）
    deserialization:
      fail-on-unknown-properties: false         # ★ 未知字段不报错
      accept-single-value-as-array: true        # 单值可当数组
    property-naming-strategy: SNAKE_CASE        # 命名策略
    mapper:
      allow-coercion-of-scalars: true
```

### 5.3 ViewResolver（视图解析器）

```java
// 视图名 → View 对象
public interface ViewResolver {
    View resolveViewName(String viewName, Locale locale) throws Exception;
}

// ─── 常见实现 ───
// InternalResourceViewResolver   → JSP（转发到 JSP 页面）
// ThymeleafViewResolver          → Thymeleaf 模板
// FreeMarkerViewResolver         → FreeMarker
// ContentNegotiatingViewResolver → ★ 内容协商（根据 Accept 头选择 JSON/XML/HTML）
// BeanNameViewResolver           → 视图名 = Bean 名
// UrlBasedViewResolver           → 基类

// ─── Spring Boot 的自动配置 ───
// 引入 spring-boot-starter-thymeleaf → 自动配置 ThymeleafViewResolver
//   前缀 classpath:/templates/，后缀 .html
// 不引入任何模板引擎 + @RestController → 只有 JSON（MappingJackson2HttpMessageConverter）

// ─── 手动配置（传统 Spring MVC）───
@Bean
public ViewResolver viewResolver() {
    InternalResourceViewResolver resolver = new InternalResourceViewResolver();
    resolver.setPrefix("/WEB-INF/views/");        // ★ WEB-INF 下（外部无法直接访问）
    resolver.setSuffix(".jsp");
    resolver.setViewClass(JstlView.class);         // 支持 JSTL
    resolver.setContentType("text/html;charset=UTF-8");
    resolver.setOrder(1);                           // 多个解析器时的顺序
    return resolver;
}
// 视图名 "user/list" → /WEB-INF/views/user/list.jsp

// ─── 内容协商（同一 URL 返回不同格式）───
@GetMapping("/users/{id}")
public User getById(@PathVariable Long id) { return userService.get(id); }
// Accept: application/json  → 返回 JSON
// Accept: application/xml   → 返回 XML（需要 jackson-dataformat-xml）
// 配置：
spring.mvc.contentnegotiation.favor-parameter=true     # 支持 ?format=json
spring.mvc.contentnegotiation.parameter-name=format
```

## 6. 静态资源处理

```java
// ─── Spring Boot 的默认行为 ───
// 静态资源位置（按优先级）：
//   classpath:/META-INF/resources/
//   classpath:/resources/
//   classpath:/static/          ★ 最常用
//   classpath:/public/
// 访问：http://host:8080/js/app.js → classpath:/static/js/app.js

// ─── 自定义静态资源映射 ───
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // ① 映射本地目录（文件上传后的访问路径）
        registry.addResourceHandler("/upload/**")
                .addResourceLocations("file:/data/uploads/")          // ★ file: 前缀 = 文件系统
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic());

        // ② 映射 classpath
        registry.addResourceHandler("/static/**")
                .addResourceLocations("classpath:/static/");

        // ③ 多个位置（按顺序查找）
        registry.addResourceHandler("/images/**")
                .addResourceLocations("file:/data/images/", "classpath:/images/");

        // ④ WebJars（前端库的 jar 包管理）
        registry.addResourceHandler("/webjars/**")
                .addResourceLocations("classpath:/META-INF/resources/webjars/");

        // ⑤ 资源解析链（缓存、版本化）
        registry.addResourceHandler("/resources/**")
                .addResourceLocations("/public-resources/")
                .setCachePeriod(3600)
                .resourceChain(true)
                .addResolver(new VersionResourceResolver().addContentVersionStrategy("/**"));
                // ★ 内容版本化：/resources/app.js → /resources/app-a1b2c3.js（自动加 hash）
    }
}
```

```yaml
# application.yml
spring:
  web:
    resources:
      static-locations: classpath:/static/,classpath:/public/,file:/data/web/
      cache:
        period: 86400                     # 缓存秒数
        cachecontrol:
          max-age: 7d
          cache-public: true
      chain:
        strategy:
          content:
            enabled: true                 # ★ 内容 hash 版本化
            paths: /**
  mvc:
    static-path-pattern: /static/**       # ★ 静态资源的 URL 前缀
```

> 【坑】**Spring MVC 的 `/` 与 `/*` 的区别**：
> - `DispatcherServlet` 映射为 **`/`**：匹配所有**未被其他 Servlet 处理**的请求（不含 JSP，JSP 由容器的 JspServlet 处理）。
> - 映射为 **`/*`**：匹配所有请求，**包括 JSP**（会导致 JSP 也被 DispatcherServlet 处理而报错）。
> - Spring Boot 默认用 `/`。

## 7. Spring MVC 配置全览

```java
/**
 * ★ WebMvcConfigurer：Spring MVC 的配置入口（Boot 中扩展而非覆盖默认配置）
 */
@Configuration
@EnableWebMvc                                    // ⚠️ ★ 加了会【完全接管】，丢失 Boot 的自动配置！
                                                 //   Boot 项目中【不要加】，除非你完全清楚后果
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final LogInterceptor logInterceptor;

    // ① 拦截器
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(logInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/static/**", "/error")
                .order(1);
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/auth/**")
                .order(2);
    }

    // ② CORS 跨域
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("https://*.example.com")
                .allowedMethods("GET","POST","PUT","DELETE","OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Content-Disposition", "X-Trace-Id")
                .allowCredentials(true)
                .maxAge(3600);
    }

    // ③ 静态资源
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) { /* 见上文 */ }

    // ④ 视图控制器（简单页面直接映射，不写 Controller）
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/login").setViewName("login");
        registry.addRedirectViewController("/", "/index.html");
        registry.addViewController("/404").setViewName("error/404");
    }

    // ⑤ ★ 消息转换器（JSON 配置）
    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) { }
    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) { /* 推荐用这个 */ }

    // ⑥ ★ 参数解析器（自定义 @RequestParam 等的解析）
    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new CurrentUserArgumentResolver());        // 支持 @CurrentUser 注入登录用户
        resolvers.add(new ApiVersionArgumentResolver());
    }

    // ⑦ 返回值处理器
    @Override
    public void addReturnValueHandlers(List<HandlerMethodReturnValueHandler> handlers) { }

    // ⑧ ★ 类型转换器 / 格式化器（String ↔ Date、String ↔ Enum）
    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(new StringToDateConverter());
        registry.addFormatter(new DateFormatAnnotationFormatterFactory());
        registry.addConverterFactory(new StringToEnumConverterFactory());   // ★ 通用枚举转换
    }

    // ⑨ 内容协商
    @Override
    public void configureContentNegotiation(ContentNegotiationConfigurer configurer) {
        configurer.favorParameter(true)
                  .parameterName("format")
                  .defaultContentType(MediaType.APPLICATION_JSON)
                  .mediaType("json", MediaType.APPLICATION_JSON)
                  .mediaType("xml", MediaType.APPLICATION_XML);
    }

    // ⑩ 异步请求配置
    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setDefaultTimeout(30_000);                    // 异步超时
        configurer.setTaskExecutor(asyncExecutor());             // ★ 异步任务的线程池
        configurer.registerCallableInterceptors(new MyCallableInterceptor());
    }

    // ⑪ 路径匹配策略
    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.setUseTrailingSlashMatch(false);              // /users 与 /users/ 是否等价
        configurer.addPathPrefix("/api", c -> c.isAnnotationPresent(RestController.class));  // ★ 统一前缀
    }

    // ⑫ 验证器
    @Override
    public Validator getValidator() { return customValidator(); }
}

// ★ 自定义参数解析器示例：@CurrentUser 注入当前登录用户
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUser {
    boolean required() default true;
}

public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {
    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUser.class)
            && LoginUser.class.isAssignableFrom(parameter.getParameterType());
    }
    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mav,
                                  NativeWebRequest request, WebDataBinderFactory factory) {
        LoginUser user = UserContext.get();
        CurrentUser anno = parameter.getParameterAnnotation(CurrentUser.class);
        if (user == null && anno.required()) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        return user;
    }
}

// 使用（★ 方法签名极简，无需每次从 UserContext 取）
@GetMapping("/profile")
public Result<UserVO> profile(@CurrentUser LoginUser user) {
    return Result.success(UserVO.from(user));
}
```

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `@EnableWebMvc` 加在 Boot 项目中 | ★ 丢失所有自动配置（Jackson、静态资源、格式化全失效） | **Boot 项目不要加**，只用 `WebMvcConfigurer` |
| 2 | 九大组件记不全 | 面试答不上 | 记「三大核心」：HandlerMapping、HandlerAdapter、ViewResolver |
| 3 | `postHandle` 期望处理异常 | 抛异常时不执行 | 清理逻辑放 `afterCompletion` |
| 4 | 拦截器 `preHandle` 返回 false 未写响应 | 前端收到空响应 | 手动写响应体或抛异常 |
| 5 | HandlerMapping 顺序误解 | 静态资源被 Controller 拦截 | `/` 映射的 DispatcherServlet 优先级低于精确匹配 |
| 6 | `/` 与 `/*` 混淆 | JSP 404 或报错 | DispatcherServlet 用 `/` |
| 7 | URL 映射歧义 | `Ambiguous handler methods` | 避免等价模式（`/{id}` 与 `/{name}`） |
| 8 | Long 类型 ID 前端精度丢失 | ID 末几位变 0 | ★ Jackson 的 Long → String 序列化 |
| 9 | LocalDateTime 序列化为数组 | 前端拿到 `[2026,9,7,10,30]` | 注册 `JavaTimeModule` + 禁用 WRITE_DATES_AS_TIMESTAMPS |
| 10 | `spring.jackson.date-format` 对 LocalDateTime 无效 | 格式没变 | 该配置只作用于 `java.util.Date`，LocalDateTime 要用自定义 Serializer |
| 11 | 返回 null 期望是 JSON null | 无响应体 | `@ResponseBody` 返回 null 时响应体为空，用包装类 |
| 12 | 静态资源被拦截器拦截 | 静态资源 401/403 | `excludePathPatterns("/static/**")` |
| 13 | SPA 路由刷新 404 | `/user/123` 刷新报错 | 配置 forward 到 index.html |
| 14 | `configureMessageConverters` 覆盖默认配置 | 只支持自定义的格式 | 用 `extendMessageConverters` |
| 15 | PathPatternParser 与老 Swagger 冲突 | 启动报错 | `matching-strategy: ant_path_matcher` 或换 SpringDoc |
| 16 | `@ResponseBody` 的视图名不生效 | 返回字符串字面量而非视图 | `@ResponseBody` 就是返回值本身 |
| 17 | 异步方法未配线程池 | 用默认的 SimpleAsyncTaskExecutor（每次新建线程！） | `configureAsyncSupport` 设置 executor |
| 18 | Flash Attribute 在多次重定向后丢失 | 提示消息消失 | 只支持一次重定向 |
| 19 | `RedirectAttributes.addAttribute` 与 `addFlashAttribute` 混淆 | 参数出现在 URL 或丢失 | addAttribute → URL 参数；addFlashAttribute → Session 一次性 |
| 20 | 未处理 `HttpMessageNotReadableException` | JSON 格式错误返回 500 | 全局异常处理转 400（见 [[后端/Spring/SpringMVC参数绑定与异常处理]]） |
| 21 | Controller 中做业务逻辑 | 难以复用和测试 | Controller 只做参数接收和结果返回，业务放 Service |
| 22 | 直接返回 Entity | 泄漏表结构、循环引用（JPA 懒加载） | 转 VO/DTO |
| 23 | JPA 实体的双向关联序列化 | `StackOverflowError`（无限递归） | `@JsonIgnore` / `@JsonManagedReference` |

---

## 关联笔记

- 上一篇：[[后端/Spring/事务管理与失效场景]]
- 下一篇：[[后端/Spring/SpringMVC参数绑定与异常处理]]
- 底层：[[后端/JavaWeb/Servlet核心与生命周期]]（DispatcherServlet 继承自 HttpServlet）
- 整合：[[后端/Spring/SSM整合实战]]、[[后端/SpringBoot/SpringBoot入门与项目搭建]]
- 实战：[[后端/SpringBoot/整合Web开发]]（统一响应、全局异常、Knife4j）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
