---
title: "SQL基础"
aliases:
  - "MySQL SQL语法"
  - "常用SQL命令"
tags:
  - "后端"
  - "数据库"
  - "mysql"
  - "sql"
  - "笔记"
category: "后端"
folder: "MySQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MySQL/数据类型与表设计]]"
  - "[[后端/数据库/MySQL/高级查询与函数]]"
  - "[[后端/数据库/MySQL/索引与执行计划]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 03 SQL 基础

SQL(Structured Query Language)是操作关系型数据库的标准语言,分为四大类。本章覆盖:SQL 分类、SELECT 执行顺序、DML 增删改、各类 JOIN、分组聚合、子查询、UNION,以及 SQL 注入防护。

## 3.1 SQL 的四大分类

| 分类 | 全称 | 作用 | 代表语句 |
| --- | --- | --- | --- |
| **DDL** | Data Definition Language 数据定义 | 定义/修改库表结构 | `CREATE`、`ALTER`、`DROP`、`TRUNCATE`、`RENAME` |
| **DML** | Data Manipulation Language 数据操作 | 增删改数据 | `INSERT`、`UPDATE`、`DELETE` |
| **DQL** | Data Query Language 数据查询 | 查询数据(常并入 DML) | `SELECT` |
| **DCL** | Data Control Language 数据控制 | 用户与权限 | `GRANT`、`REVOKE`、`CREATE USER` |
| **TCL** | Transaction Control Language 事务控制 | 事务管理 | `BEGIN`、`COMMIT`、`ROLLBACK`、`SAVEPOINT` |

**自动提交:** MySQL 默认 `autocommit = 1`,每条 DML 执行后立即提交。

```sql
SHOW VARIABLES LIKE 'autocommit';
SET autocommit = 0;                 -- 关闭后需手动 COMMIT(容易忘,一般用显式事务代替)
```

## 3.2 SELECT 的执行顺序(理解 SQL 的钥匙)

书写顺序 ≠ 执行顺序,这是很多"为什么这里不能用别名"疑问的根源:

```text
书写顺序:  SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT

执行顺序:
  1. FROM / JOIN      确定数据源,做表连接,产生笛卡尔积中间表
  2. ON               连接条件过滤(在生成临时表时生效)
  3. WHERE            对中间表逐行过滤(此处不能用聚合函数、不能用 SELECT 别名)
  4. GROUP BY         分组
  5. HAVING           对分组结果过滤(可用聚合函数)
  6. SELECT           计算表达式、选择列(此处才产生别名)
  7. DISTINCT         去重
  8. ORDER BY         排序(可用 SELECT 别名,因为已执行完)
  9. LIMIT            截取分页
```

```sql
-- ❌ WHERE 里不能用 SELECT 定义的别名(执行时别名还不存在)
SELECT price * qty AS total FROM order WHERE total > 100;
-- ERROR 1054: Unknown column 'total' in 'where clause'

-- ✅ 重复表达式,或用 HAVING(MySQL 扩展,标准 SQL 不允许)
SELECT price * qty AS total FROM order WHERE price * qty > 100;
SELECT price * qty AS total FROM order HAVING total > 100;

-- ✅ ORDER BY 可以用别名
SELECT price * qty AS total FROM order ORDER BY total DESC;

-- ❌ WHERE 里不能用聚合函数
SELECT user_id FROM order WHERE COUNT(*) > 3 GROUP BY user_id;
-- ✅ 用 HAVING
SELECT user_id FROM order GROUP BY user_id HAVING COUNT(*) > 3;
```

## 3.3 WHERE 条件与运算符

### 比较运算符

| 运算符 | 含义 | 示例 |
| --- | --- | --- |
| `=` | 等于 | `WHERE id = 1` |
| `<>` 或 `!=` | 不等于 | `WHERE status != 0` |
| `>` `<` `>=` `<=` | 大小比较 | `WHERE age >= 18` |
| `<=>` | **NULL 安全等于** | `WHERE a <=> b`(两个 NULL 返回 true) |
| `BETWEEN a AND b` | 闭区间 | `WHERE price BETWEEN 10 AND 50` |
| `IN (...)` | 在集合中 | `WHERE id IN (1,2,3)` |
| `NOT IN (...)` | 不在集合中 | `WHERE id NOT IN (1,2)` |
| `LIKE` | 模糊匹配 | `WHERE name LIKE '张%'` |
| `IS NULL` / `IS NOT NULL` | 空值判断 | `WHERE deleted_at IS NULL` |

```sql
-- LIKE 通配符:% 任意多个字符,_ 恰好一个字符
SELECT * FROM user WHERE username LIKE 'a%';      -- 以 a 开头(可用索引)
SELECT * FROM user WHERE username LIKE '%a';      -- 以 a 结尾(索引失效,全表扫)
SELECT * FROM user WHERE username LIKE '%a%';     -- 包含 a(索引失效)
SELECT * FROM user WHERE username LIKE '_a%';     -- 第二个字符是 a

-- 转义通配符本身
SELECT * FROM t WHERE path LIKE '100\%%';                  -- 匹配以 "100%" 开头
SELECT * FROM t WHERE path LIKE '100!%%' ESCAPE '!';       -- 自定义转义符

-- NULL 的判断只能用 IS NULL,不能用 = NULL
SELECT * FROM user WHERE phone IS NULL;         -- ✅
SELECT * FROM user WHERE phone = NULL;          -- ❌ 永远返回空结果集
```

> **NULL 的三大坑:**
> 1. 任何运算符与 NULL 运算结果都是 NULL:`NULL + 1 = NULL`,`NULL = NULL` 结果是 NULL(不是 true)
> 2. `WHERE col != 'x'` **不会**返回 col 为 NULL 的行
> 3. `NOT IN (子查询)` 若子查询结果含 NULL,**整个查询返回空集**(因为 `x != NULL` 是 NULL,不是 true)
>
> ```sql
> SELECT * FROM a WHERE id NOT IN (SELECT a_id FROM b);   -- b 表 a_id 有 NULL 时结果为空!
> SELECT * FROM a WHERE id NOT IN (SELECT a_id FROM b WHERE a_id IS NOT NULL);   -- ✅
> SELECT * FROM a LEFT JOIN b ON a.id = b.a_id WHERE b.a_id IS NULL;             -- ✅ 推荐
> ```

### 逻辑运算符

| 运算符 | 含义 | 说明 |
| --- | --- | --- |
| `AND` / `&&` | 与 | 两边都真才真 |
| `OR` / `\|\|` | 或 | 一边真即真 |
| `NOT` / `!` | 非 | 取反 |
| `XOR` | 异或 | 一真一假才真 |

```sql
SELECT * FROM user WHERE status = 1 AND age >= 18;
SELECT * FROM user WHERE city = '北京' OR city = '上海';
SELECT * FROM user WHERE city IN ('北京','上海');          -- 等价,更清晰
SELECT * FROM user WHERE NOT (age < 18);
SELECT * FROM t WHERE (a = 1) XOR (b = 1);

-- AND 优先级高于 OR,混用必须加括号
SELECT * FROM user WHERE status = 1 AND (city = '北京' OR city = '上海');
```

### ON、WHERE、HAVING 的区别(高频考点)

| | ON | WHERE | HAVING |
| --- | --- | --- | --- |
| 作用时机 | **连接时**,生成临时表之前过滤 | 临时表生成**之后**逐行过滤 | 分组聚合**之后**过滤分组 |
| 出现位置 | JOIN 语句 | 任何查询 | 只能跟在 GROUP BY 后 |
| 能用聚合函数 | ❌ | ❌ | ✅ |
| 性能 | 最早生效,中间表最小 | 次之 | 最后,处理的数据最少但已算过聚合 |

```sql
-- LEFT JOIN 中 ON 与 WHERE 的关键差异
SELECT a.id, b.name
FROM user a LEFT JOIN order b ON b.user_id = a.id AND b.status = 1;
-- 结果:所有用户都在,status != 1 的订单列显示 NULL

SELECT a.id, b.name
FROM user a LEFT JOIN order b ON b.user_id = a.id
WHERE b.status = 1;
-- 结果:只剩有 status=1 订单的用户 → LEFT JOIN 退化成 INNER JOIN!
```

> **记忆法:** 想保留左表全部行,右表的过滤条件写在 `ON` 里;想过滤最终结果,写在 `WHERE` 里。
> 速度上 `ON` 优于 `WHERE`(作用早,中间表小),`WHERE` 优于 `HAVING`(聚合前过滤数据少)。

## 3.4 DML:插入数据

```sql
-- 1. 指定列插入(推荐:列顺序变化不受影响)
INSERT INTO user (username, email, password) VALUES ('alice', 'a@x.com', 'hash1');

-- 2. 全列插入(必须按表结构顺序,脆弱,不推荐)
INSERT INTO user VALUES (NULL, 'bob', 'b@x.com', 'hash2', 1, NOW(), NOW());

-- 3. 批量插入(一条语句多行,性能远好于循环单条)
INSERT INTO user (username, email) VALUES
    ('c1', 'c1@x.com'),
    ('c2', 'c2@x.com'),
    ('c3', 'c3@x.com');

-- 4. 从查询结果插入
INSERT INTO user_backup (id, username) SELECT id, username FROM user WHERE status = 0;
INSERT INTO archive_log SELECT * FROM log WHERE created_at < '2025-01-01';

-- 5. 插入或更新(唯一键/主键冲突时转为 UPDATE)
INSERT INTO stat (user_id, login_count, last_login)
VALUES (1, 1, NOW())
ON DUPLICATE KEY UPDATE login_count = login_count + 1, last_login = NOW();

-- 6. 插入或忽略(冲突时什么都不做)
INSERT IGNORE INTO tag (name) VALUES ('java'), ('mysql');

-- 7. 替换(冲突时先 DELETE 再 INSERT,自增 id 会变!慎用)
REPLACE INTO tag (id, name) VALUES (1, 'golang');

-- 8. 批量插入时指定数量限制
INSERT INTO user (username) SELECT name FROM tmp LIMIT 1000;
```

**`ON DUPLICATE KEY UPDATE` vs `REPLACE INTO` vs `INSERT IGNORE`:**

| 语句 | 冲突时行为 | 自增 ID | 触发 DELETE 触发器 | 使用建议 |
| --- | --- | --- | --- | --- |
| `INSERT IGNORE` | 忽略本次插入,warning 不报错 | 不变 | 否 | 幂等写入、去重导入 |
| `ON DUPLICATE KEY UPDATE` | 执行 UPDATE 子句 | 不变 | 否 | **首选**,upsert 语义清晰 |
| `REPLACE INTO` | DELETE 旧行 + INSERT 新行 | **变** | **是** | 尽量避免:会级联删子表数据、丢未指定列的值 |

```sql
-- INSERT IGNORE 会静默忽略的不只是唯一键冲突,还有类型转换失败等,注意查看 warning
INSERT IGNORE INTO user (id, username) VALUES (1, REPEAT('x', 1000));
SHOW WARNINGS;                -- 查看被忽略的原因
```

> **批量插入的性能:** 1000 行分 1000 条 INSERT 约需 10 秒(每条都有网络往返 + 事务提交 + redo 刷盘);合并成 1 条约 0.2 秒。
> 但**单条不要太大**:受 `max_allowed_packet` 限制(默认 64MB),且长事务会撑大 undo log。实践建议每批 500~2000 行。

## 3.5 DML:更新数据

```sql
-- 1. 基本条件更新
UPDATE user SET status = 0 WHERE username = 'alice';

-- 2. 一次改多列
UPDATE product SET price = 99.9, stock = stock - 1, updated_at = NOW() WHERE id = 1;

-- 3. 基于自身列运算(原子操作,并发安全)
UPDATE product SET stock = stock - 1 WHERE id = 1 AND stock > 0;   -- 防超卖
UPDATE article SET view_count = view_count + 1 WHERE id = 5;

-- 4. 关联更新(JOIN UPDATE,MySQL 特色,效率高于子查询)
UPDATE course a
JOIN class_value b ON a.course_id = b.course_id
SET a.content_score = b.avg_content,
    a.level_score   = b.avg_level;

-- 用子查询结果更新
UPDATE course a
JOIN (
    SELECT course_id,
           AVG(content_score) AS avg_content,
           AVG(level_score)   AS avg_level
    FROM class_value
    GROUP BY course_id
) b ON a.course_id = b.course_id
SET a.content_score = b.avg_content, a.level_score = b.avg_level;

-- 5. 排序 + 限量更新
UPDATE course SET is_recommend = 1 ORDER BY RAND() LIMIT 10;

-- 6. CASE WHEN 批量按条件改不同值(一条 SQL 搞定多分支)
UPDATE order SET status_desc = CASE status
    WHEN 0 THEN '待支付'
    WHEN 1 THEN '已支付'
    WHEN 2 THEN '已发货'
    ELSE '未知'
END
WHERE created_at >= '2026-01-01';

-- 7. ORDER BY + LIMIT 分批更新大表(避免长事务锁大量行)
UPDATE log SET archived = 1 WHERE archived = 0 ORDER BY id LIMIT 5000;
-- 循环执行直到 affected rows = 0
```

**安全纪律:**

```sql
-- ❌ 不带 WHERE 会更新全表!
UPDATE user SET status = 0;

-- ✅ 先 SELECT 确认范围,把 WHERE 复制过去
SELECT COUNT(*) FROM user WHERE created_at < '2025-01-01';
UPDATE user SET status = 0 WHERE created_at < '2025-01-01';
```

1. 客户端开启**安全更新模式**:`SET SQL_SAFE_UPDATES = 1;`(Workbench 默认开),UPDATE/DELETE 必须带索引列条件或 LIMIT
2. `affected rows` 为 0 不代表失败,可能只是条件没匹配到行;用 `ROW_COUNT()` 检查
3. 大批量更新分批做,每批之间 sleep,给从库追延迟的时间
4. **先备份**:`CREATE TABLE user_bak_20260906 AS SELECT * FROM user WHERE ...`

```sql
-- ROW_COUNT():上一条 DML 影响的行数
UPDATE user SET status = 0 WHERE id = 999999;
SELECT ROW_COUNT();               -- 0
```

## 3.6 DML:删除数据

```sql
-- 1. 条件删除
DELETE FROM user WHERE status = 0 AND created_at < '2024-01-01';

-- 2. 限量删除(大表分批,避免长事务与主从延迟)
DELETE FROM log ORDER BY id LIMIT 5000;

-- 3. 关联删除:删除"在 a 表中但 b 表无对应记录"的行
DELETE a
FROM course a
LEFT JOIN chapter b ON b.course_id = a.course_id
WHERE b.course_id IS NULL;

-- 4. 用子查询结果删除(去重:保留每组 id 最小的)
DELETE a
FROM type a
JOIN (
    SELECT type_name, MIN(type_id) AS min_id, COUNT(*) AS cnt
    FROM type
    GROUP BY type_name
    HAVING COUNT(*) > 1
) b ON a.type_name = b.type_name AND a.type_id > b.min_id;

-- 5. 清空表(DDL,不可回滚,重置自增)
TRUNCATE TABLE temp_result;

-- 6. 软删除(生产推荐)
UPDATE user SET deleted_at = NOW() WHERE id = 1;
```

| 方式 | 类型 | 可回滚 | 速度 | 自增 ID | 适用 |
| --- | --- | --- | --- | --- | --- |
| `DELETE FROM t WHERE ...` | DML | ✅ | 慢(逐行记 undo) | 不重置 | 按条件删除 |
| `TRUNCATE TABLE t` | DDL | ❌ | 快(重建表) | 重置为 1 | 清空临时表 |
| `DROP TABLE t` | DDL | ❌ | 最快 | — | 表不要了 |
| 软删除(UPDATE) | DML | ✅ | 快 | — | **生产业务表** |

> **生产环境删除铁律:**
> 1. 先 `SELECT COUNT(*)` 确认行数,再 `SELECT *` 抽样看数据
> 2. 大批量删除**必须分批**(每批几千行),否则 undo log 暴涨、锁等待、主从延迟数分钟
> 3. 业务表优先软删除(`deleted_at`),保留审计与恢复能力
> 4. 开启 binlog 是最后的救命绳:误删可用 `mysqlbinlog` 反解出逆向 SQL

## 3.7 DQL:单表查询

```sql
-- 基本结构
SELECT [DISTINCT] 列名 / 表达式 / *
FROM 表名
[WHERE 条件]
[GROUP BY 列 [HAVING 条件]]
[ORDER BY 列 ASC|DESC]
[LIMIT offset, count];

-- 查全部列(生产禁用,见下方说明)
SELECT * FROM user;

-- 查指定列 + 别名
SELECT id, username AS name, email FROM user;
SELECT CONCAT(username, '(', email, ')') AS info FROM user;

-- 去重
SELECT DISTINCT city FROM user;
SELECT DISTINCT city, status FROM user;       -- 对组合去重

-- 常量与表达式
SELECT 1 + 1, NOW(), VERSION(), DATABASE(), USER(), CURRENT_USER();
SELECT username, UPPER(email) FROM user;
```

> **为什么生产禁用 `SELECT *`:**
> 1. 无法用**覆盖索引**,必然回表,IO 翻倍
> 2. 传输无用字段(尤其 TEXT/BLOB),浪费网络与内存
> 3. 表结构变化时代码隐式受影响(新增大字段导致接口突然变慢)
> 4. ORM 场景下会实例化所有字段,反序列化开销大

### 排序

```sql
SELECT * FROM product ORDER BY price DESC;                 -- 降序
SELECT * FROM product ORDER BY category ASC, price DESC;   -- 多列排序
SELECT * FROM product ORDER BY RAND() LIMIT 5;             -- 随机取(小表可以,大表灾难)
SELECT id, price FROM product ORDER BY 2 DESC;             -- 按 SELECT 列序号排序(可读性差)

-- 按自定义顺序排(字段值排序)
SELECT * FROM order ORDER BY FIELD(status, '待支付','已支付','已发货','已完成');
SELECT * FROM order ORDER BY CASE status WHEN 1 THEN 10 WHEN 2 THEN 20 ELSE 30 END;

-- NULL 的排序位置:MySQL 中 NULL 最小
-- ASC:NULL 在最前;DESC:NULL 在最后
SELECT * FROM user ORDER BY phone IS NULL, phone;          -- 把 NULL 强制排到最后
```

> **`ORDER BY RAND()` 的性能陷阱:** 它会给每行算随机数、建临时表、filesort,10 万行可能要几秒。大表随机取 N 条的正确做法:
> ```sql
> -- 方案:先取随机偏移量,再 LIMIT
> SELECT * FROM product LIMIT 5 OFFSET FLOOR(RAND() * 100000);
> -- 或:主键范围随机
> SELECT * FROM product WHERE id >= (SELECT FLOOR(RAND() * MAX(id)) FROM product) LIMIT 5;
> ```

### 分页

```sql
-- MySQL 两种等价写法
SELECT * FROM article ORDER BY id LIMIT 20 OFFSET 40;   -- 标准写法
SELECT * FROM article ORDER BY id LIMIT 40, 20;         -- MySQL 简写:offset, count

-- 第 n 页(每页 size 条):LIMIT (n-1)*size, size
```

**深分页问题(必考):** `LIMIT 1000000, 20` 需要先取出 1000020 行再丢弃前 100 万行,越翻越慢。

```sql
-- ❌ 慢:扫描 100 万行 + 回表 100 万次
SELECT * FROM article ORDER BY id LIMIT 1000000, 20;

-- ✅ 方案一:延迟关联(子查询只在索引上翻页,再回表取 20 行)
SELECT a.* FROM article a
JOIN (SELECT id FROM article ORDER BY id LIMIT 1000000, 20) b ON a.id = b.id;

-- ✅ 方案二:游标分页 / 记住上次最大 id(最优,但只能顺序翻页)
SELECT * FROM article WHERE id > 1000000 ORDER BY id LIMIT 20;

-- ✅ 方案三:业务限制(不允许跳页,只给"下一页";或超过 100 页提示用搜索)
```

> **`COUNT(*)` 分页的代价:** `SELECT COUNT(*) FROM article` 在 InnoDB 上必须扫描(选最小的二级索引),千万级表要数百毫秒。解决方案:① 用近似值 `EXPLAIN` 的 rows 或 `information_schema.TABLES.TABLE_ROWS`(误差可达 40%);② 单独维护计数表;③ 缓存总数;④ 前端只显示"有更多"不显示总页数。

## 3.8 多表查询:JOIN

### JOIN 的类型

```text
INNER JOIN(内连接)     A ∩ B          只保留两边都匹配的行
LEFT  JOIN(左外连接)    A ⟕ B          保留左表全部,右表无匹配填 NULL
RIGHT JOIN(右外连接)    A ⟖ B          保留右表全部,左表无匹配填 NULL
FULL  JOIN(全外连接)    A ∪ B          MySQL 不直接支持,用 LEFT UNION RIGHT 模拟
CROSS JOIN(交叉连接)    A × B          笛卡尔积
SELF JOIN(自连接)                     同一张表连接自己(层级、相邻比较)
```

```sql
-- 内连接:查订单及其用户
SELECT o.id AS order_id, o.amount, u.username
FROM `order` o
INNER JOIN user u ON u.id = o.user_id;
-- INNER 可省略
FROM `order` o JOIN user u ON u.id = o.user_id;

-- 左连接:查所有用户及其订单数(含没下过单的)
SELECT u.id, u.username, COUNT(o.id) AS order_cnt
FROM user u
LEFT JOIN `order` o ON o.user_id = u.id
GROUP BY u.id, u.username;

-- 左连接找"没有对应记录的":查从未下单的用户
SELECT u.* FROM user u
LEFT JOIN `order` o ON o.user_id = u.id
WHERE o.id IS NULL;

-- 右连接(实际很少用,调换表顺序改成 LEFT 更易读)
SELECT o.id, u.username FROM user u RIGHT JOIN `order` o ON o.id = u.order_id;

-- 全外连接模拟
SELECT u.id, u.username, o.id AS oid FROM user u LEFT JOIN `order` o ON o.user_id = u.id
UNION
SELECT u.id, u.username, o.id FROM user u RIGHT JOIN `order` o ON o.user_id = u.id;

-- 三表连接
SELECT c.title, cl.class_name, t.type_name, l.level_name
FROM course c
JOIN class cl ON cl.class_id = c.class_id
JOIN type  t  ON t.type_id   = c.type_id
JOIN level l  ON l.level_id  = c.level_id
WHERE c.status = 1;

-- 自连接:查同一部门工资比自己高的员工 / 查相邻记录
SELECT a.name AS emp, b.name AS manager
FROM employee a JOIN employee b ON a.manager_id = b.id;

-- 连续登录问题:自连接找次日也登录的用户
SELECT DISTINCT a.user_id, a.login_date
FROM login a JOIN login b
  ON a.user_id = b.user_id AND b.login_date = DATE_ADD(a.login_date, INTERVAL 1 DAY);

-- 交叉连接(极少显式使用,通常是忘写 WHERE 的事故)
SELECT * FROM size CROSS JOIN color;     -- 生成所有 SKU 组合
```

### 旧式逗号连接与新式 JOIN

```sql
-- 旧式(SQL-92,隐式连接,容易忘写条件产生笛卡尔积)
SELECT * FROM a, b WHERE a.id = b.a_id;

-- 新式(SQL-99,推荐:连接类型与条件显式分离)
SELECT * FROM a JOIN b ON a.id = b.a_id;
```

> **笛卡尔积事故:** 忘写 `ON`/`WHERE` 时,1 万行 × 1 万行 = 1 亿行结果集,直接打满内存与网络。8.0 可设 `SET SESSION sql_require_primary_key` 与代码审查双重防护。

### JOIN 的性能要点

1. **小表驱动大表**:`INNER JOIN` 由优化器自动选择;**`LEFT JOIN` 固定左表为驱动表**,所以要把小表放左边
2. **被驱动表的关联列必须有索引**,否则每次匹配都全表扫(Nested Loop 退化为 O(N×M))
3. **关联列的类型与字符集必须一致**,否则隐式转换让索引失效
4. **JOIN 表数不超过 3 个**(阿里手册建议),过多 JOIN 优化器选错计划且难以水平扩展
5. 8.0 支持 **Hash Join**(`EXPLAIN FORMAT=TREE` 里可见),无索引的等值连接也能高效执行

```sql
-- 查看是否用了 Hash Join
EXPLAIN FORMAT=TREE
SELECT * FROM a JOIN b ON a.x = b.y;
-- -> Inner hash join (b.y = a.x)  ...
```

## 3.9 分组与聚合

### 聚合函数

| 函数 | 作用 | NULL 处理 | 备注 |
| --- | --- | --- | --- |
| `COUNT(*)` | 统计行数 | 计入 NULL 行 | **InnoDB 会选最小的索引扫描** |
| `COUNT(列)` | 统计该列非 NULL 的行数 | **忽略 NULL** | — |
| `COUNT(DISTINCT 列)` | 去重计数 | 忽略 NULL | 需排序/哈希,较慢 |
| `SUM(列)` | 求和 | 忽略 NULL,全 NULL 返回 NULL | 仅数值列 |
| `AVG(列)` | 平均 | 忽略 NULL(分母不含 NULL 行!) | 仅数值列 |
| `MAX(列)` / `MIN(列)` | 最大/最小 | 忽略 NULL | 可用于日期、字符串 |
| `GROUP_CONCAT(列)` | 组内值拼成字符串 | 忽略 NULL | MySQL 特有 |
| `STDDEV(列)` / `VARIANCE(列)` | 标准差/方差 | 忽略 NULL | — |
| `BIT_AND/OR/XOR` | 位聚合 | — | 权限标志位汇总 |

```sql
SELECT COUNT(*) AS total,
       COUNT(phone) AS has_phone,           -- 有手机号的行数
       COUNT(DISTINCT city) AS city_cnt,
       AVG(price) AS avg_price,
       SUM(amount) AS sum_amount,
       MAX(created_at) AS last_time,
       MIN(created_at) AS first_time
FROM user;
```

> **`AVG` 忽略 NULL 的坑:** 10 行数据,3 行 score 为 NULL,`AVG(score)` 是 7 行的平均,不是除以 10。想按 10 算:`SUM(score) / COUNT(*)` 或 `AVG(IFNULL(score, 0))`。
>
> **`COUNT(*)` vs `COUNT(1)` vs `COUNT(id)`:** InnoDB 中三者性能**基本一致**(`COUNT(*)` 与 `COUNT(1)` 官方做了同样优化,`COUNT(主键)` 需取值判空略慢,`COUNT(普通列)` 最慢因为要判断 NULL)。写 `COUNT(*)` 即可,这是 SQL 标准。

### GROUP BY

```sql
-- 按单列分组
SELECT city, COUNT(*) AS cnt FROM user GROUP BY city;

-- 按多列分组
SELECT city, status, COUNT(*) FROM user GROUP BY city, status;

-- HAVING 过滤分组
SELECT user_id, COUNT(*) AS cnt, SUM(amount) AS total
FROM `order`
WHERE status = 1                      -- 先过滤行(走索引,数据量小)
GROUP BY user_id
HAVING COUNT(*) > 3 AND SUM(amount) > 1000;    -- 再过滤组

-- GROUP_CONCAT:把组内明细拼成一行
SELECT user_id, GROUP_CONCAT(product_name ORDER BY id DESC SEPARATOR ' | ') AS products
FROM order_item GROUP BY user_id;
-- 受 group_concat_max_len 限制(默认 1024 字节,超出被截断!)
SET SESSION group_concat_max_len = 1000000;

-- WITH ROLLUP:分组后再汇总一行(报表小计/总计)
SELECT city, COUNT(*) AS cnt FROM user GROUP BY city WITH ROLLUP;
-- 最后一行 city = NULL,是总计

-- 8.0:GROUPING() 区分"真 NULL"与"汇总行 NULL"
SELECT city, COUNT(*), GROUPING(city) FROM user GROUP BY city WITH ROLLUP;
```

### ONLY_FULL_GROUP_BY(MySQL 5.7+ 默认开启)

```sql
-- ❌ 报错:SELECT 里的非聚合列没出现在 GROUP BY 中
SELECT user_id, status, COUNT(*) FROM `order` GROUP BY user_id;
-- ERROR 1055: 'status' isn't in GROUP BY

-- ✅ 方案一:把列加进 GROUP BY
SELECT user_id, status, COUNT(*) FROM `order` GROUP BY user_id, status;

-- ✅ 方案二:用聚合函数明确取哪个
SELECT user_id, MAX(status), COUNT(*) FROM `order` GROUP BY user_id;

-- ✅ 方案三:ANY_VALUE() 显式声明"随便取一个"(8.0)
SELECT user_id, ANY_VALUE(status), COUNT(*) FROM `order` GROUP BY user_id;

-- 查看与临时关闭 sql_mode
SELECT @@sql_mode;
SET SESSION sql_mode = REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', '');
```

> **不要为了图省事永久关闭 `ONLY_FULL_GROUP_BY`。** 关闭后 MySQL 会随机返回组内某一行的值(取决于执行计划!),同样的 SQL 在数据量变化后返回不同结果,是极难排查的 bug 来源。

### sql_mode 严格模式

```sql
-- 推荐的 sql_mode(8.0 默认已含前两项)
SET GLOBAL sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,
NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
```

| 模式 | 作用 |
| --- | --- |
| `STRICT_TRANS_TABLES` | 数据超长/类型不符时**报错**,而不是静默截断 |
| `ONLY_FULL_GROUP_BY` | 强制 GROUP BY 规范 |
| `NO_ZERO_DATE` | 禁止 '0000-00-00' 日期 |
| `ERROR_FOR_DIVISION_BY_ZERO` | 除以 0 报错而非返回 NULL |
| `TRADITIONAL` | 上述严格模式的组合 |

> 非严格模式下,`VARCHAR(10)` 插入 20 个字符会被**静默截断**并只给一个 warning,数据丢了都不知道。生产必须开严格模式。

## 3.10 子查询

| 类型 | 返回 | 用法 |
| --- | --- | --- |
| 标量子查询 | 单个值 | `WHERE price > (SELECT AVG(price) FROM ...)` |
| 列子查询 | 一列多行 | `WHERE id IN (SELECT ...)` |
| 行子查询 | 一行多列 | `WHERE (a,b) = (SELECT x,y FROM ...)` |
| 表子查询 | 多行多列 | `FROM (SELECT ...) AS t` |
| 关联子查询 | 依赖外层 | `WHERE EXISTS (SELECT 1 FROM b WHERE b.aid = a.id)` |

```sql
-- 1. 标量子查询:高于平均价的课程
SELECT title, price FROM course
WHERE price > (SELECT AVG(price) FROM course);

-- 2. IN 子查询
SELECT * FROM user WHERE id IN (SELECT user_id FROM `order` WHERE amount > 1000);

-- 3. EXISTS / NOT EXISTS(关联子查询,通常比 IN 高效)
SELECT * FROM user u
WHERE EXISTS (SELECT 1 FROM `order` o WHERE o.user_id = u.id AND o.amount > 1000);

SELECT * FROM user u
WHERE NOT EXISTS (SELECT 1 FROM `order` o WHERE o.user_id = u.id);   -- 从未下单

-- 4. FROM 子查询(派生表,必须有别名)
SELECT t.city, t.cnt FROM (
    SELECT city, COUNT(*) AS cnt FROM user GROUP BY city
) t WHERE t.cnt > 100;

-- 5. SELECT 列表中的子查询(标量,每行执行一次,N+1 风险)
SELECT u.username,
       (SELECT COUNT(*) FROM `order` o WHERE o.user_id = u.id) AS order_cnt
FROM user u;
-- 更好:改用 LEFT JOIN + GROUP BY

-- 6. 多列比较
SELECT * FROM product WHERE (category, price) IN (
    SELECT category, MAX(price) FROM product GROUP BY category
);   -- 每个分类最贵的商品

-- 7. 自连接代替子查询:查每个分类销量第一的商品
SELECT p.* FROM product p
LEFT JOIN product p2 ON p.category = p2.category AND p.sales < p2.sales
WHERE p2.id IS NULL;
```

**IN vs EXISTS 的选择:**

| 场景 | 推荐 | 原因 |
| --- | --- | --- |
| 外表小、子查询结果集大 | `IN` | IN 只执行一次子查询,构建哈希表后逐行探测 |
| 外表大、子查询结果集小 | `EXISTS` | EXISTS 对外表逐行执行,子查询命中即短路返回 |
| 子查询列可能为 NULL | `EXISTS` 或加 `IS NOT NULL` | `NOT IN` 遇 NULL 返回空集(经典陷阱) |

> MySQL 5.6+ 的优化器会把 `IN (子查询)` 做**半连接(Semi-Join)转换**,多数情况自动选择最优策略,可用 `EXPLAIN` 确认(`select_type` 显示 `SIMPLE` 而非 `SUBQUERY` 说明已被转换)。

## 3.11 UNION 与 UNION ALL

```sql
-- UNION:合并结果集并**去重**(需要排序/哈希,慢)
SELECT username FROM user WHERE city = '北京'
UNION
SELECT username FROM vip_user WHERE city = '北京';

-- UNION ALL:直接拼接,**不去重**(快,推荐)
SELECT id, 'user' AS src FROM user WHERE status = 0
UNION ALL
SELECT id, 'admin' AS src FROM admin WHERE status = 0;

-- 对合并结果排序/分页:必须用括号 + 整体 ORDER BY
(SELECT id, created_at FROM order_2025)
UNION ALL
(SELECT id, created_at FROM order_2026)
ORDER BY created_at DESC
LIMIT 20;

-- 对单个分支排序(需配 LIMIT 才生效)
(SELECT * FROM a ORDER BY id LIMIT 5) UNION ALL (SELECT * FROM b LIMIT 5);
```

| | UNION | UNION ALL |
| --- | --- | --- |
| 去重 | ✅ | ❌ |
| 性能 | 慢(建临时表去重) | **快** |
| 使用建议 | 确实需要去重时 | **默认选择**,确认无重复数据时用 |

**规则:** 各分支的**列数必须相同**,对应列的**类型要兼容**(名字以第一个 SELECT 为准)。

> **分表合并查询的典型用法:** 按月分表的历史数据聚合,用 `UNION ALL` 拼接各月表,比跨月 JOIN 高效得多。

## 3.12 SQL 注入与防护

```python
# ❌ 字符串拼接 —— SQL 注入漏洞
username = "admin' -- "
sql = f"SELECT * FROM user WHERE username = '{username}'"
# 实际执行:SELECT * FROM user WHERE username = 'admin' -- '
# 注释掉了后续条件,直接以 admin 身份登录!

# ❌ 更危险的例子
keyword = "1; DROP TABLE user; --"
cursor.execute(f"DELETE FROM log WHERE id = {keyword}")
```

**防护手段:**

```python
# ✅ 1. 参数化查询(占位符),永远的第一选择
cursor.execute("SELECT * FROM user WHERE username = %s AND status = %s", (username, status))
# PyMySQL / mysqlclient 用 %s;mysql-connector 用 %s;SQLAlchemy 用 :name

# ✅ 2. ORM(内部就是参数化)
User.objects.filter(username=username)                 # Django
session.execute(select(User).where(User.name == name))  # SQLAlchemy

# ✅ 3. 表名/列名/排序方向无法参数化,必须白名单校验
ALLOWED_SORT = {"created_at", "price", "id"}
sort = request.args.get("sort", "id")
if sort not in ALLOWED_SORT:
    sort = "id"
order = "DESC" if request.args.get("desc") == "1" else "ASC"
cursor.execute(f"SELECT * FROM product ORDER BY {sort} {order} LIMIT 20")
```

```sql
-- ✅ 4. 最小权限:应用账号不给 DROP / GRANT / FILE 权限
GRANT SELECT, INSERT, UPDATE, DELETE ON mydb.* TO 'app'@'%';

-- ✅ 5. 存储过程也用参数,不用动态 SQL 拼接
-- ❌ SET @s = CONCAT('SELECT * FROM t WHERE id = ', input); PREPARE stmt FROM @s;
```

| 防护层 | 措施 |
| --- | --- |
| 代码层 | **参数化查询**(占位符),禁止字符串拼接 SQL |
| 校验层 | 入参类型/长度/范围校验;动态表名列名走**白名单** |
| 权限层 | 应用账号最小权限,禁 DROP/GRANT/FILE/SUPER |
| 架构层 | WAF、SQL 审计、预编译语句缓存 |
| 数据层 | 敏感字段加密、脱敏展示 |

> **`PREPARE / EXECUTE` 预编译语句**不仅防注入,还能复用执行计划减少解析开销:
> ```sql
> PREPARE stmt FROM 'SELECT * FROM user WHERE id = ?';
> SET @uid = 5;
> EXECUTE stmt USING @uid;
> DEALLOCATE PREPARE stmt;
> ```

## 3.13 SQL 书写规范与调试技巧

```sql
-- 规范:关键字大写、字段表名小写、适当换行缩进、别名用 AS
SELECT
    u.id,
    u.username,
    COUNT(o.id)      AS order_count,
    SUM(o.amount)    AS total_amount
FROM user AS u
LEFT JOIN `order` AS o
    ON o.user_id = u.id
    AND o.status = 1
WHERE u.created_at >= '2026-01-01'
GROUP BY u.id, u.username
HAVING COUNT(o.id) > 0
ORDER BY total_amount DESC
LIMIT 20;
```

**调试与验证技巧:**

```sql
-- 1. 先跑 WHERE 部分,确认命中行数
SELECT COUNT(*) FROM user WHERE created_at >= '2026-01-01';

-- 2. 用 EXPLAIN 看执行计划(见下一章)
EXPLAIN SELECT ...;
EXPLAIN ANALYZE SELECT ...;          -- 8.0.18+:真实执行并给出各步耗时

-- 3. 把 UPDATE/DELETE 先改成 SELECT 同样的 WHERE 看数据
-- 4. 事务里试探:BEGIN; UPDATE ...; SELECT ...; ROLLBACK;
-- 5. 长输出用 \G 纵向显示
SHOW CREATE TABLE user\G

-- 6. 查看上一条语句的统计
SHOW STATUS LIKE 'Last_query_cost';       -- 优化器估算的成本
SHOW WARNINGS;                             -- 看被截断/隐式转换的警告
```

## 3.14 常用 SQL 命令速查

| 目的 | 命令 |
| --- | --- |
| 查看库 | `SHOW DATABASES;` |
| 建库 | `CREATE DATABASE mydb DEFAULT CHARSET utf8mb4;` |
| 切换库 | `USE mydb;` |
| 查看表 | `SHOW TABLES;` / `SHOW TABLE STATUS\G` |
| 查看表结构 | `DESC user;` / `SHOW FULL COLUMNS FROM user;` |
| 查看建表语句 | `SHOW CREATE TABLE user\G` |
| 查看索引 | `SHOW INDEX FROM user;` |
| 建表 | `CREATE TABLE t (...) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='';` |
| 加列 | `ALTER TABLE t ADD COLUMN x INT NOT NULL DEFAULT 0 COMMENT '';` |
| 改列类型 | `ALTER TABLE t MODIFY COLUMN x BIGINT;` |
| 改列名+类型 | `ALTER TABLE t CHANGE COLUMN x y BIGINT;` |
| 删列 | `ALTER TABLE t DROP COLUMN x;` |
| 加索引 | `ALTER TABLE t ADD INDEX idx_x (x);` |
| 加唯一索引 | `ALTER TABLE t ADD UNIQUE KEY uk_x (x);` |
| 删索引 | `ALTER TABLE t DROP INDEX idx_x;` |
| 重命名表 | `RENAME TABLE a TO b;` |
| 插入 | `INSERT INTO t (a,b) VALUES (1,2), (3,4);` |
| 更新 | `UPDATE t SET a = 1 WHERE id = 2;` |
| 删除 | `DELETE FROM t WHERE id = 2 LIMIT 1000;` |
| 清空表 | `TRUNCATE TABLE t;` |
| 查数据 | `SELECT a, b FROM t WHERE a > 1 ORDER BY b DESC LIMIT 10;` |
| 事务 | `BEGIN; ... COMMIT; / ROLLBACK;` |
| 保存点 | `SAVEPOINT sp1; ROLLBACK TO sp1;` |
| 看执行计划 | `EXPLAIN SELECT ...;` / `EXPLAIN ANALYZE SELECT ...;` |
| 看当前连接 | `SHOW PROCESSLIST;` / `SHOW FULL PROCESSLIST;` |
| 杀连接 | `KILL 连接id;` / `KILL QUERY 连接id;` |
| 看变量 | `SHOW GLOBAL VARIABLES LIKE '%timeout%';` |
| 看状态 | `SHOW GLOBAL STATUS LIKE 'Threads%';` |
| 看引擎 | `SHOW ENGINES;` |
| 备份 | `mysqldump -uroot -p --single-transaction mydb > mydb.sql` |
| 恢复 | `mysql -uroot -p mydb < mydb.sql` |

---

## 本章小结

- SQL 分 DDL / DML / DQL / DCL / TCL 五类;默认 `autocommit=1`
- **执行顺序 FROM→ON→WHERE→GROUP BY→HAVING→SELECT→DISTINCT→ORDER BY→LIMIT**,决定了别名和聚合函数能用在哪
- `ON` 在连接时过滤、`WHERE` 在临时表后过滤、`HAVING` 在聚合后过滤;LEFT JOIN 中右表条件写错位置会退化成 INNER JOIN
- 批量 INSERT 一条多行远快于循环单条;`ON DUPLICATE KEY UPDATE` 优于 `REPLACE INTO`
- UPDATE/DELETE 必须带 WHERE,大表分批;先 SELECT 验证范围
- 禁用 `SELECT *`(无法覆盖索引、传无用字段);深分页用延迟关联或游标分页
- JOIN 不超过 3 表,被驱动表关联列必须有索引,类型字符集必须一致
- `COUNT(*)` 是标准写法,三者性能一致;`AVG`/`COUNT(列)` 都忽略 NULL
- 保持 `ONLY_FULL_GROUP_BY` 与 `STRICT_TRANS_TABLES`,别为省事关掉
- `NOT IN` 子查询遇 NULL 返回空集,改用 `NOT EXISTS` 或加 `IS NOT NULL`
- `UNION ALL` 默认优于 `UNION`(去重代价高)
- **SQL 注入唯一可靠防线是参数化查询**;动态表名列名走白名单;应用账号最小权限
