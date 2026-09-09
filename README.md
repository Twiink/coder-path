# Coder Path - 软件开发学习路线

> 系统化的软件开发学习路线与实战笔记，记录每一步成长。

## 项目简介

Coder Path 是一个专注于软件开发学习的知识库网站，提供系统化的学习路线、详细的学习笔记、开发规范、项目模板、实战案例等内容，帮助开发者更高效地学习和成长。

## 核心板块

### 学习路线
系统化的技术学习路径，涵盖前端、后端、全栈、移动端、DevOps 等多个方向。

### 学习笔记
各技术栈的学习笔记和知识点整理，包括 JavaScript、TypeScript、Vue、React、Django、Node.js、数据库等。

### 开发规范
代码规范、Git 规范、API 设计规范、数据库设计规范等最佳实践指南。

### 模板库
项目脚手架模板、常用代码片段、标准化配置文件，开箱即用。

### 实战项目
完整的项目实战文档，包括博客系统、电商平台、后台管理系统等，涵盖从需求分析到部署上线的全流程。

### 问题解决
记录开发过程中遇到的 Bug、排查过程和解决方案，以及调试技巧。

### 功能实现
常见功能的完整实现方案，如微信支付接入、用户认证、权限管理、文件上传等。

### 工具箱
开发工具推荐、IDE 配置、CLI 工具、在线工具集、调试技巧等效率提升内容。

## 项目结构

```
docs/
├── .vitepress/          # VitePress 配置
│   └── config.ts        # 站点配置文件
├── learning-paths/      # 学习路线
│   ├── frontend/        # 前端路线
│   ├── backend/         # 后端路线
│   ├── fullstack/       # 全栈路线
│   ├── mobile/          # 移动端路线
│   └── devops/          # DevOps 路线
├── study-notes/         # 学习笔记
│   ├── javascript/      # JavaScript 笔记
│   ├── typescript/      # TypeScript 笔记
│   ├── vue/            # Vue 笔记
│   ├── react/          # React 笔记
│   ├── django/         # Django 笔记
│   ├── nodejs/         # Node.js 笔记
│   └── database/       # 数据库笔记
├── standards/          # 开发规范
│   ├── code/          # 代码规范
│   ├── git/           # Git 规范
│   ├── api/           # API 规范
│   ├── database/      # 数据库规范
│   └── architecture/  # 架构规范
├── templates/         # 模板库
│   ├── project/       # 项目模板
│   ├── snippets/      # 代码片段
│   └── config/        # 配置文件
├── projects/          # 实战项目
│   ├── examples/      # 项目示例
│   └── case-studies/ # 案例分析
├── troubleshooting/   # 问题解决
│   ├── bugs/         # Bug 记录
│   ├── solutions/    # 解决方案
│   └── debugging/    # 调试技巧
├── features/          # 功能实现
│   ├── integrations/  # 第三方集成
│   ├── common/       # 常用功能
│   └── best-practices/ # 最佳实践
└── toolbox/           # 工具箱
    ├── dev-tools/     # 开发工具
    ├── efficiency/    # 效率工具
    └── debugging/     # 调试工具
```

## 快速开始

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/Twiink/coder-path.git

# 进入项目目录
cd coder-path

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

访问 `http://localhost:5173` 即可查看网站。

## 部署配置

本项目使用 GitHub Actions 自动部署到服务器。需要配置以下 Secrets：

- `SSH_PRIVATE_KEY`: SSH 私钥
- `REMOTE_HOST`: 服务器地址
- `REMOTE_USER`: 服务器用户名
- `DEPLOY_PATH`: 部署路径
- `SSH_PORT`: SSH 端口（如果不是默认的 22 端口）

## 内容贡献

欢迎贡献内容！你可以：

1. **补充文档**：完善已有文档或添加新的技术栈
2. **分享经验**：记录你的开发经验和踩坑总结
3. **提供模板**：分享你的项目模板或代码片段
4. **报告问题**：发现错误或不当之处请提 Issue

### 贡献流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 技术栈

- **框架**：[VitePress](https://vitepress.dev/) - 基于 Vite 和 Vue 的静态站点生成器
- **部署**：GitHub Actions + 服务器部署
- **语言**：Markdown + TypeScript

## License

MIT License - 详见 [LICENSE](LICENSE) 文件

## 鸣谢

感谢所有为本项目贡献内容的开发者！

## 联系方式

- GitHub: [@Twiink](https://github.com/Twiink)
- 项目地址: [https://github.com/Twiink/coder-path](https://github.com/Twiink/coder-path)
- 在线访问: [https://twiink.github.io/coder-path](https://twiink.github.io/coder-path)

---

<div align="center">
  <sub>用心记录每一步成长 · 让学习更高效 · 让开发更简单</sub>
</div>
