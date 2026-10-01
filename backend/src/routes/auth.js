const express = require('express')
const bcrypt = require('bcryptjs')
const User = require('../models/user')
const Hospital = require('../models/hospital')
const Staff = require('../models/staff')
const HttpError = require('../lib/http-error')
const { startSession, COOKIE_NAME, cookieOptions } = require('../lib/auth')
const { issueCode, consumeCode } = require('../lib/otp')
const { sendEmail, sendEmailQuietly } = require('../lib/mailer')
const { otpEmail, emailVerificationEmail } = require('../lib/emails')
const requireAuth = require('../middleware/require-auth')

const router = express.Router()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function sendVerificationCode(user) {
  const { code, expiresInMinutes } = await issueCode(user.email, 'verify')

  return sendEmailQuietly({
    to: user.email,
    ...emailVerificationEmail({ code, expiresInMinutes }),
  })
}

function readEmail(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Enter a valid email address.', [
      { field: 'email', message: 'Invalid email address.' },
    ])
  }
  return email
}

function mainAdminEmail() {
  return (process.env.MAIN_ADMIN_EMAIL || '').trim().toLowerCase()
}

async function findAccount(email) {
  const user = await User.findOne({ email })
  if (!user) {
    throw new HttpError(404, 'NOT_FOUND', 'No account uses this email yet. Create one first.')
  }
  return user
}

function parseSignup(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (name.length < 2) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Enter your full name.', [
      { field: 'name', message: 'At least 2 characters.' },
    ])
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Enter a valid email address.', [
      { field: 'email', message: 'Invalid email address.' },
    ])
  }
  if (password.length < 8) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters.', [
      { field: 'password', message: 'At least 8 characters.' },
    ])
  }

  return { name, email, password }
}

router.post('/signup', async (req, res) => {
  const { name, email, password } = parseSignup(req.body)

  if (await User.exists({ email })) {
    throw new HttpError(409, 'CONFLICT', 'An account with this email already exists.')
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const isMainAdmin = email === mainAdminEmail()
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: isMainAdmin ? 'admin' : 'patient',
    status: 'active',
    emailVerifiedAt: isMainAdmin ? new Date() : null,
  })

  if (!isMainAdmin) {
    sendVerificationCode(user).catch((err) => {
      console.error('Verification email failed:', err.message)
    })
  }

  startSession(res, user)
  res.status(201).json({ data: { user } })
})

router.post('/signin', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!email || !password) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Email and password are required.')
  }

  const user = await User.findOne({ email }).select('+passwordHash')

  if (user && !user.passwordHash) {
    throw new HttpError(
      401,
      'UNAUTHORIZED',
      'This account signs in with a one-time code sent to your email.',
    )
  }

  const matches = user ? await bcrypt.compare(password, user.passwordHash) : false

  if (!matches) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid email or password.')
  }

  startSession(res, user)
  res.json({ data: { user } })
})

router.post('/otp/request', async (req, res) => {
  const email = readEmail(req.body)
  await findAccount(email)

  const { code, expiresInMinutes } = await issueCode(email, 'login')
  await sendEmail({ to: email, ...otpEmail({ code, purpose: 'login', expiresInMinutes }) })

  res.json({ data: { sent: true, expiresInMinutes } })
})

router.post('/otp/verify', async (req, res) => {
  const email = readEmail(req.body)
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''

  await consumeCode(email, 'login', code)
  const user = await findAccount(email)

  startSession(res, user)
  res.json({ data: { user } })
})

router.post('/password/forgot', async (req, res) => {
  const email = readEmail(req.body)
  await findAccount(email)

  const { code, expiresInMinutes } = await issueCode(email, 'reset')
  await sendEmail({ to: email, ...otpEmail({ code, purpose: 'reset', expiresInMinutes }) })

  res.json({ data: { sent: true, expiresInMinutes } })
})

router.post('/password/reset', async (req, res) => {
  const email = readEmail(req.body)
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (password.length < 8) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters.', [
      { field: 'password', message: 'At least 8 characters.' },
    ])
  }

  await consumeCode(email, 'reset', code)
  const user = await findAccount(email)

  user.passwordHash = await bcrypt.hash(password, 10)
  await user.save()

  startSession(res, user)
  res.json({ data: { user } })
})

router.post('/verify/request', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)

  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Account not found. Sign in again.')
  }

  if (user.emailVerifiedAt) {
    res.json({ data: { sent: false, verified: true } })
    return
  }

  const { code, expiresInMinutes } = await issueCode(user.email, 'verify')
  await sendEmail({ to: user.email, ...emailVerificationEmail({ code, expiresInMinutes }) })

  res.json({ data: { sent: true, sentTo: user.email, expiresInMinutes } })
})

router.post('/verify/confirm', requireAuth, async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  const user = await User.findById(req.userId)

  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Account not found. Sign in again.')
  }

  if (!user.emailVerifiedAt) {
    await consumeCode(user.email, 'verify', code)
    user.emailVerifiedAt = new Date()
    await user.save()
  }

  res.json({ data: { user } })
})

const DEMO_EMAILS = {
  patient: 'demo.patient@aurora.local',
  doctor: 'demo.doctor@aurora.local',
  hospital: 'demo.hospital@aurora.local',
}

const DEMO_ROLE_HINTS = {
  patient: 'Full patient app: appointments, lab reports, Aurora AI doctors and therapy.',
  doctor: 'Doctor console: today list, timetable, lab requests, clinical AI.',
  hospital: 'Approved hospital portal: appointments, staff, lab, inventory, billing plan.',
  admin: 'Aurora console: applications, verification, hospitals, plans, accounts.',
}

/**
 * Instant sign-in must hand over an account that can actually use its console:
 * an unapproved hospital would land on the pending screen, and a doctor with no
 * linked staff profile would open an empty dashboard. So each role is resolved by
 * provisioning, not just by role name.
 */
async function pickDemoUser(role) {
  const usable = (user) => user && user.status !== 'suspended'

  if (role === 'admin') {
    const email = mainAdminEmail()
    const configured = email ? await User.findOne({ email }) : null

    if (usable(configured)) return { user: configured, provisioned: true, note: DEMO_ROLE_HINTS.admin }

    const fallback = await User.findOne({ role: 'admin', status: { $ne: 'suspended' } }).sort({ createdAt: 1 })
    return { user: fallback, provisioned: Boolean(fallback), note: DEMO_ROLE_HINTS.admin }
  }

  const preferred = await User.findOne({ email: DEMO_EMAILS[role] })

  if (role === 'doctor') {
    const staff = await Staff.findOne({ role: 'doctor', status: 'active', user: { $ne: null } })
    const linked = staff?.user ? await User.findById(staff.user) : null

    if (usable(linked)) {
      return {
        user: linked,
        provisioned: true,
        note: `${DEMO_ROLE_HINTS.doctor} (${staff.name}${staff.specialty ? `, ${staff.specialty}` : ''})`,
      }
    }

    if (usable(preferred)) {
      return {
        user: preferred,
        provisioned: false,
        note: 'This doctor account has no staff profile yet, so the console will look empty — run "npm run seed" in backend/ for the full demo world.',
      }
    }
  }

  if (role === 'hospital') {
    const hospital = await Hospital.findOne({ status: 'approved', owner: { $ne: null } })
    const owner = hospital?.owner ? await User.findById(hospital.owner) : null

    if (usable(owner)) {
      return {
        user: owner,
        provisioned: true,
        note: `${DEMO_ROLE_HINTS.hospital} (${hospital.name}${hospital.city ? `, ${hospital.city}` : ''})`,
      }
    }

    if (usable(preferred)) {
      return {
        user: preferred,
        provisioned: false,
        note: 'This hospital account is not approved yet, so sign-in opens the pending screen — approve it in the admin console, or run "npm run seed".',
      }
    }
  }

  if (role === 'patient' && usable(preferred)) {
    return { user: preferred, provisioned: true, note: DEMO_ROLE_HINTS.patient }
  }

  const anyUser = await User.findOne({ role, status: { $ne: 'suspended' } }).sort({ createdAt: 1 })

  return {
    user: anyUser,
    provisioned: Boolean(anyUser),
    note: DEMO_ROLE_HINTS[role] ?? '',
  }
}

router.post('/demo-login', async (req, res) => {
  if (process.env.DEMO_LOGIN === 'false') {
    throw new HttpError(403, 'FORBIDDEN', 'Instant demo sign-in is turned off.')
  }

  const role = typeof req.body?.role === 'string' ? req.body.role : ''

  if (!['patient', 'doctor', 'hospital', 'admin'].includes(role)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a role to sign in as.', [
      { field: 'role', message: 'patient, doctor, hospital, or admin.' },
    ])
  }

  const { user, provisioned, note } = await pickDemoUser(role)

  if (!user) {
    throw new HttpError(
      404,
      'NOT_FOUND',
      `No ${role} account exists yet — run "npm run seed" in backend/ first.`,
    )
  }

  startSession(res, user)

  res.json({
    data: {
      user,
      demo: { role, email: user.email, provisioned, note },
    },
  })
})

router.post('/signout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions())
  res.status(204).end()
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)

  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Account not found. Sign in again.')
  }

  res.json({ data: { user } })
})

router.patch('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)

  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Account not found. Sign in again.')
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''

  if (name.length < 2 || name.length > 80) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Enter your full name.', [
      { field: 'name', message: 'Between 2 and 80 characters.' },
    ])
  }

  user.name = name
  await user.save()

  res.json({ data: { user } })
})

router.post('/password/change', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('+passwordHash')

  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Account not found. Sign in again.')
  }

  const currentPassword =
    typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''

  if (newPassword.length < 8) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters.', [
      { field: 'newPassword', message: 'At least 8 characters.' },
    ])
  }

  if (user.passwordHash) {
    const matches = await bcrypt.compare(currentPassword, user.passwordHash)

    if (!matches) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Your current password is not correct.')
    }
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10)
  await user.save()

  res.json({ data: { updated: true } })
})

module.exports = router
