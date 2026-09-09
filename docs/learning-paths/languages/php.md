# PHP 学习路线

PHP,"世界上最好的语言"——这当然是调侃,但它驱动着互联网上七成以上的网站(WordPress 一家就占三成以上),从个人博客到电商巨头,从 Laravel 到各类 CMS,生态庞大得可怕。PHP 的真相是:**入门极简、上限很高**——写不好的 PHP 是"能跑的意大利面",写好的 PHP(PHP 8 + 框架 + 工程实践)优雅、安全、高效。它每年都在进化,8.x 的性能与语法已经完全是现代语言的样子。**别学"能跑就行"的 PHP,学现代 PHP**。

这条线按 **环境与基础 → 数组(万能容器)→ 字符串与正则 → 函数 → 表单与会话 → 数据库(PDO)→ 面向对象 → 命名空间与 Composer → 异常与文件 → 性能与安全 → 现代特性与生态** 推进。

## 第一站:环境与语法地基

**运行原理先搞清**:PHP 是"请求-响应"模型——每次 HTTP 请求,入口文件(index.php)被 **PHP-FPM**(进程池)执行一遍,产出 HTML 后进程待命;**生产部署标配是 Nginx + PHP-FPM**(Nginx 处理静态与转发,`fastcgi_pass` 把 .php 交给 FPM);开发环境:XAMPP/宝塔一键包,或 `php -S localhost:8000` 内置服务器(够用),进阶用 Docker。
**标签**:`<?php ... ?>`(纯 PHP 文件**结尾 ?> 可以省略且推荐省略**——避免意外输出空白);注释 `//`/`#`/`/* */`。**变量**:`$` 前缀(`$name`);大小写敏感;类型弱但可标注。**输出**:`echo`(字符串)/`print_r`(数组人肉可读)/**`var_dump`(类型+值,调试神器)**。
**类型**:标量(int/float/string/bool)+ array/object/callable/null;8 起支持**联合类型** `int|string` 与 **strict_types**(文件头 `declare(strict_types=1);` 后类型严格——**现代项目每个文件都加**)。
**常量**:`define('X', 1)` 与 `const X = 1`(类内用 const);魔术常量 `__FILE__`/`__DIR__`/`__LINE__`。**运算符**:算术/比较/逻辑;`.` 字符串拼接(**不是 +**);`==`(宽松,`"1" == 1` 为 true,老笑话)vs `===`(严格,必用);`<=>`(宇宙飞船);**`??` 空合并**(`$a ?? '默认'`——只兜 null/未定义,替代 isset 三连)与 `??=`。
**控制流**:if/elseif/else;foreach 是主力(见下);`match`(8,替代 switch 的表达式:`match ($x) &#123; 1 => 'a', default => 'b' &#125;`——严格比较、不穿透、可返回);for/while/do-while 常规。**内置服务器调试**:`error_reporting(E_ALL)` + `display_errors` 开发期开、生产关(记日志)。

## 第二站:数组——PHP 的万能容器

PHP 数组是**有序映射**(一个结构同时是列表、字典、栈、集合),灵活到极致也随意到极致:`$arr = [1, 2, 3]`(数字键)/`$user = ['name' => 'x', 'age' => 18]`(字符串键,自动维护插入序);多维嵌套;`[]` 追加;解构 `[$a, $b] = $arr`。
**遍历**:`foreach ($arr as $value)` / `foreach ($arr as $key => $value)`;**按引用修改**:`foreach ($arr as &$v)`(**用后必须 unset($v)**,否则残留引用污染后续循环——经典坑);`for` 循环数组用 `count()` 提出去。
**函数库**(PHP 的数组函数有 80+ 个,按需查手册):查找:`in_array`(宽松比较!第三参 true 严格)/`array_search`/`array_key_exists`/`isset`(键存在且非 null,区别要懂);增删:`array_push`/`array_pop`/`array_shift`(头部,慢)/`array_unshift`/`unset`(删键,**不重建索引**——要连续索引用 array_values);排序:`sort`/`rsort`(值,重建索引)/`asort`(值保键)/`ksort`(键)/`usort`/`uasort`(自定义比较器);合并拆分:**`array_merge`**(字符串键后者覆盖、**数字键重新编号**)vs `+`(数字键保留前者,键冲突前者赢——区别必考)/`array_slice`/`array_chunk`/`array_splice`;变换:**`array_map`(注意参数顺序:先回调后数组,与 JS 相反)/`array_filter`(默认去假值,可带 ARRAY_FILTER_USE_BOTH)/`array_reduce`**;实用:`array_column`(取二维数组一列——从数据库结果集抽字段的神器)/`array_unique`/`array_flip`(键值互换)/`array_combine`/`array_key_first`/`array_sum`/`array_count_values`/`range`/`compact`+`extract`(少用)/`implode`(数组转字符串);**数组解包 `...`**(7.4,合并与传参)。
**JSON 互转**是 PHP 数组的最常见出口:`json_encode($arr)`(配 JSON_UNESCAPED_UNICODE 防中文变 \uXXXX)与 `json_decode($json, true)`(**第二参 true 得数组而非对象**——忘了就是"为什么取不到属性"的日常)。

## 第三站:字符串与正则

**引号语义**(PHP 特色):单引号(原样,不解析变量)vs 双引号(**解析变量与转义**:`"hi $name"`、`"&#123;$obj->name&#125;"` 花括号定界);heredoc(`<<<EOT ... EOT`,多行+插值)/nowdoc(`<<<'EOT'`,不插值);8 起支持 `sprintf` 式新语法?不,保持。
**操作**:拼接用 `.`(循环里大量拼接用 `.=` 或攒数组后 implode——性能);`strlen`(**字节数!**中文要 `mb_strlen`)/`strpos`(**找不到返回 false,判断必须 `!== false`**——`if (strpos($s, 'x'))` 遇到位置 0 是经典 bug)/`str_contains`/`str_starts_with`/`str_ends_with`(8,告别 strpos !== false)/`str_replace`(支持数组批量)/`substr`(字节版!中文 mb_substr)/`explode`/`implode`/`strtoupper`/`strtolower`/`ucfirst`/`trim`/`str_pad`/`sprintf`(格式化)/`number_format`(千分位)/`nl2br`;日期:`date('Y-m-d H:i:s')`/`strtotime`(解析"next monday"这类)/`time()`/`DateTime` 类;**生产用 Carbon 库**(Laravel 内置,链式人性化)。
**正则(PCRE,与 Perl 同源)**:函数四件:`preg_match`(**返回 0(无匹配)/1(匹配)/false(出错)三态**——`if (preg_match(...))` 只看真假没问题,但严格判断用 === 1)/`preg_match_all`(全局,配捕获组出二维)/`preg_replace`(支持数组与 `$1` 反向引用,回调版)/`preg_split`;**修饰符**:`i`/`m`/`s`/`u`(处理 UTF-8 **必须加 u**,否则中文匹配错乱)/`x`;命名捕获 `(?&lt;name&gt;...)`(8.2 起可用 `\g&#123;name&#125;`?普通 `$matches['name']`);零宽断言 `(?=)`/`(?!)/`(?<=)`/`(?<! )`;贪婪 `*+` vs 懒惰 `*?`。
`preg_quote`(把用户输入转义成正则字面量)。

## 第四站:函数与作用域

`function foo($a, $b = 默认) &#123;&#125;`;**作用域是"函数级隔离"**:函数内看不到外部变量,要用必须 `global $x`(或 $GLOBALS)——**与 JS/Python 不同,现代风格是参数传入**;**static 局部变量**(函数多次调用间保留值,计数器/缓存);参数传递:默认按值,`&` 按引用(少用);`...$args` 可变参数(收集数组);**命名参数**(8,`foo(b: 2)`——跳过可选参数);返回:`return`;`?type` 可空返回、`void`/`never`(8.1,抛异常/exit 的函数)。
**类型声明**:参数/返回值可标 `int`/`string`/`array`/`callable`/类名/接口名;**联合类型** `int|string`、`mixed`、`false` 伪类型;弱类型下自动 coercion(如 `"5"` 自动转 5),strict_types 下报 TypeError。
**闭包与箭头函数**:闭包 `function () use ($x) &#123;&#125;`(**use 显式捕获外部变量**,与 JS 自动捕获不同——忘了 use 就是 undefined variable 警告);箭头函数 `fn($a) => $a + $x`(7.4,**自动按值捕获** use 列表,单表达式);`callable` 类型与**可变函数**(变量名即函数名 `$fn()`)、`Closure::call`(高级)。
**内置函数命名规律**(重要,不然永远记不住):字符串 str_*、数组 array_*、布尔 is_*/has_*。

## 第五站:表单、会话与文件上传

**超全局数组**(PHP Web 的入口):`$_GET`/`$_POST`(表单与查询串;`$_REQUEST` 是两者合并,别用——来源不明)/`$_SERVER`(`REQUEST_METHOD`/`HTTP_USER_AGENT`/`REMOTE_ADDR` 等)/`$_COOKIE`/`$_SESSION`/`$_FILES`。
**输入处理三板斧**:①取——永远不要裸用超全局,经框架 Request 对象或自己 `filter_input`;②**校验**——`filter_var($email, FILTER_VALIDATE_EMAIL)`(内置过滤器比手写正则稳)/白名单;③**转义输出**——`htmlspecialchars($s, ENT_QUOTES)`(**输出时转义是防 XSS 的铁律**,`<?= htmlspecialchars($name) ?>` 模板标配)。
**Cookie**:`setcookie(name, value, ['expires'=>..., 'httponly'=>true, 'secure'=>true, 'samesite'=>'Lax'])`(选项数组是 7.3+ 姿势,属性意义见 [Web 安全](/learning-paths/security/web-security))。
**Session**:`session_start()`(必须在任何输出前)→ `$_SESSION['user_id'] = 1`;安全:登录成功后 **`session_regenerate_id(true)`**(防会话固定攻击)、Cookie 加 HttpOnly/Secure/SameSite、`session_destroy` 登出。
**文件上传**($_FILES 结构:name/type/tmp_name/error/size):错误码检查(UPLOAD_ERR_OK)、大小与 **MIME 白名单检查**(别信客户端 filename 扩展名)、`move_uploaded_file($tmp, $dest)`(必须用它移动,直接 copy 临时文件是安全漏洞)、文件名重新生成(防路径穿越)。

## 第六站:数据库——PDO 与预处理

PHP 连 MySQL 用 **PDO**(PHP Data Objects),不用老 mysqli:`new PDO('mysql:host=...;dbname=...;charset=utf8mb4', $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION])`(异常模式必开);连接选项:`ATTR_DEFAULT_FETCH_MODE => FETCH_ASSOC`(默认拿关联数组)。
**预处理语句(防 SQL 注入的唯一正解)**:`$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?')`;执行 `$stmt->execute([$email])`(问号占位)或命名占位符 `:email` + 关联数组;`bindValue` vs `bindParam`(后者绑引用,execute 时才取值——日常直接 execute 传数组)。
**取数据**:`fetch()`(一行,配合 while 循环)/`fetchAll()`(全量,小数据)/`fetchColumn`(单值);**CRUD 都走预处理**。**事务**:`$pdo->beginTransaction()` → 多条 SQL → `commit()`;出错 `rollBack()`(包 try/catch)——转账、下单这种"要么全成要么全不成"的业务必用(事务概念见 [MySQL 路线](/learning-paths/database/mysql))。
**SQL 注入原理**要能讲:字符串拼接 SQL(`"WHERE id = $id"`)时用户输入 `1 OR 1=1`/`'; DROP TABLE...` 改变语句结构;预处理把数据与语句分离,注入失效。**连接复用**:PHP-FPM 每请求一条连接(短连接),连接池靠 Swoole/常驻框架解决;查询性能:索引、避免 N+1(见 Laravel 章节)。

## 第七站:面向对象

**类**:`class User &#123;&#125;`、`new`、`$this->`;**属性**(7.4 起可声明类型 `public string $name;`)、访问控制 public/private/protected;**构造器** `__construct`(**属性提升 promotion**:8 起 `public function __construct(private string $name) &#123;&#125;` 自动声明+赋值——样板终结者);析构 `__destruct`(少见)。
**static** 与范围解析 `::`:`self::`(当前类,**早期绑定**)vs **`static::`(后期静态绑定**——子类覆写后 static 调的是子类版本,8 的 enum 案例常用);`parent::`。**继承**:extends + parent::__construct;方法覆写;**final**(禁继承/禁覆写);抽象类 abstract + **接口 interface/implements**(多接口);**Trait**(PHP 的单继承补丁:代码水平复用,`use TraitName;`,冲突用 `insteadof`/`as` 解决——Laravel 里大量 trait)。
**魔术方法**(__ 开头,自动触发):`__construct`/`__destruct`/`__get`/`__set`(访问不存在属性时,老 ORM 的动态字段)/`__call`(调不存在方法,门面 Facade 原理)/`__toString`(echo 对象)/`__clone`(控制深拷贝)/`__invoke`(对象当函数)/`__sleep`/`__wakeup`(序列化)。
**枚举 enum**(8.1 大特性):`enum Status: string &#123; case Active = 'active'; &#125;`——纯枚举/带值枚举、方法、`from()`/`tryFrom()`、`match($status)`——状态机的现代答案;**readonly 属性/类**(8.1/8.2,不可变对象)。
**匿名类**(new class &#123;&#125;)。**对象比较**:==(属性全等)vs ===(同一实例)。

## 第八站:命名空间、Composer 与自动加载

**命名空间**:`namespace App\Models;`(文件第一行,PSR 风格);`use App\Models\User;` + `as` 别名;全限定 `\` 开头(全局类如 `\DateTime`);命名空间 ≠ 目录,但 **PSR-4 规范**把它们绑定:命名空间 `App\` 映射到 `src/`,`App\Models\User` → `src/Models/User.php`。
**Composer(PHP 的包管理器,现代 PHP 的基石)**:`composer require vendor/package` 装依赖 → 生成 `vendor/` 与 **`composer.lock`(必须提交,锁定版本)**;`composer.json` 里配 ("autoload": &#123; "psr-4": &#123; "App\\": "src/" &#125; &#125;) → `composer dump-autoload` → `require 'vendor/autoload.php'` 一行让所有类自动加载(**不用手写 require 每个文件**——老 PHP 教程的 require_once 地狱到此终结);`require-dev`(测试工具)、`scripts`(自定义命令)、`composer update`(升版本)vs `install`(按 lock);常用包:Guzzle(HTTP 客户端)、Monolog(日志,PSR-3)、Carbon(日期)、PHPUnit、PHPStan。

## 第九站:异常、错误与文件

**PHP 7 前的错误是"通知"不是异常;7+ 统一为 Throwable**:`Exception`(业务异常)与 **`Error`**(TypeError/ValueError 等引擎错误)都可被 catch。`try &#123; &#125; catch (TypeError $e) &#123; &#125; catch (Exception $e) &#123; &#125; finally &#123; &#125;`(多 catch 按序匹配、`$e->getPrevious()` 异常链、`throw new X('msg', 0, $prev)`);自定义异常继承 Exception;**全局兜底**:`set_exception_handler`(未捕获异常统一转 500 JSON——API 项目必配);错误级别:`error_reporting(E_ALL)`、`@` 抑制符是毒药(别用)。
**文件操作**:一键式 `file_get_contents($path)`/`file_put_contents`(配 `LOCK_EX` 防并发写坏)——**80% 场景够用**;流式 `fopen`/`fgets`/`fwrite`/`fclose`(大文件逐行);目录:`scandir`/`glob('*.log')`/`mkdir`/`is_dir`;路径:`dirname`/`basename`/`pathinfo`/`realpath`;信息:`file_exists`/`is_file`/`filesize`/`filemtime`;`SplFileObject`(面向对象封装,迭代逐行);下载响应头与 `readfile`;**流 context**(file_get_contents 第二参传 headers/超时——抓取远程 API 的平民方案)。
**JSON**:`json_encode`(选项:JSON_UNESCAPED_UNICODE/JSON_PRETTY_PRINT/**JSON_THROW_ON_ERROR**(8.3 默认,失败抛异常而非静默 null))、`json_decode($s, true, 512, JSON_THROW_ON_ERROR)`;**XML**:SimpleXML(读)或 DOMDocument(复杂),现代 API 以 JSON 为主,XML 出现在老系统互操作。

## 第十站:性能与安全

**性能**:①**OPcache 必开**(PHP 源码每次请求都要"编译"成字节码,OPcache 缓存之——生产不开它等于自费一半性能;`opcache.enable`、`validate_timestamps` 开发关);②数据库是最大瓶颈:索引、**N+1 查询**用预加载(见框架)、慢查询日志;③缓存:Redis/Memcached(热数据)/APCu(本地变量)/页面缓存;④HTTP 层:`ETag`/`Last-Modified`/Cache-Control(静态资源与 API 响应);⑤常驻内存:Swoole(协程,高并发 API,学习曲线陡)/RoadRunner;⑥剖析:Xdebug(调试器 + profiler,**生产环境不要装**)、Blackfire。
**安全清单**(Web 安全的 PHP 实践版,理论见 [Web 安全路线](/learning-paths/security/web-security)):**SQL 注入**(PDO 预处理——见第六站)、**XSS**(输出 htmlspecialchars + CSP 头)、**CSRF**(表单令牌 + SameSite Cookie——Laravel 自动)、**密码**(`password_hash($pw, PASSWORD_DEFAULT)` 与 `password_verify`——**永远不要自己 md5/sha1 存密码**,也不要自己发明加盐算法;bcrypt/argon2 内置)、**文件上传**(白名单 + move_uploaded_file)、**会话**(regenerate_id + HttpOnly)、**SSRF**(服务端请求用户 URL 时校验白名单)、**依赖漏洞**(`composer audit`)、**安全头**(`header('X-Frame-Options: DENY')` 等,框架中间件会配)。

## 第十一站:现代 PHP 与生态

**版本特性时间线**(新代码直接 8.2+):7.0(标量类型/`??`/`<=>`)、7.4(属性类型/箭头函数/`??=`)、**8.0(JIT、命名参数、联合类型、match、Nullsafe `?->`、构造器属性提升、Attributes 注解**)、8.1(**enum、readonly、Fiber 协程**、never)、8.2(只读类、DNF 类型)、8.3(类型化类常量)。
**Attributes(注解,8.0)**:`#[Route('/user')]` 替代 PHPDoc 注释约定,框架路由/验证的现代方式——`#[Attribute]` 自定义 + 反射读取。**SPL 标准库**:数据结构(SplStack/SplQueue/SplHeap/SplPriorityQueue)、迭代器接口(Iterator/IteratorAggregate——让对象可 foreach)、SplFileObject、SplObserver/SplSubject(观察者)。
**框架选型**(PHP 开发绕不开):**Laravel**(现代 PHP 的事实标准:Eloquent ORM、Blade 模板、Artisan CLI、中间件、队列、事件、迁移、认证脚手架、生态(Breeze/Jetstream/Spark);**请求生命周期**(public/index.php → 容器 → 路由 → 中间件 → 控制器 → 响应)值得完整走一遍——见 [Laravel 学习路线](/learning-paths/backend/laravel));Symfony(组件化企业级,Laravel 的地基也是它)、Slim(微框架写 API)、CodeIgniter(轻量老牌);**CMS**:WordPress(主题/插件开发是独立职业方向)。
**API 与异步**:RESTful(资源/方法/状态码,见 [全栈](/learning-paths/fullstack/overview))、JWT/OAuth2 认证、OpenAPI 文档;**异步与队列**:Laravel Queue + Redis(后台任务)、Swoole/ReactPHP(常驻协程,高并发场景)。
**工程质量**:代码规范 **PSR-12** + PHP-CS-Fixer(自动格式化)、**PHPStan/Psalm 静态分析**(level 从 0 到 9——把"动态的 PHP"重新加上类型安全网,现代项目标配)、**PHPUnit**(单元测试:断言/数据提供者 provider/@test 注解/mock)、CI(GitHub Actions 跑测试与静态分析)、Docker 部署(Nginx + PHP-FPM 镜像)。

## 通关标准

能独立做到:写出不拼接 SQL、输出全转义、密码用 password_hash 的"无毒" PHP;说清 PDO 预处理为什么能防注入、`==` 与 `===`、`array_merge` 与 `+` 的区别;会用 Composer 管理依赖并配 PSR-4 自动加载;能讲 Laravel 一次请求的完整生命周期(入口 → 容器 → 路由 → 中间件 → 控制器 → Eloquent → 响应);会配 OPcache 并用 PHPStan 给项目做过静态分析——PHP 主线通关。

PHP 从"个人主页工具"进化成了现代化语言:8.x 的语法、Composer 生态、Laravel 的工程化,让它依然是 Web 开发最务实的选项之一——学习成本低、岗位多、部署简单、改完即生效。别理会"PHP 已死"的梗(它每年都"被死"一次),也别做"能跑就行"的开发者:预处理、转义、password_hash、Composer、框架、测试——按这条线走完,你写的就是**现代 PHP**。
