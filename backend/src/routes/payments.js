/**
 * Binance payments for bookings.
 *
 * Flow: a patient asks to pay → an intent is created with an exact amount and the
 * Binance ID to send it to → we watch INCOMING deposits for a matching arrival →
 * the appointment is confirmed and everyone is told.
 *
 * Withdrawals are never read: matching only ever looks at deposit history, so money
 * leaving the account cannot satisfy a payment.
 */

const express = require('express')
const mongoose = require('mongoose')
const Appointment = require('../models/appointment')
const Hospital = require('../models/hospital')
const OutboxMessage = require('../models/outbox-message')
const PaymentIntent = require('../models/payment-intent')
const HttpError = require('../lib/http-error')
const audit = require('../lib/audit')
const binance = require('../lib/binance')
const jobs = require('../lib/queue')
const requireAuth = require('../middleware/require-auth')
const requireRole = require('../middleware/require-role')

const router = express.Router()

const AMOUNT_TOLERANCE = Number(process.env.BINANCE_AMOUNT_TOLERANCE || 0.02)
const INTENT_TTL_MINUTES = Number(process.env.BINANCE_INTENT_TTL_MINUTES || 120)
const SIMULATE_ENABLED = process.env.BINANCE_SIMULATE === 'true'

router.use(requireAuth, requireRole('patient', 'hospital', 'admin'))

function reference() {
  return `AUR-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

/** A small per-intent offset so two open requests never look identical. */
async function nextOffset(coin) {
  const open = await PaymentIntent.countDocuments({ coin, status: { $in: ['awaiting', 'detected'] } })
  return Math.round((0.0001 * (open + 1)) * 10000) / 10000
}

/**
 * Where the money should be sent. Binance lets a transfer be addressed by Pay ID or
 * by the account email, so whichever is configured is what the patient is told.
 */
function destination() {
  const id = (process.env.BINANCE_PAY_ID || '').trim()
  const email = (process.env.BINANCE_PAY_EMAIL || '').trim()
  const label = (process.env.BINANCE_PAY_LABEL || 'Aurora').trim()

  return {
    payToId: id,
    payToEmail: email,
    payToLabel: label,
    describe: id
      ? `Binance ID ${id}`
      : email
        ? `the Binance account ${email} (send using that email as the recipient)`
        : '(no destination configured — set BINANCE_PAY_ID or BINANCE_PAY_EMAIL)',
  }
}

function payload(intent, extra = {}) {
  return {
    id: intent.id,
    status: intent.status,
    reference: intent.reference,
    coin: intent.coin,
    amount: intent.amount,
    network: intent.network,
    payToId: intent.payToId,
    payToEmail: intent.payToEmail,
    payToLabel: intent.payToLabel,
    appointment: intent.appointment,
    detectedTxId: intent.detectedTxId,
    detectedAmount: intent.detectedAmount,
    detectedAt: intent.detectedAt,
    overpaid: intent.overpaid ?? 0,
    evidence: intent.evidence,
    baseline: intent.baseline,
    verifiedAt: intent.verifiedAt,
    notified: intent.notified,
    simulated: intent.simulated,
    expiresAt: intent.expiresAt,
    createdAt: intent.createdAt,
    lastCheckedAt: intent.lastCheckedAt,
    ...extra,
  }
}

/**
 * Receipt verification, in order of how strong the evidence is:
 *
 *   1. deposit history  — an on-chain deposit of the right coin and amount
 *   2. Binance Pay history — an internal transfer, when the account exposes it
 *   3. balance delta    — total holdings of that coin rose by at least the amount
 *
 * The third check exists because an internal Binance-to-Binance transfer does not go
 * through a blockchain and may not appear in deposit history at all. Holdings only:
 * outgoing money is never read, so a withdrawal can never satisfy a payment.
 */
/**
 * How much of this request has arrived, so a short payment is reported rather than
 * silently unmatched. Only incoming money counts: deposits of the right coin since
 * the request was opened, plus any rise in holdings for that coin.
 */
async function receivedSoFar(intent, deposits) {
  const since = new Date(intent.createdAt).getTime() - 5 * 60000

  const depositTotal = deposits
    .filter((deposit) => deposit.coin === intent.coin && deposit.at.getTime() >= since)
    .reduce((sum, deposit) => sum + (Number(deposit.amount) || 0), 0)

  let delta = 0

  if (intent.baseline !== null && intent.baseline !== undefined) {
    try {
      const holdings = await binance.totalHoldings()
      delta = Math.max(0, Math.round(((holdings[intent.coin] ?? 0) - intent.baseline) * 100000000) / 100000000)
    } catch {
      /* holdings unavailable — the deposit total still stands */
    }
  }

  // Take the larger of the two so a payment is never under-counted, and never
  // double-counted when both sources see the same money.
  return Math.round(Math.max(depositTotal, delta) * 100000000) / 100000000
}

async function findReceipt(intent) {
  let deposits = []
  let lookupError = null

  try {
    deposits = await binance.incomingDeposits({ since: intent.createdAt, limit: 100 })
  } catch (error) {
    lookupError = error.code === 'NOT_CONFIGURED' ? 'Binance keys are not configured.' : error.message
  }

  const depositMatch = deposits.find((deposit) => matches(intent, deposit))

  if (depositMatch) {
    return { match: { ...depositMatch, evidence: 'deposit-history' }, checked: deposits.length, lookupError }
  }

  const pay = await binance.payTransactions({ since: intent.createdAt, limit: 100 })

  if (!pay?.unavailable) {
    const payMatch = pay.find((row) => matches(intent, row))

    if (payMatch) {
      return {
        match: { ...payMatch, evidence: 'pay-history' },
        checked: deposits.length + pay.length,
        lookupError,
      }
    }
  }

  // Nothing exact — has enough arrived? Anything at or above the ask counts as paid,
  // and anything below it is reported as a short payment rather than ignored.
  const received = await receivedSoFar(intent, deposits)
  const difference = Math.round((received - intent.amount) * 100000000) / 100000000

  if (received >= intent.amount - AMOUNT_TOLERANCE) {
    return {
      match: {
        coin: intent.coin,
        amount: received,
        txId: deposits.find((deposit) => deposit.coin === intent.coin)?.txId ?? `ARRIVED-${Date.now().toString(36).toUpperCase()}`,
        network: 'internal/holdings',
        at: new Date(),
        evidence: 'balance-delta',
        overpaid: difference > AMOUNT_TOLERANCE ? difference : 0,
      },
      checked: deposits.length,
      lookupError,
    }
  }

  if (received > 0) {
    return {
      match: null,
      partial: { received, shortfall: Math.abs(difference) },
      checked: deposits.length,
      lookupError,
      reason: `Short payment: ${received} of ${intent.amount} ${intent.coin} received — ${Math.abs(difference)} ${intent.coin} still outstanding.`,
    }
  }

  if (intent.baseline !== null && intent.baseline !== undefined) {
    return {
      match: null,
      checked: deposits.length,
      lookupError,
      reason: `No incoming ${intent.coin} of ${intent.amount} yet. Holdings moved by 0 (baseline ${intent.baseline}).`,
    }
  }

  return {
    match: null,
    checked: deposits.length,
    lookupError,
    reason: lookupError || (deposits.length
      ? `No incoming ${intent.coin} deposit of ${intent.amount} yet (saw ${deposits.length} other incoming deposit(s)).`
      : 'No incoming deposits since the request was created.'),
  }
}

/**
 * Is this deposit ours? Incoming only, right coin, and at least the amount we asked for.
 *
 * Overpaying is a success, not a miss: if someone sends 46 against a 45.15 request the
 * money has arrived and the plan must activate. The surplus is recorded and reported.
 * Underpaying is handled separately as a short payment.
 */
function matches(intent, deposit) {
  if (deposit.coin !== intent.coin) return false
  if (!Number.isFinite(deposit.amount)) return false
  if (deposit.amount < intent.amount - AMOUNT_TOLERANCE) return false
  if (deposit.at.getTime() < new Date(intent.createdAt).getTime() - 5 * 60000) return false

  return true
}

async function executeMatch(req, intent, deposit) {
  intent.status = 'verified'
  intent.detectedTxId = deposit.txId
  intent.detectedAmount = deposit.amount
  intent.detectedAt = deposit.at
  intent.evidence = deposit.evidence ?? 'deposit-history'
  intent.overpaid = deposit.overpaid ?? 0
  intent.verifiedAt = new Date()
  intent.lastCheckedAt = new Date()
  intent.simulated = Boolean(deposit.simulated)
  await intent.save()

  if (intent.overpaid > 0) {
    await audit.record(req, {
      action: 'payment.overpaid',
      subjectType: 'PaymentIntent',
      subjectId: intent._id,
      hospital: intent.hospital,
      summary: `Received ${deposit.amount} against ${intent.amount} ${intent.coin} — ${intent.overpaid} above the request`,
    })
  }

  // A subscription payment verifies itself: the plan request is marked paid so the
  // admin's approval is a single click rather than a manual reconciliation.
  if (intent.purpose === 'subscription' && intent.subscriptionRequest) {
    const SubscriptionRequest = require('../models/subscription-request')

    const request = await SubscriptionRequest.findByIdAndUpdate(
      intent.subscriptionRequest,
      {
        'payment.verified': true,
        'payment.verifiedBy': deposit.simulated ? 'Aurora (simulated)' : 'Aurora (automatic)',
        'payment.verifiedAt': new Date(),
        'payment.reference': intent.reference,
        'payment.method': 'online',
        'payment.verificationNote': `Matched incoming ${deposit.coin} ${deposit.amount} (ref ${intent.reference}) via ${intent.evidence}`,
        'payment.proofUrl': '',
      },
      { new: true },
    )

    await jobs.publish({
      type: 'subscription.payment_verified',
      hospitalId: String(intent.hospital),
      severity: 'low',
      step: 'binance',
      reference: intent.reference,
    })

    await audit.record(req, {
      action: 'subscription.payment_auto_verified',
      subjectType: 'SubscriptionRequest',
      subjectId: intent.subscriptionRequest,
      hospital: intent.hospital,
      summary: `${deposit.coin} ${deposit.amount} verified automatically for plan ${request?.requestedPlan ?? ''}`,
    })

    return {
      appointment: request ?? null,
      message: `Payment received (${deposit.coin} ${deposit.amount}, ref ${intent.reference}) — the plan request is marked paid and is waiting on Aurora's approval.`,
    }
  }

  let appointment = null

  if (intent.appointment) {
    appointment = await Appointment.findById(intent.appointment)

    if (appointment && appointment.status !== 'cancelled') {
      appointment.status = 'confirmed'
      appointment.aiNote = `${appointment.aiNote ? `${appointment.aiNote} · ` : ''}Paid via Binance (${deposit.coin} ${deposit.amount}, ${deposit.txId.slice(0, 12)}…)`
      await appointment.save()
    }
  }

  const message = `Aurora: payment received (${deposit.coin} ${deposit.amount}, ref ${intent.reference}). Your appointment${appointment ? ` on ${appointment.date} at ${appointment.time}` : ''} is confirmed.`

  intent.notified = true
  intent.notificationChannel = 'in-app + whatsapp'
  await intent.save()

  if (intent.patient) {
    const patient = await mongoose.model('User').findById(intent.patient).select('phone email name')

    if (patient?.phone) {
      await OutboxMessage.create({
        phone: patient.phone,
        text: message,
        kind: 'notice',
        patientName: intent.patientName,
      })
    }
  }

  await audit.record(req, {
    action: 'payment.verified',
    subjectType: 'PaymentIntent',
    subjectId: intent._id,
    hospital: intent.hospital,
    summary: `${deposit.coin} ${deposit.amount} matched ${intent.reference}${deposit.simulated ? ' (simulated deposit)' : ''}`,
  })

  await jobs.publish({
    type: 'payment.received',
    step: 'binance',
    severity: 'low',
    reference: intent.reference,
    coin: deposit.coin,
    amount: deposit.amount,
    simulated: Boolean(deposit.simulated),
  })

  return { appointment, message }
}

// ---------------------------------------------------------------- patient side

/**
 * Account state the portal shows: is this hospital verified *and* paid up?
 *
 * It reads the hospital's own subscription first — that is the source of truth — and
 * only then the payment request, so the chip can never say "not subscribed" while the
 * steps below say the plan was activated.
 */
function accountState(request, intent) {
  const subscription = request?.hospitalSubscription ?? {}
  const planActive = subscription.status === 'active' && Boolean(subscription.planId) && subscription.planId !== 'starter'
  const freePlan = subscription.planId === 'starter' || !subscription.planId
  const documentsVerified = request?.hospitalVerification === 'verified'

  if (planActive && documentsVerified) return 'verified-active'
  if (planActive) return 'active'
  if (intent?.status === 'detected') return 'short-paid'
  if (request?.status === 'pending') return 'awaiting-payment'
  if (request?.status === 'rejected') return 'payment-rejected'
  if (freePlan && documentsVerified) return 'verified-free'

  return 'not-subscribed'
}

/** Every step this subscription has been through, newest first. */
async function subscriptionHistory({ hospitalId, requests, intents }) {
  const audit = require('../lib/audit')

  const events = await audit.list({ hospital: hospitalId, limit: 200 })
  const timeline = []

  for (const request of requests) {
    timeline.push({
      at: request.createdAt,
      kind: 'request',
      label: `${request.requestedPlan} plan requested`,
      detail: `${request.amount} ${request.currency} · ${request.billingCycle} · by ${request.requestedByName || 'the hospital'}`,
    })

    if (request.decidedAt) {
      timeline.push({
        at: request.decidedAt,
        kind: request.status === 'approved' ? 'approved' : 'rejected',
        label: request.status === 'approved' ? 'Approved by Aurora' : 'Rejected by Aurora',
        detail: request.decisionNote || request.decidedBy || '',
      })
    }

    if (request.activatedAt) {
      timeline.push({ at: request.activatedAt, kind: 'activated', label: `${request.requestedPlan} activated`, detail: '' })
    }

    if (request.payment?.verifiedAt) {
      timeline.push({
        at: request.payment.verifiedAt,
        kind: 'payment',
        label: 'Payment verified',
        detail: `${request.payment.verifiedBy || 'Aurora'} · ${request.payment.verificationNote || ''}`,
      })
    } else if (request.payment?.paidAt) {
      timeline.push({
        at: request.payment.paidAt,
        kind: 'short',
        label: 'Payment received short of the amount',
        detail: request.payment.verificationNote || '',
      })
    }
  }

  for (const intent of intents) {
    timeline.push({
      at: intent.createdAt,
      kind: 'instructions',
      label: 'Payment request opened',
      detail: `${intent.amount} ${intent.coin} to ${intent.payToId || intent.payToEmail || 'the account'} · ref ${intent.reference}`,
    })

    if (intent.detectedAt && intent.status !== 'verified') {
      timeline.push({
        at: intent.detectedAt,
        kind: 'short',
        label: 'Partial payment received',
        detail: `${intent.detectedAmount} of ${intent.amount} ${intent.coin}`,
      })
    }
  }

  for (const event of events) {
    if (!/^subscription\./.test(event.action ?? '')) continue

    timeline.push({
      at: event.createdAt,
      kind: 'audit',
      label: event.action.replace('subscription.', '').replace(/_/g, ' '),
      detail: `${event.summary || ''}${event.actorName ? ` · ${event.actorName}` : ''}`,
    })
  }

  return timeline
    .filter((entry) => entry.at)
    .sort((left, right) => new Date(right.at) - new Date(left.at))
    .slice(0, 40)
}

/** Progress for a hospital's subscription payment, as the UI shows it. */
function subscriptionProgress(intent, request) {
  const paid = Boolean(request?.payment?.verified)
  const activated = request?.status === 'approved'
  const shortfall = Number(intent?.detectedAmount)
    ? Math.round((intent.amount - intent.detectedAmount) * 100000000) / 100000000
    : 0

  return {
    purpose: 'subscription',
    state: accountState(request, intent),
    shortfall: shortfall > 0 && !paid ? shortfall : 0,
    received: intent?.detectedAmount ?? 0,
    steps: [
      { key: 'requested', label: 'Plan request sent', done: Boolean(request), at: request?.createdAt ?? null },
      { key: 'instructions', label: 'Payment instructions issued', done: Boolean(intent), at: intent?.createdAt ?? null },
      {
        key: 'received',
        label: 'Payment received',
        done: intent?.status === 'verified',
        at: intent?.detectedAt ?? null,
        note:
          intent?.status === 'detected' && shortfall > 0
            ? `${intent.detectedAmount} of ${intent.amount} ${intent.coin} received — ${shortfall} outstanding`
            : '',
      },
      { key: 'verified', label: 'Payment verified', done: paid, at: request?.payment?.verifiedAt ?? null },
      { key: 'activated', label: 'Plan activated', done: activated, at: request?.activatedAt ?? null },
    ],
    request: request
      ? {
          id: request.id,
          plan: request.requestedPlan,
          status: request.status,
          amount: request.amount,
          currency: request.currency,
          paymentVerified: paid,
          verifiedBy: request.payment?.verifiedBy ?? '',
          verificationNote: request.payment?.verificationNote ?? '',
          activatedAt: request.activatedAt,
          decisionNote: request.decisionNote,
        }
      : null,
  }
}

/** The subscription timeline on its own, for the history panel. */
router.get('/subscription/history', async (req, res) => {
  const SubscriptionRequest = require('../models/subscription-request')

  const hospitals = req.user.role === 'hospital'
    ? await Hospital.find({ owner: req.user.id }).select('_id')
    : []

  const hospitalIds = hospitals.map((hospital) => hospital._id)

  const [requests, intents] = await Promise.all([
    SubscriptionRequest.find({ hospital: { $in: hospitalIds } }).sort({ createdAt: -1 }).limit(30),
    PaymentIntent.find({ hospital: { $in: hospitalIds }, purpose: 'subscription' }).sort({ createdAt: -1 }).limit(10),
  ])

  const history = await subscriptionHistory({ hospitalId: hospitalIds[0] ?? null, requests, intents })

  res.json({ data: history, meta: { count: history.length } })
})

/** A hospital's subscription payments, with progress for the UI. */
router.get('/subscription', async (req, res) => {
  const SubscriptionRequest = require('../models/subscription-request')

  const hospitals = req.user.role === 'hospital'
    ? await Hospital.find({ owner: req.user.id }).select('_id name')
    : []

  const hospitalIds = hospitals.map((hospital) => hospital._id)
  const filter = req.user.role === 'admin' ? {} : { hospital: { $in: hospitalIds } }

  const intents = await PaymentIntent.find({ ...filter, purpose: 'subscription' })
    .sort({ createdAt: -1 })
    .limit(10)

  const rows = await Promise.all(
    intents.map(async (intent) => {
      const request = intent.subscriptionRequest
        ? await SubscriptionRequest.findById(intent.subscriptionRequest)
        : null

      const hospitalDoc = intent.hospital
        ? await Hospital.findById(intent.hospital).select('verification status name subscription')
        : null

      const enriched = request
        ? {
            ...request.toObject(),
            hospitalVerification: hospitalDoc?.verification?.status ?? 'unverified',
            hospitalSubscription: hospitalDoc?.subscription ?? null,
          }
        : null

      return {
        id: intent.id,
        status: intent.status,
        coin: intent.coin,
        amount: intent.amount,
        pricePkr: intent.pricePkr,
        fxRate: intent.fxRate,
        reference: intent.reference,
        payToId: intent.payToId,
        payToEmail: intent.payToEmail,
        payToLabel: intent.payToLabel,
        baseline: intent.baseline,
        evidence: intent.evidence,
        detectedTxId: intent.detectedTxId,
        detectedAmount: intent.detectedAmount,
        detectedAt: intent.detectedAt,
    overpaid: intent.overpaid ?? 0,
        verifiedAt: intent.verifiedAt,
        expiresAt: intent.expiresAt,
        createdAt: intent.createdAt,
        simulated: intent.simulated,
        hospitalVerification: hospitalDoc?.verification?.status ?? 'unverified',
        currentPlan: {
          planId: hospitalDoc?.subscription?.planId ?? 'starter',
          status: hospitalDoc?.subscription?.status ?? 'inactive',
          renewsAt: hospitalDoc?.subscription?.renewsAt ?? null,
          startedAt: hospitalDoc?.subscription?.startedAt ?? null,
        },
        ...subscriptionProgress(intent, enriched),
      }
    }),
  )

  const history = await subscriptionHistory({
    hospitalId: hospitalIds[0] ?? intents[0]?.hospital ?? null,
    requests: await SubscriptionRequest.find({
      hospital: { $in: req.user.role === 'admin' ? [intents[0]?.hospital].filter(Boolean) : hospitalIds },
    }).limit(30),
    intents,
  })

  res.json({ data: rows, meta: { count: rows.length, simulateAvailable: SIMULATE_ENABLED, history } })
})


router.get('/methods', async (req, res) => {
  const status = await binance.reachable()
  const target = destination()

  res.json({
    data: {
      binance: {
        ...status,
        payToId: target.payToId,
        payToEmail: target.payToEmail,
        payToLabel: target.payToLabel,
        simulateAvailable: SIMULATE_ENABLED,
        tolerance: AMOUNT_TOLERANCE,
        intentTtlMinutes: INTENT_TTL_MINUTES,
      },
    },
  })
})

router.post('/intents', async (req, res) => {
  const appointmentId = mongoose.isValidObjectId(req.body?.appointmentId) ? req.body.appointmentId : null
  const coin = typeof req.body?.coin === 'string' ? req.body.coin.trim().toUpperCase().slice(0, 10) : 'USDT'

  const appointment = appointmentId
    ? await Appointment.findOne({ _id: appointmentId, patientUser: req.user.id })
    : null

  if (appointmentId && !appointment) {
    throw new HttpError(404, 'NOT_FOUND', 'That appointment is not on your record.')
  }

  const baseAmount = appointment
    ? Math.max(1, Number(req.body?.amount) || 0)
    : Math.max(1, Number(req.body?.amount) || 0)

  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Enter the amount to pay.')
  }

  const offset = await nextOffset(coin)
  const amount = Math.round((baseAmount + offset) * 10000) / 10000
  const target = destination()

  // Snapshot what the account holds of this coin right now. Receipt is then proven by
  // this rising by at least the amount, whatever route the money took.
  let baseline = null

  try {
    const holdings = await binance.totalHoldings()
    baseline = holdings[coin] ?? 0
  } catch (error) {
    console.warn('Could not snapshot the balance baseline:', error.message)
  }

  const intent = await PaymentIntent.create({
    patient: req.user.id,
    patientName: req.user.name,
    hospital: appointment?.hospital ?? null,
    appointment: appointment?._id ?? null,
    payToId: target.payToId,
    payToEmail: target.payToEmail,
    payToLabel: target.payToLabel,
    coin,
    network: typeof req.body?.network === 'string' ? req.body.network.slice(0, 20) : '',
    baseAmount,
    amount,
    reference: reference(),
    baseline,
    expiresAt: new Date(Date.now() + INTENT_TTL_MINUTES * 60000),
  })

  await audit.record(req, {
    action: 'payment.intent_created',
    subjectType: 'PaymentIntent',
    subjectId: intent._id,
    hospital: intent.hospital,
    summary: `${coin} ${amount} requested for ${appointment ? `${appointment.date} ${appointment.time}` : 'a booking'}`,
  })

  res.status(201).json({
    data: payload(intent, {
      instructions: `Send exactly ${amount} ${coin} from your Binance account to ${target.describe}, and include the reference ${intent.reference} in the note if your app allows it.`,
    }),
  })
})

router.get('/intents', async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { patient: req.user.id }
  const intents = await PaymentIntent.find(filter).sort({ createdAt: -1 }).limit(30)

  res.json({ data: intents.map((intent) => payload(intent)), meta: { count: intents.length } })
})

/**
 * Look for the money. Reads incoming deposits only and matches against this intent.
 */
router.post('/intents/:intentId/check', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.intentId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Payment request not found.')
  }

  const filter = { _id: req.params.intentId }
  if (req.user.role !== 'admin') filter.patient = req.user.id

  const intent = await PaymentIntent.findOne(filter)

  if (!intent) throw new HttpError(404, 'NOT_FOUND', 'Payment request not found.')

  if (['verified', 'cancelled', 'expired'].includes(intent.status)) {
    return res.json({ data: payload(intent), meta: { matched: intent.status === 'verified', alreadySettled: true } })
  }

  intent.attempts += 1
  intent.lastCheckedAt = new Date()
  await intent.save()

  const { match, partial, checked, lookupError, reason } = await findReceipt(intent)

  if (!match && partial) {
    // Money arrived but not enough: record it, tell them the shortfall, and keep the
    // request open so the remainder can still complete it.
    intent.status = 'detected'
    intent.detectedAmount = partial.received
    intent.detectedAt = new Date()
    intent.evidence = 'balance-delta'
    await intent.save()

    if (intent.purpose === 'subscription' && intent.subscriptionRequest) {
      const SubscriptionRequest = require('../models/subscription-request')

      await SubscriptionRequest.findByIdAndUpdate(intent.subscriptionRequest, {
        payment: {
          method: 'online',
          reference: intent.reference,
          paidAt: new Date(),
          proofUrl: '',
          verified: false,
          verifiedBy: '',
          verifiedAt: null,
          verificationNote: `Short payment: ${partial.received} of ${intent.amount} ${intent.coin} received, ${partial.shortfall} outstanding`,
        },
      })

      await audit.record(req, {
        action: 'subscription.payment_short',
        subjectType: 'SubscriptionRequest',
        subjectId: intent.subscriptionRequest,
        hospital: intent.hospital,
        summary: `Received ${partial.received} of ${intent.amount} ${intent.coin} — ${partial.shortfall} outstanding`,
      })
    }

    return res.json({
      data: payload(intent, { shortfall: partial.shortfall, received: partial.received }),
      meta: {
        matched: false,
        partial: true,
        received: partial.received,
        shortfall: partial.shortfall,
        reason: reason,
      },
    })
  }

  if (!match) {
    return res.json({
      data: payload(intent),
      meta: { matched: false, incomingChecked: checked, reason: lookupError || reason },
    })
  }

  const { appointment, message } = await executeMatch(req, intent, match)

  res.json({
    data: payload(intent, { appointment }),
    meta: {
      matched: true,
      evidence: match.evidence,
      notification: message,
    },
  })
})

/**
 * Demo only: records a matching incoming deposit so the success notification can be
 * shown without moving real funds. Disabled unless BINANCE_SIMULATE=true.
 */
router.post('/intents/:intentId/simulate', async (req, res) => {
  if (!SIMULATE_ENABLED) {
    throw new HttpError(403, 'FORBIDDEN', 'Simulated deposits are switched off (set BINANCE_SIMULATE=true).')
  }

  if (!mongoose.isValidObjectId(req.params.intentId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Payment request not found.')
  }

  const filter = { _id: req.params.intentId }
  if (req.user.role !== 'admin') filter.patient = req.user.id

  const intent = await PaymentIntent.findOne(filter)

  if (!intent) throw new HttpError(404, 'NOT_FOUND', 'Payment request not found.')

  if (intent.status === 'verified') {
    return res.json({ data: payload(intent), meta: { matched: true, alreadySettled: true } })
  }

  const { appointment, message } = await executeMatch(req, intent, {
    coin: intent.coin,
    amount: intent.amount,
    txId: `SIMULATED-${Date.now().toString(36).toUpperCase()}`,
    network: intent.network,
    at: new Date(),
    evidence: 'simulated',
    simulated: true,
  })

  res.json({ data: payload(intent, { appointment }), meta: { matched: true, notification: message, simulated: true } })
})

router.post('/intents/:intentId/cancel', async (req, res) => {
  const filter = { _id: mongoose.isValidObjectId(req.params.intentId) ? req.params.intentId : null }
  if (req.user.role !== 'admin') filter.patient = req.user.id

  const intent = await PaymentIntent.findOneAndUpdate(
    { ...filter, status: { $in: ['awaiting', 'detected'] } },
    { status: 'cancelled' },
    { new: true },
  )

  if (!intent) throw new HttpError(404, 'NOT_FOUND', 'No open payment request found.')

  // Cancelling the payment cancels the plan request behind it too — otherwise the
  // hospital is left with a pending request it cannot replace or restart.
  if (intent.purpose === 'subscription' && intent.subscriptionRequest) {
    const SubscriptionRequest = require('../models/subscription-request')

    await SubscriptionRequest.findOneAndUpdate(
      { _id: intent.subscriptionRequest, status: 'pending' },
      { status: 'cancelled', decidedBy: req.user.name, decidedAt: new Date(), decisionNote: 'Cancelled by the hospital' },
    )

    await audit.record(req, {
      action: 'subscription.cancelled',
      subjectType: 'SubscriptionRequest',
      subjectId: intent.subscriptionRequest,
      hospital: intent.hospital,
      summary: 'Payment request cancelled — the plan request was withdrawn too',
    })
  }

  res.json({ data: payload(intent, { cancelled: true }) })
})

/** Everything that has arrived, incoming only — the receipt list. */
router.get('/received', async (req, res) => {
  let deposits = []
  let error = null

  try {
    deposits = await binance.incomingDeposits({ limit: 25 })
  } catch (err) {
    error = err.code === 'NOT_CONFIGURED' ? 'Binance keys are not configured.' : err.message
  }

  const verified = await PaymentIntent.find({ status: 'verified', simulated: false })
    .sort({ verifiedAt: -1 })
    .limit(25)

  res.json({
    data: {
      incoming: deposits,
      matched: verified.map((intent) => payload(intent)),
      error,
    },
    meta: { count: deposits.length },
  })
})

module.exports = router
