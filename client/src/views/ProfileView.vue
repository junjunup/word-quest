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

      <!-- 学习提醒 -->
      <div class="reminder-card card">
        <h3>⏰ 学习提醒</h3>
        <p>设置每日提醒时间，浏览器会在到点后提示你回来复习。</p>
        <label class="reminder-toggle">
          <input type="checkbox" v-model="reminderEnabled" />
          <span>开启每日提醒</span>
        </label>
        <div class="reminder-row">
          <input class="time-input" type="time" v-model="reminderTime" :disabled="!reminderEnabled" />
          <button class="btn btn-primary" @click="saveReminder" :disabled="savingReminder">
            {{ savingReminder ? '保存中...' : '保存提醒' }}
          </button>
        </div>
        <p class="reminder-tip">{{ reminderTip }}</p>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { claimDailyReward, getAchievements } from '@/api/game'
import { ACHIEVEMENTS } from '@/game/systems/ScoreSystem'

const router = useRouter()
const userStore = useUserStore()
const dailyClaimed = ref(false)
const achievements = ref(ACHIEVEMENTS.map(a => ({ ...a, unlocked: false })))
const reminderEnabled = ref(false)
const reminderTime = ref('20:00')
const reminderTip = ref('提醒仅在当前浏览器生效，可随时关闭。')
const savingReminder = ref(false)
let reminderTimer = null

onMounted(async () => {
  try {
    await userStore.fetchUserInfo()
    const today = new Date().toISOString().split('T')[0]
    dailyClaimed.value = userStore.userInfo?.dailyRewardDate === today
    const settings = userStore.userInfo?.reminderSettings || {}
    reminderEnabled.value = !!settings.enabled
    reminderTime.value = settings.time || '20:00'
    scheduleReminder()

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

async function saveReminder() {
  savingReminder.value = true
  try {
    if (reminderEnabled.value && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    await userStore.saveReminderSettings({ enabled: reminderEnabled.value, time: reminderTime.value })
    scheduleReminder()
    reminderTip.value = reminderEnabled.value ? `已设置每天 ${reminderTime.value} 提醒复习` : '已关闭每日提醒'
  } catch (e) {
    reminderTip.value = e?.message || '提醒设置保存失败'
  } finally {
    savingReminder.value = false
  }
}

function scheduleReminder() {
  if (reminderTimer) clearTimeout(reminderTimer)
  if (!reminderEnabled.value || typeof window === 'undefined' || !('Notification' in window)) return
  const [hour, minute] = reminderTime.value.split(':').map(Number)
  const now = new Date()
  const next = new Date()
  next.setHours(hour, minute, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  reminderTimer = setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('Word Quest 今日复习', { body: '今日复习队列已准备好，回来巩固一下吧！' })
    }
    scheduleReminder()
  }, next - now)
}

onUnmounted(() => {
  if (reminderTimer) clearTimeout(reminderTimer)
})

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

.reminder-card {
  margin-bottom: 16px;
  h3 { margin-bottom: 8px; color: #ffd700; }
  p { color: #b8b8d4; font-size: 14px; margin-bottom: 12px; }
}

.reminder-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5b3a1a;
  font-weight: 700;
  margin-bottom: 12px;
}

.reminder-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.time-input {
  min-height: 44px;
  border: 2px solid #8b6914;
  border-radius: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.5);
  color: #5b3a1a;
  font-size: 16px;
}

.reminder-tip { color: #5b8c3e !important; }

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

@media (max-width: 430px) {
  .profile-view { padding: 12px; }
  .profile-header { flex-wrap: wrap; }
  .stats-row,
  .reminder-row { flex-direction: column; align-items: stretch; }
  .achievement-grid { grid-template-columns: repeat(2, 1fr); }
  .back-btn,
  .btn { min-height: 44px; }
}
</style>
