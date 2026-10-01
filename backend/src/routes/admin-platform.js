/**
 * Aurora platform admin: AI usage metering, the audit trail, per-hospital feature
 * flags, the RAG corpus manager, and patient data export / erasure.
 */

const express = require('express')
const mongoose = require('mongoose')
const Admission = require('../models/admission')
const AiInferenceLog = require('../models/ai-inference-log')
const Appointment = require('../models/appointment')
const AuroraChat = require('../models/aurora-chat')
const AuroraMemory = require('../models/aurora-memory')
const Hospital = require('../models/hospital')
const LabOrder = require('../models/lab-order')
const NurseTurn = require('../models/nurse-turn')
const PatientProfile = require('../models/patient-profile')
const Prescription = require('../models/prescription')
const Review = require('../models/review')
const Staff = require('../models/staff')
const User = require('../models/user')
const VitalsEntry = require('../models/vitals-entry')
const VoiceSession = require('../models/voice-session')
const WhatsappThread = require('../models/whatsapp-thread')
const HttpError = require('../lib/http-error')
const audit = require('../lib/audit')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

router.use(requireAuth, requireRole('admin'))

// ---------------------------------------------------------------- AI usage

/** Every agent already records tokens — this is the roll-up. */
router.get('/usage', async (req, res) => {
  const [inferences, nurseTurns, auroraChats, voiceSessions, threads, staff] = await Promise.all([
    AiInferenceLog.find({}).limit(5000),
    NurseTurn.find({}).limit(5000),
    AuroraChat.find({}).limit(5000),
    VoiceSession.find({}).limit(5000),
    WhatsappThread.find({}).limit(5000),
    Staff.find({}).select('_id hospital'),
  ])

  const hospitalOfStaff = new Map(staff.map((member) => [String(member._id), member.hospital]))

  const perHospital = new Map()
  const bump = (hospitalId, kind, tokens, turns) => {
    if (!hospitalId) return
    const key = String(hospitalId)
    const entry = perHospital.get(key) ?? { hospital: key, tokens: 0, turns: 0, byKind: {} }
    entry.tokens += tokens
    entry.turns += turns
    entry.byKind[kind] = (entry.byKind[kind] ?? 0) + tokens
    perHospital.set(key, entry)
  }

  for (const log of inferences) {
    bump(hospitalOfStaff.get(String(log.doctor)), 'clinical', 0, 1)
  }

  for (const turn of nurseTurns) bump(null, 'nurse', turn.totalTokens ?? 0, 1)

  for (const chat of auroraChats) bump(null, 'aurora', chat.totalTokens ?? 0, 1)

  for (const session of voiceSessions) {
    bump(session.hospital, 'voice', 0, session.turns?.length ?? 0)
  }

  for (const thread of threads) bump(thread.hospital, 'whatsapp', thread.totalTokens ?? 0, thread.messages?.length ?? 0)

  const hospitals = await Hospital.find({ _id: { $in: [...perHospital.keys()] } }).select('name city')

  const rows = hospitals.map((hospital) => ({
    hospital: hospital.id,
    name: hospital.name,
    city: hospital.city,
    ...(perHospital.get(String(hospital._id)) ?? { tokens: 0, turns: 0, byKind: {} }),
  }))

  const unassigned = ['nurse', 'aurora', 'clinical']
    .map((kind) => ({
      kind,
      tokens:
        (kind === 'nurse' ? nurseTurns.reduce((sum, turn) => sum + (turn.totalTokens ?? 0), 0) : 0) +
        (kind === 'aurora' ? auroraChats.reduce((sum, chat) => sum + (chat.totalTokens ?? 0), 0) : 0),
    }))
    .filter((entry) => entry.tokens > 0)

  res.json({
    data: {
      totals: {
        clinicalInferences: inferences.length,
        nurseTurns: nurseTurns.length,
        auroraTurns: auroraChats.length,
        voiceSessions: voiceSessions.length,
        whatsappThreads: threads.length,
        tokens:
          nurseTurns.reduce((sum, turn) => sum + (turn.totalTokens ?? 0), 0) +
          auroraChats.reduce((sum, chat) => sum + (chat.totalTokens ?? 0), 0) +
          threads.reduce((sum, thread) => sum + (thread.totalTokens ?? 0), 0),
      },
      perHospital: rows.sort((a, b) => b.tokens - a.tokens),
      platformWide: unassigned,
    },
  })
})

// ---------------------------------------------------------------- audit trail

router.get('/audit', async (req, res) => {
  const filter = {}

  if (mongoose.isValidObjectId(req.query.hospitalId)) filter.hospital = req.query.hospitalId
  if (typeof req.query.action === 'string' && req.query.action) filter.action = req.query.action

  const events = await audit.list({ ...filter, limit: Number(req.query.limit) || 150 })

  res.json({ data: events, meta: { count: events.length } })
})

// ---------------------------------------------------------------- feature flags

/**
 * Flags live outside the Hospital schema on purpose (it is a Mixed bag by design),
 * so they can be added per hospital without a migration.
 */
router.patch('/hospitals/:hospitalId/flags', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.hospitalId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  const flags = req.body?.features

  if (!flags || typeof flags !== 'object') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send a features object.')
  }

  const allowed = ['ai', 'voice', 'whatsapp', 'therapy', 'nurse', 'marketplace', 'lab']
  const clean = {}

  for (const key of allowed) {
    if (typeof flags[key] === 'boolean') clean[key] = flags[key]
  }

  await Hospital.collection.updateOne({ _id: new mongoose.Types.ObjectId(req.params.hospitalId) }, { $set: { features: clean } })

  await audit.record(req, {
    action: 'hospital.flags_updated',
    subjectType: 'Hospital',
    subjectId: req.params.hospitalId,
    hospital: req.params.hospitalId,
    summary: `Features: ${Object.entries(clean).map(([key, value]) => `${key}=${value}`).join(', ')}`,
  })

  res.json({ data: { features: clean } })
})

// ---------------------------------------------------------------- corpus manager

function sidecarBase() {
  const base = process.env.AI_SERVICE_URL
  if (!base) throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'The local AI service is not configured.')
  return base.replace(/\/+$/, '')
}

router.get('/corpus/stats', async (req, res) => {
  const response = await fetch(`${sidecarBase()}/rag/stats`, { signal: AbortSignal.timeout(8000) })
  const payload = await response.json().catch(() => null)

  res.json({ data: payload ?? {} })
})

router.post('/corpus/document', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''

  if (title.length < 3 || text.length < 40) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'A guideline needs a title and at least 40 characters.', [
      { field: 'text', message: 'At least 40 characters.' },
    ])
  }

  const response = await fetch(`${sidecarBase()}/rag/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, text, source: typeof req.body?.source === 'string' ? req.body.source : 'admin upload' }),
    signal: AbortSignal.timeout(30000),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'The corpus could not be updated.')
  }

  await audit.record(req, {
    action: 'corpus.document_added',
    subjectType: 'Corpus',
    subjectId: title,
    summary: `Added "${title}" to the clinical corpus`,
  })

  res.status(201).json({ data: payload?.data ?? {} })
})

router.post('/corpus/reindex', async (req, res) => {
  const response = await fetch(`${sidecarBase()}/rag/reindex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(120000),
  })

  const payload = await response.json().catch(() => null)

  await audit.record(req, {
    action: 'corpus.reindexed',
    subjectType: 'Corpus',
    summary: 'Corpus reindexed',
  })

  res.json({ data: payload?.data ?? {} })
})

// ---------------------------------------------------------------- export / erasure

router.get('/patients/:patientId/export', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.patientId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Patient not found.')
  }

  const id = req.params.patientId

  const [user, profile, appointments, labs, chats, memories, vitals, reviews, prescriptions, admissions] =
    await Promise.all([
      User.findById(id).select('name email role createdAt'),
      PatientProfile.findOne({ patient: id }),
      Appointment.find({ patientUser: id }),
      LabOrder.find({ patientUser: id }),
      AuroraChat.find({ patient: id }),
      AuroraMemory.find({ patient: id }),
      VitalsEntry.find({ patient: id }),
      Review.find({ patient: id }),
      Prescription.find({ patientUser: id }),
      Admission.find({ patientUser: id }),
    ])

  await audit.record(req, {
    action: 'patient.exported',
    subjectType: 'User',
    subjectId: id,
    summary: `Exported the record of ${user?.name ?? id}`,
  })

  res.json({
    data: {
      exportedAt: new Date(),
      user,
      profile,
      counts: {
        appointments: appointments.length,
        labOrders: labs.length,
        aiConversations: chats.length,
        memories: memories.length,
        vitals: vitals.length,
        reviews: reviews.length,
        prescriptions: prescriptions.length,
        admissions: admissions.length,
      },
      appointments,
      labOrders: labs,
      vitals,
      reviews,
      prescriptions,
      admissions,
      ai: { chats, memories },
    },
  })
})

router.post('/patients/:patientId/erasure', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.patientId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Patient not found.')
  }

  const id = req.params.patientId
  const user = await User.findById(id).select('name email')

  if (!user) throw new HttpError(404, 'NOT_FOUND', 'Patient not found.')

  const [chats, memories, profile, vitals] = await Promise.all([
    AuroraChat.deleteMany({ patient: id }),
    AuroraMemory.deleteMany({ patient: id }),
    PatientProfile.deleteMany({ patient: id }),
    VitalsEntry.deleteMany({ patient: id }),
  ])

  // Clinical records are not destroyed silently: they keep the visit, lose the identity.
  const [appointments, labs] = await Promise.all([
    Appointment.updateMany(
      { patientUser: id },
      { $set: { patientUser: null, patientName: 'Removed at patient request', reason: '' } },
    ),
    LabOrder.updateMany(
      { patientUser: id },
      { $set: { patientUser: null, patientName: 'Removed at patient request', resultSummary: '' } },
    ),
  ])

  await User.deleteOne({ _id: id })

  await audit.record(req, {
    action: 'patient.erased',
    subjectType: 'User',
    subjectId: id,
    summary: `Erasure completed for a patient (${chats.deletedCount} conversations, ${memories.deletedCount} memories, ${appointments.modifiedCount} appointments anonymised, ${labs.modifiedCount} reports anonymised, ${profile.deletedCount} profile, ${vitals.deletedCount} readings removed)`,
  })

  res.json({
    data: {
      erased: true,
      removed: {
        aiConversations: chats.deletedCount,
        memories: memories.deletedCount,
        profile: profile.deletedCount,
        vitals: vitals.deletedCount,
      },
      anonymised: { appointments: appointments.modifiedCount, labOrders: labs.modifiedCount },
      auditKept: true,
    },
  })
})

// ---------------------------------------------------------------- subscriptions

const SubscriptionRequest = require('../models/subscription-request')

const PLAN_PRICES = { starter: 0, growth: 4900, enterprise: 14900 }

/** Admin view: what hospitals have asked for, and whether the money is verified. */
router.get('/subscription-requests', async (req, res) => {
  const filter = {}
  if (['pending', 'approved', 'rejected', 'cancelled'].includes(req.query.status)) {
    filter.status = req.query.status
  }

  const requests = await SubscriptionRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('hospital', 'name city subscription')

  res.json({
    data: requests,
    meta: {
      count: requests.length,
      pending: await SubscriptionRequest.countDocuments({ status: 'pending' }),
      awaitingPayment: await SubscriptionRequest.countDocuments({ status: 'pending', 'payment.verified': false }),
      verifiedValue: (
        await SubscriptionRequest.find({ status: 'approved', 'payment.verified': true })
      ).reduce((sum, request) => sum + (request.amount || 0), 0),
    },
  })
})

/**
 * The decision. Approval requires the payment to be verified first — a plan is
 * never switched on an unverified reference — and verifying activates it.
 */
router.patch('/subscription-requests/:requestId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.requestId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Request not found.')
  }

  const request = await SubscriptionRequest.findById(req.params.requestId)

  if (!request) throw new HttpError(404, 'NOT_FOUND', 'Request not found.')

  const action = req.body?.action

  if (action === 'verify-payment') {
    request.payment.verified = true
    request.payment.verifiedBy = req.user.name
    request.payment.verifiedAt = new Date()
    request.payment.verificationNote = typeof req.body?.note === 'string' ? req.body.note.slice(0, 200) : ''

    await request.save()

    await audit.record(req, {
      action: 'subscription.payment_verified',
      subjectType: 'SubscriptionRequest',
      subjectId: request._id,
      hospital: request.hospital,
      summary: `Verified ${request.amount} ${request.currency} for ${request.requestedPlan}`,
    })

    return res.json({ data: request })
  }

  if (action === 'reject') {
    request.status = 'rejected'
    request.decidedBy = req.user.name
    request.decidedAt = new Date()
    request.decisionNote = typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : ''

    await request.save()

    await audit.record(req, {
      action: 'subscription.rejected',
      subjectType: 'SubscriptionRequest',
      subjectId: request._id,
      hospital: request.hospital,
      summary: `Rejected ${request.requestedPlan} request`,
    })

    return res.json({ data: request })
  }

  if (action === 'approve') {
    if (!request.payment.verified) {
      throw new HttpError(
        409,
        'CONFLICT',
        'Verify the payment before approving — the plan is not switched on an unverified reference.',
      )
    }

    request.status = 'approved'
    request.decidedBy = req.user.name
    request.decidedAt = new Date()
    request.activatedAt = new Date()
    request.decisionNote = typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : ''
    await request.save()

    const hospital = await Hospital.findById(request.hospital)

    if (hospital) {
      // Subscription and theme live outside the Hospital schema, so this goes through
      // the collection directly — otherwise strict mode drops the write silently.
      await Hospital.collection.updateOne(
        { _id: hospital._id },
        {
          $set: {
            subscription: {
              ...(hospital.subscription ?? {}),
              plan: request.requestedPlan,
              planPrice: PLAN_PRICES[request.requestedPlan] ?? request.amount,
              billingCycle: request.billingCycle,
              renewsAt: new Date(Date.now() + (request.billingCycle === 'yearly' ? 365 : 30) * 86400000),
              activatedAt: new Date(),
            },
            ...(request.requestedTheme ? { theme: request.requestedTheme } : {}),
          },
        },
      )
    }

    await audit.record(req, {
      action: 'subscription.approved',
      subjectType: 'SubscriptionRequest',
      subjectId: request._id,
      hospital: request.hospital,
      summary: `Activated ${request.requestedPlan} (${request.billingCycle}) for ${hospital?.name ?? 'hospital'}`,
    })

    return res.json({ data: request, hospital: hospital ? { id: hospital.id, plan: hospital.subscription?.plan, theme: hospital.theme } : null })
  }

  throw new HttpError(400, 'VALIDATION_ERROR', 'Send action: verify-payment, approve or reject.')
})

// ---------------------------------------------------------------- quotas

const { checkQuota, setQuota, usageFor } = require('../lib/quota')

router.get('/hospitals/:hospitalId/quota', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.hospitalId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  const [quota, usage] = await Promise.all([
    checkQuota(req.params.hospitalId),
    usageFor(new mongoose.Types.ObjectId(req.params.hospitalId)),
  ])

  res.json({ data: { ...quota, usage } })
})

router.patch('/hospitals/:hospitalId/quota', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.hospitalId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  const tokenQuota = Number(req.body?.tokenQuota)

  if (!Number.isFinite(tokenQuota) || tokenQuota < 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send a token allowance (0 or more).')
  }

  await setQuota(new mongoose.Types.ObjectId(req.params.hospitalId), tokenQuota)

  await audit.record(req, {
    action: 'hospital.quota_updated',
    subjectType: 'Hospital',
    subjectId: req.params.hospitalId,
    hospital: req.params.hospitalId,
    summary: `Monthly AI allowance set to ${tokenQuota} tokens`,
  })

  res.json({ data: await checkQuota(req.params.hospitalId) })
})

module.exports = router
