# HTML & CSS 学习路线

HTML 是网页的骨架,CSS 是网页的皮肤。它俩严格来说不算编程语言——HTML 是"搭积木",CSS 是"化妆"。但别小看这对组合:它们是你在浏览器里看到的一切的起点,也是前端面试里"人人都觉得自己会,一深问就露馅"的重灾区——盒模型、层叠优先级、BFC、Flex 与 Grid 的分工,随便一个都能拦住一大半人。

这条线带你从"能拼出页面"走到"各种设备上都好看":**骨架(HTML)→ 化妆入门(CSS)→ 布局(现代排版)→ 动效与进阶特性 → 工程化**。知识点尽量一次铺全,常用的要会用,不常用的至少混个脸熟——写页面时想不起来,但看到别人的代码要认得。

## 第一站:HTML——先搭一副好骨架

HTML 的职责是**描述内容的结构和语义**,不是好看。页面骨架:`<!DOCTYPE html>` 声明(告诉浏览器按 HTML5 标准渲染,不写会触发"怪异模式",布局各种对不齐)、`<html lang="zh-CN">`(lang 属性影响屏幕阅读器发音与翻译)、`&lt;head&gt;` 放元信息与资源引用、`&lt;body&gt;` 放可见内容。
`&lt;head&gt;` 里的常客:`<meta charset="UTF-8">`(编码声明,乱码多半是它丢了)、`<meta name="viewport" content="width=device-width, initial-scale=1">`(移动端必须,否则手机上看网页像看缩小的大报纸)、`&lt;title&gt;`(标题,SEO 与浏览器标签页)、`<meta name="description">`(搜索摘要)、Open Graph 标签(`og:title` 等,控制分享到微信/社交平台时的卡片)、`<link rel="icon">`(favicon)、`<link rel="stylesheet">` 引样式;`&lt;style&gt;` 内联样式块。
还要认识**全局属性**:`id`(页面内唯一,锚点与 JS 钩子)、`class`、`title`(悬停提示)、`data-*`(自定义数据,配合 JS 的 dataset)、`lang`/`dir`(文字方向)、`hidden`(隐藏)、`contenteditable`(让元素可编辑)、`tabindex`(键盘 Tab 顺序,无障碍关键)、`role`/`aria-*`(ARIA 无障碍属性)。
特殊字符用**字符实体**:`&nbsp;`(不换行空格)、`&amp;`、`&lt;`/`&gt;`、`&copy;`。

**语义化标签**是 HTML5 的明星:页面分区用 `&lt;header&gt;`/`&lt;nav&gt;`/`&lt;main&gt;`/`&lt;article&gt;`(独立内容块)/`&lt;section&gt;`(主题分区,一般带标题)/`&lt;aside&gt;`(侧栏/相关阅读)/`&lt;footer&gt;`。
原则:能用语义标签就别 `div` 一把梭——`div` 是"无语义万能盒",全 div 的页面在搜索引擎和无障碍工具眼里是信息砖墙。文本与排版标签全家:标题 `h1`-`h6`(一页只有一个 h1;层级是目录)、段落 `<p>`、强调 `&lt;strong&gt;`(重要)/`&lt;em&gt;`(重读,别当粗体斜体用)、引用 `&lt;blockquote&gt;`/`<q>`/`&lt;cite&gt;`(作品名)、行内代码 `&lt;code&gt;`/`&lt;pre&gt;`(保留空白,代码块)、`&lt;abbr&gt;`(缩写,title 给全称)、`&lt;mark&gt;`(高亮)、`&lt;time&gt;`(时间)、`&lt;sub&gt;`/`&lt;sup&gt;`(上下标)、`&lt;kbd&gt;`(键盘按键)、`<s>`(删除线)/`&lt;del&gt;`/`&lt;ins&gt;`、换行 `&lt;br&gt;`/分隔 `&lt;hr&gt;`(现在 hr 常当装饰线用)。
列表:无序 `&lt;ul&gt;`、有序 `&lt;ol&gt;`(start/reversed/type)、描述列表 `&lt;dl&gt;`(`&lt;dt&gt;` 术语 + `&lt;dd&gt;` 描述,术语表/键值对的语义正确姿势)。

**链接**:相对路径与绝对路径、锚点(`href="#id"` 页内跳转)、`download` 属性(强制下载)、`mailto:`/`tel:` 协议链接、`target="_blank"` 新窗口开(务必加 `rel="noopener"`,否则新页面能通过 window.opener 操控原页面,安全漏洞)。
**图片**:`&lt;img&gt;` 必须写 `alt`(加载失败时替代文案,屏幕阅读器靠它读图);`width`/`height` 给占位防布局抖动;**`srcset` + `sizes`**(同一张图按屏宽给不同分辨率,响应式图片的正解)、`&lt;picture&gt;` 元素(按条件给不同格式,如 WebP 降级)、`loading="lazy"` 懒加载、`decoding="async"`。
**多媒体**:`&lt;video&gt;`/`&lt;audio&gt;` 的属性全会:`controls`(控制条)、`autoplay`(通常配 muted,浏览器才允许自动播)、`loop`、`muted`、`poster`(视频封面)、`preload`;内部 `&lt;source&gt;` 给多格式、`<track kind="captions">` 加字幕;`&lt;iframe&gt;` 嵌外部页面(`sandbox` 属性限制权限、`loading="lazy"`)。
**表格**:`&lt;table&gt;` + `&lt;caption&gt;`(表标题)+ `&lt;thead&gt;`/`&lt;tbody&gt;`/`&lt;tfoot&gt;` + `&lt;tr&gt;`/`&lt;th&gt;`(表头,`scope="col/row"` 声明方向)/`&lt;td&gt;`,合并用 `colspan`/`rowspan`——只用来展示数据,别拿表格排版。
**表单**是交互重地:`&lt;form&gt;` 的属性(`action`/`method`/`enctype`/`novalidate`),`&lt;input&gt;` 的 type 大家族:text/password/email/url/tel/number/range/color/date/time/checkbox/radio/file/search/hidden;通用属性:`placeholder`/`value`/`required`/`pattern`(正则校验)/`min`/`max`/`step`/`maxlength`/`readonly`(可提交不可改)/`disabled`(不可提交)/`checked`/`selected`/`multiple`/`autocomplete`(自动填充,on/off/new-password);`<label for>` 关联控件(点标签聚焦,无障碍底线);分组 `&lt;fieldset&gt;` + `&lt;legend&gt;`;`&lt;select&gt;` + `&lt;optgroup&gt;` 分组选项;`&lt;textarea&gt;`、`&lt;button&gt;`(type 默认是 submit,别忘)、`&lt;datalist&gt;`(给 input 提供建议下拉)、`&lt;output&gt;`(显示计算结果)。
表单校验:HTML5 内置校验(required/pattern/type 自带,如 email 格式)与 JS 的 `checkValidity()` 配合。

**HTML5 新标签与 API**:`&lt;details&gt;`/`&lt;summary&gt;`(折叠面板,零 JS)、`&lt;dialog&gt;`(原生对话框,`showModal()`)、`&lt;progress&gt;`/`&lt;meter&gt;`、`&lt;canvas&gt;`(画布,配合 JS 绘图)、`&lt;svg&gt;`(矢量图,图标首选,`&lt;symbol&gt;`/`&lt;use&gt;` 做图标系统)、`&lt;template&gt;`(模板内容,JS 克隆)、`&lt;figure&gt;`/`&lt;figcaption&gt;`(插图+题注);浏览器 API(本地存储、Geolocation、Web Worker、WebSocket 等)大多要配 JavaScript 用,见 [JavaScript 学习路线](/learning-paths/frontend/javascript) 的浏览器章。
**可访问性(a11y)**是专业分水岭:语义标签本身就是无障碍(landmark),加 `alt`/`label`/`aria-label`、保证键盘可达(`tabindex`/焦点样式)、颜色对比度(正文至少 4.5:1)、`prefers-reduced-motion` 尊重用户"减少动效"设置。
**性能意识**:CSS 放 head 阻塞渲染、`&lt;script&gt;` 默认阻塞解析——`defer`(DOM 解析完执行,多个按顺序)与 `async`(下载完就执行,不保证顺序)的区别必考;`<link rel="preload">` 提前加载关键资源。

## 第二站:CSS 入门——选择器、层叠与盒模型

CSS 引入方式:外链 `&lt;link&gt;`(推荐)、`&lt;style&gt;` 内嵌、行内 style(最高优先级,难维护)、`@import`(有性能问题,别用)。语法 = 选择器 + 声明块。

**选择器全景**:基础(标签、类 `.a`、ID `#a`(尽量少用,优先级太高)、通配 `*`);组合:后代(空格)、子代 `>`、相邻兄弟 `+`、通用兄弟 `~`;属性选择器:`[attr]`、`[attr="v"]` 精确、`[attr^="v"]` 开头、`[attr$="v"]` 结尾、`[attr*="v"]` 包含、`[attr~="v"]` 单词、`[attr|="v"]`;伪类:动态(`:hover`/`:active`/`:focus`/`:focus-within`(父元素含焦点时,表单卡片高亮神器)/`:visited`/`:link`)、结构(`:first-child`/`:last-child`/`:nth-child(an+b)`(公式,斑马纹 `2n+1`)/`:nth-of-type`/`:only-child`/`:empty`/`:root`/`:target`(锚点命中,阅读高亮))、表单(`:checked`/`:disabled`/`:required`/`:valid`/`:invalid`/`:placeholder-shown`)、逻辑(`:not()`/`:is()`(选择器列表,不提升优先级)/`:where()`(零优先级)/`:has()`(父选择器,`figure:has(img)` 按子元素样式化父元素,现代 CSS 大杀器));伪元素:`::before`/`::after`(配合 `content`,装饰与图标的免图片神技;没有 content 不显示)、`::first-letter`/`::first-line`、`::selection`(选中文字样式)、`::placeholder`(占位提示样式)、`::marker`(列表项符号)、`::backdrop`(dialog 全屏背景)。

**层叠与优先级**(面试必考):按"来源与重要性 > 具体性 > 书写顺序"裁决。`!important` 跳到最顶层(能不用就不用);行内样式 > ID > 类/伪类/属性 > 标签/伪元素;同优先级比数量再比先后(后写的赢)。**继承**:文字类属性(color/font/line-height/text-*)默认继承,盒模型类不继承;四个控制关键字:`inherit`(强制继承)、`initial`(初始值)、`unset`(可继承属性当 inherit,否则 initial)、`revert`(回退浏览器默认)。层叠还能用 **`@layer`**(级联层)管理——把 reset、框架、业务分层,同层内再按常规比较,新项目组织样式的好工具。

**盒模型**:每个元素 = content + padding + border + margin(从内到外)。**标准盒模型**的 width 只算 content,padding/border 会把盒子撑大;**`box-sizing: border-box`** 让 width 含 padding/border——现代项目全局设置它,否则"50% 宽的侧边栏加 padding 变 52% 挤爆布局"的惨剧天天上演。
相关知识点:`margin` 可以负值(拉近元素)、`margin: 0 auto` 水平居中块级元素、`margin` 百分比相对**父容器宽度**(不是高度,别懵)、**外边距合并**(相邻兄弟/父子的垂直 margin 取较大值;解决:父元素设 overflow/加 padding/设 BFC/用 flex/grid 容器)、**BFC(块格式化上下文)**——一个"隔离结界":内部布局不影响外部、能包含浮动子元素、阻止 margin 穿透。
触发 BFC 的常见方式:`overflow: hidden`、`display: flow-root`(最文明)、`display: inline-block`/`flex`/`grid`、`position: absolute/fixed`、`float`。**层叠上下文**是另一个结界:决定 z-index 谁压谁——`position + z-index`、`transform`/`opacity`/`filter` 非 none 值、`mix-blend-mode` 等都会创建层叠上下文;z-index 只在同一层叠上下文内比较。
`display` 三兄弟:`block`(独占一行,可设宽高)/`inline`(行内,宽高无效,水平排)/`inline-block`(行内但可设宽高,经典坑:标签间空白);`display: none`(彻底移除)vs `visibility: hidden`(占位隐藏)vs `opacity: 0`(可交互!三者的区别是常考题);现代还有 `display: contents`(元素本身消失,子元素提升,布局 hack 用)。

## 第三站:文本、背景与视觉细节

**字体**:`font-family` 写字体栈(西文在前中文在后,`"PingFang SC", "Microsoft YaHei", sans-serif` 兜底);`font-size` 单位 px 固定、**em 相对父级、rem 相对根元素**(响应式与无障碍字号缩放靠 rem,(html &#123; font-size: 62.5% &#125;) 让 1rem = 10px 是经典技巧);`font-weight`(100-900,`bold` = 700)、`font-style`、`font-variant`、`line-height`(无单位倍数最佳,1.5-1.7 正文黄金区间)、`letter-spacing`/`word-spacing`。
文本:`text-align`(left/center/right/**justify 两端对齐**)、`text-decoration`(underline/line-through,`text-decoration-skip` 细节)、`text-transform`(uppercase 等)、`text-indent`(首行缩进)、`text-shadow`、`white-space`(nowrap 禁换行/pre 保留空格)、`word-break`/`overflow-wrap`(长单词与中文换行,CJK 坑)、**单行省略号三件套**(`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`)、多行省略(`-webkit-line-clamp`,了解)、`vertical-align`(行内元素对齐,图片下方空隙的元凶,`vertical-align: middle` 不一定如你所愿)、`direction`/`writing-mode`(竖排文字)。
Web 字体:`@font-face`(`font-display: swap` 先显示系统字体防止不可见文本)、字体子集化减小体积、`font-variation-settings` 可变字体(概念)。

**颜色与背景**:颜色表示全家:十六进制 `#2ca985`(还能缩写与 8 位带透明度)、`rgb()`/`rgba()`、`hsl()`(色相/饱和度/亮度——调色时比 rgb 直觉,暗色模式微调 lightness 即可)、`currentColor`(跟随文字颜色,图标与边框同步变色神器)、`transparent`、命名色;现代 `color-mix()` 混色、相对颜色语法(`hsl(from red h s calc(l - 10%))`)。
背景:`background-color`/`image`/`repeat`(no-repeat 常见)/`position`/`size`(**cover 铺满可能裁切 vs contain 完整可能留白**)/`attachment`(fixed 背景不滚动)/`clip`/`origin`、**多背景**逗号叠放、`background-blend-mode` 混合。
**渐变**:`linear-gradient`(可写角度 `to right` 或 `45deg`)、`radial-gradient`、`conic-gradient`(饼图/表盘,conic 进阶);渐变能做进度条、文字底纹、边框渐变。**边框与装饰**:`border` 简写顺序(width style color)、单边 border-top 等、`border-radius`(百分比、`50%` 圆形、斜杠语法 `10px 20px / 30px` 椭圆角)、`border-image`(九宫格拉伸,了解)、`outline`(轮廓不占布局,焦点样式用 outline 而不是 border——不影响布局抖动)、`box-shadow`(多层阴影、inset 内阴影,做按钮立体感)、`filter` 滤镜(`blur`/`grayscale`/`brightness`/`contrast`/`sepia`/`hue-rotate`/`drop-shadow`——切图工具下岗神器)、`backdrop-filter`(背景毛玻璃,导航栏模糊)、`mix-blend-mode`(元素与背景混合)、`clip-path`(裁剪形状:多边形/圆形,做头像、创意图案)、`mask`(遮罩,了解)。
**其他视觉**:`cursor`(pointer/not-allowed/grab/crosshair 自定义 url)、`opacity`、`object-fit`(img/video 在框内的适配:cover/contain/fill——配 `object-position`)、`list-style`(列表符号,`list-style: none` 加背景图做自定义符号)、表格样式(`border-collapse: collapse` 合并边框、`table-layout: fixed` 防撑爆)。

## 第四站:布局——现代排版的三大件

布局进化史:表格布局(远古)→ 浮动布局(中世纪)→ Flexbox/Grid(现代)。**浮动与清除**:`float: left/right` 现在只用于文字环绕图片;浮动元素脱离文档流,父容器会"塌陷",清除浮动用 `clear: both` 或父容器触发 BFC——这段历史知道即可,别再用 float 布局。
**定位 `position` 五兄弟**:static(默认)、relative(相对自己偏移;更是 absolute 的"锚点"——定位祖先)、absolute(脱离文档流,相对最近的非 static 祖先定位;弹窗/角标/下拉菜单标配)、fixed(相对视口,吸顶导航;注意会被 transform 祖先"劫持")、sticky(滚动到阈值粘住,`top: 0`;表头/侧栏跟随)。
配套:偏移 `top/right/bottom/left`(可负值)、`inset` 简写、**绝对定位居中三板斧**(`inset: 0; margin: auto`、`top: 50%; left: 50%; transform: translate(-50%, -50%)`、flex 容器居中)、`z-index`(配合层叠上下文理解)、"包含块"概念(absolute 的百分比相对定位祖先)。
**Flexbox(一维布局)**:容器属性全家——`display: flex`/`inline-flex`、`flex-direction`(row/column/两个 reverse)、`flex-wrap`(wrap 换行,`flex-flow` 简写)、`justify-content`(主轴:flex-start/center/flex-end/**space-between 两端散开/space-around/space-evenly**)、`align-items`(交叉轴单行:stretch 默认拉伸/center 垂直居中)、`align-content`(交叉轴多行,配合 wrap)、`gap`(行列间距,别再用 margin 挤);项目属性——`flex-grow`(放大比例,`flex: 1` 平分剩余)、`flex-shrink`(缩小比例)、`flex-basis`(初始主轴尺寸,auto 或具体值)、`flex` 简写(`flex: 1 1 auto` 的语义)、`align-self`(单项目覆盖)、`order`(排序,视觉重排)、`margin: auto` 在 flex 里是"推走其他项目"的神器。
垂直居中、圣杯布局(header/footer + 三栏)都是 Flex 的名场面。

**Grid(二维布局)**:`display: grid`;轨道定义:`grid-template-columns/rows`(长度、百分比、**`fr` 单位**(剩余空间分配,`1fr` 自动填满)、`repeat(3, 1fr)`、`minmax(200px, 1fr)`(响应式列)、`auto-fit`/`auto-fill`(自动换行,`repeat(auto-fit, minmax(200px, 1fr))` 是"自适应卡片墙"一行流)、`grid-template-areas` 命名布局(可读性之王:`"header header" "sidebar main"`));间距 `gap`/`row-gap`/`column-gap`;项目放置:`grid-column`/`grid-row`(支持 `span 2` 跨两格与 `1 / 3` 线号)、`grid-area`(用命名区域或用 `行起始 / 列起始 / 行结束 / 列结束` 四值)、`justify-items`/`align-items`/`place-items`(单元格内对齐)、`justify-content`/`align-content`(网格整体对齐);隐式轨道 `grid-auto-rows`/`grid-auto-flow: dense`(密集填充);**子网格 `subgrid`**(嵌套网格对齐外层轨道,新特性);Grid 与 Flex 分工口诀:**Grid 管页面骨架(二维),Flex 管组件内部(一维)**,两者嵌套使用。
调试:DevTools 的 Layout 面板能可视化网格线。

**响应式设计**三件套:流式布局(百分比/弹性单位)+ 媒体查询 + 弹性媒体(图片 `max-width: 100%`)。**媒体查询** `@media (max-width: 768px)`(断点习惯:576/768/992/1200,按内容定断点而不是设备);**移动优先**(先写手机样式,用 `min-width` 逐级增强)vs 桌面优先;媒体特性:`orientation`(横竖屏)、`prefers-color-scheme`(暗色模式:默认亮色 + `@media (prefers-color-scheme: dark)` 覆盖变量)、`prefers-reduced-motion`(减少动效偏好)、`hover`/`pointer`(触屏设备)、`aspect-ratio`;单位体系:`%`(相对父)、`em`/`rem`(字号)、`vw`/`vh`(视口,`100vh` 在移动端地址栏的坑,`dvh` 新解)、`vmin`/`vmax`、`ch`(字符宽);函数 `calc()`(混合单位计算:`calc(100% - 240px)`)、`min()`/`max()`/`clamp()`(**`clamp(1rem, 2vw, 2rem)` 流式字号**);响应式图片 `srcset`/`&lt;picture&gt;`/`<img srcset>` 与 `sizes` 属性(第一站已提);**容器查询** `@container`(组件按自身容器宽度响应——组件库开发必备,告别"只知道视口宽");打印样式 `@media print`(隐藏导航、黑白化);`content-visibility`(长页面跳过屏外渲染,性能新宠)。

## 第五站:动效——过渡、动画与 CSS 变量

**过渡 transition**:让属性变化平滑,四要素简写 `transition: property duration timing-function delay`(如 `transition: all .3s ease`,但 all 有性能损耗,写具体属性更好);**缓动函数**:linear/ease/ease-in/ease-out/ease-in-out、`cubic-bezier()` 自定义、`steps()` 逐帧(打字机/精灵图动画);`transitionend` 事件(动画结束回调)。
**动画 animation**:`@keyframes` 定义关键帧(`from`/`to` 或百分比节点),属性全家:`animation-name/duration/timing-function/delay/iteration-count`(`infinite` 无限)、`direction`(normal/**alternate 来回摆**)、`fill-mode`(none/**forwards 保持终点/backwards 起点预置/both**——为什么动画结束"跳回去"的答案)、`play-state`(paused 暂停,配 hover 控制)、简写 `animation: name 1s ease infinite`;`animationend` 事件。
**transform 变换**:`translate`(位移,`translateX/Y`)、`rotate`、`scale`、`skew`(倾斜)、`transform-origin`(变换原点,默认中心——卡片翻转要设边缘)、多变换顺序敏感(从右往左应用);3D:`perspective`(透视,给父元素或 transform 里)、`rotateX/Y/Z`、`translateZ`、`transform-style: preserve-3d`(子元素保 3D,做翻转卡片)、`backface-visibility: hidden`(背面隐藏,翻牌效果);**性能铁律**:动画只用 transform/opacity(合成器线程处理,不触发重排重绘),别动画 left/top/width;`will-change` 提前告诉浏览器(慎用,别滥用)。
**CSS 变量(自定义属性)**:`--name: value` 定义在 `:root`(或任何元素,有继承与作用域),`var(--name, 回退值)` 读取;**换主题(暗色/品牌色)就是换一套变量**;JS 读写:`getComputedStyle(el).getPropertyValue('--x')` 与 `el.style.setProperty('--x', v)`;进阶:`@property` 注册带类型与初始值的变量(让变量可过渡动画,新特性)。

## 第六站:工程化与性能——写"能维护"的 CSS

**预处理与后处理**:Sass/SCSS(变量、嵌套、mixin、`@extend` 继承、函数、循环——当年"CSS 编程化"的救星)、Less(轻量同类)、PostCSS(工具平台,Autoprefixer 自动加厂商前缀是其成名作);现代 CSS 原生变量/嵌套到来后地位下降,但存量项目遍地都是,要会读会改。**方法论**(团队协作不撞名的关键):BEM(`.card__title--active`:块-元素-修饰符,双下划线连元素、双减号连状态)、OOCSS(结构与皮肤分离)、SMACSS(按角色分类)、ITCSS(按优先级倒三角分层)、原子化 CSS(每个类一个职责,见 Tailwind 路线)。**组织规范**:reset(Normalize.css 抹平浏览器差异,或现代 reset 如 (* &#123; box-sizing: border-box &#125;) + margin 清零)、CSS 命名规范、注释规范、样式表按"基础 → 布局 → 模块 → 状态"分层。

**性能优化**:选择器匹配从右往左,少写深层/通配选择器;避免频繁读写布局属性(读 `offsetHeight`/`getBoundingClientRect` 强制重排——"强制同步布局"是性能杀手);动画只动 transform/opacity;`contain: layout paint`(隔离子元素变化,优化局部);`content-visibility: auto` 跳过屏外渲染;图片与字体按需加载、关键 CSS 内联首屏、非关键 CSS 异步(media 属性 hack 或 JS 注入);工具链:PostCSS/PurgeCSS 去掉未用样式(Tailwind 自带)、Stylelint 检查样式规范、CSS 体积监控。
**兼容性**:Can I Use 查支持;厂商前缀(-webkit- 等,Autoprefixer 自动加);**渐进增强**(基础功能先行,高级特性增强)vs 优雅降级;特性检测 `@supports (display: grid)`(现代浏览器判断,老浏览器优雅兜底);常见坑:flex 旧版语法、`gap` 在 flex 的兼容史、`:has()`/容器查询的新鲜度——**大厂浏览器三件套(Chrome/Safari/Firefox)都绿了就放心用**。
**调试**:DevTools Elements 面板——选中元素看盒模型示意图、Styles 面板(划掉的样式 = 被覆盖,能看来源文件与行号)、Computed 面板(最终值 + 参与计算的规则)、Layout 面板(网格/flex 可视化)、设备模拟器(响应式调试)、性能面板录制(找重排重绘)、Lighthouse 跑分(可访问性/性能/SEO 体检报告)。

## 岔路口:HTML 与 CSS 学完去哪

能独立写出语义清晰、响应式、有点动效的页面后,三条路任选:

- **JavaScript**:给静态页面装上大脑——交互、数据、动画逻辑全靠它,前端的必经之路。[JavaScript 学习路线](/learning-paths/frontend/javascript)
- **CSS 框架**:Tailwind CSS(原子化类名,现代项目主流)或 Bootstrap(老牌)。框架提速但别让它替代你理解 CSS。[Tailwind CSS 学习路线](/learning-paths/frontend/tailwind)
- **设计系统与组件化**:结合 React/Vue 把页面拆成组件,走向现代前端开发。[React 学习路线](/learning-paths/frontend/react) ｜ [Vue 学习路线](/learning-paths/frontend/vue)

## 通关标准

能不看教程做出一个三栏响应式页面(手机自动变单列);能说清标准盒模型与 border-box、层叠优先级怎么判、BFC 是什么;会用 Flex 和 Grid 各完成一种布局并说清分工;认识上面提到的绝大多数属性,看到陌生代码能查 MDN 快速读懂;给一个设计稿能说出实现思路(布局方案、单位、动效)——做到这些,HTML 与 CSS 主线通关。

HTML 和 CSS 看着简单,门道很深:布局方案、样式组织、性能斤斤计较,都是"看起来都会、做起来见高下"。别急着跳框架——地基歪了,楼越高越危险。网页好不好看,CSS 功力占七成;页面能不能维护,HTML 骨架端正占七成。
