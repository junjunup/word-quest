import mongoose from 'mongoose'
import WordMastery from '../models/WordMastery.js'
import VocabularyBank from '../models/VocabularyBank.js'
import { sanitizeWordbookId } from './courseMapService.js'

const ERROR_TYPES = ['unknown', 'spelling_near', 'meaning_confusion', 'timeout', 'pronunciation', 'other']
const SOURCE_MODES = ['mainline', 'boss', 'review', 'daily', 'pk', 'pronunciation', 'endless']

function clamp(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.max(min, Math.min(number, max))
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function normalizeAnswerQuality(record) {
  if (record.errorType === 'pronunciation' || record.sourceMode === 'pronunciation') return record.isCorrect ? 'exact' : 'wrong'
  if (['exact', 'near', 'wrong'].includes(record.answerQuality)) return record.answerQuality
  return record.isCorrect ? 'exact' : 'wrong'
}

function normalizeErrorType(value) {
  return ERROR_TYPES.includes(value) ? value : 'unknown'
}

function normalizeSourceMode(value) {
  return SOURCE_MODES.includes(value) ? value : 'mainline'
}

function stringifyWordId(wordId) {
  if (wordId === null || wordId === undefined || wordId === '') return 'unknown'
  return wordId.toString ? wordId.toString() : String(wordId)
}

async function resolveVocabularyInfo(record) {
  const wordId = stringifyWordId(record.wordId)
  if (wordId !== 'unknown' && mongoose.Types.ObjectId.isValid(wordId)) {
    const vocab = await VocabularyBank.findById(wordId).lean()
    if (vocab) {
      return {
        wordbookId: sanitizeWordbookId(record.wordbookId || vocab.wordbookId || 'cet4'),
        word: record.word || vocab.word,
        wordId: vocab._id
      }
    }
  }
  return {
    wordbookId: sanitizeWordbookId(record.wordbookId || 'cet4'),
    word: String(record.word || '').trim() || 'unknown',
    wordId: record.wordId || wordId
  }
}

function calculateTransition(mastery, record) {
  const now = new Date()
  const quality = normalizeAnswerQuality(record)
  const errorType = normalizeErrorType(record.errorType)
  const previousScore = Number(mastery.masteryScore || 0)
  const previousInterval = Number(mastery.reviewInterval || 1)
  const previousEase = Number(mastery.easeFactor || 2.5)

  // SM-2 quality 映射：将答题结果转为 0-5 分
  const sm2Quality = mapQuizToSM2Quality(record)
  // 基于 SM-2 计算新 interval
  const sm2Result = updateWithSM2(previousInterval, previousEase, sm2Quality)

  let delta = 0

  if (errorType === 'timeout') {
    delta = -12
  } else if (errorType === 'pronunciation') {
    delta = record.isCorrect ? 4 : -8
  } else if (quality === 'exact' && record.isCorrect) {
    delta = 10
  } else if (quality === 'near') {
    delta = 3
  } else {
    delta = -15
  }

  const nextScore = clamp(previousScore + delta, 0, 100)

  // 使用 SM-2 计算的 interval 和 easeFactor（替代原有硬编码间隔）
  return {
    now,
    quality,
    errorType,
    sm2Quality,
    delta: nextScore - previousScore,
    nextScore,
    interval: sm2Result.interval,
    easeFactor: sm2Result.easeFactor,
    nextReviewAt: addDays(now, Math.max(0.25, sm2Result.interval)),
    learningStage: sm2Result.learningStage
  }
}

/**
 * 将答题记录映射为 SM-2 quality 值 (0-5)
 * SM-2 (Piotr Wozniak, 1987)
 *
 * 映射规则：
 *   5 = 拼写/翻译完全正确
 *   4 = 选择题正确 / 听力题正确
 *   3 = 拼写模糊匹配(near) / 想了很久才答对
 *   2 = 不记得但看到答案感觉熟悉
 *   1 = 不记得但看到答案想起来
 *   0 = 完全不记得
 */
function mapQuizToSM2Quality(record) {
  const questionType = record.questionType || ''
  const quality = record.answerQuality || 'wrong'
  const isCorrect = !!record.isCorrect

  // 拼写/翻译题完全正确 → quality 5
  if (isCorrect && quality === 'exact' && ['spell_hint', 'spell_full', 'translate'].includes(questionType)) {
    return 5
  }
  // 选择题/听力题正确 → quality 4
  if (isCorrect && ['choice_en2cn', 'choice_cn2en', 'pronunciation'].includes(questionType)) {
    return 4
  }
  // 拼写模糊匹配(near) → quality 3
  if (quality === 'near') {
    return 3
  }
  // 答错但答案质量不是完全错误 → quality 1
  if (!isCorrect && quality !== 'wrong') {
    return 1
  }
  // 完全错误 → quality 0
  if (!isCorrect) {
    return 0
  }
  // 兜底
  return isCorrect ? 4 : 0
}

/**
 * 标准 SM-2 算法（SuperMemo 2, Piotr Wozniak 1987）
 *
 * @param {number} currentInterval - 当前间隔（天）
 * @param {number} currentEase - 当前 ease factor（≥1.3）
 * @param {number} quality - 答题质量 (0-5)
 * @returns {{ interval: number, easeFactor: number, learningStage: string }}
 */
function updateWithSM2(currentInterval, currentEase, quality) {
  let interval = Number(currentInterval) || 0
  let easeFactor = clamp(Number(currentEase) || 2.5, 1.3, 3.0)

  if (quality >= 3) {
    // 回答正确 → 增加间隔
    if (interval === 0) {
      interval = 1
    } else if (interval === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    // SM-2 ease factor 公式
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  } else {
    // 回答错误 → 重置间隔，降低 ease
    interval = 0
    easeFactor = clamp(easeFactor - 0.2, 1.3, 3.0)
  }

  easeFactor = clamp(easeFactor, 1.3, 3.0)
  interval = Math.max(0, interval)

  // 根据 interval 判断学习阶段
  let learningStage = 'learning'
  if (interval === 0) {
    learningStage = 'learning'  // 还在学习阶段（刚接触或刚犯错）
  } else if (interval >= 21) {
    learningStage = 'mastered'  // 间隔 ≥ 21 天 → 已掌握
  } else if (interval >= 7) {
    learningStage = 'review'    // 间隔 ≥ 7 天 → 复习阶段
  } else {
    learningStage = 'learning'
  }

  return { interval, easeFactor, learningStage }
}

/**
 * Update a user's WordMastery document from one immutable QuizRecord fact.
 * @param {object} record QuizRecord mongoose document or plain object.
 * @returns {Promise<{mastery: object, delta: number}>} Updated mastery and score delta.
 */
export async function updateFromQuizRecord(record) {
  if (!record || !record.userId) return { mastery: null, delta: 0 }

  const vocabInfo = await resolveVocabularyInfo(record)
  const sourceMode = normalizeSourceMode(record.sourceMode)
  const transitionBase = {
    isCorrect: !!record.isCorrect,
    answerQuality: record.answerQuality,
    errorType: record.errorType,
    sourceMode
  }

  let mastery = await WordMastery.findOne({ userId: record.userId, wordId: vocabInfo.wordId })
  if (!mastery) {
    mastery = new WordMastery({
      userId: record.userId,
      wordId: vocabInfo.wordId,
      wordbookId: vocabInfo.wordbookId,
      word: vocabInfo.word,
      masteryScore: 0,
      reviewInterval: 1,
      easeFactor: 2.5,
      recentErrorTypes: []
    })
  }

  const transition = calculateTransition(mastery, transitionBase)
  mastery.wordbookId = vocabInfo.wordbookId
  mastery.word = vocabInfo.word
  mastery.masteryScore = transition.nextScore
  mastery.lastReviewedAt = transition.now
  mastery.nextReviewAt = transition.nextReviewAt
  mastery.reviewInterval = transition.interval
  mastery.easeFactor = transition.easeFactor
  mastery.learningStage = transition.learningStage  // SM-2 学习阶段
  mastery.totalAttempts += 1
  mastery.lastAnswerQuality = transition.quality
  mastery.lastErrorType = transition.errorType

  if (transition.quality === 'exact' && record.isCorrect) mastery.exactCount += 1
  if (transition.quality === 'near') mastery.nearCount += 1
  if (transition.quality === 'wrong' && transition.errorType !== 'timeout' && transition.errorType !== 'pronunciation') mastery.wrongCount += 1
  if (transition.errorType === 'timeout') mastery.timeoutCount += 1
  if (transition.errorType === 'pronunciation' || sourceMode === 'pronunciation') mastery.pronunciationCount += 1

  if (transition.errorType !== 'unknown') {
    mastery.recentErrorTypes = [transition.errorType, ...(mastery.recentErrorTypes || [])].slice(0, 10)
  }

  const sourceStats = mastery.sourceStats || {}
  sourceStats[sourceMode] = Number(sourceStats[sourceMode] || 0) + 1
  mastery.sourceStats = sourceStats

  await mastery.save()
  if (record.reviewScheduledAt !== undefined || record.masteryDelta !== undefined) {
    record.masteryDelta = transition.delta
    record.reviewScheduledAt = transition.nextReviewAt
    if (typeof record.save === 'function') await record.save()
  }

  return { mastery, delta: transition.delta }
}

/**
 * Batch update mastery from multiple records.
 * @param {Array<object>} records Quiz records.
 * @returns {Promise<{updated: number, results: Array}>} Batch update result.
 */
export async function updateFromQuizRecords(records) {
  const results = []
  for (const record of Array.isArray(records) ? records : []) {
    results.push(await updateFromQuizRecord(record))
  }
  return { updated: results.filter(item => item.mastery).length, results }
}

/**
 * Get aggregate mastery summary for a user and wordbook.
 * @param {string|object} userId User id.
 * @param {string} wordbookId Wordbook id.
 * @returns {Promise<object>} Summary.
 */
export async function getMasterySummary(userId, wordbookId = 'cet4') {
  const safeWordbookId = sanitizeWordbookId(wordbookId)
  const now = new Date()
  const [stats] = await WordMastery.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), wordbookId: safeWordbookId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        averageMastery: { $avg: '$masteryScore' },
        mastered: { $sum: { $cond: [{ $gte: ['$masteryScore', 80] }, 1, 0] } },
        weak: { $sum: { $cond: [{ $lt: ['$masteryScore', 50] }, 1, 0] } },
        due: { $sum: { $cond: [{ $lte: ['$nextReviewAt', now] }, 1, 0] } },
        attempts: { $sum: '$totalAttempts' }
      }
    }
  ])

  return {
    wordbookId: safeWordbookId,
    total: stats?.total || 0,
    averageMastery: Math.round(Number(stats?.averageMastery || 0)),
    mastered: stats?.mastered || 0,
    weak: stats?.weak || 0,
    due: stats?.due || 0,
    attempts: stats?.attempts || 0
  }
}

/**
 * Query mastery words for review and dashboards.
 * @param {string|object} userId User id.
 * @param {object} params Query params.
 * @returns {Promise<Array<object>>} Mastery rows.
 */
export async function getMasteryWords(userId, params = {}) {
  const safeWordbookId = sanitizeWordbookId(params.wordbookId || 'cet4')
  const limit = Math.min(Math.max(Number.parseInt(params.limit, 10) || 20, 1), 100)
  const mode = String(params.mode || 'due')
  const now = new Date()
  const query = { userId, wordbookId: safeWordbookId }

  if (mode === 'weak') query.masteryScore = { $lt: 60 }
  if (mode === 'due') query.nextReviewAt = { $lte: now }
  if (params.errorType && ERROR_TYPES.includes(params.errorType)) query.recentErrorTypes = params.errorType

  const sort = mode === 'weak'
    ? { masteryScore: 1, nextReviewAt: 1 }
    : { nextReviewAt: 1, masteryScore: 1 }

  return WordMastery.find(query).sort(sort).limit(limit).lean()
}

// 暴露内部函数供测试使用（与 distractorService.js __testables 模式一致）
export const __testables = {
  updateWithSM2,
  mapQuizToSM2Quality,
  calculateTransition,
  addDays,
  clamp
}
