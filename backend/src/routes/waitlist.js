/**
 * Hospital side of the waitlist: see who is waiting, and offer a freed slot down the
 * list. Offers expire on their own, so a slot never lodges with someone who has
 * stopped answering.
 */

const express = require('express')
const mongoose = require('mongoose')
const Hospital = require('../models/hospital')
const OutboxMessage = require('../models/outbox-message')
const PrevisitForm = require('../models/previsit-form')
const WaitlistEntry = require('../models/waitlist')
const HttpError = require('../lib/http-error')
const audit = require('../lib/audit')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

const OFFER_HOURS = Number(process.env.WAITLIST_OFFER_HOURS || 24)

router.use(requireAuth, requireRole('hospital', 'admin'))

async function scopeHospital(req) {
  if (req.user.role === 'admin' && mongoose.isValidObjectId(req.query.hospitalId)) {
    const hospital = await Hospital.findById(req.query.hospitalId)
    if (hospital) return hospital
  }

  const hospital = await Hospital.findOne({ owner: req.user.id })

  if (!hospital) throw new HttpError(403, 'FORBIDDEN', 'No hospital is linked to this account.')

  return hospital
}

/** Offers that were never answered release themselves. */
async function expireStaleOffers(hospitalId) {
  await WaitlistEntry.updateMany(
    {
      hospital: hospitalId,
      status: 'offered',
      'offer.expiresAt': { $lt: new Date() },
    },
    { $set: { status: 'waiting', offer: { date: '', time: '', doctorName: '', offeredAt: null, expiresAt: null, notified: false } } },
  )
}

router.get('/', async (req, res) => {
  const hospital = await scopeHospital(req)
  await expireStaleOffers(hospital._id)

  const filter = { hospital: hospital._id }
  if (['waiting', 'offered', 'accepted', 'expired', 'cancelled'].includes(req.query.status)) {
    filter.status = req.query.status
  }

  const entries = await WaitlistEntry.find(filter).sort({ status: 1, createdAt: 1 }).limit(100)

  res.json({
    data: entries,
    meta: {
      count: entries.length,
      waiting: entries.filter((entry) => entry.status === 'waiting').length,
      offered: entries.filter((entry) => entry.status === 'offered').length,
    },
  })
})

/** Offer a specific slot to the next person in line (optionally a chosen entry). */
router.post('/offer', async (req, res) => {
  const hospital = await scopeHospital(req)
  const date = typeof req.body?.date === 'string' ? req.body.date.slice(0, 10) : ''
  const time = typeof req.body?.time === 'string' ? req.body.time.slice(0, 5) : ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send the freed slot as date and time.')
  }

  await expireStaleOffers(hospital._id)

  let entry = null

  if (mongoose.isValidObjectId(req.body?.entryId)) {
    entry = await WaitlistEntry.findOne({ _id: req.body.entryId, hospital: hospital._id, status: 'waiting' })
  } else {
    const filter = { hospital: hospital._id, status: 'waiting' }
    if (typeof req.body?.specialty === 'string' && req.body.specialty) filter.specialty = req.body.specialty
    entry = await WaitlistEntry.findOne(filter).sort({ createdAt: 1 })
  }

  if (!entry) {
    throw new HttpError(404, 'NOT_FOUND', 'Nobody is waiting for that slot.')
  }

  entry.status = 'offered'
  entry.offer = {
    date,
    time,
    doctorName: typeof req.body?.doctorName === 'string' ? req.body.doctorName.slice(0, 80) : '',
    offeredAt: new Date(),
    expiresAt: new Date(Date.now() + OFFER_HOURS * 3600000),
    notified: false,
  }

  if (entry.patientPhone) {
    await OutboxMessage.create({
      phone: entry.patientPhone,
      text: `Aurora: a slot has opened at ${hospital.name} on ${date} at ${time}${
        entry.offer.doctorName ? ` with ${entry.offer.doctorName}` : ''
      }. Open the app to take it — it is held for ${OFFER_HOURS} hours.`,
      kind: 'notice',
      patientName: entry.patientName,
    })
    entry.offer.notified = true
  }

  await entry.save()

  await audit.record(req, {
    action: 'waitlist.offered',
    subjectType: 'WaitlistEntry',
    subjectId: entry._id,
    hospital: hospital._id,
    summary: `Offered ${date} ${time} to ${entry.patientName}`,
  })

  res.json({ data: entry })
})

/** What the patient wrote before the visit, so the desk can act on it. */
router.get('/previsit', async (req, res) => {
  const hospital = await scopeHospital(req)
  const forms = await PrevisitForm.find({ hospital: hospital._id }).sort({ submittedAt: -1 }).limit(50)

  res.json({ data: forms, meta: { count: forms.length } })
})

module.exports = router
