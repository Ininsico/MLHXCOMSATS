const Hospital = require('../models/hospital')
const HttpError = require('../lib/http-error')

async function requireHospital(req, res, next) {
  const hospital = await Hospital.findOne({ owner: req.user.id })

  if (!hospital) {
    return next(new HttpError(404, 'NOT_FOUND', 'No hospital is linked to this account yet.'))
  }

  req.hospital = hospital
  return next()
}

module.exports = requireHospital
