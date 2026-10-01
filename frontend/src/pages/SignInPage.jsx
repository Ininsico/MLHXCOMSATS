import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthSplitLayout from '../components/AuthSplitLayout'
import { PasswordField, TextField } from '../components/FormFields'
import SelectField from '../components/SelectField'
import { useAuth } from '../context/auth-context'
import { api } from '../lib/api'
import { homeFor } from '../lib/roles'

const DEMO_ROLES = [
  { value: 'patient', label: 'Patient' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'admin', label: 'Admin' },
]

const DEMO_HINTS = {
  patient: 'Appointments, lab reports, Aurora AI doctors and therapy',
  doctor: 'Today list, timetable, lab requests, clinical AI on the local model',
  hospital: 'Approved portal: appointments, staff, lab, inventory, plan',
  admin: 'Applications, verification, hospitals, plans, accounts',
}

const SUBMIT_CLASS =
  'h-11 w-full rounded-lg bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const TABS = [
  { id: 'password', label: 'Password' },
  { id: 'code', label: 'Email code' },
]

export default function SignInPage() {
  const { signin, verifyOtp, demoLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from

  const [mode, setMode] = useState('password')
  const [form, setForm] = useState({ email: '', password: '', code: '' })
  const [codeSent, setCodeSent] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [demoRole, setDemoRole] = useState('patient')
  const [demoBusy, setDemoBusy] = useState(false)
  const [demoError, setDemoError] = useState('')

  async function handleDemoLogin() {
    setDemoError('')
    setDemoBusy(true)

    try {
      const account = await demoLogin(demoRole)
      navigate(from ?? homeFor(account?.role), { replace: true })
    } catch (err) {
      setDemoError(err.message || 'Instant sign-in failed.')
    } finally {
      setDemoBusy(false)
    }
  }

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function switchMode(next) {
    setMode(next)
    setError('')
    setNotice('')
    setCodeSent(false)
  }

  function finish(account) {
    navigate(from ?? homeFor(account?.role), { replace: true })
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      finish(await signin({ email: form.email, password: form.password }))
    } catch (err) {
      setError(err.message || 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestCode(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const data = await api.otp.request({ email: form.email })
      setNotice(`We emailed a ${data?.expiresInMinutes ?? 10}-minute sign-in code to ${form.email.trim()}.`)
      setCodeSent(true)
    } catch (err) {
      setError(err.message || 'We could not send the code.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      finish(await verifyOtp({ email: form.email, code: form.code }))
    } catch (err) {
      setError(err.message || 'That code could not be verified.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthSplitLayout
      formSide="left"
      title="Welcome back"
      subtitle={
        from?.startsWith('/explore')
          ? 'Sign in to explore hospitals near you.'
          : 'Sign in to pick up where you left off.'
      }
      footer={
        <div className="flex flex-col gap-2">
          <span>
            New to Aurora?{' '}
            <Link
              to="/signup"
              className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Create a patient account
            </Link>
          </span>
          <span className="text-xs">
            Hospital staff?{' '}
            <Link
              to="/hospital/signin"
              className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Sign in to the management portal
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
      <section className="mb-5 rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Demo access</p>
        <p className="mt-1 text-xs leading-relaxed text-body">
          Pick a role and jump straight into a seeded account — no password, no code.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SelectField
            id="demo-role"
            label="Sign in as"
            size="sm"
            className="sm:w-44"
            value={demoRole}
            onChange={(event) => setDemoRole(event.target.value)}
            options={DEMO_ROLES}
          />

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoBusy}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {demoBusy ? 'Signing in…' : 'Sign in instantly'}
          </button>
        </div>

        {demoError ? <p className="mt-3 text-xs font-medium text-danger">{demoError}</p> : null}

        <p className="mt-3 text-xs leading-relaxed text-mist">
          <span className="font-semibold text-body">{DEMO_ROLES.find((role) => role.value === demoRole)?.label}:</span>{' '}
          {DEMO_HINTS[demoRole]}
        </p>
      </section>

      <div className="mb-5 flex w-full rounded-full border border-line bg-surface p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchMode(tab.id)}
            aria-pressed={mode === tab.id}
            className={`flex-1 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
              mode === tab.id ? 'bg-white text-ink shadow-soft' : 'text-mist hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
            autoComplete="current-password"
            required
            value={form.password}
            onChange={handleChange}
            label="Password"
          />

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <button type="submit" disabled={submitting} className={SUBMIT_CLASS}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-xs text-mist">
            Forgot your password?{' '}
            <Link
              to="/forgot-password"
              className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Reset it with an email code
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={codeSent ? handleVerifyCode : handleRequestCode} className="space-y-4">
          <TextField
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={handleChange}
            label="Email"
            disabled={codeSent}
          />

          {codeSent ? (
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
              hint="Check your inbox — the code expires in 10 minutes."
            />
          ) : null}

          {notice ? <p className="text-sm font-medium text-brand-700">{notice}</p> : null}
          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <button type="submit" disabled={submitting} className={SUBMIT_CLASS}>
            {submitting
              ? codeSent
                ? 'Verifying…'
                : 'Sending code…'
              : codeSent
                ? 'Verify and sign in'
                : 'Email me a code'}
          </button>

          {codeSent ? (
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <button
                type="button"
                onClick={handleRequestCode}
                disabled={submitting}
                className="font-semibold text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-60"
              >
                Send a new code
              </button>
              <button
                type="button"
                onClick={() => {
                  setCodeSent(false)
                  setNotice('')
                  setError('')
                  setForm((current) => ({ ...current, code: '' }))
                }}
                className="font-semibold text-mist transition-colors hover:text-ink"
              >
                Use a different email
              </button>
            </div>
          ) : null}

          <p className="text-xs text-mist">
            No password to remember — we email you a one-time code instead.
          </p>
        </form>
      )}
    </AuthSplitLayout>
  )
}
