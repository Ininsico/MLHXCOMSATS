const { Schema, model } = require('mongoose')

/** A vaccination record, with a code that a third party can verify. */
const vaccinationSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    vaccine: { type: String, required: true, trim: true, maxlength: 80 },
    doseNumber: { type: Number, min: 1, max: 10, default: 1 },
    administeredAt: { type: Date, default: Date.now, index: true },
    administeredBy: { type: String, trim: true, maxlength: 80, default: '' },
    batchNumber: { type: String, trim: true, maxlength: 40, default: '' },
    site: { type: String, trim: true, maxlength: 40, default: '' },
    verificationCode: { type: String, trim: true, maxlength: 24, index: true },
    recordedBy: { type: String, trim: true, maxlength: 80, default: '' },
    notes: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true },
)

vaccinationSchema.index({ patient: 1, administeredAt: -1 })

vaccinationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Vaccination', vaccinationSchema)
