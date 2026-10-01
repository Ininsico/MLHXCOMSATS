const jwt = require('jsonwebtoken')

const COOKIE_NAME = 'aurora_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

function signToken(userId) {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not set — add it to backend/.env')
  }
  return jwt.sign({ sub: userId }, secret, { expiresIn: '7d' })
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
  }
}

function startSession(res, user) {
  res.cookie(COOKIE_NAME, signToken(user.id), {
    ...cookieOptions(),
    maxAge: SESSION_DURATION_MS,
  })
}

module.exports = { COOKIE_NAME, SESSION_DURATION_MS, signToken, cookieOptions, startSession }
