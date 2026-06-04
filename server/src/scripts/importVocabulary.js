import mongoose from 'mongoose'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { basename, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import 'dotenv/config'
import VocabularyBank from '../models/VocabularyBank.js'
import { validateVocabulary, formatVocabularyReport } from '../utils/vocabularyValidator.js'
import { sanitizeWordbookId } from '../services/courseMapService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SERVER_SRC = resolve(__dirname, '..')
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/word-quest'
const DEFAULT_WORDBOOK_DIR = 'src/data/wordbooks'

function parseArgs(argv) {
  const args = { file: '', dryRun: false, allWordbooks: true, wordbookDir: DEFAULT_WORDBOOK_DIR }
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index]
    if (item === '--file' && argv[index + 1]) {
      args.file = argv[index + 1]
      args.allWordbooks = false
      index++
    } else if (item === '--wordbook-dir' && argv[index + 1]) {
      args.wordbookDir = argv[index + 1]
      args.allWordbooks = true
      index++
    } else if (item === '--all-wordbooks') {
      args.allWordbooks = true
    } else if (item === '--dry-run') {
      args.dryRun = true
    }
  }
  return args
}

export function loadVocabularyFile(filePath) {
  const absolutePath = resolve(process.cwd(), filePath)
  const raw = readFileSync(absolutePath, 'utf-8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('词库 JSON 顶层必须是数组')
  }
  return { absolutePath, vocabulary: parsed }
}

export function loadWordbookFiles(wordbookDir = DEFAULT_WORDBOOK_DIR) {
  const absoluteDir = resolve(process.cwd(), wordbookDir)
  if (!existsSync(absoluteDir)) {
    throw new Error(`词书目录不存在: ${absoluteDir}`)
  }
  const files = readdirSync(absoluteDir)
    .filter(file => file.endsWith('.json') && file !== 'source-manifest.json')
    .sort()
  if (files.length === 0) {
    throw new Error(`词书目录没有可导入 JSON: ${absoluteDir}`)
  }
  const loaded = files.map(file => loadVocabularyFile(join(absoluteDir, file)))
  return {
    absoluteDir,
    files: loaded,
    vocabulary: loaded.flatMap(item => item.vocabulary)
  }
}

function normalizeEntry(entry) {
  return {
    ...entry,
    wordbookId: sanitizeWordbookId(entry.wordbookId),
    wordbookName: String(entry.wordbookName || entry.wordbookId || '默认词书').trim(),
    word: String(entry.word || '').trim(),
    meaning: String(entry.meaning || '').trim(),
    example: String(entry.example || '').trim(),
    exampleTranslation: String(entry.exampleTranslation || '').trim(),
    phonetic: String(entry.phonetic || '').trim(),
    partOfSpeech: String(entry.partOfSpeech || '').trim(),
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

export async function upsertVocabulary(vocabulary) {
  const now = new Date()
  const operations = vocabulary.map(rawEntry => {
    const entry = normalizeEntry(rawEntry)
    return {
      updateOne: {
        filter: { wordbookId: entry.wordbookId, word: entry.word },
        update: {
          $set: {
            ...entry,
            updatedAt: now
          },
          $setOnInsert: { createdAt: now }
        },
        upsert: true
      }
    }
  }).filter(op => op.updateOne.filter.wordbookId && op.updateOne.filter.word)

  if (operations.length === 0) {
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 }
  }

  return VocabularyBank.bulkWrite(operations, { ordered: false })
}

function summarizeByWordbook(vocabulary) {
  const grouped = new Map()
  for (const entry of vocabulary) {
    const key = sanitizeWordbookId(entry.wordbookId)
    const item = grouped.get(key) || { wordbookId: key, wordbookName: entry.wordbookName || key, count: 0 }
    item.count += 1
    grouped.set(key, item)
  }
  return [...grouped.values()].sort((a, b) => a.wordbookId.localeCompare(b.wordbookId))
}

export async function importVocabulary({ file = '', dryRun = false, allWordbooks = true, wordbookDir = DEFAULT_WORDBOOK_DIR } = {}) {
  const loaded = allWordbooks
    ? loadWordbookFiles(wordbookDir)
    : { absolutePath: resolve(process.cwd(), file || 'src/data/vocabulary.json'), vocabulary: loadVocabularyFile(file || 'src/data/vocabulary.json').vocabulary }
  const vocabulary = loaded.vocabulary.map(normalizeEntry)
  const report = validateVocabulary(vocabulary)

  if (allWordbooks) {
    console.log(`词书目录: ${loaded.absoluteDir}`)
    console.log('词书汇总:', summarizeByWordbook(vocabulary))
  } else {
    console.log(`词库文件: ${loaded.absolutePath}`)
  }
  formatVocabularyReport(report).forEach(line => console.log(line))

  if (!report.isValid) {
    console.warn('发现重复词、字段缺失或范围错误，请修复后再正式导入。')
  }

  if (dryRun) {
    console.log('dry-run 模式：仅校验，不写入数据库。')
    return { report, result: null }
  }

  await mongoose.connect(MONGODB_URI)
  try {
    const result = await upsertVocabulary(vocabulary)
    console.log(`导入完成: matched=${result.matchedCount || 0}, modified=${result.modifiedCount || 0}, upserted=${result.upsertedCount || 0}`)
    return { report, result }
  } finally {
    await mongoose.disconnect()
  }
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('importVocabulary.js')
if (isDirectRun) {
  importVocabulary(parseArgs(process.argv.slice(2)))
    .then(({ report }) => process.exit(report.isValid ? 0 : 1))
    .catch(error => {
      console.error('词库导入失败:', error)
      process.exit(1)
    })
}
