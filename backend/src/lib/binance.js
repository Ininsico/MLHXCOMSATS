/**
 * Binance helper — read-only, and incoming only.
 *
 * This module deliberately touches exactly two things:
 *   · GET /sapi/v1/capital/deposit/hisrec   — money coming IN
 *   · GET /api/v3/account                   — the balance snapshot
 *
 * Withdrawal history is never requested, so money leaving the account can never be
 * mistaken for a payment. Everything here is signed read traffic; no endpoint that
 * moves funds is called anywhere in this file or its callers.
 */

const crypto = require('crypto')

const BASE = process.env.BINANCE_BASE_URL || 'https://api.binance.com'

function credentials() {
  const key = (process.env.BINANCE_ACCOUNT_API_KEY ?? process.env['BINANCE_ACCOUNT_API_KEY '] ?? '').trim()
  const secret = (process.env.BINANCE_ACCOUNT_SECRET_KEY ?? '').trim()

  if (!key || !secret) {
    return null
  }

  return { key, secret }
}

function sign(secret, params) {
  const query = `${params}${params ? '&' : ''}timestamp=${Date.now()}&recvWindow=10000`
  const signature = crypto.createHmac('sha256', secret).update(query).digest('hex')
  return { query, signature }
}

async function signedGet(path, params = '') {
  const creds = credentials()

  if (!creds) {
    const error = new Error('Binance keys are not configured.')
    error.code = 'NOT_CONFIGURED'
    throw error
  }

  const { query, signature } = sign(creds.secret, params)
  const response = await fetch(`${BASE}${path}?${query}&signature=${signature}`, {
    headers: { 'X-MBX-APIKEY': creds.key },
    signal: AbortSignal.timeout(15000),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(payload?.msg || `Binance responded ${response.status}`)
    error.status = response.status
    error.binanceCode = payload?.code
    throw error
  }

  return payload
}

/**
 * Incoming deposits only.
 *
 * `status === 1` is Binance's "completed". Rows are returned newest-first and are
 * never filtered by direction because this endpoint only ever reports money arriving
 * — the withdrawal endpoint is a different path and is not used.
 */
async function incomingDeposits({ since, limit = 50 } = {}) {
  const params = [`limit=${Math.min(1000, Math.max(1, limit))}`]

  if (since) params.push(`startTime=${new Date(since).getTime()}`)

  const rows = await signedGet('/sapi/v1/capital/deposit/hisrec', params.join('&'))

  return (Array.isArray(rows) ? rows : [])
    .filter((row) => Number(row.status) === 1)
    .map((row) => ({
      coin: String(row.coin ?? '').toUpperCase(),
      amount: Number(row.amount),
      txId: String(row.txId ?? ''),
      network: String(row.network ?? ''),
      at: new Date(Number(row.insertTime) || Date.now()),
      depositType: row.depositType ?? null,
      fromAddress: row.address ?? '',
    }))
    .sort((left, right) => right.at - left.at)
}

/** Balances across wallets — for a status line, not for matching. */
async function balances() {
  const account = await signedGet('/api/v3/account')
  return (account?.balances ?? []).filter((row) => Number(row.free) > 0 || Number(row.locked) > 0)
}

/**
 * Total holdings per coin, across every wallet this key can see.
 *
 * This is the receipt check that does not care *how* money arrived: an on-chain
 * deposit, an internal Binance-to-Binance transfer, or a Binance Pay credit all end
 * up as a holding. Taking a snapshot when a payment is requested and comparing it
 * afterwards therefore proves the money was received even where a history endpoint
 * does not report the transfer type.
 *
 * Holdings only — outgoing money is never read or considered.
 */
async function totalHoldings() {
  const totals = {}

  const add = (asset, amount) => {
    if (!asset) return
    totals[asset] = Math.round(((totals[asset] ?? 0) + (Number(amount) || 0)) * 100000000) / 100000000
  }

  try {
    const spot = await signedGet('/api/v3/account')
    for (const row of spot?.balances ?? []) {
      add(row.asset, Number(row.free) + Number(row.locked))
    }
  } catch (error) {
    console.warn('Spot balances unavailable:', error.message)
  }

  try {
    const all = await signedGet('/sapi/v3/asset/getUserAsset', '')
    for (const row of Array.isArray(all) ? all : []) {
      // getUserAsset already reports every wallet's holding per coin.
      add(row.asset, Number(row.free) + Number(row.locked) + Number(row.freeze ?? 0))
    }
  } catch (error) {
    console.warn('Funding balances unavailable:', error.message)
  }

  return totals
}

/** Binance Pay history — the cleanest record of an internal transfer, when enabled. */
async function payTransactions({ since, limit = 50 } = {}) {
  const params = [`limit=${Math.min(100, Math.max(1, limit))}`]
  if (since) params.push(`startTime=${new Date(since).getTime()}`)

  try {
    const payload = await signedGet('/sapi/v1/pay/transactions', params.join('&'))

    return (payload?.data ?? []).map((row) => ({
      coin: String(row.currency ?? '').toUpperCase(),
      amount: Number(row.amount),
      at: new Date(Number(row.orderType ? row.transactionTime : row.transactionTime) || Date.now()),
      orderType: row.orderType ?? '',
      note: String(row.note ?? ''),
      txId: String(row.transactionId ?? row.orderId ?? ''),
    }))
  } catch (error) {
    return { unavailable: error.message, code: error.binanceCode ?? null }
  }
}

async function reachable() {
  if (!credentials()) return { configured: false, reachable: false }

  try {
    await signedGet('/api/v3/account')
    return { configured: true, reachable: true }
  } catch (error) {
    return { configured: true, reachable: false, reason: error.message, status: error.status ?? null }
  }
}

module.exports = { incomingDeposits, balances, totalHoldings, payTransactions, reachable, credentials }
