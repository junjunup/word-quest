import QuizRecord from '../models/QuizRecord.js'
import LearningLog from '../models/LearningLog.js'

/**
 * 学习数据分析服务
 */

/**
 * 获取用户综合学习报告
 */
export async function getLearningReport(userId) {
  const [
    totalStats,
    chapterStats,
    dailyTrend,
    difficultyDist,
    topMistakes
  ] = await Promise.all([
    getTotalStats(userId),
    getChapterAccuracy(userId),
    getDailyTrend(userId, 30),
    getDifficultyDistribution(userId),
    getTopMistakeWords(userId, 10)
  ])

  return {
    overview: totalStats,
    chapterAccuracy: chapterStats,
    dailyTrend,
    difficultyDistribution: difficultyDist,
    topMistakes
  }
}

async function getTotalStats(userId) {
  const result = await QuizRecord.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalQuizzes: { $sum: 1 },
        correctQuizzes: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        avgResponseTime: { $avg: '$responseTime' },
        uniqueWords: { $addToSet: '$wordId' }
      }
    }
  ])

  if (result.length === 0) {
    return { totalQuizzes: 0, correctRate: 0, avgResponseTime: 0, wordsLearned: 0 }
  }

  const r = result[0]
  return {
    totalQuizzes: r.totalQuizzes,
    correctRate: ((r.correctQuizzes / r.totalQuizzes) * 100).toFixed(1),
    avgResponseTime: Math.round(r.avgResponseTime),
    wordsLearned: r.uniqueWords.length
  }
}

async function getChapterAccuracy(userId) {
  return QuizRecord.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$chapter',
        total: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        chapter: '$_id',
        accuracy: { $round: [{ $multiply: [{ $divide: ['$correct', '$total'] }, 100] }, 1] }
      }
    }
  ])
}

async function getDailyTrend(userId, days) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  return QuizRecord.aggregate([
    { $match: { userId, createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ])
}

async function getDifficultyDistribution(userId) {
  return QuizRecord.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$difficulty',
        count: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ])
}

async function getTopMistakeWords(userId, limit) {
  return QuizRecord.aggregate([
    { $match: { userId, isCorrect: false } },
    {
      $group: {
        _id: { wordId: '$wordId', word: '$word' },
        wrongCount: { $sum: 1 }
      }
    },
    { $sort: { wrongCount: -1 } },
    { $limit: limit },
    { $project: { word: '$_id.word', wrongCount: 1 } }
  ])
}

export { getTotalStats, getChapterAccuracy, getDailyTrend, getDifficultyDistribution, getTopMistakeWords }
