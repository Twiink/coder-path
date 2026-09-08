---
title: "异常处理"
aliases:
  - "Java 异常体系"
  - "try-with-resources"
tags:
  - "后端"
  - "java"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/集合框架-Map与源码剖析]]"
  - "[[后端/Java基础/泛型枚举与注解]]"
  - "[[后端/SpringBoot/整合Web开发]]"
  - "[[后端/JVM/JVM调优与线上问题排查]]"
created: 2026-09-06
updated: 2026-09-06
---

# 异常处理

## 1. 异常体系结构

```
                        java.lang.Object
                              ↑
                        java.lang.Throwable          ← 所有异常的根
                    ┌─────────┴──────────┐
              java.lang.Error       java.lang.Exception
              （错误，不可恢复）      （异常，可处理）
                    │                    │
        ┌───────────┼────────┐    ┌──────┴──────────────┐
        │           │        │    │                     │
   OutOfMemory  StackOverflow │  RuntimeException    非 RuntimeException
   Error        Error        │  （ unchecked 非受检）  （ checked 受检异常）
        │           │        │    │                     │
   NoClassDefFound  │        │  ┌─┴──────────────┐   ┌──┴─────────────┐
   Error            │        │  │ NullPointer    │   │ IOException     │
                    │        │  │ ClassCast      │   │ SQLException    │
              AssertionError │  │ IndexOutOfBounds│  │ FileNotFoundException│
                             │  │ Arithmetic     │   │ ClassNotFoundException│
                             │  │ IllegalArgument│   │ InterruptedException │
                             │  │ NumberFormat   │   │ CloneNotSupported│
                             │  │ ConcurrentModif│   └────────────────┘
                             │  │ UnsupportedOper│
                             │  └────────────────┘
```

### 1.1 Error vs Exception

| 对比项 | Error（错误） | Exception（异常） |
| --- | --- | --- |
| 含义 | **JVM 层面的严重问题**，程序无法处理 | 程序层面的问题，**可以且应该处理** |
| 是否可恢复 | 不可恢复 | 可恢复（处理后继续） |
| 是否应捕获 | **不应该捕获**（catch 了也没用） | 应该处理 |
| 来源 | JVM 资源耗尽、系统故障 | 代码逻辑、IO、网络、数据库 |
| 典型 | `OutOfMemoryError`、`StackOverflowError`、`NoClassDefFoundError`、`ExceptionInInitializerError`、`AssertionError` | `IOException`、`SQLException`、`NullPointerException` |

**常见 Error 详解：**

| Error | 触发原因 | 排查方向 |
| --- | --- | --- |
| `OutOfMemoryError: Java heap space` | 堆内存不足 | 内存泄漏、大对象、堆太小 → jmap dump 分析 |
| `OutOfMemoryError: GC overhead limit exceeded` | GC 花了 98% 时间却只回收 2% 内存 | 同上 |
| `OutOfMemoryError: Metaspace` | 元空间不足（类太多） | 动态代理/反射生成类过多、热部署泄漏 → `-XX:MaxMetaspaceSize` |
| `OutOfMemoryError: unable to create new native thread` | 线程数超系统限制 | 线程泄漏、`ulimit -u` 太小 |
| `OutOfMemoryError: Direct buffer memory` | 堆外内存不足 | NIO 的 DirectByteBuffer 未释放 → `-XX:MaxDirectMemorySize` |
| `StackOverflowError` | 栈深度超限（递归过深） | 递归无终止、JSON 深层嵌套 → `-Xss` |
| `NoClassDefFoundError` | 编译时存在的类运行时找不到 | 依赖缺失、版本冲突、jar 未打包 |
| `ClassNotFoundException` | 动态加载类时找不到（Exception） | 类路径错误 |
| `ExceptionInInitializerError` | 静态初始化块抛异常 | 静态代码块中的错误 |
| `UnsupportedClassVersionError` | class 版本高于运行时 JRE | JDK 版本不匹配 |

> 【坑】**`NoClassDefFoundError` vs `ClassNotFoundException`**：
> - `ClassNotFoundException`：**受检异常**，发生在**运行时动态加载**类时（`Class.forName()`、`ClassLoader.loadClass()`、反序列化），可以 catch 处理。
> - `NoClassDefFoundError`：**Error**，发生在编译时类存在但**运行时找不到**（jar 缺失、版本冲突、静态初始化失败），通常无法 catch。

### 1.2 Checked vs Unchecked（受检 vs 非受检）★★★★★

| 对比项 | Checked Exception（受检） | Unchecked Exception（非受检） |
| --- | --- | --- |
| 继承自 | `Exception`（非 RuntimeException 分支） | `RuntimeException` 或 `Error` |
| 编译器检查 | ✅ **强制处理**（try-catch 或 throws 声明） | ❌ 不强制 |
| 语义 | **可预期、可恢复的外部问题** | **程序 bug / 不可恢复问题** |
| 典型 | `IOException`、`SQLException`、`ClassNotFoundException`、`InterruptedException`、`FileNotFoundException` | `NullPointerException`、`IllegalArgumentException`、`IndexOutOfBoundsException`、`ClassCastException`、`ArithmeticException` |
| 处理方式 | catch 后恢复，或向上 throws | 修复代码 bug，而非 catch |
| 数量 | JDK 中约 60+ 个 | 约 20+ 个 |

```java
// 受检异常：编译器强制你处理
public void readFile(String path) throws IOException {      // 方式 1：throws 声明
    Files.readAllBytes(Paths.get(path));
}

public void readFile2(String path) {
    try {
        Files.readAllBytes(Paths.get(path));                 // 方式 2：try-catch
    } catch (IOException e) {
        log.error("读取文件失败：{}", path, e);
        throw new BusinessException("文件读取失败", e);       // 转成运行时异常
    }
}

// readFile(path);   ← 不处理直接编译错误：Unhandled exception: java.io.IOException

// 非受检异常：编译器不管
public void process(String s) {
    s.length();          // 可能 NPE，但编译器不强制处理
    Integer.parseInt(s); // 可能 NumberFormatException，编译器不管
}
```

**【面试】为什么 Spring / Hibernate 把 SQLException 转为非受检异常？**

传统 JDBC 的 `SQLException` 是受检异常，导致：
1. 每一层都要 `throws SQLException` 或 try-catch，**代码被异常处理淹没**。
2. 上层（Controller）通常无法恢复数据库错误，只能重新包装，**毫无意义的传递**。
3. 无法用 AOP 统一处理（受检异常必须显式声明，切面无法透明插入）。

**Spring 的方案：`DataAccessException`（非受检）体系**

```java
// JDBC 原生
try {
    pstmt.executeUpdate();
} catch (SQLException e) {          // 受检，必须处理
    throw e;
}

// Spring JdbcTemplate：内部捕获 SQLException，转换为 DataAccessException（非受检）
jdbcTemplate.update(sql);           // 无需 try-catch！
// 转换由 SQLErrorCodeSQLExceptionTranslator 完成：
// SQLException(errorCode=1062 唯一键冲突) → DuplicateKeyException
// SQLException(errorCode=1213 死锁)       → DeadlockLoserDataAccessException
// SQLException(连接失败)                  → CannotGetJdbcConnectionException
```

**Spring 的异常转换体系：**

```
DataAccessException（非受检）
├── NonTransientDataAccessException
│   ├── BadSqlGrammarException              SQL 语法错误
│   ├── DataIntegrityViolationException     数据完整性（字段太长、非空约束）
│   ├── DuplicateKeyException               唯一键冲突 ★ 业务常用
│   └── PermissionDeniedDataAccessException
├── TransientDataAccessException
│   ├── CannotAcquireLockException          获取锁失败
│   ├── DeadlockLoserDataAccessException    死锁 ★
│   └── QueryTimeoutException
├── CannotGetJdbcConnectionException        拿不到连接
└── EmptyResultDataAccessException          查询结果为空（queryForObject 时）
```

> 【面试加分】**这个设计的好处**：
> 1. 业务代码不用被 try-catch 污染，可读性高。
> 2. 异常语义更贴近业务（`DuplicateKeyException` 比 `errorCode=1062` 直观）。
> 3. **数据库无关性**：换数据库（MySQL → Oracle）业务代码不用改，异常类型稳定。
> 4. 能被 Spring AOP 的全局异常处理器统一捕获（详见 [[后端/SpringBoot/整合Web开发]]）。

### 1.3 Throwable 的核心方法

```java
try {
    riskyOperation();
} catch (Exception e) {
    e.getMessage();                  // 异常消息（可能为 null）
    e.getLocalizedMessage();         // 本地化消息（默认同 getMessage）
    e.getCause();                    // 根因异常（包装异常时用）
    e.getStackTrace();               // StackTraceElement[] 完整调用栈
    e.getSuppressed();               // try-with-resources 中被抑制的异常（JDK 7+）
    e.printStackTrace();             // ❌ 打印到 stderr，生产禁用！用日志框架
    e.toString();                    // "java.lang.NullPointerException: xxx"
    e.fillInStackTrace();            // 重新填充栈信息（性能优化时会禁用）
    e.addSuppressed(otherException); // 手动添加被抑制异常
    e.initCause(cause);              // 设置根因（构造器未传时）

    // StackTraceElement
    StackTraceElement[] st = e.getStackTrace();
    st[0].getClassName();            // "com.example.Service"
    st[0].getMethodName();           // "process"
    st[0].getFileName();             // "Service.java"
    st[0].getLineNumber();           // 42
    st[0].isNativeMethod();          // 是否 native 方法
}
```

**异常栈的打印格式：**

```
java.lang.RuntimeException: 业务处理失败                    ← toString()
	at com.example.Service.process(Service.java:42)         ← 栈顶（异常发生处）
	at com.example.Controller.handle(Controller.java:25)
	at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
	...
Caused by: java.sql.SQLException: Duplicate entry '1001'   ← 根因（getCause）
	at com.mysql.jdbc.SQLError.createSQLException(SQLError.java:965)
	at com.example.Dao.insert(Dao.java:88)
	... 15 more                                              ← 与上层重复的栈帧被省略
```

## 2. 异常处理的五种方式

### 2.1 try-catch-finally

```java
try {
    // 可能抛异常的代码（受保护区域）
    int result = 10 / 0;
} catch (ArithmeticException e) {          // 捕获特定异常
    log.error("除零错误", e);
    result = 0;
} catch (RuntimeException e) {             // 多个 catch 必须从具体到宽泛！
    log.error("运行时异常", e);
} catch (Exception e) {                    // 兜底
    log.error("未知异常", e);
} finally {
    // 无论如何都执行（除 System.exit / JVM 崩溃 / 守护线程被杀）
    cleanup();
}
```

**catch 的顺序规则：**

```java
// ❌ 编译错误：子类异常必须在父类之前
try { } catch (Exception e) { } catch (IOException e) { }
// error: exception IOException has already been caught

// ✅ 正确
try { } catch (IOException e) { } catch (Exception e) { }

// JDK 7+ 多重捕获（Multi-catch）：一个 catch 处理多种异常
try {
    ...
} catch (IOException | SQLException e) {       // 用 | 分隔（不能有继承关系！）
    log.error("IO 或数据库异常", e);
    // ⚠️ e 是「有效 final」的，不能重新赋值
}
// catch (FileNotFoundException | IOException e) { }  ← ❌ 编译错误，有继承关系

// JDK 9+ 精确重抛（final rethrow）
try {
    throw new IOException();
} catch (final Exception e) {      // 声明为 final
    throw e;                        // ✅ 编译器知道实际只可能是 IOException，调用方只需 catch IOException
}
```

### 2.2 throws 声明抛出

```java
// 声明方法可能抛出的异常，交给调用方处理
public void readFile(String path) throws IOException, ParseException {
    ...
}

// 重写方法时，throws 的受检异常不能比父类更多/更宽
class Parent {
    public void f() throws IOException { }
}
class Child extends Parent {
    @Override
    public void f() throws FileNotFoundException { }   // ✅ IOException 的子类
    @Override
    public void f() throws Exception { }               // ❌ 比父类宽
    @Override
    public void f() throws SQLException { }            // ❌ 父类没声明的新异常
    @Override
    public void f() { }                                // ✅ 不抛（更严格）
    // 非受检异常不受此限制
    @Override
    public void f() throws RuntimeException { }        // ✅
}
```

### 2.3 throw 抛出异常对象

```java
// throw 抛出的是「异常对象实例」，throws 声明的是「异常类型」
public void setAge(int age) {
    if (age < 0 || age > 150) {
        throw new IllegalArgumentException("年龄必须在 0~150 之间，实际：" + age);
    }
    this.age = age;
}

// 业务异常的典型抛法
public User getUser(Long id) {
    User user = userMapper.selectById(id);
    if (user == null) {
        throw new BusinessException(ResultCode.USER_NOT_FOUND, "用户不存在：" + id);
    }
    return user;
}

// 重新抛出（包装异常，保留根因）
try {
    dao.insert(record);
} catch (SQLException e) {
    throw new BusinessException("保存失败", e);      // ★ 一定要传入 e 作为 cause！
    // throw new BusinessException("保存失败");      // ❌ 丢失根因，无法排查
}
```

> 【强制】**包装异常时必须传入原异常作为 cause**，否则根因栈信息丢失，线上问题无法排查。这是最常见的异常处理错误之一。

### 2.4 try-with-resources（JDK 7+）★★★★★

**自动关闭实现了 `AutoCloseable` 的资源，彻底告别 finally 关流。**

```java
// ❌ 传统写法（繁琐且易错）
InputStream in = null;
OutputStream out = null;
try {
    in = new FileInputStream("a.txt");
    out = new FileOutputStream("b.txt");
    byte[] buf = new byte[1024];
    int len;
    while ((len = in.read(buf)) != -1) {
        out.write(buf, 0, len);
    }
} catch (IOException e) {
    log.error("复制失败", e);
} finally {
    // 关流本身也可能抛异常，还要嵌套 try-catch！
    if (in != null) {
        try { in.close(); } catch (IOException e) { log.error("关闭输入流失败", e); }
    }
    if (out != null) {
        try { out.close(); } catch (IOException e) { log.error("关闭输出流失败", e); }
    }
}

// ✅ try-with-resources（简洁、安全）
try (InputStream in = new FileInputStream("a.txt");        // 多个资源用 ; 分隔
     OutputStream out = new FileOutputStream("b.txt")) {
    byte[] buf = new byte[8192];
    int len;
    while ((len = in.read(buf)) != -1) {
        out.write(buf, 0, len);
    }
} catch (IOException e) {
    log.error("复制失败", e);
}
// 块结束时自动调用 out.close() 然后 in.close()（逆序！）
```

**资源的要求：**

```java
// 必须实现 AutoCloseable 或 Closeable 接口
public interface AutoCloseable {
    void close() throws Exception;
}
public interface Closeable extends AutoCloseable {
    void close() throws IOException;        // 更具体的异常类型
}

// JDK 9+ 可以用「已存在的 final 变量」
InputStream in = new FileInputStream("a.txt");
try (in) {                                  // JDK 9+：直接引用外部 final/effectively final 变量
    ...
}
// JDK 8 必须写成 try (InputStream in = ...) { }
```

**【原理】编译器如何展开 try-with-resources：**

```java
// 源码
try (Resource r = new Resource()) {
    r.doSomething();
}

// 编译后等价于
Resource r = new Resource();
Throwable primaryException = null;
try {
    r.doSomething();
} catch (Throwable t) {
    primaryException = t;
    throw t;
} finally {
    if (primaryException != null) {
        try {
            r.close();
        } catch (Throwable suppressed) {
            primaryException.addSuppressed(suppressed);   // ★ 抑制异常，不覆盖主异常
        }
    } else {
        r.close();
    }
}
```

**被抑制的异常（Suppressed Exception）★ 关键设计：**

```java
// 场景：try 块抛异常 A，close() 又抛异常 B
static class BadResource implements AutoCloseable {
    public void use() { throw new RuntimeException("业务异常 A"); }
    @Override public void close() { throw new RuntimeException("关闭异常 B"); }
}

try (BadResource r = new BadResource()) {
    r.use();
} catch (RuntimeException e) {
    System.out.println("主异常：" + e.getMessage());         // "业务异常 A" ★ 主异常优先
    for (Throwable s : e.getSuppressed()) {
        System.out.println("被抑制异常：" + s.getMessage());   // "关闭异常 B"
    }
}

// 对比传统写法：finally 中 close() 抛的异常会「吞掉」try 中的异常！
try {
    throw new RuntimeException("业务异常");
} finally {
    throw new RuntimeException("关闭异常");    // ★ 业务异常彻底丢失，只有关闭异常！
}
// 这就是 try-with-resources 的重要价值：主异常不会被清理逻辑的异常覆盖
```

**try-with-resources 的适用资源：**

| 资源类型 | 示例 |
| --- | --- |
| IO 流 | `FileInputStream`、`BufferedReader`、`Socket`、`ServerSocket` |
| 数据库 | `Connection`、`Statement`、`PreparedStatement`、`ResultSet` |
| 并发 | `Lock`（❌ 不适用，Lock 没有 close！要用 try-finally） |
| 其他 | `Scanner`、`Stream`（JDK 8 的流实现了 AutoCloseable）、`ZipFile`、`Formatter` |

```java
// 数据库操作
try (Connection conn = dataSource.getConnection();
     PreparedStatement ps = conn.prepareStatement(sql);
     ResultSet rs = ps.executeQuery()) {
    while (rs.next()) { ... }
}

// Stream 也要关闭（涉及文件/网络资源时）
try (Stream<String> lines = Files.lines(path)) {
    return lines.filter(...).collect(Collectors.toList());
}

// ❌ Lock 不是 AutoCloseable，仍需 try-finally
Lock lock = new ReentrantLock();
lock.lock();
try {
    // 临界区
} finally {
    lock.unlock();               // 必须在 finally 中释放
}
```

### 2.5 异常链与自定义异常

见下一节。

## 3. 自定义异常

### 3.1 标准自定义异常

```java
/**
 * 业务异常（非受检，业务代码中自由抛出，由全局处理器统一转 HTTP 响应）
 */
public class BusinessException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** 错误码 */
    private final Integer code;

    /** 错误消息 */
    private final String msg;

    public BusinessException(String msg) {
        super(msg);                      // ★ 调用父类构造器设置 message
        this.code = ResultCode.FAILED.getCode();
        this.msg = msg;
    }

    public BusinessException(Integer code, String msg) {
        super(msg);
        this.code = code;
        this.msg = msg;
    }

    public BusinessException(ResultCode resultCode) {
        super(resultCode.getMessage());
        this.code = resultCode.getCode();
        this.msg = resultCode.getMessage();
    }

    public BusinessException(ResultCode resultCode, String msg) {
        super(msg);
        this.code = resultCode.getCode();
        this.msg = msg;
    }

    /** ★ 包装其他异常（保留根因链） */
    public BusinessException(String msg, Throwable cause) {
        super(msg, cause);               // ★ 传入 cause
        this.code = ResultCode.FAILED.getCode();
        this.msg = msg;
    }

    public BusinessException(ResultCode resultCode, Throwable cause) {
        super(resultCode.getMessage(), cause);
        this.code = resultCode.getCode();
        this.msg = resultCode.getMessage();
    }

    public Integer getCode() { return code; }
    public String getMsg() { return msg; }
}
```

### 3.2 错误码枚举（企业级实践）

```java
/**
 * 统一错误码枚举
 * 规范：错误码分段，便于定位问题来源
 *   00000 成功
 *   1xxxx 用户端错误（参数、权限）
 *   2xxxx 业务错误
 *   3xxxx 第三方服务错误
 *   5xxxx 系统错误
 */
public enum ResultCode {

    /* 成功 */
    SUCCESS(0, "操作成功"),

    /* 客户端错误 4xxx */
    FAILED(400, "操作失败"),
    VALIDATE_FAILED(401, "参数校验失败"),
    UNAUTHORIZED(402, "未登录或 Token 已过期"),
    FORBIDDEN(403, "无访问权限"),
    NOT_FOUND(404, "资源不存在"),

    /* 业务错误 2xxxx */
    USER_NOT_FOUND(20001, "用户不存在"),
    USER_ALREADY_EXISTS(20002, "用户已存在"),
    PASSWORD_ERROR(20003, "密码错误"),
    ACCOUNT_LOCKED(20004, "账号已被锁定"),

    ORDER_NOT_FOUND(21001, "订单不存在"),
    ORDER_STATUS_ILLEGAL(21002, "订单状态不合法"),
    ORDER_ALREADY_PAID(21003, "订单已支付"),
    STOCK_NOT_ENOUGH(21004, "库存不足"),

    PAY_FAILED(22001, "支付失败"),
    REFUND_FAILED(22002, "退款失败"),

    /* 第三方 3xxxx */
    THIRD_PARTY_TIMEOUT(30001, "第三方服务超时"),

    /* 系统错误 5xxxx */
    SYSTEM_ERROR(50000, "系统繁忙，请稍后重试"),
    DB_ERROR(50001, "数据库异常"),
    CACHE_ERROR(50002, "缓存异常");

    private final Integer code;
    private final String message;

    ResultCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }

    public Integer getCode() { return code; }
    public String getMessage() { return message; }
}
```

**统一响应体：**

```java
@Data
public class Result<T> implements Serializable {

    private Integer code;
    private String message;
    private T data;
    private Long timestamp;

    private Result(Integer code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.timestamp = System.currentTimeMillis();
    }

    public static <T> Result<T> success() { return new Result<>(0, "操作成功", null); }
    public static <T> Result<T> success(T data) { return new Result<>(0, "操作成功", data); }
    public static <T> Result<T> success(String msg, T data) { return new Result<>(0, msg, data); }

    public static <T> Result<T> failed(String msg) { return new Result<>(500, msg, null); }
    public static <T> Result<T> failed(ResultCode rc) { return new Result<>(rc.getCode(), rc.getMessage(), null); }
    public static <T> Result<T> failed(ResultCode rc, String msg) { return new Result<>(rc.getCode(), msg, null); }

    public boolean isSuccess() { return code != null && code == 0; }
}
```

### 3.3 受检 vs 非受检自定义异常的选择

| 选择 | 场景 | 示例 |
| --- | --- | --- |
| **继承 RuntimeException**（推荐） | 业务异常、编程错误、不可恢复问题 | `BusinessException`、`ValidationException` |
| **继承 Exception** | 调用方**有能力且应该恢复**的场景 | `RetryableException`、`ConfigNotFoundException` |

> 【主流实践】**现代 Java（尤其 Spring 生态）几乎只用非受检自定义异常**，理由：
> 1. 受检异常污染方法签名，每层都要 throws。
> 2. 业务异常上层无法「恢复」，只能转成 HTTP 错误响应，catch 无意义。
> 3. Lambda / Stream 中无法抛受检异常（函数式接口没声明）。
> 4. Spring 的 `@Transactional` **默认只对非受检异常回滚**（受检异常需 `rollbackFor = Exception.class`）—— 这是个大坑。

### 3.4 异常设计的最佳实践

```java
// ✅ 1. 异常只用于「异常情况」，不要做流程控制
// ❌ 反例：用异常判断数字
try {
    int n = Integer.parseInt(input);
    return true;
} catch (NumberFormatException e) {
    return false;
}
// ✅ 正例
public boolean isNumeric(String s) {
    if (s == null || s.isEmpty()) return false;
    for (char c : s.toCharArray()) if (!Character.isDigit(c)) return false;
    return true;
}
// 性能差异：抛异常要填充栈帧（fillInStackTrace 是 native 方法，遍历整个调用栈），
//          比普通 return 慢 100~1000 倍

// ✅ 2. 提供可恢复的信息，而非只说"失败了"
throw new BusinessException("库存不足：商品 ID=" + skuId + "，需要=" + need + "，剩余=" + stock);
// 而不是
throw new BusinessException("库存不足");

// ✅ 3. 保持异常层次清晰，按业务域划分
com.example.common.exception
├── BusinessException              # 通用业务异常
├── ValidationException              # 参数校验异常
├── AuthenticationException          # 认证异常
├── AuthorizationException           # 授权异常
└── ThirdPartyException              # 第三方调用异常

// ✅ 4. 高性能场景禁用栈信息（可选优化）
public class FastBusinessException extends RuntimeException {
    public FastBusinessException(String msg) { super(msg, null, false, false); }
    //                                              ↑writableStackTrace = false
    // 不填充栈信息，创建速度快 10 倍以上（但无法定位抛出点，慎用）
}

// ✅ 5. 提前失败（Fail Fast）
public void transfer(Account from, Account to, BigDecimal amount) {
    Objects.requireNonNull(from, "转出账户不能为空");
    Objects.requireNonNull(to, "转入账户不能为空");
    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
        throw new IllegalArgumentException("转账金额必须大于 0，实际：" + amount);
    }
    if (from.getBalance().compareTo(amount) < 0) {
        throw new BusinessException(ResultCode.BALANCE_NOT_ENOUGH);
    }
    // 全部校验通过后才执行业务
}
```

## 4. 运行时常见异常大全

### 4.1 高频异常与排查

| 异常 | 触发原因 | 典型代码 | 解决 |
| --- | --- | --- | --- |
| `NullPointerException` | 对 null 调用方法/访问字段/拆箱 | `nullObj.method()`、`int x = nullInt` | 判空、`Optional`、`Objects.requireNonNull` |
| `IndexOutOfBoundsException` | 数组/List 下标越界 | `list.get(list.size())` | 检查边界 |
| `ArrayIndexOutOfBoundsException` | 数组下标越界 | `arr[arr.length]` | 同上 |
| `StringIndexOutOfBoundsException` | 字符串下标越界 | `s.substring(0, 100)` | 检查长度 |
| `ClassCastException` | 强转类型不匹配 | `(Dog) catObject` | `instanceof` 判断 |
| `NumberFormatException` | 字符串转数字失败 | `Integer.parseInt("abc")` | 前置校验 `isNumeric` |
| `IllegalArgumentException` | 参数非法 | 手动抛出 | 参数校验 |
| `IllegalStateException` | 状态不对（时机错误） | 已关闭的流再操作 | 状态检查 |
| `ArithmeticException` | 算术错误（整数除 0） | `10 / 0` | 除前判断 |
| `ConcurrentModificationException` | 迭代中修改集合 | for-each 中 remove | `Iterator.remove`/`removeIf` |
| `UnsupportedOperationException` | 调用不支持的操作 | 不可变集合 add | 用可变集合 |
| `NoSuchElementException` | 迭代器/Optional 无元素 | `it.next()` 已到底 | `hasNext()` 判断 |
| `InterruptedException` | 线程被中断 | `Thread.sleep()` 中被 interrupt | 恢复中断状态 |
| `CloneNotSupportedException` | clone 未实现 Cloneable | `obj.clone()` | 实现 Cloneable |
| `SecurityException` | 安全管理器拒绝 | 沙箱受限操作 | 检查权限 |
| `StackOverflowError` | 递归过深 | 无终止的递归 | 改迭代 / 加 `-Xss` |
| `OutOfMemoryError` | 内存不足 | 大对象/内存泄漏 | dump 分析、调堆 |
| `NoSuchMethodError` | 运行时方法签名不匹配 | 依赖版本冲突 | `mvn dependency:tree` |
| `NoSuchFieldError` | 同上（字段） | 同上 | 同上 |
| `LinkageError` | 类重复定义 | 多 ClassLoader | 检查类加载器 |

### 4.2 几个特殊异常的深入

**InterruptedException（中断处理规范）★★★★★**

```java
// InterruptedException 是受检异常，抛出时「中断标志位已被清除」
// ❌ 错误 1：吞掉异常（中断信号丢失，线程池无法优雅关闭）
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    // 什么都不做 ← 严重错误！
}

// ❌ 错误 2：只打印日志
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    log.error("被中断", e);
}

// ✅ 正确 1：恢复中断状态，让上层感知
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();      // ★ 重新设置中断标志
    log.warn("任务被中断，提前退出");
    return;                                   // 尽快退出
}

// ✅ 正确 2：向上抛出（如果方法签名允许）
public void doWork() throws InterruptedException {
    Thread.sleep(1000);                       // 让调用方处理
}

// ✅ 正确 3：循环中检查中断，优雅退出
public void run() {
    try {
        while (!Thread.currentThread().isInterrupted()) {
            // 业务逻辑
            Thread.sleep(1000);
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();    // 退出前恢复标志
    }
    log.info("线程正常退出");
}

// ❌ 不要用 Thread.stop()（已废弃，会导致锁不释放、数据不一致）
// ✅ 用 interrupt() 协作式中断
```

> 【强制】**捕获 `InterruptedException` 后必须做两件事之一**：① 重新抛出；② 调用 `Thread.currentThread().interrupt()` 恢复标志位。**绝不能吞掉**，否则线程池的 `shutdownNow()` 无法停止任务。

**ConcurrentModificationException**

见 [[后端/Java基础/集合框架-List与Set]] 第 2.1 节的 fail-fast 源码分析。

**ArithmeticException**

```java
int a = 10 / 0;                    // ArithmeticException: / by zero（整数除 0）
double b = 10.0 / 0;               // Infinity（浮点除 0 不抛异常！）
BigDecimal c = new BigDecimal("1").divide(new BigDecimal("3"));
// ArithmeticException: Non-terminating decimal expansion;
// ← 无限小数未指定精度，必须传 scale 和 RoundingMode
new BigDecimal("1").divide(new BigDecimal("3"), 2, RoundingMode.HALF_UP);   // 0.33 ✅
```

**UnsupportedOperationException**

```java
// 常见来源
List<String> list = Arrays.asList("a", "b");
list.add("c");                              // ❌ 固定长度视图

List<String> list2 = List.of("a");          // JDK 9+ 完全不可变
list2.add("b");                             // ❌

Map<String, Integer> map = Collections.unmodifiableMap(...);
map.put("k", 1);                            // ❌

// MyBatis-Plus / Hibernate 返回的不可变集合
// Stream.collect(Collectors.toUnmodifiableList())  ← JDK 10+
```

## 5. JVM 处理异常的机制（异常表）★★★★★

### 5.1 异常表（Exception Table）

**JVM 不是用「跳转指令」实现 try-catch，而是用「异常表」**：每个方法在字节码中都有一张异常表，记录「哪段代码区间、捕获哪种异常、跳转到哪个 handler」。

```java
public static int test() {
    try {
        return 1 / 0;
    } catch (ArithmeticException e) {
        return 2;
    } finally {
        System.out.println("finally");
    }
}
```

`javap -c` 输出的异常表：

```
public static int test();
  Code:
     0: iconst_1
     1: iconst_0
     2: idiv                    ← 抛异常的位置
     3: ireturn
     4: astore_0                 ← catch 块开始
     5: iconst_2
     6: ireturn
     7: astore_1                 ← finally（正常路径）
     8: getstatic     #2
    11: invokevirtual #3
    14: ireturn
    15: astore_2                 ← finally（异常路径）
    ...

  Exception table:                ★ 异常表
     from    to  target type
         0     3     4   Class java/lang/ArithmeticException    ← try 块 [0,3) 抛 ArithmeticException → 跳到 4
         0     3     7   any                                    ← finally 覆盖（any = 所有 Throwable）
         4     6     7   any
         7    11    15   any
```

### 5.2 异常抛出与匹配的完整过程

```
1. 代码执行到 throw 指令（或 JVM 内部检测到错误）
2. JVM 创建异常对象，调用 fillInStackTrace()（native，遍历当前调用栈填充栈帧信息）★ 性能开销点
3. 在当前方法的异常表中，从「抛出点 PC」开始逆序查找匹配项：
   找 (from ≤ PC < to) 且 (异常类型 instanceof type) 的第一条记录
4. 若找到 → 跳转到 target 指向的 handler 代码，栈帧保留，继续执行
5. 若找不到 → 当前方法栈帧弹出（异常继续向上抛），回到调用方方法重复步骤 3
6. 一直抛到 main 方法都无 handler → 打印栈信息到 stderr，线程终止
   （若是主线程且无未捕获异常处理器 → JVM 退出）
```

**未捕获异常处理器（全局兜底）：**

```java
// 线程级
Thread.currentThread().setUncaughtExceptionHandler((t, e) -> {
    log.error("线程 {} 未捕获异常", t.getName(), e);
    alertService.send("线程异常：" + e.getMessage());
});

// 全局默认（所有线程）
Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
    log.error("全局未捕获异常，线程：{}", t.getName(), e);
});

// 线程池的线程需要单独设置（通过 ThreadFactory）
ThreadFactory factory = r -> {
    Thread t = new Thread(r);
    t.setUncaughtExceptionHandler((thread, e) -> log.error("线程池任务异常", e));
    return t;
};
ExecutorService pool = new ThreadPoolExecutor(..., factory);
// ⚠️ 注意：submit() 提交的任务异常会被封装到 Future 中，不会触发 UncaughtExceptionHandler！
//          execute() 提交的才会触发。详见 [[后端/Java基础/并发编程/线程池原理与实战]]
```

### 5.3 finally 的实现原理（字节码层面）

**编译器会把 finally 块的代码「复制」到所有可能的出口路径上**（正常返回、每个 catch 返回、异常抛出），所以 finally 代码在字节码中出现多次。

```java
public static int test() {
    int x = 1;
    try {
        return x;              // 路径 1：先暂存返回值 1，再执行 finally，再 ireturn
    } finally {
        x = 2;                 // 修改局部变量，不影响已暂存的返回值
        System.out.println("finally");
    }
}
// 返回 1，输出 "finally"
```

**为什么 finally 一定执行（除少数例外）：**

| 情况 | finally 是否执行 |
| --- | --- |
| try 正常结束 | ✅ |
| try 中 return | ✅（return 前先执行 finally） |
| try 中抛异常被 catch | ✅ |
| try 中抛异常未被 catch | ✅（异常向上抛前执行） |
| `System.exit(0)` | ❌ **不执行** |
| JVM 崩溃 / `kill -9` | ❌ |
| 线程被强制杀死（守护线程随主线程退出） | ❌ |
| `Runtime.getRuntime().halt(0)` | ❌（比 exit 更粗暴，不跑 shutdown hook） |
| 无限循环 / 死锁在 try 中 | ❌（到不了 finally） |
| 电源中断 | ❌ |

```java
// System.exit 会跳过 finally（但会执行 shutdown hook）
try {
    System.exit(0);
} finally {
    System.out.println("不会执行");
}

// shutdown hook 仍会执行
Runtime.getRuntime().addShutdownHook(new Thread(() -> System.out.println("hook 执行了")));
```

**经典面试题：finally 与 return 的执行顺序**

```java
public static int test1() {
    try {
        return 1;
    } finally {
        System.out.println("finally");
        // 没有 return
    }
}
// 输出 "finally"，返回 1

public static int test2() {
    try {
        return 1;
    } finally {
        return 2;                    // ❌ finally 中的 return 覆盖 try 的 return
    }
}
// 无输出，返回 2（且 IDEA 会警告 "return inside finally block"）

public static int test3() {
    int i = 0;
    try {
        i = 1;
        return i;                    // 暂存 i 的值 1 到返回值槽
    } finally {
        i = 2;                       // 改局部变量，不影响返回值槽
        System.out.println("i = " + i);   // 输出 i = 2
    }
}
// 输出 "i = 2"，返回 1

public static int test4() {
    List<Integer> list = new ArrayList<>();
    try {
        list.add(1);
        return list.size();          // 暂存 1
    } finally {
        list.add(2);                 // 改的是堆中对象，但返回值已确定
        System.out.println(list);    // [1, 2]
    }
}
// 输出 [1, 2]，返回 1

public static StringBuilder test5() {
    StringBuilder sb = new StringBuilder("a");
    try {
        return sb;                   // 暂存的是「引用」（不是值的快照！）
    } finally {
        sb.append("b");              // 通过引用修改对象内容
    }
}
// 返回的 StringBuilder 内容是 "ab"！
// ★ 区别：基本类型/String 暂存的是「值」，引用类型暂存的是「引用」
```

> 【关键理解】**`return` 的执行分两步**：① 计算返回值并暂存到栈帧的返回值槽；② 跳转到方法出口。finally 插在两步之间执行。所以：
> - 对**基本类型和 String**（不可变），finally 中改局部变量**不影响**已暂存的值。
> - 对**可变引用对象**，finally 中通过引用修改对象内容**会影响**返回的对象。
> - finally 中**自己 return** 会**直接覆盖**已暂存的返回值。

## 6. 异常处理的最佳实践与规范

### 6.1 阿里手册强制规约

| 级别 | 规约 |
| --- | --- |
| 【强制】 | Java 类库中定义的**可以通过预检查方式规避**的 RuntimeException，不应该用 catch 处理（如 NPE、IndexOutOfBounds） |
| 【强制】 | 异常不要用来做**流程控制、条件控制** |
| 【强制】 | catch 时请分清**稳定代码和非稳定代码**，对非稳定代码的 catch 尽可能区分异常类型 |
| 【强制】 | 捕获异常是为了处理它，**不要捕获了却什么都不处理而抛弃之**。如果不想处理，请将该异常抛给它的调用者 |
| 【强制】 | 事务场景中，抛出异常被 catch 后，**如果需要回滚，一定要注意手动回滚** |
| 【强制】 | `finally` 块必须对资源对象、流对象进行关闭，有异常也要 try-catch；**JDK 7+ 直接用 try-with-resources** |
| 【强制】 | **不要在 finally 块中使用 return** |
| 【强制】 | 捕获异常与抛异常必须完全匹配，或捕获异常是抛异常的父类 |
| 【强制】 | 在调用 RPC、二方包或动态生成类的相关方法时，**捕获异常必须使用 Throwable 类**来进行拦截（因为可能有 Error 或代理框架抛的异常） |
| 【推荐】 | 方法的返回值可以为 null，**必须添加注释充分说明什么情况下会返回 null**；调用方用判空或 `Optional` |
| 【推荐】 | 防止 NPE 是程序员的基本修养 |
| 【推荐】 | 定义时区分 unchecked / checked 异常，**避免直接抛出 RuntimeException，更不允许抛出 Exception 或 Throwable**，应使用有业务含义的自定义异常 |
| 【参考】 | 避免出现重复的代码（DRY），异常处理也要避免大量重复的 try-catch |

### 6.2 异常处理的分层策略（企业级实践）

```
┌────────────────────────────────────────────────┐
│ Controller 层：全局异常处理器 @RestControllerAdvice │  ← 唯一处理异常并转 HTTP 响应的地方
│   捕获所有异常 → 转成统一 Result 结构 → 记录日志     │
├────────────────────────────────────────────────┤
│ Service 层：抛业务异常，捕获后转换                   │
│   - 业务规则不满足 → throw BusinessException        │
│   - 捕获第三方/DAO 异常 → 包装为 BusinessException   │
│   - 不 catch 后什么都不做                          │
├────────────────────────────────────────────────┤
│ DAO 层：让框架异常直接抛出（Spring 已转换为非受检）    │
│   - 不 catch SQLException（Spring 会转）            │
│   - 唯一键冲突等可 catch 转为业务异常                 │
├────────────────────────────────────────────────┤
│ 工具类：抛非受检异常，携带足够上下文                   │
└────────────────────────────────────────────────┘
```

**Service 层的异常转换示例：**

```java
@Service
public class OrderService {

    public Order createOrder(OrderCreateParam param) {
        // 1. 前置校验（Fail Fast）
        Objects.requireNonNull(param.getUserId(), "userId 不能为空");

        // 2. 业务规则校验 → 抛业务异常（不 catch）
        User user = userService.getById(param.getUserId());
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        if (!user.isActive()) {
            throw new BusinessException(ResultCode.ACCOUNT_LOCKED, "用户已注销，无法下单");
        }

        // 3. 调用第三方 → catch 后转换为业务异常（保留根因）
        try {
            stockClient.deduct(param.getSkuId(), param.getQuantity());
        } catch (FeignException e) {                        // 第三方调用异常
            log.error("扣减库存失败, skuId={}, qty={}", param.getSkuId(), param.getQuantity(), e);
            throw new BusinessException(ResultCode.STOCK_DEDUCT_FAILED,
                    "库存服务异常：" + e.getMessage(), e);      // ★ 保留 cause
        } catch (Exception e) {
            log.error("未知异常", e);
            throw new BusinessException(ResultCode.SYSTEM_ERROR, e);
        }

        // 4. 数据库操作 → 唯一键冲突转业务语义
        try {
            orderMapper.insert(order);
        } catch (DuplicateKeyException e) {                 // Spring 转换后的异常
            log.warn("订单号重复：{}", order.getOrderNo());
            throw new BusinessException(ResultCode.ORDER_ALREADY_EXISTS);
        }
        // 其他 DataAccessException 不 catch，直接上抛给全局处理器

        return order;
    }
}
```

**Controller 层的全局异常处理器（Spring Boot）：**

```java
@Slf4j
@RestControllerAdvice                       // = @ControllerAdvice + @ResponseBody
public class GlobalExceptionHandler {

    /** 业务异常（可预期，WARN 级别，不打栈） */
    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusiness(BusinessException e) {
        log.warn("业务异常：code={}, msg={}", e.getCode(), e.getMsg());
        return Result.failed(e.getCode(), e.getMsg());
    }

    /** 参数校验异常（@Valid 触发） */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.warn("参数校验失败：{}", msg);
        return Result.failed(ResultCode.VALIDATE_FAILED, msg);
    }

    /** 约束违反异常（@Validated 在方法参数上） */
    @ExceptionHandler(ConstraintViolationException.class)
    public Result<Void> handleConstraint(ConstraintViolationException e) {
        String msg = e.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining("; "));
        return Result.failed(ResultCode.VALIDATE_FAILED, msg);
    }

    /** 绑定异常（表单参数类型不匹配） */
    @ExceptionHandler(BindException.class)
    public Result<Void> handleBind(BindException e) {
        return Result.failed(ResultCode.VALIDATE_FAILED, e.getMessage());
    }

    /** 请求方法不支持 */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public Result<Void> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        return Result.failed(405, "不支持的请求方法：" + e.getMethod());
    }

    /** 参数缺失 */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public Result<Void> handleMissingParam(MissingServletRequestParameterException e) {
        return Result.failed(ResultCode.VALIDATE_FAILED, "缺少必要参数：" + e.getParameterName());
    }

    /** HTTP 消息不可读（JSON 格式错误） */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public Result<Void> handleNotReadable(HttpMessageNotReadableException e) {
        log.warn("请求体解析失败：{}", e.getMessage());
        return Result.failed(ResultCode.VALIDATE_FAILED, "请求体格式错误");
    }

    /** 认证异常 */
    @ExceptionHandler(AuthenticationException.class)
    public Result<Void> handleAuth(AuthenticationException e) {
        return Result.failed(ResultCode.UNAUTHORIZED);
    }

    /** 权限异常 */
    @ExceptionHandler(AccessDeniedException.class)
    public Result<Void> handleAccessDenied(AccessDeniedException e) {
        return Result.failed(ResultCode.FORBIDDEN);
    }

    /** 数据库异常（不可预期，ERROR 级别，打完整栈） */
    @ExceptionHandler(DataAccessException.class)
    public Result<Void> handleDb(DataAccessException e) {
        log.error("数据库异常", e);
        return Result.failed(ResultCode.DB_ERROR);
    }

    /** ★ 兜底：所有未捕获的异常（包括 Error） */
    @ExceptionHandler(Throwable.class)
    public Result<Void> handleThrowable(Throwable e) {
        log.error("系统未知异常", e);            // ★ 必须打完整栈
        // 生产环境不要把内部异常信息暴露给前端（安全风险）
        return Result.failed(ResultCode.SYSTEM_ERROR);
    }
}
```

### 6.3 异常处理的反模式（Anti-Patterns）

```java
// ❌ 反模式 1：吞掉异常（最恶劣）
try {
    risky();
} catch (Exception e) {
    // 什么都不做，问题被永久隐藏
}

// ❌ 反模式 2：只打印 e.getMessage()（丢失栈信息）
try {
    risky();
} catch (Exception e) {
    log.error("失败：" + e.getMessage());        // 栈信息全丢，无法定位！
}
// ✅ 正确：把异常对象作为最后一个参数传给 log
log.error("失败", e);                            // SLF4J 会打印完整栈
log.error("失败, param={}", param, e);           // 带上下文 + 栈

// ❌ 反模式 3：e.printStackTrace()
catch (Exception e) {
    e.printStackTrace();                          // 输出到 stderr，不受日志框架管理，无法归档/告警
}

// ❌ 反模式 4：包装时丢失根因
catch (SQLException e) {
    throw new BusinessException("保存失败");       // ← cause 丢了！
}
// ✅
throw new BusinessException("保存失败", e);

// ❌ 反模式 5：捕获过宽（catch Throwable / Exception 掩盖 bug）
try {
    int x = 1 / 0;
} catch (Throwable t) {                           // 连 OOM、StackOverflow 都吞了
    log.error("出错", t);
}
// ✅ 只在最外层的全局处理器捕获 Throwable

// ❌ 反模式 6：catch 后 return null 掩盖问题
public User find(Long id) {
    try {
        return mapper.selectById(id);
    } catch (Exception e) {
        return null;                              // 调用方无法区分"不存在"和"出错了"
    }
}

// ❌ 反模式 7：在循环中 try-catch（性能差，且一条失败就影响后续判断）
for (String s : list) {
    try {
        process(s);
    } catch (Exception e) { log.error("失败", e); }
}
// ✅ 如果希望一条失败不影响其他，这样写是对的（但要注意日志量）
// ✅ 如果希望整体失败，把 try-catch 移到循环外

// ❌ 反模式 8：用异常做流程控制
try {
    return Integer.parseInt(input);
} catch (NumberFormatException e) {
    return defaultValue;                          // 高频调用时性能极差
}
// ✅ 预检查
if (isNumeric(input)) return Integer.parseInt(input);
return defaultValue;
// ✅ JDK 8+ 用 Optional 封装
public static Optional<Integer> tryParse(String s) {
    try { return Optional.of(Integer.parseInt(s)); }
    catch (NumberFormatException e) { return Optional.empty(); }
}

// ❌ 反模式 9：事务中 catch 异常导致不回滚
@Transactional
public void transfer(...) {
    try {
        accountMapper.deduct(from, amount);
        accountMapper.add(to, amount);            // 这里抛异常
    } catch (Exception e) {
        log.error("转账失败", e);                   // ← 异常被吃掉，事务不会回滚！
    }
}
// ✅ 方案 1：不 catch，让异常抛出触发回滚
// ✅ 方案 2：catch 后手动标记回滚
catch (Exception e) {
    TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
    throw new BusinessException("转账失败", e);
}
// 详见 [[后端/Spring/事务管理与失效场景]]

// ❌ 反模式 10：抛 Exception / Throwable（丢失类型信息）
public void f() throws Exception {                // 调用方只能 catch Exception，无法精确处理
    ...
}
// ✅ 抛具体的业务异常
public void f() {
    if (...) throw new BusinessException(...);
}
```

### 6.4 日志与异常的配合

```java
// SLF4J 的正确用法（占位符 {} 而非字符串拼接）
log.error("处理订单失败, orderNo={}, userId={}", orderNo, userId, e);
//                                                    ↑ 最后一个参数是 Throwable 时，
//                                                      SLF4J 自动识别为异常并打印完整栈

// ❌ 常见错误：把异常放进占位符
log.error("失败：{}", e);                  // 只打印 e.toString()，丢失栈！
log.error("失败：" + e);                   // 同上 + 字符串拼接性能差

// ✅ 各种级别的使用规范
log.trace(...)   // 最详细的追踪（生产关闭）
log.debug(...)   // 调试信息（生产关闭或按需开启）
log.info(...)    // 关键业务流程节点（订单创建、支付成功）
log.warn(...)    // 可预期的异常/降级（业务异常、重试成功、参数不合法）
log.error(...)   // 不可预期的错误（系统异常、第三方故障、数据不一致）★ 需告警

// 分级实践
try {
    ...
} catch (BusinessException e) {
    log.warn("业务异常: {}", e.getMsg());          // 业务异常用 warn，不打栈（量大）
} catch (Exception e) {
    log.error("系统异常, param={}", param, e);      // 系统异常用 error，打完整栈
    throw e;
}
```

## 7. 异常性能分析

```java
// 抛异常的开销主要来自 fillInStackTrace()（native 方法，遍历整个调用栈）
// 基准测试（创建 100 万次异常）：
//   new RuntimeException()                       ≈ 800 ms
//   new RuntimeException() { 禁用栈填充 }          ≈  50 ms     ← 快 16 倍
//   普通方法调用 + return                          ≈   2 ms

// 禁用栈填充的写法
public class FastException extends RuntimeException {
    public FastException(String message) {
        super(message, null, false, false);
        //                   ↑ writableStackTrace = false
    }
}

// 适用场景：高频抛出的「预期内」异常，如缓存未命中、连接池耗尽重试
// 不适用：需要定位问题的业务异常（丢了栈就没法排查）
```

**性能建议：**

1. **不要用异常做流程控制**（比正常返回慢 100+ 倍）。
2. **不要在循环内频繁抛异常**（如逐条校验，应收集所有错误一次性返回）。
3. **热点路径可考虑禁用栈填充**（但会牺牲可诊断性）。
4. **catch 块中避免大量字符串拼接**（用日志占位符）。
5. **`throw` 前的对象创建**（如 `new BusinessException(msg + obj)`）在条件不满足时也会执行字符串拼接，高频场景可延迟：`throw new BusinessException(() -> buildMsg())`（需自定义支持 Supplier 的异常）。

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 吞掉异常 | 问题无声消失，无法排查 | 至少 log.error 并保留栈 |
| 2 | `log.error("x" + e)` | 栈信息丢失 | `log.error("x", e)` |
| 3 | `e.printStackTrace()` | 输出到 stderr 不受管控 | 用日志框架 |
| 4 | 包装异常不传 cause | 根因丢失 | `new BizException(msg, e)` |
| 5 | catch InterruptedException 不处理 | 线程池无法优雅关闭 | `Thread.currentThread().interrupt()` |
| 6 | 事务方法中 catch 异常 | 事务不回滚，数据不一致 | 不 catch 或 `setRollbackOnly()` |
| 7 | finally 中 return | 覆盖返回值 + 吞异常 | 禁止 |
| 8 | `@Transactional` 遇受检异常 | 不回滚（默认只回滚 RuntimeException） | `rollbackFor = Exception.class` |
| 9 | 异常做流程控制 | 性能差 100 倍 | 预检查 |
| 10 | catch Throwable 掩盖 OOM | 系统带病运行 | 只在最外层兜底 |
| 11 | catch 顺序错（父类在前） | 编译错误 | 子类在前 |
| 12 | multi-catch 有继承关系 | 编译错误 | 分开 catch |
| 13 | Lock 用 try-with-resources | 编译错误（Lock 无 close） | try-finally + unlock |
| 14 | 重写方法抛更宽的受检异常 | 编译错误 | 只能更窄或不抛 |
| 15 | 抛 Exception/Throwable | 调用方无法精确处理 | 抛具体业务异常 |
| 16 | 返回 null 不加注释 | 调用方 NPE | 注释说明或返回 Optional/空集合 |
| 17 | `submit()` 的任务异常 | 静默丢失（被 Future 封装） | 用 `execute()` 或 `future.get()` |
| 18 | 静态初始化块抛异常 | `ExceptionInInitializerError`，后续访问抛 `NoClassDefFoundError` | 静态块中做好异常处理 |
| 19 | 循环内逐条 try-catch 记日志 | 日志爆炸 | 收集错误批量处理 |
| 20 | 异常信息暴露内部细节 | 安全风险（SQL、路径泄漏） | 对外返回通用消息，详细记日志 |

---

## 关联笔记

- 上一篇：[[后端/Java基础/集合框架-Map与源码剖析]]
- 下一篇：[[后端/Java基础/泛型枚举与注解]]
- 相关：[[后端/Java基础/IO流与文件操作]]（try-with-resources 主战场）、[[后端/Java基础/并发编程/线程基础与生命周期]]（中断机制）
- 应用：[[后端/SpringBoot/整合Web开发]]（全局异常处理器）、[[后端/Spring/事务管理与失效场景]]（异常与事务回滚）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
