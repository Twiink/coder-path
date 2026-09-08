---
title: "整合Web开发"
aliases:
  - "SpringBoot Web 开发"
  - "统一响应封装"
  - "Knife4j"
tags:
  - "后端"
  - "java"
  - "spring"
  - "springboot"
  - "web"
category: "后端"
folder: "SpringBoot"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Spring/SpringMVC参数绑定与异常处理]]"
  - "[[后端/Spring/SpringMVC入门与执行流程]]"
  - "[[后端/JavaWeb/JWT认证与Web安全]]"
  - "[[后端/SpringBoot/SpringBoot入门与项目搭建]]"
created: 2026-09-07
updated: 2026-09-07
---

# Spring Boot 整合 Web 开发

> Spring MVC 的原理（DispatcherServlet、九大组件、参数绑定、异常处理）见 [[后端/Spring/SpringMVC入门与执行流程]] 和 [[后端/Spring/SpringMVC参数绑定与异常处理]]。本篇聚焦 **Spring Boot 项目中的 Web 开发工程化实践**：统一响应、跨域、API 文档、拦截器体系、异步与流式响应。

## 1. 统一响应封装 ★★★★★（工程化第一要务）

### 1.1 为什么需要统一响应

```java
// ❌ 没有统一规范：每个接口返回结构不同，前端无所适从
@GetMapping("/a") public User a() { return user; }                        // 裸对象
@GetMapping("/b") public Map<String,Object> b() { return Map.of("code",0,"data",list); }   // Map
@GetMapping("/c") public ResponseEntity<User> c() { return ResponseEntity.ok(user); }      // ResponseEntity
@PostMapping("/d") public String d() { return "success"; }                                   // 字符串
// 出错时：有时返回 500 + HTML 错误页，有时返回 JSON，有时抛异常栈

// ✅ 统一规范：所有接口返回同一结构
{
  "code": 0,                        // ★ 业务状态码（0=成功，非0=业务错误）
  "message": "success",             // ★ 提示信息（可直接展示给用户）
  "data": { ... },                  // ★ 业务数据（失败时为 null）
  "timestamp": 1757215845000,       // 服务端时间戳
  "traceId": "a1b2c3d4e5f6",        // ★ 链路追踪 ID（排查问题的关键）
  "path": "/api/v1/users/1",        // 请求路径（可选，便于排查）
  "cost": 25                        // 耗时 ms（可选，开发环境）
}
```

### 1.2 Result 与 PageResult

```java
/**
 * ★ 统一响应包装（泛型，序列化友好）
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.ALWAYS)              // ★ data 为 null 时也输出（前端好处理）
public class Result<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    /** ★ 业务状态码：0=成功，其他=失败（见 ResultCode） */
    @Schema(description = "业务状态码，0表示成功", example = "0")
    private Integer code;

    /** ★ 提示信息（成功时为 success，失败时为可直接展示的错误描述） */
    @Schema(description = "提示信息", example = "success")
    private String message;

    /** ★ 业务数据 */
    @Schema(description = "业务数据")
    private T data;

    /** 服务端时间戳（ms） */
    @Schema(description = "服务端时间戳")
    private Long timestamp;

    /** ★ 链路追踪 ID（排查问题时提供给用户/客服） */
    @Schema(description = "链路追踪ID")
    private String traceId;

    // ═══════ 成功 ═══════
    public static <T> Result<T> success() {
        return build(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMessage(), null);
    }
    public static <T> Result<T> success(T data) {
        return build(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMessage(), data);
    }
    public static <T> Result<T> success(String message, T data) {
        return build(ResultCode.SUCCESS.getCode(), message, data);
    }

    // ═══════ 失败 ═══════
    public static <T> Result<T> failed(String message) {
        return build(ResultCode.SYSTEM_ERROR.getCode(), message, null);
    }
    public static <T> Result<T> failed(ResultCode rc) {
        return build(rc.getCode(), rc.getMessage(), null);
    }
    public static <T> Result<T> failed(ResultCode rc, String message) {
        return build(rc.getCode(), message, null);
    }
    public static <T> Result<T> failed(Integer code, String message) {
        return build(code, message, null);
    }

    // ═══════ 条件包装（简化 Service 层代码）═══════
    /** 影响行数 > 0 视为成功 */
    public static Result<Void> ofRows(int rows) {
        return rows > 0 ? success() : failed(ResultCode.OPERATION_FAILED);
    }
    /** 布尔结果包装 */
    public static Result<Void> of(boolean ok, String failMsg) {
        return ok ? success() : failed(failMsg);
    }
    /** Optional 包装 */
    public static <T> Result<T> of(Optional<T> opt, ResultCode notFoundCode) {
        return opt.map(Result::success).orElseGet(() -> failed(notFoundCode));
    }

    private static <T> Result<T> build(Integer code, String message, T data) {
        Result<T> r = new Result<>();
        r.code = code;
        r.message = message;
        r.data = data;
        r.timestamp = System.currentTimeMillis();
        r.traceId = TraceContext.getTraceId();          // ★ 从 MDC/ThreadLocal 取
        return r;
    }

    /** ★ 判断是否成功（前端/调用方使用） */
    @JsonIgnore
    public boolean isSuccess() {
        return code != null && ResultCode.SUCCESS.getCode().equals(code);
    }
}

/**
 * ★ 分页响应（★ 与 Result 分离，语义更清晰）
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "分页结果")
public class PageResult<T> implements Serializable {

    /** ★ 当前页数据 */
    @Schema(description = "数据列表")
    private List<T> records;

    /** ★ 总记录数 */
    @Schema(description = "总记录数", example = "100")
    private Long total;

    /** 当前页码（从 1 开始） */
    @Schema(description = "当前页码", example = "1")
    private Long pageNum;

    /** 每页条数 */
    @Schema(description = "每页条数", example = "20")
    private Long pageSize;

    /** ★ 总页数 */
    @Schema(description = "总页数", example = "5")
    private Long pages;

    /** 是否有下一页 */
    @Schema(description = "是否有下一页")
    private Boolean hasNext;

    /** 是否有上一页 */
    @Schema(description = "是否有上一页")
    private Boolean hasPrevious;

    public static <T> PageResult<T> of(List<T> records, long total, long pageNum, long pageSize) {
        long pages = pageSize == 0 ? 0 : (total + pageSize - 1) / pageSize;      // ★ 向上取整
        return PageResult.<T>builder()
                .records(records == null ? Collections.emptyList() : records)
                .total(total)
                .pageNum(pageNum)
                .pageSize(pageSize)
                .pages(pages)
                .hasNext(pageNum < pages)
                .hasPrevious(pageNum > 1)
                .build();
    }

    /** ★ 从 MyBatis-Plus 的 Page 转换 */
    public static <T, E> PageResult<T> of(IPage<E> page, Function<E, T> converter) {
        List<T> records = page.getRecords().stream().map(converter).toList();
        return of(records, page.getTotal(), page.getCurrent(), page.getSize());
    }

    /** 空分页 */
    public static <T> PageResult<T> empty(long pageNum, long pageSize) {
        return of(Collections.emptyList(), 0L, pageNum, pageSize);
    }
}

/**
 * ★ 分页查询的统一入参基类（继承它就有分页能力）
 */
@Data
@Schema(description = "分页查询基类")
public class PageQuery {

    /** 页码（从 1 开始） */
    @Min(value = 1, message = "页码最小为1")
    @Schema(description = "页码", example = "1", defaultValue = "1")
    private Integer pageNum = 1;

    /** 每页条数 */
    @Min(value = 1, message = "每页最少1条")
    @Max(value = 200, message = "每页最多200条")           // ★ 防止一次查太多拖垮数据库
    @Schema(description = "每页条数", example = "20", defaultValue = "20")
    private Integer pageSize = 20;

    /** 排序字段（★ 必须白名单校验） */
    @Schema(description = "排序字段", example = "createTime")
    private String orderBy;

    /** 排序方向 ASC / DESC */
    @Pattern(regexp = "^(?i)(asc|desc)$", message = "排序方向只能是 asc 或 desc")
    @Schema(description = "排序方向", example = "desc")
    private String orderDir = "DESC";

    /** ★ 转为 MyBatis-Plus 的 Page */
    public <T> Page<T> toPage() {
        return new Page<>(pageNum, Math.min(pageSize, 200));
    }

    /** ★ 安全的排序字段（由子类提供白名单） */
    public String safeOrderBy(Map<String, String> whitelist, String defaultColumn) {
        if (!StringUtils.hasText(orderBy)) return defaultColumn;
        return whitelist.getOrDefault(orderBy, defaultColumn);
    }
    public String safeOrderDir() {
        return "ASC".equalsIgnoreCase(orderDir) ? "ASC" : "DESC";
    }
}
```

### 1.3 全局异常处理（★ 完整生产版）

```java
/**
 * ★ 全局异常处理器
 * 原则：① 客户端错误返回 4xx + 友好提示  ② 服务端错误返回 500 + 通用提示（细节只记日志）
 *      ③ 所有响应带 traceId，便于用户报障时定位
 */
@Slf4j
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GlobalExceptionHandler {

    private final AlertService alertService;
    public GlobalExceptionHandler(AlertService alertService) { this.alertService = alertService; }

    // ═══════════ 业务异常（可预期，WARN，不打栈）═══════════
    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusiness(BusinessException e, HttpServletRequest request) {
        log.warn("业务异常 | uri={} code={} msg={} user={}",
                request.getRequestURI(), e.getCode(), e.getMessage(), currentUser());
        return Result.failed(e.getCode(), e.getMessage());
    }

    // ═══════════ ★ 参数校验异常（三种类型必须全覆盖）═══════════
    /** @RequestBody + @Valid */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Map<String, String>> handleMethodArgumentNotValid(MethodArgumentNotValidException e) {
        Map<String, String> fieldErrors = e.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        f -> StringUtils.hasText(f.getDefaultMessage()) ? f.getDefaultMessage() : "校验失败",
                        (a, b) -> a,                                     // 同字段取第一个
                        LinkedHashMap::new));                            // ★ 保持字段顺序
        String msg = fieldErrors.values().stream().findFirst().orElse("参数校验失败");
        log.warn("参数校验失败(JSON): {}", fieldErrors);
        // ★ 返回字段级错误 Map，前端可精确定位到表单项
        return Result.failed(ResultCode.VALIDATE_FAILED.getCode(), msg).setData(fieldErrors);
    }

    /** 表单 / @ModelAttribute */
    @ExceptionHandler(BindException.class)
    public Result<Map<String, String>> handleBind(BindException e) {
        Map<String, String> errors = e.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage,
                        (a, b) -> a, LinkedHashMap::new));
        log.warn("参数绑定失败: {}", errors);
        return Result.failed(ResultCode.VALIDATE_FAILED.getCode(),
                errors.values().stream().findFirst().orElse("参数校验失败")).setData(errors);
    }

    /** @Validated + @RequestParam/@PathVariable（单参数校验） */
    @ExceptionHandler(ConstraintViolationException.class)
    public Result<Void> handleConstraintViolation(ConstraintViolationException e) {
        String msg = e.getConstraintViolations().stream()
                .map(v -> {
                    String path = v.getPropertyPath().toString();
                    int idx = path.lastIndexOf('.');
                    return (idx >= 0 ? path.substring(idx + 1) : path) + ": " + v.getMessage();
                })
                .collect(Collectors.joining("; "));
        log.warn("参数校验失败(单参数): {}", msg);
        return Result.failed(ResultCode.VALIDATE_FAILED, msg);
    }

    /** 校验框架本身的异常 */
    @ExceptionHandler({ValidationException.class, IllegalArgumentException.class})
    public Result<Void> handleValidation(RuntimeException e) {
        log.warn("参数非法: {}", e.getMessage());
        return Result.failed(ResultCode.VALIDATE_FAILED, e.getMessage());
    }

    // ═══════════ 请求格式/参数异常（客户端错误，400）═══════════
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public Result<Void> handleMissingParam(MissingServletRequestParameterException e) {
        return Result.failed(ResultCode.VALIDATE_FAILED,
                String.format("缺少必要参数：%s（类型 %s）", e.getParameterName(), e.getParameterType()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public Result<Void> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        log.warn("参数类型不匹配: {}={} 期望类型={}", e.getName(), e.getValue(),
                e.getRequiredType() != null ? e.getRequiredType().getSimpleName() : "?");
        return Result.failed(ResultCode.VALIDATE_FAILED,
                "参数 [" + e.getName() + "] 格式错误");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public Result<Void> handleNotReadable(HttpMessageNotReadableException e) {
        log.warn("请求体解析失败: {}", e.getMessage());
        String detail = "请求体格式错误，请检查 JSON 语法";
        if (e.getCause() instanceof InvalidFormatException ife) {
            String field = ife.getPath().stream()
                    .map(JsonMappingException.Reference::getFieldName)
                    .filter(Objects::nonNull).collect(Collectors.joining("."));
            detail = String.format("字段 [%s] 的值 [%s] 不合法", field, ife.getValue());
        } else if (e.getCause() instanceof JsonParseException) {
            detail = "JSON 语法错误";
        }
        return Result.failed(ResultCode.VALIDATE_FAILED, detail);
    }

    @ExceptionHandler(HttpMessageNotWritableException.class)
    public Result<Void> handleNotWritable(HttpMessageNotWritableException e) {
        log.error("响应序列化失败", e);                  // ★ 这是服务端 Bug
        return Result.failed(ResultCode.SYSTEM_ERROR);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public Result<Void> handleMissingHeader(MissingRequestHeaderException e) {
        return Result.failed(ResultCode.VALIDATE_FAILED, "缺少请求头：" + e.getHeaderName());
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public Result<Void> handleMissingPart(MissingServletRequestPartException e) {
        return Result.failed(ResultCode.VALIDATE_FAILED, "缺少上传文件：" + e.getRequestPartName());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public Result<Void> handleMaxUpload(MaxUploadSizeExceededException e) {
        log.warn("上传文件过大: {}", e.getMessage());
        return Result.failed(ResultCode.PAYLOAD_TOO_LARGE, "上传文件超过大小限制");
    }

    // ═══════════ HTTP 语义异常（405/415/406/404）═══════════
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    @ResponseStatus(HttpStatus.METHOD_NOT_ALLOWED)
    public Result<Void> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        return Result.failed(ResultCode.METHOD_NOT_ALLOWED,
                "不支持 " + e.getMethod() + " 方法，允许：" + Arrays.toString(e.getSupportedMethods()));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    @ResponseStatus(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
    public Result<Void> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException e) {
        return Result.failed(415, "不支持的 Content-Type：" + e.getContentType());
    }

    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    @ResponseStatus(HttpStatus.NOT_ACCEPTABLE)
    public Result<Void> handleNotAcceptable(HttpMediaTypeNotAcceptableException e) {
        return Result.failed(406, "无法生成客户端可接受的响应格式");
    }

    /** ★ 404（需配置 spring.mvc.throw-exception-if-no-handler-found=true） */
    @ExceptionHandler(NoHandlerFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Result<Void> handleNoHandler(NoHandlerFoundException e) {
        log.warn("接口不存在: {} {}", e.getHttpMethod(), e.getRequestURL());
        return Result.failed(ResultCode.NOT_FOUND,
                "接口不存在：" + e.getHttpMethod() + " " + e.getRequestURL());
    }

    @ExceptionHandler(NoResourceFoundException.class)                 // Boot 3.2+ 的静态资源 404
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Result<Void> handleNoResource(NoResourceFoundException e) {
        return Result.failed(ResultCode.NOT_FOUND, "资源不存在：" + e.getResourcePath());
    }

    // ═══════════ 认证与授权（401/403）═══════════
    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public Result<Void> handleAuthentication(AuthenticationException e) {
        log.warn("认证失败: {}", e.getMessage());
        return Result.failed(ResultCode.UNAUTHORIZED, "认证失败，请重新登录");
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public Result<Void> handleAccessDenied(AccessDeniedException e, HttpServletRequest request) {
        log.warn("权限不足 | uri={} user={}", request.getRequestURI(), currentUser());
        return Result.failed(ResultCode.FORBIDDEN, "权限不足，无法访问该资源");
    }

    // ═══════════ 数据库异常（★ 转换为用户友好提示）═══════════
    @ExceptionHandler(DuplicateKeyException.class)
    public Result<Void> handleDuplicateKey(DuplicateKeyException e) {
        log.warn("唯一键冲突: {}", extractDuplicateInfo(e));
        return Result.failed(ResultCode.DATA_CONFLICT, "数据已存在，请勿重复提交");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public Result<Void> handleDataIntegrity(DataIntegrityViolationException e) {
        log.error("数据完整性约束冲突", e);
        return Result.failed(ResultCode.DATA_CONFLICT, "数据不符合约束（字段过长/非空/外键关联）");
    }

    @ExceptionHandler(CannotAcquireLockException.class)
    public Result<Void> handleLockTimeout(CannotAcquireLockException e) {
        log.warn("数据库锁等待超时", e);
        return Result.failed(ResultCode.SYSTEM_BUSY, "操作冲突，请稍后重试");
    }

    @ExceptionHandler(DeadlockLoserDataAccessException.class)
    public Result<Void> handleDeadlock(DeadlockLoserDataAccessException e) {
        log.warn("数据库死锁", e);
        return Result.failed(ResultCode.SYSTEM_BUSY, "系统繁忙，请重试");
    }

    @ExceptionHandler(CannotGetJdbcConnectionException.class)
    public Result<Void> handleNoConnection(CannotGetJdbcConnectionException e) {
        log.error("★★ 无法获取数据库连接（连接池可能已耗尽）", e);
        alertService.sendCritical("数据库连接池耗尽");
        return Result.failed(ResultCode.DB_ERROR, "系统繁忙，请稍后重试");
    }

    @ExceptionHandler(QueryTimeoutException.class)
    public Result<Void> handleQueryTimeout(QueryTimeoutException e) {
        log.warn("SQL 查询超时", e);
        return Result.failed(ResultCode.SYSTEM_BUSY, "查询超时，请缩小查询范围");
    }

    @ExceptionHandler(DataAccessException.class)
    public Result<Void> handleDataAccess(DataAccessException e) {
        log.error("数据库操作异常", e);
        alertService.send("数据库异常：" + e.getClass().getSimpleName());
        return Result.failed(ResultCode.DB_ERROR, "数据操作失败");
    }

    /** 乐观锁失败（MP 的乐观锁不抛异常，这里处理手动抛的场景） */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public Result<Void> handleOptimisticLock(OptimisticLockingFailureException e) {
        log.warn("乐观锁冲突", e);
        return Result.failed(ResultCode.DATA_CONFLICT, "数据已被他人修改，请刷新后重试");
    }

    // ═══════════ 远程调用异常 ═══════════
    @ExceptionHandler(ResourceAccessException.class)
    public Result<Void> handleResourceAccess(ResourceAccessException e) {
        log.error("远程服务访问失败（超时/连接拒绝）", e);
        alertService.send("远程服务访问失败");
        return Result.failed(ResultCode.THIRD_PARTY_TIMEOUT, "依赖服务超时，请稍后重试");
    }

    @ExceptionHandler(RestClientResponseException.class)
    public Result<Void> handleRestClient(RestClientResponseException e) {
        log.error("远程服务返回错误: status={}", e.getStatusCode(), e);
        return Result.failed(ResultCode.THIRD_PARTY_ERROR, "依赖服务异常");
        // ★ 绝不返回 e.getResponseBodyAsString()（可能泄漏内部信息）
    }

    // ═══════════ 并发与限流 ═══════════
    @ExceptionHandler(RejectedExecutionException.class)
    public Result<Void> handleRejected(RejectedExecutionException e) {
        log.error("★ 线程池拒绝任务（池已满）", e);
        alertService.sendCritical("线程池任务拒绝");
        return Result.failed(ResultCode.SYSTEM_BUSY, "系统繁忙，请稍后重试");
    }

    @ExceptionHandler(TimeoutException.class)
    public Result<Void> handleTimeout(TimeoutException e) {
        log.warn("操作超时", e);
        return Result.failed(ResultCode.SYSTEM_BUSY, "操作超时，请稍后重试");
    }

    // ═══════════ 常见运行时异常（★ 这些是 Bug，ERROR 级别）═══════════
    @ExceptionHandler(NullPointerException.class)
    public Result<Void> handleNPE(NullPointerException e, HttpServletRequest request) {
        log.error("★★ 空指针异常 | uri={} user={}", request.getRequestURI(), currentUser(), e);
        alertService.sendCritical("NPE: " + request.getRequestURI());
        return Result.failed(ResultCode.SYSTEM_ERROR, "系统内部错误");
    }

    @ExceptionHandler(ClassCastException.class)
    public Result<Void> handleClassCast(ClassCastException e) {
        log.error("类型转换异常", e);
        return Result.failed(ResultCode.SYSTEM_ERROR, "系统内部错误");
    }

    @ExceptionHandler(IndexOutOfBoundsException.class)
    public Result<Void> handleIndexOutOfBounds(IndexOutOfBoundsException e) {
        log.error("数组/集合越界", e);
        return Result.failed(ResultCode.SYSTEM_ERROR, "系统内部错误");
    }

    @ExceptionHandler(ArithmeticException.class)
    public Result<Void> handleArithmetic(ArithmeticException e) {
        log.error("算术异常（可能除零）", e);
        return Result.failed(ResultCode.SYSTEM_ERROR, "计算错误");
    }

    @ExceptionHandler(IllegalStateException.class)
    public Result<Void> handleIllegalState(IllegalStateException e) {
        log.warn("非法状态: {}", e.getMessage());
        return Result.failed(ResultCode.STATE_ILLEGAL, e.getMessage());
    }

    @ExceptionHandler(UnsupportedOperationException.class)
    public Result<Void> handleUnsupported(UnsupportedOperationException e) {
        log.error("不支持的操作", e);
        return Result.failed(ResultCode.SYSTEM_ERROR, "操作不支持");
    }

    // ═══════════ ★ 兜底（所有未捕获的异常）═══════════
    @ExceptionHandler(Throwable.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<Void> handleThrowable(Throwable e, HttpServletRequest request) {
        String traceId = TraceContext.getTraceId();
        // ★★ 必须记录完整信息 + 完整栈
        log.error("★★★ 未预期异常 | uri={} method={} params={} user={} traceId={}",
                request.getRequestURI(), request.getMethod(),
                abbreviate(safeGetParams(request), 500), currentUser(), traceId, e);
        // ★ 触发告警（区分已知与未知）
        alertService.sendCritical(String.format("系统异常 %s: %s (traceId=%s)",
                request.getRequestURI(), e.getClass().getSimpleName(), traceId));
        // ★★ 对外只返回通用提示 + traceId（绝不泄漏栈信息/SQL/内部路径）
        return Result.failed(ResultCode.SYSTEM_ERROR,
                "系统繁忙，请稍后重试（错误码：" + traceId + "）");
    }

    // ═══════════ 辅助方法 ═══════════
    private String currentUser() {
        LoginUser u = UserContext.get();
        return u == null ? "anonymous" : u.getUsername() + "(" + u.getUserId() + ")";
    }

    private String safeGetParams(HttpServletRequest request) {
        try {
            return request.getParameterMap().entrySet().stream()
                    .map(e -> e.getKey() + "=" + Arrays.toString(e.getValue()))
                    .collect(Collectors.joining("&"));
        } catch (Exception ex) { return "<无法获取>"; }
    }

    private String extractDuplicateInfo(DuplicateKeyException e) {
        String msg = e.getMessage();
        // 从 "Duplicate entry 'tom' for key 'uk_user_name'" 中提取
        Matcher m = Pattern.compile("Duplicate entry '(.+?)' for key '(.+?)'").matcher(msg == null ? "" : msg);
        return m.find() ? String.format("值=%s, 索引=%s", m.group(1), m.group(2)) : msg;
    }

    private String abbreviate(String s, int max) {
        return (s == null || s.length() <= max) ? s : s.substring(0, max) + "...";
    }
}
```

```java
/**
 * ★ 自定义业务异常（非受检，便于传播）
 */
@Getter
public class BusinessException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** 业务错误码 */
    private final Integer code;

    public BusinessException(String message) {
        this(ResultCode.OPERATION_FAILED.getCode(), message);
    }
    public BusinessException(ResultCode resultCode) {
        this(resultCode.getCode(), resultCode.getMessage());
    }
    public BusinessException(ResultCode resultCode, String message) {
        this(resultCode.getCode(), message);
    }
    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code;
    }
    public BusinessException(String message, Throwable cause) {
        super(message, cause);
        this.code = ResultCode.SYSTEM_ERROR.getCode();
    }

    /** ★ 静态工厂（可读性更好） */
    public static BusinessException of(ResultCode rc) { return new BusinessException(rc); }
    public static BusinessException notFound(String resource, Object id) {
        return new BusinessException(ResultCode.NOT_FOUND, resource + "不存在: " + id);
    }
    public static BusinessException conflict(String msg) {
        return new BusinessException(ResultCode.DATA_CONFLICT, msg);
    }

    /** ★ 不填充栈（性能优化：业务异常是「可预期的流程控制」，栈信息无价值） */
    @Override
    public synchronized Throwable fillInStackTrace() {
        return this;                    // ★ 跳过栈填充，抛出性能提升 10 倍
    }
}
```

### 1.4 统一响应的自动化（ResponseBodyAdvice）

```java
/**
 * ★ 自动包装：Controller 直接返回业务对象，由 Advice 自动包成 Result
 * 好处：Controller 代码更简洁（return user 而非 return Result.success(user)）
 */
@RestControllerAdvice(basePackages = "com.example.mall.controller")     // ★ 限定包
@Slf4j
public class ResponseWrapAdvice implements ResponseBodyAdvice<Object> {

    /** 已经是 Result/PageResult/ResponseEntity 的不再包装 */
    private static final Set<Class<?>> SKIP_TYPES = Set.of(
            Result.class, PageResult.class, String.class, byte[].class,
            Resource.class, ResponseEntity.class);

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        // ① 标注了 @IgnoreWrap 的不包装
        if (returnType.hasMethodAnnotation(IgnoreWrap.class)) return false;
        // ② Actuator / Swagger / 错误页不包装
        Class<?> declaring = returnType.getContainingClass();
        if (declaring.getName().startsWith("org.springframework.boot.actuate")
                || declaring.getName().startsWith("org.springdoc")
                || declaring.getName().contains("Knife4j")) return false;
        // ③ 返回类型已经是 Result 的不重复包装
        Class<?> rt = returnType.getParameterType();
        return !SKIP_TYPES.contains(rt) && !Result.class.isAssignableFrom(rt);
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> converterType,
                                  ServerHttpRequest request, ServerHttpResponse response) {
        // ★ 已经是 Result 直接返回
        if (body instanceof Result<?>) return body;
        // ★ 字符串类型特殊处理（StringHttpMessageConverter 不能处理 Result 对象）
        if (body instanceof String) {
            response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
            return JSON.toJSONString(Result.success(body));        // ★ 手动序列化为 JSON 字符串
        }
        return Result.success(body);
    }
}

/** 标记不需要包装的方法（如文件下载、SSE、第三方回调） */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface IgnoreWrap { }

// 使用
@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    @GetMapping("/{id}")
    public UserVO get(@PathVariable Long id) {              // ★ 直接返回 VO，自动包成 Result
        return userService.get(id);
    }

    @GetMapping("/{id}/export")
    @IgnoreWrap                                              // ★ 文件下载不包装
    public void export(@PathVariable Long id, HttpServletResponse response) { ... }
}
```

> 【取舍】**手动 `return Result.success(x)` vs 自动包装 Advice**：
> - **手动**：显式、无魔法、IDE 能推断返回类型（Swagger 文档准确）。★ 团队规范推荐。
> - **自动**：Controller 更简洁，但 Swagger 文档的返回类型会不准确（需额外处理），且 String 返回值有坑。
> - 实践：**多数团队选手动**（可预测性 > 简洁性）。用自动包装时务必处理好 String、byte[]、文件下载等特例。

## 2. 跨域（CORS）★★★★★

### 2.1 三种配置方式

```java
// ─── 方式 1：WebMvcConfigurer（★ 全局配置，最常用）───
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")                              // ★ 匹配路径
                .allowedOriginPatterns("https://*.example.com",      // ★ 用 Patterns（不能用 * + credentials）
                                       "http://localhost:[*]")       // 支持端口通配
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")                                  // 允许的请求头
                .exposedHeaders("Content-Disposition", "X-Trace-Id",  // ★ 前端能读到的响应头
                                "X-Total-Count", "Authorization")
                .allowCredentials(true)                               // ★ 允许携带 Cookie
                .maxAge(3600);                                        // ★ 预检结果缓存 1 小时（减少 OPTIONS 请求）
    }
}

// ─── 方式 2：CorsFilter（★ 优先级最高，在 Spring MVC 之前生效）───
@Configuration
public class CorsFilterConfig {

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)                     // ★ 必须最先执行
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("https://*.example.com", "http://localhost:[*]"));
        config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","PATCH","OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Content-Disposition", "X-Trace-Id"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        // ★ 单独配置某个路径
        CorsConfiguration uploadConfig = new CorsConfiguration();
        uploadConfig.setAllowedOriginPatterns(List.of("*"));
        uploadConfig.setAllowedMethods(List.of("POST"));
        source.registerCorsConfiguration("/api/upload/**", uploadConfig);

        return new CorsFilter(source);
    }
}

// ─── 方式 3：注解（★ 单个 Controller / 方法）───
@CrossOrigin(origins = "https://admin.example.com", maxAge = 3600)     // 类级别
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    @CrossOrigin(origins = "https://report.example.com")                // ★ 方法级别（覆盖类级别）
    @GetMapping("/report")
    public Result<Report> report() { }
}
```

### 2.2 CORS 的原理与坑

```
─── 简单请求（GET/POST/HEAD + 简单头 + 简单 Content-Type）───
浏览器直接发送，并在请求中带上 Origin 头
服务端响应带 Access-Control-Allow-Origin
浏览器检查 Origin 是否在允许列表 → 不在则【拦截响应】（请求其实已经发出并执行了！）

─── 预检请求（PUT/DELETE/PATCH、自定义头、application/json 等）───
① 浏览器先发 OPTIONS 预检：
   OPTIONS /api/users HTTP/1.1
   Origin: https://app.example.com
   Access-Control-Request-Method: PUT
   Access-Control-Request-Headers: content-type, authorization

② 服务端响应：
   HTTP/1.1 204 No Content
   Access-Control-Allow-Origin: https://app.example.com
   Access-Control-Allow-Methods: GET,POST,PUT,DELETE
   Access-Control-Allow-Headers: content-type, authorization
   Access-Control-Allow-Credentials: true
   Access-Control-Max-Age: 3600                    ← ★ 缓存预检结果 1 小时

③ 浏览器缓存预检结果，发送真实请求
```

| 坑 | 现象 | 解决 |
| --- | --- | --- |
| ★ `allowedOrigins("*")` + `allowCredentials(true)` | 启动报错 `When allowCredentials is true, allowedOrigins cannot contain "*"` | 用 `allowedOriginPatterns("*")` |
| 拦截器未放行 OPTIONS | 预检请求 401，前端报 CORS 错误 | `CorsUtils.isPreFlightRequest(request)` 直接返回 true |
| Filter 顺序在 CORS 之后 | 认证 Filter 拦截了 OPTIONS | CORS Filter 设 `@Order(HIGHEST_PRECEDENCE)` |
| `exposedHeaders` 未配 | 前端读不到 `Content-Disposition`（下载文件名） | 显式配置 exposedHeaders |
| `maxAge` 未配 | 每次请求都发 OPTIONS（性能差） | 配 3600 |
| Nginx 也配了 CORS | 响应头重复，浏览器报错 | ★ **只在一处配**（建议 Nginx 或应用，不要都配） |
| Cookie 跨域不生效 | 前端拿不到 Set-Cookie | `allowCredentials=true` + 前端 `withCredentials: true` + Cookie 设 `SameSite=None; Secure` |
| 生产用 `allowedOriginPatterns("*")` | ★ 安全风险（任意站点可调用） | ★ 明确列出可信域名 |

```java
// ─── 拦截器中放行预检请求（★ 必须做）───
@Component
public class AuthInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // ★ CORS 预检请求直接放行（没有业务语义，不带 Token）
        if (CorsUtils.isPreFlightRequest(request)) {
            response.setStatus(HttpStatus.OK.value());
            return true;
        }
        // ... 正常认证逻辑
    }
}
```

```nginx
# ─── Nginx 层配置 CORS（★ 与应用层二选一）───
location /api/ {
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' $http_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET,POST,PUT,DELETE,PATCH,OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization,Content-Type,X-Requested-With,X-Trace-Id' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Max-Age' 3600;
        add_header 'Content-Length' 0;
        return 204;
    }
    add_header 'Access-Control-Allow-Origin' $http_origin always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Expose-Headers' 'Content-Disposition,X-Trace-Id' always;
    proxy_pass http://backend;
}
# ⚠️ $http_origin 直接回显 = 允许任意来源，★ 生产必须用 map 白名单校验：
# map $http_origin $cors_origin {
#     default "";
#     "https://app.example.com" $http_origin;
#     "https://admin.example.com" $http_origin;
# }
```

## 3. API 文档（Knife4j / SpringDoc）★★★★★

```xml
<!-- ★ Boot 3 用 SpringDoc（OpenAPI 3）+ Knife4j 增强 UI -->
<dependency>
    <groupId>com.github.xiaoymin</groupId>
    <artifactId>knife4j-openapi3-jakarta-spring-boot-starter</artifactId>
    <version>4.5.0</version>
</dependency>
<!-- 或只用官方 SpringDoc -->
<!--
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.6.0</version>
</dependency>
-->
<!-- ⚠️ Boot 2（javax）用：knife4j-openapi2-spring-boot-starter 或 springdoc-openapi-ui -->
<!-- ⚠️ springfox（老 Swagger 2.x）已停止维护，与 Boot 2.6+ 的 PathPatternParser 冲突，不要再用 -->
```

```java
@Configuration
public class OpenApiConfig {

    /** ★ OpenAPI 基本信息 */
    @Bean
    public OpenAPI mallOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("商城服务 API")
                        .description("""
                            ## 商城后端服务接口文档
                            - 统一响应格式：`{code, message, data, timestamp, traceId}`
                            - 认证方式：请求头 `Authorization: Bearer {token}`
                            - 环境：dev / test / prod
                            """)
                        .version("v1.0.0")
                        .contact(new Contact().name("后端团队").email("dev@example.com"))
                        .license(new License().name("Apache 2.0"))
                        .termsOfService("https://example.com/terms")
                        // ★ 认证配置
                        .components(new Components()
                                .addSecuritySchemes("bearer-jwt", new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .in(SecurityScheme.In.HEADER)
                                        .name("Authorization")
                                        .description("JWT Token，格式：Bearer {token}")))
                        .addSecurityItem(new SecurityRequirement().addList("bearer-jwt"))
                        // ★ 多环境服务器
                        .servers(List.of(
                                new Server().url("http://localhost:8080").description("本地开发"),
                                new Server().url("https://dev-api.example.com").description("开发环境"),
                                new Server().url("https://api.example.com").description("生产环境")))
                        // 外部文档
                        .externalDocs(new ExternalDocumentation()
                                .description("架构设计文档")
                                .url("https://wiki.example.com/mall"));
    }

    /** ★ 分组配置（按模块划分，文档更清晰） */
    @Bean
    public GroupedOpenApi userApi() {
        return GroupedOpenApi.builder()
                .group("01-用户模块")
                .packagesToScan("com.example.mall.controller.user")
                .pathsToMatch("/api/v1/users/**")
                .build();
    }
    @Bean
    public GroupedOpenApi orderApi() {
        return GroupedOpenApi.builder()
                .group("02-订单模块")
                .packagesToScan("com.example.mall.controller.order")
                .build();
    }
    @Bean
    public GroupedOpenApi adminApi() {
        return GroupedOpenApi.builder()
                .group("03-管理后台")
                .pathsToMatch("/api/v1/admin/**")
                .addOpenApiMethodFilter(m -> m.isAnnotationPresent(RequiresPermission.class))
                .build();
    }
}
```

```yaml
# application.yml
springdoc:
  api-docs:
    enabled: true                              # ★ 生产环境设 false！
    path: /v3/api-docs
  swagger-ui:
    enabled: true
    path: /swagger-ui.html
    tags-sorter: alpha                          # 标签排序
    operations-sorter: alpha                    # 接口排序
    display-request-duration: true              # ★ 显示请求耗时
    try-it-out-enabled: true
  default-flat-param-object: true                # 扁平化对象参数
  show-actuator: false                           # 不显示 Actuator 端点
  packages-to-scan: com.example.mall.controller  # ★ 限定扫描范围（加快启动）
  paths-to-match: /api/**
  group-configs:
    - group: 01-用户模块
      paths-to-match: /api/v1/users/**
      packages-to-scan: com.example.mall.controller.user

# ★ Knife4j 增强配置
knife4j:
  enable: true                                  # ★ 开启增强模式
  setting:
    language: zh_cn                             # 中文界面
    swagger-model-name: 数据模型
    enable-footer: false                         # 关闭页脚
    enable-footer-custom: true
    footer-custom-content: "Mall Service © 2026"
    enable-open-api: false
    enable-group: true                           # ★ 开启分组
    enable-debug: true                            # 调试功能
    enable-dynamic-parameter: true                # ★ 动态参数（全局 Token）
    enable-home-custom: false
    enable-swagger-models: true
    enable-version: true
  # ★ 生产环境屏蔽（★ 必配！）
  production: false                              # true = 屏蔽所有文档资源
  basic:
    enable: true                                  # ★ 开启 Basic 认证保护文档页
    username: ${DOC_USER:admin}
    password: ${DOC_PASSWORD}
```

```java
// ─── 接口文档注解（★ OpenAPI 3）───
@Tag(name = "用户管理", description = "用户的增删改查、状态管理")     // ★ 类上的标签
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearer-jwt")
public class UserController {

    private final UserService userService;

    @Operation(
        summary = "查询用户详情",                                    // ★ 简短描述
        description = """
            根据用户 ID 查询详细信息。
            - 不返回密码等敏感字段
            - 已逻辑删除的用户返回 404
            """,
        operationId = "getUserById",
        tags = {"用户管理"},
        security = {@SecurityRequirement(name = "bearer-jwt")},
        responses = {
            @ApiResponse(responseCode = "200", description = "查询成功",
                content = @Content(schema = @Schema(implementation = UserVO.class))),
            @ApiResponse(responseCode = "404", description = "用户不存在"),
            @ApiResponse(responseCode = "401", description = "未认证")
        }
    )
    @GetMapping("/{id}")
    public Result<UserVO> getById(
            @Parameter(description = "用户ID", example = "1", required = true,
                       schema = @Schema(minimum = "1"))
            @PathVariable Long id) {
        return Result.success(userService.getById(id));
    }

    @Operation(summary = "分页查询用户", description = "支持按用户名、状态、部门筛选")
    @GetMapping
    public Result<PageResult<UserVO>> page(
            @Parameter(description = "查询条件") @Valid UserQuery query) {
        return Result.success(userService.page(query));
    }

    @Operation(summary = "创建用户",
               requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
                   required = true,
                   content = @Content(schema = @Schema(implementation = UserCreateDTO.class))))
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Result<Long> create(@RequestBody @Valid UserCreateDTO dto) {
        return Result.success("创建成功", userService.create(dto));
    }

    @Operation(summary = "删除用户", description = "★ 逻辑删除，数据不会真正移除")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Result<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return Result.success();
    }
}

// ─── DTO/VO 的文档注解 ───
@Schema(description = "创建用户请求")
@Data
public class UserCreateDTO {

    @Schema(description = "用户名", example = "zhangsan", requiredMode = Schema.RequiredMode.REQUIRED,
            minLength = 2, maxLength = 20, pattern = "^[a-zA-Z0-9_]+$")
    @NotBlank(message = "用户名不能为空")
    private String username;

    @Schema(description = "密码（8~32位，含大小写字母和数字）", example = "Abc12345",
            accessMode = Schema.AccessMode.WRITE_ONLY)              // ★ 只在请求中出现，响应不返回
    @NotBlank
    private String password;

    @Schema(description = "手机号", example = "13800138000")
    @Pattern(regexp = "^1[3-9]\\d{9}$")
    private String phone;

    @Schema(description = "状态：0-禁用 1-启用", example = "1",
            allowableValues = {"0", "1"}, defaultValue = "1")
    private Integer status;

    @Schema(description = "角色ID列表", example = "[1, 2]")
    private List<Long> roleIds;

    @Schema(description = "创建时间（只读，服务端生成）",
            accessMode = Schema.AccessMode.READ_ONLY)
    private LocalDateTime createTime;
}

// ─── 枚举的文档 ───
@Schema(description = "订单状态")
public enum OrderStatus {
    @Schema(description = "待支付")   PENDING(0),
    @Schema(description = "已支付")   PAID(1),
    @Schema(description = "已发货")   SHIPPED(2);
    private final int code;
    OrderStatus(int code) { this.code = code; }
}
```

```
# ─── 访问地址 ───
Knife4j UI:  http://localhost:8080/doc.html          ★ 推荐（中文、增强调试）
Swagger UI:  http://localhost:8080/swagger-ui.html
OpenAPI JSON: http://localhost:8080/v3/api-docs        ★ 可导入 Postman/Apifox/YApi

# ★ 生产环境必须屏蔽！三种方式：
# ① knife4j.production=true（屏蔽 doc.html）
# ② springdoc.api-docs.enabled=false + springdoc.swagger-ui.enabled=false
# ③ 拦截器 / Nginx 屏蔽 /doc.html、/swagger-ui/**、/v3/api-docs/**、/webjars/**
```

## 4. 异步请求与流式响应 ★★★★

```java
// ─── ① Callable：★ 释放容器线程，用 MVC 线程池执行 ───
@GetMapping("/callable")
public Callable<Result<String>> callable() {
    log.info("容器线程：{}", Thread.currentThread().getName());     // http-nio-8080-exec-1
    return () -> {
        log.info("异步线程：{}", Thread.currentThread().getName());   // mvc-async-1
        Thread.sleep(3000);                                          // 模拟耗时
        return Result.success("done");
    };
    // ★ 容器线程立即释放（可接收其他请求），3 秒后 MVC 线程池完成任务再写响应
    // 提升吞吐量，但不减少总耗时
}

// ─── ② WebAsyncTask：★ 可配超时和回调 ───
@GetMapping("/web-async")
public WebAsyncTask<Result<String>> webAsync() {
    WebAsyncTask<Result<String>> task = new WebAsyncTask<>(
            5_000L,                                  // ★ 超时时间（ms）
            "customExecutor",                         // ★ 指定线程池名称
            () -> {
                Thread.sleep(2000);
                return Result.success("done");
            });
    task.onTimeout(() -> {                            // ★ 超时回调
        log.warn("请求超时");
        return Result.failed(ResultCode.REQUEST_TIMEOUT, "处理超时，请稍后重试");
    });
    task.onError(() -> Result.failed(ResultCode.SYSTEM_ERROR));    // 异常回调
    task.onCompletion(() -> log.info("请求完成"));                  // 完成回调
    return task;
}

// ─── ③ DeferredResult：★ 完全由业务控制何时返回（适合 MQ 回调、第三方通知）───
@GetMapping("/deferred")
public DeferredResult<Result<String>> deferred() {
    DeferredResult<Result<String>> result = new DeferredResult<>(30_000L);   // 30 秒超时
    // ★ 存起来，等外部事件触发
    pendingResults.put(requestId, result);
    result.onTimeout(() -> result.setResult(Result.failed("处理超时")));
    result.onCompletion(() -> pendingResults.remove(requestId));
    return result;
}
// 其他地方（如 MQ 消费者）触发
public void onMqMessage(Message msg) {
    DeferredResult<Result<String>> dr = pendingResults.get(msg.getRequestId());
    if (dr != null) dr.setResult(Result.success(msg.getData()));     // ★ 此时才写响应
}

// ─── ④ CompletableFuture（★ 推荐，能与业务线程池结合）───
@GetMapping("/future")
public CompletableFuture<Result<UserDetailVO>> future(@RequestParam Long id) {
    return CompletableFuture
            .allOf(
                userService.asyncGet(id),                             // 并行查用户
                orderService.asyncListByUser(id),                     // 并行查订单
                pointService.asyncGetPoints(id))                      // 并行查积分
            .thenApply(v -> Result.success(assemble(
                    userService.getNow(), orderService.getNow(), pointService.getNow())));
    // ★ 三个查询并行，总耗时 = max(三者) 而非 sum(三者)
}

// ─── ⑤ ★ SSE（Server-Sent Events，服务端推送）───
@GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter stream(@RequestParam String taskId) {
    SseEmitter emitter = new SseEmitter(300_000L);                    // ★ 5 分钟超时
    sseExecutors.execute(() -> {
        try {
            emitter.send(SseEmitter.event().name("start").data("任务开始"));
            for (int i = 1; i <= 100; i++) {
                emitter.send(SseEmitter.event()
                        .name("progress")
                        .id(String.valueOf(i))
                        .data(Map.of("percent", i, "message", "处理中 " + i + "%"))
                        .reconnectTime(3000));                         // 断线重连间隔
                Thread.sleep(100);
            }
            emitter.send(SseEmitter.event().name("complete").data("任务完成"));
            emitter.complete();                                         // ★ 必须关闭
        } catch (Exception e) {
            emitter.completeWithError(e);                               // ★ 出错时关闭
        }
    });
    emitter.onTimeout(emitter::complete);                               // 超时回调
    emitter.onCompletion(() -> log.info("SSE 连接关闭: {}", taskId));
    emitter.onError(e -> log.error("SSE 错误: {}", taskId, e));
    return emitter;
}
// 前端使用（★ 原生 API，无需轮询）
// const es = new EventSource('/api/stream?taskId=123');
// es.addEventListener('progress', e => { const d = JSON.parse(e.data); updateBar(d.percent); });
// es.addEventListener('complete', () => es.close());
// es.onerror = () => { /* 自动重连 */ };

// ─── ⑥ StreamingResponseBody（★ 大文件下载，不占内存）───
@GetMapping("/download-large")
@IgnoreWrap
public ResponseEntity<StreamingResponseBody> downloadLarge() {
    StreamingResponseBody body = outputStream -> {
        try (InputStream is = fileService.getStream()) {
            is.transferTo(outputStream);                               // ★ 边读边写，内存占用恒定
            outputStream.flush();
        }
    };
    return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename*=UTF-8''" + URLEncoder.encode("大数据导出.xlsx", UTF_8))
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(body);
}

// ─── ⑦ 文件下载（普通大小）───
@GetMapping("/download/{id}")
@IgnoreWrap
public void download(@PathVariable Long id, HttpServletResponse response) throws IOException {
    FileInfo file = fileService.get(id);
    response.reset();
    response.setContentType(MediaType.APPLICATION_OCTET_STREAM_VALUE);
    response.setCharacterEncoding("UTF-8");
    // ★ 文件名编码（解决中文乱码）
    String encoded = URLEncoder.encode(file.getName(), StandardCharsets.UTF_8).replace("+", "%20");
    response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=\"" + encoded + "\"; filename*=UTF-8''" + encoded);
    response.setContentLengthLong(file.getSize());
    response.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache");
    // 支持断点续传（Range）
    response.setHeader(HttpHeaders.ACCEPT_RANGES, "bytes");
    try (InputStream is = fileService.getStream(id);
         OutputStream os = response.getOutputStream()) {
        is.transferTo(os);
        os.flush();
    }
}
```

```java
// ─── ★ 异步线程池配置（必须！默认的 SimpleAsyncTaskExecutor 每次新建线程）───
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    /** MVC 异步请求的线程池（Callable/WebAsyncTask 使用） */
    @Bean("mvcAsyncExecutor")
    public ThreadPoolTaskExecutor mvcAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(20);
        executor.setMaxPoolSize(100);
        executor.setQueueCapacity(500);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("mvc-async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);            // ★ 优雅停机
        executor.setAwaitTerminationSeconds(30);
        executor.setTaskDecorator(new MdcTaskDecorator());               // ★ 传递 MDC（traceId）
        executor.initialize();
        return executor;
    }

    /** ★ 注册给 Spring MVC 使用 */
    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setDefaultTimeout(30_000);
        configurer.setTaskExecutor(mvcAsyncExecutor());
    }

    /** @Async 的默认线程池 */
    @Override
    public Executor getAsyncExecutor() { return mvcAsyncExecutor(); }

    /** ★ 异步方法的异常处理（无返回值时异常会被吞掉！） */
    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) ->
            log.error("★ 异步方法执行异常 method={} params={}", method.getName(),
                    Arrays.toString(params), ex);
    }

    /** ★ MDC 传递装饰器（让异步线程也有 traceId） */
    static class MdcTaskDecorator implements TaskDecorator {
        @Override
        public Runnable decorate(Runnable runnable) {
            Map<String, String> context = MDC.getCopyOfContextMap();     // 主线程的 MDC
            return () -> {
                if (context != null) MDC.setContextMap(context);          // 恢复到异步线程
                try { runnable.run(); } finally { MDC.clear(); }          // ★ 必须清理
            };
        }
    }
}
```

## 5. Web 层完整配置（生产模板）

```java
/**
 * ★ Web MVC 配置（生产级完整模板）
 * 注意：★ 不要加 @EnableWebMvc（会丢失 Boot 的所有自动配置）
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final TraceInterceptor traceInterceptor;
    private final LogInterceptor logInterceptor;
    private final AuthInterceptor authInterceptor;
    private final RateLimitInterceptor rateLimitInterceptor;
    private final CurrentUserArgumentResolver currentUserResolver;
    private final ApiVersionArgumentResolver apiVersionResolver;

    // ═══ ① 拦截器（★ 顺序即执行顺序）═══
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(traceInterceptor)                       // 1. 链路追踪（最外层）
                .addPathPatterns("/**")
                .excludePathPatterns("/actuator/**", "/error")
                .order(1);

        registry.addInterceptor(logInterceptor)                          // 2. 请求日志
                .addPathPatterns("/**")
                .excludePathPatterns("/actuator/**", "/error", "/static/**",
                                     "/doc.html", "/webjars/**", "/v3/api-docs/**", "/favicon.ico")
                .order(2);

        registry.addInterceptor(authInterceptor)                         // 3. 认证鉴权
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/v1/auth/**", "/api/v1/public/**",
                                     "/doc.html", "/webjars/**", "/v3/api-docs/**",
                                     "/swagger-ui/**", "/swagger-resources/**")
                .order(3);

        registry.addInterceptor(rateLimitInterceptor)                     // 4. 限流（认证后）
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/v1/public/**")
                .order(4);
    }

    // ═══ ② CORS（详见第 2 节）═══
    @Override
    public void addCorsMappings(CorsRegistry registry) { /* ... */ }

    // ═══ ③ 静态资源 ═══
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/static/**")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic());
        registry.addResourceHandler("/upload/**")
                .addResourceLocations("file:" + uploadPath + "/");
        // ★ Knife4j / Swagger 的资源（Boot 3 + springdoc 需要）
        registry.addResourceHandler("/doc.html")
                .addResourceLocations("classpath:/META-INF/resources/");
        registry.addResourceHandler("/webjars/**")
                .addResourceLocations("classpath:/META-INF/resources/webjars/");
    }

    // ═══ ④ 消息转换器（★ JSON 配置）═══
    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        converters.stream()
                .filter(c -> c instanceof MappingJackson2HttpMessageConverter)
                .map(c -> (MappingJackson2HttpMessageConverter) c)
                .forEach(c -> {
                    ObjectMapper mapper = c.getObjectMapper();
                    // ★ Long → String（防前端精度丢失）
                    SimpleModule module = new SimpleModule();
                    module.addSerializer(Long.class, ToStringSerializer.instance);
                    module.addSerializer(Long.TYPE, ToStringSerializer.instance);
                    module.addSerializer(BigInteger.class, ToStringSerializer.instance);
                    // ★ BigDecimal 不用科学计数法
                    module.addSerializer(BigDecimal.class, new JsonSerializer<>() {
                        @Override public void serialize(BigDecimal v, JsonGenerator g, SerializerProvider p)
                                throws IOException { g.writeString(v.toPlainString()); }
                    });
                    mapper.registerModule(module);
                    mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
                    mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
                    mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
                    mapper.disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
                    // ★ 支持单值转数组
                    mapper.enable(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY);
                });
        // ★ 解决 String 返回值的中文乱码
        converters.stream()
                .filter(c -> c instanceof StringHttpMessageConverter)
                .map(c -> (StringHttpMessageConverter) c)
                .forEach(c -> c.setDefaultCharset(StandardCharsets.UTF_8));
    }

    // ═══ ⑤ 参数解析器 ═══
    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserResolver);                              // @CurrentUser
        resolvers.add(apiVersionResolver);                                // @ApiVersion
    }

    // ═══ ⑥ 类型转换器与格式化器 ═══
    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverterFactory(new StringToEnumConverterFactory());  // ★ 通用枚举转换
        registry.addConverter(new StringToLocalDateTimeConverter());
        registry.addConverter(new StringTrimConverter());                  // ★ 所有字符串自动 trim
    }

    // ═══ ⑦ 内容协商（★ 只用 JSON，避免 .xml 后缀导致的问题）═══
    @Override
    public void configureContentNegotiation(ContentNegotiationConfigurer configurer) {
        configurer.favorParameter(false)                                   // ★ 禁用 ?format=json
                  .ignoreAcceptHeader(false)
                  .defaultContentType(MediaType.APPLICATION_JSON)          // ★ 默认 JSON
                  .mediaType("json", MediaType.APPLICATION_JSON)
                  .mediaType("xml", MediaType.APPLICATION_XML);
    }

    // ═══ ⑧ 异步支持 ═══
    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setDefaultTimeout(30_000);
        configurer.setTaskExecutor(mvcAsyncExecutor());
    }

    // ═══ ⑨ 路径匹配 ═══
    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.setUseTrailingSlashMatch(false);                        // /users 与 /users/ 不等价
        // ★ 给所有 @RestController 统一加 /api 前缀（不用每个类都写）
        configurer.addPathPrefix("/api",
                c -> c.isAnnotationPresent(RestController.class)
                  && !c.getName().startsWith("org.springframework"));
    }

    // ═══ ⑩ 视图控制器（SPA 前端路由支持）═══
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // ★ 前后端分离时，前端路由刷新 404 的解决方案
        registry.addViewController("/{path:[^\\.]*}")
                .setViewName("forward:/index.html");
        registry.addViewController("/{path:^(?!api|actuator|druid).*}/**/{sub:[^\\.]*}")
                .setViewName("forward:/index.html");
    }
}

// ─── 字符串自动 trim 转换器（★ 很实用的细节）───
public class StringTrimConverter implements Converter<String, String> {
    @Override
    public String convert(String source) {
        String trimmed = source.trim();
        return trimmed.isEmpty() ? null : trimmed;         // ★ 空串转 null（便于判空）
    }
}

// ─── 通用枚举转换器（★ 支持 code 和 name 两种传值）───
public class StringToEnumConverterFactory implements ConverterFactory<String, Enum<?>> {
    @Override
    public <T extends Enum<?>> Converter<String, T> getConverter(Class<T> targetType) {
        return source -> {
            if (!StringUtils.hasText(source)) return null;
            String value = source.trim();
            // ① 按 name（忽略大小写）
            for (T e : targetType.getEnumConstants()) {
                if (e.name().equalsIgnoreCase(value)) return e;
            }
            // ② 按实现了 BaseEnum 的 code
            for (T e : targetType.getEnumConstants()) {
                if (e instanceof BaseEnum be && String.valueOf(be.getCode()).equals(value)) return e;
            }
            throw new IllegalArgumentException(
                String.format("非法的枚举值 [%s]，类型 %s，可选值：%s", value, targetType.getSimpleName(),
                    Arrays.stream(targetType.getEnumConstants())
                          .map(e -> e instanceof BaseEnum be ? be.getCode() + "(" + be.getDesc() + ")" : e.name())
                          .collect(Collectors.joining(", "))));
        };
    }
}
```

```yaml
# ═══════ Web 相关的完整配置（生产模板）═══════
server:
  port: 8080
  servlet:
    context-path: /                                # ★ 应用根路径（生产建议 / 或 /mall）
    encoding:
      charset: UTF-8
      enabled: true
      force: true                                   # ★ 强制请求和响应都用 UTF-8
    session:
      timeout: 30m                                  # Session 超时
      cookie:
        http-only: true                             # ★ 防 XSS
        secure: true                                # ★ 只走 HTTPS
        same-site: lax                              # ★ 防 CSRF（lax/strict/none）
        name: MALLSESSION
      tracking-modes: cookie                        # ★ 禁用 URL 重写
      persistent: false                              # 不做 Session 持久化
    register-default-servlet: false                  # ★ 不注册默认 Servlet
    # ★ 请求大小限制
  max-http-request-header-size: 16KB                 # 请求头最大（Token 很长时要调大）
  tomcat:
    # ─── 线程池（★ 核心性能参数）───
    threads:
      max: 400                                       # ★ 最大工作线程（默认 200）
      min-spare: 50                                   # 最小空闲线程
    max-connections: 10000                            # ★ 最大连接数（默认 8192）
    accept-count: 200                                 # ★ 等待队列长度（线程满后排队，超过则拒绝）
    connection-timeout: 20000                          # ★ 连接超时（ms）
    keep-alive-timeout: 60000                          # ★ 长连接保持时间
    max-keep-alive-requests: 1000                       # 单个长连接最多处理多少请求
    # ─── 请求体限制 ───
    max-swallow-size: 2MB                              # 丢弃的请求体最大
    max-http-form-post-size: 10MB                       # 表单 POST 最大
    # ─── URI 编码 ───
    uri-encoding: UTF-8
    # ─── 日志 ───
    accesslog:
      enabled: true                                    # ★ 访问日志（生产建议开，便于排查）
      directory: /data/logs/mall-service/access
      prefix: access
      suffix: .log
      pattern: '%t %a "%r" %s %b %D'                    # 时间 客户端IP 请求行 状态 字节 耗时(微秒)
      rotate: true                                      # 按天切割
      max-days: 30
      rename-on-rotate: true
      buffered: false                                   # ★ false = 实时写入（崩溃也不丢日志）
      request-attributes-enabled: true                   # 支持 X-Forwarded-For
    # ─── 远程 IP 解析（★ Nginx 代理后必须，否则拿不到真实 IP）───
    remoteip:
      remote-ip-header: X-Forwarded-For
      protocol-header: X-Forwarded-Proto
      host-header: X-Forwarded-Host
      port-header: X-Forwarded-Port
      internal-proxies: '10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|127\.\d+\.\d+\.\d+'
    basedir: /data/tomcat
    # ─── 其他 ───
    background-processor-delay: 10s
    relaxed-query-chars: '[,],{,},|'                     # 允许的 URL 特殊字符
  # ★ 优雅停机（Boot 2.3+）
  shutdown: graceful

spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s                       # ★ 优雅停机等待时间
  servlet:
    multipart:
      enabled: true
      max-file-size: 50MB                                  # ★ 单文件上限
      max-request-size: 100MB                                # ★ 单请求上限
      file-size-threshold: 2MB                                # 超过则写临时文件
      location: /data/tmp/upload                              # ★ 临时目录（别用 /tmp，会被清理）
  mvc:
    throw-exception-if-no-handler-found: true                 # ★ 404 抛异常（走全局异常处理）
    format:
      date: yyyy-MM-dd                                        # LocalDate 全局格式
      date-time: yyyy-MM-dd HH:mm:ss                           # LocalDateTime
      time: HH:mm:ss
    pathmatch:
      matching-strategy: path_pattern_parser                   # Boot 2.6+ 默认
    problemdetails:
      enabled: false                                            # RFC 7807 错误格式（可选）
    async:
      request-timeout: 30000
  web:
    resources:
      add-mappings: false                                       # ★ 配合 404 抛异常（禁用默认静态资源映射）
      static-locations: classpath:/static/
      cache:
        cachecontrol:
          max-age: 7d
          cache-public: true
  jackson:
    date-format: yyyy-MM-dd HH:mm:ss
    time-zone: GMT+8
    default-property-inclusion: non_null
    serialization:
      write-dates-as-timestamps: false
      fail-on-empty-beans: false
      indent-output: false                                       # ★ 生产不美化（省带宽）
    deserialization:
      fail-on-unknown-properties: false                          # ★ 前后端字段不同步时不报错
      accept-single-value-as-array: true
    mapper:
      allow-coercion-of-scalars: true
```

## 6. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | ★ 未统一响应格式 | 前端难处理、错误响应五花八门 | 全局 `Result<T>` + `@RestControllerAdvice` |
| 2 | 全局异常只处理了 1 种校验异常 | 部分校验错误返回 500 | ★ 覆盖三种：MethodArgumentNotValid / Bind / ConstraintViolation |
| 3 | 兜底异常返回了栈信息 | ★ 安全风险（泄漏技术栈、SQL、路径） | 对外通用提示 + traceId，详情只记日志 |
| 4 | 业务异常打了完整栈 | 日志爆炸 | 业务异常 WARN + 只打消息；`fillInStackTrace` 可跳过栈 |
| 5 | `allowedOrigins("*")` + credentials | 启动报错 | 用 `allowedOriginPatterns` |
| 6 | 拦截器未放行 OPTIONS | 预检 401 → 前端报 CORS | `CorsUtils.isPreFlightRequest` |
| 7 | Nginx 与应用都配了 CORS | 响应头重复，浏览器拒绝 | ★ 只在一处配 |
| 8 | `exposedHeaders` 未配 | 前端读不到下载文件名 | 配 `Content-Disposition` |
| 9 | 生产环境 API 文档未关闭 | ★ 接口泄漏（安全风险） | `knife4j.production=true` + Basic 认证 + Nginx 屏蔽 |
| 10 | 用了 springfox（老 Swagger） | Boot 2.6+ 启动报错 | 换 springdoc / Knife4j 4.x |
| 11 | `@EnableWebMvc` 误加 | 丢失所有 Boot 自动配置 | ★ 不要加，只用 `WebMvcConfigurer` |
| 12 | 未配 MVC 异步线程池 | 用默认 SimpleAsyncTaskExecutor（每次新建线程） | `configureAsyncSupport` |
| 13 | `@Async` 无返回值的异常被吞 | 错误无日志 | `AsyncUncaughtExceptionHandler` |
| 14 | 异步线程丢失 traceId | 日志无法串联 | `TaskDecorator` 传递 MDC |
| 15 | 异步线程丢失用户上下文 | NPE / 权限错误 | ThreadLocal 不跨线程，显式传递或用 TTL |
| 16 | SSE 未设超时 | 连接永久占用 | `new SseEmitter(timeout)` + `onTimeout` |
| 17 | SseEmitter 未 complete | 连接泄漏 | 正常/异常路径都要 complete |
| 18 | 大文件下载用 `byte[]` | OOM | `StreamingResponseBody` 或流式 copy |
| 19 | 下载文件名中文乱码 | 前端看到乱码 | `filename*=UTF-8''` + URLEncoder |
| 20 | 未配 `remoteip` | Nginx 代理后拿到的 IP 是网关 IP | 配 `server.tomcat.remoteip.*` |
| 21 | 未配优雅停机 | 重启时请求 502 | `server.shutdown=graceful` + `spring.lifecycle.timeout-per-shutdown-phase` |
| 22 | `multipart.location` 用 /tmp | 长时间不上传后突然失败 | 用独立的持久目录 |
| 23 | `max-http-request-header-size` 太小 | 长 Token 报 400 | 调大到 16KB |
| 24 | 统一响应 Advice 包装了 String 返回值 | `ClassCastException` | 特殊处理 String（手动序列化） |
| 25 | Advice 包装了文件下载/SSE | 响应损坏 | `@IgnoreWrap` 标记或类型判断 |
| 26 | 前端路由刷新 404 | SPA 深链接失效 | forward 到 index.html |
| 27 | Long ID 前端精度丢失 | ID 末位变 0 | ★ Jackson `ToStringSerializer` |
| 28 | `pageSize` 无上限 | 前端传 999999 拖垮数据库 | `@Max` + Service 层 `Math.min` |
| 29 | `orderBy` 直接拼进 SQL | ★ SQL 注入 | 白名单映射 |
| 30 | 敏感字段返回给前端 | 数据泄漏 | 用 VO，或 `@Schema(accessMode=WRITE_ONLY)` + `@JsonProperty(access=WRITE_ONLY)` |

---

## 关联笔记

- 上一篇：[[后端/SpringBoot/整合数据访问层]]
- 下一篇：[[后端/SpringBoot/日志-Actuator与打包部署]]
- MVC 原理：[[后端/Spring/SpringMVC入门与执行流程]]、[[后端/Spring/SpringMVC参数绑定与异常处理]]
- 安全：[[后端/JavaWeb/JWT认证与Web安全]]、[[后端/JavaWeb/Filter-Listener与会话管理]]
- 前端对接：[[前端/Vue/vue]]、[[前端/React/react]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
