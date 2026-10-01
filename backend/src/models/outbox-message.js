const { Schema, model } = require('mongoose')

/**
 * Outbound WhatsApp queue.
 *
 * The API never holds the WhatsApp session — the bridge owns it. So anything the
 * server wants to say to a patient (medication reminders, "your report is ready",
 * red-flag acknowledgements) is queued here and the bridge pulls it.
 */
const outboxMessageSchema = new Schema(
  {
    phone: { type: String, required: true, trim: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    kind: {
      type: String,
      enum: ['reminder', 'notice', 'escalation', 'reply'],
      default: 'notice',
      index: true,
    },
    patientName: { type: String, trim: true, maxlength: 80, default: '' },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
    attempts: { type: Number, min: 0, default: 0 },
    sentAt: { type: Date, default: null },
    error: { type: String, trim: true, maxlength: 200, default: '' },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
)

outboxMessageSchema.index({ status: 1, createdAt: 1 })

outboxMessageSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('OutboxMessage', outboxMessageSchema)
