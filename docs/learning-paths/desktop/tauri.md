# Tauri 学习路线

Tauri 是 **Electron 的轻量级替代**:前端仍是 Web 技术(React/Vue/Svelte 随意),后端与系统能力用 **Rust**,UI 跑在**系统 WebView**(不打包 Chromium)——**包体积小 10 倍(几 MB vs 几十 MB)、内存占用低、启动快、性能好**;Rust 后端带来安全与性能(内存安全无 GC——见 [Rust](/learning-paths/backend/rust-web) 语言路线)。**适合**:对体积/内存/性能敏感的桌面工具、想用 Rust 写系统层的团队、Electron 的"重"已成痛点时。**代价**:生态小于 Electron(插件与踩坑资料在追赶)、不同平台 WebView 有差异(Windows WebView2/macOS WKWebView)、**要学 Rust 后端**(但 Tauri 把常见系统 API 封装好了,初学 Rust 够用)。

## 为什么选 Tauri

**①小与快**:安装包 3-10MB(Electron 的十分之一)、内存低、启动快——**工具类应用的用户体感差异明显**;**②前端体验不变**:UI 层就是 Web 开发,前端框架随意选(React/Vue/Svelte + Vite 工程化);**③Rust 后端**:系统命令用 Rust 写——性能好、内存安全、**攻击面比 Node 后端更可控**;**④安全设计**:默认权限白名单(前端只能调你允许的命令——**比 Electron 的"渲染进程全能力"更安全的心智**)。**代价**:生态与案例少于 Electron、WebView 平台差异要测、Rust 学习曲线(Tauri 封装了大量 API,入门只需 Rust 基础:所有权/结构体/命令函数)。

## 基础篇:环境、架构与命令系统

**环境**:装 Rust(rustup)与系统依赖;`npm create tauri-app` 脚手架(选前端框架)→ `npm run tauri dev`(开发窗口)。**项目结构**:前端(src/ 常规 Web 工程)+ `src-tauri/`(Rust:main.rs/lib.rs 命令 + tauri.conf.json 配置)+ `src-tauri/capabilities/`(**权限白名单:前端能调哪些命令/API——Tauri 的安全特色,配置要理解**)。**命令系统(核心机制,对应 Electron 的 IPC)**:Rust 里 `#[tauri::command] fn greet(name: String) -> String` + 注册 → 前端 **`invoke('greet', &#123; name &#125;)` 调用并拿 Promise 结果**——**"点按钮 → Rust 算 → 回前端"是第一个里程碑**;参数与返回值走 serde 序列化(结构体传参——**类型在前后端之间被 Rust 的强类型约束住**)。

## 进阶篇:系统 API 与事件

**系统能力(官方插件 tauri-plugin-*)**:对话框(文件选择/保存——dialog 插件)、文件系统(fs 插件,注意作用域配置)、窗口管理(window:尺寸/置顶/无边框/自定义标题栏)、系统托盘与菜单(tray/menu)、通知(notification)、剪贴板、HTTP 请求(或前端直接 fetch——**CORS 在 WebView 的处理与浏览器同规则**)、全局快捷键;**事件系统(双向通信)**:Rust 向前端 `emit` 事件(进度推送/后台任务通知),前端 `listen` 监听——**配合 Rust 的并发(线程/async)做后台任务**;Rust 侧还能跑计算密集任务(性能活交给 Rust——**Tauri 的定位优势**)。

## 实战篇:集成、优化与发布

**前端集成**:Vite + React/Vue + TS 全流程(与 Web 工程一致——见 [Vite](/learning-paths/frontend/vite));**性能优化**:减少 Rust↔前端通信频率(批量传数据)、计算密集任务放 Rust、前端代码分割(同 Web);**打包发布**:`tauri build` 出三平台安装包(Windows MSI/NSIS、macOS DMG/App、Linux deb/AppImage);**图标与元数据**配置、**代码签名**(macOS/Windows——与 Electron 同规则,见 [Electron](/learning-paths/desktop/electron) 分发章);**自动更新**:Tauri 内置更新器(需自己搭更新服务器或接平台)——**桌面应用持续交付**;**测试**:前端测试同 Web 栈,命令逻辑可用 Rust 单测(cargo test——见 [Rust](/learning-paths/backend/rust-web) 测试章)。

## 学习路径与进阶

**路径**:脚手架建项目跑通 → 写第一个 command 并前端 invoke(理解通信)→ 官方插件做文件/对话框/托盘(做出"系统感")→ 接 React/Vue 做真实 UI → Rust 写一个计算/IO 命令(体验 Rust 后端的价值)→ tauri build 打包 → 签名与更新。**进阶**:Rust 深入(见 [Rust Web](/learning-paths/backend/rust-web))、tauri-plugin 生态、移动端支持(Tauri Mobile,尝鲜)、**与 Electron 的迁移评估**(UI 层可复用,IPC 改 invoke——**换框架不换前端是跨平台方案的红利**)。

## 通关标准

能独立做到:用 Tauri 做出带文件读写、对话框、系统托盘与菜单的完整工具并打出小体积安装包;说清 invoke 通信模型与 capabilities 权限白名单的意义(对比 Electron 的 IPC/安全差异);Rust 侧写过至少一个真实命令(含参数结构体与错误处理);理解签名与自动更新的配置;给出"我的应用该用 Electron 还是 Tauri"的评估理由——Tauri 主线通关。

Tauri 的哲学是"**把体积与性能还给桌面**":系统 WebView 省掉浏览器包袱,Rust 后端带来安全与速度——**它是 Electron 的"精装替代",适合追求轻量与性能的团队**。它真正的功课不是前端(同 Web),而是 **Rust 命令与权限模型**——把 invoke 通信与 capabilities 吃透,你既享受 Web 的开发效率,又拿到 Rust 的系统能力。**选型提醒:生态差距在缩小,但"复杂生态依赖(Electron 系库)"仍是 Electron 的护城河——按应用类型选,不按体积焦虑选**。下一步:补 [Rust](/learning-paths/backend/rust-web) 后端底子,或对照 [Electron](/learning-paths/desktop/electron) 做选型评估。
