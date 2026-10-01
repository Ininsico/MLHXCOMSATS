import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthSplitLayout from '../components/AuthSplitLayout'
import { PasswordField, TextField } from '../components/FormFields'
import { useAuth } from '../context/auth-context'

export default function HospitalSignInPage() {
  const { signin, signout } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
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
      const account = await signin(form)
      if (account?.role !== 'hospital') {
        await signout()
        setError('This is not a hospital account. Use the patient sign in instead.')
      } else {
        navigate('/hospital', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthSplitLayout
      formSide="left"
      eyebrow="Hospital portal"
      title="Hospital management sign in"
      subtitle="Manage your hospital's profile, specialties, and presence on Aurora."
      footer={
        <div className="flex flex-col gap-2">
          <span className="text-xs">
            Looking for patient sign in?{' '}
            <Link
              to="/signin"
              className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Go to the patient portal
            </Link>
          </span>
          <span className="text-xs">
            Administrator?{' '}
            <Link
              to="/admin"
              className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Sign in to the admin console
            </Link>
          </span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <TextField
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={handleChange}
          label="Hospital account email"
        />

        <PasswordField
          id="password"
          name="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={handleChange}
          label="Password"
        />

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-lg bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in to hospital portal'}
        </button>
      </form>
    </AuthSplitLayout>
  )
}
