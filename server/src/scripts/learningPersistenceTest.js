import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { randomUUID } from 'node:crypto'
import QuizRecord from '../models/QuizRecord.js'
import WordMastery from '../models/WordMastery.js'
import VocabularyBank from '../models/VocabularyBank.js'
import LearningLog from '../models/LearningLog.js'
import DailyLearningSession from '../models/DailyLearningSession.js'
import { submitLearningAttempt, evidenceSummary } from '../services/learningAttemptService.js'
import { createDailySession, readDailySession, endDailySession, acknowledgeDailyFeedback } from '../services/dailyLearningService.js'

let mongo
const user = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId()
let vocab
const request = word => ({ attemptId: randomUUID(), encounterId: randomUUID(), attemptPhase: 'first', assistance: 'none', wordId: String(word._id), wordbookId: 'cet4', word: word.word, questionType: 'spell_full', playerAnswer: word.word, responseTime: 1000, timeLimit: 0, difficulty: 1, sessionId: 'test', chapter: 1, level: 1 })
test.before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '8.2.1' } })
  await mongoose.connect(mongo.getUri(), { dbName: 'learning-p0p1-test' })
  await Promise.all([QuizRecord.init(), WordMastery.init(), LearningLog.init(), DailyLearningSession.init(), VocabularyBank.init()])
  vocab = await VocabularyBank.create(Array.from({ length: 20 }, (_, i) => ({ word: `word${i}`, meaning: `词${i}`, wordbookId: 'cet4', chapter: 1, level: 1 })))
})
test.after(async () => { await mongoose.disconnect(); await mongo?.stop() })
test('parallel duplicates produce one fact, one mastery effect and one log; changed payload conflicts', async () => {
  const body = request(vocab[0])
  const results = await Promise.all(Array.from({ length: 12 }, () => submitLearningAttempt(user, body)))
  assert.equal(await QuizRecord.countDocuments({ userId: user }), 1)
  assert.equal(await LearningLog.countDocuments({ userId: user }), 1)
  const mastery = await WordMastery.findOne({ userId: user })
  assert.equal(mastery.totalAttempts, 1); assert.equal(mastery.masteryScore, 10)
  assert.equal(new Set(results.map(r => r.serverScore)).size, 1)
  await assert.rejects(submitLearningAttempt(user, { ...body, playerAnswer: 'different' }), e => e.status === 409)
})
test('correction is recorded once with no extra mastery or score; ownership validated', async () => {
  const first = { ...request(vocab[1]), playerAnswer: 'incorrect' }
  await submitLearningAttempt(user, first)
  const correction = { ...first, attemptId: randomUUID(), attemptPhase: 'correction', assistance: 'answer_shown', playerAnswer: vocab[1].word }
  const result = await submitLearningAttempt(user, correction)
  assert.equal(result.serverScore, 0)
  const mastery = await WordMastery.findOne({ userId: user, wordId: vocab[1]._id })
  assert.equal(mastery.masteryScore, 0); assert.equal(mastery.totalAttempts, 1)
  await assert.rejects(submitLearningAttempt(other, correction), e => e.status === 409)
  const summary = await evidenceSummary(user, 'cet4')
  assert.equal(summary.correction.total, 1); assert.equal(summary.recall.total, 2)
})
test('daily session is stable across concurrency, bounded, owner-scoped, book-checked and resumable', async () => {
  const sessions = await Promise.all(Array.from({ length: 8 }, () => createDailySession(user, 'cet4')))
  const current = sessions[0]
  assert.equal(new Set(sessions.map(s => s.sessionId)).size, 1)
  assert.equal(current.items.length, 10)
  await assert.rejects(readDailySession(other, current.sessionId), e => e.status === 404)
  const item = current.items[0]
  await assert.rejects(acknowledgeDailyFeedback(user, current.sessionId, item._id), e => e.status === 409)
  await submitLearningAttempt(user, { ...request(item), dailySessionId: current.sessionId })
  const needsFeedback = await readDailySession(user, current.sessionId)
  assert.equal(needsFeedback.completedWordIds.length, 0)
  assert.equal(needsFeedback.pendingFeedback.length, 1)
  await assert.rejects(acknowledgeDailyFeedback(other, current.sessionId, item._id), e => e.status === 404)
  await Promise.all(Array.from({ length: 5 }, () => acknowledgeDailyFeedback(user, current.sessionId, item._id)))
  const resumed = await createDailySession(user, 'cet4')
  assert.equal(resumed.completedWordIds.length, 1)
  assert.deepEqual(resumed.items.map(x => String(x._id)), current.items.map(x => String(x._id)))
  await assert.rejects(submitLearningAttempt(user, { ...request(vocab[19]), dailySessionId: current.sessionId, wordbookId: 'cet6' }), e => e.status === 409)
  for (const row of current.items.slice(1)) {
    await submitLearningAttempt(user, { ...request(row), dailySessionId: current.sessionId })
    await acknowledgeDailyFeedback(user, current.sessionId, row._id)
  }
  assert.equal((await readDailySession(user, current.sessionId)).status, 'completed')
  assert.equal((await createDailySession(user, 'cet4')).status, 'completed')
})
test('previous day incomplete session is returned explicitly and can be ended', async () => {
  const past = await createDailySession(other, 'cet4', new Date('2026-09-08T10:00:00Z'))
  const restored = await createDailySession(other, 'cet4', new Date('2026-09-09T10:00:00Z'))
  assert.equal(restored.sessionId, past.sessionId); assert.equal(restored.isPreviousDay, true)
  await endDailySession(other, past.sessionId)
  assert.notEqual((await createDailySession(other, 'cet4', new Date('2026-09-09T10:00:00Z'))).sessionId, past.sessionId)
})

test('retry repairs a crash after mastery save without another gain; concurrent distinct facts all apply', async () => {
  const owner = new mongoose.Types.ObjectId()
  const body = request(vocab[0])
  const saved = await submitLearningAttempt(owner, body)
  await QuizRecord.updateOne({ _id: saved.record._id }, { $unset: { reviewScheduledAt: 1, masteryDelta: 1 } })
  await LearningLog.deleteOne({ quizRecordId: saved.record._id })
  const repaired = await submitLearningAttempt(owner, body)
  assert.equal(repaired.record.masteryDelta, 10)
  assert.ok(repaired.record.reviewScheduledAt)
  assert.equal((await WordMastery.findOne({ userId: owner })).totalAttempts, 1)
  assert.equal(await LearningLog.countDocuments({ userId: owner }), 1)
  await Promise.all(Array.from({ length: 8 }, () => submitLearningAttempt(owner, request(vocab[0]))))
  assert.equal((await WordMastery.findOne({ userId: owner })).totalAttempts, 9)
  await assert.rejects(submitLearningAttempt(owner, { ...body, attemptId: randomUUID() }), e => e.status === 409)
})

test('delayed proof requires exact unaided recall and is revoked by a later wrong first answer', async () => {
  const owner = new mongoose.Types.ObjectId()
  await submitLearningAttempt(owner, request(vocab[0]))
  const key = { userId: owner, wordId: vocab[0]._id }
  await WordMastery.updateOne(key, { $set: { lastReviewedAt: new Date(Date.now() - 86400001) } })
  await submitLearningAttempt(owner, request(vocab[0]))
  assert.ok((await WordMastery.findOne(key)).delayedReviewPassedAt)
  await submitLearningAttempt(owner, { ...request(vocab[0]), playerAnswer: 'incorrect' })
  assert.equal((await WordMastery.findOne(key)).delayedReviewPassedAt, null)
})
