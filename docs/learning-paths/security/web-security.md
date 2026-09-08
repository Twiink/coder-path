# Web 安全学习路线

Web 安全是互联网时代的核心话题。从简单的表单注入到复杂的 XSS 攻击，从 SQL 注入到 CSRF 跨站请求伪造，攻击者的手段层出不穷。这条路线会带你了解常见的 Web 攻击手段、防御策略，以及安全开发的最佳实践。记住：永远不要相信用户输入。

## 基础篇：常见攻击类型


### XSS（跨站脚本攻击）
- 反射型 XSS：URL 参数直接输出到页面
- 存储型 XSS：恶意脚本存储到数据库
- DOM 型 XSS：纯前端 JavaScript 操作 DOM 导致
- XSS 危害：窃取 Cookie、会话劫持、钓鱼、蠕虫传播
- 防御措施：输入验证、输出编码、CSP、HttpOnly Cookie
- 编码方式：HTML 实体编码、JavaScript 编码、URL 编码
- 富文本过滤：白名单策略、DOMPurify 库

### CSRF（跨站请求伪造）
- 攻击原理：利用用户已登录状态发起恶意请求
- 攻击场景：转账、修改密码、发表内容
- GET 型 CSRF：通过图片、链接触发
- POST 型 CSRF：通过自动提交表单触发
- 防御措施：CSRF Token、SameSite Cookie、验证 Referer、二次验证
- Token 生成：随机性、一次性、时效性
- 双重 Cookie 验证

### SQL 注入
- 注入原理：拼接 SQL 语句导致执行恶意代码
- 注入类型：数字型、字符型、搜索型、堆叠注入
- 盲注：布尔盲注、时间盲注、报错注入
- 注入危害：数据泄露、数据篡改、提权、执行系统命令
- 防御措施：参数化查询、预编译语句、ORM 框架、最小权限原则
- 输入验证：白名单、黑名单、类型检查、长度限制
- WAF（Web 应用防火墙）

### 文件上传漏洞
- 漏洞原理：上传恶意文件并执行
- 攻击类型：WebShell、木马、病毒、钓鱼页面
- 绕过方式：双重扩展名、MIME 类型伪造、文件头伪造、解析漏洞
- 防御措施：文件类型白名单、文件内容检测、随机文件名、独立域名存储
- 图片检测：重新渲染、二次压缩、ImageMagick
- 可执行权限控制

### SSRF（服务器端请求伪造）
- 攻击原理：利用服务器发起内网请求
- 攻击目标：内网扫描、访问内部服务、云服务元数据、Redis 未授权访问
- 危害：内网信息泄露、绕过防火墙、攻击内部系统
- 防御措施：URL 白名单、禁止访问内网 IP、DNS Rebinding 防护
- 协议限制：禁用 file://、gopher://、dict://
- IP 黑名单：127.0.0.1、0.0.0.0、10.x.x.x、172.16.x.x、192.168.x.x

## 进阶篇：深层攻击与防御

### 点击劫持（Clickjacking）
- 攻击原理：透明 iframe 覆盖诱导点击
- 攻击场景：诱导点赞、关注、转账、授权
- 防御措施：X-Frame-Options、CSP frame-ancestors、JavaScript 防护
- 帧破坏脚本（Frame Busting）

### XXE（XML 外部实体注入）
- 攻击原理：XML 解析器处理外部实体引用
- 攻击危害：读取本地文件、SSRF、DoS 攻击
- 防御措施：禁用外部实体、使用 JSON 代替 XML、安全解析器配置

### 命令注入
- 攻击原理：系统命令拼接导致执行任意命令
- 危害：服务器完全控制、反弹 Shell
- 防御措施：避免执行系统命令、参数化执行、白名单验证、最小权限

### IDOR（不安全的直接对象引用）
- 攻击原理：通过修改 ID 参数访问他人资源
- 攻击场景：查看他人订单、下载他人文件、修改他人信息
- 防御措施：权限验证、间接引用、UUID 代替自增 ID

### 目录遍历
- 攻击原理：通过 ../ 访问任意文件
- 攻击目标：配置文件、密码文件、源代码
- 防御措施：路径规范化、白名单目录、chroot 隔离

### 逻辑漏洞
- 支付逻辑：金额篡改、重复支付、并发竞态
- 业务流程：跳过验证步骤、重放攻击
- 权限绕过：横向越权、纵向越权
- 条件竞争：多线程并发导致的安全问题

## 进阶篇：现代 Web 安全机制

### CSP（内容安全策略）
- 策略指令：default-src、script-src、style-src、img-src、connect-src
- 值类型：'self'、'unsafe-inline'、'unsafe-eval'、nonce、hash
- 报告模式：Content-Security-Policy-Report-Only
- 违规报告：report-uri、report-to
- 最佳实践：逐步收紧、禁用 unsafe-inline、使用 nonce

### CORS（跨域资源共享）
- 同源策略：协议、域名、端口
- 简单请求：GET、POST、HEAD + 简单头
- 预检请求：OPTIONS、复杂请求触发
- 响应头：Access-Control-Allow-Origin、Access-Control-Allow-Methods
- 凭证请求：Access-Control-Allow-Credentials、withCredentials
- 安全配置：避免 *、Origin 白名单、Vary: Origin

### Cookie 安全
- HttpOnly：防止 JavaScript 访问
- Secure：仅 HTTPS 传输
- SameSite：Strict、Lax、None + Secure
- Domain 与 Path：作用域控制
- 前缀：__Secure-、__Host-
- Cookie Bomb：大量 Cookie DoS 攻击

### HTTPS 与 TLS
- 混合内容：Mixed Content 警告
- HSTS：强制 HTTPS、preload 列表
- 证书验证：证书链、吊销检查
- 中间人攻击：MITM、SSL Stripping
- TLS 版本：禁用 TLS 1.0/1.1、使用 TLS 1.3
- 证书透明度（CT）

### 子资源完整性（SRI）
- 完整性校验：script、link 标签 integrity 属性
- 哈希算法：sha256、sha384、sha512
- 跨域资源：crossorigin 属性
- CDN 劫持防护

## 实战篇：安全开发实践

### 输入验证
- 验证位置：客户端 + 服务端双重验证
- 验证方式：白名单优于黑名单
- 数据类型：类型检查、格式验证、范围限制
- 正则表达式：避免 ReDoS 攻击
- 文件上传：MIME 类型、文件大小、扩展名、文件内容

### 输出编码
- HTML 编码：&lt; &gt; &amp; &quot; &#x27; &#x2F;
- JavaScript 编码：\x、\u 转义
- URL 编码：encodeURIComponent
- CSS 编码：十六进制转义
- 上下文相关：不同位置不同编码方式

### 认证与授权
- 密码存储：bcrypt、scrypt、Argon2、加盐哈希
- 会话管理：会话固定防护、会话超时、会话销毁
- 多因素认证：TOTP、SMS、生物识别
- 权限检查：每次请求都验证、最小权限原则
- API 安全：API Key、JWT、OAuth2

### 错误处理
- 错误信息：不泄露敏感信息、堆栈跟踪、数据库错误
- 日志记录：记录安全事件、脱敏处理、审计日志
- 404 与 403：区分不存在与无权限
- 异常捕获：全局异常处理、友好错误页面

### 安全配置
- 默认账户：修改默认密码、禁用默认账户
- 不必要服务：关闭、最小化暴露
- 版本信息：隐藏服务器版本、框架版本
- 调试模式：生产环境禁用
- 目录列表：禁用 autoindex
- 敏感文件：.git、.env、备份文件、配置文件

### 安全头部
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY / SAMEORIGIN
- X-XSS-Protection: 1; mode=block（已逐渐废弃）
- Referrer-Policy: no-referrer / strict-origin-when-cross-origin
- Permissions-Policy：限制浏览器功能
- Strict-Transport-Security：HSTS 强制 HTTPS

## 实战篇：安全测试与防护

### 渗透测试
- 信息收集：域名、子域名、端口、服务、指纹识别
- 漏洞扫描：自动化扫描工具、手工测试
- 漏洞利用：POC、EXP、提权
- 报告编写：漏洞详情、复现步骤、修复建议

### 安全工具
- 扫描工具：Nmap、Nikto、AWVS、Nessus
- 代理工具：Burp Suite、OWASP ZAP、Fiddler
- 漏洞平台：HackerOne、Bugcrowd、CNVD
- 开源工具：Metasploit、sqlmap、XSStrike

### WAF（Web 应用防火墙）
- 防护规则：特征匹配、行为分析、机器学习
- 防护类型：黑名单、白名单、混合模式
- 绕过技巧：编码变换、大小写变换、注释混淆
- 主流 WAF：ModSecurity、云 WAF、硬件 WAF

### 应急响应
- 事件检测：异常流量、入侵检测、日志分析
- 应急处理：隔离、保留证据、漏洞修复
- 事后分析：溯源、总结、流程优化
- 灾难恢复：备份恢复、业务连续性

### SDL（安全开发生命周期）
- 需求阶段：安全需求分析、威胁建模
- 设计阶段：安全架构设计、最小权限原则
- 开发阶段：安全编码规范、代码审查
- 测试阶段：安全测试、渗透测试
- 发布阶段：安全配置、版本管理
- 运维阶段：监控告警、漏洞修复、应急响应

## 下一步学习

掌握 Web 安全后，可以继续深入：

- **认证授权** - OAuth2、JWT、SAML、SSO
- **密码学** - 加密算法、数字签名、PKI 体系
- **API 安全** - RESTful API、GraphQL 安全
- **容器安全** - Docker、Kubernetes 安全加固
- **云安全** - AWS、Azure、GCP 安全最佳实践
- **移动安全** - iOS、Android 应用安全

Web 安全是攻防对抗的艺术。攻击者只需要找到一个漏洞，而防御者需要堵住所有漏洞。安全不是一劳永逸的工作，而是持续的过程。保持警惕，不断学习，永远假设下一个漏洞就在眼前。
