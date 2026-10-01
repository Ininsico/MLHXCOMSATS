import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus } from 'lucide-react'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import Timetable from '../../components/Timetable'
import { api } from '../../lib/api'
import { APPOINTMENT_STATUS_LABELS } from '../../lib/labels'
import { SLOT_TIMES, formatSlotDate, todayISO } from '../../lib/themes'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const FILTERS = [
  { value: 'all', label: 'All appointments' },
  ...['requested', 'confirmed', 'completed', 'cancelled'].map((status) => ({
    value: status,
    label: APPOINTMENT_STATUS_LABELS[status],
  })),
]

const NEXT_STATUS = {
  requested: { label: 'Confirm', status: 'confirmed' },
  confirmed: { label: 'Mark completed', status: 'completed' },
}

export default function HospitalAppointmentsPage() {
  const { appointments, staff, state, reload } = useOutletContext()
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('list')
  const [timetableDate, setTimetableDate] = useState(todayISO())
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    patientName: '',
    patientPhone: '',
    doctorId: '',
    date: todayISO(),
    time: SLOT_TIMES[0],
    reason: '',
  })

  const doctors = staff.filter((member) => member.role === 'doctor' && member.status === 'active')

  const timetableRows = useMemo(() => {
    const rows = new Map()
    const unassigned = { key: 'unassigned', label: 'Unassigned', subtitle: 'No doctor linked', slots: {} }

    for (const doctor of staff.filter((member) => member.role === 'doctor')) {
      const id = doctor.id ?? doctor._id
      rows.set(id, {
        key: id,
        label: doctor.name,
        subtitle: doctor.specialty || doctor.department || 'General',
        slots: {},
      })
    }

    const dayAppointments = appointments.filter(
      (item) => item.date === timetableDate && item.status !== 'cancelled',
    )

    for (const item of dayAppointments) {
      const row = rows.get(item.doctor) ?? unassigned
      row.slots[item.time] = {
        label: item.patientName,
        title: `${item.patientName} — ${item.reason || 'appointment'} (${item.status})`,
        muted: item.status === 'completed',
      }
    }

    const list = [...rows.values()]

    if (Object.keys(unassigned.slots).length) list.push(unassigned)

    return list
  }, [appointments, staff, timetableDate])
  const visible = appointments
    .filter((item) => filter === 'all' || item.status === filter)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))

  async function handleStatus(id, status) {
    setBusyId(id)
    setError('')

    try {
      await api.appointments.update(id, status)
      await reload()
    } catch (err) {
      setError(err.message || 'That action could not be completed.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    setBusyId('new')

    try {
      await api.appointments.create(form)
      setForm({
        patientName: '',
        patientPhone: '',
        doctorId: '',
        date: todayISO(),
        time: SLOT_TIMES[0],
        reason: '',
      })
      setShowForm(false)
      await reload()
    } catch (err) {
      setError(err.message || 'That appointment could not be created.')
    } finally {
      setBusyId(null)
    }
  }

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading appointments…</p>
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Clinical</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Appointments</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
            Patient requests arrive here first — confirm them, mark them completed, or book a
            walk-in for the front desk.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          <Plus size={14} />
          {showForm ? 'Close' : 'New appointment'}
        </button>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="mt-6 grid gap-5 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-2"
        >
          <div>
            <label htmlFor="patientName" className="text-sm font-semibold text-ink">
              Patient name
            </label>
            <input
              id="patientName"
              required
              minLength={2}
              value={form.patientName}
              onChange={(event) => setForm((c) => ({ ...c, patientName: event.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="patientPhone" className="text-sm font-semibold text-ink">
              Phone
            </label>
            <input
              id="patientPhone"
              value={form.patientPhone}
              onChange={(event) => setForm((c) => ({ ...c, patientPhone: event.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <SelectField
            id="doctorId"
            label="Doctor"
            required
            value={form.doctorId}
            onChange={(event) => setForm((c) => ({ ...c, doctorId: event.target.value }))}
            options={[
              { value: '', label: 'Choose a doctor…' },
              ...doctors.map((doctor) => ({
                value: doctor.id ?? doctor._id,
                label: `${doctor.name}${doctor.specialty ? ` — ${doctor.specialty}` : ''}`,
              })),
            ]}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="date" className="text-sm font-semibold text-ink">
                Date
              </label>
              <input
                id="date"
                type="date"
                required
                min={todayISO()}
                value={form.date}
                onChange={(event) => setForm((c) => ({ ...c, date: event.target.value }))}
                className={FIELD_CLASS}
              />
            </div>
            <SelectField
              id="time"
              label="Time"
              required
              value={form.time}
              onChange={(event) => setForm((c) => ({ ...c, time: event.target.value }))}
              options={SLOT_TIMES}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="reason" className="text-sm font-semibold text-ink">
              Reason
            </label>
            <input
              id="reason"
              required
              minLength={5}
              value={form.reason}
              onChange={(event) => setForm((c) => ({ ...c, reason: event.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busyId === 'new'} className={SUBMIT_CLASS}>
              {busyId === 'new' ? 'Booking…' : 'Book appointment'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {[
            { id: 'list', label: 'List' },
            { id: 'timetable', label: 'Timetable' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setView(option.id)}
              aria-pressed={view === option.id}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
                view === option.id ? 'bg-white text-ink shadow-soft' : 'text-mist hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {view === 'list' ? (
          <div className="w-full max-w-xs">
            <SelectField
              id="statusFilter"
              label="Filter by status"
              size="sm"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              options={FILTERS}
            />
          </div>
        ) : (
          <div className="w-full max-w-xs">
            <label htmlFor="timetableDate" className="text-sm font-semibold text-ink">
              Day
            </label>
            <input
              id="timetableDate"
              type="date"
              value={timetableDate}
              onChange={(event) => setTimetableDate(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>
        )}
      </div>

      {view === 'timetable' ? (
        <div className="mt-5">
          <Timetable
            rows={timetableRows}
            rowHeader="Doctor"
            emptyLabel={`Nothing booked for ${formatSlotDate(timetableDate)}.`}
          />
        </div>
      ) : null}

      {view === 'list' && visible.length ? (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {visible.map((item) => {
            const id = item.id ?? item._id
            const next = NEXT_STATUS[item.status]

            return (
              <li key={id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="w-36 text-sm font-semibold text-ink">
                  {formatSlotDate(item.date)}
                  <span className="ml-2 text-mist">{item.time}</span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {item.patientName}
                  </span>
                  <span className="block truncate text-xs text-mist">
                    {item.doctorName || 'Any doctor'}
                    {item.specialty ? ` · ${item.specialty}` : ''}
                    {item.source === 'ai' ? ' · booked with Aurora AI' : ''}
                  </span>
                  {item.reason ? (
                    <span className="mt-1 block truncate text-xs text-body">{item.reason}</span>
                  ) : null}
                </span>

                <StatusChip
                  status={item.status}
                  label={APPOINTMENT_STATUS_LABELS[item.status] ?? item.status}
                />

                <span className="flex items-center gap-3">
                  {next && item.status !== 'cancelled' && item.status !== 'completed' ? (
                    <button
                      type="button"
                      onClick={() => handleStatus(id, next.status)}
                      disabled={busyId === id}
                      className="text-xs font-semibold text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-60"
                    >
                      {next.label}
                    </button>
                  ) : null}
                  {item.status !== 'cancelled' && item.status !== 'completed' ? (
                    <button
                      type="button"
                      onClick={() => handleStatus(id, 'cancelled')}
                      disabled={busyId === id}
                      className="text-xs font-semibold text-mist transition-colors hover:text-danger disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      {view === 'list' && !visible.length ? (
        <p className="mt-5 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
          {filter === 'all'
            ? 'No appointments yet — patient requests will appear here.'
            : `No ${APPOINTMENT_STATUS_LABELS[filter] ?? filter} appointments right now.`}
        </p>
      ) : null}
    </>
  )
}
