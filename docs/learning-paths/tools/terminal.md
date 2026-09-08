# 终端效率学习路线

终端，程序员的第二个家。从基础命令到高级技巧，从快捷键到自动化脚本，掌握终端能让你的开发效率飞速提升。学会它，你就掌握了命令行的艺术。

## 为什么学终端

- 效率远超 GUI，批量操作轻松
- 自动化脚本，解放双手
- 服务器运维必备技能
- 开发工具大多基于命令行
- 极客必备，装 X 利器

## 学习路线图

### 第一阶段：Shell 选择

**Bash vs Zsh**
- Bash（默认 Shell）
- Zsh（推荐，功能更强）
- 查看当前 Shell
- 切换默认 Shell
- Shell 配置文件（.bashrc、.zshrc）

**Oh My Zsh**
- 安装 Oh My Zsh
- 主题选择
- 插件系统
- 自动补全
- 语法高亮

**主题配置**
- Powerlevel10k（推荐）
- agnoster
- robbyrussell（默认）
- 自定义提示符
- Git 状态显示

### 第二阶段：基础命令

**导航命令**
- cd 切换目录
- pwd 当前路径
- ls 列出文件
- tree 目录树
- which 命令位置

**文件操作**
- cp 复制
- mv 移动/重命名
- rm 删除
- mkdir 创建目录
- touch 创建文件
- ln 创建链接

**文本处理**
- cat / less / more 查看
- grep 搜索
- sed 流编辑
- awk 文本分析
- head / tail 部分内容

**系统信息**
- top / htop 进程监控
- df 磁盘使用
- du 目录大小
- free 内存信息
- uptime 系统运行时间

### 第三阶段：高效工具

**现代化替代**
- exa（替代 ls）
- bat（替代 cat）
- fd（替代 find）
- rg（ripgrep，替代 grep）
- fzf（模糊搜索）

**效率插件**
- zsh-autosuggestions（历史建议）
- zsh-syntax-highlighting（语法高亮）
- autojump（快速跳转）
- z（目录跳转）
- thefuck（命令纠正）

**终端复用**
- tmux 会话管理
- 窗口分割
- 会话保持
- 自定义配置
- 快捷键绑定

**文件管理**
- ranger（文件管理器）
- nnn（轻量文件管理）
- lf（Go 实现）
- 快速导航
- 预览功能

### 第四阶段：别名与函数

**常用别名**
- ll（ls -lah）
- ..（cd ..）
- git 命令简化
- docker 命令简化
- 项目快速跳转

**自定义函数**
- 参数处理
- 条件判断
- 循环操作
- 错误处理
- 复用性设计

**环境变量**
- export 设置变量
- PATH 路径管理
- 配置文件加载
- 项目特定配置
- 敏感信息管理

### 第五阶段：脚本自动化

**Shell 脚本基础**
- 脚本结构
- 变量与参数
- 条件判断（if）
- 循环（for、while）
- 函数定义

**实用脚本**
- 批量文件处理
- 自动备份
- 服务监控
- 日志分析
- 部署脚本

**调试技巧**
- set -x 调试模式
- echo 输出调试
- shellcheck 语法检查
- 错误处理
- 日志记录

## 下一步学习

学完终端基础后，可以继续探索：
- **Vim/Neovim**：终端编辑器
- **Linux 系统管理**：深入服务器运维
- **Docker**：容器化技术
- **自动化运维**：Ansible、Terraform

## 推荐工具

**终端模拟器**
- iTerm2（macOS）
- Alacritty（跨平台，GPU 加速）
- kitty（功能丰富）
- Warp（现代化终端）
- WezTerm（强大配置）

**效率神器**
- fzf：模糊搜索
- zoxide：智能跳转
- tldr：简化的命令帮助
- httpie：友好的 HTTP 客户端
- jq：JSON 处理

**常用别名示例**

- 导航：`..` = `cd ..`、`...` = `cd ../..`、`~` = `cd ~`
- ls 增强：`ll` = `ls -lah`、`la` = `ls -A`
- Git 简化：`gs` = git status、`ga` = git add、`gc` = git commit、`gp` = git push
- Docker 简化：`d` = docker、`dc` = docker-compose、`dps` = docker ps
- 快速编辑：`zshrc` = vim ~/.zshrc、`vimrc` = vim ~/.vimrc

按照自己的习惯维护一份 alias 清单（写在 `~/.zshrc` 或 `~/.bashrc`），是提升终端效率的第一步。

掌握终端，你就掌握了效率的精髓。从基础命令到高级脚本，从快捷键到自动化工具，终端让你的工作事半功倍。别被黑屏吓到，命令行其实很友好。先从 cd、ls、cat 这些简单命令开始，慢慢积累。记住：Tab 键是你最好的朋友，历史记录（↑）能省很多时间。多实践，多探索，终端会成为你最强大的生产力工具。
