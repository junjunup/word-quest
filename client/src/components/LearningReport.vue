<template>
  <div class="learning-report">
    <h3 class="report-title">📊 学习报告</h3>

    <!-- 概览卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats?.wordsLearned || 0 }}</div>
        <div class="stat-label">已学单词</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats?.wordsMastered || 0 }}</div>
        <div class="stat-label">已掌握</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats?.correctRate || 0 }}%</div>
        <div class="stat-label">正确率</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats?.totalQuizzes || 0 }}</div>
        <div class="stat-label">总答题数</div>
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
  chapterData: { type: Array, default: () => [] }
})

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

.report-title {
  font-size: 20px;
  color: #ffd700;
  margin-bottom: 20px;
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
</style>
