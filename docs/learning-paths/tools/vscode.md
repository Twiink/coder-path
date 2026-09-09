# VS Code 学习路线

VS Code 是微软开源的现代编辑器:轻量、快、插件生态庞大,几乎支持所有语言,是当下开发者使用率第一的编辑器。**先建立最重要的一条心智:VS Code 自己是"壳",语言的智能(补全/跳转/重构)来自"语言服务器"(LSP 架构)**——所以"编辑器聪不聪明"取决于你装没装对语言扩展,而不是编辑器本身。它与 JetBrains 全家(重量级 IDE)的选型:重度单一语言/偏好全功能 IDE 用 JetBrains;多语言、轻量、远程开发、前端生态用 VS Code——**语言服务器时代,VS Code 已覆盖九成场景**。

这条线按 **界面与命令面板 → 快捷键与多光标 → 智能编辑与导航 → Git 与调试 → 插件生态 → 远程开发 → 进阶工作流** 推进。

## 第一站:界面、命令面板与设置

**界面五区认门**:活动栏(最左图标)/侧边栏(文件树/搜索/源码管理)/编辑器(可分屏)/面板(底部:终端/输出/调试控制台/问题)/状态栏(右下:语言/行号/git 分支)。**命令面板(最重要的入口,记死快捷键)**:`Cmd/Ctrl+Shift+P`——**所有操作都能搜**:执行命令/打开设置/装插件/切换主题,想不起快捷键就打开它搜。
**code 命令**:装好编辑器后在终端敲 `code .`(用 VS Code 打开当前目录)——**终端与编辑器打通的第一件事**(配合 [终端](/learning-paths/tools/terminal) 工作流)。**设置三级**:用户(全局)/工作区(项目,.vscode/settings.json——**提交进 git,团队共享**)/文件夹;**关键设置**:formatOnSave(保存即格式化)、editor.fontSize/字体(编程等宽字体,中文环境配好 fallback)、files.exclude/search.exclude(排除大目录提速)、`"editor.formatOnSave": true` + 默认格式化器;**团队推荐扩展**(.vscode/extensions.json——新同事打开即提示装齐);**Settings Sync**(登录账号同步配置与插件——换机五分钟恢复)。

## 第二站:快捷键与多光标——编辑速度的飞跃

**核心快捷键组(先背这十个)**:`Cmd+P` 快速打开文件(输名字即跳——**不开文件树找文件**)、Cmd+Shift+P 命令面板、`Cmd+B` 切侧边栏、`Cmd+J` 切终端、`Cmd+\` 分屏、`Cmd+F`/`Cmd+Shift+F`(文件内/全局搜索)、`Cmd+D`(选择下一个相同词——批量改名的起点)、`Cmd+/` 注释切换、`Alt+↑↓` 移动行、`Cmd+Shift+K` 删行。**多光标(VS Code 的招牌,批量编辑的核武器)**:`Alt+Click` 任意位置加光标(同时改多处)、Cmd+D 连续选中相同词(批量改名)、`Alt+Shift+拖动` 列选择(方块编辑:对齐的代码块/表格)、Cmd+Shift+L(全选所有匹配)——**"同一模式出现 N 次"的编辑一律多光标,别一个个改**。**Emmet(写 HTML/CSS 的速度作弊器)**:输入 `ul>li*3>a&#123;链接&#125;` 按 Tab 展开成完整结构——前端写模板必备。**原则:高频动作全走快捷键**;`Cmd+K Cmd+S` 打开快捷键设置,自定义顺手的。

## 第三站:智能编辑与导航——装对语言扩展

**语言服务器是智商的来源,第一件事装对扩展**:JS/TS(内置最强)、Python(装 **Pylance**)、Vue(装 **Volar**,别装老的 Vetur)、React(配 TS 内置 + ESLint)、Go(官方扩展)、Rust(**rust-analyzer**)、Java(Extension Pack)、C/C++(微软 C/C++)、SQL/数据库(或连 IDE 客户端)——装错/没装 = "编辑器不智能"的真相。
**智能能力清单(会用这些才算会用)**:IntelliSense 补全(类型提示、**自动导入**(输名字自动引包))、**F12 跳转定义/Shift+F12 查引用**(跨文件追踪代码)、Cmd+Shift+O(文件内符号跳转)、面包屑导航、`Cmd+-` 回退位置;**F2 重命名(跨文件安全重命名——LSP 的魔法,别用查找替换改符号名)**;**全局搜索的进阶**(Cmd+Shift+F:正则、按文件类型过滤、**替换预览**(先看影响范围再替换——重构安全)。
**格式化与检查**:Prettier(唯一格式化器)+ ESLint(问题面板红波浪——**保存时自动修复**配置 `editor.codeActionsOnSave`);**问题面板是你的"实时编译错误列表"**,比等构建报错快一个时代;**错误信息悬浮**(配 Error Lens 插件行内显示——见插件章)。

## 第四站:Git 与调试——编辑器里闭环

**内置 Git(不用切出编辑器)**:侧边栏"源代码管理"——diff 视图(改了什么一目了然)、暂存/提交/推送(写信息+勾选文件)、分支切换与创建、**冲突解决 UI(红绿蓝三色分段选择——比手删标记友好,配合 [Git](/learning-paths/tools/git) 的冲突知识)**;**GitLens 插件**(行内 blame(谁改的这行)/历史(File History)/对比——考古增强;**提醒:GitLens 免费版够用,注意它的推广弹窗**)。
**调试(F5,别只会 console.log)**:`launch.json` 配置调试目标(Node 脚本/Python/浏览器/附加到进程);断点(行断点/条件断点(右键设条件,命中才停)/日志点(不中断只打印——**调试线上逻辑比 console.log 优雅**));调试会话里:单步(Step Over/Into/Out)、变量面板(Watch 监视表达式)、调用栈、调试控制台(实时求值)——**"断点+监视+调用栈"是排查复杂 bug 的正规军,编辑器内置调试让这个习惯零成本**;前端调试:浏览器 Debugger for Chrome/Edge(直接断点 Vue/React 源码)。

## 第五站:插件生态——按需装,防膨胀

**选插件三判据**:官方或高 star、更新活跃、**真解决你的痛点**(不是"看起来酷")。**分类清单(按需取用)**:语言支持(见第三站,必装);格式化与质量:Prettier、ESLint、Error Lens(**报错直接显示在行尾——体验提升巨大**)、Todo Tree(高亮 TODO/FIXME);效率:Path Intellisense(路径补全,新版已内置)、GitLens、Live Server(静态页热预览)、Thunder Client(API 调试,不想开 Postman 时)、Code Spell Checker(英文拼写,写注释与命名友好)、GitHub Copilot/Claude Code 类 **AI 编程助手(2024 后的事实标配——见 [Claude Code](/learning-paths/tools/claude-code))**:主题与图标(选一套顺眼的,One Dark/Catppuccin/官方 Dark+);**插件卫生**:每季度清理不用的插件(每个插件都拖慢启动与占内存);**settings.json 是你的"配置文件"**(与 dotfiles 一样值得进 git——见 [终端](/learning-paths/tools/terminal))。

## 第六站:远程开发——VS Code 的杀手锏

**Remote-SSH(远程开发/排障的标配)**:本地 VS Code 连服务器——**文件树、补全、调试、终端全部像在本地**(实际代码在远端跑):服务器上改代码不再靠 vim 硬扛;**Remote-Containers(容器内开发)**:`.devcontainer/devcontainer.json` 声明开发环境(镜像+扩展+端口)——**"环境即代码":新人 clone 项目,VS Code 自动起容器,环境零配置**(配 [Docker](/learning-paths/devops/docker));WSL(Windows 下 Linux 开发);**Codespaces(云端开发环境)**——GitHub 仓库一键开云开发机。**心智:VS Code 把"本地体验"与"任意远端环境"打通**——这是它对比传统 IDE 的最大结构性优势。

## 第七站:进阶工作流

**一体化工作流(把前面全串起来)**:打开项目 → 终端跑 dev server(分屏面板)→ 改代码(多光标+补全)→ 保存自动格式化+lint → 断点调试 → 侧边栏 commit+push → 问题面板清零——**全程不出一个窗口**;**任务(tasks.json)**:把构建/测试/启动命令固化成 `Cmd+Shift+B` 一键任务;**多根工作区**(同时打开前后端两个项目);**大项目性能**:files.watcherExclude(排除 node_modules 文件监听)、search.exclude、禁用无用扩展——卡顿先查扩展与监听;**快捷键卡**(Cmd+K Cmd+S 里搜"popular"或打印官方 cheatsheet 贴显示器旁——**前两周刻意用快捷键,后面就是肌肉记忆**)。**学习路径建议**:先通读本页"核心快捷键+多光标"并刻意练习一周 → 装语言扩展体验 LSP 智能 → 学会 F5 调试 → 配好 Git 面板 → 最后探索远程与 AI 插件——**别第一天装 50 个插件,先让基础能力长在身上**。

## 通关标准

能独立做到:不看鼠标完成"打开文件→改三处同名变量(多光标)→保存→提交"全流程;给自己的语言装对扩展并体验 F12/F2/自动导入;用条件断点+监视排查过一次复杂 bug;把项目接上 Prettier+ESLint 并让保存自动修复;用 Remote-SSH 连上服务器改代码或配置过 devcontainer;形成自己的 settings.json 与插件清单——VS Code 主线通关。

VS Code 的哲学是"**编辑器是壳,生态是血肉**":轻量的核心 + LSP 的智能 + 插件的扩展 + 远程的能力——学会"按需组装"而非"照单全收",它就是你最顺手的开发台。**编辑器之争没有圣杯,趁手就是王道**:把它配置成"你的形状"(快捷键/主题/片段/settings 进 git),你的编码体验会从"能用"变成"享受"。下一步:AI 结对 [Claude Code](/learning-paths/tools/claude-code),或回 [终端](/learning-paths/tools/terminal) 把命令行也调教好。
