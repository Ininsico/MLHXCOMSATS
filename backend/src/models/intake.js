const { Schema, model } = require('mongoose')

/**
 * Emergency intake. The triage level is not typed by hand — it is seeded from the
 * clinical graph (urgencyFor) and can be overridden by the nurse who sees them.
 */
const intakeSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    age: { type: Number, min: 0, max: 130, default: null },
    complaint: { type: String, trim: true, maxlength: 500, required: true },
    concepts: { type: [String], default: [] },
    triageLevel: { type: Number, min: 1, max: 5, default: 3, index: true },
    suggestedLevel: { type: Number, min: 1, max: 5, default: 3 },
    overridden: { type: Boolean, default: false },
    vitals: { type: Schema.Types.Mixed, default: null },
    seenBy: { type: String, trim: true, maxlength: 80, default: '' },
    outcome: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: ['waiting', 'in_treatment', 'admitted', 'discharged'], default: 'waiting', index: true },
    arrivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
)

intakeSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Intake', intakeSchema)
