<template>
  <div class="dashboard-view">
    <header class="dashboard-header">
      <div class="header-left">
        <button class="back-btn" @click="$router.push('/game')">← 返回游戏</button>
        <h1>学习数据仪表盘</h1>
      </div>
      <div class="header-right">
        <button class="social-btn" @click="$router.push('/social')">好友 / 异步 PK</button>
        <span class="user-info">{{ userStore.userInfo?.nickname || '勇者' }} | Lv.{{ userStore.userInfo?.level || 1 }}</span>
      </div>
    </header>

    <main class="dashboard-content">
      <!-- 部分数据加载失败提示 -->
      <div v-if="loadErrors.length > 0" class="dashboard-error-banner">
        ⚠️ 部分数据加载失败（{{ loadErrors.join('、') }}），请检查网络连接
      </div>

      <div class="main-section">
        <section class="wordbook-switcher">
          <div>
            <p class="eyebrow">当前词书</p>
            <h3>{{ selectedWordbookName }}</h3>
          </div>
          <select v-model="selectedWordbookId" @change="onWordbookChange">
            <option v-for="book in wordbooks" :key="book.wordbookId" :value="book.wordbookId">
              {{ book.name }}（{{ book.total }}词）
            </option>
          </select>
        </section>

        <DailyChallengeCard :wordbook-id="selectedWordbookId" />

        <TodayReviewCard
          :items="todayReview"
          :loading="todayReviewLoading"
          :error="todayReviewError"
          @start-review="openTodayReview"
        />

        <VocabularyImportPanel
          :wordbook-id="selectedWordbookId"
          :wordbook-name="selectedWordbookName"
          @imported="refreshAfterImport"
        />

        <LearningReport
          :stats="stats"
          :daily-data="dailyData"
          :chapter-data="chapterData"
          :adaptive-summary="adaptiveSummary"
          :error-type-data="errorTypeData"
          :source-mode-data="sourceModeData"
        />

        <!-- 学习热力图 -->
        <div class="chart-container">
          <h4>📅 学习热力图</h4>
          <component
            v-if="chartReady && VChartComponent"
            :is="VChartComponent"
            :option="heatmapOption"
            style="height: 180px"
            autoresize
          />
          <div v-else class="chart-loading">图表模块加载中...</div>
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

      <ReviewMode
        v-if="showTodayReview"
        mode="today"
        :initial-words="todayReview"
        @close="showTodayReview = false"
      />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineAsyncComponent, shallowRef } from 'vue'
import { useUserStore } from '@/stores/user'
import { getStats, getDailyStats, getChapterStats, getTopMistakes, getHeatmap, getTodayReview, getErrorTypeStats } from '@/api/learning'
import { getSelectedWordbook, getWordbooks, setSelectedWordbook } from '@/api/vocabulary'

const LearningReport = defineAsyncComponent(() => import('@/components/LearningReport.vue'))
const ScoreBoard = defineAsyncComponent(() => import('@/components/ScoreBoard.vue'))
const ReviewMode = defineAsyncComponent(() => import('@/components/ReviewMode.vue'))
const TodayReviewCard = defineAsyncComponent(() => import('@/components/TodayReviewCard.vue'))
const VocabularyImportPanel = defineAsyncComponent(() => import('@/components/VocabularyImportPanel.vue'))
const DailyChallengeCard = defineAsyncComponent(() => import('@/components/DailyChallengeCard.vue'))

const userStore = useUserStore()
const stats = ref(null)
const dailyData = ref([])
const chapterData = ref([])
const topMistakes = ref([])
const heatmapData = ref([])
const errorTypeData = ref([])
const sourceModeData = ref([])
const todayReview = ref([])
const todayReviewLoading = ref(false)
const todayReviewError = ref('')
const showTodayReview = ref(false)
const wordbooks = ref([{ wordbookId: 'cet4', name: 'CET-4 核心词库', total: 0 }])
const selectedWordbookId = ref(getSelectedWordbook())
const loadErrors = ref([])
const VChartComponent = shallowRef(null)
const chartReady = ref(false)

onMounted(async () => {
  loadErrors.value = []

  // 确保刷新页面后 userInfo 被恢复
  if (!userStore.userInfo && userStore.isLoggedIn) {
    try { await userStore.fetchUserInfo() } catch (e) { console.warn('获取用户信息失败:', e) }
  }

  // 各模块独立加载，互不影响；图表运行时懒加载，避免首屏强制拉取 ECharts
  const tasks = [
    { name: '图表运行时', fn: loadChartRuntime },
    { name: '词书列表', fn: loadWordbooks },
    { name: '学习统计', fn: loadStats },
    { name: '每日数据', fn: async () => { const r = await getDailyStats(30); dailyData.value = r.data || [] } },
    { name: '章节数据', fn: async () => { const r = await getChapterStats(); chapterData.value = r.data || [] } },
    { name: '易错词汇', fn: async () => { const r = await getTopMistakes(10); topMistakes.value = r.data || [] } },
    { name: '今日复习', fn: loadTodayReview },
    { name: '错因统计', fn: loadErrorTypeStats },
    { name: '学习热力图', fn: async () => { const r = await getHeatmap(new Date().getFullYear()); heatmapData.value = r.data || [] } }
  ]

  await Promise.all(tasks.map(async (task) => {
    try {
      await task.fn()
    } catch (e) {
      console.warn(`仪表盘加载失败 [${task.name}]:`, e)
      loadErrors.value.push(task.name)
    }
  }))
})

async function loadChartRuntime() {
  if (chartReady.value) return
  const [vueEcharts, echartsCore, renderers, charts, components] = await Promise.all([
    import('vue-echarts'),
    import('echarts/core'),
    import('echarts/renderers'),
    import('echarts/charts'),
    import('echarts/components')
  ])
  echartsCore.use([
    renderers.CanvasRenderer,
    charts.HeatmapChart,
    components.CalendarComponent,
    components.VisualMapComponent,
    components.TooltipComponent
  ])
  VChartComponent.value = vueEcharts.default
  chartReady.value = true
}

async function loadWordbooks() {
  const r = await getWordbooks()
  const books = r.data || []
  if (books.length > 0) wordbooks.value = books
  if (!wordbooks.value.some(book => book.wordbookId === selectedWordbookId.value)) {
    selectedWordbookId.value = wordbooks.value[0]?.wordbookId || 'cet4'
    setSelectedWordbook(selectedWordbookId.value)
  }
}

const selectedWordbookName = computed(() => {
  return wordbooks.value.find(book => book.wordbookId === selectedWordbookId.value)?.name || selectedWordbookId.value
})

async function onWordbookChange() {
  setSelectedWordbook(selectedWordbookId.value)
  await refreshAfterImport()
}

async function loadStats() {
  const r = await getStats(selectedWordbookId.value)
  stats.value = r.data
}

async function loadErrorTypeStats() {
  const r = await getErrorTypeStats(selectedWordbookId.value, 30)
  errorTypeData.value = r.data?.errorTypes || []
  sourceModeData.value = r.data?.sourceModes || []
}

async function loadTodayReview() {
  todayReviewLoading.value = true
  todayReviewError.value = ''
  try {
    const r = await getTodayReview(20, selectedWordbookId.value)
    todayReview.value = r.data || []
  } catch (e) {
    console.warn('今日复习加载失败:', e)
    todayReview.value = []
    todayReviewError.value = e?.message || '今日复习加载失败'
    throw e
  } finally {
    todayReviewLoading.value = false
  }
}

async function refreshAfterImport() {
  loadErrors.value = []
  try {
    await loadWordbooks()
    await Promise.all([loadStats(), loadTodayReview(), loadErrorTypeStats()])
  } catch (e) {
    console.warn('导入后刷新统计失败:', e)
  }
}

function openTodayReview() {
  if (todayReview.value.length > 0) showTodayReview.value = true
}

const adaptiveSummary = computed(() => {
  if (todayReview.value.length === 0) return null
  const averageMastery = Math.round(todayReview.value.reduce((sum, item) => sum + (Number(item.masteryScore) || 0), 0) / todayReview.value.length)
  return {
    reviewCount: todayReview.value.length,
    averageMastery,
    weakCount: todayReview.value.filter(item => item.reasons?.some(r => ['wrong', 'near', 'low_mastery'].includes(r))).length,
    staleCount: todayReview.value.filter(item => item.reasons?.includes('stale')).length
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

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.social-btn {
  min-height: 34px;
  border: 1px solid rgba(159, 211, 122, 0.45);
  border-radius: 8px;
  background: rgba(91, 140, 62, 0.24);
  color: #f5edd6;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
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

.dashboard-error-banner {
  grid-column: 1 / -1;
  background: rgba(212, 91, 62, 0.15);
  border: 1px solid rgba(212, 91, 62, 0.4);
  border-radius: 8px;
  padding: 10px 16px;
  color: #ff8866;
  font-size: 13px;
  text-align: center;
}

.wordbook-switcher {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;

  h3 { color: #ffd700; margin-top: 2px; }
  select {
    min-height: 44px;
    min-width: 220px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.25);
    color: #f5edd6;
    padding: 8px 12px;
  }
}

.eyebrow { color: #c4b99a; font-size: 12px; letter-spacing: 0.12em; }

.chart-container {
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  padding: 16px;

  h4 { font-size: 15px; color: #b8b8d4; margin-bottom: 10px; }
}

.chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 180px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  color: #9a9aab;
  font-size: 13px;
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

@media (max-width: 820px) {
  .dashboard-view { padding: 14px; }
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .header-left {
    flex-wrap: wrap;
    h1 { font-size: 18px; }
  }
  .dashboard-content {
    grid-template-columns: 1fr;
  }
  .wordbook-switcher {
    flex-direction: column;
    align-items: stretch;
    select { min-width: 0; width: 100%; }
  }
  .side-section {
    position: static;
  }
}

@media (max-width: 430px) {
  .dashboard-view { padding: 10px; }
  .back-btn { min-height: 44px; padding: 8px 12px; }
  .chart-container,
  .mistake-section { padding: 12px; }
  .mistake-row {
    display: grid;
    grid-template-columns: 24px 1fr auto;
    gap: 8px;
  }
  .mistake-word,
  .mistake-count { width: auto; }
  .mistake-bar { grid-column: 2 / -1; width: 100%; }
}
</style>
