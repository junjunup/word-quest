import mongoose from 'mongoose'
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  wordbookId: { type: String, required: true },
  dateKey: { type: String, required: true },
  items: { type: [mongoose.Schema.Types.Mixed], default: [] },
  feedbackWordIds: { type: [String], default: [] },
  status: { type: String, enum: ['active', 'completed', 'ended'], default: 'active' }
}, { timestamps: true })
schema.index({ userId: 1, wordbookId: 1, dateKey: 1 }, { unique: true })
export default mongoose.model('DailyLearningSession', schema)
