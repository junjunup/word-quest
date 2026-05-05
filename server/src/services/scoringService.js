/**
 * 积分计算服务
 */

/**
 * 计算答题得分
 * @param {boolean} isCorrect - 是否正确
 * @param {number} responseTime - 响应时间(ms)
 * @param {number} combo - 当前连击数
 * @param {number} difficulty - 难度等级(1-5)
 * @param {boolean} hintUsed - 是否使用提示
 */
export function calculateQuizScore(isCorrect, responseTime, combo, difficulty, hintUsed = false, scoreRatio = 1) {
  if (!isCorrect) return 0

  const safeScoreRatio = Math.max(0, Math.min(Number(scoreRatio) || 0, 1))

  // 基础分 = 难度 × 100
  let baseScore = difficulty * 100

  // 连击加成(上限50)
  const comboBonus = Math.min(combo * 10, 50)

  // 时间加成
  let timeBonus = 0
  if (responseTime < 3000) timeBonus = 50        // 3秒内 +50
  else if (responseTime < 5000) timeBonus = 30    // 5秒内 +30
  else if (responseTime < 10000) timeBonus = 15   // 10秒内 +15

  // 使用提示扣分
  if (hintUsed) baseScore = Math.floor(baseScore * 0.5)

  return Math.round((baseScore + comboBonus + timeBonus) * safeScoreRatio)
}

/**
 * 计算关卡经验值
 */
export function calculateLevelExp(stars, chapter, correctRate) {
  const baseExp = 20 * chapter   // 章节越高基础经验越多
  const starBonus = stars * 10
  const rateBonus = Math.floor(correctRate * 30)
  return baseExp + starBonus + rateBonus
}

/**
 * 计算星级评定
 * @param {number} correctRate - 正确率 (0~1)
 * @param {number} avgTime - 平均答题时间(ms)
 * @param {number} livesRemaining - 剩余生命
 * @param {number} maxLives - 该难度下的最大生命（easy=4, normal=3, hard=2）
 */
export function calculateStars(correctRate, avgTime, livesRemaining, maxLives = 3) {
  if (livesRemaining <= 0) return 0
  if (correctRate >= 0.95 && avgTime < 8000 && livesRemaining === maxLives) return 3
  if (correctRate >= 0.8 && livesRemaining >= Math.ceil(maxLives / 2)) return 2
  if (correctRate >= 0.5) return 1
  return 1
}
