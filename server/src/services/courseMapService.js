import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import VocabularyBank from '../models/VocabularyBank.js'

export const MAX_CHAPTER = 6
export const MAX_LEVEL = 30
const DEFAULT_WORDS_PER_LEVEL = 12

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let cachedLevelsConfig = null

/**
 * Normalize a wordbook id to a safe storage/query key.
 * @param {unknown} value Raw wordbook id.
 * @returns {string} Sanitized wordbook id.
 */
export function sanitizeWordbookId(value) {
  const id = String(value || 'cet4').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return id || 'cet4'
}

/**
 * Validate chapter and level boundaries for the enterprise 6×30 course map.
 * @param {unknown} chapter Raw chapter value.
 * @param {unknown} level Raw level value.
 * @returns {{valid: boolean, chapter: number, level: number, message: string}}
 */
export function validateChapterLevel(chapter, level) {
  const safeChapter = Number(chapter)
  const safeLevel = Number(level)
  if (!Number.isInteger(safeChapter) || safeChapter < 1 || safeChapter > MAX_CHAPTER) {
    return { valid: false, chapter: safeChapter, level: safeLevel, message: `无效的章节，范围为 1..${MAX_CHAPTER}` }
  }
  if (!Number.isInteger(safeLevel) || safeLevel < 1 || safeLevel > MAX_LEVEL) {
    return { valid: false, chapter: safeChapter, level: safeLevel, message: `无效的关卡，范围为 1..${MAX_LEVEL}` }
  }
  return { valid: true, chapter: safeChapter, level: safeLevel, message: '' }
}

/**
 * Calculate the next course pointer after a completed level.
 * @param {number} chapter Current chapter.
 * @param {number} level Current level.
 * @returns {{chapter: number, level: number, nextChapter: number, nextLevel: number, chapterCompleted: boolean, completedCourse: boolean, courseCompleted: boolean, maxLevel: number}}
 */
export function getNextLevel(chapter, level) {
  const validated = validateChapterLevel(chapter, level)
  if (!validated.valid) {
    return {
      chapter: 1,
      level: 1,
      nextChapter: 1,
      nextLevel: 1,
      chapterCompleted: false,
      completedCourse: false,
      courseCompleted: false,
      maxLevel: MAX_LEVEL
    }
  }

  const chapterCompleted = validated.level >= MAX_LEVEL
  const completedCourse = validated.chapter >= MAX_CHAPTER && chapterCompleted
  const nextChapter = completedCourse ? MAX_CHAPTER : (chapterCompleted ? validated.chapter + 1 : validated.chapter)
  const nextLevel = completedCourse ? MAX_LEVEL : (chapterCompleted ? 1 : validated.level + 1)

  return {
    chapter: nextChapter,
    level: nextLevel,
    nextChapter,
    nextLevel,
    chapterCompleted,
    completedCourse,
    courseCompleted: completedCourse,
    maxLevel: MAX_LEVEL
  }
}

/**
 * Build a progress map key. New keys include wordbook id; legacy keys did not.
 * @param {unknown} wordbookId Wordbook id.
 * @param {number} chapter Chapter number.
 * @param {number} level Level number.
 * @returns {string} Progress map key.
 */
export function buildProgressKey(wordbookId, chapter, level) {
  return `${sanitizeWordbookId(wordbookId)}:${chapter}-${level}`
}

/**
 * Read levels.json with a resilient fallback for non-client environments.
 * @returns {{chapters: Array}} Levels configuration.
 */
export function readLevelsConfig() {
  if (cachedLevelsConfig) return cachedLevelsConfig

  const candidatePaths = [
    join(__dirname, '../../../client/src/game/data/levels.json'),
    join(process.cwd(), '../client/src/game/data/levels.json'),
    join(process.cwd(), 'client/src/game/data/levels.json')
  ]

  for (const candidatePath of candidatePaths) {
    if (!existsSync(candidatePath)) continue
    try {
      cachedLevelsConfig = JSON.parse(readFileSync(candidatePath, 'utf-8'))
      return cachedLevelsConfig
    } catch (error) {
      console.warn(`读取关卡配置失败: ${candidatePath}`, error.message)
    }
  }

  cachedLevelsConfig = {
    chapters: Array.from({ length: MAX_CHAPTER }, (_, chapterIndex) => ({
      id: chapterIndex + 1,
      name: `第${chapterIndex + 1}章`,
      theme: '',
      description: '',
      color: '#4a90d9',
      levels: Array.from({ length: MAX_LEVEL }, (_, levelIndex) => ({
        id: levelIndex + 1,
        name: `第${levelIndex + 1}关`,
        wordsCount: DEFAULT_WORDS_PER_LEVEL,
        category: 'general',
        bossType: null
      }))
    }))
  }
  return cachedLevelsConfig
}

/**
 * Get the dynamic word count for a level: levels.json → DB count → default.
 * @param {{wordbookId?: string, chapter: number, level: number}} params Query params.
 * @returns {Promise<number>} Word count.
 */
export async function getLevelWordCount({ wordbookId = 'cet4', chapter, level }) {
  const safeWordbookId = sanitizeWordbookId(wordbookId)
  const config = readLevelsConfig()
  const chapterConfig = config.chapters?.find(item => Number(item.id) === Number(chapter))
  const levelConfig = chapterConfig?.levels?.find(item => Number(item.id) === Number(level))
  const configuredCount = Number(levelConfig?.wordsCount)
  if (Number.isInteger(configuredCount) && configuredCount > 0) return configuredCount

  try {
    const dbCount = await VocabularyBank.countDocuments({ wordbookId: safeWordbookId, chapter, level })
    if (dbCount > 0) return dbCount
  } catch (error) {
    console.warn('查询关卡词数失败，使用默认值:', error.message)
  }

  return DEFAULT_WORDS_PER_LEVEL
}
