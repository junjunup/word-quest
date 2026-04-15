import express from 'express'
import mongoose from 'mongoose'
import { authMiddleware } from '../middleware/auth.js'
import QuizRecord from '../models/QuizRecord.js'
import LearningLog from '../models/LearningLog.js'
import VocabularyBank from '../models/VocabularyBank.js'
import { getAdaptiveDifficulty } from '../services/adaptiveEngine.js'
import { verifyAnswer, calculateServerScore } from '../services/answerVerificationService.js'

const router = express.Router()

// 提交答题记录
// H-01 修复：服务端验证答案正确性和分数，不信任客户端上报值
router.post('/quiz-record', authMiddleware, async (req, res) => {
  try {
    if (!req.body || !req.body.word || !req.body.questionType) {
      return res.status(400).json({ error: '缺少必要的答题参数' })
    }
    const { wordId, word, questionType, isCorrect: clientIsCorrect, responseTime, difficulty, hintUsed, npcInteraction, sessionId, chapter, level, playerAnswer, correctAnswer: clientCorrectAnswer, combo } = req.body

    // ── 服务端答案验证 ──
    const verification = await verifyAnswer(wordId, playerAnswer, questionType)

    // verified=true → 使用服务端结果；否则降级使用客户端值（wordId 未知/找不到时）
    const isCorrect = verification.verified ? verification.isCorrect : !!clientIsCorrect
    const correctAnswer = verification.verified ? verification.correctAnswer : (clientCorrectAnswer || '')

    // ── 服务端计算分数 ──
    const serverScore = calculateServerScore(isCorrect, responseTime, combo, difficulty, hintUsed)

    const record = new QuizRecord({
      userId: req.userId,
      wordId, word, questionType,
      isCorrect,           // 服务端验证值
      responseTime, difficulty, hintUsed, npcInteraction, sessionId, chapter, level,
      playerAnswer,
      correctAnswer         // 服务端查到的正确答案
    })
    await record.save()

    // 记录学习日志（使用服务端验证后的 isCorrect）
    await new LearningLog({
      userId: req.userId,
      eventType: 'quiz',
      eventData: { wordId, isCorrect, difficulty: difficulty },
      sessionId
    }).save()

    // 返回自适应难度
    const adaptiveDifficulty = await getAdaptiveDifficulty(req.userId)

    // 返回服务端验证结果，让客户端可以对账
    res.json({
      success: true,
      data: {
        record,
        adaptiveDifficulty,
        serverVerified: verification.verified,
        serverIsCorrect: isCorrect,
        serverScore
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 学习统计概览
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId)

    const totalQuizzes = await QuizRecord.countDocuments({ userId: req.userId })
    const correctQuizzes = await QuizRecord.countDocuments({ userId: req.userId, isCorrect: true })
    const uniqueWords = await QuizRecord.distinct('wordId', { userId: req.userId })
    const masteredWords = await QuizRecord.aggregate([
      { $match: { userId } },
      { $group: { _id: '$wordId', correctCount: { $sum: { $cond: ['$isCorrect', 1, 0] } }, totalCount: { $sum: 1 } } },
      { $match: { $expr: { $gte: [{ $divide: ['$correctCount', '$totalCount'] }, 0.8] }, totalCount: { $gte: 3 } } }
    ])

    // 获取词库总词汇数
    const totalVocabCount = await VocabularyBank.countDocuments()

    res.json({
      success: true,
      data: {
        totalQuizzes,
        correctRate: totalQuizzes > 0 ? (correctQuizzes / totalQuizzes * 100).toFixed(1) : 0,
        wordsLearned: uniqueWords.length,
        wordsMastered: masteredWords.length,
        totalStudyTime: 0, // 通过LearningLog计算
        totalVocabCount
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
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
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
          avgTime: { $avg: '$responseTime' }
        }
      },
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
      {
        $group: {
          _id: '$chapter',
          total: { $sum: 1 },
          correct: { $sum: { $cond: ['$isCorrect', 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ])

    res.json({
      success: true,
      data: stats.map(s => ({
        chapter: s._id,
        correctRate: (s.correct / s.total * 100).toFixed(1),
        total: s.total
      }))
    })
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
      {
        $group: {
          _id: { wordId: '$wordId', word: '$word' },
          wrongCount: { $sum: { $cond: ['$isCorrect', 0, 1] } },
          totalCount: { $sum: 1 }
        }
      },
      { $match: { wrongCount: { $gte: 1 } } },
      { $sort: { wrongCount: -1 } },
      { $limit: limit },
      // 关联词库补全 meaning/phonetic/example 等字段（错词复习模式需要）
      {
        $lookup: {
          from: 'vocabularybanks',
          let: { wid: '$_id.wordId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', { $toObjectId: '$$wid' }] } } },
            { $project: { meaning: 1, phonetic: 1, example: 1, exampleTranslation: 1, difficulty: 1 } }
          ],
          as: 'vocabInfo'
        }
      },
      { $unwind: { path: '$vocabInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: '$_id.wordId',
          wordId: '$_id.wordId',
          word: '$_id.word',
          meaning: { $ifNull: ['$vocabInfo.meaning', '未知释义'] },
          phonetic: { $ifNull: ['$vocabInfo.phonetic', ''] },
          example: { $ifNull: ['$vocabInfo.example', ''] },
          exampleTranslation: { $ifNull: ['$vocabInfo.exampleTranslation', ''] },
          difficulty: { $ifNull: ['$vocabInfo.difficulty', 1] },
          wrongCount: 1,
          totalCount: 1,
          errorRate: { $round: [{ $multiply: [{ $divide: ['$wrongCount', '$totalCount'] }, 100] }, 1] }
        }
      }
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
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      }
    ])

    res.json({ success: true, data: heatmap.map(h => [h._id, h.count]) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

export default router
