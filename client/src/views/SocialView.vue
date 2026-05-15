<template>
  <div class="social-view">
    <header class="social-header">
      <button class="back-btn" @click="$router.push('/game')">← 返回游戏</button>
      <div>
        <p class="eyebrow">好友与异步 PK</p>
        <h1>社交竞技中心</h1>
      </div>
      <button class="refresh-btn" @click="loadAll" :disabled="loading">{{ loading ? '刷新中...' : '刷新' }}</button>
    </header>

    <main class="social-grid">
      <section class="panel">
        <h2>添加好友</h2>
        <div class="search-row">
          <input v-model="keyword" @keyup.enter="search" placeholder="输入用户名或昵称（至少2个字符）" />
          <button @click="search" :disabled="keyword.trim().length < 2">搜索</button>
        </div>
        <p v-if="message" class="message">{{ message }}</p>
        <div v-if="searchResults.length" class="result-list">
          <div v-for="user in searchResults" :key="user.id" class="user-row">
            <div>
              <strong>{{ user.nickname }}</strong>
              <span>@{{ user.username }} · Lv.{{ user.level }}</span>
            </div>
            <button @click="requestFriend(user)">加好友</button>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>好友列表</h2>
        <div v-if="incomingRequests.length" class="request-box">
          <h3>待处理请求</h3>
          <div v-for="item in incomingRequests" :key="item.id" class="user-row">
            <div>
              <strong>{{ item.friend?.nickname }}</strong>
              <span>@{{ item.friend?.username }}</span>
            </div>
            <div class="row-actions">
              <button @click="respond(item, true)">接受</button>
              <button class="ghost" @click="respond(item, false)">拒绝</button>
            </div>
          </div>
        </div>
        <div v-if="acceptedFriends.length" class="friend-list">
          <div v-for="item in acceptedFriends" :key="item.id" class="user-row">
            <div>
              <strong>{{ item.friend?.nickname }}</strong>
              <span>@{{ item.friend?.username }} · {{ item.friend?.totalScore || 0 }}分</span>
            </div>
            <button class="ghost" @click="removeFriend(item)">删除</button>
          </div>
        </div>
        <p v-else class="empty">暂无已接受好友，先搜索并添加好友。</p>
      </section>

      <section class="panel wide">
        <h2>发起异步 PK</h2>
        <div class="challenge-form">
          <label>
            对手
            <select v-model="challengeForm.opponentId">
              <option value="">选择好友</option>
              <option v-for="item in acceptedFriends" :key="item.friend.id" :value="item.friend.id">{{ item.friend.nickname }}</option>
            </select>
          </label>
          <label>
            词书
            <select v-model="challengeForm.wordbookId">
              <option v-for="book in wordbooks" :key="book.wordbookId" :value="book.wordbookId">{{ book.name }}（{{ book.total }}词）</option>
            </select>
          </label>
          <label>
            题数
            <input v-model.number="challengeForm.questionCount" type="number" min="3" max="20" />
          </label>
          <button @click="createPk" :disabled="!challengeForm.opponentId">创建 PK</button>
        </div>
      </section>

      <section class="panel wide">
        <h2>我的异步 PK</h2>
        <div v-if="challenges.length" class="challenge-list">
          <article v-for="challenge in challenges" :key="challenge.id" class="challenge-card">
            <header>
              <div>
                <strong>{{ challenge.challenger?.nickname }} vs {{ challenge.opponent?.nickname }}</strong>
                <span>{{ challenge.wordbookName }} · {{ challenge.questionCount }}题 · {{ statusText(challenge) }}</span>
              </div>
              <span class="score-pill" v-if="challenge.mySubmission">我的得分 {{ challenge.mySubmission.score }}</span>
            </header>

            <div v-if="!challenge.mySubmission && challenge.status !== 'completed'" class="answer-grid">
              <label v-for="word in challenge.words" :key="String(word.wordId)">
                <span>{{ word.meaning }}</span>
                <small v-if="word.phonetic">{{ word.phonetic }}</small>
                <input v-model="answerDrafts[challenge.id][String(word.wordId)]" :placeholder="`拼写 ${word.word?.length || ''} 个字母`" />
              </label>
              <button @click="submitPk(challenge)">提交本场答案</button>
            </div>

            <div v-else class="submission-summary">
              <p v-if="challenge.mySubmission">已提交：{{ challenge.mySubmission.correctCount }}/{{ challenge.questionCount }} 正确。</p>
              <p v-if="challenge.opponentSubmission">对手已提交：{{ challenge.opponentSubmission.correctCount }}/{{ challenge.questionCount }} 正确。</p>
              <p v-if="challenge.status === 'completed'">结果：{{ winnerText(challenge) }}</p>
              <p v-else>等待另一方提交。</p>
            </div>
          </article>
        </div>
        <p v-else class="empty">暂无 PK，选择好友后发起第一场。</p>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { getWordbooks } from '@/api/vocabulary'
import {
  createChallenge,
  deleteFriendship,
  getChallenges,
  getFriends,
  respondFriendRequest,
  searchUsers,
  sendFriendRequest,
  submitChallenge
} from '@/api/social'

const userStore = useUserStore()
const loading = ref(false)
const keyword = ref('')
const message = ref('')
const searchResults = ref([])
const friendships = ref([])
const challenges = ref([])
const wordbooks = ref([{ wordbookId: 'cet4', name: 'CET-4 真题核心词库（4500）', total: 0 }])
const answerDrafts = reactive({})
const challengeForm = reactive({ opponentId: '', wordbookId: 'cet4', questionCount: 10 })

const acceptedFriends = computed(() => friendships.value.filter(item => item.status === 'accepted'))
const incomingRequests = computed(() => friendships.value.filter(item => item.status === 'pending' && item.direction === 'incoming'))

onMounted(loadAll)

async function loadAll() {
  loading.value = true
  message.value = ''
  try {
    const [friendRes, challengeRes, bookRes] = await Promise.all([getFriends(), getChallenges(), getWordbooks()])
    friendships.value = friendRes.data || []
    challenges.value = challengeRes.data || []
    wordbooks.value = bookRes.data?.length ? bookRes.data : wordbooks.value
    if (!wordbooks.value.some(book => book.wordbookId === challengeForm.wordbookId)) {
      challengeForm.wordbookId = wordbooks.value[0]?.wordbookId || 'cet4'
    }
    for (const challenge of challenges.value) ensureDraft(challenge)
  } catch (e) {
    message.value = e?.message || '社交数据加载失败'
  } finally {
    loading.value = false
  }
}

async function search() {
  if (keyword.value.trim().length < 2) return
  try {
    const res = await searchUsers(keyword.value.trim())
    searchResults.value = res.data || []
    message.value = searchResults.value.length ? '' : '未找到匹配用户'
  } catch (e) {
    message.value = e?.message || '搜索失败'
  }
}

async function requestFriend(user) {
  try {
    await sendFriendRequest({ userId: user.id })
    message.value = `已向 ${user.nickname} 发送好友请求`
    await loadAll()
  } catch (e) {
    message.value = e?.message || '发送好友请求失败'
  }
}

async function respond(item, accept) {
  try {
    await respondFriendRequest(item.id, accept)
    await loadAll()
  } catch (e) {
    message.value = e?.message || '处理好友请求失败'
  }
}

async function removeFriend(item) {
  if (!confirm(`确认删除好友 ${item.friend?.nickname}？`)) return
  try {
    await deleteFriendship(item.id)
    await loadAll()
  } catch (e) {
    message.value = e?.message || '删除好友失败'
  }
}

async function createPk() {
  try {
    const res = await createChallenge({ ...challengeForm })
    const created = res.data
    challenges.value.unshift(created)
    ensureDraft(created)
    message.value = '异步 PK 已创建，请先提交你的答案或等待对手进入。'
  } catch (e) {
    message.value = e?.message || '创建 PK 失败'
  }
}

function ensureDraft(challenge) {
  if (!answerDrafts[challenge.id]) answerDrafts[challenge.id] = {}
  for (const word of challenge.words || []) {
    const key = String(word.wordId)
    if (answerDrafts[challenge.id][key] === undefined) answerDrafts[challenge.id][key] = ''
  }
}

async function submitPk(challenge) {
  ensureDraft(challenge)
  const answers = Object.entries(answerDrafts[challenge.id]).map(([wordId, answer]) => ({ wordId, answer }))
  try {
    const res = await submitChallenge(challenge.id, answers)
    const index = challenges.value.findIndex(item => item.id === challenge.id)
    if (index >= 0) challenges.value[index] = res.data
    message.value = 'PK 答案已提交，服务端已完成判分。'
  } catch (e) {
    message.value = e?.message || '提交 PK 失败'
  }
}

function statusText(challenge) {
  return ({
    awaiting_challenger: '等待发起方',
    awaiting_opponent: '等待对手',
    completed: '已完成',
    cancelled: '已取消'
  })[challenge.status] || challenge.status
}

function winnerText(challenge) {
  if (!challenge.winner) return '平局'
  const myId = userStore.userInfo?.id || userStore.userInfo?._id
  return String(challenge.winner) === String(myId) ? '你获胜' : '对手获胜'
}
</script>

<style scoped lang="scss">
.social-view {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--bg-dark);
  color: #f5edd6;
  padding: 20px;
}

.social-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 16px;

  h1 { margin: 2px 0 0; color: #ffd700; font-size: 24px; }
}

.eyebrow { margin: 0; color: #9fd37a; font-size: 12px; letter-spacing: 1px; }
.back-btn, .refresh-btn, button {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(91, 140, 62, 0.35);
  color: #f5edd6;
  padding: 8px 14px;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.ghost { background: rgba(255, 255, 255, 0.06); }
.social-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  max-width: 1180px;
  margin: 0 auto;
}
.panel {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
  &.wide { grid-column: 1 / -1; }
  h2 { margin: 0 0 14px; color: #ffd700; font-size: 18px; }
  h3 { margin: 0 0 10px; color: #9fd37a; font-size: 15px; }
}
.search-row, .challenge-form {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
input, select {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.24);
  color: #f5edd6;
  padding: 10px 12px;
}
.search-row input { flex: 1; min-width: 220px; }
.challenge-form label { display: flex; flex-direction: column; gap: 6px; min-width: 180px; color: #c4b99a; }
.user-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  span { display: block; color: #c4b99a; font-size: 13px; margin-top: 2px; }
}
.row-actions { display: flex; gap: 8px; }
.message { color: #ffd700; }
.empty { color: #9a9aab; }
.challenge-list { display: grid; gap: 14px; }
.challenge-card {
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 14px;
  header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    span { display: block; color: #c4b99a; font-size: 13px; margin-top: 4px; }
  }
}
.score-pill { color: #9fd37a !important; border: 1px solid rgba(159, 211, 122, 0.45); border-radius: 999px; padding: 4px 10px; }
.answer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  label { display: flex; flex-direction: column; gap: 5px; color: #f5edd6; }
  small { color: #9fd37a; }
  button { min-height: 42px; }
}
.submission-summary { color: #d6d1bf; line-height: 1.6; }
@media (max-width: 780px) {
  .social-grid { grid-template-columns: 1fr; }
  .social-header { align-items: flex-start; flex-direction: column; }
}
</style>
