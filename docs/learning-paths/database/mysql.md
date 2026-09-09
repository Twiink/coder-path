# MySQL 学习路线

MySQL 是世界上最流行的开源关系型数据库:从个人博客到大型互联网公司,无处不在;招聘需求量常年第一。它简单到 `SELECT * FROM users` 就能上手,深奥到索引原理、MVCC、主从复制、分库分表够你研究好几年——**它是后端工程师的"数据管家",也是面试的必争之地**。建议配合 [计算机网络](/learning-paths/cs-basics/computer-networks) 与操作系统知识理解其架构;实践环境用 Docker 起一个即可(见 [Docker 路线](/learning-paths/devops/docker))。

这条线按 **基础与 CRUD → 进阶查询 → 索引原理 → 事务与 MVCC → InnoDB 引擎 → 权限与运维 → 查询优化 → 复制与高可用 → 分库分表** 推进。**索引是性能的关键,事务是数据一致性的保障**——记住这两句,路线就拎清了。

## 第一站:安装与基础 CRUD

**上手**:安装(或 Docker `mysql:8` 镜像);`mysql -u root -p` 命令行连接;图形工具 Workbench/DBeaver 辅助;基础命令:`SHOW DATABASES`/`USE db`/`SHOW TABLES`/`DESC table`。**数据库与字符集**:创建库表时字符集选 **utf8mb4**(真正的 UTF-8:4 字节,能存 emoji 与生僻字;老 `utf8` 是残缺的 3 字节实现——**乱码与"?"的常见根源**),排序规则 utf8mb4_unicode_ci 之类。
**数据类型选型**(建表基本功):整型 int/bigint(有符号无符号、自增 AUTO_INCREMENT)、**金额用 DECIMAL(精确小数,别用 float/double)**、字符串 `VARCHAR(n)`(n 是**字符数**不是字节数,变长,适合短文本)vs `TEXT`(长文本)、`CHAR`(定长,几乎不用)、时间 `DATETIME`(与时区无关)vs `TIMESTAMP`(带时区,2038 问题)与 `DATE`;**JSON 类型**(8.0:直接存 JSON + 索引虚拟列);**约束**:PRIMARY KEY/UNIQUE(唯一)/FOREIGN KEY(外键——**互联网公司生产库普遍禁用外键**,用应用层保证,理由:锁与性能)/NOT NULL/DEFAULT/CHECK。
**CRUD**:INSERT(单行与**批量插入**(性能差异巨大));SELECT:WHERE 条件(=、IN、LIKE、BETWEEN)、ORDER BY、**LIMIT offset, count 分页**;UPDATE(**不加 WHERE = 全表更新,生产事故第一来源**——先 SELECT 确认再 UPDATE);DELETE vs **TRUNCATE**(删表重置自增,不可回滚);`REPLACE INTO`/`INSERT ... ON DUPLICATE KEY UPDATE`(upsert 姿势)。
数据导入导出:mysqldump/LOAD DATA/客户端工具。

## 第二站:进阶查询

**JOIN 连接**(多表查询的核心):INNER JOIN(交集)/LEFT JOIN(左表全保留,右表无则 NULL)/RIGHT JOIN(反过来)/CROSS JOIN;**on 条件 vs where 条件的坑**:LEFT JOIN 时把右表条件写 WHERE 会把它变成 INNER(过滤掉 NULL 行)——右表条件应放 ON;**子查询**:标量子查询/IN 子查询/EXISTS 相关子查询(大表上 EXISTS 常优于 IN);**GROUP BY 分组** + 聚合函数(COUNT/SUM/AVG/MAX/MIN——**COUNT(*) vs COUNT(列) 区别**(后者不计 NULL));**HAVING**(分组后过滤——与 WHERE 的执行顺序差异,HAVING 里可用聚合);DISTINCT 去重;UNION(去重)vs UNION ALL(不去重,更快);**CASE WHEN**(SQL 里的 if,行转列统计常用)。
**窗口函数(8.0+,现代 SQL 的分水岭)**:**ROW_NUMBER()/RANK()/DENSE_RANK()**(排名——**"每组分数的 Top3"用 ROW_NUMBER + PARTITION BY**)、SUM() OVER(PARTITION BY ... ORDER BY ...)(累计/移动平均)、LAG/LEAD(取前后行——同比环比);窗口函数能一行解决"分组 TopN",旧写法(自连接/变量)已成历史。
**常用函数**:日期(DATE_FORMAT/DATEDIFF/DATE_ADD/NOW)、字符串(CONCAT/SUBSTRING/REPLACE/TRIM)、IFNULL/COALESCE(NULL 兜底)、CAST 类型转换。

## 第三站:索引——性能的命根子

**为什么快:B+ 树**——叶子节点有序链表存数据/主键,非叶子只存索引键:树矮(三层能存千万级)、范围查询与排序天然高效、磁盘 IO 次数少(每层一次 IO);对比哈希索引(单点 O(1) 但无法范围)。**InnoDB 的两种索引**:①**聚簇索引**(主键索引:叶子就是整行数据——**表数据按主键物理组织,所以 InnoDB 必须有主键,推荐自增整型**(UUID 无序导致页分裂));②**二级索引(辅助索引)**:叶子存的是主键值——查询时先找二级索引得主键、再回聚簇索引取行,这叫**回表**。
**覆盖索引**:要查的列全部在索引里,免回表(所以写 `SELECT id, name` 别无脑 `SELECT *`);**联合索引(复合索引)与最左前缀原则**:`(a, b, c)` 索引可加速 a / a,b / a,b,c 的查询,跳列则部分失效;范围查询(>、<)之后的列失效;**索引失效场景**(面试必背清单):对索引列用函数或运算(`WHERE YEAR(create_time)=2024` 失效,应改范围)、**隐式类型转换**(varchar 列查数字,索引失效)、左模糊 `LIKE '%abc'`、`OR` 连接非索引列、`NOT IN`/`<>` 某些情况、优化器判断全表更快(小表/低选择性列);**EXPLAIN 读法**(分析慢 SQL 的第一工具):关注 **type**(性能从好到坏:const > eq_ref > ref > range > index > **ALL(全表扫描,警钟)**)、key(实际用的索引)、rows(预估扫描行数)、**Extra**(Using index = 覆盖索引(好)/Using filesort = 排序没走索引(要优化 order by)/Using temporary(要优化 group by/distinct));**索引设计原则**:高频查询的 WHERE/ORDER BY/JOIN 列建索引、区分度高的列优先、别滥用(每个索引都是写放大)、唯一约束用唯一索引;**全文索引 FULLTEXT**(英文可用,中文分词差——全文搜索生产上 ES 见 [Elasticsearch 路线](/learning-paths/middleware/elasticsearch))。

## 第四站:事务与 MVCC——数据一致性的基石

**ACID**:原子性(全成或全败)、一致性(约束不被破坏)、隔离性(事务互不干扰)、持久性(提交不丢);**事务语法**:BEGIN/START TRANSACTION → 操作 → COMMIT/ROLLBACK;**隐式提交陷阱**:DDL 与 autocommit=1 下每条 SQL 自带事务;连接断开未提交自动回滚。
**四种隔离级别**(与并发问题的对照表是面试必画):读未提交(脏读:读到别人未提交)、**读已提交 RC**(解决脏读,不可重复读:同事务两次读不同)、**可重复读 RR(MySQL 默认)**:解决不可重复读;串行化(全解决,性能最差);**幻读**:RR 下快照读不出现,当前读(见下)仍可能——靠锁解决。
**MVCC(多版本并发控制,InnoDB 的核心设计)**:每行有隐藏列(事务 ID、回滚指针),UPDATE 不覆盖旧值而生成**undo log 版本链**;事务**快照读**(普通 SELECT)时生成 **ReadView**(活跃事务列表),按规则沿版本链找"自己可见的版本"——**读不加锁、读写不互斥**,这就是 MySQL 高并发的底气;**当前读**(SELECT ... FOR UPDATE/LOCK IN SHARE MODE、UPDATE、DELETE)读最新版并加锁。
**锁机制**(RR 下的防幻读主力):行锁(记录锁 Record Lock)、**间隙锁 Gap Lock(锁范围空隙,防插入)**、**Next-Key Lock(记录+间隙 = 左开右闭区间,RR 默认——幻读的锁级解法)**;意向锁(表级意图标记);**死锁**:两个事务互相持有对方要的锁——InnoDB 检测到自动回滚一方(报 Deadlock found);避免:固定加锁顺序、事务要短、走索引(全表更新 = 锁全表 = 死锁温床)。
**日志三兄弟**(MySQL 面试名场面):**redo log**(InnoDB 的崩溃恢复日志:**WAL 先写日志再改数据页**,重启后重放——保证持久性)、**undo log**(回滚 + MVCC 版本链——保证原子性)、**binlog**(Server 层逻辑日志:复制与恢复用);**两阶段提交**(redo 与 binlog 一致性的保障,主从不丢数据的底层)。

## 第五站:InnoDB 与存储引擎

**InnoDB 是 MySQL 8 的默认且事实唯一**(MyISAM 只有历史意义:无事务无行锁,面试考古题"区别");存储结构:**表空间**(数据按 **16KB 页**组织:页内行、页间双向链表——理解页也就理解"为什么 varchar 太大行溢出"与索引 IO);**Change Buffer**(二级索引的变更缓冲:非唯一索引的插入更新先记缓冲再合并,减少随机 IO——唯一索引用不上,所以"尽量用普通索引 + 应用保证唯一"有性能论据);双写缓冲(防页半写);自适应哈希索引(InnoDB 自动优化热点);**表设计规范**:每表都要主键、时间字段建议 created_at/updated_at(应用维护或默认值)、命名规范(库表 snake_case、索引 idx_xxx/uk_xxx)——**团队规范先行,建表前先定规矩**。

## 第六站:用户、权限与运维

**用户与权限**:CREATE USER/`GRANT SELECT, INSERT ON db.* TO 'user'@'host'`/REVOKE/FLUSH PRIVILEGES;**最小权限原则**(应用账号只给需要的库表权限,别用 root 连业务);8.0 默认认证 caching_sha2_password(**老客户端/老驱动连不上是升级常见坑**——兼容可改 mysql_native_password);**连接与参数**:max_connections(连接打满 = 服务假死的常见原因,先查 `SHOW PROCESSLIST` 看是哪些 SQL)、wait_timeout;**时区与 sql_mode**(严格模式默认开:插入非法数据报错而非截断);**字符集核对**(库/表/连接三层都 utf8mb4,否则中文乱码);日常运维:慢查询日志(见查询优化)、binlog 开启(复制与恢复的前提)、磁盘监控、`SHOW ENGINE INNODB STATUS`(看锁与死锁)。

## 第七站:查询优化实战

一条 SQL 的执行流程(面试八股之巅):连接器(鉴权/连接管理/连接池)→ 查询缓存(8.0 已移除,一致性维护成本高,一个表任何写操作都让缓存全失效)→ 分析器(词法语法解析,检查语法错误与表/字段存在性)→ 优化器(基于成本 CBO 的执行计划选择:选索引、决定 JOIN 顺序、子查询展开)→ 执行器(权限检查后调存储引擎 API 取数据)。优化器的成本模型(了解):基于统计信息(表行数、索引基数、数据分布)估算每种执行计划的 IO 成本与 CPU 成本,选成本最低的——所以统计信息不准(长期未 ANALYZE)会让优化器选错索引。

查询缓存为什么失败:查询字符串完全相同(大小写/空格/注释都算)才命中,且任何写操作让整表缓存失效——写多读少的表缓存命中率极低还拖慢写入,不如应用层缓存(Redis)或 ORM 的查询缓存。8.0 果断移除是正确决定。

优化工作流(一套完整打法):

1. 开慢查询日志:`slow_query_log=ON`,`long_query_time=1`(超 1 秒记录),`log_queries_not_using_indexes=ON`(未走索引的也记)→ 日志文件在 `datadir` 下;

2. 分析慢查询日志:手工看(慢查询日志格式:`# Time: ... # User@Host: ... # Query_time: 2.5 Lock_time: 0.001 Rows_sent: 10 Rows_examined: 100000`)或用 mysqldumpslow(官方工具,按次数/时间排序)/pt-query-digest(Percona Toolkit,强推,统计+分组+建议,输出 HTML 报告)——`pt-query-digest slow.log > report.html`;

3. EXPLAIN 逐条看(三板斧:type/rows/Extra):

type(访问类型,性能从好到坏):system(表只有一行,常量表)> const(主键/唯一索引等值查询,一行)> eq_ref(JOIN 时唯一索引查找,每次一行)> ref(非唯一索引等值)> range(范围查询,走索引)> index(索引全扫描,比 ALL 好但仍慢)> ALL(全表扫描,红色警钟)——生产 SQL type 最低要到 range,ALL/index 要优化;

key(实际使用的索引):NULL 表示未走索引,对比 possible_keys(可能用的索引)看优化器选择;

rows(预估扫描行数):越小越好,若 rows 远大于实际返回行数(nReturned)说明索引不够精准或缺失;

Extra(额外信息,关键诊断):

  Using index:覆盖索引(好事,不回表);
  
  Using where:Server 层过滤(引擎返回后再筛选,可能索引不精确);
  
  Using index condition:索引下推 ICP(5.6+,把 WHERE 部分条件下推到存储引擎层过滤,减少回表——优化);
  
  Using filesort:排序未走索引(要优化 ORDER BY:让排序字段走索引);
  
  Using temporary:用了临时表(GROUP BY/DISTINCT/UNION 可能产生,尽量优化掉);
  
  Using join buffer:JOIN 未走索引,用了 join buffer(被驱动表要加索引);
  
  Impossible WHERE:WHERE 恒假(如 id=1 AND id=2);
  
  Select tables optimized away:优化器直接返回结果(如 COUNT(*) 单表无 WHERE,InnoDB 直接从统计信息拿);

filtered(过滤百分比):WHERE 过滤后剩余的行占 rows 的比例,低说明索引区分度不够;

4. 按索引失效清单排查(见索引站);

5. SQL 重写技巧:

select 具体列:避免 SELECT *(网络传输、解析开销、无法覆盖索引、未来表结构变化风险);

大偏移分页优化(经典难题):`LIMIT 1000000, 10` 扫 100 万行只取 10 行——解法:①延迟关联(先走索引查 id 再 JOIN 原表取完整行:`SELECT * FROM t INNER JOIN (SELECT id FROM t ORDER BY id LIMIT 1000000,10) AS t2 USING(id)`)、②游标分页(记住上次最大 id:`WHERE id > last_id ORDER BY id LIMIT 10`,前提 id 连续或业务可容忍跳号)、③业务限制(不让翻太深,搜索引擎常见做法);

COUNT(*) 优化:InnoDB 的 COUNT(*) 不是 O(1)(MVCC 多版本,无法维护准确总数)——优化:WHERE 走覆盖索引(二级索引树比主键树小,扫得快)、近似值(EXPLAIN 的 rows)、自己维护计数表(Redis INCR/数据库单独一行);COUNT(1) vs COUNT(*) vs COUNT(列):性能 COUNT(*) ≈ COUNT(1)(优化器等价)> COUNT(主键)> COUNT(非主键列,要判 NULL);

避免在循环里查库(N+1 问题,ORM 的常见坑):循环 100 次每次查一条 = 100 次网络往返——改成一次 IN 查询(id IN (1,2,...,100))或 JOIN,或 ORM 的预加载(Eager Loading);

IN vs EXISTS 看数据分布:`SELECT * FROM A WHERE id IN (SELECT aid FROM B WHERE ...)`(内表小,MySQL 8 会用半连接优化)vs `... EXISTS (SELECT 1 FROM B WHERE B.aid=A.id AND ...)`(外表小);现代 MySQL 优化器智能,手动改不一定更快,EXPLAIN 为准;

子查询改 JOIN 常更快:老版本(5.5-)子查询优化差(每行都执行子查询),改 JOIN 走索引;8.0 的半连接优化(semijoin)让 IN 子查询性能接近 JOIN,但复杂相关子查询仍建议改写;

OR 改 UNION ALL:多个 OR 条件可能让索引失效(如 `WHERE a=1 OR b=2`,a 和 b 各有索引但组合用不上)——改成 UNION ALL 分别走索引:`SELECT * WHERE a=1 UNION ALL SELECT * WHERE b=2 AND a!=1`(注意去重);

优化器提示(Hint):FORCE INDEX(idx_name)(强制用某索引)、IGNORE INDEX(忽略)、STRAIGHT_JOIN(固定 JOIN 顺序)——慎用,优化器通常比人聪明,只在确定优化器选错时用(如统计信息不准时);

写优化:

批量 INSERT(一条 INSERT 插 1000 行 vs 1000 条单行 INSERT,前者快几十倍:减少事务提交、索引维护、网络往返):`INSERT INTO t VALUES (1,'a'),(2,'b'),...`(单次别超 1MB 或几千行,太大回滚慢);

避免大事务(长事务占锁、undo log 膨胀、主从延迟、回滚慢):分批处理(删 100 万行改成循环删 1000 行提交一次,SLEEP 0.01 让出 CPU);

UPDATE/DELETE 带 LIMIT(线上分批操作):`DELETE FROM t WHERE status='old' LIMIT 1000`(每次删 1000,循环直到删完——减少锁持有时间、避免一次性大事务);

INSERT ... ON DUPLICATE KEY UPDATE(upsert)比先 SELECT 再 INSERT/UPDATE 少一次网络往返(原子)。

## 第八站:复制、高可用与备份

**主从复制(读写分离的基础)**:原理三线程——主库 binlog 由 **IO 线程**拉取到从库 relay log,再由 **SQL 线程**回放;**复制格式**:STATEMENT(语句,可能不一致)/**ROW(行级,默认且安全)**/MIXED;binlog 格式与 row 下的大事务注意;**GTID(全局事务标识)**:每个事务有全局唯一 ID,主从切换/新建从库不再靠 binlog 文件名定位——现代复制标配;**半同步复制**(主库等至少一个从库确认才提交——损主不丢数据的折中)vs 异步(默认,性能好但主挂有丢数据窗口)vs 组复制 MGR(多主/单主 + Paxos 共识,高可用方向);**主从延迟**(读写分离的最大痛点):原因(SQL 线程单线程回放历史→并行复制改善;大事务;从库自身查询压力;DDL)与应对(业务上**读刚写的数据强制走主库**或缓存、监控延迟秒级 `SHOW SLAVE STATUS` 的 Seconds_Behind_Master);**读写分离架构**:应用层双数据源(框架支持:ShardingSphere/MyBatis 插件)或中间件(ProxySQL/Atlas);**高可用方案**:MHA/Orchestrator(自动故障切换 + 虚 IP 漂移)与 MGR(自动选主)——核心指标:RTO(恢复时间)与 RPO(丢多少数据),半同步 + 自动切换是常见组合。
**备份与恢复(运维生命线)**:**mysqldump 逻辑备份**(配 `--single-transaction` 拿一致性快照;库小/迁移用)、**XtraBackup 物理备份**(不锁表的热备,大库用)、binlog 增量(全量备份 + binlog 回放到误删前——**时间点恢复 PITR**:模拟演练必备)、备份验证(定时恢复演练,备份没验证过等于没有)。

## 第九站:分库分表与分布式

**什么时候才需要**(架构演进顺序,别跳级):①先缓存(Redis)与索引优化;②再读写分离;③单表数据千万级/写入瓶颈才考虑**分库分表**。**拆分方式**:垂直拆分(按业务域拆库:用户库/订单库——微服务化的数据基础)与**水平拆分**(同结构按行分:分表/分库);**分片策略**:HASH 取模(均匀,扩容要迁移)与 RANGE(按时间/ID 段,热点不均但好扩容)与一致性哈希(中间件常用);**分片键选择**(决定命运):按查询最频繁的维度(订单按 user_id),**跨分片查询的代价**(JOIN/聚合/事务全变难——业务设计要"按分片键访问");**分布式主键**:雪花算法(时间戳+机器+序列,趋势递增,替代无序 UUID——UUID 伤索引)与号段模式;**中间件**:ShardingSphere(Java 生态成熟:分片/读写分离/分布式事务)与 MyCat;**分布式事务**:Seata(AT/TCC/Saga)与 2PC 概念——见 [微服务](/learning-paths/microservices/spring-cloud);数据迁移:双写 + 回放校验(平滑切换);**终极提醒**:分库分表是最后手段,成本和复杂度极高——90% 的业务做好索引 + 缓存 + 读写分离就够。

## 通关标准

能独立做到:写多表 JOIN/分组/窗口函数的报表查询;给新表设计索引并说出理由,拿到慢 SQL 会 EXPLAIN 并指出 type/rows/Extra 的问题;画得出事务隔离级别与并发问题对照表,讲清 MVCC 快照读原理与间隙锁为什么存在;说清 redo/undo/binlog 三者职责与两阶段提交;搭过一主一从并理解延迟监控;能解释"为什么互联网公司不用外键、自增主键、utf8mb4"——MySQL 主线通关。

从 `SELECT 1` 到分库分表,MySQL 的学习之路既漫长又有趣:**先会用(CRUD/查询),再会快(索引/优化),后会稳(事务/复制/备份),终会大(分库分表)**。它是你写过的每个业务系统里最沉默也最关键的组件——索引是它的性能,事务是它的灵魂,理解它,你就理解了后端数据层的大半江山。下一步:对比 [PostgreSQL](/learning-paths/database/postgresql)(功能更强的学院派),缓存上 [Redis](/learning-paths/database/redis),灵活建模看 [MongoDB](/learning-paths/database/mongodb)。
