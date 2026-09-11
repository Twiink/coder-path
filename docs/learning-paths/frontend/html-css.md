# HTML & CSS 学习路线

HTML 是网页的骨架，CSS 是网页的皮肤——这对搭档就像乐高积木和喷漆：HTML 搭出形状，CSS 涂上颜色。它俩严格来说不算编程语言（没有 if、没有 for、没有变量），但千万别因此小看它们。盒模型能把人绕晕、层叠优先级能让样式失效、BFC 听起来像某种医学术语、Flexbox 和 Grid 分不清场合就会打架——这些"看起来简单"的东西，恰恰是前端面试里"人人都觉得自己会，一深问就全军覆没"的重灾区。

更要命的是：**写对容易，写好很难**。页面能显示不代表语义化、能看不代表无障碍、能用不代表响应式、漂亮不代表性能好。HTML 和 CSS 是前端的地基，地基不牢全是空中楼阁。React 写得再溜，DOM 结构一坨、CSS 选择器乱飞、重排重绘满天飞，照样是半吊子。

这条路线是**索引和指引**，告诉你该学什么、重点在哪、顺序是什么。具体标签怎么嵌套、属性怎么组合、样式怎么调、兼容性怎么处理，那是学习笔记的事。

## 第一站：HTML 结构与语义

欢迎来到 HTML 的建筑工地：DOCTYPE 是开工许可证，html 是整栋楼，head 负责和搜索引擎打招呼，body 才是住户真正看得见的房间。这里的标签不是随手画的框，每个元素都有岗位；div 不是万能胶，能用语义标签就别让它一个人加班。

**文档结构三件套** ---- DOCTYPE 是文档类型声明避免怪异模式、html 根元素包裹一切、lang 属性声明语言帮助搜索引擎和无障碍工具

**head 里的元信息** ---- meta charset 防止乱码必须有、meta viewport 让移动端页面正常显示、meta description 是搜索引擎摘要的来源、title 是标签页标题也是 SEO 第一要素、link 引入外部 CSS 样式表、script 引入 JavaScript 最好放底部或加 defer 和 async

**语义化标签家族** ---- header 页头区域、nav 导航区域、main 主内容区域一个页面只能有一个、article 独立完整的内容如博客文章、section 章节用于划分文档区域、aside 侧边栏或附加信息、footer 页脚区域，这些标签告诉机器内容是什么不只是 div

**为什么要语义化** ---- SEO 友好搜索引擎能更好理解页面结构、屏幕阅读器友好视障用户能正确导航、代码可读性高一眼看懂页面结构、维护成本低语义清晰改起来不懵

**标题六兄弟** ---- h1 是页面唯一的一级标题、h2 到 h6 按层级递减、不要跳级使用否则屏幕阅读器会懵、标题是内容大纲的骨架

**文本内容标签** ---- p 段落、br 换行但少用 CSS 能解决别用它、hr 分隔线、strong 重要内容粗体是语义强调、em 强调内容斜体是语气强调、mark 高亮标记像荧光笔、small 小字用于版权和免责、del 删除线、ins 插入的新内容下划线、sub 下标、sup 上标

**引用家族** ---- blockquote 块引用大段引文、q 行内引用短语、cite 引用来源如书名文章标题、abbr 缩写配合 title 属性显示完整形式

**代码家族** ---- code 行内代码、pre 预格式化保留空格和换行、kbd 键盘按键、samp 程序输出示例、var 变量名

**列表三兄弟** ---- ul 无序列表购物清单导航菜单、ol 有序列表步骤排名、dl 描述列表术语解释 FAQ，列表可以嵌套但别超过三层人眼会炸

**链接是互联网的灵魂** ---- a 标签的 href 是跳转地址、绝对路径完整 URL、相对路径从当前目录出发、锚点井号加 id 跳转到页面内位置、协议链接 mailto 发邮件 tel 打电话

**链接的安全与行为** ---- target blank 新窗口打开必须配 rel 等于 noopener noreferrer 防安全漏洞、download 属性让浏览器下载文件而不是打开、title 鼠标悬停提示

**图片必备属性** ---- src 图片地址、alt 替代文本是无障碍生命线图片挂了显示这个屏幕阅读器朗读这个、width 和 height 防止页面抖动浏览器提前留空间

**图片性能优化** ---- loading 等于 lazy 懒加载滚动到才加载首屏性能救星、srcset 提供多个分辨率让浏览器自己选、sizes 告诉浏览器该选哪个、picture 元素根据媒体查询选择不同图片

**图片格式选择** ---- JPEG 适合照片有损压缩体积小、PNG 适合透明图无损压缩支持透明度、WebP 现代浏览器首选体积小质量高、SVG 矢量图标无限缩放不失真、AVIF 最新最小但兼容性还差

**视频音频标签** ---- video 和 audio 标签类似、controls 显示播放控制条、autoplay 自动播放移动端多数被禁要配合 muted、loop 循环播放、poster 视频封面图、preload 预加载策略

**iframe 嵌入页面** ---- 嵌入其他网页的窗口、allow 控制允许的功能、sandbox 沙箱隔离控制权限、别随便嵌套不信任的页面有 XSS 风险

**表格的正确用法** ---- table 表格容器、tr 表格行、td 单元格、th 表头单元格、thead tbody tfoot 分组、caption 表格标题、colspan 横跨列、rowspan 纵跨行

**表格只用于表格数据** ---- 成绩单价格表数据列表用表格、布局别用表格那是 Grid 和 Flexbox 的活、表格布局是上世纪的技术

**表单是用户输入的桥梁** ---- form 表单容器、action 提交地址、method 提交方式 GET 或 POST、enctype 编码类型上传文件用 multipart/form-data

**input 类型大全** ---- text 文本、password 密码、email 邮箱自带格式验证、number 数字、tel 电话、url 网址、date 日期、time 时间、color 颜色选择器、checkbox 复选框、radio 单选框、file 文件上传、hidden 隐藏字段、range 滑块、search 搜索框

**表单其他控件** ---- textarea 多行文本、select 下拉选择配合 option、button 按钮、label 标签关联 input 提升可用性和无障碍

**label 为什么重要** ---- 点击标签就能聚焦输入框、增大点击区域特别是移动端、屏幕阅读器能朗读关联关系、用 for 属性对应 input 的 id

**HTML5 表单验证** ---- required 必填、pattern 正则表达式验证、min 和 max 数值范围、minlength 和 maxlength 长度限制、type 属性自带格式验证如 email 和 url

**表单状态伪类** ---- valid 通过验证、invalid 未通过验证、required 必填、optional 可选、disabled 禁用、checked 选中状态、focus 聚焦状态

**全局属性** ---- id 唯一标识页面内唯一、class 类名可以多个空格分隔、style 内联样式少用不好维护、title 鼠标悬停提示、data 横杠星号自定义数据属性存储额外信息、hidden 隐藏元素

**无障碍三件套** ---- role 定义元素角色补充语义、aria 横杠星号状态和属性如 aria-label 和 aria-hidden、tabindex 键盘导航顺序零是自然顺序负一不可聚焦正数按顺序聚焦

**特殊字符实体** ---- 小于号尖括号左、大于号尖括号右、& 符号、不断行空格、版权符号、注册商标、引号、欧元等等，防止 HTML 解析错误

**HTML 实体的用途** ---- 显示 HTML 保留字符、显示特殊符号、防止 XSS 攻击转义用户输入、保持格式不被浏览器吃掉的空格

**重点在这** ---- 语义化是灵魂机器能懂比 div 强、alt 是无障碍生命线没有它的图片是反人类设计、label 必须关联 input 的 for 和 id 对应、一个页面只有一个 h1 和一个 main 是 SEO 铁律

## 第二站：CSS 选择器与层叠

欢迎进入 CSS 的宫斗现场：选择器在争宠，层叠在排座次，!important 像拿着尚方宝剑的暴君。你要学会让样式有秩序地进入页面，而不是靠“再加一条规则试试”把代码写成悬疑剧。

**CSS 引入三种方式** ---- 外部样式表 link 标签引入是首选可复用可缓存、内部样式表 style 标签适合单页专用样式、内联样式 style 属性优先级最高但难维护只在动态样式时用、@import 在 CSS 里导入其他 CSS 会阻塞渲染别用

**基础选择器四件套** ---- 标签选择器直接写标签名如 div、类选择器点号开头最常用、ID 选择器井号开头优先级高但不复用、通配符星号选中所有元素慎用影响性能

**组合选择器** ---- 后代选择器空格分隔选中所有后代、子选择器大于号只选直接子元素、相邻兄弟选择器加号只选紧挨着的下一个、通用兄弟选择器波浪号选中后面所有同级兄弟

**属性选择器** ---- 方括号 attr 判断属性存在、等号精确匹配属性值、星号等号包含某个值、脱字符等号以某个值开头、美元符号等号以某个值结尾，选择所有 href 以 pdf 结尾的链接

**状态伪类** ---- hover 鼠标悬停、active 鼠标按下瞬间、focus 输入框聚焦、visited 访问过的链接隐私限制只能改颜色、link 未访问的链接、target 锚点目标元素

**结构伪类** ---- first-child 第一个子元素、last-child 最后一个子元素、nth-child 第 n 个子元素支持公式、nth-of-type 同类型第 n 个、only-child 唯一子元素、empty 空元素

**nth-child 的公式魔法** ---- 2n 选中偶数行、2n+1 选中奇数行、3n 每三个选一个、-n+3 选中前三个、n+3 从第三个开始选、odd 奇数等同 2n+1、even 偶数等同 2n

**表单伪类** ---- checked 选中的复选框和单选框、disabled 禁用状态、enabled 启用状态、valid 通过验证、invalid 未通过验证、required 必填、optional 可选、read-only 只读、read-write 可读写

**功能伪类** ---- not 排除某些元素、is 匹配任一选择器、where 类似 is 但优先级为零、has 父选择器终于来了选中包含某子元素的父元素

**伪元素创建虚拟元素** ---- before 在元素内容前插入、after 在元素内容后插入都需要 content 属性、first-line 选中首行文本、first-letter 选中首字母做首字母下沉、selection 改变选中文本的样式

**伪元素与伪类的区别** ---- 伪类选中已存在元素的特定状态用单冒号或双冒号、伪元素创建虚拟元素必须用双冒号、伪类不改变 DOM 结构、伪元素相当于插入了新元素

**层叠的核心规则** ---- important 最高优先级覆盖一切但是代码毒瘤、来源优先级作者样式大于用户样式大于浏览器默认、优先级计算决定冲突时谁赢、源顺序后写的覆盖先写的

**优先级计算是四位数** ---- 内联样式一千分、ID 选择器一百分、类属性伪类各十分、标签伪元素各一分，算出来分数高的获胜

**important 是代码毒瘤** ---- 用了一次就会连锁反应越用越多、打破正常的层叠规则难以维护、只在覆盖第三方库样式时万不得已才用、能用优先级解决就别用它

**继承让样式传递** ---- 可继承的属性包括所有文字相关 color font-family font-size line-height text-align letter-spacing、不可继承的属性包括盒模型 width height margin padding border 和定位 position top left 和背景 background

**控制继承的关键字** ---- inherit 强制继承父元素的值、initial 重置为 CSS 规范定义的初始值、unset 可继承就继承不可继承就 initial、revert 回退到浏览器默认或用户样式

**重点在这** ---- 优先级是四位数记住计算公式、important 是毒瘤除非万不得已别碰、伪类选状态伪元素创元素两者有本质区别、nth-child 的公式要会用 2n 偶数 2n+1 奇数

## 第三站：盒模型与布局基础

这一站全员领盒饭——不是吃饭，是每个元素都要领一个盒子。内容、内边距、边框、外边距四兄弟看似和平，遇到宽度计算和外边距折叠就开始互相甩锅；Flex 和 Grid 会来帮忙，但先把盒子脾气摸清。

**盒模型四层结构** ---- Content 内容区域存放文字图片、Padding 内边距内容和边框的缓冲区撑开背景、Border 边框包裹内容和内边距、Margin 外边距盒子和盒子的距离透明的

**标准盒模型与 IE 盒模型** ---- 标准盒模型 content-box 的 width 只包含内容、IE 盒模型 border-box 的 width 包含内容加 padding 加 border、border-box 更符合直觉所见即所得是现代开发标配

**box-sizing 救星** ---- 全局设置 box-sizing: border-box 让所有元素使用 IE 盒模型、width 就是最终宽度不用算加减法、告别 width 减 padding 减 border 的噩梦

**Margin 的诡异行为** ---- 外边距折叠垂直方向相邻块级元素 margin 会合并取较大值、触发条件是相邻兄弟或父子之间没有 border padding 隔开或空块元素自己的上下 margin 合并、避免方法是触发 BFC 或使用 padding 代替

**负 Margin 的魔法** ---- 负值让元素向指定方向移动可以重叠、上左负值元素自己移动、下右负值后面元素移动、现在有 Flexbox 和 Grid 少用负 margin

**Margin auto 居中** ---- 块级元素设置左右 margin: auto 可以水平居中、前提是元素有固定宽度、原理是自动分配剩余空间到左右外边距、垂直方向不行因为高度默认 auto

**Padding 撑开盒子** ---- padding 不能为负值、继承父元素背景色、会撑大元素除非 box-sizing: border-box、内边距用于内容和边框的间距

**Border 三件套** ---- border-width 边框宽度、border-style 边框样式 solid 实线 dashed 虚线 dotted 点线 double 双线 none 无边框、border-color 边框颜色、简写 border: 1px solid #000

**Border 的高级用法** ---- border-radius 圆角四个值对应左上右上右下左下、50% 是正圆、单边控制 border-top-left-radius、椭圆圆角用斜杠分隔水平和垂直半径

**Flexbox 一维布局神器** ---- 弹性盒子沿主轴排列项目、容器 display: flex 启动、子元素自动变成 flex 项目、主轴和交叉轴是核心概念

**Flexbox 容器属性** ---- flex-direction 主轴方向 row 水平 column 垂直、flex-wrap 是否换行 nowrap 不换行 wrap 换行、justify-content 主轴对齐方式、align-items 交叉轴对齐方式、align-content 多行对齐方式、gap 项目间距

**justify-content 主轴对齐** ---- flex-start 起点对齐、center 居中对齐、flex-end 终点对齐、space-between 两端对齐中间均分最常用、space-around 环绕间距每个项目两侧间距相等、space-evenly 完全均分所有间距相等

**align-items 交叉轴对齐** ---- stretch 默认拉伸填满容器高度、flex-start 起点对齐、center 居中对齐是垂直居中救星、flex-end 终点对齐、baseline 基线对齐文字底部对齐

**Flexbox 项目属性** ---- flex-grow 放大比例默认零不放大、flex-shrink 缩小比例默认一会缩小、flex-basis 初始大小默认 auto、flex 简写最常用、order 排序不改 DOM 顺序、align-self 单独设置交叉轴对齐

**flex 简写的常用值** ---- flex: 1 等同于 1 1 0% 等分所有空间最常用、flex: auto 等同于 1 1 auto 按内容大小分配后再等分剩余空间、flex: none 等同于 0 0 auto 不伸缩保持原大小

**Grid 二维布局系统** ---- 网格布局同时控制行和列、容器 display: grid 启动、子元素自动变成 grid 项目、比 Flexbox 强在整体布局

**Grid 容器属性** ---- grid-template-columns 定义列宽、grid-template-rows 定义行高、grid-template-areas 区域命名布局、gap 网格间距、justify-items 和 align-items 项目对齐方式

**Grid 列宽定义方式** ---- 固定值如 100px 200px 300px、fr 单位弹性比例 1fr 1fr 1fr 三等分、repeat 函数简化重复 repeat(3, 1fr)、minmax 函数最小最大值 minmax(100px, 1fr) 响应式神器、auto-fill 和 auto-fit 自动填充列数

**Grid 项目属性** ---- grid-column 列位置简写 1 / 3 从第一列到第三列、grid-row 行位置语法相同、grid-area 区域名称或位置简写、justify-self 和 align-self 单独对齐

**定位五兄弟** ---- static 默认值正常文档流、relative 相对定位相对自己偏移不脱离文档流、absolute 绝对定位相对最近非 static 祖先脱离文档流、fixed 固定定位相对视口脱离文档流、sticky 粘性定位阈值内 relative 超出变 fixed

**定位的配套属性** ---- top right bottom left 控制偏移距离、z-index 控制层叠顺序只对定位元素有效数字越大越上面、定位元素脱离文档流不占据空间

**absolute 的常见用法** ---- 配合 relative 父元素使用实现相对父元素定位、子绝父相是经典模式、用于弹出层遮罩层图标定位

**fixed 固定定位** ---- 相对浏览器视口定位、滚动页面不动、常用于导航栏吸顶返回顶部按钮、注意会脱离文档流

**sticky 粘性定位** ---- 平时是 relative 滚动到阈值变 fixed、用 top right bottom left 设置阈值、常用于表头固定侧边栏跟随、兼容性需要注意

**浮动是上古技术** ---- float 让元素脱离文档流向左或右浮动、文字环绕效果、clear 清除浮动影响、除了文字环绕图片其他场景用 Flexbox 和 Grid

**清除浮动的方法** ---- 父元素 overflow: hidden 触发 BFC、clearfix 伪元素经典方案、空 div 加 clear: both 不推荐增加无意义标签

**重点在这** ---- box-sizing: border-box 是标配 width 包含 padding 和 border、外边距折叠是大坑垂直方向会合并、Flexbox 适合一维布局主轴交叉轴是核心、Grid 适合二维布局行列同时控制、absolute 要配合 relative 父元素子绝父相、sticky 是神器表头固定侧边栏跟随

## 第四站：响应式设计

欢迎来到网页的变形金刚训练营：同一份页面要在手机、平板、笔记本和巨型显示器上都能体面工作。媒体查询是变形按钮，流式布局是骨骼，移动优先则是先保证小屏别摔倒，再让大屏长得更舒展。

**响应式设计的核心理念** ---- 一套代码适配所有设备、流式布局而不是固定宽度、图片和媒体自适应、根据设备特性应用不同样式

**媒体查询基础语法** ---- @media 规则根据设备特性应用样式、媒体类型 screen 屏幕 print 打印 all 所有设备、媒体特性查询宽高方向分辨率等

**常用媒体特性** ---- width 和 height 视口宽高、min-width 和 max-width 最小最大宽度最常用、orientation 横屏 landscape 竖屏 portrait、resolution 屏幕分辨率、aspect-ratio 宽高比

**逻辑操作符** ---- and 且多个条件同时满足、逗号 or 或任一条件满足、not 非排除某些条件、only 兼容老浏览器现在基本不用

**移动优先是标准策略** ---- 默认样式写小屏手机、用 min-width 向上扩展到大屏、渐进增强而不是优雅降级、先保证小屏能用再优化大屏

**常见断点值** ---- 576px 小手机、768px 平板竖屏、992px 小屏笔记本、1200px 普通桌面、1400px 大屏显示器，跟着主流 UI 框架走别自己乱定

**响应式单位大全** ---- em 相对父元素 font-size 嵌套会累积不推荐、rem 相对根元素 font-size 最常用统一缩放、百分比相对父元素宽度、vw 和 vh 视口宽高的百分之一、vmin 和 vmax 视口较小较大边的百分之一

**rem 是响应式主力** ---- 根元素设置 font-size 如 16px、整个页面用 rem 单位、改一个地方全站缩放、配合媒体查询实现响应式字体

**视口单位的妙用** ---- 100vw 是整个视口宽度、100vh 是整个视口高度、全屏元素不用计算、注意移动端浏览器地址栏会影响 vh

**Viewport Meta 标签** ---- meta name viewport 是移动端必须加的、width=device-width 让页面宽度等于设备宽度、initial-scale=1 初始缩放比例一比一、没有这行移动端会用 980px 桌面视口页面会缩成小字

**响应式图片** ---- img 加 max-width: 100% 和 height: auto 图片不超出容器、srcset 提供多个分辨率浏览器自动选择、sizes 告诉浏览器图片显示尺寸、picture 元素完全控制根据媒体查询选图片

**流式布局** ---- 宽度用百分比而不是固定像素、max-width 限制最大宽度防止过宽、min-width 限制最小宽度防止过窄、Flexbox 和 Grid 天然支持流式布局

**响应式排版** ---- 字体大小用 rem 或 vw 单位、clamp 函数实现流畅响应式字体、行高用无单位数值相对 font-size、段落宽度控制在 60-80 字符最佳阅读

**触摸友好设计** ---- 按钮最小 44x44 像素符合苹果指南、元素间距足够大防止误触、hover 状态在触摸设备无效要考虑 active、避免依赖 hover 显示重要信息

**重点在这** ---- 移动优先是标准默认小屏 min-width 向上扩展、rem 是主力单位根元素统一缩放、常见断点记住不要自己乱定、viewport meta 必加移动端不加等于没做响应式

## 第五站：动画与过渡

这一站请动画演员登场：transition 负责优雅转身，animation 负责完整舞台剧，transform 负责少搬家具。动画做得好是引导，做得过头就是网页在晕车；还要记得尊重不喜欢动态效果的用户。

**Transition 过渡基础** ---- 适合简单交互如 hover 和 focus 状态变化、自动在两个状态间平滑过渡、需要触发器如伪类或 JavaScript、四个属性控制过渡效果

**Transition 四属性** ---- transition-property 指定过渡的属性 all 或具体属性、transition-duration 持续时间如 0.3s 或 300ms、transition-timing-function 缓动函数控制变化速度、transition-delay 延迟时间多久后开始

**缓动函数大全** ---- ease 默认慢快慢先加速后减速、linear 匀速恒定速度、ease-in 慢入加速开始、ease-out 慢出减速结束最常用、ease-in-out 慢入慢出两头慢中间快、cubic-bezier 自定义贝塞尔曲线完全控制

**可过渡的属性** ---- 颜色 color background-color、尺寸 width height、位置 top left transform、透明度 opacity、阴影 box-shadow text-shadow，不是所有属性都能过渡如 display

**Animation 动画系统** ---- 适合复杂动画需要精确控制关键帧、@keyframes 定义动画序列、animation 属性应用动画到元素、可以无限循环往复播放

**@keyframes 定义关键帧** ---- 用 from 和 to 或百分比定义动画节点、from 等于 0% 是开始、to 等于 100% 是结束、中间可以定义任意百分比关键帧

**Animation 八属性** ---- animation-name 动画名称对应 keyframes、animation-duration 持续时间、animation-timing-function 缓动函数、animation-delay 延迟、animation-iteration-count 重复次数 infinite 无限、animation-direction 方向 normal reverse alternate、animation-fill-mode 填充模式、animation-play-state 播放状态 running 或 paused

**animation-direction 方向控制** ---- normal 正向播放、reverse 反向播放、alternate 来回交替做乒乓球效果、alternate-reverse 反向开始的来回交替

**animation-fill-mode 填充模式** ---- none 默认动画前后不应用样式、forwards 保持结束状态、backwards 立即应用开始状态、both 两者都要

**Transform 变换性能之王** ---- 性能最好触发 GPU 加速不引起重排、translate 平移 translateX translateY translateZ、rotate 旋转 rotateX rotateY rotateZ、scale 缩放 scaleX scaleY、skew 倾斜 skewX skewY

**Transform 组合变换** ---- 多个变换空格分隔一起写、执行顺序从右到左要注意、transform-origin 变换原点默认中心可改、3D 变换需要 perspective 透视

**will-change 性能优化** ---- 告诉浏览器哪些属性即将变化、浏览器提前优化创建合成层、别滥用会消耗内存、动画开始前加结束后移除

**硬件加速的触发** ---- transform 尤其是 translateZ 或 translate3d、opacity 透明度变化、filter 滤镜、will-change 提前告知、这些属性只触发合成不触发重排重绘

**性能优化原则** ---- 优先用 transform 和 opacity 性能最好、避免动画 width height margin 等会触发重排的属性、用 requestAnimationFrame 代替 setInterval、复杂动画考虑用 Web Animations API 或库

**常见动画模式** ---- 淡入淡出改变 opacity、滑入滑出用 transform: translateX、缩放用 transform: scale、旋转用 transform: rotate、弹跳效果用 cubic-bezier 或 steps

**steps 步进函数** ---- steps(n) 把动画分成 n 步跳跃式前进、step-start 等于 steps(1, start) 立即跳到结束、step-end 等于 steps(1, end) 等到结束才跳、适合精灵图逐帧动画

**重点在这** ---- Transition 适合简单交互 hover focus 状态变化、Animation 适合复杂动画关键帧精确控制、Transform 性能最好 GPU 加速不触发重排、will-change 提前优化告诉浏览器即将变化但别滥用

## 第六站：BFC 与层叠上下文

这里是 CSS 的地下城：BFC 管地盘，层叠上下文管楼层，margin 折叠和 z-index 都可能在角落里埋伏。理解这两套隐藏规则，你就能解释“为什么它突然跑了”和“为什么 z-index 加到一百万还在下面”。

**BFC 块级格式化上下文** ---- Block Formatting Context 是 CSS 渲染的独立区域、内部布局不影响外部、有特殊的布局规则和特性

**BFC 的触发条件** ---- 根元素 html 自带、float 不是 none 的浮动元素、position 是 absolute 或 fixed 的定位元素、display 是 inline-block flex grid table-cell 等、overflow 不是 visible 最常用 overflow: hidden

**BFC 的布局规则** ---- 内部盒子垂直方向一个接一个放置、盒子垂直距离由 margin 决定同一个 BFC 内会折叠、BFC 区域不与浮动盒子重叠、BFC 是独立容器内外互不影响、计算 BFC 高度浮动元素也参与

**BFC 的三大特性** ---- 包含内部浮动父元素高度不塌陷、排斥外部浮动不被浮动元素覆盖、阻止外边距折叠不和外部 margin 合并

**BFC 解决高度塌陷** ---- 父元素没有高度子元素浮动父元素高度为零、给父元素触发 BFC 如 overflow: hidden、BFC 会包含浮动子元素计算高度

**BFC 实现两栏布局** ---- 左边固定宽度浮动、右边触发 BFC 如 overflow: hidden 自适应剩余宽度、右边不会被左边浮动元素覆盖

**BFC 防止外边距折叠** ---- 相邻块级元素垂直 margin 会合并、给其中一个包裹容器并触发 BFC、两个元素不在同一 BFC 内不会折叠

**层叠上下文的概念** ---- Stacking Context 是 3D 空间概念、决定元素在 z 轴上的层叠顺序、类似 Photoshop 图层的概念

**层叠上下文的触发** ---- 根元素 html 天生是、position 不是 static 且 z-index 不是 auto、opacity 小于 1、transform 不是 none、filter 不是 none、will-change 包含 transform opacity filter、flex 或 grid 子项且 z-index 不是 auto

**层叠顺序从下到上** ---- 层叠上下文的 background 和 border 最底层、负 z-index 的子层叠上下文、块级盒子、浮动盒子、行内盒子、z-index: 0 或 auto 的定位元素、正 z-index 的子层叠上下文最上层

**父子层叠上下文的陷阱** ---- 子元素的 z-index 只在父层叠上下文内有效、父元素 z-index 是 1 子元素 z-index 再大也比不过另一个父元素 z-index 是 2 的元素、层叠上下文嵌套子元素不能跨越父元素边界

**z-index 的工作原理** ---- 只对定位元素有效 static 无效、同一层叠上下文内数字越大越靠上、默认值是 auto 不创建新层叠上下文、设置具体数值会创建新层叠上下文

**层叠上下文的常见应用** ---- 模态框遮罩层设置高 z-index、导航栏固定定位避免被遮挡、下拉菜单确保在最上层、工具提示 tooltip 显示在内容上方

**避免层叠问题的技巧** ---- 扁平化层级减少嵌套、统一管理 z-index 值如定义变量、避免过大的 z-index 如 9999、理解层叠上下文边界不盲目加 z-index

**重点在这** ---- BFC 是布局神器清除浮动防止外边距折叠自适应布局、overflow: hidden 是最简单的 BFC 触发方式、层叠上下文嵌套子元素 z-index 只在父内部有效、z-index 只对定位元素有效 static 不行

## 第七站：现代 CSS 特性

最后来到 CSS 的新装备商店：变量负责记账，函数负责算数，容器查询负责让组件看环境行事，级联层负责给层叠秩序立规矩。现代 CSS 不再只是“写属性”，它正在慢慢长出自己的编程脑袋。

**CSS 自定义属性即变量** ---- 双横线开头定义变量如 --main-color、var 函数使用变量、:root 定义全局变量、选择器内定义局部变量作用域内生效

**CSS 变量的优势** ---- 可维护改一处全局生效、可复用避免重复、可动态 JavaScript 可以修改、可继承子元素继承父元素的变量

**CSS 变量的作用域** ---- :root 伪类定义的是全局变量整个文档可用、选择器内定义的是局部变量只在该选择器及子元素生效、局部变量覆盖全局变量

**CSS 变量的回退值** ---- var 函数第二个参数是回退值、变量不存在时使用回退值、可以嵌套回退 var(--a, var(--b, red))

**CSS 变量的实战应用** ---- 主题切换定义不同主题的变量值、组件样式组件内定义局部变量、响应式设计媒体查询内改变变量值、动画过渡变量值可以过渡

**calc 计算函数** ---- 执行数学计算混合不同单位、加减乘除四则运算、加减两侧要有空格、常用于流式布局 width: calc(100% - 20px)

**min max clamp 函数** ---- min 返回最小值如 width: min(500px, 100%)、max 返回最大值如 width: max(300px, 50%)、clamp 限制范围 clamp(最小值, 理想值, 最大值) 响应式神器

**clamp 响应式字体** ---- font-size: clamp(1rem, 2vw, 2rem) 最小 1rem 理想 2vw 最大 2rem、自适应字体大小不用媒体查询、在最小最大之间流畅变化

**颜色函数** ---- rgb 和 rgba 红绿蓝和透明度、hsl 和 hsla 色相饱和度亮度和透明度、hwb 色相白度黑度新函数、lab 和 lch 感知均匀的色彩空间

**容器查询** ---- @container 根据容器尺寸应用样式、比媒体查询更精细组件级响应式、container-type 定义容器类型 size 或 inline-size、container-name 命名容器便于查询

**容器查询的优势** ---- 组件可以在任何位置自适应、不依赖视口大小依赖容器大小、真正的组件级响应式、未来会替代部分媒体查询

**aspect-ratio 宽高比** ---- 设置元素宽高比如 aspect-ratio: 16/9、保持比例不变形、视频容器卡片布局常用、配合 width: 100% 自适应高度

**object-fit 图片填充** ---- 控制替换元素如 img video 的填充方式、cover 填满容器裁剪溢出、contain 完整显示留白、fill 拉伸填满变形、none 保持原始尺寸、scale-down 取 none 和 contain 较小者

**backdrop-filter 背景滤镜** ---- 对元素背后区域应用滤镜、blur 模糊做毛玻璃效果、brightness 亮度 contrast 对比度、saturate 饱和度 hue-rotate 色相旋转

**scroll-behavior 平滑滚动** ---- 设置 scroll-behavior: smooth、锚点跳转不再生硬平滑滚动过去、滚动 API 也会平滑如 scrollTo、可以在 html 上全局设置

**scroll-snap 滚动吸附** ---- scroll-snap-type 容器上设置吸附类型和方向、scroll-snap-align 子元素上设置对齐方式、轮播图全屏滚动常用、用户体验好自动对齐

**逻辑属性** ---- 替代物理属性适配不同书写方向、margin-inline-start 代替 margin-left、padding-block 代替 padding-top 和 padding-bottom、inline 是行内方向 block 是块方向

**功能伪类增强** ---- :is 匹配任一选择器简化代码、:where 类似 :is 但优先级为零、:has 父选择器根据子元素选父元素革命性突破

**:has 伪类的强大** ---- 选中包含特定子元素的父元素、表单验证样式根据输入状态改变父容器、卡片布局根据有无图片调整、反向选择不再需要 JavaScript

**重点在这** ---- CSS 变量是主题系统基础全局变量局部覆盖 JavaScript 动态修改、calc 混合单位解决固定加流式布局、clamp 响应式神器自适应字体不用媒体查询、容器查询是未来组件级响应式不依赖视口

## 通关标准

**新手村出门证** ---- 能写出语义清楚的 HTML，知道标题、表单、图片和链接不是随便换皮的 div；CSS 能控制颜色、间距和基础布局，盒模型不再像四个互相隐瞒体重的盒子。页面能跑，但改一个 padding 可能全家搬家。面试问为什么要用 label？你开始翻笔记。

**初级前端通行证** ---- 能用 Flex、Grid、定位和媒体查询还原常见页面，能处理响应式、表单状态、图片尺寸和基础动画；知道什么时候该用哪种布局，不再靠“多加一个 margin 试试”。面试问 margin 为什么折叠？你开始喝水。

**中级前端护照** ---- 能解释 BFC、层叠上下文、重排重绘、容器查询和自定义属性，能设计可复用的布局与主题系统；看到样式冲突能找出真正的层叠原因，而不是给所有东西加 important。面试问 z-index 为什么不听话？你开始冒汗。

**高级前端登机牌** ---- 能把语义、无障碍、响应式、性能、设计系统和 CSS 架构放在同一张图上，能带团队建立规范并处理浏览器差异；写出来的样式既好看又能活得久。面试官问“你还有什么要问我的？”时，你终于有问题可问。

## 下一站去哪

HTML 和 CSS 是前端的地基，地基打牢了才能往上建：

- **[JavaScript](/learning-paths/frontend/javascript)** ---- 加上逻辑和交互让页面动起来，前端三大件的第三件
- **[TypeScript](/learning-paths/frontend/typescript)** ---- 类型安全的 JavaScript 大厂标配
- **[Tailwind CSS](/learning-paths/frontend/tailwind)** ---- 原子化 CSS 框架不用写 CSS 类名直接用工具类
- **[React](/learning-paths/frontend/react)** / **[Vue](/learning-paths/frontend/vue)** ---- 组件化开发现代前端框架
- **[Vite](/learning-paths/frontend/vite)** ---- 现代构建工具开发体验极佳

往深了学：CSS 预处理器 Sass Less Stylus 变量嵌套混合，PostCSS 插件生态自动添加浏览器前缀，CSS-in-JS styled-components Emotion 组件内写样式。往工程化方向：设计系统 Design System 统一设计语言，组件库开发 Storybook 组件文档和测试，CSS 架构 BEM OOCSS SMACSS 命名和组织方法论。

## 结语

HTML 和 CSS 看起来简单，打开浏览器就能写就能看到效果，但要用好它们需要对浏览器渲染、布局原理、性能优化有深刻理解。

盒模型、BFC、层叠上下文，这些概念是"会用"和"用好"的分水岭。会用是知道语法能写出来，用好是理解原理知道为什么这么写、什么时候这么写、怎么写性能最好。

别觉得它们"不是编程语言"就轻视，前端面试里 HTML 和 CSS 的权重一点不低。语义化、无障碍、性能优化——这三个词是 HTML 和 CSS 的灵魂。

**语义化**让机器能懂 ---- SEO 友好搜索引擎能更好理解页面结构、屏幕阅读器友好视障用户能正确导航、代码可读性高团队协作效率更高

**无障碍**让所有人能用 ---- 键盘导航视力正常但不用鼠标的用户、alt 属性图片挂了或视障用户能知道是什么、ARIA 标签补充语义让辅助技术理解交互组件、颜色对比度色盲用户也能看清内容

**性能优化**让页面快 ---- 减少重排重绘避免触发布局计算、懒加载图片和媒体滚动到才加载、关键 CSS 内联首屏样式优先加载、代码分割按需加载非首屏样式

Flexbox 和 Grid 已经解决了百分之九十的布局问题，浮动和表格布局已经是历史。CSS 变量、容器查询、has 伪类等现代特性正在让 CSS 越来越强大。

但核心原理不变：**盒模型、层叠优先级、BFC、渲染性能**——掌握了这些，你写的代码才能又快又稳。

别被各种新特性迷惑，地基打牢比追新更重要。当你能随手写出语义化的 HTML，能用 BFC 解决布局问题，能优化页面避免重排重绘，能在 Chrome DevTools 里分析渲染性能——恭喜，你已经不再是"会写 HTML 和 CSS"，而是"懂前端布局和渲染"了。

这门手艺越学越有意思。**Go！**
