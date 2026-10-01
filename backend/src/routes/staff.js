const express = require('express')
const mongoose = require('mongoose')
const Staff = require('../models/staff')
const User = require('../models/user')
const HttpError = require('../lib/http-error')
const { isSpecialty } = require('../lib/specialties')
const { sendEmailQuietly } = require('../lib/mailer')
const { doctorInviteEmail } = require('../lib/emails')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')
const requireHospital = require('../middleware/require-hospital')

const router = express.Router()

const ROLES = ['doctor', 'radiologist', 'nurse', 'receptionist', 'lab', 'admin']
const STATUSES = ['active', 'leave', 'inactive']

router.use(requireAuth, requireRole('hospital'), requireHospital)

function readStaff(body, { partial = false, existing = null } = {}) {
  const details = []
  const updates = {}

  function takeText(field, min, max, required) {
    const value = body?.[field]
    if (value === undefined) {
      if (required && !partial) details.push({ field, message: 'Required.' })
      return
    }
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (trimmed.length < min || trimmed.length > max) {
      details.push({ field, message: `Must be ${min}-${max} characters.` })
      return
    }
    updates[field] = trimmed
  }

  takeText('name', 2, 80, true)
  takeText('email', 0, 120, false)
  takeText('phone', 0, 30, false)
  takeText('department', 0, 80, false)

  if (body?.role !== undefined) {
    if (!ROLES.includes(body.role)) {
      details.push({ field: 'role', message: `Choose one of: ${ROLES.join(', ')}.` })
    } else {
      updates.role = body.role
    }
  } else if (!partial) {
    details.push({ field: 'role', message: 'Required.' })
  }

  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      details.push({ field: 'status', message: `Choose one of: ${STATUSES.join(', ')}.` })
    } else {
      updates.status = body.status
    }
  }

  if (body?.specialty !== undefined) {
    const specialty = typeof body.specialty === 'string' ? body.specialty.trim() : ''

    if (specialty === '') {
      updates.specialty = ''
    } else if (!isSpecialty(specialty)) {
      details.push({ field: 'specialty', message: 'Choose a specialty from the list.' })
    } else {
      updates.specialty = specialty
    }
  }

  const effectiveRole = updates.role ?? existing?.role ?? null

  if (effectiveRole === 'doctor') {
    const finalSpecialty = updates.specialty ?? existing?.specialty ?? ''
    if (!finalSpecialty) details.push({ field: 'specialty', message: 'Doctors need a specialty.' })
  } else if (updates.specialty) {
    updates.specialty = ''
  }

  if (details.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Please check the form and try again.', details)
  }

  return updates
}

async function linkDoctorAccount({ hospital, name, email }) {
  if (!email) return null

  const existing = await User.findOne({ email })

  if (existing) {
    if (existing.role !== 'doctor') {
      throw new HttpError(
        409,
        'CONFLICT',
        'That email already belongs to a different kind of account — use another one.',
      )
    }
    return existing
  }

  const user = await User.create({ name, email, role: 'doctor', status: 'active' })

  sendEmailQuietly({
    to: email,
    ...doctorInviteEmail({ doctorName: name, hospitalName: hospital.name }),
  })

  return user
}

router.get('/', async (req, res) => {
  const filter = { hospital: req.hospital._id }
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  if (ROLES.includes(req.query.role)) filter.role = req.query.role
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status
  if (q) filter.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

  const staff = await Staff.find(filter).sort({ role: 1, name: 1 })
  res.json({ data: staff, meta: { count: staff.length } })
})

router.post('/', async (req, res) => {
  const updates = readStaff(req.body)

  if (updates.email && (await Staff.exists({ hospital: req.hospital._id, email: updates.email }))) {
    throw new HttpError(409, 'CONFLICT', 'That email is already on your team.')
  }

  const linkedUser =
    updates.role === 'doctor' && updates.email
      ? await linkDoctorAccount({
          hospital: req.hospital,
          name: updates.name,
          email: updates.email,
        })
      : null

  const member = await Staff.create({
    ...updates,
    hospital: req.hospital._id,
    user: linkedUser?._id ?? null,
  })

  res.status(201).json({ data: member, meta: { accountLinked: Boolean(linkedUser) } })
})

router.patch('/:staffId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.staffId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Staff member not found.')
  }

  const member = await Staff.findOne({ _id: req.params.staffId, hospital: req.hospital._id })
  if (!member) {
    throw new HttpError(404, 'NOT_FOUND', 'Staff member not found.')
  }

  const updates = readStaff(req.body, { partial: true, existing: member })

  if (
    updates.email &&
    updates.email !== member.email &&
    (await Staff.exists({ hospital: req.hospital._id, email: updates.email, _id: { $ne: member._id } }))
  ) {
    throw new HttpError(409, 'CONFLICT', 'That email is already on your team.')
  }

  member.set(updates)

  const effectiveRole = updates.role ?? member.role
  const effectiveEmail = updates.email ?? member.email

  if (effectiveRole === 'doctor' && effectiveEmail && !member.user) {
    const linkedUser = await linkDoctorAccount({
      hospital: req.hospital,
      name: member.name,
      email: effectiveEmail,
    })
    member.user = linkedUser?._id ?? null
  }

  if (member.user && updates.name) {
    await User.findByIdAndUpdate(member.user, { name: updates.name })
  }

  await member.save()
  res.json({ data: member })
})

router.delete('/:staffId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.staffId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Staff member not found.')
  }

  const removed = await Staff.findOneAndDelete({
    _id: req.params.staffId,
    hospital: req.hospital._id,
  })

  if (!removed) {
    throw new HttpError(404, 'NOT_FOUND', 'Staff member not found.')
  }

  res.status(204).end()
})

module.exports = router
