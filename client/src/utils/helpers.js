/**
 * 通用工具函数
 */

// 格式化时间 ms → mm:ss
export function formatTime(ms) {
  const seconds = Math.floor(ms / 1000)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// 计算答题得分
export function calculateScore(isCorrect, responseTime, combo, difficulty) {
  if (!isCorrect) return 0
  const baseScore = 100 * difficulty
  const comboBonus = Math.min(combo * 10, 50) // 连击加成，上限50
  const timeBonus = responseTime < 5000 ? 30 : responseTime < 10000 ? 15 : 0
  return baseScore + comboBonus + timeBonus
}

// 计算星级评定 (1-3星)
export function calculateStars(correctRate, avgTime) {
  if (correctRate >= 0.95 && avgTime < 8000) return 3
  if (correctRate >= 0.8) return 2
  return 1
}

// 防抖
export function debounce(fn, delay = 300) {
  let timer
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// 随机打乱数组
export function shuffle(arr) {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
