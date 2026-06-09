/**
 * Cycle 6: 防刷分中间件
 * 检测异常答题模式：过快答题、正确率异常、分数篡改
 */

const MIN_RESPONSE_MS = 800       // 单题最低响应时间（毫秒）
const PERFECT_STREAK_THRESHOLD = 20 // 连续全对阈值
const MAX_SCORE_PER_QUESTION = 200  // 单题最高得分上限

/**
 * 校验单次答题记录是否异常
 * @returns {{ flagged: boolean, reasons: string[] }}
 */
export function validateQuizSubmission(payload, existingRecords = []) {
  const reasons = []

  // 1. 答题速度异常
  if (payload.responseTime !== undefined && payload.responseTime < MIN_RESPONSE_MS) {
    reasons.push(`suspicious_speed:${payload.responseTime}ms`)
  }

  // 2. 分数异常
  if (payload.scoreRatio !== undefined && payload.scoreRatio > 1.5) {
    reasons.push('suspicious_score_ratio')
  }

  // 3. 单题得分上限
  if (payload.score && payload.score > MAX_SCORE_PER_QUESTION) {
    reasons.push(`excessive_score:${payload.score}`)
  }

  // 4. 连续全对检测（基于最近记录）
  if (existingRecords.length >= PERFECT_STREAK_THRESHOLD) {
    const recentCorrect = existingRecords.slice(0, PERFECT_STREAK_THRESHOLD).filter(r => r.isCorrect).length
    if (recentCorrect === PERFECT_STREAK_THRESHOLD) {
      // 检查是否全部在 2s 内答对（可能使用外挂）
      const allFast = existingRecords.slice(0, PERFECT_STREAK_THRESHOLD).every(r => r.responseTime < 2000)
      if (allFast) {
        reasons.push('perfect_streak_all_fast')
      }
    }
  }

  return {
    flagged: reasons.length > 0,
    reasons,
    severity: reasons.length >= 3 ? 'high' : reasons.length >= 2 ? 'medium' : reasons.length >= 1 ? 'low' : 'none'
  }
}

/**
 * 服务端独立计分（防篡改）
 * @returns 服务端计算的分数
 */
export function computeServerScore(isCorrect, answerQuality, questionType, difficulty) {
  const baseScore = 100
  const diffMultiplier = { easy: 0.8, normal: 1.0, hard: 1.5 }[difficulty] || 1.0

  const qualityMultiplier = {
    exact: 1.0,
    near: 0.72,
    wrong: 0
  }[answerQuality] || (isCorrect ? 0.8 : 0)

  const typeMultiplier = ['spell_hint', 'spell_full', 'translate'].includes(questionType) ? 1.3 : 1.0

  return Math.round(baseScore * diffMultiplier * qualityMultiplier * typeMultiplier)
}

/**
 * 检查客户端分数与服务端计算是否在容差范围内（±20%）
 */
export function isScoreSuspicious(clientScore, serverScore) {
  if (!clientScore || serverScore === 0) return false
  const ratio = clientScore / serverScore
  return ratio < 0.8 || ratio > 1.2
}
