# Git 版本控制学习路线

Git，代码版本管理的事实标准。从个人项目到大型团队协作，从代码追溯到冲突解决，Git 让代码管理变得优雅而强大。学会它，你就掌握了现代软件开发的基础技能。

## 为什么学 Git

- 行业标准，所有公司都在用
- 分布式架构，本地即可完成大部分操作
- 分支管理强大，支持各种工作流
- 速度快，性能优秀
- 开源社区首选，GitHub/GitLab 生态完善

## 学习路线图

### 第一阶段：基础操作

**安装与配置**
- macOS / Linux / Windows 安装 Git
- git config 全局配置
- user.name 和 user.email 设置
- 默认分支名配置（main）
- SSH key 配置

**基础命令**
- git init 初始化仓库
- git clone 克隆仓库
- git status 查看状态
- git add 暂存文件
- git commit 提交
- git log 查看历史

**文件管理**
- git add . 暂存所有
- git rm 删除文件
- git mv 移动文件
- .gitignore 忽略文件
- 撤销修改
- 查看差异（git diff）

### 第二阶段：分支管理

**分支操作**
- git branch 查看分支
- git branch `<name>` 创建分支
- git checkout 切换分支
- git switch 新式切换
- git merge 合并分支
- git branch -d 删除分支

**分支策略**
- main/master 主分支
- develop 开发分支
- feature 功能分支
- hotfix 紧急修复
- release 发布分支
- Git Flow 工作流

**冲突解决**
- 冲突产生原因
- 冲突标记识别
- 手动解决冲突
- git mergetool 工具
- 冲突后测试验证

### 第三阶段：远程协作

**远程仓库**
- git remote add 添加远程
- git remote -v 查看远程
- git push 推送代码
- git pull 拉取更新
- git fetch 获取远程
- origin 远程名称

**协作流程**
- Fork 项目
- Clone 到本地
- 创建功能分支
- 提交并推送
- 发起 Pull Request
- Code Review

**Pull Request**
- 创建 PR 流程
- PR 描述规范
- Review 反馈
- 修改与更新
- 合并策略（Merge、Squash、Rebase）

### 第四阶段：进阶技巧

**Rebase 操作**
- git rebase 变基
- 交互式 rebase
- 合并多个提交
- 修改历史提交
- rebase vs merge 对比

**Cherry-pick**
- 挑选提交
- 跨分支复制提交
- 解决冲突
- 应用场景

**Stash 暂存**
- git stash 暂存修改
- git stash list 查看列表
- git stash pop 恢复
- git stash apply 应用
- 分支切换场景

**标签管理**
- git tag 创建标签
- 轻量标签 vs 附注标签
- 推送标签
- 删除标签
- 版本发布

### 第五阶段：高级特性

**子模块**
- git submodule add
- 克隆含子模块的项目
- 更新子模块
- 子模块工作流
- 替代方案（subtree）

**提交历史**
- git log 详细用法
- git log --graph 图形化
- git log --oneline 简化
- git reflog 引用日志
- 查找特定提交

**撤销与回退**
- git reset 重置
- git revert 反转提交
- git checkout 恢复文件
- git restore 新式恢复
- 三种 reset 模式（soft、mixed、hard）

**高级技巧**
- git bisect 二分查找 bug
- git blame 追踪代码
- git worktree 多工作区
- git hooks 钩子
- 别名配置（alias）

## 下一步学习

学完 Git 后，可以继续探索：
- **GitHub/GitLab**：平台高级功能
- **Git Flow/GitHub Flow**：团队工作流
- **CI/CD**：自动化流程
- **代码审查**：Code Review 最佳实践

## 实用工具

- **lazygit**：终端 UI 工具，极其好用
- **tig**：命令行 Git 查看器
- **Git Graph (VS Code)**：可视化分支历史
- **GitKraken**：强大的 Git GUI
- **Fork**：macOS 上的优秀客户端

掌握 Git，你就掌握了代码版本管理的精髓。从基础的提交到高级的 rebase，从分支管理到团队协作，Git 让代码管理变得优雅而强大。别被命令吓到，常用的就那么几个。先从 add、commit、push 开始，慢慢理解分支和合并。遇到问题别慌，Git 几乎所有操作都能撤销。多实践，多思考，Git 会成为你最得力的开发工具。
