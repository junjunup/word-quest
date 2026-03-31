<template>
  <div class="scoreboard">
    <h3 class="board-title">🏆 排行榜</h3>

    <div class="tab-bar">
      <button :class="{ active: activeTab === 'total' }" @click="loadLeaderboard('total')">总分排行</button>
      <button :class="{ active: activeTab === 'exp' }" @click="loadLeaderboard('exp')">经验排行</button>
    </div>

    <div class="player-list">
      <div
        v-for="(player, index) in leaderboard"
        :key="player._id"
        class="player-row"
        :class="{ top3: index < 3 }"
      >
        <span class="rank">
          <template v-if="index === 0">🥇</template>
          <template v-else-if="index === 1">🥈</template>
          <template v-else-if="index === 2">🥉</template>
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="player-name">{{ player.nickname }}</span>
        <span class="player-level">Lv.{{ player.level }}</span>
        <span class="player-score">{{ activeTab === 'total' ? player.totalScore : player.totalExp }}</span>
      </div>

      <div v-if="leaderboard.length === 0" class="empty-state">
        暂无数据，快来成为第一名吧！
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getLeaderboard } from '@/api/game'

const activeTab = ref('total')
const leaderboard = ref([])

onMounted(() => loadLeaderboard('total'))

async function loadLeaderboard(type) {
  activeTab.value = type
  try {
    const res = await getLeaderboard(type)
    leaderboard.value = res.data || []
  } catch (e) {
    console.error('加载排行榜失败:', e)
  }
}
</script>

<style scoped lang="scss">
.scoreboard {
  background: var(--bg-medium);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.board-title {
  font-size: 20px;
  color: #ffd700;
  margin-bottom: 16px;
  text-align: center;
}

.tab-bar {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  button {
    flex: 1;
    padding: 8px;
    background: none;
    border: none;
    color: #888;
    font-size: 14px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;

    &.active {
      color: #4a90d9;
      border-bottom-color: #4a90d9;
    }
  }
}

.player-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 4px;

  &:hover { background: rgba(255, 255, 255, 0.03); }
  &.top3 { background: rgba(255, 215, 0, 0.05); }
}

.rank {
  width: 36px;
  text-align: center;
  font-size: 16px;
}

.player-name {
  flex: 1;
  font-size: 14px;
  color: white;
}

.player-level {
  color: #b8b8d4;
  font-size: 12px;
  margin-right: 16px;
}

.player-score {
  color: #ffd700;
  font-weight: bold;
  font-size: 14px;
}

.empty-state {
  text-align: center;
  color: #666;
  padding: 30px;
  font-size: 14px;
}
</style>
