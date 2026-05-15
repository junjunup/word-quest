import mongoose from 'mongoose'

const challengeWordSchema = new mongoose.Schema({
  wordId: { type: mongoose.Schema.Types.ObjectId, ref: 'VocabularyBank', required: true },
  word: { type: String, required: true },
  meaning: { type: String, required: true },
  phonetic: { type: String, default: '' },
  example: { type: String, default: '' },
  exampleTranslation: { type: String, default: '' }
}, { _id: false })

const challengeAnswerSchema = new mongoose.Schema({
  wordId: { type: mongoose.Schema.Types.ObjectId, required: true },
  expected: { type: String, required: true },
  answer: { type: String, default: '' },
  correct: { type: Boolean, default: false },
  score: { type: Number, default: 0 }
}, { _id: false })

const challengeSubmissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [challengeAnswerSchema],
  score: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now }
}, { _id: false })

const asyncChallengeSchema = new mongoose.Schema({
  challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  opponent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  wordbookId: { type: String, default: 'cet4', index: true },
  wordbookName: { type: String, default: 'CET-4 真题核心词库（4500）' },
  chapter: { type: Number, default: null },
  level: { type: Number, default: null },
  questionCount: { type: Number, default: 10, min: 3, max: 20 },
  words: [challengeWordSchema],
  submissions: [challengeSubmissionSchema],
  status: { type: String, enum: ['awaiting_challenger', 'awaiting_opponent', 'completed', 'cancelled'], default: 'awaiting_challenger', index: true },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), index: true }
}, { timestamps: true })

asyncChallengeSchema.index({ participants: 1, status: 1, updatedAt: -1 })

asyncChallengeSchema.pre('validate', function (next) {
  this.participants = [this.challenger, this.opponent].filter(Boolean)
  next()
})

export default mongoose.model('AsyncChallenge', asyncChallengeSchema)
