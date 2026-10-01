const HttpError = require('./http-error')

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_STT_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'
const DEFAULT_MODEL = 'openai/gpt-oss-120b'
const DEFAULT_STT_MODEL = 'whisper-large-v3-turbo'

async function chat({ messages, temperature = 0.2, maxTokens = 400, asJson = false }) {
  const { content } = await chatDetailed({ messages, temperature, maxTokens, asJson })
  return content
}

/** Same call, but also returns token usage for audit logging. */
async function chatDetailed({ messages, temperature = 0.2, maxTokens = 400, asJson = false }) {
  if (!process.env.GROQ_API_KEY) {
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'The assistant is not configured yet.')
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(asJson ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    console.error('Groq request failed with status', response.status)
    throw new HttpError(
      503,
      'SERVICE_UNAVAILABLE',
      'The assistant is unavailable right now. Try again in a moment.',
    )
  }

  const payload = await response.json().catch(() => null)
  const content = payload?.choices?.[0]?.message?.content

  if (typeof content !== 'string' || !content.trim()) {
    console.error('Groq returned an empty completion.')
    throw new HttpError(
      503,
      'SERVICE_UNAVAILABLE',
      'The assistant returned an empty answer. Try again in a moment.',
    )
  }

  return {
    content,
    model: payload?.model ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL,
    usage: {
      promptTokens: payload?.usage?.prompt_tokens ?? 0,
      completionTokens: payload?.usage?.completion_tokens ?? 0,
      totalTokens: payload?.usage?.total_tokens ?? 0,
    },
  }
}

function parseJsonContent(content) {
  try {
    return JSON.parse(content)
  } catch {
    console.error('Groq returned a completion that was not valid JSON.')
    throw new HttpError(
      503,
      'SERVICE_UNAVAILABLE',
      'The assistant could not answer that. Try rephrasing.',
    )
  }
}

/** Speech-to-text: Whisper on Groq, used by the voice booking agent. */
async function transcribe(buffer, mimeType = 'audio/webm') {
  if (!process.env.GROQ_API_KEY) {
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Speech recognition is not configured yet.')
  }

  const form = new FormData()
  const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'

  form.append('file', new Blob([buffer], { type: mimeType }), `recording.${extension}`)
  form.append('model', process.env.GROQ_STT_MODEL || DEFAULT_STT_MODEL)
  form.append('language', 'en')
  form.append('response_format', 'json')

  const response = await fetch(GROQ_STT_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    console.error('Groq transcription failed with status', response.status)
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Could not transcribe that recording. Try again.')
  }

  const payload = await response.json().catch(() => null)
  const text = typeof payload?.text === 'string' ? payload.text.trim() : ''

  if (!text) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'I could not hear anything in that recording.')
  }

  return { text, model: process.env.GROQ_STT_MODEL || DEFAULT_STT_MODEL }
}

module.exports = { chat, chatDetailed, parseJsonContent, transcribe }
