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

  // 构建优化
  vite: {
    build: {
      // 代码压缩选项
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true, // 生产环境移除 console
          drop_debugger: true,
          pure_funcs: ['console.log'], // 移除 console.log
          passes: 2 // 多次压缩以获得更好效果
        },
        format: {
          comments: false // 移除注释
        }
      },
      // 启用 CSS 代码分割
      cssCodeSplit: true,
      // 设置 chunk 大小警告限制（提高以避免过多警告）
      chunkSizeWarningLimit: 2000,
      // 资源内联限制（小于 4KB 的资源内联为 base64）
      assetsInlineLimit: 4096,
      // 生成 source map（生产环境可关闭）
      sourcemap: false
    },
    // 优化依赖预构建
    optimizeDeps: {
      include: ['vue'],
      exclude: ['vitepress']
    },
    // CSS 优化
    css: {
      devSourcemap: false
    }
  },

  themeConfig: {
    logo: '/images/coderpath-c-icon.png',
    siteTitle: 'CoderPath',

    // 顶部导航栏
    nav: [
      { text: '首页', link: '/' },
      { text: '学习路线', link: '/learning-paths/' },
      { text: '技术栈', link: '/study-notes/' },
      { text: '开发笔记', link: '/guide/' },
      { text: '项目实战', link: '/projects/' },
      { text: '关于', link: '/guide/' },
      {
        text: '更多',
        items: [
          { text: '功能开发文档', link: '/features/' },
          { text: '捉虫小队', link: '/troubleshooting/' },
          { text: '面试 BOSS 攻略', link: '/interview/' },
          { text: '村口公告栏', link: '/guide/' },
          { text: '装备背包', link: '/toolbox/' },
          { text: '图纸工坊', link: '/templates/' },
          { text: '村规民约', link: '/standards/' }
        ]
      }
    ],

    // 侧边栏配置
    sidebar: {
      '/learning-paths/': [
        {
          text: '升级路线图',
          items: [
            { text: '概述', link: '/learning-paths/' },

            // ── 方向路线：按职业方向划分的核心学习路径 ──
            {
              text: '方向路线',
              collapsed: false,
              items: [
                // 全栈是跨前/后端、数据库与部署的综合路线，紧跟概述作为总览入口
                {
                  text: '全栈开发',
                  collapsed: false,
                  items: [
                    { text: '路线总览', link: '/learning-paths/fullstack/overview' },
                    { text: 'JavaScript 全栈', link: '/learning-paths/fullstack/javascript' },
                    { text: 'Python 全栈', link: '/learning-paths/fullstack/python' },
                    { text: 'Java 全栈', link: '/learning-paths/fullstack/java' },
                    { text: 'Go 全栈', link: '/learning-paths/fullstack/go' },
                    { text: '前后端协作', link: '/learning-paths/fullstack/collaboration' },
                    { text: '性能优化', link: '/learning-paths/fullstack/performance' },
                    { text: '测试', link: '/learning-paths/fullstack/testing' },
                    { text: '部署与监控', link: '/learning-paths/fullstack/deployment' }
                  ]
                },
                {
                  text: '前端开发',
                  collapsed: false,
                  items: [
                    { text: 'HTML & CSS', link: '/learning-paths/frontend/html-css' },
                    { text: 'JavaScript', link: '/learning-paths/frontend/javascript' },
                    { text: 'TypeScript', link: '/learning-paths/frontend/typescript' },
                    { text: 'Vue.js', link: '/learning-paths/frontend/vue' },
                    { text: 'React', link: '/learning-paths/frontend/react' },
                    { text: 'Angular', link: '/learning-paths/frontend/angular' },
                    { text: 'Svelte', link: '/learning-paths/frontend/svelte' },
                    { text: 'Next.js', link: '/learning-paths/frontend/nextjs' },
                    { text: 'Nuxt.js', link: '/learning-paths/frontend/nuxtjs' },
                    { text: 'Tailwind CSS', link: '/learning-paths/frontend/tailwind' },
                    { text: 'Vite', link: '/learning-paths/frontend/vite' },
                    { text: 'Webpack', link: '/learning-paths/frontend/webpack' }
                  ]
                },
                {
                  text: '后端开发',
                  collapsed: false,
                  items: [
                    { text: 'Node.js', link: '/learning-paths/backend/nodejs' },
                    { text: 'Nest.js', link: '/learning-paths/backend/nestjs' },
                    { text: 'Django', link: '/learning-paths/backend/django' },
                    { text: 'Flask', link: '/learning-paths/backend/flask' },
                    { text: 'FastAPI', link: '/learning-paths/backend/fastapi' },
                    { text: 'Spring Boot', link: '/learning-paths/backend/spring-boot' },
                    { text: 'Go + Gin', link: '/learning-paths/backend/golang' },
                    { text: 'Laravel', link: '/learning-paths/backend/laravel' },
                    { text: 'Rust Web', link: '/learning-paths/backend/rust-web' }
                  ]
                },
                {
                  text: 'AI 开发',
                  collapsed: false,
                  items: [
                    { text: 'AI Agent 基础', link: '/learning-paths/ai/agent-basics' },
                    { text: 'AI Agent 开发', link: '/learning-paths/ai/agent-development' },
                    { text: '自主 Agent', link: '/learning-paths/ai/autonomous-agents' },
                    { text: 'Prompt Engineering', link: '/learning-paths/ai/prompt-engineering' },
                    { text: 'LangChain', link: '/learning-paths/ai/langchain' },
                    { text: 'LlamaIndex', link: '/learning-paths/ai/llamaindex' },
                    { text: 'RAG 系统', link: '/learning-paths/ai/rag-systems' },
                    { text: '向量数据库', link: '/learning-paths/ai/vector-databases' },
                    { text: 'Claude API', link: '/learning-paths/ai/claude-api' },
                    { text: 'Claude MCP', link: '/learning-paths/ai/claude-mcp' }
                  ]
                },
                {
                  text: '移动端开发',
                  collapsed: false,
                  items: [
                    { text: '路线总览', link: '/learning-paths/mobile/overview' },
                    { text: 'Android 原生', link: '/learning-paths/mobile/android-native' },
                    { text: 'iOS 原生', link: '/learning-paths/mobile/ios-native' },
                    { text: 'React Native', link: '/learning-paths/mobile/react-native' },
                    { text: 'Flutter', link: '/learning-paths/mobile/flutter' },
                    { text: 'uni-app', link: '/learning-paths/mobile/uniapp' },
                    { text: '微信小程序', link: '/learning-paths/mobile/wechat-miniprogram' }
                  ]
                },
                {
                  text: '桌面端开发',
                  collapsed: false,
                  items: [
                    { text: '路线总览', link: '/learning-paths/desktop/overview' },
                    { text: 'Electron', link: '/learning-paths/desktop/electron' },
                    { text: 'Tauri', link: '/learning-paths/desktop/tauri' },
                    { text: 'Flutter Desktop', link: '/learning-paths/desktop/flutter-desktop' }
                  ]
                }
              ]
            },

            // ── 通用基础：各方向共用的横向技能 ──
            {
              text: '通用基础',
              collapsed: true,
              items: [
                // 计算机科学四大基石：不绑定任何技术栈的内功心法
                {
                  text: '计算机科学基础',
                  collapsed: false,
                  items: [
                    { text: '数据结构与算法', link: '/learning-paths/cs-basics/data-structures-algorithms' },
                    { text: '计算机组成原理', link: '/learning-paths/cs-basics/computer-organization' },
                    { text: '操作系统', link: '/learning-paths/cs-basics/operating-systems' },
                    { text: '计算机网络', link: '/learning-paths/cs-basics/computer-networks' }
                  ]
                },
                {
                  text: '编程语言',
                  collapsed: false,
                  // JavaScript/TypeScript/Go/Rust 的语言路线由各自技术栈页承载（前端/后端），此处汇总全部语言入口
                  items: [
                    { text: 'Java', link: '/learning-paths/languages/java' },
                    { text: 'JavaScript', link: '/learning-paths/frontend/javascript' },
                    { text: 'TypeScript', link: '/learning-paths/frontend/typescript' },
                    { text: 'Python', link: '/learning-paths/languages/python' },
                    { text: 'Go', link: '/learning-paths/backend/golang' },
                    { text: 'C++', link: '/learning-paths/languages/cpp' },
                    { text: 'C#', link: '/learning-paths/languages/csharp' },
                    { text: 'Rust', link: '/learning-paths/backend/rust-web' },
                    { text: 'PHP', link: '/learning-paths/languages/php' },
                    { text: 'Ruby', link: '/learning-paths/languages/ruby' },
                    { text: 'Swift', link: '/learning-paths/languages/swift' },
                    { text: 'Kotlin', link: '/learning-paths/languages/kotlin' }
                  ]
                },
                {
                  text: '工具与工作流',
                  collapsed: false,
                  items: [
                    { text: 'Git 版本控制', link: '/learning-paths/tools/git' },
                    { text: 'VS Code', link: '/learning-paths/tools/vscode' },
                    { text: '终端效率', link: '/learning-paths/tools/terminal' },
                    { text: 'Claude Code', link: '/learning-paths/tools/claude-code' }
                  ]
                },
                {
                  text: '构建工具',
                  collapsed: false,
                  items: [
                    { text: 'Maven', link: '/learning-paths/build-tools/maven' },
                    { text: 'Gradle', link: '/learning-paths/build-tools/gradle' },
                    { text: 'Make', link: '/learning-paths/build-tools/make' }
                  ]
                },
                {
                  text: '测试框架',
                  collapsed: false,
                  items: [
                    { text: 'Jest', link: '/learning-paths/testing/jest' },
                    { text: 'Pytest', link: '/learning-paths/testing/pytest' },
                    { text: 'JUnit', link: '/learning-paths/testing/junit' },
                    { text: 'Selenium', link: '/learning-paths/testing/selenium' },
                    { text: 'Cypress', link: '/learning-paths/testing/cypress' }
                  ]
                },
                {
                  text: '安全',
                  collapsed: false,
                  items: [
                    { text: 'Web 安全', link: '/learning-paths/security/web-security' },
                    { text: '认证授权', link: '/learning-paths/security/auth' },
                    { text: '密码学', link: '/learning-paths/security/cryptography' }
                  ]
                }
              ]
            },

            // ── 架构进阶：面向深入与大型系统的主题 ──
            {
              text: '架构进阶',
              collapsed: true,
              items: [
                {
                  text: '数据库',
                  collapsed: false,
                  items: [
                    { text: 'MySQL', link: '/learning-paths/database/mysql' },
                    { text: 'PostgreSQL', link: '/learning-paths/database/postgresql' },
                    { text: 'MongoDB', link: '/learning-paths/database/mongodb' },
                    { text: 'Redis', link: '/learning-paths/database/redis' }
                  ]
                },
                {
                  text: '中间件',
                  collapsed: false,
                  items: [
                    { text: 'Kafka', link: '/learning-paths/middleware/kafka' },
                    { text: 'RabbitMQ', link: '/learning-paths/middleware/rabbitmq' },
                    { text: 'RocketMQ', link: '/learning-paths/middleware/rocketmq' },
                    { text: 'Redis 深入', link: '/learning-paths/middleware/redis-advanced' },
                    { text: 'Elasticsearch', link: '/learning-paths/middleware/elasticsearch' },
                    { text: 'Nginx', link: '/learning-paths/middleware/nginx' },
                    { text: 'ZooKeeper', link: '/learning-paths/middleware/zookeeper' },
                    { text: 'etcd', link: '/learning-paths/middleware/etcd' }
                  ]
                },
                {
                  text: '微服务架构',
                  collapsed: false,
                  items: [
                    { text: '微服务设计模式', link: '/learning-paths/microservices/microservices-patterns' },
                    { text: 'API 网关', link: '/learning-paths/microservices/api-gateway' },
                    { text: 'Spring Cloud', link: '/learning-paths/microservices/spring-cloud' },
                    { text: 'Dubbo', link: '/learning-paths/microservices/dubbo' },
                    { text: 'Istio 服务网格', link: '/learning-paths/microservices/istio' }
                  ]
                },
                {
                  text: 'DevOps',
                  collapsed: false,
                  items: [
                    { text: 'Linux 系统管理', link: '/learning-paths/devops/linux' },
                    { text: 'Docker', link: '/learning-paths/devops/docker' },
                    { text: 'Kubernetes', link: '/learning-paths/devops/kubernetes' },
                    { text: 'GitHub Actions', link: '/learning-paths/devops/github-actions' },
                    { text: 'GitLab CI', link: '/learning-paths/devops/gitlab-ci' },
                    { text: 'Prometheus + Grafana', link: '/learning-paths/devops/monitoring' }
                  ]
                },
                {
                  text: '云原生',
                  collapsed: false,
                  items: [
                    { text: '云原生模式', link: '/learning-paths/cloud-native/cloud-native-patterns' },
                    { text: 'Serverless', link: '/learning-paths/cloud-native/serverless' },
                    { text: '服务网格', link: '/learning-paths/cloud-native/service-mesh' }
                  ]
                }
              ]
            }
          ]
        }
      ],

      '/study-notes/': [
        {
          text: '技能书',
          items: [
            { text: '概述', link: '/study-notes/' },
            {
              text: '前端',
              collapsed: false,
              items: [
                { text: 'React', link: '/study-notes/react/' }
              ]
            },
            {
              text: '后端',
              collapsed: false,
              items: [
                { text: 'Java', link: '/study-notes/java/' },
                { text: 'Java Web', link: '/study-notes/java-web/' },
                { text: 'JVM', link: '/study-notes/jvm/' },
                { text: 'Spring', link: '/study-notes/spring/' },
                { text: 'Spring Boot', link: '/study-notes/spring-boot/' },
                { text: 'MyBatis', link: '/study-notes/mybatis/' },
                { text: 'Go 与 Gin', link: '/study-notes/golang/' },
                { text: 'Python', link: '/study-notes/python/' },
                { text: 'Django', link: '/study-notes/django/' },
                { text: 'FastAPI', link: '/study-notes/fastapi/' }
              ]
            },
            {
              text: '数据库',
              collapsed: false,
              items: [
                { text: 'MySQL', link: '/study-notes/database/mysql/' },
                { text: 'PostgreSQL', link: '/study-notes/database/postgresql/' },
                { text: 'MongoDB', link: '/study-notes/database/mongodb/' },
                { text: 'Redis', link: '/study-notes/database/redis/' },
                { text: 'SQLite', link: '/study-notes/database/sqlite/' },
                { text: 'Oracle 与 SQL Server', link: '/study-notes/database/oracle-sqlserver/' }
              ]
            },
            {
              text: '中间件与消息队列',
              collapsed: false,
              items: [
                { text: '中间件（杂项）', link: '/study-notes/middleware/' },
                { text: 'Elasticsearch', link: '/study-notes/middleware/elasticsearch/' },
                { text: 'RabbitMQ', link: '/study-notes/middleware/rabbitmq/' },
                { text: 'Kafka', link: '/study-notes/middleware/kafka/' },
                { text: 'RocketMQ', link: '/study-notes/middleware/rocketmq/' },
                { text: 'ZooKeeper', link: '/study-notes/middleware/zookeeper/' },
                { text: 'etcd', link: '/study-notes/middleware/etcd/' }
              ]
            },
            {
              text: '微服务',
              collapsed: false,
              items: [
                { text: 'Spring Cloud', link: '/study-notes/microservices/spring-cloud/' }
              ]
            },
            {
              text: 'AI 与 Agent',
              collapsed: false,
              items: [
                { text: 'AI 与 Agent', link: '/study-notes/ai/' }
              ]
            }
          ]
        }
      ],

      '/standards/': [
        {
          text: '村规民约',
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
          text: '图纸工坊',
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
          text: '实战副本',
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
          text: '捉虫小队',
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

      '/interview/': [
        {
          text: '面试 BOSS 攻略',
          items: [
            { text: '板块概述', link: '/interview/' }
          ]
        }
      ],

      '/features/': [
        {
          text: '氪金功能屋',
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
          text: '装备背包',
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

    // 搜索配置 - 优化搜索索引
    search: {
      provider: 'local',
      options: {
        // 限制搜索结果数量以减小索引大小
        miniSearch: {
          searchOptions: {
            boost: { title: 4, text: 2, titles: 1 },
            fuzzy: 0.1,
            prefix: true
          },
          options: {
            // 减少索引字段
            fields: ['title', 'text'],
            storeFields: ['title'],
            // 优化分词
            tokenize: (text: string) => text.split(/[\s\-/]+/)
          }
        },
        // 排除不需要搜索的内容
        _render(src, env, md) {
          // 可以在这里自定义渲染逻辑
          return md.render(src, env)
        },
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
        dateStyle: 'short'
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
    }

    // 编辑链接已禁用
  },

  // Markdown 配置
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  },

  // 头部配置 - 添加预加载和资源提示
  head: [
    ['link', { rel: 'icon', href: '/images/coderpath-rocket-pixel.png' }],
    ['meta', { name: 'theme-color', content: '#2ca985' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
    // DNS 预解析
    ['link', { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' }],
    // 预加载关键资源
    ['link', { rel: 'preload', href: '/images/coderpath-c-icon.png', as: 'image' }]
  ],

  // 站点地图生成
  sitemap: {
    hostname: 'https://twiink.github.io/coder-path'
  }
})
