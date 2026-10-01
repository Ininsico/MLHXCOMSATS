const express = require('express')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const Hospital = require('../models/hospital')
const User = require('../models/user')
const HttpError = require('../lib/http-error')
const { startSession } = require('../lib/auth')
const { issueCode } = require('../lib/otp')
const { sendEmailQuietly } = require('../lib/mailer')
const {
  emailVerificationEmail,
  hospitalApplicationReceivedEmail,
  hospitalApplicationAdminEmail,
  hospitalVerificationAdminEmail,
} = require('../lib/emails')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')
const requireHospital = require('../middleware/require-hospital')
const Staff = require('../models/staff')
const { PLANS, THEMES, findPlan, findTheme, themesForPlan } = require('../lib/plans')

const router = express.Router()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isHttpsUrl(value, maxLength) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= maxLength && trimmed.startsWith('https://')
}

function parseApplication(body) {
  const details = []
  const account = {}
  const profile = {}

  const read = (field, min, max, label) => {
    const value = typeof body?.[field] === 'string' ? body[field].trim() : ''
    if (value.length < min || value.length > max) {
      details.push({ field, message: `${label} must be ${min}-${max} characters.` })
      return null
    }
    return value
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email)) {
    details.push({ field: 'email', message: 'Enter a valid email address.' })
  } else {
    account.email = email
  }

  const password = typeof body?.password === 'string' ? body.password : ''
  if (password.length < 8) {
    details.push({ field: 'password', message: 'At least 8 characters.' })
  } else {
    account.password = password
  }

  const accountName = read('name', 2, 80, 'Your name')
  if (accountName) account.name = accountName

  const hospitalName = read('hospitalName', 2, 120, 'Hospital name')
  if (hospitalName) profile.name = hospitalName

  const city = read('city', 2, 80, 'City')
  if (city) profile.city = city

  const area = read('area', 2, 80, 'Area')
  if (area) profile.area = area

  const phone = read('phone', 5, 30, 'Phone')
  if (phone) profile.phone = phone

  const description = read('description', 20, 600, 'Description')
  if (description) profile.description = description

  const specialties = Array.isArray(body?.specialties) ? body.specialties : null
  const specialtiesValid =
    specialties &&
    specialties.length >= 1 &&
    specialties.length <= 12 &&
    specialties.every(
      (item) => typeof item === 'string' && item.trim().length >= 2 && item.trim().length <= 40,
    )

  if (!specialtiesValid) {
    details.push({ field: 'specialties', message: 'Send 1-12 specialty names, each 2-40 characters.' })
  } else {
    profile.specialties = specialties.map((item) => item.trim())
  }

  if (body?.logoUrl !== undefined && body.logoUrl !== '') {
    if (!isHttpsUrl(body.logoUrl, 500)) {
      details.push({ field: 'logoUrl', message: 'Logo must be an https image URL.' })
    } else {
      profile.logoUrl = body.logoUrl.trim()
    }
  }

  if (details.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Please check the form and try again.', details)
  }

  return { account, profile }
}

router.post('/apply', async (req, res) => {
  const { account, profile } = parseApplication(req.body)

  if (await User.exists({ email: account.email })) {
    throw new HttpError(
      409,
      'CONFLICT',
      'An account with this email already exists. Sign in instead of applying again.',
    )
  }

  const passwordHash = await bcrypt.hash(account.password, 10)
  const user = await User.create({
    name: account.name,
    email: account.email,
    passwordHash,
    role: 'hospital',
    status: 'pending',
  })

  const hospital = await Hospital.create({
    ...profile,
    status: 'pending',
    owner: user._id,
  })

  const adminEmail = (process.env.MAIN_ADMIN_EMAIL || '').trim().toLowerCase()
  const verification = await issueCode(account.email, 'verify').catch(() => null)

  Promise.allSettled([
    sendEmailQuietly({
      to: account.email,
      ...hospitalApplicationReceivedEmail({ hospitalName: hospital.name }),
    }),
    verification
      ? sendEmailQuietly({ to: account.email, ...emailVerificationEmail(verification) })
      : Promise.resolve({ skipped: true }),
    adminEmail
      ? sendEmailQuietly({
          to: adminEmail,
          ...hospitalApplicationAdminEmail({
            hospitalName: hospital.name,
            city: hospital.city,
            area: hospital.area,
            contactEmail: account.email,
            specialties: hospital.specialties,
          }),
        })
      : Promise.resolve({ skipped: true }),
  ])

  startSession(res, user)
  res.status(201).json({ data: { hospital, user } })
})

router.get('/', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const filter = { status: 'approved' }

  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: pattern }, { city: pattern }, { area: pattern }, { specialties: pattern }]
  }

  const hospitals = await Hospital.find(filter).sort({ rating: -1 })
  res.json({ data: hospitals, meta: { count: hospitals.length } })
})

router.get('/mine', requireAuth, requireRole('hospital'), async (req, res) => {
  const hospital = await Hospital.findOne({ owner: req.user.id })

  if (!hospital) {
    throw new HttpError(404, 'NOT_FOUND', 'No hospital is linked to this account yet.')
  }

  res.json({ data: { hospital } })
})

function validateUpdates(body) {
  const updates = {}
  const details = []

  const text = (field, min, max) => {
    const value = body?.[field]
    if (value === undefined) return
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
      details.push({ field, message: `Must be ${min}-${max} characters.` })
      return
    }
    updates[field] = value.trim()
  }

  text('description', 20, 600)
  text('phone', 5, 30)
  text('address', 5, 200)
  text('area', 2, 80)
  text('city', 2, 80)

  if (body?.specialties !== undefined) {
    const list = Array.isArray(body.specialties) ? body.specialties : null
    const valid =
      list &&
      list.length >= 1 &&
      list.length <= 12 &&
      list.every(
        (item) => typeof item === 'string' && item.trim().length >= 2 && item.trim().length <= 40,
      )

    if (!valid) {
      details.push({
        field: 'specialties',
        message: 'Send 1-12 specialty names, each 2-40 characters.',
      })
    } else {
      updates.specialties = list.map((item) => item.trim())
    }
  }

  if (body?.logoUrl !== undefined) {
    const value = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : null

    if (value === null) {
      details.push({ field: 'logoUrl', message: 'Logo must be an https image URL.' })
    } else if (value === '') {
      updates.logoUrl = ''
    } else if (!isHttpsUrl(value, 500)) {
      details.push({ field: 'logoUrl', message: 'Logo must be an https image URL.' })
    } else {
      updates.logoUrl = value
    }
  }

  if (body?.photos !== undefined) {
    const list = Array.isArray(body.photos) ? body.photos : null
    const valid = list && list.length <= 6 && list.every((item) => isHttpsUrl(item, 500))

    if (!valid) {
      details.push({ field: 'photos', message: 'Send up to 6 https image URLs.' })
    } else {
      updates.photos = list.map((item) => item.trim())
    }
  }

  if (details.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Please check the form and try again.', details)
  }
  if (!Object.keys(updates).length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Nothing to update.')
  }

  return updates
}

router.patch('/mine', requireAuth, requireRole('hospital'), async (req, res) => {
  const hospital = await Hospital.findOne({ owner: req.user.id })

  if (!hospital) {
    throw new HttpError(404, 'NOT_FOUND', 'No hospital is linked to this account yet.')
  }

  const updates = validateUpdates(req.body)
  hospital.set(updates)
  await hospital.save()

  res.json({ data: { hospital } })
})

router.get('/mine/subscription', requireAuth, requireRole('hospital'), requireHospital, async (req, res) => {
  const subscription = req.hospital.subscription ?? {}

  res.json({
    data: {
      subscription,
      plan: findPlan(subscription.planId),
      themes: THEMES,
      plans: PLANS,
    },
  })
})

router.post('/mine/subscription', requireAuth, requireRole('hospital'), requireHospital, async (req, res) => {
  const plan = findPlan(req.body?.planId)

  if (!plan) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose one of the Aurora plans.', [
      { field: 'planId', message: 'Unknown plan.' },
    ])
  }

  const startedAt = new Date()
  const renewsAt = new Date(startedAt)
  renewsAt.setDate(renewsAt.getDate() + 30)

  const currentTheme = req.hospital.subscription?.themeId
  req.hospital.subscription = {
    planId: plan.id,
    themeId: plan.themes.includes(currentTheme) ? currentTheme : plan.themes[0],
    status: 'active',
    startedAt,
    renewsAt,
  }
  await req.hospital.save()

  res.json({ data: { subscription: req.hospital.subscription, plan } })
})

router.post('/mine/theme', requireAuth, requireRole('hospital'), requireHospital, async (req, res) => {
  const theme = findTheme(req.body?.themeId)

  if (!theme) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a theme.', [
      { field: 'themeId', message: 'Unknown theme.' },
    ])
  }

  const allowed = themesForPlan(req.hospital.subscription?.planId ?? 'starter')

  if (!allowed.includes(theme.id)) {
    throw new HttpError(403, 'FORBIDDEN', `The ${theme.name} theme is part of a higher plan.`)
  }

  req.hospital.subscription.themeId = theme.id
  await req.hospital.save()

  res.json({ data: { subscription: req.hospital.subscription, theme } })
})

router.post('/mine/verification', requireAuth, requireRole('hospital'), requireHospital, async (req, res) => {
  const documents = Array.isArray(req.body?.documents) ? req.body.documents : []
  const cleaned = documents
    .filter((doc) => doc && typeof doc.label === 'string' && typeof doc.url === 'string')
    .map((doc) => ({ label: doc.label.trim().slice(0, 80), url: doc.url.trim() }))
    .filter((doc) => doc.label.length >= 2 && doc.url.startsWith('https://') && doc.url.length <= 500)
    .slice(0, 5)

  if (!cleaned.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Add at least one document to review.', [
      { field: 'documents', message: 'Each document needs a label and an uploaded image.' },
    ])
  }

  req.hospital.verification = {
    status: 'pending',
    documents: cleaned,
    submittedAt: new Date(),
    reviewedAt: null,
    notes: '',
  }
  await req.hospital.save()

  const adminEmail = (process.env.MAIN_ADMIN_EMAIL || '').trim().toLowerCase()

  if (adminEmail) {
    sendEmailQuietly({
      to: adminEmail,
      ...hospitalVerificationAdminEmail({
        hospitalName: req.hospital.name,
        city: req.hospital.city,
        area: req.hospital.area,
      }),
    })
  }

  res.json({ data: { verification: req.hospital.verification } })
})

router.get('/:hospitalId/doctors', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.hospitalId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  const filter = { hospital: req.params.hospitalId, role: 'doctor', status: 'active' }
  const doctors = await Staff.find(filter).sort({ name: 1 }).select('name specialty department')

  res.json({ data: doctors, meta: { count: doctors.length } })
})

router.get('/:hospitalId', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  const { hospitalId } = req.params

  if (!mongoose.isValidObjectId(hospitalId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  const filter = { _id: hospitalId }
  if (req.user.role !== 'admin') {
    filter.status = 'approved'
  }

  const hospital = await Hospital.findOne(filter)

  if (!hospital) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  res.json({ data: { hospital } })
})

module.exports = router
