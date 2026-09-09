# Linux 系统管理学习路线

Linux,服务器的统治者:互联网服务器九成以上跑在它上面,云计算、容器、DevOps 全是它的孩子——**几乎所有后端与运维工作都以 Linux 为地基**。学它别想"背完所有命令"(背不完,也必要),正确姿势是:**先掌握核心命令的骨架(本页),再按需 man/tldr/搜索引擎查细节,最后在真实排障中形成肌肉记忆**。建议与 [操作系统](/learning-paths/cs-basics/operating-systems) 理论课对照学:进程/权限/文件系统在理论页见过概念,在这里亲手操作,两头一碰就通了。实践:本地虚拟机、云服务器(学生机/免费额度),或 Windows 的 WSL——**有一台能随便折腾的 Linux 比看十篇教程有用**。

这条线按 **终端与文件基础 → 文本处理三剑客 → 查找与权限 → 进程与服务 → 网络与 SSH → 磁盘与包管理 → 日志与定时 → Shell 脚本 → 监控排障 → 安全与自动化** 推进。

## 第一站:终端、文件系统与命令骨架

**目录结构(FHS,先认门)**:`/etc`(配置文件)/`var`(运行数据:日志/var/log、网站 /var/www)/`usr`(程序)/`home`(用户目录)/`tmp`/`opt`——**文件放对位置是系统管理的纪律**。**导航与文件操作**:`pwd`/`ls -la`(a 含隐藏、l 详情)/`cd`(绝对 vs 相对路径、`..` 上级、`~` 家目录);`cp`/`mv`/`rm`(**rm -rf 是核按钮:先 ls 确认再删;删前备份是好习惯**)/`touch`(建空文件或更新时间戳)/`mkdir -p`(递归建目录);查看:`cat`(小文件)/`less`(大文件浏览:q 退出、/搜索)/`head`/`tail`(**tail -f 跟日志:排查问题的日常动作**)/`file`(看文件类型)。
**管道与重定向(命令的乐高)**:`>` 覆盖/`>>` 追加/`2>&1`(错误并进输出)/`|` 管道:`cat access.log | grep ERROR | wc -l`——**"小命令组合成大能力"是 Unix 哲学**;`tee`(边输出边存)。**终端效率**:Tab 补全、`Ctrl+r` 历史搜索、`Ctrl+c` 中断、`Ctrl+d` 退出、`!!` 上一条;**tmux/screen(终端复用:SSH 断了任务不断——服务器操作习惯必备)**;编辑器:**vim 至少会"打开/编辑/i 插入/esc/保存 :wq/强退 :q!"**(生产服务器没有图形界面,vi 是底线技能;不想深学用 nano)。

## 第二站:文本处理三剑客——grep/sed/awk

日志与配置文件处理是 Linux 日常,**三剑客必会**:①**grep(搜索)**:`grep "ERROR" app.log`、`-E`(扩展正则)、`-v`(反选)、`-i`(忽略大小写)、`-c`(计数)、`-r`(递归目录)、`-n`(行号);②**sed(流式编辑)**:`sed 's/旧/新/g' file`(替换,g 全局)、`sed -i`(原地改——**先不加 -i 试跑,确认无误再落盘**)、`sed -n '10,20p'`(打印区间)、`sed '/pattern/d'`(删行);③**awk(按列分析,最强)**:`awk '&#123;print $1, $3&#125;' file`(第 1、3 列)、`awk -F, '&#123;print $1&#125;'`(自定义分隔符,处理 CSV)、内置变量(NR 行号/NF 列数)、`awk 'NR>1 &#123;sum+=$2&#125; END&#123;print sum&#125;'`(累加统计)——**"从日志里抽某列做统计"就是 awk 的主场**。
**配套小工具**:`sort`(-n 按数字/-k 按列/-r 倒序)、`uniq -c`(去重并计数——先 sort 再 uniq 才有效)、`wc -l`(行数)、`cut -d: -f1`(切列)、`xargs`(把前命令输出变成后命令参数:`find ... | xargs rm`——注意文件名带空格要用 -0)。
**学完组合**:`grep -c "500" access.log`、`awk '&#123;print $1&#125;' access.log | sort | uniq -c | sort -rn | head`(统计访问 Top IP)——**这就是日志分析的起点**。

## 第三站:文件查找与权限

**查找**:`which`(命令在哪)、`type`(命令类型)、**`find`(按条件找文件,功能最强)**:`find / -name "*.log"`、`-mtime -7`(7 天内改过)、`-size +100M`(大文件——清磁盘用)、`find . -name "*.tmp" -delete`;`locate`(数据库索引,快但可能旧)。
**权限模型(从 [操作系统](/learning-paths/cs-basics/operating-systems) 视角理解:文件权限是 inode 元数据)**:`ls -l` 的 `-rwxr-xr-x` 分三组(属主 u/属组 g/其他人 o)×三种(r 读 4/w 写 2/x 执行 1);**chmod 数字法**:`chmod 755`(目录标配)/`644`(文件标配)/`600`(私密文件:密钥!)/`chmod +x script.sh`(给脚本执行权限——写完脚本不 +x 是最常见的"不工作"原因);`chown user:group file`(改属主);**sudo 与用户管理**:`useradd`/`passwd`/`groups`;**sudo 不是"用 root 跑一切"**——给应用建专属账号 + sudoers 白名单授权(`visudo` 编辑);**生产纪律:业务进程不用 root 跑**(安全第一课,容器里同理会强调 non-root)。

## 第四站:进程、服务与 systemd

**进程查看**:`ps aux`(全量进程:a 含他人/u 详细/x 无终端)/`ps -ef`;`top`(实时:看 **load average(1/5/15 分钟负载,与核数对比:>核数持续 = 过载)**、CPU 使用、内存)/`htop`(更友好,可 F9 杀进程);**信号与 kill**:`kill -15`(TERM 优雅退出——先礼)/`kill -9`(KILL 强杀——后兵)/`kill -1`(HUP 重载配置:Nginx 改配置后的 reload 底层就是这个);`pkill`/`killall`(按名)。
**后台与守护**:`./app &`(后台)/`nohup ./app &`(退出 SSH 不杀——老派方式)/**tmux**(现代方式);**systemd(现代 Linux 的服务总管,必学)**:`systemctl start/stop/restart/status/enable(开机自启)/disable 服务名`——**部署一个 Java/Node 服务 = 写一个 .service 单元文件**(ExecStart/Restart=always/User=应用账号),然后 `systemctl daemon-reload && enable --now`;**看服务日志:`journalctl -u 服务名 -f`**(跟日志排障)——**systemd + journalctl 是排查"服务起没起来/为什么崩"的标准路径**。

## 第五站:网络与 SSH

**看网络**:`ip addr`(网卡与 IP,替代老 ifconfig)/`ip route`(路由);**`ss -tlnp`(看端口被谁监听——"端口被占用"排查第一命令**;老 netstat 也行);连通性:`ping`/`traceroute`(路径)/`curl -v URL`(看 HTTP 全流程——排接口问题神器)/`wget`(下载);DNS:`nslookup`/`dig`(解析排查,见 [网络](/learning-paths/cs-basics/computer-networks))。
**文件传输**:`scp`(单次拷)/**`rsync -avz`(增量同步:目录同步/备份的标准工具,断点续传)**;**SSH(运维生命线)**:`ssh user@host`、**密钥登录**:`ssh-keygen -t ed25519` 生成 + `ssh-copy-id user@host` 分发,**私钥权限必须 600**(权限太松 SSH 拒绝使用);**sshd 安全加固:禁 root 直接登录(PermitRootLogin no)、建议禁用密码登录(PasswordAuthentication no,只留密钥)**;`ssh config`(Host 别名,多服务器管理体验起飞);`screen/tmux` 挂在 SSH 会话上(见第一站)。

## 第六站:磁盘与包管理

**磁盘**:`df -h`(分区使用率——**90% 是警报线,95%+ 服务可能写不进**)、`du -sh *`/`du -h --max-depth=1`(找大目录)、`ncdu`(交互式可视化——**磁盘满排查三步:df 看哪个分区 → du 找大目录 → 决定清理/扩容**);`df -i`(**inode 满的隐藏坑:小文件太多,空间没用完却写不进**);挂载:云盘挂载流程 `lsblk`(看块设备)→ `fdisk` 分区 → `mkfs.ext4` 格式化 → `mount` → 写 `/etc/fstab`(开机自动挂)——理解即可,云平台大多半自动;LVM(逻辑卷:动态扩缩,老派运维必会,了解)。
**包管理(软件安装的正道)**:Debian/Ubuntu 系 **apt**:`apt update`(先刷新源!)/`install`/`remove`/`upgrade`、`apt search`;RHEL/CentOS 系 **dnf/yum**(同款逻辑);`dpkg -l | grep xxx`(查装了啥);**软件源**(国内用阿里/清华镜像,速度天壤之别);编译安装(./configure && make && make install——**能包管理就别编译**,除非要定制);`uname -a`/`cat /etc/os-release`(看系统版本——提问前先报这个)。

## 第七站:日志与定时任务

**日志体系**:传统 `/var/log`(syslog/messages;应用日志常在这)——现代发行版用 **journald**:`journalctl`(看系统与应用日志:`-u 服务名` 按服务、`-f` 跟随、`--since "1 hour ago"` 时间段、`-p err` 按级别);**logrotate(日志轮转,不配会写满磁盘)**:按天/大小切分+压缩+保留份数(`/etc/logrotate.d/` 下写配置);**定时任务 cron(运维自动化第一课)**:`crontab -e` 编辑当前用户任务,**五段语法:分 时 日 月 周**(`0 2 * * *` = 每天凌晨 2 点);**坑**:cron 环境是精简的(脚本里 PATH 要写全/用绝对路径)、输出重定向到日志(`>> /var/log/xxx.log 2>&1`)否则静默失败;**排查**:`grep CRON /var/log/syslog` 看有没有跑;systemd timer(现代替代 cron,进阶)。**常用定时场景**:备份、日志清理、监控脚本、数据同步。

## 第八站:Shell 脚本——自动化的第一层

**写脚本的基本功**:首行 `#!/bin/bash` + `chmod +x`;变量(`name="x"` 取值 `$name`;位置参数 `$1/$2`、`$?` 退出码(0=成功)——**判断上一条命令成败的标准姿势**、`$#` 参数个数);**set -euo pipefail(现代脚本的"安全带":出错即停+变量必定义+管道失败即失败)——新手脚本最常见的毛病是"错了还继续跑"**;条件:`if [ -f file ]`/`[ -z "$var" ]`(空判断,变量要加引号)/`[[ ]]`(增强版);`&&`/`||` 短路(`mkdir -p x && cd x`);循环:`for f in *.log; do ...; done`、`while read line`(逐行处理文件);函数;`set -x`(调试跟踪)。**学完能写**:备份脚本(打包+rsync+清理旧备份)、健康检查脚本(检查端口/进程/磁盘,异常告警)、批量部署脚本——**脚本是第一层自动化;机器多了上 Ansible(见第十站)**。

## 第九站:监控与性能排障

**体检命令全家**(服务器"慢/卡"的排查路径):①`uptime`(看负载——先确认是不是真高);②`top`/`htop`(找 CPU/内存大户——进程级);③`free -h`(内存:**看 available 而不是 free**;swap 使用涨 = 内存紧张);④`vmstat 1`(CPU/IO 队列:r 列高=CPU 忙、wa 高=磁盘慢);⑤`iostat`/`iotop`(磁盘 IO——**数据库服务器 wa 高先查慢查询与磁盘**);⑥`dmesg -T | tail`(内核日志:OOM killer/磁盘错误——**内存不够被内核杀进程(OOM)要看这里**);⑦`ss -s`/网络;⑧查应用日志(journalctl/应用日志)。
**进阶**:`ulimit -n`(文件描述符限制——**高并发服务"too many open files"的答案:调大 ulimit + 系统 limits.conf**)、`sysctl`(内核参数:网络缓冲区等,按官方文档调,别抄博客);`perf`/`strace`(进阶剖析——strace 跟系统调用,排"程序卡在哪"的终极手段)。

## 第十站:安全加固与自动化运维

**安全基线清单(新服务器上线必过)**:①SSH:密钥登录、禁 root 直登、可换非默认端口(防扫描噪音);②防火墙(ufw/firewalld:**默认拒绝+只开 22/80/443**;云服务器还要配安全组=云防火墙,两层都要);③fail2ban(防暴力破解,自动封 IP);④系统更新(安全补丁定期);⑤**最小权限:应用专属账号、sudo 白名单、文件权限收紧(密钥 600/配置不 world-readable)**;⑥SELinux/AppArmor(强制访问控制——**别一上来就 setenforce 0**,遇到权限问题先学会看审计日志);⑦备份(数据库/配置定期+异地,见 [备份](/learning-paths/database/mysql) 与 [Docker](/learning-paths/devops/docker) 卷)。
**自动化运维**:单机 Shell 脚本 → **多机 Ansible(无代理、基于 SSH:Inventory 管理主机清单、Playbook(YAML 声明"目标状态":装包/改配置/起服务——幂等,跑多次结果一致)、Ad-hoc 批量执行命令)**——**"配置管理"的入门标准答案**:把"手工 SSH 上去敲命令"升级成"写一次 playbook 到处跑";再往上:云平台 IaC(Terraform,见 [云原生](/learning-paths/cloud-native/cloud-native-patterns))、容器化([Docker](/learning-paths/devops/docker) 与 [Kubernetes](/learning-paths/devops/kubernetes))。
**故障排查综合演练(把本页串起来)**:网站打不开 → curl 本机(服务活?)→ ss -tlnp(端口在?)→ systemctl status(挂了看 journalctl)→ 磁盘满?(df)→ 内存/负载?(free/top)→ 防火墙?(ufw status)→ 一层层缩小——**这套"分层定位"的思路比任何单条命令都值钱**。

## 通关标准

能独立做到:在陌生服务器上 10 分钟内完成"体检"(负载/内存/磁盘/端口/日志)并说出结论;用管道组合(awk/sort/uniq/grep)从访问日志统计出 Top IP 与错误分布;给应用写 systemd 服务并配好日志查看与开机自启;写一个带 set -euo pipefail 的备份/健康检查脚本并挂进 crontab;完成 SSH 密钥+禁 root+防火墙的新服务器加固;能讲清"服务器慢"的排查路径(负载→进程→IO→日志)——Linux 主线通关。

Linux 是"现代基础设施的通用语":数据库、容器、CI/CD、云,所有上层技术最终都落在"一台 Linux 上的进程与文件"。它没有捷径——**命令靠用熟,排障靠踩坑**,但骨架(本页的十站)可以快速搭起来:剩下的交给真实服务器。别怕黑屏与报错,`man` 和搜索引擎是你的老师,`/var/log` 里全是答案;折腾坏一台测试机,比读十本教程都值。下一步:[Docker](/learning-paths/devops/docker) 容器化,或补 [操作系统理论](/learning-paths/cs-basics/operating-systems) 知其所以然。
