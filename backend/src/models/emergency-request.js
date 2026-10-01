const { Schema, model } = require('mongoose')

const pointSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String, enum: ['patient', 'ambulance', 'hospital'], default: 'patient' },
  },
  { _id: false },
)

/**
 * One emergency. `sos` is a patient calling for help; `ambulance` is a request for
 * transport (raised by the patient or a relative). Both follow the same dispatch
 * ladder, and both carry a location trail so the family can watch it live.
 */
const emergencyRequestSchema = new Schema(
  {
    kind: { type: String, enum: ['sos', 'ambulance'], default: 'sos', index: true },
    patientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    patientPhone: { type: String, trim: true, maxlength: 30, default: '' },
    raisedBy: { type: String, enum: ['patient', 'relative', 'staff'], default: 'patient' },
    relativeName: { type: String, trim: true, maxlength: 80, default: '' },
    relativePhone: { type: String, trim: true, maxlength: 30, default: '' },

    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    ambulance: { type: Schema.Types.ObjectId, ref: 'Ambulance', default: null, index: true },
    ambulanceCallSign: { type: String, trim: true, maxlength: 40, default: '' },

    reason: { type: String, trim: true, maxlength: 300, default: '' },
    concepts: { type: [String], default: [] },
    severity: { type: String, enum: ['low', 'moderate', 'high', 'critical'], default: 'high', index: true },

    pickup: {
      label: { type: String, trim: true, maxlength: 200, default: '' },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    trail: { type: [pointSchema], default: [] },

    status: {
      type: String,
      enum: [
        'raised',
        'acknowledged',
        'dispatched',
        'en_route',
        'on_scene',
        'transporting',
        'arrived',
        'completed',
        'cancelled',
      ],
      default: 'raised',
      index: true,
    },
    etaMinutes: { type: Number, min: 0, default: null },
    acknowledgedBy: { type: String, trim: true, maxlength: 80, default: '' },
    dispatchedBy: { type: String, trim: true, maxlength: 80, default: '' },
    completedBy: { type: String, trim: true, maxlength: 80, default: '' },
    outcome: { type: String, trim: true, maxlength: 300, default: '' },
    timeline: {
      type: [
        {
          status: { type: String, trim: true, maxlength: 30 },
          at: { type: Date, default: Date.now },
          by: { type: String, trim: true, maxlength: 80, default: '' },
          note: { type: String, trim: true, maxlength: 200, default: '' },
        },
      ],
      default: [],
    },
    hospitalNotified: { type: Boolean, default: false },
    relativesNotified: { type: [String], default: [] },
  },
  { timestamps: true },
)

emergencyRequestSchema.index({ hospital: 1, status: 1, createdAt: -1 })
emergencyRequestSchema.index({ patientUser: 1, status: 1, createdAt: -1 })

emergencyRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('EmergencyRequest', emergencyRequestSchema)
