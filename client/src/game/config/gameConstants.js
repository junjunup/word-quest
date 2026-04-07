/**
 * 游戏全局配置 — 所有魔法数字的单一来源
 * 任何数值调整只改此文件，不改组件/场景代码
 */

// ============ 难度配置 ============
export const DIFFICULTY_CONFIGS = {
  easy:   { lives: 4, timer: 35000, scoreMultiplier: 0.8, monsterMod: -2, label: '简单', icon: '🌱', desc: '35秒/4命/0.8x' },
  normal: { lives: 3, timer: 30000, scoreMultiplier: 1.0, monsterMod: 0,  label: '普通', icon: '⚔️', desc: '30秒/3命/1.0x' },
  hard:   { lives: 2, timer: 20000, scoreMultiplier: 1.5, monsterMod: 3,  label: '困难', icon: '🔥', desc: '20秒/2命/1.5x' }
}

// ============ 题型定义 ============
export const QUESTION_TYPES = {
  choice_en2cn: { id: 'choice_en2cn', label: '英→中', prompt: '请选择正确的中文释义：', isChoice: true, showWord: true },
  choice_cn2en: { id: 'choice_cn2en', label: '中→英', prompt: '请选择正确的英文单词：', isChoice: true, showWord: false },
  spell_hint:   { id: 'spell_hint',   label: '提示拼写', prompt: '请根据提示拼写单词：', isChoice: false, showWord: true },
  spell_full:   { id: 'spell_full',   label: '完整拼写', prompt: '请拼写对应的英文单词：', isChoice: false, showWord: false },
  translate:    { id: 'translate',     label: '翻译', prompt: '请输入对应的英文翻译：', isChoice: false, showWord: false }
}

// ============ 死亡螺旋保护 ============
export const DEATH_SPIRAL = {
  /** 连错 N 次后强制最简单题型 + 恩赐生命 */
  forceEasyThreshold: 3,
  /** 连错 N 次后降级为选择题（但保留当前难度） */
  downgradeThreshold: 2,
  /** 降级后的题型 */
  downgradeType: 'choice_en2cn',
  /** 恩赐生命时强制的难度等级 */
  forcedDifficulty: 1
}

// ============ 无尽模式配置 ============
export const ENDLESS_CONFIG = {
  initialLives: 3,
  baseTimeLimit: 30000,
  minTimeLimit: 10000,
  timeLimitReductionPerLevel: 4000,
  baseScorePerAnswer: 100,
  difficultyThresholds: [
    { streak: 0, level: 1 },
    { streak: 5, level: 2 },
    { streak: 10, level: 3 },
    { streak: 20, level: 4 },
    { streak: 30, level: 5 }
  ],
  /** 难度 <= 2 时使用选择题，> 2 时使用拼写题 */
  choiceModeMaxLevel: 2
}

// ============ 教程配置 ============
export const TUTORIAL_CONFIG = {
  lives: 99,
  timer: 60000,
  /** 玩家移动后等待多久进入下一步 (ms) */
  moveDetectDelay: 1500,
  /** 答题完成后等待多久显示总结 (ms) */
  quizCompleteDelay: 800
}

// ============ 计分配置 ============
export const SCORING_CONFIG = {
  baseScore: 100,
  comboBonus: 10,
  comboBonusCap: 50,
  timeBonusTiers: [
    { maxMs: 3000, bonus: 50 },
    { maxMs: 5000, bonus: 30 },
    { maxMs: 10000, bonus: 15 }
  ],
  hintPenalty: 0.5,
  bossDefeatBonus: 500
}

// ============ 章节视觉主题 ============
export const CHAPTER_THEMES = {
  1: { name: '田园', bgColor: '#4a8c28', grassColors: [0x5b8c3e, 0x4a8c28, 0x6b9c4e, 0x5a9a38], decoFrames: [0, 3, 6, 7, 8, 9], decoCount: 40 },
  2: { name: '森林', bgColor: '#2d6b16', grassColors: [0x3a6b1e, 0x2d5016, 0x4a7c2e, 0x3a5a2e], decoFrames: [12, 15, 18, 21, 24, 27], decoCount: 50 },
  3: { name: '集市', bgColor: '#7c6b3e', grassColors: [0x8b7c4a, 0x6b5c3a, 0x9c8c5a, 0x7a6c3e], decoFrames: [0, 3, 9, 12], decoCount: 30 },
  4: { name: '塔楼', bgColor: '#3a4c6e', grassColors: [0x4a5c7e, 0x3a4c6e, 0x5a6c8e, 0x4a5a6e], decoFrames: [6, 7, 15, 18], decoCount: 35 },
  5: { name: '深渊', bgColor: '#2a1a2a', grassColors: [0x3a2a3a, 0x2a1a2a, 0x4a3a4a, 0x3a2a3a], decoFrames: [21, 24, 27], decoCount: 20 },
  6: { name: '终极', bgColor: '#5b5016', grassColors: [0x6b6026, 0x5b5016, 0x7b7036, 0x6a5a26], decoFrames: [0, 3, 6, 9, 12, 15, 18, 21], decoCount: 45 }
}

// ============ 通用后备干扰项词库 ============
// 当关卡词汇不足4个时，从此词库中补充干扰选项（不会出现"（无选项）"）
export const FALLBACK_DISTRACTORS = {
  meanings: [
    '苹果', '快乐的', '奔跑', '美丽的', '学习',
    '朋友', '音乐', '阳光', '旅行', '花朵',
    '梦想', '勇敢的', '智慧', '海洋', '星星',
    '自由', '力量', '希望', '时间', '故事'
  ],
  words: [
    'apple', 'happy', 'running', 'beautiful', 'study',
    'friend', 'music', 'sunshine', 'travel', 'flower',
    'dream', 'brave', 'wisdom', 'ocean', 'star',
    'freedom', 'power', 'hope', 'time', 'story'
  ]
}

// ============ localStorage 键名常量 ============
export const STORAGE_KEYS = {
  muted: 'wordquest:muted',
  volume: 'wordquest:volume',
  difficulty: 'wordquest:difficulty',
  skipIntro: 'wordquest:skipIntro',
  endlessBest: 'wordquest:endlessBest',
  achievementContext: 'wordquest:achievementContext'
}

// ============ Boss 生成区域配置 ============
export const BOSS_SPAWN = {
  /** 可选生成区域（避免只在右上角） */
  zones: [
    { minX: 650, maxX: 850, minY: 100, maxY: 200 },   // 右上
    { minX: 650, maxX: 850, minY: 400, maxY: 550 },   // 右下
    { minX: 200, maxX: 400, minY: 100, maxY: 200 },   // 左上
  ],
  /** 与玩家出生点(80,300)的最小距离 */
  minPlayerDistance: 300
}
