---
title: "PostgreSQL SQL基础与查询"
aliases:
  - "PostgreSQL SQL"
  - "PostgreSQL查询"
tags:
  - "后端"
  - "数据库"
  - "postgresql"
  - "sql"
  - "笔记"
category: "后端"
folder: "PostgreSQL"
parent: "[[目录]]"
related:
  - "[[后端/数据库/PostgreSQL/PostgreSQL入门与安装配置]]"
  - "[[后端/数据库/PostgreSQL/PostgreSQL数据类型与表设计]]"
  - "[[后端/数据库/PostgreSQL/PostgreSQL高级特性]]"
  - "[[后端/数据库/MySQL/SQL基础与查询]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 03 PostgreSQL SQL 基础与查询

本章介绍 PostgreSQL 的 SQL 语法，包括基础查询、JOIN、子查询、聚合、窗口函数等。PostgreSQL 高度遵循 SQL 标准，许多语法与 MySQL 相似，但也有一些独特特性。

## 3.1 基础查询

### 3.1.1 SELECT 语句

```sql
-- 基本查询
SELECT * FROM users;

-- 选择特定列
SELECT id, name, email FROM users;

-- 使用别名
SELECT id, name AS user_name, email AS user_email FROM users;

-- 表达式
SELECT name, age + 1 AS next_year_age FROM users;

-- DISTINCT 去重
SELECT DISTINCT city FROM users;

-- LIMIT 和 OFFSET
SELECT * FROM users LIMIT 10;
SELECT * FROM users LIMIT 10 OFFSET 20;

-- PostgreSQL 特有的 LIMIT 语法
SELECT * FROM users FETCH FIRST 10 ROWS ONLY;
SELECT * FROM users OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY;
```

### 3.1.2 WHERE 条件

```sql
-- 比较操作符
SELECT * FROM users WHERE age > 18;
SELECT * FROM users WHERE age >= 18 AND age <= 65;
SELECT * FROM users WHERE age BETWEEN 18 AND 65;  -- 等价

-- NULL 判断
SELECT * FROM users WHERE email IS NULL;
SELECT * FROM users WHERE email IS NOT NULL;

-- IN 列表
SELECT * FROM users WHERE city IN ('北京', '上海', '广州');

-- LIKE 模式匹配
SELECT * FROM users WHERE name LIKE '张%';      -- 以"张"开头
SELECT * FROM users WHERE name LIKE '%明';      -- 以"明"结尾
SELECT * FROM users WHERE name LIKE '%小%';     -- 包含"小"
SELECT * FROM users WHERE name LIKE '张_';      -- "张"后跟一个字符

-- ILIKE（大小写不敏感，PostgreSQL 特有）
SELECT * FROM users WHERE email ILIKE '%GMAIL.COM';

-- 正则表达式
SELECT * FROM users WHERE email ~ '^[a-z]+@gmail\.com$';  -- 匹配正则
SELECT * FROM users WHERE email ~* '^[A-Z]+@GMAIL\.COM$'; -- 大小写不敏感

-- 数组包含
SELECT * FROM users WHERE 'admin' = ANY(roles);  -- roles 是数组
SELECT * FROM users WHERE roles @> ARRAY['admin'];

-- JSONB 查询
SELECT * FROM users WHERE attributes @> '{"verified": true}';
SELECT * FROM users WHERE attributes->>'city' = '北京';
```

### 3.1.3 ORDER BY 排序

```sql
-- 单列排序
SELECT * FROM users ORDER BY created_at DESC;

-- 多列排序
SELECT * FROM users ORDER BY city ASC, age DESC;

-- 使用列位置
SELECT id, name, age FROM users ORDER BY 3 DESC;  -- 按第 3 列排序

-- NULL 排序（PostgreSQL 特有）
SELECT * FROM users ORDER BY last_login NULLS FIRST;
SELECT * FROM users ORDER BY last_login NULLS LAST;

-- 自定义排序
SELECT * FROM users ORDER BY
    CASE status
        WHEN 'active' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'inactive' THEN 3
    END;
```

## 3.2 数据操作（DML）

### 3.2.1 INSERT

```sql
-- 插入单行
INSERT INTO users (name, email, age) VALUES ('张三', 'zhangsan@example.com', 25);

-- 插入多行
INSERT INTO users (name, email, age) VALUES
    ('李四', 'lisi@example.com', 30),
    ('王五', 'wangwu@example.com', 28);

-- 插入并返回（RETURNING，PostgreSQL 特有）
INSERT INTO users (name, email, age)
VALUES ('赵六', 'zhaoliu@example.com', 35)
RETURNING id, name, created_at;

-- 从查询结果插入
INSERT INTO users_backup (name, email, age)
SELECT name, email, age FROM users WHERE city = '北京';

-- ON CONFLICT（UPSERT，PostgreSQL 9.5+）
INSERT INTO users (email, name, age)
VALUES ('test@example.com', 'Test', 20)
ON CONFLICT (email) DO NOTHING;  -- 冲突时不操作

INSERT INTO users (email, name, age)
VALUES ('test@example.com', 'Test Updated', 21)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    age = EXCLUDED.age,
    updated_at = NOW();
```

### 3.2.2 UPDATE

```sql
-- 基本更新
UPDATE users SET age = 26 WHERE id = 1;

-- 更新多列
UPDATE users SET
    age = 26,
    city = '上海',
    updated_at = NOW()
WHERE id = 1;

-- 使用表达式
UPDATE products SET price = price * 1.1;  -- 涨价 10%

-- 从其他表更新
UPDATE orders o
SET status = 'completed'
FROM payments p
WHERE o.id = p.order_id AND p.status = 'paid';

-- 更新并返回
UPDATE users SET age = age + 1 WHERE id = 1
RETURNING id, name, age;

-- 使用 CTE 更新
WITH old_users AS (
    SELECT id FROM users WHERE last_login < NOW() - INTERVAL '1 year'
)
UPDATE users SET status = 'inactive'
WHERE id IN (SELECT id FROM old_users);
```

### 3.2.3 DELETE

```sql
-- 基本删除
DELETE FROM users WHERE id = 1;

-- 删除并返回
DELETE FROM users WHERE id = 1
RETURNING id, name, email;

-- 从其他表删除
DELETE FROM orders o
USING users u
WHERE o.user_id = u.id AND u.status = 'deleted';

-- TRUNCATE（快速清空表）
TRUNCATE TABLE logs;
TRUNCATE TABLE logs RESTART IDENTITY;  -- 重置序列
TRUNCATE TABLE logs CASCADE;           -- 级联删除依赖表
```

## 3.3 JOIN 连接

### 3.3.1 内连接（INNER JOIN）

```sql
-- 基本内连接
SELECT u.name, o.order_id, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id;

-- 多表连接
SELECT u.name, o.order_id, p.product_name, oi.quantity
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id;

-- USING 简化（列名相同时）
SELECT u.name, o.order_id
FROM users u
JOIN orders o USING (user_id);  -- 等价于 ON u.user_id = o.user_id

-- NATURAL JOIN（自动匹配同名列，不推荐）
SELECT * FROM users NATURAL JOIN orders;
```

### 3.3.2 外连接（OUTER JOIN）

```sql
-- LEFT JOIN（保留左表所有行）
SELECT u.name, o.order_id
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;

-- RIGHT JOIN（保留右表所有行）
SELECT u.name, o.order_id
FROM users u
RIGHT JOIN orders o ON u.id = o.user_id;

-- FULL OUTER JOIN（保留两表所有行）
SELECT u.name, o.order_id
FROM users u
FULL OUTER JOIN orders o ON u.id = o.user_id;

-- 查找没有订单的用户
SELECT u.name
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.id IS NULL;
```

### 3.3.3 交叉连接（CROSS JOIN）

```sql
-- 笛卡尔积
SELECT u.name, p.product_name
FROM users u
CROSS JOIN products p;

-- 等价写法
SELECT u.name, p.product_name
FROM users u, products p;
```

### 3.3.4 自连接（Self JOIN）

```sql
-- 查询员工及其经理
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;

-- 查询同一城市的用户对
SELECT u1.name AS user1, u2.name AS user2, u1.city
FROM users u1
JOIN users u2 ON u1.city = u2.city AND u1.id < u2.id;
```

## 3.4 聚合与分组

### 3.4.1 聚合函数

```sql
-- COUNT
SELECT COUNT(*) FROM users;                    -- 总行数
SELECT COUNT(email) FROM users;                -- 非 NULL 的 email 数
SELECT COUNT(DISTINCT city) FROM users;        -- 不同城市数

-- SUM、AVG、MIN、MAX
SELECT SUM(amount) FROM orders;
SELECT AVG(age) FROM users;
SELECT MIN(price), MAX(price) FROM products;

-- 数组聚合
SELECT array_agg(name) FROM users WHERE city = '北京';
-- {张三,李四,王五}

-- JSON 聚合
SELECT jsonb_agg(name) FROM users WHERE city = '北京';
-- ["张三", "李四", "王五"]

SELECT jsonb_object_agg(name, age) FROM users WHERE city = '北京';
-- {"张三": 25, "李四": 30, "王五": 28}

-- 字符串聚合
SELECT string_agg(name, ', ') FROM users WHERE city = '北京';
-- '张三, 李四, 王五'

-- 布尔聚合
SELECT bool_and(is_active) FROM users;   -- 所有用户都活跃？
SELECT bool_or(is_admin) FROM users;     -- 有管理员吗？
```

### 3.4.2 GROUP BY 分组

```sql
-- 基本分组
SELECT city, COUNT(*) AS user_count
FROM users
GROUP BY city;

-- 多列分组
SELECT city, status, COUNT(*)
FROM users
GROUP BY city, status;

-- HAVING 过滤分组
SELECT city, COUNT(*) AS user_count
FROM users
GROUP BY city
HAVING COUNT(*) > 100;

-- 分组后排序
SELECT city, COUNT(*) AS user_count
FROM users
GROUP BY city
ORDER BY user_count DESC
LIMIT 10;

-- ROLLUP（小计和总计）
SELECT city, status, COUNT(*)
FROM users
GROUP BY ROLLUP (city, status);
-- 包含：(city, status)、(city, NULL)、(NULL, NULL) 的聚合

-- CUBE（所有组合）
SELECT city, status, COUNT(*)
FROM users
GROUP BY CUBE (city, status);
-- 包含所有可能的组合

-- GROUPING SETS（自定义分组集合）
SELECT city, status, COUNT(*)
FROM users
GROUP BY GROUPING SETS (
    (city, status),
    (city),
    ()
);
```

## 3.5 子查询

### 3.5.1 标量子查询

```sql
-- 在 SELECT 中
SELECT name,
       age,
       (SELECT AVG(age) FROM users) AS avg_age
FROM users;

-- 在 WHERE 中
SELECT * FROM users
WHERE age > (SELECT AVG(age) FROM users);
```

### 3.5.2 行子查询

```sql
-- 单行单列
SELECT * FROM users
WHERE id = (SELECT user_id FROM orders WHERE order_id = 1001);

-- 单行多列
SELECT * FROM users
WHERE (city, age) = (SELECT city, age FROM users WHERE id = 1);
```

### 3.5.3 表子查询

```sql
-- IN 子查询
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders WHERE total > 1000);

-- NOT IN
SELECT * FROM users
WHERE id NOT IN (SELECT user_id FROM orders);

-- EXISTS
SELECT * FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);

-- NOT EXISTS
SELECT * FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);

-- ANY / ALL
SELECT * FROM products
WHERE price > ALL (SELECT price FROM products WHERE category = 'books');

SELECT * FROM users
WHERE age = ANY (SELECT age FROM users WHERE city = '北京');
```

### 3.5.4 FROM 子查询（派生表）

```sql
-- 基本用法
SELECT city, avg_age
FROM (
    SELECT city, AVG(age) AS avg_age
    FROM users
    GROUP BY city
) AS city_stats
WHERE avg_age > 30;

-- 多个派生表
SELECT cs.city, cs.user_count, os.order_total
FROM (
    SELECT city, COUNT(*) AS user_count
    FROM users
    GROUP BY city
) cs
JOIN (
    SELECT u.city, SUM(o.total) AS order_total
    FROM users u
    JOIN orders o ON u.id = o.user_id
    GROUP BY u.city
) os ON cs.city = os.city;
```

## 3.6 公用表表达式（CTE）

### 3.6.1 基本 CTE

```sql
-- 基本 CTE
WITH active_users AS (
    SELECT id, name, email
    FROM users
    WHERE status = 'active'
)
SELECT * FROM active_users;

-- 多个 CTE
WITH
    active_users AS (
        SELECT id, name FROM users WHERE status = 'active'
    ),
    user_orders AS (
        SELECT user_id, SUM(total) AS total_spent
        FROM orders
        GROUP BY user_id
    )
SELECT au.name, uo.total_spent
FROM active_users au
JOIN user_orders uo ON au.id = uo.user_id;

-- CTE 中引用其他 CTE
WITH
    high_value_customers AS (
        SELECT user_id, SUM(total) AS total_spent
        FROM orders
        GROUP BY user_id
        HAVING SUM(total) > 10000
    ),
    customer_details AS (
        SELECT u.name, u.email, hvc.total_spent
        FROM users u
        JOIN high_value_customers hvc ON u.id = hvc.user_id
    )
SELECT * FROM customer_details;
```

### 3.6.2 递归 CTE

```sql
-- 组织架构树
WITH RECURSIVE org_tree AS (
    -- 基础查询：顶级节点
    SELECT id, name, manager_id, 1 AS level
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- 递归查询：子节点
    SELECT e.id, e.name, e.manager_id, ot.level + 1
    FROM employees e
    JOIN org_tree ot ON e.manager_id = ot.id
)
SELECT * FROM org_tree ORDER BY level, name;

-- 生成序列
WITH RECURSIVE numbers AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM numbers WHERE n < 10
)
SELECT * FROM numbers;

-- 生成日期序列
WITH RECURSIVE dates AS (
    SELECT CURRENT_DATE AS date
    UNION ALL
    SELECT date + 1 FROM dates WHERE date < CURRENT_DATE + 30
)
SELECT * FROM dates;

-- 查找所有子分类
WITH RECURSIVE category_tree AS (
    SELECT id, name, parent_id, 1 AS level
    FROM categories
    WHERE id = 1  -- 从 ID=1 的分类开始

    UNION ALL

    SELECT c.id, c.name, c.parent_id, ct.level + 1
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree;
```

## 3.7 窗口函数

### 3.7.1 基本窗口函数

```sql
-- ROW_NUMBER()
SELECT name, department, salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC) AS rank
FROM employees;

-- RANK()（相同值相同排名，跳号）
SELECT name, department, salary,
       RANK() OVER (ORDER BY salary DESC) AS rank
FROM employees;

-- DENSE_RANK()（相同值相同排名，不跳号）
SELECT name, department, salary,
       DENSE_RANK() OVER (ORDER BY salary DESC) AS rank
FROM employees;

-- NTILE()（分桶）
SELECT name, salary,
       NTILE(4) OVER (ORDER BY salary DESC) AS quartile
FROM employees;
```

### 3.7.2 PARTITION BY 分组

```sql
-- 每个部门内的排名
SELECT name, department, salary,
       ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank
FROM employees;

-- 每个部门内薪资占比
SELECT name, department, salary,
       salary / SUM(salary) OVER (PARTITION BY department) AS dept_ratio
FROM employees;
```

### 3.7.3 聚合窗口函数

```sql
-- 累计求和
SELECT order_date, amount,
       SUM(amount) OVER (ORDER BY order_date) AS running_total
FROM orders;

-- 移动平均
SELECT order_date, amount,
       AVG(amount) OVER (
           ORDER BY order_date
           ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
       ) AS moving_avg_7days
FROM orders;

-- 分区内的聚合
SELECT name, department, salary,
       AVG(salary) OVER (PARTITION BY department) AS dept_avg,
       MAX(salary) OVER (PARTITION BY department) AS dept_max
FROM employees;
```

### 3.7.4 偏移窗口函数

```sql
-- LAG()（前一行）
SELECT order_date, amount,
       LAG(amount, 1) OVER (ORDER BY order_date) AS prev_amount,
       amount - LAG(amount, 1) OVER (ORDER BY order_date) AS diff
FROM orders;

-- LEAD()（后一行）
SELECT order_date, amount,
       LEAD(amount, 1) OVER (ORDER BY order_date) AS next_amount
FROM orders;

-- FIRST_VALUE() / LAST_VALUE()
SELECT name, department, salary,
       FIRST_VALUE(salary) OVER (PARTITION BY department ORDER BY salary DESC) AS highest_salary,
       LAST_VALUE(salary) OVER (
           PARTITION BY department
           ORDER BY salary
           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
       ) AS lowest_salary
FROM employees;

-- NTH_VALUE()
SELECT name, department, salary,
       NTH_VALUE(salary, 2) OVER (PARTITION BY department ORDER BY salary DESC) AS second_highest
FROM employees;
```

### 3.7.5 窗口框架

```sql
-- ROWS（行范围）
SELECT order_date, amount,
       SUM(amount) OVER (
           ORDER BY order_date
           ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING
       ) AS sum_5rows
FROM orders;

-- RANGE（值范围）
SELECT order_date, amount,
       SUM(amount) OVER (
           ORDER BY order_date
           RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW
       ) AS sum_7days
FROM orders;

-- GROUPS（组范围）
SELECT order_date, amount,
       SUM(amount) OVER (
           ORDER BY order_date
           GROUPS BETWEEN 1 PRECEDING AND 1 FOLLOWING
       ) AS sum_3groups
FROM orders;

-- 默认框架
-- ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW（聚合函数）
-- RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW（排名函数）
```

## 3.8 集合操作

### 3.8.1 UNION

```sql
-- UNION（去重）
SELECT name, email FROM users WHERE city = '北京'
UNION
SELECT name, email FROM users WHERE city = '上海';

-- UNION ALL（不去重）
SELECT name, email FROM users WHERE city = '北京'
UNION ALL
SELECT name, email FROM users WHERE city = '上海';
```

### 3.8.2 INTERSECT

```sql
-- 交集
SELECT user_id FROM orders WHERE order_date >= '2026-01-01'
INTERSECT
SELECT user_id FROM orders WHERE order_date < '2026-01-01';
```

### 3.8.3 EXCEPT

```sql
-- 差集
SELECT id FROM users
EXCEPT
SELECT user_id FROM orders;
-- 没有订单的用户
```

## 3.9 高级查询技巧

### 3.9.1 LATERAL 连接

```sql
-- LATERAL 允许子查询引用前面的表
SELECT u.name, latest_orders.*
FROM users u
LEFT JOIN LATERAL (
    SELECT order_id, total, order_date
    FROM orders o
    WHERE o.user_id = u.id
    ORDER BY order_date DESC
    LIMIT 3
) latest_orders ON true;

-- 每个用户最近的 3 个订单
```

### 3.9.2 FILTER 子句

```sql
-- 条件聚合（PostgreSQL 特有）
SELECT
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
    SUM(total) FILTER (WHERE order_date >= '2026-01-01') AS this_year_total
FROM orders;

-- 等价于（但不如 FILTER 清晰）
SELECT
    COUNT(*) AS total_orders,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_orders,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_orders
FROM orders;
```

### 3.9.3 DISTINCT ON

```sql
-- 每个城市年龄最大的用户（PostgreSQL 特有）
SELECT DISTINCT ON (city) id, name, city, age
FROM users
ORDER BY city, age DESC;

-- 每个分类最便宜的产品
SELECT DISTINCT ON (category_id) id, name, category_id, price
FROM products
ORDER BY category_id, price ASC;
```

### 3.9.4 VALUES 列表

```sql
-- 作为表使用
SELECT * FROM (VALUES (1, 'a'), (2, 'b'), (3, 'c')) AS t(id, name);

-- 批量插入
INSERT INTO users (id, name) VALUES (1, 'a'), (2, 'b'), (3, 'c');

-- 与 JOIN 结合
SELECT u.name, v.status_text
FROM users u
JOIN (VALUES (1, 'Active'), (2, 'Inactive'), (3, 'Pending')) AS v(status_id, status_text)
ON u.status = v.status_id;
```

### 3.9.5 RETURNING 子句

```sql
-- INSERT 返回
INSERT INTO users (name, email)
VALUES ('Test', 'test@example.com')
RETURNING id, name, created_at;

-- UPDATE 返回
UPDATE users SET age = age + 1
WHERE city = '北京'
RETURNING id, name, age;

-- DELETE 返回
DELETE FROM logs
WHERE created_at < NOW() - INTERVAL '30 days'
RETURNING id, message;
```

---

## 本章小结

- PostgreSQL 的 SQL 语法高度遵循 SQL 标准
- RETURNING 子句可以在 INSERT/UPDATE/DELETE 后返回数据
- ON CONFLICT 实现 UPSERT 操作
- CTE（公用表表达式）支持递归查询
- 窗口函数功能强大，支持复杂的分析查询
- FILTER 子句简化条件聚合
- DISTINCT ON 是 PostgreSQL 特有的去重方式
- LATERAL 连接允许子查询引用前面的表
