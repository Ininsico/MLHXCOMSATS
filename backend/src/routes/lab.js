const express = require('express')
const mongoose = require('mongoose')
const LabTest = require('../models/lab-test')
const LabOrder = require('../models/lab-order')
const User = require('../models/user')
const HttpError = require('../lib/http-error')
const { flagForValue } = require('../lib/lab')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')
const requireHospital = require('../middleware/require-hospital')

const router = express.Router()

const ORDER_STATUSES = ['requested', 'collected', 'processing', 'completed', 'sent', 'cancelled']

router.use(requireAuth)

const asHospital = [requireRole('hospital'), requireHospital]

function text(value, min, max) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null
}

function readParameters(input) {
  if (!Array.isArray(input)) return null
  if (input.length > 20) return null

  const parameters = []

  for (const item of input) {
    const name = text(item?.name, 2, 60)
    if (!name) return null

    const unit = typeof item?.unit === 'string' ? item.unit.trim().slice(0, 20) : ''
    const low = item?.referenceLow === null || item?.referenceLow === undefined || item?.referenceLow === ''
      ? null
      : Number(item.referenceLow)
    const high = item?.referenceHigh === null || item?.referenceHigh === undefined || item?.referenceHigh === ''
      ? null
      : Number(item.referenceHigh)

    if (low !== null && !Number.isFinite(low)) return null
    if (high !== null && !Number.isFinite(high)) return null

    parameters.push({ name, unit, referenceLow: low, referenceHigh: high })
  }

  return parameters
}

function readResults(input) {
  if (!Array.isArray(input)) return null
  if (input.length > 20) return null

  const results = []

  for (const item of input) {
    const parameter = text(item?.parameter, 2, 60)
    if (!parameter) return null

    const value = typeof item?.value === 'string' ? item.value.trim().slice(0, 40) : ''
    const unit = typeof item?.unit === 'string' ? item.unit.trim().slice(0, 20) : ''
    const low = item?.referenceLow === null || item?.referenceLow === undefined || item?.referenceLow === ''
      ? null
      : Number(item.referenceLow)
    const high = item?.referenceHigh === null || item?.referenceHigh === undefined || item?.referenceHigh === ''
      ? null
      : Number(item.referenceHigh)

    if (low !== null && !Number.isFinite(low)) return null
    if (high !== null && !Number.isFinite(high)) return null

    results.push({
      parameter,
      value,
      unit,
      referenceLow: low,
      referenceHigh: high,
      flag: flagForValue(value, low, high),
    })
  }

  return results
}

router.get('/tests', asHospital, async (req, res) => {
  const tests = await LabTest.find({ hospital: req.hospital._id }).sort({ name: 1 })
  res.json({ data: tests, meta: { count: tests.length } })
})

router.post('/tests', asHospital, async (req, res) => {
  const name = text(req.body?.name, 2, 120)
  const category = text(req.body?.category, 2, 60) ?? 'General'
  const sampleType = text(req.body?.sampleType, 2, 40) ?? 'Blood'
  const price = Number(req.body?.price ?? 0)
  const turnaroundHours = Number(req.body?.turnaroundHours ?? 24)
  const parameters = req.body?.parameters === undefined ? [] : readParameters(req.body.parameters)

  if (!name) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Enter the test name.', [
      { field: 'name', message: '2-120 characters.' },
    ])
  }
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Enter a price.', [
      { field: 'price', message: 'A number from 0 upwards.' },
    ])
  }
  if (!Number.isFinite(turnaroundHours) || turnaroundHours < 1 || turnaroundHours > 720) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Enter the turnaround time in hours.', [
      { field: 'turnaroundHours', message: 'Between 1 and 720 hours.' },
    ])
  }
  if (parameters === null) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Check the test parameters.', [
      { field: 'parameters', message: 'Up to 20 rows of name, unit, low and high.' },
    ])
  }

  const test = await LabTest.create({
    hospital: req.hospital._id,
    name,
    category,
    sampleType,
    price,
    turnaroundHours,
    parameters,
  })

  res.status(201).json({ data: test })
})

router.patch('/tests/:testId', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.testId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Test not found.')
  }

  const test = await LabTest.findOne({ _id: req.params.testId, hospital: req.hospital._id })
  if (!test) {
    throw new HttpError(404, 'NOT_FOUND', 'Test not found.')
  }

  if (typeof req.body?.active === 'boolean') test.active = req.body.active

  const name = text(req.body?.name, 2, 120)
  if (name) test.name = name

  const category = text(req.body?.category, 2, 60)
  if (category) test.category = category

  const sampleType = text(req.body?.sampleType, 2, 40)
  if (sampleType) test.sampleType = sampleType

  const price = Number(req.body?.price)
  if (Number.isFinite(price) && price >= 0) test.price = price

  if (req.body?.parameters !== undefined) {
    const parameters = readParameters(req.body.parameters)

    if (parameters === null) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Check the test parameters.', [
        { field: 'parameters', message: 'Up to 20 rows of name, unit, low and high.' },
      ])
    }

    test.parameters = parameters
  }

  await test.save()
  res.json({ data: test })
})

router.get('/orders', asHospital, async (req, res) => {
  const filter = { hospital: req.hospital._id }
  if (ORDER_STATUSES.includes(req.query.status)) filter.status = req.query.status

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (q) filter.patientName = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

  const orders = await LabOrder.find(filter).sort({ createdAt: -1 }).limit(150)
  res.json({ data: orders, meta: { count: orders.length } })
})

router.post('/orders', asHospital, async (req, res) => {
  const testId = req.body?.testId
  const patientName = text(req.body?.patientName, 2, 80)

  if (!mongoose.isValidObjectId(testId)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a test.', [
      { field: 'testId', message: 'Pick a test from your catalogue.' },
    ])
  }
  if (!patientName) {
    throw new HttpError(400, 'VALIDATION_ERROR', "Enter the patient's name.", [
      { field: 'patientName', message: '2-80 characters.' },
    ])
  }

  const test = await LabTest.findOne({ _id: testId, hospital: req.hospital._id })
  if (!test) {
    throw new HttpError(404, 'NOT_FOUND', 'Test not found.')
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
    hospital: req.hospital._id,
    test: test._id,
    testName: test.name,
    parameters: test.parameters,
    patientName,
    patientUser,
    priority: req.body?.priority === 'urgent' ? 'urgent' : 'routine',
    notes: text(req.body?.notes, 0, 300) ?? '',
    orderedBy: req.user.name ?? '',
  })

  res.status(201).json({ data: order })
})

router.patch('/orders/:orderId', asHospital, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orderId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Order not found.')
  }

  const order = await LabOrder.findOne({ _id: req.params.orderId, hospital: req.hospital._id })
  if (!order) {
    throw new HttpError(404, 'NOT_FOUND', 'Order not found.')
  }

  if (req.body?.results !== undefined) {
    const results = readResults(req.body.results)

    if (results === null) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Check the result values.', [
        { field: 'results', message: 'Up to 20 rows of parameter and value.' },
      ])
    }

    order.results = results
  }

  if (req.body?.resultSummary !== undefined) {
    const summary = text(req.body.resultSummary, 0, 600)
    if (summary === null) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Result summary is too long.', [
        { field: 'resultSummary', message: 'Up to 600 characters.' },
      ])
    }
    order.resultSummary = summary
  }

  if (req.body?.status !== undefined) {
    if (!ORDER_STATUSES.includes(req.body.status)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Unknown status.', [
        { field: 'status', message: `One of: ${ORDER_STATUSES.join(', ')}.` },
      ])
    }

    if (req.body.status === 'completed' && !order.results.length && !order.resultSummary) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Enter the results (or a summary) before completing the order.',
        [{ field: 'results', message: 'At least one result or a summary is required.' }],
      )
    }

    order.status = req.body.status
    if (order.status === 'collected' && !order.collectedAt) order.collectedAt = new Date()
    if (order.status === 'completed' && !order.completedAt) order.completedAt = new Date()
  }

  await order.save()
  res.json({ data: order })
})

router.get('/mine', requireRole('patient', 'admin'), async (req, res) => {
  const orders = await LabOrder.find({ patientUser: req.user.id })
    .populate('hospital', 'name city area logoUrl')
    .sort({ createdAt: -1 })
    .limit(50)

  const data = orders.map((order) => {
    const plain = order.toJSON()
    const released = plain.status === 'sent'

    return {
      ...plain,
      results: released ? plain.results : [],
      resultSummary: released ? plain.resultSummary : '',
      interpretation: released ? plain.interpretation : '',
    }
  })

  res.json({ data, meta: { count: data.length } })
})

router.get('/mine/:orderId', requireRole('patient', 'admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orderId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Report not found.')
  }

  const order = await LabOrder.findOne({
    _id: req.params.orderId,
    patientUser: req.user.id,
    status: 'sent',
  }).populate('hospital', 'name city area address phone logoUrl verification')

  if (!order) {
    throw new HttpError(404, 'NOT_FOUND', 'That report is not available yet.')
  }

  res.json({ data: { report: order } })
})

module.exports = router
