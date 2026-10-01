const HttpError = require('../lib/http-error')

function notFound(req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'Route not found.'))
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }

  let status = 500
  let code = 'INTERNAL'
  let message = 'Something went wrong.'

  if (err instanceof HttpError) {
    status = err.status
    code = err.code
    message = err.message
  } else if (err.type === 'entity.parse.failed') {
    status = 400
    code = 'VALIDATION_ERROR'
    message = 'Request body must be valid JSON.'
  } else if (err.type === 'entity.too.large') {
    status = 413
    code = 'VALIDATION_ERROR'
    message = 'Request body is too large.'
  }

  if (status >= 500) {
    console.error(err)
  }

  const body = { error: { code, message } }
  if (err instanceof HttpError && err.details) {
    body.error.details = err.details
  }

  res.status(status).json(body)
}

module.exports = { notFound, errorHandler }
