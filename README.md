# Coder Path

编程学习路径 - 系统化的编程学习指南

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run docs:dev
```

访问 http://localhost:5173 查看站点。

### 构建

```bash
npm run docs:build
```

构建产物将生成在 `docs/.vitepress/dist` 目录。

### 预览构建结果

```bash
npm run docs:preview
```

## GitHub Actions 部署配置

项目配置了自动化部署流程，当代码推送到 `master` 分支时会自动构建并部署到服务器。

### 需要配置的 GitHub Secrets

在 GitHub 仓库的 Settings -> Secrets and variables -> Actions 中添加以下 secrets：

1. **SSH_PRIVATE_KEY**: 服务器的 SSH 私钥
2. **REMOTE_HOST**: 服务器地址 (如: example.com 或 IP 地址)
3. **REMOTE_USER**: SSH 用户名 (如: root 或其他用户)
4. **DEPLOY_PATH**: 部署目标路径 (如: /var/www/html 或 /home/user/website)

### SSH 私钥配置说明

生成 SSH 密钥对（如果还没有）：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key
```

将公钥添加到服务器：

```bash
ssh-copy-id -i ~/.ssh/deploy_key.pub user@your-server.com
```

将私钥内容（`~/.ssh/deploy_key` 的完整内容）复制到 GitHub Secrets 的 `SSH_PRIVATE_KEY` 中。

## License

ISC