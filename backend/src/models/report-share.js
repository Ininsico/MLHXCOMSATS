const { Schema, model } = require('mongoose')

/**
 * A signed, expiring link to a lab report. The token itself is stateless; this
 * record exists so the patient can see and revoke what they have shared.
 */
const reportShareSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'LabOrder', required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null },
    reportNumber: { type: String, trim: true, maxlength: 40, default: '' },
    token: { type: String, required: true, trim: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    views: { type: Number, min: 0, default: 0 },
    lastViewedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

reportShareSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('ReportShare', reportShareSchema)
