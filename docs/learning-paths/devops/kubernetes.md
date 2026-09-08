# Kubernetes 学习路线

Kubernetes，容器编排界的王者。从小型应用到超大规模集群，它让容器管理变得优雅而强大。学会 K8s，你就掌握了云原生时代的核心技能。

## 为什么学 Kubernetes

- 容器编排的事实标准，市场需求巨大
- 云原生应用的基础设施，CNCF 生态核心
- 自动化部署、扩缩容、自愈能力强大
- 多云环境统一管理，避免厂商锁定

## 学习路线图

### 第一阶段：核心概念

**集群架构**
- Master 节点（控制平面）
- Worker 节点（工作负载）
- etcd 分布式存储
- API Server 核心组件
- Scheduler 调度器
- Controller Manager 控制器

**控制平面组件深入**
- kube-apiserver：API 网关、认证授权
- kube-scheduler：调度算法、亲和性、污点与容忍
- kube-controller-manager：控制器模式、协调循环
- cloud-controller-manager：云平台集成
- etcd：Raft 共识算法、键值存储
- 高可用控制平面：多 Master 部署

**调度器原理**
- 调度队列：优先级队列
- 预选（Filtering）：节点筛选
- 优选（Scoring）：节点打分
- 调度算法：资源需求、亲和性、反亲和性
- Pod 优先级与抢占
- 自定义调度器开发
- 调度器性能优化

**环境搭建**
- minikube 本地集群
- Docker Desktop K8s
- kubeadm 集群搭建
- kubectl 命令行工具
- kubeconfig 配置文件

**Pod 基础**
- Pod 是最小调度单元
- 单容器 Pod vs 多容器 Pod
- Pod 生命周期
- Init 容器
- Sidecar 模式

### 第二阶段：工作负载

**Deployment**
- 声明式部署
- 滚动更新
- 回滚操作
- 副本管理
- 更新策略

**StatefulSet**
- 有状态应用
- 稳定的网络标识
- 持久化存储
- 有序部署和扩缩容
- 应用场景（数据库、消息队列）

**DaemonSet**
- 每个节点运行一个 Pod
- 日志收集
- 监控 agent
- 网络插件

**Job 和 CronJob**
- 一次性任务
- 批处理作业
- 定时任务
- 并行执行
- 失败重试策略

### 第三阶段：服务与网络

**Service**
- ClusterIP（集群内访问）
- NodePort（节点端口）
- LoadBalancer（云负载均衡）
- ExternalName（外部服务）
- 服务发现机制

**Ingress**
- 七层负载均衡
- 域名路由
- TLS 终止
- Ingress Controller（Nginx、Traefik）
- 路径重写与重定向

**网络模型**
- CNI 网络插件
- Pod 网络通信
- Service 网络
- Network Policy 网络策略
- DNS 服务发现

**Kubernetes 网络模型深入**
- 容器间通信：同一 Pod 内 localhost
- Pod 间通信：扁平网络、无 NAT
- Service 通信：ClusterIP、kube-proxy
- CNI 插件对比：Flannel、Calico、Cilium、Weave
- kube-proxy 模式：userspace、iptables、IPVS
- IPVS 模式的性能优势
- Service Mesh 与 CNI 的关系
- Ingress 控制器的网络实现

**存储深入**
- CSI（Container Storage Interface）
- 存储插件架构：In-Tree vs Out-of-Tree
- 卷的生命周期：Provision、Attach、Mount
- 动态卷供给：StorageClass
- 卷快照：VolumeSnapshot
- 卷克隆与扩容
- 本地持久卷：Local PV
- 分布式存储：Ceph、GlusterFS、Rook

### 第四阶段：存储与配置

**Volume 存储**
- emptyDir 临时存储
- hostPath 主机路径
- PersistentVolume (PV)
- PersistentVolumeClaim (PVC)
- StorageClass 动态供给

**配置管理**
- ConfigMap 配置数据
- Secret 敏感信息
- 环境变量注入
- 文件挂载
- 配置热更新

**资源管理**
- requests 资源请求
- limits 资源限制
- LimitRange 默认限制
- ResourceQuota 命名空间配额
- QoS 服务质量

### 第五阶段：高级特性

**自动扩缩容**
- HorizontalPodAutoscaler (HPA)
- VerticalPodAutoscaler (VPA)
- 基于 CPU/内存扩缩容
- 自定义指标扩缩容
- Cluster Autoscaler

**控制器模式**
- 控制器的工作原理：Watch、Compare、Act
- Informer 机制：List-Watch
- WorkQueue 工作队列
- 协调循环（Reconcile Loop）
- 乐观并发控制：ResourceVersion
- 自定义控制器开发
- Operator 模式：领域知识自动化

**CRD 与 Operator**
- CustomResourceDefinition 自定义资源
- CRD 的定义与注册
- CRD 版本管理与转换
- Operator 设计模式
- Operator Framework：Kubebuilder、Operator SDK
- Operator 生命周期管理
- 常见 Operator：Prometheus、ElasticSearch

**健康检查**
- LivenessProbe 存活探针
- ReadinessProbe 就绪探针
- StartupProbe 启动探针
- HTTP / TCP / Exec 探测方式
- 探测策略配置

**RBAC 权限控制**
- Role 和 ClusterRole
- RoleBinding 和 ClusterRoleBinding
- ServiceAccount 服务账户
- 最小权限原则
- 审计日志

**Helm 包管理**
- Chart 包结构
- values.yaml 配置
- helm install / upgrade
- Chart 仓库
- 自定义 Chart

### 第六阶段：运维实战

**监控告警**
- Prometheus 指标采集
- Grafana 可视化
- Alertmanager 告警
- 常用监控指标
- 告警规则配置

**日志管理**
- kubectl logs 查看日志
- EFK 日志栈（Elasticsearch、Fluentd、Kibana）
- 日志聚合方案
- 日志持久化
- 日志查询与分析

**故障排查**
- kubectl describe 详细信息
- kubectl get events 事件查看
- 容器日志分析
- 网络连通性测试
- 资源瓶颈排查

**备份恢复**
- etcd 备份
- 资源导出
- Velero 备份工具
- 灾难恢复演练
- 跨集群迁移

## 下一步学习

学完 Kubernetes 后，可以继续探索：
- **Service Mesh**：Istio、Linkerd
- **GitOps**：Argo CD、Flux
- **Serverless**：Knative、OpenFaaS
- **多集群管理**：Rancher、KubeFed

## 性能调优篇

**集群性能优化**
- etcd 性能调优：磁盘 I/O、网络延迟
- API Server 调优：并发连接、缓存
- Scheduler 调优：调度延迟优化
- kube-proxy 模式选择：IPVS vs iptables
- 节点资源分配：kubelet 预留资源
- Pod 资源限制：QoS 类别优化

**应用性能优化**
- 容器镜像优化：多阶段构建、精简镜像
- 启动速度优化：就绪探针配置
- 资源请求与限制：避免 OOMKilled
- 亲和性调度：减少跨节点通信
- HPA 配置优化：避免抖动
- 存储性能：选择合适的 StorageClass

**大规模集群调优**
- 节点数量限制：单集群 5000 节点
- Pod 密度优化：每节点 Pod 数量
- API Server 扩展：多副本、负载均衡
- etcd 集群扩展：读写分离
- 网络插件性能对比
- 监控指标优化：减少 Prometheus 压力

## 实用工具

- **kubectl**：官方命令行工具
- **k9s**：终端 UI 管理
- **kubectx / kubens**：上下文切换
- **stern**：多 Pod 日志查看
- **Lens**：桌面 IDE

Kubernetes 学习曲线陡峭，但掌握后威力巨大。从 Pod 到 Deployment，从 Service 到 Ingress，每个组件都有其独特的作用。别被一堆概念吓倒，先从部署一个简单应用开始，慢慢理解声明式配置和控制器模式。多实践，多思考，K8s 会成为你最强大的容器编排武器。
