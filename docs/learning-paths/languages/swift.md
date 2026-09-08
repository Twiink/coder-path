# Swift 学习路线

Swift，苹果精心打造的"现代化、安全、快速"的编程语言，不仅是 iOS/macOS 开发的首选，更凭借其简洁的语法和强大的类型系统，成为移动开发领域的明星语言。学 Swift，就是打开苹果生态开发的大门。

## 基础篇

### Swift 入门
- **环境搭建**：Xcode 安装、Swift Playgrounds、命令行工具
- **基本语法**：变量（var）、常量（let）、类型推断、类型注解
- **数据类型**：Int、Double、Bool、String、Character
- **输出**：print()、字符串插值（\()）
- **运算符**：算术、比较、逻辑、区间运算符（...、..<）
- **控制流**：if/else、guard、switch、for-in、while

```swift
print("Hello, Swift World!")
```

**下一步学习**：基础语法简洁，可选值是 Swift 的核心特性。

### 可选值（Optionals）
- **可选值基础**：Optional 类型、nil、? 后缀
- **解包**：强制解包（!）、可选绑定（if let、guard let）
- **可选链**：?.、安全访问属性和方法
- **空合并运算符**：?? 提供默认值
- **隐式解包可选值**：! 后缀、使用场景
- **可选值最佳实践**：避免强制解包、guard early return

**下一步学习**：可选值保证安全，集合类型是数据容器。

### 集合类型
- **数组（Array）**：创建、索引、增删改查、遍历
- **集合（Set）**：无序唯一集合、交并差集
- **字典（Dictionary）**：键值对、访问、更新、遍历
- **集合操作**：map、filter、reduce、sorted、compactMap
- **不可变与可变**：let vs var、集合的不可变性

**下一步学习**：集合存储数据，函数是逻辑封装。

### 函数与闭包
- **函数定义**：func 关键字、参数、返回值、参数标签
- **内部参数名与外部参数名**：调用时的可读性
- **默认参数值**：参数默认值
- **可变参数**：... 语法
- **输入输出参数**：inout 关键字、& 符号
- **函数类型**：作为参数、作为返回值
- **闭包**：{ } 语法、捕获值、尾随闭包、简写参数（$0、$1）
- **逃逸闭包**：@escaping、异步回调

**下一步学习**：函数和闭包是核心，枚举和结构体是类型系统基础。

### 枚举与结构体
- **枚举（Enum）**：case 定义、关联值、原始值、递归枚举
- **枚举方法**：枚举中定义方法、计算属性
- **结构体（Struct）**：值类型、属性、方法、初始化器
- **结构体 vs 类**：值类型 vs 引用类型、何时使用

**下一步学习**：枚举和结构体是值类型，类是引用类型。

### 类与继承
- **类定义**：class 关键字、属性、方法
- **初始化器**：init 方法、指定初始化器、便利初始化器
- **反初始化器**：deinit、资源清理
- **继承**：单继承、override 重写、super 调用父类
- **类型检查**：is、as?、as!
- **类型转换**：向上转型、向下转型

**下一步学习**：类支持继承，属性和方法有更多特性。

## 进阶篇

### 属性与方法
- **存储属性**：实例属性、类型属性（static、class）
- **计算属性**：get/set、只读计算属性
- **属性观察器**：willSet、didSet
- **延迟属性**：lazy var
- **实例方法**：修改值类型需要 mutating
- **类型方法**：static、class 方法
- **下标**：subscript、自定义访问语法

**下一步学习**：属性灵活，协议是 Swift 的核心设计。

### 协议（Protocol）
- **协议定义**：protocol 关键字、方法要求、属性要求
- **协议遵循**：类、结构体、枚举都可遵循
- **协议继承**：协议继承协议
- **类专属协议**：AnyObject 约束
- **协议组合**：& 符号、多个协议
- **协议扩展**：extension、提供默认实现
- **面向协议编程**：POP、协议优先于继承

**下一步学习**：协议定义契约，泛型提供类型安全的抽象。

### 泛型
- **泛型函数**：`<T>` 类型参数、类型推断
- **泛型类型**：泛型类、结构体、枚举
- **类型约束**：where 子句、协议约束
- **关联类型**：associatedtype、协议中的泛型
- **泛型 where 子句**：复杂类型约束

**下一步学习**：泛型保证类型安全，错误处理让程序健壮。

### 错误处理
- **Error 协议**：定义错误类型
- **抛出错误**：throws、throw 关键字
- **处理错误**：do-catch、try、try?、try!
- **defer 语句**：延迟执行、资源清理
- **Result 类型**：成功/失败的封装

**下一步学习**：错误处理规范，扩展增强现有类型。

### 扩展（Extension）
- **扩展基础**：extension 关键字、添加方法
- **扩展计算属性**：不能添加存储属性
- **扩展初始化器**：值类型扩展 init
- **扩展协议遵循**：让现有类型遵循协议
- **扩展嵌套类型**：添加嵌套类型
- **条件扩展**：where 子句、泛型扩展

**下一步学习**：扩展增强类型，内存管理保证安全。

### 内存管理
- **ARC（自动引用计数）**：引用计数、自动管理
- **强引用**：默认引用类型
- **弱引用**：weak、打破循环引用、可选值
- **无主引用**：unowned、不会变为 nil
- **闭包循环引用**：捕获列表 [weak self]、[unowned self]
- **内存泄漏检测**：Instruments、Debug Memory Graph

**下一步学习**：内存管理是基础，并发编程是现代 Swift 的亮点。

## 实战篇

### 并发编程（Async/Await）
- **async/await**：Swift 5.5+ 异步语法
- **异步函数**：async 关键字、await 等待
- **并发任务**：Task、async let 并行
- **结构化并发**：TaskGroup、withTaskGroup
- **Actor**：数据隔离、防止数据竞争
- **MainActor**：UI 线程标记、@MainActor
- **AsyncSequence**：异步序列、for await

**下一步学习**：并发是现代特性，SwiftUI 是 UI 开发的未来。

### SwiftUI 基础
- **声明式 UI**：View 协议、body 属性
- **基础视图**：Text、Image、Button、VStack、HStack、ZStack
- **修饰符**：modifier、链式调用
- **状态管理**：@State、@Binding、@ObservedObject、@EnvironmentObject
- **数据流**：单向数据流、@Published
- **列表与导航**：List、NavigationView、NavigationLink
- **表单**：Form、TextField、Toggle、Picker

**下一步学习**：SwiftUI 是声明式，UIKit 是传统框架。

### UIKit 基础
- **视图层次**：UIView、子视图、addSubview
- **视图控制器**：UIViewController、生命周期
- **导航**：UINavigationController、pushViewController
- **表格视图**：UITableView、dataSource、delegate
- **集合视图**：UICollectionView、布局
- **Auto Layout**：约束、NSLayoutConstraint、SnapKit
- **动画**：UIView.animate、CAAnimation

**下一步学习**：UIKit 成熟稳定，网络请求是应用基础。

### 网络编程
- **URLSession**：数据任务、下载任务、上传任务
- **异步网络请求**：async/await、URLSession
- **JSON 解析**：Codable 协议、JSONDecoder、JSONEncoder
- **网络错误处理**：URLError、状态码处理
- **第三方库**：Alamofire（网络）、Kingfisher（图片加载）
- **Combine 框架**：响应式编程、Publisher、Subscriber

**下一步学习**：网络连接世界，数据持久化保存状态。

### 数据持久化
- **UserDefaults**：简单键值存储
- **文件系统**：FileManager、Document 目录、读写文件
- **Core Data**：对象关系映射、NSManagedObject、fetch request
- **SQLite**：SQLite.swift 库、SQL 查询
- **Keychain**：敏感数据存储、密码、Token
- **云存储**：iCloud、CloudKit

**下一步学习**：数据持久化是基础，测试保证质量。

### 测试与调试
- **单元测试**：XCTest、XCTestCase、断言
- **UI 测试**：XCUITest、录制测试、查找元素
- **测试覆盖率**：代码覆盖率报告
- **Mock 与 Stub**：依赖注入、测试替身
- **调试技巧**：断点、po 命令、lldb、视图调试
- **性能分析**：Instruments、Time Profiler、Allocations

**下一步学习**：测试保证正确性，高级特性让代码更强大。

### Swift 高级特性
- **属性包装器**：@propertyWrapper、自定义属性行为
- **结果构建器**：@resultBuilder、DSL 构建
- **不透明类型**：some 关键字、隐藏具体类型
- **类型擦除**：AnySequence、自定义类型擦除
- **动态成员查找**：@dynamicMemberLookup
- **动态调用**：@dynamicCallable
- **指针与不安全代码**：UnsafePointer、内存操作

**下一步学习**：高级特性是进阶，包管理是工程化基础。

### Swift Package Manager
- **创建包**：swift package init、Package.swift
- **依赖管理**：dependencies、targets
- **本地包**：本地路径依赖
- **版本管理**：语义化版本、版本约束
- **集成到 Xcode**：File > Add Packages
- **常用第三方库**：Alamofire、Kingfisher、SnapKit、RxSwift

**下一步学习**：包管理简化依赖，现在你已掌握 Swift 全貌！

## 学习建议

### 推荐资源
- **官方文档**：The Swift Programming Language（官方教程）
- **WWDC 视频**：苹果开发者大会、最新技术
- **书籍**：《Swift 编程权威指南》、《iOS 编程实战》
- **在线课程**：Stanford CS193p（SwiftUI 课程）

### 学习周期
- **基础篇**：1-2 个月（每天 2-3 小时）
- **进阶篇**：2-3 个月（每天 2-3 小时）
- **实战篇**：3-6 个月（需要 App 项目实践）

### 职业方向
- **iOS 开发**：iPhone/iPad 应用开发
- **macOS 开发**：Mac 桌面应用
- **watchOS/tvOS**：Apple Watch、Apple TV 应用
- **跨平台**：Swift for Server（Vapor 框架）

Swift 是一门年轻但成熟的语言，苹果每年都会发布新版本带来改进。它不仅语法现代，还特别注重安全性和性能。学习 Swift 不仅是学习一门语言，更是学习现代编程语言的设计理念。记住：Swift 让你写出安全、快速、优雅的代码，享受苹果生态的开发乐趣吧！
