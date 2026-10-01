import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Bitcoin,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Wallet,
  XCircle,
} from 'lucide-react'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import PaymentProgress from '../../components/PaymentProgress'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'
const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'
const GHOST_CLASS =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:text-ink disabled:opacity-60'

const COINS = [
  { value: 'USDT', label: 'USDT (Tether)' },
  { value: 'USDC', label: 'USDC' },
  { value: 'BTC', label: 'BTC' },
  { value: 'ETH', label: 'ETH' },
]

export default function PatientPaymentPage() {
  const [params] = useSearchParams()
  const [methods, setMethods] = useState(null)
  const [intents, setIntents] = useState([])
  const [received, setReceived] = useState({ incoming: [], matched: [], error: null })
  const [appointments, setAppointments] = useState([])
  const [form, setForm] = useState({ appointmentId: params.get('appointment') ?? '', amount: '', coin: 'USDT', network: '' })
  const [active, setActive] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState('')
  const poller = useRef(null)

  const load = useCallback(async () => {
    try {
      const [methodData, intentData, receivedData, visits] = await Promise.all([
        api.payments.methods(),
        api.payments.intents(),
        api.payments.received(),
        api.appointments.mine(),
      ])

      setMethods(methodData?.binance ?? null)
      setIntents(intentData ?? [])
      setReceived(receivedData ?? { incoming: [], matched: [], error: null })
      setAppointments(visits ?? [])

      const open = (intentData ?? []).find((intent) => ['awaiting', 'detected'].includes(intent.status))
      setActive(open ?? null)
    } catch (err) {
      setError(err.message || 'Could not load the payment page.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([api.payments.methods(), api.payments.intents(), api.payments.received(), api.appointments.mine()])
      .then(([methodData, intentData, receivedData, visits]) => {
        if (cancelled) return
        setMethods(methodData?.binance ?? null)
        setIntents(intentData ?? [])
        setReceived(receivedData ?? { incoming: [], matched: [], error: null })
        setAppointments(visits ?? [])
        setActive((intentData ?? []).find((intent) => ['awaiting', 'detected'].includes(intent.status)) ?? null)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the payment page.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  /** While a request is open, look for the incoming deposit on its own. */
  useEffect(() => {
    if (!active) return undefined

    let cancelled = false

    const tick = () =>
      api.payments
        .checkIntent(active.id)
        .then((result) => {
          if (cancelled) return
          setActive(['awaiting', 'detected'].includes(result.status) ? result : null)
          if (result.status === 'verified') {
            setSuccess({ message: `Payment received — ${result.coin} ${result.amount} matched ${result.reference}. Your appointment is confirmed.`, reference: result.reference })
            load()
          }
        })
        .catch(() => {})

    poller.current = setInterval(tick, 8000)

    return () => {
      cancelled = true
      clearInterval(poller.current)
    }
  }, [active, load])

  async function run(label, action) {
    setBusy(label)
    setError('')
    setNotice('')

    try {
      await action()
    } catch (err) {
      setError(err.message || `${label} failed.`)
    } finally {
      setBusy('')
    }
  }

  const selectedAppointment = appointments.find(
    (visit) => (visit.id ?? visit._id) === (form.appointmentId || active?.appointment),
  )

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Payments</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
          <Wallet size={26} className="text-brand-700" />
          Pay with Binance
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Send crypto from your Binance account to the hospital's Binance ID. Aurora watches
          <span className="font-semibold text-body"> incoming transfers only</span>, matches the exact
          amount, confirms your appointment and notifies you the moment it lands.
        </p>
      </header>

      {success ? (
        <div role="status" className="mt-6 flex flex-wrap items-start gap-3 rounded-2xl border border-brand-300 bg-brand-50 px-6 py-5">
          <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-brand-700" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-ink">Payment received</p>
            <p className="mt-1 text-sm text-body">{success.message}</p>
            <p className="mt-2 text-xs text-mist">
              A WhatsApp confirmation has been queued for {methods?.payToLabel ?? 'the hospital'} to
              send to your number, and the payment is on your record.
            </p>
          </div>
          <button type="button" onClick={() => setSuccess(null)} className={GHOST_CLASS}>
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {[
          ['1', 'Open a request', 'Aurora gives you an exact amount and a reference — the amount is unique to you so nothing is ambiguous.'],
          ['2', 'Send from Binance', 'Binance app → Send → enter the hospital’s Binance ID → paste the exact amount. Internal transfers arrive instantly.'],
          ['3', 'Aurora confirms', 'Incoming deposits are checked continuously; on a match the appointment is confirmed and you are notified here and on WhatsApp.'],
        ].map(([step, title, body]) => (
          <div key={step} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-extrabold text-brand-700">
              {step}
            </span>
            <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-body">{body}</p>
          </div>
        ))}
      </section>

      {methods && !methods.configured ? (
        <p className="mt-6 rounded-xl border border-danger/40 bg-danger/5 px-5 py-4 text-sm text-body">
          Binance keys are not configured on the server, so nothing can be matched yet.
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">New payment request</h2>

          {/* Progress for the request that is currently open, before the form. */}
          {active ? (
            <div className="mt-4">
              <PaymentProgress
                live
                title="Where this payment is"
                steps={[
                  { key: 'created', label: 'Request created', done: true, at: active.createdAt },
                  { key: 'instructions', label: 'Instructions issued to you', done: true },
                  {
                    key: 'waiting',
                    label: 'Waiting for your transfer',
                    done: active.status !== 'awaiting',
                    at: null,
                    note: active.status === 'awaiting' ? `send exactly ${active.amount} ${active.coin}` : '',
                  },
                  { key: 'received', label: 'Payment received', done: active.status === 'verified', at: active.detectedAt },
                  {
                    key: 'verified',
                    label: 'Verified',
                    done: active.status === 'verified',
                    at: active.verifiedAt,
                    note: active.evidence ? `via ${active.evidence.replace('-', ' ')}` : '',
                  },
                  { key: 'confirmed', label: 'Appointment confirmed', done: active.status === 'verified' },
                ]}
                note="Aurora reads incoming deposits only. You will see the confirmation here the moment the transfer lands."
              />
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault()
              run('create', async () => {
                const intent = await api.payments.createIntent(form)
                setActive(intent)
                setSuccess(null)
                setNotice(`Request ${intent.reference} opened — send exactly ${intent.amount} ${intent.coin}.`)
                await load()
              })
            }}
            className="mt-4 space-y-3"
          >
            <SelectField
              id="pay-appointment"
              label="Appointment"
              value={form.appointmentId}
              onChange={(event) => setForm({ ...form, appointmentId: event.target.value })}
              options={[
                { value: '', label: 'No appointment (standalone payment)' },
                ...appointments
                  .filter((visit) => visit.status !== 'cancelled')
                  .map((visit) => ({
                    value: visit.id ?? visit._id,
                    label: `${visit.date} ${visit.time} · ${visit.hospital?.name ?? 'Hospital'} · ${visit.status}`,
                  })),
              ]}
            />

            <div>
              <label htmlFor="pay-amount" className="text-xs font-semibold uppercase tracking-wide text-mist">
                Amount to pay
              </label>
              <input
                id="pay-amount"
                type="number"
                step="any"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                placeholder="2500"
                className={`${FIELD_CLASS} mt-1.5`}
              />
              <p className="mt-1 text-[11px] text-mist">
                Aurora adds a tiny unique offset so two open requests can never look alike.
              </p>
            </div>

            <SelectField
              id="pay-coin"
              label="Coin"
              value={form.coin}
              onChange={(event) => setForm({ ...form, coin: event.target.value })}
              options={COINS}
            />

            <input
              value={form.network}
              onChange={(event) => setForm({ ...form, network: event.target.value })}
              placeholder="Network (optional, e.g. TRX, BSC)"
              aria-label="Network"
              className={FIELD_CLASS}
            />

            <button type="submit" disabled={busy === 'create' || !form.amount} className={`${SUBMIT_CLASS} w-full`}>
              {busy === 'create' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Create request
            </button>
          </form>

          <div className="mt-5 rounded-xl bg-surface px-4 py-3 text-xs leading-relaxed text-body">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Bitcoin size={13} className="text-brand-700" />
              Where to send
            </p>

            {methods?.payToId ? (
              <p className="mt-1">
                Binance ID:{' '}
                <span className="font-mono font-semibold text-ink">{methods.payToId}</span>
              </p>
            ) : null}

            {methods?.payToEmail ? (
              <p className="mt-1 flex flex-wrap items-center gap-2">
                Binance email:{' '}
                <span className="font-mono font-semibold text-ink">{methods.payToEmail}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(methods.payToEmail)
                    setCopied('email')
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700"
                >
                  <Copy size={11} />
                  {copied === 'email' ? 'copied' : 'copy email'}
                </button>
              </p>
            ) : null}

            {!methods?.payToId && !methods?.payToEmail ? (
              <p className="mt-1 text-danger">
                No destination set — configure BINANCE_PAY_ID or BINANCE_PAY_EMAIL on the server.
              </p>
            ) : null}

            <p className="mt-0.5 text-mist">{methods?.payToLabel}</p>
            <p className="mt-2 text-[11px] text-mist">
              In the Binance app: Send → paste the ID or email above → enter the exact amount. Both
              an internal Binance transfer and an on-chain deposit arrive as an incoming deposit,
              which is what Aurora matches on.
            </p>
            <p className="mt-2 text-[11px] text-mist">
              Matching tolerance ±{methods?.tolerance ?? 0.02} · requests expire after{' '}
              {methods?.intentTtlMinutes ?? 120} minutes · withdrawals are never read.
            </p>
          </div>
        </section>

        <div className="space-y-6">
          {active ? (
            <section className="rounded-2xl border border-brand-300 bg-brand-50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                  <RefreshCw size={18} className="text-brand-700" />
                  Waiting for your transfer
                </h2>
                <StatusChip status={active.status} />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-mist">Send exactly</p>
                  <p className="mt-1 text-xl font-extrabold text-ink">
                    {active.amount} {active.coin}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(String(active.amount))
                      setCopied('amount')
                    }}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700"
                  >
                    <Copy size={11} />
                    {copied === 'amount' ? 'copied' : 'copy amount'}
                  </button>
                </div>

                <div className="rounded-xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-mist">
                    {active.payToId ? 'To Binance ID' : 'To Binance email'}
                  </p>
                  <p className="mt-1 break-all font-mono text-base font-bold text-ink">
                    {active.payToId || active.payToEmail || 'not set'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(active.payToId || active.payToEmail || '')
                      setCopied('id')
                    }}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700"
                  >
                    <Copy size={11} />
                    {copied === 'id' ? 'copied' : 'copy destination'}
                  </button>
                </div>

                <div className="rounded-xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-mist">Reference</p>
                  <p className="mt-1 font-mono text-base font-bold text-ink">{active.reference}</p>
                  <p className="mt-1 text-[11px] text-mist">
                    {active.expiresAt ? `expires ${new Date(active.expiresAt).toLocaleTimeString()}` : ''}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-body">
                {selectedAppointment
                  ? `This confirms your ${selectedAppointment.date} at ${selectedAppointment.time} visit at ${
                      selectedAppointment.hospital?.name ?? 'the hospital'
                    }.`
                  : 'This is a standalone payment, not tied to a visit.'}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    run('check', async () => {
                      const result = await api.payments.checkIntent(active.id)

                      if (result.status === 'verified') {
                        setSuccess({ message: `Payment received — ${result.coin} ${result.amount} matched ${result.reference}. Your appointment is confirmed.`, reference: result.reference })
                        setActive(null)
                        await load()
                      } else {
                        setNotice('Nothing matched yet — the page also checks automatically every 8 seconds.')
                      }
                    })
                  }
                  disabled={busy === 'check'}
                  className={SUBMIT_CLASS}
                >
                  {busy === 'check' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  Check for my payment now
                </button>

                {methods?.simulateAvailable ? (
                  <button
                    type="button"
                    onClick={() =>
                      run('simulate', async () => {
                        const result = await api.payments.simulateIntent(active.id)
                        setSuccess({
                          message: `Simulated deposit matched — ${result.coin} ${result.amount} on ${result.reference}. This is how the real confirmation looks.`,
                          reference: result.reference,
                        })
                        setActive(null)
                        await load()
                      })
                    }
                    disabled={busy === 'simulate'}
                    className={GHOST_CLASS}
                  >
                    {busy === 'simulate' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    Simulate an incoming deposit (demo)
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    run('cancel', async () => {
                      await api.payments.cancelIntent(active.id)
                      setActive(null)
                      setNotice('Request cancelled.')
                      await load()
                    })
                  }
                  disabled={busy === 'cancel'}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-mist transition-colors hover:border-danger hover:text-danger"
                >
                  <XCircle size={14} />
                  Cancel
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">No open request</h2>
              <p className="mt-2 text-sm text-body">
                Create one on the left. While it is open Aurora checks for your transfer
                automatically.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <BadgeCheck size={18} className="text-brand-700" />
                Payment history
              </h2>
              <span className="text-xs font-semibold uppercase tracking-wide text-mist">
                incoming only · withdrawals never read
              </span>
            </div>

            <ul className="mt-4 divide-y divide-line">
              {intents.map((intent) => (
                <li key={intent.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {intent.coin} {intent.amount}
                      <span className="ml-2 font-mono text-xs font-normal text-mist">{intent.reference}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-mist">
                      {new Date(intent.createdAt).toLocaleString()}
                      {intent.detectedTxId ? ` · tx ${intent.detectedTxId.slice(0, 14)}…` : ''}
                      {intent.evidence
                        ? ` · verified via ${
                            {
                              'deposit-history': 'deposit history',
                              'pay-history': 'Binance Pay history',
                              'balance-delta': 'arrival in the account balance',
                              simulated: 'a simulated deposit',
                            }[intent.evidence] ?? intent.evidence
                          }`
                        : ''}
                    </p>
                  </div>
                  <StatusChip status={intent.status} />
                </li>
              ))}
              {!intents.length ? (
                <li className="py-6 text-center text-sm text-mist">No payment requests yet.</li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Incoming deposits seen on the account</h2>
            <p className="mt-1 text-xs text-mist">
              Straight from Binance's deposit history — money arriving only.
            </p>

            {received.error ? (
              <p className="mt-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-xs text-body">{received.error}</p>
            ) : null}

            <ul className="mt-4 divide-y divide-line">
              {(received.incoming ?? []).map((deposit) => (
                <li key={`${deposit.txId}-${deposit.at}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {deposit.coin} {deposit.amount}
                    </p>
                    <p className="mt-0.5 text-xs text-mist">
                      {new Date(deposit.at).toLocaleString()}
                      {deposit.network ? ` · ${deposit.network}` : ''} · tx {String(deposit.txId).slice(0, 14)}…
                    </p>
                  </div>
                  {(received.matched ?? []).some((intent) => intent.detectedTxId === deposit.txId) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                      <CheckCircle2 size={12} />
                      matched to a booking
                    </span>
                  ) : (
                    <span className="text-xs text-mist">no matching request</span>
                  )}
                </li>
              ))}
              {!(received.incoming ?? []).length ? (
                <li className="py-6 text-center text-sm text-mist">No deposits in the account's history.</li>
              ) : null}
            </ul>
          </section>

          <p className="text-center text-xs text-mist">
            Need a visit first?{' '}
            <Link to="/dashboard/appointments" className="font-semibold text-brand-700 hover:text-brand-800">
              Open your appointments
              <ArrowRight size={11} className="ml-1 inline" />
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
