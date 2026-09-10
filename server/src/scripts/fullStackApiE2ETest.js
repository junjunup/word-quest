import assert from 'node:assert/strict'
import mongoose from 'mongoose'

process.env.NODE_ENV ||= 'test'
process.env.CORS_ORIGIN ||= 'http://127.0.0.1:3000'
process.env.JWT_SECRET ||= 'test_jwt_secret_with_more_than_32_chars_2026'

let memoryServer = null

async function resolveMongoUri() {
  if (process.env.MONGODB_URI) {
    return { uri: process.env.MONGODB_URI, mode: 'external-mongodb' }
  }

  if (process.env.FULLSTACK_E2E_USE_MEMORY_DB === 'true') {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    memoryServer = await MongoMemoryServer.create()
    return { uri: memoryServer.getUri(), mode: 'mongodb-memory-server' }
  }

  return { uri: '', mode: 'skipped-no-mongodb' }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed ${response.status}: ${JSON.stringify(json)}`)
  }
  return json
}

async function cleanDatabase(models) {
  await Promise.all(Object.values(models).map(model => model.deleteMany({})))
}

async function main() {
  const mongo = await resolveMongoUri()
  if (!mongo.uri) {
    console.log(JSON.stringify({
      status: 'SKIPPED',
      reason: 'No local MongoDB or MONGODB_URI is available. Set MONGODB_URI or FULLSTACK_E2E_USE_MEMORY_DB=true to run full-stack API E2E.',
      mode: mongo.mode
    }, null, 2))
    return
  }

  process.env.MONGODB_URI = mongo.uri

  const [
    { default: app },
    { loadWordbookFiles, upsertVocabulary },
    { default: User },
    { default: VocabularyBank },
    { default: GameProgress },
    { default: QuizRecord },
    { default: WordMastery },
    { default: ReviewSession },
    { default: LearningLog },
    { default: DailyChallenge },
    { default: DailyChallengeAttempt },
    { default: Friendship },
    { default: AsyncChallenge },
    { default: PronunciationAttempt }
  ] = await Promise.all([
    import('../app.js'),
    import('./importVocabulary.js'),
    import('../models/User.js'),
    import('../models/VocabularyBank.js'),
    import('../models/GameProgress.js'),
    import('../models/QuizRecord.js'),
    import('../models/WordMastery.js'),
    import('../models/ReviewSession.js'),
    import('../models/LearningLog.js'),
    import('../models/DailyChallenge.js'),
    import('../models/DailyChallengeAttempt.js'),
    import('../models/Friendship.js'),
    import('../models/AsyncChallenge.js'),
    import('../models/PronunciationAttempt.js')
  ])

  await mongoose.connect(mongo.uri, { serverSelectionTimeoutMS: 5000 })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const { port } = server.address()
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    await cleanDatabase({ User, VocabularyBank, GameProgress, QuizRecord, WordMastery, ReviewSession, LearningLog, DailyChallenge, DailyChallengeAttempt, Friendship, AsyncChallenge, PronunciationAttempt })

    const { vocabulary } = loadWordbookFiles('src/data/wordbooks')
    await upsertVocabulary(vocabulary)
    assert.equal(await VocabularyBank.countDocuments({ wordbookId: 'cet4' }), 4544, 'CET4 vocabulary should be imported into test DB')

    const username = `e2e_${Date.now()}`
    const registered = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { username, password: '123456', nickname: '全栈E2E勇者' }
    })
    const token = registered.data.token
    assert.ok(token, 'register should return token')

    const level30 = await request(baseUrl, '/api/vocab/chapter/1/level/30?wordbookId=cet4', { token })
    assert.ok(level30.data.length > 0, 'chapter 1 level 30 should be reachable from real API')

    const level1 = await request(baseUrl, '/api/vocab/chapter/1/level/1?wordbookId=cet4', { token })
    const word = level1.data[0]
    assert.ok(word?._id, 'chapter 1 level 1 should return a vocabulary entry')

    const quizRecord = await request(baseUrl, '/api/learning/quiz-record', {
      method: 'POST',
      token,
      body: {
        wordId: word._id,
        wordbookId: 'cet4',
        word: word.word,
        questionType: 'choice_en2cn',
        isCorrect: true,
        responseTime: 1200,
        timeLimit: 30000,
        difficulty: word.difficulty || 1,
        hintUsed: false,
        npcInteraction: false,
        sessionId: `fullstack-${Date.now()}`,
        chapter: word.chapter,
        level: word.level,
        playerAnswer: word.meaning,
        correctAnswer: word.meaning,
        sourceMode: 'mainline'
      }
    })
    assert.ok(quizRecord.data.record?._id, 'quiz-record should be persisted through real API')
    assert.ok(quizRecord.data.mastery?._id, 'quiz-record should update WordMastery through real API')

    const summary = await request(baseUrl, '/api/learning/mastery/summary?wordbookId=cet4', { token })
    assert.ok(summary.data.attempts >= 1, 'mastery summary should include the submitted attempt')

    const review = await request(baseUrl, '/api/learning/review/today?wordbookId=cet4&limit=10', { token })
    assert.ok(Array.isArray(review.data), 'review queue should return an array')

    const errorTypes = await request(baseUrl, '/api/learning/error-types?wordbookId=cet4&days=30', { token })
    assert.ok(errorTypes.data.sourceModes.some(item => item.sourceMode === 'mainline'), 'sourceMode distribution should include mainline')

    console.log(JSON.stringify({
      status: 'PASS',
      mode: mongo.mode,
      baseUrl,
      vocabulary: { cet4: 4544 },
      checks: [
        'register/login token issued by real API',
        'level 30 vocabulary reachable by real API',
        'quiz-record persisted by real API',
        'WordMastery updated by real API',
        'review queue API returns data shape',
        'errorType/sourceMode report API returns source distribution'
      ]
    }, null, 2))
  } finally {
    await new Promise(resolve => server.close(resolve))
    await mongoose.disconnect()
    if (memoryServer) await memoryServer.stop()
  }
}

// Route imports own background timers; exit only after main has awaited all fixture cleanup.
main().then(() => process.exit(0)).catch(error => {
  console.error('Full-stack API E2E failed:', error)
  process.exit(1)
})
