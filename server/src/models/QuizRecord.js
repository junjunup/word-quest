import mongoose from 'mongoose'

const sourceModes = ['mainline', 'boss', 'review', 'daily', 'pk', 'pronunciation', 'endless']
const errorTypes = ['unknown', 'spelling_near', 'meaning_confusion', 'timeout', 'pronunciation', 'other']

const quizRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  wordId: { type: mongoose.Schema.Types.Mixed, ref: 'VocabularyBank', required: true },
  wordbookId: { type: String, default: 'cet4', index: true, trim: true },
  word: { type: String, required: true },
  questionType: {
    type: String,
    enum: ['choice_en2cn', 'choice_cn2en', 'spell_hint', 'spell_full', 'fill_blank', 'translate', 'pronunciation'],
    required: true
  },
  sourceMode: { type: String, enum: sourceModes, default: 'mainline', index: true },
  errorType: { type: String, enum: errorTypes, default: 'unknown', index: true },
  isCorrect: { type: Boolean, required: true },
  responseTime: { type: Number, required: true, min: 0 },    // 毫秒
  timeLimit: { type: Number, default: null, min: 0 },
  difficulty: { type: Number, default: 1, min: 1, max: 5 },
  hintUsed: { type: Boolean, default: false },
  npcInteraction: { type: Boolean, default: false },
  sessionId: { type: String, required: true },
  chapter: { type: Number, required: true },
  level: { type: Number, required: true },
  playerAnswer: { type: String, default: '' },
  correctAnswer: { type: String, default: '' },
  answerQuality: { type: String, enum: ['exact', 'near', 'wrong'], default: 'wrong' },
  editDistance: { type: Number, default: null },
  similarity: { type: Number, default: 0, min: 0, max: 1 },
  scoreRatio: { type: Number, default: 0, min: 0, max: 1 },
  fuzzyFeedback: { type: String, default: '' },
  serverScore: { type: Number, default: 0, min: 0 },
  masteryDelta: { type: Number, default: 0 },
  reviewScheduledAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
})

quizRecordSchema.index({ userId: 1, createdAt: -1 })
quizRecordSchema.index({ userId: 1, wordId: 1 })
quizRecordSchema.index({ userId: 1, chapter: 1 })
quizRecordSchema.index({ userId: 1, wordbookId: 1, sourceMode: 1, createdAt: -1 })
quizRecordSchema.index({ userId: 1, wordbookId: 1, errorType: 1, createdAt: -1 })
quizRecordSchema.index({ sessionId: 1, sourceMode: 1 })

export default mongoose.model('QuizRecord', quizRecordSchema)
