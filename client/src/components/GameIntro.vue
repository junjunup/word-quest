<template>
  <!-- 新手引导 — 底部非阻塞提示条 -->
  <div class="newbie-guide" v-if="currentTip < tips.length">
    <div class="guide-bar">
      <span class="guide-icon">{{ tips[currentTip].icon }}</span>
      <div class="guide-text">
        <strong>{{ tips[currentTip].title }}</strong>
        <span>{{ tips[currentTip].desc }}</span>
      </div>
      <div class="guide-actions">
        <span class="guide-progress">{{ currentTip + 1 }}/{{ tips.length }}</span>
        <button class="guide-next" @click="nextTip">
          {{ currentTip < tips.length - 1 ? '下一项 →' : '知道了 👍' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { safeSetItem } from '@/utils/helpers'

const emit = defineEmits(['dismiss'])

const tips = [
  {
    icon: '🎮',
    title: '移动角色',
    desc: '方向键 ↑↓←→ 或 WASD 在田园中移动'
  },
  {
    icon: '🐔',
    title: '击败怪物',
    desc: '靠近小鸡触发答题，答对消灭怪物获得分数'
  },
  {
    icon: '👹',
    title: 'Boss 战',
    desc: '每关末有 Boss，需连续答对多题才能击败'
  },
  {
    icon: '⭐',
    title: '星级评价',
    desc: '根据正确率和速度获得 1-3 星，努力争取三星吧'
  },
  {
    icon: '🐮',
    title: 'AI 学伴小智',
    desc: '答错后小智会讲解单词，也可以主动点击 🤖 求助'
  }
]

const currentTip = ref(0)

function nextTip() {
  if (currentTip.value < tips.length - 1) {
    currentTip.value++
  } else {
    finishTutorial()
  }
}

function finishTutorial() {
  // 用户看过引导，不再自动显示
  safeSetItem('wordquest:skipIntro', 'true')
  currentTip.value = tips.length  // 隐藏
  emit('dismiss')
}

// 键盘快捷键：空格或回车跳过
function onKeyDown(e) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    nextTip()
  }
  if (e.key === 'Escape') {
    finishTutorial()
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<style scoped lang="scss">
.newbie-guide {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1500;
  width: 920px;
  max-width: 95%;
  animation: slideUp 0.3s ease;
}

.guide-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
  background: rgba(45, 80, 22, 0.92);
  border: 2px solid #8b6914;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.guide-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.guide-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    color: #ffc847;
    font-size: 14px;
    font-family: 'Microsoft YaHei', sans-serif;
  }

  span {
    color: #d4c99a;
    font-size: 12px;
    font-family: 'Microsoft YaHei', sans-serif;
  }
}

.guide-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.guide-progress {
  color: #8b6914;
  font-size: 11px;
  font-family: 'Microsoft YaHei', sans-serif;
}

.guide-next {
  background: #5b8c3e;
  color: #f5edd6;
  border: 2px solid #3a6b1e;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-family: 'Microsoft YaHei', sans-serif;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;

  &:hover {
    background: #6b9c4e;
    border-color: #ffc847;
  }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
