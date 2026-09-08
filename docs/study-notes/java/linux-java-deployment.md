---
title: "Linux与Java项目部署"
aliases:
  - "Linux 命令"
  - "jar 部署"
  - "systemd"
tags:
  - "后端"
  - "运维"
  - "linux"
  - "部署"
category: "后端"
folder: "Java工程化与部署"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]"
  - "[[后端/JVM/JVM调优与线上问题排查]]"
  - "[[后端/Java工程化与部署/Maven依赖管理与多模块]]"
  - "[[运维与部署/Linux]]"
created: 2026-09-07
updated: 2026-09-07
---

# Linux 与 Java 项目部署

> 本篇聚焦**部署 Java 应用所需的 Linux 知识和实操**：环境准备、jar 启动、systemd 服务化、日志管理、故障排查命令。更通用的 Linux 基础见 [[运维与部署/Linux]]，容器化部署见 [[后端/Java工程化与部署/Docker与Nginx部署Java应用]]。

## 1. 服务器环境准备

### 1.1 JDK 安装

```bash
# ─── 方式 1：包管理器（简单，但版本可能旧）───
# Ubuntu/Debian
sudo apt update && sudo apt install -y openjdk-17-jdk
# CentOS/RHEL 7
sudo yum install -y java-17-openjdk-devel
# CentOS/RHEL 8+ / Rocky / Alma
sudo dnf install -y java-17-openjdk-devel
# Amazon Linux 2
sudo amazon-linux-extras install java-openjdk17

# ─── 方式 2：手动安装（★ 推荐，可控版本）───
# 下载（Eclipse Temurin，免费且质量高）
cd /opt
sudo wget https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.9%2B9/OpenJDK17U-jdk_x64_linux_hotspot_17.0.9_9.tar.gz
sudo tar -zxvf OpenJDK17U-jdk_x64_linux_hotspot_17.0.9_9.tar.gz
sudo mv jdk-17.0.9+9 /usr/local/jdk-17

# 配置环境变量（★ 写入 /etc/profile.d/ 而非 /etc/profile，便于管理）
sudo tee /etc/profile.d/java.sh > /dev/null <<'EOF'
export JAVA_HOME=/usr/local/jdk-17
export PATH=$JAVA_HOME/bin:$PATH
# ★ 不要配置 CLASSPATH（JDK 5+ 不需要，反而容易出问题）
EOF
sudo chmod +x /etc/profile.d/java.sh
source /etc/profile.d/java.sh

# 验证
java -version
# openjdk version "17.0.9" 2023-10-17
javac -version
echo $JAVA_HOME

# ─── 多版本共存（alternatives）───
sudo update-alternatives --install /usr/bin/java java /usr/local/jdk-17/bin/java 100
sudo update-alternatives --install /usr/bin/java java /usr/local/jdk-8/bin/java 50
sudo update-alternatives --config java          # ★ 交互式切换默认版本
sudo update-alternatives --install /usr/bin/javac javac /usr/local/jdk-17/bin/javac 100
```

### 1.2 创建应用用户（★ 安全必做，不要用 root 跑应用）

```bash
# 创建无登录权限的专用用户
sudo useradd --system --home-dir /data/app --shell /sbin/nologin appuser
# 或允许登录（调试用）
sudo useradd -m -s /bin/bash appuser

# 创建目录结构（★ 标准化）
sudo mkdir -p /data/app/{mall,logs,backup,tmp}
sudo mkdir -p /data/app/mall/{bin,conf,lib}
sudo chown -R appuser:appuser /data/app
sudo chmod 750 /data/app

# 目录规划
/data/app/mall/
├── bin/                  # 启动脚本
│   ├── start.sh
│   ├── stop.sh
│   ├── restart.sh
│   └── status.sh
├── conf/                 # ★ 配置文件（外置，不打进 jar，改配置不用重新打包）
│   ├── application-prod.yml
│   └── logback-spring.xml
├── lib/                  # jar 包
│   ├── mall.jar
│   └── mall.jar.bak.20260907    # 保留上一个版本，便于回滚
└── logs/                 # 日志（或软链到 /data/app/logs）
```

### 1.3 系统参数调优（★ 高并发必做）

```bash
# ─── /etc/security/limits.conf（文件句柄数和进程数）───
sudo tee -a /etc/security/limits.conf > /dev/null <<'EOF'
# ★ 文件句柄数（默认 1024，高并发下会报 Too many open files）
appuser soft nofile 655350
appuser hard nofile 655350
# ★ 进程/线程数（默认可能只有几千，线程池大时会报 unable to create native thread）
appuser soft nproc 65535
appuser hard nproc 65535
# 内存锁定
appuser soft memlock unlimited
appuser hard memlock unlimited
EOF

# systemd 服务需要在 unit 文件中单独配（limits.conf 对 systemd 服务无效！★ 大坑）
# 见下文 systemd 配置

# 验证
ulimit -n            # 当前 shell 的文件句柄数
ulimit -u            # 进程数
cat /proc/<pid>/limits    # ★ 查看具体进程的生效限制（最准确）

# ─── /etc/sysctl.conf（内核网络参数）───
sudo tee -a /etc/sysctl.conf > /dev/null <<'EOF'
# ★ TCP 连接队列（配合 Tomcat 的 acceptCount）
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# ★ TIME_WAIT 优化（大量短连接场景）
net.ipv4.tcp_tw_reuse = 1                    # 允许复用 TIME_WAIT 连接（客户端侧）
net.ipv4.tcp_fin_timeout = 15                # FIN_WAIT_2 超时
net.ipv4.tcp_max_tw_buckets = 5000           # TIME_WAIT 最大数量，超过直接销毁
# ⚠️ 不要开 tcp_tw_recycle（NAT 环境会丢包，Linux 4.12 已移除）

# ★ 端口范围（客户端发起连接时用的临时端口）
net.ipv4.ip_local_port_range = 1024 65535

# ★ Keep-Alive
net.ipv4.tcp_keepalive_time = 600            # 600 秒无数据开始探测
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 3

# ★ 缓冲区
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216

# ★ 文件句柄（系统级）
fs.file-max = 2097152
fs.nr_open = 2097152

# ★ 内存与交换
vm.swappiness = 10                           # ★ 尽量少用 swap（默认 60 太激进）
vm.max_map_count = 262144                    # Elasticsearch 需要
vm.overcommit_memory = 1                     # Redis 建议

# 网络其他
net.ipv4.tcp_syncookies = 1                  # ★ 防 SYN Flood 攻击
net.ipv4.tcp_max_orphans = 3276800
net.core.netdev_max_backlog = 32768
EOF

sudo sysctl -p                               # ★ 立即生效
sysctl net.core.somaxconn                     # 验证

# ─── 关闭 swap（K8s 必须，普通服务器建议）───
sudo swapoff -a                              # 临时关闭
sudo sed -i '/swap/s/^/#/' /etc/fstab        # ★ 永久关闭（注释 fstab 中的 swap 行）
free -h                                       # 验证 Swap 为 0

# ─── 时区与时间同步（★ 分布式系统必须）───
timedatectl                                   # 查看当前时区
sudo timedatectl set-timezone Asia/Shanghai   # ★ 设为东八区
sudo systemctl enable --now chronyd           # 时间同步（CentOS）
# 或 systemd-timesyncd（Ubuntu）
sudo systemctl enable --now systemd-timesyncd
timedatectl set-ntp true
# 验证时间同步状态
chronyc sources -v
```

> 【坑】**服务器时间与 JVM 时区不一致**导致的时间错乱：
> ```bash
> # 系统时区（/etc/localtime）与 JVM 的 user.timezone 是两个东西
> # 排查
> date                                    # 系统时间
> java -XshowSettings:properties -version 2>&1 | grep -E 'user.timezone|user.country'
> # 统一方案：
> # ① 系统时区设对：timedatectl set-timezone Asia/Shanghai
> # ② JVM 显式指定：-Duser.timezone=Asia/Shanghai（★ 推荐，不依赖系统）
> # ③ 数据库时区：MySQL 连接串加 serverTimezone=Asia/Shanghai
> # ④ 存储用 UTC 或时间戳，展示时转本地时区
> ```

## 2. jar 包部署 ★★★★★

### 2.1 手动启动与停止

```bash
# ─── 前台启动（调试用，Ctrl+C 停止）───
java -jar mall.jar

# ─── 后台启动（nohup + &）───
nohup java -jar mall.jar > /data/app/logs/stdout.log 2>&1 &
#  nohup：忽略挂断信号（SIGHUP），终端关闭后进程继续运行
#  > file：重定向标准输出
#  2>&1：★ 标准错误也重定向到同一文件（2=stderr, 1=stdout）
#  &：后台运行
echo $!                          # ★ 上条后台命令的 PID

# ─── 带完整参数的启动 ───
nohup java \
  -server \
  -Xms4g -Xmx4g \
  -XX:+UseG1GC -XX:MaxGCPauseMillis=200 \
  -XX:MetaspaceSize=256m -XX:MaxMetaspaceSize=256m \
  -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/data/app/logs/ \
  -XX:+ExitOnOutOfMemoryError \
  -Xlog:gc*:file=/data/app/logs/gc.log:time,uptime:filecount=5,filesize=20m \
  -Duser.timezone=Asia/Shanghai -Dfile.encoding=UTF-8 \
  -Dspring.profiles.active=prod \
  -Dspring.config.additional-location=file:/data/app/mall/conf/ \
  -jar /data/app/mall/lib/mall.jar \
  --server.port=8080 \
  > /data/app/logs/stdout.log 2>&1 &

# ─── 查找进程 ───
jps -lvm                                   # ★ Java 进程专用（最方便）
ps -ef | grep mall.jar | grep -v grep      # 通用方式
pgrep -f mall.jar                           # 只输出 PID
lsof -i :8080                              # ★ 按端口找进程
ss -tlnp | grep 8080                       # 同上（ss 比 netstat 快）

# ─── 停止进程 ───
kill <pid>                                 # ★ SIGTERM(15)：优雅关闭（触发 shutdown hook）
kill -15 <pid>                             # 同上（显式）
kill -9 <pid>                              # ★★ SIGKILL(9)：强制杀死（不执行任何清理！）
pkill -f mall.jar                          # 按命令行匹配杀
kill $(jps | grep mall | awk '{print $1}') # 组合

# ─── 信号的含义（★ 面试）───
# SIGTERM (15)：请求终止，JVM 会执行 shutdown hook（@PreDestroy、Spring 优雅停机）★ 首选
# SIGINT  (2)：中断（Ctrl+C），同 SIGTERM 会触发 hook
# SIGHUP  (1)：挂断（终端关闭），nohup 就是忽略它
# SIGKILL (9)：★ 强制终止，JVM 无法捕获，shutdown hook 不执行，可能数据损坏
# SIGQUIT (3)：★ 输出线程 dump 到 stdout（kill -3 <pid>，进程不退出！排查神器）
```

> 【重要】**优雅停机的正确姿势**：
> ```bash
> # ① 先发 SIGTERM，让应用自己关闭（Spring Boot 会等待请求处理完）
> kill <pid>
> # ② 等待最多 N 秒
> for i in $(seq 1 30); do
>     if ! kill -0 <pid> 2>/dev/null; then echo "已停止"; break; fi
>     echo "等待停止... ${i}s"
>     sleep 1
> done
> # ③ 还没停则强杀
> kill -0 <pid> 2>/dev/null && { echo "强制杀死"; kill -9 <pid>; }
> ```
> **`kill -9` 的危害**：不执行 shutdown hook → 线程池不关闭、缓冲区不刷盘、数据库连接不归还、注册中心不注销（导致流量继续打到已死的实例）→ **数据丢失、请求 502**。

### 2.2 启动脚本（★ 生产标准做法）

```bash
#!/bin/bash
# ══════════ /data/app/mall/bin/start.sh ══════════
set -euo pipefail                                    # ★ 严格模式：出错即停、未定义变量报错、管道错误传播

# ─── 基本配置 ───
APP_NAME="mall"
APP_HOME="/data/app/mall"
JAR_FILE="${APP_HOME}/lib/${APP_NAME}.jar"
CONF_DIR="${APP_HOME}/conf"
LOG_DIR="/data/app/logs/${APP_NAME}"
PID_FILE="${APP_HOME}/${APP_NAME}.pid"
PROFILE="${SPRING_PROFILE:-prod}"

# ─── JVM 参数（★ 容器环境用百分比，物理机用绝对值）───
if [ -f /proc/1/cgroup ] && grep -qE 'docker|kubepods' /proc/1/cgroup 2>/dev/null; then
    MEM_OPTS="-XX:+UseContainerSupport -XX:InitialRAMPercentage=70.0 -XX:MaxRAMPercentage=70.0"
else
    MEM_OPTS="-Xms4g -Xmx4g"
fi

JAVA_OPTS="${MEM_OPTS} \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:InitiatingHeapOccupancyPercent=45 \
  -XX:MetaspaceSize=256m -XX:MaxMetaspaceSize=256m \
  -XX:MaxDirectMemorySize=512m \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=${LOG_DIR}/heapdump.hprof \
  -XX:+ExitOnOutOfMemoryError \
  -XX:ErrorFile=${LOG_DIR}/hs_err_%p.log \
  -Xlog:gc*,safepoint:file=${LOG_DIR}/gc.log:time,uptime,level,tags:filecount=5,filesize=20m"

APP_OPTS="--spring.profiles.active=${PROFILE} \
  --spring.config.additional-location=file:${CONF_DIR}/ \
  --logging.file.path=${LOG_DIR}"

# ─── 前置检查 ───
mkdir -p "${LOG_DIR}"
if [ ! -f "${JAR_FILE}" ]; then
    echo "❌ jar 不存在：${JAR_FILE}" >&2
    exit 1
fi

# ─── 检查是否已在运行 ───
if [ -f "${PID_FILE}" ]; then
    OLD_PID=$(cat "${PID_FILE}")
    if kill -0 "${OLD_PID}" 2>/dev/null; then
        echo "⚠️  ${APP_NAME} 已在运行 (PID: ${OLD_PID})，请先执行 stop.sh"
        exit 1
    else
        echo "清理过期的 PID 文件"
        rm -f "${PID_FILE}"
    fi
fi

# ─── 启动 ───
echo "启动 ${APP_NAME}..."
echo "  JAR:     ${JAR_FILE}"
echo "  PROFILE: ${PROFILE}"
echo "  JAVA_OPTS: ${JAVA_OPTS}"

# ★ 用 exec 让 java 进程替换脚本进程（PID 更干净，信号能直接传到 JVM）
# ★ 用 setsid 脱离终端会话（比 nohup 更彻底）
nohup java ${JAVA_OPTS} -jar "${JAR_FILE}" ${APP_OPTS} \
    >> "${LOG_DIR}/stdout.log" 2>&1 &

PID=$!
echo "${PID}" > "${PID_FILE}"
echo "PID: ${PID}"

# ─── 等待启动并健康检查 ───
HEALTH_URL="http://127.0.0.1:8080/actuator/health"
MAX_WAIT=120
echo -n "等待启动"
for i in $(seq 1 ${MAX_WAIT}); do
    # 进程还在吗？
    if ! kill -0 "${PID}" 2>/dev/null; then
        echo ""
        echo "❌ 进程已退出，启动失败！最后 50 行日志："
        tail -50 "${LOG_DIR}/stdout.log"
        rm -f "${PID_FILE}"
        exit 1
    fi
    # 健康检查通过？
    if curl -sf "${HEALTH_URL}" > /dev/null 2>&1; then
        echo ""
        echo "✅ ${APP_NAME} 启动成功！耗时 ${i} 秒，PID=${PID}"
        echo "   健康检查：${HEALTH_URL}"
        exit 0
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "⚠️  启动超时（${MAX_WAIT}s），请检查日志：tail -f ${LOG_DIR}/stdout.log"
tail -30 "${LOG_DIR}/stdout.log"
exit 1
```

```bash
#!/bin/bash
# ══════════ /data/app/mall/bin/stop.sh ══════════
set -uo pipefail

APP_NAME="mall"
APP_HOME="/data/app/mall"
PID_FILE="${APP_HOME}/${APP_NAME}.pid"
GRACEFUL_TIMEOUT=60                                  # ★ 优雅停机等待时间

if [ ! -f "${PID_FILE}" ]; then
    echo "PID 文件不存在，尝试按进程名查找..."
    PID=$(pgrep -f "${APP_NAME}.jar" | head -1 || true)
    if [ -z "${PID}" ]; then
        echo "${APP_NAME} 未在运行"
        exit 0
    fi
else
    PID=$(cat "${PID_FILE}")
fi

if ! kill -0 "${PID}" 2>/dev/null; then
    echo "进程 ${PID} 不存在，清理 PID 文件"
    rm -f "${PID_FILE}"
    exit 0
fi

echo "停止 ${APP_NAME} (PID: ${PID})..."
kill "${PID}"                                        # ★ SIGTERM，触发优雅停机

# 等待进程退出
for i in $(seq 1 ${GRACEFUL_TIMEOUT}); do
    if ! kill -0 "${PID}" 2>/dev/null; then
        echo "✅ 已停止（耗时 ${i} 秒）"
        rm -f "${PID_FILE}"
        exit 0
    fi
    echo -n "."
    sleep 1
done

# 超时强杀
echo ""
echo "⚠️  优雅停机超时（${GRACEFUL_TIMEOUT}s），执行强制终止"
jstack "${PID}" > "/tmp/${APP_NAME}-jstack-$(date +%s).txt" 2>&1 || true   # ★ 强杀前留现场！
kill -9 "${PID}"
sleep 2
rm -f "${PID_FILE}"
echo "已强制停止"
```

```bash
#!/bin/bash
# ══════════ restart.sh / status.sh ══════════
# restart.sh
APP_HOME="/data/app/mall"
"${APP_HOME}/bin/stop.sh"
sleep 3
"${APP_HOME}/bin/start.sh"

# status.sh
APP_NAME="mall"; PID_FILE="/data/app/mall/${APP_NAME}.pid"
if [ -f "${PID_FILE}" ] && kill -0 "$(cat ${PID_FILE})" 2>/dev/null; then
    PID=$(cat "${PID_FILE}")
    echo "✅ ${APP_NAME} 运行中 (PID: ${PID})"
    echo "── 进程信息 ──"
    ps -o pid,ppid,user,%cpu,%mem,etime,cmd -p "${PID}"
    echo "── 资源占用 ──"
    top -b -n 1 -p "${PID}" | tail -2
    echo "── 端口监听 ──"
    ss -tlnp 2>/dev/null | grep "${PID}" || echo "（无监听端口）"
    echo "── JVM 内存 ──"
    jstat -gcutil "${PID}" 2>/dev/null || echo "（jstat 不可用）"
else
    echo "❌ ${APP_NAME} 未运行"
    exit 1
fi

# 赋予执行权限
chmod +x /data/app/mall/bin/*.sh
```

### 2.3 配置文件外置（★ 重要实践）

```bash
# Spring Boot 的配置加载优先级（从高到低）：
# ① 命令行参数            --server.port=9090
# ② JAVA_OPTS 的 -D 参数   -Dserver.port=9090
# ③ jar 外部的配置文件     file:./config/application.yml
# ④ jar 外部的配置文件     file:./application.yml
# ⑤ jar 内部的配置文件     classpath:/config/application.yml
# ⑥ jar 内部的配置文件     classpath:/application.yml

# ★ 方式 1：additional-location（追加外部配置目录）
java -jar mall.jar --spring.config.additional-location=file:/data/app/mall/conf/
# 该目录下的 application-prod.yml 会【覆盖】jar 内的同名配置

# ★ 方式 2：完全指定配置文件位置
java -jar mall.jar --spring.config.location=file:/data/app/mall/conf/application.yml

# ★ 方式 3：环境变量（★ 容器化首选，12-Factor App 原则）
export SPRING_PROFILES_ACTIVE=prod
export SPRING_DATASOURCE_URL=jdbc:mysql://db:3306/mall
export SPRING_DATASOURCE_PASSWORD=xxx
export SERVER_PORT=8080
# Spring Boot 的「松散绑定」：SPRING_DATASOURCE_URL → spring.datasource.url
java -jar mall.jar

# 好处：改配置不用重新打包，不同环境用同一份 jar
```

```yaml
# /data/app/mall/conf/application-prod.yml（外置配置，只放环境相关的）
server:
  port: 8080
  tomcat:
    threads:
      max: 500
    accept-count: 1000
    max-connections: 20000

spring:
  datasource:
    url: jdbc:mysql://${DB_HOST:mysql.internal}:${DB_PORT:3306}/mall?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=true
    username: ${DB_USER:mall}
    password: ${DB_PASSWORD}                # ★ 从环境变量读，不写死在配置文件
    hikari:
      maximum-pool-size: 50
      minimum-idle: 10
      connection-timeout: 3000
  data:
    redis:
      host: ${REDIS_HOST:redis.internal}
      port: 6379
      password: ${REDIS_PASSWORD}
      lettuce:
        pool:
          max-active: 50

management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus,metrics
  endpoint:
    health:
      show-details: when_authorized
      probes:
        enabled: true                       # ★ 开启 K8s 探针端点

logging:
  level:
    root: INFO
    com.example: INFO
  file:
    path: /data/app/logs/mall
```

> 【安全】**配置文件的权限管理**：
> ```bash
> chmod 600 /data/app/mall/conf/application-prod.yml    # ★ 只有 owner 可读（含密码）
> chown appuser:appuser /data/app/mall/conf/application-prod.yml
> # 更好的方案：密码用 Vault / KMS / K8s Secret 管理，配置文件中只放引用
> ```

## 3. systemd 服务化（★ 生产标准）★★★★★

**systemd 是 Linux 的服务管理器，提供：开机自启、崩溃自动重启、日志集中管理、依赖管理、资源限制。**

```ini
# ══════════ /etc/systemd/system/mall.service ══════════
[Unit]
Description=Mall Application (Spring Boot)
Documentation=https://wiki.example.com/mall
# ★ 依赖关系：网络就绪后再启动
After=network-online.target syslog.target
Wants=network-online.target
# 如果依赖本地的 MySQL/Redis，可以加：
# After=mysqld.service redis.service
# Requires=mysqld.service

[Service]
# ─── 类型 ───
Type=simple                    # ★ 主进程就是启动的进程（Java 应用用 simple）
# Type=forking                 # 进程会 fork 后父进程退出（传统 daemon）
# Type=notify                  # 应用主动通知 systemd 就绪（需要 sd_notify）
# Type=oneshot                 # 一次性任务

# ─── 用户与权限（★ 安全）───
User=appuser
Group=appuser
# 权限最小化（★ 强烈推荐，能大幅降低被攻破后的危害）
NoNewPrivileges=true           # 禁止提权
PrivateTmp=true                # 独立的 /tmp（隔离）
ProtectSystem=full             # /usr /boot /etc 只读
ProtectHome=true               # /home 不可访问
# ProtectKernelTunables=true   # 禁止修改内核参数
# ProtectControlGroups=true

# ─── 工作目录与启动命令 ───
WorkingDirectory=/data/app/mall
# ★ exec 形式（推荐）：变量替换由 systemd 完成，信号能正确传递
ExecStart=/usr/local/jdk-17/bin/java \
    -server \
    -Xms4g -Xmx4g \
    -XX:+UseG1GC -XX:MaxGCPauseMillis=200 \
    -XX:MetaspaceSize=256m -XX:MaxMetaspaceSize=256m \
    -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/data/app/logs/mall/ \
    -XX:+ExitOnOutOfMemoryError \
    -Xlog:gc*,safepoint:file=/data/app/logs/mall/gc.log:time,uptime:filecount=5,filesize=20m \
    -Duser.timezone=Asia/Shanghai -Dfile.encoding=UTF-8 \
    -Dspring.profiles.active=prod \
    -Dspring.config.additional-location=file:/data/app/mall/conf/ \
    -jar /data/app/mall/lib/mall.jar

# 环境变量（★ 敏感信息用 EnvironmentFile 从受限文件读取）
Environment="JAVA_HOME=/usr/local/jdk-17"
Environment="SPRING_PROFILES_ACTIVE=prod"
EnvironmentFile=-/data/app/mall/conf/mall.env      # ★ 前缀 - 表示文件不存在也不报错

# ─── 停止 ───
ExecStop=/bin/kill -TERM $MAINPID              # 发 SIGTERM（默认就是这个，可省略）
KillMode=mixed                                 # ★ 主进程收 SIGTERM，子进程收 SIGKILL
KillSignal=SIGTERM
TimeoutStopSec=90                              # ★ 优雅停机超时（要大于应用的 shutdown 超时）

# ─── ★ 自动重启（可用性关键）───
Restart=always                                 # 总是重启（on-failure 只在异常退出时重启）
RestartSec=10                                  # 重启间隔 10 秒（避免疯狂重启）
StartLimitIntervalSec=300                      # 5 分钟内
StartLimitBurst=5                              # ★ 最多重启 5 次，超过则不再重启（进入 failed 状态）

# ─── ★ 资源限制（limits.conf 对 systemd 服务无效，必须在这里配！）───
LimitNOFILE=655350                             # ★ 文件句柄数
LimitNPROC=65535                               # ★ 进程/线程数
LimitCORE=infinity                             # core dump 大小
LimitMEMLOCK=infinity

# ─── CPU / 内存限制（cgroup）───
# CPUQuota=200%                                # 限制 2 个 CPU 核心
# MemoryMax=6G                                 # 内存上限（超过会被 OOMKill）
# MemoryHigh=5G                                  # 软上限（超过会被节流）
# TasksMax=4096                                # 最大任务数

# ─── 日志（交给 journald）───
StandardOutput=journal                         # 或 append:/data/app/logs/mall/stdout.log
StandardError=journal
SyslogIdentifier=mall

# ─── 其他 ───
Nice=0                                         # 进程优先级（-20 最高，19 最低）
IOSchedulingClass=best-effort
UMask=0027                                     # ★ 新建文件的默认权限（比 0022 更安全）

[Install]
WantedBy=multi-user.target                     # ★ 开机自启的目标（runlevel 3/5）
```

```bash
# ══════════ 使用 systemd 管理 ══════════
sudo systemctl daemon-reload                    # ★ 修改 service 文件后必须执行
sudo systemctl start mall                       # 启动
sudo systemctl stop mall                        # 停止（会走优雅停机）
sudo systemctl restart mall                     # 重启
sudo systemctl reload mall                      # 重载（需要 ExecReload 定义）
sudo systemctl status mall                      # ★ 状态（含最近日志）
sudo systemctl enable mall                      # ★ 开机自启
sudo systemctl disable mall                     # 取消自启
sudo systemctl enable --now mall                # ★ 自启 + 立即启动
sudo systemctl is-active mall                   # 是否运行中
sudo systemctl is-enabled mall                  # 是否开机自启
sudo systemctl list-units --type=service        # 所有服务
sudo systemctl list-units --type=service --state=failed   # ★ 失败的服务
sudo systemctl cat mall                         # 查看完整的 unit 配置
sudo systemctl show mall                        # 查看所有属性
sudo systemctl edit mall                        # ★ 覆盖配置（生成 override.conf，不改原文件）
sudo systemctl daemon-reexec                     # 重载 systemd 自身

# ─── 日志（journald）───
sudo journalctl -u mall                          # 该服务的所有日志
sudo journalctl -u mall -f                       # ★ 实时跟踪（同 tail -f）
sudo journalctl -u mall -n 200                   # 最近 200 行
sudo journalctl -u mall --since "10 min ago"     # 最近 10 分钟
sudo journalctl -u mall --since "2026-09-07 10:00" --until "2026-09-07 11:00"
sudo journalctl -u mall -p err                   # ★ 只看错误级别
sudo journalctl -u mall --no-pager               # 不分页（便于 grep）
sudo journalctl -u mall -o json-pretty           # JSON 格式（便于程序处理）
sudo journalctl --disk-usage                     # 日志占用空间
sudo journalctl --vacuum-time=7d                 # ★ 清理 7 天前的日志
sudo journalctl --vacuum-size=1G                 # 清理到 1G 以内

# journald 配置（/etc/systemd/journald.conf）
# [Journal]
# Storage=persistent            # ★ 持久化到磁盘（默认 auto，可能只存内存）
# SystemMaxUse=2G               # 日志总大小上限
# SystemMaxFileSize=100M        # 单文件上限
# MaxRetentionSec=1month        # 保留时长
# ForwardToSyslog=no            # 不转发到 rsyslog（避免重复）
sudo systemctl restart systemd-journald

# ─── 环境变量文件（敏感信息）───
sudo tee /data/app/mall/conf/mall.env > /dev/null <<'EOF'
DB_HOST=mysql.internal
DB_USER=mall
DB_PASSWORD=strong-password-here
REDIS_PASSWORD=xxx
JWT_SECRET=base64:xxxxxxxxxxxx
EOF
sudo chown root:appuser /data/app/mall/conf/mall.env
sudo chmod 640 /data/app/mall/conf/mall.env      # ★ 只有 owner 可写，组可读
```

**systemd vs 脚本的对比：**

| 能力 | Shell 脚本 | **systemd** |
| --- | --- | --- |
| 开机自启 | 需配 rc.local / crontab @reboot | ★ `systemctl enable` |
| 崩溃自动重启 | ❌ 需自己写监控 | ★ `Restart=always` |
| 日志集中管理 | ❌ 自己切日志 | ★ `journalctl` |
| 资源限制 | ❌ | ★ `LimitNOFILE`、`CPUQuota`、`MemoryMax` |
| 依赖管理 | ❌ | ★ `After=`、`Requires=` |
| 权限最小化 | ❌ | ★ `PrivateTmp`、`ProtectSystem` |
| 状态查询 | 自己写 | ★ `systemctl status` |
| 优雅停机 | 自己写循环 | ★ `TimeoutStopSec` |
| 多实例 | 复制脚本 | ★ 模板 unit（`mall@1.service`） |

```ini
# ★ 模板 unit：一个配置跑多个实例（mall@8081.service, mall@8082.service）
# /etc/systemd/system/mall@.service
[Service]
ExecStart=/usr/local/jdk-17/bin/java -jar /data/app/mall/lib/mall.jar --server.port=%i
# ★ %i = 实例名（@ 后面的部分）
Environment="SPRING_PROFILES_ACTIVE=prod"
[Install]
WantedBy=multi-user.target

# 使用
sudo systemctl start mall@8081
sudo systemctl start mall@8082
```

## 4. 日志管理 ★★★★★

### 4.1 Logback 配置（Spring Boot 默认）

```xml
<!-- src/main/resources/logback-spring.xml（★ 用 -spring 后缀才能用 Spring 的 profile 和属性） -->
<?xml version="1.0" encoding="UTF-8"?>
<configuration scan="true" scanPeriod="60 seconds">        <!-- ★ 支持热更新 -->

    <!-- 从 Spring 环境读取属性 -->
    <springProperty scope="context" name="APP_NAME" source="spring.application.name" defaultValue="app"/>
    <springProperty scope="context" name="LOG_PATH" source="logging.file.path" defaultValue="./logs"/>

    <property name="LOG_PATTERN"
              value="%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] [%X{traceId:-}] %-5level %logger{36} - %msg%n"/>
    <!--                                        ↑ ★ MDC 中的 traceId（链路追踪） -->

    <!-- ─── 控制台输出（开发环境 / 容器环境）─── -->
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
            <charset>UTF-8</charset>
        </encoder>
    </appender>

    <!-- ─── 全量日志文件（★ 按天 + 按大小滚动）─── -->
    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/${APP_NAME}.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/${APP_NAME}.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>  <!-- ★ .gz 自动压缩 -->
            <maxFileSize>200MB</maxFileSize>              <!-- 单文件最大 200MB -->
            <maxHistory>30</maxHistory>                   <!-- ★ 保留 30 天 -->
            <totalSizeCap>20GB</totalSizeCap>              <!-- ★ 总大小上限（超过删最老的） -->
            <cleanHistoryOnStart>true</cleanHistoryOnStart> <!-- 启动时清理过期日志 -->
        </rollingPolicy>
        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
            <charset>UTF-8</charset>
        </encoder>
    </appender>

    <!-- ─── ★ 错误日志单独存放（便于告警和排查）─── -->
    <appender name="ERROR_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/${APP_NAME}-error.log</file>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>ERROR</level>                           <!-- ★ 只记录 ERROR 及以上 -->
        </filter>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/${APP_NAME}-error.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>90</maxHistory>                     <!-- 错误日志保留更久 -->
            <totalSizeCap>10GB</totalSizeCap>
        </rollingPolicy>
        <encoder><pattern>${LOG_PATTERN}</pattern><charset>UTF-8</charset></encoder>
    </appender>

    <!-- ─── ★ 慢 SQL / 业务审计日志（独立文件）─── -->
    <appender name="BIZ_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/${APP_NAME}-biz.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/${APP_NAME}-biz.%d{yyyy-MM-dd}.log.gz</fileNamePattern>
            <maxHistory>180</maxHistory>                    <!-- 审计日志保留半年 -->
        </rollingPolicy>
        <encoder><pattern>${LOG_PATTERN}</pattern><charset>UTF-8</charset></encoder>
    </appender>

    <!-- ─── ★★ 异步 Appender（★ 生产必用，日志写入不阻塞业务线程）─── -->
    <appender name="ASYNC_FILE" class="ch.qos.logback.classic.AsyncAppender">
        <appender-ref ref="FILE"/>
        <queueSize>8192</queueSize>                          <!-- ★ 队列大小 -->
        <discardingThreshold>0</discardingThreshold>          <!-- ★ 0 = 不丢弃任何级别的日志 -->
                                                            <!-- 默认 20% 队列满时丢弃 TRACE/DEBUG/INFO -->
        <neverBlock>true</neverBlock>                         <!-- ★ 队列满时不阻塞（丢弃而非卡业务） -->
        <includeCallerData>false</includeCallerData>           <!-- ★ false = 不获取调用者信息（性能关键！） -->
                                                            <!--   true 会导致 %class %method %line 可用但性能骤降 -->
    </appender>

    <appender name="ASYNC_ERROR" class="ch.qos.logback.classic.AsyncAppender">
        <appender-ref ref="ERROR_FILE"/>
        <queueSize>2048</queueSize>
        <neverBlock>false</neverBlock>                        <!-- 错误日志不丢 -->
        <discardingThreshold>0</discardingThreshold>
    </appender>

    <!-- ─── 按包设置级别 ─── -->
    <logger name="com.example" level="INFO"/>
    <logger name="com.example.mapper" level="DEBUG" additivity="false">   <!-- ★ SQL 日志 -->
        <appender-ref ref="BIZ_FILE"/>
    </logger>
    <!-- 降噪：框架的冗余日志 -->
    <logger name="org.apache.ibatis" level="WARN"/>
    <logger name="org.mybatis.spring" level="WARN"/>
    <logger name="org.springframework" level="WARN"/>
    <logger name="org.springframework.web" level="INFO"/>
    <logger name="com.zaxxer.hikari" level="INFO"/>
    <logger name="io.lettuce" level="WARN"/>
    <logger name="org.apache.kafka" level="WARN"/>
    <logger name="com.alibaba.druid" level="WARN"/>

    <!-- ★ additivity：是否传递给父 logger（false = 只用自己的 appender，避免重复打印） -->

    <!-- ─── 按 Profile 区分环境 ─── -->
    <springProfile name="dev,local">
        <root level="INFO">
            <appender-ref ref="CONSOLE"/>                    <!-- 开发只输出到控制台 -->
        </root>
        <logger name="com.example" level="DEBUG"/>
    </springProfile>

    <springProfile name="test">
        <root level="INFO">
            <appender-ref ref="CONSOLE"/>
            <appender-ref ref="ASYNC_FILE"/>
        </root>
    </springProfile>

    <springProfile name="prod">
        <root level="INFO">
            <!-- ★ 生产不输出到控制台（避免 stdout.log 无限增长），或输出给容器日志采集 -->
            <appender-ref ref="ASYNC_FILE"/>
            <appender-ref ref="ASYNC_ERROR"/>
        </root>
        <logger name="com.example" level="INFO"/>
        <!-- 关闭 SQL 日志（生产环境 DEBUG 级别的 SQL 会拖垮性能） -->
        <logger name="com.example.mapper" level="INFO"/>
    </springProfile>
</configuration>
```

```yaml
# application.yml 中的简化配置（不用 logback-spring.xml 时）
logging:
  level:
    root: INFO
    com.example: INFO
    com.example.mapper: DEBUG          # SQL 日志
    org.springframework.web: INFO
  file:
    path: /data/app/logs/mall
    name: /data/app/logs/mall/app.log
  logback:
    rollingpolicy:
      file-name-pattern: "${LOG_FILE}.%d{yyyy-MM-dd}.%i.gz"
      max-file-size: 200MB
      max-history: 30
      total-size-cap: 20GB
      clean-history-on-start: true
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] [%X{traceId}] %-5level %logger{36} - %msg%n"
    file: "%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] [%X{traceId}] %-5level %logger{36} - %msg%n"
  charset:
    console: UTF-8
    file: UTF-8
```

### 4.2 日志排查实战命令

```bash
# ─── 实时查看 ───
tail -f app.log                            # 实时跟踪
tail -f app.log | grep --line-buffered ERROR   # ★ 只看错误（--line-buffered 必须，否则不实时）
tail -n 500 app.log                        # 最后 500 行
tail -f app.log app-error.log              # 同时跟踪多个文件
less +F app.log                            # ★ less 的跟踪模式（Ctrl+C 退出跟踪，可上下翻页，比 tail 好用）
less app.log                               # 翻页查看（/搜索，?反向搜索，G到末尾，g到开头，n下一个）

# ─── 搜索 ───
grep "ERROR" app.log                       # 基本搜索
grep -i "error" app.log                    # 忽略大小写
grep -n "NullPointerException" app.log     # ★ 显示行号
grep -c "ERROR" app.log                    # 统计出现次数
grep -v "DEBUG" app.log                    # ★ 反向（排除）
grep -A 20 "Exception" app.log             # ★ 匹配行 + 后 20 行（看异常栈！）
grep -B 5 -A 30 "订单创建失败" app.log        # 前 5 行 + 后 30 行（看上下文）
grep -E "ERROR|WARN" app.log               # 扩展正则（或）
grep -r "traceId=abc123" /data/app/logs/    # ★ 递归搜索目录
grep -rl "OutOfMemoryError" /data/app/logs/ # 只列出包含的文件名
zgrep "ERROR" app.log.2026-09-06.0.gz       # ★ 直接搜压缩日志（zcat/zless 同理）
grep --color=auto "ERROR" app.log           # 高亮

# ─── 按 traceId 追踪一次请求（★ 链路追踪的核心价值）───
grep "550e8400e29b41d4" app.log            # 找到该请求的所有日志
grep "550e8400e29b41d4" app.log | less

# ─── 时间范围过滤 ───
sed -n '/2026-09-07 10:30/,/2026-09-07 10:35/p' app.log      # ★ 提取时间段
awk '/2026-09-07 10:30/,/2026-09-07 10:35/' app.log
grep "2026-09-07 10:3[0-5]" app.log                            # 正则匹配时间

# ─── 统计分析 ───
# 统计各级别日志数量
grep -oE '\b(ERROR|WARN|INFO|DEBUG)\b' app.log | sort | uniq -c | sort -rn

# 统计出现最多的异常类型
grep -oE '[a-zA-Z.]+Exception' app.log | sort | uniq -c | sort -rn | head -20

# 统计错误最多的类
grep "ERROR" app.log | grep -oE '[a-zA-Z.]+:[0-9]+' | sort | uniq -c | sort -rn | head -20

# 按小时统计错误数（看错误的时间分布）
grep "ERROR" app.log | awk '{print substr($2,1,2)}' | sort | uniq -c

# 按天统计（从多个日志文件）
for f in app.log.2026-09-*.log; do
    echo "$f: $(grep -c ERROR $f) errors"
done

# ─── awk 进阶 ───
awk -F' ' '{print $1, $2, $4}' app.log | head            # 按空格分割取字段
awk '/ERROR/ {print $0}' app.log                          # 等价 grep
awk '$5 == "ERROR"' app.log                               # 第 5 个字段是 ERROR
awk -F'|' '{sum+=$3} END {print "总耗时:", sum}' access.log  # 求和
awk '{if ($NF > 1000) print $0}' access.log               # 最后一个字段 > 1000（慢请求）
awk 'NR>=100 && NR<=200' app.log                          # 第 100~200 行
awk '!seen[$0]++' app.log                                 # ★ 去重

# ─── sed 文本处理 ───
sed -n '100,200p' app.log                                 # 打印 100~200 行
sed 's/old/new/g' file                                    # 替换（输出到 stdout）
sed -i 's/old/new/g' file                                 # ★ 原地替换（-i）
sed -i.bak 's/old/new/g' file                             # 替换并备份
sed '/^$/d' file                                           # 删除空行
sed -n '/START/,/END/p' file                              # 打印两个标记之间的内容

# ─── 其他实用命令 ───
wc -l app.log                                              # 行数
du -sh /data/app/logs/*                                    # ★ 日志占用空间
find /data/app/logs -name "*.log" -mtime +7 -exec rm {} \;  # ★ 删除 7 天前的日志
find /data/app/logs -size +1G                              # 找超大文件
split -l 100000 big.log part_                              # 分割大文件（便于传输/分析）
sort app.log | uniq -c | sort -rn | head                   # 频次统计
cut -d' ' -f1,2 app.log                                    # 取字段
tr -s ' ' app.log                                          # 压缩连续空格
```

### 4.3 日志切割（未用 logback 滚动时）

```bash
# ─── logrotate（系统级日志切割）───
sudo tee /etc/logrotate.d/mall > /dev/null <<'EOF'
/data/app/logs/mall/*.log {
    daily                        # 每天切割
    rotate 30                    # ★ 保留 30 份
    size 200M                    # 或超过 200M 就切割
    compress                     # ★ 压缩旧日志
    delaycompress                # 最近一份不压缩（可能还在写）
    missingok                    # 文件不存在不报错
    notifempty                   # 空文件不切割
    dateext                      # ★ 用日期作为后缀（而非数字）
    dateformat -%Y%m%d
    copytruncate                 # ★★ 复制后清空原文件（应用无需重新打开文件句柄！）
    # 或不用 copytruncate，改用 postrotate 通知应用重开文件：
    # postrotate
    #     kill -USR1 $(cat /data/app/mall/mall.pid)
    # endscript
    su appuser appuser           # ★ 以指定用户身份操作（权限问题）
    create 0640 appuser appuser  # 新建文件的权限
}
EOF

# 测试配置
sudo logrotate -d /etc/logrotate.d/mall        # dry-run（只显示不执行）
sudo logrotate -f /etc/logrotate.d/mall        # ★ 强制立即执行
sudo logrotate /etc/logrotate.d/mall           # 正常执行
cat /var/lib/logrotate/status                   # 查看上次执行时间

# ⚠️ copytruncate 的风险：复制和清空之间有极短的时间窗口，期间的日志会丢失
#   对日志完整性要求高时，用 create + postrotate 的方式（需应用支持重开文件）
#   最佳方案：★ 直接用 logback 的 RollingFileAppender（自带滚动，无此问题）
```

## 5. 常见部署问题排查 ★★★★★

### 5.1 启动失败

```bash
# ─── 排查步骤 ───
# ① 看日志（最重要的第一步）
tail -200 /data/app/logs/mall/stdout.log
sudo journalctl -u mall -n 200 --no-pager

# ② 常见启动失败原因
```

| 错误信息 | 原因 | 解决 |
| --- | --- | --- |
| `Port 8080 was already in use` | ★ 端口被占用 | `lsof -i:8080` 找进程，kill 或改端口 |
| `Unable to access jarfile` | jar 路径错误/文件不存在/权限不足 | 检查路径、`ls -l`、`chmod` |
| `no main manifest attribute` | ★ jar 不是可执行 jar（未用 spring-boot-maven-plugin repackage） | 重新打包，或用 `java -cp x.jar 主类` |
| `UnsupportedClassVersionError` | ★ 编译的 JDK 版本高于运行的 | 检查 `java -version`，升级或降级编译目标 |
| `ClassNotFoundException: jakarta.servlet...` | Spring Boot 2/3 依赖混用 | 统一版本（见 [[后端/JavaWeb/Tomcat架构与部署]]） |
| `BeanCreationException` | Spring Bean 初始化失败 | 看 Caused by 链的最后一个 |
| `Connection refused` (DB/Redis) | 中间件未启动/地址错/防火墙 | `telnet host port`、`nc -zv host port` 测试 |
| `Access denied for user` | 数据库账号密码错误 | 检查配置和 MySQL 权限 |
| `OutOfMemoryError` 启动时 | 堆设置过大超过物理内存 | 减小 -Xmx，检查容器内存限制 |
| `Error: Could not find or load main class` | 主类名错误/classpath 问题 | 检查 `Main-Class` |
| `Permission denied` | 无执行权限/目录不可写 | `chmod +x`、检查日志目录权限 |
| `Too many open files` | 文件句柄数不足 | ★ `LimitNOFILE`（systemd）或 `ulimit -n` |
| `Cannot allocate memory` | 内存不足（含线程栈） | 减小 -Xmx/-Xss，检查容器内存 |
| 启动卡在 `Starting ...` | 数据库/注册中心连接超时 | 检查网络、DNS、超时配置 |
| `Address already in use` (bind) | 上次进程未完全退出 | `ps -ef \| grep java`，kill 残留进程 |

```bash
# ─── ③ 网络连通性测试 ───
telnet mysql.internal 3306                    # 测试 TCP 连通
nc -zv mysql.internal 3306                      # 同上（-z 只探测不发数据）
nc -zv -w 3 mysql.internal 3306                 # 带 3 秒超时
curl -v http://localhost:8080/actuator/health    # ★ 健康检查
curl -s http://localhost:8080/actuator/health | jq
ping mysql.internal                              # ICMP（★ 很多服务器禁 ping，不通不代表端口不通）
nslookup mysql.internal / dig mysql.internal      # ★ DNS 解析（解析慢是启动慢的常见原因）
traceroute mysql.internal                         # 路由追踪
ss -tlnp | grep 8080                              # ★ 确认端口已监听
netstat -tlnp | grep 8080                         # 同上（老命令）

# ─── ④ 权限与文件 ───
ls -l /data/app/mall/lib/mall.jar                 # 文件权限
namei -l /data/app/mall/lib/mall.jar              # ★ 检查整条路径的权限（排查 Permission denied）
sudo -u appuser java -jar /data/app/mall/lib/mall.jar   # ★ 以目标用户身份手动启动（复现权限问题）
id appuser                                        # 用户和组
getfacl /data/app/logs                            # ACL 权限

# ─── ⑤ 手动前台启动（★ 最有效的排查方式，能直接看到错误）───
sudo -u appuser /usr/local/jdk-17/bin/java -jar /data/app/mall/lib/mall.jar \
    --spring.profiles.active=prod --debug
# --debug 会打印 Spring Boot 的自动配置报告（CONDITIONS EVALUATION REPORT）
```

### 5.2 应用运行但接口无响应

```bash
# ─── 分层排查 ───
# ① 进程在吗？
jps -lvm | grep mall
systemctl status mall

# ② 端口监听了吗？
ss -tlnp | grep 8080
# 如果没有监听 → 应用还没启动完成，或端口配置错了，或绑定到了 127.0.0.1
# 检查是否绑定了 0.0.0.0（否则外部访问不了）
ss -tln | grep 8080
# LISTEN 0 100 127.0.0.1:8080   ← ★ 只监听本地，外部访问不了！
# LISTEN 0 100 *:8080            ← 正常（所有网卡）

# ③ 本机 curl 能通吗？
curl -v http://127.0.0.1:8080/actuator/health
# 通 → 问题在网络/防火墙/Nginx
# 不通 → 问题在应用本身

# ④ 防火墙
sudo firewall-cmd --list-all                       # CentOS/RHEL
sudo firewall-cmd --add-port=8080/tcp --permanent && sudo firewall-cmd --reload
sudo ufw status                                    # Ubuntu
sudo ufw allow 8080/tcp
sudo iptables -L -n | grep 8080                     # 查看 iptables 规则
# 云服务商还要检查【安全组】规则（最常见的坑！）

# ⑤ 线程池打满？（应用假死）
jstack <pid> | grep -c 'http-nio'                   # Tomcat 线程数
jstack <pid> | grep 'http-nio' | grep -c WAITING    # 等待中的线程
# ★ 大量线程卡在同一个地方 → 见 [[后端/JVM/JVM调优与线上问题排查]]
curl -s http://127.0.0.1:8080/actuator/metrics/tomcat.threads.busy | jq

# ⑥ 数据库连接池耗尽？
curl -s http://127.0.0.1:8080/actuator/metrics/hikaricp.connections.pending | jq
# pending > 0 表示有线程在等连接 → 连接池不够或有连接泄漏

# ⑦ GC 停顿？
jstat -gcutil <pid> 1000 10                         # 观察 FGC 是否频繁
grep "Pause Full" /data/app/logs/mall/gc.log | tail -20

# ⑧ 磁盘满了？
df -h                                               # ★ 磁盘使用率
df -i                                               # ★ inode 使用率（小文件多时会耗尽，df -h 看不出来！）
du -sh /data/app/logs/*                             # 哪个目录占空间大
du -sh /* 2>/dev/null | sort -rh | head -20         # 从根目录找大文件
find / -type f -size +1G 2>/dev/null                # 找超大文件
# ★ 磁盘满的典型症状：日志写不进、上传失败、数据库报错、应用假死
# ★ 已删除但被进程占用的文件仍占空间：
lsof | grep deleted                                 # 找到后重启进程或 kill
```

### 5.3 性能问题快速定位

```bash
# ─── CPU ───
top                                # 总览（按 P 排序 CPU，按 M 排序内存，按 1 展开每核）
top -H -p <pid>                     # ★ 该进程的线程级 CPU（找最耗 CPU 的线程）
htop                                # 更友好的 top（需安装）
mpstat -P ALL 1                     # ★ 每核 CPU 使用率（看是否单核打满）
vmstat 1 10                         # ★ 系统级：r(运行队列) b(阻塞) si/so(swap) us/sy/wa
pidstat -u 1 10                     # 按进程统计 CPU
pidstat -t -p <pid> 1               # ★ 按线程统计 CPU
uptime                              # ★ 负载（1/5/15 分钟平均值，应 < CPU 核数）

# ─── CPU 高的完整排查流程（★ 面试必背）───
# ① top 找到 CPU 高的 Java 进程 PID
top
# ② top -H 找到该进程中 CPU 最高的线程 TID
top -H -p 12345
# ③ TID 转 16 进制
printf "%x\n" 12378               # → 305a
# ④ jstack 中搜索 nid=0x305a
jstack 12345 | grep -A 30 'nid=0x305a'
# ★ 一步到位（Arthas）：thread -n 3

# ─── 内存 ───
free -h                             # ★ 总内存、可用内存、swap
cat /proc/meminfo                   # 详细内存信息
vmstat 1                            # ★ si/so 不为 0 表示在用 swap（性能杀手！）
pmap -x <pid> | tail -1             # 该进程的内存映射汇总
jstat -gcutil <pid> 1000            # ★ JVM 各区域使用率和 GC
jcmd <pid> GC.heap_info             # 堆信息
jcmd <pid> VM.native_memory summary # ★ 本地内存（需 -XX:NativeMemoryTracking）
# RSS（实际物理内存）远大于 -Xmx？→ 堆外内存泄漏（DirectBuffer、Metaspace、线程栈、native 库）

# ─── 磁盘 IO ───
iostat -x 1 10                      # ★ %util(利用率) await(平均等待) r/s w/s(读写次数)
iotop                               # ★ 按进程看 IO（需 root）
pidstat -d 1 10                     # 按进程统计 IO
dstat -d --disk-util 1              # 综合视图
# %util 接近 100% 且 await 很高 → 磁盘是瓶颈（换 SSD / 减少日志 / 异步刷盘）

# ─── 网络 ───
ss -s                               # ★ 连接统计汇总（TCP 各状态数量）
ss -tan | awk '{print $1}' | sort | uniq -c | sort -rn    # ★ 各状态连接数（看 TIME_WAIT/CLOSE_WAIT）
ss -tanp | grep 8080                # 该端口的所有连接
ss -tan state time-wait | wc -l     # ★ TIME_WAIT 数量（大量 → 短连接过多）
ss -tan state close-wait | wc -l    # ★ CLOSE_WAIT 数量（★ 大量 → 应用未正确关闭连接！代码 bug）
netstat -ant | grep -c ESTABLISHED   # 已建立连接数
iftop -i eth0                       # ★ 实时流量（按连接）
nethogs                             # 按进程看流量
sar -n DEV 1 10                     # 网卡吞吐
sar -n TCP,ETCP 1 10                # TCP 统计（含重传率）
tcpdump -i eth0 port 8080 -w /tmp/cap.pcap    # ★ 抓包（用 Wireshark 分析）
curl -w "@curl-format.txt" -o /dev/null -s http://api/xxx   # ★ 分段计时（DNS/连接/首字节/总时长）

# curl-format.txt 内容：
#     dns_lookup: %{time_namelookup}s
#    tcp_connect: %{time_connect}s
#    tls_handshake: %{time_appconnect}s
#   first_byte(TTFB): %{time_starttransfer}s
#          total: %{time_total}s
#      http_code: %{http_code}

# ─── CLOSE_WAIT 过多的含义（★ 高频问题）───
# CLOSE_WAIT = 对方已关闭连接（发了 FIN），但本端应用还没调用 close()
# 大量 CLOSE_WAIT → ★ 应用代码没有正确关闭连接/流（资源泄漏）
# 常见于：HttpClient 未关闭 response、JDBC 连接未归还池、Socket 未 close、Redis 连接泄漏
# 排查：ss -tanp state close-wait 看是哪个进程，然后 jstack + 代码审查
# 对比：TIME_WAIT 是「主动关闭方」的正常状态（2MSL），大量 TIME_WAIT 通常是短连接过多

# ─── 综合监控工具 ───
glances                             # 一屏看全部（CPU/内存/IO/网络/进程）
nmon                                # IBM 出品，可记录历史数据
dstat                               # 综合实时统计
atop                                # ★ 带历史记录（可回放过去的状态，排查历史问题神器）
```

## 6. 部署流程与发布策略

### 6.1 标准部署脚本

```bash
#!/bin/bash
# ══════════ deploy.sh：完整的部署流程（★ 含备份和回滚）══════════
set -euo pipefail

APP_NAME="mall"
APP_HOME="/data/app/${APP_NAME}"
LIB_DIR="${APP_HOME}/lib"
BACKUP_DIR="/data/app/backup/${APP_NAME}"
NEW_JAR="$1"                                    # 传入新 jar 的路径
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MAX_BACKUP=10

echo "════════ 部署 ${APP_NAME} ════════"
echo "新版本：${NEW_JAR}"

# ① 前置检查
[ -f "${NEW_JAR}" ] || { echo "❌ jar 不存在：${NEW_JAR}"; exit 1; }
echo "→ 校验 jar 完整性..."
unzip -t "${NEW_JAR}" > /dev/null || { echo "❌ jar 文件损坏"; exit 1; }
NEW_VERSION=$(unzip -p "${NEW_JAR}" META-INF/MANIFEST.MF | grep 'Implementation-Version' | cut -d' ' -f2 | tr -d '\r')
echo "  版本号：${NEW_VERSION:-unknown}"

# ② ★ 备份当前版本
mkdir -p "${BACKUP_DIR}"
if [ -f "${LIB_DIR}/${APP_NAME}.jar" ]; then
    cp "${LIB_DIR}/${APP_NAME}.jar" "${BACKUP_DIR}/${APP_NAME}.jar.${TIMESTAMP}"
    echo "→ 已备份：${BACKUP_DIR}/${APP_NAME}.jar.${TIMESTAMP}"
    # 只保留最近 N 个备份
    ls -1t "${BACKUP_DIR}" | tail -n +$((MAX_BACKUP + 1)) | while read old; do
        rm -f "${BACKUP_DIR}/${old}"
        echo "  清理旧备份：${old}"
    done
fi

# ③ ★ 摘流量（从负载均衡/注册中心下线）
echo "→ 摘除流量..."
# Nginx：修改 upstream 并 reload
# sed -i 's/server 10.0.1.10:8080;/server 10.0.1.10:8080 down;/' /etc/nginx/conf.d/upstream.conf
# nginx -s reload
# Nacos/Eureka：调用注销接口
# curl -X DELETE "http://nacos:8848/nacos/v1/ns/instance?serviceName=${APP_NAME}&ip=$(hostname -i)&port=8080"
# K8s：kubectl cordon + drain
sleep 10                                        # ★ 等待上游感知（避免请求打到正在停止的实例）

# ④ 停止应用
echo "→ 停止应用..."
"${APP_HOME}/bin/stop.sh"

# ⑤ 替换 jar
echo "→ 部署新版本..."
cp "${NEW_JAR}" "${LIB_DIR}/${APP_NAME}.jar"
chown appuser:appuser "${LIB_DIR}/${APP_NAME}.jar"
chmod 640 "${LIB_DIR}/${APP_NAME}.jar"

# ⑥ 启动
echo "→ 启动应用..."
if ! "${APP_HOME}/bin/start.sh"; then
    echo "❌ 启动失败，开始回滚..."
    LATEST_BACKUP=$(ls -1t "${BACKUP_DIR}" | head -1)
    cp "${BACKUP_DIR}/${LATEST_BACKUP}" "${LIB_DIR}/${APP_NAME}.jar"
    "${APP_HOME}/bin/start.sh" || { echo "❌❌ 回滚也失败！需人工介入"; exit 1; }
    echo "✅ 已回滚到：${LATEST_BACKUP}"
    exit 1
fi

# ⑦ ★ 健康检查 + 冒烟测试
echo "→ 健康检查..."
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:8080/actuator/health | grep -q '"status":"UP"'; then
        echo "  ✅ 健康检查通过"
        break
    fi
    [ $i -eq 30 ] && { echo "❌ 健康检查失败，回滚"; exit 1; }
    sleep 2
done

# 冒烟测试（调用核心接口）
echo "→ 冒烟测试..."
SMOKE_RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/health/ping)
[ "${SMOKE_RESULT}" = "200" ] || { echo "❌ 冒烟测试失败（HTTP ${SMOKE_RESULT}），回滚"; exit 1; }

# ⑧ 恢复流量
echo "→ 恢复流量..."
# sed -i 's/server 10.0.1.10:8080 down;/server 10.0.1.10:8080;/' /etc/nginx/conf.d/upstream.conf
# nginx -s reload
sleep 5

# ⑨ 观察期
echo "→ 观察 30 秒错误日志..."
ERROR_COUNT=$(tail -1000 /data/app/logs/mall/mall-error.log 2>/dev/null | grep -c "$(date +%Y-%m-%d)" || echo 0)
echo "  今日错误日志行数：${ERROR_COUNT}"

echo "════════ ✅ 部署成功 ════════"
echo "版本：${NEW_VERSION}  时间：${TIMESTAMP}"
```

### 6.2 发布策略

| 策略 | 说明 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **停机发布** | 停止服务 → 部署 → 启动 | 简单 | ★ 有停机时间 |
| **滚动发布**（Rolling）★ | 逐批替换实例（如每次 1/3） | 无停机、资源占用少 | 新旧版本共存（需兼容）、回滚慢 |
| **蓝绿发布**（Blue-Green） | 准备一套完整的新环境（绿），验证后切流量 | ★ 秒级切换和回滚 | **资源翻倍** |
| **金丝雀/灰度**（Canary） | 先切 1%~5% 流量到新版本，观察无异常再全量 | ★ 风险最小 | 需要流量控制能力 |
| **A/B 测试** | 按用户特征分流（不同用户看不同版本） | 业务验证 | 实现复杂 |
| **影子流量** | 复制生产流量到新版本（不返回给用户） | 真实验证无风险 | 需要流量镜像 |

```nginx
# ─── 滚动发布（Nginx upstream）───
upstream backend {
    server 10.0.1.10:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8080 max_fails=3 fail_timeout=30s;
}
# 发布时逐台：标记 down → 部署 → 健康检查 → 恢复

# ─── 蓝绿发布 ───
upstream backend_blue  { server 10.0.1.10:8080; server 10.0.1.11:8080; }   # 当前生产
upstream backend_green { server 10.0.2.10:8080; server 10.0.2.11:8080; }   # 新版本
# 切换：修改 proxy_pass 指向 + nginx -s reload（★ 秒级切换）
server {
    location /api/ {
        proxy_pass http://backend_green;      # ← 改这一行
    }
}

# ─── 灰度发布（按权重）───
upstream backend {
    server 10.0.1.10:8080 weight=9;          # 90% 流量到旧版本
    server 10.0.2.10:8080 weight=1;          # ★ 10% 流量到新版本（灰度）
}
# 逐步调整权重：1 → 3 → 5 → 10（全量）

# ─── 灰度发布（按用户特征，需要 Lua 或 OpenResty）───
# 按 Cookie/Header 分流
map $http_x_gray $backend_pool {
    default      backend_stable;
    "true"       backend_canary;
}
# 按用户 ID 哈希分流（同一用户始终路由到同一版本，保证体验一致）
upstream backend_canary {
    hash $cookie_user_id consistent;         # ★ 一致性哈希
    server 10.0.2.10:8080;
    server 10.0.2.11:8080;
}
```

```bash
# ─── K8s 的滚动发布（★ 云原生标准）───
kubectl set image deployment/mall mall=registry.example.com/mall:1.1.0
kubectl rollout status deployment/mall            # 查看发布进度
kubectl rollout history deployment/mall           # 发布历史
kubectl rollout undo deployment/mall              # ★ 一键回滚到上一版本
kubectl rollout undo deployment/mall --to-revision=3   # 回滚到指定版本
kubectl rollout pause deployment/mall             # 暂停（用于分批发布）
kubectl rollout resume deployment/mall
```

```yaml
# K8s Deployment 的发布策略配置
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1              # ★ 发布时最多多出 1 个 Pod（7 个）
      maxUnavailable: 0        # ★ 发布时不允许有 Pod 不可用（保证容量）
  template:
    spec:
      containers:
        - name: mall
          image: registry.example.com/mall:1.1.0
          ports: [{containerPort: 8080}]
          # ★ 探针（K8s 判断应用状态的核心）
          startupProbe:                  # 启动探针（慢启动应用必备，避免被误杀）
            httpGet: {path: /actuator/health/liveness, port: 8080}
            failureThreshold: 30          # 最多等 30 × 10s = 5 分钟启动
            periodSeconds: 10
          readinessProbe:                # ★ 就绪探针（不通过则摘流量，不杀 Pod）
            httpGet: {path: /actuator/health/readiness, port: 8080}
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          livenessProbe:                 # ★ 存活探针（不通过则重启 Pod）
            httpGet: {path: /actuator/health/liveness, port: 8080}
            initialDelaySeconds: 60
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          lifecycle:
            preStop:                     # ★ 停止前的钩子（摘流量 + 等待）
              exec:
                command: ["sh", "-c", "sleep 15"]
          resources:
            requests: {cpu: "1", memory: "2Gi"}     # ★ 调度依据
            limits:   {cpu: "2", memory: "4Gi"}     # ★ 上限（超过内存会被 OOMKilled）
      terminationGracePeriodSeconds: 90             # ★ 优雅停机时间（要大于 preStop + 应用停机）
```

> 【坑】**readinessProbe 和 livenessProbe 的区别（K8s 高频问题）**：
> - **readiness**（就绪）：不通过 → **从 Service 摘除流量**，但 Pod 不重启。用于「应用启动中」或「临时不可用」。
> - **liveness**（存活）：不通过 → **重启 Pod**。用于「应用死锁/假死」。
> - ★ **liveness 探针绝不能依赖外部服务**（如数据库）！否则数据库抖动会导致所有 Pod 被重启，雪崩。liveness 只检查应用自身是否活着。
> - ★ **启动慢的应用必须配 `startupProbe`**，否则会在启动过程中被 liveness 探针判定失败而反复重启（CrashLoopBackOff）。

## 7. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 用 root 运行应用 | 安全风险（被攻破 = 服务器沦陷） | 专用低权限用户 + systemd `User=` |
| 2 | `kill -9` 停止应用 | 数据丢失、连接不归还、注册中心不注销 | 先 `kill -15`，超时再 -9 |
| 3 | 未配 shutdown hook | SIGTERM 后立即退出，请求被中断 | `@PreDestroy` + `server.shutdown=graceful` |
| 4 | `limits.conf` 对 systemd 无效 | `Too many open files` | ★ 在 service 文件配 `LimitNOFILE` |
| 5 | nohup 输出重定向到同一文件 | 文件无限增长 | 用 logback 滚动，或 `>/dev/null` |
| 6 | 磁盘被日志写满 | 应用假死、数据库报错 | logback `totalSizeCap` + logrotate + 监控告警 |
| 7 | inode 耗尽（df -h 显示有空间） | 无法创建文件 | `df -i` 检查，清理小文件 |
| 8 | 已删除文件仍占空间 | `df` 显示满但 `du` 找不到 | `lsof \| grep deleted`，重启进程 |
| 9 | swap 被使用 | 性能骤降（GC 停顿暴增） | `vm.swappiness=10` 或关闭 swap |
| 10 | 时区不一致 | 时间差 8 小时 | 系统时区 + `-Duser.timezone` + DB serverTimezone 三处统一 |
| 11 | 时间未同步 | 分布式系统各种诡异问题（Token 校验失败、日志乱序） | chrony/ntp 同步 |
| 12 | 端口只绑定 127.0.0.1 | 外部访问不了 | `server.address=0.0.0.0`（默认） |
| 13 | 云安全组未放行端口 | 本地能通、外部不通 | 检查云厂商安全组规则 |
| 14 | `jar` 未用 boot 插件打包 | `no main manifest attribute` | 加 `spring-boot-maven-plugin` |
| 15 | JDK 版本不匹配 | `UnsupportedClassVersionError` | 检查 `java -version` 与编译目标 |
| 16 | 配置文件权限过宽 | 密码泄漏 | `chmod 600`，敏感信息用 Vault/K8s Secret |
| 17 | 部署未备份 | 无法回滚 | ★ 部署脚本必须备份 + 保留多个历史版本 |
| 18 | 摘流量后立即停止 | 仍有请求打到停止中的实例 | 摘流量后 sleep 10~30 秒再停 |
| 19 | 未做健康检查就恢复流量 | 流量打到未就绪的实例 | ★ start 后必须轮询 health 端点 |
| 20 | `logback` 的 AsyncAppender 用默认 `discardingThreshold` | 高峰期 INFO 日志丢失 | 设为 0（或接受丢弃换性能） |
| 21 | AsyncAppender 的 `includeCallerData=true` | 性能骤降（要获取调用栈） | 设 false，日志格式不用 %class/%method/%line |
| 22 | CLOSE_WAIT 连接堆积 | 连接泄漏，最终耗尽资源 | 排查未关闭的 HttpClient/Socket/连接池 |
| 23 | livenessProbe 依赖数据库 | DB 抖动导致全部 Pod 重启（雪崩） | liveness 只检查应用自身 |
| 24 | 无 startupProbe 的慢启动应用 | CrashLoopBackOff（启动中被杀） | 配 startupProbe |
| 25 | K8s 内存 limit 等于 -Xmx | 被 OOMKilled（堆外内存没算） | limit = Xmx × 1.4，或用 MaxRAMPercentage |
| 26 | 多实例部署时日志文件冲突 | 日志互相覆盖 | 每实例独立目录，或统一输出到 stdout 由采集器收集 |
| 27 | 手动改配置未记录 | 下次部署被覆盖，或环境不一致 | 配置进 Git / 配置中心（Nacos） |
| 28 | 依赖 DNS 解析慢 | 启动慢、请求偶发超时 | 本地 DNS 缓存（nscd/systemd-resolved）、`networkaddress.cache.ttl` |

---

## 关联笔记

- 上一篇：[[后端/Java工程化与部署/Gradle与构建工具对比]]
- 下一篇：[[后端/Java工程化与部署/Docker与Nginx部署Java应用]]
- 排查：[[后端/JVM/JVM调优与线上问题排查]]（Arthas、GC 分析、OOM 排查）
- 打包：[[后端/SpringBoot/日志-Actuator与打包部署]]
- 通用 Linux：[[运维与部署/Linux]]
- 返回索引：[[后端/Java/Java学习笔记总索引]]
