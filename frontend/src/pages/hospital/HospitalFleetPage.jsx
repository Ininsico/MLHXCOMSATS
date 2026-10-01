import { useCallback, useEffect, useState } from 'react'
import { Ambulance, Loader2, Plus, Radio, Send, Siren } from 'lucide-react'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'
const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'on_scene', label: 'On scene' },
  { value: 'returning', label: 'Returning' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'offline', label: 'Offline' },
]

const LADDER_ACTIONS = [
  { action: 'on_scene', label: 'On scene' },
  { action: 'transporting', label: 'Transporting' },
  { action: 'arrived', label: 'Arrived' },
  { action: 'completed', label: 'Complete' },
]

export default function HospitalFleetPage() {
  const [fleet, setFleet] = useState([])
  const [requests, setRequests] = useState([])
  const [ambulance, setAmbulance] = useState({ callSign: '', vehicleNumber: '', kind: 'basic', driverName: '', driverPhone: '' })
  const [position, setPosition] = useState({ lat: '', lng: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const [fleetData, requestData] = await Promise.all([
        api.emergency.ambulances(),
        api.emergency.requests('open=true'),
      ])
      setFleet(fleetData ?? [])
      setRequests(requestData ?? [])
    } catch (err) {
      setError(err.message || 'Could not load the fleet.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([api.emergency.ambulances(), api.emergency.requests('open=true')])
      .then(([fleetData, requestData]) => {
        if (cancelled) return
        setFleet(fleetData ?? [])
        setRequests(requestData ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the fleet.')
      })

    const timer = setInterval(load, 10000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [load])

  async function act(requestId, body, label) {
    setBusy(`${requestId}-${label}`)
    setError('')
    setNotice('')

    try {
      await api.emergency.act(requestId, body)
      setNotice(`${label} recorded.`)
      await load()
    } catch (err) {
      setError(err.message || `${label} failed.`)
    } finally {
      setBusy('')
    }
  }

  async function registerAmbulance(event) {
    event.preventDefault()
    setBusy('fleet')

    try {
      await api.emergency.addAmbulance(ambulance)
      setAmbulance({ callSign: '', vehicleNumber: '', kind: 'basic', driverName: '', driverPhone: '' })
      setNotice('Ambulance registered.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not register that ambulance.')
    } finally {
      setBusy('')
    }
  }

  async function sendPosition(unit, request) {
    setBusy(`${unit.id ?? unit._id}-position`)

    try {
      const lat = Number(position.lat) || null
      const lng = Number(position.lng) || null

      if (request && lat && lng) {
        await api.emergency.ambulanceLocation(request.id ?? request._id, { lat, lng })
        setNotice('Position sent — the family sees the ambulance move.')
      } else {
        await api.emergency.updateAmbulance(unit.id ?? unit._id, { lat, lng, status: unit.status })
        setNotice('Position updated.')
      }

      await load()
    } catch (err) {
      setError(err.message || 'Could not send the position.')
    } finally {
      setBusy('')
    }
  }

  /** Demo helper: nudge the unit toward the pickup so tracking visibly moves. */
  function nudge(unit, request) {
    const fromLat = Number(position.lat) || unit.location?.lat || request.pickup?.lat || 34.15
    const fromLng = Number(position.lng) || unit.location?.lng || request.pickup?.lng || 73.21
    const targetLat = request.pickup?.lat ?? fromLat
    const targetLng = request.pickup?.lng ?? fromLng

    setPosition({
      lat: (fromLat + (targetLat - fromLat) * 0.4).toFixed(5),
      lng: (fromLng + (targetLng - fromLng) * 0.4).toFixed(5),
    })
  }

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-danger">Emergency service</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
          <Ambulance size={26} className="text-brand-700" />
          Ambulance &amp; SOS
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Register your fleet, answer SOS calls, dispatch units and move them along the ladder —
          the patient and their family watch the same status you do.
        </p>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

      <section className="mt-8 rounded-2xl border border-danger/40 bg-danger/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Siren size={18} className="text-danger" />
            Incoming emergencies
          </h2>
          <span className="text-xs font-semibold uppercase tracking-wide text-mist">
            {requests.length} open
          </span>
        </div>

        {!requests.length ? (
          <p className="mt-4 rounded-xl bg-white px-4 py-6 text-center text-sm text-mist">
            Nothing open right now. SOS calls appear here the second a patient raises one.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {requests.map((request) => {
              const id = request.id ?? request._id
              const open = request.status === 'raised'
              const assigned = request.ambulance?.callSign ?? request.ambulanceCallSign

              return (
                <li key={id} className="rounded-xl border border-line bg-white px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {request.kind === 'sos' ? 'SOS' : 'Ambulance'} · {request.patientName}
                        {request.patientPhone ? ` · ${request.patientPhone}` : ''}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-body">
                        {request.pickup?.label || 'pickup point not given'}
                        {request.reason ? ` · ${request.reason}` : ''}
                        {request.concepts?.length ? ` · graph: ${request.concepts.join(', ')}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusChip status={request.severity} label={`severity: ${request.severity}`} />
                      <StatusChip status={request.status} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    {open ? (
                      <button
                        type="button"
                        onClick={() => act(id, { action: 'acknowledge' }, 'acknowledge')}
                        disabled={Boolean(busy)}
                        className={SUBMIT_CLASS}
                      >
                        {busy === `${id}-acknowledge` ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
                        Acknowledge
                      </button>
                    ) : null}

                    {!assigned ? (
                      <>
                        <SelectField
                          id={`unit-${id}`}
                          label="Dispatch unit"
                          size="sm"
                          className="w-full sm:w-52"
                          value={String(ambulance.callSign || '')}
                          onChange={(event) => setAmbulance({ ...ambulance, callSign: event.target.value })}
                          options={[
                            { value: '', label: 'Choose…' },
                            ...fleet.map((unit) => ({
                              value: unit.callSign,
                              label: `${unit.callSign} (${unit.status})`,
                              disabled: unit.status === 'dispatched',
                            })),
                          ]}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const unit = fleet.find((entry) => entry.callSign === ambulance.callSign)
                            if (!unit) {
                              setError('Pick an ambulance to dispatch.')
                              return
                            }
                            act(id, { action: 'dispatch', ambulanceId: unit.id ?? unit._id }, 'dispatch')
                          }}
                          disabled={Boolean(busy)}
                          className={SUBMIT_CLASS}
                        >
                          <Send size={14} />
                          Dispatch
                        </button>
                      </>
                    ) : null}

                    {assigned ? (
                      <>
                        <span className="text-xs font-semibold uppercase tracking-wide text-mist">
                          unit: {assigned}
                        </span>

                        {LADDER_ACTIONS.map((entry) => (
                          <button
                            key={entry.action}
                            type="button"
                            onClick={() => act(id, { action: entry.action, outcome: 'Handed over to the ward' }, entry.action)}
                            disabled={Boolean(busy)}
                            className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-xs font-bold uppercase tracking-widest text-body transition-colors hover:border-brand-300 hover:text-ink disabled:opacity-60"
                          >
                            {entry.label}
                          </button>
                        ))}

                        <input
                          value={position.lat}
                          onChange={(event) => setPosition({ ...position, lat: event.target.value })}
                          placeholder="lat"
                          aria-label="Latitude"
                          className={`${FIELD_CLASS} w-28`}
                        />
                        <input
                          value={position.lng}
                          onChange={(event) => setPosition({ ...position, lng: event.target.value })}
                          placeholder="lng"
                          aria-label="Longitude"
                          className={`${FIELD_CLASS} w-28`}
                        />
                        <button
                          type="button"
                          onClick={() => nudge(fleet.find((unit) => unit.callSign === assigned) ?? {}, request)}
                          className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-xs font-bold uppercase tracking-widest text-body transition-colors hover:border-brand-300 hover:text-ink"
                        >
                          Step toward pickup
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            sendPosition(fleet.find((unit) => unit.callSign === assigned) ?? {}, request)
                          }
                          disabled={Boolean(busy)}
                          className={SUBMIT_CLASS}
                        >
                          <Send size={14} />
                          Send position
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Your fleet</h2>

          <form onSubmit={registerAmbulance} className="mt-4 space-y-3">
            <input
              value={ambulance.callSign}
              onChange={(event) => setAmbulance({ ...ambulance, callSign: event.target.value })}
              placeholder="Call sign (e.g. AMB-01)"
              aria-label="Call sign"
              className={FIELD_CLASS}
            />
            <input
              value={ambulance.vehicleNumber}
              onChange={(event) => setAmbulance({ ...ambulance, vehicleNumber: event.target.value })}
              placeholder="Vehicle number"
              aria-label="Vehicle number"
              className={FIELD_CLASS}
            />
            <SelectField
              id="fleet-kind"
              label="Type"
              value={ambulance.kind}
              onChange={(event) => setAmbulance({ ...ambulance, kind: event.target.value })}
              options={[
                { value: 'basic', label: 'Basic life support' },
                { value: 'advanced', label: 'Advanced life support' },
                { value: 'neonatal', label: 'Neonatal' },
                { value: 'patient_transport', label: 'Patient transport' },
              ]}
            />
            <input
              value={ambulance.driverName}
              onChange={(event) => setAmbulance({ ...ambulance, driverName: event.target.value })}
              placeholder="Driver name"
              aria-label="Driver name"
              className={FIELD_CLASS}
            />
            <input
              value={ambulance.driverPhone}
              onChange={(event) => setAmbulance({ ...ambulance, driverPhone: event.target.value })}
              placeholder="Driver phone"
              aria-label="Driver phone"
              className={FIELD_CLASS}
            />
            <button type="submit" disabled={busy === 'fleet'} className={`${SUBMIT_CLASS} w-full`}>
              {busy === 'fleet' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Register ambulance
            </button>
          </form>

          <ul className="mt-5 divide-y divide-line">
            {fleet.map((unit) => (
              <li key={unit.id ?? unit._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {unit.callSign}
                    <span className="ml-2 font-normal text-mist">{unit.vehicleNumber}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-mist">
                    {unit.driverName || 'no driver'} · {unit.location?.lat ? `${unit.location.lat.toFixed(3)}, ${unit.location.lng.toFixed(3)}` : 'position unknown'}
                  </p>
                </div>
                <SelectField
                  id={`status-${unit.id ?? unit._id}`}
                  size="sm"
                  className="w-full sm:w-40"
                  value={unit.status}
                  onChange={(event) => api.emergency.updateAmbulance(unit.id ?? unit._id, { status: event.target.value }).then(load)}
                  options={STATUS_OPTIONS}
                />
              </li>
            ))}
            {!fleet.length ? (
              <li className="py-6 text-center text-sm text-mist">No ambulances registered yet.</li>
            ) : null}
          </ul>
        </section>

      </div>
    </>
  )
}
