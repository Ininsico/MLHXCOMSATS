const { Schema, model } = require('mongoose')

const inferenceLogSchema = new Schema(
  {
    doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorName: { type: String, trim: true, maxlength: 80, default: '' },
    department: { type: String, trim: true, maxlength: 80, default: '' },
    kind: { type: String, enum: ['image', 'chat'], default: 'image', index: true },
    patient: { type: String, trim: true, maxlength: 120, default: '' },
    imageHash: { type: String, trim: true, maxlength: 64, default: '', index: true },
    question: { type: String, trim: true, maxlength: 500, default: '' },
    responseJson: { type: Schema.Types.Mixed, default: null },
    severity: { type: String, enum: ['low', 'moderate', 'high', 'none'], default: 'none' },
    modelVersion: { type: String, trim: true, maxlength: 120, default: '' },
    latencyMs: { type: Number, min: 0, default: 0 },
    cached: { type: Boolean, default: false },
  },
  { timestamps: true },
)

inferenceLogSchema.index({ doctor: 1, createdAt: -1 })

inferenceLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('AiInferenceLog', inferenceLogSchema)
