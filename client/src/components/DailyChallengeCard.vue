<template>
  <section class="daily-challenge-card">
    <div class="challenge-header">
      <div>
        <p class="eyebrow">每日挑战</p>
        <h3>{{ challenge?.completed ? '今日已完成' : '全服同题限时挑战' }}</h3>
      </div>
      <span class="date-badge">{{ challenge?.date || today }}</span>
    </div>

    <div v-if="loading" class="challenge-state">正在加载今日挑战...</div>
    <div v-else-if="error" class="challenge-state warning">{{ error }}</div>
    <template v-else-if="challenge">
      <div class="challenge-summary">
        <div><strong>{{ challenge.questionCount }}</strong><span>题目</span></div>
        <div><strong>{{ leaderboard.length }}</strong><span>今日上榜</span></div>
        <div><strong>{{ challenge.attempt?.streak || 0 }}</strong><span>连续天数</span></div>
      </div>

      <div v-if="challenge.completed" class="completed-panel">
        <strong>{{ challenge.attempt.score }} 分</strong>
        <span>正确 {{ challenge.attempt.correctCount }}/{{ challenge.attempt.questionCount }}</span>
        <span v-if="challenge.attempt.rewardTitle">称号：{{ challenge.attempt.rewardTitle }}</span>
        <span>+{{ challenge.attempt.rewardExp }} EXP ✨</span>
      </div>

      <button class="btn btn-primary challenge-action" :disabled="challenge.completed" @click="startChallenge">
        {{ challenge.completed ? '✅ 今日挑战已完成' : '开始每日挑战' }}
      </button>

      <button v-if="challenge.completed" class="btn btn-secondary challenge-action" @click="emit('close')">
        关闭
      </button>

      <ol v-if="leaderboard.length" class="leaderboard-mini">
        <li v-for="row in leaderboard.slice(0, 3)" :key="row.rank">
          <span>#{{ row.rank }} {{ row.user?.nickname || '勇者' }}</span>
          <strong>{{ row.score }}</strong>
        </li>
      </ol>
    </template>

    <!-- 盲盒奖励 -->
    <BlindBoxReward
      v-if="showBlindBox"
      :challenge-id="challenge?.id"
      @claim="onBlindBoxClaim"
      @close="showBlindBox = false"
    />

    <div v-if="active" class="challenge-modal">
      <div class="challenge-panel">
        <header>
          <div>
            <p class="eyebrow">{{ challenge.date }}</p>
            <h3>每日挑战进行中</h3>
          </div>
          <button class="close-btn" @click="closeChallenge" :disabled="submitting">✕</button>
        </header>

        <div class="progress-line">
          <span>{{ currentIndex + 1 }} / {{ challenge.questions.length }}</span>
          <span>{{ elapsedSeconds }}s</span>
        </div>

        <article class="question-card" v-if="currentQuestion">
          <h2>{{ currentQuestion.word }}</h2>
          <p v-if="currentQuestion.phonetic">{{ currentQuestion.phonetic }}</p>
          <div class="option-grid">
            <button
              v-for="option in currentQuestion.options"
              :key="option"
              :class="{ selected: answers[String(currentQuestion.wordId)] === option }"
              @click="selectOption(currentQuestion.wordId, option)"
            >{{ option }}</button>
          </div>
        </article>

        <footer>
          <button class="btn" @click="prevQuestion" :disabled="currentIndex === 0 || submitting">上一题</button>
          <button v-if="currentIndex < challenge.questions.length - 1" class="btn btn-primary" @click="nextQuestion" :disabled="!hasCurrentAnswer || submitting">下一题</button>
          <button v-else class="btn btn-gold" @click="submit" :disabled="!allAnswered || submitting">{{ submitting ? '提交中...' : '提交挑战' }}</button>
        </footer>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getDailyChallengeLeaderboard, getTodayDailyChallenge, submitDailyChallenge } from '@/api/dailyChallenge'
import BlindBoxReward from '@/components/BlindBoxReward.vue'

const props = defineProps({
  wordbookId: { type: String, default: 'cet4' }
})

const emit = defineEmits(['close'])

const loading = ref(false)
const error = ref('')
const challenge = ref(null)
const leaderboard = ref([])
const active = ref(false)
const currentIndex = ref(0)
const answers = ref({})
const submitting = ref(false)
const startedAt = ref(0)
const elapsedSeconds = ref(0)
const showBlindBox = ref(false)
let timer = null

const today = new Date().toISOString().slice(0, 10)
const currentQuestion = computed(() => challenge.value?.questions?.[currentIndex.value] || null)
const hasCurrentAnswer = computed(() => !!answers.value[String(currentQuestion.value?.wordId || '')])
const allAnswered = computed(() => {
  const questions = challenge.value?.questions || []
  return questions.length > 0 && questions.every(item => answers.value[String(item.wordId)])
})

onMounted(loadChallenge)
onUnmounted(stopTimer)
watch(() => props.wordbookId, loadChallenge)

async function loadChallenge() {
  loading.value = true
  error.value = ''
  try {
    const [challengeRes, leaderboardRes] = await Promise.all([
      getTodayDailyChallenge(props.wordbookId),
      getDailyChallengeLeaderboard({ wordbookId: props.wordbookId })
    ])
    challenge.value = challengeRes.data
    leaderboard.value = leaderboardRes.data || []
  } catch (e) {
    error.value = e?.message || '每日挑战加载失败'
  } finally {
    loading.value = false
  }
}

function startChallenge() {
  if (!challenge.value || challenge.value.completed) return
  active.value = true
  currentIndex.value = 0
  answers.value = {}
  startedAt.value = Date.now()
  elapsedSeconds.value = 0
  stopTimer()
  timer = setInterval(() => { elapsedSeconds.value = Math.floor((Date.now() - startedAt.value) / 1000) }, 1000)
}

function closeChallenge() {
  active.value = false
  stopTimer()
}

function onBlindBoxClaim(reward) {
  showBlindBox.value = false
  // Reload to reflect updated gold/exp
  loadChallenge()
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

function selectOption(wordId, option) {
  answers.value = { ...answers.value, [String(wordId)]: option }
}

function prevQuestion() {
  currentIndex.value = Math.max(0, currentIndex.value - 1)
}

function nextQuestion() {
  if (hasCurrentAnswer.value) currentIndex.value = Math.min(challenge.value.questions.length - 1, currentIndex.value + 1)
}

async function submit() {
  if (!allAnswered.value || submitting.value) return
  submitting.value = true
  try {
    const payload = {
      durationMs: Date.now() - startedAt.value,
      answers: Object.entries(answers.value).map(([wordId, answer]) => ({ wordId, answer }))
    }
    const res = await submitDailyChallenge(challenge.value.id, payload)
    challenge.value = res.data
    active.value = false
    stopTimer()
    // Show blind box reward after successful submission
    showBlindBox.value = true
    const leaderboardRes = await getDailyChallengeLeaderboard({ wordbookId: props.wordbookId })
    leaderboard.value = leaderboardRes.data || []
  } catch (e) {
    error.value = e?.message || '每日挑战提交失败'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.daily-challenge-card {
  background: linear-gradient(135deg, rgba(74, 144, 217, 0.16), rgba(255, 215, 0, 0.12));
  border: 1px solid rgba(74, 144, 217, 0.35);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 20px;
}
.challenge-header, .progress-line, .leaderboard-mini li, .challenge-panel header, .challenge-panel footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.eyebrow { color: #c4b99a; font-size: 12px; letter-spacing: 0.12em; }
h3 { color: #ffd700; margin: 2px 0 0; }
.date-badge { color: #9dccff; border: 1px solid rgba(157, 204, 255, 0.35); border-radius: 999px; padding: 4px 10px; }
.challenge-state { color: #f5edd6; padding: 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); margin: 12px 0; }
.warning { color: #ffb37a; }
.challenge-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
.challenge-summary div { background: rgba(0,0,0,.16); border-radius: 10px; padding: 10px; text-align: center; }
.challenge-summary strong { color: #ffd700; display: block; font-size: 18px; }
.challenge-summary span, .completed-panel span { color: #c4b99a; font-size: 12px; }
.completed-panel { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; color: #f5edd6; margin-bottom: 12px; }
.completed-panel strong { color: #9be66d; }
.challenge-action { width: 100%; min-height: 44px; margin-top: 8px; }
.leaderboard-mini { list-style: none; margin-top: 12px; display: grid; gap: 6px; color: #f5edd6; }
.leaderboard-mini strong { color: #9be66d; }
.challenge-modal { position: fixed; inset: 0; background: rgba(10, 14, 20, .82); z-index: 2500; display: flex; align-items: center; justify-content: center; padding: 16px; }
.challenge-panel { width: min(620px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; background: #1a1a2e; border: 1px solid rgba(255,255,255,.14); border-radius: 16px; padding: 18px; color: #f5edd6; }
.close-btn { min-width: 36px; min-height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,.2); background: rgba(212, 91, 62, .35); color: #fff; }
.progress-line { margin: 14px 0; color: #c4b99a; }
.question-card { background: rgba(255,255,255,.06); border-radius: 14px; padding: 18px; text-align: center; }
.question-card h2 { color: #ffd700; font-size: 30px; margin-bottom: 4px; }
.question-card p { color: #9dccff; }
.option-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
.option-grid button { min-height: 48px; border: 1px solid rgba(255,255,255,.18); border-radius: 10px; background: rgba(255,255,255,.08); color: #f5edd6; padding: 10px; cursor: pointer; }
.option-grid button.selected { border-color: #9be66d; background: rgba(91,140,62,.32); }
.challenge-panel footer { margin-top: 16px; }
@media (max-width: 520px) { .challenge-summary, .option-grid { grid-template-columns: 1fr; } .challenge-panel footer { flex-direction: column; align-items: stretch; } }
</style>
