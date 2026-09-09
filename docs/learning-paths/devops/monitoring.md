# Prometheus + Grafana 监控学习路线

先立框架:**可观测性三大支柱**——指标(Metrics:数字的画像:QPS/延迟/内存)、日志(Logs:发生了什么,ELK/Loki 方向)、链路追踪(Traces:一次请求走过了谁,Jaeger/Tempo 方向)。本页主讲第一支柱的黄金组合:**Prometheus(采集+时序存储+查询)+ Grafana(可视化)+ Alertmanager(告警)**——云原生监控的事实标准(CNCF 毕业项目),从一台服务器到整个 K8s 集群、从系统指标到业务指标全靠它。心智先行:**Prometheus 是"拉(pull)模式"**——被监控方暴露 `/metrics` 端点,Prometheus 定期来抓;配合**多维数据模型(指标名 + 标签)**与 **PromQL**,监控从"看图"变成"查数"。实践:docker 起 `prom/prometheus` + `grafana/grafana` + `prom/node-exporter` 三件套即可开练。

这条线按 **核心概念与架构 → 指标类型 → PromQL → Grafana 可视化 → 告警系统 → 实战监控矩阵 → 高级(高可用/OTel)→ 最佳实践** 推进。

## 第一站:核心概念与架构

**架构组件全景**:Prometheus Server(抓取、存储时序数据、执行 PromQL)、**Exporter(指标采集器:把系统/中间件/应用指标转成 Prometheus 格式暴露在 /metrics)**、Grafana(可视化)、Alertmanager(告警分发)、Pushgateway(推送型指标:批处理/短任务用——**常规服务别用,拉取才是正道**)。
**数据模型(最重要的心智)**:一条时序 = **指标名 + 一组标签(Label)** + 按时间采样的值——(http_requests_total&#123;method="GET", instance="10.0.0.1:9090"&#125;);**标签是维度**(可聚合/过滤:按 method 拆 QPS、按 instance 拆主机);**标签值别用高基数数据**(用户 id/请求参数——会把时序撑爆);命名规范:`_total` 后缀表示 Counter、单位进名字(requests_seconds)。
**配置入门(prometheus.yml)**:`scrape_configs` 里写 job(一组同类型目标)+ `static_configs`(目标地址列表)+ `scrape_interval`(抓取间隔,默认 15s)——**静态配置只适合少量目标**,生产用**服务发现**(文件/Consul/K8s,见后);Web UI(9090)里查 Targets 看抓取健康、Graph 页试 PromQL——**先学会在 UI 里验证"指标到底有没有被抓到"**。

## 第二站:指标类型——四种武器怎么选

**①Counter(计数器):只增不减**(进程启动后累计:请求总数/错误总数/字节数)——**要看"速率"必须配 rate() 函数**(裸 Counter 没意义);②**Gauge(仪表盘):可增可减**(当前值:内存使用/温度/在线人数)——直接看值;③**Histogram(直方图):观测值分布**(请求延迟/响应大小)——**采集端分桶(le 标签),查询端用 histogram_quantile 算 P50/P95/P99**;选它因为"算分位"是监控延迟的刚需;④**Summary(摘要):客户端预计算分位**——省查询但**无法跨实例聚合**,少用;**选型口诀**:计数用 Counter、测当前值用 Gauge、要延迟分位用 Histogram(**应用埋点标配**)。**Exporter 的指标从哪来**:系统(node_exporter 读 /proc)、中间件(MySQL exporter 查 status 变量)、应用(埋点 client 库)。

## 第三站:PromQL——监控的查询语言(核心技能)

**三要素语法**:①**选择器**:`http_requests_total&#123;code="500"&#125;`(等值)、`&#123;instance=~"10\\.0\\.0\\..*"&#125;`(正则)、`metric[5m]`(**范围向量:取过去 5 分钟——算速率必须**);②**函数**:**rate(metric[5m])(每秒平均速率——看 QPS/错误率的标准姿势;irate 取瞬时,曲线更尖但噪声大,常规用 rate)**、`increase(metric[1h])`(一段时间增量)、`histogram_quantile(0.99, rate(latency_bucket[5m]))`(**P99 延迟——最常写的查询之一**)、`avg_over_time`/`max`/`min`(窗口内聚合);③**聚合**:`sum by (method) (rate(...[5m]))`(**按标签分组求和——"各接口 QPS"的写法**)、`topk(5, ...)`(Top5)、`count`。
**实战查询库(建议直接背这几个,覆盖 80% 面板)**:CPU 使用率:`100 - avg(rate(node_cpu_seconds_total&#123;mode="idle"&#125;[5m])) by (instance)`;内存:`node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes`;磁盘:`(1 - node_filesystem_avail_bytes&#123;fstype!~"tmpfs"&#125; / node_filesystem_size_bytes) * 100`;请求 QPS:`sum(rate(http_requests_total[5m])) by (route)`;错误率:`sum(rate(http_requests_total&#123;code=~"5.."&#125;[5m])) / sum(rate(http_requests_total[5m]))`;延迟 P99:histogram_quantile 上式。
**查询心智**:先选中原始指标 → 用函数算"速率/占比" → 用 by 分组——**看服务的黄金信号(QPS/错误率/延迟)就是这三板斧**。

## 第四站:Grafana——把指标变成图

**定位**:可视化与统一入口(不只接 Prometheus:Elasticsearch/MySQL/云监控都能接——**多数据源是 Grafana 的护城河**)。**上手**:加数据源(Prometheus URL)→ 建 Dashboard → 加 Panel → 写 PromQL(自动补全是福利)。
**面板类型选型**:Time series(趋势线——主力)、Stat(单个大数字:当前错误率)、Gauge(仪表)、Table(明细)、Heatmap(延迟分布热力图——P99 之外看形态)。**变量(模板变量:一个面板看全部的关键)**:Dashboard 级变量——数据源变量 `label_values(node_uname_info, instance)`(下拉选主机)+ `label_values(..., job)` 级联;Panel 查询里引用 `$instance`——**"选机器/选接口即换图"是 Grafana 效率的核心**。
**阈值与单位**:面板阈值(红黄绿:错误率 >1% 变红)、单位格式化(bytes/s、percent——**别裸数字**)。**社区 Dashboard(别从零画)**:Grafana 官方库按 ID 导入:node_exporter 全主机面板(如 1860)、K8s(315)、Prometheus 自监控——**先导入再改,比自己画快十倍**;Dashboard 导出 JSON 进 git(配置即代码)。
**权限**:组织/用户/文件夹(团队隔离面板)。

## 第五站:告警系统——从"看"到"被通知"

**告警规则(谁触发)**:Prometheus 规则文件 `groups:` 里写:`alert: HighErrorRate, expr: 错误率 > 0.05, for: 5m(持续 5 分钟才告——滤抖动), labels(severity: critical), annotations(消息模板:给值班人看的"发生了什么+怎么查")`;**记录规则(recording rules)**:把高频复杂查询(如错误率表达式)预先算成新指标(`job:http_errors:rate5m`)——**大面板与大集群的性能关键:查询不再是现场算**。
**Alertmanager(告警中枢)**:Prometheus 只负责"触发",Alertmanager 管"怎么通知":①**路由(route)**:按标签(severity/team)分流到不同接收器;②**接收器(receiver)**:email/webhook/钉钉/企业微信/Slack/PagerDuty——**值班告警用钉钉/企微/邮件,on-call 用 PagerDuty**;③**分组(grouping)**:同一类告警合并成一条通知(如"5 台机器磁盘高"合并——**防告警风暴**);④**抑制(inhibit)**:高级别告警压住低级别(服务挂了就别再报它的子告警);⑤**静默(silence)**:维护窗口手动关告警(发版/迁移前必备)。
**告警设计原则(比配置更重要)**:每条告警都要"可行动"(收到就知道干嘛——否则删掉);**USE 法看资源(Utilization 利用率/Saturation 饱和/Errors 错误),RED 法看服务(Rate 速率/Errors 错误/Duration 耗时)**——指标与告警都按这个设计;`for` 时长别太短(抖动误报毁信任);告警分级(页面级 vs 邮件级)。

## 第六站:实战监控矩阵——exporter 全家

**系统**:node_exporter(CPU/内存/磁盘(**90% 报警线+inode**)/网络/文件描述符/系统负载);**容器与 K8s**:cAdvisor(单机容器指标:container_cpu/内存)、K8s 全家(组件、Pod 指标——由 kube-prometheus-stack 一键装好,配 [K8s](/learning-paths/devops/kubernetes) 监控节);**中间件**:MySQL exporter(连接数/慢查询/主从状态)、PostgreSQL/Redis/MongoDB exporter、JMX exporter(Java 应用:GC/线程);**网络探活**:Blackbox exporter(**HTTP/TCP 探针:"用户访问的域名通不通"——公网视角,配告警是 SLA 基础**);**应用自埋(黄金信号)**:用官方 client 库给自己的服务暴露 `/metrics`——HTTP 请求数(Counter)+ 延迟直方图(Histogram)+ 进行中请求(Gauge),**RED 三件套齐活**,配 [Grafana] 面板与告警——**"业务可观测"的标志:你的服务也能被 Prometheus 拉**。
**服务发现**:目标成百上千后别手写——文件发现(写文件即可)、Consul、**K8s 服务发现(自动发现 Pod/Service 并带标签:kubernetes_sd_configs)**——配合 relabel(标签重写:只抓带注解的 Pod——**K8s 监控的标准姿势**)。

## 第七站:高级主题——规模与统一

**Prometheus 的边界(先知道)**:单机本地存储、默认保留约 15 天、无多租户——**规模上来后的方案**:①长期存储:远端写/Thanos(对象存储 + 全局查询视图——"无限保留 + 多集群统一查询"的主流)/VictoriaMetrics(轻量高性能,运维友好——中小团队热门)/Cortex 与 Mimir(多租户);②**联邦(federation)**:层级抓取(中心 Prometheus 抓边缘的聚合)——老方案,了解;**可观测性全景**:日志 → **Loki(Grafana 同门:标签与 Prometheus 一致,轻量;查询 LogQL——"指标告警后点进日志看现场"的无缝体验)** 或 ELK(重但功能全);追踪 → Jaeger/Tempo(**OpenTelemetry 生态**);**OpenTelemetry(OTel,统一埋点标准)**:一套 API/SDK 产出 metrics/logs/traces——**新项目埋点直接上 OTel**(配 Prometheus 导出),避免 vendor lock;APM(链路+指标一体化:SkyWalking/Pinpoint,Java 系常用)。
**promtool**:配置校验(`promtool check config`)与规则检查——CI 里跑。

## 第八站:最佳实践与通关

**规范清单**:指标与标签命名规范(单位/语义化;标签做维度不做值);**面板设计**:一屏"黄金信号"优先(错误率+QPS+延迟),详情下钻;**告警纪律**:可行动/有分级/有静默流程/定期演练;**监控分层**:基础设施层(主机)→ 平台层(K8s/中间件)→ 应用层(RED)→ **业务层(订单量/转化——给老板看的是业务指标,给工程师看的是 RED)**;**数据保留分级**:高精度短期、低精度长期(记录规则降采样)。

## 通关标准

能独立做到:说出 Counter/Gauge/Histogram 的区别与选型、为什么延迟用 Histogram;写出 CPU/内存/磁盘、请求 QPS/错误率/延迟 P99 六类常用 PromQL;在 Grafana 里建带模板变量的面板并导入过社区 Dashboard;配一条"错误率持续 5 分钟超阈值"的告警并走通 Alertmanager 到钉钉/邮件的通知(含分组与静默);给自己的服务埋点输出 RED 指标;理解 node_exporter/cAdvisor/blackbox/K8s 发现分别管什么——监控主线通关。

监控的本质不是工具而是**问题意识**:先想清楚"系统挂了我会怎么知道、怎么定位",Prometheus/Grafana 只是答案的载体。黄金信号(RED/USE)、可行动的告警、标签的克制——这三条心法比任何配置都值钱。学完指标这支柱,补上 [日志(Loki/ELK)] 与追踪(OTel),你的可观测性三板斧就齐了——那是"线上出事不慌"的底气。下一步:给 [K8s](/learning-paths/devops/kubernetes) 集群上 kube-prometheus-stack,或学 [OpenTelemetry] 统一埋点。
