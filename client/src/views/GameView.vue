<template>
  <div class="game-view">
    <!-- Phaser游戏容器 -->
    <div id="phaser-container" ref="phaserContainer"></div>

    <!-- HUD + 暂停菜单 -->
    <GameHUD
      :visible="showHud && uiState === 'game'"
      :in-game-level="inGameLevel"
      :is-tutorial-level="isTutorialLevel"
      :difficulty="gameStore.selectedDifficulty"
      :show-pause="showPauseMenu"
      :is-muted="isMuted"
      :hud-data="hudData"
      @open-chat="openManualChat"
      @go-dashboard="goToDashboard"
      @toggle-pause="onTogglePause"
      @toggle-mute="toggleMute"
      @back-to-menu="backToMenu"
      @logout="handleLogout"
    />

    <!-- 关卡选择 -->
    <LevelSelect
      v-if="uiState === 'levelSelect'"
      @start="onLevelSelectStart"
      @back="onLevelSelectBack"
    />

    <!-- 游戏交互式引导（叠加在游戏画面上） -->
    <GameIntro
      v-if="showTutorial"
      :is-tutorial="isTutorialLevel"
      @dismiss="onIntroDismiss"
    />

    <!-- 角色选择 -->
    <CharacterSelect
      v-if="uiState === 'characterSelect'"
      @confirm="onCharacterConfirm"
      @back="onCharacterBack"
    />

    <!-- 排行榜浮窗 -->
    <div class="leaderboard-overlay" v-if="uiState === 'leaderboard'" @click.self="closeLeaderboard">
      <div class="leaderboard-panel">
        <button class="leaderboard-close" @click="closeLeaderboard">✕</button>
        <ScoreBoard />
      </div>
    </div>

    <!-- 答题弹窗 -->
    <QuizModal
      v-if="quiz.showQuiz"
      :word-data="quiz.currentQuizData"
      :difficulty="quiz.currentDifficulty"
      :question-type="quiz.currentQuestionType"
      :time-limit="gameStore.difficultyConfig.timer"
      :adaptive-difficulty="quiz.latestAdaptiveDifficulty"
      @answer="onQuizAnswer"
      @close="onQuizClose"
    />

    <!-- 移动端虚拟方向键 -->
    <div
      v-if="showVirtualControls"
      class="virtual-controls"
      aria-label="移动方向键"
    >
      <button class="vc-btn up" aria-label="向上" @pointerdown.prevent="setVirtualDirection('up', true)" @pointerup.prevent="setVirtualDirection('up', false)" @pointerleave="setVirtualDirection('up', false)">▲</button>
      <button class="vc-btn left" aria-label="向左" @pointerdown.prevent="setVirtualDirection('left', true)" @pointerup.prevent="setVirtualDirection('left', false)" @pointerleave="setVirtualDirection('left', false)">◀</button>
      <button class="vc-btn down" aria-label="向下" @pointerdown.prevent="setVirtualDirection('down', true)" @pointerup.prevent="setVirtualDirection('down', false)" @pointerleave="setVirtualDirection('down', false)">▼</button>
      <button class="vc-btn right" aria-label="向右" @pointerdown.prevent="setVirtualDirection('right', true)" @pointerup.prevent="setVirtualDirection('right', false)" @pointerleave="setVirtualDirection('right', false)">▶</button>
    </div>

    <!-- Boss答题弹窗 -->
    <BossQuizModal
      v-if="showBossQuiz"
      :boss-name="bossQuizData.bossName"
      :boss-hp="bossQuizData.questionsNeeded"
      :boss-current-hp="bossQuizData.bossCurrentHp"
      :boss-max-hp="bossQuizData.bossMaxHp"
      :time-limit="gameStore.difficultyConfig.timer"
      :level-words="levelWords"
      :question-type="quiz.currentQuestionType"
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
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
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
import GameHUD from '@/components/GameHUD.vue'
import { submitQuizRecord } from '@/api/learning'
import { saveAchievement, getAdaptiveWords, updateWordMastery } from '@/api/game'
import { getChapterLevelWords, getChapterWords, getSelectedWordbook } from '@/api/vocabulary'
import { STORAGE_KEYS } from '@/game/config/gameConstants'
import { safeGetJSON, safeSetJSON, safeGetItem, safeSetItem } from '@/utils/helpers'
import { flushQueue, getQueueSize } from '@/utils/offlineQueue'
import scoreSystem from '@/game/systems/ScoreSystem'
import audioManager from '@/game/systems/AudioManager'
import { useQuizFlow } from '@/composables/useQuizFlow'

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
let chatSafetyTimer = null

// UI状态机: 'game' | 'levelSelect' | 'characterSelect' | 'intro' | 'leaderboard'
const uiState = ref('game')

const showHud = ref(true)
const inGameLevel = ref(false)
const showBossQuiz = ref(false)
const showChatPanel = ref(false)
const showPauseMenu = ref(false)
const achievementData = ref(null)
const showTutorial = ref(false)
const isTutorialLevel = ref(false)
const loadError = ref('')

// HUD 数据（必须在 useQuizFlow 之前定义 — composable 依赖此对象）
const hudData = reactive({
  lives: 3,
  maxLives: 3,
  score: 0,
  combo: 0,
  chapter: 1,
  level: 1
})

// 关卡词汇列表（从 API 加载）— 必须在 useQuizFlow 之前定义
const levelWords = ref([])

// 使用答题流程 composable（hudData + levelWords 已在上面定义，可安全传入）
const quiz = useQuizFlow(hudData, levelWords, gameStore)

const virtualDirection = reactive({ up: false, down: false, left: false, right: false })
const showVirtualControls = computed(() => uiState.value === 'game' && inGameLevel.value && !quiz.showQuiz.value && !showBossQuiz.value && !showChatPanel.value && !showPauseMenu.value)

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

const chatContext = reactive({
  currentWord: '',
  playerLevel: 1,
  correctStreak: 0,
  wrongStreak: 0,
  chapterName: '初入大陆',
  triggerType: 'manual',
  correctAnswer: '',
  playerAnswer: '',
  answerQuality: '',
  editDistance: null,
  similarity: 0,
  fuzzyFeedback: '',
  wordKnowledge: {}
})

/**
 * 加载指定 chapter/level 的词汇并初始化 LevelManager
 */
async function loadWordsAndInitLevel(chapter, level) {
  levelWords.value = []
  loadError.value = ''

  // 先加载完整词汇数据（含 meaning, phonetic, example, options 等）
  try {
    const res = await getChapterLevelWords(chapter, level)
    if (res.data && res.data.length > 0) {
      levelWords.value = res.data
    }
  } catch (e) {
    console.warn('加载词汇失败:', e)
  }

  // Fallback 链
  if (levelWords.value.length === 0) {
    try {
      const res = await getChapterLevelWords(chapter, 0)
      if (res.data && res.data.length > 0) levelWords.value = res.data
    } catch (e) { console.warn('加载章节通用词汇失败:', e) }
  }

  if (levelWords.value.length === 0) {
    try {
      const res = await getChapterWords(chapter)
      if (res.data) levelWords.value = res.data.slice(0, 10)
    } catch (e) { console.warn('Fallback 加载失败:', e) }
  }

  if (levelWords.value.length === 0) {
    loadError.value = '词汇加载失败，请检查网络连接'
    console.error('所有词汇加载方式均失败')
  }

  // 并行获取自适应推荐排序（不影响主流程）
  if (levelWords.value.length > 0) {
    try {
      const adaptiveRes = await getAdaptiveWords(chapter, level, levelWords.value.length, getSelectedWordbook())
      if (adaptiveRes?.data?.words && adaptiveRes.data.words.length > 0) {
        // 以自适应推荐的 wordId 顺序重新排列词汇
        const priorityMap = new Map()
        adaptiveRes.data.words.forEach((item, idx) => {
          priorityMap.set(String(item.wordId), idx)
        })
        levelWords.value.sort((a, b) => {
          const pa = priorityMap.get(String(a._id))
          const pb = priorityMap.get(String(b._id))
          if (pa !== undefined && pb !== undefined) return pa - pb
          if (pa !== undefined) return -1
          if (pb !== undefined) return 1
          return 0
        })
      }
    } catch (e) {
      // 自适应API失败 → 保持原有顺序，不影响游戏
      console.warn('自适应排序获取失败，使用默认顺序:', e.message)
    }
  }

  const difficulty = gameStore.selectedDifficulty
  levelManager.initLevel(chapter, level, levelWords.value, difficulty)
}

/**
 * WorldScene 启动新关卡时触发
 * 注意：如果 startGameLevel() 已经预加载了词汇并初始化了 LevelManager，
 * 此处不再重复调用 loadWordsAndInitLevel，避免清空词汇、重置 sessionId/生命/分数。
 */
async function onStartLevel(data) {
  const { chapter, level, isTutorial } = data
  inGameLevel.value = true  // 进入关卡，显示 HUD
  hudData.chapter = chapter
  hudData.level = level
  hudData.maxLives = gameStore.difficultyConfig.lives
  hudData.lives = gameStore.difficultyConfig.lives
  isTutorialLevel.value = !!isTutorial

  // 仅在词汇尚未加载时（如 continueGame 直接进入场景）才重新加载
  const alreadyLoaded = levelWords.value.length > 0
    && levelManager.currentChapter === chapter
    && levelManager.currentLevel === level
  if (!alreadyLoaded) {
    await loadWordsAndInitLevel(chapter, level)
  }

  if (isTutorial) {
    levelManager.setTutorialMode()
    hudData.maxLives = 99
    hudData.lives = 99
  }
}

// --- UI Panel Event Handlers ---

/**
 * 当 Vue 层 overlay（关卡选择/角色选择/排行榜等）覆盖在 Phaser canvas 上方时，
 * 必须禁用 Phaser 的输入系统，否则鼠标事件会穿透 Vue 层到达底层 canvas。
 * 这是导致"点简单跳排行榜"等幽灵点击 bug 的根本原因。
 */
function setPhaserInputEnabled(enabled) {
  if (!game) return
  const scenes = ['MenuScene', 'WorldScene', 'ResultScene', 'BootScene']
  for (const name of scenes) {
    const scene = game.scene.getScene(name)
    if (scene && scene.scene.isActive()) {
      scene.input.enabled = enabled
    }
  }
}

function onShowLevelSelect(data) {
  uiState.value = 'levelSelect'
  setPhaserInputEnabled(false)
}

function onShowCharacterSelect() {
  uiState.value = 'characterSelect'
  setPhaserInputEnabled(false)
}

function onShowLeaderboard() {
  uiState.value = 'leaderboard'
  setPhaserInputEnabled(false)
}

function closeLeaderboard() {
  uiState.value = 'game'
  setPhaserInputEnabled(true)
}


async function onLevelSelectStart({ chapter, level, difficulty }) {
  gameStore.selectedDifficulty = difficulty
  // Persist difficulty preference to localStorage
  safeSetItem(STORAGE_KEYS.difficulty, difficulty)
  pendingLevelParams.value = { chapter, level, difficulty }

  // Check if we should show intro
  const skipIntro = safeGetItem(STORAGE_KEYS.skipIntro) === 'true'
  if (skipIntro) {
    await startGameLevel()
  } else {
    // 先启动游戏，然后叠加交互式引导
    await startGameLevel()
    // 只有成功启动后才显示教程；如果 startGameLevel 失败并回退到 levelSelect，不显示
    if (uiState.value === 'game') {
      showTutorial.value = true
    }
  }
}
function onLevelSelectBack() {
  uiState.value = 'game'
  setPhaserInputEnabled(true)
}

function onIntroDismiss() {
  showTutorial.value = false
}

function onCharacterConfirm() {
  uiState.value = 'game'
  setPhaserInputEnabled(true)
}

function onCharacterBack() {
  uiState.value = 'game'
  setPhaserInputEnabled(true)
}

async function startGameLevel() {
  uiState.value = 'game'
  setPhaserInputEnabled(true)
  const params = pendingLevelParams.value
  if (!params) return

  try {
    // 预先加载词汇，如果失败则阻止关卡启动
    await loadWordsAndInitLevel(params.chapter, params.level)
    if (levelWords.value.length === 0) {
      alert('词汇加载失败，请检查网络连接后重试')
      uiState.value = 'levelSelect'
      setPhaserInputEnabled(false)
      return
    }

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
      // Stop all active scenes first
      const sceneNames = ['MenuScene', 'WorldScene', 'ResultScene', 'BootScene']
      for (const sceneName of sceneNames) {
        const scene = game.scene.getScene(sceneName)
        if (scene && scene.scene.isActive()) {
          scene.scene.stop()
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50))
      // 使用 game.scene.start（而非已停止的 scene.scene.start）确保数据正确传递
      game.scene.start('WorldScene', {
        chapter: params.chapter,
        level: params.level,
        difficulty: params.difficulty
      })
    }
  } catch (err) {
    console.error('启动关卡失败:', err)
    alert('启动关卡失败：' + (err?.message || '未知错误'))
    // 回退到关卡选择界面，不要留在空白画面
    uiState.value = 'levelSelect'
    setPhaserInputEnabled(false)
  }
}

// --- Boss Quiz Handlers ---

function onShowBossQuiz(data) {
  bossQuizData.bossName = data.bossName || '👹 BOSS'
  bossQuizData.questionsNeeded = data.questionsNeeded || 1
  bossQuizData.bossCurrentHp = data.bossCurrentHp || 0
  bossQuizData.bossMaxHp = data.bossMaxHp || 0
  bossQuizData.timeLimit = data.timeLimit || gameStore.difficultyConfig.timer
  audioManager.pauseBGM(300, 'boss_quiz')
  showBossQuiz.value = true
}

function onBossQuizComplete(result) {
  showBossQuiz.value = false
  audioManager.resumeBGM(300, 'boss_quiz')
  // 先 emit 让 WorldScene 处理扣血逻辑
  eventBus.emit(EVENTS.BOSS_QUIZ_RESULT, result)
  // 扣血完成后再同步 HUD（此时 levelManager.lives 已是扣血后的值）
  hudData.lives = levelManager.lives
  hudData.score = levelManager.score
  hudData.combo = levelManager.combo
  gameStore.lives = levelManager.lives

  // 上报 Boss 答题记录到后端（异步，不阻塞）
  if (result.answerRecords && result.answerRecords.length > 0) {
    for (const record of result.answerRecords) {
      submitQuizRecord({
        wordId: record.wordId,
        word: record.word,
        questionType: quiz.currentQuestionType.value,
        isCorrect: record.isCorrect,
        responseTime: record.responseTime,
        difficulty: quiz.currentDifficulty.value,
        hintUsed: false,
        npcInteraction: false,
        sessionId: levelManager.sessionId,
        chapter: hudData.chapter,
        level: hudData.level,
        playerAnswer: record.playerAnswer,
        correctAnswer: record.correctAnswer,
        answerQuality: record.answerQuality,
        editDistance: record.editDistance,
        similarity: record.similarity,
        scoreRatio: record.scoreRatio,
        fuzzyFeedback: record.fuzzyFeedback,
        isBossQuiz: true
      }).catch(err => console.warn('Boss答题记录上报失败:', err))
    }
  }
}

function onBossQuizClose() {
  showBossQuiz.value = false
  audioManager.resumeBGM(300, 'boss_quiz')
  eventBus.emit(EVENTS.BOSS_QUIZ_RESULT, { correctCount: 0, wrongCount: 0, cancelled: true })
}

function onTogglePause() {
  if (uiState.value === 'game' && !quiz.showQuiz.value && !showBossQuiz.value && !showChatPanel.value) {
    showPauseMenu.value = !showPauseMenu.value
    if (showPauseMenu.value) {
      audioManager.pauseBGM(300, 'pause_menu')
    } else {
      audioManager.resumeBGM(300, 'pause_menu')
    }
    // 同步通知 Phaser 场景暂停/恢复，防止暂停菜单下角色继续移动、Boss继续攻击
    if (game) {
      const scene = game.scene.getScene('WorldScene')
      if (scene && scene.scene.isActive()) {
        scene.isPaused = showPauseMenu.value
        // 暂停时也冻结 Boss 行为
        if (scene.boss && !scene.boss.defeated) {
          if (showPauseMenu.value && scene.boss.pauseBehavior) {
            scene.boss.pauseBehavior()
          } else if (!showPauseMenu.value && scene.boss.resumeBehavior) {
            scene.boss.resumeBehavior()
          }
        }
      }
    }
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

  // 初始化 Phaser 游戏（先启动，不阻塞词汇加载）
  if (phaserContainer.value) {
    const config = createGameConfig(phaserContainer.value)
    game = new Phaser.Game(config)
  }

  // 注册事件监听（必须在 Phaser 启动后、词汇加载前注册，否则可能丢事件）
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

  if (new URLSearchParams(window.location.search).get('e2eLevelSelect') === '1') {
    uiState.value = 'levelSelect'
    setPhaserInputEnabled(false)
  }

  // 异步加载词汇并初始化 LevelManager（不阻塞 Phaser 启动）
  loadWordsAndInitLevel(chapter, level).catch(e => console.warn('初始词汇加载失败:', e))

  // 浏览器关闭/刷新时提示
  window.addEventListener('beforeunload', onBeforeUnload)

  // 网络恢复时自动刷新离线队列
  window.addEventListener('wordquest:online', () => {
    flushQueue(
      (payload) => submitQuizRecord(payload),
      (payload) => updateWordMastery(payload)
    ).then(() => {
      if (getQueueSize() === 0) {
        console.log('📡 离线队列已全部同步')
      }
    }).catch(() => {})
  })

  // 页面加载时尝试刷新遗留的离线队列
  if (getQueueSize() > 0) {
    console.log(`📡 发现 ${getQueueSize()} 条离线记录，尝试同步...`)
    flushQueue(
      (payload) => submitQuizRecord(payload),
      (payload) => updateWordMastery(payload)
    ).catch(() => {})
  }
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

  // 清理安全计时器
  if (chatSafetyTimer) { clearTimeout(chatSafetyTimer); chatSafetyTimer = null }

  // 移除浏览器关闭拦截
  window.removeEventListener('beforeunload', onBeforeUnload)

  // 销毁Phaser游戏
  if (game) {
    game.destroy(true)
    game = null
  }
})

// 浏览器后退按钮 / 路由离开拦截：关卡进行中时需确认
onBeforeRouteLeave((to, from, next) => {
  if (inGameLevel.value && !showPauseMenu.value) {
    const confirmed = window.confirm('游戏正在进行中，确定要离开吗？进度可能丢失。')
    if (!confirmed) {
      next(false)
      return
    }
  }
  next()
})

// 浏览器关闭/刷新时提示
function onBeforeUnload(e) {
  if (inGameLevel.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

// Quiz flow wrapper — delegates to composable
async function onShowQuiz(data) {
  await quiz.onShowQuiz(data)
}

async function onQuizAnswer(result) {
  const outcome = await quiz.handleQuizAnswer(result, achievementContext, () => {
    scoreSystem.checkAchievements(achievementContext)
    persistAchievementContext()
  })

  if (outcome.isGameOver) {
    showChatPanel.value = false
    audioManager.resumeBGM(0, 'chat')
    return
  }

  if (!outcome.isGameOver && !result.isCorrect) {
    // 答错：准备 chat context
    const ctx = quiz.getChatContext(outcome)
    Object.assign(chatContext, ctx)
  }
}

function onQuizClose() {
  const { hasPendingWrong, clearPendingWrong } = quiz.closeQuiz()

  if (hasPendingWrong) {
    clearPendingWrong()
    audioManager.pauseBGM(300, 'chat')
    showChatPanel.value = true
    chatSafetyTimer = setTimeout(() => {
      if (showChatPanel.value) {
        showChatPanel.value = false
        audioManager.resumeBGM(300, 'chat')
        audioManager.resumeBGM(300, 'quiz')
        eventBus.emit(EVENTS.CHAT_CLOSED)
      }
    }, 60000)
  } else {
    audioManager.resumeBGM(300, 'quiz')
    eventBus.emit(EVENTS.RESUME_GAME)
  }
}

function onShowChat(data) {
  chatContext.triggerType = 'manual'
  chatContext.chapterName = `第${data?.chapter || 1}章`
  audioManager.pauseBGM(300, 'chat')
  showChatPanel.value = true
}

function openManualChat() {
  chatContext.triggerType = 'manual'
  chatContext.currentWord = ''
  audioManager.pauseBGM(300, 'chat')
  showChatPanel.value = true
}

function closeChatPanel() {
  showChatPanel.value = false
  if (chatSafetyTimer) { clearTimeout(chatSafetyTimer); chatSafetyTimer = null }
  audioManager.resumeBGM(300, 'chat')
  audioManager.resumeBGM(300, 'quiz')
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

function setVirtualDirection(direction, active) {
  if (!(direction in virtualDirection)) return
  virtualDirection[direction] = active
  const scene = game?.scene?.getScene('WorldScene')
  if (scene && scene.scene.isActive()) {
    scene.virtualDirection = { ...virtualDirection }
  }
}

async function onLevelComplete(result) {
  console.log('关卡完成:', result)

  // 关闭可能残留的 UI 面板
  showChatPanel.value = false
  quiz.showQuiz.value = false
  showBossQuiz.value = false
  showPauseMenu.value = false
  inGameLevel.value = false  // 离开关卡，隐藏 HUD

  // 更新成就上下文
  achievementContext.levelsCompleted++
  if (result.correctRate >= 100) achievementContext.perfectClears++
  if (result.level >= 5) {
    // 只在首次完成该章最后一关时计数，避免重玩重复累加
    const completedChapters = safeGetJSON('wordquest:completedChapters') || []
    if (!completedChapters.includes(result.chapter)) {
      completedChapters.push(result.chapter)
      safeSetJSON('wordquest:completedChapters', completedChapters)
      achievementContext.chaptersCompleted = completedChapters.length
    }
  }
  scoreSystem.checkAchievements(achievementContext)
  persistAchievementContext()

  // 保存进度到服务器
  try {
    await gameStore.saveLevelResult(result.chapter, result.level, result.stars, result.score, result.sessionId)
  } catch (e) {
    console.warn('保存进度失败:', e)
  }
}

async function onGameOver(result) {
  console.log('游戏结束:', result)
  quiz.showQuiz.value = false
  showBossQuiz.value = false
  showChatPanel.value = false
  showPauseMenu.value = false
  inGameLevel.value = false  // 离开关卡，隐藏 HUD

  // 重置答题状态，防止跨局残留导致下一局异常
  quiz.pendingWrongAnswer.value = false
  quiz.consecutiveWrong.value = 0
  quiz.currentMonsterIndex.value = -1
  virtualDirection.up = false
  virtualDirection.down = false
  virtualDirection.left = false
  virtualDirection.right = false
  audioManager.resumeBGM(0, 'quiz')
  audioManager.resumeBGM(0, 'boss_quiz')
  audioManager.resumeBGM(0, 'chat')
  audioManager.resumeBGM(0, 'pause_menu')
  if (chatSafetyTimer) { clearTimeout(chatSafetyTimer); chatSafetyTimer = null }

  // 保存成就上下文
  persistAchievementContext()

  // 场景跳转由 WorldScene.onGameOver 负责（避免双重跳转竞态）
  // 此处仅做 Vue 层 UI 清理
}

function onShowAchievement(data) {
  achievementData.value = data
  // 将新解锁的成就保存到服务端（异步，不阻塞）
  if (data?.id) {
    saveAchievement({ id: data.id, name: data.name || '', description: data.description || '' })
      .catch(err => console.warn('成就保存失败:', err))
  }
}

function goToDashboard() {
  router.push('/dashboard')
}

async function backToMenu() {
  showPauseMenu.value = false
  quiz.showQuiz.value = false
  showBossQuiz.value = false
  showChatPanel.value = false
  inGameLevel.value = false  // 离开关卡，隐藏 HUD
  quiz.pendingWrongAnswer.value = false
  quiz.consecutiveWrong.value = 0
  quiz.currentMonsterIndex.value = -1
  audioManager.stopBGM(300)
  if (game) {
    const scene = game.scene.getScene('WorldScene')
    if (scene && scene.scene.isActive()) {
      scene.scene.stop()
      await new Promise(resolve => setTimeout(resolve, 50))
      game.scene.start('MenuScene')
    }
  }
}

function handleLogout() {
  showPauseMenu.value = false
  inGameLevel.value = false
  audioManager.stopBGM(0)
  // 清理游戏状态，防止跨账户数据泄漏
  levelManager.initLevel(1, 1, [], 'normal')
  gameStore.resetAll()
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

.virtual-controls {
  position: absolute;
  left: 18px;
  bottom: 18px;
  width: 156px;
  height: 156px;
  z-index: 150;
  display: none;
  grid-template-areas:
    ". up ."
    "left down right";
  grid-template-columns: repeat(3, 48px);
  grid-template-rows: repeat(2, 48px);
  gap: 6px;
  pointer-events: auto;
}

.vc-btn {
  min-width: 48px;
  min-height: 48px;
  border-radius: 12px;
  border: 2px solid rgba(255, 200, 71, 0.75);
  background: rgba(45, 80, 22, 0.78);
  color: #f5edd6;
  font-size: 20px;
  font-weight: bold;
  touch-action: none;
}

.vc-btn.up { grid-area: up; }
.vc-btn.left { grid-area: left; }
.vc-btn.down { grid-area: down; }
.vc-btn.right { grid-area: right; }

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

@media (max-width: 980px) {
  #phaser-container { width: min(100vw, 960px); height: min(66.67vw, 640px); }
  #phaser-container canvas { width: 100% !important; height: 100% !important; }
}

@media (max-width: 760px), (pointer: coarse) {
  .virtual-controls { display: grid; }
}

@media (max-width: 430px) {
  .game-view { overflow: hidden; }
  #phaser-container { border-left: 0; border-right: 0; }
  .virtual-controls { left: 10px; bottom: 10px; transform: scale(0.9); transform-origin: left bottom; }
}
</style>
