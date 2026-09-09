# 终端效率学习路线

终端是程序员的"第二个家":服务器的管理、Git 的操作、构建与测试、日志排查——命令行是这些场景的共同语言。**学终端的本质不是背命令,而是三条效率心法:少敲(补全/别名/跳转)、快找(模糊搜索)、自动化(脚本)**。命令工具会更新换代(ls → exa/eza、cat → bat、find → fd、grep → rg),**但"管道组合小命令"的心智永不过时**——本页先给骨架命令,再给现代替代,最后给工作流。基础命令细节见 [Linux 路线](/learning-paths/devops/linux)(本页是"开发者本机"视角,那页是"服务器运维"视角)。

这条线按 **Shell 与模拟器 → 快捷键 → 导航与文件 → 搜索与查看 → 环境变量/别名/函数 → 会话管理(tmux)→ 脚本自动化 → 现代工具与工作流** 推进。

## 第一站:Shell、配置文件与终端模拟器

**Shell(Bash vs Zsh)**:Bash 是默认(几乎所有 Linux 都有);**Zsh 是增强版(自动补全更聪明、主题插件生态——macOS 与开发者的主流)**;查看当前 `echo $SHELL`,切换 `chsh -s /bin/zsh`;**配置文件才是"你的终端人格"**:`.bashrc`/`.zshrc`(每次开 shell 加载:别名、函数、环境变量、提示符)——**本页 80% 的个性化都写在这一个文件里**;Oh My Zsh(主题与插件管理器:推荐插件 zsh-autosuggestions(历史灰字建议,→ 补全)/zsh-syntax-highlighting(命令合法就变绿——**拼错命令当场发现**);提示符主题 Powerlevel10k(显示 git 分支/目录/退出码——**一眼知道自己在哪个分支**))。**终端模拟器选型**:系统自带够用;iTerm2(macOS 经典)/kitty 或 Alacritty(GPU 加速快)/Warp(现代 AI 辅助)/Windows Terminal(Windows 标配)——**选一个顺手的用熟,别频繁换**。

## 第二站:快捷键——效率的第一桶金

**"手不离主键区"是终端效率的起点,鼠标是最后的选项**:Tab(补全命令/路径——**按两下 Tab 看候选**)、`Ctrl+r`(历史搜索:输关键词找回以前的命令——**想不起命令拼写就搜历史**)、↑/↓(逐条历史)、`Ctrl+a`(行首)/`Ctrl+e`(行尾)、`Ctrl+u`(删到行首)/`Ctrl+k`(删到行尾)、`Ctrl+w`(删一个词)、`Ctrl+l`(清屏,同 clear)、`Ctrl+c`(中断当前命令)、`Ctrl+d`(退出会话)。**训练方法**:接下来一周,凡是想用鼠标做的编辑动作,先想有没有快捷键——两周后形成肌肉记忆。

## 第三站:导航与文件——少敲几个字

**基础回顾(细节见 Linux 页)**:cd/pwd、`ls -lah`(看隐藏与权限)、cp -r/mv/rm -rf(带 -rf 先确认)、mkdir -p、`ln -s`(软链接)。**跳转进化(高频操作,值得投资)**:`zoxide`(智能 cd:记忆你常去的目录,`z blog` 直接跳到 ~/work/blog——**替代一长串 cd 路径**;或 autojump/z 同类);cd - (回上一个目录)、`cd ~`(回家)。**文件管理**:fzf(模糊搜索一切——**文件/历史/进程**;`Ctrl+t` 选文件路径、`**<Tab>` 补全;与 fd/rg 组合:rg 搜到的文件直接 fzf 打开);tree(目录树)。

## 第四站:搜索与查看——开发者日常的 60%

**搜索代码(rg/ripgrep,必装)**:`rg "关键词"`(当前目录递归,自动尊重 .gitignore——**比 grep 快一个量级,输出带颜色行号**)、`rg -l`(只列文件名)、`rg "pattern" src/ --type py`(限定类型);老 grep 也要会(服务器上没有 rg——见 [Linux](/learning-paths/devops/linux));找文件用 `fd`(语法直觉:`fd keyword`);**查看与管道**:cat(短文件,长文件用 less 翻页)、**tail -f 日志**(跟文件,`-n 100` 先看尾巴);**`|` 管道与 `>` 重定向(把命令串起来:rgaaaa | sort | uniq -c | sort -rn | head——一分钟出个统计报表)**;`jq`(JSON 处理器,API 调试标配:`curl -s api | jq '.data[0].name'`——比肉眼扒 JSON 强一百倍);`tldr 命令`(简洁示例帮助——**比 man 手册快,记不清参数时先 tldr**)。

## 第五站:别名、函数与环境变量——把常用命令变短

**别名(alias)**:`alias ll='ls -lah'`、`alias gs='git status'`、`alias gp='git push'`、`alias dps='docker ps'`——**写进 .zshrc,越用越爽**(示例清单见下文);**函数(alias 不够用时)**:`mkcd() { mkdir -p "$1" && cd "$1"; }`、`take()`、`glog() { git log --oneline --graph; }`——**"用两次以上的命令就固化"是效率原则**。**环境变量**:`export PATH="$HOME/bin:$PATH"`(PATH 决定命令去哪找——装好工具"command not found"先查它);**坑:export 只对当前终端生效,要持久化必须写配置文件**;`echo $PATH` 查看;**敏感信息别写进 .zshrc**(token/密钥——用系统钥匙串或加载器,见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 密钥章);**dotfiles 进 git**(.zshrc/.gitconfig/tmux.conf 放仓库——**换机/换电脑五分钟恢复全部配置**)。

## 第六站:tmux——会话管理,SSH 的保险

**为什么需要 tmux**:SSH 连服务器干活,网络一断任务就没了——**tmux 让会话活在服务器上:断开重连,工作还在**;本地开发也用它"编译看日志、编辑写代码"分屏并行。**核心三概念**:会话(session:一组窗口,`tmux new -s work` 起名)、窗口(window:标签页,prefix c 新建)、窗格(pane:分屏,prefix % 竖分/`"` 横分);**关键操作**:`Ctrl+b d`(detach:退出但会话保留——"回家")、`tmux attach -t work`(回来);prefix 数字切窗口、prefix 方向键在窗格间跳;prefix ? 看全部快捷键。**配置 ~/.tmux.conf**:开启鼠标(拖窗格/滚历史)、状态栏、prefix 改 Ctrl+a(可选)。**替代**:screen(老但任何机器都有,`screen -R` 一条保命)。**习惯**:连服务器第一件事开 tmux——**"tmux 新开一个会话"是服务器操作的基本礼仪**(避免占着别人的终端)。

## 第七站:脚本自动化——让终端替你干活

**脚本基础**(条件/循环/函数/参数,详见 [Linux](/learning-paths/devops/linux) 的 Shell 脚本章)——本页补"终端日常脚本"场景:**批量处理**:`for f in *.png; do convert "$f" "${f%.png}.jpg"; done`(重命名/转格式/批量压缩——**一句话顶手工一百次**);**一键启动开发环境**(起数据库+后端+前端+开浏览器:三五行的 start.sh——**新同事 clone 后 ./start.sh 就跑起来**);**日志/文件清理**(按日期删除旧备份,配合 cron);**判断标准:同一件事做过两次,就写进脚本或函数**。**调试三件套**:`set -x`(跟踪执行)/echo 打点/`shellcheck 脚本.sh`(语法与常见坑检查——**写脚本必跑**)。

## 第八站:现代工具与完整工作流

**开发者工具清单(按需装,别贪多)**:direnv(进目录自动加载 .envrc 环境变量——**项目环境隔离,不用手动 export**)、httpie 或 `curl -s`(API 调试)、watch(`watch -n 1 'docker ps'` 定时刷新命令)、ncdu(磁盘分析)、**vim/Neovim(终端里的编辑器:至少会打开/编辑/保存——服务器上没有 IDE 时它是最后的编辑器)**、文件管理器 ranger/lf(可选,目录浏览党用)。**一次典型的"终端工作流"(把本页串起来)**:`z project`(秒到项目)→ `gs`(git 状态)→ `rg "TODO"`(找代码)→ `Ctrl+r`(找回上次的测试命令)→ `tmux` 分屏(左跑 dev server 右写代码)→ 日志 `tail -f | jq`(结构化排查)→ 发现问题改完 `gp` 推送——**全程手不离键盘,每一步都有"少敲一点"的工具**。**推荐别名清单起步**(抄进 .zshrc 就能用):导航 `..='cd ..'`;查看 `ll='ls -lah'`;Git `gs/ga/gc/gp/glog`;Docker `dps='docker ps'`、`dc='docker compose'`;编辑 `zrc='vim ~/.zshrc'`;快捷 `mkcd` 函数。

## 通关标准

能独立做到:手不离主键区完成"搜索历史命令→编辑→执行";用 zoxide/fzf 三秒内到达任意常用目录与文件;用 rg 在项目里定位代码、jq 解析接口返回;维护一份自己的 .zshrc(别名+函数+主题),换机 5 分钟恢复配置;SSH 上服务器习惯性开 tmux,断线重连工作不丢;写过至少三个"一键脚本"(环境启动/批量处理/清理)并用 shellcheck 校验——终端主线通关。

终端效率的本质是"**把高频动作变成本能**":补全、历史、别名、跳转、tmux——每一项都是小投资大回报,积累起来就是"别人半小时你三分钟"的差距。别急着装一堆炫酷工具,先把快捷键与别名练成本能,再按需补现代替代;**配置进 git、脚本进仓库,你的终端经验会像代码一样可积累、可迁移**。下一步:编辑器 [VS Code](/learning-paths/tools/vscode) 或终端里的编辑器 vim,然后上 [Git](/learning-paths/tools/git) 把工作流串起来。
