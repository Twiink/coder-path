import DefaultTheme from 'vitepress/theme'
import HomeContent from './components/HomeContent.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomeContent', HomeContent)
  },
  setup() {
    // 预加载关键图片
    if (typeof window !== 'undefined') {
      // 使用 requestIdleCallback 在空闲时预加载
      const preloadImages = () => {
        const images = [
          '/images/coderpath-hero-pixel.png',
          '/images/coderpath-c-icon.png'
        ]

        images.forEach(src => {
          const link = document.createElement('link')
          link.rel = 'prefetch'
          link.as = 'image'
          link.href = src
          document.head.appendChild(link)
        })
      }

      if ('requestIdleCallback' in window) {
        requestIdleCallback(preloadImages)
      } else {
        setTimeout(preloadImages, 100)
      }
    }
  }
}
