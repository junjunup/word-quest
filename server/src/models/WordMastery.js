import mongoose from 'mongoose'

const sourceStatsSchema = new mongoose.Schema({
  mainline: { type: Number, default: 0, min: 0 },
  boss: { type: Number, default: 0, min: 0 },
  review: { type: Number, default: 0, min: 0 },
  daily: { type: Number, default: 0, min: 0 },
  pk: { type: Number, default: 0, min: 0 },
  pronunciation: { type: Number, default: 0, min: 0 },
  endless: { type: Number, default: 0, min: 0 }
}, { _id: false })

const wordMasterySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  wordId: { type: mongoose.Schema.Types.Mixed, required: true },
  wordbookId: { type: String, default: 'cet4', index: true, trim: true },
  word: { type: String, required: true, trim: true },
  masteryScore: { type: Number, default: 0, min: 0, max: 100 },
  lastReviewedAt: { type: Date, default: null },
  nextReviewAt: { type: Date, default: () => new Date() },
  reviewInterval: { type: Number, default: 1, min: 0 },
  easeFactor: { type: Number, default: 2.5, min: 1.3, max: 3.0 },
  totalAttempts: { type: Number, default: 0, min: 0 },
  exactCount: { type: Number, default: 0, min: 0 },
  nearCount: { type: Number, default: 0, min: 0 },
  wrongCount: { type: Number, default: 0, min: 0 },
  timeoutCount: { type: Number, default: 0, min: 0 },
  pronunciationCount: { type: Number, default: 0, min: 0 },
  lastAnswerQuality: { type: String, enum: ['exact', 'near', 'wrong'], default: 'wrong' },
  lastErrorType: { type: String, enum: ['unknown', 'spelling_near', 'meaning_confusion', 'timeout', 'pronunciation', 'other'], default: 'unknown' },
  recentErrorTypes: [{ type: String, enum: ['unknown', 'spelling_near', 'meaning_confusion', 'timeout', 'pronunciation', 'other'] }],
  sourceStats: { type: sourceStatsSchema, default: () => ({}) }
}, { timestamps: true })

wordMasterySchema.index({ userId: 1, wordId: 1 }, { unique: true })
wordMasterySchema.index({ userId: 1, wordbookId: 1, nextReviewAt: 1 })
wordMasterySchema.index({ userId: 1, wordbookId: 1, masteryScore: 1 })

export default mongoose.model('WordMastery', wordMasterySchema)
