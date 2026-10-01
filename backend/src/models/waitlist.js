const { Schema, model } = require('mongoose')

/** Someone waiting for an opening; a freed slot is offered down the list. */
const waitlistSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    patientPhone: { type: String, trim: true, maxlength: 30, default: '' },
    specialty: { type: String, trim: true, maxlength: 80, default: '' },
    doctor: { type: Schema.Types.ObjectId, ref: 'Staff', default: null },
    from: { type: String, trim: true, maxlength: 10, default: '' },
    to: { type: String, trim: true, maxlength: 10, default: '' },
    reason: { type: String, trim: true, maxlength: 300, default: '' },
    status: {
      type: String,
      enum: ['waiting', 'offered', 'accepted', 'expired', 'cancelled'],
      default: 'waiting',
      index: true,
    },
    offer: {
      date: { type: String, trim: true, maxlength: 10, default: '' },
      time: { type: String, trim: true, maxlength: 5, default: '' },
      doctorName: { type: String, trim: true, maxlength: 80, default: '' },
      offeredAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null, index: true },
      notified: { type: Boolean, default: false },
    },
    acceptedAppointment: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
  },
  { timestamps: true },
)

waitlistSchema.index({ hospital: 1, status: 1, createdAt: 1 })

waitlistSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('WaitlistEntry', waitlistSchema)
