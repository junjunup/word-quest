/**
 * 关卡管理器
 * 管理关卡配置、词汇加载、进度追踪
 */
import eventBus, { EVENTS } from './EventBus'

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
  }

  /**
   * 初始化关卡
   */
  initLevel(chapter, level, words) {
    this.currentChapter = chapter
    this.currentLevel = level
    this.words = words
    this.currentWordIndex = 0
    this.lives = 3
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.correctCount = 0
    this.wrongCount = 0
    this.startTime = Date.now()
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  getCurrentWord() {
    return this.words[this.currentWordIndex] || null
  }

  getTotalWords() {
    return this.words.length
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

    // 更新HUD
    eventBus.emit(EVENTS.UPDATE_HUD, {
      lives: this.lives,
      score: this.score,
      combo: this.combo,
      progress: this.getProgress()
    })

    // 检查生命
    if (this.lives <= 0) {
      eventBus.emit(EVENTS.GAME_OVER, this.getLevelResult())
      return 'game_over'
    }

    return 'continue'
  }

  /**
   * 前进到下一个词
   */
  nextWord() {
    this.currentWordIndex++
    if (this.currentWordIndex >= this.words.length) {
      eventBus.emit(EVENTS.LEVEL_COMPLETE, this.getLevelResult())
      return false // 关卡完成
    }
    return true // 还有词
  }

  /**
   * 获取关卡结果
   */
  getLevelResult() {
    const totalTime = Date.now() - this.startTime
    const correctRate = this.words.length > 0
      ? this.correctCount / this.words.length
      : 0
    const avgTime = this.words.length > 0
      ? totalTime / this.words.length
      : 0

    // 计算星级 (0-3星)
    let stars = 0
    if (correctRate >= 0.95 && avgTime < 8000 && this.lives === 3) stars = 3
    else if (correctRate >= 0.8 && this.lives >= 2) stars = 2
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
      sessionId: this.sessionId
    }
  }
}

export default new LevelManager()
