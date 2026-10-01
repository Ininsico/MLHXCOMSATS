/**
 * Payment requests that are not about a visit — today, the hospital's platform
 * subscription. Same engine as appointment payments: an exact amount, a destination,
 * a holdings baseline, and receipt proven by incoming money only.
 */

const PaymentIntent = require('../models/payment-intent')
const binance = require('./binance')
const { pkrToUsdt } = require('./fx')

/** Where a hospital's payment should be sent. */
function destination() {
  const id = (process.env.BINANCE_PAY_ID || '').trim()
  const email = (process.env.BINANCE_PAY_EMAIL || '').trim()

  return {
    payToId: id,
    payToEmail: email,
    payToLabel: (process.env.BINANCE_PAY_LABEL || 'Aurora').trim(),
    describe: id ? `Binance ID ${id}` : email ? `the Binance account ${email}` : '(no destination configured)',
  }
}

function reference() {
  return `AUR-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

/**
 * Opens a payment request for a subscription request and returns it with the
 * instructions the hospital should follow. A tiny offset keeps two open requests
 * distinguishable, and the holdings baseline is captured so receipt can be proven
 * even when an internal transfer never appears in deposit history.
 */
async function createSubscriptionIntent({ hospital, request, coin = 'USDT' }) {
  const target = destination()

  // The plan is priced in PKR; the rail moves USDT. Convert properly — a Rs 4,900 plan
  // is ~15 USDT, not 4,900.
  const pricePkr = Math.max(0, Number(request.amount) || 0)
  const converted = pkrToUsdt(pricePkr)
  const baseAmount = converted.usdt
  const offset = Math.round((0.0001 + Math.random() * 0.0009) * 10000) / 10000
  const amount = Math.round((baseAmount + offset) * 10000) / 10000

  let baseline = null

  try {
    const holdings = await binance.totalHoldings()
    baseline = holdings[coin] ?? 0
  } catch (error) {
    console.warn('Could not snapshot the subscription baseline:', error.message)
  }

  const intent = await PaymentIntent.create({
    patient: hospital.owner ?? null,
    patientName: hospital.name,
    hospital: hospital._id,
    purpose: 'subscription',
    subscriptionRequest: request._id,
    payToId: target.payToId,
    payToEmail: target.payToEmail,
    payToLabel: target.payToLabel,
    coin,
    baseAmount,
    amount,
    pricePkr,
    fxRate: converted.rate,
    fxTo: coin,
    reference: reference(),
    baseline,
    expiresAt: new Date(Date.now() + Number(process.env.BINANCE_INTENT_TTL_MINUTES || 120) * 60000),
  })

  return {
    intent,
    instructions: `Send exactly ${amount} ${coin} (Rs ${pricePkr.toLocaleString('en-US')} at ${converted.rate} PKR per ${coin}) from the hospital's Binance account to ${target.describe}, then press "Check for payment". Approval follows the verified payment automatically.`,
  }
}

module.exports = { createSubscriptionIntent, destination }
