const { Schema, model } = require('mongoose')

const appointmentSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    patientName: { type: String, required: true, trim: true, maxlength: 80 },
    patientPhone: { type: String, trim: true, maxlength: 30, default: '' },
    doctor: { type: Schema.Types.ObjectId, ref: 'Staff', default: null },
    doctorName: { type: String, trim: true, maxlength: 80, default: '' },
    specialty: { type: String, trim: true, maxlength: 80, default: '' },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    reason: { type: String, trim: true, maxlength: 300, default: '' },
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'arrived', 'completed', 'cancelled'],
      default: 'requested',
      index: true,
    },
    source: { type: String, enum: ['patient', 'ai', 'hospital'], default: 'patient' },
    aiNote: { type: String, trim: true, maxlength: 300, default: '' },
    consult: {
      mode: { type: String, enum: ['in_person', 'video', 'phone'], default: 'in_person' },
      roomUrl: { type: String, trim: true, maxlength: 400, default: '' },
      joinFrom: { type: Date, default: null },
      joinTo: { type: Date, default: null },
      startedAt: { type: Date, default: null },
      endedAt: { type: Date, default: null },
      notes: { type: String, trim: true, maxlength: 300, default: '' },
    },
  },
  { timestamps: true },
)

appointmentSchema.index({ hospital: 1, doctor: 1, date: 1, time: 1 })

appointmentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Appointment', appointmentSchema)
