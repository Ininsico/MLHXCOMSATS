const { Schema, model } = require('mongoose')

/** One doctor handing a patient to another specialty. */
const referralSchema = new Schema(
  {
    patientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    fromDoctor: { type: Schema.Types.ObjectId, ref: 'Staff', default: null, index: true },
    fromDoctorName: { type: String, trim: true, maxlength: 80, default: '' },
    toSpecialty: { type: String, trim: true, maxlength: 80, required: true, index: true },
    toDoctor: { type: Schema.Types.ObjectId, ref: 'Staff', default: null, index: true },
    reason: { type: String, trim: true, maxlength: 600, default: '' },
    urgency: { type: String, enum: ['routine', 'soon', 'urgent'], default: 'routine' },
    status: { type: String, enum: ['open', 'accepted', 'declined', 'closed'], default: 'open', index: true },
    acceptedBy: { type: String, trim: true, maxlength: 80, default: '' },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

referralSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Referral', referralSchema)
