# React Native 学习路线

React Native(Facebook/Meta 出品)是**用 JavaScript/React 写 iOS 与 Android 的跨平台框架**:不是 WebView 套壳,而是**真正的原生组件渲染**(JS 逻辑 + 原生 UI)——**会 React 的人学 RN 几乎零成本**:组件、Hooks、状态、生态工具全是同一套(前提:先通关 [React](/learning-paths/frontend/react) 与 [JavaScript](/learning-paths/frontend/javascript))。**定位**:跨平台三派里"前端迁移成本最低、生态最大"的选择;性能接近原生(复杂动画/重型计算仍不如原生,但大多数应用足够)。**新项目推荐走 Expo**(官方推荐的开发工具链:脚手架/真机预览/云构建,见后)。

## 为什么选 React Native

**①技能复用**:React 开发者无缝迁移(状态/组件/工具链同一心智),Web 团队的移动端首选;**②生态庞大**:npm 生态 + 原生模块库(相机/定位/支付/推送几乎都有现成库);**③迭代快**:热重载(改代码秒级生效)、Expo 的快速预览;**④社区与公司背书**:Meta 维护,大厂应用验证(Instagram/Facebook 等)。**代价**:性能上限低于原生(桥接/JS 线程瓶颈,新架构 New Architecture 正在改善);复杂原生能力要写原生模块;两端 UI 细节需分别调。

## 基础篇:环境与核心组件

**环境(现代姿势)**:Node + **Expo**(`npx create-expo-app`——脚手架/模拟器/真机扫码预览一条龙,新项目默认);想完全控制原生代码再走 React Native CLI(需 Xcode/Android Studio)。**RN 与 Web 的差异(第一课)**:没有 DOM/HTML/CSS——**一切皆组件**:核心组件 `View`(容器,对应 div)/`Text`(文本,不能用字符串裸放)/`Image`/`TextInput`/`Pressable`(触摸);**样式是 JS 对象**(StyleSheet.create,类 CSS 子集:flexbox 为主、无 CSS 文件);**Flexbox 布局**(与 Web 同思维:flexDirection/justifyContent——RN 默认 column 与 Web 不同,注意);尺寸单位无 px(逻辑像素)。
**触摸与手势**:Pressable(按压状态回调)/Touchable 系列;**列表(性能关键)**:`FlatList`(虚拟化长列表:只渲染可视区——**别用 map 渲染长列表**)/SectionList(分组);**ScrollView**(短内容滚动)。

## 进阶篇:导航、状态与数据

**导航(移动端页面流转)**:React Navigation 事实标准——**Stack(栈导航:页面推入弹出,原生返回手势)/Tab(底部标签)/Drawer(抽屉)**;参数传递(route.params)与返回;**深链**(外部链接进指定页,发布必备);**状态管理**:本地 useState、跨组件 Context、**全局 Zustand/Redux Toolkit**(与 Web 同款选型逻辑,见 [React](/learning-paths/frontend/react) 状态章);**网络**:fetch/Axios + 拦截器(加 token/统一错误)——**与 Web 同套路**;**本地存储**:AsyncStorage(键值,类似 localStorage)/MMKV(高性能)/expo-sqlite(关系数据)——**移动端没有 Cookie,登录态自己管**(token 存 SecureStore/Keychain 更安全,见 [认证](/learning-paths/security/auth))。

## 实战篇:功能、性能与发布

**UI 组件库**:React Native Paper(Material)/NativeBase,或自定义;**系统能力(通过 Expo 模块或社区库)**:相机与相册(expo-image-picker)、定位(expo-location)、推送(Expo Notifications 或厂商通道)、**权限申请要处理"拒绝/不再询问"**;**性能优化**:FlatList 的 key/优化项、**避免无谓重渲染**(React.memo/useMemo——同 Web 心法)、图片优化(尺寸/缓存)、**动画用 Reanimated**(原生驱动,别用 JS 动画做复杂效果)、**Hermes 引擎**(默认开启,内存与启动优化);**原生模块**:需要自定义原生能力时写原生模块或找现成库——**"RN 做不到的,原生代码补"是它的边界意识**;**发布**:Expo EAS Build(云构建签名)→ iOS(App Store:TestFlight 内测)与 Android(Play/国内商店)流程——发布细节见 [iOS](/learning-paths/mobile/ios-native)/[Android](/learning-paths/mobile/android-native) 的发布章;**热更新**(CodePush/Expo Update:不发版修 bug——**注意审核合规**)。

## 学习路径与进阶

**路径**:Expo 建项目跑通"Hello"→ 核心组件与 Flexbox(做出静态页)→ FlatList + 导航(列表与页面流转)→ 状态 + 网络(调真实 API)→ 本地存储与登录态 → 系统能力(相机/定位)→ 性能打磨 → EAS 发布。**进阶**:Reanimated + Gesture Handler(复杂手势与动画)、Expo 生态深入(通知/更新/构建)、TypeScript(全项目 TS 是 RN 标配——见 [TypeScript](/learning-paths/frontend/typescript))、原生模块开发、**React Native for Web/桌面**(一套代码更多端)。

## 通关标准

能独立做到:用 Expo + RN + TypeScript 做出带登录、列表详情(FlatList)、导航、本地存储、网络请求的完整 App;在真机跑通(Expo Go 扫码)并处理权限申请;讲清 RN 与 Web React 的差异(组件/样式/导航/存储)与性能注意事项;用 EAS 完成一次 iOS 或 Android 的构建与内测分发——React Native 主线通关。

React Native 是"**Web 开发者进入移动端的最短路径**":React 心智全程复用,Expo 把环境与发布的脏活也包了大半——**小团队与前端团队做 App 的现实首选**。它的边界也清晰:**性能与深度原生能力不如原生,但"大多数应用足够"**;记住跨平台是"效率与性能的权衡",选它就用好它的效率,把性能留给真正需要的角落(必要时原生模块补齐)。下一步:对照 [Flutter](/learning-paths/mobile/flutter) 看自绘派的取舍,或先通关 [React](/learning-paths/frontend/react)。
