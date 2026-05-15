import mongoose from 'mongoose'

const friendshipSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'blocked'], default: 'pending', index: true },
  requestedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date, default: null },
  lastInteractionAt: { type: Date, default: Date.now }
}, { timestamps: true })

friendshipSchema.index({ users: 1, status: 1 })
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true })

friendshipSchema.pre('validate', function (next) {
  const ids = [this.requester, this.recipient]
    .filter(Boolean)
    .map(id => id.toString())
    .sort()
  this.users = ids
  next()
})

export default mongoose.model('Friendship', friendshipSchema)
