# Selenium 学习路线

Selenium 是 **Web 自动化测试的元老**(2004 年至今):通过 **WebDriver 协议**驱动真实浏览器(Chrome/Firefox/Edge/Safari),支持 Python/Java/JS 等主流语言——**跨语言、跨浏览器、生态最成熟**,自动化测试/爬虫/RPA 都靠它。**清醒的定位**:新前端项目的 E2E,开发者体验更好的 [Cypress](/learning-paths/testing/cypress) 与 **Playwright** 已是主流;但 **Selenium 的跨语言支持、Grid 大规模并行、老系统存量**,让它依然是"瑞士军刀"级的存在——**Python/Java 后端工程师的 E2E 与爬虫,它最顺手**。本页以 Python 为例(Java 心智相同)。

这条线按 **架构与环境 → 元素定位 → 元素操作 → 等待机制 → Page Object 模式 → 框架集成 → Grid 与 CI → 稳定性与选型** 推进。

## 第一站:架构、安装与第一个脚本

**架构一句话**:你的代码 → WebDriver(浏览器驱动:ChromeDriver/GeckoDriver,把命令翻译给浏览器)→ 真实浏览器。**安装**:`pip install selenium` + **浏览器驱动**(版本必须与浏览器匹配——**用 WebDriver Manager 库自动下载管理,别手动配**(Java 的 WebDriverManager、Python 的 webdriver-manager))。**第一个脚本(背下来)**:创建 driver(`webdriver.Chrome()`)→ `driver.get(url)` → `driver.find_element(By.ID, "username")` → `.send_keys("...")`/`.click()` → `driver.quit()`(**释放浏览器进程——用 try/finally 或 with 保证执行,否则僵尸进程堆积**)。**浏览器 Options(CI 环境必配)**:`--headless`(无头模式:没界面也能跑——CI 标配)、窗口大小、禁用 GPU、`--ignore-certificate-errors`(测试环境自签证书)等;Chrome 的 `add_argument` 与 `add_experimental_option` 是高频操作。

## 第二站:元素定位——E2E 的第一道坎

**八种定位方式**:By.ID(最快最稳)/NAME/CLASS_NAME/TAG_NAME/LINK_TEXT(精确链接文本)/PARTIAL_LINK_TEXT/**CSS_SELECTOR 与 XPATH(主力)**。**CSS 选择器**:`#id`/`.class`/`[name='x']`/`form input`——简洁、性能好;**XPath(功能最强,救急首选)**:`//input[@id='username']`(属性)、**`//button[text()='提交']`(按文本——没有 id 时的救星)**、`//div[contains(@class, 'btn')]`(模糊匹配——**动态 class/id 场景**);**轴**(parent::/following-sibling::——找"相邻兄弟的输入框")。**定位器稳定性心法(比语法重要)**:①**优先语义稳定属性**:data-testid/固定 id(前端给测试留的钩子——**比 XPath 文本脆得多**);②一个定位器只匹配一个元素(唯一性);③别依赖索引([0])与易变 class;④**find_elements(复数)返回空列表不抛错**——用 `len()==0` 断言"元素不存在"(比 try find_element 优雅)。**特殊容器**:iframe 里的元素要先 `switch_to.frame()`(不切永远找不到——经典坑);Shadow DOM 要穿透(execute_script 或影子定位器,进阶)。

## 第三站:元素操作与浏览器控制

**基础交互**:click()/send_keys()(输入)/clear()(清空——**输入前先 clear 防残留**);**取值:文本用 `.text`,输入框的值用 `get_attribute("value")`**。**特殊控件**:下拉 `<select>` 用 Select 类(`select_by_visible_text("选项")` 最直观);checkbox/radio:`is_selected()` 判断 + click 切换;文件上传:`send_keys(文件绝对路径)`(**不用点开对话框,直接输路径——隐藏 input 要先 JS 显示**)。**键盘与鼠标**:Keys.ENTER/TAB、组合键(Keys.CONTROL + 'a' 全选);**ActionChains(高级交互)**:悬停(下拉菜单)、双击、右键、**拖拽**(drag_and_drop + perform)。**浏览器级操作**:新窗口/标签切换(`driver.window_handles` + switch_to.window);**Alert 弹窗**(`switch_to.alert.accept()`——删除确认这类原生弹窗);**execute_script(JS 后门)**:滚动到元素、修改样式、操作隐藏元素——**少用但要会(有些场景只有它能做)**;Cookie 注入(`add_cookie` 提前登录态——**跳过每次登录流程的提速技巧**);**截图(排障与报告的灵魂)**:`driver.get_screenshot_as_file()`——**异常处理里自动截图**,失败时留证据。

## 第四站:等待机制——flaky 与稳定的分水岭

**三大等待(面试必答,选型必懂)**:①`time.sleep(固定秒)`——**禁用于生产测试**:等多了浪费时间、等少了偶发失败(flaky 头号来源),只用于调试;②**隐式等待 `driver.implicitly_wait(10)`**:全局设置,find 元素时轮询等待——**一次设置全局生效,但"只等元素出现,等不了可点击/消失"**,不够灵活;③**显式等待(正道)**:`WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, "submit")))`——**对"特定的条件"等到为止**,配合 expected_conditions:presence_of_element_located(在 DOM)/visibility_of(可见)/element_to_be_clickable(可点——**点按钮前等它**)/text_to_be_present(文本出现——AJAX 加载完成)/alert_is_present 等。**心法:凡是"页面异步加载后才出现"的元素,一律显式等待;能等"可点击"就别只等"存在"**;复杂业务条件写自定义等待函数(轮询直到某状态)。**页面前进后退/URL 变化**也可以等(title_contains/url_changes)。

## 第五站:Page Object 模式——E2E 可维护性的关键

**问题**:测试直接写定位器 → 前端改一个 class,几十个测试跟着碎。**Page Object 解法**:每个页面一个类(LoginPage/HomePage),**封装"元素定位 + 页面操作"(login(username, pwd)/is_logged_in())**——**测试脚本只写业务流程,页面细节全部收进 Page 类**:元素变了只改一个类;操作可复用(多个测试都调 login());**读测试像读需求**("登录→下单→断言成功")。**BasePage 基类**:构造注入 driver、封装公共方法(wait_for_element/click_when_ready/截图)。**配套**:数据驱动(账号/输入放 CSV/JSON + 参数化——**数据与逻辑分离**);测试独立(每个测试自建数据、不留依赖——**E2E 不能依赖"上一个测试留下的状态"**)。

## 第六站:与测试框架集成

**Selenium 只提供"驱动浏览器",测试组织交给框架**:**Python + Pytest(主流组合,见 [Pytest](/learning-paths/testing/pytest))**:fixture 管理 driver(函数级:每测试新浏览器保隔离;会话级复用提速)、**失败自动截图**(pytest hook)、参数化跑多浏览器、`pytest-rerunfailures`(对偶发 flaky 重试——**治标,根因仍是等待与定位**);**Java + JUnit5(见 [JUnit](/learning-paths/testing/junit))**:@BeforeEach 起 driver/@AfterEach quit + 失败截图(TestWatcher);**报告:Allure(步骤/截图/历史——E2E 报告的黄金标准;失败用例带截图与日志,给开发看时不用复述)**。**测试分层提醒(E2E 的定位)**:E2E 慢且脆——**只覆盖关键路径(登录/核心下单/支付回调),数量 10 级以内**,大量逻辑仍靠单元与集成(见 [测试金字塔](/learning-paths/testing/jest))。

## 第七站:Selenium Grid 与 CI

**Grid(分布式并行)**:Hub(调度中心)+ Node(多机跑浏览器)——**跨浏览器 × 跨平台的大规模矩阵**(Chrome/Firefox/Safari × Win/Mac/Linux 并行);现代 Grid 4 支持 Docker 化(`docker-compose` 起 hub+node,含 VNC 实时看浏览器);**RemoteWebDriver**:代码连 Grid 的 URL 跑远程浏览器。**CI 集成(见 [GitHub Actions](/learning-paths/devops/github-actions))**:headless + 服务容器(起 Grid/被测应用)+ 并行——**E2E 进 CI 的关键:无头、稳定等待、失败截图留证据**;**何时需要 Grid**:浏览器矩阵大或要并行加速;单浏览器单机 CI 用不上(别过度设计)。

## 第八站:稳定性、常见坑与选型

**flaky(偶发失败)根因排查清单**:①等待不当(sleep/等"存在"没等"可点击")→ 显式等待;②定位器脆(索引/动态 class/XPath 文本)→ 语义属性/data-testid;③测试间耦合(依赖执行顺序/共享数据)→ 每测试独立;④动画/网络慢(等元素稳定);⑤浏览器/驱动版本不匹配(WebDriver Manager)。**常见坑速查**:元素在 iframe/新窗口(忘切换)、元素被遮挡不可点(等 element_to_be_clickable)、动态 id(contains 模糊)、上传控件隐藏(JS 显示)、僵尸 chromedriver 进程(quit 保底)。**选型坐标(Selenium vs Cypress vs Playwright)**:新前端项目 → **Playwright**(现代:自动等待、快、多浏览器、体验好——**前端 E2E 首推**);Cypress(开发者体验佳、调试爽,但只支持自家运行时,多标签/跨域受限);**需要 Python/Java 等跨语言、老框架存量、爬虫/RPA、Grid 大规模 → Selenium**(生态与资料最全);移动端自动化 → Appium(WebDriver 同门,会 Selenium 上手快)。

## 通关标准

能独立做到:写出"打开页面→显式等待→登录→断言跳转"的完整脚本(无 sleep);根据页面元素选出稳定定位器并解释为什么;处理过 iframe/新窗口/Alert/下拉/上传五类特殊场景;用 Page Object 重构过测试并说清收益;集成 Pytest/JUnit 做到失败自动截图;能对一次 flaky 失败给出根因判断(等待?定位?耦合?)——Selenium 主线通关。

Selenium 教你的核心不是 API,而是**"驱动真实浏览器做端到端验证"的工程纪律**:真实用户怎么操作,测试就怎么操作;页面会异步、会动画、会改版——所以等待要显式、定位要语义、组织要 Page Object、失败要留证据。**E2E 的价值在于"关键路径真的通",而不在于覆盖率高**——把它放在测试金字塔的塔尖(少而精),把稳定性当第一目标,它就是回归测试最可靠的防线。下一步:现代 E2E 体验 [Cypress](/learning-paths/testing/cypress) 或 Playwright,移动端看 Appium。
