---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - Zookeeper
  - 分布式协调
  - Curator
  - 分布式锁
---

# Zookeeper与分布式协调

> **核心定位**：Zookeeper（ZK）是分布式协调服务，提供配置管理、命名服务、分布式锁、集群管理、选主等能力。是 Dubbo、Kafka 的底层依赖。

## 1. ZK 核心概念

```
┌─────────────────────────────────────────────┐
│ ZK 数据模型（树形结构，类似文件系统）          │
├─────────────────────────────────────────────┤
│ /                                           │
│ ├── /app1                                   │
│ │   ├── /app1/config                        │
│ │   ├── /app1/leader                        │
│ │   └── /app1/members                       │
│ │       ├── /app1/members/node1             │
│ │       └── /app1/members/node2             │
│ └── /app2                                   │
│                                              │
│ ★ 节点（ZNode）：                             │
│   - 每个节点存储数据（<1MB）                  │
│   - 每个节点有版本号（CAS 乐观锁）            │
│   - 节点类型：                                │
│     持久节点（PERSISTENT）                    │
│     持久顺序节点（PERSISTENT_SEQUENTIAL）     │
│     临时节点（EPHEMERAL）                     │
│     临时顺序节点（EPHEMERAL_SEQUENTIAL）      │
│     容器节点（CONTAINER）                     │
│                                              │
│ ★ Watcher（监听器）：                         │
│   - 节点创建/删除/数据变更时通知客户端        │
│   - 一次性触发（触发后需重新注册）            │
└─────────────────────────────────────────────┘
```

## 2. ZAB 协议

```
┌─────────────────────────────────────────────┐
│ ZAB 协议（Zookeeper Atomic Broadcast）       │
├─────────────────────────────────────────────┤
│                                              │
│ 阶段1：崩溃恢复（Leader 选举）                │
│   - 所有节点初始状态为 LOOKING                │
│   - 各节点投票（myid + zxid）                │
│   - ★ zxid 大的优先，其次 myid 大的优先       │
│   - 超过半数同意 → 成为 Leader               │
│                                              │
│ 阶段2：消息广播（原子广播）                    │
│   - Leader 收到写请求                         │
│   - 生成 Proposal（zxid 递增）                │
│   - 发送给所有 Follower                       │
│   - Follower 写入本地日志，回复 ACK           │
│   - ★ 超过半数 ACK → Leader 发送 COMMIT       │
│   - Follower 应用事务                         │
│                                              │
│ ★ 写操作必须经过 Leader                       │
│ ★ 读操作可以从任意 Follower 读                │
└─────────────────────────────────────────────┘
```

## 3. Curator 客户端

```xml
<dependency>
    <groupId>org.apache.curator</groupId>
    <artifactId>curator-recipes</artifactId>
    <version>5.5.0</version>
</dependency>
```

```java
@Configuration
public class ZkConfig {
    
    @Bean
    public CuratorFramework curatorFramework() {
        CuratorFramework client = CuratorFrameworkFactory.builder()
            .connectString("localhost:2181")
            .sessionTimeoutMs(60000)
            .connectionTimeoutMs(15000)
            .retryPolicy(new ExponentialBackoffRetry(1000, 3))  // 重试策略
            .namespace("mall")  // 命名空间（自动加前缀）
            .build();
        client.start();
        return client;
    }
}
```

## 4. 分布式锁

### 4.1 可重入锁

```java
@Service
public class ZkLockService {
    
    @Autowired
    private CuratorFramework client;
    
    /**
     * ★ Curator InterProcessMutex（可重入排他锁）
     */
    public <T> T executeWithLock(String path, long timeout, TimeUnit unit, 
                                 Supplier<T> supplier) {
        InterProcessMutex lock = new InterProcessMutex(client, path);
        try {
            if (lock.acquire(timeout, unit)) {
                try {
                    return supplier.get();
                } finally {
                    lock.release();
                }
            } else {
                throw new RuntimeException("获取 ZK 锁超时：" + path);
            }
        } catch (Exception e) {
            throw new RuntimeException("ZK 锁异常", e);
        }
    }
}
```

### 4.2 公平锁（临时顺序节点）

```
┌─────────────────────────────────────────────┐
│ ZK 分布式锁实现原理（公平锁）                 │
├─────────────────────────────────────────────┤
│                                              │
│ 1. 客户端在 /lock 下创建临时顺序节点           │
│    /lock/node-00000001                       │
│    /lock/node-00000002                       │
│    /lock/node-00000003                       │
│                                              │
│ 2. 判断自己是否是最小节点                      │
│    - 是最小 → 获得锁                          │
│    - 不是 → 监听前一个节点的删除事件           │
│                                              │
│ 3. 前一个节点释放锁（删除节点）                │
│    - Watcher 通知下一个节点                   │
│    - 下一个节点获得锁                         │
│                                              │
│ ★ 临时节点：客户端断开后自动删除（防死锁）     │
│ ★ 顺序节点：实现公平排队                      │
│ ★ 监听前一个：避免羊群效应                    │
└─────────────────────────────────────────────┘
```

## 5. 集群选主

```java
@Service
public class LeaderElectionService {
    
    @Autowired
    private CuratorFramework client;
    
    private LeaderLatch leaderLatch;
    private LeaderSelector leaderSelector;
    
    /**
     * ★ LeaderLatch：选主后不可放弃
     */
    public void startLeaderLatch() throws Exception {
        leaderLatch = new LeaderLatch(client, "/leader/latch", "instance-" + getInstanceId());
        leaderLatch.start();
        
        // 等待选主完成
        leaderLatch.await(10, TimeUnit.SECONDS);
        
        if (leaderLatch.hasLeadership()) {
            log.info("★ 当前实例被选为 Leader");
            // 执行 Leader 独有的任务（如定时任务调度）
            startLeaderOnlyTasks();
        } else {
            log.info("当前实例为 Follower");
        }
    }
    
    /**
     * ★ LeaderSelector：选主后可主动放弃（轮换）
     */
    public void startLeaderSelector() {
        leaderSelector = new LeaderSelector(client, "/leader/selector", 
            new LeaderSelectorListenerAdapter() {
                @Override
                public void takeLeadership(CuratorFramework client) throws Exception {
                    log.info("★ 获得领导权");
                    try {
                        // 执行 Leader 任务
                        while (true) {
                            Thread.sleep(1000);
                            // 定时调度...
                        }
                    } finally {
                        log.info("放弃领导权");
                    }
                }
            });
        leaderSelector.autoRequeue();  // ★ 放弃后自动重新排队
        leaderSelector.start();
    }
    
    /**
     * Leader 断线自动切换
     */
    @PostConstruct
    public void watchLeaderChange() {
        try {
            NodeCache nodeCache = new NodeCache(client, "/leader/latch");
            nodeCache.getListenable().addListener(() -> {
                ChildData data = nodeCache.getCurrentData();
                if (data == null) {
                    log.warn("Leader 节点消失，等待重新选主");
                } else {
                    log.info("Leader 节点：{}", new String(data.getData()));
                }
            });
            nodeCache.start();
        } catch (Exception e) {
            log.error("监听 Leader 变化异常", e);
        }
    }
}
```

## 6. 注册中心（Dubbo 场景）

```
┌─────────────────────────────────────────────┐
│ ZK 作为注册中心的工作流程                     │
├─────────────────────────────────────────────┤
│                                              │
│ 服务提供者注册：                               │
│   创建临时节点                                │
│   /dubbo/com.example.UserService/providers   │
│       /provider-192.168.1.1:20880            │
│       /provider-192.168.1.2:20880            │
│                                              │
│ 服务消费者订阅：                               │
│   获取 /providers 下所有子节点                 │
│   注册 Watcher 监听变化                        │
│                                              │
│ 服务提供者宕机：                               │
│   ★ 临时节点自动删除                          │
│   Watcher 通知消费者更新列表                   │
│                                              │
│ vs Nacos：                                    │
│   ZK：CP 模型（强一致），注册慢               │
│   Nacos：AP 模型（最终一致），注册快 ★ 推荐   │
└─────────────────────────────────────────────┘
```

## 7. 常见问题

```
┌─────────────────────────────────────────────┐
│ ZK 常见问题                                   │
├─────────────────────────────────────────────┤
│ 1. Watcher 一次性触发                        │
│    - 触发后需重新注册                        │
│    - ★ 用 Curator 的 Cache（自动重新注册）   │
│                                              │
│ 2. 羊群效应                                  │
│    - 所有客户端监听同一节点                   │
│    - 节点变化时通知所有客户端                 │
│    - ★ 监听前一个节点（顺序节点）             │
│                                              │
│ 3. Session 过期                              │
│    - 网络分区导致 Session 超时                │
│    - 临时节点被删除                          │
│    - ★ 合理设置 sessionTimeout               │
│                                              │
│ 4. 集群最少3台                               │
│    - 2N+1 台（容忍 N 台宕机）                 │
│    - 3台容忍1台，5台容忍2台                   │
│                                              │
│ 5. 不适合存储大数据                          │
│    - 每个节点 < 1MB                          │
│    - 只存储元数据和协调信息                   │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/中间件/Redis在Java项目中的整合]]：Redis 分布式锁对比
- [[后端/微服务/Nacos注册中心与配置中心]]：Nacos vs ZK
- [[后端/微服务/SpringCloud技术体系与版本选型]]：ZK 在微服务中的角色
