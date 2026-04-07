/**
 * 服务端答案验证服务 (H-01 安全修复)
 *
 * 修复审计发现：服务器信任客户端上报的 isCorrect 和 score，允许作弊。
 * 本服务在服务端查询词库、验证答案、计算分数，客户端值仅作降级回退。
 */

import VocabularyBank from '../models/VocabularyBank.js'
import { calculateQuizScore } from './scoringService.js'

/**
 * 标准化字符串用于比较：去除首尾空格、转小写、折叠内部多余空格
 */
function normalize(str) {
  if (typeof str !== 'string') return ''
  return str.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * 服务端验证答案
 *
 * @param {string} wordId - VocabularyBank 文档 _id
 * @param {string} playerAnswer - 玩家提交的答案
 * @param {string} questionType - 题目类型
 * @returns {{ isCorrect: boolean, correctAnswer: string, verified: boolean }}
 *   verified=true 表示服务端成功验证；false 表示回退到客户端值
 */
export async function verifyAnswer(wordId, playerAnswer, questionType) {
  // 无法查询的情况：graceful fallback
  if (!wordId || wordId === 'unknown') {
    return { isCorrect: null, correctAnswer: null, verified: false }
  }

  let word
  try {
    word = await VocabularyBank.findById(wordId).lean()
  } catch {
    // wordId 格式无效等情况
    return { isCorrect: null, correctAnswer: null, verified: false }
  }

  if (!word) {
    return { isCorrect: null, correctAnswer: null, verified: false }
  }

  const normalizedAnswer = normalize(playerAnswer)
  let isCorrect = false
  let correctAnswer = ''

  switch (questionType) {
    // 英译中选择题：正确答案是 word.meaning（中文释义）
    case 'choice_en2cn': {
      correctAnswer = word.meaning
      // 选择题做精确匹配（客户端是从选项中选的）
      isCorrect = normalize(playerAnswer) === normalize(word.meaning)
      break
    }

    // 中译英选择题：正确答案是 word.word（英文单词）
    case 'choice_cn2en': {
      correctAnswer = word.word
      isCorrect = normalize(playerAnswer) === normalize(word.word)
      break
    }

    // 拼写类 / 翻译题：比较英文单词（宽松匹配）
    case 'spell_hint':
    case 'spell_full':
    case 'translate': {
      correctAnswer = word.word
      isCorrect = normalizedAnswer === normalize(word.word)
      break
    }

    // 填空题：可能匹配英文单词
    case 'fill_blank': {
      correctAnswer = word.word
      isCorrect = normalizedAnswer === normalize(word.word)
      break
    }

    default:
      // 未知题型，无法验证
      return { isCorrect: null, correctAnswer: word.word || null, verified: false }
  }

  return { isCorrect, correctAnswer, verified: true }
}

/**
 * 服务端计算答题得分
 *
 * 使用与 scoringService.calculateQuizScore 相同的公式，
 * 但以服务端验证的 isCorrect 为准。
 */
export function calculateServerScore(isCorrect, responseTime, combo, difficulty, hintUsed) {
  // 限制入参范围，防止注入异常值
  const safeResponseTime = Math.max(0, Math.min(Number(responseTime) || 0, 300000)) // 上限5分钟
  const safeDifficulty = Math.max(1, Math.min(Math.round(Number(difficulty) || 1), 5))
  const safeCombo = Math.max(0, Math.min(Math.round(Number(combo) || 0), 100))
  const safeHintUsed = !!hintUsed

  return calculateQuizScore(isCorrect, safeResponseTime, safeCombo, safeDifficulty, safeHintUsed)
}
