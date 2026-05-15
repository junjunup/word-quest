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
        <span class="adaptive-badge" v-if="adaptiveDifficultyLabel">🧭 {{ adaptiveDifficultyLabel }}</span>
        <span class="timer-text">⏱ {{ Math.ceil(remainingTime / 1000) }}s</span>
      </div>

      <!-- 单词/释义展示区 -->
      <div class="word-display">
        <!-- choice_en2cn / spell_hint: 显示英文单词 -->
        <template v-if="['choice_en2cn', 'spell_hint'].includes(questionType)">
          <h2 class="word-text">{{ wordData?.word }}</h2>
          <p class="phonetic" v-if="wordData?.phonetic">{{ wordData.phonetic }}</p>
          <div class="speech-actions">
            <button class="tts-btn" type="button" @click="playWord" :disabled="!speechSupported">🔊 朗读单词</button>
            <button class="tts-btn score" type="button" @click="startPronunciationScoring" :disabled="!speechRecognitionSupported || pronunciationLoading">
              {{ pronunciationLoading ? '评分中...' : '🎙️ 发音评分' }}
            </button>
          </div>
          <div v-if="pronunciationResult || pronunciationError" class="pronunciation-panel" :class="pronunciationResult?.grade">
            <template v-if="pronunciationResult">
              <strong>{{ pronunciationResult.score }}分</strong>
              <span>{{ pronunciationGradeLabel }}</span>
              <p>识别：{{ pronunciationResult.transcript }}</p>
              <small>{{ pronunciationResult.details?.feedback?.join('；') }}</small>
            </template>
            <template v-else>{{ pronunciationError }}</template>
          </div>
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
          <button class="voice-btn" type="button" @click="startVoiceInput" :disabled="answered || !speechRecognitionSupported || listening">
            {{ listening ? '听写中...' : '🎙️ 语音' }}
          </button>
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
        <p class="result-icon">{{ resultTitle }}</p>
        <div class="ai-feedback-panel">
          <span class="feedback-pill" :class="answerQuality">{{ answerQualityLabel }}</span>
          <span>得分比例 {{ Math.round(scoreRatio * 100) }}%</span>
          <span v-if="fuzzyFeedback">{{ fuzzyFeedback }}</span>
        </div>
        <p v-if="answerQuality === 'near'" class="near-answer">本题按 {{ Math.round(scoreRatio * 100) }}% 计分，系统会纳入复习队列判断</p>
        <p v-if="!isCorrect && isChoiceType" class="correct-answer">正确答案：{{ questionType === 'choice_cn2en' ? wordData?.word : wordData?.meaning }}</p>

        <!-- 例句区块 -->
        <div v-if="wordData?.example" class="example-block">
          <div class="example-label">📖 例句</div>
          <p class="example-en">{{ wordData.example }}</p>
          <p v-if="wordData?.exampleTranslation" class="example-cn">{{ wordData.exampleTranslation }}</p>
          <button class="tts-btn small" type="button" @click="playExample" :disabled="!speechSupported">🔊 朗读例句</button>
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
import { evaluateSpellingAnswer } from '@/utils/helpers'
import { canRecognizeSpeech, canSpeak, speakText, startSpeechRecognition } from '@/utils/speech'
import { scorePronunciation } from '@/api/pronunciation'

const props = defineProps({
  wordData: { type: Object, required: true, validator: (v) => v && v.word && v.meaning },
  difficulty: { type: Number, default: 1, validator: (v) => v >= 1 && v <= 10 },
  timeLimit: { type: Number, default: 30000, validator: (v) => v >= 5000 && v <= 120000 },
  questionType: { type: String, default: 'choice_en2cn', validator: (v) => ['choice_en2cn','choice_cn2en','spell_hint','spell_full','translate'].includes(v) },
  adaptiveDifficulty: { type: Object, default: null }
})

const emit = defineEmits(['answer', 'close'])

const answered = ref(false)
const isCorrect = ref(false)
const selectedIndex = ref(-1)
const shaking = ref(false)
const startTime = ref(Date.now())
const typedAnswer = ref('')
const spellInput = ref(null)
const answerQuality = ref('wrong')
const editDistance = ref(null)
const similarity = ref(0)
const scoreRatio = ref(1)
const fuzzyFeedback = ref('')
const speechSupported = canSpeak()
const speechRecognitionSupported = canRecognizeSpeech()
const listening = ref(false)
const pronunciationLoading = ref(false)
const pronunciationResult = ref(null)
const pronunciationError = ref('')
let recognition = null

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

const resultTitle = computed(() => {
  if (answerQuality.value === 'near') return '🟡 接近正确！'
  return isCorrect.value ? '✅ 回答正确！' : '❌ 回答错误'
})

const answerQualityLabel = computed(() => ({
  exact: '精准掌握',
  near: '接近正确',
  wrong: '需要复习'
}[answerQuality.value] || '待评估'))

const pronunciationGradeLabel = computed(() => ({
  excellent: '优秀',
  good: '良好',
  pass: '达标',
  retry: '需重练'
}[pronunciationResult.value?.grade] || '待评分'))

const adaptiveDifficultyLabel = computed(() => {
  if (!props.adaptiveDifficulty) return ''
  const ability = props.adaptiveDifficulty.abilityScore
  const difficulty = props.adaptiveDifficulty.difficulty
  const type = props.adaptiveDifficulty.questionType
  const abilityText = ability !== undefined ? `能力${Math.round(Number(ability) * 100)}%` : ''
  const difficultyText = difficulty ? `下轮Lv.${difficulty}` : ''
  const typeText = type ? questionTypeName(type) : ''
  return [abilityText, difficultyText, typeText].filter(Boolean).join(' / ')
})

function questionTypeName(type) {
  return ({
    choice_en2cn: '英中选择',
    choice_cn2en: '中英选择',
    spell_hint: '提示拼写',
    spell_full: '完整拼写',
    translate: '翻译'
  })[type] || type
}

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
  if (recognition) recognition.abort()
})

function selectOption(index, option) {
  if (answered.value) return

  selectedIndex.value = index
  answered.value = true
  isCorrect.value = option.correct
  answerQuality.value = option.correct ? 'exact' : 'wrong'
  editDistance.value = null
  similarity.value = option.correct ? 1 : 0
  scoreRatio.value = option.correct ? 1 : 0
  fuzzyFeedback.value = option.correct ? '回答完全正确' : '选择项与标准答案不一致'

  const responseTime = Date.now() - startTime.value
  clearInterval(timerInterval)

  if (!option.correct) {
    shaking.value = true
    setTimeout(() => shaking.value = false, 500)
  }

  emit('answer', {
    isCorrect: option.correct,
    responseTime,
    answer: option.text,
    answerQuality: answerQuality.value,
    editDistance: editDistance.value,
    similarity: similarity.value,
    scoreRatio: scoreRatio.value,
    fuzzyFeedback: fuzzyFeedback.value
  })
}

function onSpellInput(e) {
  // Only allow letters, hyphens, spaces, apostrophes
  typedAnswer.value = e.target.value.replace(/[^a-zA-Z\s'-]/g, '')
}

function submitTypedAnswer() {
  if (answered.value || !typedAnswer.value.trim()) return
  answered.value = true
  const fuzzy = evaluateSpellingAnswer(typedAnswer.value, props.wordData?.word)
  isCorrect.value = fuzzy.isCorrect
  answerQuality.value = fuzzy.answerQuality
  editDistance.value = fuzzy.editDistance
  similarity.value = fuzzy.similarity
  scoreRatio.value = fuzzy.scoreRatio
  fuzzyFeedback.value = fuzzy.feedback
  const responseTime = Date.now() - startTime.value
  clearInterval(timerInterval)

  if (!isCorrect.value) {
    shaking.value = true
    setTimeout(() => shaking.value = false, 500)
  }

  emit('answer', {
    isCorrect: isCorrect.value,
    responseTime,
    answer: typedAnswer.value.trim(),
    answerQuality: answerQuality.value,
    editDistance: editDistance.value,
    similarity: similarity.value,
    scoreRatio: scoreRatio.value,
    fuzzyFeedback: fuzzyFeedback.value
  })
}

function handleTimeout() {
  if (answered.value) return
  answered.value = true
  isCorrect.value = false
  answerQuality.value = 'wrong'
  editDistance.value = null
  similarity.value = 0
  scoreRatio.value = 0
  fuzzyFeedback.value = '答题超时'
  clearInterval(timerInterval)

  emit('answer', {
    isCorrect: false,
    responseTime: totalTime,
    answer: '',
    answerQuality: answerQuality.value,
    editDistance: editDistance.value,
    similarity: similarity.value,
    scoreRatio: scoreRatio.value,
    fuzzyFeedback: fuzzyFeedback.value
  })
}

function startVoiceInput() {
  if (!speechRecognitionSupported || answered.value || listening.value) return
  listening.value = true
  recognition = startSpeechRecognition({
    lang: 'en-US',
    onResult: (text) => { typedAnswer.value = text.replace(/[^a-zA-Z\s'-]/g, '').trim() },
    onError: (error) => { console.warn('语音识别失败:', error) },
    onEnd: () => { listening.value = false; recognition = null }
  })
  if (!recognition) listening.value = false
}

function startPronunciationScoring() {
  if (!speechRecognitionSupported || pronunciationLoading.value) return
  pronunciationLoading.value = true
  pronunciationError.value = ''
  pronunciationResult.value = null
  recognition = startSpeechRecognition({
    lang: 'en-US',
    onResult: async (text, meta = {}) => {
      const transcript = text.replace(/[^a-zA-Z\s'-]/g, '').trim()
      try {
        const res = await scorePronunciation({
          wordId: props.wordData?._id || props.wordData?.id,
          word: props.wordData?.word,
          wordbookId: props.wordData?.wordbookId,
          expectedPhonetic: props.wordData?.phonetic,
          transcript,
          confidence: meta.confidence || 0
        })
        pronunciationResult.value = res.data
      } catch (e) {
        pronunciationError.value = e?.message || '发音评分失败，请稍后重试'
      }
    },
    onError: (error) => { pronunciationError.value = `语音识别失败：${error}` },
    onEnd: () => { pronunciationLoading.value = false; recognition = null }
  })
  if (!recognition) {
    pronunciationLoading.value = false
    pronunciationError.value = '当前浏览器不支持语音识别'
  }
}

function playWord() {
  speakText(props.wordData?.word)
}

function playExample() {
  speakText(props.wordData?.example)
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

.adaptive-badge {
  background: rgba(74, 144, 217, 0.18);
  color: #24527a;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  border: 1px solid rgba(74, 144, 217, 0.45);
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

.speech-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tts-btn {
  margin-top: 8px;
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
  &.score { background: rgba(74, 144, 217, 0.18); color: #24527a; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
}

.pronunciation-panel {
  margin: 10px auto 0;
  max-width: 360px;
  border: 1px solid rgba(139, 105, 20, 0.35);
  border-radius: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.32);
  color: #5b3a1a;
  font-size: 12px;
  line-height: 1.5;

  strong { font-size: 18px; margin-right: 8px; }
  p { margin: 4px 0; }
  &.excellent, &.good { border-color: #5b8c3e; }
  &.retry { border-color: #d45b3e; color: #8a2f1d; }
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

.submit-btn, .voice-btn {
  padding: 14px 18px;
  font-size: 15px;
}

.voice-btn {
  min-height: 44px;
  border: 2px solid #8b6914;
  border-radius: 4px;
  background: rgba(74, 144, 217, 0.16);
  color: #24527a;
  font-weight: bold;
  cursor: pointer;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
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

.ai-feedback-panel {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 8px 0;
  color: #5b3a1a;
  font-size: 13px;
}

.feedback-pill {
  border-radius: 999px;
  padding: 2px 8px;
  background: rgba(91, 140, 62, 0.18);
  color: #2d5016;
  font-weight: bold;

  &.near { background: rgba(232, 163, 60, 0.24); color: #8b6914; }
  &.wrong { background: rgba(212, 91, 62, 0.18); color: #d45b3e; }
}

.near-answer {
  color: #8b6914;
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

@media (max-width: 430px) {
  .quiz-modal {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    overflow-y: auto;
  }
  .quiz-header {
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
  }
  .word-text { font-size: 24px; word-break: break-word; }
  .meaning-text { font-size: 22px; }
  .options-grid,
  .input-area,
  .result-feedback { padding-left: 12px; padding-right: 12px; }
  .option-btn,
  .submit-btn,
  .continue-btn { min-height: 44px; }
  .input-row { flex-direction: column; }
}
</style>
