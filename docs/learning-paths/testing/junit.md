# JUnit 学习路线

JUnit 是 Java 生态最经典的单元测试框架(2000 年至今的事实标准):**JUnit 5(Jupiter)** 带来了模块化架构与现代化特性(注解、Lambda、扩展模型),是 Spring Boot、Android 与一切 Java 项目的测试基石。现代 Java 测试栈通常是组合拳:**JUnit 5(框架)+ AssertJ(流式断言)+ Mockito(替身)+ Testcontainers(真实依赖)**——本页按这条主线讲。测试观与 [Jest](/learning-paths/testing/jest)/[Pytest](/learning-paths/testing/pytest) 完全一致:**测试是为了让重构更安全、发版更自信,不是为了覆盖率数字**。

这条线按 **工程配置与第一个测试 → 生命周期与嵌套 → 断言(AssertJ)→ 参数化 → Mockito → Spring Boot 集成 → 覆盖率与质量 → 调试与 CI** 推进。

## 第一站:工程配置与第一个测试

**依赖与目录**:Maven 引 `junit-jupiter`(或 Spring Boot starter-test 全家),Gradle `testImplementation`;测试放 `src/test/java`,**包结构镜像源码**(同包才能测包级可见成员);**类名约定 `XxxTest`**(Surefire 默认发现)。**第一个测试**:`@Test void 方法名() { assertEquals(期望, 实际); }`——方法名就是文档,用 **`@DisplayName("中文描述:登录成功返回 token")`** 让报告与 IDE 可读;**跑**:IDE 里方法旁绿箭头(单跑/调试——**Java 测试能在 IDE 断点调试是巨大优势**)、命令行 `mvn test`/`gradle test`(CI 用);报告在 target/surefire-reports。**断言失败体验**:assertEquals 打印期望与实际值;**消息参数写清业务语义**。

## 第二站:生命周期与嵌套测试

**生命周期五件(顺序背下来)**:`@BeforeAll`(类级一次,**static**;配 @TestInstance(PER_CLASS) 可非 static)/`@BeforeEach`(每测试前:建对象/开事务)/测试体/`@AfterEach`(清理:删数据/关资源)/`@AfterAll`——**每个测试独立:BeforeEach 重建状态,防测试间污染**。`@Disabled("理由:待修复 #123")` 禁用(带理由,别无声禁用);**@Nested(嵌套测试,现代组织利器)**:内部类里按场景分组——外层"订单服务",内层"创建订单/取消订单/异常场景",**共享外层生命周期与字段,天然形成测试树**(报告里层级清晰);**条件注解**:`@EnabledOnOs`/`@EnabledOnJre`/`@EnabledIfEnvironmentVariable`(平台相关测试优雅跳过);**@Tag("unit")/@Tag("integration")**:打标签,构建工具按组跑(`-Dgroups=unit` 快速反馈 vs 全量)。**实例模式**:默认 PER_METHOD(每测试新实例——**推荐:字段不跨测试共享,天然隔离**);PER_CLASS 共享(少用,需自行保证干净)。

## 第三站:断言——Assertions 与 AssertJ

**JUnit 自带 Assertions(够用但啰嗦)**:assertEquals/assertTrue/assertNull/**assertSame(引用同一对象——测单例/缓存场景**)/assertArrayEquals;**异常断言:assertThrows(异常类型, () -> 代码)(断言"抛了什么"——别用 try/catch 手写;还能拿异常对象断言 message/字段)**;**assertTimeout(Duration, ...)(超时保护——防测试挂死 CI)**;**assertAll("描述", () -> 断言1, () -> 断言2)(分组断言:多个断言全部执行、一起报失败——比"第一个失败就停"信息全)**;延迟消息 Supplier(只有失败才拼字符串——省性能)。**AssertJ(流式断言,现代 Java 推荐)**:`assertThat(result).isEqualTo(x).isNotNull()`——链式、可读、IDE 补全友好、匹配器丰富(isEqualTo/isIn/hasSize/extracting(对象属性)/`usingRecursiveComparison`(深度比较));断言集合/可选/Optional 都更顺手——**新代码建议 AssertJ**(Spring 官方测试也用它)。

## 第四站:参数化测试——一表打尽边界

`@ParameterizedTest` + 数据源注解(替代"一个方法复制 N 遍"):`@ValueSource(strings = {"", "abc", "很长..."})`(基本类型);**`@NullAndEmptySource`(null/空串边界——参数校验测试的标配)**;`@EnumSource`(枚举全值);**`@MethodSource("方法名")(最灵活:返回 Stream<Arguments>——复杂对象/从文件读数据)**;`@CsvSource`(内联小表格);显示名占位符:`@DisplayName("输入 {0} 应抛异常")`——**失败报告精确到哪组参数**;进阶:`@TestFactory` 动态测试(运行时根据数据生成用例——数据驱动测试,比参数化更动态,少用)。

## 第五站:Mockito——Java 的替身之王

**组合**:`@ExtendWith(MockitoExtension.class)` + **`@Mock`(替身)与 `@InjectMocks`(被测对象,mock 自动注入)——测 Service 时 mock Repository/外部客户端,Service 是真实代码**;`@Spy`(真实对象的部分包装——少用)。**行为桩**:`when(repo.find(1L)).thenReturn(user)`(成功路径)/`thenThrow(new NotFoundException())`(异常路径)/`doThrow()`(void 方法)/thenAnswer(动态);**验证(单元测试的核心断言,同 Jest 哲学)**:`verify(repo).save(user)`(调没调)/`verify(repo, times(2))/never()`(次数)/`inOrder`(顺序——少用,脆弱);**参数匹配**:any()/eq()/argThat(自定义);**ArgumentCaptor(捕获参数再断言内容——验证"用正确的参数调用了依赖")**。**Mock 边界(Java 面试常问)**:mock 外部依赖(网络/数据库/第三方),**别 mock 被测类自己的内部方法**(说明设计可改进);全 mock 没有真值 = 测了个寂寞——集成测试补真值(Testcontainers,见下)。

## 第六站:Spring Boot 集成

**切片测试(Spring 测试的核心概念,详见 [Spring Boot](/learning-paths/backend/spring-boot) 测试章)**:`@SpringBootTest`(起完整上下文——最重,少用)、**`@WebMvcTest`(只起 MVC 层 + MockMvc 模拟请求——Controller 测试标准**)、`@DataJpaTest`(只起 JPA + 内存库/Testcontainers)、`@JsonTest`(序列化);**@MockBean**(在 Spring 上下文里替换 Bean 为 mock——切片测试里 mock 下层依赖);MockMvc(`mockMvc.perform(get("/api/users/1")).andExpect(status().isOk())`——接口契约测试);**Testcontainers(现代集成测试标准:测试时起真实 MySQL/Redis 容器——解决 H2 方言差异"内存库过了生产挂了"的经典问题)**;`@Transactional`(测试方法事务,结束自动回滚——数据库测试互不污染);@ActiveProfiles("test")/application-test.yml/TestPropertySource(测试配置隔离)。**测试速度心法**:能切片不全家桶、能 @MockBean 不起真服务、集成测试只覆盖关键链路。

## 第七站:覆盖率与测试质量

**JaCoCo(Maven/Gradle 插件)**:`jacoco:report` 出 HTML(看哪些行没盖——**比百分比数字有用**);`jacoco:check` 配阈值(行/分支,如 80%)——**CI 里不达标构建失败,防回退**;排除生成代码/Lombok/配置类(否则覆盖率虚低);集成 Codecov/SonarQube(趋势与质量门禁,见 [CI](/learning-paths/devops/github-actions))。**质量原则(Java 版,通用)**:**AAA 模式(Arrange 准备 → Act 执行 → Assert 断言——测试代码的三段式结构,保持可读)**;FIRST 原则(Fast/Independent/Repeatable/Self-validating/Timely);一个测试一个行为(别一次测十件事);**测试气味自查**:测试间顺序依赖(禁!)/魔法数字(参数化)/过度 Mock(设计问题信号)/@Disabled 泛滥(欠的债要还)/长测试(拆)。**覆盖率是手段不是目标**:核心业务(支付/权限/状态机)重点覆盖,getter/setter 别凑数。

## 第八站:调试与 CI

**调试(Java 的隐藏福利)**:IDE 里直接在测试方法打断点 Debug——**看到真实调用栈与变量,比 print 高效一个量级**;`@RepeatedTest`(复现偶发失败——连跑 N 次抓"时好时坏"的测试);失败重跑(IDE 与 mvn 都支持 `-Dtest=XxxTest` 单跑)。**CI 集成(见 [GitHub Actions](/learning-paths/devops/github-actions))**:`mvn test`(或 `mvn verify` 含 JaCoCo check)→ 失败即停部署;JUnit XML 报告上传(CI 页面看失败详情);**性能**:Surefire 并行(谨慎:共享状态)、合并 Spring 测试类(共享上下文,别每个测试类都起一遍——**Spring 上下文缓存是自动的,但配置别乱变**) 、@MockBean 代替真依赖、Testcontainers 复用;测试避免 Thread.sleep(用 Awaitility 轮询等待——**测异步的优雅姿势**)。**并发测试提醒**:JUnit 默认单线程,`parallel` 需显式开启——**测试本身必须互相独立才能并行**。

## 通关标准

能独立做到:用 @DisplayName + @Nested + assertAll 写出"可读且信息全"的测试;用 @ParameterizedTest + MethodSource 覆盖业务边界;用 Mockito 的 @Mock/@InjectMocks + verify/ArgumentCaptor 测 Service 的"依赖调用正确";给 Spring 项目写出 @WebMvcTest/MockMvc 接口测试与 Testcontainers 集成测试;配 JaCoCo 阈值并在 CI 里跑通;说出 AAA/FIRST 与过度 Mock 的判别——JUnit 主线通关。

JUnit 是 Java 程序员的必修课,但它教你的其实是"**可测试的 Java**"怎么写:依赖注入(让 Mock 成为可能)、接口边界(让替身干净)、Spring 的切片测试(让上下文可控)——测试框架倒逼出的这些设计习惯,正是企业级 Java 的骨架。**记住:测试是重构的安全网,不是发布前的仪式**——有了 JUnit + Mockito + Testcontainers 这套组合,你可以放心地改代码,而 CI 会在你弄坏东西时第一时间告诉你。下一步:Spring 集成测试回 [Spring Boot](/learning-paths/backend/spring-boot) 深化,或浏览器 E2E 看 [Selenium](/learning-paths/testing/selenium)。
