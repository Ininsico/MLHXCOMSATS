const { Schema, model } = require('mongoose')

/**
 * Guardian access: an adult account acting on behalf of a child or a dependent adult.
 * Access is explicit, revocable, and every action taken under it is audited.
 */
const dependentSchema = new Schema(
  {
    guardian: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    relation: {
      type: String,
      enum: ['child', 'parent', 'spouse', 'sibling', 'other'],
      default: 'other',
    },
    dateOfBirth: { type: String, trim: true, maxlength: 10, default: '' },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    canActFor: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active', index: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

dependentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Dependent', dependentSchema)
