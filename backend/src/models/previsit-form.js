const { Schema, model } = require('mongoose')

/**
 * What the patient tells the doctor before the visit. This is read by the AI note
 * draft, so the consultation starts from the patient's own words rather than a blank
 * page.
 */
const previsitFormSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null },
    symptoms: { type: String, trim: true, maxlength: 800, default: '' },
    duration: { type: String, trim: true, maxlength: 80, default: '' },
    painScale: { type: Number, min: 0, max: 10, default: null },
    currentMedications: { type: String, trim: true, maxlength: 400, default: '' },
    allergies: { type: String, trim: true, maxlength: 300, default: '' },
    questions: { type: String, trim: true, maxlength: 400, default: '' },
    anythingElse: { type: String, trim: true, maxlength: 400, default: '' },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

previsitFormSchema.index({ appointment: 1 }, { unique: true })

previsitFormSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('PrevisitForm', previsitFormSchema)
