<template>
  <div class="quiz-modal-overlay">
    <div class="quiz-modal" :class="{ shake: shaking }">
      <!-- 倒计时 -->
      <div class="timer-bar">
        <div class="timer-fill" :style="{ width: timerPercent + '%' }" :class="{ danger: timerPercent < 20 }"></div>
      </div>

      <!-- 题目信息 -->
      <div class="quiz-header">
        <span class="difficulty-badge">⚔️ Lv.{{ difficulty }}</span>
        <span class="timer-text">⏱ {{ Math.ceil(remainingTime / 1000) }}s</span>
      </div>

      <!-- 单词展示 -->
      <div class="word-display">
        <h2 class="word-text">{{ wordData?.word }}</h2>
        <p class="phonetic" v-if="wordData?.phonetic">{{ wordData.phonetic }}</p>
      </div>

      <!-- 题目提示 -->
      <p class="quiz-prompt">请选择正确的中文释义：</p>

      <!-- 选项 -->
      <div class="options-grid">
        <button
          v-for="(option, index) in shuffledOptions"
          :key="index"
          class="option-btn"
          :class="{
            correct: answered && option.correct,
            wrong: answered && selectedIndex === index && !option.correct,
            disabled: answered
          }"
          @click="selectOption(index, option)"
          :disabled="answered"
        >
          <span class="option-letter">{{ ['A', 'B', 'C', 'D'][index] }}</span>
          <span class="option-text">{{ option.text }}</span>
        </button>
      </div>

      <!-- 结果反馈 -->
      <div v-if="answered" class="result-feedback" :class="isCorrect ? 'correct' : 'wrong'">
        <p class="result-icon">{{ isCorrect ? '✅ 回答正确！' : '❌ 回答错误' }}</p>
        <p v-if="!isCorrect" class="correct-answer">正确答案：{{ wordData?.meaning }}</p>
        <p v-if="wordData?.example" class="example-sentence">📖 例句：{{ wordData.example }}</p>
        <button class="btn btn-primary continue-btn" @click="continueGame">
          {{ isCorrect ? '🌿 继续战斗' : '📝 知道了' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  wordData: { type: Object, required: true },
  difficulty: { type: Number, default: 1 }
})

const emit = defineEmits(['answer', 'close'])

const answered = ref(false)
const isCorrect = ref(false)
const selectedIndex = ref(-1)
const shaking = ref(false)
const startTime = ref(Date.now())

// 倒计时 30秒
const totalTime = 30000
const remainingTime = ref(totalTime)
let timerInterval = null

const timerPercent = computed(() => (remainingTime.value / totalTime) * 100)

// 选项已在 GameView buildQuizData 中 shuffle 过，不再二次随机
// 使用 ref 固定一次，避免 Vue 重渲染时重排
const shuffledOptions = ref([])
onMounted(() => {
  shuffledOptions.value = props.wordData?.options || []
  startTime.value = Date.now()
  timerInterval = setInterval(() => {
    remainingTime.value = Math.max(0, totalTime - (Date.now() - startTime.value))
    if (remainingTime.value <= 0) {
      handleTimeout()
    }
  }, 100)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

function selectOption(index, option) {
  if (answered.value) return

  selectedIndex.value = index
  answered.value = true
  isCorrect.value = option.correct

  const responseTime = Date.now() - startTime.value
  clearInterval(timerInterval)

  if (!option.correct) {
    shaking.value = true
    setTimeout(() => shaking.value = false, 500)
  }

  emit('answer', {
    isCorrect: option.correct,
    responseTime,
    answer: option.text
  })
}

function handleTimeout() {
  if (answered.value) return
  answered.value = true
  isCorrect.value = false
  clearInterval(timerInterval)

  emit('answer', {
    isCorrect: false,
    responseTime: totalTime,
    answer: ''
  })
}

function continueGame() {
  emit('close')
}
</script>

<style scoped lang="scss">
.quiz-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(45, 80, 22, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.quiz-modal {
  background: linear-gradient(180deg, #e8d5a3 0%, #d4a76a 100%);
  border: 4px solid #8b6914;
  border-radius: 8px;
  width: 500px;
  max-width: 95%;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 6px 0 #5b3a1a, 0 10px 30px rgba(0, 0, 0, 0.5);

  &.shake {
    animation: shake 0.5s ease;
  }
}

/* shake 动画 */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

.timer-bar {
  height: 6px;
  background: #5b3a1a;

  .timer-fill {
    height: 100%;
    background: #5b8c3e;
    transition: width 0.1s linear;

    &.danger {
      background: #d45b3e;
    }
  }
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 2px solid rgba(139, 105, 20, 0.3);
}

.difficulty-badge {
  background: rgba(91, 140, 62, 0.2);
  color: #3a6b1e;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  border: 1px solid #5b8c3e;
}

.timer-text {
  color: #8b6914;
  font-size: 14px;
  font-weight: bold;
}

.word-display {
  text-align: center;
  padding: 10px 20px 20px;
}

.word-text {
  font-size: 34px;
  font-family: 'Press Start 2P', serif;
  color: #5b3a1a;
  margin-bottom: 6px;
  text-shadow: 0 2px 0 rgba(255, 255, 255, 0.3);
}

.phonetic {
  color: #8b6914;
  font-size: 14px;
}

.quiz-prompt {
  text-align: center;
  color: #8b6914;
  font-size: 14px;
  margin-bottom: 16px;
  font-weight: bold;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 20px 20px;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.4);
  border: 2px solid #8b6914;
  border-radius: 4px;
  color: #5b3a1a;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;

  &:hover:not(.disabled) {
    background: rgba(91, 140, 62, 0.2);
    border-color: #5b8c3e;
    transform: translateX(4px);
  }

  &.correct {
    background: rgba(91, 140, 62, 0.3);
    border-color: #5b8c3e;
    color: #2d5016;
  }

  &.wrong {
    background: rgba(212, 91, 62, 0.2);
    border-color: #d45b3e;
    color: #d45b3e;
  }

  &.disabled {
    cursor: default;
  }
}

.option-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: #8b6914;
  color: #f5edd6;
  font-weight: bold;
  font-size: 13px;
  flex-shrink: 0;
}

.result-feedback {
  padding: 16px 20px 20px;
  text-align: center;
  border-top: 2px solid #8b6914;
  background: rgba(255, 255, 255, 0.15);

  &.correct .result-icon { color: #2d5016; }
  &.wrong .result-icon { color: #d45b3e; }
}

.result-icon {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
}

.correct-answer {
  color: #5b8c3e;
  font-size: 14px;
  margin-bottom: 6px;
  font-weight: bold;
}

.example-sentence {
  color: #8b6914;
  font-size: 13px;
  font-style: italic;
  margin-bottom: 12px;
}

.continue-btn {
  padding: 8px 30px;
  font-size: 15px;
}
</style>
