---
title: "PostgreSQL实战与最佳实践"
aliases:
  - "PostgreSQL实战"
  - "PostgreSQL最佳实践"
tags:
  - "后端"
  - "数据库"
  - "postgresql"
  - "实战"
  - "最佳实践"
  - "笔记"
category: "后端"
folder: "PostgreSQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/PostgreSQL/PostgreSQL高级特性]]"
  - "[[后端/数据库/PostgreSQL/PostgreSQL索引与性能优化]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 07 PostgreSQL 实战与最佳实践

本章通过实际案例展示 PostgreSQL 的高级应用，包括高可用架构、性能调优、安全加固、监控告警等生产环境最佳实践。

## 7.1 高可用架构

### 7.1.1 主从复制

**流复制（Streaming Replication）**：

```ini
# 主库配置（postgresql.conf）
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
hot_standby = on

# 主库配置（pg_hba.conf）
host replication repl_user 192.168.1.0/24 md5
```

```sql
-- 主库：创建复制用户
CREATE USER repl_user WITH REPLICATION PASSWORD 'repl_password';

-- 主库：创建复制槽（可选，防止 WAL 过早删除）
SELECT pg_create_physical_replication_slot('replica_1');
```

```bash
# 从库：基础备份
pg_basebackup -h master_host -U repl_user -D /var/lib/postgresql/15/main -Fp -Xs -P

# 从库：配置 standby.signal
touch /var/lib/postgresql/15/main/standby.signal

# 从库：配置 postgresql.conf
primary_conninfo = 'host=master_host port=5432 user=repl_user password=repl_password'
primary_slot_name = 'replica_1'
hot_standby = on

# 从库：启动
systemctl start postgresql
```

**逻辑复制（Logical Replication，PostgreSQL 10+）**：

```sql
-- 主库：配置
wal_level = logical

-- 主库：创建发布
CREATE PUBLICATION my_publication FOR TABLE users, orders;

-- 从库：创建订阅
CREATE SUBSCRIPTION my_subscription
CONNECTION 'host=master_host port=5432 dbname=mydb user=repl_user'
PUBLICATION my_publication;
```

**流复制 vs 逻辑复制**：

| 特性 | 流复制 | 逻辑复制 |
|------|--------|---------|
| 复制粒度 | 整个集群 | 可选择表 |
| WAL 级别 | replica | logical |
| 跨版本 | 必须相同版本 | 可以不同版本 |
| 跨平台 | 必须相同平台 | 可以不同平台 |
| 性能影响 | 较小 | 较大 |
| 适用场景 | 高可用、读扩展 | 数据迁移、部分同步 |

### 7.1.2 自动故障转移

**使用 Patroni**：

```yaml
# patroni.yml
scope: postgres-cluster
name: node1

restapi:
  listen: 0.0.0.0:8008
  connect_address: 192.168.1.10:8008

postgresql:
  listen: 0.0.0.0:5432
  connect_address: 192.168.1.10:5432
  data_dir: /var/lib/postgresql/15/main
  
  authentication:
    replication:
      username: repl_user
      password: repl_password
    superuser:
      username: postgres
      password: postgres_password

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576
    
  initdb:
    - encoding: UTF8
    - data-checksums

etcd:
  hosts: 192.168.1.10:2379,192.168.1.11:2379,192.168.1.12:2379
```

```bash
# 启动 Patroni
patroni patroni.yml

# 查看集群状态
patronictl -c patroni.yml list
```

**Patroni 架构**：

```text
                    ┌─────────────┐
                    │   etcd      │
                    │  (DCS)      │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────┴────┐       ┌────┴────┐       ┌────┴────┐
   │ Node 1  │       │ Node 2  │       │ Node 3  │
   │ (Master)│       │(Replica)│       │(Replica)│
   │Patroni  │       │Patroni  │       │Patroni  │
   └─────────┘       └─────────┘       └─────────┘
```

### 7.1.3 连接池（PgBouncer）

```ini
# pgbouncer.ini
[databases]
mydb = host=127.0.0.1 port=5432 dbname=mydb

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

pool_mode = transaction  # transaction/session/statement
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3

server_reset_query = DISCARD ALL
server_check_query = SELECT 1
server_check_delay = 30

log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
stats_period = 60
```

```bash
# 启动 PgBouncer
pgbouncer -d /etc/pgbouncer/pgbouncer.ini

# 应用连接 PgBouncer（而不是直接连 PostgreSQL）
postgresql://user:password@pgbouncer_host:6432/mydb
```

**连接池模式对比**：

| 模式 | 连接分配 | 事务 | 临时表 | 适用场景 |
|------|---------|------|--------|---------|
| **Session** | 整个会话 | 支持 | 支持 | 需要临时表、会话变量 |
| **Transaction** | 每个事务 | 支持 | 不支持 | **大多数应用（推荐）** |
| **Statement** | 每条语句 | 不支持 | 不支持 | 简单查询 |

## 7.2 性能调优

### 7.2.1 内存配置

```ini
# postgresql.conf

# 共享缓冲区（25% 物理内存）
shared_buffers = 4GB

# 有效缓存大小（75% 物理内存）
effective_cache_size = 12GB

# 工作内存（每个排序/哈希操作）
work_mem = 16MB

# 维护工作内存
maintenance_work_mem = 1GB

# WAL 缓冲区
wal_buffers = 64MB
```

**内存配置计算**：

```text
假设服务器 16GB 内存：

shared_buffers = 16GB × 25% = 4GB
effective_cache_size = 16GB × 75% = 12GB
work_mem = 16GB / (max_connections × 3) = 16MB（假设 200 连接）
maintenance_work_mem = 1GB（VACUUM、CREATE INDEX 使用）
```

### 7.2.2 查询优化

```sql
-- 1. 使用 EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 123 AND status = 'completed';

-- 2. 查看慢查询
SELECT
    query,
    calls,
    total_time / 1000 AS total_seconds,
    mean_time / 1000 AS avg_seconds,
    rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- 3. 查找未使用索引的表
SELECT
    schemaname,
    relname,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > 1000
  AND idx_scan < 100
ORDER BY seq_scan DESC;

-- 4. 查找膨胀的表
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    n_dead_tup,
    n_live_tup,
    CASE WHEN n_live_tup > 0
         THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
         ELSE 0
    END AS dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY dead_ratio DESC;
```

### 7.2.3 批量操作优化

```sql
-- ❌ 慢：逐条插入
INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com');
-- ... 重复 10000 次

-- ✅ 快：批量插入
INSERT INTO users (name, email) VALUES
    ('Alice', 'alice@example.com'),
    ('Bob', 'bob@example.com'),
    -- ... 一次插入多行
    ('Zara', 'zara@example.com');

-- ✅ 更快：使用 COPY
COPY users (name, email) FROM '/path/to/data.csv' WITH CSV HEADER;

-- 或使用 \copy（psql 命令）
\copy users (name, email) FROM 'data.csv' WITH CSV HEADER
```

**COPY vs INSERT 性能对比**：

| 方法 | 10 万行数据 | 相对性能 |
|------|-----------|---------|
| 逐条 INSERT | ~100 秒 | 1x |
| 批量 INSERT（1000 行/批） | ~5 秒 | 20x |
| COPY | ~1 秒 | **100x** |

### 7.2.4 并发优化

```sql
-- 1. 使用 FOR UPDATE SKIP LOCKED 实现任务队列
SELECT id, task_data
FROM tasks
WHERE status = 'pending'
ORDER BY created_at
LIMIT 10
FOR UPDATE SKIP LOCKED;

-- 2. 使用 advisory locks 防止重复执行
SELECT pg_try_advisory_lock(hashtext('daily_report')) AS locked;
-- 如果返回 true，执行任务
-- 完成后释放
SELECT pg_advisory_unlock(hashtext('daily_report'));

-- 3. 使用部分索引减少索引大小
CREATE INDEX idx_active_users ON users(email) WHERE is_active = true;

-- 4. 使用 BRIN 索引优化时间序列
CREATE INDEX idx_logs_created_brin ON logs USING BRIN (created_at);
```

## 7.3 安全加固

### 7.3.1 用户与权限

```sql
-- 1. 创建只读用户
CREATE USER readonly_user WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE mydb TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;

-- 2. 创建应用用户（最小权限）
CREATE USER app_user WITH PASSWORD 'app_password';
GRANT CONNECT ON DATABASE mydb TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 3. 禁止超级用户远程登录
ALTER USER postgres PASSWORD NULL;

-- 4. 查看用户权限
SELECT
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'app_user';
```

### 7.3.2 行级安全（Row Level Security）

```sql
-- 启用 RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能看到自己的订单
CREATE POLICY user_orders_policy ON orders
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::INTEGER);

-- 设置当前用户 ID（应用层设置）
SET app.current_user_id = '123';

-- 查询（自动过滤）
SELECT * FROM orders;  -- 只返回 user_id = 123 的订单
```

### 7.3.3 SSL/TLS 加密

```ini
# postgresql.conf
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
ssl_ca_file = '/etc/ssl/certs/ca.crt'

# 强制 SSL
hostssl all all 0.0.0.0/0 md5
hostnossl all all 0.0.0.0/0 reject
```

```bash
# 客户端连接（强制 SSL）
psql "host=db.example.com dbname=mydb user=myuser sslmode=verify-full"
```

### 7.3.4 审计日志

```sql
-- 安装 pgaudit 扩展
CREATE EXTENSION pgaudit;

-- 配置审计（postgresql.conf）
shared_preload_libraries = 'pgaudit'
pgaudit.log = 'read, write, ddl, role'
pgaudit.log_catalog = on
pgaudit.log_parameter = on

-- 查看审计日志
SELECT * FROM pg_stat_activity WHERE query LIKE '%AUDIT%';
```

## 7.4 监控与告警

### 7.4.1 关键指标

```sql
-- 1. 连接数
SELECT count(*) FROM pg_stat_activity;
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- 2. 数据库大小
SELECT
    datname,
    pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database
ORDER BY pg_database_size(datname) DESC;

-- 3. 表大小
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- 4. 索引使用情况
SELECT
    schemaname,
    tablename,
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 5. 缓存命中率
SELECT
    sum(heap_blks_read) AS heap_read,
    sum(heap_blks_hit) AS heap_hit,
    CASE WHEN sum(heap_blks_hit) + sum(heap_blks_read) = 0
         THEN 0
         ELSE sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))
    END AS ratio
FROM pg_statio_user_tables;

-- 6. 事务 ID 年龄（防止回卷）
SELECT
    datname,
    age(datfrozenxid) AS age
FROM pg_database
ORDER BY age DESC;
```

### 7.4.2 监控工具

**Prometheus + postgres_exporter**：

```yaml
# docker-compose.yml
version: '3'
services:
  postgres_exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      DATA_SOURCE_NAME: "postgresql://monitor_user:password@postgres:5432/mydb?sslmode=disable"
    ports:
      - "9187:9187"

  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'postgresql'
    static_configs:
      - targets: ['postgres_exporter:9187']
```

**Grafana Dashboard**：

导入 PostgreSQL Dashboard（ID: 9628）

### 7.4.3 告警规则

```yaml
# Prometheus alerting rules
groups:
  - name: postgresql
    rules:
      - alert: PostgreSQLDown
        expr: pg_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL 实例宕机"

      - alert: PostgreSQLHighConnections
        expr: pg_stat_activity_count > (pg_settings_max_connections * 0.8)
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL 连接数过高 ({{ $value }})"

      - alert: PostgreSQLLowCacheHitRatio
        expr: pg_stat_database_blks_hit{datname!="template0",datname!="template1"} / (pg_stat_database_blks_hit{datname!="template0",datname!="template1"} + pg_stat_database_blks_read{datname!="template0",datname!="template1"}) < 0.98
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL 缓存命中率过低 ({{ $value | humanizePercentage }})"

      - alert: PostgreSQLHighDeadTuples
        expr: pg_stat_user_tables_n_dead_tup > 10000
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL 死元组过多 ({{ $value }})"

      - alert: PostgreSQLTransactionIDWraparound
        expr: age(pg_database_datfrozenxid{datname!="template0",datname!="template1"}) > 1000000000
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL 事务 ID 接近回卷 ({{ $value }})"
```

## 7.5 备份与恢复

### 7.5.1 物理备份（pg_basebackup）

```bash
# 完整备份
pg_basebackup -h localhost -U backup_user -D /backup/postgres/full_$(date +%Y%m%d) -Ft -z -P

# 增量备份（使用 WAL 归档）
# 配置 postgresql.conf
archive_mode = on
archive_command = 'cp %p /backup/postgres/wal_archive/%f'

# 备份 WAL 文件
pg_basebackup -h localhost -U backup_user -D /backup/postgres/incr_$(date +%Y%m%d) -Ft -z -P -Xs
```

### 7.5.2 逻辑备份（pg_dump）

```bash
# 完整备份
pg_dump -h localhost -U backup_user -Fc -Z 9 mydb > /backup/postgres/mydb_$(date +%Y%m%d).dump

# 并行备份
pg_dump -h localhost -U backup_user -Fd -j 4 -Z 9 mydb -f /backup/postgres/mydb_$(date +%Y%m%d)

# 只备份结构
pg_dump -h localhost -U backup_user -s mydb > /backup/postgres/mydb_schema.sql

# 只备份数据
pg_dump -h localhost -U backup_user -a mydb > /backup/postgres/mydb_data.sql
```

### 7.5.3 备份脚本

```bash
#!/bin/bash
# backup_postgres.sh

BACKUP_DIR="/backup/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# 创建备份目录
mkdir -p $BACKUP_DIR

# 逻辑备份
pg_dump -h localhost -U backup_user -Fc -Z 9 mydb > $BACKUP_DIR/mydb_$DATE.dump

# 物理备份（每周一次）
if [ $(date +%u) -eq 7 ]; then
    pg_basebackup -h localhost -U backup_user -D $BACKUP_DIR/full_$DATE -Ft -z -P
fi

# 清理旧备份
find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "full_*" -type d -mtime +30 -exec rm -rf {} \;

# 验证备份
pg_restore --list $BACKUP_DIR/mydb_$DATE.dump > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "Backup successful: $DATE"
else
    echo "Backup failed: $DATE"
    exit 1
fi
```

### 7.5.4 恢复测试

```bash
# 定期测试恢复（重要！）
# 1. 创建测试数据库
createdb -h localhost -U postgres test_restore

# 2. 恢复备份
pg_restore -h localhost -U postgres -d test_restore /backup/postgres/mydb_latest.dump

# 3. 验证数据
psql -h localhost -U postgres -d test_restore -c "SELECT COUNT(*) FROM users;"

# 4. 删除测试数据库
dropdb -h localhost -U postgres test_restore
```

## 7.6 常见场景解决方案

### 7.6.1 电商订单系统

```sql
-- 表设计
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    order_no VARCHAR(32) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- 按月分区
CREATE TABLE orders_2026_01 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- 索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status) WHERE status != 'completed';

-- 乐观锁（防止并发更新）
UPDATE orders
SET status = 'completed', updated_at = NOW()
WHERE id = 123 AND updated_at = '2026-09-06 10:00:00';
-- 如果 updated_at 已变，说明被其他事务修改
```

### 7.6.2 实时排行榜

```sql
-- 使用有序集合（需要 intarray 扩展）
CREATE EXTENSION intarray;

CREATE TABLE leaderboard (
    user_id INTEGER PRIMARY KEY,
    score INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 更新分数
INSERT INTO leaderboard (user_id, score)
VALUES (123, 1000)
ON CONFLICT (user_id) DO UPDATE
SET score = GREATEST(leaderboard.score, EXCLUDED.score),
    updated_at = NOW();

-- 查询排名（使用窗口函数）
SELECT
    user_id,
    score,
    RANK() OVER (ORDER BY score DESC) AS rank
FROM leaderboard
WHERE score > 0
ORDER BY score DESC
LIMIT 100;
```

### 7.6.3 多租户系统

```sql
-- 方案 1：共享数据库，行级隔离
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    price NUMERIC(10, 2)
);

-- 启用 RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.tenant_id')::INTEGER);

-- 应用层设置当前租户
SET app.tenant_id = '123';

-- 方案 2：独立 Schema
CREATE SCHEMA tenant_123;
CREATE TABLE tenant_123.products (...);

-- 方案 3：独立数据库（最强隔离）
CREATE DATABASE tenant_123;
```

## 7.7 故障排查清单

### 7.7.1 连接问题

```bash
# 1. 检查 PostgreSQL 是否运行
systemctl status postgresql

# 2. 检查端口
netstat -tlnp | grep 5432

# 3. 检查连接数
psql -c "SELECT count(*) FROM pg_stat_activity;"

# 4. 检查最大连接数
psql -c "SHOW max_connections;"

# 5. 终止空闲连接
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '1 hour';"
```

### 7.7.2 性能问题

```sql
-- 1. 查看当前查询
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;

-- 2. 查看锁等待
SELECT
    blocked_locks.pid AS blocked_pid,
    blocking_locks.pid AS blocking_pid,
    blocked_activity.query AS blocked_query,
    blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 3. 终止长时间运行的查询
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '5 minutes'
  AND query NOT ILIKE '%pg_terminate_backend%';

-- 4. 查看表膨胀
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_dead_tup
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;
```

### 7.7.3 复制延迟

```sql
-- 主库：查看复制状态
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS lag_bytes
FROM pg_stat_replication;

-- 从库：查看复制延迟
SELECT
    now() - pg_last_xact_replay_timestamp() AS replication_delay;

-- 从库：查看 WAL 接收状态
SELECT * FROM pg_stat_wal_receiver;
```

---

## 本章小结

- 主从复制（流复制/逻辑复制）实现高可用和读扩展
- Patroni 提供自动故障转移
- PgBouncer 连接池提升并发性能
- 合理配置内存参数（shared_buffers、work_mem）
- 使用 EXPLAIN ANALYZE 分析慢查询
- COPY 比 INSERT 快 100 倍
- 行级安全（RLS）实现多租户隔离
- 定期备份并测试恢复
- 监控关键指标：连接数、缓存命中率、死元组、事务 ID 年龄
- 生产环境必须开启 SSL、配置审计日志
