import express from 'express'
import mongoose from 'mongoose'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { authMiddleware } from '../middleware/auth.js'
import VocabularyBank from '../models/VocabularyBank.js'
import { generateSemanticDistractors } from '../services/distractorService.js'
import { validateVocabulary } from '../utils/vocabularyValidator.js'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function sanitizeWordbookId(value) {
  const id = String(value || 'cet4').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return id || 'cet4'
}

function sanitizeVocabularyEntry(entry, fallbackWordbookId = 'cet4', fallbackWordbookName = 'CET-4 核心词库') {
  return {
    wordbookId: sanitizeWordbookId(entry.wordbookId || fallbackWordbookId),
    wordbookName: String(entry.wordbookName || fallbackWordbookName || 'CET-4 核心词库').trim(),
    word: String(entry.word || '').trim(),
    meaning: String(entry.meaning || '').trim(),
    example: String(entry.example || '').trim(),
    exampleTranslation: String(entry.exampleTranslation || '').trim(),
    phonetic: String(entry.phonetic || '').trim(),
    difficulty: Number(entry.difficulty),
    chapter: Number(entry.chapter),
    level: Number(entry.level),
    category: String(entry.category || '').trim(),
    rootAnalysis: String(entry.rootAnalysis || '').trim(),
    memoryTip: String(entry.memoryTip || '').trim(),
    synonyms: Array.isArray(entry.synonyms) ? entry.synonyms.map(String).filter(Boolean) : [],
    antonyms: Array.isArray(entry.antonyms) ? entry.antonyms.map(String).filter(Boolean) : [],
    source: entry.source && typeof entry.source === 'object' ? entry.source : undefined
  }
}

function getWordbookFilter(req) {
  const wordbookId = sanitizeWordbookId(req.query.wordbookId || req.body?.wordbookId || 'cet4')
  return wordbookId === 'all' ? {} : { wordbookId }
}

// 词库统计：总量、章节/关卡分布、空关卡
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const filter = getWordbookFilter(req)
    const vocabulary = await VocabularyBank.find(filter, { word: 1, meaning: 1, example: 1, difficulty: 1, chapter: 1, level: 1, wordbookId: 1, wordbookName: 1 }).lean()
    const report = validateVocabulary(vocabulary)
    res.json({
      success: true,
      data: {
        wordbookId: req.query.wordbookId || 'cet4',
        total: report.total,
        duplicates: report.duplicates,
        missingFields: report.missingFields,
        invalidRanges: report.invalidRanges,
        distribution: report.distribution,
        emptyLevels: report.emptyLevels,
        isValid: report.isValid
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 自定义词库导入：支持 dry-run 校验和 upsert 写入，不清空现有词库
router.post('/import', authMiddleware, async (req, res) => {
  try {
    const dryRun = req.body?.dryRun !== false
    const rawWords = Array.isArray(req.body?.words) ? req.body.words : []
    if (rawWords.length === 0) {
      return res.status(400).json({ success: false, message: '请提供 words 数组' })
    }
    if (rawWords.length > 5000) {
      return res.status(400).json({ success: false, message: '单次最多导入 5000 个词' })
    }

    const wordbookId = sanitizeWordbookId(req.body?.wordbookId || 'cet4')
    const wordbookName = String(req.body?.wordbookName || 'CET-4 核心词库').trim()
    const words = rawWords.map(entry => sanitizeVocabularyEntry(entry, wordbookId, wordbookName))
    const report = validateVocabulary(words)
    const fatalIssues = report.missingFields.length + report.invalidRanges.length + report.duplicates.length
    if (dryRun || fatalIssues > 0) {
      return res.status(fatalIssues > 0 && !dryRun ? 400 : 200).json({
        success: fatalIssues === 0,
        data: { dryRun: true, report },
        message: fatalIssues > 0 ? '词库存在必填、范围或重复问题，请修正后再导入' : '词库校验通过，可执行导入'
      })
    }

    const operations = words.map(word => ({
      updateOne: {
        filter: { wordbookId: word.wordbookId, word: word.word },
        update: { $set: word },
        upsert: true
      }
    }))
    const result = await VocabularyBank.bulkWrite(operations, { ordered: false })
    res.json({
      success: true,
      data: {
        dryRun: false,
        report,
        imported: words.length,
        matched: result.matchedCount || 0,
        modified: result.modifiedCount || 0,
        upserted: result.upsertedCount || 0
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '词库导入失败' })
  }
})

// 词书列表：供前端切换 CET-4/CET-6/考研/自定义词书
router.get('/wordbooks', authMiddleware, async (req, res) => {
  try {
    const rows = await VocabularyBank.aggregate([
      {
        $group: {
          _id: '$wordbookId',
          name: { $first: '$wordbookName' },
          total: { $sum: 1 },
          chapters: { $addToSet: '$chapter' }
        }
      },
      { $sort: { _id: 1 } }
    ])
    if (!rows.some(row => row._id === 'cet4')) {
      rows.unshift({ _id: 'cet4', name: 'CET-4 核心词库', total: 0, chapters: [] })
    }
    res.json({ success: true, data: rows.map(row => ({ wordbookId: row._id || 'cet4', name: row.name || row._id || '默认词书', total: row.total || 0, chapters: row.chapters || [] })) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '获取词书列表失败' })
  }
})

// 词库来源清单：用于企业级数据溯源和审计
router.get('/source-manifest', authMiddleware, async (req, res) => {
  try {
    const manifestPath = join(__dirname, '..', 'data', 'wordbooks', 'source-manifest.json')
    if (!existsSync(manifestPath)) {
      return res.status(404).json({ success: false, message: '词库来源清单不存在，请先运行 npm run vocab:build-wordbooks' })
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    res.json({ success: true, data: manifest })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: '读取词库来源清单失败' })
  }
})

// 按章节获取词汇
router.get('/chapter/:chapter', authMiddleware, async (req, res) => {
  try {
    const chapter = parseInt(req.params.chapter)
    const words = await VocabularyBank.find({ chapter, ...getWordbookFilter(req) }).sort({ level: 1, difficulty: 1 })
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
    const words = await VocabularyBank.find({ chapter, level, ...getWordbookFilter(req) }).sort({ difficulty: 1 })
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
