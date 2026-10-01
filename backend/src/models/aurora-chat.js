const { Schema, model } = require('mongoose')

const messageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'aurora'], required: true },
    text: { type: String, trim: true, maxlength: 4000, default: '' },
    memory: { type: String, trim: true, maxlength: 300, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

const auroraChatSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    persona: { type: String, required: true, trim: true, maxlength: 40, index: true },
    title: { type: String, trim: true, maxlength: 120, default: '' },
    messages: { type: [messageSchema], default: [] },
    crisis: { type: Boolean, default: false },
    model: { type: String, trim: true, maxlength: 80, default: '' },
    totalTokens: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
)

auroraChatSchema.index({ patient: 1, persona: 1, updatedAt: -1 })

auroraChatSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('AuroraChat', auroraChatSchema)
