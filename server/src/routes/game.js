import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import GameProgress from '../models/GameProgress.js'
import QuizRecord from '../models/QuizRecord.js'
import User from '../models/User.js'
import { calculateQuizScore } from '../services/scoringService.js'
import { getWordSelection, recommendQuestionTypes } from '../services/adaptiveEngine.js'
import { updateFromQuizRecord } from '../services/masteryService.js'
import {
  MAX_CHAPTER,
  MAX_LEVEL,
  sanitizeWordbookId,
  validateChapterLevel,
  getNextLevel,
  buildProgressKey,
  readLevelsConfig,
  getLevelWordCount
} from '../services/courseMapService.js'

const router = express.Router()

function getProgressLevel(progress, wordbookId, chapter, level) {
  const scopedKey = buildProgressKey(wordbookId, chapter, level)
  const legacyKey = `${chapter}-${level}`
  return progress.levels.get(scopedKey) || progress.levels.get(legacyKey) || null
}

function isLevelCompleted(progress, wordbookId, chapter, level) {
  return !!getProgressLevel(progress, wordbookId, chapter, level)?.completed
}

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
    const wordbookId = sanitizeWordbookId(req.body?.wordbookId || 'cet4')
    const validation = validateChapterLevel(chapter, level)
    if (!validation.valid) return res.status(400).json({ success: false, message: validation.message })
    if (!Number.isInteger(stars) || stars < 0 || stars > 3) return res.status(400).json({ success: false, message: '无效的星级' })
    if (!Number.isInteger(clientScore) || clientScore < 0 || clientScore > 50000) return res.status(400).json({ success: false, message: '无效的分数' })

    // ── H-01 FIX: Calculate server-side score from quiz records ──
    let verifiedScore = clientScore  // fallback if no session records found

    if (sessionId) {
      const sessionRecords = await QuizRecord.find({
        userId: req.userId,
        sessionId,
        chapter,
        level,
        wordbookId
      }).lean()

      if (sessionRecords.length > 0) {
        let totalFromRecords = 0
        for (const record of sessionRecords) {
          const recordScore = calculateQuizScore(
            record.isCorrect,
            record.responseTime,
            0,
            record.difficulty,
            record.hintUsed,
            record.scoreRatio || 1
          )
          totalFromRecords += recordScore
        }

        const maxAllowedScore = Math.ceil(totalFromRecords * 1.1)
        verifiedScore = Math.min(clientScore, maxAllowedScore)
      }
    }

    const wordsPerLevel = await getLevelWordCount({ wordbookId, chapter, level })
    const absoluteMaxScore = wordsPerLevel * 600
    const score = Math.min(verifiedScore, absoluteMaxScore)

    let progress = await GameProgress.findOne({ userId: req.userId })
    if (!progress) {
      progress = new GameProgress({ userId: req.userId })
    }
    progress.currentWordbookId = wordbookId

    const key = buildProgressKey(wordbookId, chapter, level)
    const legacyKey = `${chapter}-${level}`
    const existing = progress.levels.get(key) || progress.levels.get(legacyKey)
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

    const next = getNextLevel(chapter, level)
    if (next.chapterCompleted && !next.courseCompleted && !progress.unlockedChapters.includes(next.nextChapter)) {
      progress.unlockedChapters.push(next.nextChapter)
    }

    // 更新当前进度指针
    if (!next.courseCompleted && (chapter > progress.currentChapter || (chapter === progress.currentChapter && level >= progress.currentLevel))) {
      progress.currentChapter = next.nextChapter
      progress.currentLevel = next.nextLevel
    } else if (next.courseCompleted) {
      progress.currentChapter = MAX_CHAPTER
      progress.currentLevel = MAX_LEVEL
    }

    await progress.save()

    // 更新用户总分（只加差值，避免重玩时无限累加）
    const scoreDelta = Math.max(0, score - oldScore)
    const user = await User.findById(req.userId)
    if (user) {
      user.totalScore += scoreDelta
      user.totalExp += Math.floor(scoreDelta / 2)
      user.level = user.getLevelFromExp()
      await user.save()
    }

    res.json({
      success: true,
      data: progress,
      serverScore: score,
      scoreAdjusted: score !== clientScore,
      nextLevel: { chapter: next.nextChapter, level: next.nextLevel },
      chapterCompleted: next.chapterCompleted,
      courseCompleted: next.courseCompleted,
      maxLevel: next.maxLevel
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 排行榜
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const { type = 'total' } = req.query
    const users = type === 'total'
      ? await User.find().sort({ totalScore: -1 }).limit(50).select('nickname avatar level totalScore totalExp')
      : await User.find().sort({ totalExp: -1 }).limit(50).select('nickname avatar level totalScore totalExp')
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

// 保存新解锁的成就
router.post('/achievements', authMiddleware, async (req, res) => {
  try {
    const { id, name, description } = req.body
    if (!id || typeof id !== 'string' || id.length > 50) {
      return res.status(400).json({ success: false, message: '无效的成就ID' })
    }

    let progress = await GameProgress.findOne({ userId: req.userId })
    if (!progress) {
      progress = new GameProgress({ userId: req.userId })
    }

    const alreadyExists = progress.achievements.some(a => a.id === id)
    if (alreadyExists) {
      return res.json({ success: true, data: progress.achievements, duplicate: true })
    }

    progress.achievements.push({
      id,
      name: (name || '').slice(0, 50),
      description: (description || '').slice(0, 200),
      unlockedAt: new Date()
    })
    await progress.save()

    res.json({ success: true, data: progress.achievements })
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

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    if (user.dailyRewardDate === yesterday) {
      user.loginStreak += 1
    } else {
      user.loginStreak = 1
    }

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
    const user = await User.findByIdAndUpdate(req.userId, { characterSpriteIndex }, { new: true }).select('-password')
    res.json({ success: true, data: user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 获取关卡地图数据（解锁状态、星级、分数）
router.get('/levels-status', authMiddleware, async (req, res) => {
  try {
    const wordbookId = sanitizeWordbookId(req.query.wordbookId || 'cet4')
    let progress = await GameProgress.findOne({ userId: req.userId })
    if (!progress) {
      progress = new GameProgress({ userId: req.userId, currentWordbookId: wordbookId })
      await progress.save()
    }

    const data = readLevelsConfig()
    const unlockedChapters = progress.unlockedChapters || [1]

    const chapters = data.chapters.map(chapter => {
      const isChapterUnlocked = unlockedChapters.includes(chapter.id)
      const levels = chapter.levels.map(level => {
        const levelData = getProgressLevel(progress, wordbookId, chapter.id, level.id)
        let unlocked = false
        if (chapter.id === 1 && level.id === 1) {
          unlocked = true
        } else if (isChapterUnlocked) {
          if (level.id === 1) {
            unlocked = true
          } else {
            unlocked = isLevelCompleted(progress, wordbookId, chapter.id, level.id - 1)
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

    res.json({ success: true, data: { chapters, wordbookId, maxChapter: MAX_CHAPTER, maxLevel: MAX_LEVEL } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 无尽模式 - 提交成绩（只升不降）
router.post('/endless-score', authMiddleware, async (req, res) => {
  try {
    const { score, maxStreak } = req.body
    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ success: false, message: '无效分数' })
    }

    let progress = await GameProgress.findOne({ userId: req.userId })
    if (!progress) {
      progress = new GameProgress({ userId: req.userId })
    }

    let isNewRecord = false
    if (score > (progress.endlessBestScore || 0)) {
      progress.endlessBestScore = score
      isNewRecord = true
    }
    if ((maxStreak || 0) > (progress.endlessBestStreak || 0)) {
      progress.endlessBestStreak = maxStreak || 0
    }
    await progress.save()

    res.json({
      success: true,
      data: {
        bestScore: progress.endlessBestScore,
        bestStreak: progress.endlessBestStreak,
        isNewRecord
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 无尽模式 - 获取最佳成绩
router.get('/endless-score', authMiddleware, async (req, res) => {
  try {
    const progress = await GameProgress.findOne({ userId: req.userId })
    res.json({
      success: true,
      data: {
        bestScore: progress?.endlessBestScore || 0,
        bestStreak: progress?.endlessBestStreak || 0
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// ── 逐词记忆模型 API ──

// 获取推荐单词列表（逐词级优先级排序）
router.get('/adaptive/words', authMiddleware, async (req, res) => {
  try {
    const chapterId = parseInt(req.query.chapterId, 10) || 1
    const levelId = parseInt(req.query.levelId, 10) || 1
    const count = Math.min(Math.max(parseInt(req.query.count, 10) || 10, 1), 50)
    const wordbookId = sanitizeWordbookId(req.query.wordbookId || 'cet4')

    const validation = validateChapterLevel(chapterId, levelId)
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message })
    }

    const words = await getWordSelection(req.userId, chapterId, levelId, wordbookId, count)

    res.json({ success: true, data: { words, count: words.length, chapterId, levelId, wordbookId } })
  } catch (err) {
    console.error('获取推荐单词失败:', err.message)
    res.status(500).json({ success: false, message: '获取推荐单词失败' })
  }
})

// 更新单词掌握度（每次答题后调用）
router.post('/word-mastery/update', authMiddleware, async (req, res) => {
  try {
    const { wordId, chapterId, levelId, questionType, isCorrect, responseTime, answerQuality, errorType, sourceMode, sessionId, wordbookId } = req.body

    if (!wordId) {
      return res.status(400).json({ success: false, message: '缺少 wordId' })
    }

    const record = {
      userId: req.userId,
      wordId,
      wordbookId: sanitizeWordbookId(wordbookId || 'cet4'),
      chapter: chapterId,
      level: levelId,
      questionType: questionType || 'choice_en2cn',
      isCorrect: !!isCorrect,
      responseTime: responseTime || 0,
      answerQuality: answerQuality || (isCorrect ? 'exact' : 'wrong'),
      errorType: errorType || 'unknown',
      sourceMode: sourceMode || 'mainline',
      sessionId: sessionId || ''
    }

    const result = await updateFromQuizRecord(record)

    // 获取推荐题型（下次出题时使用）
    const recommendedTypes = recommendQuestionTypes(
      result.mastery?.masteryScore || 0,
      result.mastery?.learningStage || 'new'
    )

    res.json({
      success: true,
      data: {
        masteryScore: result.mastery?.masteryScore,
        delta: result.delta,
        learningStage: result.mastery?.learningStage,
        recommendedTypes
      }
    })
  } catch (err) {
    console.error('更新单词掌握度失败:', err.message)
    // 容错：失败时返回 success:false，客户端降级继续游戏
    res.status(500).json({
      success: false,
      message: '单词掌握度更新暂不可用，不影响游戏继续',
      data: {
        masteryScore: 0,
        delta: 0,
        learningStage: 'new',
        recommendedTypes: ['choice_en2cn', 'choice_cn2en']
      }
    })
  }
})

// 获取复习日历（本月每天应复习多少词）
router.get('/review/calendar', authMiddleware, async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7) // YYYY-MM
    const wordbookId = sanitizeWordbookId(req.query.wordbookId || 'cet4')
    const startDate = new Date(month + '-01')
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)

    const WordMastery = (await import('../models/WordMastery.js')).default

    const calendar = await WordMastery.aggregate([
      {
        $match: {
          userId: new (await import('mongoose')).default.Types.ObjectId(req.userId),
          wordbookId,
          nextReviewAt: { $gte: startDate, $lt: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$nextReviewAt' } },
          count: { $sum: 1 },
          weakCount: { $sum: { $cond: [{ $lt: ['$masteryScore', 50] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ])

    res.json({ success: true, data: { month, wordbookId, calendar } })
  } catch (err) {
    console.error('获取复习日历失败:', err.message)
    res.status(500).json({ success: false, message: '复习日历暂不可用', data: { month: req.query.month || '', wordbookId: 'cet4', calendar: [] } })
  }
})

export default router
