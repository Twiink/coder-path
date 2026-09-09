# Git 版本控制学习路线

Git 是代码版本管理的**事实标准**:分布式(本地就能提交与回溯)、分支强大、快,所有公司都在用。别被命令数量吓到——**日常高频的就十来个**,剩下的是"用到再查"的地图。学 Git 最关键的是先建立**心智模型(快照与三棵树)**,而不是背命令;另一个安心丸:**Git 几乎所有操作都能撤销**(有后悔药 reflog)。它是协作的底座:分支、PR、Code Review、CI 全建立在它之上。

这条线按 **配置与 SSH → 核心循环与心智模型 → 撤销地图 → 分支与合并 → 远程与 PR → Rebase 与历史整理 → 历史考古 → 团队工作流 → 工具与进阶** 推进。

## 第一站:安装与配置

**装好先配三件套**:`git config --global user.name "你的名字"`、`user.email`(提交的作者身份——**提交会永远带着它,别乱填**)、`init.defaultBranch main`;换行符 `core.autocrlf`(Windows 团队必配,防"整个文件都变了"的换行灾难);编辑器(commit 弹出 vim 时别慌:按 i 写、Esc、:wq 存退)。**别名(alias,提升幸福感)**:`git config --global alias.co checkout`、`alias.lg "log --oneline --graph --all"`——**把常用长命令变短,一天省几万次击键**。**SSH 连接(推代码的标配)**:`ssh-keygen -t ed25519` 生成密钥 → 公钥(~/.ssh/id_ed25519.pub)贴到 GitHub/GitLab → `git clone git@github.com:...`——**配好 SSH 就不用每次输密码**(HTTPS 也可配凭据助手)。

## 第二站:核心循环与心智模型

**先建心智模型(比命令重要)**:Git 存的是**快照**(每次提交 = 整个项目当时的样子 + 指针),不是差异;日常操作在三棵树间流动:**工作区(你编辑的文件)→ 暂存区/index(挑好的准备提交)→ 本地仓库/HEAD(已提交的快照)**。**核心循环(肌肉记忆)**:`git status`(我在哪、什么变了——**最常用的命令**)→ `git add 文件`(进暂存区;`add .` 全加——**慎用:可能带上不想提交的**)→ `git commit -m "feat: 说人话的提交信息"`(进仓库)→ 循环。**查看**:`git log --oneline`(提交史)/`--graph`(分支图)/`git diff`(工作区未暂存的改动)/`git diff --staged`(暂存区的)。**.gitignore(第二重要)**:把 `node_modules/`、`.env`(密钥!)、`dist/`、IDE 配置忽略掉——**"把密钥提交进 git"是程序员第一社死事件,ignore 从第一天建**;`git rm --cached`(已跟踪的文件移出跟踪但保留本地——救"误提交大文件/密钥")。

## 第三站:撤销地图——Git 的后悔药

**按场景查表(背下来,遇事不慌)**:①**工作区改乱了想还原**:`git restore 文件`(丢弃未暂存改动——**不可找回,先确认**);②**add 错了(暂存区多加了)**:`git restore --staged 文件`(退出暂存,改动保留);③**提交信息写错了(还没推送)**:`git commit --amend`(改信息/补漏文件——**只 amend 未推送的提交**);④**提交后想整体撤销(未推送)**:`git reset` 三种模式——`--soft`(回到提交前,改动在暂存区)/`--mixed`(默认:改动在工作区)/`--hard`(**彻底丢弃改动——高危,慎用**);⑤**已经推送的提交要撤销**:**`git revert 提交号`(生成一个"反向提交"——不 rewrite 历史,团队安全);铁律:已推送的共享分支,绝不 reset——用 revert**。**reflog(终极后悔药)**:Git 记录你所有的指针移动——`git reflog` 找到"丢失"的提交号,`git reset --hard 那个号` 找回——**以为删掉的历史,其实都还在**。

## 第四站:分支与合并

**分支的本质**:一个指向提交的可移动指针——**创建/切换几乎零成本,所以"开分支"是常态不是仪式**。**日常**:`git switch -c feature/xxx`(建并切;老 checkout -b 也行)、`git branch`(列表)、`git branch -d`(删已合并分支)。**合并**:`git merge 分支`——两种情况:**fast-forward(快进:主线没动,直接移动指针)** 与 **真正的合并(产生 merge commit)**。**冲突(新手最慌、实际最常见)**:两边改了同一处 → 文件里出现标记 `<<<<<<< HEAD`(我的)/`=======`/`>>>>>>> 分支名`(对方的)——**手动选择/合并后删标记 → add → commit**;冲突不可怕,可怕的是看不懂标记;提前预防:提交前先 pull、PR 小而快(冲突与 PR 大小成正比)。**stash(切换分支前的救命稻草)**:手头改到一半要切分支 → `git stash`(暂存脏工作区)→ 切分支办事 → 回来 `git stash pop`——**"切换前 stash"是肌肉记忆**(不 stash 直接切,改动会跟到新分支,乱套)。

## 第五站:远程协作与 Pull Request

**远程三兄弟**:`git remote add origin 地址`/`remote -v`(看远程)、`git push`(本地提交推远程)、**`git fetch`(只下载远程新提交,不合并——安全查看)vs `git pull`(fetch+merge 一步到位;`pull --rebase` 见下)**。**现代协作标准流程(开源与团队通用)**:Fork/建分支 → clone/切分支 → 提交 → push 分支 → **发起 Pull Request(PR)** → 代码评审(Review 评论) → 按反馈修改(继续 push 同分支,PR 自动更新)→ CI 通过(见 [GitHub Actions](/learning-paths/devops/github-actions))→ **合并**。**合并三种策略(团队要约定)**:Merge commit(保留完整分叉历史——"真实")/ **Squash and merge(PR 的所有提交压成一个——历史整洁,现代团队默认)**/Rebase and merge(线性化——规则见下)。**PR 规范**:小而专注(一个 PR 一件事,300 行内好评审)、描述清楚(为什么+怎么测+截图)、**CI 绿了才合**——**PR 是质量闸门也是知识共享**,不是走流程。

## 第六站:Rebase 与历史整理

**变基原理**:把当前分支的提交"拔起来,重新种到另一个基点"上——`git rebase main`(把 feature 的提交重放到 main 最新之上)。**交互式 rebase(整理本地提交的瑞士军刀)**:`git rebase -i HEAD~3`——对最近 3 个提交做:`squash`(合并成一个)/`fixup`(合并并丢弃信息)/`reword`(改信息)/`drop`/`edit`(拆提交)——**"提交历史是给人读的:发布前把 WIP 碎提交整理成有意义的提交"**。**rebase vs merge 哲学**:merge 保留"真实发生过什么"(有分叉);rebase 让历史线性整洁(好读好 bisect)。**黄金法则(血泪教训):只 rebase 自己还没推送的提交;已推送到共享分支的,永不 rebase**(rebase 会重写提交号,队友的本地历史会错乱——**共享历史只能 merge/revert**)。**cherry-pick(挑单提交)**:`git cherry-pick 提交号`——把某个分支的特定提交复制到当前分支(hotfix 需要同时修 main 与 release 时的标准操作)。

## 第七站:历史考古——排障与追溯

**线上 bug 三连**:①`git blame 文件`(每行是谁、哪个提交改的——**找"谁干的"不是追责,是找他问上下文**);②**`git bisect`(二分定位:标记"这个提交是好的/坏的",Git 自动折半查找——**在几百个提交里找引入 bug 的那个,比肉眼快一个数量级**);③`git log -S "关键字"`(哪个提交增删了某段代码)/`git log --oneline -- 文件`(这文件的历史)。**版本发布**:`git tag v1.2.0`(附注标签 -a 带信息——发布点标记)+ `git push --tags`;语义化版本(1.2.3:主.次.修)配合 [Conventional Commits] 可自动生成 changelog。**worktree(进阶)**:同一仓库开多个工作区并行(改 hotfix 时不用 stash 手头的活)。

## 第八站:团队工作流与提交规范

**三种主流工作流(按团队选)**:**Git Flow**(main/develop/feature/release/hotfix 五分支——功能全但重,适合发版制项目)、**GitHub Flow(现代默认:只有 main,功能分支 + PR 直合——简单,配 CI 持续发布)**、Trunk-Based(主干开发,短命分支,配特性开关——**CI/CD 与金丝雀发布的最爱,见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 特性开关章**)。**提交规范(Conventional Commits,团队必立)**:`feat:`(新功能)/`fix:`(修 bug)/`docs:`/`refactor:`/`test:`/`chore:` + 描述——**价值:changelog 可自动生成、CI 可按类型触发、git blame 一眼看懂意图**。**分支保护**:主干设为 protected——只能 PR 合并 + CI 必绿 + 必要 Review 人数(平台设置,见 [GitHub Actions](/learning-paths/devops/github-actions) 环境章);**Code Review 清单**:逻辑对不对/边界与错误处理/测试缺不缺/命名与风格/安全(密钥/注入)——**"Review 别人的代码 = 给自己买保险"**。

## 第九站:工具与收尾

**工具定位:命令学明白,GUI 提效率**:lazygit(终端 TUI,分屏操作爽)/tig(命令行历史浏览器)/VS Code Git Graph(可视化分支)/GitKraken、Fork(GUI 客户端)——**建议:日常操作(提交/推送)练熟命令,复杂历史(整理/冲突)用可视化**。**hooks(自动化闸门)**:`.git/hooks/pre-commit` 跑 lint/格式化(配合 husky+lint-staged:只检查暂存文件);服务端 pre-receive 可拦截(团队规范强制)。**submodule(慎用)**:嵌套仓库(公共库/配置)——**历史坑多(子模块指针漂移),能用 monorepo/包管理替代就别用**;大文件用 Git LFS(游戏资源/数据集)。**平台能力**(与 Git 配套学):GitHub/GitLab 的 PR 流程、Actions/CI(见 CI 页)、Code search、安全告警(Dependabot)。

## 通关标准

能独立做到:说出"三棵树"模型与 add/commit 的关系;面对"改乱了/暂存错了/提交错了/已推送要撤销"四种场景各给出正确命令(不 resort 到删仓库);独立解决一次合并冲突并解释标记含义;走完"分支→PR→Review→Squash 合并"的完整流程;讲清 rebase 与 merge 的区别与"黄金法则"为什么存在;用 blame/bisect/log 完成一次线上问题的代码定位;给团队写出提交规范与分支保护建议——Git 主线通关。

Git 是"团队协作的地基",但它首先是"**单人开发的安全网**":随手提交、随时回溯、放心重构——**把 Git 用成习惯,你的代码就永远有后悔药**。学它别背命令表,按本页的"场景地图"(撤销/冲突/考古)来练;等你能在 5 分钟内把"本地改乱+已推送+要回滚"的局面收拾干净,Git 就真正是你的了。下一步:[终端效率](/learning-paths/tools/terminal) 与 [VS Code](/learning-paths/tools/vscode) 配齐开发环境,再把 Git 接进 [CI](/learning-paths/devops/github-actions)。
