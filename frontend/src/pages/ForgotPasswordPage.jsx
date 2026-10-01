import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthSplitLayout from '../components/AuthSplitLayout'
import { PasswordField, TextField } from '../components/FormFields'
import { useAuth } from '../context/auth-context'
import { api } from '../lib/api'
import { homeFor } from '../lib/roles'

const SUBMIT_CLASS =
  'h-11 w-full rounded-lg bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('email')
  const [form, setForm] = useState({ email: '', code: '', password: '' })
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleRequest(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const data = await api.password.forgot({ email: form.email })
      setNotice(
        `We emailed a ${data?.expiresInMinutes ?? 10}-minute reset code to ${form.email.trim()}.`,
      )
      setStep('reset')
    } catch (err) {
      setError(err.message || 'We could not send the reset code.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const account = await resetPassword(form)
      navigate(homeFor(account?.role), { replace: true })
    } catch (err) {
      setError(err.message || 'That code could not be verified.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthSplitLayout
      formSide="left"
      eyebrow="Password reset"
      title={step === 'email' ? 'Reset your password' : 'Choose a new password'}
      subtitle={
        step === 'email'
          ? 'Enter your email and we will send a one-time code to verify it is you.'
          : 'Enter the code from your inbox, then pick a new password.'
      }
      footer={
        <span className="text-xs">
          Remembered it?{' '}
          <Link
            to="/signin"
            className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            Back to sign in
          </Link>
        </span>
      }
    >
      {step === 'email' ? (
        <form onSubmit={handleRequest} className="space-y-5">
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

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <button type="submit" disabled={submitting} className={SUBMIT_CLASS}>
            {submitting ? 'Sending code…' : 'Email me a reset code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-5">
          <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-body">
            {notice}
          </div>

          <TextField
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={form.code}
            onChange={handleChange}
            label="Six-digit code"
          />

          <PasswordField
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={handleChange}
            label="New password"
            hint="At least 8 characters."
          />

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <button type="submit" disabled={submitting} className={SUBMIT_CLASS}>
            {submitting ? 'Saving…' : 'Save password and sign in'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('email')
              setError('')
              setNotice('')
              setForm((current) => ({ ...current, code: '', password: '' }))
            }}
            className="text-xs font-semibold text-mist transition-colors hover:text-ink"
          >
            Use a different email
          </button>
        </form>
      )}
    </AuthSplitLayout>
  )
}
