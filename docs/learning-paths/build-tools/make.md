# Make 学习路线

Make 是 Unix/Linux 世界最经典的构建自动化工具，诞生于 1976 年至今依然活跃。通过 Makefile 描述文件依赖关系和构建规则，Make 能智能地只重新构建变化的部分。虽然主要用于 C/C++ 项目，但其思想影响了所有现代构建工具。学习 Make，不仅是学习工具，更是学习自动化思维。

## 基础篇：入门与概念

### Make 核心思想
- 依赖关系：目标依赖哪些文件
- 增量构建：只重新构建变化的部分
- 时间戳比较：目标比依赖旧则重新构建
- 规则描述：如何从依赖生成目标
- 自动化：一条命令完成复杂构建

### 安装与版本
- GNU Make：最流行的实现
- 其他实现：BSD Make、Microsoft nmake
- 安装：Linux/Mac 自带，Windows 需安装（MinGW、Cygwin）
- 验证：make --version
- 命令：make、gmake

### 第一个 Makefile
- 文件名：Makefile 或 makefile
- 基本结构：target: dependencies
- 命令行：必须 Tab 缩进（不是空格）
- 运行：make
- 默认目标：第一个目标

### 基本语法
- 目标：target（文件名或伪目标）
- 依赖：prerequisites（目标依赖的文件）
- 命令：recipe（如何构建目标）
- 注释：# 开头
- 续行：\ 反斜杠

## 基础篇：规则与目标

### 规则结构
- target: dependencies
- [tab] command
- 多个依赖：空格分隔
- 多条命令：每行一条
- 命令前缀：@、-、+

### 伪目标
- .PHONY：声明伪目标
- 不对应文件：clean、all、install
- 总是执行：不检查时间戳
- 常用伪目标：all、clean、install、test、help

### 多目标
- 一条规则多个目标：target1 target2: dependencies
- 模式匹配：%.o: %.c
- 静态模式：objects: %.o: %.c

### 依赖关系
- 显式依赖：手动列出
- 隐式依赖：自动推导（内置规则）
- 顺序依赖：order-only prerequisites（|）
- 递归依赖：目标依赖其他目标

### 命令执行
- 每行独立 shell：cd 不影响后续命令
- 连续执行：用 && 或 ; 连接
- 忽略错误：- 前缀（如 -rm）
- 静默执行：@ 前缀（不显示命令）
- 强制执行：+ 前缀（即使 -n）

## 基础篇：变量与函数

### 变量定义
- 递归展开：= （引用时展开）
- 简单展开：:= （定义时展开）
- 条件赋值：?= （未定义才赋值）
- 追加：+= （追加值）
- 引用：$(VAR) 或 ${VAR}

### 自动变量
- $@：目标名称
- $<：第一个依赖
- $^：所有依赖（去重）
- $+：所有依赖（保留重复）
- $?：比目标新的依赖
- $*：模式匹配的茎（stem）
- $(@D)、$(@F)：目录、文件名

### 预定义变量
- CC：C 编译器（默认 cc）
- CXX：C++ 编译器（默认 g++）
- CFLAGS：C 编译选项
- CXXFLAGS：C++ 编译选项
- LDFLAGS：链接选项
- AR：归档工具（默认 ar）
- RM：删除命令（默认 rm -f）

### 函数调用
- $(function arguments)
- $(subst from,to,text)：替换
- $(patsubst pattern,replacement,text)：模式替换
- $(strip string)：去除空白
- $(findstring find,text)：查找字符串
- $(filter pattern,text)：过滤匹配
- $(filter-out pattern,text)：过滤不匹配
- $(sort list)：排序
- $(word n,text)：取第 n 个单词
- $(wordlist s,e,text)：取单词列表
- $(words text)：单词数量
- $(firstword text)：第一个单词
- $(lastword text)：最后一个单词

### 文件名函数
- $(wildcard pattern)：匹配文件
- $(dir names)：目录部分
- $(notdir names)：文件名部分
- $(suffix names)：后缀
- $(basename names)：去除后缀
- $(addsuffix suffix,names)：添加后缀
- $(addprefix prefix,names)：添加前缀
- $(join list1,list2)：连接列表
- $(realpath names)：绝对路径
- $(abspath names)：规范化路径

## 进阶篇：模式规则

### 模式匹配
- %：通配符（如 %.o: %.c）
- 茎（stem）：% 匹配的部分
- $*：访问茎
- 自动依赖：%.o: %.c 自动匹配所有 .c

### 隐含规则
- 内置规则：Make 内置的模式规则
- .c → .o：$(CC) $(CPPFLAGS) $(CFLAGS) -c
- .cc → .o：$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c
- .o → 可执行文件：$(CC) $(LDFLAGS) $^ $(LDLIBS) -o $@
- 查看规则：make -p

### 静态模式
- targets: target-pattern: prereq-patterns
- 限定范围：只对指定目标生效
- 更明确：比通用模式规则清晰
- 示例：$(OBJS): %.o: %.c

### 双冒号规则
- target:: dependencies
- 多条规则：同一目标可有多条规则
- 独立执行：每条规则独立判断
- 适用场景：复杂构建

## 进阶篇：条件与控制

### 条件语句
- ifeq (arg1,arg2)：相等判断
- ifneq (arg1,arg2)：不等判断
- ifdef variable：变量已定义
- ifndef variable：变量未定义
- else：否则分支
- endif：结束

### 条件赋值
- ?= ：变量未定义才赋值
- 组合使用：ifdef + =
- 环境变量：覆盖或保留

### include 指令
- include filename：包含其他 Makefile
- -include filename：忽略不存在的文件
- sinclude filename：-include 的别名
- 用途：分离配置、共享规则

### 导出变量
- export VAR：导出到子 Make
- unexport VAR：取消导出
- export：导出所有变量
- 递归 Make：子目录构建

## 进阶篇：高级特性

### 递归 Make
- $(MAKE)：递归调用 Make
- -C dir：切换目录
- 并行安全：父子 Make 协调
- 缺点：依赖关系不完整

### 并行构建
- -j N：N 个任务并行
- -j：无限并行（谨慎使用）
- .NOTPARALLEL：禁止并行
- 依赖正确性：避免竞态

### 自动依赖生成
- gcc -MM：生成依赖文件
- -MMD：编译时生成 .d 文件
- include *.d：包含依赖
- 自动更新：头文件变化自动重新编译

### 特殊目标
- .PHONY：伪目标
- .SUFFIXES：后缀列表
- .PRECIOUS：保留中间文件
- .INTERMEDIATE：中间文件
- .SECONDARY：次要目标
- .DELETE_ON_ERROR：错误时删除目标
- .IGNORE：忽略错误
- .SILENT：静默执行
- .NOTPARALLEL：禁止并行

### 目标特定变量
- target: VAR = value
- 作用域：仅对该目标生效
- 覆盖全局变量
- 模式特定变量：%.o: VAR = value

## 实战篇：C/C++ 项目

### 基本编译
- 源文件：.c、.cpp
- 目标文件：.o
- 可执行文件：无后缀或 .exe
- 头文件：.h、.hpp
- 库文件：.a（静态）、.so（动态）

### 典型 Makefile
- SRCS：源文件列表
- OBJS：目标文件列表（$(SRCS:.c=.o)）
- TARGET：可执行文件名
- all：默认目标
- clean：清理

### 编译选项
- -Wall：所有警告
- -Wextra：额外警告
- -g：调试信息
- -O2：优化级别
- -I：头文件目录
- -L：库文件目录
- -l：链接库

### 目录结构
- src/：源文件
- include/：头文件
- build/：中间文件
- bin/：可执行文件
- lib/：库文件

### 依赖管理
- 自动依赖：gcc -MMD -MP
- .d 文件：依赖关系
- include $(DEPS)：包含依赖
- 头文件变化：自动重新编译

## 实战篇：常用模式

### 清理目标
- clean：删除中间文件
- distclean：删除所有生成文件
- -rm -f：忽略错误
- $(RM)：使用预定义变量

### 安装目标
- install：安装到系统
- PREFIX：安装前缀（/usr/local）
- DESTDIR：临时根目录
- 复制文件：cp、install
- 权限设置：chmod

### 测试目标
- test：运行测试
- check：别名
- 依赖测试程序：构建 + 运行
- 输出结果：成功/失败

### 帮助信息
- help：显示帮助
- 列出目标：all、clean、install
- 说明：每个目标的作用
- @echo：静默输出

### 调试模式
- debug：调试版本
- release：发布版本
- 不同编译选项：-g vs -O2
- 条件编译：ifdef DEBUG

## 实战篇：跨平台构建

### 平台检测
- uname：检测操作系统
- UNAME_S := $(shell uname -s)
- Linux、Darwin（Mac）、Windows
- 条件编译：ifeq ($(UNAME_S),Linux)

### 编译器差异
- GCC：Linux、Mac
- Clang：Mac 默认
- MSVC：Windows
- 交叉编译：指定编译器

### 路径分隔符
- Linux/Mac：/
- Windows：\
- 统一处理：用 /（Windows 兼容）

### 库后缀
- Linux：.so
- Mac：.dylib
- Windows：.dll
- 静态库：.a（Unix）、.lib（Windows）

## 实战篇：调试与优化

### 调试技巧
- make -n：只打印命令不执行（dry run）
- make -p：打印所有规则和变量
- $(warning text)：打印警告
- $(error text)：打印错误并停止
- $(info text)：打印信息

### 性能优化
- 并行构建：-j
- 减少规则：合并相似规则
- 避免递归 Make：单层 Makefile
- 增量构建：正确的依赖关系

### 常见错误
- Tab vs 空格：命令必须 Tab 缩进
- 循环依赖：A 依赖 B，B 依赖 A
- 路径问题：相对路径 vs 绝对路径
- 变量展开：= vs :=

### 最佳实践
- .PHONY：声明伪目标
- 自动变量：$@、$<、$^
- 模式规则：减少重复
- 注释：解释复杂逻辑
- 版本控制：提交 Makefile

## 实战篇：与其他工具集成

### Autotools
- configure：生成 Makefile
- Makefile.in：模板
- 检测系统：自动配置
- 标准目标：all、install、clean

### CMake
- CMakeLists.txt：配置文件
- 生成 Makefile：cmake .
- 跨平台：生成不同构建文件
- 现代替代：更强大

### Ninja
- build.ninja：构建文件
- 更快：比 Make 快
- 生成器：CMake 可生成
- 适合大项目

### IDE 集成
- Makefile 项目：直接支持
- 编译：调用 make
- 清理：调用 make clean
- 调试：生成符号信息

## 下一步学习

掌握 Make 后，可以探索更多构建工具：

- **CMake** - 跨平台构建系统生成器
- **Ninja** - 更快的构建工具
- **Autotools** - 自动配置工具（Autoconf、Automake）
- **Meson** - 现代构建系统
- **Bazel** - Google 的大规模构建工具
- **SCons** - Python 编写的构建工具

Make 是构建工具的鼻祖，虽然语法古老、限制颇多，但其思想影响深远。依赖关系、增量构建、规则描述，这些概念在所有现代构建工具中都能看到 Make 的影子。学习 Make 不仅是为了构建 C/C++ 项目，更是为了理解自动化构建的本质。记住，Make 的强大不在于功能，而在于简单和通用。一个好的 Makefile 应该清晰、可维护、易扩展。有了 Make，你会发现构建不再神秘。
