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

  /**
   * 教程模式：99命、60秒
   */
  setTutorialMode() {
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
  getLevelResult() {
    const totalTime = Date.now() - this.startTime
    const correctRate = this.words.length > 0
      ? Math.min(this.correctCount / this.words.length, 1.0)
      : 0
    const avgTime = this.words.length > 0
      ? totalTime / this.words.length
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
      bossDefeated: this.bossDefeated
    }
  }
}

export default new LevelManager()
