<template>
  <div class="profile-view">
    <header class="profile-header">
      <button class="back-btn" @click="$router.push('/game')">← 返回游戏</button>
      <h1>个人中心</h1>
    </header>

    <!-- 加载中 -->
    <div class="profile-loading" v-if="!userStore.userInfo && userStore.userInfoLoading">
      <p>正在加载用户信息...</p>
    </div>

    <div class="profile-content" v-else-if="userStore.userInfo">
      <div class="profile-card card">
        <div class="avatar-section">
          <div class="avatar">{{ userStore.userInfo.nickname?.charAt(0) || '勇' }}</div>
          <h2>{{ userStore.userInfo.nickname }}</h2>
          <p class="user-id">@{{ userStore.userInfo.username }}</p>
        </div>

        <div class="stats-row">
          <div class="stat">
            <span class="stat-val">Lv.{{ userStore.userInfo.level }}</span>
            <span class="stat-lbl">等级</span>
          </div>
          <div class="stat">
            <span class="stat-val">{{ userStore.userInfo.totalExp }}</span>
            <span class="stat-lbl">经验</span>
          </div>
          <div class="stat">
            <span class="stat-val">{{ userStore.userInfo.totalScore }}</span>
            <span class="stat-lbl">总分</span>
          </div>
        </div>

        <!-- 经验进度条 -->
        <div class="exp-bar-section">
          <div class="exp-info">
            <span>Lv.{{ userStore.userInfo.level }}</span>
            <span>{{ userStore.userInfo.totalExp % 100 }}/100 EXP</span>
            <span>Lv.{{ userStore.userInfo.level + 1 }}</span>
          </div>
          <div class="exp-bar">
            <div class="exp-fill" :style="{ width: (userStore.userInfo.totalExp % 100) + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- 每日奖励 -->
      <div class="daily-card card">
        <h3>🎁 每日登录奖励</h3>
        <p>连续登录: {{ userStore.userInfo.loginStreak || 0 }} 天</p>
        <button class="btn btn-gold" @click="claimDaily" :disabled="dailyClaimed">
          {{ dailyClaimed ? '今日已领取 ✓' : '领取奖励' }}
        </button>
      </div>

      <!-- 成就列表 -->
      <div class="achievement-card card">
        <h3>🏆 成就列表</h3>
        <div class="achievement-grid">
          <div v-for="a in achievements" :key="a.id" class="ach-item" :class="{ locked: !a.unlocked }">
            <span class="ach-icon">{{ a.icon }}</span>
            <span class="ach-name">{{ a.name }}</span>
          </div>
        </div>
      </div>

      <button class="btn logout-btn" @click="handleLogout">退出登录</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { claimDailyReward, getAchievements } from '@/api/game'
import { ACHIEVEMENTS } from '@/game/systems/ScoreSystem'

const router = useRouter()
const userStore = useUserStore()
const dailyClaimed = ref(false)
const achievements = ref(ACHIEVEMENTS.map(a => ({ ...a, unlocked: false })))

onMounted(async () => {
  try {
    await userStore.fetchUserInfo()
    const today = new Date().toISOString().split('T')[0]
    dailyClaimed.value = userStore.userInfo?.dailyRewardDate === today

    const achRes = await getAchievements()
    const unlockedIds = new Set((achRes.data || []).map(a => a.id))
    achievements.value = ACHIEVEMENTS.map(a => ({ ...a, unlocked: unlockedIds.has(a.id) }))
  } catch (e) {
    console.error(e)
  }
})

async function claimDaily() {
  try {
    await claimDailyReward()
    dailyClaimed.value = true
    await userStore.fetchUserInfo()
  } catch (e) {
    alert(e?.message || '领取失败')
  }
}

function handleLogout() {
  userStore.logout()
  router.push('/')
}
</script>

<style scoped lang="scss">
.profile-view {
  width: 100%;
  height: 100%;
  background: var(--bg-dark);
  overflow-y: auto;
  padding: 20px;
}

.profile-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #b8b8d4;
  font-size: 16px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;

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

.profile-content {
  max-width: 600px;
  margin: 0 auto;
}

.profile-card {
  margin-bottom: 16px;
}

.avatar-section {
  text-align: center;
  margin-bottom: 20px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: white;
  font-size: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.user-id {
  color: #888;
  font-size: 13px;
}

.stats-row {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
}

.stat {
  text-align: center;
  .stat-val { display: block; font-size: 22px; font-weight: bold; color: #4a90d9; }
  .stat-lbl { font-size: 12px; color: #888; }
}

.exp-bar-section {
  .exp-info { display: flex; justify-content: space-between; font-size: 12px; color: #888; margin-bottom: 4px; }
}

.exp-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  .exp-fill {
    height: 100%;
    background: linear-gradient(90deg, #4a90d9, #7ed321);
    border-radius: 4px;
    transition: width 0.5s;
  }
}

.daily-card {
  margin-bottom: 16px;
  h3 { margin-bottom: 8px; color: #f5a623; }
  p { color: #b8b8d4; font-size: 14px; margin-bottom: 12px; }
}

.achievement-card {
  margin-bottom: 16px;
  h3 { margin-bottom: 12px; color: #ffd700; }
}

.achievement-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.ach-item {
  text-align: center;
  padding: 10px 4px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);

  &.locked {
    opacity: 0.3;
    filter: grayscale(100%);
  }
}

.ach-icon { font-size: 28px; display: block; margin-bottom: 4px; }
.ach-name { font-size: 11px; color: #b8b8d4; }

.logout-btn {
  width: 100%;
  background: rgba(208, 2, 27, 0.2);
  color: #d0021b;
  border: 1px solid rgba(208, 2, 27, 0.3);
  margin-top: 8px;
  &:hover { background: rgba(208, 2, 27, 0.3); }
}
</style>
