<template>
  <div class="game-view">
    <!-- Phaser游戏容器 -->
    <div id="phaser-container" ref="phaserContainer"></div>

    <!-- HUD覆盖层 -->
    <div class="game-hud" v-if="showHud">
      <div class="hud-left">
        <span class="hud-hearts">
          <span v-for="i in 3" :key="i" class="heart" :class="{ lost: i > hudData.lives }">❤️</span>
        </span>
        <span class="hud-score">💰 {{ hudData.score }}</span>
        <span class="hud-combo" v-if="hudData.combo > 0">🔥 x{{ hudData.combo }}</span>
      </div>
      <div class="hud-right">
        <span>第{{ hudData.chapter }}章 第{{ hudData.level }}关</span>
        <button class="btn-icon" @click="openManualChat" title="求助小智">🤖</button>
        <button class="btn-icon" @click="goToDashboard" title="学习报告">📊</button>
        <button class="btn-icon" @click="showPauseMenu = true" title="暂停">⏸️</button>
      </div>
    </div>

    <!-- 暂停菜单 -->
    <div class="pause-overlay" v-if="showPauseMenu">
      <div class="pause-card card">
        <h3 class="pause-title">⏸️ 游戏暂停</h3>
        <button class="btn btn-primary pause-btn" @click="showPauseMenu = false">🌿 继续游戏</button>
        <button class="btn btn-gold pause-btn" @click="backToMenu">🏠 返回菜单</button>
        <button class="btn pause-btn logout-btn" @click="handleLogout">🚪 退出登录</button>
      </div>
    </div>

    <!-- 答题弹窗 -->
    <QuizModal
      v-if="showQuiz"
      :word-data="currentQuizData"
      :difficulty="currentDifficulty"
      @answer="handleQuizAnswer"
      @close="closeQuiz"
    />

    <!-- NPC对话面板 -->
    <ChatPanel
      v-if="showChatPanel"
      :context="chatContext"
      @close="closeChatPanel"
    />

    <!-- 成就弹窗 -->
    <AchievementPopup
      v-if="achievementData"
      :achievement="achievementData"
      @close="achievementData = null"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Phaser from 'phaser'
import { createGameConfig } from '@/game/config'
import eventBus, { EVENTS } from '@/game/systems/EventBus'
import levelManager from '@/game/systems/LevelManager'
import { useGameStore } from '@/stores/game'
import { useUserStore } from '@/stores/user'
import QuizModal from '@/components/QuizModal.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import AchievementPopup from '@/components/AchievementPopup.vue'
import { submitQuizRecord } from '@/api/learning'
import { getChapterLevelWords, getQuizForWord, getChapterWords } from '@/api/vocabulary'
import { calculateScore, shuffle } from '@/utils/helpers'
import scoreSystem from '@/game/systems/ScoreSystem'

// 成就上下文追踪
const achievementContext = reactive({
  levelsCompleted: 0,
  perfectClears: 0,
  maxCombo: 0,
  wordsLearned: 0,
  fastestCorrect: 0,
  chaptersCompleted: 0,
  loginStreak: 0,
  npcChats: 0
})

const router = useRouter()
const gameStore = useGameStore()

const phaserContainer = ref(null)
let game = null

const showHud = ref(true)
const showQuiz = ref(false)
const showChatPanel = ref(false)
const showPauseMenu = ref(false)
const achievementData = ref(null)
const currentQuizData = ref(null)
const currentDifficulty = ref(1)
const currentMonsterIndex = ref(-1)
const pendingWrongAnswer = ref(false) // 标记答错后需打开 ChatPanel

// 关卡词汇列表（从 API 加载）
const levelWords = ref([])

const hudData = reactive({
  lives: 3,
  score: 0,
  combo: 0,
  chapter: 1,
  level: 1
})

const chatContext = reactive({
  currentWord: '',
  playerLevel: 1,
  correctStreak: 0,
  wrongStreak: 0,
  chapterName: '初入大陆',
  triggerType: 'manual'
})

/**
 * 加载指定 chapter/level 的词汇并初始化 LevelManager
 */
async function loadWordsAndInitLevel(chapter, level) {
  levelWords.value = []

  try {
    const res = await getChapterLevelWords(chapter, level)
    if (res.data && res.data.length > 0) {
      levelWords.value = res.data
    }
  } catch (e) {
    console.warn('加载词汇失败:', e)
  }

  // 该 level 没有词汇，尝试 level=0（章节通用词）
  if (levelWords.value.length === 0) {
    try {
      const res = await getChapterLevelWords(chapter, 0)
      if (res.data && res.data.length > 0) {
        levelWords.value = res.data
      }
    } catch (e) {
      console.warn('加载章节通用词汇失败:', e)
    }
  }

  // 仍然没有，加载整个章节
  if (levelWords.value.length === 0) {
    try {
      const res = await getChapterWords(chapter)
      if (res.data) levelWords.value = res.data.slice(0, 10)
    } catch (e) {
      console.warn('Fallback 加载失败:', e)
    }
  }

  levelManager.initLevel(chapter, level, levelWords.value)
}

/**
 * WorldScene 启动新关卡时触发，重新加载词汇
 */
async function onStartLevel(data) {
  const { chapter, level } = data
  hudData.chapter = chapter
  hudData.level = level
  await loadWordsAndInitLevel(chapter, level)
}

onMounted(async () => {
  // 加载游戏进度
  try {
    await gameStore.loadProgress()
  } catch (e) {
    console.warn('加载进度失败:', e)
  }

  // 从存档获取初始 chapter/level
  const chapter = gameStore.progress?.currentChapter || 1
  const level = gameStore.progress?.currentLevel || 1
  hudData.chapter = chapter
  hudData.level = level

  // 加载词汇并初始化 LevelManager
  await loadWordsAndInitLevel(chapter, level)

  // 初始化 Phaser 游戏
  if (phaserContainer.value) {
    const config = createGameConfig(phaserContainer.value)
    game = new Phaser.Game(config)
  }

  // 注册事件监听
  eventBus.on(EVENTS.SHOW_QUIZ, onShowQuiz)
  eventBus.on(EVENTS.SHOW_CHAT, onShowChat)
  eventBus.on(EVENTS.UPDATE_HUD, onUpdateHud)
  eventBus.on(EVENTS.LEVEL_COMPLETE, onLevelComplete)
  eventBus.on(EVENTS.GAME_OVER, onGameOver)
  eventBus.on(EVENTS.SHOW_ACHIEVEMENT, onShowAchievement)
  eventBus.on(EVENTS.START_LEVEL, onStartLevel)
})

onUnmounted(() => {
  // 取消事件监听
  eventBus.off(EVENTS.SHOW_QUIZ, onShowQuiz)
  eventBus.off(EVENTS.SHOW_CHAT, onShowChat)
  eventBus.off(EVENTS.UPDATE_HUD, onUpdateHud)
  eventBus.off(EVENTS.LEVEL_COMPLETE, onLevelComplete)
  eventBus.off(EVENTS.GAME_OVER, onGameOver)
  eventBus.off(EVENTS.SHOW_ACHIEVEMENT, onShowAchievement)
  eventBus.off(EVENTS.START_LEVEL, onStartLevel)

  // 销毁Phaser游戏
  if (game) {
    game.destroy(true)
    game = null
  }
})

/**
 * 怪物碰撞 → 显示答题弹窗
 * 从词汇列表获取真实题目
 */
async function onShowQuiz(data) {
  currentMonsterIndex.value = data.monsterIndex

  // 从 LevelManager 获取当前词汇
  const word = levelManager.getCurrentWord()
  if (!word) {
    // 没有词汇了，直接恢复游戏
    eventBus.emit(EVENTS.RESUME_GAME)
    return
  }

  try {
    // 尝试从 API 获取题目 + 干扰项
    if (word._id) {
      const res = await getQuizForWord(word._id)
      if (res.data) {
        const { question, distractors } = res.data
        currentQuizData.value = buildQuizData(question, distractors, data)
        currentDifficulty.value = word.difficulty || 1
        showQuiz.value = true
        return
      }
    }
  } catch (e) {
    console.warn('从API获取题目失败，使用本地生成:', e)
  }

  // Fallback：从本地词汇列表随机生成干扰项
  currentQuizData.value = buildQuizDataLocal(word, data)
  currentDifficulty.value = word.difficulty || 1
  showQuiz.value = true
}

/**
 * 从 API 数据构建 QuizModal 所需格式
 */
function buildQuizData(question, distractors, eventData) {
  const options = [
    { id: question._id, text: question.meaning, correct: true },
    ...distractors.map(d => ({ id: d.id, text: d.meaning, correct: false }))
  ]
  return {
    _id: question._id,
    word: question.word,
    meaning: question.meaning,
    phonetic: question.phonetic,
    example: question.example,
    options: shuffle(options),
    chapter: eventData.chapter,
    level: eventData.level
  }
}

/**
 * 从本地词汇列表生成题目（API 不可用时的 fallback）
 */
function buildQuizDataLocal(word, eventData) {
  // 从同章词汇中随机选3个不同的 meaning 作为干扰项
  const otherWords = levelWords.value.filter(w =>
    w.word !== word.word && w.meaning !== word.meaning
  )
  const shuffledOthers = shuffle(otherWords).slice(0, 3)

  const options = [
    { id: 'correct', text: word.meaning, correct: true },
    ...shuffledOthers.map(w => ({ id: w._id || w.word, text: w.meaning, correct: false }))
  ]

  // 如果干扰项不足3个，补充假选项
  while (options.length < 4) {
    options.push({ id: `filler_${options.length}`, text: '（无选项）', correct: false })
  }

  return {
    _id: word._id,
    word: word.word,
    meaning: word.meaning,
    phonetic: word.phonetic,
    example: word.example,
    options: shuffle(options),
    chapter: eventData.chapter,
    level: eventData.level
  }
}

/**
 * 处理答题结果
 */
async function handleQuizAnswer(result) {
  const { isCorrect, responseTime, answer } = result
  const score = calculateScore(isCorrect, responseTime, levelManager.combo, currentDifficulty.value)

  // 通过 LevelManager 更新状态（单一数据源）
  const status = levelManager.handleAnswer(isCorrect, responseTime, score)

  // 同步 Pinia store（仅用于持久化）
  if (isCorrect) {
    gameStore.onCorrectAnswer(score)
  } else {
    gameStore.onWrongAnswer()
  }

  // 同步 HUD
  hudData.lives = levelManager.lives
  hudData.score = levelManager.score
  hudData.combo = levelManager.combo

  // 通知 Phaser 场景
  eventBus.emit(EVENTS.QUIZ_ANSWERED, {
    monsterIndex: currentMonsterIndex.value,
    isCorrect,
    score,
    totalScore: levelManager.score,
    combo: levelManager.combo,
    lives: levelManager.lives,
    progress: levelManager.getProgress()
  })

  if (isCorrect) {
    // 答对：推进到下一个词
    levelManager.nextWord()
    achievementContext.wordsLearned++
    if (responseTime < achievementContext.fastestCorrect || achievementContext.fastestCorrect === 0) {
      achievementContext.fastestCorrect = responseTime
    }
  } else {
    // 答错：标记需要打开 ChatPanel
    pendingWrongAnswer.value = true
    chatContext.currentWord = currentQuizData.value?.word || ''
    chatContext.triggerType = 'wrong_answer'
    chatContext.wrongStreak = levelManager.wrongCount
  }

  // 更新成就上下文并检查
  achievementContext.maxCombo = Math.max(achievementContext.maxCombo, levelManager.combo)
  scoreSystem.checkAchievements(achievementContext)

  // 提交答题记录到后端（异步，不阻塞）
  submitQuizRecord({
    wordId: currentQuizData.value?._id || 'unknown',
    word: currentQuizData.value?.word || '',
    questionType: 'choice_en2cn',
    isCorrect,
    responseTime,
    difficulty: currentDifficulty.value,
    hintUsed: false,
    npcInteraction: false,
    sessionId: levelManager.sessionId,
    chapter: hudData.chapter,
    level: hudData.level,
    playerAnswer: answer,
    correctAnswer: currentQuizData.value?.meaning || ''
  }).catch(e => console.warn('提交答题记录失败:', e))

  // 检查 Game Over
  if (status === 'game_over') {
    // LevelManager 已通过 eventBus emit GAME_OVER
    showQuiz.value = false
    return
  }
}

/**
 * 关闭答题弹窗
 * 用户点击"继续战斗"/"知道了"按钮后触发
 */
function closeQuiz() {
  showQuiz.value = false

  if (pendingWrongAnswer.value) {
    // 答错：打开 ChatPanel（游戏保持暂停，等 Chat 关闭再恢复）
    pendingWrongAnswer.value = false
    showChatPanel.value = true
  } else {
    // 答对：通知 Phaser 恢复游戏（双重保险，WorldScene 自己也会 resume）
    eventBus.emit(EVENTS.RESUME_GAME)
  }
}

function onShowChat(data) {
  chatContext.triggerType = 'manual'
  chatContext.chapterName = `第${data?.chapter || 1}章`
  showChatPanel.value = true
}

function openManualChat() {
  chatContext.triggerType = 'manual'
  chatContext.currentWord = ''
  showChatPanel.value = true
}

function closeChatPanel() {
  showChatPanel.value = false
  eventBus.emit(EVENTS.CHAT_CLOSED)
}

function onUpdateHud(data) {
  if (data.lives !== undefined) hudData.lives = data.lives
  if (data.score !== undefined) hudData.score = data.score
  if (data.combo !== undefined) hudData.combo = data.combo
  if (data.chapter !== undefined) hudData.chapter = data.chapter
  if (data.level !== undefined) hudData.level = data.level
}

async function onLevelComplete(result) {
  console.log('关卡完成:', result)
  // 更新成就上下文
  achievementContext.levelsCompleted++
  if (result.correctRate >= 100) achievementContext.perfectClears++
  if (result.level >= 5) achievementContext.chaptersCompleted++
  scoreSystem.checkAchievements(achievementContext)

  // 保存进度到服务器
  try {
    await gameStore.saveLevelResult(result.chapter, result.level, result.stars, result.score)
  } catch (e) {
    console.warn('保存进度失败:', e)
  }
}

function onGameOver(result) {
  console.log('游戏结束:', result)
  showQuiz.value = false
  showChatPanel.value = false
}

function onShowAchievement(data) {
  achievementData.value = data
}

function goToDashboard() {
  router.push('/dashboard')
}

function backToMenu() {
  showPauseMenu.value = false
  if (game) {
    const scene = game.scene.getScene('WorldScene')
    if (scene) scene.scene.start('MenuScene')
  }
}

function handleLogout() {
  showPauseMenu.value = false
  if (game) { game.destroy(true); game = null }
  const userStore = useUserStore()
  userStore.logout()
  router.push('/')
}
</script>

<style scoped lang="scss">
.game-view {
  width: 100%;
  height: 100%;
  position: relative;
  background: #2d5016;
  display: flex;
  align-items: center;
  justify-content: center;
}

#phaser-container {
  width: 960px;
  height: 640px;
  position: relative;
  border: 3px solid #8b6914;
  border-radius: 4px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);

  canvas {
    display: block;
    image-rendering: pixelated;
  }
}

.game-hud {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 960px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: linear-gradient(180deg, rgba(91, 58, 26, 0.9) 0%, rgba(91, 58, 26, 0.7) 100%);
  border-bottom: 2px solid #8b6914;
  z-index: 100;
  pointer-events: all;
}

.hud-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.heart.lost {
  filter: grayscale(100%);
  opacity: 0.3;
}

.hud-score {
  color: #ffc847;
  font-weight: bold;
  font-family: 'Press Start 2P', monospace;
  font-size: 13px;
}

.hud-combo {
  color: #e8a33c;
  font-weight: bold;
  font-family: 'Press Start 2P', monospace;
  font-size: 13px;
  animation: pulse 0.5s ease;
}

.hud-right {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #f5edd6;
  font-size: 13px;
}

.btn-icon {
  background: #5b8c3e;
  border: 2px solid #3a6b1e;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #6b9c4e;
    border-color: #ffc847;
    transform: translateY(-1px);
  }
}

.pause-overlay {
  position: fixed;
  inset: 0;
  background: rgba(45, 80, 22, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
}

.pause-card {
  text-align: center;
  min-width: 280px;
  padding: 30px 40px;
}

.pause-title {
  color: #5b3a1a;
  font-size: 24px;
  margin-bottom: 24px;
}

.pause-btn {
  display: block;
  width: 100%;
  margin-bottom: 12px;
  padding: 12px;
  font-size: 16px;
}

.logout-btn {
  background: #d45b3e;
  border-color: #a04030;
  color: #f5edd6;
  &:hover { background: #e06b4e; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
