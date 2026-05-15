import mongoose from 'mongoose'

const dailyChallengeQuestionSchema = new mongoose.Schema({
  wordId: { type: mongoose.Schema.Types.ObjectId, ref: 'VocabularyBank', required: true },
  word: { type: String, required: true },
  phonetic: { type: String, default: '' },
  meaning: { type: String, required: true },
  example: { type: String, default: '' },
  exampleTranslation: { type: String, default: '' },
  options: [{ type: String, required: true }]
}, { _id: false })

const dailyChallengeSchema = new mongoose.Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  wordbookId: { type: String, default: 'cet4', index: true },
  wordbookName: { type: String, default: 'CET-4 真题核心词库（4500）' },
  questionCount: { type: Number, default: 12, min: 5, max: 30 },
  seed: { type: String, required: true },
  questions: [dailyChallengeQuestionSchema],
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true }
}, { timestamps: true })

dailyChallengeSchema.index({ date: 1, wordbookId: 1 }, { unique: true })

export default mongoose.model('DailyChallenge', dailyChallengeSchema)
