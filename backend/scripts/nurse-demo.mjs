/**
 * Nurse Aria demo — runs the post-discharge conversation without WhatsApp.
 *
 *   npm run nurse:demo                 # the full scripted demo
 *   npm run nurse:demo -- +923001234567 John
 *
 * It talks to the same endpoint the WhatsApp bridge uses, so what you see here is
 * exactly what a patient would get on their phone.
 */

const API = process.env.AURORA_API_URL || 'http://localhost:3000'
const TOKEN = process.env.NURSE_WEBHOOK_TOKEN || 'aurora-nurse-bridge-local'

const phone = process.argv[2] || `demo-${Date.now()}`
const patientName = process.argv[3] || 'John'

const script = [
  'Hi',
  'Yes, this is John. I am feeling okay but a bit tired.',
  'I am taking the tablets, though I missed one yesterday.',
  'I have been having chest pain since last night and it is getting worse.',
]

async function send(text) {
  const response = await fetch(`${API}/api/nurse/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nurse-token': TOKEN },
    body: JSON.stringify({ phone, text, patientName, hospitalName: 'Cedar Valley General Hospital' }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }

  return (await response.json()).data
}

console.log(`Nurse Aria demo — patient ${patientName} (${phone})\n`)

for (const line of script) {
  console.log(`patient › ${line}`)
  const turn = await send(line)

  console.log(`nurse   › ${turn.reply}`)
  console.log(
    `          step=${turn.step} status=${turn.status} escalated=${turn.escalated}` +
      `${turn.escalationReason ? ` reason="${turn.escalationReason}"` : ''}` +
      ` tokens=${turn.usage?.totalTokens ?? 0}\n`,
  )

  if (turn.escalated) {
    console.log('⚠ RED FLAG — the hospital dashboard alert feed now carries this patient.')
    console.log('  (RabbitMQ: a nurse.escalation job was published to aurora.ai.jobs.)')
    break
  }
}

console.log('Demo complete.')
