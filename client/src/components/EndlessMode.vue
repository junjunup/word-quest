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

      <!-- 加载中 - 带进度条和章节状态 -->
      <div v-if="loading" class="loading-state">
        <div class="loading-title">正在加载词库...</div>
        <div class="loading-progress-bar">
          <div class="loading-progress-fill" :style="{ width: loadProgress + '%' }"></div>
        </div>
        <div class="loading-percent">{{ loadProgress }}%</div>
        <div class="loading-chapters">
          <div
            v-for="ch in chapterLoadStatus"
            :key="ch.id"
            class="chapter-load-item"
            :class="{ done: ch.status === 'done', fail: ch.status === 'fail', pending: ch.status === 'pending', loading: ch.status === 'loading' }"
          >
            <span class="chapter-load-icon">
              {{ ch.status === 'done' ? '✅' : ch.status === 'fail' ? '❌' : ch.status === 'loading' ? '⏳' : '⬜' }}
            </span>
            <span class="chapter-load-name">第{{ ch.id }}章</span>
            <span class="chapter-load-count" v-if="ch.status === 'done'">{{ ch.count }}词</span>
          </div>
        </div>
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
        <div class="word-count-info">📚 已加载 {{ allWords.length }} 个词汇</div>
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

          <!-- 例句区块 -->
          <div v-if="currentWord?.example" class="example-block">
            <div class="example-label">📖 例句</div>
            <p class="example-en">{{ currentWord.example }}</p>
            <p v-if="currentWord?.exampleTranslation" class="example-cn">{{ currentWord.exampleTranslation }}</p>
          </div>

          <button class="btn btn-primary" @click="nextQuestion">继续</button>
        </div>
      </div>

      <!-- Game Over -->
      <div v-else class="game-over-screen">
        <h3>💀 挑战结束</h3>
        <div class="final-stats">
          <div class="stat">
            <span class="stat-value">{{ maxStreak }}</span>
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
        <div v-if="isNewRecord" class="new-record">🎉 新纪录！</div>
        <div class="game-over-actions">
          <button class="btn btn-primary" @click="restartGame">🔄 再来一次</button>
          <button class="btn btn-gold" @click="handleClose">返回</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
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
const isNewRecord = ref(false)

// 加载进度追踪
const loadProgress = ref(0)
const chapterLoadStatus = reactive(
  levelsData.chapters.map(ch => ({ id: ch.id, status: 'pending', count: 0 }))
)

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

/**
 * 带超时控制的单个请求
 */
function fetchWithTimeout(promise, timeoutMs = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('请求超时')), timeoutMs)
    )
  ])
}

/**
 * 逐章并行加载词汇，实时更新进度条和状态
 */
async function loadAllWords() {
  loading.value = true
  errorMsg.value = ''
  loadProgress.value = 0

  const totalChapters = levelsData.chapters.length

  // 重置章节状态
  for (let i = 0; i < chapterLoadStatus.length; i++) {
    chapterLoadStatus[i].status = 'pending'
    chapterLoadStatus[i].count = 0
  }

  const words = []
  let completedCount = 0
  let failCount = 0

  // 全部章节标记为 loading
  for (const ch of chapterLoadStatus) {
    ch.status = 'loading'
  }

  // 并行请求所有章节，每个完成后立即更新进度
  const promises = chapterLoadStatus.map(async (ch, index) => {
    try {
      const res = await fetchWithTimeout(getChapterWords(ch.id))
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        words.push(...res.data)
        ch.status = 'done'
        ch.count = res.data.length
      } else {
        ch.status = 'fail'
        failCount++
        console.warn(`无尽模式：第${ch.id}章返回空数据`)
      }
    } catch (e) {
      ch.status = 'fail'
      failCount++
      console.warn(`无尽模式：第${ch.id}章加载失败`, e?.message || e)
    } finally {
      completedCount++
      loadProgress.value = Math.round((completedCount / totalChapters) * 100)
    }
  })

  await Promise.all(promises)

  allWords.value = words

  if (allWords.value.length === 0) {
    if (failCount === totalChapters) {
      errorMsg.value = '所有章节词库加载失败，请检查：\n1. 后端服务器是否已启动\n2. 网络连接是否正常\n3. 登录是否已过期'
    } else {
      errorMsg.value = '词库为空，请确认数据库中已导入词汇（运行 npm run seed）'
    }
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
  isNewRecord.value = false
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
  // 先判断是否破纪录，再更新 bestStreak
  isNewRecord.value = maxStreak.value > bestStreak.value
  if (isNewRecord.value) {
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

/* 加载进度条 */
.loading-title {
  font-size: 16px;
  font-weight: bold;
  color: #5b3a1a;
  margin-bottom: 16px;
}

.loading-progress-bar {
  width: 100%;
  height: 20px;
  background: rgba(91, 58, 26, 0.2);
  border: 2px solid #8b6914;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 8px;
}

.loading-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #5b8c3e, #7eb55e);
  border-radius: 8px;
  transition: width 0.3s ease;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.2) 50%,
      transparent 100%
    );
    animation: shimmer 1.5s infinite;
  }
}

@keyframes shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

.loading-percent {
  font-size: 14px;
  color: #8b6914;
  font-weight: bold;
  margin-bottom: 16px;
}

.loading-chapters {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  text-align: left;
}

.chapter-load-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  background: rgba(139, 105, 20, 0.08);
  border: 1px solid rgba(139, 105, 20, 0.15);
  transition: all 0.3s ease;

  &.done {
    background: rgba(91, 140, 62, 0.15);
    border-color: rgba(91, 140, 62, 0.3);
  }
  &.fail {
    background: rgba(212, 91, 62, 0.12);
    border-color: rgba(212, 91, 62, 0.3);
  }
  &.loading {
    border-color: rgba(232, 163, 60, 0.4);

    .chapter-load-icon {
      animation: pulse-icon 1s infinite;
    }
  }
}

@keyframes pulse-icon {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.chapter-load-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.chapter-load-name {
  color: #5b3a1a;
  font-weight: bold;
}

.chapter-load-count {
  color: #5b8c3e;
  font-size: 11px;
  margin-left: auto;
}

.word-count-info {
  color: #5b8c3e;
  font-size: 14px;
  margin: 8px 0;
  font-weight: bold;
}

.error-text {
  color: #d45b3e;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 12px;
  white-space: pre-line;
  line-height: 1.8;
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
