/**
 * 编辑距离模糊评分服务
 *
 * 用于拼写/翻译类题型：区分完全正确、轻微拼写错误和完全错误。
 * near 会被视为可接受答案，但按比例给分，并在记录中保留 answerQuality。
 */

export function normalizeSpelling(value) {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .replace(/[-\s]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function levenshteinDistance(a, b) {
  const left = normalizeSpelling(a)
  const right = normalizeSpelling(b)
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = Array(right.length + 1).fill(0)

  for (let i = 1; i <= left.length; i++) {
    current[0] = i
    for (let j = 1; j <= right.length; j++) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost
      )
    }
    for (let j = 0; j <= right.length; j++) previous[j] = current[j]
  }

  return previous[right.length]
}

function maxAllowedDistance(correctAnswer) {
  const length = normalizeSpelling(correctAnswer).replace(/\s/g, '').length
  if (length <= 4) return 0
  if (length <= 7) return 1
  return 2
}

function buildFeedback(answerQuality, distance, correctAnswer) {
  if (answerQuality === 'exact') return '回答完全正确'
  if (answerQuality === 'near') {
    return `拼写接近正确，和标准答案相差 ${distance} 处，请注意 ${correctAnswer} 的完整拼写`
  }
  return '答案与标准答案差异较大，请结合例句和记忆技巧复习'
}

export function evaluateFuzzyAnswer(playerAnswer, correctAnswer) {
  const normalizedPlayer = normalizeSpelling(playerAnswer)
  const normalizedCorrect = normalizeSpelling(correctAnswer)

  if (!normalizedPlayer || !normalizedCorrect) {
    return {
      isCorrect: false,
      answerQuality: 'wrong',
      editDistance: null,
      similarity: 0,
      scoreRatio: 0,
      feedback: '答案不能为空'
    }
  }

  const distance = levenshteinDistance(normalizedPlayer, normalizedCorrect)
  const maxLength = Math.max(normalizedPlayer.length, normalizedCorrect.length)
  const similarity = maxLength === 0 ? 0 : Math.max(0, 1 - distance / maxLength)

  if (distance === 0) {
    return {
      isCorrect: true,
      answerQuality: 'exact',
      editDistance: 0,
      similarity: 1,
      scoreRatio: 1,
      feedback: buildFeedback('exact', 0, normalizedCorrect)
    }
  }

  const allowedDistance = maxAllowedDistance(normalizedCorrect)
  const isNear = allowedDistance > 0 && distance <= allowedDistance && similarity >= 0.78
  if (isNear) {
    const scoreRatio = distance === 1 ? 0.75 : 0.6
    return {
      isCorrect: true,
      answerQuality: 'near',
      editDistance: distance,
      similarity: Number(similarity.toFixed(3)),
      scoreRatio,
      feedback: buildFeedback('near', distance, normalizedCorrect)
    }
  }

  return {
    isCorrect: false,
    answerQuality: 'wrong',
    editDistance: distance,
    similarity: Number(similarity.toFixed(3)),
    scoreRatio: 0,
    feedback: buildFeedback('wrong', distance, normalizedCorrect)
  }
}
