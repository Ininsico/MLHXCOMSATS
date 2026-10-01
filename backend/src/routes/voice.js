const express = require('express')
const mongoose = require('mongoose')
const Appointment = require('../models/appointment')
const Hospital = require('../models/hospital')
const Staff = require('../models/staff')
const VoiceSession = require('../models/voice-session')
const HttpError = require('../lib/http-error')
const { TIMES, localDate } = require('../lib/slots')
const { SPECIALTIES } = require('../lib/specialties')
const { chat, parseJsonContent, transcribe } = require('../lib/groq')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

router.use(requireAuth, requireRole('patient', 'admin'))

/**
 * Speech-to-text for the booking agent. The browser records with MediaRecorder and
 * posts the blob here; Whisper does the transcription, so no browser speech API
 * and no cloud vendor beyond the one we already pay for.
 */
router.post('/transcribe', express.raw({ type: ['audio/*', 'video/*', 'application/octet-stream'], limit: '20mb' }), async (req, res) => {
  const buffer = Buffer.isBuffer(req.body) ? req.body : null

  if (!buffer?.length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send the recorded audio in the request body.', [
      { field: 'audio', message: 'Empty recording.' },
    ])
  }

  const result = await transcribe(buffer, req.headers['content-type'] || 'audio/webm')

  res.json({ data: result })
})

function nowTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function parseIntent(text) {
  const lower = text.toLowerCase()
  const specialty = SPECIALTIES.find((item) => lower.includes(item.toLowerCase())) ?? null
  const weekday = WEEKDAYS.find((day) => lower.includes(day)) ?? null
  const relative = lower.includes('tomorrow') ? 'tomorrow' : lower.includes('today') ? 'today' : null
  const period = lower.includes('morning')
    ? 'morning'
    : lower.includes('afternoon')
      ? 'afternoon'
      : lower.includes('evening')
        ? 'evening'
        : null
  const affirmative = /\b(yes|yeah|yep|sure|ok|okay|confirm|book it|that works|works for me|please do)\b/.test(lower)
  const negative = /\b(no|nope|not that|neither|cancel)\b/.test(lower)
  const ordinal = /\b(first|1st)\b/.test(lower) ? 0 : /\b(second|2nd)\b/.test(lower) ? 1 : null
  const widen = /(nothing|no availability|any other|different|another|next week|later)/.test(lower)

  return {
    specialty,
    weekday,
    relative,
    period,
    affirmative,
    negative,
    ordinal,
    widen,
  }
}

async function llmIntent(text, specialties) {
  try {
    const content = await chat({
      messages: [
        {
          role: 'system',
          content: `Extract booking intent from a patient's sentence. Respond with JSON only: {"specialty": string|null, "dayPreference": "today"|"tomorrow"|"this week"|"next week"|null, "clarifyingQuestion": string|null}. Choose a specialty from this list when it fits: ${specialties.join(', ')}.`,
        },
        { role: 'user', content: text },
      ],
      asJson: true,
      temperature: 0,
      maxTokens: 200,
    })

    const parsed = parseJsonContent(content)
    return {
      specialty: typeof parsed?.specialty === 'string' ? parsed.specialty : null,
      dayPreference: typeof parsed?.dayPreference === 'string' ? parsed.dayPreference : null,
      clarifyingQuestion: typeof parsed?.clarifyingQuestion === 'string' ? parsed.clarifyingQuestion : null,
    }
  } catch {
    return null
  }
}

async function freeSlots(hospitalId, doctorId, limit = 2) {
  const slots = []
  const perDay = []
  const start = new Date()

  for (let offset = 0; offset < 14; offset += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + offset)
    const date = localDate(day)

    const taken = await Appointment.find({
      hospital: hospitalId,
      doctor: doctorId,
      date,
      status: { $ne: 'cancelled' },
    }).select('time')

    const takenTimes = new Set(taken.map((row) => row.time))
    let dayFirst = null

    for (const time of TIMES) {
      if (takenTimes.has(time)) continue
      if (offset === 0 && time <= nowTime()) continue

      const option = { date, time }
      dayFirst = dayFirst ?? option

      // Prefer a different day per option: two slots half an hour apart on the same
      // morning are not a real choice.
      if (!slots.some((existing) => existing.date === date)) {
        slots.push(option)
      }

      break
    }

    if (dayFirst) perDay.push(dayFirst)
    if (slots.length >= limit) break
  }

  // Nothing spread across days: fall back to the earliest openings, whatever they are.
  while (slots.length < limit && perDay.length > slots.length) {
    const next = perDay.find((option) => !slots.some((existing) => existing.date === option.date && existing.time === option.time))
    if (!next) break
    slots.push(next)
  }

  return slots.slice(0, limit)
}

function describeOptions(doctor, options) {
  const spoken = options
    .map((option) => `${formatDate(option.date)} at ${option.time}`)
    .join(', or ')

  return `We have openings with ${doctor.name}${doctor.specialty ? ` (${doctor.specialty})` : ''}: ${spoken}. Which works better?`
}

async function findDoctor(hospitalId, specialty) {
  const filter = { hospital: hospitalId, role: 'doctor', status: 'active' }

  if (specialty) {
    const doctor = await Staff.findOne({ ...filter, specialty })
    if (doctor) return doctor
  }

  return Staff.findOne(filter).sort({ name: 1 })
}

function pickOption(intent, options) {
  if (!options.length) return null

  if (intent.ordinal !== null && options[intent.ordinal]) return options[intent.ordinal]

  if (intent.weekday) {
    const target = WEEKDAYS.indexOf(intent.weekday)
    const match = options.find(
      (option) => new Date(`${option.date}T00:00:00`).getDay() === target,
    )
    if (match) return match
  }

  if (intent.period) {
    const match = options.find((option) => {
      const hour = Number(option.time.slice(0, 2))
      if (intent.period === 'morning') return hour < 12
      if (intent.period === 'afternoon') return hour >= 12 && hour < 17
      return hour >= 17
    })
    if (match) return match
  }

  if (intent.affirmative) return options[0]

  return null
}

router.post('/turn', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''

  if (text.length < 2 || text.length > 500) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Say something between 2 and 500 characters.', [
      { field: 'text', message: '2-500 characters.' },
    ])
  }

  const source = req.body?.source === 'text' ? 'text' : 'voice'
  let session = null

  if (req.body?.sessionId && mongoose.isValidObjectId(req.body.sessionId)) {
    session = await VoiceSession.findOne({ _id: req.body.sessionId, patient: req.user.id })
  }

  const hospital = await Hospital.findOne({
    _id: mongoose.isValidObjectId(req.body?.hospitalId) ? req.body.hospitalId : session?.hospital,
    status: 'approved',
  })

  if (!hospital) {
    throw new HttpError(404, 'NOT_FOUND', 'Pick a hospital first.')
  }

  if (!session) {
    session = await VoiceSession.create({ patient: req.user.id, hospital: hospital._id, source })
  }

  const intent = parseIntent(text)
  session.turns.push({ role: 'patient', text, intent })
  session.transcript = `${session.transcript}${session.transcript ? '\n' : ''}Patient: ${text}`.slice(-4000)

  let reply = ''

  const wantsNewSearch =
    intent.specialty ||
    intent.widen ||
    (!intent.affirmative && !intent.ordinal && session.state !== 'offered')

  if (wantsNewSearch || session.state === 'start') {
    let specialty = intent.specialty

    if (!specialty) {
      const fallback = await llmIntent(text, SPECIALTIES)
      specialty = fallback?.specialty ?? null
    }

    const doctor = await findDoctor(hospital._id, specialty)

    if (!doctor) {
      reply = `${hospital.name} has not listed any doctors for booking yet. Please call the hospital and the front desk will help.`
      session.state = 'ended'
      session.outcome = 'no-doctor'
    } else {
      const options = await freeSlots(hospital._id, doctor._id, 2)

      if (!options.length) {
        reply = `I could not find a free slot with ${doctor.name} in the next two weeks. Would you like me to widen the search to any doctor at ${hospital.name}?`
        session.state = 'start'
        session.outcome = 'no-availability'
      } else {
        session.options = options.map((option) => ({ ...option, doctorId: doctor._id.toString(), doctorName: doctor.name }))
        session.state = 'offered'
        reply = describeOptions(doctor, options)
      }
    }
  } else if (session.state === 'offered') {
    const chosen = pickOption(intent, session.options)

    if (!chosen) {
      reply = 'Sorry, I did not catch that. Would you prefer the first option or the second?'
    } else {
      session.chosen = chosen
      session.state = 'confirming'
      reply = `Just to confirm: ${formatDate(chosen.date)} at ${chosen.time} with ${chosen.doctorName}. Shall I book it?`
    }
  } else if (session.state === 'confirming') {
    if (intent.negative) {
      session.state = 'offered'
      session.chosen = null
      reply = 'No problem. Would you like the other option, or shall I look further ahead?'
    } else if (intent.affirmative || intent.ordinal !== null) {
      const chosen = session.chosen

      if (!chosen) {
        session.state = 'offered'
        reply = 'Which of the two options would you like?'
      } else {
        const clash = await Appointment.exists({
          hospital: hospital._id,
          doctor: chosen.doctorId,
          date: chosen.date,
          time: chosen.time,
          status: { $ne: 'cancelled' },
        })

        if (clash) {
          const doctor = await Staff.findById(chosen.doctorId)
          const alternatives = await freeSlots(hospital._id, chosen.doctorId, 2)
          session.options = alternatives.map((option) => ({
            ...option,
            doctorId: chosen.doctorId,
            doctorName: doctor?.name ?? chosen.doctorName,
          }))
          session.chosen = null
          session.state = alternatives.length ? 'offered' : 'ended'
          reply = alternatives.length
            ? `That slot was just taken. ${describeOptions(doctor ?? { name: chosen.doctorName }, alternatives)}`
            : 'That slot was just taken and I have no alternatives in the next two weeks. Please call the hospital.'
          session.outcome = 'slot-taken'
        } else {
          const appointment = await Appointment.create({
            hospital: hospital._id,
            doctor: chosen.doctorId,
            doctorName: chosen.doctorName,
            date: chosen.date,
            time: chosen.time,
            reason: 'Booked through the Aurora voice assistant',
            patientUser: req.user._id,
            patientName: req.user.name,
            source: 'ai',
            aiNote: 'Booked by the Aurora voice agent',
          })

          session.appointment = appointment._id
          session.state = 'booked'
          session.outcome = 'booked'
          reply = `You're all set for ${formatDate(chosen.date)} at ${chosen.time} with ${chosen.doctorName}. See you then!`
        }
      }
    } else {
      reply = 'Shall I book it? Say yes, or tell me the other option.'
    }
  } else {
    reply = `Your appointment is booked. Ask me for another visit any time.`
  }

  session.turns.push({ role: 'agent', text: reply, options: session.options })
  session.transcript = `${session.transcript}\nAgent: ${reply}`.slice(-4000)
  await session.save()

  res.json({
    data: {
      sessionId: session.id,
      state: session.state,
      reply,
      options: session.state === 'offered' ? session.options : [],
      appointmentId: session.appointment,
      hospital: { id: hospital.id, name: hospital.name, city: hospital.city },
    },
  })
})

router.post('/confirm', async (req, res) => {
  const session = await VoiceSession.findOne({
    _id: mongoose.isValidObjectId(req.body?.sessionId) ? req.body.sessionId : null,
    patient: req.user.id,
  })

  if (!session) {
    throw new HttpError(404, 'NOT_FOUND', 'That booking session has expired. Start again.')
  }

  const index = Number(req.body?.optionIndex)
  const option = session.options[index]

  if (!option) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose one of the offered slots.', [
      { field: 'optionIndex', message: '0 or 1.' },
    ])
  }

  const clash = await Appointment.exists({
    hospital: session.hospital,
    doctor: option.doctorId,
    date: option.date,
    time: option.time,
    status: { $ne: 'cancelled' },
  })

  if (clash) {
    throw new HttpError(409, 'CONFLICT', 'That slot was just taken — pick another one.')
  }

  const appointment = await Appointment.create({
    hospital: session.hospital,
    doctor: option.doctorId,
    doctorName: option.doctorName,
    date: option.date,
    time: option.time,
    reason: 'Booked through the Aurora voice assistant',
    patientUser: req.user._id,
    patientName: req.user.name,
    source: 'ai',
    aiNote: 'Booked by the Aurora voice agent',
  })

  session.appointment = appointment._id
  session.state = 'booked'
  session.outcome = 'booked'
  session.turns.push({
    role: 'agent',
    text: `Booked ${option.date} ${option.time} with ${option.doctorName}.`,
  })
  await session.save()

  res.json({
    data: {
      sessionId: session.id,
      appointment,
      reply: `You're booked for ${formatDate(option.date)} at ${option.time} with ${option.doctorName}. See you then!`,
    },
  })
})

router.post('/end', async (req, res) => {
  const session = await VoiceSession.findOne({
    _id: mongoose.isValidObjectId(req.body?.sessionId) ? req.body.sessionId : null,
    patient: req.user.id,
  })

  if (!session) {
    throw new HttpError(404, 'NOT_FOUND', 'Session not found.')
  }

  if (session.state !== 'booked') {
    session.state = 'ended'
    session.outcome = typeof req.body?.outcome === 'string' ? req.body.outcome.slice(0, 120) : 'abandoned'
  }

  await session.save()
  res.json({ data: { sessionId: session.id, state: session.state, outcome: session.outcome } })
})

router.get('/sessions', async (req, res) => {
  const sessions = await VoiceSession.find({ patient: req.user.id })
    .sort({ createdAt: -1 })
    .limit(10)

  res.json({ data: sessions, meta: { count: sessions.length } })
})

module.exports = router
