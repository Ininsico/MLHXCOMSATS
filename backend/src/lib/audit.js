/**
 * Audit trail helper.
 *
 * `record()` never throws: an audit write failing must not undo the action the
 * user asked for — but it is logged loudly so it gets noticed.
 */

const AuditEvent = require('../models/audit-event')

async function record(req, { action, subjectType = '', subjectId = '', summary = '', meta = null, hospital = null }) {
  try {
    return await AuditEvent.create({
      actor: req?.userId ?? null,
      actorName: req?.user?.name ?? '',
      actorRole: req?.user?.role ?? '',
      hospital: hospital ?? req?.hospital?._id ?? null,
      action,
      subjectType,
      subjectId: subjectId ? String(subjectId) : '',
      summary: summary.slice(0, 240),
      meta,
    })
  } catch (error) {
    console.error(`Audit write failed (${action}):`, error.message)
    return null
  }
}

async function list({ hospital = null, actor = null, action = null, limit = 100 } = {}) {
  const filter = {}

  if (hospital) filter.hospital = hospital
  if (actor) filter.actor = actor
  if (action) filter.action = action

  return AuditEvent.find(filter).sort({ createdAt: -1 }).limit(Math.min(500, Math.max(1, limit)))
}

module.exports = { record, list }
