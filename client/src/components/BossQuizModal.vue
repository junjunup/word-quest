<template>
  <div class="boss-quiz-overlay">
    <div class="boss-quiz-modal" :class="{ shake: shaking }">
      <!-- Boss Header -->
      <div class="boss-header">
        <div class="boss-info">
          <span class="boss-icon">👹</span>
          <span class="boss-name">{{ bossName }}</span>
        </div>
        <div class="boss-hp-bar">
          <div class="hp-label">HP</div>
          <div class="hp-track">
            <div class="hp-fill" :style="{ width: totalHpPercent + '%' }"></div>
          </div>
          <div class="hp-text">{{ displayCurrentHp }}/{{ displayMaxHp }}</div>
        </div>
        <div class="progress-text">本次答题 {{ correctCount }}/{{ bossHp }}</div>
      </div>

      <!-- Timer bar -->
      <div class="timer-bar">
        <div class="timer-fill" :style="{ width: timerPercent + '%' }" :class="{ danger: timerPercent < 20 }"></div>
      </div>

      <!-- Word display -->
      <div class="word-display" v-if="currentWord">
        <!-- choice_en2cn / spell_hint: 显示英文单词 -->
        <template v-if="['choice_en2cn', 'spell_hint'].includes(questionType)">
          <h2 class="word-text">{{ currentWord.word }}</h2>
          <p class="phonetic" v-if="currentWord.phonetic">{{ currentWord.phonetic }}</p>
        </template>
        <!-- choice_cn2en / spell_full / translate: 显示中文释义 -->
        <template v-else>
          <h2 class="word-text meaning-text">{{ currentWord.meaning }}</h2>
        </template>
      </div>

      <p class="quiz-prompt">{{ promptText }}</p>

      <!-- 选择题模式 -->
      <div class="options-grid" v-if="currentWord && isChoiceType">
        <button
          v-for="(option, index) in currentOptions"
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
      <div class="input-area" v-else-if="currentWord && !isChoiceType">
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
        <p v-if="answered && !isCorrect" class="correct-spelling">
          正确拼写：<strong>{{ currentWord?.word }}</strong>
        </p>
      </div>

      <!-- Result feedback -->
      <div v-if="answered" class="result-feedback" :class="isCorrect ? 'correct' : 'wrong'">
        <p class="result-icon">{{ isCorrect ? '✅ 回答正确！Boss受到伤害！' : '❌ 回答错误，扣一条命！' }}</p>
        <p v-if="!isCorrect && isChoiceType" class="correct-answer">正确答案：{{ currentWord?.meaning }}</p>
        <button class="btn btn-primary continue-btn" @click="nextQuestion">
          {{ bossDefeated ? '👹 Boss已击败！' : '继续战斗 ⚔️' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { getQuizForWord } from '@/api/vocabulary'
import { shuffle, buildChoiceOptions, compareSpelling } from '@/utils/helpers'

const props = defineProps({
  bossName: { type: String, default: '👹 BOSS' },
  bossHp: { type: Number, default: 1 },
  bossCurrentHp: { type: Number, default: 0 },
  bossMaxHp: { type: Number, default: 0 },
  timeLimit: { type: Number, default: 30000 },
  levelWords: { type: Array, default: () => [] },
  questionType: { type: String, default: 'choice_en2cn', validator: (v) => ['choice_en2cn','choice_cn2en','spell_hint','spell_full','translate'].includes(v) }
})

const emit = defineEmits(['complete', 'close'])

const correctCount = ref(0)
const totalAnswered = ref(0)
const currentHp = ref(props.bossHp)
const currentWord = ref(null)
const currentOptions = ref([])
const answered = ref(false)
const isCorrect = ref(false)
const selectedIndex = ref(-1)
const shaking = ref(false)
const bossDefeated = ref(false)
const wrongCount = ref(0)
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

const hintText = computed(() => {
  const w = currentWord.value?.word || ''
  if (w.length <= 1) return w
  return w[0] + '_'.repeat(w.length - 1) + ` (${w.length}个字母)`
})

// Timer
const questionStartTime = ref(Date.now())
const remainingTime = ref(props.timeLimit)
let timerInterval = null

const timerPercent = computed(() => (remainingTime.value / props.timeLimit) * 100)
const hpPercent = computed(() => (currentHp.value / props.bossHp) * 100)
// Total boss HP display (for multi-contact boss fights)
const displayCurrentHp = computed(() => props.bossCurrentHp > 0 ? (props.bossCurrentHp - correctCount.value) : currentHp.value)
const displayMaxHp = computed(() => props.bossMaxHp > 0 ? props.bossMaxHp : props.bossHp)
const totalHpPercent = computed(() => (displayCurrentHp.value / displayMaxHp.value) * 100)

// Word pool for cycling through (shuffled to avoid repetition pattern)
let shuffledWordPool = []
let wordPoolIndex = 0

function getNextWord() {
  if (props.levelWords.length === 0) return null
  // Re-shuffle when pool exhausted
  if (wordPoolIndex >= shuffledWordPool.length) {
    shuffledWordPool = shuffle([...props.levelWords])
    wordPoolIndex = 0
  }
  const word = shuffledWordPool[wordPoolIndex]
  wordPoolIndex++
  return word
}

async function loadQuestion() {
  answered.value = false
  selectedIndex.value = -1
  isCorrect.value = false
  typedAnswer.value = ''

  const word = getNextWord()
  if (!word) {
    emit('complete', { correctCount: correctCount.value, wrongCount: wrongCount.value })
    return
  }

  currentWord.value = word

  // 拼写/翻译题不需要选项
  if (['spell_hint', 'spell_full', 'translate'].includes(props.questionType)) {
    currentOptions.value = []
    startTimer()
    nextTick(() => spellInput.value?.focus())
    return
  }

  // Try API for quiz data
  try {
    if (word._id) {
      const res = await getQuizForWord(word._id)
      if (res.data) {
        const { question, distractors } = res.data
        if (props.questionType === 'choice_cn2en') {
          currentOptions.value = shuffle([
            { text: question.word, correct: true },
            ...distractors.map(d => ({ text: d.word, correct: false }))
          ])
        } else {
          currentOptions.value = shuffle([
            { text: question.meaning, correct: true },
            ...distractors.map(d => ({ text: d.meaning, correct: false }))
          ])
        }
        startTimer()
        return
      }
    }
  } catch (e) {
    // Fallback to local generation
  }

  // Local fallback - use proper distractor generation
  const otherWords = props.levelWords.filter(w => w.word !== word.word && w.meaning !== word.meaning)

  if (props.questionType === 'choice_cn2en') {
    currentOptions.value = buildChoiceOptions('correct', word.word, otherWords, 'word')
  } else {
    currentOptions.value = buildChoiceOptions('correct', word.meaning, otherWords, 'meaning')
  }
  startTimer()
}

function startTimer() {
  questionStartTime.value = Date.now()
  remainingTime.value = props.timeLimit
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    remainingTime.value = Math.max(0, props.timeLimit - (Date.now() - questionStartTime.value))
    if (remainingTime.value <= 0) {
      handleTimeout()
    }
  }, 100)
}

function selectOption(index, option) {
  if (answered.value) return
  selectedIndex.value = index
  answered.value = true
  isCorrect.value = option.correct
  totalAnswered.value++

  if (timerInterval) clearInterval(timerInterval)

  if (option.correct) {
    correctCount.value++
    currentHp.value--
    if (currentHp.value <= 0) {
      bossDefeated.value = true
    }
  } else {
    wrongCount.value++
    shaking.value = true
    setTimeout(() => shaking.value = false, 500)
  }
}

function onSpellInput(e) {
  // Only allow letters, hyphens, spaces, apostrophes
  typedAnswer.value = e.target.value.replace(/[^a-zA-Z\s'-]/g, '')
}

function submitTypedAnswer() {
  if (answered.value || !typedAnswer.value.trim()) return
  answered.value = true
  isCorrect.value = compareSpelling(typedAnswer.value, currentWord.value?.word)
  totalAnswered.value++

  if (timerInterval) clearInterval(timerInterval)

  if (isCorrect.value) {
    correctCount.value++
    currentHp.value--
    if (currentHp.value <= 0) {
      bossDefeated.value = true
    }
  } else {
    wrongCount.value++
    shaking.value = true
    setTimeout(() => shaking.value = false, 500)
  }
}

function handleTimeout() {
  if (answered.value) return
  answered.value = true
  isCorrect.value = false
  totalAnswered.value++
  wrongCount.value++
  if (timerInterval) clearInterval(timerInterval)
}

function nextQuestion() {
  if (bossDefeated.value) {
    emit('complete', { correctCount: correctCount.value, wrongCount: wrongCount.value, defeated: true })
    return
  }
  loadQuestion()
}

onMounted(() => {
  shuffledWordPool = shuffle([...props.levelWords])
  wordPoolIndex = 0
  loadQuestion()
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<style scoped lang="scss">
.boss-quiz-overlay {
  position: fixed;
  inset: 0;
  background: rgba(60, 20, 20, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1500;
  animation: fadeIn 0.3s ease;
}

.boss-quiz-modal {
  background: linear-gradient(180deg, #3a1a1a 0%, #4a2020 100%);
  border: 4px solid #cc4444;
  border-radius: 8px;
  width: 520px;
  max-width: 95%;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(255, 68, 68, 0.3), 0 6px 0 #441111;

  &.shake { animation: shake 0.5s ease; }
}

.boss-header {
  padding: 16px 20px;
  background: rgba(204, 68, 68, 0.15);
  border-bottom: 2px solid rgba(204, 68, 68, 0.3);
}

.boss-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.boss-icon { font-size: 24px; }

.boss-name {
  font-size: 18px;
  font-weight: bold;
  color: #ff6666;
  font-family: 'Press Start 2P', Microsoft YaHei;
}

.boss-hp-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.hp-label {
  color: #ff6666;
  font-weight: bold;
  font-size: 12px;
  width: 24px;
}

.hp-track {
  flex: 1;
  height: 12px;
  background: #333;
  border-radius: 6px;
  border: 1px solid #666;
  overflow: hidden;
}

.hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff4444, #ff6666);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.hp-text {
  color: #ff8888;
  font-size: 12px;
  font-weight: bold;
  min-width: 40px;
  text-align: right;
}

.progress-text {
  color: #ffaa66;
  font-size: 12px;
  text-align: right;
}

.timer-bar {
  height: 6px;
  background: #331111;

  .timer-fill {
    height: 100%;
    background: #cc6633;
    transition: width 0.1s linear;
    &.danger { background: #ff2222; }
  }
}

.word-display {
  text-align: center;
  padding: 16px 20px;
}

.word-text {
  font-size: 32px;
  font-family: 'Press Start 2P', serif;
  color: #ffccaa;
  margin-bottom: 6px;
}

.meaning-text {
  font-family: 'Microsoft YaHei', sans-serif;
  font-size: 26px;
}

.phonetic {
  color: #cc8866;
  font-size: 14px;
}

.quiz-prompt {
  text-align: center;
  color: #cc8866;
  font-size: 14px;
  margin-bottom: 12px;
  font-weight: bold;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 20px 16px;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid #884444;
  border-radius: 4px;
  color: #ffccaa;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(.disabled) {
    background: rgba(255, 100, 100, 0.15);
    border-color: #cc6666;
    transform: translateX(4px);
  }

  &.correct { background: rgba(91, 140, 62, 0.3); border-color: #5b8c3e; color: #aaffaa; }
  &.wrong { background: rgba(255, 50, 50, 0.2); border-color: #ff4444; color: #ff8888; }
  &.disabled { cursor: default; }
}

.option-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: #884444;
  color: #ffccaa;
  font-weight: bold;
  font-size: 13px;
  flex-shrink: 0;
}

/* 拼写/翻译输入区 */
.input-area {
  padding: 0 20px 16px;
}

.spell-hint {
  text-align: center;
  color: #ffaa66;
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
  border: 2px solid #884444;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffccaa;

  &:focus {
    border-color: #cc6666;
    outline: none;
  }
}

.submit-btn {
  padding: 14px 24px;
  font-size: 15px;
  background: #cc4444;
  border-color: #992222;
  &:hover { background: #dd5555; }
}

.correct-spelling {
  text-align: center;
  color: #88ff88;
  font-size: 15px;
  margin-top: 12px;

  strong {
    letter-spacing: 1px;
  }
}

.result-feedback {
  padding: 16px 20px;
  text-align: center;
  border-top: 2px solid #884444;
  background: rgba(255, 255, 255, 0.05);

  &.correct .result-icon { color: #88ff88; }
  &.wrong .result-icon { color: #ff6666; }
}

.result-icon { font-size: 16px; font-weight: bold; margin-bottom: 8px; }
.correct-answer { color: #88ff88; font-size: 14px; margin-bottom: 8px; }

.continue-btn {
  padding: 8px 30px;
  font-size: 14px;
  background: #cc4444;
  border-color: #992222;
  &:hover { background: #dd5555; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
