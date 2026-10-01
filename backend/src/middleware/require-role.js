const User = require('../models/user')
const HttpError = require('../lib/http-error')

function requireRole(...roles) {
  return async function roleGuard(req, res, next) {
    const user = await User.findById(req.userId)

    if (!user) {
      return next(new HttpError(401, 'UNAUTHORIZED', 'Account not found. Sign in again.'))
    }
    if (!roles.includes(user.role)) {
      return next(new HttpError(403, 'FORBIDDEN', 'You do not have access to this area.'))
    }

    req.user = user
    next()
  }
}

module.exports = requireRole
