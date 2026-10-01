import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'
import { LAB_STATUS_LABELS } from '../../lib/labels'

export default function PatientLabPage() {
  const [orders, setOrders] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false

    api.lab
      .mine()
      .then((data) => {
        if (cancelled) return
        setOrders(data ?? [])
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Laboratory</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Lab results</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
          Results appear here as soon as the hospital publishes them — nothing to chase.
        </p>
      </header>

      {state === 'loading' ? <p className="mt-8 text-sm text-mist">Loading your results…</p> : null}
      {state === 'error' ? (
        <p className="mt-8 text-sm text-danger">Couldn't load your lab results right now.</p>
      ) : null}

      {state === 'ready' && orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
          <FlaskConical size={22} className="mx-auto text-brand-700" />
          <p className="mt-3 text-sm font-semibold text-ink">No lab orders yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-mist">
            When a hospital raises a test against your account email, it shows up here with the
            result.
          </p>
        </div>
      ) : null}

      {state === 'ready' && orders.length > 0 ? (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li
              key={order.id ?? order._id}
              className="rounded-2xl border border-line bg-white px-6 py-5 shadow-soft"
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{order.testName}</p>
                  <p className="mt-1 text-xs text-mist">
                    {order.hospital?.name ?? 'Hospital'}
                    {order.hospital?.city ? ` · ${order.hospital.city}` : ''}
                    {order.orderedBy ? ` · requested by ${order.orderedBy}` : ''}
                  </p>
                </div>
                <StatusChip
                  status={order.status}
                  label={LAB_STATUS_LABELS[order.status] ?? order.status}
                />
              </div>

              {order.resultSummary ? (
                <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-body">
                  {order.resultSummary}
                </p>
              ) : (
                <p className="mt-3 text-xs text-mist">
                  {order.status === 'completed'
                    ? 'Your doctor is reviewing this report — it appears here the moment it is released.'
                    : 'The laboratory is still working on this one.'}
                </p>
              )}

              {order.status === 'sent' ? (
                <Link
                  to={`/dashboard/lab/${order.id ?? order._id}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                >
                  View full report
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
