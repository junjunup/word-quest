import express from 'express'
import mongoose from 'mongoose'
import { authMiddleware } from '../middleware/auth.js'
import VocabularyBank from '../models/VocabularyBank.js'
import { generateSemanticDistractors } from '../services/distractorService.js'

const router = express.Router()

// 按章节获取词汇
router.get('/chapter/:chapter', authMiddleware, async (req, res) => {
  try {
    const chapter = parseInt(req.params.chapter)
    const words = await VocabularyBank.find({ chapter }).sort({ level: 1, difficulty: 1 })
    res.json({ success: true, data: words })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 按章节+关卡获取词汇
router.get('/chapter/:chapter/level/:level', authMiddleware, async (req, res) => {
  try {
    const chapter = parseInt(req.params.chapter)
    const level = parseInt(req.params.level)
    const words = await VocabularyBank.find({ chapter, level }).sort({ difficulty: 1 })
    res.json({ success: true, data: words })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 智能出题（获取语义干扰项）
router.get('/quiz/:wordId', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.wordId)) {
      return res.status(400).json({ error: '无效的单词ID' })
    }
    const word = await VocabularyBank.findById(req.params.wordId).lean()
    if (!word) return res.status(404).json({ success: false, message: '词汇不存在' })

    const questionType = typeof req.query.questionType === 'string'
      ? req.query.questionType
      : 'choice_en2cn'
    const distractors = await generateSemanticDistractors(word, questionType, 3)

    res.json({
      success: true,
      data: {
        question: word,
        distractors,
        strategy: 'semantic_feature_similarity'
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 搜索词汇
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query
    if (!q) return res.json({ success: true, data: [] })
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const words = await VocabularyBank.find({
      $or: [
        { word: { $regex: escapedQ, $options: 'i' } },
        { meaning: { $regex: escapedQ } }
      ]
    }).limit(20)
    res.json({ success: true, data: words })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

export default router
