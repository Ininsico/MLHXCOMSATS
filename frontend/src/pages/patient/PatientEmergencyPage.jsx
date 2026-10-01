import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Ambulance,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  PhoneCall,
  Radio,
  ShieldAlert,
  Siren,
} from 'lucide-react'
import StatusChip from '../../components/StatusChip'
import { TextField } from '../../components/FormFields'
import { api } from '../../lib/api'

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
    return (
      <div className="flex h-[150px] w-full items-center justify-center rounded-lg bg-white px-4 text-center text-xs text-mist">
        Waiting for the first position…
      </div>
    )
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
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-widest text-danger uppercase">Emergency</p>
            <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-ink">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-danger-bg text-danger">
                <Siren size={18} />
              </span>
              SOS &amp; ambulance
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
              One tap alerts the nearest hospital with your location and tells your emergency contact.
              Your family can follow the ambulance live from this screen.
            </p>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold tracking-widest uppercase ${
              active ? 'border-danger/30 bg-danger-bg text-danger' : 'border-brand-200 bg-brand-50 text-brand-700'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${active ? 'animate-pulse bg-danger' : 'bg-brand-500'}`} />
            {active ? 'SOS active' : 'No active request'}
          </span>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
          {notice}
        </p>
      ) : null}

      {active ? (
        <section className="rounded-2xl border border-danger/30 bg-white p-5 shadow-soft md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <Radio size={18} className="text-danger" />
                Live — {active.kind === 'sos' ? 'SOS' : 'ambulance request'}
              </h2>
              <StatusChip status={active.status} label={LADDER_LABELS[active.status] ?? active.status} />
            </div>

            <button
              type="button"
              onClick={cancel}
              disabled={busy === 'cancel'}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-5 text-sm font-semibold text-body transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60 sm:w-auto"
            >
              {busy === 'cancel' ? <Loader2 size={14} className="animate-spin" /> : null}
              Cancel request
            </button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col">
              <ol className="relative space-y-3">
                <span aria-hidden="true" className="absolute top-2 bottom-2 left-[5px] w-px bg-line" />

                {LADDER.map((step) => {
                  const reached = live?.ladder?.find((entry) => entry.step === step)?.reached ?? false

                  return (
                    <li key={step} className="relative flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white ${
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

              <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-xl border border-line">
                <div className="min-w-0 px-3 py-3 sm:px-4">
                  <dt className="text-[11px] font-semibold tracking-wide text-mist uppercase">ETA</dt>
                  <dd className="mt-0.5 truncate text-sm font-semibold text-ink">
                    {live?.etaMinutes ?? '—'} min
                  </dd>
                </div>
                <div className="min-w-0 px-3 py-3 sm:px-4">
                  <dt className="text-[11px] font-semibold tracking-wide text-mist uppercase">Distance</dt>
                  <dd className="mt-0.5 truncate text-sm font-semibold text-ink">
                    {live?.distanceKm ?? '—'} km
                  </dd>
                </div>
                <div className="min-w-0 px-3 py-3 sm:px-4">
                  <dt className="text-[11px] font-semibold tracking-wide text-mist uppercase">Ambulance</dt>
                  <dd className="mt-0.5 truncate text-sm font-semibold text-ink">
                    {live?.ambulance?.callSign ?? 'not assigned'}
                  </dd>
                </div>
              </dl>

              {live?.ambulance?.driverName ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-body">
                  <PhoneCall size={14} className="shrink-0 text-brand-700" />
                  <span className="truncate">
                    {live.ambulance.driverName}
                    {live.ambulance.driverPhone ? ` · ${live.ambulance.driverPhone}` : ''}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-col rounded-xl border border-line bg-surface p-4">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-mist uppercase">
                <Navigation size={13} />
                Route so far
              </p>

              <div className="mt-3 flex flex-1 items-center">
                <TrailPlot trail={live?.trail ?? []} />
              </div>

              <p className="mt-3 flex items-center justify-center gap-4 text-[11px] text-mist">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-700" /> you
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-danger" /> ambulance
                </span>
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => raise('sos')}
            disabled={busy !== ''}
            className="btn-shine flex w-full items-center justify-center gap-3 rounded-2xl bg-danger px-6 py-5 text-white shadow-lg shadow-danger/25 transition duration-300 hover:-translate-y-0.5 hover:bg-danger/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:translate-y-0 disabled:opacity-60"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
              {busy === 'sos' ? <Loader2 size={22} className="animate-spin" /> : <ShieldAlert size={22} />}
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-xl font-extrabold tracking-tight">SOS</span>
              <span className="text-[11px] font-semibold tracking-widest uppercase">
                Alert the nearest hospital now
              </span>
            </span>
          </button>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft md:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Ambulance size={18} className="text-brand-700" />
              Request an ambulance
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-mist">
              For yourself or a relative — the hospital needs to know where to come.
            </p>

            <div className="mt-5 space-y-4">
              <TextField
                id="emergency-pickup"
                label="Pickup point"
                placeholder="House, street, landmark"
                hint="The clearer this is, the faster the crew finds you."
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
              />

              <TextField
                id="emergency-reason"
                label="What is happening?"
                placeholder="e.g. chest pain, cannot breathe"
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />

              <TextField
                id="emergency-phone"
                label="Phone number to call back"
                placeholder="0300 0000000"
                value={form.patientPhone}
                onChange={(event) => setForm({ ...form, patientPhone: event.target.value })}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="emergency-relative-name"
                  label="Relative raising this"
                  placeholder="Optional"
                  value={form.relativeName}
                  onChange={(event) => setForm({ ...form, relativeName: event.target.value })}
                />

                <TextField
                  id="emergency-relative-phone"
                  label="Relative's phone"
                  placeholder="Gets the updates"
                  value={form.relativePhone}
                  onChange={(event) => setForm({ ...form, relativePhone: event.target.value })}
                />
              </div>

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

        <section className="h-fit rounded-2xl border border-line bg-white p-5 shadow-soft md:p-6">
          <h2 className="text-lg font-semibold text-ink">Your emergency history</h2>

          {state === 'loading' ? (
            <p className="mt-4 text-sm text-mist">Loading…</p>
          ) : requests.length ? (
            <ul className="mt-2 divide-y divide-line">
              {requests.map((entry) => (
                <li key={entry.id ?? entry._id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-ink">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-brand-700">
                        {entry.kind === 'sos' ? <Siren size={14} /> : <Ambulance size={14} />}
                      </span>
                      <span className="truncate">{entry.hospital?.name ?? 'Hospital'}</span>
                    </p>
                    <StatusChip status={entry.status} label={LADDER_LABELS[entry.status] ?? entry.status} />
                  </div>

                  <dl className="mt-2 space-y-1 pl-[38px] text-xs text-mist">
                    <div className="flex items-start gap-2">
                      <Clock size={13} className="mt-px shrink-0 text-brand-700" />
                      <span>
                        {entry.kind === 'sos' ? 'SOS' : 'Ambulance'} ·{' '}
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="mt-px shrink-0 text-brand-700" />
                      <span>{entry.pickup?.label || 'No pickup note'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Activity size={13} className="mt-px shrink-0 text-brand-700" />
                      <span>{entry.reason || 'No reason given'}</span>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-surface px-4 py-6 text-center text-sm text-mist">
              Nothing raised yet. The SOS button is always here.
            </p>
          )}

          <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-body">
            <ShieldAlert size={14} className="mt-0.5 shrink-0 text-brand-700" />
            <span>
              In a life-threatening situation, call your local emergency number as well — Aurora
              alerts the hospital, but the phone line is faster.
            </span>
          </p>
        </section>
      </div>
    </div>
  )
}
