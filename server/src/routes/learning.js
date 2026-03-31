import express from 'express'
import mongoose from 'mongoose'
import { authMiddleware } from '../middleware/auth.js'
import QuizRecord from '../models/QuizRecord.js'
import LearningLog from '../models/LearningLog.js'
import { getAdaptiveDifficulty } from '../services/adaptiveEngine.js'

const router = express.Router()

// 提交答题记录
router.post('/quiz-record', authMiddleware, async (req, res) => {
  try {
    const { wordId, word, questionType, isCorrect, responseTime, difficulty, hintUsed, npcInteraction, sessionId, chapter, level, playerAnswer, correctAnswer } = req.body
    const record = new QuizRecord({
      userId: req.userId,
      wordId, word, questionType, isCorrect, responseTime, difficulty, hintUsed, npcInteraction, sessionId, chapter, level, playerAnswer, correctAnswer
    })
    await record.save()

    // 记录学习日志
    await new LearningLog({
      userId: req.userId,
      eventType: 'quiz',
      eventData: { wordId: req.body.wordId, isCorrect: req.body.isCorrect, difficulty: req.body.difficulty },
      sessionId: req.body.sessionId
    }).save()

    // 返回自适应难度
    const adaptiveDifficulty = await getAdaptiveDifficulty(req.userId)

    res.json({ success: true, data: { record, adaptiveDifficulty } })
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

    res.json({
      success: true,
      data: {
        totalQuizzes,
        correctRate: totalQuizzes > 0 ? (correctQuizzes / totalQuizzes * 100).toFixed(1) : 0,
        wordsLearned: uniqueWords.length,
        wordsMastered: masteredWords.length,
        totalStudyTime: 0 // 通过LearningLog计算
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
    const days = parseInt(req.query.days) || 30
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
    const limit = parseInt(req.query.limit) || 10
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
      {
        $project: {
          wordId: '$_id.wordId',
          word: '$_id.word',
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
    const year = parseInt(req.query.year) || new Date().getFullYear()
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
