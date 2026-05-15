import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import mongoose from 'mongoose'
import QuizRecord from '../models/QuizRecord.js'
import ReviewSession from '../models/ReviewSession.js'
import WordMastery from '../models/WordMastery.js'
import { classifyError } from '../services/answerVerificationService.js'
import { MAX_CHAPTER, MAX_LEVEL, getNextLevel, buildProgressKey, getLevelWordCount } from '../services/courseMapService.js'
import { validateProductionEnv } from '../config/index.js'

function assertCet4Distribution() {
  const words = JSON.parse(readFileSync(join(process.cwd(), 'src/data/wordbooks/cet4.json'), 'utf-8'))
  for (let chapter = 1; chapter <= MAX_CHAPTER; chapter++) {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const count = words.filter(word => Number(word.chapter) === chapter && Number(word.level) === level).length
      assert.ok(count > 0, `cet4 chapter ${chapter} level ${level} should contain words`)
    }
  }
  return words.length
}

function assertLevelsConfig() {
  const levels = JSON.parse(readFileSync(join(process.cwd(), '../client/src/game/data/levels.json'), 'utf-8'))
  assert.equal(levels.chapters.length, MAX_CHAPTER)
  assert.equal(levels.chapters.reduce((sum, chapter) => sum + chapter.levels.length, 0), MAX_CHAPTER * MAX_LEVEL)
  for (const chapter of levels.chapters) {
    assert.equal(chapter.levels.length, MAX_LEVEL)
    for (const level of chapter.levels) {
      assert.ok(level.wordsCount > 0, `level ${chapter.id}-${level.id} should expose wordsCount`)
      assert.ok(['roaming', 'turret', 'charging'].includes(level.bossType), `level ${chapter.id}-${level.id} should use enterprise boss type`)
    }
  }
}

function assertCourseMap() {
  assert.equal(buildProgressKey('cet4', 1, 2), 'cet4:1-2')
  assert.deepEqual(getNextLevel(1, 1), { chapter: 1, level: 2, nextChapter: 1, nextLevel: 2, chapterCompleted: false, completedCourse: false, courseCompleted: false, maxLevel: MAX_LEVEL })
  assert.deepEqual(getNextLevel(1, 30), { chapter: 2, level: 1, nextChapter: 2, nextLevel: 1, chapterCompleted: true, completedCourse: false, courseCompleted: false, maxLevel: MAX_LEVEL })
  assert.equal(getNextLevel(6, 30).completedCourse, true)
}

function assertErrorClassification() {
  assert.equal(classifyError({ isCorrect: true }), 'unknown')
  assert.equal(classifyError({ isCorrect: false, questionType: 'spell_full', playerAnswer: 'appel', correctAnswer: 'apple', answerQuality: 'near' }), 'spelling_near')
  assert.equal(classifyError({ isCorrect: false, questionType: 'choice_en2cn', playerAnswer: '梨', correctAnswer: '苹果', answerQuality: 'wrong' }), 'meaning_confusion')
  assert.equal(classifyError({ isCorrect: false, questionType: 'spell_full', playerAnswer: 'x', correctAnswer: 'apple', responseTime: 31000, timeLimit: 30000 }), 'timeout')
  assert.equal(classifyError({ isCorrect: false, questionType: 'pronunciation', playerAnswer: 'appl', correctAnswer: 'apple', pronunciationGrade: 'retry' }), 'pronunciation')
}

function assertProductionSafetyLogic() {
  assert.throws(() => validateProductionEnv({ NODE_ENV: 'production', JWT_SECRET: 'short', MONGODB_URI: 'mongodb://x', CORS_ORIGIN: 'https://x.example' }), /JWT_SECRET/)
  assert.throws(() => validateProductionEnv({ NODE_ENV: 'production', JWT_SECRET: 'prod_jwt_secret_with_more_than_32_chars_2026', MONGODB_URI: '', CORS_ORIGIN: 'https://x.example' }), /MONGODB_URI/)
  assert.throws(() => validateProductionEnv({ NODE_ENV: 'production', JWT_SECRET: 'prod_jwt_secret_with_more_than_32_chars_2026', MONGODB_URI: 'mongodb://x', CORS_ORIGIN: '*' }), /CORS_ORIGIN/)
  assert.doesNotThrow(() => validateProductionEnv({ NODE_ENV: 'production', JWT_SECRET: 'prod_jwt_secret_with_more_than_32_chars_2026', MONGODB_URI: 'mongodb://x', CORS_ORIGIN: 'https://x.example' }))
}

function assertLearningReportContracts() {
  const learningRoute = readFileSync(join(process.cwd(), 'src/routes/learning.js'), 'utf-8')
  const learningReport = readFileSync(join(process.cwd(), '../client/src/components/LearningReport.vue'), 'utf-8')
  assert.match(learningRoute, /router\.get\('\/error-types'/)
  assert.match(learningRoute, /masterySummary/)
  assert.match(learningRoute, /errorTypes/)
  assert.match(learningRoute, /sourceModes/)
  assert.match(learningReport, /错因分布/)
  assert.match(learningReport, /学习入口分布/)
}

function assertModelContracts() {
  const userId = new mongoose.Types.ObjectId()
  const wordId = new mongoose.Types.ObjectId()
  const mastery = new WordMastery({
    userId,
    wordId,
    wordbookId: 'cet4',
    word: 'apple',
    masteryScore: 45,
    lastAnswerQuality: 'exact',
    lastErrorType: 'unknown',
    sourceStats: { mainline: 1 }
  })
  const masteryError = mastery.validateSync()
  assert.equal(masteryError, undefined)

  const record = new QuizRecord({
    userId,
    wordId,
    wordbookId: 'cet4',
    word: 'apple',
    questionType: 'choice_en2cn',
    sourceMode: 'mainline',
    errorType: 'unknown',
    isCorrect: true,
    responseTime: 1000,
    difficulty: 1,
    sessionId: 'p0-session',
    chapter: 1,
    level: 1,
    playerAnswer: '苹果',
    correctAnswer: '苹果',
    answerQuality: 'exact',
    serverScore: 100,
    masteryDelta: 10,
    reviewScheduledAt: new Date()
  })
  const recordError = record.validateSync()
  assert.equal(recordError, undefined)

  const reviewSession = new ReviewSession({
    userId,
    wordbookId: 'cet4',
    words: [{ wordId, word: 'apple', meaning: '苹果', masteryScore: 45, reasons: ['low_mastery'] }],
    answers: [{ wordId, playerAnswer: '苹果', correctAnswer: '苹果', isCorrect: true, responseTime: 1000 }]
  })
  const reviewError = reviewSession.validateSync()
  assert.equal(reviewError, undefined)
}

async function main() {
  const cet4Count = assertCet4Distribution()
  assertLevelsConfig()
  assertCourseMap()
  assertErrorClassification()
  assertProductionSafetyLogic()
  assertLearningReportContracts()
  assertModelContracts()
  const count = await getLevelWordCount({ wordbookId: 'cet4', chapter: 1, level: 1 })
  assert.ok(count > 0)
  console.log(JSON.stringify({ status: 'PASS', cet4Count, levels: MAX_CHAPTER * MAX_LEVEL }, null, 2))
}

main().catch(error => {
  console.error('P0 acceptance validation failed:', error)
  process.exit(1)
})
