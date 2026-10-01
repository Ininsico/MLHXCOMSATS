const { Schema, model } = require('mongoose')

const staffSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '' },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    role: {
      type: String,
      enum: ['doctor', 'radiologist', 'nurse', 'receptionist', 'lab', 'admin'],
      required: true,
      index: true,
    },
    specialty: { type: String, trim: true, maxlength: 80, default: '' },
    department: { type: String, trim: true, maxlength: 80, default: '' },
    status: {
      type: String,
      enum: ['active', 'leave', 'inactive'],
      default: 'active',
      index: true,
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

staffSchema.index({ hospital: 1, email: 1 }, { unique: true, sparse: true })

staffSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Staff', staffSchema)
