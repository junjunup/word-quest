<template>
  <div class="learning-report">
    <div class="report-toolbar">
      <h3 class="report-title">📊 学习报告</h3>
      <div class="export-actions">
        <button class="btn" @click="exportJSON">导出 JSON</button>
        <button class="btn" @click="exportCSV">导出 CSV</button>
        <button class="btn btn-gold" @click="printReport">打印/PDF</button>
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="stats-grid">
      <div v-for="card in overviewCards" :key="card.label" class="stat-card">
        <div class="stat-value">{{ card.value }}</div>
        <div class="stat-label">{{ card.label }}</div>
      </div>
    </div>

    <!-- 自适应学习闭环摘要 -->
    <div class="adaptive-summary-card" v-if="adaptiveSummary">
      <h4>🧠 AI 自适应复习建议</h4>
      <div class="adaptive-grid">
        <div><strong>{{ adaptiveSummary.reviewCount || 0 }}</strong><span>今日待复习</span></div>
        <div><strong>{{ adaptiveSummary.averageMastery || 0 }}%</strong><span>平均掌握度</span></div>
        <div><strong>{{ adaptiveSummary.weakCount || 0 }}</strong><span>薄弱词</span></div>
        <div><strong>{{ adaptiveSummary.staleCount || 0 }}</strong><span>久未复习</span></div>
      </div>
      <p>系统会结合 wrong / near / low_mastery / stale 原因生成今日复习队列。</p>
    </div>

    <div class="distribution-grid">
      <div class="distribution-card">
        <h4>错因分布</h4>
        <div v-if="normalizedErrorTypeData.length" class="distribution-list">
          <div v-for="item in normalizedErrorTypeData" :key="item.errorType" class="distribution-row">
            <div class="distribution-row-head">
              <span>{{ getErrorTypeLabel(item.errorType) }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div class="distribution-bar"><div :style="{ width: getErrorTypeWidth(item.count) }"></div></div>
          </div>
        </div>
        <div v-else class="distribution-empty">暂无错因记录</div>
      </div>
      <div class="distribution-card">
        <h4>学习入口分布</h4>
        <div v-if="normalizedSourceModeData.length" class="distribution-list">
          <div v-for="item in normalizedSourceModeData" :key="item.sourceMode" class="distribution-row">
            <div class="distribution-row-head">
              <span>{{ getSourceModeLabel(item.sourceMode) }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div class="distribution-bar source"><div :style="{ width: getSourceModeWidth(item.count) }"></div></div>
          </div>
        </div>
        <div v-else class="distribution-empty">暂无入口记录</div>
      </div>
    </div>

    <!-- 掌握率饼图 -->
    <div class="chart-container">
      <h4>词汇掌握情况</h4>
      <v-chart :option="pieOption" style="height: 250px" autoresize />
    </div>

    <!-- 每日学习折线图 -->
    <div class="chart-container">
      <h4>每日学习趋势</h4>
      <v-chart :option="lineOption" style="height: 250px" autoresize />
    </div>

    <!-- 章节正确率雷达图 -->
    <div class="chart-container">
      <h4>各章节正确率</h4>
      <v-chart :option="radarOption" style="height: 280px" autoresize />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { exportLearningReportCSV, exportLearningReportJSON, printLearningReport } from '@/utils/reportExport'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, LineChart, RadarChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, RadarComponent
} from 'echarts/components'

use([
  CanvasRenderer, PieChart, LineChart, RadarChart,
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, RadarComponent
])

const props = defineProps({
  stats: { type: Object, default: null },
  dailyData: { type: Array, default: () => [] },
  chapterData: { type: Array, default: () => [] },
  adaptiveSummary: { type: Object, default: null },
  errorTypeData: { type: Array, default: () => [] },
  sourceModeData: { type: Array, default: () => [] }
})

const ERROR_TYPE_LABELS = {
  unknown: '未知/正确',
  spelling_near: '拼写接近',
  meaning_confusion: '释义混淆',
  timeout: '超时未答',
  pronunciation: '发音问题',
  other: '其他错因'
}

const SOURCE_MODE_LABELS = {
  mainline: '主线关卡',
  boss: 'Boss 战',
  review: '复习队列',
  daily: '每日挑战',
  pk: '好友 PK',
  pronunciation: '发音训练',
  endless: '无尽模式'
}

const masterySummary = computed(() => props.stats?.masterySummary || null)

const overviewCards = computed(() => {
  if (masterySummary.value) {
    return [
      { label: '平均掌握度', value: `${masterySummary.value.averageMastery || 0}%` },
      { label: '待复习', value: masterySummary.value.due || 0 },
      { label: '薄弱词', value: masterySummary.value.weak || 0 },
      { label: '已掌握', value: masterySummary.value.mastered || props.stats?.wordsMastered || 0 }
    ]
  }
  return [
    { label: '已学单词', value: props.stats?.wordsLearned || 0 },
    { label: '已掌握', value: props.stats?.wordsMastered || 0 },
    { label: '正确率', value: `${props.stats?.correctRate || 0}%` },
    { label: '总答题数', value: props.stats?.totalQuizzes || 0 }
  ]
})

const normalizedErrorTypeData = computed(() => props.errorTypeData.filter(item => Number(item.count) > 0))
const normalizedSourceModeData = computed(() => props.sourceModeData.filter(item => Number(item.count) > 0))
const maxErrorTypeCount = computed(() => Math.max(1, ...normalizedErrorTypeData.value.map(item => Number(item.count) || 0)))
const maxSourceModeCount = computed(() => Math.max(1, ...normalizedSourceModeData.value.map(item => Number(item.count) || 0)))

function getErrorTypeLabel(errorType) {
  return ERROR_TYPE_LABELS[errorType] || errorType || '未知'
}

function getSourceModeLabel(sourceMode) {
  return SOURCE_MODE_LABELS[sourceMode] || sourceMode || '未知'
}

function getErrorTypeWidth(count) {
  return `${Math.max(6, Math.round((Number(count) || 0) / maxErrorTypeCount.value * 100))}%`
}

function getSourceModeWidth(count) {
  return `${Math.max(6, Math.round((Number(count) || 0) / maxSourceModeCount.value * 100))}%`
}

const pieOption = computed(() => ({
  tooltip: { trigger: 'item' },
  color: ['#7ed321', '#4a90d9', '#666688'],
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    label: { color: '#b8b8d4' },
    data: [
      { value: props.stats?.wordsMastered || 0, name: '已掌握' },
      { value: (props.stats?.wordsLearned || 0) - (props.stats?.wordsMastered || 0), name: '学习中' },
      { value: Math.max(0, (props.stats?.totalVocabCount || 400) - (props.stats?.wordsLearned || 0)), name: '未接触' }
    ]
  }]
}))

const lineOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 20, top: 20, bottom: 30 },
  xAxis: {
    type: 'category',
    data: props.dailyData.map(d => d._id),
    axisLabel: { color: '#888', fontSize: 10 },
    axisLine: { lineStyle: { color: '#333' } }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#888' },
    splitLine: { lineStyle: { color: '#222' } }
  },
  series: [{
    type: 'line',
    data: props.dailyData.map(d => d.total),
    smooth: true,
    lineStyle: { color: '#4a90d9' },
    areaStyle: { color: 'rgba(74, 144, 217, 0.1)' },
    itemStyle: { color: '#4a90d9' }
  }]
}))

function getReportPayload() {
  return {
    exportedAt: new Date().toISOString(),
    stats: props.stats,
    dailyData: props.dailyData,
    chapterData: props.chapterData,
    adaptiveSummary: props.adaptiveSummary,
    errorTypeData: props.errorTypeData,
    sourceModeData: props.sourceModeData
  }
}

function exportJSON() {
  exportLearningReportJSON(getReportPayload())
}

function exportCSV() {
  exportLearningReportCSV(getReportPayload())
}

function printReport() {
  printLearningReport()
}

const radarOption = computed(() => {
  const chapters = ['Ch1 基础', 'Ch2 自然', 'Ch3 商务', 'Ch4 学术', 'Ch5 易混', 'Ch6 综合']
  return {
    radar: {
      indicator: chapters.map(name => ({ name, max: 100 })),
      axisName: { color: '#b8b8d4', fontSize: 11 },
      splitLine: { lineStyle: { color: '#333' } },
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: chapters.map((_, i) => {
          const ch = props.chapterData.find(c => c.chapter === i + 1)
          return ch ? parseFloat(ch.correctRate) : 0
        }),
        name: '正确率',
        lineStyle: { color: '#4a90d9' },
        areaStyle: { color: 'rgba(74, 144, 217, 0.2)' },
        itemStyle: { color: '#4a90d9' }
      }]
    }]
  }
})
</script>

<style scoped lang="scss">
.learning-report {
  padding: 0;
}

.report-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.report-title {
  font-size: 20px;
  color: #ffd700;
}

.export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .btn { padding: 8px 12px; font-size: 13px; min-height: 36px; }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #4a90d9;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #888;
}

.chart-container {
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  padding: 16px;

  h4 {
    font-size: 15px;
    color: #b8b8d4;
    margin-bottom: 10px;
  }
}

.adaptive-summary-card {
  margin-bottom: 24px;
  background: rgba(91, 140, 62, 0.12);
  border: 1px solid rgba(91, 140, 62, 0.35);
  border-radius: 10px;
  padding: 16px;

  h4 { color: #9be66d; margin-bottom: 12px; }
  p { color: #c4b99a; font-size: 13px; line-height: 1.6; }
}

.adaptive-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 10px;

  div {
    background: rgba(0, 0, 0, 0.14);
    border-radius: 8px;
    padding: 10px;
    text-align: center;
  }
  strong { display: block; color: #ffd700; font-size: 18px; }
  span { color: #888; font-size: 12px; }
}

.distribution-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.distribution-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px;

  h4 { font-size: 15px; color: #b8b8d4; margin-bottom: 12px; }
}

.distribution-list {
  display: grid;
  gap: 10px;
}

.distribution-row-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #c4b99a;
  font-size: 13px;
  margin-bottom: 5px;

  strong { color: #ffd700; }
}

.distribution-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;

  div {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #d0021b, #ff8a65);
  }

  &.source div { background: linear-gradient(90deg, #4a90d9, #7ed321); }
}

.distribution-empty {
  padding: 18px 0;
  text-align: center;
  color: #666;
  font-size: 13px;
}

@media (max-width: 640px) {
  .stats-grid,
  .adaptive-grid,
  .distribution-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 430px) {
  .report-toolbar { align-items: stretch; flex-direction: column; }
  .export-actions { display: grid; grid-template-columns: 1fr; }
  .stats-grid,
  .adaptive-grid,
  .distribution-grid { grid-template-columns: 1fr; }
  .chart-container,
  .adaptive-summary-card,
  .distribution-card { padding: 12px; }
}

@media print {
  .export-actions { display: none; }
  .learning-report { color: #111; background: #fff; }
}
</style>
