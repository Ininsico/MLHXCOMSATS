/**
 * Nurse Aria — WhatsApp post-discharge follow-up agent.
 *
 * Runs the dialogue, enforces the escalation rules, logs every turn (with token
 * usage) and publishes audit events to RabbitMQ. Transport (WhatsApp or the
 * built-in simulator) is someone else's job: this module only needs { phone, text }.
 */

const NurseSession = require('../models/nurse-session')
const NurseTurn = require('../models/nurse-turn')
const { chatDetailed, parseJsonContent } = require('./groq')
const jobs = require('./queue')

const STEPS = ['greeting', 'med_check', 'adherence', 'symptom_check', 'appointment', 'closing']

const CRITICAL_PATTERNS = [
  { pattern: /chest pain|chest tightness|pressure in my chest/i, reason: 'Chest pain reported' },
  { pattern: /shortness of breath|breathless|can't breathe|cannot breathe|difficulty breathing/i, reason: 'Breathing difficulty reported' },
  { pattern: /suicid|self[- ]harm|hurt myself|end my life/i, reason: 'Self-harm risk reported' },
  { pattern: /bleeding heavily|heavy bleeding|won't stop bleeding/i, reason: 'Severe bleeding reported' },
  { pattern: /unconscious|passed out|fainted/i, reason: 'Loss of consciousness reported' },
]

const SYMPTOM_WORDS = [
  'pain', 'fever', 'nausea', 'vomiting', 'dizzy', 'dizziness', 'cough', 'swelling',
  'rash', 'bleeding', 'fatigue', 'chills', 'headache', 'diarrhoea', 'diarrhea', 'sore',
]

const FALLBACK_QUESTIONS = {
  greeting: (name) => `Hello, this is Nurse Aria from the hospital. Is this ${name}?`,
  med_check: () => 'Are you taking all of the medicines the doctor prescribed?',
  adherence: () => 'How many doses have you missed in the last two days?',
  symptom_check: () => 'Any fever, pain, bleeding, or breathlessness since you got home?',
  appointment: () => 'Would you like me to book your follow-up appointment?',
  closing: () => 'Thanks for talking with me. I am here whenever you need me.',
}

function detectSafetyNet(text) {
  const critical = CRITICAL_PATTERNS.find((entry) => entry.pattern.test(text))
  const symptoms = SYMPTOM_WORDS.filter((word) => new RegExp(`\\b${word}`, 'i').test(text))
  return { critical, symptoms }
}

function systemPrompt({ session, hospitalName }) {
  return `You are Nurse Aria, an AI follow-up nurse working for ${hospitalName || 'the hospital'}.
You are doing a post-discharge check-in over WhatsApp with ${session.patientName}.

Current dialogue step: ${session.step}.
Steps in order: greeting → med_check → adherence → symptom_check → appointment → closing.

Rules:
- Ask ONE short question tied to the current step. Keep spoken_response under 320 characters.
- Warm, plain, human. No medical diagnosis, no prescriptions, no doses of your own.
- Escalate (needs_escalation = true) for chest pain, breathing difficulty, suicidal thinking, heavy bleeding, or two or more new symptoms.
- If the patient is not the right person or asks you to stop, say you will pass it to the care team.

Reply with JSON only, exactly this shape:
{
  "dialogue_act": "greet" | "ask" | "acknowledge" | "escalate" | "close",
  "spoken_response": "the message to send back on WhatsApp",
  "symptoms_reported": ["short symptom", "short symptom"],
  "needs_escalation": false,
  "escalation_reason": null
}`
}

function buildMessages(session, hospitalName) {
  const history = session.history.slice(-12).map((entry) => ({
    role: entry.role === 'patient' ? 'user' : 'assistant',
    content: entry.text,
  }))

  return [{ role: 'system', content: systemPrompt({ session, hospitalName }) }, ...history]
}

/** Advance one step for the next question, once the patient has answered. */
function nextStep(step) {
  const index = STEPS.indexOf(step)
  return STEPS[Math.min(STEPS.length - 1, index + 1)]
}

async function loadOrCreateSession({ phone, patientName, hospital, program, patientUser }) {
  const existing = await NurseSession.findOne({ phone, status: { $in: ['active', 'escalated'] } })

  if (existing) return existing

  return NurseSession.create({
    phone,
    patientName: patientName ?? 'the patient',
    hospital: hospital ?? null,
    patientUser: patientUser ?? null,
    program: program ?? 'Post-discharge follow-up',
  })
}

/**
 * Handle one incoming WhatsApp message and return the reply to send back.
 * Returns { reply, step, status, escalated, escalationReason, typingDelayMs, sessionId }
 */
async function handleIncoming({ phone, text, patientName, hospital, hospitalName, source = 'whatsapp' }) {
  const session = await loadOrCreateSession({ phone, patientName, hospital })
  const cleanText = String(text ?? '').trim().slice(0, 1200)

  session.history.push({ role: 'patient', text: cleanText })
  session.lastMessageAt = new Date()

  const safety = detectSafetyNet(cleanText)
  const started = Date.now()

  let output = null
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  let model = ''

  try {
    const result = await chatDetailed({
      messages: buildMessages(session, hospitalName),
      temperature: 0.3,
      maxTokens: 400,
      asJson: true,
    })

    const parsed = parseJsonContent(result.content)
    usage = result.usage
    model = result.model

    output = {
      dialogue_act: typeof parsed?.dialogue_act === 'string' ? parsed.dialogue_act : 'ask',
      spoken_response:
        typeof parsed?.spoken_response === 'string' && parsed.spoken_response.trim()
          ? parsed.spoken_response.trim().slice(0, 600)
          : FALLBACK_QUESTIONS[session.step](session.patientName),
      symptoms_reported: Array.isArray(parsed?.symptoms_reported)
        ? parsed.symptoms_reported.filter((item) => typeof item === 'string').slice(0, 6)
        : [],
      needs_escalation: Boolean(parsed?.needs_escalation),
      escalation_reason: typeof parsed?.escalation_reason === 'string' ? parsed.escalation_reason : null,
    }
  } catch (error) {
    // The agent must answer even when the model is unreachable.
    console.warn('Nurse model call failed, using the scripted question:', error.message)
    output = {
      dialogue_act: 'ask',
      spoken_response: FALLBACK_QUESTIONS[session.step](session.patientName),
      symptoms_reported: [],
      needs_escalation: false,
      escalation_reason: null,
    }
  }

  // ---- escalation: the model's call, plus a deterministic safety net --------
  const reported = [...new Set([...(output.symptoms_reported ?? []), ...safety.symptoms])]
  session.symptoms = [...new Set([...session.symptoms, ...reported])].slice(0, 12)

  let escalated = Boolean(output.needs_escalation)
  let escalationReason = output.escalation_reason

  if (safety.critical) {
    escalated = true
    escalationReason = safety.critical.reason
  } else if (session.symptoms.length >= 2) {
    escalated = true
    escalationReason = escalationReason ?? `${session.symptoms.length} symptoms reported (${session.symptoms.slice(0, 3).join(', ')})`
  }

  if (escalated) {
    session.status = 'escalated'
    session.escalations.push({ reason: escalationReason ?? 'Escalation requested', at: new Date() })
    output.dialogue_act = 'escalate'
    output.spoken_response = `I'm connecting you to a nurse right now — please stay by your phone.`
    output.needs_escalation = true
    output.escalation_reason = escalationReason
  } else if (session.step === 'closing' || output.dialogue_act === 'close') {
    session.status = 'completed'
  }

  session.history.push({ role: 'nurse', text: output.spoken_response })
  session.step = escalated ? session.step : nextStep(session.step)
  await session.save()

  const latencyMs = Date.now() - started

  await NurseTurn.create({
    session: session._id,
    phone: session.phone,
    step: session.step,
    transcript: cleanText,
    output,
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    escalated,
    latencyMs,
  })

  await jobs.publish({
    type: escalated ? 'nurse.escalation' : 'nurse.turn',
    phone: session.phone,
    patientName: session.patientName,
    sessionId: String(session._id),
    step: session.step,
    severity: escalated ? 'high' : 'low',
    escalationReason: escalated ? output.escalation_reason : null,
    totalTokens: usage.totalTokens,
    latencyMs,
    source,
  })

  return {
    sessionId: String(session._id),
    reply: output.spoken_response,
    step: session.step,
    status: session.status,
    escalated,
    escalationReason: output.escalation_reason,
    symptoms: session.symptoms,
    typingDelayMs: 1000 + Math.floor(Math.random() * 2000),
    usage,
  }
}

module.exports = { handleIncoming, STEPS, detectSafetyNet }
