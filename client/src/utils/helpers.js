/**
 * 通用工具函数
 */
import { FALLBACK_DISTRACTORS, SCORING_CONFIG } from '@/game/config/gameConstants'

// ============ 安全的 localStorage 读写 ============

export function safeGetItem(key, defaultValue = null) {
  try {
    const val = localStorage.getItem(key)
    return val !== null ? val : defaultValue
  } catch (e) {
    console.warn(`localStorage.getItem('${key}') 失败:`, e)
    return defaultValue
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, String(value))
    return true
  } catch (e) {
    console.warn(`localStorage.setItem('${key}') 失败:`, e)
    return false
  }
}

export function safeGetJSON(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : defaultValue
  } catch (e) {
    console.warn(`localStorage JSON解析失败 '${key}':`, e)
    return defaultValue
  }
}

export function safeSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.warn(`localStorage JSON写入失败 '${key}':`, e)
    return false
  }
}

// ============ 格式化 ============

/** 格式化时间 ms → mm:ss，防御非法输入 */
export function formatTime(ms) {
  if (typeof ms !== 'number' || isNaN(ms) || ms < 0) return '00:00'
  const seconds = Math.floor(ms / 1000)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ============ 计分 ============

/**
 * 计算答题得分（与服务端 scoringService.js 对齐）
 * @param {boolean} isCorrect
 * @param {number} responseTime - ms
 * @param {number} combo - 当前连击数
 * @param {number} difficulty - 难度等级 (1-5)
 * @param {boolean} hintUsed
 * @returns {number} 得分
 */
export function calculateScore(isCorrect, responseTime, combo, difficulty, hintUsed = false) {
  if (!isCorrect) return 0
  const diff = Math.max(1, Math.min(Number(difficulty) || 1, 10))
  const safeCombo = Math.max(0, Number(combo) || 0)
  const safeTime = Math.max(0, Number(responseTime) || 99999)

  let baseScore = SCORING_CONFIG.baseScore * diff
  if (hintUsed) baseScore = Math.floor(baseScore * SCORING_CONFIG.hintPenalty)

  const comboBonus = Math.min(safeCombo * SCORING_CONFIG.comboBonus, SCORING_CONFIG.comboBonusCap)

  let timeBonus = 0
  for (const tier of SCORING_CONFIG.timeBonusTiers) {
    if (safeTime < tier.maxMs) { timeBonus = tier.bonus; break }
  }

  return baseScore + comboBonus + timeBonus
}

/** 计算星级评定 (1-3星) */
export function calculateStars(correctRate, avgTime) {
  const rate = Number(correctRate) || 0
  const time = Number(avgTime) || 99999
  if (rate >= 0.95 && time < 8000) return 3
  if (rate >= 0.8) return 2
  return 1
}

// ============ 数组工具 ============

/** 随机打乱数组（防御 null/非数组） */
export function shuffle(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return []
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ============ 防抖 ============

export function debounce(fn, delay = 300) {
  let timer
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// ============ 干扰项生成（核心：消除所有假选项） ============

/**
 * 为选择题生成干扰项（绝不返回"（无选项）"）
 *
 * 策略：
 * 1. 优先从 otherWords 中取不重复的干扰项
 * 2. 不足时从 FALLBACK_DISTRACTORS 后备词库补充
 * 3. 后备词库也会排除与正确答案相同的项
 *
 * @param {string} correctText - 正确答案文本
 * @param {Array} otherWords - 同关卡其他词汇
 * @param {'meaning'|'word'} field - 取哪个字段作为选项文本
 * @param {number} count - 需要的干扰项数量（默认3）
 * @returns {string[]} 干扰项文本数组
 */
export function generateDistractors(correctText, otherWords, field = 'meaning', count = 3) {
  const used = new Set([correctText.toLowerCase()])
  const results = []

  // 第一轮：从同关卡词汇取
  if (Array.isArray(otherWords)) {
    const shuffled = shuffle(otherWords)
    for (const w of shuffled) {
      if (results.length >= count) break
      const text = w?.[field]
      if (text && !used.has(text.toLowerCase())) {
        used.add(text.toLowerCase())
        results.push(text)
      }
    }
  }

  // 第二轮：不足时从后备词库补充
  if (results.length < count) {
    const fallbackList = field === 'word'
      ? FALLBACK_DISTRACTORS.words
      : FALLBACK_DISTRACTORS.meanings
    const shuffledFallback = shuffle(fallbackList)
    for (const text of shuffledFallback) {
      if (results.length >= count) break
      if (!used.has(text.toLowerCase())) {
        used.add(text.toLowerCase())
        results.push(text)
      }
    }
  }

  return results
}

/**
 * 构建完整的选择题选项数组（4个选项，含1个正确+3个干扰）
 * 保证绝不会出现空选项或占位符
 */
export function buildChoiceOptions(correctId, correctText, otherWords, field = 'meaning') {
  const distractors = generateDistractors(correctText, otherWords, field, 3)
  const options = [
    { id: correctId, text: correctText, correct: true },
    ...distractors.map((text, i) => ({ id: `distractor_${i}`, text, correct: false }))
  ]
  return shuffle(options)
}

// ============ 输入校验 ============

/** 校验拼写题输入：只允许英文字母、连字符、空格 */
export function sanitizeSpellInput(input) {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/[^a-zA-Z\s'-]/g, '')
}

/** 比较拼写答案（忽略大小写，容忍首尾空格） */
export function compareSpelling(userInput, correctWord) {
  if (!userInput || !correctWord) return false
  return sanitizeSpellInput(userInput).toLowerCase() === correctWord.trim().toLowerCase()
}
