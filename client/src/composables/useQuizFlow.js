/**
 * useQuizFlow — 答题流程管理
 * 处理：显示题目 → 提交答案 → 更新HUD → 提交记录 → 掌握度更新
 */
import { ref, reactive } from 'vue'
import eventBus, { EVENTS } from '@/game/systems/EventBus'
import levelManager from '@/game/systems/LevelManager'
import { submitQuizRecord } from '@/api/learning'
import { updateWordMastery } from '@/api/game'
import { getQuizForWord } from '@/api/vocabulary'
import { getSelectedWordbook } from '@/api/vocabulary'
import { DEATH_SPIRAL, QUESTION_TYPES } from '@/game/config/gameConstants'
import { calculateScore, shuffle, buildChoiceOptions } from '@/utils/helpers'
import { enqueue } from '@/utils/offlineQueue'
import audioManager from '@/game/systems/AudioManager'

export function useQuizFlow(hudData, levelWordsRef, gameStore) {
  const showQuiz = ref(false)
  const currentQuizData = ref(null)
  const currentDifficulty = ref(1)
  const currentMonsterIndex = ref(-1)
  const pendingWrongAnswer = ref(false)
  const consecutiveWrong = ref(0)
  const currentQuestionType = ref('choice_en2cn')
  const adaptiveQuestionType = ref('choice_en2cn')
  const latestAdaptiveDifficulty = ref(null)
  // 答错→NPC对话→关闭后自动重出题标记
  const retryQuizAfterChat = ref(false)

  /** 死亡螺旋保护 + 题型选择 */
  function selectQuestionType() {
    if (consecutiveWrong.value >= DEATH_SPIRAL.forceEasyThreshold) {
      currentQuestionType.value = DEATH_SPIRAL.downgradeType
      currentDifficulty.value = DEATH_SPIRAL.forcedDifficulty
      const granted = levelManager.grantGraceLife()
      if (granted && hudData) hudData.lives = levelManager.lives
    } else if (consecutiveWrong.value >= DEATH_SPIRAL.downgradeThreshold) {
      const adaptive = adaptiveQuestionType.value || 'choice_en2cn'
      const typeConfig = QUESTION_TYPES[adaptive]
      currentQuestionType.value = (typeConfig && !typeConfig.isChoice) ? DEATH_SPIRAL.downgradeType : adaptive
    } else {
      currentQuestionType.value = adaptiveQuestionType.value || 'choice_en2cn'
    }
  }

  /** 从API获取题目+干扰项，失败则fallback到本地 */
  async function fetchQuizData(data) {
    const word = levelManager.getCurrentWord()
    if (!word) {
      eventBus.emit(EVENTS.RESUME_GAME)
      return null
    }

    try {
      if (word._id) {
        const res = await getQuizForWord(word._id, currentQuestionType.value)
        if (res.data) {
          const { question, distractors } = res.data
          return buildQuizFromApi(question, distractors, data, word)
        }
      }
    } catch (e) {
      console.warn('从API获取题目失败，使用本地生成:', e)
    }
    return buildQuizLocal(word, data)
  }

  function buildQuizFromApi(question, distractors, eventData, word) {
    const qt = currentQuestionType.value
    let options

    if (qt === 'choice_cn2en') {
      options = [
        { id: question._id, text: question.word, correct: true },
        ...distractors.map(d => ({ id: d.id, text: d.word, correct: false }))
      ]
      if (options.length < 4) {
        const other = levelWordsRef.value.filter(w => w.word !== question.word)
        options = buildChoiceOptions(question._id, question.word, other, 'word')
      }
    } else if (['spell_hint', 'spell_full', 'translate'].includes(qt)) {
      options = []
    } else {
      options = [
        { id: question._id, text: question.meaning, correct: true },
        ...distractors.map(d => ({ id: d.id, text: d.meaning, correct: false }))
      ]
      if (options.length < 4) {
        const other = levelWordsRef.value.filter(w => w.word !== question.word && w.meaning !== question.meaning)
        options = buildChoiceOptions(question._id, question.meaning, other, 'meaning')
      }
    }

    return {
      _id: question._id, word: question.word, meaning: question.meaning,
      phonetic: question.phonetic, example: question.example,
      exampleTranslation: question.exampleTranslation,
      rootAnalysis: question.rootAnalysis || '', memoryTip: question.memoryTip || '',
      synonyms: question.synonyms || [], antonyms: question.antonyms || [],
      category: question.category || '', difficulty: question.difficulty || word?.difficulty || 1,
      options: shuffle(options),
      chapter: eventData.chapter, level: eventData.level
    }
  }

  function buildQuizLocal(word, eventData) {
    const qt = currentQuestionType.value
    const otherWords = levelWordsRef.value.filter(w => w.word !== word.word)

    const base = { ...word, chapter: eventData.chapter, level: eventData.level, difficulty: word.difficulty || 1 }

    if (qt === 'choice_cn2en') {
      return { ...base, options: buildChoiceOptions('correct', word.word, otherWords, 'word') }
    }
    if (['spell_hint', 'spell_full', 'translate'].includes(qt)) {
      return { ...base, options: [] }
    }
    const otherMeanings = levelWordsRef.value.filter(w => w.word !== word.word && w.meaning !== word.meaning)
    return { ...base, options: buildChoiceOptions('correct', word.meaning, otherMeanings, 'meaning') }
  }

  /** 怪物碰撞 → 显示答题弹窗 */
  async function onShowQuiz(data) {
    currentMonsterIndex.value = data?.monsterIndex ?? -1
    audioManager.pauseBGM(300, 'quiz')

    selectQuestionType()
    const quizData = await fetchQuizData(data)
    if (!quizData) return

    // 防御：题目数据必须至少有 word 或 meaning，避免空弹窗
    if (!quizData.word && !quizData.meaning) {
      console.warn('[useQuizFlow] onShowQuiz blocked — empty quiz data')
      eventBus.emit(EVENTS.RESUME_GAME)
      return
    }

    currentQuizData.value = quizData
    currentDifficulty.value = quizData.difficulty || 1
    showQuiz.value = true
  }

  /** 处理答题结果 */
  async function handleQuizAnswer(result, achievementContext, onAchievementUpdate) {
    const {
      isCorrect, responseTime, answer,
      answerQuality = isCorrect ? 'exact' : 'wrong',
      editDistance = null, similarity = isCorrect ? 1 : 0,
      scoreRatio = isCorrect ? 1 : 0, fuzzyFeedback = ''
    } = result

    const baseScore = calculateScore(isCorrect, responseTime, levelManager.combo, currentDifficulty.value, false, scoreRatio)
    const score = Math.round(baseScore * (gameStore?.difficultyConfig?.scoreMultiplier || 1))
    const correctAnswerForType = ['choice_cn2en', 'spell_hint', 'spell_full', 'translate'].includes(currentQuestionType.value)
      ? currentQuizData.value?.word || ''
      : currentQuizData.value?.meaning || ''

    const status = levelManager.handleAnswer(isCorrect, responseTime, score)

    isCorrect ? consecutiveWrong.value = 0 : consecutiveWrong.value++

    if (isCorrect) {
      gameStore?.onCorrectAnswer(score)
    } else {
      gameStore?.onWrongAnswer()
    }

    if (hudData) {
      hudData.lives = levelManager.lives
      hudData.score = levelManager.score
      hudData.combo = levelManager.combo
    }

    eventBus.emit(EVENTS.QUIZ_ANSWERED, {
      monsterIndex: currentMonsterIndex.value,
      isCorrect, score, totalScore: levelManager.score,
      combo: levelManager.combo, lives: levelManager.lives,
      progress: levelManager.getProgress(),
      gameOver: status === 'game_over'
    })

    if (isCorrect) {
      levelManager.nextWord()
      if (achievementContext) {
        achievementContext.wordsLearned++
        if (responseTime < achievementContext.fastestCorrect || achievementContext.fastestCorrect === 0) {
          achievementContext.fastestCorrect = responseTime
        }
      }
    } else if (status !== 'game_over') {
      pendingWrongAnswer.value = true
      retryQuizAfterChat.value = true  // 关闭NPC对话后自动重出题
    }

    if (achievementContext) {
      achievementContext.maxCombo = Math.max(achievementContext.maxCombo, levelManager.combo)
    }
    if (onAchievementUpdate) onAchievementUpdate()

    // 提交答题记录
    submitQuizRecordAsync(isCorrect, responseTime, answer, answerQuality, editDistance, similarity, scoreRatio, fuzzyFeedback, correctAnswerForType)

    // 更新逐词掌握度
    updateWordMasteryAsync(isCorrect, responseTime, answerQuality)

    if (status === 'game_over') {
      showQuiz.value = false
      audioManager.resumeBGM(0, 'quiz')
      pendingWrongAnswer.value = false
      return { isGameOver: true, answerQuality, editDistance, similarity, fuzzyFeedback, correctAnswerForType }
    }
    return { isGameOver: false, answerQuality, editDistance, similarity, fuzzyFeedback, correctAnswerForType }
  }

  async function submitQuizRecordAsync(isCorrect, responseTime, answer, answerQuality, editDistance, similarity, scoreRatio, fuzzyFeedback, correctAnswerForType) {
    const payload = {
      wordId: currentQuizData.value?._id || 'unknown',
      word: currentQuizData.value?.word || '',
      questionType: currentQuestionType.value,
      isCorrect, responseTime, difficulty: currentDifficulty.value,
      hintUsed: false, npcInteraction: false,
      sessionId: levelManager.sessionId,
      chapter: hudData?.chapter, level: hudData?.level,
      playerAnswer: answer, correctAnswer: correctAnswerForType,
      answerQuality, editDistance, similarity, scoreRatio, fuzzyFeedback
    }
    try {
      const res = await submitQuizRecord(payload)
      if (res?.data?.adaptiveDifficulty) {
        const ad = res.data.adaptiveDifficulty
        latestAdaptiveDifficulty.value = ad
        adaptiveQuestionType.value = ad.questionType || 'choice_en2cn'
      }
    } catch (e) {
      console.warn('提交答题记录失败，加入离线队列:', e.message)
      enqueue('submitQuizRecord', payload)
    }
  }

  async function updateWordMasteryAsync(isCorrect, responseTime, answerQuality) {
    const payload = {
      wordId: currentQuizData.value?._id,
      chapterId: hudData?.chapter, levelId: hudData?.level,
      wordbookId: getSelectedWordbook(),
      questionType: currentQuestionType.value,
      isCorrect, responseTime, answerQuality,
      errorType: answerQuality === 'near' ? 'spelling_near' : (isCorrect ? 'unknown' : 'other'),
      sourceMode: 'mainline', sessionId: levelManager.sessionId
    }
    try {
      await updateWordMastery(payload)
    } catch (e) {
      console.warn('更新单词掌握度失败，加入离线队列:', e.message)
      enqueue('updateWordMastery', payload)
    }
  }

  function closeQuiz() {
    showQuiz.value = false
    return {
      hasPendingWrong: pendingWrongAnswer.value,
      clearPendingWrong: () => { pendingWrongAnswer.value = false }
    }
  }

  function getChatContext(answerData) {
    return {
      currentWord: currentQuizData.value?.word || '',
      correctAnswer: answerData?.correctAnswerForType || '',
      playerAnswer: answerData?.answer || '',
      answerQuality: answerData?.answerQuality || '',
      editDistance: answerData?.editDistance,
      similarity: answerData?.similarity || 0,
      fuzzyFeedback: answerData?.fuzzyFeedback || '',
      wordKnowledge: {
        rootAnalysis: currentQuizData.value?.rootAnalysis || '',
        memoryTip: currentQuizData.value?.memoryTip || '',
        example: currentQuizData.value?.example || '',
        exampleTranslation: currentQuizData.value?.exampleTranslation || '',
        synonyms: currentQuizData.value?.synonyms || [],
        antonyms: currentQuizData.value?.antonyms || [],
        category: currentQuizData.value?.category || ''
      },
      triggerType: 'wrong_answer',
      wrongStreak: consecutiveWrong.value
    }
  }

  function reset() {
    showQuiz.value = false
    currentQuizData.value = null
    pendingWrongAnswer.value = false
    consecutiveWrong.value = 0
    currentMonsterIndex.value = -1
    latestAdaptiveDifficulty.value = null
    retryQuizAfterChat.value = false
  }

  // reactive() 包裹确保模板中 ref 自动解包（vue3 只对 reactive 属性自动 unwrap）
  return reactive({
    showQuiz, currentQuizData, currentDifficulty, currentMonsterIndex,
    pendingWrongAnswer, consecutiveWrong, currentQuestionType,
    adaptiveQuestionType, latestAdaptiveDifficulty, retryQuizAfterChat,
    onShowQuiz, handleQuizAnswer, closeQuiz, getChatContext, reset
  })
}
