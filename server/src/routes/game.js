import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import GameProgress from '../models/GameProgress.js'
import User from '../models/User.js'

const router = express.Router()

// 获取游戏进度
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    let progress = await GameProgress.findOne({ userId: req.userId })
    if (!progress) {
      progress = new GameProgress({ userId: req.userId })
      await progress.save()
    }
    res.json({ success: true, data: progress })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 保存/更新关卡进度
router.post('/progress', authMiddleware, async (req, res) => {
  try {
    const { chapter, level, stars, score } = req.body
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 6) return res.status(400).json({ success: false, message: '无效的章节' })
    if (!Number.isInteger(level) || level < 0 || level > 5) return res.status(400).json({ success: false, message: '无效的关卡' })
    if (!Number.isInteger(stars) || stars < 0 || stars > 3) return res.status(400).json({ success: false, message: '无效的星级' })
    if (!Number.isInteger(score) || score < 0 || score > 50000) return res.status(400).json({ success: false, message: '无效的分数' })
    let progress = await GameProgress.findOne({ userId: req.userId })
    if (!progress) {
      progress = new GameProgress({ userId: req.userId })
    }

    const key = `${chapter}-${level}`
    const existing = progress.levels.get(key)
    const oldScore = existing?.score || 0
    const oldStars = existing?.stars || 0

    // 只在新分数更高时更新
    if (!existing || score > existing.score) {
      progress.levels.set(key, {
        stars,
        score,
        completed: true,
        completedAt: new Date()
      })
      progress.totalStars += (stars - oldStars)
    }

    // 解锁下一关/下一章
    if (level >= 5 && chapter < 6) {
      if (!progress.unlockedChapters.includes(chapter + 1)) {
        progress.unlockedChapters.push(chapter + 1)
      }
    }

    // 更新当前进度指针
    if (chapter > progress.currentChapter || (chapter === progress.currentChapter && level >= progress.currentLevel)) {
      progress.currentChapter = chapter
      progress.currentLevel = Math.min(level + 1, 5)
    }

    await progress.save()

    // 更新用户总分（只加差值，避免重玩时无限累加）
    const scoreDelta = Math.max(0, score - oldScore)
    const user = await User.findById(req.userId)
    user.totalScore += scoreDelta
    user.totalExp += Math.floor(scoreDelta / 2)
    user.level = user.getLevelFromExp()
    await user.save()

    res.json({ success: true, data: progress })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 排行榜
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'total' } = req.query
    let users
    if (type === 'total') {
      users = await User.find().sort({ totalScore: -1 }).limit(50).select('nickname avatar level totalScore totalExp')
    } else {
      users = await User.find().sort({ totalExp: -1 }).limit(50).select('nickname avatar level totalScore totalExp')
    }
    res.json({ success: true, data: users })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 成就列表
router.get('/achievements', authMiddleware, async (req, res) => {
  try {
    const progress = await GameProgress.findOne({ userId: req.userId })
    res.json({ success: true, data: progress?.achievements || [] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 每日登录奖励
router.post('/daily-reward', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const today = new Date().toISOString().split('T')[0]

    if (user.dailyRewardDate === today) {
      return res.status(400).json({ success: false, message: '今日奖励已领取' })
    }

    // 检查是否连续登录
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    if (user.dailyRewardDate === yesterday) {
      user.loginStreak += 1
    } else {
      user.loginStreak = 1
    }

    // 奖励：基础10经验 + 连续登录加成
    const reward = 10 + Math.min(user.loginStreak * 5, 50)
    user.totalExp += reward
    user.level = user.getLevelFromExp()
    user.dailyRewardDate = today

    await user.save()

    res.json({
      success: true,
      data: { reward, loginStreak: user.loginStreak, totalExp: user.totalExp }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

export default router
