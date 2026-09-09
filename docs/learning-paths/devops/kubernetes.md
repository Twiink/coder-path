# Kubernetes 学习路线

Kubernetes(简称 K8s)是**容器编排的事实标准**:自动部署、滚动更新、自动扩缩、自愈、服务发现——把"一堆容器"变成"一个可编程的数据中心操作系统"。它是云原生(见 [云原生](/learning-paths/cloud-native/cloud-native-patterns))的基石,也是运维与后端高薪技能的分水岭。**先泼冷水**:学习曲线陡(概念多、抽象厚),**单体/小规模应用不需要 K8s**(Docker Compose 就够);它解决的是"大量服务、需要弹性与自愈"的问题。**前置**:扎实的 [Docker](/learning-paths/devops/docker)(镜像/容器/网络/卷)与 Linux 基础;心态上:理解"**声明式 + 控制器循环**"这一个核心,比背 50 个对象名重要。实践:本地 **minikube** 或 **k3s**(一条命令起集群),或云托管(ACK/EKS/GKE)体验。

这条线按 **架构与核心思想 → Pod → 工作负载 → 服务与网络 → 存储与配置 → 资源与调度 → 安全 → Helm 与 GitOps → 监控运维与排障** 推进。

## 第一站:架构与核心思想——声明式 + 控制器

**集群两大部分**:①**控制平面(大脑,3 个组件+存储)**:`kube-apiserver`(一切操作的唯一入口:认证授权、校验,所有组件都经它——**kubectl 打的就是它**)、`etcd`(集群状态的权威存储,见 [etcd](/learning-paths/middleware/etcd))、`kube-scheduler`(决定新 Pod 放哪个节点)、`kube-controller-manager`(一堆控制器);②**节点(干活)**:`kubelet`(节点代理:按声明启停容器、上报状态、执行探针)、`kube-proxy`(Service 网络规则)、容器运行时(containerd)。
**核心思想(一切从这里长出来)**:K8s 是**声明式**的——你提交 YAML 描述"**想要的状态**"(desired state:我要 3 个副本、镜像 v2、80 端口);**控制器模式**:控制器通过 **watch(监听 API)+ 调谐(reconcile)循环**不断对比"实际状态"与"期望状态"并修正(少了补、多了缩、版本不对滚动)——**这就是 K8s 的"自愈/自动"本质:没有一个魔法,全是 watch-比较-修正的循环**。
**环境**:本地 minikube/k3s;生产:云托管(ACK/EKS/GKE——**托管省掉控制平面运维,学习与生产都推荐**)或 kubeadm 自建;**kubectl 基本功**:`get`(查资源)/`describe`(详情+事件——排障第一命令)/`logs`/`exec`/`apply -f`(声明)/`delete`;`kubectl get pod -w`(watch)。
**命名空间(namespace)**:集群内逻辑隔离(环境/团队/租户),资源名在命名空间内唯一。

## 第二站:Pod——最小调度单元

**Pod = 一个或多个容器的组合**(共享网络(同 localhost)与存储卷)——**调度、伸缩、健康检查的最小单位**,但日常不直接建 Pod,而是通过工作负载(下一站)管。**生命周期**:Pending(调度/拉镜像)→ Running → Succeeded/Failed;**重启策略**:容器崩了 kubelet 按策略重启(默认 Always)。
**多容器模式**:①**initContainer(初始化容器)**:主容器启动前按序跑完(等数据库就绪/下载依赖/准备权限——"前置条件"的官方姿势);②**sidecar(伴生容器)**:与主容器同生共死(日志采集、流量代理——"加个跟班"扩展能力)。**探针(健康检查三兄弟,生产必配)**:`livenessProbe`(存活:失败则重启容器——救"卡死");`readinessProbe`(就绪:失败则从 Service 摘除——**不发流量给没准备好的 Pod**,滚动更新的关键);`startupProbe`(慢启动保护:给 Java 类应用充足启动时间,避免 liveness 误杀);探测方式 HTTP/TCP/exec + initialDelaySeconds/periodSeconds——**只配 liveness 不配 readiness 是常见事故源**。
**心智:Pod 是"牲口"**——随时可能被重建(节点挂/被驱逐/更新),别进 Pod 改东西、别把状态存容器里。

## 第三站:工作负载——管 Pod 的控制器

**①Deployment(无状态应用主力,90% 的日常)**:声明 replicas + 镜像模板;**滚动更新**(默认:新 ReplicaSet 逐步起新 Pod、旧 RS 逐步缩——maxUnavailable/maxSurge 控节奏;**更新的本质 = 新 RS 接管**);**回滚**:`kubectl rollout undo deployment/xxx`(版本化历史,秒级回滚——K8s 给部署的保险);扩缩:`kubectl scale` 或 HPA(见资源章);**用 Deployment 的前提:应用无状态**(数据外置到 DB/对象存储——"牲口"才能随便杀)。
**②StatefulSet(有状态)**:每个副本有**稳定网络标识**(pod-0、pod-1……DNS 固定)与**独立持久卷**(每个副本自己的 PVC)、有序启停扩缩——**数据库/有状态中间件的 K8s 姿势**(但真上生产,库优先用云托管或 Operator,自管 STS 运维很重)。**③DaemonSet(每节点一个)**:日志采集(Fluent Bit/Filebeat)、监控 Agent、网络插件——"全节点都有的守护进程"用 DaemonSet。
**④Job/CronJob**:一次性任务(数据迁移/批处理——失败重试 backoffLimit)与定时任务(cron 语法,批处理/K8s 内定时)。

## 第四站:服务发现与网络

**为什么需要 Service**:Pod IP 会漂移(重建就变)——**Service 提供稳定的虚拟 IP 与 DNS 名**,通过 **selector(标签选择器)** 动态绑定一组 Pod,自动负载均衡。**Service 四类型**:`ClusterIP`(集群内虚拟 IP——默认)、`NodePort`(每节点开端口:测试/临时)、`LoadBalancer`(云负载均衡器:生产公网入口)、Headless(无 ClusterIP:直连 Pod——StatefulSet 用);**集群内 DNS**:`服务名.命名空间.svc`(服务间调用用名字,不写 IP)。
kube-proxy 实现转发(iptables/IPVS)。**Ingress(七层入口)**:Service 是四层,域名/路径路由 + TLS 终止用 **Ingress**——**注意:Ingress 只是声明,真正干活的是 Ingress Controller(常是 Nginx/Traefik 的 K8s 版,见 [Nginx](/learning-paths/middleware/nginx))**;一条 Ingress 规则:域名 + 路径 → Service。
**网络模型与 CNI**:每个 Pod 有独立 IP、Pod 间直接互通(无 NAT);实现靠 **CNI 插件**:Flannel(简单 overlay)、**Calico(网络策略强,生产常见)**、Cilium(eBPF 现代派);**NetworkPolicy(集群防火墙)**:默认"全放行",用它按标签限制流量(只允许前端访问数据库 Pod——**多租户/安全必配**)。

## 第五站:存储与配置

**存储三层**:`emptyDir`(Pod 内临时——同 Pod 容器共享、Pod 没了就没了);`hostPath`(节点目录——单机测试用,生产别用);**持久化正道:PV + PVC + StorageClass**:`PersistentVolume`(存储本身:云盘/NFS/本地——集群资源)、`PersistentVolumeClaim`(工作负载的"申请单":要多大、什么模式)、`StorageClass`(**动态供给:写 PVC 时云盘自动创建并绑定——生产里你基本只写 PVC 和 StorageClass,PV 自动来**);**数据库/有状态数据必须走 PVC**(Pod 删了数据还在)。
**配置注入两兄弟**:`ConfigMap`(非敏感配置:环境变量/挂载成文件——**挂载文件方式修改后自动生效(有些应用要重启),环境变量方式要重启 Pod**);`Secret`(敏感:密码/token——**base64 只是编码不是加密**:生产要开 etcd 加密或接外部 Secret 方案;用法同 ConfigMap);**原则:镜像不烧配置,配置走 ConfigMap/Secret——同一镜像多环境复用**。

## 第六站:资源与自动扩缩

**requests 与 limits(必配,事故高发区)**:requests(调度依据:保证给这么多——**写多少决定 Pod 被塞到哪**);limits(上限:超 CPU 被节流、超内存 **OOMKilled 重启**);**不设 limits 的 Pod 可能吃光节点内存拖垮邻居**;**建议:生产给关键服务设 requests≈limits(Guaranteed QoS 最稳)**;命名空间级:`LimitRange`(默认值)、`ResourceQuota`(总量配额——多团队共用集群的隔离闸)。
**HPA(自动扩缩,招牌能力)**:按 CPU/内存/自定义指标自动增减副本——**前提:Pod 配了 requests**(指标才有基数);配 min/max 与目标利用率,**先垂直(调 requests)后水平**是调优常识;节点级扩容靠 Cluster Autoscaler(云上自动加机器)。
**调度细节(进阶)**:nodeSelector/亲和(把同组 Pod 放同节点,减少跨节点流量)/反亲和(分散到不同节点/可用区——高可用);**污点 taints 与容忍 tolerations**:给特殊节点(GPU/专用)打污点,普通 Pod 不上去,要用的 Pod 声明容忍——**"节点挑 Pod"与"Pod 挑节点"的完整机制**。

## 第七站:安全与权限(RBAC)

**身份三件套**:`ServiceAccount`(Pod 内进程的身份,默认 default)、`Role/ClusterRole`(权限集合:能对哪些资源做什么)、`RoleBinding/ClusterRoleBinding`(把角色绑给用户/服务账号);**最小权限原则**:给 CI/应用/同事只配需要的——**生产事故一大来源是"什么都能干的 kubeconfig 满天飞"**;`kubectl auth can-i`(验证权限)。**纵深清单**:镜像扫描与签名、**容器非 root + 只读根文件系统 + 资源限制**、NetworkPolicy 默认拒绝、Pod Security Admission(禁特权容器)、Secret 加密、apiserver 审计日志(谁在何时改了什么——合规)。

## 第八站:Helm 与 GitOps——部署的艺术

**Helm(K8s 的包管理器)**:复杂应用 = 一堆 YAML——**Chart 把它们模板化**(模板 + values.yaml 参数:一套 Chart,dev/prod 不同 values);`helm install/upgrade`(版本化+回滚);**生产用法:官方/社区 Chart(安装 Prometheus/数据库/Ingress 全家)一条命令,自己的应用写成 Chart 统一交付**。
**GitOps(现代交付主流)**:**Git 仓库 = 集群状态的唯一事实源**,Argo CD/Flux 持续 watch 仓库,**仓库变了集群自动同步**(漂移自动纠正)——"**用 Git 管集群,PR 即发布**":可评审、可回滚、可审计;K8s 声明式 + GitOps 是天然一对。**CI/CD 落地**(接 [GitHub Actions](/learning-paths/devops/github-actions)):CI 构建镜像推仓库 → 更新部署清单(git 提交/helm upgrade)→ 集群滚动——**镜像 tag 用 commit sha 可追溯**。

## 第九站:监控、日志与排障

**监控**:metrics-server(基础指标)→ **Prometheus(采集)+ Grafana(看板)+ Alertmanager(告警)**——K8s 生态监控事实标准(组件与配置见 [监控](/learning-paths/devops/monitoring));关键告警:Pod 重启频繁、节点 NotReady、PVC 满、HPA 异常。
**日志**:容器日志走 stdout → 节点上采集(Filebeat/Fluent Bit/Loki+Promtail)→ 集中检索(EFK 或 Loki)——**别进 Pod 翻文件,采集器是正道**。**排障方法论(背下来,遇到问题按层走)**:Pod 起不来 → ①`kubectl get pod`(看状态:Pending=调度问题(资源不够/镜像拉取失败/污点)、CrashLoopBackOff=启动即崩、ImagePullBackOff=镜像问题);②`kubectl describe pod xxx`(看事件 Events——**排障第一信息来源**);③`kubectl logs`(容器日志——CrashLoop 看 Previous 日志 `--previous`);服务不通 → 查 Service selector 是否匹配 Pod 标签、Pod 是否 Ready、端口对不对(`kubectl port-forward` 本地直连调试);节点异常 → `kubectl get nodes` + 节点上 systemctl 看 kubelet。
**备份(记住:备份的是"声明+数据",不是容器)**:etcd 快照(集群状态)+ **Velero(资源与 PV 的备份/迁移——云上灾难恢复与集群迁移的标准工具)**。**工具**:kubectl、k9s(终端 UI,效率神器)、kubectx/kubens、stern(多 Pod 日志)、Lens。
**进阶地图**:Operator/CRD(自定义资源+领域控制器:数据库 Operator——把运维流程代码化,见 [K8s Operator 方向]);Service Mesh([Istio](/learning-paths/cloud-native/service-mesh));多集群管理;大规模集群(5000 节点设计、**etcd 是心脏:磁盘慢=全集群慢**)。

## 通关标准

能独立做到:在 minikube/k3s 上用 Deployment 部署应用并完成滚动更新与回滚;讲清 Pod/Deployment/Service/Ingress 的关系与流量路径(域名→Ingress→Service→Pod);配好 liveness/readiness 探针、requests/limits、ConfigMap/Secret 与 PVC;会用 HPA 做 CPU 扩缩;理解 RBAC 三件套并给应用配最小权限 ServiceAccount;排障走完"describe 事件→logs→分层定位"流程并解决过真实故障;用 Helm 装过一个 Chart、理解 GitOps 同步模型——Kubernetes 主线通关。

Kubernetes 教会你的最重要一课是"**声明式基础设施**":不写"怎么做到",只写"要什么",剩下的交给控制器循环——这套思想会重塑你对运维与架构的理解(它也是 GitOps/Operator 的底座)。它的陡峭是值得的:云原生时代,「Deployment 滚动 + Service 发现 + HPA 弹性 + 探针自愈」是应用上生产的通用语言。**学习顺序建议**:先理解 Pod→Deployment→Service 三角,再补存储配置,最后啃调度安全——**别第一天就追 Operator 和 Service Mesh**。下一步:[Prometheus 监控](/learning-paths/devops/monitoring) 给集群装上眼睛,或 [GitOps/Argo CD] 让发布自动化。
