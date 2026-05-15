const REQUIRED_FIELDS = ['word', 'meaning', 'difficulty', 'chapter', 'level']
const CHAPTER_MIN = 1
const CHAPTER_MAX = 6
const LEVEL_MIN = 1
const LEVEL_MAX = 30
const DIFFICULTY_MIN = 1
const DIFFICULTY_MAX = 5

function normalizeWord(value) {
  return String(value || '').trim().toLowerCase()
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === ''
}

function toInteger(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  return Number.isInteger(numberValue) ? numberValue : null
}

function createLevelKey(chapter, level) {
  return `${chapter}-${level}`
}

function createDistribution() {
  const chapter = {}
  const level = {}
  const count = []
  const emptyLevels = []

  for (let chapterIndex = CHAPTER_MIN; chapterIndex <= CHAPTER_MAX; chapterIndex++) {
    chapter[String(chapterIndex)] = 0
    for (let levelIndex = LEVEL_MIN; levelIndex <= LEVEL_MAX; levelIndex++) {
      const key = createLevelKey(chapterIndex, levelIndex)
      level[key] = 0
      count.push({ chapter: chapterIndex, level: levelIndex, count: 0 })
      emptyLevels.push({ chapter: chapterIndex, level: levelIndex })
    }
  }

  return { chapter, level, count, emptyLevels }
}

function removeEmptyLevel(emptyLevels, chapter, level) {
  const index = emptyLevels.findIndex(item => item.chapter === chapter && item.level === level)
  if (index >= 0) emptyLevels.splice(index, 1)
}

/**
 * 校验词库数据完整性，并输出覆盖章节/关卡的分布统计。
 * @param {Array<object>} vocabulary 词库数组
 * @returns {object} 校验报告
 */
export function validateVocabulary(vocabulary) {
  const words = Array.isArray(vocabulary) ? vocabulary : []
  const seenWords = new Map()
  const duplicates = []
  const missingFields = []
  const invalidRanges = []
  const distribution = createDistribution()

  words.forEach((entry, index) => {
    const rowNumber = index + 1
    const wordKey = normalizeWord(entry?.word)

    if (wordKey) {
      const wordbookKey = String(entry?.wordbookId || 'default').trim().toLowerCase() || 'default'
      const scopedWordKey = `${wordbookKey}:${wordKey}`
      if (seenWords.has(scopedWordKey)) {
        duplicates.push({
          wordbookId: entry?.wordbookId || '',
          word: entry.word,
          firstIndex: seenWords.get(scopedWordKey),
          duplicateIndex: rowNumber
        })
      } else {
        seenWords.set(scopedWordKey, rowNumber)
      }
    }

    for (const field of REQUIRED_FIELDS) {
      if (isBlank(entry?.[field])) {
        missingFields.push({ index: rowNumber, word: entry?.word || '', field })
      }
    }

    const difficulty = toInteger(entry?.difficulty)
    const chapter = toInteger(entry?.chapter)
    const level = toInteger(entry?.level)

    if (difficulty === null || difficulty < DIFFICULTY_MIN || difficulty > DIFFICULTY_MAX) {
      invalidRanges.push({ index: rowNumber, word: entry?.word || '', field: 'difficulty', value: entry?.difficulty, expected: '1-5 integer' })
    }

    if (chapter === null || chapter < CHAPTER_MIN || chapter > CHAPTER_MAX) {
      invalidRanges.push({ index: rowNumber, word: entry?.word || '', field: 'chapter', value: entry?.chapter, expected: '1-6 integer' })
    }

    if (level === null || level < LEVEL_MIN || level > LEVEL_MAX) {
      invalidRanges.push({ index: rowNumber, word: entry?.word || '', field: 'level', value: entry?.level, expected: '1-30 integer' })
    }

    if (chapter !== null && level !== null && chapter >= CHAPTER_MIN && chapter <= CHAPTER_MAX && level >= LEVEL_MIN && level <= LEVEL_MAX) {
      const chapterKey = String(chapter)
      const levelKey = createLevelKey(chapter, level)
      distribution.chapter[chapterKey] += 1
      distribution.level[levelKey] += 1
      const countItem = distribution.count.find(item => item.chapter === chapter && item.level === level)
      if (countItem) countItem.count += 1
      removeEmptyLevel(distribution.emptyLevels, chapter, level)
    }
  })

  return {
    total: words.length,
    duplicates,
    missingFields,
    invalidRanges,
    distribution,
    emptyLevels: distribution.emptyLevels,
    isValid: duplicates.length === 0 && missingFields.length === 0 && invalidRanges.length === 0
  }
}

/**
 * 将校验报告压缩为命令行可读摘要。
 * @param {object} report 校验报告
 * @returns {string[]} 摘要行
 */
export function formatVocabularyReport(report) {
  const safeReport = report || validateVocabulary([])
  const lines = []
  lines.push(`总词数: ${safeReport.total}`)
  lines.push(`重复词: ${safeReport.duplicates.length}`)
  lines.push(`缺失字段: ${safeReport.missingFields.length}`)
  lines.push(`范围错误: ${safeReport.invalidRanges.length}`)
  lines.push(`空关卡: ${safeReport.emptyLevels.length}`)
  lines.push(`校验结果: ${safeReport.isValid ? 'PASS' : 'WARN'}`)
  return lines
}

export const VOCABULARY_VALIDATION_RULES = {
  requiredFields: REQUIRED_FIELDS,
  chapterRange: [CHAPTER_MIN, CHAPTER_MAX],
  levelRange: [LEVEL_MIN, LEVEL_MAX],
  difficultyRange: [DIFFICULTY_MIN, DIFFICULTY_MAX]
}
