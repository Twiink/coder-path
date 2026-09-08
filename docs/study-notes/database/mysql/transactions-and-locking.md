---
title: "事务与锁机制"
aliases:
  - "MySQL事务"
  - "MySQL锁"
  - "MVCC"
  - "隔离级别"
tags:
  - "后端"
  - "数据库"
  - "mysql"
  - "事务"
  - "面试"
  - "笔记"
category: "后端"
folder: "MySQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MySQL/索引与执行计划]]"
  - "[[后端/数据库/MySQL/日志与备份恢复]]"
  - "[[后端/数据库/MySQL/SQL基础]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 06 事务与锁机制

事务与锁是 MySQL 的灵魂,也是面试的深水区。本章覆盖:ACID、并发问题、四种隔离级别、MVCC 原理(Read View / undo log 版本链)、锁的分类、行锁的加锁规则、间隙锁与临键锁、死锁排查、事务实战写法。

## 6.1 事务是什么

**事务(Transaction)** 是数据库操作的**最小逻辑单元**,由一条或多条 SQL 组成,要么全部成功,要么全部失败,不允许停在中间状态。

```sql
-- 经典例子:转账
BEGIN;                                          -- 或 START TRANSACTION
UPDATE account SET balance = balance - 100 WHERE id = 1;   -- A 扣 100
UPDATE account SET balance = balance + 100 WHERE id = 2;   -- B 加 100
COMMIT;                                          -- 两条一起生效
-- 若第二条失败:ROLLBACK; 两条都撤销,A 的钱不会凭空消失
```

**事务控制的语句(TCL):**

```sql
START TRANSACTION;         -- 开启(标准)
BEGIN;                     -- 等价,但 BEGIN 在存储过程里是代码块开始,易混淆
COMMIT;                    -- 提交
ROLLBACK;                  -- 回滚到事务开始

SAVEPOINT sp1;             -- 设置保存点
ROLLBACK TO SAVEPOINT sp1; -- 回滚到保存点(事务仍未结束)
RELEASE SAVEPOINT sp1;     -- 删除保存点

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;   -- 设置隔离级别
SET autocommit = 0;        -- 关闭自动提交(此后需显式 COMMIT)
```

> **只有 DML(INSERT/UPDATE/DELETE)能被事务回滚。DDL(CREATE/ALTER/DROP)是隐式提交的**,一执行就自动 commit 前面的事务且无法回滚(8.0 的原子 DDL 只保证单条 DDL 自身不会留半截,不代表能在事务里回滚)。

## 6.2 ACID 四大特性

| 特性 | 含义 | InnoDB 如何实现 |
| --- | --- | --- |
| **A 原子性** Atomicity | 事务内操作不可分割,要么全做要么全不做 | **undo log**(回滚日志):记录反向操作,失败时回滚 |
| **C 一致性** Consistency | 事务前后数据完整性不被破坏(如转账前后总额不变) | 由 A、I、D 共同保证 + 应用层约束 |
| **I 隔离性** Isolation | 并发事务之间互不干扰,未提交的改动对其他事务不可见 | **锁** + **MVCC**(多版本并发控制) |
| **D 持久性** Durability | 事务提交后数据永久保存,宕机也不丢 | **redo log**(重做日志):提交时先写日志再落盘,崩溃后可重放 |

```text
             ┌─────────────────────────────────────┐
             │            一致性 C(目的)          │
             └─────────────────────────────────────┘
                    ↑           ↑           ↑
        ┌───────────┘    ┌──────┘    ┌──────┘
        │                │           │
   原子性 A          隔离性 I     持久性 D
   (undo log)    (锁 + MVCC)    (redo log)
```

> **一致性的层次辨析(高频):**
> - **数据库层面的一致性**:主键唯一、外键有效、CHECK 通过、约束不被破坏
> - **业务层面的一致性**:转账前后总额不变、库存不为负 —— **数据库管不了,必须应用层保证**
>
> 所以"C 由 AID 保证"只在数据库层面成立;业务一致性要靠代码逻辑、事务边界、对账任务。

## 6.3 并发事务的三大问题

```text
事务 A                              事务 B
────────────────────────────────────────────────────────
① 脏读 Dirty Read:读到别人【未提交】的数据
                                    UPDATE balance = 500 (未提交)
SELECT balance → 500  ← 读到了!
                                    ROLLBACK   ← B 回滚了
A 基于 500 做业务 → 数据错误

② 不可重复读 Non-Repeatable Read:同一事务内两次读【同一行】结果不同(别人 UPDATE 了)
SELECT balance → 1000
                                    UPDATE balance = 500; COMMIT;
SELECT balance → 500   ← 同一行,值变了!

③ 幻读 Phantom Read:同一事务内两次读【同一范围】行数不同(别人 INSERT/DELETE 了)
SELECT COUNT(*) WHERE age>20 → 10
                                    INSERT 一条 age=25; COMMIT;
SELECT COUNT(*) WHERE age>20 → 11  ← 多出一行"幻影"!
```

| 问题 | 本质 | 触发操作 | 侧重 |
| --- | --- | --- | --- |
| **脏读** | 读到未提交数据 | UPDATE | 数据**根本不存在**(会回滚) |
| **不可重复读** | 同一行前后值不同 | UPDATE / DELETE | **行内容**变了 |
| **幻读** | 同一范围前后行数不同 | INSERT / DELETE | **行数**变了 |

> **不可重复读 vs 幻读的区别:** 前者针对**同一行的值变化**(UPDATE 导致),后者针对**结果集的行数变化**(INSERT 导致)。加行锁能解决不可重复读,但解决不了幻读(新插入的行不在锁范围内)—— 需要间隙锁或 Serializable。

## 6.4 四种隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 并发性 | 说明 |
| --- | :---: | :---: | :---: | :---: | --- |
| **READ UNCOMMITTED** 读未提交 | ❌ 会 | ❌ 会 | ❌ 会 | 最高 | 几乎不用,能读到未提交数据 |
| **READ COMMITTED** 读已提交(RC) | ✅ 不会 | ❌ 会 | ❌ 会 | 高 | Oracle / PostgreSQL 默认;每次 SELECT 生成新 Read View |
| **REPEATABLE READ** 可重复读(RR) | ✅ 不会 | ✅ 不会 | ⚠️ 大部分解决 | 中 | **MySQL InnoDB 默认**;事务开始时生成 Read View;**用间隙锁解决幻读** |
| **SERIALIZABLE** 串行化 | ✅ 不会 | ✅ 不会 | ✅ 不会 | 最低 | 读加共享锁,完全串行,性能最差 |

```sql
-- 查看当前隔离级别
SELECT @@transaction_isolation;                    -- 8.0
SELECT @@tx_isolation;                             -- 5.7
SHOW VARIABLES LIKE '%isolation%';

-- 设置(三个作用域)
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;   -- 当前连接
SET GLOBAL  TRANSACTION ISOLATION LEVEL REPEATABLE READ;  -- 新连接(重启丢失)
SET PERSIST TRANSACTION ISOLATION LEVEL READ COMMITTED;   -- 持久化(8.0)

-- 只对下一个事务生效
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN; ... COMMIT;
```

### 生产环境如何选隔离级别

| 选择 | 场景 | 理由 |
| --- | --- | --- |
| **RR(默认)** | 大多数互联网业务 | 一致性更强;间隙锁防幻读;binlog 为 STATEMENT 格式时必须 RR |
| **RC** | 高并发写入、大厂普遍调整为此 | **没有间隙锁,锁冲突少、并发高、死锁概率低**;binlog 必须 ROW 格式 |

> **阿里等大厂普遍把隔离级别改成 RC + binlog_format=ROW。** 原因:RR 的间隙锁在高并发下极易造成锁等待和死锁;RC 只锁记录本身,并发好得多。代价是必须用 ROW 格式 binlog(否则主从不一致)。
> **改隔离级别是全局决策**,需要评估所有 SQL 的幂等性与一致性假设,不要随意改。

## 6.5 MVCC 多版本并发控制(核心原理)

MVCC(Multi-Version Concurrency Control)让 InnoDB 实现"**读不加锁,读写不冲突**",这是它高并发的关键。

**核心思想:** 每行数据保留多个历史版本,读操作读取一个"快照",写操作生成新版本。读的是快照,写的是最新值,互不阻塞。

### 三大支撑组件

```text
1. 隐藏列:每行数据都有
   ┌──────────────────────────────────────────────┐
   │ DB_TRX_ID(6B)   最近修改这行的事务 ID         │
   │ DB_ROLL_PTR(7B) 回滚指针,指向 undo log 里的  │
   │                   上一个版本                  │
   │ DB_ROW_ID(6B)   无主键时的隐藏自增 ID         │
   ├──────────────────────────────────────────────┤
   │ 业务列:name, age, balance ...                │
   └──────────────────────────────────────────────┘

2. undo log 版本链:每次修改都生成一个 undo 记录,
   通过 ROLL_PTR 串成一条链
   当前行(trx_id=50) → undo(trx_id=30) → undo(trx_id=10) → ...

3. Read View(读视图/一致性视图):事务做快照读时生成,
   用来判断版本链上哪个版本对当前事务可见
```

### Read View 的四个字段

| 字段 | 含义 |
| --- | --- |
| `m_ids` | 生成 Read View 时**所有活跃(未提交)事务**的 ID 列表 |
| `min_trx_id` | m_ids 中的最小值 |
| `max_trx_id` | 生成 Read View 时系统**将要分配**的下一个事务 ID(即当前最大 ID + 1) |
| `creator_trx_id` | 创建该 Read View 的事务自己的 ID |

### 可见性判断算法(必背)

对版本链上每个版本的 `trx_id`,按顺序判断:

```text
① trx_id == creator_trx_id
   → 【可见】自己改的,当然能看到

② trx_id < min_trx_id
   → 【可见】该版本在 Read View 创建前就已提交

③ trx_id >= max_trx_id
   → 【不可见】该事务在 Read View 创建后才开启

④ min_trx_id <= trx_id < max_trx_id
   → 看 trx_id 是否在 m_ids 里:
      · 在 m_ids 中 → 【不可见】(该事务当时还未提交)
      · 不在 m_ids 中 → 【可见】(该事务当时已提交)

不可见时,顺着 DB_ROLL_PTR 找上一个版本,重复判断
```

```sql
-- 图解示例
-- 时刻 T:事务 100 已提交,事务 101、102 活跃,下一个 ID 是 103
-- Read View: m_ids = [101, 102], min_trx_id = 101, max_trx_id = 103, creator = 105

-- 某行的版本链: 当前版本 trx_id=102 → 旧版本 trx_id=101 → 更旧 trx_id=100
-- 判断:
--   102:在 m_ids 中 → 不可见,继续找
--   101:在 m_ids 中 → 不可见,继续找
--   100:< min_trx_id(101) → 可见!返回这个版本
```

### RC 与 RR 的本质区别:Read View 的生成时机

| 隔离级别 | Read View 生成时机 | 效果 |
| --- | --- | --- |
| **READ COMMITTED** | **每次 SELECT 都重新生成** | 每次读都能看到别人最新提交的数据 → 不可重复读 |
| **REPEATABLE READ** | **事务中第一次 SELECT 时生成,之后一直复用** | 整个事务期间读到的是同一个快照 → 可重复读 |

```sql
-- RR 下的可重复读演示
-- 事务 A                              事务 B
BEGIN;
SELECT balance FROM acc WHERE id=1;   -- 1000,生成 Read View
                                      BEGIN;
                                      UPDATE acc SET balance=500 WHERE id=1;
                                      COMMIT;
SELECT balance FROM acc WHERE id=1;   -- 仍是 1000!(快照读,复用 Read View)
SELECT balance FROM acc WHERE id=1
       FOR UPDATE;                     -- 500!(当前读,读最新已提交)
COMMIT;
```

### 快照读 vs 当前读

| | 快照读(Snapshot Read) | 当前读(Current Read) |
| --- | --- | --- |
| 语句 | 普通 `SELECT` | `SELECT ... FOR UPDATE`、`SELECT ... LOCK IN SHARE MODE`(8.0 写作 `FOR SHARE`)、`INSERT`、`UPDATE`、`DELETE` |
| 读什么 | MVCC 生成的历史快照 | **最新已提交(含自己未提交)的数据** |
| 加锁吗 | **不加锁** | **加锁**(记录锁 / 间隙锁 / 临键锁) |
| 会幻读吗 | RR 下不会(快照一致) | 靠间隙锁防止 |

> **这是理解"RR 到底有没有幻读"的关键:**
> - **快照读层面**:RR 通过 MVCC 完全避免了幻读(整个事务读同一个快照)
> - **当前读层面**:RR 通过 **Next-Key Lock(临键锁 = 记录锁 + 间隙锁)** 阻止其他事务在范围内插入,也避免了幻读
> - **但混用会出问题**:先快照读、再当前读(或先 UPDATE 再 SELECT),可能看到"幻影行"。所以严谨说法是 **RR 在大多数情况下解决了幻读,但不是 100%**

```sql
-- 混用导致的幻读案例(RR 下)
-- 事务 A                                    事务 B
BEGIN;
SELECT * FROM t WHERE id > 10;              -- 快照读,返回 0 行
                                             BEGIN;
                                             INSERT INTO t VALUES (15, 'x');
                                             COMMIT;
UPDATE t SET name = 'y' WHERE id = 15;      -- 当前读,居然改成功了!(affected 1)
SELECT * FROM t WHERE id > 10;              -- 现在返回 1 行!幻影出现
COMMIT;
```

### undo log 与 purge

MVCC 的历史版本存在 undo log 里,不能无限增长。InnoDB 的 **purge 线程**会在确认没有任何 Read View 还需要某版本后,把它删除。

> **长事务的危害(MVCC 视角):** 一个开着不提交的事务,它的 Read View 一直存在,导致**所有比它新的 undo 版本都无法被 purge**,undo 表空间持续膨胀,查询版本链变长(要跳过大量不可见版本),性能急剧下降。
> ```sql
> -- 查找长事务
> SELECT trx_id, trx_state, trx_started,
>        TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS duration_sec,
>        trx_mysql_thread_id, trx_query
> FROM information_schema.INNODB_TRX
> WHERE TIMESTAMPDIFF(SECOND, trx_started, NOW()) > 60
> ORDER BY trx_started;
> ```

## 6.6 锁的分类

### 按粒度

| 粒度 | 说明 | 引擎 |
| --- | --- | --- |
| **全局锁** | `FLUSH TABLES WITH READ LOCK`(FTWRL),整个库只读 | 全引擎,用于**全库逻辑备份** |
| **表级锁** | 表锁、元数据锁 MDL、意向锁、AUTO-INC 锁 | MyISAM 只有表锁;InnoDB 也有 |
| **行级锁** | 记录锁、间隙锁、临键锁、插入意向锁 | **仅 InnoDB** |

### 按模式

| 模式 | 简称 | 说明 | 语句 |
| --- | --- | --- | --- |
| **共享锁** Shared Lock | S 锁 / 读锁 | 多个事务可同时持有,互相不阻塞 | `SELECT ... LOCK IN SHARE MODE` / `FOR SHARE`(8.0) |
| **排他锁** Exclusive Lock | X 锁 / 写锁 | 独占,与任何锁都冲突 | `SELECT ... FOR UPDATE`、`UPDATE`、`DELETE`、`INSERT` |

**锁兼容矩阵(行锁):**

| 已持有 ↓ / 请求 → | S 锁 | X 锁 |
| --- | :---: | :---: |
| **S 锁** | ✅ 兼容 | ❌ 冲突 |
| **X 锁** | ❌ 冲突 | ❌ 冲突 |

### 意向锁(Intention Lock,表级)

**为什么需要意向锁?** 当事务 A 要给某行加 S/X 锁时,事务 B 想给整张表加表锁 —— B 需要知道"表里有没有行已经被锁了"。如果 B 必须逐行检查,效率极低。

**解决方案:** A 在给行加锁**之前**,先在表上加一个"意向锁"作为标记。B 只需检查表上有没有意向锁即可。

| 意向锁 | 含义 |
| --- | --- |
| **IS**(Intention Shared) | 事务打算给表中某些行加 S 锁 |
| **IX**(Intention Exclusive) | 事务打算给表中某些行加 X 锁 |

**关键点:意向锁之间互相兼容,且与表级 S/X 锁冲突判断:**

| | IS | IX | 表 S | 表 X |
| --- | :---: | :---: | :---: | :---: |
| **IS** | ✅ | ✅ | ✅ | ❌ |
| **IX** | ✅ | ✅ | ❌ | ❌ |
| **表 S** | ✅ | ❌ | ✅ | ❌ |
| **表 X** | ❌ | ❌ | ❌ | ❌ |

> 意向锁是 InnoDB **自动加的**,不需要用户干预。它的存在让"表锁与行锁的冲突检测"变成 O(1)。

### 元数据锁 MDL(Metadata Lock)

```sql
-- MDL 保证:一个事务在读写表时,别人不能改表结构

-- 事务 A:SELECT * FROM t;  (自动加 MDL 读锁,事务结束才释放)
-- 事务 B:ALTER TABLE t ADD COLUMN c INT;   ← 阻塞!等 A 的 MDL 读锁释放
```

| MDL 类型 | 何时加 | 兼容性 |
| --- | --- | --- |
| MDL 读锁 | `SELECT`/`INSERT`/`UPDATE`/`DELETE` 时自动加 | 读读兼容,读写互斥 |
| MDL 写锁 | `ALTER TABLE`/`DROP`/`RENAME` 时加 | 与一切互斥 |

> **经典线上事故:** 一个长事务忘了提交(持有 MDL 读锁),此时执行 `ALTER TABLE`,ALTER 拿不到写锁被阻塞;而**后续所有对该表的查询也都被 ALTER 的写锁请求阻塞**(锁队列公平性),整张表瞬间不可用,业务雪崩。
> **防范:**
> 1. ALTER 前检查有无长事务:`SELECT * FROM information_schema.INNODB_TRX`
> 2. ALTER 加超时:`ALTER TABLE t ADD COLUMN c INT, LOCK_WAIT_TIMEOUT = 5;` 拿不到锁快速失败,不阻塞后续
> 3. 大表 DDL 用 gh-ost / pt-online-schema-change

### AUTO-INC 锁

```sql
-- 自增列的分配需要特殊处理,保证同一事务内批量插入得到的 ID 是连续的
INSERT INTO t (name) VALUES ('a'),('b'),('c');   -- 分配 1,2,3

-- innodb_autoinc_lock_mode 三种模式
-- 0:传统模式,语句执行完才释放 AUTO-INC 锁(并发差)
-- 1:连续模式(5.7 默认),简单插入用轻量互斥量,批量插入用 AUTO-INC 锁
-- 2:交错模式(8.0 默认),全部用轻量互斥量,并发最好,但批量插入的 ID 可能不连续
```

> `innodb_autoinc_lock_mode = 2` 时,`INSERT ... SELECT` 得到的自增 ID 可能不连续,且在 STATEMENT binlog 下会导致主从不一致 —— 所以模式 2 必须配 **ROW 格式 binlog**。

## 6.7 InnoDB 行锁的三种形态

```text
假设有索引记录:  ... 10 ... 20 ... 30 ...
                     ↑     ↑     ↑

① Record Lock(记录锁):锁住单条索引记录
   锁 20 这一行 → 别的事务不能改/删 id=20

② Gap Lock(间隙锁):锁住两条记录之间的【开区间】,不锁记录本身
   锁 (10, 20) → 别的事务不能往 11~19 之间插入
   目的:防止幻读

③ Next-Key Lock(临键锁)= Record Lock + Gap Lock,锁【左开右闭区间】
   锁 (10, 20] → 既不能插入 11~19,也不能改 id=20
   这是 RR 下的【默认加锁单位】

④ Insert Intention Lock(插入意向锁):INSERT 前加的特殊间隙锁
   多个事务往同一间隙的不同位置插入时互不阻塞(提高并发)
```

```sql
-- 表 t,id 为主键,现有数据 id = 10, 20, 30

-- RR 隔离级别下:
SELECT * FROM t WHERE id = 20 FOR UPDATE;
-- 加 Next-Key Lock (10, 20],并退化为 Record Lock(唯一索引等值命中)

SELECT * FROM t WHERE id = 25 FOR UPDATE;
-- id=25 不存在,加 Gap Lock (20, 30)  ← 阻止插入 21~29

SELECT * FROM t WHERE id > 15 AND id < 28 FOR UPDATE;
-- 加 Next-Key Lock (10,20] + (20,30]

SELECT * FROM t WHERE id >= 20 FOR UPDATE;
-- 加 Next-Key Lock 到 supremum(伪记录,代表"最大值之后的间隙")

-- RC 隔离级别下:没有 Gap Lock,只有 Record Lock
SELECT * FROM t WHERE id = 25 FOR UPDATE;   -- RC 下不加任何锁(记录不存在)
```

### 加锁规则(RR 级别,简化版)

1. **加锁的基本单位是 Next-Key Lock**(左开右闭区间)
2. **只有访问到的对象才会加锁**(不扫到的行不加锁)
3. **唯一索引上的等值查询,命中记录时,Next-Key Lock 退化为 Record Lock**(只锁那一行)
4. **等值查询向右遍历时,最后一个不满足条件的 Next-Key Lock 退化为 Gap Lock**
5. **非唯一索引上的等值查询,会锁住所有匹配的行 + 后面的间隙**(因为可能有重复值)

```sql
-- 非唯一索引的加锁更"重"
-- 表 t2(id PK, age INT 有普通索引 idx_age),数据 age = 10, 20, 20, 30

SELECT * FROM t2 WHERE age = 20 FOR UPDATE;
-- 锁住:两条 age=20 的记录 + 间隙 (10,20] 和 (20,30)
-- 因为非唯一索引无法确定 20 是不是最后一条,必须锁住右边的间隙防止再插入 20

-- 这就是"为什么唯一索引的并发性能更好"的原因之一
```

### 行锁锁的是索引,不是行!(极重要的认知)

```sql
-- 表 user(id PK, name VARCHAR(50) 无索引, age INT 无索引)

UPDATE user SET age = 30 WHERE name = 'Tom';
-- ❌ name 上没有索引 → InnoDB 无法定位到具体行
-- → 扫描全表,给【所有行】加 X 锁 + 所有间隙加 Gap Lock
-- → 等价于锁表!其他任何 UPDATE/DELETE 都被阻塞

-- ✅ 解决:给 name 建索引
ALTER TABLE user ADD INDEX idx_name (name);
UPDATE user SET age = 30 WHERE name = 'Tom';
-- 只锁 name='Tom' 的行
```

> **这是最常见的生产事故之一:** WHERE 条件列没有索引(或索引失效,见 [[后端/数据库/MySQL/索引与执行计划]]),UPDATE/DELETE 会退化成锁全表,瞬间把并发打死。
> **纪律:** 任何 UPDATE/DELETE 的 WHERE 列都必须有可用索引;执行前用 `EXPLAIN` 确认 `type` 不是 `ALL`。

## 6.8 锁等待与死锁

### 阻塞(锁等待)

**定义:** 由于锁的不兼容,一个事务需要等待另一个事务释放资源。

```sql
-- 查看锁等待(8.0,sys 库,最直观)
SELECT
    waiting_pid              AS '被阻塞的线程',
    waiting_query            AS '被阻塞的SQL',
    blocking_pid             AS '阻塞源线程',
    blocking_query           AS '阻塞源SQL',
    wait_age                 AS '已等待时间',
    sql_kill_blocking_query  AS '建议操作'
FROM sys.innodb_lock_waits
WHERE (UNIX_TIMESTAMP() - UNIX_TIMESTAMP(wait_started)) > 10;

-- 8.0 的 performance_schema 视图
SELECT * FROM performance_schema.data_lock_waits;
SELECT * FROM performance_schema.data_locks;

-- 5.7 用 information_schema(8.0 已移除这些表)
SELECT * FROM information_schema.INNODB_LOCK_WAITS;
SELECT * FROM information_schema.INNODB_LOCKS;

-- 相关参数
SHOW VARIABLES LIKE 'innodb_lock_wait_timeout';   -- 默认 50 秒,超时报错回滚
SET SESSION innodb_lock_wait_timeout = 10;        -- 快速失败,避免请求堆积

-- 杀掉阻塞源(谨慎,会回滚该事务)
KILL 阻塞源线程ID;
```

```sql
-- 报错样例
-- ERROR 1205 (HY000): Lock wait timeout exceeded; try restarting transaction
```

### 死锁

**定义:** 两个或多个事务**互相持有对方需要的锁并等待对方释放**,形成循环等待,谁也无法推进。

```sql
-- 经典死锁场景
-- 事务 A                                事务 B
BEGIN;                                 BEGIN;
UPDATE acc SET b=b-100 WHERE id=1;     UPDATE acc SET b=b-100 WHERE id=2;
  → 持有 id=1 的 X 锁                     → 持有 id=2 的 X 锁
UPDATE acc SET b=b+100 WHERE id=2;     UPDATE acc SET b=b+100 WHERE id=1;
  → 等待 id=2 的锁 ────────────────┐      → 等待 id=1 的锁 ────┐
                                    └──── 循环等待!死锁 ──────┘
```

**死锁的四个必要条件(操作系统理论):**

1. **互斥**:资源同时只能被一个事务占用
2. **持有并等待**:持有资源的同时又请求新资源
3. **不可剥夺**:资源只能由持有者主动释放
4. **循环等待**:形成事务→资源→事务的环形链

**InnoDB 的死锁处理:**

```sql
-- InnoDB 有死锁检测机制,发现死锁后【自动回滚代价最小的事务】(通常是改动行数少的)
SHOW VARIABLES LIKE 'innodb_deadlock_detect';   -- 默认 ON
SHOW VARIABLES LIKE 'innodb_print_all_deadlocks';  -- 默认 OFF

-- 开启后所有死锁都记录到 error log(排查必备)
SET GLOBAL innodb_print_all_deadlocks = ON;

-- 查看最近一次死锁的详情
SHOW ENGINE INNODB STATUS\G
-- 输出中的 LATEST DETECTED DEADLOCK 段落:
-- *** (1) TRANSACTION: 事务 1 的 SQL
-- *** (1) HOLDS THE LOCK(S): 事务 1 持有的锁
-- *** (1) WAITING FOR THIS LOCK TO BE GRANTED: 事务 1 等待的锁
-- *** (2) TRANSACTION / HOLDS / WAITING: 事务 2 同上
-- *** WE ROLL BACK TRANSACTION (1): 回滚了事务 1
```

**死锁的预防策略:**

| 策略 | 做法 |
| --- | --- |
| **固定加锁顺序**(最有效) | 所有业务按同一顺序访问资源(如按 id 升序更新),破坏"循环等待" |
| **缩短事务** | 事务内不做 RPC、不查外部接口、不做复杂计算;先算好再开事务 |
| **一次锁定所有资源** | `SELECT ... FOR UPDATE` 一次性锁住所有需要的行,破坏"持有并等待" |
| **降低隔离级别** | RC 没有间隙锁,死锁概率显著降低 |
| **用唯一索引** | 避免非唯一索引的大范围间隙锁 |
| **控制批量大小** | 大批量 UPDATE 分批,每批几百行 |
| **加超时** | `innodb_lock_wait_timeout` 调小,快速失败 + 应用层重试 |

```sql
-- 固定顺序示例:转账时永远先锁 id 小的账户
BEGIN;
SELECT * FROM acc WHERE id IN (1, 2) ORDER BY id FOR UPDATE;   -- 统一按 id 升序锁
UPDATE acc SET balance = balance - 100 WHERE id = 1;
UPDATE acc SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

```python
# 应用层:死锁重试(死锁无法完全避免,必须能重试)
import time
from sqlalchemy.exc import OperationalError

def execute_with_retry(session, func, max_retries=3):
    for attempt in range(max_retries):
        try:
            result = func(session)
            session.commit()
            return result
        except OperationalError as e:
            session.rollback()
            # MySQL 死锁错误码 1213,锁等待超时 1205
            if e.orig.args[0] == 1213 and attempt < max_retries - 1:
                time.sleep(0.1 * (2 ** attempt))     # 指数退避
                continue
            raise
```

### 乐观锁与悲观锁

| | 悲观锁 | 乐观锁 |
| --- | --- | --- |
| 假设 | 冲突很可能发生,先加锁再操作 | 冲突很少发生,提交时才检查 |
| 实现 | `SELECT ... FOR UPDATE`、`UPDATE`(InnoDB 自动加 X 锁) | **版本号** `version` 或 **CAS** 条件更新 |
| 数据库层面 | 依赖行锁,阻塞其他事务 | 不加锁,靠 WHERE 条件 + 影响行数判断 |
| 适用 | 写冲突频繁、临界区长(如秒杀扣库存) | 读多写少、冲突少(如后台配置修改) |
| 代价 | 锁等待、死锁风险、吞吐下降 | 冲突时要重试,重试风暴风险 |

```sql
-- 悲观锁:先锁住再改
BEGIN;
SELECT stock FROM product WHERE id = 1 FOR UPDATE;   -- 加 X 锁,其他事务阻塞
-- 应用层判断 stock >= 1
UPDATE product SET stock = stock - 1 WHERE id = 1;
COMMIT;

-- 乐观锁方案一:版本号
ALTER TABLE product ADD COLUMN version INT NOT NULL DEFAULT 0;
-- 读取时记下 version
SELECT id, stock, version FROM product WHERE id = 1;   -- 假设 version = 5
-- 更新时带上 version 条件
UPDATE product SET stock = stock - 1, version = version + 1
WHERE id = 1 AND version = 5;
-- 影响行数 = 0 → 说明被别人改过,需要重读重试

-- 乐观锁方案二:直接条件更新(CAS,无需额外列,最简单)
UPDATE product SET stock = stock - 1
WHERE id = 1 AND stock >= 1;      -- 影响行数 = 0 说明库存不足
-- 这条 SQL 本身就是原子的,InnoDB 会加行锁,天然防超卖

-- 乐观锁方案三:用时间戳
UPDATE config SET value = 'x', updated_at = NOW()
WHERE id = 1 AND updated_at = '2026-09-06 10:00:00';
```

> **防超卖的最佳实践:** 高并发秒杀用 `UPDATE ... SET stock = stock - 1 WHERE id = ? AND stock >= 1`,判断影响行数 —— 一条原子 SQL 搞定,不需要先 SELECT。或者把库存放 Redis 用 Lua 脚本原子扣减,异步落库(见 [[后端/数据库/Redis/Redis应用场景与实战]])。

## 6.9 事务实战写法

### 转账的完整实现

```python
# Django
from django.db import transaction
from decimal import Decimal

class InsufficientBalance(Exception):
    pass

@transaction.atomic
def transfer(from_id: int, to_id: int, amount: Decimal):
    if amount <= 0:
        raise ValueError("金额必须为正")

    # 关键 1:按 id 升序加锁,避免死锁
    ids = sorted([from_id, to_id])
    accounts = {a.id: a for a in
        Account.objects.select_for_update().filter(id__in=ids)}   # SELECT ... FOR UPDATE

    src, dst = accounts[from_id], accounts[to_id]

    # 关键 2:业务校验
    if src.balance < amount:
        raise InsufficientBalance("余额不足")

    # 关键 3:用 F 表达式原子更新,避免读-改-写的并发覆盖
    Account.objects.filter(id=from_id).update(balance=F('balance') - amount)
    Account.objects.filter(id=to_id).update(balance=F('balance') + amount)

    # 关键 4:写流水,便于对账
    TransferLog.objects.create(from_id=from_id, to_id=to_id, amount=amount)
    # 函数正常返回 → 自动 COMMIT;抛异常 → 自动 ROLLBACK
```

```python
# SQLAlchemy 2.0(异步)
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

async def transfer(session: AsyncSession, from_id: int, to_id: int, amount: Decimal):
    async with session.begin():                     # 事务上下文,异常自动回滚
        ids = sorted([from_id, to_id])
        stmt = (select(Account)
                .where(Account.id.in_(ids))
                .with_for_update())                 # SELECT ... FOR UPDATE
        accounts = {a.id: a for a in (await session.execute(stmt)).scalars()}

        src = accounts[from_id]
        if src.balance < amount:
            raise InsufficientBalance("余额不足")

        await session.execute(
            update(Account).where(Account.id == from_id)
            .values(balance=Account.balance - amount))
        await session.execute(
            update(Account).where(Account.id == to_id)
            .values(balance=Account.balance + amount))
```

### 事务使用的纪律

| 纪律 | 原因 |
| --- | --- |
| **事务尽可能短** | 长事务持有锁久、阻塞他人、undo 无法 purge、主从延迟 |
| **事务内禁止 RPC / HTTP 调用 / 发消息** | 外部调用可能耗时数秒甚至超时,期间一直持锁 |
| **事务内禁止大循环、批量计算** | 先算好结果,再开事务只做写入 |
| **交互式事务不要开着不提交** | 客户端 `BEGIN` 后去吃饭,MDL 锁与 undo 一直不释放 |
| **需要锁行就用 `select_for_update()`** | "查-算-写"不加锁必然并发覆盖(超卖 bug) |
| **多行加锁要固定顺序** | 按主键升序,避免死锁 |
| **要有死锁重试机制** | 死锁无法完全避免,重试是标配 |
| **`autocommit=1` + 显式事务**,不要全局关 autocommit | 忘记 COMMIT 会造成长事务 |
| **只读查询不要包在写事务里** | 无谓地持有资源;8.0 可用 `START TRANSACTION READ ONLY` |

```sql
-- 只读事务(优化器可做额外优化,且不分配 trx_id)
START TRANSACTION READ ONLY;
SELECT ...;
COMMIT;

-- 8.0:限制事务的最长执行时间(毫秒),超时自动回滚
SET SESSION max_execution_time = 5000;      -- 只对 SELECT 生效
SELECT /*+ MAX_EXECUTION_TIME(3000) */ * FROM big_table;
```

## 6.10 常见问题与最佳实践

1. **UPDATE/DELETE 的 WHERE 列必须有索引**,否则行锁退化为锁全表
2. **事务要短**:不要在事务里发 HTTP 请求、发消息、做大循环
3. **多行加锁固定顺序**(按 id 升序),这是防死锁最有效的手段
4. **开启 `innodb_print_all_deadlocks`**,死锁全进 error log,否则只能看到最后一次
5. **`innodb_lock_wait_timeout` 调小**(如 5~10 秒),快速失败 + 应用重试,避免请求堆积
6. **应用层必须有死锁重试**(错误码 1213),指数退避
7. **防超卖用原子条件更新** `UPDATE ... WHERE stock >= n`,不要"先查再改"
8. **长事务监控**:`information_schema.INNODB_TRX` 里 `trx_started` 超过 60 秒的要告警
9. **ALTER TABLE 前先查长事务**,并加 `LOCK_WAIT_TIMEOUT`,防止 MDL 锁引发雪崩
10. **隔离级别选 RR(默认)或 RC(高并发 + ROW binlog)**,不要用 READ UNCOMMITTED
11. **RR 不是完全没有幻读**:快照读与当前读混用时仍可能出现,严谨业务用 `FOR UPDATE`
12. **业务一致性数据库管不了**:总额守恒、状态机合法等必须应用层保证 + 对账任务兜底

---

## 本章小结

- 事务是数据库操作的最小逻辑单元,只有 DML 可回滚,DDL 隐式提交
- **ACID**:原子性靠 undo log、持久性靠 redo log、隔离性靠锁 + MVCC、一致性是目的(业务一致性需应用层保证)
- 并发三问题:脏读(读未提交)、不可重复读(同行值变)、幻读(行数变)
- 四种隔离级别:RU / RC / **RR(MySQL 默认)** / SERIALIZABLE;大厂常改 RC + ROW binlog 换并发
- **MVCC 三件套**:隐藏列(DB_TRX_ID / DB_ROLL_PTR)、undo log 版本链、Read View(m_ids / min / max / creator)
- **RC 每次 SELECT 生成新 Read View,RR 只在第一次 SELECT 生成并复用** —— 这是两者唯一的本质区别
- 快照读(普通 SELECT)不加锁走 MVCC;当前读(FOR UPDATE / UPDATE / DELETE)加锁读最新值
- 锁的粒度:全局锁(FTWRL 备份)、表锁(MDL / 意向锁 / AUTO-INC)、行锁(仅 InnoDB)
- 行锁三形态:**Record Lock**(锁记录)、**Gap Lock**(锁间隙防插入)、**Next-Key Lock**(左开右闭,RR 默认单位)
- **行锁锁的是索引**,WHERE 列无索引会锁全表 —— 最常见的生产事故
- 死锁四条件:互斥、持有并等待、不可剥夺、循环等待;InnoDB 自动检测并回滚代价小的事务
- 防死锁:固定加锁顺序 + 短事务 + 降低隔离级别 + 应用层重试
- 悲观锁 `FOR UPDATE` vs 乐观锁 `version` / CAS 条件更新;高并发扣减用原子条件更新
