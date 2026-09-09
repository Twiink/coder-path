# Make 学习路线

Make 是 Unix/Linux 世界**最经典的构建自动化工具**(1976 年诞生,至今活跃):用 **Makefile 描述"文件间的依赖关系与构建规则"**,Make 智能地**只重新构建变化的部分**——"增量构建"的祖师爷。它主要用于 C/C++ 项目,但**它的思想(依赖/增量/规则)是所有现代构建工具(Maven/Gradle/CMake/Ninja)的源头**——学 Make 不只是学工具,更是理解"自动化构建的本质"。**现代定位**:新 C/C++ 项目直接上 **CMake**(现代标准,见 [C++ 路线](/learning-paths/languages/cpp) 的构建章),但**读开源 C 项目(Makefile 遍地)、写服务器部署脚本、理解构建原理**,Make 依然是必修。

## 第一站:核心思想与第一个 Makefile

**Make 的心智模型(比语法重要)**:构建 = 一组**规则**:`目标(target): 依赖(prerequisites)` + 命令(recipe)——**目标比依赖旧(时间戳)就重新执行命令生成它**;依赖本身也可以是别的目标(递归构建)。**这就是全部:声明依赖图,Make 自动决定"什么要重做"**。**第一个 Makefile(背下来)**:`hello: hello.o` 换行 Tab 开头 `gcc hello.o -o hello`;`hello.o: hello.c` Tab `gcc -c hello.c`——运行 `make` 执行第一个目标;再改 hello.c,`make` 只重编 hello.o 与链接(**增量构建生效**)。**三个新手坑**:①**命令行必须是 Tab 缩进(不是空格!)**——"missing separator"报错的唯一原因;②默认执行第一个目标(惯例叫 all);③规则顺序即构建意图。**语法元素**:注释 `#`、续行 `\`、多依赖空格分隔、`.PHONY` 声明伪目标(不对应文件:clean/all/install——**必须声明,否则同名文件存在时目标被跳过**)。

## 第二站:变量与自动变量——去重与可维护

**变量定义四种**:`=`(递归展开:引用时才展开,可自引用拼装)、`:=`(立即展开:定义时算好,推荐)、`?=`(未定义才赋值:允许外部覆盖)、`+=`(追加);引用 `$(VAR)`。**预定义变量(编译器世界惯例)**:CC(cc)/CXX(g++)/CFLAGS(编译选项)/CXXFLAGS/LDFLAGS(链接)/RM——**用变量别硬编码,`make CFLAGS="-O2"` 命令行可覆盖**。**自动变量(规则里的魔法,必背)**:`$@`(目标名)、`$<`(第一个依赖)、`$^`(全部依赖去重)、`$?`(比目标新的依赖)、`$*`(模式匹配的茎);目录部分 `$(@D)`。**函数(字符串处理)**:`$(wildcard *.c)`(拿文件列表——**别手写源文件清单**)、`$(patsubst %.c,%.o,$(SRCS))` 或简写 `$(SRCS:.c=.o)`(把 .c 列表转 .o 列表——**C 项目 Makefile 的两行核心**)、`$(shell ...)`(执行命令:uname 检测平台)、`$(filter/firstword/...)` 按需查。**典型 C 项目骨架(五件套)**:SRCS=$(wildcard src/*.c)、OBJS=$(SRCS:.c=.o)、TARGET=app、`all: $(TARGET)`、`clean:`(rm 中间产物)——**几十行的 Makefile 足够管理一个中型 C 项目**。

## 第三站:模式规则与隐含规则——少写重复

**模式规则(一条规则管一类文件)**:`%.o: %.c`(任何 .c 编译成同名 .o)——**配合自动变量,一行替代所有重复规则**:命令 `$(CC) $(CFLAGS) -c $< -o $@`;静态模式限定范围:`$(OBJS): %.o: %.c`。**隐含规则(内置的默认模式)**:Make 内置 .c→.o、.o→可执行 的规则(用 CC/CFLAGS 变量)——**所以极简 Makefile 只要写依赖,命令可省**(`app: main.o util.o` 就能链接;`make -p` 看全部内置规则)——理解隐含规则,你读别人的 Makefile 才能看懂"为什么没写命令"。

## 第四站:条件、包含与递归——组织复杂构建

**条件**:ifeq/ifneq/ifdef/ifndef + else/endif(按平台/调试开关切编译选项);**include**:拆分配置(common.mk)与共享规则(`-include` 忽略缺失——**自动依赖文件的标配姿势**);**递归 Make(老式多目录)**:子目录各自 Makefile,父级 `$(MAKE) -C subdir`——**缺点:依赖图割裂、并行不安全——新项目避免,用单层 + 子目录通配(见实战)或 CMake**;**目标特定变量**:`debug: CFLAGS += -g`(只对该目标生效——debug/release 变体的简单实现);**特殊目标**:.PHONY(伪目标)、.DELETE_ON_ERROR(失败删产物)、.NOTPARALLEL;并行构建:`make -j$(nproc)`(**多核编译提速的钥匙——依赖写对才安全**)。

## 第五战:自动依赖生成——头文件变化的正确姿势

**痛点**:手写依赖时,改了头文件 .c 不会重编(依赖里没列 .h)——**大型 C 项目的经典坑**。**正解:编译器生成依赖**——gcc 的 `-MMD -MP` 在编译时同时产出 `.d` 文件(含该 .c 依赖的头文件列表),Makefile 里 `-include $(DEPS)` 把它们纳入依赖图——**从此改任何头文件,依赖它的 .o 自动重编**(现代 C 项目 Makefile 的必备环节;CMake/Ninja 内部也是这套机制)。

## 第六站:常用目标与部署脚本模式

**标准目标五件套(约定,开源项目通用)**:`all`(默认构建)、`clean`(删中间产物,`-$(RM)` 忽略不存在错误)、`distclean`(全清含配置)、`install`(拷到系统:PREFIX 变量,默认 /usr/local——**别硬编码安装路径**)、`test`/`check`(跑测试)、`help`(@echo 列目标说明——**好 Makefile 的"文档"**)。**调试三命令**:`make -n`(只打印不执行——dry run 检查命令)、`make -p`(打印全部规则变量)、$(info/warning/error) 在 Makefile 里打点。**部署场景(超出 C 的实用价值)**:Makefile 也能当"任务脚本"用——`deploy: build` + rsync/scp、`db-migrate` 等伪目标——**"用 make 管项目任务(构建/测试/部署/清理)"是很多后端仓库的轻量自动化选择**(比手写一串 shell 记忆负担小)。

## 第七站:与构建生态的关系——位置与替代

**Make 的坐标系(面试/选型要会说)**:Make = **通用规则引擎**(语言无关,但手写依赖痛苦);**CMake = 现代 C/C++ 的标准**(CMakeLists 描述目标,生成 Makefile/Ninja——**新 C++ 项目用它,见 [C++](/learning-paths/languages/cpp) 构建章**);**Ninja = 极速执行引擎**(CMake 的推荐生成器,大项目秒级增量);Autotools(configure 时代遗产,老开源项目);Meson/Bazel(新一代,大厂)。**现代实践**:C/C++ 写 CMake(或直接 Ninja),Make 的用武之地——读老项目、轻量任务自动化、理解构建原理;**Make 的哲学(学它的真正收获)**:增量构建(输入输出)、规则即依赖图、自动化思维——**这套心智迁移到任何构建工具与 CI 都成立**。

## 通关标准

能独立做到:给一个多文件 C 项目写出规范 Makefile(wildcard 源文件、自动变量、模式规则、-MMD 自动依赖、clean/test 目标)并验证"改头文件只重编依赖它的部分";说清目标/依赖/命令三要素与 Make 判断"要不要重做"的机制;会用变量与 .PHONY 写出可维护、可覆盖(命令行传 CFLAGS)的 Makefile;理解 Make 与 CMake/Ninja 的关系与各自定位;把 Makefile 用作轻量任务脚本(构建/测试/部署)——Make 主线通关。

Make 是"**构建工具的活化石与思想源头**":语法古老(Tab、$@ 让新手皱眉),但"依赖 + 增量 + 规则"三概念五十年来统治着一切构建系统——**学会 Make,你看 Maven 的 lifecycle、Gradle 的 task、CMake 的 target 都会会心一笑:都是它的子孙**。它不适合复杂现代项目(那是 CMake/Ninja 的活),但**读 C 源码、写轻量自动化、理解构建本质,它依然是最短路径**。下一步:C/C++ 现代构建看 [CMake](/learning-paths/languages/cpp),或对照 [Gradle](/learning-paths/build-tools/gradle) 看"规则引擎"在 JVM 世界的进化。
