---
title: "Java语言概述与开发环境"
aliases:
  - "Java 简介"
  - "JDK 安装配置"
tags:
  - "后端"
  - "java"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/基础语法与数据类型]]"
  - "[[后端/JVM/JVM概述与运行时数据区]]"
  - "[[后端/JVM/类加载机制与字节码]]"
  - "[[后端/Java工程化与部署/Maven依赖管理与多模块]]"
  - "[[后端/Java/Java学习笔记总索引]]"
created: 2026-09-06
updated: 2026-09-06
---

# Java 语言概述与开发环境

## 1. Java 是什么

Java 是 1995 年由 Sun Microsystems（2009 年被 Oracle 收购）发布的面向对象编程语言，由 James Gosling 主导设计。核心设计目标是「**一次编写，到处运行**」（Write Once, Run Anywhere），依靠 JVM 屏蔽操作系统差异实现。

**Java 的三大平台：**

| 平台 | 全称 | 用途 | 现状 |
| --- | --- | --- | --- |
| Java SE | Standard Edition | 语言核心 + 基础类库（集合、IO、并发、网络） | 一切的基础，必学 |
| Java EE（Jakarta EE） | Enterprise Edition | 企业级开发规范（Servlet、JSP、EJB、JMS） | 已捐给 Eclipse 基金会，改名 Jakarta EE |
| Java ME | Micro Edition | 嵌入式/移动设备 | 已基本淘汰 |

> 【注意】Java EE 捐给 Eclipse 基金会后，因商标归属 Oracle，所有包名从 `javax.*` 改为 `jakarta.*`。这是 **Spring Boot 3.x 要求 JDK 17 且不再兼容 `javax.servlet`** 的根本原因。老项目升 Spring Boot 3 时，`javax.annotation.Resource` 要改成 `jakarta.annotation.Resource`，`javax.servlet.http.HttpServletRequest` 要改成 `jakarta.servlet.http.HttpServletRequest`。

## 2. Java 语言特性

| 特性 | 说明 | 与 C++ 对比 |
| --- | --- | --- |
| 简单 | 去掉指针、运算符重载、多重继承、显式内存管理 | C++ 有裸指针、`operator+` 重载 |
| 面向对象 | 万物皆对象（基本类型除外），封装/继承/多态 | C++ 支持面向过程混编 |
| 平台无关 | 编译成字节码 `.class`，由 JVM 解释/JIT 执行 | C++ 编译成平台相关机器码 |
| 自动内存管理 | GC 回收不可达对象，无需 `free`/`delete` | C++ 手动管理，易泄漏 |
| 强类型静态语言 | 编译期检查类型，变量必须先声明 | Python 是动态类型 |
| 多线程内置 | `Thread`/`Runnable` 是语言级支持，JUC 包强大 | C++11 才有 `std::thread` |
| 健壮 | 异常机制 + 编译期检查 + 空指针检测 | 运行时崩溃更少 |
| 分布式 | 原生支持 RMI、HTTP 客户端，适合网络编程 | — |
| 安全性 | 字节码校验、沙箱机制、访问修饰符 | — |

**【面试】Java 为什么能跨平台？JVM 为什么不能跨平台？**

- Java 源码经 `javac` 编译为**与平台无关的字节码**（`.class`），字节码是 JVM 的指令集，不针对具体 CPU。
- 不同平台（Windows/Linux/macOS、x86/ARM）需要安装**对应平台的 JVM**，JVM 负责把字节码翻译成本地机器指令。
- 所以：**字节码跨平台，JVM 不跨平台**。「一次编写到处运行」的代价是每台机器要装一个 JVM。

## 3. JDK、JRE、JVM 的关系

这是 Java 入门第一个必须搞清的三层关系：

```
┌─────────────────────────────────────────┐
│  JDK (Java Development Kit) 开发工具包    │  ← 开发者装这个
│  ┌───────────────────────────────────┐  │
│  │ javac 编译器 / jar / javadoc /     │  │
│  │ jdb 调试器 / jps jstat jmap jstack │  │
│  ├───────────────────────────────────┤  │
│  │ JRE (Java Runtime Environment)    │  │  ← 只跑程序装这个
│  │ ┌─────────────────────────────┐   │  │
│  │ │ 核心类库 java.lang/util/io/ │   │  │
│  │ │ net/sql/text/time ...       │   │  │
│  │ ├─────────────────────────────┤   │  │
│  │ │ JVM (Java Virtual Machine)  │   │  │  ← 真正执行字节码
│  │ │ 类加载子系统 + 运行时数据区   │   │  │
│  │ │ + 执行引擎(解释器/JIT/GC)    │   │  │
│  │ └─────────────────────────────┘   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

| 组件 | 全称 | 包含内容 | 谁需要装 |
| --- | --- | --- | --- |
| JVM | Java Virtual Machine | 类加载器 + 运行时数据区 + 执行引擎 + GC | 被 JRE 包含 |
| JRE | Java Runtime Environment | JVM + 核心类库 | 只需运行 Java 程序的用户 |
| JDK | Java Development Kit | JRE + 开发工具（javac、jar、javadoc、诊断工具） | 开发者 |

> 【版本变化】JDK 11 之后 Oracle 的安装包已经**不再单独提供 JRE**（因为可用 `jlink` 定制运行时镜像），但概念上 JRE 依然存在。JDK 9 引入的**模块化系统（JPMS）** 让 `jlink` 能把应用和它用到的模块打成一个精简运行时，替代传统 JRE。

**【面试】JVM 的组成？**

1. **类加载子系统**：负责把 `.class` 加载到内存，经历加载、链接、初始化三阶段（详见 [[后端/JVM/类加载机制与字节码]]）。
2. **运行时数据区**：堆、方法区（元空间）、虚拟机栈、本地方法栈、程序计数器（详见 [[后端/JVM/JVM概述与运行时数据区]]）。
3. **执行引擎**：解释器（逐条翻译字节码）、JIT 编译器（热点代码编译成本地码）、垃圾回收器。

## 4. Java 版本演进与选型

| 版本 | 发布时间 | 类型 | 关键特性 |
| --- | --- | --- | --- |
| JDK 1.0 | 1996 | — | 首发 |
| JDK 1.4 | 2002 | — | NIO、正则、断言 |
| **JDK 5** | 2004 | 里程碑 | **泛型、自动装箱、枚举、注解、可变参数、增强 for、并发包 JUC** |
| JDK 6 | 2006 | — | 脚本引擎、JDBC 4.0 |
| JDK 7 | 2011 | — | `switch` 支持 String、`try-with-resources`、菱形推断 `<>`、NIO.2 |
| **JDK 8** | 2014 | **LTS** | **Lambda、Stream API、`Optional`、新日期时间 API、接口 default 方法、`CompletableFuture`** |
| JDK 9 | 2017 | — | 模块化 JPMS、`jshell`、集合工厂方法 `List.of()` |
| JDK 10 | 2018 | — | 局部变量类型推断 `var` |
| **JDK 11** | 2018 | **LTS** | `var` 用于 Lambda、HTTP Client 正式版、单文件直接运行 |
| JDK 12~13 | 2019 | — | `switch` 表达式（预览）、文本块（预览） |
| JDK 14 | 2020 | — | `record`（预览）、`instanceof` 模式匹配（预览）、更友好的 NPE 提示 |
| **JDK 17** | 2021 | **LTS** | **`record` 正式、`sealed` 密封类、`switch` 模式匹配、文本块正式**；**Spring Boot 3.x 最低要求** |
| JDK 18~20 | 2022~23 | — | 默认 UTF-8、简易 Web 服务器、虚拟线程（预览） |
| **JDK 21** | 2023 | **LTS** | **虚拟线程（Virtual Threads）正式、分代 ZGC、`switch` 模式匹配正式、Record 模式** |
| JDK 22~24 | 2024~25 | — | 未命名变量 `_`、字符串模板演进、结构化并发孵化 |

**选型建议：**

| 场景 | 推荐版本 | 理由 |
| --- | --- | --- |
| 学习入门 | JDK 17 | 长期支持、Spring Boot 3 基线、语法特性完整 |
| 新项目（2024 后） | JDK 21 | 虚拟线程对高并发 IO 密集型应用是革命性提升 |
| 存量企业项目 | JDK 8 | 大量老项目仍在用，Spring Boot 2.x 生态；升级成本高 |
| 面试 | 掌握 8 + 了解 11/17/21 | JDK 8 的 Lambda/Stream 是必考，新特性是加分项 |

> 【现实】国内大量生产项目仍跑在 **JDK 8 + Spring Boot 2.x**，因为 JDK 8 到 11 的升级涉及模块化、`javax` → `jakarta`、GC 默认值变化等一堆坑。本笔记**代码示例以 JDK 8 语法为基线**，JDK 9+ 特性单独标注「JDK 17+」。

**Java 版本的 LTS（长期支持）与非 LTS：** Oracle 从 JDK 9 开始改为每 6 个月发布一个版本，每 3 年（后改为每 2 年）一个 LTS。非 LTS 版本只维护 6 个月，**生产环境必须用 LTS**。

## 5. JDK 的获取渠道

| 发行版 | 提供方 | 授权 | 特点 |
| --- | --- | --- | --- |
| Oracle JDK | Oracle | JDK 17+ 免费（NFTC），JDK 11 商用收费 | 官方版本，商业支持 |
| **OpenJDK** | Oracle 开源 | GPLv2+CE | 源码基准，其他发行版都基于它 |
| **Eclipse Temurin**（原 AdoptOpenJDK） | Eclipse Adoptium | 免费 | **社区最推荐的免费选择** |
| Amazon Corretto | AWS | 免费 | 长期免费支持，AWS 优化 |
| Azul Zulu | Azul | 免费/付费 | 支持平台广 |
| 阿里 Dragonwell | 阿里巴巴 | 免费 | 针对大规模线上场景优化 |
| 腾讯 Kona | 腾讯 | 免费 | 云原生优化 |
| GraalVM | Oracle | 社区版免费 | 支持 AOT 原生编译、多语言 |

**下载地址：**

- Adoptium（推荐）：https://adoptium.net/
- Oracle JDK：https://www.oracle.com/java/technologies/downloads/
- 阿里 Dragonwell：https://dragonwell-jdk.io/
- OpenJDK 官方：https://jdk.java.net/

## 6. 安装与环境变量配置

### 6.1 macOS（推荐用 SDKMAN 或 Homebrew）

```bash
# 方式一：Homebrew 安装 Temurin（推荐）
brew install --cask temurin@17

# 方式二：SDKMAN 管理多版本（强烈推荐，可自由切换）
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk list java                      # 列出所有可装版本
sdk install java 17.0.9-tem        # 安装 Temurin 17
sdk install java 8.0.392-tem       # 再装一个 JDK 8
sdk use java 17.0.9-tem            # 临时切换当前终端
sdk default java 17.0.9-tem        # 设为全局默认

# 方式三：手动查看已安装的所有 JDK
/usr/libexec/java_home -V
# Matching Java Virtual Machines (2):
#     17.0.9 (arm64) "Eclipse Adoptium" - "OpenJDK 17.0.9" /Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
#     1.8.0_392 (arm64) "Eclipse Adoptium" - "OpenJDK 8u392" /Library/Java/JavaVirtualMachines/temurin-8.jdk/Contents/Home
```

在 `~/.zshrc` 或 `~/.bash_profile` 中配置：

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH=$JAVA_HOME/bin:$PATH
```

### 6.2 Linux

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-17-jdk

# CentOS/RHEL
sudo yum install java-17-openjdk-devel

# 手动安装（解压 tar.gz）
tar -zxvf jdk-17_linux-aarch64_bin.tar.gz -C /usr/local/
```

编辑 `/etc/profile`（全局）或 `~/.bashrc`（当前用户）：

```bash
export JAVA_HOME=/usr/local/jdk-17
export PATH=$JAVA_HOME/bin:$PATH
export CLASSPATH=.:$JAVA_HOME/lib    # JDK 8+ 其实不需要配 CLASSPATH
```

```bash
source /etc/profile   # 使配置生效
```

> 【坑】**不要配置 `CLASSPATH`**。JDK 5 之后 `CLASSPATH` 默认包含当前目录 `.`，显式配置反而容易在换机器/换目录时找不到类。现代 Java 项目由 Maven/Gradle 管理 classpath。

### 6.3 Windows

1. 下载 `.msi` 安装包，双击安装（勾选「Set JAVA_HOME variable」「Add to PATH」可自动配置）。
2. 手动配置：
   - 新建系统变量 `JAVA_HOME` = `C:\Program Files\Eclipse Adoptium\jdk-17`
   - 编辑 `Path`，新增 `%JAVA_HOME%\bin`
3. `cmd` 中执行 `java -version` 验证。

> 【坑】Windows 上如果同时装了多个 JDK 且 `C:\Windows\System32\java.exe` 存在（旧版 Oracle JDK 会往这里塞一个转发器），`java -version` 可能显示的不是你配的版本。解决办法：删除 `System32` 下的 `java.exe`，或确保 `%JAVA_HOME%\bin` 在 `Path` 中排在 `System32` 之前。

### 6.4 验证安装

```bash
java -version
# openjdk version "17.0.9" 2023-10-17
# OpenJDK Runtime Environment Temurin-17.0.9+9 (build 17.0.9+9)
# OpenJDK 64-Bit Server VM Temurin-17.0.9+9 (build 17.0.9+9, mixed mode, sharing)

javac -version      # javac 17.0.9
echo $JAVA_HOME     # /Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
where java          # Windows: 查看 java.exe 实际路径
which java          # Linux/macOS
```

## 7. JDK 目录结构

```
jdk-17/
├── bin/              # 可执行工具
│   ├── java          # JVM 启动器，运行字节码
│   ├── javac         # 编译器，源码 → 字节码
│   ├── javadoc       # 文档生成器
│   ├── jar           # 打包工具
│   ├── jshell        # JDK 9+ REPL 交互环境
│   ├── jlink         # JDK 9+ 定制运行时镜像
│   ├── jps           # 列出 Java 进程
│   ├── jstat         # JVM 统计信息
│   ├── jmap          # 内存映像/堆转储
│   ├── jstack        # 线程栈快照
│   ├── jinfo         # 查看/修改 JVM 参数
│   ├── jcmd          # 综合诊断命令（推荐，替代 jmap/jstack 部分功能）
│   └── jconsole/jvisualvm  # 图形化监控
├── conf/             # 配置文件（JDK 9+；JDK 8 是 jre/lib）
│   ├── logging.properties
│   └── security/java.security
├── include/          # JNI 头文件（C/C++ 交互）
├── jmods/            # JDK 9+ 模块文件（jlink 用）
├── legal/            # 法律声明
├── lib/              # 核心库（tools.jar/rt.jar 在 JDK 9+ 已被模块化取代）
└── release           # 版本信息
```

> 【版本差异】JDK 8 及以前有 `rt.jar`（Runtime，含所有核心类库）、`tools.jar`（含 javac），JDK 9 模块化后这两个 jar 被拆分进 `jmods/` 下的各个模块，`lib` 目录不再有 `rt.jar`。这也是为什么老项目 `pom.xml` 里 `<systemPath>${java.home}/../lib/tools.jar</systemPath>` 这种写法在 JDK 9+ 会失败。

## 8. 第一个 Java 程序

### 8.1 手写并运行

```java
// 文件名必须与 public 类名一致：HelloWorld.java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

```bash
javac HelloWorld.java      # 编译，生成 HelloWorld.class（字节码）
java HelloWorld            # 运行（注意：不带 .class 后缀！）
# Hello, World!
```

**JDK 11+ 可以单文件直接运行**（省去编译步骤）：

```bash
java HelloWorld.java       # JDK 11+ 支持，内存中编译并运行
```

### 8.2 逐字拆解这段代码

| 元素 | 含义 | 能不能省 |
| --- | --- | --- |
| `public` | 访问修饰符，公开的，任何类都能访问 | 主类必须 public |
| `class` | 声明一个类，Java 的最小代码组织单位 | 必须有 |
| `HelloWorld` | 类名，**必须与文件名完全一致**（含大小写） | 必须有 |
| `public static` | 公开的静态方法，属于类而非对象，JVM 可直接调用 | main 必须是这个签名 |
| `void` | 无返回值 | main 必须是 void |
| `main` | 方法名，**JVM 约定的程序入口** | 必须叫 main |
| `String[] args` | 字符串数组参数，接收命令行参数 | 必须有（可以不使用） |
| `System.out.println` | 标准输出流打印并换行 | 可换成其他语句 |

### 8.3 main 方法的深层理解

**【面试】为什么 main 方法必须是 `public static void`？**

- `public`：JVM 在类外部调用它，必须公开，否则 JVM 无访问权限。
- `static`：JVM 启动时不会创建任何对象，静态方法属于类，可以直接通过类名调用；如果是实例方法，JVM 得先实例化对象，而「用哪个构造器」无法确定。
- `void`：main 是程序的起点，返回值给谁没有意义（进程退出码由 `System.exit(n)` 控制）。
- `String[] args`：JVM 保留的参数位，用于接收命令行参数。

```bash
java HelloWorld arg1 arg2 arg3
```

```java
public static void main(String[] args) {
    for (int i = 0; i < args.length; i++) {
        System.out.println("args[" + i + "] = " + args[i]);
    }
    // args[0] = arg1
    // args[1] = arg2
    // args[2] = arg3
}
```

**JDK 5+ 可变参数写法也合法：**

```java
public static void main(String... args) { }   // 等价于 String[]，JVM 认这个签名
```

> 【坑】`main` 方法的签名必须精确。以下写法 JVM 都不认（编译能过，但运行时报 `NoSuchMethodError: main`）：
> - `static public void main(...)` —— 修饰符顺序无所谓，这个其实**可以**运行（Java 不强制修饰符顺序）。
> - `public void main(String[] args)` —— 缺 `static`，不行。
> - `public static int main(String[] args)` —— 返回值不是 void，不行。
> - `public static void Main(String[] args)` —— 大小写不对，不行。
>
> JDK 7+ 支持在 main 之前/之后加 `strictfp`、`final`、`synchronized` 修饰符：`public static synchronized final void main(...)` 也是合法的。

### 8.4 注释

```java
// 单行注释

/*
   多行注释，不能嵌套
 */

/**
 * 文档注释（Javadoc），可被 javadoc 工具提取生成 HTML 文档
 * @param name 用户名
 * @param age 年龄
 * @return 拼接后的字符串
 * @throws IllegalArgumentException 参数非法时抛出
 * @author yourname
 * @since 1.0
 * @see java.lang.String#format(String, Object...)
 */
public String build(String name, int age) {
    return name + ":" + age;
}
```

> 【规范】IDEA 中 `/**` + 回车可自动生成文档注释骨架。生产代码的 public 方法**必须写 Javadoc**，这是阿里《Java 开发手册》的强制规约。

## 9. Java 程序的编译与运行全过程

这是理解 Java 的关键链路，也是 [[后端/JVM/类加载机制与字节码]] 的入口：

```
  HelloWorld.java            HelloWorld.class              运行结果
 ┌──────────────┐  javac   ┌──────────────────┐   java   ┌────────────┐
 │ Java 源代码    │ ───────→ │ 字节码（跨平台）    │ ───────→ │ JVM 执行     │
 │ 人可读         │  编译     │ 机器不可读，JVM 读 │  运行     │ 平台相关机器码 │
 └──────────────┘          └──────────────────┘          └────────────┘
```

### 9.1 javac 编译阶段（前端编译）

1. **词法分析**：源码字符流 → Token 流（关键字、标识符、字面量、运算符）。
2. **语法分析**：Token 流 → 抽象语法树 AST。
3. **语义分析**：检查类型是否匹配、方法是否存在、变量是否声明。
4. **字节码生成**：AST → `.class` 文件。此阶段还会做少量优化：
   - 字符串常量池合并（`"a" + "b"` 直接优化为 `"ab"`）
   - 自动装箱/拆箱语法糖展开（`Integer i = 1` → `Integer.valueOf(1)`）
   - 泛型类型擦除（`List<String>` → `List`）
   - `try-with-resources` 展开为 try-finally
   - 增强 for 循环展开为 Iterator
   - `switch` 支持 String 展开为 hashCode + equals

**javac 常用参数：**

```bash
javac -encoding UTF-8 HelloWorld.java       # 指定源码编码（避免中文乱码，Windows 尤其重要）
javac -d out HelloWorld.java                # 指定 class 输出目录（会自动建包目录）
javac -g HelloWorld.java                    # 生成完整调试信息（局部变量表）
javac -source 8 -target 8 App.java          # 指定源码级别和目标字节码版本
javac -cp lib/fastjson.jar:. App.java       # 指定编译期 classpath
javac -Xlint:all App.java                   # 开启所有编译警告（如未检查的类型转换）
javac @sources.txt                          # 从文件读取待编译列表
```

> 【坑】**中文乱码**：Windows 默认编码是 GBK，源码用 UTF-8 保存时，`javac` 不加 `-encoding UTF-8` 会报「编码 GBK 的不可映射字符」。IDEA 里统一把 File Encodings 设为 UTF-8（Project / Default / Properties Files 都设），编译参数加 `-encoding UTF-8`。

### 9.2 java 运行阶段

`java HelloWorld` 命令背后：

1. **JVM 启动**：创建 JVM 进程，初始化运行时数据区（堆、栈、方法区等）。
2. **类加载**：`ClassLoader` 把 `HelloWorld.class` 读入内存 → 二进制流。
   - **加载 Loading**：读取字节码，生成 `Class` 对象。
   - **验证 Verification**：校验字节码格式、语义、操作数栈合法性，防止恶意代码。
   - **准备 Preparation**：为静态变量分配内存并赋**零值**（`static int a = 10` 此阶段 a=0）。
   - **解析 Resolution**：符号引用 → 直接引用（常量池中类名字符串 → 内存地址）。
   - **初始化 Initialization**：执行 `<clinit>()`，给静态变量赋真正的值、执行静态代码块。
3. **执行引擎运行**：
   - **解释器**：逐条把字节码翻译成机器码执行，启动快但运行慢。
   - **JIT（Just-In-Time）编译器**：把「热点代码」（多次执行的方法/循环）整体编译成本地机器码并缓存，运行快。HotSpot 默认开启**混合模式（Mixed Mode）**：先解释执行，热点后 JIT。
   - **分层编译（Tiered Compilation）**：JDK 8+ 默认开启，分 5 层（解释 → C1 简单编译 → C1+profiling → C2 深度优化）。
4. **GC** 在后台并发回收垃圾对象。
5. **JVM 退出**：main 线程结束且无非守护线程时，或调用 `System.exit()`。

**java 命令常用参数：**

```bash
java -version                        # 版本信息（单横线）
java --help                          # 帮助（JDK 9+ 双横线）
java -cp .:lib/a.jar HelloWorld      # 指定 classpath（-classpath 等价）
java -Dname=value HelloWorld         # 设置系统属性，代码中 System.getProperty("name")
java -Xmx512m -Xms256m HelloWorld    # 堆最大/初始内存
java -Xss1m HelloWorld               # 每个线程栈大小
java -XX:+UseG1GC HelloWorld         # 使用 G1 垃圾收集器
java -XX:+PrintGCDetails HelloWorld  # 打印 GC 详情
java -jar app.jar                    # 运行 jar 包（入口由 MANIFEST.MF 的 Main-Class 决定）
java --add-opens java.base/java.lang=ALL-UNNAMED  # JDK 9+ 开放模块（反射私有成员需要）
java -ea HelloWorld                  # 开启断言（assert）
```

**参数前缀规则：**

| 前缀 | 类型 | 稳定性 | 示例 |
| --- | --- | --- | --- |
| `-` | 标准参数 | 所有 JVM 实现都支持，稳定 | `-version` `-cp` `-D` |
| `-X` | 非标准参数 | HotSpot 特有，基本稳定 | `-Xmx` `-Xms` `-Xss` |
| `-XX` | 不稳定参数 | 高级调优，可能随版本变化 | `-XX:+UseG1GC` `-XX:MaxMetaspaceSize` |

## 10. 字节码文件长什么样

用 `javap` 反编译看字节码，这是理解 JVM 和 Spring AOP 的基础：

```bash
javap HelloWorld.class           # 显示 public 成员
javap -p HelloWorld.class        # 显示所有成员（含 private）
javap -c HelloWorld.class        # 显示字节码指令（disassemble）
javap -v HelloWorld.class        # 详细信息（含常量池、访问标志、行号表）
javap -s HelloWorld.class        # 显示内部类型签名
javap -l HelloWorld.class        # 显示行号和局部变量表
```

对上面 HelloWorld 执行 `javap -v` 的关键输出：

```
Classfile /HelloWorld.class
  MD5 checksum ...
public class HelloWorld
  minor version: 0
  major version: 61          // 61 = JDK 17；52 = JDK 8；55 = JDK 11
  flags: (0x0021) ACC_PUBLIC, ACC_SUPER
  this_class: #7             // HelloWorld
  super_class: #2            // java/lang/Object

Constant pool:               // 常量池：字面量 + 符号引用
   #1 = Methodref   #2.#15   // java/lang/Object."<init>":()V
   #2 = Class       #16      // java/lang/Object
   #7 = Class       #21      // HelloWorld
  #18 = String      #23      // Hello, World!
  #20 = Methodref  #24.#25  // java/io/PrintStream.println:(Ljava/lang/String;)V
  ...

public static void main(java.lang.String[]);
  descriptor: ([Ljava/lang/String;)V
  Code:
     0: getstatic     #19    // Field java/lang/System.out:Ljava/io/PrintStream;
     3: ldc           #18    // String Hello, World!
     5: invokevirtual #20    // Method java/io/PrintStream.println:(Ljava/lang/String;)V
     8: return
```

**主版本号对照表（`major version`）：**

| 主版本号 | JDK 版本 | 主版本号 | JDK 版本 |
| --- | --- | --- | --- |
| 45 | 1.1 | 55 | 11 |
| 49 | 5 | 56 | 12 |
| 50 | 6 | 57 | 13 |
| 51 | 7 | 60 | 16 |
| 52 | **8** | 61 | **17** |
| 53 | 9 | 65 | **21** |
| 54 | 10 | 66 | 22 |

> 【坑】**`UnsupportedClassVersionError`**：用高版本 JDK 编译的 class 在低版本 JVM 上运行会报这个错。例如 `class file version 61.0, this version of the Java Runtime only recognizes class file versions up to 52.0`，意思是 class 是 JDK 17 编的，但运行时是 JDK 8。**解决**：要么升级运行时 JDK，要么在 Maven 里用 `<source>8</source><target>8</target>` 或 `maven.compiler.release` 降级编译。

## 11. 包（package）与导入（import）

### 11.1 包的作用

1. **避免类名冲突**：不同包可以有同名类（`com.a.User` 与 `com.b.User`）。
2. **逻辑分组**：按功能组织代码，便于查找维护。
3. **访问控制**：配合 `protected` 和「包级私有」（default）修饰符实现访问隔离。

```java
// 声明包，必须是源文件的第一条非注释语句
package com.example.service.impl;

// 导入类
import java.util.List;              // 导入指定类
import java.util.*;                 // 导入包下所有类（不推荐，易冲突且影响可读性）
import static java.lang.Math.PI;    // JDK 5+ 静态导入，可直接写 PI
import static org.junit.Assert.*;   // 测试代码常用

public class UserServiceImpl { }
```

### 11.2 包命名规范

**【强制】域名倒写 + 项目名 + 模块名 + 功能分层**，全小写，单词间不加下划线：

```
com.company.project.module.layer

com.taobao.order.service.impl
org.apache.commons.lang3
cn.hutool.core.util
```

**典型 Spring Boot 分层结构：**

```
com.example.mall
├── MallApplication.java          # 启动类
├── controller/                   # 控制层，接收请求
├── service/                      # 业务接口
│   └── impl/                     # 业务实现
├── mapper/  (或 dao/)            # 数据访问层
├── entity/  (或 domain/po/)      # 数据库实体
├── dto/                          # 数据传输对象（跨层/跨服务）
├── vo/                           # 视图对象（返回给前端）
├── query/ (或 param/)            # 请求参数对象
├── config/                       # 配置类
├── common/                       # 通用类
│   ├── Result.java               # 统一响应
│   ├── ResultCode.java           # 错误码枚举
│   └── exception/                # 自定义异常
├── utils/                        # 工具类
├── aspect/                       # AOP 切面
├── interceptor/                  # 拦截器
├── enums/                        # 枚举
└── resources/
    ├── application.yml
    └── mapper/*.xml
```

> 【面试】**PO/DTO/VO/BO/DO 的区别？**
>
> | 简称 | 全称 | 用途 | 所在层 |
> | --- | --- | --- | --- |
> | PO / DO | Persistent Object / Data Object | 与数据库表一一对应 | DAO 层 |
> | DTO | Data Transfer Object | 跨进程/跨层传输，按需裁剪字段（不暴露敏感字段如密码） | Service ↔ Controller，RPC |
> | VO | View Object | 返回给前端展示，可能聚合多个 PO 的字段 | Controller → 前端 |
> | BO | Business Object | 业务逻辑对象，封装业务规则 | Service 层 |
> | Query | 查询对象 | 封装查询条件（分页参数等） | Controller ← 前端 |
>
> 小项目可以只用 PO + VO；中大型项目严格分层，避免把数据库实体直接返回给前端（会泄漏表结构、密码哈希等）。

### 11.3 包的访问权限

| 修饰符 | 本类 | 同包 | 子类（跨包） | 其他包 |
| --- | --- | --- | --- | --- |
| `private` | ✅ | ❌ | ❌ | ❌ |
| default（不写） | ✅ | ✅ | ❌ | ❌ |
| `protected` | ✅ | ✅ | ✅ | ❌ |
| `public` | ✅ | ✅ | ✅ | ✅ |

> 【坑】一个 `.java` 文件中**最多只能有一个 public 类**，且文件名必须与之一致；其他类只能是 default 级别（不写 public）。

### 11.4 常用包速查

| 包 | 内容 |
| --- | --- |
| `java.lang` | 核心类：`String`、`Object`、`System`、`Math`、`Thread`、包装类、异常类（**默认导入，无需 import**） |
| `java.util` | 集合框架、`Date`、`Random`、`Scanner`、`Objects`、`Arrays` |
| `java.util.concurrent` | JUC 并发包：线程池、锁、原子类、并发容器 |
| `java.util.stream` | JDK 8 Stream API |
| `java.util.function` | JDK 8 函数式接口 |
| `java.time` | JDK 8 新日期时间 API |
| `java.io` | 传统 IO 流 |
| `java.nio` | 新 IO（Buffer、Channel、Selector），零拷贝 |
| `java.net` | 网络编程：Socket、URL、HttpClient |
| `java.sql` | JDBC：`Connection`、`Statement`、`ResultSet` |
| `java.text` | 格式化：`SimpleDateFormat`、`NumberFormat` |
| `javax.*` / `jakarta.*` | 扩展包：Servlet、Validation、Annotation |

## 12. IDE 选择与 IDEA 高效使用

### 12.1 主流 IDE 对比

| IDE | 厂商 | 授权 | 特点 |
| --- | --- | --- | --- |
| **IntelliJ IDEA** | JetBrains | Ultimate 付费 / Community 免费 | **事实标准**，重构能力最强，Spring 支持最好（需 Ultimate） |
| Eclipse | Eclipse 基金会 | 免费开源 | 老牌，插件生态丰富，插件冲突问题多，企业存量项目在用 |
| VS Code + Extension Pack for Java | Microsoft | 免费 | 轻量，适合小项目和多语言开发者，大项目索引慢 |
| NetBeans | Apache | 免费 | 官方出品，用户量少 |
| MyEclipse | MyEclipse | 付费 | 基于 Eclipse 的商业增强版，国内老项目常见 |

**Community 版 vs Ultimate 版：**

| 能力 | Community | Ultimate |
| --- | --- | --- |
| Java SE、Maven、Gradle、Git | ✅ | ✅ |
| Spring / Spring Boot 支持 | ❌（只能当普通 Java 项目） | ✅ |
| 数据库工具 | ❌ | ✅ |
| JavaScript/前端框架 | 基础 | ✅ |
| HTTP Client、Profiler | ❌ | ✅ |

> 学 Spring 全家桶**必须用 Ultimate**（学生可申请免费教育许可，开源项目作者也可申请）。

### 12.2 IDEA 必背快捷键（macOS / Windows）

| 功能 | macOS | Windows |
| --- | --- | --- |
| 全局搜索文件 | `Cmd + Shift + O` | `Ctrl + Shift + N` |
| 全局搜索类 | `Cmd + O` | `Ctrl + N` |
| **双击 Shift**（Search Everywhere） | `Shift Shift` | `Shift Shift` |
| 全局文本搜索 | `Cmd + Shift + F` | `Ctrl + Shift + F` |
| 跳转到定义 | `Cmd + B` / `Cmd + 点击` | `Ctrl + B` / `Ctrl + 点击` |
| 查找用法（谁调用了它） | `Option + F7` | `Alt + F7` |
| 跳转到实现类 | `Cmd + Option + B` | `Ctrl + Alt + B` |
| 查看类继承层次 | `Ctrl + H` | `Ctrl + H` |
| 返回上一个位置 | `Cmd + Option + ←` | `Ctrl + Alt + ←` |
| 重命名（重构） | `Shift + F6` | `Shift + F6` |
| 格式化代码 | `Cmd + Option + L` | `Ctrl + Alt + L` |
| 优化 import | `Ctrl + Option + O` | `Ctrl + Alt + O` |
| 生成代码（构造器/getter/setter） | `Cmd + N` | `Alt + Insert` |
| 快速修复/意图操作 | `Option + Enter` | `Alt + Enter` |
| 复制当前行 | `Cmd + D` | `Ctrl + D` |
| 删除当前行 | `Cmd + Backspace` | `Ctrl + Y` |
| 上下移动行 | `Option + Shift + ↑/↓` | `Alt + Shift + ↑/↓` |
| 注释/取消注释 | `Cmd + /` | `Ctrl + /` |
| 块注释 | `Cmd + Option + /` | `Ctrl + Shift + /` |
| 环绕代码（try/if/for） | `Cmd + Option + T` | `Ctrl + Alt + T` |
| 运行 | `Ctrl + R` | `Shift + F10` |
| 调试 | `Ctrl + D` | `Shift + F9` |
| 打开终端 | `Option + F12` | `Alt + F12` |
| 展开/折叠代码块 | `Cmd + +/-` | `Ctrl + +/-` |
| 查看方法调用链 | `Ctrl + Option + H` | `Ctrl + Alt + H` |
| 结构视图（当前类成员） | `Cmd + F12` | `Ctrl + F12` |
| 最近文件 | `Cmd + E` | `Ctrl + E` |
| 参数信息 | `Cmd + P` | `Ctrl + P` |
| 快速文档 | `F1` / `Ctrl + Q` | `Ctrl + Q` |

### 12.3 IDEA 必装插件

| 插件 | 用途 |
| --- | --- |
| **Lombok** | 支持 `@Data` 等注解（新版 IDEA 已内置） |
| **MyBatisX** | Mapper 接口与 XML 互相跳转、SQL 提示、代码生成 |
| **Alibaba Java Coding Guidelines** | 阿里规约实时检查（P3C） |
| **Rainbow Brackets** | 彩虹括号，嵌套层级一目了然 |
| **Translation** | 划词翻译，看英文文档利器 |
| **GenerateAllSetter** | 一键生成对象所有 setter 调用 |
| **Maven Helper** | 分析依赖冲突（Dependency Analyzer） |
| **JRebel / HotSwapAgent** | 热部署，改代码不重启 |
| **RestfulTool / RestfulToolkit** | 根据 URL 快速定位 Controller 方法 |
| **CamelCase** | 变量名风格快速切换（camelCase / SNAKE_CASE / kebab-case） |
| **SequenceDiagram** | 从代码生成时序图，看 Spring 源码神器 |
| **GsonFormatPlus** | JSON 字符串一键生成实体类 |
| **Key Promoter X** | 用鼠标操作时提示对应快捷键，帮你养习惯 |

### 12.4 IDEA 关键设置

```
Settings/Preferences →
├── Editor → File Encodings      # 全部设为 UTF-8，勾选 Transparent native-to-ascii conversion
├── Editor → Code Style → Java   # 导入阿里巴巴代码风格模板
├── Editor → General → Auto Import  # 勾选 Add unambiguous imports on the fly
├── Build → Compiler → Java Compiler  # Target bytecode version 设为 17
├── Build → Build Tools → Maven  # 配置 settings.xml、本地仓库路径、阿里云镜像
├── Build → Build Tools → Gradle # 选择 JDK 版本
├── Tools → Terminal             # Shell path 设为 /bin/zsh 或 /bin/bash
└── Plugins                      # 装上述插件
```

**设置项目 JDK：** `File → Project Structure (Cmd+;)` → Project SDK / Language Level / Modules。

> 【坑】IDEA 里 Language Level 与 Maven 的 `<maven.compiler.source>` 不一致时，会出现「IDEA 里能编译，mvn 打包失败」或反之。**以 Maven/Gradle 配置为准**，每次改完 pom 记得 Reload Project。

## 13. jar、war、ear 与打包

### 13.1 三种归档格式

| 格式 | 全称 | 内容 | 用途 |
| --- | --- | --- | --- |
| `.jar` | Java ARchive | class + 资源文件 + `META-INF/MANIFEST.MF` | 普通 Java 程序、库、**Spring Boot 内嵌容器应用** |
| `.war` | Web Application ARchive | jar 内容 + `WEB-INF/`（web.xml、lib）+ `META-INF/` | 部署到外部 Tomcat/Jetty 的 Web 应用 |
| `.ear` | Enterprise ARchive | 多个 jar/war + 部署描述符 | 传统 Java EE 企业应用（已基本淘汰） |

### 13.2 MANIFEST.MF 清单文件

每个 jar 包都有 `META-INF/MANIFEST.MF`，描述包的元信息：

```
Manifest-Version: 1.0
Created-By: Apache Maven
Main-Class: com.example.Application        # java -jar 的入口类
Class-Path: lib/fastjson.jar lib/guava.jar # 依赖 jar 的相对路径
Implementation-Title: my-app
Implementation-Version: 1.0.0
Build-Jdk-Spec: 17
Start-Class: com.example.Application        # Spring Boot 特有：真正的主类
Spring-Boot-Version: 3.2.0
```

> 【坑】`Main-Class` 与 `Start-Class` 的区别：Spring Boot 打的可执行 jar，`Main-Class` 是 `org.springframework.boot.loader.JarLauncher`（引导加载器），它负责把 `BOOT-INF/lib/` 下的依赖 jar 加载进来，然后反射调用 `Start-Class` 指定的真正主类。这就是 Spring Boot jar 能「双击运行」且包含所有依赖的原因。

### 13.3 jar 命令

```bash
jar -cf app.jar *.class                  # 创建 jar（c=create, f=file）
jar -cvf app.jar .                       # 创建并显示过程（v=verbose）
jar -tf app.jar                          # 列出内容（t=table）
jar -xf app.jar                          # 解压（x=extract）
jar -uf app.jar NewClass.class           # 追加文件（u=update）
jar -cvfe app.jar com.example.Main .     # 创建并指定入口类（e=entrypoint）

# Spring Boot 项目直接
mvn clean package                        # 生成 target/xxx.jar
java -jar target/xxx.jar
```

## 14. Java 开发工具链全景

| 类别 | 工具 | 说明 |
| --- | --- | --- |
| 构建工具 | **Maven** / Gradle / Ant | 依赖管理 + 编译打包，详见 [[后端/Java工程化与部署/Maven依赖管理与多模块]] |
| 版本控制 | **Git** | 详见 [[开发工具/Git/git]] |
| 数据库工具 | DataGrip / Navicat / DBeaver / IDEA 内置 | 见 [[后端/数据库/MySQL/DataGraip连接远程数据库]] |
| 接口测试 | **Postman** / Apifox / IDEA HTTP Client / curl | 后端必备 |
| JSON 工具 | JSON.cn / IDEA 插件 / jq | 格式化、校验 |
| 反编译 | **JD-GUI** / CFR / Procyon / IDEA 内置 Fernflower | 看没有源码的 jar |
| JVM 诊断 | **Arthas** / JConsole / VisualVM / JProfiler / async-profiler | 详见 [[后端/JVM/JVM调优与线上问题排查]] |
| 容器 | **Docker** / Kubernetes | 见 [[运维与部署/Docker]] |
| 代码质量 | SonarQube / Checkstyle / SpotBugs / PMD | CI 集成 |
| API 文档 | Swagger / **Knife4j** / SpringDoc | 自动生成接口文档 |
| 抓包 | Charles / Fiddler / Wireshark | 排查网络问题 |

## 15. 编码规范入门（阿里 Java 开发手册）

阿里巴巴《Java 开发手册》是国内事实标准，IDEA 装 **Alibaba Java Coding Guidelines** 插件可实时检查。核心规约摘选：

### 15.1 命名规约

| 类型 | 规则 | 正例 | 反例 |
| --- | --- | --- | --- |
| 类名 | UpperCamelCase（大驼峰） | `UserService` | `userService` |
| 方法名/变量 | lowerCamelCase（小驼峰） | `getUserById` | `GetUserById` |
| 常量 | 全大写 + 下划线 | `MAX_RETRY_COUNT` | `maxRetryCount` |
| 包名 | 全小写，单数形式 | `com.alibaba.trade.util` | `com.alibaba.trade.Utils` |
| 抽象类 | `Abstract`/`Base` 开头 | `AbstractHandler` | — |
| 异常类 | `Exception` 结尾 | `BizException` | — |
| 测试类 | 被测类名 + `Test` | `UserServiceTest` | — |
| 接口实现类 | `Impl` 结尾 | `UserServiceImpl` | — |
| 布尔变量 | **不加 `is` 前缀**（POJO 中） | `Boolean deleted` | `Boolean isDeleted` |
| 枚举类 | `Enum` 结尾（可选），成员全大写 | `OrderStatusEnum.PAID` | — |
| 设计模式体现 | 类名包含模式名 | `OrderFactory`、`LoginProxy` | — |

> 【坑】**POJO 中布尔字段不要加 `is` 前缀**：`isDeleted` 会被部分序列化框架解析成属性名 `deleted`，导致前端拿不到值或 RPC 反序列化失败。数据库字段可用 `is_deleted`，但 Java 属性写 `deleted`。

### 15.2 其他强制规约

- **不允许任何魔法值（未定义的常量）直接出现在代码中**：`if (status == 3)` → 应定义 `ORDER_STATUS_PAID = 3`。
- **long 赋值用大写 `L`**：`long a = 2L;`（小写 `l` 易与数字 1 混淆）。
- **不要在 foreach 循环里进行元素 remove/add**，用 `Iterator` 或 JDK 8 `removeIf`。
- **`equals` 由常量或确定值调用**：`"active".equals(status)` 而非 `status.equals("active")`（防 NPE）。
- **包装类对象值比较用 `equals`**，不能用 `==`。
- **所有的相同类型的包装类对象之间值的比较，全部使用 `equals`**。
- **构造方法里禁止加入任何业务逻辑**，复杂初始化放到 `init()` 方法。
- **禁止使用 `Executors` 创建线程池**，必须用 `ThreadPoolExecutor` 显式指定参数（防止 OOM）。
- **异常不要用来做流程控制**，不要捕获后什么都不做（`catch` 块为空）。
- **`finally` 中必须对资源进行关闭**，或用 `try-with-resources`。
- **不要在 `finally` 块中使用 `return`**（会覆盖 try 中的返回值）。

## 16. 学习资源

**官方：**
- Oracle Java 官网：https://www.oracle.com/java/
- Java SE 17 API 文档：https://docs.oracle.com/en/java/javase/17/docs/api/
- OpenJDK：https://openjdk.org/
- Java Language Specification：https://docs.oracle.com/javase/specs/

**规范与书籍：**
- 《阿里巴巴 Java 开发手册》：https://github.com/alibaba/p3c
- 《Java 核心技术 卷 I / II》（Core Java）—— 入门到进阶首选
- 《Effective Java》（第 3 版，Joshua Bloch）—— 90 条最佳实践，进阶必读
- 《深入理解 Java 虚拟机》（周志明，第 3 版）—— JVM 圣经
- 《Java 并发编程的艺术》/《Java 并发编程实战》—— JUC 深入
- 《Java 编程思想》（Thinking in Java）—— 经典但偏老

**在线练习：**
- LeetCode（算法）：https://leetcode.cn/
- 牛客网（Java 专项 + 面经）：https://www.nowcoder.com/
- Codewars、HackerRank

## 17. 常见坑汇总

| 坑 | 现象 | 解决 |
| --- | --- | --- |
| 文件名与类名不一致 | `error: class HelloWorld is public, should be declared in a file named HelloWorld.java` | 改文件名或去掉 public |
| 中文乱码 | `错误: 编码GBK的不可映射字符` | `javac -encoding UTF-8`，IDEA 全设 UTF-8 |
| 版本不匹配 | `UnsupportedClassVersionError` | 统一编译与运行的 JDK 版本 |
| `java` 命令带后缀 | `错误: 找不到或无法加载主类 HelloWorld.class` | 去掉 `.class` |
| 主类找不到 | `Error: Could not find or load main class` | 检查包声明与目录结构是否一致、classpath 是否正确 |
| `JAVA_HOME` 未配 | Maven/Gradle 报错找不到 JDK | 配置环境变量并重启终端 |
| 多 JDK 版本混乱 | `java -version` 显示非预期版本 | 用 SDKMAN 或 `/usr/libexec/java_home` 明确指定 |
| Windows 中文路径 | 部分工具链在含中文/空格路径下异常 | JDK、项目路径全用英文无空格 |
| `javax` vs `jakarta` | Spring Boot 3 下 `javax.servlet` 找不到 | 全部替换为 `jakarta.servlet` |
| IDEA Language Level 不对 | 新语法报红但 Maven 能编译 | Project Structure 中改 Language Level |

---

## 关联笔记

- 下一步：[[后端/Java基础/基础语法与数据类型]]
- 底层原理：[[后端/JVM/JVM概述与运行时数据区]]、[[后端/JVM/类加载机制与字节码]]
- 工程化：[[后端/Java工程化与部署/Maven依赖管理与多模块]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
