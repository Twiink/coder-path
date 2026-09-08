---
title: "PostgreSQL事务与并发控制"
aliases:
  - "PostgreSQL事务"
  - "PostgreSQL MVCC"
  - "PostgreSQL锁机制"
tags:
  - "后端"
  - "数据库"
  - "postgresql"
  - "事务"
  - "并发控制"
  - "笔记"
category: "后端"
folder: "PostgreSQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/PostgreSQL/PostgreSQL索引与性能优化]]"
  - "[[后端/数据库/PostgreSQL/PostgreSQL高级特性]]"
  - "[[后端/数据库/MySQL/事务与锁机制]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 05 PostgreSQL 事务与并发控制

PostgreSQL 使用 MVCC（多版本并发控制）实现高并发，读写操作互不阻塞。本章深入讲解事务管理、隔离级别、锁机制和并发控制。

## 5.1 事务基础

### 5.1.1 事务语法

```sql
-- 开始事务
BEGIN;
-- 或
START TRANSACTION;

-- 执行操作
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
UPDATE accounts SET balance = balance + 100 WHERE user_id = 2;

-- 提交事务
COMMIT;

-- 或回滚事务
ROLLBACK;
```

### 5.1.2 保存点（Savepoint）

```sql
BEGIN;

INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');

SAVEPOINT sp1;

INSERT INTO orders (user_id, total) VALUES (1, 100);

-- 如果出错，只回滚到保存点
ROLLBACK TO SAVEPOINT sp1;

-- 继续执行
INSERT INTO orders (user_id, total) VALUES (2, 200);

-- 释放保存点
RELEASE SAVEPOINT sp1;

COMMIT;
```

### 5.1.3 自动提交

```sql
-- 查看当前自动提交设置
SHOW autocommit;  -- 默认 on

-- 在 psql 中禁用自动提交
\set AUTOCOMMIT off

-- 每条语句都是独立事务
UPDATE users SET age = age + 1 WHERE id = 1;  -- 自动提交
UPDATE users SET age = age + 1 WHERE id = 2;  -- 自动提交
```

## 5.2 事务隔离级别

### 5.2.1 四种隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | PostgreSQL 实现 |
|---------|------|-----------|------|----------------|
| **READ UNCOMMITTED** | 可能 | 可能 | 可能 | 等同于 READ COMMITTED |
| **READ COMMITTED** | 不可能 | 可能 | 可能 | ✅ 默认级别 |
| **REPEATABLE READ** | 不可能 | 不可能 | 可能 | ✅ 使用快照 |
| **SERIALIZABLE** | 不可能 | 不可能 | 不可能 | ✅ 可序列化快照 |

### 5.2.2 设置隔离级别

```sql
-- 设置当前事务的隔离级别
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- 执行操作
COMMIT;

-- 或在 BEGIN 时指定
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- 设置会话默认隔离级别
SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- 设置数据库默认隔离级别
ALTER DATABASE mydb SET DEFAULT_TRANSACTION_ISOLATION = 'REPEATABLE READ';
```

### 5.2.3 READ COMMITTED（默认）

```sql
-- 事务 A
BEGIN;
SELECT balance FROM accounts WHERE user_id = 1;  -- 返回 1000

-- 事务 B 提交修改
-- UPDATE accounts SET balance = 500 WHERE user_id = 1;
-- COMMIT;

-- 事务 A 再次查询（看到新值）
SELECT balance FROM accounts WHERE user_id = 1;  -- 返回 500

-- 每次 SELECT 都看到最新的已提交数据
COMMIT;
```

**特点**：
- 每次 SELECT 都使用新的快照
- 可以看到其他事务已提交的修改
- 可能出现不可重复读和幻读

### 5.2.4 REPEATABLE READ

```sql
-- 事务 A
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM accounts WHERE user_id = 1;  -- 返回 1000

-- 事务 B 提交修改
-- UPDATE accounts SET balance = 500 WHERE user_id = 1;
-- COMMIT;

-- 事务 A 再次查询（仍然看到旧值）
SELECT balance FROM accounts WHERE user_id = 1;  -- 返回 1000

-- 整个事务期间使用同一个快照
COMMIT;
```

**特点**：
- 事务开始时创建快照
- 整个事务期间看到一致的数据
- 防止不可重复读
- 可能出现幻读（PostgreSQL 实际上也防止了幻读）

### 5.2.5 SERIALIZABLE

```sql
-- 事务 A
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT SUM(balance) FROM accounts WHERE type = 'savings';  -- 返回 10000

-- 事务 B
-- BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- INSERT INTO accounts (user_id, type, balance) VALUES (3, 'savings', 500);
-- COMMIT;

-- 事务 A 再次查询
SELECT SUM(balance) FROM accounts WHERE type = 'savings';  -- 返回 10000

-- 事务 A 尝试更新
UPDATE accounts SET balance = balance * 1.1 WHERE type = 'savings';
-- ERROR: could not serialize access due to concurrent update

COMMIT;
```

**特点**：
- 最严格的隔离级别
- 保证可序列化执行（等同于串行执行）
- 使用可序列化快照隔离（SSI）
- 可能出现序列化失败，需要重试

### 5.2.6 隔离级别对比

```sql
-- 示例：两个并发事务

-- 事务 A（REPEATABLE READ）
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT * FROM users WHERE id = 1;  -- 返回 {id: 1, name: 'Alice'}

-- 事务 B（任何级别）
-- UPDATE users SET name = 'Bob' WHERE id = 1;
-- COMMIT;

-- 事务 A 再次查询
SELECT * FROM users WHERE id = 1;  -- 仍然返回 {id: 1, name: 'Alice'}

-- 事务 A 尝试更新
UPDATE users SET age = 30 WHERE id = 1;
-- 在 REPEATABLE READ 下会失败
-- ERROR: could not serialize access due to concurrent update

COMMIT;
```

**选择建议**：

| 场景 | 推荐隔离级别 |
|------|-------------|
| 大多数应用 | READ COMMITTED（默认） |
| 需要一致读 | REPEATABLE READ |
| 金融、关键业务 | SERIALIZABLE |
| 只读报表 | REPEATABLE READ |

## 5.3 MVCC（多版本并发控制）

### 5.3.1 MVCC 原理

```text
每行数据包含隐藏字段：
  - xmin: 创建该版本的事务 ID
  - xmax: 删除该版本的事务 ID
  - cmin/cmax: 命令 ID

示例：
  事务 100: INSERT INTO users (id, name) VALUES (1, 'Alice');
  → 创建元组: {id: 1, name: 'Alice', xmin: 100, xmax: 0}

  事务 101: UPDATE users SET name = 'Bob' WHERE id = 1;
  → 创建新元组: {id: 1, name: 'Bob', xmin: 101, xmax: 0}
  → 标记旧元组: {id: 1, name: 'Alice', xmin: 100, xmax: 101}

  事务 102 查询（在事务 101 提交后）:
  → 看到 {id: 1, name: 'Bob', xmin: 101}（最新版本）

  事务 103（在事务 101 提交前开始）:
  → 看到 {id: 1, name: 'Alice', xmin: 100}（旧版本）
```

### 5.3.2 版本链

```text
行版本链：
  当前版本 (xmin: 103)
    ↓
  旧版本 (xmin: 101, xmax: 103)
    ↓
  更旧版本 (xmin: 100, xmax: 101)

查询时根据事务的快照决定看到哪个版本：
  - 快照包含：事务开始时所有活跃事务的列表
  - 可见性规则：
    1. xmin < 快照中的最小事务 ID → 可见
    2. xmin 在快照中且已提交 → 可见
    3. xmin 在快照中且未提交 → 不可见
    4. xmin > 快照中的最大事务 ID → 不可见
```

### 5.3.3 查看行版本信息

```sql
-- 使用 pageinspect 扩展
CREATE EXTENSION pageinspect;

-- 查看页面的元组信息
SELECT lp, lp_off, lp_flags, t_xmin, t_xmax, t_field3, t_ctid
FROM heap_page_items(get_raw_page('users', 0));

-- 使用 pg_visibility 扩展
CREATE EXTENSION pg_visibility;

-- 查看页面的可见性映射
SELECT * FROM pg_visibility_map('users');
```

## 5.4 锁机制

### 5.4.1 表级锁

```sql
-- 显式锁定表
LOCK TABLE users IN ACCESS EXCLUSIVE MODE;

-- 锁模式（从弱到强）
-- ACCESS SHARE: SELECT（默认）
-- ROW SHARE: SELECT FOR UPDATE/SHARE
-- ROW EXCLUSIVE: INSERT, UPDATE, DELETE
-- SHARE UPDATE EXCLUSIVE: VACUUM, ANALYZE
-- SHARE: CREATE INDEX
-- SHARE ROW EXCLUSIVE: CREATE TRIGGER
-- EXCLUSIVE: 某些 ALTER TABLE
-- ACCESS EXCLUSIVE: DROP TABLE, TRUNCATE, 大多数 ALTER TABLE

-- 查看当前锁
SELECT
    l.locktype,
    l.relation::regclass AS table_name,
    l.mode,
    l.granted,
    p.pid,
    p.query
FROM pg_locks l
JOIN pg_stat_activity p ON l.pid = p.pid
WHERE l.relation IS NOT NULL;
```

**锁兼容性矩阵**：

| 请求 \ 持有 | AS | RS | RX | SUE | S | SRE | E | AE |
|------------|----|----|----|-----|---|-----|---|----|
| ACCESS SHARE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| ROW SHARE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| ROW EXCLUSIVE | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| SHARE | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| ACCESS EXCLUSIVE | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

### 5.4.2 行级锁

```sql
-- SELECT FOR UPDATE（排他锁）
BEGIN;
SELECT * FROM accounts WHERE user_id = 1 FOR UPDATE;
-- 其他事务无法修改这行，直到当前事务结束
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
COMMIT;

-- SELECT FOR SHARE（共享锁）
BEGIN;
SELECT * FROM accounts WHERE user_id = 1 FOR SHARE;
-- 其他事务可以读取和加共享锁，但不能修改
COMMIT;

-- FOR NO KEY UPDATE（弱排他锁，PostgreSQL 9.4+）
SELECT * FROM users WHERE id = 1 FOR NO KEY UPDATE;
-- 允许其他事务修改非主键列

-- FOR KEY SHARE（最弱的锁，PostgreSQL 9.4+）
SELECT * FROM users WHERE id = 1 FOR KEY SHARE;
-- 只锁定主键，允许修改其他列
```

**行锁强度对比**：

| 锁类型 | 强度 | 用途 |
|--------|------|------|
| FOR KEY SHARE | 最弱 | 只保护主键不变 |
| FOR SHARE | 弱 | 允许并发读，阻止写 |
| FOR NO KEY UPDATE | 中 | 允许修改非主键列 |
| FOR UPDATE | 最强 | 完全锁定行 |

### 5.4.3  NOWAIT 和 SKIP LOCKED

```sql
-- NOWAIT：如果无法立即获得锁，立即报错
SELECT * FROM accounts WHERE user_id = 1 FOR UPDATE NOWAIT;
-- ERROR: could not obtain lock on row

-- SKIP LOCKED：跳过已锁定的行
SELECT * FROM accounts
WHERE balance > 1000
ORDER BY balance DESC
LIMIT 10
FOR UPDATE SKIP LOCKED;
-- 只返回未被锁定的行，适合任务队列
```

**任务队列示例**：

```sql
-- 工作进程获取任务
BEGIN;
SELECT id, task_data
FROM tasks
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- 处理任务
UPDATE tasks SET status = 'completed' WHERE id = 123;
COMMIT;
```

### 5.4.4  advisory locks（咨询锁）

```sql
-- 获取会话级咨询锁
SELECT pg_advisory_lock(12345);
-- 锁在会话结束或显式释放前一直持有

-- 释放锁
SELECT pg_advisory_unlock(12345);

-- 获取事务级咨询锁
SELECT pg_advisory_xact_lock(12345);
-- 事务结束时自动释放

-- 尝试获取锁（不阻塞）
SELECT pg_try_advisory_lock(12345);
-- 返回 true/false

-- 使用两个整数作为锁 ID
SELECT pg_advisory_lock(1, 2);

-- 共享咨询锁
SELECT pg_advisory_lock_shared(12345);
-- 多个会话可以同时持有共享锁
```

**应用场景**：

```sql
-- 防止重复执行定时任务
CREATE OR REPLACE FUNCTION run_scheduled_task()
RETURNS void AS $$
BEGIN
    -- 尝试获取锁
    IF NOT pg_try_advisory_lock(hashtext('daily_report')) THEN
        RAISE NOTICE 'Task already running';
        RETURN;
    END IF;

    -- 执行任务
    PERFORM generate_daily_report();

    -- 释放锁
    PERFORM pg_advisory_unlock(hashtext('daily_report'));
END;
$$ LANGUAGE plpgsql;
```

## 5.5 并发问题与解决方案

### 5.5.1 丢失更新

```sql
-- 问题：两个事务同时读取并更新同一行

-- 事务 A
BEGIN;
SELECT balance FROM accounts WHERE user_id = 1;  -- 返回 1000
-- 计算：1000 - 100 = 900

-- 事务 B（同时执行）
-- BEGIN;
-- SELECT balance FROM accounts WHERE user_id = 1;  -- 返回 1000
-- -- 计算：1000 + 200 = 1200
-- UPDATE accounts SET balance = 1200 WHERE user_id = 1;
-- COMMIT;

-- 事务 A 继续
UPDATE accounts SET balance = 900 WHERE user_id = 1;  -- 覆盖了事务 B 的更新！
COMMIT;

-- 最终结果：900（应该是 1100）
```

**解决方案 1：使用 FOR UPDATE**

```sql
BEGIN;
SELECT balance FROM accounts WHERE user_id = 1 FOR UPDATE;  -- 加锁
-- 其他事务会等待锁释放
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
COMMIT;
```

**解决方案 2：使用原子更新**

```sql
-- 不使用 SELECT，直接 UPDATE
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
-- 自动加行锁，保证原子性
```

**解决方案 3：使用 SERIALIZABLE**

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT balance FROM accounts WHERE user_id = 1;
-- ... 计算 ...
UPDATE accounts SET balance = 900 WHERE user_id = 1;
-- 如果检测到并发冲突，会报错
-- ERROR: could not serialize access due to concurrent update
COMMIT;
-- 应用层需要捕获错误并重试
```

### 5.5.2 死锁

```sql
-- 事务 A
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;  -- 锁定行 1
-- 等待行 2...

-- 事务 B（同时执行）
-- BEGIN;
-- UPDATE accounts SET balance = balance - 100 WHERE user_id = 2;  -- 锁定行 2
-- UPDATE accounts SET balance = balance + 100 WHERE user_id = 1;  -- 等待行 1...

-- 死锁！PostgreSQL 会自动检测并终止一个事务
-- ERROR: deadlock detected
```

**预防死锁**：

```sql
-- 1. 按相同顺序访问资源
-- 总是先锁定 user_id 较小的行
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
UPDATE accounts SET balance = balance + 100 WHERE user_id = 2;

-- 2. 使用单个 UPDATE 语句
UPDATE accounts
SET balance = CASE
    WHEN user_id = 1 THEN balance - 100
    WHEN user_id = 2 THEN balance + 100
END
WHERE user_id IN (1, 2);

-- 3. 设置锁超时
SET lock_timeout = '5s';
-- 如果 5 秒内无法获得锁，报错
```

### 5.5.3 幻读

```sql
-- 事务 A（REPEATABLE READ）
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) FROM users WHERE age > 18;  -- 返回 1000

-- 事务 B
-- INSERT INTO users (name, age) VALUES ('Charlie', 25);
-- COMMIT;

-- 事务 A 再次查询
SELECT COUNT(*) FROM users WHERE age > 18;  -- 仍然返回 1000（无幻读）

-- 事务 A 尝试插入
INSERT INTO users (name, age) VALUES ('David', 30);
-- 成功（PostgreSQL 的 REPEATABLE READ 实际上防止了幻读）

COMMIT;
```

**PostgreSQL 的特殊行为**：
- REPEATABLE READ 在 PostgreSQL 中实际上也防止了幻读
- 这比 SQL 标准要求的更严格
- 使用 SERIALIZABLE 可以获得更强的保证

## 5.6 VACUUM 与清理

### 5.6.1 为什么需要 VACUUM

```text
MVCC 的问题：
  - 每次 UPDATE 都创建新版本
  - 旧版本不会立即删除
  - 死元组（dead tuples）会占用空间
  - 表会膨胀，查询变慢

VACUUM 的作用：
  - 回收死元组占用的空间
  - 更新可见性映射（Visibility Map）
  - 冻结旧事务 ID（防止事务 ID 回卷）
```

### 5.6.2 手动 VACUUM

```sql
-- 基本 VACUUM（回收空间，但不归还给 OS）
VACUUM users;

-- VACUUM FULL（重建表，归还空间给 OS，会锁表）
VACUUM FULL users;

-- VACUUM ANALYZE（同时更新统计信息）
VACUUM ANALYZE users;

-- VACUUM VERBOSE（显示详细信息）
VACUUM VERBOSE users;

-- 查看表的死元组数量
SELECT
    schemaname,
    relname,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

### 5.6.3 自动清理（Autovacuum）

```sql
-- 查看自动清理配置
SHOW autovacuum;  -- 应该是 on

-- 全局配置（postgresql.conf）
-- autovacuum = on
-- autovacuum_max_workers = 3
-- autovacuum_naptime = 1min
-- autovacuum_vacuum_threshold = 50
-- autovacuum_vacuum_scale_factor = 0.2
-- autovacuum_analyze_threshold = 50
-- autovacuum_analyze_scale_factor = 0.1

-- 触发条件：
-- vacuum: threshold + scale_factor * n_live_tup
-- 例如：50 + 0.2 * 10000 = 2050 个死元组时触发

-- 表级配置
ALTER TABLE users SET (
    autovacuum_enabled = true,
    autovacuum_vacuum_threshold = 100,
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_threshold = 100,
    autovacuum_analyze_scale_factor = 0.05
);

-- 禁用特定表的自动清理
ALTER TABLE logs SET (autovacuum_enabled = false);

-- 查看自动清理工作进程
SELECT * FROM pg_stat_activity WHERE backend_type = 'autovacuum worker';
```

### 5.6.4 事务 ID 回卷

```text
PostgreSQL 使用 32 位事务 ID：
  - 总共约 40 亿个事务 ID
  - 使用循环方式（wraparound）
  - 超过 20 亿的事务 ID 被认为是"过去"
  - 如果事务 ID 回卷，旧数据会被认为是"未来"的

VACUUM 的冻结机制：
  - 将旧版本的事务 ID 标记为"冻结"（FrozenTransactionId）
  - 冻结的事务 ID 总是可见
  - 防止回卷问题

安全限制：
  - 当距离回卷还有 1000 万事务 ID 时，PostgreSQL 会拒绝新事务
  - 必须立即执行 VACUUM FREEZE
```

```sql
-- 查看距离回卷的事务 ID 数量
SELECT datname, age(datfrozenxid) AS age
FROM pg_database
ORDER BY age DESC;

-- 如果 age 接近 20 亿，需要立即 VACUUM
VACUUM FREEZE users;

-- 查看表的冻结年龄
SELECT relname, age(relfrozenxid) AS age
FROM pg_class
WHERE relkind = 'r'
ORDER BY age DESC
LIMIT 10;
```

## 5.7 性能优化建议

### 5.7.1 事务优化

```sql
-- 1. 保持事务简短
-- ❌ 错误：长时间持有事务
BEGIN;
SELECT * FROM large_table;  -- 可能很慢
-- ... 做其他事情 ...
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
COMMIT;

-- ✅ 正确：快速完成事务
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
COMMIT;

-- 2. 避免在事务中等待用户输入
-- ❌ 错误
BEGIN;
SELECT * FROM users WHERE id = 1;
-- 等待用户确认（可能几分钟）
UPDATE users SET status = 'confirmed' WHERE id = 1;
COMMIT;

-- ✅ 正确
SELECT * FROM users WHERE id = 1;
-- 用户确认
BEGIN;
UPDATE users SET status = 'confirmed' WHERE id = 1;
COMMIT;
```

### 5.7.2 锁优化

```sql
-- 1. 使用最弱的锁
-- ❌ 过度锁定
SELECT * FROM accounts WHERE user_id = 1 FOR UPDATE;

-- ✅ 只锁定需要的
SELECT * FROM accounts WHERE user_id = 1 FOR NO KEY UPDATE;

-- 2. 尽快释放锁
BEGIN;
SELECT * FROM accounts WHERE user_id = 1 FOR UPDATE;
-- 立即处理
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
COMMIT;  -- 尽快提交释放锁

-- 3. 使用 SKIP LOCKED 避免等待
SELECT * FROM tasks
WHERE status = 'pending'
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

### 5.7.3 监控与诊断

```sql
-- 查看长时间运行的事务
SELECT
    pid,
    now() - xact_start AS duration,
    state,
    query
FROM pg_stat_activity
WHERE state = 'active'
  AND xact_start IS NOT NULL
ORDER BY duration DESC;

-- 查看锁等待
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.query AS blocked_query,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.relation = blocked_locks.relation
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 终止长时间运行的查询
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '5 minutes';
```

---

## 本章小结

- PostgreSQL 使用 MVCC 实现高并发，读写互不阻塞
- 默认隔离级别是 READ COMMITTED，每次 SELECT 看到最新已提交数据
- REPEATABLE READ 使用事务开始时的快照，保证一致读
- SERIALIZABLE 提供最强的一致性保证，但可能有序列化失败
- 行级锁通过 SELECT FOR UPDATE/SHARE 实现
- SKIP LOCKED 适合实现任务队列
- 自动清理（Autovacuum）回收死元组，防止表膨胀
- 事务 ID 回卷是严重问题，需要监控并及时 VACUUM
- 保持事务简短，尽快释放锁
