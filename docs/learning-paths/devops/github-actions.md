# GitHub Actions 学习路线

**先分清概念**:CI(持续集成:每次代码变更自动跑测试与构建——"集成"指代码合入主分支前自动验证);CD(持续交付/部署:通过 CI 的代码自动发布到测试/生产)。**GitHub Actions 就是"长在 GitHub 里的 CI/CD"**:仓库内放一个 YAML 文件,推送代码即自动触发测试、构建、部署——**不用自建 Jenkins,公共仓库免费,生态有海量现成 Action**,是 2024 年后最主流的 CI/CD 之一。它与 [GitLab CI](/learning-paths/devops/gitlab-ci)、Jenkins 心智相通——**学透一个,其余都是"翻译"**。前置:Git 基础([Git 路线](/learning-paths/tools/git))与 Docker 概念([Docker](/learning-paths/devops/docker))。

这条线按 **核心概念与第一个工作流 → 触发与表达式 → Job 进阶(缓存/矩阵/服务)→ 环境与 Secrets → 部署实战 → 自定义 Action 与复用 → 调试与成本** 推进。

## 第一站:核心概念与第一个 Workflow

**六个核心词(先记牢)**:**Workflow**(一个自动化流程 = 一个 YAML 文件,放 `.github/workflows/` 目录)、**Event(触发条件**:push/PR/定时……)、**Job(一组步骤的集合**,默认 job 间并行)、**Step(单条命令或一个 Action**,job 内顺序执行、失败默认中断后续)、**Action(可复用的"现成步骤"**:checkout 代码/装 Node/推镜像……)、**Runner(执行环境**:GitHub 托管的 ubuntu/macos/windows 或自托管)。**第一个工作流(最小 CI)**:文件 `.github/workflows/ci.yml`——`name` + `on: push`(触发)+ `jobs:` 下 `test:` job,`runs-on: ubuntu-latest` + `steps`(`uses: actions/checkout@v4` 检出代码 → `run: npm ci` → `run: npm test`)——**推送代码,仓库 Actions 页签里就能看到它跑**。**三个新手坑**:①YAML 缩进错误(空格不能用 Tab,错了整个不触发——仓库 Actions 页看报错);②**Action 版本用 `@v4` 这类大版本,别用 `@main`**(上游乱改会静默破坏你的 CI);③`npm ci`(按 lock 精确装)优于 `npm install`(可能漂移)。**跑一遍看什么**:Actions 页 → 点进 job → 看每步日志——**CI 的第一步是"学会看日志与 rerun"**。

## 第二站:触发事件与上下文

**on 的常用形态**:`push`(可配 `branches`/`tags`/**`paths` 路径过滤:只改 docs/ 不跑测试——省时间省额度**)、`pull_request`(PR 触发,配 `types: [opened, synchronize]`)、**`schedule`(cron 定时——注意最小间隔与可能延迟,适合 nightly 测试/依赖更新)**、`workflow_dispatch`(**手动触发**,可配 `inputs` 让手动跑时传参——测试环境部署常用)、`release`(发版触发)。**上下文与表达式(进阶必会)**:YAML 里用 `${{ }}` 取上下文——常用:`github.ref`(分支/tag)、`github.event_name`、`github.sha`(提交号——**镜像 tag 用它可追溯**)、`secrets.X`、`vars.X`(仓库变量)、`env.X`(步骤环境变量)、`needs.jobName.result`(跨 job 状态);**if 条件**:`if: github.ref == 'refs/heads/main'`(只主干跑部署)、`if: failure()`/`always()`(失败也执行:发通知)、`if: contains(github.event.head_commit.message, '[skip ci]')`(跳过机制)。**输出与传递**:step 的 `id` + `outputs`(把一步的结果(如版本号)传给后面的步骤/job)。

## 第三站:Job 进阶——缓存、矩阵、服务

**缓存(CI 提速 50%+ 的第一手段)**:`actions/cache` 或各 setup 动作自带缓存参数(`actions/setup-node` 的 `cache: npm` 一行搞定——**key 用 lock 文件 hash:依赖没变就命中缓存,秒装依赖**);缓存路径(node_modules/~/.npm/venv……)与 restore-keys(缓存 miss 时的降级匹配)。**矩阵构建(matrix,CI 的核心价值)**:`strategy: matrix: { node: [18, 20, 22], os: [ubuntu-latest, windows-latest] }`——**自动展开成 6 个并行 job 跑多版本多系统测试**(兼容性验证的标配);控制:`exclude`(剔除组合)、`include`(追加组合)、`fail-fast`(一挂全停 vs 跑完看全貌)。**services(起依赖容器)**:job 级 `services:` 直接起 MySQL/Redis 容器(配 env 与端口)——**集成测试的数据库不用自己装**,测试环境即代码。**job 间协作**:`needs`(串行依赖:test 过了才 build)、`actions/upload-artifact` / `download-artifact`(跨 job 传文件:测试报告、构建产物——**job 间默认不共享文件系统,产物要显式传递**)。**concurrency(防浪费)**:`concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`——**快速连续 push 时自动取消上一个还在跑的相同 CI**(省额度);部署类 job 用 concurrency 保证"同一时间只有一个部署在跑"。

## 第四站:Secrets、环境与认证

**Secrets(敏感信息)**:仓库 Settings → Secrets and variables 配置(密码/token/云密钥);引用 `${{ secrets.DEPLOY_KEY }}`;**GitHub 会自动给日志里的 secret 打码,但别依赖它——打印 secret 仍是坏习惯**。**Environments(环境:dev/staging/prod 分离)**:job 的 `environment:` 关联仓库 Environment——好处:①每个环境独立 Secrets(生产密钥只有生产 job 能读);②**保护规则:生产环境可要求"手动审批"才放行**(`environment: production` + 审批人配置——**生产部署前人工把关的官方姿势**);③部署历史可视化。**vars**:非敏感的配置变量(版本号/URL)。**GITHUB_TOKEN(内置认证)**:每次运行自动注入的 token(权限默认最小,可在 yml 的 permissions 里放大——**只给需要的**),用于 push 回仓库/发 Release/调 API。**OIDC(进阶必学,云上免密钥)**:让工作流直接向云(AWS/Azure/GCP/阿里云)做 OIDC 身份认证换临时凭证——**比把长期云密钥存 Secrets 安全得多**(密钥会泄漏,OIDC 不会),上生产云部署建议直接学它。

## 第五站:部署实战——从 Pages 到服务器到 K8s

**典型流水线三段式(套用到任何项目)**:①**CI job**:checkout → 装依赖 → lint → 测试(矩阵)→ 构建;②**CD job**(`needs: ci` + 分支条件 `if: github.ref == 'refs/heads/main'`):构建镜像/打包;③**Deploy job**(`environment: production` + 审批):推上去。**场景一:静态站**:前端 build 产物 → `actions/deploy-pages`(GitHub Pages 自动部署:配 Pages 的 Actions 源)/Vercel、Netlify 的官方 action(或 push 触发它们的自动部署)。**场景二:Docker 镜像**:`docker/login-action`(登录 Docker Hub/GHCR/云镜像仓)+ `docker/build-push-action`(构建并推送,**tag 用 `${{ github.sha }}` 或语义化版本——可追溯**;配 cache-from 复用构建缓存;buildx 多平台)。**场景三:服务器部署**(见 [Docker](/learning-paths/devops/docker)):SSH 类 action 连服务器 → `docker pull && docker compose up -d`(或先 rsync 代码再重启服务)。**场景四:Kubernetes**(见 [K8s](/learning-paths/devops/kubernetes)):配好 kubeconfig(存 secret)→ `kubectl set image deployment/xxx app=镜像:sha` 或 `helm upgrade`——**镜像 sha tag + kubectl 滚动 = 可回滚的自动发布**。**场景五:Release 自动化**:打 tag 触发 → `softprops/action-gh-release` 自动生成 Release + changelog + 附构建产物——**"发版"变成一条流水线**。

## 第六站:自定义 Action 与复用

**自定义 Action 三种形态**:①Composite Action(把一组步骤打包,`action.yml` 里 `runs: using: composite`——**团队复用步骤最轻量的方式**);②JavaScript Action(用 Node 写逻辑,快);③Docker Action(容器内跑——环境自包含)。**可复用工作流(Reusable Workflows,团队标准化的关键)**:`.github/workflows/ci.yml` 声明 `on: workflow_call` + `inputs`/`secrets` → 其他仓库(或本仓库其他工作流)用 `uses: owner/repo/.github/workflows/ci.yml@main` 调用——**"CI 模板"一处维护、全组织生效**(配合 inputs 定制语言/命令)。**自托管 Runner**:跑在你自己机器/内网(需要访问私有网络、特殊 GPU、或省钱)——注册 token 接入;**安全注意:自托管 runner 能接触仓库代码,别让不可信 PR 在它上面跑**。**调试三板斧**:日志级别(重跑勾选 debug logging 看 `::debug::` 细节)、**act(本地跑 GitHub Actions:不用 push 就能调试 yml——强烈推荐先本地验证语法与逻辑)**、失败重跑(支持 rerun failed jobs 只重跑失败部分——**省时间**)。**成本意识**:公共仓库免费(额度大方);私有仓库按分钟计——矩阵×频率是账单大头(路径过滤/concurrency/合理调度来控)。

## 通关标准

能独立做到:为任意项目写"CI:lint+测试(矩阵+缓存)+构建"的工作流,并能用路径过滤与 concurrency 控成本;搭出"测试→构建镜像→生产环境(带审批)部署"的完整 CD 链(SSH 或 K8s);正确使用 Secrets 与 Environments 分级、知道 OIDC 为什么比云密钥安全;把团队公共步骤抽成 Composite Action 或可复用工作流;会用 act 本地调试并看懂失败日志——GitHub Actions 主线通关。

GitHub Actions 教你的不是 YAML 语法,而是**"质量闸门与交付流水线"的工程思想**:每次提交都被自动验证(CI),每个通过验证的版本都能一键/自动上线(CD)——**把"手工跑测试、手动发版"变成"提交即验证、合并即发布"**。这套心智(GitOps、流水线、环境门禁)放之任何 CI 皆准。别急着堆花活,先把"测试自动跑、主干自动部署"这最朴素的两条线跑稳,再谈矩阵与复用。下一步:[GitLab CI](/learning-paths/devops/gitlab-ci) 对照学习,或把部署目标换成 [Kubernetes](/learning-paths/devops/kubernetes)。
