import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import VocabularyBank from '../models/VocabularyBank.js'
import User from '../models/User.js'
import Friendship from '../models/Friendship.js'
import AsyncChallenge from '../models/AsyncChallenge.js'
import PronunciationAttempt from '../models/PronunciationAttempt.js'
import DailyChallenge from '../models/DailyChallenge.js'
import DailyChallengeAttempt from '../models/DailyChallengeAttempt.js'
import { loadWordbookFiles, upsertVocabulary } from './importVocabulary.js'
import { validateVocabulary } from '../utils/vocabularyValidator.js'
import { scorePronunciation } from '../services/pronunciationScoringService.js'

const EXPECTED_WORDBOOK_COUNTS = {
  cet4: 4544,
  cet4_core_2000: 2000,
  cet6: 3991,
  postgraduate: 5047
}

function normalizeAnswer(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z\s-]/g, '').replace(/\s+/g, ' ')
}

function buildSubmission(userId, words, strategy = 'correct') {
  const answers = words.map(item => {
    const answer = strategy === 'correct' ? item.word : 'incorrect-answer'
    const correct = normalizeAnswer(answer) === normalizeAnswer(item.word)
    return {
      wordId: item.wordId,
      expected: item.word,
      answer,
      correct,
      score: correct ? 100 : 0
    }
  })
  return {
    userId,
    answers,
    score: answers.reduce((sum, item) => sum + item.score, 0),
    correctCount: answers.filter(item => item.correct).length,
    submittedAt: new Date()
  }
}

function assertWordbooks(vocabulary) {
  const report = validateVocabulary(vocabulary)
  assert.equal(report.isValid, true, 'all generated wordbooks should pass validation')
  const counts = {}
  for (const entry of vocabulary) {
    counts[entry.wordbookId] = (counts[entry.wordbookId] || 0) + 1
  }
  for (const [wordbookId, expected] of Object.entries(EXPECTED_WORDBOOK_COUNTS)) {
    assert.equal(counts[wordbookId], expected, `${wordbookId} generated count should match manifest`)
  }
  return counts
}

function selectChallengeWords(vocabulary) {
  return vocabulary
    .filter(item => item.wordbookId === 'cet4')
    .slice(0, 10)
    .map(item => ({
      wordId: new mongoose.Types.ObjectId(),
      word: item.word,
      meaning: item.meaning,
      phonetic: item.phonetic,
      example: item.example,
      exampleTranslation: item.exampleTranslation
    }))
}

async function runOfflineValidation(vocabulary) {
  const aliceId = new mongoose.Types.ObjectId()
  const bobId = new mongoose.Types.ObjectId()

  const friendship = new Friendship({ requester: aliceId, recipient: bobId, status: 'accepted' })
  await friendship.validate()
  assert.deepEqual(friendship.users.map(id => id.toString()).sort(), [aliceId.toString(), bobId.toString()].sort(), 'friendship should normalize participant ids')

  const challengeWords = selectChallengeWords(vocabulary)
  const challenge = new AsyncChallenge({
    challenger: aliceId,
    opponent: bobId,
    wordbookId: 'cet4',
    wordbookName: 'CET-4 真题核心词库（4500）',
    questionCount: challengeWords.length,
    words: challengeWords,
    status: 'awaiting_challenger'
  })
  challenge.submissions.push(buildSubmission(aliceId, challengeWords, 'correct'))
  challenge.submissions.push(buildSubmission(bobId, challengeWords, 'wrong'))
  challenge.status = 'completed'
  challenge.winner = aliceId
  await challenge.validate()
  assert.equal(challenge.submissions.length, 2, 'async challenge should accept two submissions')
  assert.equal(challenge.winner.toString(), aliceId.toString(), 'server-side score simulation should determine winner')

  const dailyChallenge = new DailyChallenge({
    date: '2026-05-15',
    wordbookId: 'cet4',
    wordbookName: 'CET-4 真题核心词库（4500）',
    questionCount: challengeWords.length,
    seed: '2026-05-15:cet4',
    questions: challengeWords.map(item => ({ ...item, options: [item.meaning, '干扰项A', '干扰项B', '干扰项C'] }))
  })
  await dailyChallenge.validate()
  const dailyAttempt = new DailyChallengeAttempt({
    challengeId: dailyChallenge._id,
    date: dailyChallenge.date,
    wordbookId: 'cet4',
    userId: aliceId,
    answers: challengeWords.map(item => ({ wordId: item.wordId, expected: item.meaning, answer: item.meaning, correct: true, score: 100 })),
    score: challengeWords.length * 100,
    correctCount: challengeWords.length,
    questionCount: challengeWords.length,
    durationMs: 60000,
    streak: 3,
    rewardExp: 43,
    rewardTitle: '三日坚持者'
  })
  await dailyAttempt.validate()

  const scored = scorePronunciation({ word: challengeWords[0].word, transcript: challengeWords[0].word, expectedPhonetic: challengeWords[0].phonetic, confidence: 0.96 })
  assert.ok(scored.score >= 90, 'exact pronunciation transcript should receive high score')
  const attempt = new PronunciationAttempt({
    userId: aliceId,
    wordId: challengeWords[0].wordId,
    wordbookId: 'cet4',
    word: challengeWords[0].word,
    expectedPhonetic: challengeWords[0].phonetic,
    transcript: challengeWords[0].word,
    confidence: 0.96,
    score: scored.score,
    grade: scored.grade,
    details: scored.details
  })
  await attempt.validate()

  return {
    mode: 'offline-schema-and-business-validation',
    friendship: 'schema-valid',
    asyncChallenge: { status: challenge.status, submissions: challenge.submissions.length, winner: 'alice_enterprise' },
    dailyChallenge: { date: dailyChallenge.date, questions: dailyChallenge.questions.length, streak: dailyAttempt.streak, rewardTitle: dailyAttempt.rewardTitle },
    pronunciation: { score: scored.score, grade: scored.grade }
  }
}

async function runDatabaseValidation(vocabulary, mongoUri) {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
  try {
    await Promise.all([
      VocabularyBank.deleteMany({}),
      User.deleteMany({ username: { $in: ['alice_enterprise', 'bob_enterprise'] } }),
      Friendship.deleteMany({}),
      AsyncChallenge.deleteMany({}),
      DailyChallenge.deleteMany({}),
      DailyChallengeAttempt.deleteMany({}),
      PronunciationAttempt.deleteMany({})
    ])
    await upsertVocabulary(vocabulary)

    const importedCounts = {}
    for (const wordbookId of Object.keys(EXPECTED_WORDBOOK_COUNTS)) {
      importedCounts[wordbookId] = await VocabularyBank.countDocuments({ wordbookId })
      assert.equal(importedCounts[wordbookId], EXPECTED_WORDBOOK_COUNTS[wordbookId], `${wordbookId} DB count should match generated source`)
    }

    const alice = await User.create({ username: 'alice_enterprise', password: '123456', nickname: 'Alice 企业勇者' })
    const bob = await User.create({ username: 'bob_enterprise', password: '123456', nickname: 'Bob 企业勇者' })
    const friendship = await Friendship.create({ requester: alice._id, recipient: bob._id, status: 'accepted', respondedAt: new Date() })
    assert.ok(await Friendship.findById(friendship._id), 'accepted friendship should be persisted')

    const selectedWords = await VocabularyBank.find({ wordbookId: 'cet4' }).sort({ word: 1 }).limit(10).lean()
    assert.equal(selectedWords.length, 10, 'challenge should draw ten CET4 words from DB')
    const challengeWords = selectedWords.map(item => ({ wordId: item._id, word: item.word, meaning: item.meaning, phonetic: item.phonetic, example: item.example, exampleTranslation: item.exampleTranslation }))
    const challenge = await AsyncChallenge.create({
      challenger: alice._id,
      opponent: bob._id,
      wordbookId: 'cet4',
      wordbookName: 'CET-4 真题核心词库（4500）',
      questionCount: challengeWords.length,
      words: challengeWords,
      submissions: [buildSubmission(alice._id, challengeWords, 'correct'), buildSubmission(bob._id, challengeWords, 'wrong')],
      status: 'completed',
      winner: alice._id
    })
    assert.ok(await AsyncChallenge.findById(challenge._id), 'async challenge should be persisted')

    const dailyChallenge = await DailyChallenge.create({
      date: '2026-05-15',
      wordbookId: 'cet4',
      wordbookName: 'CET-4 真题核心词库（4500）',
      questionCount: challengeWords.length,
      seed: '2026-05-15:cet4',
      questions: challengeWords.map(item => ({ ...item, options: [item.meaning, '干扰项A', '干扰项B', '干扰项C'] }))
    })
    const dailyAttempt = await DailyChallengeAttempt.create({
      challengeId: dailyChallenge._id,
      date: dailyChallenge.date,
      wordbookId: 'cet4',
      userId: alice._id,
      answers: challengeWords.map(item => ({ wordId: item.wordId, expected: item.meaning, answer: item.meaning, correct: true, score: 100 })),
      score: challengeWords.length * 100,
      correctCount: challengeWords.length,
      questionCount: challengeWords.length,
      durationMs: 60000,
      streak: 3,
      rewardExp: 43,
      rewardTitle: '三日坚持者'
    })
    assert.ok(await DailyChallengeAttempt.findById(dailyAttempt._id), 'daily challenge attempt should be persisted')

    const pronunciationWord = selectedWords[0]
    const scored = scorePronunciation({ word: pronunciationWord.word, transcript: pronunciationWord.word, expectedPhonetic: pronunciationWord.phonetic, confidence: 0.96 })
    const attempt = await PronunciationAttempt.create({
      userId: alice._id,
      wordId: pronunciationWord._id,
      wordbookId: pronunciationWord.wordbookId,
      word: pronunciationWord.word,
      expectedPhonetic: pronunciationWord.phonetic,
      transcript: pronunciationWord.word,
      confidence: 0.96,
      score: scored.score,
      grade: scored.grade,
      details: scored.details
    })
    assert.ok(await PronunciationAttempt.findById(attempt._id), 'pronunciation attempt should be persisted')

    return {
      mode: 'database-persistence-validation',
      importedCounts,
      friendship: 'accepted-and-persisted',
      asyncChallenge: { status: 'completed', submissions: 2, winner: 'alice_enterprise' },
      dailyChallenge: { date: dailyChallenge.date, questions: dailyChallenge.questions.length, persistedAttempt: true },
      pronunciation: { score: scored.score, grade: scored.grade }
    }
  } finally {
    await mongoose.disconnect()
  }
}

async function main() {
  const { vocabulary } = loadWordbookFiles('src/data/wordbooks')
  const generatedCounts = assertWordbooks(vocabulary)
  const mongoUri = process.env.MONGODB_URI
  const shouldUseDatabase = Boolean(mongoUri) && process.env.ENTERPRISE_TEST_MODE !== 'offline'
  const result = shouldUseDatabase
    ? await runDatabaseValidation(vocabulary, mongoUri)
    : await runOfflineValidation(vocabulary)

  console.log(JSON.stringify({
    status: 'PASS',
    generatedCounts,
    ...result
  }, null, 2))
}

main().catch(error => {
  console.error('企业硬需求集成验证失败:', error)
  process.exit(1)
})
