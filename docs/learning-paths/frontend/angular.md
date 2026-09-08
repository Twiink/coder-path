# Angular 学习路线

Angular 是 Google 出品的企业级前端框架，全家桶式的解决方案。和 React 的灵活自由不同，Angular 更像是一套完整的开发规范，从路由到状态管理到测试都有官方方案。学习曲线陡峭，但掌握后开发大型项目会很爽。

## 基础篇：核心概念

### TypeScript 基础
- Angular 原生支持 TypeScript：必备技能
- 类型系统、接口、泛型
- 装饰器：@Component、@Injectable
- ES6+ 特性：类、模块、箭头函数

### 组件基础
- 组件结构：@Component 装饰器
- 模板语法：插值、属性绑定、事件绑定
- 组件生命周期：ngOnInit、ngOnDestroy 等
- 组件通信：@Input、@Output、EventEmitter
- 视图封装：Shadow DOM、Emulated、None

### 模板语法
- 插值：{{ expression }}
- 属性绑定：[property]="value"
- 事件绑定：(event)="handler()"
- 双向绑定：[(ngModel)]="property"
- 模板引用变量：#var
- 管道：内置管道、自定义管道

### 指令
- 结构型指令：*ngIf、*ngFor、*ngSwitch
- 属性型指令：ngClass、ngStyle、ngModel
- 自定义指令：@Directive、HostListener、HostBinding

## 基础篇：依赖注入

### 服务
- 服务定义：@Injectable
- 依赖注入：构造函数注入
- 服务作用域：providedIn: 'root'、模块级、组件级
- 服务通信：Subject、BehaviorSubject

### 模块系统
- NgModule：@NgModule 装饰器
- declarations：声明组件、指令、管道
- imports：导入其他模块
- providers：服务提供者
- exports：导出给其他模块使用
- 根模块 vs 特性模块

## 进阶篇：路由与导航

### 路由配置
- RouterModule：路由模块
- Routes：路由数组配置
- path、component、redirectTo、pathMatch
- 路由出口：\<router-outlet\>
- 路由链接：routerLink、routerLinkActive

### 路由进阶
- 路由参数：/:id、ActivatedRoute
- 查询参数：queryParams
- 子路由：children、嵌套路由
- 路由守卫：CanActivate、CanDeactivate、Resolve
- 懒加载：loadChildren
- 路由预加载策略：PreloadAllModules

## 进阶篇：表单处理

### 模板驱动表单
- ngModel：双向绑定
- 表单验证：required、minlength、pattern
- 表单状态：valid、invalid、touched、dirty
- 模板引用变量：#form="ngForm"

### 响应式表单
- FormControl：单个表单控件
- FormGroup：表单组
- FormBuilder：简化创建
- 验证器：Validators、自定义验证器
- 动态表单：FormArray
- 响应式表单 vs 模板驱动：灵活性、可测试性

## 进阶篇：HTTP 与数据交互

### HttpClient
- 导入：HttpClientModule
- GET、POST、PUT、DELETE 请求
- 请求拦截器：HttpInterceptor
- 响应处理：Observable、pipe、map
- 错误处理：catchError
- 请求头：HttpHeaders
- 查询参数：HttpParams

### RxJS
- Observable：可观察对象
- 操作符：map、filter、tap、switchMap、mergeMap、catchError
- Subject：多播、EventEmitter 的底层
- BehaviorSubject：带初始值
- 订阅管理：takeUntil、AsyncPipe

## 进阶篇：状态管理

### 组件状态
- 本地状态：组件内管理
- 服务状态：跨组件共享
- Observable 服务：响应式状态

### NgRx
- Store：全局状态树
- Actions：动作定义
- Reducers：纯函数更新状态
- Effects：副作用管理、异步操作
- Selectors：状态查询
- DevTools：时间旅行调试

### 其他方案
- Akita：简化版状态管理
- NGXS：装饰器风格
- Elf：轻量级

## 实战篇：优化与最佳实践

### 变更检测
- Zone.js：自动变更检测
- ChangeDetectionStrategy：OnPush、Default
- ChangeDetectorRef：手动触发检测
- 不可变数据：优化 OnPush

### 性能优化
- OnPush 策略：减少检测次数
- TrackBy：优化 *ngFor
- 懒加载：模块级代码分割
- 预加载策略：智能预加载
- Pure Pipes：纯管道缓存
- Web Workers：后台计算

### AOT 编译
- AOT vs JIT：提前编译 vs 即时编译
- 构建优化：tree-shaking、代码压缩
- 模板类型检查：strictTemplates

## 实战篇：测试

### 单元测试
- Jasmine：测试框架
- Karma：测试运行器
- TestBed：测试环境配置
- 组件测试：fixture、DebugElement
- 服务测试：依赖注入、Mock

### E2E 测试
- Protractor（已弃用）
- Playwright / Cypress：现代 E2E 方案

## 实战篇：工具与生态

### Angular CLI
- ng new：创建项目
- ng generate：生成代码（component、service、module）
- ng serve：开发服务器
- ng build：构建生产版本
- ng test：运行测试
- Schematics：代码生成器

### UI 组件库
- Angular Material：官方 Material Design
- PrimeNG：企业级组件库
- Ng-Zorro：Ant Design 风格
- Nebular：可定制主题

### 工具库
- Angular CDK：组件开发工具包
- RxJS：响应式编程
- Moment.js / Day.js：日期处理

## 实战篇：进阶主题

### Standalone Components
- Angular 14+：独立组件，无需模块
- 简化配置：imports 直接导入
- 渐进式迁移：兼容 NgModule

### Signals（Angular 16+）
- signal()：响应式信号
- computed()：计算信号
- effect()：副作用
- 未来方向：替代 Zone.js、细粒度更新

### Server-Side Rendering
- Angular Universal：SSR 方案
- 预渲染：静态生成
- SEO 优化：首屏渲染

## 下一步学习

掌握 Angular 后，继续探索：

- **Angular Material** - Material Design 组件库
- **NgRx** - 大型应用状态管理
- **Angular Universal** - 服务端渲染（SSR）
- **Ionic** - 用 Angular 开发移动应用
- **Nx** - Monorepo 工具链

Angular 学习曲线确实陡峭，概念多、规范严格。但正是这些约束让大型项目更容易维护。别被一开始的复杂吓到，按照官方文档的顺序学，先把基础打牢，后面的高级特性自然水到渠成。企业项目中，Angular 的优势会越来越明显。
