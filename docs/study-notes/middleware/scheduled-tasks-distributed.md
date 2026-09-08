---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - 定时任务
  - 分布式调度
  - XXL-JOB
  - Quartz
---

# 定时任务与分布式调度

> **核心定位**：从 Spring `@Scheduled` 到分布式任务调度框架（XXL-JOB、Quartz），解决多实例部署下的任务重复执行问题。

## 1. Spring @Scheduled

### 1.1 基础用法

```java
@Configuration
@EnableScheduling
public class ScheduleConfig implements SchedulingConfigurer {
    
    /**
     * ★ 配置线程池（默认单线程！所有任务串行执行）
     */
    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.setScheduler(taskScheduler());
    }
    
    @Bean(destroyMethod = "shutdown")
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10);                          // ★ 线程池大小
        scheduler.setThreadNamePrefix("scheduled-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true); // 优雅停机
        scheduler.setAwaitTerminationSeconds(60);
        scheduler.setRejectedExecutionHandler(
            new ThreadPoolExecutor.CallerRunsPolicy());    // 拒绝策略
        scheduler.setErrorHandler(t -> 
            log.error("定时任务执行异常", t));              // ★ 全局异常处理
        return scheduler;
    }
}

@Component
@Slf4j
public class OrderScheduledTasks {
    
    /**
     * cron 表达式：秒 分 时 日 月 周
     * "0 */5 * * * ?" = 每5分钟执行一次
     */
    @Scheduled(cron = "0 */5 * * * ?", zone = "Asia/Shanghai")
    public void closeExpiredOrders() {
        log.info("关闭超时订单开始");
        int count = orderService.closeExpiredOrders();
        log.info("关闭超时订单完成，处理 {} 笔", count);
    }
    
    /**
     * fixedRate：上次开始后固定频率（不管上次是否结束）
     */
    @Scheduled(fixedRate = 60000)
    public void refreshCache() {
        cacheService.refresh();
    }
    
    /**
     * fixedDelay：上次结束后固定延迟
     */
    @Scheduled(fixedDelay = 30000, initialDelay = 60000)
    public void syncStock() {
        stockService.syncFromRedis();
    }
    
    /**
     * 从配置文件读取 cron
     */
    @Scheduled(cron = "${task.report.cron:0 0 2 * * ?}")
    public void dailyReport() {
        reportService.generateDaily();
    }
}
```

### 1.2 cron 表达式

```
┌─────────────────────────────────────────────┐
│ cron 表达式（7位：秒 分 时 日 月 周 年）       │
├─────────────────────────────────────────────┤
│ *    任意值                                  │
│ */5  每隔5个单位                             │
│ 0-10 范围                                    │
│ 1,3,5 列表                                   │
│ ?    不指定（日/周互斥）                      │
│ L    最后（Last）                            │
│ W    最近工作日                              │
│ #    第几周                                  │
├─────────────────────────────────────────────┤
│ 常用示例：                                   │
│ 0 */5 * * * ?     每5分钟                    │
│ 0 0 2 * * ?       每天凌晨2点                │
│ 0 0 0 * * MON     每周一凌晨                 │
│ 0 0 9-18 * * ?    每天9点到18点整点          │
│ 0 0 0 1 * ?       每月1日凌晨                │
│ 0 0 0 L * ?       每月最后一天凌晨            │
└─────────────────────────────────────────────┘
```

## 2. 分布式任务重复执行问题

```
┌─────────────────────────────────────────────┐
│ 问题场景                                      │
├─────────────────────────────────────────────┤
│ 3个实例部署，每个实例都会执行定时任务           │
│ → 同一任务被重复执行3次！                     │
│                                              │
│ 解决方案：                                    │
│ 1. 分布式锁（Redisson）                       │
│ 2. ★ XXL-JOB（调度中心统一调度）              │
│ 3. Quartz 集群模式                            │
└─────────────────────────────────────────────┘
```

### 2.1 Redis 分布式锁方案

```java
@Component
@Slf4j
public class DistributedScheduledTask {
    
    @Autowired
    private RedissonClient redisson;
    
    @Scheduled(cron = "0 */5 * * * ?")
    public void closeExpiredOrders() {
        RLock lock = redisson.getLock("lock:scheduled:closeExpiredOrders");
        
        // ★ tryLock(0, ...) 不等待（拿不到锁说明别的实例在执行）
        try {
            if (lock.tryLock(0, 10, TimeUnit.MINUTES)) {
                try {
                    int count = orderService.closeExpiredOrders();
                    log.info("关闭超时订单完成，处理 {} 笔", count);
                } finally {
                    if (lock.isHeldByCurrentThread()) {
                        lock.unlock();
                    }
                }
            } else {
                log.debug("其他实例正在执行，跳过");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

## 3. XXL-JOB 分布式调度

### 3.1 架构

```
┌─────────────────────────────────────────────┐
│ XXL-JOB 架构                                  │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────────────┐    ┌─────────────┐          │
│  │  调度中心   │    │  执行器集群  │          │
│  │ (Admin)     │←──→│ (Executor)  │          │
│  │             │    │             │          │
│  │ - 任务管理   │    │ - 实例1     │          │
│  │ - 日志管理   │    │ - 实例2     │          │
│  │ - 调度日志   │    │ - 实例3     │          │
│  └─────────────┘    └─────────────┘          │
│                                              │
│  调度中心负责：                                │
│    1. 定时触发任务                            │
│    2. ★ 路由到一台执行器执行（避免重复）       │
│    3. 收集执行日志                            │
│    4. 失败告警                                │
│                                              │
│  执行器负责：                                  │
│    1. 注册到调度中心                          │
│    2. 执行任务（Bean 方法）                   │
│    3. 上报执行结果                            │
└─────────────────────────────────────────────┘
```

### 3.2 集成

```xml
<dependency>
    <groupId>com.xuxueli</groupId>
    <artifactId>xxl-job-core</artifactId>
    <version>2.4.1</version>
</dependency>
```

```yaml
xxl:
  job:
    admin:
      addresses: http://localhost:8080/xxl-job-admin  # 调度中心地址
    accessToken: your_token
    executor:
      appname: mall-service                          # 执行器名称
      address:
      ip:
      port: 9999                                     # 执行器端口
      logpath: /data/logs/xxl-job                   # 日志路径
      logretentiondays: 30                           # 日志保留天数
```

```java
@Configuration
public class XxlJobConfig {
    
    @Value("${xxl.job.admin.addresses}")
    private String adminAddresses;
    
    @Value("${xxl.job.accessToken}")
    private String accessToken;
    
    @Value("${xxl.job.executor.appname}")
    private String appname;
    
    @Value("${xxl.job.executor.port}")
    private int port;
    
    @Value("${xxl.job.executor.logpath}")
    private String logPath;
    
    @Bean
    public XxlJobSpringExecutor xxlJobExecutor() {
        XxlJobSpringExecutor executor = new XxlJobSpringExecutor();
        executor.setAdminAddresses(adminAddresses);
        executor.setAccessToken(accessToken);
        executor.setAppname(appname);
        executor.setPort(port);
        executor.setLogPath(logPath);
        executor.setLogRetentionDays(30);
        return executor;
    }
}

// 任务示例
@Component
@Slf4j
public class XxlJobTasks {
    
    @Autowired
    private OrderService orderService;
    @Autowired
    private ReportService reportService;
    
    /**
     * ★ 简单任务
     */
    @XxlJob("closeExpiredOrders")
    public void closeExpiredOrders() {
        String param = XxlJobHelper.getJobParam();  // 获取任务参数
        int count = orderService.closeExpiredOrders();
        XxlJobHelper.log("关闭超时订单 {} 笔", count);  // ★ 写入调度日志
    }
    
    /**
     * 分片广播任务（★ 大数据量分片处理）
     */
    @XxlJob("syncAllProductStock")
    public void syncProductStock() {
        int shardIndex = XxlJobHelper.getShardIndex();   // 当前分片序号
        int shardTotal = XxlJobHelper.getShardTotal();    // 总分片数
        
        XxlJobHelper.log("分片任务：{}/{}", shardIndex + 1, shardTotal);
        
        // 按 ID 取模分片处理
        int pageSize = 1000;
        int lastId = 0;
        while (true) {
            List<Product> products = productMapper.selectByMinId(lastId, pageSize);
            if (products.isEmpty()) break;
            
            for (Product product : products) {
                // ★ 只处理属于自己的分片
                if (product.getId() % shardTotal == shardIndex) {
                    stockService.syncOne(product.getId());
                }
            }
            
            lastId = products.get(products.size() - 1).getId();
        }
    }
    
    /**
     * 带参数的任务
     */
    @XxlJob("generateReport")
    public void generateReport() {
        String dateStr = XxlJobHelper.getJobParam();  // 参数：日期
        LocalDate date = LocalDate.parse(dateStr);
        reportService.generateDailyReport(date);
    }
}
```

**XXL-JOB 路由策略**：

```
┌─────────────────────────────────────────────┐
│ 任务路由策略                                  │
├─────────────────────────────────────────────┤
│ FIRST          选择第一个执行器               │
│ LAST           选择最后一个执行器             │
│ ROUND          轮询                          │
│ RANDOM         随机                          │
│ CONSISTENT_HASH 一致性哈希                   │
│ LEAST_FREQUENT  最少使用                     │
│ LEAST_RECENTLY_USED 最近最久未使用            │
│ FAILOVER       ★ 故障转移（推荐）            │
│ BUSYOVER       忙碌转移                     │
│ SHARDING_BROADCAST ★ 分片广播                │
└─────────────────────────────────────────────┘
```

## 4. Quartz 调度框架

```java
// Quartz 依赖
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-quartz</artifactId>
</dependency>

// 任务定义
public class OrderCloseJob extends QuartzJobBean {
    @Override
    protected void executeInternal(JobExecutionContext context) {
        JobDataMap dataMap = context.getMergedJobDataMap();
        int timeout = dataMap.getInt("timeout");
        
        int count = orderService.closeExpiredOrders(timeout);
        log.info("Quartz 任务执行完成，处理 {} 笔", count);
    }
}

// 配置
@Configuration
public class QuartzConfig {
    
    @Bean
    public JobDetail orderCloseJobDetail() {
        return JobBuilder.newJob(OrderCloseJob.class)
            .withIdentity("orderCloseJob", "orderGroup")
            .usingJobData("timeout", 30)
            .storeDurably()
            .build();
    }
    
    @Bean
    public Trigger orderCloseTrigger(JobDetail orderCloseJobDetail) {
        return TriggerBuilder.newTrigger()
            .forJob(orderCloseJobDetail)
            .withIdentity("orderCloseTrigger", "orderGroup")
            .withSchedule(CronScheduleBuilder
                .cronSchedule("0 */5 * * * ?")
                .inTimeZone(TimeZone.getTimeZone("Asia/Shanghai")))
            .build();
    }
}
```

## 5. 框架对比

```
┌─────────────────────────────────────────────┐
│ 定时任务框架对比                              │
├─────────────────────────────────────────────┤
│ Spring @Scheduled：                          │
│   - 最简单，无需中间件                       │
│   - ★ 单机场景，分布式需要加锁               │
│   - 无法动态调度                             │
│                                              │
│ Quartz：                                     │
│   - 功能强大，支持集群                        │
│   - 需要数据库表存储任务                     │
│   - API 较复杂                               │
│                                              │
│ ★ XXL-JOB（推荐）：                          │
│   - 可视化管理界面                           │
│   - 动态调度（不停机修改 cron）               │
│   - ★ 分布式调度（避免重复执行）             │
│   - 分片广播（大数据量处理）                 │
│   - 失败告警                                 │
│   - ★ 国内主流选择                           │
│                                              │
│ ElasticJob（当当）：                         │
│   - 基于 Zookeeper                           │
│   - 功能与 XXL-JOB 类似                      │
│   - 社区活跃度较低                           │
└─────────────────────────────────────────────┘
```

## 6. 常见问题

```
┌─────────────────────────────────────────────┐
│ 定时任务常见问题                              │
├─────────────────────────────────────────────┤
│ 1. ★ 默认单线程                               │
│    - 所有任务串行，一个卡住全卡               │
│    - 配置 ThreadPoolTaskScheduler            │
│                                              │
│ 2. ★ 异常导致任务停止                        │
│    - @Scheduled 抛异常后该任务不再调度        │
│    - ★ 必须 try-catch 或配 ErrorHandler      │
│                                              │
│ 3. 分布式重复执行                             │
│    - 多实例各执行一次                        │
│    - ★ Redisson 锁 / XXL-JOB                 │
│                                              │
│ 4. 任务执行超时                              │
│    - 大数据量任务执行过长                     │
│    - ★ 分片处理 / 异步执行                    │
│                                              │
│ 5. 时区问题                                  │
│    - cron 默认用服务器时区                   │
│    - ★ 指定 zone = "Asia/Shanghai"           │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/SpringBoot/测试与常用整合实战]]：Spring @Scheduled 配置
- [[后端/中间件/Redis在Java项目中的整合]]：Redisson 分布式锁
- [[后端/消息队列/消息可靠性与常见问题]]：延迟消息实现定时效果
