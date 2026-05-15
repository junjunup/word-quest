import mongoose from 'mongoose'
import QuizRecord from '../models/QuizRecord.js'
import VocabularyBank from '../models/VocabularyBank.js'

const STALE_DAYS = 14
const LOW_MASTERY_THRESHOLD = 70

function objectIdOrNull(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null
  return new mongoose.Types.ObjectId(String(value))
}

function normalizeWordId(value) {
  return value ? String(value) : 'unknown'
}

function qualityToScore(record) {
  if (Number.isFinite(Number(record.scoreRatio))) return Math.max(0, Math.min(Number(record.scoreRatio), 1))
  if (record.answerQuality === 'exact') return 1
  if (record.answerQuality === 'near') return 0.72
  return record.isCorrect ? 1 : 0
}

function uniqueReasons(reasons) {
  return [...new Set(reasons)]
}

function getQueuePriority(reasons, masteryScore, lastReviewedAt) {
  let priority = 0
  if (reasons.includes('wrong')) priority += 80
  if (reasons.includes('near')) priority += 45
  if (reasons.includes('low_mastery')) priority += Math.max(0, LOW_MASTERY_THRESHOLD - masteryScore)
  if (reasons.includes('stale')) priority += 25
  const ageDays = lastReviewedAt ? (Date.now() - new Date(lastReviewedAt).getTime()) / 86400000 : STALE_DAYS
  return priority + Math.min(ageDays, 30)
}

/**
 * 基于答题记录聚合今日复习队列。
 * @param {string} userId 用户 ID
 * @param {number} limit 返回数量上限
 * @returns {Promise<Array<object>>} 复习队列
 */
export async function getTodayReviewQueue(userId, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100)
  const userObjectId = objectIdOrNull(userId)
  const userMatch = userObjectId ? { userId: userObjectId } : { userId }
  const records = await QuizRecord.find(userMatch).sort({ createdAt: -1 }).limit(1000).lean()

  if (records.length === 0) return []

  const grouped = new Map()
  for (const record of records) {
    const key = normalizeWordId(record.wordId)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(record)
  }

  const objectIds = [...grouped.keys()].map(objectIdOrNull).filter(Boolean)
  const vocabularyDocs = objectIds.length > 0
    ? await VocabularyBank.find({ _id: { $in: objectIds } }).lean()
    : []
  const vocabularyById = new Map(vocabularyDocs.map(item => [String(item._id), item]))
  const staleThreshold = Date.now() - STALE_DAYS * 86400000
  const candidates = []

  for (const [wordId, wordRecords] of grouped.entries()) {
    const recentRecords = wordRecords.slice(0, 5)
    const latest = wordRecords[0]
    const masteryScore = Math.round(
      recentRecords.reduce((sum, record) => sum + qualityToScore(record), 0) / recentRecords.length * 100
    )
    const lastReviewedAt = latest.createdAt || latest.updatedAt || null
    const reasons = []

    if (!latest.isCorrect || latest.answerQuality === 'wrong') reasons.push('wrong')
    if (recentRecords.some(record => record.answerQuality === 'near')) reasons.push('near')
    if (masteryScore < LOW_MASTERY_THRESHOLD) reasons.push('low_mastery')
    if (lastReviewedAt && new Date(lastReviewedAt).getTime() < staleThreshold) reasons.push('stale')

    if (reasons.length === 0) continue

    const vocab = vocabularyById.get(wordId) || {}
    const unique = uniqueReasons(reasons)
    candidates.push({
      wordId,
      word: vocab.word || latest.word || '',
      meaning: vocab.meaning || latest.correctAnswer || '',
      phonetic: vocab.phonetic || '',
      example: vocab.example || '',
      exampleTranslation: vocab.exampleTranslation || '',
      difficulty: vocab.difficulty || latest.difficulty || 1,
      chapter: vocab.chapter || latest.chapter || 1,
      level: vocab.level || latest.level || 1,
      masteryScore,
      lastReviewedAt,
      reasons: unique,
      priority: getQueuePriority(unique, masteryScore, lastReviewedAt)
    })
  }

  return candidates
    .sort((left, right) => right.priority - left.priority || left.word.localeCompare(right.word))
    .slice(0, safeLimit)
    .map(({ priority, ...item }) => item)
}
