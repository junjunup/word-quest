import mongoose from 'mongoose'
import DailyLearningSession from '../models/DailyLearningSession.js'
import QuizRecord from '../models/QuizRecord.js'
import VocabularyBank from '../models/VocabularyBank.js'
import WordMastery from '../models/WordMastery.js'
import { dailyDateKey, selectDailyWords } from './learningEvidencePolicy.js'
import { sanitizeWordbookId } from './courseMapService.js'
export function learningError(status, message) { return Object.assign(new Error(message), { status }) }
export async function readDailySession(userId, id, now = new Date()) {
  if (!mongoose.isValidObjectId(id)) throw learningError(404, '学习会话不存在')
  const session = await DailyLearningSession.findOne({ _id: id, userId }).lean()
  if (!session) throw learningError(404, '学习会话不存在')
  const records = await QuizRecord.find({ userId, dailySessionId: id, attemptPhase: 'first' }).sort({ createdAt: 1 }).lean()
  const byWord = new Map()
  for (const record of records) if (!byWord.has(String(record.wordId))) byWord.set(String(record.wordId), record)
  const acknowledged = new Set(session.feedbackWordIds || [])
  const completedWordIds = session.items.map(x => String(x._id)).filter(id => byWord.has(id) && acknowledged.has(id))
  const pendingFeedback = [...byWord.values()].filter(x => !acknowledged.has(String(x.wordId))).map(x => ({ wordId: String(x.wordId), playerAnswer: x.playerAnswer, isCorrect: x.isCorrect }))
  const complete = session.items.length > 0 && completedWordIds.length === session.items.length
  const status = session.status === 'ended' ? 'ended' : complete ? 'completed' : 'active'
  if (complete && session.status === 'active') await DailyLearningSession.updateOne({ _id: id, status: 'active' }, { $set: { status: 'completed' } })
  const results = [...byWord.values()]
  return { sessionId: String(session._id), wordbookId: session.wordbookId, dateKey: session.dateKey,
    items: session.items, completedWordIds, pendingFeedback, status, isPreviousDay: session.dateKey !== dailyDateKey(now),
    independentCorrect: results.filter(x => x.assistance === 'none' && x.recallMode === 'recall' && x.isCorrect && x.answerQuality === 'exact').length,
    reviewWords: results.filter(x => !x.isCorrect || x.assistance !== 'none').map(x => ({ wordId: String(x.wordId), word: x.word, nextReviewAt: x.reviewScheduledAt })) }
}
export async function createDailySession(userId, wordbookId, now = new Date()) {
  wordbookId = sanitizeWordbookId(wordbookId)
  const dateKey = dailyDateKey(now)
  const older = await DailyLearningSession.find({ userId, wordbookId, status: 'active', dateKey: { $lt: dateKey } }).sort({ dateKey: 1 })
  for (const session of older) {
    const old = await readDailySession(userId, session._id, now)
    if (old.status === 'active' && old.items.length) return old
  }
  const existing = await DailyLearningSession.findOne({ userId, wordbookId, dateKey })
  if (existing) return readDailySession(userId, existing._id, now)
  const mastery = await WordMastery.find({ userId, wordbookId }).sort({ nextReviewAt: 1 }).lean()
  const seenIds = await QuizRecord.distinct('wordId', { userId, wordbookId })
  const dueIds = mastery.filter(x => x.nextReviewAt <= now).map(x => x.wordId)
  const [due, fresh] = await Promise.all([
    VocabularyBank.find({ wordbookId, _id: { $in: dueIds } }).lean(),
    VocabularyBank.find({ wordbookId, _id: { $nin: [...seenIds, ...mastery.map(x => x.wordId)] } }).sort({ chapter: 1, level: 1, _id: 1 }).limit(10).lean()
  ])
  const ranks = new Map(dueIds.map((id, i) => [String(id), i]))
  due.sort((a, b) => ranks.get(String(a._id)) - ranks.get(String(b._id)))
  const items = selectDailyWords(due, fresh)
  if (!items.length) return { sessionId: '', wordbookId, dateKey, items: [], completedWordIds: [], status: 'empty', reviewWords: [] }
  let session
  try { session = await DailyLearningSession.findOneAndUpdate({ userId, wordbookId, dateKey }, { $setOnInsert: { items } }, { upsert: true, new: true }) }
  catch (error) { if (error.code !== 11000) throw error; session = await DailyLearningSession.findOne({ userId, wordbookId, dateKey }) }
  return readDailySession(userId, session._id, now)
}
export async function endDailySession(userId, id) {
  await readDailySession(userId, id)
  await DailyLearningSession.updateOne({ _id: id, userId, status: 'active' }, { $set: { status: 'ended' } })
  return readDailySession(userId, id)
}

export async function currentDailySession(userId, wordbookId, now = new Date()) {
  const sessions = await DailyLearningSession.find({ userId, wordbookId: sanitizeWordbookId(wordbookId), status: 'active' }).sort({ dateKey: 1 })
  for (const session of sessions) {
    const current = await readDailySession(userId, session._id, now)
    if (current.status === 'active') return current
  }
  return { status: 'none', items: [], completedWordIds: [] }
}

export async function acknowledgeDailyFeedback(userId, id, wordId) {
  const current = await readDailySession(userId, id)
  wordId = String(wordId || '')
  if (current.status === 'ended') throw learningError(409, '当前轮已经结束')
  if (!current.items.some(x => String(x._id) === wordId) ||
      !await QuizRecord.exists({ userId, dailySessionId: id, wordId: new mongoose.Types.ObjectId(wordId), attemptPhase: 'first' }))
    throw learningError(409, '请先完成本词首答')
  await DailyLearningSession.updateOne({ _id: id, userId, status: { $ne: 'ended' } }, { $addToSet: { feedbackWordIds: wordId } })
  return readDailySession(userId, id)
}
