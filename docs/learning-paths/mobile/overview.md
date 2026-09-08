# 移动端开发学习路线

从 iOS、Android 原生开发到跨平台方案，移动端开发有多种选择。这条路线帮你找到最适合自己的技术栈，快速上手移动应用开发。

## 技术选型：原生 vs 跨平台

### 原生开发

**iOS（Swift/SwiftUI）**
- 性能最优
- 原生体验最好
- 只能开发 iOS 应用
- 学习成本高

**Android（Kotlin/Jetpack Compose）**
- 性能优秀
- Google 官方支持
- 只能开发 Android 应用
- 设备碎片化需要兼容

**何时选原生？**
- 对性能要求极高（游戏、AR/VR）
- 需要深度使用平台特性
- 团队有专门的 iOS/Android 开发者

### 跨平台开发

**React Native**
- 用 React 写移动应用
- 生态成熟，社区活跃
- 性能接近原生
- 适合有前端背景的开发者

**Flutter**
- Google 出品
- 自绘引擎，性能优秀
- 组件丰富，界面统一
- Dart 语言需要学习

**Ionic / Capacitor**
- 基于 Web 技术（HTML/CSS/JS）
- 可复用 Web 代码
- 性能稍弱于 RN 和 Flutter
- 适合简单应用

**何时选跨平台？**
- 同时需要 iOS 和 Android 版本
- 团队人手有限
- 快速迭代、MVP 阶段
- 对极致性能要求不高

## 上手路线

**React Native（React 技术栈）**
从 Expo 脚手架起步（对初学者最友好），掌握核心组件与 Flexbox 布局、React Navigation 导航、数据获取与状态管理、本地存储，再按需接入相机、定位、推送等原生能力。完整路线见 [React Native 学习路线](/learning-paths/mobile/react-native)。

**Flutter（Dart 技术栈）**
先过一遍 Dart 语法与"一切皆 Widget"思想，再掌握 StatelessWidget / StatefulWidget、常用布局、Navigator 导航与 Provider 状态管理，最后用 http 包对接后端。完整路线见 [Flutter 学习路线](/learning-paths/mobile/flutter)。

**iOS / Android 原生**
追求极致性能与原生体验时选择原生：iOS 走 Swift + SwiftUI（见 [iOS 原生学习路线](/learning-paths/mobile/ios-native)），Android 走 Kotlin + Jetpack Compose（见 [Android 原生学习路线](/learning-paths/mobile/android-native)）。

**uni-app / 微信小程序**
国内多端发布与小程序生态，可看 [uni-app 学习路线](/learning-paths/mobile/uniapp) 与 [微信小程序学习路线](/learning-paths/mobile/wechat-miniprogram)。

## 性能优化

- 使用 `FlatList` / `ListView.builder` 而非直接渲染大量子组件
- 图片优化（压缩、懒加载、缓存）
- 避免不必要的重新渲染（React.memo、useMemo）
- 使用原生模块处理计算密集型任务
- 减少桥接通信（React Native）

## 发布上架

**iOS（App Store）**
1. 注册 Apple Developer（99 美元/年）
2. 在 App Store Connect 创建应用
3. 准备截图、描述、关键词
4. 提交审核（通常 1-3 天）

**Android（Google Play）**
1. 注册 Google Play Developer（25 美元一次性）
2. 准备 APK/AAB 文件
3. 填写应用信息
4. 提交审核（通常几小时）

## 学习资源

- [React Native 官方文档](https://reactnative.dev/)
- [Flutter 官方文档](https://flutter.dev/)
- [SwiftUI 教程](https://developer.apple.com/tutorials/swiftui)
- [Jetpack Compose 教程](https://developer.android.com/jetpack/compose)

## 下一步学习

- **性能优化** - Profiling、内存管理
- **原生模块** - 集成原生代码
- **CI/CD** - Fastlane、Bitrise
- **应用分发** - TestFlight、Firebase App Distribution
- **跨平台桌面** - React Native for Windows/macOS

---

移动端开发市场需求大，技术栈选择多。React Native 和 Flutter 是主流，原生开发性能最优但成本高。选择一个方向深入，做出几个完整的应用，就能找到工作。加油！
