/**
 * Signed, expiring links for patient-facing resources (lab reports first).
 *
 * The token is an HMAC over the resource id and an expiry, so a shared link cannot
 * be guessed, altered, or used after it lapses — no session required to open it,
 * which is the point of sharing with another clinician.
 */

const crypto = require('crypto')

const SECRET = process.env.SESSION_SECRET || 'aurora-dev-share-secret'
const DEFAULT_TTL_HOURS = 72

function base64url(value) {
  return Buffer.from(value).toString('base64url')
}

function sign({ id, ttlHours = DEFAULT_TTL_HOURS }) {
  const exp = Date.now() + ttlHours * 60 * 60 * 1000
  const payload = base64url(JSON.stringify({ id: String(id), exp }))
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')

  return { token: `${payload}.${signature}`, expiresAt: new Date(exp) }
}

function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'malformed' }

  const [payload, signature] = token.split('.')
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')

  const provided = Buffer.from(signature ?? '')
  const wanted = Buffer.from(expected)

  if (provided.length !== wanted.length || !crypto.timingSafeEqual(provided, wanted)) {
    return { ok: false, reason: 'bad-signature' }
  }

  let parsed = null

  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  if (!parsed?.id || typeof parsed.exp !== 'number') return { ok: false, reason: 'malformed' }
  if (Date.now() > parsed.exp) return { ok: false, reason: 'expired' }

  return { ok: true, id: parsed.id, expiresAt: new Date(parsed.exp) }
}

module.exports = { sign, verify, DEFAULT_TTL_HOURS }
