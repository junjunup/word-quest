import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3 },
  password: { type: String, required: true, minlength: 6 },
  nickname: { type: String, required: true, trim: true },
  avatar: { type: String, default: 'default_avatar' },
  level: { type: Number, default: 1 },
  totalExp: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  dailyRewardDate: { type: String, default: '' }, // YYYY-MM-DD格式，记录上次领取日期
  loginStreak: { type: Number, default: 0 },
  lastLoginAt: { type: Date, default: Date.now }
}, {
  timestamps: true
})

// 密码加密
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

// 验证密码
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

// 计算等级（每100经验升一级）
userSchema.methods.getLevelFromExp = function () {
  return Math.floor(this.totalExp / 100) + 1
}

export default mongoose.model('User', userSchema)
