const HttpError = require('./http-error')

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

function isConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.SENDER_EMAIL)
}

async function sendEmail({ to, subject, html, text }) {
  if (!isConfigured()) {
    console.warn('Brevo is not configured — skipped an outgoing email.')
    return { skipped: true }
  }

  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: process.env.SENDER_EMAIL,
        name: process.env.SENDER_NAME || 'Aurora',
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    console.error('Brevo rejected an outgoing email with status', response.status)
    throw new HttpError(
      503,
      'SERVICE_UNAVAILABLE',
      'We could not send the email right now. Try again in a moment.',
    )
  }

  return response.json().catch(() => ({}))
}

async function sendEmailQuietly(payload) {
  try {
    return await sendEmail(payload)
  } catch (err) {
    console.error('Outgoing email failed:', err.message)
    return { failed: true }
  }
}

module.exports = { sendEmail, sendEmailQuietly }
