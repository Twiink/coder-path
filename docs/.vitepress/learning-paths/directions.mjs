import { group, page } from './model.mjs'

const published = (slug, title, navTitle, previousRoutes = []) =>
  page({ id: slug, slug, title, navTitle, status: 'published', previousRoutes })

const placeholder = (slug, navTitle, title = `${navTitle} 学习路线`) =>
  page({ id: slug, slug, title, navTitle, status: 'placeholder' })

export const directions = [
  group('frontend', '前端开发', [
    published('frontend/overview', '前端开发学习路线总览', '路线总览'),
    group('frontend-web-foundations', 'Web 平台基础', [
      published('frontend/html-css', 'HTML & CSS 学习路线', 'HTML & CSS'),
      placeholder('frontend/web-platform', 'Web 平台与浏览器'),
      placeholder('frontend/dom-events', 'DOM 与事件系统'),
      placeholder('frontend/network-storage', '网络请求与浏览器存储'),
      placeholder('frontend/accessibility', 'Web 可访问性'),
      placeholder('frontend/responsive-pwa', '响应式与 PWA'),
      placeholder('frontend/web-components', 'Web Components')
    ]),
    group('frontend-frameworks', 'UI 框架', [
      published('frontend/vue', 'Vue 学习路线', 'Vue'),
      published('frontend/react', 'React 学习路线', 'React'),
      published('frontend/angular', 'Angular 学习路线', 'Angular'),
      published('frontend/svelte', 'Svelte 学习路线', 'Svelte'),
      placeholder('frontend/solidjs', 'SolidJS'),
      placeholder('frontend/qwik', 'Qwik')
    ]),
    group('frontend-state-and-styling', '状态、数据与样式', [
      placeholder('frontend/state-management', '前端状态管理'),
      placeholder('frontend/redux-toolkit', 'Redux Toolkit'),
      placeholder('frontend/pinia', 'Pinia'),
      placeholder('frontend/tanstack-query', 'TanStack Query'),
      placeholder('frontend/rxjs', 'RxJS'),
      published('frontend/tailwind', 'Tailwind CSS 学习路线', 'Tailwind CSS')
    ])
  ]),
  group('backend', '后端开发', [
    published('backend/overview', '后端开发学习路线总览', '路线总览'),
    group('backend-foundations', '后端基础与 API', [
      placeholder('backend/foundations', '后端开发基础'),
      placeholder('backend/api-design', 'API 设计'),
      placeholder('backend/graphql', 'GraphQL'),
      placeholder('backend/grpc', 'gRPC'),
      placeholder('backend/data-access-orm', '数据访问与 ORM'),
      placeholder('backend/caching', '服务端缓存'),
      placeholder('backend/background-jobs', '后台任务'),
      placeholder('backend/realtime-websocket', '实时通信与 WebSocket')
    ]),
    group('backend-javascript', 'JavaScript / TypeScript', [
      published('backend/nodejs', 'Node.js 后端开发学习路线', 'Node.js'),
      placeholder('backend/deno', 'Deno'),
      placeholder('backend/bun', 'Bun'),
      placeholder('backend/express', 'Express'),
      placeholder('backend/fastify', 'Fastify'),
      placeholder('backend/hono', 'Hono'),
      published('backend/nestjs', 'NestJS 学习路线', 'NestJS')
    ]),
    group('backend-python', 'Python 生态', [
      published('backend/django', 'Django 学习路线', 'Django'),
      published('backend/flask', 'Flask 学习路线', 'Flask'),
      published('backend/fastapi', 'FastAPI 学习路线', 'FastAPI')
    ]),
    group('backend-jvm-dotnet', 'JVM 与 .NET', [
      published('backend/spring-boot', 'Spring Boot 学习路线', 'Spring Boot'),
      placeholder('backend/quarkus', 'Quarkus'),
      placeholder('backend/ktor', 'Ktor'),
      placeholder('backend/aspnet-core', 'ASP.NET Core')
    ]),
    group('backend-go-and-rust', 'Go 与 Rust', [
      published('backend/go-web', 'Go Web 开发学习路线', 'Go Web', ['/learning-paths/backend/golang']),
      placeholder('backend/fiber', 'Fiber'),
      published('backend/rust-web', 'Rust Web 开发学习路线', 'Rust Web'),
      placeholder('backend/axum', 'Axum'),
      placeholder('backend/actix-web', 'Actix Web')
    ]),
    group('backend-php-ruby-elixir', 'PHP、Ruby 与 Elixir', [
      published('backend/laravel', 'Laravel 学习路线', 'Laravel'),
      placeholder('backend/symfony', 'Symfony'),
      placeholder('backend/rails', 'Rails'),
      placeholder('backend/phoenix', 'Phoenix')
    ])
  ]),
  group('fullstack', '全栈开发', [
    published('fullstack/overview', '全栈开发学习路线总览', '路线总览'),
    group('fullstack-stacks', '技术栈路线', [
      published('fullstack/javascript', 'JavaScript 全栈开发学习路线', 'JavaScript 全栈'),
      published('fullstack/python', 'Python 全栈开发学习路线', 'Python 全栈'),
      published('fullstack/java', 'Java 全栈开发学习路线', 'Java 全栈'),
      published('fullstack/go', 'Go 全栈开发学习路线', 'Go 全栈')
    ]),
    group('fullstack-frameworks', '全栈 Web 框架', [
      published('fullstack/frameworks/nextjs', 'Next.js 学习路线', 'Next.js', ['/learning-paths/frontend/nextjs']),
      published('fullstack/frameworks/nuxt', 'Nuxt 学习路线', 'Nuxt', ['/learning-paths/frontend/nuxtjs']),
      placeholder('fullstack/frameworks/sveltekit', 'SvelteKit'),
      placeholder('fullstack/frameworks/react-router', 'React Router Framework Mode'),
      placeholder('fullstack/frameworks/astro', 'Astro')
    ]),
    group('fullstack-engineering', '工程实践', [
      published('fullstack/collaboration', '前后端协作学习路线', '前后端协作'),
      published('fullstack/performance', '全栈性能优化学习路线', '性能优化'),
      published('fullstack/testing', '全栈测试学习路线', '测试'),
      published('fullstack/deployment', '全栈部署与监控学习路线', '部署与监控'),
      placeholder('fullstack/monorepo', '全栈 Monorepo'),
      placeholder('fullstack/bff', 'BFF 架构')
    ])
  ]),
  group('ai', 'AI 应用开发', [
    published('ai/index', '生成式 AI 应用开发路线总览', '路线总览'),
    group('ai-foundations', '模型与应用基础', [
      published('ai/prompt-engineering', 'Prompt Engineering 学习路线', 'Prompt Engineering'),
      published('ai/model-api-overview', '模型 API 通用原理学习路线', '模型 API 通用原理'),
      placeholder('ai/structured-output-tools', '结构化输出与工具调用'),
      placeholder('ai/multimodal-realtime', '多模态与实时 AI'),
      placeholder('ai/fine-tuning', '模型微调')
    ]),
    group('ai-providers', '模型平台适配', [
      published('ai/openai-responses', 'OpenAI / Responses API 学习路线', 'OpenAI / Responses API'),
      published('ai/claude-api', 'Claude API 使用学习路线', 'Claude API'),
      published('ai/gemini-api', 'Google / Gemini API 学习路线', 'Google / Gemini API'),
      published('ai/open-source-local', '开源模型与本地推理学习路线', '开源模型与本地推理')
    ]),
    group('ai-rag', 'RAG 与知识库', [
      published('ai/rag-systems', 'RAG 系统构建学习路线', 'RAG 系统'),
      placeholder('ai/document-ingestion', '文档摄取与解析'),
      placeholder('ai/retrieval-reranking', '检索与重排序'),
      placeholder('ai/graph-rag', 'Graph RAG'),
      published('ai/llamaindex', 'LlamaIndex 框架学习路线', 'LlamaIndex')
    ]),
    group('ai-agents', 'Agent 系统', [
      published('ai/agent-basics', 'AI Agent 基础学习路线', 'AI Agent 基础'),
      published('ai/agent-development', 'AI Agent 开发进阶学习路线', 'AI Agent 开发'),
      published('ai/autonomous-agents', '自主 Agent 学习路线', '自主 Agent'),
      placeholder('ai/openai-agents-sdk', 'OpenAI Agents SDK'),
      published('ai/langchain', 'LangChain 框架学习路线', 'LangChain'),
      placeholder('ai/langgraph', 'LangGraph'),
      placeholder('ai/multi-agent-systems', '多 Agent 系统'),
      placeholder('ai/semantic-kernel', 'Semantic Kernel')
    ]),
    group('ai-protocols-and-coding', '协议与编码 Agent', [
      published('ai/mcp', 'MCP（模型上下文协议）学习路线', 'MCP 协议', ['/learning-paths/ai/claude-mcp']),
      placeholder('ai/a2a', 'A2A 协议'),
      published('ai/codex-platform', 'Codex SDK / App Server 学习路线', 'Codex SDK / App Server'),
      published('ai/codex-mcp', 'Codex MCP 兼容集成学习路线', 'Codex MCP 兼容集成')
    ]),
    group('ai-production', '生产工程', [
      placeholder('ai/evals', 'AI 评估'),
      placeholder('ai/observability', 'AI 可观测性'),
      placeholder('ai/safety-guardrails', 'AI 安全与护栏'),
      placeholder('ai/application-architecture', 'AI 应用架构')
    ])
  ]),
  group('mobile', '移动端开发', [
    published('mobile/overview', '移动端开发学习路线', '路线总览'),
    group('mobile-native', '原生开发', [
      published('mobile/android-native', 'Android 原生开发学习路线', 'Android 原生'),
      published('mobile/ios-native', 'iOS 原生开发学习路线', 'iOS 原生')
    ]),
    group('mobile-cross-platform', '跨平台与多端', [
      published('mobile/react-native', 'React Native 学习路线', 'React Native'),
      published('mobile/flutter', 'Flutter 学习路线', 'Flutter'),
      published('mobile/uniapp', 'uni-app 学习路线', 'uni-app'),
      published('mobile/wechat-miniprogram', '微信小程序学习路线', '微信小程序'),
      placeholder('mobile/expo', 'Expo'),
      placeholder('mobile/kotlin-multiplatform', 'Kotlin Multiplatform'),
      placeholder('mobile/dotnet-maui', '.NET MAUI'),
      placeholder('mobile/harmonyos', 'HarmonyOS')
    ]),
    group('mobile-engineering', '移动端工程', [
      placeholder('mobile/architecture', '移动端应用架构'),
      placeholder('mobile/offline-sync', '离线与同步'),
      placeholder('mobile/release-distribution', '发布与分发')
    ])
  ]),
  group('desktop', '桌面端开发', [
    published('desktop/overview', '桌面端开发学习路线', '路线总览'),
    group('desktop-frameworks', '桌面框架', [
      published('desktop/electron', 'Electron 学习路线', 'Electron'),
      published('desktop/tauri', 'Tauri 学习路线', 'Tauri'),
      published('desktop/flutter-desktop', 'Flutter Desktop 学习路线', 'Flutter Desktop'),
      placeholder('desktop/qt', 'Qt'),
      placeholder('desktop/dotnet-desktop', '.NET 桌面开发'),
      placeholder('desktop/macos-swiftui', 'macOS 与 SwiftUI'),
      placeholder('desktop/javafx', 'JavaFX')
    ]),
    group('desktop-engineering', '桌面端工程', [
      placeholder('desktop/architecture', '桌面应用架构'),
      placeholder('desktop/packaging-updates', '打包、签名与更新')
    ])
  ]),
  group('machine-learning', '机器学习工程', [
    placeholder('machine-learning/overview', '路线总览', '机器学习与模型工程学习路线总览'),
    group('machine-learning-foundations', '机器学习基础', [
      placeholder('machine-learning/foundations', '机器学习基础'),
      placeholder('machine-learning/supervised-learning', '监督学习'),
      placeholder('machine-learning/unsupervised-learning', '无监督学习'),
      placeholder('machine-learning/feature-engineering', '特征工程'),
      placeholder('machine-learning/model-evaluation', '模型评估')
    ]),
    group('machine-learning-frameworks', '深度学习与框架', [
      placeholder('machine-learning/deep-learning', '深度学习'),
      placeholder('machine-learning/pytorch', 'PyTorch'),
      placeholder('machine-learning/tensorflow-keras', 'TensorFlow 与 Keras'),
      placeholder('machine-learning/scikit-learn', 'scikit-learn'),
      placeholder('machine-learning/hugging-face', 'Hugging Face')
    ]),
    group('machine-learning-production', '模型交付', [
      placeholder('machine-learning/model-serving-mlops', '模型服务与 MLOps')
    ])
  ]),
  group('data-science', '数据科学', [
    placeholder('data-science/overview', '路线总览', '数据科学学习路线总览'),
    group('data-science-foundations', '数据分析基础', [
      placeholder('data-science/python-stack', 'Python 数据科学生态'),
      placeholder('data-science/applied-statistics', '应用统计学'),
      placeholder('data-science/data-cleaning', '数据清洗')
    ]),
    group('data-science-analysis', '分析与实验', [
      placeholder('data-science/exploratory-analysis', '探索性数据分析'),
      placeholder('data-science/visualization', '数据可视化'),
      placeholder('data-science/notebooks-reproducibility', 'Notebook 与可复现性'),
      placeholder('data-science/ab-testing', 'A/B 测试'),
      placeholder('data-science/time-series', '时间序列分析')
    ])
  ]),
  group('data-engineering', '数据工程', [
    placeholder('data-engineering/overview', '路线总览', '数据工程学习路线总览'),
    group('data-engineering-foundations', '架构与建模', [
      placeholder('data-engineering/architecture', '数据工程架构'),
      placeholder('data-engineering/data-modeling', '数据建模'),
      placeholder('data-engineering/etl-elt', 'ETL 与 ELT'),
      placeholder('data-engineering/batch-processing', '批处理')
    ]),
    group('data-engineering-engines', '处理引擎', [
      placeholder('data-engineering/stream-processing', '流处理'),
      placeholder('data-engineering/spark', 'Apache Spark'),
      placeholder('data-engineering/flink', 'Apache Flink'),
      placeholder('data-engineering/airflow', 'Apache Airflow'),
      placeholder('data-engineering/dbt', 'dbt')
    ]),
    group('data-engineering-platform', '数据平台', [
      placeholder('data-engineering/warehouse-lakehouse', '数据仓库与湖仓'),
      placeholder('data-engineering/data-quality-governance', '数据质量与治理')
    ])
  ]),
  group('devops', '平台工程与 SRE', [
    placeholder('devops/overview', '路线总览', 'DevOps、平台工程与 SRE 学习路线总览'),
    group('devops-foundations', '基础与容器', [
      published('devops/linux', 'Linux 系统管理学习路线', 'Linux 系统管理'),
      placeholder('devops/shell-automation', 'Shell 自动化'),
      published('devops/docker', 'Docker 学习路线', 'Docker'),
      published('devops/kubernetes', 'Kubernetes 学习路线', 'Kubernetes')
    ]),
    group('devops-infrastructure', '基础设施即代码', [
      placeholder('devops/helm', 'Helm'),
      placeholder('devops/iac', '基础设施即代码'),
      placeholder('devops/terraform-opentofu', 'Terraform 与 OpenTofu'),
      placeholder('devops/ansible', 'Ansible')
    ]),
    group('devops-delivery', '持续交付', [
      placeholder('devops/cicd', 'CI/CD'),
      published('devops/github-actions', 'GitHub Actions 学习路线', 'GitHub Actions'),
      published('devops/gitlab-ci', 'GitLab CI/CD 学习路线', 'GitLab CI/CD'),
      placeholder('devops/gitops-argocd', 'GitOps 与 Argo CD')
    ]),
    group('devops-operations', '平台与可靠性', [
      placeholder('devops/platform-engineering', '平台工程'),
      placeholder('devops/sre', '站点可靠性工程（SRE）'),
      placeholder('devops/incident-management', '事件管理')
    ])
  ]),
  group('security', '安全工程', [
    placeholder('security/overview', '路线总览', '安全工程学习路线总览'),
    group('security-foundations', '安全基础', [
      published('security/web-security', 'Web 安全学习路线', 'Web 安全'),
      published('security/auth', '认证授权学习路线', '认证授权'),
      published('security/cryptography', '密码学学习路线', '密码学')
    ]),
    group('security-development', '安全开发与防护', [
      placeholder('security/secure-coding', '安全编码'),
      placeholder('security/threat-modeling', '威胁建模'),
      placeholder('security/application-security', '应用安全'),
      placeholder('security/api-security', 'API 安全'),
      placeholder('security/cloud-security', '云安全'),
      placeholder('security/container-kubernetes-security', '容器与 Kubernetes 安全'),
      placeholder('security/supply-chain-security', '软件供应链安全')
    ]),
    group('security-operations', '攻防与响应', [
      placeholder('security/penetration-testing', '渗透测试'),
      placeholder('security/blue-team-incident-response', '蓝队与事件响应'),
      placeholder('security/reverse-engineering-malware', '逆向工程与恶意软件'),
      placeholder('security/devsecops', 'DevSecOps')
    ])
  ]),
  group('testing', '质量与测试', [
    placeholder('testing/overview', '路线总览', '测试与质量工程学习路线总览'),
    group('testing-foundations', '测试基础', [
      placeholder('testing/strategy', '测试策略'),
      placeholder('testing/unit-integration', '单元与集成测试'),
      placeholder('testing/api-contract', 'API 与契约测试'),
      placeholder('testing/e2e', '端到端测试'),
      placeholder('testing/performance-load', '性能与负载测试'),
      placeholder('testing/static-analysis-quality-gates', '静态分析与质量门禁')
    ]),
    group('testing-frameworks', '测试框架与工具', [
      published('testing/jest', 'Jest 学习路线', 'Jest'),
      published('testing/pytest', 'Pytest 学习路线', 'Pytest'),
      published('testing/junit', 'JUnit 学习路线', 'JUnit'),
      published('testing/selenium', 'Selenium 学习路线', 'Selenium'),
      published('testing/cypress', 'Cypress 学习路线', 'Cypress'),
      placeholder('testing/vitest', 'Vitest'),
      placeholder('testing/playwright', 'Playwright'),
      placeholder('testing/k6', 'k6')
    ])
  ]),
  group('game-development', '游戏开发', [
    placeholder('game-development/overview', '路线总览', '游戏开发学习路线总览'),
    group('game-development-foundations', '游戏基础', [
      placeholder('game-development/foundations', '游戏开发基础'),
      placeholder('game-development/math-physics', '游戏数学与物理')
    ]),
    group('game-development-engines', '引擎与内容', [
      placeholder('game-development/unity', 'Unity'),
      placeholder('game-development/unreal-engine', 'Unreal Engine'),
      placeholder('game-development/godot', 'Godot'),
      placeholder('game-development/2d', '2D 游戏开发'),
      placeholder('game-development/3d', '3D 游戏开发')
    ]),
    group('game-development-production', '系统与交付', [
      placeholder('game-development/game-ai', '游戏 AI'),
      placeholder('game-development/multiplayer-networking', '多人游戏网络'),
      placeholder('game-development/performance', '游戏性能优化'),
      placeholder('game-development/tooling-release', '工具链与发布')
    ])
  ]),
  group('embedded-iot', '嵌入式与 IoT', [
    placeholder('embedded-iot/overview', '路线总览', '嵌入式与 IoT 学习路线总览'),
    group('embedded-iot-foundations', '电子与嵌入式基础', [
      placeholder('embedded-iot/electronics-digital', '电子与数字电路'),
      placeholder('embedded-iot/embedded-cpp', '嵌入式 C++'),
      placeholder('embedded-iot/mcu', '微控制器（MCU）'),
      placeholder('embedded-iot/arduino', 'Arduino'),
      placeholder('embedded-iot/esp32', 'ESP32'),
      placeholder('embedded-iot/stm32', 'STM32'),
      placeholder('embedded-iot/freertos', 'FreeRTOS')
    ]),
    group('embedded-iot-systems', '系统、设备与 IoT', [
      placeholder('embedded-iot/device-drivers', '设备驱动'),
      placeholder('embedded-iot/embedded-linux', '嵌入式 Linux'),
      placeholder('embedded-iot/hardware-protocols', '硬件通信协议'),
      placeholder('embedded-iot/iot-cloud-security', 'IoT 云与安全')
    ])
  ]),
  group('systems', '系统与底层', [
    placeholder('systems/overview', '路线总览', '系统与底层开发学习路线总览'),
    group('systems-programming', '系统编程', [
      placeholder('systems/systems-programming', '系统编程基础'),
      placeholder('systems/linux-system-programming', 'Linux 系统编程'),
      placeholder('systems/memory-concurrency', '内存与并发'),
      placeholder('systems/network-programming', '网络编程'),
      placeholder('systems/compiler-construction', '编译器构造')
    ]),
    group('systems-platform', '平台与运行时', [
      placeholder('systems/filesystems-storage', '文件系统与存储'),
      placeholder('systems/virtualization-containers', '虚拟化与容器'),
      placeholder('systems/webassembly', 'WebAssembly'),
      placeholder('systems/ebpf', 'eBPF')
    ])
  ]),
  group('robotics', '机器人开发', [
    placeholder('robotics/overview', '路线总览', '机器人开发学习路线总览'),
    group('robotics-foundations', '机器人基础', [
      placeholder('robotics/foundations', '机器人开发基础'),
      placeholder('robotics/ros2', 'ROS 2'),
      placeholder('robotics/kinematics-control', '运动学与控制'),
      placeholder('robotics/perception-vision', '感知与视觉'),
      placeholder('robotics/slam', 'SLAM')
    ]),
    group('robotics-systems', '规划与系统', [
      placeholder('robotics/planning-navigation', '规划与导航'),
      placeholder('robotics/simulation-hardware-safety', '仿真、硬件与安全')
    ])
  ]),
  group('graphics-multimedia', '图形与多媒体', [
    placeholder('graphics-multimedia/overview', '路线总览', '图形与多媒体学习路线总览'),
    group('graphics-multimedia-foundations', '图形基础', [
      placeholder('graphics-multimedia/foundations', '图形与多媒体基础'),
      placeholder('graphics-multimedia/rendering-pipeline', '渲染管线'),
      placeholder('graphics-multimedia/shaders', '着色器')
    ]),
    group('graphics-multimedia-apis', '图形 API', [
      placeholder('graphics-multimedia/opengl', 'OpenGL'),
      placeholder('graphics-multimedia/vulkan', 'Vulkan'),
      placeholder('graphics-multimedia/directx-metal', 'DirectX 与 Metal'),
      placeholder('graphics-multimedia/webgl-webgpu', 'WebGL 与 WebGPU')
    ]),
    group('graphics-multimedia-production', '媒体处理与实时传输', [
      placeholder('graphics-multimedia/multimedia-processing', '多媒体处理'),
      placeholder('graphics-multimedia/realtime-streaming', '实时流媒体')
    ])
  ]),
  group('blockchain', '区块链与 Web3', [
    placeholder('blockchain/overview', '路线总览', '区块链与 Web3 学习路线总览'),
    group('blockchain-foundations', '账本与共识', [
      placeholder('blockchain/ledger-consensus', '分布式账本与共识'),
      placeholder('blockchain/ethereum-evm', 'Ethereum 与 EVM'),
      placeholder('blockchain/solidity', 'Solidity'),
      placeholder('blockchain/smart-contracts', '智能合约')
    ]),
    group('blockchain-applications', '应用与安全', [
      placeholder('blockchain/dapp-web3', 'DApp 与 Web3'),
      placeholder('blockchain/wallets-identity', '钱包与身份'),
      placeholder('blockchain/solana-rust', 'Solana 与 Rust'),
      placeholder('blockchain/layer2-scaling', 'Layer 2 与扩容'),
      placeholder('blockchain/security-auditing', '区块链安全审计')
    ])
  ])
]
