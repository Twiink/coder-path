# 认证授权学习路线

**先分清两个词(面试第一问)**:认证(Authentication)回答"**你是谁**"(登录:验明正身);授权(Authorization)回答"**你能做什么**"(权限:能不能看这个订单/调这个接口)。方案演进路线:**Session-Cookie(经典) → Token/JWT(现代) → OAuth2/OIDC(第三方与单点登录)**——没有"最好的方案",只有"最适合场景的方案"(传统 Web、纯 API、微服务、多系统登录,各有答案)。本页是全景地图,落地实现会散落在各框架页([Spring Security](/learning-paths/backend/spring-boot)/[NestJS](/learning-paths/backend/nestjs)/[Laravel Sanctum](/learning-paths/backend/laravel)/[Django](/learning-paths/backend/django) 等)与 [Web 安全](/learning-paths/security/web-security)(攻击面)和 [密码学](/learning-paths/security/cryptography)(加密地基)两页。

这条线按 **认证基础(Session vs Token)→ JWT 深挖 → 单点登录 SSO → OAuth 2.0 → OpenID Connect → 授权模型 → 安全实践 → 落地选型** 推进。

## 第一站:认证基础——Session-Cookie 与 Token

**HTTP Basic(认识即可)**:用户名密码 Base64 放请求头——**Base64 可逆,仅限内网/开发环境**。**Session-Cookie(传统 Web 的标准答案)**:流程——登录成功后**服务端创建 Session(存内存/Redis/数据库)**,把 sessionId 通过 Set-Cookie 发给浏览器;后续请求自动携带 Cookie,服务端查 Session 确认身份。**优点**:服务端完全可控(**想踢人就删 Session**)、实现简单;**缺点**:多实例部署要**共享 Session(Redis 集中存储)**、跨域/移动端不友好。**安全要点**:Cookie 加 **HttpOnly(防 XSS 读)/Secure(仅 HTTPS)/SameSite(防 CSRF)**;登录成功后**重建 SessionId(防会话固定攻击)**;会话超时与登出销毁(详见 [Web 安全](/learning-paths/security/web-security) 的 CSRF 与 Cookie 章)。**Token 认证(API/移动端的答案)**:登录后服务端签发 Token 返回,**客户端自己存,后续请求带 `Authorization: Bearer <token>`**——服务端**无状态**(不存会话,验 token 即可);适合跨域/移动/多端;**代价:无法主动撤销**(登出只是前端丢 token,服务端不认账——要撤销需黑名单/短过期)。

## 第二站:JWT 深挖——现代 Token 的事实标准

**结构(背下来)**:`Header.Payload.Signature` 三段,每段 Base64Url 编码——**重要认知:Payload 只是"编码"不是"加密",任何人可解码看到内容——千万别放密码等敏感信息**;Header 声明算法,Signature 用密钥对前两段签名(防篡改:改 payload 签名就对不上)。**签名算法选择**:HS256(对称:一个密钥签与验——单一服务)、**RS256(非对称:私钥签、公钥验——多服务/第三方验签的首选:资源服务器只有公钥就能验)**。**流程与存储**:登录发 token → 客户端存储(Web:**放内存或 HttpOnly Cookie(防 XSS 读取)vs localStorage(方便但 XSS 可读——**安全与体验的经典权衡,敏感系统用 Cookie**)/移动端放安全存储)→ 请求带 Bearer → 服务端验签名+过期(exp)。**优点**:无状态(水平扩展零成本)、跨域跨语言、自包含;**代价**:**无法主动失效**(登出/改密/踢人做不到——折中:短过期+黑名单+版本号)、体积较大、密钥泄露=全线沦陷(密钥管理!).**最佳实践**:Access Token 短命(15 分钟~1 小时)+ **Refresh Token 长命(7~30 天,可撤销,存服务端/DB——access 过期用它换新的,免频繁登录;Refresh Token Rotation(每次刷新换发新 RT,旧的作废——防泄漏)**;HTTPS 传输;`aud`(受众)校验(防 token 跨服务乱用)。**框架落地**:Spring Security JWT/NestJS Passport/Laravel Sanctum 的实现都是"签发+过滤器/守卫验签+注入当前用户"的同一套路(见各框架页)。

## 第三站:单点登录 SSO——一次登录,多处访问

**问题**:公司有 OA/财务/CRM 三个系统,难道各登一次?**SSO 思想**:统一**认证中心**,一次登录,处处通行。**三种主流形态**:①**CAS(经典,Java 老系统多)**:重定向到 CAS Server 登录 → 发一次性票据(Ticket)→ 应用拿票据回 CAS 验证换用户信息——**集中、成熟,但集成较重**;②**SAML(企业级标准:IdP 身份提供者 + SP 服务提供者,基于 XML 断言)**——老牌企业/微软系/教育机构在用;**重(XML)、移动端不友好**,新项目少选;③**OAuth2/OIDC 做 SSO(现代主流)**:授权服务器兼任认证中心,应用作为客户端接入——**"用 Google/GitHub 登录"本质就是 OIDC 形态的 SSO**。**选型**:新系统直接 OIDC;存量企业环境 SAML;Java 老架构 CAS。**实现**:自建 IdP 用 **Keycloak(开源,事实标准)** 或托管 Auth0/Okta/云 IAM——**SSO 协议复杂度高,别手写,用现成 IdP**(见第八站)。

## 第四站:OAuth 2.0——授权协议(不是认证!)

**最重要的一句话:OAuth2.0 解决的是"授权"(允许第三方应用访问我在某平台的资源:让打印网站访问我的 Google 相册),它不是认证协议**(它不告诉你"用户是谁",只给"访问资源的令牌")——**要认证,在 OAuth2 上加 OIDC(下一站)**。**四个角色**:资源所有者(用户)/客户端(第三方应用)/授权服务器(平台)/资源服务器(存资源的 API)。**授权码模式(Authorization Code,最安全最常用,必须吃透)**:①客户端把用户重定向到授权服务器登录页 → ②用户同意授权 → ③授权服务器回调客户端,带一次性 **code** → ④**客户端后端**用 code + client_secret 换 **Access Token**(code 只用一次、短效;**token 不经过浏览器——防泄露的关键**);**PKCE(Proof Key for Code Exchange,现代客户端都该加)**:发起时先生成 code_verifier/challenge,换 code 时校验——**SPA/移动端防"授权码被截获"的标准补丁**(浏览器环境没有 secret 可藏,PKCE 就是替代防线)。**其他模式(知道就好)**:隐式模式(已废弃:token 直接进 URL 片段)、密码模式(OAuth2.1 已移除——自家应用直接用自家登录,别走 OAuth)、**客户端凭证模式(Client Credentials:client_id+secret 直接换 token,无用户参与——服务间调用的标准)**。**安全清单**:state 参数(防 CSRF:回调要校验 state 与发起时一致)、**redirect_uri 严格白名单校验(防回调劫持)**、code 单次短效、全程 HTTPS。

## 第五站:OpenID Connect(OIDC)——OAuth2 + 认证层

**OIDC = OAuth2 授权码流程 + 一个 ID Token**:①scope 里加 **openid**;②授权服务器额外返回 **ID Token(一个 JWT:sub(用户唯一 id)/iss/aud/exp/nonce/email 等标准 claims)——客户端验签后确认"用户是谁"**;③Access Token 仍用于调资源服务器 API。**关键区分(面试常考)**:ID Token **给客户端看(证明身份)**,Access Token **给资源服务器用(代表授权)**。**nonce**:防重放(客户端发的随机数,ID Token 里带回校验)。**Discovery 与 JWKS(现代 OIDC 的工程便利)**:授权服务器暴露 `/.well-known/openid-configuration`(自动发现:授权端点/token 端点/JWKS 地址)→ 客户端自动配置;**JWKS(公钥集合端点):客户端拿公钥验 ID Token 的 RS256 签名**——**"用 Google 登录"的完整技术链就是:跳 Google 授权页 → 回调 code → 后端换 token(含 ID Token)→ 用 JWKS 公钥验 ID Token → 确认邮箱/姓名 → 建本地会话**。**落地**:框架有现成库(Spring 的 oauth2-client、next-auth、passport 策略、laravel socialite 等)——**别自己实现 OIDC 协议**。

## 第六站:授权模型——权限怎么设计

**①RBAC(基于角色,90% 业务的答案)**:用户→角色→权限,用户挂角色(admin/editor/viewer),角色挂权限——简单直观、管理方便;**注意别让角色爆炸**(每需求一个角色就失控——配"角色+细粒度权限"混合)。**②ABAC(基于属性)**:用"主体属性+资源属性+环境属性+策略"动态判定(如"财务部+金额<1万+上班时间 可审批")——**细粒度/多租户/云场景**;复杂、策略管理是成本。**③ACL(访问控制列表)**:资源上挂"谁能访问"清单——文件系统/简单资源级。**④PBAC/策略引擎(现代微服务新宠)**:策略与代码分离,**OPA(Rego)/Casbin** 集中管理+动态更新——复杂授权逻辑(多服务统一策略)的解耦答案。**⑤数据级授权(最常被漏的一层,与 [IDOR](/learning-paths/security/web-security) 直接相关)**:接口鉴权做了,但"用户只能查自己的订单"没做=越权——实现:查询强制带属主条件(service 层统一拼接 user_id 过滤)、中间件拦截。**微服务授权架构**:统一在 API 网关鉴权 → 验签后把用户上下文透传下游(自定义头 X-User-ID/X-User-Roles,**下游信任网关(内网信任边界)**);服务间互信用 mTLS 或客户端凭证(见 [服务网格](/learning-paths/cloud-native/service-mesh) mTLS 章)。

## 第七站:安全实践清单

**①密码存储**:**Argon2/bcrypt 加盐慢哈希,永远不存明文/不自己发明哈希**(算法原理见 [密码学](/learning-paths/security/cryptography));**②找回密码**:临时一次性链接+短过期+验证身份,不直接重置。**③MFA(多因素,敏感系统必上)**:TOTP(标准,Google Authenticator 类)/WebAuthn 硬件密钥(最强)/SMS(弱:可 SIM 劫持——能用 TOTP 别用 SMS);配**备用恢复码**(用户丢设备能自救)。**④防暴力破解**:登录限流(IP 级+账户级)、失败锁定(临时)、验证码/人机校验、风控(异地/异常时间告警)。**⑤会话与 Token 管理**:过期(access 短/refresh 长)、登出撤销、刷新轮换、**改密后强制旧 token/session 失效**、滑动会话(活跃续期)。**⑥审计日志**:登录/登出/权限变更/敏感操作全记录(时间/用户/IP/结果),防篡改与异常告警——**合规与追责的底线**。**⑦零信任视角**:现代架构默认"网络不可信"(服务间 mTLS、持续验证)——见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 安全章。

## 第八站:落地选型——决策树与建议

**按场景对号入座**:①传统服务端渲染 Web(单体)→ **Session-Cookie**(框架内置,省心);②SPA/纯 API/移动端 → **JWT(access+refresh+rotation)**,框架内置方案(Spring Security/Sanctum/next-auth)直接配;③要"第三方登录"(用 Google/GitHub 登录)→ **OIDC**(库接入 IdP);④多系统 SSO → 自建 **Keycloak** 或托管 IdP(Auth0/Okta/云);⑤服务间调用 → mTLS 或 Client Credentials;⑥复杂权限 → RBAC 起步,**真不够再上 OPA/Casbin**。**三条铁律**:①**别自己造认证轮子**(协议与密码学实现复杂且易错——用成熟库/IdP/框架内置);②**默认安全参数**(短 access/HTTPS/HttpOnly/限流——"先安全后便利");③**授权与认证分开设计**(登录做了,权限模型与数据级隔离要同步做——越权漏洞多源于此)。**学习资源**:oauth.net/OpenID 官方文档(协议图解清晰)、Auth0 博客(工程实践)、Keycloak 文档(自建 IdP 实操)、各框架认证章节(落地代码)。

## 通关标准

能独立做到:画出 Session-Cookie 与 JWT 的完整时序图并说出各自的优缺点与适用场景;讲清 JWT 三段结构与 HS256/RS256 区别、为什么 Payload 不能放敏感信息、Refresh Token 轮换解决什么;画出 OAuth2 授权码 + PKCE 全流程并解释 state 与 redirect_uri 校验防什么;**一句话说清 OAuth2 与 OIDC 的关系与区别**;给系统设计 RBAC(用户-角色-权限表)并指出数据级授权的实现位置;写出安全清单(密码哈希/MFA/限流/审计/会话撤销)并能落地——认证授权主线通关。

认证授权是应用安全的基石:一个"登录"背后牵着密码学、会话管理、分布式与用户体验——**它也是最容易"看着会了、上线出事"的模块**(越权、token 泄露、会话固定都是高频真实漏洞)。学习的正确姿势:**先吃透本页的概念与流程图(能画出来才算会),再用框架内置方案落地,最后用安全清单自检**——协议细节交给库,架构判断留给自己。下一步:加密算法与证书的底层看 [密码学](/learning-paths/security/cryptography),攻击面回顾 [Web 安全](/learning-paths/security/web-security)。
