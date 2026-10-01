const { Schema, model } = require('mongoose')

/**
 * A payment request for a booking.
 *
 * The patient is told exactly what to send (coin, amount, and the Binance ID to send
 * it to). We then watch INCOMING deposits only — withdrawal history is never read —
 * and match on coin, amount and arrival time after the request was created. A tiny
 * per-intent amount offset keeps two open requests from colliding.
 */
const paymentIntentSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null, index: true },

    provider: { type: String, enum: ['binance'], default: 'binance' },
    /** What the money is for: a visit, or the hospital's platform subscription. */
    purpose: { type: String, enum: ['appointment', 'subscription'], default: 'appointment', index: true },
    subscriptionRequest: { type: Schema.Types.ObjectId, ref: 'SubscriptionRequest', default: null, index: true },
    payToId: { type: String, trim: true, maxlength: 40, default: '' },
    payToEmail: { type: String, trim: true, maxlength: 120, default: '' },
    payToLabel: { type: String, trim: true, maxlength: 80, default: '' },
    coin: { type: String, trim: true, uppercase: true, maxlength: 10, default: 'USDT' },
    network: { type: String, trim: true, maxlength: 20, default: '' },
    baseAmount: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    /** What the price was quoted in, and the rate used to reach the crypto figure. */
    pricePkr: { type: Number, min: 0, default: null },
    fxRate: { type: Number, min: 0, default: null },
    fxTo: { type: String, trim: true, maxlength: 10, default: 'USDT' },
    reference: { type: String, trim: true, maxlength: 40, required: true, index: true },

    status: {
      type: String,
      enum: ['awaiting', 'detected', 'verified', 'expired', 'cancelled'],
      default: 'awaiting',
      index: true,
    },
    detectedTxId: { type: String, trim: true, maxlength: 80, default: '' },
    detectedAmount: { type: Number, default: null },
    detectedAt: { type: Date, default: null },
    /** Anything received above the requested amount — a success, recorded as surplus. */
    overpaid: { type: Number, min: 0, default: 0 },
    /** How receipt was proven: deposit history, Binance Pay history, or balance delta. */
    evidence: {
      type: String,
      enum: ['', 'deposit-history', 'pay-history', 'balance-delta', 'simulated'],
      default: '',
    },
    /** Total holdings of this coin when the request was opened — the receipt baseline. */
    baseline: { type: Number, default: null },
    verifiedAt: { type: Date, default: null },
    notified: { type: Boolean, default: false },
    notificationChannel: { type: String, trim: true, maxlength: 40, default: '' },
    simulated: { type: Boolean, default: false },
    attempts: { type: Number, min: 0, default: 0 },
    lastCheckedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
)

paymentIntentSchema.index({ patient: 1, status: 1, createdAt: -1 })
paymentIntentSchema.index({ status: 1, createdAt: 1 })

paymentIntentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('PaymentIntent', paymentIntentSchema)
