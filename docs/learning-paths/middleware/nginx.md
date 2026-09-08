# Nginx 学习路线

Nginx 是高性能的 Web 服务器、反向代理、负载均衡器，也是 API 网关、HTTP 缓存、流媒体服务器。它的异步事件驱动架构让它能用极少的资源处理海量并发，C10K 问题的终结者，互联网基础设施的基石。这条路线会带你从基础配置到高级特性，从性能调优到架构设计。

## 基础篇：架构与核心概念

### Nginx 的架构
- Master 进程：管理进程，读取配置、管理 Worker
- Worker 进程：工作进程，处理实际请求（多个）
- Cache Manager：缓存管理进程
- Cache Loader：缓存加载进程
- 多进程模型：进程隔离，稳定性高
- 事件驱动：epoll（Linux）、kqueue（BSD）、select/poll

### 为什么 Nginx 这么快
- 异步非阻塞：不等待 IO，单 Worker 处理数千连接
- 事件驱动：epoll 高效处理大量连接
- 内存池：预分配内存，减少内存分配开销
- 零拷贝：sendfile 系统调用，减少数据拷贝
- 轻量级：C 语言编写，占用资源少
- 多 Worker：充分利用多核 CPU

### Nginx vs Apache
- 架构：Nginx 异步非阻塞，Apache 进程/线程（阻塞）
- 并发：Nginx 处理静态文件和高并发更优
- 动态内容：Apache 模块生态更丰富
- 内存占用：Nginx 更低
- 配置：Nginx 更简洁，Apache 更灵活（.htaccess）
- 选择：高并发静态内容用 Nginx，复杂动态内容用 Apache

### 配置文件结构
- 全局块：影响 Nginx 整体的指令（worker_processes）
- events 块：网络连接相关配置
- http 块：HTTP 服务器相关配置
- server 块：虚拟主机配置
- location 块：请求路由匹配
- upstream 块：上游服务器组配置

### 配置指令的继承
- 子块继承父块：server 继承 http，location 继承 server
- 覆盖规则：子块指令覆盖父块同名指令
- 数组指令：累加而非覆盖（如 proxy_set_header）

## 核心功能篇

### 虚拟主机
- 基于域名：server_name 指令
- 基于 IP：listen 指令绑定不同 IP
- 基于端口：listen 指令绑定不同端口
- 默认 server：default_server 标记
- 泛域名匹配：*.example.com、.example.com
- 正则域名：~^www\.(.+)\.com$

### Location 匹配规则
- 精确匹配：= /path
- 前缀匹配：/path（最长匹配优先）
- 优先前缀：^~ /path（匹配后停止正则匹配）
- 正则匹配：~ /path（区分大小写）、~* /path（不区分大小写）
- 匹配顺序：精确 > 优先前缀 > 正则（按顺序）> 最长前缀

### 静态文件服务
- root vs alias：root 拼接路径，alias 替换路径
- index：默认文件
- autoindex：目录列表
- try_files：按顺序尝试文件
- 缓存头：expires、Cache-Control
- Gzip 压缩：gzip、gzip_types

### 日志配置
- access_log：访问日志
- error_log：错误日志
- 日志格式：log_format 自定义格式
- 日志缓冲：buffer 参数减少磁盘 IO
- 日志轮转：logrotate 工具
- 日志分析：GoAccess、ELK、Nginx Amplify

## 反向代理篇

### 反向代理基础
- proxy_pass：指定上游服务器
- 协议支持：HTTP、HTTPS、FastCGI、uWSGI、SCGI、memcached
- URL 处理：有无尾斜杠的区别
- 请求头传递：proxy_set_header
- 超时设置：proxy_connect_timeout、proxy_read_timeout

### 请求头处理
- Host：proxy_set_header Host $host
- X-Real-IP：客户端真实 IP
- X-Forwarded-For：请求经过的代理链
- X-Forwarded-Proto：原始请求协议（HTTP/HTTPS）
- X-Forwarded-Host：原始请求 Host

### 响应处理
- proxy_buffering：缓冲上游响应（默认开启）
- proxy_buffers：缓冲区数量和大小
- proxy_busy_buffers_size：忙碌缓冲区大小
- proxy_hide_header：隐藏上游响应头
- proxy_ignore_headers：忽略上游特定头
- proxy_pass_header：传递被隐藏的头

### 负载均衡上下文
- 与 upstream 配合：proxy_pass http://backend
- 健康检查：与负载均衡策略结合
- 故障转移：proxy_next_upstream

## 负载均衡篇

### 负载均衡策略
- 轮询（Round Robin）：默认策略，依次分配
- 加权轮询：weight 参数，权重越高分配越多
- IP Hash：ip_hash，同一 IP 路由到同一服务器（会话保持）
- 最少连接：least_conn，选择连接数最少的服务器
- 一致性哈希：hash $request_uri consistent（第三方模块）
- 随机：random（1.15.0+）

### Upstream 配置
- server：定义上游服务器
- weight：权重（默认 1）
- max_fails：最大失败次数（默认 1）
- fail_timeout：失败超时时间（默认 10s）
- backup：备用服务器（其他服务器都挂了才用）
- down：标记服务器不可用
- max_conns：最大并发连接数限制

### 健康检查
- 被动检查：请求失败后标记为不可用
- 主动检查：health_check 指令（商业版）
- 第三方模块：nginx_upstream_check_module
- 检查间隔：interval 参数
- 检查超时：timeout 参数

### 会话保持
- IP Hash：基于 IP 哈希
- Sticky Cookie：设置 Cookie（商业版或第三方模块）
- Sticky Route：基于路由参数
- 一致性哈希：基于请求 URI 或参数

### 故障转移
- proxy_next_upstream：定义何时尝试下一个服务器
- 错误类型：error、timeout、invalid_header、http_500、http_502、http_503、http_504
- 重试限制：proxy_next_upstream_tries、proxy_next_upstream_timeout
- 幂等性：只对幂等请求重试（GET、HEAD）

## 缓存篇

### 缓存配置
- proxy_cache_path：定义缓存路径和参数
- proxy_cache：启用缓存
- proxy_cache_key：缓存键（默认 $scheme$proxy_host$request_uri）
- proxy_cache_valid：缓存有效期（按状态码）
- proxy_cache_methods：可缓存的请求方法

### 缓存控制
- proxy_cache_bypass：跳过缓存读取
- proxy_no_cache：不缓存响应
- proxy_cache_min_uses：最少请求次数才缓存
- proxy_cache_use_stale：上游不可用时使用过期缓存
- proxy_cache_lock：防止缓存穿透

### 缓存清理
- 自动清理：inactive 参数（长时间未访问）
- 手动清理：rm 删除缓存文件
- 清理模块：ngx_cache_purge（第三方）
- 商业版：proxy_cache_purge 指令

### 缓存性能
- keys_zone：内存中的键值空间（1MB 约 8000 个 key）
- max_size：磁盘最大缓存大小
- loader_threshold：加载器阈值
- loader_files：每次加载的文件数
- manager_files：管理器每次处理的文件数

### 缓存头处理
- add_header X-Cache-Status $upstream_cache_status：缓存命中状态
- 状态值：MISS（未命中）、HIT（命中）、EXPIRED（过期）、STALE（过期但仍使用）、UPDATING（更新中）、REVALIDATED（重新验证）

## 高级特性篇

### Rewrite 重写
- rewrite：重写 URI
- 语法：rewrite regex replacement [flag]
- Flag：last（继续匹配）、break（停止匹配）、redirect（302）、permanent（301）
- return：直接返回状态码或 URL
- 正则捕获：$1、$2 引用捕获组
- if 指令：条件判断（尽量少用，性能差）

### 变量
- 内置变量：$uri、$request_uri、$args、$query_string、$host、$remote_addr
- 请求变量：$request_method、$scheme、$server_name、$server_port
- 响应变量：$status、$body_bytes_sent、$request_time
- 自定义变量：set $var value
- map 指令：根据变量映射新变量

### Gzip 压缩
- gzip：启用压缩
- gzip_types：压缩的 MIME 类型
- gzip_comp_level：压缩级别（1-9，建议 6）
- gzip_min_length：最小压缩大小（建议 1k）
- gzip_vary：添加 Vary: Accept-Encoding 头
- gzip_proxied：代理请求的压缩条件

### SSL/TLS
- ssl_certificate：证书文件
- ssl_certificate_key：私钥文件
- ssl_protocols：TLS 版本（TLSv1.2 TLSv1.3）
- ssl_ciphers：加密套件
- ssl_prefer_server_ciphers：优先使用服务器加密套件
- ssl_session_cache：会话缓存
- ssl_session_timeout：会话超时
- ssl_stapling：OCSP Stapling（在线证书状态检查）
- HTTP/2：listen 443 ssl http2

### 限流限速
- limit_req_zone：定义请求速率限制（漏桶算法）
- limit_req：应用速率限制
- burst：突发流量（令牌桶）
- nodelay：不延迟，超出直接拒绝
- limit_conn_zone：定义连接数限制
- limit_conn：应用连接数限制
- limit_rate：响应速度限制（带宽限制）

### 访问控制
- allow/deny：IP 访问控制
- auth_basic：HTTP 基本认证
- auth_request：第三方认证（转发认证请求）
- secure_link：防盗链（URL 签名）
- referer：Referer 检查
- geo：地理位置变量

### 跨域配置（CORS）
- Access-Control-Allow-Origin：允许的源
- Access-Control-Allow-Methods：允许的方法
- Access-Control-Allow-Headers：允许的请求头
- Access-Control-Max-Age：预检请求缓存时间
- OPTIONS 请求处理：预检请求返回 204

## Lua 扩展篇

### OpenResty
- 基于 Nginx + LuaJIT：高性能的 Web 应用服务器
- ngx_lua 模块：在 Nginx 中嵌入 Lua
- 应用场景：API 网关、WAF、动态路由、鉴权、限流

### Lua 执行阶段
- init_by_lua：初始化阶段（加载配置）
- init_worker_by_lua：Worker 初始化
- set_by_lua：变量赋值
- rewrite_by_lua：重写阶段
- access_by_lua：访问控制阶段（鉴权）
- content_by_lua：内容生成阶段
- header_filter_by_lua：响应头过滤
- body_filter_by_lua：响应体过滤
- log_by_lua：日志阶段

### Lua API
- ngx.var：访问 Nginx 变量
- ngx.req：请求对象（ngx.req.get_headers()、ngx.req.read_body()）
- ngx.resp：响应对象
- ngx.say/ngx.print：输出内容
- ngx.exit：退出请求处理
- ngx.redirect：重定向
- ngx.shared.DICT：共享内存字典
- ngx.timer：定时器

### OpenResty 生态
- lua-resty-redis：Redis 客户端
- lua-resty-mysql：MySQL 客户端
- lua-resty-http：HTTP 客户端
- lua-resty-lock：分布式锁
- lua-resty-lrucache：LRU 缓存
- lua-resty-jwt：JWT 认证

### 性能优化
- cosocket：非阻塞 socket
- 连接池：复用连接（set_keepalive）
- 共享内存：跨 Worker 共享数据
- LuaJIT：JIT 编译提升性能
- 避免阻塞：不要用 os.execute、io.popen

## 性能优化篇

### Worker 配置
- worker_processes：Worker 数量（建议等于 CPU 核数）
- worker_cpu_affinity：CPU 亲和性绑定
- worker_rlimit_nofile：Worker 最大文件描述符数
- worker_connections：单 Worker 最大连接数（默认 1024，建议 10240）
- use epoll：指定事件模型

### 连接优化
- keepalive_timeout：长连接超时时间
- keepalive_requests：单连接最大请求数
- sendfile：零拷贝发送文件（默认 on）
- tcp_nopush：批量发送响应头（sendfile 开启时）
- tcp_nodelay：禁用 Nagle 算法（小包立即发送）

### 缓冲区优化
- client_body_buffer_size：请求体缓冲区
- client_header_buffer_size：请求头缓冲区
- large_client_header_buffers：大请求头缓冲区
- proxy_buffers：代理响应缓冲区
- proxy_buffer_size：代理响应头缓冲区

### 缓存优化
- open_file_cache：文件句柄缓存
- open_file_cache_valid：缓存有效期
- open_file_cache_min_uses：最少使用次数
- open_file_cache_errors：缓存文件错误

### 操作系统优化
- 文件描述符：ulimit -n 65535
- TCP 参数：net.ipv4.tcp_tw_reuse、net.ipv4.tcp_fin_timeout
- 连接队列：net.core.somaxconn
- 内存：vm.swappiness（降低 swap 使用）

### 监控与排查
- stub_status：简单的状态统计
- ngx_http_status_module：更详细的状态（第三方）
- access_log：访问日志分析
- error_log：错误日志排查
- Nginx Amplify：官方监控工具（SaaS）
- Prometheus + Grafana：监控告警

## 实战场景篇

### 静态资源服务器
- 场景：图片、CSS、JS 等静态文件
- 配置：root + expires + gzip
- 优化：浏览器缓存、CDN 回源

### 反向代理 + 负载均衡
- 场景：多个后端应用服务器
- 配置：upstream + proxy_pass
- 优化：连接池、健康检查、会话保持

### HTTPS 与 HTTP/2
- 场景：全站 HTTPS
- 配置：SSL 证书 + HTTP/2
- 优化：会话复用、OCSP Stapling

### API 网关
- 场景：统一入口、鉴权、限流、路由
- 方案：OpenResty + Lua
- 功能：JWT 鉴权、Rate Limiting、动态路由、API 聚合

### 前后端分离
- 场景：前端静态文件 + 后端 API
- 配置：location / 代理前端，location /api 代理后端
- 优化：静态文件缓存、API 响应缓存

### WebSocket 代理
- 配置：proxy_http_version 1.1 + Upgrade 头
- 超时：proxy_read_timeout 调大
- 负载均衡：IP Hash 保持连接

### 流媒体服务
- HLS：HTTP Live Streaming
- RTMP：nginx-rtmp-module
- MP4：ngx_http_mp4_module

## 运维部署篇

### 安装部署
- 包管理器：apt/yum 安装（版本较旧）
- 官方源：nginx.org 提供最新稳定版
- 编译安装：自定义模块、优化编译参数
- 容器化：Docker、Kubernetes

### 配置管理
- 配置验证：nginx -t
- 重载配置：nginx -s reload（优雅重载，不中断服务）
- 配置分离：include 指令，模块化配置
- 版本控制：Git 管理配置文件

### 日志管理
- 日志轮转：logrotate + USR1 信号
- 日志分析：GoAccess、AWStats、ELK
- 日志格式：JSON 格式便于解析
- 日志存储：集中式日志系统

### 安全加固
- 隐藏版本：server_tokens off
- 限制请求方法：if ($request_method !~ ^(GET|POST)$)
- 缓冲区溢出：client_max_body_size、large_client_header_buffers
- DDoS 防护：limit_req、limit_conn
- WAF：ModSecurity、OpenResty + Lua

### 高可用
- 主备模式：Keepalived + VIP
- DNS 轮询：多个 A 记录
- 负载均衡：LVS/HAProxy 前置
- 容器编排：Kubernetes Ingress

## 下一步学习

掌握 Nginx 后，你可以：
- **OpenResty 深入**：Lua 编程、API 网关开发
- **对比其他 Web 服务器**：Apache、Caddy、Traefik、Envoy
- **学习 HTTP/3 (QUIC)**：下一代 HTTP 协议
- **研究负载均衡**：LVS、HAProxy、Envoy 的对比
- **探索 Service Mesh**：Istio、Linkerd，云原生流量管理
- **深入网络协议**：TCP/IP、HTTP、TLS 的底层原理

Nginx 是 Web 服务器的瑞士军刀，也是高性能网络编程的典范。从简单的静态文件服务到复杂的 API 网关，Nginx 都能优雅胜任。掌握 Nginx，你就掌握了流量的"艺术"。Happy proxying！
