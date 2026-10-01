/**
 * Emergency layer: SOS, ambulance requests, dispatch, and live tracking.
 *
 * One record carries the whole story — who raised it, where the pickup is, which
 * ambulance took it, every position update, and the status ladder — so the patient,
 * the family and the hospital are all reading the same thing.
 */

const express = require('express')
const mongoose = require('mongoose')
const Ambulance = require('../models/ambulance')
const EmergencyRequest = require('../models/emergency-request')
const Hospital = require('../models/hospital')
const OutboxMessage = require('../models/outbox-message')
const PatientProfile = require('../models/patient-profile')
const SubscriptionRequest = require('../models/subscription-request')
const HttpError = require('../lib/http-error')
const audit = require('../lib/audit')
const jobs = require('../lib/queue')
const { clinicalGraph } = require('../knowledge/store')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

const SEVERITY_BY_URGENCY = { emergency: 'critical', urgent: 'high', soon: 'moderate', routine: 'low' }
const LADDER = ['raised', 'acknowledged', 'dispatched', 'en_route', 'on_scene', 'transporting', 'arrived', 'completed']

function haversineKm(from, to) {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null

  const toRad = (value) => (value * Math.PI) / 180
  const R = 6371
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2

  return Math.round(R * 2 * Math.asin(Math.sqrt(a)) * 10) / 10
}

function etaMinutes(km) {
  if (km === null) return null
  return Math.max(2, Math.round((km / 30) * 60))
}

async function scopeHospital(req) {
  const hospital = await Hospital.findOne({ owner: req.user.id })
  if (!hospital) throw new HttpError(403, 'FORBIDDEN', 'No hospital is linked to this account.')
  return hospital
}

function note(request, status, by, text = '') {
  request.status = status
  request.timeline.push({ status, at: new Date(), by, note: text })
}

async function notifyRelatives(request, message) {
  const profile = request.patientUser ? await PatientProfile.findOne({ patient: request.patientUser }) : null
  const numbers = new Set(
    [profile?.emergencyContact?.phone, request.relativePhone].filter((value) => typeof value === 'string' && value.trim()),
  )

  for (const phone of numbers) {
    await OutboxMessage.create({
      phone: phone.trim(),
      text: message,
      kind: 'escalation',
      patientName: request.patientName,
    })
    request.relativesNotified.push(phone.trim())
  }

  return [...numbers]
}

async function nearestHospital(point, preferredId) {
  if (preferredId && mongoose.isValidObjectId(preferredId)) {
    const chosen = await Hospital.findOne({ _id: preferredId, status: 'approved' })
    if (chosen) return chosen
  }

  const hospitals = await Hospital.find({ status: 'approved' }).select('name city area location')

  if (!point?.lat || !point?.lng) return hospitals[0] ?? null

  const ranked = hospitals
    .map((hospital) => ({
      hospital,
      km: haversineKm(point, { lat: hospital.location?.lat, lng: hospital.location?.lng }),
    }))
    .filter((entry) => entry.km !== null)
    .sort((left, right) => left.km - right.km)

  return ranked[0]?.hospital ?? hospitals[0] ?? null
}

/** Raise an emergency. Used by both SOS and the ambulance request button. */
async function raise(req, res, kind) {
  const lat = Number.isFinite(Number(req.body?.lat)) ? Number(req.body.lat) : null
  const lng = Number.isFinite(Number(req.body?.lng)) ? Number(req.body.lng) : null
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : ''

  const resolution = reason ? clinicalGraph.resolve(reason) : { concepts: [] }
  const symptoms = resolution.concepts.filter((concept) => concept.type === 'Symptom').map((concept) => concept.id)
  const urgency = clinicalGraph.urgencyFor(symptoms)

  const hospital = await nearestHospital({ lat, lng }, req.body?.hospitalId)

  if (!hospital) {
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'No hospital is available to take this request.')
  }

  const request = await EmergencyRequest.create({
    kind,
    patientUser: req.user.role === 'patient' ? req.user.id : null,
    patientName: typeof req.body?.patientName === 'string' && req.body.patientName.trim()
      ? req.body.patientName.trim().slice(0, 80)
      : req.user.name,
    patientPhone: typeof req.body?.patientPhone === 'string' ? req.body.patientPhone.trim().slice(0, 30) : '',
    raisedBy: req.user.role === 'patient' ? (req.body?.relativeName ? 'relative' : 'patient') : 'staff',
    relativeName: typeof req.body?.relativeName === 'string' ? req.body.relativeName.trim().slice(0, 80) : '',
    relativePhone: typeof req.body?.relativePhone === 'string' ? req.body.relativePhone.trim().slice(0, 30) : '',
    hospital: hospital._id,
    reason,
    concepts: symptoms,
    severity: SEVERITY_BY_URGENCY[urgency.level] ?? 'high',
    pickup: {
      label: typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 200) : '',
      lat,
      lng,
    },
    trail: lat && lng ? [{ lat, lng, by: 'patient' }] : [],
    timeline: [{ status: 'raised', at: new Date(), by: req.user.name, note: reason }],
  })

  const notified = await notifyRelatives(
    request,
    `Aurora emergency: an urgent ${kind === 'sos' ? 'SOS' : 'ambulance request'} was raised for ${
      request.patientName
    }${request.pickup.label ? ` at ${request.pickup.label}` : ''}. ${hospital.name} has been alerted.`,
  )

  request.hospitalNotified = true
  if (notified.length) request.timeline.push({ status: 'relatives_notified', by: 'Aurora', note: notified.join(', ') })
  await request.save()

  await jobs.publish({
    type: kind === 'sos' ? 'emergency.sos' : 'emergency.ambulance',
    hospitalId: String(hospital._id),
    patientName: request.patientName,
    severity: request.severity,
    reason,
  })

  await audit.record(req, {
    action: `emergency.${kind}_raised`,
    subjectType: 'EmergencyRequest',
    subjectId: request._id,
    hospital: hospital._id,
    summary: `${kind.toUpperCase()} for ${request.patientName} → ${hospital.name} (${request.severity})`,
  })

  res.status(201).json({
    data: {
      request,
      hospital: { id: hospital.id, name: hospital.name, city: hospital.city, phone: hospital.phone ?? '' },
      notified,
      redFlags: clinicalGraph.flagsFor(symptoms).map((flag) => flag.label),
    },
  })
}

router.use(requireAuth, requireRole('patient', 'hospital', 'admin', 'doctor'))

// ---------------------------------------------------------------- patient side

router.post('/sos', async (req, res) => raise(req, res, 'sos'))
router.post('/ambulance', async (req, res) => raise(req, res, 'ambulance'))

router.get('/mine', async (req, res) => {
  const requests = await EmergencyRequest.find({ patientUser: req.user.id })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('hospital', 'name city phone')
    .populate('ambulance', 'callSign vehicleNumber driverName driverPhone location')

  res.json({ data: requests, meta: { count: requests.length } })
})

/** Family-facing live view: status ladder, trail and the ambulance's position. */
router.get('/:requestId/track', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.requestId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Request not found.')
  }

  const request = await EmergencyRequest.findById(req.params.requestId)
    .populate('hospital', 'name city phone')
    .populate('ambulance', 'callSign vehicleNumber driverName driverPhone location status')

  if (!request) throw new HttpError(404, 'NOT_FOUND', 'Request not found.')

  const isOwner = String(request.patientUser) === String(req.user.id)
  const isStaff = ['hospital', 'admin', 'doctor'].includes(req.user.role)

  if (!isOwner && !isStaff) {
    throw new HttpError(403, 'FORBIDDEN', 'That request is not yours.')
  }

  const ambulancePoint = request.ambulance?.location?.lat
    ? { lat: request.ambulance.location.lat, lng: request.ambulance.location.lng }
    : null

  const km = ambulancePoint && request.pickup?.lat ? haversineKm(ambulancePoint, request.pickup) : null

  res.json({
    data: {
      request,
      live: {
        status: request.status,
        ladder: LADDER.map((step) => ({
          step,
          reached: LADDER.indexOf(request.status) >= LADDER.indexOf(step),
          at: request.timeline.find((entry) => entry.status === step)?.at ?? null,
        })),
        ambulance: request.ambulance
          ? {
              callSign: request.ambulance.callSign,
              vehicleNumber: request.ambulance.vehicleNumber,
              driverName: request.ambulance.driverName,
              driverPhone: request.ambulance.driverPhone,
              lat: request.ambulance.location?.lat ?? null,
              lng: request.ambulance.location?.lng ?? null,
              updatedAt: request.ambulance.location?.updatedAt ?? null,
            }
          : null,
        distanceKm: km,
        etaMinutes: request.etaMinutes ?? etaMinutes(km),
        trail: request.trail.slice(-40),
      },
    },
  })
})

router.post('/:requestId/location', async (req, res) => {
  const lat = Number(req.body?.lat)
  const lng = Number(req.body?.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send lat and lng.')
  }

  const request = await EmergencyRequest.findOne({
    _id: mongoose.isValidObjectId(req.params.requestId) ? req.params.requestId : null,
    patientUser: req.user.id,
  })

  if (!request) throw new HttpError(404, 'NOT_FOUND', 'Request not found.')

  request.pickup.lat = lat
  request.pickup.lng = lng
  request.trail.push({ lat, lng, by: 'patient' })
  await request.save()

  res.json({ data: { trail: request.trail.slice(-10) } })
})

router.post('/:requestId/cancel', async (req, res) => {
  const request = await EmergencyRequest.findOne({
    _id: mongoose.isValidObjectId(req.params.requestId) ? req.params.requestId : null,
    $or: [{ patientUser: req.user.id }, { patientPhone: req.user.phone ?? '' }],
  })

  if (!request) throw new HttpError(404, 'NOT_FOUND', 'Request not found.')

  if (['completed', 'cancelled'].includes(request.status)) {
    throw new HttpError(409, 'CONFLICT', 'That request is already closed.')
  }

  note(request, 'cancelled', req.user.name, typeof req.body?.reason === 'string' ? req.body.reason : '')
  await request.save()

  if (request.ambulance) {
    await Ambulance.updateOne({ _id: request.ambulance }, { status: 'returning' })
  }

  await audit.record(req, {
    action: 'emergency.cancelled',
    subjectType: 'EmergencyRequest',
    subjectId: request._id,
    hospital: request.hospital,
    summary: `Cancelled by ${req.user.name}`,
  })

  res.json({ data: request })
})

// ---------------------------------------------------------------- hospital side

router.get('/ambulances', requireRole('hospital', 'admin'), async (req, res) => {
  const hospital = await scopeHospital(req)
  const fleet = await Ambulance.find({ hospital: hospital._id }).sort({ callSign: 1 })

  res.json({
    data: fleet,
    meta: {
      count: fleet.length,
      available: fleet.filter((ambulance) => ambulance.status === 'available').length,
      out: fleet.filter((ambulance) => ['dispatched', 'on_scene', 'returning'].includes(ambulance.status)).length,
    },
  })
})

router.post('/ambulances', requireRole('hospital', 'admin'), async (req, res) => {
  const hospital = await scopeHospital(req)
  const callSign = typeof req.body?.callSign === 'string' ? req.body.callSign.trim().slice(0, 40) : ''

  if (!callSign) throw new HttpError(400, 'VALIDATION_ERROR', 'An ambulance needs a call sign.')

  const ambulance = await Ambulance.findOneAndUpdate(
    { hospital: hospital._id, callSign },
    {
      hospital: hospital._id,
      callSign,
      vehicleNumber: typeof req.body?.vehicleNumber === 'string' ? req.body.vehicleNumber.trim().slice(0, 40) : '',
      kind: ['basic', 'advanced', 'neonatal', 'patient_transport'].includes(req.body?.kind)
        ? req.body.kind
        : 'basic',
      crew: Array.isArray(req.body?.crew) ? req.body.crew.filter((item) => typeof item === 'string').slice(0, 6) : [],
      driverName: typeof req.body?.driverName === 'string' ? req.body.driverName.trim().slice(0, 80) : '',
      driverPhone: typeof req.body?.driverPhone === 'string' ? req.body.driverPhone.trim().slice(0, 30) : '',
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  await audit.record(req, {
    action: 'ambulance.registered',
    subjectType: 'Ambulance',
    subjectId: ambulance._id,
    hospital: hospital._id,
    summary: `Registered ${callSign}`,
  })

  res.status(201).json({ data: ambulance })
})

router.patch('/ambulances/:ambulanceId', requireRole('hospital', 'admin'), async (req, res) => {
  const hospital = await scopeHospital(req)
  const update = {}

  if (['available', 'dispatched', 'on_scene', 'returning', 'maintenance', 'offline'].includes(req.body?.status)) {
    update.status = req.body.status
  }

  if (Number.isFinite(Number(req.body?.lat)) && Number.isFinite(Number(req.body?.lng))) {
    update.location = { lat: Number(req.body.lat), lng: Number(req.body.lng), updatedAt: new Date() }
  }

  if (typeof req.body?.driverName === 'string') update.driverName = req.body.driverName.slice(0, 80)
  if (typeof req.body?.driverPhone === 'string') update.driverPhone = req.body.driverPhone.slice(0, 30)

  const ambulance = await Ambulance.findOneAndUpdate(
    { _id: mongoose.isValidObjectId(req.params.ambulanceId) ? req.params.ambulanceId : null, hospital: hospital._id },
    update,
    { new: true },
  )

  if (!ambulance) throw new HttpError(404, 'NOT_FOUND', 'Ambulance not found.')

  res.json({ data: ambulance })
})

router.get('/requests', requireRole('hospital', 'admin'), async (req, res) => {
  const hospital = req.user.role === 'admin' ? null : await scopeHospital(req)
  const filter = {}

  if (hospital) filter.hospital = hospital._id
  if (req.query.open === 'true') filter.status = { $nin: ['completed', 'cancelled'] }
  if (req.query.kind && ['sos', 'ambulance'].includes(req.query.kind)) filter.kind = req.query.kind

  const requests = await EmergencyRequest.find(filter)
    .sort({ severity: 1, createdAt: -1 })
    .limit(60)
    .populate('ambulance', 'callSign status location')

  res.json({
    data: requests,
    meta: {
      count: requests.length,
      waiting: requests.filter((entry) => entry.status === 'raised').length,
      active: requests.filter((entry) => !['completed', 'cancelled'].includes(entry.status)).length,
    },
  })
})

/** The dispatch ladder: acknowledge → assign an ambulance → move it along → close. */
router.patch('/requests/:requestId', requireRole('hospital', 'admin'), async (req, res) => {
  const hospital = req.user.role === 'admin' ? null : await scopeHospital(req)

  const request = await EmergencyRequest.findOne({
    _id: mongoose.isValidObjectId(req.params.requestId) ? req.params.requestId : null,
    ...(hospital ? { hospital: hospital._id } : {}),
  })

  if (!request) throw new HttpError(404, 'NOT_FOUND', 'Request not found.')

  const action = req.body?.action
  const actor = req.user.name

  if (action === 'acknowledge') {
    request.acknowledgedBy = actor
    note(request, 'acknowledged', actor, 'Hospital has seen the request')
  } else if (action === 'dispatch') {
    const ambulance = await Ambulance.findOne({
      _id: mongoose.isValidObjectId(req.body?.ambulanceId) ? req.body.ambulanceId : null,
      hospital: request.hospital,
    })

    if (!ambulance) throw new HttpError(404, 'NOT_FOUND', 'Choose one of this hospital’s ambulances.')
    if (ambulance.status === 'dispatched') throw new HttpError(409, 'CONFLICT', 'That ambulance is already out.')

    ambulance.status = 'dispatched'
    await ambulance.save()

    request.ambulance = ambulance._id
    request.ambulanceCallSign = ambulance.callSign
    request.dispatchedBy = actor
    request.etaMinutes = etaMinutes(
      haversineKm(
        { lat: ambulance.location?.lat, lng: ambulance.location?.lng },
        { lat: request.pickup?.lat, lng: request.pickup?.lng },
      ),
    )

    note(request, 'dispatched', actor, `${ambulance.callSign} dispatched`)

    await notifyRelatives(
      request,
      `Aurora: ${ambulance.callSign} is on the way to ${
        request.pickup?.label || 'the pickup point'
      }${request.etaMinutes ? `, about ${request.etaMinutes} minutes` : ''}.`,
    )
  } else if (LADDER.includes(action)) {
    note(request, action, actor, typeof req.body?.note === 'string' ? req.body.note : '')

    if (action === 'on_scene' && request.ambulance) {
      await Ambulance.updateOne({ _id: request.ambulance }, { status: 'on_scene' })
    }

    if (action === 'transporting' && request.ambulance) {
      await Ambulance.updateOne({ _id: request.ambulance }, { status: 'dispatched' })
    }

    if (action === 'completed') {
      request.completedBy = actor
      request.outcome = typeof req.body?.outcome === 'string' ? req.body.outcome.slice(0, 300) : ''

      if (request.ambulance) {
        await Ambulance.updateOne({ _id: request.ambulance }, { status: 'available' })
      }
    }
  } else {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send a valid action.', [
      { field: 'action', message: 'acknowledge, dispatch, or a status in the ladder.' },
    ])
  }

  await request.save()

  await audit.record(req, {
    action: `emergency.${action ?? 'updated'}`,
    subjectType: 'EmergencyRequest',
    subjectId: request._id,
    hospital: request.hospital,
    summary: `${request.patientName}: ${action}`,
  })

  res.json({ data: request })
})

/** Ambulance position updates while it moves — this is what tracking reads. */
router.post('/requests/:requestId/ambulance-location', requireRole('hospital', 'admin'), async (req, res) => {
  const hospital = req.user.role === 'admin' ? null : await scopeHospital(req)
  const lat = Number(req.body?.lat)
  const lng = Number(req.body?.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send lat and lng.')
  }

  const request = await EmergencyRequest.findOne({
    _id: mongoose.isValidObjectId(req.params.requestId) ? req.params.requestId : null,
    ...(hospital ? { hospital: hospital._id } : {}),
  })

  if (!request) throw new HttpError(404, 'NOT_FOUND', 'Request not found.')

  request.trail.push({ lat, lng, by: 'ambulance' })

  if (request.status === 'dispatched') {
    note(request, 'en_route', req.user.name, 'Ambulance moving')
  }

  const km = haversineKm({ lat, lng }, { lat: request.pickup?.lat, lng: request.pickup?.lng })
  request.etaMinutes = etaMinutes(km)

  await request.save()

  if (request.ambulance) {
    await Ambulance.updateOne(
      { _id: request.ambulance },
      { location: { lat, lng, updatedAt: new Date() }, status: 'dispatched' },
    )
  }

  res.json({ data: { status: request.status, etaMinutes: request.etaMinutes, distanceKm: km } })
})

// ---------------------------------------------------------------- plan requests

/** A hospital asks the platform for a plan change; the admin verifies the money. */
router.post('/subscription-request', requireRole('hospital', 'admin'), async (req, res) => {
  const hospital = await scopeHospital(req)
  const requestedPlan = typeof req.body?.requestedPlan === 'string' ? req.body.requestedPlan.trim().slice(0, 40) : ''

  if (!requestedPlan) throw new HttpError(400, 'VALIDATION_ERROR', 'Choose the plan you want.')

  const open = await SubscriptionRequest.findOne({ hospital: hospital._id, status: 'pending' })

  if (open) {
    throw new HttpError(409, 'CONFLICT', 'You already have a request waiting on the admin.')
  }

  const request = await SubscriptionRequest.create({
    hospital: hospital._id,
    requestedBy: req.user.id,
    requestedByName: req.user.name,
    currentPlan: hospital.subscription?.plan ?? 'starter',
    requestedPlan,
    requestedTheme: typeof req.body?.requestedTheme === 'string' ? req.body.requestedTheme.slice(0, 40) : '',
    billingCycle: req.body?.billingCycle === 'yearly' ? 'yearly' : 'monthly',
    amount: Math.max(0, Number(req.body?.amount) || 0),
    currency: typeof req.body?.currency === 'string' ? req.body.currency.slice(0, 6) : 'PKR',
    note: typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 400) : '',
    payment: {
      method: ['bank_transfer', 'card', 'cash', 'cheque', 'online'].includes(req.body?.paymentMethod)
        ? req.body.paymentMethod
        : 'bank_transfer',
      reference: typeof req.body?.paymentReference === 'string' ? req.body.paymentReference.slice(0, 80) : '',
      paidAt: req.body?.paidAt ? new Date(req.body.paidAt) : null,
      proofUrl: typeof req.body?.proofUrl === 'string' ? req.body.proofUrl.slice(0, 400) : '',
    },
  })

  await audit.record(req, {
    action: 'subscription.requested',
    subjectType: 'SubscriptionRequest',
    subjectId: request._id,
    hospital: hospital._id,
    summary: `${hospital.name} asked for ${requestedPlan} (${request.amount} ${request.currency})`,
  })

  await jobs.publish({ type: 'subscription.requested', hospitalId: String(hospital._id), severity: 'low', step: requestedPlan })

  res.status(201).json({ data: request })
})

router.get('/subscription-requests', async (req, res) => {
  const hospital = req.user.role === 'admin' ? null : await scopeHospital(req)
  const requests = await SubscriptionRequest.find(hospital ? { hospital: hospital._id } : {})
    .sort({ createdAt: -1 })
    .limit(30)
    .populate('hospital', 'name city')

  res.json({ data: requests, meta: { count: requests.length } })
})

module.exports = router
