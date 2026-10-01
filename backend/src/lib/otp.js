const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const LoginCode = require('../models/login-code')
const HttpError = require('./http-error')

const CODE_TTL_MINUTES = 10
const CODE_TTL_MS = CODE_TTL_MINUTES * 60 * 1000
const MAX_ATTEMPTS = 5
const MAX_CODES_PER_WINDOW = 3
const WINDOW_MS = 15 * 60 * 1000

async function issueCode(email, purpose) {
  const recent = await LoginCode.countDocuments({
    email,
    purpose,
    createdAt: { $gte: new Date(Date.now() - WINDOW_MS) },
  })

  if (recent >= MAX_CODES_PER_WINDOW) {
    throw new HttpError(
      429,
      'RATE_LIMITED',
      'Too many codes requested for this email. Wait a few minutes and try again.',
    )
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const codeHash = await bcrypt.hash(code, 10)

  await LoginCode.create({
    email,
    purpose,
    codeHash,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  })

  return { code, expiresInMinutes: CODE_TTL_MINUTES }
}

async function consumeCode(email, purpose, code) {
  const record = await LoginCode.findOne({
    email,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 })

  if (!record) {
    throw new HttpError(401, 'UNAUTHORIZED', 'That code has expired. Request a new one.')
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many incorrect attempts. Request a new code.')
  }

  const matches = await bcrypt.compare(String(code ?? ''), record.codeHash)

  if (!matches) {
    record.attempts += 1
    await record.save()
    throw new HttpError(401, 'UNAUTHORIZED', 'That code is not correct. Check the email and try again.')
  }

  record.consumedAt = new Date()
  await record.save()

  return true
}

module.exports = { issueCode, consumeCode }
