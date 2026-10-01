import { useEffect, useState } from 'react'
import { HeartPulse, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'
const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'
const SEVERITIES = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
]

export default function PatientMedicalCardPage() {
  const [profile, setProfile] = useState({
    bloodGroup: '',
    allergies: [],
    medications: [],
    conditions: [],
    emergencyContact: { name: '', phone: '' },
    notes: '',
  })
  const [allergy, setAllergy] = useState({ substance: '', reaction: '', severity: 'moderate' })
  const [medication, setMedication] = useState('')
  const [condition, setCondition] = useState('')
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false

    api.patients
      .profile()
      .then((data) => {
        if (cancelled) return
        setProfile({
          bloodGroup: data.bloodGroup ?? '',
          allergies: data.allergies ?? [],
          medications: data.medications ?? [],
          conditions: data.conditions ?? [],
          emergencyContact: data.emergencyContact ?? { name: '', phone: '' },
          notes: data.notes ?? '',
        })
        setState('ready')
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not load your medical card.')
          setState('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function save(next) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      await api.patients.saveProfile(next ?? profile)
      setNotice('Medical card saved — your care team and the prescription check both read this.')
    } catch (err) {
      setError(err.message || 'Could not save the card.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Your record</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
          <HeartPulse size={26} className="text-brand-700" />
          Medical card
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Allergies, what you take, and who to call. Every prescription a doctor writes is checked
          against this card before it is issued.
        </p>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

      {state === 'loading' ? <p className="mt-8 text-sm text-mist">Loading your card…</p> : null}

      {state === 'ready' ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">Basics</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="blood" className="text-xs font-semibold uppercase tracking-wide text-mist">
                    Blood group
                  </label>
                  <input
                    id="blood"
                    value={profile.bloodGroup}
                    onChange={(event) => setProfile({ ...profile, bloodGroup: event.target.value })}
                    placeholder="O+"
                    className={`${FIELD_CLASS} mt-1.5`}
                  />
                </div>

                <div>
                  <label htmlFor="contact-name" className="text-xs font-semibold uppercase tracking-wide text-mist">
                    Emergency contact
                  </label>
                  <input
                    id="contact-name"
                    value={profile.emergencyContact?.name ?? ''}
                    onChange={(event) =>
                      setProfile({ ...profile, emergencyContact: { ...profile.emergencyContact, name: event.target.value } })
                    }
                    placeholder="Name"
                    className={`${FIELD_CLASS} mt-1.5`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="contact-phone" className="text-xs font-semibold uppercase tracking-wide text-mist">
                    Contact phone
                  </label>
                  <input
                    id="contact-phone"
                    value={profile.emergencyContact?.phone ?? ''}
                    onChange={(event) =>
                      setProfile({ ...profile, emergencyContact: { ...profile.emergencyContact, phone: event.target.value } })
                    }
                    placeholder="92300…"
                    className={`${FIELD_CLASS} mt-1.5`}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">Allergies</h2>

              <ul className="mt-4 space-y-2">
                {profile.allergies.map((entry, index) => (
                  <li key={`${entry.substance}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {entry.substance}
                        <span className="ml-2 text-xs font-normal uppercase tracking-wide text-danger">
                          {entry.severity}
                        </span>
                      </p>
                      {entry.reaction ? <p className="text-xs text-mist">{entry.reaction}</p> : null}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${entry.substance}`}
                      onClick={() => {
                        const next = { ...profile, allergies: profile.allergies.filter((_, i) => i !== index) }
                        setProfile(next)
                        save(next)
                      }}
                      className="rounded p-2 text-mist transition-colors hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
                {!profile.allergies.length ? (
                  <li className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-mist">
                    No allergies recorded.
                  </li>
                ) : null}
              </ul>

              <div className="mt-4 flex flex-wrap items-end gap-2">
                <input
                  value={allergy.substance}
                  onChange={(event) => setAllergy({ ...allergy, substance: event.target.value })}
                  placeholder="Substance (e.g. penicillin)"
                  aria-label="Allergy substance"
                  className={`${FIELD_CLASS} w-48`}
                />
                <input
                  value={allergy.reaction}
                  onChange={(event) => setAllergy({ ...allergy, reaction: event.target.value })}
                  placeholder="Reaction"
                  aria-label="Reaction"
                  className={`${FIELD_CLASS} w-44`}
                />
                <select
                  value={allergy.severity}
                  onChange={(event) => setAllergy({ ...allergy, severity: event.target.value })}
                  aria-label="Severity"
                  className={`${FIELD_CLASS} w-32 appearance-none`}
                >
                  {SEVERITIES.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!allergy.substance.trim() || busy}
                  onClick={() => {
                    const next = { ...profile, allergies: [...profile.allergies, { ...allergy }] }
                    setProfile(next)
                    setAllergy({ substance: '', reaction: '', severity: 'moderate' })
                    save(next)
                  }}
                  className={SUBMIT_CLASS}
                >
                  <Plus size={14} /> Add allergy
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">Medications &amp; conditions</h2>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-mist">Currently taking</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {profile.medications.map((entry, index) => (
                      <li key={`${entry}-${index}`} className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs text-body">
                        {entry}
                        <button
                          type="button"
                          aria-label={`Remove ${entry}`}
                          onClick={() => {
                            const next = { ...profile, medications: profile.medications.filter((_, i) => i !== index) }
                            setProfile(next)
                            save(next)
                          }}
                          className="text-mist transition-colors hover:text-danger"
                        >
                          <Trash2 size={11} />
                        </button>
                      </li>
                    ))}
                    {!profile.medications.length ? <li className="text-xs text-mist">none recorded</li> : null}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={medication}
                      onChange={(event) => setMedication(event.target.value)}
                      placeholder="e.g. metformin 500mg twice daily"
                      aria-label="Medication"
                      className={FIELD_CLASS}
                    />
                    <button
                      type="button"
                      disabled={!medication.trim() || busy}
                      onClick={() => {
                        const next = { ...profile, medications: [...profile.medications, medication.trim()] }
                        setProfile(next)
                        setMedication('')
                        save(next)
                      }}
                      className={SUBMIT_CLASS}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-mist">Long-term conditions</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {profile.conditions.map((entry, index) => (
                      <li key={`${entry}-${index}`} className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs text-body">
                        {entry}
                        <button
                          type="button"
                          aria-label={`Remove ${entry}`}
                          onClick={() => {
                            const next = { ...profile, conditions: profile.conditions.filter((_, i) => i !== index) }
                            setProfile(next)
                            save(next)
                          }}
                          className="text-mist transition-colors hover:text-danger"
                        >
                          <Trash2 size={11} />
                        </button>
                      </li>
                    ))}
                    {!profile.conditions.length ? <li className="text-xs text-mist">none recorded</li> : null}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={condition}
                      onChange={(event) => setCondition(event.target.value)}
                      placeholder="e.g. type 2 diabetes"
                      aria-label="Condition"
                      className={FIELD_CLASS}
                    />
                    <button
                      type="button"
                      disabled={!condition.trim() || busy}
                      onClick={() => {
                        const next = { ...profile, conditions: [...profile.conditions, condition.trim()] }
                        setProfile(next)
                        setCondition('')
                        save(next)
                      }}
                      className={SUBMIT_CLASS}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <button type="button" onClick={() => save()} disabled={busy} className={SUBMIT_CLASS}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save card
            </button>
          </div>

          <aside className="rounded-2xl border border-brand-200 bg-brand-50 p-6 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Card preview</p>

            <div className="mt-4 rounded-xl border border-line bg-white p-5">
              <p className="text-lg font-extrabold text-ink">{profile.bloodGroup || '—'}</p>
              <p className="text-xs uppercase tracking-wide text-mist">blood group</p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-mist">Allergies</p>
              <p className="mt-1 text-sm text-body">
                {profile.allergies.map((entry) => entry.substance).join(', ') || 'none recorded'}
              </p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-mist">Medications</p>
              <p className="mt-1 text-sm text-body">{profile.medications.join(', ') || 'none recorded'}</p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-mist">Conditions</p>
              <p className="mt-1 text-sm text-body">{profile.conditions.join(', ') || 'none recorded'}</p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-mist">Emergency</p>
              <p className="mt-1 text-sm text-body">
                {profile.emergencyContact?.name || 'not set'}
                {profile.emergencyContact?.phone ? ` · ${profile.emergencyContact.phone}` : ''}
              </p>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-body">
              Keep this current — the prescription safety check reads it on every new medicine, and
              the emergency screen shares it with the crew.
            </p>
          </aside>
        </div>
      ) : null}
    </>
  )
}
