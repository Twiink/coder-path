---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - 网络编程
  - Netty
  - NIO
  - 高性能
---

# Netty与网络IO模型

> **核心定位**：Netty 是基于 NIO 的高性能网络框架，是 RPC 框架（Dubbo）、消息中间件（RocketMQ）、微服务网关（Spring Cloud Gateway）的底层基石。

## 1. 网络 IO 模型演进

### 1.1 BIO（同步阻塞）

```java
// 传统 Socket 编程：一个连接一个线程
ServerSocket server = new ServerSocket(8080);
while (true) {
    Socket client = server.accept();  // ★ 阻塞等待连接
    new Thread(() -> {
        try {
            InputStream in = client.getInputStream();
            byte[] buf = new byte[1024];
            int len = in.read(buf);  // ★ 阻塞等待数据
            System.out.println(new String(buf, 0, len));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }).start();
}
```

**问题**：
- 连接数多时线程爆炸（10万连接 = 10万线程）
- 线程切换开销大
- 内存占用高（每线程默认 1MB 栈）

### 1.2 NIO（同步非阻塞）

JDK 1.4 引入 NIO（New IO），核心组件：

| 组件 | 作用 | 类比 |
|------|------|------|
| `Channel` | 数据传输通道（双向） | 铁轨 |
| `Buffer` | 数据缓冲区 | 火车车厢 |
| `Selector` | 多路复用器（监控多个Channel） | 调度员 |

```java
// NIO 核心流程
ServerSocketChannel serverChannel = ServerSocketChannel.open();
serverChannel.configureBlocking(false);  // ★ 非阻塞模式
serverChannel.bind(new InetSocketAddress(8080));

Selector selector = Selector.open();
serverChannel.register(selector, SelectionKey.OP_ACCEPT);  // 注册监听

while (true) {
    selector.select();  // ★ 阻塞直到有事件就绪
    Set<SelectionKey> keys = selector.selectedKeys();
    Iterator<SelectionKey> it = keys.iterator();
    while (it.hasNext()) {
        SelectionKey key = it.next();
        it.remove();
        
        if (key.isAcceptable()) {
            // 处理新连接
            SocketChannel client = serverChannel.accept();
            client.configureBlocking(false);
            client.register(selector, SelectionKey.OP_READ);
        }
        
        if (key.isReadable()) {
            // 处理读事件
            SocketChannel client = (SocketChannel) key.channel();
            ByteBuffer buffer = ByteBuffer.allocate(1024);
            int len = client.read(buffer);  // ★ 非阻塞读取
            if (len > 0) {
                buffer.flip();
                byte[] bytes = new byte[buffer.remaining()];
                buffer.get(bytes);
                System.out.println(new String(bytes));
            }
        }
    }
}
```

**NIO vs BIO 对比**：

| 维度 | BIO | NIO |
|------|-----|-----|
| 线程模型 | 1连接1线程 | 1线程处理多连接 |
| 阻塞性 | 阻塞 | 非阻塞 |
| 数据缓冲 | Stream（无缓冲） | Buffer（有缓冲） |
| 适用场景 | 连接数少且固定 | 连接数多且短连接 |

### 1.3 AIO（异步非阻塞）

JDK 1.7 引入 AIO（Asynchronous IO），基于事件和回调：

```java
// AIO 示例：读完成后回调
AsynchronousSocketChannel client = ...;
ByteBuffer buffer = ByteBuffer.allocate(1024);
client.read(buffer, buffer, new CompletionHandler<Integer, ByteBuffer>() {
    @Override
    public void completed(Integer result, ByteBuffer attachment) {
        // 读完成后回调
        attachment.flip();
        System.out.println("读取完成，字节数：" + result);
    }
    
    @Override
    public void failed(Throwable exc, ByteBuffer attachment) {
        exc.printStackTrace();
    }
});
```

**AIO vs NIO**：

| 维度 | NIO | AIO |
|------|-----|-----|
| 模型 | 同步非阻塞（轮询） | 异步非阻塞（回调） |
| 复杂度 | 中 | 高 |
| 性能 | 高 | 更高（理论） |
| 实际使用 | ★ 主流 | 少（Linux 下性能不如 NIO） |

## 2. IO 多路复用模型

### 2.1 select/poll/epoll

```
┌─────────────────────────────────────────────┐
│ select/poll/epoll 对比                       │
├─────────────────────────────────────────────┤
│ select：                                     │
│   - 最大连接数 1024（FD_SETSIZE）            │
│   - 每次轮询全部 fd（O(n)）                  │
│   - 用户态/内核态频繁拷贝                    │
│                                              │
│ poll：                                       │
│   - 无连接数限制（链表存储）                 │
│   - 仍为 O(n) 轮询                         │
│                                              │
│ epoll（Linux 2.6+）：                        │
│   - 无连接数限制（红黑树存储）               │
│   - 事件驱动（O(1) 回调）                    │
│   - mmap 共享内存（减少拷贝）                │
│   - ★ 高并发首选                             │
└─────────────────────────────────────────────┘
```

```java
// epoll 核心 API（C 语言，理解原理）
int epfd = epoll_create(1024);  // 创建 epoll 实例

struct epoll_event event;
event.events = EPOLLIN;         // 监听读事件
event.data.fd = sockfd;
epoll_ctl(epfd, EPOLL_CTL_ADD, sockfd, &event);  // 注册

struct epoll_event events[1024];
int n = epoll_wait(epfd, events, 1024, -1);  // 阻塞等待事件
for (int i = 0; i < n; i++) {
    // 只处理就绪的连接（O(1)）
    int fd = events[i].data.fd;
    // 处理读写...
}
```

**epoll 优势**：
1. 无连接数限制（红黑树动态扩展）
2. 事件驱动（只返回就绪的 fd）
3. mmap 减少内核态/用户态拷贝

### 2.2 Reactor 模式

```
┌─────────────────────────────────────────────┐
│ Reactor 模式（反应器模式）                    │
├─────────────────────────────────────────────┤
│ 单 Reactor 单线程：                          │
│   Reactor 监听 + 处理业务（Redis 6.0前）      │
│   缺点：业务处理阻塞会影响监听                 │
│                                              │
│ 单 Reactor 多线程：                          │
│   Reactor 监听 → 业务交给线程池               │
│   缺点：Reactor 单点瓶颈                     │
│                                              │
│ ★ 主从 Reactor 多线程（Netty 默认）：         │
│   MainReactor 只负责 accept                  │
│   SubReactor 负责读写（可多个）               │
│   业务处理交给线程池                          │
│   优点：充分利用多核，性能最高                │
└─────────────────────────────────────────────┘
```

```
主从 Reactor 多线程架构：

              ┌─────────────────┐
              │   MainReactor   │  只处理 ACCEPT
              │   (BossGroup)   │
              └────────┬────────┘
                       │ 新连接
         ┌─────────────┼─────────────┐
         ↓             ↓             ↓
   ┌───────────┐ ┌───────────┐ ┌───────────┐
   │SubReactor │ │SubReactor │ │SubReactor │  处理 READ/WRITE
   │(Worker)   │ │(Worker)   │ │(Worker)   │
   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
         │             │             │
         ↓             ↓             ↓
   ┌─────────────────────────────────────┐
   │         业务线程池（可选）            │
   └─────────────────────────────────────┘
```

## 3. Netty 核心组件

### 3.1 架构概览

```java
// Netty 服务端启动模板
EventLoopGroup bossGroup = new NioEventLoopGroup(1);    // ★ Boss：1个线程处理连接
EventLoopGroup workerGroup = new NioEventLoopGroup();   // ★ Worker：默认 CPU*2 处理IO

try {
    ServerBootstrap bootstrap = new ServerBootstrap();
    bootstrap.group(bossGroup, workerGroup)
        .channel(NioServerSocketChannel.class)           // 服务端Channel
        .option(ChannelOption.SO_BACKLOG, 128)           // 连接队列
        .childOption(ChannelOption.SO_KEEPALIVE, true)   // 保持连接
        .childHandler(new ChannelInitializer<SocketChannel>() {
            @Override
            protected void initChannel(SocketChannel ch) {
                ch.pipeline()
                    .addLast(new StringDecoder())        // 解码器
                    .addLast(new StringEncoder())        // 编码器
                    .addLast(new MyServerHandler());     // 业务处理器
            }
        });
    
    ChannelFuture future = bootstrap.bind(8080).sync();
    System.out.println("Netty 服务端启动，端口：8080");
    future.channel().closeFuture().sync();
} finally {
    bossGroup.shutdownGracefully();
    workerGroup.shutdownGracefully();
}
```

### 3.2 核心组件详解

```
┌─────────────────────────────────────────────┐
│ Netty 核心组件                               │
├─────────────────────────────────────────────┤
│ Bootstrap/ServerBootstrap：启动引导类         │
│   - 配置线程模型、Channel、Handler            │
│                                              │
│ EventLoopGroup：事件循环组                    │
│   - BossGroup：处理连接（通常1个线程）        │
│   - WorkerGroup：处理IO（CPU*2个线程）        │
│                                              │
│ Channel：网络通道（Socket 抽象）              │
│   - NioSocketChannel（客户端）                │
│   - NioServerSocketChannel（服务端）          │
│                                              │
│ ChannelPipeline：处理器链                     │
│   - 入站事件：ByteToMessageDecoder → Handler  │
│   - 出站事件：Handler → MessageToByteEncoder  │
│                                              │
│ ChannelHandler：业务处理器                    │
│   - ChannelInboundHandler：入站（读）         │
│   - ChannelOutboundHandler：出站（写）        │
│                                              │
│ ByteBuf：字节缓冲区（替代 ByteBuffer）         │
│   - 读写分离（readerIndex、writerIndex）      │
│   - 自动扩容                                  │
│   - 零拷贝（CompositeByteBuf）                │
└─────────────────────────────────────────────┘
```

### 3.3 ByteBuf 详解

```java
// ByteBuf vs ByteBuffer
ByteBuffer buf = ByteBuffer.allocate(1024);
buf.put("Hello".getBytes());
buf.flip();  // ★ 必须 flip 切换读写模式
byte[] bytes = new byte[buf.remaining()];
buf.get(bytes);

// ByteBuf（Netty）
ByteBuf buf = Unpooled.buffer(1024);
buf.writeBytes("Hello".getBytes());  // 写入
byte[] bytes = new byte[buf.readableBytes()];
buf.readBytes(bytes);  // 读取（自动移动 readerIndex）
// ★ 无需 flip，读写指针分离
```

```
ByteBuf 内存布局：

0          readerIndex    writerIndex    capacity
┌──────────┬──────────────┬──────────────┬──────────┐
│  已读区域  │   可读区域    │   可写区域    │  未分配   │
└──────────┴──────────────┴──────────────┴──────────┘
           ↑              ↑
        读指针          写指针

writeBytes()：writerIndex 后移
readBytes()：readerIndex 后移
discardReadBytes()：压缩已读区域（释放空间）
```

**ByteBuf 类型**：

| 类型 | 内存分配 | 性能 | 使用场景 |
|------|----------|------|----------|
| `UnpooledHeapByteBuf` | JVM 堆 | 中 | 一般场景 |
| `UnpooledDirectByteBuf` | 直接内存 | 高 | 高性能场景 |
| `PooledByteBuf` | 池化内存 | ★ 最高 | ★ 生产推荐 |

```java
// ★ 生产环境使用池化 ByteBuf
Bootstrap bootstrap = new Bootstrap()
    .option(ChannelOption.ALLOCATOR, PooledByteBufAllocator.DEFAULT);  // 池化分配器
```

## 4. Netty 编解码器

### 4.1 粘包拆包问题

```
TCP 是流式协议，无消息边界：

发送方：发送 "Hello" + "World"
接收方可能收到：
  - "HelloWorld"（粘包：两条消息合并）
  - "Hel" + "loWorld"（拆包：一条消息拆分）
  - "Hello" + "World"（正常）
```

**解决方案**：

```java
// 1. 固定长度
ch.pipeline().addLast(new FixedLengthFrameDecoder(100));  // 每100字节一条消息

// 2. 特殊分隔符
ch.pipeline().addLast(new DelimiterBasedFrameDecoder(1024, 
    Unpooled.copiedBuffer("\n", CharsetUtil.UTF_8)));  // 以 \n 分隔

// 3. ★ 长度字段（最常用）
ch.pipeline().addLast(new LengthFieldBasedFrameDecoder(
    65535,    // 最大帧长度
    0,        // 长度字段偏移
    4,        // 长度字段长度（4字节）
    0,        // 长度调整值
    4         // 跳过长度字段
));

// 4. LineBasedFrameDecoder（按行分隔）
ch.pipeline().addLast(new LineBasedFrameDecoder(1024));
```

### 4.2 自定义编解码器

```java
// 自定义协议：[魔数4字节][版本号1字节][序列化方式1字节][指令4字节][数据长度4字节][数据N字节]
// 魔数：0x12345678

// 编码器：对象 → 字节流
public class MyEncoder extends MessageToByteEncoder<MyMessage> {
    @Override
    protected void encode(ChannelHandlerContext ctx, MyMessage msg, ByteBuf out) {
        out.writeInt(0x12345678);           // 魔数
        out.writeByte(1);                   // 版本号
        out.writeByte(msg.getSerializer()); // 序列化方式
        out.writeInt(msg.getCommand());     // 指令
        byte[] data = serialize(msg.getData());  // 序列化数据
        out.writeInt(data.length);          // 数据长度
        out.writeBytes(data);               // 数据
    }
    
    private byte[] serialize(Object data) {
        // JSON / Protobuf / Hessian 等
        return JSON.toJSONString(data).getBytes();
    }
}

// 解码器：字节流 → 对象
public class MyDecoder extends ByteToMessageDecoder {
    private static final int MAGIC_NUMBER = 0x12345678;
    private static final int HEADER_LENGTH = 4 + 1 + 1 + 4 + 4;  // 14字节
    
    @Override
    protected void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) {
        if (in.readableBytes() < HEADER_LENGTH) return;  // 数据不足
        
        in.markReaderIndex();
        int magic = in.readInt();
        if (magic != MAGIC_NUMBER) {
            throw new RuntimeException("魔数错误");
        }
        
        byte version = in.readByte();
        byte serializer = in.readByte();
        int command = in.readInt();
        int dataLength = in.readInt();
        
        if (in.readableBytes() < dataLength) {
            in.resetReaderIndex();  // 数据不足，重置读指针
            return;
        }
        
        byte[] data = new byte[dataLength];
        in.readBytes(data);
        
        MyMessage msg = new MyMessage();
        msg.setVersion(version);
        msg.setSerializer(serializer);
        msg.setCommand(command);
        msg.setData(deserialize(data));
        out.add(msg);
    }
    
    private Object deserialize(byte[] data) {
        return JSON.parseObject(new String(data), Object.class);
    }
}
```

## 5. Netty 心跳与连接管理

### 5.1 心跳检测

```java
// IdleStateHandler：空闲检测
ch.pipeline()
    .addLast(new IdleStateHandler(60, 30, 0, TimeUnit.SECONDS))
    //                          读空闲60s  写空闲30s  读写空闲0（不检测）
    .addLast(new HeartbeatHandler());

public class HeartbeatHandler extends ChannelInboundHandlerAdapter {
    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) {
        if (evt instanceof IdleStateEvent) {
            IdleStateEvent event = (IdleStateEvent) evt;
            if (event.state() == IdleState.READER_IDLE) {
                System.out.println("读空闲，关闭连接");
                ctx.close();
            } else if (event.state() == IdleState.WRITER_IDLE) {
                System.out.println("写空闲，发送心跳");
                ctx.writeAndFlush(new HeartbeatMessage());
            }
        }
    }
}
```

**心跳协议设计**：

```java
// 心跳请求/响应
public class HeartbeatMessage {
    private int type;  // 1=PING, 2=PONG
    private long timestamp;
    
    public static HeartbeatMessage ping() {
        return new HeartbeatMessage(1, System.currentTimeMillis());
    }
    
    public static HeartbeatMessage pong() {
        return new HeartbeatMessage(2, System.currentTimeMillis());
    }
}

// 服务端处理心跳
public class HeartbeatServerHandler extends SimpleChannelInboundHandler<HeartbeatMessage> {
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, HeartbeatMessage msg) {
        if (msg.getType() == 1) {  // PING
            ctx.writeAndFlush(HeartbeatMessage.pong());
        }
    }
}
```

### 5.2 连接管理器

```java
// 连接管理器：维护在线用户与 Channel 的映射
@Component
public class ChannelManager {
    private final Map<String, Channel> userChannelMap = new ConcurrentHashMap<>();
    private final Map<String, Channel> channelUserMap = new ConcurrentHashMap<>();
    
    public void bind(String userId, Channel channel) {
        userChannelMap.put(userId, channel);
        channelUserMap.put(channel.id().asLongText(), userId);
    }
    
    public void unbind(Channel channel) {
        String userId = channelUserMap.remove(channel.id().asLongText());
        if (userId != null) {
            userChannelMap.remove(userId);
        }
    }
    
    public void sendToUser(String userId, Object msg) {
        Channel channel = userChannelMap.get(userId);
        if (channel != null && channel.isActive()) {
            channel.writeAndFlush(msg);
        }
    }
    
    public void broadcast(Object msg) {
        userChannelMap.values().forEach(ch -> {
            if (ch.isActive()) {
                ch.writeAndFlush(msg);
            }
        });
    }
    
    public int getOnlineCount() {
        return userChannelMap.size();
    }
}
```

## 6. Netty 性能优化

### 6.1 线程模型优化

```java
// ★ 生产环境推荐配置
EventLoopGroup bossGroup = new NioEventLoopGroup(1);  // Boss：1个线程
EventLoopGroup workerGroup = new NioEventLoopGroup(
    Runtime.getRuntime().availableProcessors() * 2,    // Worker：CPU*2
    new DefaultThreadFactory("worker", Thread.MAX_PRIORITY)
);

// 业务线程池（避免 IO 线程阻塞）
EventExecutorGroup businessGroup = new DefaultEventExecutorGroup(16);
ch.pipeline().addLast(businessGroup, new BusinessHandler());  // 业务交给独立线程池
```

### 6.2 零拷贝

```java
// 传统 IO：磁盘 → 内核缓冲区 → 用户缓冲区 → Socket缓冲区 → 网卡（4次拷贝）
// 零拷贝：磁盘 → 内核缓冲区 → Socket缓冲区 → 网卡（2次拷贝）

// Netty 的零拷贝实现
// 1. CompositeByteBuf：逻辑合并多个 ByteBuf（无内存拷贝）
CompositeByteBuf composite = Unpooled.compositeBuffer();
composite.addComponents(true, header, body);

// 2. FileRegion：文件传输（底层使用 sendfile）
File file = new File("data.txt");
FileRegion region = new DefaultFileRegion(
    new FileInputStream(file).getChannel(), 0, file.length());
ctx.writeAndFlush(region);

// 3. wrap：包装 byte[] 为 ByteBuf（无拷贝）
ByteBuf buf = Unpooled.wrappedBuffer(bytes);
```

### 6.3 内存池化

```java
// ★ 启用 ByteBuf 池化（减少 GC）
Bootstrap bootstrap = new Bootstrap()
    .option(ChannelOption.ALLOCATOR, PooledByteBufAllocator.DEFAULT);

// 使用时从池中获取
ByteBuf buf = ctx.alloc().buffer();  // 从池获取
try {
    // 使用 buf
} finally {
    buf.release();  // ★ 必须释放回池
}

// 或使用 SimpleChannelInboundHandler（自动释放）
public class MyHandler extends SimpleChannelInboundHandler<MyMessage> {
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, MyMessage msg) {
        // msg 自动释放
    }
}
```

## 7. Netty 实战：RPC 框架

### 7.1 RPC 调用流程

```
客户端                                    服务端
  │                                        │
  │  1. 动态代理拦截方法调用                │
  │  2. 序列化请求参数                     │
  │  3. 编码为字节流                       │
  │  4. Netty 发送                         │
  │  ───────────────────────────────────>  │
  │                                        │  5. Netty 接收
  │                                        │  6. 解码为请求对象
  │                                        │  7. 反序列化参数
  │                                        │  8. 反射调用目标方法
  │                                        │  9. 序列化响应
  │  <───────────────────────────────────  │  10. Netty 发送响应
  │  11. Netty 接收响应                    │
  │  12. 解码                              │
  │  13. 反序列化                          │
  │  14. 返回结果                          │
```

### 7.2 核心代码

```java
// 客户端：动态代理 + Netty
public class RpcClientProxy {
    private String host;
    private int port;
    
    @SuppressWarnings("unchecked")
    public <T> T create(Class<T> interfaceClass) {
        return (T) Proxy.newProxyInstance(
            interfaceClass.getClassLoader(),
            new Class<?>[]{interfaceClass},
            (proxy, method, args) -> {
                // 1. 构建请求
                RpcRequest request = new RpcRequest();
                request.setRequestId(UUID.randomUUID().toString());
                request.setClassName(method.getDeclaringClass().getName());
                request.setMethodName(method.getName());
                request.setParameterTypes(method.getParameterTypes());
                request.setParameters(args);
                
                // 2. 发送请求并等待响应
                RpcResponse response = sendRequest(request);
                
                // 3. 处理响应
                if (response.getError() != null) {
                    throw response.getError();
                }
                return response.getResult();
            }
        );
    }
    
    private RpcResponse sendRequest(RpcRequest request) throws Exception {
        // Netty 客户端发送请求，阻塞等待响应
        RpcClient client = new RpcClient(host, port);
        return client.send(request).get(5, TimeUnit.SECONDS);
    }
}

// 服务端：反射调用 + Netty
public class RpcServerHandler extends SimpleChannelInboundHandler<RpcRequest> {
    private Map<String, Object> serviceMap;  // 服务名 → 实现类
    
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, RpcRequest request) {
        RpcResponse response = new RpcResponse();
        response.setRequestId(request.getRequestId());
        
        try {
            // 1. 获取服务实现
            Object service = serviceMap.get(request.getClassName());
            if (service == null) {
                throw new RuntimeException("服务不存在：" + request.getClassName());
            }
            
            // 2. 反射调用
            Method method = service.getClass().getMethod(
                request.getMethodName(), request.getParameterTypes());
            Object result = method.invoke(service, request.getParameters());
            
            response.setResult(result);
        } catch (Exception e) {
            response.setError(e);
        }
        
        ctx.writeAndFlush(response);
    }
}
```

## 8. Netty vs 其他网络框架

```
┌─────────────────────────────────────────────┐
│ 网络框架对比                                 │
├─────────────────────────────────────────────┤
│ Netty：                                      │
│   - ★ 高性能（零拷贝、内存池）               │
│   - ★ 生态好（Dubbo、RocketMQ 底层）         │
│   - 学习曲线陡峭                             │
│                                              │
│ Mina：                                       │
│   - Apache 出品                              │
│   - 性能略低于 Netty                         │
│   - 社区活跃度低                             │
│                                              │
│ Vert.x：                                     │
│   - 基于 Netty 的上层框架                    │
│   - 支持多语言（Java/Kotlin/JS）              │
│   - 适合快速开发                             │
│                                              │
│ gRPC：                                       │
│   - Google 出品                              │
│   - 基于 HTTP/2 + Protobuf                   │
│   - 跨语言支持好                             │
│                                              │
│ ★ 推荐：Netty（高性能场景）、gRPC（微服务）  │
└─────────────────────────────────────────────┘
```

## 9. 常见问题

```
┌─────────────────────────────────────────────┐
│ Netty 常见问题                                │
├─────────────────────────────────────────────┤
│ 1. 内存泄漏                                  │
│    - ByteBuf 未 release                      │
│    - ★ 使用 ResourceLeakDetector 检测        │
│    - 继承 SimpleChannelInboundHandler（自动释放）│
│                                              │
│ 2. 线程阻塞                                  │
│    - IO 线程执行耗时业务                      │
│    - ★ 业务交给独立线程池                     │
│                                              │
│ 3. 连接泄漏                                  │
│    - 未正确关闭 Channel                       │
│    - ★ 使用 IdleStateHandler 检测空闲连接     │
│                                              │
│ 4. 粘包拆包                                  │
│    - TCP 流式协议无边界                       │
│    - ★ 使用 LengthFieldBasedFrameDecoder      │
│                                              │
│ 5. 心跳超时                                  │
│    - 网络抖动导致误判                         │
│    - ★ 客户端发送 PING，服务端响应 PONG       │
│    - ★ 多次超时才关闭连接                     │
└─────────────────────────────────────────────┘
```

## 10. 总结

```
┌─────────────────────────────────────────────┐
│ Netty 核心知识点                              │
├─────────────────────────────────────────────┤
│ 1. IO 模型                                   │
│    - BIO → NIO → AIO                        │
│    - ★ NIO + epoll 是高并发首选              │
│                                              │
│ 2. Reactor 模式                              │
│    - ★ 主从 Reactor 多线程（Netty 默认）      │
│                                              │
│ 3. Netty 核心组件                            │
│    - EventLoopGroup、Channel、Pipeline       │
│    - ★ ByteBuf（读写分离、自动扩容）          │
│                                              │
│ 4. 编解码器                                  │
│    - ★ 解决粘包拆包（LengthFieldBased...）    │
│    - 自定义协议（魔数+版本号+长度）           │
│                                              │
│ 5. 性能优化                                  │
│    - ★ 零拷贝、内存池化、线程模型优化         │
│                                              │
│ 6. 实战                                      │
│    - RPC 框架、IM 系统、网关                  │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/Java基础/网络编程]]：Java Socket 基础
- [[后端/消息队列/RocketMQ]]：基于 Netty 的消息中间件
- [[后端/微服务/Gateway网关]]：基于 Netty 的微服务网关
