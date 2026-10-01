const { Schema, model } = require('mongoose')

const resultSchema = new Schema(
  {
    parameter: { type: String, required: true, trim: true, maxlength: 60 },
    value: { type: String, trim: true, maxlength: 40, default: '' },
    unit: { type: String, trim: true, maxlength: 20, default: '' },
    referenceLow: { type: Number, default: null },
    referenceHigh: { type: Number, default: null },
    flag: { type: String, enum: ['low', 'normal', 'high', 'unknown'], default: 'unknown' },
  },
  { _id: false },
)

const parameterSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    unit: { type: String, trim: true, maxlength: 20, default: '' },
    referenceLow: { type: Number, default: null },
    referenceHigh: { type: Number, default: null },
  },
  { _id: false },
)

function shortId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

const labOrderSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    test: { type: Schema.Types.ObjectId, ref: 'LabTest', required: true },
    testName: { type: String, required: true, trim: true, maxlength: 120 },
    parameters: { type: [parameterSchema], default: [] },
    patientName: { type: String, required: true, trim: true, maxlength: 80 },
    patientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    requestedByStaff: { type: Schema.Types.ObjectId, ref: 'Staff', default: null, index: true },
    priority: { type: String, enum: ['routine', 'urgent'], default: 'routine' },
    status: {
      type: String,
      enum: ['requested', 'collected', 'processing', 'completed', 'sent', 'cancelled'],
      default: 'requested',
      index: true,
    },
    results: { type: [resultSchema], default: [] },
    resultSummary: { type: String, trim: true, maxlength: 600, default: '' },
    interpretation: { type: String, trim: true, maxlength: 600, default: '' },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
    orderedBy: { type: String, trim: true, maxlength: 80, default: '' },
    reportNumber: { type: String, default: () => `LAB-${shortId()}`, index: true },
    collectedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    sentBy: { type: String, trim: true, maxlength: 80, default: '' },
  },
  { timestamps: true },
)

labOrderSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('LabOrder', labOrderSchema)
