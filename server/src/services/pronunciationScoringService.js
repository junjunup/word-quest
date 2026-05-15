function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizePhonetic(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\/\[\]ˈˌ.]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function levenshtein(a, b) {
  const source = String(a || '')
  const target = String(b || '')
  if (source === target) return 0
  if (!source) return target.length
  if (!target) return source.length
  const previous = Array(target.length + 1).fill(0).map((_, index) => index)
  const current = Array(target.length + 1).fill(0)
  for (let i = 1; i <= source.length; i++) {
    current[0] = i
    for (let j = 1; j <= target.length; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
    }
    for (let j = 0; j <= target.length; j++) previous[j] = current[j]
  }
  return previous[target.length]
}

function similarity(a, b) {
  const left = String(a || '')
  const right = String(b || '')
  const maxLength = Math.max(left.length, right.length)
  if (maxLength === 0) return 1
  return Math.max(0, 1 - levenshtein(left, right) / maxLength)
}

function simpleSoundSignature(value) {
  const normalized = normalizeText(value).replace(/\s+/g, '')
  if (!normalized) return ''
  return normalized
    .replace(/ph/g, 'f')
    .replace(/ght/g, 't')
    .replace(/kn/g, 'n')
    .replace(/wr/g, 'r')
    .replace(/[aeiou]+/g, 'a')
    .replace(/(.)\1+/g, '$1')
}

function gradeFromScore(score) {
  if (score >= 90) return 'excellent'
  if (score >= 75) return 'good'
  if (score >= 60) return 'pass'
  return 'retry'
}

export function scorePronunciation({ word, transcript, expectedPhonetic = '', confidence = 0 }) {
  const expected = normalizeText(word)
  const spoken = normalizeText(transcript)
  const safeConfidence = Math.max(0, Math.min(1, Number(confidence) || 0))

  const wordSimilarity = similarity(expected, spoken)
  const soundSimilarity = similarity(simpleSoundSignature(expected), simpleSoundSignature(spoken))
  const phoneticSimilarity = expectedPhonetic
    ? Math.max(soundSimilarity, similarity(normalizePhonetic(expectedPhonetic), simpleSoundSignature(spoken)))
    : soundSimilarity
  const confidenceScore = safeConfidence

  const score = Math.round(Math.max(0, Math.min(100,
    wordSimilarity * 65 + phoneticSimilarity * 25 + confidenceScore * 10
  )))
  const feedback = []
  if (!spoken) feedback.push('未识别到有效英文发音，请靠近麦克风后重试')
  if (wordSimilarity >= 0.98) feedback.push('单词识别完全匹配')
  if (wordSimilarity < 0.75) feedback.push('识别文本与目标单词差异较大，建议放慢语速')
  if (phoneticSimilarity < 0.7) feedback.push('音素相似度偏低，请重点练习元音和尾音')
  if (safeConfidence < 0.55) feedback.push('浏览器识别置信度偏低，建议在安静环境中重试')
  if (feedback.length === 0) feedback.push('发音达到当前训练要求，可继续保持')

  return {
    score,
    grade: gradeFromScore(score),
    details: {
      wordSimilarity: Number(wordSimilarity.toFixed(4)),
      phoneticSimilarity: Number(phoneticSimilarity.toFixed(4)),
      confidenceScore: Number(confidenceScore.toFixed(4)),
      feedback
    }
  }
}
