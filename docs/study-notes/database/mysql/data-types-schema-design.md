---
title: "数据类型与表设计"
aliases:
  - "MySQL数据类型"
  - "MySQL建表"
tags:
  - "后端"
  - "数据库"
  - "mysql"
  - "笔记"
category: "后端"
folder: "MySQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/MySQL/MySQL入门与安装配置]]"
  - "[[后端/数据库/MySQL/SQL基础]]"
  - "[[后端/数据库/MySQL/索引与执行计划]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 02 数据类型与表设计

选错数据类型是后期最难修复的设计失误:改类型要重建表、锁数据、动代码。本章覆盖:数值/字符串/时间/JSON 等全部类型、类型选择决策、约束与 DDL、三大范式与反范式、命名规范。

## 2.1 数据类型总览

```text
数值类型 ─┬─ 整数:TINYINT / SMALLINT / MEDIUMINT / INT / BIGINT
          ├─ 精确小数:DECIMAL / NUMERIC
          └─ 近似浮点:FLOAT / DOUBLE

字符串 ───┬─ 定长:CHAR(n) / BINARY(n)
          ├─ 变长:VARCHAR(n) / VARBINARY(n)
          ├─ 长文本:TINYTEXT / TEXT / MEDIUMTEXT / LONGTEXT
          ├─ 二进制:TINYBLOB / BLOB / MEDIUMBLOB / LONGBLOB
          └─ 枚举:ENUM / SET

时间类型 ─── DATE / TIME / YEAR / DATETIME / TIMESTAMP

其他 ────── JSON / BIT / GEOMETRY(空间)
```

## 2.2 数值类型

| 类型 | 字节 | 有符号范围 | 无符号范围 | 典型用途 |
| --- | --- | --- | --- | --- |
| `TINYINT` | 1 | -128 ~ 127 | 0 ~ 255 | 状态位、布尔(`TINYINT(1)`) |
| `SMALLINT` | 2 | -32768 ~ 32767 | 0 ~ 65535 | 小型计数 |
| `MEDIUMINT` | 3 | -8388608 ~ 8388607 | 0 ~ 16777215 | 中等规模 ID |
| `INT` / `INTEGER` | 4 | -21 亿 ~ 21 亿 | 0 ~ 42.9 亿 | 常用主键、外键 |
| `BIGINT` | 8 | ±9.2 × 10^18 | 0 ~ 1.8 × 10^19 | 大表主键、雪花 ID |
| `FLOAT` | 4 | 单精度,约 7 位有效数字 | — | 科学计算 |
| `DOUBLE` | 8 | 双精度,约 15 位有效数字 | — | 科学计算 |
| `DECIMAL(M,D)` | 变长 | M 总位数,D 小数位 | — | **金额、精确统计** |

```sql
CREATE TABLE demo_num (
    id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    age       TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '年龄',
    stock     INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '库存',
    price     DECIMAL(10,2)    NOT NULL DEFAULT 0.00 COMMENT '单价',
    score     FLOAT            NULL COMMENT '评分(近似)',
    is_active TINYINT(1)       NOT NULL DEFAULT 1 COMMENT '是否启用:1是0否'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**UNSIGNED(无符号)的取舍:**

- 优点:正数范围翻倍,`INT UNSIGNED` 上限约 42.9 亿
- **坑 1:无符号相减可能溢出**。`SELECT CAST(1 AS UNSIGNED) - 2` 结果不是 -1 而是 `18446744073709551615`(回绕)
- **坑 2:与有符号列 JOIN/比较时可能引发隐式转换**,导致索引失效
- 结论:库存、点赞数等**确定非负且不做减法**的列可用;主键推荐直接用 `BIGINT` 有符号,空间足够且无坑

**DECIMAL 与 FLOAT 的本质区别(高频考点):**

```sql
-- FLOAT/DOUBLE 是二进制浮点,无法精确表示 0.1
SELECT 0.1 + 0.2;                   -- 0.3(DECIMAL 字面量的结果)
SELECT CAST(0.1 AS DOUBLE) + CAST(0.2 AS DOUBLE);   -- 0.30000000000000004

-- DECIMAL 在内部以压缩格式存储十进制,精确
SELECT CAST(0.1 AS DECIMAL(10,2)) + CAST(0.2 AS DECIMAL(10,2));   -- 0.30
```

| | DECIMAL | FLOAT/DOUBLE |
| --- | --- | --- |
| 存储 | 每 9 位十进制用 4 字节表示,精确 | IEEE 754 二进制浮点,近似 |
| 精度 | 完全精确(在 M/D 范围内) | 有舍入误差 |
| 性能 | 略慢(CPU 需软件模拟) | 快(硬件原生) |
| 空间 | `DECIMAL(10,2)` 约 5 字节 | FLOAT 4 / DOUBLE 8 |
| 用途 | **金额、税率、单价** | 科学计算、评分 |

> **金额一律用 `DECIMAL(10,2)` 或 `DECIMAL(18,4)`。** 用 FLOAT 存钱会在累加大量交易后出现分位误差,对账永远对不平。另一种做法是用 `BIGINT` 存"分",在应用层换算 —— 支付系统普遍采用后者。

**`INT(11)` 里的 11 是什么?** 它是**显示宽度**,不是长度限制!`INT(4)` 一样能存 21 亿。它只在配合 `ZEROFILL` 时才有意义(补零到该宽度)。**MySQL 8.0.17 起显示宽度已废弃**,建表写 `INT` 即可,不要写 `INT(11)`。唯一的例外是 `TINYINT(1)`,驱动会把它识别为 BOOLEAN。

## 2.3 字符串类型

| 类型 | 长度上限 | 存储方式 | 用途 |
| --- | --- | --- | --- |
| `CHAR(n)` | 0~255 字符 | **定长**,不足右侧补空格 | 定长数据:MD5、性别、国家码 |
| `VARCHAR(n)` | 0~65535 字节(受行大小限制) | **变长**,1~2 字节记录长度 | 变长数据:用户名、邮箱、标题 |
| `TINYTEXT` | 255 字节 | 变长,行外存储 | 短备注 |
| `TEXT` | 65535 字节(64KB) | 变长,行外存储 | 文章正文、描述 |
| `MEDIUMTEXT` | 16MB | 变长 | 长文章、JSON 字符串 |
| `LONGTEXT` | 4GB | 变长 | 极大文本 |
| `BINARY(n)` / `VARBINARY(n)` | 同 CHAR/VARCHAR | 二进制,按字节 | 哈希值、加密数据 |
| `BLOB` 系列 | 同 TEXT 系列 | 二进制大对象 | 小文件(一般不推荐存库) |
| `ENUM('a','b')` | 最多 65535 个值 | 内部 1~2 字节整数 | 固定选项:性别、状态 |
| `SET('a','b','c')` | 最多 64 个成员 | 位图,8 字节内 | 多选标签 |

### CHAR vs VARCHAR(必考)

| 维度 | CHAR(n) | VARCHAR(n) |
| --- | --- | --- |
| 存储 | 固定 n 字符,不足补空格 | 实际长度 + 1~2 字节长度前缀 |
| 空间 | 存短值浪费 | 紧凑 |
| 速度 | **更快**(定长,无需解析长度) | 略慢 |
| 尾部空格 | **检索时被去掉** | 保留 |
| 行内移动 | 定长不易碎片 | 变长更新易产生碎片 |
| 适用 | 长度固定:MD5(32)、UUID、手机号 | 长度不定:姓名、地址、标题 |

```sql
-- CHAR 的去空格行为
CREATE TABLE t (c CHAR(10), v VARCHAR(10));
INSERT INTO t VALUES ('abc   ', 'abc   ');
SELECT LENGTH(c), LENGTH(v);          -- 3, 6  (CHAR 尾部空格被裁掉)
SELECT c = 'abc', v = 'abc';          -- 1, 0
```

> **VARCHAR(n) 的 n 是字符数不是字节数**,utf8mb4 下一个字符最多占 4 字节。所以 `VARCHAR(255)` 在 utf8mb4 下最多可能占 1020 字节。
>
> **为什么大家都写 VARCHAR(255)?** 因为长度 ≤ 255 时长度前缀只需 1 字节,> 255 需 2 字节。但这只是 1 字节的差异,**应该按业务实际最大长度定**,不要盲目 255:`VARCHAR(20)` 存手机号、`VARCHAR(50)` 存用户名。
>
> **行大小上限 65535 字节**:一张表所有变长列的总长度受限。多个 `VARCHAR(20000)` 会报 `Row size too large`。

### TEXT 的使用纪律

1. **TEXT 列不能有默认值**(8.0.13 起可支持表达式默认值)
2. **TEXT 只能建前缀索引**:`CREATE INDEX idx ON t(content(20))`,无法建全列索引
3. **`SELECT *` 会把 TEXT 一起捞出来**,严重浪费网络与内存,务必显式列出需要的字段
4. InnoDB 中 TEXT/BLOB 超过约 768 字节的部分存到**溢出页**,只读前缀时不必访问溢出页
5. 频繁更新 TEXT 会产生碎片,必要时 `OPTIMIZE TABLE`

### ENUM 的利弊

```sql
CREATE TABLE user (
    gender ENUM('男','女','未知') NOT NULL DEFAULT '未知',
    status ENUM('待审核','正常','封禁') NOT NULL DEFAULT '待审核'
);

-- 内部按定义顺序的整数存储,可用数字访问
SELECT gender, gender + 0 FROM user;        -- '男', 1

-- 排序按内部序号,不是按字母/拼音!
SELECT * FROM user ORDER BY status;         -- 待审核 < 正常 < 封禁(定义顺序)
-- 想自定义排序:
SELECT * FROM user ORDER BY FIELD(status, '封禁', '待审核', '正常');
```

| 优点 | 缺点 |
| --- | --- |
| 只占 1~2 字节,省空间 | **加值要 ALTER TABLE**(末尾追加较快,中间插入要重建) |
| 可读性好,自带约束 | 排序按内部序号,容易写出错误结果 |
| 比 VARCHAR 快 | 跨语言/跨库迁移不便,应用层拿到的是字符串 |

> **实践建议:** 值集合稳定(性别、是否)可用 ENUM;值可能增加(订单状态、商品分类)用 `TINYINT + 代码里的枚举常量`,或 `VARCHAR(20) + 应用层校验`。这是国内互联网公司的普遍做法,便于扩展与统计。

## 2.4 日期时间类型

| 类型 | 字节 | 格式 | 范围 | 说明 |
| --- | --- | --- | --- | --- |
| `DATE` | 3 | YYYY-MM-DD | 1000-01-01 ~ 9999-12-31 | 只有日期 |
| `TIME` | 3 | HH:MM:SS[.fraction] | -838:59:59 ~ 838:59:59 | 只有时间,**可表示间隔**,所以能超 24 小时 |
| `YEAR` | 1 | YYYY | 1901 ~ 2155 | 年份,不建议用(范围窄、语义弱) |
| `DATETIME` | 5(+小数) | YYYY-MM-DD HH:MM:SS[.fraction] | 1000 ~ 9999 年 | **与时区无关**,存什么读什么 |
| `TIMESTAMP` | 4(+小数) | 同上 | **1970-01-01 ~ 2038-01-19 UTC** | 存 UTC 秒数,**随时区转换** |

### DATETIME vs TIMESTAMP(高频考点)

| 维度 | DATETIME | TIMESTAMP |
| --- | --- | --- |
| 存储 | 字面日期时间,5 字节 | UTC 秒数,4 字节 |
| 时区 | **不感知**,存 '2026-01-01 10:00:00' 读回一样 | **感知**,按 `time_zone` 会话变量转换显示 |
| 范围 | 1000~9999 年 | 1970~2038 年(**2038 问题**) |
| 自动更新 | 需显式定义 `ON UPDATE CURRENT_TIMESTAMP` | 同左,历史上默认行为更激进 |
| 索引 | 支持 | 支持 |
| 推荐 | **业务时间(创建时间、订单时间)** | 需要跨时区展示的场景 |

```sql
-- 时区差异演示
SET time_zone = '+08:00';
CREATE TABLE t (dt DATETIME, ts TIMESTAMP);
INSERT INTO t VALUES ('2026-01-01 10:00:00', '2026-01-01 10:00:00');
SELECT dt, ts FROM t;                     -- 都是 10:00:00

SET time_zone = '+00:00';
SELECT dt, ts FROM t;                     -- dt 仍是 10:00:00,ts 变成 02:00:00
```

> **2038 问题:** TIMESTAMP 用 4 字节有符号整数存秒数,上限是 `2038-01-19 03:14:07 UTC`。任何可能超过该日期的数据(保单到期日、长期合约)**必须用 DATETIME**。

### 小数秒精度

```sql
-- DATETIME(6) 存到微秒,TIMESTAMP(3) 存到毫秒
CREATE TABLE log (
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                            ON UPDATE CURRENT_TIMESTAMP(6)
);
```

| 精度 | 含义 | 额外字节 |
| --- | --- | --- |
| `(0)` | 秒(默认) | 0 |
| `(3)` | 毫秒 | 2 |
| `(6)` | 微秒 | 3 |

> Django 的 `DateTimeField` 映射到 MySQL 是 `DATETIME(6)`;Java 的 `LocalDateTime` 精度取决于列定义。**排序、去重、幂等键等对时间敏感的场景,精度不足会导致并列**,建议 `(3)` 或 `(6)`。

### 时间的最佳实践

1. **库里统一存 UTC**(或统一 `+08:00`,但必须全团队一致),展示层再转本地时区
2. MySQL 的 `time_zone` 默认是 `SYSTEM`,跟随操作系统;Django 的 `USE_TZ=True` 会自己存 UTC
3. **禁止用字符串存日期**(`VARCHAR` 存 '2026年1月1日'),无法做范围查询与日期运算
4. 建表标配两列:`created_at DATETIME DEFAULT CURRENT_TIMESTAMP`、`updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
5. 按时间范围查询的列**必须建索引**,并保证条件不对列做函数运算(见 [[后端/数据库/MySQL/索引与执行计划]])

## 2.5 JSON 与其他类型

### JSON(MySQL 5.7.8+)

```sql
CREATE TABLE product (
    id   INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    attrs JSON                        -- 规格、标签等半结构化数据
);

INSERT INTO product (name, attrs) VALUES
('iPhone 15', '{"color": "black", "size": 256, "tags": ["5G", "旗舰"]}'),
('MacBook',   '{"color": "silver", "size": 512, "tags": ["办公"]}');

-- 查询:-> 返回 JSON,->> 返回去引号的文本
SELECT name, attrs->'$.color' AS color_json, attrs->>'$.color' AS color_text
FROM product;

-- 条件过滤
SELECT * FROM product WHERE attrs->>'$.color' = 'black';
SELECT * FROM product WHERE JSON_CONTAINS(attrs->'$.tags', '"5G"');
SELECT * FROM product WHERE JSON_LENGTH(attrs->'$.tags') > 1;

-- 部分更新(8.0,就地修改不重写整个文档)
UPDATE product SET attrs = JSON_SET(attrs, '$.price', 5999) WHERE id = 1;
UPDATE product SET attrs = JSON_ARRAY_APPEND(attrs, '$.tags', '新品') WHERE id = 1;
UPDATE product SET attrs = JSON_REMOVE(attrs, '$.size') WHERE id = 1;

-- 提取多个字段
SELECT JSON_EXTRACT(attrs, '$.color', '$.size') FROM product;
SELECT JSON_KEYS(attrs), JSON_TYPE(attrs->'$.tags'), JSON_DEPTH(attrs) FROM product;

-- 数组展开成行(8.0,配合 JSON_TABLE)
SELECT p.name, t.tag
FROM product p,
     JSON_TABLE(p.attrs, '$.tags[*]' COLUMNS (tag VARCHAR(50) PATH '$')) AS t;
```

**JSON 列上建索引必须用"生成列"或"多值索引":**

```sql
-- 方式一:虚拟生成列 + 普通索引(5.7/8.0 通用)
ALTER TABLE product
  ADD COLUMN color VARCHAR(20) GENERATED ALWAYS AS (attrs->>'$.color') VIRTUAL,
  ADD INDEX idx_color (color);

-- 方式二:多值索引(8.0.17+,专为 JSON 数组)
ALTER TABLE product ADD INDEX idx_tags ((CAST(attrs->'$.tags' AS CHAR(50) ARRAY)));
SELECT * FROM product WHERE JSON_CONTAINS(attrs->'$.tags', '"5G"');   -- 可走多值索引
```

| JSON 列 vs VARCHAR 存 JSON 字符串 | |
| --- | --- |
| JSON 列 | 写入时校验格式、二进制存储解析快、支持路径查询与部分更新 |
| VARCHAR | 无校验、每次查询要重新解析、无法用 JSON 函数索引 |

> **什么时候用 JSON 列:** 字段稀疏且多变(用户扩展属性、商品规格、第三方回调原文)、只做整体读写或简单路径查询。
> **什么时候不要用:** 需要高频按该字段过滤/排序/join、需要强类型约束、需要参与事务一致性校验 —— 这些应当拆成真正的列。

### BIT

```sql
CREATE TABLE t (flags BIT(8));
INSERT INTO t VALUES (b'1010');
SELECT flags, flags + 0 FROM t;        -- 显示乱码,必须 +0 转数字查看
```

> **BIT 不建议使用:** 客户端显示为二进制字节易乱码、无法直观调试、跨驱动兼容性差。布尔值用 `TINYINT(1)`,多标志位用 `INT` + 位运算,可读性远好于 BIT。

### GEOMETRY(空间类型)

```sql
CREATE TABLE shop (
    id   INT PRIMARY KEY,
    name VARCHAR(50),
    loc  POINT NOT NULL SRID 4326,          -- 经纬度
    SPATIAL INDEX idx_loc (loc)              -- 空间索引(列必须 NOT NULL)
);

INSERT INTO shop VALUES (1, '店A', ST_SRID(POINT(116.40, 39.90), 4326));

-- 查 5 公里内的店(单位:米)
SELECT name, ST_Distance_Sphere(loc, ST_SRID(POINT(116.41, 39.91), 4326)) AS dist
FROM shop
WHERE ST_Distance_Sphere(loc, ST_SRID(POINT(116.41, 39.91), 4326)) < 5000;
```

> MySQL 的空间能力够用但不强,**LBS/地理围栏类业务优先考虑 PostgreSQL + PostGIS**(见 [[后端/数据库/PostgreSQL/PostgreSQL入门与安装配置]])。

## 2.6 类型选择决策清单

**核心原则:在满足业务的前提下,选最小的类型。** 更小的类型 = 更少的磁盘 IO + 更少的缓冲池占用 + 更快的比较运算。

| 数据 | 推荐类型 | 不要选 |
| --- | --- | --- |
| 主键 | `BIGINT UNSIGNED AUTO_INCREMENT` 或分布式 ID | 字符串主键(索引膨胀) |
| 金额 | `DECIMAL(10,2)` 或 `BIGINT`(存分) | FLOAT / DOUBLE |
| 状态、布尔 | `TINYINT` + 应用层枚举 | ENUM(难扩展)、VARCHAR |
| 手机号 | `CHAR(11)` 或 `VARCHAR(20)` | INT(丢前导 0、无法存 +86) |
| 用户名 | `VARCHAR(50)` | VARCHAR(255) |
| 邮箱 | `VARCHAR(100)` | CHAR(浪费) |
| 密码哈希 | `CHAR(60)`(bcrypt 固定长) | VARCHAR |
| MD5 | `CHAR(32)` | VARCHAR(32) |
| UUID | `CHAR(36)` 或 `BINARY(16)` | VARCHAR(255) |
| 文章正文 | `TEXT` / `MEDIUMTEXT` | VARCHAR(65535) |
| 创建时间 | `DATETIME` / `DATETIME(3)` | TIMESTAMP(2038)、VARCHAR |
| IP 地址 | `INT UNSIGNED` + `INET_ATON()` 或 `VARCHAR(45)`(含 IPv6) | 4 个 TINYINT |
| 扩展属性 | `JSON` | 一堆稀疏 VARCHAR 列 |
| URL | `VARCHAR(500)` 以上 | TEXT(无法建普通索引) |

```sql
-- IP 存为整数的用法(省空间、范围查询快)
SELECT INET_ATON('192.168.1.1');         -- 3232235777
SELECT INET_NTOA(3232235777);            -- '192.168.1.1'
-- 查一个 C 段
SELECT * FROM log WHERE ip BETWEEN INET_ATON('192.168.1.0') AND INET_ATON('192.168.1.255');
```

**类型选择的四个坑:**

1. **隐式类型转换导致索引失效**(最重要)

```sql
-- phone 是 VARCHAR
SELECT * FROM user WHERE phone = 13800138000;     -- ❌ 数字比较,索引失效全表扫
SELECT * FROM user WHERE phone = '13800138000';   -- ✅ 字符串比较,走索引
```

MySQL 的转换规则是**把字符串转成数字**,所以 VARCHAR 列用数字比较时,每一行都要做 `CAST(phone AS DOUBLE)`,索引彻底失效。反之,数字列用字符串比较通常还能走索引(常量侧被转换)。

2. **NULL 的传染性**

```sql
SELECT NULL + 1;                  -- NULL
SELECT NULL = NULL;               -- NULL(不是 true!)
SELECT COUNT(phone) FROM user;    -- 不计 NULL 行
SELECT COUNT(*) FROM user;        -- 计所有行
SELECT * FROM user WHERE phone != '123';   -- ❌ 不包含 phone 为 NULL 的行!
SELECT * FROM user WHERE phone != '123' OR phone IS NULL;   -- ✅
```

3. **字符集不一致导致 JOIN 无法用索引**:两表关联列一个是 `utf8mb4` 一个是 `utf8`(或排序规则不同),MySQL 会做转换,索引失效。建库建表统一 `utf8mb4 / utf8mb4_0900_ai_ci`。

4. **`ZEROFILL` 已废弃**(8.0.17+),不要用 `INT(6) ZEROFILL` 存编号,应在应用层格式化。

## 2.7 约束(Constraints)

```sql
CREATE TABLE `order` (
    id          BIGINT UNSIGNED AUTO_INCREMENT,
    order_no    CHAR(32)      NOT NULL COMMENT '订单号',
    user_id     BIGINT UNSIGNED NOT NULL,
    amount      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status      TINYINT       NOT NULL DEFAULT 0,
    remark      VARCHAR(500)  NULL DEFAULT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uk_order_no (order_no),
    KEY idx_user_created (user_id, created_at),
    CONSTRAINT chk_amount CHECK (amount >= 0),
    CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='订单表';
```

| 约束 | 关键字 | 作用 | 备注 |
| --- | --- | --- | --- |
| 主键 | `PRIMARY KEY` | 唯一标识一行,非空 + 唯一 | 一张表只能有一个;InnoDB 聚簇索引基于它 |
| 唯一 | `UNIQUE KEY` | 列值不重复 | **允许 NULL,且可多个 NULL**(NULL 不等于 NULL) |
| 非空 | `NOT NULL` | 不允许 NULL | 提升索引效率与查询确定性 |
| 默认值 | `DEFAULT` | 未指定时的值 | TEXT/BLOB 传统上不能有默认值 |
| 检查 | `CHECK (expr)` | 值必须满足条件 | **8.0.16 起才真正生效**,5.7 会解析但忽略! |
| 外键 | `FOREIGN KEY` | 引用完整性 | 性能与分库分表代价大,互联网公司普遍**不用** |
| 自动增长 | `AUTO_INCREMENT` | 自增序号 | 只能用于整数列,一表一个,通常配合主键 |

### 外键的取舍(高频争议点)

```sql
-- 创建外键
ALTER TABLE `order`
  ADD CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES user(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 删除外键(要先知道约束名)
ALTER TABLE `order` DROP FOREIGN KEY fk_order_user;
```

**ON DELETE / ON UPDATE 的行为:**

| 策略 | 含义 |
| --- | --- |
| `RESTRICT`(默认) | 有子记录时拒绝删除/更新父记录 |
| `CASCADE` | 级联删除/更新子记录 |
| `SET NULL` | 子记录的外键列置为 NULL(该列必须可空) |
| `NO ACTION` | 同 RESTRICT(标准 SQL 语义) |

| 外键的优点 | 外键的缺点 |
| --- | --- |
| 数据库层保证引用完整性,脏数据进不来 | **每次写操作都要检查父表**,增加开销与锁 |
| 语义清晰,新人看表结构就懂关系 | **分库分表后外键无法跨库生效** |
| CASCADE 省去手写级联逻辑 | 影响并发:父行被锁时子表写入阻塞 |
| | 数据迁移、批量导入、清理历史数据时处处受限 |

> **主流互联网实践:不使用数据库外键**,改为在应用层(服务/ORM)维护关系 + 定期数据一致性校验任务。阿里《Java 开发手册》明确规定"不得使用外键与级联"。
> **企业内部系统、数据量小、正确性优先**的场景可以用外键,让数据库兜底。
> Django ORM 的 `ForeignKey` 默认会生成外键约束,可通过 `db_constraint=False` 关闭。

### CHECK 约束的版本陷阱

```sql
-- 5.7:语法能过,但约束被静默忽略(只解析不执行)
-- 8.0.16+:真正生效
ALTER TABLE `order` ADD CONSTRAINT chk_status CHECK (status IN (0,1,2,3));

-- 8.0 中查看
SELECT * FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='mydb';

-- 违反时报错
INSERT INTO `order` (order_no, user_id, status) VALUES ('x', 1, 9);
-- ERROR 3819 (HY000): Check constraint 'chk_status' is violated.
```

> 用 8.0 之前的版本时,CHECK 只能靠触发器或应用层校验实现,写 `CHECK` 会给人虚假的安全感。

## 2.8 DDL:建库建表改表

### 数据库操作

```sql
-- 建库(必须指定字符集与排序规则)
CREATE DATABASE IF NOT EXISTS mydb
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_0900_ai_ci;

-- 查看
SHOW DATABASES;
SHOW CREATE DATABASE mydb;
SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA;

-- 切换与修改
USE mydb;
ALTER DATABASE mydb DEFAULT CHARACTER SET utf8mb4;

-- 删库(不可逆!生产环境需二次确认)
DROP DATABASE IF EXISTS mydb;
```

**字符集与排序规则:**

| 概念 | 说明 |
| --- | --- |
| `CHARACTER SET` | 字符如何编码为字节。`utf8mb4` = 完整 UTF-8(1~4 字节) |
| `COLLATE` | 字符如何**比较与排序**。后缀 `_ci` = case insensitive(不区分大小写),`_cs` = 区分,`_bin` = 按二进制 |

| 常用排序规则 | 特点 |
| --- | --- |
| `utf8mb4_0900_ai_ci` | **8.0 默认**,基于 Unicode 9.0,`ai` = 重音不敏感,速度快 |
| `utf8mb4_general_ci` | 5.7 常用,比较规则简单但不完全符合 Unicode 标准 |
| `utf8mb4_unicode_ci` | 遵循 Unicode 标准,多语言排序更准,略慢 |
| `utf8mb4_bin` | 按字节比较,**区分大小写**,密码、token 类字段可用 |

> **`utf8` 是 `utf8mb3` 的别名,最多 3 字节,存不了 emoji 和部分汉字!** 全项目必须统一 `utf8mb4`。混用会导致 `Incorrect string value: '\xF0\x9F...'` 报错,或 JOIN 时索引失效。

### 建表

```sql
CREATE TABLE IF NOT EXISTS user (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    username   VARCHAR(50)  NOT NULL COMMENT '用户名',
    email      VARCHAR(100) NOT NULL DEFAULT '' COMMENT '邮箱',
    password   CHAR(60)     NOT NULL COMMENT 'bcrypt 哈希',
    status     TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常 0禁用',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_username (username),
    KEY idx_email (email),
    KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='用户表';
```

**建表的关键选项:**

| 选项 | 作用 |
| --- | --- |
| `ENGINE=InnoDB` | 存储引擎,必写 |
| `DEFAULT CHARSET=utf8mb4` | 表级字符集 |
| `COLLATE=...` | 表级排序规则 |
| `COMMENT='表说明'` | 表注释(强烈推荐,后人感激你) |
| `AUTO_INCREMENT=10000` | 自增起始值 |
| `ROW_FORMAT=DYNAMIC` | 行格式(8.0 默认 DYNAMIC,TEXT 全行外存储) |
| `PARTITION BY ...` | 分区(见 [[后端/数据库/MySQL/分库分表与高可用]]) |

### 查看表结构

```sql
DESC user;                             -- 简表:字段、类型、Null、Key、Default、Extra
DESCRIBE user;                         -- 同上
SHOW COLUMNS FROM user;                -- 同上
SHOW FULL COLUMNS FROM user;           -- 多了 Collation、Comment、Privileges
SHOW CREATE TABLE user\G               -- 完整建表语句(最常用,含索引与选项)
SHOW TABLE STATUS LIKE 'user'\G        -- 行数估算、数据/索引大小、引擎、字符集
SHOW INDEX FROM user;                  -- 索引详情

-- 从元数据库精确查询
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='user'
ORDER BY ORDINAL_POSITION;
```

### 修改表(ALTER TABLE)

```sql
-- 增列
ALTER TABLE user ADD COLUMN nickname VARCHAR(50) NOT NULL DEFAULT '' COMMENT '昵称';
ALTER TABLE user ADD COLUMN age TINYINT AFTER status;            -- 指定位置
ALTER TABLE user ADD COLUMN vip_level INT FIRST;                 -- 放最前

-- 改列类型(MODIFY 不改名,CHANGE 可改名)
ALTER TABLE user MODIFY COLUMN nickname VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE user CHANGE COLUMN nickname nick_name VARCHAR(100) NOT NULL;

-- 删列
ALTER TABLE user DROP COLUMN vip_level;

-- 改默认值(只影响之后的插入,不改已有数据)
ALTER TABLE user ALTER COLUMN status SET DEFAULT 0;
ALTER TABLE user ALTER COLUMN status DROP DEFAULT;

-- 索引操作
ALTER TABLE user ADD UNIQUE KEY uk_email (email);
ALTER TABLE user ADD KEY idx_created (created_at);
ALTER TABLE user DROP KEY idx_created;
ALTER TABLE user RENAME KEY idx_email TO idx_email_new;          -- 8.0

-- 改表属性
ALTER TABLE user COMMENT = '用户主表';
ALTER TABLE user ENGINE = InnoDB;                                -- 重建表(可用于整理碎片)
ALTER TABLE user AUTO_INCREMENT = 100000;
ALTER TABLE user DEFAULT CHARSET = utf8mb4;

-- 重命名表
RENAME TABLE user TO sys_user;
ALTER TABLE user RENAME TO sys_user;

-- 一次改多项(推荐,只重建一次表)
ALTER TABLE user
    ADD COLUMN phone VARCHAR(20) NOT NULL DEFAULT '',
    ADD KEY idx_phone (phone),
    DROP COLUMN age;
```

> **DDL 是危险操作。** 大表 `ALTER` 可能锁表几分钟到几小时,导致业务雪崩。
> - 8.0 支持 **INSTANT ADD COLUMN**(在表末尾加列瞬间完成,不重建表):`ALTER TABLE user ADD COLUMN x INT, ALGORITHM=INSTANT;`
> - 改类型、改字符集、加索引在中间位置等仍需 **INPLACE 或 COPY**,大表用 **gh-ost / pt-online-schema-change** 在线变更
> - 生产变更纪律:低峰期执行、先在从库验证、有回滚方案、监控主从延迟

```sql
-- 查看某条 ALTER 会用什么算法
ALTER TABLE user ADD COLUMN x INT, ALGORITHM=INSTANT;    -- 不支持则直接报错,不会退化成锁表
ALTER TABLE user ADD INDEX idx_x (x), ALGORITHM=INPLACE, LOCK=NONE;   -- 在线加索引
```

| ALGORITHM | 含义 | 影响 |
| --- | --- | --- |
| `INSTANT` | 只改元数据 | 秒级完成,不锁表(8.0,仅限部分操作) |
| `INPLACE` | 在原表上操作 | 多数情况不阻塞 DML,可能耗时长 |
| `COPY` | 建临时表全量拷贝 | **阻塞写**,大表灾难 |

### 清空与删除表

| 语句 | 类型 | 速度 | 自增重置 | 可回滚 | 触发器 | WHERE |
| --- | --- | --- | --- | --- | --- | --- |
| `DELETE FROM t` | DML | 慢(逐行) | 不重置 | **可**(事务内) | 触发 | 支持 |
| `TRUNCATE TABLE t` | DDL | 快(重建) | **重置为 1** | 不可 | 不触发 | 不支持 |
| `DROP TABLE t` | DDL | 快 | — | 不可 | — | — |

```sql
DELETE FROM log WHERE created_at < '2025-01-01';   -- 有条件删,走事务
TRUNCATE TABLE temp_result;                        -- 清空临时表
DROP TABLE IF EXISTS temp_result;                  -- 连表结构一起删
```

> **生产删数据的正确姿势:** ① 先 `SELECT COUNT(*)` 确认范围 → ② 事务内小批量 `DELETE ... LIMIT 1000` 循环,避免长事务和大 undo → ③ 大批量清理用"建新表 + 重命名交换" → ④ 一定要有备份和 binlog 兜底。
> `DELETE FROM t`(不带 where)在大表上会产生巨大的 undo log 和主从延迟,不如 `TRUNCATE`。

## 2.9 表设计与范式

### 三大范式

| 范式 | 要求 | 通俗解释 | 反例 |
| --- | --- | --- | --- |
| **1NF** 原子性 | 每列不可再分 | 一个单元格只存一个值 | `phone` 列存 "138xxx,139xxx" |
| **2NF** 完全依赖 | 非主键列完全依赖整个主键 | 联合主键时,不能只依赖其中一部分 | 主键(order_id, product_id) 里存 product_name(只依赖 product_id) |
| **3NF** 无传递依赖 | 非主键列不能依赖其他非主键列 | 派生数据不存 | 表里同时存 `price`、`count`、`total`(total = price × count) |

```sql
-- ❌ 违反 1NF:多值塞一列
CREATE TABLE bad1 (id INT, tags VARCHAR(200));   -- 'java,mysql,redis'

-- ✅ 拆成关联表
CREATE TABLE good1 (id INT);
CREATE TABLE tag (id INT, name VARCHAR(50));
CREATE TABLE item_tag (item_id INT, tag_id INT, PRIMARY KEY(item_id, tag_id));

-- ❌ 违反 3NF:冗余派生字段 + 冗余关联属性
CREATE TABLE bad3 (
    order_id INT PRIMARY KEY,
    user_id  INT,
    user_name VARCHAR(50),      -- 依赖 user_id,传递依赖
    price DECIMAL(10,2), qty INT, total DECIMAL(10,2)   -- total 可计算得出
);

-- ✅ 只存事实
CREATE TABLE good3 (
    order_id INT PRIMARY KEY,
    user_id  INT,
    price DECIMAL(10,2), qty INT
    -- user_name 查 user 表;total 在视图或查询里算
);
```

### 反范式:什么时候故意冗余

范式化减少冗余但增加 JOIN;互联网高并发场景**读多写多、JOIN 代价高**,常常主动反范式:

| 反范式手段 | 场景 | 代价 |
| --- | --- | --- |
| **冗余字段** | 订单表存 `user_name`、`product_title` 快照 | 用户改名后订单里仍是下单时的名字(**这正是业务需要的**) |
| **冗余统计值** | 商品表存 `sale_count`、`view_count` | 需要保证与明细表最终一致(定时任务对账) |
| **合并表** | 把 1:1 扩展表合进主表 | 表变宽,行溢出风险 |
| **预计算表** | 日/月报表汇总表 | 需要额外的生成任务 |
| **增加派生列 + 索引** | `total_score` 生成列 | 写入开销 |

```sql
-- 生成列(5.7+):自动计算,可建索引,是优雅的"受控冗余"
ALTER TABLE order_value
  ADD COLUMN total_score DECIMAL(3,1)
      GENERATED ALWAYS AS (content_score + level_score + logic_score) VIRTUAL,
  ADD INDEX idx_total_score (total_score);

-- VIRTUAL:查询时计算,不占存储(8.0 可建索引)
-- STORED:写入时计算并存储,占空间但读更快
```

**设计决策原则:**

1. **先范式化设计,再用性能数据驱动反范式**,不要一上来就冗余
2. **冗余的是"历史快照"时最安全**(订单里的商品名、价格)
3. **冗余统计值必须有一致性保障**:原子更新(`UPDATE ... SET cnt = cnt + 1`)+ 定时对账任务
4. **高频列表查询避免 3 表以上 JOIN**,可以在写入时就把展示字段冗余进去

### 常见表设计模式

```sql
-- 1. 软删除(不真删,加标记)
ALTER TABLE user ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
-- 查询时:WHERE deleted_at IS NULL;并建索引 (deleted_at, ...)
-- 优点:可恢复、可审计;缺点:唯一索引会冲突(同名用户删了再建)

-- 唯一索引冲突的解法:唯一键里带上 deleted_at 或用"删除时改写唯一列"
ALTER TABLE user ADD UNIQUE KEY uk_username_deleted (username, deleted_at);

-- 2. 乐观锁(版本号)
ALTER TABLE product ADD COLUMN version INT NOT NULL DEFAULT 0;
UPDATE product SET stock = stock - 1, version = version + 1
WHERE id = 1 AND version = 5;        -- 影响行数为 0 说明被别人改过,重试

-- 3. 审计字段(几乎所有业务表标配)
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
created_by BIGINT NULL,
updated_by BIGINT NULL,
deleted_at DATETIME NULL

-- 4. 多对多中间表(联合主键 + 双向索引)
CREATE TABLE user_role (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),      -- 天然去重 + 覆盖"按用户查角色"
    KEY idx_role_user (role_id, user_id)  -- 覆盖"按角色查用户"
) ENGINE=InnoDB;

-- 5. 分区表(大表按时间切分)
CREATE TABLE access_log (
    id BIGINT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id, created_at)          -- 分区键必须是主键的一部分
) PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION pmax  VALUES LESS THAN MAXVALUE
);
```

## 2.10 命名规范

| 对象 | 规则 | 示例 |
| --- | --- | --- |
| 库名 | 小写 + 下划线,与业务线对应 | `shop_order`、`user_center` |
| 表名 | 小写 + 下划线,**单数**,模块前缀 | `user`、`order_item`、`sys_config` |
| 字段名 | 小写 + 下划线,见名知意 | `created_at`、`user_id`、`is_deleted` |
| 主键 | `id`(BIGINT UNSIGNED AUTO_INCREMENT) | — |
| 外键列 | `关联表单数_id` | `user_id`、`order_id` |
| 唯一索引 | `uk_字段名` | `uk_order_no` |
| 普通索引 | `idx_字段名` | `idx_user_created` |
| 联合索引 | `idx_字段1_字段2` | `idx_status_created` |
| 布尔字段 | `is_` / `has_` 前缀,TINYINT | `is_active`、`has_paid` |
| 时间字段 | `_at` 或 `_time` 后缀,全库统一 | `created_at`、`pay_time` |

**规范纪律:**

1. **禁用 MySQL 保留字**做名字:`order`、`desc`、`key`、`status`(部分版本)、`group`、`rank`(8.0 新增)、`system`。必须用时加反引号 `` `order` ``,但最好直接改名 `orders`
2. **名字不超过 32 字符**(MySQL 标识符上限 64,但团队约定更短)
3. **不使用拼音、拼音缩写、中英混合**;统一英文,`user_name` 而不是 `yhm`
4. **表名大小写**:Linux 下表名默认区分大小写(`lower_case_table_names=0`),Windows/macOS 不区分。**统一用小写**避免迁移后找不到表
5. **每个表和每个字段都写 COMMENT**,这是最低成本的文档

```sql
-- 查看保留字
SELECT * FROM information_schema.KEYWORDS WHERE RESERVED = 'Y';   -- 8.0
```

## 2.11 常见问题与最佳实践

1. **金额用 `DECIMAL` 或 `BIGINT`(分),永远不用 FLOAT/DOUBLE**
2. **字符集全库统一 `utf8mb4`**,`utf8` 存不了 emoji 是经典线上事故
3. **时间用 `DATETIME`**,除非明确需要跨时区自动转换才用 `TIMESTAMP`(2038 问题)
4. **主键用自增 `BIGINT` 或分布式 ID**,不用 UUID 字符串主键(索引膨胀、随机写打散页)
5. **每表必备**:`id`、`created_at`、`updated_at`,按需 `deleted_at`、`version`
6. **VARCHAR 按实际最大长度定**,别一律 255;定长数据用 CHAR
7. **TEXT/BLOB 单独考虑**:不要 `SELECT *`,只建前缀索引
8. **不用数据库外键**(互联网实践),关系在应用层维护 + 定期对账
9. **状态字段用 TINYINT + 应用层枚举**,不用 ENUM(难扩展、排序诡异)
10. **DDL 变更评估锁表风险**:大表用 gh-ost / pt-osc,8.0 优先 `ALGORITHM=INSTANT`
11. **所有表和字段写 COMMENT**,表名避开保留字
12. **反范式要有代价意识**:冗余字段可以,冗余统计值必须有一致性保障

---

## 本章小结

- 类型选择第一原则:**够用且最小**。小类型 = 少 IO + 少内存 + 快比较
- 金额 `DECIMAL`,布尔 `TINYINT(1)`,时间 `DATETIME`,定长哈希 `CHAR(n)`,变长 `VARCHAR(实际长度)`
- `utf8mb4` 才是完整 UTF-8;`INT(11)` 的 11 是显示宽度不是长度限制,8.0 已废弃
- `DATETIME` 不感知时区、范围到 9999 年;`TIMESTAMP` 感知时区、2038 年溢出
- 隐式类型转换(VARCHAR 列用数字比较)是索引失效的头号原因
- 约束:主键/唯一/非空/默认/CHECK(8.0.16+ 才生效)/外键(互联网实践不用)
- 三大范式减少冗余,反范式(冗余快照、冗余统计、生成列)换查询性能,要靠数据驱动决策
- 命名:小写下划线、`uk_`/`idx_` 前缀、避开保留字、表字段都写 COMMENT
