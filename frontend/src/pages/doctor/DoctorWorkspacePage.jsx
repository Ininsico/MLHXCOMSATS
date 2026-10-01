import { useCallback, useEffect, useState } from 'react'
import { Brain, FileText, Loader2, Mic, Plus, Send, ShieldAlert, Trash2, UserCheck } from 'lucide-react'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'
import { createRecorder, transcribeBlob } from '../../lib/voice'

const FIELD_CLASS =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'
const SUBMIT_CLASS =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'
const GHOST_CLASS =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const SEVERITY_CLASS = { serious: 'border-danger/40 bg-danger/5 text-danger', caution: 'border-line bg-surface text-body', info: 'border-line bg-surface text-mist' }
const URGENCY = [
  { value: 'routine', label: 'Routine' },
  { value: 'soon', label: 'Soon' },
  { value: 'urgent', label: 'Urgent' },
]

export default function DoctorWorkspacePage() {
  const [queue, setQueue] = useState({ appointments: [] })
  const [selected, setSelected] = useState('')
  const [note, setNote] = useState({ subjective: '', objective: '', assessment: '', plan: '', draft: true })
  const [drugs, setDrugs] = useState([{ drug: '', dose: '', frequency: '' }])
  const [patient, setPatient] = useState({ name: '', userId: '' })
  const [warnings, setWarnings] = useState([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [prescriptions, setPrescriptions] = useState([])
  const [referrals, setReferrals] = useState([])
  const [referral, setReferral] = useState({ toSpecialty: 'Cardiology', reason: '', urgency: 'routine', patientName: '' })
  const [busy, setBusy] = useState('')
  const [previsit, setPrevisit] = useState(null)
  const [listening, setListening] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const [queueData, prescriptionData, referralData] = await Promise.all([
        api.doctorCare.queue(),
        api.doctorCare.prescriptions('mine=true'),
        api.doctorCare.referrals('queue=true'),
      ])
      setQueue(queueData ?? { appointments: [] })
      setPrescriptions(prescriptionData ?? [])
      setReferrals(referralData ?? [])
      return queueData
    } catch (err) {
      setError(err.message || 'Could not load the workspace.')
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([api.doctorCare.queue(), api.doctorCare.prescriptions('mine=true'), api.doctorCare.referrals('queue=true')])
      .then(([queueData, prescriptionData, referralData]) => {
        if (cancelled) return
        setQueue(queueData ?? { appointments: [] })
        setPrescriptions(prescriptionData ?? [])
        setReferrals(referralData ?? [])
        const first = (queueData?.appointments ?? [])[0]
        if (first) {
          setSelected(first.id ?? first._id)
          setPatient({ name: first.patientName ?? '', userId: first.patientUser ?? '' })
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the workspace.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function pickAppointment(id) {
    setSelected(id)
    setNote({ subjective: '', objective: '', assessment: '', plan: '', draft: true })
    setNotice('')

    const appointment = (queue.appointments ?? []).find((entry) => (entry.id ?? entry._id) === id)

    if (appointment) setPatient({ name: appointment.patientName ?? '', userId: appointment.patientUser ?? '' })

    try {
      const existing = await api.doctorCare.note(id)
      if (existing) setNote({ ...existing, draft: Boolean(existing.draft) })
    } catch {
      /* no note yet */
    }

    try {
      const answers = await api.doctorCare.previsit(id)
      setPrevisit(answers ?? null)
    } catch {
      setPrevisit(null)
    }
  }

  async function acceptReferral(entry) {
    const referralId = entry.id ?? entry._id

    setBusy(`accept-${referralId}`)
    setError('')

    try {
      await api.doctorCare.setReferral(referralId, 'accepted')
      await load()
      setNotice(
        `Referral accepted for ${entry.patientName || 'the patient'} — it has left the open queue.`,
      )
    } catch (err) {
      setError(err.message || 'Could not accept that referral.')
    } finally {
      setBusy('')
    }
  }

  async function draftNote() {
    if (!selected) return
    setBusy('draft')
    setError('')

    try {
      const drafted = await api.doctorCare.draftNote(selected)
      setNote({
        subjective: drafted.subjective ?? '',
        objective: drafted.objective ?? '',
        assessment: drafted.assessment ?? '',
        plan: drafted.plan ?? '',
        draft: true,
      })
      setNotice('Draft written by Aurora from the visit and any AI findings — edit it, then approve.')
    } catch (err) {
      setError(err.message || 'Could not draft the note.')
    } finally {
      setBusy('')
    }
  }

  async function dictateInto(field) {
    const recorder = createRecorder()

    if (!recorder) {
      setError('This browser cannot record audio.')
      return
    }

    if (listening === field) {
      setBusy('dictate')
      setListening('')

      try {
        const blob = await recorder.stop()
        if (blob?.size) {
          const text = await transcribeBlob(blob)
          setNote((current) => ({ ...current, [field]: `${current[field]}${current[field] ? '\n' : ''}${text}` }))
          setNotice('Dictation added — check it before approving.')
        }
      } catch (err) {
        setError(err.message || 'Dictation failed.')
      } finally {
        setBusy('')
      }

      return
    }

    setError('')
    setListening(field)
    await recorder.start().catch(() => {
      setListening('')
      setError('Microphone permission denied.')
    })
  }

  async function approveNote() {
    if (!selected) return
    setBusy('note')
    setError('')

    try {
      await api.doctorCare.saveNote(selected, { ...note, source: note.draft ? 'ai' : 'manual' })
      setNote((current) => ({ ...current, draft: false }))
      setNotice('Note approved and filed on the record.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not save the note.')
    } finally {
      setBusy('')
    }
  }

  async function checkDrugs() {
    setBusy('check')
    setError('')

    try {
      const data = await api.doctorCare.checkPrescription({ patientUserId: patient.userId || undefined, items: drugs })
      setWarnings(data.warnings ?? [])
      setNotice(
        (data.warnings ?? []).length
          ? `${data.warnings.length} warning(s) from the drug graph — read them before issuing.`
          : 'No interactions found in the drug graph for this combination.',
      )
    } catch (err) {
      setError(err.message || 'Could not check the prescription.')
    } finally {
      setBusy('')
    }
  }

  async function issue() {
    setBusy('issue')
    setError('')

    try {
      await api.doctorCare.prescribe({
        patientUserId: patient.userId || undefined,
        patientName: patient.name,
        items: drugs.filter((entry) => entry.drug.trim()),
        acknowledgeWarnings: acknowledged,
      })
      setNotice('Prescription issued.')
      setDrugs([{ drug: '', dose: '', frequency: '' }])
      setWarnings([])
      setAcknowledged(false)
      await load()
    } catch (err) {
      setError(err.message || 'Could not issue the prescription.')
    } finally {
      setBusy('')
    }
  }

  async function sendReferral(event) {
    event.preventDefault()
    setBusy('referral')

    try {
      await api.doctorCare.refer({ ...referral, patientUserId: patient.userId || undefined, patientName: referral.patientName || patient.name })
      setReferral({ toSpecialty: 'Cardiology', reason: '', urgency: 'routine', patientName: '' })
      setNotice('Referral sent.')
      await load()
    } catch (err) {
      setError(err.message || 'Could not send the referral.')
    } finally {
      setBusy('')
    }
  }

  const serious = warnings.filter((warning) => warning.severity === 'serious')
  const activeAppointment =
    (queue.appointments ?? []).find((entry) => (entry.id ?? entry._id) === selected) ?? null

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Clinical workspace</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
          <Brain size={26} className="text-brand-700" />
          Notes, prescriptions &amp; referrals
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Aurora drafts from the visit and the AI findings on record; you edit, approve, and it is
          filed. Prescriptions are checked against the drug graph and the patient's own card.
        </p>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Today</h2>
            <p className="mt-1 text-xs text-mist">
              {queue.appointments?.length ?? 0} booked · {queue.waiting ?? 0} waiting · {queue.completed ?? 0} done
              {queue.nextFreeSlot ? ` · next free ${queue.nextFreeSlot.time}` : ''}
            </p>
          </div>

          <SelectField
            id="appointment"
            label="Working on"
            size="sm"
            className="w-full sm:w-72"
            value={selected}
            onChange={(event) => pickAppointment(event.target.value)}
            options={[
              { value: '', label: 'Choose a visit…' },
              ...(queue.appointments ?? []).map((entry) => ({
                value: entry.id ?? entry._id,
                label: `${entry.time} · ${entry.patientName}${entry.specialty ? ` · ${entry.specialty}` : ''}`,
              })),
            ]}
          />
        </div>

        {(queue.appointments ?? []).length ? (
          <ul className="mt-4 flex flex-wrap gap-3">
            {(queue.appointments ?? []).map((entry) => (
              <li key={entry.id ?? entry._id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                <span className="text-xs font-semibold text-ink">{entry.time}</span>
                <span className="text-xs text-body">{entry.patientName}</span>
                <StatusChip status={entry.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl bg-surface px-4 py-6 text-center text-sm text-mist">
            No visits booked today.
          </p>
        )}
      </section>

      {previsit ? (
        <section className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">What the patient told us before the visit</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              submitted {new Date(previsit.submittedAt).toLocaleString()}
            </span>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ['Symptoms', previsit.symptoms],
              ['How long', previsit.duration],
              ['Pain', previsit.painScale !== null && previsit.painScale !== undefined ? `${previsit.painScale}/10` : ''],
              ['Medications listed', previsit.currentMedications],
              ['Allergies listed', previsit.allergies],
              ['Wants to ask', previsit.questions],
              ['Anything else', previsit.anythingElse],
            ]
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-mist">{label}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-body">{value}</dd>
                </div>
              ))}
          </dl>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <FileText size={18} className="text-brand-700" />
                Consult note
              </h2>
              <p className="mt-1 text-xs text-mist">
                {activeAppointment
                  ? `${activeAppointment.patientName} · ${activeAppointment.time}`
                  : patient.name
                    ? `${patient.name} · no visit booked today`
                    : 'Choose a visit to write a note.'}
              </p>
            </div>
            {note.draft ? (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-700">
                draft — not filed
              </span>
            ) : (
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold uppercase tracking-widest text-mist">
                approved
              </span>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {['subjective', 'objective', 'assessment', 'plan'].map((field) => (
              <div key={field}>
                <div className="flex items-center justify-between">
                  <label htmlFor={field} className="text-xs font-semibold uppercase tracking-wide text-mist">
                    {field}
                  </label>
                  <button
                    type="button"
                    onClick={() => dictateInto(field)}
                    disabled={Boolean(busy)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-60"
                  >
                    {listening === field ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
                    {listening === field ? 'stop' : 'dictate'}
                  </button>
                </div>
                <textarea
                  id={field}
                  rows={3}
                  value={note[field]}
                  onChange={(event) => setNote({ ...note, [field]: event.target.value })}
                  className={`${FIELD_CLASS} mt-1`}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={draftNote} disabled={!selected || Boolean(busy)} className={GHOST_CLASS}>
              {busy === 'draft' ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
              Draft with Aurora
            </button>
            <button type="button" onClick={approveNote} disabled={!selected || Boolean(busy)} className={SUBMIT_CLASS}>
              {busy === 'note' ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
              Approve &amp; file
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ShieldAlert size={18} className="text-danger" />
            Prescription
          </h2>
          <p className="mt-1 text-xs text-mist">
            Checked against the drug graph and {patient.name || 'the patient'}'s allergies and
            conditions before anything is issued.
          </p>

          <div className="mt-4 space-y-3">
            {drugs.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={entry.drug}
                  onChange={(event) => setDrugs(drugs.map((row, i) => (i === index ? { ...row, drug: event.target.value } : row)))}
                  placeholder="Medicine (e.g. ibuprofen)"
                  aria-label="Medicine"
                  className={FIELD_CLASS}
                />
                <input
                  value={entry.dose}
                  onChange={(event) => setDrugs(drugs.map((row, i) => (i === index ? { ...row, dose: event.target.value } : row)))}
                  placeholder="Dose"
                  aria-label="Dose"
                  className={`${FIELD_CLASS} w-28`}
                />
                <button
                  type="button"
                  onClick={() => setDrugs(drugs.filter((_, i) => i !== index))}
                  disabled={drugs.length === 1}
                  aria-label="Remove medicine"
                  className="rounded p-2 text-mist transition-colors hover:text-danger disabled:opacity-40"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setDrugs([...drugs, { drug: '', dose: '', frequency: '' }])}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              <Plus size={12} /> add medicine
            </button>
          </div>

          {warnings.length ? (
            <ul className="mt-4 space-y-2">
              {warnings.map((warning, index) => (
                <li key={`${warning.message}-${index}`} className={`rounded-xl border px-3 py-2 text-xs ${SEVERITY_CLASS[warning.severity] ?? SEVERITY_CLASS.caution}`}>
                  <span className="font-bold uppercase tracking-wide">{warning.severity}</span> · {warning.kind} — {warning.message}
                </li>
              ))}
            </ul>
          ) : null}

          {serious.length ? (
            <label className="mt-3 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-body">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-0.5"
              />
              I have read the serious warnings above and am issuing this prescription anyway.
            </label>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={checkDrugs} disabled={Boolean(busy)} className={GHOST_CLASS}>
              {busy === 'check' ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
              Check safety
            </button>
            <button
              type="button"
              onClick={issue}
              disabled={Boolean(busy) || (serious.length > 0 && !acknowledged)}
              className={SUBMIT_CLASS}
            >
              {busy === 'issue' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Issue prescription
            </button>
          </div>

          <ul className="mt-5 divide-y divide-line">
            {prescriptions.slice(0, 5).map((entry) => (
              <li key={entry.id ?? entry._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-xs text-body">
                  {entry.patientName || 'patient'} · {entry.items?.map((item) => item.drug).join(', ')}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-mist">
                  {entry.warnings?.length ? `${entry.warnings.length} warning(s)` : 'clear'} · {entry.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-ink">Referrals</h2>

        <form onSubmit={sendReferral} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-48">
            <label htmlFor="referral-patient" className="text-xs font-semibold uppercase tracking-wide text-mist">
              Patient
            </label>
            <input
              id="referral-patient"
              value={referral.patientName || patient.name}
              onChange={(event) => setReferral({ ...referral, patientName: event.target.value })}
              className={`${FIELD_CLASS} mt-1.5`}
            />
          </div>

          <SelectField
            id="specialty"
            label="Refer to"
            size="sm"
            className="w-full sm:w-44"
            value={referral.toSpecialty}
            onChange={(event) => setReferral({ ...referral, toSpecialty: event.target.value })}
            options={['Cardiology', 'General Medicine', 'Pediatrics', 'Dermatology', 'Mental Health', 'Orthopedics'].map((value) => ({ value, label: value }))}
          />

          <SelectField
            id="urgency"
            label="Urgency"
            size="sm"
            className="w-full sm:w-36"
            value={referral.urgency}
            onChange={(event) => setReferral({ ...referral, urgency: event.target.value })}
            options={URGENCY}
          />

          <div className="w-full sm:min-w-[240px] sm:flex-1">
            <label htmlFor="reason" className="text-xs font-semibold uppercase tracking-wide text-mist">
              Reason
            </label>
            <input
              id="reason"
              value={referral.reason}
              onChange={(event) => setReferral({ ...referral, reason: event.target.value })}
              placeholder="What should the next doctor know?"
              className={`${FIELD_CLASS} mt-1.5`}
            />
          </div>

          <button type="submit" disabled={busy === 'referral'} className={SUBMIT_CLASS}>
            {busy === 'referral' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Refer
          </button>
        </form>

        <ul className="mt-5 divide-y divide-line">
          {referrals.map((entry) => {
            const referralId = entry.id ?? entry._id

            return (
              <li
                key={referralId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {entry.patientName} → {entry.toSpecialty}
                  </p>
                  <p className="mt-0.5 text-xs text-mist">
                    {entry.fromDoctorName} · {entry.urgency}
                    {entry.reason ? ` · ${entry.reason}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip status={entry.status} />
                  {entry.status === 'open' ? (
                    <button
                      type="button"
                      onClick={() => acceptReferral(entry)}
                      disabled={Boolean(busy)}
                      className={GHOST_CLASS}
                    >
                      {busy === `accept-${referralId}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : null}
                      Accept
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
          {!referrals.length ? (
            <li className="py-6 text-center text-sm text-mist">No open referrals.</li>
          ) : null}
        </ul>
      </section>
    </>
  )
}
