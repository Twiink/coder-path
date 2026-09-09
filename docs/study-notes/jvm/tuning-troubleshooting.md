---
title: "JVM调优与线上问题排查"
aliases:
  - "Arthas"
  - "OOM 排查"
  - "CPU 飙高排查"
tags:
  - "后端"
  - "java"
  - "jvm"
  - "实战"
  - "面试"
category: "后端"
folder: "JVM"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/JVM/JVM概述与运行时数据区]]"
  - "[[后端/JVM/垃圾回收机制与收集器]]"
  - "[[后端/JVM/类加载机制与字节码]]"
  - "[[后端/Java工程化与部署/Linux与Java项目部署]]"
created: 2026-09-07
updated: 2026-09-07
---

# JVM 调优与线上问题排查

> 前三篇讲原理（[[后端/JVM/JVM概述与运行时数据区]]、[[后端/JVM/垃圾回收机制与收集器]]、[[后端/JVM/类加载机制与字节码]]），本篇是**实战**：命令行工具、Arthas、六大典型线上故障的完整排查流程。这是面试「你遇到过什么线上问题」的标准答案素材库。

## 1. 调优的基本认知

### 1.1 调优目标与手段

| 目标 | 指标 | 手段 |
| --- | --- | --- |
| **低延迟**（响应快） | GC 停顿时间、接口 P99 | G1/ZGC、减小新生代、避免 Full GC |
| **高吞吐**（处理量大） | GC 时间占比、QPS | Parallel GC、增大新生代、减少对象分配 |
| **低内存占用** | 堆大小、RSS | 减小堆、对象复用、堆外内存控制、压缩指针 |

**三者互相矛盾，必须取舍。** 面向用户的 Web 服务优先「低延迟」，后台批处理优先「高吞吐」。

### 1.2 调优的正确顺序（★ 90% 的性能问题在这一层解决）

```
① 代码层面（收益最大）
   - 减少对象分配（循环外创建、对象复用、StringBuilder）
   - 避免内存泄漏（ThreadLocal、静态集合、未关闭资源）
   - SQL 优化、索引、批量操作、避免 N+1
   - 缓存（本地 Caffeine + 分布式 Redis）
   - 算法与数据结构（O(n²) → O(n log n)）
   - 异步化、并行化（CompletableFuture）
        ↓
② 架构层面
   - 服务拆分、读写分离、分库分表
   - 消息队列削峰、限流降级
   - CDN、静态资源分离
        ↓
③ JVM 层面（收益最小，但必要）
   - 堆大小、GC 选择、GC 参数
   - 元空间、直接内存
        ↓
④ 操作系统/硬件层面
   - CPU、内存、磁盘 IO、网络
   - 内核参数（somaxconn、tw_reuse、文件句柄数）
```

> 【原则】**不要一上来就调 JVM 参数**。绝大多数「性能问题」的根因是烂 SQL、内存泄漏、锁竞争、算法低效。JVM 调参只能在合理范围内微调（通常提升 10%~30%），不可能救一个有内存泄漏的应用。

### 1.3 什么时候需要调优

| 信号 | 说明 |
| --- | --- |
| 频繁 Full GC | 每小时多次，或 Full GC 后老年代仍不下降（泄漏） |
| GC 停顿影响业务 | P99 抖动、接口超时、用户投诉卡顿 |
| OOM 频发 | 即使加了内存还是 OOM |
| 内存使用率异常 | 堆长期 > 80%，或 RSS 远大于 -Xmx |
| CPU 无故飙高 | 排查后发现是 GC 线程或死循环 |
| 应用启动慢 | 类加载多、JIT 未预热 |

## 2. 命令行诊断工具 ★★★★★

### 2.1 工具速查

| 工具 | 用途 | 命令示例 |
| --- | --- | --- |
| **`jps`** | 列出所有 Java 进程 | `jps -lvm` |
| **`jstat`** | GC / 类加载 / JIT 的实时统计（★ 最轻量，生产首选） | `jstat -gcutil &lt;pid&gt; 1000 10` |
| **`jmap`** | 堆内存快照、直方图 | `jmap -dump:live,format=b,file=heap.hprof &lt;pid&gt;` |
| **`jstack`** | 线程栈快照（死锁、CPU 高） | `jstack &lt;pid&gt; > thread.txt` |
| **`jinfo`** | 查看/动态修改 JVM 参数 | `jinfo -flags &lt;pid&gt;` |
| **`jcmd`** | ★ 综合工具（推荐，替代 jmap/jstack 部分功能） | `jcmd &lt;pid&gt; help` |
| **`jhat`** | 分析 heap dump（已被 MAT 取代，JDK 9 移除） | — |
| **`jconsole` / `jvisualvm`** | 图形化监控（本地） | GUI |
| **`Arthas`** | ★★ 阿里开源，线上诊断神器 | `java -jar arthas-boot.jar` |
| **`async-profiler`** | CPU/内存火焰图（低开销） | `./profiler.sh -d 30 &lt;pid&gt;` |
| **`MAT`** | 堆转储分析（Eclipse Memory Analyzer） | GUI |
| **`JProfiler` / `YourKit`** | 商业性能分析 | GUI |

### 2.2 jps：找进程

```bash
jps                # PID + 主类名
jps -l             # PID + 完整主类名（或 jar 路径）
jps -v             # ★ 显示传给 JVM 的参数（快速确认 -Xmx 等是否生效）
jps -m             # 显示传给 main 方法的参数
jps -lvm           # 组合：完整类名 + JVM 参数 + main 参数

# 输出示例
# 12345 com.example.MallApplication -Xmx4g -Xms4g -XX:+UseG1GC
# 12400 sun.tools.jps.Jps -lvm

# 其他找 Java 进程的方式
ps -ef | grep java
pgrep -f java | xargs ps -fp
jcmd -l            # JDK 7+，同 jps
```

### 2.3 jstat：GC 实时监控（★ 生产最常用）

```bash
jstat -<option> <pid> [interval [count]]

# ★ 最常用：GC 百分比统计，每秒一次，共 10 次
jstat -gcutil 12345 1000 10

# 输出解读
  S0     S1     E      O      M     CCS    YGC     YGCT    FGC    FGCT     GCT
  0.00  45.32  67.89  52.34  95.67  93.21   1234    5.678     3    1.234    6.912
  ↑      ↑      ↑      ↑      ↑     ↑        ↑       ↑         ↑     ↑        ↑
Survivor0 Survivor1 Eden  Old   Metaspace 压缩类空间 YoungGC YoungGC总耗时 FullGC FullGC耗时 总GC耗时
使用率%  使用率%  使用率% 使用率% 使用率%   使用率%   次数    (秒)      次数   (秒)     (秒)

# ★ 判断要点
# 1. O（老年代）持续增长且 FGC 后不下降 → 内存泄漏！
# 2. FGC 次数快速增长 → 老年代压力大（晋升过快 / 堆太小 / 泄漏）
# 3. FGCT/FGC = 单次 Full GC 耗时，> 1 秒就需要优化
# 4. E（Eden）快速从 0 到 100 → 对象分配速率高（YGC 频繁）
# 5. M（元空间）> 95% → 可能触发 Metaspace OOM

# 其他选项
jstat -gc 12345 1000          # 各区域的「容量/已用」绝对值（KB）
#  S0C S1C S0U S1U EC EU OC OU MC MU CCSC CCSU YGC YGCT FGC FGCT GCT
#   ↑容量  ↑已用（C=Capacity, U=Used）

jstat -gccapacity 12345       # 各代的容量（最小/最大/当前）
#  NGCMN NGCMX NGC S0C S1C EC OGCMN OGCMX OGC OC MCMN MCMX MC ... YGC FGC
#   ↑新生代最小 ↑最大 ↑当前

jstat -gccause 12345 1000     # ★ 额外显示「上次 GC 的原因」（LGCC）和当前 GC 原因（GCC）
#  ... GCT LGCC GCC
#       ↑ Last GC Cause（如 "Allocation Failure"、"Metadata GC Threshold"、"System.gc()"）

jstat -gcnew 12345            # 新生代详情（TTA 年龄阈值、Survivor 使用）
jstat -gcold 12345            # 老年代详情
jstat -gcmetacapacity 12345   # 元空间容量
jstat -class 12345            # ★ 类加载统计（排查元空间泄漏）
#  Loaded  Bytes  Unloaded  Bytes     Time
#   12345  23456       100    200     3.45
#   ↑已加载类数 ↑字节数 ↑已卸载 ↑字节数 ↑耗时
jstat -compiler 12345         # JIT 编译统计
jstat -printcompilation 12345 1000   # 实时打印被编译的方法

# 实战：持续监控并落盘（用于事后分析）
jstat -gcutil 12345 5000 > /logs/jstat-$(date +%Y%m%d).log &
```

### 2.4 jmap：堆快照与直方图

```bash
# ─── 堆直方图（★ 轻量，不 STW 太久，可先看这个）───
jmap -histo 12345 | head -30
#  num     #instances         #bytes  class name
#    1:       1234567      345678901  [B                      ← byte 数组（通常是 String/ByteBuffer）
#    2:        987654      123456789  com.example.OrderVO       ← ★ 业务对象排前面就要警惕
#    3:        876543       98765432  java.lang.String
#    4:        123456       45678901  java.util.HashMap$Node
# ...
# 判断：如果某个业务对象实例数异常多（几十万、上百万），很可能就是泄漏点

jmap -histo:live 12345 | head -30      # ★ 只统计「存活对象」，但会触发 Full GC！
                                       #   生产慎用（会导致长时间 STW）

# ─── 堆转储（Heap Dump，★ 排查 OOM 的核心手段）───
jmap -dump:format=b,file=/logs/heap.hprof 12345              # 全部对象
jmap -dump:live,format=b,file=/logs/heap.hprof 12345         # ★ 只 dump 存活对象（会触发 Full GC）

# ⚠️ 注意：
# 1. dump 过程会 STW，且时间与堆大小成正比（4GB 堆约 10~30 秒）→ 生产环境要先摘流量！
# 2. dump 文件大小 ≈ 堆使用量 → 确保磁盘空间足够
# 3. JDK 9+ 推荐用 jcmd：jcmd 12345 GC.heap_dump /logs/heap.hprof

# ─── 其他 ───
jmap -heap 12345                     # 堆配置详情（JDK 9 移除，改用 jhsdb jmap --heap --pid）
jmap -clstats 12345                  # ★ 类加载器统计（排查元空间泄漏）
jmap -finalizerinfo 12345            # 等待 finalize 的对象
```

**自动 dump（★ 生产必配）：**

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/logs/heapdump.hprof      # 指定路径（默认是当前目录，可能没权限）
# 注意：只在「第一次」OOM 时 dump，后续 OOM 不再 dump
# 文件命名建议加时间戳（JVM 不支持，可用脚本包装）
```

### 2.5 jstack：线程快照（★ 排查 CPU 高、死锁、卡死）

```bash
jstack 12345 > /logs/thread-$(date +%H%M%S).txt
jstack -l 12345 > thread.txt        # ★ 额外输出锁的附加信息（死锁检测、持有者）
jstack -F 12345                     # 强制（进程无响应时用，可能拿不到完整信息）
jstack -m 12345                     # 混合模式（Java + native 栈）
jstack -e 12345                     # 显示线程的扩展信息

# JDK 9+ 推荐
jcmd 12345 Thread.print -l > thread.txt

# ─── 输出解读 ───
"http-nio-8080-exec-10" #45 daemon prio=5 os_prio=31 tid=0x00007f8a1c00e000 nid=0x6e03 runnable [0x000070000f5f4000]
   java.lang.Thread.State: RUNNABLE                     ← ★ 线程状态
        at java.net.SocketInputStream.socketRead0(Native Method)      ← 栈顶（正在执行的代码）
        at java.net.SocketInputStream.read(SocketInputStream.java:150)
        at com.example.Service.queryRemote(Service.java:88)           ← ★ 业务代码位置
        at com.example.Controller.handle(Controller.java:42)
        ...
        - locked <0x000000076ab62208> (a java.lang.Object)            ← 持有的锁
        - waiting to lock <0x000000076ab62300> (a java.lang.Object)    ← 等待的锁
        - parking to wait for <0x000000076ab62400> (a ...AQS$ConditionObject)

# 字段含义
# "线程名"  #编号  daemon(守护线程)  prio(优先级)  tid(Java 线程 ID)  nid(★ 本地线程 ID，16 进制)
# nid 用于和 top -H 的线程 ID 对应（把 10 进制转 16 进制）

# 线程状态的含义与排查方向
# RUNNABLE     正在运行或等待 CPU/IO → CPU 高时看这里的栈顶
# BLOCKED      等待 synchronized 锁 → 看 "waiting to lock <地址>"，找持有者
# WAITING      无限期等待 → 通常是 wait()/park()/join()，看是否该被唤醒
# TIMED_WAITING 限时等待 → sleep/带超时的 wait，一般正常
# TERMINATED   已结束

# ─── ★ 死锁会被自动检测并打印 ───
Found one Java-level deadlock:
=============================
"Thread-1":
  waiting to lock monitor 0x00007f8a1c006208 (object 0x000000076ab62208, a java.lang.Object),
  which is held by "Thread-0"
"Thread-0":
  waiting to lock monitor 0x00007f8a1c004e28 (object 0x000000076ab62300, a java.lang.Object),
  which is held by "Thread-1"

Java stack information for the threads listed above:
===================================================
"Thread-1":
        at com.example.DeadlockDemo.lambda$main$1(DeadlockDemo.java:25)
        - waiting to lock <0x000000076ab62208> (a java.lang.Object)
        - locked <0x000000076ab62300> (a java.lang.Object)
"Thread-0":
        at com.example.DeadlockDemo.lambda$main$0(DeadlockDemo.java:15)
        - waiting to lock <0x000000076ab62300> (a java.lang.Object)
        - locked <0x000000076ab62208> (a java.lang.Object)
```

**多次采样对比（定位持续热点）：**

```bash
# 间隔 10 秒抓 3~5 次，对比哪些线程「一直」在同一个栈上 → 那就是卡住/热点的地方
for i in 1 2 3 4 5; do
  jstack -l 12345 > /logs/thread-$i.txt
  sleep 10
done
# 对比工具
diff thread-1.txt thread-5.txt
# 或用脚本统计出现次数最多的栈帧
grep -A 20 'java.lang.Thread.State' thread-*.txt | grep 'at com.example' | sort | uniq -c | sort -rn | head -20
```

### 2.6 jinfo 与 jcmd

```bash
# ─── jinfo：查看/动态修改参数 ───
jinfo 12345                          # 全部信息（系统属性 + JVM 参数）
jinfo -flags 12345                   # ★ 所有 JVM 参数（含默认值）
# 输出：-XX:+UseG1GC -XX:MaxGCPauseMillis=200 -Xmx4g ...
jinfo -sysprops 12345                # System.getProperties()
jinfo -flag MaxHeapSize 12345        # 查单个参数
jinfo -flag +PrintGCDetails 12345    # ★ 动态开启参数（部分参数支持，布尔型用 +/-）
jinfo -flag MaxMetaspaceSize=512m 12345    # 动态修改（仅 manageable 类型的参数）

# 可动态修改的参数（-XX:+PrintFlagsFinal 中标记为 {manageable} 的）
# MaxHeapFreeRatio、MinHeapFreeRatio、HeapDumpAfterFullGC、PrintGC、PrintGCDetails、
# PrintClassHistogram、PrintHeapAtGC 等（大部分 GC/日志参数，内存大小类不能改）

# ─── jcmd：JDK 7+ 的综合工具（★ 官方推荐，替代 jmap/jstack/jinfo）───
jcmd                              # 列出所有 Java 进程（同 jps）
jcmd 12345 help                   # ★ 列出该进程支持的所有命令
jcmd 12345 VM.version             # JVM 版本
jcmd 12345 VM.flags               # JVM 参数
jcmd 12345 VM.command_line        # 启动命令行
jcmd 12345 VM.system_properties   # 系统属性
jcmd 12345 VM.uptime              # 运行时长
jcmd 12345 VM.native_memory summary   # ★ 本地内存统计（需启动加 -XX:NativeMemoryTracking=summary）
jcmd 12345 GC.heap_info           # ★ 堆信息（比 jmap -heap 好用）
jcmd 12345 GC.class_histogram     # 类直方图（同 jmap -histo）
jcmd 12345 GC.heap_dump /logs/heap.hprof     # 堆转储
jcmd 12345 GC.run                 # 触发 System.gc()
jcmd 12345 Thread.print           # 线程快照（同 jstack）
jcmd 12345 JFR.start duration=60s filename=/logs/rec.jfr    # ★ Java Flight Recorder 录制
jcmd 12345 JFR.dump filename=/logs/rec.jfr
jcmd 12345 PerfCounter.print      # 性能计数器
jcmd 12345 ManagementAgent.start  # 启动 JMX

# ─── NMT（Native Memory Tracking）：排查堆外内存泄漏 ───
# 启动时开启（有 5%~10% 性能开销）
-XX:NativeMemoryTracking=detail
# 运行时查看
jcmd 12345 VM.native_memory summary
# 输出（分类统计本地内存）：
# Total: reserved=6GB, committed=5GB
# -                 Java Heap (reserved=4GB, committed=4GB)
# -                     Class (reserved=1GB, committed=300MB)     ← 元空间
# -                    Thread (reserved=500MB, committed=500MB)   ← ★ 线程栈（线程数 × Xss）
# -                      Code (reserved=250MB, committed=100MB)   ← JIT 代码缓存
# -                        GC (reserved=200MB, committed=200MB)   ← GC 数据结构
# -                  Internal (reserved=50MB, committed=50MB)     ← DirectByteBuffer
# -                    Symbol (reserved=20MB, committed=20MB)
# 差值对比（找增长点）
jcmd 12345 VM.native_memory baseline          # 设置基线
# ... 运行一段时间
jcmd 12345 VM.native_memory summary.diff      # ★ 查看相对基线的增长
```

### 2.7 GC 日志与 MAT 分析流程

```bash
# ─── 步骤 1：拿到 heap dump ───
# 方式 A：OOM 自动 dump（-XX:+HeapDumpOnOutOfMemoryError）
# 方式 B：手动 jmap -dump:live,format=b,file=heap.hprof <pid>（会 STW，先摘流量）
# 方式 C：jcmd <pid> GC.heap_dump heap.hprof

# ─── 步骤 2：用 MAT（Eclipse Memory Analyzer）打开 ───
# 下载：https://eclipse.dev/mat/
# 大文件用命令行转换（避免 MAT 打开时 OOM）
# 修改 MemoryAnalyzer.ini: -Xmx8g（要大于 dump 文件大小）

# ─── 步骤 3：看 Leak Suspects Report（泄漏嫌疑报告）───
# MAT 自动分析，通常直接指出「Problem Suspect 1: 一个 xxx 占了 80% 内存」

# ─── 步骤 4：Dominator Tree（支配树）★ 最有用 ───
# 按 Retained Heap（保留堆）降序排列
# Retained Heap = 如果这个对象被回收，能释放多少内存（含它独占的所有子对象）
# Shallow Heap = 对象自身占用的内存（不含引用对象）
# ★ 找 Retained Heap 最大的那几个对象，就是泄漏嫌疑

# ─── 步骤 5：Path to GC Roots（找到谁在持有它）───
# 右键对象 → Path to GC Roots → exclude weak/soft references（排除弱软引用）
# ★ 这一步直接告诉你「泄漏的引用链」，如：
#   com.example.CacheManager (static field)
#     → java.util.HashMap
#       → com.example.OrderVO[1234567]        ← 找到了！静态缓存无限增长

# ─── 步骤 6：Histogram（直方图）───
# 按类统计实例数量和内存占用
# 右键类 → List objects → with incoming references（谁引用了它）
# 右键类 → Merge Shortest Paths to GC Roots（合并所有到 GC Roots 的路径）

# ─── 步骤 7：OQL（对象查询语言，高级）───
# 类似 SQL 查询堆中的对象
SELECT * FROM java.lang.String s WHERE s.value.length > 10000      # 找超长字符串
SELECT * FROM com.example.User u WHERE u.age > 100                 # 找异常数据
SELECT toString(s) FROM java.lang.String s WHERE s.@retainedHeapSize > 1000000

# ─── 其他分析工具 ───
# VisualVM（JDK 自带，轻量可视化）
# JProfiler / YourKit（商业，功能强）
# JXRay（在线服务，生成报告）
# heapdump 在线分析：https://heaphero.io
```

## 3. Arthas ★★★★★（线上诊断神器）

**Arthas（阿尔萨斯）是阿里开源的 Java 诊断工具，无需重启、无需修改代码，即可在线上排查问题。**

```bash
# ─── 安装与启动 ───
curl -O https://arthas.aliyun.com/arthas-boot.jar
java -jar arthas-boot.jar                    # ★ 自动列出 Java 进程，输入序号即可 attach
java -jar arthas-boot.jar 12345              # 直接指定 PID
java -jar arthas-boot.jar --target-ip 0.0.0.0 --telnet-port 9998   # 允许远程连接
# 离线安装：下载 arthas-bin.zip 解压后 ./as.sh

# Web Console：http://127.0.0.1:8563
# 退出：quit / exit（只退出客户端，Arthas 仍在目标进程）
# 完全卸载：stop / shutdown（★ 会重置所有增强的类）
```

### 3.1 核心命令

```bash
# ─── 全局概览 ───
dashboard                    # ★ 实时面板：线程、内存、GC、运行时信息（每 5 秒刷新）
version                      # Arthas 版本
help                         # 所有命令
cls                          # 清屏
session                      # 当前会话信息
keymap                       # 快捷键

# ─── 线程诊断（★ 排查 CPU 高的核心）───
thread                       # 列出所有线程（含 CPU 占用、状态）
thread -n 3                  # ★★ CPU 占用最高的 3 个线程（直接给出栈！）
thread -b                    # ★★ 找出「阻塞其他线程」的元凶（死锁/锁竞争）
thread 45                    # 查看指定线程 ID 的栈
thread --state BLOCKED       # 按状态过滤
thread -i 5000               # 采样间隔改为 5 秒（默认 100ms 采样不够准）
thread --all                 # 显示所有线程（含不在 CPU 上的）

# ─── JVM 信息 ───
jvm                          # JVM 详细信息（内存、GC、线程、类加载、编译）
sysprop                      # System.getProperties()
sysprop user.timezone Asia/Shanghai    # ★ 动态修改系统属性！
sysenv                       # 环境变量
vmoption                     # 可动态修改的 JVM 参数
vmoption PrintGC true        # ★ 动态开启 GC 打印
vmtool --action getInstances --className com.example.CacheManager --limit 10   # ★ 获取堆中实例！
memory                       # 各内存区域使用量（heap/nonheap/direct/mapped）
perfcounter                  # 性能计数器

# ─── 类与方法（★ 排查「代码为什么不是我想的那样」）───
sc -d com.example.UserService              # ★ 查看类的详细信息（ClassLoader、位置、是否被增强）
sc -d -f com.example.UserService           # 含字段信息
sc *UserService                            # 通配符搜索类
sm com.example.UserService                 # 查看类的所有方法
sm -d com.example.UserService getUser      # 方法详情（参数、注解、修饰符）
jad com.example.UserService                # ★★ 反编译！查看线上真实运行的代码
jad --source-only com.example.UserService > /tmp/UserService.java   # 只输出源码（可保存后修改）
classloader                                # 类加载器统计（排查元空间泄漏）
classloader -t                             # 树形展示
classloader -c <hash> -r com/example/x.properties   # 用指定加载器查找资源
dump -d /tmp/dump com.example.UserService   # 把已加载的类 dump 到磁盘
mc /tmp/UserService.java -d /tmp            # ★ 内存编译 .java → .class
retransform /tmp/UserService.class          # ★★ 热替换！不重启修改线上代码（临时生效）
redefine /tmp/UserService.class             # 同上（旧命令，retransform 更好）

# ─── 方法执行观测（★★★ 最强大的功能）───
# watch：观察方法的入参、返回值、异常、this
watch com.example.UserService getUser '{params, returnObj, throwExp}' -n 5 -x 3
#                                        ↑ 观察表达式            ↑次数 ↑对象展开深度
watch com.example.UserService getUser '{params[0], returnObj.name}' 'params[0] > 100' -x 2
#                                                            ↑ ★ 条件过滤（只看 id > 100 的调用）
watch com.example.UserService getUser '{params, returnObj}' -b        # ★ before：方法调用前
watch com.example.UserService getUser '{params, returnObj}' -s        # after-return：正常返回后
watch com.example.UserService getUser '{params, throwExp}' -e         # after-throw：抛异常后
watch com.example.UserService getUser '{params, returnObj}' -f        # after：结束后（默认）
watch com.example.UserService getUser '#cost' '#cost > 500' -n 10     # ★ 只看耗时 > 500ms 的调用

# trace：★ 方法内部调用链路 + 每步耗时（定位慢在哪一行）
trace com.example.UserService getUser
# 输出：
# `---ts=2026-09-07 10:30:45;thread_name=http-nio-8080-exec-1;
#     `---[523.456ms] com.example.UserService:getUser()
#         +---[2.345ms] com.example.CacheManager:get() #45
#         +---[510.123ms] com.example.UserMapper:selectById() #48    ← ★ 找到瓶颈！
#         `---[5.678ms] com.example.UserConverter:toVO() #50

trace com.example.UserService getUser '#cost > 1000'          # 只追踪耗时 > 1 秒的
trace com.example.UserService getUser --skipJDKMethod false    # 包含 JDK 方法
trace -E com.example.*Service get.*                            # 正则匹配多个类/方法
trace com.example.UserService getUser -n 5                     # 只追踪 5 次

# stack：★ 查看方法被谁调用的（调用栈，排查「这个方法是哪里调的」）
stack com.example.UserMapper selectById
stack com.example.UserMapper selectById 'params[0] == 1001' -n 3    # 带条件

# monitor：方法执行统计（每 5 秒汇总：调用次数、成功/失败、平均耗时、失败率）
monitor -c 5 com.example.UserService getUser
#  timestamp            class                    method   total  success  fail  avg-rt(ms)  fail-rate
#  2026-09-07 10:30:45  c.e.UserService          getUser  1234   1230     4     23.45       0.32%

# tt（TimeTunnel）：★ 记录方法调用的完整现场，事后回放
tt -t com.example.UserService getUser                    # 开始记录
tt -l                                                     # 列出所有记录
tt -i 1000                                                # 查看第 1000 次调用的详情（入参、返回、异常、耗时）
tt -i 1000 -p                                             # ★ 重放这次调用（用相同的入参再调一次）
tt -i 1000 -p --replay-times 3 --replay-interval 1000      # 重放 3 次，间隔 1 秒
tt -s 'params[0] == 1001'                                  # 按条件搜索记录
tt --delete-all                                            # 清空记录

# ─── 性能剖析 ───
profiler start                           # ★ 开始采样（async-profiler，默认 CPU）
profiler start --event alloc             # 内存分配采样（排查内存热点）
profiler start --event lock              # 锁竞争采样
profiler status                          # 查看状态
profiler stop --format html --file /tmp/flame.html    # ★★ 生成火焰图！
profiler dump                            # 导出原始数据
# 火焰图解读：横轴是采样占比（越宽 = 越耗时），纵轴是调用栈（越深 = 调用层次越多）
#            ★ 找「平顶山」：宽度大且顶部平的栈帧就是热点

# ─── 其他实用命令 ───
options                                  # 查看/修改 Arthas 行为
options unsafe true                      # ★ 允许增强 JDK 核心类（慎用）
logger                                   # 查看/修改日志级别
logger --name com.example --level debug  # ★★ 动态修改日志级别（不重启！排查线上问题神器）
logger --name ROOT --level info          # 排查完记得改回去
ognl '@java.lang.System@getProperty("user.dir")'      # 执行 OGNL 表达式
ognl '@com.example.SpringContextHolder@getBean("userService").getUser(1L)'   # ★ 直接调用 Spring Bean！
ognl -c <classLoaderHash> '@com.example.Config@INSTANCE.getField()'
heapdump /logs/heap.hprof                # 生成堆转储
heapdump --live /logs/live.hprof         # 只 dump 存活对象
reset                                    # ★ 重置所有被增强的类（排查完必做）
quit / exit                              # 退出客户端
stop / shutdown                          # 完全关闭 Arthas
```

### 3.2 Arthas 使用注意事项

| 注意点 | 说明 |
| --- | --- |
| **性能影响** | `watch`/`trace`/`tt`/`monitor` 会**增强字节码**，有性能开销。**生产环境用 `-n` 限制次数**，用完 `reset` |
| **`tt` 内存占用** | tt 会保存每次调用的入参/返回值引用，**长时间记录会 OOM**！用完 `tt --delete-all` |
| **`retransform` 的限制** | 不能增删字段/方法（只能改方法体）、重启后失效、与 JIT 优化冲突 |
| **`profiler` 的开销** | async-profiler 开销很低（< 1%），可长时间运行；但仍建议按需 |
| **权限** | attach 需要同用户或 root；容器内要在同一 PID namespace |
| **用完必须 reset** | `reset` 恢复所有增强的类，`stop` 完全卸载 Arthas |
| **不要在高峰期做重操作** | `heapdump`、`jad` 大量类、`profiler` 长时间采样 |
| **安全性** | Arthas 能执行任意代码（ognl）、修改代码（retransform），**生产环境要严格控制访问权限**，用完立即 stop |

## 4. 六大典型线上问题排查 ★★★★★

### 4.1 CPU 飙高（100%）

```bash
# ─── 标准流程（不用 Arthas 的版本，面试必背）───

# 步骤 1：找到 CPU 高的 Java 进程
top                              # 按 P 排序，找到 %CPU 最高的进程 PID
top -c                           # 显示完整命令行
# 或 ps aux | grep java | sort -k3 -rn | head

# 步骤 2：找到该进程中 CPU 最高的【线程】
top -H -p 12345                  # ★ -H 显示线程级别（Linux）
# macOS: 用 jstack 或 VisualVM（top -H 不支持）
# 记下 CPU 最高的线程 ID（PID/TID），如 12378

# 步骤 3：把线程 ID 转成 16 进制（jstack 中 nid 是 16 进制）
printf "%x\n" 12378              # → 305a
# 或 echo "obase=16;12378" | bc

# 步骤 4：导出线程栈，搜索这个 nid
jstack 12345 > /logs/thread.txt
grep -A 30 'nid=0x305a' /logs/thread.txt
# 输出：
# "http-nio-8080-exec-5" #38 daemon prio=5 tid=0x00007f... nid=0x305a runnable
#    java.lang.Thread.State: RUNNABLE
#         at com.example.Service.calcHash(Service.java:88)      ← ★ 找到问题代码！
#         at com.example.Controller.handle(Controller.java:42)

# ─── 用 Arthas（★ 更快，一步到位）───
thread -n 3                      # 直接给出 CPU 最高的 3 个线程及其栈
thread -b                        # 如果是锁竞争导致的 CPU 高，找阻塞源

# ─── 用 async-profiler 生成火焰图（★ 最直观）───
profiler start
# 等待 30~60 秒
profiler stop --format html --file /tmp/cpu-flame.html
# 打开火焰图，最宽的平顶就是热点

# ─── CPU 高的常见原因 ───
```

| 原因 | 特征 | 排查 |
| --- | --- | --- |
| **死循环 / 无限递归** | 某线程栈一直在同一段业务代码 | jstack 多次采样对比 |
| **频繁 GC**（尤其是 Full GC） | CPU 高的是 `GC task thread` / `G1 Conc` 线程 | `jstat -gcutil` 看 FGC 次数和耗时 |
| **正则回溯（灾难性回溯）** | 栈顶是 `java.util.regex.Pattern$...` | 检查正则表达式，避免嵌套量词 `(a+)+` |
| **大量序列化/反序列化** | 栈顶是 Jackson/Fastjson/Hessian | 减少对象大小、用 Protobuf |
| **锁竞争激烈（自旋）** | 大量线程 BLOCKED，或 CAS 自旋 | jstack 看 BLOCKED 数量、`thread -b` |
| **JSON 解析超大对象** | 栈顶是 JSON 解析 | 流式解析、分页 |
| **加密/压缩计算** | 栈顶是 crypto/zip | 异步化、缓存结果 |
| **JDK NIO 的 epoll bug** | 栈顶是 `sun.nio.ch.EPollArrayWrapper.epollWait` | 升级 JDK 或用 Netty |
| **代码热点（正常业务）** | 火焰图显示业务方法 | 优化算法、加缓存 |

```java
// ─── 典型案例 1：正则灾难性回溯 ───
// ❌ 危险正则：嵌套量词 + 回溯爆炸
Pattern p = Pattern.compile("(a+)+b");
p.matcher("aaaaaaaaaaaaaaaaaaaaaaaaaaaa").matches();   // ★ 输入不匹配时会指数级回溯，CPU 100%
// 原因：(a+)+ 有多种分组方式，匹配失败时穷举所有可能 → 2^n 复杂度
// ✅ 修复：
Pattern p1 = Pattern.compile("a+b");                    // 消除嵌套量词
Pattern p2 = Pattern.compile("(?>a+)b");                 // 原子组（不回溯）
// 或设置超时：用线程池执行 + Future.get(timeout)

// ─── 典型案例 2：HashMap 并发导致 CPU 100%（JDK 7）───
// 多线程 put 导致链表成环，get 时死循环
// 栈顶：java.util.HashMap.getEntry / HashMap$Entry
// ✅ 修复：改用 ConcurrentHashMap（详见 [[后端/Java基础/集合框架-Map与源码剖析]]）

// ─── 典型案例 3：Full GC 频繁导致 CPU 高 ───
// jstat -gcutil 看到 FGC 每秒几次，每次几秒
// GC 线程占满 CPU（top -H 显示 "GC task thread#0" 占用高）
// ✅ 排查：jmap -histo 看大对象 → dump 用 MAT 分析泄漏
```

### 4.2 内存泄漏 / OOM

```bash
# ─── 判断是哪种 OOM（错误信息就是关键线索）───
# OutOfMemoryError: Java heap space          → 堆内存不足（泄漏 or 堆太小 or 大对象）
# OutOfMemoryError: GC overhead limit exceeded → GC 花 98% 时间只回收 2%（严重泄漏）
# OutOfMemoryError: Metaspace                 → 类元数据过多（动态生成类、ClassLoader 泄漏）
# OutOfMemoryError: unable to create new native thread → 线程数超限
# OutOfMemoryError: Direct buffer memory       → 堆外内存（NIO/Netty）
# StackOverflowError                          → 递归过深（不是 OOM，但常一起出现）

# ─── 堆内存泄漏排查流程 ───
# 步骤 1：确认是泄漏还是「真的不够用」
jstat -gcutil 12345 5000
# ★ 关键判断：多次 Full GC 后，O（老年代）使用率是否下降？
#   - 下降后很快又涨满 → 分配速率过高（不是泄漏，是容量/流量问题）
#   - Full GC 后仍不下降（如从 90% 降到 88%）→ ★ 内存泄漏！

# 步骤 2：看对象分布（轻量，先做）
jmap -histo:live 12345 | head -30
# 关注：业务对象（com.example.*）的实例数是否异常多
#      [B（byte数组）、[C（char数组）、String、HashMap$Node 是否异常

# 步骤 3：dump 堆（★ 必须先摘流量，会 STW 数十秒）
# 摘流量：K8s readiness 探针失败 / Nginx 下线 / 注册中心反注册
jmap -dump:live,format=b,file=/logs/heap.hprof 12345
# 或 jcmd 12345 GC.heap_dump /logs/heap.hprof

# 步骤 4：MAT 分析
# ① Leak Suspects Report（自动报告）
# ② Dominator Tree → 按 Retained Heap 排序，看最大的对象
# ③ 右键大对象 → Path to GC Roots → exclude weak/soft references
#    ★ 找到「谁在持有它不放」——这就是泄漏点
# ④ Histogram → 按类看实例数 → Merge Shortest Paths to GC Roots

# ─── 常见泄漏点（按发生频率排序）───
```

| # | 泄漏场景 | 表现 | 解决 |
| --- | --- | --- | --- |
| 1 | **静态集合无限增长** | `static Map/List` 的 Retained Heap 巨大 | 加淘汰策略（Caffeine）、定期清理 |
| 2 | **ThreadLocal 未 remove** | `ThreadLocalMap$Entry` 数量 = 线程数 × N | `finally &#123; remove(); &#125;` |
| 3 | **缓存无过期/无上限** | 缓存 Map 巨大 | Caffeine + maximumSize + expireAfter |
| 4 | **未关闭的资源** | Connection/InputStream/Socket 实例多 | try-with-resources；连接池配 maxLifetime |
| 5 | **监听器/回调未注销** | Listener 列表巨大 | 生命周期结束时 unregister |
| 6 | **内部类持有外部类** | 匿名内部类的 `this$0` 指向大对象 | 改 static 内部类 |
| 7 | **ClassLoader 泄漏**（热部署） | **Metaspace OOM**，`classloader` 实例多 | 清理 TCCL/JDBC/hook/Timer；`jmap -clstats` |
| 8 | **字符串拼接产生的大对象** | `char[]`/`byte[]` 巨大 | 流式处理，避免一次性读大文件 |
| 9 | **大 SQL 查询结果集** | 一次查百万行到 List | 分页、流式查询（MyBatis Cursor）、限制条数 |
| 10 | **Excel/文件导出全加载内存** | `byte[]` 巨大 | EasyExcel 流式写、分批查询 |
| 11 | **Netty ByteBuf 未 release** | Direct memory OOM | 引用计数 release；`-Dio.netty.leakDetection.level=PARANOID` |
| 12 | **日志框架异步队列积压** | Logback `AsyncAppender` 队列巨大 | 设置 discardingThreshold、queueSize |
| 13 | **定时任务累积** | `ScheduledThreadPoolExecutor` 队列巨大 | 检查任务是否执行慢于调度间隔 |
| 14 | **JSON 解析大报文** | 单次请求体几十 MB | 限制请求体大小（Nginx、Spring `max-http-form-post-size`） |

```java
// ─── 典型案例：ThreadLocal + 线程池 导致的泄漏 + 数据串号 ───
// 现象：内存缓慢增长；偶发用户 A 看到用户 B 的数据
private static final ThreadLocal<UserContext> CTX = new ThreadLocal<>();

public void handle(Request req) {
    CTX.set(parseUser(req));         // ★ 只 set 不 remove
    doBusiness();
    // 方法结束，CTX 中的 UserContext 仍被线程持有
    // 线程池线程不销毁 → UserContext 永不回收 → 泄漏
    // 下一个请求如果某个分支忘记 set → 读到上一个请求的用户 → ★ 数据串号（越权！）
}

// ✅ 修复
public void handle(Request req) {
    try {
        CTX.set(parseUser(req));
        doBusiness();
    } finally {
        CTX.remove();                // ★ 必须 remove
    }
}

// ─── 典型案例：静态缓存无限增长 ───
private static final Map<String, Object> CACHE = new ConcurrentHashMap<>();
public Object get(String key) {
    return CACHE.computeIfAbsent(key, this::loadFromDb);     // ★ 只增不减
}
// ✅ 修复：用 Caffeine
private final Cache<String, Object> cache = Caffeine.newBuilder()
        .maximumSize(10_000)                                  // ★ 容量上限
        .expireAfterWrite(10, TimeUnit.MINUTES)               // ★ 过期淘汰
        .recordStats()                                        // 命中率监控
        .build();

// ─── 典型案例：大结果集查询 ───
List<Order> all = orderMapper.selectAll();     // ❌ 一次查 500 万行 → 堆瞬间打满
// ✅ 分页
for (int page = 1; ; page++) {
    List<Order> batch = orderMapper.selectPage(page, 1000);
    if (batch.isEmpty()) break;
    process(batch);
}
// ✅ MyBatis 流式查询（Cursor，不占内存）
try (Cursor<Order> cursor = orderMapper.streamAll()) {
    cursor.forEach(this::process);
}
// SQL 层面限制：SELECT ... LIMIT，且必须带 WHERE 条件

// ─── Metaspace 泄漏排查 ───
jstat -class 12345 1000        # 看 Loaded 类数是否持续增长
jmap -clstats 12345            # 看有多少 ClassLoader 实例（正常应该很少）
# 常见原因：
# 1. CGLIB/ByteBuddy 每次调用都生成新类（Enhancer.setUseCache(false)）
# 2. Groovy/JS 脚本引擎每次 eval 都生成新类
# 3. 频繁热部署（Tomcat redeploy）导致 ClassLoader 泄漏
# 4. Fastjson 的 ASM 序列化器（每个类生成一个，正常；但如果类是动态生成的就无限增长）
# 5. 反射大量调用导致 GeneratedMethodAccessor 类膨胀
#    （JDK 的反射优化：调用超过 15 次（inflationThreshold）就生成字节码类）
#    -Dsun.reflect.inflationThreshold=2147483647 可禁用（改回纯 native 反射）
# ✅ 修复：开启缓存、增大 MaxMetaspaceSize、避免动态类无限生成
```

### 4.3 接口响应慢 / 卡顿

```bash
# ─── 排查思路：分层定位（自上而下）───
# ① 是全部接口慢还是个别接口慢？
#    全部慢 → 系统级问题（GC、CPU、DB、网络）
#    个别慢 → 代码级问题（慢 SQL、慢 RPC、锁）
# ② 是持续慢还是偶发慢？
#    持续 → 稳定瓶颈
#    偶发（毛刺）→ GC 停顿、锁竞争、网络抖动、缓存击穿
# ③ 慢在哪一层？
#    网关 → 应用 → DB/缓存/RPC，逐层看耗时

# ─── 工具与手段 ───
# 1. 链路追踪（★ 首选，一眼看出慢在哪一跳）
#    SkyWalking / Zipkin / Jaeger / Arms
#    看 Trace 瀑布图，找到耗时最长的 span

# 2. Arthas trace（★ 单方法内部耗时分解）
trace com.example.OrderService createOrder '#cost > 1000'
# 输出会显示每个内部方法调用的耗时，直接定位瓶颈行

# 3. 慢 SQL 日志
# MySQL: slow_query_log = ON, long_query_time = 1
# 分析：mysqlowlog / pt-query-digest
# 应用层：Druid 监控（/druid/sql.html）、p6spy（打印真实 SQL 和耗时）

# 4. GC 停顿（毛刺的常见原因）
-Xlog:gc*,safepoint:file=/logs/gc.log:time,uptime
# 关联业务日志的时间戳，看接口超时是否与 GC 停顿重合

# 5. 线程池排队
# 检查线程池的 queue.size()，如果任务在队列中等了很久 → 线程数不够或任务太慢
# Actuator: /actuator/metrics/executor.queued

# 6. 锁竞争
thread -b                        # Arthas 找阻塞源
jstack | grep -c BLOCKED         # BLOCKED 线程数量
```

| 慢的原因 | 定位手段 | 解决 |
| --- | --- | --- |
| **慢 SQL**（无索引、大表扫描） | 慢查询日志、Druid、EXPLAIN | 加索引、优化 SQL、分页、分库分表 |
| **N+1 查询** | 日志中 SQL 数量异常多 | 批量查询 + Map 组装、MyBatis 关联查询 |
| **RPC/HTTP 调用慢** | 链路追踪、trace | 超时设置、并行调用（CompletableFuture）、缓存、熔断降级 |
| **锁竞争** | jstack 的 BLOCKED、`thread -b` | 缩小临界区、分段锁、无锁化（CAS）、读写锁 |
| **线程池排队** | queue.size() 监控 | 扩容线程、优化任务耗时、拆分池 |
| **GC 停顿** | GC 日志与业务日志时间对齐 | 换 G1/ZGC、减小新生代、修内存泄漏 |
| **缓存击穿/雪崩** | 缓存命中率监控 | 互斥锁、随机 TTL、多级缓存 |
| **日志同步写入** | trace 到 log 方法耗时高 | 异步日志（AsyncAppender）、降低日志级别 |
| **序列化大对象** | trace 到 Jackson/Fastjson | 精简 DTO、按需返回字段 |
| **网络抖动/DNS** | tcpdump、DNS 查询耗时 | DNS 缓存、连接池、重试 |
| **磁盘 IO 慢** | `iostat -x 1`、`iotop` | SSD、异步刷盘、减少日志量 |
| **同步转异步未做** | 代码审查 | MQ 解耦、@Async |

```java
// ─── 典型案例：N+1 查询 ───
// ❌ 查询 100 个订单，每个订单再查一次用户 → 1 + 100 次 SQL
List<Order> orders = orderMapper.selectByUserId(userId);
for (Order order : orders) {
    User user = userMapper.selectById(order.getUserId());     // ★ 循环内查询
    order.setUserName(user.getName());
}

// ✅ 批量查询 + Map 组装（2 次 SQL）
List<Order> orders = orderMapper.selectByUserId(userId);
Set<Long> userIds = orders.stream().map(Order::getUserId).collect(Collectors.toSet());
Map<Long, User> userMap = userMapper.selectBatchIds(userIds).stream()
        .collect(Collectors.toMap(User::getId, Function.identity()));
orders.forEach(o -> o.setUserName(userMap.get(o.getUserId()).getName()));

// ✅ MyBatis 的关联查询（一条 SQL 搞定，用 resultMap 的 association）
// ✅ MyBatis-Plus 的 @TableField(exist = false) + 手动组装
```

### 4.4 死锁

```bash
# ─── 数据库死锁 ───
# MySQL
SHOW ENGINE INNODB STATUS\G          # LATEST DETECTED DEADLOCK 段落
# 关键信息：两个事务各持有什么锁、各在等待什么锁、被回滚的是哪个
SET GLOBAL innodb_print_all_deadlocks = ON;    # ★ 把所有死锁记录到 error log
# 应用层：捕获 DeadlockLoserDataAccessException 并重试（按固定顺序加锁 + 重试）

# ─── Java 线程死锁 ───
jstack -l 12345 | grep -A 40 'Found one Java-level deadlock'
# ★ jstack 会自动检测并打印死锁！
thread -b                            # Arthas 一步定位阻塞源

# 代码检测（ManagementFactory）
ThreadMXBean bean = ManagementFactory.getThreadMXBean();
long[] deadlockedIds = bean.findDeadlockedThreads();       // 返回死锁线程 ID 数组
if (deadlockedIds != null) {
    ThreadInfo[] infos = bean.getThreadInfo(deadlockedIds, true, true);
    for (ThreadInfo info : infos) {
        log.error("死锁线程：{}，等待锁：{}，持有者：{}",
                info.getThreadName(),
                info.getLockName(),
                info.getLockOwnerName());
    }
}
# 预防见 [[后端/Java基础/并发编程/线程安全与synchronized]] 第 6.3 节
```

### 4.5 应用启动慢

```bash
# ─── 定位启动耗时 ───
# 1. Spring Boot 的启动耗时分析
-Ddebug                              # 打印自动配置报告
# Spring Boot 2.4+ 内置的启动追踪
spring.main.log-startup-info=true
# ApplicationStartup（Spring 5.3+，细粒度启动步骤追踪）
SpringApplication app = new SpringApplication(Main.class);
app.setApplicationStartup(new BufferingApplicationStartup(4096));
app.run(args);
# 导出为 JSON，用 https://start.spring.io/actuator/startup 可视化

# 2. JVM 层面
-XX:+TraceClassLoading               # 打印加载的每个类（JDK 17 用 -Xlog:class+load=info）
-Xlog:class+load=info:file=/logs/classload.log
-verbose:class                       # 同上
-XX:+PrintCompilation                # JIT 编译

# ─── 启动慢的常见原因与优化 ───
```

| 原因 | 优化 |
| --- | --- |
| 组件扫描范围过大 | `@ComponentScan` 缩小 basePackages；避免扫到无关包 |
| 自动配置过多 | 排除不用的：`@SpringBootApplication(exclude = &#123;...&#125;)` |
| 数据库连接池初始化慢 | `minimum-idle` 调小、异步预热、连接池懒初始化 |
| Bean 太多且都饿汉式加载 | `@Lazy` 延迟非关键 Bean；`spring.main.lazy-initialization=true`（全局懒加载，注意首次请求变慢） |
| 类加载多（大 jar） | 精简依赖；AppCDS（类数据共享） |
| JIT 未预热 | **AppCDS**、**GraalVM Native Image**（AOT，毫秒级启动）、CDS 归档 |
| 启动时加载大量缓存/字典 | 异步预热、启动后再加载 |
| 日志框架初始化慢 | 检查 logback 配置（如启动时扫描所有 jar 的 logback.xml） |

```bash
# ─── AppCDS（Application Class Data Sharing）★ 启动提速 20%~50% ───
# 步骤 1：生成类列表
java -XX:DumpLoadedClassList=/logs/app.classlist -jar app.jar
# （让应用完整启动一次并跑一遍主要流程，然后停止）

# 步骤 2：创建共享归档
java -Xshare:dump -XX:SharedClassListFile=/logs/app.classlist \
     -XX:SharedArchiveFile=/logs/app.jsa -jar app.jar

# 步骤 3：使用归档启动
java -Xshare:on -XX:SharedArchiveFile=/logs/app.jsa -jar app.jar
# ★ 类元数据直接从归档 mmap，跳过解析和验证 → 启动快、内存省

# Spring Boot 3.3+ 原生支持（训练运行）
java -Dspring.context.exit=onRefresh -jar app.jar      # 训练模式，生成 reachability 数据
# 详见 Spring Boot 文档的 CDS 支持

# ─── GraalVM Native Image（启动 < 100ms，内存 < 100MB）───
# Spring Boot 3 原生支持
mvn -Pnative native:compile -DskipTests
./target/myapp                        # ★ 直接是可执行文件，无需 JVM
# 代价：构建慢（几分钟）、反射/动态代理需配置、峰值性能略低、不支持动态类加载
# 适用：Serverless、CLI、启动敏感的场景
```

### 4.6 容器环境（K8s/Docker）的 JVM 问题

```bash
# ─── 问题 1：容器被 OOMKilled（Exit Code 137）但 JVM 没有 OOM 日志 ───
# 原因：容器的内存限制是「整个进程」的（含堆 + 元空间 + 线程栈 + 直接内存 + JIT 代码 + native 库），
#      而 -Xmx 只限制堆！堆没满但总内存超限 → 被 cgroup 杀掉（内核 OOM Killer，无 JVM 日志）

# ✅ 正确配置：堆只占容器内存的 60%~75%
# 容器 4GB → -Xmx 最多 3GB，留 1GB 给其他
-XX:MaxRAMPercentage=70.0            # ★ 推荐（自动按容器内存百分比）
-XX:InitialRAMPercentage=70.0
# 或用绝对值
-Xms3g -Xmx3g

# 排查：开启 NMT 看各部分占用
-XX:NativeMemoryTracking=summary
jcmd <pid> VM.native_memory summary
# 关注：Java Heap / Class(Metaspace) / Thread / Code / GC / Internal(DirectBuffer)

# 容器内存查看
cat /sys/fs/cgroup/memory.max                 # cgroup v2 的内存上限
cat /sys/fs/cgroup/memory/memory.limit_in_bytes   # cgroup v1
cat /sys/fs/cgroup/memory.current             # 当前使用

# ─── 问题 2：JDK 8 老版本识别不到容器的 CPU/内存限制 ───
# JDK 8u191 之前：availableProcessors() 返回宿主机核数（如 64），
#   → 线程池、GC 线程数都按 64 核配置 → 在 2 核容器中疯狂上下文切换，性能极差
# ✅ 解决：
#   1. 升级 JDK（8u191+ / 10+），默认 -XX:+UseContainerSupport
#   2. 老版本显式加：-XX:+UnlockExperimentalVMOptions -XX:+UseCGroupMemoryLimitForHeap
#   3. 或手动指定核数：-XX:ActiveProcessorCount=2

# ─── 问题 3：JVM 优雅停机（K8s 滚动更新时不丢请求）───
# 完整流程：
# ① K8s 发 SIGTERM → ② 从注册中心/负载均衡摘除（readiness 探针失败）
# ③ 等待进行中的请求处理完 → ④ 关闭线程池/连接池 → ⑤ JVM 退出

# Spring Boot 2.3+ 内置优雅停机
server:
  shutdown: graceful                  # ★ 优雅停机
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s    # 最多等 30 秒

# K8s 配置（配合）
spec:
  terminationGracePeriodSeconds: 60    # ★ 必须大于应用的停机超时
  containers:
    - lifecycle:
        preStop:                        # ★ 摘流量后等一会，让上游感知
          exec:
            command: ["sh", "-c", "sleep 10"]

# 代码层面的 shutdown hook
@PreDestroy
public void onShutdown() {
    log.info("开始优雅停机...");
    registry.deregister();                                   // ① 从注册中心下线
    threadPool.shutdown();                                   // ② 停止接收新任务
    if (!threadPool.awaitTermination(30, TimeUnit.SECONDS)) { // ③ 等待完成
        threadPool.shutdownNow();
    }
    dataSource.close();                                      // ④ 关闭连接池
    log.info("优雅停机完成");
}

# ⚠️ SIGKILL（kill -9）不会触发任何 hook → 数据可能丢失
# ⚠️ Docker 默认 10 秒后 SIGKILL（--stop-timeout 可改）
```

## 5. JVM 调优实战套路

### 5.1 通用调优步骤

```
① 明确目标（延迟？吞吐？内存？）+ 量化指标（P99 < 200ms，GC 时间占比 < 5%）
        ↓
② 监控基线（先有数据才能谈优化）
   - GC 日志（必开）
   - Prometheus + Grafana（jvm_gc_pause、jvm_memory_used、jvm_threads）
   - 应用指标（QPS、P99、错误率）
        ↓
③ 定位瓶颈
   - jstat 看 GC 频率和耗时
   - 火焰图看 CPU 热点
   - MAT 看内存大户
   - 链路追踪看慢调用
        ↓
④ 优化（先代码/SQL，后 JVM 参数）
        ↓
⑤ 压测验证（必须！参数改动要压测，不能直接上生产）
        ↓
⑥ 灰度发布 + 持续观察
        ↓
⑦ 记录与固化（写入部署文档）
```

### 5.2 典型场景的参数配置

```bash
# ─── 场景 1：4C8G 的 Web 服务（JDK 17 + G1，追求低延迟）───
-XX:+UseContainerSupport
-XX:InitialRAMPercentage=70.0 -XX:MaxRAMPercentage=70.0
-XX:MaxMetaspaceSize=256m -XX:MetaspaceSize=256m       # 设为相同，避免动态扩容触发 Full GC
-XX:MaxDirectMemorySize=512m
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:InitiatingHeapOccupancyPercent=45
-XX:G1ReservePercent=15                                 # 预留空间防 to-space exhausted
-XX:+ParallelRefProcEnabled                             # 并行处理引用（软/弱/虚引用多时有效）
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/
-XX:+ExitOnOutOfMemoryError                             # ★ OOM 直接退出，让 K8s 重启
-Xlog:gc*,safepoint:file=/logs/gc.log:time,uptime,level,tags:filecount=5,filesize=20m

# ─── 场景 2：8C16G 的高并发网关（JDK 21 + 分代 ZGC，追求极低延迟）───
-XX:+UseZGC -XX:+ZGenerational                          # JDK 21 分代 ZGC
-XX:MaxRAMPercentage=75.0
-XX:SoftMaxHeapSize=10g                                 # 软上限，ZGC 会努力控制在此之下
-XX:+UseLargePages -XX:+UseTransparentHugePages          # 大页内存（减少 TLB miss，需 OS 配置）
-XX:ConcGCThreads=4
-Xlog:gc*,safepoint:file=/logs/gc.log:time,uptime:filecount=5,filesize=20m

# ─── 场景 3：JDK 8 的存量服务（4C8G，Parallel → G1 迁移）───
# 原配置（JDK 8 默认 Parallel）：吞吐优先，但 Full GC 停顿 2~5 秒
# 改为 G1：
-Xms6g -Xmx6g                                          # 堆大一些（G1 需要空间做复制）
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:G1HeapRegionSize=8m                                 # 大对象多时调大（减少 Humongous）
-XX:InitiatingHeapOccupancyPercent=45
-XX:MetaspaceSize=256m -XX:MaxMetaspaceSize=256m
-XX:+ParallelRefProcEnabled
-XX:+PrintGCDetails -XX:+PrintGCDateStamps -XX:+PrintTenuringDistribution
-Xloggc:/logs/gc-%t.log -XX:+UseGCLogFileRotation -XX:NumberOfGCLogFiles=5 -XX:GCLogFileSize=20M
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/logs/

# ─── 场景 4：后台批处理（吞吐优先，不在意延迟）───
-Xms4g -Xmx4g -Xmn2g                                    # 大新生代（减少晋升，提高吞吐）
-XX:+UseParallelGC
-XX:GCTimeRatio=19                                      # 允许 GC 占 5% 时间（默认 99 = 1%）
-XX:+UseAdaptiveSizePolicy                              # 让 JVM 自适应调整
-XX:MaxTenuringThreshold=15

# ─── 场景 5：消息消费服务（大量短命对象，YGC 频繁）───
-Xms4g -Xmx4g
-XX:+UseG1GC
-XX:G1NewSizePercent=40 -XX:G1MaxNewSizePercent=60       # ★ 加大新生代（短命对象多）
-XX:MaxGCPauseMillis=100
-XX:+ParallelRefProcEnabled
```

### 5.3 常见调优误区

| # | 误区 | 正确做法 |
| --- | --- | --- |
| 1 | 一上来就调 JVM 参数 | 先优化代码、SQL、架构（收益大 10 倍） |
| 2 | `-Xms` 与 `-Xmx` 设不同 | 生产环境设相同（避免动态扩缩容的停顿和碎片） |
| 3 | 堆设成容器内存的 100% | 只设 60%~75%（要给元空间、栈、堆外留余量） |
| 4 | 堆设 31~40GB | ≤31GB（保压缩指针）或 ≥48GB |
| 5 | `MaxGCPauseMillis` 设得很小（如 20ms） | 不低于 100ms（太小会导致新生代过小，YGC 频繁） |
| 6 | 盲目追求「零 Full GC」 | Full GC 少即可；关键是停顿时间不影响业务 |
| 7 | 调参不压测直接上线 | 必须压测验证（参数改错可能更糟） |
| 8 | 一次改多个参数 | 一次改一个，观察效果（否则无法归因） |
| 9 | 用 `-XX:+DisableExplicitGC` 后堆外泄漏 | 改 `-XX:+ExplicitGCInvokesConcurrent`（RMI/NIO 需要 System.gc 回收堆外） |
| 10 | MetaspaceSize 与 MaxMetaspaceSize 差距大 | 设成相同（避免动态扩容触发 Full GC） |
| 11 | 不开 GC 日志 | 必开（出事才有现场） |
| 12 | 不开 HeapDumpOnOutOfMemoryError | 必开 |
| 13 | 追求「最新的 GC」 | 选「适合的」（小堆用 Parallel，大堆低延迟用 ZGC） |
| 14 | 忽视 GC 线程数与容器 CPU 限制 | 显式设 `ParallelGCThreads`/`ConcGCThreads` |
| 15 | 把「内存使用率高」当问题 | JVM 的设计就是「尽量用满堆」，高使用率正常；看的是 GC 后能否降下来 |

## 6. 监控体系（生产标配）

```yaml
# Spring Boot Actuator + Micrometer + Prometheus + Grafana
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus,threaddump,heapdump,loggers
  metrics:
    tags:
      application: ${spring.application.name}
    export:
      prometheus:
        enabled: true
  endpoint:
    health:
      show-details: always
    loggers:
      enabled: true            # ★ 支持动态修改日志级别（POST /actuator/loggers/{name}）
```

```bash
# 关键 JVM 指标（Prometheus 指标名）
jvm_memory_used_bytes{area="heap"}           # 堆使用量
jvm_memory_max_bytes{area="heap"}            # 堆最大值
jvm_memory_used_bytes{area="nonheap"}        # 元空间等
jvm_gc_pause_seconds{action="end of minor GC"}  # ★ GC 停顿时间（ histogram，能算 P99）
jvm_gc_pause_seconds_count                    # GC 次数
jvm_gc_memory_allocated_bytes_total           # 分配总量（算分配速率）
jvm_gc_memory_promoted_bytes_total            # 晋升到老年代的量
jvm_threads_live_threads                      # 存活线程数
jvm_threads_states_threads{state="blocked"}   # ★ BLOCKED 线程数（锁竞争指标）
jvm_classes_loaded_classes                    # 已加载类数
jvm_buffer_memory_used_bytes{id="direct"}     # ★ 直接内存（堆外）
process_cpu_usage                             # 进程 CPU 使用率
system_load_average_1m                        # 系统负载
executor_queued_tasks                         # ★ 线程池队列长度
executor_active_threads                       # 线程池活跃线程
```

**告警规则建议（Prometheus AlertManager）：**

| 告警 | 条件 | 级别 |
| --- | --- | --- |
| Full GC 频繁 | `rate(jvm_gc_pause_seconds_count&#123;action="end of major GC"&#125;[5m]) > 0.1` | P1 |
| GC 停顿过长 | `histogram_quantile(0.99, jvm_gc_pause_seconds) > 1` | P1 |
| 堆使用率过高 | `jvm_memory_used_bytes&#123;area="heap"&#125; / jvm_memory_max_bytes > 0.9` 持续 10 分钟 | P2 |
| 元空间接近上限 | `jvm_memory_used_bytes&#123;id="Metaspace"&#125; / max > 0.9` | P2 |
| BLOCKED 线程多 | `jvm_threads_states_threads&#123;state="blocked"&#125; > 20` | P2 |
| 线程数暴涨 | `jvm_threads_live_threads > 500` | P2 |
| 线程池队列积压 | `executor_queued_tasks > 阈值 × 0.8` | P1 |
| 直接内存增长 | `jvm_buffer_memory_used_bytes&#123;id="direct"&#125;` 持续上升 | P2 |

## 7. 面试高频问答速查

| 问题 | 关键答案 |
| --- | --- |
| **CPU 100% 怎么排查？** | `top` 找进程 → `top -H -p` 找线程 → `printf %x` 转 16 进制 → `jstack` 搜 nid → 定位代码。Arthas 用 `thread -n 3` 一步到位。常见原因：死循环、频繁 GC、正则回溯、锁自旋、HashMap 成环 |
| **OOM 怎么排查？** | 先看 OOM 类型（heap/metaspace/thread/direct）→ `jstat -gcutil` 判断是否泄漏（Full GC 后老年代不降）→ `jmap -histo` 看对象分布 → dump + MAT 分析 Dominator Tree + Path to GC Roots |
| **内存泄漏和溢出的区别？** | 泄漏是「该回收的回收不了」（引用未断），溢出是「申请不到内存」；泄漏积累导致溢出 |
| **常用的 JVM 参数有哪些？** | `-Xms/-Xmx/-Xmn/-Xss`、`-XX:MetaspaceSize/MaxMetaspaceSize`、`-XX:+UseG1GC/MaxGCPauseMillis`、`-XX:+HeapDumpOnOutOfMemoryError`、`-Xlog:gc*` |
| **线上怎么定位慢接口？** | 链路追踪看瀑布图 → Arthas `trace` 分解方法内部耗时 → 慢 SQL 日志 → GC 日志比对时间戳 |
| **怎么在不重启的情况下排查问题？** | Arthas：`jad` 反编译看代码、`watch` 看入参返回、`trace` 看耗时、`logger` 改日志级别、`retransform` 热修复、`ognl` 调用 Bean |
| **JVM 调优你做过什么？** | 讲一个完整案例：现象 → 定位（工具+数据）→ 根因 → 解决 → 效果（量化指标） |
| **Full GC 频繁怎么办？** | `jstat -gccause` 看原因：Allocation Failure（堆小/分配快）、Metadata GC Threshold（元空间）、Ergonomics（Parallel GC 的自适应）、System.gc()（代码调用/RMI）→ 对症处理 |
| **为什么线上要用 -Xms=-Xmx？** | 避免堆动态扩缩容带来的停顿和内存碎片，也让 GC 行为可预测 |
| **容器里 JVM 要注意什么？** | `UseContainerSupport` + `MaxRAMPercentage=70`（不是 Xmx 写死）、CPU 核数识别、优雅停机（terminationGracePeriodSeconds + preStop）、OOMKilled 无日志的排查（NMT） |

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 未开 GC 日志和 HeapDump | 出事无现场，只能重启复现 | 生产必配（性能开销极小） |
| 2 | `jmap -histo:live` 在生产直接执行 | 触发 Full GC，长时间 STW | 先摘流量，或用 `-histo`（不带 live） |
| 3 | `jmap -dump` 磁盘空间不足 | dump 失败 | 检查磁盘（dump 大小 ≈ 堆使用量） |
| 4 | Arthas 的 `tt` 长时间记录 | 内存暴涨 | `-n` 限制次数，用完 `tt --delete-all` |
| 5 | Arthas 用完不 `reset` | 类一直被增强，性能损耗 | `reset` 或 `stop` |
| 6 | `retransform` 后期望永久生效 | 重启后失效 | 只是临时手段，必须改代码重新发布 |
| 7 | 容器内存 100% 给堆 | OOMKilled（Exit 137），无 JVM 日志 | `MaxRAMPercentage=70`，NMT 排查 |
| 8 | JDK 8 老版本容器 CPU 识别错 | 线程数过多，性能差 | 升级 JDK 或 `ActiveProcessorCount` |
| 9 | `DisableExplicitGC` + 堆外内存 | Direct buffer OOM | 改 `ExplicitGCInvokesConcurrent` |
| 10 | MetaspaceSize 默认 21MB | 启动时多次 Full GC（元空间扩容） | 设为 256m 且等于 Max |
| 11 | 优雅停机未配 | 滚动更新时请求 502 | `server.shutdown=graceful` + K8s preStop |
| 12 | K8s 的 terminationGracePeriod 太短 | 应用还没停完就被 SIGKILL | 设为应用停机超时的 2 倍 |
| 13 | 多次 jstack 只抓一次 | 看不到「持续」的热点 | 间隔抓 3~5 次对比 |
| 14 | 只看平均 GC 耗时 | 忽略长尾 | 看 P99（`histogram_quantile`） |
| 15 | 调参后不压测直接上线 | 生产更糟 | 压测验证 + 灰度 |
| 16 | 一次改多个参数 | 无法归因 | 一次一个，观察数据 |
| 17 | 把「堆使用率高」当告警 | 误报频繁 | JVM 设计就是用满堆；告警看 GC 后能否降 |
| 18 | MAT 打开大 dump 时自身 OOM | 分析失败 | 改 `MemoryAnalyzer.ini` 的 `-Xmx`，或用命令行解析 |
| 19 | 火焰图看不懂 | 找不到热点 | 找「平顶山」（宽且平的栈顶），横轴是采样占比不是时间顺序 |
| 20 | 忽视 safepoint 日志 | STW 长但 GC 时间短，找不到原因 | 开 `-Xlog:safepoint`，查可数循环（改 long 索引） |

---

## 关联笔记

- 上一篇：[[后端/JVM/类加载机制与字节码]]
- 原理：[[后端/JVM/JVM概述与运行时数据区]]、[[后端/JVM/垃圾回收机制与收集器]]
- 相关：[[后端/Java工程化与部署/Linux与Java项目部署]]（Linux 命令、启动脚本）、[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]（容器化部署）
- 并发排查：[[后端/Java基础/并发编程/线程安全与synchronized]]（死锁分析）、[[后端/Java基础/并发编程/线程池原理与实战]]（线程池监控）
- 数据库排查：[[后端/数据库/MySQL/慢查询与性能优化]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
