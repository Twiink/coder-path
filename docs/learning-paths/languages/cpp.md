# C++ 学习路线

C++ 是一门"既要贴近硬件、又要抽象优雅"的语言:它统治着系统编程、游戏引擎、嵌入式、音视频与高性能计算。代价是它异常复杂——指针、内存、模板、多继承、移动语义,每个都是深坑;面试与实战中,"C++ 程序员"的含金量也由此而来。好消息是 **C++11 之后的"现代 C++"**(智能指针、移动语义、lambda)已经大幅降低了写安全代码的门槛——**新代码请一律按现代 C++ 写**,把裸 new/delete 留给考古。

这条线按 **基础语法 → 指针与内存 → 类与对象 → 继承与多态 → 运算符重载 → STL → 模板 → 现代 C++(RAII/智能指针/移动)→ 异常与并发 → 文件与网络 → C++20/23 → 性能与工程** 推进。前置建议:先学 [计算机组成原理](/learning-paths/cs-basics/computer-organization)(指针与内存的理解需要硬件直觉)与 [数据结构与算法](/learning-paths/cs-basics/data-structures-algorithms)。

## 第一站:环境与语法地基

**工具链**:编译器三大家(GCC/Linux 默认、Clang/macOS 与工具链新贵、MSVC/Windows),IDE 用 CLion 或 VS Code + CMake 插件;**编译四阶段**:预处理(头文件展开、宏)→ 编译(源码→汇编)→ 汇编(→机器码)→ 链接(合并成可执行文件——**undefined reference 报错就发生在这一阶段**);构建系统用 **CMake**(现代标准,跨平台),手写 Makefile 了解即可。
**基础**:头文件与源文件分离(声明放 .h,定义放 .cpp;#pragma once 防重复包含);`main` 返回 int;基础类型:整型(`int` 通常 4 字节,大小与平台有关——`sizeof` 查;`short/long/long long`)、`char`(1 字节)、`bool`、`float/double`;`auto`(类型推导)、`const`(只读变量);**控制流**:if/switch/for/while 与 C 相同;**函数**:重载(靠参数列表区分,与返回类型无关)、默认参数、`inline`(建议编译器内联);**命名空间**:`namespace` 组织符号,`std::` 前缀、`using namespace` 慎用(污染);输入输出:`std::cin/cout`,**`std::endl` 会 flush 缓冲区(慢),换行用 `'\n'`**。
编译命令入门:`g++ -std=c++17 -Wall main.cpp -o app`(`-Wall` 开警告,新手必须开)。

## 第二站:指针、引用与内存——C++ 的灵魂与深渊

**指针**:存"地址"的变量——`int* p = &x`(取地址)、`*p` 解引用;指针运算(数组遍历:`p+1` 跳过 sizeof 个字节);空指针 `nullptr`(C++11,替代 NULL/0——类型安全);**指针的坑**:悬空指针(指向已释放内存)、野指针(未初始化)、空指针解引用(段错误 Segmentation Fault 的常见来源)。
**数组与指针**:数组名退化为首元素指针(函数传参时);**多级指针/指针数组/数组指针**(`int (*p)[3]` 这种声明读法:从右往左读——了解即可,现代代码很少用)。**引用**:别名——必须初始化、不可重新绑定;**const 引用**(`const T&`):**传参首选**(不拷贝 + 保护原值);函数传参三选:小对象值传递、大对象 const 引用、要改原值用引用或指针。
**动态内存**:`new`/`delete`(单个)、`new[]`/`delete[]`(数组,必须配对!);**内存泄漏**(new 了没 delete)与**悬空**(delete 了还用)——**现代 C++ 的答案是不手动 new:栈对象 + 智能指针**(见第七站),new/delete 只要会读老代码即可。
**内存布局**基本概念:栈(局部变量,自动回收,有限)、堆(动态分配,手动管理)、全局/静态区、代码区——与组成原理的地址空间呼应。

## 第三站:类与对象——封装的艺术

`class` 与 `struct`(默认访问不同:private/public);**访问控制** public/private/protected;**构造函数**:默认构造(无参)、带参构造、**初始化列表**(`: x_(x)`,成员初始化唯一正解;比构造函数体内赋值高效且 const/引用成员必须用它)、**委托构造**(C++11,一个构造调另一个)、`explicit`(禁止隐式转换:`vector&lt;int&gt; v = 5` 这种意外转换的拦截器);**析构函数**:对象销毁时自动调用——**RAII 的基石**(见第七站);拷贝控制三件套:**拷贝构造**(`T(const T&)`,按值传参/返回时触发)与**拷贝赋值**(`operator=`):**类里有指针/动态资源时必须深拷贝**(默认是浅拷贝——两个对象指向同一块内存,double free!)——**三法则/五法则**(析构 + 拷贝构造 + 拷贝赋值,移动时代加移动构造/移动赋值)要背下来;`this` 指针(成员函数隐式第一参,链式调用返回 `*this`);`static` 成员(类级共享,类外定义);**const 成员函数**(`void f() const`,承诺不改对象——能加就加);友元 `friend`(破封装,运算符重载与 << 流输出用它,慎用);**成员初始化顺序**(按声明顺序,不是初始化列表顺序——坑);**默认成员初始化**(C++11,`int x&#123;0&#125;;`)。

## 第四站:继承与多态

**继承**:`class Derived : public Base`(public 继承 = is-a;protected/private 继承少见,了解);构造与析构顺序:**先基类后派生构造,析构相反**;**虚函数与多态**:基类函数标 `virtual`,派生类 `override`(C++11 关键字,编译器帮你查签名错误)——调用时**动态绑定**:通过基类指针/引用调虚函数,运行期根据实际对象类型分派;底层是**虚函数表 vtable**(每个含虚函数的类一张表,对象头有 vptr 指针——多态的对象内存会大一点);**纯虚函数**(`= 0`)与抽象基类(不能实例化——**接口设计**);**虚析构函数:基类析构必须 virtual**,否则通过基类指针 delete 派生类对象时只调基类析构——**内存泄漏的经典来源**;`final`(禁止继承/重写);**多继承与菱形问题**(Diamond:两个基类共享同一祖先 → 祖先被实例化两次、二义性)→ **虚继承 `virtual`**(共享祖先实例,代价是更复杂)——**能不用多继承就不用**;类型转换家族:`static_cast`(编译期,常规转换,首选)、`dynamic_cast`(运行期安全向下转换,需多态类型,失败返回 nullptr/抛 bad_cast)、`const_cast`(去 const,危险)、`reinterpret_cast`(粗暴重解释,几乎别用);RTTI:`typeid` 运行时类型信息。

## 第五站:运算符重载

让自定义类型用起来像内置类型:可重载(算术 `+ - * /`、比较 `== <`、赋值 `=`、下标 `[]`、调用 `()`、`<< >>`(流)、`++/--`(前后置区分:后置带占位 int 参数)、`->`(智能指针必需));不可重载(`::` `?:` `.` `sizeof`)。规则:**`=`、`[]`、`()`、`->` 必须成员函数**;`<<`/`>>` 必须非成员(友元)——因为左侧是 ostream 不是你;**`operator=` 要返回 `*this`**(支持链式 a=b=c)、要自赋值检查(或 copy-and-swap 惯用法);`+` 用非成员让左右操作数都能隐式转换;**重载别改变直觉语义**(`+` 就要做加法,别让 `==` 去排序)。拷贝赋值与拷贝构造一起实现"深拷贝"(见第三站)。

## 第六站:STL——C++ 的武器库

**容器全景**:序列容器——`vector`(动态数组,**连续内存、随机访问 O(1)、尾插 O(1) 摊还、中间插入 O(n)、扩容翻倍导致迭代器失效**;默认首选容器)、`deque`(双端队列,头尾都 O(1))、`list`(双向链表,插入快但缓存不友好,**实际很少用**)、`forward_list`(单向,极致内存)、`array`(定长包装);关联容器——`set`/`map`(**红黑树,有序**,lower_bound 等区间操作)/`multiset`/`multimap`(允许重复);无序容器——`unordered_set`/`unordered_map`(哈希,平均 O(1),**日常查找首选**);容器适配器——`stack`/`queue`/`priority_queue`(堆,默认大顶堆)。
**选型口诀**:默认 vector + unordered_map;要顺序遍历有序数据用 map;频繁头尾操作 deque;极少数场景 list。**迭代器**:容器与算法的桥梁——五种类型(输入/输出/前向/双向/随机访问;vector 是随机访问,list 双向,unordered_ 前向);`begin()/end()`(半开区间 [begin,end),`end()` 是尾后哨兵——遍历判断用 `!= end()` 而不是 `<`);**迭代器失效**(vector 插入/扩容后旧迭代器全废——遍历中删除元素会崩);**算法**(&lt;algorithm&gt;):`sort`(随机访问容器;list 用自带的 sort)、`find/find_if`、`binary_search/lower_bound/upper_bound`(有序容器二分——**lower_bound 是"插入位置"题的标准答案**)、`copy/transform`、`accumulate`、`count`、`min/max`、`reverse`;**remove-erase 惯用法**:`v.erase(std::remove(v.begin(), v.end(), x), v.end())`——**remove 不真删**(它把保留元素前移返回新逻辑结尾),必须配 erase,经典新手坑;**lambda** 作谓词(C++11):`[捕获](参数) &#123; 体 &#125;`,`sort(v.begin(), v.end(), [](int a, int b) &#123; return a > b; &#125;)`。
**string**:`std::string`(自动管理、可变的;find/substr/append/compare/转换 stoi/to_string;`c_str()` 拿 C 字符串)。

## 第七站:现代 C++ 核心——RAII、智能指针与移动语义

**RAII(Resource Acquisition Is Initialization)**:资源(内存/文件/锁/连接)在**构造时获取、析构时释放**——C++ 最核心的思想:栈对象离开作用域必然调析构,资源必然释放,**异常安全也靠它**(栈展开时析构被调用)。文件用 `std::fstream`、锁用 `lock_guard`、内存用智能指针,都是 RAII 的应用——**别手动管理任何资源**。

**智能指针三兄弟**(&lt;memory&gt;,C++11):**`unique_ptr`**(独占所有权:不可拷贝、只能 `std::move` 转移;零开销;默认删除器可定制;**首选**)与 **`shared_ptr`**(共享所有权:引用计数,最后一个释放;`make_shared` 创建(一次分配,更安全高效);**循环引用泄漏**:两个 shared_ptr 互指计数永不归零)与 **`weak_ptr`**(不增加计数的"观察者":`lock()` 临时提升为 shared_ptr——**打破循环引用的标准解**)。**使用铁律:创建用 `make_unique`/`make_shared`,不用裸 new;函数参数传 `const T&` 或裸指针(观察),所有权传递用智能指针;别把 this 裸塞进 shared_ptr(enable_shared_from_this 是正解)**。

**移动语义**(C++11 最大变革):**右值引用 `&&`** 绑定临时对象;`std::move`(**只是类型转换,不搬任何东西**——它把左值"标记"成可移动,真正的搬发生在移动构造/移动赋值里:窃取资源、置空源对象);**移动构造/移动赋值**(五法则第五件:`T(T&&) noexcept`——**标 noexcept**,否则 vector 扩容时不敢用移动会退回拷贝);**完美转发**:模板里 `T&&`(万能引用)+ `std::forward&lt;T&gt;`(按原值类别转发——写库必备);**拷贝省略/返回值优化 RVO**(编译器直接构造到目标位置,连移动都省了——按值返回局部对象是安全的且通常零拷贝)。
**其他现代特性速查**:auto/decltype、范围 for(`for (auto& x : v)`——**要修改元素用引用,不想拷贝用 const auto&**)、lambda 捕获(`[=]` 值/[&] 引用——**按引用捕获局部变量后 lambda 逃逸会悬垂**,循环里捕获要小心)、nullptr、`enum class`(强类型枚举,替代裸 enum)、override/final、`= default`/`= delete`(显式生成/禁止函数)、constexpr(编译期求值)、结构化绑定(C++17:`auto [k, v] = map_entry`)、`std::optional`(可能为空的值,替代哨兵值)、`std::variant`(类型安全联合)、`std::any`(类型擦除)、`string_view`(字符串的只读视图,零拷贝传参)。

## 第八站:异常与并发

**异常**:`try/catch/throw`;标准异常体系(`std::exception` 派生:logic_error/out_of_range/invalid_argument、runtime_error);**异常安全三保证**:基本保证(不泄漏、对象有效但状态不定)/强保证(要么成功要么原状)/noexcept(绝不抛);**RAII + 异常 = 自动清理**(栈展开逐层调析构);`noexcept` 标注(移动构造/析构/swap 应 noexcept——容器优化依赖它);**异常 vs 错误码**:异常用于"真正的异常情况",高频路径/嵌入式/实时系统用错误码或 optional——团队定规矩;**别在析构函数里抛异常**(terminate)。
**多线程**(&lt;thread&gt;,C++11):`std::thread`(启动即跑,`join()` 等结束——**必须 join 或 detach,否则析构 terminate**;detach 后线程成孤儿,访问已销毁变量是 UB,慎用);**数据竞争是 UB**(未定义行为,一切皆有可能——C++ 最狠的坑);同步:`std::mutex` 配 **`lock_guard`**(RAII 锁,首选)/`unique_lock`(可手动 unlock/延迟锁,配条件变量)/`scoped_lock`(C++17,一次锁多把,防死锁);**condition_variable**:`wait(lock, 谓词)`(**必须用谓词重载防虚假唤醒**)+ notify_one/notify_all——生产者消费者;原子:`std::atomic&lt;int&gt;`(无锁操作,`fetch_add` 等;**内存序** memory_order(relaxed/acquire/release/seq_cst)——并发高手的进阶题,默认 seq_cst 最安全);异步任务:`std::async`/`future`/`promise`(拿异步结果);`thread_local`(线程局部变量)。
**并发设计**:死锁四条件与"固定顺序加锁"、锁的粒度、无锁数据结构(了解)。

## 第九站:文件 I/O 与网络

**流 I/O**(&lt;fstream&gt;/&lt;sstream&gt;):`ifstream` 读/`ofstream` 写/`fstream` 读写(RAII,自动关);文本模式 vs **二进制模式**(`read/write`,配结构体注意 padding);格式化:`setw/setprecision/fixed`(I/O 操纵符);`ostringstream`(拼字符串)/`istringstream`(解析,`>>` 按空白分词);流状态(eof/fail/bad/good)。
**网络编程**:POSIX Socket——TCP 服务端五步(`socket/bind/listen/accept/read/write/close`),客户端(`socket/connect`);UDP(sendto/recvfrom);**并发网络模型演进**:每连接一线程 → **select/poll(多路复用)→ epoll(事件驱动,Linux 高并发标准;Windows 是 IOCP)**——与 [操作系统学习路线](/learning-paths/cs-basics/operating-systems) 的 IO 模型章节完全呼应;**第三方库**:Boost.Asio(跨平台异步)、libuv(Node 同款)、muduo(陈硕,Linux 高性能);生产级项目直接用库,裸 Socket 只在教学与底层场景。

## 第十站:C++20/23——现代 C++ 的下一站

**C++20**(大版本):**Concepts 概念**(模板约束:`template<std::integral T>` / requires 子句——**模板报错从"天书"变人话**);**Ranges 范围库**(`v | std::views::filter(...) | std::views::transform(...)` 管道式组合——惰性视图,算法表达力飞跃);**Coroutines 协程**(`co_await/co_yield/co_return`——异步代码的新范式,但库支持仍在成熟);**三路比较 `<=>`**(飞船运算符,`= default` 自动生成全部比较);指定初始化器;`std::span`(连续内存视图)、`std::jthread`(可协作取消的线程)。**C++23**:`std::expected`(错误处理现代方案)、`std::print` 等。**学习策略**:新标准特性按需学,先把 11/17 的根基打牢。

## 第十一站:性能与工程化

**性能是 C++ 的信仰**:编译优化 `-O2/-O3`;分析工具:gprof(函数耗时)/**perf**(Linux 采样,火焰图)/Valgrind(内存错误检测——**段错误与泄漏的第一侦探**)/AddressSanitizer(编译期插桩,`-fsanitize=address`,现代首选);**优化方向**:算法复杂度先行(别用 O(n²) 找借口)、减少拷贝(传引用/移动/string_view)、**缓存友好**(连续内存访问——vector 遍历远快于 list,链接组成原理的缓存行概念)、对象池(高频小对象)、`-march=native` 等编译选项;并行:OpenMP(指令式并行,几行搞定多线程 for)与 SIMD 向量化(编译器自动或手写 intrinsics);**现代 C++ 的性能前提:先测再优化**(benchmark 库)。

**工程化**:构建——CMake(目标/库/测试/安装,现代标准)或 xmake;库——静态库(.a/.lib,链接时打进可执行文件)vs 动态库(.so/.dll,运行时加载);包管理:**vcpkg**(微软,简单)/**Conan**(灵活,工业级);代码规范:Google C++ Style Guide(影响最广)或 LLVM 风格;工具链:clang-format(格式化)/clang-tidy(静态检查)/sanitizers;测试:GoogleTest(事实标准,断言/夹具/参数化)。
**推荐书籍**:《C++ Primer》(入门圣经,吃透前四部分)、《Effective Modern C++》(现代 C++ 42 条,必读)、《Effective C++》(经典 55 条)、《C++ Concurrency in Action》(并发权威)。**方向**:系统编程(OS/驱动/数据库内核)、游戏引擎(Unreal 就是 C++)、嵌入式/物联网、音视频(FFmpeg 生态)、高性能计算/量化交易、浏览器与基础软件(Chromium/MySQL/Redis 源码都是 C 系)。

## 通关标准

能独立做到:写出遵循五法则、用 RAII 管理资源、无裸 new 的现代 C++ 类;说清 unique_ptr/shared_ptr/weak_ptr 的所有权语义与循环引用问题、移动语义解决了什么;能解释虚函数/vtable、为什么基类析构要 virtual、深拷贝与浅拷贝的区别;会用 STL 容器+算法+lambda 完成数据处理并说清迭代器失效规则;能读懂并修改 CMake 构建的中型项目;用 gdb/ASan 定位过段错误——C++ 主线通关。

C++ 是一门需要长期投入的语言:它的复杂度劝退了很多人,但也正是这份"什么都要你管"的控制力,让它站在系统软件的金字塔尖。学 C++ 像练武:先扎马步(内存与对象模型),再练套路(STL 与现代特性),最后才是无招胜有招(模板元编程与并发)。别被"精通 C++"吓住——先做到"安全地写现代 C++",你就已经超过一半的应聘者了。
