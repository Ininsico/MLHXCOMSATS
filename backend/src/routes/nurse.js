const express = require('express')
const Hospital = require('../models/hospital')
const NurseSession = require('../models/nurse-session')
const NurseTurn = require('../models/nurse-turn')
const HttpError = require('../lib/http-error')
const { handleIncoming } = require('../lib/nurse')
const jobs = require('../lib/queue')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

/** Hospital accounts only see their own follow-ups plus anything unassigned. */
async function scopedFilter(req) {
  if (req.user.role !== 'hospital') return {}

  const hospital = await Hospital.findOne({ owner: req.user.id }).select('_id')

  return hospital
    ? { $or: [{ hospital: hospital._id }, { hospital: null }] }
    : { hospital: null }
}

function requireBridgeToken(req) {
  const expected = process.env.NURSE_WEBHOOK_TOKEN

  if (!expected) {
    throw new HttpError(
      503,
      'SERVICE_UNAVAILABLE',
      'Set NURSE_WEBHOOK_TOKEN in backend/.env before using the WhatsApp bridge.',
    )
  }

  if (req.headers['x-nurse-token'] !== expected) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid bridge token.')
  }

  return true
}

/**
 * Message ingress for the WhatsApp bridge. Not session-authenticated: the bridge
 * runs on the hospital machine and proves itself with NURSE_WEBHOOK_TOKEN.
 */
router.post('/webhook', async (req, res) => {
  requireBridgeToken(req)

  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : ''
  const text = typeof req.body?.text === 'string' ? req.body.text : ''

  if (!phone || !text.trim()) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send a phone number and a message.', [
      { field: 'text', message: 'Message text is required.' },
    ])
  }

  const result = await handleIncoming({
    phone,
    text,
    patientName: typeof req.body?.patientName === 'string' ? req.body.patientName : undefined,
    hospital: req.body?.hospitalId ?? null,
    hospitalName: typeof req.body?.hospitalName === 'string' ? req.body.hospitalName : undefined,
    source: 'whatsapp',
  })

  res.json({ data: result })
})

/** Demo path: run the same dialogue without a linked WhatsApp account. */
router.post('/simulate', requireAuth, requireRole('hospital', 'admin'), async (req, res) => {
  const phone = typeof req.body?.phone === 'string' && req.body.phone.trim()
    ? req.body.phone.trim()
    : 'demo-patient'
  const text = typeof req.body?.text === 'string' ? req.body.text : ''

  if (!text.trim()) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send the patient message.')
  }

  const result = await handleIncoming({
    phone,
    text,
    patientName: typeof req.body?.patientName === 'string' ? req.body.patientName : 'John',
    hospital: req.body?.hospitalId ?? null,
    hospitalName: typeof req.body?.hospitalName === 'string' ? req.body.hospitalName : 'Aurora',
    source: 'simulator',
  })

  res.json({ data: result })
})

router.get('/sessions', requireAuth, requireRole('hospital', 'admin'), async (req, res) => {
  const filter = await scopedFilter(req)

  const sessions = await NurseSession.find(filter)
    .sort({ lastMessageAt: -1 })
    .limit(50)

  res.json({ data: sessions, meta: { count: sessions.length } })
})

/** Red-flag feed for the hospital dashboard. */
router.get('/alerts', requireAuth, requireRole('hospital', 'admin'), async (req, res) => {
  const scoped = await scopedFilter(req)
  const filter = { status: 'escalated', ...scoped }

  const [alerts, queue] = await Promise.all([
    NurseSession.find(filter).sort({ lastMessageAt: -1 }).limit(25),
    jobs.status(),
  ])

  const turns = await NurseTurn.find({ session: { $in: alerts.map((alert) => alert._id) } })
    .sort({ createdAt: -1 })
    .limit(50)

  res.json({
    data: { alerts, turns, queue },
    meta: { count: alerts.length },
  })
})

module.exports = router
