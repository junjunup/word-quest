/**
 * Cycle 6: 排行榜 API
 * 周排行榜：按本周学习单词数 + 星星数排名
 */
import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import GameProgress from '../models/GameProgress.js'
import QuizRecord from '../models/QuizRecord.js'
import User from '../models/User.js'

const router = express.Router()

function getWeekRange() {
  const now = new Date()
  const dayOfWeek = now.getDay() || 7 // 周日=7，周一=1
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek + 1)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

/**
 * GET /api/leaderboard/weekly
 * 本周排行榜 Top 50，按学习单词数降序
 */
router.get('/weekly', authMiddleware, async (req, res) => {
  try {
    const { monday, sunday } = getWeekRange()
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100)

    // 聚合本周答题记录，按用户统计
    const rows = await QuizRecord.aggregate([
      { $match: { createdAt: { $gte: monday, $lte: sunday } } },
      {
        $group: {
          _id: '$userId',
          wordsLearned: { $sum: { $cond: ['$isCorrect', 1, 0] } },
          totalAnswered: { $sum: 1 },
          avgQuality: { $avg: { $cond: [{ $eq: ['$answerQuality', 'exact'] }, 1, { $cond: [{ $eq: ['$answerQuality', 'near'] }, 0.72, 0] }] } },
          lastActive: { $max: '$createdAt' }
        }
      },
      { $sort: { wordsLearned: -1, avgQuality: -1 } },
      { $limit: limit }
    ])

    if (rows.length === 0) {
      return res.json({ success: true, data: { week: { monday, sunday }, players: [], totalPlayers: 0 } })
    }

    // 补全用户昵称和星星数
    const userIds = rows.map(r => r._id)
    const [users, progresses] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('nickname avatar level').lean(),
      GameProgress.find({ userId: { $in: userIds } }).lean()
    ])

    const userMap = new Map(users.map(u => [String(u._id), u]))
    const progressMap = new Map()
    for (const p of progresses) {
      const uid = String(p.userId)
      if (!progressMap.has(uid) || (p.totalStars || 0) > (progressMap.get(uid).totalStars || 0)) {
        progressMap.set(uid, p)
      }
    }

    const players = rows.map((row, idx) => {
      const uid = String(row._id)
      const user = userMap.get(uid) || {}
      const progress = progressMap.get(uid) || {}
      return {
        rank: idx + 1,
        userId: uid,
        nickname: user.nickname || '勇者',
        avatar: user.avatar || 'default',
        level: user.level || 1,
        wordsLearned: row.wordsLearned,
        totalAnswered: row.totalAnswered,
        accuracy: row.totalAnswered > 0 ? Math.round(row.wordsLearned / row.totalAnswered * 100) : 0,
        totalStars: progress.totalStars || 0,
        lastActive: row.lastActive
      }
    })

    res.json({
      success: true,
      data: {
        week: { monday, sunday },
        players,
        totalPlayers: rows.length,
        currentUserRank: players.findIndex(p => p.userId === String(req.userId)) + 1 || null
      }
    })
  } catch (err) {
    console.error('排行榜查询失败:', err)
    res.status(500).json({ success: false, message: '获取排行榜失败' })
  }
})

/**
 * GET /api/leaderboard/all-time
 * 全时星星排行榜
 */
router.get('/all-time', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100)

    const progresses = await GameProgress.find()
      .sort({ totalStars: -1, updatedAt: -1 })
      .limit(limit * 2)  // 多取一些以防去重后不足
      .lean()

    // 去重：每用户只保留最高星记录
    const seen = new Set()
    const deduped = []
    for (const p of progresses) {
      const uid = String(p.userId)
      if (!seen.has(uid)) { seen.add(uid); deduped.push(p) }
      if (deduped.length >= limit) break
    }

    const userIds = deduped.map(p => String(p.userId))
    const users = await User.find({ _id: { $in: userIds } })
      .select('nickname avatar level').lean()
    const userMap = new Map(users.map(u => [String(u._id), u]))

    const players = deduped.map((p, idx) => {
      const user = userMap.get(String(p.userId)) || {}
      return {
        rank: idx + 1,
        userId: String(p.userId),
        nickname: user.nickname || '勇者',
        avatar: user.avatar || 'default',
        level: user.level || 1,
        totalStars: p.totalStars || 0,
        chaptersCompleted: p.chaptersCompleted || []
      }
    })

    res.json({
      success: true,
      data: {
        players,
        totalPlayers: players.length,
        currentUserRank: players.findIndex(p => p.userId === String(req.userId)) + 1 || null
      }
    })
  } catch (err) {
    console.error('全时排行榜查询失败:', err)
    res.status(500).json({ success: false, message: '获取排行榜失败' })
  }
})

export default router
