import QuizRecord from '../models/QuizRecord.js'

/**
 * 自适应难度引擎
 * 基于规则的自适应 + 简化贝叶斯知识追踪
 *
 * 难度等级:
 * 1 - 中英选择题(4选1)
 * 2 - 英中选择题(4选1) + 干扰项相似度提升
 * 3 - 首字母提示拼写
 * 4 - 无提示拼写 + 例句填空
 * 5 - 中文→英文翻译 + 造句
 */
export async function getAdaptiveDifficulty(userId) {
  // 获取最近20条答题记录
  const recentRecords = await QuizRecord.find({ userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()

  if (recentRecords.length === 0) return 1

  // 分析连续答对/答错（从最近一条开始，遇到不同结果就停止）
  let consecutiveCorrect = 0
  let consecutiveWrong = 0
  for (const record of recentRecords) {
    if (record.isCorrect) {
      if (consecutiveWrong > 0) break // 之前已开始记录连错，遇到对的就停
      consecutiveCorrect++
    } else {
      if (consecutiveCorrect > 0) break // 之前已开始记录连对，遇到错的就停
      consecutiveWrong++
    }
  }

  // 计算近期正确率
  const recentCorrectRate = recentRecords.filter(r => r.isCorrect).length / recentRecords.length
  // 平均答题时间
  const avgResponseTime = recentRecords.reduce((sum, r) => sum + r.responseTime, 0) / recentRecords.length

  // 当前难度（取最近一条记录的难度）
  let currentDifficulty = recentRecords[0].difficulty || 1

  // 升降级规则
  if (consecutiveCorrect >= 3) {
    currentDifficulty = Math.min(currentDifficulty + 1, 5)
  } else if (consecutiveWrong >= 2) {
    currentDifficulty = Math.max(currentDifficulty - 1, 1)
  }

  // 额外调整：正确率极高且速度快 → 可以加速升级
  if (recentCorrectRate > 0.9 && avgResponseTime < 5000 && recentRecords.length >= 10) {
    currentDifficulty = Math.min(currentDifficulty + 1, 5)
  }

  // 题目类型映射
  const questionTypeMap = {
    1: 'choice_en2cn',
    2: 'choice_cn2en',
    3: 'spell_hint',
    4: 'spell_full',
    5: 'translate'
  }

  return {
    difficulty: currentDifficulty,
    questionType: questionTypeMap[currentDifficulty],
    stats: {
      consecutiveCorrect,
      consecutiveWrong,
      recentCorrectRate: (recentCorrectRate * 100).toFixed(1),
      avgResponseTime: Math.round(avgResponseTime)
    }
  }
}

/**
 * 获取单词的掌握度评估
 */
export async function getWordMastery(userId, wordId) {
  const records = await QuizRecord.find({ userId, wordId }).sort({ createdAt: -1 }).limit(5).lean()
  if (records.length === 0) return { mastery: 0, status: 'new' }

  const correctRate = records.filter(r => r.isCorrect).length / records.length
  const avgTime = records.reduce((sum, r) => sum + r.responseTime, 0) / records.length

  let status = 'learning'
  if (correctRate >= 0.8 && records.length >= 3) status = 'mastered'
  if (correctRate < 0.4) status = 'struggling'

  return {
    mastery: Math.round(correctRate * 100),
    status,
    avgTime: Math.round(avgTime),
    attempts: records.length
  }
}
