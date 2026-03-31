import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import VocabularyBank from '../models/VocabularyBank.js'

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

// 随机出题（获取干扰项）
router.get('/quiz/:wordId', authMiddleware, async (req, res) => {
  try {
    const word = await VocabularyBank.findById(req.params.wordId)
    if (!word) return res.status(404).json({ success: false, message: '词汇不存在' })

    // 获取同章节的3个干扰项（meaning 不能与正确答案相同）
    const distractors = await VocabularyBank.aggregate([
      { $match: { chapter: word.chapter, _id: { $ne: word._id }, meaning: { $ne: word.meaning } } },
      { $sample: { size: 3 } },
      { $project: { word: 1, meaning: 1 } }
    ])

    res.json({
      success: true,
      data: {
        question: word,
        distractors: distractors.map(d => ({ id: d._id, word: d.word, meaning: d.meaning }))
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
