/**
 * 语义干扰项生成服务
 *
 * 目标：替代纯随机选项，优先选择“语义接近、难度相当、但不构成同义答案”的候选词。
 * 该实现不依赖大型外部模型，使用现有词库字段构建轻量语义特征，确保部署稳定。
 */

import VocabularyBank from '../models/VocabularyBank.js'

const DEFAULT_COUNT = 3
const MIN_SCORE_GAP = 0.000001

function normalizeText(value) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function asStringId(value) {
  return value?._id?.toString?.() || value?.toString?.() || ''
}

function toArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function tokenizeEnglish(text) {
  const normalized = normalizeText(text)
  return normalized.match(/[a-z]+/g) || []
}

function tokenizeChineseMeaning(text) {
  const normalized = normalizeText(text)
  const withoutPunctuation = normalized.replace(/[；;，,。.、（）()\s]/g, '')
  return Array.from(new Set(Array.from(withoutPunctuation).filter(ch => /[\u4e00-\u9fff]/.test(ch))))
}

function stripCommonSuffix(word) {
  const w = normalizeText(word)
  for (const suffix of ['ing', 'tion', 'sion', 'ment', 'ness', 'able', 'ible', 'ful', 'less', 'ed', 'es', 's']) {
    if (w.length > suffix.length + 3 && w.endsWith(suffix)) {
      return w.slice(0, -suffix.length)
    }
  }
  return w
}

function jaccard(a, b) {
  const setA = new Set(a.filter(Boolean))
  const setB = new Set(b.filter(Boolean))
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }
  return intersection / (setA.size + setB.size - intersection)
}

function prefixSimilarity(a, b) {
  const left = normalizeText(a)
  const right = normalizeText(b)
  if (!left || !right) return 0
  const maxComparable = Math.min(left.length, right.length)
  let same = 0
  while (same < maxComparable && left[same] === right[same]) same++
  return same / Math.max(left.length, right.length)
}

function suffixSimilarity(a, b) {
  const left = normalizeText(a)
  const right = normalizeText(b)
  if (!left || !right) return 0
  const maxComparable = Math.min(left.length, right.length)
  let same = 0
  while (same < maxComparable && left[left.length - 1 - same] === right[right.length - 1 - same]) same++
  return same / Math.max(left.length, right.length)
}

function lengthSimilarity(a, b) {
  const left = normalizeText(a)
  const right = normalizeText(b)
  if (!left || !right) return 0
  return 1 - Math.min(Math.abs(left.length - right.length) / Math.max(left.length, right.length), 1)
}

function rootFeatureTokens(word) {
  return [
    ...tokenizeEnglish(word.rootAnalysis || ''),
    ...tokenizeEnglish(word.memoryTip || ''),
    ...tokenizeEnglish(word.category || ''),
    ...tokenizeEnglish(word.partOfSpeech || ''),
    stripCommonSuffix(word.word || '')
  ].filter(token => token.length > 1)
}

function relationSet(word) {
  return new Set([
    ...toArray(word.synonyms).map(normalizeText),
    ...toArray(word.antonyms).map(normalizeText)
  ].filter(Boolean))
}

function isAmbiguousSynonym(target, candidate) {
  const targetWord = normalizeText(target.word)
  const candidateWord = normalizeText(candidate.word)
  if (!targetWord || !candidateWord) return false
  const targetRelations = relationSet(target)
  const candidateRelations = relationSet(candidate)
  return targetRelations.has(candidateWord) || candidateRelations.has(targetWord)
}

function hasNearlySameMeaning(target, candidate) {
  const targetMeaning = normalizeText(target.meaning)
  const candidateMeaning = normalizeText(candidate.meaning)
  if (!targetMeaning || !candidateMeaning) return false
  if (targetMeaning === candidateMeaning) return true
  return jaccard(tokenizeChineseMeaning(targetMeaning), tokenizeChineseMeaning(candidateMeaning)) >= 0.92
}

function scoreCandidate(target, candidate, questionType = 'choice_en2cn') {
  const targetId = asStringId(target)
  const candidateId = asStringId(candidate)
  if (!candidateId || candidateId === targetId) return null

  const targetWord = normalizeText(target.word)
  const candidateWord = normalizeText(candidate.word)
  if (!targetWord || !candidateWord || targetWord === candidateWord) return null
  if (hasNearlySameMeaning(target, candidate)) return null
  if (isAmbiguousSynonym(target, candidate)) return null

  const sameCategory = normalizeText(target.category) && normalizeText(target.category) === normalizeText(candidate.category)
  const sameChapter = Number(target.chapter) === Number(candidate.chapter)
  const sameLevel = Number(target.level) === Number(candidate.level)
  const difficultyDistance = Math.abs((Number(target.difficulty) || 1) - (Number(candidate.difficulty) || 1))
  const difficultyScore = 1 - Math.min(difficultyDistance / 4, 1)

  const meaningScore = jaccard(tokenizeChineseMeaning(target.meaning), tokenizeChineseMeaning(candidate.meaning))
  const rootScore = jaccard(rootFeatureTokens(target), rootFeatureTokens(candidate))
  const formScore = Math.max(
    prefixSimilarity(target.word, candidate.word),
    suffixSimilarity(target.word, candidate.word),
    lengthSimilarity(target.word, candidate.word) * 0.45
  )
  const relationScore = relationSet(target).has(candidateWord) || relationSet(candidate).has(targetWord) ? 1 : 0

  const structuralScore =
    (sameCategory ? 1 : 0) * 0.30 +
    difficultyScore * 0.22 +
    (sameChapter ? 1 : 0) * 0.16 +
    (sameLevel ? 1 : 0) * 0.08

  const semanticScore = questionType === 'choice_cn2en'
    ? structuralScore + formScore * 0.18 + rootScore * 0.06 + relationScore * 0.04
    : structuralScore + meaningScore * 0.14 + rootScore * 0.08 + formScore * 0.06 + relationScore * 0.02

  return {
    candidate,
    score: Number(Math.max(semanticScore, 0).toFixed(6)),
    reasons: {
      sameCategory,
      sameChapter,
      sameLevel,
      difficultyScore: Number(difficultyScore.toFixed(3)),
      meaningScore: Number(meaningScore.toFixed(3)),
      rootScore: Number(rootScore.toFixed(3)),
      formScore: Number(formScore.toFixed(3))
    }
  }
}

function stableTieBreaker(targetWord, candidateWord) {
  const key = `${normalizeText(targetWord)}:${normalizeText(candidateWord)}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return hash / 0xffffffff
}

function rankCandidates(target, candidates, questionType) {
  return candidates
    .map(candidate => scoreCandidate(target, candidate, questionType))
    .filter(Boolean)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score
      if (Math.abs(scoreDiff) > MIN_SCORE_GAP) return scoreDiff
      return stableTieBreaker(target.word, a.candidate.word) - stableTieBreaker(target.word, b.candidate.word)
    })
}

function toDistractorPayload(item) {
  return {
    id: item.candidate._id,
    word: item.candidate.word,
    meaning: item.candidate.meaning,
    semanticScore: item.score,
    semanticReasons: item.reasons
  }
}

/**
 * 生成语义干扰项。
 * 若高质量候选不足，会自动放宽到全词库候选，保证接口始终尽量返回 count 个选项。
 */
export async function generateSemanticDistractors(targetWord, questionType = 'choice_en2cn', count = DEFAULT_COUNT) {
  const safeCount = Math.max(1, Math.min(Number(count) || DEFAULT_COUNT, 6))
  if (!targetWord?.word || !targetWord?.meaning) return []

  const targetId = asStringId(targetWord)
  const category = normalizeText(targetWord.category)
  const difficulty = Number(targetWord.difficulty) || 1

  const focusedQuery = {
    _id: { $ne: targetWord._id },
    $or: [
      { chapter: targetWord.chapter },
      ...(category ? [{ category: targetWord.category }] : []),
      { difficulty: { $gte: Math.max(1, difficulty - 1), $lte: Math.min(5, difficulty + 1) } }
    ]
  }

  const focusedCandidates = await VocabularyBank.find(focusedQuery).limit(160).lean()
  const rankedFocused = rankCandidates(targetWord, focusedCandidates, questionType)
  const selected = rankedFocused.slice(0, safeCount)

  if (selected.length < safeCount) {
    const selectedIds = new Set(selected.map(item => asStringId(item.candidate)))
    selectedIds.add(targetId)
    const fallbackCandidates = await VocabularyBank.find({ _id: { $nin: Array.from(selectedIds) } }).limit(300).lean()
    const rankedFallback = rankCandidates(targetWord, fallbackCandidates, questionType)
    selected.push(...rankedFallback.slice(0, safeCount - selected.length))
  }

  return selected.slice(0, safeCount).map(toDistractorPayload)
}

// LLM 干扰项生成内存缓存（同 session 内不重复调用）
const llmDistractorCache = new Map()
const LLM_CACHE_TTL = 30 * 60 * 1000 // 30分钟

/**
 * LLM 增强干扰项生成（带超时和降级）
 *
 * 策略：
 *   1. 先尝试规则生成（快，零成本）
 *   2. 如果规则生成不足或质量低 → 异步调用 LLM 补充
 *   3. LLM 结果缓存 30 分钟（同 word 不重复调用）
 *   4. LLM 超时/失败 → 回退纯规则生成结果
 */
export async function generateDistractorsWithLLM(targetWord, questionType = 'choice_en2cn', count = DEFAULT_COUNT) {
  // 1. 规则生成
  const ruleBased = await generateSemanticDistractors(targetWord, questionType, count)

  // 2. 规则结果足够 → 直接返回
  if (ruleBased.length >= count) {
    return ruleBased.slice(0, count)
  }

  // 3. 检查缓存
  const cacheKey = `${targetWord.word}:${targetWord.meaning}`
  const cached = llmDistractorCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < LLM_CACHE_TTL) {
    // 合并缓存结果
    const merged = [...ruleBased, ...cached.items]
    return merged.slice(0, count)
  }

  // 4. 尝试 LLM 增强（5秒超时）
  try {
    const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://localhost:8000'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${llmServiceUrl}/api/llm/distractors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: targetWord.word,
        meaning: targetWord.meaning,
        count: count - ruleBased.length,
        difficulty: targetWord.difficulty || 'intermediate'
      }),
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (response.ok) {
      const data = await response.json()
      if (data.distractors && data.distractors.length > 0) {
        const llmItems = data.distractors.map(d => ({
          text: d,
          source: 'llm'
        }))

        // 缓存
        llmDistractorCache.set(cacheKey, {
          items: llmItems,
          timestamp: Date.now()
        })

        const merged = [...ruleBased, ...llmItems]
        return merged.slice(0, count)
      }
    }
  } catch (e) {
    // LLM 不可用 → 静默降级到规则生成
    console.warn('LLM 干扰项生成不可用，使用规则生成:', e.message)
  }

  return ruleBased.slice(0, count)
}

export const __testables = {
  normalizeText,
  tokenizeChineseMeaning,
  scoreCandidate,
  rankCandidates
}
