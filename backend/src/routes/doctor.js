const express = require('express')
const mongoose = require('mongoose')
const Staff = require('../models/staff')
const Appointment = require('../models/appointment')
const LabTest = require('../models/lab-test')
const LabOrder = require('../models/lab-order')
const User = require('../models/user')
const HttpError = require('../lib/http-error')
const { isSpecialty } = require('../lib/specialties')
const { localDate } = require('../lib/slots')
const { sendEmailQuietly } = require('../lib/mailer')
const { labReportReadyEmail } = require('../lib/emails')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

const STATUSES = ['requested', 'confirmed', 'completed', 'cancelled']

router.use(requireAuth, requireRole('doctor'))

async function myStaff(req) {
  const staff = await Staff.findOne({ user: req.user.id }).populate(
    'hospital',
    'name city area phone logoUrl',
  )

  if (!staff) {
    throw new HttpError(
      404,
      'NOT_FOUND',
      'No doctor profile is linked to this account yet — ask your hospital to add you.',
    )
  }

  return staff
}

router.get('/me', async (req, res) => {
  const staff = await myStaff(req)
  res.json({ data: { staff, hospital: staff.hospital } })
})

router.get('/appointments', async (req, res) => {
  const staff = await myStaff(req)
  const filter = { doctor: staff._id }

  if (STATUSES.includes(req.query.status)) filter.status = req.query.status
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.date ?? '')) filter.date = req.query.date

  const appointments = await Appointment.find(filter).sort({ date: 1, time: 1 }).limit(200)
  res.json({ data: appointments, meta: { count: appointments.length } })
})

router.get('/timetable', async (req, res) => {
  const staff = await myStaff(req)
  const days = Math.min(14, Math.max(1, Number(req.query.days) || 7))
  const start = new Date()
  const dates = []

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + offset)
    dates.push(localDate(day))
  }

  const appointments = await Appointment.find({
    doctor: staff._id,
    date: { $in: dates },
    status: { $ne: 'cancelled' },
  }).sort({ date: 1, time: 1 })

  res.json({
    data: {
      staff: { id: staff.id, name: staff.name, specialty: staff.specialty },
      days: dates.map((date) => ({
        date,
        items: appointments.filter((item) => item.date === date),
      })),
    },
    meta: { count: appointments.length },
  })
})

router.patch('/appointments/:appointmentId', async (req, res) => {
  const staff = await myStaff(req)

  if (!mongoose.isValidObjectId(req.params.appointmentId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Appointment not found.')
  }

  const appointment = await Appointment.findOne({
    _id: req.params.appointmentId,
    doctor: staff._id,
  })

  if (!appointment) {
    throw new HttpError(404, 'NOT_FOUND', 'Appointment not found.')
  }

  if (!['confirmed', 'completed', 'cancelled'].includes(req.body?.status)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Use confirmed, completed, or cancelled.', [
      { field: 'status', message: 'Unknown status.' },
    ])
  }

  appointment.status = req.body.status
  await appointment.save()

  res.json({ data: { appointment } })
})

router.patch('/me', async (req, res) => {
  const staff = await myStaff(req)

  if (req.body?.phone !== undefined) {
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : ''
    if (phone.length > 30) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Phone numbers are up to 30 characters.', [
        { field: 'phone', message: 'Too long.' },
      ])
    }
    staff.phone = phone
  }

  if (req.body?.department !== undefined) {
    staff.department = typeof req.body.department === 'string'
      ? req.body.department.trim().slice(0, 80)
      : ''
  }

  if (req.body?.specialty !== undefined) {
    const specialty = typeof req.body.specialty === 'string' ? req.body.specialty.trim() : ''

    if (!isSpecialty(specialty)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a specialty from the list.', [
        { field: 'specialty', message: 'Unknown specialty.' },
      ])
    }

    staff.specialty = specialty
  }

  await staff.save()
  res.json({ data: { staff } })
})

router.get('/lab-tests', async (req, res) => {
  const staff = await myStaff(req)
  const tests = await LabTest.find({ hospital: staff.hospital?._id ?? staff.hospital, active: true }).sort(
    { name: 1 },
  )

  res.json({ data: tests, meta: { count: tests.length } })
})

router.get('/lab-orders', async (req, res) => {
  const staff = await myStaff(req)
  const filter = {
    $or: [
      { requestedByStaff: staff._id },
      { hospital: staff.hospital?._id ?? staff.hospital, status: { $in: ['completed', 'sent'] } },
    ],
  }

  if (['requested', 'collected', 'processing', 'completed', 'sent', 'cancelled'].includes(req.query.status)) {
    filter.status = req.query.status
  }

  const orders = await LabOrder.find(filter).sort({ createdAt: -1 }).limit(100)
  res.json({ data: orders, meta: { count: orders.length } })
})

router.post('/lab-orders', async (req, res) => {
  const staff = await myStaff(req)
  const hospitalId = staff.hospital?._id ?? staff.hospital

  if (!mongoose.isValidObjectId(req.body?.testId)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a test to request.', [
      { field: 'testId', message: 'Pick a test from the catalogue.' },
    ])
  }

  const test = await LabTest.findOne({ _id: req.body.testId, hospital: hospitalId })
  if (!test) {
    throw new HttpError(404, 'NOT_FOUND', 'Test not found.')
  }

  const patientName = typeof req.body?.patientName === 'string' ? req.body.patientName.trim() : ''

  if (patientName.length < 2 || patientName.length > 80) {
    throw new HttpError(400, 'VALIDATION_ERROR', "Enter the patient's name.", [
      { field: 'patientName', message: '2-80 characters.' },
    ])
  }

  const patientEmail = typeof req.body?.patientEmail === 'string'
    ? req.body.patientEmail.trim().toLowerCase()
    : ''
  let patientUser = null

  if (patientEmail) {
    const account = await User.findOne({ email: patientEmail })
    patientUser = account?._id ?? null
  }

  const order = await LabOrder.create({
    hospital: hospitalId,
    test: test._id,
    testName: test.name,
    parameters: test.parameters,
    patientName,
    patientUser,
    requestedByStaff: staff._id,
    priority: req.body?.priority === 'urgent' ? 'urgent' : 'routine',
    notes: typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 300) : '',
    orderedBy: staff.name,
  })

  res.status(201).json({ data: order })
})

router.patch('/lab-orders/:orderId', async (req, res) => {
  const staff = await myStaff(req)
  const hospitalId = staff.hospital?._id ?? staff.hospital

  if (!mongoose.isValidObjectId(req.params.orderId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Order not found.')
  }

  const order = await LabOrder.findOne({ _id: req.params.orderId, hospital: hospitalId })
  if (!order) {
    throw new HttpError(404, 'NOT_FOUND', 'Order not found.')
  }

  if (req.body?.interpretation !== undefined) {
    const interpretation = typeof req.body.interpretation === 'string'
      ? req.body.interpretation.trim()
      : ''

    if (interpretation.length > 600) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Keep the interpretation under 600 characters.', [
        { field: 'interpretation', message: 'Up to 600 characters.' },
      ])
    }

    order.interpretation = interpretation
  }

  if (req.body?.send === true) {
    if (order.status !== 'completed') {
      throw new HttpError(400, 'VALIDATION_ERROR', 'The laboratory has not completed this report yet.', [
        { field: 'status', message: 'Wait for the laboratory to complete the results.' },
      ])
    }
    if (!order.results.length && !order.resultSummary) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'There are no results to send yet.', [
        { field: 'results', message: 'The laboratory must record results first.' },
      ])
    }

    order.status = 'sent'
    order.sentAt = new Date()
    order.sentBy = staff.name
  }

  await order.save()

  if (order.status === 'sent' && order.patientUser) {
    const patient = await User.findById(order.patientUser).select('email name')

    if (patient?.email) {
      sendEmailQuietly({
        to: patient.email,
        ...labReportReadyEmail({
          patientName: patient.name,
          testName: order.testName,
          hospitalName: staff.hospital?.name ?? 'Your hospital',
          reportNumber: order.reportNumber,
        }),
      })
    }
  }

  res.json({ data: order })
})

module.exports = router
