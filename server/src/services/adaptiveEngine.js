import QuizRecord from '../models/QuizRecord.js'

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
