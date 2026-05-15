import mongoose from 'mongoose'
import 'dotenv/config'
import VocabularyBank from '../models/VocabularyBank.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/word-quest'
const EXPECTED_COUNTS = {
  cet4: 4544,
  cet4_core_2000: 2000,
  cet6: 3991,
  postgraduate: 5047
}

async function main() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  try {
    const counts = {}
    for (const wordbookId of Object.keys(EXPECTED_COUNTS)) {
      counts[wordbookId] = await VocabularyBank.countDocuments({ wordbookId })
    }
    const total = await VocabularyBank.countDocuments({ wordbookId: { $in: Object.keys(EXPECTED_COUNTS) } })
    const failures = Object.entries(EXPECTED_COUNTS)
      .filter(([wordbookId, expected]) => counts[wordbookId] !== expected)
      .map(([wordbookId, expected]) => `${wordbookId}: expected ${expected}, got ${counts[wordbookId] || 0}`)

    const payload = {
      status: failures.length === 0 ? 'PASS' : 'FAIL',
      mongoUri: MONGODB_URI.replace(/:\/\/[^@]+@/, '://***@'),
      total,
      counts,
      expected: EXPECTED_COUNTS,
      failures
    }
    console.log(JSON.stringify(payload, null, 2))
    if (failures.length > 0) process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(error => {
  console.error('MongoDB 词书落库验证失败:', error)
  process.exit(1)
})
