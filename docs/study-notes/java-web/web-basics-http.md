---
title: "Web基础与HTTP协议"
aliases:
  - "HTTP 协议"
  - "HTTPS 原理"
  - "三次握手"
tags:
  - "后端"
  - "java"
  - "网络"
  - "面试"
category: "后端"
folder: "JavaWeb"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/JavaWeb/Servlet核心与生命周期]]"
  - "[[后端/JavaWeb/JWT认证与Web安全]]"
  - "[[后端/Java基础/网络编程]]"
  - "[[计算机基础/计算机网络/计算机网络第6章（应用层）]]"
created: 2026-09-07
updated: 2026-09-07
---

# Web 基础与 HTTP 协议

> 本篇聚焦**后端开发必须掌握的 HTTP/HTTPS 知识**：报文结构、状态码、会话管理、跨域、TCP 握手、HTTPS 加密流程。Socket 层面的 Java API 见 [[后端/Java基础/网络编程]]，更完整的网络分层见 [[计算机基础/计算机网络/计算机网络第6章（应用层）]]。

## 1. Web 架构基础

### 1.1 B/S 与 C/S

| 对比 | B/S（Browser/Server） | C/S（Client/Server） |
| --- | --- | --- |
| 客户端 | 浏览器（无需安装） | 专用客户端（需安装） |
| 升级 | 服务端更新即生效 | 客户端需逐个升级 |
| 跨平台 | ✅ 天然跨平台 | ❌ 需为每个平台开发 |
| 性能/体验 | 受浏览器和网络限制 | 本地计算，体验好 |
| 安全性 | 依赖网络传输安全 | 相对可控 |
| 代表 | 各类 Web 系统、后台管理 | QQ、微信 PC、IDEA |
| 现代融合 | Electron（VS Code）= Web 技术 + C/S 壳 | — |

### 1.2 一次完整的 Web 请求流程 ★★★★★

```
用户在浏览器输入 https://www.example.com/api/users 并回车
        │
① DNS 解析（域名 → IP）
        │  查找顺序：浏览器缓存 → 系统缓存 → hosts 文件 → 本地 DNS（运营商）
        │           → 根域名服务器(.) → 顶级域(.com) → 权威域名服务器(example.com)
        │  结果：93.184.216.34
        ▼
② 建立 TCP 连接（三次握手）
        │  客户端 ←→ 服务器（443 端口）
        ▼
③ TLS 握手（HTTPS 才有）
        │  协商加密算法、验证证书、生成会话密钥
        ▼
④ 发送 HTTP 请求
        │  GET /api/users HTTP/1.1
        │  Host: www.example.com
        │  Authorization: Bearer xxx
        ▼
⑤ 服务端处理
        │  Nginx（反向代理/负载均衡）
        │    → Tomcat（Servlet 容器，接收请求，交给线程池）
        │      → DispatcherServlet（Spring MVC 前端控制器）
        │        → Controller → Service → Mapper → MySQL / Redis
        │      ← 返回 JSON
        │    ← Nginx 可能做 gzip 压缩、缓存
        ▼
⑥ 返回 HTTP 响应
        │  HTTP/1.1 200 OK
        │  Content-Type: application/json;charset=UTF-8
        │  {"code":0,"data":[...]}
        ▼
⑦ 浏览器渲染（如果是 HTML）
        │  解析 HTML → 构建 DOM 树
        │  解析 CSS → 构建 CSSOM 树
        │  合并 → Render 树 → 布局（Layout）→ 绘制（Paint）→ 合成（Composite）
        │  遇到 JS：下载 + 执行（可能阻塞解析，除非 async/defer）
        ▼
⑧ 连接处理
           HTTP/1.0：默认关闭连接
           HTTP/1.1：默认 Keep-Alive（复用连接）
           HTTP/2：多路复用，一个连接并发多个请求
```

### 1.3 静态资源与动态资源

| | 静态资源 | 动态资源 |
| --- | --- | --- |
| 内容 | 固定不变，直接返回文件 | 由程序运行时生成 |
| 格式 | HTML、CSS、JS、图片、字体、视频 | JSP、Servlet、PHP、ASP、Controller 返回的 JSON |
| 服务器 | Nginx、Apache、CDN | Tomcat、Jetty、Undertow + 应用代码 |
| 缓存 | **强缓存友好**（CDN、浏览器长缓存） | 一般不缓存或短缓存 |
| 性能 | 极高 | 取决于业务逻辑 |

> **动静分离**：Nginx 处理静态资源（`location /static/ &#123; root /data/www; &#125;`），动态请求转发给 Tomcat（`proxy_pass http://backend;`）。这是 Web 性能优化的第一步。

## 2. HTTP 协议 ★★★★★

### 2.1 HTTP 报文结构

**请求报文：**

```
POST /api/orders?page=1 HTTP/1.1          ← ① 请求行：方法 URI 协议版本
Host: api.example.com                      ← ② 请求头（开始）
Content-Type: application/json;charset=UTF-8
Content-Length: 128
Accept: application/json
Accept-Encoding: gzip, deflate, br
User-Agent: Mozilla/5.0 ...
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Cookie: JSESSIONID=A1B2C3D4; theme=dark
Connection: keep-alive
X-Request-Id: 550e8400-e29b-41d4-a716-446655440000   ← 自定义头（链路追踪）
                                           ← ③ 空行（必须有！分隔头和体）
{"userId":1001,"items":[{"skuId":2001,"qty":2}]}     ← ④ 请求体（GET 通常无）
```

**响应报文：**

```
HTTP/1.1 200 OK                            ← ① 状态行：协议版本 状态码 原因短语
Content-Type: application/json;charset=UTF-8   ← ② 响应头
Content-Length: 256
Content-Encoding: gzip
Set-Cookie: JSESSIONID=X9Y8Z7; Path=/; HttpOnly; Secure; SameSite=Lax
Cache-Control: no-cache, no-store, must-revalidate
Access-Control-Allow-Origin: https://www.example.com
X-Trace-Id: 550e8400-e29b-41d4-a716-446655440000
Date: Sun, 07 Sep 2026 10:30:45 GMT
Server: nginx/1.24.0
                                           ← ③ 空行
{"code":0,"message":"success","data":{...}} ← ④ 响应体
```

### 2.2 请求方法 ★★★★★

| 方法 | 语义 | 幂等 | 安全 | 有请求体 | 可缓存 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| **GET** | 获取资源 | ✅ | ✅ | ❌（规范上不应有） | ✅ | 参数在 URL，有长度限制，会被缓存/收藏/留在历史 |
| **POST** | 创建资源 / 提交数据 | ❌ | ❌ | ✅ | ❌ | 重复提交会创建多个资源 |
| **PUT** | **整体更新**（幂等替换） | ✅ | ❌ | ✅ | ❌ | 客户端提供完整资源 |
| **PATCH** | **局部更新** | ❌（严格说） | ❌ | ✅ | ❌ | 只传要改的字段 |
| **DELETE** | 删除资源 | ✅ | ❌ | 可选 | ❌ | 重复删除同一资源结果相同 |
| **HEAD** | 只要响应头（不要体） | ✅ | ✅ | ❌ | ✅ | 探测资源是否存在、获取 Content-Length |
| **OPTIONS** | 查询支持的方法 | ✅ | ✅ | ❌ | — | **CORS 预检请求用** |
| TRACE | 回显请求（诊断） | ✅ | ✅ | ❌ | — | **有安全风险（XST），应禁用** |
| CONNECT | 建立隧道（代理） | — | — | — | — | HTTPS 代理用 |

**幂等性（Idempotency）★ 后端必考：**

> **幂等 = 同一请求执行一次和执行多次，对服务端状态的影响相同。**

```java
// 幂等的：GET、PUT、DELETE、HEAD、OPTIONS
//   GET /users/1            查多少次都不改变状态
//   PUT /users/1 {name:"A"} 改多少次结果都是 name="A"
//   DELETE /users/1         删一次和删多次，最终状态都是「已删除」
// 非幂等的：POST
//   POST /orders {amount:100}  调 3 次会创建 3 个订单！

// ─── 为什么幂等重要？───
// 1. 网络超时后的「自动重试」（Feign、RestTemplate、MQ 消费者）
// 2. 用户重复点击提交按钮
// 3. 消息队列的「至少一次投递」导致重复消费
// 4. 负载均衡的健康检查/故障转移重发

// ─── 实现幂等的 6 种方案 ───
// 方案 1：数据库唯一索引（★ 最简单可靠）
//   INSERT INTO orders (order_no, ...) VALUES (?, ...)
//   order_no 上加 UNIQUE 索引 → 重复插入抛 DuplicateKeyException → 捕获后返回「已存在」
try {
    orderMapper.insert(order);
} catch (DuplicateKeyException e) {
    log.warn("订单重复提交，orderNo={}", order.getOrderNo());
    return orderMapper.selectByOrderNo(order.getOrderNo());    // 返回已有订单
}

// 方案 2：Token 机制（防重复提交，前端配合）
//   ① 进入页面时 GET /token 获取一个唯一 token（存 Redis，TTL 5 分钟）
//   ② 提交时带上 token：POST /orders  Header: Idempotency-Key: <token>
//   ③ 服务端用 Redis 的 SETNX 原子判断：
Boolean ok = redisTemplate.opsForValue()
        .setIfAbsent("idem:" + token, "1", Duration.ofMinutes(5));
if (Boolean.FALSE.equals(ok)) {
    throw new BusinessException("请勿重复提交");
}
// ★ 必须用 SETNX（原子），不能先 get 再 set（有并发窗口）

// 方案 3：状态机（业务状态流转天然幂等）
// UPDATE orders SET status = 'PAID' WHERE id = ? AND status = 'PENDING'
int rows = orderMapper.updateStatus(orderId, PAID, PENDING);   // 带前置状态条件
if (rows == 0) {
    log.info("订单状态已变更，忽略重复请求");       // 已经支付过了
    return;
}

// 方案 4：乐观锁（version 字段）
// UPDATE product SET stock = stock - 1, version = version + 1
//  WHERE id = ? AND version = ?
int rows = productMapper.deductStock(skuId, version);
if (rows == 0) throw new BusinessException("数据已被修改，请重试");

// 方案 5：分布式锁（Redis / Redisson）
RLock lock = redisson.getLock("order:create:" + userId + ":" + skuId);
if (lock.tryLock(3, 10, TimeUnit.SECONDS)) {
    try {
        if (existsOrder(userId, skuId)) return existingOrder;    // 双重检查
        return createOrder(...);
    } finally { lock.unlock(); }
}

// 方案 6：去重表 / 请求日志表
//   把 (业务ID + 请求ID) 记入去重表（唯一索引），插入成功才处理业务
//   常用于支付回调、MQ 消费幂等
```

> 【规范】**对外接口设计原则**：
> - 查询用 GET，创建用 POST，全量更新用 PUT，局部更新用 PATCH，删除用 DELETE。
> - **POST 接口必须做幂等处理**（唯一索引 / Token / 状态机三选一）。
> - 支付、扣款、下单等关键操作**必须幂等 + 记录请求日志**。
> - 支付回调（微信/支付宝）会重试多次，**必须幂等**（用商户订单号做唯一约束）。

### 2.3 状态码 ★★★★★

| 分类 | 含义 |
| --- | --- |
| **1xx** 信息性 | 请求已接收，继续处理（100 Continue、101 Switching Protocols 用于 WebSocket） |
| **2xx** 成功 | 请求成功处理 |
| **3xx** 重定向 | 需要进一步操作才能完成 |
| **4xx** 客户端错误 | **请求本身有问题**（参数、权限、资源不存在） |
| **5xx** 服务端错误 | **服务端处理失败**（代码异常、依赖故障） |

**必背状态码：**

| 码 | 名称 | 含义 | 后端关注点 |
| --- | --- | --- | --- |
| **200** | OK | 成功 | 最常用 |
| **201** | Created | 资源创建成功 | POST 创建成功，响应头带 `Location` |
| **202** | Accepted | 已接受，异步处理中 | 提交异步任务（如导出、审核） |
| **204** | No Content | 成功但无响应体 | DELETE 成功、PUT 成功 |
| **206** | Partial Content | 部分内容 | **断点续传、视频拖动播放**（Range 请求） |
| **301** | Moved Permanently | **永久重定向** | ★ 会被浏览器/搜索引擎**缓存**，域名迁移用 |
| **302** | Found | **临时重定向** | 不缓存，登录后跳转、短链接 |
| **303** | See Other | 重定向到 GET | POST 后重定向（PRG 模式） |
| **304** | Not Modified | **协商缓存命中** | ★ 用本地缓存，不传响应体（省带宽） |
| **307** | Temporary Redirect | 临时重定向（保持方法） | 302 的严格版（302 可能被改成 GET） |
| **308** | Permanent Redirect | 永久重定向（保持方法） | 301 的严格版 |
| **400** | Bad Request | 请求语法错误 | 参数校验失败、JSON 格式错 |
| **401** | Unauthorized | **未认证**（没登录/token 失效） | ★ 应叫 Unauthenticated；前端应跳登录页 |
| **403** | Forbidden | **已认证但无权限** | 前端应提示「无权限」，不跳登录 |
| **404** | Not Found | 资源不存在 | 路由错误、ID 不存在 |
| **405** | Method Not Allowed | 方法不允许 | 用 POST 请求了只支持 GET 的接口 |
| **406** | Not Acceptable | 内容协商失败 | Accept 头无法满足 |
| **408** | Request Timeout | 客户端请求超时 | 请求发送太慢 |
| **409** | Conflict | 资源冲突 | ★ 唯一键冲突、版本号冲突、状态冲突 |
| **410** | Gone | 资源已永久删除 | 比 404 更明确 |
| **413** | Payload Too Large | 请求体过大 | 文件上传超限（Nginx `client_max_body_size`） |
| **415** | Unsupported Media Type | Content-Type 不支持 | 传了 form-data 但接口要 JSON |
| **422** | Unprocessable Entity | 语义错误 | 格式对但业务校验失败（REST 常用） |
| **429** | Too Many Requests | **请求过多（限流）** | ★ 限流触发，响应头带 `Retry-After` |
| **500** | Internal Server Error | 服务端异常 | ★ 未捕获异常的兜底；不要把栈信息返回给前端 |
| **501** | Not Implemented | 未实现 | — |
| **502** | Bad Gateway | **网关收到无效响应** | ★ Nginx 转发到后端，后端挂了/返回异常 |
| **503** | Service Unavailable | 服务不可用 | 过载、维护中（配 `Retry-After`） |
| **504** | Gateway Timeout | **网关等待后端超时** | ★ Nginx 的 `proxy_read_timeout` 到了，后端还没响应 |

> 【面试】**502 与 504 的区别（Nginx 场景，超高频）**：
> - **502 Bad Gateway**：Nginx 能连上后端，但**后端返回了无效响应**（连接被重置、后端进程崩溃、返回格式错误、后端拒绝连接）。
> - **504 Gateway Timeout**：Nginx 连上了后端并发送了请求，但**在 `proxy_read_timeout`（默认 60s）内没收到响应**。通常是后端处理太慢（慢 SQL、慢 RPC、线程池打满、Full GC）。
> - **排查方向**：502 看后端进程是否存活、错误日志；504 看后端的慢请求、线程池、GC。

**401 vs 403 的区别：**

```
401 Unauthorized：「我不知道你是谁」→ 未登录 / token 过期 / token 无效
                 → 前端应该跳转登录页
403 Forbidden：  「我知道你是谁，但你没资格」→ 已登录但权限不足
                 → 前端应该提示「无权限」，不跳登录

命名吐槽：401 的正确名称应该是 Unauthenticated（未认证），
        Unauthorized 语义上更接近 403。这是 HTTP 规范的历史遗留。
```

### 2.4 常用请求头与响应头 ★★★★★

**请求头：**

| 头 | 作用 | 示例 |
| --- | --- | --- |
| `Host` | 目标主机（HTTP/1.1 **必需**，虚拟主机靠它区分） | `api.example.com` |
| `User-Agent` | 客户端标识 | `Mozilla/5.0 ... Chrome/120` |
| `Accept` | 期望的响应类型 | `application/json, text/html;q=0.9` |
| `Accept-Encoding` | 支持的压缩算法 | `gzip, deflate, br` |
| `Accept-Language` | 期望语言 | `zh-CN,zh;q=0.9,en;q=0.8` |
| `Content-Type` | **请求体的 MIME 类型** | `application/json;charset=UTF-8` |
| `Content-Length` | 请求体字节数 | `128` |
| `Authorization` | **认证凭证** | `Bearer &lt;token&gt;`、`Basic &lt;base64&gt;` |
| `Cookie` | 携带 Cookie | `JSESSIONID=xxx; theme=dark` |
| `Referer` | 来源页面（防盗链、统计） | `https://www.example.com/list` |
| `Origin` | **跨域请求的来源**（CORS 用，只有协议+域名+端口） | `https://www.example.com` |
| `Connection` | 连接管理 | `keep-alive` / `close` |
| `Cache-Control` | 缓存策略（请求） | `no-cache`、`max-age=0` |
| `If-Modified-Since` | **协商缓存**：上次修改时间 | `Sun, 07 Sep 2026 10:00:00 GMT` |
| `If-None-Match` | **协商缓存**：ETag 校验 | `"a1b2c3d4"` |
| `If-Match` | 乐观锁（资源未变才更新） | `"a1b2c3d4"` |
| `Range` | 分段请求（断点续传） | `bytes=0-1023` |
| `X-Forwarded-For` | **代理链中的客户端真实 IP** | `1.2.3.4, 10.0.0.1` |
| `X-Real-IP` | 客户端真实 IP（Nginx 常设） | `1.2.3.4` |
| `X-Request-Id` | 链路追踪 ID | UUID |
| `Idempotency-Key` | **幂等键**（Stripe 推广的事实标准） | UUID |

**响应头：**

| 头 | 作用 | 示例 |
| --- | --- | --- |
| `Content-Type` | 响应体类型 | `application/json;charset=UTF-8` |
| `Content-Length` | 响应体字节数 | `256` |
| `Content-Encoding` | 压缩算法 | `gzip` |
| `Content-Disposition` | **文件下载**（附件名） | `attachment; filename="报表.xlsx"` |
| `Set-Cookie` | **设置 Cookie** | `JSESSIONID=x; Path=/; HttpOnly; Secure; SameSite=Lax` |
| `Location` | 重定向目标 | `/login` |
| `Cache-Control` | **强缓存策略** | `no-store`、`max-age=3600, public` |
| `ETag` | **协商缓存**的资源指纹 | `"a1b2c3d4"` |
| `Last-Modified` | 资源最后修改时间 | `Sun, 07 Sep 2026 10:00:00 GMT` |
| `Expires` | 过期时间（HTTP/1.0，绝对时间，受客户端时钟影响） | `Sun, 07 Sep 2026 11:00:00 GMT` |
| `Access-Control-Allow-Origin` | **CORS 允许的源** | `https://www.example.com` 或 `*` |
| `Access-Control-Allow-Methods` | CORS 允许的方法 | `GET,POST,PUT,DELETE,OPTIONS` |
| `Access-Control-Allow-Headers` | CORS 允许的请求头 | `Authorization,Content-Type` |
| `Access-Control-Allow-Credentials` | CORS 是否允许带 Cookie | `true` |
| `Access-Control-Max-Age` | **预检结果缓存时间**（秒） | `3600` |
| `Strict-Transport-Security` | **HSTS**（强制 HTTPS） | `max-age=31536000; includeSubDomains` |
| `X-Frame-Options` | 防点击劫持 | `DENY` / `SAMEORIGIN` |
| `Content-Security-Policy` | **CSP**（防 XSS） | `default-src 'self'` |
| `X-Content-Type-Options` | 禁止 MIME 嗅探 | `nosniff` |
| `Retry-After` | 限流/维护时的重试时间 | `60` |
| `Server` | 服务器标识（**生产应隐藏**） | `nginx` |

**Content-Type 常用值：**

| 值 | 说明 | Spring 中的处理 |
| --- | --- | --- |
| `application/json` | **JSON**（REST API 标准） | `@RequestBody` + Jackson |
| `application/x-www-form-urlencoded` | **表单**（`k1=v1&k2=v2`，浏览器默认） | `@RequestParam`、表单对象 |
| `multipart/form-data` | **文件上传**（二进制分段） | `MultipartFile` |
| `text/plain` | 纯文本 | — |
| `text/html` | HTML | 模板引擎 |
| `text/xml` / `application/xml` | XML | `@RequestBody` + JAXB |
| `application/octet-stream` | 二进制流（文件下载） | `ResponseEntity<byte[]>` |

```java
// Spring MVC 中的 Content-Type 处理
@PostMapping(value = "/json", consumes = MediaType.APPLICATION_JSON_VALUE)
public Result createJson(@RequestBody UserDTO dto) { }        // JSON → 对象

@PostMapping(value = "/form", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
public Result createForm(@ModelAttribute UserDTO dto) { }      // 表单 → 对象
public Result createForm2(@RequestParam String name, @RequestParam int age) { }   // 逐个取

@PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public Result upload(@RequestPart("file") MultipartFile file,
                     @RequestPart("meta") OrderDTO meta) { }   // 文件 + JSON 混合

@GetMapping(value = "/download", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
public ResponseEntity<Resource> download() {
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"报表.xlsx\"")
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .body(new FileSystemResource(file));
}
```

> 【坑】**`multipart/form-data` 中传 JSON 对象**：需要用 `@RequestPart` 而非 `@RequestParam`，且前端要把 JSON 作为独立的 part（设置该 part 的 Content-Type 为 application/json）。

### 2.5 HTTP 缓存机制 ★★★★★

```
浏览器请求资源
     │
     ▼
① 强缓存检查（不发请求！）
   ├── Cache-Control: max-age=3600（HTTP/1.1，优先级高）
   │     当前时间 - 首次缓存时间 < 3600 秒？
   └── Expires: Sun, 07 Sep 2026 11:00:00 GMT（HTTP/1.0，绝对时间）
     │
     ├── 命中 → ★ 直接用本地缓存，状态码 200（from disk/memory cache），零网络开销
     └── 未命中 ↓
② 协商缓存（发请求，带校验信息）
   ├── If-None-Match: "etag值"        ← 对应响应的 ETag（资源指纹，优先级高）
   └── If-Modified-Since: 时间         ← 对应响应的 Last-Modified
     │
     ├── 资源未变 → ★ 304 Not Modified（无响应体，省带宽）
     └── 资源已变 → 200 + 新的完整内容
```

**Cache-Control 指令详解：**

| 指令 | 作用 |
| --- | --- |
| `public` | 可被任何中间缓存（CDN、代理）缓存 |
| `private` | **只能被浏览器缓存**（中间代理不可缓存，含用户隐私数据时用） |
| `no-cache` | ★ **可以缓存，但每次使用前必须协商验证**（不是「不缓存」！） |
| `no-store` | ★ **完全不缓存**（每次都从服务器取，敏感数据用） |
| `max-age=3600` | 缓存有效期 3600 秒（相对时间） |
| `s-maxage=3600` | 中间代理的缓存时间（覆盖 max-age） |
| `must-revalidate` | 过期后必须重新验证（不允许用过期缓存） |
| `immutable` | 资源永不改变（浏览器刷新也不重新验证，用于带 hash 的静态资源） |
| `max-stale=60` | （请求头）可接受过期 60 秒内的缓存 |

**ETag 与 Last-Modified 的对比：**

| | Last-Modified | ETag |
| --- | --- | --- |
| 精度 | 秒级 | 任意（通常是 hash 或版本号） |
| 局限 | ① 1 秒内多次修改无法感知&lt;br&gt;② 文件只是 touch 但内容没变也会失效&lt;br&gt;③ 多服务器时钟不一致 | 需要计算（有开销） |
| 优先级 | 低 | **高**（两者都有时用 ETag） |
| 生成方式 | 文件修改时间 | Nginx：`etag on`（自动）；应用：内容 hash |

**Spring Boot 的缓存配置：**

```yaml
spring:
  web:
    resources:
      cache:
        cachecontrol:
          max-age: 3600               # 静态资源缓存 1 小时
          cache-public: true
          # no-cache: true            # 每次都协商
          # no-store: true            # 完全不缓存
      chain:
        strategy:
          content:
            enabled: true             # ★ 内容 hash 策略（文件名带 hash，可永久缓存）
            paths: /**
```

```java
// 手动控制缓存（Controller）
@GetMapping("/data")
public ResponseEntity<Data> getData() {
    Data data = service.get();
    String etag = "\"" + DigestUtils.md5Hex(JSON.toJSONString(data)) + "\"";

    // Spring 提供的工具：自动处理 If-None-Match，返回 304
    ResponseEntity.BodyBuilder builder = ResponseEntity.ok().eTag(etag);
    return builder.body(data);
}

// 用 ShallowEtagHeaderFilter（自动为响应生成 ETag，但会缓冲整个响应，慎用）
@Bean
public FilterRegistrationBean<ShallowEtagHeaderFilter> etagFilter() {
    FilterRegistrationBean<ShallowEtagHeaderFilter> bean = new FilterRegistrationBean<>();
    bean.setFilter(new ShallowEtagHeaderFilter());
    bean.addUrlPatterns("/api/*");
    return bean;
}

// WebMvcConfigurer 配置静态资源缓存
@Override
public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry.addResourceHandler("/static/**")
            .addResourceLocations("classpath:/static/")
            .setCacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic());
}
```

**前端静态资源的最佳缓存策略（版本化）：**

```
HTML 文件：      Cache-Control: no-cache        （每次协商，确保拿到最新的入口）
带 hash 的 JS/CSS：Cache-Control: max-age=31536000, immutable   （永久缓存）
                 文件名：app.3f8a2b1c.js  ← 内容变了 hash 就变，URL 也变，自动失效
图片/字体：      同上（永久缓存 + 版本化 URL）
API 响应：       Cache-Control: no-store        （默认不缓存，除非明确设计）
```

> 【坑】**API 接口默认不应该被缓存**。如果 Nginx 或 CDN 误缓存了 API 响应（尤其 GET 请求），会导致用户看到过期数据。明确设置 `Cache-Control: no-store` 或 `no-cache, no-store, must-revalidate` + `Pragma: no-cache`（兼容 HTTP/1.0）。

### 2.6 Cookie 与 Session ★★★★★

#### Cookie

**Cookie 是服务端通过 `Set-Cookie` 响应头写入浏览器的小段数据，浏览器在后续同源请求中自动通过 `Cookie` 请求头带上。用于在无状态的 HTTP 上维持状态。**

```
① 首次请求：浏览器 → 服务器（无 Cookie）
② 服务器响应：Set-Cookie: JSESSIONID=A1B2C3; Path=/; HttpOnly; Max-Age=1800
③ 浏览器存储 Cookie
④ 后续请求：浏览器自动带上 Cookie: JSESSIONID=A1B2C3
```

**Cookie 的属性：**

| 属性 | 作用 | 示例 |
| --- | --- | --- |
| `Name=Value` | 键值对 | `JSESSIONID=A1B2C3` |
| `Domain` | 生效的域名（含子域） | `Domain=.example.com`（a.example.com 也能用） |
| `Path` | 生效的路径 | `Path=/`（所有路径）、`Path=/api`（仅 /api 下） |
| **`Max-Age`** | 有效期（秒），**正数=持久化，0=立即删除，负数=会话级（关浏览器失效）** | `Max-Age=3600` |
| `Expires` | 过期时间（绝对时间，Max-Age 的旧版） | `Expires=Wed, 09 Jun 2027 10:00:00 GMT` |
| **`HttpOnly`** | ★ **禁止 JS 访问**（`document.cookie` 读不到），**防 XSS 窃取** | `HttpOnly` |
| **`Secure`** | ★ **只通过 HTTPS 传输** | `Secure` |
| **`SameSite`** | ★ **防 CSRF**：限制跨站请求携带 Cookie | `Strict` / `Lax` / `None` |

**SameSite 的三个值（★ 现代浏览器的默认行为，必须掌握）：**

| 值 | 行为 | 场景 |
| --- | --- | --- |
| `Strict` | **完全禁止跨站携带**：从外部链接点进来都不带 Cookie（需重新登录） | 高安全场景（银行） |
| **`Lax`**（Chrome 80+ **默认值**） | 允许「顶级导航的 GET 请求」携带（点链接、地址栏输入），**禁止** POST/iframe/ajax/图片跨站携带 | 大多数网站（平衡安全与体验） |
| `None` | 允许所有跨站携带（**必须同时设置 `Secure`**，否则被浏览器拒绝） | 跨域 API、第三方登录、iframe 嵌入 |

```
Lax 模式下的规则（★ 高频面试）：
✅ 携带 Cookie：<a href="https://other.com">链接跳转</a>、地址栏输入、form method="get"
❌ 不携带：    <form method="post>、fetch/ajax 跨站、<img src>、<iframe>、window.open 的部分场景

影响：
- 如果你的前后端分离且跨域（前端 a.com，后端 api.b.com），
  Cookie 必须设 SameSite=None; Secure，且 CORS 要配 allowCredentials
- Chrome 80 后默认 Lax，导致很多跨站 Cookie 失效（历史事故）
```

**Cookie 的操作：**

```java
// ─── 服务端设置 Cookie（Servlet）───
Cookie cookie = new Cookie("token", "abc123");
cookie.setPath("/");                                   // 全站生效
cookie.setMaxAge(7 * 24 * 3600);                       // 7 天
cookie.setHttpOnly(true);                              // ★ 防 XSS
cookie.setSecure(true);                                // ★ 只走 HTTPS
// cookie.setDomain(".example.com");                   // 跨子域共享
// JDK 10+/Servlet 6.0: cookie.setAttribute("SameSite", "Lax");
response.addCookie(cookie);

// Servlet 3.0 之前不能直接设 SameSite，需要手动写响应头
response.setHeader("Set-Cookie",
    String.format("token=%s; Path=/; Max-Age=%d; HttpOnly; Secure; SameSite=Lax",
                  token, 7 * 24 * 3600));

// ─── 服务端读取 Cookie ───
Cookie[] cookies = request.getCookies();
if (cookies != null) {
    for (Cookie c : cookies) {
        if ("token".equals(c.getName())) {
            String value = c.getValue();
        }
    }
}

// ─── 删除 Cookie（★ 经典坑）───
// 方法：设置同名 Cookie，Max-Age = 0，且 Path/Domain 必须与原来完全一致！
Cookie del = new Cookie("token", null);
del.setMaxAge(0);                    // ★ 0 = 立即删除
del.setPath("/");                    // ★ Path 必须一致，否则删不掉
del.setHttpOnly(true);
response.addCookie(del);

// ─── Spring Boot 中的 Cookie ───
@GetMapping("/set")
public void setCookie(@CookieValue(value = "old", required = false) String old,   // 读
                      HttpServletResponse response) {
    ResponseCookie cookie = ResponseCookie.from("theme", "dark")     // ★ Spring 的 ResponseCookie 支持 SameSite
            .path("/")
            .maxAge(Duration.ofDays(7))
            .httpOnly(true)
            .secure(true)
            .sameSite("Lax")                                          // ★ 直接支持
            .build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
}
```

**Cookie 的限制：**

| 限制 | 值 |
| --- | --- |
| 单个 Cookie 大小 | **约 4KB**（4096 字节，含名称和属性） |
| 每个域的 Cookie 数量 | **约 50 个**（不同浏览器略有差异，超过会淘汰最久未用的） |
| 总大小 | 各浏览器限制不同（通常几百 KB） |
| 自动发送 | **同源请求自动带上**（增加请求头大小，静态资源请求也带 → 用独立域名做 CDN 可避免） |

> 【优化】**静态资源用独立域名（如 static.example.com）**：主域 example.com 的 Cookie 不会被带到 static.example.com（如果 Cookie 的 Domain 设为 example.com 则会带），减少无谓的请求头开销。这是「Cookie-Free Domain」优化。

#### Session

**Session 是服务端保存的「用户会话状态」，通过 Cookie 中的 SessionID 关联。**

```
① 用户首次访问 → 服务端创建 HttpSession，生成唯一 SessionID
② 响应 Set-Cookie: JSESSIONID=xxx（HttpOnly）
③ 服务端在内存（或 Redis）中存储 Session 数据：session.setAttribute("user", userObj)
④ 后续请求带 Cookie: JSESSIONID=xxx → 服务端据此找回 Session → 识别用户
```

```java
// ─── Servlet 中的 Session ───
HttpSession session = request.getSession();            // 没有则创建
HttpSession session2 = request.getSession(false);      // ★ 没有则返回 null（不创建，用于检查登录状态）

session.setAttribute("user", loginUser);               // 存
LoginUser user = (LoginUser) session.getAttribute("user");   // 取
session.removeAttribute("user");                        // 删
session.getId();                                        // SessionID
session.getMaxInactiveInterval();                       // 超时时间（秒，默认 1800 = 30 分钟）
session.setMaxInactiveInterval(3600);                   // 设为 1 小时
session.invalidate();                                   // ★ 销毁 Session（登出时必须调用！）
session.getCreationTime();
session.getLastAccessedTime();
session.isNew();

// ─── Spring Boot 配置 ───
// application.yml
server:
  servlet:
    session:
      timeout: 30m                  # ★ 会话超时（默认 30 分钟）
      cookie:
        name: JSESSIONID
        http-only: true             # 默认 true
        secure: true                # 生产必须（HTTPS）
        same-site: lax              # ★ 防 CSRF
        max-age: 1800
      tracking-modes: cookie        # 只用 Cookie（禁用 URL 重写，防止 SessionID 泄漏）
      persistent: false             # 是否持久化到磁盘（重启恢复）
```

**Session vs Cookie vs Token：**

| 对比 | Cookie | Session | Token（JWT） |
| --- | --- | --- | --- |
| 存储位置 | **浏览器** | **服务端**（内存/Redis） | **客户端**（localStorage/Cookie） |
| 内容 | 小数据（≤4KB） | 任意对象 | 自包含的用户信息 + 签名 |
| 状态 | — | **有状态**（服务端要存） | **无状态**（服务端不存） |
| 安全性 | 可被 XSS 窃取（HttpOnly 缓解） | SessionID 可被窃取（会话劫持） | 签名防篡改，但**无法主动失效** |
| 跨域 | 受同源和 SameSite 限制 | 同 Cookie | ✅ **天然支持跨域**（放 Header） |
| 分布式扩展 | — | ❌ 需要 Session 共享（Redis/Sticky） | ✅ **天然支持**（无状态） |
| 服务端压力 | 无 | **有**（占内存） | 无（只需验证签名） |
| 主动注销 | 删除即可 | `invalidate()` | ❌ 需要黑名单（Redis） |
| 续期 | Max-Age | 访问自动续期 | 需要刷新令牌（Refresh Token） |
| 适用 | 记住偏好、追踪 | 传统单体应用 | **微服务、前后端分离、移动端** ★ |

**Session 的分布式问题（★ 面试高频）：**

```
问题：多台服务器 + 负载均衡时，Session 存在单机内存，用户请求被分发到不同机器就"丢失登录状态"

请求1 → Nginx → 服务器A（创建 Session，存 A 的内存）
请求2 → Nginx → 服务器B（B 的内存没有这个 Session！）→ 用户被要求重新登录
```

**五种解决方案：**

| 方案 | 原理 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **① Session 粘滞（Sticky Session）** | Nginx 用 `ip_hash` 或 Cookie 把同一用户固定路由到同一台服务器 | 无需改代码 | ★ 服务器宕机则 Session 丢失；负载不均；扩缩容困难 |
| **② Session 复制（Replication）** | Tomcat 集群内广播同步 Session | 无单点 | ★ Session 大时网络开销巨大，机器越多越差（O(n²)） |
| **③ Session 集中存储（Redis）★** | Session 存 Redis，所有服务器共享 | 扩展性好、支持宕机恢复 | 增加 Redis 依赖和网络开销 |
| **④ 客户端 Token（JWT）★★** | 不用 Session，状态放客户端 | **无状态，天然分布式** | 无法主动失效、Token 变大 |
| **⑤ 混合方案** | 短 Token + Redis 存刷新令牌 | 兼顾无状态和可控性 | 实现复杂 |

```xml
<!-- 方案 1：Nginx ip_hash -->
<upstream backend {
    ip_hash;                                  <!-- ★ 按客户端 IP 哈希，固定路由 -->
    server 192.168.1.10:8080;
    server 192.168.1.11:8080;
}
<!-- 缺陷：NAT/代理后的用户共享 IP → 全部落到同一台；移动端 IP 频繁变化 -->
```

```xml
<!-- 方案 3：Spring Session + Redis（★ 生产主流，零代码侵入）-->
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>
```

```java
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800)   // ★ 一个注解搞定
@Configuration
public class SessionConfig { }

// application.yml
spring:
  session:
    store-type: redis                # ★ 存 Redis
    timeout: 30m
    redis:
      namespace: myapp:session       # key 前缀（多应用共享 Redis 时隔离）
      flush-mode: on_save            # 保存时机（on_save 性能好，immediate 实时）
      save-mode: on_set_attribute
  redis:
    host: redis.internal
    port: 6379
    password: xxx

// 业务代码完全不用改，session.setAttribute 自动写入 Redis
// Redis 中的 key：spring:session:sessions:<sessionId>
```

> 【实践建议】**新项目直接用 JWT（无状态）**，除非有「服务端主动踢人下线」「实时修改用户权限」的强需求。已有 Session 项目做分布式改造，用 **Spring Session + Redis**（改动最小）。详见 [[后端/JavaWeb/JWT认证与Web安全]]。

### 2.7 跨域问题（CORS）★★★★★

**同源策略（Same-Origin Policy）：协议 + 域名 + 端口三者完全相同才算同源。** 浏览器限制跨源的 AJAX 请求、Cookie 读取、DOM 访问（**这是浏览器的安全机制，服务端之间调用不存在跨域**）。

```
基准：http://www.example.com:8080

http://www.example.com:8081/api    ❌ 端口不同
https://www.example.com:8080/api   ❌ 协议不同
http://api.example.com:8080/api    ❌ 域名不同（子域也算不同源）
http://www.example.com:8080/other  ✅ 同源
```

**跨域的表现（浏览器控制台的经典报错）：**

```
Access to XMLHttpRequest at 'http://api.example.com/users' from origin
'http://www.example.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

> 【关键认知】**跨域请求实际上已经到达服务端并被处理了**，只是浏览器发现响应中没有 `Access-Control-Allow-Origin` 头，于是**拦截了响应不给 JS**。所以「跨域问题」在服务端日志里可能看到请求成功，但前端拿不到数据。

**解决跨域的 6 种方案：**

```java
// ─── 方案 1：@CrossOrigin（Spring MVC，最简单，适合单个接口/Controller）───
@CrossOrigin(origins = "http://localhost:5173")           // 允许指定源
@CrossOrigin(origins = {"http://a.com", "http://b.com"},   // 多个源
             methods = {RequestMethod.GET, RequestMethod.POST},
             allowedHeaders = "*",
             allowCredentials = "true",                     // 允许带 Cookie
             maxAge = 3600)                                 // 预检结果缓存 1 小时
@RestController
public class UserController {
    @CrossOrigin("http://localhost:5173")                  // 也可只标在方法上
    @GetMapping("/users") public List<User> list() { }
}
// ⚠️ @CrossOrigin 不带参数时允许所有源（origins = "*"），生产环境不安全

// ─── 方案 2：全局配置（WebMvcConfigurer，★ 推荐）───
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")                        // 拦截路径
                .allowedOriginPatterns("https://*.example.com", "http://localhost:*")  // ★ 用 Patterns 支持通配符
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Content-Disposition", "X-Trace-Id")   // ★ 允许前端读取的响应头
                .allowCredentials(true)                        // 允许带 Cookie
                .maxAge(3600);                                 // 预检缓存
    }
}
// ⚠️ allowCredentials=true 时，allowedOrigins 不能用 "*"，必须指定具体域名或用 allowedOriginPatterns

// ─── 方案 3：CorsFilter（更底层，优先级高于拦截器，★ 与 Spring Security 配合时用）───
@Bean
public CorsFilter corsFilter() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOriginPatterns(List.of("https://*.example.com"));
    config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setExposedHeaders(List.of("Content-Disposition"));
    config.setAllowCredentials(true);
    config.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return new CorsFilter(source);
}
// 注册为 Filter 且设置高优先级
@Bean
public FilterRegistrationBean<CorsFilter> corsFilterRegistration(CorsFilter filter) {
    FilterRegistrationBean<CorsFilter> bean = new FilterRegistrationBean<>(filter);
    bean.setOrder(Ordered.HIGHEST_PRECEDENCE);        // ★ 最先执行（在鉴权之前）
    return bean;
}

// ─── 方案 4：手写 Filter（不依赖 Spring）───
@WebFilter("/*")
public class SimpleCorsFilter implements Filter {
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletResponse response = (HttpServletResponse) res;
        HttpServletRequest request = (HttpServletRequest) req;
        String origin = request.getHeader("Origin");
        // ★ 白名单校验（不要直接反射 origin，否则等于允许所有）
        if (isAllowedOrigin(origin)) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
            response.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Requested-With");
            response.setHeader("Access-Control-Max-Age", "3600");
            response.setHeader("Vary", "Origin");        // ★ 重要：告知缓存按 Origin 区分
        }
        // ★ 预检请求直接返回，不走后续业务
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_OK);
            return;
        }
        chain.doFilter(req, res);
    }
}

// ─── 方案 5：Nginx 层统一处理（★ 网关层解决，应用无感知）───
```

```nginx
# Nginx 配置 CORS
location /api/ {
    # 预检请求
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' $http_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization,Content-Type,X-Requested-With' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Max-Age' 3600;
        add_header 'Content-Length' 0;
        return 204;                       # ★ 204 No Content
    }
    add_header 'Access-Control-Allow-Origin' $http_origin always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    proxy_pass http://backend;
}
```

```java
// ─── 方案 6：反向代理（★ 生产最常用，根本不产生跨域）───
// 开发环境：Vite/Webpack 的 devServer proxy
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '')
      }
    }
  }
}
// 前端请求 http://localhost:5173/api/users → Vite 代理到 http://localhost:8080/users
// 浏览器看到的是同源请求，不存在跨域

// 生产环境：Nginx 同域部署（前端静态资源 + 后端 API 同一个域名）
// nginx.conf
server {
    listen 443 ssl;
    server_name www.example.com;
    location / {                              # 前端静态资源
        root /data/dist;
        try_files $uri $uri/ /index.html;     # ★ SPA 路由回退
    }
    location /api/ {                          # 后端 API（同域，无跨域）
        proxy_pass http://backend-service/;
    }
}
```

**CORS 的两种请求（★ 必考）：**

| | 简单请求（Simple Request） | 预检请求（Preflight Request） |
| --- | --- | --- |
| 触发条件 | ① 方法是 GET/POST/HEAD&lt;br&gt;② Content-Type 仅限：`application/x-www-form-urlencoded`、`multipart/form-data`、`text/plain`&lt;br&gt;③ 无自定义头（只有 CORS 安全头） | 不满足简单请求的任意条件 |
| 请求次数 | **请求流程** | **直接发送**，浏览器检查响应的 CORS 头 | **先发 OPTIONS 预检**，通过后再发真实请求 |
| 性能 | 好 | 多一次往返（可用 `Access-Control-Max-Age` 缓存预检结果） |

```
预检请求示例（前端发 PUT + JSON + Authorization 头）：

① OPTIONS /api/users/1 HTTP/1.1
   Origin: http://www.example.com
   Access-Control-Request-Method: PUT              ← 声明真实请求的方法
   Access-Control-Request-Headers: Authorization,Content-Type   ← 声明真实请求的头

② 服务端响应（204 或 200）
   HTTP/1.1 204 No Content
   Access-Control-Allow-Origin: http://www.example.com
   Access-Control-Allow-Methods: GET,POST,PUT,DELETE
   Access-Control-Allow-Headers: Authorization,Content-Type
   Access-Control-Allow-Credentials: true
   Access-Control-Max-Age: 3600                    ← ★ 预检结果缓存 1 小时

③ 预检通过 → 发送真实请求
   PUT /api/users/1 HTTP/1.1
   Origin: http://www.example.com
   Authorization: Bearer xxx
   Content-Type: application/json
   {...}

④ 真实响应必须也带 Access-Control-Allow-Origin，否则浏览器仍然拦截
```

**CORS 的常见坑：**

```java
// 坑 1：allowCredentials=true 时用 allowedOrigins("*")
// → 启动报错：When allowCredentials is true, allowedOrigins cannot contain "*"
// ✅ 用 allowedOriginPatterns("*") 或指定具体域名

// 坑 2：Access-Control-Allow-Origin 设为 * 且带 Cookie
// → 浏览器拒绝（规范禁止 * 与 credentials 共存）
// ✅ 必须回显具体的 Origin（且做白名单校验）

// 坑 3：预检请求被鉴权拦截器拦截，返回 401
// → 前端报 CORS 错误（其实是 401）
// ✅ 拦截器/Security 配置中放行 OPTIONS：
@Override
public boolean preHandle(HttpServletRequest req, HttpServletResponse resp, Object handler) {
    if ("OPTIONS".equalsIgnoreCase(req.getMethod())) return true;    // ★ 放行预检
    // ... 鉴权逻辑
}
// Spring Security:
http.authorizeHttpRequests(auth -> auth
    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()          // ★ 放行预检
    .anyRequest().authenticated());

// 坑 4：CORS 配置被 Spring Security 覆盖
// ✅ Security 中启用：http.cors(Customizer.withDefaults())，并提供 CorsConfigurationSource Bean

// 坑 5：Filter 顺序问题（CORS Filter 在鉴权 Filter 之后）
// ✅ 设置最高优先级 Ordered.HIGHEST_PRECEDENCE

// 坑 6：前端读不到自定义响应头（如 Content-Disposition 的文件名）
// → 默认只暴露 6 个 CORS 安全头
// ✅ 服务端加 exposedHeaders("Content-Disposition", "X-Trace-Id")

// 坑 7：重定向导致的 CORS 失败
// → 跨域请求被 302 重定向到另一个域，CORS 头丢失
// ✅ 避免跨域重定向，或在重定向响应中也带 CORS 头

// 坑 8：忘记 Vary: Origin
// → CDN/代理缓存了某个 Origin 的响应，其他 Origin 的请求拿到错误的 Allow-Origin
// ✅ 反射 Origin 时必须加 Vary: Origin

// 坑 9：以为服务端之间调用也有跨域
// ★ 跨域是【浏览器】的安全策略！服务端调服务端（Feign、RestTemplate）不存在跨域
```

### 2.8 HTTP 版本演进 ★★★★★

| 特性 | HTTP/1.0 | HTTP/1.1 | HTTP/2 | HTTP/3 |
| --- | --- | --- | --- | --- |
| 发布年份 | 1996 | 1999 | 2015 | 2022（RFC 9114） |
| **连接复用** | ❌ 每请求一连接 | ✅ **Keep-Alive 长连接** | ✅ 长连接 + **多路复用** | ✅ |
| **管线化 Pipelining** | ❌ | 支持但**未普及**（队头阻塞） | ✅ 彻底解决 | ✅ |
| **队头阻塞（HOL）** | 有 | **有**（TCP 层） | HTTP 层解决，**TCP 层仍有** | **彻底解决**（基于 UDP/QUIC） |
| **头部压缩** | ❌ | ❌ | ✅ **HPACK** | ✅ **QPACK** |
| **二进制分帧** | ❌ 文本 | ❌ 文本 | ✅ **二进制** | ✅ |
| **服务端推送** | ❌ | ❌ | ✅ Server Push（已废弃） | ✅ |
| **优先级/流控** | ❌ | ❌ | ✅ Stream 优先级 | ✅ |
| **传输层** | TCP | TCP | TCP + TLS | **QUIC（基于 UDP）** |
| **握手次数** | TCP 3 次 + TLS 2 次 | 同左 | 同左 | **0-RTT / 1-RTT**（连接迁移） |
| 加密 | 可选 | 可选 | **事实上强制 TLS** | **强制**（QUIC 内置 TLS 1.3） |

**HTTP/1.1 的核心问题 —— 队头阻塞（Head-of-Line Blocking）：**

```
HTTP/1.1 一个连接上请求必须串行（Pipeline 虽可并发发送，但响应必须按序返回）：
  连接1: [请求A──────────][请求B][请求C]     ← B 必须等 A 的响应完成
  浏览器的缓解手段：对同一域名开 6 个并行连接 + 域名分片（img1.cdn.com, img2.cdn.com）
  → 治标不治本，且 TCP 握手开销大

HTTP/2 的多路复用（Multiplexing）：
  一个 TCP 连接上，多个 Stream 的 Frame 可以交错传输
  连接1: [A1][B1][A2][C1][B2][A3]...       ← 三个请求同时进行，无需等待
  → 一个域名只需一个连接

但 HTTP/2 仍有 TCP 层的队头阻塞：
  TCP 是有序字节流，任何一个包丢失 → 整个连接的所有 Stream 都要等重传
  → 弱网环境下 HTTP/2 可能比 HTTP/1.1 还慢

HTTP/3 用 QUIC（基于 UDP）彻底解决：
  每个 Stream 独立管理丢包重传，一个 Stream 丢包不影响其他 Stream
  + 0-RTT 连接建立 + 连接迁移（网络切换 WiFi→4G 不断连接，靠 Connection ID 而非四元组）
```

**后端开发的实践关注点：**

```java
// 1. Nginx 开启 HTTP/2（只需一行）
// listen 443 ssl http2;
// 注意：Nginx 1.25.1+ 改为 http2 on; 独立指令

// 2. Spring Boot 开启 HTTP/2（需要 HTTPS）
server:
  http2:
    enabled: true
  ssl:
    key-store: classpath:keystore.p12
    key-store-password: xxx

// 3. 判断客户端协议版本
String protocol = request.getProtocol();      // "HTTP/1.1" 或 "HTTP/2.0"
// Servlet 6.0（Tomcat 10.1+）支持 HTTP/2 的推送
// response.newPushBuilder()... （HTTP/2 Server Push，已被 Chrome 移除支持，不推荐）

// 4. HTTP/2 的最佳实践
// - 不再需要「域名分片」（一个连接够用）
// - 不再需要「雪碧图合并」（多路复用，小文件也快）
// - 不再需要「JS/CSS 过度合并」（但要权衡缓存粒度）
// - ★ 仍需 gzip/brotli 压缩、仍需缓存策略
```

## 3. HTTPS 与 TLS ★★★★★

### 3.1 为什么需要 HTTPS

HTTP 的三大问题：
1. **明文传输**：内容可被窃听（运营商劫持、公共 WiFi 抓包）。
2. **无法验证身份**：可能是中间人伪装的服务器。
3. **无法防篡改**：内容可被修改（注入广告、篡改支付金额）。

HTTPS = HTTP + **TLS/SSL**，解决：
- **加密**（防窃听）：对称加密传输数据。
- **身份认证**（防伪装）：CA 证书验证服务器身份。
- **完整性校验**（防篡改）：消息摘要（MAC）。

### 3.2 加密体系

| 加密类型 | 特点 | 速度 | 用途 | 算法 |
| --- | --- | --- | --- | --- |
| **对称加密** | 加密解密**同一个密钥** | **快**（百倍于非对称） | **加密通信内容** | AES-128/256（GCM/CBC）、ChaCha20、DES（淘汰）、3DES（淘汰） |
| **非对称加密** | **公钥加密、私钥解密**（或私钥签名、公钥验签） | 慢 | **交换对称密钥、数字签名** | RSA（2048/4096）、**ECDHE/ECDSA**（椭圆曲线，更短更快）、DSA |
| **摘要算法** | 单向不可逆，输出定长哈希 | 快 | **完整性校验、签名前压缩** | SHA-256、SHA-384、MD5（不安全）、SHA-1（不安全） |

**为什么混合使用？** 非对称加密慢（RSA 2048 比 AES 慢约 1000 倍），不适合加密大量数据；对称加密快但**密钥分发困难**（怎么安全地把密钥给对方？）。**解决方案：用非对称加密「安全地协商出对称密钥」，之后用对称密钥加密通信内容。**

### 3.3 数字证书与 CA

```
问题：非对称加密中，如何确认「这个公钥真的属于 example.com」而不是中间人的？
      → 需要可信第三方（CA, Certificate Authority）来背书

数字证书的内容（X.509 标准）：
┌────────────────────────────────────────┐
│ 版本号（v3）                              │
│ 序列号（唯一）                             │
│ 签名算法（sha256WithRSAEncryption）        │
│ 颁发者（Issuer: DigiCert Global Root CA）  │
│ 有效期（Not Before / Not After）           │
│ 主体（Subject: CN=www.example.com）        │
│ 主体公钥（Public Key Info）★               │
│ 扩展信息：                                 │
│   - Subject Alternative Name (SAN) ★ 多域名 │
│   - Key Usage（密钥用途）                   │
│   - Extended Key Usage（serverAuth）       │
│   - CRL Distribution Points（吊销列表地址）  │
│   - OCSP URL（在线状态查询）                 │
│ ★ CA 的数字签名（用 CA 私钥对上述内容签名）    │
└────────────────────────────────────────┘

证书链（信任链）：
  根证书（Root CA，自签名，★ 预装在操作系统/浏览器中）
      ↓ 签发
  中间证书（Intermediate CA）
      ↓ 签发
  服务器证书（example.com）

验证过程：
  ① 用「中间 CA 的公钥」验证「服务器证书」的签名 → 确认服务器证书合法
  ② 用「根 CA 的公钥」验证「中间证书」的签名 → 确认中间证书合法
  ③ 根证书在本地信任库中 → 信任链建立完成
  ④ 额外检查：有效期、域名匹配（SAN）、是否被吊销（CRL/OCSP）
```

**证书类型：**

| 类型 | 验证内容 | 签发速度 | 价格 | 适用 |
| --- | --- | --- | --- | --- |
| **DV**（Domain Validation） | 只验证域名所有权 | **分钟级** | 免费~低价（Let's Encrypt） | 个人站、内部系统 |
| **OV**（Organization Validation） | 验证域名 + 组织信息 | 数天 | 中 | 企业官网 |
| **EV**（Extended Validation） | 严格验证法律实体 | 数天~周 | 高 | 银行、电商（浏览器曾显示绿色公司名，现已取消） |

```bash
# 免费证书：Let's Encrypt（90 天有效期，需自动续期）
certbot --nginx -d example.com -d www.example.com
# 自动续期
certbot renew --dry-run

# 云厂商免费 DV 证书：阿里云、腾讯云（1 年期，每年可申请 20 个）

# 查看证书信息
openssl x509 -in cert.pem -text -noout
openssl s_client -connect www.example.com:443 -servername www.example.com < /dev/null 2>/dev/null | openssl x509 -noout -dates -subject -issuer
# 浏览器：点击地址栏锁图标 → 证书

# Java 的证书管理（keytool）
keytool -list -keystore $JAVA_HOME/lib/security/cacerts -storepass changeit   # JDK 信任的根证书
keytool -import -alias letsencrypt -file cert.pem -keystore cacerts -storepass changeit
keytool -genkeypair -alias mykey -keyalg RSA -keysize 2048 -validity 365 \
        -keystore server.p12 -storetype PKCS12 -storepass 123456 \
        -dname "CN=localhost, OU=Dev, O=Example, L=City, ST=State, C=CN"
```

### 3.4 TLS 握手过程 ★★★★★（必考）

**TLS 1.2 的握手（2-RTT）：**

```
客户端                                                  服务器
  │                                                        │
  │ ① ClientHello                                          │
  │   - 支持的 TLS 版本（1.2）                                │
  │   - 密码套件列表（TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256...）│
  │   - 客户端随机数 Client Random（32 字节）                   │
  │   - 会话 ID / Session Ticket（用于会话恢复）                 │
  ├───────────────────────────────────────────────────────→│
  │                                                        │
  │ ② ServerHello                                          │
  │   - 选定的 TLS 版本和密码套件                              │
  │   - 服务端随机数 Server Random（32 字节）                   │
  │   - 会话 ID                                             │
  │ ③ Certificate（服务器证书链）                              │
  │ ④ ServerKeyExchange ★（ECDHE 的公钥 + 用私钥的签名）        │
  │ ⑤ (CertificateRequest，双向认证时才发)                     │
  │ ⑥ ServerHelloDone                                       │
  │←───────────────────────────────────────────────────────┤
  │                                                        │
  │ ★ 客户端验证证书（CA 签名、有效期、域名、吊销状态）             │
  │                                                        │
  │ ⑦ ClientKeyExchange（客户端的 ECDHE 公钥）                 │
  │    → 双方各自用「自己的私钥 + 对方的公钥」计算出相同的         │
  │      Pre-Master Secret（ECDH 算法的数学特性）               │
  │ ⑧ (CertificateVerify，双向认证时)                         │
  │ ⑨ ChangeCipherSpec（之后用协商的密钥加密）                   │
  │ ⑩ Finished（用密钥加密的握手摘要，验证握手完整性）             │
  ├───────────────────────────────────────────────────────→│
  │                                                        │
  │ ⑪ ChangeCipherSpec + Finished                           │
  │←───────────────────────────────────────────────────────┤
  │                                                        │
  │ ★ 会话密钥 = PRF(Pre-Master Secret, Client Random, Server Random)
  │ 之后用对称加密（AES-GCM）通信                               │
```

**为什么需要三个随机数？** 增加随机性，任一方的随机数都能影响最终密钥，防止重放。

**TLS 1.3 的改进（1-RTT，甚至 0-RTT）★★★★★：**

| 改进 | 说明 |
| --- | --- |
| **握手只需 1-RTT** | ClientHello 中就带上密钥共享参数（key_share），省掉一轮往返 |
| **0-RTT 恢复** | 用 PSK（Pre-Shared Key）恢复会话时，第一个包就能带应用数据（★ 有重放风险，只能用于幂等请求） |
| **移除不安全算法** | 删除 RSA 密钥交换（不支持前向安全）、RC4、3DES、MD5、SHA-1、静态 DH、CBC 模式 |
| **只保留 AEAD 加密** | AES-GCM、ChaCha20-Poly1305（加密 + 认证一体） |
| **强制前向安全** | **只用 ECDHE/DHE** 密钥交换（即使服务器私钥泄漏，历史会话也无法解密）★ |
| **握手过程加密** | ServerHello 之后的所有内容都加密（证书信息不再明文暴露） |
| **简化密码套件** | 从 30+ 个精简到 5 个 |

**前向安全（Forward Secrecy / PFS）★ 重要概念：**

```
问题：如果用 RSA 密钥交换（客户端用服务器公钥加密 Pre-Master 后发送），
     一旦服务器私钥泄漏，攻击者可以解密【所有历史录制的流量】

解决：用 ECDHE（临时密钥交换）
     - 每次会话生成【临时的】DH 密钥对，会话结束即丢弃
     - 服务器只用长期私钥【签名】临时公钥（证明身份），不参与加密
     - 即使长期私钥泄漏，也无法还原临时私钥 → 历史流量安全
     
TLS 1.3 强制要求 ECDHE，所以默认具备前向安全性
```

```bash
# Java 中配置 TLS
-Dhttps.protocols=TLSv1.3,TLSv1.2
-Djdk.tls.client.protocols=TLSv1.3
# 配置文件 $JAVA_HOME/conf/security/java.security
jdk.tls.disabledAlgorithms=SSLv3, TLSv1, TLSv1.1, RC4, DES, MD5withRSA, \
    DH keySize < 1024, EC keySize < 224, 3DES_EDE_CBC, anon, NULL

# Nginx 的推荐 TLS 配置
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:...;
ssl_prefer_server_ciphers off;         # TLS 1.3 下应由客户端选择
ssl_session_cache shared:SSL:10m;      # ★ 会话缓存（减少完整握手）
ssl_session_timeout 10m;
ssl_session_tickets on;                # Session Ticket
ssl_stapling on;                       # ★ OCSP Stapling（服务器代查证书状态，客户端更快）
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;  # ★ HSTS
```

### 3.5 HTTPS 的性能优化

| 优化 | 手段 |
| --- | --- |
| **减少握手** | Keep-Alive 长连接、HTTP/2 多路复用、TLS 1.3（1-RTT） |
| **会话恢复** | Session Cache（`ssl_session_cache`）、Session Ticket、TLS 1.3 PSK |
| **OCSP Stapling** | 服务端代查证书状态并缓存，避免客户端查询 CRL（慢） |
| **硬件加速** | AES-NI 指令集（现代 CPU 都支持，AES 几乎无开销） |
| **证书链精简** | 只发必要的中间证书（避免冗余） |
| **ECDHE 替代 RSA** | 密钥更短（256 位 ECDHE ≈ 3072 位 RSA），计算更快 |
| **HSTS** | 避免 HTTP→HTTPS 的 301 重定向往返 |

## 4. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | GET 传敏感信息 | 参数留在浏览器历史、日志、Referer | 敏感数据用 POST body |
| 2 | GET URL 过长 | 414 URI Too Long | 改 POST，或用短 ID |
| 3 | POST 接口不做幂等 | 重复提交产生多条数据 | 唯一索引 / Token / 状态机 |
| 4 | 混淆 401 与 403 | 前端跳错页面 | 401=未认证（跳登录），403=无权限（提示） |
| 5 | 502/504 排查方向错 | 找错原因 | 502=后端挂了/响应无效，504=后端太慢超时 |
| 6 | Cookie 未设 HttpOnly | XSS 可窃取 Cookie | 一律 HttpOnly |
| 7 | Cookie 未设 Secure | HTTP 明文传输 Cookie | 生产必须 Secure |
| 8 | 未设 SameSite | CSRF 风险 / 跨站 Cookie 失效 | Lax（默认）或 None+Secure（跨域需要） |
| 9 | 删除 Cookie 时 Path 不一致 | 删不掉 | Path/Domain 必须与设置时完全相同 |
| 10 | Cookie 存太多/太大 | 每个请求都带，浪费带宽 | 只存 SessionID，数据放服务端 |
| 11 | 分布式环境 Session 丢失 | 用户频繁掉登录 | Spring Session + Redis，或改用 JWT |
| 12 | `allowCredentials=true` + `origins=*` | 启动报错/浏览器拒绝 | 用 `allowedOriginPatterns` 或具体域名 |
| 13 | OPTIONS 预检被鉴权拦截 | 前端报 CORS 错误（实为 401） | 放行 OPTIONS |
| 14 | CORS 配置被 Security 覆盖 | 配置不生效 | `http.cors()` + `CorsConfigurationSource` |
| 15 | 反射 Origin 不加白名单 | 任意站点可跨域调用（CSRF） | 白名单校验 + `Vary: Origin` |
| 16 | 前端读不到自定义响应头 | Content-Disposition 拿不到 | `exposedHeaders` |
| 17 | 以为服务端调用有跨域 | 误解 | 跨域只是浏览器策略 |
| 18 | API 响应被 CDN 缓存 | 用户看到过期数据 | `Cache-Control: no-store` |
| 19 | `no-cache` 理解为不缓存 | 缓存行为不符预期 | `no-cache`=可缓存但需验证，`no-store`=不缓存 |
| 20 | 静态资源未版本化 | 更新后用户看到旧版 | 文件名带 hash + 长期缓存 |
| 21 | 用 TLS 1.0/1.1 | 安全扫描不合规 | 只启用 TLS 1.2/1.3 |
| 22 | 自签证书上生产 | 浏览器警告 | 用 Let's Encrypt 免费证书 |
| 23 | 证书过期未续期 | 站点无法访问 | 监控证书有效期 + 自动续期（certbot） |
| 24 | 未配 HSTS | 首次 HTTP 访问可被劫持（SSL Strip） | `Strict-Transport-Security` |
| 25 | 双向认证未导入客户端证书 | 握手失败 | keytool 导入信任库 |
| 26 | HTTP/2 未开或配置错 | 性能未提升 | Nginx `http2 on` + 有效证书 |
| 27 | 重定向跨域丢失 CORS 头 | 前端报错 | 避免跨域重定向 |
| 28 | 用 TRACE 方法 | XST 攻击风险 | Nginx 中禁用（`limit_except`） |

---

## 关联笔记

- 下一篇：[[后端/JavaWeb/Servlet核心与生命周期]]
- 相关：[[后端/JavaWeb/JWT认证与Web安全]]（认证方案与安全攻防）、[[后端/JavaWeb/Filter-Listener与会话管理]]（Cookie/Session 的代码实现）
- 底层：[[后端/Java基础/网络编程]]（Socket、TLS 编程）
- 部署：[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]（Nginx 反向代理、HTTPS 配置）
- 计算机基础：[[计算机基础/计算机网络/计算机网络第6章（应用层）]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
