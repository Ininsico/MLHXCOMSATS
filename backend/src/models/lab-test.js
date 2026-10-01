const { Schema, model } = require('mongoose')

const parameterSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    unit: { type: String, trim: true, maxlength: 20, default: '' },
    referenceLow: { type: Number, default: null },
    referenceHigh: { type: Number, default: null },
  },
  { _id: false },
)

const labTestSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, trim: true, maxlength: 60, default: 'General' },
    sampleType: { type: String, trim: true, maxlength: 40, default: 'Blood' },
    price: { type: Number, min: 0, default: 0 },
    turnaroundHours: { type: Number, min: 1, max: 720, default: 24 },
    parameters: { type: [parameterSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

labTestSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('LabTest', labTestSchema)
