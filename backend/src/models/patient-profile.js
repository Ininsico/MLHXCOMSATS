const { Schema, model } = require('mongoose')

/**
 * The patient's own medical card: allergies, what they take, long-term conditions.
 * Optional by design — and the source for prescription safety checks.
 */
const allergySchema = new Schema(
  {
    substance: { type: String, trim: true, maxlength: 80, required: true },
    reaction: { type: String, trim: true, maxlength: 120, default: '' },
    severity: { type: String, enum: ['mild', 'moderate', 'severe'], default: 'moderate' },
  },
  { _id: false },
)

const patientProfileSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    bloodGroup: { type: String, trim: true, maxlength: 8, default: '' },
    allergies: { type: [allergySchema], default: [] },
    medications: { type: [String], default: [] },
    conditions: { type: [String], default: [] },
    emergencyContact: {
      name: { type: String, trim: true, maxlength: 80, default: '' },
      phone: { type: String, trim: true, maxlength: 30, default: '' },
    },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true },
)

patientProfileSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('PatientProfile', patientProfileSchema)
