import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'
import { APPOINTMENT_STATUS_LABELS } from '../../lib/labels'
import { formatSlotDate } from '../../lib/themes'

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

export default function DoctorAppointmentsPage() {
  const { appointments, state, refresh } = useOutletContext()
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading your appointments…</p>
  }

  const visible = appointments
    .filter((item) => filter === 'all' || item.status === filter)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))

  async function handleStatus(id, status) {
    setBusyId(id)
    setError('')

    try {
      await api.doctor.updateAppointment(id, status)
      await refresh()
    } catch (err) {
      setError(err.message || 'That action could not be completed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Bookings</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">My appointments</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
          Requests booked with you — confirm them, mark them completed, or cancel if you cannot
          make it.
        </p>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}

      <div className="mt-6 max-w-xs">
        <SelectField
          id="statusFilter"
          label="Filter by status"
          size="sm"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          options={FILTERS}
        />
      </div>

      {visible.length ? (
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
                    {item.reason || 'No reason given'}
                    {item.patientPhone ? ` · ${item.patientPhone}` : ''}
                  </span>
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
      ) : (
        <p className="mt-5 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
          {filter === 'all'
            ? 'No appointments booked with you yet.'
            : `No ${APPOINTMENT_STATUS_LABELS[filter] ?? filter} appointments right now.`}
        </p>
      )}
    </>
  )
}
