import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Check, Loader2, Lock, Sparkles } from 'lucide-react'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'
import { themeStyles } from '../../lib/themes'

export default function HospitalPublicPage() {
  const { hospital, reload } = useOutletContext()
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

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
      const payload = await api.hospitals.setPlan(planId)
      setData((current) => ({ ...current, subscription: payload.subscription, plan: payload.plan }))
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
    </>
  )
}
