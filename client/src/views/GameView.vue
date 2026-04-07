<template>
  <div class="game-view">
    <!-- Phaser游戏容器 -->
    <div id="phaser-container" ref="phaserContainer"></div>

    <!-- HUD覆盖层 -->
    <div class="game-hud" v-if="showHud && uiState === 'game'">
      <div class="hud-left">
        <span class="hud-hearts">
          <span v-for="i in hudData.maxLives" :key="i" class="heart" :class="{ lost: i > hudData.lives }">❤️</span>
        </span>
        <span class="hud-score">💰 {{ hudData.score }}</span>
        <span class="hud-combo" v-if="hudData.combo > 0">🔥 x{{ hudData.combo }}</span>
      </div>
      <div class="hud-right">
        <span class="difficulty-hud-badge" v-if="gameStore.selectedDifficulty !== 'normal'">
          {{ { easy: '🌱简单', hard: '🔥困难' }[gameStore.selectedDifficulty] }}
        </span>
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
        <button class="btn pause-btn" @click="toggleMute">
          {{ isMuted ? '🔇 取消静音' : '🔊 静音' }}
        </button>
        <button class="btn btn-gold pause-btn" @click="backToMenu">🏠 返回菜单</button>
        <button class="btn pause-btn logout-btn" @click="handleLogout">🚪 退出登录</button>
      </div>
    </div>

    <!-- 关卡选择 -->
    <LevelSelect
      v-if="uiState === 'levelSelect'"
      @start="onLevelSelectStart"
      @back="onLevelSelectBack"
    />

    <!-- 游戏交互式引导（叠加在游戏画面上） -->
    <GameIntro
      v-if="showTutorial"
      @dismiss="onIntroDismiss"
    />

    <!-- 角色选择 -->
    <CharacterSelect
      v-if="uiState === 'characterSelect'"
      @confirm="onCharacterConfirm"
      @back="onCharacterBack"
    />

    <!-- 排行榜浮窗 -->
    <div class="leaderboard-overlay" v-if="uiState === 'leaderboard'" @click.self="uiState = 'game'">
      <div class="leaderboard-panel">
        <button class="leaderboard-close" @click="uiState = 'game'">✕</button>
        <ScoreBoard />
      </div>
    </div>

    <!-- 答题弹窗 -->
    <QuizModal
      v-if="showQuiz"
      :word-data="currentQuizData"
      :difficulty="currentDifficulty"
      :question-type="currentQuestionType"
      :time-limit="gameStore.difficultyConfig.timer"
      @answer="handleQuizAnswer"
      @close="closeQuiz"
    />

    <!-- Boss答题弹窗 -->
    <BossQuizModal
      v-if="showBossQuiz"
      :boss-name="bossQuizData.bossName"
      :boss-hp="bossQuizData.questionsNeeded"
      :boss-current-hp="bossQuizData.bossCurrentHp"
      :boss-max-hp="bossQuizData.bossMaxHp"
      :time-limit="gameStore.difficultyConfig.timer"
      :level-words="levelWords"
      :question-type="currentQuestionType"
      @complete="onBossQuizComplete"
      @close="onBossQuizClose"
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
import BossQuizModal from '@/components/BossQuizModal.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import AchievementPopup from '@/components/AchievementPopup.vue'
import ScoreBoard from '@/components/ScoreBoard.vue'
import LevelSelect from '@/components/LevelSelect.vue'
import GameIntro from '@/components/GameIntro.vue'
import CharacterSelect from '@/components/CharacterSelect.vue'
import { submitQuizRecord } from '@/api/learning'
import { getChapterLevelWords, getQuizForWord, getChapterWords } from '@/api/vocabulary'
import { DEATH_SPIRAL, STORAGE_KEYS, QUESTION_TYPES } from '@/game/config/gameConstants'
import { calculateScore, shuffle, buildChoiceOptions, safeGetJSON, safeSetJSON, safeGetItem } from '@/utils/helpers'
import scoreSystem from '@/game/systems/ScoreSystem'
import audioManager from '@/game/systems/AudioManager'

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

// Load persisted achievement context
const savedCtx = safeGetJSON(STORAGE_KEYS.achievementContext)
if (savedCtx) {
  Object.assign(achievementContext, savedCtx)
}

function persistAchievementContext() {
  safeSetJSON(STORAGE_KEYS.achievementContext, { ...achievementContext })
}

const router = useRouter()
const gameStore = useGameStore()

const phaserContainer = ref(null)
let game = null

// UI状态机: 'game' | 'levelSelect' | 'characterSelect' | 'intro' | 'leaderboard'
const uiState = ref('game')

const showHud = ref(true)
const showQuiz = ref(false)
const showBossQuiz = ref(false)
const showChatPanel = ref(false)
const showPauseMenu = ref(false)
const achievementData = ref(null)
const currentQuizData = ref(null)
const currentDifficulty = ref(1)
const currentMonsterIndex = ref(-1)
const pendingWrongAnswer = ref(false)
const showTutorial = ref(false)

// 多题型与自适应难度
const currentQuestionType = ref('choice_en2cn')
const adaptiveQuestionType = ref('choice_en2cn')
const consecutiveWrong = ref(0)
const loadError = ref('')

// 音效
const isMuted = ref(audioManager.muted)
function toggleMute() {
  isMuted.value = audioManager.toggleMute()
}

// Boss quiz data
const bossQuizData = reactive({
  bossName: '',
  questionsNeeded: 1,
  bossCurrentHp: 0,
  bossMaxHp: 0,
  timeLimit: 30000
})

// 待启动的关卡参数（关卡选择后暂存，等intro结束再启动）
const pendingLevelParams = ref(null)

// 关卡词汇列表（从 API 加载）
const levelWords = ref([])

const hudData = reactive({
  lives: 3,
  maxLives: 3,
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
  loadError.value = ''

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

  if (levelWords.value.length === 0) {
    loadError.value = '词汇加载失败，请检查网络连接'
    console.error('所有词汇加载方式均失败')
  }

  const difficulty = gameStore.selectedDifficulty
  levelManager.initLevel(chapter, level, levelWords.value, difficulty)
}

/**
 * WorldScene 启动新关卡时触发，重新加载词汇
 */
async function onStartLevel(data) {
  const { chapter, level, isTutorial } = data
  hudData.chapter = chapter
  hudData.level = level
  hudData.maxLives = gameStore.difficultyConfig.lives
  await loadWordsAndInitLevel(chapter, level)
  if (isTutorial) {
    levelManager.setTutorialMode()
    hudData.maxLives = 99
    hudData.lives = 99
  }
}

// --- UI Panel Event Handlers ---

function onShowLevelSelect(data) {
  uiState.value = 'levelSelect'
}

function onShowCharacterSelect() {
  uiState.value = 'characterSelect'
}

function onShowLeaderboard() {
  uiState.value = 'leaderboard'
}

function onLevelSelectStart({ chapter, level, difficulty }) {
  gameStore.selectedDifficulty = difficulty
  // Persist difficulty preference to localStorage
  safeSetJSON(STORAGE_KEYS.difficulty, difficulty)
  pendingLevelParams.value = { chapter, level, difficulty }

  // Check if we should show intro
  const skipIntro = safeGetItem(STORAGE_KEYS.skipIntro) === 'true'
  if (skipIntro) {
    startGameLevel()
  } else {
    // 先启动游戏，然后叠加交互式引导
    startGameLevel()
    showTutorial.value = true
  }
}

function onLevelSelectBack() {
  uiState.value = 'game'
}

function onIntroDismiss() {
  showTutorial.value = false
}

function onCharacterConfirm() {
  uiState.value = 'game'
}

function onCharacterBack() {
  uiState.value = 'game'
}

function startGameLevel() {
  uiState.value = 'game'
  const params = pendingLevelParams.value
  if (!params) return

  pendingLevelParams.value = null
  hudData.chapter = params.chapter
  hudData.level = params.level
  hudData.maxLives = gameStore.difficultyConfig.lives

  // Set character sprite index in Phaser registry
  const userStore = useUserStore()
  if (game) {
    game.registry.set('characterSpriteIndex', userStore.characterSpriteIndex || 0)
  }

  // Start WorldScene via Phaser
  if (game) {
    // Find any active scene to transition from
    const sceneNames = ['MenuScene', 'WorldScene', 'ResultScene', 'BootScene']
    for (const sceneName of sceneNames) {
      const scene = game.scene.getScene(sceneName)
      if (scene && scene.scene.isActive()) {
        scene.scene.start('WorldScene', {
          chapter: params.chapter,
          level: params.level,
          difficulty: params.difficulty
        })
        return
      }
    }
  }
}

// --- Boss Quiz Handlers ---

function onShowBossQuiz(data) {
  bossQuizData.bossName = data.bossName || '👹 BOSS'
  bossQuizData.questionsNeeded = data.questionsNeeded || 1
  bossQuizData.bossCurrentHp = data.bossCurrentHp || 0
  bossQuizData.bossMaxHp = data.bossMaxHp || 0
  bossQuizData.timeLimit = data.timeLimit || gameStore.difficultyConfig.timer
  showBossQuiz.value = true
}

function onBossQuizComplete(result) {
  showBossQuiz.value = false
  // Sync HUD from LevelManager after boss quiz answers
  hudData.lives = levelManager.lives
  hudData.score = levelManager.score
  hudData.combo = levelManager.combo
  // Sync Pinia store for persistence
  gameStore.lives = levelManager.lives
  eventBus.emit(EVENTS.BOSS_QUIZ_RESULT, result)
}

function onBossQuizClose() {
  showBossQuiz.value = false
  eventBus.emit(EVENTS.BOSS_QUIZ_RESULT, { correctCount: 0, cancelled: true })
}

function onTogglePause() {
  if (uiState.value === 'game' && !showQuiz.value && !showBossQuiz.value && !showChatPanel.value) {
    showPauseMenu.value = !showPauseMenu.value
  }
}

onMounted(async () => {
  // 加载游戏进度
  try {
    await gameStore.loadProgress()
  } catch (e) {
    console.warn('加载进度失败:', e)
  }

  // 同步 loginStreak 用于成就
  try {
    const loginUserStore = useUserStore()
    await loginUserStore.fetchUserInfo()
    if (loginUserStore.userInfo?.loginStreak) {
      achievementContext.loginStreak = loginUserStore.userInfo.loginStreak
    }
  } catch (e) {
    console.warn('获取用户信息失败:', e)
  }

  // 加载已获得的成就，防止重复触发
  if (gameStore.progress?.achievements?.length) {
    scoreSystem.loadAchievements(gameStore.progress.achievements.map(a => a.id))
  }
  scoreSystem.checkAchievements(achievementContext)
  persistAchievementContext()

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
  eventBus.on(EVENTS.SHOW_LEADERBOARD, onShowLeaderboard)
  eventBus.on(EVENTS.SHOW_LEVEL_SELECT, onShowLevelSelect)
  eventBus.on(EVENTS.SHOW_CHARACTER_SELECT, onShowCharacterSelect)
  eventBus.on(EVENTS.SHOW_BOSS_QUIZ, onShowBossQuiz)
  eventBus.on(EVENTS.TOGGLE_PAUSE, onTogglePause)
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
  eventBus.off(EVENTS.SHOW_LEADERBOARD, onShowLeaderboard)
  eventBus.off(EVENTS.SHOW_LEVEL_SELECT, onShowLevelSelect)
  eventBus.off(EVENTS.SHOW_CHARACTER_SELECT, onShowCharacterSelect)
  eventBus.off(EVENTS.SHOW_BOSS_QUIZ, onShowBossQuiz)
  eventBus.off(EVENTS.TOGGLE_PAUSE, onTogglePause)

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

  // 死亡螺旋保护
  if (consecutiveWrong.value >= DEATH_SPIRAL.forceEasyThreshold) {
    currentQuestionType.value = DEATH_SPIRAL.downgradeType
    currentDifficulty.value = DEATH_SPIRAL.forcedDifficulty
    const granted = levelManager.grantGraceLife()
    if (granted) {
      hudData.lives = levelManager.lives
    }
  } else if (consecutiveWrong.value >= DEATH_SPIRAL.downgradeThreshold) {
    // 降级为选择题但保持难度
    const adaptive = adaptiveQuestionType.value || 'choice_en2cn'
    const typeConfig = QUESTION_TYPES[adaptive]
    if (typeConfig && !typeConfig.isChoice) {
      currentQuestionType.value = DEATH_SPIRAL.downgradeType
    } else {
      currentQuestionType.value = adaptive
    }
  } else {
    currentQuestionType.value = adaptiveQuestionType.value || 'choice_en2cn'
  }

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
 * 从 API 数据构建 QuizModal 所需格式（支持多题型）
 */
function buildQuizData(question, distractors, eventData) {
  const qt = currentQuestionType.value
  let options

  if (qt === 'choice_cn2en') {
    options = [
      { id: question._id, text: question.word, correct: true },
      ...distractors.map(d => ({ id: d.id, text: d.word, correct: false }))
    ]
    // If distractors insufficient, use buildChoiceOptions as fallback
    if (options.length < 4) {
      const otherWords = levelWords.value.filter(w => w.word !== question.word)
      options = buildChoiceOptions(question._id, question.word, otherWords, 'word')
    }
  } else if (['spell_hint', 'spell_full', 'translate'].includes(qt)) {
    options = []
  } else {
    // choice_en2cn（默认）
    options = [
      { id: question._id, text: question.meaning, correct: true },
      ...distractors.map(d => ({ id: d.id, text: d.meaning, correct: false }))
    ]
    // If distractors insufficient, use buildChoiceOptions as fallback
    if (options.length < 4) {
      const otherMeanings = levelWords.value.filter(w => w.word !== question.word && w.meaning !== question.meaning)
      options = buildChoiceOptions(question._id, question.meaning, otherMeanings, 'meaning')
    }
  }

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
 * 从本地词汇列表生成题目（支持多题型）
 */
function buildQuizDataLocal(word, eventData) {
  const qt = currentQuestionType.value
  const otherWords = levelWords.value.filter(w => w.word !== word.word)

  if (qt === 'choice_cn2en') {
    const options = buildChoiceOptions('correct', word.word, otherWords, 'word')
    return { ...word, options, chapter: eventData.chapter, level: eventData.level }
  }

  if (['spell_hint', 'spell_full', 'translate'].includes(qt)) {
    return { ...word, options: [], chapter: eventData.chapter, level: eventData.level }
  }

  // default choice_en2cn
  const otherMeanings = levelWords.value.filter(w => w.word !== word.word && w.meaning !== word.meaning)
  const options = buildChoiceOptions('correct', word.meaning, otherMeanings, 'meaning')
  return { ...word, options, chapter: eventData.chapter, level: eventData.level }
}

/**
 * 处理答题结果
 */
async function handleQuizAnswer(result) {
  const { isCorrect, responseTime, answer } = result
  const baseScore = calculateScore(isCorrect, responseTime, levelManager.combo, currentDifficulty.value, false)
  const score = Math.round(baseScore * gameStore.difficultyConfig.scoreMultiplier)

  // 通过 LevelManager 更新状态（单一数据源）
  const status = levelManager.handleAnswer(isCorrect, responseTime, score)

  // 追踪连续答错
  if (isCorrect) {
    consecutiveWrong.value = 0
  } else {
    consecutiveWrong.value++
  }

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
  persistAchievementContext()

  // Determine correct answer based on question type
  const correctAnswerForType = ['choice_cn2en', 'spell_hint', 'spell_full', 'translate'].includes(currentQuestionType.value)
    ? currentQuizData.value?.word || ''
    : currentQuizData.value?.meaning || ''

  // 提交答题记录到后端（异步，不阻塞）
  submitQuizRecord({
    wordId: currentQuizData.value?._id || 'unknown',
    word: currentQuizData.value?.word || '',
    questionType: currentQuestionType.value,
    isCorrect,
    responseTime,
    difficulty: currentDifficulty.value,
    hintUsed: false,
    npcInteraction: false,
    sessionId: levelManager.sessionId,
    chapter: hudData.chapter,
    level: hudData.level,
    playerAnswer: answer,
    correctAnswer: correctAnswerForType
  }).then(res => {
    if (res?.data?.adaptiveDifficulty) {
      const ad = res.data.adaptiveDifficulty
      adaptiveQuestionType.value = ad.questionType || 'choice_en2cn'
    }
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
  achievementContext.npcChats++
  scoreSystem.checkAchievements(achievementContext)
  persistAchievementContext()
  eventBus.emit(EVENTS.CHAT_CLOSED)
}

function onUpdateHud(data) {
  if (data.lives !== undefined) hudData.lives = data.lives
  if (data.maxLives !== undefined) hudData.maxLives = data.maxLives
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
  persistAchievementContext()

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
  showBossQuiz.value = false
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

.difficulty-hud-badge {
  background: rgba(255, 200, 71, 0.2);
  border: 1px solid #ffc847;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: #ffc847;
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

/* 排行榜浮窗 */
.leaderboard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(45, 80, 22, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
}

.leaderboard-panel {
  position: relative;
  width: 500px;
  max-width: 95%;
  max-height: 80vh;
  overflow-y: auto;
  border-radius: 12px;
  border: 3px solid #8b6914;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.leaderboard-close {
  position: absolute;
  top: 12px;
  right: 12px;
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
  z-index: 10;

  &:hover {
    background: #e06b4e;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
