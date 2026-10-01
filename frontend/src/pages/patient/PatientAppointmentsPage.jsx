import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, ClipboardList, Clock, Loader2, MapPin, MapPinned, Star } from 'lucide-react'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'
import { APPOINTMENT_STATUS_LABELS } from '../../lib/labels'
import { SLOT_TIMES, formatSlotDate, todayISO } from '../../lib/themes'

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const RATINGS = [5, 4, 3, 2, 1].map((value) => ({
  value: String(value),
  label: `${value} — ${['Poor', 'Fair', 'Good', 'Very good', 'Excellent'][value - 1]}`,
}))

export default function PatientAppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [state, setState] = useState('loading')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [panel, setPanel] = useState(null)
  const [form, setForm] = useState({ date: '', time: '', rating: '5', comment: '' })
  const [hospitals, setHospitals] = useState([])
  const [waitlist, setWaitlist] = useState([])
  const [waitlistForm, setWaitlistForm] = useState({ hospitalId: '', specialty: '', from: '', to: '', reason: '' })
  const [previsitFor, setPrevisitFor] = useState('')
  const [previsit, setPrevisit] = useState({ symptoms: '', duration: '', painScale: '', currentMedications: '', allergies: '', questions: '', anythingElse: '' })

  useEffect(() => {
    let cancelled = false

    Promise.all([api.hospitals.list(), api.patients.waitlist()])
      .then(([hospitalData, waitlistData]) => {
        if (cancelled) return
        setHospitals(hospitalData ?? [])
        setWaitlist(waitlistData ?? [])
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  async function savePrevisit(appointmentId) {
    setBusyId(appointmentId)
    setError('')
    setNotice('')

    try {
      await api.patients.savePrevisit(appointmentId, previsit)
      setPrevisitFor('')
      setNotice('Sent — your doctor sees this before the visit, and it feeds their AI note draft.')
    } catch (err) {
      setError(err.message || 'Could not send that form.')
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    let cancelled = false

    api.appointments
      .mine()
      .then((data) => {
        if (cancelled) return
        setAppointments(data ?? [])
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  function patch(id, changes) {
    setAppointments((current) =>
      current.map((item) => ((item.id ?? item._id) === id ? { ...item, ...changes } : item)),
    )
  }

  async function handleCancel(id) {
    setBusyId(id)
    setError('')

    try {
      await api.appointments.cancelMine(id)
      patch(id, { status: 'cancelled' })
    } catch (err) {
      setError(err.message || 'That appointment could not be cancelled.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCheckIn(id) {
    setBusyId(id)
    setError('')
    setNotice('')

    try {
      const updated = await api.patients.checkIn(id)
      patch(id, { status: updated.status ?? 'arrived' })
      setNotice('Checked in — the front desk can see you are here.')
    } catch (err) {
      setError(err.message || 'Check-in failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReschedule(event, id) {
    event.preventDefault()
    setBusyId(id)
    setError('')
    setNotice('')

    try {
      const updated = await api.patients.reschedule(id, { date: form.date, time: form.time })
      patch(id, { date: updated.date, time: updated.time })
      setPanel(null)
      setNotice('Appointment moved — the hospital sees the new time immediately.')
    } catch (err) {
      setError(err.message || 'That slot could not be taken.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReview(event, id) {
    event.preventDefault()
    setBusyId(id)
    setError('')
    setNotice('')

    try {
      await api.patients.review(id, { rating: Number(form.rating), comment: form.comment })
      patch(id, { reviewed: true })
      setPanel(null)
      setNotice('Thanks — your rating is on the hospital’s page now.')
    } catch (err) {
      setError(err.message || 'That review could not be saved.')
    } finally {
      setBusyId(null)
    }
  }

  const today = todayISO()

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
            Appointments
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Your visits</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
            Move a visit, check in when you arrive, and rate the care afterwards — all without
            calling anyone.
          </p>
        </div>

        <Link
          to="/explore"
          className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          Book another visit
        </Link>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

      {state === 'loading' ? <p className="mt-8 text-sm text-mist">Loading your visits…</p> : null}
      {state === 'error' ? (
        <p className="mt-8 text-sm text-danger">Couldn't load your appointments right now.</p>
      ) : null}

      {state === 'ready' && appointments.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
          <CalendarCheck size={22} className="mx-auto text-brand-700" />
          <p className="mt-3 text-sm font-semibold text-ink">No appointments yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-mist">
            Open a hospital and let Aurora pick the right doctor and time for you.
          </p>
        </div>
      ) : null}

      {state === 'ready' && appointments.length > 0 ? (
        <ul className="mt-8 space-y-4">
          {appointments.map((item) => {
            const id = item.id ?? item._id
            const hospital = item.hospital ?? {}
            const open = item.status === 'requested' || item.status === 'confirmed'
            const arrived = item.status === 'arrived'
            const canCheckIn = item.date === today && (open || arrived)
            const canReview = item.date <= today && item.status !== 'cancelled' && !item.reviewed

            return (
              <li key={id} className="rounded-2xl border border-line bg-white px-6 py-5 shadow-soft">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-full sm:min-w-[180px] sm:w-auto">
                    <p className="text-sm font-bold text-ink">
                      {formatSlotDate(item.date)} · {item.time}
                    </p>
                    <p className="mt-1 text-xs text-mist">
                      {item.doctorName || 'Any doctor'}
                      {item.specialty ? ` · ${item.specialty}` : ''}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{hospital.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-mist">
                      <MapPin size={12} />
                      {hospital.area} · {hospital.city}
                    </p>
                    {item.reason ? (
                      <p className="mt-1 truncate text-xs text-body">{item.reason}</p>
                    ) : null}
                  </div>

                  <StatusChip
                    status={item.status}
                    label={APPOINTMENT_STATUS_LABELS[item.status] ?? item.status}
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    {canCheckIn ? (
                      <button
                        type="button"
                        onClick={() => handleCheckIn(id)}
                        disabled={busyId === id}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                      >
                        {busyId === id ? <Loader2 size={13} className="animate-spin" /> : <MapPinned size={13} />}
                        Check in
                      </button>
                    ) : null}

                    {open ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPanel(panel === `reschedule-${id}` ? null : `reschedule-${id}`)
                          setForm({ ...form, date: item.date, time: item.time })
                        }}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-4 text-xs font-bold uppercase tracking-widest text-body transition-colors hover:border-brand-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                      >
                        <Clock size={13} />
                        Reschedule
                      </button>
                    ) : null}

                    {canReview ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPanel(panel === `review-${id}` ? null : `review-${id}`)
                          setForm({ ...form, rating: '5', comment: '' })
                        }}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-4 text-xs font-bold uppercase tracking-widest text-body transition-colors hover:border-brand-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                      >
                        <Star size={13} />
                        Rate visit
                      </button>
                    ) : null}

                    {open ? (
                      <button
                        type="button"
                        onClick={() => setPrevisitFor(previsitFor === id ? '' : id)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-4 text-xs font-bold uppercase tracking-widest text-body transition-colors hover:border-brand-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                      >
                        <ClipboardList size={13} />
                        Tell the doctor
                      </button>
                    ) : null}

                    {open ? (
                      <button
                        type="button"
                        onClick={() => handleCancel(id)}
                        disabled={busyId === id}
                        className="text-xs font-semibold text-mist transition-colors hover:text-danger disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>

                {previsitFor === id ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      savePrevisit(id)
                    }}
                    className="mt-5 space-y-3 border-t border-line pt-5"
                  >
                    <p className="text-xs text-mist">
                      Anything you write here is shown to the doctor before the visit and feeds
                      their AI note draft — it saves repeating yourself.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor={`symptoms-${id}`} className="text-xs font-semibold uppercase tracking-wide text-mist">
                          What is going on?
                        </label>
                        <textarea
                          id={`symptoms-${id}`}
                          rows={3}
                          value={previsit.symptoms}
                          onChange={(event) => setPrevisit({ ...previsit, symptoms: event.target.value })}
                          className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
                        />
                      </div>

                      <div>
                        <label htmlFor={`duration-${id}`} className="text-xs font-semibold uppercase tracking-wide text-mist">
                          How long?
                        </label>
                        <input
                          id={`duration-${id}`}
                          value={previsit.duration}
                          onChange={(event) => setPrevisit({ ...previsit, duration: event.target.value })}
                          placeholder="e.g. three days"
                          className={`${FIELD_CLASS} mt-1.5`}
                        />
                      </div>

                      <SelectField
                        id={`pain-${id}`}
                        label="Pain right now"
                        size="sm"
                        value={String(previsit.painScale)}
                        onChange={(event) => setPrevisit({ ...previsit, painScale: event.target.value === '' ? '' : Number(event.target.value) })}
                        options={[
                          { value: '', label: 'Not applicable' },
                          ...Array.from({ length: 11 }, (_, score) => ({ value: String(score), label: `${score} / 10` })),
                        ]}
                      />

                      <div>
                        <label htmlFor={`meds-${id}`} className="text-xs font-semibold uppercase tracking-wide text-mist">
                          Medications you take
                        </label>
                        <input
                          id={`meds-${id}`}
                          value={previsit.currentMedications}
                          onChange={(event) => setPrevisit({ ...previsit, currentMedications: event.target.value })}
                          className={`${FIELD_CLASS} mt-1.5`}
                        />
                      </div>

                      <div>
                        <label htmlFor={`allergies-${id}`} className="text-xs font-semibold uppercase tracking-wide text-mist">
                          Allergies
                        </label>
                        <input
                          id={`allergies-${id}`}
                          value={previsit.allergies}
                          onChange={(event) => setPrevisit({ ...previsit, allergies: event.target.value })}
                          className={`${FIELD_CLASS} mt-1.5`}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label htmlFor={`questions-${id}`} className="text-xs font-semibold uppercase tracking-wide text-mist">
                          What do you want to ask?
                        </label>
                        <input
                          id={`questions-${id}`}
                          value={previsit.questions}
                          onChange={(event) => setPrevisit({ ...previsit, questions: event.target.value })}
                          className={`${FIELD_CLASS} mt-1.5`}
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={busyId === id} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50">
                      {busyId === id ? <Loader2 size={14} className="animate-spin" /> : null}
                      Send to the doctor
                    </button>
                  </form>
                ) : null}

                {panel === `reschedule-${id}` ? (
                  <form
                    onSubmit={(event) => handleReschedule(event, id)}
                    className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5"
                  >
                    <div className="w-full sm:w-44">
                      <label htmlFor={`date-${id}`} className="text-xs font-semibold uppercase tracking-wide text-mist">
                        New date
                      </label>
                      <input
                        id={`date-${id}`}
                        type="date"
                        min={today}
                        value={form.date}
                        onChange={(event) => setForm({ ...form, date: event.target.value })}
                        className={`${FIELD_CLASS} mt-1.5`}
                      />
                    </div>

                    <SelectField
                      id={`time-${id}`}
                      label="New time"
                      size="sm"
                      className="w-full sm:w-36"
                      value={form.time}
                      onChange={(event) => setForm({ ...form, time: event.target.value })}
                      options={SLOT_TIMES.map((time) => ({ value: time, label: time }))}
                    />

                    <button
                      type="submit"
                      disabled={busyId === id || !form.date || !form.time}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      {busyId === id ? <Loader2 size={14} className="animate-spin" /> : null}
                      Move visit
                    </button>
                  </form>
                ) : null}

                {panel === `review-${id}` ? (
                  <form
                    onSubmit={(event) => handleReview(event, id)}
                    className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5"
                  >
                    <SelectField
                      id={`rating-${id}`}
                      label="How was it?"
                      size="sm"
                      className="w-full sm:w-52"
                      value={form.rating}
                      onChange={(event) => setForm({ ...form, rating: event.target.value })}
                      options={RATINGS}
                    />

                    <div className="w-full sm:min-w-[240px] sm:flex-1">
                      <label htmlFor={`comment-${id}`} className="text-xs font-semibold uppercase tracking-wide text-mist">
                        Comment (optional)
                      </label>
                      <input
                        id={`comment-${id}`}
                        value={form.comment}
                        onChange={(event) => setForm({ ...form, comment: event.target.value })}
                        placeholder="What went well, what could be better?"
                        className={`${FIELD_CLASS} mt-1.5`}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={busyId === id}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      {busyId === id ? <Loader2 size={14} className="animate-spin" /> : null}
                      Send rating
                    </button>
                  </form>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      <section className="mt-10 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Waiting list</h2>
            <p className="mt-1 text-sm text-mist">
              No free slot at the time you want? Join the list — when something opens up at that
              hospital, Aurora offers it to you on WhatsApp first.
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            setBusyId('waitlist')
            setError('')

            api.patients
              .joinWaitlist(waitlistForm)
              .then(() => {
                setNotice('You are on the list — offers arrive by WhatsApp.')
                setWaitlistForm({ ...waitlistForm, reason: '' })
                return api.patients.waitlist()
              })
              .then((data) => setWaitlist(data ?? []))
              .catch((err) => setError(err.message || 'Could not join that list.'))
              .finally(() => setBusyId(null))
          }}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <SelectField
            id="waitlist-hospital"
            label="Hospital"
            size="sm"
            className="w-64"
            value={waitlistForm.hospitalId}
            onChange={(event) => setWaitlistForm({ ...waitlistForm, hospitalId: event.target.value })}
            options={[
              { value: '', label: 'Choose a hospital…' },
              ...hospitals.map((hospital) => ({
                value: hospital.id ?? hospital._id,
                label: `${hospital.name} (${hospital.city ?? ''})`,
              })),
            ]}
          />

          <SelectField
            id="waitlist-specialty"
            label="Specialty"
            size="sm"
            className="w-48"
            value={waitlistForm.specialty}
            onChange={(event) => setWaitlistForm({ ...waitlistForm, specialty: event.target.value })}
            options={[
              { value: '', label: 'Any' },
              ...['Cardiology', 'General Medicine', 'Pediatrics', 'Dermatology', 'Orthopedics', 'Mental Health'].map(
                (value) => ({ value, label: value }),
              ),
            ]}
          />

          <div className="w-40">
            <label htmlFor="waitlist-from" className="text-xs font-semibold uppercase tracking-wide text-mist">
              From
            </label>
            <input
              id="waitlist-from"
              type="date"
              value={waitlistForm.from}
              onChange={(event) => setWaitlistForm({ ...waitlistForm, from: event.target.value })}
              className={`${FIELD_CLASS} mt-1.5`}
            />
          </div>

          <div className="w-40">
            <label htmlFor="waitlist-to" className="text-xs font-semibold uppercase tracking-wide text-mist">
              Until
            </label>
            <input
              id="waitlist-to"
              type="date"
              value={waitlistForm.to}
              onChange={(event) => setWaitlistForm({ ...waitlistForm, to: event.target.value })}
              className={`${FIELD_CLASS} mt-1.5`}
            />
          </div>

          <button
            type="submit"
            disabled={busyId === 'waitlist' || !waitlistForm.hospitalId}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
          >
            {busyId === 'waitlist' ? <Loader2 size={14} className="animate-spin" /> : null}
            Join list
          </button>
        </form>

        <ul className="mt-5 divide-y divide-line">
          {waitlist.map((entry) => (
            <li key={entry.id ?? entry._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {entry.hospital?.name ?? 'Hospital'}
                  {entry.specialty ? ` · ${entry.specialty}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-mist">
                  {entry.status === 'offered' && entry.offer?.date
                    ? `Slot offered: ${entry.offer.date} at ${entry.offer.time}${
                        entry.offer.expiresAt ? ` — take it before ${new Date(entry.offer.expiresAt).toLocaleString()}` : ''
                      }`
                    : `waiting since ${new Date(entry.createdAt).toLocaleDateString()}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {entry.status === 'offered' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBusyId(entry.id ?? entry._id)
                      setError('')

                      api.patients
                        .acceptWaitlistOffer(entry.id ?? entry._id)
                        .then(() => {
                          setNotice('Booked from the waitlist — it is in your visits above.')
                          return Promise.all([api.patients.waitlist(), api.appointments.mine()])
                        })
                        .then(([entries, visits]) => {
                          setWaitlist(entries ?? [])
                          setAppointments(visits ?? [])
                        })
                        .catch((err) => setError(err.message || 'That offer could not be taken.'))
                        .finally(() => setBusyId(null))
                    }}
                    disabled={Boolean(busyId)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
                  >
                    Take the slot
                  </button>
                ) : null}

                <StatusChip status={entry.status} />

                {entry.status === 'waiting' || entry.status === 'offered' ? (
                  <button
                    type="button"
                    onClick={() =>
                      api.patients
                        .leaveWaitlist(entry.id ?? entry._id)
                        .then(() => api.patients.waitlist())
                        .then((data) => setWaitlist(data ?? []))
                        .catch((err) => setError(err.message))
                    }
                    className="text-xs font-semibold text-mist transition-colors hover:text-danger"
                  >
                    Leave
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {!waitlist.length ? (
            <li className="py-6 text-center text-sm text-mist">You are not on any waiting list.</li>
          ) : null}
        </ul>
      </section>
    </>
  )
}
