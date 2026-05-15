<template>
  <div class="review-mode-overlay">
    <div class="review-panel card">
      <!-- 标题 -->
      <div class="review-header">
        <h2>{{ mode === 'today' ? '📚 今日复习' : '📝 错词复习' }}</h2>
        <button class="close-btn" @click="$emit('close')" aria-label="关闭复习面板">✕</button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <p>正在加载{{ mode === 'today' ? '今日复习' : '错词' }}列表...</p>
      </div>

      <!-- 无错词 -->
      <div v-else-if="words.length === 0 && !errorMsg" class="empty-state">
        <p class="empty-icon">🎉</p>
        <p>{{ mode === 'today' ? '太棒了！今天没有高优先级复习任务。' : '太棒了！你没有需要复习的错词。' }}</p>
        <button class="btn btn-primary" @click="$emit('close')">返回</button>
      </div>

      <!-- 错误提示 -->
      <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

      <!-- 复习进行中 -->
      <div v-else-if="!reviewComplete" class="review-content">
        <div class="review-progress">
          <span>进度：{{ currentIndex + 1 }} / {{ words.length }}</span>
          <span>正确：{{ correctCount }} / {{ answeredCount }}</span>
        </div>

        <div class="word-card">
          <!-- 显示英文单词 -->
          <h3 class="review-word">{{ currentWord.word }}</h3>
          <p class="review-phonetic" v-if="currentWord.phonetic">{{ currentWord.phonetic }}</p>
          <button class="tts-btn" type="button" @click="playCurrentWord" :disabled="!speechSupported">🔊 朗读</button>
          <p class="review-mistake-info" v-if="currentWord.wrongCount !== undefined">
            ❌ 错误 {{ currentWord.wrongCount }} 次
          </p>
          <div v-if="currentWord.reasons?.length" class="reason-list">
            <span v-for="reason in currentWord.reasons" :key="reason" class="reason-chip">{{ reasonLabel(reason) }}</span>
          </div>
          <div v-if="currentWord.masteryScore !== undefined" class="mastery-block">
            <div class="mastery-text">
              <span>掌握度</span>
              <strong>{{ normalizeMastery(currentWord.masteryScore) }}%</strong>
            </div>
            <div class="mastery-bar"><div :style="{ width: normalizeMastery(currentWord.masteryScore) + '%' }"></div></div>
          </div>
        </div>

        <!-- 选择题 -->
        <div class="review-options">
          <button
            v-for="(option, i) in currentOptions"
            :key="i"
            class="option-btn"
            :class="{
              correct: answered && option.correct,
              wrong: answered && selectedIndex === i && !option.correct,
              disabled: answered
            }"
            @click="selectAnswer(i, option)"
            :disabled="answered"
          >
            <span class="option-letter">{{ ['A','B','C','D'][i] }}</span>
            <span>{{ option.text }}</span>
          </button>
        </div>

        <!-- 答案反馈 -->
        <div v-if="answered" class="answer-feedback" :class="isCorrect ? 'correct' : 'wrong'">
          <p>{{ isCorrect ? '✅ 正确！' : '❌ 错误' }}</p>
          <p v-if="!isCorrect" class="correct-answer-text">
            正确答案：<strong>{{ currentWord.meaning }}</strong>
          </p>

          <!-- 例句区块 -->
          <div v-if="currentWord.example" class="example-block">
            <div class="example-label">📖 例句</div>
            <p class="example-en">{{ currentWord.example }}</p>
            <p v-if="currentWord.exampleTranslation" class="example-cn">{{ currentWord.exampleTranslation }}</p>
            <button class="tts-btn small" type="button" @click="playCurrentExample" :disabled="!speechSupported">🔊 朗读例句</button>
          </div>

          <button class="btn btn-primary" @click="nextWord" :disabled="submitting">
            {{ submitting ? '正在写入掌握度...' : (currentIndex < words.length - 1 ? '下一题' : '查看结果') }}
          </button>
        </div>
      </div>

      <!-- 复习完成 -->
      <div v-else class="review-complete">
        <h3>🏆 复习完成！</h3>
        <div class="result-stats">
          <div class="stat">
            <span class="stat-value">{{ words.length }}</span>
            <span class="stat-label">复习单词</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ correctCount }}</span>
            <span class="stat-label">答对</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ Math.round((correctCount / words.length) * 100) }}%</span>
            <span class="stat-label">正确率</span>
          </div>
          <div class="stat" v-if="submissionResult">
            <span class="stat-value">{{ submissionResult.masteryUpdated || 0 }}</span>
            <span class="stat-label">已写入掌握度</span>
          </div>
        </div>
        <p v-if="submissionResult?.results?.[0]?.nextReviewAt" class="mastery-saved-text">
          下次复习：{{ new Date(submissionResult.results[0].nextReviewAt).toLocaleString() }}
        </p>
        <div class="result-actions">
          <button class="btn btn-primary" @click="resetReview">🔄 再来一次</button>
          <button class="btn btn-gold" @click="$emit('close')">✅ 完成</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getTopMistakes, getTodayReview, createReviewSession, submitReviewSession } from '@/api/learning'
import { buildChoiceOptions } from '@/utils/helpers'
import { canSpeak, speakText } from '@/utils/speech'

const props = defineProps({
  mode: { type: String, default: 'mistakes' },
  initialWords: { type: Array, default: () => [] }
})

const emit = defineEmits(['close'])

const loading = ref(true)
const words = ref([])
const currentIndex = ref(0)
const answered = ref(false)
const isCorrect = ref(false)
const selectedIndex = ref(-1)
const correctCount = ref(0)
const answeredCount = ref(0)
const reviewComplete = ref(false)
const currentOptions = ref([])
const errorMsg = ref('')
const reviewSessionId = ref('')
const answerRecords = ref([])
const submitting = ref(false)
const submissionResult = ref(null)
const questionStartedAt = ref(Date.now())
const speechSupported = canSpeak()

const currentWord = computed(() => words.value[currentIndex.value] || {})

async function loadMistakes() {
  loading.value = true
  errorMsg.value = ''
  try {
    let data = props.initialWords?.length ? props.initialWords : []
    if (data.length === 0) {
      try {
        const sessionRes = await createReviewSession({ limit: 20 })
        reviewSessionId.value = sessionRes.data?.sessionId || ''
        data = sessionRes.data?.words || []
      } catch (sessionError) {
        console.warn('创建复习会话失败，回退到旧复习列表:', sessionError)
        const res = props.mode === 'today' ? await getTodayReview(20) : await getTopMistakes(20)
        data = res.data || []
      }
    }
    words.value = normalizeReviewWords(data)
    answerRecords.value = []
    submissionResult.value = null
    questionStartedAt.value = Date.now()
    if (words.value.length > 0) generateOptions()
  } catch (e) {
    console.warn('加载复习列表失败:', e)
    if (props.mode === 'today') {
      try {
        const fallback = await getTopMistakes(20)
        words.value = normalizeReviewWords(fallback.data || [])
        if (words.value.length > 0) generateOptions()
        errorMsg.value = ''
      } catch (fallbackError) {
        console.warn('加载错词兜底失败:', fallbackError)
        errorMsg.value = '加载复习列表失败，请检查网络'
      }
    } else {
      errorMsg.value = '加载错词失败，请检查网络'
    }
  }
  loading.value = false
}

function normalizeReviewWords(items) {
  return items.map(item => ({
    ...item,
    _id: item._id || item.wordId,
    meaning: item.meaning || '暂无释义',
    wrongCount: item.wrongCount,
    reasons: Array.isArray(item.reasons) ? item.reasons : [],
    masteryScore: item.masteryScore
  }))
}

function normalizeMastery(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(Math.round(number), 100))
}

function reasonLabel(reason) {
  const labels = { wrong: '答错', near: '接近正确', low_mastery: '低掌握度', stale: '久未复习' }
  return labels[reason] || reason
}

function generateOptions() {
  const word = words.value[currentIndex.value]
  if (!word) return
  const others = words.value.filter(w => w.word !== word.word)
  currentOptions.value = buildChoiceOptions('correct', word.meaning, others, 'meaning')
}

function selectAnswer(index, option) {
  if (answered.value) return
  selectedIndex.value = index
  answered.value = true
  isCorrect.value = option.correct
  answeredCount.value++
  if (option.correct) correctCount.value++
  answerRecords.value.push({
    wordId: currentWord.value._id || currentWord.value.wordId,
    playerAnswer: option.text,
    correctAnswer: currentWord.value.meaning || '',
    isCorrect: option.correct,
    responseTime: Date.now() - questionStartedAt.value
  })
}

function playCurrentWord() {
  speakText(currentWord.value.word)
}

function playCurrentExample() {
  speakText(currentWord.value.example)
}

async function nextWord() {
  if (currentIndex.value < words.value.length - 1) {
    currentIndex.value++
    answered.value = false
    selectedIndex.value = -1
    isCorrect.value = false
    questionStartedAt.value = Date.now()
    generateOptions()
  } else {
    await submitCurrentSession()
    reviewComplete.value = true
  }
}

async function submitCurrentSession() {
  if (!reviewSessionId.value || submitting.value) return
  submitting.value = true
  try {
    const res = await submitReviewSession(reviewSessionId.value, answerRecords.value)
    submissionResult.value = res.data || null
  } catch (error) {
    console.warn('提交复习会话失败:', error)
    errorMsg.value = '复习结果提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

async function resetReview() {
  currentIndex.value = 0
  answered.value = false
  selectedIndex.value = -1
  correctCount.value = 0
  answeredCount.value = 0
  reviewComplete.value = false
  answerRecords.value = []
  submissionResult.value = null
  reviewSessionId.value = ''
  questionStartedAt.value = Date.now()
  await loadMistakes()  // Reload fresh data from API
}

onMounted(() => {
  loadMistakes()
})
</script>

<style scoped lang="scss">
.review-mode-overlay {
  position: fixed;
  inset: 0;
  background: rgba(45, 80, 22, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}

.review-panel {
  width: 520px;
  max-width: 95%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 0;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 2px solid rgba(139, 105, 20, 0.3);

  h2 {
    color: #5b3a1a;
    font-size: 20px;
    margin: 0;
  }
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

.loading-state, .empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #5b3a1a;

  .empty-icon { font-size: 48px; margin-bottom: 12px; }
}

.error-text {
  text-align: center;
  color: #d45b3e;
  font-size: 14px;
  font-weight: bold;
  padding: 8px 20px;
}

.review-content {
  padding: 16px 20px;
}

.review-progress {
  display: flex;
  justify-content: space-between;
  color: #8b6914;
  font-size: 13px;
  margin-bottom: 16px;
}

.word-card {
  text-align: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  margin-bottom: 16px;
}

.review-word {
  font-size: 28px;
  font-family: 'Press Start 2P', serif;
  color: #5b3a1a;
  margin-bottom: 4px;
}

.review-phonetic {
  color: #8b6914;
  font-size: 14px;
  margin-bottom: 8px;
}

.tts-btn {
  margin: 6px auto 0;
  min-height: 36px;
  border: 1px solid #8b6914;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  color: #5b3a1a;
  padding: 6px 12px;
  cursor: pointer;

  &.small {
    min-height: 32px;
    font-size: 12px;
  }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
}

.review-mistake-info {
  color: #d45b3e;
  font-size: 12px;
}

.reason-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
}

.reason-chip {
  background: rgba(74, 144, 217, 0.16);
  border: 1px solid rgba(74, 144, 217, 0.35);
  border-radius: 999px;
  padding: 3px 8px;
  color: #2d5f93;
  font-size: 12px;
}

.mastery-block {
  margin-top: 10px;
}

.mastery-text {
  display: flex;
  justify-content: space-between;
  color: #5b3a1a;
  font-size: 12px;
  margin-bottom: 4px;
}

.mastery-bar {
  height: 8px;
  border-radius: 999px;
  background: rgba(91, 58, 26, 0.16);
  overflow: hidden;

  div {
    height: 100%;
    background: linear-gradient(90deg, #d45b3e, #e8a33c, #5b8c3e);
  }
}

.review-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
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

  &:hover:not(.disabled) {
    background: rgba(91, 140, 62, 0.2);
    border-color: #5b8c3e;
  }

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

.answer-feedback {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;

  &.correct { background: rgba(91, 140, 62, 0.15); color: #2d5016; }
  &.wrong { background: rgba(212, 91, 62, 0.15); color: #d45b3e; }
}

.correct-answer-text {
  color: #5b8c3e;
  margin: 4px 0;
  strong { font-weight: bold; }
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

.review-complete {
  padding: 30px 20px;
  text-align: center;

  h3 {
    font-size: 22px;
    color: #5b3a1a;
    margin-bottom: 20px;
  }
}

.result-stats {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 24px;
}

.stat {
  text-align: center;

  .stat-value {
    display: block;
    font-size: 28px;
    font-weight: bold;
    color: #5b8c3e;
  }

  .stat-label {
    display: block;
    font-size: 12px;
    color: #8b6914;
  }
}

.result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 430px) {
  .review-panel {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
  }
  .review-header,
  .review-content { padding: 14px; }
  .review-progress,
  .result-actions,
  .result-stats {
    flex-direction: column;
    gap: 8px;
  }
  .option-btn,
  .btn,
  .close-btn { min-height: 44px; }
  .review-word { font-size: 22px; word-break: break-word; }
}
</style>
