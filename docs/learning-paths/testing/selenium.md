# Selenium 学习路线

Selenium 是 Web 自动化测试的元老级框架，支持多浏览器、多语言，能模拟真实用户操作。从简单的表单填写到复杂的 SPA 测试，从回归测试到爬虫采集，Selenium 都能胜任。虽然有 Cypress 和 Playwright 等新秀，但 Selenium 的跨语言支持和生态成熟度依然无可替代。

## 基础篇：环境搭建

### Selenium 架构
- WebDriver：浏览器驱动协议
- Browser Drivers：ChromeDriver、GeckoDriver、EdgeDriver
- Language Bindings：Python、Java、JavaScript、C#、Ruby
- Selenium Server：远程执行、Grid 分布式
- Selenium IDE：录制回放工具

### 安装与配置
- Python：pip install selenium
- Java：Maven/Gradle 依赖
- Node.js：npm install selenium-webdriver
- 驱动下载：ChromeDriver、GeckoDriver
- 驱动管理：WebDriverManager 自动管理
- 环境变量：PATH 配置

### 第一个脚本
- 导入 WebDriver
- 创建浏览器实例：webdriver.Chrome()
- 打开网页：get()
- 查找元素：find_element()
- 操作元素：click()、send_keys()
- 关闭浏览器：quit()

### 浏览器选项
- Chrome Options：无头模式、窗口大小、禁用图片
- Firefox Options：Profile、Preferences
- 无头模式：--headless（CI 环境必备）
- 禁用 GPU：--disable-gpu
- 忽略证书错误：--ignore-certificate-errors
- User-Agent：自定义请求头

## 基础篇：元素定位

### 基础定位器
- ID：find_element(By.ID, "username")
- Name：find_element(By.NAME, "password")
- Class Name：find_element(By.CLASS_NAME, "btn")
- Tag Name：find_element(By.TAG_NAME, "input")
- 链接文本：find_element(By.LINK_TEXT, "登录")
- 部分链接文本：find_element(By.PARTIAL_LINK_TEXT, "登")

### CSS 选择器
- 基本语法：#id、.class、tag
- 属性选择器：[name='username']、[type='text']
- 组合选择器：div > input、form input
- 伪类：:first-child、:last-child、:nth-child(n)
- 优势：简洁、性能好

### XPath 选择器
- 绝对路径：/html/body/div/input（不推荐）
- 相对路径：//input[@id='username']
- 属性匹配：//div[@class='form']
- 文本匹配：//button[text()='提交']
- 包含匹配：//div[contains(@class, 'btn')]
- 轴选择：parent::、following-sibling::、ancestor::
- 优势：功能强大、支持复杂逻辑

### 定位策略
- 优先级：ID > Name > CSS > XPath
- 唯一性：确保定位器只匹配一个元素
- 稳定性：避免依赖不稳定属性（索引、动态 class）
- 可维护性：使用有语义的属性（data-testid）
- 相对定位：Selenium 4 的 Relative Locators

### 元素集合
- find_elements：查找多个元素
- 返回列表：即使没找到也返回空列表
- 遍历操作：for 循环处理
- 索引访问：elements[0]

## 基础篇：元素操作

### 基础交互
- click()：点击元素
- send_keys()：输入文本
- clear()：清空输入框
- submit()：提交表单
- 文本获取：text、get_attribute("value")
- 属性获取：get_attribute("class")、get_attribute("href")

### 下拉框操作
- Select 类：from selenium.webdriver.support.ui import Select
- select_by_index：按索引选择
- select_by_value：按 value 属性选择
- select_by_visible_text：按显示文本选择
- deselect：取消选择（多选下拉框）
- all_selected_options：获取已选项

### 复选框与单选框
- 状态检查：is_selected()
- 选中操作：未选中则 click()
- 批量操作：find_elements 遍历

### 文件上传
- 输入文件路径：send_keys("绝对路径")
- 不需要点击：直接输入路径
- 隐藏输入框：execute_script 修改样式

### 键盘操作
- Keys 类：from selenium.webdriver.common.keys import Keys
- 特殊键：ENTER、TAB、ESCAPE、BACKSPACE
- 组合键：CONTROL + "a"、SHIFT + "insert"
- ActionChains：复杂键盘序列

### 鼠标操作
- ActionChains 类
- move_to_element：鼠标悬停
- click、double_click、context_click：点击、双击、右键
- drag_and_drop：拖拽
- perform()：执行动作链

## 进阶篇：等待机制

### 强制等待
- time.sleep()：固定等待时间
- 缺点：不智能、浪费时间、不可靠
- 适用场景：调试、无法避免的延迟

### 隐式等待
- implicitly_wait()：全局等待设置
- 等待元素出现：查找元素时自动等待
- 一次设置全局生效
- 缺点：不灵活、无法等待元素消失

### 显式等待
- WebDriverWait：灵活的条件等待
- until()：等待条件满足
- until_not()：等待条件不满足
- 超时设置：自定义等待时间
- 轮询间隔：poll_frequency

### 预期条件
- presence_of_element_located：元素存在于 DOM
- visibility_of_element_located：元素可见
- element_to_be_clickable：元素可点击
- invisibility_of_element：元素不可见
- text_to_be_present_in_element：文本存在
- alert_is_present：弹窗存在
- title_contains、title_is：标题匹配

### 自定义条件
- 函数返回 True/False
- WebDriverWait + lambda
- 复杂业务逻辑等待

## 进阶篇：高级特性

### 窗口与标签页
- 获取窗口句柄：current_window_handle、window_handles
- 切换窗口：switch_to.window(handle)
- 新窗口：execute_script("window.open()")
- 关闭窗口：close()
- 窗口大小：set_window_size()、maximize_window()

### Frame 切换
- 内联框架：iframe、frame
- 切换到 Frame：switch_to.frame(element/index/name)
- 返回默认内容：switch_to.default_content()
- 父级 Frame：switch_to.parent_frame()

### 弹窗处理
- Alert：警告弹窗
- Confirm：确认弹窗
- Prompt：输入弹窗
- 切换到弹窗：switch_to.alert
- 操作：accept()、dismiss()、send_keys()、text

### JavaScript 执行
- execute_script：执行 JS 代码
- 返回值：return 语句
- 传递参数：arguments[0]
- 常用场景：滚动、修改样式、触发事件
- 绕过限制：操作隐藏元素

### Cookie 管理
- 获取所有 Cookie：get_cookies()
- 获取单个 Cookie：get_cookie(name)
- 添加 Cookie：add_cookie({"name": "key", "value": "val"})
- 删除 Cookie：delete_cookie(name)、delete_all_cookies()
- 应用场景：保持登录状态

### 截图功能
- 全页截图：get_screenshot_as_file("path.png")
- 元素截图：element.screenshot("path.png")
- Base64 截图：get_screenshot_as_base64()
- 失败截图：异常捕获时自动截图

## 进阶篇：Page Object 模式

### 设计模式
- 页面对象：封装页面元素和操作
- 业务逻辑分离：测试脚本只关注业务流程
- 可维护性：元素定位变化只改一处
- 可复用性：多个测试共享页面对象

### 基础结构
- 页面类：LoginPage、HomePage
- 元素定位：类属性或方法
- 操作方法：login()、search()
- 断言方法：is_logged_in()

### BasePage 封装
- 公共方法：find_element、wait_for_element
- 驱动传递：构造函数注入
- 工具方法：截图、日志

### PageFactory
- Java 中的 @FindBy 注解
- Python 中的第三方库（selenium-page-factory）
- 延迟加载：页面初始化时不查找元素

## 实战篇：测试框架集成

### Pytest 集成
- Fixture：共享 WebDriver 实例
- setup/teardown：启动/关闭浏览器
- 参数化：多浏览器测试
- 标记：smoke、regression
- 失败重试：pytest-rerunfailures

### JUnit 集成
- @BeforeAll/@AfterAll：全局设置
- @BeforeEach/@AfterEach：每个测试设置
- WebDriver 管理：单例或工厂模式
- TestWatcher：失败截图

### 数据驱动测试
- CSV、JSON、Excel：测试数据源
- 参数化：遍历数据执行测试
- 分离数据与逻辑：提高可维护性

### 报告生成
- Allure：美观的测试报告
- ExtentReports：Java 测试报告
- pytest-html：HTML 报告
- 截图集成：失败时自动添加

## 实战篇：Selenium Grid

### Grid 架构
- Hub：中心节点，分发测试
- Node：执行节点，运行浏览器
- 并行执行：多节点同时运行
- 跨平台：Windows、Linux、Mac
- 跨浏览器：Chrome、Firefox、Safari

### Grid 4 特性
- 完全分布式：无中心节点模式
- GraphQL API：查询 Grid 状态
- Docker 支持：容器化部署
- 可观测性：日志、追踪、指标

### 远程执行
- RemoteWebDriver：连接 Grid
- DesiredCapabilities：指定浏览器、平台
- Hub URL：http://hub:4444
- 超时设置：避免节点阻塞

### Docker 部署
- Selenium Docker 镜像
- docker-compose：Hub + Nodes
- VNC 支持：实时查看浏览器
- 录像功能：自动录制测试视频

## 实战篇：性能与优化

### 提速技巧
- 无头模式：headless 减少渲染开销
- 禁用图片：--blink-settings=imagesEnabled=false
- 禁用 CSS：性能提升有限
- 并行执行：pytest-xdist、Grid
- 智能等待：显式等待代替固定等待

### 稳定性提升
- 重试机制：失败自动重试
- 显式等待：避免 NoSuchElementException
- 异常捕获：优雅处理错误
- 截图日志：问题定位
- 元素定位优化：避免脆弱定位器

### 资源管理
- 及时关闭浏览器：quit() 释放资源
- 清理驱动进程：避免僵尸进程
- 连接池管理：复用 WebDriver 实例
- 内存监控：长时间运行注意内存泄漏

### 最佳实践
- 独立性：测试间无依赖
- 原子性：一个测试一个场景
- 清理数据：测试后恢复状态
- 测试金字塔：Selenium 用于关键路径
- 分层测试：单元测试 + 集成测试 + E2E

## 实战篇：常见问题与解决

### 定位问题
- 动态 ID：用 XPath 的 contains()
- 重复元素：用索引或更精确的定位
- Shadow DOM：execute_script 访问
- iframe：记得 switch_to.frame()

### 等待问题
- 元素未加载：显式等待
- 页面跳转：等待 URL 变化
- AJAX 请求：等待特定元素
- 动画效果：等待元素稳定

### 浏览器问题
- 版本不匹配：WebDriverManager 自动管理
- 驱动权限：chmod +x
- 端口占用：换端口或 kill 进程
- 沙箱问题：--no-sandbox（Docker 环境）

### 性能问题
- 测试太慢：并行执行、无头模式
- 内存泄漏：及时 quit()
- 网络慢：Mock API、本地环境

## 下一步学习

掌握 Selenium 后，可以探索更多自动化测试领域：

- **Appium** - 移动端自动化测试（基于 Selenium）
- **Cypress** - 现代前端测试框架
- **Playwright** - 微软出品的浏览器自动化
- **Robot Framework** - 关键字驱动自动化框架
- **Puppeteer** - Chrome DevTools Protocol 自动化
- **TestCafe** - 无需 WebDriver 的 E2E 测试

Selenium 是浏览器自动化的瑞士军刀，能干的事情远超测试。爬虫需要它，RPA 需要它，UI 测试更离不开它。虽然它有时候慢、有时候不稳定，但只要掌握好等待机制和 Page Object 模式，Selenium 依然是最可靠的选择。记住，自动化测试不是为了完全替代手工测试，而是为了把人从重复劳动中解放出来。有了 Selenium，你会发现回归测试不再可怕。
