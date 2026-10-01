import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthSplitLayout from '../components/AuthSplitLayout'
import { TextField } from '../components/FormFields'
import ImageUploadField from '../components/ImageUploadField'
import { useAuth } from '../context/auth-context'

const SUBMIT_CLASS =
  'h-11 w-full rounded-lg bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  hospitalName: '',
  city: '',
  area: '',
  phone: '',
  specialties: '',
  description: '',
  logoUrl: '',
}

export default function HospitalApplyPage() {
  const { applyHospital } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await applyHospital({
        name: form.name,
        email: form.email,
        password: form.password,
        hospitalName: form.hospitalName,
        city: form.city,
        area: form.area,
        phone: form.phone,
        description: form.description,
        logoUrl: form.logoUrl,
        specialties: form.specialties
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
      navigate('/hospital/pending', { replace: true })
    } catch (err) {
      setError(err.message || 'We could not submit your application.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthSplitLayout
      formSide="right"
      eyebrow="Hospital portal"
      title="Register your hospital"
      subtitle="Tell us about your hospital — our team reviews every application before it appears in search."
      footer={
        <span className="text-xs">
          Already registered?{' '}
          <Link
            to="/hospital/signin"
            className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            Sign in to the portal
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
            Your account
          </p>
          <p className="mt-1 text-xs leading-relaxed text-body">
            This is how you sign in to manage the hospital profile.
          </p>
        </div>

        <TextField
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          value={form.name}
          onChange={handleChange}
          label="Your full name"
        />

        <TextField
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={handleChange}
          label="Work email"
        />

        <TextField
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={handleChange}
          label="Password"
          hint="At least 8 characters — you can also sign in with an email code."
        />

        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
            Hospital details
          </p>
          <p className="mt-1 text-xs leading-relaxed text-body">
            Patients will see this once your application is approved.
          </p>
        </div>

        <TextField
          id="hospitalName"
          name="hospitalName"
          type="text"
          required
          minLength={2}
          value={form.hospitalName}
          onChange={handleChange}
          label="Hospital name"
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="city"
            name="city"
            type="text"
            required
            minLength={2}
            value={form.city}
            onChange={handleChange}
            label="City"
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
          />
        </div>

        <TextField
          id="phone"
          name="phone"
          type="tel"
          required
          minLength={5}
          value={form.phone}
          onChange={handleChange}
          label="Phone"
        />

        <TextField
          id="specialties"
          name="specialties"
          type="text"
          required
          value={form.specialties}
          onChange={handleChange}
          label="Specialties"
          hint="Comma separated — e.g. Cardiology, Pediatrics, Emergency."
        />

        <div>
          <label htmlFor="description" className="text-sm font-semibold text-ink">
            About the hospital
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
          <p className="mt-1.5 text-xs text-mist">
            A short, calm summary patients will read first — 20 to 600 characters.
          </p>
        </div>

        <ImageUploadField
          id="logo"
          label="Hospital logo"
          hint="Optional — PNG, JPG, or WebP up to 4 MB."
          value={form.logoUrl}
          onChange={(url) => setForm((current) => ({ ...current, logoUrl: url }))}
        />

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

        <button type="submit" disabled={submitting} className={SUBMIT_CLASS}>
          {submitting ? 'Submitting application…' : 'Submit application'}
        </button>

        <p className="text-xs leading-relaxed text-mist">
          By applying you agree that Aurora's team may contact the details you provided to
          verify your hospital.
        </p>
      </form>
    </AuthSplitLayout>
  )
}
