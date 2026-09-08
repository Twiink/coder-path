---
title: "Oracle SQL与PL/SQL编程"
aliases:
  - "Oracle SQL"
  - "PL/SQL"
tags:
  - "后端"
  - "数据库"
  - "oracle"
  - "plsql"
  - "笔记"
category: "后端"
folder: "Oracle与SQLServer"
parent: "[[目录]]"
related:
  - "[[后端/数据库/Oracle与SQLServer/Oracle入门与架构]]"
  - "[[后端/数据库/Oracle与SQLServer/Oracle性能优化与管理]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 02 Oracle SQL 与 PL/SQL 编程

Oracle 的 SQL 语言在标准 SQL 基础上有很多扩展，PL/SQL（Procedural Language/SQL）是 Oracle 的过程化编程语言，可以编写存储过程、函数、触发器等。

## 2.1 Oracle SQL 基础

### 2.1.1 SELECT 查询

```sql
-- 基本查询
SELECT employee_id, first_name, last_name, salary
FROM employees
WHERE department_id = 10;

-- 使用别名
SELECT employee_id AS id, 
       first_name || ' ' || last_name AS full_name,
       salary * 12 AS annual_salary
FROM employees;

-- DISTINCT 去重
SELECT DISTINCT department_id FROM employees;

-- ORDER BY 排序
SELECT employee_id, first_name, salary
FROM employees
ORDER BY salary DESC, employee_id ASC;

-- ROWNUM 分页（11g 及之前）
SELECT * FROM (
    SELECT t.*, ROWNUM rn 
    FROM employees t 
    ORDER BY employee_id
) WHERE rn > 10 AND rn <= 20;

-- FETCH FIRST 分页（12c+）
SELECT * FROM employees
ORDER BY employee_id
OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY;
```

### 2.1.2 条件查询

```sql
-- WHERE 条件
SELECT * FROM employees 
WHERE salary > 5000 AND department_id = 10;

-- BETWEEN
SELECT * FROM employees 
WHERE salary BETWEEN 3000 AND 8000;

-- IN
SELECT * FROM employees 
WHERE department_id IN (10, 20, 30);

-- LIKE 模糊查询
SELECT * FROM employees 
WHERE first_name LIKE 'A%';     -- 以 A 开头
WHERE first_name LIKE '%son';   -- 以 son 结尾
WHERE first_name LIKE '%oh%';   -- 包含 oh

-- IS NULL / IS NOT NULL
SELECT * FROM employees 
WHERE commission_pct IS NULL;

-- 多条件组合
SELECT * FROM employees
WHERE (department_id = 10 OR department_id = 20)
  AND salary > 5000
  AND hire_date > TO_DATE('2020-01-01', 'YYYY-MM-DD');
```

### 2.1.3 聚合函数

```sql
-- COUNT
SELECT COUNT(*) FROM employees;                    -- 总行数
SELECT COUNT(commission_pct) FROM employees;       -- 非空行数
SELECT COUNT(DISTINCT department_id) FROM employees;  -- 去重计数

-- SUM、AVG、MAX、MIN
SELECT 
    SUM(salary) AS total_salary,
    AVG(salary) AS avg_salary,
    MAX(salary) AS max_salary,
    MIN(salary) AS min_salary
FROM employees
WHERE department_id = 10;

-- GROUP BY 分组
SELECT department_id, 
       COUNT(*) AS emp_count,
       AVG(salary) AS avg_salary,
       SUM(salary) AS total_salary
FROM employees
GROUP BY department_id
ORDER BY department_id;

-- HAVING 过滤分组
SELECT department_id, 
       COUNT(*) AS emp_count,
       AVG(salary) AS avg_salary
FROM employees
GROUP BY department_id
HAVING COUNT(*) > 5 AND AVG(salary) > 5000
ORDER BY avg_salary DESC;

-- ROLLUP（小计和总计）
SELECT department_id, job_id, SUM(salary) AS total_salary
FROM employees
GROUP BY ROLLUP (department_id, job_id);

-- CUBE（所有组合）
SELECT department_id, job_id, SUM(salary) AS total_salary
FROM employees
GROUP BY CUBE (department_id, job_id);

-- GROUPING SETS（自定义分组）
SELECT department_id, job_id, SUM(salary) AS total_salary
FROM employees
GROUP BY GROUPING SETS (
    (department_id, job_id),
    (department_id),
    ()
);
```

### 2.1.4 子查询

```sql
-- 标量子查询（返回单值）
SELECT employee_id, first_name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- 行子查询（返回一行）
SELECT * FROM employees
WHERE (department_id, job_id) = (
    SELECT department_id, job_id 
    FROM employees 
    WHERE employee_id = 100
);

-- 表子查询（返回多行）
SELECT employee_id, first_name, salary
FROM employees
WHERE department_id IN (
    SELECT department_id FROM departments WHERE location_id = 1700
);

-- EXISTS / NOT EXISTS
SELECT * FROM departments d
WHERE EXISTS (
    SELECT 1 FROM employees e WHERE e.department_id = d.department_id
);

-- 相关子查询
SELECT e.employee_id, e.first_name, e.salary
FROM employees e
WHERE e.salary > (
    SELECT AVG(salary) 
    FROM employees 
    WHERE department_id = e.department_id
);

-- WITH 子句（CTE，公共表表达式）
WITH dept_salary AS (
    SELECT department_id, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY department_id
)
SELECT e.employee_id, e.first_name, e.salary, d.avg_salary
FROM employees e
JOIN dept_salary d ON e.department_id = d.department_id
WHERE e.salary > d.avg_salary;
```

### 2.1.5 JOIN 连接

```sql
-- INNER JOIN
SELECT e.employee_id, e.first_name, d.department_name
FROM employees e
INNER JOIN departments d ON e.department_id = d.department_id;

-- LEFT OUTER JOIN
SELECT e.employee_id, e.first_name, d.department_name
FROM employees e
LEFT JOIN departments d ON e.department_id = d.department_id;

-- RIGHT OUTER JOIN
SELECT e.employee_id, e.first_name, d.department_name
FROM employees e
RIGHT JOIN departments d ON e.department_id = d.department_id;

-- FULL OUTER JOIN
SELECT e.employee_id, e.first_name, d.department_name
FROM employees e
FULL OUTER JOIN departments d ON e.department_id = d.department_id;

-- CROSS JOIN（笛卡尔积）
SELECT e.employee_id, d.department_name
FROM employees e
CROSS JOIN departments d;

-- 自连接
SELECT e.employee_id, e.first_name AS employee,
       m.employee_id AS manager_id, m.first_name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.employee_id;

-- 多表连接
SELECT e.employee_id, e.first_name, 
       d.department_name, l.city, c.country_name
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN locations l ON d.location_id = l.location_id
JOIN countries c ON l.country_id = c.country_id;
```

### 2.1.6 集合操作

```sql
-- UNION（去重合并）
SELECT employee_id, first_name FROM employees WHERE department_id = 10
UNION
SELECT employee_id, first_name FROM employees WHERE salary > 10000;

-- UNION ALL（保留重复）
SELECT employee_id, first_name FROM employees WHERE department_id = 10
UNION ALL
SELECT employee_id, first_name FROM employees WHERE salary > 10000;

-- INTERSECT（交集）
SELECT employee_id, first_name FROM employees WHERE department_id = 10
INTERSECT
SELECT employee_id, first_name FROM employees WHERE salary > 10000;

-- MINUS（差集，Oracle 特有）
SELECT employee_id, first_name FROM employees WHERE department_id = 10
MINUS
SELECT employee_id, first_name FROM employees WHERE salary > 10000;
```

## 2.2 Oracle 特有函数

### 2.2.1 字符串函数

```sql
-- CONCAT（只能连接两个字符串，推荐用 ||）
SELECT CONCAT('Hello', ' World') FROM DUAL;  -- Hello World
SELECT 'Hello' || ' ' || 'World' FROM DUAL;  -- Hello World

-- LENGTH / LENGTHB（字符数 / 字节数）
SELECT LENGTH('你好') FROM DUAL;     -- 2
SELECT LENGTHB('你好') FROM DUAL;    -- 6（UTF-8）

-- SUBSTR（截取子串）
SELECT SUBSTR('Hello World', 7, 5) FROM DUAL;  -- World
SELECT SUBSTR('Hello World', -5) FROM DUAL;    -- World

-- INSTR（查找子串位置）
SELECT INSTR('Hello World', 'o') FROM DUAL;       -- 5
SELECT INSTR('Hello World', 'o', 1, 2) FROM DUAL; -- 8（第 2 次出现）

-- UPPER / LOWER / INITCAP
SELECT UPPER('hello') FROM DUAL;       -- HELLO
SELECT LOWER('HELLO') FROM DUAL;       -- hello
SELECT INITCAP('hello world') FROM DUAL;  -- Hello World

-- TRIM / LTRIM / RTRIM
SELECT TRIM('  hello  ') FROM DUAL;    -- hello
SELECT TRIM('x' FROM 'xxxhelloxxx') FROM DUAL;  -- hello
SELECT LTRIM('xxxhello', 'x') FROM DUAL;  -- hello

-- REPLACE
SELECT REPLACE('Hello World', 'World', 'Oracle') FROM DUAL;  -- Hello Oracle

-- LPAD / RPAD（填充）
SELECT LPAD('123', 10, '0') FROM DUAL;  -- 0000000123
SELECT RPAD('hello', 10, '*') FROM DUAL;  -- hello*****

-- DECODE（条件判断，Oracle 特有）
SELECT employee_id, first_name,
       DECODE(department_id, 
              10, 'Administration',
              20, 'Marketing',
              30, 'Purchasing',
              'Other') AS dept_name
FROM employees;
```

### 2.2.2 数值函数

```sql
-- ROUND（四舍五入）
SELECT ROUND(123.456, 2) FROM DUAL;   -- 123.46
SELECT ROUND(123.456, -1) FROM DUAL;  -- 120

-- TRUNC（截断）
SELECT TRUNC(123.456, 2) FROM DUAL;   -- 123.45
SELECT TRUNC(123.456, -1) FROM DUAL;  -- 120

-- MOD（取模）
SELECT MOD(10, 3) FROM DUAL;  -- 1

-- CEIL / FLOOR
SELECT CEIL(123.4) FROM DUAL;   -- 124
SELECT FLOOR(123.9) FROM DUAL;  -- 123

-- POWER（幂）
SELECT POWER(2, 10) FROM DUAL;  -- 1024

-- SQRT（平方根）
SELECT SQRT(144) FROM DUAL;  -- 12

-- ABS（绝对值）
SELECT ABS(-123) FROM DUAL;  -- 123

-- SIGN（符号）
SELECT SIGN(-10) FROM DUAL;  -- -1
SELECT SIGN(0) FROM DUAL;    -- 0
SELECT SIGN(10) FROM DUAL;   -- 1
```

### 2.2.3 日期函数

```sql
-- SYSDATE（当前日期时间）
SELECT SYSDATE FROM DUAL;

-- ADD_MONTHS（加月数）
SELECT ADD_MONTHS(SYSDATE, 3) FROM DUAL;   -- 3 个月后
SELECT ADD_MONTHS(SYSDATE, -6) FROM DUAL;  -- 6 个月前

-- MONTHS_BETWEEN（月数差）
SELECT MONTHS_BETWEEN(SYSDATE, TO_DATE('2020-01-01', 'YYYY-MM-DD')) FROM DUAL;

-- LAST_DAY（月末日期）
SELECT LAST_DAY(SYSDATE) FROM DUAL;

-- NEXT_DAY（下一个指定星期几）
SELECT NEXT_DAY(SYSDATE, 'FRIDAY') FROM DUAL;

-- TRUNC（日期截断）
SELECT TRUNC(SYSDATE, 'YEAR') FROM DUAL;    -- 年初
SELECT TRUNC(SYSDATE, 'MONTH') FROM DUAL;   -- 月初
SELECT TRUNC(SYSDATE, 'DAY') FROM DUAL;     -- 周日

-- ROUND（日期四舍五入）
SELECT ROUND(SYSDATE, 'MONTH') FROM DUAL;   -- 四舍五入到月

-- EXTRACT（提取部分）
SELECT EXTRACT(YEAR FROM SYSDATE) FROM DUAL;    -- 年
SELECT EXTRACT(MONTH FROM SYSDATE) FROM DUAL;   -- 月
SELECT EXTRACT(DAY FROM SYSDATE) FROM DUAL;     -- 日

-- 日期运算
SELECT SYSDATE + 1 FROM DUAL;              -- 明天
SELECT SYSDATE - 1 FROM DUAL;              -- 昨天
SELECT SYSDATE + 1/24 FROM DUAL;           -- 1 小时后
SELECT SYSDATE + 30/(24*60) FROM DUAL;     -- 30 分钟后
```

### 2.2.4 转换函数

```sql
-- TO_CHAR（转字符串）
SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') FROM DUAL;
SELECT TO_CHAR(12345.67, '999,999.99') FROM DUAL;  -- 12,345.67
SELECT TO_CHAR(12345.67, 'L999,999.99') FROM DUAL; -- $12,345.67

-- TO_DATE（转日期）
SELECT TO_DATE('2026-09-06', 'YYYY-MM-DD') FROM DUAL;
SELECT TO_DATE('2026-09-06 10:30:00', 'YYYY-MM-DD HH24:MI:SS') FROM DUAL;

-- TO_NUMBER（转数值）
SELECT TO_NUMBER('12345.67') FROM DUAL;
SELECT TO_NUMBER('$12,345.67', '$999,999.99') FROM DUAL;

-- CAST（类型转换）
SELECT CAST('123' AS NUMBER) FROM DUAL;
SELECT CAST(123 AS VARCHAR2(10)) FROM DUAL;

-- NVL（空值替换，Oracle 特有）
SELECT NVL(commission_pct, 0) FROM employees;  -- NULL 替换为 0

-- NVL2（根据是否为空返回不同值）
SELECT NVL2(commission_pct, '有佣金', '无佣金') FROM employees;

-- COALESCE（返回第一个非空值）
SELECT COALESCE(commission_pct, 0, -1) FROM employees;

-- NULLIF（相等返回 NULL，否则返回第一个值）
SELECT NULLIF(department_id, 10) FROM employees;  -- 如果是 10 返回 NULL
```

### 2.2.5 分析函数（窗口函数）

```sql
-- ROW_NUMBER（行号）
SELECT employee_id, first_name, salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn
FROM employees;

-- RANK / DENSE_RANK（排名）
SELECT employee_id, first_name, salary,
       RANK() OVER (ORDER BY salary DESC) AS rank,
       DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rank
FROM employees;

-- PARTITION BY（分组）
SELECT employee_id, first_name, department_id, salary,
       ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS dept_rank
FROM employees;

-- SUM / AVG / COUNT OVER（累积聚合）
SELECT employee_id, first_name, salary,
       SUM(salary) OVER (ORDER BY employee_id) AS running_total,
       AVG(salary) OVER (ORDER BY employee_id) AS running_avg
FROM employees;

-- LAG / LEAD（前/后行）
SELECT employee_id, first_name, salary,
       LAG(salary, 1) OVER (ORDER BY employee_id) AS prev_salary,
       LEAD(salary, 1) OVER (ORDER BY employee_id) AS next_salary
FROM employees;

-- FIRST_VALUE / LAST_VALUE（首/末值）
SELECT employee_id, first_name, salary,
       FIRST_VALUE(salary) OVER (ORDER BY employee_id) AS first_sal,
       LAST_VALUE(salary) OVER (ORDER BY employee_id 
                                ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last_sal
FROM employees;

-- NTILE（分桶）
SELECT employee_id, first_name, salary,
       NTILE(4) OVER (ORDER BY salary DESC) AS quartile
FROM employees;
```

## 2.3 DML 数据操作

### 2.3.1 INSERT

```sql
-- 插入单行
INSERT INTO employees (employee_id, first_name, last_name, email, hire_date, job_id, salary, department_id)
VALUES (300, 'John', 'Doe', 'JDOE', SYSDATE, 'IT_PROG', 5000, 60);

-- 插入多行（使用 INSERT ALL，Oracle 特有）
INSERT ALL
    INTO employees (employee_id, first_name, last_name, email, hire_date, job_id, salary)
    VALUES (301, 'Alice', 'Smith', 'ASMITH', SYSDATE, 'IT_PROG', 6000)
    INTO employees (employee_id, first_name, last_name, email, hire_date, job_id, salary)
    VALUES (302, 'Bob', 'Johnson', 'BJOHNSON', SYSDATE, 'IT_PROG', 5500)
SELECT 1 FROM DUAL;

-- 从查询插入
INSERT INTO employees_backup (employee_id, first_name, last_name, salary)
SELECT employee_id, first_name, last_name, salary
FROM employees
WHERE department_id = 10;

-- 使用序列（自增）
INSERT INTO employees (employee_id, first_name, last_name, email, hire_date, job_id, salary)
VALUES (emp_seq.NEXTVAL, 'Jane', 'Wilson', 'JWILSON', SYSDATE, 'IT_PROG', 5200);
```

### 2.3.2 UPDATE

```sql
-- 基本更新
UPDATE employees
SET salary = salary * 1.1
WHERE department_id = 10;

-- 更新多列
UPDATE employees
SET salary = 6000, 
    commission_pct = 0.1,
    department_id = 20
WHERE employee_id = 100;

-- 使用子查询更新
UPDATE employees e
SET salary = (
    SELECT AVG(salary) 
    FROM employees 
    WHERE department_id = e.department_id
)
WHERE department_id = 10;

-- 使用 MERGE（UPSERT，Oracle 特有）
MERGE INTO employees e
USING employees_staging s
ON (e.employee_id = s.employee_id)
WHEN MATCHED THEN
    UPDATE SET e.salary = s.salary, e.department_id = s.department_id
WHEN NOT MATCHED THEN
    INSERT (employee_id, first_name, last_name, email, hire_date, job_id, salary, department_id)
    VALUES (s.employee_id, s.first_name, s.last_name, s.email, s.hire_date, s.job_id, s.salary, s.department_id);
```

### 2.3.3 DELETE

```sql
-- 基本删除
DELETE FROM employees
WHERE employee_id = 300;

-- 使用子查询删除
DELETE FROM employees
WHERE department_id IN (
    SELECT department_id FROM departments WHERE location_id = 1700
);

-- 清空表（TRUNCATE，DDL 操作，不能回滚）
TRUNCATE TABLE employees_backup;
```

## 2.4 DDL 数据定义

### 2.4.1 创建表

```sql
-- 基本建表
CREATE TABLE employees (
    employee_id NUMBER(6) PRIMARY KEY,
    first_name VARCHAR2(20) NOT NULL,
    last_name VARCHAR2(25) NOT NULL,
    email VARCHAR2(25) UNIQUE NOT NULL,
    phone_number VARCHAR2(20),
    hire_date DATE DEFAULT SYSDATE NOT NULL,
    job_id VARCHAR2(10) NOT NULL,
    salary NUMBER(8,2) CHECK (salary > 0),
    commission_pct NUMBER(2,2),
    manager_id NUMBER(6),
    department_id NUMBER(4),
    CONSTRAINT fk_dept FOREIGN KEY (department_id) REFERENCES departments(department_id),
    CONSTRAINT fk_manager FOREIGN KEY (manager_id) REFERENCES employees(employee_id)
);

-- 从查询创建表（CTAS）
CREATE TABLE employees_backup AS
SELECT * FROM employees WHERE department_id = 10;

-- 创建临时表
CREATE GLOBAL TEMPORARY TABLE temp_employees (
    employee_id NUMBER,
    first_name VARCHAR2(20)
) ON COMMIT DELETE ROWS;  -- 或 ON COMMIT PRESERVE ROWS
```

### 2.4.2 修改表

```sql
-- 添加列
ALTER TABLE employees ADD (
    bonus NUMBER(8,2),
    hire_year NUMBER(4)
);

-- 修改列
ALTER TABLE employees MODIFY (
    salary NUMBER(10,2),
    email VARCHAR2(50)
);

-- 删除列
ALTER TABLE employees DROP COLUMN bonus;

-- 重命名列
ALTER TABLE employees RENAME COLUMN first_name TO given_name;

-- 添加约束
ALTER TABLE employees ADD CONSTRAINT chk_salary CHECK (salary > 0);

-- 删除约束
ALTER TABLE employees DROP CONSTRAINT chk_salary;

-- 启用/禁用约束
ALTER TABLE employees DISABLE CONSTRAINT fk_dept;
ALTER TABLE employees ENABLE CONSTRAINT fk_dept;
```

### 2.4.3 删除表

```sql
-- 删除表
DROP TABLE employees;

-- 删除表（如果存在）
DROP TABLE employees CASCADE CONSTRAINTS;  -- 同时删除依赖的约束

-- 清空表（保留结构）
TRUNCATE TABLE employees;
```

### 2.4.4 序列（Sequence）

```sql
-- 创建序列
CREATE SEQUENCE emp_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 999999
    NOCYCLE
    CACHE 20;

-- 使用序列
INSERT INTO employees (employee_id, first_name, last_name)
VALUES (emp_seq.NEXTVAL, 'John', 'Doe');

SELECT emp_seq.CURRVAL FROM DUAL;  -- 当前值
SELECT emp_seq.NEXTVAL FROM DUAL;  -- 下一个值

-- 修改序列
ALTER SEQUENCE emp_seq INCREMENT BY 2 MAXVALUE 1999999;

-- 删除序列
DROP SEQUENCE emp_seq;
```

### 2.4.5 索引

```sql
-- 创建索引
CREATE INDEX idx_emp_name ON employees(last_name, first_name);

-- 创建唯一索引
CREATE UNIQUE INDEX idx_emp_email ON employees(email);

-- 创建位图索引（适合低基数列）
CREATE BITMAP INDEX idx_emp_dept ON employees(department_id);

-- 创建函数索引
CREATE INDEX idx_emp_upper_name ON employees(UPPER(last_name));

-- 删除索引
DROP INDEX idx_emp_name;
```

## 2.5 PL/SQL 编程

### 2.5.1 PL/SQL 基础

```sql
-- PL/SQL 块结构
DECLARE
    -- 声明部分
    v_employee_id NUMBER := 100;
    v_salary NUMBER;
    v_name VARCHAR2(50);
BEGIN
    -- 执行部分
    SELECT first_name || ' ' || last_name, salary
    INTO v_name, v_salary
    FROM employees
    WHERE employee_id = v_employee_id;
    
    DBMS_OUTPUT.PUT_LINE('Name: ' || v_name);
    DBMS_OUTPUT.PUT_LINE('Salary: ' || v_salary);
EXCEPTION
    -- 异常处理部分
    WHEN NO_DATA_FOUND THEN
        DBMS_OUTPUT.PUT_LINE('Employee not found');
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Error: ' || SQLERRM);
END;
/
```

### 2.5.2 变量与常量

```sql
DECLARE
    -- 常量
    c_tax_rate CONSTANT NUMBER := 0.1;
    
    -- 变量
    v_salary NUMBER(8,2) := 5000;
    v_bonus NUMBER(8,2);
    v_total NUMBER(8,2);
    
    -- 使用 %TYPE（与表列类型一致）
    v_emp_name employees.first_name%TYPE;
    v_emp_salary employees.salary%TYPE;
    
    -- 使用 %ROWTYPE（与表行类型一致）
    v_employee employees%ROWTYPE;
BEGIN
    v_bonus := v_salary * 0.2;
    v_total := v_salary + v_bonus - (v_salary * c_tax_rate);
    
    SELECT * INTO v_employee FROM employees WHERE employee_id = 100;
    
    DBMS_OUTPUT.PUT_LINE('Total: ' || v_total);
END;
/
```

### 2.5.3 控制结构

```sql
DECLARE
    v_salary NUMBER := 5000;
    v_level VARCHAR2(20);
BEGIN
    -- IF-THEN-ELSIF-ELSE
    IF v_salary > 10000 THEN
        v_level := 'High';
    ELSIF v_salary > 5000 THEN
        v_level := 'Medium';
    ELSE
        v_level := 'Low';
    END IF;
    
    -- CASE 语句
    CASE
        WHEN v_salary > 10000 THEN v_level := 'High';
        WHEN v_salary > 5000 THEN v_level := 'Medium';
        ELSE v_level := 'Low';
    END CASE;
    
    DBMS_OUTPUT.PUT_LINE('Level: ' || v_level);
END;
/
```

### 2.5.4 循环

```sql
DECLARE
    v_counter NUMBER := 1;
BEGIN
    -- 基本循环
    LOOP
        DBMS_OUTPUT.PUT_LINE('Counter: ' || v_counter);
        v_counter := v_counter + 1;
        EXIT WHEN v_counter > 5;
    END LOOP;
    
    -- WHILE 循环
    v_counter := 1;
    WHILE v_counter <= 5 LOOP
        DBMS_OUTPUT.PUT_LINE('While: ' || v_counter);
        v_counter := v_counter + 1;
    END LOOP;
    
    -- FOR 循环
    FOR i IN 1..5 LOOP
        DBMS_OUTPUT.PUT_LINE('For: ' || i);
    END LOOP;
    
    -- FOR 循环（反向）
    FOR i IN REVERSE 1..5 LOOP
        DBMS_OUTPUT.PUT_LINE('Reverse: ' || i);
    END LOOP;
END;
/
```

### 2.5.5 游标

```sql
-- 显式游标
DECLARE
    CURSOR c_employees IS
        SELECT employee_id, first_name, salary
        FROM employees
        WHERE department_id = 10;
    
    v_emp_id employees.employee_id%TYPE;
    v_name employees.first_name%TYPE;
    v_salary employees.salary%TYPE;
BEGIN
    OPEN c_employees;
    LOOP
        FETCH c_employees INTO v_emp_id, v_name, v_salary;
        EXIT WHEN c_employees%NOTFOUND;
        
        DBMS_OUTPUT.PUT_LINE(v_name || ': ' || v_salary);
    END LOOP;
    CLOSE c_employees;
END;
/

-- 游标 FOR 循环（推荐）
DECLARE
    CURSOR c_employees IS
        SELECT employee_id, first_name, salary
        FROM employees
        WHERE department_id = 10;
BEGIN
    FOR emp IN c_employees LOOP
        DBMS_OUTPUT.PUT_LINE(emp.first_name || ': ' || emp.salary);
    END LOOP;
END;
/

-- 带参数的游标
DECLARE
    CURSOR c_employees(p_dept_id NUMBER) IS
        SELECT employee_id, first_name, salary
        FROM employees
        WHERE department_id = p_dept_id;
BEGIN
    FOR emp IN c_employees(10) LOOP
        DBMS_OUTPUT.PUT_LINE(emp.first_name || ': ' || emp.salary);
    END LOOP;
END;
/
```

### 2.5.6 异常处理

```sql
DECLARE
    v_salary NUMBER;
    e_high_salary EXCEPTION;
    PRAGMA EXCEPTION_INIT(e_high_salary, -20001);
BEGIN
    SELECT salary INTO v_salary FROM employees WHERE employee_id = 100;
    
    IF v_salary > 20000 THEN
        RAISE e_high_salary;
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        DBMS_OUTPUT.PUT_LINE('Employee not found');
    WHEN TOO_MANY_ROWS THEN
        DBMS_OUTPUT.PUT_LINE('Too many rows returned');
    WHEN e_high_salary THEN
        DBMS_OUTPUT.PUT_LINE('Salary is too high');
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Error code: ' || SQLCODE);
        DBMS_OUTPUT.PUT_LINE('Error message: ' || SQLERRM);
END;
/
```

### 2.5.7 存储过程

```sql
-- 创建存储过程
CREATE OR REPLACE PROCEDURE update_salary(
    p_employee_id IN NUMBER,
    p_amount IN NUMBER,
    p_result OUT VARCHAR2
) AS
    v_current_salary NUMBER;
BEGIN
    SELECT salary INTO v_current_salary
    FROM employees
    WHERE employee_id = p_employee_id;
    
    UPDATE employees
    SET salary = v_current_salary + p_amount
    WHERE employee_id = p_employee_id;
    
    p_result := 'Success';
    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        p_result := 'Employee not found';
    WHEN OTHERS THEN
        p_result := 'Error: ' || SQLERRM;
        ROLLBACK;
END update_salary;
/

-- 调用存储过程
DECLARE
    v_result VARCHAR2(100);
BEGIN
    update_salary(100, 1000, v_result);
    DBMS_OUTPUT.PUT_LINE(v_result);
END;
/
```

### 2.5.8 函数

```sql
-- 创建函数
CREATE OR REPLACE FUNCTION get_annual_salary(
    p_employee_id NUMBER
) RETURN NUMBER AS
    v_salary NUMBER;
    v_commission NUMBER;
BEGIN
    SELECT salary, NVL(commission_pct, 0)
    INTO v_salary, v_commission
    FROM employees
    WHERE employee_id = p_employee_id;
    
    RETURN v_salary * 12 * (1 + v_commission);
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 0;
END get_annual_salary;
/

-- 调用函数
SELECT employee_id, first_name, get_annual_salary(employee_id) AS annual_salary
FROM employees
WHERE department_id = 10;
```

### 2.5.9 包（Package）

```sql
-- 创建包规范
CREATE OR REPLACE PACKAGE employee_pkg AS
    -- 公共类型
    TYPE emp_rec_type IS RECORD (
        employee_id NUMBER,
        first_name VARCHAR2(20),
        salary NUMBER
    );
    
    -- 公共过程
    PROCEDURE update_salary(p_employee_id NUMBER, p_amount NUMBER);
    
    -- 公共函数
    FUNCTION get_annual_salary(p_employee_id NUMBER) RETURN NUMBER;
END employee_pkg;
/

-- 创建包体
CREATE OR REPLACE PACKAGE BODY employee_pkg AS
    -- 私有变量
    v_counter NUMBER := 0;
    
    -- 私有过程
    PROCEDURE log_update(p_employee_id NUMBER) IS
    BEGIN
        INSERT INTO salary_log (employee_id, update_date)
        VALUES (p_employee_id, SYSDATE);
    END;
    
    -- 公共过程实现
    PROCEDURE update_salary(p_employee_id NUMBER, p_amount NUMBER) IS
    BEGIN
        UPDATE employees
        SET salary = salary + p_amount
        WHERE employee_id = p_employee_id;
        
        log_update(p_employee_id);
        v_counter := v_counter + 1;
        COMMIT;
    END;
    
    -- 公共函数实现
    FUNCTION get_annual_salary(p_employee_id NUMBER) RETURN NUMBER IS
        v_salary NUMBER;
    BEGIN
        SELECT salary * 12 INTO v_salary
        FROM employees
        WHERE employee_id = p_employee_id;
        
        RETURN v_salary;
    END;
END employee_pkg;
/

-- 调用包中的过程和函数
BEGIN
    employee_pkg.update_salary(100, 1000);
    DBMS_OUTPUT.PUT_LINE(employee_pkg.get_annual_salary(100));
END;
/
```

### 2.5.10 触发器

```sql
-- DML 触发器
CREATE OR REPLACE TRIGGER emp_salary_trigger
BEFORE UPDATE OF salary ON employees
FOR EACH ROW
BEGIN
    IF :NEW.salary < :OLD.salary THEN
        RAISE_APPLICATION_ERROR(-20001, 'Salary cannot be decreased');
    END IF;
    
    -- 记录日志
    INSERT INTO salary_audit (
        employee_id, old_salary, new_salary, update_date, updated_by
    ) VALUES (
        :OLD.employee_id, :OLD.salary, :NEW.salary, SYSDATE, USER
    );
END;
/

-- 语句级触发器
CREATE OR REPLACE TRIGGER emp_insert_trigger
AFTER INSERT ON employees
BEGIN
    DBMS_OUTPUT.PUT_LINE('New employee inserted');
END;
/

-- INSTEAD OF 触发器（用于视图）
CREATE OR REPLACE TRIGGER emp_view_trigger
INSTEAD OF INSERT ON emp_dept_view
FOR EACH ROW
BEGIN
    INSERT INTO employees (employee_id, first_name, last_name, department_id)
    VALUES (:NEW.employee_id, :NEW.first_name, :NEW.last_name, :NEW.department_id);
END;
/
```

---

## 本章小结

- Oracle SQL 扩展：NVL、DECODE、序列、MERGE、INSERT ALL
- 常用函数：字符串、数值、日期、转换、分析函数
- DML 操作：INSERT、UPDATE、DELETE、MERGE
- DDL 操作：CREATE/ALTER/DROP TABLE、序列、索引
- PL/SQL 基础：块结构、变量、控制结构、循环
- 游标：显式游标、游标 FOR 循环、带参数游标
- 存储过程、函数、包、触发器
