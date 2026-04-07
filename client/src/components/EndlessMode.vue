<template>
  <div class="endless-overlay">
    <div class="endless-panel card">
      <!-- Header -->
      <div class="endless-header">
        <div class="endless-title">
          <span class="endless-icon">♾️</span>
          <h2>无尽模式</h2>
        </div>
        <button class="close-btn" @click="handleClose">✕</button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <p>正在加载全部词库...</p>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="errorMsg" class="loading-state">
        <p class="error-text">{{ errorMsg }}</p>
        <button class="btn btn-primary" @click="loadAllWords">🔄 重试</button>
      </div>

      <!-- 尚未开始 -->
      <div v-else-if="!started && !gameOver" class="start-screen">
        <p class="start-desc">挑战无尽词汇！看你能连续答对多少题。</p>
        <p class="start-desc">难度会随答对数逐渐提升。</p>
        <div class="best-record" v-if="bestStreak > 0">
          🏆 历史最佳：连续 {{ bestStreak }} 题
        </div>
        <button class="btn btn-primary start-btn" @click="startGame">⚔️ 开始挑战</button>
      </div>

      <!-- 游戏进行中 -->
      <div v-else-if="started && !gameOver" class="game-area">
        <div class="stats-bar">
          <span>🔥 连续答对：{{ currentStreak }}</span>
          <span>💰 得分：{{ score }}</span>
          <span>❤️ {{ lives }}</span>
          <span class="difficulty-indicator">难度 Lv.{{ currentDiffLevel }}</span>
        </div>

        <!-- 倒计时 -->
        <div class="timer-bar">
          <div class="timer-fill" :style="{ width: timerPercent + '%' }" :class="{ danger: timerPercent < 20 }"></div>
        </div>

        <div class="word-display" v-if="currentWord">
          <template v-if="isChoiceMode">
            <h3 class="word-text">{{ currentWord.word }}</h3>
            <p class="phonetic" v-if="currentWord.phonetic">{{ currentWord.phonetic }}</p>
            <p class="quiz-prompt">请选择正确的中文释义：</p>
          </template>
          <template v-else>
            <h3 class="word-text meaning-text">{{ currentWord.meaning }}</h3>
            <p class="quiz-prompt">请输入对应的英文单词：</p>
          </template>
        </div>

        <!-- 选择题 -->
        <div class="options-grid" v-if="isChoiceMode">
          <button
            v-for="(option, i) in currentOptions"
            :key="i"
            class="option-btn"
            :class="{ correct: answered && option.correct, wrong: answered && selectedIndex === i && !option.correct, disabled: answered }"
            @click="selectAnswer(i, option)"
            :disabled="answered"
          >
            <span class="option-letter">{{ ['A','B','C','D'][i] }}</span>
            <span>{{ option.text }}</span>
          </button>
        </div>

        <!-- 拼写 -->
        <div class="input-area" v-else>
          <div class="input-row">
            <input ref="spellInput" v-model="typedAnswer"
              @keyup.enter="submitTyped" :disabled="answered"
              placeholder="输入英文单词..." class="spell-input" autofocus />
            <button class="btn btn-primary" @click="submitTyped"
              :disabled="answered || !typedAnswer.trim()">确认</button>
          </div>
          <p v-if="answered && !isCorrect" class="correct-spelling">
            正确拼写：<strong>{{ currentWord?.word }}</strong>
          </p>
        </div>

        <!-- 反馈 -->
        <div v-if="answered" class="feedback" :class="isCorrect ? 'correct' : 'wrong'">
          <p>{{ isCorrect ? '✅ 正确！' : '❌ 错误' }}</p>
          <button class="btn btn-primary" @click="nextQuestion">继续</button>
        </div>
      </div>

      <!-- Game Over -->
      <div v-else class="game-over-screen">
        <h3>💀 挑战结束</h3>
        <div class="final-stats">
          <div class="stat">
            <span class="stat-value">{{ currentStreak }}</span>
            <span class="stat-label">最高连续</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ totalAnswered }}</span>
            <span class="stat-label">总答题</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ score }}</span>
            <span class="stat-label">总分</span>
          </div>
        </div>
        <div v-if="currentStreak > bestStreak" class="new-record">🎉 新纪录！</div>
        <div class="game-over-actions">
          <button class="btn btn-primary" @click="restartGame">🔄 再来一次</button>
          <button class="btn btn-gold" @click="handleClose">返回</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { getChapterWords } from '@/api/vocabulary'
import { ENDLESS_CONFIG, STORAGE_KEYS } from '@/game/config/gameConstants'
import { shuffle, buildChoiceOptions, compareSpelling, safeGetItem, safeSetItem } from '@/utils/helpers'
import levelsData from '@/game/data/levels.json'

const emit = defineEmits(['close'])

const loading = ref(true)
const allWords = ref([])
const started = ref(false)
const gameOver = ref(false)
const currentWord = ref(null)
const currentOptions = ref([])
const answered = ref(false)
const isCorrect = ref(false)
const selectedIndex = ref(-1)
const typedAnswer = ref('')
const spellInput = ref(null)

const currentStreak = ref(0)
const maxStreak = ref(0)
const score = ref(0)
const lives = ref(3)
const totalAnswered = ref(0)
const bestStreak = ref(parseInt(safeGetItem(STORAGE_KEYS.endlessBest, '0')) || 0)

// Timer
const questionStart = ref(Date.now())
const remainingTime = ref(30000)
let timerInterval = null

const timerPercent = computed(() => (remainingTime.value / getTimeLimit()) * 100)

// 难度随连续答对数提升
const currentDiffLevel = computed(() => {
  const thresholds = [...ENDLESS_CONFIG.difficultyThresholds].reverse()
  for (const t of thresholds) {
    if (currentStreak.value >= t.streak) return t.level
  }
  return 1
})

const isChoiceMode = computed(() => currentDiffLevel.value <= ENDLESS_CONFIG.choiceModeMaxLevel)

function getTimeLimit() {
  return Math.max(ENDLESS_CONFIG.minTimeLimit, ENDLESS_CONFIG.baseTimeLimit - currentDiffLevel.value * ENDLESS_CONFIG.timeLimitReductionPerLevel)
}

const errorMsg = ref('')

async function loadAllWords() {
  loading.value = true
  errorMsg.value = ''
  const words = []
  const totalChapters = levelsData.chapters.length
  for (let ch = 1; ch <= totalChapters; ch++) {
    try {
      const res = await getChapterWords(ch)
      if (res.data) words.push(...res.data)
    } catch (e) {
      // skip
    }
  }
  allWords.value = words
  if (allWords.value.length === 0) {
    errorMsg.value = '词库加载失败，请检查网络连接'
  }
  loading.value = false
}

let wordPool = []
let poolIndex = 0

function getNextWord() {
  if (poolIndex >= wordPool.length) {
    wordPool = shuffle([...allWords.value])
    poolIndex = 0
  }
  const w = wordPool[poolIndex]
  poolIndex++
  return w
}

function startGame() {
  started.value = true
  gameOver.value = false
  currentStreak.value = 0
  maxStreak.value = 0
  score.value = 0
  lives.value = 3
  totalAnswered.value = 0
  wordPool = shuffle([...allWords.value])
  poolIndex = 0
  loadNextQuestion()
}

function restartGame() {
  gameOver.value = false
  startGame()
}

function loadNextQuestion() {
  answered.value = false
  selectedIndex.value = -1
  isCorrect.value = false
  typedAnswer.value = ''

  const word = getNextWord()
  if (!word) return
  currentWord.value = word

  if (isChoiceMode.value) {
    // 选择题
    const others = allWords.value.filter(w => w.word !== word.word && w.meaning !== word.meaning)
    currentOptions.value = buildChoiceOptions('correct', word.meaning, others, 'meaning')
  } else {
    currentOptions.value = []
    nextTick(() => spellInput.value?.focus())
  }

  startTimer()
}

function startTimer() {
  const limit = getTimeLimit()
  questionStart.value = Date.now()
  remainingTime.value = limit
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    remainingTime.value = Math.max(0, limit - (Date.now() - questionStart.value))
    if (remainingTime.value <= 0) handleTimeout()
  }, 100)
}

function selectAnswer(i, option) {
  if (answered.value) return
  selectedIndex.value = i
  processAnswer(option.correct)
}

function submitTyped() {
  if (answered.value || !typedAnswer.value.trim()) return
  const correct = compareSpelling(typedAnswer.value, currentWord.value?.word)
  processAnswer(correct)
}

function processAnswer(correct) {
  answered.value = true
  isCorrect.value = correct
  totalAnswered.value++
  if (timerInterval) clearInterval(timerInterval)

  if (correct) {
    currentStreak.value++
    if (currentStreak.value > maxStreak.value) maxStreak.value = currentStreak.value
    score.value += 100 * currentDiffLevel.value
  } else {
    currentStreak.value = 0
    lives.value--
    if (lives.value <= 0) {
      endGame()
    }
  }
}

function handleTimeout() {
  if (answered.value) return
  processAnswer(false)
}

function nextQuestion() {
  if (gameOver.value) return
  loadNextQuestion()
}

function endGame() {
  gameOver.value = true
  started.value = false
  if (timerInterval) clearInterval(timerInterval)
  // Save best
  if (maxStreak.value > bestStreak.value) {
    bestStreak.value = maxStreak.value
    safeSetItem(STORAGE_KEYS.endlessBest, String(maxStreak.value))
  }
}

function handleClose() {
  if (timerInterval) clearInterval(timerInterval)
  emit('close')
}

onMounted(() => {
  loadAllWords()
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<style scoped lang="scss">
.endless-overlay {
  position: fixed;
  inset: 0;
  background: rgba(30, 20, 50, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}

.endless-panel {
  width: 520px;
  max-width: 95%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 0;
}

.endless-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 2px solid rgba(139, 105, 20, 0.3);
}

.endless-title {
  display: flex;
  align-items: center;
  gap: 8px;

  .endless-icon { font-size: 24px; }
  h2 { color: #5b3a1a; font-size: 20px; margin: 0; }
}

.close-btn {
  background: #d45b3e;
  border: 2px solid #a04030;
  color: #f5edd6;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover { background: #e06b4e; }
}

.loading-state, .start-screen {
  padding: 30px 20px;
  text-align: center;
  color: #5b3a1a;
}

.error-text {
  color: #d45b3e;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 12px;
}

.start-desc {
  color: #8b6914;
  margin-bottom: 8px;
}

.best-record {
  color: #ffc847;
  font-weight: bold;
  font-size: 18px;
  margin: 16px 0;
}

.start-btn {
  font-size: 18px;
  padding: 12px 40px;
}

.game-area {
  padding: 12px 20px;
}

.stats-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #5b3a1a;
  margin-bottom: 8px;
}

.difficulty-indicator {
  background: rgba(139, 105, 20, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  color: #8b6914;
}

.timer-bar {
  height: 6px;
  background: #5b3a1a;
  border-radius: 3px;
  margin-bottom: 12px;
  overflow: hidden;

  .timer-fill {
    height: 100%;
    background: #5b8c3e;
    transition: width 0.1s linear;
    &.danger { background: #d45b3e; }
  }
}

.word-display {
  text-align: center;
  padding: 12px 0 16px;
}

.word-text {
  font-size: 28px;
  font-family: 'Press Start 2P', serif;
  color: #5b3a1a;
  margin-bottom: 4px;
}

.meaning-text {
  font-family: 'Microsoft YaHei', sans-serif;
  font-size: 24px;
}

.phonetic {
  color: #8b6914;
  font-size: 13px;
  margin-bottom: 4px;
}

.quiz-prompt {
  color: #8b6914;
  font-size: 14px;
  font-weight: bold;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.4);
  border: 2px solid #8b6914;
  border-radius: 4px;
  color: #5b3a1a;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(.disabled) { background: rgba(91, 140, 62, 0.2); border-color: #5b8c3e; }
  &.correct { background: rgba(91, 140, 62, 0.3); border-color: #5b8c3e; }
  &.wrong { background: rgba(212, 91, 62, 0.2); border-color: #d45b3e; }
  &.disabled { cursor: default; }
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

.input-area {
  margin-bottom: 12px;
}

.input-row {
  display: flex;
  gap: 10px;
}

.spell-input {
  flex: 1;
  padding: 12px 16px;
  font-size: 18px;
  border: 2px solid #8b6914;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.4);
  color: #5b3a1a;
  &:focus { border-color: #5b8c3e; outline: none; }
}

.correct-spelling {
  text-align: center;
  color: #5b8c3e;
  margin-top: 8px;
  strong { letter-spacing: 1px; }
}

.feedback {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  &.correct { background: rgba(91, 140, 62, 0.15); color: #2d5016; }
  &.wrong { background: rgba(212, 91, 62, 0.15); color: #d45b3e; }
}

.game-over-screen {
  padding: 30px 20px;
  text-align: center;

  h3 { font-size: 24px; color: #5b3a1a; margin-bottom: 20px; }
}

.final-stats {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 16px;
}

.stat {
  text-align: center;
  .stat-value { display: block; font-size: 28px; font-weight: bold; color: #5b8c3e; }
  .stat-label { display: block; font-size: 12px; color: #8b6914; }
}

.new-record {
  color: #ffc847;
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 16px;
}

.game-over-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
