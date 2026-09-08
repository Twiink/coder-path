---
title: "SpringMVC参数绑定与异常处理"
aliases:
  - "@RequestParam"
  - "@RequestBody"
  - "全局异常处理"
tags:
  - "后端"
  - "java"
  - "spring"
  - "springmvc"
  - "面试"
category: "后端"
folder: "Spring"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Spring/SpringMVC入门与执行流程]]"
  - "[[后端/Java基础/异常处理]]"
  - "[[后端/SpringBoot/整合Web开发]]"
  - "[[后端/JavaWeb/JWT认证与Web安全]]"
created: 2026-09-07
updated: 2026-09-07
---

# Spring MVC 参数绑定与异常处理

## 1. 参数绑定注解全景 ★★★★★

| 注解 | 数据来源 | 适用 Content-Type | 示例 |
| --- | --- | --- | --- |
| **`@RequestParam`** | ★ URL 查询串 / 表单字段 | `?k=v`、`x-www-form-urlencoded`、`multipart` | `?id=1` |
| **`@PathVariable`** | ★ URL 路径模板变量 | 任意 | `/users/{id}` |
| **`@RequestBody`** | ★ 请求体（反序列化） | `application/json`、`xml` | JSON body |
| `@RequestHeader` | 请求头 | 任意 | `Authorization` |
| `@CookieValue` | Cookie | 任意 | `JSESSIONID` |
| **`@ModelAttribute`** | 表单/查询串 → **对象** | `x-www-form-urlencoded` | 表单提交 |
| `@MatrixVariable` | 矩阵变量 | `/users/id=1;name=tom` | 少用 |
| `@RequestPart` | ★ multipart 的一个 part | `multipart/form-data` | 文件 + JSON |
| `@SessionAttribute` | Session 属性 | 任意 | — |
| `@RequestAttribute` | request 属性（服务端设置） | 任意 | Filter 中 setAttribute |
| 无注解的简单类型 | 查询串（等价 `@RequestParam`） | — | `String name` |
| 无注解的 POJO | 查询串/表单 → 对象 | — | `UserQuery query` |
| `HttpServletRequest`/`Response`/`HttpSession` | Servlet 对象 | — | 直接注入 |
| `Model`/`ModelMap`/`ModelAndView` | 模型容器 | — | 视图渲染用 |
| `BindingResult`/`Errors` | 绑定结果 | — | 手动处理校验错误 |
| `Principal`/`Authentication` | 认证信息 | — | Spring Security |
| `Locale`/`TimeZone`/`InputStream`/`Reader` | 其他 | — | — |

### 1.1 @RequestParam（查询参数 / 表单字段）

```java
// ─── 基本用法 ───
@GetMapping("/users")
public Result<List<User>> list(
        @RequestParam String keyword,                        // ★ 必填（默认 required=true）
        @RequestParam("page_num") Integer pageNum,            // ★ 指定参数名（下划线转驼峰）
        @RequestParam(defaultValue = "20") Integer pageSize,   // ★ 默认值（隐含 required=false）
        @RequestParam(required = false) String status,         // ★ 可选参数
        @RequestParam(name = "sort", defaultValue = "id,asc") String sort) { }

// ⚠️ 必填参数缺失 → MissingServletRequestParameterException（400）

// ─── 接收数组/集合 ───
// 请求：?ids=1&ids=2&ids=3     或     ?ids=1,2,3
@GetMapping("/batch")
public Result<Void> batch(@RequestParam List<Long> ids) { }         // ★ 两种格式都支持
@GetMapping("/batch2")
public Result<Void> batch2(@RequestParam Long[] ids) { }
@GetMapping("/batch3")
public Result<Void> batch3(@RequestParam("tags") Set<String> tags) { }

// ─── 接收 Map（★ 所有查询参数）───
@GetMapping("/all")
public Result<Void> all(@RequestParam Map<String, String> allParams) {
    // {"keyword":"x", "page":"1", "size":"20"}
}
// ⚠️ Map 只能接收 String 值，多值参数只保留最后一个
@GetMapping("/allMulti")
public Result<Void> allMulti(@RequestParam MultiValueMap<String, String> params) { }  // ★ 支持多值

// ─── POST 表单（x-www-form-urlencoded）也用 @RequestParam ───
@PostMapping("/login")
public Result<Void> login(@RequestParam String username,
                          @RequestParam String password) { }
// Content-Type: application/x-www-form-urlencoded
// Body: username=tom&password=123456

// ─── 简写：无注解的简单类型等价于 @RequestParam ───
@GetMapping("/simple")
public Result<Void> simple(String keyword, Integer page) { }
// ★ 等价于都加 @RequestParam(required=false)
// ⚠️ 但【不推荐】：语义不明确，且参数名依赖编译参数 -parameters
```

### 1.2 @PathVariable（路径变量）★★★★★

```java
// ─── 基本用法 ───
@GetMapping("/users/{id}")
public Result<User> get(@PathVariable Long id) { }

// 指定名称（★ 变量名与占位符不同时必须指定）
@GetMapping("/users/{userId}/orders/{orderId}")
public Result<Order> getOrder(@PathVariable("userId") Long uid,
                              @PathVariable("orderId") Long oid) { }

// 可选路径变量（★ 需要两个映射，或用正则）
@GetMapping({"/users", "/users/{id}"})
public Result<User> find(@PathVariable(required = false) Long id) { }

// 正则约束（★ 只匹配数字，避免 /users/list 被当成 id=list）
@GetMapping("/users/{id:\\d+}")
public Result<User> getById(@PathVariable Long id) { }

// 捕获剩余全部路径（Spring 5+，★ 文件下载/代理常用）
@GetMapping("/files/{*path}")
public Resource download(@PathVariable String path) { }
// /files/2026/09/report.pdf → path = "/2026/09/report.pdf"（含开头的 /）

// 接收所有路径变量
@GetMapping("/a/{x}/b/{y}")
public Result<Void> all(@PathVariable Map<String, String> pathVars) { }   // {"x":"1","y":"2"}

// ─── RESTful 风格的标准写法 ───
@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    @GetMapping                              public Result<PageVO> list(UserQuery q) { }
    @GetMapping("/{id}")                     public Result<UserVO> get(@PathVariable Long id) { }
    @GetMapping("/{id}/orders")              public Result<List<Order>> orders(@PathVariable Long id) { }
    @PostMapping                             public Result<Long> create(@RequestBody @Valid UserDTO dto) { }
    @PutMapping("/{id}")                     public Result<Void> update(@PathVariable Long id, @RequestBody @Valid UserDTO dto) { }
    @PatchMapping("/{id}/status")            public Result<Void> status(@PathVariable Long id, @RequestParam Integer s) { }
    @DeleteMapping("/{id}")                  public Result<Void> delete(@PathVariable Long id) { }
    @PostMapping("/{id}/disable")            public Result<Void> disable(@PathVariable Long id, @RequestParam String reason) { }
}

// ⚠️ 路径变量缺失/类型不匹配 → MethodArgumentTypeMismatchException（400）
//    如 /users/abc 但参数是 Long → 转换失败
```

### 1.3 @RequestBody（JSON 请求体）★★★★★

```java
// ─── 基本用法 ───
@PostMapping("/users")
public Result<Long> create(@RequestBody UserCreateDTO dto) { }
// Content-Type: application/json
// {"username":"tom","age":20,"tags":["a","b"]}

// 必填控制
@PostMapping("/x")
public Result<Void> x(@RequestBody(required = false) Dto dto) { }   // body 可为空

// ─── 接收 Map（结构不固定时）───
@PostMapping("/dynamic")
public Result<Void> dynamic(@RequestBody Map<String, Object> body) {
    String name = (String) body.get("name");
    Integer age = (Integer) body.get("age");
    List<String> tags = (List<String>) body.get("tags");
}

// ─── 接收 JSON 数组 ───
@PostMapping("/batch")
public Result<Void> batch(@RequestBody List<UserDTO> list) { }
// [ {"username":"a"}, {"username":"b"} ]

// ─── 接收原始字符串 ───
@PostMapping("/raw")
public Result<Void> raw(@RequestBody String rawJson) { }      // 拿到原始 JSON 文本

// ─── 泛型包装 ───
@PostMapping("/generic")
public Result<Void> generic(@RequestBody RequestWrapper<List<UserDTO>> wrapper) { }
// {"data": [...], "meta": {...}}

// ─── ★ 文件 + JSON 混合上传（multipart）───
@PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public Result<Void> upload(@RequestPart("file") MultipartFile file,      // ★ 文件用 @RequestPart
                           @RequestPart("meta") OrderDTO meta) { }       // ★ JSON 部分用 @RequestPart
// 前端（FormData）：
// const fd = new FormData();
// fd.append('file', fileObj);
// fd.append('meta', new Blob([JSON.stringify(meta)], {type: 'application/json'}));   ★ 必须指定 type

// ─── 接收 XML ───
@PostMapping(value = "/xml", consumes = MediaType.APPLICATION_XML_VALUE)
public Result<Void> xml(@RequestBody UserDto dto) { }
// 需要 jackson-dataformat-xml 依赖，且 DTO 加 @JacksonXmlRootElement
```

**@RequestParam vs @RequestBody vs @ModelAttribute（★ 必考）：**

| 对比 | `@RequestParam` | `@RequestBody` | `@ModelAttribute` |
| --- | --- | --- | --- |
| 数据来源 | URL 查询串 + 表单 body | ★ **请求体（原始流）** | URL 查询串 + 表单 body |
| Content-Type | 任意 / `x-www-form-urlencoded` | ★ `application/json`（或 xml） | `x-www-form-urlencoded` / `multipart` |
| 解析方式 | `request.getParameter()` | ★ **HttpMessageConverter 反序列化** | 数据绑定（DataBinder） |
| 能读几次 | 多次（容器已解析） | ★ **只能读一次**（流） | 多次 |
| 支持 GET | ✅ | ⚠️ 技术上可以但不规范 | ✅ |
| 嵌套对象 | ❌（需 `obj.field` 形式） | ✅ **完美支持** | ✅（需 `obj.field` 形式） |
| 集合 | ✅ `List<Long> ids` | ✅ 任意结构 | ⚠️ 有限（`ids[0]`、`ids[1]`） |
| 校验 | ✅ 配合 `@Validated` 在类上 | ✅ `@Valid` | ✅ `@Valid` + `BindingResult` |
| 典型场景 | 简单查询、分页参数 | ★ **POST/PUT 的复杂对象** | 表单提交、GET 的查询条件对象 |

```java
// ─── 嵌套对象的绑定差异（★ 高频坑）───
// DTO
public class OrderDTO {
    private String orderNo;
    private UserDTO user;              // 嵌套对象
    private List<ItemDTO> items;       // 嵌套集合
}

// ① @RequestBody（JSON）→ 完美支持任意嵌套
@PostMapping("/json")
public void json(@RequestBody OrderDTO dto) { }
// {"orderNo":"A1","user":{"name":"Tom","address":{"city":"BJ"}},"items":[{"sku":1,"qty":2}]}

// ② @ModelAttribute / 无注解（表单）→ 需要用「点」和「下标」语法
@PostMapping("/form")
public void form(@ModelAttribute OrderDTO dto) { }
// orderNo=A1
// user.name=Tom
// user.address.city=BJ
// items[0].sku=1
// items[0].qty=2
// ★ 前端表单字段名必须严格符合这个格式，很容易出错

// ③ GET 查询对象（推荐用无注解或 @ModelAttribute）
@GetMapping("/orders")
public Result<List<Order>> query(OrderQuery query) { }      // ★ 无注解，自动绑定查询串
// ?orderNo=A1&status=1&createTimeStart=2026-01-01&pageSize=20
public class OrderQuery {
    private String orderNo;
    private Integer status;
    @DateTimeFormat(pattern = "yyyy-MM-dd")               // ★ 日期格式
    private LocalDate createTimeStart;
    private Integer pageNum = 1;                            // 默认值
    private Integer pageSize = 20;
}
```

### 1.4 其他参数注解

```java
// ─── @RequestHeader ───
@GetMapping("/headers")
public Result<Void> headers(
        @RequestHeader("User-Agent") String userAgent,                    // ★ 必填
        @RequestHeader(value = "X-Request-Id", required = false) String reqId,
        @RequestHeader(defaultValue = "zh-CN") String acceptLanguage,
        @RequestHeader Map<String, String> allHeaders,                     // ★ 所有头
        @RequestHeader HttpHeaders httpHeaders) {                          // ★ 类型安全的封装
    httpHeaders.getFirst("Authorization");
    httpHeaders.get("Accept");                                             // List<String>
}

// ─── @CookieValue ───
@GetMapping("/cookies")
public Result<Void> cookies(
        @CookieValue("JSESSIONID") String sessionId,
        @CookieValue(value = "theme", defaultValue = "light") String theme,
        @CookieValue(required = false) String tracking,
        @CookieValue Map<String, String> allCookies,
        @CookieValue MultiValueMap<String, String> allCookies2) { }

// ─── @RequestPart（multipart 的部分）───
@PostMapping("/mixed")
public Result<Void> mixed(@RequestPart("file") MultipartFile file,
                          @RequestPart("data") String jsonData,           // 文本部分
                          @RequestPart("dto") OrderDTO dto) { }            // JSON 部分（自动反序列化）

// ─── @SessionAttribute / @RequestAttribute ───
@GetMapping("/attrs")
public Result<Void> attrs(
        @SessionAttribute("loginUser") LoginUser user,                    // 从 Session 取
        @SessionAttribute(required = false) String temp,
        @RequestAttribute("startTime") Long startTime) { }                // 从 request 取（Filter 设置的）

// ─── @MatrixVariable（矩阵变量，少用）───
// URL: /cars/color=red;year=2020/brand=toyota
@GetMapping("/cars/{specs}")
public Result<Void> cars(@MatrixVariable Map<String, List<String>> vars,
                         @PathVariable String specs) { }
// 需开启：@EnableWebMvc 或 configurePathMatch 中 setRemoveSemicolonContent(false)

// ─── Servlet 原生对象（直接注入）───
@GetMapping("/servlet")
public Result<Void> servlet(HttpServletRequest request,
                            HttpServletResponse response,
                            HttpSession session,
                            ServletContext context,
                            Principal principal,                        // 认证主体
                            Authentication authentication,              // Spring Security
                            Locale locale,
                            TimeZone timeZone,
                            ZoneId zoneId,
                            InputStream inputStream,
                            OutputStream outputStream,
                            Reader reader,
                            Writer writer) { }

// ─── Model 相关 ───
@GetMapping("/model")
public String model(Model model,                        // ★ 轻量，只能放数据
                  ModelMap modelMap,                    // 功能更多（LinkedHashMap）
                  ModelAndView mav) {
    model.addAttribute("key", "value");
    return "view";
}

// ─── BindingResult / Errors（★ 必须紧跟在被校验的参数之后！）───
@PostMapping("/validated")
public Result<Void> validated(@Valid @ModelAttribute UserDTO dto,
                              BindingResult bindingResult) {          // ★ 参数顺序不能变
    if (bindingResult.hasErrors()) {
        // 手动处理校验错误（不会被 MethodArgumentNotValidException 拦截）
        String msg = bindingResult.getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return Result.failed(msg);
    }
    return Result.success();
}
```

### 1.5 文件上传（MultipartFile）★★★★★

```java
// ─── 单文件上传 ───
@PostMapping("/upload")
public Result<String> upload(@RequestParam("file") MultipartFile file) throws IOException {
    if (file.isEmpty()) return Result.failed("文件为空");

    String originalName = file.getOriginalFilename();     // 原始文件名（★ 可能含路径，要处理）
    String contentType = file.getContentType();           // MIME 类型（★ 客户端可伪造）
    long size = file.getSize();                            // 字节数
    byte[] bytes = file.getBytes();                        // ★ 全部读入内存（小文件可以，大文件会 OOM）
    InputStream in = file.getInputStream();                // ★ 流式读取（推荐）

    // 安全处理文件名（★ 防路径穿越）
    String safeName = StringUtils.cleanPath(originalName);
    if (safeName.contains("..")) throw new BusinessException("非法文件名");
    String ext = FilenameUtils.getExtension(safeName);
    String newName = UUID.randomUUID().toString().replace("-", "") + "." + ext;

    // 保存（★ 流式，不占内存）
    Path target = Paths.get(uploadDir, LocalDate.now().toString(), newName);
    Files.createDirectories(target.getParent());
    try (InputStream is = file.getInputStream()) {
        Files.copy(is, target, StandardCopyOption.REPLACE_EXISTING);
    }
    // 或 file.transferTo(target.toFile());              // ★ 更快（直接移动临时文件）

    return Result.success("/files/" + target.getFileName());
}

// ─── 多文件上传 ───
@PostMapping("/uploads")
public Result<List<String>> uploads(@RequestParam("files") MultipartFile[] files) { }
@PostMapping("/uploads2")
public Result<List<String>> uploads2(@RequestParam("files") List<MultipartFile> files) { }

// ─── 表单对象中包含文件 ───
@Data
public class UploadForm {
    private String title;
    private MultipartFile cover;                 // ★ 对象中的文件字段
    private List<MultipartFile> attachments;
}
@PostMapping("/form-upload")
public Result<Void> formUpload(@ModelAttribute UploadForm form) { }

// ─── MultipartHttpServletRequest（底层 API）───
@PostMapping("/raw-upload")
public Result<Void> rawUpload(HttpServletRequest request) {
    MultipartHttpServletRequest multipartReq =
            WebUtils.getNativeRequest(request, MultipartHttpServletRequest.class);
    if (multipartReq != null) {
        MultipartFile file = multipartReq.getFile("file");
        Map<String, MultipartFile> fileMap = multipartReq.getFileMap();
        MultiValueMap<String, MultipartFile> multiMap = multipartReq.getMultiFileMap();
    }
}
```

```yaml
# ─── 上传配置（★ 必配，否则大文件上传失败）───
spring:
  servlet:
    multipart:
      enabled: true                    # 开启 multipart 支持（默认 true）
      max-file-size: 50MB              # ★ 单个文件最大（默认 1MB！很小）
      max-request-size: 100MB          # ★ 整个请求最大（默认 10MB）
      file-size-threshold: 1MB         # 超过此大小才写磁盘临时文件（否则在内存）
      location: /data/tmp              # 临时文件目录（★ 确保有写权限和足够空间）
      resolve-lazily: false            # 是否延迟解析
```

> 【坑】**文件上传的常见问题：**
> 1. **默认限制只有 1MB**：超过报 `MaxUploadSizeExceededException`，必须调整 `max-file-size`。
> 2. **Nginx 也有限制**：`client_max_body_size`（默认 1MB），报 **413 Request Entity Too Large**。
> 3. **临时目录被清理**：Linux 的 `/tmp` 有定时清理（systemd-tmpfiles），长时间不上传后突然失败报
>    `The temporary upload location /tmp/tomcat.xxx is not valid` → 显式配置 `location`。
> 4. **`file.getBytes()` 大文件 OOM**：改用 `getInputStream()` 流式处理。
> 5. **`transferTo()` 的路径问题**：传相对路径时会相对于临时目录，务必传绝对路径。
> 6. **安全**：见 [[后端/JavaWeb/JWT认证与Web安全]] 6.4 节（白名单、魔数校验、二次渲染、随机命名）。

## 2. 数据校验（Validation）★★★★★

### 2.1 JSR-380（Bean Validation 2.0）注解

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>   <!-- ★ 必须引入（Boot 2.3+ 不再自动包含） -->
</dependency>
```

| 注解 | 适用类型 | 说明 |
| --- | --- | --- |
| **`@NotNull`** | 任意 | ★ 不为 null（可以是空串） |
| **`@NotEmpty`** | String/Collection/Map/Array | ★ 不为 null **且** size > 0（`""` 不通过） |
| **`@NotBlank`** | ★ **仅 CharSequence** | 不为 null 且 **trim 后长度 > 0**（`"   "` 不通过） |
| `@Size(min,max)` | String/Collection/Map/Array | 长度/大小范围 |
| `@Min(v)` / `@Max(v)` | 数字 | 最小/最大值 |
| `@DecimalMin` / `@DecimalMax` | BigDecimal/BigInteger | 支持小数的范围（`value="0.01"`） |
| `@Positive` / `@PositiveOrZero` | 数字 | 正数 / 非负数 |
| `@Negative` / `@NegativeOrZero` | 数字 | 负数 / 非正数 |
| `@Digits(integer,fraction)` | 数字 | 整数位/小数位长度限制 |
| **`@Pattern(regexp)`** | String | ★ 正则匹配 |
| `@Email` | String | 邮箱格式（宽松，不校验域名） |
| **`@Past` / `@Future`** | 日期时间 | 过去 / 未来 |
| `@PastOrPresent` / `@FutureOrPresent` | 日期时间 | 含当前 |
| `@AssertTrue` / `@AssertFalse` | boolean | 必须为 true/false |
| **`@Valid`** | 嵌套对象/集合 | ★ **级联校验**（不加则嵌套对象不校验！） |
| `@Validated` | 类/方法/参数 | ★ Spring 的注解，支持**分组校验** |
| `@ConstraintValidator` | 自定义 | 自定义校验规则 |

```java
// ─── 完整示例 ───
@Data
public class UserCreateDTO {

    @NotNull(message = "用户ID不能为空")
    @Min(value = 1, message = "用户ID必须大于0")
    private Long id;

    @NotBlank(message = "用户名不能为空")                       // ★ 字符串用 NotBlank
    @Size(min = 2, max = 20, message = "用户名长度必须在 2~20 之间")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "用户名只能包含字母、数字、下划线")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 32, message = "密码长度必须在 8~32 之间")
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
             message = "密码必须包含大小写字母和数字")
    private String password;

    @NotBlank(message = "手机号不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @Email(message = "邮箱格式不正确")
    private String email;                                       // 可选字段不加 NotNull

    @NotNull(message = "年龄不能为空")
    @Min(value = 0, message = "年龄不能为负")
    @Max(value = 150, message = "年龄不能超过 150")
    private Integer age;

    @NotNull(message = "余额不能为空")
    @DecimalMin(value = "0.00", message = "余额不能为负")
    @DecimalMax(value = "999999999.99", message = "余额过大")
    @Digits(integer = 9, fraction = 2, message = "余额最多 9 位整数、2 位小数")
    private BigDecimal balance;

    @NotEmpty(message = "标签不能为空")
    @Size(max = 5, message = "标签最多 5 个")
    private List<String> tags;

    @Future(message = "过期时间必须是未来")
    private LocalDateTime expireTime;

    @Past(message = "生日必须是过去")
    private LocalDate birthday;

    @NotNull(message = "地址不能为空")
    @Valid                                                       // ★★ 级联校验嵌套对象
    private AddressDTO address;

    @Valid                                                       // ★ 级联校验集合中的每个元素
    @NotEmpty(message = "订单项不能为空")
    private List<@Valid OrderItemDTO> items;

    @AssertTrue(message = "必须同意用户协议")
    private Boolean agreed;

    // ★ 自定义校验注解
    @EnumValue(enumClass = OrderStatus.class, message = "订单状态非法")
    private String status;

    // ★ 跨字段校验（类级别注解）
    // @PasswordMatch(message = "两次密码不一致")
}
```

### 2.2 触发校验的三种方式

```java
// ─── ① @RequestBody + @Valid（★ JSON 请求体校验，最常用）───
@RestController
@RequiredArgsConstructor
public class UserController {

    @PostMapping("/users")
    public Result<Long> create(@RequestBody @Valid UserCreateDTO dto) {
        // 校验失败 → 抛 MethodArgumentNotValidException（★ 需要全局异常处理器捕获）
        return Result.success(userService.create(dto));
    }

    // @Validated 也可以，且支持分组
    @PostMapping("/users2")
    public Result<Long> create2(@RequestBody @Validated(Create.class) UserCreateDTO dto) { }
}

// ─── ② 表单/查询对象校验（@ModelAttribute + @Valid）───
@GetMapping("/users")
public Result<PageVO> list(@Valid UserQuery query, BindingResult br) {
    if (br.hasErrors()) { return Result.failed(br.getFieldError().getDefaultMessage()); }
    ...
}
// 校验失败 → 抛 BindException（若没有 BindingResult 参数）

// ─── ③ ★ 单个参数校验（@RequestParam / @PathVariable）───
@RestController
@Validated                                     // ★★ 必须加在【类】上！否则不生效
@RequiredArgsConstructor
public class UserController {

    @GetMapping("/users/{id}")
    public Result<UserVO> get(
            @PathVariable
            @NotNull(message = "ID不能为空")
            @Min(value = 1, message = "ID必须大于0") Long id) {
        return Result.success(userService.get(id));
    }

    @GetMapping("/search")
    public Result<PageVO> search(
            @RequestParam
            @NotBlank(message = "关键字不能为空")
            @Size(max = 50, message = "关键字过长") String keyword,
            @RequestParam @Min(1) Integer pageNum,
            @RequestParam @Min(1) @Max(100) Integer pageSize) {
        return Result.success(userService.search(keyword, pageNum, pageSize));
    }
}
// 校验失败 → 抛 ConstraintViolationException（★ 与前两种异常类型不同！）
// 原理：@Validated 在类上 → MethodValidationPostProcessor 创建 AOP 代理 → MethodValidationInterceptor 校验
```

**三种校验的异常类型对比（★ 全局异常处理必须都覆盖）：**

| 校验方式 | 抛出的异常 | 错误信息位置 |
| --- | --- | --- |
| `@RequestBody @Valid` | **`MethodArgumentNotValidException`** | `getBindingResult().getFieldErrors()` |
| `@ModelAttribute @Valid`（表单） | **`BindException`** | `getBindingResult().getFieldErrors()` |
| `@Validated` + `@RequestParam`/`@PathVariable` | **`ConstraintViolationException`** | `getConstraintViolations()` |
| `@Validated` 在 Service 层 | `ConstraintViolationException` | 同上 |
| 嵌套对象校验失败 | 同外层方式 | `field` 形如 `address.city` |

### 2.3 分组校验（★ 新增与更新用不同规则）

```java
// ─── 定义分组接口 ───
public interface Create { }
public interface Update { }
public interface Query { }

// ─── DTO 中指定分组 ───
@Data
public class UserDTO {

    @NotNull(message = "ID不能为空", groups = Update.class)        // ★ 只有更新时才校验 ID
    private Long id;

    @NotBlank(message = "用户名不能为空", groups = {Create.class, Update.class})
    @Size(min = 2, max = 20, groups = Create.class)               // ★ 只有创建时校验长度
    private String username;

    @NotBlank(message = "密码不能为空", groups = Create.class)      // ★ 只有创建时必填（更新时可不改密码）
    private String password;

    @NotNull(message = "状态不能为空", groups = Update.class)
    private Integer status;
}

// ─── 使用分组 ───
@PostMapping
public Result<Long> create(@RequestBody @Validated(Create.class) UserDTO dto) { }

@PutMapping("/{id}")
public Result<Void> update(@PathVariable Long id,
                          @RequestBody @Validated(Update.class) UserDTO dto) { }

// ─── 多分组 + 顺序 ───
@Validated({Create.class, Default.class})          // Default 是 JSR 的默认分组
// 用 @GroupSequence 定义顺序（前一组失败则不校验后一组）
@GroupSequence({Create.class, Update.class})
public interface CreateThenUpdate { }

// ⚠️ 坑：使用 groups 后，【没有指定 groups 的注解不会被校验】！
//   因为没指定 groups 的注解属于 Default 组，而你只指定了 Create 组
// ✅ 解决：让自定义分组继承 Default
public interface Create extends Default { }        // ★ 这样 Create 组也包含 Default 组的校验
```

### 2.4 自定义校验注解（★ 实战必备）

```java
// ─── 步骤 1：定义注解 ───
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Constraint(validatedBy = {MobileValidator.class})       // ★ 指定校验器
public @interface Mobile {
    String message() default "手机号格式不正确";           // ★ 必须有 message
    Class<?>[] groups() default {};                       // ★ 必须有 groups
    Class<? extends Payload>[] payload() default {};      // ★ 必须有 payload

    boolean required() default true;                       // 自定义属性

    /** 支持在数组/集合上使用（JSR 规范约定） */
    @Target({ElementType.FIELD, ElementType.PARAMETER})
    @Retention(RetentionPolicy.RUNTIME)
    @interface List { Mobile[] value(); }
}

// ─── 步骤 2：实现校验器 ───
public class MobileValidator implements ConstraintValidator<Mobile, String> {

    private static final Pattern MOBILE_PATTERN = Pattern.compile("^1[3-9]\\d{9}$");
    private boolean required;

    @Override
    public void initialize(Mobile annotation) {            // ★ 初始化（读取注解属性）
        this.required = annotation.required();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // ① null/空值的处理（★ 一般交给 @NotNull/@NotBlank，这里放行）
        if (value == null || value.isBlank()) {
            return !required;                               // required=true 时空值不通过
        }
        // ② 格式校验
        boolean valid = MOBILE_PATTERN.matcher(value).matches();

        // ③ ★ 自定义错误消息（覆盖注解的 message）
        if (!valid) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate("手机号 " + value + " 格式非法")
                   .addConstraintViolation();
        }
        return valid;
    }
}

// ─── 使用 ───
public class UserDTO {
    @Mobile(message = "请输入正确的手机号")
    private String phone;

    @Mobile(required = false)                               // 可选字段
    private String backupPhone;
}

// ─── 更多实用的自定义校验 ───
// ① 枚举值校验
@EnumValue(enumClass = OrderStatus.class, message = "订单状态非法")
private String status;

// ② 密码强度
@PasswordStrength(minLength = 8, requireDigit = true, requireUpperCase = true)
private String password;

// ③ 日期范围（跨字段）
@DateRange(startField = "startDate", endField = "endDate", message = "开始日期不能晚于结束日期")
public class DateQuery { private LocalDate startDate; private LocalDate endDate; }

// ④ 唯一性校验（查数据库，★ 慎用：性能差且有时序问题）
@Unique(table = "user", column = "username", message = "用户名已存在")
private String username;

// ⑤ 敏感词校验
@NoSensitiveWord(message = "包含敏感词")
private String content;
```

```java
// ─── Service 层校验（@Validated 加在类上）───
@Service
@Validated                                          // ★ 开启方法级校验
public class UserService {

    public User getById(@NotNull(message = "ID不能为空") @Min(1) Long id) {
        return userMapper.selectById(id);
    }

    public void update(@Valid UserDTO dto) { }       // ★ 对象参数用 @Valid
}
// 失败抛 ConstraintViolationException
```

## 3. 类型转换与格式化 ★★★★

```java
// ─── ① @DateTimeFormat（★ 接收参数时的日期格式）───
public class OrderQuery {
    @DateTimeFormat(pattern = "yyyy-MM-dd")                        // ★ LocalDate
    private LocalDate startDate;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")               // ★ LocalDateTime
    private LocalDateTime createTimeStart;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)                  // ISO 格式（2026-09-07）
    private LocalDate date;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")   // 带时区
    private Date legacyDate;                                         // java.util.Date
}

// ─── ② @JsonFormat（★ JSON 序列化/反序列化时的日期格式）───
public class OrderVO {
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")   // ★ 输出给前端的格式
    private LocalDateTime createTime;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate orderDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING)                        // Long 转 String（防精度丢失）
    private Long id;
}

// ★ @DateTimeFormat vs @JsonFormat 的区别（高频混淆）：
//   @DateTimeFormat：Spring 的注解，处理【表单/查询参数】的日期转换（String → Date）
//   @JsonFormat：    Jackson 的注解，处理【JSON 请求体/响应体】的日期（双向）
//   实践：查询对象用 @DateTimeFormat，DTO/VO 用 @JsonFormat，两个都加最保险

// ─── ③ 全局日期格式配置 ───
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(new StringToLocalDateConverter());
        registry.addConverter(new StringToLocalDateTimeConverter());
        registry.addFormatter(new DateFormatter("yyyy-MM-dd"));
        registry.addConverterFactory(new StringToEnumConverterFactory());   // ★ 通用枚举转换
    }
}

// 自定义转换器（String → LocalDate，支持多种格式）
public class StringToLocalDateConverter implements Converter<String, LocalDate> {
    private static final List<DateTimeFormatter> FORMATTERS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,                              // 2026-09-07
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("yyyyMMdd"),
            DateTimeFormatter.ofPattern("yyyy年MM月dd日"));

    @Override
    public LocalDate convert(String source) {
        if (!StringUtils.hasText(source)) return null;
        String trimmed = source.trim();
        for (DateTimeFormatter fmt : FORMATTERS) {
            try { return LocalDate.parse(trimmed, fmt); } catch (Exception ignored) { }
        }
        throw new IllegalArgumentException("无法解析日期：" + source);
    }
}

// 通用枚举转换工厂（★ 让前端可以传 code 或 name）
public class StringToEnumConverterFactory implements ConverterFactory<String, Enum<?>> {
    @Override
    public <T extends Enum<?>> Converter<String, T> getConverter(Class<T> targetType) {
        return source -> {
            if (!StringUtils.hasText(source)) return null;
            // ① 先按 name 匹配
            try { return (T) Enum.valueOf(targetType, source.trim().toUpperCase()); }
            catch (IllegalArgumentException ignored) { }
            // ② 再按实现了 BaseEnum 的 code 匹配
            for (T e : targetType.getEnumConstants()) {
                if (e instanceof BaseEnum be && be.getCode().equals(source.trim())) return e;
            }
            throw new IllegalArgumentException("非法的枚举值：" + source + "，类型：" + targetType.getSimpleName());
        };
    }
}
public interface BaseEnum { String getCode(); String getDesc(); }
```

```yaml
# application.yml 的全局日期配置
spring:
  mvc:
    format:
      date: yyyy-MM-dd                    # ★ LocalDate 的全局格式
      date-time: yyyy-MM-dd HH:mm:ss      # ★ LocalDateTime 的全局格式
      time: HH:mm:ss                       # LocalTime
  jackson:
    date-format: yyyy-MM-dd HH:mm:ss       # java.util.Date（对 LocalDateTime 无效）
    time-zone: GMT+8
    serialization:
      write-dates-as-timestamps: false      # ★ 日期输出字符串而非时间戳
```

## 4. 拦截器（HandlerInterceptor）★★★★★

```java
/**
 * ★ 完整的拦截器实现（含所有最佳实践）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtUtils jwtUtils;
    private final TokenBlacklistService blacklistService;

    /** 白名单路径（用 AntPathMatcher 匹配） */
    private static final AntPathMatcher MATCHER = new AntPathMatcher();
    private static final List<String> WHITE_LIST = List.of(
            "/api/auth/**", "/api/public/**", "/error", "/favicon.ico");

    // ═══ ① 前置处理 ═══
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {

        // 1. 放行 CORS 预检请求（★ 否则前端报 CORS 错误）
        if (CorsUtils.isPreFlightRequest(request)) {
            return true;
        }

        // 2. 放行非 HandlerMethod 的请求（静态资源、错误页）
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        // 3. 白名单放行
        String uri = request.getRequestURI();
        if (WHITE_LIST.stream().anyMatch(p -> MATCHER.match(p, uri))) {
            return true;
        }

        // 4. ★ 注解级放行（@IgnoreAuth）
        if (handlerMethod.hasMethodAnnotation(IgnoreAuth.class)
                || handlerMethod.getBeanType().isAnnotationPresent(IgnoreAuth.class)) {
            return true;
        }

        // 5. 提取并校验 Token
        String token = resolveToken(request);
        if (!StringUtils.hasText(token)) {
            reject(response, ResultCode.UNAUTHORIZED, "未提供认证令牌");
            return false;                                    // ★ 中断，返回 false
        }

        JwtUtils.JwtValidationResult result = jwtUtils.validate(token);
        if (!result.valid()) {
            reject(response, result.expired() ? ResultCode.TOKEN_EXPIRED : ResultCode.TOKEN_INVALID,
                   result.message());
            return false;
        }

        // 6. 黑名单校验（登出的 Token）
        if (blacklistService.isBlacklisted(result.claims().getId())) {
            reject(response, ResultCode.UNAUTHORIZED, "令牌已失效");
            return false;
        }

        // 7. ★ 权限校验（读取方法上的注解）
        RequiresPermission perm = handlerMethod.getMethodAnnotation(RequiresPermission.class);
        if (perm == null) perm = AnnotatedElementUtils.findMergedAnnotation(
                handlerMethod.getBeanType(), RequiresPermission.class);
        if (perm != null) {
            LoginUser user = buildUser(result.claims());
            if (!hasAnyPermission(user, perm.value())) {
                reject(response, ResultCode.FORBIDDEN, "无访问权限：" + String.join(",", perm.value()));
                return false;
            }
        }

        // 8. ★ 设置上下文（ThreadLocal）
        UserContext.set(buildUser(result.claims()));
        request.setAttribute("startTime", System.nanoTime());

        return true;                                          // ★ 放行
    }

    // ═══ ② 后置处理（★ Controller 正常返回后、视图渲染前）═══
    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response,
                           Object handler, ModelAndView modelAndView) {
        // @ResponseBody 场景下 modelAndView 为 null，这里做不了太多
        // 可用于：修改视图数据、添加公共响应头
        response.setHeader("X-Response-Time", String.valueOf(costMs(request)));
    }

    // ═══ ③ 完成后处理（★ 无论成功失败都执行，资源清理的正确位置）═══
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        try {
            long cost = costMs(request);
            String uri = request.getRequestURI();
            int status = response.getStatus();

            // 慢请求告警
            if (cost > 3000) {
                log.warn("★慢请求 {} {} status={} cost={}ms user={}",
                        request.getMethod(), uri, status, cost, currentUser());
            } else if (status >= 500 || ex != null) {
                log.error("请求失败 {} {} status={} cost={}ms", request.getMethod(), uri, status, cost, ex);
            } else if (log.isDebugEnabled()) {
                log.debug("{} {} status={} cost={}ms", request.getMethod(), uri, status, cost);
            }

            // 监控埋点
            Metrics.timer("http.server.requests",
                    "method", request.getMethod(),
                    "uri", uri,
                    "status", String.valueOf(status))
                   .record(cost, TimeUnit.MILLISECONDS);
        } finally {
            // ★★ 必须清理 ThreadLocal（线程池复用会导致数据串号 + 内存泄漏）
            UserContext.clear();
        }
    }

    // ═══ ④ 异步请求开始时（替代 postHandle/afterCompletion）═══
    @Override
    public void afterConcurrentHandlingStarted(HttpServletRequest request, HttpServletResponse response,
                                               Object handler) {
        // ★ 异步请求（Callable/DeferredResult）时调用，此时 afterCompletion 不会调用
        // 需要在这里清理资源
        UserContext.clear();
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) return header.substring(7);
        return request.getHeader("X-Access-Token");
    }

    private void reject(HttpServletResponse response, ResultCode code, String msg) throws IOException {
        response.setStatus(code == ResultCode.FORBIDDEN ? 403 : 401);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(JSON.toJSONString(Result.failed(code, msg)));
        // ★ 不需要再 return false，调用方会处理
    }

    private long costMs(HttpServletRequest request) {
        Long start = (Long) request.getAttribute("startTime");
        return start == null ? 0 : (System.nanoTime() - start) / 1_000_000;
    }
    private String currentUser() {
        LoginUser u = UserContext.get();
        return u == null ? "anonymous" : u.getUsername();
    }
}
```

**注册与顺序：**

```java
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final TraceInterceptor traceInterceptor;       // 链路追踪
    private final LogInterceptor logInterceptor;            // 日志
    private final AuthInterceptor authInterceptor;          // 认证鉴权
    private final RateLimitInterceptor rateLimitInterceptor;// 限流

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // ★ order 数字越小越先执行（洋葱模型的外层）
        registry.addInterceptor(traceInterceptor)
                .addPathPatterns("/**")
                .order(1);                                   // ① 最先：设置 traceId

        registry.addInterceptor(logInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/static/**", "/actuator/**", "/error")
                .order(2);                                   // ② 记录请求日志

        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/auth/**", "/api/public/**",
                                     "/doc.html", "/webjars/**", "/v3/api-docs/**")
                .order(3);                                   // ③ 认证鉴权

        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/api/**")
                .order(4);                                   // ④ 限流（认证后才知道是谁）
    }
}
```

**Filter vs Interceptor 的选择见 [[后端/JavaWeb/Filter-Listener与会话管理]] 第 2 节。**

## 5. 全局异常处理 ★★★★★

```java
/**
 * ★ 企业级全局异常处理器（覆盖所有场景）
 */
@Slf4j
@RestControllerAdvice                                  // = @ControllerAdvice + @ResponseBody
@Order(Ordered.HIGHEST_PRECEDENCE)                       // ★ 多个 Advice 时的优先级
public class GlobalExceptionHandler {

    // ══════════ ① 业务异常（可预期，WARN 级别，不打栈）══════════
    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusiness(BusinessException e) {
        log.warn("业务异常: code={}, msg={}", e.getCode(), e.getMsg());
        return Result.failed(e.getCode(), e.getMsg());
    }

    // ══════════ ② ★ 参数校验异常（三种类型都要处理！）══════════

    /** @RequestBody + @Valid 校验失败 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleMethodArgumentNotValid(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.warn("参数校验失败(@RequestBody): {}", msg);
        return Result.failed(ResultCode.VALIDATE_FAILED, msg);
    }

    /** 表单/@ModelAttribute 校验失败 */
    @ExceptionHandler(BindException.class)
    public Result<Void> handleBind(BindException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.warn("参数绑定失败: {}", msg);
        return Result.failed(ResultCode.VALIDATE_FAILED, msg);
    }

    /** ★ @Validated + @RequestParam/@PathVariable 校验失败 */
    @ExceptionHandler(ConstraintViolationException.class)
    public Result<Void> handleConstraintViolation(ConstraintViolationException e) {
        String msg = e.getConstraintViolations().stream()
                .map(v -> {
                    // propertyPath 形如 "getUser.id"，只取最后一段
                    String path = v.getPropertyPath().toString();
                    String field = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
                    return field + ": " + v.getMessage();
                })
                .collect(Collectors.joining("; "));
        log.warn("参数校验失败(@Validated): {}", msg);
        return Result.failed(ResultCode.VALIDATE_FAILED, msg);
    }

    /** 校验相关的其他异常 */
    @ExceptionHandler(ValidationException.class)
    public Result<Void> handleValidation(ValidationException e) {
        return Result.failed(ResultCode.VALIDATE_FAILED, e.getMessage());
    }

    // ══════════ ③ 请求参数/格式异常（客户端错误，400）══════════

    /** 缺少必填参数 */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public Result<Void> handleMissingParam(MissingServletRequestParameterException e) {
        return Result.failed(ResultCode.VALIDATE_FAILED,
                "缺少必要参数: " + e.getParameterName() + "（类型 " + e.getParameterType() + "）");
    }

    /** 参数类型不匹配（如 /users/abc 但参数是 Long） */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public Result<Void> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        log.warn("参数类型不匹配: {} = {}", e.getName(), e.getValue());
        return Result.failed(ResultCode.VALIDATE_FAILED,
                "参数 [" + e.getName() + "] 类型错误，期望 " + e.getRequiredType().getSimpleName());
    }

    /** 请求体无法解析（JSON 格式错误、类型不匹配） */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public Result<Void> handleNotReadable(HttpMessageNotReadableException e) {
        log.warn("请求体解析失败: {}", e.getMessage());
        // ★ 提取有用的信息（如枚举值非法、日期格式错误）
        String detail = "请求体格式错误";
        Throwable cause = e.getCause();
        if (cause instanceof InvalidFormatException ife) {
            detail = String.format("字段 [%s] 的值 [%s] 无法转换为 %s",
                    ife.getPath().stream().map(r -> r.getFieldName()).collect(Collectors.joining(".")),
                    ife.getValue(), ife.getTargetType().getSimpleName());
        } else if (cause instanceof JsonParseException) {
            detail = "JSON 语法错误，请检查格式";
        }
        return Result.failed(ResultCode.VALIDATE_FAILED, detail);
    }

    /** 缺少请求头 */
    @ExceptionHandler(MissingRequestHeaderException.class)
    public Result<Void> handleMissingHeader(MissingRequestHeaderException e) {
        return Result.failed(ResultCode.VALIDATE_FAILED, "缺少请求头: " + e.getHeaderName());
    }

    /** 缺少 Cookie */
    @ExceptionHandler(MissingRequestCookieException.class)
    public Result<Void> handleMissingCookie(MissingRequestCookieException e) {
        return Result.failed(ResultCode.UNAUTHORIZED, "缺少 Cookie: " + e.getCookieName());
    }

    /** 请求体过大 */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public Result<Void> handleMaxUpload(MaxUploadSizeExceededException e) {
        return Result.failed(ResultCode.PAYLOAD_TOO_LARGE, "上传文件超过大小限制");
    }

    // ══════════ ④ HTTP 方法/媒体类型异常（405/415/406）══════════

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public Result<Void> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        return Result.failed(405, "不支持的请求方法 " + e.getMethod()
                + "，允许的方法: " + Arrays.toString(e.getSupportedMethods()));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public Result<Void> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException e) {
        return Result.failed(415, "不支持的 Content-Type: " + e.getContentType());
    }

    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    public Result<Void> handleMediaTypeNotAcceptable(HttpMediaTypeNotAcceptableException e) {
        return Result.failed(406, "无法生成客户端可接受的响应格式");
    }

    // ══════════ ⑤ 认证与授权（401/403）══════════

    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public Result<Void> handleAuthentication(AuthenticationException e) {
        log.warn("认证失败: {}", e.getMessage());
        return Result.failed(ResultCode.UNAUTHORIZED, "认证失败，请重新登录");
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public Result<Void> handleAccessDenied(AccessDeniedException e) {
        log.warn("权限不足: user={}, msg={}", currentUser(), e.getMessage());
        return Result.failed(ResultCode.FORBIDDEN, "权限不足，无法访问该资源");
    }

    // ══════════ ⑥ 数据库异常（★ 转换为用户友好的提示）══════════

    @ExceptionHandler(DuplicateKeyException.class)
    public Result<Void> handleDuplicateKey(DuplicateKeyException e) {
        log.warn("唯一键冲突: {}", extractKeyInfo(e));
        return Result.failed(ResultCode.DATA_CONFLICT, "数据已存在，请勿重复提交");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public Result<Void> handleDataIntegrity(DataIntegrityViolationException e) {
        log.error("数据完整性约束冲突", e);
        return Result.failed(ResultCode.DATA_CONFLICT, "数据不符合约束要求（字段过长/非空/外键）");
    }

    @ExceptionHandler(CannotGetJdbcConnectionException.class)
    public Result<Void> handleNoConnection(CannotGetJdbcConnectionException e) {
        log.error("无法获取数据库连接", e);                  // ★ 严重故障，ERROR + 告警
        alertService.sendCritical("数据库连接池耗尽");
        return Result.failed(ResultCode.SYSTEM_ERROR, "系统繁忙，请稍后重试");
    }

    @ExceptionHandler(DeadlockLoserDataAccessException.class)
    public Result<Void> handleDeadlock(DeadlockLoserDataAccessException e) {
        log.warn("数据库死锁，将重试", e);
        return Result.failed(ResultCode.SYSTEM_BUSY, "系统繁忙，请重试");
    }

    @ExceptionHandler(DataAccessException.class)
    public Result<Void> handleDataAccess(DataAccessException e) {
        log.error("数据库操作异常", e);                       // ★ 打完整栈
        return Result.failed(ResultCode.DB_ERROR, "数据操作失败");
    }

    // ══════════ ⑦ 第三方/远程调用异常 ══════════

    @ExceptionHandler(FeignException.class)
    public Result<Void> handleFeign(FeignException e) {
        log.error("远程服务调用失败: status={}, url={}", e.status(),
                e.request() != null ? e.request().url() : "-", e);
        alertService.send("远程服务调用失败");
        return Result.failed(ResultCode.THIRD_PARTY_ERROR, "依赖服务异常，请稍后重试");
        // ★ 绝不把 e.contentUTF8() 返回给前端（可能泄漏内部信息）
    }

    @ExceptionHandler(ResourceAccessException.class)
    public Result<Void> handleResourceAccess(ResourceAccessException e) {
        log.error("网络访问失败（超时/连接拒绝）", e);
        return Result.failed(ResultCode.THIRD_PARTY_TIMEOUT, "网络超时，请稍后重试");
    }

    // ══════════ ⑧ 常见运行时异常 ══════════

    @ExceptionHandler(NullPointerException.class)
    public Result<Void> handleNPE(NullPointerException e) {
        log.error("空指针异常", e);                            // ★ NPE 是 Bug，ERROR 级别
        return Result.failed(ResultCode.SYSTEM_ERROR, "系统内部错误");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public Result<Void> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("非法参数: {}", e.getMessage());
        return Result.failed(ResultCode.VALIDATE_FAILED, e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public Result<Void> handleIllegalState(IllegalStateException e) {
        log.warn("非法状态: {}", e.getMessage());
        return Result.failed(ResultCode.STATE_ILLEGAL, e.getMessage());
    }

    @ExceptionHandler(ArithmeticException.class)
    public Result<Void> handleArithmetic(ArithmeticException e) {
        log.error("算术异常", e);
        return Result.failed(ResultCode.SYSTEM_ERROR, "计算错误");
    }

    @ExceptionHandler(ClassCastException.class)
    public Result<Void> handleClassCast(ClassCastException e) {
        log.error("类型转换异常", e);
        return Result.failed(ResultCode.SYSTEM_ERROR, "系统内部错误");
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Result<Void> handleNoHandler(NoHandlerFoundException e) {
        return Result.failed(ResultCode.NOT_FOUND, "接口不存在: " + e.getRequestURL());
    }
    // ⚠️ 需要配置才能抛出此异常：
    // spring.mvc.throw-exception-if-no-handler-found=true
    // spring.web.resources.add-mappings=false

    // ══════════ ⑨ ★ 兜底：所有未捕获的异常 ══════════
    @ExceptionHandler(Throwable.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<Void> handleThrowable(Throwable e, HttpServletRequest request) {
        // ★★ 必须打完整栈（含 traceId、URI、参数，便于排查）
        log.error("★★ 未预期的系统异常 uri={} method={} user={} traceId={}",
                request.getRequestURI(), request.getMethod(), currentUser(), TraceContext.get(), e);
        // ★ 触发告警
        alertService.sendCritical("系统异常: " + e.getClass().getSimpleName());
        // ★ 绝不把内部异常信息返回给前端（安全风险：泄漏技术栈、SQL、路径）
        return Result.failed(ResultCode.SYSTEM_ERROR, "系统繁忙，请稍后重试（错误码："
                + TraceContext.get() + "）");      // 返回 traceId 便于用户报障时定位
    }

    private String currentUser() {
        LoginUser u = UserContext.get();
        return u == null ? "anonymous" : u.getUsername();
    }
}
```

**统一响应结构与错误码：**

```java
// ─── 统一响应体 ───
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> implements Serializable {
    /** 0=成功，其他=业务错误码 */
    private Integer code;
    private String message;
    private T data;
    private Long timestamp;
    /** ★ 链路追踪 ID（排查问题的关键） */
    private String traceId;

    public static <T> Result<T> success() { return build(0, "success", null); }
    public static <T> Result<T> success(T data) { return build(0, "success", data); }
    public static <T> Result<T> success(String msg, T data) { return build(0, msg, data); }

    public static <T> Result<T> failed(String msg) { return build(500, msg, null); }
    public static <T> Result<T> failed(ResultCode rc) { return build(rc.getCode(), rc.getMessage(), null); }
    public static <T> Result<T> failed(ResultCode rc, String msg) { return build(rc.getCode(), msg, null); }
    public static <T> Result<T> failed(Integer code, String msg) { return build(code, msg, null); }

    private static <T> Result<T> build(Integer code, String msg, T data) {
        return new Result<>(code, msg, data, System.currentTimeMillis(), TraceContext.get());
    }

    public boolean isSuccess() { return code != null && code == 0; }
}

// ─── 错误码枚举（★ 分段设计，便于定位问题来源）───
@Getter
@AllArgsConstructor
public enum ResultCode {

    // 0 成功
    SUCCESS(0, "操作成功"),

    // 4xxxx 客户端错误
    VALIDATE_FAILED(40000, "参数校验失败"),
    UNAUTHORIZED(40100, "未登录或登录已过期"),
    TOKEN_EXPIRED(40101, "登录已过期，请重新登录"),
    TOKEN_INVALID(40102, "无效的令牌"),
    FORBIDDEN(40300, "权限不足"),
    NOT_FOUND(40400, "资源不存在"),
    METHOD_NOT_ALLOWED(40500, "请求方法不支持"),
    PAYLOAD_TOO_LARGE(41300, "请求体过大"),
    TOO_MANY_REQUESTS(42900, "请求过于频繁，请稍后重试"),

    // 2xxxx 业务错误（按模块分段）
    USER_NOT_FOUND(20001, "用户不存在"),
    USER_ALREADY_EXISTS(20002, "用户已存在"),
    PASSWORD_ERROR(20003, "密码错误"),
    ACCOUNT_LOCKED(20004, "账号已锁定"),
    ACCOUNT_DISABLED(20005, "账号已禁用"),

    ORDER_NOT_FOUND(21001, "订单不存在"),
    ORDER_STATUS_ILLEGAL(21002, "订单状态不允许此操作"),
    ORDER_ALREADY_PAID(21003, "订单已支付"),
    ORDER_EXPIRED(21004, "订单已过期"),

    STOCK_NOT_ENOUGH(22001, "库存不足"),
    STOCK_DEDUCT_FAILED(22002, "库存扣减失败"),

    PAY_FAILED(23001, "支付失败"),
    REFUND_FAILED(23002, "退款失败"),

    DATA_CONFLICT(29001, "数据冲突"),
    STATE_ILLEGAL(29002, "状态不合法"),
    LOCK_FAILED(29003, "操作冲突，请稍后重试"),

    // 3xxxx 第三方错误
    THIRD_PARTY_ERROR(30001, "第三方服务异常"),
    THIRD_PARTY_TIMEOUT(30002, "第三方服务超时"),

    // 5xxxx 系统错误
    SYSTEM_ERROR(50000, "系统繁忙，请稍后重试"),
    SYSTEM_BUSY(50001, "系统繁忙"),
    DB_ERROR(50002, "数据库异常"),
    CACHE_ERROR(50003, "缓存异常"),
    MQ_ERROR(50004, "消息队列异常");

    private final Integer code;
    private final String message;
}
```

```java
// ─── @ControllerAdvice 的作用范围控制 ───
@RestControllerAdvice(
    basePackages = "com.example.controller",              // ★ 只处理指定包下的 Controller
    // basePackageClasses = UserController.class,         // 或指定类所在的包
    // assignableTypes = {BaseController.class},           // 或指定类型（含子类）
    // annotations = RestController.class                 // 或指定带某注解的类
)
public class ApiExceptionHandler { }

// 可以有多个 Advice，用 @Order 控制优先级
@RestControllerAdvice @Order(1)     // ★ 先执行（更具体的异常处理）
public class ApiExceptionHandler { }

@RestControllerAdvice @Order(100)   // 后执行（兜底）
public class GlobalExceptionHandler { }

// ⚠️ 注意：@ControllerAdvice 【不能】捕获 Filter 中抛出的异常！
//   Filter 在 DispatcherServlet 之前执行，异常直接抛给容器
//   解决：Filter 内自己 try-catch 写响应，或配置 ErrorController
@Component
public class CustomErrorController implements ErrorController {
    @RequestMapping("/error")
    public Result<Void> handleError(HttpServletRequest request) {
        Integer status = (Integer) request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        String message = (String) request.getAttribute(RequestDispatcher.ERROR_MESSAGE);
        log.error("请求错误: status={}, uri={}, msg={}", status, request.getRequestURI(), message);
        return Result.failed(status != null ? status : 500, StringUtils.hasText(message) ? message : "请求错误");
    }
}
```

## 6. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `@RequestBody` 用于 GET 请求 | 语义不规范，部分客户端不支持 | GET 用 `@RequestParam` 或查询对象 |
| 2 | JSON 请求用 `@RequestParam` | 参数为 null | JSON 必须用 `@RequestBody` |
| 3 | 表单请求用 `@RequestBody` | `HttpMediaTypeNotSupportedException` | 表单用 `@RequestParam`/`@ModelAttribute` |
| 4 | 一个方法用两个 `@RequestBody` | 第二个读不到（流只能读一次） | 只能有一个 `@RequestBody` |
| 5 | `@RequestParam` 接嵌套对象 | 绑定失败 | 用 `obj.field` 形式的参数名 |
| 6 | `@PathVariable` 变量名不匹配 | 400 或 null | 显式 `@PathVariable("id")`，或编译加 `-parameters` |
| 7 | `/users/{id}` 与 `/users/list` 冲突 | list 被当成 id | 用正则 `{id:\\d+}`，或精确路径优先 |
| 8 | Long 类型 ID 前端精度丢失 | 末几位变 0 | Jackson 的 `ToStringSerializer` |
| 9 | `@Valid` 忘记加 | 校验完全不生效 | 检查注解 |
| 10 | `@Validated` 校验单个参数不生效 | 无校验 | ★ 必须在**类**上加 `@Validated` |
| 11 | 三种校验异常只处理了一种 | 部分校验错误返回 500 | 全局处理器覆盖三种异常 |
| 12 | 使用 groups 后无 groups 的注解失效 | 校验漏掉 | 自定义分组 `extends Default` |
| 13 | 嵌套对象未加 `@Valid` | 嵌套字段不校验 | `@Valid private AddressDTO address;` |
| 14 | `BindingResult` 参数位置错 | 校验异常仍抛出 | ★ 必须紧跟在被校验参数之后 |
| 15 | `@DateTimeFormat` 期望作用于 JSON | 日期格式无效 | JSON 用 `@JsonFormat` |
| 16 | 文件上传默认 1MB 限制 | `MaxUploadSizeExceededException` | 配 `spring.servlet.multipart.max-file-size` |
| 17 | Nginx 的上传限制 | 413 | `client_max_body_size` |
| 18 | 临时上传目录被清理 | 上传突然失败 | 显式配 `multipart.location` |
| 19 | `file.getBytes()` 大文件 | OOM | 用 `getInputStream()` 或 `transferTo()` |
| 20 | 拦截器未放行 OPTIONS | 前端 CORS 报错 | `CorsUtils.isPreFlightRequest` 判断 |
| 21 | 拦截器 `preHandle` 返回 false 无响应 | 前端拿到空 body | 手动写 JSON 响应 |
| 22 | ThreadLocal 未在 `afterCompletion` 清理 | 数据串号 + 内存泄漏 | ★ finally 中 clear |
| 23 | 异步请求用 `afterCompletion` | 不被调用 | 用 `afterConcurrentHandlingStarted` |
| 24 | `@ControllerAdvice` 期望捕获 Filter 异常 | 捕获不到 | Filter 在 DispatcherServlet 之前，需自行处理或配 ErrorController |
| 25 | 全局异常返回了内部细节 | 安全风险（泄漏 SQL/路径） | 对外返回通用消息，详情只记日志 |
| 26 | `handleThrowable` 未打完整栈 | 无法排查 | `log.error("msg", e)`（e 作为最后一个参数） |
| 27 | 404 未走全局异常处理 | 返回容器默认错误页 | `throw-exception-if-no-handler-found=true` + `add-mappings=false` |
| 28 | 枚举参数转换失败 | 400 但提示不友好 | 自定义 ConverterFactory 或用 code 接收 |
| 29 | 日期时区错误 | 差 8 小时 | `@JsonFormat(timezone="GMT+8")` + 全局配置 |
| 30 | `@Validated` 分组与 `@Valid` 混用 | 行为不符预期 | 统一用 `@Validated`（支持分组） |

---

## 关联笔记

- 上一篇：[[后端/Spring/SpringMVC入门与执行流程]]
- 下一篇：[[后端/Spring/SSM整合实战]]
- 相关：[[后端/Java基础/异常处理]]（异常体系与全局处理理念）、[[后端/JavaWeb/Filter-Listener与会话管理]]（Filter vs Interceptor）
- 实战：[[后端/SpringBoot/整合Web开发]]（统一响应、Knife4j、跨域完整配置）
- 安全：[[后端/JavaWeb/JWT认证与Web安全]]（认证拦截器、XSS 防护）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
