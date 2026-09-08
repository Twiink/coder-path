---
title: "网络编程"
aliases:
  - "Socket 编程"
  - "Java 网络编程"
tags:
  - "后端"
  - "java"
  - "网络"
  - "笔记"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/IO流与文件操作]]"
  - "[[后端/JavaWeb/Web基础与HTTP协议]]"
  - "[[后端/中间件/Netty与网络IO模型]]"
  - "[[计算机基础/计算机网络/计算机网络第6章（应用层）]]"
created: 2026-09-06
updated: 2026-09-06
---

# Java 网络编程

> 网络协议原理（TCP 三次握手、HTTP 报文、HTTPS 握手）见 [[后端/JavaWeb/Web基础与HTTP协议]] 与 [[计算机基础/计算机网络/计算机网络第6章（应用层）]]；本篇聚焦 **Java 的网络 API 实现**：Socket、URL、HttpClient、NIO 网络编程。

## 1. 网络编程基础

### 1.1 三要素：IP、端口、协议

| 要素 | 作用 | Java 类 |
| --- | --- | --- |
| **IP 地址** | 定位网络中的主机 | `InetAddress`、`Inet4Address`、`Inet6Address` |
| **端口号** | 定位主机上的进程（0~65535） | `Socket` 的参数 |
| **传输协议** | 数据传输规则（TCP/UDP） | `Socket`（TCP）、`DatagramSocket`（UDP） |

**端口分类：**

| 范围 | 类型 | 示例 |
| --- | --- | --- |
| 0~1023 | **公认端口**（Well-Known，需 root 权限） | 20/21 FTP、22 SSH、23 Telnet、25 SMTP、53 DNS、80 HTTP、110 POP3、143 IMAP、443 HTTPS、3306 MySQL、6379 Redis、5672 RabbitMQ、8848 Nacos、2181 ZooKeeper、9092 Kafka |
| 1024~49151 | **注册端口** | 8080 Tomcat、3000 前端、9200 Elasticsearch |
| 49152~65535 | **动态/私有端口** | 客户端临时端口 |

### 1.2 InetAddress（IP 地址封装）

```java
import java.net.*;

// ─── 获取 InetAddress ───
InetAddress local = InetAddress.getLocalHost();          // 本机地址
InetAddress byName = InetAddress.getByName("www.baidu.com");   // 域名 → IP（触发 DNS 查询！）
InetAddress byIp = InetAddress.getByName("192.168.1.1");       // IP 字符串
InetAddress loopback = InetAddress.getLoopbackAddress();       // 127.0.0.1
InetAddress[] all = InetAddress.getAllByName("www.qq.com");    // 一个域名多个 IP
InetAddress anyLocal = InetAddress.getByAddress(new byte[]{0,0,0,0});   // 0.0.0.0

// ─── 常用方法 ───
local.getHostAddress();          // "192.168.1.100"（IP 字符串）
local.getHostName();             // "MacBook-Pro.local"（主机名，可能触发反向 DNS）
local.getCanonicalHostName();    // 完全限定域名（FQDN）
local.getAddress();              // byte[]（4 字节 IPv4 或 16 字节 IPv6）
local.isLoopbackAddress();       // 是否 127.x.x.x
local.isSiteLocalAddress();      // 是否内网地址（192.168.x、10.x、172.16~31.x）
local.isAnyLocalAddress();       // 是否 0.0.0.0
local.isLinkLocalAddress();      // 是否 169.254.x.x
local.isMulticastAddress();      // 是否组播地址（224~239.x.x.x）
local.isReachable(3000);         // ★ ping 测试（3 秒超时，需要权限，实际常失败）

// ─── 实用工具：获取本机真实 IP（多网卡场景）───
public static String getLocalIp() throws SocketException {
    Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
    while (interfaces.hasMoreElements()) {
        NetworkInterface ni = interfaces.nextElement();
        if (ni.isLoopback() || ni.isVirtual() || !ni.isUp()) continue;    // 跳过回环/虚拟/未启用
        Enumeration<InetAddress> addresses = ni.getInetAddresses();
        while (addresses.hasMoreElements()) {
            InetAddress addr = addresses.nextElement();
            if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                return addr.getHostAddress();
            }
        }
    }
    return "127.0.0.1";
}

// ─── NetworkInterface（网卡信息）───
NetworkInterface ni = NetworkInterface.getByName("en0");
ni.getDisplayName();             // "en0"
ni.getHardwareAddress();         // MAC 地址 byte[]
ni.getMTU();                     // 最大传输单元
ni.isUp(); ni.isLoopback(); ni.isVirtual(); ni.supportsMulticast();
NetworkInterface.getByInetAddress(local);

// ─── IP 与 long 互转（IP 段查询、限流常用）───
public static long ipToLong(String ip) {
    String[] parts = ip.split("\\.");
    long result = 0;
    for (int i = 0; i < 4; i++) {
        result = (result << 8) | Integer.parseInt(parts[i]);
    }
    return result;
}
public static String longToIp(long ip) {
    return ((ip >> 24) & 0xFF) + "." + ((ip >> 16) & 0xFF) + "."
         + ((ip >> 8) & 0xFF) + "." + (ip & 0xFF);
}
```

> 【坑】**`InetAddress.getByName("域名")` 是阻塞的 DNS 查询**，可能耗时数百毫秒甚至超时。高频调用必须缓存结果，或用专门的 DNS 解析器（Netty 的 `DnsAddressResolverGroup`）。JVM 有 DNS 缓存：`networkaddress.cache.ttl`（默认成功缓存 30 秒，失败 10 秒；有 SecurityManager 时永久缓存）。

### 1.3 TCP vs UDP

| 对比 | TCP | UDP |
| --- | --- | --- |
| 连接性 | **面向连接**（三次握手） | 无连接 |
| 可靠性 | **可靠**（确认、重传、排序） | 不可靠（尽力而为） |
| 传输形式 | **字节流**（无边界，会粘包） | **数据报**（有边界，最大 64KB） |
| 速度 | 慢（有拥塞控制、确认开销） | **快** |
| 头部开销 | 20~60 字节 | **8 字节** |
| 一对一 | 是（点对点） | 支持一对一、一对多、多对多（广播/组播） |
| 资源占用 | 高（连接状态、缓冲区） | 低 |
| Java 类 | `Socket`、`ServerSocket` | `DatagramSocket`、`DatagramPacket` |
| 适用场景 | HTTP、文件传输、数据库、RPC | DNS、视频直播、语音、游戏、广播、QUIC(HTTP/3) |

## 2. TCP 编程（Socket）

### 2.1 最简单的 TCP 通信

```java
// ─── 服务端 ───
import java.io.*;
import java.net.*;

public class TcpServer {
    public static void main(String[] args) throws IOException {
        // 1. 创建 ServerSocket，绑定端口
        try (ServerSocket serverSocket = new ServerSocket(8888)) {
            System.out.println("服务端启动，等待连接...");

            while (true) {
                // 2. ★ 阻塞等待客户端连接
                Socket socket = serverSocket.accept();
                System.out.println("客户端已连接：" + socket.getInetAddress().getHostAddress()
                                 + ":" + socket.getPort());

                // 3. 每个连接一个线程处理（BIO 模型）
                new Thread(() -> handle(socket)).start();
            }
        }
    }

    private static void handle(Socket socket) {
        try (Socket s = socket;
             // 4. 获取输入流（读客户端数据）
             BufferedReader in = new BufferedReader(
                 new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
             // 5. 获取输出流（写数据给客户端）
             PrintWriter out = new PrintWriter(
                 new OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8), true);  // autoFlush
        ) {
            String line;
            while ((line = in.readLine()) != null) {
                System.out.println("收到：" + line);
                if ("bye".equalsIgnoreCase(line)) {
                    out.println("再见！");
                    break;
                }
                out.println("服务端回显：" + line.toUpperCase());
            }
        } catch (IOException e) {
            System.err.println("处理客户端异常：" + e.getMessage());
        }
    }
}

// ─── 客户端 ───
public class TcpClient {
    public static void main(String[] args) throws IOException {
        // 1. 创建 Socket 并连接服务端（构造器内完成三次握手）
        try (Socket socket = new Socket("127.0.0.1", 8888);
             PrintWriter out = new PrintWriter(
                 new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8), true);
             BufferedReader in = new BufferedReader(
                 new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             BufferedReader console = new BufferedReader(
                 new InputStreamReader(System.in, StandardCharsets.UTF_8))) {

            System.out.println("已连接到服务端，输入消息（bye 退出）：");
            String userInput;
            while ((userInput = console.readLine()) != null) {
                out.println(userInput);                          // 发送
                String response = in.readLine();                  // ★ 阻塞等待响应
                System.out.println("服务端：" + response);
                if ("bye".equalsIgnoreCase(userInput)) break;
            }
        }
    }
}
```

### 2.2 Socket 与 ServerSocket 的完整 API

```java
// ─── Socket（客户端 / 服务端接受的连接）───

// 创建方式
new Socket();                                        // 未连接，需手动 connect
new Socket("host", 8080);                            // 创建并连接（阻塞直到成功或失败）
new Socket("host", 8080, localAddr, localPort);      // 指定本地地址和端口
new Socket(InetAddress addr, int port);
new Socket(Proxy proxy);                             // 通过代理连接

Socket socket = new Socket();
socket.connect(new InetSocketAddress("host", 8080), 5000);   // ★ 带超时的连接（推荐！）

// 读写
socket.getInputStream();          // InputStream（读对方发来的数据）
socket.getOutputStream();         // OutputStream（写数据给对方）
socket.getChannel();              // SocketChannel（NIO 用）

// ★ 关键配置（必须在读写前设置）
socket.setSoTimeout(10000);       // 读超时（毫秒），read() 阻塞超过此值抛 SocketTimeoutException
socket.setTcpNoDelay(true);       // ★ 禁用 Nagle 算法（低延迟，小包立即发送）
socket.setKeepAlive(true);        // ★ TCP 保活（探测死连接，默认 2 小时才开始探测！）
socket.setSoLinger(true, 5);      // 关闭时最多等待 5 秒发送剩余数据
socket.setReuseAddress(true);     // 地址复用（TIME_WAIT 状态下可重新绑定）
socket.setReceiveBufferSize(64 * 1024);   // 接收缓冲区大小
socket.setSendBufferSize(64 * 1024);      // 发送缓冲区大小
socket.setOOBInline(true);        // 带外数据内联
socket.setPerformancePreferences(1, 2, 3); // 连接时间、延迟、带宽的相对重要性

// 状态查询
socket.getInetAddress();          // 对方 IP
socket.getPort();                 // 对方端口
socket.getLocalAddress();         // 本地 IP
socket.getLocalPort();            // 本地端口
socket.getRemoteSocketAddress();
socket.isConnected();             // ★ 曾经连接过（不代表现在通！）
socket.isClosed();                // 是否已关闭
socket.isBound();                 // 是否已绑定
socket.isInputShutdown();
socket.isOutputShutdown();
socket.getTcpNoDelay(); socket.getKeepAlive(); socket.getSoTimeout();

// 半关闭（优雅关闭）
socket.shutdownInput();           // 关闭输入（还能发送）
socket.shutdownOutput();          // ★ 关闭输出（发送 FIN，还能接收）
socket.close();                   // 完全关闭

// 发送紧急数据
socket.sendUrgentData(0xFF);      // 常用于检测连接是否存活

// ─── ServerSocket（服务端）───
ServerSocket server = new ServerSocket(8888);                    // 绑定端口，backlog 默认 50
ServerSocket server2 = new ServerSocket(8888, 128);              // ★ backlog = 等待队列长度
ServerSocket server3 = new ServerSocket(8888, 128,
        InetAddress.getByName("192.168.1.100"));                  // 绑定指定网卡
ServerSocket server4 = new ServerSocket();
server4.bind(new InetSocketAddress(8888), 128);
server4.setReuseAddress(true);                                   // ★ 必须在 bind 之前设置
server4.setReceiveBufferSize(65536);
server4.setSoTimeout(0);                                          // accept 超时（0 = 永不超时）

server.accept();                  // ★ 阻塞等待连接，返回 Socket
server.close();                   // 关闭监听
server.isClosed(); server.isBound();
server.getInetAddress(); server.getLocalPort();
server.setPerformancePreferences(1, 2, 3);
```

**backlog 参数（半连接 + 全连接队列）：**

```java
new ServerSocket(8888, 1024);      // backlog = 1024
```

- **backlog** 是「已完成三次握手但还没被 `accept()` 取走」的连接队列长度（**全连接队列 accept queue**）。
- 队列满后，新的连接请求会被**拒绝或丢弃**（Linux 默认丢 SYN，客户端表现为连接超时）。
- Linux 实际上限还受 `net.core.somaxconn`（默认 128）和 `net.ipv4.tcp_max_syn_backlog` 限制，**取三者的最小值**。
- 高并发服务必须调大：`server.setBacklog(4096)` + `sysctl -w net.core.somaxconn=4096`。

> 【坑】Tomcat 默认 `acceptCount=100`，高并发下不够用，需要在 `server.xml` 或 `application.yml` 中调大（`server.tomcat.accept-count=1000`）。

### 2.3 BIO 的三种线程模型

```java
// ─── 模型 1：单线程（只能处理一个客户端，教学用）───
ServerSocket server = new ServerSocket(8888);
while (true) {
    Socket socket = server.accept();
    handle(socket);              // ★ 阻塞在这里，其他客户端全部等待
}

// ─── 模型 2：一连接一线程（简单但资源消耗大）───
ExecutorService pool = Executors.newCachedThreadPool();     // ⚠️ 无界线程，可能 OOM
while (true) {
    Socket socket = server.accept();
    pool.submit(() -> handle(socket));
}
// 问题：1 万连接 = 1 万线程 ≈ 10GB 内存（每线程 1MB 栈）+ 大量上下文切换

// ─── 模型 3：线程池限制并发数（生产 BIO 的做法）───
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    50,                                // 核心线程
    200,                               // 最大线程
    60L, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(500),     // ★ 有界队列
    new ThreadFactoryBuilder().setNameFormat("tcp-handler-%d").build(),
    new ThreadPoolExecutor.CallerRunsPolicy()    // ★ 队列满时让调用者（accept 线程）执行，天然限流
);
while (true) {
    Socket socket = server.accept();
    try {
        pool.submit(() -> handle(socket));
    } catch (RejectedExecutionException e) {
        socket.close();                // 拒绝时关闭连接
    }
}
// Tomcat 的 BIO 模式就是这个思路（现已废弃，默认 NIO）
```

**BIO 的问题总结：**
1. 每个连接一个线程，**线程数 = 连接数**，内存和上下文切换开销巨大。
2. 线程大部分时间在 `read()` 上阻塞（等待数据），**CPU 利用率低**。
3. 无法支撑 C10K/C10M（万级/千万级连接）。

→ 解决方案：**NIO 多路复用**（一个线程管理成千上万连接），详见 [[后端/中间件/Netty与网络IO模型]]。

### 2.4 粘包与拆包问题 ★★★★★

**TCP 是「字节流」协议，没有消息边界**，发送方发的多个包可能被合并接收（粘包），或一个包被拆成多次接收（拆包）。

```
发送方发送两个消息：[消息A: "hello"] [消息B: "world"]

接收方可能收到：
情况1（正常）：    "hello"  →  "world"
情况2（粘包）：    "helloworld"                        ← 两个包合并
情况3（拆包）：    "hel"  →  "loworld"                  ← 一个包被拆
情况4（粘包+拆包）："hellow"  →  "orld"                  ← 混合
```

**产生原因：**

| 原因 | 说明 |
| --- | --- |
| **Nagle 算法** | 发送方把多个小包合并成一个发送（减少网络开销），可用 `setTcpNoDelay(true)` 关闭 |
| **MSS 限制** | 消息大于 MSS（最大报文段长度，通常 1460 字节）时被拆分 |
| **接收缓冲区** | 接收方读取不及时，缓冲区积累多个包 |
| **滑动窗口/拥塞控制** | 影响发送速率和批量 |

**五种解决方案：**

```java
// ─── 方案 1：固定长度（简单但浪费）───
// 每条消息固定 128 字节，不足补空格
byte[] buf = new byte[128];
int len = in.read(buf);
String msg = new String(buf, 0, len).trim();
// 缺点：短消息浪费带宽，长消息装不下

// ─── 方案 2：分隔符（文本协议常用，如 Redis RESP、HTTP 头部）───
BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
String line;
while ((line = reader.readLine()) != null) {       // 以 \n 为分隔
    process(line);
}
// Redis 协议：*3\r\n$3\r\nSET\r\n$5\r\nmykey\r\n$7\r\nmyvalue\r\n
// 缺点：消息内容不能包含分隔符（需转义）；二进制数据不适用

// ─── 方案 3：长度字段（★ 最通用，二进制协议标准做法）───
// 协议格式：[4 字节长度][消息体]
// 发送
public void send(DataOutputStream out, byte[] data) throws IOException {
    out.writeInt(data.length);          // ★ 先写长度（4 字节）
    out.write(data);                     // 再写内容
    out.flush();
}
// 接收
public byte[] receive(DataInputStream in) throws IOException {
    int length = in.readInt();           // ★ 先读长度
    if (length <= 0 || length > MAX_LENGTH) {
        throw new IOException("非法长度：" + length);    // ★ 必须校验，防止 OOM 攻击
    }
    byte[] data = new byte[length];
    in.readFully(data);                  // ★ readFully 保证读满 length 字节（内部循环）
    return data;
}
// 应用：Dubbo 协议、gRPC、Thrift、RocketMQ 都用长度字段

// ─── 方案 4：自定义协议（生产级，参考 Dubbo/RocketMQ）───
/**
 * 协议头 16 字节：
 * ┌────────┬────────┬───────┬──────┬─────────┬─────────┬─────────┐
 * │ magic  │ version│ type  │ flag │ status  │ requestId│ length  │
 * │ 2 byte │ 1 byte │1 byte │1 byte│ 1 byte  │ 8 byte  │ 4 byte  │
 * └────────┴────────┴───────┴──────┴─────────┴─────────┴─────────┘
 * magic = 0xDA 0xBB（魔数，快速识别协议，防止非法连接）
 * length = body 的长度
 */
public class ProtocolCodec {
    private static final short MAGIC = (short) 0xDABB;
    private static final int HEADER_LENGTH = 16;
    private static final int MAX_BODY_LENGTH = 8 * 1024 * 1024;   // 8MB 上限

    public static byte[] encode(Message msg) throws IOException {
        byte[] body = serialize(msg.getBody());
        ByteBuffer buffer = ByteBuffer.allocate(HEADER_LENGTH + body.length);
        buffer.putShort(MAGIC);
        buffer.put((byte) 1);                 // version
        buffer.put((byte) msg.getType());     // 请求/响应/心跳
        buffer.put((byte) 0);                 // flag
        buffer.put((byte) 0);                 // status
        buffer.putLong(msg.getRequestId());
        buffer.putInt(body.length);
        buffer.put(body);
        return buffer.array();
    }

    public static Message decode(ByteBuffer buffer) throws IOException {
        buffer.flip();
        if (buffer.remaining() < HEADER_LENGTH) return null;      // ★ 数据不足，等待更多
        int startPos = buffer.position();
        short magic = buffer.getShort();
        if (magic != MAGIC) throw new IOException("非法协议，magic=" + magic);
        byte version = buffer.get();
        byte type = buffer.get();
        byte flag = buffer.get();
        byte status = buffer.get();
        long requestId = buffer.getLong();
        int bodyLength = buffer.getInt();
        if (bodyLength > MAX_BODY_LENGTH) throw new IOException("消息体过大：" + bodyLength);
        if (buffer.remaining() < bodyLength) {                     // ★ 半包，重置位置等待
            buffer.position(startPos);
            return null;
        }
        byte[] body = new byte[bodyLength];
        buffer.get(body);
        return new Message(type, requestId, deserialize(body));
    }
}

// ─── 方案 5：用 Netty 的现成解码器（★ 生产推荐）───
pipeline.addLast(new LengthFieldBasedFrameDecoder(
        8 * 1024 * 1024,    // maxFrameLength
        0,                  // lengthFieldOffset（长度字段偏移）
        4,                  // lengthFieldLength（长度字段字节数）
        0,                  // lengthAdjustment
        4));                // initialBytesToStrip（跳过前 4 字节头部）
pipeline.addLast(new LengthFieldPrepender(4));      // 编码时自动加长度头
pipeline.addLast(new DelimiterBasedFrameDecoder(1024, Delimiters.lineDelimiter()));  // 分隔符
pipeline.addLast(new FixedLengthFrameDecoder(128));                                 // 固定长度
pipeline.addLast(new LineBasedFrameDecoder(1024));                                  // \n 或 \r\n
pipeline.addLast(new HttpObjectAggregator(65536));                                  // HTTP
```

> 【坑】**`readFully` vs `read`**：
> ```java
> byte[] data = new byte[100];
> int len = in.read(data);        // ❌ 可能只读到 30 字节（返回实际读取数）
> in.readFully(data);             // ✅ 保证读满 100 字节（内部循环 read，读不满就阻塞）
>                                //    读不满且流结束 → EOFException
> ```
> 网络流中 `read()` 返回的字节数**几乎总是小于请求的字节数**，必须循环读取或用 `readFully`。

### 2.5 文件传输实战

```java
// ─── 服务端：接收文件 ───
public class FileServer {
    public static void main(String[] args) throws IOException {
        try (ServerSocket server = new ServerSocket(9999)) {
            while (true) {
                Socket socket = server.accept();
                new Thread(() -> receive(socket)).start();
            }
        }
    }

    private static void receive(Socket socket) {
        try (Socket s = socket;
             DataInputStream dis = new DataInputStream(
                 new BufferedInputStream(s.getInputStream()))) {

            // 1. 读协议头：文件名 + 文件大小
            String fileName = dis.readUTF();
            long fileSize = dis.readLong();
            System.out.printf("接收文件：%s，大小：%d 字节%n", fileName, fileSize);

            // 2. 安全校验（防止路径穿越）
            Path targetDir = Paths.get("/data/uploads").toAbsolutePath().normalize();
            Path target = targetDir.resolve(fileName).normalize();
            if (!target.startsWith(targetDir)) {
                throw new IOException("非法文件名（路径穿越）：" + fileName);
            }
            Files.createDirectories(target.getParent());

            // 3. 接收内容（★ 用计数器确保接收完整，不依赖 read 的返回值）
            try (OutputStream os = new BufferedOutputStream(Files.newOutputStream(target))) {
                byte[] buf = new byte[8192];
                long received = 0;
                while (received < fileSize) {
                    int toRead = (int) Math.min(buf.length, fileSize - received);
                    int len = dis.read(buf, 0, toRead);
                    if (len == -1) break;                    // 对方关闭
                    os.write(buf, 0, len);
                    received += len;
                }
                os.flush();
                if (received != fileSize) {
                    throw new IOException("文件不完整：期望 " + fileSize + "，实际 " + received);
                }
            }

            // 4. 校验完整性（可选）
            String expectedMd5 = dis.readUTF();
            String actualMd5 = DigestUtils.md5Hex(Files.newInputStream(target));
            boolean ok = expectedMd5.equals(actualMd5);

            // 5. 回复结果
            DataOutputStream dos = new DataOutputStream(s.getOutputStream());
            dos.writeBoolean(ok);
            dos.flush();
            System.out.println("接收完成：" + target + "，校验" + (ok ? "通过" : "失败"));

        } catch (IOException e) {
            System.err.println("接收失败：" + e.getMessage());
        }
    }
}

// ─── 客户端：发送文件 ───
public class FileClient {
    public static void send(String host, int port, Path file) throws IOException {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 5000);
            socket.setSoTimeout(60000);                       // 读超时
            socket.setSendBufferSize(64 * 1024);
            socket.setTcpNoDelay(true);

            DataOutputStream dos = new DataOutputStream(
                new BufferedOutputStream(socket.getOutputStream()));

            // 1. 发送协议头
            dos.writeUTF(file.getFileName().toString());
            dos.writeLong(Files.size(file));

            // 2. 发送内容
            try (InputStream in = new BufferedInputStream(Files.newInputStream(file))) {
                byte[] buf = new byte[8192];
                int len;
                long sent = 0;
                while ((len = in.read(buf)) != -1) {
                    dos.write(buf, 0, len);
                    sent += len;
                }
            }
            // 3. 发送校验值
            dos.writeUTF(DigestUtils.md5Hex(Files.newInputStream(file)));
            dos.flush();                                       // ★ 必须 flush，否则数据卡在缓冲区

            // 4. 半关闭输出，告知服务端"发完了"，同时等待响应
            socket.shutdownOutput();

            // 5. 读取服务端响应
            DataInputStream dis = new DataInputStream(socket.getInputStream());
            boolean success = dis.readBoolean();
            System.out.println("上传" + (success ? "成功" : "失败"));
        }
    }
}
```

**这个例子的关键工程要点：**

| 要点 | 说明 |
| --- | --- |
| 协议头带文件名和大小 | 接收方能预知数据量，避免粘包问题 |
| `fileName` 路径穿越校验 | 防止 `../../etc/passwd` 攻击 |
| 循环读到 `fileSize` 而非 `-1` | 精确控制，不依赖对方关闭连接 |
| MD5 校验 | 保证传输完整性 |
| `flush()` | 不 flush 数据可能卡在 BufferedOutputStream 里 |
| `shutdownOutput()` | 半关闭：告诉对方发完了，但仍能接收响应 |
| `setSoTimeout` | 防止对方不响应导致线程永久阻塞 |
| 带超时的 `connect` | 防止连接阶段无限等待 |

### 2.6 心跳与连接保活

```java
// ─── 应用层心跳（推荐，可控）───
public class HeartbeatClient {
    private final Socket socket;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private volatile long lastResponseTime = System.currentTimeMillis();
    private static final int HEARTBEAT_INTERVAL = 30;      // 30 秒发一次
    private static final int TIMEOUT = 90;                  // 90 秒无响应判定断开

    public void startHeartbeat() {
        // 定时发送心跳
        scheduler.scheduleAtFixedRate(() -> {
            try {
                if (System.currentTimeMillis() - lastResponseTime > TIMEOUT * 1000L) {
                    System.err.println("心跳超时，重连...");
                    reconnect();
                    return;
                }
                send("PING");                                // 发送心跳包
            } catch (Exception e) {
                reconnect();
            }
        }, HEARTBEAT_INTERVAL, HEARTBEAT_INTERVAL, TimeUnit.SECONDS);
    }

    // 接收线程中更新最后响应时间
    private void onMessage(String msg) {
        lastResponseTime = System.currentTimeMillis();
        if ("PONG".equals(msg)) return;                      // 心跳响应不处理
        handleBusiness(msg);
    }
}

// ─── TCP KeepAlive（传输层，不推荐单独使用）───
socket.setKeepAlive(true);
// Linux 默认参数（/proc/sys/net/ipv4/）：
//   tcp_keepalive_time = 7200   ← 2 小时无数据才开始探测！
//   tcp_keepalive_intvl = 75    ← 探测间隔 75 秒
//   tcp_keepalive_probes = 9    ← 探测 9 次失败判定断开
// 总计：2 小时 + 75*9 秒 ≈ 2.2 小时才发现死连接，业务上完全不可接受
// 需要调整内核参数，或用应用层心跳（更快、更可控、能携带业务信息）

// JDK 11+ 可以设置 KeepAlive 参数（需要 socket 实现支持）
socket.setOption(ExtendedSocketOptions.TCP_KEEPIDLE, 60);
socket.setOption(ExtendedSocketOptions.TCP_KEEPINTERVAL, 10);
socket.setOption(ExtendedSocketOptions.TCP_KEEPCOUNT, 3);

// ─── Netty 的心跳方案 ───
pipeline.addLast(new IdleStateHandler(60, 0, 0));            // 60 秒无读事件触发
pipeline.addLast(new ChannelInboundHandlerAdapter() {
    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) {
        if (evt instanceof IdleStateEvent) {
            ctx.writeAndFlush(new PingMessage());            // 发心跳
            // 或 ctx.close();                                // 判定超时直接断开
        }
    }
});
```

### 2.7 Socket 编程的常见坑

```java
// 坑 1：忘记 flush，数据发不出去
PrintWriter out = new PrintWriter(socket.getOutputStream());
out.print("hello");            // ❌ 数据在缓冲区，没发出去
out.flush();                    // ✅
// 或创建时 autoFlush = true（只对 println/printf/format 生效，print 无效！）
PrintWriter out2 = new PrintWriter(socket.getOutputStream(), true);
out2.println("hello");          // ✅ println 会自动 flush

// 坑 2：readLine 阻塞等待
// 对方不发 \n，readLine 会一直阻塞 → 必须设置 setSoTimeout
socket.setSoTimeout(10000);

// 坑 3：连接已断但代码不知道
socket.isConnected();           // ★ 只表示"曾经连接过"，不检测当前状态！
socket.isClosed();              // 只表示本地是否调用了 close()
// ✅ 真正的检测方法
public boolean isAlive(Socket socket) {
    try {
        socket.setSoTimeout(100);
        // 方式 1：发送紧急数据
        socket.sendUrgentData(0xFF);
        return true;
    } catch (IOException e) {
        return false;
    } finally {
        try { socket.setSoTimeout(originalTimeout); } catch (Exception ignored) { }
    }
}
// 方式 2：尝试 read，返回 -1 说明对方关闭
// 方式 3：应用层心跳（最可靠）

// 坑 4：先关输出再关输入的顺序
socket.close();                 // 直接 close 会发 RST（如果接收缓冲区还有数据）
// ✅ 优雅关闭（四次挥手的正确姿势）
socket.shutdownOutput();        // 1. 发 FIN，告诉对方"我不发了"
// 2. 继续读取对方剩余数据，直到 read 返回 -1
while ((len = in.read(buf)) != -1) { }
socket.close();                 // 3. 完全关闭

// 坑 5：TIME_WAIT 过多导致端口耗尽
// 主动关闭方会进入 TIME_WAIT（2MSL = 60 秒）
// 大量短连接的服务端会积累几万个 TIME_WAIT
// 解决：
server.setReuseAddress(true);   // ★ SO_REUSEADDR，允许绑定 TIME_WAIT 的端口
// Linux 内核参数：
// net.ipv4.tcp_tw_reuse = 1            （客户端侧复用）
// net.ipv4.tcp_max_tw_buckets = 5000   （超过就销毁）
// net.ipv4.ip_local_port_range = 1024 65535  （扩大端口范围）
// ⚠️ 不要用 tcp_tw_recycle（NAT 环境会丢包，Linux 4.12 已移除）
// 根本解决：用连接池/长连接（HTTP Keep-Alive）

// 坑 6：未设置超时的三处
socket.connect(addr);           // ❌ 无超时，对方不响应会永久阻塞
// → socket.connect(addr, 5000);  ✅
socket.getInputStream().read(); // ❌ 无超时
// → socket.setSoTimeout(10000);  ✅
socket.close();                 // ❌ 未发送完的数据可能丢失
// → socket.setSoLinger(true, 5); ✅

// 坑 7：ServerSocket 端口被占用
// BindException: Address already in use
// 原因：上次进程未完全退出（TIME_WAIT）或端口被其他程序占用
// 解决：setReuseAddress(true)（必须在 bind 之前）
ServerSocket server = new ServerSocket();
server.setReuseAddress(true);            // ★ 必须在 bind 前
server.bind(new InetSocketAddress(8888));
// 排查：lsof -i :8888 或 netstat -anp | grep 8888

// 坑 8：字符编码不一致
// 发送方用 UTF-8，接收方用 GBK → 乱码
// ✅ 双方显式约定 UTF-8
new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8)

// 坑 9：大对象序列化传输的内存问题
ObjectOutputStream oos = new ObjectOutputStream(socket.getOutputStream());
oos.writeObject(hugeObject);            // ❌ 会先把整个对象序列化到内存
// ✅ 流式传输或分块传输
```

## 3. UDP 编程（DatagramSocket）

```java
// ─── UDP 服务端 ───
public class UdpServer {
    public static void main(String[] args) throws IOException {
        try (DatagramSocket socket = new DatagramSocket(9999)) {
            socket.setSoTimeout(0);                          // 0 = 永不超时
            socket.setReceiveBufferSize(256 * 1024);          // 增大接收缓冲区（UDP 易丢包）
            byte[] buffer = new byte[1024];                   // ★ UDP 数据报最大 64KB（实际受 MTU 限制，建议 < 1472 字节）

            while (true) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                socket.receive(packet);                       // ★ 阻塞接收
                String msg = new String(packet.getData(), 0, packet.getLength(),
                                          StandardCharsets.UTF_8);
                System.out.printf("收到来自 %s:%d 的消息：%s%n",
                        packet.getAddress().getHostAddress(), packet.getPort(), msg);

                // 响应
                byte[] response = ("ECHO: " + msg).getBytes(StandardCharsets.UTF_8);
                DatagramPacket resp = new DatagramPacket(response, response.length,
                        packet.getAddress(), packet.getPort());   // ★ 用对方的地址和端口
                socket.send(resp);
            }
        }
    }
}

// ─── UDP 客户端 ───
public class UdpClient {
    public static void main(String[] args) throws IOException {
        try (DatagramSocket socket = new DatagramSocket()) {   // 系统分配随机端口
            socket.setSoTimeout(5000);                          // ★ 接收超时（UDP 可能丢包）
            InetAddress address = InetAddress.getByName("127.0.0.1");

            String message = "你好，UDP";
            byte[] data = message.getBytes(StandardCharsets.UTF_8);
            DatagramPacket packet = new DatagramPacket(data, data.length, address, 9999);
            socket.send(packet);                                // 发送（不等确认，可能丢）

            // 接收响应
            byte[] buffer = new byte[1024];
            DatagramPacket response = new DatagramPacket(buffer, buffer.length);
            try {
                socket.receive(response);                       // 可能抛 SocketTimeoutException
                System.out.println("响应：" + new String(response.getData(), 0,
                        response.getLength(), StandardCharsets.UTF_8));
            } catch (SocketTimeoutException e) {
                System.err.println("接收超时，消息可能丢失");
                // ★ UDP 应用层重试
                socket.send(packet);
            }
        }
    }
}
```

**DatagramPacket 与 DatagramSocket API：**

```java
// DatagramPacket 的 4 种构造器
new DatagramPacket(byte[] buf, int length);                       // 用于接收
new DatagramPacket(byte[] buf, int offset, int length);
new DatagramPacket(byte[] buf, int length, InetAddress addr, int port);   // 用于发送
new DatagramPacket(byte[] buf, int offset, int length, SocketAddress addr);

packet.getData();             // byte[]（★ 可能是整个缓冲区，含脏数据）
packet.getLength();           // ★ 实际数据长度（必须用这个，不是 getData().length）
packet.getOffset();
packet.getAddress();          // 对方 IP
packet.getPort();             // 对方端口
packet.getSocketAddress();
packet.setData(newData);
packet.setLength(newLength);
packet.setAddress(addr); packet.setPort(port);

// DatagramSocket
new DatagramSocket();                          // 随机端口
new DatagramSocket(9999);                      // 指定端口
new DatagramSocket(9999, InetAddress.getByName("192.168.1.1"));   // 绑定指定网卡
socket.connect(InetAddress.getByName("host"), 9999);   // ★ "连接"（只是锁定对方地址，仍是无连接协议）
                                                          //   之后可以用 send(packet) 不带地址，且会过滤其他来源的包
socket.disconnect();
socket.send(packet);
socket.receive(packet);
socket.setBroadcast(true);                     // ★ 允许广播（默认关闭）
socket.setSoTimeout(5000);
socket.setReuseAddress(true);
socket.setReceiveBufferSize(size);
socket.setSendBufferSize(size);
socket.setTrafficClass(0x10);                  // QoS 设置
socket.getChannel();                           // DatagramChannel

// 广播示例
socket.setBroadcast(true);
byte[] data = "broadcast".getBytes();
DatagramPacket packet = new DatagramPacket(data, data.length,
        InetAddress.getByName("255.255.255.255"), 9999);     // 全局广播
        // InetAddress.getByName("192.168.1.255")             // 子网广播
socket.send(packet);

// 组播（Multicast）
MulticastSocket ms = new MulticastSocket(9999);
InetAddress group = InetAddress.getByName("224.0.0.1");       // 组播地址 224.0.0.0 ~ 239.255.255.255
ms.joinGroup(group);                                           // 加入组
ms.send(new DatagramPacket(data, data.length, group, 9999));   // 发给组内所有成员
ms.receive(packet);
ms.leaveGroup(group);
// JDK 14+ 新的组播 API（支持 IPv6 和指定网卡）
ms.joinGroup(new InetSocketAddress(group, 9999),
             NetworkInterface.getByName("eth0"));
```

> 【坑】**UDP 数据报大小的限制**：
> - 理论上限 **65507 字节**（64KB - 8 字节 UDP 头 - 20 字节 IP 头）。
> - 超过 MTU（通常 1500 字节）会 **IP 分片**，任一分片丢失整个数据报就丢，重传代价大。
> - **实践建议：单个 UDP 包控制在 1400 字节以内**，更大的数据在应用层自己分片 + 序号 + 重组。
> - QUIC（HTTP/3）的做法：1200 字节的初始包，避免分片。

## 4. URL 与 HTTP 客户端

### 4.1 URL 与 URI

```java
import java.net.*;

// URL：统一资源定位符（含协议和访问方式，能定位并获取资源）
URL url = new URL("https://user:pass@example.com:8443/api/users?id=1#section");
url.getProtocol();          // "https"
url.getHost();              // "example.com"
url.getPort();              // 8443
url.getDefaultPort();       // 443
url.getPath();              // "/api/users"
url.getFile();              // "/api/users?id=1"（path + query）
url.getQuery();             // "id=1"
url.getRef();               // "section"（锚点/fragment）
url.getUserInfo();          // "user:pass"
url.getAuthority();         // "user:pass@example.com:8443"
url.toURI();                // 转 URI
url.toString();

// URI：统一资源标识符（只标识，不一定能定位）
URI uri = new URI("https://example.com/api/users?id=1");
uri.isAbsolute();           // 是否有协议
uri.isOpaque();             // 是否非层级（如 mailto:xxx）
uri.resolve("/other");      // 解析相对路径
uri.relativize(otherUri);
uri.toURL();                // URI → URL（要求是绝对 URL）

// URL 的相对路径解析
URL base = new URL("https://example.com/a/b/c.html");
new URL(base, "../d.html");      // https://example.com/a/d.html
new URL(base, "/root.html");     // https://example.com/root.html

// 编码解码（★ 必须处理中文和特殊字符）
URLEncoder.encode("你好 world", StandardCharsets.UTF_8);   // "%E4%BD%A0%E5%A5%BD+world"
                                                           // 注意空格变 +（表单编码规则）
URLDecoder.decode("%E4%BD%A0%E5%A5%BD+world", StandardCharsets.UTF_8);   // "你好 world"
// JDK 10+ 推荐用 Charset 重载
URLEncoder.encode("你好", StandardCharsets.UTF_8);

// ⚠️ URLEncoder 是「表单编码」（application/x-www-form-urlencoded），不是 RFC 3986 的 URL 编码
// 差异：空格 → +（而非 %20）、~ 会被编码、/ 会被编码
// ✅ 编码 URL 路径要用 URI 的多参构造器（它会自动正确编码）
URI safeUri = new URI("https", "example.com", "/path/with space/中文", "key=value&k2=v2", null);
safeUri.toASCIIString();     // https://example.com/path/with%20space/%E4%B8%AD%E6%96%87?key=value&k2=v2

// 查询参数解析（JDK 无内置，需手写或用工具）
public static Map<String, List<String>> parseQuery(String query) {
    if (query == null || query.isEmpty()) return Collections.emptyMap();
    return Arrays.stream(query.split("&"))
        .map(p -> p.split("=", 2))                       // limit=2 保留 value 中的 =
        .collect(Collectors.groupingBy(
            kv -> URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
            Collectors.mapping(
                kv -> kv.length > 1 ? URLDecoder.decode(kv[1], StandardCharsets.UTF_8) : "",
                Collectors.toList())));
}
// Apache HttpClient: URLEncodedUtils.parse(query, UTF_8)
// Spring: UriComponentsBuilder.fromHttpUrl(url).build().getQueryParams()
```

### 4.2 HttpURLConnection（JDK 内置，老 API）

```java
import java.net.*;
import java.io.*;

public class HttpUrlConnectionDemo {

    public static String get(String urlStr) throws IOException {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            // 1. 基本配置
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000);              // ★ 连接超时
            conn.setReadTimeout(10000);                // ★ 读取超时
            conn.setInstanceFollowRedirects(true);      // 跟随重定向
            conn.setUseCaches(false);                   // 不用缓存
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Accept-Charset", "UTF-8");
            conn.setRequestProperty("User-Agent", "MyApp/1.0");
            conn.setRequestProperty("Authorization", "Bearer " + token);

            // 2. 发起请求并读取响应
            int code = conn.getResponseCode();          // ★ 触发实际请求
            String message = conn.getResponseMessage();
            Map<String, List<String>> headers = conn.getHeaderFields();
            String contentType = conn.getContentType();
            String encoding = conn.getContentEncoding();
            long contentLength = conn.getContentLengthLong();

            // 3. 读取响应体（★ 成功用 getInputStream，失败用 getErrorStream）
            InputStream is = (code >= 200 && code < 400)
                    ? conn.getInputStream()
                    : conn.getErrorStream();            // ★ 4xx/5xx 必须用 errorStream！
            if (is == null) return "";
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(is, StandardCharsets.UTF_8))) {
                return br.lines().collect(Collectors.joining("\n"));
            }
        } finally {
            conn.disconnect();                          // ★ 释放连接（但可能进连接池复用）
        }
    }

    public static String postJson(String urlStr, String json) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);                     // ★ POST 必须开启输出
            conn.setDoInput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("Content-Type", "application/json;charset=UTF-8");
            conn.setRequestProperty("Accept", "application/json");
            // conn.setFixedLengthStreamingMode(json.getBytes(UTF_8).length);  // 已知长度，避免缓冲整个请求体
            // conn.setChunkedStreamingMode(8192);        // 未知长度，分块传输

            // 写请求体
            try (OutputStream os = conn.getOutputStream();
                 Writer w = new OutputStreamWriter(os, StandardCharsets.UTF_8)) {
                w.write(json);
                w.flush();
            }

            int code = conn.getResponseCode();
            InputStream is = code < 400 ? conn.getInputStream() : conn.getErrorStream();
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } finally {
            conn.disconnect();
        }
    }

    // 文件上传（multipart/form-data）—— HttpURLConnection 手写非常繁琐
    public static String uploadFile(String urlStr, File file) throws IOException {
        String boundary = "----WebKitFormBoundary" + UUID.randomUUID().toString().replace("-", "");
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

        try (OutputStream os = conn.getOutputStream();
             PrintWriter writer = new PrintWriter(new OutputStreamWriter(os, StandardCharsets.UTF_8), true)) {

            // 普通字段
            writer.append("--").append(boundary).append("\r\n");
            writer.append("Content-Disposition: form-data; name=\"desc\"\r\n");
            writer.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            writer.append("文件描述").append("\r\n");
            writer.flush();

            // 文件字段
            writer.append("--").append(boundary).append("\r\n");
            writer.append("Content-Disposition: form-data; name=\"file\"; filename=\"")
                  .append(file.getName()).append("\"\r\n");
            writer.append("Content-Type: ").append(URLConnection.guessContentTypeFromName(file.getName())).append("\r\n");
            writer.append("Content-Transfer-Encoding: binary\r\n\r\n");
            writer.flush();
            Files.copy(file.toPath(), os);              // ★ 二进制内容直接写 OutputStream
            os.flush();
            writer.append("\r\n");
            writer.flush();

            // 结束标记
            writer.append("--").append(boundary).append("--\r\n");
            writer.close();
        }
        return new String(conn.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }
}
```

**HttpURLConnection 的坑：**

| 坑 | 说明 |
| --- | --- |
| 4xx/5xx 时 `getInputStream()` 抛 IOException | 必须用 `getErrorStream()` 读错误响应体 |
| 不设超时会永久阻塞 | `setConnectTimeout` + `setReadTimeout` 必设 |
| POST 忘记 `setDoOutput(true)` | 请求变成 GET |
| 不 `disconnect()` | 连接泄漏（不过 JDK 有 KeepAlive 缓存机制复用） |
| 不支持 PATCH 方法 | `setRequestMethod("PATCH")` 抛异常（要用反射改 method 字段或换客户端） |
| HTTPS 证书校验 | 自签名证书需要自定义 `SSLSocketFactory` 和 `HostnameVerifier` |
| 没有连接池管理 | 需自己封装或用 OkHttp/Apache HttpClient |
| 重定向不跨协议 | HTTP → HTTPS 的 301/302 不会自动跟随 |

### 4.3 JDK 11 HttpClient（现代化 API）★★★★★

```java
import java.net.http.*;
import java.time.Duration;

public class HttpClientDemo {

    // ─── 创建客户端（应作为单例复用，线程安全）───
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_2)               // HTTP/2（默认，自动降级到 1.1）
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)       // NEVER / ALWAYS / NORMAL（不跨 HTTPS→HTTP）
            .priority(1)                                       // HTTP/2 优先级
            //.proxy(ProxySelector.of(new InetSocketAddress("proxy", 8080)))
            //.authenticator(Authenticator.getDefault())        // 基本认证
            //.cookieHandler(new CookieManager())               // Cookie 管理
            //.sslContext(sslContext)                            // 自定义 SSL
            //.executor(customExecutor)                          // 自定义线程池（异步用）
            .build();

    // ─── 同步 GET ───
    public static String get(String url) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .header("Accept", "application/json")
                .header("Authorization", "Bearer xxx")
                .timeout(Duration.ofSeconds(10))              // ★ 整个请求的超时
                .build();

        HttpResponse<String> response = CLIENT.send(request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

        response.statusCode();                  // 200
        response.body();                         // 响应体字符串
        response.headers().firstValue("Content-Type");
        response.headers().map();                // Map<String, List<String>>
        response.uri();                          // 最终 URI（跟随重定向后）
        response.version();                      // HTTP/1.1 或 HTTP/2
        response.request();                      // 原始请求
        response.sslSession();                   // HTTPS 的会话信息
        return response.body();
    }

    // ─── POST JSON ───
    public static String postJson(String url, String json) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .header("Content-Type", "application/json; charset=UTF-8")
                .build();
        HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        return response.body();
    }

    // ─── 各种 BodyPublisher ───
    HttpRequest.BodyPublishers.ofString("data");
    HttpRequest.BodyPublishers.ofByteArray(bytes);
    HttpRequest.BodyPublishers.ofFile(Paths.get("file.txt"));       // ★ 流式上传大文件
    HttpRequest.BodyPublishers.ofInputStream(() -> inputStream);
    HttpRequest.BodyPublishers.fromPublisher(flowPublisher);        // 响应式
    HttpRequest.BodyPublishers.noBody();                            // 无请求体
    HttpRequest.BodyPublishers.ofByteArrays(List.of(bytes1, bytes2));

    // ─── 各种 BodyHandler ───
    HttpResponse.BodyHandlers.ofString();                           // String
    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8);
    HttpResponse.BodyHandlers.ofByteArray();                        // byte[]
    HttpResponse.BodyHandlers.ofFile(Paths.get("download.zip"));    // ★ 直接下载到文件
    HttpResponse.BodyHandlers.ofFile(path, CREATE, WRITE);
    HttpResponse.BodyHandlers.ofLines();                            // Stream<String>（流式处理）
    HttpResponse.BodyHandlers.ofInputStream();                      // InputStream
    HttpResponse.BodyHandlers.discarding();                         // 丢弃响应体（只要状态码）
    HttpResponse.BodyHandlers.replacing("default");                 // 固定值
    HttpResponse.BodyHandlers.fromLineSubscriber(subscriber);       // 自定义订阅者
    HttpResponse.BodyHandlers.mapping(ofString(), String::trim);    // 转换

    // ─── 异步请求（返回 CompletableFuture）★★★★★ ───
    CompletableFuture<HttpResponse<String>> future = CLIENT.sendAsync(request,
            HttpResponse.BodyHandlers.ofString());

    future.thenApply(HttpResponse::body)
          .thenApply(String::toUpperCase)
          .thenAccept(System.out::println)
          .exceptionally(ex -> { log.error("请求失败", ex); return null; });

    // 并发请求多个 URL（★ 性能关键场景）
    List<String> urls = List.of(url1, url2, url3);
    List<CompletableFuture<String>> futures = urls.stream()
        .map(u -> CLIENT.sendAsync(HttpRequest.newBuilder(URI.create(u)).build(),
                                   HttpResponse.BodyHandlers.ofString())
                        .thenApply(HttpResponse::body))
        .collect(toList());
    List<String> results = futures.stream()
        .map(CompletableFuture::join)               // 等待全部完成
        .collect(toList());

    // 超时控制（JDK 11 的 HttpClient 没有直接的请求超时，用 orTimeout）
    future.orTimeout(5, TimeUnit.SECONDS)            // JDK 9+
          .exceptionally(ex -> null);
    future.completeOnTimeout("default", 5, TimeUnit.SECONDS);   // 超时返回默认值

    // ─── 流式下载大文件（不占内存）───
    public static void download(String url, Path target) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url)).GET().build();
        CLIENT.sendAsync(request, HttpResponse.BodyHandlers.ofFile(target))
              .thenApply(HttpResponse::statusCode)
              .thenAccept(code -> System.out.println("下载完成，状态：" + code))
              .join();
    }

    // ─── 逐行处理响应（大响应体）───
    HttpResponse<Stream<String>> response = CLIENT.send(request,
            HttpResponse.BodyHandlers.ofLines());
    response.body()
            .filter(line -> line.contains("ERROR"))
            .limit(100)
            .forEach(System.out::println);
    // ⚠️ ofLines 的 Stream 必须消费完或关闭，否则连接不释放

    // ─── HTTP/2 特性 ───
    response.version();                       // 协商后的版本
    // HTTP/2 的多路复用：同一个连接并发多个请求（无需客户端做连接池）
    // 服务端推送（Server Push）
    HttpResponse.PushPromiseHandler<T> pushHandler = ...;
}
```

**HttpClient vs HttpURLConnection vs 第三方客户端：**

| 特性 | HttpURLConnection | **JDK 11 HttpClient** | Apache HttpClient | OkHttp |
| --- | --- | --- | --- | --- |
| JDK 内置 | ✅ | ✅（11+） | ❌ | ❌ |
| HTTP/2 | ❌ | ✅ | ✅（5.x） | ✅ |
| WebSocket | ❌ | ✅ | ❌ | ✅ |
| 异步 | ❌（要自己开线程） | ✅ CompletableFuture | ✅ | ✅ |
| 连接池 | 简陋（KeepAlive 缓存） | ✅ 自动 | ✅ 强大 | ✅ |
| API 友好度 | ★★ | ★★★★ | ★★★ | ★★★★★ |
| 拦截器 | ❌ | ❌ | ✅ | ✅ |
| 依赖体积 | 0 | 0 | 大 | 中 |
| 维护状态 | 遗留 | **官方推荐** | 活跃 | 活跃 |

> 【实践建议】
> - **JDK 11+ 新项目**：用内置 `HttpClient`（无依赖，功能够用）。
> - **Spring 项目**：用 `RestTemplate`（Spring 6 已废弃）或 **`WebClient`/`RestClient`**（Spring 6.1+ 推荐），底层可切换到 JDK HttpClient / Reactor Netty。
> - **Android / 需要拦截器和缓存**：OkHttp。
> - **需要精细控制连接池、代理、认证**：Apache HttpClient 5。
> - **Feign**（微服务声明式调用）底层可配置为任意客户端，详见 [[后端/微服务/OpenFeign服务调用]]。

### 4.4 SSL/TLS 编程

```java
import javax.net.ssl.*;

// ─── HTTPS 请求（默认信任 CA 签发的证书，无需额外配置）───
URL url = new URL("https://api.example.com/data");
HttpsURLConnection conn = (HttpsURLConnection) url.openConnection();
conn.setSSLSocketFactory(sslContext.getSocketFactory());
conn.setHostnameVerifier((hostname, session) -> true);      // ⚠️ 生产环境不要禁用主机名校验！

// ─── 信任自签名证书（开发/内网环境）───
public static SSLContext createTrustAllContext() throws Exception {
    TrustManager[] trustAll = new TrustManager[]{
        new X509TrustManager() {
            public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            public void checkClientTrusted(X509Certificate[] certs, String authType) { }   // 不校验
            public void checkServerTrusted(X509Certificate[] certs, String authType) { }   // ★ 不校验
        }
    };
    SSLContext ctx = SSLContext.getInstance("TLSv1.3");
    ctx.init(null, trustAll, new SecureRandom());
    return ctx;
}
// ⚠️⚠️ 这会完全禁用证书校验，遭受中间人攻击！仅限本地调试，生产必须导入正确证书

// ─── 生产环境：导入自签名证书到信任库 ───
// 1. keytool 导入证书到 JRE 的 cacerts
// keytool -import -alias myapi -file server.crt -keystore $JAVA_HOME/lib/security/cacerts -storepass changeit
// 2. 或创建自定义信任库
// keytool -import -alias myapi -file server.crt -keystore mytruststore.jks -storepass 123456
// 3. JVM 启动参数指定
// -Djavax.net.ssl.trustStore=/path/mytruststore.jks
// -Djavax.net.ssl.trustStorePassword=123456

// 代码方式加载信任库
public static SSLContext createCustomContext(String trustStorePath, String password) throws Exception {
    KeyStore trustStore = KeyStore.getInstance("JKS");        // 或 "PKCS12"
    try (InputStream is = Files.newInputStream(Paths.get(trustStorePath))) {
        trustStore.load(is, password.toCharArray());
    }
    TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
    tmf.init(trustStore);
    SSLContext ctx = SSLContext.getInstance("TLSv1.3");
    ctx.init(null, tmf.getTrustManagers(), null);
    return ctx;
}

// ─── 双向认证（mTLS，客户端也要提供证书）───
public static SSLContext createMutualSSL(String keyStorePath, String keyStorePwd,
                                         String trustStorePath, String trustStorePwd) throws Exception {
    // 加载客户端密钥库（含私钥和证书）
    KeyStore keyStore = KeyStore.getInstance("PKCS12");
    try (InputStream is = Files.newInputStream(Paths.get(keyStorePath))) {
        keyStore.load(is, keyStorePwd.toCharArray());
    }
    KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
    kmf.init(keyStore, keyStorePwd.toCharArray());

    // 加载信任库（服务端 CA 证书）
    KeyStore trustStore = KeyStore.getInstance("JKS");
    try (InputStream is = Files.newInputStream(Paths.get(trustStorePath))) {
        trustStore.load(is, trustStorePwd.toCharArray());
    }
    TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
    tmf.init(trustStore);

    SSLContext ctx = SSLContext.getInstance("TLSv1.3");
    ctx.init(kmf.getKeyManagers(), tmf.getTrustManagers(), new SecureRandom());
    return ctx;
}

// ─── JDK 11 HttpClient 配置 SSL ───
HttpClient client = HttpClient.newBuilder()
        .sslContext(sslContext)
        .sslParameters(sslParams)                  // 指定密码套件、协议版本
        .build();

SSLParameters params = sslContext.getDefaultSSLParameters();
params.setProtocols(new String[]{"TLSv1.3", "TLSv1.2"});
params.setCipherSuites(new String[]{"TLS_AES_256_GCM_SHA384"});
params.setEndpointIdentificationAlgorithm("HTTPS");   // ★ 启用主机名校验

// ─── SSL Server（服务端）───
SSLServerSocketFactory factory = sslContext.getServerSocketFactory();
SSLServerSocket serverSocket = (SSLServerSocket) factory.createServerSocket(8443);
serverSocket.setNeedClientAuth(true);               // ★ 要求客户端证书（双向认证）
serverSocket.setEnabledProtocols(new String[]{"TLSv1.3"});
serverSocket.setEnabledCipherSuites(serverSocket.getSupportedCipherSuites());
SSLSocket clientSocket = (SSLSocket) serverSocket.accept();
clientSocket.startHandshake();                       // 显式触发握手
SSLSession session = clientSocket.getSession();
session.getPeerCertificates();                       // 客户端证书
session.getCipherSuite(); session.getProtocol();
```

**TLS 版本与密码套件（安全配置）：**

| 协议 | 状态 | 说明 |
| --- | --- | --- |
| SSL 2.0 / 3.0 | ❌ **已废弃，严重漏洞**（POODLE） | 禁用 |
| TLS 1.0 / 1.1 | ❌ **已废弃**（RFC 8996，2021） | 主流浏览器已不支持 |
| TLS 1.2 | ✅ 广泛使用 | 需 2 个 RTT 握手 |
| **TLS 1.3** | ✅ **推荐** | **1 个 RTT（0-RTT 可选）**，移除不安全算法，握手加密 |

```bash
# 查看 JDK 支持的协议和密码套件
java -Djavax.net.debug=ssl:handshake MyApp     # 打印完整握手过程（调试用）

# JVM 参数控制
-Dhttps.protocols=TLSv1.3,TLSv1.2              # 客户端协议
-Djdk.tls.client.protocols=TLSv1.3
-Djdk.tls.disabledAlgorithms=SSLv3, TLSv1, TLSv1.1, RC4, DES, MD5withRSA, DH keySize < 1024
# 配置文件：$JAVA_HOME/conf/security/java.security
```

### 4.5 WebSocket 编程（JDK 11+）

```java
import java.net.http.*;
import java.net.http.WebSocket.Listener;
import java.util.concurrent.*;

// ─── WebSocket 客户端 ───
public class WebSocketClient {

    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();

        WebSocket webSocket = client.newWebSocketBuilder()
                .header("Authorization", "Bearer xxx")
                .subprotocols("chat", "json")           // 子协议协商
                .connectTimeout(Duration.ofSeconds(5))
                .buildAsync(URI.create("wss://echo.websocket.org"), new Listener() {

            private final StringBuilder buffer = new StringBuilder();

            @Override
            public void onOpen(WebSocket ws) {
                System.out.println("连接已建立");
                ws.request(1);                          // ★ 请求接收 1 条消息（背压控制）
                ws.sendText("Hello WebSocket", true);   // 发送文本
            }

            @Override
            public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
                buffer.append(data);
                if (last) {                              // ★ 消息可能被分片，last=true 才是完整消息
                    System.out.println("收到：" + buffer);
                    buffer.setLength(0);
                }
                ws.request(1);                           // ★ 必须再次 request 才能收到下一条
                return null;
            }

            @Override
            public CompletionStage<?> onBinary(WebSocket ws, ByteBuffer data, boolean last) {
                byte[] bytes = new byte[data.remaining()];
                data.get(bytes);
                System.out.println("收到二进制：" + bytes.length + " 字节");
                ws.request(1);
                return null;
            }

            @Override
            public CompletionStage<?> onPing(WebSocket ws, ByteBuffer message) {
                ws.sendPong(message);                    // 自动回 Pong
                ws.request(1);
                return null;
            }

            @Override
            public CompletionStage<?> onPong(WebSocket ws, ByteBuffer message) {
                ws.request(1);
                return null;
            }

            @Override
            public CompletionStage<?> onClose(WebSocket ws, int statusCode, String reason) {
                System.out.println("连接关闭：" + statusCode + " " + reason);
                return null;
            }

            @Override
            public void onError(WebSocket ws, Throwable error) {
                System.err.println("WebSocket 错误：" + error.getMessage());
            }
        }).join();

        // 发送各种消息
        webSocket.sendText("文本消息", true);            // true = 这是消息的最后一片
        webSocket.sendBinary(ByteBuffer.wrap(bytes), true);
        webSocket.sendPing(ByteBuffer.wrap("ping".getBytes()));
        webSocket.sendPong(ByteBuffer.wrap("pong".getBytes()));

        // 关闭（状态码：1000 正常、1001 离开、1011 服务端错误）
        webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "正常关闭");
        webSocket.abort();                               // 强制中止（不发关闭帧）
        webSocket.isInputClosed(); webSocket.isOutputClosed();
    }
}
```

> 【坑】**JDK HttpClient 的 WebSocket 有「背压机制」**：必须调用 `ws.request(n)` 才会收到 n 条消息。忘记 request 会导致**收不到任何后续消息**（连接看似正常但静默）。这与 Spring 的 WebSocket、Netty 的行为不同，容易踩坑。

**Spring Boot 的 WebSocket（更常用）见 [[后端/SpringBoot/测试与常用整合实战]]。**

## 5. NIO 网络编程

NIO 的 Buffer/Channel/Selector 原理详见 [[后端/Java基础/IO流与文件操作]] 第 5 节。这里给出**完整的 NIO 服务端实现**：

```java
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.*;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * NIO 单 Reactor 单线程模型（简化版，Netty 的思想源头）
 */
public class NioServer {

    private final int port;
    private Selector selector;
    private ServerSocketChannel serverChannel;
    /** 每个连接的会话状态（半包处理需要） */
    private final Map<SocketChannel, ByteBuffer> sessions = new ConcurrentHashMap<>();

    public NioServer(int port) {
        this.port = port;
    }

    public void start() throws IOException {
        // 1. 打开 ServerSocketChannel 并设为非阻塞
        serverChannel = ServerSocketChannel.open();
        serverChannel.configureBlocking(false);                 // ★ 必须非阻塞才能注册到 Selector
        serverChannel.bind(new InetSocketAddress(port), 1024);  // backlog = 1024
        serverChannel.setOption(StandardSocketOptions.SO_REUSEADDR, true);

        // 2. 打开 Selector 并注册 OP_ACCEPT
        selector = Selector.open();
        serverChannel.register(selector, SelectionKey.OP_ACCEPT);

        System.out.println("NIO 服务端启动，端口：" + port);

        // 3. 事件循环
        while (true) {
            // ★ 阻塞等待事件（select 底层在 Linux 是 epoll_wait）
            if (selector.select(1000) == 0) {                   // 带超时，便于定期检查
                continue;
            }

            Set<SelectionKey> selectedKeys = selector.selectedKeys();
            Iterator<SelectionKey> iterator = selectedKeys.iterator();
            while (iterator.hasNext()) {
                SelectionKey key = iterator.next();
                iterator.remove();                               // ★★ 必须手动移除！

                try {
                    if (!key.isValid()) continue;

                    if (key.isAcceptable()) {
                        accept(key);
                    } else if (key.isReadable()) {
                        read(key);
                    } else if (key.isWritable()) {
                        write(key);
                    }
                } catch (CancelledKeyException e) {
                    // key 已被取消，忽略
                } catch (IOException e) {
                    key.cancel();
                    closeQuietly(key.channel());
                }
            }
        }
    }

    /** 处理新连接 */
    private void accept(SelectionKey key) throws IOException {
        ServerSocketChannel server = (ServerSocketChannel) key.channel();
        SocketChannel client = server.accept();
        if (client == null) return;                              // 非阻塞下可能返回 null

        client.configureBlocking(false);
        client.setOption(StandardSocketOptions.TCP_NODELAY, true);
        client.setOption(StandardSocketOptions.SO_KEEPALIVE, true);
        client.setOption(StandardSocketOptions.SO_RCVBUF, 64 * 1024);

        // 注册读事件，并把缓冲区作为附件
        ByteBuffer buffer = ByteBuffer.allocate(1024);
        client.register(selector, SelectionKey.OP_READ, buffer);
        sessions.put(client, buffer);

        System.out.println("新连接：" + client.getRemoteAddress() + "，当前连接数：" + sessions.size());
    }

    /** 处理读事件 */
    private void read(SelectionKey key) throws IOException {
        SocketChannel client = (SocketChannel) key.channel();
        ByteBuffer buffer = (ByteBuffer) key.attachment();

        int bytesRead = client.read(buffer);
        if (bytesRead == -1) {                                   // 客户端关闭连接
            System.out.println("连接关闭：" + client.getRemoteAddress());
            sessions.remove(client);
            key.cancel();
            client.close();
            return;
        }
        if (bytesRead == 0) return;                              // 无数据

        // ★ 切换到读模式处理数据
        buffer.flip();
        // 这里应该做「拆包/粘包」处理（判断消息是否完整）
        String content = StandardCharsets.UTF_8.decode(buffer).toString();
        System.out.println("收到：" + content.trim());

        // 处理业务并准备响应
        String response = "服务端已收到：" + content.trim() + "\n";
        ByteBuffer outBuffer = ByteBuffer.wrap(response.getBytes(StandardCharsets.UTF_8));

        // ★ 直接尝试写，写不完再注册 OP_WRITE（避免空转）
        client.write(outBuffer);
        if (outBuffer.hasRemaining()) {                          // Socket 缓冲区满，没写完
            key.interestOps(key.interestOps() | SelectionKey.OP_WRITE);
            key.attach(new WriteContext(buffer, outBuffer));      // 保存未写完的数据
        }

        buffer.clear();                                          // 清空以便下次写入
    }

    /** 处理写事件（只在有数据要写且写不完时才注册） */
    private void write(SelectionKey key) throws IOException {
        SocketChannel client = (SocketChannel) key.channel();
        Object attachment = key.attachment();
        if (!(attachment instanceof WriteContext)) {
            key.interestOps(SelectionKey.OP_READ);                // 无数据可写，取消关注
            return;
        }
        WriteContext ctx = (WriteContext) attachment;
        client.write(ctx.outBuffer);
        if (!ctx.outBuffer.hasRemaining()) {                      // 写完了
            key.attach(ctx.readBuffer);
            key.interestOps(SelectionKey.OP_READ);                // ★ 取消 OP_WRITE，否则空转 CPU 100%
        }
    }

    private static class WriteContext {
        final ByteBuffer readBuffer;
        final ByteBuffer outBuffer;
        WriteContext(ByteBuffer readBuffer, ByteBuffer outBuffer) {
            this.readBuffer = readBuffer;
            this.outBuffer = outBuffer;
        }
    }

    private void closeQuietly(Channel channel) {
        try { channel.close(); } catch (IOException ignored) { }
    }
}

/** NIO 客户端 */
public class NioClient {
    public static void main(String[] args) throws IOException {
        SocketChannel channel = SocketChannel.open();
        channel.configureBlocking(false);
        channel.connect(new InetSocketAddress("127.0.0.1", 8888));

        Selector selector = Selector.open();
        channel.register(selector, SelectionKey.OP_CONNECT);

        while (true) {
            selector.select();
            Iterator<SelectionKey> it = selector.selectedKeys().iterator();
            while (it.hasNext()) {
                SelectionKey key = it.next();
                it.remove();

                if (key.isConnectable()) {
                    SocketChannel sc = (SocketChannel) key.channel();
                    if (sc.isConnectionPending()) sc.finishConnect();   // ★ 完成连接
                    sc.configureBlocking(false);
                    sc.write(ByteBuffer.wrap("你好 NIO".getBytes(StandardCharsets.UTF_8)));
                    sc.register(selector, SelectionKey.OP_READ);
                } else if (key.isReadable()) {
                    SocketChannel sc = (SocketChannel) key.channel();
                    ByteBuffer buffer = ByteBuffer.allocate(1024);
                    int len = sc.read(buffer);
                    if (len > 0) {
                        buffer.flip();
                        System.out.println("服务端响应：" + StandardCharsets.UTF_8.decode(buffer));
                    } else if (len == -1) {
                        sc.close();
                        key.cancel();
                        return;
                    }
                }
            }
        }
    }
}
```

**NIO 编程的五大坑（Netty 就是为了解决这些而生的）：**

| # | 坑 | 后果 | 解决 |
| --- | --- | --- | --- |
| 1 | `selectedKeys` 未 remove | 事件重复处理 | `iterator.remove()` |
| 2 | **OP_WRITE 常驻注册** | Selector 立即返回，**CPU 空转 100%** | 写完立即取消 OP_WRITE |
| 3 | 半包/粘包未处理 | 消息解析错乱 | 自定义协议 + 累积缓冲区 |
| 4 | `ByteBuffer` 忘记 flip | 读不到数据 | 写完 flip，读完 clear/compact |
| 5 | JDK epoll 空轮询 bug | CPU 100%（Linux JDK 6/7 的著名 bug） | Netty 检测到空轮询超阈值就重建 Selector |

> **JDK NIO 的 epoll bug**：在某些 Linux 内核 + JDK 版本组合下，`Selector.select()` 会在没有事件时立即返回 0（本该阻塞），导致 while(true) 死循环，CPU 100%。**Netty 的解决方案**：统计空轮询次数，超过阈值（默认 512）就**重建 Selector 并把原来的 Channel 迁移过去**。这是 Netty 相比原生 NIO 的重要价值之一。
>
> 综上，**生产环境不建议直接用原生 NIO，应该用 Netty**（详见 [[后端/中间件/Netty与网络IO模型]]）。原生 NIO 的价值在于理解 Netty 的设计原理。

## 6. 网络编程实战要点

### 6.1 连接池思想

```java
// 短连接 vs 长连接
// 短连接：每次请求建立连接 → 传输 → 关闭（三次握手 + 四次挥手的开销）
// 长连接：连接建立后保持，多次请求复用（HTTP Keep-Alive、数据库连接池、RPC 长连接）

// 简易连接池实现思想
public class SocketPool {
    private final BlockingQueue<Socket> pool;
    private final String host;
    private final int port;
    private final int maxSize;
    private final AtomicInteger currentSize = new AtomicInteger(0);

    public SocketPool(String host, int port, int maxSize) {
        this.host = host;
        this.port = port;
        this.maxSize = maxSize;
        this.pool = new LinkedBlockingQueue<>(maxSize);
    }

    public Socket borrow() throws Exception {
        Socket socket = pool.poll();                     // 先尝试从池中取
        if (socket != null && isValid(socket)) {
            return socket;                                // 复用
        }
        if (currentSize.get() < maxSize) {                // 池空且未达上限 → 新建
            currentSize.incrementAndGet();
            return createSocket();
        }
        socket = pool.poll(5, TimeUnit.SECONDS);          // 达上限 → 阻塞等待
        if (socket == null) throw new RuntimeException("获取连接超时");
        return socket;
    }

    public void release(Socket socket) {
        if (socket == null) return;
        if (isValid(socket) && pool.offer(socket)) {
            return;                                       // 放回池中
        }
        close(socket);                                    // 无效或池满 → 关闭
        currentSize.decrementAndGet();
    }

    private boolean isValid(Socket socket) {
        return socket != null && socket.isConnected() && !socket.isClosed();
    }

    private Socket createSocket() throws IOException {
        Socket socket = new Socket();
        socket.connect(new InetSocketAddress(host, port), 3000);
        socket.setSoTimeout(10000);
        socket.setTcpNoDelay(true);
        socket.setKeepAlive(true);
        return socket;
    }
}
// 生产环境直接用：Apache Commons Pool2（GenericObjectPool）、HikariCP（数据库）
```

### 6.2 网络编程的检查清单

| 类别 | 必做项 |
| --- | --- |
| **超时** | connect 超时、read 超时、write 超时**全部要设**，绝不使用无限阻塞 |
| **资源** | Socket、Stream 一律 try-with-resources 关闭 |
| **编码** | 显式指定 UTF-8，禁止依赖平台默认编码 |
| **协议** | 自定义协议要有 magic（魔数）、version、length 字段 |
| **粘包** | 必须处理（长度字段 / 分隔符 / 固定长度） |
| **完整性** | 大文件传输加 MD5/SHA 校验 |
| **安全** | 路径穿越校验、报文长度上限（防 OOM 攻击）、TLS 加密、证书校验 |
| **优雅关闭** | `shutdownOutput()` → 读完剩余数据 → `close()` |
| **线程模型** | 高并发用 NIO/Netty，不用一连接一线程 |
| **缓冲区** | 设置合理的 SO_RCVBUF/SO_SNDBUF |
| **背压** | 写不出去时注册 OP_WRITE，写完立即取消 |
| **心跳** | 应用层心跳检测死连接（不要只依赖 TCP KeepAlive） |
| **重试** | 幂等操作可重试，非幂等要谨慎（加唯一请求 ID） |
| **监控** | 连接数、QPS、耗时、错误率 |

## 7. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 未设 connect 超时 | 对方不响应则永久阻塞 | `socket.connect(addr, 5000)` |
| 2 | 未设 read 超时 | 对方不发数据则永久阻塞 | `setSoTimeout(10000)` |
| 3 | `isConnected()` 判断连接状态 | 已断开仍返回 true | 应用层心跳或 `sendUrgentData` |
| 4 | 忘记 flush | 数据卡在缓冲区发不出去 | `flush()` 或 autoFlush + println |
| 5 | `read()` 返回值当完整数据 | 数据不完整 | 循环读取或 `readFully` |
| 6 | 粘包/拆包未处理 | 消息解析错乱 | 长度字段协议 |
| 7 | 协议长度字段未校验上限 | 恶意大包导致 OOM | 校验 `length > MAX` |
| 8 | 4xx/5xx 用 `getInputStream` | IOException | 用 `getErrorStream()` |
| 9 | TIME_WAIT 端口耗尽 | `BindException` | `setReuseAddress(true)` + 长连接 |
| 10 | backlog 太小 | 高并发连接被拒 | 调大 backlog + `somaxconn` |
| 11 | DNS 查询阻塞 | 首次连接慢 | 缓存 IP、异步解析 |
| 12 | `URLEncoder` 编码路径 | `+` 和 `%2F` 问题 | 用 `URI` 多参构造器 |
| 13 | 一连接一线程 | 万级连接 OOM | NIO/Netty + 线程池 |
| 14 | 禁用证书校验上生产 | 中间人攻击 | 导入正确证书 |
| 15 | `selectedKeys` 未 remove | 事件重复处理 | `iterator.remove()` |
| 16 | OP_WRITE 常驻 | CPU 100% 空转 | 写完立即取消注册 |
| 17 | JDK epoll 空轮询 | CPU 100% | 用 Netty（有重建 Selector 机制） |
| 18 | ByteBuffer 忘 flip | 读不到数据 | 写后 flip，读后 clear |
| 19 | WebSocket 忘 `request(n)` | 收不到后续消息 | 每次处理后 request |
| 20 | 半关闭顺序错 | 数据丢失或 RST | shutdownOutput → 读完 → close |
| 21 | UDP 包过大 | IP 分片丢包 | 单包 < 1400 字节 |
| 22 | UDP 不设超时 | 丢包后永久等待 | `setSoTimeout` + 应用层重试 |
| 23 | 文件名未做路径穿越校验 | 文件写到任意位置 | `normalize().startsWith(baseDir)` |
| 24 | HttpURLConnection 不支持 PATCH | 抛异常 | 换 JDK 11 HttpClient |
| 25 | 响应体 Stream 未消费完 | 连接不释放 | 消费完或关闭 |

---

## 关联笔记

- 上一篇：[[后端/Java基础/Java8新特性-Lambda与Stream]]
- 下一篇：[[后端/Java基础/并发编程/线程基础与生命周期]]
- 相关：[[后端/Java基础/IO流与文件操作]]（NIO 三大组件详解）
- 协议原理：[[后端/JavaWeb/Web基础与HTTP协议]]（TCP 握手、HTTP 报文、HTTPS）
- 工业级框架：[[后端/中间件/Netty与网络IO模型]]（Reactor 模式、零拷贝、粘包解码器）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
