import { loadVocabularyFile, loadWordbookFiles } from './importVocabulary.js'
import { validateVocabulary, formatVocabularyReport } from '../utils/vocabularyValidator.js'

function parseArgs(argv) {
  const args = { file: '', json: false, allWordbooks: true, wordbookDir: 'src/data/wordbooks' }
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
    } else if (item === '--json') {
      args.json = true
    }
  }
  return args
}

function summarizeByWordbook(vocabulary) {
  const grouped = new Map()
  for (const entry of vocabulary) {
    const key = String(entry.wordbookId || 'default')
    const current = grouped.get(key) || { wordbookId: key, wordbookName: entry.wordbookName || key, count: 0 }
    current.count += 1
    grouped.set(key, current)
  }
  return [...grouped.values()].sort((a, b) => a.wordbookId.localeCompare(b.wordbookId))
}

export function runVocabularyValidation({ file = '', json = false, allWordbooks = true, wordbookDir = 'src/data/wordbooks' } = {}) {
  const loaded = allWordbooks
    ? loadWordbookFiles(wordbookDir)
    : loadVocabularyFile(file || 'src/data/vocabulary.json')
  const vocabulary = loaded.vocabulary
  const report = validateVocabulary(vocabulary)
  const payload = {
    source: allWordbooks ? loaded.absoluteDir : loaded.absolutePath,
    wordbooks: summarizeByWordbook(vocabulary),
    ...report
  }

  if (json) {
    console.log(JSON.stringify(payload, null, 2))
  } else {
    console.log(`${allWordbooks ? '词书目录' : '词库文件'}: ${payload.source}`)
    if (payload.wordbooks.length > 0) {
      console.log('词书汇总:', payload.wordbooks.map(item => `${item.wordbookId}=${item.count}`).join(', '))
    }
    formatVocabularyReport(report).forEach(line => console.log(line))
    if (report.duplicates.length > 0) {
      console.log('重复词示例:', report.duplicates.slice(0, 10))
    }
    if (report.missingFields.length > 0) {
      console.log('缺失字段示例:', report.missingFields.slice(0, 10))
    }
    if (report.invalidRanges.length > 0) {
      console.log('范围错误示例:', report.invalidRanges.slice(0, 10))
    }
  }

  return report
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('validateVocabulary.js')
if (isDirectRun) {
  try {
    const report = runVocabularyValidation(parseArgs(process.argv.slice(2)))
    process.exit(report.isValid ? 0 : 1)
  } catch (error) {
    console.error('词库校验失败:', error)
    process.exit(1)
  }
}
