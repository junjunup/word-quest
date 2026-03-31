import mongoose from 'mongoose'

const quizRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  wordId: { type: mongoose.Schema.Types.Mixed, ref: 'VocabularyBank', required: true },
  word: { type: String, required: true },
  questionType: {
    type: String,
    enum: ['choice_en2cn', 'choice_cn2en', 'spell_hint', 'spell_full', 'fill_blank', 'translate'],
    required: true
  },
  isCorrect: { type: Boolean, required: true },
  responseTime: { type: Number, required: true, min: 0 },    // 毫秒
  difficulty: { type: Number, default: 1, min: 1, max: 5 },
  hintUsed: { type: Boolean, default: false },
  npcInteraction: { type: Boolean, default: false },
  sessionId: { type: String, required: true },
  chapter: { type: Number, required: true },
  level: { type: Number, required: true },
  playerAnswer: { type: String, default: '' },
  correctAnswer: { type: String, default: '' }
}, {
  timestamps: true
})

quizRecordSchema.index({ userId: 1, createdAt: -1 })
quizRecordSchema.index({ userId: 1, wordId: 1 })
quizRecordSchema.index({ userId: 1, chapter: 1 })

export default mongoose.model('QuizRecord', quizRecordSchema)
