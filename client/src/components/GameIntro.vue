<template>
  <div class="tutorial-overlay" v-if="currentStep > 0">
    <!-- 半透明遮罩 -->
    <div class="tutorial-mask" @click.self="handleMaskClick"></div>

    <!-- 步骤1：移动操作引导 -->
    <div class="tutorial-tooltip step-move" v-if="currentStep === 1">
      <div class="tooltip-arrow tooltip-arrow-down"></div>
      <div class="tooltip-content">
        <div class="tooltip-icon">🎮</div>
        <h3>移动你的角色！</h3>
        <div class="key-hints">
          <span class="key">W</span>
          <span class="key">A</span>
          <span class="key">S</span>
          <span class="key">D</span>
          <span class="or-text">或</span>
          <span class="key">↑</span>
          <span class="key">←</span>
          <span class="key">↓</span>
          <span class="key">→</span>
        </div>
        <p class="tooltip-desc">使用键盘移动角色，去接触小鸡怪物吧！</p>
        <div class="step-indicator">步骤 1/3</div>
      </div>
    </div>

    <!-- 步骤2：接近怪物引导 -->
    <div class="tutorial-tooltip step-monster" v-if="currentStep === 2">
      <div class="tooltip-arrow tooltip-arrow-up"></div>
      <div class="tooltip-content">
        <div class="tooltip-icon">🐔</div>
        <h3>接触小鸡怪物！</h3>
        <p class="tooltip-desc">走到 <strong>🐔 小鸡</strong> 旁边触发词汇答题。<br>答对消灭怪物获得分数，答错扣一条命！</p>
        <div class="pulse-arrow">⬆️ 走向附近的怪物</div>
        <div class="step-indicator">步骤 2/3</div>
      </div>
    </div>

    <!-- 步骤3：答题完成后的提示 -->
    <div class="tutorial-tooltip step-complete" v-if="currentStep === 3">
      <div class="tooltip-content">
        <div class="tooltip-icon">🏆</div>
        <h3>太棒了！</h3>
        <p class="tooltip-desc">
          🔥 <strong>连续答对</strong>可获得连击加成！<br>
          ⭐ 根据正确率和用时获得 1-3 颗星<br>
          💰 更高难度有分数倍率加成<br>
          🤖 答错时 <strong>小智</strong> 会来帮你讲解<br>
          <br>
          消灭所有小怪和 Boss 即可通关！
        </p>
        <button class="btn btn-primary start-adventure-btn" @click="finishTutorial">
          开始冒险 ⚔️
        </button>
        <div class="step-indicator">步骤 3/3</div>
      </div>
    </div>

    <!-- 跳过按钮 -->
    <button class="skip-btn" @click="skipTutorial" v-if="currentStep < 3">
      跳过引导 →
    </button>

    <!-- 下次不再显示 -->
    <label class="skip-forever" v-if="currentStep === 3">
      <input type="checkbox" v-model="skipNext" /> 下次不再显示引导
    </label>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import eventBus, { EVENTS } from '@/game/systems/EventBus'
import { TUTORIAL_CONFIG } from '@/game/config/gameConstants'
import { safeSetItem } from '@/utils/helpers'

const emit = defineEmits(['dismiss'])

const currentStep = ref(1)
const skipNext = ref(false)
let playerMoved = false
let quizAnswered = false

// 监听玩家移动（通过键盘事件检测）
function onKeyDown(e) {
  const moveKeys = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
  if (moveKeys.includes(e.key) && currentStep.value === 1 && !playerMoved) {
    playerMoved = true
    // 延迟后进入下一步（让玩家感受移动）
    setTimeout(() => {
      if (currentStep.value === 1) {
        currentStep.value = 2
      }
    }, TUTORIAL_CONFIG.moveDetectDelay)
  }
}

// 监听答题完成
function onQuizAnswered() {
  if (currentStep.value === 2 && !quizAnswered) {
    quizAnswered = true
    // 答题完成后短暂延迟进入最后一步
    setTimeout(() => {
      if (currentStep.value === 2) {
        currentStep.value = 3
      }
    }, TUTORIAL_CONFIG.quizCompleteDelay)
  }
}

function handleMaskClick() {
  // 步骤1点击遮罩不做任何事（需要键盘操作）
  // 步骤2和3允许点击推进
  if (currentStep.value === 2) {
    currentStep.value = 3
  }
}

function skipTutorial() {
  finishTutorial()
}

function finishTutorial() {
  if (skipNext.value) {
    safeSetItem('wordquest:skipIntro', 'true')
  }
  currentStep.value = 0
  emit('dismiss')
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  eventBus.on(EVENTS.QUIZ_ANSWERED, onQuizAnswered)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  eventBus.off(EVENTS.QUIZ_ANSWERED, onQuizAnswered)
})
</script>

<style scoped lang="scss">
.tutorial-overlay {
  position: fixed;
  inset: 0;
  z-index: 1800;
  pointer-events: none;

  * {
    pointer-events: auto;
  }
}

.tutorial-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: auto;
}

.tutorial-tooltip {
  position: absolute;
  z-index: 1810;
  animation: tooltipAppear 0.4s ease;
}

.step-move {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -70%);
}

.step-monster {
  top: 30%;
  left: 50%;
  transform: translateX(-50%);
}

.step-complete {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.tooltip-content {
  background: linear-gradient(180deg, #e8d5a3 0%, #d4a76a 100%);
  border: 4px solid #8b6914;
  border-radius: 12px;
  padding: 20px 28px;
  text-align: center;
  min-width: 320px;
  max-width: 440px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 60px rgba(255, 200, 71, 0.15);
}

.tooltip-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.tooltip-content h3 {
  font-size: 20px;
  color: #5b3a1a;
  margin-bottom: 12px;
}

.tooltip-desc {
  color: #5b3a1a;
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 8px;
}

.tooltip-arrow {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;

  &.tooltip-arrow-down {
    bottom: -12px;
    border-left: 14px solid transparent;
    border-right: 14px solid transparent;
    border-top: 14px solid #8b6914;
  }

  &.tooltip-arrow-up {
    top: -12px;
    border-left: 14px solid transparent;
    border-right: 14px solid transparent;
    border-bottom: 14px solid #8b6914;
  }
}

.key-hints {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 6px;
  background: #5b3a1a;
  color: #f5edd6;
  border: 2px solid #8b6914;
  font-weight: bold;
  font-size: 13px;
  animation: keyBounce 1.5s ease infinite;
}

.or-text {
  color: #8b6914;
  font-size: 12px;
  margin: 0 4px;
}

.pulse-arrow {
  color: #ffc847;
  font-size: 16px;
  font-weight: bold;
  margin-top: 8px;
  animation: pulseUp 1s ease infinite;
}

.step-indicator {
  color: #8b6914;
  font-size: 11px;
  margin-top: 12px;
  opacity: 0.7;
}

.skip-btn {
  position: absolute;
  bottom: 24px;
  right: 24px;
  background: rgba(91, 58, 26, 0.8);
  border: 2px solid #8b6914;
  color: #f5edd6;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 1820;

  &:hover {
    background: rgba(139, 105, 20, 0.8);
  }
}

.skip-forever {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  color: #f5edd6;
  font-size: 12px;
  cursor: pointer;
  z-index: 1820;
  background: rgba(91, 58, 26, 0.7);
  padding: 6px 14px;
  border-radius: 4px;

  input { cursor: pointer; }
}

.start-adventure-btn {
  margin-top: 12px;
  padding: 10px 30px;
  font-size: 16px;
}

/* Animations */
@keyframes tooltipAppear {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.step-move {
  animation: tooltipAppear 0.4s ease;
}

.step-monster {
  animation: tooltipSlideDown 0.4s ease;
}

@keyframes tooltipSlideDown {
  from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes keyBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@keyframes pulseUp {
  0%, 100% { opacity: 1; transform: translateY(0); }
  50% { opacity: 0.6; transform: translateY(-6px); }
}
</style>
