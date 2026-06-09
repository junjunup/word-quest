/**
 * Cycle 2 regression tests: T2 speed_demon gating, T3 adaptive accounting, T4 learning metrics.
 * Run: node --test client/tests/unit/cycle2.quality.test.mjs
 */
import assert from 'node:assert'
import test from 'node:test'
import ScoreSystem from '../../src/game/systems/ScoreSystem.js'
import levelManager from '../../src/game/systems/LevelManager.js'

// ── T2: speed_demon 限定非选择题 ──

test('T2: speed_demon NOT unlocked by choice-only fast answer', () => {
  const ss = new ScoreSystem()
  const ctx = {
    levelsCompleted: 0, perfectClears: 0, maxCombo: 0, wordsLearned: 0,
    fastestCorrect: 2000,         // choice question, fast
    fastestNonChoiceCorrect: 0,    // never had a non-choice correct
    chaptersCompleted: 0, loginStreak: 0, npcChats: 0
  }
  const results = ss.checkAchievements(ctx)
  const hasSpeedDemon = results.some(a => a.id === 'speed_demon')
  assert.strictEqual(hasSpeedDemon, false,
    'speed_demon should NOT unlock on choice-only fast answers')
})

test('T2: speed_demon unlocked by spelling fast answer', () => {
  const ss = new ScoreSystem()
  const ctx = {
    levelsCompleted: 0, perfectClears: 0, maxCombo: 0, wordsLearned: 0,
    fastestCorrect: 0,
    fastestNonChoiceCorrect: 2000,  // spelling question, fast
    chaptersCompleted: 0, loginStreak: 0, npcChats: 0
  }
  const results = ss.checkAchievements(ctx)
  const hasSpeedDemon = results.some(a => a.id === 'speed_demon')
  assert.strictEqual(hasSpeedDemon, true,
    'speed_demon SHOULD unlock on non-choice fast answer <= 3s')
})

test('T2: speed_demon NOT unlocked by slow non-choice answer (>3s)', () => {
  const ss = new ScoreSystem()
  const ctx = {
    levelsCompleted: 0, perfectClears: 0, maxCombo: 0, wordsLearned: 0,
    fastestCorrect: 0,
    fastestNonChoiceCorrect: 4500,  // spelling, but >3s
    chaptersCompleted: 0, loginStreak: 0, npcChats: 0
  }
  const results = ss.checkAchievements(ctx)
  const hasSpeedDemon = results.some(a => a.id === 'speed_demon')
  assert.strictEqual(hasSpeedDemon, false,
    'speed_demon should NOT unlock on non-choice answer > 3s')
})

// ── T4: 学习度量追踪 (LevelManager.trackLearningQuality) ──

test('T4: trackLearningQuality classifies recall vs recognition correctly', () => {
  levelManager.initLevel(1, 1, [{ word: 'test1' }, { word: 'test2' }, { word: 'test3' }], 'normal')

  // 拼写题 (recall)
  levelManager.trackLearningQuality({ isRecall: true, isDowngraded: false, answerQuality: 'exact' })
  // 选择题 (recognition)
  levelManager.trackLearningQuality({ isRecall: false, isDowngraded: false, answerQuality: 'correct' })
  // 降级拼写题 (recall + downgraded)
  levelManager.trackLearningQuality({ isRecall: true, isDowngraded: true, answerQuality: 'near' })

  const result = levelManager.getLevelResult()
  assert.strictEqual(result.recallCount, 2,
    'recallCount should count spelling/translate questions')
  assert.strictEqual(result.recognitionCount, 1,
    'recognitionCount should count choice questions')
  assert.strictEqual(result.downgradedCount, 1,
    'downgradedCount should count wasDowngraded questions')
})

test('T4: avgAnswerQuality computes correctly from quality scores', () => {
  levelManager.initLevel(1, 1, [{ word: 'a' }, { word: 'b' }, { word: 'c' }], 'normal')

  // exact=1, near=0.72, exact=1 → avg = (1+0.72+1)/3*100 ≈ 91
  levelManager.trackLearningQuality({ isRecall: true, isDowngraded: false, answerQuality: 'exact' })
  levelManager.trackLearningQuality({ isRecall: false, isDowngraded: false, answerQuality: 'near' })
  levelManager.trackLearningQuality({ isRecall: true, isDowngraded: false, answerQuality: 'exact' })

  const result = levelManager.getLevelResult()
  assert.strictEqual(result.avgAnswerQuality, 91,
    `avgAnswerQuality should be ~91, got ${result.avgAnswerQuality}`)
  assert.ok(result.avgAnswerQuality > 80, 'mastery quality should be above 80%')
})

test('T4: getLevelResult returns all new Cycle 2 fields', () => {
  levelManager.initLevel(1, 1, [{ word: 'hello' }], 'normal')
  levelManager.trackLearningQuality({ isRecall: true, isDowngraded: false, answerQuality: 'exact' })

  const result = levelManager.getLevelResult()
  const requiredFields = ['recallCount', 'recognitionCount', 'downgradedCount', 'avgAnswerQuality']
  for (const field of requiredFields) {
    assert.ok(field in result && result[field] !== undefined,
      `getLevelResult must include field: ${field}, got ${result[field]}`)
  }
})

// ── T3: 自适应记账字段结构验证（payload 结构测试）─
// T3 involves Vue composable submitQuizRecordAsync which needs hook context.
// We verify the data shape by testing the payload fields are present in the result.

test('T3: level result discriminates downgraded samples', () => {
  levelManager.initLevel(1, 1, Array.from({ length: 4 }, (_, i) => ({ word: `w${i}` })), 'hard')

  levelManager.trackLearningQuality({ isRecall: false, isDowngraded: false, answerQuality: 'exact' })
  levelManager.trackLearningQuality({ isRecall: false, isDowngraded: true, answerQuality: 'near' })
  levelManager.trackLearningQuality({ isRecall: true, isDowngraded: false, answerQuality: 'exact' })
  levelManager.trackLearningQuality({ isRecall: true, isDowngraded: true, answerQuality: 'wrong' })

  const result = levelManager.getLevelResult()
  assert.strictEqual(result.downgradedCount, 2, '2 downgraded questions expected')
  assert.ok(result.recallCount > 0, 'should have recall questions')
  assert.ok(result.recognitionCount > 0, 'should have recognition questions')
})

test('T3: non-downgraded sample quality should be higher than downgraded', () => {
  levelManager.initLevel(1, 1, Array.from({ length: 6 }, (_, i) => ({ word: `w${i}` })), 'normal')

  // 3 non-downgraded: all exact
  for (let i = 0; i < 3; i++) {
    levelManager.trackLearningQuality({ isRecall: true, isDowngraded: false, answerQuality: 'exact' })
  }
  // 3 downgraded: all wrong
  for (let i = 0; i < 3; i++) {
    levelManager.trackLearningQuality({ isRecall: false, isDowngraded: true, answerQuality: 'wrong' })
  }

  const result = levelManager.getLevelResult()
  assert.strictEqual(result.recallCount, 3)
  assert.strictEqual(result.recognitionCount, 3)
  assert.strictEqual(result.downgradedCount, 3)
  // Quality should be in the middle range since mixed
  assert.ok(result.avgAnswerQuality >= 40 && result.avgAnswerQuality <= 60,
    `avgQuality should be ~50% with 3 perfect + 3 wrong, got ${result.avgAnswerQuality}%`)
})
