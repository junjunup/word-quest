<template>
  <div class="achievement-popup" @click="$emit('close')">
    <!-- 粒子 -->
    <div class="ach-particles">
      <span v-for="i in 16" :key="i" class="ach-particle" :style="{ '--i': i, '--c': colors[i % 4] }"></span>
    </div>
    <div class="achievement-card" @click.stop>
      <div class="card-shine"></div>
      <div class="card-border-glow"></div>
      <div class="achievement-icon">{{ achievement?.icon || '🏆' }}</div>
      <h3 class="achievement-title">🎉 成就解锁！</h3>
      <p class="achievement-name">{{ achievement?.name }}</p>
      <p class="achievement-desc">{{ achievement?.description }}</p>
      <button class="ach-btn" @click="$emit('close')">🌟 太棒了！</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import audioManager from '@/game/systems/AudioManager'

defineProps({
  achievement: { type: Object, required: true }
})
defineEmits(['close'])

const colors = ['#ffd700','#ffc847','#ffe066','#fff']

onMounted(() => {
  audioManager.play('level_complete')
})
</script>

<style scoped lang="scss">
.achievement-popup {
  position: fixed; inset: 0; background: rgba(10, 20, 5, 0.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000; animation: fadeIn 0.3s ease;
  perspective: 800px;
}

.achievement-card {
  position: relative; overflow: hidden;
  background: linear-gradient(160deg, #2a2010 0%, #1a1508 30%, #2a2010 60%, #1a1508 100%);
  border-radius: 20px; padding: 44px 54px; text-align: center;
  animation: cardLand 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 60px rgba(255,200,71,0.3), 0 0 120px rgba(255,180,0,0.15), 0 16px 40px rgba(0,0,0,0.5);
}
.card-border-glow {
  position: absolute; inset: -2px; border-radius: 22px; padding: 2px;
  background: linear-gradient(135deg, #ffd700, #ff8c00, #ffd700, #ffaa00, #ffd700);
  background-size: 300% 300%; animation: borderGlow 2s linear infinite;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
}
.card-shine {
  position: absolute; inset: 0; border-radius: 20px;
  background: linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%);
  animation: shineSweep 2s ease-in-out infinite; pointer-events: none; z-index: 1;
}

.achievement-icon { font-size: 72px; margin-bottom: 12px; animation: iconFloat 2s ease-in-out infinite; filter: drop-shadow(0 0 12px rgba(255,200,71,0.5)); z-index: 2; position: relative; }
.achievement-title { color: #ffd700; font-size: 20px; margin-bottom: 12px; font-family: 'Press Start 2P', Microsoft YaHei; text-shadow: 0 0 20px rgba(255,200,71,0.4); z-index: 2; position: relative; }
.achievement-name { color: #fff; font-size: 22px; font-weight: bold; margin-bottom: 8px; z-index: 2; position: relative; }
.achievement-desc { color: #c4b99a; font-size: 14px; margin-bottom: 24px; z-index: 2; position: relative; }

.ach-btn {
  z-index: 2; position: relative;
  padding: 12px 36px; font-size: 18px; font-weight: bold;
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  border: none; border-radius: 12px; color: #3a2000; cursor: pointer;
  box-shadow: 0 4px 16px rgba(255,200,71,0.3);
  transition: all 0.2s;
  &:hover { transform: scale(1.05); box-shadow: 0 6px 24px rgba(255,200,71,0.5); }
  &:active { transform: scale(0.95); }
}

/* Particles */
.ach-particles { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.ach-particle {
  position: absolute; top: 50%; left: 50%; width: 8px; height: 8px;
  border-radius: 50%; background: var(--c);
  animation: particleBurst 1.5s ease-out forwards;
  animation-delay: calc(var(--i) * 0.05s + 0.3s); opacity: 0;
  box-shadow: 0 0 6px var(--c);
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes cardLand { 0% { transform: perspective(800px) rotateX(20deg) rotateY(-10deg) scale(0.4); opacity: 0; } 100% { transform: perspective(800px) rotateX(0) rotateY(0) scale(1); opacity: 1; } }
@keyframes borderGlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes shineSweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
@keyframes iconFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes particleBurst {
  0% { opacity: 0; transform: translate(0, 0) scale(1); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translate(calc(cos(var(--i) * 22.5deg) * 140px), calc(sin(var(--i) * 22.5deg) * 140px)) scale(0); }
}
</style>
