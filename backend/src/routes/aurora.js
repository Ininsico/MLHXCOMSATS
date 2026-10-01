const express = require('express')
const mongoose = require('mongoose')
const AuroraChat = require('../models/aurora-chat')
const AuroraMemory = require('../models/aurora-memory')
const HttpError = require('../lib/http-error')
const { findPersona, publicPersonas, JSON_SHAPE } = require('../lib/aurora-personas')
const { chatDetailed, parseJsonContent } = require('../lib/groq')
const jobs = require('../lib/queue')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

const CRISIS_PATTERN =
  /(suicid|kill myself|kill me|end my life|end it all|don'?t want to (live|be here)|do not want to (live|be here)|not want to live|want to die|no reason to live|better off dead|self[- ]harm|hurt myself|cut myself|overdose)/i

const CRISIS_REPLY = `I'm really glad you told me. What you're describing needs a person, right now — not an app.

Please contact your local emergency number or a crisis helpline immediately, and tell someone near you how you're feeling. I'm alerting a clinician at your hospital so a human follows up with you.

I'm still here with you in this conversation.`

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'have', 'from', 'about', 'been', 'were', 'they',
  'what', 'when', 'your', 'you', 'are', 'was', 'not', 'but', 'all', 'can', 'just', 'like', 'feel',
])

function keywords(text) {
  return [...new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOPWORDS.has(word)),
  )].slice(0, 24)
}

/** Embed one remembered line per patient into the local vector store. */
async function embedMemory({ patientId, persona, text, memoryId }) {
  const base = process.env.AI_SERVICE_URL

  if (!base || process.env.AI_ENABLED === 'false') return false

  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/rag/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${persona} memory ${String(memoryId).slice(-6)}`,
        // The source field carries the patient, which is how retrieval stays scoped:
        // hits are filtered to this patient before they are ever shown to a model.
        text: `Patient memory (${persona}): ${text}`,
        source: `patient:${patientId}`,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) return false

    await AuroraMemory.updateOne({ _id: memoryId }, { embedded: true, embeddedAt: new Date() })
    return true
  } catch {
    return false
  }
}

/** Semantic recall from the vector store, restricted to this patient's embeddings. */
async function vectorRecall({ patientId, text, limit = 6 }) {
  const base = process.env.AI_SERVICE_URL

  if (!base || process.env.AI_ENABLED === 'false') return []

  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: String(text).slice(0, 480), k: 8 }),
      signal: AbortSignal.timeout(6000),
    })

    if (!response.ok) return []

    const payload = await response.json().catch(() => null)
    const hits = payload?.data ?? []

    return hits
      .filter((hit) => hit.source === `patient:${patientId}`)
      .map((hit) => (hit.preview ?? '').replace(/^Patient memory \([^)]+\):\s*/, '').trim())
      .filter(Boolean)
      .slice(0, limit)
  } catch {
    return []
  }
}

/** Rank this patient's memories against the new message — their own history only. */
async function recallMemories({ patient, persona, text, limit = 8 }) {
  const memories = await AuroraMemory.find({ patient, persona }).sort({ createdAt: -1 }).limit(60)

  if (!memories.length) return { memories: [], vectors: [] }

  const wanted = keywords(text)

  const scored = memories.map((memory) => {
    const haystack = memory.text.toLowerCase()
    const overlap = wanted.filter((word) => haystack.includes(word)).length
    const ageDays = (Date.now() - new Date(memory.updatedAt).getTime()) / 86_400_000

    return { memory, score: overlap * 2 + Math.max(0, 2 - ageDays / 30) }
  })

  const ranked = scored
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.memory)

  // Vector hits are a second opinion on relevance, never a different patient's data.
  const vectors = await vectorRecall({ patientId: String(patient), text })

  const seen = new Set(ranked.map((memory) => memory.text))
  const extra = vectors.filter((line) => !seen.has(line))

  return { memories: ranked, vectors: extra }
}

router.get('/personas', requireAuth, requireRole('patient', 'admin'), (req, res) => {
  res.json({ data: publicPersonas() })
})

router.get('/sessions', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  const filter = { patient: req.user.id }
  if (typeof req.query.persona === 'string' && req.query.persona) filter.persona = req.query.persona

  const sessions = await AuroraChat.find(filter).sort({ updatedAt: -1 }).limit(20)

  res.json({
    data: sessions.map((session) => ({
      id: session.id,
      persona: session.persona,
      title: session.title,
      messages: session.messages.length,
      crisis: session.crisis,
      updatedAt: session.updatedAt,
      preview: session.messages.at(-1)?.text?.slice(0, 120) ?? '',
    })),
    meta: { count: sessions.length },
  })
})

router.get('/sessions/:sessionId', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  const session = await AuroraChat.findOne({
    _id: mongoose.isValidObjectId(req.params.sessionId) ? req.params.sessionId : null,
    patient: req.user.id,
  })

  if (!session) {
    throw new HttpError(404, 'NOT_FOUND', 'That conversation has gone.')
  }

  res.json({ data: session })
})

router.get('/memories', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  const filter = { patient: req.user.id }
  if (typeof req.query.persona === 'string' && req.query.persona) filter.persona = req.query.persona

  const memories = await AuroraMemory.find(filter).sort({ createdAt: -1 }).limit(60)

  res.json({ data: memories, meta: { count: memories.length } })
})

router.delete('/memories/:memoryId', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  const memory = await AuroraMemory.findOneAndDelete({
    _id: mongoose.isValidObjectId(req.params.memoryId) ? req.params.memoryId : null,
    patient: req.user.id,
  })

  if (!memory) {
    throw new HttpError(404, 'NOT_FOUND', 'That memory is not here.')
  }

  res.json({ data: { deleted: true } })
})

router.post('/chat', requireAuth, requireRole('patient', 'admin'), async (req, res) => {
  const persona = findPersona(typeof req.body?.persona === 'string' ? req.body.persona : '')
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''

  if (!persona) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose one of Aurora\'s assistants.', [
      { field: 'persona', message: 'Unknown assistant.' },
    ])
  }

  if (text.length < 2 || text.length > 2000) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Write between 2 and 2000 characters.', [
      { field: 'text', message: 'Between 2 and 2000 characters.' },
    ])
  }

  let session = null

  if (req.body?.sessionId && mongoose.isValidObjectId(req.body.sessionId)) {
    session = await AuroraChat.findOne({ _id: req.body.sessionId, patient: req.user.id, persona: persona.id })
  }

  if (!session) {
    session = await AuroraChat.create({
      patient: req.user.id,
      persona: persona.id,
      title: text.slice(0, 100),
    })
  }

  session.messages.push({ role: 'user', text })

  // ---- crisis path: no model, no improvisation -----------------------------
  if (CRISIS_PATTERN.test(text)) {
    session.messages.push({ role: 'aurora', text: CRISIS_REPLY, memory: null })
    session.crisis = true
    await session.save()

    await jobs.publish({
      type: 'aurora.crisis',
      patientId: String(req.user.id),
      patientName: req.user.name,
      persona: persona.id,
      sessionId: String(session._id),
      severity: 'high',
      escalationReason: 'Crisis language in an Aurora conversation',
    })

    return res.json({
      data: {
        sessionId: session.id,
        reply: CRISIS_REPLY,
        memory: null,
        mood: null,
        crisis: true,
        recalled: [],
        model: null,
      },
    })
  }

  const { memories: recalled, vectors: vectorHits } = await recallMemories({
    patient: req.user.id,
    persona: persona.id,
    text,
  })

  const history = session.messages.slice(-10).map((message) => ({
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.text,
  }))

  const memoryBlock = recalled.length
    ? `What you remember about this patient so far:\n${recalled
        .map((memory) => `- ${memory.text}`)
        .join('\n')}`
    : 'You have no earlier notes about this patient.'

  const vectorBlock = vectorHits.length
    ? `\nRelated things this patient said before (found by meaning, not keywords):\n${vectorHits
        .map((line) => `- ${line}`)
        .join('\n')}`
    : ''

  let reply = ''
  let memory = null
  let mood = null
  let usage = { totalTokens: 0 }
  let model = ''

  try {
    const result = await chatDetailed({
      messages: [
        { role: 'system', content: `${persona.prompt}\n\n${memoryBlock}${vectorBlock}\n\n${JSON_SHAPE}` },
        ...history,
      ],
      asJson: true,
      temperature: persona.id === 'therapy' ? 0.6 : 0.3,
      maxTokens: 800,
    })

    const parsed = parseJsonContent(result.content)
    reply = typeof parsed?.reply === 'string' ? parsed.reply.trim().slice(0, 1200) : ''
    memory = typeof parsed?.memory === 'string' ? parsed.memory.trim().slice(0, 300) : null
    mood = typeof parsed?.mood === 'string' ? parsed.mood.trim().slice(0, 40) : null
    usage = result.usage
    model = result.model
  } catch (error) {
    console.error('Aurora chat failed:', error.message)
  }

  if (!reply) {
    reply =
      'I lost my train of thought for a moment — the assistant is having trouble reaching its model. Could you send that again in a second?'
  }

  session.messages.push({ role: 'aurora', text: reply, memory })
  session.model = model
  session.totalTokens += usage.totalTokens ?? 0
  await session.save()

  if (memory) {
    const stored = await AuroraMemory.create({
      patient: req.user.id,
      persona: persona.id,
      text: memory,
      kind: persona.id === 'therapy' ? 'session' : 'fact',
      source: session._id,
    })

    // Embed it so future sessions can find it by meaning, not just by keyword.
    embedMemory({
      patientId: String(req.user.id),
      persona: persona.id,
      text: memory,
      memoryId: stored._id,
    }).catch(() => {})
  }

  await jobs.publish({
    type: 'aurora.turn',
    patientId: String(req.user.id),
    persona: persona.id,
    sessionId: String(session._id),
    step: persona.id,
    severity: 'low',
    totalTokens: usage.totalTokens ?? 0,
  })

  res.json({
    data: {
      sessionId: session.id,
      reply,
      memory,
      mood,
      crisis: false,
      recalled: recalled.map((entry) => entry.text),
      recalledByMeaning: vectorHits,
      model,
      usage,
    },
  })
})

module.exports = router
