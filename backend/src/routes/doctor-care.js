/**
 * Doctor care routes: consult notes (AI-drafted, clinician-approved), prescriptions
 * with graph-backed safety checks, referrals, and the day's workload.
 * Mounted alongside the existing /api/doctor router.
 */

const express = require('express')
const mongoose = require('mongoose')
const AiInferenceLog = require('../models/ai-inference-log')
const Appointment = require('../models/appointment')
const ClinicalNote = require('../models/clinical-note')
const PatientProfile = require('../models/patient-profile')
const Prescription = require('../models/prescription')
const PrevisitForm = require('../models/previsit-form')
const Referral = require('../models/referral')
const Staff = require('../models/staff')
const HttpError = require('../lib/http-error')
const audit = require('../lib/audit')
const { checkPrescription, drugGraph } = require('../knowledge/drug-graph')
const { chatDetailed, parseJsonContent } = require('../lib/groq')
const { nextFreeSlot } = require('../lib/slots')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

router.use(requireAuth, requireRole('doctor', 'admin'))

async function currentStaff(req) {
  if (req.user.role === 'admin') return null

  const staff = await Staff.findOne({ user: req.user.id })

  if (!staff || staff.role !== 'doctor') {
    throw new HttpError(403, 'FORBIDDEN', 'Only doctors can use the clinical workspace.')
  }

  return staff
}

async function ownAppointment(req) {
  const appointment = await Appointment.findOne({
    _id: mongoose.isValidObjectId(req.params.appointmentId) ? req.params.appointmentId : null,
  })

  if (!appointment) throw new HttpError(404, 'NOT_FOUND', 'Appointment not found.')

  return appointment
}

// ---------------------------------------------------------------- notes

/** What the patient wrote before the visit, shown to the doctor. */
router.get('/previsit/:appointmentId', async (req, res) => {
  const form = await PrevisitForm.findOne({
    appointment: mongoose.isValidObjectId(req.params.appointmentId) ? req.params.appointmentId : null,
  })

  res.json({ data: form })
})

router.get('/notes/:appointmentId', async (req, res) => {
  const note = await ClinicalNote.findOne({
    appointment: mongoose.isValidObjectId(req.params.appointmentId) ? req.params.appointmentId : null,
  })

  res.json({ data: note })
})

/** Draft a note from the visit and any AI findings — never filed without approval. */
router.post('/notes/:appointmentId/draft', async (req, res) => {
  const staff = await currentStaff(req)
  const appointment = await ownAppointment(req)

  const [inferences, profile, previsit] = await Promise.all([
    AiInferenceLog.find({ patient: appointment.patientName }).sort({ createdAt: -1 }).limit(3),
    appointment.patientUser ? PatientProfile.findOne({ patient: appointment.patientUser }) : null,
    PrevisitForm.findOne({ appointment: appointment._id }),
  ])

  const context = [
    `Visit: ${appointment.date} ${appointment.time} with ${appointment.doctorName || 'the doctor'} (${appointment.specialty || 'general'}).`,
    `Reason given: ${appointment.reason || 'not stated'}.`,
    previsit?.symptoms
      ? `What the patient reported before the visit: ${previsit.symptoms}${
          previsit.duration ? ` (for ${previsit.duration})` : ''
        }${previsit.painScale !== null && previsit.painScale !== undefined ? `, pain ${previsit.painScale}/10` : ''}.`
      : '',
    previsit?.currentMedications ? `Medications the patient listed: ${previsit.currentMedications}.` : '',
    previsit?.allergies ? `Allergies the patient listed: ${previsit.allergies}.` : '',
    previsit?.questions ? `The patient wants to ask: ${previsit.questions}.` : '',
    profile?.allergies?.length ? `Allergies: ${profile.allergies.map((entry) => entry.substance).join(', ')}.` : '',
    profile?.medications?.length ? `Current medications: ${profile.medications.join(', ')}.` : '',
    profile?.conditions?.length ? `Long-term conditions: ${profile.conditions.join(', ')}.` : '',
    inferences.length
      ? `AI findings on record: ${inferences
          .map((log) => `${log.kind}: ${JSON.stringify(log.responseJson).slice(0, 300)}`)
          .join(' | ')}`
      : 'No AI findings on record.',
  ]
    .filter(Boolean)
    .join('\n')

  let draft = null
  let model = ''
  let tokens = 0

  try {
    const result = await chatDetailed({
      messages: [
        {
          role: 'system',
          content: `You draft clinical notes for a doctor to review. Write in the SOAP structure. Never state a diagnosis as certain; use "impression" language. Never invent findings that are not in the context.
Reply with JSON only: {"subjective": string, "objective": string, "assessment": string, "plan": string}`,
        },
        { role: 'user', content: context },
      ],
      asJson: true,
      temperature: 0.2,
      maxTokens: 700,
    })

    const parsed = parseJsonContent(result.content)
    model = result.model
    tokens = result.usage?.totalTokens ?? 0

    draft = {
      subjective: String(parsed?.subjective ?? '').slice(0, 2000),
      objective: String(parsed?.objective ?? '').slice(0, 2000),
      assessment: String(parsed?.assessment ?? '').slice(0, 2000),
      plan: String(parsed?.plan ?? '').slice(0, 2000),
    }
  } catch (error) {
    console.error('Note draft failed:', error.message)
    draft = { subjective: appointment.reason || '', objective: '', assessment: '', plan: '' }
  }

  const note = await ClinicalNote.findOneAndUpdate(
    { appointment: appointment._id },
    {
      appointment: appointment._id,
      doctor: staff?._id ?? null,
      doctorName: staff?.name ?? req.user.name,
      patientUser: appointment.patientUser,
      patientName: appointment.patientName,
      hospital: appointment.hospital,
      ...draft,
      source: 'ai',
      draft: true,
      model,
      tokens,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  res.json({ data: note })
})

/** Save and approve — this is the moment the note becomes part of the record. */
router.put('/notes/:appointmentId', async (req, res) => {
  const staff = await currentStaff(req)
  const appointment = await ownAppointment(req)

  const field = (name, max) =>
    typeof req.body?.[name] === 'string' ? req.body[name].trim().slice(0, max) : ''

  const note = await ClinicalNote.findOneAndUpdate(
    { appointment: appointment._id },
    {
      appointment: appointment._id,
      doctor: staff?._id ?? null,
      doctorName: staff?.name ?? req.user.name,
      patientUser: appointment.patientUser,
      patientName: appointment.patientName,
      hospital: appointment.hospital,
      subjective: field('subjective', 2000),
      objective: field('objective', 2000),
      assessment: field('assessment', 2000),
      plan: field('plan', 2000),
      source: req.body?.source === 'ai' ? 'ai' : 'manual',
      draft: false,
      approvedBy: staff?.name ?? req.user.name,
      approvedAt: new Date(),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  await audit.record(req, {
    action: 'note.approved',
    subjectType: 'ClinicalNote',
    subjectId: note._id,
    hospital: appointment.hospital,
    summary: `Note approved for ${appointment.patientName}`,
  })

  res.json({ data: note })
})

// ---------------------------------------------------------------- prescriptions

router.post('/prescriptions', async (req, res) => {
  const staff = await currentStaff(req)

  const patientUser = mongoose.isValidObjectId(req.body?.patientUserId) ? req.body.patientUserId : null
  const patientName = typeof req.body?.patientName === 'string' ? req.body.patientName.trim().slice(0, 80) : ''

  const items = Array.isArray(req.body?.items)
    ? req.body.items
        .filter((entry) => typeof entry?.drug === 'string' && entry.drug.trim())
        .slice(0, 15)
        .map((entry) => ({
          drug: entry.drug.trim().slice(0, 80),
          dose: typeof entry.dose === 'string' ? entry.dose.trim().slice(0, 60) : '',
          frequency: typeof entry.frequency === 'string' ? entry.frequency.trim().slice(0, 60) : '',
          durationDays: Number.isFinite(Number(entry.durationDays)) ? Number(entry.durationDays) : null,
          notes: typeof entry.notes === 'string' ? entry.notes.trim().slice(0, 200) : '',
        }))
    : []

  if (!items.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Add at least one medicine.', [
      { field: 'items', message: 'One medicine is required.' },
    ])
  }

  const profile = patientUser ? await PatientProfile.findOne({ patient: patientUser }) : null

  const { warnings } = checkPrescription({
    drugs: items,
    allergies: profile?.allergies ?? [],
    conditions: profile?.conditions ?? [],
  })

  const serious = warnings.filter((warning) => warning.severity === 'serious')

  if (serious.length && req.body?.acknowledgeWarnings !== true) {
    // The prescriber decides — but they must see it first.
    return res.status(409).json({
      error: {
        code: 'WARNINGS_UNACKNOWLEDGED',
        message: 'Serious safety warnings need acknowledgement before this can be issued.',
      },
      data: { warnings },
    })
  }

  const prescription = await Prescription.create({
    patientUser,
    patientName,
    hospital: req.body?.hospitalId ?? null,
    doctor: staff?._id ?? null,
    doctorName: staff?.name ?? req.user.name,
    appointment: mongoose.isValidObjectId(req.body?.appointmentId) ? req.body.appointmentId : null,
    items,
    warnings,
    acknowledged: serious.length > 0,
  })

  await audit.record(req, {
    action: 'prescription.issued',
    subjectType: 'Prescription',
    subjectId: prescription._id,
    hospital: prescription.hospital,
    summary: `${items.length} item(s) for ${patientName || 'patient'}${
      serious.length ? ` with ${serious.length} serious warning(s)` : ''
    }`,
  })

  res.status(201).json({ data: prescription })
})

/** Safety check without prescribing — the UI calls this as the doctor types. */
router.post('/prescriptions/check', async (req, res) => {
  const patientUser = mongoose.isValidObjectId(req.body?.patientUserId) ? req.body.patientUserId : null
  const profile = patientUser ? await PatientProfile.findOne({ patient: patientUser }) : null

  const drugs = Array.isArray(req.body?.items) ? req.body.items : []

  const { warnings, resolved } = checkPrescription({
    drugs,
    allergies: profile?.allergies ?? [],
    conditions: profile?.conditions ?? [],
  })

  res.json({ data: { warnings, resolved: resolved.map((entry) => entry.label), graph: drugGraph.stats() } })
})

router.get('/prescriptions', async (req, res) => {
  const filter = {}

  if (req.query.mine === 'true' && req.user.role !== 'admin') {
    const staff = await currentStaff(req)
    filter.doctor = staff?._id ?? null
  }

  const prescriptions = await Prescription.find(filter).sort({ createdAt: -1 }).limit(50)

  res.json({ data: prescriptions, meta: { count: prescriptions.length } })
})

// ---------------------------------------------------------------- referrals

router.post('/referrals', async (req, res) => {
  const staff = await currentStaff(req)
  const toSpecialty = typeof req.body?.toSpecialty === 'string' ? req.body.toSpecialty.trim().slice(0, 80) : ''

  if (!toSpecialty) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose the specialty to refer to.')
  }

  const referral = await Referral.create({
    patientUser: mongoose.isValidObjectId(req.body?.patientUserId) ? req.body.patientUserId : null,
    patientName: typeof req.body?.patientName === 'string' ? req.body.patientName.trim().slice(0, 80) : '',
    hospital: req.body?.hospitalId ?? null,
    fromDoctor: staff?._id ?? null,
    fromDoctorName: staff?.name ?? req.user.name,
    toSpecialty,
    reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 600) : '',
    urgency: ['routine', 'soon', 'urgent'].includes(req.body?.urgency) ? req.body.urgency : 'routine',
  })

  await audit.record(req, {
    action: 'referral.created',
    subjectType: 'Referral',
    subjectId: referral._id,
    hospital: referral.hospital,
    summary: `Referred ${referral.patientName || 'a patient'} to ${toSpecialty}`,
  })

  res.status(201).json({ data: referral })
})

router.get('/referrals', async (req, res) => {
  const filter = {}

  if (req.query.queue === 'true') {
    filter.status = 'open'
    if (typeof req.query.specialty === 'string' && req.query.specialty) {
      filter.toSpecialty = new RegExp(req.query.specialty, 'i')
    }
  }

  const referrals = await Referral.find(filter).sort({ createdAt: -1 }).limit(50)

  res.json({ data: referrals, meta: { count: referrals.length } })
})

router.patch('/referrals/:referralId', async (req, res) => {
  const status = ['accepted', 'declined', 'closed'].includes(req.body?.status) ? req.body.status : null

  if (!status) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose accepted, declined or closed.')
  }

  const staff = await currentStaff(req)

  const referral = await Referral.findOneAndUpdate(
    { _id: mongoose.isValidObjectId(req.params.referralId) ? req.params.referralId : null },
    {
      status,
      acceptedBy: staff?.name ?? req.user.name,
      acceptedAt: status === 'accepted' ? new Date() : null,
    },
    { new: true },
  )

  if (!referral) throw new HttpError(404, 'NOT_FOUND', 'Referral not found.')

  res.json({ data: referral })
})

// ---------------------------------------------------------------- workload

router.get('/queue', async (req, res) => {
  const staff = await currentStaff(req)
  const today = new Date().toISOString().slice(0, 10)

  const filter = { date: today, status: { $ne: 'cancelled' } }
  if (staff) filter.doctor = staff._id

  const [appointments, prescriptions, referrals, next] = await Promise.all([
    Appointment.find(filter).sort({ time: 1 }),
    staff ? Prescription.countDocuments({ doctor: staff._id, createdAt: { $gte: new Date(Date.now() - 86400000) } }) : 0,
    staff ? Referral.countDocuments({ toSpecialty: staff.specialty, status: 'open' }) : 0,
    nextFreeSlot({ hospitalId: staff?.hospital ?? null, doctorId: staff?._id ?? null }),
  ])

  res.json({
    data: {
      date: today,
      appointments,
      waiting: appointments.filter((item) => item.status === 'arrived').length,
      upcoming: appointments.filter((item) => item.status !== 'arrived' && item.status !== 'completed').length,
      completed: appointments.filter((item) => item.status === 'completed').length,
      prescriptionsLast24h: prescriptions,
      openReferrals: referrals,
      nextFreeSlot: next,
    },
  })
})

module.exports = router
