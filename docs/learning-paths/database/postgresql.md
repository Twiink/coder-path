# PostgreSQL 学习路线

PostgreSQL 是"世界上最先进的开源关系数据库":SQL 标准兼容性最好、功能最完整、扩展性极强,被称为学院派与瑞士军刀——窗口函数、CTE、JSONB、全文搜索、物化视图、空间数据,它全内置或一扩展即得;可靠性上 ACID 严格遵守、并发控制(SSI)严谨;Apple、Netflix、Instagram、Reddit 与大量云厂商托管都在用。**新项目没有特殊理由(团队/云生态)时,PostgreSQL 常常是比 MySQL 更值得的默认选择**。它有 MySQL 没有的杀手锏:**JSONB、物化视图、递归 CTE、GIN/GiST 索引家族、pgvector、PostGIS**。建议有 [MySQL](/learning-paths/database/mysql) 基础后对照学习(差异比单学印象深得多),或直接从零开始——SQL 大同小异。

这条线按 **基础与结构 → 查询能力(CTE/窗口/LATERAL)→ JSONB → 全文搜索 → 索引家族 → 视图与函数 → MVCC 与 VACUUM → WAL 与备份 → 复制与高可用 → 查询优化与调优 → 分区与扩展生态 → 迁移与选型** 推进。

## 第一站:安装、结构与基础

**上手**:安装(或 Docker `postgres:16`);`psql -U postgres` 命令行;**psql 元命令**:`\l`(库列表)/`\c dbname`(切换)/`\dt`(表)/`\d users`(表结构)/`\x`(竖排显示——宽表神器)/`\?`(帮助);GUI:pgAdmin(官方)/DBeaver。**三层命名空间(与 MySQL 的关键差异)**:实例(集群)→ 数据库 → **模式 schema(库内的命名空间,默认 public)** → 表——跨库查询不方便(靠 dblink/foreign data wrapper),**一个应用通常一个库 + 多个 schema 组织**。**数据类型特色**:自增 `GENERATED ALWAYS AS IDENTITY`(SQL 标准;serial 是老写法)、`UUID`(原生)、数组 `int[]`(原生!)、范围类型(int4range/daterange)、网络类型(inet)、枚举(create type)、**JSON/JSONB**(见第三站)、货币与几何类型;`CREATE TYPE` 自定义;**约束**:check 支持任意表达式(比 MySQL 实用)、外键、唯一、排他约束(Exclusion,高级);`ON CONFLICT DO UPDATE/NOTHING`(**upsert:比 MySQL 的 ON DUPLICATE KEY 语义清晰**,可指定冲突列);**RETURNING 子句(PG 特色)**:`INSERT ... RETURNING id`/`UPDATE ... RETURNING *`——**一步拿回刚写的行(含默认值),省一次查询**,后端 CRUD 的幸福感来源;事务/隔离级别与 MySQL 概念相同(见 MySQL 课),但实现不同(见 MVCC 站)。**大小写陷阱**:未加引号的标识符一律折叠成小写——`Users` 表实际叫 `users`;从 MySQL 迁来的人第一周必踩。

## 第二站:查询能力——SQL 标准的高地

PG 对 SQL 标准的支持让它在"复杂查询"上几乎没有对手:**CTE(WITH 子句)**:把复杂查询拆成有名字的中间步骤(可读性革命);**递归 CTE(`WITH RECURSIVE`)**:树形结构(组织架构/评论楼中楼/菜单)遍历的标准解法——**MySQL 8 也有但 PG 是主场**;**窗口函数**(完整支持:ROW_NUMBER/RANK/DENSE_RANK/LAG/LEAD/NTILE + 自定义 frame);**LATERAL 横向连接**:子查询里引用外层每一行(每行关联计算,替代部分相关子查询/实现"取每用户最近一单");**GROUPING SETS/ROLLUP/CUBE**(多维小计:报表一键出总计/小计/明细);**FILTER 子句**:`count(*) FILTER (WHERE status='paid')`——**一个聚合内做条件计数**,免去 sum(case when) 的绕路;**DISTINCT ON(特色语法)**:`SELECT DISTINCT ON (user_id) * FROM orders ORDER BY user_id, created_at DESC`——**直接取"每组最新一条"**,其他数据库要窗口函数或子查询;**聚合特色**:string_agg(拼接,替代 MySQL group_concat)/array_agg(聚成数组);`ILIKE`(不区分大小写模糊)。**EXPLAIN**:PG 的执行计划可读性公认最好(见查询优化站)。

## 第三站:JSONB——关系与文档的桥

PG 的 JSON 能力让它能同时当文档库用:**JSON vs JSONB**:JSON(原样存文本,保留键序与重复键,写入快)vs **JSONB(二进制解析存储:键无序、去重、可索引、查询快——生产选 JSONB)**;操作符: `->`(取 JSON,返回 json)、`->>`(取文本)、`#>`/`#>>`(路径取:`data #>> '{a,b}'`)、`@>`(**包含:data @> '{"tags": ["x"]}'——查数组含某元素/对象含子结构的表达**)、`?`/`?|`/`?&`(键存在);修改:`jsonb_set(data, '{a}', '"v"')`、`data || '{"k":1}'` 合并、`jsonb_build_object` 构造;索引:**GIN 索引(jsonb_ops)** 加速 @> 与 ? 查询——**无 schema 的灵活字段(配置/元数据/事件 payload/第三方数据)存 JSONB + GIN,是 PG 项目的日常模式**;JSONB 列还能建表达式索引/生成列再索引;场景:需要"关系为主 + 少量弹性结构"时,PG 让你不必上 MongoDB。

## 第四站:全文搜索

内置全文检索(中小项目替代 Elasticsearch 的方案):概念:**tsvector**(文档的"词向量":`to_tsvector('english', body)`——分词+词干化)与 **tsquery**(查询:`to_tsquery('english', 'cat & dog')`);匹配用 **`@@`**:`WHERE to_tsvector(body) @@ to_tsquery('数据库')`;**GIN 索引**加速;**排序**:`ts_rank`/`ts_rank_cd`(相关性排序,配 `websearch_to_tsquery`(类 Google 语法));中文:默认分词对中文不友好,装 **zhparser/pg_jieba 扩展**后配中文分词配置;高亮 ts_headline;**pg_trgm 扩展**(三元组模糊搜索:加速 LIKE '%xx%' 与相似度排序——轻量"搜名字"神器)。重度全文/聚合搜索仍建议 ES(见 [Elasticsearch 路线](/learning-paths/middleware/elasticsearch)),但"文章/商品标题搜索"级别 PG 自带够用。

## 第五站:索引家族——方法比 MySQL 多

PG 的索引是"方法可插拔"(CREATE INDEX ... USING method):**B-tree**(默认:范围/排序/等值);**Hash**(等值,少用);**GIN(倒排索引)**:全文 tsvector、JSONB、数组包含——**元素/文档型查询**;**GiST(通用搜索树)**:空间(PostGIS 的几何)、范围类型、模糊搜索(pg_trgm 用 GiST/GIN)、相似度;**BRIN(块范围索引)**:超大数据表(亿级)按物理顺序(时间序列)只存每块的 min/max——**体积极小、顺序数据查询极快,大表神器**;**部分索引**:`WHERE status = 'active'` 只索引活跃行——**只查活跃数据的场景索引瘦身 90%**;**表达式索引**:`CREATE INDEX ON users (lower(email))`(函数查询也能走索引,MySQL 不行);INCLUDE 列(覆盖索引:索引里带冗余列免回表);索引维护:膨胀(更新产生死元组)→ REINDEX;并发建索引 `CONCURRENTLY`(不锁写——**大表加索引的线上姿势**)。

## 第六站:视图、物化视图与函数

**视图**:封装复杂查询(简化/安全隔离);可更新视图(简单视图可直接 insert);**物化视图 MATERIALIZED VIEW(MySQL 没有,PG 报表利器)**:查询结果**物理落盘**——复杂聚合(月度报表/大表 join)预先算好,业务查它就快;**手动刷新** `REFRESH MATERIALIZED VIEW CONCURRENTLY`(11+:不锁读地增量更新,需唯一索引)——适合"数据分钟/小时级新鲜即可"的场景。**PL/pgSQL 函数**:`CREATE FUNCTION`(语言 plpgsql:变量/IF/LOOP/异常;返回标量/表 RETURNS TABLE/SETOF);存储过程 `CREATE PROCEDURE`(能管理事务);触发器(create trigger + 触发器函数:审计日志/自动更新时间戳/级联逻辑——**before insert 自动填 created_at 是标配**);应用层 ORM 之外的"数据库内逻辑"武器,适度使用(复杂业务逻辑还是留应用层)。

## 第七站:MVCC 与 VACUUM——PG 与 MySQL 最大的不同

PG 的 MVCC 实现:UPDATE 不就地覆盖,而是插入新版本行,旧版本行保留在页里——每行有隐藏列:xmin(插入事务 ID)、xmax(删除事务 ID,0 表示未删)、cmin/cmax(命令 ID,事务内语句序号)、ctid(行版本链指针,物理位置 (page, offset))。

事务快照与可见性规则:事务开始时创建快照(当前活跃事务列表 + xmin/xmax 边界),读取行时按规则判断可见性:

xmin 未提交或在快照之后 → 不可见(还没生效);

xmin 已提交且在快照之前、xmax 为 0 或未提交或在快照之后 → 可见(有效版本);

xmax 已提交且在快照之前 → 不可见(已被删除);

这套机制实现读不加锁、读写不互斥(MVCC 的核心价值)——多个事务可以同时读写而不阻塞(每个事务看到自己的快照版本)。对比 MySQL InnoDB 的 undo log 版本链(旧版本在回滚段),PG 是旧版本留在数据页里——各有利弊。

隔离级别实现:

读已提交 RC(PG 默认):每条语句开始时创建新快照——能读到其他事务已提交的修改(不可重复读);

可重复读 RR:事务开始时创建快照,整个事务用同一个——普通 SELECT(快照读)看到的数据不变,但当前读(SELECT FOR UPDATE)仍能看到最新(会锁住);

可串行化 SSI(Serializable Snapshot Isolation):基于快照隔离 + 冲突检测——检测"危险结构"(rw-rw-rw 依赖环),发现潜在异常时 ROLLBACK 一个事务(报 serialization failure,应用需重试)。PG 是少数真正实现可串行化的数据库(不像 MySQL RR 靠锁),代价是冲突检测开销与误判回滚。

死元组(dead tuple,PG 的痛点):UPDATE/DELETE 产生的旧版本行标记 xmax 但不物理删除——占空间、索引膨胀(索引指向所有版本,查询要跳过不可见的)、统计信息不准、查询变慢。为什么不立即删:可能还有旧事务在用(长事务会让死元组堆积);清理需要全表扫描(成本高)。

VACUUM(清理死元组,PG 运维核心):

VACUUM(普通清理):扫描表,标记死元组空间为可重用(free space map FSM 记录)、更新统计信息、冻结老事务 ID(防回卷,见下)——不归还磁盘空间(文件大小不变),只是让空间可复用;autovacuum 自动触发(后台 worker,按阈值:`autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor × 表行数`,默认 50 + 20% 变化触发);

VACUUM FULL(完全清理):重写整张表(新表只含活元组)、重建索引、归还磁盘——会加 ACCESS EXCLUSIVE 锁(阻塞所有读写),慢且危险,低峰期或维护窗口做;何时用:表严重膨胀(磁盘空间紧张)、长期未 VACUUM 的表(死元组率 > 50%);

VACUUM ANALYZE:清理 + 更新统计信息(优化器用),等同于 VACUUM + ANALYZE;

死元组监控:pg_stat_user_tables 视图:`n_live_tup`(活元组)、`n_dead_tup`(死元组)、`last_vacuum`/`last_autovacuum`(上次清理时间)——`n_dead_tup / n_live_tup > 0.2` 时考虑手动 VACUUM;

调优参数:autovacuum_max_workers(并发 worker 数,默认 3)、autovacuum_naptime(唤醒间隔,默认 1min)、vacuum_cost_delay(限速避免 IO 打满)、按表调整(ALTER TABLE ... SET)——高更新表可以缩短阈值、加快频率。

HOT 更新(Heap-Only Tuple,减少索引维护的优化):如果 UPDATE 不改索引列、且新版本行能放在同一页(page 有空闲空间),新旧行在同一页内形成链表,索引项不需要更新——大幅减少索引膨胀与写放大。触发条件:非索引列更新 + 页内有空闲空间(fill factor 预留空间有用)——所以"表设计时非频繁更新列不建索引"有性能理由。

事务 ID 回卷(wraparound,PG 的定时炸弹):事务 ID 是 32 位(42 亿),用完回绕(0 → 42 亿)——老事务 ID 突然变"未来",MVCC 可见性判断错乱。防御:VACUUM 会冻结(freeze)老行(把 xmin 改成特殊值 FrozenXID,表示"对所有事务可见"),推进冻结点。autovacuum_freeze_max_age(默认 2 亿事务,强制 VACUUM)——超过会触发 aggressive vacuum(扫全表)。告警:接近阈值时日志报 "to prevent wraparound"、达到 failsafe(11 亿)时拒绝写入进入只读模式——运维红线,必须监控 `datfrozenxid`(pg_database 的列)。

锁体系(比 MySQL 复杂):

表级锁 8 种模式(从弱到强):ACCESS SHARE(SELECT)、ROW SHARE(SELECT FOR UPDATE)、ROW EXCLUSIVE(INSERT/UPDATE/DELETE)、SHARE UPDATE EXCLUSIVE(VACUUM/ANALYZE/CREATE INDEX CONCURRENTLY)、SHARE、SHARE ROW EXCLUSIVE、EXCLUSIVE、ACCESS EXCLUSIVE(DDL 如 ALTER TABLE/DROP/TRUNCATE/VACUUM FULL/REINDEX)——ACCESS EXCLUSIVE 阻塞一切(读写都等),DDL 期间业务卡死是常见故障;

行级锁:FOR UPDATE(排他)、FOR NO KEY UPDATE(允许不冲突的外键检查)、FOR SHARE(共享)、FOR KEY SHARE(最弱,允许 UPDATE 不涉及键列);

咨询锁(Advisory Lock):pg_advisory_lock(id) / pg_advisory_unlock(id)——应用层自定义分布式锁(跨事务、跨连接),session 级或事务级;用途:"定时任务单实例执行"(启动时抢锁,抢到才跑)、"队列消费去重"——无需 Redis,PG 自带;

死锁检测:deadlock_timeout(默认 1s,超时触发检测)→ 检测到死锁环后回滚一个事务(报错 "deadlock detected")——应用需捕获并重试;

锁监控(线上卡顿第一排查):

pg_locks 视图:所有锁(locktype/database/relation/pid/mode/granted)——`granted=false` 是等待中(被阻塞);

pg_stat_activity:当前会话(pid/query/state/wait_event)——state=active 且 wait_event 非空是等锁;

查阻塞关系:`SELECT blocked.pid AS blocked_pid, blocking.pid AS blocking_pid, blocked.query FROM pg_stat_activity blocked JOIN pg_locks bl ON blocked.pid = bl.pid AND NOT bl.granted JOIN pg_locks bk ON bl.locktype = bk.locktype AND bk.granted JOIN pg_stat_activity blocking ON bk.pid = blocking.pid`——找出"谁阻塞了谁";

pg_blocking_pids(pid):返回阻塞该 pid 的 pid 数组(9.6+,快捷函数);

杀死阻塞会话:pg_cancel_backend(pid)(取消查询,优雅)、pg_terminate_backend(pid)(强制断开,粗暴)。

## 第八站:WAL、备份与恢复

**WAL(Write-Ahead Logging,预写日志)**:任何修改先写 WAL 再改数据页(崩溃恢复靠它重放);WAL 文件 16MB 分段、**checkpoint**(把脏页刷盘,推进重放起点);**wal_level**(replica 默认:支持归档与流复制;logical 支持逻辑解码——逻辑复制需要);**连续归档与 PITR(时间点恢复,PG 备份体系的精髓)**:全量基础备份(pg_basebackup)+ 持续 WAL 归档 → 可恢复到**任意时间点**(`recovery_target_time`)——误删一张表:恢复到误删前一刻(比 MySQL 的 binlog 回放更成体系);备份三板斧:pg_dump(逻辑:单库/可跨版本迁移)/pg_basebackup(物理:整实例基础备份)/WAL 归档(增量);备份一定要演练恢复。**复制槽 replication slot**(防止从库断开时 WAL 被删——流复制的配套);`pg_stat_replication` 看复制状态。

## 第九站:复制与高可用

**流复制(物理复制,主流)**:主库把 WAL 实时传给备库重放——备库只读;**同步/异步**(同步:主库等备库确认才提交——`synchronous_standby_names` + 级别 remote_apply/on/remote_write——同步保证不丢但拖慢主库;异步性能好有丢失窗口);级联复制(备库再挂备库,减轻主库);**延迟备库**(recovery_min_apply_delay:备库故意落后 1 小时——**防"误操作立刻同步到备库"的保险**);**逻辑复制(11+,特色)**:发布/订阅模型——**按表选择性复制**(只同步订单表到分析库)、跨大版本迁移(14→16 在线)、异构消费(逻辑解码到 Kafka);双向复制(高级,冲突自理)。**高可用(HA)**:主备自动故障切换用 **Patroni**(基于 etcd/consul 选主——PG HA 的事实标准,云上 RDS 也是这个思路)或 repmgr;切换后:IP 漂移或连接串指向新主(应用配多主机);**连接池 PgBouncer**:PG 每连接是独立进程(内存开销大)——**连接池不是可选项,是标配**(事务级池:几千连接复用几十个后端);读写分离:应用层/中间件(PgBouncer 只池化;路由交给应用或 Proxy 层)。

## 第十站:查询优化与配置调优

**EXPLAIN 与 EXPLAIN ANALYZE**(PG 排障体验最好:ANALYZE 真执行并输出**实际行数与耗时**——对比估算找偏差):计划节点读法:Seq Scan(全表)/Index Scan/Bitmap Index+Heap Scan(位图扫描:多条件组合索引的 PG 特色)/Nested Loop(小表驱动)/Hash Join(无索引大 join 建哈希)/Merge Join(排序流合并);**看什么**:actual time、rows 估算 vs actual 偏差(统计信息旧了 → ANALYZE)、排序/哈希内存溢出。**统计信息**:VACUUM ANALYZE 更新 pg_statistic,优化器基于成本(CBO)选计划;**并行查询**:大表 Seq Scan/Hash Join 自动并行(多核,配 max_parallel_workers);JIT(LLVM 编译加速复杂表达式,大查询有感)。**配置调优**(postgresql.conf,别乱抄):`shared_buffers`(≈内存 25%)、`work_mem`(单次排序/哈希内存——**过大有 OOM 风险,因为每连接每操作都可能用**)、`maintenance_work_mem`(vacuum/索引)、`effective_cache_size`(告诉优化器 OS 缓存多大,影响是否选索引)、`max_connections`(配合 PgBouncer 收紧)、`wal_buffers/synchronous_commit`(追求吞吐可 off,丢数据的窗口换);**pg_stat_statements**(标准扩展:累计 SQL 统计——**找慢查询/高频查询的第一工具**,配 pg_stat_activity(看正在跑的));**分区表(声明式,10+)**:RANGE(按时间:日志/订单——**配分区裁剪:查询只扫对应分区**)/LIST(按地区/状态)/HASH(均摊);老方案"表继承 + 触发器"了解即可;pg_partman 自动建新分区;注意:分区键要进查询条件,否则全分区扫。

## 第十一站:扩展生态——PG 的护城河

**CREATE EXTENSION** 是 PG 生态的灵魂:PostGIS(地理空间/GIS 之王:geometry 类型 + GiST 索引 + 空间函数——地图类应用)、**pgvector(向量检索:AI 应用/RAG 的数据库内方案,embedding 存 PG + 余弦相似度检索,2023 后最热扩展)**、TimescaleDB(时序数据:自动分区+压缩+连续聚合)、Citus(分布式:多机水平扩展 + 分布式表)、pg_trgm(模糊)、uuid-ossp/pgcrypto、hstore、pg_stat_statements;扩展开发(create function/type/operator 的 C 或 SQL 接口,PGXN 发布)——**"PG 缺什么就装什么"的能力让它二十年不过时**。

## 第十二站:选型与从 MySQL 迁移

**PG vs MySQL 一句话**:都要会(招聘都要求);新项目/复杂查询/JSON 灵活字段/空间/向量 → PG;深度绑定 MySQL 生态(云 RDS 习惯/团队/既有分库分表中间件) → MySQL;两者 SQL 大体兼容,差异点:自增(identity vs auto_increment)、JSON(操作符不同)、大小写(标识符折叠)、limit 写法一致、物化视图与递归 CTE 只有 PG 顺手;**迁移工具 pgloader**(MySQL→PG 自动转换);学习顺序建议:先 MySQL(面试需求大/资料多)再 PG 对照(差异即考点:VACUUM、GIN、物化视图、RETURNING……)。**工具**:psql/pgcli(补全)/pgAdmin/DBeaver/pg_stat_statements。

## 通关标准

能独立做到:写出带递归 CTE、窗口函数、FILTER、DISTINCT ON 的复杂查询;给 JSONB 列建 GIN 索引并写出包含查询;说清 PG 与 MySQL 在 MVCC/VACUUM、索引类型、物化视图上的差异;会 EXPLAIN ANALYZE 并指出执行计划的问题节点;搭过流复制并理解同步级别与复制槽;给大表设计过分区与部分索引;把 pgvector 用进一个 RAG 应用——PostgreSQL 主线通关。

PostgreSQL 是数据库里的"学院派优等生":标准、严谨、克制,把 SQL 的能力边界推到了最远——递归、JSON、全文、空间、向量,一个库包圆。它不追求"快得惊人",而追求"十年后依然可靠";学它你会养成"查文档、读执行计划、尊重 ACID"的习惯。从 `psql` 连上那一刻起,试着把每个"MySQL 里做不到"的念头都来 PG 里试一次——你会打开新世界。下一步:缓存与数据结构上 [Redis](/learning-paths/database/redis),文档模型看 [MongoDB](/learning-paths/database/mongodb)。
