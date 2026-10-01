const express = require('express')
const crypto = require('crypto')
const mongoose = require('mongoose')
const Hospital = require('../models/hospital')
const Staff = require('../models/staff')
const AiInferenceLog = require('../models/ai-inference-log')
const AiFeedback = require('../models/ai-feedback')
const AiSettings = require('../models/ai-settings')
const AiCache = require('../models/ai-cache')
const HttpError = require('../lib/http-error')
const { chat, parseJsonContent } = require('../lib/groq')
const aiService = require('../lib/ai-service')
const { nextFreeSlot } = require('../lib/slots')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

const URGENCY_LEVELS = ['routine', 'soon', 'urgent']

const SYSTEM_PROMPT = `You are Aurora's care navigation assistant. You help patients work out which kind of hospital department or specialty fits their situation. You are not a doctor: never diagnose, never name a disease as certain, never suggest medication or dosages.

Respond with JSON only, exactly this shape:
{
  "summary": "one calm sentence, max 140 characters, restating the need in plain language",
  "specialties": ["1-3 common specialty names, e.g. Cardiology, Pediatrics, Dermatology, Orthopedics, General Medicine, Emergency"],
  "urgency": "routine" | "soon" | "urgent",
  "advice": "max 200 characters on what to do next"
}

Rules:
- If the description suggests a medical emergency (chest pain, difficulty breathing, stroke signs, severe bleeding, loss of consciousness), set urgency to "urgent" and tell them to contact emergency services immediately.
- Keep the tone calm, precise, and human. No filler. No diagnosis.`

function clip(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function normalizeSpecialties(value) {
  if (!Array.isArray(value)) return []

  return [...new Set(
    value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 40),
  )].slice(0, 3)
}

router.post('/triage', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''

  if (query.length < 10 || query.length > 500) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Describe what is going on in 10-500 characters.',
      [{ field: 'query', message: 'Between 10 and 500 characters.' }],
    )
  }

  const content = await chat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: query },
    ],
    asJson: true,
    temperature: 0.2,
    maxTokens: 400,
  })

  const parsed = parseJsonContent(content)
  const urgency = URGENCY_LEVELS.includes(parsed?.urgency) ? parsed.urgency : 'routine'

  res.json({
    data: {
      summary: clip(parsed?.summary, 160),
      specialties: normalizeSpecialties(parsed?.specialties),
      urgency,
      advice: clip(parsed?.advice, 240),
      disclaimer:
        'Aurora helps you find care — it is not a doctor and cannot diagnose. In an emergency, contact your local emergency services.',
    },
  })
})

function bookingPrompt(doctors) {
  const roster = doctors.length
    ? doctors.map((doctor) => `${doctor.name} — ${doctor.specialty || 'General'}`).join('; ')
    : 'no doctors listed yet'

  return `You are Aurora's booking assistant. You help a patient choose the right doctor at one hospital and describe the visit in one line. You are not a doctor: never diagnose, never prescribe.

Respond with JSON only, exactly this shape:
{
  "summary": "one calm line for the appointment note, max 160 characters",
  "specialty": "the best matching specialty (prefer one from the roster when it fits)",
  "urgency": "routine" | "soon" | "urgent"
}

Doctors at this hospital: ${roster}
Rules:
- Prefer a specialty that appears on the roster.
- If the description suggests an emergency, set urgency to "urgent" and say to contact emergency services in the summary.
- Keep the tone calm, precise, human. No diagnosis.`
}

router.post('/booking', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  const { hospitalId } = req.body ?? {}
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''

  if (query.length < 10 || query.length > 500) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Describe what is going on in 10-500 characters.', [
      { field: 'query', message: 'Between 10 and 500 characters.' },
    ])
  }

  const hospital = await Hospital.findOne({
    _id: mongoose.isValidObjectId(hospitalId) ? hospitalId : null,
    status: 'approved',
  })

  if (!hospital) {
    throw new HttpError(404, 'NOT_FOUND', 'Hospital not found.')
  }

  const doctors = await Staff.find({
    hospital: hospital._id,
    role: 'doctor',
    status: 'active',
  })
    .sort({ name: 1 })
    .limit(20)

  const content = await chat({
    messages: [
      { role: 'system', content: bookingPrompt(doctors) },
      { role: 'user', content: query },
    ],
    asJson: true,
    temperature: 0.2,
    maxTokens: 300,
  })

  const parsed = parseJsonContent(content)
  const specialty = clip(parsed?.specialty, 60)
  const summary = clip(parsed?.summary, 200)
  const urgency = URGENCY_LEVELS.includes(parsed?.urgency) ? parsed.urgency : 'routine'

  const wanted = specialty.toLowerCase()
  const doctor =
    doctors.find((candidate) => (candidate.specialty ?? '').toLowerCase() === wanted) ??
    doctors.find((candidate) => (candidate.specialty ?? '').toLowerCase().includes(wanted) && wanted) ??
    doctors[0] ??
    null

  const slot = await nextFreeSlot({ hospitalId: hospital._id, doctorId: doctor?._id ?? null })

  res.json({
    data: {
      summary,
      specialty: specialty || doctor?.specialty || '',
      urgency,
      doctor: doctor
        ? { id: doctor.id, name: doctor.name, specialty: doctor.specialty ?? '' }
        : null,
      slot,
      disclaimer:
        'Aurora suggests a doctor and a time — your request is confirmed by the hospital. In an emergency, contact your local emergency services.',
    },
  })
})

// ---------------------------------------------------------------- clinical AI
// Local MedGemma assistant for doctors and radiologists. Inference never leaves
// this machine: the Python sidecar in ai-service/ owns the model.

const DATA_URL_PATTERN =
  /^data:(image\/(?:png|jpe?g|webp)|application\/dicom);base64,([A-Za-z0-9+/=]+)$/
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const CACHE_TTL_DAYS = Number(process.env.AI_CACHE_TTL_DAYS || 30)
const CLINICAL_ROLES = ['doctor', 'radiologist']

function isDicomMime(mimeType) {
  return mimeType === 'application/dicom'
}

function settingsPayload(settings) {
  return {
    enabled: settings.enabled,
    departments: settings.departments,
    maxTokens: settings.maxTokens,
    temperature: settings.temperature,
    timeoutSeconds: settings.timeoutSeconds,
  }
}

// The vision model sees the image but describes it bluntly: its raw output is fed
// to the text model, which turns it into an interpretation a clinician can read.
// Enrichment only — if it fails, the raw local analysis still comes back.
const INTERPRET_PROMPT = `You are Aurora's radiology reasoning assistant. You are given the raw JSON output of a local vision model that examined a scan, plus the clinician's question.

Write a short, careful interpretation of that raw output.

Rules:
- Only use what is in the raw output. Never invent findings.
- No definitive diagnosis: use "appears", "suggests", "cannot exclude".
- If the raw output is vague, too short, or contradictory, say so plainly and set confidence_note accordingly.

Respond with JSON only, exactly this shape:
{
  "impression": "one or two sentences a clinician can act on, max 300 characters",
  "key_findings": ["short bullet", "short bullet"],
  "next_steps": ["short bullet"],
  "red_flags": ["short bullet"],
  "confidence_note": "one sentence on how far to trust this result"
}`

function cleanList(value, max) {
  if (!Array.isArray(value)) return []

  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, max)
}

async function interpretAnalysis({ analysis, question, patientName }) {
  try {
    const content = await chat({
      messages: [
        { role: 'system', content: INTERPRET_PROMPT },
        {
          role: 'user',
          content: `Raw vision model output:\n${JSON.stringify(analysis)}\n\nClinician question: ${
            question || 'none given'
          }\nPatient label: ${patientName || 'not provided'}`,
        },
      ],
      asJson: true,
      temperature: 0.1,
      maxTokens: 600,
    })

    const parsed = parseJsonContent(content)

    return {
      impression: clip(parsed?.impression, 400),
      keyFindings: cleanList(parsed?.key_findings, 6),
      nextSteps: cleanList(parsed?.next_steps, 4),
      redFlags: cleanList(parsed?.red_flags, 4),
      confidenceNote: clip(parsed?.confidence_note, 240),
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      failed: false,
    }
  } catch (error) {
    console.error('Interpretation pass failed:', error.message)

    return {
      impression: analysis.findings,
      keyFindings: [],
      nextSteps: analysis.recommended_followup ? [analysis.recommended_followup] : [],
      redFlags: [],
      confidenceNote:
        'The reasoning pass was unavailable, so this is the raw local model output — review it directly.',
      model: null,
      failed: true,
    }
  }
}

async function clinicalContext(req) {
  const settings = await AiSettings.load()

  if (!settings.enabled) {
    throw new HttpError(403, 'FORBIDDEN', 'The AI assistant is switched off for this installation.')
  }

  if (req.user.role === 'admin') {
    return { settings, staff: null }
  }

  const staff = await Staff.findOne({ user: req.user.id })

  if (!staff || !CLINICAL_ROLES.includes(staff.role)) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      'Only doctors and radiologists can use the clinical AI assistant.',
    )
  }

  if (staff.status !== 'active') {
    throw new HttpError(403, 'FORBIDDEN', 'Your staff profile is not active right now.')
  }

  const department = settings.departments.find((entry) => entry.name === staff.department)

  if (department && department.enabled === false) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      `The AI assistant is switched off for ${staff.department}.`,
    )
  }

  return { settings, staff }
}

router.get('/status', requireAuth, requireRole('doctor', 'admin'), async (req, res) => {
  const settings = await AiSettings.load()

  try {
    const health = await aiService.health()
    res.json({
      data: {
        available: true,
        enabled: settings.enabled,
        settings: settingsPayload(settings),
        health,
      },
    })
  } catch (err) {
    res.json({
      data: {
        available: false,
        enabled: settings.enabled,
        settings: settingsPayload(settings),
        reason: err.message,
      },
    })
  }
})

router.post('/analyze-image', requireAuth, requireRole('doctor', 'admin'), async (req, res) => {
  const { settings, staff } = await clinicalContext(req)

  const image = typeof req.body?.image === 'string' ? req.body.image : ''
  const match = image.match(DATA_URL_PATTERN)

  if (!match) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Upload a PNG, JPEG, WebP, or DICOM scan.', [
      { field: 'image', message: 'Send a base64 image data URL.' },
    ])
  }

  const [, mimeType, base64] = match
  const buffer = Buffer.from(base64, 'base64')

  if (!buffer.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'The uploaded scan was empty.')
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Keep scans under 12 MB.', [
      { field: 'image', message: 'Maximum 12 MB after decoding.' },
    ])
  }
  const question = clip(req.body?.question, 500)
  const patient = clip(req.body?.patientName, 120)
  const imageHash = crypto.createHash('sha256').update(buffer).digest('hex')
  const cacheKey = `${imageHash}:${question.toLowerCase()}:${settings.maxTokens}:${settings.temperature}`

  const cached = await AiCache.findOne({ key: cacheKey, expiresAt: { $gt: new Date() } })

  let analysis
  let latencyMs
  let modelVersion
  let cacheHit = false

  if (cached) {
    analysis = cached.response
    modelVersion = cached.modelVersion
    latencyMs = 0
    cacheHit = true
  } else {
    const result = await aiService.analyzeImage({
      buffer,
      filename: isDicomMime(mimeType) ? `scan-${imageHash.slice(0, 8)}.dcm` : `scan-${imageHash.slice(0, 8)}.png`,
      mimeType: isDicomMime(mimeType) ? 'application/dicom' : mimeType,
      question,
      maxTokens: settings.maxTokens,
      temperature: settings.temperature,
      timeoutMs: settings.timeoutSeconds * 1000,
    })

    analysis = {
      findings: result.findings,
      severity: result.severity,
      confidence: result.confidence,
      recommended_followup: result.recommended_followup,
      disclaimer: result.disclaimer,
    }

    analysis.interpretation = await interpretAnalysis({
      analysis: {
        findings: result.findings,
        severity: result.severity,
        confidence: result.confidence,
        recommended_followup: result.recommended_followup,
      },
      question,
      patientName: patient,
    })

    latencyMs = result.latency_ms
    modelVersion = result.model_version

    await AiCache.create({
      key: cacheKey,
      response: analysis,
      modelVersion,
      expiresAt: new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
  }

  const log = await AiInferenceLog.create({
    doctor: req.user.id,
    doctorName: staff?.name ?? req.user.name,
    department: staff?.department ?? 'Administration',
    kind: 'image',
    patient,
    imageHash,
    question,
    responseJson: analysis,
    severity: analysis.severity,
    modelVersion,
    latencyMs,
    cached: cacheHit,
  })

  res.json({
    data: {
      inferenceId: log.id,
      cached: cacheHit,
      modelVersion,
      latencyMs,
      ...analysis,
    },
  })
})

router.post('/chat', requireAuth, requireRole('doctor', 'admin'), async (req, res) => {
  const { settings, staff } = await clinicalContext(req)

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages.slice(-10) : []
  const messages = []

  for (const message of incoming) {
    const role = message?.role
    const content = typeof message?.content === 'string' ? message.content.trim() : ''

    if (!['system', 'user', 'assistant'].includes(role) || !content || content.length > 4000) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Each message needs a role and 1-4000 characters.', [
        { field: 'messages', message: 'Roles: system, user, assistant.' },
      ])
    }

    messages.push({ role, content })
  }

  if (!messages.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send at least one message.')
  }

  const result = await aiService.chat({
    messages,
    maxTokens: settings.maxTokens,
    temperature: settings.temperature,
    timeoutMs: settings.timeoutSeconds * 1000,
  })

  const question = [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''

  await AiInferenceLog.create({
    doctor: req.user.id,
    doctorName: staff?.name ?? req.user.name,
    department: staff?.department ?? 'Administration',
    kind: 'chat',
    question: clip(question, 500),
    responseJson: { reply: result.reply },
    severity: 'none',
    modelVersion: result.model_version,
    latencyMs: result.latency_ms,
  })

  res.json({
    data: {
      reply: result.reply,
      modelVersion: result.model_version,
      latencyMs: result.latency_ms,
    },
  })
})

router.get('/inferences', requireAuth, requireRole('doctor', 'admin'), async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20))
  const filter =
    req.user.role === 'admin' && req.query.scope === 'all' ? {} : { doctor: req.user.id }

  const logs = await AiInferenceLog.find(filter).sort({ createdAt: -1 }).limit(limit)
  const feedback = await AiFeedback.find({ inference: { $in: logs.map((log) => log._id) } })
  const byInference = new Map(feedback.map((entry) => [String(entry.inference), entry]))

  res.json({
    data: logs.map((log) => ({
      ...log.toJSON(),
      feedback: byInference.get(String(log._id))?.toJSON() ?? null,
    })),
    meta: { count: logs.length },
  })
})

router.post('/inferences/:inferenceId/feedback', requireAuth, requireRole('doctor', 'admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.inferenceId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Inference not found.')
  }

  const log = await AiInferenceLog.findById(req.params.inferenceId)

  if (!log) {
    throw new HttpError(404, 'NOT_FOUND', 'Inference not found.')
  }

  if (String(log.doctor) !== String(req.user.id) && req.user.role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', 'That inference belongs to another doctor.')
  }

  const decision = req.body?.decision
  const notes = clip(req.body?.notes, 1000)

  if (!['confirmed', 'overridden'].includes(decision)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose confirmed or overridden.', [
      { field: 'decision', message: 'Use "confirmed" or "overridden".' },
    ])
  }

  if (decision === 'overridden' && notes.length < 3) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Describe what you changed in the note.', [
      { field: 'notes', message: 'At least 3 characters.' },
    ])
  }

  const feedback = await AiFeedback.findOneAndUpdate(
    { inference: log._id, doctor: req.user.id },
    { decision, notes },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  res.json({ data: { feedback } })
})

module.exports = router
