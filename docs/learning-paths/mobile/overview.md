# 移动端开发学习路线

移动端是流量最大的终端战场:全球数十亿台手机,App 与小程序承载了大部分用户时间。**技术选型是第一关**:原生、跨平台、小程序/多端框架——各有各的甜点与代价。本页是移动端全景地图;每条的纵深见对应页面([Android 原生](/learning-paths/mobile/android-native)/[iOS 原生](/learning-paths/mobile/ios-native)/[React Native](/learning-paths/mobile/react-native)/[Flutter](/learning-paths/mobile/flutter)/[uni-app](/learning-paths/mobile/uniapp)/[微信小程序](/learning-paths/mobile/wechat-miniprogram))。**先想清楚三件事再选型**:目标平台(iOS/Android/都要)、团队背景(前端/原生/新学)、产品形态(工具/内容/重交互/强原生能力)。

## 技术选型:原生 vs 跨平台

**原生开发(iOS 用 Swift + SwiftUI,Android 用 Kotlin + Jetpack Compose)**:性能最优、原生体验最好、能深度调用平台特性(相机/传感器/系统集成);代价:**两套代码两套人**(成本翻倍)。**何时选原生**:对性能要求极高(游戏/AR/音视频剪辑)、需要深度平台能力、团队有专职两端开发、**大型长期产品**(原生是"最稳的长期投资")。**跨平台开发**:一套代码两端跑——主流三派:①**React Native**(用 React 写:生态成熟、社区大、性能接近原生——**适合有前端背景的团队**,见 [React Native](/learning-paths/mobile/react-native));②**Flutter**(Google 出品、自绘引擎(UI 高度一致与流畅)、组件丰富——**要学 Dart,界面一致性最强**,见 [Flutter](/learning-paths/mobile/flutter));③**WebView/混合(Ionic/Capacitor)**:Web 技术套壳,**适合简单应用**与 Web 团队低成本入场(性能弱,复杂交互别选)。**何时选跨平台**:同时要 iOS+Android、团队小/快速迭代 MVP、对极致性能要求不高——**当前市场主流选择**(多数产品团队 RN 或 Flutter 起步,原生按需补充)。

**国内特殊生态**:微信小程序(流量入口,见 [小程序](/learning-paths/mobile/wechat-miniprogram))与 **uni-app(一套代码发布 App/小程序/H5 的多端框架,国内团队高频选择**,见 [uni-app](/learning-paths/mobile/uniapp))——**国内产品的现实配方常常是"App(RN/Flutter)+ 小程序"双轨**。

## 上手路线(按背景对号入座)

**前端背景 → React Native(或 uni-app)**:从 Expo 脚手架起步(对初学者最友好,见 [RN](/learning-paths/mobile/react-native)):核心组件与 Flexbox 布局(与 Web CSS 同思维)→ React Navigation 导航 → 数据获取与状态管理(React Query/Zustand 同 Web 习惯)→ 本地存储 → 按需接入相机/定位/推送等原生能力——**Web 技能迁移率最高**。**想换新语言/要极致 UI 一致性 → Flutter**:先过 Dart 语法与"一切皆 Widget"思想(约两周,见 [Flutter](/learning-paths/mobile/flutter))→ StatelessWidget/StatefulWidget → 布局与 Material 组件 → Navigator 导航与状态管理 → http/dio 对接后端。**追求原生深度/进大厂原生岗 → 原生**:iOS 走 Swift + SwiftUI(见 [iOS](/learning-paths/mobile/ios-native)),Android 走 Kotlin + Jetpack Compose(见 [Android](/learning-paths/mobile/android-native));**国内多端/小程序 → uni-app + 小程序**(见 [uni-app](/learning-paths/mobile/uniapp) 与 [小程序](/learning-paths/mobile/wechat-miniprogram))。

## 移动端通用技能(与框架无关的必修)

**①UI 与交互**:移动设计规范(Material Design 与 iOS HIG 的差异:导航/返回/手势)、列表与详情的主流交互、空态/加载态/错误态三件套;②**网络层**:HTTP 客户端封装(拦截器加 token/统一错误)、JSON 解析、**弱网与断网处理**(移动网络比 Web 残酷:超时重试/离线缓存);③**本地存储**:键值(偏好设置)与数据库(SQLite/Room/Core Data 等)的分工;④**权限管理**:相机/相册/定位的**运行时权限申请**(用户拒绝/不再询问的处理——移动端特有);⑤**性能**:列表虚拟化(FlatList/ListView.builder/LazyColumn——**别一次渲染上千行**)、图片优化(压缩/懒加载/缓存库:Coil/Kingfisher)、避免无谓重渲染(memo/useMemo)、**计算密集任务别堵 UI 线程**(原生模块/isolate);⑥**发布与分发**:iOS 走 App Store(开发者账号年费+审核+TestFlight 内测);Android 走 Google Play 或**国内厂商商店**(应用宝/华为/小米等,各要软著与审核);国内小程序走微信平台审核——**"能上架"是移动开发与 Web 的最大差异,发布流程要提前规划**(签名/证书/版本管理,CI 用 Fastlane 等)。

## 学习路径建议

**第一步**:选定一条主线(推荐:前端背景选 RN,想学新栈选 Flutter,国内多端选 uni-app);**第二步**:跑通"列表页→详情页→登录→调接口渲染"的最小应用(移动端的第一课是**模拟器与真机调试**);**第三步**:接一个真实后端(自己写的 API 或公开接口),处理加载/错误/空态;第四步:补原生能力(相机/定位/推送)与本地存储;第五步:**发布到商店**(走一遍签名/审核流程——**上过架才算完整做过移动应用**);第六步:按方向深挖(性能/原生模块/CI/CD/跨端桌面)。

## 通关标准

能独立做到:用选定的技术栈做出一个带登录、列表详情、本地存储、网络请求的完整 App;在真机上运行并处理好权限申请与弱网场景;讲清自己技术栈的选型理由与原生/跨平台的取舍;把应用发布到一个商店(或完成发布全流程);列表/图片性能优化达标(不卡顿不爆内存)——移动端主线通关。

移动端开发的本质是"**在一个资源有限、体验要求极高的终端上做工程**":屏幕小、网络弱、审核严、碎片多——**这些约束决定了它与 Web 开发的不同手感**。选型没有标准答案,只有"适合你团队与产品"的答案:先跑通一个最小应用验证选型,再决定深挖原生还是跨平台;**能上架、能被用户用起来,是移动开发者的"完成"标准**。下一步:按上表选一条主线进对应页面,或先看 [桌面端](/learning-paths/desktop/overview) 了解跨端延伸。
