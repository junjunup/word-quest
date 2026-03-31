<template>
  <div class="achievement-popup" @click="$emit('close')">
    <div class="achievement-card" @click.stop>
      <div class="achievement-icon">{{ achievement?.icon || '🏆' }}</div>
      <h3 class="achievement-title">🎉 成就解锁！</h3>
      <p class="achievement-name">{{ achievement?.name }}</p>
      <p class="achievement-desc">{{ achievement?.description }}</p>
      <button class="btn btn-gold" @click="$emit('close')">🌟 太棒了！</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  achievement: { type: Object, required: true }
})
defineEmits(['close'])
</script>

<style scoped lang="scss">
.achievement-popup {
  position: fixed;
  inset: 0;
  background: rgba(45, 80, 22, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}

.achievement-card {
  background: linear-gradient(180deg, #e8d5a3 0%, #d4a76a 100%);
  border: 4px solid #ffc847;
  border-radius: 8px;
  padding: 40px 50px;
  text-align: center;
  animation: scaleIn 0.5s ease;
  box-shadow: 0 6px 0 #8b6914, 0 0 40px rgba(255, 200, 71, 0.4);
}

/* scaleIn 动画 */
@keyframes scaleIn {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.achievement-icon {
  font-size: 64px;
  margin-bottom: 10px;
}

.achievement-title {
  color: #5b3a1a;
  font-size: 22px;
  margin-bottom: 10px;
  font-family: 'Press Start 2P', Microsoft YaHei;
  text-shadow: 0 2px 0 rgba(255, 255, 255, 0.3);
}

.achievement-name {
  color: #5b3a1a;
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 6px;
}

.achievement-desc {
  color: #8b6914;
  font-size: 14px;
  margin-bottom: 20px;
}
</style>
