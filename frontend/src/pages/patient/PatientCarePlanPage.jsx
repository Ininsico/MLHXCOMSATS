import { useCallback, useEffect, useState } from 'react'
import { HeartPulse, Loader2, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import SelectField from '../../components/SelectField'
import LineChart from '../../components/charts/LineChart'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'
const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'
const GHOST_CLASS =
  'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line px-4 text-xs font-bold uppercase tracking-widest text-body transition-colors hover:border-brand-300 hover:text-ink disabled:opacity-60'

const VITAL_TYPES = [
  { value: 'blood_pressure', label: 'Blood pressure' },
  { value: 'weight', label: 'Weight' },
  { value: 'glucose', label: 'Glucose' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'phq9', label: 'PHQ-9' },
  { value: 'gad7', label: 'GAD-7' },
]

const CONDITIONS = [
  'Type 2 diabetes',
  'Hypertension',
  'Asthma',
  'Heart failure',
  'Chronic kidney disease',
  'Depression',
  'Anxiety',
  'Thyroid disorder',
  'Other',
]

const RELATIONS = [
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other', label: 'Other' },
]

export default function PatientCarePlanPage() {
  const [plans, setPlans] = useState([])
  const [dependents, setDependents] = useState([])
  const [trends, setTrends] = useState({})
  const [form, setForm] = useState({
    condition: 'Type 2 diabetes',
    goal: '',
    checkInFrequencyDays: 14,
    channel: 'whatsapp',
    targets: [{ label: 'Fasting glucose', vitalType: 'glucose', min: 70, max: 130, unit: 'mg/dL' }],
  })
  const [dependentForm, setDependentForm] = useState({ name: '', relation: 'child', dateOfBirth: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const [planData, dependentData] = await Promise.all([api.patients.carePlans(), api.patients.dependents()])
      setPlans(planData ?? [])
      setDependents(dependentData ?? [])

      const types = [...new Set((planData ?? []).flatMap((plan) => (plan.targets ?? []).map((t) => t.vitalType)))]

      for (const type of types) {
        const entries = await api.patients.vitals(type)
        setTrends((current) => ({
          ...current,
          [type]: [...(entries ?? [])]
            .reverse()
            .map((entry) => ({
              label: new Date(entry.at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
              value: entry.value,
            })),
        }))
      }
    } catch (err) {
      setError(err.message || 'Could not load your care plans.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([api.patients.carePlans(), api.patients.dependents()])
      .then(([planData, dependentData]) => {
        if (cancelled) return
        setPlans(planData ?? [])
        setDependents(dependentData ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load your care plans.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function run(label, action) {
    setBusy(label)
    setError('')
    setNotice('')

    try {
      await action()
      await load()
    } catch (err) {
      setError(err.message || `${label} failed.`)
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Long-term care</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
          <HeartPulse size={26} className="text-brand-700" />
          Care plans
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Set the targets you are working to, and Aurora checks in on WhatsApp on a schedule —
          readings you log here show whether you are inside them.
        </p>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {plans.map((plan) => (
            <section key={plan.id ?? plan._id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{plan.condition}</h2>
                  <p className="mt-0.5 text-xs text-mist">
                    check-in every {plan.checkInFrequencyDays} days via {plan.channel}
                    {plan.nextCheckInAt ? ` · next ${new Date(plan.nextCheckInAt).toLocaleDateString()}` : ''}
                    {plan.checkInsSent ? ` · ${plan.checkInsSent} sent` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                      plan.status === 'active' ? 'bg-brand-50 text-brand-700' : 'bg-surface text-mist'
                    }`}
                  >
                    {plan.status}
                  </span>
                  {plan.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => run('pause', () => api.patients.updateCarePlan(plan.id ?? plan._id, { status: 'paused' }))}
                      className={GHOST_CLASS}
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => run('resume', () => api.patients.updateCarePlan(plan.id ?? plan._id, { status: 'active' }))}
                      className={GHOST_CLASS}
                    >
                      Resume
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => run('delete', () => api.patients.deleteCarePlan(plan.id ?? plan._id))}
                    aria-label="Delete this care plan"
                    className="rounded p-2 text-mist transition-colors hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {plan.goal ? <p className="mt-3 text-sm text-body">{plan.goal}</p> : null}

              <ul className="mt-4 space-y-2">
                {(plan.targetsWithProgress ?? plan.targets ?? []).map((target, index) => (
                  <li key={`${target.label}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-ink">{target.label}</p>
                      <p className="text-xs text-mist">
                        target {target.min !== null && target.min !== undefined ? `≥ ${target.min}` : ''}
                        {target.min !== null && target.max !== null ? ' and ' : ''}
                        {target.max !== null && target.max !== undefined ? `≤ ${target.max}` : ''} {target.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">
                        {target.latest ? `${target.latest.value}${target.latest.secondary ? `/${target.latest.secondary}` : ''}` : '—'}
                      </p>
                      <p
                        className={`text-[11px] font-bold uppercase tracking-wide ${
                          target.state === 'in-range' ? 'text-brand-700' : target.state === 'out-of-range' ? 'text-danger' : 'text-mist'
                        }`}
                      >
                        {target.state === 'in-range' ? 'in range' : target.state === 'out-of-range' ? 'out of range' : 'no readings'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {(plan.targets ?? []).map((target) =>
                (trends[target.vitalType] ?? []).length > 1 ? (
                  <div key={`chart-${target.vitalType}`} className="mt-4 rounded-xl border border-line p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-mist">
                      {target.label} trend
                    </p>
                    <LineChart data={trends[target.vitalType]} label={`${target.label} trend`} height={180} />
                  </div>
                ) : null,
              )}
            </section>
          ))}

          {!plans.length ? (
            <p className="rounded-2xl border border-line bg-white px-6 py-10 text-center text-sm text-mist shadow-soft">
              No care plans yet — add one on the right and Aurora starts checking in.
            </p>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">New care plan</h2>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                run('plan', async () => {
                  await api.patients.createCarePlan(form)
                  setForm({ ...form, goal: '' })
                  setNotice('Care plan created — check-ins are scheduled.')
                })
              }}
              className="mt-4 space-y-3"
            >
              <SelectField
                id="condition"
                label="Condition"
                value={form.condition}
                onChange={(event) => setForm({ ...form, condition: event.target.value })}
                options={CONDITIONS.map((value) => ({ value, label: value }))}
              />

              <input
                value={form.goal}
                onChange={(event) => setForm({ ...form, goal: event.target.value })}
                placeholder="What are you aiming for?"
                aria-label="Goal"
                className={FIELD_CLASS}
              />

              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  id="frequency"
                  label="Check-in every"
                  size="sm"
                  value={String(form.checkInFrequencyDays)}
                  onChange={(event) => setForm({ ...form, checkInFrequencyDays: Number(event.target.value) })}
                  options={[7, 14, 30].map((days) => ({ value: String(days), label: `${days} days` }))}
                />
                <SelectField
                  id="channel"
                  label="Channel"
                  size="sm"
                  value={form.channel}
                  onChange={(event) => setForm({ ...form, channel: event.target.value })}
                  options={[
                    { value: 'whatsapp', label: 'WhatsApp' },
                    { value: 'email', label: 'Email' },
                    { value: 'none', label: 'In-app only' },
                  ]}
                />
              </div>

              <div className="rounded-xl bg-surface p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-mist">Target</p>
                <SelectField
                  id="target-type"
                  size="sm"
                  className="mt-2"
                  value={form.targets[0].vitalType}
                  onChange={(event) =>
                    setForm({ ...form, targets: [{ ...form.targets[0], vitalType: event.target.value }] })
                  }
                  options={VITAL_TYPES}
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    value={form.targets[0].min ?? ''}
                    onChange={(event) => setForm({ ...form, targets: [{ ...form.targets[0], min: Number(event.target.value) }] })}
                    placeholder="min"
                    inputMode="numeric"
                    aria-label="Target minimum"
                    className={FIELD_CLASS}
                  />
                  <input
                    value={form.targets[0].max ?? ''}
                    onChange={(event) => setForm({ ...form, targets: [{ ...form.targets[0], max: Number(event.target.value) }] })}
                    placeholder="max"
                    inputMode="numeric"
                    aria-label="Target maximum"
                    className={FIELD_CLASS}
                  />
                </div>
              </div>

              <button type="submit" disabled={busy === 'plan'} className={`${SUBMIT_CLASS} w-full`}>
                {busy === 'plan' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Create care plan
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Users size={18} className="text-brand-700" />
              Family
            </h2>
            <p className="mt-1 text-xs text-mist">
              People you look after. Access is explicit and can be revoked at any time.
            </p>

            <ul className="mt-4 space-y-2">
              {dependents.map((person) => (
                <li key={person.id ?? person._id} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{person.name}</p>
                    <p className="text-xs text-mist">
                      {person.relation}
                      {person.dateOfBirth ? ` · born ${person.dateOfBirth}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => run('dependent', () => api.patients.removeDependent(person.id ?? person._id))}
                    aria-label={`Revoke access for ${person.name}`}
                    className="rounded p-2 text-mist transition-colors hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
              {!dependents.length ? <li className="text-xs text-mist">Nobody added yet.</li> : null}
            </ul>

            <div className="mt-4 space-y-2">
              <input
                value={dependentForm.name}
                onChange={(event) => setDependentForm({ ...dependentForm, name: event.target.value })}
                placeholder="Name"
                aria-label="Dependent name"
                className={FIELD_CLASS}
              />
              <div className="grid grid-cols-2 gap-2">
                <SelectField
                  id="relation"
                  size="sm"
                  value={dependentForm.relation}
                  onChange={(event) => setDependentForm({ ...dependentForm, relation: event.target.value })}
                  options={RELATIONS}
                />
                <input
                  type="date"
                  value={dependentForm.dateOfBirth}
                  onChange={(event) => setDependentForm({ ...dependentForm, dateOfBirth: event.target.value })}
                  aria-label="Date of birth"
                  className={FIELD_CLASS}
                />
              </div>
              <button
                type="button"
                disabled={!dependentForm.name.trim() || busy === 'dependent'}
                onClick={() =>
                  run('dependent', async () => {
                    await api.patients.addDependent(dependentForm)
                    setDependentForm({ name: '', relation: 'child', dateOfBirth: '' })
                    setNotice('Added — their record is now linked to yours.')
                  })
                }
                className={`${SUBMIT_CLASS} w-full`}
              >
                {busy === 'dependent' ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                Add a family member
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
