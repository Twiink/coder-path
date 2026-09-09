# Angular 学习路线

Angular 是 Google 出品的企业级前端框架,和 React 的"自由组装"相反,它是**全家桶式的完整规范**:路由、HTTP、表单、依赖注入、测试,官方都给你配齐了方案。代价是学习曲线陡峭——装饰器、依赖注入、RxJS、模块系统,概念又多又绕;但回报是:大型项目里团队写出的是"同一种 Angular",而不是"各自的 React"。**Angular 深度依赖 TypeScript**,所以这条路线的第一站其实是 TS(基础见 [TypeScript 学习路线](/learning-paths/frontend/typescript),这里只讲 Angular 特有的部分)。

这条线按 **核心概念(组件/模板/指令)→ 依赖注入与服务 → 路由 → 表单 → HTTP 与 RxJS → 状态管理 → 变更检测与性能 → 构建与测试 → 新范式(Standalone/Signals/SSR)→ 生态** 推进。

## 第一站:组件、模板与指令——Angular 的基本粒子

**组件**由 `@Component` 装饰器声明:它把模板(HTML)、样式与类(逻辑)绑在一起,还带元数据——`selector`(标签名,`app-xxx` 前缀是规范)、`templateUrl`/`template`、`styleUrls`/`styles`、`standalone`(见第九站)、`changeDetection`、`encapsulation`。**视图封装**三模式要懂:Emulated(默认,给样式加属性选择器模拟隔离)、Shadow DOM(真影子 DOM,真隔离但外部样式进不来)、None(全局,样式会漏出去,慎用)。

**模板语法**(和 Vue 的指令、React 的 JSX 都不同,第三套心智):插值 `&#123;&#123; expr &#125;&#125;`;**属性绑定 `[property]="value"`**(注意:绑的是 property 不是 attribute;`[class.active]`/`[style.color]`/`[attr.aria-label]` 各有语法,`[class]` 还能绑对象);**事件绑定 `(event)="handler($event)"`**(`$event` 是事件对象);**双向绑定 `[(ngModel)]`**(banana-in-a-box 语法糖 = 属性绑定 + 事件绑定,表单里用,需 FormsModule);**模板引用变量 `#var`**(拿 DOM/组件/指令的引用,`#form="ngForm"` 这种带导出值的写法是查表单状态的关键);**模板语句**与安全导航 `?.`、非空 `!`。
**管道 pipe**:(&#123;&#123; date | date: 'yyyy-MM-dd' &#125;&#125;)、`| async`(订阅 Observable,自动退订,模板里处理异步的利器)、`| json`、`| uppercase`/`currency`/`percent`/`slice`;自定义管道 `@Pipe(&#123; name &#125;)` + `transform` 方法;**纯管道**(默认,输入不变就缓存,性能好)vs 非纯管道(`pure: false`,每次检测都跑);管道链式组合。
注意管道是模板层的"格式化",复杂逻辑还是进组件/服务。

**指令三大类**:①组件(带模板的指令);②**结构型指令** `*ngIf`/`*ngFor`/`*ngSwitch`(星号是微语法糖,展开成 `&lt;ng-template&gt;`;`*ngIf` 配 `else` 块(`<ng-template #elseBlock>`);`*ngFor` 的 `index`/`first`/`last`/`even` 与 **`trackBy`**(给列表项稳定的身份,避免全量重建——性能关键,对应 React 的 key);Angular 17+ 新增**内置控制流语法** `@if`/`@else`/`@for`/`@switch`(块级语法,性能更好,新代码优先用,`@for` 里 `@empty` 处理空列表);③**属性型指令** `ngClass`/`ngStyle`(动态样式,新写法 `[class]`/`[style]` 更推荐);**自定义指令**:`@Directive` + `@HostListener`(监听宿主事件)与 `@HostBinding`(绑定宿主属性)——封装 DOM 行为(点击外部关闭、拖拽、水印)的标准姿势。

**组件通信**:`@Input`(父传子,可配别名与 required;input 值变化用 `ngOnChanges` 或 setter 拦截)、`@Output` + `EventEmitter`(子传父,`@Output() save = new EventEmitter&lt;User&gt;()`,模板里 `(save)="onSave($event)"`);`@ViewChild`/`@ViewChildren`(拿子组件/子元素,`static` 选项与 AfterViewInit 时机)、`@ContentChild`(投影内容);**内容投影 `ng-content`**(对应 Vue 插槽/React children,`select` 属性做具名投影);跨层共享走服务 + 依赖注入(第三站)。
**生命周期钩子**(按序):`ngOnChanges`(输入变化,最先)、`ngOnInit`(首次初始化后,发请求的主场)、`ngDoCheck`(自定义变更检测,慎用)、`ngAfterContentInit`/`ngAfterContentChecked`、`ngAfterViewInit`(视图就绪,操作 DOM/子组件)、`ngAfterViewChecked`、`ngOnDestroy`(清理订阅/定时器——**RxJS 订阅泄漏的重灾区,必须 unsubscribe**)。

## 第二站:依赖注入与服务——Angular 的骨架

**服务**是 Angular 的"共享逻辑单元"(发请求、共享状态、工具函数),用 `@Injectable` 标记;**依赖注入(DI)**:组件/服务在构造函数里声明要什么,Angular 自动给——`constructor(private http: HttpClient) &#123;&#125;` 是 Angular 代码最经典的签名。
**作用域(层级注入器)**:`providedIn: 'root'`(应用级单例,绝大多数场景)、模块级 `providers`、组件级 `providers`(每个组件实例一份——做"组件私有服务"实现真正的隔离共享);`@Optional`(可缺省)、`@Inject(TOKEN)` 配 **InjectionToken**(给非类依赖(配置对象)做类型安全的注入键)、`useClass`/`useValue`/`useFactory`/`useExisting` 四种 provider 写法(测试里用 useValue mock 服务的基础)。
**服务间通信**:不止"组件 → 服务"单向,服务可以暴露 `Subject`/`BehaviorSubject` 让组件订阅(跨组件共享状态的第一阶段方案,状态管理章节再升级)。NgModule 出现前的纯服务 + `providedIn: 'root'` 是当代推荐姿势。

**模块系统**:`@NgModule` 曾是 Angular 的骨架——`declarations`(本模块的组件/指令/管道)、`imports`(引入其他模块,如 CommonModule/FormsModule/HttpClientModule)、`providers`(服务)、`exports`(对外开放)、`bootstrap`(根组件);根模块 AppModule + 特性模块(按业务域拆分,配路由懒加载)。**Angular 14+ 的 Standalone 组件正在"去模块化"**:组件自己 `imports` 依赖,不再需要 NgModule 包裹——新项目全 standalone,老项目渐进迁移,模块知识变成"看懂老代码"的考古学(但迁移大潮中你仍会遇到,别跳过)。

## 第三站:路由与导航

**路由配置**:`Routes` 数组 + `RouterModule.forRoot(routes)`(根路由)/`forChild`(特性路由);每条路由 `path` + `component`(或 `loadChildren` 懒加载);`redirectTo` + `pathMatch: 'full'`(空路径重定向必须 full,经典坑);**`&lt;router-outlet&gt;`** 是路由出口(组件挂载点),`&lt;router-link&gt;` 不是 Angular 的——导航用 `routerLink` 指令(`/users`、`['/users', id]` 数组形式、(&#123; outlets: &#123;...&#125; &#125;) 命名出口)与 `routerLinkActive`(高亮,配 (routerLinkActiveOptions="&#123; exact: true &#125;"));编程导航 `router.navigate`/`navigateByUrl`。
**参数**:路径参数 `:id` 经 `ActivatedRoute`(`route.snapshot.paramMap` 一次性读取 vs `route.paramMap` Observable 响应变化——**同一组件复用时的经典坑**:从 /user/1 导航到 /user/2 组件不重建,必须订阅 paramMap);查询参数 `queryParams`/`queryParamsHandling`。
**嵌套路由 children**(父路由组件内再放 outlet,后台布局);**路由守卫**(接口:CanActivate 能不能进/CanActivateChild/CanDeactivate 能不能出(未保存提示)/CanLoad、Resolve(进入前预取数据,已不推荐,用 resolver 函数));守卫返回 boolean/Observable/Promise 或 UrlTree(重定向);**懒加载**:`loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)`(模块级代码分割,后台大应用的基本盘)+ **预加载策略**(PreloadAllModules 权衡:首屏后静默加载);路由事件(Router.events,做进度条/埋点);`provideRouter` + 函数式守卫是 v15+ 新写法(新项目用)。

## 第四站:表单——两套体系

Angular 有两套表单,都要会:

**模板驱动表单**(简单表单):模板里 `[(ngModel)]` + `name` 属性;验证用 HTML5 + `required`/`minlength`/`pattern` 指令;**`#form="ngForm"`** 拿整个表单引用,查 `form.valid`/`form.value`;**表单状态四件套**:`valid`/`invalid`(合法性)、`touched`/`untouched`(碰过没)、`dirty`/`pristine`(改过没)、`pending`——做"红框只在 touched 后显示"的体验全靠它们;错误信息用 `ngModel` 的 `errors` 对象 + `*ngIf` 展示。适合字段少、验证简单的场景。

**响应式表单**(复杂表单,推荐主力):在类里建模——`FormControl`(单控件)/`FormGroup`(控件组,嵌套)/**`FormArray`**(动态数组:动态增删的地址列表/技能列表,`push`/`removeAt`);`FormBuilder`((fb.group(&#123; name: ['', [Validators.required, Validators.minLength(2)]] &#125;)))简化创建;验证器 `Validators` 内置(required/email/minLength/maxLength/pattern)与**自定义验证器**(返回 (&#123; errorName: true &#125;) 或 null 的纯函数;异步验证器做用户名查重);模板里 `[formGroup]` + `formControlName` 关联;提交 `form.value`(整个模型,类型安全);`valueChanges`/`statusChanges` Observable(联动、动态校验)。
**选型**:字段多/动态/联动多/要单测 → 响应式;简单联系表单 → 模板驱动也够。响应式表单纯 TS 模型,可测试性完胜。

## 第五站:HTTP 与 RxJS——Angular 的响应式血脉

**HttpClient**:`HttpClientModule`(standalone 用 `provideHttpClient()`)注入;`http.get/post/put/delete&lt;T&gt;(url, options)` 返回 **Observable**;options 里 `headers: new HttpHeaders()`、`params: new HttpParams()`(不可变,`set`/`append` 返回新对象)、`responseType`、`observe: 'response'`(要状态码/头时);**拦截器 HttpInterceptor**:`intercept(req, next)` 里统一加 token、统一错误处理、日志、缓存——"每个请求都带 Authorization"的唯一正确姿势(函数式 `provideHttpClient(withInterceptors(...))` 是新写法);**错误处理**:`catchError` 操作符(区分网络错/业务错,`throwError` 重新抛出)、`finalize`(关 loading);**竞态控制**靠 RxJS(见下);上传下载进度 `reportProgress` + `HttpEventType`;`withFetch` 用浏览器 fetch 替代 XHR。

**RxJS 必会清单**:Observable(惰性、可取消的数据流,与 Promise 的本质区别:可以多次发射、可以取消)、**Subject**(多播:一个源多个订阅者)、`BehaviorSubject`(带当前值,组件初始化就能拿到最新状态——服务共享状态的首选)、`ReplaySubject`(重放历史 n 个值)、`AsyncSubject`(只发最后一个);创建:`of`/`from`/`fromEvent`/`interval`/`timer`;操作符三族——转换:`map`/`switchMap`(取消前一个,搜索联想/竞态的答案)/`mergeMap`(并发扁平化)/`concatMap`(串行排队)/`exhaustMap`(进行中忽略新触发,刷新按钮防抖)/`scan`;过滤:`filter`/`take`/`takeUntil`(自动退订的黄金搭档:私有 Subject + ngOnDestroy 里 next)/`takeWhile`/`distinctUntilChanged`;组合:`forkJoin`(并发等全部,类似 Promise.all)/`combineLatest`/`withLatestFrom`;工具:`tap`(调试副作用)/`delay`/`debounceTime`(输入防抖)/`throttleTime`/`retry`/`catchError`;**错误与完成**:subscribe 的三个回调、`finalize`;**冷热 Observable** 概念(冷:每次订阅重新执行,http 是冷;热:共享执行,Subject 是热)——`shareReplay` 把冷变热(缓存请求结果)。
模板里 `| async` 管道自动订阅退订,是"少写内存泄漏"的第一道防线;组件里手动 subscribe 必须配对 unsubscribe(takeUntil 模式)。

## 第六站:状态管理——从服务到 NgRx

小应用:服务 + BehaviorSubject 就够(`get users$()`,组件 `| async`);**NgRx**(Redux 模式在 Angular 的官方实践,大应用/严格规范团队):**Store**(全局单一状态树,不可变)、**Actions**(动作,`createAction` + props,类型安全)、**Reducers**(纯函数:旧状态 + action → 新状态,用 `createReducer` + `on`)、**Effects**(副作用容器:监听 action → 调 API → 派发结果 action,`createEffect`,把异步与不可预测全挡在组件外)、**Selectors**(`createSelector`,记忆化派生查询)、`@ngrx/component-store`(局部状态管理,组件内用 NgRx 心智的轻量版)、DevTools(时间旅行调试)。
其他方案:NGXS(装饰器风格,更少样板)、Akita/Elf(轻量响应式)。**选型**:跨模块共享 + 复杂交互 + 团队大 → NgRx;中小应用 → 服务 + BehaviorSubject 或轻量库,别让仪式感拖垮开发速度。

## 第七站:变更检测与性能

**Zone.js** 是 Angular 的"心跳":它猴子补丁了浏览器异步 API(事件/setTimeout/Promise),任何异步发生都会触发**从根组件向下的全量变更检测**——这是"自动更新"的代价:默认策略下每次检测都要跑整棵组件树。优化三板斧:

1. **ChangeDetectionStrategy.OnPush**:组件只在"输入引用变化 / 自身事件 / Observable 发射 / 手动标记"时检测——**配不可变数据**(每次更新返回新对象,别改原数组)才有效;这是 Angular 性能第一课;
2. **ChangeDetectorRef**:`markForCheck`(OnPush 下手动标记,async pipe 内部就是它)/`detectChanges`(局部立即检测,慎用)/`detach`/`reattach`;
3. **`trackBy`**(ngFor/新 @for 的 track)与**纯管道**(默认缓存)、**懒加载模块**、**预加载策略**、Web Worker(计算密集任务,`@angular/workers` 生态)。

**Signals(Angular 16+)是未来方向**:`signal(0)`/`computed(() => …)`/`effect(() => …)` 细粒度响应式——**不再需要 Zone.js 的全树扫描**,`input()`/`output()` 替代 @Input/@Output、`model()` 双向、`viewChild()`;新项目可以 Signals + zoneless 起步,官方正推动"signal-based components"成为默认;理解它之前先把 OnPush 玩透,两者心智同源(细粒度 + 不可变)。

**AOT 编译**(默认开启):模板在**构建期**编译成 JS(而非浏览器里 JIT),产物更小更快、模板错误构建期就报;相关开关:`strictTemplates`(模板里的类型检查,能查出"绑了个不存在的属性");构建优化:tree-shaking、budgets(包体积预算,超了构建失败)、`ng build --configuration production`;**懒加载 + 预加载**是运行时大头。

## 第八站:CLI、测试与工程化

**Angular CLI**:`ng new`(交互式选 standalone/SSR/样式方案)、`ng generate`(component/service/pipe/guard/interceptor……一行生成带测试文件的代码,`--standalone`/`--inline-template` 选项)、`ng serve`(开发,`--port`)、`ng build`、`ng test`、`ng lint`、`ng add`(装库并自动配好,如 `ng add @angular/material`)、`ng update`(版本升级迁移);**Schematics**(代码生成器框架:CLI 的 generate 就是 schematics,团队可以写自己的模板脚手架)、Nx(monorepo 工具链:多应用多库共享代码、affected 增量构建——大型组织标配)。

**测试**:单元测试 **Jasmine + Karma**(Angular 官方栈,`ng test`;Vitest 正在成为新选择);核心是 **TestBed**:`TestBed.configureTestingModule(&#123; declarations/imports/providers &#125;)` 搭测试环境,`fixture = TestBed.createComponent(XxxComponent)`、`fixture.detectChanges()`(触发变更检测)、`DebugElement`(`fixture.debugElement.query(By.css(...))`)、`nativeElement` 断言 DOM;服务测试:注入真实服务或 `useValue` mock;HTTP 用 `HttpTestingController`(`expectOne`/`flush` 模拟响应);组件交互:`fixture.componentInstance` 直接调方法 + 重新 detectChanges。
**E2E**:Protractor 已废弃,现代方案 **Playwright / Cypress**(模拟真实用户)。**测试策略**:服务与纯逻辑(管道/验证器/工具)全测、组件测"输入输出契约"、路由守卫与拦截器值得测、E2E 覆盖核心流程。

## 第九站:SSR 与新范式

**Angular Universal / SSR**:`ng add @angular/nguniversal` 或新脚手架自带;服务端渲染首屏 HTML(SEO + 首屏速度),客户端 hydrate 接管交互;`provideClientHydration`(v17 起稳定);**预渲染(prerender)**:纯静态页面构建期生成 HTML(文档站/官网);水合不匹配的坑(时间/随机值)与处理;`TransferState`(把服务端数据传给客户端,避免重复请求——SSR 双请求问题的标准解)。**Standalone**(14+)与**Signals**(16+)已在各站讲过,这里串一下新项目模板:standalone 组件 + provideRouter/provideHttpClient/provideZoneChangeDetection + signal 状态 + 函数式守卫拦截器——这套"现代 Angular"比 2019 年的教程少一半样板。

## 第十站:UI 与生态

**Angular CDK**(官方组件开发工具包:Overlay(弹层,自己写 Modal/Tooltip 的底子)、DragDrop、A11y(无障碍)、Platform、Portal)——Angular 生态的"积木层";**Angular Material**(官方 Material Design 组件库,配 CDK,主题定制 via Sass)、**PrimeNG**(企业级,组件最全)、**Ng-Zorro**(Ant Design 风格,国内后台常用)、Nebular/ngx-bootstrap;日期 dayjs/date-fns(替代老 Moment);图标 @angular/material-icons 或 iconfont;**Ionic**(用 Angular 技术栈写移动应用,Capacitor 打包原生);图表:ngx-charts/echarts;表格:AG Grid(重型企业表格)。
**学习路径建议**:先 TS + RxJS(没有它 Angular 寸步难行)→ 组件/模板/指令 → DI 与服务 → 路由 → 表单 → HttpClient → OnPush 与 Signals → NgRx(需要时)。

## 通关标准

能独立做到:用 CLI 生成 + standalone 组件 + 响应式表单 + 路由守卫 + 拦截器 + OnPush 写一个带权限与错误处理的中型后台;说清 Zone.js 与 OnPush 的关系、switchMap 为什么能解决竞态、BehaviorSubject 与 Subject 的区别、`| async` 为什么不会泄漏;能写组件与服务单测(TestBed + mock);看得懂 NgRx 的 action/reducer/effect 流转——Angular 主线通关。

Angular 学习曲线确实陡峭:概念多、规范严、RxJS 劝退一大半人。但正是这些约束让大型项目十年后依然可维护——这是它在中大型企业应用里长盛不衰的原因。别被开头吓到,按官方文档顺序学:组件 → DI → 路由 → 表单 → RxJS,每过一关,之前的疑惑都会消掉一层。熬过前两个月的"什么都绕",你会感谢它的严谨。
