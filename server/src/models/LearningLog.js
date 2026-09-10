import mongoose from 'mongoose'

const learningLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quizRecordId: mongoose.Schema.Types.ObjectId,
  eventType: {
    type: String,
    enum: ['login', 'quiz', 'review', 'chat', 'level_complete', 'achievement', 'daily_reward', 'reminder_settings'],
    required: true
  },
  eventData: { type: mongoose.Schema.Types.Mixed, default: {} },
  sessionId: { type: String, default: '' },
  sessionDuration: { type: Number, default: 0 } // 秒
}, {
  timestamps: true
})

learningLogSchema.index({ userId: 1, createdAt: -1 })
learningLogSchema.index({ eventType: 1, createdAt: -1 })

learningLogSchema.index({ quizRecordId: 1 }, { unique: true, partialFilterExpression: { quizRecordId: { $type: 'objectId' } } })

export default mongoose.model('LearningLog', learningLogSchema)
