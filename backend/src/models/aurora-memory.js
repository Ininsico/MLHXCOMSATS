const { Schema, model } = require('mongoose')

/**
 * One remembered line about a patient. Every therapy/AI-doctor turn can leave a
 * memory behind; these are what the agent reads back before it answers, and what
 * the patient can see and delete.
 */
const auroraMemorySchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    persona: { type: String, trim: true, maxlength: 40, default: 'therapy', index: true },
    text: { type: String, required: true, trim: true, maxlength: 300 },
    kind: { type: String, enum: ['session', 'fact', 'mood'], default: 'fact' },
    source: { type: Schema.Types.ObjectId, ref: 'AuroraChat', default: null },
    embedded: { type: Boolean, default: false },
    embeddedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

auroraMemorySchema.index({ patient: 1, persona: 1, createdAt: -1 })

auroraMemorySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('AuroraMemory', auroraMemorySchema)
