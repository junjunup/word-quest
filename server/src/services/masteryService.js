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

  let delta = 0
  let interval = previousInterval
  let easeFactor = previousEase
  let nextReviewAt = addDays(now, 1)

  if (errorType === 'timeout') {
    delta = -12
    interval = 0.25
    easeFactor = clamp(previousEase - 0.18, 1.3, 3.0)
    nextReviewAt = addDays(now, 0.25)
  } else if (errorType === 'pronunciation') {
    delta = record.isCorrect ? 4 : -8
    interval = record.isCorrect ? Math.max(1, previousInterval) : 0.5
    easeFactor = clamp(previousEase + (record.isCorrect ? 0.02 : -0.12), 1.3, 3.0)
    nextReviewAt = addDays(now, record.isCorrect ? interval : 0.5)
  } else if (quality === 'exact' && record.isCorrect) {
    delta = 10
    easeFactor = clamp(previousEase + 0.08, 1.3, 3.0)
    interval = previousScore < 30 ? 1 : Math.max(2, Math.round(previousInterval * easeFactor))
    nextReviewAt = addDays(now, interval)
  } else if (quality === 'near') {
    delta = 3
    easeFactor = clamp(previousEase - 0.05, 1.3, 3.0)
    interval = 1
    nextReviewAt = addDays(now, 1)
  } else {
    delta = -15
    easeFactor = clamp(previousEase - 0.2, 1.3, 3.0)
    interval = 0.25
    nextReviewAt = addDays(now, 0.25)
  }

  const nextScore = clamp(previousScore + delta, 0, 100)
  return { now, quality, errorType, delta: nextScore - previousScore, nextScore, interval, easeFactor, nextReviewAt }
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
