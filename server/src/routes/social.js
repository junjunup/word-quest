import express from 'express'
import mongoose from 'mongoose'
import { authMiddleware } from '../middleware/auth.js'
import User from '../models/User.js'
import Friendship from '../models/Friendship.js'
import AsyncChallenge from '../models/AsyncChallenge.js'
import VocabularyBank from '../models/VocabularyBank.js'
import QuizRecord from '../models/QuizRecord.js'
import { classifyError } from '../services/answerVerificationService.js'
import { updateFromQuizRecords } from '../services/masteryService.js'
import { sanitizeWordbookId } from '../services/courseMapService.js'

const router = express.Router()
const MAX_QUERY_LENGTH = 30

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeAnswer(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z\s-]/g, '').replace(/\s+/g, ' ')
}

function publicUser(user) {
  if (!user) return null
  return {
    id: user._id?.toString?.() || user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    level: user.level,
    totalScore: user.totalScore
  }
}

function isParticipant(doc, userId) {
  const id = userId.toString()
  return doc.participants?.some(item => item.toString() === id)
}

function serializeFriendship(doc, currentUserId) {
  const current = currentUserId.toString()
  const friend = doc.requester?._id?.toString?.() === current ? doc.recipient : doc.requester
  return {
    id: doc._id,
    status: doc.status,
    direction: doc.requester?._id?.toString?.() === current ? 'outgoing' : 'incoming',
    friend: publicUser(friend),
    requestedAt: doc.requestedAt,
    respondedAt: doc.respondedAt,
    updatedAt: doc.updatedAt
  }
}

function sanitizeChallengeWords(words = []) {
  return words.map(item => ({
    wordId: item.wordId,
    word: item.word,
    meaning: item.meaning,
    phonetic: item.phonetic,
    example: item.example,
    exampleTranslation: item.exampleTranslation
  }))
}

function serializeChallenge(doc, currentUserId) {
  const current = currentUserId.toString()
  const challenger = doc.challenger?._id ? doc.challenger : null
  const opponent = doc.opponent?._id ? doc.opponent : null
  const mySubmission = doc.submissions?.find(item => item.userId.toString() === current)
  const opponentSubmission = doc.submissions?.find(item => item.userId.toString() !== current)
  return {
    id: doc._id,
    challenger: publicUser(challenger),
    opponent: publicUser(opponent),
    wordbookId: doc.wordbookId,
    wordbookName: doc.wordbookName,
    chapter: doc.chapter,
    level: doc.level,
    questionCount: doc.questionCount,
    status: doc.status,
    winner: doc.winner?.toString?.() || doc.winner || null,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    words: sanitizeChallengeWords(doc.words),
    mySubmission: mySubmission ? {
      score: mySubmission.score,
      correctCount: mySubmission.correctCount,
      submittedAt: mySubmission.submittedAt,
      answers: mySubmission.answers
    } : null,
    opponentSubmission: opponentSubmission ? {
      score: opponentSubmission.score,
      correctCount: opponentSubmission.correctCount,
      submittedAt: opponentSubmission.submittedAt
    } : null
  }
}

async function findAcceptedFriendship(userA, userB) {
  return Friendship.findOne({ users: { $all: [userA, userB] }, status: 'accepted' })
}

// 用户搜索：用于添加好友
router.get('/users/search', authMiddleware, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, MAX_QUERY_LENGTH)
    if (q.length < 2) return res.json({ success: true, data: [] })
    const regex = new RegExp(escapeRegex(q), 'i')
    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [{ username: regex }, { nickname: regex }]
    }).select('username nickname avatar level totalScore').limit(10).lean()
    res.json({ success: true, data: users.map(publicUser) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '搜索用户失败' })
  }
})

// 好友列表 + 待处理请求
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const rows = await Friendship.find({ users: req.userId, status: { $in: ['pending', 'accepted'] } })
      .populate('requester', 'username nickname avatar level totalScore')
      .populate('recipient', 'username nickname avatar level totalScore')
      .sort({ updatedAt: -1 })
    res.json({ success: true, data: rows.map(row => serializeFriendship(row, req.userId)) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '获取好友列表失败' })
  }
})

// 发起好友请求
router.post('/friends/request', authMiddleware, async (req, res) => {
  try {
    const rawTarget = String(req.body?.userId || req.body?.username || '').trim()
    if (!rawTarget) return res.status(400).json({ success: false, message: '请选择要添加的用户' })
    const target = mongoose.Types.ObjectId.isValid(rawTarget)
      ? await User.findById(rawTarget)
      : await User.findOne({ username: rawTarget })
    if (!target) return res.status(404).json({ success: false, message: '用户不存在' })
    if (target._id.toString() === req.userId.toString()) {
      return res.status(400).json({ success: false, message: '不能添加自己为好友' })
    }

    const existing = await Friendship.findOne({ users: { $all: [req.userId, target._id] }, status: { $in: ['pending', 'accepted', 'blocked'] } })
    if (existing) {
      return res.status(409).json({ success: false, message: existing.status === 'accepted' ? '你们已经是好友' : '好友请求已存在或被限制' })
    }

    const friendship = await Friendship.create({ requester: req.userId, recipient: target._id, status: 'pending' })
    const populated = await Friendship.findById(friendship._id)
      .populate('requester', 'username nickname avatar level totalScore')
      .populate('recipient', 'username nickname avatar level totalScore')
    res.status(201).json({ success: true, data: serializeFriendship(populated, req.userId) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '发送好友请求失败' })
  }
})

// 接受/拒绝好友请求
router.post('/friends/:id/respond', authMiddleware, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id)
    if (!friendship || friendship.recipient.toString() !== req.userId.toString() || friendship.status !== 'pending') {
      return res.status(404).json({ success: false, message: '待处理好友请求不存在' })
    }
    friendship.status = req.body?.accept === false ? 'declined' : 'accepted'
    friendship.respondedAt = new Date()
    friendship.lastInteractionAt = new Date()
    await friendship.save()
    const populated = await Friendship.findById(friendship._id)
      .populate('requester', 'username nickname avatar level totalScore')
      .populate('recipient', 'username nickname avatar level totalScore')
    res.json({ success: true, data: serializeFriendship(populated, req.userId) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '处理好友请求失败' })
  }
})

// 删除好友或撤销待处理请求
router.delete('/friends/:id', authMiddleware, async (req, res) => {
  try {
    const friendship = await Friendship.findOne({ _id: req.params.id, users: req.userId })
    if (!friendship) return res.status(404).json({ success: false, message: '好友关系不存在' })
    await friendship.deleteOne()
    res.json({ success: true, data: { id: req.params.id } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '删除好友失败' })
  }
})

// 创建异步 PK：双方使用同一组服务端抽取的词，保证公平
router.post('/challenges', authMiddleware, async (req, res) => {
  try {
    const opponentId = String(req.body?.opponentId || '').trim()
    if (!mongoose.Types.ObjectId.isValid(opponentId) || opponentId === req.userId.toString()) {
      return res.status(400).json({ success: false, message: '请选择有效好友作为对手' })
    }
    const friendship = await findAcceptedFriendship(req.userId, opponentId)
    if (!friendship) return res.status(403).json({ success: false, message: '只能向已接受好友发起 PK' })

    const questionCount = Math.min(20, Math.max(3, Number.parseInt(req.body?.questionCount, 10) || 10))
    const wordbookId = sanitizeWordbookId(req.body?.wordbookId || 'cet4')
    const chapter = Number.parseInt(req.body?.chapter, 10) || null
    const level = Number.parseInt(req.body?.level, 10) || null
    const match = { wordbookId }
    if (chapter) match.chapter = chapter
    if (level) match.level = level

    const words = await VocabularyBank.aggregate([
      { $match: match },
      { $sample: { size: questionCount } },
      { $project: { word: 1, meaning: 1, phonetic: 1, example: 1, exampleTranslation: 1, wordbookName: 1 } }
    ])
    if (words.length < questionCount) {
      return res.status(400).json({ success: false, message: `当前范围词量不足，需要至少 ${questionCount} 个词` })
    }

    const challenge = await AsyncChallenge.create({
      challenger: req.userId,
      opponent: opponentId,
      wordbookId,
      wordbookName: words[0]?.wordbookName || wordbookId,
      chapter,
      level,
      questionCount,
      words: words.map(item => ({
        wordId: item._id,
        word: item.word,
        meaning: item.meaning,
        phonetic: item.phonetic,
        example: item.example,
        exampleTranslation: item.exampleTranslation
      }))
    })
    const populated = await AsyncChallenge.findById(challenge._id)
      .populate('challenger', 'username nickname avatar level totalScore')
      .populate('opponent', 'username nickname avatar level totalScore')
    res.status(201).json({ success: true, data: serializeChallenge(populated, req.userId) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '创建异步 PK 失败' })
  }
})

// 获取我的异步 PK 列表
router.get('/challenges', authMiddleware, async (req, res) => {
  try {
    const rows = await AsyncChallenge.find({ participants: req.userId, status: { $ne: 'cancelled' } })
      .populate('challenger', 'username nickname avatar level totalScore')
      .populate('opponent', 'username nickname avatar level totalScore')
      .sort({ updatedAt: -1 })
      .limit(50)
    res.json({ success: true, data: rows.map(row => serializeChallenge(row, req.userId)) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '获取 PK 列表失败' })
  }
})

router.get('/challenges/:id', authMiddleware, async (req, res) => {
  try {
    const challenge = await AsyncChallenge.findById(req.params.id)
      .populate('challenger', 'username nickname avatar level totalScore')
      .populate('opponent', 'username nickname avatar level totalScore')
    if (!challenge || !isParticipant(challenge, req.userId)) {
      return res.status(404).json({ success: false, message: 'PK 不存在' })
    }
    res.json({ success: true, data: serializeChallenge(challenge, req.userId) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '获取 PK 详情失败' })
  }
})

// 提交异步 PK 答案；服务端判分，防止客户端伪造分数
router.post('/challenges/:id/submit', authMiddleware, async (req, res) => {
  try {
    const challenge = await AsyncChallenge.findById(req.params.id)
      .populate('challenger', 'username nickname avatar level totalScore')
      .populate('opponent', 'username nickname avatar level totalScore')
    if (!challenge || !isParticipant(challenge, req.userId) || challenge.status === 'completed') {
      return res.status(404).json({ success: false, message: '可提交的 PK 不存在' })
    }
    if (challenge.expiresAt && challenge.expiresAt < new Date()) {
      challenge.status = 'cancelled'
      await challenge.save()
      return res.status(410).json({ success: false, message: 'PK 已过期' })
    }
    if (challenge.submissions.some(item => item.userId.toString() === req.userId.toString())) {
      return res.status(409).json({ success: false, message: '你已经提交过本场 PK' })
    }

    const answerMap = new Map((Array.isArray(req.body?.answers) ? req.body.answers : []).map(item => [String(item.wordId), item.answer]))
    const answers = challenge.words.map(item => {
      const rawAnswer = answerMap.get(String(item.wordId)) || ''
      const correct = normalizeAnswer(rawAnswer) === normalizeAnswer(item.word)
      return {
        wordId: item.wordId,
        expected: item.word,
        answer: String(rawAnswer).slice(0, 100),
        correct,
        score: correct ? 100 : 0
      }
    })
    const correctCount = answers.filter(item => item.correct).length
    const score = answers.reduce((sum, item) => sum + item.score, 0)
    challenge.submissions.push({ userId: req.userId, answers, correctCount, score, submittedAt: new Date() })

    if (challenge.submissions.length >= 2) {
      challenge.status = 'completed'
      const [first, second] = challenge.submissions
      if (first.score > second.score) challenge.winner = first.userId
      if (second.score > first.score) challenge.winner = second.userId
    } else {
      challenge.status = req.userId.toString() === challenge.challenger._id.toString() ? 'awaiting_opponent' : 'awaiting_challenger'
    }
    await challenge.save()

    const quizRecords = []
    for (const answer of answers) {
      const question = challenge.words.find(item => item.wordId.toString() === answer.wordId.toString())
      if (!question) continue
      const errorType = classifyError({
        questionType: 'choice_cn2en',
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
        questionType: 'choice_cn2en',
        sourceMode: 'pk',
        errorType,
        isCorrect: answer.correct,
        responseTime: 0,
        difficulty: 1,
        hintUsed: false,
        npcInteraction: false,
        sessionId: String(challenge._id),
        chapter: challenge.chapter || 1,
        level: challenge.level || 1,
        playerAnswer: answer.answer,
        correctAnswer: answer.expected,
        answerQuality: answer.correct ? 'exact' : 'wrong',
        similarity: answer.correct ? 1 : 0,
        scoreRatio: answer.correct ? 1 : 0,
        serverScore: answer.score,
        metadata: { asyncChallengeId: String(challenge._id) }
      }))
    }
    const masteryUpdate = await updateFromQuizRecords(quizRecords)

    const refreshed = await AsyncChallenge.findById(challenge._id)
      .populate('challenger', 'username nickname avatar level totalScore')
      .populate('opponent', 'username nickname avatar level totalScore')
    res.json({ success: true, data: { ...serializeChallenge(refreshed, req.userId), masteryUpdated: masteryUpdate.updated } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '提交 PK 答案失败' })
  }
})

export default router
