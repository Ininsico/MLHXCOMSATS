const express = require('express')
const mongoose = require('mongoose')
const Appointment = require('../models/appointment')
const Hospital = require('../models/hospital')
const Staff = require('../models/staff')
const HttpError = require('../lib/http-error')
const { TIMES } = require('../lib/slots')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')
const requireHospital = require('../middleware/require-hospital')

const router = express.Router()

const STATUSES = ['requested', 'confirmed', 'completed', 'cancelled']

router.use(requireAuth)

const asHospital = [requireRole('hospital'), requireHospital]
const asPatient = requireRole('patient', 'admin')

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function readSlot(body) {
  const details = []
  const raw = {}

  const date = typeof body?.date === 'string' ? body.date.trim() : ''
  if (!DATE_PATTERN.test(date)) {
    details.push({ field: 'date', message: 'Pick a date.' })
  } else if (date < new Date().toISOString().slice(0, 10)) {
    details.push({ field: 'date', message: 'Pick a date from today onwards.' })
  } else {
    raw.date = date
  }

  const time = typeof body?.time === 'string' ? body.time.trim() : ''
  if (!TIMES.includes(time)) {
    details.push({ field: 'time', message: 'Pick one of the available times.' })
  } else {
    raw.time = time
  }

  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (reason.length < 5 || reason.length > 300) {
    details.push({ field: 'reason', message: 'Describe the reason in 5-300 characters.' })
  } else {
    raw.reason = reason
  }

  return { raw, details }
}

async function assignedDoctor(hospitalId, doctorId) {
  if (!doctorId || !mongoose.isValidObjectId(doctorId)) return null

  return Staff.findOne({ _id: doctorId, hospital: hospitalId, role: 'doctor' })
}

function readDoctorId(body) {
  return typeof body?.doctorId === 'string' && body.doctorId ? body.doctorId : null
}

async function createAppointment({ hospital, doctor, body, patientUser, source }) {
  const { raw, details } = readSlot(body)

  if (!doctor) {
    details.push({ field: 'doctorId', message: 'Choose a doctor.' })
  }

  const patientName =
    patientUser?.name ?? (typeof body?.patientName === 'string' ? body.patientName.trim() : '')

  if (patientName.length < 2 || patientName.length > 80) {
    details.push({ field: 'patientName', message: "Enter the patient's name (2-80 characters)." })
  }

  if (details.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Please check the booking and try again.', details)
  }

  const clash = await Appointment.exists({
    hospital: hospital._id,
    doctor: doctor._id,
    date: raw.date,
    time: raw.time,
    status: { $ne: 'cancelled' },
  })

  if (clash) {
    throw new HttpError(409, 'CONFLICT', 'That slot was just taken. Pick another time.')
  }

  return Appointment.create({
    hospital: hospital._id,
    doctor: doctor._id,
    doctorName: doctor.name,
    specialty: doctor.specialty ?? '',
    date: raw.date,
    time: raw.time,
    reason: raw.reason,
    patientUser: patientUser ?? null,
    patientName,
    patientPhone: typeof body?.patientPhone === 'string' ? body.patientPhone.trim().slice(0, 30) : '',
    source,
    aiNote: typeof body?.aiNote === 'string' ? body.aiNote.trim().slice(0, 300) : '',
  })
}

router.get('/mine', asPatient, async (req, res) => {
  const appointments = await Appointment.find({ patientUser: req.user.id })
    .populate('hospital', 'name city area subscription')
    .sort({ date: -1, time: -1 })
    .limit(50)

  res.json({ data: appointments, meta: { count: appointments.length } })
})

router.post('/mine', asPatient, async (req, res) => {
  const hospital = await Hospital.findOne({
    _id: mongoose.isValidObjectId(req.body?.hospitalId) ? req.body.hospitalId : null,
    status: 'approved',
  })

  if (!hospital) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  const doctor = await assignedDoctor(hospital._id, readDoctorId(req.body))
  const appointment = await createAppointment({
    hospital,
    doctor,
    body: req.body,
    patientUser: req.user,
    source: req.body?.source === 'ai' ? 'ai' : 'patient',
  })

  res.status(201).json({ data: { appointment } })
})

router.patch('/mine/:appointmentId', asPatient, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.appointmentId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Appointment not found.')
  }

  const appointment = await Appointment.findOne({
    _id: req.params.appointmentId,
    patientUser: req.user.id,
  })

  if (!appointment) {
    throw new HttpError(404, 'NOT_FOUND', 'Appointment not found.')
  }

  if (req.body?.status !== 'cancelled') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Patients can only cancel an appointment.', [
      { field: 'status', message: 'Use "cancelled".' },
    ])
  }

  appointment.status = 'cancelled'
  await appointment.save()

  res.json({ data: { appointment } })
})

router.get('/', asHospital, async (req, res) => {
  const filter = { hospital: req.hospital._id }
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status
  if (DATE_PATTERN.test(req.query.date ?? '')) filter.date = req.query.date

  const appointments = await Appointment.find(filter).sort({ date: 1, time: 1 }).limit(200)
  res.json({ data: appointments, meta: { count: appointments.length } })
})

router.post('/', asHospital, async (req, res) => {
  const doctor = await assignedDoctor(req.hospital._id, readDoctorId(req.body))
  const appointment = await createAppointment({
    hospital: req.hospital,
    doctor,
    body: req.body,
    patientUser: null,
    source: 'hospital',
  })

  res.status(201).json({ data: { appointment } })
})

router.patch('/:appointmentId', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.appointmentId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Appointment not found.')
  }

  const appointment = await Appointment.findOne({
    _id: req.params.appointmentId,
    hospital: req.hospital._id,
  })

  if (!appointment) {
    throw new HttpError(404, 'NOT_FOUND', 'Appointment not found.')
  }

  if (!STATUSES.includes(req.body?.status)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Unknown status.', [
      { field: 'status', message: `One of: ${STATUSES.join(', ')}.` },
    ])
  }

  appointment.status = req.body.status
  await appointment.save()

  res.json({ data: { appointment } })
})

module.exports = router
