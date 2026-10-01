import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, CalendarCheck, MapPin, Stethoscope } from 'lucide-react'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'
import { APPOINTMENT_STATUS_LABELS } from '../../lib/labels'
import { SPECIALTIES } from '../../lib/specialties'
import { formatSlotDate, todayISO } from '../../lib/themes'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

export default function DoctorOverviewPage() {
  const { staff, appointments, state, refresh } = useOutletContext()
  const [form, setForm] = useState(null)
  const [saveState, setSaveState] = useState('idle')
  const [error, setError] = useState('')

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading your profile…</p>
  }

  if (state !== 'ready' || !staff) {
    return <p className="text-sm text-danger">Couldn't load your profile. Refresh to try again.</p>
  }

  const hospital = staff.hospital ?? {}
  const today = todayISO()
  const todayAppointments = appointments
    .filter((item) => item.date === today && item.status !== 'cancelled')
    .sort((a, b) => a.time.localeCompare(b.time))
  const upcoming = appointments
    .filter((item) => item.date > today && item.status !== 'cancelled')
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  const confirmed = appointments.filter((item) => item.status === 'confirmed').length
  const completed = appointments.filter((item) => item.status === 'completed').length

  const details = form ?? {
    phone: staff.phone ?? '',
    department: staff.department ?? '',
    specialty: staff.specialty ?? '',
  }

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setSaveState('saving')

    try {
      await api.doctor.updateProfile(details)
      await refresh()
      setForm(null)
      setSaveState('saved')
    } catch (err) {
      setError(err.message || 'Your details could not be saved.')
      setSaveState('error')
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
            Doctor dashboard
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{staff.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-mist">
            <span className="flex items-center gap-2">
              <Stethoscope size={15} />
              {staff.specialty || 'No specialty set'}
              {staff.department ? ` · ${staff.department}` : ''}
            </span>
            {hospital.name ? (
              <span className="flex items-center gap-2">
                <MapPin size={15} />
                {hospital.name}
                {hospital.city ? ` · ${hospital.city}` : ''}
              </span>
            ) : null}
          </p>
        </div>

        <StatusChip status={staff.status} />
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">Today</p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{todayAppointments.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">Confirmed</p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{confirmed}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist">Completed</p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{completed}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <CalendarCheck size={18} className="text-brand-700" />
              Today&apos;s schedule
            </h2>
            <Link
              to="/doctor/timetable"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Timetable
              <ArrowRight size={13} />
            </Link>
          </div>

          {todayAppointments.length ? (
            <ul className="mt-5 space-y-3">
              {todayAppointments.map((item) => (
                <li
                  key={item.id ?? item._id}
                  className="flex items-center gap-4 rounded-xl bg-surface px-4 py-3"
                >
                  <span className="text-sm font-bold text-ink">{item.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {item.patientName}
                    </span>
                    {item.reason ? (
                      <span className="block truncate text-xs text-mist">{item.reason}</span>
                    ) : null}
                  </span>
                  <StatusChip
                    status={item.status}
                    label={APPOINTMENT_STATUS_LABELS[item.status] ?? item.status}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl bg-surface px-4 py-6 text-sm text-mist">
              Nothing booked for today.
            </p>
          )}

          {upcoming.length ? (
            <div className="mt-6 border-t border-line pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-mist">
                Next up
              </p>
              <ul className="mt-3 space-y-2">
                {upcoming.slice(0, 4).map((item) => (
                  <li key={item.id ?? item._id} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 text-xs font-semibold text-ink">
                      {formatSlotDate(item.date)}
                    </span>
                    <span className="text-xs text-mist">{item.time}</span>
                    <span className="min-w-0 flex-1 truncate text-body">{item.patientName}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">My details</h2>
          <p className="mt-1 text-sm text-mist">
            These appear on patient bookings made with you.
          </p>

          <form onSubmit={handleSave} className="mt-5 space-y-5">
            <SelectField
              id="specialty"
              label="Specialty"
              value={details.specialty}
              onChange={(event) =>
                setForm((current) => ({ ...(current ?? details), specialty: event.target.value }))
              }
              options={[{ value: '', label: 'Choose a specialty…' }, ...SPECIALTIES]}
            />

            <div>
              <label htmlFor="department" className="text-sm font-semibold text-ink">
                Department
              </label>
              <input
                id="department"
                value={details.department}
                onChange={(event) =>
                  setForm((current) => ({ ...(current ?? details), department: event.target.value }))
                }
                placeholder="Outpatient"
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label htmlFor="phone" className="text-sm font-semibold text-ink">
                Phone
              </label>
              <input
                id="phone"
                value={details.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...(current ?? details), phone: event.target.value }))
                }
                className={FIELD_CLASS}
              />
            </div>

            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

            <div className="flex items-center gap-4">
              <button type="submit" disabled={saveState === 'saving'} className={SUBMIT_CLASS}>
                {saveState === 'saving' ? 'Saving…' : 'Save details'}
              </button>
              {saveState === 'saved' && !form ? (
                <span className="text-sm font-medium text-brand-700">Saved.</span>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </>
  )
}
