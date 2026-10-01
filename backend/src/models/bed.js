const { Schema, model } = require('mongoose')

const bedSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    ward: { type: String, trim: true, maxlength: 60, required: true, index: true },
    label: { type: String, trim: true, maxlength: 20, required: true },
    kind: { type: String, enum: ['general', 'hdu', 'icu', 'isolation', 'maternity'], default: 'general' },
    status: { type: String, enum: ['free', 'occupied', 'cleaning', 'closed'], default: 'free', index: true },
  },
  { timestamps: true },
)

bedSchema.index({ hospital: 1, ward: 1, label: 1 }, { unique: true })

bedSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Bed', bedSchema)
