---
title: "JVM概述与运行时数据区"
aliases:
  - "JVM 内存结构"
  - "JMM 内存模型"
tags:
  - "后端"
  - "java"
  - "jvm"
  - "面试"
category: "后端"
folder: "JVM"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/JVM/垃圾回收机制与收集器]]"
  - "[[后端/JVM/类加载机制与字节码]]"
  - "[[后端/JVM/JVM调优与线上问题排查]]"
  - "[[后端/Java基础/并发编程/线程安全与synchronized]]"
created: 2026-09-07
updated: 2026-09-07
---

# JVM 概述与运行时数据区

## 1. JVM 总体架构

```
                        .java 源文件
                             │ javac（前端编译）
                             ▼
                        .class 字节码
                             │
        ┌────────────────────▼─────────────────────────────┐
        │                   JVM 运行时                       │
        │                                                    │
        │  ┌──────────────┐                                  │
        │  │ 类加载子系统    │  Loading → Linking → Initializing │
        │  │ ClassLoader   │  （详见 类加载机制与字节码）         │
        │  └──────┬───────┘                                  │
        │         ▼                                          │
        │  ┌──────────────────────────────────────────────┐  │
        │  │        运行时数据区（Runtime Data Areas）        │  │
        │  │  ┌────────────┐  ┌──────────┐  ┌───────────┐ │  │
        │  │  │ 方法区/元空间│  │    堆     │  │ 直接内存    │ │  │  ← 线程共享
        │  │  └────────────┘  └──────────┘  └───────────┘ │  │
        │  │  ┌────────┐ ┌──────────┐ ┌────────────────┐  │  │
        │  │  │虚拟机栈  │ │本地方法栈  │ │  程序计数器      │  │  │  ← 线程私有
        │  │  └────────┘ └──────────┘ └────────────────┘  │  │
        │  └──────────────────────────────────────────────┘  │
        │         ▼                                          │
        │  ┌──────────────────────────────────────────────┐  │
        │  │              执行引擎                          │  │
        │  │  解释器 │ JIT 编译器(C1/C2/Graal) │ 垃圾回收器    │  │
        │  └──────────────────────────────────────────────┘  │
        │         ▼                                          │
        │  ┌──────────────────────────────────────────────┐  │
        │  │      本地方法接口 JNI + 本地库（C/C++）          │  │
        │  └──────────────────────────────────────────────┘  │
        └────────────────────────────────────────────────────┘
```

**主流 JVM 实现：**

| JVM | 说明 | 现状 |
| --- | --- | --- |
| **HotSpot** | Oracle/OpenJDK 默认，Sun 收购 Animorphic 后的产物 | **事实标准，占 99%** |
| OpenJ9（原 IBM J9） | IBM 贡献给 Eclipse，内存占用小、启动快 | 云原生场景有优势 |
| GraalVM | Oracle 出品，支持 AOT 原生编译（native-image）、多语言 | 云原生/Serverless 热门 |
| Azul Zing / Zulu | 商业 JVM，C4 无停顿 GC | 金融低延迟场景 |
| Dalvik / ART | Android 的虚拟机（不是标准 JVM，执行 dex 而非 class） | 移动端 |
| JRockit | BEA 出品，曾被 Oracle 收购并合并进 HotSpot | 已停止独立发展 |

> 【AOT vs JIT】**GraalVM Native Image（AOT）** 在构建时就把代码编译成机器码，启动毫秒级、内存占用小，但**没有运行时的 profile-guided 优化（峰值性能略低）、反射需配置、不支持动态类加载**。适合 Serverless、CLI 工具；Spring Boot 3 已原生支持。**HotSpot 的 JIT** 启动慢但峰值性能更高，适合长期运行的服务。

## 2. 运行时数据区 ★★★★★

### 2.1 五大区域总览

| 区域 | 线程共享性 | 存储内容 | 异常 | JDK 8 位置变化 |
| --- | --- | --- | --- | --- |
| **程序计数器**（PC Register） | **私有** | 当前执行的字节码指令地址（native 方法时为 undefined） | **唯一不会 OOM 的区域** | 无变化 |
| **虚拟机栈**（JVM Stack） | **私有** | 栈帧（局部变量表、操作数栈、动态链接、返回地址） | `StackOverflowError`、`OutOfMemoryError` | 无变化 |
| **本地方法栈**（Native Method Stack） | **私有** | native 方法调用的信息 | 同上 | 无变化（HotSpot 与虚拟机栈合一） |
| **堆**（Heap） | **共享** | **所有对象实例和数组** | `OutOfMemoryError: Java heap space` | **字符串常量池、静态变量从永久代移到堆**（JDK 7 起） |
| **方法区**（Method Area） | **共享** | 类元数据、运行时常量池、静态变量（JDK 7 前）、JIT 代码缓存 | `OutOfMemoryError` | **永久代 → 元空间（本地内存）**（JDK 8 起） |

```
线程私有（生命周期 = 线程）              线程共享（生命周期 = JVM）
┌──────────────────────┐          ┌────────────────────────────────┐
│ 程序计数器（PC）        │          │            堆 Heap              │
│ 虚拟机栈               │          │  ┌──────────┬───────────────┐  │
│ 本地方法栈             │          │  │ 新生代    │    老年代       │  │
└──────────────────────┘          │  │ Eden+S0+S1│               │  │
                                  │  └──────────┴───────────────┘  │
                                  │  + 字符串常量池（JDK 7+）        │
                                  │  + 静态变量（JDK 7+）           │
                                  ├────────────────────────────────┤
                                  │  方法区（JDK 8+ = 元空间，本地内存）│
                                  │  类元数据 + 运行时常量池          │
                                  ├────────────────────────────────┤
                                  │  直接内存（NIO DirectByteBuffer） │
                                  └────────────────────────────────┘
```

### 2.2 程序计数器（PC Register）

```java
// 作用：记录当前线程执行到哪条字节码指令（分支、循环、跳转、异常处理、线程恢复都依赖它）
// 特点：
// 1. 线程私有（每个线程一个，互不干扰）
// 2. 内存空间极小（一个指针大小）
// 3. 执行 Java 方法时 = 字节码指令地址；执行 native 方法时 = 未定义（Undefined）
// 4. ★ JVM 规范中唯一没有规定 OutOfMemoryError 的区域
// 5. 线程切换后能恢复执行位置，靠的就是它
```

### 2.3 虚拟机栈（JVM Stack）★★★★★

**每个线程创建时分配一个虚拟机栈，每个方法调用创建一个「栈帧」压栈，方法返回则出栈。**

```
虚拟机栈（每个线程一个）
┌─────────────────────────┐ ← 栈顶（当前执行的方法）
│  栈帧：methodC()          │
│  ├── 局部变量表            │  ← 基本类型的值 + 对象引用（Slot 数组）
│  ├── 操作数栈              │  ← 字节码指令的工作区（LIFO）
│  ├── 动态链接              │  ← 指向运行时常量池中该方法的引用
│  ├── 方法返回地址           │  ← 返回后继续执行的位置
│  └── 附加信息（异常表等）     │
├─────────────────────────┤
│  栈帧：methodB()          │
├─────────────────────────┤
│  栈帧：methodA()          │
├─────────────────────────┤
│  栈帧：main()             │
└─────────────────────────┘ ← 栈底
```

**① 局部变量表（Local Variable Table）**

```java
// 以「变量槽（Slot）」为单位，容量以方法内所需的最大 Slot 数确定（编译期写入 Code 属性的 max_locals）
// Slot 可复用：作用域结束的变量，其 Slot 可被后续变量重用（减少栈帧大小）

public int add(int a, int b) {      // a → Slot 1, b → Slot 2（Slot 0 是 this，静态方法则 a→Slot 0）
    int sum = a + b;                 // sum → Slot 3
    return sum;
}

// ★ Slot 复用导致的 GC 问题（经典面试题）
public static void main(String[] args) {
    {
        byte[] big = new byte[64 * 1024 * 1024];   // 64MB，占 Slot 1
    }                                               // big 作用域结束，但 Slot 1 未被复用
    int a = 0;                                       // 如果 a 也占 Slot 1，则 big 可被回收
    System.gc();                                     // 此处 big 可能仍无法回收！
}
// 修复：手动置 null，或让后续变量复用该 Slot（JIT 通常能优化）
```

**② 操作数栈（Operand Stack）**

```java
// 后进先出（LIFO），字节码指令的「工作台」，最大深度编译期确定（max_stack）
int a = 1, b = 2;
int c = a + b;
```

```
字节码执行过程：
  iconst_1        → 操作数栈: [1]
  istore_1        → 弹出 1 存入局部变量表 Slot1(a)，栈: []
  iconst_2        → 栈: [2]
  istore_2        → 存入 Slot2(b)，栈: []
  iload_1         → 压入 a，栈: [1]
  iload_2         → 压入 b，栈: [1, 2]
  iadd            → 弹出两个，压入 3，栈: [3]
  istore_3        → 存入 Slot3(c)，栈: []
```

> 【面试】**为什么 JVM 是基于栈的指令集，而不是基于寄存器？**
> 1. **可移植性**：不依赖具体硬件的寄存器架构（x86 有 8 个通用寄存器，ARM 有 16 个）。
> 2. **实现简单**：字节码指令更紧凑。
> 3. 代价：指令数量更多、执行速度略慢（但 JIT 会把热点代码编译为使用寄存器的本地机器码，弥补了差距）。
>
> HotSpot 实际实现中，**局部变量表和操作数栈被合并为同一块内存**（重叠使用），减少入栈出栈的实际开销。

**③ 栈溢出与内存溢出**

```java
// ─── StackOverflowError：栈深度超过限制（-Xss）───
public class StackOverflowDemo {
    private static int depth = 0;
    public static void recurse() {
        depth++;
        recurse();                        // 无终止条件的递归
    }
    public static void main(String[] args) {
        try { recurse(); }
        catch (StackOverflowError e) {
            System.out.println("最大递归深度：" + depth);      // 默认约 10000~20000 层
        }
    }
}
// 影响因素：-Xss 栈大小（默认 512KB~1MB）、方法复杂度（局部变量多、操作数栈深 → 深度浅）
// java -Xss256k Demo → 深度变小
// java -Xss4m Demo   → 深度变大

// ─── OutOfMemoryError：无法申请到足够内存创建新线程栈 ───
public class StackOOMDemo {
    public static void main(String[] args) {
        while (true) {
            new Thread(() -> {
                try { Thread.sleep(Integer.MAX_VALUE); } catch (Exception e) { }
            }).start();
        }
    }
}
// Exception in thread "main" java.lang.OutOfMemoryError: unable to create new native thread
// 排查：① 线程泄漏（线程池未复用、Thread 无限创建）
//      ② -Xss 设置过大（每个线程栈都占内存）
//      ③ 操作系统线程数限制（ulimit -u、/proc/sys/kernel/threads-max）
//      ④ 32 位 JVM 的内存上限（约 2GB）
```

**栈大小参数：**

```bash
-Xss256k          # 每个线程的栈大小（默认平台相关：Linux x64 是 1MB，JDK 15+ 是 1MB）
-Xss1m            # 生产常用
-Xss4m            # 递归深度大的场景（如规则引擎、AST 解析）
# ⚠️ 权衡：-Xss 越大，能创建的线程数越少（总内存固定）
#   4GB 堆 + 1MB 栈 → 理论上最多 4000 个线程（实际受 OS 限制更早）
```

### 2.4 堆（Heap）★★★★★

**堆是 JVM 管理的最大内存区域，所有对象实例和数组都在堆上分配（逃逸分析后部分可栈上分配）。**

```
堆的分代结构（经典分代模型，G1/ZGC 的组织方式不同）
┌──────────────────────────────────────────────────────────────┐
│                        Java 堆（-Xms ~ -Xmx）                   │
│  ┌──────────────────────────────────┐  ┌──────────────────┐  │
│  │        新生代 Young (1/3)          │  │   老年代 Old (2/3) │  │
│  │  ┌────────┬────────┬────────┐    │  │                  │  │
│  │  │  Eden  │  S0    │  S1    │    │  │   长期存活对象     │  │
│  │  │  (8)   │ (1)    │ (1)    │    │  │   大对象          │  │
│  │  │        │From    │To      │    │  │   常量池(旧)      │  │
│  │  └────────┴────────┴────────┘    │  │                  │  │
│  │   ↑ 新对象在这里分配（TLAB）        │  │  ← Minor GC 后存活  │  │
│  │   Minor GC / Young GC 频繁        │  │    的对象晋升到这里  │  │
│  └──────────────────────────────────┘  └──────────────────┘  │
│                                        ↑ Major GC / Full GC   │
└──────────────────────────────────────────────────────────────┘

默认比例：
  新生代 : 老年代 = 1 : 2          （-XX:NewRatio=2）
  Eden : S0 : S1 = 8 : 1 : 1      （-XX:SurvivorRatio=8）
```

**为什么堆要分代？（弱分代假说 Weak Generational Hypothesis）**

1. **绝大多数对象都是「朝生夕死」的**（临时变量、方法返回的中间对象）—— 实测约 80%~98% 的对象活不过第一次 Minor GC。
2. **熬过越多次 GC 的对象越难死**（缓存、单例、连接池）。

分代后可以**用不同算法处理不同区域**：新生代用「标记-复制」（存活少，复制成本低），老年代用「标记-整理」（存活多，无碎片）。

**对象在堆中的分配与晋升流程：**

```
① new 对象
   ↓
② 优先在 Eden 区的 TLAB（Thread Local Allocation Buffer）中分配
   （每线程私有的小缓冲，避免并发分配时的锁竞争，-XX:+UseTLAB 默认开启）
   ↓ TLAB 不够
③ 在 Eden 区用 CAS + 失败重试分配
   ↓
④ 大对象直接进老年代（-XX:PretenureSizeThreshold，只对 Serial/ParNew 有效）
   ↓
⑤ Eden 满 → 触发 Minor GC（Young GC）
   ├── 存活对象复制到 S0（From），年龄 +1
   ├── Eden 清空
   └── 下次 GC 时 From/To 互换（总是保持一个 Survivor 为空）
   ↓
⑥ 对象年龄达到阈值（-XX:MaxTenuringThreshold，默认 15）→ 晋升老年代
   或 Survivor 中相同年龄对象总大小 > Survivor 的一半 → 该年龄及以上直接晋升（动态年龄判定）
   或 Survivor 装不下 → 分配担保，直接进老年代
   ↓
⑦ 老年代满 → Major GC / Full GC（STW 时间长）
```

**关键 JVM 参数：**

```bash
# ─── 堆大小 ───
-Xms4g                # 初始堆大小（★ 生产建议与 -Xmx 相同，避免动态扩容导致的停顿和碎片）
-Xmx4g                # 最大堆大小
-Xmn2g                # 新生代大小（设置后 SurvivorRatio 仍生效）
-XX:NewSize=2g        # 新生代初始
-XX:MaxNewSize=2g     # 新生代最大
-XX:NewRatio=2        # 老年代/新生代 = 2（即新生代占 1/3）
-XX:SurvivorRatio=8   # Eden/Survivor = 8（即 Eden 占新生代 8/10）

# ─── 晋升与 TLAB ───
-XX:MaxTenuringThreshold=15     # 晋升年龄阈值（CMS 默认 6，G1 默认 15）
-XX:+UseTLAB                    # 启用 TLAB（默认开启）
-XX:TLABSize=512k               # TLAB 初始大小（默认按线程分配速率自适应）
-XX:PretenureSizeThreshold=1m   # 超过此大小的对象直接进老年代（Serial/ParNew）
-XX:+HandlePromotionFailure     # JDK 6 后已废弃（总是允许担保）

# ─── 打印与诊断 ───
-XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:/logs/gc.log    # JDK 8
-Xlog:gc*:file=/logs/gc.log:time,uptime,level,tags:filecount=5,filesize=20m   # JDK 9+ 统一日志
-XX:+HeapDumpOnOutOfMemoryError                    # ★ OOM 时自动 dump（生产必配！）
-XX:HeapDumpPath=/logs/heapdump.hprof
-XX:+PrintFlagsFinal -version                      # 查看所有参数的最终值
-XX:+PrintCommandLineFlags                         # 查看 JVM 自动选择的参数

# ─── 堆外内存 ───
-XX:MaxDirectMemorySize=1g      # 直接内存上限（默认等于 -Xmx）
-XX:MaxMetaspaceSize=512m       # 元空间上限（默认无限制！生产必须设置）
-XX:MetaspaceSize=256m          # 元空间初始阈值（达到即触发 Full GC）
-XX:ReservedCodeCacheSize=240m  # JIT 代码缓存上限
```

> 【坑】**容器环境（Docker/K8s）的内存配置**：
> - JDK 8u191+ / JDK 10+ 默认开启 `-XX:+UseContainerSupport`，能识别 cgroup 的内存限制。
> - **不要用 `-Xmx` 写死**，改用百分比：`-XX:MaxRAMPercentage=75.0`（占容器内存上限的 75%）。
> - 剩余 25% 留给：元空间、线程栈、直接内存、JIT 代码缓存、GC 自身开销、native 库。**堆设成 100% 必然被 OOMKilled**。
> ```bash
> # K8s 容器的推荐配置
> java -XX:+UseContainerSupport \
>      -XX:InitialRAMPercentage=70.0 \
>      -XX:MaxRAMPercentage=70.0 \
>      -XX:MaxDirectMemorySize=256m \
>      -XX:MaxMetaspaceSize=256m \
>      -XX:+HeapDumpOnOutOfMemoryError \
>      -XX:HeapDumpPath=/logs/ \
>      -jar app.jar
> ```

### 2.5 方法区与元空间 ★★★★★

**方法区是 JVM 规范定义的「逻辑区域」，各 JVM 实现方式不同：**

| JDK 版本 | 实现 | 位置 | 回收 | 问题 |
| --- | --- | --- | --- | --- |
| JDK 7 及以前 | **永久代（PermGen）** | JVM 内存（受 `-XX:MaxPermSize` 限制） | Full GC 时回收 | **易 OOM**：`PermGen space`（动态类生成、大量字符串） |
| **JDK 8+** | **元空间（Metaspace）** | **本地内存（Native Memory，不受 -Xmx 限制）** | 类卸载时回收 | 默认无上限，可能耗尽物理内存 |

```bash
# JDK 7 及以前
-XX:PermSize=128m          # 永久代初始
-XX:MaxPermSize=256m       # 永久代上限 → 超了抛 OutOfMemoryError: PermGen space

# JDK 8+（永久代被移除，参数失效）
-XX:MetaspaceSize=256m     # ★ 元空间的「GC 触发阈值」（不是初始大小！）
                           #   达到此值触发 Full GC 进行类型卸载，同时动态调整阈值
-XX:MaxMetaspaceSize=512m  # ★ 元空间上限（默认 -1 = 无限制，受物理内存约束）
-XX:MinMetaspaceFreeRatio=40    # GC 后最小空闲比例（低于则扩容）
-XX:MaxMetaspaceFreeRatio=70    # GC 后最大空闲比例（高于则缩容）
-XX:CompressedClassSpaceSize=1g # 压缩类指针空间大小（开启指针压缩时）
```

> 【坑】**JDK 8+ 生产环境必须设置 `-XX:MaxMetaspaceSize`**！默认无上限意味着：动态生成类的框架（CGLIB、Groovy、Fastjson ASM、频繁热部署）会不断消耗物理内存，直到系统 OOM 或被 OOMKilled，且**没有 JVM 层的异常提示**，排查极难。

**方法区存储的内容：**

| 内容 | 说明 | JDK 8+ 位置 |
| --- | --- | --- |
| **类的元数据** | 类名、父类、接口、字段描述、方法字节码、注解、访问标志 | **元空间** |
| **运行时常量池** | class 文件常量池的内容（字面量 + 符号引用），运行期可加入新常量（如 `String.intern()`） | **元空间** |
| **方法表** | 指向方法字节码的指针数组（虚方法分派用，即 vtable） | **元空间** |
| **静态变量** | `static` 字段 | **JDK 7 起移到堆**（随 Class 对象） |
| **字符串常量池** | `String` 字面量的池 | **JDK 7 起移到堆** |
| **JIT 编译后的本地代码** | 热点代码的机器码 | **代码缓存（Code Cache）**，独立区域 |

> 【面试】**JDK 8 中静态变量存在哪里？**
>
> **存在堆中**，不在元空间。因为静态变量属于 `Class` 对象，而 **Class 对象本身在 JDK 7 起就被分配到堆**中。元空间只存「类的元数据」（方法字节码、字段类型描述等 C++ 结构）。
>
> 这是高频易错点：很多人以为「静态变量在方法区，方法区 JDK 8 变成元空间，所以静态变量在元空间」——**错误**。

### 2.6 运行时常量池与字符串常量池

```java
// ─── 运行时常量池（Runtime Constant Pool）───
// 每个 class 文件都有自己的「常量池（Constant Pool）」，加载后成为「运行时常量池」
// 内容：字面量（文本字符串、final 常量值）+ 符号引用（类/字段/方法的全限定名和描述符）
// 特点：★ 动态性 —— 运行期也能加入新常量（String.intern() 就是典型）

// class 文件常量池的结构（javap -v 可看）
Constant pool:
   #1 = Methodref    #6.#27    // java/lang/Object."<init>":()V
   #2 = String       #28       // hello
   #3 = Class        #29       // com/example/Demo
   #4 = Fieldref     #3.#30    // com/example/Demo.count:I
  #27 = NameAndType  #31:#32   // "<init>":()V
  #28 = Utf8         hello
// 符号引用在「解析」阶段被替换为直接引用（内存地址/偏移量）

// ─── 字符串常量池（String Pool）───
// JDK 6 及以前：在永久代（大小固定，易 OOM）
// JDK 7+：★ 移到堆中（可 GC，容量受堆限制）
// 底层实现：StringTable（一个固定大小的 HashTable，-XX:StringTableSize 可调，默认 65536）

String s1 = "abc";                      // 池中创建
String s2 = "abc";                      // 复用池中对象
String s3 = new String("abc");          // 堆中新对象
String s4 = s3.intern();                // ★ 返回池中的引用

System.out.println(s1 == s2);           // true
System.out.println(s1 == s3);           // false
System.out.println(s1 == s4);           // true

// intern() 的行为（JDK 7+ 与 JDK 6 不同！★ 经典面试题）
String str = new StringBuilder("go").append("od").toString();   // "good"
System.out.println(str.intern() == str);    // JDK 7+: true  / JDK 6: false
// JDK 6：intern 会在永久代中【复制】一份 "good"，返回复制品的引用 → != str
// JDK 7+：池中已无 "good"，intern 直接把【堆中 str 的引用】记录到 StringTable → == str

String str2 = new StringBuilder("ja").append("va").toString();  // "java"
System.out.println(str2.intern() == str2);  // ★ false（两个版本都是）
// 因为 "java" 在 JVM 启动时就已被加入字符串常量池（sun.misc.Version 等类使用）
// intern 返回的是池中已存在的那个引用，不是 str2
```

### 2.7 直接内存（Direct Memory）

```java
// 不是 JVM 运行时数据区的一部分，但被频繁使用且会 OOM
// NIO 的 DirectByteBuffer 直接分配本地内存（malloc），避免「堆 → 临时直接内存 → 内核」的额外拷贝

ByteBuffer heap = ByteBuffer.allocate(1024);            // 堆内（HeapByteBuffer）
ByteBuffer direct = ByteBuffer.allocateDirect(1024);     // ★ 堆外（DirectByteBuffer）

// 分配上限
-XX:MaxDirectMemorySize=1g      # 默认等于 -Xmx

// 回收机制（★ 重要，容易内存泄漏）
// DirectByteBuffer 对象本身在堆中（很小），被 GC 回收时通过 Cleaner（虚引用）
// 触发 unsafe.freeMemory() 释放堆外内存
// 问题：如果 DirectByteBuffer 对象一直有强引用，或 GC 迟迟不发生，堆外内存就不会释放
//      → OutOfMemoryError: Direct buffer memory

// 手动释放（JDK 8 及以前）
((DirectBuffer) buffer).cleaner().clean();
// JDK 9+ 需要 --add-opens java.base/sun.nio.ch=ALL-UNNAMED，或用 Unsafe.invokeCleaner
// 更好：用 Netty 的 ByteBuf.release()（引用计数管理）
```

**堆内存 vs 直接内存：**

| 对比 | 堆内存（HeapByteBuffer） | 直接内存（DirectByteBuffer） |
| --- | --- | --- |
| 分配位置 | JVM 堆 | 本地内存（OS malloc） |
| 分配/释放速度 | **快**（JVM 内部指针碰撞） | **慢**（系统调用） |
| IO 性能 | 慢（多一次拷贝） | **快**（零拷贝） |
| 受 GC 管理 | ✅ | ❌（间接通过 Cleaner） |
| 大小限制 | `-Xmx` | `-XX:MaxDirectMemorySize`（默认 = -Xmx） |
| OOM 表现 | `Java heap space` | `Direct buffer memory` |
| 适用 | 计算密集、频繁创建销毁 | **IO 密集、长期复用**（Netty 池化） |

## 3. 对象的创建、内存布局与访问 ★★★★★

### 3.1 对象创建的完整过程

```java
User user = new User("Tom");
```

```
① 类加载检查
   检查 User 是否已加载、解析、初始化过；没有则先执行类加载过程
       ↓
② 分配内存（在堆中划出一块）
   方式 A：指针碰撞（Bump the Pointer）—— 堆规整时（用带压缩的 GC：Serial/ParNew/G1）
           移动分界指针，划出对象大小
   方式 B：空闲列表（Free List）—— 堆不规整时（用 CMS 这类标记-清除）
           维护可用内存列表，找一块足够大的
   并发安全：
     - CAS + 失败重试
     - ★ TLAB（Thread Local Allocation Buffer）：每线程在 Eden 预先分配一小块私有缓冲，
       对象优先在 TLAB 中分配，避免竞争（-XX:+UseTLAB 默认开启）
       ↓
③ 内存空间初始化为零值
   所有字段设为默认值（int → 0，引用 → null）
   ★ 这就是「成员变量不赋值也能直接使用」的原因
       ↓
④ 设置对象头（Object Header）
   Mark Word：哈希码、GC 分代年龄、锁标志位、线程持有的锁、偏向线程 ID
   Klass Pointer：指向元空间中的类元数据（决定这个对象是哪个类的实例）
   数组长度（仅数组对象）
       ↓
⑤ 执行 <init> 构造方法
   按代码顺序：父类构造 → 实例变量赋值/实例代码块 → 本类构造体
   （详见 [[后端/Java基础/面向对象基础]] 第 4.4 节）
       ↓
⑥ 返回对象引用给栈中的 user 变量
```

### 3.2 对象的内存布局

```
┌────────────────────────────────────────────────────┐
│ 对象头 Header                                        │
│ ├── Mark Word（64 位）                                │
│ │    ├── 无锁:   [hashcode:31 | age:4 | 0 | 01]      │
│ │    ├── 偏向锁: [threadId:54 | epoch:2 | age:4|1|01] │
│ │    ├── 轻量级: [指向 Lock Record 的指针:62 | 00]     │
│ │    ├── 重量级: [指向 Monitor 的指针:62 | 10]         │
│ │    └── GC标记: [11]                                 │
│ ├── Klass Pointer（32 位压缩 / 64 位未压缩）            │
│ └── Array Length（32 位，仅数组对象有）                  │
├────────────────────────────────────────────────────┤
│ 实例数据 Instance Data（各字段的值）                    │
│  ★ JVM 会重排字段顺序：按宽度从大到小（long/double →     │
│    int/float → short/char → byte/boolean → 引用）      │
│    以减少对齐空洞                                       │
├────────────────────────────────────────────────────┤
│ 对齐填充 Padding（补齐到 8 字节的整数倍）                 │
└────────────────────────────────────────────────────┘
```

**各种对象的大小（64 位 JVM，开启压缩指针 `-XX:+UseCompressedOops` 默认）：**

| 对象 | 大小 | 说明 |
| --- | --- | --- |
| `new Object()` | **16 字节** | 对象头 12（Mark 8 + Klass 4）+ 填充 4 |
| `new int[0]` | **16 字节** | 对象头 12 + 数组长度 4 |
| `new Integer(1)` | **16 字节** | 头 12 + int 4 |
| `new Long(1L)` | **24 字节** | 头 12 + long 8 + 填充 4 |
| `new String("")` | **24 字节** | 头 12 + 引用 4（value）+ 其他 + 填充（JDK 9+） |
| 含 1 boolean + 1 int + 1 long + 1 ref 的对象 | **32 字节** | 头 12 + long 8 + int 4 + ref 4 + boolean 1 + 填充 3 |

```java
// 用 JOL 精确测量
System.out.println(ClassLayout.parseInstance(new Object()).toPrintable());
// java.lang.Object@1b6d3586d object internals:
//  OFFSET  SIZE   TYPE DESCRIPTION                    VALUE
//       0     4        (object header: mark)          0x0000000000000001
//       4     4        (object header: class)         0x000001b3
//  Instance size: 16 bytes
//  Space losses: 0 bytes internal + 0 bytes external
```

**指针压缩（Compressed Oops）：**

```bash
-XX:+UseCompressedOops       # 默认开启（堆 < 32GB 时有效）
```

- 64 位 JVM 的引用本应是 8 字节，但用「压缩指针」把它压到 **4 字节**（存储的是「对象地址 >> 3」的偏移量）。
- **前提：堆大小 < 32GB**。因为 4 字节能表示 2³² 个「8 字节对齐的地址」= 32GB。
- **堆超过 32GB 时压缩指针失效**，引用变回 8 字节，实际可用对象数反而减少 → 这就是「**不要设置 31~40GB 的堆**」的原因（要么 ≤31GB，要么直接 ≥48GB）。

### 3.3 对象的访问定位

```java
Object obj = new Object();
```

**方式 1：句柄访问（Handle）**

```
栈中 reference ──→ ┌──────────────┐         ┌─────────────┐
                   │  句柄池        │         │   堆         │
                   │ ┌──────────┐ │         │ ┌─────────┐ │
                   │ │对象实例指针├─┼────────→│ │ 对象实例  │ │
                   │ ├──────────┤ │         │ └─────────┘ │
                   │ │对象类型指针├─┼──→ 方法区/元空间的类元数据
                   │ └──────────┘ │         └─────────────┘
                   └──────────────┘
优点：reference 存储的是稳定的句柄地址，对象被 GC 移动时只需改句柄中的实例指针，
     reference 本身不用改（GC 时更安全）
缺点：多一次间接访问，性能略低
```

**方式 2：直接指针访问（★ HotSpot 采用）**

```
栈中 reference ─────────────────→ ┌─────────────┐
                                  │   堆         │
                                  │ ┌─────────┐ │
                                  │ │ 对象实例  │ │──→ 元空间的类元数据
                                  │ │(含Klass  │ │
                                  │ │ 指针)    │ │
                                  │ └─────────┘ │
                                  └─────────────┘
优点：速度快（少一次指针定位），节省一次访问开销
缺点：对象被 GC 移动时，所有指向它的 reference 都要更新
     （HotSpot 用「转发指针 forwarding pointer」+ 停顿期间统一修正解决）
```

### 3.4 逃逸分析与栈上分配 ★★★★

**逃逸分析（Escape Analysis）：判断对象的作用域是否「逃出」方法或线程。**

| 逃逸级别 | 说明 | 优化可能 |
| --- | --- | --- |
| **不逃逸（NoEscape）** | 对象只在方法内使用 | ✅ 栈上分配、标量替换、锁消除 |
| **方法逃逸（ArgEscape）** | 对象作为参数传给其他方法，但未赋给静态变量/字段 | ✅ 锁消除（不跨线程） |
| **线程逃逸（GlobalEscape）** | 对象赋给静态变量、实例字段，或其他线程可访问 | ❌ 无法优化 |

**三大优化：**

```java
// ─── 优化 1：标量替换（Scalar Replacement）★ HotSpot 实际采用的方式 ───
public Point calculate() {
    Point p = new Point(3, 5);          // p 不逃逸
    return new Point(p.x + 1, p.y + 2);
}
// JIT 优化后：Point 对象【根本不会被创建】，而是拆解为两个 int 局部变量（标量）
// 直接在寄存器/栈上操作 → 零堆分配、零 GC 压力
// 参数：-XX:+EliminateAllocations（默认开启）
//      -XX:+EliminateNestedAllocations

// ─── 优化 2：栈上分配（Stack Allocation）───
// 严格说 HotSpot 没有真正的「栈上分配」，是通过标量替换达到等效效果
// 对象不逃逸 → 字段分配在栈帧的局部变量表中 → 方法结束自动销毁（无需 GC）

// ─── 优化 3：锁消除（Lock Elision）───
public String concat(String a, String b) {
    StringBuffer sb = new StringBuffer();    // sb 不逃逸，其他线程不可能访问
    sb.append(a);                             // append 是 synchronized 方法
    sb.append(b);
    return sb.toString();
}
// JIT 发现 sb 不可能被其他线程访问 → 【直接删除所有 synchronized】
// 参数：-XX:+EliminateLocks（默认开启）

// ─── 验证逃逸分析效果 ───
// 关闭逃逸分析，创建 1000 万个对象：
// java -XX:-DoEscapeAnalysis -Xmx20m Demo  → 触发 GC，耗时长
// java -XX:+DoEscapeAnalysis -Xmx20m Demo  → 几乎不触发 GC，速度快数倍
```

> 【面试】**「所有对象都在堆上分配」这句话对吗？**
>
> **不完全对。** 严格来说 JVM 规范确实规定对象在堆上分配，但 **JIT 编译器的逃逸分析 + 标量替换**会让「不逃逸的对象」的字段直接分配在栈/寄存器上，**对象本身根本没有被创建**。所以从效果上看，部分对象「在栈上分配」。这是《深入理解 Java 虚拟机》第 3 版明确指出的（并纠正了第 2 版中「HotSpot 有栈上分配」的说法）。

## 4. JMM 与 happens-before

> JMM 的详细内容（volatile、内存屏障、三大特性）见 [[后端/Java基础/并发编程/volatile与CAS原子类]] 与 [[后端/Java基础/并发编程/线程安全与synchronized]]。这里只做与内存区域的关联梳理。

**JMM 抽象与物理内存的映射：**

| JMM 概念 | 物理对应 |
| --- | --- |
| 主内存（Main Memory） | 堆中的共享变量（多核下还包括 L3 缓存、主存） |
| 工作内存（Working Memory） | CPU 寄存器、L1/L2 缓存、写缓冲区（Write Buffer） |
| 线程 | CPU 核心 / 硬件线程 |
| happens-before | 内存屏障的插入规则 |

**JMM 与运行时数据区的关系（不要混淆）：**

| | 运行时数据区 | JMM |
| --- | --- | --- |
| 性质 | **物理/实现层面**的内存划分 | **规范/抽象层面**的并发内存模型 |
| 内容 | 堆、栈、方法区、PC | 主内存、工作内存、8 种原子操作 |
| 目的 | 描述对象和方法如何存储 | 描述多线程如何安全地访问共享变量 |
| 关系 | 局部变量在**虚拟机栈**（线程私有，不涉及 JMM）；共享变量在**堆/方法区**（涉及 JMM） | — |

```java
public class JMMMapping {
    private static int staticVar;         // 方法区/堆 → ★ JMM 主内存（共享）
    private int instanceVar;               // 堆（对象内）→ ★ JMM 主内存（共享）
    private volatile int volatileVar;      // 堆 → JMM 主内存 + 内存屏障保证

    public void method() {
        int localVar = 1;                  // 虚拟机栈局部变量表 → 线程私有，★ 不涉及 JMM
        User user = new User();            // 引用在栈（私有），对象在堆（共享）
        localVar = 2;                       // 无需同步，天然线程安全
    }
}
// 结论：栈上的数据线程私有，天然安全；堆和方法区的共享数据需要 volatile/synchronized/final 保护
```

## 5. 内存溢出（OOM）全景 ★★★★★

| OOM 类型 | 错误信息 | 发生区域 | 常见原因 | 排查方向 |
| --- | --- | --- | --- | --- |
| **堆溢出** | `Java heap space` | 堆 | 内存泄漏、大对象、缓存无淘汰、堆太小 | **jmap dump + MAT 分析支配树** |
| **GC 开销超限** | `GC overhead limit exceeded` | 堆 | GC 花 98% 时间只回收 2% 内存 | 同上（泄漏的典型表现） |
| **元空间溢出** | `Metaspace` | 元空间 | 动态生成类过多（CGLIB、Groovy、Fastjson ASM）、频繁热部署、类加载器泄漏 | `jstat -gcmetacapacity`、检查 ClassLoader 数量 |
| **永久代溢出**（JDK 7-） | `PermGen space` | 永久代 | 大量字符串常量、类过多 | 升级 JDK 8 或增大 MaxPermSize |
| **栈溢出** | `StackOverflowError` | 虚拟机栈 | 递归过深、循环依赖的 toString | 检查递归终止条件、`-Xss` |
| **线程栈 OOM** | `unable to create new native thread` | 本地内存 | 线程数超系统限制、`-Xss` 过大、堆占满内存 | `jstack` 数线程、`ulimit -u`、减小 Xss |
| **直接内存溢出** | `Direct buffer memory` | 堆外 | DirectByteBuffer 未释放、NIO/Netty 泄漏 | `-XX:MaxDirectMemorySize`、检查 ByteBuf 引用计数 |
| **数组超上限** | `Requested array size exceeds VM limit` | 堆 | 请求的数组长度 > `Integer.MAX_VALUE - 8` | 分批处理 |
| **压缩类空间溢出** | `Compressed class space` | 元空间的类指针区 | 类过多（超过 `CompressedClassSpaceSize`，默认 1G） | 增大该参数 |

```java
// ─── 各类 OOM 的复现代码（学习/测试用）───

// 1. 堆溢出
public static void heapOOM() {
    List<byte[]> list = new ArrayList<>();
    while (true) list.add(new byte[1024 * 1024]);      // 每次 1MB
}
// -Xmx20m -XX:+HeapDumpOnOutOfMemoryError

// 2. 栈溢出
public static void stackOverflow() { stackOverflow(); }  // 无限递归

// 3. 元空间溢出（用 CGLIB 动态生成类）
public static void metaspaceOOM() {
    while (true) {
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(OOMObject.class);
        enhancer.setUseCache(false);                    // ★ 关闭缓存，每次都生成新类
        enhancer.setCallback((MethodInterceptor) (o, m, a, p) -> p.invokeSuper(o, a));
        enhancer.create();
    }
}
// -XX:MaxMetaspaceSize=20m

// 4. 线程 OOM
public static void threadOOM() {
    while (true) {
        new Thread(() -> { try { Thread.sleep(Integer.MAX_VALUE); } catch (Exception e) {} }).start();
    }
}

// 5. 直接内存溢出
public static void directOOM() {
    List<ByteBuffer> list = new ArrayList<>();
    while (true) list.add(ByteBuffer.allocateDirect(1024 * 1024));
}
// -XX:MaxDirectMemorySize=20m

// 6. String.intern() 导致的常量池膨胀（JDK 6 会 OOM: PermGen space）
public static void stringPoolOOM() {
    List<String> list = new ArrayList<>();
    int i = 0;
    while (true) list.add(String.valueOf(i++).intern());
}
```

**内存泄漏 vs 内存溢出：**

| | 内存泄漏（Memory Leak） | 内存溢出（Memory Overflow） |
| --- | --- | --- |
| 定义 | 对象不再使用但**无法被 GC 回收**（仍有引用） | 申请内存时**没有足够空间** |
| 关系 | **泄漏积累 → 最终导致溢出** | 是结果 |
| 表现 | 内存使用曲线**阶梯式上升**，Full GC 后不下降 | 抛 OutOfMemoryError |
| 排查 | MAT 的 Dominator Tree、Leak Suspects 报告 | jmap dump 分析 |

**Java 中典型的内存泄漏场景：**

```java
// 1. 静态集合持有对象（最常见！）
private static final List<Object> CACHE = new ArrayList<>();     // 静态，永不回收
public void process(Object o) { CACHE.add(o); }                   // ★ 只加不删 → 泄漏
// ✅ 用带淘汰策略的缓存（Caffeine、Guava Cache）或 WeakHashMap

// 2. ThreadLocal 未 remove（线程池场景）
// 详见 [[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]

// 3. 监听器/回调未注销
eventBus.register(this);          // 注册
// 忘记 eventBus.unregister(this) → this 被 EventBus 强引用，无法回收

// 4. 数据库连接/流未关闭
Connection conn = dataSource.getConnection();     // 忘记 close → 连接泄漏（池耗尽）
InputStream in = new FileInputStream(f);           // 忘记 close → 文件句柄泄漏（Too many open files）
// ✅ 一律 try-with-resources

// 5. 内部类持有外部类引用
public class BigService {
    private byte[] hugeData = new byte[100 * 1024 * 1024];      // 100MB
    public Runnable getTask() {
        return new Runnable() {                                   // ★ 匿名内部类持有 BigService.this
            public void run() { }
        };
    }
}
// 如果 getTask() 的返回值被线程池长期持有 → 100MB 无法回收
// ✅ 改用 static 内部类

// 6. 缓存无过期策略（HashMap 当缓存用）
private static final Map<String, Object> cache = new HashMap<>();  // ★ 无限增长
// ✅ Caffeine.maximumSize(10000).expireAfterWrite(10, MINUTES)

// 7. ClassLoader 泄漏（热部署场景）
// 老 ClassLoader 加载的类被某个静态引用/线程/JDBC 驱动持有 → 整个 ClassLoader 及其所有类无法卸载
// 表现：Metaspace 持续增长，Full GC 后不下降
// 常见持有者：ThreadLocal、JDBC DriverManager、shutdown hook、定时器线程

// 8. 字符串拼接产生的中间对象（循环内 +=）
// 9. 数组/集合中的 null 槽位（ArrayList 删除后不置 null）
//    → JDK 源码中 remove 后会 es[size] = null，正是为了避免这个问题
```

## 6. JVM 参数速查

```bash
# ─── 标准参数（-，所有 JVM 都支持）───
-version, -help, -cp/-classpath, -D<name>=<value>, -ea/-da（断言）, -server/-client, -jar

# ─── -X 参数（非标准，HotSpot 特有）───
-Xms4g          # 初始堆（= -XX:InitialHeapSize）
-Xmx4g          # 最大堆（= -XX:MaxHeapSize）
-Xmn2g          # 新生代大小（= -XX:NewSize / -XX:MaxNewSize）
-Xss512k        # 线程栈大小（= -XX:ThreadStackSize）

# ─── -XX 参数（不稳定，高级调优）───
# 布尔型：-XX:+Flag 开启，-XX:-Flag 关闭
# KV 型：-XX:Key=Value

# 内存
-XX:NewRatio=2 -XX:SurvivorRatio=8 -XX:MaxTenuringThreshold=15
-XX:MetaspaceSize=256m -XX:MaxMetaspaceSize=512m
-XX:MaxDirectMemorySize=1g -XX:ReservedCodeCacheSize=240m
-XX:+UseCompressedOops -XX:+UseCompressedClassPointers
-XX:InitialRAMPercentage=70.0 -XX:MaxRAMPercentage=70.0    # ★ 容器环境推荐

# GC（详见 垃圾回收机制与收集器）
-XX:+UseG1GC -XX:MaxGCPauseMillis=200
-XX:+UseZGC -XX:+UseShenandoahGC
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/
-XX:+ExitOnOutOfMemoryError                                  # ★ OOM 直接退出（K8s 自动重启，推荐）
-XX:ErrorFile=/logs/hs_err_%p.log                            # JVM 崩溃日志
-Xlog:gc*:file=/logs/gc.log:time,uptime:filecount=5,filesize=20m    # JDK 9+ GC 日志

# JIT 与诊断
-XX:+TieredCompilation -XX:CompileThreshold=10000
-XX:+PrintCompilation                                        # 打印 JIT 编译
-XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining            # 打印方法内联
-XX:+DoEscapeAnalysis -XX:+EliminateAllocations -XX:+EliminateLocks

# 查看参数
-XX:+PrintFlagsFinal -version       # 所有参数的最终值（含默认和被修改的标记）
-XX:+PrintCommandLineFlags          # JVM 自动选择的参数（如 -XX:InitialHeapSize=...）
-XX:+ShowMessageBoxOnError          # 崩溃时弹窗（调试用）
```

**生产环境的推荐 JVM 参数模板（4C8G 容器 + JDK 17 + G1）：**

> 下面是分段说明，**实际启动命令中不要在 `\` 续行符后夹注释行**（会导致参数被截断）。

内存（容器感知）：
```bash
-XX:+UseContainerSupport -XX:InitialRAMPercentage=70.0 -XX:MaxRAMPercentage=70.0
-XX:MaxMetaspaceSize=256m -XX:MaxDirectMemorySize=512m -XX:+UseCompressedOops
```

GC（G1）：
```bash
-XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:InitiatingHeapOccupancyPercent=45
```

诊断与自愈：
```bash
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/heapdump.hprof
-XX:+ExitOnOutOfMemoryError -XX:ErrorFile=/logs/hs_err_%p.log
-Xlog:gc*,gc+age=trace,safepoint:file=/logs/gc.log:time,uptime,level,tags:filecount=5,filesize=20m
```

完整启动命令（可直接复制）：
```bash
java -XX:+UseContainerSupport \
     -XX:InitialRAMPercentage=70.0 -XX:MaxRAMPercentage=70.0 \
     -XX:MaxMetaspaceSize=256m -XX:MaxDirectMemorySize=512m -XX:+UseCompressedOops \
     -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:InitiatingHeapOccupancyPercent=45 \
     -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/heapdump.hprof \
     -XX:+ExitOnOutOfMemoryError -XX:ErrorFile=/logs/hs_err_%p.log \
     -Xlog:gc*,gc+age=trace,safepoint:file=/logs/gc.log:time,uptime,level,tags:filecount=5,filesize=20m \
     -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Shanghai -Dspring.profiles.active=prod \
     -jar /app/app.jar
```

## 7. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `-Xms` 与 `-Xmx` 不同 | 堆动态扩容导致停顿和碎片 | 生产环境设为相同值 |
| 2 | 未设 `MaxMetaspaceSize` | 物理内存耗尽被 OOMKilled，无 JVM 异常 | 显式设置上限 |
| 3 | 容器内堆设为 100% 内存 | 被 K8s OOMKilled | `MaxRAMPercentage=70` |
| 4 | 堆设 31~40GB | 压缩指针失效，可用内存反而变少 | ≤31GB 或 ≥48GB |
| 5 | `-Xss` 过大 | 线程数上不去 | 512k~1m，按递归深度调整 |
| 6 | 静态集合当缓存无淘汰 | 堆持续增长，Full GC 无效 | Caffeine + 过期策略 |
| 7 | ThreadLocal 未 remove | 内存泄漏 + 数据串号 | `finally &#123; remove(); &#125;` |
| 8 | 匿名内部类持有大对象 | 大对象无法回收 | 改 static 内部类 |
| 9 | DirectByteBuffer 未释放 | `Direct buffer memory` OOM | Netty 引用计数 / 显式 clean |
| 10 | 未开 `HeapDumpOnOutOfMemoryError` | OOM 后无现场，无法排查 | **生产必配** |
| 11 | Slot 复用不当 | 大对象迟迟不回收 | 置 null 或缩小作用域 |
| 12 | 递归过深 | `StackOverflowError` | 改迭代 + 显式栈 |
| 13 | 频繁热部署 | 元空间持续增长（ClassLoader 泄漏） | 检查 ThreadLocal/JDBC/hook 持有 |
| 14 | `String.intern()` 大量调用 | StringTable 膨胀，性能下降 | 调 `-XX:StringTableSize`，避免滥用 |
| 15 | 以为静态变量在元空间 | 概念错误 | JDK 7+ 静态变量在堆 |
| 16 | 未考虑 GC 自身内存开销 | 堆设太满，GC 无空间工作 | 留足余量（G1 需要 ~10% 空间做复制） |
| 17 | 依赖逃逸分析保证正确性 | JIT 未优化时行为差异 | 逃逸分析只是性能优化，不影响语义 |
| 18 | OOM 后进程继续运行 | 状态不一致，带病服务 | `-XX:+ExitOnOutOfMemoryError` 让编排系统重启 |

---

## 关联笔记

- 下一篇：[[后端/JVM/垃圾回收机制与收集器]]
- 相关：[[后端/JVM/类加载机制与字节码]]、[[后端/JVM/JVM调优与线上问题排查]]
- 并发关联：[[后端/Java基础/并发编程/volatile与CAS原子类]]（JMM 与内存屏障）、[[后端/Java基础/并发编程/线程安全与synchronized]]（对象头与锁升级）
- 对象创建：[[后端/Java基础/面向对象基础]]（构造器执行顺序）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
