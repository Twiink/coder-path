# Electron 学习路线

Electron = **Chromium(渲染 UI)+ Node.js(系统能力)**:用 HTML/CSS/JS 写桌面应用,一套代码跑 Windows/macOS/Linux——VS Code、Slack、Discord、Notion、Figma 客户端都是它。**前端开发者零成本进入桌面开发**,生态最成熟、成功案例最多,是"复杂桌面应用"的默认选择(前提:先通关 [JavaScript](/learning-paths/frontend/javascript) 与一个前端框架)。

## 为什么选 Electron

**①技能复用**:前端栈直接上手(UI 层就是 Web 开发),团队迁移成本最低;②**跨平台**:一套代码三平台(UI 一致性靠 Chromium 保证);③**生态成熟**:系统 API 封装齐全(托盘/菜单/对话框/通知/文件)、打包工具链完善、踩坑资料海量;④**UI 天花板高**:Web 技术做复杂交互(富文本/图表/拖拽)比原生快得多。**代价(要认)**:包体积 50MB+(打包整个 Chromium)、内存占用高、启动相对慢——**对多数业务可接受,VS Code 就是证明**;性能敏感处要优化(见后)。

## 基础篇:三进程架构(第一课,必须吃透)

Electron 应用由三类进程组成:**①主进程(Main,Node 环境)**:应用入口、创建窗口、系统能力(文件/菜单/托盘/对话框)——**有全部系统权限**;②**渲染进程(Renderer,Chromium)**:每个 BrowserWindow 一个——**跑 UI(就是 Web 页面)**;③**预加载脚本(Preload)**:在主/渲染之间的"桥"——**安全通信的唯一通道**。**进程通信(IPC)**:渲染进程不能直接调 Node——`ipcRenderer.invoke`(渲染→主,拿 Promise 结果)与 `ipcMain.handle`(主进程响应)——**"点按钮 → 主进程读文件 → 返回结果给页面"是第一个里程碑**。**安全基线(桌面应用的红线,比 Web 更硬)**:渲染进程是"不可信区域"(可能被 XSS)——必须:**`contextIsolation: true`(默认)、`nodeIntegration: false`(禁 Node,默认)、preload 里用 `contextBridge.exposeInMainWorld` 只暴露最小 API**——**否则页面里一个 XSS 就能读你电脑文件**(见 [Web 安全](/learning-paths/security/web-security) 与 Electron 安全文档)。**窗口管理**:BrowserWindow(尺寸/无边框/置顶/事件:close/minimize)。

## 进阶篇:系统能力与功能集成

**菜单与快捷键**:Menu(应用菜单:macOS 的 App 菜单必须)/右键菜单(在渲染进程里触发,主进程建 Menu.popup)/全局快捷键(globalShortcut);**对话框**:dialog(打开文件/保存/消息框——**文件选择的唯一正道,别用 HTML input**);**文件与路径**:Node 的 fs/path(主进程)——**桌面应用的核心能力:读写用户文件**;**系统集成**:Tray(托盘图标:最小化到托盘是桌面应用标配)、Notification(系统通知)、app 生命周期(单实例锁/开机启动/协议关联);**数据持久化**:electron-store(JSON 配置,替代手动读写);**原生模块**:需要 C++ 能力时集成 Native Node Modules(重编译,进阶)。

## 实战篇:工程化、优化与发布

**前端框架集成(别裸写)**:Vite + React/Vue + electron-vite(现代脚手架:主/preload/渲染三端打包)——**UI 层开发体验与 Web 完全一致**;**性能优化(对症下药)**:启动速度(懒加载/减少主进程同步操作)、内存(webPreferences 合理配置、页面销毁清理、Web Workers 跑计算密集任务——**别让复杂计算卡住 UI**)、包体积(按平台裁剪/资源压缩);**打包发布**:electron-builder(或 Forge)——**三平台安装包(Windows NSIS/macOS DMG/Linux AppImage)一条命令**;**代码签名(macOS 与 Windows 的硬门槛)**:Apple Developer 证书(含公证 notarization——**不公证 macOS 用户打不开**)与 Windows 签名证书——**签名是"专业分发"的分水岭**;分发渠道:官网下载/自动更新(Mac App Store 另走沙盒规则);**自动更新(electron-updater)**:版本检测 + 增量下载 + 重启安装——**桌面应用持续交付的答案(不然每次发版要用户重装)**;**测试**:Playwright 的 Electron 支持做 E2E(见 [测试](/learning-paths/fullstack/testing))、electron-log(日志)。

## 学习路径与进阶

**路径**:electron-vite 脚手架跑通 Hello → 理解三进程与 IPC(做一个"主进程读文件展示在页面"的示例)→ 系统能力(菜单/托盘/对话框)→ 接 React/Vue 做真实 UI → 文件读写与本地存储(做个 Markdown 笔记工具)→ electron-builder 打包 → 签名与自动更新。**进阶**:Electron Forge(官方现代化工具链)、contextBridge 安全模式深入、Native Modules、**对照 Tauri 评估"要不要换轻量方案"**(见 [Tauri](/learning-paths/desktop/tauri))。**开源学习**:VS Code/Notion 的架构文章——**读大厂 Electron 应用怎么做进程拆分与性能优化,胜过十篇教程**。

## 通关标准

能独立做到:说清主/渲染/preload 三角与为什么必须开 contextIsolation 关 nodeIntegration;用 IPC 完成一次"渲染触发→主进程系统调用→结果回传";做出带托盘/菜单/对话框/文件读写的完整工具并用 electron-builder 打出安装包;理解代码签名与自动更新的必要性并配置过(或完整演练);能说出 Electron 的内存/启动优化三板斧——Electron 主线通关。

Electron 的哲学是"**用体积换生态与效率**":每个应用都背一个 Chromium,换来的是前端团队的零门槛与 UI 的无限可能——**对多数产品这是划算的交易(VS Code 们证明了)**。它真正的功课不在 UI(那是 Web 的活),而在**进程模型、IPC 边界与安全基线**——把这三样吃透,Electron 应用既快又安全。**记住:桌面应用 = Web UI + 系统能力 + 分发签名**,三样都要会才算完整交付。下一步:评估轻量派 [Tauri](/learning-paths/desktop/tauri),或先补 [React](/learning-paths/frontend/react)/[Vue](/learning-paths/frontend/vue) 做 UI 底子。
