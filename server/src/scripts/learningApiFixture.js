// Isolated, real HTTP + MongoDB fixture. Never connects to application databases.
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import express from 'express'
import jwt from 'jsonwebtoken'
import { writeFile, unlink } from 'node:fs/promises'
import config from '../config/index.js'
import learningRouter from '../routes/learning.js'
import vocabularyRouter from '../routes/vocabulary.js'
import VocabularyBank from '../models/VocabularyBank.js'
import QuizRecord from '../models/QuizRecord.js'
import WordMastery from '../models/WordMastery.js'
import LearningLog from '../models/LearningLog.js'
import DailyLearningSession from '../models/DailyLearningSession.js'

const path = process.argv[2]
if (!path) throw new Error('Usage: node src/scripts/learningApiFixture.js /tmp/fixture.json')
const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.1' } })
await mongoose.connect(mongo.getUri(), { dbName: 'unity-learning-contract-test' })
await Promise.all([QuizRecord.init(), WordMastery.init(), LearningLog.init(), DailyLearningSession.init(), VocabularyBank.init()])
const words = [['river', '河流'], ['garden', '花园'], ['bridge', '桥梁'], ['apple', '苹果'], ['table', '桌子'], ['mountain', '山脉'], ['rain', '雨水'], ['school', '学校'], ['book', '书本'], ['chair', '椅子'], ['window', '窗户'], ['door', '门']]
await VocabularyBank.create(words.map(([word, meaning]) => ({ word, meaning, wordbookId: 'cet4', chapter: 1, level: 1 })))
const app = express()
app.use(express.json())
app.use('/api/learning', learningRouter)
app.use('/api/vocab', vocabularyRouter)
const server = app.listen(0, '127.0.0.1', async () => {
  const token = () => jwt.sign({ userId: String(new mongoose.Types.ObjectId()) }, config.jwtSecret, { expiresIn: '1h' })
  await writeFile(path, JSON.stringify({ origin: `http://127.0.0.1:${server.address().port}`, token: token(), otherToken: token() }), { mode: 0o600 })
  console.log('LEARNING_API_FIXTURE_READY')
})
let closing = false
async function close() {
  if (closing) return
  closing = true
  await new Promise(resolve => server.close(resolve))
  await mongoose.disconnect()
  await mongo.stop()
  await unlink(path).catch(() => {})
  process.exit(0)
}
process.once('SIGINT', close)
process.once('SIGTERM', close)
