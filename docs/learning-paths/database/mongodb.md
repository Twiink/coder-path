# MongoDB 学习路线

MongoDB 是**文档数据库**的代表作:不用表与行,用 **JSON 文档(BSON)** 存数据——与应用的对象模型天然匹配,**schema 可以随需而变**(字段随便加,不用 ALTER TABLE),天生支持水平扩展(分片)。适合快速迭代的应用、内容管理、用户资料、物联网、实时分析等场景;被"别被 NoSQL 吓到"的温和学习曲线掩盖的是:聚合管道、索引、副本集、分片,深水区一样不缺。**什么时候选它**:数据天然嵌套(用户+地址列表)、字段结构会变、写入吞吐高、需要水平扩展;**什么时候别选**:强事务依赖、复杂多表报表、重度 JOIN——那是关系库的天下(可对照 [MySQL](/learning-paths/database/mysql)/[PostgreSQL](/learning-paths/database/postgresql) 的 JSONB)。实践:Docker 起 `mongo` 或直接注册免费 Atlas 云。

这条线按 **CRUD → 查询 → 更新操作符 → 聚合管道 → 索引 → 数据建模 → 事务 → 副本集 → 分片 → 运维与生态** 推进。

## 第一站:CRUD 与文档模型

**上手**:`mongosh`(官方 shell)/Compass(GUI);概念对照 SQL:`database`→库、`collection`→表(集合,**懒创建**:第一次插入才有)、`document`→行(JSON 文档)、`_id`→主键(自动生成 ObjectId(12 字节含时间戳),也可自定义字符串/数字)。**CRUD 五件套**(shell 里全是 JS 语法,与驱动一致):`db.users.insertOne({name: 'x', age: 20})`/`insertMany([...])`;`find({age: {$gt: 18}})`(**返回游标 cursor,不是数组**——`.toArray()`/`.forEach()` 消费;`findOne` 直接拿文档);`updateOne({_id}, {$set: {age: 21}}, {upsert: true})`(条件/更新器/选项三段式;**upsert 查不到就插入**);`deleteOne/deleteMany`;**`replaceOne`**(整体替换,区别于 $set 局部改);`bulkWrite`(批量混合操作,性能);`countDocuments`(精确)/`estimatedDocumentCount`(快但可能不准)。**shell 技巧**:`show dbs`/`use db`/`show collections`、`db.xxx.find().pretty()`、`.sort({age: -1}).limit(10).skip(20)`(分页)。

## 第二站:查询——JSON 即查询语言

Mongo 的查询就是"描述你要什么的 JSON":**相等**:`{status: 'active'}`;比较:**$gt/$gte/$lt/$lte/$ne**、**$in/$nin**(字段值在列表);逻辑:$and/$or/$not/$nor;字段:**$exists**(判断字段有没有——schema-less 查询的日常)、$type;**数组查询**(文档库的灵魂):`{tags: 'mongodb'}`(数组含该元素)、**$all**(包含全部)、**$size**(长度精确)、**`$elemMatch`**(数组元素满足复合条件:`{scores: {$elemMatch: {$gte: 80, $lt: 90}}}`——数组里对象的多条件匹配);**正则**:`{name: /^张/}` 或 $regex(注意:前缀正则可走索引,`^` 开头);**嵌套字段用点表示法**:`{'address.city': '上海'}`(**字段名要加引号**);**投影 projection**:`find({}, {name: 1, age: 1, _id: 0})`(1 包含/0 排除——**只取需要的字段,省流量省内存,等效覆盖查询**);`distinct('city')` 去重取值;**查询该有的习惯**:先 `.explain('executionStats')` 看是否走索引(见索引站),别在没索引的集合上全扫。

## 第三站:更新操作符——原地改文档

更新操作符是 Mongo 更新文档的语法:**$set/$unset**(设值/删字段——**动态加字段就是一次 $set,免迁移**)、**$inc**(原子自增:`{$inc: {views: 1}}`——计数器并发安全,不读-改-写)、$mul/$min/$max、**数组操作**:`$push`(追加)/`$pull`(按值移除)/`$addToSet`(去重添加)/`$pop`(头尾弹)、$rename;**数组内更新(进阶)**:位置操作符——`$`(匹配第一个符合条件的元素:`{'items.$': newVal}`)、`$[]`(全部元素)、`$[elem]`(按 arrayFilters 条件批量更新部分元素);**findOneAndUpdate**(返回文档:配 `returnDocument: 'after'`——**抢单/队列"取一个并标记"的原子操作,替代"查→改"两步的竞态**)、findOneAndDelete(消费队列);更新选项:upsert、arrayFilters、multi(updateMany)。**更新策略提醒**:$set 局部更新是 Mongo 的设计正道;整文档 replaceOne 少用。

## 第四站:聚合管道——Mongo 的 SQL

**aggregate()** 是 Mongo 的查询重武器:一串**阶段(stage)**按顺序流水处理文档,每阶段输出给下一阶段。**常用阶段地图**:`$match`(过滤——**放最前,配合索引,先缩小数据**)、`$project`(投影 + 计算字段 + 重命名,1/0 或表达式)、**`$group`**(分组聚合:`_id` 分组键 + 累加器 `$sum: 1`(计数)/`$sum: '$price'`(求和)/`$avg/$max/$min`、`$push`(收集数组)/`$addToSet`(去重收集)、`$first/$last`(取组内首尾——**"每人最新订单"套路**:先 $sort 再 $group 取 $first))、$sort/$limit/$skip、**`$unwind`**(数组展开成多行——一对多打平、数组去重统计前必用)、**`$lookup`**(左连接:关联另一集合——**对照 JOIN,注意:放最后、被关联集合要建索引**)、`$addFields`(加字段)、`$count`、`$out/$merge`(管道结果写回集合——报表落表);**SQL 对照记忆**:where→$match、select→$project、group by→$group、order by→$sort、join→$lookup、unwind 对应"拆行"——**能把业务 SQL 翻译成管道,聚合就毕业了**;`$dateToString`/`$toUpper` 等表达式函数(按天统计报表:`_id: {$dateToString: {format: '%Y-%m-%d', date: '$createdAt'}}`)。

## 第五站:索引——查询快慢的分水岭

**索引类型**:单字段(默认);**复合索引**(顺序与设计:等值字段在前、排序字段其次、范围字段最后——对照 MySQL 最左前缀的 ESR 原则;用 `.explain()` 验证);**多键索引**(数组字段自动建,查数组元素的加速);**唯一索引**(唯一约束:`{unique: true}`——用户名/订单号);**TTL 索引**(`expireAfterSeconds`:到点自动删文档——**会话/验证码/临时数据的自动清理,免定时任务**);文本索引(全文搜索,中文需第三方分词,重度搜索还是 ES);2dsphere(地理坐标查询:附近的人/门店);稀疏索引/部分索引(部分文档建索引,省空间)。**explain('executionStats') 读法**:`COLLSCAN`(全集合扫描——慢查询警钟)、`IXSCAN`(走索引)、`FETCH`(回文档);指标:nReturned vs totalDocsExamined(**后者远大于前者 = 索引没设计好**)、executionTimeMillis;**索引代价**:每次写操作要同步维护索引(写放大)——索引不是越多越好;`$text`/排序与索引的配合。

## 第六站:数据建模——文档库的设计哲学

关系库先设计表,Mongo 先**按"数据怎么读"设计文档**:**内嵌(embedding)优先**:一对一/小一对多(地址、订单明细)直接嵌进父文档——**一次查询拿全,免 join,单文档更新原子**;取舍:16MB 文档上限、嵌套过深(数组内嵌文档不宜过深);**引用(reference)**:大一对多(用户的订单,无限增长)、多对多(用户↔群组)——存 `userId` 数组或独立集合 + **$lookup 或应用层二次查询**;**反范式(denormalization)**:把"读多写少"的冗余字段复制进文档(订单里冗余存商品名/快照价)——**空间换查询,一致性由应用保证**(下单后商品改名不影响历史订单——反而更正确);**建模决策三问**:数据怎么读(一起读就内嵌)/怎么变(高频独立更新就拆集合)/多大(超 16MB 或无限增长就引用);**扩展引用模式/子集模式**(热门字段进父文档)是官方建模课的内容;**对比 PG JSONB**:小规模灵活字段 PG 也够;Mongo 的建模自由度与水平扩展是它的招牌——但**自由需要纪律**,不然就是无索引的全集合扫描与越嵌越深的怪物文档。

## 第七站:事务与原子性

**原子性的层级**:单文档操作天然原子(updateOne 一个文档内多个字段一起变)——**"内嵌使单文档原子"是文档模型对一致性的最大贡献**;**多文档事务(4.0 副本集/4.2 分片)**:`session = client.startSession(); session.withTransaction(async () => {...})`——ACID 与快照隔离,转账/跨文档联动用它;**什么时候用**:业务强一致(支付+库存+订单跨集合)必须用;能用内嵌/单文档表达就别开事务(**性能与锁代价**);事务内禁 DDL;对比关系库:事务能力"有但非默认设计",建模时优先规避跨文档事务(设计决策 > 事后补偿)。

## 第八站:副本集——高可用

**副本集(Replica Set)**:一主多从——Primary(读写)/Secondary(只读+冗余);**oplog**(主库的操作日志,Secondary 拉取回放——**复制的心脏,大小有限(默认容量),初始化与延迟同步靠它**);**故障自动转移**:主挂→剩余成员**选举**出新主(多数派:奇数节点,2 副本+1 仲裁 或 3 节点);**读写配置**:readPreference(默认 primary;secondaryPreferred 读写分离——**注意复制延迟导致的"读不到刚写的"**,用 primary 或读自己的写);**writeConcern(写确认)**:w:1(主确认)/w:'majority'(多数派确认——**防"主确认后立刻挂掉丢数据"**);readConcern(local/majority/snapshot)——**一致性旋钮**:w+readConcern majority 是"不丢已确认写入"的云上默认;**运维**:rs.status()/rs.conf()、复制延迟监控、备份(见运维站);**副本集是分片的基本单元**(每片本身是副本集)。

## 第九站:分片集群——水平扩展

**何时分片**(别过早):单机写入到瓶颈/数据量单副本放不下/需要水平扩容——先索引+副本集优化;**架构三件**:mongos(路由,应用连它,不知后端分片)、**config server**(元数据:数据在哪片)、shard(每片=副本集);**分片键(shard key)选择(决定成败)**:必须基数高(别用布尔)、写入均匀(避免热点——单调递增键(时间戳)会写死最后一片 → **哈希分片**摊均匀)、查询带分片键(否则 mongos 广播全片查);**范围分片**(相邻键同片:范围查询友好)vs **哈希分片**(均匀但范围查询废);chunk 分裂与均衡器(自动迁移数据);**分片键不可修改**(建模时就定死——上分片前想清楚查询模式);运维:addShard、balancer 状态、jumbo chunk;**云上 Atlas 分片一键开**,理解原理仍必要。

## 第十站:存储引擎、运维与生态

**WiredTiger(默认引擎)**:文档级并发、**snappy/zstd 压缩(数据文件小一大截)**、快照隔离、内存缓存(类似 buffer pool);**慢查询排查**:`db.setProfilingLevel(1, {slowms: 100})`(profile 日志)或 Atlas 的慢查询面板、mongostat(实时指标)/mongotop(集合热点);**备份**:mongodump(逻辑,慢)/文件系统快照(物理快)/**Atlas 云备份(时间点恢复)**;自建增量:oplog 或定期快照;恢复演练;**安全**:默认无认证——**生产第一件事开认证**(`--auth` + 创建用户)、角色最小权限(dbOwner/readWrite/read/backup)、网络白名单(bindIp)、TLS、加密(企业版/Atlas);**驱动与 ODM(生产写代码的形态)**:Node 的 **Mongoose**(Schema 定义/校验/中间件/populate(引用查询)/虚拟字段——**Mongoose 的 Schema 是你在文档库上主动找的"结构自觉"**)、Python PyMongo/Motor(异步)、Java Spring Data MongoDB、Go mgo/mongo-driver;GUI:Compass(官方)/Studio 3T/Robo 3T;**Atlas(官方云)**:免费档够学习,生产托管(自动备份/监控/分片)——学习建议 Docker 本地起 + Atlas 各试一次。

## 通关标准

能独立做到:写出带 $elemMatch、嵌套点查询、复合排序分页的查询与投影;把"按分类统计销售额、取每类前三"翻译成聚合管道($match→$group→$sort→$limit);给高频查询设计复合索引并用 explain 验证(IXSCAN + 接近 1:1 的 examined/returned);讲清内嵌 vs 引用的建模决策、单文档原子 vs 多文档事务的取舍;能解释副本集选举、writeConcern majority、分片键三原则;用 Mongoose/任一驱动写过带 Schema 与 populate 的完整 CRUD——MongoDB 主线通关。

MongoDB 不是"不用设计表结构的偷懒库",而是"用不同的方式设计结构"的文档库:内嵌、引用、反范式、分片键——每个决策都在为你的查询模式服务。学它最有效的方式是与关系库**对照着学**:什么时候该用 JOIN 的库,什么时候该用 $lookup 的库;什么时候 ACID 表,什么时候文档事务。两种思维都打通,你才算真正会"选数据库"。下一步:性能缓存上 [Redis](/learning-paths/database/redis),全文搜索看 [Elasticsearch](/learning-paths/middleware/elasticsearch)。
