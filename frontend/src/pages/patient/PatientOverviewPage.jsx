import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Brain,
  Building2,
  CalendarCheck,
  FlaskConical,
  HeartHandshake,
  MapPin,
  Settings,
  Sparkles,
  Star,
} from 'lucide-react'
import { useAuth } from '../../context/auth-context'
import VoiceBookingCard from '../../components/VoiceBookingCard'
import { api } from '../../lib/api'

export default function PatientOverviewPage() {
  const { user } = useAuth()
  const [hospitals, setHospitals] = useState([])
  const [appointments, setAppointments] = useState([])
  const [labOrders, setLabOrders] = useState([])
  const [personas, setPersonas] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false

    Promise.all([api.hospitals.list(), api.appointments.mine(), api.lab.mine(), api.aurora.personas()])
      .then(([hospitalsData, appointmentsData, labData, personaData]) => {
        if (cancelled) return
        setHospitals(hospitalsData ?? [])
        setAppointments(appointmentsData ?? [])
        setLabOrders(labData ?? [])
        setPersonas(personaData ?? [])
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const firstName = (user?.name ?? '').trim().split(' ')[0]
  const recommended = [...hospitals].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3)

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
          Patient dashboard
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
          Find verified hospitals, work out which kind of care you need, and keep your account
          details in order.
        </p>
      </header>

      {user && !user.emailVerifiedAt ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Confirm your email address</h2>
            <p className="mt-1 text-sm text-body">
              Sign-in codes and password resets go to {user.email} — confirm it so they always
              reach you.
            </p>
          </div>
          <Link
            to="/verify-email"
            className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Verify email
            <ArrowRight size={13} />
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Link
          to="/explore"
          className="group rounded-2xl border border-line bg-white p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-colors duration-300 group-hover:bg-brand-100">
            <Building2 size={20} />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-ink">Find a hospital</h2>
          <p className="mt-2 text-sm leading-relaxed text-body">
            Search verified hospitals by city, area, or specialty, and sort them by distance.
          </p>
        </Link>

        <Link
          to="/dashboard/ai-doctors"
          className="group rounded-2xl border border-line bg-white p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-colors duration-300 group-hover:bg-brand-100">
            <Sparkles size={20} />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-ink">Ask Aurora</h2>
          <p className="mt-2 text-sm leading-relaxed text-body">
            Describe what is going on and our own AI doctors will point you at the right kind of
            care.
          </p>
        </Link>

        <Link
          to="/dashboard/settings"
          className="group rounded-2xl border border-line bg-white p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-colors duration-300 group-hover:bg-brand-100">
            <Settings size={20} />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-ink">Account settings</h2>
          <p className="mt-2 text-sm leading-relaxed text-body">
            Update your name, check your email status, and change your password.
          </p>
        </Link>
      </div>

      <section className="mt-8 rounded-2xl border border-brand-200 bg-brand-50 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Brain size={18} className="text-brand-700" />
              Aurora AI — included free
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-body">
              Our own AI clinicians run on our servers: talk through symptoms, or open the therapy
              room for a private space that remembers your history between sessions.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/dashboard/ai-doctors"
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              AI doctors
              <ArrowRight size={13} />
            </Link>
            <Link
              to="/dashboard/therapy"
              className="inline-flex items-center gap-2 rounded-full border border-brand-300 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-800 transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              <HeartHandshake size={13} />
              Therapy
            </Link>
          </div>
        </div>

        {personas.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personas.map((persona) => (
              <Link
                key={persona.id}
                to={persona.id === 'therapy' ? '/dashboard/therapy' : '/dashboard/ai-doctors'}
                className="rounded-xl border border-line bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
              >
                <p className="text-sm font-semibold text-ink">{persona.name}</p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                  {persona.specialty}
                </p>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-body">{persona.blurb}</p>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <div className="mt-8">
        <VoiceBookingCard
          hospitalId={recommended[0]?.id ?? recommended[0]?._id}
          hospitalName={recommended[0]?.name}
        />
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <CalendarCheck size={18} className="text-brand-700" />
              Your visits
            </h2>
            <Link
              to="/dashboard/appointments"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              All
              <ArrowRight size={13} />
            </Link>
          </div>

          {appointments.length ? (
            <ul className="mt-4 space-y-3">
              {appointments.slice(0, 3).map((item) => (
                <li key={item.id ?? item._id} className="rounded-xl bg-surface px-4 py-3">
                  <p className="text-sm font-semibold text-ink">
                    {item.hospital?.name ?? 'Hospital'} — {item.date} at {item.time}
                  </p>
                  <p className="mt-0.5 text-xs text-mist">
                    {item.doctorName || 'Any doctor'} · {item.status}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-surface px-4 py-6 text-sm text-mist">
              No appointments yet — open a hospital to book one.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <FlaskConical size={18} className="text-brand-700" />
              Lab results
            </h2>
            <Link
              to="/dashboard/lab"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              All
              <ArrowRight size={13} />
            </Link>
          </div>

          {labOrders.length ? (
            <ul className="mt-4 space-y-3">
              {labOrders.slice(0, 3).map((order) => (
                <li key={order.id ?? order._id} className="rounded-xl bg-surface px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{order.testName}</p>
                  <p className="mt-0.5 text-xs text-mist">
                    {order.hospital?.name ?? 'Hospital'} · {order.status}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-surface px-4 py-6 text-sm text-mist">
              No lab orders yet — results appear here automatically.
            </p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Highly rated hospitals</h2>
            <p className="mt-1 text-sm text-mist">The best reviewed places on Aurora right now.</p>
          </div>
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            See all hospitals
            <ArrowRight size={14} />
          </Link>
        </div>

        {state === 'loading' ? <p className="mt-5 text-sm text-mist">Loading hospitals…</p> : null}
        {state === 'error' ? (
          <p className="mt-5 text-sm text-danger">
            Couldn't load hospitals right now. Try again in a moment.
          </p>
        ) : null}
        {state === 'ready' && recommended.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
            No hospitals are listed yet — check back soon.
          </p>
        ) : null}

        {state === 'ready' && recommended.length > 0 ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-3">
            {recommended.map((hospital) => (
              <article
                key={hospital.id ?? hospital._id}
                className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-soft"
              >
                <div className="flex items-start gap-4">
                  {hospital.logoUrl ? (
                    <img
                      src={hospital.logoUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-xl border border-line object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-brand-200 bg-brand-50 text-lg font-extrabold text-brand-700">
                      {hospital.name?.charAt(0) ?? 'A'}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-ink">{hospital.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-mist">
                      <MapPin size={13} />
                      {hospital.area} · {hospital.city}
                    </p>
                  </div>
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-body">
                  {hospital.description}
                </p>

                <div className="mt-auto flex items-center justify-between gap-4 pt-5">
                  <span className="flex items-center gap-2">
                    <Star size={14} fill="currentColor" strokeWidth={0} className="text-brand-500" />
                    <span className="text-sm font-semibold text-ink">
                      {hospital.rating?.toFixed(1)}
                    </span>
                    <span className="text-xs text-mist">({hospital.reviewCount})</span>
                  </span>

                  <Link
                    to={`/explore/${hospital.id ?? hospital._id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                  >
                    View
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </>
  )
}
