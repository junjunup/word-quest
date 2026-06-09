/**
 * 关卡管理器
 * 管理关卡配置、词汇加载、进度追踪
 */
import eventBus, { EVENTS } from './EventBus'

const DIFFICULTY_CONFIGS = {
  easy:   { lives: 4, timer: 35000, scoreMultiplier: 0.8, monsterMod: -2 },
  normal: { lives: 3, timer: 30000, scoreMultiplier: 1.0, monsterMod: 0 },
  hard:   { lives: 2, timer: 20000, scoreMultiplier: 1.5, monsterMod: 3 }
}

class LevelManager {
  constructor() {
    this.currentChapter = 1
    this.currentLevel = 1
    this.words = []
    this.currentWordIndex = 0
    this.lives = 3
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.correctCount = 0
    this.wrongCount = 0
    this.startTime = 0
    this.sessionId = ''
    this.difficulty = 'normal'
    this.difficultyConfig = DIFFICULTY_CONFIGS.normal
    this.bossDefeated = false
    this.graceLifeUsed = false
    // Cycle 2: 学习度量追踪（双轨展示用）
    this.recallCount = 0        // 主动回忆题数（拼写/翻译）
    this.recognitionCount = 0   // 再认题数（选择）
    this.downgradedCount = 0    // 降级题数
    this.answerQualityScores = [] // 每题 quality 值（0-1），用于计算掌握度
  }

  /**
   * 恩赐生命：连续答错3次且只剩1命时，赠送1条命（每关仅一次）
   */
  grantGraceLife() {
    if (!this.graceLifeUsed && this.lives <= 1) {
      this.lives++
      this.graceLifeUsed = true
      eventBus.emit(EVENTS.UPDATE_HUD, { lives: this.lives })
      return true
    }
    return false
  }

  // 死亡前挨救判定（修复时序 bug）：未用过恩赐生命 + 已无命 + 本关至少答对过1题 + 非教程
  shouldGraceRescue() {
    return !this.graceLifeUsed && this.lives <= 0 && this.correctCount >= 1 && !this.isTutorial
  }

  /**
   * 教程模式：99命、60秒
   */
  setTutorialMode() {
    this.isTutorial = true
    this.lives = 99
    this.difficultyConfig = { ...this.difficultyConfig, lives: 99, timer: 60000 }
  }

  /**
   * 初始化关卡
   */
  initLevel(chapter, level, words, difficulty = 'normal') {
    this.currentChapter = chapter
    this.currentLevel = level
    this.words = words
    this.currentWordIndex = 0
    this.difficulty = difficulty
    this.difficultyConfig = DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS.normal
    this.lives = this.difficultyConfig.lives
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.correctCount = 0
    this.wrongCount = 0
    this.startTime = Date.now()
    this.bossDefeated = false
    this.graceLifeUsed = false
    this.isTutorial = false
    this.recallCount = 0
    this.recognitionCount = 0
    this.downgradedCount = 0
    this.answerQualityScores = []
    this._isAdventure = false
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  getCurrentWord() {
    if (this.words.length === 0) return null
    // Cycle words if index exceeds length (more monsters than words)
    return this.words[this.currentWordIndex % this.words.length] || null
  }

  getTotalWords() {
    return this.words.length
  }

  /**
   * 根据难度计算怪物数量
   */
  getMonsterCount(baseCount) {
    return Math.max(1, Math.min(baseCount + this.difficultyConfig.monsterMod, 15))
  }

  getProgress() {
    const answered = this.correctCount + this.wrongCount
    return {
      current: answered,
      total: this.words.length,
      percent: this.words.length > 0 ? Math.round((answered / this.words.length) * 100) : 0
    }
  }

  /**
   * 处理答题结果
   */
  handleAnswer(isCorrect, responseTime, score) {
    if (isCorrect) {
      this.correctCount++
      this.combo++
      if (this.combo > this.maxCombo) this.maxCombo = this.combo
      this.score += score
    } else {
      this.wrongCount++
      this.combo = 0
      this.lives = Math.max(0, this.lives - 1)
    }

    // 死亡螺旋保护（时序修复）：扣命后已无命但满足挨救条件，则续 1 命。
    // 挨救判定必须在 UPDATE_HUD 之前，以免续命时 HUD 先闪一帧 0 命。
    let rescued = false
    if (this.lives <= 0 && this.shouldGraceRescue()) {
      this.lives = 1
      this.graceLifeUsed = true
      rescued = true
    }

    // 更新HUD（使用挨救后的最终 lives）
    eventBus.emit(EVENTS.UPDATE_HUD, {
      lives: this.lives,
      score: this.score,
      combo: this.combo,
      progress: this.getProgress()
    })

    if (rescued) {
      eventBus.emit(EVENTS.GRACE_RESCUE, { lives: this.lives })
      return 'grace_rescued'
    }

    // 检查生命
    if (this.lives <= 0) {
      eventBus.emit(EVENTS.GAME_OVER, this.getLevelResult())
      return 'game_over'
    }

    return 'continue'
  }

  /**
   * 直接扣血（Boss冲锋/子弹伤害）
   */
  loseLife() {
    this.lives = Math.max(0, this.lives - 1)
    eventBus.emit(EVENTS.UPDATE_HUD, {
      lives: this.lives,
      score: this.score,
      combo: this.combo
    })
    if (this.lives <= 0) {
      eventBus.emit(EVENTS.GAME_OVER, this.getLevelResult())
      return 'game_over'
    }
    return 'continue'
  }

  /**
   * 前进到下一个词
   * 返回 false 表示词汇已全部过一遍（但仍可循环复用）
   */
  nextWord() {
    this.currentWordIndex++
    if (this.currentWordIndex >= this.words.length) {
      return false // 词汇过完一轮，getCurrentWord 会 modulo 循环
    }
    return true
  }

  /**
   * 获取关卡结果
   */
  /**
   * Cycle 2: 追踪每题的学习度量（由 useQuizFlow 调用）
   */
  trackLearningQuality({ isRecall, isDowngraded, answerQuality }) {
    if (isRecall) this.recallCount++
    else this.recognitionCount++
    if (isDowngraded) this.downgradedCount++
    // answerQuality: 'exact'=1, 'near'=0.72, 'wrong'=0
    const scoreMap = { exact: 1, near: 0.72, wrong: 0 }
    this.answerQualityScores.push(scoreMap[answerQuality] ?? (answerQuality === 'correct' ? 0.8 : 0))
  }

  getLevelResult() {
    const totalTime = Date.now() - this.startTime
    const totalAnswered = this.correctCount + this.wrongCount
    const correctRate = totalAnswered > 0
      ? Math.min(this.correctCount / totalAnswered, 1.0)
      : 0
    const avgTime = totalAnswered > 0
      ? totalTime / totalAnswered
      : 0

    // 计算星级 (0-3星)
    let stars = 0
    if (this.lives <= 0) {
      stars = 0  // Game Over 不给星
    } else if (correctRate >= 0.95 && avgTime < 8000 && this.lives === this.difficultyConfig.lives) stars = 3
    else if (correctRate >= 0.8 && this.lives >= Math.ceil(this.difficultyConfig.lives / 2)) stars = 2
    else if (correctRate >= 0.5) stars = 1

    return {
      chapter: this.currentChapter,
      level: this.currentLevel,
      stars,
      score: this.score,
      correctCount: this.correctCount,
      wrongCount: this.wrongCount,
      totalWords: this.words.length,
      correctRate: Math.round(correctRate * 100),
      maxCombo: this.maxCombo,
      totalTime,
      avgTime: Math.round(avgTime),
      livesRemaining: this.lives,
      sessionId: this.sessionId,
      difficulty: this.difficulty,
      scoreMultiplier: this.difficultyConfig.scoreMultiplier,
      bossDefeated: this.bossDefeated,
      isTutorial: !!this.isTutorial,
      // Cycle 2: 学习度量数据（双轨展示）
      recallCount: this.recallCount,
      recognitionCount: this.recognitionCount,
      downgradedCount: this.downgradedCount,
      avgAnswerQuality: this.answerQualityScores.length > 0
        ? Math.round(this.answerQualityScores.reduce((a, b) => a + b, 0) / this.answerQualityScores.length * 100)
        : 0
    }
  }
}

export default new LevelManager()
