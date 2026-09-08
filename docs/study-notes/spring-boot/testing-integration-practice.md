---
title: "测试与常用整合实战"
aliases:
  - "SpringBoot 测试"
  - "JUnit5"
  - "MockMvc"
  - "整合实战"
tags:
  - "后端"
  - "java"
  - "spring"
  - "springboot"
  - "测试"
category: "后端"
folder: "SpringBoot"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/SpringBoot/SpringBoot入门与项目搭建]]"
  - "[[后端/SpringBoot/整合Web开发]]"
  - "[[后端/中间件/Redis在Java项目中的整合]]"
  - "[[后端/消息队列/RocketMQ]]"
created: 2026-09-07
updated: 2026-09-07
---

# Spring Boot 测试与常用整合实战

## 1. 测试体系与选型 ★★★★★

### 1.1 测试金字塔

```
              /\
             /  \        ★ E2E 测试（少量，慢，脆弱）
            / E2E\          Selenium / Playwright / 真实 HTTP 全链路
           /──────\
          /  集成   \      ★ 集成测试（适量）
         /   测试    \        @SpringBootTest + Testcontainers + MockMvc
        /────────────\
       /              \    ★★ 单元测试（大量，快，稳定）
      /    单元测试      \      JUnit 5 + Mockito（不启动 Spring 容器）
     /                  \
    /────────────────────\

比例建议：单元测试 70% / 集成测试 20% / E2E 10%
```

| 测试类型 | 速度 | 依赖 | 覆盖 | Spring Boot 注解 |
| --- | --- | --- | --- | --- |
| **单元测试** | ★ **毫秒级** | 无（全 Mock） | 单个类/方法 | ❌ 不用 Spring（`@ExtendWith(MockitoExtension.class)`） |
| **切片测试** | 秒级 | 部分容器 | 某一层 | `@WebMvcTest`、`@DataJpaTest`、`@MybatisTest`、`@JsonTest` |
| **集成测试** | ★ 十秒级 | 完整容器 + 真实中间件 | 多层协作 | `@SpringBootTest` |
| **E2E** | 分钟级 | 完整系统 | 用户流程 | `RANDOM_PORT` + `TestRestTemplate` |

### 1.2 JUnit 5 + Mockito 基础

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<!-- 包含：JUnit 5 (Jupiter) + Mockito + AssertJ + Hamcrest + JSONassert + Spring Test + JsonPath -->
<!-- 如需 Testcontainers -->
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>mysql</artifactId>
    <scope>test</scope>
</dependency>
```

```java
/**
 * ★ 单元测试（不启动 Spring 容器，毫秒级）
 */
@ExtendWith(MockitoExtension.class)                     // ★ JUnit 5 的 Mockito 扩展
@DisplayName("订单服务单元测试")
class OrderServiceTest {

    @Mock                                               // ★ 创建 Mock 对象
    private OrderMapper orderMapper;
    @Mock
    private StockService stockService;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks                                        // ★ 把上面的 Mock 注入到被测对象
    private OrderServiceImpl orderService;

    @Captor                                             // ★ 捕获传入 Mock 的参数
    private ArgumentCaptor<Order> orderCaptor;

    private OrderCreateDTO dto;

    @BeforeEach                                          // ★ 每个测试方法前执行
    void setUp() {
        dto = OrderCreateDTO.builder()
                .userId(1001L).skuId(2001L).quantity(2)
                .amount(new BigDecimal("199.00"))
                .build();
    }

    @AfterEach void tearDown() { }
    @BeforeAll static void beforeAll() { }               // ★ 必须是 static
    @AfterAll static void afterAll() { }

    // ═══════ ① 正常流程 ═══════
    @Test
    @DisplayName("下单成功：库存充足时应创建订单并发布事件")
    void shouldCreateOrderWhenStockEnough() {
        // ─── Arrange（准备）───
        given(stockService.checkAndDeduct(2001L, 2)).willReturn(true);
        given(orderMapper.insert(any(Order.class))).willAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(9001L);                              // 模拟主键回填
            return 1;
        });

        // ─── Act（执行）───
        Long orderId = orderService.create(dto);

        // ─── Assert（断言）───
        assertThat(orderId).isEqualTo(9001L);

        // ★ 验证交互
        then(stockService).should().checkAndDeduct(2001L, 2);
        then(orderMapper).should().insert(orderCaptor.capture());
        Order saved = orderCaptor.getValue();
        assertThat(saved.getUserId()).isEqualTo(1001L);
        assertThat(saved.getAmount()).isEqualByComparingTo("199.00");
        assertThat(saved.getStatus()).isEqualTo(OrderStatus.PENDING);

        // ★ 验证事件发布
        then(eventPublisher).should().publishEvent(any(OrderCreatedEvent.class));
    }

    // ═══════ ② 异常流程 ═══════
    @Test
    @DisplayName("库存不足时应抛异常且不落库")
    void shouldThrowWhenStockNotEnough() {
        given(stockService.checkAndDeduct(anyLong(), anyInt())).willReturn(false);

        // ★ 断言异常
        assertThatThrownBy(() -> orderService.create(dto))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("库存不足")
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ResultCode.STOCK_NOT_ENOUGH.getCode());

        // ★ 验证【没有】落库、没有发事件
        then(orderMapper).should(never()).insert(any());
        then(eventPublisher).should(never()).publishEvent(any());
    }

    @Test
    @DisplayName("参数为 null 时应抛 IllegalArgumentException")
    void shouldThrowWhenDtoIsNull() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> orderService.create(null))
                .withMessageContaining("参数不能为空");
    }

    // ═══════ ③ 边界与参数化 ═══════
    @ParameterizedTest(name = "数量 {0} 时应{1}")
    @CsvSource({
        "0,   抛出异常",
        "-1,  抛出异常",
        "1,   正常",
        "999, 正常",
        "1000, 抛出异常"
    })
    void shouldValidateQuantity(int quantity, String expected) {
        dto.setQuantity(quantity);
        if ("抛出异常".equals(expected)) {
            assertThatThrownBy(() -> orderService.create(dto))
                    .isInstanceOf(BusinessException.class);
        }
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 5, 10, 99})                // 单值列表
    void shouldHandleVariousQuantities(int qty) {
        dto.setQuantity(qty);
        given(stockService.checkAndDeduct(anyLong(), eq(qty))).willReturn(true);
        assertThatCode(() -> orderService.create(dto)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @MethodSource("provideInvalidDtos")                      // 复杂对象
    void shouldRejectInvalidDto(OrderCreateDTO invalidDto) {
        assertThatThrownBy(() -> orderService.create(invalidDto))
                .isInstanceOf(BusinessException.class);
    }
    static Stream<Arguments> provideInvalidDtos() {
        return Stream.of(
            Arguments.of(OrderCreateDTO.builder().userId(null).build()),
            Arguments.of(OrderCreateDTO.builder().userId(1L).skuId(null).build()),
            Arguments.of(OrderCreateDTO.builder().userId(1L).skuId(2L).amount(BigDecimal.valueOf(-1)).build())
        );
    }

    @RepeatedTest(5)                                          // 重复执行（测并发/随机性）
    void shouldBeIdempotent() { }

    @Test
    @Timeout(value = 2, unit = TimeUnit.SECONDS)               // ★ 超时控制
    void shouldCompleteWithinTimeout() { }

    @Test
    @Disabled("待实现，见 JIRA-1234")                           // 跳过
    void notImplementedYet() { }

    // ═══════ ④ 嵌套测试（★ 组织结构更清晰）═══
    @Nested
    @DisplayName("create() 方法")
    class CreateOrderTests {
        @Nested
        @DisplayName("参数校验")
        class Validation {
            @Test void shouldRejectNullUserId() { }
            @Test void shouldRejectNegativeAmount() { }
        }
        @Nested
        @DisplayName("业务逻辑")
        class BusinessLogic {
            @Test void shouldDeductStock() { }
            @Test void shouldPublishEvent() { }
        }
    }
}
```

**Mockito 常用 API 速查：**

```java
// ─── 创建 Mock ───
@Mock private UserDao userDao;                        // ★ 完全模拟（所有方法返回默认值）
@Spy private UserDao realDao = new UserDaoImpl();      // ★ 部分模拟（默认调真实方法）
@Mock(answer = Answers.RETURNS_DEEP_STUBS)             // ★ 深度 Mock（链式调用）
    private ChainService chainService;
@Captor private ArgumentCaptor<Order> captor;           // ★ 参数捕获
@InjectMocks private OrderServiceImpl service;           // ★ 注入 Mock

// ─── 打桩（Stubbing）───
when(userDao.selectById(1L)).thenReturn(user);           // 传统写法
given(userDao.selectById(1L)).willReturn(user);          // ★ BDD 风格（推荐）
given(userDao.selectById(anyLong())).willReturn(user);    // 任意参数
given(userDao.selectById(eq(1L))).willReturn(user);       // 精确匹配
given(userDao.selectById(argThat(u -> u.getId() > 0))).willReturn(user);  // Lambda 匹配
given(userDao.insert(any())).willAnswer(inv -> {          // ★ 动态返回（能操作参数）
    Order o = inv.getArgument(0);
    o.setId(1L);
    return 1;
});
given(userDao.selectById(1L)).willThrow(new RuntimeException());   // 抛异常
given(userDao.selectById(anyLong()))
    .willReturn(user1)                                     // ★ 多次调用返回不同值
    .willReturn(user2)
    .willThrow(new RuntimeException());
willDoNothing().given(mockService).voidMethod();            // void 方法
doThrow(new RuntimeException()).when(mockService).voidMethod();   // ★ void 抛异常必须用 doThrow
doAnswer(inv -> null).when(spyDao).selectById(1L);          // ★ Spy 上打桩必须用 doXxx

// ─── 参数匹配器 ───
any()  anyLong()  anyString()  anyInt()  anyList()  anyMap()
any(Order.class)                                          // ★ 带类型的 any（不匹配 null）
isNull()  notNull()  isA(Order.class)
eq(value)                                                  // ★ 精确值（混用匹配器时必须全部用匹配器）
argThat(arg -> arg.getId() > 0)                            // ★ Lambda
contains("x")  startsWith("pre")  matches("\\d+")           // 字符串匹配
additionalMatchers.and(...)                                 // 组合

// ─── 验证（Verification）───
verify(userDao).selectById(1L);                             // 验证调用了 1 次（默认）
verify(userDao, times(3)).selectById(anyLong());             // ★ 恰好 3 次
verify(userDao, never()).deleteById(anyLong());              // ★ 从未调用
verify(userDao, atLeastOnce()).selectById(anyLong());        // 至少 1 次
verify(userDao, atLeast(2)).selectById(anyLong());
verify(userDao, atMost(5)).selectById(anyLong());
verify(userDao, timeout(1000)).selectById(1L);                // ★ 1 秒内被调用（异步场景）
verifyNoInteractions(userDao);                                // ★ 完全没交互
verifyNoMoreInteractions(userDao);                            // 没有其他未验证的交互

// ─── 参数捕获（★ 验证传入的具体内容）───
verify(userDao).insert(captor.capture());
Order saved = captor.getValue();
assertThat(saved.getStatus()).isEqualTo(OrderStatus.PENDING);

// 捕获多次调用
verify(userDao, times(3)).insert(captor.capture());
List<Order> all = captor.getAllValues();

// ─── ★ BDDMockito（更可读，推荐）───
import static org.mockito.BDDMockito.*;
given(userDao.selectById(1L)).willReturn(user);        // = when(...).thenReturn(...)
then(userDao).should().selectById(1L);                  // = verify(userDao).selectById(1L)
then(userDao).should(times(2)).insert(any());
then(userDao).shouldHaveNoMoreInteractions();
willThrow(new RuntimeException()).given(userDao).insert(any());
```

**AssertJ 流式断言（★ 比 JUnit 原生强大得多）：**

```java
import static org.assertj.core.api.Assertions.*;

// ─── 基本 ───
assertThat(result).isNotNull();
assertThat(name).isEqualTo("Tom").isNotBlank().startsWith("T").hasSize(3);
assertThat(age).isEqualTo(20).isGreaterThan(18).isBetween(18, 60).isPositive();
assertThat(amount).isEqualByComparingTo("199.00");       // ★ BigDecimal 比较（忽略 scale）
assertThat(flag).isTrue();
assertThat(list).isEmpty();

// ─── 集合（★ 强大）───
assertThat(users)
    .isNotNull()
    .hasSize(3)
    .doesNotContain(userX)
    .containsExactly(user1, user2, user3)                 // ★ 顺序敏感
    .containsExactlyInAnyOrder(user3, user1, user2)        // ★ 顺序无关
    .contains(user1, user2)
    .doesNotHaveDuplicates()
    .isSortedAccordingTo(Comparator.comparing(User::getId))
    .allMatch(u -> u.getStatus() == 1)                     // ★ 全部满足
    .anyMatch(u -> u.getAge() > 30)                        // 任一满足
    .noneMatch(u -> u.getName() == null)
    .extracting(User::getName)                              // ★ 提取字段后断言
        .containsExactly("Tom", "Jerry", "Spike")
    .extracting("id", "name")                               // 多字段（返回 Tuple）
    .filteredOn(u -> u.getAge() > 18)                       // ★ 过滤后断言
        .hasSize(2)
    .flatExtracting(User::getRoles)                          // 展开嵌套集合
        .hasSize(5);

// ─── Map ───
assertThat(map)
    .hasSize(3)
    .containsKeys("a", "b")
    .containsValues(1, 2)
    .containsEntry("a", 1)
    .doesNotContainKey("c");

// ─── 异常 ───
assertThatThrownBy(() -> service.doWork())
    .isInstanceOf(BusinessException.class)
    .hasMessage("订单不存在")
    .hasMessageContaining("不存在")
    .hasMessageMatching(".*不存在.*")
    .hasCauseInstanceOf(SQLException.class)
    .hasNoCause()
    .hasStackTraceContaining("OrderService")
    .extracting("code").isEqualTo(21001);

assertThatExceptionOfType(BusinessException.class)
    .isThrownBy(() -> service.doWork())
    .withMessage("xxx");
assertThatCode(() -> service.doWork()).doesNotThrowAnyException();
assertThatNullPointerException().isThrownBy(() -> obj.method());

// ─── 字符串 ───
assertThat(json)
    .isEqualToIgnoringWhitespace("{\"a\":1}")
    .contains("\"code\":0")
    .matches("\\{.*\\}");

// ─── 时间 ───
assertThat(date)
    .isAfter(LocalDate.of(2020, 1, 1))
    .isBefore(LocalDate.now())
    .isCloseTo(LocalDateTime.now(), within(1, ChronoUnit.MINUTES));

// ─── 文件 / IO ───
assertThat(new File("x.txt")).exists().isFile().canRead();
assertThat(inputStream).hasContent("expected");

// ─── Optional ───
assertThat(optional).isPresent().contains(user);
assertThat(optional).isEmpty();

// ─── 软断言（★ 一次报告所有失败，而非遇错即停）───
SoftAssertions.assertSoftly(softly -> {
    softly.assertThat(user.getName()).isEqualTo("Tom");
    softly.assertThat(user.getAge()).isEqualTo(20);
    softly.assertThat(user.getStatus()).isEqualTo(1);
});
// 或
SoftAssertions softly = new SoftAssertions();
softly.assertThat(...);
softly.assertAll();                                         // ★ 必须调用

// ─── JSON 断言（JSONassert）───
JSONAssert.assertEquals("{\"code\":0,\"data\":{\"id\":1}}", actualJson,
        JSONCompareMode.LENIENT);                           // 忽略字段顺序和额外字段
```

## 2. Spring Boot 测试注解 ★★★★★

### 2.1 @SpringBootTest（完整集成测试）

```java
/**
 * ★ 完整集成测试（启动整个 Spring 容器）
 */
@SpringBootTest(
    classes = MallApplication.class,                          // 指定启动类（可选）
    webEnvironment = SpringBootTest.WebEnvironment.MOCK,       // ★ 见下表
    args = {"--server.port=0", "--custom.arg=1"},              // 启动参数
    properties = {                                              // ★ 覆盖配置属性
        "spring.profiles.active=test",
        "mall.order.pay-timeout=1m",
        "logging.level.com.example=DEBUG"
    }
)
@ActiveProfiles("test")                                         // ★ 激活 test profile
@TestPropertySource(locations = "classpath:test.properties")     // 额外的属性文件
@AutoConfigureMockMvc                                            // ★ 自动配置 MockMvc
@Transactional                                                    // ★ 每个测试后自动回滚
@Sql(scripts = {"/sql/schema.sql", "/sql/data.sql"},              // ★ 测试前执行 SQL
     executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)  // 测试后重置容器（慎用，慢）
@Import(TestConfig.class)                                          // ★ 导入测试专用配置
@DisplayName("订单模块集成测试")
class OrderIntegrationTest {

    @Autowired private OrderService orderService;
    @Autowired private OrderMapper orderMapper;
    @Autowired private MockMvc mockMvc;                           // ★ Mock MVC
    @Autowired private ObjectMapper objectMapper;
    @Autowired private DataSource dataSource;

    @MockBean private SmsClient smsClient;                         // ★★ 用 Mock 替换容器中的真实 Bean
    @SpyBean private CacheService cacheService;                    // ★ 包装真实 Bean（可部分 Mock）

    @BeforeEach
    void setUp() {
        given(smsClient.send(any())).willReturn(SmsResponse.success());
    }

    @Test
    void shouldCreateOrder() {
        Order order = orderService.create(buildDto());
        assertThat(order.getId()).isNotNull();
        // ★ @Transactional 会自动回滚，不污染数据库
    }

    // ═══ 内部配置类（★ 只影响测试）═══
    @TestConfiguration
    static class TestConfig {
        @Bean
        public Clock testClock() {
            return Clock.fixed(Instant.parse("2026-09-07T10:00:00Z"), ZoneId.of("Asia/Shanghai"));
        }                                                // ★ 固定时钟（时间相关的测试必备）
    }
}
```

**webEnvironment 的四种模式：**

| 模式 | 说明 | 适用 |
| --- | --- | --- |
| **`MOCK`**（默认） | ★ Mock 的 Servlet 环境，**不启动真实 Web 服务器**，配合 MockMvc | ★ 大多数 Web 测试 |
| `RANDOM_PORT` | ★ 启动真实服务器（内嵌 Tomcat），**随机端口** | E2E 测试、测试 Filter/拦截器 |
| `DEFINED_PORT` | 启动真实服务器，用配置的端口 | 少用（端口冲突） |
| `NONE` | 不启动 Web 环境 | 纯 Service/DAO 测试 |

```java
// ─── RANDOM_PORT + TestRestTemplate（★ 真实 HTTP 调用）───
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class E2ETest {

    @LocalServerPort                                    // ★ 注入实际的随机端口
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;               // ★ 已配好 baseUrl 的 RestTemplate

    @Test
    void shouldReturnUser() {
        ResponseEntity<Result<UserVO>> resp = restTemplate.exchange(
                "/api/v1/users/{id}", HttpMethod.GET,
                new HttpEntity<>(headersWithToken()),
                new ParameterizedTypeReference<>() {}, 1L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().getData().getUserName()).isEqualTo("张三");
    }

    @Test
    void shouldUploadFile() {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource("content".getBytes()) {
            @Override public String getFilename() { return "test.txt"; }
        });
        ResponseEntity<String> resp = restTemplate.postForEntity("/api/upload", body, String.class);
        assertThat(resp.getStatusCode()).is2xxSuccessful();
    }
}

// ─── 或用 WebTestClient（★ 支持响应式，Boot 2.4+ 也能测 Servlet）───
@SpringBootTest(webEnvironment = RANDOM_PORT)
@AutoConfigureWebTestClient
class WebTestClientTest {
    @Autowired private WebTestClient client;

    @Test
    void shouldReturnUser() {
        client.get().uri("/api/v1/users/1")
              .header("Authorization", "Bearer " + token)
              .exchange()
              .expectStatus().isOk()
              .expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_JSON)
              .expectBody()
              .jsonPath("$.code").isEqualTo(0)
              .jsonPath("$.data.userName").isEqualTo("张三")
              .jsonPath("$.data.createTime").isNotEmpty();
    }
}
```

### 2.2 切片测试（★ 快，只加载需要的部分）

```java
// ═══ ① @WebMvcTest：只测 Controller 层（★ 不加载 Service/DAO）═══
@WebMvcTest(UserController.class)                        // ★ 只加载指定 Controller
@AutoConfigureMockMvc(addFilters = false)                 // ★ 关闭 Spring Security 的 Filter（简化测试）
@Import(GlobalExceptionHandler.class)                     // ★ 需要手动导入依赖的配置
@ActiveProfiles("test")
class UserControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private UserService userService;             // ★★ Service 必须 Mock（未被加载）

    @Test
    @DisplayName("查询用户详情 - 成功")
    void shouldReturnUser() throws Exception {
        // Arrange
        UserVO vo = UserVO.builder().id(1L).userName("张三").age(25).build();
        given(userService.getById(1L)).willReturn(vo);

        // Act + Assert
        mockMvc.perform(get("/api/v1/users/{id}", 1L)
                .header("Authorization", "Bearer test-token")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data.id").value(1))
            .andExpect(jsonPath("$.data.userName").value("张三"))
            .andExpect(jsonPath("$.data.age").value(25))
            .andExpect(jsonPath("$.timestamp").isNumber())
            .andExpect(jsonPath("$.data.password").doesNotExist())   // ★ 验证敏感字段未泄漏
            .andDo(print());                                          // ★ 打印请求响应（调试用）

        then(userService).should().getById(1L);
    }

    @Test
    @DisplayName("创建用户 - 参数校验失败")
    void shouldRejectInvalidUsername() throws Exception {
        UserCreateDTO dto = new UserCreateDTO();
        dto.setUsername("a");                                 // 太短
        dto.setPassword("123");                               // 太短

        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(40000))
            .andExpect(jsonPath("$.message").value(containsString("用户名")))
            .andExpect(jsonPath("$.data.username").exists());   // ★ 字段级错误

        then(userService).should(never()).create(any());       // ★ 校验失败不应调 Service
    }

    @Test
    @DisplayName("查询不存在的用户 - 返回业务错误码")
    void shouldReturn404WhenNotFound() throws Exception {
        given(userService.getById(999L))
            .willThrow(new BusinessException(ResultCode.USER_NOT_FOUND));

        mockMvc.perform(get("/api/v1/users/{id}", 999L))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(20001))
            .andExpect(jsonPath("$.message").value(containsString("不存在")));
    }

    @Test
    @DisplayName("分页查询 - 参数绑定")
    void shouldBindPaginationParams() throws Exception {
        given(userService.page(any())).willReturn(PageResult.empty(1, 20));

        mockMvc.perform(get("/api/v1/users")
                .param("pageNum", "1")
                .param("pageSize", "20")
                .param("keyword", "张")
                .param("status", "1"))
            .andExpect(status().isOk());

        // ★ 捕获并验证 Service 收到的参数
        ArgumentCaptor<UserQuery> captor = ArgumentCaptor.forClass(UserQuery.class);
        then(userService).should().page(captor.capture());
        assertThat(captor.getValue().getKeyword()).isEqualTo("张");
        assertThat(captor.getValue().getPageSize()).isEqualTo(20);
    }

    @Test
    @DisplayName("文件上传")
    void shouldUploadFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",                                      // ★ 表单字段名
                "test.txt",                                   // 原始文件名
                MediaType.TEXT_PLAIN_VALUE,                   // Content-Type
                "文件内容".getBytes(StandardCharsets.UTF_8));   // 内容

        mockMvc.perform(multipart("/api/v1/files/upload")
                .file(file)
                .param("bizType", "avatar")
                .flashAttr("user", loginUser))                // ★ Flash 属性
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.url").isNotEmpty());
    }
}
```

```java
// ═══ ② @MybatisTest / @DataJpaTest：只测数据访问层 ═══
@MybatisTest                                              // 需 mybatis-spring-boot-starter-test
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)   // ★ 用真实数据库（默认用内嵌 H2）
@Transactional                                             // ★ 自动回滚
class UserMapperTest {

    @Autowired private UserMapper userMapper;
    @Autowired private SqlSessionFactory sqlSessionFactory;

    @Test
    void shouldSelectById() {
        User user = userMapper.selectById(1L);
        assertThat(user).isNotNull();
        assertThat(user.getUserName()).isEqualTo("张三");
    }

    @Test
    void shouldInsertAndReturnId() {
        User user = new User();
        user.setUserName("test_" + System.currentTimeMillis());
        user.setAge(25);
        int rows = userMapper.insert(user);
        assertThat(rows).isEqualTo(1);
        assertThat(user.getId()).isNotNull();              // ★ 主键回填
    }

    @Test
    void shouldHandleDynamicSql() {
        UserQuery query = new UserQuery();
        query.setStatus(1);
        // 不传其他条件 → 验证动态 SQL 的正确性
        List<User> list = userMapper.selectByQuery(query);
        assertThat(list).allMatch(u -> u.getStatus() == 1);
    }

    @Test
    void shouldBatchInsert() {
        List<User> users = IntStream.range(0, 100)
                .mapToObj(i -> buildUser("batch_" + i))
                .toList();
        int rows = userMapper.batchInsert(users);
        assertThat(rows).isEqualTo(100);
    }
}

// JPA 版本
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
class UserRepositoryTest {
    @Autowired private UserRepository repository;
    @Autowired private TestEntityManager em;                // ★ 测试专用的 EntityManager

    @Test
    void shouldFindByName() {
        em.persistAndFlush(new User("张三"));                // ★ 直接插入测试数据
        assertThat(repository.findByUserName("张三")).isPresent();
    }
}

// ═══ ③ @JsonTest：只测 JSON 序列化 ═══
@JsonTest
class UserVOJsonTest {
    @Autowired private JacksonTester<UserVO> json;          // ★ 类型安全的 JSON 测试器

    @Test
    void shouldSerializeCorrectly() throws Exception {
        UserVO vo = UserVO.builder().id(1L).userName("张三")
                .createTime(LocalDateTime.of(2026, 9, 7, 10, 30, 0)).build();

        // ★ 验证 JSON 结构
        assertThat(json.write(vo))
            .hasJsonPathNumberValue("@.id")
            .extractingJsonPathStringValue("@.userName").isEqualTo("张三")
            .extractingJsonPathStringValue("@.createTime").isEqualTo("2026-09-07 10:30:00")
            .doesNotHaveJsonPath("@.password")                // ★ 敏感字段不输出
            .isLenientlyEqualTo("{\"id\":\"1\",\"userName\":\"张三\",\"createTime\":\"2026-09-07 10:30:00\"}");

        // ★ 验证 Long → String（防精度丢失）
        assertThat(json.write(vo)).extractingJsonPathStringValue("@.id").isEqualTo("1");
    }

    @Test
    void shouldDeserialize() throws Exception {
        String content = "{\"id\":1,\"userName\":\"张三\"}";
        UserVO vo = json.parseObject(content);
        assertThat(vo.getUserName()).isEqualTo("张三");
    }
}

// ═══ ④ @RestClientTest：只测 RestTemplate / RestClient ═══
@RestClientTest(ThirdPartyClient.class)
class ThirdPartyClientTest {
    @Autowired private ThirdPartyClient client;
    @Autowired private MockRestServiceServer server;         // ★ Mock 远程服务

    @Test
    void shouldCallRemoteApi() {
        server.expect(requestTo("https://api.example.com/users/1"))
              .andExpect(method(HttpMethod.GET))
              .andExpect(header("Authorization", "Bearer xxx"))
              .andRespond(withSuccess("{\"id\":1,\"name\":\"Tom\"}", MediaType.APPLICATION_JSON));

        UserDTO user = client.getUser(1L);
        assertThat(user.getName()).isEqualTo("Tom");
        server.verify();                                     // ★ 验证所有期望都被满足
    }

    @Test
    void shouldHandleServerError() {
        server.expect(any()).andRespond(withServerError());
        assertThatThrownBy(() -> client.getUser(1L))
            .isInstanceOf(RemoteCallException.class);
    }

    @Test
    void shouldHandleTimeout() {
        server.expect(any()).andRespond(request -> {
            Thread.sleep(5000);                              // 模拟超时
            throw new SocketTimeoutException();
        });
    }
}

// ═══ ⑤ @DataRedisTest / @DataMongoTest 等 ═══
@DataRedisTest                                              // 用内嵌 Redis（embedded-redis）
class UserCacheTest {
    @Autowired private StringRedisTemplate redisTemplate;
    @Test void shouldCacheUser() { }
}
```

### 2.3 MockMvc 完整 API

```java
// ─── 构建请求 ───
mockMvc.perform(
    get("/api/users/{id}", 1L)                            // GET + 路径变量
        .param("page", "1")                                // ★ 查询参数
        .param("ids", "1", "2", "3")                        // ★ 多值参数
        .header("Authorization", "Bearer " + token)          // 请求头
        .contentType(MediaType.APPLICATION_JSON)              // Content-Type
        .accept(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(dto))        // ★ 请求体
        .characterEncoding("UTF-8")
        .cookie(new Cookie("JSESSIONID", "xxx"))
        .sessionAttr("loginUser", loginUser)                  // ★ Session 属性
        .flashAttr("message", "保存成功")                       // ★ Flash 属性
        .principal(() -> "testuser")                           // ★ 认证主体
        .with(user("admin").roles("ADMIN"))                     // ★ Spring Security 模拟用户
        .with(csrf())                                            // ★ CSRF Token
        .with(httpBasic("user", "pass"))
        .with(request -> { request.setAttribute("traceId", "abc"); return request; })   // 自定义
);

// 其他 HTTP 方法
post("/api/users")  put("/api/users/{id}", 1L)  delete("/api/users/{id}", 1L)
patch("/api/users/{id}", 1L)  options("/api/users")  head("/api/users")
request("CUSTOM_METHOD", uri("/api/x"))                        // 自定义方法
asyncDispatch(mvcResult)                                        // ★ 异步请求的第二步

// multipart（文件上传）
multipart("/api/upload").file(mockFile).file(mockFile2)
// PUT 方式的 multipart（需要包装）
MockHttpServletRequestBuilder builder = multipart("/api/upload").file(f);
builder.with(request -> { request.setMethod("PUT"); return request; });

// ─── 断言（★ 可链式，全部要满足）───
.andExpect(status().isOk())                                  // 200
.andExpect(status().isCreated())                              // 201
.andExpect(status().isNotFound())                             // 404
.andExpect(status().is4xxClientError())                       // 4xx
.andExpect(status().is5xxServerError())
.andExpect(status().is(HttpStatus.TOO_MANY_REQUESTS))

.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
.andExpect(content().string(containsString("success")))        // ★ 响应体字符串
.andExpect(content().json("{\"code\":0}", JSONCompareMode.LENIENT))
.andExpect(content().encoding("UTF-8"))
.andExpect(content().bytes(expectedBytes))

// ★★ JsonPath（断言 JSON 结构，最常用）
.andExpect(jsonPath("$.code").value(0))
.andExpect(jsonPath("$.code").isNumber())
.andExpect(jsonPath("$.message").value("success"))
.andExpect(jsonPath("$.data").exists())
.andExpect(jsonPath("$.data").isMap())
.andExpect(jsonPath("$.data.id").value(1))
.andExpect(jsonPath("$.data.items").isArray())
.andExpect(jsonPath("$.data.items.length()").value(10))         // ★ 数组长度
.andExpect(jsonPath("$.data.items[0].name").value("商品A"))       // ★ 数组元素
.andExpect(jsonPath("$.data.items[?(@.price > 100)]").isArray())  // ★ JsonPath 过滤
.andExpect(jsonPath("$.data.total").value(greaterThan(0)))        // ★ Hamcrest 匹配器
.andExpect(jsonPath("$.data.password").doesNotExist())            // ★ 字段不存在
.andExpect(jsonPath("$.data.createTime").value(matchesPattern("\\d{4}-\\d{2}-\\d{2} .*")))

// 视图相关（前后端不分离时）
.andExpect(view().name("user/list"))
.andExpect(model().attribute("users", hasSize(10)))
.andExpect(model().attributeExists("users"))
.andExpect(model().attributeDoesNotExist("error"))
.andExpect(model().hasNoErrors())
.andExpect(model().attributeHasFieldErrors("user", "username"))   // ★ 校验错误

// 重定向与转发
.andExpect(redirectedUrl("/users/1"))
.andExpect(redirectedUrlPattern("/users/*"))
.andExpect(forwardedUrl("/WEB-INF/views/user.jsp"))

// Header / Cookie
.andExpect(header().string("X-Trace-Id", notNullValue()))
.andExpect(header().string("Location", "http://localhost/users/1"))
.andExpect(header().doesNotExist("Set-Cookie"))
.andExpect(cookie().value("SESSION", notNullValue()))
.andExpect(cookie().maxAge("SESSION", 1800))
.andExpect(cookie().httpOnly("SESSION", true))

// 异步
.andExpect(request().asyncStarted())
.andExpect(request().asyncResult(notNullValue()))

// ─── 获取结果（做更复杂的断言）───
MvcResult result = mockMvc.perform(get("/api/users/1"))
    .andExpect(status().isOk())
    .andReturn();

String body = result.getResponse().getContentAsString();        // ★ 响应体
String contentType = result.getResponse().getContentType();
int status = result.getResponse().getStatus();
Map<String, Object> model = result.getModelAndView().getModel();
Object asyncResult = result.getAsyncResult();
// ★ 反序列化后断言（复杂结构时比 JsonPath 更好用）
Result<PageResult<UserVO>> parsed = objectMapper.readValue(body,
        new TypeReference<Result<PageResult<UserVO>>>() {});
assertThat(parsed.getData().getRecords()).hasSize(10);

// ─── 调试输出 ───
.andDo(print())                                                  // ★ 打印完整的请求和响应
.andDo(MockMvcResultHandlers.log())
```

### 2.4 Testcontainers（★ 用真实中间件测试）

```java
/**
 * ★★ Testcontainers：用 Docker 启动【真实的】MySQL/Redis/Kafka 做集成测试
 * 优势：测试环境与生产一致，避免 H2 与 MySQL 的 SQL 方言差异导致的「测试通过但生产失败」
 */
@SpringBootTest
@Testcontainers                                              // ★ 生命周期管理
@ActiveProfiles("test")
@Transactional
class OrderRepositoryIntegrationTest {

    /** ★ MySQL 容器（所有测试共享，static 提升性能） */
    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0")
            .withDatabaseName("mall_test")
            .withUsername("test")
            .withPassword("test")
            .withInitScripts("sql/schema.sql", "sql/data.sql")   // ★ 初始化脚本
            .withUrlParam("useUnicode", "true")
            .withUrlParam("characterEncoding", "utf8")
            .withUrlParam("serverTimezone", "Asia/Shanghai")
            .withCommand("--character-set-server=utf8mb4",
                         "--max_connections=500")                 // ★ MySQL 启动参数
            .withReuse(true);                                     // ★ 复用容器（★ 大幅提速）

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7.2-alpine")
            .withExposedPorts(6379)
            .withCommand("redis-server", "--appendonly", "yes");

    @DynamicPropertySource                                       // ★★ 动态注入容器地址到 Spring 配置
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    @Autowired private OrderMapper orderMapper;
    @Autowired private StringRedisTemplate redisTemplate;

    @Test
    void shouldQueryFromRealMySQL() {
        // ★ 能测试 MySQL 特有的语法（H2 不支持的 JSON 函数、FIND_IN_SET 等）
        List<Order> orders = orderMapper.selectWithJsonExtract("status");
        assertThat(orders).isNotEmpty();
    }

    @Test
    void shouldUseRealRedis() {
        redisTemplate.opsForValue().set("test:key", "value", Duration.ofMinutes(1));
        assertThat(redisTemplate.opsForValue().get("test:key")).isEqualTo("value");
        // ★ 能测试 Lua 脚本、Redis 事务、Pipeline 等 H2/内嵌 Redis 不支持的特性
    }
}

// ─── 全局共享容器（★ 进一步优化：整个测试套件只启动一次）───
public abstract class AbstractIntegrationTest {

    static final MySQLContainer<?> MYSQL;
    static final GenericContainer<?> REDIS;
    static final KafkaContainer KAFKA;

    static {
        MYSQL = new MySQLContainer<>("mysql:8.0")
                .withDatabaseName("mall_test")
                .withUsername("test").withPassword("test")
                .withInitScripts("sql/schema.sql");
        MYSQL.start();                                          // ★ 静态块启动，JVM 退出时销毁

        REDIS = new GenericContainer<>("redis:7.2-alpine").withExposedPorts(6379);
        REDIS.start();

        KAFKA = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));
        KAFKA.start();

        // ★ 注册 JVM 关闭钩子
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            MYSQL.stop(); REDIS.stop(); KAFKA.stop();
        }));
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("spring.kafka.bootstrap-servers", KAFKA::getBootstrapServers);
    }
}
```

```properties
# ~/.testcontainers.properties（★ 开启容器复用，大幅提速）
testcontainers.reuse.enable=true
```

### 2.5 测试数据与事务

```java
// ─── @Sql：测试数据准备 ───
@SpringBootTest
@Transactional
class UserServiceTest {

    @Sql(scripts = "/sql/clean.sql",                              // ★ 执行顺序
         executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
    @Sql("/sql/init-users.sql")
    @Sql(scripts = "/sql/verify.sql",
         executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
    @Test
    void shouldQueryUsers() { }

    @Sql(statements = {                                            // ★ 内联 SQL
        "DELETE FROM t_order",
        "INSERT INTO t_user (id, user_name) VALUES (999, 'test')"
    })
    @Test
    void shouldHandleSpecialCase() { }

    @SqlGroup({                                                     // ★ 分组
        @Sql("/sql/a.sql"),
        @Sql("/sql/b.sql")
    })
    @Test void grouped() { }
}
```

```sql
-- src/test/resources/sql/init-users.sql
DELETE FROM t_user;
INSERT INTO t_user (id, user_name, age, status, dept_id, create_time) VALUES
(1, '张三', 25, 1, 10, '2026-01-01 10:00:00'),
(2, '李四', 30, 1, 10, '2026-01-02 10:00:00'),
(3, '王五', 35, 0, 20, '2026-01-03 10:00:00');
```

```java
// ─── 事务与回滚 ───
@SpringBootTest
@Transactional                                    // ★ 默认每个测试后【回滚】
class OrderTest {

    @Test
    @Rollback(false)                               // ★ 不回滚（保留数据便于人工检查）
    @Commit                                         // 等价于 @Rollback(false)
    void shouldKeepData() { }

    @Test
    void shouldTestTransactionalBehavior() {
        // ★ 问题：测试类上的 @Transactional 会让【被测代码的事务】合并到测试事务中！
        //   → 无法测试「事务回滚」的行为（因为整个测试是一个大事务）
        orderService.create(dto);                   // 这个 @Transactional 加入了测试事务
        // 解决：用 Propagation.NOT_SUPPORTED 让被测方法脱离测试事务
    }
}

/** ★ 测试事务行为的正确姿势 */
@SpringBootTest
class TransactionBehaviorTest {                    // ★ 不加 @Transactional

    @Autowired private OrderService orderService;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update("DELETE FROM t_order WHERE order_no LIKE 'TEST_%'");   // 手动清理
    }

    @Test
    @DisplayName("异常时应回滚所有操作")
    void shouldRollbackOnException() {
        long before = countOrders();

        assertThatThrownBy(() -> orderService.createWithFailure(buildDto()))
            .isInstanceOf(RuntimeException.class);

        // ★ 验证数据未落库（这才是真正的回滚测试）
        assertThat(countOrders()).isEqualTo(before);
    }

    @Test
    @DisplayName("REQUIRES_NEW 的子事务应独立提交")
    void shouldCommitNestedTransaction() {
        orderService.createWithIndependentLog(buildDto());   // 主事务回滚，日志事务提交
        assertThat(jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM t_order_log WHERE biz_no LIKE 'TEST_%'", Long.class))
            .isEqualTo(1);                                   // ★ 日志保留了
    }

    private long countOrders() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM t_order", Long.class);
    }
}
```

## 3. 常用整合实战 ★★★★★

### 3.1 整合 Redis（缓存 + 分布式锁）

```java
@Configuration
@EnableCaching
public class RedisConfig {

    /** ★ RedisTemplate 序列化配置（解决默认 JDK 序列化的乱码问题） */
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // ★ Key 用 String 序列化（redis-cli 可读）
        StringRedisSerializer keySerializer = new StringRedisSerializer();
        template.setKeySerializer(keySerializer);
        template.setHashKeySerializer(keySerializer);

        // ★ Value 用 JSON 序列化（可读、跨语言、体积小）
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        // ★★ 保留类型信息（反序列化时能还原为原始类型）
        mapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY);
        GenericJackson2JsonRedisSerializer valueSerializer =
                new GenericJackson2JsonRedisSerializer(mapper);

        template.setValueSerializer(valueSerializer);
        template.setHashValueSerializer(valueSerializer);
        template.afterPropertiesSet();
        return template;
    }

    /** ★ Spring Cache 的 CacheManager（多级 TTL） */
    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(30))
                .disableCachingNullValues()                          // 不缓存 null（防穿透需另设策略）
                .computePrefixWith(name -> "mall:cache:" + name + ":")
                .serializeKeysWith(SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(SerializationPair.fromSerializer(
                        new GenericJackson2JsonRedisSerializer()));

        Map<String, RedisCacheConfiguration> configs = new HashMap<>();
        configs.put("dict", defaultConfig.entryTtl(Duration.ofHours(24)));       // 字典：1 天
        configs.put("user", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        configs.put("product", defaultConfig.entryTtl(Duration.ofMinutes(10)));
        configs.put("hotProduct", defaultConfig.entryTtl(Duration.ofMinutes(5))  // ★ 热点数据短 TTL
                .enableStatistics());                                              // 开启命中率统计

        return RedisCacheManager.builder(factory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(configs)
                .transactionAware()                              // ★ 事务提交后才写缓存
                .enableStatistics()
                .build();
    }
}

// ─── Redisson（★ 分布式锁）───
@Configuration
public class RedissonConfig {
    @Bean(destroyMethod = "shutdown")
    public RedissonClient redissonClient(RedisProperties props) {
        Config config = new Config();
        if (props.getSentinel() != null) {
            config.useSentinelServers()
                  .setMasterName(props.getSentinel().getMaster())
                  .addSentinelAddress(props.getSentinel().getNodes().stream()
                          .map(n -> "redis://" + n).toArray(String[]::new))
                  .setPassword(props.getPassword())
                  .setReadMode(ReadMode.SLAVE);
        } else if (props.getCluster() != null) {
            config.useClusterServers()
                  .addNodeAddress(props.getCluster().getNodes().stream()
                          .map(n -> "redis://" + n).toArray(String[]::new))
                  .setPassword(props.getPassword());
        } else {
            config.useSingleServer()
                  .setAddress("redis://" + props.getHost() + ":" + props.getPort())
                  .setPassword(props.getPassword())
                  .setDatabase(props.getDatabase())
                  .setConnectionPoolSize(64)
                  .setConnectionMinimumIdleSize(16)
                  .setTimeout((int) props.getTimeout().toMillis())
                  .setRetryAttempts(3)
                  .setRetryInterval(1500);
        }
        config.setCodec(new JsonJacksonCodec());                 // ★ JSON 编解码（可读）
        return Redisson.create(config);
    }
}
```

```java
/**
 * ★ 分布式锁工具（Redisson 封装）
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DistributedLockService {

    private final RedissonClient redisson;

    /**
     * ★ 带锁执行（自动加锁解锁，业务代码零侵入）
     */
    public <T> T executeWithLock(String lockKey, Duration waitTime, Duration leaseTime,
                                 Supplier<T> action) {
        RLock lock = redisson.getLock(lockKey);
        boolean locked = false;
        try {
            locked = lock.tryLock(waitTime.toMillis(), leaseTime.toMillis(), TimeUnit.MILLISECONDS);
            if (!locked) {
                throw new BusinessException(ResultCode.LOCK_FAILED, "操作太频繁，请稍后重试");
            }
            log.debug("获取锁成功: {}", lockKey);
            return action.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("获取锁被中断", e);
        } finally {
            // ★★ 必须判断 isHeldByCurrentThread（否则解锁别人的锁会抛异常）
            if (locked && lock.isHeldByCurrentThread()) {
                try {
                    lock.unlock();
                    log.debug("释放锁: {}", lockKey);
                } catch (Exception e) {
                    log.error("释放锁失败: {}", lockKey, e);
                }
            }
        }
    }

    public void executeWithLock(String key, Duration wait, Duration lease, Runnable action) {
        executeWithLock(key, wait, lease, () -> { action.run(); return null; });
    }

    /** ★ 幂等控制：同一业务标识只处理一次 */
    public boolean tryAcquireIdempotent(String bizKey, Duration expire) {
        RBucket<String> bucket = redisson.getBucket("idempotent:" + bizKey);
        return bucket.setIfAbsent("1", expire);                   // SETNX + TTL
    }

    /** ★ 限流器（令牌桶） */
    public boolean tryAcquire(String key, int rate, RateIntervalUnit unit) {
        RRateLimiter limiter = redisson.getRateLimiter("rate:" + key);
        limiter.trySetRate(RateType.OVERALL, rate, 1, unit);
        return limiter.tryAcquire(1);
    }

    /** ★ 延迟队列（订单超时关闭） */
    public void delay(String queueName, Object value, Duration delay) {
        RBlockingQueue<Object> queue = redisson.getBlockingQueue(queueName);
        RDelayedQueue<Object> delayedQueue = redisson.getDelayedQueue(queue);
        delayedQueue.offer(value, delay.toMillis(), TimeUnit.MILLISECONDS);
    }
    public Object takeDelay(String queueName, Duration timeout) throws InterruptedException {
        RBlockingQueue<Object> queue = redisson.getBlockingQueue(queueName);
        return queue.poll(timeout.toMillis(), TimeUnit.MILLISECONDS);
    }
}

// ─── 使用 ───
@Service
@RequiredArgsConstructor
public class StockService {
    private final DistributedLockService lockService;

    public void deduct(Long skuId, int quantity) {
        lockService.executeWithLock(
            "stock:sku:" + skuId,                                 // ★ 锁粒度到 SKU
            Duration.ofSeconds(3),                                 // 最多等 3 秒
            Duration.ofSeconds(10),                                // 锁自动释放（防死锁）
            () -> {
                int remain = stockMapper.getStock(skuId);
                if (remain < quantity) throw new BusinessException("库存不足");
                stockMapper.deduct(skuId, quantity);
                return null;
            });
    }
}
```

### 3.2 整合 RocketMQ / Kafka

```java
// ─── RocketMQ 生产者 ───
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderEventPublisher {

    private final RocketMQTemplate rocketMQTemplate;

    /** ★ 普通消息 */
    public void sendOrderCreated(OrderCreatedEvent event) {
        SendResult result = rocketMQTemplate.syncSend(
                "order-topic:created",                             // topic:tag
                MessageBuilder.withPayload(event)
                        .setHeader(RocketMQHeaders.KEYS, event.getOrderNo())   // ★ 业务 key（便于查询）
                        .setHeader("traceId", TraceContext.getTraceId())       // ★ 链路透传
                        .build());
        log.info("发送订单创建消息: msgId={}, status={}", result.getMsgId(), result.getSendStatus());
        if (result.getSendStatus() != SendStatus.SEND_OK) {
            throw new BusinessException("消息发送失败");
        }
    }

    /** ★ 顺序消息（同一订单的操作必须有序） */
    public void sendOrderStatusChange(Long orderId, OrderStatus status) {
        rocketMQTemplate.syncSendOrderly("order-topic:status",
                MessageBuilder.withPayload(status).build(),
                String.valueOf(orderId));                          // ★ hashKey：同 orderId 进同一队列
    }

    /** ★ 延迟消息（订单 30 分钟未支付自动关闭） */
    public void sendDelayClose(String orderNo, Duration delay) {
        // RocketMQ 的延迟级别：1s 5s 10s 30s 1m 2m 3m 4m 5m 6m 7m 8m 9m 10m 20m 30m 1h 2h
        int level = delayToLevel(delay);
        rocketMQTemplate.syncSend("order-topic:delay-close",
                MessageBuilder.withPayload(orderNo).build(), 3000, level);
    }

    /** ★★ 事务消息（保证「本地事务」与「发消息」的原子性） */
    public void sendTransactionMessage(OrderCreatedEvent event) {
        rocketMQTemplate.sendMessageInTransaction(
                "order-tx-topic",
                MessageBuilder.withPayload(event)
                        .setHeader(RocketMQHeaders.TRANSACTION_ID, event.getOrderNo())
                        .build(),
                event);                                             // arg：传给 executeLocalTransaction
    }
}

// ─── RocketMQ 事务监听器 ───
@RocketMQTransactionListener
@RequiredArgsConstructor
@Slf4j
public class OrderTransactionListener implements RocketMQLocalTransactionListener {

    private final OrderService orderService;
    private final OrderMapper orderMapper;

    /** ★ 执行本地事务 */
    @Override
    public RocketMQLocalTransactionState executeLocalTransaction(Message msg, Object arg) {
        OrderCreatedEvent event = (OrderCreatedEvent) arg;
        try {
            // 本地事务（创建订单）
            orderService.createInTransaction(event);
            log.info("本地事务执行成功，提交消息: orderNo={}", event.getOrderNo());
            return RocketMQLocalTransactionState.COMMIT;
        } catch (Exception e) {
            log.error("本地事务失败，回滚消息: orderNo={}", event.getOrderNo(), e);
            return RocketMQLocalTransactionState.ROLLBACK;
        }
    }

    /** ★ 事务回查（Broker 未收到确认时调用，★ 必须实现幂等） */
    @Override
    public RocketMQLocalTransactionState checkLocalTransaction(Message msg) {
        String orderNo = (String) msg.getHeaders().get(RocketMQHeaders.TRANSACTION_ID);
        Order order = orderMapper.selectByOrderNo(orderNo);
        if (order == null) {
            log.info("事务回查：订单不存在，回滚 orderNo={}", orderNo);
            return RocketMQLocalTransactionState.ROLLBACK;
        }
        log.info("事务回查：订单已存在，提交 orderNo={}", orderNo);
        return RocketMQLocalTransactionState.COMMIT;
    }
}

// ─── RocketMQ 消费者（★ 幂等是核心）───
@Component
@RocketMQMessageListener(
    topic = "order-topic",
    selectorExpression = "created || status",                    // ★ tag 过滤
    consumerGroup = "order-consumer-group",                       // ★ 消费组（同组内负载均衡）
    messageModel = MessageModel.CLUSTERING,                       // 集群消费（默认）
    consumeMode = ConsumeMode.CONCURRENT,                          // 并发消费
    consumeThreadMax = 64,
    maxReconsumeTimes = 5,                                         // ★ 最大重试次数
    consumeTimeout = 15                                            // 分钟
)
@RequiredArgsConstructor
@Slf4j
public class OrderMessageConsumer implements RocketMQListener<OrderMessage> {

    private final IdempotentService idempotentService;
    private final OrderHandler orderHandler;

    @Override
    public void onMessage(OrderMessage message) {
        String msgId = message.getMsgId();
        log.info("收到订单消息: msgId={}, orderNo={}", msgId, message.getOrderNo());

        // ★★ 幂等检查（MQ 保证「至少一次」，消费端必须去重）
        if (!idempotentService.tryAcquire("order:msg:" + msgId, Duration.ofDays(7))) {
            log.warn("消息已处理过，跳过: msgId={}", msgId);
            return;                                                // ★ 直接返回（不抛异常，避免重试）
        }

        try {
            orderHandler.handle(message);
        } catch (BusinessException e) {
            // ★ 业务异常（不可恢复）→ 不重试，记录到死信表人工处理
            log.error("消息处理业务失败，不再重试: {}", e.getMessage());
            idempotentService.release("order:msg:" + msgId);        // 释放幂等标记（便于人工重放）
            deadLetterService.save(message, e.getMessage());
        } catch (Exception e) {
            // ★ 系统异常（可恢复）→ 释放幂等标记并抛出，触发 MQ 重试
            idempotentService.release("order:msg:" + msgId);
            log.error("消息处理失败，将重试: msgId={}", msgId, e);
            throw e;                                                // ★★ 抛异常才会重试
        }
    }
}
```

```yaml
# RocketMQ 配置
rocketmq:
  name-server: ${ROCKETMQ_NAMESRV:127.0.0.1:9876}
  producer:
    group: mall-producer-group                     # ★ 生产者组
    send-message-timeout: 3000                      # 发送超时
    retry-times-when-send-failed: 2                 # ★ 同步发送失败重试
    retry-times-when-send-async-failed: 2
    retry-next-delay: 100
    max-message-size: 4194304                        # 消息最大 4MB
    compress-message-body-threshold: 4096            # 超过 4KB 压缩
    access-key: ${ROCKETMQ_AK:}
    secret-key: ${ROCKETMQ_SK:}
    enable-msg-trace: true                           # ★ 消息轨迹（排查问题）
    customized-trace-topic: RMQ_SYS_TRACE_TOPIC
  consumer:
    pull-batch-size: 32
```

### 3.3 整合定时任务

```java
// ─── Spring 原生 @Scheduled（★ 单机场景）───
@Configuration
@EnableScheduling
public class ScheduleConfig implements SchedulingConfigurer {

    /** ★ 配置线程池（默认单线程！所有任务串行，一个卡住全卡） */
    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.setScheduler(taskScheduler());
    }

    @Bean(destroyMethod = "shutdown")
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10);                                     // ★ 10 个线程
        scheduler.setThreadNamePrefix("scheduled-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true);             // ★ 优雅停机
        scheduler.setAwaitTerminationSeconds(60);
        scheduler.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        scheduler.setErrorHandler(t ->
            log.error("定时任务执行异常", t));                            // ★ 全局异常处理
        return scheduler;
    }
}

@Component
@Slf4j
@RequiredArgsConstructor
public class OrderScheduledTasks {

    private final OrderService orderService;
    private final DistributedLockService lockService;

    /** ★ 每 5 分钟关闭超时未支付的订单 */
    @Scheduled(cron = "0 */5 * * * ?", zone = "Asia/Shanghai")
    public void closeExpiredOrders() {
        // ★★ 多实例部署时【必须】加分布式锁，否则任务被重复执行！
        lockService.executeWithLock("task:closeExpiredOrders",
            Duration.ZERO,                                          // 不等待（拿不到锁说明别的实例在跑）
            Duration.ofMinutes(10),
            () -> {
                long start = System.currentTimeMillis();
                int count = orderService.closeExpiredOrders();
                log.info("关闭超时订单任务完成: 处理 {} 笔, 耗时 {}ms",
                        count, System.currentTimeMillis() - start);
                return null;
            });
    }

    /** ★ 固定延迟（上次结束后 30 秒再执行） */
    @Scheduled(fixedDelay = 30_000, initialDelay = 60_000)
    public void syncProductStock() { }

    /** ★ 固定频率（每 1 分钟，不管上次是否结束） */
    @Scheduled(fixedRate = 60_000)
    public void refreshCache() { }

    /** ★ 每天凌晨 2 点（低峰期） */
    @Scheduled(cron = "0 0 2 * * ?")
    public void dailyStatistics() { }

    /** ★ 从配置读取 cron */
    @Scheduled(cron = "${task.report.cron:0 0 8 * * MON}")
    public void weeklyReport() { }
}
```

> 【★ @Scheduled 的三大坑】
> 1. **默认单线程**：所有任务共用一个线程，一个任务卡住会导致其他任务全部延迟。**必须配置 `ThreadPoolTaskScheduler`**。
> 2. **多实例重复执行**：部署 3 个实例，任务会执行 3 次。**必须加分布式锁**，或用 XXL-JOB / Quartz 集群模式。
> 3. **异常导致任务停止**：`fixedRate`/`fixedDelay` 的任务抛未捕获异常后，**该任务会被取消**（不再调度）。必须在任务内 try-catch，或配置 `ErrorHandler`。
>
> 分布式任务调度见 [[后端/中间件/定时任务与分布式调度]]。

### 3.4 整合线程池

```java
@Configuration
@EnableAsync
@Slf4j
public class ThreadPoolConfig {

    /** ★ 业务异步任务的线程池 */
    @Bean("bizExecutor")
    public ThreadPoolTaskExecutor bizExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(Runtime.getRuntime().availableProcessors() * 2);
        executor.setMaxPoolSize(Runtime.getRuntime().availableProcessors() * 4);
        executor.setQueueCapacity(1000);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("biz-");
        // ★★ 拒绝策略：CallerRunsPolicy 让调用线程执行（天然限流，不丢任务）
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        // ★ 优雅停机
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        // ★★ 传递上下文（MDC traceId、用户信息）
        executor.setTaskDecorator(new ContextCopyingDecorator());
        executor.initialize();
        return executor;
    }

    /** ★ IO 密集型（远程调用、文件处理） */
    @Bean("ioExecutor")
    public ThreadPoolTaskExecutor ioExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(50);
        executor.setMaxPoolSize(200);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("io-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());   // ★ 抛异常（快速失败）
        executor.initialize();
        return executor;
    }

    /** ★ 通知类（可丢弃，非核心） */
    @Bean("notifyExecutor")
    public ThreadPoolTaskExecutor notifyExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(2000);
        executor.setThreadNamePrefix("notify-");
        // ★ DiscardOldestPolicy：队列满时丢弃最老的（通知类允许丢）
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardOldestPolicy());
        executor.initialize();
        return executor;
    }

    /** ★ 默认异步执行器（@Async 不指定名称时用） */
    @Bean
    @Primary
    public Executor defaultExecutor(@Qualifier("bizExecutor") ThreadPoolTaskExecutor executor) {
        return executor;
    }

    /** ★ 上下文传递装饰器 */
    public static class ContextCopyingDecorator implements TaskDecorator {
        @Override
        public Runnable decorate(Runnable runnable) {
            // 主线程的上下文
            Map<String, String> mdc = MDC.getCopyOfContextMap();
            LoginUser user = UserContext.get();
            RequestAttributes attrs = RequestContextHolder.getRequestAttributes();

            return () -> {
                try {
                    if (mdc != null) MDC.setContextMap(mdc);          // ★ traceId
                    if (user != null) UserContext.set(user);          // ★ 用户信息
                    if (attrs != null) RequestContextHolder.setRequestAttributes(attrs);
                    runnable.run();
                } finally {
                    MDC.clear();                                      // ★★ 必须清理（线程池复用）
                    UserContext.clear();
                    RequestContextHolder.resetRequestAttributes();
                }
            };
        }
    }
}

// ─── 使用 ───
@Service
@RequiredArgsConstructor
public class NotifyService {

    /** ★ 指定线程池 */
    @Async("notifyExecutor")
    public CompletableFuture<Void> sendSmsAsync(String mobile, String content) {
        log.info("异步发短信: {} (线程: {})", mobile, Thread.currentThread().getName());
        smsClient.send(mobile, content);
        return CompletableFuture.completedFuture(null);
    }

    /** ★ 事务提交后再异步执行（★★ 最佳实践） */
    @Async("bizExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderCreated(OrderCreatedEvent event) {
        sendSmsAsync(event.getMobile(), "下单成功");
        pushService.push(event.getUserId(), "订单已创建");
        pointsService.addPoints(event.getUserId(), event.getAmount());
    }
}

// ─── 并行调用多个远程服务（★ 显著降低接口耗时）───
@Service
public class UserDetailService {

    public UserDetailVO getDetail(Long userId) {
        // 三个查询并行
        CompletableFuture<UserVO> userFuture =
            CompletableFuture.supplyAsync(() -> userService.get(userId), bizExecutor);
        CompletableFuture<List<OrderVO>> orderFuture =
            CompletableFuture.supplyAsync(() -> orderService.listByUser(userId), bizExecutor);
        CompletableFuture<Integer> pointsFuture =
            CompletableFuture.supplyAsync(() -> pointService.getPoints(userId), bizExecutor);

        // ★ 全部完成（带超时）
        CompletableFuture.allOf(userFuture, orderFuture, pointsFuture)
                .orTimeout(3, TimeUnit.SECONDS)
                .exceptionally(ex -> {
                    log.error("并行查询超时或失败, userId={}", userId, ex);
                    return null;
                })
                .join();

        // ★ 降级处理（某个服务失败不影响整体）
        return UserDetailVO.builder()
                .user(getOrDefault(userFuture, null))
                .orders(getOrDefault(orderFuture, Collections.emptyList()))
                .points(getOrDefault(pointsFuture, 0))
                .build();
    }

    private <T> T getOrDefault(CompletableFuture<T> future, T defaultValue) {
        try {
            return future.isDone() && !future.isCompletedExceptionally()
                    ? future.getNow(defaultValue) : defaultValue;
        } catch (Exception e) { return defaultValue; }
    }
}
```

```yaml
# Spring Boot 内置的线程池配置（★ 优先用这个，无需自己写配置类）
spring:
  task:
    execution:                                  # ★ @Async 的默认执行器
      pool:
        core-size: 16
        max-size: 64
        queue-capacity: 1000
        keep-alive: 60s
        allow-core-thread-timeout: false
      thread-name-prefix: async-
      shutdown:
        await-termination: true                  # ★ 优雅停机
        await-termination-period: 60s
    scheduling:                                  # ★ @Scheduled 的执行器
      pool:
        size: 10                                  # ★ 默认 1，必须调大！
      thread-name-prefix: sched-
      shutdown:
        await-termination: true
        await-termination-period: 30s
```

## 4. 测试最佳实践与常见坑

### 4.1 测试规范

```java
// ─── ① 命名规范：should_期望行为_when_条件 ───
@Test void shouldThrowException_whenStockNotEnough() { }
@Test void shouldReturnEmptyList_whenNoDataFound() { }
@Test void shouldRetryThreeTimes_whenRemoteCallFails() { }
// 或用 @DisplayName 写中文（★ 团队友好）
@Test @DisplayName("库存不足时应抛出业务异常且不落库") void test1() { }

// ─── ② AAA 结构（Arrange-Act-Assert）───
@Test
void shouldCalculateDiscount() {
    // ─── Arrange：准备数据和 Mock ───
    Order order = buildOrder(1000);
    given(discountRuleService.getRules(any())).willReturn(List.of(vipRule));

    // ─── Act：执行被测方法 ───
    BigDecimal result = priceService.calculate(order);

    // ─── Assert：断言结果 + 验证交互 ───
    assertThat(result).isEqualByComparingTo("900.00");
    then(discountRuleService).should().getRules(order.getUserId());
}

// ─── ③ 一个测试只验证一个行为 ───
// ❌ 一个测试验证创建、查询、更新、删除
// ✅ 拆成四个测试方法

// ─── ④ 测试要独立（无顺序依赖）───
// ❌ test2 依赖 test1 创建的数据
// ✅ 每个测试自己准备数据（@BeforeEach / @Sql）

// ─── ⑤ 提取测试数据构建方法 ───
private static OrderCreateDTO buildDto() {
    return OrderCreateDTO.builder()
            .userId(1001L).skuId(2001L).quantity(1)
            .amount(new BigDecimal("100.00"))
            .address("测试地址")
            .build();
}
// 或用 Test Data Builder 模式 / 对象母体（Object Mother）
public class OrderFixtures {
    public static OrderCreateDTO.OrderCreateDTOBuilder aValidDto() {
        return OrderCreateDTO.builder().userId(1L).skuId(2L).quantity(1).amount(BigDecimal.TEN);
    }
}
// 使用：OrderFixtures.aValidDto().quantity(0).build()    ← ★ 只改要测的字段
```

### 4.2 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 单元测试用了 `@SpringBootTest` | ★ 每个测试启动容器，跑几分钟 | 用 `@ExtendWith(MockitoExtension.class)` |
| 2 | `@WebMvcTest` 未 Mock Service | `NoSuchBeanDefinitionException` | 加 `@MockBean` |
| 3 | `@MockBean` 与 `@Mock` 混淆 | Mock 不生效 | `@MockBean` 用于 Spring 容器，`@Mock` 用于纯 Mockito |
| 4 | 测试类加了 `@Transactional` 却要测事务回滚 | 回滚行为测不出来 | 测事务的类**不加** `@Transactional`，手动清理 |
| 5 | `@Transactional` 测试后数据没回滚 | 数据污染 | 检查是否有 `@Rollback(false)` 或 REQUIRES_NEW |
| 6 | 匹配器混用（部分 eq 部分裸值） | `InvalidUseOfMatchersException` | 要么全用匹配器，要么全用裸值 |
| 7 | `when(spy.method())` 调了真实方法 | 副作用/异常 | Spy 上用 `doReturn(x).when(spy).method()` |
| 8 | `verify` 时机不对（异步） | 验证失败 | `verify(mock, timeout(1000))` 或 awaitility |
| 9 | 异步方法测试不稳定 | 时而通过时而失败 | ★ 用 Awaitility 等待，不要 `Thread.sleep` |
| 10 | `@Async` 在测试中不生效 | 同步执行 | 测试配置中关闭异步，或用 `SyncTaskExecutor` |
| 11 | 测试依赖真实数据库/Redis | CI 环境跑不了 | Testcontainers 或内嵌数据库 |
| 12 | H2 与 MySQL 语法差异 | ★ 测试通过但生产报错 | 用 Testcontainers 跑真实 MySQL |
| 13 | 测试数据互相干扰 | 单独跑通过，一起跑失败 | 每个测试用唯一标识（UUID）+ 事务回滚 |
| 14 | `@DirtiesContext` 滥用 | 测试极慢 | 只在必须重置容器时用 |
| 15 | 静态方法/单例的 Mock | 无法 Mock | 用 `mockStatic`（Mockito 3.4+）或重构为可注入 |
| 16 | `final` 类/方法无法 Mock | Mock 失败 | 用 mockito-inline，或重构 |
| 17 | 时间相关的测试不稳定 | 跨天/跨时区失败 | ★ 注入 `Clock`，测试用固定时钟 |
| 18 | 随机数据导致偶发失败 | 难以复现 | 固定随机种子，或断言范围而非精确值 |
| 19 | 断言不完整 | 有 Bug 但测试通过 | 断言所有关键字段 + 验证交互次数 |
| 20 | 只测正常流程 | 异常路径有 Bug | ★ 必须覆盖异常、边界、空值 |
| 21 | 测试中 `Thread.sleep` | 慢且不稳定 | Awaitility 的 `await().atMost(...)` |
| 22 | 未验证「不该发生的调用」 | 逻辑错误未发现 | `verify(mock, never()).xxx()` / `verifyNoInteractions` |
| 23 | JsonPath 表达式写错 | 断言失效 | 用 `andDo(print())` 看实际响应 |
| 24 | 敏感字段泄漏未被测试发现 | 生产泄漏密码 | ★ 断言 `doesNotExist()` |
| 25 | Mock 了太多依赖 | 测试脆弱（重构就挂） | 只 Mock 外部依赖，核心逻辑用真实对象 |
| 26 | 测试覆盖率低 | Bug 多 | JaCoCo + CI 门禁（行覆盖 ≥ 70%） |

```java
// ─── 坑 9/21 的正确解法：Awaitility（★ 异步测试神器）───
@Test
void shouldCompleteAsyncTask() {
    service.startAsyncTask(taskId);

    // ★ 等待条件成立（最多 10 秒，每 100ms 检查一次）
    await().atMost(10, TimeUnit.SECONDS)
           .pollInterval(100, TimeUnit.MILLISECONDS)
           .pollDelay(200, TimeUnit.MILLISECONDS)
           .untilAsserted(() ->
               assertThat(taskRepository.getStatus(taskId)).isEqualTo(TaskStatus.COMPLETED));

    // 等待某个条件
    await().until(() -> queue.size() == 0);
    await().untilAtomic(counter, equalTo(100));
    await().until(fieldInObject(obj, "status"), equalTo("DONE"));

    // 超时应该抛 ConditionTimeoutException（而非测试挂死）
    assertThatThrownBy(() ->
        await().atMost(1, TimeUnit.SECONDS).until(() -> false))
        .isInstanceOf(ConditionTimeoutException.class);
}

// ─── 坑 17 的正确解法：注入 Clock ───
@Service
public class OrderService {
    private final Clock clock;                                    // ★ 注入时钟
    public OrderService(Clock clock) { this.clock = clock; }

    public boolean isExpired(Order order) {
        return LocalDateTime.now(clock).isAfter(order.getExpireTime());   // ★ 用 clock
    }
}
// 生产配置
@Bean @ConditionalOnMissingBean public Clock systemClock() { return Clock.systemDefaultZone(); }
// 测试配置（★ 固定时间，测试 100% 可复现）
@TestConfiguration
static class TestClockConfig {
    @Bean @Primary
    public Clock fixedClock() {
        return Clock.fixed(Instant.parse("2026-09-07T10:00:00Z"), ZoneId.of("Asia/Shanghai"));
    }
}
```

```xml
<!-- ─── 覆盖率报告（JaCoCo）─── -->
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.11</version>
    <executions>
        <execution>
            <id>prepare-agent</id>
            <goals><goal>prepare-agent</goal></goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>test</phase>
            <goals><goal>report</goal></goals>
        </execution>
        <!-- ★ CI 门禁：覆盖率不达标则构建失败 -->
        <execution>
            <id>check</id>
            <goals><goal>check</goal></goals>
            <configuration>
                <rules>
                    <rule>
                        <element>BUNDLE</element>
                        <limits>
                            <limit>
                                <counter>LINE</counter>
                                <value>COVEREDRATIO</value>
                                <minimum>0.70</minimum>              <!-- ★ 行覆盖率 70% -->
                            </limit>
                            <limit>
                                <counter>BRANCH</counter>
                                <value>COVEREDRATIO</value>
                                <minimum>0.60</minimum>              <!-- 分支覆盖率 60% -->
                            </limit>
                        </limits>
                        <excludes>
                            <exclude>com.example.**.entity.*</exclude>     <!-- 实体类不计 -->
                            <exclude>com.example.**.dto.*</exclude>
                            <exclude>com.example.**.vo.*</exclude>
                            <exclude>com.example.**.config.*</exclude>
                            <exclude>com.example.**.*Application</exclude>
                        </excludes>
                    </rule>
                </rules>
            </configuration>
        </execution>
    </executions>
</plugin>
<!-- 报告位置：target/site/jacoco/index.html -->
```

## 5. 关联笔记

- 上一篇：[[后端/SpringBoot/日志-Actuator与打包部署]]
- 相关：[[后端/SpringBoot/SpringBoot入门与项目搭建]]、[[后端/SpringBoot/整合Web开发]]、[[后端/SpringBoot/整合数据访问层]]
- 缓存：[[后端/中间件/Redis在Java项目中的整合]]、[[后端/数据库/Redis/Redis学习笔记]]
- 消息队列：[[后端/消息队列/RocketMQ]]、[[后端/消息队列/消息可靠性与常见问题]]（幂等与重试）
- 定时任务：[[后端/中间件/定时任务与分布式调度]]
- 并发：[[后端/Java基础/并发编程/线程池原理与实战]]、[[后端/Java基础/并发编程/异步编程-CompletableFuture]]
- 事务：[[后端/Spring/事务管理与失效场景]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
