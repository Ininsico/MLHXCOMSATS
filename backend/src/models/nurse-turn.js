const { Schema, model } = require('mongoose')

const nurseTurnSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: 'NurseSession', required: true, index: true },
    phone: { type: String, trim: true, maxlength: 30, default: '', index: true },
    step: { type: String, trim: true, maxlength: 30, default: '' },
    transcript: { type: String, trim: true, maxlength: 2000, default: '' },
    output: { type: Schema.Types.Mixed, default: null },
    model: { type: String, trim: true, maxlength: 80, default: '' },
    promptTokens: { type: Number, min: 0, default: 0 },
    completionTokens: { type: Number, min: 0, default: 0 },
    totalTokens: { type: Number, min: 0, default: 0 },
    escalated: { type: Boolean, default: false },
    latencyMs: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
)

nurseTurnSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('NurseTurn', nurseTurnSchema)
