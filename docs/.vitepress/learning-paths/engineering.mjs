import { group, page } from './model.mjs'

const published = (slug, title, navTitle, previousRoutes = []) =>
  page({ id: slug, slug, title, navTitle, status: 'published', previousRoutes })

const placeholder = (slug, navTitle, title = `${navTitle} 学习路线`) =>
  page({ id: slug, slug, title, navTitle, status: 'placeholder' })

export const engineering = [
  group('database', '数据库与存储', [
    placeholder('database/overview', '路线总览', '数据库与存储学习路线总览'),
    group('database-core', '数据库基础', [
      placeholder('database/sql-relational-model', 'SQL 与关系模型'),
      placeholder('database/data-modeling', '数据建模'),
      placeholder('database/transactions-concurrency', '事务与并发控制'),
      placeholder('database/indexing-query-optimization', '索引与查询优化'),
      published('database/mysql', 'MySQL 学习路线', 'MySQL'),
      published('database/postgresql', 'PostgreSQL 学习路线', 'PostgreSQL'),
      published('database/mongodb', 'MongoDB 学习路线', 'MongoDB'),
      published('database/redis', 'Redis 学习路线', 'Redis')
    ]),
    group('database-specialized', '专用与分布式存储', [
      placeholder('database/sqlite', 'SQLite'),
      placeholder('database/oracle-sqlserver', 'Oracle 与 SQL Server'),
      placeholder('database/distributed-databases', '分布式数据库'),
      placeholder('database/graph-databases', '图数据库'),
      placeholder('database/time-series-databases', '时序数据库'),
      published('database/vector-databases', '向量数据库学习路线', '向量数据库', ['/learning-paths/ai/vector-databases'])
    ])
  ]),
  group('middleware', '中间件与集成', [
    placeholder('middleware/overview', '路线总览', '中间件与集成学习路线总览'),
    group('middleware-messaging', '消息与协调', [
      published('middleware/kafka', 'Kafka 学习路线', 'Kafka'),
      published('middleware/rabbitmq', 'RabbitMQ 学习路线', 'RabbitMQ'),
      published('middleware/rocketmq', 'RocketMQ 学习路线', 'RocketMQ'),
      placeholder('middleware/messaging-patterns', '消息模式'),
      placeholder('middleware/nats', 'NATS'),
      placeholder('middleware/pulsar', 'Apache Pulsar')
    ]),
    group('middleware-platforms', '平台与存储服务', [
      published('middleware/redis-advanced', 'Redis 深入（原理与调优）学习路线', 'Redis 深入'),
      published('middleware/elasticsearch', 'Elasticsearch 学习路线', 'Elasticsearch'),
      published('middleware/nginx', 'Nginx 学习路线', 'Nginx'),
      published('middleware/zookeeper', 'ZooKeeper 学习路线', 'ZooKeeper'),
      published('middleware/etcd', 'etcd 学习路线', 'etcd'),
      placeholder('middleware/object-storage', '对象存储')
    ])
  ]),
  group('architecture', '架构与分布式系统', [
    placeholder('architecture/overview', '路线总览', '架构与分布式系统学习路线总览'),
    group('architecture-principles', '架构原则与分布式系统', [
      placeholder('architecture/architecture-patterns', '架构模式'),
      placeholder('architecture/domain-driven-design', '领域驱动设计'),
      placeholder('architecture/clean-hexagonal', '整洁架构与六边形架构'),
      placeholder('architecture/distributed-systems', '分布式系统'),
      placeholder('architecture/event-driven', '事件驱动架构'),
      placeholder('architecture/real-time-systems', '实时系统')
    ]),
    group('architecture-microservices', '微服务架构', [
      published('architecture/microservices/patterns', '微服务设计模式学习路线', '微服务设计模式', ['/learning-paths/microservices/microservices-patterns']),
      published('architecture/microservices/api-gateway', 'API 网关学习路线', 'API 网关', ['/learning-paths/microservices/api-gateway']),
      published('architecture/microservices/spring-cloud', 'Spring Cloud 学习路线', 'Spring Cloud', ['/learning-paths/microservices/spring-cloud']),
      published('architecture/microservices/dubbo', 'Dubbo 学习路线', 'Dubbo', ['/learning-paths/microservices/dubbo']),
      published('architecture/microservices/istio', 'Istio 学习路线', 'Istio 服务网格', ['/learning-paths/microservices/istio'])
    ])
  ]),
  group('cloud-native', '云原生', [
    placeholder('cloud-native/overview', '路线总览', '云原生学习路线总览'),
    group('cloud-native-existing', '云原生模式与服务网格', [
      published('cloud-native/cloud-native-patterns', '云原生模式学习路线', '云原生模式'),
      published('cloud-native/serverless', 'Serverless 学习路线', 'Serverless'),
      published('cloud-native/service-mesh', '服务网格学习路线', '服务网格')
    ]),
    group('cloud-native-infrastructure', '容器、网络与云平台', [
      placeholder('cloud-native/container-runtime', '容器运行时'),
      placeholder('cloud-native/networking', '云原生网络'),
      placeholder('cloud-native/storage', '云原生存储'),
      placeholder('cloud-native/aws', 'AWS'),
      placeholder('cloud-native/azure', 'Azure'),
      placeholder('cloud-native/gcp', 'Google Cloud')
    ])
  ]),
  group('observability', '可观测与可靠性', [
    placeholder('observability/overview', '路线总览', '可观测性、性能与可靠性学习路线总览'),
    group('observability-signals', '可观测性信号', [
      published('observability/prometheus-grafana', 'Prometheus + Grafana 监控学习路线', 'Prometheus + Grafana', ['/learning-paths/devops/monitoring']),
      placeholder('observability/opentelemetry', 'OpenTelemetry'),
      placeholder('observability/logging', '日志工程'),
      placeholder('observability/metrics', '指标工程'),
      placeholder('observability/distributed-tracing', '分布式追踪')
    ]),
    group('observability-reliability', '性能与可靠性', [
      placeholder('observability/performance-engineering', '性能工程'),
      placeholder('observability/web-vitals', 'Web Vitals'),
      placeholder('observability/capacity-reliability', '容量与可靠性')
    ])
  ]),
  group('software-engineering', '软件工程', [
    placeholder('software-engineering/overview', '路线总览', '软件工程学习路线总览'),
    group('software-engineering-product', '产品与协作', [
      placeholder('software-engineering/requirements-product', '需求与产品'),
      placeholder('software-engineering/estimation-planning', '估算与计划'),
      placeholder('software-engineering/agile-lean', '敏捷与精益'),
      placeholder('software-engineering/design-patterns', '设计模式'),
      placeholder('software-engineering/architecture-decisions', '架构决策记录'),
      placeholder('software-engineering/documentation', '工程文档'),
      placeholder('software-engineering/release-versioning', '发布与版本管理')
    ]),
    group('software-engineering-quality', '质量与开发体验', [
      placeholder('software-engineering/code-quality-refactoring', '代码质量与重构'),
      placeholder('software-engineering/code-review-collaboration', '代码评审与协作'),
      placeholder('software-engineering/developer-experience', '开发者体验')
    ])
  ])
]
