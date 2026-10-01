import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Sparkles, Star } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { api } from '../lib/api'
import { distanceKm, formatDistance } from '../lib/geo'

const URGENCY_STYLES = {
  routine: 'bg-brand-50 text-brand-800',
  soon: 'border border-line bg-surface text-body',
  urgent: 'bg-brand-950 text-white',
}

const URGENCY_LABELS = {
  routine: 'Routine',
  soon: 'See someone soon',
  urgent: 'Urgent',
}

function HospitalCard({ hospital }) {
  const review = hospital.reviews?.[0]
  const specialties = hospital.specialties ?? []
  const shown = specialties.slice(0, 3)
  const extra = specialties.length - shown.length
  const id = hospital.id ?? hospital._id

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-soft transition-shadow hover:shadow-lift">
      <div className="flex items-start gap-4">
        {hospital.logoUrl ? (
          <img
            src={hospital.logoUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl border border-line object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug text-ink">
            <Link to={`/explore/${id}`} className="transition-colors hover:text-brand-700">
              {hospital.name}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-mist">
            {hospital.area} · {hospital.city}
          </p>
        </div>
        {hospital.distance != null ? (
          <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
            {formatDistance(hospital.distance)}
          </span>
        ) : null}
      </div>

      {shown.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {shown.map((item) => (
            <span
              key={item}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-body"
            >
              {item}
            </span>
          ))}
          {extra > 0 ? (
            <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-mist">
              +{extra}
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-body">{hospital.description}</p>

      {review ? (
        <p className="mt-4 border-l-2 border-brand-200 pl-3 text-sm italic leading-relaxed text-mist">
          “{review.text}” — {review.author}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-5">
        <div className="flex items-center gap-2">
          <Star size={14} fill="currentColor" strokeWidth={0} className="text-brand-500" />
          <span className="text-sm font-semibold text-ink">{hospital.rating?.toFixed(1)}</span>
          <span className="text-xs text-mist">({hospital.reviewCount} reviews)</span>
        </div>

        <Link
          to={`/explore/${id}`}
          className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          View hospital
          <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  )
}

export default function ExplorePage() {
  const { user } = useAuth()
  const [hospitals, setHospitals] = useState([])
  const [state, setState] = useState('loading')
  const [query, setQuery] = useState('')
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationNote, setLocationNote] = useState('')

  const [triageQuery, setTriageQuery] = useState('')
  const [triageState, setTriageState] = useState('idle')
  const [triageResult, setTriageResult] = useState(null)
  const [triageError, setTriageError] = useState('')

  useEffect(() => {
    let cancelled = false

    api.hospitals
      .list()
      .then((data) => {
        if (cancelled) return
        setHospitals(data ?? [])
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = hospitals

    if (q) {
      list = list.filter((hospital) =>
        [hospital.name, hospital.city, hospital.area, ...(hospital.specialties ?? [])]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }

    if (coords) {
      return list
        .map((hospital) => ({
          ...hospital,
          distance: distanceKm(
            coords.lat,
            coords.lon,
            hospital.location?.lat,
            hospital.location?.lng,
          ),
        }))
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    }

    return [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  }, [hospitals, query, coords])

  function handleLocate() {
    if (!navigator.geolocation) {
      setLocationNote('Location is not available in this browser.')
      return
    }

    setLocating(true)
    setLocationNote('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lon: position.coords.longitude })
        setLocating(false)
      },
      () => {
        setLocating(false)
        setLocationNote('Location permission denied — showing every hospital instead.')
      },
      { timeout: 8000 },
    )
  }

  async function handleTriage(event) {
    event.preventDefault()
    setTriageError('')
    setTriageState('loading')

    try {
      const result = await api.ai.triage(triageQuery.trim())
      setTriageResult(result)
      setTriageState('ready')

      const first = result?.specialties?.[0]
      if (first) {
        setQuery(first)
      }
    } catch (err) {
      setTriageResult(null)
      setTriageError(err.message || 'The assistant is unavailable right now.')
      setTriageState('error')
    }
  }

  function clearTriage() {
    setTriageResult(null)
    setTriageError('')
    setTriageState('idle')
    setTriageQuery('')
  }

  const triageDisabled = triageState === 'loading' || triageQuery.trim().length < 10

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Explore</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Hospitals near you
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mist">
          Search by city, area, or specialty — or tell Aurora what is going on and we will point
          you to the right kind of care.
        </p>
      </header>

        {user && !user.emailVerifiedAt ? (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4">
            <p className="text-sm text-body">
              Confirm your email address so sign-in codes and password resets always reach you.
            </p>
            <Link
              to="/verify-email"
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-700 transition duration-300 hover:-translate-y-0.5 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              Verify email
            </Link>
          </div>
        ) : null}

        <section className="mt-10 rounded-2xl border border-line bg-surface p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">Not sure where to start?</h2>
              <p className="mt-1 text-sm leading-relaxed text-body">
                Describe what is going on in your own words and Aurora will suggest the right
                kind of department.
              </p>
            </div>
          </div>

          <form onSubmit={handleTriage} className="mt-5">
            <label htmlFor="triage" className="text-sm font-semibold text-ink">
              What do you need help with?
            </label>
            <textarea
              id="triage"
              rows={3}
              maxLength={500}
              value={triageQuery}
              onChange={(event) => setTriageQuery(event.target.value)}
              placeholder="e.g. My son has had a fever and a rash for two days"
              className="mt-2 w-full rounded-lg border border-line bg-white p-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-mist">{triageQuery.trim().length}/500</span>
              <button
                type="submit"
                disabled={triageDisabled}
                className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:translate-y-0 disabled:opacity-50"
              >
                <Sparkles size={14} />
                {triageState === 'loading' ? 'Thinking…' : 'Find the right care'}
              </button>
            </div>
          </form>

          {triageError ? (
            <p className="mt-4 text-sm font-medium text-danger">{triageError}</p>
          ) : null}

          {triageState === 'ready' && triageResult ? (
            <div className="mt-5 rounded-xl border border-brand-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                    URGENCY_STYLES[triageResult.urgency] ?? URGENCY_STYLES.routine
                  }`}
                >
                  {URGENCY_LABELS[triageResult.urgency] ?? URGENCY_LABELS.routine}
                </span>
                {triageResult.summary ? (
                  <p className="text-sm font-medium text-ink">{triageResult.summary}</p>
                ) : null}
              </div>

              {triageResult.specialties?.length ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-mist">
                    Suggested specialties
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {triageResult.specialties.map((specialty) => (
                      <button
                        key={specialty}
                        type="button"
                        onClick={() => setQuery(specialty)}
                        className="rounded-full border border-line px-3 py-1 text-xs font-medium text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                      >
                        {specialty}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {triageResult.advice ? (
                <p className="mt-4 text-sm leading-relaxed text-body">{triageResult.advice}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-xs leading-relaxed text-mist">
                  {triageResult.disclaimer}
                </p>
                <button
                  type="button"
                  onClick={clearTriage}
                  className="text-xs font-semibold text-mist transition-colors hover:text-ink"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “Abbottabad” or “Cardiology”"
            className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 sm:max-w-sm"
          />
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <MapPin size={16} />
            {locating ? 'Locating…' : coords ? 'Location on' : 'Use my location'}
          </button>
        </div>

        {locationNote ? <p className="mt-3 text-sm text-mist">{locationNote}</p> : null}
        {coords ? (
          <p className="mt-3 text-sm font-medium text-brand-700">
            Sorted by distance from your location.
          </p>
        ) : null}

        {state === 'loading' ? (
          <p className="mt-12 text-sm text-mist">Loading hospitals…</p>
        ) : null}
        {state === 'error' ? (
          <p className="mt-12 text-sm text-danger">
            Couldn't load hospitals right now. Please try again in a moment.
          </p>
        ) : null}
        {state === 'ready' && visible.length === 0 ? (
          <p className="mt-12 text-sm text-mist">
            {query.trim()
              ? `No hospitals match “${query}”. Try a different city or specialty.`
              : 'No hospitals are listed yet — check back soon.'}
          </p>
        ) : null}

        {state === 'ready' && visible.length > 0 ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((hospital) => (
              <HospitalCard key={hospital.id ?? hospital._id} hospital={hospital} />
            ))}
          </div>
        ) : null}
    </div>
  )
}
