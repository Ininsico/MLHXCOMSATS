import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'
import { ROLE_LABELS, STAFF_STATUS_LABELS } from '../../lib/labels'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const ROLES = ['doctor', 'nurse', 'receptionist', 'lab', 'admin']
const STATUSES = ['active', 'leave', 'inactive']

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
]

const STATUS_OPTIONS = STATUSES.map((status) => ({
  value: status,
  label: STAFF_STATUS_LABELS[status],
}))

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  role: 'doctor',
  specialty: '',
  department: '',
}

export default function HospitalDoctorsPage() {
  const { staff, state, reload } = useOutletContext()
  const [roleFilter, setRoleFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const visible = staff.filter((member) => roleFilter === 'all' || member.role === roleFilter)

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    setBusyId('new')

    try {
      await api.staff.create(form)
      setForm(EMPTY_FORM)
      setShowForm(false)
      await reload()
    } catch (err) {
      setError(err.message || 'That staff member could not be added.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleStatus(id, status) {
    setBusyId(id)
    setError('')

    try {
      await api.staff.update(id, { status })
      await reload()
    } catch (err) {
      setError(err.message || 'That change could not be saved.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(id) {
    setBusyId(id)
    setError('')

    try {
      await api.staff.remove(id)
      await reload()
    } catch (err) {
      setError(err.message || 'That staff member could not be removed.')
    } finally {
      setBusyId(null)
    }
  }

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading your team…</p>
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Clinical</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Doctors & staff</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
            Register doctors and the wider team, then set what each role can do. Only active
            doctors appear in patient booking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          <Plus size={14} />
          {showForm ? 'Close' : 'Add member'}
        </button>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="mt-6 grid gap-5 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-2"
        >
          <div>
            <label htmlFor="name" className="text-sm font-semibold text-ink">
              Full name
            </label>
            <input
              id="name"
              required
              minLength={2}
              value={form.name}
              onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
              className={FIELD_CLASS}
            />
          </div>

          <SelectField
            id="role"
            label="Role"
            required
            value={form.role}
            onChange={(event) => setForm((c) => ({ ...c, role: event.target.value }))}
            options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
          />

          <div>
            <label htmlFor="email" className="text-sm font-semibold text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((c) => ({ ...c, email: event.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="phone" className="text-sm font-semibold text-ink">
              Phone
            </label>
            <input
              id="phone"
              value={form.phone}
              onChange={(event) => setForm((c) => ({ ...c, phone: event.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="specialty" className="text-sm font-semibold text-ink">
              Specialty (doctors)
            </label>
            <input
              id="specialty"
              value={form.specialty}
              onChange={(event) => setForm((c) => ({ ...c, specialty: event.target.value }))}
              placeholder="Cardiology"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="department" className="text-sm font-semibold text-ink">
              Department
            </label>
            <input
              id="department"
              value={form.department}
              onChange={(event) => setForm((c) => ({ ...c, department: event.target.value }))}
              placeholder="Outpatient"
              className={FIELD_CLASS}
            />
          </div>

          <div className="sm:col-span-2">
            <button type="submit" disabled={busyId === 'new'} className={SUBMIT_CLASS}>
              {busyId === 'new' ? 'Adding…' : 'Add to team'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 max-w-xs">
        <SelectField
          id="roleFilter"
          label="Filter by role"
          size="sm"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          options={ROLE_OPTIONS}
        />
      </div>

      {visible.length ? (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {visible.map((member) => {
            const id = member.id ?? member._id

            return (
              <li key={id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-extrabold text-brand-700">
                  {member.name.charAt(0)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {member.name}
                  </span>
                  <span className="block truncate text-xs text-mist">
                    {member.specialty || member.department || 'No department set'}
                    {member.email ? ` · ${member.email}` : ''}
                    {member.phone ? ` · ${member.phone}` : ''}
                  </span>
                </span>

                <StatusChip
                  status={member.role}
                  label={ROLE_LABELS[member.role] ?? member.role}
                />

                <SelectField
                  id={`status-${id}`}
                  aria-label={`Status for ${member.name}`}
                  size="sm"
                  className="w-full sm:w-36"
                  value={member.status}
                  onChange={(event) => handleStatus(id, event.target.value)}
                  disabled={busyId === id}
                  options={STATUS_OPTIONS}
                />

                <button
                  type="button"
                  onClick={() => handleRemove(id)}
                  disabled={busyId === id}
                  aria-label={`Remove ${member.name}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-mist transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
          {roleFilter === 'all'
            ? 'No staff yet — add your first doctor to start taking bookings.'
            : `No ${ROLE_LABELS[roleFilter] ?? roleFilter} accounts yet.`}
        </p>
      )}
    </>
  )
}
