const { Schema, model } = require('mongoose')

/** A long-term condition the patient and their care team are actively managing. */
const carePlanSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Staff', default: null },
    condition: { type: String, required: true, trim: true, maxlength: 80 },
    goal: { type: String, trim: true, maxlength: 300, default: '' },
    targets: {
      type: [
        {
          label: { type: String, trim: true, maxlength: 60 },
          vitalType: {
            type: String,
            enum: ['blood_pressure', 'weight', 'glucose', 'temperature', 'phq9', 'gad7'],
            default: 'blood_pressure',
          },
          min: { type: Number, default: null },
          max: { type: Number, default: null },
          unit: { type: String, trim: true, maxlength: 16, default: '' },
        },
      ],
      default: [],
    },
    checkInFrequencyDays: { type: Number, min: 1, max: 90, default: 14 },
    channel: { type: String, enum: ['whatsapp', 'email', 'none'], default: 'whatsapp' },
    nextCheckInAt: { type: Date, default: null, index: true },
    lastCheckInAt: { type: Date, default: null },
    checkInsSent: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active', index: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    createdBy: { type: String, trim: true, maxlength: 80, default: '' },
  },
  { timestamps: true },
)

carePlanSchema.index({ patient: 1, status: 1, createdAt: -1 })
carePlanSchema.index({ status: 1, nextCheckInAt: 1 })

carePlanSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('CarePlan', carePlanSchema)
