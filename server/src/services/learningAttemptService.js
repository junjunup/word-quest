import mongoose from 'mongoose'
import { createHash } from 'node:crypto'
import QuizRecord from '../models/QuizRecord.js'
import VocabularyBank from '../models/VocabularyBank.js'
import WordMastery from '../models/WordMastery.js'
import LearningLog from '../models/LearningLog.js'
import DailyLearningSession from '../models/DailyLearningSession.js'
import { verifyAnswer, calculateServerScore } from './answerVerificationService.js'
import { updateFromQuizRecord } from './masteryService.js'
import { getAdaptiveDifficulty } from './adaptiveEngine.js'
import { classifyEvidence } from './learningEvidencePolicy.js'
import { learningError } from './dailyLearningService.js'
const types = ['choice_en2cn', 'choice_cn2en', 'spell_hint', 'spell_full', 'translate', 'fill_blank']
const modes = ['mainline', 'boss', 'review', 'daily', 'endless']
const identity = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)
export async function submitLearningAttempt(userId, body) {
  if (!identity(body.attemptId) || !identity(body.encounterId) || !['first', 'correction'].includes(body.attemptPhase) ||
    !['none', 'partial', 'answer_shown'].includes(body.assistance) || !types.includes(body.questionType) ||
    !mongoose.isValidObjectId(body.wordId) || typeof body.playerAnswer !== 'string' || body.playerAnswer.length > 1000 ||
    !Number.isFinite(body.responseTime) || body.responseTime < 0 || body.responseTime > 3600000)
    throw learningError(400, '无效的学习记录参数')
  const assistance = body.attemptPhase === 'correction' ? 'answer_shown' :
    body.hintUsed || body.questionType === 'spell_hint' ? 'partial' : body.assistance
  const data = { attemptId: body.attemptId, encounterId: body.encounterId, attemptPhase: body.attemptPhase, assistance,
    wordId: String(body.wordId), wordbookId: String(body.wordbookId || 'cet4'), questionType: body.questionType,
    recommendedType: types.includes(body.recommendedType) ? body.recommendedType : body.questionType,
    presentedType: body.questionType, wasDowngraded: body.wasDowngraded === true, playerAnswer: body.playerAnswer, responseTime: body.responseTime,
    timeLimit: Math.max(0, Math.min(Number(body.timeLimit) || 0, 3600000)),
    difficulty: Math.max(1, Math.min(Number(body.difficulty) || 1, 5)),
    sessionId: String(body.sessionId || '').slice(0, 100), chapter: Math.max(1, Number(body.chapter) || 1),
    level: Math.max(1, Number(body.level) || 1), combo: Math.max(0, Math.min(Number(body.combo) || 0, 100)),
    dailySessionId: body.dailySessionId || null, sourceMode: modes.includes(body.sourceMode) ? body.sourceMode : 'mainline' }
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex')
  let record = await QuizRecord.findOne({ userId, attemptId: data.attemptId })
  if (record && record.requestHash !== hash) throw learningError(409, '该答题标识已用于不同答案')
  if (!record) {
    const word = await VocabularyBank.findById(data.wordId).lean()
    if (!word) throw learningError(404, '词条不存在')
    if (word.wordbookId !== data.wordbookId) throw learningError(409, '词条与当前词库不匹配')
    if (data.dailySessionId) {
      if (!mongoose.isValidObjectId(data.dailySessionId)) throw learningError(404, '学习会话不存在')
      const daily = await DailyLearningSession.findOne({ _id: data.dailySessionId, userId }).lean()
      if (!daily) throw learningError(404, '学习会话不存在')
      if (daily.status === 'ended' || daily.wordbookId !== data.wordbookId || !daily.items.some(x => String(x._id) === data.wordId))
        throw learningError(409, '词条不属于进行中的学习队列')
    }
    if (data.attemptPhase === 'correction') {
      const first = await QuizRecord.findOne({ userId, encounterId: data.encounterId, attemptPhase: 'first', wordId: word._id }).lean()
      if (!first || first.isCorrect || String(first.dailySessionId || '') !== String(data.dailySessionId || ''))
        throw learningError(409, '纠正必须对应本人本次遭遇的首答错题')
    }
    const answer = await verifyAnswer(word._id, data.playerAnswer, data.questionType, data)
    if (!answer.verified) throw learningError(422, '服务器无法验证该题，请重新加载词库')
    const serverScore = data.attemptPhase === 'correction' ? 0 : calculateServerScore(answer.isCorrect, data.responseTime, data.combo, data.difficulty, assistance !== 'none', answer.scoreRatio)
    const candidate = { ...data, userId, wordId: word._id, word: word.word, requestHash: hash,
      wasDowngraded: data.wasDowngraded || data.recommendedType !== data.presentedType, hintUsed: assistance !== 'none',
      recallMode: ['spell_full', 'spell_hint', 'translate', 'fill_blank'].includes(data.questionType) ? 'recall' : 'recognition',
      isCorrect: answer.isCorrect, correctAnswer: answer.correctAnswer, answerQuality: answer.answerQuality,
      errorType: answer.errorType, editDistance: answer.editDistance, similarity: answer.similarity,
      scoreRatio: answer.scoreRatio, fuzzyFeedback: answer.feedback, serverScore }
    try { record = await QuizRecord.create(candidate) }
    catch (error) {
      if (error.code !== 11000) throw error
      record = await QuizRecord.findOne({ userId, attemptId: data.attemptId })
      if (!record || record.requestHash !== hash) throw learningError(409, '这次遭遇或今日词条已经提交，请恢复学习进度')
    }
  }
  const { mastery, delta } = await updateFromQuizRecord(record)
  try {
    await LearningLog.updateOne({ quizRecordId: record._id }, { $setOnInsert: {
      userId, eventType: 'quiz', sessionId: record.sessionId,
      eventData: { wordId: record.wordId, wordbookId: record.wordbookId, isCorrect: record.isCorrect, attemptPhase: record.attemptPhase }
    } }, { upsert: true })
  } catch (error) { if (error.code !== 11000) throw error }
  return { record, serverVerified: true, serverIsCorrect: record.isCorrect, serverScore: record.serverScore,
    mastery, masteryDelta: delta, errorType: record.errorType, answerQuality: record.answerQuality,
    scoreRatio: record.scoreRatio, fuzzyFeedback: record.fuzzyFeedback,
    adaptiveDifficulty: await getAdaptiveDifficulty(userId) }
}
export async function evidenceSummary(userId, wordbookId) {
  const rows = await QuizRecord.find({ userId, wordbookId }).select('attemptPhase assistance hintUsed questionType isCorrect answerQuality wordId').lean()
  const result = Object.fromEntries(['recall', 'recognition', 'assisted', 'correction', 'unknown'].map(x => [x, { total: 0, correct: 0 }]))
  for (const row of rows) {
    const category = classifyEvidence(row)
    result[category].total++
    if (row.isCorrect && (category !== 'recall' || row.answerQuality === 'exact')) result[category].correct++
  }
  const words = await WordMastery.find({ userId, wordbookId }).select('word wordId delayedReviewPassedAt nextReviewAt totalAttempts').lean()
  result.words = words.map(w => ({ wordId: String(w.wordId), word: w.word,
    state: w.delayedReviewPassedAt ? 'delayed_passed' : w.totalAttempts > 1 ? 'consolidate' : 'introduced', nextReviewAt: w.nextReviewAt }))
  result.delayedPassed = words.filter(w => w.delayedReviewPassedAt).length
  return result
}
