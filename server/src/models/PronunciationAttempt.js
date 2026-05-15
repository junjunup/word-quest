import mongoose from 'mongoose'

const pronunciationAttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  wordId: { type: mongoose.Schema.Types.ObjectId, ref: 'VocabularyBank', default: null, index: true },
  wordbookId: { type: String, default: 'cet4', index: true },
  word: { type: String, required: true, trim: true },
  expectedPhonetic: { type: String, default: '' },
  transcript: { type: String, required: true, trim: true },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  score: { type: Number, required: true, min: 0, max: 100 },
  grade: { type: String, enum: ['excellent', 'good', 'pass', 'retry'], required: true },
  details: {
    wordSimilarity: { type: Number, default: 0 },
    phoneticSimilarity: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0 },
    feedback: [{ type: String }]
  }
}, { timestamps: true })

pronunciationAttemptSchema.index({ userId: 1, createdAt: -1 })
pronunciationAttemptSchema.index({ userId: 1, word: 1, createdAt: -1 })

export default mongoose.model('PronunciationAttempt', pronunciationAttemptSchema)
