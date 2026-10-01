const { Schema, model } = require('mongoose')

const itemSchema = new Schema(
  {
    drug: { type: String, required: true, trim: true, maxlength: 80 },
    dose: { type: String, trim: true, maxlength: 60, default: '' },
    frequency: { type: String, trim: true, maxlength: 60, default: '' },
    durationDays: { type: Number, min: 0, default: null },
    notes: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: false },
)

const warningSchema = new Schema(
  {
    severity: { type: String, enum: ['info', 'caution', 'serious'], default: 'caution' },
    kind: { type: String, enum: ['interaction', 'allergy', 'contraindication'], default: 'interaction' },
    message: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: false },
)

const prescriptionSchema = new Schema(
  {
    patientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Staff', default: null, index: true },
    doctorName: { type: String, trim: true, maxlength: 80, default: '' },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
    items: { type: [itemSchema], default: [] },
    warnings: { type: [warningSchema], default: [] },
    acknowledged: { type: Boolean, default: false },
    status: { type: String, enum: ['issued', 'dispensed', 'cancelled'], default: 'issued', index: true },
    dispensedBy: { type: String, trim: true, maxlength: 80, default: '' },
    dispensedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

prescriptionSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Prescription', prescriptionSchema)
