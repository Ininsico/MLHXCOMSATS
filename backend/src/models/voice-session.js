const { Schema, model } = require('mongoose')

const turnSchema = new Schema(
  {
    role: { type: String, enum: ['patient', 'agent'], required: true },
    text: { type: String, trim: true, maxlength: 1000, default: '' },
    intent: { type: Schema.Types.Mixed, default: null },
    options: { type: [Schema.Types.Mixed], default: [] },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

const voiceSessionSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null },
    state: {
      type: String,
      enum: ['start', 'offered', 'confirming', 'booked', 'ended'],
      default: 'start',
      index: true,
    },
    transcript: { type: String, trim: true, maxlength: 4000, default: '' },
    turns: { type: [turnSchema], default: [] },
    options: { type: [Schema.Types.Mixed], default: [] },
    chosen: { type: Schema.Types.Mixed, default: null },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
    outcome: { type: String, trim: true, maxlength: 120, default: '' },
    source: { type: String, enum: ['voice', 'text'], default: 'voice' },
  },
  { timestamps: true },
)

voiceSessionSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('VoiceSession', voiceSessionSchema)
