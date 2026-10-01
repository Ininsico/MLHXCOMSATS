/**
 * Currency conversion for plan prices.
 *
 * Plans are priced in PKR; the payment rail moves USDT, so every charge goes through
 * here. The rate is configuration (`PKR_PER_USDT`) with a documented default, and the
 * rate actually used is stored on the payment request — a price is never converted
 * silently and never invented at display time.
 */

const DEFAULT_PKR_PER_USDT = Number(process.env.PKR_PER_USDT || 330)
const MIN_USDT = 1

function rate() {
  const configured = Number(process.env.PKR_PER_USDT)

  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_PKR_PER_USDT
}

/** PKR → USDT, rounded to a sane precision for a transfer. */
function pkrToUsdt(pkr) {
  const amount = Number(pkr)
  const perUsdt = rate()

  if (!Number.isFinite(amount) || amount <= 0) {
    return { usdt: MIN_USDT, rate: perUsdt, pkr: 0 }
  }

  const usdt = Math.max(MIN_USDT, Math.round((amount / perUsdt) * 100) / 100)

  return { usdt, rate: perUsdt, pkr: amount }
}

/** The reverse, for showing a crypto figure back in rupees. */
function usdtToPkr(usdt) {
  const amount = Number(usdt)
  const perUsdt = rate()

  return Number.isFinite(amount) ? Math.round(amount * perUsdt) : 0
}

module.exports = { pkrToUsdt, usdtToPkr, rate, DEFAULT_PKR_PER_USDT }
