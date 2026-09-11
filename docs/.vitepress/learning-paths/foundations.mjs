import { group, page } from './model.mjs'

const published = (slug, title, navTitle, previousRoutes = []) =>
  page({ id: slug, slug, title, navTitle, status: 'published', previousRoutes })

const placeholder = (slug, navTitle, title = `${navTitle} 学习路线`) =>
  page({ id: slug, slug, title, navTitle, status: 'placeholder' })

export const foundations = [
  group('cs-basics', '计算机科学基础', [
    placeholder('cs-basics/overview', '路线总览', '计算机科学基础学习路线总览'),
    group('cs-basics-core', '核心基础', [
      published('cs-basics/data-structures-algorithms', '数据结构与算法学习路线', '数据结构与算法'),
      published('cs-basics/computer-organization', '计算机组成原理学习路线', '计算机组成原理'),
      published('cs-basics/operating-systems', '操作系统学习路线', '操作系统'),
      published('cs-basics/computer-networks', '计算机网络学习路线', '计算机网络'),
      placeholder('cs-basics/computational-thinking', '计算思维'),
      placeholder('cs-basics/algorithm-analysis', '算法分析'),
      placeholder('cs-basics/advanced-algorithms', '高级算法')
    ]),
    group('cs-basics-theory-and-society', '理论与专业实践', [
      placeholder('cs-basics/automata-computability', '自动机与可计算性'),
      placeholder('cs-basics/programming-language-foundations', '编程语言理论基础'),
      placeholder('cs-basics/database-systems', '数据库系统原理'),
      placeholder('cs-basics/parallel-distributed', '并行与分布式计算'),
      placeholder('cs-basics/hci', '人机交互'),
      placeholder('cs-basics/ethics-profession', '计算伦理与职业实践')
    ])
  ]),
  group('mathematics', '数学基础', [
    placeholder('mathematics/overview', '路线总览', '数学基础学习路线总览'),
    group('mathematics-core', '核心数学', [
      placeholder('mathematics/logic-proofs', '逻辑与证明'),
      placeholder('mathematics/discrete-mathematics', '离散数学'),
      placeholder('mathematics/linear-algebra', '线性代数'),
      placeholder('mathematics/calculus', '微积分'),
      placeholder('mathematics/probability', '概率论'),
      placeholder('mathematics/statistics', '统计学'),
      placeholder('mathematics/numerical-optimization', '数值计算与优化')
    ])
  ]),
  group('languages', '编程语言', [
    placeholder('languages/overview', '路线总览', '编程语言学习路线总览'),
    group('languages-general-purpose', '通用编程语言', [
      published('languages/java', 'Java 学习路线', 'Java'),
      published('languages/javascript', 'JavaScript 学习路线', 'JavaScript', ['/learning-paths/frontend/javascript']),
      published('languages/typescript', 'TypeScript 学习路线', 'TypeScript', ['/learning-paths/frontend/typescript']),
      published('languages/python', 'Python 学习路线', 'Python'),
      placeholder('languages/c', 'C'),
      published('languages/cpp', 'C++ 学习路线', 'C++'),
      published('languages/csharp', 'C# 学习路线', 'C#'),
      placeholder('languages/go', 'Go')
    ]),
    group('languages-modern-and-platform', '现代与平台语言', [
      placeholder('languages/rust', 'Rust'),
      published('languages/kotlin', 'Kotlin 学习路线', 'Kotlin'),
      published('languages/swift', 'Swift 学习路线', 'Swift'),
      placeholder('languages/dart', 'Dart'),
      published('languages/php', 'PHP 学习路线', 'PHP'),
      published('languages/ruby', 'Ruby 学习路线', 'Ruby'),
      placeholder('languages/scala', 'Scala'),
      placeholder('languages/elixir', 'Elixir')
    ]),
    group('languages-data-and-scripting', '数据与脚本语言', [
      placeholder('languages/sql', 'SQL'),
      placeholder('languages/r', 'R'),
      placeholder('languages/shell', 'Shell'),
      placeholder('languages/zig', 'Zig'),
      placeholder('languages/julia', 'Julia')
    ])
  ]),
  group('tools', '工具与工作流', [
    placeholder('tools/overview', '路线总览', '工具与工作流学习路线总览'),
    group('tools-daily-workflow', '日常工作流', [
      published('tools/git', 'Git 版本控制学习路线', 'Git 版本控制'),
      published('tools/vscode', 'VS Code 学习路线', 'VS Code'),
      published('tools/terminal', '终端效率学习路线', '终端效率'),
      published('tools/claude-code', 'Claude Code 学习路线', 'Claude Code'),
      placeholder('tools/debugging-profiling', '调试与性能分析'),
      placeholder('tools/api-debugging', 'API 调试'),
      placeholder('tools/local-development', '本地开发环境'),
      placeholder('tools/ai-coding-tools', 'AI 编程工具')
    ])
  ]),
  group('build-tools', '构建与依赖', [
    placeholder('build-tools/overview', '路线总览', '构建与依赖学习路线总览'),
    group('build-tools-ecosystems', '生态构建工具', [
      published('build-tools/maven', 'Maven 学习路线', 'Maven'),
      published('build-tools/gradle', 'Gradle 学习路线', 'Gradle'),
      published('build-tools/make', 'Make 学习路线', 'Make'),
      published('build-tools/vite', 'Vite 学习路线', 'Vite', ['/learning-paths/frontend/vite']),
      published('build-tools/webpack', 'Webpack 学习路线', 'Webpack', ['/learning-paths/frontend/webpack']),
      placeholder('build-tools/javascript-package-management', 'JavaScript 包管理'),
      placeholder('build-tools/python-dependency-management', 'Python 依赖管理'),
      placeholder('build-tools/go-modules', 'Go Modules')
    ]),
    group('build-tools-native-and-monorepo', '原生构建与 Monorepo', [
      placeholder('build-tools/cargo', 'Cargo'),
      placeholder('build-tools/cmake', 'CMake'),
      placeholder('build-tools/bazel-monorepo', 'Bazel 与 Monorepo')
    ])
  ])
]
