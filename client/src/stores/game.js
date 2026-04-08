import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProgress, saveProgress } from '@/api/game'

const DIFFICULTY_CONFIGS = {
  easy:   { lives: 4, timer: 35000, scoreMultiplier: 0.8, monsterMod: -2 },
  normal: { lives: 3, timer: 30000, scoreMultiplier: 1.0, monsterMod: 0 },
  hard:   { lives: 2, timer: 20000, scoreMultiplier: 1.5, monsterMod: 3 }
}

export const useGameStore = defineStore('game', () => {
  // 当前游戏状态
  const currentChapter = ref(1)
  const currentLevel = ref(1)
  const lives = ref(3)
  const score = ref(0)
  const combo = ref(0)
  const maxCombo = ref(0)
  const correctCount = ref(0)
  const wrongCount = ref(0)
  const currentDifficulty = ref(1)

  // 难度系统
  const savedDifficulty = localStorage.getItem('wordquest:difficulty')
  const selectedDifficulty = ref(
    (savedDifficulty && ['easy', 'normal', 'hard'].includes(savedDifficulty)) ? savedDifficulty : 'normal'
  )
  const difficultyConfig = computed(() => DIFFICULTY_CONFIGS[selectedDifficulty.value] || DIFFICULTY_CONFIGS.normal)

  // 进度数据
  const progress = ref(null)
  const unlockedChapters = ref([1])
  const achievements = ref([])

  // 当前关卡的词汇列表
  const currentWords = ref([])
  const currentWordIndex = ref(0)

  const currentWord = computed(() => currentWords.value[currentWordIndex.value] || null)
  const levelProgress = computed(() => {
    if (currentWords.value.length === 0) return 0
    return Math.round((currentWordIndex.value / currentWords.value.length) * 100)
  })

  function resetLevel() {
    lives.value = difficultyConfig.value.lives
    score.value = 0
    combo.value = 0
    maxCombo.value = 0
    correctCount.value = 0
    wrongCount.value = 0
    currentWordIndex.value = 0
  }

  function onCorrectAnswer(points) {
    correctCount.value++
    combo.value++
    if (combo.value > maxCombo.value) maxCombo.value = combo.value
    score.value += points
  }

  function onWrongAnswer() {
    wrongCount.value++
    combo.value = 0
    lives.value = Math.max(0, lives.value - 1)
  }

  function nextWord() {
    if (currentWordIndex.value < currentWords.value.length - 1) {
      currentWordIndex.value++
      return true
    }
    return false // 关卡结束
  }

  async function loadProgress() {
    const res = await getProgress()
    progress.value = res.data
    if (res.data) {
      unlockedChapters.value = res.data.unlockedChapters || [1]
      achievements.value = res.data.achievements || []
    }
  }

  async function saveLevelResult(chapter, level, stars, levelScore, sessionId) {
    await saveProgress({ chapter, level, stars, score: levelScore, sessionId })
  }

  function resetAll() {
    currentChapter.value = 1
    currentLevel.value = 1
    lives.value = 3
    score.value = 0
    combo.value = 0
    maxCombo.value = 0
    correctCount.value = 0
    wrongCount.value = 0
    currentDifficulty.value = 1
    selectedDifficulty.value = 'normal'
    progress.value = null
    unlockedChapters.value = [1]
    achievements.value = []
    currentWords.value = []
    currentWordIndex.value = 0
  }

  return {
    currentChapter, currentLevel, lives, score, combo, maxCombo,
    correctCount, wrongCount, currentDifficulty,
    selectedDifficulty, difficultyConfig,
    progress, unlockedChapters, achievements,
    currentWords, currentWordIndex, currentWord, levelProgress,
    resetLevel, onCorrectAnswer, onWrongAnswer, nextWord,
    loadProgress, saveLevelResult, resetAll
  }
})
