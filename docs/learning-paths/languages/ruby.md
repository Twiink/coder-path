# Ruby 学习路线

Ruby,"程序员幸福感最高"的语言——它的设计哲学是"让程序员快乐"(MINASWAN:Matz is nice and so we are nice)。语法优雅得像英语,表达力极强,配合 Ruby on Rails 曾引爆整个 Web 开发世界。它的性能不拔尖(3.x 的 YJIT 后已大幅改善),但开发效率与代码可读性一流——写 Ruby 像写诗,读 Ruby 像读散文。**"一切皆对象"**是它的第一性原理:连数字、nil、true 都是对象,都有方法。

这条线按 **语法地基 → 数组与哈希 → 方法与块 → 字符串与正则 → 面向对象 → 模块与 Mixin → 异常与文件 → 枚举与迭代 → 元编程 → 并发 → 工程与测试 → Rails** 推进。

## 第一站:环境与语法地基

**环境**:rbenv 或 rvm 管理多版本(`ruby -v`);gem 是包管理器;`irb` 交互环境(练语法);`puts`(打印带换行)/`print`/`p`(带 inspect,调试用)。**注释** `#`,文档注释在方法上方。**变量种类**(靠前缀区分,这是 Ruby 特色):局部变量(小写)、**实例变量 `@name`**(属于对象)、**类变量 `@@count`**(属于类,**继承共享,慎用**)、全局变量 `$x`(少用)、**常量**(大写开头,如 `PI`,可重新赋值但会警告)。**类型**:一切皆对象——整数(任意精度)、浮点、字符串、Symbol、true/false(TrueClass/FalseClass)、nil(NilClass,唯一对象;**nil 是对象,可以调方法**)。**运算符**:算术/比较(链式 `1 < x < 10` 合法)、`<=>`(宇宙飞船运算符,返回 -1/0/1,sort 的基础)、逻辑 &&/||/!(短路)、**范围 `1..5`(含尾)与 `1...5`(不含尾)**、`===`(case 匹配的底层,Range#=== 判断包含)。**控制流**:if/elsif/else、**`unless`**(反向 if:"除非",条件为假才执行)、case/when(用 === 匹配,支持范围与类:`when 1..10`/`when String`)、三元;修饰符语法:`puts x if x > 0`(**后置 if/unless/while——Ruby 的签名风格**);循环:while/until、**Ruby 惯例是"能迭代就不循环"**(each/times,见第八站);`next`(跳过)/`break`/`redo`。字符串输出与插值见第四站。**方法内省**:`x.methods` 看所有可用方法。

## 第二站:数组与哈希

**数组**(有序、可混类型):创建 `[1, 2]`、`%w[a b c]`(字符串数组快捷);负索引 `arr[-1]`(最后一个)、`arr[1, 3]` 切片、`arr[1..3]`;方法全家:增删 `push`/`<<`/`pop`/`shift`/`unshift`/`delete`/`delete_at`/`insert`/`clear`,查 `include?`/`index`/`count`,转换 `join`/`flatten`/`uniq`/`reverse`/`sort`/`sort_by`/`zip`/`rotate`/`sample`/`shuffle`/`first`/`last`/`take`/`drop`,取子集 `slice`/`values_at`;**迭代见第八站**;`Array.new(3) { |i| i * 2 }` 带块初始化。**哈希 Hash**(键值对,插入有序):创建 `{ name: 'Ruby' }`(符号键简写)与 `{ 'name' => 1 }`;读写 `h[:key]`(缺省返回 nil——**要默认值用 `fetch(:key, 默认)`(找不到会报错/给默认,比 [] 安全)或 `Hash.new(默认值)`/带块默认**);方法:`keys`/`values`/`merge`/`merge!`/`select`/`reject`/`transform_values`/`transform_keys`/`invert`/`dig`(**深层安全取值**:`h.dig(:a, :b, :c)`——嵌套哈希的救星)/`to_a`/`each_pair`/`key?`/`value?`/`delete`/`clear`/`compact`(去 nil);`**` 双星号展开传参。**数组与哈希的选择**:有序列表数组,键值映射哈希——`group_by`/`tally`(计数)是数据分析日常。

## 第三站:方法与块——Ruby 的灵魂

**方法**:`def` 定义,**隐式返回最后一个表达式的值**(不用写 return;return 用于提前退出);方法名约定:谓词以 `?` 结尾(`empty?`)、危险/破坏性方法以 `!` 结尾(`gsub!` 就地修改——**约定不是强制**);参数:位置参数、默认参数、**rest `*args`**(收集数组)、**关键字参数 `name:`/`**kwargs`**(2.0+ 后关键字与位置分离,`def greet(name:, greeting: 'Hi')` 调用 `greet(name: 'x')`——写清晰 API 的现代姿势)、块参数 `&block`(把块变成 Proc 对象);参数解构。**块 Block**(Ruby 的灵魂):`do...end`(多行)与 `{ }`(单行,优先级更高——**`puts [1,2].map { |x| x*2 }` 与 do-end 的绑定差异是经典坑**);方法内 `yield` 调用块;`yield` 传参,`|param|` 接收;**块能捕获外部变量(闭包)**;`each` 系方法全接受块。**Proc 与 lambda**:`Proc.new {}`/`proc {}` 与 `lambda {}` 的区别(面试题):return 行为(lambda 正常返回调用方;proc 的 return 会从**定义它的方法**返回,顶层 proc return 直接报错)、参数检查(lambda 严格,proc 宽松)、`&` 转换(`&:upcase` 是 `Symbol#to_proc`——**`[1,2].map(&:to_s)` 是 Ruby 代码里最常见的写法之一**);`call`/`[]`/`yield` 三种调用方式。

## 第四站:字符串与正则

**字符串**:单引号(不解析插值与转义,`'\n'` 是字面两个字符)与双引号(**插值 `#{expr}`**);多行 heredoc `<<~TEXT`(去缩进);编码:内部 UTF-8,`encoding`/`encode`;方法:`length`/`size`、大小写(`upcase`/`downcase`/`capitalize`/`swapcase`)、`strip`/`lstrip`/`rstrip`、`split`(默认按空白,可传正则/字符串/限制数)、`join`(数组→串)、`gsub`/`gsub!`(全局替换,配正则或哈希映射)/`sub`(只第一个)、`include?`/`start_with?`/`end_with?`/`index`、`chars`(字符数组)/`bytes`、`delete`/`tr`(字符集替换)、`concat`/`<<`、`freeze`(不可变,性能)、`each_line` 逐行;**格式化 `format`/`%`**。**Symbol vs String**:Symbol 是不可变标识符,内部只存一份(内存与比较性能好),**永远用 Symbol 做哈希键与"枚举值"**,用 String 做真正的文本;**字符串字面量冻结注释** `# frozen_string_literal: true`(文件头,现代 Ruby 标配,防意外修改+性能)。**正则**:字面量 `/pattern/` 与 `%r{}`;匹配:`=~`(返回索引或 nil)、`!~`、`match`(返回 MatchData 或 nil)、`scan`(找全部,配捕获组返回二维数组)、`grep`;替换 `sub`/`gsub`;捕获:`$1`/`$2` 全局变量与 MatchData(`md[1]`/`md.captures`/`md.named_captures`)、**命名捕获 `(?<name>...)`**;选项:`/i`(忽略大小写)/`m`(点匹配换行)/`x`(宽松模式可注释);常用场景:邮箱/URL 校验、日志解析、`gsub` 模板替换。**Ruby 正则与 Perl 同源**,比 JS/Python 更丰富(`\A`/`\z` 锚点、`(?(1)...)` 条件)。

## 第五站:面向对象

**类**:`class Dog`(类名常量,首字母大写);`initialize` 是构造方法(不是"构造函数"——`new` 时自动调用);实例变量 `@name`(**未赋值即 nil,访问不报错**——Ruby 的宽松,也是拼写错误难查的原因)。**封装**:实例变量默认私有,靠 **`attr_accessor :name`**(自动生成 getter/setter 的**类宏**)与 `attr_reader`(只读)/`attr_writer`(只写)——写三个方法变一行,样板代码的终结者;**访问控制**:默认 public;`private` 之后的方法私有(**不能带接收者调用**:`self.private_method` 会炸,直接调用可以——与多数语言不同);`protected` 介于中间(同类的其他实例能调)。**继承**:`class Puppy < Dog`,单继承;`super`(**无参 super 自动转发全部参数**——注意与 Java 不同);`override` 直接同名定义即可(没有 @Override 注解,靠 `override` 关键字?Ruby 3 无;想防拼错用 `def_delegators`?不必)。**类方法**:`def self.build` 或 `class << self`;`Dog.new` 本身也是方法调用。**类变量 @@ 的坑**:子类共享,别用;用"类实例变量"(在类体里 `@x` + `class << self; attr_accessor :x; end`)替代。**相等性四兄弟**(面试题):`==`(可重载,业务相等,默认同 equal?)、`eql?`(哈希比较用,Hash 键判断)、`equal?`(身份,同一对象——别重载)、`hash`(配合 eql?,重写 == 记得重写 hash,否则塞进 Hash/Set 失灵);`Comparable` 模块(include 后只写 `<=>` 就白送 < > <= >=)。**对象输出**:`to_s`(给人)/`inspect`(调试,irb 里显示的就是它);`Object#tap`(链式调试)、`dup`(浅拷贝)/`clone`(含单例)/`freeze`+`frozen?`。**鸭子类型是 Ruby 的默认哲学**:不检查类型,直接调方法(`respond_to?` 检查)——写测试时用鸭子类型省一大半 mock。

## 第六站:模块与 Mixin——多继承的优雅替代

**模块 module**:两种用途——**命名空间**(`module MathUtils; def self.sqr; end; end` 组织工具函数,调用 `MathUtils.sqr`)与 **Mixin(混入)**:`include M`(把模块方法作为**实例方法**混入)、`extend M`(作为**类方法**)、**`prepend M`(方法查找链插到类之前——覆写类自身方法的钩子,进阶)**;include 一个模块 = Ruby 版多继承(查找链 ancestors 可查:`Dog.ancestors` 列出类与所有模块)。**Enumerable 是 Ruby 最优雅的设计**:你的类 `include Enumerable` + 实现 `each`,立刻免费获得 map/select/reduce/sort 等 50+ 方法(它们内部都基于 each 实现)——**"约定 + 自动赠予"的典范**;Comparable 同理(见上)。模块还可以放常量、`module_function`(模块方法既可作为实例 mixin 又能直接调,老代码见);`require`(按 $LOAD_PATH 找)/`require_relative`(相对路径,现代首选);gem 的 require 机制。**方法查找链**(重要心智):对象 → 类 → include 的模块(逆序)→ 父类 → …… → BasicObject;`super` 沿链继续走——理解它就能解释"模块覆写"与 prepend。

## 第七站:异常与文件

**异常**:`begin / rescue => e / ensure / end`(ensure 总会执行,类似 finally);**rescue 修饰符**一行式:`x = risky() rescue 默认值`(吞异常的偷懒写法,慎用);异常层级:`Exception` → `StandardError`(**业务 rescue 只抓 StandardError 系**,别抓 Exception——会连 NoMemoryError 都吞);常用:`RuntimeError`(raise 默认)/`ArgumentError`/`TypeError`/`NoMethodError`/`KeyError`/`ZeroDivisionError`;`raise` 三种:`raise "消息"`(RuntimeError)/`raise 自定义类`/`raise 类, "消息"`;自定义异常:`class MyError < StandardError; end`(空类即可);**retry**(rescue 块内重跑 begin——网络重试场景,小心死循环);`throw/catch`(非异常的跳转控制,别与 raise/rescue 混淆);`$!`(当前异常)/`$@`(栈)。**文件**:`File.read(path)`(整个读)/`File.write`/`File.open(path, 'r')`——**块形式自动关闭**:`File.open('x.txt') { |f| f.each_line { |l| puts l } }`(块结束自动 close——RAII 思想的 Ruby 版);模式 'r'/'w'/'a'/'r+'/'b';`readlines`(全读成数组)/`each_line`(逐行,大文件必用);目录:`Dir.glob('**/*.rb')`(通配找文件,配 File 用)/`Dir.mkdir`/`Dir.exist?`/`Dir.entries`;路径:`File.join`(跨平台拼路径)/`File.dirname`/`File.basename`/`File.extname`;谓词全家:`File.exist?`/`file?`/`directory?`/`readable?`/`size`;**Pathname**(面向对象路径,现代推荐:`Pathname('a/b').join('c').read`)。

## 第八站:迭代器与 Enumerable——集合操作的艺术

Ruby 没有 for 循环文化,**一切皆迭代**:`3.times`/`1.upto(10)`/`0.step(100, 10)`;`each`(遍历)/`each_with_index`/`each.with_index(1)`。**Enumerable 方法库**(数组/哈希/范围都有):过滤 `select`(留真)/`reject`(去真)/`find`(找第一个,配 `find_all`);转换 `map`/`collect`/`flat_map`(拍平);归并 `reduce`/`inject`(`sum` 是简写,`reduce(:+)` 传符号);分组 `group_by`(→ 哈希)/`partition`(二分)/`chunk`(连续分段)/`tally`(计数);排序 `sort`/`sort_by`(配块,`sort_by { |u| u.age }`)/`min`/`max`/`min_by`/`max_by`;判断 `all?`/`any?`/`none?`/`one?`;截取 `take`/`drop`/`first`/`last`;其他 `zip`/`cycle`/`each_slice`(分批)/`each_cons`(滑动窗口);转字符串 `join`;`to_h`。**惰性 Enumerator**:`(1..Float::INFINITY).lazy.select(&:even?).first(10)`——无限序列的懒处理;`Enumerator` 对象可手动 `next`。**链式风格**:`users.select(&:active?).map(&:email).sort`——一读就懂,这就是 Ruby 的表达力。

## 第九站:元编程与内省——Ruby 的魔法

Ruby 的元编程能力是它"魔法"的来源(ActiveRecord 的 `find_by_name`、Rails 的 DSL 全靠它):**`send`**(动态调方法:`obj.send(method_name, args)`——绕过 private 也靠它,别滥用)、**`define_method`**(运行时定义方法,attr_accessor 的底层原理:类宏 = 类方法 + define_method)、**`method_missing`**(拦截所有未定义方法调用——**必须同时定义 `respond_to_missing?`**,否则 respond_to? 说谎;动态代理:OpenStruct、ActiveRecord 动态查找器的原理)、`instance_variable_get/set`(绕过封装读写实例变量)、`class_eval`/`instance_eval`(在类/对象上下文里执行代码块)、`class << self`(单例类:给单个对象加方法)、**hook 方法**:`inherited`(子类定义时触发)/`included`/`method_added`/`method_missing`——写框架的钩子;`attr_accessor` 自己实现一遍是经典练习。**内省**:`obj.class`/`is_a?`/`kind_of?`/`instance_of?`/`respond_to?`、`methods`/`instance_methods`/`private_methods`、`Dog.ancestors`(方法查找链)/`superclass`/`included_modules`、`method(:foo)` 拿方法对象(可 call/source_location 看源码位置)、`const_get`/`const_defined?`。**什么时候用元编程**:写框架/DSL 时;业务代码里 method_missing 是代码异味——**魔法要收敛,可读性优先**。

## 第十站:并发与性能

**Thread**:`Thread.new { ... }`,`join` 等待;**GVL(全局虚拟机锁,类似 Python GIL)**:MRI 下同一时刻一个线程执行 Ruby 代码——CPU 密集多线程无加速,**IO 密集(网络/文件)有效**;同步:`Mutex`(`lock`/`unlock`/`synchronize`)、`ConditionVariable`、线程安全队列 `Queue`(生产者消费者直接用,内部带锁);线程局部 `Thread.current[:user_id]`。**Fiber**(轻量协程):手动调度 `resume`/`yield`——实现生成器与协作式任务。**Ractor**(Ruby 3.0 并行抽象):多核真并行,但**无共享**——通过消息传递通信(`send`/`receive`),共享对象要 `Ractor.make_shareable`(冻结)——Ruby 并发的新方向,写并行代码前先想清楚数据流。**Fiber Scheduler**(3.0):异步 IO 的事件循环接口(生态:async gem),对应 Node 事件循环的概念。**性能**:YJIT(3.1+,默认开启于 3.3?——开启方式 `ruby --yjit`,实测 Web 场景提速显著);写码层面:避免循环里创建对象(字符串拼接用 `<<` 而非 `+`)、符号优于字符串字面量、冻结字符串、`benchmark` 测量;**"Ruby 慢"正在成为历史**:3x3 计划 + YJIT 后,Rails 应用性能已够用,瓶颈通常在数据库与设计而非语言。

## 第十一站:工程化与测试

**依赖管理**:Gemfile + **Bundler**(`bundle install` 装锁版本,`Gemfile.lock` 必须提交;`bundle exec` 跑项目内版本——**环境隔离的生命线**);gem 版本约束(`~> 2.5` 语义化)。**Gem 开发**:`bundle gem my_gem` 脚手架、gemspec 文件、lib 目录结构、`gem push` 发布。**常用 gem**:pry(调试 REPL,`binding.pry` 断点)、byebug(断点调试器)、rake(任务脚本,`rake -T`)、rspec(测试)。**测试(RSpec 是 Ruby 文化的一部分)**:`describe`/`context`/`it` 组织、`expect(x).to eq(y)` 期望语法(matchers:eq/be/include/match/raise_error/change)、`let`(惰性 memo 变量)/`let!`、`before`/`after` 钩子、`subject`、**mock**:`double`/`instance_double`(类型检查)、`allow(x).to receive(:m).and_return(v)`、`expect(x).to receive(:m)`;测试替身与"只测行为不测实现";MiniTest 轻量替代;SimpleCov 覆盖率;**测试风格**:describe 业务行为、context 分支、it 一句话断言。**Debug 三板斧**:pry/byebug 断点、`puts`/`p` 探针、日志。

## 第十二站:Ruby on Rails——杀手级应用

Rails 是 Ruby 存在的最大理由(没有 Rails,就没有今天的 Ruby 生态)。核心理念:**约定优于配置**(Convention over Configuration)+ MVC。知识地图:路由(`config/routes.rb`:`resources :posts` 一条命令生成 7 个 RESTful 路由,`member`/`collection`/嵌套/`namespace`);**Active Record**(ORM:模型类 = 表;迁移 migration 改表结构;关联 `has_many`/`belongs_to`/`has_and_belongs_to_many`;验证 `validates :name, presence: true`;查询 `where/order/limit/includes`(**N+1 查询**与 eager loading——性能第一课));控制器(params 与**强参数** `params.require(:post).permit(:title)`——安全防线;render/redirect_to);视图(ERB 模板、partial 局部、layout、helper);脚手架 `rails generate scaffold`(学 CRUD 最快路径)。**进阶全家**:Action Cable(WebSocket 实时)、Active Job + Sidekiq(后台任务)、Action Mailer(邮件)、Active Storage(文件上传/云存储)、**Hotwire/Turbo**(无前端框架的 SPA 体验:Rails 7 默认,`turbo_frame_tag` 局部更新——Rails 对"前后端分离"的自家答案)、API mode(纯 JSON 后端,配 Jbuilder 或 jsonapi-serializer)。**性能**:缓存三件套(页面/片段 fragment/Russian Doll 嵌套缓存 + Redis)、Bullet gem(开发期抓 N+1)、rack-mini-profiler。**职业向**:Web 全栈(Rails + Hotwire 或 Rails API + 前端框架)、DevOps 工具(Chef/Puppet 的历史与 Ruby 渊源)、脚本与批处理。

## 通关标准

能独立做到:不查文档写出用块/Enumerable/符号键处理数据的惯用 Ruby;说清 include/extend/prepend、Proc vs lambda、== vs equal?、attr_accessor 背后发生了什么;能读懂 ActiveRecord 动态查找与 Rails DSL 的元编程实现;会用 RSpec 给方法写完整测试;能搭一个 Rails 应用并解释 MVC 与路由——Ruby 主线通关。

Ruby 教你的不只是语法,更是对代码美学的追求:可读性、幸福感、约定优于配置。它也许不是最快的语言,却是"写起来最像人话"的语言。如果你厌倦了样板代码与仪式感,或者想体验"一行抵十行"的畅快,打开 irb 敲一行 `puts "Hello, Ruby!"`,然后让 Rails 带你看一遍什么叫"脚手架一分钟,CRUD 五分钟"。享受它——这就是 Ruby 的全部意义。
