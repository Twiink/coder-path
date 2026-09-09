# 桌面端开发学习路线

**桌面端正在复兴**——不是传统的 C++/Qt 复兴,而是"Web 技术做桌面应用"的跨平台方案(Electron/Tauri)让前端团队能以极低成本占领桌面:VS Code、Slack、Discord、Notion、Figma(客户端)全是这么来的。本页是桌面端全景与选型地图,纵深见 [Electron](/learning-paths/desktop/electron)/[Tauri](/learning-paths/desktop/tauri)/[Flutter Desktop](/learning-paths/desktop/flutter-desktop)。

## 技术选型:三条主流路线

**①Electron(最成熟,复杂应用的默认)**:Chromium + Node.js——**前端技术栈零门槛**:HTML/CSS/JS 直接写 UI,Node 提供系统能力;跨平台(Windows/macOS/Linux)一套代码;生态最成熟、成功案例最多(VS Code/Slack/Discord)。
**代价**:包体积大(最小 50MB+,每个应用打包整个 Chromium)、内存占用高、启动相对慢——**"复杂 UI + 前端团队 + 要快"选它**。**②Tauri(新兴轻量派)**:Rust 后端 + 系统 WebView(不打包浏览器)——**包体积 3-10MB、内存低、启动快、性能好**(前端仍是 Web 技术,后端与系统能力走 Rust);**代价**:生态小于 Electron、不同平台 WebView 有差异、要学 Rust 后端。
**③传统原生(Qt(C++)/.NET MAUI(C#)/Swift(Apple))**:真原生、性能最佳、平台集成最深——**代价**:开发效率低于 Web 技术、要学 C++/C#、UI 迭代慢;适合对性能/系统集成极致要求的专业软件。**④Flutter Desktop**(补充):同一套 Flutter 代码编译到桌面——**移动端团队做桌面的低成本延伸**(见 [Flutter Desktop](/learning-paths/desktop/flutter-desktop))。

**选型速查**:前端团队 + 复杂应用 + 要快 → **Electron**;要轻量/性能/体积敏感(工具类)→ **Tauri**;专业级性能与原生深度 → **Qt/.NET MAUI**;已有 Flutter 移动端 → **Flutter Desktop**。**没有绝对最优:Electron 的"重"对多数业务可接受,Tauri 的"轻"正快速补生态——两者都值得会,先用 Electron 跑通,再按需评估 Tauri**。

## 上手路线

**Electron(Web 技术路线)**:先跑通最小应用——理解**三进程架构(主进程 Node/渲染进程 Chromium/preload 桥)**与 IPC 通信,再依次掌握窗口管理、菜单/托盘/对话框、文件操作、打包分发(electron-builder),最后集成 Vite/React/Vue 提升开发体验——完整见 [Electron](/learning-paths/desktop/electron)。**Tauri(Rust 轻量路线)**:准备 Rust 环境 + 建项目,理解**前端与 Rust 后端通过 invoke 通信**的机制,再掌握系统 API(对话框/文件/窗口)与打包(`tauri build`)——完整见 [Tauri](/learning-paths/desktop/tauri)。**Flutter Desktop**:同一套 Flutter 代码编译桌面,重点适配窗口尺寸与桌面交互(快捷键/拖拽)——见 [Flutter Desktop](/learning-paths/desktop/flutter-desktop)。

## 桌面端通用工程要点(与 Web/移动不同的部分)

**①进程模型与安全(Electron 核心课)**:主进程(系统能力)与渲染进程(UI)隔离,**渲染进程的 XSS 可能升级成系统命令执行**——`contextIsolation` 开启、preload 用 contextBridge 暴露最小 API、禁用 nodeIntegration(见 [Web 安全](/learning-paths/security/web-security) 与 [Electron](/learning-paths/desktop/electron) 安全章)——**桌面应用的安全红线比 Web 更硬(有系统权限)**;**②系统集成**:菜单/托盘/快捷键/对话框/通知/文件关联——桌面应用的"系统感"来自这些原生能力;③**打包与分发**:electron-builder/Tauri 打包出三平台安装包;**代码签名(macOS 公证/Windows 签名——不签名系统警告"未知开发者")**;分发渠道:官网下载/应用商店(Mac App Store/微软商店)/Linux 包(Snap/Flathub);**自动更新(electron-updater/Tauri 内置更新——桌面应用"持续交付"的答案,不用用户重装)**;④**性能**:Electron 的内存与启动优化(懒加载/Web Workers/减少主进程负担)、Tauri 的通信频率控制、渲染进程的 Web 性能优化(同 [前端性能](/learning-paths/fullstack/performance));⑤**测试**:UI 自动化(Playwright 支持 Electron)、端到端流程(见 [测试](/learning-paths/fullstack/testing))。

## 学习路径建议

**第一步**:选 Electron(前端背景默认)建最小应用,理解主/渲染/preload 三角与 IPC("点按钮调主进程读文件"是第一个里程碑);**第二步**:补系统能力(托盘/菜单/对话框/文件)做出"有点桌面感"的工具;第三步:接前端框架(Vite + React/Vue——**别裸写 HTML,工程化同 Web**);第四步:打包(三平台安装包)+ 签名 + 自动更新;**第五步**:评估 Tauri(若体积/内存是痛点)或 Flutter Desktop(若已有移动端)——**桌面技能树:一个主框架打底,其余能评估能迁移**。开源项目是最好的老师:VS Code/Notion 的架构分析、Electron Fiddle 在线练习。

## 通关标准

能独立做到:用选定方案做出一个带系统托盘/菜单、文件读写、窗口管理的桌面工具并打出安装包;说清 Electron 三进程模型与 IPC/安全(为什么禁 nodeIntegration)或 Tauri 的 invoke 通信模型;完成代码签名(或理解其必要性)并配好自动更新;评估过"我的应用该用 Electron 还是 Tauri"并给出理由——桌面端主线通关。

桌面端开发是"**前端技能的最后一公里变现**":Web 技术 + 系统能力 = 用户电脑上的原生应用——它比 Web 多一层"系统集成与分发",比移动多一分"专业工具属性"。**记住选型没有圣杯:Electron 用体积换生态,Tauri 用 Rust 换轻量,原生用效率换极致**——先跑通一个,再横向评估;桌面应用的完整交付(打包/签名/更新)是它区别于 Web 的"成人礼"。下一步:Electron 深潜见 [Electron](/learning-paths/desktop/electron),或先看移动端 [Flutter](/learning-paths/mobile/flutter) 为多端铺路。
