const { Schema, model } = require('mongoose')

/** A consult note. AI drafts it; a clinician edits and approves before it is final. */
const clinicalNoteSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Staff', default: null, index: true },
    doctorName: { type: String, trim: true, maxlength: 80, default: '' },
    patientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    subjective: { type: String, trim: true, maxlength: 2000, default: '' },
    objective: { type: String, trim: true, maxlength: 2000, default: '' },
    assessment: { type: String, trim: true, maxlength: 2000, default: '' },
    plan: { type: String, trim: true, maxlength: 2000, default: '' },
    source: { type: String, enum: ['ai', 'manual'], default: 'manual' },
    draft: { type: Boolean, default: true },
    approvedBy: { type: String, trim: true, maxlength: 80, default: '' },
    approvedAt: { type: Date, default: null },
    model: { type: String, trim: true, maxlength: 80, default: '' },
    tokens: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
)

clinicalNoteSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('ClinicalNote', clinicalNoteSchema)
