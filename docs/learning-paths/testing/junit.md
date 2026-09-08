# JUnit 学习路线

JUnit 是 Java 生态最经典的单元测试框架，从 2000 年诞生至今已成为 Java 测试的事实标准。JUnit 5（Jupiter）带来了现代化的设计，支持 Lambda、注解增强、扩展模型，让测试代码更简洁优雅。无论是 Spring Boot、Android 还是企业级 Java 应用，JUnit 都是基石。

## 基础篇：入门与配置

### 版本演进
- JUnit 3：TestCase 继承，方法名约定
- JUnit 4：注解驱动，@Test 时代
- JUnit 5：模块化架构，Jupiter + Vintage + Platform
- 迁移建议：新项目用 JUnit 5，老项目逐步迁移

### 安装与依赖
- Maven 依赖：junit-jupiter-api、junit-jupiter-engine
- Gradle 依赖：testImplementation
- IDE 集成：IntelliJ IDEA、Eclipse 原生支持
- 构建工具集成：Maven Surefire、Gradle Test

### 第一个测试
- 测试类：命名约定 *Test、Test*
- 测试方法：@Test 注解
- 断言：Assertions 类
- 运行测试：IDE 运行、mvn test、gradle test
- 测试报告：target/surefire-reports、build/test-results

### 项目结构
- 源码目录：src/main/java
- 测试目录：src/test/java
- 资源目录：src/test/resources
- 包结构：与源码保持一致
- 测试命名：类名 + Test 后缀

## 基础篇：注解与生命周期

### 基础注解
- @Test：标记测试方法
- @DisplayName：自定义测试名称（支持中文、Emoji）
- @Disabled：禁用测试
- @RepeatedTest：重复测试
- @Tag：测试分类标签

### 生命周期注解
- @BeforeAll：所有测试前运行一次（static 方法）
- @AfterAll：所有测试后运行一次（static 方法）
- @BeforeEach：每个测试前运行
- @AfterEach：每个测试后运行
- 执行顺序：BeforeAll → BeforeEach → Test → AfterEach → AfterAll

### 条件执行注解
- @EnabledOnOs：指定操作系统
- @DisabledOnOs：禁用操作系统
- @EnabledOnJre：指定 JRE 版本
- @EnabledIfSystemProperty：系统属性条件
- @EnabledIfEnvironmentVariable：环境变量条件
- @EnabledIf：自定义条件

### 嵌套测试
- @Nested：嵌套测试类
- 内部类：组织相关测试
- 层级结构：清晰的测试组织
- 共享设置：继承外部类的生命周期
- DisplayName 配合：语义化测试报告

## 基础篇：断言详解

### 基础断言
- assertEquals：相等断言
- assertNotEquals：不相等断言
- assertTrue、assertFalse：布尔断言
- assertNull、assertNotNull：空值断言
- assertSame、assertNotSame：同一对象断言（引用比较）
- assertArrayEquals：数组断言

### 高级断言
- assertAll：组合断言（全部执行，批量报告失败）
- assertThrows：异常断言
- assertTimeout：超时断言
- assertTimeoutPreemptively：抢占式超时（立即终止）
- assertDoesNotThrow：不抛异常断言
- assertLinesMatch：行匹配断言（正则支持）

### 断言消息
- 静态消息：字符串
- 动态消息：Supplier（延迟计算，失败时才执行）
- 性能优化：复杂消息用 Supplier

### AssertJ 集成
- 流式断言：assertThat().isEqualTo()
- 更好的可读性
- 丰富的匹配器
- IDE 自动补全友好

## 进阶篇：参数化测试

### 基本参数化
- @ParameterizedTest：参数化测试标记
- @ValueSource：基本类型参数（int、String、double 等）
- @NullSource：null 参数
- @EmptySource：空值参数（""、空集合）
- @NullAndEmptySource：null + 空值

### 复杂参数源
- @EnumSource：枚举参数
- @MethodSource：方法提供参数（Stream、List）
- @CsvSource：CSV 格式参数
- @CsvFileSource：CSV 文件参数
- @ArgumentsSource：自定义参数提供者

### 参数转换
- 隐式转换：基本类型自动转换
- @ConvertWith：自定义转换器
- ArgumentConverter 接口
- 参数聚合：@AggregateWith

### 参数命名
- {index}：参数索引
- {arguments}：所有参数
- {0}、{1}：具体参数
- @DisplayName + 占位符：清晰的测试名称

## 进阶篇：Mock 与 Stub

### Mockito 集成
- @Mock：创建 Mock 对象
- @InjectMocks：注入 Mock
- @Spy：部分 Mock（真实对象包装）
- @Captor：参数捕获器
- MockitoExtension：JUnit 5 扩展

### Mock 行为
- when().thenReturn()：设置返回值
- when().thenThrow()：抛出异常
- doReturn()、doThrow()：void 方法 Mock
- thenAnswer()：自定义逻辑
- thenCallRealMethod()：调用真实方法

### 验证交互
- verify()：验证方法调用
- times()：调用次数
- never()：从未调用
- atLeast()、atMost()：次数范围
- inOrder()：调用顺序验证
- verifyNoMoreInteractions()：无其他交互

### 参数匹配
- any()、anyInt()、anyString()：任意参数
- eq()：精确匹配
- argThat()：自定义匹配器
- ArgumentCaptor：捕获并验证参数

## 进阶篇：测试套件与组织

### 测试套件
- @Suite：测试套件标记
- @SelectClasses：选择测试类
- @SelectPackages：选择包
- @IncludeClassNamePatterns：包含模式
- @ExcludeClassNamePatterns：排除模式

### 标签过滤
- @Tag：给测试打标签（unit、integration、slow）
- 构建工具过滤：Maven groups、Gradle includeTags
- CI 中分组运行：快速反馈 vs 完整测试

### 测试顺序
- @TestMethodOrder：指定排序策略
- @Order：指定测试顺序
- OrderAnnotation：按 @Order 排序
- MethodName：按方法名排序
- Random：随机排序（检测测试依赖）

### 测试实例
- @TestInstance：实例生命周期
- PER_METHOD：默认，每个测试新实例
- PER_CLASS：类级别实例，共享状态
- @BeforeAll/@AfterAll 不再需要 static

## 实战篇：Spring Boot 集成

### Spring Test 注解
- @SpringBootTest：完整 Spring 上下文
- @WebMvcTest：Web 层测试
- @DataJpaTest：JPA 层测试
- @JsonTest：JSON 序列化测试
- @TestConfiguration：测试专用配置

### 依赖注入
- @Autowired：注入 Bean
- @MockBean：Mock Spring Bean
- @SpyBean：Spy Spring Bean
- TestRestTemplate：HTTP 客户端
- MockMvc：Mock MVC 测试

### 数据库测试
- @Transactional：事务回滚
- @Sql：执行 SQL 脚本
- @DirtiesContext：重置上下文
- TestEntityManager：JPA 测试工具
- H2/TestContainers：内存数据库/容器化数据库

### 配置管理
- @TestPropertySource：测试属性
- @ActiveProfiles：激活 Profile
- application-test.properties：测试配置
- @DynamicPropertySource：动态属性

## 实战篇：高级特性

### 动态测试
- @TestFactory：测试工厂
- DynamicTest：运行时生成测试
- 灵活性：根据数据生成测试
- 适用场景：数据驱动测试

### 扩展模型
- Extension 接口：扩展点
- @ExtendWith：注册扩展
- BeforeAllCallback、AfterAllCallback：全局生命周期
- BeforeEachCallback、AfterEachCallback：测试生命周期
- ParameterResolver：参数注入
- TestInstancePostProcessor：实例后处理

### 自定义注解
- 组合注解：@Target + @Retention
- 元注解：继承其他测试注解
- 复用配置：减少重复
- 语义化：提升可读性

### 并发测试
- @Execution：并发执行策略
- CONCURRENT：并发执行
- SAME_THREAD：同线程执行
- @ResourceLock：资源锁
- 线程安全性测试

## 实战篇：测试覆盖与质量

### JaCoCo 集成
- Maven/Gradle 插件
- 覆盖率报告：HTML、XML、CSV
- 覆盖率阈值：构建失败条件
- 排除类：配置忽略规则
- CI 集成：Codecov、SonarQube

### 覆盖率指标
- 行覆盖率：代码行执行比例
- 分支覆盖率：分支执行比例
- 方法覆盖率：方法执行比例
- 类覆盖率：类执行比例
- 目标：80% 以上，但不盲目追求 100%

### 测试金字塔
- 单元测试：最多，快速反馈
- 集成测试：中等，验证协作
- E2E 测试：最少，模拟用户行为
- 平衡策略：快速 + 可靠

### 测试原则
- FIRST 原则：Fast、Independent、Repeatable、Self-Validating、Timely
- AAA 模式：Arrange、Act、Assert
- Given-When-Then：BDD 风格
- 单一职责：一个测试一个场景

## 实战篇：调试与优化

### 调试技巧
- IDE 断点：调试测试
- 日志输出：System.out、Logger
- @DisplayName：清晰的失败信息
- assertAll：显示所有失败
- 失败重现：@RepeatedTest

### 性能优化
- 并行执行：junit.jupiter.execution.parallel.enabled
- 减少 Spring 上下文加载：合并测试类
- 使用 @MockBean 而非真实依赖
- 数据库测试：内存数据库优于真实数据库
- 避免 Thread.sleep：用 Awaitility

### 测试气味
- 测试依赖：测试间不应有顺序依赖
- 魔法数字：用常量或参数化
- 过度 Mock：Mock 太多说明设计问题
- 测试过长：拆分或重构
- 忽略失败：@Disabled 应该有充分理由

### CI/CD 集成
- GitHub Actions：自动运行测试
- Maven/Gradle：构建失败停止部署
- 并行构建：矩阵策略加速
- 测试报告：JUnit XML、HTML
- 失败通知：Slack、Email

## 下一步学习

掌握 JUnit 后，可以探索更多 Java 测试领域：

- **Mockito** - Mock 框架深入学习
- **AssertJ** - 流式断言库
- **TestContainers** - 容器化集成测试
- **Cucumber** - BDD 行为驱动开发
- **ArchUnit** - 架构测试
- **JMH** - Java 微基准测试

JUnit 是 Java 程序员的必修课。从 JUnit 3 到 JUnit 5，它见证了 Java 测试的演进。现在的 JUnit 5 已经足够现代化：Lambda、流式接口、扩展模型、参数化测试，应有尽有。记住，测试不是为了应付覆盖率指标，而是为了让重构更安全、发版更自信。有了 JUnit，你的 Java 代码会更健壮。
