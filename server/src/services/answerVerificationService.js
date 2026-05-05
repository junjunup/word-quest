/**
 * 服务端答案验证服务 (H-01 安全修复)
 *
 * 修复审计发现：服务器信任客户端上报的 isCorrect 和 score，允许作弊。
 * 本服务在服务端查询词库、验证答案、计算分数，客户端值仅作降级回退。
 */

import VocabularyBank from '../models/VocabularyBank.js'
import { evaluateFuzzyAnswer } from './fuzzyScoringService.js'
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
  let answerQuality = 'wrong'
  let editDistance = null
  let similarity = isCorrect ? 1 : 0
  let scoreRatio = 0
  let feedback = ''

  switch (questionType) {
    // 英译中选择题：正确答案是 word.meaning（中文释义）
    case 'choice_en2cn': {
      correctAnswer = word.meaning
      // 选择题来自固定选项，必须精确匹配，避免同义释义造成歧义
      isCorrect = normalize(playerAnswer) === normalize(word.meaning)
      answerQuality = isCorrect ? 'exact' : 'wrong'
      similarity = isCorrect ? 1 : 0
      scoreRatio = isCorrect ? 1 : 0
      feedback = isCorrect ? '回答完全正确' : '选择项与标准答案不一致'
      break
    }

    // 中译英选择题：正确答案是 word.word（英文单词）
    case 'choice_cn2en': {
      correctAnswer = word.word
      isCorrect = normalize(playerAnswer) === normalize(word.word)
      answerQuality = isCorrect ? 'exact' : 'wrong'
      similarity = isCorrect ? 1 : 0
      scoreRatio = isCorrect ? 1 : 0
      feedback = isCorrect ? '回答完全正确' : '选择项与标准答案不一致'
      break
    }

    // 拼写类 / 翻译题：使用编辑距离进行模糊评分
    case 'spell_hint':
    case 'spell_full':
    case 'translate':
    case 'fill_blank': {
      correctAnswer = word.word
      const fuzzy = evaluateFuzzyAnswer(normalizedAnswer, word.word)
      isCorrect = fuzzy.isCorrect
      answerQuality = fuzzy.answerQuality
      editDistance = fuzzy.editDistance
      similarity = fuzzy.similarity
      scoreRatio = fuzzy.scoreRatio
      feedback = fuzzy.feedback
      break
    }

    default:
      // 未知题型，无法验证
      return { isCorrect: null, correctAnswer: word.word || null, verified: false }
  }

  return {
    isCorrect,
    correctAnswer,
    verified: true,
    answerQuality,
    editDistance,
    similarity,
    scoreRatio,
    feedback,
    wordKnowledge: {
      rootAnalysis: word.rootAnalysis || '',
      memoryTip: word.memoryTip || '',
      example: word.example || '',
      exampleTranslation: word.exampleTranslation || '',
      synonyms: word.synonyms || [],
      antonyms: word.antonyms || [],
      category: word.category || ''
    }
  }
}

/**
 * 服务端计算答题得分
 *
 * 使用与 scoringService.calculateQuizScore 相同的公式，
 * 但以服务端验证的 isCorrect 为准。
 */
export function calculateServerScore(isCorrect, responseTime, combo, difficulty, hintUsed, scoreRatio = 1) {
  // 限制入参范围，防止注入异常值
  const safeResponseTime = Math.max(0, Math.min(Number(responseTime) || 0, 300000)) // 上限5分钟
  const safeDifficulty = Math.max(1, Math.min(Math.round(Number(difficulty) || 1), 5))
  const safeCombo = Math.max(0, Math.min(Math.round(Number(combo) || 0), 100))
  const safeHintUsed = !!hintUsed
  const safeScoreRatio = Math.max(0, Math.min(Number(scoreRatio) || 0, 1))

  return calculateQuizScore(isCorrect, safeResponseTime, safeCombo, safeDifficulty, safeHintUsed, safeScoreRatio)
}
