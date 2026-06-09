/**
 * Cycle 3: 今日冒险 — 基于 SM-2 到期复习队列的每日复习模式
 * 合并 reviewQueueService (QuizRecord聚合) + masteryService (SM-2到期词)
 */
import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { getTodayReviewQueue } from '../services/reviewQueueService.js'
import { getMasteryWords } from '../services/masteryService.js'
import VocabularyBank from '../models/VocabularyBank.js'

const router = express.Router()

/**
 * GET /api/daily-adventure/queue
 * 获取今日冒险单词队列（合并双源 + 去重排序）
 */
router.get('/queue', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50)

    // 并行获取两个队列
    const [sm2Words, quizWords] = await Promise.all([
      getMasteryWords(req.userId, { mode: 'due', limit: 100 }).catch(() => []),
      getTodayReviewQueue(req.userId, 100).catch(() => [])
    ])

    // 合并去重（以 wordId 为键，优先保留 SM-2 数据）
    const merged = new Map()

    // 先放入答题记录聚合队列
    for (const item of quizWords) {
      const key = String(item.wordId || item.word || '')
      if (!key) continue
      merged.set(key, {
        wordId: item.wordId,
        word: item.word,
        meaning: item.meaning || '',
        phonetic: item.phonetic || '',
        example: item.example || '',
        exampleTranslation: item.exampleTranslation || '',
        difficulty: item.difficulty || 1,
        chapter: item.chapter || 1,
        level: item.level || 1,
        masteryScore: item.masteryScore || 0,
        reasons: item.reasons || [],
        source: 'quiz_records'
      })
    }

    // 再用 SM-2 到期词覆盖/补充（SM-2 数据更权威）
    for (const m of sm2Words) {
      const wordId = String(m.wordId || '')
      if (!wordId) continue
      const existing = merged.get(wordId)
      if (existing) {
        existing.masteryScore = m.masteryScore ?? existing.masteryScore
        existing.nextReviewAt = m.nextReviewAt
        existing.easeFactor = m.easeFactor
        existing.learningStage = m.learningStage
        existing.source = 'sm2'
        if (!existing.reasons.includes('sm2_due')) {
          existing.reasons.push('sm2_due')
        }
      } else {
        merged.set(wordId, {
          wordId: m.wordId,
          word: m.word || '',
          meaning: '',
          phonetic: '',
          example: '',
          exampleTranslation: '',
          difficulty: 1,
          chapter: 1,
          level: 1,
          masteryScore: m.masteryScore || 0,
          nextReviewAt: m.nextReviewAt,
          easeFactor: m.easeFactor,
          learningStage: m.learningStage,
          reasons: ['sm2_due'],
          source: 'sm2'
        })
      }
    }

    // 补全词汇信息（missing meaning/example 的 SM-2 条目）
    const missingVocabIds = []
    for (const [key, item] of merged.entries()) {
      if (!item.meaning && item.wordId && /^[a-f0-9]{24}$/.test(String(item.wordId))) {
        missingVocabIds.push(item.wordId)
      }
    }

    if (missingVocabIds.length > 0) {
      try {
        const vocabDocs = await VocabularyBank.find({ _id: { $in: missingVocabIds } }).lean()
        for (const vocab of vocabDocs) {
          const key = String(vocab._id)
          const item = merged.get(key)
          if (item) {
            item.word = item.word || vocab.word
            item.meaning = item.meaning || vocab.meaning || ''
            item.phonetic = item.phonetic || vocab.phonetic || ''
            item.example = item.example || vocab.example || ''
            item.exampleTranslation = item.exampleTranslation || vocab.exampleTranslation || ''
            item.difficulty = item.difficulty || vocab.difficulty || 1
            item.chapter = item.chapter || vocab.chapter || 1
            item.level = item.level || vocab.level || 1
          }
        }
      } catch (_) {
        // 词汇查询失败不阻塞队列返回
      }
    }

    // 按优先级排序：SM-2 到期 + 低掌握度优先
    const sorted = [...merged.values()].sort((a, b) => {
      const aScore = (a.masteryScore || 0) + (a.source === 'sm2' ? 0 : 20)
      const bScore = (b.masteryScore || 0) + (b.source === 'sm2' ? 0 : 20)
      if (aScore !== bScore) return aScore - bScore
      return (a.word || '').localeCompare(b.word || '')
    })

    const result = sorted.slice(0, limit)

    res.json({
      success: true,
      data: {
        words: result,
        total: merged.size,
        todayReviewed: 0, // TODO: 从 DailyAdventureSession 读取今日已复习数
        sources: {
          sm2: sm2Words.length,
          quizRecords: quizWords.length,
          mergedUnique: merged.size
        }
      }
    })
  } catch (err) {
    console.error('今日冒险队列获取失败:', err)
    res.status(500).json({ success: false, message: '获取复习队列失败' })
  }
})

/**
 * GET /api/daily-adventure/count
 * 仅返回待复习数量（用于主菜单 badge）
 */
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const [sm2Words, quizWords] = await Promise.all([
      getMasteryWords(req.userId, { mode: 'due', limit: 200 }).catch(() => []),
      getTodayReviewQueue(req.userId, 200).catch(() => [])
    ])

    const wordIds = new Set()
    for (const w of sm2Words) wordIds.add(String(w.wordId || ''))
    for (const w of quizWords) wordIds.add(String(w.wordId || w.word || ''))
    wordIds.delete('')

    res.json({
      success: true,
      data: { count: wordIds.size }
    })
  } catch (err) {
    console.error('获取今日冒险计数失败:', err)
    res.status(500).json({ success: false, message: '获取计数失败' })
  }
})

export default router
