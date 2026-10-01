import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarCheck, MapPin, Phone, ShieldCheck, Sparkles, Star } from 'lucide-react'
import SelectField from '../components/SelectField'
import VoiceBookingCard from '../components/VoiceBookingCard'
import { api } from '../lib/api'
import { SLOT_TIMES, formatSlotDate, themeStyles, todayISO } from '../lib/themes'

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

function BookingCard({ hospital, doctors, theme }) {
  const [mode, setMode] = useState('ai')
  const [query, setQuery] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const [manual, setManual] = useState({
    doctorId: doctors[0]?.id ?? doctors[0]?._id ?? '',
    date: todayISO(),
    time: SLOT_TIMES[0],
    reason: '',
  })
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')

  const busy = state === 'thinking' || state === 'booking'

  async function askAurora(event) {
    event.preventDefault()
    setError('')
    setState('thinking')

    try {
      const result = await api.ai.booking({ hospitalId: hospital.id ?? hospital._id, query })
      setSuggestion(result)
      setState('idle')
    } catch (err) {
      setError(err.message || 'The assistant is unavailable right now.')
      setState('idle')
    }
  }

  async function confirmSuggestion() {
    setError('')
    setState('booking')

    try {
      await api.appointments.book({
        hospitalId: hospital.id ?? hospital._id,
        doctorId: suggestion.doctor?.id,
        date: suggestion.slot.date,
        time: suggestion.slot.time,
        reason: suggestion.summary || 'Visit requested through Aurora AI',
        source: 'ai',
        aiNote: suggestion.summary ?? '',
      })
      setState('booked')
    } catch (err) {
      setError(err.message || 'That booking could not be completed.')
      setState('idle')
    }
  }

  async function bookManually(event) {
    event.preventDefault()
    setError('')
    setState('booking')

    try {
      await api.appointments.book({
        hospitalId: hospital.id ?? hospital._id,
        ...manual,
      })
      setState('booked')
    } catch (err) {
      setError(err.message || 'That booking could not be completed.')
      setState('idle')
    }
  }

  if (!doctors.length) {
    return (
      <section className={`mt-6 p-6 ${theme.card}`}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <CalendarCheck size={18} className="text-brand-700" />
          Appointments
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-body">
          This hospital has not listed doctors for booking yet — call them directly and the front
          desk will arrange a time.
        </p>
      </section>
    )
  }

  return (
    <section className={`mt-6 p-6 ${theme.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <CalendarCheck size={18} className="text-brand-700" />
          Book an appointment
        </h2>

        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {[
            { id: 'ai', label: 'Ask Aurora' },
            { id: 'manual', label: 'Pick a time' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              aria-pressed={mode === tab.id}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
                mode === tab.id ? 'bg-white text-ink shadow-soft' : 'text-mist hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {state === 'booked' ? (
        <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4">
          <p className="text-sm font-semibold text-brand-800">
            Request sent — the hospital confirms it shortly.
          </p>
          <Link
            to="/dashboard/appointments"
            className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            See your appointments
          </Link>
        </div>
      ) : null}

      {mode === 'ai' && state !== 'booked' ? (
        <form onSubmit={askAurora} className="mt-5">
          <label htmlFor="booking-query" className="text-sm font-semibold text-ink">
            What do you need help with?
          </label>
          <textarea
            id="booking-query"
            rows={3}
            required
            minLength={10}
            maxLength={500}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Chest tightness when I walk uphill, mostly in the evenings"
            className="mt-2 w-full rounded-lg border border-line bg-white p-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
          />
          <button
            type="submit"
            disabled={busy || query.trim().length < 10}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:translate-y-0 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {state === 'thinking' ? 'Finding the right doctor…' : 'Suggest a doctor and time'}
          </button>
        </form>
      ) : null}

      {suggestion && state !== 'booked' ? (
        <div className="mt-5 rounded-xl border border-brand-200 bg-white p-5">
          <p className="text-sm font-semibold text-ink">{suggestion.summary}</p>
          <p className="mt-1 text-xs text-mist">
            Suggested specialty: {suggestion.specialty || 'General'} · urgency: {suggestion.urgency}
          </p>

          {suggestion.doctor && suggestion.slot ? (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg bg-surface px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">
                  {suggestion.doctor.name}
                  {suggestion.doctor.specialty ? ` · ${suggestion.doctor.specialty}` : ''}
                </span>
                <span className="block text-xs text-mist">
                  {formatSlotDate(suggestion.slot.date)} at {suggestion.slot.time}
                </span>
              </span>

              <button
                type="button"
                onClick={confirmSuggestion}
                disabled={busy}
                className="inline-flex h-10 items-center rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {state === 'booking' ? 'Booking…' : 'Confirm this booking'}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-body">
              No free slot found in the next week — call the hospital to arrange a time.
            </p>
          )}

          <p className="mt-3 text-xs leading-relaxed text-mist">{suggestion.disclaimer}</p>
        </div>
      ) : null}

      {mode === 'manual' && state !== 'booked' ? (
        <form onSubmit={bookManually} className="mt-5 grid gap-5 sm:grid-cols-2">
          <SelectField
            id="doctorId"
            label="Doctor"
            required
            value={manual.doctorId}
            onChange={(event) => setManual((c) => ({ ...c, doctorId: event.target.value }))}
            options={doctors.map((doctor) => ({
              value: doctor.id ?? doctor._id,
              label: `${doctor.name}${doctor.specialty ? ` — ${doctor.specialty}` : ''}`,
            }))}
          />

          <div>
            <label htmlFor="date" className="text-sm font-semibold text-ink">
              Date
            </label>
            <input
              id="date"
              type="date"
              required
              min={todayISO()}
              value={manual.date}
              onChange={(event) => setManual((c) => ({ ...c, date: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
            />
          </div>

          <SelectField
            id="time"
            label="Time"
            required
            value={manual.time}
            onChange={(event) => setManual((c) => ({ ...c, time: event.target.value }))}
            options={SLOT_TIMES}
          />

          <div className="sm:col-span-2">
            <label htmlFor="reason" className="text-sm font-semibold text-ink">
              Reason for the visit
            </label>
            <input
              id="reason"
              required
              minLength={5}
              maxLength={300}
              value={manual.reason}
              onChange={(event) => setManual((c) => ({ ...c, reason: event.target.value }))}
              className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {state === 'booking' ? 'Booking…' : 'Request appointment'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm font-medium text-danger">{error}</p> : null}
    </section>
  )
}

export default function HospitalDetailPage() {
  const { hospitalId } = useParams()
  const [hospital, setHospital] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [state, setState] = useState('loading')

  const load = useCallback(async () => {
    setState('loading')

    try {
      const [hospitalData, doctorsData] = await Promise.all([
        api.hospitals.get(hospitalId),
        api.hospitals.doctors(hospitalId).catch(() => []),
      ])
      setHospital(hospitalData?.hospital ?? null)
      setDoctors(doctorsData ?? [])
      setState('ready')
    } catch (err) {
      setState(err.status === 404 ? 'missing' : 'error')
    }
  }, [hospitalId])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api.hospitals.get(hospitalId),
      api.hospitals.doctors(hospitalId).catch(() => []),
    ])
      .then(([hospitalData, doctorsData]) => {
        if (cancelled) return
        setHospital(hospitalData?.hospital ?? null)
        setDoctors(doctorsData ?? [])
        setState('ready')
      })
      .catch((err) => {
        if (!cancelled) setState(err.status === 404 ? 'missing' : 'error')
      })

    return () => {
      cancelled = true
    }
  }, [hospitalId])

  const theme = themeStyles(hospital?.subscription?.themeId)
  const verified = hospital?.verification?.status === 'verified'

  const directionsUrl = hospital
    ? hospital.location?.lat != null && hospital.location?.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${hospital.location.lat},${hospital.location.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${hospital.name} ${hospital.area} ${hospital.city}`,
        )}`
    : '#'

  return (
    <div className={`w-full rounded-2xl p-4 sm:p-6 ${theme.page}`}>
      <Link
        to="/explore"
        className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${theme.muted} hover:opacity-80`}
      >
        <ArrowLeft size={15} />
        Back to explore
      </Link>

      {state === 'loading' ? (
        <div className="mt-10 space-y-4">
          <div className="h-32 animate-pulse rounded-2xl bg-surface" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface" />
        </div>
      ) : null}

      {state === 'missing' ? (
        <div className={`mt-8 p-6 ${theme.card}`}>
          <h1 className="text-xl font-semibold text-ink">Hospital not found</h1>
          <p className="mt-2 text-sm leading-relaxed text-body">
            This hospital is not listed on Aurora right now — it may have been removed.
          </p>
          <Link
            to="/explore"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Back to explore
          </Link>
        </div>
      ) : null}

      {state === 'error' ? (
        <div className={`mt-8 p-6 ${theme.card}`}>
          <h1 className="text-xl font-semibold text-ink">Couldn't load this hospital</h1>
          <p className="mt-2 text-sm leading-relaxed text-body">
            Something went wrong on the way. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-5 inline-flex h-11 items-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      ) : null}

      {state === 'ready' && hospital ? (
        <>
          <header className={`mt-6 ${theme.hero}`}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {hospital.logoUrl ? (
                <img
                  src={hospital.logoUrl}
                  alt={`${hospital.name} logo`}
                  className="h-24 w-24 shrink-0 rounded-2xl border border-line object-cover"
                />
              ) : (
                <span className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border border-brand-200 bg-brand-50 text-3xl font-extrabold text-brand-700">
                  {hospital.name?.charAt(0) ?? 'A'}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className={`text-3xl font-extrabold tracking-tight sm:text-4xl ${theme.title}`}>
                    {hospital.name}
                  </h1>
                  {verified ? (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${theme.badge}`}
                    >
                      <ShieldCheck size={13} />
                      Verified
                    </span>
                  ) : null}
                </div>

                <p className={`mt-2 flex items-center gap-2 text-sm ${theme.muted}`}>
                  <MapPin size={15} />
                  {hospital.area} · {hospital.city}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Stars rating={hospital.rating} />
                  <span className={`text-sm font-semibold ${theme.title}`}>
                    {hospital.rating?.toFixed(1)}
                  </span>
                  <span className={`text-xs ${theme.muted}`}>
                    ({hospital.reviewCount} reviews)
                  </span>
                </div>

                {hospital.specialties?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {hospital.specialties.map((specialty) => (
                      <span
                        key={specialty}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${theme.chip}`}
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  {hospital.phone ? (
                    <a
                      href={`tel:${hospital.phone}`}
                      className={`inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-xs font-bold uppercase tracking-widest transition duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${theme.primary}`}
                    >
                      <Phone size={14} />
                      Call hospital
                    </a>
                  ) : null}
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-xs font-bold uppercase tracking-widest transition duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${theme.secondary}`}
                  >
                    <MapPin size={14} />
                    Get directions
                  </a>
                </div>
              </div>
            </div>
          </header>

          <BookingCard hospital={hospital} doctors={doctors} theme={theme} />

          <div className="mt-6">
            <VoiceBookingCard
              hospitalId={hospital.id ?? hospital._id}
              hospitalName={hospital.name}
            />
          </div>

          {hospital.photos?.length ? (
            <section className="mt-10">
              <h2 className={`text-lg font-semibold ${theme.title}`}>Photos</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {hospital.photos.map((photo) => (
                  <img
                    key={photo}
                    src={photo}
                    alt=""
                    className="aspect-[4/3] w-full rounded-2xl border border-line object-cover"
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-10">
            <h2 className={`text-lg font-semibold ${theme.title}`}>About</h2>
            <div className={`mt-4 grid gap-6 p-6 lg:grid-cols-2 lg:gap-10 ${theme.card}`}>
              <p className="max-w-3xl text-sm leading-relaxed text-body">{hospital.description}</p>

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-mist">
                    Address
                  </dt>
                  <dd className="mt-1 text-sm text-ink">
                    {hospital.address || `${hospital.area}, ${hospital.city}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-mist">
                    Phone
                  </dt>
                  <dd className="mt-1 text-sm text-ink">{hospital.phone || 'Not listed'}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="mt-10">
            <h2 className={`text-lg font-semibold ${theme.title}`}>Patient reviews</h2>

            {hospital.reviews?.length ? (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {hospital.reviews.map((review) => (
                  <li key={`${review.author}-${review.text}`} className={`p-6 ${theme.card}`}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-ink">{review.author}</span>
                      <Stars rating={review.rating} />
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-body">“{review.text}”</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`mt-4 text-sm ${theme.muted}`}>
                No reviews yet — reviews appear after patients visit.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
