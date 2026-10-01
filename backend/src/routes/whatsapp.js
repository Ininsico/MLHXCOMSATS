const express = require('express')
const mongoose = require('mongoose')
const Appointment = require('../models/appointment')
const Hospital = require('../models/hospital')
const NurseSession = require('../models/nurse-session')
const OutboxMessage = require('../models/outbox-message')
const Staff = require('../models/staff')
const WhatsappThread = require('../models/whatsapp-thread')
const HttpError = require('../lib/http-error')
const { findPersona, JSON_SHAPE } = require('../lib/aurora-personas')
const { routeAgent, graphPrompt } = require('../lib/agent-router')
const { TIMES, localDate } = require('../lib/slots')
const audit = require('../lib/audit')
const { checkQuota } = require('../lib/quota')
const { handleIncoming } = require('../lib/nurse')
const { chatDetailed, parseJsonContent } = require('../lib/groq')
const jobs = require('../lib/queue')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

const CRISIS_PATTERN =
  /(suicid|kill myself|kill me|end my life|end it all|don'?t want to (live|be here)|do not want to (live|be here)|not want to live|want to die|no reason to live|better off dead|self[- ]harm|hurt myself|cut myself|overdose)/i

const CRISIS_REPLY = `I'm really glad you told me. This needs a person, right now — not a chat.

Please call your local emergency number or a crisis helpline immediately, and tell someone near you how you're feeling. I'm alerting a clinician at the hospital so a human follows up with you.`

const WHATSAPP_ADDENDUM = `You are answering on WhatsApp, so: keep replies short (under 600 characters), plain, and warm. One question at a time.
You can explain how the hospital works, what a department does, how to book, and what to bring. You cannot see appointments or change records in this chat — if the patient needs a booking or their reports, tell them to open the Aurora app, or say the front desk will call them back.
Never ask for passwords, card numbers, or ID documents in this chat.`

function requireBridgeToken(req) {
  const expected = process.env.NURSE_WEBHOOK_TOKEN

  if (!expected) {
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Set NURSE_WEBHOOK_TOKEN in backend/.env.')
  }

  if (req.headers['x-nurse-token'] !== expected) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid bridge token.')
  }
}

/** Clinical knowledge from the local corpus (ai-service RAG). Best effort. */
async function corpusSearch(question) {
  const base = process.env.AI_SERVICE_URL

  if (!base || process.env.AI_ENABLED === 'false') return []

  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: String(question).slice(0, 480), k: 3 }),
      signal: AbortSignal.timeout(4000),
    })

    if (!response.ok) return []

    const payload = await response.json().catch(() => null)
    const chunks = payload?.chunks ?? payload?.results ?? payload?.documents ?? []

    return chunks
      .map((chunk) => ({
        text: String(chunk.text ?? chunk.content ?? chunk.chunk ?? '').slice(0, 500),
        source: String(chunk.source ?? chunk.heading ?? 'corpus').slice(0, 80),
      }))
      .filter((chunk) => chunk.text)
      .slice(0, 3)
  } catch {
    return []
  }
}

/** The booking agent: same slot rules as the app, but over chat and without an account. */
const BOOKING_WORDS = /(book|appointment|see a doctor|schedule a visit|reschedule|check ?up)/i
const AFFIRMATIVE = /\b(yes|yeah|yep|sure|ok|okay|confirm|book it|that works|please do|go ahead)\b/i
const NEGATIVE = /\b(no|nope|neither|cancel|not that)\b/i
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function formatDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function nowTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/** Two openings on different days where possible. */
async function openSlots(hospitalId, doctorId, limit = 2) {
  const slots = []
  const start = new Date()

  for (let offset = 0; offset < 14 && slots.length < limit; offset += 1) {
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

    for (const time of TIMES) {
      if (takenTimes.has(time)) continue
      if (offset === 0 && time <= nowTime()) continue
      if (slots.some((slot) => slot.date === date)) break

      slots.push({ date, time })
      break
    }
  }

  return slots
}

function pickOffered(booking, text) {
  if (!booking?.options?.length) return null

  if (/\b(first|1st|one)\b/i.test(text)) return booking.options[0]
  if (/\b(second|2nd|two)\b/i.test(text)) return booking.options[1] ?? null

  const weekday = WEEKDAYS.find((day) => text.toLowerCase().includes(day))

  if (weekday) {
    const target = WEEKDAYS.indexOf(weekday)
    const match = booking.options.find(
      (option) => new Date(`${option.date}T00:00:00`).getDay() === target,
    )
    if (match) return match
  }

  if (AFFIRMATIVE.test(text)) return booking.options[0]

  return null
}

async function runBooking({ thread, text, route }) {
  const booking = thread.booking

  // Aurora is the front door, not one hospital's desk: when the hospital is not yet
  // known, ask which one — and accept whichever the patient names.
  if (booking?.state === 'choose_hospital') {
    const hospitals = await Hospital.find({ status: 'approved' }).sort({ rating: -1 }).limit(6)
    const lower = text.toLowerCase()

    const named = hospitals.find(
      (hospital) =>
        lower.includes(hospital.name.toLowerCase()) ||
        (hospital.city && lower.includes(hospital.city.toLowerCase())),
    )

    if (!named) {
      return {
        reply: `Happy to book that. Which hospital would you like? ${hospitals
          .map((hospital) => `${hospital.name}${hospital.city ? ` (${hospital.city})` : ''}`)
          .join(', ')}.`,
        agent: 'booking',
      }
    }

    thread.hospital = named._id
    thread.booking = null
  }

  // Confirming a chosen slot.
  if (booking?.state === 'confirming' && booking.chosen) {
    if (NEGATIVE.test(text)) {
      thread.booking = { ...booking, state: 'offered', chosen: null }
      return {
        reply: 'No problem. Would you like the other opening, or shall I look further ahead?',
        agent: 'booking',
      }
    }

    if (!AFFIRMATIVE.test(text)) {
      return {
        reply: `Shall I book ${formatDay(booking.chosen.date)} at ${booking.chosen.time} with ${booking.chosen.doctorName}?`,
        agent: 'booking',
      }
    }

    const clash = await Appointment.exists({
      hospital: thread.hospital,
      doctor: booking.chosen.doctorId,
      date: booking.chosen.date,
      time: booking.chosen.time,
      status: { $ne: 'cancelled' },
    })

    if (clash) {
      const alternatives = await openSlots(thread.hospital, booking.chosen.doctorId, 2)

      if (!alternatives.length) {
        thread.booking = null
        return { reply: 'That slot was just taken and I have nothing else in the next two weeks. Please call the front desk.', agent: 'booking' }
      }

      thread.booking = {
        specialty: booking.specialty,
        options: alternatives.map((slot) => ({ ...slot, doctorId: booking.chosen.doctorId, doctorName: booking.chosen.doctorName })),
        chosen: null,
        state: 'offered',
      }

      return {
        reply: `That one was just taken. ${alternatives
          .map((slot) => `${formatDay(slot.date)} at ${slot.time}`)
          .join(', or ')} — which suits you?`,
        agent: 'booking',
      }
    }

    const appointment = await Appointment.create({
      hospital: thread.hospital,
      doctor: booking.chosen.doctorId,
      doctorName: booking.chosen.doctorName,
      specialty: booking.specialty,
      date: booking.chosen.date,
      time: booking.chosen.time,
      reason: 'Booked through WhatsApp',
      patientName: thread.name || 'WhatsApp patient',
      patientPhone: thread.phone,
      patientUser: null,
      source: 'ai',
      aiNote: 'Booked by Aurora on WhatsApp',
      status: 'requested',
    })

    thread.booking = null

    return {
      reply: `You're all set for ${formatDay(booking.chosen.date)} at ${booking.chosen.time} with ${booking.chosen.doctorName}. The hospital will confirm shortly — see you then!`,
      agent: 'booking',
      appointment,
    }
  }

  // Choosing from the offered slots.
  if (booking?.state === 'offered') {
    const chosen = pickOffered(booking, text)

    if (!chosen) {
      return {
        reply: `Would you prefer ${booking.options
          .map((slot, index) => `${index === 0 ? 'the first' : 'the second'} (${formatDay(slot.date)} at ${slot.time})`)
          .join(' or ')}?`,
        agent: 'booking',
      }
    }

    thread.booking = { ...booking, chosen, state: 'confirming' }

    return {
      reply: `Just to confirm: ${formatDay(chosen.date)} at ${chosen.time} with ${chosen.doctorName}. Shall I book it?`,
      agent: 'booking',
    }
  }

  // A fresh booking request.
  let hospital = thread.hospital ? await Hospital.findById(thread.hospital) : null

  if (!hospital) {
    const approved = await Hospital.find({ status: 'approved' }).sort({ rating: -1 }).limit(6)

    if (approved.length > 1) {
      thread.booking = { specialty: route.specialty ?? '', options: [], chosen: null, state: 'choose_hospital' }

      return {
        reply: `I can book that for you. Which hospital would you like? ${approved
          .map((entry) => `${entry.name}${entry.city ? ` (${entry.city})` : ''}`)
          .join(', ')}.`,
        agent: 'booking',
      }
    }

    hospital = approved[0] ?? null
  }

  if (!hospital) {
    return { reply: 'No hospital is available for booking yet — please call the front desk.', agent: 'booking' }
  }

  thread.hospital = hospital._id

  const wanted = route.specialty !== 'general' ? route.specialty : ''

  const doctor =
    (wanted
      ? await Staff.findOne({ hospital: hospital._id, role: 'doctor', status: 'active', specialty: new RegExp(wanted, 'i') })
      : null) ??
    (await Staff.findOne({ hospital: hospital._id, role: 'doctor', status: 'active' }).sort({ name: 1 }))

  if (!doctor) {
    return { reply: `${hospital.name} has no doctors listed for booking yet — the front desk can help.`, agent: 'booking' }
  }

  const options = await openSlots(hospital._id, doctor._id, 2)

  if (!options.length) {
    return { reply: `I could not find a free slot with ${doctor.name} in the next two weeks. Would you like me to try another doctor?`, agent: 'booking' }
  }

  thread.booking = {
    specialty: doctor.specialty ?? '',
    options: options.map((slot) => ({ ...slot, doctorId: doctor._id.toString(), doctorName: doctor.name })),
    chosen: null,
    state: 'offered',
  }

  return {
    reply: `I can book you with ${doctor.name}${doctor.specialty ? ` (${doctor.specialty})` : ''} at ${hospital.name}: ${options
      .map((slot) => `${formatDay(slot.date)} at ${slot.time}`)
      .join(', or ')}. Which works better?`,
    agent: 'booking',
  }
}

/** Inbound WhatsApp message → the right agent → the text to send back. */
router.post('/turn', async (req, res) => {
  requireBridgeToken(req)

  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : ''
  const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 1200) : ''
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : ''

  if (!phone || !text) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send a phone number and a message.')
  }

  // A patient in an active discharge follow-up keeps talking to the nurse.
  const nurseSession = await NurseSession.findOne({
    phone,
    status: { $in: ['active'] },
  })

  if (nurseSession) {
    const result = await handleIncoming({ phone, text, source: 'whatsapp' })

    return res.json({
      data: { ...result, agent: 'nurse', typingDelayMs: result.typingDelayMs },
    })
  }

  let thread = await WhatsappThread.findOne({ phone })

  if (!thread) {
    thread = await WhatsappThread.create({ phone, name })
  } else if (name && !thread.name) {
    thread.name = name
  }

  thread.messages.push({ role: 'patient', text })
  thread.lastMessageAt = new Date()

  if (CRISIS_PATTERN.test(text)) {
    thread.messages.push({ role: 'aurora', text: CRISIS_REPLY })
    thread.crisis = true
    await thread.save()

    await jobs.publish({
      type: 'aurora.crisis',
      phone,
      patientName: thread.name || phone,
      persona: 'whatsapp',
      severity: 'high',
      escalationReason: 'Crisis language on WhatsApp',
    })

    return res.json({ data: { reply: CRISIS_REPLY, crisis: true, agent: 'aurora', typingDelayMs: 1200 } })
  }

  // Quota: a hospital over its monthly token allowance stops getting AI answers,
  // with a message the patient can act on rather than a silent failure.
  if (thread.hospital) {
    const quota = await checkQuota(thread.hospital)

    if (!quota.allowed) {
      const reply = `This hospital's AI allowance for the month is used up (${quota.used} of ${quota.limit} tokens). Please call the front desk — a human will help you right away.`

      thread.messages.push({ role: 'aurora', text: reply })
      await thread.save()

      await audit.record(
        { userId: null, user: { name: thread.name || phone, role: 'patient' } },
        {
          action: 'quota.blocked',
          subjectType: 'Hospital',
          subjectId: String(thread.hospital),
          hospital: thread.hospital,
          summary: `WhatsApp turn blocked at ${quota.used}/${quota.limit} tokens`,
        },
      )

      return res.json({ data: { reply, crisis: false, agent: 'quota', typingDelayMs: 800 } })
    }
  }

  // Pick the agent for this message, then ground it: knowledge graph + corpus.
  const route = routeAgent(text)

  // Actions come first: a booking request is handled by the booking agent, never by
  // the language model — and never while the message reads as an emergency.
  // An in-progress booking is driven by conversation state, not by keywords: once
  // slots are offered, every next message belongs to the booking agent until the
  // booking is made or dropped.
  const bookingInProgress = Boolean(thread.booking)

  if ((bookingInProgress || BOOKING_WORDS.test(text)) && route.urgency !== 'emergency') {
    const booking = await runBooking({ thread, text, route })

    thread.messages.push({ role: 'aurora', text: booking.reply })
    await thread.save()

    if (booking.appointment) {
      await audit.record(
        { userId: null, user: { name: thread.name || thread.phone, role: 'patient' } },
        {
          action: 'appointment.booked_via_whatsapp',
          subjectType: 'Appointment',
          subjectId: booking.appointment._id,
          hospital: thread.hospital,
          summary: `Booked ${booking.appointment.date} ${booking.appointment.time} over WhatsApp (${phone})`,
        },
      )

      await OutboxMessage.create({
        phone,
        text: `Aurora: your request for ${booking.appointment.date} at ${booking.appointment.time} is with the hospital. They will confirm shortly.`,
        kind: 'notice',
        patientName: thread.name,
      })

      await jobs.publish({
        type: 'appointment.booked',
        phone,
        severity: 'low',
        step: 'whatsapp-booking',
      })
    }

    return res.json({
      data: {
        reply: booking.reply,
        crisis: false,
        agent: 'booking',
        appointmentId: booking.appointment?.id ?? null,
        typingDelayMs: 1000 + Math.floor(Math.random() * 2000),
      },
    })
  }

  const persona = findPersona(route.specialty) ?? findPersona('general')
  const sources = await corpusSearch(text)

  const memoryBlock = thread.memories.length
    ? `What you already know about this person:\n${thread.memories.slice(-8).map((item) => `- ${item}`).join('\n')}`
    : 'You have not spoken with this person before.'

  const corpusBlock = sources.length
    ? `Hospital corpus passages (use only if relevant; never quote them as a diagnosis):\n${sources
        .map((source, index) => `[${index + 1}] ${source.source}: ${source.text}`)
        .join('\n')}`
    : 'No corpus passages were retrieved for this message.'

  let reply = ''
  let memory = null
  let usage = { totalTokens: 0 }
  let model = ''

  try {
    const result = await chatDetailed({
      messages: [
        {
          role: 'system',
          content: `${persona.prompt}\n\n${WHATSAPP_ADDENDUM}\n\n${graphPrompt(route)}\n\n${corpusBlock}\n\n${memoryBlock}\n\n${JSON_SHAPE}`,
        },
        ...thread.messages.slice(-12).map((message) => ({
          role: message.role === 'patient' ? 'user' : 'assistant',
          content: message.text,
        })),
      ],
      asJson: true,
      temperature: 0.4,
      maxTokens: 700,
    })

    const parsed = parseJsonContent(result.content)
    reply = typeof parsed?.reply === 'string' ? parsed.reply.trim().slice(0, 1200) : ''
    memory = typeof parsed?.memory === 'string' ? parsed.memory.trim().slice(0, 300) : null
    usage = result.usage
    model = result.model
  } catch (error) {
    console.error('WhatsApp Aurora turn failed:', error.message)
  }

  if (!reply) {
    reply = 'Sorry — I could not reach my brain for a second there. Could you send that again?'
  }

  thread.messages.push({ role: 'aurora', text: reply, memory })
  if (memory) thread.memories.push(memory)
  thread.model = model
  thread.totalTokens += usage.totalTokens ?? 0
  await thread.save()

  await jobs.publish({
    type: 'aurora.turn',
    phone,
    persona: 'whatsapp',
    step: 'whatsapp',
    severity: 'low',
    totalTokens: usage.totalTokens ?? 0,
  })

  res.json({
    data: {
      reply,
      crisis: false,
      agent: route.specialty,
      agentName: persona.name,
      concepts: route.graph.direct,
      related: route.graph.related,
      urgency: route.graph.urgency,
      sources: sources.map((source) => source.source),
      memory,
      model,
      typingDelayMs: 1000 + Math.floor(Math.random() * 2000),
    },
  })
})

router.get('/threads', requireAuth, requireRole('admin', 'hospital'), async (req, res) => {
  const threads = await WhatsappThread.find({}).sort({ lastMessageAt: -1 }).limit(30)

  res.json({
    data: threads.map((thread) => ({
      id: thread.id,
      phone: thread.phone,
      name: thread.name,
      crisis: thread.crisis,
      messages: thread.messages.length,
      preview: thread.messages.at(-1)?.text?.slice(0, 140) ?? '',
      lastMessageAt: thread.lastMessageAt,
    })),
    meta: { count: threads.length },
  })
})

/** Queue something for the bridge to send (reminders, notices, escalations). */
router.post('/outbox', async (req, res) => {
  const internal = req.headers['x-nurse-token'] === process.env.NURSE_WEBHOOK_TOKEN

  if (!internal) {
    // Not the bridge: require a signed-in admin or hospital account.
    await new Promise((resolve) => requireAuth(req, res, resolve))
    if (!req.user) return
    await new Promise((resolve) => requireRole('admin', 'hospital')(req, res, resolve))
    if (!req.user) return
  }

  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : ''
  const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 2000) : ''

  if (!phone || !text) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send a phone number and a message.')
  }

  const message = await OutboxMessage.create({
    phone,
    text,
    kind: ['reminder', 'notice', 'escalation', 'reply'].includes(req.body?.kind) ? req.body.kind : 'notice',
    patientName: typeof req.body?.patientName === 'string' ? req.body.patientName.slice(0, 80) : '',
    meta: req.body?.meta ?? null,
  })

  await jobs.publish({ type: 'whatsapp.outbox', phone, kind: message.kind, severity: 'low' })

  res.json({ data: message })
})

/** Read one queued message's delivery status — how the health of the outbox is seen. */
router.get('/outbox/:messageId', async (req, res) => {
  const internal = req.headers['x-nurse-token'] === process.env.NURSE_WEBHOOK_TOKEN

  if (!internal) {
    await new Promise((resolve) => requireAuth(req, res, resolve))
    if (!req.user) return
    await new Promise((resolve) => requireRole('admin', 'hospital')(req, res, resolve))
    if (!req.user) return
  }

  const message = await OutboxMessage.findOne({
    _id: mongoose.isValidObjectId(req.params.messageId) ? req.params.messageId : null,
  })

  if (!message) {
    throw new HttpError(404, 'NOT_FOUND', 'Outbox message not found.')
  }

  res.json({
    data: {
      id: message.id,
      phone: message.phone,
      kind: message.kind,
      status: message.status,
      attempts: message.attempts,
      sentAt: message.sentAt,
      error: message.error,
    },
  })
})

/** Bridge pulls what to send next. Delivery is only confirmed by /sent. */
router.post('/outbox/pull', async (req, res) => {
  requireBridgeToken(req)

  const limit = Math.min(20, Math.max(1, Number(req.body?.limit) || 10))
  const maxAttempts = 3

  // A message that keeps failing stops being handed out — but it is kept, not lost.
  await OutboxMessage.updateMany(
    { status: 'pending', attempts: { $gte: maxAttempts } },
    { $set: { status: 'failed', error: 'gave up after repeated attempts' } },
  )

  const pending = await OutboxMessage.find({ status: 'pending', attempts: { $lt: maxAttempts } })
    .sort({ createdAt: 1 })
    .limit(limit)

  if (pending.length) {
    await OutboxMessage.updateMany(
      { _id: { $in: pending.map((message) => message._id) } },
      { $inc: { attempts: 1 } },
    )
  }

  res.json({
    data: pending.map((message) => ({
      id: message.id,
      phone: message.phone,
      text: message.text,
      kind: message.kind,
      attempt: message.attempts + 1,
    })),
  })
})

/** Bridge confirms a real delivery — only now is the message marked sent. */
router.post('/outbox/:messageId/sent', async (req, res) => {
  requireBridgeToken(req)

  const message = await OutboxMessage.findOneAndUpdate(
    { _id: mongoose.isValidObjectId(req.params.messageId) ? req.params.messageId : null },
    { status: 'sent', sentAt: new Date(), error: '' },
    { new: true },
  )

  if (!message) {
    throw new HttpError(404, 'NOT_FOUND', 'Outbox message not found.')
  }

  res.json({ data: { id: message.id, status: message.status } })
})

/** Bridge reports a delivery failure — the message stays pullable until the cap. */
router.post('/outbox/:messageId/failed', async (req, res) => {
  requireBridgeToken(req)

  const message = await OutboxMessage.findOneAndUpdate(
    { _id: mongoose.isValidObjectId(req.params.messageId) ? req.params.messageId : null },
    {
      error: typeof req.body?.error === 'string' ? req.body.error.slice(0, 200) : 'send failed',
    },
    { new: true },
  )

  if (!message) {
    throw new HttpError(404, 'NOT_FOUND', 'Outbox message not found.')
  }

  await OutboxMessage.updateOne(
    { _id: message._id, attempts: { $gte: 3 } },
    { $set: { status: 'failed' } },
  )

  res.json({ data: { id: message.id, status: message.status, attempts: message.attempts } })
})

module.exports = router
