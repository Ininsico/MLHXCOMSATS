import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Clock, Loader2, MapPin, MapPinned, Star } from 'lucide-react'
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
                        onClick={() => handleCancel(id)}
                        disabled={busyId === id}
                        className="text-xs font-semibold text-mist transition-colors hover:text-danger disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>

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
    </>
  )
}
