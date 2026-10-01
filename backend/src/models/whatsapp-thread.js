const { Schema, model } = require('mongoose')

const messageSchema = new Schema(
  {
    role: { type: String, enum: ['patient', 'aurora'], required: true },
    text: { type: String, trim: true, maxlength: 4000, default: '' },
    memory: { type: String, trim: true, maxlength: 300, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

/**
 * A WhatsApp conversation with Aurora that is not tied to an account: anyone who
 * messages the hospital's number talks to the general assistant, and Aurora keeps
 * the thread (and what it learned) keyed by phone number.
 */
const bookingSchema = new Schema(
  {
    specialty: { type: String, trim: true, maxlength: 40, default: '' },
    options: { type: [Schema.Types.Mixed], default: [] },
    chosen: { type: Schema.Types.Mixed, default: null },
    state: { type: String, enum: ['choose_hospital', 'offered', 'confirming'], default: 'offered' },
  },
  { _id: false },
)

const whatsappThreadSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true, maxlength: 80, default: '' },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null },
    messages: { type: [messageSchema], default: [] },
    memories: { type: [String], default: [] },
    booking: { type: bookingSchema, default: null },
    crisis: { type: Boolean, default: false },
    model: { type: String, trim: true, maxlength: 80, default: '' },
    totalTokens: { type: Number, min: 0, default: 0 },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
)

whatsappThreadSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('WhatsappThread', whatsappThreadSchema)
