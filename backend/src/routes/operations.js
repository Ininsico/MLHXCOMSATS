/**
 * Hospital operations: ward board, admissions, billing with insurance claims,
 * equipment service history, emergency intake, and the analytics the dashboard reads.
 */

const express = require('express')
const mongoose = require('mongoose')
const Admission = require('../models/admission')
const Appointment = require('../models/appointment')
const Bed = require('../models/bed')
const EquipmentLog = require('../models/equipment-log')
const Hospital = require('../models/hospital')
const Intake = require('../models/intake')
const Invoice = require('../models/invoice')
const LabOrder = require('../models/lab-order')
const Review = require('../models/review')
const HttpError = require('../lib/http-error')
const audit = require('../lib/audit')
const { clinicalGraph } = require('../knowledge/store')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

router.use(requireAuth, requireRole('hospital', 'admin'))

async function scopeHospital(req, bodyId) {
  if (req.user.role === 'admin' && mongoose.isValidObjectId(bodyId)) {
    const hospital = await Hospital.findById(bodyId)
    if (hospital) return hospital
  }

  const hospital = await Hospital.findOne({ owner: req.user.id })

  if (!hospital) {
    throw new HttpError(403, 'FORBIDDEN', 'No hospital is linked to this account.')
  }

  return hospital
}

function shortNumber(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

const TRIAGE_BY_URGENCY = { emergency: 1, urgent: 2, soon: 3, routine: 4 }

// ---------------------------------------------------------------- beds + admissions

router.get('/beds', async (req, res) => {
  const hospital = await scopeHospital(req, req.query.hospitalId)
  const beds = await Bed.find({ hospital: hospital._id }).sort({ ward: 1, label: 1 })

  res.json({
    data: beds,
    meta: {
      count: beds.length,
      free: beds.filter((bed) => bed.status === 'free').length,
      occupied: beds.filter((bed) => bed.status === 'occupied').length,
    },
  })
})

router.post('/beds', async (req, res) => {
  const hospital = await scopeHospital(req, req.body?.hospitalId)
  const ward = typeof req.body?.ward === 'string' ? req.body.ward.trim().slice(0, 60) : ''
  const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 20) : ''

  if (!ward || !label) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'A bed needs a ward and a label.')
  }

  const bed = await Bed.findOneAndUpdate(
    { hospital: hospital._id, ward, label },
    {
      hospital: hospital._id,
      ward,
      label,
      kind: ['general', 'hdu', 'icu', 'isolation', 'maternity'].includes(req.body?.kind)
        ? req.body.kind
        : 'general',
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  res.status(201).json({ data: bed })
})

router.patch('/beds/:bedId', async (req, res) => {
  const hospital = await scopeHospital(req, req.body?.hospitalId)
  const status = ['free', 'occupied', 'cleaning', 'closed'].includes(req.body?.status)
    ? req.body.status
    : null

  if (!status) throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a bed status.')

  const bed = await Bed.findOneAndUpdate(
    { _id: mongoose.isValidObjectId(req.params.bedId) ? req.params.bedId : null, hospital: hospital._id },
    { status },
    { new: true },
  )

  if (!bed) throw new HttpError(404, 'NOT_FOUND', 'Bed not found.')

  res.json({ data: bed })
})

router.get('/admissions', async (req, res) => {
  const hospital = await scopeHospital(req, req.query.hospitalId)
  const filter = { hospital: hospital._id }
  if (req.query.active === 'true') filter.status = 'admitted'

  const admissions = await Admission.find(filter).sort({ admittedAt: -1 }).limit(100)

  res.json({ data: admissions, meta: { count: admissions.length } })
})

router.post('/admissions', async (req, res) => {
  const hospital = await scopeHospital(req, req.body?.hospitalId)
  const patientName = typeof req.body?.patientName === 'string' ? req.body.patientName.trim().slice(0, 80) : ''

  if (!patientName) throw new HttpError(400, 'VALIDATION_ERROR', 'Who is being admitted?')

  let bed = null

  if (mongoose.isValidObjectId(req.body?.bedId)) {
    bed = await Bed.findOne({ _id: req.body.bedId, hospital: hospital._id })

    if (!bed) throw new HttpError(404, 'NOT_FOUND', 'That bed is not on this ward board.')
    if (bed.status === 'occupied') throw new HttpError(409, 'CONFLICT', 'That bed is already taken.')
  }

  const admission = await Admission.create({
    hospital: hospital._id,
    patientUser: mongoose.isValidObjectId(req.body?.patientUserId) ? req.body.patientUserId : null,
    patientName,
    bed: bed?._id ?? null,
    ward: bed?.ward ?? (typeof req.body?.ward === 'string' ? req.body.ward.slice(0, 60) : ''),
    reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '',
    admittedBy: req.user.name,
  })

  if (bed) {
    bed.status = 'occupied'
    await bed.save()
  }

  await audit.record(req, {
    action: 'admission.created',
    subjectType: 'Admission',
    subjectId: admission._id,
    hospital: hospital._id,
    summary: `Admitted ${patientName}${bed ? ` to ${bed.ward} ${bed.label}` : ''}`,
  })

  res.status(201).json({ data: admission })
})

router.patch('/admissions/:admissionId/discharge', async (req, res) => {
  const hospital = await scopeHospital(req, req.body?.hospitalId)

  const admission = await Admission.findOneAndUpdate(
    {
      _id: mongoose.isValidObjectId(req.params.admissionId) ? req.params.admissionId : null,
      hospital: hospital._id,
      status: 'admitted',
    },
    {
      status: 'discharged',
      dischargedAt: new Date(),
      outcome: typeof req.body?.outcome === 'string' ? req.body.outcome.trim().slice(0, 200) : '',
    },
    { new: true },
  )

  if (!admission) throw new HttpError(404, 'NOT_FOUND', 'No active admission found.')

  if (admission.bed) {
    await Bed.updateOne({ _id: admission.bed }, { status: 'cleaning' })
  }

  await audit.record(req, {
    action: 'admission.discharged',
    subjectType: 'Admission',
    subjectId: admission._id,
    hospital: hospital._id,
    summary: `Discharged ${admission.patientName}`,
  })

  res.json({ data: admission })
})

// ---------------------------------------------------------------- billing

router.get('/invoices', async (req, res) => {
  const hospital = await scopeHospital(req, req.query.hospitalId)
  const filter = { hospital: hospital._id }
  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status

  const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(100)

  res.json({
    data: invoices,
    meta: {
      count: invoices.length,
      outstanding: invoices
        .filter((invoice) => invoice.status === 'issued')
        .reduce((sum, invoice) => sum + invoice.total, 0),
      collected: invoices
        .filter((invoice) => invoice.status === 'paid')
        .reduce((sum, invoice) => sum + invoice.total, 0),
    },
  })
})

router.post('/invoices', async (req, res) => {
  const hospital = await scopeHospital(req, req.body?.hospitalId)

  const lines = Array.isArray(req.body?.lines)
    ? req.body.lines
        .filter((line) => typeof line?.label === 'string' && line.label.trim())
        .slice(0, 30)
        .map((line) => ({
          label: line.label.trim().slice(0, 120),
          amount: Math.max(0, Number(line.amount) || 0),
          kind: ['consultation', 'laboratory', 'pharmacy', 'procedure', 'other'].includes(line.kind)
            ? line.kind
            : 'other',
          ref: typeof line.ref === 'string' ? line.ref.slice(0, 60) : '',
        }))
    : []

  if (!lines.length) throw new HttpError(400, 'VALIDATION_ERROR', 'An invoice needs at least one line.')

  const invoice = await Invoice.create({
    hospital: hospital._id,
    patientUser: mongoose.isValidObjectId(req.body?.patientUserId) ? req.body.patientUserId : null,
    patientName: typeof req.body?.patientName === 'string' ? req.body.patientName.trim().slice(0, 80) : '',
    appointment: mongoose.isValidObjectId(req.body?.appointmentId) ? req.body.appointmentId : null,
    number: shortNumber('INV'),
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    currency: typeof req.body?.currency === 'string' ? req.body.currency.slice(0, 6) : 'PKR',
    status: 'issued',
    issuedAt: new Date(),
    payer: req.body?.payer === 'insurer' ? 'insurer' : 'self',
  })

  await audit.record(req, {
    action: 'invoice.issued',
    subjectType: 'Invoice',
    subjectId: invoice._id,
    hospital: hospital._id,
    summary: `Invoice ${invoice.number} for ${invoice.total} ${invoice.currency}`,
  })

  res.status(201).json({ data: invoice })
})

router.patch('/invoices/:invoiceId', async (req, res) => {
  const hospital = await scopeHospital(req, req.body?.hospitalId)
  const status = ['draft', 'issued', 'paid', 'void'].includes(req.body?.status) ? req.body.status : null

  if (!status) throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a valid invoice status.')

  const invoice = await Invoice.findOneAndUpdate(
    { _id: mongoose.isValidObjectId(req.params.invoiceId) ? req.params.invoiceId : null, hospital: hospital._id },
    { status, paidAt: status === 'paid' ? new Date() : null },
    { new: true },
  )

  if (!invoice) throw new HttpError(404, 'NOT_FOUND', 'Invoice not found.')

  await audit.record(req, {
    action: 'invoice.status_changed',
    subjectType: 'Invoice',
    subjectId: invoice._id,
    hospital: hospital._id,
    summary: `${invoice.number} → ${status}`,
  })

  res.json({ data: invoice })
})

router.patch('/invoices/:invoiceId/claim', async (req, res) => {
  const hospital = await scopeHospital(req, req.body?.hospitalId)
  const status = ['none', 'submitted', 'approved', 'rejected'].includes(req.body?.status)
    ? req.body.status
    : 'submitted'

  const invoice = await Invoice.findOneAndUpdate(
    { _id: mongoose.isValidObjectId(req.params.invoiceId) ? req.params.invoiceId : null, hospital: hospital._id },
    {
      claim: {
        insurer: typeof req.body?.insurer === 'string' ? req.body.insurer.trim().slice(0, 80) : '',
        policyNumber: typeof req.body?.policyNumber === 'string' ? req.body.policyNumber.trim().slice(0, 60) : '',
        status,
        submittedAt: status === 'submitted' ? new Date() : null,
        note: typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 200) : '',
      },
    },
    { new: true },
  )

  if (!invoice) throw new HttpError(404, 'NOT_FOUND', 'Invoice not found.')

  res.json({ data: invoice })
})

// ---------------------------------------------------------------- equipment + intake

router.get('/equipment-logs', async (req, res) => {
  const hospital = await scopeHospital(req, req.query.hospitalId)
  const logs = await EquipmentLog.find({ hospital: hospital._id }).sort({ performedAt: -1 }).limit(100)

  res.json({ data: logs, meta: { count: logs.length } })
})

router.post('/equipment-logs', async (req, res) => {
  const hospital = await scopeHospital(req, req.body?.hospitalId)

  const log = await EquipmentLog.create({
    hospital: hospital._id,
    inventoryItem: mongoose.isValidObjectId(req.body?.inventoryItemId) ? req.body.inventoryItemId : null,
    itemName: typeof req.body?.itemName === 'string' ? req.body.itemName.trim().slice(0, 120) : '',
    kind: ['service', 'repair', 'calibration', 'inspection', 'fault'].includes(req.body?.kind)
      ? req.body.kind
      : 'service',
    performedBy: typeof req.body?.performedBy === 'string' ? req.body.performedBy.trim().slice(0, 80) : '',
    outcome: typeof req.body?.outcome === 'string' ? req.body.outcome.trim().slice(0, 300) : '',
    nextDueAt: req.body?.nextDueAt ? new Date(req.body.nextDueAt) : null,
    cost: Math.max(0, Number(req.body?.cost) || 0),
  })

  res.status(201).json({ data: log })
})

router.get('/intake', async (req, res) => {
  const hospital = await scopeHospital(req, req.query.hospitalId)
  const filter = { hospital: hospital._id }
  if (req.query.open === 'true') filter.status = { $in: ['waiting', 'in_treatment'] }

  const entries = await Intake.find(filter).sort({ triageLevel: 1, arrivedAt: 1 }).limit(100)

  res.json({ data: entries, meta: { count: entries.length } })
})

/** Triage level comes from the clinical graph, then a nurse can override it. */
router.post('/intake', async (req, res) => {
  const hospital = await scopeHospital(req, req.body?.hospitalId)
  const complaint = typeof req.body?.complaint === 'string' ? req.body.complaint.trim().slice(0, 500) : ''

  if (complaint.length < 4) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Describe the complaint in a few words.')
  }

  const resolution = clinicalGraph.resolve(complaint)
  const symptomIds = resolution.concepts.filter((c) => c.type === 'Symptom').map((c) => c.id)
  const urgency = clinicalGraph.urgencyFor(symptomIds)
  const suggested = TRIAGE_BY_URGENCY[urgency.level] ?? 3

  const entry = await Intake.create({
    hospital: hospital._id,
    patientUser: mongoose.isValidObjectId(req.body?.patientUserId) ? req.body.patientUserId : null,
    patientName: typeof req.body?.patientName === 'string' ? req.body.patientName.trim().slice(0, 80) : '',
    age: Number.isFinite(Number(req.body?.age)) ? Number(req.body.age) : null,
    complaint,
    concepts: symptomIds,
    triageLevel: suggested,
    suggestedLevel: suggested,
    vitals: req.body?.vitals ?? null,
  })

  res.status(201).json({
    data: entry,
    meta: { urgency: urgency.level, redFlags: clinicalGraph.flagsFor(symptomIds).map((flag) => flag.label) },
  })
})

router.patch('/intake/:intakeId', async (req, res) => {
  const hospital = await scopeHospital(req, req.body?.hospitalId)

  const update = {}
  if (Number.isFinite(Number(req.body?.triageLevel))) {
    update.triageLevel = Math.min(5, Math.max(1, Number(req.body.triageLevel)))
    update.overridden = true
  }
  if (['waiting', 'in_treatment', 'admitted', 'discharged'].includes(req.body?.status)) {
    update.status = req.body.status
  }
  if (typeof req.body?.seenBy === 'string') update.seenBy = req.body.seenBy.slice(0, 80)
  if (typeof req.body?.outcome === 'string') update.outcome = req.body.outcome.slice(0, 300)

  const entry = await Intake.findOneAndUpdate(
    { _id: mongoose.isValidObjectId(req.params.intakeId) ? req.params.intakeId : null, hospital: hospital._id },
    update,
    { new: true },
  )

  if (!entry) throw new HttpError(404, 'NOT_FOUND', 'Intake entry not found.')

  res.json({ data: entry })
})

// ---------------------------------------------------------------- analytics

router.get('/analytics', async (req, res) => {
  const hospital = await scopeHospital(req, req.query.hospitalId)

  const [appointments, invoices, reviews, beds, admissions] = await Promise.all([
    Appointment.find({ hospital: hospital._id }).limit(2000),
    Invoice.find({ hospital: hospital._id }).limit(2000),
    Review.find({ hospital: hospital._id, hidden: false }).limit(500),
    Bed.find({ hospital: hospital._id }),
    Admission.find({ hospital: hospital._id, status: 'admitted' }),
  ])

  const byMonth = new Map()
  for (const invoice of invoices) {
    const month = new Date(invoice.createdAt).toISOString().slice(0, 7)
    const entry = byMonth.get(month) ?? { month, billed: 0, collected: 0 }
    entry.billed += invoice.total
    if (invoice.status === 'paid') entry.collected += invoice.total
    byMonth.set(month, entry)
  }

  const departments = new Map()
  for (const appointment of appointments) {
    const key = appointment.specialty || 'General'
    departments.set(key, (departments.get(key) ?? 0) + 1)
  }

  const cancelled = appointments.filter((item) => item.status === 'cancelled').length
  const rated = reviews.filter((review) => review.rating >= 4).length
  const promoters = reviews.filter((review) => review.rating === 5).length
  const detractors = reviews.filter((review) => review.rating <= 3).length

  res.json({
    data: {
      revenue: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
      topDepartments: [...departments.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      appointments: {
        total: appointments.length,
        completed: appointments.filter((item) => item.status === 'completed').length,
        noShowRate: appointments.length ? Math.round((cancelled / appointments.length) * 100) : 0,
      },
      occupancy: {
        beds: beds.length,
        occupied: beds.filter((bed) => bed.status === 'occupied').length,
        rate: beds.length
          ? Math.round((beds.filter((bed) => bed.status === 'occupied').length / beds.length) * 100)
          : 0,
        inpatients: admissions.length,
      },
      experience: {
        reviews: reviews.length,
        average: reviews.length
          ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
          : 0,
        satisfaction: reviews.length ? Math.round((rated / reviews.length) * 100) : 0,
        nps: reviews.length ? Math.round(((promoters - detractors) / reviews.length) * 100) : 0,
      },
      labOrders: await LabOrder.countDocuments({ hospital: hospital._id }),
    },
  })
})

module.exports = router
