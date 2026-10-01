const { Schema, model } = require('mongoose')

/** An inpatient stay: who is in which bed, why, and for how long. */
const admissionSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    patientName: { type: String, trim: true, maxlength: 80, required: true },
    bed: { type: Schema.Types.ObjectId, ref: 'Bed', default: null, index: true },
    ward: { type: String, trim: true, maxlength: 60, default: '' },
    reason: { type: String, trim: true, maxlength: 300, default: '' },
    admittedBy: { type: String, trim: true, maxlength: 80, default: '' },
    admittedAt: { type: Date, default: Date.now, index: true },
    dischargedAt: { type: Date, default: null },
    outcome: { type: String, trim: true, maxlength: 200, default: '' },
    status: { type: String, enum: ['admitted', 'discharged'], default: 'admitted', index: true },
  },
  { timestamps: true },
)

admissionSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Admission', admissionSchema)
