# Rust Web 学习路线

Rust 以**内存安全 + 极致性能 + 无畏并发**著称:没有 GC 也不用手动管理内存——编译器用**所有权系统**在编译期就拦下悬垂指针、数据竞争、use-after-free 一整类 bug;性能与 C/C++ 同级,又给你现代语言(模式匹配、trait、async/await)的表达力。Discord、Cloudflare、Figma 的关键组件都在用 Rust 重写。**用 Rust 写 Web 服务,性能上几乎没对手**(Tokio 异步 + 极致并发)。代价是学习曲线陡峭——**前两周你会跟借用检查器搏斗,之后它会成为你最严格的老师**。这条页覆盖 **Rust 语言核心 + Web(Axum 为主)**。前置:建议先有 [C/C++](/learning-paths/languages/cpp)(懂指针与内存)或 Go 的经验;HTTP 知识见 [计算机网络](/learning-paths/cs-basics/computer-networks)。

这条线按 **语言核心(所有权/借用/生命周期)→ 错误处理与 trait → 异步与 Tokio → 框架选型 → Axum 路由提取器 → 状态与中间件 → 数据与数据库 → 错误与认证 → 工程化 → 部署与生态** 推进。

## 第一站:Rust 语言核心——所有权与借用

**工具链**:rustup(版本管理)+ cargo(构建/依赖/测试一体:`cargo new`/`build`/`run`/`test`/`clippy`/`fmt`);Cargo.toml 管依赖(crates.io 生态)。**所有权(Ownership,理解 Rust 的第一关)三大规则**:①每个值有且只有一个"所有者"变量;②所有者离开作用域,值被自动释放(drop——**没有 GC、没有手动 free,靠作用域**);③值可以转移(move)。**移动语义**:`let s2 = s1;` 之后 s1 不可用(String 在堆上,赋值是 move 不是拷贝——**与 C++ 的拷贝语义不同,与 Go/Python 的引用也不同**);实现 `Copy` trait 的类型(int/float/bool/char/元组)赋值才是拷贝;要深拷贝显式 `s1.clone()`。**借用与引用(Borrowing)**:`&s` 只读借用(可多个)/`&mut s` 可变借用(唯一)——**同一时刻:要么多个不可变借用,要么一个可变借用**(编译期强制,数据竞争在编译期被消灭——这就是"无畏并发"的根基);借用不能比所有者活得久。**生命周期(Lifetimes)**:`'a` 标注是"给编译器看的关联关系"(`fn longest<'a>(x: &'a str, y: &'a str) -> &'a str`——返回的引用与谁同寿);大部分场景可省略(规则),struct 持有引用时要标注;理解"生命周期不是运行时概念,是编译期检查"。**String vs &str**:String(拥有、可变的堆字符串)vs &str(字符串切片,借用视图)——函数参数用 `&str`(不拥有、可传 String 引用与字面量)。**复合类型**:元组、数组、**切片** `&[T]`;`struct`(字段)与 `impl` 块(方法:`self`/`&self`/`&mut self`——**方法默认借用**)、关联函数(::new());**枚举与模式匹配**(Rust 的灵魂):`enum Option<T> { Some(T), None }` 与 `enum Result<T, E>` 是语言的一部分(没有 null!),`match` 穷尽匹配(编译器强制处理所有分支——**加新枚举变体时所有 match 报错提醒你**)、`if let`/`while let`/`_` 通配、解构;**集合**:Vec(动态数组)/HashMap/HashSet/String——遍历、迭代器(见第四站)。

## 第二站:错误处理、trait 与迭代器

**错误处理**(无异常机制,错误是值):函数返回 `Result<T, E>`;处理:`match` 或 **`?` 运算符**(`let user = fetch_user(id).await?;`——出错自动 return Err,把错误向上传播;**? 是 Rust 的"错误冒泡语法糖",代码因此干净得像没有错误处理**);Option 也能 `?`(None 提前返回);**自定义错误**:枚举 + 实现 `std::error::Error`——实践中用 **thiserror**(库:声明式定义错误枚举)与 **anyhow**(应用:任意错误 `anyhow::Result<T>` + context 加上下文)两个 crate;`unwrap/expect`(开发期/确定不失败时用,生产别裸用)。**trait(行为接口)**:`trait Greet { fn greet(&self) -> String; }` + `impl Greet for User {}`——**为任何类型(包括别人的类型)实现 trait**;**derive 派生**(Rust 省样板的核心):`#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]` 自动生成实现——对比手写 Java equals/toString;**泛型**:`fn max<T: Ord>(a: T, b: T) -> T`(约束 trait bound);`dyn Trait` 动态分发(少用,优先泛型);**迭代器与闭包**:`.iter()/into_iter()/iter_mut()`、`.map().filter().collect()::<Vec<_>>()`(与函数式语言同款;迭代器是惰性的)、闭包 `|x| x + 1`(可捕获环境,`move` 关键字转移捕获——spawn 线程必备)、`Iterator` trait(为自己类型实现迭代)。

## 第三站:异步与 Tokio

**async/await**:Rust 的异步是**零成本**的(无运行时线程);`async fn` 返回 **Future**(惰性:不执行不跑——**必须 await/spawn 才会推进**,这是与 JS/Python 最大的心智差异);**Tokio 是事实标准运行时**:`#[tokio::main]` 入口、`tokio::spawn(async {})`(并发任务,返回 JoinHandle)、`select!`(多 Future 竞速)、`tokio::time`(sleep/超时)、mpsc channel(任务间通信)、`Arc<Mutex<T>>`(共享可变状态——Tokio 下多用 `tokio::sync::Mutex` 或拆分状态避免锁);**异步生态**:HTTP 底层 hyper、Web 框架 axum/actix、数据库 sqlx/tokio-postgres、Redis fred/redis-rs——几乎全异步;**"把阻塞操作放 spawn_blocking"**(同步库调用会卡运行时);并发心智:任务轻量(可百万级),共享数据优先"消息传递"或锁+Arc。理解 Future 的轮询模型(Poll/Waker)是进阶,先用好 spawn/select/join。

## 第四站:Web 框架选型

**Axum**(现代主流,Tokio 官方生态,基于 tower 中间件体系):类型安全路由、提取器优雅、与 tokio/tower 无缝——**新项目默认推荐,本页以它为准**;**Actix-web**(老牌,性能王者,Actor 模型,生态成熟——大厂存量多);Rocket(宏驱动,语法优雅,异步支持成熟);warp(函数式 filter,了解);Poem(国产,功能全)。选型建议:学 Axum(tower 生态是 Rust 服务端的方向),能读 Actix 老代码即可。

## 第五站:Axum:路由、提取器与响应

**路由**(类型安全,编译期检查路径):`Router::new().route("/users/:id", get(get_user).post(create_user))`(方法链式)、`nest("/api", api_routes)`(模块化嵌套)、`route_service`(静态文件);**handler**(异步函数,返回值实现 IntoResponse)。**提取器 Extractors(从请求里取数据的类型化方式)**——handler 参数即提取:`Path<i32>`(路径参数,可元组/结构体)、`Query<Params>`(查询串,结构体字段可选)、`Json<CreateUser>`(请求体,**必须 serde Deserialize**)、`HeaderMap`/`String`(原始体)/`Form`(表单)、`State<AppState>`(共享状态,见下)——**提取器有顺序**(Path/Query/Json 等无依赖的在前;自定义提取器实现 FromRequest);提取失败自动 400/422。**响应**:`Json<T>`(序列化)、`(StatusCode, Json<T>)` 元组(状态码+体——API 日常)、`impl IntoResponse` 自定义(错误类型实现它,见第七站)、Html/Redirect/流式(SSE: `Sse`)。**axum 的类型体操**:Handler 泛型 + 提取器组合,编译错误一开始会吓人(长类型),习惯后是"编译器替你检查路由与参数"的爽。

## 第六站:状态、中间件与共享

**共享状态**(连接池/配置/客户端):`struct AppState { db: PgPool, config: Arc<Config> }` → `Router::new()...with_state(Arc::new(AppState))` → handler `State<Arc<AppState>>` 提取——**Rust 无 GC,跨任务共享靠 Arc(原子引用计数)+ 不可变借用**,需要可变就 `Arc<Mutex<T>>`(尽量少,拆状态或用 channel)。**中间件(Tower 体系)**:tower 是 Rust 服务端的"中间件标准"(Service 抽象:请求→响应,可组合层);**tower-http 全家**:`TraceLayer`(请求日志+span)/`CorsLayer`(跨域配置)/`TimeoutLayer`(超时)/`CompressionLayer`(gzip)/`RequestIdLayer`/`CatchPanicLayer`——`Router::new()....layer(TraceLayer::new_for_http())`;**自定义中间件**:`axum::middleware::from_fn`(async 包装函数:鉴权/日志)或实现 tower Layer——鉴权中间件把用户塞进 `request.extensions_mut()` 或直接做提取器。

## 第七站:Serde、校验与数据库

**Serde(序列化事实标准)**:`#[derive(Serialize, Deserialize)]` 即 JSON 互转——`serde_json::to_string/from_str`;字段改名 `#[serde(rename_all = "camelCase")]`(前后端命名习惯)、`#[serde(default)]`(缺省字段)、skip(密码不出参);**校验**:`validator` crate(`#[derive(Validate)]` + `#[validate(length(min = 1), email)]`——在 DTO 上声明,入口校验);**DTO 分层**:请求 DTO(Deserialize+Validate)→ 领域/Entity → 响应 DTO(Serialize,过滤敏感字段);类型转换用 `From` trait(`impl From<Entity> for UserDto`——**? 能自动转错误,From 能自动转类型**,Rust 的转换约定)。**数据库两派**:**sqlx**(主流,异步、原生 SQL 优先:`sqlx::query_as::<_, User>("SELECT ...").bind(id).fetch_one(&pool)`——**SQL 在手,无 ORM 黑盒**;可选 `query!` 宏编译期检查 SQL;支持 Postgres/MySQL/SQLite;自带连接池 `PgPool::connect`、事务 `pool.begin()/commit()/rollback()`、迁移(sqlx-cli migrate))与 **SeaORM/Diesel**(重型 ORM:Diesel 编译期类型安全查询构建器但学习陡、异步支持晚;SeaORM 现代异步)。**推荐**:sqlx + 手写 SQL(性能可控、团队都会),数据量大要 ORM 再上 SeaORM;防注入:sqlx 参数绑定(禁止字符串拼 SQL)。

## 第八站:错误、认证与安全

**统一错误设计**(Rust API 的架构关键):`enum AppError { NotFound, Database(sqlx::Error), Validation(...) }`(thiserror 派生 Display/Error)+ `impl IntoResponse for AppError`(映射状态码与 JSON `{error: {code, message}}`);handler 返回 `Result<T, AppError>`——`?` 一路自动转(sqlx::Error → AppError 用 `#[from]`);**认证**:JWT `jsonwebtoken`(encode/decode/Validation(exp 过期));密码 argon2/bcrypt crate;流程:登录验密发 token → **鉴权中间件或自定义提取器**(解析 Authorization: Bearer → 验签 → 查用户 → 注入请求)——用 `axum::extract::FromRequestParts` 实现 `CurrentUser` 提取器,handler 里 `user: CurrentUser` 直接拿(类型即安全:拿不到根本进不了 handler);RBAC(角色字段+守卫函数);**安全清单**:全入口校验(validator)、sqlx 参数化、CORS 白名单、限流(tower-governor)、超时层、安全头、依赖审计 `cargo audit`、密钥只进环境变量——原理见 [Web 安全](/learning-paths/security/web-security)。

## 第九站:工程化:日志、测试与结构

**日志**:`tracing`(结构化日志+span 链路追踪的事实标准):`tracing_subscriber::fmt().init()` 一行启用、`info!(user_id, "login ok")` 字段式、`#[instrument]` 给函数自动建 span(请求追踪)——与 tower_http TraceLayer 联动即得"每条请求的完整日志链";**测试**:单元测试(`#[cfg(test)] mod tests` + `#[test]`——测试写在模块里,Rust 惯例)、集成测试(tests/ 目录)、**handler 测试**:`tower::ServiceExt::oneshot` 直接对 Router 发请求(axum 官方测试姿势:构造 Router + app.oneshot(Request) 断言响应)、mock 数据库(测试库/容器 sqlx 测试特性)、`cargo tarpaulin` 覆盖率;**工程结构**:`src/main.rs`(入口)+ `routes/`(模块化 Router)+ `handlers/`(或合并)+ `models/`(实体)+ `schemas/`(DTO)+ `state.rs`/`error.rs`/`config.rs`;配置:环境变量(dotenvy)+ config crate;格式化/静态检查:**rustfmt + clippy**(cargo clippy 会给出比编译器更严格且合理的建议——Rust 工具链把代码质量自动化到了新高度)。

## 第十站:性能、部署与生态

**性能优化**:`cargo build --release` 是第一步(开发版慢 10-100 倍);产物优化:`[profile.release] lto = true, codegen-units = 1, panic = "abort"`(体积与速度);写码层面:借用替代 clone、String 复用、避免不必要的 Arc/锁、连接池与超时参数;**部署**:单静态二进制(无运行时依赖,可 `strip`),Docker 多阶段(构建镜像 → **distroless/scratch 运行镜像,常见产物 <20MB**)、`RUSTFLAGS` 静态链接与交叉编译(目标平台 musl);健康检查端点 + 优雅关闭(axum 的 with_graceful_shutdown);监控:Prometheus(axum-prometheus/metrics crate)+ OpenTelemetry(tracing-opentelemetry——Rust 的可观测性与其类型系统一样认真);**生态与方向**:gRPC(tonic + prost:protobuf 编译期生成)、WebAssembly(Rust 是 WASM 头号公民:wasm-bindgen,浏览器里跑 Rust)、CLI(clap 参数解析——Rust 是 CLI 之王)、系统编程(OS/驱动/嵌入式)、游戏(Bevy)、音视频(FFmpeg 绑定);**找工作方向**:区块链/量化/数据库内核/云原生组件/高性能网关(Cloudflare/Discord 类)。

## 通关标准

能独立做到:写一个多层(路由/handler/state/error)的 Axum CRUD 服务(Path/Query/Json 提取、serde DTO、sqlx 连接池与事务、统一错误、JWT 鉴权提取器、tracing 日志);给同事讲清所有权三规则、为什么 `&mut` 同时只能一个、`?` 怎么工作、Arc 解决什么;会写 #[test] 与 oneshot 接口测试;能编译出 release 单二进制并 Docker 化(镜像 <30MB)——Rust Web 主线通关。

Rust 的学习曲线陡,但回报是"编译器当教练"的长期体验:它逼你先想清楚所有权与错误路径,然后运行时几乎不再背叛你。Web 只是 Rust 的入门舞台之一——当你习惯了"编译过=基本没内存 bug"的安全感,再回头看其他语言的手动内存或 GC 停顿,会有种回不去的怅然。别怕借用检查器,它前两周是你的对手,之后是你最可靠的朋友。
