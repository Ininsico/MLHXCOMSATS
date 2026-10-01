import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  FlaskConical,
  MapPin,
  PackageX,
  ShieldCheck,
  Star,
} from 'lucide-react'
import StatusChip from '../../components/StatusChip'
import { APPOINTMENT_STATUS_LABELS } from '../../lib/labels'
import { api } from '../../lib/api'
import { formatSlotDate, todayISO } from '../../lib/themes'

function Stars({ rating }) {
  const rounded = Math.round(rating ?? 0)

  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((star) => (
        <Star
          key={star}
          size={14}
          fill={star < rounded ? 'currentColor' : 'none'}
          className={star < rounded ? 'text-brand-500' : 'text-line'}
          strokeWidth={star < rounded ? 0 : 2}
        />
      ))}
    </span>
  )
}

export default function HospitalOverviewPage() {
  const { hospital, appointments, inventory, labOrders, staff, state } = useOutletContext()
  const [watch, setWatch] = useState({ alerts: [], turns: [], queue: null })

  useEffect(() => {
    let cancelled = false

    api.nurse
      .alerts()
      .then((data) => {
        if (!cancelled) setWatch(data)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading your hospital…</p>
  }

  if (state !== 'ready' || !hospital) {
    return <p className="text-sm text-danger">Couldn't load your hospital. Refresh to try again.</p>
  }

  const today = todayISO()
  const todayAppointments = appointments
    .filter((item) => item.date === today && item.status !== 'cancelled')
    .sort((a, b) => a.time.localeCompare(b.time))

  const upcoming = appointments
    .filter((item) => item.date > today && item.status !== 'cancelled')
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 5)

  const lowStock = inventory.filter((item) => item.quantity <= item.reorderLevel)
  const openLabs = labOrders.filter((item) =>
    ['requested', 'collected', 'processing'].includes(item.status),
  )
  const doctors = staff.filter((member) => member.role === 'doctor' && member.status === 'active')

  const alerts = [
    lowStock.length
      ? {
          key: 'stock',
          icon: PackageX,
          text: `${lowStock.length} item${lowStock.length === 1 ? '' : 's'} at or below the reorder level`,
          to: '/hospital/inventory',
        }
      : null,
    openLabs.length
      ? {
          key: 'lab',
          icon: FlaskConical,
          text: `${openLabs.length} laboratory order${openLabs.length === 1 ? '' : 's'} in progress`,
          to: '/hospital/lab',
        }
      : null,
    hospital.verification?.status === 'unverified' || hospital.verification?.status === 'rejected'
      ? {
          key: 'verify',
          icon: ShieldCheck,
          text:
            hospital.verification?.status === 'rejected'
              ? 'Verification needs another look — upload clearer documents'
              : 'Submit verification documents to earn the trust badge',
          to: '/hospital/verification',
        }
      : null,
  ].filter(Boolean)

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
            Hospital dashboard
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{hospital.name}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-mist">
            <MapPin size={15} />
            {hospital.area} · {hospital.city}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-2xl border border-line bg-white px-5 py-4 shadow-soft">
            <span className="flex items-center gap-3">
              <Stars rating={hospital.rating} />
              <span className="text-lg font-extrabold text-ink">
                {hospital.rating?.toFixed(1) ?? '0.0'}
              </span>
            </span>
            <span className="mt-1 block text-xs text-mist">
              {hospital.reviewCount ?? 0} review{(hospital.reviewCount ?? 0) === 1 ? '' : 's'}
            </span>
          </span>
          <StatusChip status={hospital.verification?.status ?? 'unverified'} />
        </div>
      </header>

      {watch.alerts.length ? (
        <section className="mt-8 rounded-2xl border border-danger/40 bg-danger/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <AlertTriangle size={18} className="text-danger" />
              Red-flag alerts
            </h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-mist">
              {watch.turns.length} AI turns logged
              {watch.queue ? ` · queue ${watch.queue.connected ? `${watch.queue.messages ?? 0} waiting` : 'offline'}` : ''}
            </span>
          </div>

          <p className="mt-1 text-sm text-body">
            Patients the AI nurse or Aurora Therapy escalated — someone from the care team should
            call them back.
          </p>

          <ul className="mt-4 space-y-3">
            {watch.alerts.slice(0, 5).map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/25 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {alert.patientName}
                    <span className="ml-2 font-normal text-mist">{alert.phone}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-body">
                    {alert.escalations?.at(-1)?.reason ?? 'Escalated by the AI agent'} ·{' '}
                    {alert.program}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-danger">
                  {new Date(alert.lastMessageAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink">Today at a glance</h2>
            <Link
              to="/hospital/appointments"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              All appointments
              <ArrowRight size={14} />
            </Link>
          </div>

          {todayAppointments.length ? (
            <ul className="mt-5 space-y-3">
              {todayAppointments.slice(0, 5).map((item) => (
                <li
                  key={item.id ?? item._id}
                  className="flex items-center gap-4 rounded-xl bg-surface px-4 py-3"
                >
                  <span className="text-sm font-bold text-ink">{item.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {item.patientName}
                    </span>
                    <span className="block truncate text-xs text-mist">
                      {item.doctorName || 'Any doctor'}
                      {item.specialty ? ` · ${item.specialty}` : ''}
                    </span>
                  </span>
                  <StatusChip
                    status={item.status}
                    label={APPOINTMENT_STATUS_LABELS[item.status] ?? item.status}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl bg-surface px-4 py-6 text-sm text-mist">
              Nothing booked for today yet.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Needs attention</h2>

          {alerts.length ? (
            <ul className="mt-5 space-y-3">
              {alerts.map((alert) => (
                <li key={alert.key}>
                  <Link
                    to={alert.to}
                    className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-medium text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                  >
                    <alert.icon size={16} className="shrink-0 text-brand-700" />
                    <span className="flex-1">{alert.text}</span>
                    <ArrowRight size={14} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl bg-surface px-4 py-6 text-sm text-mist">
              All clear — stock levels, laboratory work and verification are up to date.
            </p>
          )}

          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-mist">
                Active doctors
              </dt>
              <dd className="mt-1 text-xl font-extrabold text-ink">{doctors.length}</dd>
            </div>
            <div className="rounded-xl border border-line px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-mist">
                Lab orders open
              </dt>
              <dd className="mt-1 text-xl font-extrabold text-ink">{openLabs.length}</dd>
            </div>
          </dl>
        </section>
      </div>

      {upcoming.length ? (
        <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <CalendarCheck size={18} className="text-brand-700" />
            <h2 className="text-lg font-semibold text-ink">Next appointments</h2>
          </div>

          <ul className="mt-5 divide-y divide-line">
            {upcoming.map((item) => (
              <li key={item.id ?? item._id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-40 text-sm font-semibold text-ink">
                  {formatSlotDate(item.date)} · {item.time}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-body">
                  {item.patientName} — {item.doctorName || 'any doctor'}
                </span>
                <StatusChip
                  status={item.status}
                  label={APPOINTMENT_STATUS_LABELS[item.status] ?? item.status}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
