# 桌面端开发学习路线

Web 技术做桌面应用，跨平台、开发效率高。从 Electron 到 Tauri，从传统桌面应用到现代跨平台方案，这条路线带你掌握桌面端开发。

## 技术选型

### Electron：最成熟的方案

**优点**
- 生态成熟，社区活跃
- 用前端技术开发桌面应用
- 跨平台（Windows、macOS、Linux）
- 大量成功案例（VS Code、Discord、Slack）

**缺点**
- 包体积大（最小 50MB+）
- 内存占用高（每个应用都包含 Chromium）
- 启动速度相对慢

**适用场景**
- 复杂的桌面应用
- 需要丰富的 UI 交互
- 团队有前端背景

### Tauri：新兴的轻量级方案

**优点**
- 包体积小（3-5MB）
- 内存占用低
- 使用系统 WebView（不打包浏览器）
- Rust 后端，性能优秀

**缺点**
- 生态相对 Electron 较小
- 不同平台 WebView 差异需要处理
- Rust 学习曲线陡峭

**适用场景**
- 轻量级工具应用
- 对包体积敏感
- 性能要求高

### Qt / .NET MAUI：传统桌面开发

**优点**
- 真正的原生应用
- 性能最佳
- 成熟稳定

**缺点**
- 开发效率低于 Web 技术
- 需要学习 C++ / C#
- UI 开发不如前端灵活

## 上手路线

选好方向后，按下面的路线推进：

**Electron（Web 技术做桌面应用）**
先跑通最小应用（主进程 + 渲染进程 + preload 桥接），再依次掌握进程间通信、文件操作、系统托盘与菜单、打包分发（electron-builder），最后集成 Vite/React 提升开发体验。完整路线见 [Electron 学习路线](/learning-paths/desktop/electron)。

**Tauri（Rust 轻量方案）**
先准备 Rust 环境并创建项目，理解前端与 Rust 后端通过 invoke 通信的机制，再掌握系统 API（对话框、文件、窗口），最后用 `tauri build` 打包分发。完整路线见 [Tauri 学习路线](/learning-paths/desktop/tauri)。

**Flutter Desktop**
用同一套 Flutter 代码编译到桌面端，重点掌握窗口尺寸适配与桌面端专属交互（快捷键、文件拖拽）。完整路线见 [Flutter Desktop 学习路线](/learning-paths/desktop/flutter-desktop)。

各框架的进阶要点（性能优化、自动更新、分发渠道）见下方公共章节。

## 性能优化

**Electron 优化**
- 使用 `webPreferences.offscreen` 减少内存
- 懒加载页面
- 使用 Web Workers 处理计算密集任务
- 优化图片资源

**Tauri 优化**
- 减少 Rust 与前端通信次数
- 使用 Rust 处理计算密集任务
- 前端代码分割

## 分发与更新

**代码签名**
- macOS: Apple Developer 证书
- Windows: Code Signing Certificate

**自动更新**
- Electron: electron-updater
- Tauri: 内置更新系统

**分发渠道**
- 官网下载
- Microsoft Store / Mac App Store
- Snap Store / Flathub（Linux）

## Electron vs Tauri 对比

| 特性 | Electron | Tauri |
|------|----------|-------|
| 包体积 | 50-100MB+ | 3-10MB |
| 内存占用 | 高 | 低 |
| 启动速度 | 慢 | 快 |
| 生态成熟度 | 成熟 | 发展中 |
| 学习曲线 | 平缓 | 需要学 Rust |
| 适用场景 | 复杂应用 | 轻量工具 |

## 学习资源

**Electron**
- [官方文档](https://www.electronjs.org/docs)
- [Electron Fiddle](https://www.electronjs.org/fiddle) - 在线练习

**Tauri**
- [官方文档](https://tauri.app/)
- [示例项目](https://github.com/tauri-apps/examples)

**开源项目学习**
- VS Code（Electron）
- Notion（Electron）
- 1Password（Electron + Rust）

## 下一步学习

- **原生模块** - 集成 C++ 模块
- **插件系统** - 让应用可扩展
- **跨平台兼容** - 处理不同系统差异
- **性能分析** - Profiling 与调优
- **安全加固** - 防止 XSS、注入攻击

---

桌面端开发正在复兴，得益于 Electron 和 Tauri 这样的跨平台方案。用熟悉的 Web 技术，就能开发功能强大的桌面应用。Electron 适合复杂应用，Tauri 适合轻量工具。选一个开始，做出你的第一个桌面应用吧！
