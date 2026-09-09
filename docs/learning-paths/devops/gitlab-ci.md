# GitLab CI/CD 学习路线

GitLab CI/CD 是"长在 GitLab 里的一体化 DevOps":代码托管、CI 流水线、容器镜像仓库、环境部署、安全扫描全在一个平台(还支持自托管,数据可控),`一个 .gitlab-ci.yml` 文件从提交跑到生产。它与 [GitHub Actions](/learning-paths/devops/github-actions) **心智相通、语法不同**——概念(流水线/Job/缓存/环境/Secret)学会一套,另一套只是"翻译";选型的差别常在"团队用 GitHub 还是 GitLab、要不要自托管、要不要内置安全能力"。本页按 GitLab 的语法体系讲,并随时标注与 GitHub Actions 的对应关系。

这条线按 **概念与第一个 Pipeline → Runner → 构建测试与质量 → 流水线控制(rules/needs)→ 变量与环境 → 部署实战 → 安全与选型** 推进。

## 第一站:核心概念与第一个 Pipeline

**概念家族(GitLab 的命名)**:**Pipeline(流水线)**:一次提交触发的一整条流程;由**阶段(stages)与 Job** 组成——**默认:阶段按声明顺序串行,同阶段内的 Job 并行**;Job = 一个任务(script 命令 + 环境);**Runner = 执行器**(跑 Job 的机器,见下一站);**Artifact(产物)** 与 **Cache(缓存)** 见第三站。**最小例子**(`.gitlab-ci.yml` 放仓库根):`stages: [test, deploy]` → 两个 job:`test-job: { stage: test, script: [npm ci, npm test] }` 与 `deploy-job: { stage: deploy, script: [echo deploy], only: [main] }`——push 代码后,CI/CD → Pipelines 页能看到两阶段依次执行。**与 GitHub Actions 对照(背这张表就通了两套)**:workflow ≈ pipeline;job ≈ job;step ≈ `script:` 列表(每行一个命令);`uses: actions/xxx` ≈ `image:` + 模板/脚本;**runs-on ≈ tags(挑 runner)**;on 触发 ≈ `rules`。**Job 基本字段**:`image`(跑在哪个 Docker 镜像里——Node/Python 项目一行切环境)、`script`(必填,shell 命令)、`stage`(归属阶段)、`before_script/after_script`(前后置钩子:装依赖/清理)、`tags`(指定 runner)、`only/except`(老语法:分支过滤——**新项目一律用 rules 替代,见第三站**)、`allow_failure`(红了不阻塞阶段)、`timeout`(超时保护)。**新手坑**:YAML 缩进(Tab 不行)、script 每行是一个独立 shell 命令(要 cd 用 `cd xxx &&` 或 before_script)、Job 名不能重复、**CI 变量要用 `$VAR` 且注意 shell 转义**。

## 第二站:Runner——谁来跑

**Runner 三形态**:①GitLab 托管(免配置,额度有限);②**共享 Runner**(实例级,大家用);③**专用 Runner(项目级/组级)**:自己注册——`Settings → CI/CD → Runners` 拿注册 token,装 gitlab-runner 后 `gitlab-runner register`(填 URL+token+executor)。**tags 机制**:注册时给 runner 打标签(如 `docker`/`deploy-server`/`gpu`),Job 里写 `tags: [deploy-server]` 指定由谁执行——**"让部署 Job 只跑在能连内网的专用 runner 上"的标准做法**(也用于绕开共享 runner 的隔离限制)。**executor 选型**:`docker`(主流:每个 Job 一个干净容器,`image` 字段才生效)、`shell`(直接在 runner 机器上跑——快但脏,环境要自己管)、`kubernetes`(runner 动态起 Pod——弹性,进阶)、`ssh`(远程机执行)。**自托管动机**:内网访问需求、特殊硬件、额度、数据合规——**注意安全:runner 能碰代码与密钥,注册到可信项目即可**。

## 第三站:构建、测试与质量门禁

**语言项目通用配方**(与 GitHub Actions 页同套路):`image: node:20` → `before_script: [npm ci]`(每 Job 装依赖前可省——**建议在需要时用 cache 加速**)→ script 里 lint/单测/构建;**services(数据库容器)**:`services: [mysql:8]`——集成测试的数据库即代码;**artifacts(产物,跨 Job 传递的关键)**:测试报告与构建包声明 `artifacts: { paths: [dist/], expire_in: 1 week, reports: { junit: test-results.xml } }`——**JUnit 报告能直接显示在 Merge Request 页面**(测试结果进 MR 讨论区的体验是 GitLab 卖点);**cache(依赖缓存)**:`cache: { key: { files: [package-lock.json] }, paths: [node_modules/] }`——**key 随 lock 文件变化而失效,依赖没变就命中**(pipeline 间与 Job 间共享);**cache vs artifacts 的分工**:cache 是"可再生的依赖"可随时清,artifacts 是"要交付的产物"。**代码质量与安全(内置模板是 GitLab 的差异化卖点)**:直接 include 官方模板启用——**SAST(静态应用安全测试:代码漏洞)、Dependency Scanning(依赖漏洞)、Container Scanning(镜像漏洞)、Secret Detection(密钥泄露)、License Compliance(许可证合规)、Code Quality(代码质量报告进 MR)**——"安全左移"开箱即用,对比 GitHub Actions 要自己拼第三方 Action。**MR 质量门禁**:MR 页配"流水线必须通过才可合并"——**绿了才让合,CI 的价值就在这道闸**。

## 第四站:流水线控制——rules、needs 与高级形态

**rules(现代条件语法,必学)**:Job 级 `rules:` 数组,按顺序匹配:`- if: $CI_COMMIT_BRANCH == "main"`(分支条件)、`- if: $CI_PIPELINE_SOURCE == "merge_request_event"`(MR 触发)、`- changes: [src/**]`(路径过滤:只改文档不跑)、`- when: manual`(变成手动 Job)、`- when: never`(跳过)——**"什么情况跑、什么时候要人点"全靠 rules;老 only/except 认识即可,新写用 rules**。**needs(DAG 流水线)**:默认 Job 只等"上一阶段全部完成"——用 `needs: ["build-job"]` 让 Job 直接依赖指定 Job(**不等无关阶段:提速利器**,多模块并行构建后各自部署);**注意 needs 与 stages 的关系与限制**(GitLab 文档有细则)。**实用控制字段**:`parallel: 5`(一个 Job 分 5 片并行——大测试集拆分)、`retry: 2`(失败自动重试,配 when 限定)、`interruptible: true`(**新提交自动取消正在跑的旧 pipeline——防资源浪费,强烈建议**)、`allow_failure`(警告类 Job 红了不阻塞)。**高级流水线形态**:**父-子流水线(parent-child)**:父 pipeline 动态生成子 pipeline(按目录/模块拆分——monorepo 福音);**多项目流水线(Multi-project)**:下游仓库完成触发上游(微服务 A 发布后触发 B 的集成测试——跨仓库编排)。**Pipeline 编辑器**:GitLab 自带可视化编辑器(可看 stages 图/校验语法)——写复杂 yml 时先在校验器里过一遍。

## 第五站:变量与环境

**变量体系(优先级从低到高:全局 → 组 → 项目 → Job 级)**:预定义变量(CI_COMMIT_SHA 提交号/CI_PROJECT_PATH/CI_REGISTRY 镜像仓/CI_PIPELINE_SOURCE 触发源——**rules 全靠它**);项目 Settings → CI/CD → Variables 配自定义(勾 **Protected: 只在受保护分支/标签可见** 与 **Masked: 日志掩码**——**生产密钥:Protected + Masked + 只在受保护分支的部署 Job 用**);`.gitlab-ci.yml` 里 `variables:`(默认值)。**Environments(环境:dev/staging/production)**:Job 里 `environment: { name: production, url: https://... }`——效果:①CI/CD → Environments 页看到**部署历史(每版谁部署的、什么 commit)与一键回滚按钮**;②与 **manual Job 组合 = 人工审批闸**:`rules: - if: $CI_COMMIT_BRANCH == "main"; when: manual` + `environment: production`——**"主干自动部署到 staging,生产要人点一下"的 GitLab 标准姿势**(对应 GitHub Actions 的 environment 审批)。**回滚**:点环境页的回滚 = 重新部署上一版本——**版本化部署让"出问题先回滚"成为可能**。

## 第六站:部署实战

**配方一:服务器部署**:SSH 密钥存项目变量 → `script: [ssh deploy@host "docker pull ... && docker compose up -d"]`(配 [Docker](/learning-paths/devops/docker))。**配方二:GitLab Container Registry(内置镜像仓,一体化卖点)**:Job 里 `docker login $CI_REGISTRY -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD` → build → **push 标签用 `$CI_COMMIT_SHA`(可追溯)+ `$CI_COMMIT_TAG`(发版)**。**配方三:Kubernetes**:`kubectl set image deployment/xxx app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA` 或 Helm upgrade(配 [K8s](/learning-paths/devops/kubernetes))。**配方四:发布策略(进阶)**:蓝绿/金丝雀(新旧版本并存按流量切——K8s/网关层做)、**Feature Flags(GitLab 内置特性开关:代码合入但功能开关控制灰度——"发布代码 ≠ 发布功能"的现代实践)**。**Auto DevOps**:官方"开箱即用"模板(自动检测语言→测试→构建→部署到 K8s——了解即可,定制化项目还是手写)。**多环境策略**:dev(每次提交自动部署)/staging(合并自动)/production(手动闸)——**环境即流水线的一部分,是 CI/CD 成熟度的标志**。

## 第七站:安全、性能与选型

**安全清单**:生产密钥 = Protected+Masked 变量,只在受保护分支的受保护 Job 使用;Runner 注册 token 别外泄;启用内置安全扫描模板(见第三站)并把漏洞阈值当门禁;**别在 script 里 echo 密钥**(日志会留);自托管 GitLab 注意备份(含 CI 配置)。**性能优化排序**:cache 命中(依赖秒装)→ `needs`(DAG 去空等)→ `parallel`(大测试分片)→ interruptible(防堆积)→ 镜像层缓存(docker build 的 cache-from)。**GitHub Actions vs GitLab CI(选型小结)**:GitHub(生态 Action 海量、公共仓库免费、与 GitHub 社区一体);GitLab(一体化 DevOps:代码+CI+镜像仓+环境+安全扫描一个平台、**自托管数据可控、内置安全模板强**、无公共仓库免费 CI 但有慷慨私有额度)——**判断依据:代码放哪/要不要自托管/安全合规需求**,而不是功能差距(两者都能干 95% 的活)。

## 通关标准

能独立做到:写"stages 分阶段 + rules 分支控制 + cache/artifacts"的完整 .gitlab-ci.yml(test 与 deploy 分离);说出与 GitHub Actions 的概念对应并能"翻译"一个工作流;注册并 tag 一个专用 Runner 让部署 Job 只在它上面跑;配 Protected+Masked 变量并在 Environment 页完成一次带手动闸的生产部署与回滚;启用过至少一个安全扫描模板——GitLab CI 主线通关。

GitLab CI 的招牌是"**一体化**":从提交到生产再到安全扫描都在一个平台、一个文件里讲完——它教会你的与 GitHub Actions 是同一件事:**流水线思维(阶段/门禁/产物)与"环境即代码、发布可回滚"**。这套心智换到 Jenkins/Argo CD 同样成立。学的时候对照 [GitHub Actions](/learning-paths/devops/github-actions) 页做"双栏笔记",两套一起拿下,任何团队的 CI 你都能上手。下一步:[Kubernetes](/learning-paths/devops/kubernetes) 部署目标,或 [Argo CD/GitOps] 让发布再进一步。
