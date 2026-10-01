const { Schema, model } = require('mongoose')

const lineSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: ['consultation', 'laboratory', 'pharmacy', 'procedure', 'other'], default: 'other' },
    ref: { type: String, trim: true, maxlength: 60, default: '' },
  },
  { _id: false },
)

/** A bill for a patient, optionally covered by an insurer. */
const invoiceSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
    number: { type: String, trim: true, maxlength: 40, index: true },
    lines: { type: [lineSchema], default: [] },
    total: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, maxlength: 6, default: 'PKR' },
    status: { type: String, enum: ['draft', 'issued', 'paid', 'void'], default: 'draft', index: true },
    issuedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    payer: { type: String, enum: ['self', 'insurer'], default: 'self' },
    claim: {
      insurer: { type: String, trim: true, maxlength: 80, default: '' },
      policyNumber: { type: String, trim: true, maxlength: 60, default: '' },
      status: { type: String, enum: ['none', 'submitted', 'approved', 'rejected'], default: 'none' },
      submittedAt: { type: Date, default: null },
      note: { type: String, trim: true, maxlength: 200, default: '' },
    },
  },
  { timestamps: true },
)

invoiceSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Invoice', invoiceSchema)
