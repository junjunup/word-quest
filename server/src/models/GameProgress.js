import mongoose from 'mongoose'

const gameProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // 关卡完成记录 - 按 "chapter-level" 做key
  levels: {
    type: Map,
    of: {
      stars: { type: Number, default: 0, min: 0, max: 3 },
      score: { type: Number, default: 0 },
      completed: { type: Boolean, default: false },
      completedAt: { type: Date }
    },
    default: new Map()
  },
  unlockedChapters: { type: [Number], default: [1] },
  currentChapter: { type: Number, default: 1 },
  currentLevel: { type: Number, default: 1 },
  achievements: [{
    id: String,
    name: String,
    description: String,
    unlockedAt: { type: Date, default: Date.now }
  }],
  totalStars: { type: Number, default: 0 }
}, {
  timestamps: true
})

// 每个用户只有一条进度记录
gameProgressSchema.index({ userId: 1 }, { unique: true })

export default mongoose.model('GameProgress', gameProgressSchema)
