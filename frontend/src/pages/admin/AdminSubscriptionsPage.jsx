import { useEffect, useState } from 'react'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'

export default function AdminSubscriptionsPage() {
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false

    api.admin
      .subscriptions()
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

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading subscriptions…</p>
  }

  if (state === 'error' || !data) {
    return <p className="text-sm text-danger">Couldn't load subscriptions. Refresh to try again.</p>
  }

  const active = data.rows.filter((row) => row.subscription?.status === 'active')

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Themes & subscriptions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Hospitals buy a plan, and each plan unlocks page themes patients actually see. This is
          the marketplace view.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">
            Monthly recurring
          </p>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            Rs {data.mrr.toLocaleString('en-US')}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">
            Active subscriptions
          </p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">Themes on sale</p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{data.themes.length}</p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">Plans</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {data.plans.map((plan) => (
            <article key={plan.id} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
              <p className="text-sm font-bold text-ink">{plan.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-mist">{plan.tagline}</p>
              <p className="mt-3 text-lg font-extrabold text-ink">
                {plan.price ? `Rs ${plan.price.toLocaleString('en-US')}` : 'Free'}
              </p>
              <ul className="mt-3 space-y-1.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-xs leading-relaxed text-body">
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.themes.map((themeId) => (
                  <span
                    key={themeId}
                    className="rounded-full border border-line px-3 py-1 text-xs font-medium text-body"
                  >
                    {themeId}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">Hospital subscriptions</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line shadow-soft">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-surface">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                  Hospital
                </th>
                <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist md:table-cell">
                  City
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                  Plan
                </th>
                <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist md:table-cell">
                  Theme
                </th>
                <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist md:table-cell">
                  Renews
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                  <td className="hidden px-4 py-3 text-body md:table-cell">{row.city}</td>
                  <td className="px-4 py-3 text-body">
                    {row.plan?.name ?? 'Starter'}
                    {row.plan?.price ? (
                      <span className="ml-2 text-xs text-mist">
                        Rs {row.plan.price.toLocaleString('en-US')}
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-body md:table-cell">
                    {row.subscription?.themeId ?? 'classic'}
                  </td>
                  <td className="hidden px-4 py-3 text-body md:table-cell">
                    {row.subscription?.renewsAt
                      ? new Date(row.subscription.renewsAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={row.subscription?.status ?? 'none'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
