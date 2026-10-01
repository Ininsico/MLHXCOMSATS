import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import ImageUploadField from '../../components/ImageUploadField'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

function toForm(hospital) {
  return {
    description: hospital.description ?? '',
    phone: hospital.phone ?? '',
    address: hospital.address ?? '',
    area: hospital.area ?? '',
    city: hospital.city ?? '',
    specialties: (hospital.specialties ?? []).join(', '),
    logoUrl: hospital.logoUrl ?? '',
  }
}

function ProfileForm({ hospital, save }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => toForm(hospital))
  const [saveState, setSaveState] = useState('idle')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (saveState !== 'saved') return undefined

    const timer = setTimeout(() => navigate('/hospital'), 1200)
    return () => clearTimeout(timer)
  }, [saveState, navigate])

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setSaveState('idle')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaveError('')
    setSaveState('saving')

    try {
      await save({
        description: form.description,
        phone: form.phone,
        address: form.address,
        area: form.area,
        city: form.city,
        logoUrl: form.logoUrl,
        specialties: form.specialties
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
      setSaveState('saved')
    } catch (err) {
      setSaveError(err.message || 'Unable to save your changes.')
      setSaveState('error')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 max-w-2xl space-y-5 rounded-2xl border border-line bg-white p-6 shadow-soft"
    >
      <div>
        <label htmlFor="description" className="text-sm font-semibold text-ink">
          About your hospital
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          required
          minLength={20}
          maxLength={600}
          value={form.description}
          onChange={handleChange}
          className={FIELD_CLASS}
        />
        <p className="mt-1.5 text-xs text-mist">20 to 600 characters.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="text-sm font-semibold text-ink">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            minLength={5}
            value={form.phone}
            onChange={handleChange}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor="address" className="text-sm font-semibold text-ink">
            Street address
          </label>
          <input
            id="address"
            name="address"
            required
            minLength={5}
            value={form.address}
            onChange={handleChange}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor="area" className="text-sm font-semibold text-ink">
            Area
          </label>
          <input
            id="area"
            name="area"
            required
            minLength={2}
            value={form.area}
            onChange={handleChange}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor="city" className="text-sm font-semibold text-ink">
            City
          </label>
          <input
            id="city"
            name="city"
            required
            minLength={2}
            value={form.city}
            onChange={handleChange}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <div>
        <label htmlFor="specialties" className="text-sm font-semibold text-ink">
          Specialties
        </label>
        <input
          id="specialties"
          name="specialties"
          required
          value={form.specialties}
          onChange={handleChange}
          className={FIELD_CLASS}
        />
        <p className="mt-1.5 text-xs text-mist">
          Comma separated — e.g. Cardiology, Pediatrics, Emergency.
        </p>
      </div>

      <ImageUploadField
        id="logo"
        label="Hospital logo"
        hint="Shown on your public profile — PNG, JPG, or WebP up to 4 MB."
        value={form.logoUrl}
        onChange={(url) => {
          setForm((current) => ({ ...current, logoUrl: url }))
          setSaveState('idle')
        }}
      />

      {saveError ? <p className="text-sm font-medium text-danger">{saveError}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={saveState === 'saving'} className={SUBMIT_CLASS}>
          {saveState === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {saveState === 'saved' ? (
          <span className="text-sm font-medium text-brand-700">Saved — opening your dashboard…</span>
        ) : null}
      </div>
    </form>
  )
}

export default function HospitalProfilePage() {
  const { hospital, state, save } = useOutletContext()

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading your hospital…</p>
  }

  if (state !== 'ready' || !hospital) {
    return <p className="text-sm text-danger">Couldn't load your hospital. Refresh to try again.</p>
  }

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Profile</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          Edit your public listing
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
          This is what patients read before they call you. Saving takes you back to the
          dashboard.
        </p>
      </header>

      <ProfileForm key={hospital.id ?? hospital._id} hospital={hospital} save={save} />
    </>
  )
}
