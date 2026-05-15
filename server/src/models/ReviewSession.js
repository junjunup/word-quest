import mongoose from 'mongoose'

const reviewSessionWordSchema = new mongoose.Schema({
  wordId: { type: mongoose.Schema.Types.Mixed, required: true },
  word: { type: String, required: true },
  meaning: { type: String, default: '' },
  phonetic: { type: String, default: '' },
  example: { type: String, default: '' },
  exampleTranslation: { type: String, default: '' },
  masteryScore: { type: Number, default: 0, min: 0, max: 100 },
  reasons: [{ type: String }]
}, { _id: false })

const reviewSessionAnswerSchema = new mongoose.Schema({
  wordId: { type: mongoose.Schema.Types.Mixed, required: true },
  playerAnswer: { type: String, default: '' },
  correctAnswer: { type: String, default: '' },
  isCorrect: { type: Boolean, default: false },
  responseTime: { type: Number, default: 0, min: 0 },
  errorType: { type: String, default: 'unknown' },
  quizRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizRecord', default: null },
  masteryId: { type: mongoose.Schema.Types.ObjectId, ref: 'WordMastery', default: null }
}, { _id: false })

const reviewSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  wordbookId: { type: String, default: 'cet4', index: true },
  status: { type: String, enum: ['created', 'submitted'], default: 'created', index: true },
  words: [reviewSessionWordSchema],
  answers: [reviewSessionAnswerSchema],
  submittedAt: { type: Date, default: null }
}, { timestamps: true })

reviewSessionSchema.index({ userId: 1, wordbookId: 1, createdAt: -1 })

export default mongoose.model('ReviewSession', reviewSessionSchema)
