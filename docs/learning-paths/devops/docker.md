# Docker 学习路线

Docker 是容器化的先驱,改变了软件交付方式:把应用连同它的运行环境(依赖、配置、系统库)打包成**镜像**,任何装 Docker 的机器一键运行——"**在我机器上能跑**"成为历史,"build once, run anywhere"成为现实。它是开发环境一致化、CI/CD 交付、微服务与云原生(见 [Kubernetes](/learning-paths/devops/kubernetes))的地基。**一句话理解容器**:不是虚拟机——它是 **namespace(隔离视图:进程/网络/文件系统)+ cgroup(限制资源:CPU/内存)+ 分层文件系统** 包装出来的"轻量进程"(原理对照 [操作系统](/learning-paths/cs-basics/operating-systems) 的容器章节)——**秒级启动、共享内核、资源占用小**。实践:`docker run -d -p 8080:80 nginx` 就是你的第一课。

这条线按 **概念与安装 → 容器操作 → 镜像与 Dockerfile → 网络与存储 → Docker Compose → 仓库与 CI → 安全与原理 → 定位与下一步** 推进。

## 第一站:核心概念——镜像、容器、仓库

**三件套分清**:①**镜像(Image)**:只读的"安装包+系统快照"(由一层层文件系统叠加),构建一次、到处运行;②**容器(Container)**:镜像的**运行实例**(镜像 + 可写层 + 进程)——`docker run` 一次 = 一个容器;③**仓库(Registry)**:存放镜像的地方(Docker Hub 公共/自建 Harbor/云厂商 ACR、ECR)。**安装**:开发机 Docker Desktop(macOS/Windows,含 docker compose);**Linux 服务器装 Docker Engine**(生产:别装 Desktop);国内配置**镜像加速器**(不然 pull 慢到怀疑人生);`docker version`/`docker info` 验证;把用户加 docker 组免 sudo(`sudo usermod -aG docker $USER`,重登生效——**安全取舍:组内=root 权限,生产环境谨慎**)。**第一个容器**:`docker run -d -p 8080:80 nginx` → 浏览器开 localhost:8080——**镜像拉取(pull)→ 容器创建 → 运行** 三件事一次完成。

## 第二站:容器操作与生命周期

**run 的常用参数(每天都在用)**:`-d`(后台)、**`-p 宿主机端口:容器端口`(端口映射:容器有自己的网络命名空间,不映射外面访问不到)**、`-v`(卷,见网络存储章)、`--name`(命名,别靠随机名认容器)、`-e KEY=value`(注入环境变量)、`-it`(交互终端)、`--rm`(退出即删,临时容器)、`--restart unless-stopped`(宕机自动拉起——**生产单容器部署的保命参数**)。**生命周期命令**:`docker ps`(运行中)/`ps -a`(含已退出)、`start/stop/restart`、`rm`(删容器)、**`docker logs -f 容器`(看日志——容器内程序要打 stdout/stderr,日志只从这看)**,`docker exec -it 容器 bash`(进容器排查——**注意:容器内改东西不持久,要改就改镜像/挂载**)、`docker inspect`(看细节)、`docker stats`(资源占用)。**最重要心智:容器是"进程的封装",默认无状态**——rm 之后一切重置:**数据放卷、配置放环境变量/挂载、日志走 stdout**——想清楚"容器重启丢什么",是 Docker 化的第一课。

## 第三站:Dockerfile——把环境写成代码

**指令全家(按出现顺序理解)**:`FROM`(基础镜像:**alpine(几 MB,极致小)/slim(debian 精简,兼容性好)/官方镜像带版本标签——别用 latest 裸奔**)、`RUN`(构建时执行:装依赖——**多个 RUN 用 && 合并成一条,少产生层**)、`COPY`(把构建上下文文件拷进镜像;ADD 能解压/远程拉取,少用)、`WORKDIR`(工作目录,后续指令的落脚点)、`ENV`(环境变量)、`EXPOSE`(声明端口——纯文档,实际靠 -p)、**`USER`(切换非 root 用户——安全基本盘:先 `RUN useradd` 再 USER)**、**`CMD` vs `ENTRYPOINT`**:CMD 提供默认启动命令(可被 docker run 后参数覆盖);ENTRYPOINT 固定入口(不可覆盖,配 CMD 传参);**都用数组形式(exec 形式)**,这样进程能正确接收信号(优雅停机依赖它)。`HEALTHCHECK`(定义健康检查——编排与负载均衡会用它)。**构建实战**:`docker build -t myapp:1.0 .`——注意**构建上下文**是 `.`(整个目录会发给守护进程:大目录要 .dockerignore 排除 node_modules/.git/dist,否则构建又慢又大)。**层缓存(构建速度的核心)**:Dockerfile 每条指令一层、缓存按层命中——**"变化少的放前面、变化多的放后面"**:先 COPY package.json 再 RUN install(依赖没变就命中缓存),最后 COPY 源码——**依赖安装慢的优化第一招**。**多阶段构建(镜像瘦身标准姿势)**:第一阶段 FROM 带编译器/依赖的镜像(如 golang/node)完成编译,第二阶段 FROM 精简运行时镜像只 COPY 产物——**最终镜像只有运行所需,几十 MB 搞定**(Java/Go/前端通用)。**镜像管理**:`docker images`/`rmi`/`tag`/`save/load`(离线迁移)/`history`(看每层干了啥——排查镜像"为什么这么大"用 dive 更好)。

## 第四站:网络与存储——容器不是孤岛

**网络模式**:`bridge`(默认:容器在私有网段,通过 **-p 端口映射**对外;**容器间用 IP 或自定义网络的服务名通信**)、`host`(直接用宿主机网络——无 NAT 开销,单容器部署常选)、`none`;**自定义网络(docker network create)**:容器加入同一网络后**按容器名互相访问**(比 IP 稳定)——docker compose 自动做这件事。**数据持久化三兄弟**:①**Volume(命名卷,生产首选)**:`docker volume create` 或 `-v mydata:/var/lib/mysql`——数据由 Docker 管理(位置隐蔽但备份迁移方便 `--volumes-from`/备份容器);②**Bind Mount(绑定挂载)**:`-v /主机绝对路径:/容器路径`——开发热重载(代码目录挂进去,改完即生效)与配置文件注入;③tmpfs(内存临时,不落盘)。**铁律:数据库/有状态服务必须用卷**——`docker rm` 默认不删卷,但 `docker compose down -v` 会连卷删(操作前想清楚);挂载目录的**权限坑**:容器内用户 uid 与宿主机目录属主不一致 → Permission denied(要么对齐 uid,要么挂载前 chown)。

## 第五站:Docker Compose——多容器编排

**为什么 Compose**:真实应用 = web + 后端 + 数据库 + 缓存,一条 `docker run` 管不过来——**docker-compose.yml 声明式描述整套服务**,一条命令起停。**文件结构**:顶级 `services:` 下列每个服务(image 或 build 上下文)、`ports`(端口映射)、`volumes`、`environment`/`env_file`、`depends_on`(启动顺序——**注意它只保证"先启动"不保证"已就绪":数据库要在应用里做重试等待,或用 healthcheck 条件**)、`restart: unless-stopped`、`networks`(Compose 自动建网,服务互访用服务名)。**命令**:`docker compose up -d`(起)/`down`(停并删容器网络;`-v` 连卷删——**危险确认**)/`logs -f`/`ps`/`exec`/`config`(校验配置)。**典型栈**:nginx(反代静态)+ 前端 + 后端 API + MySQL(带卷 + healthcheck)+ Redis + 可选 adminer 调试——**一套 yml 把整个开发/测试环境复现出来,新人 clone 下来一条命令就能跑,这就是"环境一致性"的落地**。**定位**:Compose 管**单机**编排(开发环境、小型生产、CI 的临时环境)——**多机、自动扩缩、自愈交给 Kubernetes**(见 [K8s](/learning-paths/devops/kubernetes)),别用 Compose 硬撑生产集群。

## 第六站:镜像仓库与 CI/CD 集成

**仓库操作**:`docker login` → `docker push 用户名/镜像:标签`(镜像名 = 仓库地址/命名空间/名称:标签);**标签策略**:语义化版本(`1.2.3`)+ 构建标识(git commit sha)——**可追溯"线上跑的是哪次提交";别用 latest 部署**(不可复现);私有仓库:Harbor(自建)/云厂商容器镜像服务。**CI/CD 闭环(以 GitHub Actions 为例,见 [GitHub Actions](/learning-paths/devops/github-actions))**:代码 push → CI 里 `docker build`(带缓存)→ `docker push` → 服务器 `docker pull && docker compose up -d`(或用 SSH Action 远程执行)——**"镜像即交付物":测试通过的镜像直接上线,开发与生产跑同一个镜像**,这是 Docker 对软件交付的最大贡献。**部署形态演进**:单机(compose + systemd)→ 多机(Ansible 分发 + compose)→ 集群(K8s)——按规模选,别跳级。

## 第七站:安全、性能与原理

**安全清单(容器 ≠ 绝对安全)**:①**非 root 运行**(Dockerfile USER + 运行时 --user——容器内 root = 宿主机高权限通道);②镜像漏洞扫描(**trivy**/云厂商扫描——CI 里卡漏洞)、基础镜像及时更新;③**别用 latest 标签**(不可复现+可能带毒);④资源限制(**--memory/--cpus:防一个失控容器吃光宿主机**——Compose 里 deploy.resources 配);⑤密钥管理:环境变量/构建参数会留在镜像历史里(**docker history 可见**)——敏感信息用运行时注入(secret 文件/编排 secret/云 Secret Manager),别写进 Dockerfile;⑥`--read-only` 根文件系统 + cap-drop(进阶加固)。**镜像瘦身三板斧**:多阶段构建、alpine/distroless 基础镜像、dive 分析层体积。**底层原理(面试)**:容器 = Linux 内核的 **namespace**(PID/网络/挂载/UTS……——容器"看到"独立的世界)+ **cgroup**(CPU/内存配额)+ **overlayfs**(镜像分层与写时复制);**与虚拟机对比**:VM 有独立内核(重、隔离强),容器共享宿主机内核(轻、启动秒级、**隔离弱于 VM——恶意容器逃逸是真实威胁,多租户场景要 VM/沙箱**)。**Swarm**:Docker 自带编排(了解即可,实际已被 K8s 统一);**工具**:Portainer(可视化面板——小团队管理 Docker 主机舒服)、dive(镜像层分析)、lazydocker(终端 UI)、hadolint(Dockerfile lint)。

## 通关标准

能独立做到:给任意 Web 应用(如 Node/Java/Python)写出规范 Dockerfile(非 root、多阶段、HEALTHCHECK)并构建出镜像;说清镜像/容器/仓库、CMD/ENTRYPOINT、Volume/Bind Mount 的区别与选型;用 Compose 编排"应用+MySQL+Redis"并配好卷、健康检查与重启策略;把镜像推到私有仓库并跑通"CI 构建→服务器部署"闭环;能解释容器与虚拟机的本质差异及容器逃逸风险——Docker 主线通关。

Docker 的哲学是"**把环境当成代码**":Dockerfile 让环境可版本化、可评审、可复现,Compose 让整套系统一条命令复现——它消灭的是"环境不一致"这一整类问题。学它分三步:先会用(跑容器/写 Dockerfile),再会编(Compose/网络/存储),后懂原理(层/namespace/安全边界)——**每一步都别跳过,尤其"容器无状态 + 数据外置"这个心智,是后面 K8s 一切设计的出发点**。下一步:单机编排够了就上 [Kubernetes](/learning-paths/devops/kubernetes),部署自动化见 [GitHub Actions](/learning-paths/devops/github-actions)。
