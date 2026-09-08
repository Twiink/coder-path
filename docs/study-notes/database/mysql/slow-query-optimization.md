---
title: "慢查询与性能优化"
aliases:
  - "MySQL性能优化"
  - "MySQL调优"
  - "慢SQL优化"
tags:
  - "后端"
  - "数据库"
  - "mysql"
  - "性能优化"
  - "笔记"
category: "后端"
folder: "MySQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MySQL/索引与执行计划]]"
  - "[[后端/数据库/MySQL/日志与备份恢复]]"
  - "[[后端/数据库/MySQL/分库分表与高可用]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 08 慢查询与性能优化

性能优化是一个自上而下的体系:硬件 → 参数 → 架构 → SQL → 索引 → 表结构。本章按这个顺序讲清每一层的优化手段,并给出一套可落地的慢 SQL 排查方法论。

## 8.1 性能优化的层次

```text
优化收益从大到小、成本从高到低:

  ① 架构层:缓存、读写分离、分库分表、冷热分离    ← 收益最大,改动最大
  ② SQL 与索引层:改写 SQL、加/改索引            ← 收益大,改动小,日常主战场
  ③ 表结构层:范式/反范式、字段类型、分区         ← 中等,需提前设计
  ④ 参数层:buffer pool、连接数、刷盘策略         ← 中等,一次配置长期受益
  ⑤ 硬件层:SSD、内存、CPU、网络                  ← 基础,成本换性能
```

> **80/20 法则:** 80% 的性能问题来自 20% 的慢 SQL。优先做 SQL 与索引优化(投入小、见效快),架构级优化(分库分表)是最后手段,能不分就不分。

## 8.2 慢 SQL 排查方法论(五步法)

```text
第 1 步:发现慢 SQL —— 慢查询日志 + 监控
第 2 步:定位瓶颈 —— EXPLAIN / EXPLAIN ANALYZE
第 3 步:优化索引 —— 加索引、改联合索引、覆盖索引
第 4 步:改写 SQL —— 消除低效写法
第 5 步:验证效果 —— 对比 EXPLAIN 与实际耗时
```

### 第 1 步:发现慢 SQL

```bash
# 开启慢查询日志(见 [[后端/数据库/MySQL/日志与备份恢复]])
# 用 pt-query-digest 聚合分析,按总耗时排序
pt-query-digest /var/log/mysql/slow.log > slow_report.txt

# 报告的关键部分:
# Rank 1:  响应时间占比 45%, 调用 1.2 万次, 平均 1.2s
#          指纹:SELECT * FROM `order` WHERE user_id=? AND status=?
```

```sql
-- 实时查看正在执行的慢 SQL
SELECT id, user, host, db, time, state, info
FROM information_schema.PROCESSLIST
WHERE command != 'Sleep' AND time > 2
ORDER BY time DESC;

-- 查看最耗时的 SQL 摘要(performance_schema)
SELECT DIGEST_TEXT,
       COUNT_STAR AS exec_count,
       ROUND(SUM_TIMER_WAIT/1e12, 2) AS total_sec,
       ROUND(AVG_TIMER_WAIT/1e9, 2) AS avg_ms,
       SUM_ROWS_EXAMINED AS rows_examined
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC LIMIT 10;

-- 找出扫描行数远大于返回行数的 SQL(索引差的典型特征)
SELECT DIGEST_TEXT, COUNT_STAR, SUM_ROWS_EXAMINED, SUM_ROWS_SENT,
       ROUND(SUM_ROWS_EXAMINED / NULLIF(SUM_ROWS_SENT,0), 1) AS scan_ratio
FROM performance_schema.events_statements_summary_by_digest
WHERE SUM_ROWS_SENT > 0
ORDER BY scan_ratio DESC LIMIT 10;
```

### 第 2 步:用 EXPLAIN 定位瓶颈

```sql
EXPLAIN SELECT * FROM `order` WHERE DATE(created_at) = '2026-09-06';
```

```text
重点看这几列(详见 [[后端/数据库/MySQL/索引与执行计划]]):
  type = ALL           → 全表扫描,危险信号
  key = NULL           → 没用到索引
  rows = 5000000       → 预估扫描 500 万行
  Extra = Using filesort / Using temporary  → 额外排序/临时表
```

| 症状 | 病因 | 处方 |
| --- | --- | --- |
| `type=ALL` | 无可用索引 | 给 WHERE 列建索引 |
| `key=NULL` 但有 `possible_keys` | 优化器选错或索引失效 | 检查隐式转换、函数包裹;`ANALYZE TABLE`;必要时 FORCE INDEX |
| `type=index` | 全索引扫描 | 加更精准的索引,或做覆盖索引 |
| `Extra=Using filesort` | 排序列无索引 | 建 `(过滤列, 排序列)` 联合索引 |
| `Extra=Using temporary` | GROUP BY/DISTINCT 无索引 | 给分组列建索引 |
| `rows` 极大 `filtered` 极小 | 索引选择性差 | 改用联合索引,把高选择性列放前 |
| `Using join buffer (BNL)` | JOIN 被驱动表无索引 | 给关联列建索引 |

### 第 3~5 步:优化、改写、验证

见下面的索引优化与 SQL 改写小节。

## 8.3 索引层优化(最常见、最有效)

### 优化清单

```sql
-- ① 给 WHERE / JOIN / ORDER BY / GROUP BY 的列建索引
ALTER TABLE `order` ADD INDEX idx_user_status (user_id, status);

-- ② 用联合索引代替多个单列索引(最左前缀能服务多种查询)
-- ❌ idx_user(user_id) + idx_status(status) 两个单列索引
-- ✅ idx_user_status(user_id, status) 一个联合索引

-- ③ 覆盖索引,消除回表
-- 查询只需要 user_id 和 status,联合索引已包含 → Using index
SELECT user_id, status FROM `order` WHERE user_id = 100;

-- ④ 前缀索引,长字符串省空间
ALTER TABLE log ADD INDEX idx_url (url(20));

-- ⑤ 删除冗余与未使用的索引
SELECT * FROM sys.schema_redundant_indexes;
SELECT * FROM sys.schema_unused_indexes;
ALTER TABLE `order` DROP INDEX idx_user;   -- 已被 idx_user_status 覆盖

-- ⑥ 统计信息过期导致选错索引时,重新分析
ANALYZE TABLE `order`;
```

### 索引优化的高频场景

```sql
-- 场景 1:分页深翻
-- ❌ LIMIT 1000000, 20 扫描百万行
SELECT * FROM article ORDER BY id LIMIT 1000000, 20;
-- ✅ 游标分页(记住上次最大 id)
SELECT * FROM article WHERE id > 1000000 ORDER BY id LIMIT 20;
-- ✅ 延迟关联
SELECT a.* FROM article a
JOIN (SELECT id FROM article ORDER BY id LIMIT 1000000, 20) b ON a.id = b.id;

-- 场景 2:ORDER BY + WHERE 组合
-- 需求:WHERE status=1 ORDER BY created_at DESC
-- ✅ 建联合索引 (status, created_at),等值列在前排序列在后
ALTER TABLE article ADD INDEX idx_status_created (status, created_at);

-- 场景 3:范围查询后的列用不上索引
-- WHERE a > 10 AND b = 5,索引 (a,b) 中 b 用不上
-- ✅ 把等值列 b 放前面:索引 (b, a)
ALTER TABLE t ADD INDEX idx_b_a (b, a);

-- 场景 4:COUNT(*) 慢
-- InnoDB 的 COUNT(*) 必须扫描,大表很慢
-- ✅ 方案:用 information_schema 拿近似值
SELECT TABLE_ROWS FROM information_schema.TABLES
WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='article';   -- 估算,误差可达 40%
-- ✅ 方案:单独维护计数表 / Redis 计数器
-- ✅ 方案:带条件时确保走索引
SELECT COUNT(*) FROM article WHERE status = 1;   -- idx_status 可覆盖
```

## 8.4 SQL 改写优化

### 低效写法 → 高效写法对照表

| ❌ 低效 | ✅ 高效 | 原因 |
| --- | --- | --- |
| `SELECT *` | `SELECT id, name` | 覆盖索引、少传输 |
| `WHERE DATE(col)='x'` | `WHERE col>='x' AND col<'x+1'` | 列上不做函数,保住索引 |
| `WHERE col != 'x'` | 改成 `IN` 正向枚举或分区裁剪 | `!=` 通常无法用索引 |
| `WHERE col IS NULL` | 设计时 `NOT NULL DEFAULT ''` | NULL 影响索引与统计 |
| `VARCHAR col = 123` | `VARCHAR col = '123'` | 避免隐式类型转换 |
| `LIKE '%x%'` | 全文索引 / ES | 前置通配无法用索引 |
| `IN (超大子查询)` | `JOIN` 或 `EXISTS` | 半连接优化 |
| `NOT IN (子查询)` | `NOT EXISTS` / `LEFT JOIN ... IS NULL` | NOT IN 遇 NULL 返回空集 |
| `OR` 两侧条件 | `UNION ALL` 拆分 | OR 难用索引,拆开各走各的 |
| 大事务一次性改百万行 | 分批 `LIMIT 5000` 循环 | 避免长事务、锁等待、主从延迟 |
| 关联子查询逐行计算 | 改成 JOIN + GROUP BY | 避免 DEPENDENT SUBQUERY |
| `HAVING` 过滤行 | `WHERE` 先过滤 | WHERE 在聚合前,数据量小 |
| `ORDER BY RAND()` | 先取随机偏移再 LIMIT | RAND 要建临时表 + filesort |

### 具体改写示例

```sql
-- ① OR 改写为 UNION ALL(两侧走各自的索引)
-- ❌ 全表扫
SELECT * FROM user WHERE name = 'tom' OR age = 20;
-- ✅
SELECT * FROM user WHERE name = 'tom'
UNION ALL
SELECT * FROM user WHERE age = 20 AND name != 'tom';

-- ② 子查询改写为 JOIN
-- ❌ 关联子查询,每行执行一次
SELECT * FROM user u
WHERE (SELECT COUNT(*) FROM `order` o WHERE o.user_id = u.id) > 5;
-- ✅ JOIN + GROUP BY + HAVING
SELECT u.* FROM user u
JOIN `order` o ON o.user_id = u.id
GROUP BY u.id HAVING COUNT(*) > 5;

-- ③ EXISTS 代替 IN(外表大、子查询小时)
-- ❌
SELECT * FROM big_table WHERE id IN (SELECT big_id FROM small_table);
-- ✅
SELECT * FROM big_table b WHERE EXISTS (SELECT 1 FROM small_table s WHERE s.big_id = b.id);

-- ④ 用 UNION ALL 代替 UNION(不需去重时)
SELECT id FROM a UNION ALL SELECT id FROM b;   -- UNION 要建临时表去重,慢

-- ⑤ 分批更新大表(避免长事务锁表 + 主从延迟)
-- 存储过程或脚本循环:
UPDATE log SET archived = 1 WHERE archived = 0 ORDER BY id LIMIT 5000;
-- 重复执行直到 ROW_COUNT() = 0,每批之间 sleep 100ms
```

### 拆分复杂 SQL

```sql
-- ❌ 一个巨型 SQL:多层嵌套子查询 + 多表 JOIN + 窗口函数
-- 优化器难以选对计划,一处慢全盘慢,难维护

-- ✅ 拆成多个简单 SQL + 临时表 / 应用层组装
-- 步骤 1:先把中间结果落到临时表(带索引)
CREATE TEMPORARY TABLE tmp_active_user (
    user_id BIGINT PRIMARY KEY
) SELECT DISTINCT user_id FROM `order` WHERE created_at > '2026-01-01';

-- 步骤 2:基于临时表 JOIN
SELECT u.username, COUNT(o.id) AS cnt
FROM user u
JOIN tmp_active_user t ON t.user_id = u.id
JOIN `order` o ON o.user_id = u.id
GROUP BY u.username;
```

> **拆分大 SQL 的权衡:** 互联网架构倾向"数据库只做简单快速的存取,复杂逻辑放应用层",因为这便于水平扩展(分库分表后跨库 JOIN 做不了)。但拆分也增加了网络往返和应用内存,要在两者间平衡。**核心原则:数据库层避免大事务、复杂 JOIN、长时间锁。**

## 8.5 表结构层优化

### 字段类型优化

```sql
-- ① 用更小的类型:省空间 = 省 IO = 快
-- ❌ 用 BIGINT 存只到百万的状态码
-- ✅ 用 INT / SMALLINT / TINYINT

-- ② 尽量 NOT NULL:NULL 值使索引统计复杂,占用额外空间
ALTER TABLE user MODIFY phone VARCHAR(20) NOT NULL DEFAULT '';

-- ③ 定长用 CHAR,变长用 VARCHAR;IP 存 INT;金额存 DECIMAL/BIGINT

-- ④ 大字段垂直拆分:把 TEXT/BLOB 拆到副表,主表保持"窄"
-- 主表(高频查询,窄,一行能放更多进缓冲池)
CREATE TABLE article (id BIGINT PK, title VARCHAR(200), author_id BIGINT, created_at DATETIME);
-- 副表(正文,低频访问)
CREATE TABLE article_content (article_id BIGINT PK, content MEDIUMTEXT);
```

### 垂直拆分与水平拆分

| 拆分方式 | 做法 | 目的 |
| --- | --- | --- |
| **垂直分库** | 按业务拆库:用户库、订单库、商品库 | 业务解耦,分散压力 |
| **垂直分表** | 大字段拆到副表;高频列与低频列分开 | 让热表更窄,提高缓冲池命中率 |
| **水平分表** | 一张大表按规则拆成多张结构相同的表 | 单表数据量过大(见 [[后端/数据库/MySQL/分库分表与高可用]]) |
| **水平分库** | 数据分散到多个库 | 突破单机容量与性能上限 |

### 冷热分离

```text
把历史数据归档,让热表保持小:

  order(近 3 个月,热数据,高频查询)
        ↓ 定时任务归档
  order_archive_2025(历史数据,低频查询,可放廉价存储)

好处:热表小 → 索引树矮 → 缓冲池命中率高 → 查询快
```

```sql
-- 分区表实现冷热分离(对应用透明)
CREATE TABLE access_log (
    id BIGINT NOT NULL,
    created_at DATE NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (TO_DAYS(created_at)) (
    PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
    PARTITION p202608 VALUES LESS THAN (TO_DAYS('2026-09-01')),
    PARTITION p202609 VALUES LESS THAN (TO_DAYS('2026-10-01')),
    PARTITION pmax    VALUES LESS THAN MAXVALUE
);

-- 分区裁剪:只扫相关分区
SELECT * FROM access_log WHERE created_at >= '2026-09-01';   -- 只扫 p202609 + pmax

-- 归档:直接删除整个分区(秒级,不产生大量 undo)
ALTER TABLE access_log DROP PARTITION p202607;
```

> **分区表的限制:** ① 分区键必须包含在主键/唯一键中;② 最多 8192 个分区;③ 外键不支持;④ 分区裁剪依赖查询条件包含分区键。适合**按时间归档的日志/流水类**大表。

## 8.6 参数层优化

### 内存相关(最重要)

```ini
# ---- InnoDB 缓冲池:第一调优参数 ----
innodb_buffer_pool_size = 24G           # 【最重要】物理内存的 50%~70%(专用数据库机)
                                        # 数据页与索引页都缓存在这里,命中率 >99% 才正常
innodb_buffer_pool_instances = 8        # 缓冲池分区,减少并发争用(池≥1G 时建议设)
                                        # 经验:每个实例 1G 左右

# ---- 其他缓冲 ----
innodb_log_buffer_size = 64M            # redo log 缓冲,大事务可调大
sort_buffer_size = 2M                   # 【会话级】排序缓冲,过大 × 连接数会 OOM
join_buffer_size = 2M                   # 【会话级】JOIN 缓冲
read_buffer_size = 1M                   # 【会话级】顺序读缓冲
read_rnd_buffer_size = 1M               # 【会话级】随机读缓冲
tmp_table_size = 64M                    # 内存临时表上限,超过转磁盘临时表
max_heap_table_size = 64M               # 与 tmp_table_size 取小值生效
key_buffer_size = 32M                   # MyISAM 索引缓冲(纯 InnoDB 可设小)
```

> **会话级缓冲的陷阱:** `sort_buffer_size`、`join_buffer_size` 等是**每个连接、每次操作**都会分配的。设成 64M × 500 连接 = 32GB,直接 OOM。**这些参数宁小勿大**,通过优化 SQL(加索引避免 filesort)来解决,而不是靠调大 buffer。

```sql
-- 查看缓冲池命中率(应 > 99%)
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
-- 命中率 = 1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)
-- reads 是"不得不读磁盘"的次数,read_requests 是总请求次数

-- 8.0 在线调整缓冲池大小(不用重启)
SET GLOBAL innodb_buffer_pool_size = 32 * 1024 * 1024 * 1024;
SHOW STATUS LIKE 'Innodb_buffer_pool_resize_status';
```

### 连接相关

```ini
max_connections = 1000            # 最大连接数,默认 151;要 < 操作系统文件句柄限制
back_log = 1024                   # 连接队列长度,突发连接时排队
wait_timeout = 600                # 空闲连接超时(秒),默认 28800(8h)太大
interactive_timeout = 600         # 交互式连接超时
thread_cache_size = 64            # 线程缓存,复用线程避免频繁创建销毁
max_allowed_packet = 64M          # 单个包最大字节,大字段/批量插入要调大
```

```sql
-- 监控连接使用
SHOW GLOBAL STATUS LIKE 'Threads_connected';   -- 当前连接数
SHOW GLOBAL STATUS LIKE 'Threads_running';     -- 当前活跃(非 Sleep)线程数
SHOW GLOBAL STATUS LIKE 'Max_used_connections';-- 历史峰值连接数
SHOW GLOBAL STATUS LIKE 'Aborted_connects';    -- 连接失败次数(排查认证/网络问题)
```

> **`Threads_running` 才是关键指标**,不是 `Threads_connected`。连接池会保持很多空闲连接(connected 高但正常),真正反映压力的是同时在执行的线程数(running)。running 持续 > CPU 核数的数倍,说明有慢 SQL 堆积或锁等待。

### 刷盘与 IO

```ini
innodb_flush_log_at_trx_commit = 1  # 1=最安全,2/0=更快但可能丢数据(见 07 章)
sync_binlog = 1                     # 与上面组成"双 1"
innodb_flush_method = O_DIRECT      # 绕过 OS 缓存,避免双重缓冲(生产推荐)
innodb_io_capacity = 2000           # 告诉 InnoDB 磁盘 IOPS 能力,SSD 设 2000~20000
innodb_io_capacity_max = 4000       # 刷脏页时的最大 IOPS
innodb_read_io_threads = 8          # 后台读 IO 线程
innodb_write_io_threads = 8         # 后台写 IO 线程
innodb_doublewrite = ON             # 双写缓冲,防止部分页写入(page corruption)
```

### 一键查看关键参数是否合理

```sql
-- 检查缓冲池占比
SELECT @@innodb_buffer_pool_size / 1024 / 1024 / 1024 AS pool_gb;

-- 检查连接数配置
SELECT @@max_connections, @@wait_timeout, @@thread_cache_size;

-- 检查双 1
SELECT @@innodb_flush_log_at_trx_commit, @@sync_binlog;

-- 检查字符集
SELECT @@character_set_server, @@collation_server;
```

## 8.7 架构层优化

```text
                        应用
                         │
              ┌──────────┼──────────┐
              ↓          ↓          ↓
          本地缓存    Redis 缓存   直接查库
         (Caffeine)  (分布式)
              │          │          │
              └──────────┼──────────┘
                         ↓
                    ┌─────────┐
                    │  主库(写) │
                    └────┬────┘
                         │ 主从复制
              ┌──────────┼──────────┐
              ↓          ↓          ↓
          从库(读)    从库(读)   从库(报表/备份)
              │
         读写分离中间件
              │
      数据量再大 → 分库分表
```

| 层次 | 手段 | 解决的问题 | 详见 |
| --- | --- | --- | --- |
| **缓存** | Redis / 本地缓存 | 读压力大、热点数据 | [[后端/数据库/Redis/Redis缓存设计]] |
| **读写分离** | 主写从读 | 读多写少,单机读扛不住 | [[后端/数据库/MySQL/分库分表与高可用]] |
| **分库分表** | 水平/垂直拆分 | 单表数据量过大(千万级+) | [[后端/数据库/MySQL/分库分表与高可用]] |
| **冷热分离** | 历史数据归档 | 热表过大 | 本章 8.5 |
| **CDN / 静态化** | 页面缓存 | 内容型网站读压力 | — |
| **搜索引擎** | Elasticsearch | 复杂搜索、全文检索 | [[后端/数据库/Elasticsearch/Elasticsearch入门与安装配置]] |
| **异步化** | 消息队列削峰 | 写压力突增 | — |

> **缓存是读多写少场景性价比最高的优化。** 加一层 Redis 缓存,能把 90% 以上的读请求挡在数据库之前,QPS 提升一个数量级。但缓存引入了数据一致性问题(缓存穿透、击穿、雪崩),需要专门设计。

## 8.8 一个完整的慢 SQL 优化实战

**问题:** 订单列表页加载 5 秒。

```sql
-- 原始 SQL
SELECT * FROM `order`
WHERE DATE(created_at) = '2026-09-06' AND status = 1
ORDER BY amount DESC
LIMIT 20;
```

**第 1 步:EXPLAIN 诊断**

```text
id: 1, select_type: SIMPLE, table: order
type: ALL                      ← 全表扫描!
possible_keys: NULL            ← 没有可用索引
key: NULL
rows: 3000000                  ← 扫描 300 万行
filtered: 5.00
Extra: Using where; Using filesort   ← 还要额外排序
```

**病因分析:**
1. `DATE(created_at)` 对列做函数,即使有 created_at 索引也用不上
2. `SELECT *` 无法覆盖索引
3. `ORDER BY amount` 无索引,filesort
4. status 无索引

**第 2 步:改写 SQL + 建索引**

```sql
-- 改写:函数移到常量侧,改范围查询;只选需要的列
SELECT id, order_no, user_id, amount, created_at
FROM `order`
WHERE created_at >= '2026-09-06 00:00:00'
  AND created_at <  '2026-09-07 00:00:00'
  AND status = 1
ORDER BY amount DESC
LIMIT 20;

-- 建联合索引:等值列(status)+ 范围列(created_at)
ALTER TABLE `order` ADD INDEX idx_status_created (status, created_at);
```

**第 3 步:再次 EXPLAIN**

```text
type: range                    ← 范围扫描(好!)
key: idx_status_created        ← 用上了索引
key_len: 6
rows: 8000                     ← 只扫描 8000 行(从 300 万降到 8000)
Extra: Using index condition; Using filesort   ← 索引下推,但 amount 排序仍需 filesort
```

**第 4 步:如果 filesort 仍是瓶颈**

```sql
-- 如果这个查询极高频,且 status+日期+金额排序是固定模式
-- 可以建 (status, created_at, amount) 但 amount 排序方向与范围列冲突,收益有限
-- 更实际:接受 filesort(8000 行排序很快),或用覆盖索引减少回表
ALTER TABLE `order` ADD INDEX idx_cover (status, created_at, id, order_no, user_id, amount);
-- Extra 变成:Using index(覆盖索引,零回表)
```

**效果:** 5 秒 → 30 毫秒。

> **优化复盘:** 这个案例覆盖了 80% 的慢 SQL 成因 —— 列上做函数导致索引失效、`SELECT *`、缺索引、filesort。排查时按 EXPLAIN 的 type / key / rows / Extra 四列逐一对照即可。

## 8.9 性能监控指标体系

```sql
-- QPS(每秒查询数)与 TPS(每秒事务数)
SHOW GLOBAL STATUS LIKE 'Questions';      -- 累计查询数
SHOW GLOBAL STATUS LIKE 'Com_commit';     -- 累计提交数
SHOW GLOBAL STATUS LIKE 'Com_rollback';   -- 累计回滚数
-- QPS = Questions 增量 / 时间间隔;TPS = (Com_commit + Com_rollback) 增量 / 时间间隔

-- 连接与线程
SHOW GLOBAL STATUS LIKE 'Threads%';
-- Threads_connected 当前连接, Threads_running 当前活跃, Threads_created 累计创建

-- 缓冲池命中率
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_%';

-- InnoDB 行级操作统计
SHOW GLOBAL STATUS LIKE 'Innodb_rows_%';
-- Innodb_rows_read / inserted / updated / deleted

-- 临时表与排序(过多说明 SQL 需优化)
SHOW GLOBAL STATUS LIKE 'Created_tmp_%';   -- Created_tmp_disk_tables 过多 = 内存临时表放不下
SHOW GLOBAL STATUS LIKE 'Sort_%';          -- Sort_merge_passes 过多 = filesort 溢出到磁盘

-- 锁等待
SHOW GLOBAL STATUS LIKE 'Innodb_row_lock%';
-- Innodb_row_lock_waits 锁等待次数, Innodb_row_lock_time_avg 平均等待时间
```

| 指标 | 健康值 | 异常含义 |
| --- | --- | --- |
| 缓冲池命中率 | > 99% | 低说明 buffer pool 太小或有全表扫描 |
| `Threads_running` | < CPU 核数 × 2 | 高说明有慢 SQL 堆积或锁等待 |
| `Created_tmp_disk_tables / Created_tmp_tables` | < 25% | 高说明 tmp_table_size 小或 SQL 需优化 |
| `Sort_merge_passes` | 接近 0 | 高说明 sort_buffer 小或排序数据量大 |
| `Innodb_row_lock_time_avg` | < 100ms | 高说明锁冲突严重 |
| 慢查询数量 | 持续下降 | 上升趋势要专项优化 |

**监控工具:**

| 工具 | 说明 |
| --- | --- |
| **PMM**(Percona Monitoring and Management) | 开源,MySQL 专项监控,图形化慢查询与指标 |
| **Prometheus + mysqld_exporter + Grafana** | 云原生标配,自定义看板与告警 |
| `mysqladmin status` / `mysqladmin extended-status` | 命令行快速查看 |
| `SHOW ENGINE INNODB STATUS\G` | InnoDB 详细状态(死锁、事务、缓冲池) |
| `sys` schema | 8.0 内置的性能诊断视图 |

## 8.10 常见问题与最佳实践

1. **优化顺序:先 SQL 与索引(80% 问题在这),再参数,最后才架构**
2. **慢 SQL 排查靠慢日志 + pt-query-digest + EXPLAIN**,别凭感觉
3. **看 `Rows_examined / Rows_sent` 比值**,远大于 1 就是索引问题
4. **`type=ALL` + `rows` 大 = 必须优化**;目标至少 `range`,力争 `ref`/`const`
5. **联合索引优于多个单列索引**,最左前缀能服务多种查询
6. **消除 filesort/temporary**:让 `WHERE 等值列 + ORDER BY/GROUP BY 列` 组成联合索引
7. **`SELECT *` 是万恶之源**:无法覆盖索引、传输浪费、隐式受表结构变化影响
8. **会话级 buffer 宁小勿大**(sort/join/read buffer),靠索引而非调大内存解决排序
9. **`innodb_buffer_pool_size` 是第一参数**,专用机给物理内存 50%~70%
10. **分批处理大表 DML**,避免长事务、锁等待、主从延迟
11. **监控 `Threads_running` 而非 `Threads_connected`**,前者反映真实压力
12. **架构优化(缓存/读写分离/分库分表)是最后手段**,能不分表就不分

---

## 本章小结

- 优化五层次(收益递减):架构 → SQL/索引 → 表结构 → 参数 → 硬件;80% 问题在 SQL 与索引
- 慢 SQL 五步法:慢日志发现 → EXPLAIN 定位 → 优化索引 → 改写 SQL → 验证
- EXPLAIN 四要素:`type`(至少 range)、`key`(用上索引)、`rows`(扫描少)、`Extra`(无 filesort/temporary)
- 索引优化:联合索引代替单列、覆盖索引免回表、游标分页/延迟关联治深分页、删冗余索引
- SQL 改写:列上不做函数、避免隐式转换、OR 拆 UNION ALL、子查询改 JOIN、EXISTS 替 IN、大事务分批
- 表结构:小类型 + NOT NULL、大字段垂直拆分、冷热分离、分区表按时间归档
- 参数:`innodb_buffer_pool_size` 第一(物理内存 50%~70%),会话级 buffer 宁小勿大,双 1 保安全
- 架构:缓存挡读、读写分离、分库分表、搜索引擎、消息削峰
- 监控核心指标:缓冲池命中率 >99%、`Threads_running`、磁盘临时表比例、锁等待时间
