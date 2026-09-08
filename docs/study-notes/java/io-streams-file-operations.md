---
title: "IO流与文件操作"
aliases:
  - "Java IO"
  - "BIO NIO AIO"
tags:
  - "后端"
  - "java"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/泛型枚举与注解]]"
  - "[[后端/Java基础/网络编程]]"
  - "[[后端/中间件/Netty与网络IO模型]]"
  - "[[后端/Java基础/异常处理]]"
created: 2026-09-06
updated: 2026-09-06
---

# IO 流与文件操作

## 1. Java IO 体系总览

### 1.1 三代 IO API

| 版本 | API | 模型 | 特点 |
| --- | --- | --- | --- |
| JDK 1.0 | `java.io`（BIO） | **阻塞同步** | 流式 API，一字节/一字符读写，简单但性能一般 |
| JDK 1.4 | `java.nio`（NIO） | **非阻塞同步** | Buffer + Channel + Selector，支持多路复用、零拷贝 |
| JDK 7 | `java.nio.file`（NIO.2 / AIO） | **异步非阻塞** | `Files`/`Path` 工具类（超好用）+ `AsynchronousChannel`（真正的 AIO） |

> 【澄清】**JDK 7 的 `java.nio.file` 包（Files/Path）通常也叫 "NIO.2"，但它是「文件系统 API 的升级」，不是异步 IO**。真正的异步 IO（AIO）是 `java.nio.channels.AsynchronousSocketChannel` 等，实际生产中用得少（Netty 曾支持 AIO 后移除，因为 Linux 上 AIO 底层还是用 epoll 模拟，性能不如 NIO）。

### 1.2 java.io 的流分类（四维度）

```
                        java.io 流体系
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
     按方向                 按单位                 按功能
   ┌────┴────┐         ┌────┴────┐         ┌──────┴──────┐
 输入流      输出流      字节流      字符流      节点流        处理流
(InputStream)(OutputStream)(InputStream)(Reader)  (直接连数据源)  (包装其他流)
(Reader)    (Writer)    (OutputStream)(Writer)                  (增强功能)

字节流：InputStream / OutputStream       ← 处理任意文件（图片、视频、压缩包）
字符流：Reader / Writer                  ← 处理文本文件（自动处理编码，避免乱码）
```

**四大抽象基类：**

| 基类 | 类型 | 单位 | 核心方法 |
| --- | --- | --- | --- |
| `InputStream` | 字节输入 | byte | `int read()`、`int read(byte[])`、`close()` |
| `OutputStream` | 字节输出 | byte | `void write(int)`、`void write(byte[])`、`flush()`、`close()` |
| `Reader` | 字符输入 | char | `int read()`、`int read(char[])`、`close()` |
| `Writer` | 字符输出 | char | `void write(int)`、`void write(String)`、`flush()`、`close()` |

**字节流 vs 字符流（必考）：**

| 对比 | 字节流 | 字符流 |
| --- | --- | --- |
| 处理单位 | 8 位字节 | 16 位字符（Unicode） |
| 基类 | InputStream / OutputStream | Reader / Writer |
| 适用文件 | **所有文件**（图片、音频、视频、二进制、文本） | **只能文本文件** |
| 编码处理 | 不处理，原样读写 | **自动按编码转换**（避免中文乱码） |
| 缓冲 | 无内置缓冲 | **内置缓冲**（`OutputStreamWriter` 有 StreamEncoder） |
| 关闭要求 | 必须 close | 必须 close + **flush**（否则缓冲区数据丢失） |
| 转换 | `InputStreamReader` / `OutputStreamWriter`（字节 → 字符的桥梁） | — |

> 【面试】**为什么字符流需要 flush 而字节流不需要？**
>
> 字符流写入时先把字符编码成字节存到**缓冲区**（StreamEncoder 内部的 byte[]），攒够一定量或调用 flush/close 时才真正写到底层字节流。字节流是直接写，无缓冲层（除非用 BufferedOutputStream）。
>
> 【坑】**忘记 flush 导致文件内容不完整**：字符流（`FileWriter`、`BufferedWriter`）写完必须 `flush()` 或 `close()`（close 内部会 flush）。用 try-with-resources 最安全。

### 1.3 常用实现类速查表

| 分类 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- |
| **文件字节流** | `FileInputStream` | `FileOutputStream` | 读写任意文件 |
| **文件字符流** | `FileReader` | `FileWriter` | 读写文本文件（用平台默认编码，⚠️ 有坑） |
| **缓冲字节流** | `BufferedInputStream` | `BufferedOutputStream` | 减少系统调用，性能提升 10 倍+ |
| **缓冲字符流** | `BufferedReader` | `BufferedWriter` | 提供 `readLine()`、`newLine()` |
| **内存字节流** | `ByteArrayInputStream` | `ByteArrayOutputStream` | 操作 byte[]，无需 close |
| **内存字符流** | `CharArrayReader` | `CharArrayWriter` | 操作 char[] |
| **字符串流** | `StringReader` | `StringWriter` | 操作 String |
| **转换流** | `InputStreamReader` | `OutputStreamWriter` | **字节流 → 字符流，可指定编码** |
| **打印流** | — | `PrintStream` / `PrintWriter` | 格式化输出，`System.out` 就是 PrintStream |
| **数据流** | `DataInputStream` | `DataOutputStream` | 读写基本类型（保持二进制格式） |
| **对象流** | `ObjectInputStream` | `ObjectOutputStream` | **序列化/反序列化** |
| **管道流** | `PipedInputStream` | `PipedOutputStream` | 线程间通信 |
| **随机访问** | `RandomAccessFile` | 同类 | **可读可写，任意位置跳转** |
| **合并流** | `SequenceInputStream` | — | 合并多个输入流 |
| **压缩流** | `ZipInputStream`、`GZIPInputStream` | `ZipOutputStream`、`GZIPOutputStream` | 压缩解压 |

## 2. 字节流实战

### 2.1 文件复制（三种写法演进）

```java
// ❌ 写法 1：单字节读写（最慢，每次一个系统调用）
public static void copy1(String src, String dest) throws IOException {
    try (FileInputStream in = new FileInputStream(src);
         FileOutputStream out = new FileOutputStream(dest)) {
        int b;
        while ((b = in.read()) != -1) {      // read() 返回 0~255 或 -1（EOF）
            out.write(b);
        }
    }
}
// 100MB 文件：约 60 秒（每次 read/write 都是一次系统调用，用户态/内核态切换开销巨大）

// ✅ 写法 2：字节数组缓冲（快 100 倍）
public static void copy2(String src, String dest) throws IOException {
    try (FileInputStream in = new FileInputStream(src);
         FileOutputStream out = new FileOutputStream(dest)) {
        byte[] buffer = new byte[8192];       // ★ 8KB 缓冲区（常见页大小的倍数）
        int len;
        while ((len = in.read(buffer)) != -1) {   // read(byte[]) 返回实际读取字节数
            out.write(buffer, 0, len);            // ★ 必须指定 len！不能用 buffer.length
        }
    }
}
// 100MB 文件：约 0.5 秒

// ✅ 写法 3：缓冲流（在写法 2 基础上再减少系统调用）
public static void copy3(String src, String dest) throws IOException {
    try (BufferedInputStream in = new BufferedInputStream(new FileInputStream(src));
         BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(dest))) {
        byte[] buffer = new byte[8192];
        int len;
        while ((len = in.read(buffer)) != -1) {
            out.write(buffer, 0, len);
        }
    }
}

// ✅✅ 写法 4：NIO 的 transferTo（零拷贝，最快）
public static void copy4(String src, String dest) throws IOException {
    try (FileChannel inChannel = FileChannel.open(Paths.get(src), StandardOpenOption.READ);
         FileChannel outChannel = FileChannel.open(Paths.get(dest),
                                                   StandardOpenOption.CREATE,
                                                   StandardOpenOption.WRITE)) {
        inChannel.transferTo(0, inChannel.size(), outChannel);   // ★ 内核态直接传输，不经用户空间
    }
}
// 100MB 文件：约 0.2 秒

// ✅✅ 写法 5：Files 工具类（JDK 7+，内部用零拷贝，一行代码）
public static void copy5(String src, String dest) throws IOException {
    Files.copy(Paths.get(src), Paths.get(dest), StandardCopyOption.REPLACE_EXISTING);
}
```

**性能对比（复制 100MB 文件，实测参考值）：**

| 方式 | 耗时 | 说明 |
| --- | --- | --- |
| 单字节 read/write | ~60 s | 100M 次系统调用 |
| byte[] 缓冲 | ~0.5 s | 1.2 万次系统调用 |
| Buffered 流 | ~0.45 s | 内部 8KB 缓冲 |
| NIO Channel 直接读写 | ~0.3 s | ByteBuffer 批量 |
| **`transferTo`（零拷贝）** | **~0.2 s** | 内核态 DMA 传输 |
| `Files.copy` | ~0.2 s | 内部用零拷贝 |

> 【坑】**`out.write(buffer)` 与 `out.write(buffer, 0, len)` 的区别**：最后一次读取通常读不满缓冲区，`buffer` 里残留着上次的数据。用 `buffer.length` 会把脏数据写进去，**导致文件末尾多出垃圾内容、文件变大**。

### 2.2 缓冲流原理

```java
// BufferedInputStream 的缓冲机制
public class BufferedInputStream extends FilterInputStream {
    protected volatile byte[] buf;          // 默认 8192 字节缓冲
    protected int count;                     // 缓冲区中的有效字节数
    protected int pos;                       // 当前读取位置

    public synchronized int read() throws IOException {
        if (pos >= count) {                  // 缓冲区读完了
            fill();                          // ★ 一次系统调用读满 8KB
            if (pos >= count) return -1;
        }
        return getBufIfOpen()[pos++] & 0xff; // 从缓冲区取（纯内存操作，无系统调用）
    }
}
```

**缓冲的价值：把 N 次系统调用变成 N/8192 次。**

```
无缓冲读 100MB：100,000,000 次 read() 系统调用
                每次约 1~2 微秒（用户态↔内核态切换）→ 总耗时 100~200 秒

有缓冲读 100MB：12,500 次 read(8KB) 系统调用
                + 1 亿次内存数组访问（纳秒级）→ 总耗时 0.5 秒
```

**缓冲区大小的选择：**

| 大小 | 适用 |
| --- | --- |
| 4KB / 8KB | 通用默认（匹配文件系统块大小） |
| 64KB ~ 256KB | 大文件顺序读写 |
| 1MB+ | 超大文件、网络传输（收益递减） |
| 过大 | 浪费内存，且超过 L2/L3 缓存反而变慢 |

```java
new BufferedInputStream(in, 65536);        // 指定 64KB 缓冲
new BufferedOutputStream(out, 65536);
new BufferedReader(new FileReader(f), 1 << 16);
```

### 2.3 内存流（ByteArrayInputStream / ByteArrayOutputStream）

```java
// ByteArrayOutputStream：把数据写到内存 byte[]，无需文件、无需 close
ByteArrayOutputStream baos = new ByteArrayOutputStream();
baos.write("hello".getBytes(StandardCharsets.UTF_8));
baos.write(123);
byte[] data = baos.toByteArray();           // 拿到完整字节数组
String str = baos.toString(StandardCharsets.UTF_8);    // JDK 10+ 可指定编码
baos.reset();                               // 清空重用
baos.size();                                // 当前字节数

// ByteArrayInputStream：从 byte[] 读
ByteArrayInputStream bais = new ByteArrayInputStream(data);
int b;
while ((b = bais.read()) != -1) { }
bais.reset();                               // 回到 mark 位置（默认 0）
bais.skip(10);                              // 跳过 10 字节
bais.available();                           // 剩余可读字节数

// 实战 1：对象 → 字节数组（序列化）
public static byte[] toBytes(Object obj) throws IOException {
    try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
         ObjectOutputStream oos = new ObjectOutputStream(baos)) {
        oos.writeObject(obj);
        oos.flush();
        return baos.toByteArray();
    }
}

// 实战 2：图片处理（缩放后返回给前端）
public byte[] resizeImage(byte[] original, int width, int height) throws IOException {
    BufferedImage image = ImageIO.read(new ByteArrayInputStream(original));
    BufferedImage resized = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
    resized.createGraphics().drawImage(image.getScaledInstance(width, height, Image.SCALE_SMOOTH), 0, 0, null);
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    ImageIO.write(resized, "jpg", baos);
    return baos.toByteArray();
}

// 实战 3：Excel 导出到内存再上传 OSS
ByteArrayOutputStream out = new ByteArrayOutputStream();
EasyExcel.write(out, UserVO.class).sheet("用户").doWrite(userList);
byte[] excelBytes = out.toByteArray();
ossClient.putObject(bucket, "users.xlsx", new ByteArrayInputStream(excelBytes));

// 实战 4：InputStream → byte[]（三种方式）
// JDK 9+（最简单）
byte[] bytes = inputStream.readAllBytes();
// JDK 8
byte[] bytes2 = IOUtils.toByteArray(inputStream);           // Apache Commons IO
// 手写
ByteArrayOutputStream buffer = new ByteArrayOutputStream();
byte[] tmp = new byte[8192];
int n;
while ((n = inputStream.read(tmp)) != -1) buffer.write(tmp, 0, n);
byte[] bytes3 = buffer.toByteArray();
```

### 2.4 RandomAccessFile（随机访问）

```java
// 特点：既能读又能写，可以任意位置跳转（内部维护文件指针）
// 模式："r" 只读、"rw" 读写、"rwd" 读写+同步内容和元数据、"rws" 读写+同步内容
try (RandomAccessFile raf = new RandomAccessFile("data.txt", "rw")) {

    raf.getFilePointer();               // 当前指针位置
    raf.length();                       // 文件长度

    // 写
    raf.writeInt(100);                  // 写 int（4 字节）
    raf.writeUTF("hello");              // 写 UTF 字符串（2 字节长度 + 内容）
    raf.writeDouble(3.14);

    // 跳转到指定位置读
    raf.seek(0);                        // ★ 回到文件开头
    int i = raf.readInt();              // 100
    String s = raf.readUTF();           // "hello"
    double d = raf.readDouble();        // 3.14

    // 在文件中间插入内容（需要搬移后面的数据）
    raf.seek(4);
    byte[] rest = new byte[(int)(raf.length() - 4)];
    raf.readFully(rest);
    raf.seek(4);
    raf.writeUTF("INSERTED");
    raf.write(rest);

    // 获取底层 FileDescriptor 和 FileChannel
    FileChannel channel = raf.getChannel();
}

// 实战：断点续传（多线程分片下载）
public void downloadInChunks(String url, File target, int threadCount) {
    long fileSize = getContentLength(url);
    long chunkSize = fileSize / threadCount;
    for (int i = 0; i < threadCount; i++) {
        long start = i * chunkSize;
        long end = (i == threadCount - 1) ? fileSize - 1 : start + chunkSize - 1;
        executor.submit(() -> {
            try (RandomAccessFile raf = new RandomAccessFile(target, "rw")) {
                raf.seek(start);                              // ★ 各线程写到自己的位置
                // 带 Range 头请求：Range: bytes=start-end
                try (InputStream in = openConnectionWithRange(url, start, end)) {
                    byte[] buf = new byte[8192];
                    int len;
                    while ((len = in.read(buf)) != -1) raf.write(buf, 0, len);
                }
            }
        });
    }
}

// 实战：大文件按行读取指定行（跳过前 N 行）
public String readLine(File file, int lineNo) throws IOException {
    try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
        int count = 0;
        String line;
        while ((line = raf.readLine()) != null) {
            if (count++ == lineNo) return line;
        }
    }
    return null;
}
// ⚠️ readLine() 只按 ISO-8859-1 解码，中文会乱码！要用：
//    new String(raf.readLine().getBytes("ISO-8859-1"), "UTF-8")
```

### 2.5 数据流与打印流

```java
// DataOutputStream：按二进制格式写基本类型（跨语言可读，比文本更紧凑）
try (DataOutputStream dos = new DataOutputStream(
        new BufferedOutputStream(new FileOutputStream("data.bin")))) {
    dos.writeInt(100);              // 4 字节
    dos.writeLong(123456789L);      // 8 字节
    dos.writeDouble(3.14159);       // 8 字节
    dos.writeBoolean(true);         // 1 字节
    dos.writeUTF("中文");            // 2 字节长度 + Modified UTF-8 内容
    dos.writeChars("abc");          // 每字符 2 字节
    dos.flush();                    // ★ 必须 flush
}

// DataInputStream：顺序必须与写入一致！
try (DataInputStream dis = new DataInputStream(
        new BufferedInputStream(new FileInputStream("data.bin")))) {
    int i = dis.readInt();          // 100
    long l = dis.readLong();
    double d = dis.readDouble();
    boolean b = dis.readBoolean();
    String s = dis.readUTF();       // "中文"
}

// PrintStream / PrintWriter：格式化输出（自动 flush 可选）
PrintStream ps = new PrintStream(new FileOutputStream("log.txt"), true, StandardCharsets.UTF_8);
//                                                                     ↑ autoFlush
ps.println("一行文本");
ps.printf("姓名：%s，年龄：%d%n", "Tom", 20);
ps.print(123);
System.out;                         // 就是 PrintStream
System.err;                         // 错误输出流

PrintWriter pw = new PrintWriter(new FileWriter("out.txt"), true);
pw.println("文本");
pw.format("%s-%d%n", "a", 1);
```

**PrintStream vs PrintWriter：**

| | PrintStream | PrintWriter |
| --- | --- | --- |
| 输出单位 | 字节 | 字符 |
| 编码处理 | 可指定编码 | 依赖底层 Writer |
| 异常 | 不抛 IOException（内部吞掉，用 `checkError()` 检测） | 同样不抛 |
| 典型 | `System.out` | JSP 的 `out`、Servlet 的 `response.getWriter()` |

## 3. 字符流与编码处理

### 3.1 转换流（字节 → 字符的桥梁）★★★★★

```java
// InputStreamReader：字节输入流 → 字符输入流，可指定编码
try (BufferedReader br = new BufferedReader(
        new InputStreamReader(new FileInputStream("utf8.txt"), StandardCharsets.UTF_8))) {
    String line;
    while ((line = br.readLine()) != null) {
        System.out.println(line);
    }
}

// OutputStreamWriter：字符输出流 → 字节输出流，可指定编码
try (BufferedWriter bw = new BufferedWriter(
        new OutputStreamWriter(new FileOutputStream("gbk.txt"), Charset.forName("GBK")))) {
    bw.write("中文内容");
    bw.newLine();
    bw.flush();
}

// 编码转换（文件 GBK → UTF-8）
public void convertEncoding(File src, File dest) throws IOException {
    try (BufferedReader br = new BufferedReader(
            new InputStreamReader(new FileInputStream(src), Charset.forName("GBK")));
         BufferedWriter bw = new BufferedWriter(
            new OutputStreamWriter(new FileOutputStream(dest), StandardCharsets.UTF_8))) {
        String line;
        while ((line = br.readLine()) != null) {
            bw.write(line);
            bw.newLine();
        }
    }
}

// 控制台输入的中文处理
try (BufferedReader br = new BufferedReader(
        new InputStreamReader(System.in, StandardCharsets.UTF_8))) {
    String input = br.readLine();
}

// 网络流的字符处理（HTTP 响应）
try (BufferedReader br = new BufferedReader(
        new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
    String body = br.lines().collect(Collectors.joining("\n"));
}
```

> 【坑】**`FileReader`/`FileWriter` 无法指定编码**（总是用平台默认编码）！
> ```java
> new FileReader("file.txt");          // 用 file.encoding（Windows 可能是 GBK）
> new FileWriter("file.txt");          // 同上
> // JDK 11+ 提供了带 Charset 的构造器
> new FileReader("file.txt", StandardCharsets.UTF_8);       // ✅ JDK 11+
> new FileWriter("file.txt", StandardCharsets.UTF_8);       // ✅ JDK 11+
> // JDK 8 只能用转换流
> new InputStreamReader(new FileInputStream(f), StandardCharsets.UTF_8);
> ```
> **这是中文乱码的头号来源**：Windows 上开发（GBK）、Linux 上部署（UTF-8），用 FileReader 读文件必然乱码。

### 3.2 BufferedReader 的 readLine

```java
// readLine()：读一行（不含换行符），到文件末尾返回 null
try (BufferedReader br = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
    String line;
    while ((line = br.readLine()) != null) {
        process(line);
    }
}

// JDK 8+ Stream 方式（更适合函数式处理）
try (Stream<String> lines = Files.lines(path, StandardCharsets.UTF_8)) {
    List<String> result = lines
        .filter(l -> !l.startsWith("#"))       // 过滤注释
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .collect(Collectors.toList());
}
// ⚠️ Files.lines 返回的 Stream 必须关闭（持有文件句柄），用 try-with-resources

// 读取整个文件为字符串
String content = Files.readString(path);                          // JDK 11+
String content2 = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);   // JDK 7+
List<String> allLines = Files.readAllLines(path, StandardCharsets.UTF_8);  // ⚠️ 全加载到内存，大文件会 OOM
String content3 = IOUtils.toString(inputStream, StandardCharsets.UTF_8);   // Apache Commons

// 大文件逐行处理（不 OOM）
try (Stream<String> lines = Files.lines(bigFilePath)) {
    long count = lines.filter(l -> l.contains("ERROR")).count();
}

// BufferedReader 的其他方法
br.read();                       // 读单个字符（int）
br.read(char[]);                 // 读入字符数组
br.skip(100);                    // 跳过 100 字符
br.ready();                      // 是否可读（不阻塞）
br.mark(1000); br.reset();       // 标记与重置
br.lines();                      // JDK 8+ 转 Stream<String>
```

### 3.3 编码问题排查

**乱码的本质：编码和解码用了不同的字符集。**

```java
// 经典乱码还原（诊断用）
String garbled = "ä½ å¥½";                              // UTF-8 的字节被当 Latin-1 解码
String fixed = new String(garbled.getBytes(StandardCharsets.ISO_8859_1),
                          StandardCharsets.UTF_8);       // "你好"

String garbled2 = "浣犲ソ";                                // UTF-8 的字节被当 GBK 解码
// 还原：new String(garbled2.getBytes("GBK"), "UTF-8")

// 全链路编码检查清单
// 1. 源文件编码：IDEA File Encodings 全设 UTF-8
// 2. 编译编码：javac -encoding UTF-8 / Maven <project.build.sourceEncoding>UTF-8
// 3. JVM 运行编码：-Dfile.encoding=UTF-8（JDK 18+ 默认 UTF-8）
// 4. 数据库：character_set_server=utf8mb4，表/列的 charset
// 5. JDBC 连接串：?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci
// 6. HTTP 响应：response.setCharacterEncoding("UTF-8") + Content-Type: text/html;charset=UTF-8
// 7. HTTP 请求：Tomcat 8+ 默认 URIEncoding=UTF-8；旧版需配置
// 8. 过滤器：CharacterEncodingFilter（Spring Boot 默认开启）
// 9. Nginx：charset utf-8;
// 10. 终端：chcp 65001（Windows）/ LANG=zh_CN.UTF-8（Linux）
// 11. 文件读写：显式指定 StandardCharsets.UTF_8，禁用无参 getBytes()
```

**Maven 的编码配置（必须）：**

```xml
<properties>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>
    <maven.compiler.encoding>UTF-8</maven.compiler.encoding>
</properties>
```

## 4. 序列化与反序列化

### 4.1 Java 原生序列化

```java
// 序列化：对象 → 字节流（持久化到磁盘 / 网络传输）
// 反序列化：字节流 → 对象

// 条件：类必须实现 java.io.Serializable（标记接口，无方法）
public class User implements Serializable {

    /** ★ 序列化版本号（强烈建议显式声明） */
    private static final long serialVersionUID = 1L;

    private String name;
    private transient String password;          // ★ transient：不序列化
    private static int count;                    // ★ static：不序列化（属于类）
    private Address address;                     // 引用对象也必须 Serializable

    private void writeObject(ObjectOutputStream out) throws IOException {
        out.defaultWriteObject();                // 先写默认字段
        out.writeObject(encrypt(password));      // 自定义：加密后写密码
    }

    private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException {
        in.defaultReadObject();
        this.password = decrypt((String) in.readObject());
    }
}

// 序列化
try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("user.ser"))) {
    oos.writeObject(user);
    oos.flush();
}

// 反序列化
try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream("user.ser"))) {
    User u = (User) ois.readObject();
}

// 序列化到字节数组（网络传输）
byte[] bytes;
try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
     ObjectOutputStream oos = new ObjectOutputStream(baos)) {
    oos.writeObject(user);
    bytes = baos.toByteArray();
}
```

**serialVersionUID 的作用（必考）：**

```java
// 反序列化时，JVM 会比较「字节流中的 serialVersionUID」与「当前类的 serialVersionUID」
// 不一致 → InvalidClassException: local class incompatible

// 如果不显式声明，JVM 会根据类的结构（字段、方法、修饰符）自动计算一个
// 后果：类只要有任何改动（加个方法、改个修饰符），serialVersionUID 就变了
//      → 旧数据全部无法反序列化！

// ✅ 强制规约：实现 Serializable 的类必须显式声明 serialVersionUID
private static final long serialVersionUID = 1L;
// IDEA 可配置自动生成（Settings → Inspections → Serializable class without 'serialVersionUID'）
```

**序列化的规则：**

| 成员类型 | 是否序列化 | 说明 |
| --- | --- | --- |
| 普通实例字段 | ✅ | — |
| `transient` 字段 | ❌ | 反序列化后为默认值（null/0） |
| `static` 字段 | ❌ | 属于类不属于对象（反序列化时用当前类的静态值） |
| 父类字段（父类实现 Serializable） | ✅ | — |
| 父类字段（父类未实现 Serializable） | ❌ | 反序列化时调用父类**无参构造器**初始化 |
| 引用类型字段 | 递归序列化 | **引用的对象也必须 Serializable，否则 NotSerializableException** |

**序列化的坑：**

```java
// 坑 1：引用对象未实现 Serializable
class User implements Serializable {
    private Address address;      // Address 没实现 Serializable
}
// → NotSerializableException: com.example.Address

// 坑 2：单例被序列化破坏
public class Singleton implements Serializable {
    private static final Singleton INSTANCE = new Singleton();
    private Singleton() { }
    public static Singleton getInstance() { return INSTANCE; }
    // ❌ 反序列化会创建新实例（绕过构造器）！

    // ✅ 解决：定义 readResolve 方法
    private Object readResolve() {
        return INSTANCE;           // 反序列化时返回已有的单例
    }
}
// 更好的方案：用枚举实现单例（JVM 特殊处理，天然防序列化破坏）

// 坑 3：序列化安全漏洞（重大！）
// ObjectInputStream.readObject() 会调用反序列化对象的 readObject/readResolve 等方法，
// 攻击者可以构造恶意字节流，触发「反序列化 gadget chain」执行任意代码（RCE）
// 著名漏洞：Apache Commons Collections 的 InvokerTransformer、
//          Fastjson 的 autoType、Shiro 的 rememberMe（CVE-2016-4437）

// ✅ 防护措施
// 1. JDK 9+ 对象输入过滤（JEP 290）
ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(
    "com.example.*;!*");                       // 白名单 + 黑名单
ois.setObjectInputFilter(filter);
// 2. 全局配置 -Djdk.serialFilter=...
// 3. 不用原生序列化，改用 JSON / Protobuf
// 4. 对反序列化的数据做签名校验（Shiro 的修复方案）
```

### 4.2 主流序列化方案对比 ★★★★★

| 方案 | 格式 | 可读性 | 体积 | 速度 | 跨语言 | 典型场景 |
| --- | --- | --- | --- | --- | --- | --- |
| **Java 原生** | 二进制 | ❌ | 大 | 慢 | ❌ | RMI、老系统（**不推荐**） |
| **JSON**（Jackson/Fastjson/Gson） | 文本 | ✅✅ | 中 | 中 | ✅✅ | **HTTP API、前后端交互** |
| **XML** | 文本 | ✅ | 很大 | 慢 | ✅ | 配置文件、老系统接口 |
| **Protobuf** | 二进制 | ❌ | **很小** | **很快** | ✅ | **RPC（gRPC、Dubbo）、内部通信** |
| **Hessian** | 二进制 | ❌ | 小 | 快 | ✅（有限） | Dubbo 默认序列化 |
| **Kryo** | 二进制 | ❌ | 小 | **极快** | ❌（仅 Java） | Java 内部高性能场景、Redis 缓存 |
| **Thrift** | 二进制 | ❌ | 小 | 快 | ✅ | 跨语言 RPC |
| **Avro** | 二进制 | ❌ | 小 | 快 | ✅ | 大数据（Hadoop、Kafka） |
| **MessagePack** | 二进制 | ❌ | 小 | 快 | ✅ | 类 JSON 的二进制替代 |

```java
// Jackson（Spring Boot 默认，最主流）
ObjectMapper mapper = new ObjectMapper();
String json = mapper.writeValueAsString(user);              // 序列化
User u = mapper.readValue(json, User.class);                // 反序列化
List<User> list = mapper.readValue(json, new TypeReference<List<User>>() {});   // 泛型

// Fastjson2（阿里，性能高）
String json2 = JSON.toJSONString(user);
User u2 = JSON.parseObject(json2, User.class);
List<User> list2 = JSON.parseArray(json2, User.class);

// Gson（Google）
Gson gson = new GsonBuilder().setDateFormat("yyyy-MM-dd HH:mm:ss").create();
String json3 = gson.toJson(user);
User u3 = gson.fromJson(json3, User.class);

// Protobuf（需要 .proto 文件 + 编译生成 Java 类）
// user.proto:
// syntax = "proto3";
// message UserProto {
//   int64 id = 1;
//   string name = 2;
//   int32 age = 3;
// }
UserProto proto = UserProto.newBuilder().setId(1L).setName("Tom").setAge(20).build();
byte[] bytes = proto.toByteArray();                          // 序列化（极紧凑）
UserProto parsed = UserProto.parseFrom(bytes);               // 反序列化

// Kryo（高性能 Java 内部序列化）
Kryo kryo = new Kryo();                                      // ⚠️ Kryo 非线程安全，用 ThreadLocal
byte[] buffer = ...;
Output output = new Output(buffer);
kryo.writeObject(output, user);
User u4 = kryo.readObject(new Input(buffer), User.class);
```

> 【实践建议】
> - **HTTP API / 前后端**：JSON（Jackson）
> - **Redis 缓存**：JSON（可读性好，便于排查）或 Kryo（性能优先）
> - **RPC 内部通信**：Protobuf / Hessian
> - **消息队列**：JSON（跨语言）或 Protobuf（高性能）
> - **永远不要用 Java 原生序列化**（体积大、慢、安全漏洞多、跨语言不行）

## 5. NIO（New IO）★★★★★

### 5.1 BIO vs NIO vs AIO

| 对比 | BIO（java.io） | NIO（java.nio） | AIO（NIO.2 异步） |
| --- | --- | --- | --- |
| 全称 | Blocking IO | Non-blocking IO / New IO | Asynchronous IO |
| 模型 | **同步阻塞** | **同步非阻塞 + IO 多路复用** | **异步非阻塞** |
| 核心抽象 | 流（Stream，面向字节/字符） | **Buffer + Channel + Selector**（面向块） | Channel + CompletionHandler |
| 数据流向 | 单向（输入流只能读） | **双向**（Channel 可读可写） | 双向 |
| 阻塞 | read 时无数据就阻塞 | Selector 监听多通道，有数据才处理 | 完全不阻塞，完成后回调 |
| 线程模型 | **一连接一线程** | **一线程管理多连接**（Reactor） | 回调/CompletableFuture |
| 零拷贝 | ❌ | ✅（`transferTo`、`mmap`） | ✅ |
| 适用 | 连接数少、逻辑简单 | **连接数多、请求短**（聊天、网关） | 连接数多、操作重（图片服务器） |
| JDK 版本 | 1.0 | 1.4 | 7 |
| 实践 | 简单工具 | **Netty 的基础（主流）** | 用得少（Linux 支持不完善） |

```
BIO 模型：
  客户端1 ──→ [线程1: read() 阻塞等待] ──→ 处理 ──→ write()
  客户端2 ──→ [线程2: read() 阻塞等待] ──→ 处理 ──→ write()
  客户端3 ──→ [线程3: read() 阻塞等待] ──→ ...
  1 万个连接 = 1 万个线程 → 内存爆炸 + 上下文切换开销

NIO 模型（多路复用）：
  客户端1 ─┐
  客户端2 ─┼─→ [Selector 单线程监听所有 Channel] ─→ 有事件的才交给线程处理
  客户端3 ─┘
  1 万个连接 = 1 个 Selector 线程 + 少量工作线程
```

### 5.2 NIO 三大核心组件

```
┌──────────────────────────────────────────────────────────┐
│                      Selector（选择器）                     │
│         监听多个 Channel 的 IO 事件（多路复用的核心）          │
└───────┬──────────────┬──────────────┬────────────────────┘
        │              │              │
   ┌────▼────┐   ┌─────▼────┐   ┌─────▼────┐
   │ Channel │   │ Channel  │   │ Channel  │   ← 通道（双向，连接数据源）
   │  (文件)  │   │ (Socket) │   │ (Socket) │
   └────┬────┘   └─────┬────┘   └─────┬────┘
        │              │              │
   ┌────▼────┐   ┌─────▼────┐   ┌─────▼────┐
   │ Buffer  │   │ Buffer   │   │ Buffer   │   ← 缓冲区（数据的容器，读写都经过它）
   └─────────┘   └──────────┘   └──────────┘
```

| 组件 | 作用 | 类比 |
| --- | --- | --- |
| **Channel（通道）** | 双向的数据传输通道，连接 Buffer 和数据源 | 铁路（可双向通车） |
| **Buffer（缓冲区）** | 数据的容器，所有读写都必须经过 Buffer | 车厢（装货物） |
| **Selector（选择器）** | 单线程监听多个 Channel 的就绪事件 | 调度中心（哪个站台有车来了） |

### 5.3 Buffer 详解

```java
// Buffer 的四个核心属性（capacity/limit/position/mark）
// capacity：容量，创建时确定，不可变
// limit：读写边界（写模式=capacity，读模式=数据量）
// position：当前读写位置
// mark：标记位置（reset 可回到这里）

// 关系：0 <= mark <= position <= limit <= capacity

// 创建 Buffer（8 种基本类型都有对应 Buffer，除 boolean）
ByteBuffer buffer = ByteBuffer.allocate(1024);        // 堆内缓冲区（JVM 管理，GC 可回收）
ByteBuffer direct = ByteBuffer.allocateDirect(1024);  // ★ 堆外直接内存（DMA，IO 更快，但分配/回收慢）
ByteBuffer wrapped = ByteBuffer.wrap(bytes);          // 包装已有数组
IntBuffer intBuf = IntBuffer.allocate(100);
CharBuffer charBuf = CharBuffer.allocate(100);

// 写数据
buffer.put((byte) 1);                    // 写单个字节
buffer.putInt(100);                      // 写 int（4 字节）
buffer.put(bytes);                       // 写数组
buffer.put(0, (byte) 9);                 // 绝对位置写（不改 position）
buffer.putChar('A');
buffer.putDouble(3.14);

// ★ 切换到读模式（必须！）
buffer.flip();
// flip() 做的事：limit = position; position = 0; mark = -1;
// 写模式：position 指向下一个可写位置，limit = capacity
// 读模式：position = 0，limit = 已写入的数据量

// 读数据
byte b = buffer.get();                   // 读单字节
int i = buffer.getInt();
byte[] dst = new byte[buffer.remaining()];
buffer.get(dst);                         // 读到数组
buffer.get(0);                           // 绝对位置读（不改 position）

// 其他操作
buffer.remaining();                      // limit - position（还剩多少可读）
buffer.hasRemaining();                   // 是否还有数据
buffer.rewind();                         // position = 0（重读，limit 不变）
buffer.clear();                          // position=0, limit=capacity（"清空"，实际数据还在，会被覆盖）
buffer.mark(); buffer.reset();           // 标记与回到标记
buffer.compact();                        // 压缩：把未读数据移到开头，切回写模式
buffer.slice();                          // 分片（共享底层数组的独立 Buffer）
buffer.duplicate();                      // 副本（共享数据，独立的 position/limit）
buffer.asReadOnlyBuffer();               // 只读视图
buffer.order(ByteOrder.LITTLE_ENDIAN);   // 字节序（网络传输用 BIG_ENDIAN）
buffer.isDirect();                       // 是否堆外内存

// JDK 9+ 的 flip/clear 返回类型改为 Buffer（协变返回），有兼容性问题
```

**Buffer 的状态转换图（必背）：**

```
① allocate(10) 后：
   position=0, limit=10, capacity=10
   [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]
    ↑pos      ↑limit(=capacity)

② put 3 个字节后（写模式）：
   position=3, limit=10
   [A][B][C][ ][ ][ ][ ][ ][ ][ ]
             ↑pos
                        ↑limit

③ flip() 后（切换到读模式）：
   position=0, limit=3
   [A][B][C][ ][ ][ ][ ][ ][ ][ ]
    ↑pos     ↑limit          ← 只能读前 3 个

④ get 2 个字节后：
   position=2, limit=3
   [A][B][C]...
         ↑pos ↑limit

⑤ clear() 后（回到写模式，数据仍在但会被覆盖）：
   position=0, limit=10
```

**堆内存 vs 直接内存（DirectByteBuffer）：**

| 对比 | HeapByteBuffer | DirectByteBuffer |
| --- | --- | --- |
| 位置 | JVM 堆内 | **堆外本地内存**（malloc） |
| 分配/释放 | 快（JVM 分配） | **慢**（系统调用 malloc/free） |
| IO 性能 | 慢（需要**多一次拷贝**：堆 → 临时直接内存 → 内核） | **快**（直接给内核，零拷贝） |
| GC | 正常 GC | **不受 GC 直接管理**（靠 Cleaner 虚引用回收，可能内存泄漏） |
| 大小限制 | 受 `-Xmx` 限制 | 受 `-XX:MaxDirectMemorySize` 限制（默认等于 -Xmx） |
| 适用 | 计算密集、频繁创建销毁 | **IO 密集、长期复用**（Netty 的池化直接内存） |

```
堆内存 IO 的额外拷贝：
  Java 堆 Buffer → [JVM 拷贝] → 临时直接内存 → [DMA] → 内核缓冲区 → 网卡
                     ↑ 因为 GC 可能移动堆中对象，内核无法直接访问堆内存

直接内存 IO：
  直接内存 Buffer → [DMA] → 内核缓冲区 → 网卡        ← 少一次拷贝
```

> 【坑】**`OutOfMemoryError: Direct buffer memory`**：直接内存不受 GC 及时回收，大量创建 DirectByteBuffer 会导致堆外内存耗尽。解决：① `-XX:MaxDirectMemorySize=512m` 限制；② 复用 Buffer（Netty 的 `PooledByteBufAllocator`）；③ 手动释放 `((DirectBuffer) buf).cleaner().clean()`（需反射，JDK 9+ 受限）。

### 5.4 Channel 详解

```java
// 四大 Channel
FileChannel      // 文件（不能非阻塞）
SocketChannel    // TCP 客户端
ServerSocketChannel  // TCP 服务端
DatagramChannel  // UDP

// 1. FileChannel（文件操作，性能优于 FileInputStream）
try (FileChannel channel = FileChannel.open(Paths.get("data.txt"),
                                            StandardOpenOption.READ,
                                            StandardOpenOption.WRITE)) {
    // 写
    ByteBuffer writeBuf = ByteBuffer.wrap("hello nio".getBytes(StandardCharsets.UTF_8));
    channel.write(writeBuf);                   // 可能没写完，需循环
    while (writeBuf.hasRemaining()) channel.write(writeBuf);

    // 读
    channel.position(0);                        // 回到开头
    ByteBuffer readBuf = ByteBuffer.allocate(1024);
    int bytesRead = channel.read(readBuf);
    readBuf.flip();
    System.out.println(StandardCharsets.UTF_8.decode(readBuf));

    // ★ 零拷贝传输（文件 → 文件、文件 → Socket）
    channel.transferTo(0, channel.size(), targetChannel);
    targetChannel.transferFrom(channel, 0, channel.size());

    // 内存映射文件（mmap，超大文件随机访问）
    MappedByteBuffer mmap = channel.map(FileChannel.MapMode.READ_WRITE, 0, channel.size());
    mmap.put(0, (byte) 'X');                    // 直接改内存，OS 负责刷盘

    // 强制刷盘
    channel.force(true);                        // true = 连元数据一起刷

    // 文件锁
    FileLock lock = channel.lock(0, 100, false);   // 排他锁
    FileLock sharedLock = channel.tryLock(0, 100, true);  // 共享锁（非阻塞）
    lock.release();

    channel.size();                            // 文件大小
    channel.position();                        // 当前位置
    channel.truncate(100);                     // 截断到 100 字节
}

// 2. SocketChannel（TCP 客户端）
SocketChannel socketChannel = SocketChannel.open();
socketChannel.configureBlocking(false);         // ★ 设为非阻塞
socketChannel.connect(new InetSocketAddress("127.0.0.1", 8080));
while (!socketChannel.finishConnect()) {        // 非阻塞下需轮询连接完成
    // 可以做别的事
}
ByteBuffer buf = ByteBuffer.allocate(1024);
socketChannel.write(buf);
socketChannel.read(buf);
socketChannel.close();

// 3. ServerSocketChannel（TCP 服务端）
ServerSocketChannel serverChannel = ServerSocketChannel.open();
serverChannel.bind(new InetSocketAddress(8080));
serverChannel.configureBlocking(false);
// 注册到 Selector
serverChannel.register(selector, SelectionKey.OP_ACCEPT);

// 4. DatagramChannel（UDP）
DatagramChannel udp = DatagramChannel.open();
udp.bind(new InetSocketAddress(9090));
ByteBuffer buf = ByteBuffer.allocate(1024);
SocketAddress sender = udp.receive(buf);        // 接收（返回发送方地址）
udp.send(buf, new InetSocketAddress("host", 9091));
```

### 5.5 Selector 与 IO 多路复用 ★★★★★

```java
// 创建 Selector（底层：Linux=epoll, macOS=KQueue, Windows=select/poll）
Selector selector = Selector.open();

// 注册 Channel（Channel 必须是非阻塞的！）
serverChannel.register(selector, SelectionKey.OP_ACCEPT);       // 关注「接受连接」事件
socketChannel.register(selector, SelectionKey.OP_READ, attachObj);  // 关注「可读」事件，带附件

// 四种事件类型（位掩码，可用 | 组合）
SelectionKey.OP_ACCEPT   // 1 << 4 = 16，服务端可接受新连接（仅 ServerSocketChannel）
SelectionKey.OP_CONNECT  // 1 << 3 = 8， 客户端连接完成（仅 SocketChannel）
SelectionKey.OP_READ     // 1 << 0 = 1， 通道可读
SelectionKey.OP_WRITE    // 1 << 2 = 4， 通道可写

// 事件循环（Reactor 模式的核心）
while (true) {
    // ① 阻塞等待至少一个 Channel 就绪
    int readyCount = selector.select();          // 阻塞直到有事件
    // selector.select(1000);                    // 最多阻塞 1 秒
    // selector.selectNow();                     // 非阻塞，立即返回
    // selector.wakeup();                        // 其他线程唤醒阻塞的 select

    if (readyCount == 0) continue;

    // ② 获取就绪的 SelectionKey 集合
    Set<SelectionKey> selectedKeys = selector.selectedKeys();
    Iterator<SelectionKey> iterator = selectedKeys.iterator();

    // ③ 遍历处理（★ 必须手动 remove，否则下次 select 会重复处理！）
    while (iterator.hasNext()) {
        SelectionKey key = iterator.next();
        iterator.remove();                        // ★★ 关键！

        try {
            if (key.isAcceptable()) {             // 新连接
                ServerSocketChannel server = (ServerSocketChannel) key.channel();
                SocketChannel client = server.accept();
                client.configureBlocking(false);
                client.register(selector, SelectionKey.OP_READ);
                System.out.println("新连接：" + client.getRemoteAddress());
            }
            else if (key.isReadable()) {          // 可读
                SocketChannel client = (SocketChannel) key.channel();
                ByteBuffer buf = ByteBuffer.allocate(1024);
                int len = client.read(buf);
                if (len > 0) {
                    buf.flip();
                    String msg = StandardCharsets.UTF_8.decode(buf).toString();
                    System.out.println("收到：" + msg);
                    // 处理完注册写事件
                    key.interestOps(SelectionKey.OP_WRITE);
                } else if (len == -1) {
                    key.cancel();                 // 客户端关闭
                    client.close();
                }
            }
            else if (key.isWritable()) {          // 可写
                SocketChannel client = (SocketChannel) key.channel();
                ByteBuffer buf = (ByteBuffer) key.attachment();   // 从附件取待写数据
                client.write(buf);
                if (!buf.hasRemaining()) {
                    key.interestOps(SelectionKey.OP_READ);        // 写完改回关注读
                }
            }
            else if (key.isConnectable()) {
                SocketChannel client = (SocketChannel) key.channel();
                client.finishConnect();
            }
        } catch (IOException e) {
            key.cancel();
            try { key.channel().close(); } catch (IOException ignored) { }
        }
    }
}
```

> 【坑】**`selectedKeys` 必须手动 `remove()`**：Selector 不会自动清除已处理的 key，下次 `select()` 会把上次的 key 一起返回，导致**重复处理同一事件**。这是 NIO 编程最常见的 bug。

**SelectionKey 的方法：**

```java
key.channel();             // 关联的 Channel
key.selector();            // 关联的 Selector
key.interestOps();         // 获取关注的事件集合
key.interestOps(OP_READ);  // 修改关注的事件
key.readyOps();            // 已就绪的事件集合
key.isReadable() / isWritable() / isAcceptable() / isConnectable();
key.attach(obj);           // 附加对象（存上下文，如 ByteBuffer、会话信息）
key.attachment();          // 获取附件
key.cancel();              // 取消注册（下次 select 时移除）
key.isValid();             // 是否有效
```

### 5.6 IO 多路复用的三种实现（select/poll/epoll）★★★★★

| 对比 | select | poll | **epoll** |
| --- | --- | --- | --- |
| 数据结构 | 位图 fd_set（固定 1024） | pollfd 数组（无上限） | 红黑树 + 就绪链表 |
| 最大连接数 | **1024**（FD_SETSIZE） | 无限制 | 无限制 |
| 每次调用 | **拷贝全部 fd 到内核** | 同 select | **只在内核注册一次**（epoll_ctl） |
| 查找就绪 fd | **O(n) 遍历全部** | O(n) | **O(1)** 回调放入就绪链表 |
| 触发模式 | 水平触发 LT | 水平触发 LT | **LT + ET（边缘触发）** |
| 性能 | 连接数多时急剧下降 | 同 select | **连接数越多优势越大** |
| 平台 | 全平台 | 全平台 | **仅 Linux 2.6+** |
| Java 使用 | Windows 上的 Selector | — | **Linux 上的 Selector（JDK 默认）** |

**epoll 的三个系统调用：**

```c
int epoll_create(int size);                              // 创建 epoll 实例（红黑树 + 就绪链表）
int epoll_ctl(int epfd, int op, int fd, struct epoll_event *event);  // 增删改监听（只注册一次！）
int epoll_wait(int epfd, struct epoll_event *events, int maxevents, int timeout);  // 等待就绪事件（返回就绪列表）
```

**为什么 epoll 高效：**
1. **不重复拷贝 fd**：`epoll_ctl` 注册后 fd 常驻内核红黑树，`epoll_wait` 不需要每次传全部 fd（select 每次都要把 1024 个 fd 从用户态拷到内核态）。
2. **不遍历全部 fd**：网卡数据到达时，内核通过**回调机制**把就绪的 fd 挂到就绪链表，`epoll_wait` 直接返回这个链表，O(1) 而非 O(n)。
3. **支持边缘触发（ET）**：只在状态变化时通知一次（LT 是只要可读就一直通知），减少重复唤醒。

**LT vs ET：**

| | 水平触发 LT（Level Triggered） | 边缘触发 ET（Edge Triggered） |
| --- | --- | --- |
| 通知条件 | **只要缓冲区有数据就一直通知** | **只在状态变化时通知一次** |
| 编程难度 | 简单（可以不读完） | 难（必须一次读完，否则数据滞留） |
| 性能 | 略低（重复唤醒） | 高 |
| Java NIO | **默认 LT** | Netty 可配（`EpollChannelOption.EPOLLET`） |

### 5.7 零拷贝（Zero Copy）★★★★★

**传统 IO 的 4 次拷贝 + 4 次上下文切换：**

```
read(file, buf)  +  write(socket, buf) 的完整过程：

① DMA 拷贝：磁盘 → 内核页缓存（PageCache）        [DMA，CPU 不参与]
② CPU 拷贝：内核页缓存 → 用户缓冲区（Java byte[]）  [CPU 参与 ★浪费]
③ CPU 拷贝：用户缓冲区 → Socket 缓冲区              [CPU 参与 ★浪费]
④ DMA 拷贝：Socket 缓冲区 → 网卡                    [DMA]

上下文切换：用户态→内核态(read)、内核态→用户态、用户态→内核态(write)、内核态→用户态 = 4 次
```

**零拷贝方案：**

| 方案 | 原理 | 拷贝次数 | Java API |
| --- | --- | --- | --- |
| **mmap + write** | 内存映射，用户空间与内核共享页缓存 | 3 次 DMA + 1 次 CPU | `FileChannel.map()` |
| **sendfile** | 内核内部直接传输（Linux 2.4+） | **2 次 DMA + 0 次 CPU** | `FileChannel.transferTo()` |
| **sendfile + DMA gather** | 只传描述符给 Socket，数据由 DMA 直接从 PageCache 收集 | **2 次 DMA，0 次 CPU** | 同上（底层自动） |
| **splice** | 通过管道在两个 fd 间传输 | 2 次 DMA | — |

```java
// Java 的零拷贝 API
// 1. transferTo（sendfile）
fileChannel.transferTo(0, fileChannel.size(), socketChannel);
// 场景：文件下载、Kafka 消费（Kafka 的高吞吐核心就是 sendfile）

// 2. transferFrom
socketChannel.transferFrom(fileChannel, 0, fileChannel.size());

// 3. mmap（内存映射）
MappedByteBuffer mbb = fileChannel.map(FileChannel.MapMode.READ_ONLY, 0, size);
// 场景：超大文件随机读取、RocketMQ 的 CommitLog

// 4. FileChannel + 复合缓冲区（减少 write 次数）
ByteBuffer[] buffers = {header, body, footer};
channel.write(buffers);                    // Gathering Write（聚集写）
channel.read(buffers);                     // Scattering Read（分散读）
```

**零拷贝的实际应用：**

| 中间件 | 零拷贝应用 |
| --- | --- |
| **Kafka** | 消费消息时用 `sendfile` 直接从 PageCache 发到网卡，吞吐量的核心保障 |
| **RocketMQ** | CommitLog 用 `mmap`（MappedByteBuffer）读写 |
| **Netty** | `FileRegion`（transferTo）、`CompositeByteBuf`（逻辑合并，避免内存拷贝） |
| **Nginx** | `sendfile on;` 配置项 |
| **Redis** | RDB/AOF 持久化、主从复制的部分场景 |

### 5.8 Files 与 Path（JDK 7+ 的现代文件 API）★★★★★

**这是日常开发最应该用的 API，比 java.io.File 强大太多。**

```java
import java.nio.file.*;
import java.nio.file.attribute.*;

// ─── Path：路径对象（替代 File）───
Path path = Paths.get("/Users/mac/data/test.txt");
Path path2 = Path.of("/Users", "mac", "data");          // JDK 11+
Path path3 = FileSystems.getDefault().getPath("/tmp/a.txt");

path.getFileName();          // test.txt
path.getParent();            // /Users/mac/data
path.getRoot();              // /
path.getNameCount();         // 4（路径元素个数）
path.getName(1);             // mac
path.subpath(1, 3);          // mac/data
path.resolve("sub/file.txt");// /Users/mac/data/sub/file.txt（拼接）
path.resolveSibling("x.txt");// /Users/mac/data/x.txt
path.relativize(otherPath);  // 相对路径
path.normalize();            // 消除 . 和 ..
path.toAbsolutePath();       // 转绝对路径
path.toUri();                // file:///Users/mac/data/test.txt
path.toFile();               // 转回 File（兼容老 API）

// ─── Files：静态工具类（超全）───

// 存在性与属性
Files.exists(path);
Files.notExists(path);
Files.isReadable(path); Files.isWritable(path); Files.isExecutable(path);
Files.isRegularFile(path); Files.isDirectory(path);
Files.isHidden(path);
Files.size(path);                        // 字节数
Files.getLastModifiedTime(path);         // 修改时间
Files.setLastModifiedTime(path, FileTime.fromMillis(t));
Files.getOwner(path);
Files.readAttributes(path, "*");         // 所有属性（Map）
Files.readAttributes(path, BasicFileAttributes.class);
Files.probeContentType(path);            // 猜测 MIME 类型
Files.getFileStore(path);                // 磁盘信息（总空间、可用空间）

// 读写（小文件一行搞定）
byte[] bytes = Files.readAllBytes(path);                    // 读全部字节
String content = Files.readString(path);                    // JDK 11+ 读全部文本
String content2 = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);   // 读所有行
Files.write(path, bytes);                                   // 写字节（覆盖）
Files.write(path, lines, StandardCharsets.UTF_8);           // 写行
Files.writeString(path, "hello", StandardCharsets.UTF_8);   // JDK 11+
Files.write(path, data, StandardOpenOption.APPEND);         // 追加
Files.write(path, data, StandardOpenOption.CREATE_NEW);     // 不存在才创建（原子）

// 流式处理大文件（不 OOM）
try (Stream<String> lines = Files.lines(path, StandardCharsets.UTF_8)) {
    long errorCount = lines.filter(l -> l.contains("ERROR")).count();
}
try (Stream<Path> paths = Files.walk(dir)) { ... }          // 递归遍历目录树
Files.lines(path).forEach(System.out::println);
Files.newBufferedReader(path, StandardCharsets.UTF_8);       // BufferedReader
Files.newBufferedWriter(path, StandardCharsets.UTF_8);
Files.newInputStream(path);                                  // InputStream
Files.newOutputStream(path);
Files.newByteChannel(path);                                  // SeekableByteChannel

// 文件操作
Files.createFile(path);                       // 创建文件（已存在则抛异常）
Files.createDirectory(path);                  // 创建单级目录
Files.createDirectories(path);                // ★ 创建多级目录（自动建父目录）
Files.createTempFile("prefix", ".tmp");       // 临时文件
Files.createTempDirectory("prefix");
Files.delete(path);                           // 删除（不存在抛异常）
Files.deleteIfExists(path);                   // 删除（不存在返回 false）
Files.copy(src, dest, StandardCopyOption.REPLACE_EXISTING);        // 复制
Files.copy(inputStream, dest);                // 流 → 文件
Files.move(src, dest, StandardCopyOption.ATOMIC_MOVE);             // 移动/重命名
Files.createLink(link, target);               // 硬链接
Files.createSymbolicLink(link, target);       // 软链接
Files.readSymbolicLink(link);

// 权限（POSIX）
Files.setPosixFilePermissions(path, PosixFilePermissions.fromString("rwxr-xr--"));
Set<PosixFilePermission> perms = Files.getPosixFilePermissions(path);

// 遍历目录
try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir, "*.java")) {
    for (Path p : stream) { System.out.println(p); }
}

// 递归遍历（Files.walk，深度优先）
try (Stream<Path> paths = Files.walk(Paths.get("/src"))) {
    List<Path> javaFiles = paths
        .filter(Files::isRegularFile)
        .filter(p -> p.toString().endsWith(".java"))
        .collect(Collectors.toList());
}

// 查找（带深度和条件）
try (Stream<Path> paths = Files.find(dir, 5,
        (p, attrs) -> attrs.isRegularFile() && p.toString().contains("Test"))) {
    paths.forEach(System.out::println);
}

// 遍历并处理每个文件（FileVisitor，可精细控制）
Files.walkFileTree(dir, new SimpleFileVisitor<Path>() {
    @Override
    public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
        System.out.println("进入目录：" + dir);
        return FileVisitResult.CONTINUE;         // 也可 SKIP_SUBTREE、SKIP_SIBLINGS、TERMINATE
    }
    @Override
    public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
        System.out.println("文件：" + file + "，大小：" + attrs.size());
        return FileVisitResult.CONTINUE;
    }
    @Override
    public FileVisitResult visitFileFailed(Path file, IOException exc) {
        System.err.println("访问失败：" + file);
        return FileVisitResult.CONTINUE;         // 继续而非中断
    }
    @Override
    public FileVisitResult postVisitDirectory(Path dir, IOException exc) {
        System.out.println("离开目录：" + dir);
        return FileVisitResult.CONTINUE;
    }
});

// 监控文件变化（WatchService）
WatchService watcher = FileSystems.getDefault().newWatchService();
dir.register(watcher,
    StandardWatchEventKinds.ENTRY_CREATE,
    StandardWatchEventKinds.ENTRY_MODIFY,
    StandardWatchEventKinds.ENTRY_DELETE);
while (true) {
    WatchKey key = watcher.take();               // 阻塞等待事件
    for (WatchEvent<?> event : key.pollEvents()) {
        System.out.println(event.kind() + ": " + event.context());
    }
    key.reset();                                 // ★ 必须 reset 才能继续接收
}
```

**StandardOpenOption（文件打开选项）：**

| 选项 | 含义 |
| --- | --- |
| `READ` | 读 |
| `WRITE` | 写 |
| `APPEND` | 追加到末尾 |
| `CREATE` | 不存在则创建 |
| `CREATE_NEW` | 不存在才创建，**已存在则抛异常**（原子操作，防并发覆盖） |
| `TRUNCATE_EXISTING` | 存在则截断为 0 |
| `DELETE_ON_CLOSE` | 关闭时删除（临时文件） |
| `SPARSE` | 稀疏文件 |
| `SYNC` | 每次更新都同步到磁盘 |
| `DSYNC` | 只同步数据不同步元数据 |

### 5.9 File 类（老 API，仍需了解）

```java
File file = new File("/Users/mac/test.txt");
File file2 = new File("/Users/mac", "test.txt");
File file3 = new File(parentFile, "test.txt");

// 属性（注意：这些方法不访问文件内容，只看路径/元数据）
file.getName();              // test.txt
file.getPath();              // /Users/mac/test.txt（构造时传的路径）
file.getAbsolutePath();      // 绝对路径
file.getCanonicalPath();     // 规范路径（解析了 .. 和软链接，会抛 IOException）
file.getParent();            // /Users/mac
file.length();               // 字节数（目录返回值无意义）
file.lastModified();         // 最后修改时间戳
file.exists();
file.isFile();
file.isDirectory();
file.isHidden();
file.canRead(); file.canWrite(); file.setReadOnly();
file.setExecutable(true); file.setWritable(true);

// 操作
file.createNewFile();        // 创建（已存在返回 false）★ 抛 IOException
file.mkdir();                // 创建单级目录（父目录不存在则失败）
file.mkdirs();               // ★ 创建多级目录
file.delete();               // 删除（目录非空则失败）
file.deleteOnExit();         // JVM 退出时删除
file.renameTo(newFile);      // 重命名/移动（跨文件系统可能失败！）
file.list();                 // String[] 子项名称
file.listFiles();            // File[] 子项
file.listFiles((dir, name) -> name.endsWith(".java"));   // 过滤器
file.listFiles(File::isDirectory);

// 磁盘空间
file.getTotalSpace();        // 总空间
file.getFreeSpace();         // 空闲空间
file.getUsableSpace();       // 可用空间（考虑权限）

// 临时文件
File.createTempFile("prefix", ".tmp");
File.createTempFile("prefix", ".tmp", dir);

// File 的坑
// 1. delete() 不抛异常只返回 boolean，容易忽略失败
if (!file.delete()) { log.warn("删除失败：{}", file); }
// 2. renameTo 跨文件系统/磁盘会失败，且不抛异常
//    → 用 Files.move(src, dest, StandardCopyOption.REPLACE_EXISTING)
// 3. 路径分隔符要用 File.separator（Windows 是 \，Linux 是 /）
//    → 用 Paths.get() 自动处理
// 4. list() 在目录不存在或不是目录时返回 null（不是空数组！）→ NPE 隐患
```

> 【推荐】**新代码一律用 `Path` + `Files`**，`File` 只在与老 API 交互时用（`path.toFile()` / `file.toPath()`）。Files 的方法**都会抛 IOException**（明确失败），而 File 的方法很多是返回 boolean（容易忽略）。

### 5.10 压缩与解压

```java
import java.util.zip.*;

// ZIP 压缩（多文件）
public void zip(List<File> files, File zipFile) throws IOException {
    try (ZipOutputStream zos = new ZipOutputStream(
            new BufferedOutputStream(new FileOutputStream(zipFile)), StandardCharsets.UTF_8)) {
        for (File file : files) {
            zos.putNextEntry(new ZipEntry(file.getName()));        // ★ 开始一个条目
            Files.copy(file.toPath(), zos);                        // 写入内容
            zos.closeEntry();                                       // ★ 结束条目
        }
    }
}

// ZIP 解压（⚠️ 注意 Zip Slip 漏洞！）
public void unzip(File zipFile, File destDir) throws IOException {
    Files.createDirectories(destDir.toPath());
    try (ZipInputStream zis = new ZipInputStream(
            new BufferedInputStream(new FileInputStream(zipFile)), StandardCharsets.UTF_8)) {
        ZipEntry entry;
        byte[] buffer = new byte[8192];
        while ((entry = zis.getNextEntry()) != null) {
            File outFile = new File(destDir, entry.getName());
            // ★ 安全校验：防止 Zip Slip（../ 路径穿越攻击）
            if (!outFile.getCanonicalPath().startsWith(destDir.getCanonicalPath())) {
                throw new IOException("非法的压缩条目（路径穿越）：" + entry.getName());
            }
            if (entry.isDirectory()) {
                Files.createDirectories(outFile.toPath());
            } else {
                Files.createDirectories(outFile.getParentFile().toPath());
                try (OutputStream os = new BufferedOutputStream(new FileOutputStream(outFile))) {
                    int len;
                    while ((len = zis.read(buffer)) > 0) os.write(buffer, 0, len);
                }
            }
            zis.closeEntry();
        }
    }
}

// GZIP（单流压缩，常用于 HTTP 响应压缩）
try (GZIPOutputStream gos = new GZIPOutputStream(new FileOutputStream("data.gz"))) {
    gos.write(data);
}
try (GZIPInputStream gis = new GZIPInputStream(new FileInputStream("data.gz"))) {
    byte[] result = gis.readAllBytes();
}

// 压缩级别
zos.setLevel(Deflater.BEST_COMPRESSION);      // 最高压缩（慢）
zos.setLevel(Deflater.BEST_SPEED);            // 最快速度（压缩率低）
zos.setLevel(Deflater.NO_COMPRESSION);        // 只打包不压缩

// ZipEntry 属性
entry.getName(); entry.getSize(); entry.getCompressedSize();
entry.getTime(); entry.getCrc(); entry.isDirectory();
entry.setMethod(ZipEntry.STORED);             // 存储（不压缩）vs DEFLATED（压缩）

// Apache Commons Compress（支持更多格式：tar、7z、bzip2、xz）
// Maven: org.apache.commons:commons-compress
```

> 【安全】**Zip Slip 漏洞（CVE-2018-1002200）**：恶意压缩包中的条目名为 `../../../etc/passwd`，解压时会写到目标目录之外，覆盖系统文件。**必须校验 `getCanonicalPath().startsWith(destDir)`**。

## 6. IO 实战场景汇总

```java
// 场景 1：MultipartFile 保存（Spring Boot 文件上传）
@PostMapping("/upload")
public Result<String> upload(@RequestParam("file") MultipartFile file) throws IOException {
    if (file.isEmpty()) return Result.failed("文件为空");
    // 校验类型和大小
    String originalName = file.getOriginalFilename();
    String ext = FilenameUtils.getExtension(originalName);
    if (!Arrays.asList("jpg", "png", "pdf").contains(ext.toLowerCase())) {
        return Result.failed("不支持的文件类型");
    }
    // 用 UUID 重命名，防止路径穿越和文件名冲突
    String newName = UUID.randomUUID().toString().replace("-", "") + "." + ext;
    Path target = Paths.get(uploadDir, LocalDate.now().toString(), newName);
    Files.createDirectories(target.getParent());
    try (InputStream in = file.getInputStream()) {
        Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);   // ★ 流式复制，不占内存
    }
    // 或用 transferTo（更快，直接移动到目标）
    // file.transferTo(target.toFile());
    return Result.success("/files/" + target.getFileName());
}

// 场景 2：文件下载（响应流）
@GetMapping("/download/{fileName}")
public void download(@PathVariable String fileName, HttpServletResponse response) throws IOException {
    Path file = Paths.get(uploadDir).resolve(fileName).normalize();
    // ★ 安全校验：防止路径穿越
    if (!file.startsWith(Paths.get(uploadDir))) {
        response.sendError(403); return;
    }
    if (!Files.exists(file)) { response.sendError(404); return; }

    response.setContentType(Files.probeContentType(file));
    response.setContentLengthLong(Files.size(file));
    response.setHeader("Content-Disposition",
        "attachment; filename=\"" + URLEncoder.encode(fileName, StandardCharsets.UTF_8) + "\"");

    try (InputStream in = Files.newInputStream(file);
         OutputStream out = response.getOutputStream()) {
        in.transferTo(out);                            // JDK 9+ 一行搞定
        out.flush();
    }
}

// 场景 3：大文件分片读取（导入 Excel/CSV 百万行）
public void importLargeCsv(Path file) throws IOException {
    try (BufferedReader br = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
        List<User> batch = new ArrayList<>(1000);
        String line;
        boolean isFirst = true;
        while ((line = br.readLine()) != null) {
            if (isFirst) { isFirst = false; continue; }      // 跳过表头
            batch.add(parseLine(line));
            if (batch.size() >= 1000) {
                userMapper.batchInsert(batch);               // 批量入库
                batch.clear();                                // ★ 清空，控制内存
            }
        }
        if (!batch.isEmpty()) userMapper.batchInsert(batch);  // 处理剩余
    }
}

// 场景 4：日志按天归档 + 压缩
public void archiveLog(Path logFile) throws IOException {
    String date = LocalDate.now().minusDays(1).toString();
    Path zipFile = Paths.get(logFile.getParent().toString(), "log-" + date + ".zip");
    try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zipFile))) {
        zos.putNextEntry(new ZipEntry(logFile.getFileName().toString()));
        Files.copy(logFile, zos);
        zos.closeEntry();
    }
    Files.deleteIfExists(logFile);
}

// 场景 5：计算文件 MD5/SHA-256（秒传、完整性校验）
public String md5(Path file) throws Exception {
    MessageDigest md = MessageDigest.getInstance("MD5");
    try (InputStream in = Files.newInputStream(file)) {
        byte[] buf = new byte[8192];
        int len;
        while ((len = in.read(buf)) != -1) md.update(buf, 0, len);
    }
    return Hex.encodeHexString(md.digest());     // Apache Commons Codec
    // 或 DigestUtils.md5Hex(Files.newInputStream(file));
}
// JDK 自带 Base64/Hex（JDK 17+）
HexFormat.of().formatHex(md.digest());

// 场景 6：统计目录大小
public long dirSize(Path dir) throws IOException {
    try (Stream<Path> paths = Files.walk(dir)) {
        return paths.filter(Files::isRegularFile)
                    .mapToLong(f -> { try { return Files.size(f); } catch (IOException e) { return 0; } })
                    .sum();
    }
}

// 场景 7：递归删除目录
public void deleteDirectory(Path dir) throws IOException {
    try (Stream<Path> paths = Files.walk(dir)) {
        paths.sorted(Comparator.reverseOrder())          // ★ 逆序：先删文件再删目录
             .forEach(p -> { try { Files.delete(p); } catch (IOException e) { /* log */ } });
    }
}
// Apache Commons: FileUtils.deleteDirectory(dir.toFile());

// 场景 8：Properties 配置文件读写
Properties props = new Properties();
try (InputStream in = Files.newInputStream(Paths.get("config.properties"))) {
    props.load(new InputStreamReader(in, StandardCharsets.UTF_8));   // ★ 中文需 UTF-8
}
String value = props.getProperty("key", "defaultValue");
try (OutputStream out = Files.newOutputStream(Paths.get("config.properties"))) {
    props.setProperty("key", "value");
    props.store(new OutputStreamWriter(out, StandardCharsets.UTF_8), "配置文件注释");
}

// 场景 9：读写 classpath 下的资源文件
// Spring 方式
Resource resource = new ClassPathResource("templates/email.html");
String content = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
// 或 ResourceUtils.getFile("classpath:xxx")  ← ⚠️ 打成 jar 后会失败！
// 纯 JDK
try (InputStream in = MyClass.class.getClassLoader().getResourceAsStream("config/app.yml")) {
    if (in == null) throw new FileNotFoundException("资源不存在");
    String yaml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
}
// ⚠️ 打成 jar 后无法用 File 访问 classpath 资源，只能用 InputStream！
```

## 7. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `out.write(buffer)` 未指定 len | 文件末尾多出脏数据、体积变大 | `write(buffer, 0, len)` |
| 2 | 单字节 read/write 复制大文件 | 慢 100 倍 | 用 byte[] 缓冲或 `Files.copy` |
| 3 | 忘记 flush（字符流） | 文件内容不完整 | try-with-resources 自动 close+flush |
| 4 | 忘记 close | 文件句柄泄漏（`Too many open files`） | try-with-resources |
| 5 | `FileReader` 编码问题 | 跨平台中文乱码 | `InputStreamReader` + 显式编码 |
| 6 | `getBytes()` 不指定编码 | 平台默认编码，乱码 | `getBytes(StandardCharsets.UTF_8)` |
| 7 | `readAllLines` 读大文件 | OOM | `Files.lines()` 流式处理 |
| 8 | NIO Buffer 忘记 `flip()` | 读不到数据（position 在末尾） | 写完必须 flip |
| 9 | `clear()` 与 `compact()` 混淆 | 数据丢失 | clear 是全清，compact 保留未读数据 |
| 10 | selectedKeys 未 remove | 事件重复处理 | `iterator.remove()` |
| 11 | 直接内存未释放 | `OOM: Direct buffer memory` | 复用 Buffer / 限制 MaxDirectMemorySize |
| 12 | 序列化类未声明 serialVersionUID | 类改动后旧数据无法反序列化 | 显式声明 `1L` |
| 13 | 引用对象未实现 Serializable | `NotSerializableException` | 全链路实现或标 transient |
| 14 | 单例被反序列化破坏 | 出现多个实例 | `readResolve()` 或用枚举单例 |
| 15 | 反序列化不可信数据 | RCE 安全漏洞 | 白名单过滤 / 改用 JSON |
| 16 | `Files.lines` 的 Stream 未关闭 | 文件句柄泄漏 | try-with-resources |
| 17 | Zip 解压路径穿越 | 文件写到目录外（Zip Slip） | 校验 canonicalPath |
| 18 | `file.renameTo` 跨盘失败 | 返回 false 无异常 | `Files.move` |
| 19 | `file.delete()` 返回值被忽略 | 删除失败无感知 | 判断返回值或 `Files.delete` |
| 20 | `file.list()` 返回 null | NPE | 判空或用 `Files.list` |
| 21 | jar 包内用 File 读 classpath 资源 | `FileNotFoundException` | 用 `getResourceAsStream` |
| 22 | `RandomAccessFile.readLine()` 中文乱码 | ISO-8859-1 解码 | 重新按 UTF-8 解码 |
| 23 | Socket 未设超时 | 线程永久阻塞 | `setSoTimeout` / `connect(addr, timeout)` |
| 24 | 上传大文件全读入内存 | OOM | 流式处理（`Files.copy(in, target)`） |
| 25 | Buffered 流嵌套过深 | 内存浪费、可读性差 | 一层缓冲足够 |

---

## 关联笔记

- 上一篇：[[后端/Java基础/泛型枚举与注解]]
- 下一篇：[[后端/Java基础/反射与动态代理]]
- 相关：[[后端/Java基础/网络编程]]（Socket IO）、[[后端/Java基础/异常处理]]（try-with-resources）
- 进阶：[[后端/中间件/Netty与网络IO模型]]（NIO 的工业级封装、Reactor 模式）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
