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
        <span class="question-type-badge">{{ questionTypeLabel }}</span>
        <span class="timer-text">⏱ {{ Math.ceil(remainingTime / 1000) }}s</span>
      </div>

      <!-- 单词/释义展示区 -->
      <div class="word-display">
        <!-- choice_en2cn / spell_hint: 显示英文单词 -->
        <template v-if="['choice_en2cn', 'spell_hint'].includes(questionType)">
          <h2 class="word-text">{{ wordData?.word }}</h2>
          <p class="phonetic" v-if="wordData?.phonetic">{{ wordData.phonetic }}</p>
        </template>
        <!-- choice_cn2en / spell_full / translate: 显示中文释义 -->
        <template v-else>
          <h2 class="word-text meaning-text">{{ wordData?.meaning }}</h2>
        </template>
      </div>

      <!-- 题目提示 -->
      <p class="quiz-prompt">{{ promptText }}</p>

      <!-- 选择题模式 -->
      <div class="options-grid" v-if="isChoiceType">
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

      <!-- 拼写/翻译输入模式 -->
      <div class="input-area" v-else>
        <p class="spell-hint" v-if="questionType === 'spell_hint'">
          💡 提示：{{ hintText }}
        </p>
        <div class="input-row">
          <input ref="spellInput" v-model="typedAnswer"
            @keyup.enter="submitTypedAnswer" @input="onSpellInput" :disabled="answered"
            placeholder="输入英文单词..." class="spell-input" autofocus />
          <button class="btn btn-primary submit-btn" @click="submitTypedAnswer"
            :disabled="answered || !typedAnswer.trim()">确认</button>
        </div>
        <!-- 输入题答错后显示正确拼写 -->
        <p v-if="answered && !isCorrect" class="correct-spelling">
          正确拼写：<strong>{{ wordData?.word }}</strong>
        </p>
      </div>

      <!-- 结果反馈 -->
      <div v-if="answered" class="result-feedback" :class="isCorrect ? 'correct' : 'wrong'">
        <p class="result-icon">{{ isCorrect ? '✅ 回答正确！' : '❌ 回答错误' }}</p>
        <p v-if="!isCorrect && isChoiceType" class="correct-answer">正确答案：{{ questionType === 'choice_cn2en' ? wordData?.word : wordData?.meaning }}</p>

        <!-- 例句区块 -->
        <div v-if="wordData?.example" class="example-block">
          <div class="example-label">📖 例句</div>
          <p class="example-en">{{ wordData.example }}</p>
          <p v-if="wordData?.exampleTranslation" class="example-cn">{{ wordData.exampleTranslation }}</p>
        </div>

        <button class="btn btn-primary continue-btn" @click="continueGame">
          {{ isCorrect ? '🌿 继续战斗' : '📝 知道了' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { compareSpelling } from '@/utils/helpers'

const props = defineProps({
  wordData: { type: Object, required: true, validator: (v) => v && v.word && v.meaning },
  difficulty: { type: Number, default: 1, validator: (v) => v >= 1 && v <= 10 },
  timeLimit: { type: Number, default: 30000, validator: (v) => v >= 5000 && v <= 120000 },
  questionType: { type: String, default: 'choice_en2cn', validator: (v) => ['choice_en2cn','choice_cn2en','spell_hint','spell_full','translate'].includes(v) }
})

const emit = defineEmits(['answer', 'close'])

const answered = ref(false)
const isCorrect = ref(false)
const selectedIndex = ref(-1)
const shaking = ref(false)
const startTime = ref(Date.now())
const typedAnswer = ref('')
const spellInput = ref(null)

// 计算属性
const isChoiceType = computed(() =>
  ['choice_en2cn', 'choice_cn2en'].includes(props.questionType))

const promptText = computed(() => ({
  choice_en2cn: '请选择正确的中文释义：',
  choice_cn2en: '请选择正确的英文单词：',
  spell_hint:   '请根据提示拼写单词：',
  spell_full:   '请拼写对应的英文单词：',
  translate:    '请输入对应的英文翻译：'
}[props.questionType] || '请选择正确的中文释义：'))

const questionTypeLabel = computed(() => ({
  choice_en2cn: '英→中',
  choice_cn2en: '中→英',
  spell_hint:   '提示拼写',
  spell_full:   '完整拼写',
  translate:    '翻译'
}[props.questionType] || '选择'))

const hintText = computed(() => {
  const w = props.wordData?.word || ''
  if (w.length <= 1) return w
  return w[0] + '_'.repeat(w.length - 1) + ` (${w.length}个字母)`
})

// 倒计时
const totalTime = props.timeLimit
const remainingTime = ref(totalTime)
let timerInterval = null

const timerPercent = computed(() => (remainingTime.value / totalTime) * 100)

// 选项已在 GameView buildQuizData 中 shuffle 过
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

  // 拼写题自动聚焦
  if (!isChoiceType.value) {
    nextTick(() => spellInput.value?.focus())
  }
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

function onSpellInput(e) {
  // Only allow letters, hyphens, spaces, apostrophes
  typedAnswer.value = e.target.value.replace(/[^a-zA-Z\s'-]/g, '')
}

function submitTypedAnswer() {
  if (answered.value || !typedAnswer.value.trim()) return
  answered.value = true
  isCorrect.value = compareSpelling(typedAnswer.value, props.wordData?.word)
  const responseTime = Date.now() - startTime.value
  clearInterval(timerInterval)

  if (!isCorrect.value) {
    shaking.value = true
    setTimeout(() => shaking.value = false, 500)
  }

  emit('answer', {
    isCorrect: isCorrect.value,
    responseTime,
    answer: typedAnswer.value.trim()
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

.question-type-badge {
  background: rgba(139, 105, 20, 0.15);
  color: #8b6914;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  border: 1px solid #8b6914;
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

.meaning-text {
  font-family: 'Microsoft YaHei', sans-serif;
  font-size: 28px;
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

/* 拼写/翻译输入区 */
.input-area {
  padding: 0 20px 20px;
}

.spell-hint {
  text-align: center;
  color: #5b8c3e;
  font-size: 16px;
  margin-bottom: 12px;
  font-weight: bold;
  letter-spacing: 2px;
}

.input-row {
  display: flex;
  gap: 10px;
}

.spell-input {
  flex: 1;
  padding: 14px 16px;
  font-size: 18px;
  border: 2px solid #8b6914;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.4);
  color: #5b3a1a;

  &:focus {
    border-color: #5b8c3e;
    outline: none;
  }
}

.submit-btn {
  padding: 14px 24px;
  font-size: 15px;
}

.correct-spelling {
  text-align: center;
  color: #5b8c3e;
  font-size: 15px;
  margin-top: 12px;

  strong {
    letter-spacing: 1px;
  }
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

.example-block {
  background: rgba(139, 105, 20, 0.1);
  border: 2px solid rgba(139, 105, 20, 0.25);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 10px 0 14px;
  text-align: left;
}

.example-label {
  font-size: 12px;
  font-weight: bold;
  color: #8b6914;
  margin-bottom: 6px;
}

.example-en {
  font-size: 16px;
  color: #5b3a1a;
  font-style: italic;
  line-height: 1.6;
  margin-bottom: 4px;
}

.example-cn {
  font-size: 14px;
  color: #8b6914;
  line-height: 1.5;
}

.continue-btn {
  padding: 8px 30px;
  font-size: 15px;
}
</style>
