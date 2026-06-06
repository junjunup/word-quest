import express from 'express'
import mongoose from 'mongoose'
import { authMiddleware } from '../middleware/auth.js'
import DailyChallenge from '../models/DailyChallenge.js'
import DailyChallengeAttempt from '../models/DailyChallengeAttempt.js'
import VocabularyBank from '../models/VocabularyBank.js'
import User from '../models/User.js'
import QuizRecord from '../models/QuizRecord.js'
import { classifyError } from '../services/answerVerificationService.js'
import { updateFromQuizRecords } from '../services/masteryService.js'
import { sanitizeWordbookId } from '../services/courseMapService.js'

const router = express.Router()
const DEFAULT_QUESTION_COUNT = 12

function todayString(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function previousDateString(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return todayString(date)
}

function shuffleWithSeed(items, seed) {
  const result = [...items]
  let state = 0
  for (const char of seed) state = ((state << 5) - state + char.charCodeAt(0)) >>> 0
  for (let i = result.length - 1; i > 0; i--) {
    state = (1664525 * state + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function normalizeAnswer(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function publicChallenge(challenge, attempt = null) {
  return {
    id: challenge._id,
    date: challenge.date,
    wordbookId: challenge.wordbookId,
    wordbookName: challenge.wordbookName,
    questionCount: challenge.questionCount,
    status: challenge.status,
    completed: !!attempt,
    attempt: attempt ? {
      score: attempt.score,
      correctCount: attempt.correctCount,
      questionCount: attempt.questionCount,
      durationMs: attempt.durationMs,
      streak: attempt.streak,
      rewardExp: attempt.rewardExp,
      rewardTitle: attempt.rewardTitle,
      completedAt: attempt.completedAt
    } : null,
    questions: challenge.questions.map(item => ({
      wordId: item.wordId,
      word: item.word,
      phonetic: item.phonetic,
      example: item.example,
      exampleTranslation: item.exampleTranslation,
      options: item.options
    }))
  }
}

async function createOptions(word, wordbookId, seed) {
  const distractors = await VocabularyBank.aggregate([
    { $match: { wordbookId, _id: { $ne: word._id }, meaning: { $ne: '' } } },
    { $sample: { size: 8 } },
    { $project: { meaning: 1 } }
  ])
  const options = [word.meaning, ...distractors.map(item => item.meaning).filter(Boolean)]
  return shuffleWithSeed([...new Set(options)].slice(0, 4), `${seed}:${word.word}`)
}

async function getOrCreateDailyChallenge({ date = todayString(), wordbookId = 'cet4', questionCount = DEFAULT_QUESTION_COUNT } = {}) {
  const safeWordbookId = sanitizeWordbookId(wordbookId)
  const existing = await DailyChallenge.findOne({ date, wordbookId: safeWordbookId })
  if (existing) return existing

  const words = await VocabularyBank.aggregate([
    { $match: { wordbookId: safeWordbookId, meaning: { $ne: '' } } },
    { $sample: { size: questionCount } },
    { $project: { word: 1, phonetic: 1, meaning: 1, example: 1, exampleTranslation: 1, wordbookName: 1 } }
  ])
  if (words.length < questionCount) {
    throw Object.assign(new Error(`当前词书词量不足，至少需要 ${questionCount} 个可用词`), { statusCode: 400 })
  }

  const seed = `${date}:${safeWordbookId}`
  const questions = []
  for (const word of words) {
    questions.push({
      wordId: word._id,
      word: word.word,
      phonetic: word.phonetic || '',
      meaning: word.meaning,
      example: word.example || '',
      exampleTranslation: word.exampleTranslation || '',
      options: await createOptions(word, safeWordbookId, seed)
    })
  }

  try {
    return await DailyChallenge.create({
      date,
      wordbookId: safeWordbookId,
      wordbookName: words[0]?.wordbookName || safeWordbookId,
      questionCount,
      seed,
      questions
    })
  } catch (error) {
    if (error?.code === 11000) return DailyChallenge.findOne({ date, wordbookId: safeWordbookId })
    throw error
  }
}

async function calculateStreak(userId, date) {
  const yesterday = previousDateString(date)
  const previous = await DailyChallengeAttempt.findOne({ userId, date: yesterday }).sort({ completedAt: -1 })
  return previous ? previous.streak + 1 : 1
}

function titleForStreak(streak) {
  if (streak >= 30) return '月度挑战王'
  if (streak >= 14) return '双周连胜者'
  if (streak >= 7) return '七日挑战者'
  if (streak >= 3) return '三日坚持者'
  return ''
}

router.get('/today', authMiddleware, async (req, res) => {
  try {
    const wordbookId = sanitizeWordbookId(req.query.wordbookId || 'cet4')
    const challenge = await getOrCreateDailyChallenge({ wordbookId })
    const attempt = await DailyChallengeAttempt.findOne({ challengeId: challenge._id, userId: req.userId })
    res.json({ success: true, data: publicChallenge(challenge, attempt) })
  } catch (err) {
    console.error(err)
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : '获取每日挑战失败' })
  }
})

router.post('/:id/submit', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: '无效挑战ID' })
    const challenge = await DailyChallenge.findById(req.params.id)
    if (!challenge || challenge.status !== 'active') return res.status(404).json({ success: false, message: '每日挑战不存在或已归档' })
    const exists = await DailyChallengeAttempt.findOne({ challengeId: challenge._id, userId: req.userId })
    if (exists) return res.status(409).json({ success: false, message: '今日挑战已提交', data: publicChallenge(challenge, exists) })

    const answerMap = new Map((Array.isArray(req.body?.answers) ? req.body.answers : []).map(item => [String(item.wordId), normalizeAnswer(item.answer)]))
    const answers = challenge.questions.map(item => {
      const answer = answerMap.get(String(item.wordId)) || ''
      const correct = normalizeAnswer(item.meaning) === answer
      return {
        wordId: item.wordId,
        expected: item.meaning,
        answer: answer.slice(0, 200),
        correct,
        score: correct ? 100 : 0
      }
    })
    const correctCount = answers.filter(item => item.correct).length
    const baseScore = answers.reduce((sum, item) => sum + item.score, 0)
    const durationMs = Math.max(0, Math.min(Number(req.body?.durationMs) || 0, 60 * 60 * 1000))
    const speedBonus = durationMs > 0 ? Math.max(0, Math.round((challenge.questionCount * 15000 - durationMs) / 1000)) : 0
    const score = baseScore + speedBonus
    const streak = await calculateStreak(req.userId, challenge.date)
    const rewardExp = 20 + correctCount * 2 + Math.min(streak, 30)
    const rewardTitle = titleForStreak(streak)

    const attempt = await DailyChallengeAttempt.create({
      challengeId: challenge._id,
      date: challenge.date,
      wordbookId: challenge.wordbookId,
      userId: req.userId,
      answers,
      score,
      correctCount,
      questionCount: challenge.questionCount,
      durationMs,
      streak,
      rewardExp,
      rewardTitle,
      completedAt: new Date()
    })

    const quizRecords = []
    for (const answer of answers) {
      const question = challenge.questions.find(item => item.wordId.toString() === answer.wordId.toString())
      if (!question) continue
      const errorType = classifyError({
        questionType: 'choice_en2cn',
        playerAnswer: answer.answer,
        correctAnswer: answer.expected,
        answerQuality: answer.correct ? 'exact' : 'wrong',
        responseTime: 0,
        isCorrect: answer.correct
      })
      quizRecords.push(await QuizRecord.create({
        userId: req.userId,
        wordId: answer.wordId,
        wordbookId: challenge.wordbookId,
        word: question.word,
        questionType: 'choice_en2cn',
        sourceMode: 'daily',
        errorType,
        isCorrect: answer.correct,
        responseTime: 0,
        difficulty: 1,
        hintUsed: false,
        npcInteraction: false,
        sessionId: String(attempt._id),
        chapter: 1,
        level: 1,
        playerAnswer: answer.answer,
        correctAnswer: answer.expected,
        answerQuality: answer.correct ? 'exact' : 'wrong',
        similarity: answer.correct ? 1 : 0,
        scoreRatio: answer.correct ? 1 : 0,
        serverScore: answer.score,
        metadata: { dailyChallengeId: String(challenge._id), attemptId: String(attempt._id) }
      }))
    }
    const masteryUpdate = await updateFromQuizRecords(quizRecords)

    const user = await User.findById(req.userId)
    if (user) {
      user.totalExp += rewardExp
      user.level = user.getLevelFromExp()
      await user.save()
    }

    res.status(201).json({ success: true, data: { ...publicChallenge(challenge, attempt), masteryUpdated: masteryUpdate.updated } })
  } catch (err) {
    console.error(err)
    res.status(err?.code === 11000 ? 409 : 500).json({ success: false, message: err?.code === 11000 ? '今日挑战已提交' : '提交每日挑战失败' })
  }
})

// 盲盒奖励池配置
const BLIND_BOX_POOL = {
  common: { weight: 55, goldMin: 50, goldMax: 150, expMin: 0, expMax: 0, items: [], title: '' },
  rare: { weight: 25, goldMin: 150, goldMax: 400, expMin: 30, expMax: 80, items: [], title: '' },
  epic: { weight: 15, goldMin: 200, goldMax: 500, expMin: 80, expMax: 150,
    items: [{ itemId: 'shield', name: '🛡️ 护盾', icon: '🛡️', effect: 'shield' },
            { itemId: 'time_extend', name: '⏰ 时间宝珠', icon: '⏰', effect: 'time_extend'},
            { itemId: 'double_gold', name: '💰 双倍金币符', icon: '💰', effect: 'double_gold'}] },
  legendary: { weight: 5, goldMin: 400, goldMax: 800, expMin: 150, expMax: 300,
    items: [{ itemId: 'precision', name: '🎯 精准药剂', icon: '🎯', effect: 'precision'},
            { itemId: 'extra_life', name: '❤️ 生命之泉', icon: '❤️', effect: 'extra_life'}],
    title: '传说勇者' }
}

function rollBlindBox() {
  const totalWeight = Object.values(BLIND_BOX_POOL).reduce((s, t) => s + t.weight, 0)
  let roll = Math.random() * totalWeight
  for (const [rarity, config] of Object.entries(BLIND_BOX_POOL)) {
    roll -= config.weight
    if (roll <= 0) {
      const gold = Math.floor(Math.random() * (config.goldMax - config.goldMin + 1)) + config.goldMin
      const exp = Math.floor(Math.random() * (config.expMax - config.expMin + 1)) + config.expMin
      const items = config.items.length > 0
        ? [config.items[Math.floor(Math.random() * config.items.length)]]
        : []
      if (rarity === 'legendary' && config.items.length >= 2) {
        // 传说档给2个道具
        const second = config.items.filter(i => i.itemId !== items[0].itemId)
        if (second.length > 0) items.push(second[Math.floor(Math.random() * second.length)])
      }
      return { rarity, gold, exp, items, title: config.title }
    }
  }
  return { rarity: 'common', gold: 50, exp: 0, items: [], title: '' }
}

router.post('/:id/blind-box', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: '无效挑战ID' })
    const challenge = await DailyChallenge.findById(req.params.id)
    if (!challenge) return res.status(404).json({ success: false, message: '每日挑战不存在' })
    const attempt = await DailyChallengeAttempt.findOne({ challengeId: challenge._id, userId: req.userId })
    if (!attempt) return res.status(400).json({ success: false, message: '请先完成每日挑战' })
    if (attempt.blindBoxOpened) return res.status(400).json({ success: false, message: '盲盒已开启' })

    const reward = rollBlindBox()

    const user = await User.findById(req.userId)
    if (user) {
      user.gold = (user.gold || 0) + reward.gold
      user.totalExp += reward.exp
      user.level = user.getLevelFromExp()
      // 添加道具到背包
      for (const item of reward.items) {
        const existing = user.inventory.find(i => i.itemId === item.itemId)
        if (existing) {
          existing.quantity += 1
        } else {
          user.inventory.push({ ...item, quantity: 1 })
        }
      }
      await user.save()
    }

    attempt.blindBoxOpened = true
    attempt.blindBoxReward = reward
    await attempt.save()

    res.json({ success: true, data: { reward, gold: user?.gold, totalExp: user?.totalExp } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '盲盒开箱失败' })
  }
})

router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : todayString()
    const wordbookId = sanitizeWordbookId(req.query.wordbookId || 'cet4')
    const rows = await DailyChallengeAttempt.find({ date, wordbookId })
      .populate('userId', 'username nickname avatar level')
      .sort({ score: -1, durationMs: 1, completedAt: 1 })
      .limit(50)
    res.json({
      success: true,
      data: rows.map((row, index) => ({
        rank: index + 1,
        user: row.userId ? {
          id: row.userId._id,
          username: row.userId.username,
          nickname: row.userId.nickname,
          avatar: row.userId.avatar,
          level: row.userId.level
        } : null,
        score: row.score,
        correctCount: row.correctCount,
        questionCount: row.questionCount,
        durationMs: row.durationMs,
        streak: row.streak,
        rewardTitle: row.rewardTitle,
        completedAt: row.completedAt
      }))
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '获取每日挑战排行榜失败' })
  }
})

export default router
