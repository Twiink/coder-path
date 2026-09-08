import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'CoderPath',
  description: '软件开发学习路线与实战笔记',
  base: '/',
  appearance: false,
  // 文档骨架仍在补充中，暂不因尚未落地的占位链接阻断静态站构建。
  ignoreDeadLinks: true,

  // 设置默认语言
  lang: 'zh-CN',

  themeConfig: {
    logo: '/images/coderpath-rocket-pixel.png',
    siteTitle: 'CoderPath',

    // 顶部导航栏
    nav: [
      { text: '首页', link: '/' },
      { text: '学习路线', link: '/learning-paths/' },
      { text: '技术栈', link: '/study-notes/' },
      { text: '开发笔记', link: '/features/' },
      { text: '项目实战', link: '/projects/' },
      { text: '关于', link: '/guide/' }
    ],

    // 侧边栏配置
    sidebar: {
      '/learning-paths/': [
        {
          text: '学习路线',
          items: [
            { text: '概述', link: '/learning-paths/' },
            {
              text: '前端开发',
              collapsed: false,
              items: [
                { text: 'JavaScript 学习路线', link: '/learning-paths/frontend/javascript' },
                { text: 'TypeScript 学习路线', link: '/learning-paths/frontend/typescript' },
                { text: 'Vue 学习路线', link: '/learning-paths/frontend/vue' },
                { text: 'React 学习路线', link: '/learning-paths/frontend/react' }
              ]
            },
            {
              text: '后端开发',
              collapsed: false,
              items: [
                { text: 'Django 学习路线', link: '/learning-paths/backend/django' },
                { text: 'Node.js 学习路线', link: '/learning-paths/backend/nodejs' },
                { text: 'Spring Boot 学习路线', link: '/learning-paths/backend/springboot' }
              ]
            },
            {
              text: '全栈开发',
              collapsed: false,
              items: [
                { text: '全栈路线图', link: '/learning-paths/fullstack/' }
              ]
            },
            {
              text: '移动端开发',
              collapsed: false,
              items: [
                { text: '移动端路线图', link: '/learning-paths/mobile/' }
              ]
            },
            {
              text: 'DevOps',
              collapsed: false,
              items: [
                { text: 'DevOps 学习路线', link: '/learning-paths/devops/' }
              ]
            }
          ]
        }
      ],

      '/study-notes/': [
        {
          text: '学习笔记',
          items: [
            { text: '概述', link: '/study-notes/' },
            {
              text: 'JavaScript',
              collapsed: false,
              items: [
                { text: '基础知识', link: '/study-notes/javascript/' }
              ]
            },
            {
              text: 'TypeScript',
              collapsed: false,
              items: [
                { text: '基础知识', link: '/study-notes/typescript/' }
              ]
            },
            {
              text: 'Vue',
              collapsed: false,
              items: [
                { text: '基础知识', link: '/study-notes/vue/' }
              ]
            },
            {
              text: 'React',
              collapsed: false,
              items: [
                { text: '基础知识', link: '/study-notes/react/' }
              ]
            },
            {
              text: 'Django',
              collapsed: false,
              items: [
                { text: '基础知识', link: '/study-notes/django/' }
              ]
            },
            {
              text: 'Node.js',
              collapsed: false,
              items: [
                { text: '基础知识', link: '/study-notes/nodejs/' }
              ]
            },
            {
              text: '数据库',
              collapsed: false,
              items: [
                { text: 'MySQL', link: '/study-notes/database/mysql' },
                { text: 'PostgreSQL', link: '/study-notes/database/postgresql' },
                { text: 'MongoDB', link: '/study-notes/database/mongodb' },
                { text: 'Redis', link: '/study-notes/database/redis' }
              ]
            }
          ]
        }
      ],

      '/standards/': [
        {
          text: '开发规范',
          items: [
            { text: '概述', link: '/standards/' },
            {
              text: '代码规范',
              collapsed: false,
              items: [
                { text: 'JavaScript/TypeScript 规范', link: '/standards/code/javascript' },
                { text: 'Python 规范', link: '/standards/code/python' },
                { text: 'CSS 规范', link: '/standards/code/css' }
              ]
            },
            {
              text: 'Git 规范',
              collapsed: false,
              items: [
                { text: 'Git 工作流', link: '/standards/git/workflow' },
                { text: 'Commit 规范', link: '/standards/git/commit' },
                { text: '分支管理', link: '/standards/git/branch' }
              ]
            },
            {
              text: 'API 规范',
              collapsed: false,
              items: [
                { text: 'RESTful API', link: '/standards/api/restful' },
                { text: 'GraphQL', link: '/standards/api/graphql' }
              ]
            },
            {
              text: '数据库规范',
              collapsed: false,
              items: [
                { text: '表设计规范', link: '/standards/database/table-design' },
                { text: '索引优化', link: '/standards/database/index' }
              ]
            },
            {
              text: '架构规范',
              collapsed: false,
              items: [
                { text: '项目结构', link: '/standards/architecture/structure' },
                { text: '文档规范', link: '/standards/architecture/documentation' }
              ]
            }
          ]
        }
      ],

      '/templates/': [
        {
          text: '模板库',
          items: [
            { text: '概述', link: '/templates/' },
            {
              text: '项目模板',
              collapsed: false,
              items: [
                { text: 'Vue 项目模板', link: '/templates/project/vue' },
                { text: 'Django 项目模板', link: '/templates/project/django' },
                { text: 'Node.js 项目模板', link: '/templates/project/nodejs' }
              ]
            },
            {
              text: '代码片段',
              collapsed: false,
              items: [
                { text: '常用工具函数', link: '/templates/snippets/utils' },
                { text: 'Vue 组件模板', link: '/templates/snippets/vue-components' },
                { text: 'React Hooks', link: '/templates/snippets/react-hooks' }
              ]
            },
            {
              text: '配置文件',
              collapsed: false,
              items: [
                { text: 'ESLint 配置', link: '/templates/config/eslint' },
                { text: 'TypeScript 配置', link: '/templates/config/typescript' },
                { text: 'Vite 配置', link: '/templates/config/vite' },
                { text: 'Webpack 配置', link: '/templates/config/webpack' }
              ]
            }
          ]
        }
      ],

      '/projects/': [
        {
          text: '实战项目',
          items: [
            { text: '概述', link: '/projects/' },
            {
              text: '项目示例',
              collapsed: false,
              items: [
                { text: '博客系统', link: '/projects/examples/blog' },
                { text: '电商平台', link: '/projects/examples/ecommerce' },
                { text: '后台管理系统', link: '/projects/examples/admin' }
              ]
            },
            {
              text: '案例分析',
              collapsed: false,
              items: [
                { text: '架构设计', link: '/projects/case-studies/architecture' },
                { text: '性能优化', link: '/projects/case-studies/performance' },
                { text: '技术选型', link: '/projects/case-studies/tech-stack' }
              ]
            }
          ]
        }
      ],

      '/troubleshooting/': [
        {
          text: '问题解决',
          items: [
            { text: '概述', link: '/troubleshooting/' },
            {
              text: 'Bug 记录',
              collapsed: false,
              items: [
                { text: '前端问题', link: '/troubleshooting/bugs/frontend' },
                { text: '后端问题', link: '/troubleshooting/bugs/backend' },
                { text: '部署问题', link: '/troubleshooting/bugs/deployment' }
              ]
            },
            {
              text: '解决方案',
              collapsed: false,
              items: [
                { text: '常见问题汇总', link: '/troubleshooting/solutions/common' },
                { text: '性能问题', link: '/troubleshooting/solutions/performance' }
              ]
            },
            {
              text: '调试技巧',
              collapsed: false,
              items: [
                { text: '前端调试', link: '/troubleshooting/debugging/frontend' },
                { text: '后端调试', link: '/troubleshooting/debugging/backend' }
              ]
            }
          ]
        }
      ],

      '/features/': [
        {
          text: '功能实现',
          items: [
            { text: '概述', link: '/features/' },
            {
              text: '第三方集成',
              collapsed: false,
              items: [
                { text: '微信支付', link: '/features/integrations/wechat-pay' },
                { text: '支付宝支付', link: '/features/integrations/alipay' },
                { text: '短信服务', link: '/features/integrations/sms' },
                { text: '邮件服务', link: '/features/integrations/email' },
                { text: 'OSS 对象存储', link: '/features/integrations/oss' }
              ]
            },
            {
              text: '常用功能',
              collapsed: false,
              items: [
                { text: '用户认证', link: '/features/common/authentication' },
                { text: '权限管理', link: '/features/common/authorization' },
                { text: '文件上传', link: '/features/common/file-upload' },
                { text: '数据导出', link: '/features/common/data-export' }
              ]
            },
            {
              text: '最佳实践',
              collapsed: false,
              items: [
                { text: '缓存策略', link: '/features/best-practices/caching' },
                { text: '安全防护', link: '/features/best-practices/security' },
                { text: '日志管理', link: '/features/best-practices/logging' }
              ]
            }
          ]
        }
      ],

      '/toolbox/': [
        {
          text: '工具箱',
          items: [
            { text: '概述', link: '/toolbox/' },
            {
              text: '开发工具',
              collapsed: false,
              items: [
                { text: 'VS Code 配置', link: '/toolbox/dev-tools/vscode' },
                { text: 'Git 工具', link: '/toolbox/dev-tools/git' },
                { text: 'Chrome DevTools', link: '/toolbox/dev-tools/chrome' }
              ]
            },
            {
              text: '效率工具',
              collapsed: false,
              items: [
                { text: '快捷键大全', link: '/toolbox/efficiency/shortcuts' },
                { text: 'CLI 工具推荐', link: '/toolbox/efficiency/cli' },
                { text: '在线工具集', link: '/toolbox/efficiency/online' }
              ]
            },
            {
              text: '调试技巧',
              collapsed: false,
              items: [
                { text: '断点调试', link: '/toolbox/debugging/breakpoint' },
                { text: '性能分析', link: '/toolbox/debugging/performance' },
                { text: '网络抓包', link: '/toolbox/debugging/network' }
              ]
            }
          ]
        }
      ]
    },

    // 搜索配置
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换'
            }
          }
        }
      }
    },

    // 页面配置
    outline: {
      level: [2, 3],
      label: '页面导航'
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium'
      }
    },

    // 社交链接
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Twiink/coder-path' }
    ],

    // 页脚
    footer: {
      message: '用心记录每一步成长',
      copyright: 'Copyright © 2024-present Twiink'
    },

    // 编辑链接
    editLink: {
      pattern: 'https://github.com/Twiink/coder-path/edit/master/docs/:path',
      text: '在 GitHub 上编辑此页面'
    }
  },

  // Markdown 配置
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  },

  // 头部配置
  head: [
    ['link', { rel: 'icon', href: '/coder-path/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }]
  ]
})
