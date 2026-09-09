# Node.js 学习路线

Node.js 让 JavaScript 跑在服务器上——**同一门语言写前后端**,前端工程师的福音;事件驱动 + 非阻塞 I/O 让它天生适合高并发 I/O 场景(API 服务、实时应用、工具脚本);npm 生态庞大到你想要的基本都有。它的性能画像要记牢:**I/O 密集型是强项,CPU 密集型是短板**(密集计算会堵住事件循环,要交给 Worker Threads 或换 Go/Rust)。学它之前,先把 [JavaScript 学习路线](/learning-paths/frontend/javascript) 的异步章节吃透——Node 的一切都建立在你对事件循环的理解上。

这条线按 **运行时与环境 → 模块系统 → 核心模块 → 事件循环与 libuv → V8 与内存 → 异步深水区 → Express 与 Web 开发 → 数据库 → 认证与安全 → 实时与队列 → 测试 → 性能与生产** 推进。

## 第一站:运行时与环境

**安装与版本**:用 **nvm** 管理多版本(Node 偶数版是 LTS,生产用 LTS);`node -v`/`node file.js` 运行;REPL 敲 `node` 进入。**Node 与浏览器的差异**(面试常问):Node 没有 DOM/BOM(window/document),但有 `fs`/`process`/`Buffer` 等服务器能力;`global` 对应 window(globalThis 两处通用);**CommonJS 是 Node 的默认**(浏览器原生 ESM)。
**包管理器三选**:npm(默认)/yarn/pnpm(**现代推荐**:省磁盘、严格依赖隔离、快);`package.json` 关键字段:`name/version`、`scripts`(npm run dev/test)、`dependencies` vs `devDependencies`、**`"type": "module"`**(决定 .js 按 ESM 解析)、`engines`;`npx`(免安装执行包,如 `npx tsx`);**`package-lock.json` 必须提交**。
**入门体验**:`node -e "console.log(1)"`、读文件脚本、`node --watch`(开发热重启)。

## 第二站:模块系统

**CommonJS**:`require('./a')`/`module.exports = &#123;&#125;`(或 exports.x);**模块缓存**(require 同路径只执行一次,单例由此而来);**ESM**:`import`/`export`,Node 里 `.mjs` 后缀或 package.json `"type": "module"`;**两者互操作**:ESM 里 `import` CJS 包一般可以(默认导出是 module.exports),CJS 里 require ESM 不行(要用动态 `import()`);ESM 没有 `__dirname`——用 `import.meta.url` + `fileURLToPath` 推导(日常 import.meta.dirname(Node 20.11+))。**模块解析**:相对路径 vs 包名(去 node_modules 逐级向上找——"幽灵依赖"与 pnpm 的严格隔离由此而来);Node 内置模块(带 node: 前缀:`node:fs`,现代写法,防与包名冲突)。

## 第三站:核心模块地图

- **`fs` 文件系统**:三套 API——同步(fs.readFileSync,启动脚本用)、回调(fs.readFile,老代码)、**Promise(fs/promises.readFile,现代默认)**;目录( readdir/mkdir/rm)、watch 监听、文件信息 stat、大文件用流(见后)。
- **`path`**:`join`(智能拼接)vs `resolve`(解析成绝对路径)、`basename/dirname/extname/parse`。
- **`http`/`https`**:`http.createServer((req, res) => ...)` 原生起服务——**学习原理可以,写业务用框架**(Express/Nest/Fastify)。
- **`url`**:new URL(标准类,parse 老 API 废弃)、URLSearchParams 查参数。
- **`events`**:**EventEmitter**——`on/once/emit/off`;**error 事件特殊**(emit('error') 没人监听会抛未捕获异常);`util.inherits` 老式继承 emitter,现在用 `class X extends EventEmitter`——很多核心模块(流、http)都是 EventEmitter 的子类,"事件驱动"的骨架。
- **`stream`**:见第十一站前?不,放进阶章节。
- **`process`**:`process.env`(环境变量)/`argv`(命令行参数,解析用 commander 库)/`exit`/`cwd`/`platform`;信号处理(process.on('SIGTERM') 优雅退出)。
- **`os`**:CPU 核数(os.cpus().length——cluster 数量依据)/内存/平台。
- **`crypto`**:`randomBytes`/`createHash`(sha256)/`createHmac`/`pbkdf2`(密码哈希)/`randomUUID`——别自己发明加密。
- **`util`**:`promisify`(回调转 Promise,老库集成)、`inspect`。
- **`Buffer`**(Node 特色):二进制数据容器(与 Uint8Array 同源),TCP/文件/加密的搬运工,`Buffer.from/alloc/toString`。

## 第四站:事件循环与 libuv——Node 的发动机

**事件循环的六个阶段**(Node 面试必考,能画图就赢了):`timers`(执行 setTimeout/setInterval 回调)→ `pending callbacks`(系统回调)→ `idle, prepare`(内部)→ **`poll`(核心:取新的 I/O 事件,如网络/文件完成回调;没有任务时会在这里等待)** → `check`(setImmediate)→ `close callbacks`(关闭事件)。
规则细节:**每进入一个阶段,先清空该阶段的队列;阶段之间会执行微任务队列**(Promise.then)与 **`process.nextTick`(优先级比微任务还高!nextTick 队列在每次阶段切换前清空)**——所以 `nextTick` 递归会饿死事件循环。**setTimeout vs setImmediate 的顺序**:在 poll 阶段外(如主模块)取决于计时器到期,结果不固定;在 poll 阶段内(setTimeout 回调里)setImmediate 必先执行——经典面试题。
**浏览器 vs Node 的循环差异**:浏览器没有阶段模型、nextTick 不存在、微任务时机略有不同(浏览器每个宏任务后清空,Node 阶段间清空)。**libuv**:跨平台异步 I/O 库(Windows IOCP/macOS kqueue/Linux epoll 的封装);分工:**网络/管道等用系统级非阻塞 + 事件通知(不进线程池),文件系统与 crypto 等用线程池(默认 4 线程,`UV_THREADPOOL_SIZE` 可调)**——所以"Node 单线程"不准确:JS 执行单线程,I/O 另有线程池。
**阻塞事件循环的后果**:一个 `while(true)` 或大数组排序会让所有请求、定时器全部卡死——CPU 密集任务必须另开线程/进程。

## 第五站:V8 与内存

**V8 编译流水线**:源码 → 解释器 Ignition(字节码)→ 热点代码被 TurboFan **JIT 编译成机器码**;**隐藏类**(相同形状的对象共享类,属性增删导致类转换——所以对象形状稳定更快)与**内联缓存**(同位置调用缓存类型)。**垃圾回收**:分代——**新生代**(刚分配的对象,Scavenge 复制算法,From/To 双空间)**与老生代**(晋升后,Mark-Sweep 标记清除 + Mark-Compact 整理,增量/并发标记减少停顿);**Node 内存上限**:老生代默认约 2~4GB(视版本),`--max-old-space-size=4096` 调整(64 位);**排查内存泄漏**:`--inspect` 打开 Chrome DevTools Memory 面板打堆快照对比、heapdump 库;**泄漏三大源**:无界缓存/全局数组、事件监听器只加不移(EventEmitter 的锅)、闭包长期持有大对象、定时器没清。

## 第六站:异步编程深水区

回调(error-first 约定:`(err, data) => &#123;&#125;`)→ Promise → **async/await**(现代主力,上一门课已学,这里讲 Node 实践):**并发控制**(`Promise.all` 一把梭会瞬间打爆数据库/第三方——用 p-limit 限流或分批)、`Promise.allSettled`(批量任务不因单败中断)、**取消**:AbortController 配合 fetch/超时;**全局兜底**:`process.on('unhandledRejection', ...)`(async 里漏 catch 的 Promise 拒绝——现代 Node 默认直接崩,别让它发生)、`uncaughtException`(最后防线,记录后退出重启);**同步 API 的使用边界**:启动阶段与 CLI 脚本可以,服务器请求路径禁用(阻塞循环);`util.callbackify/promisify` 桥接两代风格。

## 第七站:Express 与 Web 开发

**Express**(最流行、最基础的 Node Web 框架;新项目也可以直接 Nest/Fastify,但 Express 心智是通用的):路由 `app.get('/users/:id', handler)`;取参三件套:`req.params`(路径)/`req.query`(查询串)/`req.body`(请求体,配 `express.json()`);**中间件机制(Node 后端最重要的心智)**:`app.use(fn)` 串成"洋葱模型"——请求依次穿过中间件再到路由,响应再逆序穿回;`next()` 放行、顺序敏感(写在路由前的才生效)、`app.use(express.static('public'))` 静态服务;常见中间件:morgan(日志)/helmet(安全响应头)/cors(跨域)/compression(gzip)/express-rate-limit(限流);**错误处理**:四参中间件 `(err, req, res, next)` 兜底、异步 handler 包 asyncHandler(Express 5 原生支持 async 错误传递)、统一错误响应 (&#123; error: &#123; code, message &#125; &#125;);**RESTful**:资源复数命名、方法语义(GET 查/POST 建/PUT 全量改/PATCH 局部改/DELETE)、状态码(200/201/204/400/401/403/404/409/422/500——别全返回 200)、版本化(/api/v1)。
**项目分层**(从小白到工程的跨越):routes(路由声明)→ controllers(取参调服务)→ services(业务逻辑)→ 数据层(ORM),配错误码与校验层——**别在路由里写 SQL**。

## 第八站:数据库与 ORM

选型与接入:关系库配 **Prisma**(现代首选:schema.prisma 声明模型 → 迁移 → **类型安全客户端**(TS 全链路)、MongoDB 配 **Mongoose**(Schema 约束 + Model + populate 关联);老项目 Sequelize/TypeORM 会读即可;Knex 是查询构建器(不用 ORM 时)。**通用要点**:连接池(别每请求新建连接)、**N+1 查询**(循环里查库——用 include/预加载或连表)、事务(转账/下单多步写)、迁移(表结构变更走版本管理,别手改库)、种子数据;查询性能:索引(见 [MySQL 学习路线](/learning-paths/database/mysql)/[MongoDB 学习路线](/learning-paths/database/mongodb));**Redis**:缓存/限流/队列的底座,见 [Redis 学习路线](/learning-paths/database/redis)。

## 第九站:认证、安全与文件

**认证三方案**:Session + Cookie(服务端存会话)、**JWT(无状态:签发→客户端保存→每请求带 Authorization: Bearer——校验签名与过期,注意注销难、密钥管理)**、OAuth2/第三方登录(见 [认证授权学习路线](/learning-paths/security/auth));**密码存储铁律**:`bcrypt` 或 argon2 哈希(**永远不存明文、不自己 md5**),登录比对用库的 compare;**权限**:中间件里验 token → 挂 req.user → 角色/资源校验;**安全清单**(Node 版):helmet 安全头、CORS 白名单(别 `*` 配凭证)、输入校验(zod/joi——**别信 req.body**)、SQL 注入(ORM 参数化自动挡)、XSS(输出转义,见前端课)、CSRF(SameSite + token)、限流防爆破、`npm audit` 依赖审计、别把密钥写进代码(.env + 不上传)。
**文件上传**:multer(内存/磁盘存储、大小与类型限制、文件名重生成)、大文件分片与断点续传概念、云存储(S3/OSS 直传签名)、图片处理 sharp;下载用流(`res.download` / 流式 pipe)。

## 第十站:实时通信与任务队列

**WebSocket**:`ws` 库(握手升级 + 双向消息),自己管理心跳/重连;**Socket.IO**(WebSocket 的上位封装:自动降级轮询、**房间 room 与广播**、断线自动重连、ack 回调——聊天室/协作/实时通知的标准答案);**SSE**(Server-Sent Events:单向服务器推送,基于 HTTP,自动重连,适合通知流/流式输出——比 WebSocket 轻)。**队列(BullMQ + Redis)**:任务化三件套(邮件、图片处理、推送、定时报表)——`Queue.add`(延迟/优先级/重试 attempts/backoff)→ Worker 消费(并发数)→ job 状态机(等待/活跃/完成/失败);**node-cron** 定时;原则:**请求里别干重活**,重活进队列异步做(用户秒回 + 任务可靠)。

## 第十一站:测试与工程质量

**测试栈**:Jest 或 Vitest(单测:纯函数/服务层)、**Supertest**(起 Express 实例模拟 HTTP 请求断言响应——API 测试主力)、Mock 外部依赖(数据库/第三方,别真发请求)、覆盖率;**测试策略**:服务层逻辑全测、API 层测状态码与校验、数据库用测试库或内存库;**TypeScript**:现代 Node 项目默认 TS(类型安全救后端),运行用 tsx(Node 20+ 原生 --experimental-strip-types 也在路上),类型见 [TypeScript 学习路线](/learning-paths/frontend/typescript);**规范**:ESLint + Prettier、编辑器调试(`--inspect` + Chrome DevTools、VS Code 断点)。

## 第十二站:性能、部署与生产

**吃满多核**(Node 单进程只用一核):`cluster` 模块(master 分发 worker、IPC 通信、round-robin)——现代实践是**交给 PM2 或容器编排**(K8s 按副本扩容),cluster 了解原理;**Worker Threads**(`worker_threads`):同进程多线程跑 CPU 密集(图像处理/大数据计算),与主线程 postMessage 通信;**PM2**:进程守护(崩了自动拉起)、日志管理、`pm2 reload` 零停机、负载均衡模式;**Docker 部署**:多阶段构建(构建镜像 → 精简运行镜像)、`NODE_ENV=production`、非 root 用户、健康检查,见 [Docker 学习路线](/learning-paths/devops/docker);**Nginx 反向代理**(静态资源 + gzip + 转发,见 [Nginx 学习路线](/learning-paths/middleware/nginx));**日志**:pino 或 Winston(JSON 结构化、异步写入、级别),别 console.log 裸奔;**监控与告警**:Sentry(错误)、Prometheus + Grafana(指标)、健康检查端点 /healthz;**压测与性能分析**:autocannon(压测)/clinic.js(事件循环延迟/CPU/内存一键诊断)/0x(火焰图)/`node --prof`;**优化清单**:全异步(请求路径禁同步 fs)、缓存热数据(内存/Redis)、连接池、压缩、静态资源 CDN、HTTP/2、避免每次请求创建大对象、日志异步。

## 通关标准

能独立做到:讲清事件循环六阶段与 nextTick/微任务的执行时机(拿一段混排代码说输出顺序);用 Express + Prisma + zod 写出带校验、JWT 认证、错误统一处理的 REST API;说清中间件洋葱模型与错误中间件;会写流式处理大文件(pipeline)并解释背压;用 BullMQ 把邮件/图片任务异步化;项目能过安全清单并用 PM2/Docker 部署——Node.js 主线通关。

Node.js 把 JavaScript 的边界从浏览器推到了服务器:前端工程师因此能一人通吃全栈,后端也因此有了最活跃的 npm 生态。它的价值不在"快"(CPU 场景确实不如 Go/Rust),而在**I/O 密集型场景的极致效率与全栈语言统一**。下一步:上 [NestJS](/learning-paths/backend/nestjs)(企业级架构:DI/模块化/装饰器)或补 [TypeScript](/learning-paths/frontend/typescript),再往 [微服务](/learning-paths/microservices/microservices-patterns) 与消息队列走——Node 的后端之路,才刚刚开始。
