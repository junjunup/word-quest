import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getStats, getDailyStats } from '@/api/learning'

export const useLearningStore = defineStore('learning', () => {
  const stats = ref(null)
  const dailyStats = ref([])
  const chapterStats = ref([])
  const topMistakes = ref([])

  async function fetchStats() {
    const res = await getStats()
    stats.value = res.data
  }

  async function fetchDailyStats(days = 30) {
    const res = await getDailyStats(days)
    dailyStats.value = res.data
  }

  return { stats, dailyStats, chapterStats, topMistakes, fetchStats, fetchDailyStats }
})
