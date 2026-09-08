# Kotlin 学习路线

Kotlin，这门"现代化的 Java 替代者"，以其简洁、安全、互操作性强的特性，成为 Android 开发的官方首选语言。从 Google 宣布 Kotlin-first 策略后，Kotlin 不仅在移动端大放异彩，在服务端和多平台开发中也展现出强大潜力。

## 基础篇

### Kotlin 入门
- **环境搭建**：IntelliJ IDEA、Android Studio、命令行编译器
- **基本语法**：变量（var/val）、类型推断、类型注解
- **数据类型**：Int、Long、Double、Boolean、String、Char
- **可空类型**：? 后缀、null 安全
- **输出**：println()、字符串模板（${}）
- **控制流**：if 表达式、when 表达式、for/while 循环

```kotlin
fun main() {
    println("Hello, Kotlin World!")
}
```

**下一步学习**：基础语法简洁，null 安全是 Kotlin 的核心特性。

### Null 安全
- **可空类型**：String? vs String
- **安全调用**：?.、链式安全调用
- **Elvis 运算符**：?: 提供默认值
- **非空断言**：!!、强制非空（慎用）
- **安全转换**：as? 安全类型转换
- **let 函数**：?.let { } 处理非空值

**下一步学习**：Null 安全避免空指针，函数是代码模块化基础。

### 函数
- **函数定义**：fun 关键字、参数、返回值
- **默认参数**：参数默认值
- **命名参数**：调用时指定参数名
- **可变参数**：vararg 关键字
- **单表达式函数**：= 简化语法
- **中缀函数**：infix、自然语言风格
- **扩展函数**：为现有类添加方法
- **高阶函数**：函数作为参数、返回函数

**下一步学习**：函数灵活强大，Lambda 和集合操作是 Kotlin 特色。

### Lambda 与集合
- **Lambda 表达式**：{ } 语法、it 隐式参数
- **高阶函数**：map、filter、reduce、forEach
- **集合类型**：List、Set、Map、不可变与可变
- **集合操作**：
  - 转换：map、flatMap、associate
  - 过滤：filter、filterNot、partition
  - 聚合：reduce、fold、sum、count
  - 查找：find、firstOrNull、any、all
  - 分组：groupBy、groupingBy
- **序列（Sequence）**：惰性求值、性能优化

**下一步学习**：集合操作优雅，类和对象是 OOP 基础。

### 类与对象
- **类定义**：class 关键字、主构造器、次构造器
- **属性**：val/var、getter/setter、自定义访问器
- **初始化块**：init 代码块
- **数据类**：data class、自动生成 equals/hashCode/toString/copy
- **密封类**：sealed class、限制继承
- **枚举类**：enum class、枚举常量、属性和方法
- **对象表达式与对象声明**：object、匿名对象、单例

**下一步学习**：类是封装，继承和接口是多态基础。

### 继承与接口
- **继承**：open 关键字、override 重写
- **抽象类**：abstract class、抽象成员
- **接口**：interface、默认方法实现
- **多继承**：接口支持多继承
- **属性重写**：属性也可以重写
- **委托**：by 关键字、类委托

**下一步学习**：继承实现多态，可见性修饰符控制访问。

## 进阶篇

### 可见性与修饰符
- **可见性修饰符**：public、private、protected、internal
- **internal**：模块内可见
- **open**：允许继承和重写
- **final**：禁止继承和重写（默认）
- **abstract**：抽象、必须重写
- **sealed**：密封、限制继承

**下一步学习**：修饰符控制访问，委托模式简化代码。

### 委托
- **类委托**：by 关键字、委托给另一个对象
- **属性委托**：by 关键字、自定义属性行为
- **标准委托**：
  - lazy：延迟初始化
  - observable：属性变化观察
  - vetoable：属性变化拦截
  - map/mutableMap：映射委托
- **自定义委托**：getValue/setValue 运算符

**下一步学习**：委托简化代码，泛型提供类型安全。

### 泛型
- **泛型类**：`<T>` 类型参数
- **泛型函数**：函数级别的泛型
- **型变**：
  - 协变：out T（生产者）
  - 逆变：in T（消费者）
  - 不变：默认行为
- **泛型约束**：where 子句、上界约束
- **星号投影**：*、类型未知
- **reified 类型参数**：inline + reified、运行时类型信息

**下一步学习**：泛型保证类型安全，异常处理保证程序健壮。

### 异常处理
- **try-catch-finally**：捕获异常
- **throw**：抛出异常
- **Nothing 类型**：永不返回的函数
- **异常是非受检的**：不需要声明 throws
- **try 表达式**：返回值

**下一步学习**：异常处理规范，注解提供元数据。

### 注解与反射
- **注解**：@注解名、自定义注解
- **注解目标**：@Target、使用位置
- **注解保留**：@Retention、运行时/编译时
- **反射**：KClass、KFunction、KProperty
- **获取类引用**：::class、.java
- **动态调用**：call、反射创建对象

**下一步学习**：反射提供内省，协程是 Kotlin 的杀手级特性。

### 协程（Coroutines）
- **协程基础**：suspend 关键字、挂起函数
- **协程构建器**：launch、async、runBlocking
- **协程作用域**：CoroutineScope、GlobalScope、viewModelScope
- **协程上下文**：Dispatchers（Main、IO、Default）
- **Job**：协程任务、cancel 取消
- **Deferred**：async 返回值、await 等待
- **协程取消**：isActive、cancel、withTimeout
- **通道（Channel）**：协程间通信
- **流（Flow）**：冷流、collect、transform、异步数据流
- **StateFlow/SharedFlow**：热流、状态共享

**下一步学习**：协程处理异步，DSL 构建器让语法优雅。

## 实战篇

### DSL 构建
- **类型安全构建器**：@DslMarker、lambda with receiver
- **HTML DSL**：构建 HTML 结构
- **Gradle Kotlin DSL**：build.gradle.kts
- **作用域函数**：let、run、with、apply、also
- **运算符重载**：plus、minus、invoke、get/set

**下一步学习**：DSL 让语法自然，Android 开发是 Kotlin 主战场。

### Android 开发
- **Activity/Fragment**：生命周期、布局绑定
- **View Binding/Data Binding**：视图访问、数据绑定
- **Jetpack 组件**：
  - ViewModel：UI 状态管理、生命周期感知
  - LiveData：可观察数据、生命周期感知
  - Room：SQLite ORM、DAO、Entity
  - Navigation：导航组件、Safe Args
  - WorkManager：后台任务
- **Jetpack Compose**：声明式 UI、Composable 函数
- **依赖注入**：Hilt、Koin、Dagger

**下一步学习**：Android 开发是主流，多平台是未来。

### Kotlin Multiplatform
- **KMP 基础**：共享代码、平台特定代码
- **expect/actual**：平台声明与实现
- **共享模块**：commonMain、androidMain、iosMain
- **序列化**：kotlinx.serialization
- **网络请求**：Ktor Client、多平台 HTTP
- **数据库**：SQLDelight、多平台 SQL

**下一步学习**：多平台复用代码，服务端开发也是选择。

### Kotlin 服务端
- **Ktor 框架**：轻量级 Web 框架
- **路由**：routing、HTTP 方法
- **请求处理**：call.receive、call.respond
- **序列化**：kotlinx.serialization、JSON
- **数据库**：Exposed ORM、SQL 查询
- **依赖注入**：Koin、Kodein
- **测试**：Ktor Test、MockK

**下一步学习**：服务端开发完整，测试保证质量。

### 测试
- **单元测试**：JUnit、Kotlin Test
- **断言**：assertThat、assertTrue、assertEquals
- **Mock 框架**：MockK、mockito-kotlin
- **协程测试**：runTest、TestCoroutineDispatcher
- **Android 测试**：Espresso、UI Automator
- **测试覆盖率**：JaCoCo、覆盖率报告

**下一步学习**：测试保证正确性，性能优化提升体验。

### 性能优化
- **内联函数**：inline、减少函数调用开销
- **内联类**：@JvmInline value class、零开销封装
- **数组优化**：`IntArray` vs `Array<Int>`、避免装箱
- **序列 vs 集合**：惰性求值、大数据集优化
- **协程优化**：调度器选择、作用域管理
- **内存分析**：Android Profiler、LeakCanary

**下一步学习**：性能优化是进阶，现代特性让代码更好。

### Kotlin 现代特性
- **Kotlin 1.4+**：SAM 转换、尾随 lambda、类型推断改进
- **Kotlin 1.5+**：JVM Records 支持、密封接口、value class
- **Kotlin 1.6+**：注解实例化、挂起函数作为父类型
- **Kotlin 1.7+**：Builder 类型推断、上下文接收者
- **Kotlin 1.8/1.9**：K2 编译器、性能提升、新的 opt-in 机制

**下一步学习**：新特性持续进化，现在你已掌握 Kotlin 全貌！

## 学习建议

### 推荐资源
- **官方文档**：Kotlin 官方文档、Kotlin Playground
- **书籍**：《Kotlin 实战》、《Kotlin 核心编程》
- **课程**：Kotlin for Java Developers（Coursera）
- **社区**：Kotlin 中文社区、Kotlinlang Slack

### 学习周期
- **基础篇**：1-2 个月（每天 2-3 小时）
- **进阶篇**：2-3 个月（每天 2-3 小时）
- **实战篇**：3-6 个月（需要项目实践）

### 职业方向
- **Android 开发**：移动应用开发（主流方向）
- **服务端开发**：Ktor、Spring Boot + Kotlin
- **多平台开发**：KMP、共享业务逻辑
- **脚本编写**：Kotlin Script、Gradle 构建脚本

Kotlin 是一门务实的语言，它吸收了 Java 的精华，同时避免了 Java 的冗长。JetBrains 的持续投入和 Google 的大力支持，让 Kotlin 的未来充满前景。记住：学 Kotlin 不仅是学语法，更是学习现代编程语言的设计哲学。享受 Kotlin 带来的简洁与强大吧！
