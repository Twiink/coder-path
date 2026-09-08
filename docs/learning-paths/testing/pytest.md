# Pytest 学习路线

Pytest 是 Python 社区最流行的测试框架，以简洁优雅的语法和强大的功能著称。相比标准库的 unittest，Pytest 不需要继承测试类，不需要 self，只需要普通函数和 assert 语句。它的插件生态丰富，从单元测试到集成测试，从 Web 到数据科学，Pytest 都能胜任。

## 基础篇：入门与配置

### 安装与初始化
- 安装方式：pip install pytest
- 验证安装：pytest --version
- 项目结构：tests/ 目录
- 配置文件：pytest.ini、pyproject.toml、setup.cfg
- 运行测试：pytest、python -m pytest

### 第一个测试
- 测试文件命名：test_*.py、*_test.py
- 测试函数命名：test_* 开头
- 基本断言：assert 语句
- 运行单个文件：pytest test_example.py
- 运行单个测试：pytest test_example.py::test_function
- 详细输出：-v、-vv

### 配置详解
- testpaths：测试目录路径
- python_files：测试文件匹配模式
- python_classes：测试类匹配模式
- python_functions：测试函数匹配模式
- addopts：默认命令行参数
- markers：自定义标记
- minversion：最低 Pytest 版本

### 命令行选项
- -v：详细输出
- -s：显示 print 输出
- -x：遇到失败停止
- --maxfail=N：失败 N 次后停止
- -k：按名称过滤测试
- -m：按标记过滤测试
- --lf：只运行上次失败的测试
- --ff：先运行失败的测试
- -n：并行执行（需要 pytest-xdist）

## 基础篇：断言与异常

### 基本断言
- assert 表达式：简单直接
- 断言失败信息：自动生成详细对比
- 多行断言：换行显示
- 自定义失败信息：assert x == y, "custom message"

### 比较断言
- 相等性：==、!=
- 大小比较：>、<、>=、<=
- 成员测试：in、not in
- 身份测试：is、is not
- 类型判断：isinstance()

### 异常断言
- pytest.raises：捕获预期异常
- 异常类型验证
- 异常信息匹配：match 参数（正则）
- 异常上下文：with pytest.raises() as excinfo
- 异常属性检查：excinfo.value

### 警告断言
- pytest.warns：捕获警告
- 警告类型验证
- 警告信息匹配
- 忽略警告：pytest.mark.filterwarnings

### 近似比较
- pytest.approx：浮点数比较
- 相对容差：rel 参数
- 绝对容差：abs 参数
- 数组比较：numpy 数组支持

## 进阶篇：Fixture 系统

### Fixture 基础
- @pytest.fixture 装饰器
- 函数参数注入：自动依赖注入
- 返回值：提供测试数据
- 命名约定：清晰描述用途
- 作用域：function（默认）

### Fixture 作用域
- function：每个测试函数运行一次
- class：每个测试类运行一次
- module：每个模块运行一次
- package：每个包运行一次
- session：整个测试会话运行一次

### Fixture 依赖
- Fixture 依赖其他 Fixture
- 多层嵌套：灵活组合
- 自动发现：conftest.py 中定义
- 显式依赖：usefixtures 装饰器

### Fixture 设置与清理
- yield 语句：前置设置，后置清理
- 异常安全：即使测试失败也会清理
- finalizer：addfinalizer() 方法
- 多个清理步骤

### 内置 Fixture
- tmpdir、tmp_path：临时目录
- capsys、capfd：捕获输出
- monkeypatch：运行时修改
- request：访问测试请求信息
- cache：跨测试会话缓存
- record_property、record_xml_attribute：记录元数据

### Fixture 参数化
- @pytest.fixture(params=[...])
- 多组测试数据：自动生成测试
- request.param：获取当前参数
- ids：自定义测试 ID

## 进阶篇：参数化测试

### 基本参数化
- @pytest.mark.parametrize
- 参数列表：单个参数
- 参数元组：多个参数
- 测试用例生成：自动展开

### 多参数组合
- 多个参数化装饰器：笛卡尔积
- 参数依赖：zip 方式
- 条件组合：pytest.param

### 参数化技巧
- ids：自定义测试 ID
- indirect：参数传递给 Fixture
- pytest.param：单个用例配置
- marks：给特定参数添加标记
- 跳过特定参数：pytest.param + skip

### 参数化来源
- 列表、元组：硬编码数据
- 外部文件：CSV、JSON
- 数据库：动态加载
- 生成器：惰性求值

## 进阶篇：标记与跳过

### 内置标记
- @pytest.mark.skip：无条件跳过
- @pytest.mark.skipif：条件跳过
- @pytest.mark.xfail：预期失败
- 跳过原因：reason 参数
- 运行跳过的测试：--runxfail

### 自定义标记
- 注册标记：pytest.ini 中定义
- 使用标记：@pytest.mark.custom
- 标记参数：传递元数据
- 访问标记：request.node.get_closest_marker

### 标记过滤
- -m 选项：按标记运行
- 布尔表达式：and、or、not
- 标记组合：复杂过滤逻辑

## 实战篇：Mock 与 Monkeypatch

### Monkeypatch 基础
- 动态修改：属性、字典、环境变量
- setattr：修改对象属性
- delattr：删除属性
- setitem、delitem：字典操作
- setenv、delenv：环境变量
- syspath_prepend：修改 sys.path
- chdir：改变当前目录

### Mock 对象
- unittest.mock：标准库 Mock
- MagicMock：自动创建方法
- return_value：设置返回值
- side_effect：函数、异常、序列
- call_args、call_count：调用记录
- assert_called、assert_called_once_with

### Patch 装饰器
- @patch：替换对象
- patch.object：替换对象属性
- patch.dict：替换字典
- patch.multiple：批量替换
- 上下文管理器：with patch()

### 测试替身
- Stub：固定返回值
- Mock：记录调用
- Spy：包装真实对象
- Fake：简化实现

## 实战篇：插件生态

### 常用插件
- pytest-cov：覆盖率报告
- pytest-xdist：并行执行
- pytest-mock：更好的 Mock
- pytest-asyncio：异步测试
- pytest-django：Django 测试
- pytest-flask：Flask 测试
- pytest-timeout：超时控制
- pytest-benchmark：性能测试

### 覆盖率测试
- pytest-cov 安装
- --cov 参数：指定覆盖范围
- --cov-report：报告格式（term、html、xml）
- 覆盖率阈值：--cov-fail-under
- 排除文件：.coveragerc 配置

### 并行执行
- pytest-xdist 安装
- -n 参数：指定进程数
- -n auto：自动检测 CPU 核心数
- 负载均衡：--dist load
- 分组策略：--dist loadscope
- 限制：共享状态问题

### HTML 报告
- pytest-html：生成 HTML 报告
- --html 参数：指定报告路径
- 自定义报告：钩子函数
- 截图集成：失败时截图

## 实战篇：高级特性

### 测试类
- 类组织测试：相关测试分组
- 命名约定：Test* 开头
- 共享 Fixture：setup_class、setup_method
- 参数化类：pytest.mark.parametrize 在类上

### 钩子函数
- pytest_configure：配置初始化
- pytest_collection_modifyitems：修改测试集合
- pytest_runtest_setup：测试设置
- pytest_runtest_call：测试执行
- pytest_runtest_teardown：测试清理
- pytest_exception_interact：异常交互

### 自定义插件
- conftest.py：局部插件
- 钩子实现：pytest_addoption、pytest_generate_tests
- 插件发布：setuptools entry_points
- 插件加载：-p 参数

### 日志控制
- --log-cli-level：CLI 日志级别
- --log-file：日志文件路径
- log_cli：配置文件启用
- 捕获日志：caplog Fixture

## 实战篇：特定场景测试

### 异步测试
- pytest-asyncio 插件
- @pytest.mark.asyncio：异步测试标记
- async def test：异步测试函数
- await 调用
- 事件循环：event_loop Fixture

### Web 测试
- pytest-django：Django 集成
- pytest-flask：Flask 集成
- client Fixture：测试客户端
- 数据库测试：事务回滚
- API 测试：requests Mock

### 数据库测试
- 测试数据库：独立于生产
- Fixture：数据库连接、会话
- 事务回滚：测试隔离
- 数据工厂：factory_boy
- 迁移测试：alembic

### 文件系统测试
- tmp_path Fixture：临时目录（pathlib）
- tmpdir Fixture：临时目录（py.path）
- 文件创建：测试前准备
- 文件清理：自动清理
- 权限测试

## 实战篇：调试与优化

### 调试技巧
- --pdb：失败时进入调试器
- --trace：开始就进入调试器
- pytest.set_trace()：手动断点
- -s：显示 print 输出
- -vv：更详细的输出

### 性能优化
- 并行执行：pytest-xdist
- 快速失败：-x、--maxfail
- 只运行失败：--lf
- 缓存：cache Fixture
- 减少 Fixture 作用域：避免重复创建

### 测试组织
- 目录结构：按模块、功能分组
- conftest.py：共享 Fixture
- 测试发现：命名规范
- 标记分类：单元、集成、E2E
- 分层测试：金字塔原则

### CI/CD 集成
- GitHub Actions：运行测试
- 并行构建：矩阵策略
- 覆盖率上传：Codecov
- 报告输出：JUnit XML
- 缓存依赖：加速构建

## 下一步学习

掌握 Pytest 后，可以探索更多测试领域：

- **Hypothesis** - 基于属性的测试（Property-based Testing）
- **Locust** - 性能测试和负载测试
- **Selenium** - Web UI 自动化测试
- **Robot Framework** - 关键字驱动测试
- **Behave** - BDD（行为驱动开发）测试
- **Tox** - 多环境测试自动化

Pytest 的哲学是"简单优于复杂"。一个 assert 语句就能完成的事，为什么要写一堆 assertEqual？Fixture 让你的测试代码更清晰，参数化让你的测试覆盖更全面。记住，测试不是为了证明代码没有 Bug，而是为了有信心说"这段代码大概率没问题"。有了 Pytest，你的 Python 代码会更可靠。
