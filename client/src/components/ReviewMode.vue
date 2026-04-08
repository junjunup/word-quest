<template>
  <div class="review-mode-overlay">
    <div class="review-panel card">
      <!-- 标题 -->
      <div class="review-header">
        <h2>📝 错词复习</h2>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <p>正在加载错词列表...</p>
      </div>

      <!-- 无错词 -->
      <div v-else-if="words.length === 0 && !errorMsg" class="empty-state">
        <p class="empty-icon">🎉</p>
        <p>太棒了！你没有需要复习的错词。</p>
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
          <p class="review-mistake-info">
            ❌ 错误 {{ currentWord.wrongCount }} 次
          </p>
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
          </div>

          <button class="btn btn-primary" @click="nextWord">
            {{ currentIndex < words.length - 1 ? '下一题' : '查看结果' }}
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
        </div>
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
import { getTopMistakes } from '@/api/learning'
import { shuffle, buildChoiceOptions } from '@/utils/helpers'

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

const currentWord = computed(() => words.value[currentIndex.value] || {})

async function loadMistakes() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await getTopMistakes(20)
    if (res.data && res.data.length > 0) {
      words.value = res.data
      generateOptions()
    }
  } catch (e) {
    console.warn('加载错词失败:', e)
    errorMsg.value = '加载错词失败，请检查网络'
  }
  loading.value = false
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
}

function nextWord() {
  if (currentIndex.value < words.value.length - 1) {
    currentIndex.value++
    answered.value = false
    selectedIndex.value = -1
    isCorrect.value = false
    generateOptions()
  } else {
    reviewComplete.value = true
  }
}

async function resetReview() {
  currentIndex.value = 0
  answered.value = false
  selectedIndex.value = -1
  correctCount.value = 0
  answeredCount.value = 0
  reviewComplete.value = false
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

.review-mistake-info {
  color: #d45b3e;
  font-size: 12px;
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
</style>
