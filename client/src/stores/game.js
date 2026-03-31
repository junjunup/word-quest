import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProgress, saveProgress } from '@/api/game'

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
    lives.value = 3
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
    lives.value--
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

  async function saveLevelResult(chapter, level, stars, levelScore) {
    await saveProgress({ chapter, level, stars, score: levelScore })
  }

  return {
    currentChapter, currentLevel, lives, score, combo, maxCombo,
    correctCount, wrongCount, currentDifficulty,
    progress, unlockedChapters, achievements,
    currentWords, currentWordIndex, currentWord, levelProgress,
    resetLevel, onCorrectAnswer, onWrongAnswer, nextWord,
    loadProgress, saveLevelResult
  }
})
