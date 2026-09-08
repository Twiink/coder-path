# 03 Redis 持久化：RDB 快照与 AOF 日志

Redis 是内存数据库，但生产环境必须考虑**数据持久化**——防止服务器宕机后数据全部丢失。Redis 提供两种持久化机制：**RDB 快照**和 **AOF 日志**，可以单独使用，也可以组合使用（推荐）。

## 3.1 RDB 快照（Redis Database Backup）

### 3.1.1 原理

RDB 是 Redis 默认的持久化方式，在**指定的时间间隔内**将内存中的数据集快照（snapshot）写入磁盘，生成一个紧凑的二进制文件（默认 `dump.rdb`）。

```text
RDB 持久化流程：
  ① Redis 主进程 fork 一个子进程
  ② 子进程将内存数据写入临时 RDB 文件
  ③ 写入完成后，用新文件替换旧文件
  ④ 主进程继续处理客户端请求（不阻塞）

特点：
  · 全量快照：每次都是完整数据集
  · 写时复制（Copy-on-Write）：fork 后父子进程共享内存页，
    只有父进程修改数据时才复制该页给子进程
  · 异步执行：fork 瞬间阻塞（微秒级），后续写入不阻塞主进程
```

### 3.1.2 触发方式

```bash
# 1. 自动触发（通过 redis.conf 配置）
save 900 1        # 900 秒内至少 1 个 key 变化
save 300 10       # 300 秒内至少 10 个 key 变化
save 60 10000     # 60 秒内至少 10000 个 key 变化
# 满足任一条件即触发 RDB

# 2. 手动触发
SAVE              # 阻塞主进程，直到 RDB 完成（生产禁用！）
BGSAVE            # 后台异步执行（推荐）
# 返回 "Background saving started"
# 查看状态：
LASTSAVE          # 返回上次成功保存的 Unix 时间戳
```

### 3.1.3 RDB 配置

```conf
# redis.conf
save 900 1
save 300 10
save 60 10000

dbfilename dump.rdb        # RDB 文件名
dir /var/lib/redis         # RDB 文件存储目录

rdbcompression yes         # 是否压缩（LZF 算法，CPU 换空间）
rdbchecksum yes            # 是否校验和（防止文件损坏）

stop-writes-on-bgsave-error yes  # RDB 失败时是否停止写入（生产建议 yes）
```

### 3.1.4 RDB 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 文件紧凑，适合备份与灾难恢复 | ❌ **可能丢失最后一次快照后的数据** |
| ✅ 恢复速度快（直接加载到内存） | ❌ fork 大内存进程时可能卡顿（秒级） |
| ✅ 对性能影响小（子进程写入） | ❌ 频繁 fork 可能消耗 CPU |
| ✅ 适合冷备（按小时/天归档） | ❌ 数据量大时文件体积大 |

**适用场景**：
- 可以容忍分钟级数据丢失
- 需要快速恢复全量数据
- 定期备份归档

## 3.2 AOF 日志（Append Only File）

### 3.2.1 原理

AOF 记录**每个写命令**到日志文件（默认 `appendonly.aof`），重启时重放命令恢复数据。

```text
AOF 持久化流程：
  ① 客户端发送写命令（SET/DEL/INCR 等）
  ② Redis 将命令追加到 AOF 缓冲区
  ③ 根据策略将缓冲区刷盘
  ④ 重启时逐条重放 AOF 中的命令

AOF 文件示例：
  *2\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n
  *2\r\n$3\r\nSET\r\n$3\r\nbaz\r\n$3\r\nqux\r\n
  （RESP 协议格式，人类可读）
```

### 3.2.2 AOF 刷盘策略

```conf
appendonly yes              # 开启 AOF
appendfilename "appendonly.aof"

# 刷盘策略（三选一）
appendfsync always          # 每条命令都 fsync（最安全，最慢）
appendfsync everysec        # 每秒 fsync 一次（推荐，平衡性能与安全）
appendfsync no              # 由 OS 决定 fsync（最快，可能丢数据）
```

| 策略 | 性能 | 数据安全性 | 适用场景 |
|------|------|------------|----------|
| `always` | 最低（每条命令一次磁盘 IO） | 最高（不丢数据） | 金融、支付等关键业务 |
| `everysec` | 中等 | 最多丢 1 秒数据 | **大多数生产环境** |
| `no` | 最高 | 可能丢数秒数据 | 可容忍丢失的非关键数据 |

### 3.2.3 AOF 重写（Rewrite）

**问题**：AOF 文件会无限增长（即使同一个 key 被修改 100 次，也会记录 100 条命令）。

**解决**：AOF 重写机制——后台创建新 AOF 文件，只保留每个 key 的**最终状态**，替换旧文件。

```bash
# 手动触发重写
BGREWRITEAOF
# 返回 "Background append only file rewriting started"

# 自动重写配置
auto-aof-rewrite-percentage 100   # AOF 文件增长 100% 时触发重写
auto-aof-rewrite-min-size 64mb    # AOF 文件至少 64MB 才触发
```

```text
AOF 重写流程：
  ① fork 子进程
  ② 子进程根据当前内存数据生成新 AOF 文件
  ③ 主进程继续处理请求，新命令同时写入：
     · AOF 缓冲区（旧文件）
     · AOF 重写缓冲区（新文件）
  ④ 子进程完成后，主进程将重写缓冲区的内容追加到新 AOF
  ⑤ 原子替换旧文件

结果：新 AOF 文件只包含恢复数据所需的最小命令集
```

### 3.2.4 AOF 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 数据安全性高（最多丢 1 秒） | ❌ 文件体积大（比 RDB 大数倍） |
| ✅ 支持命令级恢复 | ❌ 恢复速度慢（需重放命令） |
| ✅ 可读性强（文本格式） | ❌ 写入性能略低（fsync 开销） |
| ✅ 适合增量备份 | ❌ 极端情况下可能因 bug 导致重放失败 |

**适用场景**：
- 不能容忍分钟级数据丢失
- 需要精确恢复到某个时间点
- 数据变更频率不高

## 3.3 RDB + AOF 混合持久化（推荐）

Redis 4.0+ 支持**同时开启 RDB 和 AOF**，结合两者优势：

```conf
# redis.conf
save 900 1
save 300 10
save 60 10000

appendonly yes
appendfsync everysec

# 混合持久化（4.0+）
aof-use-rdb-preamble yes   # AOF 重写时，前半段用 RDB 格式，后半段用 AOF 格式
```

```text
混合持久化的优势：
  · 恢复速度快（RDB 部分直接加载）
  · 数据安全性高（AOF 部分保证不丢）
  · 文件体积小（RDB 压缩 + AOF 增量）

重启时的加载顺序：
  ① 优先加载 AOF（如果存在）
  ② AOF 不存在时加载 RDB
```

## 3.4 持久化最佳实践

### 3.4.1 生产配置建议

```conf
# 必须开启 AOF
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
aof-use-rdb-preamble yes

# RDB 作为备份补充
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes

# 防止 fork 阻塞（Linux 内核优化）
# sysctl vm.overcommit_memory=1
```

### 3.4.2 备份策略

```bash
# 1. 定期备份 RDB 到远程存储（S3/OSS）
0 */6 * * * cp /var/lib/redis/dump.rdb /backup/redis-$(date +%Y%m%d%H).rdb
0 */6 * * * aws s3 cp /backup/redis-*.rdb s3://my-backup/redis/

# 2. AOF 文件也定期备份（可选）
0 2 * * * cp /var/lib/redis/appendonly.aof /backup/redis-aof-$(date +%Y%m%d).aof

# 3. 保留多个版本（防止误操作后覆盖）
find /backup -name "redis-*.rdb" -mtime +7 -delete
```

### 3.4.3 恢复数据

```bash
# 1. 停止 Redis
systemctl stop redis

# 2. 备份当前数据（可选）
mv /var/lib/redis/dump.rdb /var/lib/redis/dump.rdb.bak
mv /var/lib/redis/appendonly.aof /var/lib/redis/appendonly.aof.bak

# 3. 恢复 RDB
cp /backup/redis-20260906.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb

# 4. 恢复 AOF（如果开启了 AOF）
cp /backup/redis-aof-20260906.aof /var/lib/redis/appendonly.aof
chown redis:redis /var/lib/redis/appendonly.aof

# 5. 启动 Redis
systemctl start redis

# 6. 验证数据
redis-cli INFO keyspace
```

### 3.4.4 常见问题排查

**Q1：RDB 保存失败**

```bash
# 查看错误日志
tail -f /var/log/redis/redis.log
# 常见错误：
# - Can't save in background: fork: Cannot allocate memory
#   → 内存不足，调整 overcommit_memory 或增加内存
# - Background saving error
#   → 磁盘空间不足或权限问题
```

**Q2：AOF 文件损坏**

```bash
# Redis 启动时会检测 AOF 完整性
# 如果损坏，会报错并拒绝启动

# 修复 AOF 文件
redis-check-aof --fix /var/lib/redis/appendonly.aof
# 会截断损坏的部分，保留有效命令
```

**Q3：fork 时卡顿严重**

```bash
# 查看 fork 耗时
redis-cli INFO stats | grep latest_fork_usec
# latest_fork_usec:12345  （微秒）

# 优化方案：
# 1. 增加内存（减少写时复制开销）
# 2. 使用 THP（Transparent Huge Pages）
#    echo never > /sys/kernel/mm/transparent_hugepage/enabled
# 3. 调整 overcommit_memory
#    sysctl vm.overcommit_memory=1
```

## 3.5 持久化对比总结

| 维度 | RDB | AOF | 混合（推荐） |
|------|-----|-----|-------------|
| **数据安全性** | 可能丢分钟级数据 | 最多丢 1 秒 | 最多丢 1 秒 |
| **恢复速度** | 快（直接加载） | 慢（重放命令） | 快（RDB 部分） |
| **文件体积** | 小（压缩） | 大（文本） | 中等 |
| **性能影响** | 小（fork 瞬间） | 中（fsync 开销） | 中等 |
| **可读性** | 二进制不可读 | 文本可读 | 部分可读 |
| **适用场景** | 冷备、灾难恢复 | 热备、精确恢复 | **生产环境首选** |

**决策建议**：
- **开发/测试**：关闭持久化（`save ""` + `appendonly no`）
- **生产环境**：RDB + AOF 混合模式
- **关键业务**：`appendfsync always`（牺牲性能换安全）
- **大容量数据**：考虑 Redis Cluster + 分片持久化
