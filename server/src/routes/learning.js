import express from 'express'
import mongoose from 'mongoose'
import { authMiddleware } from '../middleware/auth.js'
import QuizRecord from '../models/QuizRecord.js'
import LearningLog from '../models/LearningLog.js'
import VocabularyBank from '../models/VocabularyBank.js'
import ReviewSession from '../models/ReviewSession.js'
import { getAdaptiveDifficulty } from '../services/adaptiveEngine.js'
import { verifyAnswer, calculateServerScore, classifyError } from '../services/answerVerificationService.js'
import { getTodayReviewQueue } from '../services/reviewQueueService.js'
import { sanitizeWordbookId } from '../services/courseMapService.js'
import { updateFromQuizRecord, updateFromQuizRecords, getMasterySummary, getMasteryWords } from '../services/masteryService.js'

const router = express.Router()
const SOURCE_MODES = ['mainline', 'boss', 'review', 'daily', 'pk', 'pronunciation', 'endless']

function normalizeSourceMode(value) {
  return SOURCE_MODES.includes(value) ? value : 'mainline'
}

function normalizeReviewWord(item) {
  return {
    _id: item.wordId || item._id,
    wordId: item.wordId || item._id,
    word: item.word,
    meaning: item.meaning || '暂无释义',
    phonetic: item.phonetic || '',
    example: item.example || '',
    exampleTranslation: item.exampleTranslation || '',
    masteryScore: item.masteryScore,
    wrongCount: item.wrongCount,
    reasons: Array.isArray(item.reasons) ? item.reasons : []
  }
}

async function buildMasteryReviewQueue(userId, wordbookId, limit) {
  const now = new Date()
  const rows = await getMasteryWords(userId, { wordbookId, limit, mode: 'due' })
  let candidates = rows
  if (candidates.length < limit) {
    const weakRows = await getMasteryWords(userId, { wordbookId, limit: limit - candidates.length, mode: 'weak' })
    const seen = new Set(candidates.map(item => String(item.wordId)))
    candidates = [...candidates, ...weakRows.filter(item => !seen.has(String(item.wordId)))]
  }

  const wordIds = candidates
    .map(item => item.wordId)
    .filter(item => mongoose.Types.ObjectId.isValid(String(item)))
  const vocabRows = await VocabularyBank.find({ _id: { $in: wordIds } }).lean()
  const vocabMap = new Map(vocabRows.map(item => [String(item._id), item]))

  return candidates.map(item => {
    const vocab = vocabMap.get(String(item.wordId)) || {}
    const reasons = []
    if (item.nextReviewAt && item.nextReviewAt <= now) reasons.push('due')
    if (item.masteryScore < 60) reasons.push('low_mastery')
    if (item.recentErrorTypes?.length) reasons.push(...item.recentErrorTypes.slice(0, 2))
    return normalizeReviewWord({
      ...vocab,
      _id: item.wordId,
      wordId: item.wordId,
      word: item.word || vocab.word,
      masteryScore: item.masteryScore,
      wrongCount: item.wrongCount,
      reasons: [...new Set(reasons)]
    })
  })
}

// 今日复习队列：优先基于 WordMastery，到期/低分/错误类型；保留旧 QuizRecord fallback
router.get('/review/today', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)
    const wordbookId = sanitizeWordbookId(req.query.wordbookId || 'cet4')
    const masteryQueue = await buildMasteryReviewQueue(req.userId, wordbookId, limit)
    if (masteryQueue.length > 0) {
      return res.json({ success: true, data: masteryQueue })
    }
    const queue = await getTodayReviewQueue(req.userId, limit)
    res.json({ success: true, data: queue })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 提交答题记录
// H-01 修复：服务端验证答案正确性和分数，不信任客户端上报值
router.post('/quiz-record', authMiddleware, async (req, res) => {
  try {
    if (!req.body || !req.body.word || !req.body.questionType) {
      return res.status(400).json({ error: '缺少必要的答题参数' })
    }
    const {
      wordId,
      word,
      questionType,
      isCorrect: clientIsCorrect,
      responseTime,
      timeLimit,
      difficulty,
      hintUsed,
      npcInteraction,
      sessionId,
      chapter,
      level,
      playerAnswer,
      correctAnswer: clientCorrectAnswer,
      combo,
      answerQuality: clientAnswerQuality,
      editDistance: clientEditDistance,
      similarity: clientSimilarity,
      scoreRatio: clientScoreRatio,
      fuzzyFeedback: clientFuzzyFeedback,
      sourceMode,
      wordbookId,
      metadata
    } = req.body
    const safeWordbookId = sanitizeWordbookId(wordbookId || 'cet4')
    const safeSourceMode = normalizeSourceMode(sourceMode || (req.body?.isBossQuiz ? 'boss' : 'mainline'))

    // ── 服务端答案验证 ──
    const verification = await verifyAnswer(wordId, playerAnswer, questionType, { responseTime, timeLimit })

    // verified=true → 使用服务端结果；否则降级使用客户端值（wordId 未知/找不到时）
    const isCorrect = verification.verified ? verification.isCorrect : !!clientIsCorrect
    const correctAnswer = verification.verified ? verification.correctAnswer : (clientCorrectAnswer || '')
    const answerQuality = verification.verified ? verification.answerQuality : (clientAnswerQuality || (isCorrect ? 'exact' : 'wrong'))
    const editDistance = verification.verified ? verification.editDistance : (clientEditDistance ?? null)
    const similarity = verification.verified ? verification.similarity : (Number(clientSimilarity) || (isCorrect ? 1 : 0))
    const scoreRatio = verification.verified ? verification.scoreRatio : (Number(clientScoreRatio) || (isCorrect ? 1 : 0))
    const fuzzyFeedback = verification.verified ? verification.feedback : (clientFuzzyFeedback || '')
    const safeAnswerQuality = ['exact', 'near', 'wrong'].includes(answerQuality) ? answerQuality : (isCorrect ? 'exact' : 'wrong')
    const safeEditDistance = editDistance === null || editDistance === undefined ? null : Math.max(0, Math.min(Math.round(Number(editDistance) || 0), 100))
    const safeSimilarity = Math.max(0, Math.min(Number(similarity) || 0, 1))
    const safeScoreRatio = Math.max(0, Math.min(Number(scoreRatio) || 0, 1))
    const errorType = verification.errorType || classifyError({ questionType, playerAnswer, correctAnswer, answerQuality: safeAnswerQuality, responseTime, timeLimit, isCorrect })

    // ── 服务端计算分数 ──
    const serverScore = calculateServerScore(isCorrect, responseTime, combo, difficulty, hintUsed, safeScoreRatio)

    const record = new QuizRecord({
      userId: req.userId,
      wordId,
      wordbookId: safeWordbookId,
      word,
      questionType,
      sourceMode: safeSourceMode,
      errorType,
      isCorrect,
      responseTime,
      timeLimit,
      difficulty,
      hintUsed,
      npcInteraction,
      sessionId,
      chapter,
      level,
      playerAnswer,
      correctAnswer,
      answerQuality: safeAnswerQuality,
      editDistance: safeEditDistance,
      similarity: safeSimilarity,
      scoreRatio: safeScoreRatio,
      fuzzyFeedback,
      serverScore,
      metadata: metadata && typeof metadata === 'object' ? metadata : {}
    })
    await record.save()
    const masteryUpdate = await updateFromQuizRecord(record)

    // 记录学习日志（使用服务端验证后的 isCorrect）
    await new LearningLog({
      userId: req.userId,
      eventType: 'quiz',
      eventData: { wordId, wordbookId: safeWordbookId, isCorrect, difficulty, sourceMode: safeSourceMode, errorType },
      sessionId
    }).save()

    const adaptiveDifficulty = await getAdaptiveDifficulty(req.userId)

    res.json({
      success: true,
      data: {
        record,
        adaptiveDifficulty,
        mastery: masteryUpdate.mastery,
        masteryDelta: masteryUpdate.delta,
        serverVerified: verification.verified,
        serverIsCorrect: isCorrect,
        serverScore,
        errorType,
        answerQuality: safeAnswerQuality,
        editDistance: safeEditDistance,
        similarity: safeSimilarity,
        scoreRatio: safeScoreRatio,
        fuzzyFeedback,
        wordKnowledge: verification.wordKnowledge || null
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

router.get('/mastery/summary', authMiddleware, async (req, res) => {
  try {
    const summary = await getMasterySummary(req.userId, sanitizeWordbookId(req.query.wordbookId || 'cet4'))
    res.json({ success: true, data: summary })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '获取掌握度概览失败' })
  }
})

router.get('/mastery/words', authMiddleware, async (req, res) => {
  try {
    const words = await getMasteryWords(req.userId, req.query)
    res.json({ success: true, data: words })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '获取掌握度词表失败' })
  }
})

router.post('/review/sessions', authMiddleware, async (req, res) => {
  try {
    const wordbookId = sanitizeWordbookId(req.body?.wordbookId || 'cet4')
    const limit = Math.min(Math.max(parseInt(req.body?.limit) || 20, 1), 100)
    const words = await buildMasteryReviewQueue(req.userId, wordbookId, limit)
    const session = await ReviewSession.create({ userId: req.userId, wordbookId, words, status: 'created' })
    res.status(201).json({ success: true, data: { sessionId: session._id, words } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '创建复习会话失败' })
  }
})

router.post('/review/sessions/:id/submit', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: '无效复习会话ID' })
    const session = await ReviewSession.findOne({ _id: req.params.id, userId: req.userId })
    if (!session) return res.status(404).json({ success: false, message: '复习会话不存在' })
    if (session.status === 'submitted') return res.status(409).json({ success: false, message: '复习会话已提交' })

    const answerMap = new Map((Array.isArray(req.body?.answers) ? req.body.answers : []).map(item => [String(item.wordId), item]))
    const records = []
    for (const word of session.words) {
      const submitted = answerMap.get(String(word.wordId)) || {}
      const playerAnswer = String(submitted.playerAnswer ?? submitted.answer ?? '').slice(0, 200)
      const correctAnswer = String(word.meaning || '')
      const isCorrect = Boolean(submitted.isCorrect ?? (playerAnswer.trim() === correctAnswer.trim()))
      const responseTime = Math.max(0, Math.min(Number(submitted.responseTime) || 0, 300000))
      const errorType = classifyError({ questionType: 'choice_en2cn', playerAnswer, correctAnswer, answerQuality: isCorrect ? 'exact' : 'wrong', responseTime, timeLimit: submitted.timeLimit, isCorrect })
      const record = await QuizRecord.create({
        userId: req.userId,
        wordId: word.wordId,
        wordbookId: session.wordbookId,
        word: word.word,
        questionType: 'choice_en2cn',
        sourceMode: 'review',
        errorType,
        isCorrect,
        responseTime,
        difficulty: 1,
        hintUsed: false,
        npcInteraction: false,
        sessionId: String(session._id),
        chapter: 1,
        level: 1,
        playerAnswer,
        correctAnswer,
        answerQuality: isCorrect ? 'exact' : 'wrong',
        similarity: isCorrect ? 1 : 0,
        scoreRatio: isCorrect ? 1 : 0,
        serverScore: isCorrect ? 100 : 0,
        metadata: { reviewSessionId: String(session._id) }
      })
      records.push(record)
    }

    const masteryResult = await updateFromQuizRecords(records)
    session.status = 'submitted'
    session.submittedAt = new Date()
    session.answers = records.map((record, index) => ({
      wordId: record.wordId,
      playerAnswer: record.playerAnswer,
      correctAnswer: record.correctAnswer,
      isCorrect: record.isCorrect,
      responseTime: record.responseTime,
      errorType: record.errorType,
      quizRecordId: record._id,
      masteryId: masteryResult.results[index]?.mastery?._id || null
    }))
    await session.save()

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        masteryUpdated: masteryResult.updated,
        results: masteryResult.results.map(item => ({
          masteryId: item.mastery?._id,
          word: item.mastery?.word,
          masteryScore: item.mastery?.masteryScore,
          nextReviewAt: item.mastery?.nextReviewAt,
          delta: item.delta
        }))
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '提交复习会话失败' })
  }
})

// 学习统计概览
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId)
    const wordbookId = sanitizeWordbookId(req.query.wordbookId || 'cet4')
    const match = { userId, wordbookId }
    const query = { userId: req.userId, wordbookId }
    const [totalQuizzes, correctQuizzes, uniqueWords, masteredWords, studyTimeRows, totalVocabCount, masterySummary] = await Promise.all([
      QuizRecord.countDocuments(query),
      QuizRecord.countDocuments({ ...query, isCorrect: true }),
      QuizRecord.distinct('wordId', query),
      QuizRecord.aggregate([
        { $match: match },
        { $group: { _id: '$wordId', correctCount: { $sum: { $cond: ['$isCorrect', 1, 0] } }, totalCount: { $sum: 1 } } },
        { $match: { $expr: { $gte: [{ $divide: ['$correctCount', '$totalCount'] }, 0.8] }, totalCount: { $gte: 3 } } }
      ]),
      QuizRecord.aggregate([
        { $match: match },
        { $group: { _id: null, totalResponseTime: { $sum: '$responseTime' } } }
      ]),
      VocabularyBank.countDocuments({ wordbookId }),
      getMasterySummary(req.userId, wordbookId)
    ])
    const totalStudyTime = Math.round(Number(studyTimeRows[0]?.totalResponseTime || 0) / 60000)
    res.json({
      success: true,
      data: {
        totalQuizzes,
        correctRate: totalQuizzes > 0 ? (correctQuizzes / totalQuizzes * 100).toFixed(1) : 0,
        wordsLearned: uniqueWords.length,
        wordsMastered: masterySummary.total > 0 ? masterySummary.mastered : masteredWords.length,
        totalStudyTime,
        totalVocabCount,
        wordbookId,
        masterySummary
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

router.get('/error-types', authMiddleware, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365)
    const wordbookId = sanitizeWordbookId(req.query.wordbookId || 'cet4')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const match = {
      userId: new mongoose.Types.ObjectId(req.userId),
      wordbookId,
      createdAt: { $gte: startDate }
    }
    const [errorTypes, sourceModes] = await Promise.all([
      QuizRecord.aggregate([
        { $match: match },
        { $group: { _id: { $ifNull: ['$errorType', 'unknown'] }, count: { $sum: 1 } } },
        { $project: { _id: 0, errorType: '$_id', count: 1 } },
        { $sort: { count: -1, errorType: 1 } }
      ]),
      QuizRecord.aggregate([
        { $match: match },
        { $group: { _id: { $ifNull: ['$sourceMode', 'mainline'] }, count: { $sum: 1 } } },
        { $project: { _id: 0, sourceMode: '$_id', count: 1 } },
        { $sort: { count: -1, sourceMode: 1 } }
      ])
    ])
    res.json({ success: true, data: { wordbookId, days, errorTypes, sourceModes } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '获取错因统计失败' })
  }
})

// 每日学习统计
router.get('/daily-stats', authMiddleware, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const userObjId = new mongoose.Types.ObjectId(req.userId)
    const stats = await QuizRecord.aggregate([
      { $match: { userId: userObjId, createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: 1 }, correct: { $sum: { $cond: ['$isCorrect', 1, 0] } }, avgTime: { $avg: '$responseTime' } } },
      { $sort: { _id: 1 } }
    ])
    res.json({ success: true, data: stats })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 各章节正确率
router.get('/chapter-stats', authMiddleware, async (req, res) => {
  try {
    const userObjId = new mongoose.Types.ObjectId(req.userId)
    const stats = await QuizRecord.aggregate([
      { $match: { userId: userObjId } },
      { $group: { _id: '$chapter', total: { $sum: 1 }, correct: { $sum: { $cond: ['$isCorrect', 1, 0] } } } },
      { $sort: { _id: 1 } }
    ])
    res.json({ success: true, data: stats.map(s => ({ chapter: s._id, correctRate: (s.correct / s.total * 100).toFixed(1), total: s.total })) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 易错词汇 Top N
router.get('/top-mistakes', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100)
    const userObjId = new mongoose.Types.ObjectId(req.userId)
    const mistakes = await QuizRecord.aggregate([
      { $match: { userId: userObjId } },
      { $group: { _id: { wordId: '$wordId', word: '$word' }, wrongCount: { $sum: { $cond: ['$isCorrect', 0, 1] } }, totalCount: { $sum: 1 } } },
      { $match: { wrongCount: { $gte: 1 } } },
      { $sort: { wrongCount: -1 } },
      { $limit: limit },
      { $lookup: { from: 'vocabularybanks', let: { wid: '$_id.wordId' }, pipeline: [{ $match: { $expr: { $eq: ['$_id', { $toObjectId: '$$wid' }] } } }, { $project: { meaning: 1, phonetic: 1, example: 1, exampleTranslation: 1, difficulty: 1 } }], as: 'vocabInfo' } },
      { $unwind: { path: '$vocabInfo', preserveNullAndEmptyArrays: true } },
      { $project: { _id: '$_id.wordId', wordId: '$_id.wordId', word: '$_id.word', meaning: { $ifNull: ['$vocabInfo.meaning', '未知释义'] }, phonetic: { $ifNull: ['$vocabInfo.phonetic', ''] }, example: { $ifNull: ['$vocabInfo.example', ''] }, exampleTranslation: { $ifNull: ['$vocabInfo.exampleTranslation', ''] }, difficulty: { $ifNull: ['$vocabInfo.difficulty', 1] }, wrongCount: 1, totalCount: 1, errorRate: { $round: [{ $multiply: [{ $divide: ['$wrongCount', '$totalCount'] }, 100] }, 1] } } }
    ])
    res.json({ success: true, data: mistakes })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 学习热力图
router.get('/heatmap', authMiddleware, async (req, res) => {
  try {
    const year = Math.min(Math.max(parseInt(req.query.year) || new Date().getFullYear(), 2000), 2100)
    const startDate = new Date(`${year}-01-01`)
    const endDate = new Date(`${year}-12-31`)
    const userObjId = new mongoose.Types.ObjectId(req.userId)
    const heatmap = await QuizRecord.aggregate([
      { $match: { userId: userObjId, createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }
    ])
    res.json({ success: true, data: heatmap.map(h => [h._id, h.count]) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

export default router
