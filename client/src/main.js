import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/global.scss'

// 全局注册 ECharts 组件（按需引入），避免各子组件重复注册导致渲染异常
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  PieChart, LineChart, RadarChart, HeatmapChart
} from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, RadarComponent, CalendarComponent, VisualMapComponent
} from 'echarts/components'

use([
  CanvasRenderer,
  PieChart, LineChart, RadarChart, HeatmapChart,
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, RadarComponent, CalendarComponent, VisualMapComponent
])

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker 注册失败:', err)
    })
  })
}
