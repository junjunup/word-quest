<!-- Cycle 6: 排行榜组件 — 周榜 + 全时榜 -->
<template>
  <div class="lb-overlay" @click.self="$emit('close')">
    <div class="lb-panel">
      <div class="lb-header">
        <h2 class="lb-title">🏆 排行榜</h2>
        <button class="lb-close" @click="$emit('close')">✕</button>
      </div>

      <!-- Tab 切换 -->
      <div class="lb-tabs">
        <button :class="['lb-tab', { active: tab === 'weekly' }]" @click="tab = 'weekly'; loadData()">📅 本周</button>
        <button :class="['lb-tab', { active: tab === 'alltime' }]" @click="tab = 'alltime'; loadData()">👑 总榜</button>
      </div>

      <div v-if="loading" class="lb-loading">加载中...</div>
      <div v-else-if="error" class="lb-error">⚠️ {{ error }}</div>

      <div v-else class="lb-list">
        <!-- 当前用户排名 -->
        <div v-if="currentRank" class="lb-my-rank">
          🎯 我的排名: <strong>#{{ currentRank }}</strong>
        </div>

        <div v-for="p in players" :key="p.userId" class="lb-row" :class="{ 'lb-me': p.userId === myUserId }">
          <span class="lb-rank" :class="rankClass(p.rank)">#{{ p.rank }}</span>
          <span class="lb-avatar">{{ p.avatar === 'default' ? '🧑‍🎓' : p.avatar }}</span>
          <span class="lb-name">{{ p.nickname }}</span>
          <span class="lb-level">Lv.{{ p.level }}</span>
          <span class="lb-stat">
            <template v-if="tab === 'weekly'">
              📖 {{ p.wordsLearned }}词 | 🎯 {{ p.accuracy }}%
            </template>
            <template v-else>
              ⭐ {{ p.totalStars }}星
            </template>
          </span>
        </div>

        <div v-if="players.length === 0" class="lb-empty">
          暂无数据，快去学习吧！📚
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '@/utils/request'
import { useUserStore } from '@/stores/user'

const emit = defineEmits(['close'])

const tab = ref('weekly')
const players = ref([])
const currentRank = ref(null)
const myUserId = ref('')
const loading = ref(true)
const error = ref('')

onMounted(() => {
  const userStore = useUserStore()
  myUserId.value = userStore.userInfo?._id || userStore.userId || ''
  loadData()
})

async function loadData() {
  loading.value = true
  error.value = ''
  const endpoint = tab.value === 'weekly' ? '/leaderboard/weekly' : '/leaderboard/all-time'
  try {
    const res = await request.get(endpoint)
    if (res?.success) {
      players.value = res.data.players || []
      currentRank.value = res.data.currentUserRank
    } else {
      error.value = res?.message || '获取排行榜失败'
    }
  } catch (e) {
    error.value = '网络连接失败'
  } finally {
    loading.value = false
  }
}

function rankClass(rank) {
  if (rank === 1) return 'lb-gold'
  if (rank === 2) return 'lb-silver'
  if (rank === 3) return 'lb-bronze'
  return ''
}
</script>

<style scoped>
.lb-overlay { position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,0.55); display: grid; place-items: center; }
.lb-panel {
  background: linear-gradient(180deg, #2d3e50, #1a2a3a);
  border: 3px solid #ffc847; border-radius: 12px;
  padding: 24px; width: min(520px, 92vw); max-height: 80vh; overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
}
.lb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.lb-title { font-size: 22px; color: #ffc847; margin: 0; }
.lb-close { background: none; border: none; color: #8899aa; font-size: 22px; cursor: pointer; }
.lb-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.lb-tab {
  flex: 1; padding: 8px; border: 2px solid rgba(255,200,71,0.3);
  background: rgba(255,255,255,0.05); color: #ccd;
  border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;
}
.lb-tab.active { background: rgba(255,200,71,0.2); border-color: #ffc847; color: #ffc847; }
.lb-loading, .lb-error, .lb-empty { text-align: center; color: #aab; padding: 30px; }
.lb-my-rank { text-align: center; color: #ffc847; font-size: 14px; padding: 8px; margin-bottom: 8px; background: rgba(255,200,71,0.08); border-radius: 6px; }
.lb-list { display: flex; flex-direction: column; gap: 4px; }
.lb-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  background: rgba(255,255,255,0.04); border-radius: 6px;
  color: #f5edd6; transition: background .2s;
}
.lb-row:hover { background: rgba(255,255,255,0.1); }
.lb-me { background: rgba(255,200,71,0.12); border: 1px solid rgba(255,200,71,0.3); }
.lb-rank { font-size: 14px; font-weight: bold; min-width: 36px; }
.lb-gold { color: #ffc847; font-size: 18px; }
.lb-silver { color: #c0c0c0; font-size: 16px; }
.lb-bronze { color: #cd7f32; font-size: 16px; }
.lb-avatar { font-size: 18px; }
.lb-name { flex: 1; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lb-level { font-size: 12px; color: #889; }
.lb-stat { font-size: 12px; color: #aab; white-space: nowrap; }
</style>
