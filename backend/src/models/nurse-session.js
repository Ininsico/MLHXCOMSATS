const { Schema, model } = require('mongoose')

const messageSchema = new Schema(
  {
    role: { type: String, enum: ['patient', 'nurse'], required: true },
    text: { type: String, trim: true, maxlength: 1200, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

const escalationSchema = new Schema(
  {
    reason: { type: String, trim: true, maxlength: 300, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

const nurseSessionSchema = new Schema(
  {
    phone: { type: String, required: true, trim: true, index: true },
    patientName: { type: String, required: true, trim: true, maxlength: 80 },
    patientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    program: { type: String, trim: true, maxlength: 120, default: 'Post-discharge follow-up' },
    step: {
      type: String,
      enum: ['greeting', 'med_check', 'adherence', 'symptom_check', 'appointment', 'closing'],
      default: 'greeting',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'escalated', 'completed', 'ended'],
      default: 'active',
      index: true,
    },
    history: { type: [messageSchema], default: [] },
    escalations: { type: [escalationSchema], default: [] },
    symptoms: { type: [String], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

nurseSessionSchema.index({ hospital: 1, status: 1, lastMessageAt: -1 })

nurseSessionSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('NurseSession', nurseSessionSchema)
