# Prometheus + Grafana 监控学习路线

Prometheus + Grafana，现代化监控的黄金组合。从指标采集到可视化展示，从告警规则到性能分析，这套组合让你对系统了如指掌。学会它，你就掌握了可观测性的核心技能。

## 为什么学 Prometheus + Grafana

- Prometheus: 强大的时序数据库和监控系统
- Grafana: 最流行的可视化工具，支持多数据源
- 云原生标准，CNCF 毕业项目
- 生态丰富，各种 exporter 开箱即用
- 灵活的查询语言 PromQL，功能强大

## 学习路线图

### 第一阶段：Prometheus 基础

**安装与配置**
- macOS / Linux / Docker 安装
- prometheus.yml 配置文件
- scrape_configs 抓取配置
- targets 目标管理
- Web UI 基础使用

**核心概念**
- Metric（指标）
- Label（标签）
- Instance（实例）
- Job（任务）
- 时序数据模型

**指标类型**
- Counter（计数器）
- Gauge（仪表盘）
- Histogram（直方图）
- Summary（摘要）
- 应用场景选择

**数据采集**
- node_exporter（系统监控）
- 自定义 exporter
- Pushgateway（短期任务）
- 服务发现（SD）
- 静态配置 vs 动态发现

### 第二阶段：PromQL 查询

**基础查询**
- 即时查询
- 范围查询
- 标签过滤
- 正则匹配
- 时间范围选择

**聚合操作**
- sum / avg / min / max
- count / count_values
- topk / bottomk
- group by 分组
- without 排除标签

**函数使用**
- rate / irate 速率计算
- increase 增量
- delta / idelta 变化量
- predict_linear 预测
- histogram_quantile 分位数

**高级查询**
- 向量匹配
- on / ignoring 标签匹配
- group_left / group_right
- 子查询
- 时间偏移

### 第三阶段：Grafana 可视化

**安装配置**
- Grafana 安装
- 添加 Prometheus 数据源
- 基础配置
- 用户权限管理
- 插件管理

**Dashboard 创建**
- 创建 Dashboard
- 添加 Panel
- Graph / Stat / Gauge 面板
- Table / Heatmap 可视化
- 变量（Variables）使用

**面板配置**
- PromQL 查询编写
- 图例配置
- 阈值设置
- 单位格式化
- 颜色主题

**模板变量**
- Query 变量
- 多选变量
- 级联变量
- 全局变量
- 变量引用

### 第四阶段：告警系统

**Alertmanager**
- Alertmanager 安装
- alertmanager.yml 配置
- 路由规则（route）
- 接收器（receiver）
- 抑制规则（inhibit）

**告警规则**
- recording rules 记录规则
- alerting rules 告警规则
- expr 表达式
- for 持续时间
- labels 和 annotations

**通知渠道**
- Email 邮件通知
- Webhook 集成
- 钉钉 / 企业微信
- Slack / Discord
- PagerDuty

**告警策略**
- 告警分组（group）
- 告警抑制（inhibition）
- 告警静默（silence）
- 告警去重
- 告警升级

### 第五阶段：实战应用

**应用监控**
- HTTP 请求监控
- API 性能监控
- 错误率监控
- 响应时间分布
- QPS / TPS 统计

**系统监控**
- CPU / 内存 / 磁盘
- 网络流量
- 进程监控
- 文件描述符
- 系统负载

**容器监控**
- cAdvisor 集成
- Docker 容器监控
- Kubernetes 集群监控
- Pod 资源使用
- 服务发现配置

**数据库监控**
- MySQL exporter
- PostgreSQL exporter
- Redis exporter
- MongoDB exporter
- 慢查询监控

### 第六阶段：高级主题

**服务发现**
- 静态配置
- 文件发现
- Consul 服务发现
- Kubernetes 服务发现
- DNS 服务发现

**高可用部署**
- Prometheus 联邦
- Remote Storage
- Thanos 长期存储
- Cortex 多租户
- VictoriaMetrics

**性能优化**
- 抓取间隔优化
- 存储优化
- 查询优化
- Recording Rules 预聚合
- 数据保留策略

**最佳实践**
- 指标命名规范
- 标签使用策略
- Dashboard 设计
- 告警规则设计
- 监控分层架构

## 下一步学习

学完 Prometheus + Grafana 后，可以继续探索：
- **日志系统**：ELK / Loki
- **链路追踪**：Jaeger / Zipkin
- **APM**：SkyWalking / Pinpoint
- **可观测性**：OpenTelemetry

## 实用工具

- **prometheus**：时序数据库
- **grafana**：可视化平台
- **alertmanager**：告警管理
- **exporters**：各类指标采集器
- **promtool**：配置验证工具

掌握 Prometheus + Grafana，你就掌握了现代化监控的精髓。从指标采集到告警通知，从数据可视化到性能分析，这套组合让你对系统了如指掌。先从监控一台服务器开始，慢慢扩展到整个集群。PromQL 看起来复杂，但常用的就那几个函数。多实践，多思考，监控系统会成为你最强大的运维武器。
