const express = require('express')
const mongoose = require('mongoose')
const User = require('../models/user')
const Hospital = require('../models/hospital')
const Appointment = require('../models/appointment')
const InventoryItem = require('../models/inventory-item')
const LabTest = require('../models/lab-test')
const Staff = require('../models/staff')
const HttpError = require('../lib/http-error')
const { sendEmailQuietly } = require('../lib/mailer')
const { hospitalDecisionEmail, hospitalVerificationDecisionEmail } = require('../lib/emails')
const { PLANS, THEMES, findPlan } = require('../lib/plans')
const AiSettings = require('../models/ai-settings')
const AiInferenceLog = require('../models/ai-inference-log')
const AiFeedback = require('../models/ai-feedback')
const aiService = require('../lib/ai-service')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

const OWNER_STATUS = { approved: 'active', suspended: 'suspended', pending: 'pending' }

router.use(requireAuth, requireRole('admin'))

const SIGNUP_DAYS = 14

router.get('/stats', async (req, res) => {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (SIGNUP_DAYS - 1))

  const [
    users,
    patients,
    hospitals,
    pending,
    approved,
    suspended,
    admins,
    verified,
    unverified,
    verificationPending,
    appointments,
    inventoryItems,
    labTests,
    staff,
    signupRows,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'patient' }),
    Hospital.countDocuments(),
    Hospital.countDocuments({ status: 'pending' }),
    Hospital.countDocuments({ status: 'approved' }),
    Hospital.countDocuments({ status: 'suspended' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ emailVerifiedAt: { $ne: null } }),
    User.countDocuments({ emailVerifiedAt: null }),
    Hospital.countDocuments({ 'verification.status': 'pending' }),
    Appointment.countDocuments(),
    InventoryItem.countDocuments(),
    LabTest.countDocuments(),
    Staff.countDocuments(),
    User.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
            role: '$role',
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  const signups = []

  for (let index = 0; index < SIGNUP_DAYS; index += 1) {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + index)
    const key = day.toISOString().slice(0, 10)
    const countFor = (role) =>
      signupRows.find((row) => row._id.day === key && row._id.role === role)?.count ?? 0

    signups.push({ date: key, patients: countFor('patient'), hospitals: countFor('hospital') })
  }

  res.json({
    data: {
      users,
      patients,
      hospitals,
      pending,
      approved,
      suspended,
      admins,
      verified,
      unverified,
      verificationPending,
      appointments,
      inventoryItems,
      labTests,
      staff,
      signups,
    },
  })
})

router.get('/users', async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(20)
  res.json({ data: users, meta: { count: users.length } })
})

router.get('/hospitals', async (req, res) => {
  const hospitals = await Hospital.find()
    .sort({ createdAt: -1 })
    .populate('owner', 'name email status')

  res.json({ data: hospitals, meta: { count: hospitals.length } })
})

router.get('/subscriptions', async (req, res) => {
  const hospitals = await Hospital.find().select('name city area status subscription').sort({
    createdAt: -1,
  })

  const rows = hospitals.map((hospital) => ({
    id: hospital.id,
    name: hospital.name,
    city: hospital.city,
    area: hospital.area,
    status: hospital.status,
    subscription: hospital.subscription,
    plan: findPlan(hospital.subscription?.planId ?? 'starter'),
  }))

  const mrr = rows.reduce((total, row) => total + (row.subscription?.status === 'active' ? (row.plan?.price ?? 0) : 0), 0)

  res.json({ data: { rows, mrr, plans: PLANS, themes: THEMES }, meta: { count: rows.length } })
})

router.get('/ai-settings', async (req, res) => {
  const settings = await AiSettings.load()
  const departments = (await Staff.distinct('department')).filter(Boolean)
  const known = new Map(settings.departments.map((entry) => [entry.name, entry.enabled]))

  settings.departments = [...new Set([...departments, ...known.keys()])]
    .filter(Boolean)
    .sort()
    .map((name) => ({ name, enabled: known.get(name) !== false }))
  await settings.save()

  let health = null
  let available = false

  try {
    health = await aiService.health()
    available = true
  } catch {
    available = false
  }

  res.json({ data: { settings, available, health, serviceUrl: aiService.baseUrl() } })
})

router.patch('/ai-settings', async (req, res) => {
  const settings = await AiSettings.load()

  if (typeof req.body?.enabled === 'boolean') {
    settings.enabled = req.body.enabled
  }

  const readNumber = (field, min, max) => {
    if (req.body?.[field] === undefined) return

    const value = Number(req.body[field])

    if (!Number.isFinite(value) || value < min || value > max) {
      throw new HttpError(400, 'VALIDATION_ERROR', `${field} must be between ${min} and ${max}.`, [
        { field, message: `${min}-${max}.` },
      ])
    }

    settings[field] = value
  }

  readNumber('maxTokens', 64, 2048)
  readNumber('temperature', 0, 2)
  readNumber('timeoutSeconds', 30, 600)

  if (req.body?.departments !== undefined) {
    if (!Array.isArray(req.body.departments) || req.body.departments.length > 60) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Send up to 60 department entries.', [
        { field: 'departments', message: 'An array of { name, enabled }.' },
      ])
    }

    settings.departments = req.body.departments
      .filter((entry) => entry && typeof entry.name === 'string' && entry.name.trim())
      .map((entry) => ({
        name: entry.name.trim().slice(0, 80),
        enabled: entry.enabled !== false,
      }))
  }

  await settings.save()
  res.json({ data: { settings } })
})

router.get('/ai-usage', async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const match = { createdAt: { $gte: since } }

  const [total, bySeverity, byKind, feedback, latency] = await Promise.all([
    AiInferenceLog.countDocuments(match),
    AiInferenceLog.aggregate([
      { $match: match },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    AiInferenceLog.aggregate([
      { $match: match },
      { $group: { _id: '$kind', count: { $sum: 1 } } },
    ]),
    AiFeedback.aggregate([{ $group: { _id: '$decision', count: { $sum: 1 } } }]),
    AiInferenceLog.aggregate([
      { $match: { ...match, cached: false } },
      { $group: { _id: null, avg: { $avg: '$latencyMs' } } },
    ]),
  ])

  res.json({
    data: {
      windowDays: 30,
      total,
      bySeverity,
      byKind,
      feedback,
      avgLatencyMs: Math.round(latency[0]?.avg ?? 0),
    },
  })
})

router.patch('/hospitals/:hospitalId/verification', async (req, res) => {
  const { status } = req.body ?? {}
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 300) : ''

  if (!['verified', 'rejected', 'pending'].includes(status)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose verified, rejected, or pending.', [
      { field: 'status', message: 'Unknown verification status.' },
    ])
  }

  if (!mongoose.isValidObjectId(req.params.hospitalId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  const hospital = await Hospital.findById(req.params.hospitalId).populate('owner', 'name email')
  if (!hospital) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  hospital.verification.status = status
  hospital.verification.notes = notes
  hospital.verification.reviewedAt = new Date()
  await hospital.save()

  if (hospital.owner?.email && status !== 'pending') {
    await sendEmailQuietly({
      to: hospital.owner.email,
      ...hospitalVerificationDecisionEmail({
        hospitalName: hospital.name,
        approved: status === 'verified',
        notes,
      }),
    })
  }

  const updated = await Hospital.findById(hospital._id).populate('owner', 'name email status')
  res.json({ data: { hospital: updated } })
})

router.patch('/hospitals/:hospitalId/status', async (req, res) => {
  const { status } = req.body ?? {}

  if (!Object.prototype.hasOwnProperty.call(OWNER_STATUS, status)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Status must be approved, suspended, or pending.', [
      { field: 'status', message: 'Choose approved, suspended, or pending.' },
    ])
  }

  if (!mongoose.isValidObjectId(req.params.hospitalId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  const hospital = await Hospital.findById(req.params.hospitalId).populate('owner', 'name email')

  if (!hospital) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  hospital.status = status
  await hospital.save()

  if (hospital.owner) {
    await User.findByIdAndUpdate(hospital.owner._id, { status: OWNER_STATUS[status] })

    if (status !== 'pending') {
      await sendEmailQuietly({
        to: hospital.owner.email,
        ...hospitalDecisionEmail({ hospitalName: hospital.name, approved: status === 'approved' }),
      })
    }
  }

  const updated = await Hospital.findById(hospital._id).populate('owner', 'name email status')
  res.json({ data: { hospital: updated } })
})

module.exports = router
