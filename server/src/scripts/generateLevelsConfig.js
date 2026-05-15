import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { MAX_CHAPTER, MAX_LEVEL } from '../services/courseMapService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SERVER_SRC = join(__dirname, '..')
const PROJECT_ROOT = join(SERVER_SRC, '..', '..')
const SOURCE_FILE = join(SERVER_SRC, 'data', 'wordbooks', 'cet4.json')
const TARGET_FILE = join(PROJECT_ROOT, 'client', 'src', 'game', 'data', 'levels.json')

const CHAPTER_META = [
  { id: 1, name: '初入大陆', theme: 'CET-4 高频基础', description: '从四级核心高频词出发，建立稳定的词义与拼写基础。', color: '#4a90d9' },
  { id: 2, name: '森林迷踪', theme: '场景语义拓展', description: '进入自然、生活与语境化词汇区域，提升词义辨析能力。', color: '#7ed321' },
  { id: 3, name: '商贸集市', theme: '校园商务社交', description: '覆盖校园、商务、社交沟通中的四级重点表达。', color: '#f5a623' },
  { id: 4, name: '学者塔楼', theme: '学术科技表达', description: '挑战学术、科技、抽象概念等较高难度词汇。', color: '#9b59b6' },
  { id: 5, name: '暗影深渊', theme: '易混与进阶词', description: '聚焦形近、义近和容易误判的四级核心词汇。', color: '#d0021b' },
  { id: 6, name: '最终考验', theme: '综合冲刺复习', description: '按考试强度综合复习全词书知识，完成最终闭环。', color: '#ffd700' }
]

const BOSS_TYPES = ['roaming', 'turret', 'charging']
const BOSS_NAMES = {
  roaming: ['巡游守卫', '迷踪猎手', '集市游侠', '塔楼看守', '暗影行者', '终局巡游者'],
  turret: ['符文炮台', '孢子炮台', '金币炮台', '激光书塔', '混淆炮台', '终局炮台'],
  charging: ['冲锋牛魔', '风暴冲锋', '社交暴徒', '电磁冲锋', '深渊狂奔', '终局冲锋者']
}

function groupWords(words) {
  const grouped = new Map()
  for (const word of words) {
    const chapter = Number(word.chapter)
    const level = Number(word.level)
    if (!Number.isInteger(chapter) || !Number.isInteger(level)) continue
    const key = `${chapter}-${level}`
    const bucket = grouped.get(key) || []
    bucket.push(word)
    grouped.set(key, bucket)
  }
  return grouped
}

function dominantCategory(words) {
  const counts = new Map()
  for (const word of words) {
    const category = String(word.category || 'general').trim() || 'general'
    counts.set(category, (counts.get(category) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'general'
}

function buildBossConfig(bossType, chapter, level) {
  const names = BOSS_NAMES[bossType]
  return {
    name: `${names[(chapter - 1) % names.length]}·${level}`,
    baseHp: Math.min(10, 3 + Math.floor((chapter + level) / 8)),
    speed: bossType === 'turret' ? 0 : (bossType === 'charging' ? 190 + chapter * 10 + level : 28 + chapter * 3 + Math.floor(level / 3))
  }
}

function buildConfig(words) {
  const grouped = groupWords(words)
  const missing = []
  for (let chapter = 1; chapter <= MAX_CHAPTER; chapter++) {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const count = grouped.get(`${chapter}-${level}`)?.length || 0
      if (count <= 0) missing.push(`${chapter}-${level}`)
    }
  }
  if (missing.length > 0) {
    throw new Error(`CET4 词书缺少以下章节/关卡词汇: ${missing.join(', ')}`)
  }

  return {
    chapters: CHAPTER_META.map(chapterMeta => ({
      ...chapterMeta,
      levels: Array.from({ length: MAX_LEVEL }, (_, index) => {
        const level = index + 1
        const levelWords = grouped.get(`${chapterMeta.id}-${level}`) || []
        const bossType = BOSS_TYPES[(level - 1) % BOSS_TYPES.length]
        return {
          id: level,
          name: `第${level}关 · ${dominantCategory(levelWords)}`,
          wordsCount: levelWords.length,
          category: dominantCategory(levelWords),
          bossType,
          bossConfig: buildBossConfig(bossType, chapterMeta.id, level),
          ...(chapterMeta.id === 1 && level === 1 ? { isTutorial: true } : {})
        }
      })
    }))
  }
}

function main() {
  const words = JSON.parse(readFileSync(SOURCE_FILE, 'utf-8'))
  if (!Array.isArray(words)) throw new Error('CET4 词书 JSON 顶层必须是数组')
  const config = buildConfig(words)
  writeFileSync(TARGET_FILE, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
  console.log(`已生成 ${config.chapters.length} 章 × ${config.chapters[0].levels.length} 关: ${TARGET_FILE}`)
}

main()
