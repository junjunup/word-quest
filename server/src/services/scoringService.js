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
export function calculateQuizScore(isCorrect, responseTime, combo, difficulty, hintUsed = false) {
  if (!isCorrect) return 0

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

  return baseScore + comboBonus + timeBonus
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
 */
export function calculateStars(correctRate, avgTime, livesRemaining) {
  if (correctRate >= 0.95 && avgTime < 8000 && livesRemaining === 3) return 3
  if (correctRate >= 0.8 && livesRemaining >= 2) return 2
  return 1
}
