---
title: "高级查询与函数"
aliases:
  - "MySQL函数"
  - "MySQL窗口函数"
  - "MySQL CTE"
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
  - "[[后端/数据库/MySQL/SQL基础]]"
  - "[[后端/数据库/MySQL/索引与执行计划]]"
  - "[[后端/数据库/PostgreSQL/PostgreSQL特色功能]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 04 高级查询与函数

本章覆盖:MySQL 内置函数全集(字符串/数值/日期/条件/窗口)、CTE 公用表表达式、窗口函数、JSON 查询、经典业务 SQL 写法(TopN、连续登录、行转列)。

## 4.1 字符串函数

| 函数 | 作用 | 示例 | 结果 |
| --- | --- | --- | --- |
| `CONCAT(s1, s2, ...)` | 拼接,**任一参数为 NULL 则整体 NULL** | `CONCAT('a','b')` | `'ab'` |
| `CONCAT_WS(sep, s1, s2)` | 用分隔符拼接,**自动跳过 NULL** | `CONCAT_WS('-', '2026','09','06')` | `'2026-09-06'` |
| `LENGTH(s)` | **字节**长度 | `LENGTH('中文')` | `6`(utf8mb4) |
| `CHAR_LENGTH(s)` | **字符**长度 | `CHAR_LENGTH('中文')` | `2` |
| `UPPER(s)` / `LOWER(s)` | 大小写转换 | `UPPER('abc')` | `'ABC'` |
| `LEFT(s, n)` / `RIGHT(s, n)` | 左/右截取 n 个字符 | `LEFT('abcdef', 2)` | `'ab'` |
| `SUBSTRING(s, pos, len)` | 截取,**pos 从 1 开始** | `SUBSTRING('abcdef', 2, 3)` | `'bcd'` |
| `SUBSTRING_INDEX(s, delim, cnt)` | 按分隔符取前/后 cnt 段 | `SUBSTRING_INDEX('a-b-c', '-', 2)` | `'a-b'` |
| `LOCATE(sub, s)` | 子串首次出现位置(找不到返回 0) | `LOCATE('b', 'abc')` | `2` |
| `INSTR(s, sub)` | 同上,参数顺序相反 | `INSTR('abc','b')` | `2` |
| `TRIM(s)` | 去两端空格 | `TRIM('  a  ')` | `'a'` |
| `TRIM(BOTH 'x' FROM s)` | 去两端指定字符 | `TRIM(BOTH '0' FROM '001200')` | `'12'` |
| `LTRIM` / `RTRIM` | 去左/右空格 | — | — |
| `LPAD(s, len, pad)` / `RPAD` | 左/右填充到指定长度 | `LPAD('5', 3, '0')` | `'005'` |
| `REPLACE(s, from, to)` | 替换所有匹配 | `REPLACE('a-b','-','_')` | `'a_b'` |
| `INSERT(s, pos, len, new)` | 替换指定位置的子串 | `INSERT('abcdef',2,2,'XY')` | `'aXYef'` |
| `REVERSE(s)` | 反转 | `REVERSE('abc')` | `'cba'` |
| `REPEAT(s, n)` | 重复 n 次 | `REPEAT('ab', 3)` | `'ababab'` |
| `SPACE(n)` | n 个空格 | — | — |
| `STRCMP(s1, s2)` | 比较,返回 -1/0/1 | `STRCMP('a','b')` | `-1` |
| `FORMAT(x, d)` | 千分位格式化并四舍五入 | `FORMAT(1234567.891, 2)` | `'1,234,567.89'` |
| `ELT(n, s1, s2, ...)` | 取第 n 个参数 | `ELT(2, 'a','b','c')` | `'b'` |
| `FIELD(s, s1, s2, ...)` | 返回 s 在列表中的位置 | `FIELD('b','a','b','c')` | `2` |
| `FIND_IN_SET(s, list)` | 在逗号分隔串中找位置 | `FIND_IN_SET('b','a,b,c')` | `2` |

```sql
-- 实战:截取邮箱域名
SELECT email,
       SUBSTRING_INDEX(email, '@', -1) AS domain,
       SUBSTRING_INDEX(email, '@', 1)  AS account
FROM user;

-- 实战:手机号脱敏
SELECT CONCAT(LEFT(phone, 3), '****', RIGHT(phone, 4)) AS masked
FROM user;
-- 或
SELECT INSERT(phone, 4, 4, '****') FROM user;

-- 实战:标题按 '-' 分段处理
SELECT title,
       LOCATE('_', title),
       SUBSTRING(title, 1, LOCATE('-', title) - 1) AS prefix,
       SUBSTRING_INDEX(title, '-', 1)              AS prefix2
FROM course;

-- 实战:编号补零
SELECT LPAD(id, 8, '0') AS order_no FROM `order`;
```

> **`LENGTH` 与 `CHAR_LENGTH` 混用是常见 bug:** 做"限制输入 20 字"的校验时用 `CHAR_LENGTH`;计算存储占用、前缀索引长度时用 `LENGTH`。
> **`CONCAT` 遇 NULL 全变 NULL**,拼接可能为空的列时用 `CONCAT_WS` 或 `IFNULL(col, '')`。
> **`FIND_IN_SET` 用于逗号分隔的字段**是反范式设计的补救,无法走索引,应在设计阶段拆表(见 [[后端/数据库/MySQL/数据类型与表设计]])。

## 4.2 数值函数

| 函数 | 作用 | 示例 | 结果 |
| --- | --- | --- | --- |
| `ABS(x)` | 绝对值 | `ABS(-5)` | `5` |
| `CEIL(x)` / `CEILING(x)` | 向上取整 | `CEIL(1.1)` | `2` |
| `FLOOR(x)` | 向下取整 | `FLOOR(1.9)` | `1` |
| `ROUND(x, d)` | 四舍五入到 d 位小数 | `ROUND(3.14159, 2)` | `3.14` |
| `TRUNCATE(x, d)` | **直接截断**,不四舍五入 | `TRUNCATE(3.14159, 2)` | `3.14` |
| `MOD(n, m)` | 取余 | `MOD(10, 3)` | `1` |
| `POW(x, y)` / `POWER` | x 的 y 次方 | `POW(2, 10)` | `1024` |
| `SQRT(x)` | 平方根 | `SQRT(16)` | `4` |
| `EXP(x)` | e 的 x 次方 | — | — |
| `LOG(x)` / `LOG10(x)` / `LN(x)` | 对数 | — | — |
| `RAND([seed])` | 0~1 随机数 | `FLOOR(RAND()*100)` | 0~99 整数 |
| `SIGN(x)` | 符号,返回 -1/0/1 | `SIGN(-8)` | `-1` |
| `PI()` | 圆周率 | — | `3.141593` |
| `GREATEST(a,b,...)` | 多列最大值 | `GREATEST(s1, s2, s3)` | — |
| `LEAST(a,b,...)` | 多列最小值 | — | — |

```sql
-- 分页偏移量计算
SELECT FLOOR((5 - 1) * 20);            -- 第 5 页每页 20 条 → offset 80

-- 取 100~200 的随机整数
SELECT FLOOR(100 + RAND() * 101);

-- 保留两位小数(金额展示)
SELECT ROUND(amount, 2), TRUNCATE(amount, 2) FROM `order`;

-- 多列取最大(横向比较,MAX 是纵向的)
SELECT GREATEST(content_score, level_score, logic_score) AS best FROM course_value;

-- 随机数在 UPDATE 中的应用
UPDATE course SET is_recommend = 1 ORDER BY RAND() LIMIT 10;
```

> **`ROUND` 对 DECIMAL 与 DOUBLE 行为不同:** DECIMAL 是精确的四舍五入(远离零);DOUBLE 因二进制表示可能有 `ROUND(2.675, 2) = 2.67` 的现象。金额计算始终用 DECIMAL。
> **`RAND()` 不是确定性的**,在复制场景下 `RAND()` 会导致主从数据不一致;binlog 为 STATEMENT 格式时尤其危险(ROW 格式无此问题)。

## 4.3 日期时间函数

### 获取当前时间

| 函数 | 返回 | 示例结果 |
| --- | --- | --- |
| `NOW()` / `SYSDATE()` | 当前日期时间 | `2026-09-06 15:30:00` |
| `CURDATE()` / `CURRENT_DATE` | 当前日期 | `2026-09-06` |
| `CURTIME()` / `CURRENT_TIME` | 当前时间 | `15:30:00` |
| `UNIX_TIMESTAMP()` | 当前 Unix 秒 | `1788000000` |
| `UTC_TIMESTAMP()` | 当前 UTC 时间 | — |

> **`NOW()` 与 `SYSDATE()` 的关键区别:** `NOW()` 在**语句开始时求值一次**,同一条 SQL 里多次调用值相同;`SYSDATE()` 每次调用都取实时值。
> ```sql
> SELECT NOW(), SLEEP(2), NOW();        -- 两个时间相同
> SELECT SYSDATE(), SLEEP(2), SYSDATE(); -- 相差 2 秒
> ```
> 主从复制中 `SYSDATE()` 会导致主从时间不一致,**生产禁用**,统一用 `NOW()`。

### 提取与格式化

| 函数 | 作用 | 示例 | 结果 |
| --- | --- | --- | --- |
| `DATE(dt)` | 取日期部分 | `DATE('2026-09-06 15:30:00')` | `'2026-09-06'` |
| `TIME(dt)` | 取时间部分 | — | `'15:30:00'` |
| `YEAR(dt)` / `MONTH` / `DAY` | 年/月/日 | `YEAR(NOW())` | `2026` |
| `HOUR` / `MINUTE` / `SECOND` | 时/分/秒 | — | — |
| `QUARTER(dt)` | 季度(1~4) | — | `3` |
| `WEEK(dt)` / `WEEKOFYEAR` | 一年中第几周 | — | — |
| `DAYOFWEEK(dt)` | 星期(1=周日,7=周六) | — | — |
| `DAYOFYEAR(dt)` | 一年中第几天 | — | — |
| `DAYNAME(dt)` / `MONTHNAME(dt)` | 英文名 | `DAYNAME(NOW())` | `'Sunday'` |
| `EXTRACT(unit FROM dt)` | 提取指定部分 | `EXTRACT(YEAR_MONTH FROM NOW())` | `202609` |
| `DATE_FORMAT(dt, fmt)` | 格式化为字符串 | `DATE_FORMAT(NOW(), '%Y年%m月%d日')` | `'2026年09月06日'` |
| `STR_TO_DATE(s, fmt)` | 字符串转日期 | `STR_TO_DATE('06/09/2026','%d/%m/%Y')` | `'2026-09-06'` |
| `FROM_UNIXTIME(ts)` | 时间戳转日期 | `FROM_UNIXTIME(1788000000)` | — |
| `UNIX_TIMESTAMP(dt)` | 日期转时间戳 | — | — |
| `TIME_TO_SEC(t)` | 时间转秒数 | `TIME_TO_SEC('01:30:00')` | `5400` |
| `SEC_TO_TIME(s)` | 秒数转时间 | `SEC_TO_TIME(5400)` | `'01:30:00'` |
| `LAST_DAY(dt)` | 当月最后一天 | `LAST_DAY('2026-02-01')` | `'2026-02-28'` |
| `MAKEDATE(y, n)` / `MAKETIME(h,m,s)` | 构造日期/时间 | — | — |

**DATE_FORMAT 格式符:**

| 符 | 含义 | 符 | 含义 |
| --- | --- | --- | --- |
| `%Y` | 4 位年 | `%y` | 2 位年 |
| `%m` | 2 位月(01~12) | `%c` | 月(1~12) |
| `%d` | 2 位日 | `%e` | 日(1~31) |
| `%H` | 24 小时制时 | `%h` | 12 小时制时 |
| `%i` | 分(注意不是 %m!) | `%s` / `%S` | 秒 |
| `%f` | 微秒 | `%p` | AM/PM |
| `%W` | 星期名 | `%w` | 星期数字(0=周日) |
| `%j` | 一年中第几天 | `%U`/`%u` | 周数 |
| `%T` | HH:MM:SS | `%r` | HH:MM:SS AM/PM |

### 日期运算

```sql
-- DATE_ADD / DATE_SUB:最常用
SELECT DATE_ADD(NOW(), INTERVAL 1 DAY);              -- 明天
SELECT DATE_ADD(NOW(), INTERVAL -1 DAY);             -- 昨天
SELECT DATE_SUB(NOW(), INTERVAL 3 MONTH);            -- 3 个月前
SELECT DATE_ADD(NOW(), INTERVAL '1:30' HOUR_MINUTE); -- 1 小时 30 分后
SELECT DATE_ADD(NOW(), INTERVAL '1-6' YEAR_MONTH);   -- 1 年 6 个月后
SELECT DATE_ADD(NOW(), INTERVAL 1 WEEK);

-- 简写形式(等价)
SELECT NOW() + INTERVAL 1 DAY;
SELECT NOW() - INTERVAL 30 MINUTE;

-- 间隔单位(unit):
-- MICROSECOND / SECOND / MINUTE / HOUR / DAY / WEEK / MONTH / QUARTER / YEAR
-- 复合型:SECOND_MICROSECOND、MINUTE_MICROSECOND、MINUTE_SECOND、HOUR_MICROSECOND、
--        HOUR_SECOND、HOUR_MINUTE、DAY_MICROSECOND、DAY_SECOND、DAY_MINUTE、
--        DAY_HOUR、YEAR_MONTH

-- DATEDIFF / TIMEDIFF / TIMESTAMPDIFF
SELECT DATEDIFF('2026-12-31', NOW());                          -- 相差天数(只算日期部分)
SELECT TIMEDIFF('15:30:00', '10:00:00');                       -- '05:30:00'
SELECT TIMESTAMPDIFF(HOUR, created_at, NOW()) FROM `order`;     -- 相差小时数(可指定单位)
SELECT TIMESTAMPDIFF(MONTH, '2026-01-15', '2026-09-06');       -- 8

-- PERIOD_DIFF:比较 YYYYMM 格式
SELECT PERIOD_DIFF(202609, 202601);                            -- 8
```

> **`DATEDIFF` 只接受两个参数并返回天数**,想要其他单位用 `TIMESTAMPDIFF(unit, start, end)`。注意参数顺序:`DATEDIFF(晚, 早)` 为正,`TIMESTAMPDIFF(unit, 早, 晚)` 为正。

### 日期查询的正确姿势(索引相关,极重要)

```sql
-- ❌ 对列做函数运算 → 索引失效,全表扫描
SELECT * FROM `order` WHERE DATE(created_at) = '2026-09-06';
SELECT * FROM `order` WHERE YEAR(created_at) = 2026;
SELECT * FROM `order` WHERE created_at + INTERVAL 1 DAY > NOW();

-- ✅ 改写为范围查询 → 走索引
SELECT * FROM `order`
WHERE created_at >= '2026-09-06 00:00:00' AND created_at < '2026-09-07 00:00:00';

SELECT * FROM `order`
WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01';

-- ✅ 动态生成范围(近 7 天)
SELECT * FROM `order`
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
  AND created_at <  DATE_ADD(CURDATE(), INTERVAL 1 DAY);

-- ✅ 本月
SELECT * FROM `order`
WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  AND created_at <  DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH);
```

> **规则:让列"裸奔",函数加在常量侧。** `WHERE DATE(col) = 'x'` 必须对每行调用函数,索引完全用不上;`WHERE col >= 'x' AND col < 'y'` 可以做索引范围扫描,性能差几个数量级。这是慢查询排行第一的成因。

### 时间统计的常用套路

```sql
-- 按天统计订单量
SELECT DATE(created_at) AS day, COUNT(*) AS cnt, SUM(amount) AS total
FROM `order`
WHERE created_at >= '2026-09-01'
GROUP BY DATE(created_at)
ORDER BY day;

-- 按周统计(YEARWEEK 避免跨年周混淆)
SELECT YEARWEEK(created_at, 1) AS yw, COUNT(*) FROM `order` GROUP BY yw;

-- 按月统计
SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS cnt
FROM `order` GROUP BY month ORDER BY month;

-- 补齐没有数据的日期(用日历表 LEFT JOIN,或用递归 CTE 生成日期序列)
WITH RECURSIVE days AS (
    SELECT DATE('2026-09-01') AS d
    UNION ALL
    SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM days WHERE d < '2026-09-30'
)
SELECT days.d, COUNT(o.id) AS cnt
FROM days LEFT JOIN `order` o ON DATE(o.created_at) = days.d
GROUP BY days.d
ORDER BY days.d;

-- 时间戳与日期互转(接口返回秒级时间戳时)
SELECT FROM_UNIXTIME(create_time) FROM log;
SELECT UNIX_TIMESTAMP(created_at) FROM `order`;
```

## 4.4 条件与控制流函数

| 函数 | 语法 | 说明 |
| --- | --- | --- |
| `IF` | `IF(expr, v1, v2)` | expr 为真返回 v1,否则 v2 |
| `IFNULL` | `IFNULL(expr, v)` | expr 为 NULL 时返回 v |
| `NULLIF` | `NULLIF(a, b)` | a = b 时返回 NULL,否则返回 a |
| `COALESCE` | `COALESCE(v1, v2, ...)` | 返回第一个非 NULL 值(**SQL 标准,跨库通用**) |
| `CASE WHEN` | 见下 | 多分支,SQL 标准 |

```sql
-- IF
SELECT username, IF(age >= 18, '成年', '未成年') AS type FROM user;

-- IFNULL:把 NULL 变成 0 参与计算
SELECT SUM(IFNULL(bonus, 0)) FROM employee;

-- COALESCE:多级兜底(优先昵称,其次用户名,最后默认)
SELECT COALESCE(nickname, username, '匿名用户') AS display_name FROM user;

-- NULLIF:防除零(分母为 0 时返回 NULL,除法结果 NULL 而非报错)
SELECT total / NULLIF(cnt, 0) AS avg_val FROM stat;

-- CASE WHEN 的两种写法
-- 写法一:简单 CASE(比较值)
SELECT username,
       CASE status
           WHEN 0 THEN '禁用'
           WHEN 1 THEN '正常'
           WHEN 2 THEN '封禁'
           ELSE '未知'
       END AS status_desc
FROM user;

-- 写法二:搜索 CASE(比较条件,更灵活)
SELECT username,
       CASE
           WHEN age < 18  THEN '未成年'
           WHEN age < 60  THEN '成年'
           ELSE '老年'
       END AS age_group
FROM user;

-- CASE WHEN 在 WHERE / ORDER BY 中
SELECT * FROM user
WHERE CASE WHEN sex = 1 THEN '男' WHEN sex = 0 THEN '女' ELSE '未知' END = '男';

SELECT * FROM `order`
ORDER BY CASE status WHEN '待支付' THEN 1 WHEN '已支付' THEN 2 ELSE 3 END;
```

### 行转列(CASE WHEN + 聚合,报表必备)

```sql
-- 原始数据:每月每产品一行
-- month | product | amount
-- 2026-07 | A | 100
-- 2026-07 | B | 200
-- 2026-08 | A | 150

-- 转成:一行一个月份,产品作为列
SELECT
    month,
    SUM(CASE WHEN product = 'A' THEN amount ELSE 0 END) AS product_a,
    SUM(CASE WHEN product = 'B' THEN amount ELSE 0 END) AS product_b,
    SUM(CASE WHEN product = 'C' THEN amount ELSE 0 END) AS product_c,
    SUM(amount) AS total
FROM sales
GROUP BY month
ORDER BY month;

-- 条件计数(比子查询高效得多)
SELECT
    user_id,
    COUNT(*)                                    AS order_total,
    SUM(status = 1)                             AS paid_cnt,       -- MySQL 特有:布尔即 1/0
    SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS shipped_cnt,
    SUM(CASE WHEN amount > 1000 THEN amount ELSE 0 END) AS big_amount
FROM `order`
GROUP BY user_id;
```

### 列转行(UNION ALL 或 JSON_TABLE)

```sql
-- 方式一:UNION ALL
SELECT user_id, 'phone' AS field, phone AS value FROM user WHERE phone IS NOT NULL
UNION ALL
SELECT user_id, 'email', email FROM user WHERE email <> ''
UNION ALL
SELECT user_id, 'wechat', wechat FROM user WHERE wechat IS NOT NULL;

-- 方式二:JSON_TABLE(8.0,把 JSON 数组展开成行)
SELECT o.id, jt.product, jt.qty
FROM `order_detail` o,
     JSON_TABLE(o.items, '$[*]' COLUMNS (
         product VARCHAR(100) PATH '$.name',
         qty     INT          PATH '$.qty'
     )) AS jt;
```

## 4.5 其他常用函数

| 函数 | 作用 | 示例 |
| --- | --- | --- |
| `DATABASE()` | 当前库名 | `SELECT DATABASE();` |
| `USER()` / `CURRENT_USER()` | 客户端提供的用户 / 实际认证的用户 | `SELECT USER();` → `app@10.0.0.5` |
| `VERSION()` | 服务器版本 | `SELECT VERSION();` |
| `CONNECTION_ID()` | 当前连接 ID | 用于 `KILL` |
| `LAST_INSERT_ID()` | 最近一次 AUTO_INCREMENT 值 | **会话级,并发安全** |
| `ROW_COUNT()` | 上一条 DML 影响行数 | 判断 UPDATE 是否生效 |
| `FOUND_ROWS()` | 上一次带 `SQL_CALC_FOUND_ROWS` 查询的总行数 | 分页取总数(已废弃) |
| `MD5(s)` / `SHA1(s)` / `SHA2(s, n)` | 哈希 | 校验、简单签名(**不用于密码**) |
| `UUID()` / `UUID_SHORT()` | 生成 UUID | 分布式主键候选 |
| `BENCHMARK(n, expr)` | 重复执行 expr n 次,测性能 | `SELECT BENCHMARK(1000000, MD5('a'));` |
| `SLEEP(n)` | 休眠 n 秒 | 测试超时 |
| `INET_ATON(ip)` / `INET_NTOA(n)` | IP ↔ 整数 | IP 存储与范围查询 |
| `CAST(x AS type)` / `CONVERT(x, type)` | 类型转换 | `CAST('123' AS UNSIGNED)` |
| `GROUPING(expr)` | 配合 ROLLUP 判断是否汇总行 | 8.0 |
| `JSON_*` 系列 | JSON 操作 | 见 [[后端/数据库/MySQL/数据类型与表设计]] |

```sql
-- LAST_INSERT_ID 的正确用法
INSERT INTO user (username) VALUES ('alice');
SELECT LAST_INSERT_ID();                 -- 拿到刚插入的自增 id
INSERT INTO user_profile (user_id, bio) VALUES (LAST_INSERT_ID(), '');

-- 批量插入后 LAST_INSERT_ID 返回第一个 id
INSERT INTO tag (name) VALUES ('a'),('b'),('c');
SELECT LAST_INSERT_ID();                 -- 第一个的 id,后续连续

-- 类型转换
SELECT CAST('2026-09-06' AS DATE);
SELECT CAST(123 AS CHAR);
SELECT CONVERT('12.9', DECIMAL(10,2));
SELECT CAST('0x1F' AS UNSIGNED);
```

> **`MD5` 绝不能用于密码存储。** MySQL 的 MD5 是明文哈希,无盐、可彩虹表反查。密码哈希必须在应用层用 `bcrypt`/`argon2`/`PBKDF2` 完成后再存库(存成 `CHAR(60)`)。
> **`UUID()` 作主键的代价:** 36 字符随机值导致 InnoDB 页分裂严重、索引膨胀、写入性能下降。分布式场景用**雪花算法 ID**(趋势递增的 BIGINT),见 [[后端/数据库/MySQL/分库分表与高可用]]。

## 4.6 CTE 公用表表达式(MySQL 8.0+)

CTE(Common Table Expression)是用 `WITH` 定义的**命名临时结果集**,只在该查询期间有效,可多次引用、可自引用(递归)。

```sql
-- 基本语法
WITH cte_name [(列名列表)] AS (
    SELECT ...
)
SELECT * FROM cte_name;
```

### 非递归 CTE:替代子查询,可读性大幅提升

```sql
-- ❌ 子查询嵌套,层层缩进难读
SELECT * FROM course
WHERE study_cnt > (
    SELECT AVG(study_cnt) FROM course WHERE class_id IN (
        SELECT class_id FROM class WHERE status = 1
    )
);

-- ✅ CTE 由下往上读,逻辑清晰
WITH active_class AS (
    SELECT class_id FROM class WHERE status = 1
),
class_avg AS (
    SELECT AVG(study_cnt) AS avg_cnt
    FROM course
    WHERE class_id IN (SELECT class_id FROM active_class)
)
SELECT * FROM course
WHERE study_cnt > (SELECT avg_cnt FROM class_avg);

-- CTE 可多次引用(子查询要写两遍)
WITH monthly AS (
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS m, SUM(amount) AS total
    FROM `order` GROUP BY m
)
SELECT m, total,
       total / (SELECT AVG(total) FROM monthly) AS ratio_to_avg
FROM monthly
WHERE total > (SELECT AVG(total) FROM monthly);

-- 多个 CTE 之间可互相引用(后面的能引用前面的)
WITH t1 AS (SELECT ...), t2 AS (SELECT * FROM t1 WHERE ...)
SELECT * FROM t2;

-- CTE 用在 JOIN 中
WITH vip AS (
    SELECT user_id, SUM(amount) AS total FROM `order` GROUP BY user_id HAVING total > 10000
)
SELECT u.username, v.total
FROM user u JOIN vip v ON v.user_id = u.id;
```

### 递归 CTE:处理层级与序列

```sql
-- 语法:WITH RECURSIVE 名称 AS ( 锚成员 UNION ALL 递归成员 ) SELECT ...

-- 1. 生成连续数字/日期序列
WITH RECURSIVE seq AS (
    SELECT 1 AS n                                   -- 锚成员:初始值
    UNION ALL
    SELECT n + 1 FROM seq WHERE n < 10              -- 递归成员:引用自身
)
SELECT n FROM seq;                                   -- 1~10

WITH RECURSIVE days AS (
    SELECT DATE('2026-09-01') AS d
    UNION ALL
    SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM days WHERE d < '2026-09-30'
)
SELECT d FROM days;                                  -- 整月每一天(补齐报表空缺日期)

-- 2. 组织架构:从某节点向下展开所有下级
CREATE TABLE emp (id INT PRIMARY KEY, name VARCHAR(20), manager_id INT NULL);

WITH RECURSIVE subordinates AS (
    SELECT id, name, manager_id, 1 AS depth
    FROM emp WHERE id = 1                            -- 锚:根节点
    UNION ALL
    SELECT e.id, e.name, e.manager_id, s.depth + 1
    FROM emp e JOIN subordinates s ON e.manager_id = s.id
)
SELECT * FROM subordinates;

-- 3. 分类树:向上找所有祖先(面包屑)
WITH RECURSIVE ancestors AS (
    SELECT id, name, parent_id FROM category WHERE id = 100
    UNION ALL
    SELECT c.id, c.name, c.parent_id
    FROM category c JOIN ancestors a ON c.id = a.parent_id
)
SELECT * FROM ancestors;

-- 4. 递归拆分逗号分隔字符串(反范式的补救)
WITH RECURSIVE split AS (
    SELECT id,
           SUBSTRING_INDEX(tags, ',', 1) AS tag,
           IF(LOCATE(',', tags) > 0, SUBSTRING(tags, LOCATE(',', tags) + 1), NULL) AS rest
    FROM article
    UNION ALL
    SELECT id,
           SUBSTRING_INDEX(rest, ',', 1),
           IF(LOCATE(',', rest) > 0, SUBSTRING(rest, LOCATE(',', rest) + 1), NULL)
    FROM split WHERE rest IS NOT NULL
)
SELECT id, tag FROM split;
```

**递归 CTE 的规则与陷阱:**

| 规则 | 说明 |
| --- | --- |
| 必须写 `RECURSIVE` | `WITH RECURSIVE`,否则报错 |
| 递归成员只能引用 CTE 一次 | 不能自连接 CTE |
| 必须有终止条件 | 递归部分的 `WHERE` 要能收敛,否则无限递归 |
| 受 `cte_max_recursion_depth` 限制 | **默认 1000**,超出报错 |
| 不支持在递归成员中使用聚合函数 | 不能 `SUM` 后再递归 |

```sql
-- 调大递归深度
SET SESSION cte_max_recursion_depth = 10000;
SHOW VARIABLES LIKE 'cte_max_recursion_depth';
```

> **CTE vs 派生表(FROM 子查询):** CTE 可读性好、可多次引用、可递归。性能上 MySQL 8.0 对 CTE 的处理是**物化或合并**,多次引用的 CTE 通常只算一次(派生表写两遍就算两遍)。但注意:CTE 物化后**没有索引**,如果结果集很大且要多次 JOIN,可能不如建临时表 + 索引。

## 4.7 窗口函数(MySQL 8.0+,面试与报表核心)

窗口函数(Window Function)在**不合并行**的前提下,对"窗口"内的行做计算 —— 每行都保留,同时获得一个基于相关行的计算结果。这是它与聚合函数的本质区别。

```sql
-- 语法
函数名([参数]) OVER (
    [PARTITION BY 分区列]        -- 类似 GROUP BY,把数据分成若干窗口
    [ORDER BY 排序列 [ASC|DESC]] -- 窗口内排序,决定了"累积"的方向
    [frame_clause]               -- 窗口帧:精确界定参与计算的行范围
)
```

### 排名函数(三个的区别是必考点)

| 函数 | 行为 | 并列时 | 后续序号 |
| --- | --- | --- | --- |
| `ROW_NUMBER()` | 连续唯一序号 | **强制不重复**,按内部顺序分配 | 连续 |
| `RANK()` | 排名 | 并列同名次 | **跳号**(1,1,3) |
| `DENSE_RANK()` | 密集排名 | 并列同名次 | **不跳号**(1,1,2) |
| `PERCENT_RANK()` | 百分比排名 | — | 0~1 |
| `CUME_DIST()` | 累积分布 | — | 小于等于当前值的比例 |
| `NTILE(n)` | 分成 n 桶 | — | 返回 1~n |

```sql
SELECT student, class, score,
       ROW_NUMBER() OVER (PARTITION BY class ORDER BY score DESC) AS rw,
       RANK()       OVER (PARTITION BY class ORDER BY score DESC) AS rk,
       DENSE_RANK() OVER (PARTITION BY class ORDER BY score DESC) AS drk,
       NTILE(3)     OVER (PARTITION BY class ORDER BY score DESC) AS bucket,
       PERCENT_RANK() OVER (PARTITION BY class ORDER BY score DESC) AS prank
FROM test
ORDER BY class, rw;
```

```text
class  score  rw  rk  drk
一班    95     1   1   1
一班    95     2   1   1     ← 并列:RANK/DENSE_RANK 同名次,ROW_NUMBER 强制区分
一班    90     3   3   2     ← RANK 跳号(没有 2),DENSE_RANK 连续
一班    80     4   4   3
```

### 聚合函数作为窗口函数

**任何聚合函数加上 `OVER()` 都变成窗口函数:**

```sql
SELECT username, city, salary,
       SUM(salary)   OVER (PARTITION BY city)                  AS city_total,
       AVG(salary)   OVER (PARTITION BY city)                  AS city_avg,
       COUNT(*)      OVER (PARTITION BY city)                  AS city_cnt,
       MAX(salary)   OVER (PARTITION BY city)                  AS city_max,
       -- 带 ORDER BY 就变成"累积"计算
       SUM(salary)   OVER (PARTITION BY city ORDER BY id)      AS running_total,
       AVG(salary)   OVER (PARTITION BY city ORDER BY id
                           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS ma3
FROM employee;
```

> **关键区别:有没有 `ORDER BY`**
> - `SUM(x) OVER (PARTITION BY city)` → 整个分区的总和,**每行都一样**
> - `SUM(x) OVER (PARTITION BY city ORDER BY id)` → 从分区起点**累积到当前行**,每行不同(默认帧是 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`)

### 偏移函数(访问窗口内其他行)

| 函数 | 作用 | 参数 |
| --- | --- | --- |
| `LAG(expr, n, default)` | 取当前行**往前** n 行的值 | n 默认 1 |
| `LEAD(expr, n, default)` | 取当前行**往后** n 行的值 | n 默认 1 |
| `FIRST_VALUE(expr)` | 窗口内第一行的值 | — |
| `LAST_VALUE(expr)` | 窗口内最后一行的值 | 需配帧,否则是"当前帧的最后一行" |
| `NTH_VALUE(expr, n)` | 窗口内第 n 行的值 | — |

```sql
-- 环比:本月 vs 上月
SELECT month, revenue,
       LAG(revenue, 1) OVER (ORDER BY month)  AS prev_month,
       revenue - LAG(revenue) OVER (ORDER BY month) AS growth,
       ROUND((revenue - LAG(revenue) OVER (ORDER BY month))
             / NULLIF(LAG(revenue) OVER (ORDER BY month), 0) * 100, 2) AS growth_pct
FROM monthly_stat;

-- 用户两次登录的间隔
SELECT user_id, login_time,
       TIMESTAMPDIFF(HOUR,
           LAG(login_time) OVER (PARTITION BY user_id ORDER BY login_time),
           login_time) AS gap_hours
FROM login_log;

-- FIRST_VALUE / LAST_VALUE(注意 LAST_VALUE 的默认帧陷阱)
SELECT username, city, salary,
       FIRST_VALUE(username) OVER (PARTITION BY city ORDER BY salary DESC) AS top_earner,
       LAST_VALUE(username)  OVER (PARTITION BY city ORDER BY salary DESC
              ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS low_earner
FROM employee;
-- 不加 ROWS ... UNBOUNDED FOLLOWING 时,LAST_VALUE 返回的是"当前行",不是分区最后一行!
```

### 窗口帧(Frame)

```sql
-- 帧的语法
{ROWS | RANGE | GROUPS} BETWEEN 起点 AND 终点

-- 起点/终点可选值:
UNBOUNDED PRECEDING     -- 分区第一行
n PRECEDING             -- 前 n 行
CURRENT ROW             -- 当前行
n FOLLOWING             -- 后 n 行
UNBOUNDED FOLLOWING     -- 分区最后一行
```

```sql
-- 移动平均(最近 3 行)
SELECT dt, price,
       AVG(price) OVER (ORDER BY dt ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS ma3,
       AVG(price) OVER (ORDER BY dt ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING) AS ma7
FROM stock;

-- 滑动窗口最大值
SELECT dt, price,
       MAX(price) OVER (ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS max7
FROM stock;

-- ROWS vs RANGE 的区别
-- ROWS:按**物理行数**计算
-- RANGE:按**值范围**计算(相同 ORDER BY 值的行算作同一个位置)
SELECT id, score,
       SUM(score) OVER (ORDER BY score ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS by_rows,
       SUM(score) OVER (ORDER BY score RANGE BETWEEN 1 PRECEDING AND CURRENT ROW) AS by_range
FROM test;
```

### 命名窗口(复用定义,减少重复)

```sql
SELECT username, city, salary,
       RANK()     OVER w AS rk,
       SUM(salary) OVER w AS running_total,
       LAG(salary) OVER w AS prev_salary
FROM employee
WINDOW w AS (PARTITION BY city ORDER BY salary DESC)
ORDER BY city, rk;
```

### 经典业务场景

```sql
-- 1. 每组 TopN(窗口函数最经典的用法)
-- 每个分类销量前 3 的商品
SELECT * FROM (
    SELECT id, category, name, sales,
           ROW_NUMBER() OVER (PARTITION BY category ORDER BY sales DESC) AS rn
    FROM product
) t
WHERE rn <= 3;

-- 允许并列时用 RANK / DENSE_RANK
SELECT * FROM (
    SELECT student, class, score,
           DENSE_RANK() OVER (PARTITION BY class ORDER BY score DESC) AS rk
    FROM test
) t WHERE rk <= 3;

-- 2. 连续登录 N 天的用户(经典难题)
-- 思路:登录日期减去行号,连续的话差值相同
SELECT user_id, COUNT(*) AS continuous_days
FROM (
    SELECT user_id, login_date,
           DATE_SUB(login_date,
               INTERVAL ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) DAY
           ) AS grp
    FROM (SELECT DISTINCT user_id, DATE(login_time) AS login_date FROM login_log) d
) t
GROUP BY user_id, grp
HAVING COUNT(*) >= 7;

-- 3. 去重保留最新一条
DELETE t FROM article t
JOIN (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY title ORDER BY updated_at DESC) AS rn
    FROM article
) x ON t.id = x.id AND x.rn > 1;

-- 或用 CTE 查出来再删
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY title ORDER BY updated_at DESC) AS rn
    FROM article
)
SELECT a.* FROM article a JOIN ranked r ON a.id = r.id WHERE r.rn = 1;

-- 4. 累计占比(帕累托分析)
SELECT product, sales,
       SUM(sales) OVER (ORDER BY sales DESC) AS cum_sales,
       ROUND(SUM(sales) OVER (ORDER BY sales DESC)
             / SUM(sales) OVER () * 100, 2) AS cum_pct
FROM product_sales;

-- 5. 会话切分(超过 30 分钟无操作算新会话)
SELECT user_id, event_time,
       SUM(is_new_session) OVER (PARTITION BY user_id ORDER BY event_time) AS session_id
FROM (
    SELECT user_id, event_time,
           CASE WHEN TIMESTAMPDIFF(MINUTE,
                   LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time),
                   event_time) > 30
                OR LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) IS NULL
                THEN 1 ELSE 0 END AS is_new_session
    FROM user_event
) t;
```

> **窗口函数不能用在 WHERE 里**(执行顺序上 WHERE 早于窗口计算),必须套一层子查询或 CTE:
> ```sql
> -- ❌ SELECT *, ROW_NUMBER() OVER () rn FROM t WHERE rn = 1;
> -- ✅ WITH x AS (SELECT *, ROW_NUMBER() OVER (...) rn FROM t) SELECT * FROM x WHERE rn = 1;
> ```

## 4.8 JSON 查询函数速查

```sql
-- 提取
JSON_EXTRACT(doc, '$.a.b')          -- 等价于 doc->'$.a.b',返回 JSON 类型(带引号)
doc->'$.a.b'                        -- 简写
doc->>'$.a.b'                       -- 返回**去引号的文本**(WHERE 比较用这个)
JSON_UNQUOTE(JSON_EXTRACT(doc,'$.a'))  -- 等价于 ->>

-- 判断与查询
JSON_CONTAINS(doc, '"5G"', '$.tags')   -- tags 数组是否含 "5G"
JSON_CONTAINS_PATH(doc, 'one', '$.a')    -- 路径是否存在('one' 任一 / 'all' 全部)
JSON_SEARCH(doc, 'one', 'black')       -- 搜索值,返回路径
JSON_LENGTH(doc)                       -- 元素个数
JSON_DEPTH(doc)                        -- 嵌套深度
JSON_KEYS(doc)                         -- 顶层所有键
JSON_TYPE(doc->'$.a')                  -- 值类型(OBJECT/ARRAY/STRING/INTEGER...)

-- 修改(返回新 JSON,不修改原值)
JSON_SET(doc, '$.a', 1, '$.b', 2)      -- 存在则改,不存在则加
JSON_INSERT(doc, '$.a', 1)             -- 只在不存在时加
JSON_REPLACE(doc, '$.a', 1)            -- 只在存在时改
JSON_REMOVE(doc, '$.a')                -- 删除
JSON_ARRAY_APPEND(doc, '$.tags', 'new')-- 数组追加
JSON_ARRAY_INSERT(doc, '$.tags[0]', 'x') -- 数组指定位置插入
JSON_MERGE_PATCH(d1, d2)               -- 合并(后者覆盖前者)

-- 构造
JSON_OBJECT('name', name, 'age', age)
JSON_ARRAY(a, b, c)
JSON_VALID(s)                          -- 校验字符串是否合法 JSON

-- 聚合(8.0)
JSON_ARRAYAGG(name)                    -- 组内所有值聚成数组
JSON_OBJECTAGG(id, name)               -- 组内聚成对象

-- 展开成表
JSON_TABLE(doc, '$.items[*]' COLUMNS (
    name VARCHAR(100) PATH '$.name',
    qty  INT          PATH '$.qty',
    NESTED PATH '$.tags[*]' COLUMNS (tag VARCHAR(50) PATH '$')
)) AS jt
```

```sql
-- 实战:把子查询结果直接聚成 JSON 返回(接口聚合场景很实用)
SELECT u.id, u.username,
       JSON_OBJECTAGG(o.id, o.amount) AS orders
FROM user u LEFT JOIN `order` o ON o.user_id = u.id
GROUP BY u.id;

SELECT JSON_ARRAYAGG(JSON_OBJECT('id', id, 'name', name)) FROM product;
```

**JSON 路径语法:**

| 语法 | 含义 |
| --- | --- |
| `$` | 根对象 |
| `.key` 或 `."key with space"` | 子成员 |
| `[n]` | 数组第 n 个(从 0 开始) |
| `[*]` | 数组所有元素 |
| `.*` | 对象所有成员 |
| `**.key` | 递归搜索所有层级的 key |
| `[last]` | 数组最后一个元素 |

## 4.9 常见问题与最佳实践

1. **日期条件不对列做函数**,改写成范围查询(`col >= x AND col < y`),否则索引失效
2. **`NOW()` 而非 `SYSDATE()`**(后者破坏主从一致性)
3. **`CONCAT` 遇 NULL 返回 NULL**,可空列用 `CONCAT_WS` 或 `IFNULL`
4. **`LENGTH` 是字节数,`CHAR_LENGTH` 是字符数**,中文场景别混用
5. **金额计算用 DECIMAL**,`ROUND` 对 DOUBLE 有精度陷阱
6. **窗口函数不能出现在 WHERE**,套子查询或 CTE
7. **`LAST_VALUE` 必须显式指定帧**(`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`),否则结果不是分区最后一行
8. **递归 CTE 默认上限 1000 层**,深树要调 `cte_max_recursion_depth`;务必确保递归条件收敛
9. **CTE 物化结果没有索引**,大结果集多次 JOIN 时考虑临时表
10. **每组 TopN 用 `ROW_NUMBER` + 外层过滤**,不要用关联子查询(慢几个数量级)
11. **`MD5` 不用于密码**,密码哈希在应用层用 bcrypt/argon2
12. **`UUID()` 不适合做主键**(页分裂),分布式用雪花 ID

---

## 本章小结

- 函数分五类:字符串、数值、日期、条件控制流、系统信息;`COALESCE`/`CASE WHEN` 是 SQL 标准,跨库通用
- 日期处理三大要点:用 `NOW()` 不用 `SYSDATE()`;`DATE_FORMAT` 的分钟是 `%i`;**范围查询代替函数运算**以保住索引
- `CASE WHEN + 聚合` 实现行转列,`UNION ALL` / `JSON_TABLE` 实现列转行
- CTE(8.0+)让复杂查询自底向上可读,支持递归处理层级与序列,默认深度上限 1000
- 窗口函数在**不合并行**的前提下计算:`OVER (PARTITION BY ... ORDER BY ... frame)`
- 排名三兄弟:`ROW_NUMBER` 不重复、`RANK` 跳号、`DENSE_RANK` 不跳号
- 聚合函数加 `ORDER BY` 就从"分区汇总"变成"累积计算"
- `LAG`/`LEAD` 做环比与间隔,`FIRST_VALUE`/`LAST_VALUE` 取边界值(后者注意帧)
- 经典套路:每组 TopN、连续登录(日期减行号)、去重保留最新、累计占比、会话切分
- JSON 用 `->>` 取文本做比较,用生成列或多值索引才能加速
