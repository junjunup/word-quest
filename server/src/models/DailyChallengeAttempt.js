import mongoose from 'mongoose'

const dailyChallengeAnswerSchema = new mongoose.Schema({
  wordId: { type: mongoose.Schema.Types.ObjectId, required: true },
  expected: { type: String, required: true },
  answer: { type: String, default: '' },
  correct: { type: Boolean, default: false },
  score: { type: Number, default: 0 }
}, { _id: false })

const dailyChallengeAttemptSchema = new mongoose.Schema({
  challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyChallenge', required: true, index: true },
  date: { type: String, required: true, index: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  wordbookId: { type: String, default: 'cet4', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  answers: [dailyChallengeAnswerSchema],
  score: { type: Number, default: 0, min: 0 },
  correctCount: { type: Number, default: 0, min: 0 },
  questionCount: { type: Number, default: 0, min: 0 },
  durationMs: { type: Number, default: 0, min: 0 },
  streak: { type: Number, default: 1, min: 1 },
  rewardExp: { type: Number, default: 0, min: 0 },
  rewardTitle: { type: String, default: '' },
  blindBoxOpened: { type: Boolean, default: false },
  blindBoxReward: { type: mongoose.Schema.Types.Mixed, default: null },
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true })

dailyChallengeAttemptSchema.index({ challengeId: 1, userId: 1 }, { unique: true })
dailyChallengeAttemptSchema.index({ date: 1, score: -1, durationMs: 1 })
dailyChallengeAttemptSchema.index({ userId: 1, date: -1 })

export default mongoose.model('DailyChallengeAttempt', dailyChallengeAttemptSchema)
