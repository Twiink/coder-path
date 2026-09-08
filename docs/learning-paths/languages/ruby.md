# Ruby 学习路线

Ruby，这门"程序员幸福感最高"的语言，以其优雅的语法和强大的表达力，赢得了无数开发者的青睐。"一切皆对象"的设计哲学和 Rails 框架的成功，让 Ruby 成为 Web 开发的利器。学 Ruby，就是在学习如何写出让人愉悦的代码。

## 基础篇

### Ruby 入门
- **环境搭建**：Ruby 安装（rbenv/rvm）、gem 包管理器、IRB 交互式环境
- **基本语法**：变量、数据类型、注释、输出（puts/print/p）
- **数据类型**：数字、字符串、符号（Symbol）、布尔值、nil
- **运算符**：算术、比较、逻辑、范围运算符（..、...）
- **控制流**：if/elsif/else、unless、case/when、三元运算符

```ruby
puts "Hello, Ruby World!"
```

**下一步学习**：基础语法优雅，数组和哈希是数据容器。

### 数组与哈希
- **数组**：创建、索引、切片、常用方法（push、pop、shift、unshift）
- **数组迭代**：each、map、select、reject、reduce
- **数组操作**：sort、reverse、uniq、flatten、zip
- **哈希（Hash）**：键值对、符号作为键、遍历
- **哈希方法**：keys、values、merge、select、each

**下一步学习**：数据结构是基础，方法定义让代码模块化。

### 方法与块
- **方法定义**：def 关键字、参数、返回值（隐式返回）
- **参数类型**：位置参数、默认参数、可变参数（*args）、关键字参数（**kwargs）
- **块（Block）**：do...end 和 { } 语法、yield 关键字
- **块参数**：|x| 语法
- **Proc 对象**：lambda 和 proc、call 方法
- **lambda vs proc**：参数检查、return 行为差异

**下一步学习**：块是 Ruby 的灵魂，字符串处理无处不在。

### 字符串处理
- **字符串定义**：单引号、双引号、插值（#{}）
- **多行字符串**：Heredoc（<<~TEXT）
- **符号（Symbol）**：不可变标识符、性能优势
- **字符串方法**：upcase、downcase、capitalize、length、include?
- **字符串操作**：split、join、gsub、strip、chars
- **正则表达式**：=~、match、scan、正则字面量（/pattern/）

**下一步学习**：字符串灵活，面向对象是 Ruby 的核心。

### 面向对象基础
- **类与对象**：class 关键字、initialize 构造方法、new 实例化
- **实例变量与方法**：@variable、getter/setter
- **访问控制**：public、private、protected
- **attr 系列**：attr_reader、attr_writer、attr_accessor
- **继承**：< 符号、super 关键字
- **类变量与方法**：@@variable、self.method

**下一步学习**：OOP 是结构，模块是代码复用的利器。

### 模块与 Mixin
- **模块定义**：module 关键字、命名空间
- **Mixin**：include（实例方法）、extend（类方法）
- **模块方法**：module_function
- **模块常量**：模块作为常量容器
- **可枚举模块**：Enumerable、include Enumerable

**下一步学习**：模块让代码复用，文件操作处理数据。

## 进阶篇

### 文件与 I/O
- **文件读写**：File.read、File.write、File.open
- **块形式打开**：File.open { |f| ... } 自动关闭
- **遍历文件**：each_line、readlines
- **目录操作**：Dir.entries、Dir.glob、Dir.mkdir
- **路径操作**：File.join、File.dirname、File.basename
- **存在性检查**：File.exist?、File.directory?、File.file?

**下一步学习**：文件操作基础，异常处理让程序健壮。

### 异常处理
- **异常捕获**：begin-rescue-ensure-end、rescue 修饰符
- **异常类型**：StandardError、RuntimeError、ArgumentError
- **自定义异常**：继承 StandardError
- **抛出异常**：raise、throw/catch
- **重试机制**：retry 关键字
- **异常链**：捕获并重新抛出

**下一步学习**：异常处理保证安全，正则表达式提升文本能力。

### 正则表达式深入
- **正则字面量**：/pattern/、%r{pattern}
- **匹配方法**：=~、match、scan、grep
- **替换方法**：sub、gsub、gsub!
- **捕获组**：$1、$2、命名捕获（`?<name>`）
- **正则选项**：i（忽略大小写）、m（多行）、x（扩展）
- **MatchData 对象**：captures、named_captures

**下一步学习**：正则强大，迭代器和枚举是 Ruby 特色。

### 迭代器与枚举
- **迭代器**：each、times、upto、downto、step
- **Enumerable 方法**：
  - 过滤：select、reject、find、find_all
  - 转换：map、collect、flat_map
  - 聚合：reduce、inject、sum、max、min
  - 分组：group_by、partition、chunk
  - 其他：zip、cycle、take、drop

**下一步学习**：枚举让集合操作优雅，元编程是 Ruby 的魔法。

### 元编程
- **动态方法**：send、public_send、define_method
- **method_missing**：拦截未定义方法调用
- **动态属性**：instance_variable_get/set
- **类宏**：attr_accessor 的实现原理
- **class_eval/instance_eval**：动态代码执行
- **hook 方法**：inherited、included、extended、method_added
- **单例类**：eigenclass、class << self

**下一步学习**：元编程是高级技巧，反射提供内省能力。

### 反射与内省
- **对象内省**：class、is_a?、respond_to?、methods
- **类内省**：ancestors、superclass、included_modules
- **方法对象**：method、instance_method、Method 类
- **源码位置**：source_location
- **常量查找**：const_get、const_defined?

**下一步学习**：反射看清内部，并发编程处理多任务。

## 实战篇

### 多线程与并发
- **Thread 类**：创建线程、join、状态查询
- **线程同步**：Mutex、ConditionVariable、Queue
- **线程局部变量**：Thread.current
- **Fiber**：轻量级协程、resume、yield
- **Ractor**：Ruby 3.0 并行抽象、无共享并发

**下一步学习**：并发提升性能，Gem 是 Ruby 的生态。

### Gem 开发与管理
- **Bundler**：Gemfile、bundle install、bundle exec
- **依赖管理**：版本约束、Gemfile.lock
- **创建 Gem**：bundle gem、gemspec 文件
- **Gem 结构**：lib 目录、版本管理、README
- **发布 Gem**：注册 RubyGems 账号、gem push
- **常用 Gem**：pry（调试）、rake（任务）、rspec（测试）

**下一步学习**：Gem 是生态基础，测试保证质量。

### 测试与调试
- **RSpec**：describe、context、it、expect
- **测试类型**：单元测试、集成测试、特征测试
- **Mocking/Stubbing**：double、allow、expect
- **MiniTest**：轻量级测试框架
- **调试工具**：pry、byebug、断点调试
- **测试覆盖率**：SimpleCov

**下一步学习**：测试保证正确性，Rails 是 Ruby 的杀手级应用。

### Ruby on Rails 基础
- **MVC 架构**：Model、View、Controller
- **路由**：routes.rb、RESTful 路由、嵌套路由
- **Active Record**：ORM、迁移、关联、验证、查询
- **视图与模板**：ERB、helpers、partial、layout
- **控制器**：action、params、redirect、render
- **表单**：form_with、强参数（strong parameters）
- **资源管理**：scaffolding、CRUD 操作

**下一步学习**：Rails 是框架，掌握后可以快速开发 Web 应用。

### Rails 进阶特性
- **Action Cable**：WebSocket、实时通信
- **Active Job**：后台任务、队列系统
- **Action Mailer**：邮件发送
- **Active Storage**：文件上传、云存储
- **Turbo/Hotwire**：SPA 体验、无需前端框架
- **API 模式**：Rails API、序列化

**下一步学习**：Rails 功能丰富，性能优化让应用更快。

### 性能优化
- **数据库优化**：N+1 查询、eager loading、索引
- **缓存策略**：Fragment caching、Russian Doll caching、Redis
- **后台任务**：Sidekiq、Resque、Delayed Job
- **性能分析**：rack-mini-profiler、bullet、skylight
- **代码优化**：避免过度对象创建、使用 Symbol 而非 String

**下一步学习**：性能优化提升体验，现代 Ruby 特性让代码更好。

### Ruby 3.x 新特性
- **Ruby 3.0**：
  - Ractor（并行抽象）、Fiber Scheduler（异步 I/O）
  - 静态类型分析（RBS、TypeProf）、性能提升 3x3
- **Ruby 3.1**：
  - YJIT（JIT 编译器）、调试 gem、错误提示改进
- **Ruby 3.2/3.3**：
  - WASI 支持、正则性能提升、内存优化

**下一步学习**：新特性让语言进化，现在你已掌握 Ruby 的核心！

## 学习建议

### 推荐书籍
- 《Programming Ruby》（Pickaxe Book）：Ruby 经典教材
- 《Eloquent Ruby》：优雅的 Ruby 编程
- 《Metaprogramming Ruby》：元编程深入指南
- 《Agile Web Development with Rails》：Rails 开发实战

### 学习周期
- **基础篇**：1-2 个月（每天 2-3 小时）
- **进阶篇**：2-3 个月（每天 2-3 小时）
- **实战篇**：3-6 个月（需要 Rails 项目实践）

### 职业方向
- **Web 开发**：Ruby on Rails 全栈开发
- **API 开发**：RESTful API、GraphQL API
- **DevOps 工具**：基础设施自动化脚本
- **数据处理**：脚本编写、批处理任务

Ruby 的设计哲学是"让程序员快乐"，它的语法优雅、表达力强，写 Ruby 代码就像在写诗。虽然性能不是最快的，但开发效率和代码可读性是一流的。记住：Ruby 教你的不仅是编程技巧，更是对代码美学的追求。享受 Ruby 带来的编程乐趣吧！
