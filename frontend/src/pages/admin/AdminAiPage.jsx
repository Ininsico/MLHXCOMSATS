import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

function Switch({ id, checked, onChange, label }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
        checked ? 'bg-brand-700' : 'bg-line'
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-5.5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function AdminAiPage() {
  const [data, setData] = useState(null)
  const [usage, setUsage] = useState(null)
  const [state, setState] = useState('loading')
  const [form, setForm] = useState(null)
  const [saveState, setSaveState] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    Promise.all([api.admin.aiSettings(), api.admin.aiUsage().catch(() => null)])
      .then(([settingsData, usageData]) => {
        if (cancelled) return
        setData(settingsData)
        setUsage(usageData)
        setForm({
          enabled: settingsData.settings.enabled,
          departments: settingsData.settings.departments ?? [],
          maxTokens: settingsData.settings.maxTokens,
          temperature: settingsData.settings.temperature,
          timeoutSeconds: settingsData.settings.timeoutSeconds,
        })
        setState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Could not load the AI settings.')
        setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave(event) {
    event.preventDefault()
    setSaveState('saving')
    setError('')

    try {
      const saved = await api.admin.updateAiSettings(form)
      setData((current) => ({ ...current, settings: saved.settings }))
      setSaveState('saved')
    } catch (err) {
      setError(err.message || 'The settings could not be saved.')
      setSaveState('error')
    }
  }

  function toggleDepartment(name) {
    setForm((current) => ({
      ...current,
      departments: current.departments.map((entry) =>
        entry.name === name ? { ...entry, enabled: !entry.enabled } : entry,
      ),
    }))
    setSaveState('idle')
  }

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading AI settings…</p>
  }

  if (state === 'error' || !form || !data) {
    return <p className="text-sm text-danger">{error || 'Could not load the AI settings.'}</p>
  }

  const available = data.available
  const health = data.health
  const feedbackConfirmed =
    usage?.feedback?.find((entry) => entry._id === 'confirmed')?.count ?? 0
  const feedbackOverridden =
    usage?.feedback?.find((entry) => entry._id === 'overridden')?.count ?? 0
  const images = usage?.byKind?.find((entry) => entry._id === 'image')?.count ?? 0
  const chats = usage?.byKind?.find((entry) => entry._id === 'chat')?.count ?? 0

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">AI assistant</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
            MedGemma runs on this machine and never leaves it. Control who can use it, how much it
            may write, and how long it may think.
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest ${
            available ? 'bg-brand-50 text-brand-800' : 'bg-danger-bg text-danger'
          }`}
        >
          {available ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
          {available ? 'Local model online' : 'Local model offline'}
        </span>
      </header>

      {health ? (
        <p className="mt-4 text-xs text-mist">
          {data.serviceUrl} · {health.backend} ·{' '}
          {health.nGpuLayers === 0 ? 'CPU inference' : `${health.nGpuLayers} layers on the GPU`} ·{' '}
          vision {health.mmprojOffloaded ? 'on GPU' : 'on CPU'} · {health.modelVersion}
        </p>
      ) : (
        <p className="mt-4 text-xs text-mist">
          The sidecar is not answering. Start it with{' '}
          <span className="font-semibold text-ink">uvicorn app.main:app</span> inside ai-service/.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">
            Scans analysed (30d)
          </p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{images}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">
            Text consultations
          </p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{chats}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">
            Avg latency
          </p>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            {usage?.avgLatencyMs ? `${(usage.avgLatencyMs / 1000).toFixed(1)}s` : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">
            Confirmed / overridden
          </p>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            {feedbackConfirmed}
            <span className="text-mist"> / </span>
            {feedbackOverridden}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-8 space-y-6">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Assistant master switch</h2>
              <p className="mt-1 text-sm text-mist">
                Off means no doctor can run an analysis, whatever their department.
              </p>
            </div>
            <Switch
              id="ai-enabled"
              label="Enable the AI assistant"
              checked={form.enabled}
              onChange={(value) => {
                setForm((current) => ({ ...current, enabled: value }))
                setSaveState('idle')
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Departments</h2>
          <p className="mt-1 text-sm text-mist">
            Departments are read from your staff records. Switch one off to keep the assistant out
            of that service.
          </p>

          {form.departments.length ? (
            <ul className="mt-5 divide-y divide-line">
              {form.departments.map((entry) => (
                <li key={entry.name} className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm font-medium text-ink">{entry.name}</span>
                  <Switch
                    id={`dept-${entry.name}`}
                    label={`AI for ${entry.name}`}
                    checked={entry.enabled}
                    onChange={() => toggleDepartment(entry.name)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl bg-surface px-4 py-6 text-sm text-mist">
              No departments yet — add staff with a department in the hospital dashboard.
            </p>
          )}
        </section>

        <section className="grid gap-5 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-3">
          <div>
            <label htmlFor="maxTokens" className="text-sm font-semibold text-ink">
              Max tokens
            </label>
            <input
              id="maxTokens"
              type="number"
              min={64}
              max={2048}
              value={form.maxTokens}
              onChange={(event) => {
                setForm((current) => ({ ...current, maxTokens: Number(event.target.value) }))
                setSaveState('idle')
              }}
              className={FIELD_CLASS}
            />
            <p className="mt-1.5 text-xs text-mist">64-2048 per answer.</p>
          </div>

          <div>
            <label htmlFor="temperature" className="text-sm font-semibold text-ink">
              Temperature
            </label>
            <input
              id="temperature"
              type="number"
              step="0.1"
              min={0}
              max={2}
              value={form.temperature}
              onChange={(event) => {
                setForm((current) => ({ ...current, temperature: Number(event.target.value) }))
                setSaveState('idle')
              }}
              className={FIELD_CLASS}
            />
            <p className="mt-1.5 text-xs text-mist">Lower is steadier — 0.2 suits clinical text.</p>
          </div>

          <div>
            <label htmlFor="timeoutSeconds" className="text-sm font-semibold text-ink">
              Timeout (seconds)
            </label>
            <input
              id="timeoutSeconds"
              type="number"
              min={30}
              max={600}
              value={form.timeoutSeconds}
              onChange={(event) => {
                setForm((current) => ({ ...current, timeoutSeconds: Number(event.target.value) }))
                setSaveState('idle')
              }}
              className={FIELD_CLASS}
            />
            <p className="mt-1.5 text-xs text-mist">A 4B vision model on CPU can need 2-3 minutes.</p>
          </div>
        </section>

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saveState === 'saving'} className={SUBMIT_CLASS}>
            {saveState === 'saving' ? <Loader2 size={15} className="animate-spin" /> : null}
            {saveState === 'saving' ? 'Saving…' : 'Save AI settings'}
          </button>
          {saveState === 'saved' ? (
            <span className="text-sm font-medium text-brand-700">Saved.</span>
          ) : null}
        </div>
      </form>
    </>
  )
}
