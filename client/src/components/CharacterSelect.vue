<template>
  <div class="character-overlay">
    <div class="character-panel">
      <h2 class="cs-title">👤 选择角色</h2>

      <div class="character-grid">
        <div
          v-for="char in characters"
          :key="char.id"
          class="character-card"
          :class="{ active: selectedId === char.id }"
          @click="selectedId = char.id"
        >
          <div class="char-preview">
            <canvas
              :ref="el => { if (el) canvasRefs[char.id] = el }"
              width="48"
              height="48"
              class="char-canvas"
            ></canvas>
          </div>
          <div class="char-name">{{ char.name }}</div>
          <div class="char-desc">{{ char.description }}</div>
        </div>
      </div>

      <div class="cs-footer">
        <button class="cs-back-btn" @click="$emit('back')">← 返回</button>
        <button class="cs-confirm-btn" @click="confirmCharacter">✅ 确认选择</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { CHARACTER_PRESETS } from '@/game/data/characters'
import { updateCharacter } from '@/api/game'
import { useUserStore } from '@/stores/user'

const emit = defineEmits(['confirm', 'back'])

const userStore = useUserStore()
const characters = CHARACTER_PRESETS
const selectedId = ref(userStore.characterSpriteIndex || 0)
const canvasRefs = ref({})

// Load player_sheet image and draw previews with tint
onMounted(async () => {
  await nextTick()

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = '/assets/sprout-lands/Sprout Lands - Sprites - Basic pack/Characters/Basic Charakter Spritesheet.png'

  img.onload = () => {
    for (const char of characters) {
      const canvas = canvasRefs.value[char.id]
      if (!canvas) continue

      const ctx = canvas.getContext('2d')
      // Draw first frame (48x48, position 0,0)
      ctx.clearRect(0, 0, 48, 48)
      ctx.drawImage(img, 0, 0, 48, 48, 0, 0, 48, 48)

      if (char.tint) {
        // Apply tint via multiply blend
        ctx.globalCompositeOperation = 'multiply'
        const r = (char.tint >> 16) & 0xff
        const g = (char.tint >> 8) & 0xff
        const b = char.tint & 0xff
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.fillRect(0, 0, 48, 48)

        // Restore alpha from original
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(img, 0, 0, 48, 48, 0, 0, 48, 48)
        ctx.globalCompositeOperation = 'source-over'
      }
    }
  }

  img.onerror = () => {
    // Fallback: draw colored rectangles
    for (const char of characters) {
      const canvas = canvasRefs.value[char.id]
      if (!canvas) continue
      const ctx = canvas.getContext('2d')
      const color = char.tint
        ? `#${char.tint.toString(16).padStart(6, '0')}`
        : '#5b8c3e'
      ctx.fillStyle = color
      ctx.fillRect(8, 8, 32, 32)
      ctx.fillStyle = '#f5edd6'
      ctx.fillRect(16, 16, 6, 6)
      ctx.fillRect(26, 16, 6, 6)
    }
  }
})

async function confirmCharacter() {
  try {
    await updateCharacter({ characterSpriteIndex: selectedId.value })
    userStore.characterSpriteIndex = selectedId.value
  } catch (e) {
    console.warn('保存角色失败:', e)
  }
  emit('confirm')
}
</script>

<style scoped lang="scss">
.character-overlay {
  position: fixed;
  inset: 0;
  background: rgba(45, 80, 22, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}

.character-panel {
  width: 700px;
  max-width: 95vw;
  background: linear-gradient(180deg, #e8d5a3 0%, #d4a76a 100%);
  border: 4px solid #8b6914;
  border-radius: 12px;
  padding: 28px 32px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.cs-title {
  text-align: center;
  font-size: 24px;
  color: #5b3a1a;
  margin-bottom: 24px;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}

.character-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 10px;
  border: 3px solid #8b6914;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.5);
    transform: translateY(-2px);
  }

  &.active {
    border-color: #ffc847;
    background: rgba(255, 200, 71, 0.3);
    box-shadow: 0 0 16px rgba(255, 200, 71, 0.4);
  }
}

.char-preview {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  background: rgba(91, 140, 62, 0.15);
  border-radius: 8px;
  border: 2px solid rgba(139, 105, 20, 0.3);
}

.char-canvas {
  image-rendering: pixelated;
  width: 48px;
  height: 48px;
  transform: scale(1.3);
}

.char-name {
  font-size: 13px;
  font-weight: bold;
  color: #5b3a1a;
  margin-bottom: 4px;
}

.char-desc {
  font-size: 10px;
  color: #8b6914;
  text-align: center;
}

.cs-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
  border-top: 2px solid rgba(139, 105, 20, 0.3);
}

.cs-back-btn {
  padding: 12px 24px;
  border: 2px solid #8b6914;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.3);
  color: #5b3a1a;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  &:hover { background: rgba(255, 255, 255, 0.5); }
}

.cs-confirm-btn {
  flex: 1;
  padding: 12px 24px;
  border: 3px solid #3a6b1e;
  border-radius: 6px;
  background: #5b8c3e;
  color: #f5edd6;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  &:hover {
    background: #6b9c4e;
    border-color: #ffc847;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
