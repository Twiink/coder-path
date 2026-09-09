---
title: "JSP-EL-JSTL与前后端分离"
aliases:
  - "JSP"
  - "EL 表达式"
  - "前后端分离"
tags:
  - "后端"
  - "java"
  - "javaweb"
category: "后端"
folder: "JavaWeb"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/JavaWeb/Servlet核心与生命周期]]"
  - "[[后端/JavaWeb/Filter-Listener与会话管理]]"
  - "[[后端/Spring/SpringMVC入门与执行流程]]"
  - "[[后端/SpringBoot/整合Web开发]]"
created: 2026-09-07
updated: 2026-09-07
---

# JSP / EL / JSTL 与前后端分离

> **定位说明**：JSP 是**服务端渲染（SSR）**时代的产物，Spring Boot 默认已不再推荐（官方明确「JSP 应尽量不用」）。新项目**一律走前后端分离**（后端只提供 JSON API，前端用 Vue/React 渲染）或服务端模板引擎（Thymeleaf/FreeMarker）。
>
> **本篇的学习价值**：① 存量老项目（大量企业系统仍是 JSP + SSM）需要维护；② 面试会问「JSP 和 Servlet 的关系」「九大隐式对象」；③ 理解服务端渲染的原理，才能理解 Thymeleaf/FreeMarker 和前后端分离的取舍。
>
> **建议投入**：JSP 只需理解原理（1~2 小时），**重点放在 EL/JSTL 的思想和前后端分离的架构**上。

## 1. JSP 的本质 ★★★★★

### 1.1 JSP 就是 Servlet

**JSP（JavaServer Pages）本质上是「简化 Servlet 编写的模板」，容器（Tomcat）会把 JSP 编译成 Servlet 再执行。**

```
编写：hello.jsp
   ↓ Tomcat 的 JspServlet（映射 *.jsp）
编译：work/Catalina/localhost/myapp/org/apache/jsp/hello_jsp.java
   ↓ javac
运行：hello_jsp.class（继承 org.apache.jasper.runtime.HttpJspBase → HttpServlet）
   ↓
每次请求调用 _jspService() 方法（★ 不是 service，也不是 doGet/doPost）
```

```html
<%-- hello.jsp --%>
<%@ page contentType="text/html;charset=UTF-8" %>
<html>
<body>
    <h1>Hello, <%= request.getParameter("name") %></h1>
    <%
        int sum = 0;
        for (int i = 1; i <= 100; i++) sum += i;
    %>
    <p>1 到 100 的和是：<%= sum %></p>
</body>
</html>
```

**编译后的 Servlet（简化）：**

```java
public final class hello_jsp extends org.apache.jasper.runtime.HttpJspBase {
    public void _jspService(HttpServletRequest request, HttpServletResponse response)
            throws IOException, ServletException {
        // ★ 九大隐式对象的声明与初始化
        PageContext pageContext = JspFactory.getDefaultFactory()
                .getPageContext(this, request, response, null, true, 8192, true);
        HttpSession session = pageContext.getSession();
        ServletContext application = pageContext.getServletContext();
        ServletConfig config = pageContext.getServletConfig();
        JspWriter out = pageContext.getOut();          // ★ 带缓冲的 Writer
        Object page = this;
        Throwable exception = null;                     // 仅 isErrorPage=true 时有值

        try {
            response.setContentType("text/html;charset=UTF-8");
            out.write("<html>\n<body>\n    <h1>Hello, ");
            out.print(request.getParameter("name"));      // ★ <%= %> 编译为 out.print()
            out.write("</h1>\n    ");
            int sum = 0;                                   // ★ <% %> 中的 Java 代码原样放入
            for (int i = 1; i <= 100; i++) sum += i;
            out.write("\n    <p>1 到 100 的和是：");
            out.print(sum);
            out.write("</p>\n</body>\n</html>\n");
        } catch (Throwable t) {
            ...
        } finally {
            JspFactory.getDefaultFactory().releasePageContext(pageContext);
        }
    }
}
```

> 【关键结论】
> 1. **JSP 最终是 Servlet**，所以 JSP 也是**单例**的，`<%! %>` 声明的成员变量存在线程安全问题。
> 2. **HTML 静态内容被编译成 `out.write("...")`**，Java 代码被原样嵌入 `_jspService()`。
> 3. **九大隐式对象是 `_jspService()` 的局部变量**，所以可以直接用。
> 4. **JSP 首次访问慢**（要编译），之后快（直接用 class）。这也是为什么生产要预热或禁用 JSP。

### 1.2 JSP vs Servlet

| 对比 | JSP | Servlet |
| --- | --- | --- |
| 本质 | 模板（编译成 Servlet） | Java 类 |
| 擅长 | **展示层**（HTML 中嵌 Java） | **控制层/逻辑层**（Java 中输出内容） |
| 编写体验 | HTML 为主，Java 用脚本标签 | Java 为主，输出 HTML 要大量 `out.print` |
| 加载时机 | 首次访问时编译（可配 load-on-startup） | load-on-startup 或首次请求 |
| 修改后 | **自动重新编译**（开发期方便，生产应关闭） | 需重新编译部署 |
| 现状 | **已淘汰**（Spring Boot 不推荐） | 仍是底层核心（DispatcherServlet） |

**MVC 模式的经典分工（JSP 时代）：**

```
Model（模型）      → JavaBean / Service / DAO      数据与业务逻辑
View（视图）       → JSP                          展示数据
Controller（控制器）→ Servlet（或 Spring MVC 的 Controller）  接收请求、调用 Model、选择 View

请求流程：
浏览器 → Controller Servlet → 调用 Service/DAO → 数据存入 request.setAttribute
      → forward 到 JSP → JSP 用 EL/JSTL 取出数据渲染 HTML → 返回浏览器
```

## 2. JSP 语法

### 2.1 脚本元素（Scripting Elements）

| 语法 | 名称 | 编译结果 | 用途 |
| --- | --- | --- | --- |
| `<% java代码 %>` | **Scriptlet**（脚本片段） | 放入 `_jspService()` 方法体 | 局部逻辑、变量声明 |
| `<%= 表达式 %>` | **Expression**（表达式） | `out.print(表达式)` | 输出值（★ 不能加分号） |
| `<%! 声明 %>` | **Declaration**（声明） | 放入**类的成员**（字段/方法） | ★ 成员变量、方法（有线程安全问题！） |
| `<%-- 注释 --%>` | JSP 注释 | **不编译到 Servlet**（客户端看不到） | ★ 推荐（隐藏敏感注释） |
| `<!-- 注释 -->` | HTML 注释 | 输出到 HTML（**客户端可见**） | 前端调试用 |

```html
<%!
    // ★ 成员变量：单例 JSP 中被所有请求共享 → 线程不安全！禁用！
    private int visitCount = 0;

    // 成员方法
    private String formatDate(Date date) {
        return new SimpleDateFormat("yyyy-MM-dd").format(date);
    }
%>

<%
    // 局部变量：每次请求独立（在 _jspService 的栈上）→ 线程安全
    visitCount++;                          // ★ 但访问成员变量仍有竞态
    String name = request.getParameter("name");
    List<User> users = (List<User>) request.getAttribute("users");
%>

<h1>访问次数：<%= visitCount %></h1>
<p>姓名：<%= name != null ? name : "匿名" %></p>
<p>时间：<%= formatDate(new Date()) %></p>
<%-- 这段注释不会出现在 HTML 源码中 --%>
<!-- 这段注释会出现在 HTML 源码中（F12 可见）-->
```

> 【坑】**`<%! %>` 声明的成员变量是线程不安全的**（JSP 单例）。老代码中常见「JSP 统计访问次数」的写法在并发下会丢计数。**规则：JSP 中不要声明成员变量，只用局部变量。**

### 2.2 指令（Directive）

```html
<%-- ① page 指令：定义页面属性（最常用，可出现多次但属性不能重复） --%>
<%@ page
    language="java"                          <%-- 脚本语言（只能是 java） --%>
    contentType="text/html;charset=UTF-8"    <%-- ★ 响应的 Content-Type（含编码） --%>
    pageEncoding="UTF-8"                     <%-- ★ JSP 文件本身的编码（必须与文件实际编码一致） --%>
    import="java.util.*,java.text.SimpleDateFormat"  <%-- 导入的包 --%>
    session="true"                           <%-- 是否可用 session 隐式对象 --%>
    buffer="8kb"                             <%-- out 的缓冲区大小（none = 不缓冲） --%>
    autoFlush="true"                         <%-- 缓冲区满时是否自动 flush --%>
    isThreadSafe="true"                      <%-- 已废弃（原 SingleThreadModel） --%>
    info="这是页面描述"                        <%-- getServletInfo() 返回 --%>
    errorPage="/error.jsp"                   <%-- ★ 出错时跳转的错误页 --%>
    isErrorPage="false"                      <%-- ★ true 时本页面可用 exception 隐式对象 --%>
    extends="com.example.BaseJsp"            <%-- 生成的 Servlet 继承的父类（极少用） --%>
    isELIgnored="false"                      <%-- ★ 是否忽略 EL 表达式（2.4 前默认 true） --%>
    trimDirectiveWhitespaces="true"          <%-- 去除指令周围的空白 --%>
%>

<%-- ② include 指令：静态包含（编译期合并，★ 效率高） --%>
<%@ include file="/common/header.jspf" %>      <%-- ★ 后缀用 .jspf（片段，不会被直接访问编译） --%>
<%@ include file="/common/footer.jspf" %>
<%-- 被包含文件的内容直接插入到当前位置，一起编译成一个 Servlet --%>
<%-- ★ 可以共享变量！header.jspf 中定义的变量在主页可用 --%>

<%-- ③ taglib 指令：引入标签库（JSTL 必用） --%>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>           <%-- JSTL 核心库 --%>
<%@ taglib prefix="fmt" uri="jakarta.tags.fmt" %>          <%-- 格式化库 --%>
<%@ taglib prefix="fn" uri="jakarta.tags.functions" %>     <%-- 函数库 --%>
<%@ taglib prefix="sql" uri="jakarta.tags.sql" %>          <%-- SQL 库（禁用！违反分层） --%>
<%@ taglib prefix="x" uri="jakarta.tags.xml" %>            <%-- XML 库 --%>
```

**静态包含 vs 动态包含（★ 高频考点）：**

| | `<%@ include file="x" %>` 静态包含 | `<jsp:include page="x"/>` 动态包含 |
| --- | --- | --- |
| 时机 | **编译期**（translation time） | **运行期**（request time） |
| 结果 | 合并成**一个 Servlet** | **两个 Servlet**，运行时调用 |
| 效率 | **高** | 略低（多一次调用） |
| 变量共享 | ✅ **可共享** | ❌ 不共享（通过 `<jsp:param>` 传参） |
| 内容变化 | 被包含文件改了，**主页可能不重新编译**（依赖容器） | ✅ **总是最新** |
| 适用 | 静态不变的内容（头尾、导航） | 动态内容（实时数据、不同用户不同内容） |

```html
<%-- 动态包含（可传参） --%>
<jsp:include page="/common/userInfo.jsp">
    <jsp:param name="showAvatar" value="true"/>
</jsp:include>
<%-- userInfo.jsp 中用 ${param.showAvatar} 取参数 --%>
```

### 2.3 JSP 动作标签（Action）

```html
<%-- ① 转发（等价 request.getRequestDispatcher().forward()） --%>
<jsp:forward page="/result.jsp">
    <jsp:param name="msg" value="成功"/>
</jsp:forward>

<%-- ② 包含（动态） --%>
<jsp:include page="header.jsp" flush="true"/>

<%-- ③ JavaBean 操作（★ 老项目的典型写法，已被 EL/JSTL 取代） --%>
<jsp:useBean id="user" class="com.example.User" scope="request"/>
<jsp:setProperty name="user" property="name" value="Tom"/>
<jsp:setProperty name="user" property="*"/>            <%-- 自动用请求参数填充所有属性 --%>
<jsp:getProperty name="user" property="name"/>

<%-- ④ 生成动态元素（避免脚本片段，JSP 2.0+） --%>
<jsp:element name="div">
    <jsp:attribute name="class">box</jsp:attribute>
    <jsp:body>内容</jsp:body>
</jsp:element>
<%-- 等价于 <div class="box">内容</div> --%>

<%-- ⑤ 文本（原样输出，不解析 EL） --%>
<jsp:text><![CDATA[ ${不会被解析} ]]></jsp:text>

<%-- ⑥ 声明属性（invoke 标签用，自定义标签场景） --%>
<jsp:attribute name="x">value</jsp:attribute>
<jsp:body>...</jsp:body>
```

## 3. JSP 九大隐式对象 ★★★★★（必背）

```html
<%-- 全部是 _jspService() 的局部变量，无需声明直接用 --%>
```

| # | 对象名 | 类型 | 作用域 | 用途 |
| --- | --- | --- | --- | --- |
| 1 | **`request`** | `HttpServletRequest` | request | 请求信息、参数、属性 |
| 2 | **`response`** | `HttpServletResponse` | — | 响应设置（头、状态码、重定向） |
| 3 | **`session`** | `HttpSession` | session | 会话数据（需 `page session="true"`） |
| 4 | **`application`** | `ServletContext` | application | 全局数据、应用信息 |
| 5 | **`pageContext`** | `PageContext` | page | ★ **最强大**：访问其他所有对象、四大作用域的统一入口 |
| 6 | **`config`** | `ServletConfig` | — | Servlet 配置参数 |
| 7 | **`out`** | `JspWriter` | — | 输出到响应（带缓冲，不同于 `response.getWriter()`） |
| 8 | **`page`** | `Object`（= this） | page | 当前 JSP 生成的 Servlet 实例（= `this`） |
| 9 | **`exception`** | `Throwable` | — | ★ **仅 `isErrorPage="true"` 的页面可用**，其他页面用会编译错误 |

```html
<%-- pageContext 的强大之处：统一管理四大作用域 --%>
<%
    pageContext.setAttribute("k", "v");                            // page 作用域
    pageContext.setAttribute("k", "v", PageContext.REQUEST_SCOPE); // request 作用域
    pageContext.setAttribute("k", "v", PageContext.SESSION_SCOPE); // session
    pageContext.setAttribute("k", "v", PageContext.APPLICATION_SCOPE); // application

    Object v = pageContext.getAttribute("k");                      // ★ 按 page→request→session→application 顺序查找
    Object v2 = pageContext.getAttribute("k", PageContext.SESSION_SCOPE);  // 指定作用域

    pageContext.findAttribute("k");        // 同 getAttribute（逐层查找）
    pageContext.removeAttribute("k", PageContext.SESSION_SCOPE);

    // 访问其他隐式对象
    HttpServletRequest req = pageContext.getRequest();
    HttpSession sess = pageContext.getSession();
    ServletContext app = pageContext.getServletContext();
    ServletConfig cfg = pageContext.getServletConfig();
    JspWriter o = pageContext.getOut();
    Object p = pageContext.getPage();
    Throwable e = pageContext.getException();

    pageContext.forward("/other.jsp");      // 转发
    pageContext.include("/other.jsp");      // 包含
%>

<%-- 错误页的标准写法 --%>
<%-- error.jsp --%>
<%@ page isErrorPage="true" contentType="text/html;charset=UTF-8" %>
<h1>出错了</h1>
<p>异常类型：<%= exception.getClass().getName() %></p>
<p>异常信息：<%= exception.getMessage() %></p>
<pre><% exception.printStackTrace(new PrintWriter(out)); %></pre>
```

**四大作用域的查找顺序（EL 也遵循）：**

```
page → request → session → application
（从小到大，找到即返回）

生命周期对比：
page：       一个页面内（forward 后就没了）
request：    一次请求（★ 含 forward，转发后仍可访问）
session：    一次会话（多次请求，直到超时或 invalidate）
application：整个应用（从启动到关闭）
```

## 4. EL 表达式（Expression Language）★★★★★

**EL（JSP 2.0 引入）用 `$&#123;&#125;` 语法简洁地输出数据，替代 `<%= %>` 和 Java 代码，是现代 JSP/模板的核心。**

### 4.1 基本语法

```html
<%-- ① 输出值（自动调用 toString，null 输出为空字符串而非 "null"！） --%>
${name}                    <%-- 等价 <%= request.getAttribute("name") %> 但更智能 --%>
${user.name}               <%-- 属性导航（调用 getName()） --%>
${users[0].name}           <%-- 索引访问 --%>
${map['key']}              <%-- Map 取值（键含特殊字符时必须用 [''] ） --%>
${map.key}                 <%-- 键是合法标识符时可用点号 --%>

<%-- ② ★ 查找顺序：pageScope → requestScope → sessionScope → applicationScope --%>
${user}                    <%-- 依次在四个作用域中找 "user" --%>
${requestScope.user}       <%-- ★ 明确指定作用域（性能更好，语义清晰） --%>
${sessionScope.loginUser}
${applicationScope.config}
${pageScope.temp}

<%-- ③ 隐式对象（11 个） --%>
${pageContext.request.contextPath}     <%-- ★★ 获取应用上下文路径（超常用！） --%>
${pageContext.session.id}
${pageContext.servletContext.serverInfo}

${param.username}                       <%-- 单个请求参数（等价 request.getParameter） --%>
${paramValues.hobby[0]}                 <%-- 多值参数（等价 getParameterValues） --%>

${header['User-Agent']}                 <%-- 请求头 --%>
${headerValues['Accept'][0]}

${cookie.JSESSIONID.value}              <%-- ★ Cookie --%>
${cookie.theme.name}

${initParam.appName}                    <%-- context-param（全局初始化参数） --%>

<%-- ④ 运算符 --%>
${1 + 2}                                <%-- 3（算术：+ - * / 或 div % 或 mod） --%>
${price * quantity}
${a > b}                                <%-- 比较：> 或 gt，< 或 lt，>= 或 ge，<= 或 le，== 或 eq，!= 或 ne --%>
${empty list}                           <%-- ★ empty：null、""、空集合、空数组、size=0 的 Map 都为 true --%>
${not empty user}
${a && b}                               <%-- 逻辑：&& 或 and，|| 或 or，! 或 not --%>
${cond ? 'yes' : 'no'}                  <%-- 三元 --%>
${a eq b ? x : y}
${empty a ? b : a}                      <%-- ★ 默认值惯用法 --%>
${user.name eq null ? '匿名' : user.name} <%-- 但 EL 中 null 直接输出空，通常不用判 --%>

<%-- ⑤ ★ 自动类型转换（EL 的便利之处） --%>
${param.age + 1}                        <%-- param.age 是 String，自动转数字再运算 --%>
${'100' + 200}                          <%-- 300 --%>
${emptyStr + 0}                         <%-- 空串/null 参与算术运算视为 0 --%>
```

### 4.2 EL 的属性导航原理（★ 面试）

```java
// ${user.name} 的解析过程（EL 的 ValueExpression）
// ① 在各作用域中查找 "user" 属性 → 得到 user 对象
// ② 对 user 对象调用 getName()（★ 遵循 JavaBean 规范）
//    - 先找 getName()
//    - 布尔类型也可找 isName()
// ③ 如果是 Map，调用 get("name")
// ④ 如果是 List/数组且 "name" 是数字，调用 get(index)
```

```html
<%-- JavaBean：调用 getter --%>
${user.name}          → user.getName()
${user.address.city}  → user.getAddress().getCity()   ★ 链式导航（中间为 null 会怎样？）

<%-- ★ EL 的 null 安全特性：链式导航中如果中间对象为 null，整个表达式返回 null（不抛 NPE！） --%>
${user.address.city}   <%-- 如果 address 是 null，输出空字符串，不会 NPE --%>
<%-- 这与 Java 代码 user.getAddress().getCity() 会抛 NPE 完全不同！是 EL 的重要优势 --%>

<%-- Map --%>
${config.timeout}      → config.get("timeout")
${config['db.url']}    → config.get("db.url")   ★ 键含 . 或 - 时必须用 []

<%-- List --%>
${users[0]}            → users.get(0)
${users.size()}        ❌ EL 不能直接调方法！要用 ${fn:length(users)} 或 ${users.size} 
<%-- 注意：EL 2.2（Servlet 3.0）后支持直接调用方法：${list.size()} ${service.findUser(id)} --%>
```

**EL 的隐式对象完整清单（11 个）：**

| 隐式对象 | 类型 | 说明 |
| --- | --- | --- |
| `pageContext` | `PageContext` | ★ 唯一能访问其他隐式对象的入口 |
| `pageScope` | `Map` | page 作用域的属性 |
| `requestScope` | `Map` | request 作用域的属性 |
| `sessionScope` | `Map` | session 作用域的属性 |
| `applicationScope` | `Map` | application 作用域的属性 |
| `param` | `Map&lt;String,String&gt;` | 请求参数（单值） |
| `paramValues` | `Map<String,String[]>` | 请求参数（多值） |
| `header` | `Map&lt;String,String&gt;` | 请求头（单值） |
| `headerValues` | `Map<String,String[]>` | 请求头（多值） |
| `cookie` | `Map&lt;String,Cookie&gt;` | Cookie |
| `initParam` | `Map&lt;String,String&gt;` | context-param |

```html
<%-- ★ 最常见的实战用法：动态获取 contextPath（避免硬编码） --%>
<%-- ❌ 硬编码：部署到不同 contextPath 就失效 --%>
<link rel="stylesheet" href="/myapp/css/style.css">
<script src="/myapp/js/app.js"></script>
<form action="/myapp/login">

<%-- ✅ 用 EL --%>
<link rel="stylesheet" href="${pageContext.request.contextPath}/css/style.css">
<script src="${pageContext.request.contextPath}/js/app.js"></script>
<form action="${pageContext.request.contextPath}/login">

<%-- ✅ 更好：用 <base> 标签统一前缀 --%>
<base href="${pageContext.request.contextPath}/">
<link rel="stylesheet" href="css/style.css">     <%-- 相对路径即可 --%>

<%-- ✅ 最佳：JSTL 的 c:url（自动加 contextPath 且可做 URL 重写） --%>
<link rel="stylesheet" href="<c:url value='/css/style.css'/>">
<a href="<c:url value='/user/detail?id=${user.id}'/>">详情</a>
```

### 4.3 EL 函数库（fn）

```html
<%@ taglib prefix="fn" uri="jakarta.tags.functions" %>

<%-- 字符串处理 --%>
${fn:length(list)}                  <%-- ★ 集合/数组/字符串的长度 --%>
${fn:contains(str, 'abc')}          <%-- 是否包含（区分大小写） --%>
${fn:containsIgnoreCase(str, 'ABC')}
${fn:startsWith(str, 'http')}
${fn:endsWith(str, '.jpg')}
${fn:indexOf(str, 'x')}
${fn:substring(str, 0, 10)}
${fn:substringAfter(str, ':')}      <%-- ★ 取分隔符之后（如从 URL 取路径） --%>
${fn:substringBefore(str, '?')}     <%-- 取分隔符之前 --%>
${fn:split(str, ',')}               <%-- 返回 String[] --%>
${fn:join(array, '-')}              <%-- ★ 数组拼接成字符串 --%>
${fn:replace(str, 'a', 'b')}
${fn:toUpperCase(str)}
${fn:toLowerCase(str)}
${fn:trim(str)}
${fn:escapeXml(str)}                <%-- ★★ 转义 XML/HTML 特殊字符（防 XSS！） --%>

<%-- 实战示例 --%>
<c:if test="${fn:length(users) > 0}">
    共 ${fn:length(users)} 个用户
</c:if>
<c:if test="${fn:contains(user.email, '@qq.com')}">QQ 邮箱用户</c:if>
<p>安全输出：${fn:escapeXml(userInput)}</p>   <%-- ★ 防 XSS --%>
<p>标签：${fn:join(user.tags, ', ')}</p>
```

## 5. JSTL 标签库 ★★★★★

**JSTL（JSP Standard Tag Library）= 用「标签」替代「Java 脚本片段」，让 JSP 中不再有 `<% %>`。**

```xml
<!-- Maven 依赖（Jakarta EE 9+，对应 Tomcat 10 / Spring Boot 3） -->
<dependency>
    <groupId>org.glassfish.web</groupId>
    <artifactId>jakarta.servlet.jsp.jstl</artifactId>
    <version>3.0.1</version>
</dependency>
<dependency>
    <groupId>jakarta.servlet.jsp.jstl</groupId>
    <artifactId>jakarta.servlet.jsp.jstl-api</artifactId>
    <version>3.0.0</version>
</dependency>

<!-- 老项目（javax，Tomcat 9 / Spring Boot 2） -->
<dependency>
    <groupId>javax.servlet</groupId>
    <artifactId>jstl</artifactId>
    <version>1.2</version>
</dependency>
```

```html
<%-- 引入标签库（★ Jakarta 版的 URI） --%>
<%@ taglib prefix="c"   uri="jakarta.tags.core" %>       <%-- 核心库（最常用） --%>
<%@ taglib prefix="fmt" uri="jakarta.tags.fmt" %>        <%-- 格式化 --%>
<%@ taglib prefix="fn"  uri="jakarta.tags.functions" %>  <%-- 函数 --%>
<%-- javax 版（老项目）：uri="http://java.sun.com/jsp/jstl/core" --%>
```

### 5.1 核心标签库（c:）

```html
<%-- ─── 输出 ─── --%>
<c:out value="${user.name}"/>                          <%-- ★ 默认转义 HTML（防 XSS） --%>
<c:out value="${userInput}" escapeXml="false"/>        <%-- 不转义（危险） --%>
<c:out value="${user.name}" default="匿名"/>            <%-- null 时的默认值 --%>
${user.name}                                            <%-- EL 直接输出【不转义】★ XSS 风险 --%>

<%-- ─── 设置/删除变量 ─── --%>
<c:set var="total" value="${price * count}"/>           <%-- 存到 page 作用域 --%>
<c:set var="user" value="${user}" scope="session"/>     <%-- 指定作用域 --%>
<c:set var="count" value="${count + 1}"/>               <%-- 自增 --%>
<c:set target="${user}" property="name" value="新名字"/>  <%-- ★ 修改 Bean 的属性 --%>
<c:set target="${config}" property="timeout" value="30"/> <%-- 修改 Map 的键 --%>
<c:remove var="temp" scope="session"/>                  <%-- 删除变量 --%>

<%-- ─── 条件判断 ─── --%>
<c:if test="${user.age >= 18}">成年人</c:if>
<c:if test="${not empty list}">列表非空</c:if>
<c:if test="${param.type eq 'vip'}">VIP 用户</c:if>

<c:choose>                                              <%-- ★ 相当于 switch / if-else if-else --%>
    <c:when test="${score >= 90}">优秀</c:when>
    <c:when test="${score >= 80}">良好</c:when>
    <c:when test="${score >= 60}">及格</c:when>
    <c:otherwise>不及格</c:otherwise>
</c:choose>

<%-- ─── 循环遍历 ★★★★★ ─── --%>
<%-- ① 遍历集合 --%>
<c:forEach items="${users}" var="user" varStatus="status">
    <tr class="${status.index % 2 == 0 ? 'even' : 'odd'}">   <%-- ★ 隔行变色 --%>
        <td>${status.index + 1}</td>      <%-- 索引（从 0 开始） --%>
        <td>${status.count}</td>          <%-- 计数（从 1 开始） --%>
        <td>${user.id}</td>
        <td>${user.name}</td>
        <td>${status.first ? '第一个' : ''}</td>
        <td>${status.last ? '最后一个' : ''}</td>
    </tr>
</c:forEach>

<%-- ② 遍历 Map --%>
<c:forEach items="${configMap}" var="entry">
    ${entry.key} = ${entry.value}<br/>
</c:forEach>

<%-- ③ 遍历数组 / 逗号分隔的字符串 --%>
<c:forEach items="${array}" var="item">${item}</c:forEach>
<c:forEach items="a,b,c" var="item">${item}-</c:forEach>    <%-- ★ 自动按逗号分割 --%>

<%-- ④ 数字循环（begin/end/step） --%>
<c:forEach begin="1" end="10" step="1" var="i">
    ${i}
</c:forEach>
<c:forEach begin="0" end="9" var="i">                        <%-- 生成分页页码 --%>
    <a href="?page=${i + 1}">${i + 1}</a>
</c:forEach>

<%-- ⑤ varStatus 的属性 --%>
<%-- index：当前索引（从 0）  count：当前计数（从 1） --%>
<%-- first：是否第一个        last：是否最后一个 --%>
<%-- begin/end/step：循环参数  current：当前对象 --%>

<%-- ─── 分隔遍历（forTokens） --%>
<c:forTokens items="a,b;c|d" delims=";,|" var="token">
    [${token}]
</c:forTokens>
<%-- 输出：[a][b][c][d] --%>

<%-- ─── URL 处理 ─── --%>
<c:url value="/user/detail" var="detailUrl">                  <%-- ★ 自动加 contextPath --%>
    <c:param name="id" value="${user.id}"/>                    <%-- 自动 URL 编码 --%>
    <c:param name="from" value="list"/>
</c:url>
<a href="${detailUrl}">详情</a>
<%-- 输出：<a href="/myapp/user/detail?id=1&amp;from=list">详情</a> --%>

<c:redirect url="/login"/>                                     <%-- 重定向 --%>
<c:import url="https://api.example.com/data" var="apiData"/>    <%-- ★ 导入外部资源（含跨域！） --%>
<c:import url="/common/nav.jsp"/>                               <%-- 导入内部资源（动态包含） --%>

<%-- ─── 异常处理 --%>
<c:catch var="error">
    ${riskyOperation()}
</c:catch>
<c:if test="${error != null}">出错：${error.message}</c:if>
```

### 5.2 格式化标签库（fmt:）

```html
<%-- ─── 日期时间格式化 ★★★★★ ─── --%>
<fmt:formatDate value="${order.createTime}" pattern="yyyy-MM-dd HH:mm:ss"/>
<fmt:formatDate value="${date}" pattern="yyyy年MM月dd日"/>
<fmt:formatDate value="${date}" type="date"/>              <%-- 只格式化日期 --%>
<fmt:formatDate value="${date}" type="time"/>              <%-- 只格式化时间 --%>
<fmt:formatDate value="${date}" type="both" dateStyle="long" timeStyle="short"/>
<fmt:formatDate value="${date}" var="dateStr" pattern="yyyy-MM-dd"/>   <%-- 存到变量 --%>
${dateStr}

<fmt:parseDate value="2026-09-07" pattern="yyyy-MM-dd" var="parsedDate"/>  <%-- 字符串 → Date --%>

<%-- ⚠️ fmt:formatDate 只支持 java.util.Date，不支持 JDK 8 的 LocalDateTime！ --%>
<%-- LocalDateTime 的解决方案： --%>
<%-- ① 后端格式化成 String 再传给 JSP（★ 推荐） --%>
<%-- ② 自定义 EL 函数 --%>
<%-- ③ 用 Thymeleaf（原生支持：${#temporals.format(dt, 'yyyy-MM-dd')}） --%>

<%-- ─── 数字格式化 ─── --%>
<fmt:formatNumber value="${price}" pattern="#,##0.00"/>       <%-- 1,234.56（千分位） --%>
<fmt:formatNumber value="0.156" type="percent" maxFractionDigits="2"/>  <%-- 15.6% --%>
<fmt:formatNumber value="${amount}" type="currency" currencySymbol="￥"/>  <%-- ￥1,234.00 --%>
<fmt:formatNumber value="3.14159" maxFractionDigits="2"/>      <%-- 3.14 --%>
<fmt:formatNumber value="1234.5" groupingUsed="false"/>        <%-- 1234.5（不分隔） --%>
<fmt:parseNumber value="1,234.56" pattern="#,##0.##" var="num"/>

<%-- ─── 国际化（i18n）★★★★★ ─── --%>
<fmt:setLocale value="${param.lang != null ? param.lang : 'zh_CN'}"/>
<fmt:setBundle basename="messages"/>                            <%-- messages_zh_CN.properties --%>
<fmt:message key="user.name"/>                                  <%-- 读取国际化文本 --%>
<fmt:message key="welcome">
    <fmt:param value="${user.name}"/>                            <%-- 占位符参数 {0} --%>
    <fmt:param value="${count}"/>
</fmt:message>
<fmt:formatDate value="${now}" type="both"/>                     <%-- ★ 按 Locale 自动格式化 --%>
<fmt:formatNumber value="${amount}" type="currency"/>             <%-- ★ 按 Locale 显示货币符号 --%>

<%-- 时区 --%>
<fmt:timeZone value="Asia/Shanghai">
    <fmt:formatDate value="${utcTime}" pattern="yyyy-MM-dd HH:mm:ss"/>
</fmt:timeZone>
<fmt:setTimeZone value="GMT+8"/>
```

**国际化的完整实现（i18n）：**

```
资源文件（放在 classpath 根，即 src/main/resources）：
messages.properties              ← 默认（兜底）
messages_zh_CN.properties        ← 简体中文
messages_en_US.properties        ← 英文
messages_ja_JP.properties        ← 日文

messages_zh_CN.properties:
user.name=用户名
welcome=欢迎，{0}！您有 {1} 条消息。
button.submit=提交

messages_en_US.properties:
user.name=Username
welcome=Welcome, {0}! You have {1} messages.
button.submit=Submit
```

```properties
# ⚠️ properties 文件默认是 ISO-8859-1 编码，中文需要转义或用工具配置
# IDEA: Settings → File Encodings → Default encoding for properties files = UTF-8
#       + 勾选 Transparent native-to-ascii conversion（自动转 \uXXXX）
# Maven 打包时指定编码
```

```xml
<!-- Spring MVC 的国际化配置（不用 fmt:setBundle） -->
<bean id="messageSource" class="org.springframework.context.support.ResourceBundleMessageSource">
    <property name="basename" value="messages"/>
    <property name="defaultEncoding" value="UTF-8"/>
    <property name="useCodeAsDefaultMessage" value="true"/>
</bean>
<!-- 或用 ReloadableResourceBundleMessageSource（支持热加载） -->

<!-- LocaleResolver：决定用哪个 Locale -->
<bean id="localeResolver" class="org.springframework.web.servlet.i18n.SessionLocaleResolver">
    <property name="defaultLocale" value="zh_CN"/>
</bean>
<!-- AcceptHeaderLocaleResolver（按请求头 Accept-Language） -->
<!-- CookieLocaleResolver（按 Cookie） -->

<!-- LocaleChangeInterceptor：通过参数切换语言 -->
<mvc:interceptors>
    <bean class="org.springframework.web.servlet.i18n.LocaleChangeInterceptor">
        <property name="paramName" value="lang"/>    <!-- ?lang=en_US -->
    </bean>
</mvc:interceptors>
```

```java
// Spring Boot 配置
// application.yml
spring:
  messages:
    basename: i18n/messages          # ★ 可多个：i18n/messages,i18n/errors
    encoding: UTF-8
    fallback-to-system-locale: false  # ★ 找不到时不退回系统 Locale（用默认 properties）
    use-code-as-default-message: true # 找不到 key 时返回 key 本身（而非抛异常）
    cache-duration: 3600s

// 代码中使用
@Autowired private MessageSource messageSource;
String msg = messageSource.getMessage("user.name", null, LocaleContextHolder.getLocale());
String welcome = messageSource.getMessage("welcome", new Object[]{name, count}, locale);

// 校验注解的国际化（★ 常用）
@NotBlank(message = "{user.name.required}")        // {} 表示从 messages.properties 取
private String name;
// messages.properties: user.name.required=用户名不能为空
// messages_en_US.properties: user.name.required=Username is required

// Thymeleaf 中的国际化
// #{user.name}   → 直接取
// #{welcome(${user.name}, ${count})}  → 带参数
```

### 5.3 JSTL 其他标签库（了解）

| 标签库 | prefix | 用途 | 现状 |
| --- | --- | --- | --- |
| Core | `c` | 流程控制、URL、输出 | ★ 必学 |
| Formatting | `fmt` | 日期数字格式化、国际化 | ★ 必学 |
| Functions | `fn` | 字符串处理函数 | ★ 常用 |
| SQL | `sql` | 在 JSP 中直接执行 SQL | ❌ **禁用**（严重违反分层，性能差，SQL 注入风险） |
| XML | `x` | XML 解析与 XPath | 少用（改用 JSON） |

```html
<%-- sql 标签库（★ 反面教材，绝对不要在生产使用） --%>
<%@ taglib prefix="sql" uri="jakarta.tags.sql" %>
<sql:setDataSource driver="com.mysql.cj.jdbc.Driver"
                   url="jdbc:mysql://localhost:3306/db"
                   user="root" password="123456" var="ds"/>     <%-- ★ 密码明文写在页面！ --%>
<sql:query dataSource="${ds}" var="result">
    SELECT * FROM users WHERE name = ?                        <%-- 参数化查询 --%>
    <sql:param value="${param.name}"/>
</sql:query>
<c:forEach items="${result.rows}" var="row">${row.name}</c:forEach>
<%-- 问题：数据库凭证暴露在视图层、违反 MVC 分层、无法复用、性能差、难以维护 --%>
```

## 6. JSP 的配置与最佳实践

```xml
<!-- conf/web.xml 中 JspServlet 的默认配置 -->
<servlet>
    <servlet-name>jsp</servlet-name>
    <servlet-class>org.apache.jasper.servlet.JspServlet</servlet-class>
    <init-param>
        <param-name>fork</param-name>
        <param-value>false</param-value>
    </init-param>
    <init-param>
        <param-name>xpoweredBy</param-name>
        <param-value>false</param-value>       <!-- ★ 隐藏 X-Powered-By 头 -->
    </init-param>
    <init-param>
        <param-name>development</param-name>
        <param-value>true</param-value>         <!-- ★ 生产应设为 false（不检查 JSP 修改） -->
    </init-param>
    <init-param>
        <param-name>modificationTestInterval</param-name>
        <param-value>4</param-value>            <!-- 检查修改的间隔（秒） -->
    </init-param>
    <init-param>
        <param-name>trimSpaces</param-name>
        <param-value>true</param-value>          <!-- ★ 去除模板文本中的空白，减小输出 -->
    </init-param>
    <init-param>
        <param-name>genStringAsCharArray</param-name>
        <param-value>true</param-value>          <!-- 性能优化：字符串用 char[] -->
    </init-param>
    <load-on-startup>3</load-on-startup>
</servlet>
<servlet-mapping>
    <servlet-name>jsp</servlet-name>
    <url-pattern>*.jsp</url-pattern>
    <url-pattern>*.jspx</url-pattern>
</servlet-mapping>
```

```xml
<!-- ★ 应用的 web.xml 中统一配置所有 JSP 的公共属性（避免每个 JSP 都写 page 指令） -->
<jsp-config>
    <jsp-property-group>
        <url-pattern>*.jsp</url-pattern>
        <page-encoding>UTF-8</page-encoding>              <!-- ★ 统一编码 -->
        <default-content-type>text/html</default-content-type>
        <scripting-invalid>true</scripting-invalid>        <!-- ★★ 禁用 <% %> 脚本！强制用 EL/JSTL -->
        <el-ignored>false</el-ignored>
        <trim-directive-whitespaces>true</trim-directive-whitespaces>
        <include-prelude>/WEB-INF/jspf/common.jspf</include-prelude>   <!-- ★ 自动包含头部 -->
        <include-coda>/WEB-INF/jspf/footer.jspf</include-coda>         <!-- 自动包含尾部 -->
        <error-code>500</error-code>
    </jsp-property-group>
</jsp-config>

<!-- /WEB-INF/jspf/common.jspf（所有 JSP 自动继承） -->
<%@ page contentType="text/html;charset=UTF-8" pageEncoding="UTF-8" session="false" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%@ taglib prefix="fmt" uri="jakarta.tags.fmt" %>
<%@ taglib prefix="fn" uri="jakarta.tags.functions" %>
<c:set var="ctx" value="${pageContext.request.contextPath}"/>   <%-- ★ 全局的 contextPath 变量 --%>

<!-- 自定义错误页（★ 生产必备） -->
<error-page>
    <error-code>404</error-code>
    <location>/WEB-INF/views/error/404.jsp</location>
</error-page>
<error-page>
    <error-code>500</error-code>
    <location>/WEB-INF/views/error/500.jsp</location>
</error-page>
<error-page>
    <exception-type>java.lang.Throwable</exception-type>
    <location>/WEB-INF/views/error/error.jsp</location>
</error-page>
```

**JSP 的安全实践：**

| 实践 | 说明 |
| --- | --- |
| **JSP 放 WEB-INF 下** | ★ WEB-INF 下的资源**浏览器无法直接访问**，只能通过 forward 进入（防止绕过 Controller 直接访问 JSP） |
| 禁用脚本片段 | `scripting-invalid=true`，强制用 EL/JSTL |
| **输出转义** | `<c:out>` 默认转义；EL 直接输出**不转义**（XSS 风险）→ 用户输入必须 `<c:out>` 或 `fn:escapeXml` |
| 隐藏版本信息 | `xpoweredBy=false`（去掉 `X-Powered-By: JSP/3.1` 头） |
| 生产关闭热编译 | `development=false`（避免每次请求检查文件修改） |
| 不用 sql 标签库 | 违反分层 + 安全风险 |
| JSP 中不写业务逻辑 | 只做展示，逻辑在 Controller/Service |

```html
<%-- ★ XSS 防护示例 --%>
<%-- ❌ 危险：用户输入直接输出，可注入 <script> --%>
<p>${param.comment}</p>
<p><%= request.getParameter("comment") %></p>

<%-- ✅ 安全：转义输出 --%>
<p><c:out value="${param.comment}"/></p>
<p>${fn:escapeXml(param.comment)}</p>
<%-- 用户输入 <script>alert(1)</script> 会被转义为 &lt;script&gt;alert(1)&lt;/script&gt; --%>
```

## 7. 现代替代方案：服务端模板引擎

### 7.1 Thymeleaf（Spring Boot 官方推荐）★★★★★

**Thymeleaf 的核心优势：模板本身就是合法的 HTML（Natural Templating），前端可以直接打开预览，无需服务器。**

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-thymeleaf</artifactId>
</dependency>
```

```html
<!-- templates/user/list.html（★ 可以直接用浏览器打开，显示示例数据） -->
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      xmlns:sec="http://www.thymeleaf.org/extras/spring-security">
<head>
    <meta charset="UTF-8">
    <title>用户列表</title>
    <!-- ★ th:href 在浏览器直接打开时会用 href 的值，服务器渲染时替换 -->
    <link rel="stylesheet" th:href="@{/css/style.css}" href="../static/css/style.css">
</head>
<body>
    <h1 th:text="${title}">用户列表（默认标题）</h1>

    <!-- 变量输出 -->
    <p th:text="${user.name}">张三</p>
    <p th:utext="${user.htmlContent}">不转义（XSS 风险）</p>
    <p th:text="'你好，' + ${user.name}">你好，张三</p>
    <p th:text="|你好，${user.name}！|">你好，张三！</p>       <!-- ★ 字面量替换语法 -->

    <!-- 条件 -->
    <p th:if="${user.age >= 18}">成年人</p>
    <p th:unless="${user.active}">已停用</p>
    <p th:switch="${user.role}">
        <span th:case="'ADMIN'">管理员</span>
        <span th:case="'USER'">普通用户</span>
        <span th:case="*">未知</span>
    </p>

    <!-- ★ 循环（th:each） -->
    <table>
        <tr th:each="user, stat : ${users}">
            <td th:text="${stat.index + 1}">1</td>          <!-- 索引 -->
            <td th:text="${stat.count}">1</td>               <!-- 计数 -->
            <td th:text="${user.id}">1</td>
            <td th:text="${user.name}">张三</td>
            <td th:class="${stat.even} ? 'even-row' : 'odd-row'">even-row</td>
            <td th:text="${stat.first} ? '首行' : ''">首行</td>
        </tr>
        <tr th:if="${#lists.isEmpty(users)}">
            <td colspan="5">暂无数据</td>
        </tr>
    </table>

    <!-- 链接（★ th:href + @{} 自动加 contextPath） -->
    <a th:href="@{/user/detail(id=${user.id}, from='list')}">详情</a>
    <a th:href="@{https://www.example.com}">外部链接</a>
    <form th:action="@{/user/save}" th:object="${userForm}" method="post">
        <input type="text" th:field="*{name}"/>              <!-- ★ th:field 双向绑定 -->
        <span th:if="${#fields.hasErrors('name')}" th:errors="*{name}">错误</span>
        <button type="submit">保存</button>
    </form>

    <!-- ★ 日期时间格式化（原生支持 LocalDateTime！） -->
    <span th:text="${#temporals.format(order.createTime, 'yyyy-MM-dd HH:mm:ss')}">2026-09-07</span>
    <span th:text="${#dates.format(legacyDate, 'yyyy-MM-dd')}">2026-09-07</span>

    <!-- 数字格式化 -->
    <span th:text="${#numbers.formatDecimal(price, 1, 'COMMA', 2, 'POINT')}">1,234.56</span>
    <span th:text="${#numbers.formatCurrency(amount)}">￥1,234.00</span>
    <span th:text="${#numbers.formatPercent(rate, 1, 2)}">15.60%</span>

    <!-- ★ 国际化 -->
    <h2 th:text="#{user.list.title}">用户列表</h2>
    <p th:text="#{welcome.msg(${user.name})}">欢迎</p>

    <!-- 工具对象 -->
    <span th:text="${#strings.isEmpty(name)}">false</span>
    <span th:text="${#strings.length(name)}">3</span>
    <span th:text="${#strings.toUpperCase(name)}">ABC</span>
    <span th:text="${#lists.size(users)}">10</span>
    <span th:text="${#maps.size(map)}">5</span>
    <span th:text="${#calendars.format(now, 'yyyy')}">2026</span>
    <span th:text="${#ctx.locale}">zh_CN</span>
    <span th:text="${#httpServletRequest.requestURL}">...</span>
    <span th:text="${#session.id}">...</span>

    <!-- ★ 片段与布局（替代 JSP 的 include） -->
    <div th:replace="~{fragments/header :: header}"></div>       <!-- 引入片段 -->
    <div th:insert="~{fragments/nav :: nav}"></div>              <!-- insert vs replace vs include -->
    <div th:replace="~{fragments/footer :: footer(year=2026)}"></div>  <!-- 带参数 -->

    <!-- 内联（在 JS 中用 Thymeleaf 变量） -->
    <script th:inline="javascript">
        var userName = /*[[${user.name}]]*/ 'default';       <!-- ★ 注释语法，静态打开也合法 -->
        var users = /*[[${userList}]]*/ [];                   <!-- 自动转成 JSON -->
        console.log(userName, users);
    </script>

    <!-- Spring Security 集成 -->
    <div sec:authorize="isAuthenticated()">已登录：<span sec:authentication="name"></span></div>
    <div sec:authorize="hasRole('ADMIN')">管理员可见</div>
    <span sec:authentication="principal.authorities">权限列表</span>
</body>
</html>
```

```java
// Controller
@Controller
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public String list(Model model) {
        model.addAttribute("title", "用户管理");
        model.addAttribute("users", userService.listAll());
        return "user/list";                       // ★ 返回模板路径（templates/user/list.html）
    }

    @GetMapping("/detail/{id}")
    public String detail(@PathVariable Long id, ModelMap map, HttpServletRequest request) {
        User user = userService.get(id);
        map.put("user", user);
        request.setAttribute("extra", "value");   // 也可以直接设 request 属性
        return "user/detail";
    }

    // 重定向与转发
    @GetMapping("/redirect")
    public String redirect(RedirectAttributes ra) {
        ra.addFlashAttribute("message", "保存成功");    // ★ Flash 属性（存 Session，重定向后取出即删）
        ra.addAttribute("id", 1L);                       // 拼到 URL 参数
        return "redirect:/users/detail";                   // 302 重定向
    }

    @GetMapping("/forward")
    public String forward() {
        return "forward:/users";                           // 服务端转发
    }

    // ModelAndView（老写法）
    @GetMapping("/mv")
    public ModelAndView mv() {
        ModelAndView mav = new ModelAndView("user/list");
        mav.addObject("users", userService.listAll());
        return mav;
    }
}
```

```yaml
# application.yml
spring:
  thymeleaf:
    prefix: classpath:/templates/          # 模板路径
    suffix: .html                          # 后缀
    mode: HTML
    encoding: UTF-8
    servlet:
      content-type: text/html
    cache: false                           # ★ 开发关闭缓存（改模板立即生效），生产设 true
    check-template: true
    check-template-location: true
    enable-spring-el-compiler: true         # ★ 开启 SpEL 编译（提升性能）
```

**Thymeleaf vs JSP：**

| 对比 | JSP | Thymeleaf |
| --- | --- | --- |
| 模板类型 | 只能 HTML（且含 Java 代码后不合法） | **HTML/XML/TEXT/JS，模板本身合法** |
| 静态预览 | ❌ 必须部署到容器 | ✅ **浏览器直接打开**（Natural Templating） |
| 语法 | `<% %>`、`$&#123;&#125;`、标签库 | `th:xxx` 属性 + `$&#123;&#125;` SpEL |
| Spring Boot 支持 | ⚠️ **不推荐**（jar 打包时 JSP 有已知限制） | ✅ **官方推荐** |
| jar 部署 | ❌ **有问题**（嵌入式容器不支持 JSP 的部分特性） | ✅ 完美支持 |
| 性能 | 编译成 Servlet，运行快 | 解析模板，稍慢（可缓存 + SpEL 编译优化） |
| LocalDateTime | ❌ 需转换 | ✅ 原生 `#temporals` |
| 学习曲线 | 中（要学标签库） | 低（就是 HTML 属性） |
| 现状 | 淘汰中 | 服务端渲染的首选 |

> 【重要】**Spring Boot 用 jar 打包时不建议用 JSP**（官方文档明确说明）：
> - Jetty 和 Tomcat 应该能工作，但用 jar 打包时会遇到问题（JSP 编译依赖文件系统）。
> - Undertow **不支持 JSP**。
> - 用 JSP 必须打成 **war** 部署，或接受 jar 部署的限制。
>
> 所以 Spring Boot 项目**首选 Thymeleaf / FreeMarker**。

### 7.2 FreeMarker（模板引擎）

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-freemarker</artifactId>
</dependency>
```

```html
<!-- templates/user/list.ftl -->
<!DOCTYPE html>
<html>
<head><title>${title}</title></head>
<body>
    <h1>${title!'默认标题'}</h1>          <!-- ★ ! 是默认值操作符 -->

    <!-- 变量与导航 -->
    <p>${user.name}</p>
    <p>${user.address.city!'未知'}</p>     <!-- ★ 多级导航 + 默认值（防 null） -->
    <p>${"字符串插值 ${user.name}"}</p>

    <!-- 条件 -->
    <#if user.age gte 18>                  <!-- gte=大于等于, lte, gt, lt, eq, ne -->
        成年人
    <#elseif user.age gte 12>
        青少年
    <#else>
        儿童
    </#if>

    <#switch user.role>
        <#case "ADMIN">管理员<#break>
        <#case "USER">普通用户<#break>
        <#default>未知
    </#switch>

    <!-- ★ 循环 -->
    <table>
    <#list users as user>
        <tr>
            <td>${user?index + 1}</td>      <!-- ?index 从 0，?counter 从 1 -->
            <td>${user.name}</td>
            <td><#if user?is_first>首行</#if></td>
            <td><#if user?is_last>末行</#if></td>
            <td>${user?counter}/${users?size}</td>
        </tr>
    <#else>
        <tr><td>暂无数据</td></tr>           <!-- ★ list 的 else：集合为空时 -->
    </#list>
    </table>

    <!-- 遍历 Map -->
    <#list configMap?keys as key>
        ${key} = ${configMap[key]}<br/>
    </#list>
    <#list configMap as k, v>${k}=${v}</#list>   <!-- FreeMarker 2.3.25+ -->

    <!-- 内建函数（? 开头） -->
    ${user.name?upper_case}  ${user.name?lower_case}  ${user.name?cap_first}
    ${user.name?length}  ${user.name?substring(0,2)}  ${user.name?replace('a','b')}
    ${user.name?trim}  ${user.name?html}  <!-- ★ ?html 转义，防 XSS -->
    ${price?string("0.00")}  ${price?string(",##0.00")}
    ${date?string("yyyy-MM-dd HH:mm:ss")}
    ${list?size}  ${list?join(", ")}  ${list?first}  ${list?last}  ${list?sort}
    ${user?has_content}  <!-- 判断非 null 且非空 -->

    <!-- 宏（可复用的模板片段，★ 类似函数） -->
    <#macro pagination current total url>
        <div class="pagination">
            <#if (current > 1)><a href="${url}?page=${current - 1}">上一页</a></#if>
            <#list 1..total as i>
                <#if i == current><span>${i}</span>
                <#else><a href="${url}?page=${i}">${i}</a></#if>
            </#list>
            <#if (current < total)><a href="${url}?page=${current + 1}">下一页</a></#if>
        </div>
    </#macro>
    <@pagination current=pageNum total=totalPages url="/users"/>

    <!-- 包含与导入 -->
    <#include "header.ftl">
    <#import "macros.ftl" as m>            <!-- 导入命名空间 -->
    <@m.pagination current=1 total=10 url="/x"/>

    <!-- 空值处理 -->
    ${maybeNull!}                          <!-- null 时输出空 -->
    ${maybeNull!'默认值'}
    <#if maybeNull??>有值</#if>             <!-- ?? 判断非 null -->
    ${a.b.c!}                              <!-- 链式导航中任意一级为 null 都不报错 -->
</body>
</html>
```

**模板引擎对比：**

| | JSP | Thymeleaf | FreeMarker | Velocity | Beetl |
| --- | --- | --- | --- | --- | --- |
| 模板合法性 | ❌ | ✅ **天然 HTML** | ❌（自有语法） | ❌ | ❌ |
| 性能 | 高（编译成 Servlet） | 中 | **高** | 高 | **最高** |
| Spring Boot 支持 | ⚠️ 不推荐 | ✅ **官方推荐** | ✅ starter | ✅ starter | ✅ starter |
| 语法风格 | 标签库 + EL | **HTML 属性** | `#`/`$&#123;&#125;`/`<#>` | `#`/`$` | 类 JS |
| 学习成本 | 中 | **低** | 中 | 低 | 低 |
| 适用 | 老项目维护 | **Web 页面** | **代码生成、邮件、报表** | 代码生成 | 高性能渲染 |
| 现状 | 淘汰 | **主流** | 活跃（代码生成器常用） | 维护中 | 国内活跃 |

> 【实践建议】
> - **Web 页面渲染** → Thymeleaf（Spring Boot 官方推荐，模板即 HTML，前后端协作友好）。
> - **代码生成、邮件模板、报表** → FreeMarker（语法强大，MyBatis-Plus/各类代码生成器的默认选择）。
> - **新项目 API 服务** → **前后端分离，根本不用模板引擎**（见下一节）。

## 8. 前后端分离架构 ★★★★★

### 8.1 演进历程

```
① 单体 + JSP（2000~2010）
   浏览器 ←HTML→ Servlet/JSP（一个项目，一个 war，一次部署）
   问题：前后端代码耦合，前端改一行要重启整个应用；无法多端复用

② MVC + AJAX 局部异步（2010~2015）
   JSP 页面 + jQuery AJAX 调用 Controller 的 @ResponseBody 接口
   问题：仍是混合模式，职责不清

③ 前后端分离（2015~至今）★ 主流
   浏览器/APP/小程序 ←JSON→ 后端 API（Spring Boot）
   前端独立工程（Vue/React）→ 构建为静态资源 → Nginx/CDN 部署
   后端只提供 RESTful API，不关心展示

④ 服务端渲染的回归（2020~，SEO 需求）
   Next.js / Nuxt.js：前端框架自己做 SSR（Node 服务器渲染 React/Vue）
   后端只提供 API，前端负责首屏 SSR + 客户端水合（Hydration）
```

### 8.2 前后端分离的架构

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐
│  浏览器/APP   │    │  Nginx / CDN  │    │   后端 API 服务集群     │
│  (Vue/React) │←──→│  静态资源      │←──→│   Spring Boot          │
│              │    │  反向代理      │    │   (只返回 JSON)         │
└─────────────┘    └──────────────┘    └─────────────────────┘
      前端工程独立                              后端工程独立
   npm run build                          mvn package → jar
   产出 dist/                             部署到 K8s / 虚拟机
```

```nginx
# Nginx 的标准配置（前端静态资源 + 后端 API 同域，★ 避免跨域）
server {
    listen 443 ssl http2;
    server_name www.example.com;

    # 前端静态资源
    location / {
        root /data/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;      # ★ SPA 路由的关键：找不到文件就返回 index.html
        # HTML 不缓存（保证发版后立即生效）
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 带 hash 的静态资源永久缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf)$ {
        root /data/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://backend-cluster/;     # ★ 末尾的 / 会去掉 /api 前缀
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;                 # ★ 后端处理超时
        proxy_send_timeout 60s;
        proxy_buffering on;
        proxy_buffer_size 16k;
        proxy_buffers 8 32k;
        # gzip
        gzip on;
        gzip_types application/json;
        gzip_min_length 1k;
    }

    # WebSocket（如果有）
    location /ws/ {
        proxy_pass http://backend-cluster/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;   # ★ WebSocket 升级必需
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;                  # ★ 长连接超时要设长
    }

    # 上传文件大小限制
    client_max_body_size 50m;
}

upstream backend-cluster {
    least_conn;                                 # 负载均衡策略
    server 10.0.1.10:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;                                # ★ 保持长连接（性能关键）
}
```

```javascript
// 前端的环境配置（Vite 示例）
// .env.development
VITE_API_BASE_URL=/api                    // 开发走 devServer proxy，无跨域
// .env.production
VITE_API_BASE_URL=https://api.example.com  // 生产走独立域名（需 CORS）或 /api（同域）

// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api/, '')
      }
    }
  }
}

// axios 封装
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  withCredentials: true                    // ★ 带 Cookie（跨域时需要）
})
http.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${getToken()}`
  cfg.headers['X-Request-Id'] = uuid()
  return cfg
})
http.interceptors.response.use(
  res => {
    if (res.data.code !== 0) {              // 业务错误
      message.error(res.data.message)
      return Promise.reject(res.data)
    }
    return res.data.data
  },
  err => {
    if (err.response?.status === 401) {     // ★ 未登录，跳登录页
      router.push('/login?redirect=' + route.fullPath)
    } else if (err.response?.status === 429) {
      message.warning('请求过于频繁')
    } else {
      message.error('网络异常，请稍后重试')   // ★ 不暴露后端错误细节
    }
    return Promise.reject(err)
  }
)
```

### 8.3 后端 API 设计规范（RESTful）

```java
// ─── 统一响应结构 ───
@Data
@AllArgsConstructor
public class Result<T> {
    private Integer code;          // 0=成功，非 0=业务错误码
    private String message;        // 提示信息
    private T data;                // 数据
    private Long timestamp;        // 时间戳
    private String traceId;        // ★ 链路追踪 ID（排查问题必备）

    public static <T> Result<T> success(T data) {
        return new Result<>(0, "success", data, System.currentTimeMillis(), TraceContext.getTraceId());
    }
    public static <T> Result<T> failed(ResultCode rc) {
        return new Result<>(rc.getCode(), rc.getMessage(), null, System.currentTimeMillis(), TraceContext.getTraceId());
    }
}

// ─── 分页响应 ───
@Data
public class PageResult<T> {
    private List<T> records;       // 当前页数据
    private long total;            // 总记录数
    private int pageNum;           // 当前页码
    private int pageSize;          // 每页大小
    private int pages;             // 总页数
    private boolean hasNext;        // 是否有下一页
    private boolean hasPrevious;
}

// ─── RESTful 风格的 Controller ───
@RestController
@RequestMapping("/api/v1/users")          // ★ 带版本号，便于 API 演进
@RequiredArgsConstructor
@Validated
public class UserController {

    private final UserService userService;

    /** GET /api/v1/users?pageNum=1&pageSize=20&keyword=x  分页查询 */
    @GetMapping
    public Result<PageResult<UserVO>> list(@Valid UserQuery query) {
        return Result.success(userService.page(query));
    }

    /** GET /api/v1/users/{id}  查询详情 */
    @GetMapping("/{id}")
    public Result<UserVO> get(@PathVariable @Min(1) Long id) {
        return Result.success(userService.getDetail(id));
    }

    /** POST /api/v1/users  创建 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)              // ★ 201
    public Result<Long> create(@RequestBody @Valid UserCreateDTO dto) {
        return Result.success(userService.create(dto));
    }

    /** PUT /api/v1/users/{id}  全量更新 */
    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody @Valid UserUpdateDTO dto) {
        userService.update(id, dto);
        return Result.success(null);
    }

    /** PATCH /api/v1/users/{id}/status  局部更新 */
    @PatchMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam Integer status) {
        userService.updateStatus(id, status);
        return Result.success(null);
    }

    /** DELETE /api/v1/users/{id}  删除 */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)           // ★ 204
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }

    /** POST /api/v1/users/{id}/disable  非 CRUD 的动作用「动词子资源」 */
    @PostMapping("/{id}/disable")
    public Result<Void> disable(@PathVariable Long id, @RequestParam String reason) {
        userService.disable(id, reason);
        return Result.success(null);
    }

    /** GET /api/v1/users/export  导出（返回文件流，不套 Result） */
    @GetMapping("/export")
    public void export(@Valid UserQuery query, HttpServletResponse response) throws IOException {
        userService.export(query, response);
    }
}
```

**RESTful 设计规范速查：**

| 规则 | 说明 | 正例 | 反例 |
| --- | --- | --- | --- |
| **资源用名词复数** | URL 表示资源集合 | `/api/v1/users` | `/api/getUserList` |
| **不用动词** | 动作由 HTTP 方法表达 | `POST /users` | `POST /createUser` |
| **层级表示关系** | 用路径表达从属 | `/users/1/orders` | `/getUserOrders?userId=1` |
| **带版本号** | 便于 API 演进 | `/api/v1/users` | `/api/users` |
| **查询用查询串** | 过滤/排序/分页 | `/users?status=1&sort=age,desc&page=1` | `/users/status/1` |
| **非 CRUD 动作用子资源** | 特殊操作用动词子路径 | `POST /users/1/disable` | `POST /disableUser` |
| **状态码语义正确** | 200/201/204/400/401/403/404/409/429/500 | — | 全部返回 200 |
| **统一响应结构** | 前端好处理 | `&#123;code,message,data&#125;` | 各接口格式不一 |
| **字段用 camelCase** | JSON 惯例 | (&#123;"userName":"x"&#125;) | (&#123;"user_name":"x"&#125;) |
| **时间用 ISO-8601** | 无歧义 | `"2026-09-07T10:30:00+08:00"` | `"2026/9/7 10:30"` |
| **不返回敏感字段** | 安全 | VO 中无 password | 直接返回实体 |
| **分页参数统一** | `pageNum/pageSize` 或 `page/size` | — | 各接口不同 |

### 8.4 前后端分离的关键问题与方案

| 问题 | 方案 |
| --- | --- |
| **跨域** | ① Nginx 同域部署（★ 推荐）② 开发用 devServer proxy ③ 后端 CORS 配置（见 [[后端/JavaWeb/Web基础与HTTP协议]]） |
| **认证** | ★ **JWT Token**（无状态，见 [[后端/JavaWeb/JWT认证与Web安全]]），放 `Authorization` 头 |
| **Session 共享** | 无状态 JWT 天然解决；若用 Session 则 Spring Session + Redis |
| **首屏 SEO** | ① SSR（Next.js/Nuxt）② 预渲染（prerender）③ 关键页面用 Thymeleaf |
| **接口文档** | ★ **Knife4j / SpringDoc（OpenAPI 3）**，自动生成 + 在线调试 |
| **Mock 联调** | Apifox / YApi / Mock.js（前端不依赖后端进度） |
| **版本管理** | URL 版本（`/v1/`）或 Header 版本（`Accept: application/vnd.api.v1+json`） |
| **错误处理** | 统一 `Result` 结构 + 业务错误码 + 全局异常处理器 |
| **文件上传** | 直传 OSS（后端只发签名）或后端中转（大文件用分片） |
| **文件下载** | 后端返回流 + `Content-Disposition`；大文件用 OSS 直链 |
| **实时通信** | WebSocket（同域代理要配 Upgrade 头）或 SSE |
| **登录态续期** | Access Token（短）+ Refresh Token（长）双令牌 |
| **权限控制** | 前端：路由守卫 + 按钮级指令；后端：★ **必须在服务端校验**（前端只是体验优化） |

```java
// ─── 接口文档：Knife4j（OpenAPI 3）───
// pom.xml
<dependency>
    <groupId>com.github.xiaoymin</groupId>
    <artifactId>knife4j-openapi3-jakarta-spring-boot-starter</artifactId>
    <version>4.5.0</version>
</dependency>

// application.yml
springdoc:
  api-docs:
    enabled: true
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html
    tags-sorter: alpha
    operations-sorter: alpha
  group-configs:
    - group: 用户模块
      paths-to-match: /api/v1/users/**
      packages-to-scan: com.example.controller
knife4j:
  enable: true
  setting:
    language: zh_cn
    enable-footer: false
    enable-open-api: false
  # ★ 生产环境必须关闭！
  production: false          # true = 屏蔽文档访问

// Controller 加注解
@Tag(name = "用户管理", description = "用户的增删改查接口")
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @Operation(summary = "分页查询用户", description = "支持按关键字、状态筛选")
    @Parameters({
        @Parameter(name = "pageNum", description = "页码，从 1 开始", example = "1"),
        @Parameter(name = "pageSize", description = "每页大小", example = "20")
    })
    @GetMapping
    public Result<PageResult<UserVO>> list(@Valid UserQuery query) { }

    @Operation(summary = "创建用户")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "创建成功"),
        @ApiResponse(responseCode = "409", description = "用户名已存在")
    })
    @PostMapping
    public Result<Long> create(@RequestBody @Valid UserCreateDTO dto) { }
}

// DTO 加注解
@Schema(description = "用户创建请求")
@Data
public class UserCreateDTO {
    @Schema(description = "用户名", example = "zhangsan", requiredMode = REQUIRED, maxLength = 50)
    @NotBlank(message = "用户名不能为空")
    private String username;

    @Schema(description = "手机号", example = "13800138000")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @Schema(description = "状态：0-禁用 1-启用", example = "1", allowableValues = {"0","1"})
    private Integer status;
}
```

### 8.5 前后端分离 vs 服务端渲染的取舍

| 维度 | 前后端分离（SPA + API） | 服务端渲染（Thymeleaf/JSP） |
| --- | --- | --- |
| **首屏速度** | 慢（要下载 JS bundle 再渲染） | **快**（直接返回 HTML） |
| **SEO** | ❌ **差**（爬虫拿到空 HTML） | ✅ **好** |
| **交互体验** | ✅ **好**（无刷新、流畅） | 一般（页面跳转为生） |
| **开发效率** | ✅ 前后端并行开发，职责清晰 | 前后端耦合，模板改要重启 |
| **多端复用** | ✅ **一套 API 服务 Web/APP/小程序** | ❌ 模板绑定 Web |
| **服务器压力** | ✅ 低（只返回 JSON，静态资源走 CDN） | 高（每次请求都渲染 HTML） |
| **部署复杂度** | 中（前端 + 后端 + Nginx） | **低**（一个 jar/war） |
| **技术栈** | 前端需要 Vue/React + 构建工具 | 只需 Java |
| **适用** | **中后台系统、SPA、多端应用** ★ | 官网、博客、SEO 敏感、简单内部系统 |

**现代最佳实践（2024+）：**

| 场景 | 推荐架构 |
| --- | --- |
| 企业中后台管理系统 | **前后端分离**（Vue/React + Spring Boot API），无 SEO 需求 |
| 电商/C 端网站 | **Next.js/Nuxt（SSR）+ Spring Boot API**（兼顾 SEO 和体验） |
| 官网/博客/文档站 | 静态站点生成（VitePress/Astro/Hugo）或 Thymeleaf |
| 简单内部工具 | Thymeleaf 单体（开发快，无需前端工程） |
| 移动 APP 后端 | 前后端分离（纯 API） |
| 小程序 | 前后端分离（纯 API） |

## 9. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | Spring Boot jar 部署用 JSP | 页面 404 / 无法编译 | 改用 Thymeleaf，或打 war 部署 |
| 2 | JSP 用 `<%! %>` 声明成员变量 | 数据串号（单例共享） | 只用局部变量 |
| 3 | JSP 中的 HTML 注释泄漏信息 | F12 看到敏感注释 | 用 `<%-- --%>` |
| 4 | `$&#123;&#125;` 直接输出用户输入 | **XSS 漏洞** | `<c:out>` 或 `fn:escapeXml` / `?html` |
| 5 | `fmt:formatDate` 处理 LocalDateTime | 报错或不生效 | 后端格式化，或用 Thymeleaf 的 `#temporals` |
| 6 | JSP 中硬编码 contextPath | 换部署路径就 404 | `$&#123;pageContext.request.contextPath&#125;` 或 `c:url` |
| 7 | JSP 放在 webapps 根目录 | 可被直接访问，绕过 Controller | 放 **WEB-INF** 下 |
| 8 | `sql` 标签库上生产 | 凭证泄漏、SQL 注入、性能差 | 禁用，逻辑移到 Service/DAO |
| 9 | `development=true` 上生产 | 每次请求检查文件修改，性能差 | 设 false |
| 10 | Thymeleaf 生产未开缓存 | 每次请求解析模板，性能差 | `spring.thymeleaf.cache=true` |
| 11 | Thymeleaf `th:utext` 输出用户数据 | XSS | 用 `th:text`（默认转义） |
| 12 | 前后端分离未处理跨域 | 浏览器拦截请求 | Nginx 同域 / CORS / devServer proxy |
| 13 | SPA 路由刷新 404 | Nginx 找不到 `/user/1` 的文件 | `try_files $uri $uri/ /index.html` |
| 14 | 静态资源被强缓存，发版不生效 | 用户看到旧页面 | HTML 用 no-cache，带 hash 的资源长缓存 |
| 15 | 前端存储 Token 用 localStorage | XSS 可窃取 | HttpOnly Cookie（配 CSRF 防护）或严格 CSP |
| 16 | 只在前端做权限控制 | 直接调 API 绕过 | ★ **后端必须校验权限** |
| 17 | 生产环境暴露 Swagger | 接口泄漏 | `knife4j.production=true` 或按 profile 禁用 |
| 18 | 接口无版本号 | API 演进破坏老客户端 | `/api/v1/` |
| 19 | 所有接口返回 200 | 前端无法用 HTTP 语义判断 | 正确使用 4xx/5xx |
| 20 | 直接返回实体（含密码哈希） | 敏感信息泄漏 | 转 VO，字段裁剪 |
| 21 | WebSocket 经 Nginx 代理失败 | 连接不上 | 配 `Upgrade`/`Connection` 头 + 长超时 |
| 22 | 上传大文件被 Nginx 拒绝 | 413 Request Entity Too Large | `client_max_body_size` |
| 23 | 跨域带 Cookie 失败 | CORS 报错 | `allowCredentials=true` + 具体 Origin + `SameSite=None; Secure` |
| 24 | Flash Attribute 在多次重定向后丢失 | 提示消息消失 | 只支持一次重定向，注意链路 |

---

## 关联笔记

- 上一篇：[[后端/JavaWeb/Tomcat架构与部署]]
- 下一篇：[[后端/JavaWeb/Filter-Listener与会话管理]]
- 相关：[[后端/JavaWeb/Servlet核心与生命周期]]（JSP 编译成 Servlet）、[[后端/JavaWeb/Web基础与HTTP协议]]（缓存与跨域）
- 框架层：[[后端/Spring/SpringMVC入门与执行流程]]（ViewResolver）、[[后端/SpringBoot/整合Web开发]]（RESTful API 与全局异常）
- 前端：[[前端/Vue/vue]]、[[前端/React/react]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
