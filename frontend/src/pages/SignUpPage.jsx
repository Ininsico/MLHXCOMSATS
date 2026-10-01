import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthSplitLayout from '../components/AuthSplitLayout'
import { PasswordField, TextField } from '../components/FormFields'
import { useAuth } from '../context/auth-context'

export default function SignUpPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
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
      await signup(form)
      navigate('/verify-email', { replace: true })
    } catch (err) {
      setError(err.message || 'Unable to create your account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthSplitLayout
      formSide="right"
      title="Create your account"
      subtitle="Join Aurora and find care around you in minutes."
      footer={
        <div className="flex flex-col gap-2">
          <span>
            Already have an account?{' '}
            <Link
              to="/signin"
              className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Sign in
            </Link>
          </span>
          <span className="text-xs">
            Hospital staff?{' '}
            <Link
              to="/hospital/apply"
              className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Register your hospital
            </Link>{' '}
            or{' '}
            <Link
              to="/hospital/signin"
              className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              sign in to the portal
            </Link>
            .
          </span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <TextField
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          value={form.name}
          onChange={handleChange}
          label="Full name"
        />

        <TextField
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={handleChange}
          label="Email"
        />

        <PasswordField
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={handleChange}
          label="Password"
          hint="At least 8 characters."
        />

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-lg bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthSplitLayout>
  )
}
