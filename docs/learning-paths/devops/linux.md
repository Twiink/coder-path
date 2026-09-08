# Linux 系统管理学习路线

Linux，服务器的统治者。从个人电脑到超级计算机，从嵌入式设备到云端服务器，Linux 无处不在。掌握 Linux 系统管理，你就掌握了现代基础设施的核心技能。

## 为什么学 Linux

- 服务器市场占有率超过 90%
- 云计算、容器、DevOps 的基础
- 开源免费，社区活跃
- 稳定、安全、高性能
- 几乎所有后端开发工作都需要 Linux 知识

## 学习路线图

### 第一阶段：基础命令

**文件系统导航**
- 目录结构（/、/home、/etc、/var、/usr）
- cd、pwd、ls 基础导航
- 绝对路径 vs 相对路径
- . 和 .. 目录
- 文件权限（rwx）概念

**文件操作**
- cp、mv、rm 文件管理
- mkdir、rmdir 目录操作
- touch 创建文件
- cat、less、more 查看文件
- head、tail 查看部分内容

**文本处理**
- grep 文本搜索
- sed 流编辑器
- awk 文本分析
- sort、uniq、wc 统计
- cut、paste 列处理

**文件查找**
- find 按条件查找
- locate 快速定位
- which、whereis 命令位置
- type 命令类型

### 第二阶段：系统管理

**用户与权限**
- useradd / userdel 用户管理
- passwd 密码管理
- su / sudo 权限切换
- chmod 修改权限
- chown 修改所有者
- groups 查看用户组

**进程管理**
- ps 查看进程
- top / htop 实时监控
- kill / killall 终止进程
- jobs / fg / bg 任务控制
- nohup 后台运行
- systemctl 服务管理

**磁盘管理**
- df 磁盘使用情况
- du 目录大小
- mount / umount 挂载
- fdisk / parted 分区
- mkfs 格式化
- LVM 逻辑卷管理

**网络配置**
- ifconfig / ip 网络接口
- ping / traceroute 连通性测试
- netstat / ss 端口查看
- curl / wget 下载工具
- scp / rsync 文件传输

### 第三阶段：进阶技能

**Shell 脚本**
- Bash 脚本基础
- 变量与环境变量
- 条件判断（if、case）
- 循环（for、while）
- 函数定义
- 参数处理

**系统监控**
- vmstat 系统状态
- iostat 磁盘 I/O
- free 内存使用
- uptime 系统负载
- dmesg 内核日志
- journalctl systemd 日志

**包管理**
- apt (Debian/Ubuntu)
- yum / dnf (RHEL/CentOS)
- 软件源配置
- 手动编译安装
- 依赖关系处理

**定时任务**
- cron / crontab 配置
- 定时任务语法
- at 一次性任务
- systemd timer
- 日志查看与调试

### 第四阶段：服务器运维

**Web 服务器**
- Nginx 安装与配置
- Apache HTTP Server
- 虚拟主机配置
- SSL/TLS 证书
- 反向代理设置

**数据库服务**
- MySQL / PostgreSQL 安装
- 数据库用户管理
- 备份与恢复
- 性能调优
- 主从复制配置

**防火墙与安全**
- iptables / firewalld 规则
- SSH 密钥认证
- fail2ban 防暴力破解
- SELinux / AppArmor
- 安全加固清单

**日志分析**
- /var/log 日志目录
- syslog 系统日志
- 应用日志分析
- logrotate 日志轮转
- 日志聚合方案

### 第五阶段：高级运维

**性能调优**
- CPU 性能分析
- 内存优化
- 磁盘 I/O 优化
- 网络调优
- 内核参数调整

**自动化运维**
- Ansible 批量管理
- Shell 脚本自动化
- 配置管理
- 部署流程自动化
- 监控告警自动化

**容器与虚拟化**
- Docker 容器
- KVM 虚拟化
- LXC 容器
- 资源隔离与限制
- 容器编排基础

**故障排查**
- 系统无法启动
- 性能突然下降
- 磁盘空间耗尽
- 内存泄漏排查
- 网络连接问题

## 下一步学习

学完 Linux 基础后，可以继续探索：
- **Docker**：容器化技术
- **Kubernetes**：容器编排
- **CI/CD**：自动化部署流程
- **云平台**：AWS、GCP、阿里云

## 实用工具

- **tmux / screen**：终端复用器
- **vim / nano**：文本编辑器
- **htop**：更友好的进程监控
- **ncdu**：可视化磁盘分析
- **tldr**：简化的命令帮助

Linux 是现代基础设施的基石。从基础的文件操作到复杂的系统调优，从单机管理到集群运维，Linux 都是核心技能。别被命令行吓到，熟能生巧。先从基础命令开始，慢慢积累实战经验。记住：遇到问题先 `man` 一下，Google 搜索时加上 "linux" 关键词。多实践，多折腾，Linux 会成为你最得力的运维工具。
