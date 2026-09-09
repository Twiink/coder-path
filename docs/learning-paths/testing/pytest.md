# Pytest 学习路线

Pytest 是 Python 社区**事实标准的测试框架**:相比标准库 unittest(要继承 TestCase、写 self.assertXxx),Pytest 只需要**普通函数 + assert 语句**,配合强大的 **fixture 依赖注入**与**参数化**,写起来简洁、跑起来信息丰富;插件生态覆盖覆盖率/并行/异步/Web 框架集成。**它的哲学:"简单优于复杂"**——一个 assert 能表达的事,不写一坨断言方法;fixture 让测试准备清晰可复用,参数化让覆盖更全(与 [Jest](/learning-paths/testing/jest) 的测试观一致:**为信心而测,不是为覆盖率凑数**)。

这条线按 **配置与运行 → 断言与异常 → Fixture 系统 → 参数化与标记 → Mock 与 Monkeypatch → 插件生态 → 实战场景 → 调试与 CI** 推进。

## 第一站:安装、命名与运行

**安装与配置**:`pip install pytest`;测试约定:**文件 `test_*.py`、函数 `test_*` 开头、类 `Test*` 开头**(默认发现规则);配置写 `pytest.ini`/`pyproject.toml`(`testpaths` 指定目录、`addopts = -v` 默认参数)。**运行形态(常用选项背下来)**:`pytest`(全跑)/`pytest 文件.py::test_函数`(单个)/`-v`(详细)/`-s`(**显示 print 输出——默认吞掉**)/`-x`(失败即停)/`--maxfail=3`/`--lf`(**只跑上次失败的——改 bug 时的循环**) /`-k "名字关键词"`(按名过滤)/`-n auto`(并行,需 xdist)/`-m "not slow"`(按标记过滤);`python -m pytest`(不依赖 PATH 的稳妥姿势)。**断言失败的体验是 Pytest 的招牌**:`assert a == b` 失败时自动打印两边的值与详细 diff——**比 unittest 的 assertEqual 信息丰富得多,这就是"不用断言方法"的底气**。

## 第二站:断言与异常

**assert 是关键字,不是函数**:`assert x == 1`/`x in list`/`x is None`/`isinstance(x, int)`;加自定义信息:`assert x > 0, "x 必须为正"`(失败时显示,写清业务语义)。**异常断言(pytest.raises,比 try/except 优雅)**:`with pytest.raises(ValueError, match="邮箱格式") as excinfo:`——match 用正则匹配错误消息;**excinfo.value 拿异常对象查属性**;断言"不抛"用 `with pytest.raises(...)` 包失败逻辑或直接跑。**近似比较**:`pytest.approx(0.3)`(浮点:0.1+0.2 的场景,支持相对/绝对容差与 **numpy 数组**——数据科学测试必备);`pytest.warns`(警告断言,如弃用警告)。**陷阱提醒**:别在测试里裸 try/except 吞异常(失败会变"通过")——异常路径一律 raises。

## 第三站:Fixture——Pytest 的灵魂

**Fixture 是什么**:带 `@pytest.fixture` 的准备/清理函数;**测试函数用"参数名"声明依赖,Pytest 自动注入**——替代 unittest 的 setUp/teardown,且粒度自由(每个测试只要自己需要的)。**基础形态**:`@pytest.fixture def user(): return create_user()` → `def test_x(user): ...`。**作用域(scope,资源成本的旋钮)**:function(默认:每测试一次)/module/session(**昂贵资源(数据库连接/浏览器)用 session 只建一次——但注意共享状态:session 级对象别被测试改脏**);autouse=True(不需要声明也自动跑——全局计时/环境准备,慎用)。**yield 实现"前后"**:fixture 里 yield 之前是准备、之后是清理——**测试抛错也会执行清理**(等价 teardown 的可靠性);**conftest.py(fixture 的共享仓库)**:根目录/各层的 conftest 定义 fixture,同层及以下测试自动可用——**把跨文件的公共准备(客户端/数据库/登录态)放 conftest,是 Pytest 项目结构的核心习惯**;fixture 还能依赖 fixture(组合),可参数化(params)。**内置 fixture 必会**:`tmp_path`(自动清理的临时目录——**文件/路径测试用它,别手建手删**)、`monkeypatch`(见 Mock 站)、`capsys`(捕获 stdout 断言输出)、`caplog`(断言日志)。**心智:看到测试里重复的准备代码 → 抽成 fixture;看到跨文件重复 → 放 conftest**。

## 第四站:参数化与标记

**参数化(一表打尽边界)**:`@pytest.mark.parametrize("输入,期望", [(1, 2), (0, 0), (-1, -2)])` 自动展开成多个用例(**失败时精确到哪组参数**);**ids** 给用例可读名(如 "负数"——失败报告一眼定位);多个装饰器 = 笛卡尔积、同参数可用 zip 合并;**数据源可以是 CSV/JSON/生成器**;`pytest.param(..., marks=skip)` 对单个用例标记。**标记(打标签与条件)**:`@pytest.mark.skip(reason=...)`(无条件跳过:功能未实现)/**`skipif(sys.version_info < (3, 10), reason=...)`(条件跳过:平台/版本/依赖)**/`xfail`(**预期失败:已知 bug 或未实现——跑了不算失败,修好后会自动转 XPASS 提醒你移除**);**自定义标记**(如 `slow`/`integration`):pytest.ini 里注册后 `@pytest.mark.slow`,运行 `-m "not slow"`(日常)或 `-m integration`(CI 全量)——**给测试分层(unit/integration/e2e)是通用实践**。

## 第五站:Mock 与 Monkeypatch

**monkeypatch(fixture,改"环境"的万能工具)**:`monkeypatch.setattr(模块, '函数', 假函数)`/`setenv("API_KEY", "test")`/`setattr(obj, 'now', 固定时间)`——**测试后自动还原**;适用:环境变量、当前时间/随机数、平台判断——**"测代码在不同环境/时间下的行为"全靠它**。**unittest.mock(标准库 Mock)**:`from unittest.mock import patch, MagicMock`——**`@patch("module.使用的路径")`(经典坑:patch 的是"使用处"的名字,不是函数定义处)**;MagicMock(任意属性/方法自动生成)、`return_value`(固定返回)、`side_effect`(抛异常或依次返回值)、`assert_called_once_with(...)`(调用断言);**推荐 pytest-mock 插件**:`mocker` fixture 整合 patch(`mocker.patch(...)`),自动清理,写法更简洁;**mock 对象三件套(哲学同 [Jest](/learning-paths/testing/jest) Mock 章)**:单元测试里网络/数据库/时间全替身化,断言"依赖被正确调用";**mock HTTP**:responses 库或 httpx 的 MockTransport(见 [FastAPI](/learning-paths/backend/fastapi) 测试章)。

## 第六站:插件生态

**核心插件清单(按需装)**:`pytest-cov`(覆盖率:`--cov=你的包 --cov-report=term-missing`(看哪行没盖)/`--cov-report=html`/`--cov-fail-under=80`(**CI 卡阈值防回退**))、`pytest-xdist`(并行 `-n auto`——注意共享文件/数据库的测试别并行)、`pytest-asyncio`(异步测试:`@pytest.mark.asyncio`,新项目配 `asyncio_mode = auto` 免标记)、`pytest-timeout`(单测超时防挂死 CI)、`pytest-html`(HTML 报告)、`pytest-randomly`(随机执行顺序——**抓出"依赖执行顺序"的隐藏测试病**)、`pytest-mock`(见上);**框架集成**:pytest-django(见 [Django](/learning-paths/backend/django) 测试章:数据库事务回滚/测试客户端)、pytest-flask(见 [Flask](/learning-paths/backend/flask))、pytest-asyncio + httpx(见 [FastAPI](/learning-paths/backend/fastapi))。**进阶(钩子与插件开发)**:conftest 里实现 pytest_configure 等钩子做全局定制;真正"写插件发布"是少数人的事——**先把 fixture/conftest 用熟**。

## 第七站:实战场景速查

**数据库**:独立测试库 + 每测试事务回滚(Django 的 TestCase 自动;SQLAlchemy 项目自己写 session fixture)——**测试永不碰生产数据是铁律**;factory_boy 造数据(见 [Django](/learning-paths/backend/django));**文件系统**:tmp_path + 构造输入文件,断言输出文件内容;**API/Web**:框架测试客户端(见各框架页)+ mock 外部调用;**异步**:pytest-asyncio + 异步客户端(见 [FastAPI](/learning-paths/backend/fastapi));**数据管道**:用 numpy/pandas 近似断言输出;**CLI**:调入口函数 + capsys 断言输出;**测试数据文件**:tests/data/ 目录随仓库走。

## 第八站:调试与 CI

**调试三板斧**:`--pdb`(失败自动进调试器——现场查变量)、`-s`(看 print)、`--lf`(改 bug 只重跑失败);`-vv` 更细输出;单测卡住用 `-x` 快速定位第一个失败。**CI 集成(见 [GitHub Actions](/learning-paths/devops/github-actions))**:装依赖 → `pytest --cov=src --cov-report=xml --junitxml=report.xml`(JUnit XML 报告能上图/上传 Codecov——**覆盖率趋势可见**);缓存 pip 依赖加速;**test 分层执行**:日常 -m "not slow",nightly/发布前全量。**测试组织**:tests/ 目录按模块镜像源码结构 + 每层 conftest;分层标记(unit/integration/e2e);**好测试三标准(同 Jest 章,通用)**:行为不实现、快且独立、失败信息可读。

## 通关标准

能独立做到:用 fixture(含 yield 清理与 conftest)重构掉测试里的重复准备代码;用 parametrize 覆盖边界与异常输入并给出可读 ids;用 monkeypatch 与 pytest-mock 测"依赖时间/环境变量/网络"的逻辑;用 raises/approx/caplog 完成异常、浮点与日志断言;接上 pytest-cov 并在 CI 里卡覆盖率阈值、用 xdist 并行;把测试按单元/集成分层并用 -m 灵活调度——Pytest 主线通关。

Pytest 的优雅在于**把"准备-执行-断言"的样板降到最低**:fixture 即注入、assert 即断言、参数化即覆盖——测试代码第一次可以比业务代码更好读。它教会你的核心是"**可测试性设计**":纯函数、依赖注入、副作用隔离——这些被 fixture/mock 逼出来的习惯,会让你的 Python 代码本身更健康。下一步:浏览器 E2E 用 [Selenium](/learning-paths/testing/selenium) 或 [Playwright],框架内测试回 [Django](/learning-paths/backend/django)/[FastAPI](/learning-paths/backend/fastapi) 深化。
