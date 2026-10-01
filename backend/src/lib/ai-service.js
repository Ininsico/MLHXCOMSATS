const HttpError = require('./http-error')

const DEFAULT_TIMEOUT_MS = 200_000

function baseUrl() {
  return (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
}

function unavailable(message) {
  return new HttpError(503, 'SERVICE_UNAVAILABLE', message)
}

async function request(path, { method = 'GET', body, form, timeoutMs } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: form ? undefined : body ? { 'Content-Type': 'application/json' } : undefined,
      body: form ?? (body ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const detail = payload?.detail
      throw unavailable(typeof detail === 'string' ? detail : 'The local model could not answer that.')
    }

    return payload
  } catch (error) {
    if (error instanceof HttpError) throw error

    if (error.name === 'AbortError') {
      throw unavailable('The local model took too long to answer. Try a smaller scan or raise the timeout.')
    }

    throw unavailable(
      'The local AI service is not reachable. Start it with "uvicorn app.main:app" inside ai-service/.',
    )
  } finally {
    clearTimeout(timer)
  }
}

function health() {
  return request('/health', { timeoutMs: 6000 })
}

function analyzeImage({ buffer, filename, mimeType, question, maxTokens, temperature, timeoutMs }) {
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: mimeType }), filename)
  if (question) form.append('question', question)
  if (maxTokens) form.append('max_tokens', String(maxTokens))
  if (temperature !== undefined && temperature !== null) form.append('temperature', String(temperature))

  return request('/analyze-image', { method: 'POST', form, timeoutMs })
}

function chat({ messages, maxTokens, temperature, timeoutMs }) {
  return request('/chat', {
    method: 'POST',
    body: { messages, max_tokens: maxTokens, temperature },
    timeoutMs,
  })
}

module.exports = { health, analyzeImage, chat, baseUrl }
