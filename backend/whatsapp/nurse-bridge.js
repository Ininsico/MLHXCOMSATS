/**
 * WhatsApp bridge for Nurse Aria.
 *
 * Runs beside the API (not inside it): links the hospital's WhatsApp account with
 * whatsapp-web.js + LocalAuth, forwards every incoming message to
 * POST /api/nurse/webhook, then replies with the agent's text — typing indicator
 * first, so patients see a human rhythm.
 *
 *   npm run whatsapp        # first run prints a QR code to scan
 *
 * Sessions persist in .wwebjs_auth/, so the QR is only needed once. The account
 * must stay connected: keep this process running with the phone online.
 */

const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')

const API_URL = (process.env.AURORA_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const TOKEN = process.env.NURSE_WEBHOOK_TOKEN || 'aurora-nurse-bridge-local'
const HOSPITAL_NAME = process.env.NURSE_HOSPITAL_NAME || 'Aurora'
const IGNORED = (process.env.NURSE_IGNORE_NUMBERS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'aurora-nurse' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
})

let ready = false

client.on('qr', (qr) => {
  console.log('\nScan this QR code with the hospital WhatsApp account (Linked devices):\n')
  qrcode.generate(qr, { small: true })
})

client.on('ready', () => {
  ready = true
  console.log('Nurse Aria is connected. Messages will be answered automatically.')
})

client.on('auth_failure', (message) => console.error('WhatsApp authentication failed:', message))
client.on('disconnected', (reason) => {
  ready = false
  console.error('WhatsApp disconnected:', reason)
})

client.on('message', async (message) => {
  if (!ready) return
  if (message.from === 'status@broadcast' || message.from.endsWith('@g.us')) return

  const phone = message.from.replace(/@c\.us$/, '')
  const text = (message.body || '').trim()

  if (!text || IGNORED.includes(phone)) return

  try {
    const response = await fetch(`${API_URL}/api/whatsapp/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nurse-token': TOKEN },
      body: JSON.stringify({ phone, text, name: message._data?.notifyName || '' }),
    })

    const payload = await response.json().catch(() => null)
    const reply = payload?.data?.reply

    if (!reply) {
      console.warn(`No reply for ${phone} (HTTP ${response.status})`)
      return
    }

    // Typing indicator is cosmetic and its API moved between releases — never let
    // it stop the reply from going out.
    try {
      const chat = await message.getChat()
      await chat.sendStateTyping()
    } catch (typingError) {
      console.warn('typing indicator skipped:', typingError.message)
    }

    await new Promise((resolve) => setTimeout(resolve, payload?.data?.typingDelayMs ?? 1500))

    try {
      await message.reply(reply)
    } catch (replyError) {
      console.warn('reply() failed, sending directly:', replyError.message)
      await client.sendMessage(message.from, reply)
    }

    console.log(`→ ${phone} (${payload.data.agent}): ${reply.slice(0, 90)}`)

    if (payload?.data?.escalated || payload?.data?.crisis) {
      console.warn(`⚠ Escalated: ${phone} — ${payload.data.escalationReason ?? 'crisis language'}`)
    }
  } catch (error) {
    console.error('Bridge error:', error.message)
  }
})

/**
 * Outbound queue: the API cannot send WhatsApp messages itself (the session lives
 * here), so it queues them and this polls. Reminders, "report is ready" notices and
 * escalation acknowledgements all travel this way.
 */
async function drainOutbox() {
  if (!ready) return

  try {
    const response = await fetch(`${API_URL}/api/whatsapp/outbox/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nurse-token': TOKEN },
      body: JSON.stringify({ limit: 10 }),
    })

    if (!response.ok) return

    const payload = await response.json().catch(() => null)
    const messages = payload?.data ?? []

    for (const message of messages) {
      try {
        const resolved = await Promise.race([
          client.getNumberId(message.phone),
          new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
        ])

        const target = resolved?._serialized ?? `${message.phone}@c.us`

        // sendMessage also hangs on an unregistered number — bound it, or the drain
        // stalls and the message quietly burns its attempts.
        await Promise.race([
          client.sendMessage(target, message.text),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('send timed out after 15s')), 15000),
          ),
        ])

        await fetch(`${API_URL}/api/whatsapp/outbox/${message.id}/sent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-nurse-token': TOKEN },
          body: JSON.stringify({}),
        }).catch(() => {})

        console.log(`out → ${message.phone} (${message.kind}): ${message.text.slice(0, 80)}`)
      } catch (error) {
        console.warn(`outbound failed for ${message.phone}: ${error.message}`)
        await fetch(`${API_URL}/api/whatsapp/outbox/${message.id}/failed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-nurse-token': TOKEN },
          body: JSON.stringify({ error: error.message }),
        }).catch(() => {})
      }
    }
  } catch (error) {
    console.warn('outbox poll failed:', error.message)
  }
}

setInterval(drainOutbox, 5000)

console.log(`Nurse bridge starting — API ${API_URL}`)
client.initialize()
