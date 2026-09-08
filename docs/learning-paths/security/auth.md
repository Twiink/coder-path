# 认证授权学习路线

认证（Authentication）解决"你是谁"的问题，授权（Authorization）解决"你能做什么"的问题。从传统的 Session-Cookie 到现代的 JWT、OAuth2，从单体应用到微服务架构，认证授权的方案不断演进。这条路线会带你了解各种认证授权机制、它们的优缺点，以及如何选择合适的方案。

## 基础篇：认证机制

### HTTP 基础认证
- Basic Authentication：Base64 编码用户名密码
- Digest Authentication：MD5 哈希摘要认证
- 优点：实现简单、无状态
- 缺点：不安全（Base64 可逆）、每次请求都要传递凭证
- 适用场景：内网、开发环境、简单场景

### Session-Cookie 认证
- 流程：登录 → 服务端生成 Session → 返回 SessionID → Cookie 存储 → 后续请求携带
- Session 存储：内存、Redis、数据库、文件系统
- Cookie 属性：HttpOnly、Secure、SameSite、Domain、Path
- 会话固定攻击：登录后重新生成 SessionID
- 会话劫持：XSS 窃取 Cookie、网络嫌疑、中间人攻击
- 优点：服务端可控、易于撤销、成熟稳定
- 缺点：水平扩展困难、跨域复杂、移动端不友好

### Token 认证
- 流程：登录 → 服务端生成 Token → 返回 Token → 客户端存储 → 后续请求携带（Header）
- Token 组成：随机字符串 / 签名数据
- Token 存储：localStorage、sessionStorage、内存
- Token 传递：Authorization: Bearer `<token>`
- Token 刷新：Refresh Token 机制
- 优点：无状态、跨域友好、移动端友好
- 缺点：无法主动撤销（除非维护黑名单）、Token 泄露风险

### JWT（JSON Web Token）
- 结构：Header.Payload.Signature（头部.载荷.签名）
- Header：算法类型（HS256、RS256）、令牌类型
- Payload：用户信息、过期时间、签发者、主题
- Signature：签名算法（HMAC、RSA）
- 验证流程：解析 → 验证签名 → 检查过期
- 优点：自包含、无状态、跨语言、标准化
- 缺点：无法撤销、载荷不可篡改但可见、体积较大
- 最佳实践：短过期时间、HTTPS 传输、敏感信息不放 Payload、使用 Refresh Token

## 进阶篇：单点登录（SSO）

### SSO 原理
- 核心思想：一次登录，多处访问
- 认证中心：统一的认证服务
- 信任域：多个应用共享认证状态
- 实现方式：共享 Cookie、CAS 协议、OAuth2、SAML

### CAS（中央认证服务）
- 组件：CAS Server（认证中心）、CAS Client（应用客户端）
- 流程：访问应用 → 重定向到 CAS Server → 登录 → 返回 Ticket → 应用验证 Ticket → 获取用户信息
- Ticket 类型：TGT（Ticket Granting Ticket）、ST（Service Ticket）
- 优点：集中管理、安全性高、成熟方案
- 缺点：需要额外服务、复杂度高

### SAML（安全断言标记语言）
- 核心概念：IdP（身份提供者）、SP（服务提供者）
- 断言类型：认证断言、属性断言、授权决策断言
- 绑定方式：HTTP POST、HTTP Redirect、SOAP
- 流程：SP 发起 → IdP 认证 → 返回断言 → SP 验证断言
- 优点：企业级标准、安全性高、功能完善
- 缺点：XML 复杂、实现难度大、移动端不友好

### OAuth 2.0 SSO
- 利用 OAuth2 实现 SSO
- 授权服务器作为认证中心
- 应用作为客户端
- 优点：现代、RESTful、移动端友好
- 缺点：OAuth2 本身不是认证协议（需要配合 OpenID Connect）

## 进阶篇：OAuth 2.0

### OAuth 2.0 核心概念
- 角色：资源所有者、客户端、授权服务器、资源服务器
- 授权类型（Grant Types）：授权码、隐式、密码、客户端凭证
- Token 类型：Access Token、Refresh Token
- 核心目标：授权而非认证（不要混淆）

### 授权码模式（Authorization Code）
- 流程：跳转授权页 → 用户同意 → 返回授权码 → 换取 Access Token
- 最安全的模式：授权码只用一次、Token 不经过浏览器
- PKCE 扩展：Proof Key for Code Exchange，防止授权码拦截
- 适用场景：服务端应用、最常用的模式

### 隐式模式（Implicit）
- 流程：跳转授权页 → 用户同意 → 直接返回 Access Token（URL Fragment）
- 缺点：Token 暴露在 URL、无法使用 Refresh Token
- 已逐渐废弃：推荐使用授权码 + PKCE 代替
- 历史原因：早期 SPA 应用的解决方案

### 密码模式（Password）
- 流程：直接用用户名密码换取 Token
- 适用场景：高度信任的应用（官方客户端）
- 缺点：违背 OAuth 初衷、不推荐使用
- 已废弃：OAuth 2.1 移除此模式

### 客户端凭证模式（Client Credentials）
- 流程：客户端 ID + Secret 换取 Token
- 适用场景：服务间调用、后台任务、机器对机器
- 无用户参与：仅代表应用自身

### Refresh Token
- 作用：Access Token 过期后无需重新登录
- 流程：Access Token 过期 → 使用 Refresh Token 换取新 Token
- 安全措施：Refresh Token 一次性使用、Rotation 机制、长期有效但可撤销
- 存储：HttpOnly Cookie（Web）、Secure Storage（移动端）

### OAuth 2.0 安全
- CSRF 攻击：使用 state 参数防护
- 授权码拦截：PKCE、授权码单次使用、短期有效
- Token 泄露：HTTPS、短期 Access Token、Refresh Token 撤销
- 重定向攻击：严格校验 redirect_uri
- 客户端认证：Client Secret 保密、动态客户端注册

## 进阶篇：OpenID Connect

### OIDC 核心概念
- 基于 OAuth 2.0 的认证层
- ID Token：JWT 格式的身份令牌
- UserInfo Endpoint：获取用户详细信息
- 标准化 Claim：sub、name、email、picture
- 与 OAuth 2.0 区别：OAuth 授权 + OIDC 认证

### ID Token
- 标准 Claim：iss、sub、aud、exp、iat、nonce
- 验证：签名验证、issuer 验证、audience 验证、过期验证
- 与 Access Token 区别：ID Token 给客户端、Access Token 给资源服务器

### 认证流程
- 授权码流程 + ID Token
- scope: openid（必须）、profile、email、address、phone
- response_type: code、id_token、token（组合使用）
- nonce：防止重放攻击

### Discovery 与 JWKS
- Discovery Endpoint：/.well-known/openid-configuration
- JWKS（JSON Web Key Set）：公钥端点、签名验证
- 元数据：issuer、授权端点、Token 端点、支持的算法

## 实战篇：授权模型

### RBAC（基于角色的访问控制）
- 核心概念：用户 - 角色 - 权限
- 角色继承：角色层级结构
- 优点：管理简单、易于理解、适合层级组织
- 缺点：角色爆炸、权限粒度粗、灵活性差
- 适用场景：传统企业应用、层级明确的组织

### ABAC（基于属性的访问控制）
- 核心概念：主体属性、资源属性、环境属性、策略规则
- 策略语言：XACML、JSON Policy
- 优点：细粒度、灵活、动态决策
- 缺点：复杂度高、性能开销、策略难以管理
- 适用场景：复杂权限需求、多租户系统、云服务

### ACL（访问控制列表）
- 核心概念：资源 - 权限列表
- 示例：文件系统权限、数据库权限
- 优点：直观、精确控制
- 缺点：管理困难、不适合大规模
- 适用场景：简单场景、资源级权限

### PBAC（基于策略的访问控制）
- 核心概念：集中式策略管理
- 策略引擎：OPA（Open Policy Agent）、Casbin
- 策略语言：Rego、DSL
- 优点：集中管理、动态更新、解耦业务逻辑
- 适用场景：微服务架构、复杂授权逻辑

### 资源级权限
- 数据级权限：只能访问自己的数据
- 行级权限：数据库行级安全策略
- 字段级权限：GraphQL Field-Level Authorization
- 实现方式：查询过滤、中间件拦截、数据库策略

## 实战篇：微服务认证授权

### API Gateway 认证
- 统一认证入口：Gateway 验证 Token
- 后端服务信任 Gateway：传递用户信息（内网不再验证）
- Token 透传：Authorization Header
- 用户上下文传递：自定义 Header（X-User-ID、X-User-Roles）

### 服务间认证
- 方案一：共享 Secret
- 方案二：服务账号 + Token
- 方案三：mTLS（双向 TLS 认证）
- 方案四：Service Mesh（Istio、Linkerd）
- JWT 用于服务间：audience 验证、短期有效

### Token 传播
- 用户 Token 透传：适合用户上下文操作
- Token Exchange：OAuth2 Token Exchange 规范
- Service Token：后台任务使用独立 Token
- Token Relay：Spring Cloud Gateway、Kong

### 分布式 Session
- Redis 集中存储：所有服务共享 Session
- Session 复制：服务间同步（不推荐）
- Sticky Session：负载均衡绑定（扩展性差）
- JWT 替代：无状态方案

## 实战篇：安全最佳实践

### 密码安全
- 密码复杂度：长度、字符类型、常见密码检查
- 密码存储：bcrypt、scrypt、Argon2、绝不明文
- 密码哈希：加盐、慢哈希、成本因子
- 密码找回：验证身份、临时链接、有效期、一次性
- 密码历史：不允许重复使用

### 多因素认证（MFA）
- TOTP：Time-based OTP（Google Authenticator、Authy）
- SMS：短信验证码（SIM 卡劫持风险）
- Email：邮箱验证码
- Push 通知：手机推送确认
- 生物识别：指纹、面容 ID
- 硬件令牌：YubiKey、U2F
- 备用码：恢复码、打印存储

### Token 管理
- Token 存储：HttpOnly Cookie（Web）、Keychain/Keystore（移动端）
- Token 过期：短期 Access Token（15 分钟-1 小时）、长期 Refresh Token（天/周）
- Token 撤销：黑名单、版本号、Redis 存储
- Token 刷新：自动刷新、Sliding Session
- Token 轮换：Refresh Token Rotation

### 防暴力破解
- 限流：IP 级别、账户级别、验证码
- 账户锁定：多次失败后锁定、临时锁定、永久锁定
- 延迟响应：指数退避
- 验证码：图形验证码、reCAPTCHA、滑块验证
- 风控系统：设备指纹、行为分析、机器学习

### 审计日志
- 记录内容：登录/登出、权限变更、敏感操作
- 日志字段：时间、用户、IP、操作、结果
- 日志保护：不可篡改、定期归档、权限控制
- 异常告警：异地登录、异常时间、失败次数

## 下一步学习

掌握认证授权后，可以继续深入：

- **密码学** - 加密算法、数字签名、PKI 体系
- **Web 安全** - XSS、CSRF、会话安全
- **零信任架构** - Zero Trust、BeyondCorp
- **身份管理** - Keycloak、Auth0、Okta
- **联邦身份** - SAML 2.0、WS-Federation
- **区块链身份** - DID、去中心化身份

认证授权是应用安全的基石。一个看似简单的"登录"功能，背后涉及密码学、网络安全、分布式系统、用户体验等多个领域。选择合适的方案，不仅要考虑安全性，还要权衡复杂度、用户体验、可扩展性。没有完美的方案，只有最适合的方案。
