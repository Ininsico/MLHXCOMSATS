import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Check, Copy, Loader2, Sparkles, X } from 'lucide-react'

const EASE = [0.22, 1, 0.36, 1]
const STABLE = new Set(['USDT', 'USDC', 'BUSD', 'DAI'])

/**
 * Checkout for a Binance transfer: what to send, where to send it, and a way to check
 * whether it has landed. Focus moves into the dialog, Escape closes it, and the
 * backdrop is inert — the numbers are impossible to miss.
 */
export default function CheckoutDialog({
  open,
  payment,
  title = 'Complete your transfer',
  onCheck = null,
  onSimulate = null,
  onCancel = null,
  onClose = null,
  busy = '',
  result = null,
}) {
  const [copied, setCopied] = useState('')
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }

    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || !payment) return null

  const destination = payment.payToId || payment.payToEmail || 'not configured'
  const dollars = STABLE.has(payment.coin) ? `≈ $${Number(payment.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ''
  const rupees = payment.pricePkr
    ? `Rs ${Number(payment.pricePkr).toLocaleString('en-US')}${
        payment.fxRate ? ` at ${payment.fxRate} PKR per ${payment.coin}` : ''
      }`
    : ''

  const copy = (label, value) => {
    navigator.clipboard?.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(''), 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm"
        onClick={() => onClose?.()}
        aria-hidden="true"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-soft"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Checkout</p>
            <h2 id="checkout-title" className="mt-1 text-xl font-extrabold tracking-tight text-ink">
              {title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close checkout"
            className="rounded-lg p-2 text-mist transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3">
            <Check size={18} className="mt-0.5 shrink-0 text-brand-700" />
            <p className="text-sm leading-relaxed text-body">{result}</p>
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-brand-300 bg-brand-50 p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Transfer exactly</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-ink">
            {payment.amount} <span className="text-xl">{payment.coin}</span>
          </p>
          {dollars ? <p className="mt-1 text-sm font-semibold text-brand-800">{dollars}</p> : null}
          {rupees ? <p className="mt-0.5 text-xs text-body">quoted {rupees}</p> : null}
          <button
            type="button"
            onClick={() => copy('amount', String(payment.amount))}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"
          >
            {copied === 'amount' ? <Check size={12} /> : <Copy size={12} />}
            {copied === 'amount' ? 'copied' : 'copy amount'}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-body">
            Send this exact figure — the unique offset is how Aurora recognises your transfer among
            all incoming deposits.
          </p>
        </div>

        <dl className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-mist">
              {payment.payToId ? 'To Binance ID' : 'To Binance email'}
            </dt>
            <dd className="flex items-center gap-2">
              <span className="break-all font-mono text-sm font-bold text-ink">{destination}</span>
              <button
                type="button"
                onClick={() => copy('destination', destination)}
                aria-label="Copy destination"
                className="rounded p-1 text-mist transition-colors hover:text-brand-700"
              >
                {copied === 'destination' ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </dd>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-mist">Reference</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink">{payment.reference}</span>
              <button
                type="button"
                onClick={() => copy('reference', payment.reference)}
                aria-label="Copy reference"
                className="rounded p-1 text-mist transition-colors hover:text-brand-700"
              >
                {copied === 'reference' ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </dd>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-mist">Paying for</dt>
            <dd className="text-sm font-semibold text-ink">{payment.request?.plan ?? 'Plan'} · {payment.request?.billingCycle ?? 'monthly'}</dd>
          </div>
        </dl>

        {payment.shortfall > 0 ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-xs leading-relaxed text-body">
              A previous transfer was short by {payment.shortfall} {payment.coin}. Sending the
              remainder completes the same request.
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-[11px] leading-relaxed text-mist">
          In the Binance app: Send → enter the ID, email or reference above → paste the amount. Aurora
          reads incoming transfers only — withdrawals are never considered — and your plan switches on
          once the payment is verified.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onCheck?.()}
            disabled={busy === 'check'}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {busy === 'check' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            I have sent it — check now
          </button>

          {onSimulate ? (
            <button
              type="button"
              onClick={() => onSimulate()}
              disabled={busy === 'simulate'}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:text-ink disabled:opacity-60"
            >
              {busy === 'simulate' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              Simulate (demo)
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-center text-[11px] text-mist">
          Checks run every few seconds while this is open — you can also leave it and check later.
        </p>

        {onCancel ? (
          <div className="mt-4 border-t border-line pt-4 text-center">
            <button
              type="button"
              onClick={() => onCancel()}
              disabled={busy === 'cancel'}
              className="text-xs font-semibold text-mist transition-colors hover:text-danger disabled:opacity-60"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel this request'}
            </button>
            <p className="mt-1 text-[11px] text-mist">
              Nothing has been charged — cancelling closes the request and stops the checks.
            </p>
          </div>
        ) : null}
      </motion.div>
    </div>
  )
}
