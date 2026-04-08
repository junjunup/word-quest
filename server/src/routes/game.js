import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import GameProgress from '../models/GameProgress.js'
import QuizRecord from '../models/QuizRecord.js'
import User from '../models/User.js'
import { calculateQuizScore } from '../services/scoringService.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load levels data (static config)
let levelsData = null
function getLevelsData() {
  if (!levelsData) {
    try {
      // Try loading from the client data directory
      const levelsPath = join(__dirname, '../../../client/src/game/data/levels.json')
      levelsData = JSON.parse(readFileSync(levelsPath, 'utf-8'))
    } catch (e) {
      // Fallback: minimal structure
      levelsData = {
        chapters: Array.from({ length: 6 }, (_, i) => ({
          id: i + 1,
          name: `第${i + 1}章`,
          theme: '',
          levels: Array.from({ length: 5 }, (_, j) => ({
            id: j + 1,
            name: `第${j + 1}关`,
            wordsCount: 12
          }))
        }))
      }
    }
  }
  return levelsData
}

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
// H-01 FIX: Server-side score verification — don't blindly trust client score
router.post('/progress', authMiddleware, async (req, res) => {
  try {
    const { chapter, level, stars, score: clientScore, sessionId } = req.body
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 6) return res.status(400).json({ success: false, message: '无效的章节' })
    if (!Number.isInteger(level) || level < 1 || level > 5) return res.status(400).json({ success: false, message: '无效的关卡' })
    if (!Number.isInteger(stars) || stars < 0 || stars > 3) return res.status(400).json({ success: false, message: '无效的星级' })
    if (!Number.isInteger(clientScore) || clientScore < 0 || clientScore > 50000) return res.status(400).json({ success: false, message: '无效的分数' })

    // ── H-01 FIX: Calculate server-side score from quiz records ──
    let verifiedScore = clientScore  // fallback if no session records found

    if (sessionId) {
      // Sum up server-calculated scores from individual quiz records for this session
      const sessionRecords = await QuizRecord.find({
        userId: req.userId,
        sessionId,
        chapter,
        level
      }).lean()

      if (sessionRecords.length > 0) {
        // Recalculate score from individual quiz answers using the scoring formula
        let totalFromRecords = 0
        for (const record of sessionRecords) {
          const recordScore = calculateQuizScore(
            record.isCorrect,          // already server-verified by learning.js
            record.responseTime,
            0,                          // combo not stored per-record; use 0 for conservative calc
            record.difficulty,
            record.hintUsed
          )
          totalFromRecords += recordScore
        }

        // Use the server-calculated total. Allow a small tolerance (10%) above server total
        // to account for combo bonuses that aren't tracked per-record.
        const maxAllowedScore = Math.ceil(totalFromRecords * 1.1)
        verifiedScore = Math.min(clientScore, maxAllowedScore)
      }
    }

    // Additional hard cap: theoretical maximum per level
    // Max per word = difficulty(5) * 100 + comboBonus(50) + timeBonus(50) = 600
    // Typical level has ~12 words, so absolute max ≈ 12 * 600 = 7200
    const wordsPerLevel = 12   // default; could look up from levels.json
    const absoluteMaxScore = wordsPerLevel * 600
    const score = Math.min(verifiedScore, absoluteMaxScore)

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
      const newStars = Math.max(stars, oldStars)  // 星级只升不降
      progress.levels.set(key, {
        stars: newStars,
        score,
        completed: true,
        completedAt: new Date()
      })
      progress.totalStars += (newStars - oldStars)
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

    res.json({
      success: true,
      data: progress,
      // H-01: Return server-verified score so client can reconcile
      serverScore: score,
      scoreAdjusted: score !== clientScore
    })
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

// 保存角色选择
router.put('/character', authMiddleware, async (req, res) => {
  try {
    const { characterSpriteIndex } = req.body
    if (!Number.isInteger(characterSpriteIndex) || characterSpriteIndex < 0 || characterSpriteIndex > 7) {
      return res.status(400).json({ success: false, message: '无效的角色索引，需要0-7' })
    }
    const user = await User.findByIdAndUpdate(
      req.userId,
      { characterSpriteIndex },
      { new: true }
    ).select('-password')
    res.json({ success: true, data: user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 获取关卡地图数据（解锁状态、星级、分数）
router.get('/levels-status', authMiddleware, async (req, res) => {
  try {
    let progress = await GameProgress.findOne({ userId: req.userId })
    if (!progress) {
      progress = new GameProgress({ userId: req.userId })
      await progress.save()
    }

    const data = getLevelsData()
    const unlockedChapters = progress.unlockedChapters || [1]

    const chapters = data.chapters.map(chapter => {
      const isChapterUnlocked = unlockedChapters.includes(chapter.id)

      const levels = chapter.levels.map(level => {
        const key = `${chapter.id}-${level.id}`
        const levelData = progress.levels.get(key)

        // 解锁逻辑：
        // 1. 第1章第1关始终解锁
        // 2. 通过某关后解锁下一关
        // 3. 通过第5关解锁下一章
        let unlocked = false
        if (chapter.id === 1 && level.id === 1) {
          unlocked = true
        } else if (isChapterUnlocked) {
          if (level.id === 1) {
            unlocked = true
          } else {
            // 检查前一关是否已完成
            const prevKey = `${chapter.id}-${level.id - 1}`
            const prevLevel = progress.levels.get(prevKey)
            unlocked = !!prevLevel?.completed
          }
        }

        return {
          id: level.id,
          name: level.name,
          category: level.category,
          wordsCount: level.wordsCount,
          bossType: level.bossType || null,
          unlocked,
          completed: !!levelData?.completed,
          stars: levelData?.stars || 0,
          highScore: levelData?.score || 0
        }
      })

      return {
        id: chapter.id,
        name: chapter.name,
        theme: chapter.theme,
        description: chapter.description,
        color: chapter.color,
        unlocked: isChapterUnlocked,
        levels
      }
    })

    res.json({ success: true, data: { chapters } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

export default router
