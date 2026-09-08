# Docker 学习路线

Docker，容器化的先驱。它改变了软件交付的方式，让"在我机器上能跑"成为历史。从开发到生产，Docker 让应用部署变得简单、可靠、一致。

## 为什么学 Docker

- 环境一致性：开发、测试、生产环境完全一致
- 轻量快速：秒级启动，资源占用小
- 隔离性好：进程、网络、文件系统隔离
- 易于迁移：打包一次，到处运行
- 微服务架构的基础设施

## 学习路线图

### 第一阶段：容器基础

**安装与配置**
- macOS / Linux / Windows 安装 Docker
- Docker Desktop vs Docker Engine
- 配置镜像加速器
- docker version 和 docker info
- 将用户加入 docker 组（免 sudo）

**镜像操作**
- docker pull 拉取镜像
- docker images 查看本地镜像
- docker rmi 删除镜像
- docker tag 打标签
- Docker Hub 镜像仓库

**容器基础**
- docker run 运行容器
- -d 后台运行
- -p 端口映射
- -v 挂载卷
- --name 命名容器
- docker ps 查看容器

**容器生命周期**
- docker start / stop / restart
- docker pause / unpause
- docker rm 删除容器
- docker logs 查看日志
- docker exec 进入容器

### 第二阶段：镜像构建

**Dockerfile 编写**
- FROM 基础镜像
- RUN 执行命令
- COPY / ADD 复制文件
- WORKDIR 工作目录
- ENV 环境变量
- EXPOSE 暴露端口
- CMD / ENTRYPOINT 启动命令

**构建优化**
- 层缓存利用
- 多阶段构建
- .dockerignore 文件
- 减小镜像体积
- 安全最佳实践

**镜像管理**
- docker build 构建镜像
- docker history 查看层历史
- docker inspect 详细信息
- docker save / load 导出导入
- 镜像版本管理

### 第三阶段：网络与存储

**容器网络**
- bridge 桥接网络（默认）
- host 主机网络
- none 无网络
- 自定义网络
- 容器间通信
- 端口映射策略

**数据持久化**
- Volume 数据卷
- Bind Mount 绑定挂载
- tmpfs 临时文件系统
- 数据卷备份
- 数据卷容器
- 命名卷 vs 匿名卷

**Docker Compose**
- docker-compose.yml 编写
- services 服务定义
- networks 网络配置
- volumes 数据卷
- depends_on 依赖关系
- docker-compose up / down

### 第四阶段：实战应用

**开发环境**
- 本地开发环境容器化
- 热重载配置
- 多服务编排
- 数据库容器
- 开发工具容器化

**构建流程**
- CI/CD 集成
- 自动化构建
- 镜像推送
- 版本标签策略
- 构建缓存优化

**微服务部署**
- 服务容器化
- 服务发现
- 负载均衡
- 健康检查
- 滚动更新

### 第五阶段：进阶主题

**容器编排基础**
- Docker Swarm 入门
- 服务扩缩容
- 滚动更新
- 服务发现与负载均衡
- vs Kubernetes 对比

**监控与日志**
- docker stats 资源监控
- docker logs 日志查看
- 日志驱动配置
- 集中日志方案
- 监控工具集成

**安全加固**
- 镜像安全扫描
- 最小权限原则
- 使用非 root 用户
- 资源限制（CPU、内存）
- Secrets 管理

**性能优化**
- 镜像层优化
- 构建缓存策略
- 多阶段构建
- 资源配额
- 存储驱动选择

## 下一步学习

学完 Docker 后，可以继续探索：
- **Kubernetes**：容器编排的王者
- **Docker Swarm**：轻量级编排方案
- **微服务架构**：服务拆分与治理
- **云原生**：CNCF 生态探索

## 实用工具

- **Docker Desktop**：官方桌面应用
- **Portainer**：可视化管理界面
- **docker-compose**：多容器编排
- **dive**：镜像层分析工具
- **lazydocker**：终端 UI 管理工具

Docker 是现代应用部署的标准。从简单的容器运行到复杂的微服务编排，Docker 让一切变得简单。别被 Dockerfile 的语法吓到，其实就是把你平时的安装步骤写下来。先从跑一个 nginx 容器开始，慢慢理解镜像、容器、网络、存储的概念。多实践，多折腾，Docker 会成为你最得力的开发工具。
