const { Schema, model } = require('mongoose')

/** A patient's rating of a completed visit. Feeds hospital.rating and analytics. */
const reviewSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Staff', default: null, index: true },
    doctorName: { type: String, trim: true, maxlength: 80, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 600, default: '' },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
)

reviewSchema.index({ appointment: 1, patient: 1 }, { unique: true })
reviewSchema.index({ hospital: 1, createdAt: -1 })

reviewSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Review', reviewSchema)
