const { Schema, model } = require('mongoose')

/** Home readings the patient logs: blood pressure, weight, glucose, temperature. */
const vitalsEntrySchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['blood_pressure', 'weight', 'glucose', 'temperature', 'phq9', 'gad7'],
      required: true,
      index: true,
    },
    value: { type: Number, required: true },
    secondary: { type: Number, default: null },
    unit: { type: String, trim: true, maxlength: 12, default: '' },
    at: { type: Date, default: Date.now, index: true },
    note: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true },
)

vitalsEntrySchema.index({ patient: 1, type: 1, at: -1 })

vitalsEntrySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('VitalsEntry', vitalsEntrySchema)
