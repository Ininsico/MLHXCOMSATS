const crypto = require('crypto')
const HttpError = require('./http-error')

const DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/
const MAX_DATA_URL_LENGTH = 6_000_000
const DEFAULT_FOLDER = 'aurora/hospitals'

function signParameters(parameters, apiSecret) {
  return crypto.createHash('sha1').update(parameters + apiSecret).digest('hex')
}

async function uploadImage(dataUrl, { folder = DEFAULT_FOLDER } = {}) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Image uploads are not configured yet.')
  }

  if (typeof dataUrl !== 'string' || !DATA_URL_PATTERN.test(dataUrl)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send an image as a base64 data URL.', [
      { field: 'dataUrl', message: 'Only png, jpg, or webp images are supported.' },
    ])
  }

  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Image is too large — keep it under 4 MB.', [
      { field: 'dataUrl', message: 'Max 4 MB.' },
    ])
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const signedParameters = `folder=${folder}&timestamp=${timestamp}`

  const form = new FormData()
  form.append('file', dataUrl)
  form.append('api_key', apiKey)
  form.append('timestamp', String(timestamp))
  form.append('folder', folder)
  form.append('signature', signParameters(signedParameters, apiSecret))

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30000),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.secure_url) {
    console.error('Cloudinary upload failed with status', response.status)
    throw new HttpError(
      503,
      'SERVICE_UNAVAILABLE',
      'The image could not be uploaded. Try again in a moment.',
    )
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id,
    width: payload.width,
    height: payload.height,
  }
}

module.exports = { uploadImage }
