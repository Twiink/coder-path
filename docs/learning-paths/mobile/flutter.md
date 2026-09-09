# Flutter 学习路线

Flutter(Google 出品)是跨平台方案中**性能最强、UI 一致性最好**的框架:一套代码跑 iOS/Android/Web/桌面——它不是 WebView 套壳、也不是原生组件包装,而是**用自绘引擎(Skia/Impeller)直接在 Canvas 上绘制每个像素**:这就是它"两端 UI 像素级一致 + 动画流畅"的底气。语言是 Dart(简洁现代,约两周上手)。**定位**:想要"一套代码多端 + 极致一致的 UI 体验"的团队;对比 React Native(前端迁移友好),Flutter 更"自成一派"(要学 Dart 与新组件体系,但与原生 UI 无关的心智反而更统一)。

## 为什么选 Flutter

**①性能**:自绘引擎绕开原生 UI 桥接,复杂动画/高频刷新依然流畅(跨平台里最接近原生);**②一致性与效率**:一套代码、一套 UI(两端无样式差异),热重载(改代码毫秒级生效——**开发体验一流**);**③组件开箱即用**:Material(Android 风)与 Cupertino(iOS 风)组件库齐全,不用从零写 UI;**④多端延伸**:同一套代码可编译 Web 与桌面(Flutter Desktop 见 [桌面端](/learning-paths/desktop/flutter-desktop));**⑤Google 背书**:社区活跃、pub.dev 包生态快速增长。**代价**:要学 Dart;UI 与平台原生观感有差异(自绘 vs 系统组件);深度原生能力要写插件(Platform Channel)。

## 基础篇:Dart 与核心 Widget

**Dart 语言(见 [Dart] 入门)**:变量与类型(**空安全:类型后加 ? 表可空——现代语言标配**)、函数(箭头/可选参数)、类与对象、集合、**异步(Future/async-await 与 Stream——与 JS/Python 同心智)**、泛型与 Mixin——**两周可上手,不必先精通**。**Flutter 核心心智:"一切皆 Widget"**——UI 就是 Widget 树(Text/Image/Icon/Button 系列);**StatelessWidget(静态)与 StatefulWidget(有状态:setState 触发重建)**——**状态变 → setState → 界面重建**(声明式,与 React/Compose/SwiftUI 同心智,会一个学四个快);**布局 Widget**:Container(装饰与约束)/Row/Column(线性)/Stack(层叠)/ListView/GridView(滚动列表——**长列表用 ListView.builder 虚拟化**);主题(MaterialApp 的 Theme)。

## 进阶篇:状态、导航与数据

**状态管理(Flutter 的"必选题",生态比 RN 更需要自己选)**:入门用 **setState + 状态提升**,进阶按规模选:**Provider**(官方推荐入门:ChangeNotifier + 依赖注入)、**Riverpod**(Provider 的现代进化,编译期安全,当前主流推荐)、Bloc(事件驱动,大型项目/团队规范严选)、GetX(轻量全家桶:状态+路由+依赖,快速但规范争议)——**先 setState 理解原理,再上 Riverpod 或 Bloc**(选型原则同 [React](/learning-paths/frontend/react) 状态章:别为小应用上重武器)。**导航**:Navigator(推入/弹出/传参/返回值;命名路由与 onGenerateRoute 进阶)、go_router(声明式路由,现代推荐);**表单**:Form + TextFormField + 验证器;**网络**:http(简单)/dio(拦截器/超时/上传下载——生产推荐);**本地存储**:shared_preferences(键值)/sqflite(SQLite)/Hive(轻量 NoSQL 本地库);**图片**:Image.network + 缓存(cached_network_image)。

## 实战篇:功能、性能与发布

**系统能力(插件生态)**:image_picker(相机/相册)、geolocator(定位)、permission_handler(权限——**Android 运行时权限与 iOS 权限描述都要处理**)、local_auth(生物识别)、firebase 全家/国内推送;**性能优化**:`const` 构造(编译期常量 Widget 减少重建——**Flutter 性能第一习惯**)、ListView.builder 虚拟化、避免不必要 rebuild(选择性重建)、图片缓存与压缩、**用 DevTools/Profile 看帧耗时(掉帧即卡顿信号)**;**原生插件**:Platform Channel 调原生代码(复杂能力/第三方 SDK)——**"Flutter 做不到的原生补"是边界意识**;**发布**:Android 签名(keystore)与 iOS 证书流程(见 [Android](/learning-paths/mobile/android-native)/[iOS](/learning-paths/mobile/ios-native) 发布章)——Flutter 打包产物与原生一致,上架流程相同;**多端**:Flutter Web 与桌面(见 [Flutter Desktop](/learning-paths/desktop/flutter-desktop))——**同一代码库的边际成本极低**。

## 学习路径与进阶

**路径**:装 Flutter SDK + IDE(VS Code/Android Studio)跑通 Hello → Dart 语言速成 → 核心 Widget 与布局(做出静态页)→ StatefulWidget + setState → 列表 + 导航(页面流转)→ 状态管理(Riverpod)+ 网络(dio 接真实 API)→ 本地存储 → 系统能力(相机/权限)→ 性能打磨 → 打包发布。**进阶**:Riverpod/Bloc 深入、动画(隐式/显式,Flutter 动画是强项)、自定义绘制(CustomPaint)、Platform Channel 插件开发、Flutter Web/桌面实战。

## 通关标准

能独立做到:用 Flutter + Riverpod(或 Bloc)做出带登录、列表详情、导航、本地存储、网络请求的完整 App;熟练用 const 与 ListView.builder 保证列表流畅;在真机跑通权限与相机等系统能力;说清 Flutter 自绘引擎与 RN 的差异及各自适用场景;完成一次 iOS 或 Android 的签名与发布——Flutter 主线通关。

Flutter 是"**用一致性换效率与体验**"的选择:自绘引擎让它成为跨平台里 UI 最可控、动画最流畅的那个,热重载与组件库让开发体验接近"前端框架的爽";代价是自成体系(Dart + Widget 心智)与原生观感的细微差异。**选型对照一句话**:前端团队、要最快上手 → React Native;要极致 UI 一致与性能、愿意学新栈 → Flutter;**两者都是主流,选一条跑通一个 App,另一条几天就能看懂**(声明式心智全通)。下一步:对照 [React Native](/learning-paths/mobile/react-native),或看 [Flutter Desktop](/learning-paths/desktop/flutter-desktop) 的多端延伸。
