import QuizRecord from '../models/QuizRecord.js'
import WordMastery from '../models/WordMastery.js'
import VocabularyBank from '../models/VocabularyBank.js'

/**
 * 自适应难度引擎
 *
 * 根据最近答题窗口计算 learner ability score，并映射到 5 级题型。
 * 特征包括：正确率、答案质量（exact/near/wrong）、响应速度、连续答题状态。
 * 这样比单纯 if-else 更适合解释为轻量智能辅导系统。
 *
 * 难度等级:
 * 1 - 中英选择题(4选1)
 * 2 - 英中选择题(4选1) + 语义干扰项
 * 3 - 首字母提示拼写
 * 4 - 无提示拼写 + 例句填空
 * 5 - 中文→英文翻译 + 造句
 */
const QUESTION_TYPE_MAP = {
  1: 'choice_en2cn',
  2: 'choice_cn2en',
  3: 'spell_hint',
  4: 'spell_full',
  5: 'translate'
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max))
}

function qualityWeight(record) {
  if (record.answerQuality === 'exact') return 1
  if (record.answerQuality === 'near') return 0.72
  return record.isCorrect ? 1 : 0
}

function calculateStreaks(records) {
  let consecutiveCorrect = 0
  let consecutiveWrong = 0

  for (const record of records) {
    const accepted = !!record.isCorrect
    if (accepted) {
      if (consecutiveWrong > 0) break
      consecutiveCorrect++
    } else {
      if (consecutiveCorrect > 0) break
      consecutiveWrong++
    }
  }

  return { consecutiveCorrect, consecutiveWrong }
}

function speedScore(avgResponseTime) {
  if (!Number.isFinite(avgResponseTime) || avgResponseTime <= 0) return 0.5
  if (avgResponseTime <= 3000) return 1
  if (avgResponseTime >= 15000) return 0.2
  return clamp(1 - (avgResponseTime - 3000) / 15000, 0.2, 1)
}

function streakScore(consecutiveCorrect, consecutiveWrong) {
  if (consecutiveWrong >= 3) return 0
  if (consecutiveWrong === 2) return 0.15
  if (consecutiveWrong === 1) return 0.35
  if (consecutiveCorrect >= 5) return 1
  if (consecutiveCorrect >= 3) return 0.82
  if (consecutiveCorrect >= 1) return 0.62
  return 0.5
}

function mapAbilityToDifficulty(abilityScore) {
  if (abilityScore >= 0.84) return 5
  if (abilityScore >= 0.68) return 4
  if (abilityScore >= 0.52) return 3
  if (abilityScore >= 0.34) return 2
  return 1
}

function limitDifficultyJump(currentDifficulty, targetDifficulty, consecutiveCorrect, consecutiveWrong) {
  if (consecutiveWrong >= 2) return Math.max(currentDifficulty - 1, 1)
  if (consecutiveCorrect >= 3 && targetDifficulty > currentDifficulty) return Math.min(currentDifficulty + 1, 5)
  if (targetDifficulty < currentDifficulty) return Math.max(currentDifficulty - 1, 1)
  return clamp(targetDifficulty, Math.max(1, currentDifficulty - 1), Math.min(5, currentDifficulty + 1))
}

export async function getAdaptiveDifficulty(userId) {
  // 获取最近20条答题记录，构成滑动观察窗口
  const recentRecords = await QuizRecord.find({ userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()

  if (recentRecords.length === 0) {
    return {
      difficulty: 1,
      questionType: QUESTION_TYPE_MAP[1],
      abilityScore: 0,
      stats: {
        consecutiveCorrect: 0,
        consecutiveWrong: 0,
        recentCorrectRate: '0.0',
        qualityScore: '0.0',
        avgResponseTime: 0
      }
    }
  }

  const { consecutiveCorrect, consecutiveWrong } = calculateStreaks(recentRecords)
  const recentCorrectRate = recentRecords.filter(r => r.isCorrect).length / recentRecords.length
  const avgQuality = recentRecords.reduce((sum, record) => sum + qualityWeight(record), 0) / recentRecords.length
  const avgResponseTime = recentRecords.reduce((sum, r) => sum + (Number(r.responseTime) || 0), 0) / recentRecords.length
  const currentDifficulty = clamp(Number(recentRecords[0].difficulty) || 1, 1, 5)

  const speed = speedScore(avgResponseTime)
  const streak = streakScore(consecutiveCorrect, consecutiveWrong)
  const sampleConfidence = clamp(recentRecords.length / 10, 0.45, 1)

  const rawAbilityScore = (
    recentCorrectRate * 0.42 +
    avgQuality * 0.28 +
    speed * 0.18 +
    streak * 0.12
  ) * sampleConfidence

  const abilityScore = Number(clamp(rawAbilityScore, 0, 1).toFixed(3))
  const targetDifficulty = mapAbilityToDifficulty(abilityScore)
  const adaptiveDifficulty = limitDifficultyJump(
    currentDifficulty,
    targetDifficulty,
    consecutiveCorrect,
    consecutiveWrong
  )

  return {
    difficulty: adaptiveDifficulty,
    questionType: QUESTION_TYPE_MAP[adaptiveDifficulty],
    abilityScore,
    stats: {
      consecutiveCorrect,
      consecutiveWrong,
      recentCorrectRate: (recentCorrectRate * 100).toFixed(1),
      qualityScore: (avgQuality * 100).toFixed(1),
      speedScore: speed.toFixed(2),
      streakScore: streak.toFixed(2),
      avgResponseTime: Math.round(avgResponseTime),
      targetDifficulty
    }
  }
}

/**
 * 获取单词的掌握度评估
 */
export async function getWordMastery(userId, wordId) {
  const records = await QuizRecord.find({ userId, wordId }).sort({ createdAt: -1 }).limit(5).lean()
  if (records.length === 0) return { mastery: 0, status: 'new' }

  const qualityAverage = records.reduce((sum, record) => sum + qualityWeight(record), 0) / records.length
  const avgTime = records.reduce((sum, r) => sum + (Number(r.responseTime) || 0), 0) / records.length

  let status = 'learning'
  if (qualityAverage >= 0.8 && records.length >= 3) status = 'mastered'
  if (qualityAverage < 0.4) status = 'struggling'

  return {
    mastery: Math.round(qualityAverage * 100),
    status,
    avgTime: Math.round(avgTime),
    attempts: records.length
  }
}

/**
 * 获取推荐单词列表（逐词级优先级排序）
 *
 * 优先级规则：
 *   1. nextReviewDue <= now 且 masteryScore < 80 → 最高优先（到期复习的弱词）
 *   2. learningStage === 'new' → 次高优先（新词先学）
 *   3. masteryScore < 50 → 高优先（长期薄弱词）
 *   4. masteryScore < 80 且距离上次复习 > 7 天 → 中优先（可能遗忘）
 *   5. 其他 → 低优先（已掌握词作为混合练习）
 *
 * @param {string} userId
 * @param {number} chapterId
 * @param {number} levelId
 * @param {string} wordbookId
 * @param {number} count - 需要的单词数量
 * @returns {Promise<Array<{wordId, word, priority, reason, masteryScore, nextReviewDue}>>}
 */
export async function getWordSelection(userId, chapterId, levelId, wordbookId = 'cet4', count = 10) {
  const now = new Date()

  // 1. 获取关卡词汇池
  const vocabWords = await VocabularyBank.find({
    wordbookId,
    chapter: chapterId,
    level: levelId
  }).lean()

  if (!vocabWords || vocabWords.length === 0) {
    return []
  }

  const vocabWordIds = vocabWords.map(v => v._id)

  // 2. 查询每个词的 WordMastery 记录
  const masteryRecords = await WordMastery.find({
    userId,
    wordId: { $in: vocabWordIds }
  }).lean()

  const masteryMap = new Map()
  for (const m of masteryRecords) {
    const key = m.wordId.toString()
    masteryMap.set(key, m)
  }

  // 3. 计算每个词的优先级
  const scored = vocabWords.map(vocab => {
    const mastery = masteryMap.get(vocab._id.toString())
    return scoreWord(vocab, mastery, now)
  })

  // 4. 按优先级排序（分数越高越优先）
  scored.sort((a, b) => b.priority - a.priority)

  return scored.slice(0, count)
}

/**
 * 计算单个词的优先级分数
 */
function scoreWord(vocab, mastery, now) {
  if (!mastery) {
    // 新词：从未练习过
    return {
      wordId: vocab._id,
      word: vocab.word,
      priority: 80,  // 次高优先
      reason: 'new',
      masteryScore: 0,
      nextReviewDue: null,
      learningStage: 'new'
    }
  }

  const masteryScore = Number(mastery.masteryScore) || 0
  const nextReviewAt = mastery.nextReviewAt ? new Date(mastery.nextReviewAt) : null
  const lastReviewedAt = mastery.lastReviewedAt ? new Date(mastery.lastReviewedAt) : null
  const daysSinceReview = lastReviewedAt
    ? Math.floor((now - lastReviewedAt) / (1000 * 60 * 60 * 24))
    : Infinity
  const isDue = nextReviewAt && nextReviewAt <= now

  // 优先级计算
  let priority = 0
  let reason = ''

  if (isDue && masteryScore < 80) {
    priority = 100
    reason = 'due_weak'       // 到期复习的弱词 → 最高优先
  } else if (masteryScore < 50) {
    priority = 70
    reason = 'weak'           // 长期薄弱词
  } else if (isDue) {
    priority = 60
    reason = 'due'            // 到期复习
  } else if (masteryScore < 80 && daysSinceReview > 7) {
    priority = 50
    reason = 'stale'          // 可能遗忘
  } else if (masteryScore >= 80) {
    priority = 20 + Math.random() * 10  // 已掌握词低频混合练习
    reason = 'mastered_mix'
  } else {
    priority = 30
    reason = 'normal'
  }

  return {
    wordId: vocab._id,
    word: vocab.word,
    priority: Math.round(priority),
    reason,
    masteryScore,
    nextReviewDue: nextReviewAt,
    learningStage: mastery.learningStage || 'learning'
  }
}

/**
 * 根据单词掌握状态推荐题型
 *
 * @param {number} masteryScore - 掌握度分数 (0-100)
 * @param {string} learningStage - 学习阶段
 * @returns {string[]} 推荐的题型列表
 */
export function recommendQuestionTypes(masteryScore = 0, learningStage = 'new') {
  // 新词/掌握度极低 → 只出选择题（降低挫败感）
  if (masteryScore < 30 || learningStage === 'new') {
    return ['choice_en2cn', 'choice_cn2en']
  }
  // 学习中 → 选择题 + 提示拼写
  if (masteryScore < 60) {
    return ['choice_en2cn', 'choice_cn2en', 'spell_hint']
  }
  // 复习阶段 → 全题型但侧重拼写
  if (masteryScore < 80) {
    return ['choice_en2cn', 'choice_cn2en', 'spell_hint', 'spell_full']
  }
  // 已掌握 → 全题型随机（保持挑战感）
  return ['choice_en2cn', 'choice_cn2en', 'spell_hint', 'spell_full', 'translate']
}
