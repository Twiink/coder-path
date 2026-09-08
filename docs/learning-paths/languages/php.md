# PHP 学习路线

PHP，这门"世界上最好的语言"（PHP 开发者如是说），从个人网站到大型电商平台，驱动着互联网上 70% 以上的网站。虽然常被调侃，但 PHP 的简单上手、强大生态和持续进化，让它依然是 Web 开发的主力军。

## 基础篇

### PHP 入门
- **环境搭建**：XAMPP、WAMP、MAMP、Docker + PHP-FPM
- **基本语法**：PHP 标签（`<?php ?>`）、变量（$符号）、数据类型、常量
- **输出**：echo、print、print_r、var_dump
- **运算符**：算术、比较、逻辑、字符串连接（.）
- **控制流**：if/elseif/else、switch、for/foreach/while/do-while

```php
<?php
echo "Hello, PHP World!";
?>
```

**下一步学习**：基础语法简单，数组和字符串是 PHP 的核心数据结构。

### 数组操作
- **索引数组**：数字索引、array() 和 [] 语法
- **关联数组**：键值对、类似 Map/Dictionary
- **多维数组**：嵌套数组、遍历技巧
- **数组函数**：
  - 遍历：foreach、array_walk、array_map
  - 查找：in_array、array_search、array_key_exists
  - 修改：array_push、array_pop、array_shift、array_unshift
  - 排序：sort、rsort、asort、ksort、usort
  - 合并拆分：array_merge、array_slice、array_chunk
  - 其他：array_filter、array_reduce、array_unique

**下一步学习**：数组灵活强大，字符串处理同样重要。

### 字符串处理
- **字符串定义**：单引号、双引号、Heredoc、Nowdoc
- **字符串操作**：拼接（.）、长度（strlen）、查找（strpos）、替换（str_replace）
- **大小写转换**：strtoupper、strtolower、ucfirst、ucwords
- **分割与连接**：explode、implode
- **正则表达式**：preg_match、preg_match_all、preg_replace
- **字符串格式化**：sprintf、number_format、date

**下一步学习**：字符串处理频繁，函数是代码复用的开始。

### 函数与作用域
- **函数定义**：function 关键字、参数、返回值
- **参数传递**：值传递、引用传递（&）
- **默认参数**：可选参数、默认值
- **可变参数**：...$args（PHP 5.6+）
- **变量作用域**：局部变量、全局变量（global）、静态变量（static）
- **匿名函数**：闭包、use 关键字捕获外部变量
- **箭头函数**：fn() =>（PHP 7.4+）

**下一步学习**：函数封装逻辑，表单和请求处理是 Web 开发基础。

### 表单与请求处理
- **超全局变量**：$_GET、$_POST、$_REQUEST、$_SERVER、$_COOKIE、$_SESSION、$_FILES
- **表单处理**：获取表单数据、数据验证、过滤
- **文件上传**：$_FILES、move_uploaded_file、文件类型检查
- **Cookie 管理**：setcookie、读取 cookie、过期时间
- **Session 管理**：session_start、$_SESSION、session_destroy
- **安全处理**：htmlspecialchars、filter_var、SQL 注入防护

**下一步学习**：表单处理是交互基础，数据库让数据持久化。

### MySQL 数据库
- **连接数据库**：mysqli、PDO（推荐）
- **PDO 基础**：连接、预处理语句、参数绑定
- **CRUD 操作**：INSERT、SELECT、UPDATE、DELETE
- **预处理语句**：防止 SQL 注入、占位符（? 和 :name）
- **事务处理**：beginTransaction、commit、rollback
- **错误处理**：PDO 异常模式、try-catch

**下一步学习**：数据库是数据中心，面向对象让代码更结构化。

## 进阶篇

### 面向对象编程
- **类与对象**：class 关键字、new 实例化、$this
- **属性与方法**：public、private、protected
- **构造函数与析构函数**：__construct、__destruct
- **继承**：extends、parent 关键字
- **抽象类与接口**：abstract、interface、implements
- **Trait**：代码复用、use 关键字、冲突解决
- **魔术方法**：__get、__set、__call、__toString、__clone
- **静态成员**：static、self、::（范围解析运算符）
- **后期静态绑定**：static:: vs self::

**下一步学习**：OOP 是现代 PHP 的基础，命名空间管理代码组织。

### 命名空间
- **命名空间定义**：namespace 关键字
- **命名空间使用**：use、as 别名
- **全局命名空间**：\前缀
- **命名空间与文件结构**：PSR-4 自动加载规范
- **子命名空间**：多级命名空间

**下一步学习**：命名空间避免冲突，自动加载让代码管理简单。

### 自动加载与 Composer
- **自动加载**：spl_autoload_register、PSR-4 规范
- **Composer 基础**：安装、composer.json、require/require-dev
- **依赖管理**：安装包、更新包、composer.lock
- **自动加载配置**：psr-4、classmap、files
- **常用包**：Guzzle（HTTP 客户端）、Monolog（日志）、Carbon（日期时间）
- **脚本**：composer scripts、post-install

**下一步学习**：Composer 是包管理器，异常处理让错误管理规范。

### 异常处理
- **异常基础**：try-catch-finally、throw
- **异常类**：Exception、ErrorException、自定义异常
- **多个 catch**：捕获不同异常类型
- **异常链**：previous 参数
- **Error 类**：PHP 7+ 错误也可捕获
- **错误处理**：set_error_handler、set_exception_handler

**下一步学习**：异常处理规范错误，文件操作处理数据。

### 文件操作
- **读写文件**：fopen、fread、fwrite、fclose
- **便捷函数**：file_get_contents、file_put_contents、file
- **目录操作**：opendir、readdir、scandir、glob
- **文件信息**：file_exists、is_file、is_dir、filesize、filemtime
- **路径操作**：dirname、basename、pathinfo、realpath
- **递归操作**：RecursiveDirectoryIterator、RecursiveIteratorIterator

**下一步学习**：文件操作基础，JSON 和 XML 是数据交换格式。

### JSON 与 XML
- **JSON**：json_encode、json_decode、JSON_THROW_ON_ERROR
- **JSON 选项**：JSON_PRETTY_PRINT、JSON_UNESCAPED_UNICODE
- **XML**：SimpleXML、DOMDocument
- **XML 解析**：simplexml_load_string、xpath 查询
- **XML 生成**：创建节点、属性设置

**下一步学习**：数据格式处理完，正则表达式提升字符串能力。

### 高级正则表达式
- **PCRE 函数**：preg_match、preg_match_all、preg_replace、preg_split
- **模式修饰符**：i（忽略大小写）、m（多行）、s（.匹配换行）、u（UTF-8）
- **捕获组**：括号捕获、命名捕获（`?<name>`）
- **零宽断言**：`(?=...)`、`(?!...)`、`(?<=...)`、`(?<!...)`
- **贪婪与懒惰**：*、+、?、*?、+?

**下一步学习**：正则强大，现代 PHP 特性让代码更优雅。

## 实战篇

### PHP 7/8 新特性
- **PHP 7**：
  - 标量类型声明、返回类型声明、null 合并运算符（??）
  - 太空船运算符（<=>）、匿名类、Throwable 接口
- **PHP 7.4**：
  - 类型属性、箭头函数、null 合并赋值（??=）、扩展运算符
- **PHP 8.0**：
  - JIT 编译器、命名参数、联合类型、match 表达式
  - Nullsafe 运算符（?->）、构造器属性提升、注解（Attributes）
- **PHP 8.1**：
  - 枚举（Enum）、只读属性、Fiber（协程）、never 类型
- **PHP 8.2/8.3**：
  - 只读类、DNF 类型、动态属性弃用

**下一步学习**：新特性让语法现代化，SPL 是标准库宝库。

### SPL（标准 PHP 库）
- **数据结构**：SplStack、SplQueue、SplHeap、SplPriorityQueue
- **迭代器**：Iterator 接口、IteratorAggregate、ArrayIterator
- **文件操作**：SplFileObject、SplFileInfo
- **异常**：SPL 异常类体系
- **观察者模式**：SplObserver、SplSubject

**下一步学习**：SPL 提供工具，性能优化让应用更快。

### 性能优化
- **OPcache**：字节码缓存、配置优化
- **性能分析**：Xdebug Profiler、Blackfire、Tideways
- **数据库优化**：索引、查询优化、连接池
- **缓存策略**：Redis、Memcached、APCu
- **代码优化**：减少数据库查询、避免 N+1 问题、惰性加载
- **HTTP 缓存**：ETag、Last-Modified、缓存头

**下一步学习**：性能优化提升体验，安全是 Web 应用的生命线。

### 安全最佳实践
- **SQL 注入防护**：PDO 预处理、参数绑定
- **XSS 防护**：htmlspecialchars、内容安全策略
- **CSRF 防护**：Token 验证、SameSite Cookie
- **密码安全**：password_hash、password_verify、bcrypt
- **文件上传安全**：类型验证、大小限制、文件名处理
- **会话安全**：session_regenerate_id、HttpOnly Cookie、Secure Cookie
- **输入验证**：filter_var、白名单验证、正则表达式

**下一步学习**：安全是基础，测试保证质量。

### 测试与调试
- **单元测试**：PHPUnit、断言、数据提供者
- **Mock 对象**：PHPUnit Mock、Mockery
- **测试覆盖率**：代码覆盖率报告
- **调试工具**：Xdebug、var_dump、error_log
- **日志系统**：Monolog、PSR-3 日志接口

**下一步学习**：测试保证正确性，框架提升开发效率。

### 流行框架
- **Laravel**：全栈框架、Eloquent ORM、Blade 模板、Artisan CLI
- **Symfony**：企业级框架、组件化、Doctrine ORM
- **CodeIgniter**：轻量级、简单易学
- **Slim**：微框架、RESTful API
- **Lumen**：Laravel 的微服务版本
- **Yii**：高性能、适合大型应用

**下一步学习**：框架加速开发，API 开发是现代趋势。

### RESTful API 开发
- **RESTful 设计**：资源、HTTP 方法、状态码
- **路由**：动态路由、路由参数、路由组
- **认证授权**：JWT、OAuth2、API Key
- **请求处理**：JSON 输入输出、参数验证
- **错误处理**：统一错误响应格式
- **API 文档**：Swagger/OpenAPI、API Blueprint
- **版本管理**：URL 版本、Header 版本

**下一步学习**：API 是服务接口，微服务是架构演进。

### 现代 PHP 生态
- **包开发**：创建 Composer 包、版本管理、发布到 Packagist
- **代码规范**：PSR-1/PSR-2/PSR-12、PHP_CodeSniffer、PHP-CS-Fixer
- **静态分析**：PHPStan、Psalm、代码质量检查
- **持续集成**：GitHub Actions、GitLab CI、Travis CI
- **容器化**：Docker、docker-compose、PHP-FPM + Nginx
- **异步与队列**：Swoole、ReactPHP、Laravel Queue

**下一步学习**：生态完善，现在你已掌握 PHP 全貌！

## 学习建议

### 推荐书籍
- 《Modern PHP》：现代 PHP 开发指南
- 《PHP Objects, Patterns, and Practice》：面向对象与设计模式
- 《Laravel: Up & Running》：Laravel 框架实战

### 学习周期
- **基础篇**：1-2 个月（每天 2-3 小时）
- **进阶篇**：2-3 个月（每天 2-3 小时）
- **实战篇**：3-6 个月（需要项目实践）

### 职业方向
- **Web 后端开发**：Laravel/Symfony 企业应用
- **API 开发**：RESTful/GraphQL API 服务
- **内容管理系统**：WordPress 插件/主题开发
- **电商平台**：Magento/PrestaShop 开发
- **微服务架构**：Swoole/ReactPHP 异步服务

PHP 从最初的"个人主页工具"进化成了现代化的编程语言，PHP 8 的性能甚至可以媲美一些编译型语言。学习 PHP 不是学习过时技术，而是掌握一门持续进化、生态丰富的实用语言。记住：好的 PHP 代码不是能跑就行，而是优雅、安全、高效。继续加油！
