# Laravel 学习路线

Laravel 是 PHP 界的"艺术品"与事实标准:优雅的语法、全功能全家桶(ORM/模板/认证/队列/调度/通知/测试)、活跃的社区与丰富的包生态,让"PHP 过时了"的说法不攻自破——WordPress 代表老派 PHP,Laravel 代表**现代 PHP**。适合快速开发 Web 应用、内容/电商/后台系统与 API;哲学是"**让开发者快乐**"。前置:先把 [PHP 语言](/learning-paths/languages/php) 学扎实(Composer/PSR/命名空间/OOP)。

这条线按 **环境与项目 → 路由 → 控制器与请求响应 → 中间件与 Blade → Eloquent 与迁移 → 关系与查询 → 认证授权 → 队列调度与通知 → 缓存存储日志 → API 与测试 → 部署与生态** 推进。

## 第一站:环境与项目结构

**安装**:Composer 是前提——`composer create-project laravel/laravel blog` 或全局 Installer(`laravel new blog`);**开发环境三选**:本地 PHP + `php artisan serve`、Valet(macOS 轻量)、**Sail(Docker 全家:PHP/MySQL/Redis——官方推荐,一条命令起全套)**。
**目录结构**(约定优于配置,先认路):`routes/`(web.php 页面路由、api.php API 路由——**Laravel 的路由全在这,没有 Django 式 urls 分散**)、`app/Http/Controllers`、`app/Models`、`database/migrations + seeders + factories`、`resources/views`(Blade)、`config/`(按文件分配置)、`public/`(唯一 Web 根)、`.env`(环境变量——**密钥/数据库配置都在此,别提交**)。
**Artisan CLI(Laravel 的瑞士军刀)**:`php artisan serve`/`make:model -m`(模型+迁移)/`make:controller --resource`/`make:migration`/`migrate`/`tinker`(交互式 REPL——试 Eloquent 查询神器)/`route:list`(看全部路由)/`make:request/job/mail/notification`……**"先用 Artisan 生成,再改代码"是 Laravel 工作流**。

## 第二站:路由

`Route::get('/users', ...)`(post/put/delete/any 全家);**参数**:`&#123;id&#125;` 必选/`&#123;id?&#125;` 可选 + 默认/正则约束 `->where('id', '[0-9]+')`;**命名**:`->name('users.show')`,视图与代码里 `route('users.show', $user)`(**永不硬编码 URL**);**分组**:`Route::prefix('admin')->middleware('auth')->group(...)`、name 前缀;控制器写法:`Route::get('/users', [UserController::class, 'index'])`;**资源路由**(CRUD 极速通道):`Route::resource('posts', PostController::class)` 一条命令注册 7 条 RESTful 路由(可用 `->only(['index','show'])` 裁剪,`apiResource` 是 API 版);**路由模型绑定**(Laravel 的优雅):`Route::get('/users/&#123;user&#125;', fn (User $user) => ...)`——**类型提示模型,框架自动按 id 查好并注入**(404 自动),还能自定义绑定字段(按 slug);`fallback`(404)、`view` 路由。

## 第三站:控制器、请求与响应

**控制器**:`php artisan make:controller UserController --resource`;控制器方法里**依赖注入**:`public function store(StoreUserRequest $request)`——Laravel 自动解析注入;**Request 取数**:`$request->input('name')`/`all()`/`query()`/`json()`、`has()` 判断、`$request->user()`(当前登录用户);**文件上传**:`$request->file('avatar')` → `store('avatars', 'public')`(存储抽象,见缓存站);**表单验证**(两档):控制器里 `$this->validate($request, ['email' => 'required|email'])` 快速档,或 **FormRequest 类(现代标准)**:`php artisan make:request StoreUserRequest`——`rules()`(验证规则:required/email/unique:users/confirmed/max 与数组/自定义 Rule)、`authorize()`(授权:能不能执行此操作)、`messages()` 中文错误;验证失败自动重定向回表单带错误($errors 在视图可用;API 模式自动返回 422 JSON)。
**响应**:`response()->json($data, 201)`/`view('posts.show', compact('post'))`/`redirect()->route('posts.index')->with('success', '创建成功')`(flash 消息:一次性 session)/`download()`/`streamDownload()`;统一 API 响应结构(自定义 response 宏或 Resource 层,见 API 站)。

## 第四站:中间件与 Blade

**中间件**:`php artisan make:middleware CheckAdmin`——`handle($request, Closure $next)` 里 `$next($request)` 之前是前置逻辑(校验/限流)、之后是后置(加头);注册:`app/Http/Kernel.php`($middleware 全局/$middlewareGroups(web/api 组)/$routeMiddleware 别名——注意 Laravel 11 新结构 bootstrap/app.php);路由用 `->middleware('auth')`(内置:auth/guest/throttle(限流)/verified/can);**中间件与控制器构造器**:`__construct` 里 `$this->middleware('auth')->except('index')`(老写法,Laravel 11 建议路由内联)。
**Blade 模板**(服务端渲染年代的主力,API 模式可跳过):`&#123;&#123; $name &#125;&#125;`(**自动转义防 XSS**)/`&#123;!! $html !!&#125;`(原样输出,危险品)/`@if/@foreach/@auth/@guest`、布局 `@extends('layouts.app')` + `@section/@yield` 或现代 **`&lt;x-layout&gt;` 组件**(Blade 组件与匿名组件:`<x-alert type="error">`——Laravel 组件系统是 Blade 的现代姿势)、`@csrf`(表单安全令牌)、`@error`(显示字段错误)、自定义指令;前后端分离项目用不到 Blade,学 API 模式即可。

## 第五站:Eloquent 与迁移

**Eloquent ORM(Laravel 的灵魂)**:模型约定——`User` 模型对应 `users` 表(蛇形复数)、主键 id、自动维护 `created_at/updated_at`(可关);**`$fillable` 白名单(mass assignment 防护核心**——`User::create($request->all())` 只写入白名单字段,防用户塞 `is_admin`;`$guarded = ['*']` 反向;**软删除**:`use SoftDeletes` + deleted_at(查询默认排除,`withTrashed()/onlyTrashed()/restore()`——唯一索引与软删除的坑注意);**访问器/修改器**:模型上虚拟字段(`getFullNameAttribute` → `$user->full_name`)与写入前处理(`setPasswordAttribute` 自动 bcrypt——**密码哈希放模型,别散落在控制器**);**查询作用域**:`scopeActive` → `User::active()->get()`(业务查询条件收进模型);**模型事件**:creating/created/updating 钩子(审计/自动填充 slug——与 Django 信号同思路)。
**迁移**(表结构版本化):`Schema::create('users', function (Blueprint $table) &#123; $table->id(); $table->string('email')->unique(); ... &#125;)`——字段类型(string/text/integer/foreignId/dateTime/json/enum……)、索引/外键 `->constrained()->cascadeOnDelete()`;`php artisan migrate`(执行)/`migrate:rollback`(回滚最近一批)/`migrate:fresh`(重建,危险:清数据)/`migrate:status`;修改已有表用新迁移(Schema::table),**别手改数据库**。

## 第六站:关系与查询

**Eloquent 关系全家**(定义在模型方法里):一对一 `hasOne/belongsTo`(用户→资料)、一对多 `hasMany`(文章→评论)、多对多 `belongsToMany`(用户↔角色:自动中间表,可带 pivot 字段/`withPivot`)、`hasManyThrough`(国家→通过用户→文章)、**多态 `morphMany/morphTo`**(同一张 comments 表挂文章和视频——`morphs` 迁移);**关联即查询**:`$user->posts()->where('published', 1)->get()`(关系方法返回查询构建器——还能继续链)、`$user->posts` 魔法属性(直接取集合);**预加载(防 N+1 的核心)**:`Post::with('author', 'comments.user')->get()`——**Laravel 面试必问**:循环里访问 `$post->author` 会每条查一次库(100 条 = 101 条 SQL),with 预加载后 3 条;`load()` 延迟加载、`withCount`(关联计数,列表页"评论数"零额外查询)。
**查询构建器**(DB::table,离开 Eloquent 的 SQL 层):`where('age', '>', 18)`/`orWhere`/`whereBetween`/`whereIn`/`whereNull`、`orderBy/latest`、`groupBy/having`、**分页**:`paginate(15)`(页面式,带 ?page=)/`cursorPaginate`(游标式,无限滚动现代推荐)/`simplePaginate`;聚合 count/sum/avg;**事务**:`DB::transaction(function () &#123; ... &#125;)`(闭包内异常自动回滚——扣库存/转账必用);原生 `DB::select` 少用(参数绑定)。
**Seeder + Factory**:`php artisan make:factory PostFactory` 定义假数据(名称/段落/随机)、`User::factory()->count(10)->hasPosts(3)->create()`(关联工厂)、DatabaseSeeder 组织,`php artisan db:seed`——**测试与本地开发的弹药库**。

## 第七站:认证与授权

**登录脚手架**(别手写认证):**Breeze**(轻量:登录/注册/密码重置/邮箱验证,UI 可选 Blade/Livewire/React/Vue——小项目起步标配)与 **Jetstream**(全家:双因素认证/团队管理/API 令牌,功能全但重),后端引擎 **Fortify**(无 UI 的认证服务,可自配前端);核心机制:Session 登录 + 内置路由;别忘了 **`php artisan make:auth` 是古董**(Laravel 6 时代),新项目用 Breeze/Jetstream。
**授权两件套**:Gate(闭包:`Gate::define('update-post', fn (User $u, Post $p) => ...)`)与 **Policy(资源授权类**:`php artisan make:policy PostPolicy --model=Post`,方法 update/delete……);使用:控制器里 `$this->authorize('update', $post)`、Blade `@can('update', $post)`、中间件 `->can('update', $post)`——**写清楚"谁能改这个资源"是 Laravel 应用的安全骨架**。
**API 认证**(无状态):**Laravel Sanctum(官方标准)**:个人访问令牌(Sanctum::createToken——移动端/第三方)、SPA 会话认证(同域 Cookie——Inertia 应用)、token 能力(abilities 细粒度);OAuth2 服务端(第三方登录授权)才用 **Passport**(重,基于 League OAuth2)——原理见 [认证授权路线](/learning-paths/security/auth)。

## 第八站:队列、调度、事件与通知

**队列(异步化重活)**:驱动 config/queue.php(默认 database,生产 **Redis**);`php artisan make:job SendWelcomeEmail` → 控制器里 `SendWelcomeEmail::dispatch($user)` 或 `$user->notify(...)` 队列化;**延迟/优先级**:`->delay(now()->addMinutes(10))`;失败处理:failed_jobs 表 + `queue:retry` + `queue:failed`;`php artisan queue:work`(**生产必须常驻进程**,Supervisor 守护,重启才生效新代码——部署流程的一环);`queue:monitor`/Horizon(Redis 队列仪表盘+监控,生产推荐)。
**任务调度**(应用内 cron,替代散落 crontab):`app/Console/Kernel.php` 的 `schedule` 里 `$schedule->command('report:send')->dailyAt('09:00')`——服务器只需一条 `* * * * * php artisan schedule:run` 每分钟触发;`withoutOverlapping()` 防任务重叠(长任务没跑完不触发下次)。
**事件与监听**(应用内解耦):Event + Listener(`php artisan make:event OrderShipped` + 监听器),EventServiceProvider 注册;监听器实现 `ShouldQueue` 自动异步;**事件广播**(Realtime:echo + Reverb(官方 WebSocket 服务器)/Pusher——订单状态实时推送)。
**通知系统**(多渠道一次发):`php artisan make:notification OrderShipped`——一个通知类定义 mail/短信(SMS 服务商)/Slack/数据库渠道;**数据库通知**(站内信:notifications 表 + 前端轮询/广播),`notify()` 与 `Notification::send($users, ...)`。

## 第九站:缓存、存储与日志

**缓存**:驱动 file/redis/数据库;`Cache::put('key', $value, 600)`/`get`/`remember`(回调自动算并缓存——**热点查询一行缓存**)/`forget`;**缓存标签**(Redis 支持:批量失效一组 `Cache::tags(['posts'])->flush()`);**原子锁 `Cache::lock('stock', 10)->get()`**(分布式锁:扣库存/防并发提交——队列任务防重的现代答案);缓存失效:模型事件里 forget(updated 后清相关缓存)。
**文件存储(Storage 抽象)**:`Storage::disk('public')`(storage/app/public + `php artisan storage:link` 软链)/`s3`/`oss`——**换云存储不改业务代码**;上传 `store('avatars', 'public')`、可见性(public/private)、URL、流式(大文件 `streamDownload`);**日志**:`Log::info('订单创建', ['order' => $order->id])`——通道 config/logging.php(单文件 stack/每日 daily/自定义,生产 JSON + 轮转 + Sentry 集成)。

## 第十站:API 开发与测试

**API 模式**(Laravel 既是全栈框架也是优秀 API 框架):路由 `api.php`(自动 /api 前缀)+ `apiResource`;**API Resource(输出控制层)**:`php artisan make:resource UserResource`——`toArray` 里定义返回哪些字段/怎么变形(隐藏敏感、格式化日期)、`whenLoaded('posts')` 条件包含关系、`when` 条件属性、集合 `UserResource::collection($users)`(分页自动包装 data)、**meta 元数据**(分页信息);**输出与输入的对称设计**:Request(输入校验)与 Resource(输出裁剪)是 Laravel API 的两道门。
**测试**(PHPUnit 集成,功能测试为主):`php artisan test`;测试类继承 TestCase:**HTTP 测试**——`$this->get('/api/posts')`/`postJson('/api/posts', $data)`/`actingAs($user)`(模拟登录)/断言 `assertStatus(201)`/`assertJson(['data' => [...]])`/`assertDatabaseHas`;**RefreshDatabase**(每测试迁移,测试库独立);工厂造数;**Fake 断言(测试精髓)**:`Queue::fake()` + `Queue::assertPushed(SendEmail::class)`、`Mail::fake()`/`Event::fake()`/`Notification::fake()`——**测"该派的派了、该发的发了",不真发**;浏览器 E2E 用 Laravel Dusk;覆盖率 phpunit --coverage。
测试策略:表单验证(非法输入 302/422)、授权边界(他人资源 403)、核心业务状态流转。

## 第十一站:部署与性能

**部署清单**:`.env` 生产配置(APP_ENV=production/APP_DEBUG=false/APP_KEY 生成)、`composer install --no-dev --optimize-autoloader`、**优化命令**:`php artisan config:cache`(**注意:配置缓存后 .env 改动不生效,要 config:clear**)/`route:cache`/`view:cache`、`php artisan migrate --force`;**Nginx 配置核心:root 指向 public/**(别把整个 Laravel 目录暴露,`.env` 泄露事故就是这么来的)+ PHP-FPM;队列 worker(supervisor 守护,失败自动拉起);调度 cron 行;零停机(容量池/Environments 工具 Forge/Envoyer 或 K8s)。
**性能三板斧**:①预加载灭 N+1(见关系站);②Redis 缓存热点与全页缓存;③**Octane**(Swoole/RoadRunner 常驻内存——应用常驻后吞吐提升数倍,现代高性能部署方向,注意静态属性状态与连接管理);辅助:查询索引、Debugbar/Telescope(开发期看 SQL 与耗时——**Telescope 是排查神器**:每请求的 SQL/异常/队列/邮件全记录)、响应 gzip、CDN;**生态地图**:Filament(现代后台管理,人气王)/Nova(官方付费后台)、Livewire(无 JS 的交互全栈)与 Inertia(前后端同仓:Vue/React SPA 数据直通——现代全栈三选一:Blade 传统 / Livewire 简单交互 / Inertia 重前端)、Lighthouse(GraphQL)、Cashier(支付 Stripe/Paddle)、Socialite(第三方登录 OAuth 全家)、Scout(全文搜索,配 Meilisearch/ES)。

## 通关标准

能独立做到:用迁移 + Factory + Seeder 建数据层,写出带 FormRequest 校验、Policy 授权、Resource 输出的完整 CRUD(路由模型绑定 + 预加载);说清 fillable 与 mass assignment、预加载为什么防 N+1、队列 worker 为什么必须常驻、config:cache 与 .env 的关系;会用 Sanctum 给 API 上认证并用 Queue::fake 写断言测试;用 Breeze 起步的登录体系能讲出完整流程——Laravel 主线通关。

Laravel 教会你的不止是 PHP:它把"开发者体验"做成了产品——Artisan 生成、优雅 ORM、测试友好,让写后端第一次有了"行云流水"的感觉。它也有自己的代价(魔法多、性能需优化),但配上队列、缓存、Octane 后完全能撑起生产。PHP 的岗位里,Laravel 工程师是其中最体面的一档——从 `laravel new` 开始,体验一下"让开发者快乐"不是口号。
