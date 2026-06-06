<template>
  <!-- HUD覆盖层 - 仅在关卡内显示 -->
  <div class="game-hud" v-if="visible && inGameLevel">
    <div class="hud-left">
      <span class="hud-hearts">
        <template v-if="isTutorialLevel">
          <span class="heart">❤️</span>
          <span class="heart-infinity">∞</span>
        </template>
        <template v-else>
          <span class="hp-bar-wrap">
            <span class="hp-bar-fill" :style="{ width: (hudData.lives / hudData.maxLives * 100) + '%' }"></span>
            <span class="hp-label">{{ hudData.lives }}/{{ hudData.maxLives }}</span>
          </span>
        </template>
      </span>
      <span class="hud-score">⭐ {{ hudData.score }}</span>
      <span class="hud-gold">🪙 {{ gold }}</span>
      <span class="hud-combo" v-if="hudData.combo > 0">🔥 x{{ hudData.combo }}</span>
    </div>
    <div class="hud-right">
      <span class="difficulty-hud-badge" v-if="difficulty !== 'normal'">
        {{ { easy: '🌱简单', hard: '🔥困难' }[difficulty] }}
      </span>
      <span>第{{ hudData.chapter }}章 第{{ hudData.level }}关</span>
      <button class="btn-icon" @click="$emit('open-chat')" title="求助小智">🤖</button>
      <button class="btn-icon" @click="$emit('go-dashboard')" title="学习报告">📊</button>
      <button class="btn-icon" @click="$emit('toggle-pause')" title="暂停">⏸️</button>
    </div>
  </div>

  <!-- 暂停菜单 - 仅在关卡内 -->
  <div class="pause-overlay" v-if="showPause && inGameLevel">
    <div class="pause-card card">
      <h3 class="pause-title">⏸️ 游戏暂停</h3>
      <button class="btn btn-primary pause-btn" @click="$emit('toggle-pause')">🌿 继续游戏</button>
      <button class="btn pause-btn" @click="$emit('toggle-mute')">
        {{ isMuted ? '🔇 取消静音' : '🔊 静音' }}
      </button>
      <button class="btn btn-gold pause-btn" @click="$emit('back-to-menu')">🏠 返回菜单</button>
      <button class="btn pause-btn logout-btn" @click="$emit('logout')">🚪 退出登录</button>
      <p class="pause-hint">💡 ESC 继续 · 方向键/WASD 移动 · 触碰怪物答题</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  inGameLevel: { type: Boolean, default: false },
  isTutorialLevel: { type: Boolean, default: false },
  difficulty: { type: String, default: 'normal' },
  showPause: { type: Boolean, default: false },
  isMuted: { type: Boolean, default: false },
  gold: { type: Number, default: 0 },
  hudData: {
    type: Object,
    default: () => ({ lives: 3, maxLives: 3, score: 0, combo: 0, chapter: 1, level: 1 })
  }
})

defineEmits(['open-chat', 'go-dashboard', 'toggle-pause', 'toggle-mute', 'back-to-menu', 'logout'])
</script>

<style scoped lang="scss">
.game-hud {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 960px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: linear-gradient(180deg, rgba(91, 58, 26, 0.9) 0%, rgba(91, 58, 26, 0.7) 100%);
  border-bottom: 2px solid #8b6914;
  z-index: 100;
  pointer-events: all;
}

.hud-left { display: flex; align-items: center; gap: 16px; }

/* HP bar */
.hp-bar-wrap {
  display: inline-flex; align-items: center; position: relative;
  width: 100px; height: 16px; background: #3a1a1a;
  border: 2px solid #8b6914; border-radius: 3px; overflow: hidden;
}
.hp-bar-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, #d44, #e66);
  transition: width 0.3s ease; border-radius: 1px;
}
.hp-label {
  position: relative; z-index: 1; margin: 0 auto;
  color: #f5edd6; font-size: 10px; font-weight: bold;
  font-family: 'Press Start 2P', monospace;
  text-shadow: 0 0 4px #000;
}

.heart.lost { filter: grayscale(100%); opacity: 0.3; }

.heart-infinity {
  color: #ffc847; font-weight: bold; font-size: 16px;
  font-family: 'Press Start 2P', monospace; margin-left: -4px;
}

.hud-score {
  color: #ffc847; font-weight: bold;
  font-family: 'Press Start 2P', monospace; font-size: 13px;
}
.hud-gold {
  color: #ffd700; font-weight: bold;
  font-family: 'Press Start 2P', monospace; font-size: 11px;
  background: rgba(255, 215, 0, 0.15); border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 4px; padding: 2px 6px;
}

.hud-combo {
  color: #e8a33c; font-weight: bold;
  font-family: 'Press Start 2P', monospace; font-size: 13px;
  animation: hudPulse 0.5s ease;
}

.hud-right {
  display: flex; align-items: center; gap: 12px;
  color: #f5edd6; font-size: 13px;
}

.difficulty-hud-badge {
  background: rgba(255, 200, 71, 0.2); border: 1px solid #ffc847;
  border-radius: 4px; padding: 2px 8px; font-size: 11px; color: #ffc847;
}

.btn-icon {
  background: #5b8c3e; border: 2px solid #3a6b1e; border-radius: 4px;
  padding: 4px 8px; font-size: 18px; cursor: pointer; transition: all 0.2s;
  &:hover { background: #6b9c4e; border-color: #ffc847; transform: translateY(-1px); }
}

.pause-overlay {
  position: fixed; inset: 0; background: rgba(45, 80, 22, 0.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000; animation: hudFadeIn 0.2s ease;
}

.pause-card { text-align: center; min-width: 280px; padding: 30px 40px; }
.pause-title { color: #5b3a1a; font-size: 24px; margin-bottom: 24px; }

.pause-btn {
  display: block; width: 100%; margin-bottom: 12px; padding: 12px; font-size: 16px;
}

.logout-btn {
  background: #d45b3e; border-color: #a04030; color: #f5edd6;
  &:hover { background: #e06b4e; }
}

.pause-hint {
  color: #c4b99a; font-size: 11px; margin-top: 16px; opacity: 0.7;
}

@keyframes hudPulse {
  from { transform: scale(1.2); }
  to { transform: scale(1); }
}

@keyframes hudFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 980px) {
  .game-hud { width: min(100vw, 960px); }
}

@media (max-width: 760px), (pointer: coarse) {
  .game-hud { flex-direction: column; align-items: stretch; gap: 6px; padding: 6px 10px; }
  .hud-left, .hud-right { flex-wrap: wrap; justify-content: center; gap: 8px; }
  .btn-icon { min-width: 44px; min-height: 44px; }
}

@media (max-width: 430px) {
  .game-hud { font-size: 12px; }
}
</style>
