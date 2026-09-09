# Nest.js 学习路线

NestJS 是 Node.js 界的"架构师":如果你受够了 Express 的自由散漫(项目一大就成意大利面),Nest 给你的是**有组织有纪律的企业级结构**——它借鉴 Angular 的模块化与依赖注入,用**装饰器**把路由、校验、鉴权、文档组织得井井有条;TypeScript 不是可选项而是默认项;底层仍可跑在 Express 或 Fastify 上(它不是替代品,是站在它们肩膀上的框架)。学习曲线比 Express 陡,但一旦上手,维护大型后端会舒服得多。前置:[TypeScript](/learning-paths/frontend/typescript) + [Node.js](/learning-paths/backend/nodejs) 基础。

这条线按 **核心概念(模块/控制器/服务/DI)→ 请求生命周期五件套(管道/守卫/拦截器/中间件/过滤器)→ 数据校验 → 数据库 → 认证授权 → 配置与文档 → 通信与任务 → 测试与部署** 推进。

## 第一站:核心理念与项目结构

**CLI**:`npm i -g @nestjs/cli` → `nest new project`(自动生成标准骨架+测试);`nest g resource user`(一键生成全套 CRUD:controller/service/module/dto/entity——**资源生成器是 Nest 生产力核心**)。**三层结构**:`controllers`(接 HTTP,只做参数与响应编排)→ `services`(业务逻辑,@Injectable 的 Provider)→ `modules`(组织单元:把相关 controller+service 打包)。**装饰器驱动**:路由 `@Controller('users')` + `@Get(':id')`、参数 `@Param/@Query/@Body/@Headers/@Req`、注入靠构造器(`constructor(private readonly userService: UserService)`——**TS 类型即注入令牌**,Nest 的 DI 容器按类型自动给)。**请求生命周期总览**(先建立全图,后面各站填细节):请求 → **中间件** → **守卫** → **拦截器(处理前)** → **管道**(校验/转换)→ 控制器/服务 → **拦截器(处理后)** → **异常过滤器**(出错时)。**启动引导**:main.ts 里 `NestFactory.create(AppModule)` + `app.listen(3000)`,全局管道/守卫/前缀在这里注册;`nest start --watch` 开发。

## 第二站:控制器、服务与 DI

**控制器细节**:方法装饰器 @Get/@Post/@Put/@Patch/@Delete;路径参数与通配;`@HttpCode(201)`(POST 默认 201)/`@Header`/@Redirect;返回对象自动 JSON;**@Res() 注入原生响应后 Nest 不再自动处理**(要用 res.status().json() 手动——**能用框架返回值就别碰 @Res**,否则拦截器/装饰器失效)。**服务与 Provider**:`@Injectable()` 标记可注入;业务逻辑只进 service(控制器保持薄);**作用域**:默认**单例**(整个应用一个实例,性能最好——**注意别在单例服务里存请求级状态**)、`Scope.REQUEST`(每请求新实例,可注入 @Req,有性能开销)、`Scope.TRANSIENT`(每次注入新实例);**模块**:`@Module({ controllers, providers, imports, exports })`——exports 决定哪些服务对其他模块可见;**@Global()** 全局模块(如 ConfigModule);**动态模块** `forRoot/forRootAsync`(模块工厂:ConfigModule.forRoot({ isGlobal: true }) 这种可配置模块的模式——**读第三方 Nest 模块源码必懂**);循环依赖用 `forwardRef(() => X)`。**DI 进阶**:provider 三种写法——`useClass`(默认)/`useValue`(常量与 mock:`{ provide: UserService, useValue: mock }`——**测试替换依赖的标准姿势**)/`useFactory`(带依赖的工厂,异步配置);自定义 token(`'CONFIG'` 或 InjectionToken)+ `@Inject(token)`;`@Optional()`(依赖可缺省)。

## 第三站:管道与数据校验

**管道(Pipe)两个职责**:转换(字符串→数字)与校验。**内置管道**:ValidationPipe/ParseIntPipe/ParseUUIDPipe/ParseEnumPipe……(配 @Param('id', ParseIntPipe))。**ValidationPipe 是每日主力**:基于 **class-validator + class-transformer**——DTO 用类 + 装饰器声明:`class CreateUserDto { @IsEmail() email: string; @MinLength(6) password: string }`,控制器 `@Body() dto: CreateUserDto` 处挂 `ValidationPipe`,无效请求自动 400;**选项**:`whitelist: true`(剥掉 DTO 外的多余字段——**防批量赋值攻击**)、`transform: true`(自动把请求体转成 DTO 实例、query 转类型)、`forbidNonWhitelisted`(多余字段直接报错)。**自定义管道**:实现 `PipeTransform`(transform(value, metadata)),做业务校验(如查重);**全局注册**:main.ts `app.useGlobalPipes(new ValidationPipe(...))`。**class-transformer** 还用于响应转换(Entity → DTO 脱敏)。

## 第四站:守卫、拦截器、中间件与异常过滤器

**守卫(Guard)**(认证/授权的家):实现 `CanActivate`,返回 true/false 决定请求放行;执行时机在**中间件之后、管道之前**;**认证守卫**:`AuthGuard('jwt')`(@nestjs/passport 提供,见认证章)或手写——`context.switchToHttp().getRequest()` 取 token 验证后把用户挂 req;**角色守卫**:`@Roles('admin')` 装饰器 + 守卫里 `Reflector` 读元数据(设计模式:装饰器存元数据、守卫反射读取——Nest 面试常考);守卫里可用 `@Public()` 自定义装饰器跳过认证;全局守卫在 main.ts 注册。**拦截器(Interceptor)**:包裹 handler 执行(类似 AOP),基于 RxJS Observable——用途:**响应统一包装**(`{ code: 0, data }` 用 map 操作符)、日志/耗时、缓存、超时(`timeout(5000)`)、重试;实现 `NestInterceptor` + `intercept(context, next)`。**中间件(Middleware)**:与 Express 同概念(函数式或类式,实现 NestMiddleware),`@Module` 的 `configure(consumer)` 里 `apply(X).forRoutes('users')` 或 main.ts 全局;用途:日志、静态、CORS 预处理。**异常过滤器(ExceptionFilter)**:捕获异常并改写响应——`@Catch(HttpException)`/全捕获,实现 `catch(exception, host)` 返回统一错误 JSON + 记日志;**自定义异常**:继承 HttpException(状态码+message)或 `BadRequestException/UnauthorizedException` 全家;业务异常(如"用户不存在")用 NotFoundException,别再手写 res.status。**生命周期全图**(面试闭眼能画):客户端 → 中间件 → 守卫 → 拦截器前置逻辑 → 管道 → 路由处理器(控制器/服务)→ 拦截器后置逻辑 → 异常过滤器(有异常时)。

## 第五站:数据库集成

官方两条路线:**TypeORM**(老牌:实体类 + 装饰器 `@Entity/@Column/@ManyToOne`、Repository 模式 `@InjectRepository(User)`、QueryBuilder、迁移;**relations 与 eager/lazy 加载、N+1 注意**)或 **Prisma**(现代推荐:schema.prisma 声明模型、迁移、**类型安全客户端**——Nest 里封装 PrismaService(继承 PrismaClient,onModuleInit 连库)注入使用);TypeORM 老项目存量巨大(会读),新项目 Prisma 更舒服;事务:TypeORM `dataSource.transaction`、Prisma `$transaction`;配置走 ConfigModule(数据库地址/账号不硬编码);多数据库、读写分离(进阶)。**连接生命周期**:模块 onModuleInit/onModuleDestroy 钩子管理连池。

## 第六站:认证与授权

**Passport 集成**(@nestjs/passport + passport-jwt):`JwtModule.register({ secret, signOptions })`(异步用 registerAsync 读配置)、`AuthService.login()` 签发 token(载荷 userId/role,`jwtService.sign`)、**JwtStrategy**(继承 PassportStrategy:validate 里验 payload、返回的对象挂到 req.user)、控制器 `@UseGuards(AuthGuard('jwt'))` 保护路由;密码:`bcrypt.hash/compare`;**本地策略**(用户名密码登录:LocalStrategy 里校验)→ 登录后发 JWT;**OAuth2**(Google/GitHub 登录:passport-google-oauth20 等策略);**RBAC**:@Roles 装饰器 + RolesGuard(见第四站);**公共路由**:@Public + 守卫内 `Reflector.getAllAndOverride`;**刷新令牌**(refresh token 轮换,进阶);登录态在微服务间传递(JWT 无状态优势)。**别忘了**:helmet、CORS 白名单、限流(@nestjs/throttler)、输入校验(第三站)——安全纵深,见 [认证授权路线](/learning-paths/security/auth)。

## 第七站:配置、文档、日志

**@nestjs/config**:`ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })` → `ConfigService` 注入读 `get('DB_HOST')`;校验 env(Joi schema 或 class-validator,启动即失败);多环境(.env.development/.production)。**Swagger/OpenAPI**:`@nestjs/swagger`——`SwaggerModule.setup('api', app, document)` 一行起文档站;**装饰器自动生成**:@ApiTags(分组)/@ApiOperation(说明)/@ApiResponse(状态码文档)/DTO 的 @ApiProperty(**class-validator 的 DTO 直接变文档模型——代码即文档**)——调试/对接前端的福音。**日志**:Nest 内置 Logger(注入使用/`Logger.error`),生产接 pino/winston 或日志服务;**审计与错误追踪**:Sentry(@sentry/node)上报。

## 第八站:WebSocket 与任务调度

**Gateway**:`@WebSocketGateway({ cors: true })` + `@SubscribeMessage('message')` 处理函数——WebSocket 也走 Nest 的 DI(网关里注入 service!);**房间与广播**:`@WebSocketServer()` server,`server.to(room).emit(...)`;客户端事件(@MessageBody/@ConnectedSocket);鉴权:网关也能用守卫(JWT 握手校验);`@nestjs/websockets` 与 HTTP 同应用(混合)。**任务调度 @nestjs/schedule**:`@Cron('0 0 * * *')`(cron 表达式,每日任务)、`@Interval/@Timeout`——定时报表/清理任务;**@nestjs/bullmq**(队列:Producer/Consumer 装饰器,配 Redis)——重活异步化(邮件/图片/推送),与 [Node.js 路线](/learning-paths/backend/nodejs) 的队列概念一致。

## 第九站:测试、部署与下一步

**测试**:单元测试——`Test.createTestingModule({ providers: [UserService] }).overrideProvider(UserRepository).useValue(mockRepo).compile()`(**overrideProvider 替换依赖是 Nest 测试的精髓**),再 `module.get(UserService)` 测业务;控制器测试 mock service;**e2e**:`nest g e2e`?标准做法:创建整个 AppModule + supertest 打真实 HTTP(内存数据库或测试库),测"注册→登录→访问受保护路由"全链路;Jest 默认集成。**部署**:`nest build` 产物 node 运行;Docker 多阶段(Node 20 alpine 精简镜像、非 root、HEALTHCHECK);PM2 或 K8s 扩容;压缩(compression)/CORS/helmet/限流在生产配置里全开;**性能**:单例作用域、避免 @Res、数据库索引与 N+1、缓存(CacheModule 或 Redis)。**下一步**:GraphQL(@nestjs/graphql:Resolver/自动类型,替代 REST 的查询自由)、微服务(@nestjs/microservices:TCP/Redis/MQTT/gRPC/Kafka 传输层、ClientProxy、事件驱动与请求-响应两种模式——见 [微服务路线](/learning-paths/microservices/microservices-patterns))、CQRS(@nestjs/cqrs:命令/查询/事件分离)与 Event Sourcing(大型业务架构)。

## 通关标准

能独立做到:用 CLI 生成资源并写全 CRUD(含 DTO 校验与全局异常格式);说清"一次请求经过哪些组件"(中间件→守卫→拦截器→管道→控制器→过滤器)及各组件职责;手写 JWT 登录 + @Roles 权限守卫;会 overrideProvider 写单元测试、supertest 写 e2e;能讲 DI 的 useClass/useValue/useFactory 与动态模块 forRoot 模式;把项目接上 Swagger 与 ConfigModule——NestJS 主线通关。

NestJS 把企业级后端要的东西都备齐了:架构(模块/DI)、安全(守卫/管道)、文档(Swagger)、通信(WS/微服务)、测试——你只需要专注业务。它的装饰器与 IoC 心智一开始有点绕,但"约定 + 依赖倒置"带来的可维护性,正是中大型项目最稀缺的。Express 教会你自由,NestJS 教会你纪律——两者都学,你才真正理解 Node 后端的全貌。
