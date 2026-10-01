const { Schema, model } = require('mongoose')

const aiFeedbackSchema = new Schema(
  {
    inference: { type: Schema.Types.ObjectId, ref: 'AiInferenceLog', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    decision: { type: String, enum: ['confirmed', 'overridden'], required: true },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true },
)

aiFeedbackSchema.index({ inference: 1, doctor: 1 }, { unique: true })

aiFeedbackSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('AiFeedback', aiFeedbackSchema)
