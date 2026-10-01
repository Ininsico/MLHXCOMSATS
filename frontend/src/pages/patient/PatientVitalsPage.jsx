import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Loader2, Plus, Trash2 } from 'lucide-react'
import SelectField from '../../components/SelectField'
import LineChart from '../../components/charts/LineChart'
import { api } from '../../lib/api'

const TYPES = [
  { value: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg', secondary: 'Diastolic', series: 'Systolic' },
  { value: 'weight', label: 'Weight', unit: 'kg' },
  { value: 'glucose', label: 'Blood glucose', unit: 'mg/dL' },
  { value: 'temperature', label: 'Temperature', unit: '°C' },
  { value: 'phq9', label: 'PHQ-9 score', unit: '' },
  { value: 'gad7', label: 'GAD-7 score', unit: '' },
]

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'
const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50'

export default function PatientVitalsPage() {
  const [entries, setEntries] = useState([])
  const [type, setType] = useState('blood_pressure')
  const [value, setValue] = useState('')
  const [secondary, setSecondary] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const config = useMemo(() => TYPES.find((entry) => entry.value === type) ?? TYPES[0], [type])

  const load = useCallback(async (nextType) => {
    try {
      const data = await api.patients.vitals(nextType)
      setEntries(data ?? [])
      setState('ready')
    } catch (err) {
      setError(err.message || 'Could not load your readings.')
      setState('error')
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    api.patients
      .vitals(type)
      .then((data) => {
        if (!cancelled) {
          setEntries(data ?? [])
          setState('ready')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not load your readings.')
          setState('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [type])

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      await api.patients.addVitals({
        type,
        value: Number(value),
        secondary: secondary === '' ? undefined : Number(secondary),
        unit: config.unit,
        note,
      })

      setValue('')
      setSecondary('')
      setNote('')
      await load(type)
    } catch (err) {
      setError(err.message || 'Could not save that reading.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    try {
      await api.patients.deleteVitals(id)
      setEntries((current) => current.filter((entry) => (entry.id ?? entry._id) !== id))
    } catch (err) {
      setError(err.message || 'Could not remove that reading.')
    }
  }

  const trend = [...entries]
    .reverse()
    .map((entry) => ({
      label: new Date(entry.at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      value: entry.value,
    }))

  const latest = entries[0]

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Your record</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
          <Activity size={25} className="text-brand-700" />
          Vitals & scores
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Log readings at home and watch the trend. Doctors see these on your record, and therapy
          scores (PHQ-9, GAD-7) stay private to you and your clinician.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Add a reading</h2>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <SelectField
              id="vitals-type"
              label="What are you logging?"
              value={type}
              onChange={(event) => setType(event.target.value)}
              options={TYPES.map((entry) => ({ value: entry.value, label: entry.label }))}
            />

            <div>
              <label htmlFor="vitals-value" className="text-sm font-semibold text-ink">
                {config.secondary ? `${config.series} (${config.unit})` : `Value ${config.unit ? `(${config.unit})` : ''}`}
              </label>
              <input
                id="vitals-value"
                type="number"
                step="any"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={type === 'blood_pressure' ? '128' : '0'}
                className={`${FIELD_CLASS} mt-1.5`}
              />
            </div>

            {config.secondary ? (
              <div>
                <label htmlFor="vitals-secondary" className="text-sm font-semibold text-ink">
                  {config.secondary} ({config.unit})
                </label>
                <input
                  id="vitals-secondary"
                  type="number"
                  step="any"
                  value={secondary}
                  onChange={(event) => setSecondary(event.target.value)}
                  placeholder="84"
                  className={`${FIELD_CLASS} mt-1.5`}
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="vitals-note" className="text-sm font-semibold text-ink">
                Note (optional)
              </label>
              <input
                id="vitals-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="After a walk, before breakfast…"
                className={`${FIELD_CLASS} mt-1.5`}
              />
            </div>

            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

            <button type="submit" disabled={busy || value === ''} className={`${SUBMIT_CLASS} w-full`}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Save reading
            </button>
          </form>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">{config.label} trend</h2>
              {latest ? (
                <span className="text-sm font-semibold text-ink">
                  latest {latest.value}
                  {config.secondary ? `/${latest.secondary ?? '—'}` : ''} {config.unit}
                  <span className="ml-2 font-normal text-mist">
                    {new Date(latest.at).toLocaleDateString()}
                  </span>
                </span>
              ) : null}
            </div>

            <div className="mt-4">
              <LineChart
                data={trend}
                label={`${config.label} over time`}
                suffix={config.unit ? ` ${config.unit}` : ''}
                height={240}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">History</h2>

            {state === 'loading' ? (
              <p className="mt-4 text-sm text-mist">Loading readings…</p>
            ) : entries.length ? (
              <ul className="mt-4 divide-y divide-line">
                {entries.slice(0, 12).map((entry) => (
                  <li key={entry.id ?? entry._id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {entry.value}
                        {entry.secondary ? `/${entry.secondary}` : ''} {entry.unit}
                      </p>
                      <p className="mt-0.5 text-xs text-mist">
                        {new Date(entry.at).toLocaleString()}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(entry.id ?? entry._id)}
                      aria-label="Delete this reading"
                      className="rounded p-2 text-mist transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-surface px-4 py-8 text-center text-sm text-mist">
                Nothing logged for this type yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
