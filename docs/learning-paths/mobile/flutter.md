# Flutter 学习路线

Google 出品的跨平台 UI 框架，一套代码跑 iOS、Android、Web、桌面。用 Dart 语言写界面，自绘引擎渲染，性能接近原生。组件丰富，热重载快，开发体验极佳。不是 WebView，不是原生组件包装，而是直接在 Canvas 上绘制，这就是 Flutter 的底气。

## 为什么选择 Flutter

跨平台方案中性能最好的之一，UI 流畅度接近原生。一套代码多端运行，代码复用率极高。热重载速度快，改代码立即看到效果，开发效率高。Material Design 和 Cupertino 组件开箱即用，不用从零写 UI。生态快速成长，第三方包丰富。Google 背书，社区活跃，学习资源多。

## 学习路线图


### 基础篇：语言与组件

- **开发环境搭建**：Flutter SDK 安装、IDE 配置、模拟器设置
- **Dart 语言基础**：变量类型、函数、类与对象、空安全
- **Dart 进阶**：异步编程（Future、Stream）、泛型、Mixin
- **基本 Widget**：Text、Image、Icon、Button 系列

### 进阶篇：布局与状态

- **布局 Widget**：Container、Row、Column、Stack、ListView、GridView
- **有状态 Widget**：StatefulWidget、生命周期、setState
- **表单处理**：Form、TextFormField、验证器、提交处理
- **导航系统**：Navigator、命名路由、参数传递、返回值

### 实战篇：数据与发布

- **状态管理**：Provider、Riverpod、Bloc 选型与使用
- **网络请求**：http、dio、RESTful API、错误处理
- **本地存储**：shared_preferences、sqflite、Hive
- **图片选择**：image_picker、相机调用、文件上传
- **性能优化**：const 构造、ListView 优化、避免不必要构建
- **打包发布**：Android 签名、iOS 证书、应用商店上架

## 下一步学习

完成基础路线后，可以深入探索：

- **Flutter Riverpod**：现代状态管理
- **GetX**：轻量级状态管理和路由
- **Flutter Animations**：动画和过渡效果
- **Flutter Web**：Web 应用开发
- **Flutter Desktop**：桌面应用开发
- **Flutter Plugin**：原生插件开发

---

Flutter 跨平台性能最好，开发体验极佳，热重载快，组件丰富。一套代码多端运行，维护成本低。Dart 语言简洁，上手快。记住：Flutter 适合快速迭代，但遇到复杂原生需求可能需要写插件。加油！
