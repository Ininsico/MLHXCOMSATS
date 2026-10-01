import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { AlertTriangle, Check, Loader2, Lock, Wallet, Sparkles, XCircle } from 'lucide-react'
import StatusChip from '../../components/StatusChip'
import PaymentProgress from '../../components/PaymentProgress'
import AccountUpdatedNotice from '../../components/AccountUpdatedNotice'
import SectionTabs from '../../components/SectionTabs'
import CheckoutDialog from '../../components/CheckoutDialog'
import { api } from '../../lib/api'
import { themeStyles } from '../../lib/themes'

export default function HospitalPublicPage() {
  const { hospital, reload } = useOutletContext()
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [billing, setBilling] = useState([])
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [updated, setUpdated] = useState(null)
  const [tab, setTab] = useState('payments')
  const [checkout, setCheckout] = useState(null)
  const [checkoutBusy, setCheckoutBusy] = useState('')
  const [checkoutResult, setCheckoutResult] = useState('')
  const [paymentCheckBusy, setPaymentCheckBusy] = useState(false)
  const [paymentCheckResult, setPaymentCheckResult] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)

  /** Withdraw the open plan request — both the payment and the request behind it. */
  async function cancelOpenRequest() {
    const target = billing.find((row) => ['awaiting', 'detected'].includes(row.status))

    if (!target) {
      setPaymentCheckResult('No open request to cancel.')
      return
    }

    setCancelBusy(true)
    setPaymentCheckResult('')

    try {
      await api.payments.cancelIntent(target.id)
      const rows = await api.payments.subscription()

      setBilling(rows ?? [])
      setCheckout(null)
      setPaymentCheckResult('Request cancelled — the plan request was withdrawn and nothing was charged. You can start again whenever you like.')
    } catch (err) {
      setPaymentCheckResult(err.message || 'Could not cancel that request.')
    } finally {
      setCancelBusy(false)
    }
  }

  /** Manual trigger: look for the transfer right now, without waiting for the poll. */
  async function runPaymentCheck() {
    const target = billing.find((row) => row.status === 'awaiting') ?? billing[0]

    if (!target) {
      setPaymentCheckResult('No open payment request to check.')
      return
    }

    setPaymentCheckBusy(true)
    setPaymentCheckResult('')

    try {
      const result = await api.payments.checkIntent(target.id)
      const rows = await api.payments.subscription()

      setBilling(rows ?? [])
      setPaymentCheckResult(
        result.status === 'verified'
          ? 'Payment received and verified — waiting on Aurora to approve and activate the plan.'
          : result.shortfall
            ? `Partial payment detected — ${result.received} of ${target.amount} ${target.coin} received.`
            : 'Nothing matched yet. Aurora looks for the exact amount, including its unique offset.',
      )
    } catch (err) {
      setPaymentCheckResult(err.message || 'Could not check the payment right now.')
    } finally {
      setPaymentCheckBusy(false)
    }
  }

  /** While the checkout is open on an unpaid request, look for the transfer. */
  useEffect(() => {
    if (!checkout || checkout.status !== 'awaiting') return undefined

    let cancelled = false

    const tick = () =>
      api.payments
        .checkIntent(checkout.id)
        .then(async (result) => {
          if (cancelled || result.status !== 'verified') return

          const rows = await api.payments.subscription()
          if (cancelled) return

          setBilling(rows ?? [])
          setCheckout((current) => (rows ?? []).find((row) => row.id === current?.id) ?? null)
          setCheckoutResult('Payment received and verified — waiting on Aurora to approve and activate the plan.')
          setUpdated({
            title: 'Payment received',
            detail: 'Your transfer has been verified. The plan activates as soon as Aurora approves it.',
          })
        })
        .catch(() => {})

    const timer = setInterval(tick, 8000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [checkout])

  /**
   * Subscription payments for this hospital: plan state, shortfalls and progress.
   * Declared here, above the page's early returns, so the hook order never varies.
   */
  useEffect(() => {
    let cancelled = false

    api.payments
      .subscription()
      .then((rows) => {
        if (cancelled) return
        setBilling(rows ?? [])

        // The timeline travels in the response meta, which the wrapper exposes on the
        // raw payload only — fetch it once more for the history panel.
        return api.payments.subscriptionHistory()
      })
      .then((history) => {
        if (!cancelled && history) setHistory(history)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const ACTIVE_LABELS = {
    'verified-active': 'Verified and active',
    active: 'Plan active',
    'awaiting-payment': 'Awaiting payment',
    'short-paid': 'Payment short',
    'payment-rejected': 'Payment rejected',
    'verified-free': 'Verified · free plan',
    'not-subscribed': 'Not subscribed',
  }

  const PLAN_NAMES = { starter: 'Starter', growth: 'Growth', enterprise: 'Enterprise' }

  useEffect(() => {
    let cancelled = false

    api.hospitals
      .subscription()
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function choosePlan(planId) {
    setBusy(planId)
    setError('')

    try {
      const chosen = (data?.plans ?? []).find((entry) => entry.id === planId)

      /**
       * A paid plan is not switched by clicking it: it needs a payment that Aurora
       * verifies and an admin approval. Clicking starts the upgrade instead, and the
       * account panel shows the amount, the destination and the progress.
       */
      if (chosen && chosen.price > 0) {
        try {
          await api.emergency.raisePlanRequest({
            requestedPlan: planId,
            billingCycle: 'monthly',
            amount: chosen.price,
            currency: 'PKR',
            note: 'Upgrade requested from Page & plan',
          })
        } catch (err) {
          if (err.status !== 409) throw err
        }

        const rows = await api.payments.subscription()
        setBilling(rows ?? [])

        // Open the checkout on the request we just created: the amount to transfer,
        // where to send it, and a button to check whether it has landed.
        const newest = (rows ?? []).find((row) => row.status === 'awaiting' || row.shortfall > 0) ?? rows?.[0] ?? null

        setCheckoutResult('')
        setCheckout(newest)
        setError('')
        setNotice(
          `${chosen.name} is a paid plan. The checkout shows exactly what to transfer — the plan switches on once the payment is verified and approved.`,
        )
        return
      }

      const payload = await api.hospitals.setPlan(planId)
      setData((current) => ({ ...current, subscription: payload.subscription, plan: payload.plan }))
      setUpdated({
        title: `You are now on the ${payload.plan?.name ?? planId} plan`,
        detail: `Your listing uses the ${
          payload.subscription?.themeId ?? 'default'
        } theme and renews on ${
          payload.subscription?.renewsAt
            ? new Date(payload.subscription.renewsAt).toLocaleDateString('en-US')
            : 'rollover'
        }.`,
      })
      await reload()
    } catch (err) {
      setError(err.message || 'That plan could not be activated.')
    } finally {
      setBusy('')
    }
  }

  async function chooseTheme(themeId) {
    setBusy(themeId)
    setError('')

    try {
      const payload = await api.hospitals.setTheme(themeId)
      setData((current) => ({ ...current, subscription: payload.subscription }))
      await reload()
    } catch (err) {
      setError(err.message || 'That theme could not be applied.')
    } finally {
      setBusy('')
    }
  }

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading your page settings…</p>
  }

  if (state === 'error' || !data) {
    return <p className="text-sm text-danger">Couldn't load your page settings. Refresh to try again.</p>
  }

  const activePlan = data.plan
  const activeThemeId = data.subscription?.themeId ?? 'classic'
  const allowedThemes = activePlan?.themes ?? ['classic']
  const latestPayment = billing[0] ?? null
  const shortfall = latestPayment?.shortfall ?? 0
  const styles = themeStyles(activeThemeId)

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Listing</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Page & plan</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Your public page has a theme patients actually see on Aurora. Themes come with your
          plan — pick one, and upgrade whenever you need more.
        </p>
      </header>

      {updated ? (
        <AccountUpdatedNotice title={updated.title} detail={updated.detail} onDone={() => setUpdated(null)} />
      ) : null}

      {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

      {/* Account state: the verified badge and the plan both hang off this. */}
      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Wallet size={18} className="text-brand-700" />
            Account &amp; subscription
          </h2>
          <StatusChip
            status={latestPayment?.state ?? (hospital?.verification?.status === 'verified' ? 'verified-active' : 'inactive')}
            label={ACTIVE_LABELS[latestPayment?.state] ?? 'Not subscribed'}
          />
        </div>

        <div className="mt-4">
          <SectionTabs
            label="Account sections"
            active={tab}
            onChange={setTab}
            tabs={[
              {
                id: 'payments',
                label: 'Payments',
                badge: latestPayment?.status === 'awaiting' ? 'action needed' : shortfall > 0 ? 'short' : '',
                tone: shortfall > 0 ? 'danger' : 'brand',
              },
              { id: 'history', label: 'History', badge: history.length ? String(history.length) : '' },
            ]}
          />
        </div>

        {tab === 'payments' ? (
          <>
        <p className="mt-2 text-sm leading-relaxed text-body">
          {hospital?.verification?.status === 'verified' ? 'Documents verified. ' : 'Documents not verified yet. '}
          {latestPayment?.state === 'verified-active'
            ? 'Your subscription is paid up, so your listing shows the verified badge with your chosen theme.'
            : latestPayment?.state === 'active'
              ? 'Your plan is active.'
              : 'Your plan becomes active once the payment is verified.'}
        </p>

        {shortfall > 0 ? (
          <div className="mt-4 flex flex-wrap items-start gap-3 rounded-xl border border-danger/40 bg-danger/5 px-5 py-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">
                Payment is short by {shortfall} {latestPayment?.coin}
              </p>
              <p className="mt-1 text-sm text-body">
                You sent {latestPayment?.received} of {latestPayment?.amount} {latestPayment?.coin}. The plan
                stays inactive until the remainder arrives — send the difference to{' '}
                <span className="font-mono font-semibold text-ink">
                  {latestPayment?.payToId || latestPayment?.payToEmail}
                </span>{' '}
                and it will complete the same request (reference {latestPayment?.reference}).
              </p>
            </div>
          </div>
        ) : null}

        {latestPayment ? (
          <div className="mt-5">
            <PaymentProgress
              title="Plan payment"
              live={latestPayment.status === 'awaiting'}
              steps={(latestPayment.steps ?? []).map((step) =>
                step.key === 'received' && shortfall > 0
                  ? { ...step, note: `${latestPayment.received} of ${latestPayment.amount} ${latestPayment.coin} received — ${shortfall} outstanding` }
                  : step,
              )}
              note={
                latestPayment.status === 'awaiting'
                  ? `Send exactly ${latestPayment.amount} ${latestPayment.coin} to ${
                      latestPayment.payToId || latestPayment.payToEmail || 'the configured account'
                    }, then press "Check payment now" below.`
                  : ''
              }
            />
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-surface px-4 py-6 text-center text-sm text-mist">
            No payment on record — your plan is active without one.
          </p>
        )}

          {latestPayment && latestPayment.status === 'awaiting' ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runPaymentCheck}
                disabled={paymentCheckBusy}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {paymentCheckBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Check payment now
              </button>

              <button
                type="button"
                onClick={cancelOpenRequest}
                disabled={cancelBusy}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-5 text-sm font-semibold text-body transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {cancelBusy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Cancel request
              </button>

              <span className="text-xs text-mist">
                Checking looks for your transfer immediately — incoming transfers only. Cancelling
                withdraws the plan request and nothing is charged.
              </span>
            </div>
          ) : null}

          {paymentCheckResult ? (
            <p className="mt-3 text-sm font-medium text-brand-800">{paymentCheckResult}</p>
          ) : null}
          </>
        ) : null}

        {/* Current subscription, straight from the hospital record. */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-surface px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-mist">Current plan</p>
            <p className="mt-1 text-base font-bold text-ink">
              {PLAN_NAMES[latestPayment?.currentPlan?.planId ?? hospital?.subscription?.planId ?? 'starter'] ?? 'Starter'}
            </p>
            <p className="mt-0.5 text-xs text-mist">
              {latestPayment?.currentPlan?.status ?? hospital?.subscription?.status ?? 'inactive'}
            </p>
          </div>

          <div className="rounded-xl bg-surface px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-mist">Renews</p>
            <p className="mt-1 text-base font-bold text-ink">
              {(() => {
                const renewsAt = latestPayment?.currentPlan?.renewsAt ?? hospital?.subscription?.renewsAt
                return renewsAt ? new Date(renewsAt).toLocaleDateString('en-US') : '—'
              })()}
            </p>
            <p className="mt-0.5 text-xs text-mist">monthly cycle</p>
          </div>

          <div className="rounded-xl bg-surface px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-mist">Listing themes</p>
            <p className="mt-1 text-base font-bold text-ink">{allowedThemes.length}</p>
            <p className="mt-0.5 text-xs text-mist">{allowedThemes.join(', ')}</p>
          </div>
        </div>

        {/* History: every step this subscription has been through, newest first. */}
        {tab === 'history' && history.length ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Subscription history</h3>
              <span className="text-xs uppercase tracking-wide text-mist">{history.length} event(s)</span>
            </div>

            <ol className="mt-3 space-y-3 border-l border-line pl-5">
              {history.slice(0, 12).map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="relative">
                  <span
                    className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ${
                      entry.kind === 'approved' || entry.kind === 'activated' || entry.kind === 'payment'
                        ? 'bg-brand-600'
                        : entry.kind === 'rejected' || entry.kind === 'short'
                          ? 'bg-danger'
                          : 'bg-line'
                    }`}
                  />
                  <p className="text-sm font-semibold text-ink">{entry.label}</p>
                  <p className="mt-0.5 text-xs text-mist">
                    {new Date(entry.at).toLocaleString()}
                    {entry.detail ? ` · ${entry.detail}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">Current plan</p>
          <p className="mt-2 text-2xl font-extrabold text-ink">{activePlan?.name ?? 'Starter'}</p>
          <p className="mt-1 text-sm text-mist">{activePlan?.tagline}</p>
          <p className="mt-4 text-lg font-bold text-ink">
            {activePlan?.price ? `Rs ${activePlan.price.toLocaleString('en-US')}` : 'Free'}
            {activePlan?.price ? <span className="text-xs font-medium text-mist"> / month</span> : null}
          </p>

          {data.subscription?.renewsAt ? (
            <p className="mt-2 text-xs text-mist">
              Renews {new Date(data.subscription.renewsAt).toLocaleDateString('en-US')}
            </p>
          ) : null}

          <ul className="mt-5 space-y-2">
            {(activePlan?.features ?? []).map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-body">
                <Check size={14} className="mt-0.5 shrink-0 text-brand-700" strokeWidth={3} />
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-ink">Plans</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(data.plans ?? []).map((plan) => {
              const active = plan.id === activePlan?.id

              return (
                <article
                  key={plan.id}
                  className={`flex flex-col rounded-2xl border p-5 ${
                    active ? 'border-brand-300 bg-brand-50/60 shadow-soft' : 'border-line bg-white'
                  }`}
                >
                  <p className="text-sm font-bold text-ink">{plan.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-mist">{plan.tagline}</p>
                  <p className="mt-3 text-lg font-extrabold text-ink">
                    {plan.price ? `Rs ${plan.price.toLocaleString('en-US')}` : 'Free'}
                  </p>
                  {plan.price ? (
                    <p className="mt-0.5 text-xs font-semibold text-brand-700">
                      ≈ {Math.max(1, Math.round((plan.price / 330) * 100) / 100)} USDT to transfer
                      <span className="ml-1 font-normal text-mist">(at 330 PKR per USDT)</span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-mist">
                    {plan.themes.length} theme{plan.themes.length === 1 ? '' : 's'} included
                  </p>

                  <button
                    type="button"
                    onClick={() => choosePlan(plan.id)}
                    disabled={active || busy === plan.id}
                    className={`mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-70 ${
                      active
                        ? 'border border-brand-200 bg-white text-brand-800'
                        : 'bg-brand-700 text-white hover:bg-brand-800'
                    }`}
                  >
                    {busy === plan.id ? <Loader2 size={14} className="animate-spin" /> : null}
                    {active ? 'Active' : `Choose ${plan.name}`}
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">Page themes</h2>
        <p className="mt-1 text-sm text-mist">
          Every theme is shown to patients on your public listing — preview and switch any time.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {(data.themes ?? []).map((theme) => {
            const locked = !allowedThemes.includes(theme.id)
            const active = theme.id === activeThemeId

            return (
              <article
                key={theme.id}
                className={`overflow-hidden rounded-2xl border ${
                  active ? 'border-brand-300 shadow-soft' : 'border-line'
                }`}
              >
                <div className={`p-5 ${themeStyles(theme.id).hero}`}>
                  <p className={`text-lg font-extrabold ${themeStyles(theme.id).title}`}>
                    {hospital?.name ?? 'Your hospital'}
                  </p>
                  <p className={`mt-1 text-xs ${themeStyles(theme.id).muted}`}>
                    {hospital?.area} · {hospital?.city}
                  </p>
                  <span
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${themeStyles(theme.id).badge}`}
                  >
                    {theme.id === 'classic' ? 'Default look' : theme.name}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{theme.name}</p>
                    <p className="mt-0.5 text-xs text-mist">{theme.description}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {active ? <StatusChip status="active" /> : null}
                    {locked ? (
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-mist">
                        <Lock size={13} />
                        {theme.planId} plan
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => chooseTheme(theme.id)}
                        disabled={active || busy === theme.id}
                        className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                      >
                        {busy === theme.id ? <Loader2 size={13} className="animate-spin" /> : null}
                        {active ? 'In use' : 'Use theme'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className={`mt-8 rounded-2xl p-6 ${styles.hero}`}>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-700">
            <Sparkles size={14} />
            Live preview
          </p>
          <p className={`mt-3 text-2xl font-extrabold ${styles.title}`}>
            {hospital?.name ?? 'Your hospital'}
          </p>
          <p className={`mt-2 max-w-lg text-sm leading-relaxed ${styles.body}`}>
            {hospital?.description || 'Your description appears here for patients.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(hospital?.specialties ?? []).slice(0, 4).map((specialty) => (
              <span
                key={specialty}
                className={`rounded-full px-3 py-1 text-xs font-medium ${styles.chip}`}
              >
                {specialty}
              </span>
            ))}
          </div>
          <span
            className={`mt-5 inline-flex rounded-full px-5 py-3 text-xs font-bold uppercase tracking-widest ${styles.primary}`}
          >
            Call hospital
          </span>
        </div>
      </section>
      <CheckoutDialog
        open={Boolean(checkout)}
        payment={checkout}
        busy={checkoutBusy}
        result={checkoutResult}
        title={checkout?.request?.plan ? `Upgrade to ${checkout.request.plan}` : 'Complete your transfer'}
        onClose={() => {
          setCheckout(null)
          setCheckoutResult('')
        }}
        onCheck={async () => {
          if (!checkout) return

          setCheckoutBusy('check')
          setCheckoutResult('')

          try {
            const result = await api.payments.checkIntent(checkout.id)
            const rows = await api.payments.subscription()

            setBilling(rows ?? [])
            setCheckout((current) => (rows ?? []).find((row) => row.id === current?.id) ?? null)

            setCheckoutResult(
              result.status === 'verified'
                ? 'Payment received and verified — waiting on Aurora to approve and activate the plan.'
                : 'Nothing matched yet. Aurora looks for the exact amount with its unique offset — checks keep running while this is open.',
            )
          } catch (err) {
            setCheckoutResult(err.message || 'Could not check the payment right now.')
          } finally {
            setCheckoutBusy('')
          }
        }}
        onSimulate={
          checkout?.request
            ? async () => {
                setCheckoutBusy('simulate')

                try {
                  await api.payments.simulateIntent(checkout.id)
                  const rows = await api.payments.subscription()

                  setBilling(rows ?? [])
                  setCheckout((current) => (rows ?? []).find((row) => row.id === current?.id) ?? null)
                  setCheckoutResult('Simulated transfer matched — this is exactly how a real confirmation looks.')
                } catch (err) {
                  setCheckoutResult(err.message || 'Simulation is switched off.')
                } finally {
                  setCheckoutBusy('')
                }
              }
            : null
        }
        onCancel={async () => {
          if (!checkout) return

          setCheckoutBusy('cancel')

          try {
            await api.payments.cancelIntent(checkout.id)
            const rows = await api.payments.subscription()

            setBilling(rows ?? [])
            setCheckout(null)
            setCheckoutResult('')
            setNotice('Payment request cancelled — nothing was charged. Start the upgrade again whenever you are ready.')
          } catch (err) {
            setCheckoutResult(err.message || 'Could not cancel that request.')
          } finally {
            setCheckoutBusy('')
          }
        }}
      />
    </>
  )
}
