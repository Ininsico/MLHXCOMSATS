import { useCallback, useEffect, useState } from 'react'
import { Ambulance, Loader2, MapPin, Navigation, PhoneCall, Radio, ShieldAlert, Siren } from 'lucide-react'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const LADDER = ['raised', 'acknowledged', 'dispatched', 'en_route', 'on_scene', 'transporting', 'arrived', 'completed']
const LADDER_LABELS = {
  raised: 'Request sent',
  acknowledged: 'Hospital saw it',
  dispatched: 'Ambulance assigned',
  en_route: 'On the way',
  on_scene: 'At the pickup point',
  transporting: 'Transporting',
  arrived: 'Arrived at hospital',
  completed: 'Completed',
}

function useGeolocation() {
  const [point, setPoint] = useState(null)

  const locate = useCallback(
    () =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null)
          return
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const next = { lat: position.coords.latitude, lng: position.coords.longitude }
            setPoint(next)
            resolve(next)
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000 },
        )
      }),
    [],
  )

  return { point, locate }
}

function TrailPlot({ trail = [] }) {
  if (trail.length < 2) {
    return <p className="rounded-xl bg-surface px-4 py-6 text-center text-xs text-mist">Waiting for the first position…</p>
  }

  const lats = trail.map((point) => point.lat)
  const lngs = trail.map((point) => point.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const spanLat = maxLat - minLat || 0.0005
  const spanLng = maxLng - minLng || 0.0005

  const points = trail.map((point) => ({
    x: 10 + ((point.lng - minLng) / spanLng) * 280,
    y: 130 - ((point.lat - minLat) / spanLat) * 110,
    by: point.by,
  }))

  const path = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox="0 0 300 150" className="w-full" role="img" aria-label="Route travelled so far">
      <polyline points={path} fill="none" stroke="var(--color-brand-600)" strokeWidth="2" strokeLinejoin="round" />
      {points.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}-${index}`}
          cx={point.x}
          cy={point.y}
          r={index === 0 ? 4 : 3}
          fill={point.by === 'ambulance' ? 'var(--color-danger)' : 'var(--color-brand-700)'}
        />
      ))}
    </svg>
  )
}

export default function PatientEmergencyPage() {
  const { locate } = useGeolocation()
  const [requests, setRequests] = useState([])
  const [active, setActive] = useState(null)
  const [live, setLive] = useState(null)
  const [form, setForm] = useState({ label: '', reason: '', relativeName: '', relativePhone: '', patientPhone: '' })
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api.emergency.mine()
      setRequests(data ?? [])
      const open = (data ?? []).find((entry) => !['completed', 'cancelled'].includes(entry.status))
      setActive(open ?? null)
      setState('ready')
      return open ?? null
    } catch (err) {
      setError(err.message || 'Could not load your emergency requests.')
      setState('error')
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    api.emergency
      .mine()
      .then((data) => {
        if (cancelled) return
        setRequests(data ?? [])
        setActive((data ?? []).find((entry) => !['completed', 'cancelled'].includes(entry.status)) ?? null)
        setState('ready')
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not load your emergency requests.')
          setState('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!active) return undefined

    let cancelled = false

    const tick = () =>
      api.emergency
        .track(active.id ?? active._id)
        .then((data) => {
          if (!cancelled) setLive(data.live)
        })
        .catch(() => {})

    tick()
    const timer = setInterval(tick, 5000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [active])

  async function raise(kind) {
    setBusy(kind)
    setError('')
    setNotice('')

    try {
      const point = await locate()

      const payload = {
        label: form.label,
        reason: form.reason,
        patientPhone: form.patientPhone,
        lat: point?.lat,
        lng: point?.lng,
      }

      const data =
        kind === 'sos'
          ? await api.emergency.sos(payload)
          : await api.emergency.requestAmbulance({
              ...payload,
              relativeName: form.relativeName,
              relativePhone: form.relativePhone,
            })

      setNotice(
        `${kind === 'sos' ? 'SOS sent' : 'Ambulance requested'} — ${data.hospital?.name} has been alerted${
          data.request?.severity === 'critical' ? ' (flagged critical)' : ''
        }.${data.notified?.length ? ` ${data.notified.length} contact(s) notified.` : ''}`,
      )

      await load()
    } catch (err) {
      setError(err.message || 'That request could not be sent.')
    } finally {
      setBusy('')
    }
  }

  async function cancel() {
    if (!active) return

    setBusy('cancel')

    try {
      await api.emergency.cancel(active.id ?? active._id, 'Cancelled by the patient')
      setNotice('Request cancelled.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not cancel.')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-danger">Emergency</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
          <Siren size={26} className="text-danger" />
          SOS &amp; ambulance
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          One tap alerts the nearest hospital with your location and tells your emergency contact.
          Your family can follow the ambulance live from this screen.
        </p>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

      {active ? (
        <section className="mt-8 rounded-2xl border border-danger/40 bg-danger/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Radio size={18} className="text-danger" />
              Live — {active.kind === 'sos' ? 'SOS' : 'ambulance request'}
            </h2>
            <StatusChip status={active.status} label={LADDER_LABELS[active.status] ?? active.status} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <ol className="space-y-2">
                {LADDER.map((step) => {
                  const reached = live?.ladder?.find((entry) => entry.step === step)?.reached ?? false

                  return (
                    <li key={step} className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          reached ? 'bg-brand-600' : 'bg-line'
                        }`}
                      />
                      <span className={`text-sm ${reached ? 'font-semibold text-ink' : 'text-mist'}`}>
                        {LADDER_LABELS[step]}
                      </span>
                    </li>
                  )
                })}
              </ol>

              <div className="mt-5 flex flex-wrap gap-6 rounded-xl border border-line bg-white px-4 py-3">
                <span className="text-sm">
                  <span className="block text-xs uppercase tracking-wide text-mist">ETA</span>
                  <span className="font-semibold text-ink">{live?.etaMinutes ?? '—'} min</span>
                </span>
                <span className="text-sm">
                  <span className="block text-xs uppercase tracking-wide text-mist">Distance</span>
                  <span className="font-semibold text-ink">{live?.distanceKm ?? '—'} km</span>
                </span>
                <span className="text-sm">
                  <span className="block text-xs uppercase tracking-wide text-mist">Ambulance</span>
                  <span className="font-semibold text-ink">{live?.ambulance?.callSign ?? 'not assigned'}</span>
                </span>
              </div>

              {live?.ambulance?.driverName ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-body">
                  <PhoneCall size={14} className="text-brand-700" />
                  {live.ambulance.driverName}
                  {live.ambulance.driverPhone ? ` · ${live.ambulance.driverPhone}` : ''}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-line bg-white p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mist">
                <Navigation size={13} />
                Route so far
              </p>
              <TrailPlot trail={live?.trail ?? []} />
              <p className="mt-2 text-center text-[11px] text-mist">
                <span className="inline-block h-2 w-2 rounded-full bg-brand-700" /> you ·{' '}
                <span className="inline-block h-2 w-2 rounded-full bg-danger" /> ambulance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={cancel}
            disabled={busy === 'cancel'}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-line px-5 text-sm font-semibold text-body transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
          >
            {busy === 'cancel' ? <Loader2 size={14} className="animate-spin" /> : null}
            Cancel request
          </button>
        </section>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => raise('sos')}
            disabled={busy !== ''}
            className="flex w-full flex-col items-center gap-2 rounded-2xl bg-danger px-6 py-8 text-white shadow-lg shadow-danger/30 transition duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:opacity-70"
          >
            {busy === 'sos' ? <Loader2 size={30} className="animate-spin" /> : <ShieldAlert size={34} />}
            <span className="text-xl font-extrabold tracking-tight">SOS</span>
            <span className="text-xs font-semibold uppercase tracking-widest">
              Alert the nearest hospital now
            </span>
          </button>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Ambulance size={18} className="text-brand-700" />
              Request an ambulance
            </h2>
            <p className="mt-1 text-xs text-mist">
              For yourself or a relative — the hospital needs to know where to come.
            </p>

            <div className="mt-4 space-y-3">
              <input
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
                placeholder="Pickup point (house, street, landmark)"
                className={FIELD_CLASS}
                aria-label="Pickup point"
              />
              <input
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                placeholder="What is happening? (e.g. chest pain, cannot breathe)"
                className={FIELD_CLASS}
                aria-label="Reason"
              />
              <input
                value={form.patientPhone}
                onChange={(event) => setForm({ ...form, patientPhone: event.target.value })}
                placeholder="Phone number to call back"
                className={FIELD_CLASS}
                aria-label="Patient phone"
              />
              <input
                value={form.relativeName}
                onChange={(event) => setForm({ ...form, relativeName: event.target.value })}
                placeholder="Relative raising this (optional)"
                className={FIELD_CLASS}
                aria-label="Relative name"
              />
              <input
                value={form.relativePhone}
                onChange={(event) => setForm({ ...form, relativePhone: event.target.value })}
                placeholder="Relative's phone (gets updates)"
                className={FIELD_CLASS}
                aria-label="Relative phone"
              />

              <button
                type="button"
                onClick={() => raise('ambulance')}
                disabled={busy !== ''}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {busy === 'ambulance' ? <Loader2 size={15} className="animate-spin" /> : <Ambulance size={15} />}
                Send ambulance request
              </button>

              <p className="text-[11px] leading-relaxed text-mist">
                Your device location is attached when the browser allows it — otherwise the pickup
                text is what the crew gets.
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Your emergency history</h2>

          {state === 'loading' ? (
            <p className="mt-4 text-sm text-mist">Loading…</p>
          ) : requests.length ? (
            <ul className="mt-4 divide-y divide-line">
              {requests.map((entry) => (
                <li key={entry.id ?? entry._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {entry.kind === 'sos' ? 'SOS' : 'Ambulance'} · {entry.hospital?.name ?? 'Hospital'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-mist">
                      {new Date(entry.createdAt).toLocaleString()}
                      {entry.pickup?.label ? ` · ${entry.pickup.label}` : ''}
                      {entry.reason ? ` · ${entry.reason}` : ''}
                    </p>
                  </div>
                  <StatusChip status={entry.status} label={LADDER_LABELS[entry.status] ?? entry.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-surface px-4 py-8 text-center text-sm text-mist">
              Nothing raised yet. The SOS button is always here.
            </p>
          )}

          <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-xs leading-relaxed text-body">
            <MapPin size={13} className="mt-0.5 shrink-0 text-brand-700" />
            In a life-threatening situation, call your local emergency number as well — Aurora
            alerts the hospital, but the phone line is faster.
          </p>
        </section>
      </section>
    </>
  )
}
