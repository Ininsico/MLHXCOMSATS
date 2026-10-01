const { Schema, model } = require('mongoose')

/** A hospital's own ambulance: who drives it, where it is, whether it is free. */
const ambulanceSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    callSign: { type: String, trim: true, maxlength: 40, required: true },
    vehicleNumber: { type: String, trim: true, maxlength: 40, default: '' },
    kind: {
      type: String,
      enum: ['basic', 'advanced', 'neonatal', 'patient_transport'],
      default: 'basic',
    },
    crew: { type: [String], default: [] },
    driverName: { type: String, trim: true, maxlength: 80, default: '' },
    driverPhone: { type: String, trim: true, maxlength: 30, default: '' },
    status: {
      type: String,
      enum: ['available', 'dispatched', 'on_scene', 'returning', 'maintenance', 'offline'],
      default: 'available',
      index: true,
    },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

ambulanceSchema.index({ hospital: 1, callSign: 1 }, { unique: true })

ambulanceSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Ambulance', ambulanceSchema)
