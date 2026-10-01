/**
 * Patient self-service: everything a signed-in patient can do to their own record.
 *
 * Public share links are registered BEFORE the auth guard — opening a shared report
 * is the one thing that must work without a session.
 */

const express = require('express')
const mongoose = require('mongoose')
const Appointment = require('../models/appointment')
const Hospital = require('../models/hospital')
const LabOrder = require('../models/lab-order')
const PatientProfile = require('../models/patient-profile')
const ReportShare = require('../models/report-share')
const Review = require('../models/review')
const VitalsEntry = require('../models/vitals-entry')
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
  const filter = { patient: req.user.id }

  if (typeof req.query.type === 'string' && VITALS_TYPES.includes(req.query.type)) {
    filter.type = req.query.type
  }

  const entries = await VitalsEntry.find(filter).sort({ at: -1 }).limit(120)

  res.json({ data: entries, meta: { count: entries.length } })
})

router.post('/me/vitals', async (req, res) => {
  const type = VITALS_TYPES.includes(req.body?.type) ? req.body.type : null
  const value = Number(req.body?.value)

  if (!type || !Number.isFinite(value)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a reading type and enter a number.', [
      { field: 'value', message: 'A number is required.' },
    ])
  }

  const entry = await VitalsEntry.create({
    patient: req.user.id,
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

module.exports = router
