# Android 原生开发学习路线

Android 是移动开发的半壁江山(全球七成以上设备),原生开发直接访问系统 API、性能与体验最佳——**跨平台方案省事,但复杂场景下原生永远是最靠谱的选择**;而且 Kotlin + Jetpack Compose 已让原生开发告别繁琐 XML,体验直逼"现代框架"。**语言前提**:Kotlin(空安全/协程/扩展函数——见 [Kotlin](/learning-paths/languages/kotlin) 语言路线);本页讲 Android 生态组合。

## 为什么选 Android 原生

**①市场**:全球占有率第一,国内岗位量巨大(含厂商 ROM/车载/物联网的 Android 系);**②技术现代化**:Kotlin(简洁安全)+ Jetpack Compose(声明式 UI,与 SwiftUI/React 同心智)+ 协程(异步优雅);**③自由度**:相比 iOS,Android 开放(侧载/厂商定制/系统深度集成)——**工具、自动化、硬件方向的开发者首选**;**④生态完整**:Jetpack 全家桶把生命周期/数据库/后台任务等难题标准化。**代价**:设备碎片化(屏幕/系统版本/厂商 ROM 的兼容要处理)与国内分发渠道复杂。

## 基础篇:环境与语言

**开发环境**:Android Studio(官方 IDE:模拟器/布局预览/性能工具一体)、SDK 与 AVD 管理;**Kotlin 基础**:变量与类型、空安全(`?`/`!!` 的意义——见 [Kotlin](/learning-paths/languages/kotlin))、函数与高阶函数、集合操作、类与对象;**Kotlin 进阶**:扩展函数(Android 代码风格的核心)、**协程(异步编程的标准姿势:lifecycleScope/launch/withContext——告别回调地狱)**;项目结构:Gradle 构建(见 [Gradle](/learning-paths/build-tools/gradle))、AndroidManifest(组件声明/权限)、资源体系(res/布局/values)。

## 进阶篇:UI 与架构(Jetpack Compose 时代)

**Compose 声明式 UI(现代 Android 的主线)**:`@Composable` 函数描述界面(与 SwiftUI/React 同心智)——**状态驱动 UI:状态变,界面自动重组**;布局 Column/Row/Box、`LazyColumn`(列表——对应 React Native 的 FlatList)、Material 3 主题;**状态管理**:`remember`(局部)/`mutableStateOf`、**ViewModel**(界面状态持有者:旋转屏幕不丢,见架构)、`collectAsState`(把 Flow/StateFlow 接进 UI——**现代状态管理:UI 层 collect,业务层 StateFlow**);**导航**:Navigation Compose(导航图/传参/返回栈——页面流转的标准);**Jetpack 组件全家**(Android 的"官方最佳实践库"):ViewModel + StateFlow(状态)、Room(数据库,见 [Android 数据层] 下)、WorkManager(后台任务:延迟/约束执行——**别用裸线程做后台**)、DataStore(键值,替代 SharedPreferences)、Paging(分页加载)。**架构规范(MVVM/单向数据流)**:UI(Compose)→ ViewModel(状态与逻辑)→ Repository(数据源:网络/数据库)——**Google 官方推荐的 App Architecture:UI 层 + 数据层分离**,配合依赖注入(Hilt——见 [Kotlin](/learning-paths/languages/kotlin) 的 Android 章)。

## 实战篇:功能与发布

**网络**:Retrofit(声明式 API 接口)+ OkHttp(拦截器:日志/加 token)+ 协程挂起函数 + kotlinx.serialization/Gson 解析——**统一错误处理与 loading 状态**;**本地存储三选**:SharedPreferences/DataStore(小键值)、**Room(关系型:Entity/Dao/Flow 查询——本地数据库标配)**、文件与 MediaStore(媒体);**图片加载**:Coil(Compose 原生友好)或 Glide(缓存/占位/变换——列表图片必备);**权限**:运行时权限(Android 6+ 动态申请:请求/拒绝/不再询问三态处理——**权限是 Android 第一道 UX 坎**);**多媒体与系统能力**:相机( CameraX)/定位(FusedLocation)/推送(FCM 或厂商推送——**国内推送要接厂商通道(小米/华为等),这是国内 Android 特有工程**);**性能**:Profile 工具(CPU/内存/布局)、启动优化、列表性能(LazyColumn + key)、内存泄漏(LeakCanary);**打包发布**:签名配置(keystore)、混淆(R8/ProGuard 规则)、版本管理;**Google Play**(AAB 格式)与**国内厂商商店**(应用宝/华为/小米等:软著、隐私合规——**国内上架流程是独立的一门课**);CI/CD(Fastlane/GitHub Actions 构建签名发布——见 [CI](/learning-paths/devops/github-actions))。

## 学习路径与进阶方向

**路径**:Android Studio 跑通 Hello Compose → Kotlin 语言补课 → Compose UI + 状态 → ViewModel + Room 做一个记事本(本地 CRUD)→ Retrofit 接后端 + 协程(完整 App)→ 权限/图片/列表性能打磨 → 打包上架。**进阶**:Kotlin Multiplatform(共享业务代码到 iOS——见 [Kotlin](/learning-paths/languages/kotlin) 的 KMP 章)、Compose Multiplatform(桌面)、Material Design 3 深入、Android TV/Wear/车载(Android 系的扩展平台)、**Jetpack Compose 底层(重组原理/性能)**。

## 通关标准

能独立做到:用 Compose + ViewModel + Room + Retrofit 做出带本地缓存、网络请求、列表详情的完整 App;处理过运行时权限(含"不再询问")与图片加载优化;说清协程在 Android 的用法(生命周期安全)与 MVVM 分层;完成签名与至少一个渠道的发布流程(或全流程演练);用 Profile/LeakCanary 定位过一次性能或内存问题——Android 原生主线通关。

Android 原生是"**平台深度换职业宽度**"的选择:它给你最直接的系统能力(硬件/传感器/后台)与最大的市场,也要求你消化最多的碎片化与渠道细节——**这正是原生工程师不可替代的原因**。别被"跨平台要取代原生"的论调带偏:复杂应用、深度集成、性能敏感场景,原生始终是最终答案;而 Kotlin + Compose 的现代化让学习曲线已大幅拉平。**建议:先 Compose 把 UI/状态/数据层打通,再啃权限/发布/性能这些"Android 特有课"**。下一步:对照 [iOS 原生](/learning-paths/mobile/ios-native) 看另一端的配方,或先学 [Kotlin](/learning-paths/languages/kotlin) 语言。
