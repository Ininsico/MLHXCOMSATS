const { Schema, model } = require('mongoose')

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ['patient', 'hospital', 'doctor', 'admin'],
      default: 'patient',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended'],
      default: 'active',
      required: true,
      index: true,
    },
    emailVerifiedAt: { type: Date, default: null },
    passwordHash: { type: String, select: false, default: null },
  },
  { timestamps: true },
)

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash
    delete ret.__v
    return ret
  },
})

module.exports = model('User', userSchema)
