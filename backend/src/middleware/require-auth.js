const jwt = require('jsonwebtoken')
const HttpError = require('../lib/http-error')
const { COOKIE_NAME } = require('../lib/auth')

function requireAuth(req, res, next) {
  const header = req.headers.authorization
  const token =
    req.cookies?.[COOKIE_NAME] || (header?.startsWith('Bearer ') ? header.slice(7) : null)

  if (!token) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'Sign in to continue.'))
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = payload.sub
    return next()
  } catch {
    return next(new HttpError(401, 'UNAUTHORIZED', 'Your session has expired. Sign in again.'))
  }
}

module.exports = requireAuth
