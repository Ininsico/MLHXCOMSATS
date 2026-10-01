const { Schema, model } = require('mongoose')

/**
 * A hospital asking the platform for a plan change — upgrade, downgrade, renewal —
 * with the payment reference attached. The admin verifies the money actually moved
 * before the subscription is switched, so nothing self-serves into a paid plan.
 */
const subscriptionRequestSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    requestedByName: { type: String, trim: true, maxlength: 80, default: '' },

    currentPlan: { type: String, trim: true, maxlength: 40, default: '' },
    requestedPlan: { type: String, trim: true, maxlength: 40, required: true },
    requestedTheme: { type: String, trim: true, maxlength: 40, default: '' },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    amount: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, maxlength: 6, default: 'PKR' },

    note: { type: String, trim: true, maxlength: 400, default: '' },
    payment: {
      method: { type: String, enum: ['bank_transfer', 'card', 'cash', 'cheque', 'online'], default: 'bank_transfer' },
      reference: { type: String, trim: true, maxlength: 80, default: '' },
      paidAt: { type: Date, default: null },
      proofUrl: { type: String, trim: true, maxlength: 400, default: '' },
      verified: { type: Boolean, default: false },
      verifiedBy: { type: String, trim: true, maxlength: 80, default: '' },
      verifiedAt: { type: Date, default: null },
      verificationNote: { type: String, trim: true, maxlength: 200, default: '' },
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    decidedBy: { type: String, trim: true, maxlength: 80, default: '' },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 300, default: '' },
    activatedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

subscriptionRequestSchema.index({ hospital: 1, status: 1, createdAt: -1 })

subscriptionRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('SubscriptionRequest', subscriptionRequestSchema)
