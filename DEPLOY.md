# GitHub Actions 部署配置指南

本项目使用 GitHub Actions 自动部署到服务器。

## 配置步骤

### 1. 生成 SSH 密钥对

在本地终端执行：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/coder_path_deploy
```

### 2. 配置服务器

将公钥添加到服务器：

```bash
# 方法 1：使用 ssh-copy-id
ssh-copy-id -i ~/.ssh/coder_path_deploy.pub your-user@your-server.com

# 方法 2：手动添加
cat ~/.ssh/coder_path_deploy.pub
# 复制输出内容，登录服务器后添加到 ~/.ssh/authorized_keys
```

确保服务器上的部署目录存在且有写入权限：

```bash
mkdir -p /var/www/coder-path
chown your-user:your-group /var/www/coder-path
```

### 3. 配置 GitHub Secrets

在 GitHub 仓库页面：`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

添加以下 4 个 secrets：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `SSH_PRIVATE_KEY` | SSH 私钥（完整内容） | `cat ~/.ssh/coder_path_deploy` 的输出 |
| `REMOTE_HOST` | 服务器地址 | `example.com` 或 `192.168.1.100` |
| `REMOTE_USER` | SSH 用户名 | `root` 或 `ubuntu` |
| `DEPLOY_PATH` | 部署目标路径 | `/var/www/coder-path` 或 `/home/user/website` |

**注意**：`SSH_PRIVATE_KEY` 需要包含完整的私钥内容，包括开头的 `-----BEGIN OPENSSH PRIVATE KEY-----` 和结尾的 `-----END OPENSSH PRIVATE KEY-----`。

### 4. 配置 Nginx（可选）

如果使用 Nginx 作为 Web 服务器，参考配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/coder-path;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

重启 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 部署流程

1. 推送代码到 `master` 分支
2. GitHub Actions 自动触发
3. 安装依赖并构建项目
4. 通过 SSH 部署到服务器
5. 完成！访问你的域名查看站点

## 手动触发部署

在 GitHub 仓库页面：`Actions` → `Deploy VitePress` → `Run workflow` → 选择 `master` 分支 → `Run workflow`

## 故障排查

### SSH 连接失败

- 检查 `SSH_PRIVATE_KEY` 格式是否正确（包含开头和结尾）
- 确认服务器防火墙允许 SSH 连接（22 端口）
- 验证公钥是否正确添加到服务器

### 部署路径权限问题

```bash
# 在服务器上执行
ls -ld /var/www/coder-path
# 确保用户有写入权限
```

### 查看部署日志

在 GitHub 仓库的 `Actions` 标签页查看详细的构建和部署日志。
