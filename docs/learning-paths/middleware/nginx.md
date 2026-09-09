# Nginx 学习路线

Nginx 是**互联网基础设施的基石**:高性能 Web 服务器、反向代理、负载均衡器、HTTP 缓存、API 网关——一个软件全包。它是 **C10K 问题(单机万级并发连接)的终结者**:异步事件驱动架构(epoll),用极少的进程与内存扛住海量并发。今天它是全球使用率第一的 Web 服务器,也是每个后端工程师早晚要亲手配的"流量入口"。学它之前建议先过 [计算机网络](/learning-paths/cs-basics/computer-networks) 的 HTTP 章(状态码/缓存头/HTTPS 是配置的地基)。实践:`nginx` 装一个(apt/brew/docker 都行),`nginx -t` + `nginx -s reload` 改配置不中断服务。

这条线按 **架构与原理 → 配置结构 → server/location → 反向代理 → 负载均衡 → HTTP 缓存 → HTTPS 与 HTTP/2 → 限流与安全 → 性能调优 → 实战架构** 推进。

## 第一站:架构——为什么 Nginx 这么快

**进程模型**:一个 **master 进程**(读配置、管理 worker、不处理请求)+ 多个 **worker 进程**(真正干活,数量建议 = CPU 核数)+ cache 进程(缓存加载/管理)——**多进程而非多线程:进程隔离,一个 worker 崩了不影响其他**。**快的原因(面试必答)**:①**异步非阻塞事件驱动**:worker 用 epoll(Linux)/kqueue(macOS)同时监听数千连接,**不阻塞等待 IO**(对比 Apache 的"一连接一线程/进程",线程一多就崩);②内存池(预分配减少 malloc);③**sendfile 零拷贝**(静态文件直接内核→网卡);④C 语言轻量。
**横向对比**:Apache(阻塞模型,模块生态与 .htaccess 灵活,老牌动态托管)、Nginx(静态/高并发/反代王者)、**Caddy(自动 HTTPS,配置极简,个人站友好)**、Envoy(云原生数据面,服务网格——见 [服务网格](/learning-paths/cloud-native/service-mesh));**定位**:Nginx 处理"入口流量",业务逻辑给后端——**静态文件/反代/负载均衡/LB 是它的主场,动态渲染不是**。

## 第二站:配置结构

**配置文件层级**(`/etc/nginx/nginx.conf`):`main`(全局:user/worker_processes)→ **`events`**(worker_connections 等连接参数)→ **`http`**(HTTP 服务通用配置:gzip/日志/上游)→ `server`(虚拟主机)→ `location`(URL 路由)→ `upstream`(后端服务器组,写在 http 内)。**继承与覆盖规则**:子块继承父块、同名指令子块覆盖;**数组类指令是"累加"不是覆盖**(如 proxy_set_header 多处都生效);**模块化**:主配置 `include /etc/nginx/conf.d/*.conf` 与 sites-enabled——**每个站点一个文件,别把一切堆在 nginx.conf**。**日常命令**:`nginx -t`(语法检查,改配置必跑)/`nginx -s reload`(优雅重载:不中断现有连接)/`-s stop/quit`;日志:error_log(排查入口)与 access_log。

## 第三站:虚拟主机与 location 匹配

**server(虚拟主机)**:按域名区分站点——`server_name example.com www.example.com`(精确/泛域名 `*.example.com`/正则 `~^www\..+`);`listen 80`(端口/IP/default_server 标记默认站)。**location 匹配规则(面试必考顺序)**:①`= /path` 精确匹配(优先最高);②`^~ /prefix` 前缀匹配且**命中后不再尝试正则**;③`~`/`~*` 正则匹配(按配置文件书写顺序,第一个命中生效);④普通前缀(最长匹配兜底)——**口诀:先精确、再 ^~、再正则、最后最长前缀**。
**静态文件三指令**:`root`(**拼接**路径:root /var/www + /img/a.png → /var/www/img/a.png)vs `alias`(**替换**路径:alias 常用于 location 内,尾斜杠坑多——搞混 404 是新手第一课);`index`(默认首页)、`autoindex`(目录列表)、**`try_files $uri $uri/ /index.html`(SPA 前端路由回退的核心:找不到文件就回 index.html,交给前端路由)**、`expires 30d`/`add_header Cache-Control`(静态资源缓存头)、`gzip on`(压缩见性能站)。

## 第四站:反向代理——后端服务的统一入口

**基本形态**:(location /api/ &#123; proxy_pass http://backend; &#125;)——客户端只认识 Nginx,后端地址被隐藏。**关键细节**:①**proxy_pass 有无 URI 的语义**(`proxy_pass http://backend;` 原样转发 vs `proxy_pass http://backend/;` 带路径会替换匹配部分——**尾斜杠差异是 404 事故高发区**);②**请求头三件套(后端拿真实客户端信息全靠它)**:`proxy_set_header Host $host`(后端虚拟主机正确)、`X-Real-IP $remote_addr` 与 **`X-Forwarded-For $proxy_add_x_forwarded_for`(代理链上的真实 IP 列表——后端日志/风控要读它)**,HTTPS 下游还要 `X-Forwarded-Proto https`(后端才知道请求原本是 https);③超时:`proxy_connect_timeout`(连后端)/`proxy_read_timeout`(等后端响应——**SSE/长轮询要调大**)/`proxy_send_timeout`;④**缓冲**:`proxy_buffering on` 默认把上游响应攒齐再发(吞吐好);**流式场景(SSE/大文件下载)要 `proxy_buffering off`**(否则客户端等不到增量);`client_max_body_size`(上传大小,**默认仅 1MB——上传 413 的答案**);⑤**WebSocket 反代**:`proxy_http_version 1.1` + `Upgrade`/`Connection` 头转发 + read_timeout 调大;⑥故障转移:`proxy_next_upstream error timeout http_500`(**注意:非幂等请求(POST)默认不重试——避免重复下单**,只对 GET/HEAD 安全重试)。

## 第五站:负载均衡

**upstream 组 + 策略**:(upstream backend &#123; server 10.0.0.1:8080 weight=3; server 10.0.0.2:8080; server 10.0.0.3:8080 backup; &#125;)——策略:**轮询(默认)/weight 加权轮询(机器强弱)/ip_hash(同 IP 固定同后端——session 保持的土办法)/least_conn(最少连接)/hash(一致性哈希,第三方)**。
**server 参数**:weight、**max_fails + fail_timeout(被动健康检查:10 秒内失败 1 次,标记不可用 10 秒)**、backup(备用机,全挂才上)、down(手动下线)、max_conns。**健康检查**:开源版只有被动检查(靠真实请求失败);主动周期探测要商业版或第三方模块;**生产一般交给云 LB/K8s(见 [Kubernetes](/learning-paths/devops/kubernetes))或注册中心层做**。
**架构分层(重要认知)**:Nginx 是"入口/流量层"负载均衡;应用内还有注册中心 + 客户端负载均衡(Spring Cloud LoadBalancer/OpenFeign——见 [Spring Cloud](/learning-paths/microservices/spring-cloud))——**两层 LB:入口按机器分,应用层按服务实例分**。

## 第六站:HTTP 缓存——Nginx 也能当缓存层

**配置**:`proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=mycache:10m max_size=10g inactive=60m;`(磁盘缓存路径 + **内存元数据区 keys_zone(1MB 约 8000 个 key)**)+ `location` 里 `proxy_cache mycache;`;`proxy_cache_key`(默认 scheme+host+uri——**带查询参数的 URL 会各自成 key,注意**);**有效期**:`proxy_cache_valid 200 302 10m;`(按状态码);`proxy_cache_methods`。
**控制细节**:`proxy_cache_bypass`(带登录 cookie 的请求跳过读缓存)、`proxy_no_cache`(不缓存动态页)、**`proxy_cache_lock`(同 key 并发只放一个回源,其余等——防缓存击穿)**、**`proxy_cache_use_stale error timeout updating`(上游挂了/更新中先给旧缓存——高可用的保命技)**、`proxy_cache_min_uses`。
**调试**:响应头加 `add_header X-Cache-Status $upstream_cache_status;`——值 MISS/HIT/EXPIRED/STALE/UPDATING 一目了然。**架构认知**:Nginx 缓存适合"公开的读多接口/静态资源"(边缘缓存,无业务逻辑);带用户态的缓存(登录/个性化)用 Redis(见 [Redis](/learning-paths/database/redis));**CDN 本质 = 分布式的 Nginx 缓存**——回源到你的 Nginx 再套一层。

## 第七站:HTTPS、HTTP/2 与跳转

**证书配置**:`listen 443 ssl;` + `ssl_certificate`(证书链)+ `ssl_certificate_key`(私钥);**证书用 certbot 自动签发续期(Let's Encrypt),别手动抠证书文件**;`ssl_protocols TLSv1.2 TLSv1.3;`(别开 TLS1.0/1.1 与 SSL);性能:`ssl_session_cache shared:SSL:10m`(会话复用,握手少一大半)、`ssl_session_timeout`;HTTP/2:`listen 443 ssl http2;`(多路复用/头压缩——**HTTP/1.1 的队头阻塞在 HTTP/2 解决,现代站点标配**;HTTP/3 概念见 [网络](/learning-paths/cs-basics/computer-networks));**跳转与安全头**:80 端口 `return 301 https://$host$request_uri;`(全站 HTTPS)、`add_header Strict-Transport-Security`(HSTS——**告诉浏览器以后只走 HTTPS**);`server_tokens off`(隐藏版本号)。
**反代场景的 HTTPS 语义**:与后端之间可走 HTTP(Nginx 终结 TLS 的"SSL 卸载"——证书集中在这层管理,后端不碰证书是常见架构)。

## 第八站:限流、访问控制与重写

**限流(接口防刷的 Nginx 层答案)**:`limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;`(定义 zone:漏桶速率)+ location 里 `limit_req zone=api burst=20 nodelay;`(**burst:突发容量(令牌桶思想);nodelay:超出的直接 429 而不是排队**)——**登录/短信/下单接口必配**;`limit_conn_zone` + `limit_conn`(同 IP 并发连接数限制);`limit_rate`(下载带宽限速)。
**访问控制**:`allow 10.0.0.0/8; deny all;`(IP 白名单——管理后台/内网接口)、`auth_basic`(HTTP Basic 认证,临时保护)、`secure_link`(带签名 URL——防盗链/临时授权下载)、**CORS(跨域,前后端分离时网关统一处理)**:`add_header Access-Control-Allow-Origin $http_origin`(或 *)等 + **OPTIONS 预检返回 204**(`if ($request_method = OPTIONS) &#123; return 204; &#125;`——见 [网络](/learning-paths/cs-basics/computer-networks) 的 CORS 节)。
**重写与变量**:`rewrite ^/old/(.*)$ /new/$1 permanent;`(301 迁移)、`return 301/302`(跳转比 rewrite 更推荐);**if 指令慎用(官方明示 if is evil**:性能与语义坑)——**条件分支优先用 `map`**(按变量映射:如按 UA 分流移动端);内置变量库:`$host/$remote_addr/$request_uri/$request_method/$status/$upstream_addr/$upstream_response_time`(日志与限流的地基);`log_format` 自定义访问日志(含 upstream 耗时——排查"慢在 Nginx 还是后端"全靠 `$upstream_response_time`),JSON 格式日志便于采集。

## 第九站:性能调优

**Worker 层**:`worker_processes auto;`(=CPU 核)、**`worker_connections 10240;`(单 worker 连接数,配 `ulimit -n` 65535 文件描述符上限——"连接上不去"九成是 fd 不够)**、`worker_rlimit_nofile`。
**连接与传输**:`keepalive_timeout 65` 与 `keepalive_requests`(长连接,前端→Nginx 与 **Nginx→上游的 keepalive(upstream 里 `keepalive 32;`——否则每次请求都新建上游连接,吞吐差一大截)**)、`sendfile on`(静态文件零拷贝)、`tcp_nopush`/`tcp_nodelay`(与 sendfile/keepalive 配合)。
**gzip**:`gzip on; gzip_types text/css application/javascript application/json; gzip_min_length 1k; gzip_comp_level 5;`(JSON/JS/CSS 必压——**API 响应体压缩能省 70% 流量;注意别给已压缩格式(图片/视频)重复压**);`open_file_cache`(静态文件句柄缓存,静态站性能关键);`client_max_body_size`(按业务设上传上限)。
**OS 层**:somaxconn(连接队列)、tcp_tw_reuse、关闭 swap——与 [Linux 路线](/learning-paths/devops/linux) 的系统调优呼应。**监控**:`stub_status`(Active connections 等基础指标)/nginx-prometheus-exporter + Grafana(请求 QPS/状态码分布/上游延迟)、访问日志分析(GoAccess 快速看/ELK 集中)。

## 第十站:实战场景与架构定位

**六大场景一键回顾**:①静态资源站:`root + expires 30d + gzip + open_file_cache`(前端构建产物/图片,通常再套 CDN);②**前后端分离**:`location / &#123; root 前端 dist; try_files ... /index.html; &#125;` + `location /api/ &#123; proxy_pass 后端; &#125;`——**一个 80/443 端口全包**;③反向代理集群:upstream + proxy_pass + 头传递 + 超时缓冲;④HTTPS 网关:证书 + HSTS + HTTP/2 + 限流;⑤WebSocket/SSE 反代(升级头 + 关缓冲/调超时);⑥接口限流与 IP 白名单。
**OpenResty(进阶方向)**:Nginx + LuaJIT——**在 Nginx 里写 Lua**(执行阶段:access 鉴权/content 动态响应/log),生态 lua-resty-redis/jwt——**自研"轻量 API 网关"(鉴权/限流/路由/聚合)的经典路线**;**成熟的网关产品**:Kong/APISIX(基于 OpenResty,插件化)、Spring Cloud Gateway(Java 业务网关)、Envoy(云原生)——**架构分层**:流量网关(云 LB/Nginx,公网入口,按域名路径转发)+ 业务网关(应用层,鉴权/路由/限流/聚合,如 Spring Cloud Gateway/Kong)——见 [API 网关](/learning-paths/microservices/api-gateway)。
**K8s 里的 Nginx**:nginx-ingress-controller 把 Nginx 变成 K8s 的 Ingress(自动按 Ingress 资源配 upstream/HTTPS——见 [Kubernetes](/learning-paths/devops/kubernetes))。**高可用**:Nginx 本身无状态——**HA 靠前置**(Keepalived 虚 IP 主备、云负载均衡、DNS 多 A 记录):两台 Nginx + 一个漂移 IP 是经典主备。

## 通关标准

能独立做到:不看文档写出"前端静态 + /api 反代 + HTTPS 跳转 + gzip + 静态缓存头"的完整站点配置;说清 location 匹配顺序、root/alias、proxy_pass 尾斜杠、X-Forwarded-For 与真实 IP 的关系;配 upstream 加权轮询 + 超时 + 失败转移并解释为什么 POST 不自动重试;用 limit_req 给登录接口限流、用 proxy_cache 缓存公开接口并靠 X-Cache-Status 验证命中;能读 $upstream_response_time 判断慢在哪层;nginx -t 与 reload 成为肌肉记忆——Nginx 主线通关。

Nginx 教你的不只是配置语法,而是**"流量入口"的架构思维**:谁来终结 TLS、谁缓存、谁限流、谁路由、谁负载均衡——这些"入口职责"在单体时代是 Nginx 的活,在云原生时代演化为 Ingress/Gateway/Service Mesh(见 [云原生路线](/learning-paths/cloud-native/cloud-native-patterns)),但心智一脉相承。先把 Nginx 玩熟(它是理解一切流量层的起点),再看 Envoy/APISIX/K8s Ingress 都会豁然开朗——它们只是"换了壳的 Nginx 问题"。Happy proxying!
