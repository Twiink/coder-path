<script setup lang="ts">
const destinations = [
  {
    title: '升级路线图',
    description: '从入门到进阶，找到下一步该学什么。',
    href: '/learning-paths/',
    icon: '/images/card-icons/roadmap.png',
    tone: 'route'
  },
  {
    title: '技能书',
    description: '前端、后端、数据库与工具链的知识整理。',
    href: '/study-notes/',
    icon: '/images/card-icons/stack.png',
    tone: 'notes'
  },
  {
    title: '氪金功能屋',
    description: '从需求分析到代码实现，记录完整过程。',
    href: '/features/',
    icon: '/images/card-icons/code-bug.png',
    tone: 'features'
  },
  {
    title: '装备背包',
    description: '把实际开发中好用的经验收进装备背包。',
    href: '/toolbox/',
    icon: '/images/card-icons/lightbulb-api.png',
    tone: 'toolbox'
  }
]
</script>

<template>
  <main class="coderpath-home">
    <section class="home-section hero-section" aria-labelledby="home-title">
      <div class="hero-copy">
        <p class="eyebrow"><span>//</span> 记录 · 学习 · 构建 · 成长</p>
        <h1 id="home-title" class="wordmark">CoderPath<span>_</span></h1>
        <p class="hero-title">一条通往更强的开发者之路</p>
        <p class="hero-description">
          记录升级路线图、技能书、村规民约与真实项目实践。
        </p>

        <div class="terminal-card" aria-label="CoderPath 终端示例">
          <div class="terminal-bar">
            <span class="terminal-dot coral"></span>
            <span class="terminal-dot gold"></span>
            <span class="terminal-dot mint"></span>
            <span class="terminal-caption">coderpath ~/learning</span>
          </div>
          <pre><code><span class="prompt">$</span> whoami
<span class="terminal-result">coderpath</span>
<span class="prompt">$</span> npm run learn
<span class="terminal-success">✓ building skills...</span>
<span class="prompt">$</span> git status
<span class="terminal-result">on branch learning</span><span class="cursor"></span></code></pre>
        </div>

        <div class="hero-actions">
          <a class="button primary" href="/learning-paths/">
            <span aria-hidden="true">↗</span> 开始探索
          </a>
          <a class="button secondary" href="/learning-paths/">
            <span aria-hidden="true">⌁</span> 查看路线图
          </a>
        </div>
      </div>

      <div class="hero-art" aria-hidden="true">
        <span class="pixel-spark spark-one"></span>
        <span class="pixel-spark spark-two"></span>
        <span class="pixel-spark spark-three"></span>
        <img
          src="/images/coderpath-hero-pixel.png"
          alt=""
          width="1448"
          height="1086"
          fetchpriority="high"
        >
      </div>
    </section>

    <section class="home-section destinations-section" aria-label="主要内容入口">
      <div class="destination-grid">
        <a
          v-for="destination in destinations"
          :key="destination.title"
          class="destination-card"
          :class="`is-${destination.tone}`"
          :href="destination.href"
        >
          <span class="card-icon" aria-hidden="true">
            <img :src="destination.icon" alt="" width="112" height="112" loading="lazy">
          </span>
          <h2>{{ destination.title }}</h2>
          <p>{{ destination.description }}</p>
          <span class="card-arrow" aria-hidden="true">→</span>
        </a>
      </div>
    </section>

    <section class="home-section roadmap-section" aria-labelledby="roadmap-title">
      <div class="roadmap-copy">
        <p class="section-kicker">ROADMAP</p>
        <h2 id="roadmap-title">别急，<br>一步一步来。</h2>
        <p>从 0 到 1，从会用到精通。每一段路，都算数。</p>
        <a class="button primary roadmap-action" href="/learning-paths/">
          <span aria-hidden="true">⌁</span> 查看完整路线图
        </a>
      </div>
      <div class="roadmap-art">
          <img
          src="/images/coderpath-roadmap-pixel-transparent.png"
          alt="从起点、基础、进阶到实战和成长的学习路线图"
          width="1774"
          height="887"
          loading="lazy"
        >
      </div>
    </section>

    <footer class="home-footer">
      <img src="/images/coderpath-rocket-pixel.png" alt="" width="32" height="32">
      <strong>CoderPath</strong>
      <span>记录 · 学习 · 构建 · 成长</span>
    </footer>
  </main>
</template>

<style scoped>
.coderpath-home {
  --paper: #fffdf8;
  --ink: #15233d;
  --muted: #66718a;
  --mint: #2ca985;
  --mint-deep: #187a61;
  --lavender: #eef1ff;
  --border: #dfe4ef;
  --coral: #ec745d;
  --gold: #efb33a;
  box-sizing: border-box;
  overflow: hidden;
  color: var(--ink);
  background:
    radial-gradient(circle at 12% 14%, rgb(44 169 133 / 7%), transparent 19rem),
    radial-gradient(circle at 91% 32%, rgb(107 124 201 / 8%), transparent 22rem),
    var(--paper);
  font-family: 'Avenir Next', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  image-rendering: optimizeSpeed;
}

.coderpath-home *,
.coderpath-home *::before,
.coderpath-home *::after {
  box-sizing: border-box;
}

.home-section {
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
}

.hero-section {
  display: grid;
  grid-template-columns: minmax(0, .92fr) minmax(440px, 1.08fr);
  gap: clamp(18px, 4vw, 68px);
  align-items: center;
  min-height: min(760px, calc(100dvh - var(--vp-nav-height)));
  padding: 58px 0 42px;
}

.eyebrow,
.section-kicker {
  margin: 0 0 20px;
  color: var(--mint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: .92rem;
  font-weight: 800;
  letter-spacing: .03em;
}

.eyebrow span {
  margin-right: 6px;
}

.wordmark {
  margin: 0;
  color: var(--ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: clamp(3rem, 6vw, 5.9rem);
  font-weight: 900;
  letter-spacing: -.12em;
  line-height: .95;
  text-rendering: geometricPrecision;
}

.wordmark span {
  color: var(--mint);
}

.hero-title {
  margin: 27px 0 16px;
  font-size: clamp(2rem, 3.5vw, 3.45rem);
  font-weight: 850;
  letter-spacing: -.055em;
  line-height: 1.18;
}

.hero-title::after {
  display: inline-block;
  width: 5.7rem;
  height: .55rem;
  margin-left: .42rem;
  border-radius: 2px;
  background: #f1c653;
  content: '';
  transform: translateY(-.18em) rotate(-2deg);
  box-shadow: 2px 2px 0 rgb(241 198 83 / 35%);
}

.hero-description {
  max-width: 31rem;
  margin: 0 0 24px;
  color: var(--muted);
  font-size: 1.03rem;
  line-height: 1.85;
}

.terminal-card {
  position: relative;
  max-width: 410px;
  overflow: hidden;
  border: 2px solid var(--ink);
  border-radius: 4px;
  background: #17243b;
  box-shadow: 6px 6px 0 rgb(21 35 61 / 12%);
  color: #f6f5ef;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  image-rendering: crisp-edges;
}

.terminal-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 11px;
  border-bottom: 1px solid rgb(255 255 255 / 14%);
  background: #263651;
}

.terminal-dot {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  image-rendering: pixelated;
}

.terminal-dot.coral { background: var(--coral); }
.terminal-dot.gold { background: var(--gold); }
.terminal-dot.mint { background: var(--mint); }

.terminal-caption {
  margin-left: 5px;
  color: #c9d3eb;
  font-size: .68rem;
}

.terminal-card pre {
  margin: 0;
  padding: 17px 20px 19px;
  overflow: auto;
  font-size: clamp(.76rem, 1.2vw, .88rem);
  line-height: 1.58;
}

.terminal-card code { font-family: inherit; }
.prompt { color: #52d9ad; }
.terminal-result { color: #f5f1e8; }
.terminal-success { color: #a8e37c; }

.cursor {
  display: inline-block;
  width: .56em;
  height: 1em;
  margin-left: 4px;
  background: #51d7ab;
  vertical-align: -.17em;
  animation: cursor-blink 1.1s steps(2, start) infinite;
  image-rendering: pixelated;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 26px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 48px;
  padding: 0 20px;
  border: 2px solid var(--ink);
  border-radius: 4px;
  color: var(--ink);
  font-weight: 800;
  text-decoration: none;
  transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease;
  cursor: pointer;
}

.button:hover {
  transform: translate(-2px, -2px);
}

.button:active {
  transform: translate(0, 0);
  box-shadow: none;
}

.button.primary {
  background: var(--ink);
  box-shadow: 4px 4px 0 var(--mint);
  color: var(--paper);
}

.button.primary:hover {
  box-shadow: 6px 6px 0 var(--mint);
}

.button.primary:active {
  box-shadow: 2px 2px 0 var(--mint);
}

.button.secondary {
  background: rgb(255 255 255 / 72%);
  box-shadow: 4px 4px 0 #dce2ee;
}

.button.secondary:hover {
  box-shadow: 6px 6px 0 #dce2ee;
}

.button.secondary:active {
  box-shadow: 2px 2px 0 #dce2ee;
}

.hero-art {
  position: relative;
  min-height: 430px;
  isolation: isolate;
}

.hero-art::before {
  position: absolute;
  z-index: -2;
  inset: 7% 4% 4% 1%;
  border-radius: 46% 54% 44% 56% / 51% 40% 60% 49%;
  background: linear-gradient(145deg, rgb(214 222 255 / 78%), rgb(255 236 193 / 65%));
  content: '';
  transform: rotate(-4deg);
}

.hero-art img {
  display: block;
  width: min(100%, 650px);
  height: auto;
  margin: 0 auto;
  filter: drop-shadow(0 17px 20px rgb(21 35 61 / 12%));
  image-rendering: pixelated;
}

.pixel-spark {
  position: absolute;
  z-index: -1;
  width: 11px;
  height: 11px;
  background: var(--mint);
  box-shadow: 11px 0 0 #dce1ff, 0 11px 0 #f0bd45;
  image-rendering: pixelated;
  animation: pixel-float 3s ease-in-out infinite;
}

@keyframes pixel-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.spark-one { top: 11%; right: 14%; animation-delay: 0s; }
.spark-two { right: 2%; bottom: 20%; transform: scale(.7); animation-delay: 1s; }
.spark-three { top: 54%; left: 0; transform: scale(.5); animation-delay: 2s; }

.destinations-section {
  padding: 40px 0 26px;
}

.destination-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.destination-card {
  position: relative;
  display: flex;
  min-height: 270px;
  flex-direction: column;
  padding: 18px 20px 18px;
  overflow: hidden;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: rgb(255 255 255 / 74%);
  box-shadow: 0 10px 22px rgb(21 35 61 / 4%);
  color: inherit;
  text-decoration: none;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
  cursor: pointer;
}

.destination-card::before,
.destination-card::after {
  position: absolute;
  width: 10px;
  height: 10px;
  border: solid var(--mint);
  content: '';
  opacity: 0;
  transition: opacity .18s ease;
}

.destination-card:hover::before,
.destination-card:hover::after {
  opacity: .85;
}

.destination-card::before {
  top: 10px;
  right: 10px;
  border-width: 2px 2px 0 0;
}

.destination-card::after {
  bottom: 10px;
  left: 10px;
  border-width: 0 0 2px 2px;
}

.destination-card:hover {
  transform: translateY(-5px);
  border-color: var(--mint);
  box-shadow: 0 17px 26px rgb(21 35 61 / 10%), 4px 4px 0 rgb(44 169 133 / 18%);
}

.card-icon {
  display: flex;
  min-height: 106px;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 16px;
}

.card-icon img {
  display: block;
  width: 112px;
  height: 102px;
  object-fit: contain;
  image-rendering: pixelated;
  transition: transform .2s ease;
}

.destination-card:hover .card-icon img {
  transform: scale(1.08);
}

.destination-card h2 {
  margin: 0 0 8px;
  font-size: 1.08rem;
  font-weight: 850;
  letter-spacing: -.03em;
}

.destination-card p {
  margin: 0;
  color: var(--muted);
  font-size: .9rem;
  line-height: 1.7;
}

.card-arrow {
  margin-top: auto;
  color: var(--mint-deep);
  font-size: 1.45rem;
  font-weight: 800;
}

.roadmap-section {
  display: grid;
  grid-template-columns: minmax(230px, .39fr) minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  margin-bottom: 42px;
  padding: clamp(24px, 4vw, 52px);
  overflow: hidden;
  border: 2px solid #d8dff4;
  border-radius: 12px;
  background: var(--lavender);
  box-shadow: 0 8px 16px rgb(21 35 61 / 5%);
}

.roadmap-copy {
  align-self: stretch;
  padding: 8px 0 10px;
}

.section-kicker {
  color: #6c7397;
  font-size: .72rem;
  letter-spacing: .08em;
}

.roadmap-copy h2 {
  margin: 0;
  font-size: clamp(2rem, 3vw, 3.15rem);
  font-weight: 900;
  letter-spacing: -.07em;
  line-height: 1.1;
}

.roadmap-copy p:not(.section-kicker) {
  max-width: 19rem;
  margin: 19px 0 25px;
  color: var(--muted);
  font-size: .95rem;
  line-height: 1.75;
}

.roadmap-action {
  min-height: 44px;
  padding: 0 16px;
  font-size: .9rem;
}

.roadmap-action:hover {
  box-shadow: 5px 5px 0 var(--mint);
}

.roadmap-action:active {
  box-shadow: 2px 2px 0 var(--mint);
}

.roadmap-art img {
  display: block;
  width: 100%;
  height: auto;
  image-rendering: pixelated;
}

.home-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 106px;
  color: var(--muted);
  font-size: .82rem;
}

.home-footer img {
  width: 25px;
  height: 25px;
  object-fit: contain;
  image-rendering: pixelated;
}

.home-footer strong {
  color: var(--ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 1rem;
}

.home-footer span::before {
  margin: 0 9px;
  color: var(--mint);
  content: '·';
}

@keyframes cursor-blink {
  50% { opacity: 0; }
}

.hero-art::after {
  position: absolute;
  z-index: -3;
  inset: 0;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 2px, rgb(21 35 61 / 1.5%) 2px, rgb(21 35 61 / 1.5%) 4px);
  content: '';
  pointer-events: none;
}

.terminal-card::after {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 1px, rgb(255 255 255 / 2%) 1px, rgb(255 255 255 / 2%) 2px);
  content: '';
  pointer-events: none;
}

@media (max-width: 960px) {
  .hero-section {
    grid-template-columns: 1fr;
    padding-top: 44px;
  }

  .hero-copy { max-width: 640px; }
  .hero-art { min-height: auto; }
  .hero-art img { max-width: 620px; }

  .destination-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  .roadmap-section {
    grid-template-columns: 1fr;
    gap: 27px;
  }

  .roadmap-copy { padding: 0; }
  .roadmap-copy p:not(.section-kicker) { max-width: 33rem; }
}

@media (max-width: 640px) {
  .home-section { width: min(100% - 32px, 1180px); }

  .hero-section {
    min-height: auto;
    gap: 26px;
    padding: 32px 0 28px;
  }

  .wordmark { font-size: clamp(2.9rem, 15vw, 4.25rem); }
  .hero-title { margin-top: 23px; font-size: 2rem; }
  .hero-title::after { width: 3.5rem; }
  .hero-description { font-size: .95rem; }
  .terminal-card { max-width: none; }
  .terminal-card pre { padding: 15px; font-size: .72rem; }
  .hero-actions { gap: 11px; }
  .button { flex: 1 1 150px; padding: 0 14px; }

  .destinations-section { padding: 27px 0 22px; }
  .destination-grid { grid-template-columns: 1fr; }
  .destination-card { min-height: 216px; }
  .card-icon { min-height: 88px; }
  .card-icon img { width: 98px; height: 86px; }

  .roadmap-section {
    width: calc(100% - 32px);
    margin-bottom: 16px;
    padding: 24px 18px 19px;
    border-radius: 13px;
  }

  .roadmap-art { margin: 0 -8px; overflow-x: auto; }
  .roadmap-art img { min-width: 630px; }

  .home-footer {
    min-height: 94px;
    flex-wrap: wrap;
    gap: 5px;
    padding: 16px;
    text-align: center;
  }

  .home-footer span { flex-basis: 100%; }
  .home-footer span::before { content: ''; margin: 0; }
}
</style>
