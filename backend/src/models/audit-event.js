const { Schema, model } = require('mongoose')

/**
 * One line per consequential action: who did it, to what, and when.
 * Everything sensitive (approvals, verification, prescriptions, admissions, money)
 * writes here so the hospital and platform consoles can show a real trail.
 */
const auditEventSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorName: { type: String, trim: true, maxlength: 80, default: '' },
    actorRole: { type: String, trim: true, maxlength: 20, default: '' },
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    action: { type: String, required: true, trim: true, maxlength: 60, index: true },
    subjectType: { type: String, trim: true, maxlength: 40, default: '' },
    subjectId: { type: String, trim: true, maxlength: 60, default: '' },
    summary: { type: String, trim: true, maxlength: 240, default: '' },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
)

auditEventSchema.index({ hospital: 1, createdAt: -1 })
auditEventSchema.index({ actorRole: 1, action: 1, createdAt: -1 })

auditEventSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('AuditEvent', auditEventSchema)
