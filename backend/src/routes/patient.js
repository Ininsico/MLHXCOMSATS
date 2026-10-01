/**
 * Patient self-service: everything a signed-in patient can do to their own record.
 *
 * Public share links are registered BEFORE the auth guard — opening a shared report
 * is the one thing that must work without a session.
 */

const express = require('express')
const mongoose = require('mongoose')
const Appointment = require('../models/appointment')
const CarePlan = require('../models/care-plan')
const Dependent = require('../models/dependent')
const Hospital = require('../models/hospital')
const LabOrder = require('../models/lab-order')
const PatientProfile = require('../models/patient-profile')
const ReportShare = require('../models/report-share')
const Review = require('../models/review')
const Vaccination = require('../models/vaccination')
const VitalsEntry = require('../models/vitals-entry')
const WaitlistEntry = require('../models/waitlist')
const PrevisitForm = require('../models/previsit-form')
const OutboxMessage = require('../models/outbox-message')
const HttpError = require('../lib/http-error')
const audit = require('../lib/audit')
const shareToken = require('../lib/share-token')
const { TIMES, localDate } = require('../lib/slots')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

const VITALS_TYPES = ['blood_pressure', 'weight', 'glucose', 'temperature', 'phq9', 'gad7']

function todayISO() {
  return localDate(new Date())
}

// ------------------------------------------------------------------ public reads

/** Verify a vaccination record by its code — no session, the code is the credential. */
router.get('/public/vaccinations/:code', async (req, res) => {
  const vaccination = await Vaccination.findOne({ verificationCode: req.params.code })
    .populate('hospital', 'name city')

  if (!vaccination) {
    throw new HttpError(404, 'NOT_FOUND', 'No vaccination record matches that code.')
  }

  res.json({
    data: {
      verified: true,
      patientName: vaccination.patientName,
      vaccine: vaccination.vaccine,
      doseNumber: vaccination.doseNumber,
      administeredAt: vaccination.administeredAt,
      administeredBy: vaccination.administeredBy,
      hospital: vaccination.hospital,
      code: vaccination.verificationCode,
    },
  })
})

/** Open a shared report. No session — the signed token is the credential. */
router.get('/shared/:token', async (req, res) => {
  const check = shareToken.verify(req.params.token)

  if (!check.ok) {
    throw new HttpError(
      check.reason === 'expired' ? 410 : 403,
      check.reason === 'expired' ? 'GONE' : 'FORBIDDEN',
      check.reason === 'expired'
        ? 'That share link has expired. Ask the patient for a new one.'
        : 'That share link is not valid.',
    )
  }

  const share = await ReportShare.findOne({ token: req.params.token })

  if (!share || share.revokedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'That share link has been revoked.')
  }

  const order = await LabOrder.findById(share.order)

  if (!order) {
    throw new HttpError(404, 'NOT_FOUND', 'That report no longer exists.')
  }

  share.views += 1
  share.lastViewedAt = new Date()
  await share.save()

  res.json({
    data: {
      reportNumber: order.reportNumber,
      testName: order.testName,
      patientName: order.patientName,
      status: order.status,
      results: order.results,
      resultSummary: order.resultSummary,
      interpretation: order.interpretation,
      completedAt: order.completedAt,
      sentAt: order.sentAt,
      expiresAt: share.expiresAt,
      views: share.views,
    },
  })
})

// ------------------------------------------------------------------- everything else

router.use(requireAuth, requireRole('patient', 'admin'))

/**
 * Acting on behalf of a dependent: the guardian sends `x-acting-for: <dependentId>`
 * and the request is served against that dependent's record. Ownership is checked
 * here, on every request — a header is never trusted on its own.
 */
async function actingPatientId(req) {
  const raw = req.headers['x-acting-for']

  if (!raw) return req.user.id

  const dependent = await Dependent.findOne({
    _id: mongoose.isValidObjectId(raw) ? raw : null,
    guardian: req.user.id,
    status: 'active',
    canActFor: true,
  })

  if (!dependent) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not have access to that dependent’s record.')
  }

  return dependent.patient ?? req.user.id
}

async function ownAppointment(req) {
  const appointment = await Appointment.findOne({
    _id: mongoose.isValidObjectId(req.params.appointmentId) ? req.params.appointmentId : null,
    patientUser: req.user.id,
  })

  if (!appointment) {
    throw new HttpError(404, 'NOT_FOUND', 'That appointment is not on your record.')
  }

  return appointment
}

// ---- medical card ---------------------------------------------------------

router.get('/me/profile', async (req, res) => {
  const profile = await PatientProfile.findOne({ patient: req.user.id })

  res.json({
    data: profile ?? {
      bloodGroup: '',
      allergies: [],
      medications: [],
      conditions: [],
      emergencyContact: { name: '', phone: '' },
      notes: '',
    },
  })
})

router.put('/me/profile', async (req, res) => {
  const allergies = Array.isArray(req.body?.allergies)
    ? req.body.allergies
        .filter((entry) => typeof entry?.substance === 'string' && entry.substance.trim())
        .slice(0, 20)
        .map((entry) => ({
          substance: entry.substance.trim().slice(0, 80),
          reaction: typeof entry.reaction === 'string' ? entry.reaction.trim().slice(0, 120) : '',
          severity: ['mild', 'moderate', 'severe'].includes(entry.severity) ? entry.severity : 'moderate',
        }))
    : []

  const list = (value, max) =>
    Array.isArray(value)
      ? value.filter((item) => typeof item === 'string' && item.trim()).slice(0, max).map((item) => item.trim().slice(0, 80))
      : []

  const profile = await PatientProfile.findOneAndUpdate(
    { patient: req.user.id },
    {
      bloodGroup: typeof req.body?.bloodGroup === 'string' ? req.body.bloodGroup.trim().slice(0, 8) : '',
      allergies,
      medications: list(req.body?.medications, 30),
      conditions: list(req.body?.conditions, 30),
      emergencyContact: {
        name: typeof req.body?.emergencyContact?.name === 'string' ? req.body.emergencyContact.name.trim().slice(0, 80) : '',
        phone: typeof req.body?.emergencyContact?.phone === 'string' ? req.body.emergencyContact.phone.trim().slice(0, 30) : '',
      },
      notes: typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 500) : '',
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  await audit.record(req, {
    action: 'patient.profile_updated',
    subjectType: 'PatientProfile',
    subjectId: profile._id,
    summary: `Medical card updated (${allergies.length} allergies, ${profile.medications.length} medications)`,
  })

  res.json({ data: profile })
})

// ---- vitals ---------------------------------------------------------------

router.get('/me/vitals', async (req, res) => {
  const patientId = await actingPatientId(req)
  const filter = { patient: patientId }

  if (typeof req.query.type === 'string' && VITALS_TYPES.includes(req.query.type)) {
    filter.type = req.query.type
  }

  const entries = await VitalsEntry.find(filter).sort({ at: -1 }).limit(120)

  res.json({ data: entries, meta: { count: entries.length } })
})

router.post('/me/vitals', async (req, res) => {
  const patientId = await actingPatientId(req)
  const type = VITALS_TYPES.includes(req.body?.type) ? req.body.type : null
  const value = Number(req.body?.value)

  if (!type || !Number.isFinite(value)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a reading type and enter a number.', [
      { field: 'value', message: 'A number is required.' },
    ])
  }

  const entry = await VitalsEntry.create({
    patient: patientId,
    type,
    value,
    secondary: Number.isFinite(Number(req.body?.secondary)) ? Number(req.body.secondary) : null,
    unit: typeof req.body?.unit === 'string' ? req.body.unit.trim().slice(0, 12) : '',
    at: req.body?.at ? new Date(req.body.at) : new Date(),
    note: typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 200) : '',
  })

  res.status(201).json({ data: entry })
})

router.delete('/me/vitals/:entryId', async (req, res) => {
  const deleted = await VitalsEntry.findOneAndDelete({
    _id: mongoose.isValidObjectId(req.params.entryId) ? req.params.entryId : null,
    patient: req.user.id,
  })

  if (!deleted) {
    throw new HttpError(404, 'NOT_FOUND', 'That reading is not on your record.')
  }

  res.json({ data: { deleted: true } })
})

// ---- appointments ---------------------------------------------------------

router.patch('/me/appointments/:appointmentId/reschedule', async (req, res) => {
  const appointment = await ownAppointment(req)

  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    throw new HttpError(409, 'CONFLICT', 'That appointment can no longer be moved.')
  }

  const date = typeof req.body?.date === 'string' ? req.body.date : ''
  const time = typeof req.body?.time === 'string' ? req.body.time : ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !TIMES.includes(time)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Pick a date and one of the offered times.', [
      { field: 'time', message: 'Use a half-hour slot between 09:00 and 17:00.' },
    ])
  }

  if (date < todayISO()) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Pick a date in the future.')
  }

  const clash = await Appointment.exists({
    _id: { $ne: appointment._id },
    hospital: appointment.hospital,
    doctor: appointment.doctor,
    date,
    time,
    status: { $ne: 'cancelled' },
  })

  if (clash) {
    throw new HttpError(409, 'CONFLICT', 'That slot was just taken — pick another time.')
  }

  const previous = `${appointment.date} ${appointment.time}`
  appointment.date = date
  appointment.time = time
  await appointment.save()

  await audit.record(req, {
    action: 'appointment.rescheduled',
    subjectType: 'Appointment',
    subjectId: appointment._id,
    hospital: appointment.hospital,
    summary: `Moved from ${previous} to ${date} ${time}`,
  })

  res.json({ data: appointment })
})

router.post('/me/appointments/:appointmentId/check-in', async (req, res) => {
  const appointment = await ownAppointment(req)

  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    throw new HttpError(409, 'CONFLICT', 'That appointment is closed.')
  }

  if (appointment.date !== todayISO()) {
    throw new HttpError(409, 'CONFLICT', 'Check-in opens on the day of the visit.')
  }

  const [hours, minutes] = appointment.time.split(':').map(Number)
  const slot = new Date(`${appointment.date}T00:00:00`)
  slot.setHours(hours, minutes, 0, 0)

  const earlyBy = slot.getTime() - Date.now()

  if (earlyBy > 2 * 60 * 60 * 1000) {
    throw new HttpError(409, 'CONFLICT', 'Check-in opens two hours before your slot.')
  }

  if (!['requested', 'confirmed', 'arrived'].includes(appointment.status)) {
    throw new HttpError(409, 'CONFLICT', 'That appointment cannot be checked in.')
  }

  appointment.status = 'arrived'
  await appointment.save()

  await audit.record(req, {
    action: 'appointment.checked_in',
    subjectType: 'Appointment',
    subjectId: appointment._id,
    hospital: appointment.hospital,
    summary: `Patient checked in for ${appointment.date} ${appointment.time}`,
  })

  res.json({ data: appointment })
})

// ---- reviews --------------------------------------------------------------

router.post('/me/appointments/:appointmentId/review', async (req, res) => {
  const appointment = await ownAppointment(req)
  const rating = Number(req.body?.rating)
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 600) : ''

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Give a rating from 1 to 5.', [
      { field: 'rating', message: '1 to 5.' },
    ])
  }

  if (appointment.date > todayISO()) {
    throw new HttpError(409, 'CONFLICT', 'You can review a visit once it has happened.')
  }

  const existing = await Review.findOne({ appointment: appointment._id, patient: req.user.id })

  if (existing) {
    throw new HttpError(409, 'CONFLICT', 'You have already reviewed this visit.')
  }

  const review = await Review.create({
    appointment: appointment._id,
    patient: req.user.id,
    patientName: appointment.patientName,
    hospital: appointment.hospital,
    doctor: appointment.doctor,
    doctorName: appointment.doctorName,
    rating,
    comment,
  })

  const [stats] = await Review.aggregate([
    { $match: { hospital: appointment.hospital, hidden: false } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ])

  await Hospital.updateOne(
    { _id: appointment.hospital },
    {
      $set: {
        rating: stats ? Math.round(stats.average * 10) / 10 : rating,
        reviewCount: stats?.count ?? 1,
      },
    },
  )

  await audit.record(req, {
    action: 'review.created',
    subjectType: 'Review',
    subjectId: review._id,
    hospital: appointment.hospital,
    summary: `Rated ${rating}/5 for ${appointment.doctorName || 'the visit'}`,
  })

  res.status(201).json({ data: review })
})

// ---- lab report sharing ----------------------------------------------------

router.post('/me/lab-orders/:orderId/share', async (req, res) => {
  const order = await LabOrder.findOne({
    _id: mongoose.isValidObjectId(req.params.orderId) ? req.params.orderId : null,
    patientUser: req.user.id,
  })

  if (!order) {
    throw new HttpError(404, 'NOT_FOUND', 'That report is not on your record.')
  }

  if (!['completed', 'sent'].includes(order.status)) {
    throw new HttpError(409, 'CONFLICT', 'The report is not ready to share yet.')
  }

  const ttlHours = Math.min(168, Math.max(1, Number(req.body?.ttlHours) || shareToken.DEFAULT_TTL_HOURS))
  const { token, expiresAt } = shareToken.sign({ id: order.id, ttlHours })

  const share = await ReportShare.create({
    order: order._id,
    patient: req.user.id,
    hospital: order.hospital,
    reportNumber: order.reportNumber,
    token,
    expiresAt,
  })

  const base = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')

  await audit.record(req, {
    action: 'report.shared',
    subjectType: 'LabOrder',
    subjectId: order._id,
    hospital: order.hospital,
    summary: `Shared ${order.reportNumber} for ${ttlHours}h`,
  })

  res.status(201).json({
    data: {
      shareId: share.id,
      url: `${base}/r/${token}`,
      expiresAt,
    },
  })
})

router.get('/me/shares', async (req, res) => {
  const shares = await ReportShare.find({ patient: req.user.id }).sort({ createdAt: -1 }).limit(30)

  res.json({
    data: shares.map((share) => ({
      id: share.id,
      reportNumber: share.reportNumber,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
      views: share.views,
      url: `${(process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')}/r/${share.token}`,
    })),
    meta: { count: shares.length },
  })
})

router.delete('/me/shares/:shareId', async (req, res) => {
  const share = await ReportShare.findOneAndUpdate(
    {
      _id: mongoose.isValidObjectId(req.params.shareId) ? req.params.shareId : null,
      patient: req.user.id,
    },
    { revokedAt: new Date() },
    { new: true },
  )

  if (!share) {
    throw new HttpError(404, 'NOT_FOUND', 'That share link is not on your record.')
  }

  await audit.record(req, {
    action: 'report.share_revoked',
    subjectType: 'ReportShare',
    subjectId: share._id,
    hospital: share.hospital,
    summary: `Revoked share for ${share.reportNumber}`,
  })

  res.json({ data: { revoked: true } })
})

// ---- availability ----------------------------------------------------------

/**
 * Which slots are actually free, so the picker never offers a taken one.
 * `taken` is doctor-scoped, matching the clash rule the booking endpoint enforces.
 */
router.get('/hospitals/:hospitalId/availability', async (req, res) => {
  const hospitalId = mongoose.isValidObjectId(req.params.hospitalId) ? req.params.hospitalId : null

  if (!hospitalId) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date ?? '') ? req.query.date : localDate(new Date())
  const doctorId = mongoose.isValidObjectId(req.query.doctorId) ? req.query.doctorId : null

  const filter = { hospital: hospitalId, date, status: { $ne: 'cancelled' } }
  if (doctorId) filter.doctor = doctorId

  const [booked, hospitalBooked] = await Promise.all([
    Appointment.find(filter).select('time'),
    Appointment.find({ hospital: hospitalId, date, status: { $ne: 'cancelled' } }).select('time doctor'),
  ])

  const takenTimes = new Set(booked.map((row) => row.time))
  const today = localDate(new Date())
  const now = new Date()
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const slots = TIMES.map((time) => {
    const passed = date === today && time <= nowTime
    const taken = takenTimes.has(time)

    return {
      time,
      taken,
      passed,
      available: !taken && !passed,
      reason: taken ? 'already booked' : passed ? 'already passed' : '',
    }
  })

  res.json({
    data: {
      date,
      doctorId,
      slots,
      free: slots.filter((slot) => slot.available).length,
      total: slots.length,
      // Helpful context: how many slots that day are taken by other doctors too.
      hospitalBooked: new Set(hospitalBooked.map((row) => row.time)).size,
    },
  })
})

// ---- care plans ------------------------------------------------------------

const CARE_TARGET_TYPES = ['blood_pressure', 'weight', 'glucose', 'temperature', 'phq9', 'gad7']

function readTargets(value) {
  if (!Array.isArray(value)) return []

  return value
    .filter((entry) => typeof entry?.label === 'string' && entry.label.trim())
    .slice(0, 6)
    .map((entry) => ({
      label: entry.label.trim().slice(0, 60),
      vitalType: CARE_TARGET_TYPES.includes(entry.vitalType) ? entry.vitalType : 'blood_pressure',
      min: Number.isFinite(Number(entry.min)) ? Number(entry.min) : null,
      max: Number.isFinite(Number(entry.max)) ? Number(entry.max) : null,
      unit: typeof entry.unit === 'string' ? entry.unit.trim().slice(0, 16) : '',
    }))
}

router.get('/me/care-plans', async (req, res) => {
  const patientId = await actingPatientId(req)
  const plans = await CarePlan.find({ patient: patientId }).sort({ status: 1, createdAt: -1 })

  // Attach the latest reading for each target so the card can show progress.
  const withProgress = await Promise.all(
    plans.map(async (plan) => {
      const targets = await Promise.all(
        (plan.targets ?? []).map(async (target) => {
          const latest = await VitalsEntry.findOne({ patient: patientId, type: target.vitalType }).sort({ at: -1 })
          let state = 'no-data'

          if (latest) {
            const withinMin = target.min === null || latest.value >= target.min
            const withinMax = target.max === null || latest.value <= target.max
            state = withinMin && withinMax ? 'in-range' : 'out-of-range'
          }

          return {
            ...target.toObject?.() ?? target,
            latest: latest ? { value: latest.value, secondary: latest.secondary, at: latest.at } : null,
            state,
          }
        }),
      )

      return { ...plan.toJSON(), targetsWithProgress: targets }
    }),
  )

  res.json({ data: withProgress, meta: { count: withProgress.length } })
})

router.post('/me/care-plans', async (req, res) => {
  const patientId = await actingPatientId(req)
  const condition = typeof req.body?.condition === 'string' ? req.body.condition.trim().slice(0, 80) : ''

  if (!condition) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Which condition is this plan for?')
  }

  const frequency = Number(req.body?.checkInFrequencyDays)
  const plan = await CarePlan.create({
    patient: patientId,
    hospital: mongoose.isValidObjectId(req.body?.hospitalId) ? req.body.hospitalId : null,
    condition,
    goal: typeof req.body?.goal === 'string' ? req.body.goal.trim().slice(0, 300) : '',
    targets: readTargets(req.body?.targets),
    checkInFrequencyDays: Number.isFinite(frequency) ? Math.min(90, Math.max(1, frequency)) : 14,
    channel: ['whatsapp', 'email', 'none'].includes(req.body?.channel) ? req.body.channel : 'whatsapp',
    nextCheckInAt: new Date(Date.now() + (Number.isFinite(frequency) ? frequency : 14) * 86400000),
    notes: typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 500) : '',
    createdBy: req.user.name,
  })

  await audit.record(req, {
    action: 'care_plan.created',
    subjectType: 'CarePlan',
    subjectId: plan._id,
    hospital: plan.hospital,
    summary: `Care plan for ${condition}`,
  })

  res.status(201).json({ data: plan })
})

router.patch('/me/care-plans/:planId', async (req, res) => {
  const patientId = await actingPatientId(req)
  const update = {}

  if (typeof req.body?.condition === 'string' && req.body.condition.trim()) update.condition = req.body.condition.trim().slice(0, 80)
  if (typeof req.body?.goal === 'string') update.goal = req.body.goal.trim().slice(0, 300)
  if (Array.isArray(req.body?.targets)) update.targets = readTargets(req.body.targets)
  if (['active', 'paused', 'completed'].includes(req.body?.status)) update.status = req.body.status
  if (['whatsapp', 'email', 'none'].includes(req.body?.channel)) update.channel = req.body.channel
  if (typeof req.body?.notes === 'string') update.notes = req.body.notes.trim().slice(0, 500)

  if (Number.isFinite(Number(req.body?.checkInFrequencyDays))) {
    const days = Math.min(90, Math.max(1, Number(req.body.checkInFrequencyDays)))
    update.checkInFrequencyDays = days
    update.nextCheckInAt = new Date(Date.now() + days * 86400000)
  }

  const plan = await CarePlan.findOneAndUpdate(
    { _id: mongoose.isValidObjectId(req.params.planId) ? req.params.planId : null, patient: patientId },
    update,
    { new: true },
  )

  if (!plan) throw new HttpError(404, 'NOT_FOUND', 'That care plan is not on your record.')

  res.json({ data: plan })
})

router.delete('/me/care-plans/:planId', async (req, res) => {
  const patientId = await actingPatientId(req)
  const removed = await CarePlan.findOneAndDelete({
    _id: mongoose.isValidObjectId(req.params.planId) ? req.params.planId : null,
    patient: patientId,
  })

  if (!removed) throw new HttpError(404, 'NOT_FOUND', 'That care plan is not on your record.')

  res.json({ data: { deleted: true } })
})

// ---- pre-visit questionnaire -----------------------------------------------

router.get('/me/appointments/:appointmentId/previsit', async (req, res) => {
  const patientId = await actingPatientId(req)
  const form = await PrevisitForm.findOne({
    appointment: mongoose.isValidObjectId(req.params.appointmentId) ? req.params.appointmentId : null,
    patient: patientId,
  })

  res.json({ data: form })
})

router.post('/me/appointments/:appointmentId/previsit', async (req, res) => {
  const patientId = await actingPatientId(req)

  const appointment = await Appointment.findOne({
    _id: mongoose.isValidObjectId(req.params.appointmentId) ? req.params.appointmentId : null,
    patientUser: patientId,
  })

  if (!appointment) {
    throw new HttpError(404, 'NOT_FOUND', 'That appointment is not on your record.')
  }

  if (['cancelled', 'completed'].includes(appointment.status)) {
    throw new HttpError(409, 'CONFLICT', 'That appointment is closed.')
  }

  const text = (field, max) => (typeof req.body?.[field] === 'string' ? req.body[field].trim().slice(0, max) : '')
  const pain = Number(req.body?.painScale)

  const form = await PrevisitForm.findOneAndUpdate(
    { appointment: appointment._id },
    {
      appointment: appointment._id,
      patient: patientId,
      patientName: appointment.patientName,
      hospital: appointment.hospital,
      symptoms: text('symptoms', 800),
      duration: text('duration', 80),
      painScale: Number.isFinite(pain) ? Math.min(10, Math.max(0, pain)) : null,
      currentMedications: text('currentMedications', 400),
      allergies: text('allergies', 300),
      questions: text('questions', 400),
      anythingElse: text('anythingElse', 400),
      submittedAt: new Date(),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  res.status(201).json({ data: form })
})

// ---- vaccinations ----------------------------------------------------------

router.get('/me/vaccinations', async (req, res) => {
  const patientId = await actingPatientId(req)
  const records = await Vaccination.find({ patient: patientId })
    .sort({ administeredAt: -1 })
    .populate('hospital', 'name city')

  res.json({
    data: records.map((record) => ({
      ...record.toJSON(),
      verifyUrl: record.verificationCode
        ? `${(process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')}/verify-vaccination/${record.verificationCode}`
        : '',
    })),
    meta: { count: records.length },
  })
})

router.post('/me/vaccinations', async (req, res) => {
  const patientId = await actingPatientId(req)
  const vaccine = typeof req.body?.vaccine === 'string' ? req.body.vaccine.trim().slice(0, 80) : ''

  if (!vaccine) throw new HttpError(400, 'VALIDATION_ERROR', 'Which vaccine was given?')

  const code = `VAC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  const record = await Vaccination.create({
    patient: patientId,
    patientName: req.user.name,
    hospital: mongoose.isValidObjectId(req.body?.hospitalId) ? req.body.hospitalId : null,
    vaccine,
    doseNumber: Number.isFinite(Number(req.body?.doseNumber)) ? Math.min(10, Math.max(1, Number(req.body.doseNumber))) : 1,
    administeredAt: req.body?.administeredAt ? new Date(req.body.administeredAt) : new Date(),
    administeredBy: typeof req.body?.administeredBy === 'string' ? req.body.administeredBy.trim().slice(0, 80) : '',
    batchNumber: typeof req.body?.batchNumber === 'string' ? req.body.batchNumber.trim().slice(0, 40) : '',
    site: typeof req.body?.site === 'string' ? req.body.site.trim().slice(0, 40) : '',
    verificationCode: code,
    recordedBy: req.user.name,
    notes: typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 200) : '',
  })

  res.status(201).json({ data: record })
})

router.delete('/me/vaccinations/:vaccinationId', async (req, res) => {
  const patientId = await actingPatientId(req)
  const removed = await Vaccination.findOneAndDelete({
    _id: mongoose.isValidObjectId(req.params.vaccinationId) ? req.params.vaccinationId : null,
    patient: patientId,
  })

  if (!removed) throw new HttpError(404, 'NOT_FOUND', 'That record is not on your card.')

  res.json({ data: { deleted: true } })
})

// ---- dependents ------------------------------------------------------------

router.get('/me/dependents', async (req, res) => {
  const dependents = await Dependent.find({ guardian: req.user.id, status: 'active' }).sort({ createdAt: -1 })

  res.json({ data: dependents, meta: { count: dependents.length } })
})

router.post('/me/dependents', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : ''

  if (!name) throw new HttpError(400, 'VALIDATION_ERROR', 'Who are you adding?')

  const dependent = await Dependent.create({
    guardian: req.user.id,
    name,
    relation: ['child', 'parent', 'spouse', 'sibling', 'other'].includes(req.body?.relation)
      ? req.body.relation
      : 'other',
    dateOfBirth: typeof req.body?.dateOfBirth === 'string' ? req.body.dateOfBirth.slice(0, 10) : '',
    phone: typeof req.body?.phone === 'string' ? req.body.phone.trim().slice(0, 30) : '',
  })

  await audit.record(req, {
    action: 'dependent.added',
    subjectType: 'Dependent',
    subjectId: dependent._id,
    summary: `Added ${name} (${dependent.relation})`,
  })

  res.status(201).json({ data: dependent })
})

router.delete('/me/dependents/:dependentId', async (req, res) => {
  const dependent = await Dependent.findOneAndUpdate(
    {
      _id: mongoose.isValidObjectId(req.params.dependentId) ? req.params.dependentId : null,
      guardian: req.user.id,
    },
    { status: 'revoked', canActFor: false, revokedAt: new Date() },
    { new: true },
  )

  if (!dependent) throw new HttpError(404, 'NOT_FOUND', 'That dependent is not on your account.')

  await audit.record(req, {
    action: 'dependent.revoked',
    subjectType: 'Dependent',
    subjectId: dependent._id,
    summary: `Revoked access to ${dependent.name}`,
  })

  res.json({ data: { revoked: true } })
})

// ---- waitlist --------------------------------------------------------------

router.get('/me/waitlist', async (req, res) => {
  const patientId = await actingPatientId(req)
  const entries = await WaitlistEntry.find({ patient: patientId })
    .sort({ createdAt: -1 })
    .populate('hospital', 'name city area')

  res.json({ data: entries, meta: { count: entries.length } })
})

router.post('/me/waitlist', async (req, res) => {
  const patientId = await actingPatientId(req)
  const hospitalId = mongoose.isValidObjectId(req.body?.hospitalId) ? req.body.hospitalId : null

  if (!hospitalId) throw new HttpError(400, 'VALIDATION_ERROR', 'Which hospital should we watch?')

  const existing = await WaitlistEntry.findOne({
    patient: patientId,
    hospital: hospitalId,
    status: { $in: ['waiting', 'offered'] },
  })

  if (existing) {
    throw new HttpError(409, 'CONFLICT', 'You are already on that list.')
  }

  const entry = await WaitlistEntry.create({
    hospital: hospitalId,
    patient: patientId,
    patientName: req.user.name,
    patientPhone: typeof req.body?.patientPhone === 'string' ? req.body.patientPhone.trim().slice(0, 30) : '',
    specialty: typeof req.body?.specialty === 'string' ? req.body.specialty.trim().slice(0, 80) : '',
    from: typeof req.body?.from === 'string' ? req.body.from.slice(0, 10) : '',
    to: typeof req.body?.to === 'string' ? req.body.to.slice(0, 10) : '',
    reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '',
  })

  res.status(201).json({ data: entry })
})

/** Accepting an offer creates the appointment and closes the waitlist entry. */
router.post('/me/waitlist/:entryId/accept', async (req, res) => {
  const patientId = await actingPatientId(req)

  const entry = await WaitlistEntry.findOne({
    _id: mongoose.isValidObjectId(req.params.entryId) ? req.params.entryId : null,
    patient: patientId,
    status: 'offered',
  })

  if (!entry) throw new HttpError(404, 'NOT_FOUND', 'No offer is waiting on that entry.')

  if (entry.offer.expiresAt && entry.offer.expiresAt < new Date()) {
    entry.status = 'expired'
    await entry.save()
    throw new HttpError(410, 'GONE', 'That offer has expired.')
  }

  const clash = await Appointment.exists({
    hospital: entry.hospital,
    date: entry.offer.date,
    time: entry.offer.time,
    status: { $ne: 'cancelled' },
  })

  if (clash) {
    entry.status = 'expired'
    await entry.save()
    throw new HttpError(409, 'CONFLICT', 'That slot has already gone — we will offer you the next one.')
  }

  const appointment = await Appointment.create({
    hospital: entry.hospital,
    patientUser: patientId,
    patientName: entry.patientName,
    patientPhone: entry.patientPhone,
    doctorName: entry.offer.doctorName,
    specialty: entry.specialty,
    date: entry.offer.date,
    time: entry.offer.time,
    reason: entry.reason || 'Booked from the waitlist',
    source: 'patient',
    status: 'requested',
  })

  entry.status = 'accepted'
  entry.acceptedAppointment = appointment._id
  await entry.save()

  await audit.record(req, {
    action: 'waitlist.accepted',
    subjectType: 'WaitlistEntry',
    subjectId: entry._id,
    hospital: entry.hospital,
    summary: `Took the offered slot ${entry.offer.date} ${entry.offer.time}`,
  })

  res.status(201).json({ data: { entry, appointment } })
})

router.delete('/me/waitlist/:entryId', async (req, res) => {
  const patientId = await actingPatientId(req)
  const entry = await WaitlistEntry.findOneAndUpdate(
    {
      _id: mongoose.isValidObjectId(req.params.entryId) ? req.params.entryId : null,
      patient: patientId,
      status: { $in: ['waiting', 'offered'] },
    },
    { status: 'cancelled' },
    { new: true },
  )

  if (!entry) throw new HttpError(404, 'NOT_FOUND', 'That entry is not on your list.')

  res.json({ data: { cancelled: true } })
})

// ---- device import ---------------------------------------------------------

/** Batch import from a health platform export (Apple Health / Google Fit style). */
router.post('/me/vitals/import', async (req, res) => {
  const patientId = await actingPatientId(req)
  const source = typeof req.body?.source === 'string' ? req.body.source.slice(0, 40) : 'device'
  const entries = Array.isArray(req.body?.entries) ? req.body.entries.slice(0, 500) : []

  if (!entries.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send at least one reading.', [
      { field: 'entries', message: 'An array of readings.' },
    ])
  }

  const accepted = []
  const skipped = []
  const seenInBatch = new Set()

  for (const raw of entries) {
    const type = VITALS_TYPES.includes(raw?.type) ? raw.type : null
    const value = Number(raw?.value)
    const at = raw?.at ? new Date(raw.at) : null

    if (!type || !Number.isFinite(value) || (at && Number.isNaN(at.getTime()))) {
      skipped.push(raw)
      continue
    }

    const key = `${type}|${value}|${at ? at.toISOString() : 'now'}`

    // Same reading twice in one batch, or already in the record, is a duplicate.
    if (seenInBatch.has(key)) {
      skipped.push(raw)
      continue
    }

    seenInBatch.add(key)

    const exists = await VitalsEntry.exists({
      patient: patientId,
      type,
      value,
      at: at ?? { $gte: new Date(Date.now() - 60000) },
    })

    if (exists) {
      skipped.push(raw)
      continue
    }

    accepted.push({
      patient: patientId,
      type,
      value,
      secondary: Number.isFinite(Number(raw?.secondary)) ? Number(raw.secondary) : null,
      unit: typeof raw?.unit === 'string' ? raw.unit.slice(0, 12) : '',
      at: at ?? new Date(),
      note: source,
    })
  }

  if (accepted.length) await VitalsEntry.insertMany(accepted)

  await audit.record(req, {
    action: 'vitals.imported',
    subjectType: 'VitalsEntry',
    summary: `Imported ${accepted.length} reading(s) from ${source}, skipped ${skipped.length}`,
  })

  res.status(201).json({
    data: { imported: accepted.length, skipped: skipped.length, source },
    meta: { skipped: skipped.slice(0, 10) },
  })
})

module.exports = router
