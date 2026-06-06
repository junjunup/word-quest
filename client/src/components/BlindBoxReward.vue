<template>
  <div class="blind-box-overlay" @click.self="$emit('close')">
    <div class="blind-box-stage">
      <!-- 未选择: 展示宝箱 -->
      <template v-if="!selected">
        <h2 class="bb-title">🎁 开启每日挑战宝箱！</h2>
        <p class="bb-sub">选择一个宝箱，看看今天的惊喜！</p>
        <div class="bb-chests">
          <div
            v-for="i in 3"
            :key="i"
            class="bb-chest"
            :class="{ hovering: hoverIndex === i, opening: openingIndex === i }"
            @click="openChest(i)"
            @mouseenter="hoverIndex = i"
            @mouseleave="hoverIndex = -1"
          >
            <div class="chest-lid">
              <div class="lid-top"></div>
              <div class="lid-arch"></div>
              <div class="lid-sparkle">✨</div>
            </div>
            <div class="chest-body">
              <div class="body-front">
                <div class="body-lock">🔒</div>
              </div>
            </div>
            <div class="chest-shadow"></div>
            <div class="chest-glow"></div>
          </div>
        </div>
      </template>

      <!-- 已选择: 展示奖励 -->
      <template v-else>
        <div class="bb-reveal" :class="'rarity-' + reward.rarity">
          <div class="rarity-badge">{{ rarityLabel }}</div>
          <div class="reward-icon">{{ rewardIcon }}</div>
          <h2 class="reward-title">{{ rewardTitle }}</h2>
          <div class="reward-list">
            <div class="reward-item" v-if="reward.gold > 0">
              <span class="ri-icon">🪙</span>
              <span class="ri-value">+{{ reward.gold }}</span>
              <span class="ri-label">金币</span>
            </div>
            <div class="reward-item" v-if="reward.exp > 0">
              <span class="ri-icon">✨</span>
              <span class="ri-value">+{{ reward.exp }}</span>
              <span class="ri-label">经验</span>
            </div>
            <div class="reward-item" v-for="item in reward.items" :key="item.itemId">
              <span class="ri-icon">{{ item.icon }}</span>
              <span class="ri-value">{{ item.name }}</span>
              <span class="ri-label">道具 x1</span>
            </div>
            <div class="reward-item" v-if="reward.title">
              <span class="ri-icon">👑</span>
              <span class="ri-value">{{ reward.title }}</span>
              <span class="ri-label">限定称号</span>
            </div>
          </div>
          <button class="btn btn-gold bb-claim" @click="$emit('claim', reward)">🎉 领取奖励</button>
        </div>
      </template>

      <!-- Loading -->
      <div v-if="loading" class="bb-loading">
        <div class="loading-spinner"></div>
        <p>正在打开宝箱...</p>
      </div>
      <div v-if="error" class="bb-error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { openBlindBox } from '@/api/dailyChallenge'

const props = defineProps({
  challengeId: { type: String, required: true }
})
const emit = defineEmits(['close', 'claim'])

const selected = ref(false)
const loading = ref(false)
const error = ref('')
const reward = ref({ rarity: 'common', gold: 0, exp: 0, items: [], title: '' })
const hoverIndex = ref(-1)
const openingIndex = ref(-1)

const rarityLabels = { common: '🟢 普通宝箱', rare: '🔵 稀有宝箱', epic: '🟣 史诗宝箱', legendary: '🟡 传说宝箱' }
const rewardIcons = { common: '📦', rare: '💎', epic: '🔮', legendary: '👑' }

const rarityLabel = computed(() => rarityLabels[reward.value.rarity] || '宝箱')
const rewardIcon = computed(() => rewardIcons[reward.value.rarity] || '📦')
const rewardTitle = computed(() => {
  if (reward.value.title) return reward.value.title
  return rarityLabel.value
})

async function openChest(index) {
  if (loading.value || selected.value) return
  openingIndex.value = index
  loading.value = true
  error.value = ''
  try {
    const res = await openBlindBox(props.challengeId)
    reward.value = res.data.reward || { rarity: 'common', gold: 50, exp: 0, items: [], title: '' }
    setTimeout(() => { selected.value = true }, 400)
  } catch (e) {
    error.value = e?.message || '开箱失败，请重试'
    openingIndex.value = -1
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.blind-box-overlay {
  position: fixed; inset: 0; background: rgba(10, 8, 20, 0.9);
  display: flex; align-items: center; justify-content: center;
  z-index: 3000; animation: fadeIn 0.3s ease;
}
.blind-box-stage {
  text-align: center; max-width: 500px; width: 90%;
}
.bb-title { color: #ffd700; font-size: 28px; margin-bottom: 8px; font-family: 'Press Start 2P', monospace; }
.bb-sub { color: #c4b99a; font-size: 14px; margin-bottom: 30px; }
.bb-chests { display: flex; justify-content: center; gap: 40px; padding: 20px 0; }
.bb-chest {
  cursor: pointer; position: relative; width: 120px; height: 130px;
  transition: transform 0.3s ease;
  &.hovering { transform: scale(1.12) translateY(-16px); }
  &.opening {
    animation: chestShake 0.4s ease;
    .chest-lid { animation: lidOpen 0.5s ease forwards; }
    .chest-body .body-lock { animation: lockPop 0.3s ease forwards; }
  }
}
.chest-lid {
  position: absolute; top: 0; left: 10px; right: 10px; z-index: 2;
  transition: transform 0.3s;
}
.lid-top {
  height: 24px; background: linear-gradient(180deg, #ffd700 0%, #e8a33c 100%);
  border-radius: 6px 6px 0 0; border: 3px solid #b8832e; border-bottom: none;
}
.lid-arch {
  height: 18px; margin: 0 8px;
  background: linear-gradient(180deg, #e8a33c 0%, #cc8822 100%);
  border-radius: 0 0 12px 12px; border: 3px solid #b8832e; border-top: none;
}
.lid-sparkle {
  position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
  font-size: 16px; animation: sparkleFloat 1.5s infinite;
}
.chest-body {
  position: absolute; bottom: 8px; left: 6px; right: 6px; height: 70px;
  background: linear-gradient(180deg, #d4a040 0%, #b8782a 100%);
  border-radius: 0 0 8px 8px; border: 3px solid #8b5e14;
  box-shadow: inset 0 2px 6px rgba(255,255,255,0.15);
}
.body-front {
  position: absolute; inset: 8px 4px 4px 4px;
  background: linear-gradient(180deg, #c89030 0%, #a0681e 100%);
  border-radius: 0 0 4px 4px; border: 2px solid #7a4f10;
  display: flex; align-items: center; justify-content: center;
}
.body-lock {
  font-size: 18px; transition: transform 0.3s;
}
.chest-shadow {
  position: absolute; bottom: 0; left: 20px; right: 20px; height: 12px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%);
  border-radius: 50%;
}
.chest-glow {
  position: absolute; inset: -15px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,200,71,0.15) 0%, transparent 70%);
  opacity: 0; transition: opacity 0.5s; pointer-events: none;
}
.bb-chest.hovering .chest-glow { opacity: 1; }

@keyframes chestShake {
  0%,100% { transform: scale(1); }
  25% { transform: scale(1.08) rotate(-2deg); }
  75% { transform: scale(1.08) rotate(2deg); }
}
@keyframes lidOpen {
  0% { transform: translateY(0) rotate(0); }
  100% { transform: translateY(-20px) rotate(-15deg); opacity: 0.5; }
}
@keyframes lockPop {
  0% { transform: scale(1); }
  50% { transform: scale(1.8); }
  100% { transform: scale(0); opacity: 0; }
}
@keyframes sparkleFloat {
  0%,100% { transform: translateX(-50%) translateY(0); opacity: 0.6; }
  50% { transform: translateX(-50%) translateY(-6px); opacity: 1; }
}

/* Reveal */
.bb-reveal {
  animation: scaleIn 0.5s ease;
  &.rarity-common { .rarity-badge { color: #aaa; } .reward-icon { filter: drop-shadow(0 0 8px #aaa); } }
  &.rarity-rare { .rarity-badge { color: #69f; } .reward-icon { filter: drop-shadow(0 0 16px #69f); } }
  &.rarity-epic { .rarity-badge { color: #c6f; } .reward-icon { filter: drop-shadow(0 0 24px #c6f); animation: pulse 1s infinite; } }
  &.rarity-legendary {
    .rarity-badge { color: #ffd700; animation: pulse 0.5s infinite; }
    .reward-icon { font-size: 80px; filter: drop-shadow(0 0 32px #ffd700); animation: pulse 0.5s infinite; }
  }
}
.rarity-badge { font-size: 16px; font-weight: bold; margin-bottom: 8px; }
.reward-icon { font-size: 64px; margin-bottom: 12px; }
.reward-title { color: #f5edd6; font-size: 22px; margin-bottom: 20px; }
.reward-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
.reward-item {
  display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.06);
  border-radius: 10px; padding: 10px 16px;
  .ri-icon { font-size: 24px; }
  .ri-value { flex: 1; text-align: left; color: #ffd700; font-weight: bold; font-size: 18px; }
  .ri-label { color: #c4b99a; font-size: 12px; }
}
.bb-claim { min-width: 200px; min-height: 48px; font-size: 18px; margin-top: 8px; }
.bb-loading { padding: 40px; .loading-spinner { width: 48px; height: 48px; border: 4px solid rgba(255,200,71,0.2); border-top-color: #ffc847; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; } p { color: #c4b99a; } }
.bb-error { color: #ff6666; padding: 16px; }

@keyframes scaleIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes spin { to { transform: rotate(360deg); } }
</style>