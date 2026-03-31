import mongoose from 'mongoose'

const learningLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventType: {
    type: String,
    enum: ['login', 'quiz', 'chat', 'level_complete', 'achievement', 'daily_reward'],
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

export default mongoose.model('LearningLog', learningLogSchema)
