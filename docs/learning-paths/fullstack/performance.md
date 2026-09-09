# 全栈性能优化学习路线

性能是"抠"出来的,而且**必须全链路一起抠**:用户感知的慢 = DNS/网络(前端加载)+ 页面渲染(前端)+ 接口响应(后端查询与缓存)+ 数据库(索引与 SQL)中最慢的一环——**只优化一段,瓶颈会移到下一段**。本页给"全栈性能优化"一张完整地图:每一层看什么指标、用什么手段、典型顺序;纵深细节在各领域页(前端 [JavaScript](/learning-paths/frontend/javascript) 性能章/后端 [MySQL](/learning-paths/database/mysql) 优化章/[Redis](/learning-paths/database/redis) 缓存章)。

## 第一站:性能的度量——先测再优化(铁律)

**没有度量就没有优化**:①**前端指标(用户视角)**:LCP(最大内容绘制:首屏主内容多快可见)、INP(交互延迟)、CLS(布局稳定)——Web Vitals 三件套(见 [JavaScript](/learning-paths/frontend/javascript) 浏览器性能章),用 Lighthouse/浏览器 Performance 面板测;②**接口指标**:响应时间 P50/P95/P99(看分布别看平均)、QPS、错误率——后端日志/监控里带上(见 [监控](/learning-paths/devops/monitoring));③**数据库指标**:慢查询日志、索引命中、连接池水位(见 [MySQL](/learning-paths/database/mysql) 优化章)。**流程:压测/观测找到最慢的一环 → 优化 → 再测对比**——别凭感觉优化(你猜的瓶颈八成不是)。

## 第二站:前端优化——管好"加载与渲染"

**加载三板斧**:①**代码分割与懒加载**:路由级/组件级按需加载(React.lazy + Suspense、Vue 的异步组件、动态 import)——**首屏只下载当前路由需要的代码**(见 [React](/learning-paths/frontend/react)/[Vue](/learning-paths/frontend/vue) 性能章);②**图片优化**:next/image 类组件(自动压缩/响应式尺寸)或原生 `loading="lazy"` + `srcset/sizes`(按屏幕加载合适尺寸——**一张 2MB 原图毁掉整个首屏**);③**静态资源缓存**:带 hash 的文件名 + 长缓存头(CDN/浏览器——见 [Nginx](/learning-paths/middleware/nginx) 缓存章)。**渲染优化**:组件 memo 防无谓重渲染、长列表虚拟滚动、动画走 transform/opacity(见 [React](/learning-paths/frontend/react) 渲染原理章)。**请求优化(常被忽略的"假慢"来源)**:①**服务端状态缓存**:TanStack Query/SWR 配置 staleTime(如 5 分钟不重复请求)与缓存策略——**同一数据别每次进页面都重新拉**(见 [React](/learning-paths/frontend/react) 数据获取章);②**请求合并与防抖**:搜索输入防抖、批量请求合并;③**CDN 与预加载**:静态资源上 CDN、关键资源 preload/preconnect(见 [Nginx](/learning-paths/middleware/nginx))。

## 第三站:后端优化——管好"查询与缓存"

**接口慢的定位顺序(从外到内)**:网络/网关 → 应用代码 → 数据库。**数据库查询优化(后端性能的第一大头)**:①**N+1 查询**(循环里查库——列表接口性能杀手):ORM 预加载(select_related/with/Preload,见各框架 ORM 章);②**索引**:给 WHERE/排序/关联字段建索引,用 EXPLAIN 看是否走索引、有没有全表扫描(见 [MySQL](/learning-paths/database/mysql) 索引章);③**分页**:列表接口必须分页,深分页用游标/延迟关联(见 [MySQL](/learning-paths/database/mysql) 优化章)——**"一次全查"是后端最常见的性能事故**。**缓存分层(后端提速的第二步)**:①**Redis 缓存读多写少的热数据**:先查缓存 → 未命中查库并回填 → 设过期时间——**"接口先问缓存再问数据库"的 Cache Aside 模式**(防穿透/击穿/雪崩三件套见 [Redis](/learning-paths/database/redis) 缓存章);②**HTTP 层缓存**:静态与公开接口用 Nginx/CDN 边缘缓存(见 [Nginx](/learning-paths/middleware/nginx) 缓存章);③**并发与异步**:重活(报表/邮件/推送)异步化进队列,请求只干快活(见 [RabbitMQ](/learning-paths/middleware/rabbitmq) 场景章);④**连接池与超时**:数据库/Redis 连接池参数、下游调用超时(防级联,见 [云原生](/learning-paths/cloud-native/cloud-native-patterns) 弹性章)。

## 第四站:全链路排查套路——"页面慢"的破案流程

**按用户感知的环节逐层缩小(背下来,实战直接用)**:①浏览器 Network 看瀑布图:**慢在哪个请求?**(DNS/连接/等待响应/下载——瀑布图一目了然);②单个接口慢:**先 curl 直测后端**(排除前端/网络)→ 看后端日志的耗时记录 → 定位是"应用逻辑慢"还是"数据库慢";③数据库慢:开慢查询日志 → EXPLAIN 看索引 → 缺索引补索引、N+1 改预加载;④都"不慢"但用户觉得慢:**前端渲染/请求过多**——合并请求、缓存、懒加载;⑤高峰期慢:**容量问题**——连接池/线程池打满、数据库连接数、GC(Java)、事件循环阻塞(Node)——看监控(见 [监控](/learning-paths/devops/monitoring))。**工具清单**:浏览器 Performance/Lighthouse、curl -w 计时、后端 profiling(见各语言页性能章)、数据库 EXPLAIN/慢查询、压测工具(autocannon/ab/k6——上线前压一遍,别上线后才知道扛不住)。

## 第五站:优化优先级——先做性价比高的

**按 ROI 排序(大多数项目的正确顺序)**:①**数据库索引与 N+1**(免费且立竿见影);②**Redis 缓存热点接口**(读多写少时收益巨大);③**前端图片与代码分割**(首屏体感最明显);④**列表分页与接口瘦身**(返回字段裁剪——少传 80% 无用数据);⑤**CDN 与缓存头**(静态资源全球提速);⑥**异步化与队列**(削峰);⑦**压测与容量规划**(知道天花板在哪)——**先做 1-4,通常已经解决 80% 的"慢"**;别一上来就上微服务/换语言(架构级"优化"多数时候是在掩盖没做基础优化)。

## 通关标准

能独立做到:用 Lighthouse/Performance 给自己项目测出三项 Web Vitals 并指出最差一项的优化手段;定位一次"接口慢"(curl 分层 → 慢查询 → EXPLAIN → 修复);给列表接口配好分页+预加载+Redis 缓存并量化提速效果;说清 N+1、缺索引、无分页三个后端常见性能事故的排查顺序;按 ROI 顺序给一个"慢系统"排出优化计划——全栈性能主线通关。

全栈性能优化的心法一句话:**"先测后优、全链路看、按 ROI 排序"**——它考验的不是某一层的绝活,而是"从用户点击到数据库"的完整视野与排查纪律。**性能问题不可怕,可怕的是凭感觉乱优化**(把时间花在不是瓶颈的地方)。把本页的排查套路练成肌肉记忆,配合 [监控](/learning-paths/devops/monitoring) 让性能可观测,你就能在"慢"字面前从容破案。下一步:接口质量靠 [测试](/learning-paths/fullstack/testing),上线流程看 [部署](/learning-paths/fullstack/deployment)。
