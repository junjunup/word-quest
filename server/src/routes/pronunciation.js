import express from 'express'
import mongoose from 'mongoose'
import { authMiddleware } from '../middleware/auth.js'
import VocabularyBank from '../models/VocabularyBank.js'
import PronunciationAttempt from '../models/PronunciationAttempt.js'
import QuizRecord from '../models/QuizRecord.js'
import { scorePronunciation } from '../services/pronunciationScoringService.js'
import { updateFromQuizRecord } from '../services/masteryService.js'

const router = express.Router()

router.post('/score', authMiddleware, async (req, res) => {
  try {
    const transcript = String(req.body?.transcript || '').trim().slice(0, 100)
    const confidence = Number(req.body?.confidence) || 0
    const wordId = String(req.body?.wordId || '').trim()
    let targetWord = String(req.body?.word || '').trim().slice(0, 80)
    let expectedPhonetic = String(req.body?.expectedPhonetic || '').trim().slice(0, 120)
    let wordbookId = String(req.body?.wordbookId || 'cet4').trim().toLowerCase()

    if (wordId && mongoose.Types.ObjectId.isValid(wordId)) {
      const entry = await VocabularyBank.findById(wordId).lean()
      if (entry) {
        targetWord = entry.word
        expectedPhonetic = entry.phonetic || expectedPhonetic
        wordbookId = entry.wordbookId || wordbookId
      }
    }

    if (!targetWord) return res.status(400).json({ success: false, message: '缺少目标单词' })
    if (!transcript) return res.status(400).json({ success: false, message: '缺少语音识别结果' })

    const scored = scorePronunciation({ word: targetWord, transcript, expectedPhonetic, confidence })
    const safeWordId = wordId && mongoose.Types.ObjectId.isValid(wordId) ? wordId : null
    const attempt = await PronunciationAttempt.create({
      userId: req.userId,
      wordId: safeWordId,
      wordbookId,
      word: targetWord,
      expectedPhonetic,
      transcript,
      confidence: Math.max(0, Math.min(1, confidence)),
      score: scored.score,
      grade: scored.grade,
      details: scored.details
    })

    const isCorrect = scored.score >= 80
    const quizRecord = await QuizRecord.create({
      userId: req.userId,
      wordId: safeWordId || `pronunciation:${targetWord}`,
      wordbookId,
      word: targetWord,
      questionType: 'pronunciation',
      sourceMode: 'pronunciation',
      errorType: isCorrect ? 'unknown' : 'pronunciation',
      isCorrect,
      responseTime: 0,
      difficulty: 1,
      hintUsed: false,
      npcInteraction: false,
      sessionId: String(attempt._id),
      chapter: 1,
      level: 1,
      playerAnswer: transcript,
      correctAnswer: targetWord,
      answerQuality: isCorrect ? 'exact' : 'wrong',
      similarity: Math.max(0, Math.min(1, scored.details?.wordSimilarity || 0)),
      scoreRatio: scored.score / 100,
      serverScore: scored.score,
      metadata: { pronunciationAttemptId: String(attempt._id), grade: scored.grade }
    })
    const masteryUpdate = await updateFromQuizRecord(quizRecord)

    res.status(201).json({
      success: true,
      data: {
        id: attempt._id,
        word: targetWord,
        expectedPhonetic,
        transcript,
        confidence: attempt.confidence,
        score: scored.score,
        grade: scored.grade,
        details: scored.details,
        mastery: masteryUpdate.mastery,
        masteryDelta: masteryUpdate.delta,
        createdAt: attempt.createdAt
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '发音评分失败' })
  }
})

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
    const word = String(req.query.word || '').trim()
    const filter = { userId: req.userId }
    if (word) filter.word = word
    const rows = await PronunciationAttempt.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
    res.json({ success: true, data: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '获取发音历史失败' })
  }
})

export default router
