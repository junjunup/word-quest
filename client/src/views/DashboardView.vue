<template>
  <div class="dashboard-view">
    <header class="dashboard-header">
      <div class="header-left">
        <button class="back-btn" @click="$router.push('/game')">← 返回游戏</button>
        <h1>学习数据仪表盘</h1>
      </div>
      <div class="header-right">
        <span class="user-info">{{ userStore.userInfo?.nickname || '勇者' }} | Lv.{{ userStore.userInfo?.level || 1 }}</span>
      </div>
    </header>

    <main class="dashboard-content">
      <div class="main-section">
        <LearningReport :stats="stats" :daily-data="dailyData" :chapter-data="chapterData" />

        <!-- 学习热力图 -->
        <div class="chart-container">
          <h4>📅 学习热力图</h4>
          <v-chart :option="heatmapOption" style="height: 180px" autoresize />
        </div>

        <!-- 易错词汇 Top10 -->
        <div class="mistake-section">
          <h4>📝 易错词汇 Top 10</h4>
          <div class="mistake-list">
            <div v-for="(item, idx) in topMistakes" :key="idx" class="mistake-row">
              <span class="mistake-rank">{{ idx + 1 }}</span>
              <span class="mistake-word">{{ item.word }}</span>
              <span class="mistake-count">错{{ item.wrongCount }}次</span>
              <div class="mistake-bar">
                <div class="bar-fill" :style="{ width: item.errorRate + '%' }"></div>
              </div>
            </div>
            <div v-if="topMistakes.length === 0" class="empty-state">暂无错误记录，太厉害了！🎉</div>
          </div>
        </div>
      </div>

      <aside class="side-section">
        <ScoreBoard />
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import LearningReport from '@/components/LearningReport.vue'
import ScoreBoard from '@/components/ScoreBoard.vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { HeatmapChart } from 'echarts/charts'
import { CalendarComponent, VisualMapComponent, TooltipComponent } from 'echarts/components'
import { getStats, getDailyStats, getChapterStats, getTopMistakes, getHeatmap } from '@/api/learning'

use([CanvasRenderer, HeatmapChart, CalendarComponent, VisualMapComponent, TooltipComponent])

const userStore = useUserStore()
const stats = ref(null)
const dailyData = ref([])
const chapterData = ref([])
const topMistakes = ref([])
const heatmapData = ref([])

onMounted(async () => {
  try {
    const [statsRes, dailyRes, chapterRes, mistakeRes, heatmapRes] = await Promise.all([
      getStats(),
      getDailyStats(30),
      getChapterStats(),
      getTopMistakes(10),
      getHeatmap(new Date().getFullYear())
    ])
    stats.value = statsRes.data
    dailyData.value = dailyRes.data || []
    chapterData.value = chapterRes.data || []
    topMistakes.value = mistakeRes.data || []
    heatmapData.value = heatmapRes.data || []
  } catch (e) {
    console.error('加载仪表盘数据失败:', e)
  }
})

const heatmapOption = computed(() => {
  const year = new Date().getFullYear()
  return {
    tooltip: { formatter: (p) => `${p.data[0]}: ${p.data[1]}题` },
    visualMap: {
      min: 0,
      max: 50,
      show: false,
      inRange: { color: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] }
    },
    calendar: {
      range: year.toString(),
      cellSize: [14, 14],
      splitLine: { show: false },
      itemStyle: { borderWidth: 2, borderColor: '#1a1a2e' },
      dayLabel: { color: '#888', fontSize: 10 },
      monthLabel: { color: '#888', fontSize: 10 },
      yearLabel: { show: false }
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: heatmapData.value
    }]
  }
})
</script>

<style scoped lang="scss">
.dashboard-view {
  width: 100%;
  height: 100%;
  background: var(--bg-dark);
  overflow-y: auto;
  padding: 20px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;

  h1 { font-size: 22px; color: #ffd700; }
}

.back-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #b8b8d4;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;

  &:hover { background: rgba(255, 255, 255, 0.05); }
}

.user-info {
  color: #b8b8d4;
  font-size: 14px;
}

.dashboard-content {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 20px;
}

.chart-container {
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  padding: 16px;

  h4 { font-size: 15px; color: #b8b8d4; margin-bottom: 10px; }
}

.mistake-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  padding: 16px;

  h4 { font-size: 15px; color: #b8b8d4; margin-bottom: 12px; }
}

.mistake-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.mistake-rank {
  width: 24px;
  text-align: center;
  color: #888;
  font-size: 13px;
}

.mistake-word {
  width: 100px;
  color: #d0021b;
  font-weight: bold;
  font-size: 14px;
}

.mistake-count {
  width: 60px;
  color: #888;
  font-size: 12px;
}

.mistake-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;

  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #d0021b, #ff4444);
    border-radius: 3px;
  }
}

.empty-state {
  text-align: center;
  color: #666;
  padding: 20px;
  font-size: 14px;
}

.side-section {
  position: sticky;
  top: 20px;
}
</style>
