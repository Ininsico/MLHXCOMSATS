import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowRight, Check, Eye, ShieldCheck } from 'lucide-react'
import ImageUploadField from '../../components/ImageUploadField'
import { TextField } from '../../components/FormFields'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const SECONDARY_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line px-6 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const SECTION_LABEL = 'text-xs font-bold uppercase tracking-widest text-brand-700'
const SECTION_HINT = 'mt-1.5 max-w-2xl text-xs leading-relaxed text-mist'

const TIPS = [
  'A calm 20–600 character description — what you treat, and what patients should bring.',
  'A phone number and street address patients can act on immediately.',
  'Specialties that match the departments you actually run.',
]

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
      className="rounded-2xl border border-line bg-white p-6 shadow-soft md:p-8"
    >
      <section>
        <h2 className={SECTION_LABEL}>Hospital information</h2>
        <p className={SECTION_HINT}>
          The summary patients read first — what you treat, and what makes your hospital easy to
          choose.
        </p>

        <div className="mt-5">
          <label htmlFor="description" className="text-sm font-semibold text-ink">
            About your hospital
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            required
            minLength={20}
            maxLength={600}
            value={form.description}
            onChange={handleChange}
            placeholder="e.g. A 120-bed general hospital with 24-hour emergency cover, an on-site laboratory, and paediatrics."
            className={FIELD_CLASS}
          />
          <p className="mt-1.5 text-xs text-mist">
            20 to 600 characters · {form.description.trim().length} used.
          </p>
        </div>
      </section>

      <section className="mt-8 border-t border-line pt-8">
        <h2 className={SECTION_LABEL}>Contact &amp; location</h2>
        <p className={SECTION_HINT}>How patients reach you, and how they find your gate.</p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TextField
            id="phone"
            name="phone"
            type="tel"
            required
            minLength={5}
            value={form.phone}
            onChange={handleChange}
            label="Phone"
            placeholder="e.g. 0992-123456"
          />
          <TextField
            id="address"
            name="address"
            type="text"
            required
            minLength={5}
            value={form.address}
            onChange={handleChange}
            label="Street address"
            placeholder="Street, building, landmark"
          />
          <TextField
            id="area"
            name="area"
            type="text"
            required
            minLength={2}
            value={form.area}
            onChange={handleChange}
            label="Area"
            placeholder="e.g. Mandian"
          />
          <TextField
            id="city"
            name="city"
            type="text"
            required
            minLength={2}
            value={form.city}
            onChange={handleChange}
            label="City"
            placeholder="e.g. Abbottabad"
          />
        </div>
      </section>

      <section className="mt-8 border-t border-line pt-8">
        <h2 className={SECTION_LABEL}>Specialties</h2>
        <p className={SECTION_HINT}>
          Patients filter the directory by these — list the departments you actually run.
        </p>

        <div className="mt-5">
          <TextField
            id="specialties"
            name="specialties"
            type="text"
            required
            value={form.specialties}
            onChange={handleChange}
            label="Specialties"
            placeholder="Cardiology, Pediatrics, Emergency"
            hint="Comma separated — e.g. Cardiology, Pediatrics, Emergency."
          />
        </div>
      </section>

      <section className="mt-8 border-t border-line pt-8">
        <h2 className={SECTION_LABEL}>Hospital logo</h2>
        <p className={SECTION_HINT}>
          Shown on your public page, and beside your name everywhere patients see you.
        </p>

        <div className="mt-5">
          <ImageUploadField
            id="logo"
            label="Logo image"
            hint="Optional — PNG, JPG, or WebP up to 4 MB."
            value={form.logoUrl}
            onChange={(url) => {
              setForm((current) => ({ ...current, logoUrl: url }))
              setSaveState('idle')
            }}
          />
        </div>
      </section>

      {saveError ? <p className="mt-6 text-sm font-medium text-danger">{saveError}</p> : null}

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <button type="submit" disabled={saveState === 'saving'} className={SUBMIT_CLASS}>
          {saveState === 'saving' ? 'Saving…' : 'Save changes'}
        </button>

        <Link to="/hospital" className={SECONDARY_CLASS}>
          Cancel
        </Link>

        {saveState === 'saved' ? (
          <span className="text-sm font-medium text-brand-700">
            Saved — opening your dashboard…
          </span>
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

  const verified = hospital.verification?.status === 'verified'
  const specialtyCount = hospital.specialties?.length ?? 0

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">Profile</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
            Edit your public listing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
            This is what patients read before they call you. Saving takes you back to the
            dashboard.
          </p>
        </div>

        <Link to="/hospital/public-page" className={SECONDARY_CLASS}>
          <Eye size={15} />
          Preview public listing
        </Link>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <ProfileForm key={hospital.id ?? hospital._id} hospital={hospital} save={save} />

        <aside className="space-y-5 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className={SECTION_LABEL}>Public listing details</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-mist">
              What patients see on your public page right now.
            </p>

            <dl className="mt-5 space-y-4">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-mist uppercase">
                  Listing name
                </dt>
                <dd className="mt-1 text-sm font-semibold text-ink">{hospital.name}</dd>
              </div>

              <div>
                <dt className="text-xs font-semibold tracking-wide text-mist uppercase">
                  Verification
                </dt>
                <dd className="mt-1.5">
                  {verified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
                      <ShieldCheck size={13} />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-xs font-semibold text-body">
                      Not verified yet
                    </span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold tracking-wide text-mist uppercase">
                  Specialties
                </dt>
                <dd className="mt-1 text-sm text-ink">
                  {specialtyCount ? `${specialtyCount} listed` : 'None listed yet'}
                </dd>
              </div>
            </dl>

            <Link
              to="/hospital/public-page"
              className="mt-5 inline-flex items-center gap-2 border-t border-line pt-4 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Open the public page editor
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-sm font-semibold text-ink">What makes a good listing</h2>
            <ul className="mt-4 space-y-3">
              {TIPS.map((tip) => (
                <li key={tip} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-brand-700">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="text-xs leading-relaxed text-body">{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
