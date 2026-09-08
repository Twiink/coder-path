---
title: "Docker与Nginx部署Java应用"
aliases:
  - "Dockerfile"
  - "docker-compose"
  - "Nginx 反向代理"
tags:
  - "后端"
  - "运维"
  - "docker"
  - "nginx"
  - "部署"
category: "后端"
folder: "Java工程化与部署"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java工程化与部署/Linux与Java项目部署]]"
  - "[[后端/JVM/JVM调优与线上问题排查]]"
  - "[[运维与部署/Docker]]"
  - "[[运维与部署/Nginx与HTTPS]]"
created: 2026-09-07
updated: 2026-09-07
---

# Docker 与 Nginx 部署 Java 应用

> 通用的 Docker/Nginx 基础见 [[运维与部署/Docker]] 与 [[运维与部署/Nginx与HTTPS]]，本篇聚焦**部署 Java 应用**的实操：Dockerfile 最佳实践、JVM 容器化配置、compose 编排、Nginx 反向代理与负载均衡、灰度发布。

## 1. Docker 基础回顾（Java 视角）

```bash
# ─── 安装 ───
# CentOS/RHEL
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
# Ubuntu
sudo apt install -y docker.io docker-compose-plugin
# macOS/Windows：Docker Desktop

sudo systemctl enable --now docker
sudo usermod -aG docker $USER          # ★ 免 sudo（需重新登录生效）
docker version && docker compose version

# 配置国内镜像加速（★ 必须，否则拉取极慢）
sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com",
    "https://mirror.ccs.tencentyun.com"
  ],
  "log-driver": "json-file",
  "log-opts": { "max-size": "100m", "max-file": "3" },     ★ 容器日志限制（防磁盘写满）
  "data-root": "/data/docker",                              ★ 镜像存储位置（默认 /var/lib/docker 易写满系统盘）
  "default-ulimits": { "nofile": { "Name": "nofile", "Hard": 655350, "Soft": 655350 } },
  "live-restore": true,                                     ★ dockerd 重启不影响运行中的容器
  "max-concurrent-downloads": 10
}
EOF
sudo systemctl daemon-reload && sudo systemctl restart docker
```

**核心概念：**

| 概念 | 说明 | Java 类比 |
| --- | --- | --- |
| **Image（镜像）** | 只读的模板（分层文件系统） | Class |
| **Container（容器）** | 镜像的运行实例 | Object |
| **Dockerfile** | 构建镜像的脚本 | 源代码 |
| **Registry（仓库）** | 镜像存储（Docker Hub、Harbor、ACR） | Maven 私服 |
| **Volume（数据卷）** | 持久化存储（容器删除数据还在） | 外部数据库 |
| **Network** | 容器网络（bridge/host/none/overlay） | — |

```bash
# ─── 常用命令 ───
docker images                                    # 列出镜像
docker pull eclipse-temurin:17-jre-alpine        # 拉取镜像
docker ps                                        # 运行中的容器
docker ps -a                                     # 所有容器（含已停止）
docker run -d --name mall -p 8080:8080 mall:1.0   # ★ 后台运行
docker logs -f mall                              # ★ 看日志
docker logs --tail 200 mall
docker exec -it mall sh                          # ★ 进入容器（alpine 是 sh，ubuntu 是 bash）
docker exec -it mall jstat -gcutil 1 1000        # 在容器内执行命令
docker stats                                     # ★ 实时资源占用
docker inspect mall                              # 详细信息（JSON）
docker stop mall && docker start mall && docker restart mall
docker rm -f mall                                # 强制删除容器
docker rmi mall:1.0                              # 删除镜像
docker system df                                 # ★ 磁盘占用分析
docker system prune -af --volumes                # ★ 清理所有无用资源（谨慎！）
docker builder prune -af                         # 清理构建缓存

# 文件传输
docker cp mall:/app/logs/app.log ./              # 从容器拷出
docker cp ./config.yml mall:/app/config/         # 拷入容器

# 导出/导入
docker save mall:1.0 | gzip > mall.tar.gz        # 镜像导出（离线部署）
docker load < mall.tar.gz                         # 镜像导入
docker export mall > mall-fs.tar                  # 容器文件系统导出
```

## 2. Dockerfile 最佳实践 ★★★★★

### 2.1 基础镜像选择

| 镜像 | 大小 | 特点 | 推荐度 |
| --- | --- | --- | --- |
| `eclipse-temurin:17-jdk` | ~450MB | 完整 JDK + Ubuntu，含所有诊断工具 | ⭐⭐⭐⭐ 需要 jstack/jmap 时 |
| **`eclipse-temurin:17-jre`** | ~270MB | 只有 JRE（无 javac/jstack） | ⭐⭐⭐⭐ 生产够用 |
| **`eclipse-temurin:17-jre-alpine`** | **~90MB** | Alpine（musl libc），极小 | ⭐⭐⭐⭐⭐ ★ 首选 |
| `eclipse-temurin:17-jre-jammy` | ~280MB | Ubuntu 22.04 基础 | ⭐⭐⭐⭐ |
| `amazoncorretto:17-alpine` | ~90MB | 亚马逊发行版 | ⭐⭐⭐⭐ |
| `gcr.io/distroless/java17` | ~230MB | **无 shell**（最安全，但无法 exec 排查） | ⭐⭐⭐ 高安全要求 |
| `openjdk:17` | ~470MB | ❌ **已废弃**（官方不再维护） | ❌ 不要用 |

> 【坑】**Alpine 的 musl libc 与 glibc 的差异**：
> - DNS 解析行为不同（不支持 `search` 域的某些特性，K8s 中可能有 DNS 问题）
> - 部分依赖 glibc 的 native 库不兼容（如某些 JNI、`netty-transport-native-epoll` 需用 `-musl` 变体）
> - locale 支持有限（中文可能显示异常，需装 `libc6-compat` 和字体）
> - 性能上 glibc 的 malloc 通常更好
>
> **建议**：Alpine 优先（体积小、攻击面小），遇到 native 库或 DNS 问题时换 `-jammy`（Ubuntu）。

### 2.2 生产级 Dockerfile（多阶段构建 + 分层）

```dockerfile
# ══════════ 阶段 1：构建（Build Stage）══════════
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build

# ★★ 先只复制 pom.xml 并下载依赖（利用 Docker 层缓存！）
# 这样只要 pom 不变，后续代码改动不会重新下载依赖（构建从 5 分钟 → 30 秒）
COPY pom.xml .
COPY mall-common/pom.xml mall-common/
COPY mall-web/pom.xml mall-web/
RUN --mount=type=cache,target=/root/.m2 \
    mvn dependency:go-offline -B

# 再复制源码并构建
COPY mall-common/src mall-common/src
COPY mall-web/src mall-web/src
RUN --mount=type=cache,target=/root/.m2 \
    mvn clean package -DskipTests -B -pl mall-web -am

# ★ 提取 Spring Boot 的分层（用于更细粒度的缓存）
WORKDIR /extract
COPY --from=builder /build/mall-web/target/mall.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract


# ══════════ 阶段 2：运行（Runtime Stage）══════════
FROM eclipse-temurin:17-jre-alpine

# ─── ① 安装必要的工具（★ 精简，只装排查必需的）───
RUN apk add --no-cache \
      curl \                # 健康检查用
      tzdata \              # ★ 时区数据（必须有，否则 Asia/Shanghai 无效）
      fontconfig ttf-dejavu # ★ 字体（生成验证码/图表/PDF 时需要，否则中文乱码或报错）
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata                              # 可删除以进一步减小体积（软链已生效）
    # 如果要 jstack/jmap/arthas 排查，需装 JDK 而非 JRE：
    # apk add --no-cache openjdk17（体积会大很多）

# ─── ② 创建非 root 用户（★★ 安全必做）───
RUN addgroup -S -g 1000 app && adduser -S -u 1000 -G app -h /app app

# ─── ③ 创建目录并设置权限 ───
RUN mkdir -p /app/logs /app/config /app/tmp \
    && chown -R app:app /app

WORKDIR /app

# ─── ④ ★ 按 Spring Boot 分层复制（★ 依赖层变化少，能最大化缓存复用）───
COPY --from=extract --chown=app:app /extract/dependencies/ ./
COPY --from=extract --chown=app:app /extract/spring-boot-loader/ ./
COPY --from=extract --chown=app:app /extract/snapshot-dependencies/ ./
COPY --from=extract --chown=app:app /extract/application/ ./
# 四层的顺序：dependencies（第三方 jar，很少变）→ loader → snapshot-dependencies → application（你的代码，最常变）
# ★ 只有最后一层会因为代码改动而重建，前三层全部命中缓存 → 镜像推送/拉取快得多

# ─── ⑤ 环境变量与 JVM 参数 ───
ENV TZ=Asia/Shanghai \
    LANG=C.UTF-8 \
    JAVA_OPTS="-XX:+UseContainerSupport \
               -XX:InitialRAMPercentage=70.0 \
               -XX:MaxRAMPercentage=70.0 \
               -XX:MaxMetaspaceSize=256m \
               -XX:MaxDirectMemorySize=256m \
               -XX:+UseG1GC \
               -XX:MaxGCPauseMillis=200 \
               -XX:+HeapDumpOnOutOfMemoryError \
               -XX:HeapDumpPath=/app/logs/heapdump.hprof \
               -XX:+ExitOnOutOfMemoryError \
               -Xlog:gc*,safepoint:file=/app/logs/gc.log:time,uptime:filecount=5,filesize=20m \
               -Djava.io.tmpdir=/app/tmp \
               -Duser.timezone=Asia/Shanghai \
               -Dfile.encoding=UTF-8" \
    SPRING_PROFILES_ACTIVE=prod

# ★ 为什么用 MaxRAMPercentage 而非 -Xmx：
#   容器的内存限制由 docker run -m / K8s limits 决定，
#   MaxRAMPercentage=70 表示堆占容器内存的 70%，剩下 30% 给：
#   元空间、线程栈、直接内存、JIT 代码缓存、GC 自身、native 库
#   ★ 用 -Xmx 写死会导致「改容器内存还要改镜像」，且容易忘记留余量而被 OOMKilled

# ─── ⑥ 暴露端口（仅文档作用，实际映射靠 -p）───
EXPOSE 8080

# ─── ⑦ ★ 健康检查 ───
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -sf http://localhost:8080/actuator/health/liveness || exit 1
# start-period：启动宽限期（Java 应用启动慢，必须设长，否则启动中就被判失败）
# interval：检查间隔  timeout：单次超时  retries：连续失败几次判定 unhealthy

# ─── ⑧ ★ 用 exec 形式启动（关键！信号能正确传递给 JVM）───
USER app
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS org.springframework.boot.loader.launch.JarLauncher"]
# ★★ 必须用 exec（sh -c "exec ..."）：
#   - 若写成 CMD java -jar app.jar（shell 形式），java 进程的父进程是 sh，
#     docker stop 发的 SIGTERM 给了 sh，sh 不会转发给 java → JVM 收不到信号 →
#     等待 10 秒后被 SIGKILL 强杀 → 优雅停机失效！
#   - exec 让 java 替换 sh 进程，直接接收信号
# Spring Boot 3.2+ 的 loader 路径是 org.springframework.boot.loader.launch.JarLauncher
# Spring Boot 3.1- 是 org.springframework.boot.loader.JarLauncher

# ─── 简化写法（不用分层，直接 java -jar）───
# COPY --chown=app:app target/mall.jar app.jar
# ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
```

**构建与运行：**

```bash
# 构建
docker build -t registry.example.com/mall:1.0.0 .
docker build -t mall:1.0.0 --build-arg SPRING_PROFILES_ACTIVE=prod .
docker build --platform linux/amd64 -t mall:1.0.0 .     # ★ Mac M 系列芯片构建 x86 镜像（服务器是 x86）
docker build --no-cache -t mall:1.0.0 .                  # 不用缓存（排查构建问题）
docker build --target builder -t mall-builder .          # 只构建到某阶段

# ★ BuildKit（更快的构建，支持并行和缓存挂载）
export DOCKER_BUILDKIT=1
docker buildx build --platform linux/amd64,linux/arm64 \
    -t registry.example.com/mall:1.0.0 --push .           # ★ 多架构镜像

# 运行
docker run -d \
  --name mall \
  --restart unless-stopped \                              # ★ 自动重启策略
  -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e DB_HOST=mysql.internal \
  -e DB_PASSWORD=xxx \
  --env-file /data/app/mall.env \                         # ★ 从文件读环境变量
  -v /data/app/logs:/app/logs \                            # ★ 日志挂载到宿主机
  -v /data/app/conf:/app/config:ro \                       # ★ 配置挂载（只读）
  -v mall-data:/app/data \                                 # ★ 命名卷（数据持久化）
  -m 4g \                                                  # ★ 内存限制 4GB（JVM 会感知）
  --cpus="2.0" \                                           # ★ CPU 限制 2 核
  --memory-swap 4g \                                       # ★ 等于 -m 表示禁用 swap（推荐）
  --ulimit nofile=655350:655350 \                           # ★ 文件句柄数
  --health-cmd="curl -sf http://localhost:8080/actuator/health || exit 1" \
  --log-driver json-file --log-opt max-size=100m --log-opt max-file=3 \
  registry.example.com/mall:1.0.0

# ★ 网络模式
docker network create app-net                              # 自定义网络（容器间可用名字互访）
docker run -d --name mall --network app-net mall:1.0.0
docker run -d --name mysql --network app-net mysql:8       # mall 中可用 jdbc:mysql://mysql:3306
# --network host：直接用宿主机网络（性能最好，但端口冲突风险，K8s 中不推荐）

# 验证
docker ps                                                  # STATUS 应为 Up (healthy)
docker logs -f mall
docker exec -it mall sh
docker exec mall jcmd 1 VM.flags                            # 看 JVM 参数是否生效
docker exec mall java -XX:+PrintFlagsFinal -version | grep -i maxheap   # 看堆大小
docker stats mall --no-stream
docker inspect mall --format='{{.State.Health.Status}}'
```

### 2.3 容器化 JVM 的关键配置 ★★★★★

```bash
# ─── ① 内存：容器内存 ≠ 堆内存 ───
# 容器被 OOMKilled（Exit Code 137）的完整内存构成：
#   堆（-Xmx / MaxRAMPercentage）
# + 元空间（Metaspace）
# + 线程栈（线程数 × -Xss，200 线程 × 1MB = 200MB！）
# + 直接内存（MaxDirectMemorySize，NIO/Netty）
# + JIT 代码缓存（ReservedCodeCacheSize，默认 240MB）
# + GC 自身的数据结构（G1 的 RSet 可占堆的 10%+）
# + Native 库（zip、netty-epoll、字体渲染）
# + JVM 自身开销
#
# ★ 经验值：容器内存 = 堆 × 1.4 ~ 1.5
#   容器 4GB → 堆最多 2.8GB（MaxRAMPercentage=70）
#   容器 8GB → 堆最多 5.6GB

# 验证 JVM 是否正确识别容器限制
docker run --rm -m 4g eclipse-temurin:17-jre java -XX:+PrintFlagsFinal -version | grep -iE 'MaxHeapSize|UseContainerSupport'
# uintx MaxHeapSize = 2952790016  ← 约 2.75GB（4GB × 70%）✅

docker run --rm -m 4g eclipse-temurin:17-jre java -XshowSettings:properties -version 2>&1 | grep -i 'container'
# JDK 8u191+ / JDK 10+ 默认 -XX:+UseContainerSupport
# 老版本 JDK 8 需要：-XX:+UnlockExperimentalVMOptions -XX:+UseCGroupMemoryLimitForHeap

# CPU 识别
docker run --rm --cpus="2" eclipse-temurin:17-jre java -XshowSettings:system -version 2>&1 | grep -i processors
# 或代码：Runtime.getRuntime().availableProcessors() → 2 ✅
# ★ 老版本 JDK 会返回宿主机核数（如 64），导致 GC 线程数和线程池配置严重过大

# ─── ② 显式限制各内存区域（★ 防止某一项失控导致 OOMKilled）───
ENV JAVA_OPTS="-XX:MaxRAMPercentage=65.0 \
  -XX:MaxMetaspaceSize=256m \
  -XX:MaxDirectMemorySize=256m \
  -XX:ReservedCodeCacheSize=180m \
  -XX:CompressedClassSpaceSize=128m \
  -Xss512k"                                # ★ 减小线程栈（200 线程省 100MB）

# ─── ③ 本地内存追踪（排查 OOMKilled）───
-XX:NativeMemoryTracking=summary
docker exec mall jcmd 1 VM.native_memory summary
# 对比各区域占用，找出「堆之外」的内存大户

# ─── ④ PID 1 与信号处理（★ 优雅停机的关键）───
# 容器中的主进程是 PID 1，它有特殊语义：
#   - 只有 PID 1 能接收 docker stop 的 SIGTERM
#   - PID 1 不会应用默认的 signal handler（必须显式处理）
#   - PID 1 负责回收僵尸子进程（reap）
# ★ 用 exec 形式让 java 成为 PID 1，才能收到 SIGTERM
# 或用 tini/dumb-init 作为 PID 1（同时解决僵尸进程回收）
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]

# ─── ⑤ 停止超时（默认 10 秒太短！）───
docker stop -t 90 mall                     # ★ 给 90 秒优雅停机（默认 10 秒后 SIGKILL）
docker run --stop-timeout 90s ...          # 运行时的默认停止超时
# K8s 中对应 terminationGracePeriodSeconds

# ─── ⑥ 容器内的诊断（JRE 镜像没有 jstack/jmap！）───
# 方案 A：用 JCmd（JRE 自带！）
docker exec mall jcmd 1 Thread.print > thread.txt          # ★ 等价 jstack
docker exec mall jcmd 1 GC.heap_info                        # 堆信息
docker exec mall jcmd 1 GC.class_histogram | head -30       # 类直方图
docker exec mall jcmd 1 GC.heap_dump /app/logs/heap.hprof   # ★ 堆转储
docker cp mall:/app/logs/heap.hprof ./                      # 拷出来用 MAT 分析
docker exec mall jcmd 1 VM.flags
docker exec mall jcmd 1 VM.native_memory summary

# 方案 B：临时注入 Arthas（★ 推荐，功能最强）
docker exec -it mall sh
curl -O https://arthas.aliyun.com/arthas-boot.jar
java -jar arthas-boot.jar 1                                 # attach 到 PID 1
# 若容器无 curl/wget，从宿主机拷入：
docker cp arthas-boot.jar mall:/tmp/

# 方案 C：用 jattach（极小的原生工具，不依赖 JDK）
# 方案 D：构建镜像时保留 JDK（体积大但排查方便）
```

### 2.4 Docker Compose（多服务编排）

```yaml
# ══════════ docker-compose.yml：完整的微服务本地/小规模部署 ══════════
version: "3.8"                              # Compose v2 可省略

services:
  # ─── MySQL ───
  mysql:
    image: mysql:8.0
    container_name: mall-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root123}
      MYSQL_DATABASE: mall
      MYSQL_USER: mall
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-mall123}
      TZ: Asia/Shanghai
    command:
      - --character-set-server=utf8mb4                    # ★ 字符集（支持 emoji）
      - --collation-server=utf8mb4_unicode_ci
      - --default-time-zone=+08:00                        # ★ 时区
      - --max_connections=1000
      - --innodb_buffer_pool_size=1G
      - --slow_query_log=1                                # ★ 慢查询日志
      - --long_query_time=1
      - --max_allowed_packet=64M
    ports:
      - "3306:3306"                                        # 生产建议不暴露，仅内网访问
    volumes:
      - mysql-data:/var/lib/mysql                          # ★ 数据持久化
      - ./docker/mysql/init:/docker-entrypoint-initdb.d:ro # ★ 首次启动自动执行的 SQL
      - ./docker/mysql/conf.d:/etc/mysql/conf.d:ro         # 额外配置
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-p${MYSQL_ROOT_PASSWORD:-root123}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 40s
    networks: [mall-net]
    deploy:
      resources:
        limits: { cpus: "2.0", memory: 2G }

  # ─── Redis ───
  redis:
    image: redis:7-alpine
    container_name: mall-redis
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD:-redis123}
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru                       # ★ 淘汰策略
      --appendonly yes                                     # ★ 开启 AOF 持久化
      --appendfsync everysec
    ports: ["6379:6379"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-redis123}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks: [mall-net]

  # ─── Nacos（注册中心 + 配置中心）───
  nacos:
    image: nacos/nacos-server:v2.3.0
    container_name: mall-nacos
    restart: unless-stopped
    environment:
      MODE: standalone                                     # 单机模式（集群用 cluster）
      SPRING_DATASOURCE_PLATFORM: mysql
      MYSQL_SERVICE_HOST: mysql
      MYSQL_SERVICE_DB_NAME: nacos_config
      MYSQL_SERVICE_USER: root
      MYSQL_SERVICE_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root123}
      JVM_XMS: 512m
      JVM_XMX: 512m
      NACOS_AUTH_ENABLE: "true"                            # ★ 必须开启鉴权（历史漏洞）
      NACOS_AUTH_TOKEN: ${NACOS_AUTH_TOKEN}
      NACOS_AUTH_IDENTITY_KEY: ${NACOS_IDENTITY_KEY}
      NACOS_AUTH_IDENTITY_VALUE: ${NACOS_IDENTITY_VALUE}
    ports:
      - "8848:8848"                                        # HTTP
      - "9848:9848"                                        # ★ gRPC（2.x 必须开放，= 8848+1000）
      - "9849:9849"
    depends_on:
      mysql: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8848/nacos/v1/console/health/readiness"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 60s
    networks: [mall-net]

  # ─── 应用服务 ───
  mall-app:
    build:
      context: .
      dockerfile: Dockerfile
    image: registry.example.com/mall:${APP_VERSION:-1.0.0}
    container_name: mall-app
    restart: unless-stopped
    environment:
      SPRING_PROFILES_ACTIVE: prod
      DB_HOST: mysql                                        # ★ 用服务名（compose 内置 DNS）
      DB_PORT: 3306
      DB_PASSWORD: ${MYSQL_PASSWORD:-mall123}
      REDIS_HOST: redis
      REDIS_PASSWORD: ${REDIS_PASSWORD:-redis123}
      NACOS_SERVER_ADDR: nacos:8848
      TZ: Asia/Shanghai
      JAVA_OPTS: >-
        -XX:MaxRAMPercentage=70.0
        -XX:+UseG1GC -XX:MaxGCPauseMillis=200
        -XX:MaxMetaspaceSize=256m
        -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/app/logs/
        -XX:+ExitOnOutOfMemoryError
        -Xlog:gc*:file=/app/logs/gc.log:time,uptime:filecount=5,filesize=20m
    ports:
      - "8080:8080"
    volumes:
      - ./logs/mall:/app/logs                               # ★ 日志挂载出来（容器删了日志还在）
      - ./config:/app/config:ro                             # 外置配置
    depends_on:                                             # ★ 依赖 + 健康检查（等依赖就绪才启动）
      mysql: { condition: service_healthy }
      redis: { condition: service_healthy }
      nacos: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8080/actuator/health/liveness"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 90s                                     # ★ Java 启动慢，宽限期要长
    networks: [mall-net]
    deploy:
      resources:
        limits: { cpus: "2.0", memory: 4G }                 # ★ JVM 会用 4G × 70% = 2.8G 堆
        reservations: { cpus: "0.5", memory: 1G }
    logging:
      driver: json-file
      options: { max-size: "100m", max-file: "3" }
    stop_grace_period: 90s                                  # ★ 优雅停机时间
    # scale: 3                                              # 可水平扩展（配合 ports 要去掉固定映射）

  # ─── Nginx ───
  nginx:
    image: nginx:1.25-alpine
    container_name: mall-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/conf.d:/etc/nginx/conf.d:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
      - ./frontend/dist:/usr/share/nginx/html:ro            # ★ 前端静态资源
      - ./logs/nginx:/var/log/nginx
    depends_on:
      mall-app: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/nginx_status"]
      interval: 30s
      timeout: 3s
      retries: 3
    networks: [mall-net]

# ─── 网络 ───
networks:
  mall-net:
    driver: bridge
    # ipam: { config: [{ subnet: 172.28.0.0/16 }] }

# ─── 数据卷 ───
volumes:
  mysql-data:
  redis-data:
```

```bash
# ─── Compose 命令 ───
docker compose up -d                          # ★ 启动所有服务（后台）
docker compose up -d --build                   # 构建镜像后启动
docker compose up -d mysql redis               # 只启动指定服务
docker compose down                            # 停止并删除容器和网络
docker compose down -v                         # ★ 连数据卷一起删（危险！）
docker compose ps                              # 服务状态
docker compose logs -f mall-app                # ★ 跟踪某服务日志
docker compose logs -f --tail 200
docker compose restart mall-app
docker compose exec mall-app sh                # 进入容器
docker compose exec mysql mysql -umall -p      # 进入 MySQL 客户端
docker compose pull                            # 拉取最新镜像
docker compose config                          # ★ 校验并输出最终配置（排查语法）
docker compose top                             # 容器内的进程
docker compose stop / start / pause / unpause
docker compose scale mall-app=3                # ★ 扩容到 3 个实例（需去掉固定 container_name 和端口映射）
docker compose --profile monitoring up -d       # 按 profile 启动（可选服务）
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d   # ★ 多文件叠加（环境差异）
```

## 3. Nginx 反向代理与负载均衡 ★★★★★

### 3.1 完整配置

```nginx
# ══════════ /etc/nginx/nginx.conf（主配置）══════════
user  nginx;
worker_processes  auto;                    # ★ auto = CPU 核数（每个 worker 单线程，靠 epoll 处理万级连接）
worker_rlimit_nofile 655350;                # ★ 每个 worker 的文件句柄数

error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events {
    use epoll;                              # ★ Linux 高性能事件模型
    worker_connections  65535;              # ★ 每个 worker 的最大连接数
                                            #   总并发 = worker_processes × worker_connections
    multi_accept on;                         # 一次 accept 多个连接
    accept_mutex off;                        # ★ 关闭惊群锁（新内核 + epoll 不需要）
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # ─── 日志格式（★ 加上游耗时，排查慢请求的关键）───
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for" '
                      'rt=$request_time uct=$upstream_connect_time '       # ★ 连接上游耗时
                      'uht=$upstream_header_time urt=$upstream_response_time ' # ★ 上游总耗时
                      'ups=$upstream_addr us=$upstream_status';            # ★ 上游地址和状态

    access_log  /var/log/nginx/access.log  main;

    # ─── 基础优化 ───
    sendfile        on;                     # ★ 零拷贝发送文件（性能关键）
    tcp_nopush      on;                     # ★ 配合 sendfile，数据包攒够再发（减少网络包数量）
    tcp_nodelay     on;                     # ★ 禁用 Nagle（低延迟，与 tcp_nopush 不冲突）
    keepalive_timeout  65;                  # ★ 长连接超时
    keepalive_requests 1000;                 # 单个长连接最多处理多少请求

    # ─── ★ Gzip 压缩（大幅减少带宽，提升加载速度）───
    gzip              on;
    gzip_min_length   1k;                    # 小于 1k 不压缩（压缩收益小于开销）
    gzip_comp_level   5;                     # 压缩级别 1~9（5 是性能/压缩比的平衡点）
    gzip_vary         on;                    # ★ 加 Vary: Accept-Encoding（CDN/代理缓存正确性）
    gzip_disable      "MSIE [1-6]\.";        # 老 IE 不压缩
    gzip_proxied      any;
    gzip_buffers      16 8k;
    gzip_types                               # ★ 只压缩文本类型（图片/视频已压缩，再压白费 CPU）
        text/plain
        text/css
        text/xml
        text/javascript
        application/json                    # ★ API 响应（收益最大！）
        application/javascript
        application/xml
        application/xml+rss
        application/x-font-ttf
        image/svg+xml
        font/woff2;
    # 更强的压缩：brotli（需编译 ngx_brotli 模块）
    # brotli on; brotli_comp_level 6; brotli_types ...;

    # ─── 缓冲区（★ 反向代理的关键调优）───
    client_body_buffer_size    128k;          # 请求体缓冲
    client_max_body_size       50m;           # ★ 上传文件大小限制（超过返回 413）
    client_header_buffer_size  4k;
    large_client_header_buffers 4 32k;        # ★ 大请求头（Cookie/Token 很长时需要）
    proxy_buffer_size          16k;           # ★ 读取上游响应头的缓冲
    proxy_buffers              8 32k;         # ★ 读取上游响应体的缓冲
    proxy_busy_buffers_size    64k;
    proxy_temp_file_write_size 64k;
    proxy_buffering            on;            # ★ 开启缓冲（保护慢客户端不占用上游连接）

    # ─── 超时 ───
    proxy_connect_timeout  5s;                # ★ 连接上游超时（要短，快速失败）
    proxy_send_timeout     60s;               # 向上游发送
    proxy_read_timeout     60s;               # ★ 等待上游响应（后端慢请求的上限）
    send_timeout           60s;               # 向客户端发送

    # ─── 隐藏版本信息（★ 安全）───
    server_tokens off;                        # 不显示 nginx 版本

    # ─── 限流（★ 防 CC 攻击）───
    limit_req_zone $binary_remote_addr zone=req_perip:10m rate=20r/s;    # 每 IP 每秒 20 请求
    limit_req_zone $server_name zone=req_global:10m rate=2000r/s;        # 全局每秒 2000
    limit_conn_zone $binary_remote_addr zone=conn_perip:10m;
    limit_req_status 429;                     # ★ 限流返回 429（默认 503）
    limit_conn_status 429;

    # ─── 自定义错误页 ───
    # error_page 502 503 504 /50x.html;

    include /etc/nginx/conf.d/*.conf;
}
```

```nginx
# ══════════ /etc/nginx/conf.d/mall.conf ══════════

# ─── ★ 上游服务集群（负载均衡）───
upstream mall_backend {
    # 策略 1：轮询（默认）
    server 10.0.1.10:8080 max_fails=3 fail_timeout=30s weight=1;
    server 10.0.1.11:8080 max_fails=3 fail_timeout=30s weight=1;
    server 10.0.1.12:8080 max_fails=3 fail_timeout=30s weight=1;
    # ★ max_fails：在 fail_timeout 内失败多少次就摘除该节点
    # ★ weight：权重（机器配置不同时可调整）
    # server 10.0.1.13:8080 backup;          # ★ 备用节点（其他都挂了才用）
    # server 10.0.1.14:8080 down;            # ★ 标记为下线（维护中）

    # 策略 2：最少连接（★ 长连接/请求耗时差异大的场景更优）
    # least_conn;

    # 策略 3：IP 哈希（★ 会话粘滞，同一 IP 固定到同一节点）
    # ip_hash;

    # 策略 4：一致性哈希（★ 缓存场景，节点变化时只影响部分 key）
    # hash $request_uri consistent;
    # hash $cookie_user_id consistent;        # 按用户 ID 哈希

    # 策略 5：加权最少连接（默认算法其实是 weighted least-connection）
    # fair;                                    # 需第三方模块（按响应时间分配）

    # ★★ Keep-Alive 到上游（性能关键！否则每次请求都新建 TCP 连接）
    keepalive 64;                              # 保持 64 个空闲长连接
    keepalive_timeout 60s;
    keepalive_requests 1000;
}

# ─── HTTP → HTTPS 强制跳转 ───
server {
    listen 80;
    listen [::]:80;
    server_name www.example.com example.com;

    # ★ ACME 挑战（Let's Encrypt 续期用，必须保留 HTTP）
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # ★ HSTS（告诉浏览器以后只用 HTTPS，防 SSL Strip 攻击）
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        return 301 https://$host$request_uri;    # ★ 301 永久重定向（会被缓存）
    }
}

# ─── HTTPS 主站 ───
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;                                    # ★ Nginx 1.25.1+ 用独立指令（旧版：listen 443 ssl http2）
    server_name www.example.com;

    # ─── ★ TLS 配置 ───
    ssl_certificate     /etc/nginx/ssl/example.com.pem;      # 完整证书链（含中间证书！）
    ssl_certificate_key /etc/nginx/ssl/example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;                      # ★ 禁用 1.0/1.1
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;                             # TLS1.3 下由客户端选（更优）
    ssl_session_cache   shared:SSL:20m;                        # ★ 会话缓存（减少完整握手）
    ssl_session_timeout 1h;
    ssl_session_tickets on;
    ssl_stapling        on;                                     # ★ OCSP Stapling（加速证书验证）
    ssl_stapling_verify on;
    resolver            8.8.8.8 114.114.114.114 valid=300s;     # OCSP 需要 DNS
    resolver_timeout    5s;
    ssl_early_data      on;                                     # TLS 1.3 的 0-RTT（⚠️ 有重放风险，只对幂等请求开）

    # ─── ★ 安全响应头 ───
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com; font-src 'self' data:; object-src 'none'; frame-ancestors 'self'; upgrade-insecure-requests" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    # 隐藏后端信息
    proxy_hide_header X-Powered-By;
    proxy_hide_header Server;

    # ─── ★ 真实客户端 IP（关键！否则后端拿到的是 Nginx 的 IP）───
    set_real_ip_from  10.0.0.0/8;                 # 可信代理网段
    set_real_ip_from  172.16.0.0/12;
    set_real_ip_from  127.0.0.1;
    real_ip_header    X-Forwarded-For;             # ★ 从哪个头取真实 IP
    real_ip_recursive on;                          # ★ 递归剥离可信代理 IP，取最左边的真实客户端

    # ─── 前端静态资源（★ 动静分离）───
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;          # ★★ SPA 路由的关键（Vue/React history 模式）
        # 没有这一行，刷新 /user/123 会 404（因为没有对应的物理文件）

        # HTML 不缓存（保证发版后立即生效）
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }

    # ★ 带 hash 的静态资源永久缓存（文件名变了才会重新请求）
    location ~* \.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;                            # ★ 静态资源不记日志（减少 IO）
        try_files $uri =404;
    }

    # ─── ★ API 反向代理 ───
    location /api/ {
        # 限流（★ 保护后端）
        limit_req zone=req_perip burst=40 nodelay;   # 允许突发 40 个，超出直接拒绝（不排队）
        limit_conn conn_perip 50;                    # 单 IP 最多 50 个并发连接

        # ★ 代理到上游
        proxy_pass http://mall_backend/;             # ★★ 末尾的 / 会去掉 /api 前缀！
        #   proxy_pass http://backend/;    → /api/users → /users（去前缀）
        #   proxy_pass http://backend;     → /api/users → /api/users（保留前缀）

        proxy_http_version 1.1;                       # ★ 用 HTTP/1.1（支持 keepalive 和 chunked）
        proxy_set_header Connection "";                # ★ 清空 Connection（配合上游 keepalive）

        # ★ 传递原始请求信息给后端
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;   # ★ 追加而非覆盖
        proxy_set_header X-Forwarded-Proto $scheme;                       # ★ http/https
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Port  $server_port;
        proxy_set_header X-Request-Id      $request_id;                   # ★ Nginx 生成的请求 ID（链路追踪）

        # 超时（★ 按接口特性调整）
        proxy_connect_timeout 3s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;

        # 错误处理：上游失败时尝试下一个节点
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_next_upstream_tries 2;                  # 最多重试 2 次
        proxy_next_upstream_timeout 10s;

        # ★ 只对幂等请求重试（POST 默认不重试，避免重复下单！）
        # proxy_next_upstream ... non_idempotent;     # 加这个才会对 POST 重试（危险）
    }

    # ─── 文件上传（单独配置，放宽限制）───
    location /api/upload {
        client_max_body_size 100m;                    # ★ 单独放大上传限制
        proxy_read_timeout   300s;
        proxy_request_buffering off;                   # ★ 流式转发（大文件不缓冲到磁盘）
        proxy_pass http://mall_backend/api/upload;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # ─── 文件下载（大文件优化）───
    location /api/download {
        proxy_pass http://mall_backend/api/download;
        proxy_buffering off;                           # ★ 关闭缓冲，直接流式转发（省内存和磁盘）
        proxy_read_timeout 600s;
        proxy_set_header Host $host;
        # 或直接用 Nginx 发送文件（性能最好，X-Accel-Redirect）
    }

    # ─── WebSocket（★ 需要 Upgrade 头）───
    location /ws/ {
        proxy_pass http://mall_backend/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;        # ★★ 必须
        proxy_set_header Connection "upgrade";          # ★★ 必须
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;                       # ★★ 长连接超时要设很长（默认 60s 会断！）
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }

    # ─── SSE（服务端推送）───
    location /api/sse/ {
        proxy_pass http://mall_backend/api/sse/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;                            # ★ 必须关闭，否则数据被缓冲不实时推送
        proxy_cache off;
        proxy_read_timeout 24h;
        chunked_transfer_encoding on;
    }

    # ─── Actuator 监控端点（★ 只允许内网访问）───
    location /actuator/ {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 127.0.0.1;
        deny all;                                        # ★ 其他一律拒绝
        proxy_pass http://mall_backend/actuator/;
        proxy_set_header Host $host;
    }

    # ─── 禁止访问敏感文件（★ 安全）───
    location ~ /\.(?!well-known) { deny all; }            # .git .env 等隐藏文件
    location ~* \.(yml|yaml|properties|xml|sql|sh|bak|old|swp)$ { deny all; }
    location ~ ^/(WEB-INF|META-INF)/ { deny all; }

    # ─── Nginx 状态监控（★ 需 --with-http_stub_status_module）───
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
    }

    # ─── 自定义错误页 ───
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html { root /usr/share/nginx/html; internal; }
}
```

### 3.2 Nginx 运维命令与排查

```bash
# ─── 基本操作 ───
nginx -t                                       # ★★ 测试配置语法（改完必做！）
nginx -T                                       # 测试并输出完整配置（排查 include 问题）
nginx -s reload                                # ★ 平滑重载（不中断连接）
nginx -s reopen                                # 重新打开日志文件（配合 logrotate）
nginx -s stop                                  # 立即停止
nginx -s quit                                  # 优雅停止（处理完当前请求）
systemctl reload nginx                         # systemd 方式
docker exec mall-nginx nginx -t && docker exec mall-nginx nginx -s reload

# ─── 监控 ───
curl http://127.0.0.1/nginx_status
# Active connections: 291
# server accepts handled requests
#  16630948 16630948 31070465            ← 接受数 = 处理数（不等说明有连接被丢弃！）
# Reading: 6 Writing: 179 Waiting: 106    ← Reading 读请求头 / Writing 写响应 / Waiting keepalive 空闲

# 日志分析（★ 实用命令）
# Top 20 访问 IP
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -20
# Top 20 请求 URL
awk '{print $7}' access.log | sort | uniq -c | sort -rn | head -20
# 状态码分布
awk '{print $9}' access.log | sort | uniq -c | sort -rn
# ★ 5xx 错误统计
awk '$9 ~ /^5/ {print $9, $7}' access.log | sort | uniq -c | sort -rn | head
# ★ 平均响应时间（自定义 log_format 中的 $request_time）
awk '{print $NF}' access.log | sort -n | tail -20                    # 最慢的 20 个
awk '{sum+=$NF; n++} END {print "平均:", sum/n, "s"}' access.log
# ★ P99 响应时间
awk '{print $NF}' access.log | sort -n | awk '{a[NR]=$1} END {print "P99:", a[int(NR*0.99)]}'
# 每分钟请求数（QPS 趋势）
awk '{print substr($4,2,17)}' access.log | uniq -c
# 流量统计
awk '{sum+=$10} END {print sum/1024/1024 " MB"}' access.log

# ─── 常见问题排查 ───
# ① 502 Bad Gateway：后端挂了/响应无效
curl -v http://10.0.1.10:8080/actuator/health      # 直接测后端
tail -100 /var/log/nginx/error.log                  # ★ 看 Nginx 错误日志
# 常见：connect() failed (111: Connection refused) → 后端进程没起
#      upstream prematurely closed connection → 后端处理中崩溃/被 kill
#      no live upstreams → 所有节点都被 max_fails 摘除了

# ② 504 Gateway Timeout：后端太慢
# error.log: upstream timed out (110: Connection timed out) while reading response header
# → 调大 proxy_read_timeout，或★ 优化后端性能（这才是根本）

# ③ 413 Request Entity Too Large：上传超限
# → client_max_body_size

# ④ 400 Bad Request: Request Header Or Cookie Too Large
# → large_client_header_buffers 4 32k（Cookie/JWT 太长）

# ⑤ 后端拿到的是 Nginx 的 IP
# → 检查 proxy_set_header X-Real-IP / X-Forwarded-For
# → Spring Boot 配置 server.tomcat.remoteip.*（见 [[后端/JavaWeb/Tomcat架构与部署]]）

# ⑥ 连接数耗尽
# error.log: worker_connections are not enough
# → 调大 worker_connections + worker_rlimit_nofile + 系统 ulimit

# ⑦ TIME_WAIT 过多
ss -tan state time-wait | wc -l
# → 开启上游 keepalive（★ 最有效），或调内核参数
```

### 3.3 灰度发布与流量控制

```nginx
# ─── 方案 1：按权重灰度 ───
upstream backend_canary {
    server 10.0.2.10:8080;              # 新版本
}
upstream backend_stable {
    server 10.0.1.10:8080;              # 旧版本
    server 10.0.1.11:8080;
}
# 用 split_clients 按百分比分流（★ 比 weight 更精确，基于哈希保证同一用户稳定）
split_clients "${remote_addr}${request_uri}" $canary_pool {
    5%      backend_canary;              # ★ 5% 流量到新版本
    *       backend_stable;
}
server {
    location /api/ {
        proxy_pass http://$canary_pool;
    }
}

# ─── 方案 2：按 Header/Cookie 灰度（★ 内部测试用）───
map $http_x_gray $backend_pool {
    default       backend_stable;
    "true"        backend_canary;         # 带 X-Gray: true 头的请求走新版本
}
map $cookie_gray $backend_by_cookie {
    default       "";
    "1"           backend_canary;
}
# 组合：优先看 Header，其次看 Cookie，最后默认
map "$http_x_gray$cookie_gray" $final_pool {
    "~1"          backend_canary;
    default       backend_stable;
}

# ─── 方案 3：按用户 ID 哈希（同一用户始终同一版本，★ 体验一致）───
upstream backend_hash {
    hash $cookie_user_id consistent;      # ★ 一致性哈希（节点变化时只影响 1/N 用户）
    server 10.0.1.10:8080;
    server 10.0.1.11:8080;
    server 10.0.2.10:8080;                # 新节点，加入后只有部分用户路由过来
}

# ─── 方案 4：按地域/设备分流（需要 GeoIP 模块）───
geoip_country /usr/share/GeoIP/GeoIP.dat;
map $geoip_country_code $pool {
    CN      backend_cn;
    default backend_global;
}

# ─── 蓝绿切换（★ 秒级回滚）───
# 只改一行 + reload
upstream active_backend {
    server 10.0.2.10:8080;    # ← 绿色（新版本）；出问题时改回 10.0.1.10 并 reload
    keepalive 64;
}
```

## 4. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | Dockerfile 用 shell 形式 CMD | `docker stop` 后优雅停机失效（被 SIGKILL） | ★ `ENTRYPOINT ["sh","-c","exec java ..."]` |
| 2 | 容器内用 root 运行 | 安全风险 | `USER app` + 目录权限 |
| 3 | `-Xmx` 写死等于容器内存 | ★ **OOMKilled（Exit 137）** | `MaxRAMPercentage=70`，留 30% 给堆外 |
| 4 | 未设 `stop_grace_period` | 默认 10 秒后强杀 | 设为 90s，配合应用的优雅停机 |
| 5 | JRE 镜像无 jstack/jmap | 无法排查 | 用 `jcmd`（JRE 自带）或注入 Arthas |
| 6 | 日志写在容器内 | 容器删除日志丢失、磁盘写满 | 挂载 volume，或输出到 stdout 由采集器收集 |
| 7 | 容器日志无大小限制 | 宿主机磁盘写满 | daemon.json 配 `log-opts` max-size |
| 8 | Alpine 缺时区数据 | 时间差 8 小时 | `apk add tzdata` + 软链 localtime |
| 9 | Alpine 缺字体 | 生成图片/PDF 中文乱码或报错 | `apk add fontconfig ttf-dejavu` |
| 10 | Alpine 的 musl 与 native 库不兼容 | `UnsatisfiedLinkError` | 换 `-jammy` 或用 musl 变体的 native 库 |
| 11 | 未用多阶段构建 | 镜像含 Maven 和源码，体积大且泄漏源码 | ★ 多阶段构建 |
| 12 | COPY 全部代码后才 mvn package | 每次改代码都重新下依赖（构建 5 分钟） | ★ 先 COPY pom → dependency:go-offline |
| 13 | 未用 Spring Boot 分层 | 每次构建都推送整个镜像（几百 MB） | `layertools extract` 分层 COPY |
| 14 | `depends_on` 期望等依赖就绪 | 应用启动时 MySQL 还没准备好 | ★ `condition: service_healthy` + healthcheck |
| 15 | Mac M 芯片构建的镜像在 x86 服务器跑不了 | `exec format error` | `--platform linux/amd64` 或 buildx 多架构 |
| 16 | `proxy_pass` 末尾斜杠搞错 | 路径多了或少了 `/api` | 带 `/` 去前缀，不带 `/` 保留 |
| 17 | 未配上游 keepalive | 每次请求新建 TCP 连接，大量 TIME_WAIT | ★ `keepalive 64` + `proxy_http_version 1.1` + `Connection ""` |
| 18 | SPA 刷新 404 | `/user/123` 刷新报 404 | ★ `try_files $uri $uri/ /index.html` |
| 19 | 后端拿到 Nginx 的 IP | 日志/限流基于错误 IP | `X-Real-IP` + `set_real_ip_from` + Tomcat RemoteIpValve |
| 20 | WebSocket 60 秒断开 | 长连接被切 | `proxy_read_timeout 3600s` + Upgrade 头 |
| 21 | SSE 数据不实时 | 被 proxy_buffering 缓冲 | `proxy_buffering off` |
| 22 | 大文件上传 413 | 超过 `client_max_body_size` | 单独 location 放大限制 |
| 23 | JWT/Cookie 过长导致 400 | 请求头超限 | `large_client_header_buffers 4 32k` |
| 24 | POST 请求被 `proxy_next_upstream` 重试 | **重复下单/重复扣款** | 不加 `non_idempotent`（默认只重试幂等请求） |
| 25 | Actuator 端点暴露公网 | 敏感信息泄漏（env/heapdump） | `allow/deny` 限制内网 |
| 26 | Nginx 未隐藏版本号 | 信息泄漏 | `server_tokens off` |
| 27 | gzip 压缩了图片 | 白费 CPU，体积不减 | `gzip_types` 只列文本类型 |
| 28 | `nginx -s reload` 前未 `nginx -t` | 配置错误导致 Nginx 挂掉 | ★ 改完必先 `-t` 验证 |
| 29 | worker_connections 太小 | 高并发时 502/连接被拒 | 调大 + `worker_rlimit_nofile` + ulimit |
| 30 | 容器内 JVM 未识别 CPU 限制 | GC 线程过多，性能差 | JDK 8u191+，或 `--cpus` + `ActiveProcessorCount` |
| 31 | 镜像中打包了配置和密码 | 泄漏 + 改配置要重建镜像 | 环境变量 / 挂载 volume / 配置中心 |
| 32 | `docker compose down -v` 误删数据卷 | ★ 数据库数据全丢 | 谨慎使用；数据卷单独备份 |
| 33 | HEALTHCHECK 的 start-period 太短 | 启动中被判 unhealthy | Java 应用设 90s+ |
| 34 | liveness 探针依赖数据库 | DB 抖动导致所有实例重启（雪崩） | 只检查应用自身 |
| 35 | 单容器跑多个服务 | 违反容器设计原则，难以扩缩容 | 一个容器一个进程，用 compose/K8s 编排 |

---

## 关联笔记

- 上一篇：[[后端/Java工程化与部署/Linux与Java项目部署]]
- 相关：[[后端/JVM/JVM调优与线上问题排查]]（容器内 JVM 排查、NMT）、[[后端/SpringBoot/日志-Actuator与打包部署]]
- 通用：[[运维与部署/Docker]]、[[运维与部署/Nginx与HTTPS]]
- 微服务网关：[[后端/微服务/Gateway网关]]（应用层网关，与 Nginx 互补）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
